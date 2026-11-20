'use strict';

// browse the bot's own files from chat: list a folder, or print a small
// text file. bot admin only, and locked down hard:
// - nothing outside the repo root (no ".." escapes, no absolute paths)
// - never session files, env files, keys, the database, or node_modules
// the messenger version also uploaded files to gist — that's gone here,
// it needs an external api and the original pasted a github token in
// plain text (that token should be revoked, it was committed to source).
const fs = require('fs');
const path = require('path');

const rootPath = path.resolve(__dirname, '..', '..');
const MAX_PREVIEW = 8000;
const PREVIEW_EXTS = new Set(['.js', '.json', '.md', '.txt', '.lang', '.yaml', '.yml', '.example']);

// anything matching one of these is never listed or read
const BLOCKED_NAMES = new Set([
	'.git', 'node_modules', '.env', 'account.txt', 'account.txt.bak', 'account.txt.tmp',
	'session.json', 'data', 'database', 'downloads'
]);
const BLOCKED_EXTS = new Set(['.pem', '.key', '.session.json']);

function isBlocked(relPath, name) {
	if (BLOCKED_NAMES.has(name)) return true;
	if (BLOCKED_EXTS.has(path.extname(name))) return true;
	if (name.endsWith('.session.json')) return true;
	// anything under data/ or database/ is off limits (sessions + user data)
	const first = relPath.split(path.sep)[0];
	if (first === 'data' || first === 'database') return true;
	return false;
}

function resolveTarget(userPath) {
	const cleaned = String(userPath || '').trim().replace(/^\/+/, '');
	const target = path.resolve(rootPath, cleaned);
	if (target !== rootPath && !target.startsWith(rootPath + path.sep)) return null;
	return { target, rel: path.relative(rootPath, target) || '.' };
}

module.exports = {
	config: {
		name: 'file',
		aliases: ['ls', 'browse'],
		version: '1.3',
		author: 'xemonbae01',
		countDown: 3,
		role: 2,
		description: { en: 'Browse files in the bot directory' },
		category: 'admin',
		guide: { en: '{pn} [optional: path/to/folder or file.js]' }
	},

	onStart: async function ({ event, args, message }) {
		const userPath = args.join(' ');
		const resolved = resolveTarget(userPath);
		if (!resolved) return message.reply('❌ That path is outside the bot folder.');

		const { target, rel } = resolved;
		if (!fs.existsSync(target)) return message.reply(`❌ Path not found:\n\`${userPath || 'root'}\``);
		if (isBlocked(rel, path.basename(target)) && target !== rootPath)
			return message.reply('❌ That path is blocked.');

		const stat = fs.statSync(target);
		if (stat.isDirectory()) {
			const contents = fs.readdirSync(target).filter((item) => {
				const itemRel = rel === '.' ? item : path.join(rel, item);
				return !isBlocked(itemRel, item);
			});
			if (!contents.length)
				return message.reply(`📂 Repository Browser: \`${rel}\`\n(empty folder)`);
			let msg = `📂 Repository Browser: \`${rel}\`\n`;
			let count = 1;
			const folders = contents.filter((item) => fs.statSync(path.join(target, item)).isDirectory());
			const files = contents.filter((item) => fs.statSync(path.join(target, item)).isFile());
			for (const folder of folders) msg += `${count++}. 📁 ${folder}\n`;
			for (const file of files) msg += `${count++}. 📄 ${file}\n`;
			return message.reply(msg.trim());
		}

		// a file: print it if it's small text, otherwise just say what it is
		const ext = path.extname(target).toLowerCase();
		if (!PREVIEW_EXTS.has(ext) || stat.size > MAX_PREVIEW)
			return message.reply(`📄 \`${path.basename(target)}\` — ${(stat.size / 1024).toFixed(1)} KB, can't preview this file type or size.`);
		try {
			const content = fs.readFileSync(target, 'utf8');
			return message.reply(`📄 \`${rel}\`\n\n${content}`);
		}
		catch (err) {
			return message.reply(`❌ Couldn't read that file: ${err.message}`);
		}
	}
};

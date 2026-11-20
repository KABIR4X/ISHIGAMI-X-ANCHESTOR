'use strict';

// command manager, messenger-level: load / unload / reload at runtime plus
// install from a url or pasted code, with the registry collision report
// the ig loader keeps. install auto-installs any npm package the new
// command requires, and overwriting an existing file needs a reaction
// confirm first.
const fs = require('fs');
const path = require('path');

const loadScripts = require('../../bot/login/loadScripts');

// axios is only needed to fetch code from a url, so load it on demand —
// the rest of this command (load/unload/reload/collisions) works fine
// without it, and a missing install shouldn't kill the whole command
function loadAxios() {
	try {
		return require('axios');
	}
	catch {
		throw new Error('axios is not installed — run npm install first');
	}
}

function getDomain(url) {
	const regex = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n]+)/im;
	const match = url.match(regex);
	return match ? match[1] : null;
}

function isURL(str) {
	try {
		new URL(str);
		return true;
	}
	catch {
		return false;
	}
}

// savetext pages keep the code in #content; no cheerio on ig, a regex does it
function extractSavetext(html) {
	const m = String(html).match(/id=["']content["'][^>]*>([\s\S]*?)<\/(?:div|pre|textarea|code)>/i);
	if (!m) return null;
	return m[1]
		.replace(/<[^>]+>/g, '')
		.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
		.replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

module.exports = {
	config: {
		name: 'cmd',
		version: '2.0.0',
		author: 'xemonbae01',
		countDown: 5,
		role: 2,
		description: { en: 'manage command files: load, unload, reload, install from url or code' },
		category: 'admin',
		guide: { en: '   {pn} load <name>' +
			'\n   {pn} loadAll' +
			'\n   {pn} unload <name or alias>' +
			'\n   {pn} reload <name>' +
			'\n   {pn} reloadAll' +
			'\n   {pn} install <url> <file.js>: install a command from a raw url' +
			'\n   {pn} install <file.js> <code>: install a command from pasted code' +
			'\n   {pn} collisions: show registry name/alias collisions' }
	},

	langs: {
		en: {
			missingFileName: '⚠️ | enter the command name you want to load',
			loaded: '✅ | loaded command "%1"',
			loadedError: '❌ | failed to load command "%1"\n%2: %3',
			loadedSuccess: '✅ | loaded (%1) commands',
			loadedFail: '❌ | failed to load (%1) commands\n%2',
			missingCommandNameUnload: '⚠️ | enter the command name you want to unload',
			unloaded: '✅ | unloaded command "%1"',
			unloadedError: '❌ | failed to unload command "%1"\n%2: %3',
			missingUrlCodeOrFileName: '⚠️ | enter the url or code and the file name to install',
			missingUrlOrCode: '⚠️ | enter the url or code of the command file',
			missingFileNameInstall: '⚠️ | enter a file name to save the command (with .js)',
			invalidUrl: '⚠️ | enter a valid url',
			invalidUrlOrCode: '⚠️ | could not get the command code',
			alreadExist: '⚠️ | that command file already exists, react to this message to overwrite it',
			installed: '✅ | installed command "%1", saved at %2',
			installedError: '❌ | failed to install command "%1"\n%2: %3'
		}
	},

	onStart: async function ({ message, args, event, api, getLang }) {
		const action = (args[0] || '').toLowerCase();
		const name = (args[1] || '').toLowerCase();

		if (action === 'collisions') {
			const report = loadScripts.getRegistryReport();
			const lines = [`registry: ${report.commands.length} command files, ${report.events.length} event files`];
			const shadowed = report.commands.filter((c) => c.shadowed);
			for (const c of shadowed)
				lines.push(c.dormant
					? `dormant: ${c.name} (${c.file}) — name taken, no free alias`
					: `shadowed: ${c.name} (${c.file}) — reachable as ${c.key}`);
			if (!report.collisions.length && !shadowed.length) lines.push('no collisions, clean registry');
			for (const col of report.collisions)
				lines.push(`collision: ${col.type} "${col.key}" — ${col.winner} won, ${col.loser} lost`);
			return message.reply(lines.join('\n'));
		}

		if (action === 'reloadall') {
			try {
				const counts = await loadScripts(api);
				return message.reply(`reloaded everything: ${counts.commands} commands, ${counts.events} events (${counts.shadowed} shadowed, ${counts.dormant} dormant)`);
			}
			catch (err) {
				return message.reply(`failed: ${err.message}`);
			}
		}

		if (action === 'load' && args.length === 2) {
			if (!name) return message.reply(getLang('missingFileName'));
			try {
				const loaded = loadScripts.loadCommand(name);
				return message.reply(getLang('loaded', loaded));
			}
			catch (err) {
				return message.reply(getLang('loadedError', name, err.name, err.message));
			}
		}

		if (action === 'loadall' || (action === 'load' && args.length > 2)) {
			const unloaded = (global.Anchestor.configCommands || {}).commandUnload || [];
			const fileNeedToLoad = action === 'loadall'
				? fs.readdirSync(__dirname)
					.filter((file) =>
						file.endsWith('.js')
						&& !file.endsWith('.eg.js')
						&& (process.env.NODE_ENV === 'development' ? true : !file.endsWith('dev.js'))
						&& !unloaded.includes(file) && !unloaded.includes(file.replace(/\.js$/, '')))
					.map((file) => file.slice(0, -3))
				: args.slice(1);
			const ok = [];
			const failed = [];
			for (const fileName of fileNeedToLoad) {
				try {
					loadScripts.loadCommand(fileName);
					ok.push(fileName);
				}
				catch (err) {
					failed.push(` ❗ ${fileName} => ${err.name}: ${err.message}`);
				}
			}
			let msg = '';
			if (ok.length) msg += getLang('loadedSuccess', ok.length);
			if (failed.length) msg += (msg ? '\n' : '') + getLang('loadedFail', failed.length, failed.join('\n'));
			return message.reply(msg || 'nothing to load');
		}

		if (action === 'unload') {
			if (!name) return message.reply(getLang('missingCommandNameUnload'));
			try {
				const removed = loadScripts.unloadCommand(name);
				return message.reply(getLang('unloaded', removed));
			}
			catch (err) {
				return message.reply(getLang('unloadedError', name, err.name, err.message));
			}
		}

		if (action === 'reload') {
			if (!name) return message.reply(getLang('missingFileName'));
			try {
				loadScripts.reloadCommand(name);
				return message.reply(getLang('loaded', name));
			}
			catch (err) {
				return message.reply(getLang('loadedError', name, err.name, err.message));
			}
		}

		if (action === 'install') {
			let url = args[1];
			let fileName = args[2];
			let rawCode;

			if (!url || !fileName) return message.reply(getLang('missingUrlCodeOrFileName'));

			// install <file.js> <code...> — the url slot holds the file name
			if (url.endsWith('.js') && !isURL(url)) {
				const tmp = fileName;
				fileName = url;
				url = tmp;
			}

			if (url && url.match(/(https?:\/\/(?:www\.|(?!www)))/)) {
				if (!fileName || !fileName.endsWith('.js'))
					return message.reply(getLang('missingFileNameInstall'));
				const domain = getDomain(url);
				if (!domain) return message.reply(getLang('invalidUrl'));

				if (domain === 'pastebin.com') {
					const regex = /https:\/\/pastebin\.com\/(?!raw\/)(.*)/;
					if (url.match(regex)) url = url.replace(regex, 'https://pastebin.com/raw/$1');
					if (url.endsWith('/')) url = url.slice(0, -1);
				}
				else if (domain === 'github.com') {
					const regex = /https:\/\/github\.com\/(.*)\/blob\/(.*)/;
					if (url.match(regex)) url = url.replace(regex, 'https://raw.githubusercontent.com/$1/$2');
				}

				try {
					rawCode = (await loadAxios().get(url)).data;
				}
				catch (err) {
					return message.reply(getLang('invalidUrlOrCode') + ` (${err.message})`);
				}

				if (domain === 'savetext.net') {
					rawCode = extractSavetext(rawCode);
					if (!rawCode) return message.reply(getLang('invalidUrlOrCode'));
				}
			}
			else {
				if (args[args.length - 1].endsWith('.js')) {
					fileName = args[args.length - 1];
					rawCode = event.body.slice(event.body.indexOf('install') + 7, event.body.indexOf(fileName) - 1);
				}
				else if (args[1].endsWith('.js')) {
					fileName = args[1];
					rawCode = event.body.slice(event.body.indexOf(fileName) + fileName.length + 1);
				}
				else {
					return message.reply(getLang('missingFileNameInstall'));
				}
			}

			if (!rawCode || !String(rawCode).trim())
				return message.reply(getLang('invalidUrlOrCode'));

			if (fs.existsSync(path.join(__dirname, fileName))) {
				const info = await message.reply(getLang('alreadExist'));
				if (info && info.messageID) {
					global.Anchestor.onReaction.set(info.messageID, {
						commandName: 'cmd',
						messageID: info.messageID,
						threadID: event.threadID,
						senderID: event.senderID,
						type: 'install',
						fileName,
						rawCode: String(rawCode)
					});
				}
				return;
			}

			try {
				const installed = loadScripts.installCommand(fileName, String(rawCode));
				return message.reply(getLang('installed', installed, path.join('scripts', 'cmds', fileName)));
			}
			catch (err) {
				return message.reply(getLang('installedError', fileName, err.name, err.message));
			}
		}

		return message.SyntaxError();
	},

	onReaction: async function ({ message, event, onReaction, getLang }) {
		if (!onReaction || onReaction.type !== 'install') return;
		global.Anchestor.onReaction.delete(event.messageID);
		const { fileName, rawCode } = onReaction;
		try {
			const installed = loadScripts.installCommand(fileName, rawCode);
			return message.reply(getLang('installed', installed, path.join('scripts', 'cmds', fileName)));
		}
		catch (err) {
			return message.reply(getLang('installedError', fileName, err.name, err.message));
		}
	}
};

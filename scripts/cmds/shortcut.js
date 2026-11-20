'use strict';

// shortcuts: type the trigger, the bot answers with the saved reply.
// text only on ig (no file attachments). triggers match the whole
// message, case-insensitive, and {name} becomes the sender's name.
async function loadAll(globalData) {
	const saved = await globalData.get('shortcuts');
	return Array.isArray(saved) ? saved : [];
}

module.exports = {
	config: {
		name: 'shortcut',
		aliases: ['shortcuts'],
		version: '1.8',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'Add, delete, list shortcuts (text auto-replies)' },
		category: 'group',
		guide: { en: '   {pn} add <trigger> => <reply>: save a shortcut, typing the trigger makes the bot reply'
			+ '\n   {pn} list: view all shortcuts'
			+ '\n   {pn} del <number|trigger> [...]: delete shortcuts by number or trigger'
			+ '\n   {name} in a reply becomes the name of whoever triggered it' }
	},

	onStart: async function ({ args, message, event, globalData, usersData }) {
		const shortcuts = await loadAll(globalData);

		if (args[0] === 'add') {
			const rest = args.slice(1).join(' ');
			const sep = rest.indexOf('=>');
			if (sep === -1) return message.SyntaxError();
			const trigger = rest.slice(0, sep).trim().toLowerCase();
			const reply = rest.slice(sep + 2).trim();
			if (!trigger || !reply) return message.SyntaxError();
			const name = (await usersData.getName(event.senderID)) || 'Unknown';
			const existing = shortcuts.findIndex((s) => s.trigger === trigger);
			const entry = {
				trigger,
				reply,
				author: event.senderID,
				authorName: name,
				time: global.utils.getTime()
			};
			if (existing !== -1) shortcuts[existing] = entry;
			else shortcuts.push(entry);
			await globalData.set('shortcuts', shortcuts);
			return message.reply(`✅ Shortcut saved:\n\n🔑 Trigger: ${trigger}\n💬 Reply: ${reply}\n👤 By: ${name}`);
		}

		if (args[0] === 'del' || args[0] === 'delete' || args[0] === 'remove' || args[0] === 'rm') {
			const inputs = args.slice(1);
			if (!inputs.length)
				return message.reply('⚠️ Enter a trigger or number to delete (you can give several, separated by spaces).');
			if (!shortcuts.length) return message.reply('📭 No shortcuts saved yet.');
			const deleted = [];
			const notFound = [];
			const numeric = [];
			const textual = [];
			for (const input of inputs) {
				if (/^\d+$/.test(input)) numeric.push(parseInt(input, 10) - 1);
				else textual.push(input.toLowerCase());
			}
			// delete by index from the end so positions don't shift
			numeric.sort((a, b) => b - a).forEach((idx) => {
				if (idx >= 0 && idx < shortcuts.length) {
					deleted.push(`#${idx + 1} (${shortcuts[idx].trigger})`);
					shortcuts.splice(idx, 1);
				}
				else notFound.push(`#${idx + 1}`);
			});
			for (const key of textual) {
				const i = shortcuts.findIndex((s) => s.trigger === key);
				if (i !== -1) {
					deleted.push(key);
					shortcuts.splice(i, 1);
				}
				else notFound.push(key);
			}
			if (deleted.length) await globalData.set('shortcuts', shortcuts);
			let replyMsg = '';
			if (deleted.length) replyMsg += `🗑️ Deleted: ${deleted.join(', ')}.\n`;
			if (notFound.length) replyMsg += `⚠️ Not found: ${notFound.join(', ')}.`;
			return message.reply(replyMsg.trim());
		}

		if (args[0] === 'list' || args[0] === 'all') {
			if (!shortcuts.length) return message.reply('📭 No shortcuts saved yet.');
			let msg = '📌 Shortcuts:\n\n';
			shortcuts.forEach((sc, i) => {
				msg += `[${i + 1}] 🔑 ${sc.trigger}\n💬 ${sc.reply}\n👤 ${sc.authorName || '?'}\n⏰ ${sc.time || ''}\n\n`;
			});
			return message.reply(msg.trim());
		}

		return message.SyntaxError();
	},

	onChat: async function ({ event, message, usersData, globalData }) {
		const body = (event.body || '').trim().toLowerCase();
		if (!body) return false;
		const shortcuts = await loadAll(globalData);
		const found = shortcuts.find((s) => s.trigger === body);
		if (!found) return false;
		const senderName = await usersData.getName(event.senderID);
		await message.reply(found.reply.replace(/{name}/g, senderName));
		return true;
	}
};

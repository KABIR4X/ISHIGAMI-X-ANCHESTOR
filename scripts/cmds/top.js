'use strict';

const replyStore = require('../../bot/handler/replyStore');

// leaderboards. elite counted messages into dataserver.json / databox.json
// with an onChat hook — on ig the handler already keeps messageCount on
// users and threads, so top just reads the db. no onChat, no json files.
function fmt(value) {
	const n = Number(value) || 0;
	return n.toLocaleString('en-US');
}

function medal(i) {
	return ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
}

module.exports = {
	config: {
		name: 'top',
		version: '1.3.5',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'leaderboards — top by exp, money, messages or threads' },
		category: 'info',
		guide: { en: '   {pn} [exp]: top 10 by level / exp'
			+ '\n   {pn} money: top 10 richest (group or server, pick by reply)'
			+ '\n   {pn} msg: top 10 chattiest users'
			+ '\n   {pn} thread: top 10 busiest threads' }
	},

	onStart: async function ({ message, event, args, usersData, threadsData }) {
		const mode = (args[0] || 'exp').toLowerCase();
		const { senderID } = event;

		if (mode === 'money') {
			const info = await message.reply(
				'💰 Top money — pick a view:\n\n'
				+ '1. Top 10 richest in this group\n'
				+ '2. Top 10 richest on the server\n\n'
				+ '» Reply with the number'
			);
			if (info && info.messageID) {
				replyStore.setEntry(info.messageID, {
					commandName: 'top',
					author: senderID,
					threadID: event.threadID,
					data: { type: 'money' }
				});
			}
			return;
		}

		if (mode === 'msg' || mode === 'user') {
			const allUsers = await usersData.getAll();
			const sorted = [...allUsers]
				.filter((u) => (u.messageCount || 0) > 0)
				.sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0))
				.slice(0, 10);
			if (!sorted.length) return message.reply('No message data yet.');
			let msg = '🏆 Top 10 chattiest on the server:\n\n';
			for (let i = 0; i < sorted.length; i++) {
				const name = sorted[i].name || sorted[i].username || String(sorted[i].userID);
				msg += `${medal(i)} ${name}: ${fmt(sorted[i].messageCount)} messages\n`;
			}
			return message.reply(msg.trim());
		}

		if (mode === 'thread' || mode === 'box') {
			const allThreads = await threadsData.getAll();
			const sorted = [...allThreads]
				.filter((t) => (t.messageCount || 0) > 0)
				.sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0))
				.slice(0, 10);
			if (!sorted.length) return message.reply('No thread data yet.');
			let msg = '🏆 Top 10 busiest threads:\n\n';
			for (let i = 0; i < sorted.length; i++) {
				const name = sorted[i].threadName || sorted[i].name || `Thread ${sorted[i].threadID}`;
				msg += `${medal(i)} ${name}: ${fmt(sorted[i].messageCount)} messages\n`;
			}
			return message.reply(msg.trim());
		}

		if (mode === 'exp' || mode === 'level' || mode === 'rank') {
			const allUsers = await usersData.getAll();
			const sorted = [...allUsers]
				.sort((a, b) => (b.exp || 0) - (a.exp || 0))
				.slice(0, 10);
			if (!sorted.length) return message.reply('No exp data yet.');
			let msg = '🏆 Top 10 by level:\n\n';
			for (let i = 0; i < sorted.length; i++) {
				const u = sorted[i];
				const name = u.name || u.username || String(u.userID);
				msg += `${medal(i)} ${name} — Lv ${global.utils.expToLevel(u.exp || 0)} (${fmt(u.exp)} exp)\n`;
			}
			return message.reply(msg.trim());
		}

		return message.reply(
			'You can use:\n\n'
			+ '• top exp → top 10 by level\n'
			+ '• top money → top 10 richest (group or server)\n'
			+ '• top msg → top 10 chattiest users\n'
			+ '• top thread → top 10 busiest threads'
		);
	},

	onReply: async function ({ event, onReply, message, usersData, threadsData }) {
		const data = (onReply && onReply.data) || {};
		if (data.type !== 'money') return false;
		if (String(event.senderID) !== String(onReply.author)) return false;

		const choice = parseInt(String(event.body || '').trim(), 10);
		const allUsers = await usersData.getAll();

		if (choice === 1) {
			const threadInfo = await threadsData.get(event.threadID);
			const members = (threadInfo.participantIDs || event.participantIDs || []).map(String);
			const sorted = allUsers
				.filter((u) => members.includes(String(u.userID)) && (u.money || 0) > 0)
				.sort((a, b) => (b.money || 0) - (a.money || 0))
				.slice(0, 10);
			if (!sorted.length) {
				await message.reply('Nobody in this group has money yet.');
				return true;
			}
			let msg = '💰 Top 10 richest in this group:\n\n';
			for (let i = 0; i < sorted.length; i++) {
				const name = sorted[i].name || sorted[i].username || String(sorted[i].userID);
				msg += `${medal(i)} ${name}: ${fmt(sorted[i].money)}$\n`;
			}
			await message.reply(msg.trim());
			return true;
		}

		if (choice === 2) {
			const sorted = allUsers
				.filter((u) => (u.money || 0) > 0)
				.sort((a, b) => (b.money || 0) - (a.money || 0))
				.slice(0, 10);
			if (!sorted.length) {
				await message.reply('Nobody on the server has money yet.');
				return true;
			}
			let msg = '💰 Top 10 richest on the server:\n\n';
			for (let i = 0; i < sorted.length; i++) {
				const name = sorted[i].name || sorted[i].username || String(sorted[i].userID);
				msg += `${medal(i)} ${name}: ${fmt(sorted[i].money)}$\n`;
			}
			await message.reply(msg.trim());
			return true;
		}

		await message.reply('Invalid choice — reply 1 or 2.');
		return true;
	}
};

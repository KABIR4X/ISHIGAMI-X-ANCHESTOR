'use strict';

const { resolveTargets } = require('./_ig/targets');

// text rank card — elite drew a canvas image, ig has no canvas, so the card
// is text: level, exp progress bar, server rank, message count, money.
// the handler already adds +1 exp per message, so no onChat here.
function progressBar(current, total, width = 10) {
	if (!total || total <= 0) return '░'.repeat(width);
	const filled = Math.max(0, Math.min(width, Math.round((current / total) * width)));
	return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function fmt(value) {
	const n = Number(value) || 0;
	return n.toLocaleString('en-US');
}

module.exports = {
	config: {
		name: 'rank',
		version: '1.7',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'view your level, or the level of someone you reply to / mention' },
		category: 'info',
		guide: { en: '   {pn}: your rank card'
			+ '\n   {pn} @user: their rank card'
			+ '\n   reply to a message + {pn}: that sender\'s rank card' }
	},

	onStart: async function ({ message, event, args, api, usersData }) {
		const { expToLevel, levelToExp } = global.utils;
		const { targets } = await resolveTargets({ api, event, args });
		if (!targets.length) return message.reply('❎ Could not figure out whose rank to show.');

		const allUsers = await usersData.getAll();
		const sorted = [...allUsers].sort((a, b) => (b.exp || 0) - (a.exp || 0));

		const cards = [];
		for (const target of targets) {
			const data = await usersData.get(target.id);
			const exp = Number(data.exp) || 0;
			const level = expToLevel(exp);
			const expIntoLevel = exp - levelToExp(level);
			const expNextLevel = levelToExp(level + 1) - levelToExp(level);
			const rank = sorted.findIndex((u) => String(u.userID) === String(target.id)) + 1;
			const name = target.name || target.username || data.name || data.username || String(target.id);
			const pct = expNextLevel > 0 ? Math.floor((expIntoLevel / expNextLevel) * 100) : 100;

			cards.push(
				`🏆 RANK — ${name}`
				+ `\n⭐ Level: ${level}`
				+ `\n📊 Exp: ${fmt(expIntoLevel)}/${fmt(expNextLevel)} (${pct}%)`
				+ `\n[${progressBar(expIntoLevel, expNextLevel)}]`
				+ `\n🥇 Server rank: #${rank > 0 ? rank : '?'}/${sorted.length}`
				+ `\n💬 Messages: ${fmt(data.messageCount)}`
				+ `\n💰 Money: ${fmt(data.money)}$`
			);
		}
		return message.reply(cards.join('\n\n'));
	}
};

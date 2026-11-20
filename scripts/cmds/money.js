'use strict';

const { resolveTargets } = require('./_ig/targets');

function toBig(value) {
	try {
		if (typeof value === 'bigint') return value;
		if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
		return BigInt(Math.trunc(Number(value) || 0));
	}
	catch { return 0n; }
}

// same unit labels as elite: k is 10^12 here, not 10^3
function formatMoney(money) {
	try {
		const m = toBig(money);
		const units = [
			{ value: 36n, label: 'g' },
			{ value: 27n, label: 'gb' },
			{ value: 24n, label: 'mb' },
			{ value: 21n, label: 'kb' },
			{ value: 18n, label: 'b' },
			{ value: 15n, label: 'm' },
			{ value: 12n, label: 'k' }
		];
		const full = m.toLocaleString('en-US');
		for (const u of units) {
			if (m >= 10n ** u.value) return `${full}$ (${u.label})`;
		}
		return `${full}$`;
	}
	catch { return '0$'; }
}

module.exports = {
	config: {
		name: 'money',
		version: '1.0.0',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'check your balance, or the balance of someone you reply to / mention' },
		category: 'economy',
		guide: { en: '   {pn}: your balance'
			+ '\n   {pn} @user: their balance'
			+ '\n   reply to a message + {pn}: that sender\'s balance' }
	},

	onStart: async function ({ message, event, args, api, usersData }) {
		const { targets } = await resolveTargets({ api, event, args });
		const target = targets[0];
		if (!target) return message.reply('❎ Could not figure out whose balance to check.');

		try {
			const data = await usersData.get(target.id);
			const formatted = formatMoney(data ? data.money : 0);
			if (String(target.id) === String(event.senderID))
				return message.reply(`💰 Your balance: ${formatted}`);
			const name = target.name || target.username || (await usersData.getName(target.id));
			return message.reply(`💰 ${name}'s balance: ${formatted}`);
		}
		catch (e) {
			global.utils.log.error('money', e.stack || e.message);
			return message.reply('❎ Could not get the balance.');
		}
	}
};

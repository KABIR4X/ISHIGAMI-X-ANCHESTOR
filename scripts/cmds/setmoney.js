'use strict';

const { resolveTargets } = require('./_ig/targets');

// same unit scale as the rest of the economy: k = 10^12, m = 10^15,
// b = 10^18, kb = 10^21, mb = 10^24, gb = 10^27, g = 10^36
const UNITS = { k: 12n, m: 15n, b: 18n, kb: 21n, mb: 24n, gb: 27n, g: 36n };

function toBig(value) {
	try {
		if (typeof value === 'bigint') return value;
		if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
		return BigInt(Math.trunc(Number(value) || 0));
	}
	catch { return 0n; }
}

function parseMoney(input) {
	if (input == null) return null;
	const s = String(input).trim().toLowerCase();
	if (!isNaN(s) && s !== '') return BigInt(s);
	const match = s.match(/^(\d+)([a-z]+)?$/);
	if (!match) return null;
	let amount = BigInt(match[1]);
	const unit = (match[2] || '').toLowerCase();
	if (unit && UNITS[unit]) amount *= 10n ** UNITS[unit];
	else if (unit) return null;
	return amount;
}

function fmt(value) {
	return toBig(value).toLocaleString('en-US');
}

module.exports = {
	config: {
		name: 'setmoney',
		version: '1.0.1',
		author: 'xemonbae01',
		countDown: 5,
		role: 2,
		description: { en: 'bot admin: set, add or remove money for yourself or someone else' },
		category: 'admin',
		guide: { en: '   {pn} <amount> [@user]: set balance'
			+ '\n   {pn} add <amount> [@user]: add money'
			+ '\n   {pn} remove <amount> [@user]: remove money'
			+ '\n   reply works too; amounts take k / m / b units' }
	},

	onStart: async function ({ event, args, message, api, usersData }) {
		if (!args[0])
			return message.reply('⚡ Usage: `-setmoney <amount> [@user]`\n`-setmoney add <amount> [@user]`\n`-setmoney remove <amount> [@user]`');

		let mode = 'set';
		let amountArg = args[0];
		let targetArgs = args.slice(1);
		const first = String(args[0]).toLowerCase();
		if (first === 'add' || first === 'remove' || first === 'rm' || first === 'sub') {
			mode = first === 'add' ? 'add' : 'remove';
			amountArg = args[1];
			targetArgs = args.slice(2);
			if (!amountArg) return message.reply(`⚡ Usage: \`-setmoney ${mode} <amount> [@user]\``);
		}

		const amount = parseMoney(amountArg);
		if (amount === null || amount < 0n)
			return message.reply('⚡ Enter a valid amount!');

		const { targets } = await resolveTargets({ api, event, args: targetArgs });
		const target = targets[0];
		if (!target) return message.reply('❎ Could not figure out whose money to change.');

		const current = toBig((await usersData.get(target.id)).money);
		let next = amount;
		if (mode === 'add') next = current + amount;
		if (mode === 'remove') next = current - amount < 0n ? 0n : current - amount;

		const safe = next <= BigInt(Number.MAX_SAFE_INTEGER) && next >= BigInt(Number.MIN_SAFE_INTEGER);
		await usersData.set(target.id, { money: safe ? Number(next) : next.toString() });

		const name = target.name || target.username || (await usersData.getName(target.id));
		if (mode === 'set') return message.reply(`✅ Set ${name}'s money to: ${fmt(next)}$`);
		if (mode === 'add') return message.reply(`✅ Added ${fmt(amount)}$ to ${name}. New balance: ${fmt(next)}$`);
		return message.reply(`✅ Removed ${fmt(amount)}$ from ${name}. New balance: ${fmt(next)}$`);
	}
};

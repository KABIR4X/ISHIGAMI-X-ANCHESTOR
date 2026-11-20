'use strict';

const { resolveTargets } = require('./_ig/targets');

// elite's unit scale: k = 10^12, m = 10^15, b = 10^18, kb = 10^21,
// mb = 10^24, gb = 10^27, g = 10^36. same as bank/slot/setmoney.
const UNITS = { k: 12n, m: 15n, b: 18n, kb: 21n, mb: 24n, gb: 27n, g: 36n };
const FEE_PERCENT = 5n;
const MIN_SEND = 1000n;

function toBig(value) {
	try {
		if (typeof value === 'bigint') return value;
		if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
		return BigInt(Math.trunc(Number(value) || 0));
	}
	catch { return 0n; }
}

function parseCoins(val, balance = 0n) {
	if (val == null) return null;
	const s = String(val).trim().toLowerCase();
	if (s === 'all' || s === 'allin') return balance;
	const match = s.match(/^(\d+)([a-z]+)?$/);
	if (!match) return null;
	let amount = BigInt(match[1]);
	const unit = match[2] || '';
	if (unit) {
		if (!(unit in UNITS)) return null;
		amount *= 10n ** UNITS[unit];
	}
	return amount;
}

function fmt(value) {
	return toBig(value).toLocaleString('en-US');
}

async function getBalance(uid, usersData) {
	const d = await usersData.get(uid);
	return toBig(d ? d.money : 0);
}

// wallets are numbers in usersData; only spill to a string past safe int
async function setBalance(uid, amount, usersData) {
	const safe = amount <= BigInt(Number.MAX_SAFE_INTEGER) && amount >= BigInt(Number.MIN_SAFE_INTEGER);
	await usersData.set(uid, { money: safe ? Number(amount) : amount.toString() });
}

module.exports = {
	config: {
		name: 'pay',
		version: '1.0.4',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'send money to someone else (5% fee, min 1000$)' },
		category: 'economy',
		guide: { en: '   {pn} <amount> @user'
			+ '\n   {pn} @user <amount>'
			+ '\n   reply to a message + {pn} <amount>'
			+ '\n   amount can be a number, all, or 10k / 5m / 1b' }
	},

	onStart: async function ({ event, args, message, api, usersData }) {
		try {
			const { senderID } = event;
			const balance = await getBalance(senderID, usersData);

			// first arg that parses as an amount wins; the rest are targets
			let amountArg = null;
			let amountIdx = -1;
			for (let i = 0; i < args.length; i++) {
				const parsed = parseCoins(args[i], balance);
				if (parsed !== null && parsed > 0n) {
					amountArg = args[i];
					amountIdx = i;
					break;
				}
			}
			if (amountArg === null)
				return message.reply('❌ Enter a valid amount! e.g. `-pay 1000 @user` or `-pay all @user`');

			const targetArgs = args.filter((_, i) => i !== amountIdx);
			const { targets } = await resolveTargets({ api, event, args: targetArgs, includeSelf: false });
			const receiver = targets[0];
			if (!receiver)
				return message.reply('⚠️ Mention, reply to, or @username the person you want to pay!\nExample: `-pay 1000 @user` or `-pay @user 1000`');

			const coins = parseCoins(amountArg, balance);
			if (!coins || coins <= 0n) return message.reply('❌ Enter a valid amount!');
			if (coins < MIN_SEND) return message.reply('⚠️ Minimum transfer is 1000$');
			if (coins > balance) return message.reply('⚠️ That is more than your current balance!');
			if (String(receiver.id) === String(senderID)) return message.reply('❌ You cannot pay yourself!');

			const fee = (coins * FEE_PERCENT) / 100n;
			const net = coins - fee;
			const receiverName = receiver.name || receiver.username || (await usersData.getName(receiver.id));

			await setBalance(senderID, balance - coins, usersData);
			try {
				const receiverBalance = await getBalance(receiver.id, usersData);
				await setBalance(receiver.id, receiverBalance + net, usersData);
			}
			catch (e) {
				await setBalance(senderID, balance, usersData); // rollback
				throw e;
			}

			return message.reply(`✅ Sent ${fmt(net)}$ to ${receiverName}\n💸 Fee: ${FEE_PERCENT}% (${fmt(fee)}$)`);
		}
		catch (e) {
			global.utils.log.error('pay', e.stack || e.message);
			return message.reply('❌ Something went wrong while paying.');
		}
	}
};

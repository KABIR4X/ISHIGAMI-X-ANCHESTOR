'use strict';

const { resolveTargets } = require('./_ig/targets');

// goat bank — accounts live in globalData key `bank`, keyed by user id:
// { [userID]: { money: "0", history: [] } }. no json file, so git pulls
// never fight it.
const INTEREST_RATE = 0.00025; // 0.025% every 5 hours
const FIVE_HOURS = 5 * 60 * 60 * 1000;
const MIN_DEPOSIT = 100n;
const MIN_WITHDRAW = 10000n;

function isSunday() {
	return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', weekday: 'short' }).format(new Date()) === 'Sun';
}

function nowDhaka() {
	return new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
}

function toBig(value) {
	try {
		if (typeof value === 'bigint') return value;
		if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
		return BigInt(Math.trunc(Number(value) || 0));
	}
	catch { return 0n; }
}

function formatFullAmount(amount) {
	const units = [
		{ unit: 'g', value: 36n },
		{ unit: 'gb', value: 27n },
		{ unit: 'mb', value: 24n },
		{ unit: 'kb', value: 21n },
		{ unit: 'b', value: 18n },
		{ unit: 'm', value: 15n },
		{ unit: 'k', value: 12n }
	];
	const amt = toBig(amount);
	for (const u of units) {
		if (amt >= 10n ** u.value) return `${amt.toLocaleString('en-US')}$ (${u.unit})`;
	}
	return `${amt.toLocaleString('en-US')}$`;
}

function parseAmount(str) {
	const s = String(str).toLowerCase();
	const units = { k: 12n, m: 15n, b: 18n, kb: 21n, mb: 24n, gb: 27n, g: 36n };
	for (const u of Object.keys(units)) {
		if (s.endsWith(u)) {
			const num = s.slice(0, -u.length);
			if (num === '' || isNaN(num)) return null;
			return BigInt(num) * (10n ** units[u]);
		}
	}
	if (s !== '' && !isNaN(s)) return BigInt(s);
	return null;
}

function getTimeRemaining() {
	const elapsed = Date.now() - (global.bankLastInterest || Date.now());
	let remaining = FIVE_HOURS - elapsed;
	if (remaining < 0) remaining = 0;
	const hours = Math.floor(remaining / (60 * 60 * 1000));
	const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
	const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
	return `${hours}h ${minutes}m ${seconds}s`;
}

async function loadBank(globalData) {
	const bank = await globalData.get('bank');
	return bank && typeof bank === 'object' ? bank : {};
}

const MENU = '🏦 GOAT BANK MENU 🏦'
	+ '\n-bank register -> Register an account'
	+ '\n-bank check -> Check balance + interest'
	+ '\n-bank send <amount> -> Deposit money'
	+ '\n-bank withdraw <amount> -> Withdraw money'
	+ '\n-bank history -> Transaction history'
	+ '\n\n💵 Minimum deposit: 100$, Minimum withdrawal: 10,000$'
	+ '\n💸 Transaction fee: 1.5%'
	+ '\n💹 Interest rate: 0.025% every 5 hours'
	+ '\n⛔ Sunday: Bank is closed';

module.exports = {
	config: {
		name: 'bank',
		version: '1.0.1',
		author: 'xemonbae01',
		countDown: 0,
		role: 0,
		description: { en: 'goat bank — deposit / withdraw money with automatic interest' },
		category: 'economy',
		guide: { en: MENU }
	},

	onLoad: async function ({ globalData }) {
		const gd = globalData || (global.db && global.db.globalData);
		if (!gd) return;
		if (!global.bankLastInterest) global.bankLastInterest = Date.now();
		// one timer for the whole process — a `cmd reload bank` must not
		// stack another interest interval on top of the old one
		if (global.__bankInterestTimer) return;
		global.__bankInterestTimer = setInterval(async () => {
			try {
				if (isSunday()) {
					global.utils.log.info('BANK', 'Sunday - bank is closed, no interest added.');
					return;
				}
				const bank = await loadBank(gd);
				let updated = false;
				for (const user of Object.values(bank)) {
					const balance = toBig(user.money);
					if (balance > 0n) {
						const interest = BigInt(Math.floor(Number(balance) * INTEREST_RATE));
						if (interest > 0n) {
							user.money = String(balance + interest);
							if (!user.history) user.history = [];
							user.history.unshift({ type: 'Interest 0.025%', amount: `+${formatFullAmount(interest)}`, time: nowDhaka() });
							if (user.history.length > 20) user.history.pop();
							updated = true;
						}
					}
				}
				if (updated) {
					await gd.set('bank', bank);
					global.bankLastInterest = Date.now();
					global.utils.log.info('BANK', `Interest added at ${nowDhaka()}`);
				}
			}
			catch (err) {
				global.utils.log.error('BANK', `Error adding interest: ${err.message}`);
			}
		}, FIVE_HOURS);
		if (global.__bankInterestTimer.unref) global.__bankInterestTimer.unref();
	},

	onStart: async function ({ args, message, event, api, usersData, globalData }) {
		const senderID = String(event.senderID);
		const bank = await loadBank(globalData);
		let findUser = bank[senderID];
		const saveData = () => globalData.set('bank', bank);

		const logTransaction = async (type, amount) => {
			if (!findUser.history) findUser.history = [];
			findUser.history.unshift({ type, amount: formatFullAmount(amount), time: nowDhaka() });
			if (findUser.history.length > 20) findUser.history.pop();
			await saveData();
		};

		try {
			const command = (args[0] || '').toLowerCase();

			if (isSunday() && command !== 'check' && command !== 'history' && command !== '')
				return message.reply('🚫 Bank is closed on Sunday. Please try again later.');

			if (command === 'register') {
				if (!findUser) {
					bank[senderID] = { money: '0', history: [] };
					await saveData();
					return message.reply('[✅] Registration successful');
				}
				return message.reply('[⚠️] You already have an account!');
			}

			if (command === 'check') {
				if (isSunday())
					return message.reply('🚫 Today is Sunday, bank is closed. Please try later.');

				const { targets } = await resolveTargets({ api, event, args: args.slice(1) });
				const target = targets[0] || { id: senderID };
				const targetUser = bank[String(target.id)];
				const targetName = target.name || target.username || (await usersData.getName(target.id));
				if (!targetUser)
					return message.reply(`[⚠️] ${targetName} does not have an account.`);

				return message.reply(
					`[✅ SUCCESS] » Account of ${targetName} in GoatBank:\n`
					+ `💰 Balance: ${formatFullAmount(targetUser.money)}\n`
					+ '♻️ Interest: 0.025% every 5 hours\n'
					+ `⏳ Next interest: ${getTimeRemaining()}\n`
					+ '📌 Account status: Good'
				);
			}

			if (command === 'send') {
				if (!findUser) return message.reply('[⚠️] You don\'t have an account');
				if (!args[1]) return message.reply('[⚠️] Enter an amount');
				const wallet = toBig((await usersData.get(senderID)).money);
				const rawAmount = args[1].toLowerCase() !== 'all' ? parseAmount(args[1]) : wallet;
				if (rawAmount === null) return message.reply('[⚠️] Invalid amount!');
				if (rawAmount < MIN_DEPOSIT) return message.reply('[⚠️] Minimum deposit: 100$');
				if (rawAmount > wallet) {
					const missing = rawAmount - wallet;
					return message.reply(`[❌ FAILED] » Not enough money to deposit, missing ${formatFullAmount(missing)}`);
				}
				const fee = rawAmount * 15n / 1000n;
				const amountAfterFee = rawAmount - fee;
				findUser.money = String(toBig(findUser.money) + amountAfterFee);
				await usersData.set(senderID, { money: Number(wallet - rawAmount) });
				await logTransaction('Deposit (1.5% fee)', amountAfterFee);
				return message.reply(`[✅] Deposited ${formatFullAmount(amountAfterFee)} (fee: ${formatFullAmount(fee)})`);
			}

			if (command === 'withdraw') {
				if (!findUser) return message.reply('[⚠️] You don\'t have an account');
				if (!args[1]) return message.reply('[⚠️] Enter an amount');
				const rawAmount = args[1].toLowerCase() !== 'all' ? parseAmount(args[1]) : toBig(findUser.money);
				if (rawAmount === null) return message.reply('[⚠️] Invalid amount!');
				if (rawAmount < MIN_WITHDRAW) return message.reply('[⚠️] Minimum withdrawal: 10,000$');
				if (rawAmount > toBig(findUser.money)) return message.reply('[⚠️] Not enough balance');
				const fee = rawAmount * 15n / 1000n;
				const amountAfterFee = rawAmount - fee;
				findUser.money = String(toBig(findUser.money) - rawAmount);
				const wallet = toBig((await usersData.get(senderID)).money);
				await usersData.set(senderID, { money: Number(wallet + amountAfterFee) });
				await logTransaction('Withdraw (1.5% fee)', amountAfterFee);
				return message.reply(`[✅] Withdrawn ${formatFullAmount(amountAfterFee)} (fee: ${formatFullAmount(fee)})`);
			}

			if (command === 'history') {
				if (!findUser) return message.reply('[⚠️] You don\'t have an account');
				const history = findUser.history || [];
				if (history.length === 0) return message.reply('📜 No transactions yet.');
				let msg = '📜 [LAST 5 TRANSACTIONS]\n\n';
				history.slice(0, 5).forEach((item, index) => {
					msg += `${index + 1}. [${item.type}] - ${item.amount} at ${item.time}\n`;
				});
				return message.reply(msg.trim());
			}

			return message.reply(MENU);
		}
		catch (e) {
			global.utils.log.error('bank', e.stack || e.message);
			return message.reply('❌ An error occurred.');
		}
	}
};

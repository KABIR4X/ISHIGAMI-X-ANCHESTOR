'use strict';

// slot machine with a server-wide jackpot. the jackpot lives in globalData
// key `slotJackpot` ({ money, lastWinner, lastTime }) instead of elite's
// cache/jackpot.json, so git pulls never fight it.
const FEE_RATE = 3n; // % fee on wins, goes into the jackpot
const JACKPOT_RATE = 5n; // % of every bet that feeds the jackpot

function toBig(value) {
	try {
		if (typeof value === 'bigint') return value;
		if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
		return BigInt(Math.trunc(Number(value) || 0));
	}
	catch { return 0n; }
}

function fmt(value) {
	return toBig(value).toLocaleString('en-US');
}

// same unit scale as the rest of the economy: k = 10^12 ...
function parseBetAmount(input, moneyUser) {
	if (!input) return null;
	const s = String(input).toLowerCase();
	if (s === 'all' || s === 'allin') return moneyUser;
	const multipliers = {
		k: 10n ** 12n,
		m: 10n ** 15n,
		b: 10n ** 18n,
		kb: 10n ** 21n,
		mb: 10n ** 24n,
		gb: 10n ** 27n,
		g: 10n ** 36n
	};
	if (!isNaN(s) && s !== '') return BigInt(s);
	const match = s.match(/^(\d+)([a-z]+)?$/i);
	if (!match) return null;
	let amount = BigInt(match[1]);
	const unit = (match[2] || '').toLowerCase();
	if (unit && multipliers[unit]) amount *= multipliers[unit];
	else if (unit) return null;
	return amount;
}

async function getJackpotData(globalData) {
	const data = await globalData.get('slotJackpot');
	return data && typeof data === 'object'
		? { money: data.money || '0', lastWinner: data.lastWinner || null, lastTime: data.lastTime || null }
		: { money: '0', lastWinner: null, lastTime: null };
}

async function saveJackpot(globalData, data) {
	await globalData.set('slotJackpot', data);
}

async function addJackpot(globalData, amount) {
	const data = await getJackpotData(globalData);
	data.money = (toBig(data.money) + toBig(amount)).toString();
	await saveJackpot(globalData, data);
}

async function safeDecreaseMoney(usersData, uid, amount) {
	const data = await usersData.get(uid);
	const current = toBig(data.money);
	let next = current - toBig(amount);
	if (next < 0n) next = 0n;
	await usersData.set(uid, { money: Number(next) });
}

async function safeIncreaseMoney(usersData, uid, amount) {
	const data = await usersData.get(uid);
	const current = toBig(data.money);
	await usersData.set(uid, { money: Number(current + toBig(amount)) });
}

module.exports = {
	config: {
		name: 'slot',
		version: '3.0.1',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: '3x3 slot machine with a server-wide jackpot' },
		category: 'game',
		guide: { en: '   {pn} <amount | all>: spin the slot'
			+ '\n   {pn} jackpot: view the server jackpot'
			+ '\n   3 matching = big win + jackpot cut, 2 matching = 1.5x' }
	},

	onStart: async function ({ message, event, args, usersData, globalData }) {
		const { senderID } = event;

		if (args[0] && args[0].toLowerCase() === 'jackpot') {
			const data = await getJackpotData(globalData);
			let msg = `💰 Server jackpot: ${fmt(data.money)}$`;
			if (data.lastWinner) msg += `\n👑 Last jackpot winner: ${data.lastWinner}`;
			if (data.lastTime) msg += `\n🕒 Time: ${data.lastTime}`;
			return message.reply(msg);
		}

		const moneyUser = toBig((await usersData.get(senderID)).money);
		const betAmount = parseBetAmount(args[0], moneyUser);
		if (!betAmount || betAmount <= 0n)
			return message.reply('[ SLOT ] Enter a valid bet amount!');
		if (betAmount > moneyUser)
			return message.reply('[ SLOT ] You do not have enough money to bet!');

		// random 3x3 grid, middle row is the result
		const slots = ['🍏', '🍇', '🍌', '🍒', '🍓', '🍉'];
		const matrix = [];
		for (let i = 0; i < 3; i++) {
			const row = [];
			for (let j = 0; j < 3; j++) row.push(slots[Math.floor(Math.random() * slots.length)]);
			matrix.push(row);
		}
		const resultArr = matrix[1];

		// 0.3% chance the middle row auto-matches
		if (Math.random() < 0.003) {
			resultArr[1] = resultArr[0];
			resultArr[2] = resultArr[0];
		}

		let msg = '🎰\n';
		for (const row of matrix) msg += row.join(' | ') + '\n';
		msg += '\n';

		if (resultArr[0] === resultArr[1] && resultArr[1] === resultArr[2]) {
			// 3 matching
			const rawWin = betAmount * 2n;
			await safeDecreaseMoney(usersData, senderID, betAmount);

			const jackpotNow = toBig((await getJackpotData(globalData)).money);
			let jpAward = betAmount * 5n;
			if (jpAward >= jackpotNow) jpAward = jackpotNow;

			const totalBeforeFee = rawWin + jpAward;
			const fee = totalBeforeFee * FEE_RATE / 100n;
			const finalWin = totalBeforeFee - fee;
			await safeIncreaseMoney(usersData, senderID, finalWin);

			// fee lands in the jackpot, jackpot cut goes out — one write so
			// the fee cannot get clobbered like elite's two-step version did
			const data = await getJackpotData(globalData);
			data.money = (jackpotNow - jpAward + fee).toString();
			if (jpAward > 0n) {
				data.lastWinner = (await usersData.get(senderID)).name || 'Mystery player';
				data.lastTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
			}
			await saveJackpot(globalData, data);

			msg += `🎉 3 matching! You won ${fmt(rawWin)}$ + jackpot cut ${fmt(jpAward)}$\n`;
			msg += `💸 Fee ${FEE_RATE}% (into the jackpot): -${fmt(fee)}$\n`;
			msg += `💥 You actually get: +${fmt(finalWin)}$\n`;
			msg += `💰 Jackpot left: ${fmt(data.money)}$\n`;
		}
		else if (resultArr[0] === resultArr[1] || resultArr[1] === resultArr[2] || resultArr[0] === resultArr[2]) {
			// 2 matching — 1.5x
			const rawWin = betAmount * 15n / 10n;
			const fee = rawWin * FEE_RATE / 100n;
			const finalWin = rawWin - fee;
			await safeDecreaseMoney(usersData, senderID, betAmount);
			await safeIncreaseMoney(usersData, senderID, finalWin);
			await addJackpot(globalData, fee);
			await addJackpot(globalData, betAmount * JACKPOT_RATE / 100n);

			msg += `✨ 2 matching! You won ${fmt(rawWin)}$ (fee ${FEE_RATE}%: -${fmt(fee)}$)\n`;
			msg += `💥 You actually get: +${fmt(finalWin)}$\n`;
			msg += `💰 Jackpot now: ${fmt((await getJackpotData(globalData)).money)}$\n`;
		}
		else {
			// lost — 5% of the bet feeds the jackpot
			await safeDecreaseMoney(usersData, senderID, betAmount);
			await addJackpot(globalData, betAmount * JACKPOT_RATE / 100n);
			msg += `😢 You LOST -${fmt(betAmount)}$ (5% went into the jackpot)\n`;
			msg += `💰 Jackpot now: ${fmt((await getJackpotData(globalData)).money)}$\n`;
		}

		const balance = toBig((await usersData.get(senderID)).money);
		msg += `\n💵 Current balance: ${fmt(balance)}$`;
		return message.reply(msg);
	}
};

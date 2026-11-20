'use strict';

// single-player tai xiu — pick big/small/triple3/double2/total/number,
// roll 3 dice, 5% fee on wins, 3 minute cooldown between plays.
// (elite's parseBet multiplies by every matching unit in order, so `1kb`
// picks up k, b AND kb — kept as-is for parity.)
function formatNumber(int) {
	return String(int).replace(/(.)(?=(\d{3})+$)/g, '$1,');
}

function parseBet(input, money) {
	if (!input) return NaN;
	const s = String(input).toLowerCase();
	if (s === 'all') return money;
	let number = parseInt(s, 10);
	if (isNaN(number)) number = 0;
	if (s.includes('k')) number *= 10 ** 3;
	if (s.includes('m')) number *= 10 ** 6;
	if (s.includes('b')) number *= 10 ** 9;
	if (s.includes('kb')) number *= 10 ** 12;
	if (s.includes('mb')) number *= 10 ** 15;
	if (s.includes('gb')) number *= 10 ** 18;
	if (s.includes('g')) number *= 10 ** 21;
	return number;
}

function getRate(total) {
	if (total === 4) return 40;
	if (total === 5) return 35;
	if (total === 6) return 33.33;
	if (total === 7) return 25;
	if (total === 8) return 20;
	if (total === 9) return 16.66;
	if (total === 10) return 14.28;
	if (total === 11) return 12.5;
	if (total === 12) return 11.11;
	if (total === 13) return 10;
	if (total === 14) return 9.09;
	if (total === 15) return 8.33;
	if (total === 16) return 7.69;
	if (total === 17) return 7.14;
	return 0;
}

const rateWin = 2;
const rateTriple3 = 10;
const rateDouble2 = 5;
const rateSingle = 1;
const rateDouble = 2;
const rateTriple = 3;

const cooldown = {};
const CD_TIME = 3 * 60 * 1000;

module.exports = {
	config: {
		name: 'tx',
		aliases: ['taixiu'],
		version: '7.2.0',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'single-player dice game (3 min cooldown, 5% win fee)' },
		category: 'game',
		guide: { en: '   {pn} big|small <bet>'
			+ '\n   {pn} triple3 <bet> (all 3 dice the same, 10x)'
			+ '\n   {pn} double2 <bet> (any pair, 5x)'
			+ '\n   {pn} total <bet> <4-17> (exact total, up to 40x)'
			+ '\n   {pn} number <bet> <1-6> (how many dice show it)'
			+ '\n   bet can be a number or all' }
	},

	onStart: async function ({ message, args, usersData, event }) {
		try {
			const { senderID } = event;
			const userData = await usersData.get(senderID);
			const money = userData.money || 0;
			const name = userData.name || userData.username || 'Player';

			const now = Date.now();
			if (cooldown[senderID] && now - cooldown[senderID] < CD_TIME) {
				const timeLeft = Math.ceil((CD_TIME - (now - cooldown[senderID])) / 1000);
				const minutes = Math.floor(timeLeft / 60);
				const seconds = timeLeft % 60;
				return message.reply(`⏳ You need to wait ${minutes} minutes ${seconds} seconds before playing again!`);
			}

			const input = (args[0] || '').toLowerCase();
			if (!args[1]) return message.reply('❗ You did not enter a bet amount!');
			const bet = args[1].toLowerCase() === 'all' ? money : parseBet(args[1], money);
			const totalBet = parseInt(args[2], 10);

			if (!input) return message.reply('[ ❗ ] You did not enter big/small/triple3/double2/total/number');
			if (!bet || bet <= 0) return message.reply('❌ Invalid bet amount!');
			if (bet < 100) return message.reply('💸 Minimum bet is 100$');
			if (bet > money) return message.reply('💸 You do not have enough money to bet!');

			let choose;
			if (['big', 'tai', '-t'].includes(input)) choose = 'big';
			if (['small', 'xiu', '-x'].includes(input)) choose = 'small';
			if (input === 'triple3') choose = 'triple3';
			if (input === 'double2') choose = 'double2';
			if (['total', 'ct'].includes(input)) choose = 'total';
			if (['number', 'cs'].includes(input)) choose = 'number';

			const validChoices = ['big', 'small', 'triple3', 'double2', 'total', 'number'];
			if (!validChoices.includes(choose)) return message.reply('[ ❗ ] Invalid choice, enter big/small/triple3/double2/total/number');
			if (choose === 'total' && (totalBet < 4 || totalBet > 17)) return message.reply('💸 Invalid total bet');
			if (choose === 'number' && (totalBet < 1 || totalBet > 6)) return message.reply('❗ Invalid number chosen');

			const dice = [];
			for (let i = 0; i < 3; i++) dice.push(Math.floor(Math.random() * 6 + 1));
			const total = dice[0] + dice[1] + dice[2];

			let ans;
			let result;
			let winMoney;

			if (choose === 'number') {
				const count = dice.filter((x) => x === totalBet).length;
				ans = `${totalBet}`;
				if (count === 1) { result = 'win'; winMoney = bet * rateSingle; }
				else if (count === 2) { result = 'win'; winMoney = bet * rateDouble; }
				else if (count === 3) { result = 'win'; winMoney = bet * rateTriple; }
				else { result = 'lose'; winMoney = 0; }
			}

			if (choose === 'total') {
				if (total === totalBet) { ans = 'total bet'; result = 'win'; winMoney = bet * getRate(totalBet); }
				else { ans = `${total}`; result = 'lose'; winMoney = 0; }
			}

			if (choose === 'triple3') {
				if (dice[0] === dice[1] && dice[1] === dice[2]) { ans = 'triple identical'; result = 'win'; winMoney = bet * rateTriple3; }
				else { ans = total >= 11 ? 'big' : 'small'; result = 'lose'; winMoney = 0; }
			}

			if (choose === 'double2') {
				if (dice[0] === dice[1] || dice[1] === dice[2] || dice[0] === dice[2]) { ans = 'double identical'; result = 'win'; winMoney = bet * rateDouble2; }
				else { ans = total >= 11 ? 'big' : 'small'; result = 'lose'; winMoney = 0; }
			}

			if (['big', 'small'].includes(choose)) {
				if (dice[0] === dice[1] && dice[1] === dice[2]) { ans = 'triple identical'; result = 'lose'; winMoney = 0; }
				else {
					ans = total >= 11 ? 'big' : 'small';
					if (ans === choose) { result = 'win'; winMoney = bet * rateWin; }
					else { result = 'lose'; winMoney = 0; }
				}
			}

			let fee = 0;
			if (result === 'lose') await usersData.set(senderID, { money: money - bet });
			else if (result === 'win') {
				fee = Math.floor(winMoney * 0.05);
				await usersData.set(senderID, { money: money + winMoney - fee });
			}

			cooldown[senderID] = Date.now();

			const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
			const msg = '🎲 RESULT 🎲\n'
				+ `◈🧸 Player: ${name}\n`
				+ `◈🎲 Choice: ${choose}\n`
				+ `◈💰 Bet: ${formatNumber(bet)}\n`
				+ `➾🎲 Dice: ${dice.map((d) => diceFaces[d - 1]).join(' ')}\n`
				+ `➾🎲 Dice rolled: ${ans}\n`
				+ `➾🔎 Total Points: ${total}\n`
				+ `➾🤑 Result: ${result === 'win' ? 'Win' : 'Lose'}\n`
				+ (result === 'win'
					? `➾📌 Money: + ${formatNumber(Math.floor(winMoney - fee))}$ (after fee)\n💸 Win fee (5%): ${formatNumber(fee)}$`
					: `➾📌 Money: - ${formatNumber(bet)}$ (lost)`)
				+ '\n⏳ You need to wait 3 minutes to play again.';
			return message.reply(msg);
		}
		catch (e) {
			global.utils.log.error('tx', e.stack || e.message);
			return message.reply('❌ An error occurred!');
		}
	}
};

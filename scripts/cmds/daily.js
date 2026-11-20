'use strict';

// daily gift — elite scaled the reward by weekday (monday base, +20% a day
// up to sunday). cooldown here is a rolling 24h in usersData data.daily,
// not elite's calendar-day string, so the time is honest no matter the tz.
const REWARD = { coin: 100, exp: 10 };
const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function dhakaDay() {
	// 0 = sunday .. 6 = saturday, in asia/dhaka
	const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', weekday: 'long' }).format(new Date());
	return DAY_NAMES.indexOf(weekday.toLowerCase());
}

function rewardFor(dayIndex) {
	// monday = 1 .. sunday = 7, same curve as elite
	const day = dayIndex === 0 ? 7 : dayIndex;
	const mult = (1 + 20 / 100) ** (day - 1);
	return {
		coin: Math.floor(REWARD.coin * mult),
		exp: Math.floor(REWARD.exp * mult)
	};
}

function fmtLeft(ms) {
	const h = Math.floor(ms / (60 * 60 * 1000));
	const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
	const s = Math.floor((ms % (60 * 1000)) / 1000);
	return `${h}h ${m}m ${s}s`;
}

module.exports = {
	config: {
		name: 'daily',
		version: '1.2',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'receive your daily gift (24h cooldown)' },
		category: 'game',
		guide: { en: '   {pn}: claim your daily gift'
			+ '\n   {pn} info: view the daily gift table' }
	},

	langs: {
		en: {
			monday: 'Monday',
			tuesday: 'Tuesday',
			wednesday: 'Wednesday',
			thursday: 'Thursday',
			friday: 'Friday',
			saturday: 'Saturday',
			sunday: 'Sunday',
			alreadyReceived: 'You have already received the gift — come back in %1',
			received: 'You have received %1 coin and %2 exp'
		}
	},

	onStart: async function ({ args, message, event, usersData, getLang }) {
		if (args[0] && args[0].toLowerCase() === 'info') {
			let msg = '🎁 Daily gift table:\n';
			for (let i = 1; i <= 7; i++) {
				const r = rewardFor(i === 7 ? 0 : i);
				const day = i === 7 ? getLang('sunday')
					: i === 6 ? getLang('saturday')
						: i === 5 ? getLang('friday')
							: i === 4 ? getLang('thursday')
								: i === 3 ? getLang('wednesday')
									: i === 2 ? getLang('tuesday')
										: getLang('monday');
				msg += `${day}: ${r.coin} coin, ${r.exp} exp\n`;
			}
			return message.reply(msg.trim());
		}

		const { senderID } = event;
		const userData = await usersData.get(senderID);
		const last = userData.data && userData.data.daily ? Number(userData.data.daily) : 0;
		const left = DAY_MS - (Date.now() - last);
		if (last && left > 0)
			return message.reply(getLang('alreadyReceived', fmtLeft(left)));

		const { coin, exp } = rewardFor(dhakaDay());
		const data = { ...(userData.data || {}), daily: Date.now() };
		await usersData.set(senderID, {
			money: (userData.money || 0) + coin,
			exp: (userData.exp || 0) + exp,
			data
		});
		return message.reply(getLang('received', coin, exp));
	}
};

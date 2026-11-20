'use strict';

// user admin tools: find users by name, ban/unban someone from using the
// bot entirely (the handler blocks banned users everywhere).
const { resolveTargets } = require('./_ig/targets');

module.exports = {
	config: {
		name: 'user',
		version: '1.4',
		author: 'xemonbae01',
		countDown: 5,
		role: 2,
		description: { en: 'Manage users in bot system' },
		category: 'admin',
		guide: { en: '   {pn} [find | -f | search | -s] <name to find>: search for users in bot data by name'
			+ '\n'
			+ '\n   {pn} [ban | -b] [<uid> | @tag | reply message] <reason>: to ban user with id <uid> or tagged user or sender of message replied using bot'
			+ '\n'
			+ '\n   {pn} unban [<uid> | @tag | reply message]: to unban user using bot' }
	},

	langs: {
		en: {
			noUserFound: '❌ No user found with name matching keyword: "%1" in bot data',
			userFound: '🔎 Found %1 user with name matching keyword "%2" in bot data:\n%3',
			uidRequired: 'Uid of user to ban cannot be empty, please enter uid or tag or reply message of 1 user by user ban <uid> <reason>',
			reasonRequired: 'Reason to ban user cannot be empty, please enter uid or tag or reply message of 1 user by user ban <uid> <reason>',
			userHasBanned: 'User with id [%1 | %2] has been banned before:\n» Reason: %3\n» Date: %4',
			userBanned: 'User with id [%1 | %2] has been banned:\n» Reason: %3\n» Date: %4',
			uidRequiredUnban: 'Uid of user to unban cannot be empty',
			userNotBanned: 'User with id [%1 | %2] is not banned',
			userUnbanned: 'User with id [%1 | %2] has been unbanned'
		}
	},

	onStart: async function ({ args, api, usersData, message, event, getLang }) {
		const type = args[0];
		switch (type) {
			case 'find':
			case '-f':
			case 'search':
			case '-s': {
				const allUser = await usersData.getAll();
				const list = Array.isArray(allUser) ? allUser : Object.values(allUser || {});
				const keyWord = args.slice(1).join(' ').toLowerCase();
				const result = list.filter((item) =>
					(item.name || '').toLowerCase().includes(keyWord)
					|| (item.username || '').toLowerCase().includes(keyWord));
				const msg = result.reduce((i, user) => i += `\n╭Name: ${user.name || user.username || '?'}\n╰ID: ${user.userID}`, '');
				return message.reply(result.length === 0
					? getLang('noUserFound', keyWord)
					: getLang('userFound', result.length, keyWord, msg));
			}
			case 'ban':
			case '-b': {
				const { targets } = await resolveTargets({ api, event, args: args.slice(1), includeSelf: false });
				const target = targets[0];
				if (!target) return message.reply(getLang('uidRequired'));
				const uid = String(target.id);
				const reason = args.slice(1).filter((a) => {
					const s = String(a);
					if (s === uid || s === `@${target.username}` || s === target.username) return false;
					if (/instagram\.com\//i.test(s)) return false;
					return true;
				}).join(' ').replace(/\s+/g, ' ').trim();
				if (!reason) return message.reply(getLang('reasonRequired'));
				const userData = await usersData.get(uid);
				const name = userData.name || userData.username || target.name || target.username;
				if (userData.banned && userData.banned.status)
					return message.reply(getLang('userHasBanned', uid, name, userData.banned.reason, userData.banned.date));
				const time = global.utils.getTime();
				await usersData.set(uid, { status: true, reason, date: time }, 'banned');
				return message.reply(getLang('userBanned', uid, name, reason, time));
			}
			case 'unban':
			case '-u': {
				const { targets } = await resolveTargets({ api, event, args: args.slice(1), includeSelf: false });
				const target = targets[0];
				if (!target) return message.reply(getLang('uidRequiredUnban'));
				const uid = String(target.id);
				const userData = await usersData.get(uid);
				const name = userData.name || userData.username || target.name || target.username;
				if (!(userData.banned && userData.banned.status))
					return message.reply(getLang('userNotBanned', uid, name));
				await usersData.set(uid, { status: false, reason: null, date: null }, 'banned');
				return message.reply(getLang('userUnbanned', uid, name));
			}
			default:
				return message.SyntaxError();
		}
	}
};

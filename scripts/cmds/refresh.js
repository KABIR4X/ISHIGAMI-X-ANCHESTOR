'use strict';

// refreshes the bot's stored info for a thread or a user from instagram.
// thread info comes through the login thread cache, so a refresh right
// after a change can still show the old values until the next thread
// update clears that cache; user info is always fetched fresh.
const { resolveTargets } = require('./_ig/targets');

module.exports = {
	config: {
		name: 'refresh',
		version: '1.2',
		author: 'xemonbae01',
		countDown: 60,
		role: 0,
		description: { en: 'refresh information of group chat or user' },
		category: 'info',
		guide: { en: '   {pn} [thread | group]: refresh information of your group chat'
			+ '\n   {pn} group <threadID>: refresh information of group chat by ID'
			+ '\n\n   {pn} user: refresh information of your user'
			+ '\n   {pn} user [<userID> | @tag]: refresh information of user by ID' }
	},

	langs: {
		en: {
			refreshMyThreadSuccess: '✅ | Refresh information of your group chat successfully!',
			refreshThreadTargetSuccess: '✅ | Refresh information of group chat %1 successfully!',
			errorRefreshMyThread: '❌ | Error when refresh information of your group chat',
			errorRefreshThreadTarget: '❌ | Error when refresh information of group chat %1',
			refreshMyUserSuccess: '✅ | Refresh information of your user successfully!',
			refreshUserTargetSuccess: '✅ | Refresh information of user %1 successfully!',
			errorRefreshMyUser: '❌ | Error when refresh information of your user',
			errorRefreshUserTarget: '❌ | Error when refresh information of user %1'
		}
	},

	onStart: async function ({ args, api, threadsData, usersData, message, event, getLang }) {
		if (args[0] === 'group' || args[0] === 'thread') {
			const targetID = args[1] || event.threadID;
			try {
				const info = await api.getThreadInfo(targetID);
				if (!info || !info.threadID) throw new Error('no thread info returned');
				const patch = {};
				if (info.threadName !== undefined) patch.threadName = info.threadName;
				if (info.isGroup !== undefined) patch.isGroup = info.isGroup;
				if (Array.isArray(info.participantIDs)) {
					patch.participantIDs = info.participantIDs.map(String);
					patch.memberCount = info.participantIDs.length;
				}
				if (Array.isArray(info.adminIDs)) patch.adminIDs = info.adminIDs.map(String);
				await threadsData.set(targetID, patch);
				return message.reply(String(targetID) === String(event.threadID)
					? getLang('refreshMyThreadSuccess')
					: getLang('refreshThreadTargetSuccess', targetID));
			}
			catch {
				return message.reply(String(targetID) === String(event.threadID)
					? getLang('errorRefreshMyThread')
					: getLang('errorRefreshThreadTarget', targetID));
			}
		}
		else if (args[0] === 'user') {
			const { targets } = await resolveTargets({ api, event, args: args.slice(1), includeSelf: true });
			const target = targets[0];
			const targetID = target ? String(target.id) : String(event.senderID);
			try {
				const info = await api.getUserInfo(targetID);
				const user = info && info[Object.keys(info)[0]];
				if (!user) throw new Error('no user info returned');
				const patch = {};
				if (user.name || user.fullName) patch.name = user.name || user.fullName;
				if (user.username) patch.username = user.username;
				await usersData.set(targetID, patch);
				return message.reply(targetID === String(event.senderID)
					? getLang('refreshMyUserSuccess')
					: getLang('refreshUserTargetSuccess', targetID));
			}
			catch {
				return message.reply(targetID === String(event.senderID)
					? getLang('errorRefreshMyUser')
					: getLang('errorRefreshUserTarget', targetID));
			}
		}
		else {
			return message.SyntaxError();
		}
	}
};

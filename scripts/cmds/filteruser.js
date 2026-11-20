'use strict';

// prune quiet members: kicks everyone in the thread with fewer than N
// messages on record (bot + group admins are never touched). needs a
// reaction confirm first, because this is not undoable.
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
	config: {
		name: 'filteruser',
		version: '1.6',
		author: 'xemonbae01',
		countDown: 5,
		role: 1,
		description: { en: 'filter group members by number of messages' },
		category: 'group',
		guide: { en: '   {pn} [<number of messages>]' }
	},

	langs: {
		en: {
			needAdmin: '⚠️ | Please add the bot as a group admin to use this command',
			confirm: '⚠️ | Are you sure you want to delete group members with less than %1 messages?\nReact to this message to confirm',
			kickByMsg: '✅ | Successfully removed %1 members with less than %2 messages',
			kickError: '❌ | An error occurred and could not kick %1 members:\n%2',
			noMsg: '✅ | There are no members with less than %1 messages'
		}
	},

	onStart: async function ({ api, args, threadsData, message, event, getLang }) {
		const threadData = await threadsData.get(event.threadID);
		const botID = String(api.getCurrentUserID() || global.Anchestor.botID || '');
		if (!(threadData.adminIDs || []).map(String).includes(botID))
			return message.reply(getLang('needAdmin'));

		if (!isNaN(args[0]) && args[0] !== '' && args[0] != null) {
			const info = await message.reply(getLang('confirm', args[0]));
			if (info && info.messageID) {
				global.Anchestor.onReaction.set(info.messageID, {
					commandName: 'filteruser',
					messageID: info.messageID,
					threadID: event.threadID,
					senderID: event.senderID,
					minimum: Number(args[0]),
					memberIDs: (event.participantIDs || []).map(String)
				});
			}
			return;
		}
		return message.SyntaxError();
	},

	onReaction: async function ({ api, onReaction, event, threadsData, usersData, message, getLang }) {
		global.Anchestor.onReaction.delete(event.messageID);
		const { minimum = 1, memberIDs = [] } = onReaction;
		const threadData = await threadsData.get(event.threadID);
		const botID = String(api.getCurrentUserID() || global.Anchestor.botID || '');
		const adminIDs = (threadData.adminIDs || []).map(String);
		const errors = [];
		const success = [];
		for (const uid of memberIDs) {
			if (uid === botID || adminIDs.includes(uid)) continue;
			const count = (await usersData.get(uid)).messageCount || 0;
			if (count >= minimum) continue;
			try {
				await api.removeParticipant(event.threadID, uid);
				success.push(uid);
			}
			catch {
				errors.push(await usersData.getName(uid));
			}
			await sleep(700);
		}
		let msg = '';
		if (success.length) msg += `${getLang('kickByMsg', success.length, minimum)}\n`;
		if (errors.length) msg += `${getLang('kickError', errors.length, errors.join('\n'))}\n`;
		if (!msg) msg += getLang('noMsg', minimum);
		return message.reply(msg.trim());
	}
};

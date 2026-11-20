'use strict';

// per-thread bans: banned members get kicked out of this box, and get
// kicked again automatically if someone adds them back. this is a box
// ban, not a global one — for a global bot ban use -user ban (bot admin).
const { resolveTargets } = require('./_ig/targets');

function timeNow() {
	return global.utils.getTime();
}

// the reason is whatever is left after the target tokens are pulled out
function stripTargetArgs(args, targets) {
	const drop = new Set();
	for (const t of targets) {
		if (t.id) drop.add(String(t.id));
		if (t.username) {
			drop.add(`@${t.username}`);
			drop.add(t.username);
		}
	}
	return args.filter((a) => {
		if (drop.has(String(a))) return false;
		if (/instagram\.com\//i.test(String(a))) return false;
		return true;
	});
}

function addedIds(event) {
	const added = event.participantsAdded || event.addedParticipants || [];
	return added.map((p) => String(typeof p === 'string' ? p : (p.id || p.userID || p)));
}

module.exports = {
	config: {
		name: 'ban',
		version: '1.4',
		author: 'xemonbae01',
		countDown: 5,
		role: 1,
		description: { en: 'Ban user from box chat' },
		category: 'group',
		guide: { en: '   {pn} [@tag|uid|ig link|reply] [<reason>|leave blank if no reason]: Ban user from box chat'
			+ '\n   {pn} check: Check banned members and kick them out of the box chat'
			+ '\n   {pn} unban [@tag|uid|ig link|reply]: Unban user from box chat'
			+ '\n   {pn} list: View the list of banned members' }
	},

	langs: {
		en: {
			notFoundTarget: '⚠️ | Please tag the person to ban or enter uid or ig link or reply to the message of the person to ban',
			notFoundTargetUnban: '⚠️ | Please tag the person to unban or enter uid or ig link or reply to the message of the person to unban',
			userNotBanned: '⚠️ | The person with id %1 is not banned from this box chat',
			unbannedSuccess: '✅ | Unbanned %1 from box chat!',
			cantSelfBan: '⚠️ | You can\'t ban yourself!',
			cantBanAdmin: '❌ | You can\'t ban the administrator!',
			existedBan: '❌ | This person has been banned before!',
			noReason: 'No reason',
			bannedSuccess: '✅ | Banned %1 from box chat!',
			needAdmin: '⚠️ | Bot needs administrator permission to kick banned members',
			noName: 'Instagram user',
			noData: '📑 | There are no banned members in this box chat',
			listBanned: '📑 | List of banned members in this box chat (page %1/%2)',
			content: '%1/ %2 (%3)\nReason: %4\nBan time: %5\n\n',
			needAdminToKick: '⚠️ | Member %1 (%2) has been banned from box chat, but the bot does not have administrator permission to kick this member, please grant administrator permission to the bot to kick this member',
			bannedKick: '⚠️ | %1 has been banned from box chat before!\nUID: %2\nReason: %3\nBan time: %4\n\nBot has automatically kicked this member'
		}
	},

	onStart: async function ({ message, event, args, threadsData, usersData, api, getLang }) {
		const threadData = await threadsData.get(event.threadID);
		const adminIDs = (threadData.adminIDs || []).map(String);
		const { senderID } = event;
		const botID = String(api.getCurrentUserID() || global.Anchestor.botID || '');
		const dataBanned = (await threadsData.get(event.threadID, 'data.banned_ban')) || [];

		if (args[0] === 'unban') {
			const { targets } = await resolveTargets({ api, event, args: args.slice(1), includeSelf: false });
			const target = targets[0];
			if (!target) return message.reply(getLang('notFoundTargetUnban'));
			const index = dataBanned.findIndex((item) => String(item.id) === String(target.id));
			if (index === -1) return message.reply(getLang('userNotBanned', target.id));
			dataBanned.splice(index, 1);
			await threadsData.set(event.threadID, dataBanned, 'data.banned_ban');
			const userName = target.name || target.username || await usersData.getName(target.id) || getLang('noName');
			return message.reply(getLang('unbannedSuccess', userName));
		}

		if (args[0] === 'check') {
			if (!dataBanned.length) return;
			if (!adminIDs.includes(botID)) return message.reply(getLang('needAdmin'));
			let kicked = 0;
			for (const user of dataBanned) {
				if ((event.participantIDs || []).map(String).includes(String(user.id))) {
					try {
						await api.removeParticipant(event.threadID, String(user.id));
						kicked++;
					}
					catch { /* keep going, one failed kick shouldn't stop the rest */ }
				}
			}
			if (kicked) return message.reply(`kicked ${kicked} banned member${kicked > 1 ? 's' : ''} from the box`);
			return;
		}

		if (args[0] === 'list') {
			if (!dataBanned.length) return message.reply(getLang('noData'));
			const limit = 20;
			const page = parseInt(args[1] || 1) || 1;
			const data = dataBanned.slice((page - 1) * limit, page * limit);
			let msg = '';
			let count = 0;
			for (const user of data) {
				count++;
				const name = await usersData.getName(user.id) || getLang('noName');
				msg += getLang('content', (page - 1) * limit + count, name, user.id, user.reason, user.time);
			}
			return message.reply(getLang('listBanned', page, Math.ceil(dataBanned.length / limit)) + '\n\n' + msg);
		}

		const { targets } = await resolveTargets({ api, event, args, includeSelf: false });
		const target = targets[0];
		if (!target) return message.reply(getLang('notFoundTarget'));
		const targetId = String(target.id);
		if (targetId === String(senderID)) return message.reply(getLang('cantSelfBan'));
		if (adminIDs.includes(targetId)) return message.reply(getLang('cantBanAdmin'));
		if (dataBanned.find((item) => String(item.id) === targetId)) return message.reply(getLang('existedBan'));

		const reason = stripTargetArgs(args, targets).join(' ').trim() || getLang('noReason');
		const name = target.name || target.username || await usersData.getName(targetId) || getLang('noName');
		dataBanned.push({ id: targetId, time: timeNow(), reason });
		await threadsData.set(event.threadID, dataBanned, 'data.banned_ban');
		await message.reply(getLang('bannedSuccess', name));

		// kick them out of the box right away if we can
		if ((event.participantIDs || []).map(String).includes(targetId)) {
			if (adminIDs.includes(botID)) {
				try { await api.removeParticipant(event.threadID, targetId); }
				catch { await message.reply(getLang('needAdmin')); }
			}
			else {
				await message.reply(getLang('needAdmin'));
			}
		}
	},

	// banned member got added back — kick them again
	onEvent: async function ({ event, api, threadsData, usersData, message, getLang }) {
		const added = addedIds(event);
		if (!added.length) return;
		const dataBanned = (await threadsData.get(event.threadID, 'data.banned_ban')) || [];
		if (!dataBanned.length) return;
		const threadData = await threadsData.get(event.threadID);
		const adminIDs = (threadData.adminIDs || []).map(String);
		const botID = String(api.getCurrentUserID() || global.Anchestor.botID || '');
		for (const uid of added) {
			const banned = dataBanned.find((item) => String(item.id) === uid);
			if (!banned) continue;
			const name = await usersData.getName(uid) || getLang('noName');
			if (!adminIDs.includes(botID)) {
				await message.send(getLang('needAdminToKick', name, uid));
				continue;
			}
			try {
				await api.removeParticipant(event.threadID, uid);
				await message.send(getLang('bannedKick', name, uid, banned.reason || getLang('noReason'), banned.time));
			}
			catch {
				await message.send(getLang('needAdminToKick', name, uid));
			}
		}
	}
};

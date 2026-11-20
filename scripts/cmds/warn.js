'use strict';

// warns live in the user's own record (usersData data.warns) so badwords
// strikes and manual warns share one counter: 3 warns and the user is
// banned from the bot everywhere and kicked out of this box.
const { resolveTargets } = require('./_ig/targets');

const MAX_WARNS = 3;

function timeNow() {
	return global.utils.getTime();
}

async function getWarns(usersData, uid) {
	return (await usersData.get(uid, 'data.warns')) || [];
}

async function setWarns(usersData, uid, warns) {
	await usersData.set(uid, warns, 'data.warns');
}

function addedIds(event) {
	const added = event.participantsAdded || event.addedParticipants || [];
	return added.map((p) => String(typeof p === 'string' ? p : (p.id || p.userID || p)));
}

module.exports = {
	config: {
		name: 'warn',
		version: '1.8',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'warn member in group, if they have 3 warns, they will be banned' },
		category: 'group',
		guide: { en: '   {pn} @tag <reason>: warn member'
			+ '\n   {pn} list: view list of warned members'
			+ '\n   {pn} listban: view list of banned members'
			+ '\n   {pn} info [@tag | <uid> | reply | leave blank]: view warning information of tagged person or uid or yourself'
			+ '\n   {pn} unban [@tag | <uid> | reply | leave blank]: unban member, at the same time remove all warnings of that member'
			+ '\n   {pn} unwarn [@tag | <uid> | reply | leave blank] [<number> | leave blank]: remove warning of member by uid and number of warning, if leave blank will remove the last warning'
			+ '\n   {pn} reset: reset all warn data in this thread'
			+ '\n⚠️ You need to set admin for bot to auto kick banned members' }
	},

	langs: {
		en: {
			list: 'List of members who have been warned:\n%1\n\nTo view the details of the warnings, use the "%2warn info [@tag | <uid> | leave blank]" command: to view the warning information of the tagged person or uid or yourself',
			listBan: 'List of members who have been warned 3 times and banned from the box:\n%1',
			listEmpty: 'Your group has no members who have been warned',
			listBanEmpty: 'Your group has no members banned from the box',
			invalidUid: 'Please enter a valid uid of the person you want to view information',
			noData: 'No data',
			noPermission: '❌ Only group administrators can unban members banned from the box',
			invalidUid2: '⚠️ Please enter a valid uid of the person you want to unban',
			notBanned: '⚠️ The user with id %1 has not been banned from your box',
			unbanSuccess: '✅ Successfully unbanned member [%1 | %2], currently this person can join your chat box',
			noPermission2: '❌ Only group administrators can remove warnings from members in the group',
			invalidUid3: '⚠️ Please enter a uid or tag the person you want to remove the warning',
			noData2: '⚠️ The user with id %1 has no warning data',
			notEnoughWarn: '❌ The user %1 only has %2 warnings',
			unwarnSuccess: '✅ Successfully removed the %1 warning of member [%2 | %3]',
			noPermission3: '❌ Only group administrators can reset warning data',
			resetWarnSuccess: '✅ Successfully reset warning data',
			noPermission4: '❌ Only group administrators can warn members in the group',
			invalidUid4: '⚠️ You need to tag or reply to the message of the person you want to warn',
			warnSuccess: '⚠️ Warned member %1 times %2\n- Uid: %3\n- Reason: %4\n- Date Time: %5\nThis member has been warned 3 times and banned from the box, to unban use the command "%6warn unban <uid>" (with uid is the uid of the person you want to unban)',
			noPermission5: '⚠️ Bot needs administrator permissions to kick banned members',
			warnSuccess2: '⚠️ Warned member %1 %2 times\n- Uid: %3\n- Reason: %4\n- Date Time: %5\nIf this person violates %6 more times, they will be banned from the box',
			hasBanned: '⚠️ The following members have been warned 3 times before and banned from the box:\n%1',
			failedKick: '⚠️ An error occurred when kicking the following members:\n%1',
			userNotInGroup: '⚠️ The user "%1" is currently not in your group'
		}
	},

	onStart: async function ({ message, api, event, args, threadsData, usersData, prefix, role, getLang }) {
		if (!args[0]) return message.SyntaxError();
		const { threadID, senderID } = event;
		const participants = (event.participantIDs || []).map(String);

		switch (args[0]) {
			case 'list': {
				const lines = [];
				for (const uid of participants) {
					const warns = await getWarns(usersData, uid);
					if (warns.length) lines.push(`${await usersData.getName(uid)} (${uid}): ${warns.length}`);
				}
				return message.reply(lines.length ? getLang('list', lines.join('\n'), prefix) : getLang('listEmpty'));
			}
			case 'listban': {
				const lines = [];
				for (const uid of participants) {
					const warns = await getWarns(usersData, uid);
					if (warns.length >= MAX_WARNS) lines.push(`${await usersData.getName(uid)} (${uid})`);
				}
				return message.reply(lines.length ? getLang('listBan', lines.join('\n')) : getLang('listBanEmpty'));
			}
			case 'check':
			case 'info': {
				const { targets } = await resolveTargets({ api, event, args: args.slice(1), includeSelf: true });
				if (!targets.length) return message.reply(getLang('invalidUid'));
				const blocks = [];
				for (const t of targets) {
					if (!/^\d+$/.test(String(t.id))) continue;
					const warns = await getWarns(usersData, t.id);
					const userName = t.name || t.username || await usersData.getName(t.id);
					let block = `Uid: ${t.id}\nName: ${userName}`;
					if (!warns.length) block += `\n  ${getLang('noData')}`;
					else {
						block += '\nWarn list:';
						for (const w of warns) block += `\n  - Reason: ${w.reason}\n    Time: ${w.date}`;
					}
					blocks.push(block);
				}
				return message.reply(blocks.length ? blocks.join('\n\n') : getLang('invalidUid'));
			}
			case 'unban': {
				if (role < 1) return message.reply(getLang('noPermission'));
				const { targets } = await resolveTargets({ api, event, args: args.slice(1), includeSelf: true });
				const target = targets[0];
				if (!target || !/^\d+$/.test(String(target.id))) return message.reply(getLang('invalidUid2'));
				const warns = await getWarns(usersData, target.id);
				const userData = await usersData.get(target.id);
				if (warns.length < MAX_WARNS && !(userData.banned && userData.banned.status))
					return message.reply(getLang('notBanned', target.id));
				await setWarns(usersData, target.id, []);
				await usersData.set(target.id, { status: false, reason: null, date: null }, 'banned');
				const userName = target.name || target.username || await usersData.getName(target.id);
				return message.reply(getLang('unbanSuccess', target.id, userName));
			}
			case 'unwarn': {
				if (role < 1) return message.reply(getLang('noPermission2'));
				const { targets } = await resolveTargets({ api, event, args: args.slice(1), includeSelf: false });
				const target = targets[0];
				if (!target || !/^\d+$/.test(String(target.id))) return message.reply(getLang('invalidUid3'));
				const warns = await getWarns(usersData, target.id);
				if (!warns.length) return message.reply(getLang('noData2', target.id));
				// the number is the last arg if it's numeric and not the uid itself
				const lastArg = args[args.length - 1];
				let num = /^\d+$/.test(String(lastArg)) && String(lastArg) !== String(target.id)
					? parseInt(lastArg, 10) - 1
					: warns.length - 1;
				const userName = target.name || target.username || await usersData.getName(target.id);
				if (num < 0 || num >= warns.length)
					return message.reply(getLang('notEnoughWarn', userName, warns.length));
				warns.splice(num, 1);
				await setWarns(usersData, target.id, warns);
				return message.reply(getLang('unwarnSuccess', num + 1, target.id, userName));
			}
			case 'reset': {
				if (role < 1) return message.reply(getLang('noPermission3'));
				for (const uid of participants) {
					if ((await getWarns(usersData, uid)).length) await setWarns(usersData, uid, []);
				}
				return message.reply(getLang('resetWarnSuccess'));
			}
			default: {
				if (role < 1) return message.reply(getLang('noPermission4'));
				const { targets } = await resolveTargets({ api, event, args, includeSelf: false });
				const target = targets[0];
				if (!target) return message.reply(getLang('invalidUid4'));
				const uid = String(target.id);
				// reason is the args minus whatever identified the target
				const reason = args.filter((a) => {
					const s = String(a);
					if (s === uid || s === `@${target.username}` || s === target.username) return false;
					if (/instagram\.com\//i.test(s)) return false;
					return true;
				}).join(' ').trim() || 'No reason';
				const warns = await getWarns(usersData, uid);
				const dateTime = timeNow();
				warns.push({ reason, date: dateTime, by: senderID });
				await setWarns(usersData, uid, warns);
				const times = warns.length;
				const userName = target.name || target.username || await usersData.getName(uid);
				if (times >= MAX_WARNS) {
					await message.reply(getLang('warnSuccess', userName, times, uid, reason, dateTime, prefix));
					await usersData.set(uid, { status: true, reason: `3 warns (${reason})`, date: dateTime }, 'banned');
					const threadData = await threadsData.get(threadID);
					const adminIDs = (threadData.adminIDs || []).map(String);
					const botID = String(api.getCurrentUserID() || global.Anchestor.botID || '');
					if (!participants.includes(uid)) return message.reply(getLang('userNotInGroup', userName));
					if (!adminIDs.includes(botID)) return message.reply(getLang('noPermission5'));
					try { await api.removeParticipant(threadID, uid); }
					catch { return message.reply(getLang('noPermission5')); }
				}
				else {
					return message.reply(getLang('warnSuccess2', userName, times, uid, reason, dateTime, MAX_WARNS - times));
				}
			}
		}
	},

	// someone with 3+ warns got added back — kick them again
	onEvent: async function ({ event, api, threadsData, usersData, message, getLang }) {
		const added = addedIds(event);
		if (!added.length) return;
		const hasBanned = [];
		for (const uid of added) {
			const warns = await getWarns(usersData, uid);
			if (warns.length >= MAX_WARNS)
				hasBanned.push({ uid, name: await usersData.getName(uid) });
		}
		if (!hasBanned.length) return;
		await message.send(getLang('hasBanned', hasBanned.map((u) => `  - ${u.name} (uid: ${u.uid})`).join('\n')));
		const threadData = await threadsData.get(event.threadID);
		const adminIDs = (threadData.adminIDs || []).map(String);
		const botID = String(api.getCurrentUserID() || global.Anchestor.botID || '');
		if (!adminIDs.includes(botID)) return message.send(getLang('noPermission5'));
		const failed = [];
		for (const u of hasBanned) {
			try { await api.removeParticipant(event.threadID, u.uid); }
			catch { failed.push(u); }
		}
		if (failed.length)
			await message.reply(getLang('failedKick', failed.map((u) => `  - ${u.name} (uid: ${u.uid})`).join('\n')));
	}
};

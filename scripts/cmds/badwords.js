'use strict';

// bad words filter, per thread. on a match the sender gets a warning and
// a strike in their shared warns (same pool as -warn, so 3 strikes total
// bans them). ig can't delete other people's messages, so there's no
// delete — the strike is the enforcement.
const { resolveTargets } = require('./_ig/targets');

const MAX_WARNS = 3;

function escapeRegExp(s) {
	return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hideWord(str) {
	return str.length === 2
		? str[0] + '*'
		: str[0] + '*'.repeat(str.length - 2) + str[str.length - 1];
}

async function getBadWords(threadsData, threadID) {
	const saved = await threadsData.get(threadID, 'data.badWords');
	if (saved && typeof saved === 'object') {
		return { words: Array.isArray(saved.words) ? saved.words : [], enabled: saved.enabled === true };
	}
	return { words: [], enabled: false };
}

async function saveBadWords(threadsData, threadID, data) {
	await threadsData.set(threadID, data, 'data.badWords');
}

module.exports = {
	config: {
		name: 'badwords',
		aliases: ['badword'],
		version: '1.4',
		author: 'xemonbae01',
		countDown: 5,
		role: 1,
		description: { en: 'Turn on/off/add/remove bad words warning, violations count as warns (3 warns = ban)' },
		category: 'group',
		guide: { en: '   {pn} add <words>: add banned words (you can add multiple words separated by commas "," or vertical bars "|")'
			+ '\n   {pn} delete <words>: delete banned words (you can delete multiple words separated by commas "," or vertical bars "|")'
			+ '\n   {pn} list <hide | leave blank>: list banned words (add "hide" to hide them)'
			+ '\n   {pn} unwarn [<userID> | <@tag>]: remove 1 bad words strike from a member'
			+ '\n   {pn} on: turn on warning'
			+ '\n   {pn} off: turn off warning' }
	},

	langs: {
		en: {
			onText: 'on',
			offText: 'off',
			onlyAdmin: '⚠️ | Only admins can add banned words to the list',
			missingWords: '⚠️ | You haven\'t entered the banned words',
			addedSuccess: '✅ | Added %1 banned words to the list',
			alreadyExist: '❌ | %1 banned words already exist in the list before: %2',
			tooShort: '⚠️ | %1 banned words cannot be added to the list because they are shorter than 2 characters: %2',
			onlyAdmin2: '⚠️ | Only admins can delete banned words from the list',
			missingWords2: '⚠️ | You haven\'t entered the words to delete',
			deletedSuccess: '✅ | Deleted %1 banned words from the list',
			notExist: '❌ | %1 banned words do not exist in the list before: %2',
			emptyList: '⚠️ | The list of banned words in your group is currently empty',
			badWordsList: '📑 | The list of banned words in your group: %1',
			onlyAdmin3: '⚠️ | Only admins can %1 this feature',
			turnedOnOrOff: '✅ | Banned words warning has been %1',
			onlyAdmin4: '⚠️ | Only admins can delete banned words warning',
			missingTarget: '⚠️ | You haven\'t entered user ID or tagged user',
			notWarned: '⚠️ | User %1 has not been warned for banned words',
			removedWarn: '✅ | User %1 | %2 has been removed 1 banned words warning',
			warned: '⚠️ | Banned words "%1" have been detected in your message, if you continue to violate you will be banned from the group.',
			warned2: '⚠️ | Banned words "%1" have been detected in your message, you have violated 3 times and will be banned from the group.',
			needAdmin: 'Bot needs admin privileges to kick banned members',
			unwarned: '✅ | Removed banned words warning of user %1 | %2'
		}
	},

	onStart: async function ({ message, event, args, threadsData, usersData, api, role, getLang }) {
		const data = await getBadWords(threadsData, event.threadID);
		const badWords = data.words;

		switch (args[0]) {
			case 'add': {
				if (role < 1) return message.reply(getLang('onlyAdmin'));
				const words = args.slice(1).join(' ').split(/[,|]/).map((w) => w.trim()).filter(Boolean);
				if (!words.length) return message.reply(getLang('missingWords'));
				const success = [];
				const exist = [];
				const failed = [];
				for (const word of words) {
					if (word.length < 2) { failed.push(word); continue; }
					if (badWords.some((w) => w.toLowerCase() === word.toLowerCase())) { exist.push(word); continue; }
					badWords.push(word);
					success.push(word);
				}
				await saveBadWords(threadsData, event.threadID, data);
				let reply = '';
				if (success.length) reply += getLang('addedSuccess', success.length);
				if (exist.length) reply += (reply ? '\n' : '') + getLang('alreadyExist', exist.length, exist.map(hideWord).join(', '));
				if (failed.length) reply += (reply ? '\n' : '') + getLang('tooShort', failed.length, failed.join(', '));
				return message.reply(reply || getLang('missingWords'));
			}
			case 'delete':
			case 'del':
			case '-d': {
				if (role < 1) return message.reply(getLang('onlyAdmin2'));
				const words = args.slice(1).join(' ').split(/[,|]/).map((w) => w.trim()).filter(Boolean);
				if (!words.length) return message.reply(getLang('missingWords2'));
				const success = [];
				const failed = [];
				for (const word of words) {
					const idx = badWords.findIndex((w) => w.toLowerCase() === word.toLowerCase());
					if (idx > -1) {
						badWords.splice(idx, 1);
						success.push(word);
					}
					else failed.push(word);
				}
				await saveBadWords(threadsData, event.threadID, data);
				let reply = '';
				if (success.length) reply += getLang('deletedSuccess', success.length);
				if (failed.length) reply += (reply ? '\n' : '') + getLang('notExist', failed.length, failed.join(', '));
				return message.reply(reply || getLang('missingWords2'));
			}
			case 'list':
			case 'all':
			case '-a': {
				if (!badWords.length) return message.reply(getLang('emptyList'));
				return message.reply(getLang('badWordsList', args[1] === 'hide' ? badWords.map(hideWord).join(', ') : badWords.join(', ')));
			}
			case 'on': {
				if (role < 1) return message.reply(getLang('onlyAdmin3', getLang('onText')));
				data.enabled = true;
				await saveBadWords(threadsData, event.threadID, data);
				return message.reply(getLang('turnedOnOrOff', getLang('onText')));
			}
			case 'off': {
				if (role < 1) return message.reply(getLang('onlyAdmin3', getLang('offText')));
				data.enabled = false;
				await saveBadWords(threadsData, event.threadID, data);
				return message.reply(getLang('turnedOnOrOff', getLang('offText')));
			}
			case 'unwarn': {
				if (role < 1) return message.reply(getLang('onlyAdmin4'));
				const { targets } = await resolveTargets({ api, event, args: args.slice(1), includeSelf: false });
				const target = targets[0];
				if (!target || !/^\d+$/.test(String(target.id))) return message.reply(getLang('missingTarget'));
				const warns = (await usersData.get(target.id, 'data.warns')) || [];
				// remove the newest strike that came from this filter
				let idx = -1;
				for (let i = warns.length - 1; i >= 0; i--) {
					if (warns[i] && warns[i].by === 'badwords') { idx = i; break; }
				}
				if (idx === -1) return message.reply(getLang('notWarned', target.id));
				warns.splice(idx, 1);
				await usersData.set(target.id, warns, 'data.warns');
				const userName = target.name || target.username || await usersData.getName(target.id);
				return message.reply(getLang('unwarned', target.id, userName));
			}
			default:
				return message.SyntaxError();
		}
	},

	// onChat, not onEvent — the handler only runs command onEvent hooks for
	// thread/unsend events, never for plain message text
	onChat: async function ({ message, event, api, threadsData, usersData, prefix, getLang }) {
		if (!event.body) return false;
		// never filter the bot's own admin or this command itself
		if (event.isSelf) return false;
		const body = event.body.trim();
		if (prefix && (body.startsWith(prefix + 'badwords') || body.startsWith(prefix + 'badword'))) return false;
		const data = await getBadWords(threadsData, event.threadID);
		if (!data.enabled || !data.words.length) return false;

		for (const word of data.words) {
			if (!new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(body)) continue;
			const warns = (await usersData.get(event.senderID, 'data.warns')) || [];
			warns.push({ reason: `bad word: ${word}`, date: global.utils.getTime(), by: 'badwords' });
			await usersData.set(event.senderID, warns, 'data.warns');
			if (warns.length >= MAX_WARNS) {
				await message.reply(getLang('warned2', word));
				await usersData.set(event.senderID, { status: true, reason: `${MAX_WARNS} warns (bad word: ${word})`, date: global.utils.getTime() }, 'banned');
				const threadData = await threadsData.get(event.threadID);
				const adminIDs = (threadData.adminIDs || []).map(String);
				const botID = String(api.getCurrentUserID() || global.Anchestor.botID || '');
				if ((event.participantIDs || []).map(String).includes(String(event.senderID))) {
					if (adminIDs.includes(botID)) {
						try { await api.removeParticipant(event.threadID, String(event.senderID)); }
						catch { await message.reply(getLang('needAdmin')); }
					}
					else await message.reply(getLang('needAdmin'));
				}
			}
			else {
				await message.reply(getLang('warned', word));
			}
			return false; // one strike per message, and the message still flows on
		}
		return false;
	}
};

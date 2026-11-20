'use strict';

// thread admin tools: find threads by name, ban/unban a thread from using
// the bot, and see a thread's stored info.
function fmtDate(ts) {
	if (!ts) return 'unknown';
	try {
		return new Intl.DateTimeFormat('en-GB', {
			timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
			hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
		}).format(new Date(ts));
	}
	catch {
		return new Date(ts).toLocaleString('en-GB');
	}
}

module.exports = {
	config: {
		name: 'thread',
		version: '1.5',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'Manage group chat in bot system' },
		category: 'admin',
		guide: { en: '   {pn} [find | -f | search | -s] <name to find>: search group chat in bot data by name'
			+ '\n   {pn} [ban | -b] [<tid> | leave blank] <reason>: use to ban group with id <tid> or current group using bot'
			+ '\n   Example:'
			+ '\n    {pn} ban 3950898668362484 spam bot'
			+ '\n    {pn} ban spam too much'
			+ '\n\n   {pn} unban [<tid> | leave blank] to unban group with id <tid> or current group'
			+ '\n   Example:'
			+ '\n    {pn} unban 3950898668362484'
			+ '\n    {pn} unban'
			+ '\n\n   {pn} info [<tid> | leave blank]: view stored info about a group' }
	},

	langs: {
		en: {
			noPermission: 'You don\'t have permission to use this feature',
			found: '🔎 Found %1 group matching the keyword "%2" in bot data:\n%3',
			notFound: '❌ No group found matching the keyword: "%1" in bot data',
			hasBanned: 'Group with id [%1 | %2] has been banned before:\n» Reason: %3\n» Time: %4',
			banned: 'Banned group with id [%1 | %2] using bot.\n» Reason: %3\n» Time: %4',
			notBanned: 'Group with id [%1 | %2] is not banned using bot',
			unbanned: 'Unbanned group with tid [%1 | %2] using bot',
			missingReason: 'Ban reason cannot be empty',
			info: '» Box ID: %1\n» Name: %2\n» Date created data: %3\n» Total members: %4\n» Total messages: %5%6'
		}
	},

	onStart: async function ({ args, threadsData, message, role, event, getLang }) {
		const type = args[0];

		switch (type) {
			case 'find':
			case 'search':
			case '-f':
			case '-s': {
				if (role < 2) return message.reply(getLang('noPermission'));
				const allThread = await threadsData.getAll();
				const list = Array.isArray(allThread) ? allThread : Object.values(allThread || {});
				const keyword = args.slice(1).join(' ');
				const result = list.filter((item) => (item.threadName || '').toLowerCase().includes(keyword.toLowerCase()));
				const resultText = result.reduce((i, thread) => i += `\n╭Name: ${thread.threadName}\n╰ID: ${thread.threadID}`, '');
				return message.reply(result.length > 0
					? getLang('found', result.length, keyword, resultText)
					: getLang('notFound', keyword));
			}
			case 'ban':
			case '-b': {
				if (role < 2) return message.reply(getLang('noPermission'));
				let tid, reason;
				if (!isNaN(args[1])) {
					tid = args[1];
					reason = args.slice(2).join(' ');
				}
				else {
					tid = event.threadID;
					reason = args.slice(1).join(' ');
				}
				if (!tid) return message.SyntaxError();
				if (!reason) return message.reply(getLang('missingReason'));
				reason = reason.replace(/\s+/g, ' ');
				const threadData = await threadsData.get(tid);
				const name = threadData.threadName;
				if (threadData.banned && threadData.banned.status)
					return message.reply(getLang('hasBanned', tid, name, threadData.banned.reason, threadData.banned.date));
				const time = global.utils.getTime();
				await threadsData.set(tid, { status: true, reason, date: time }, 'banned');
				return message.reply(getLang('banned', tid, name, reason, time));
			}
			case 'unban':
			case '-u': {
				if (role < 2) return message.reply(getLang('noPermission'));
				const tid = !isNaN(args[1]) ? args[1] : event.threadID;
				if (!tid) return message.SyntaxError();
				const threadData = await threadsData.get(tid);
				const name = threadData.threadName;
				if (!(threadData.banned && threadData.banned.status))
					return message.reply(getLang('notBanned', tid, name));
				await threadsData.set(tid, { status: false, reason: null, date: null }, 'banned');
				return message.reply(getLang('unbanned', tid, name));
			}
			case 'info':
			case '-i': {
				const tid = !isNaN(args[1]) ? args[1] : event.threadID;
				if (!tid) return message.SyntaxError();
				const threadData = await threadsData.get(tid);
				const infoBanned = threadData.banned && threadData.banned.status
					? `\n- Banned: ${threadData.banned.status}`
						+ `\n- Reason: ${threadData.banned.reason}`
						+ `\n- Time: ${threadData.banned.date}`
					: '';
				return message.reply(getLang('info', threadData.threadID, threadData.threadName,
					fmtDate(threadData.createdAt), threadData.memberCount || 0,
					threadData.messageCount || 0, infoBanned));
			}
			default:
				return message.SyntaxError();
		}
	}
};

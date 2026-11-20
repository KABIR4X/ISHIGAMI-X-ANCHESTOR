'use strict';

// afk mode: tell the group you're away, the bot covers for you while
// you're gone and catches you up on who mentioned you when you're back.
// state lives in usersData so it survives a restart; the mention log is
// memory-only (it resets with the bot, which is fine for a catch-up list).

const AFK_TIMEOUT = 8 * 60 * 60 * 1000;
const MAX_MENTIONS = 10;

// userID -> [{ from, content }] (memory only, capped)
const mentionLog = new Map();

function formatDuration(ms) {
	const totalMin = Math.max(1, Math.floor(ms / 60000));
	const hours = Math.floor(totalMin / 60);
	const mins = totalMin % 60;
	if (hours) return `${hours}h ${mins}m`;
	return `${mins}m`;
}

function isExpired(afk) {
	return !afk || !afk.since || Date.now() - afk.since >= AFK_TIMEOUT;
}

async function getAfk(usersData, userID) {
	try {
		return await usersData.get(userID, 'data.afk');
	}
	catch { return null; }
}

async function clearAfk(usersData, userID) {
	try {
		await usersData.set(userID, null, 'data.afk');
	}
	catch { /* clearing never breaks the flow */ }
}

module.exports = {
	config: {
		name: 'afk',
		version: '2.2',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'Enable AFK mode with auto-timeout' },
		category: 'utility',
		guide: { en: '   {pn} <reason>' }
	},

	onStart: async function ({ message, event, args, usersData }) {
		const senderID = String(event.senderID);
		const existing = await getAfk(usersData, senderID);

		if (existing && !isExpired(existing)) {
			return message.reply('⚠️ You are already in AFK mode.');
		}

		const reason = args.join(' ') || 'No reason provided';
		await usersData.set(senderID, { reason, since: Date.now() }, 'data.afk');

		return message.reply(
			`✅ AFK mode enabled.\n📝 Reason: ${reason}\n⏱️ Auto-off in 8 hours.`
		);
	},

	onChat: async function ({ message, event, usersData, prefix }) {
		const senderID = String(event.senderID);
		const body = event.body || '';

		// the -afk command itself is onStart's job, not ours
		if (prefix && body.startsWith(`${prefix}afk`)) return;

		// anyone mentioned or replied to who is afk gets covered for
		const targets = new Set(Object.keys(event.mentions || {}));
		if (event.messageReply && event.messageReply.senderID)
			targets.add(String(event.messageReply.senderID));

		for (const uid of targets) {
			if (uid === senderID) continue;
			const afk = await getAfk(usersData, uid);
			if (!afk) continue;
			if (isExpired(afk)) {
				await clearAfk(usersData, uid);
				continue;
			}
			const name = await usersData.getName(uid);
			await message.reply(`💤 ${name} is currently AFK.\n📝 Reason: ${afk.reason}`);
			const log = mentionLog.get(uid) || [];
			log.push({ from: senderID, content: body || 'No message' });
			if (log.length > MAX_MENTIONS) log.splice(0, log.length - MAX_MENTIONS);
			mentionLog.set(uid, log);
		}

		// the sender themself is back: clear afk and catch them up
		const own = await getAfk(usersData, senderID);
		if (!own) return;
		if (isExpired(own)) {
			await clearAfk(usersData, senderID);
			mentionLog.delete(senderID);
			return;
		}
		await clearAfk(usersData, senderID);
		const awayFor = formatDuration(Date.now() - own.since);
		const mentions = mentionLog.get(senderID) || [];
		mentionLog.delete(senderID);

		let replyMsg = `👋 Welcome back! You were away for ${awayFor}.\n`;
		if (!mentions.length) {
			replyMsg += '🔔 Nobody mentioned you while you were gone.';
		}
		else {
			replyMsg += `🔔 You were mentioned ${mentions.length} time(s) while AFK:\n\n`;
			for (const m of mentions) {
				const name = await usersData.getName(m.from);
				replyMsg += `• ${name}: ${m.content}\n`;
			}
		}
		await message.reply(replyMsg.trim());
	}
};

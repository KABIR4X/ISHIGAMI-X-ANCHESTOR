'use strict';

// anti-delete: when it's on in a thread, the bot keeps the last few dozen
// messages in memory, and when someone unsends one it reposts the text
// (plus any photo attachments it can still fetch). ig only tells us the
// message id on unsend, never the content — that's why the cache exists.
// the cache is in-memory, so a restart forgets it.
const CACHE_PER_THREAD = 50;

const cache = new Map(); // threadID -> [{ messageID, senderID, body, attachments }]

function pushMessage(threadID, msg) {
	const list = cache.get(threadID) || [];
	list.push(msg);
	while (list.length > CACHE_PER_THREAD) list.shift();
	cache.set(threadID, list);
}

module.exports = {
	config: {
		name: 'resend',
		version: '6.0',
		author: 'xemonbae01',
		countDown: 1,
		role: 2,
		description: { en: 'Anti-delete mode: reposts messages people unsend' },
		category: 'group',
		guide: { en: '{pn}\nExample: -resend' }
	},

	onStart: async function ({ message, event, threadsData }) {
		const current = await threadsData.get(event.threadID, 'data.resend');
		const newState = !(current === true);
		await threadsData.set(event.threadID, newState, 'data.resend');
		if (!cache.has(event.threadID)) cache.set(event.threadID, []);
		return message.reply(newState
			? '✅ Anti-delete mode ENABLED.'
			: '❌ Anti-delete mode DISABLED.');
	},

	// remember every message while anti-delete is on
	onChat: async function ({ event, threadsData }) {
		if (!event.messageID) return false;
		const enabled = await threadsData.get(event.threadID, 'data.resend');
		if (!enabled) return false;
		pushMessage(String(event.threadID), {
			messageID: String(event.messageID),
			senderID: String(event.senderID || ''),
			body: event.body || '',
			attachments: event.attachments || []
		});
		return false;
	},

	// an unsend arrived — repost what we remember about that message
	onEvent: async function ({ event, api, message, threadsData, usersData }) {
		if (event.type !== 'message_unsend') return;
		const enabled = await threadsData.get(event.threadID, 'data.resend');
		if (!enabled) return;
		const store = cache.get(String(event.threadID));
		if (!store) return;
		const msg = store.find((m) => m.messageID === String(event.messageID));
		if (!msg) return;
		let userName = 'User';
		try {
			const name = await usersData.getName(msg.senderID);
			if (name) userName = name;
		}
		catch { /* keep the fallback */ }
		const text = msg.body
			? `📢 ${userName} deleted a message.\nContent: ${msg.body}`
			: `📢 ${userName} deleted a message (no text content).`;
		await message.send(text);
		// best effort: re-send photo attachments we still have a url for
		for (const att of msg.attachments || []) {
			if (!att.url) continue;
			const type = String(att.type || '').toLowerCase();
			if (!type.includes('photo') && !type.includes('image')) continue;
			try {
				if (api.sendImageFromUrl) await api.sendImageFromUrl(event.threadID, att.url);
				else if (api.sendImage) await api.sendImage(event.threadID, att.url);
			}
			catch { /* attachment gone, the text is already up */ }
		}
	}
};

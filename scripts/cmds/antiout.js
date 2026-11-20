'use strict';

// anti-out: when it's on, anyone who leaves the box gets added straight
// back. needs the bot to be a group admin to re-add people.
function removedIds(event) {
	const removed = event.participantsRemoved || event.removedParticipants || [];
	return removed.map((p) => String(typeof p === 'string' ? p : (p.id || p.userID || p)));
}

module.exports = {
	config: {
		name: 'antiout',
		version: '1.4',
		author: 'xemonbae01',
		countDown: 5,
		role: 1,
		description: { en: 'Turn on/off anti-out, if someone leaves they get added back automatically' },
		category: 'group',
		guide: { en: '{pn} [check | list]' }
	},

	onStart: async function ({ message, event, args, api, threadsData }) {
		const threadID = String(event.threadID);

		if (args[0] && args[0].toLowerCase() === 'check') {
			const status = (await threadsData.get(threadID, 'data.antiout')) === true;
			return message.reply(`⚙️ Antiout status for this box: ${status ? '✅ ON' : '❌ OFF'}`);
		}

		if (args[0] && args[0].toLowerCase() === 'list') {
			const all = await threadsData.getAll();
			const active = (Array.isArray(all) ? all : Object.values(all || {}))
				.filter((t) => t && t.data && t.data.antiout === true);
			if (!active.length) return message.reply('📂 No box has Antiout on right now.');
			let msg = '📌 Boxes with Antiout on:\n\n';
			for (const t of active) {
				let name = t.threadName || null;
				if (!name) {
					try {
						const info = await api.getThreadInfo(t.threadID);
						name = info.threadName;
					}
					catch { /* name stays unknown */ }
				}
				msg += `- ${name || 'Unknown name'} (ID: ${t.threadID})\n`;
			}
			return message.reply(msg.trim());
		}

		// no check/list — toggle it
		const newStatus = (await threadsData.get(threadID, 'data.antiout')) !== true;
		await threadsData.set(threadID, newStatus, 'data.antiout');
		return message.reply(`🔄 Antiout is now ${newStatus ? '✅ ON' : '❌ OFF'} for this box.`);
	},

	onEvent: async function ({ api, event, message, threadsData }) {
		const removed = removedIds(event);
		if (!removed.length) return;
		const enabled = (await threadsData.get(event.threadID, 'data.antiout')) === true;
		if (!enabled) return;
		const botID = String(api.getCurrentUserID() || global.Anchestor.botID || '');
		for (const uid of removed) {
			if (uid === botID) continue; // bot leaving is its own business
			try {
				await api.addParticipants(event.threadID, uid);
				await message.send('🚫 No leaving allowed! You have been added back to the box.');
			}
			catch {
				await message.send(`⚠️ Couldn't add user ID: ${uid} back (they may have blocked the bot or the box is full).`);
			}
		}
	}
};

'use strict';

// refreshes the stored info of every thread the bot knows about, from
// instagram. the messenger version listed threads live with getThreadList
// (no such api on ig), so this one works over the threads already in the
// database instead. thread info comes through the login thread cache, so
// values only get truly fresh after a thread update clears it.
module.exports = {
	config: {
		name: 'setbox',
		version: '1.1',
		author: 'xemonbae01',
		countDown: 5,
		role: 2,
		description: { en: 'Update data of all boxes in the bot database' },
		category: 'admin',
		guide: { en: '{pn}' }
	},

	onStart: async function ({ api, threadsData, message }) {
		try {
			const all = await threadsData.getAll();
			const list = Array.isArray(all) ? all : Object.values(all || {});
			let updated = 0;
			let failed = 0;
			for (const thread of list) {
				try {
					const info = await api.getThreadInfo(thread.threadID);
					if (!info || !info.threadID) throw new Error('no info returned');
					const patch = {};
					if (info.threadName !== undefined) patch.threadName = info.threadName;
					if (info.isGroup !== undefined) patch.isGroup = info.isGroup;
					if (Array.isArray(info.participantIDs)) {
						patch.participantIDs = info.participantIDs.map(String);
						patch.memberCount = info.participantIDs.length;
					}
					if (Array.isArray(info.adminIDs)) patch.adminIDs = info.adminIDs.map(String);
					await threadsData.set(thread.threadID, patch);
					updated++;
				}
				catch (err) {
					global.utils.log.error('SETBOX', `failed to update box ${thread.threadID}: ${err.message}`);
					failed++;
				}
			}
			return message.reply(`✅ Updated data of ${updated}/${list.length} boxes${failed ? ` (${failed} failed)` : ''}`);
		}
		catch (err) {
			global.utils.log.error('SETBOX', err.message);
			return message.reply('❌ Something went wrong while updating boxes.');
		}
	}
};

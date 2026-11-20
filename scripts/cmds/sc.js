'use strict';

// share a user's contact — on messenger this sent a contact card; on ig
// the equivalent is sharing their profile card into the thread.

const { resolveTargets } = require('./_ig/targets');

module.exports = {
	config: {
		name: 'sharecontact',
		aliases: ['contact', 'sendcontact', 'sc'],
		version: '1.0.0',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: "Share a user's contact (profile card)" },
		category: 'utility',
		guide: { en: '   {pn} @mention\n   {pn} (reply to a message)' }
	},

	onStart: async function ({ api, event, message, args }) {
		const { targets } = await resolveTargets({ api, event, args, includeSelf: false });
		if (!targets.length) {
			return message.reply('Please mention a user or reply to their message to share their contact.');
		}

		const target = targets[0];
		const label = target.username ? `@${target.username}` : (target.name || target.id);

		if (typeof api.shareProfile !== 'function') {
			return message.reply('Sharing profiles is not available on this bot.');
		}

		try {
			await message.send(`Here's the contact information for ${label}:`);
			await api.shareProfile(event.threadID, target.id);
		}
		catch (err) {
			return message.reply(`Error: ${err.message}`);
		}
	}
};

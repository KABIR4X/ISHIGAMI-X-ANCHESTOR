'use strict';

const { resolveTargets } = require('./_ig/targets');

module.exports = {
	config: {
		name: 'uid',
		aliases: ['id'],
		version: '2.0.0',
		author: 'xemonbae01',
		countDown: 2,
		role: 0,
		description: { en: 'get instagram ids — yours, a reply, a mention, @username or a profile link' },
		category: 'info',
		guide: { en: '   {pn}: your own id'
			+ '\n   {pn} @user: id of the tagged user'
			+ '\n   {pn} <profile link>: id of that profile'
			+ '\n   reply to a message + {pn}: id of the sender' }
	},

	onStart: async function ({ message, event, args, api }) {
		const { targets, notFound } = await resolveTargets({ api, event, args });
		const lines = targets.map((t) => {
			if (t.username) return `@${t.username}: ${t.id}`;
			if (t.name) return `${t.name}: ${t.id}`;
			return String(t.id);
		});
		for (const nf of notFound) lines.push(`${nf}: not found`);
		return message.reply(lines.join('\n') || 'no user found');
	}
};

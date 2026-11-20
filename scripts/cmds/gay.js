'use strict';

// the gay meter — elite generated a rainbow avatar image for this, but
// image gen libs are out on ig, so this is the text version: a random
// percentage, a meter bar and a line to match. light-hearted, nothing more.

const { resolveTargets } = require('./_ig/targets');

function meterBar(pct) {
	const filled = Math.round(pct / 10);
	return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function lineFor(pct) {
	if (pct === 0) return 'Certified straight. Suspiciously straight, even.';
	if (pct < 20) return 'Mostly straight, with a little sparkle.';
	if (pct < 40) return 'A little fruity, nothing to worry about.';
	if (pct < 60) return 'Halfway there. The rainbow is calling.';
	if (pct < 80) return 'Very gay. The vibes are immaculate.';
	if (pct < 100) return 'Extremely gay. Basically a pride parade.';
	return '100% GAY. Look... I found a gay!';
}

module.exports = {
	config: {
		name: 'gay',
		version: '1.0',
		author: 'xemonbae01',
		countDown: 1,
		role: 0,
		description: { en: 'Check how gay someone is (text version)' },
		category: 'fun',
		guide: { en: '   {pn} [@mention | reply] — no target means yourself' }
	},

	onStart: async function ({ event, message, api }) {
		const { targets } = await resolveTargets({ api, event, args: [], includeSelf: true });
		const target = targets[0];
		const name = target.name || (target.username ? `@${target.username}` : target.id);
		const isSelf = String(target.id) === String(event.senderID);
		const targetedSomeone = Boolean(event.messageReply) || Object.keys(event.mentions || {}).length > 0;

		const pct = Math.floor(Math.random() * 101);
		let body = `🏳️‍🌈 Gay meter for ${name}\n\n${meterBar(pct)} ${pct}%\n${lineFor(pct)}`;
		if (isSelf && !targetedSomeone) {
			body = `Baka, you gay!\nYou forgot to reply or mention someone.\n\n${body}`;
		}
		return message.reply(body);
	}
};

'use strict';

// tarot reading — elite fetched the deck from github raw at runtime and
// sent the card image from tarot.vn. this version ships the full 78-card
// rider-waite deck in Game/tarot.json next to the command, so it works
// with zero network calls: text reading only, no image.

const deck = require('./Game/tarot.json');

function readCard(card, index) {
	return '━━━━━━ [ Tarot Reading ] ━━━━━━\n\n' +
		`→ Card #${index}: ${card.name}\n` +
		`→ Suite: ${card.suite}\n` +
		`→ Upright: ${card.up}\n` +
		`→ Reversed: ${card.rev}`;
}

module.exports = {
	config: {
		name: 'tarot',
		version: '1.0.0',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'Tarot card reading (78-card Rider-Waite deck)' },
		category: 'fun',
		guide: { en: '   {pn} — draw a random card\n   {pn} <number 0-77> — draw a specific card\n   {pn} <card name> — look a card up by name' }
	},

	onStart: async function ({ message, args }) {
		const query = args.join(' ').trim();

		if (!query) {
			const index = Math.floor(Math.random() * deck.length);
			return message.reply(readCard(deck[index], index));
		}

		// a number means a card index, like elite
		if (/^\d+$/.test(query)) {
			const index = parseInt(query, 10);
			if (index < 0 || index >= deck.length) {
				return message.reply(`❌ Cannot exceed the number of cards in the deck (0-${deck.length - 1}).`);
			}
			return message.reply(readCard(deck[index], index));
		}

		// otherwise look the card up by name
		const needle = query.toLowerCase();
		const index = deck.findIndex((c) => c.name.toLowerCase().includes(needle));
		if (index === -1) {
			return message.reply(`❌ No card named "${query}" in the deck.`);
		}
		return message.reply(readCard(deck[index], index));
	}
};

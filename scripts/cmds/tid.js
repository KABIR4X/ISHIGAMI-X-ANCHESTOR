module.exports = {
	config: {
		name: 'tid',
		version: '1.2',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'View threadID of your group chat' },
		category: 'info',
		guide: { en: '{pn}' }
	},

	onStart: async function ({ message, event }) {
		return message.reply(String(event.threadID));
	}
};

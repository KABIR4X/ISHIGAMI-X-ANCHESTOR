'use strict';

// reloads config.json (and configCommands.json) from disk so edits made
// by hand take effect without a restart.
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');

module.exports = {
	config: {
		name: 'loadconfig',
		aliases: ['loadcf'],
		version: '1.4',
		author: 'xemonbae01',
		countDown: 5,
		role: 2,
		description: { en: 'Reload config of bot' },
		category: 'admin',
		guide: { en: '{pn}' }
	},

	langs: {
		en: {
			success: 'Config has been reloaded successfully',
			failed: 'Failed to reload config: %1'
		}
	},

	onStart: async function ({ message, getLang }) {
		try {
			const configPath = path.join(rootDir, 'config.json');
			global.Anchestor.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
			const commandsPath = path.join(rootDir, 'configCommands.json');
			if (fs.existsSync(commandsPath))
				global.Anchestor.configCommands = JSON.parse(fs.readFileSync(commandsPath, 'utf8'));
			return message.reply(getLang('success'));
		}
		catch (err) {
			return message.reply(getLang('failed', err.message));
		}
	}
};

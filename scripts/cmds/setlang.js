'use strict';

// bot language, global only: writes config.language and saves config.json
// so it survives a restart. per-thread language isn't a thing on ig —
// the handler only reads the global setting.
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');
const langsDir = path.join(rootDir, 'languages');

module.exports = {
	config: {
		name: 'setlang',
		version: '1.5',
		author: 'xemonbae01',
		countDown: 5,
		role: 2,
		description: { en: 'Set default language of bot' },
		category: 'config',
		guide: { en: '\n   {pn} <language code ISO 639-1>'
			+ '\n   Example:'
			+ '\n    {pn} en'
			+ '\n    {pn} vi'
			+ '\n   {pn} list: show available languages' }
	},

	langs: {
		en: {
			setLangForAll: 'Set default language of bot to: %1',
			noPermission: 'Only bot admin can use this command',
			langNotFound: 'Can\'t find language: %1',
			langList: 'Available languages:\n%1\nCurrent: %2'
		}
	},

	onStart: async function ({ message, args, getLang, role }) {
		if (!args[0]) return message.SyntaxError();
		const current = (global.Anchestor.config && global.Anchestor.config.language) || 'en';

		if (args[0].toLowerCase() === 'list') {
			const codes = fs.existsSync(langsDir)
				? fs.readdirSync(langsDir).filter((f) => f.endsWith('.lang')).map((f) => f.slice(0, -5))
				: [];
			return message.reply(getLang('langList', codes.map((c) => `- ${c}`).join('\n') || '(none)', current));
		}

		if (role < 2) return message.reply(getLang('noPermission'));
		let langCode = args[0].toLowerCase();
		if (langCode === 'default' || langCode === 'reset') langCode = 'en';
		if (!fs.existsSync(path.join(langsDir, `${langCode}.lang`)))
			return message.reply(getLang('langNotFound', langCode));

		global.Anchestor.config.language = langCode;
		fs.writeFileSync(path.join(rootDir, 'config.json'), JSON.stringify(global.Anchestor.config, null, 2));
		return message.reply(getLang('setLangForAll', langCode));
	}
};

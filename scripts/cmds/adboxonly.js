'use strict';

// admin-box-only mode: when it's on, only group admins and bot admins can
// use commands in this thread. the gate itself lives in the handler.
module.exports = {
	config: {
		name: 'adboxonly',
		aliases: ['adminbox', 'adminboxonly', 'onlyadbox'],
		version: '1.3',
		author: 'xemonbae01',
		countDown: 5,
		role: 1,
		description: { en: 'turn on/off only admin box can use bot' },
		category: 'group',
		guide: { en: '   {pn} [on | off]: turn on/off the mode only admin of group can use bot' }
	},

	langs: {
		en: {
			turnedOn: 'Turned on the mode only admin of group can use bot',
			turnedOff: 'Turned off the mode only admin of group can use bot',
			syntaxError: 'Syntax error, only use {pn} on or {pn} off'
		}
	},

	onStart: async function ({ args, message, event, threadsData, getLang }) {
		if (args[0] !== 'on' && args[0] !== 'off')
			return message.reply(getLang('syntaxError'));
		const value = args[0] === 'on';
		await threadsData.set(event.threadID, value, 'data.adminBoxOnly');
		return message.reply(value ? getLang('turnedOn') : getLang('turnedOff'));
	}
};

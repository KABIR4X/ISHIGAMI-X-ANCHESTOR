'use strict';

// custom welcome text for this thread. {userName} is the new member(s),
// {threadName} / {boxName} is the group name, {multiple} is "you" or
// "you guys". file attachments aren't supported on ig (no drive).
module.exports = {
	config: {
		name: 'setwelcome',
		aliases: ['setwc'],
		version: '1.7',
		author: 'xemonbae01',
		countDown: 5,
		role: 1,
		description: { en: 'Edit welcome message content when new member join your group chat' },
		category: 'config',
		guide: { en: '   {pn} text [<content> | reset]: edit text content or reset to default, with some shortcuts:'
			+ '\n  + {userName}: new member name'
			+ '\n  + {userNameTag}: new member name (tag)'
			+ '\n  + {boxName}: group chat name'
			+ '\n  + {multiple}: you || you guys'
			+ '\n\n   Example:'
			+ '\n    {pn} text Hello {userName}, welcome to {boxName}, have a nice day {multiple}'
			+ '\n\n   {pn} on: turn on welcome message'
			+ '\n   {pn} off: turn off welcome message' }
	},

	langs: {
		en: {
			turnedOn: 'Turned on welcome message',
			turnedOff: 'Turned off welcome message',
			missingContent: 'Please enter welcome message content',
			edited: 'Edited welcome message content of your group to: %1',
			reseted: 'Reseted welcome message content',
			noFile: 'File attachments for welcome messages are not supported on Instagram'
		}
	},

	onStart: async function ({ args, threadsData, message, event, getLang }) {
		const { threadID } = event;
		switch (args[0]) {
			case 'text': {
				if (!args[1]) return message.reply(getLang('missingContent'));
				if (args[1] === 'reset') {
					await threadsData.set(threadID, null, 'data.welcomeText');
					return message.reply(getLang('reseted'));
				}
				const text = args.slice(1).join(' ');
				await threadsData.set(threadID, text, 'data.welcomeText');
				return message.reply(getLang('edited', text));
			}
			case 'file':
				return message.reply(getLang('noFile'));
			case 'on':
			case 'off': {
				await threadsData.set(threadID, args[0] === 'on', 'data.welcome');
				return message.reply(args[0] === 'on' ? getLang('turnedOn') : getLang('turnedOff'));
			}
			default:
				return message.SyntaxError();
		}
	}
};

'use strict';

// custom goodbye text for this thread. {userName} is the member who left,
// {threadName} / {boxName} is the group name. file attachments aren't
// supported on ig (no drive).
module.exports = {
	config: {
		name: 'setleave',
		aliases: ['setl'],
		version: '1.7',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'Edit content/turn on/off leave message when member leave your group chat' },
		category: 'config',
		guide: { en: '   {pn} on: Turn on leave message'
			+ '\n   {pn} off: Turn off leave message'
			+ '\n   {pn} text [<content> | reset]: edit text content or reset to default, available shortcuts:'
			+ '\n  + {userName}: name of member who leave group'
			+ '\n  + {userNameTag}: name of member who leave group (tag)'
			+ '\n  + {boxName}: name of group chat'
			+ '\n\n   Example:'
			+ '\n    {pn} text {userName} has left the group, see you again 🤧' }
	},

	langs: {
		en: {
			turnedOn: 'Turned on leave message successfully',
			turnedOff: 'Turned off leave message successfully',
			missingContent: 'Please enter content',
			edited: 'Edited leave message content of your group to:\n%1',
			reseted: 'Reseted leave message content',
			noFile: 'File attachments for leave messages are not supported on Instagram'
		}
	},

	onStart: async function ({ args, threadsData, message, event, getLang }) {
		const { threadID } = event;
		switch (args[0]) {
			case 'text': {
				if (!args[1]) return message.reply(getLang('missingContent'));
				if (args[1] === 'reset') {
					await threadsData.set(threadID, null, 'data.leaveText');
					return message.reply(getLang('reseted'));
				}
				const text = args.slice(1).join(' ');
				await threadsData.set(threadID, text, 'data.leaveText');
				return message.reply(getLang('edited', text));
			}
			case 'file':
				return message.reply(getLang('noFile'));
			case 'on':
			case 'off': {
				await threadsData.set(threadID, args[0] === 'on', 'data.leave');
				return message.reply(args[0] === 'on' ? getLang('turnedOn') : getLang('turnedOff'));
			}
			default:
				return message.SyntaxError();
		}
	}
};

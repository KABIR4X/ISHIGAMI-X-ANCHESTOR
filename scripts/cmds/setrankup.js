'use strict';

// rankup message for this thread. the handler sends it when someone
// levels up; {userName} is the member, {oldRank} / {currentRank} are the
// levels. file attachments aren't supported on ig (no drive).
module.exports = {
	config: {
		name: 'setrankup',
		version: '1.2',
		author: 'xemonbae01',
		countDown: 0,
		role: 0,
		description: { en: 'Configure rankup' },
		category: 'config',
		guide: { en: '   {pn} text <message>: Configure the message when a member rankup in your chatbox'
			+ '\n   With the following parameters:'
			+ '\n    + {userName}: Member\'s name'
			+ '\n    + {userNameTag}: Tag member\'s name'
			+ '\n    + {oldRank}: Member\'s old rank'
			+ '\n    + {currentRank}: Member\'s current rank'
			+ '\n   {pn} reset: Reset to default configuration'
			+ '\n   {pn} on: Turn rankup messages back on'
			+ '\n   {pn} off: Turn rankup messages off' }
	},

	langs: {
		en: {
			changedMessage: 'Changed rankup message to: %1',
			reseted: 'Reseted rankup configuration to default',
			turnedOn: 'Rankup messages turned on',
			turnedOff: 'Rankup messages turned off',
			missingContent: 'Please enter the rankup message',
			noFile: 'File attachments for rankup messages are not supported on Instagram'
		}
	},

	onStart: async function ({ args, message, event, threadsData, getLang }) {
		const { threadID } = event;
		switch (args[0]) {
			case 'text': {
				if (!args[1]) return message.reply(getLang('missingContent'));
				const newContent = args.slice(1).join(' ');
				const current = await threadsData.get(threadID, 'data.rankup');
				const rankup = (current && typeof current === 'object') ? current : {};
				rankup.message = newContent;
				await threadsData.set(threadID, rankup, 'data.rankup');
				return message.reply(getLang('changedMessage', newContent));
			}
			case 'reset': {
				await threadsData.set(threadID, null, 'data.rankup');
				return message.reply(getLang('reseted'));
			}
			case 'on': {
				const current = await threadsData.get(threadID, 'data.rankup');
				if (current === false) await threadsData.set(threadID, {}, 'data.rankup');
				return message.reply(getLang('turnedOn'));
			}
			case 'off': {
				await threadsData.set(threadID, false, 'data.rankup');
				return message.reply(getLang('turnedOff'));
			}
			case 'file':
			case 'image':
			case 'mp3':
			case 'video':
				return message.reply(getLang('noFile'));
			default:
				return message.SyntaxError();
		}
	}
};

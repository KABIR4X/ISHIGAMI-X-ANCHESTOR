'use strict';

// auto nickname for new members: set a template once, every newcomer gets
// it as their nickname. {userName} is their name, {userID} is their id.
function applyTemplate(template, uid, userName) {
	return String(template)
		.replace(/\{userName\}/gi, userName || '')
		.replace(/\{userID\}/gi, uid || '');
}

function addedIds(event) {
	const added = event.participantsAdded || event.addedParticipants || [];
	return added.map((p) => {
		if (typeof p === 'string') return { id: p, name: null };
		return { id: String(p.id || p.userID || p), name: p.username ? `@${p.username}` : (p.name || p.fullName || null) };
	});
}

module.exports = {
	config: {
		name: 'autosetname',
		version: '1.3',
		author: 'xemonbae01',
		countDown: 5,
		role: 1,
		description: { en: 'Auto change nickname of new member' },
		category: 'group',
		guide: { en: '   {pn} set <nickname>: use to set config to auto change nickname, with some shortcuts:'
			+ '\n   + {userName}: name of new member'
			+ '\n   + {userID}: member id'
			+ '\n   Example:'
			+ '\n    {pn} set {userName} 🚀'
			+ '\n\n   {pn} [on | off]: use to turn on/off this feature'
			+ '\n\n   {pn} [view | info]: show current config' }
	},

	langs: {
		en: {
			missingConfig: 'Please enter the required configuration',
			configSuccess: 'The configuration has been set successfully',
			currentConfig: 'The current autoSetName configuration in your chat group is:\n%1',
			notSetConfig: 'Your group has not set the autoSetName configuration',
			syntaxError: 'Syntax error, only "{pn} on" or "{pn} off" can be used',
			turnOnSuccess: 'The autoSetName feature has been turned on',
			turnOffSuccess: 'The autoSetName feature has been turned off',
			error: 'An error occurred while using the autoSetName feature, try turning off the invite link feature in the group and try again later'
		}
	},

	onStart: async function ({ message, event, args, threadsData, getLang }) {
		switch (args[0]) {
			case 'set':
			case 'add':
			case 'config': {
				if (args.length < 2) return message.reply(getLang('missingConfig'));
				await threadsData.set(event.threadID, args.slice(1).join(' '), 'data.autoSetName');
				return message.reply(getLang('configSuccess'));
			}
			case 'view':
			case 'info': {
				const configAutoSetName = await threadsData.get(event.threadID, 'data.autoSetName');
				const enabled = await threadsData.get(event.threadID, 'data.autoSetNameEnabled');
				const status = enabled ? '(on)' : '(off)';
				return message.reply(configAutoSetName
					? getLang('currentConfig', `${configAutoSetName} ${status}`)
					: getLang('notSetConfig'));
			}
			default: {
				const enableOrDisable = args[0];
				if (enableOrDisable !== 'on' && enableOrDisable !== 'off')
					return message.reply(getLang('syntaxError'));
				await threadsData.set(event.threadID, enableOrDisable === 'on', 'data.autoSetNameEnabled');
				return message.reply(enableOrDisable === 'on' ? getLang('turnOnSuccess') : getLang('turnOffSuccess'));
			}
		}
	},

	onEvent: async function ({ message, event, api, threadsData, usersData, getLang }) {
		const added = addedIds(event);
		if (!added.length) return;
		if ((await threadsData.get(event.threadID, 'data.autoSetNameEnabled')) !== true) return;
		const template = await threadsData.get(event.threadID, 'data.autoSetName');
		if (!template) return;
		for (const user of added) {
			const userName = user.name || await usersData.getName(user.id);
			try {
				await api.changeNickname(applyTemplate(template, user.id, userName), event.threadID, user.id);
			}
			catch {
				return message.reply(getLang('error'));
			}
		}
	}
};

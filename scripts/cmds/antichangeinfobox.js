'use strict';

// locks the box title and/or theme: when someone changes them, the bot
// puts the protected value back. ig only reports title and theme changes
// in thread_update events, so avatar / nickname / emoji locks can't work
// here — the client never tells us those changed.
// NOTE: thread_update carries no author, so every change gets reverted,
// even one made by an admin. turn the lock off first if you want to
// change the title or theme on purpose.
module.exports = {
	config: {
		name: 'antichangeinfobox',
		version: '1.9',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'Turn on/off anti change info box' },
		category: 'group',
		guide: { en: '   {pn} name [on | off]: anti change name box chat'
			+ '\n   {pn} theme [on | off]: anti change theme box chat'
			+ '\n   (avatar, nickname and emoji locks are not possible on Instagram — the client never reports those changes)' }
	},

	langs: {
		en: {
			antiChangeNameOn: 'Turn on anti change name box chat',
			antiChangeNameOff: 'Turn off anti change name box chat',
			antiChangeThemeOn: 'Turn on anti change theme box chat',
			antiChangeThemeOff: 'Turn off anti change theme box chat',
			antiChangeNameAlreadyOn: 'This box chat is currently on anti change name',
			antiChangeThemeAlreadyOn: 'This box chat is currently on anti change theme',
			notSupported: 'Instagram does not report %1 changes, so that lock cannot work here',
			missingName: 'This box chat has no title to protect yet — set one with -settitle first'
		}
	},

	onStart: async function ({ message, event, args, threadsData, api, getLang }) {
		if (!['on', 'off'].includes(args[1])) return message.SyntaxError();
		const { threadID } = event;
		const data = (await threadsData.get(threadID, 'data.antiChangeInfoBox')) || {};

		if (args[0] === 'name') {
			if (args[1] === 'off') {
				delete data.name;
				await threadsData.set(threadID, data, 'data.antiChangeInfoBox');
				return message.reply(getLang('antiChangeNameOff'));
			}
			const info = await api.getThreadInfo(threadID);
			const title = info && info.threadName;
			if (!title) return message.reply(getLang('missingName'));
			data.name = title;
			await threadsData.set(threadID, data, 'data.antiChangeInfoBox');
			return message.reply(getLang('antiChangeNameOn'));
		}

		if (args[0] === 'theme') {
			if (args[1] === 'off') {
				delete data.theme;
				await threadsData.set(threadID, data, 'data.antiChangeInfoBox');
				return message.reply(getLang('antiChangeThemeOff'));
			}
			let themeId = null;
			try {
				const client = api.rawClient;
				if (client && typeof client.getThreadTheme === 'function') {
					const current = await client.getThreadTheme(threadID);
					themeId = current ? String(current.id || current.themeId || current.theme_id || '') || null : null;
				}
			}
			catch { /* store null, revert will use the change's old value */ }
			data.theme = themeId;
			await threadsData.set(threadID, data, 'data.antiChangeInfoBox');
			return message.reply(getLang('antiChangeThemeOn'));
		}

		if (['avt', 'avatar', 'image', 'nickname', 'emoji'].includes(args[0]))
			return message.reply(getLang('notSupported', args[0]));

		return message.SyntaxError();
	},

	onEvent: async function ({ message, event, threadsData, api, getLang }) {
		const changes = event.changes || {};
		if (!changes.title && !changes.themeId) return;
		const data = (await threadsData.get(event.threadID, 'data.antiChangeInfoBox')) || {};

		if (changes.title && Object.prototype.hasOwnProperty.call(data, 'name')) {
			const protectedTitle = data.name;
			if (protectedTitle && changes.title.to !== protectedTitle) {
				await message.send(getLang('antiChangeNameAlreadyOn'));
				try { await api.changeThreadTitle(protectedTitle, event.threadID); }
				catch { /* revert failed, nothing else we can do */ }
			}
		}

		if (changes.themeId && Object.prototype.hasOwnProperty.call(data, 'theme')) {
			const protectedTheme = data.theme || changes.themeId.from;
			if (protectedTheme && String(changes.themeId.to) !== String(protectedTheme)) {
				await message.send(getLang('antiChangeThemeAlreadyOn'));
				try {
					const client = api.rawClient;
					if (client && typeof client.setChatTheme === 'function')
						await client.setChatTheme(event.threadID, String(protectedTheme));
				}
				catch { /* revert failed, nothing else we can do */ }
			}
		}
	}
};

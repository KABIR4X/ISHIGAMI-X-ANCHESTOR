'use strict';

// event script manager, the events twin of -cmd: load / unload / list
// event scripts at runtime, plus install one from a url or pasted code.
// overwriting an existing file needs a reaction confirm first.
const fs = require('fs');
const path = require('path');

const loadScripts = require('../../bot/login/loadScripts');

// axios is only needed to fetch code from a url, so load it on demand —
// the rest of this command works fine without it, and a missing install
// shouldn't kill the whole command
function loadAxios() {
	try {
		return require('axios');
	}
	catch {
		throw new Error('axios is not installed — run npm install first');
	}
}

const eventsDir = path.join(__dirname, '..', 'events');

function getDomain(url) {
	const regex = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n]+)/im;
	const match = url.match(regex);
	return match ? match[1] : null;
}

function isURL(str) {
	try {
		new URL(str);
		return true;
	}
	catch {
		return false;
	}
}

// savetext pages keep the code in #content; no cheerio on ig, a regex does it
function extractSavetext(html) {
	const m = String(html).match(/id=["']content["'][^>]*>([\s\S]*?)<\/(?:div|pre|textarea|code)>/i);
	if (!m) return null;
	return m[1]
		.replace(/<[^>]+>/g, '')
		.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
		.replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

// the loader only ships installCommand for cmds, so events get their own
// little version: write the file, install any missing packages, load it
function installEvent(fileName, rawCode) {
	if (!/^[A-Za-z0-9_-]+\.js$/.test(String(fileName))) throw new Error('invalid file name');
	if (!rawCode || !String(rawCode).trim()) throw new Error('empty code');
	fs.writeFileSync(path.join(eventsDir, fileName), String(rawCode));
	loadScripts.ensurePackages(rawCode);
	return loadScripts.loadOneEvent(fileName, true).name;
}

module.exports = {
	config: {
		name: 'event',
		version: '1.9',
		author: 'xemonbae01',
		countDown: 5,
		role: 2,
		description: { en: 'Manage your event command files' },
		category: 'admin',
		guide: { en: '{pn} load <event file name>'
			+ '\n{pn} loadAll'
			+ '\n{pn} unload <event name>'
			+ '\n{pn} list: show loaded event scripts'
			+ '\n{pn} install <url> <event file name>: Download and load event command, url is the path to the command file (raw)'
			+ '\n{pn} install <code> <event file name>: Download and load event command, code is the code of the command file (raw)' }
	},

	langs: {
		en: {
			missingFileName: '⚠️ | Please enter the event name you want to load',
			loaded: '✅ | Loaded event command "%1" successfully',
			loadedError: '❌ | Load event command "%1" failed with error\n%2: %3',
			loadedSuccess: '✅ | Loaded "%1" event command successfully',
			loadedFail: '❌ | Load failed event command "%1"\n%2',
			missingCommandNameUnload: '⚠️ | Please enter the event name you want to unload',
			unloaded: '✅ | Unloaded event command "%1" successfully',
			unloadedError: '❌ | Unload event command "%1" failed with error\n%2: %3',
			missingUrlCodeOrFileName: '⚠️ | Please enter the url or code and event file name you want to install',
			missingUrlOrCode: '⚠️ | Please enter the url or code of the event file you want to install',
			missingFileNameInstall: '⚠️ | Please enter the file name to save the event (with .js extension)',
			invalidUrl: '⚠️ | Enter a valid url',
			invalidUrlOrCode: '⚠️ | Unable to get event code',
			alreadExist: '⚠️ | Event file already exists, are you sure you want to overwrite the old event file?\nReact to this message to continue',
			installed: '✅ | Installed event command "%1" successfully, the event file is saved at %2',
			installedError: '❌ | Install event command "%1" failed with error\n%2: %3',
			missingFile: '⚠️ | File "%1" not found',
			invalidFileName: '⚠️ | Invalid file name',
			eventList: '📜 Loaded event scripts (%1):\n%2',
			noEvents: '⚠️ No event scripts are loaded'
		}
	},

	onStart: async function ({ args, message, event, getLang }) {
		const action = (args[0] || '').toLowerCase();

		if (action === 'list') {
			const report = loadScripts.getRegistryReport();
			const events = report.events || [];
			if (!events.length) return message.reply(getLang('noEvents'));
			const lines = events.map((e) => `• ${e.name} (${e.file})${e.shadowed ? ' — shadowed' : ''}`);
			return message.reply(getLang('eventList', events.length, lines.join('\n')));
		}

		if (action === 'load' && args.length === 2) {
			const name = (args[1] || '').toLowerCase();
			if (!name) return message.reply(getLang('missingFileName'));
			const file = `${name}.js`;
			if (!fs.existsSync(path.join(eventsDir, file)))
				return message.reply(getLang('missingFile', file));
			try {
				const loaded = loadScripts.loadOneEvent(file, true);
				return message.reply(getLang('loaded', loaded.name));
			}
			catch (err) {
				return message.reply(getLang('loadedError', name, err.name, err.message));
			}
		}

		if (action === 'loadall' || (action === 'load' && args.length > 2)) {
			const unloaded = (global.Anchestor.configCommands || {}).commandEventUnload || [];
			const fileNeedToLoad = action === 'loadall'
				? fs.readdirSync(eventsDir)
					.filter((file) =>
						file.endsWith('.js')
						&& !file.endsWith('.eg.js')
						&& (process.env.NODE_ENV === 'development' ? true : !file.endsWith('dev.js'))
						&& !unloaded.includes(file) && !unloaded.includes(file.replace(/\.js$/, '')))
					.map((file) => file.slice(0, -3))
				: args.slice(1);
			const ok = [];
			const failed = [];
			for (const fileName of fileNeedToLoad) {
				try {
					loadScripts.loadOneEvent(`${fileName}.js`, true);
					ok.push(fileName);
				}
				catch (err) {
					failed.push(`❗ ${fileName} => ${err.name}: ${err.message}`);
				}
			}
			let msg = '';
			if (ok.length) msg += getLang('loadedSuccess', ok.length);
			if (failed.length) msg += (msg ? '\n' : '') + getLang('loadedFail', failed.length, failed.join('\n'));
			return message.reply(msg || 'nothing to load');
		}

		if (action === 'unload') {
			const name = (args[1] || '').toLowerCase();
			if (!name) return message.reply(getLang('missingCommandNameUnload'));
			try {
				const removed = loadScripts.unloadEvent(name);
				return message.reply(getLang('unloaded', removed));
			}
			catch (err) {
				return message.reply(getLang('unloadedError', name, err.name, err.message));
			}
		}

		if (action === 'install') {
			let url = args[1];
			let fileName = args[2];
			let rawCode;

			if (!url || !fileName) return message.reply(getLang('missingUrlCodeOrFileName'));

			// install <file.js> <code...> — the url slot holds the file name
			if (url.endsWith('.js') && !isURL(url)) {
				const tmp = fileName;
				fileName = url;
				url = tmp;
			}

			if (url && url.match(/(https?:\/\/(?:www\.|(?!www)))/)) {
				if (!fileName || !fileName.endsWith('.js'))
					return message.reply(getLang('missingFileNameInstall'));
				const domain = getDomain(url);
				if (!domain) return message.reply(getLang('invalidUrl'));

				if (domain === 'pastebin.com') {
					const regex = /https:\/\/pastebin\.com\/(?!raw\/)(.*)/;
					if (url.match(regex)) url = url.replace(regex, 'https://pastebin.com/raw/$1');
					if (url.endsWith('/')) url = url.slice(0, -1);
				}
				else if (domain === 'github.com') {
					const regex = /https:\/\/github\.com\/(.*)\/blob\/(.*)/;
					if (url.match(regex)) url = url.replace(regex, 'https://raw.githubusercontent.com/$1/$2');
				}

				try {
					rawCode = (await loadAxios().get(url)).data;
				}
				catch (err) {
					return message.reply(getLang('invalidUrlOrCode') + ` (${err.message})`);
				}

				if (domain === 'savetext.net') {
					rawCode = extractSavetext(rawCode);
					if (!rawCode) return message.reply(getLang('invalidUrlOrCode'));
				}
			}
			else {
				if (args[args.length - 1].endsWith('.js')) {
					fileName = args[args.length - 1];
					rawCode = event.body.slice(event.body.indexOf('install') + 7, event.body.indexOf(fileName) - 1);
				}
				else if (args[1].endsWith('.js')) {
					fileName = args[1];
					rawCode = event.body.slice(event.body.indexOf(fileName) + fileName.length + 1);
				}
				else {
					return message.reply(getLang('missingFileNameInstall'));
				}
			}

			if (!rawCode || !String(rawCode).trim())
				return message.reply(getLang('invalidUrlOrCode'));
			if (!/^[A-Za-z0-9_-]+\.js$/.test(fileName))
				return message.reply(getLang('invalidFileName'));

			if (fs.existsSync(path.join(eventsDir, fileName))) {
				const info = await message.reply(getLang('alreadExist'));
				if (info && info.messageID) {
					global.Anchestor.onReaction.set(info.messageID, {
						commandName: 'event',
						messageID: info.messageID,
						threadID: event.threadID,
						senderID: event.senderID,
						type: 'install',
						fileName,
						rawCode: String(rawCode)
					});
				}
				return;
			}

			try {
				const installed = installEvent(fileName, String(rawCode));
				return message.reply(getLang('installed', installed, path.join('scripts', 'events', fileName)));
			}
			catch (err) {
				return message.reply(getLang('installedError', fileName, err.name, err.message));
			}
		}

		return message.SyntaxError();
	},

	onReaction: async function ({ message, event, onReaction, getLang }) {
		if (!onReaction || onReaction.type !== 'install') return;
		global.Anchestor.onReaction.delete(event.messageID);
		const { fileName, rawCode } = onReaction;
		try {
			const installed = installEvent(fileName, rawCode);
			return message.reply(getLang('installed', installed, path.join('scripts', 'events', fileName)));
		}
		catch (err) {
			return message.reply(getLang('installedError', fileName, err.name, err.message));
		}
	}
};

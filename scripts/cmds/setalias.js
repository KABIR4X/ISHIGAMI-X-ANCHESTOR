'use strict';

// custom aliases for commands, stored in globalData `setalias` and applied
// by the loader at boot (and right away when you add one). on ig there is
// no per-thread alias lookup in the handler, so aliases are global only —
// adding or removing one needs bot admin.
module.exports = {
	config: {
		name: 'setalias',
		version: '1.8',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'Add an alias for any command' },
		category: 'config',
		guide: { en: '  Add/remove a nickname for any command, usable everywhere'
			+ '\n   {pn} add <alias> <command>: add an alias for the command (bot admin only)'
			+ '\nExample:\n    {pn} add ctrk customrankcard'
			+ '\n\n   {pn} [remove | rm] <alias> <command>: remove an alias (bot admin only)'
			+ '\nExample:\n    {pn} rm ctrk customrankcard'
			+ '\n\n   {pn} list: list all custom aliases' }
	},

	langs: {
		en: {
			commandNotExist: '❌ Command "%1" does not exist',
			aliasExist: '❌ Alias "%1" already exists for command "%2" in the system',
			addAliasSuccess: '✅ Added alias "%1" for command "%2" in the system',
			noPermissionAdd: '❌ You do not have permission to add alias "%1" for command "%2" in the system',
			aliasIsCommand: '❌ Alias "%1" is the same as another command in the system',
			aliasNotExist: '❌ Alias "%1" does not exist for command "%2"',
			removeAliasSuccess: '✅ Removed alias "%1" for command "%2" in the system',
			noPermissionDelete: '❌ You do not have permission to remove alias "%1" for command "%2" in the system',
			aliasList: '📜 List of other aliases for commands in the system:\n%1',
			noAliasInSystem: '⚠️ There are no aliases in the system'
		}
	},

	onStart: async function ({ message, args, globalData, role, getLang }) {
		// the loader reads this key as a plain array of { commandName, aliases }
		const saved = (await globalData.get('setalias')) || [];
		const aliasesData = Array.isArray(saved) ? saved : [];

		switch (args[0]) {
			case 'add': {
				if (!args[2]) return message.SyntaxError();
				const alias = args[1].toLowerCase();
				const commandName = args[2].toLowerCase();
				const mod = global.Anchestor.commands.get(commandName)
					|| global.Anchestor.commands.get(global.Anchestor.aliases.get(commandName));
				if (!mod) return message.reply(getLang('commandNotExist', commandName));
				const realName = mod.config.name.toLowerCase();
				if (role < 2) return message.reply(getLang('noPermissionAdd', alias, realName));
				if (global.Anchestor.commands.has(alias))
					return message.reply(getLang('aliasIsCommand', alias));
				if (global.Anchestor.aliases.has(alias))
					return message.reply(getLang('aliasExist', alias, global.Anchestor.aliases.get(alias)));
				const clash = aliasesData.find((item) => item.aliases.includes(alias));
				if (clash) return message.reply(getLang('aliasExist', alias, clash.commandName));
				const entry = aliasesData.find((item) => item.commandName === realName);
				if (entry) entry.aliases.push(alias);
				else aliasesData.push({ commandName: realName, aliases: [alias] });
				await globalData.set('setalias', aliasesData);
				// live right away, no restart needed
				global.Anchestor.aliases.set(alias, mod.__registryKey || realName);
				return message.reply(getLang('addAliasSuccess', alias, realName));
			}
			case 'remove':
			case 'rm': {
				if (!args[2]) return message.SyntaxError();
				const alias = args[1].toLowerCase();
				const commandName = args[2].toLowerCase();
				const mod = global.Anchestor.commands.get(commandName)
					|| global.Anchestor.commands.get(global.Anchestor.aliases.get(commandName));
				if (!mod) return message.reply(getLang('commandNotExist', commandName));
				const realName = mod.config.name.toLowerCase();
				if (role < 2) return message.reply(getLang('noPermissionDelete', alias, realName));
				const entry = aliasesData.find((item) => item.commandName === realName);
				if (!entry || !entry.aliases.includes(alias))
					return message.reply(getLang('aliasNotExist', alias, realName));
				entry.aliases.splice(entry.aliases.indexOf(alias), 1);
				if (!entry.aliases.length) aliasesData.splice(aliasesData.indexOf(entry), 1);
				await globalData.set('setalias', aliasesData);
				global.Anchestor.aliases.delete(alias);
				return message.reply(getLang('removeAliasSuccess', alias, realName));
			}
			case 'list': {
				if (!aliasesData.length) return message.reply(getLang('noAliasInSystem'));
				const lines = aliasesData.map((item) => `• ${item.commandName}: ${item.aliases.join(', ')}`);
				return message.reply(getLang('aliasList', lines.join('\n')));
			}
			default:
				return message.SyntaxError();
		}
	}
};

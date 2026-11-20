'use strict';

// per-thread command roles: make a command admin-only in this thread, or
// open an admin command up to everyone here. role 2 (bot admin) commands
// can never be changed. overrides live in threadsData data.setRole.
// the handler reads data.setRole in its role gate, so these overrides
// take effect as soon as they are saved.
module.exports = {
	config: {
		name: 'setrole',
		version: '1.4',
		author: 'xemonbae01',
		countDown: 5,
		role: 1,
		description: { en: 'Edit role of command (commands with role < 2)' },
		category: 'config',
		guide: { en: '   {pn} <commandName> <new role>: set new role for command'
			+ '\n   With:'
			+ '\n   + <commandName>: command name'
			+ '\n   + <new role>: new role of command with:'
			+ '\n   + <new role> = 0: command can be used by all members in group'
			+ '\n   + <new role> = 1: command can be used by admin only'
			+ '\n   + <new role> = default: reset role of command to default'
			+ '\n   Example:'
			+ '\n    {pn} rank 1: (command rank can be used by admin only)'
			+ '\n    {pn} rank 0: (command rank can be used by all members in group)'
			+ '\n    {pn} rank default: reset to default'
			+ '\n—————'
			+ '\n   {pn} [viewrole|view|show]: view role of edited commands' }
	},

	langs: {
		en: {
			noEditedCommand: '✅ Your group has no edited command',
			editedCommand: '⚠️ Your group has edited commands:\n',
			noPermission: '❗ Only admin can use this command',
			commandNotFound: 'Command "%1" not found',
			noChangeRole: '❗ Can\'t change role of command "%1"',
			resetRole: 'Reset role of command "%1" to default',
			changedRole: 'Changed role of command "%1" to %2'
		}
	},

	onStart: async function ({ message, event, args, role, threadsData, getLang }) {
		const { commands, aliases } = global.Anchestor;
		const setRole = (await threadsData.get(event.threadID, 'data.setRole')) || {};

		if (['view', 'viewrole', 'show'].includes(args[0])) {
			if (!setRole || Object.keys(setRole).length === 0)
				return message.reply(getLang('noEditedCommand'));
			let msg = getLang('editedCommand');
			for (const cmd in setRole) msg += `- ${cmd} => ${setRole[cmd]}\n`;
			return message.reply(msg.trim());
		}

		const commandName = (args[0] || '').toLowerCase();
		let newRole = args[1];
		if (!commandName || (isNaN(newRole) && newRole !== 'default'))
			return message.SyntaxError();
		if (role < 1) return message.reply(getLang('noPermission'));

		const command = commands.get(commandName) || commands.get(aliases.get(commandName));
		if (!command) return message.reply(getLang('commandNotFound', commandName));
		const realName = command.config.name;
		if (command.config.role > 1) return message.reply(getLang('noChangeRole', realName));

		let isDefault = false;
		if (newRole === 'default' || Number(newRole) === command.config.role) {
			isDefault = true;
			newRole = command.config.role;
		}
		else {
			newRole = parseInt(newRole, 10);
		}

		if (isDefault) delete setRole[realName];
		else setRole[realName] = newRole;
		await threadsData.set(event.threadID, setRole, 'data.setRole');
		return message.reply('✅ ' + (isDefault
			? getLang('resetRole', realName)
			: getLang('changedRole', realName, newRole)));
	}
};

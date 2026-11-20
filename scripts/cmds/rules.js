'use strict';

// group rules, one list per thread. view them with no args (then reply
// with a number to see one rule up close), admins add/edit/move/delete.
const replyStore = require('../../bot/handler/replyStore');

module.exports = {
	config: {
		name: 'rules',
		version: '1.6',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'Create/view/add/edit/change position/delete group rules of you' },
		category: 'group',
		guide: { en: '   {pn} [add | -a] <rule to add>: add rule for group.'
			+ '\n   {pn}: view group rules.'
			+ '\n   {pn} [edit | -e] <n> <content after edit>: edit rule number n.'
			+ '\n   {pn} [move | -m] <stt1> <stt2> swap position of rule number <stt1> and <stt2>.'
			+ '\n   {pn} [delete | -d] <n>: delete rule number n.'
			+ '\n   {pn} [remove | -r]: delete all rules of group.'
			+ '\n'
			+ '\n   Example:'
			+ '\n    {pn} add don\'t spam'
			+ '\n    {pn} move 1 3'
			+ '\n    {pn} -e 1 don\'t spam message in group'
			+ '\n    {pn} -r' }
	},

	langs: {
		en: {
			yourRules: 'Your group rules\n%1',
			noRules: 'Your group has no rules, to add rules for group use `%1rules add`',
			noPermissionAdd: 'Only admins can add rules for group',
			noContent: 'Please enter the content for the rule you want to add',
			success: 'Added new rule for group successfully',
			noPermissionEdit: 'Only admins can edit group rules',
			invalidNumber: 'Please enter the number of the rule you want to edit',
			rulesNotExist: 'Rule number %1 does not exist',
			numberRules: 'Your group only has %1 rules',
			noContentEdit: 'Please enter the content you want to change for rule number %1',
			successEdit: 'Edited rule number %1 to: %2',
			noPermissionMove: 'Only admins can move group rules',
			invalidNumberMove: 'Please enter the number of 2 group rules you want to swap',
			sameNumberMove: 'Cannot swap position of 2 same rules',
			rulesNotExistMove2: 'Rule number %1 and %2 does not exist',
			successMove: 'Swapped position of rule number %1 and %2 successfully',
			noPermissionDelete: 'Only admins can delete group rules',
			invalidNumberDelete: 'Please enter the number of the rule you want to delete',
			rulesNotExistDelete: 'Rule number %1 does not exist',
			successDelete: 'Deleted rule number %1 of group, content: %2',
			noPermissionRemove: 'Only group admins can remove all group rules',
			confirmRemove: '⚠️ React to this message with any emoji to confirm remove all group rules',
			successRemove: 'Removed all group rules successfully',
			invalidNumberView: 'Please enter the number of the rule you want to view'
		}
	},

	onStart: async function ({ role, args, message, event, threadsData, getLang, commandName, prefix }) {
		const { threadID, senderID } = event;
		const type = args[0];
		const rulesOfThread = (await threadsData.get(threadID, 'data.rules')) || [];
		const totalRules = rulesOfThread.length;
		const countNote = totalRules === 0
			? getLang('noRules', prefix)
			: getLang('numberRules', totalRules);

		if (!type) {
			let i = 1;
			const msg = rulesOfThread.reduce((text, rule) => text += `${i++}. ${rule}\n`, '');
			const info = await message.reply(msg ? getLang('yourRules', msg) : getLang('noRules', prefix));
			if (info && info.messageID && rulesOfThread.length) {
				replyStore.setEntry(info.messageID, {
					commandName,
					author: senderID,
					threadID,
					data: { rulesOfThread }
				});
			}
			return;
		}
		else if (['add', '-a'].includes(type)) {
			if (role < 1) return message.reply(getLang('noPermissionAdd'));
			if (!args[1]) return message.reply(getLang('noContent'));
			rulesOfThread.push(args.slice(1).join(' '));
			await threadsData.set(threadID, rulesOfThread, 'data.rules');
			return message.reply(getLang('success'));
		}
		else if (['edit', '-e'].includes(type)) {
			if (role < 1) return message.reply(getLang('noPermissionEdit'));
			const stt = parseInt(args[1], 10);
			if (isNaN(stt)) return message.reply(getLang('invalidNumber'));
			if (!rulesOfThread[stt - 1])
				return message.reply(`${getLang('rulesNotExist', stt)}, ${countNote}`);
			if (!args[2]) return message.reply(getLang('noContentEdit', stt));
			const newContent = args.slice(2).join(' ');
			rulesOfThread[stt - 1] = newContent;
			await threadsData.set(threadID, rulesOfThread, 'data.rules');
			return message.reply(getLang('successEdit', stt, newContent));
		}
		else if (['move', '-m'].includes(type)) {
			if (role < 1) return message.reply(getLang('noPermissionMove'));
			const num1 = parseInt(args[1], 10);
			const num2 = parseInt(args[2], 10);
			if (isNaN(num1) || isNaN(num2)) return message.reply(getLang('invalidNumberMove'));
			if (num1 === num2) return message.reply(getLang('sameNumberMove'));
			if (!rulesOfThread[num1 - 1] || !rulesOfThread[num2 - 1]) {
				if (!rulesOfThread[num1 - 1] && !rulesOfThread[num2 - 1])
					return message.reply(`${getLang('rulesNotExistMove2', num1, num2)}, ${countNote}`);
				const missing = !rulesOfThread[num1 - 1] ? num1 : num2;
				return message.reply(`${getLang('rulesNotExist', missing)}, ${countNote}`);
			}
			[rulesOfThread[num1 - 1], rulesOfThread[num2 - 1]] = [rulesOfThread[num2 - 1], rulesOfThread[num1 - 1]];
			await threadsData.set(threadID, rulesOfThread, 'data.rules');
			return message.reply(getLang('successMove', num1, num2));
		}
		else if (['delete', 'del', '-d'].includes(type)) {
			if (role < 1) return message.reply(getLang('noPermissionDelete'));
			if (!args[1] || isNaN(args[1])) return message.reply(getLang('invalidNumberDelete'));
			const ruleDel = rulesOfThread[parseInt(args[1], 10) - 1];
			if (!ruleDel)
				return message.reply(`${getLang('rulesNotExistDelete', args[1])}, ${countNote}`);
			rulesOfThread.splice(parseInt(args[1], 10) - 1, 1);
			await threadsData.set(threadID, rulesOfThread, 'data.rules');
			return message.reply(getLang('successDelete', args[1], ruleDel));
		}
		else if (['remove', 'reset', '-r', '-rm'].includes(type)) {
			if (role < 1) return message.reply(getLang('noPermissionRemove'));
			const info = await message.reply(getLang('confirmRemove'));
			if (info && info.messageID) {
				global.Anchestor.onReaction.set(info.messageID, {
					commandName: 'rules',
					messageID: info.messageID,
					threadID,
					senderID
				});
			}
			return;
		}
		else if (!isNaN(type)) {
			let msg = '';
			for (const stt of args) {
				const rule = rulesOfThread[parseInt(stt, 10) - 1];
				if (rule) msg += `${stt}. ${rule}\n`;
			}
			if (msg === '')
				return message.reply(`${getLang('rulesNotExist', type)}, ${countNote}`);
			return message.reply(msg);
		}
		else {
			return message.SyntaxError();
		}
	},

	// reply to the rules list with a number to see that one rule
	onReply: async function ({ message, event, getLang, onReply, Reply }) {
		const rulesOfThread = (onReply.data && onReply.data.rulesOfThread) || onReply.rulesOfThread || [];
		const num = parseInt((event.body || '').trim(), 10);
		if (isNaN(num) || num < 1) {
			Reply.keep();
			return message.reply(getLang('invalidNumberView'));
		}
		const totalRules = rulesOfThread.length;
		if (num > totalRules) {
			Reply.keep();
			return message.reply(`${getLang('rulesNotExist', num)}, ${totalRules === 0 ? getLang('noRules') : getLang('numberRules', totalRules)}`);
		}
		Reply.end();
		await message.reply(`${num}. ${rulesOfThread[num - 1]}`);
		try { await message.unsend(onReply.messageID); } catch { /* prompt may already be gone */ }
		return true;
	},

	onReaction: async function ({ threadsData, message, onReaction, event, getLang }) {
		global.Anchestor.onReaction.delete(event.messageID);
		await threadsData.set(onReaction.threadID, [], 'data.rules');
		return message.reply(getLang('successRemove'));
	}
};

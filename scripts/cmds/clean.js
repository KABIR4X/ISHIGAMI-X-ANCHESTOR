'use strict';

// clears junk files out of the bot's downloads folder (the ig temp dir).
// reply Y for the standard sweep, N to pick your own extensions.
const fs = require('fs');
const path = require('path');

const replyStore = require('../../bot/handler/replyStore');

const downloadsDir = path.join(__dirname, '..', '..', 'downloads');
const DEFAULT_TYPES = ['png', 'jpg', 'mp4', 'jpeg', 'gif', 'm4a', 'txt', 'mp3', 'wav', 'json', 'heic', 'mov', 'pdf'];

async function cleanDownloads(extensions) {
	let deletedCount = 0;
	let errorCount = 0;
	try {
		if (!fs.existsSync(downloadsDir)) {
			fs.mkdirSync(downloadsDir, { recursive: true });
			return { deletedCount: 0, errorCount: 0 };
		}
		const wanted = new Set(extensions.map((e) => String(e).toLowerCase().replace(/^\./, '')));
		const files = fs.readdirSync(downloadsDir);
		for (const file of files) {
			const full = path.join(downloadsDir, file);
			if (!fs.statSync(full).isFile()) continue; // never touch subfolders
			if (file === '.gitkeep') continue;
			const ext = path.extname(file).slice(1).toLowerCase();
			if (!wanted.has(ext)) continue;
			try {
				fs.unlinkSync(full);
				deletedCount++;
			}
			catch (err) {
				global.utils.log.error('CLEAN', `could not delete ${file}: ${err.message}`);
				errorCount++;
			}
		}
		return { deletedCount, errorCount };
	}
	catch (err) {
		global.utils.log.error('CLEAN', err.message);
		return { deletedCount: 0, errorCount: 1 };
	}
}

module.exports = {
	config: {
		name: 'clean',
		version: '1.0.0',
		author: 'xemonbae01',
		countDown: 5,
		role: 2,
		description: { en: 'Cleans junk files from the bot\'s downloads directory to free up space.' },
		category: 'admin',
		guide: { en: '   • `clean`: Starts the cache cleaning process.\n   • The bot will ask if you want an automatic or custom cleanup.\n      - Reply \'Y\' for automatic cleanup.\n      - Reply \'N\' for custom cleanup.\n   • If you choose \'N\', the bot will ask you to enter the file extensions to delete (e.g., mp3 jpg png).' }
	},

	onStart: async function ({ message, event, commandName }) {
		const info = await message.reply(
			'🗑️ Do you want automatic (all) downloads cleanup or custom file types?\n\n'
			+ '👉 Reply \'Y\' for automatic cleanup.\n'
			+ '👉 Reply \'N\' to select file types to delete.'
		);
		if (info && info.messageID) {
			replyStore.setEntry(info.messageID, {
				commandName,
				author: event.senderID,
				threadID: event.threadID,
				data: { step: 'initial_choice' }
			});
		}
	},

	onReply: async function ({ message, event, onReply, Reply, commandName }) {
		const step = (onReply.data && onReply.data.step) || onReply.step;
		try { await message.unsend(onReply.messageID); } catch { /* prompt may already be gone */ }

		if (step === 'initial_choice') {
			const choice = (event.body || '').trim().toLowerCase();
			if (choice === 'y' || choice === 'yes') {
				Reply.end();
				await message.reply('⏳ Starting automatic cleanup...');
				const result = await cleanDownloads(DEFAULT_TYPES);
				await message.reply(`✅ Cleanup completed!\n   - Deleted: ${result.deletedCount} files.\n   - Errors: ${result.errorCount} files.`);
				return true;
			}
			if (choice === 'n' || choice === 'no') {
				Reply.end();
				const info = await message.reply('📌 Please reply with the file extensions you want to delete, separated by spaces.\n\nExample: mp3 mp4 jpg');
				if (info && info.messageID) {
					replyStore.setEntry(info.messageID, {
						commandName,
						author: event.senderID,
						threadID: event.threadID,
						data: { step: 'custom_choice' }
					});
				}
				return true;
			}
			Reply.keep();
			await message.reply('⚠️ Invalid choice. Please reply with \'Y\' or \'N\'.');
			return true;
		}

		if (step === 'custom_choice') {
			const customTypes = (event.body || '').toLowerCase().split(/\s+/).filter((t) => t.trim() !== '');
			if (!customTypes.length) {
				Reply.keep();
				await message.reply('⚠️ No file types provided. Please try again.');
				return true;
			}
			Reply.end();
			await message.reply(`⏳ Starting cleanup for file types: ${customTypes.join(', ')}...`);
			const result = await cleanDownloads(customTypes);
			await message.reply(`✅ Cleanup completed!\n   - Deleted: ${result.deletedCount} files.\n   - Errors: ${result.errorCount} files.`);
			return true;
		}
		return true;
	}
};

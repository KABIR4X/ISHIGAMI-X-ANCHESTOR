'use strict';

// snapshots users, threads and global data into one backup file under
// database/data/ (gitignored *.bak pattern lives there too, but this is a
// dated .json so it never gets confused with the live files).
const fs = require('fs');
const path = require('path');

module.exports = {
	config: {
		name: 'backupdata',
		version: '1.3',
		author: 'xemonbae01',
		countDown: 5,
		role: 2,
		description: { en: 'Backup data of bot (threads, users, globalData)' },
		category: 'admin',
		guide: { en: '   {pn}' }
	},

	langs: {
		en: {
			backedUp: 'Bot data has been backed up to database/data/%1\n• %2 users\n• %3 threads\n• %4 global keys'
		}
	},

	onStart: async function ({ message, getLang, threadsData, usersData, globalData }) {
		const [globalDataBackup, threadsDataBackup, usersDataBackup] = await Promise.all([
			globalData.getAll ? globalData.getAll() : (global.db.allGlobalData || {}),
			threadsData.getAll(),
			usersData.getAll()
		]);

		const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		const dir = path.join(__dirname, '..', '..', 'database', 'data');
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		const fileName = `backup-${stamp}.json`;
		const filePath = path.join(dir, fileName);
		fs.writeFileSync(filePath, JSON.stringify({
			createdAt: new Date().toISOString(),
			users: usersDataBackup,
			threads: threadsDataBackup,
			global: globalDataBackup
		}, null, 2));

		const countUsers = Array.isArray(usersDataBackup) ? usersDataBackup.length : Object.keys(usersDataBackup || {}).length;
		const countThreads = Array.isArray(threadsDataBackup) ? threadsDataBackup.length : Object.keys(threadsDataBackup || {}).length;
		const countGlobal = Array.isArray(globalDataBackup) ? globalDataBackup.length : Object.keys(globalDataBackup || {}).length;
		return message.reply(getLang('backedUp', fileName, countUsers, countThreads, countGlobal));
	}
};

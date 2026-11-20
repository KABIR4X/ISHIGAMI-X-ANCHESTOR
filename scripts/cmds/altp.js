'use strict';

// who wants to be a millionaire — quiz game with two modes, a 30 second
// timer per question and money rewards. questions live in Game/altp.json
// next to this file (vietnamese quiz data, same as elite).
//
// elite bug fixed here: elite's level keys (easy/normal/hard/superhard)
// don't exist in altp.json — the real keys are de/binhthuong/kho/sieukho,
// so the elite game crashed on the first question. the mapping below is
// what makes it actually work.

const replyStore = require('../../bot/handler/replyStore');
const quizData = require('./Game/altp.json');

const QUESTION_TIME = 30 * 1000;
const spamLock = new Map();

const LEVELS = [
	{ key: 'de', label: 'Easy' },
	{ key: 'normal', label: 'Normal', fileKey: 'binhthuong' },
	{ key: 'hard', label: 'Hard', fileKey: 'kho' },
	{ key: 'superhard', label: 'Super Hard', fileKey: 'sieukho' }
];
function pickQuestion(levelIndex) {
	const lv = LEVELS[levelIndex];
	const fileKey = lv.fileKey || lv.key;
	const pool = quizData[fileKey] || [];
	if (!pool.length) return null;
	return { question: pool[Math.floor(Math.random() * pool.length)], label: lv.label };
}

function pickRandomQuestion() {
	return pickQuestion(Math.floor(Math.random() * LEVELS.length));
}

async function addMoney(usersData, userID, amount) {
	const cur = Number(await usersData.get(userID, 'money')) || 0;
	await usersData.set(userID, cur + amount, 'money');
}

async function askQuestion({ message, event, payload, picked }) {
	const q = picked.question;
	const info = await message.reply(
		`❓ Question (${picked.label}):\n${q.cauhoi}\n\n` +
		`A. ${q.A}\nB. ${q.B}\nC. ${q.C}\nD. ${q.D}\n\n⏱️ You have 30 seconds.`
	);
	if (info && info.messageID) {
		replyStore.setEntry(info.messageID, {
			commandName: 'altp',
			threadID: event.threadID,
			author: event.senderID,
			data: { ...payload, question: q, sentTime: Date.now() }
		});
	}
}

module.exports = {
	config: {
		name: 'altp',
		version: '2.0.0',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'Who Wants to Be a Millionaire quiz game' },
		category: 'game',
		guide: { en: '   {pn} — pick a mode, then reply with A, B, C or D (type "stop" to quit)' }
	},

	onStart: async function ({ message, event }) {
		const info = await message.reply(
			'\n🎉 Welcome to WHO WANTS TO BE A MILLIONAIRE 🎉\n\n' +
			'Choose a game mode:\n\n' +
			'1️⃣ Random Questions\n' +
			'• +100,000 per correct answer\n' +
			'• Win at 10 correct answers\n\n' +
			'2️⃣ Ordered Difficulty\n' +
			'• Easy → Normal → Hard → Super Hard\n' +
			'• 3 correct answers per level\n' +
			'• Final reward: 3,000,000\n\n' +
			'Type "stop" to quit.'
		);
		if (info && info.messageID) {
			replyStore.setEntry(info.messageID, {
				commandName: 'altp',
				threadID: event.threadID,
				author: event.senderID,
				data: { type: 'chooseMode', score: 0, level: 0, correctInLevel: 0 }
			});
		}
	},

	onReply: async function ({ message, event, onReply, Reply, usersData }) {
		const data = (onReply && onReply.data) || {};
		const body = (event.body || '').trim();

		// mode picker
		if (data.type === 'chooseMode') {
			const mode = parseInt(body, 10);
			if (mode !== 1 && mode !== 2) {
				Reply.keep();
				await message.reply('❌ Please choose 1 or 2.');
				return true;
			}
			const picked = pickRandomQuestion();
			if (!picked) {
				await message.reply('❌ No questions available right now.');
				return true;
			}
			await askQuestion({
				message, event,
				payload: {
					type: mode === 1 ? 'random' : 'ordered',
					score: 0, level: 0, correctInLevel: 0
				},
				picked
			});
			return true;
		}

		// answering a question
		if (body.toLowerCase() === 'stop') {
			await message.reply('⛔ Game stopped. Thanks for playing!');
			return true;
		}

		if (Date.now() - (data.sentTime || 0) > QUESTION_TIME) {
			await message.reply('⏰ Time is up! You failed to answer in time.');
			return true;
		}

		if (spamLock.has(event.senderID)) return true;
		spamLock.set(event.senderID, true);
		setTimeout(() => spamLock.delete(event.senderID), 1500);

		const userAnswer = body.toUpperCase();
		const correct = String(data.question.dapan || '').toUpperCase();

		if (userAnswer !== correct) {
			await addMoney(usersData, event.senderID, -100000);
			await message.reply(
				`❌ Wrong answer.\nCorrect answer: ${correct}\n${data.question.giaithich}\n-100,000`
			);
			return true;
		}

		const score = (data.score || 0) + 1;

		if (data.type === 'random') {
			await addMoney(usersData, event.senderID, 100000);
			if (score === 10) {
				await addMoney(usersData, event.senderID, 1000000);
				await message.reply('🏆 Congratulations! You won 1,000,000!');
				return true;
			}
			const picked = pickRandomQuestion();
			if (!picked) {
				await message.reply('❌ No questions available right now.');
				return true;
			}
			await askQuestion({ message, event, payload: { type: 'random', score }, picked });
			return true;
		}

		// ordered mode
		let correctInLevel = (data.correctInLevel || 0) + 1;
		let level = data.level || 0;

		if (correctInLevel === 3) {
			await addMoney(usersData, event.senderID, 200000 * (level + 1));
			correctInLevel = 0;
			level++;

			if (level === LEVELS.length) {
				await addMoney(usersData, event.senderID, 3000000);
				await message.reply('🏆 You completed all levels and won 3,000,000!');
				return true;
			}
		}

		const picked = pickQuestion(level);
		if (!picked) {
			await message.reply('❌ No questions available right now.');
			return true;
		}
		await askQuestion({
			message, event,
			payload: { type: 'ordered', score, level, correctInLevel },
			picked
		});
		return true;
	}
};

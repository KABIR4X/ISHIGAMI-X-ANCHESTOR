'use strict';

// multiplayer tai xiu — one table per thread. the table owner creates it,
// everyone bets by just typing `tai 100` / `xiu all` / `t 50%` in chat,
// the owner rolls with `-txiu roll`. tables auto-cancel after 5 idle minutes.
//
// dropped from elite: the `hack` subcommand + admin dice preview — it needs
// api.getThreadList and fb-style dms by user id, neither exists on ig.
// dice are emoji here instead of elite's 216 tximg jpgs.
const rate = 1;
const minBet = 50;
const rollDelaySec = 10;
const selectText = { t: 'Tai', x: 'Xiu' };
const unitZeros = { b: 18, kb: 21, mb: 24, gb: 27, k: 12, m: 15, g: 36 };
const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// tables live on global so a `cmd reload txiu` keeps running games alive
let tables = global.data_command_ban_tai_xiu;
if (!tables) tables = global.data_command_ban_tai_xiu = {};
if (!tables.s) tables.s = {};
if (!tables.t) {
	tables.t = setInterval(() => {
		for (const [id, until] of Object.entries(tables.s))
			if (until <= Date.now()) delete tables.s[id];
	}, 1000);
	if (tables.t.unref) tables.t.unref();
}

function randomDice() { return (Math.random() * 6 + 1) << 0; }
function rollDices() { return [0, 0, 0].map(randomDice); }
function sumDices(d) { return d[0] + d[1] + d[2]; }

async function getMoney(usersData, uid) {
	const data = await usersData.get(uid);
	return Number(data.money) || 0;
}

async function addMoney(usersData, uid, amount) {
	const current = await getMoney(usersData, uid);
	await usersData.set(uid, { money: current + amount });
}

async function subtractMoney(usersData, uid, amount) {
	const current = await getMoney(usersData, uid);
	await usersData.set(uid, { money: Math.max(0, current - amount) });
}

async function isThreadAdmin(event, threadsData, uid) {
	const ids = event.adminIDs && event.adminIDs.length
		? event.adminIDs
		: ((await threadsData.get(event.threadID)).adminIDs || []);
	return ids.map(String).includes(String(uid));
}

async function askEndVote({ message, usersData, table, tid }) {
	const p = table.players;
	const names = await Promise.all(p.map((pl) => usersData.getName(pl.id)));
	const msg = 'A group admin asked to end this tai xiu table — players react to confirm.\n\n'
		+ names.map((n, i) => `${i + 1}. ${n || p[i].id}`).join('\n')
		+ `\n\n${Math.ceil(p.length * 50 / 100)}/${p.length} reactions ends the table.`;
	const info = await message.reply(msg);
	if (info && info.messageID) {
		global.Anchestor.onReaction.set(info.messageID, {
			commandName: 'txiu',
			messageID: info.messageID,
			type: 'end.vote',
			p,
			r: 0,
			voters: [],
			tid
		});
	}
}

module.exports = {
	config: {
		name: 'txiu',
		version: '2.0.0',
		author: 'xemonbae01',
		countDown: 3,
		role: 0,
		description: { en: 'multiplayer tai xiu dice game — create a table, bet in chat, roll' },
		category: 'game',
		guide: { en: '   {pn} create: open a table in this thread'
			+ '\n   tai|xiu <amount|all|50%>: bet (just type it, no prefix)'
			+ '\n   {pn} roll: roll the dice (table owner only)'
			+ '\n   info: show the table | leave: leave the table'
			+ '\n   {pn} end: group admin asks players to vote-end the table' }
	},

	onStart: async function ({ api, event, args, message, threadsData, usersData }) {
		const sid = String(event.senderID);
		const tid = String(event.threadID);
		const sub = (args[0] || '').toLowerCase();

		if (['create', 'c', '-c'].includes(sub)) {
			if (tid in tables) return message.reply('This group already has a tai xiu table!');
			if (sid in tables.s) {
				const x = tables.s[sid] - Date.now();
				const mins = (x / 1000 / 60) << 0;
				const secs = ((x / 1000) % 60) << 0;
				return message.reply(`Come back in ${mins}m${secs}s`);
			}
			tables.s[sid] = Date.now() + 1000 * 60 * 5;
			tables[tid] = {
				author: sid,
				players: [],
				playing: false,
				set_timeout: setTimeout(() => {
					delete tables[tid];
					api.sendMessage(tid, '⛔ 5 minutes passed with no roll — table cancelled').catch(() => {});
				}, 1000 * 60 * 5)
			};
			return message.reply('Tai xiu table created — place your bets!');
		}

		if (sub === 'roll') {
			if (!(tid in tables)) return message.reply('No table in this group yet');
			if (tables[tid].author !== sid) return message.reply('You are not the table owner');
			if (tables[tid].players.length === 0) return message.reply('Nobody has placed a bet yet');
			await this._roll({ api, event, message, usersData });
			return;
		}

		if (sub === 'end') {
			if (!(tid in tables)) return message.reply('No table in this group yet');
			if (await isThreadAdmin(event, threadsData, sid)) {
				await askEndVote({ message, usersData, table: tables[tid], tid });
				return;
			}
			return message.reply('Only a group admin can do that');
		}

		return message.SyntaxError();
	},

	onChat: async function ({ api, event, message, usersData, threadsData }) {
		const sid = String(event.senderID);
		const tid = String(event.threadID);
		const body = event.body || '';
		const tokens = body.trim().split(/\s+/);
		const first = (tokens[0] || '').toLowerCase();
		const select = /^(tài|tai|t)$/.test(first) ? 't'
			: /^(xỉu|xiu|x)$/.test(first) ? 'x'
				: /^(leave)$/.test(first) ? 'l'
					: /^(info|stt)$/.test(first) ? 'i'
						: /^(end|remove)$/.test(first) ? 'r' : null;

		if (!(tid in tables) || select === null) return;
		const p = tables[tid].players;

		if (tables[tid].playing === true) {
			await message.send('Rolling — betting is paused');
			return true;
		}

		// bet
		if (select === 't' || select === 'x') {
			const betToken = tokens[1];
			if (!betToken) {
				await message.send('Missing bet amount');
				return true;
			}
			const currentMoney = await getMoney(usersData, sid);
			let bet = null;
			if (/^(allin|all)$/i.test(betToken)) bet = currentMoney;
			else if (/^[0-9]+%$/.test(betToken)) bet = Math.floor(currentMoney * (parseInt(betToken, 10) / 100));
			else {
				const match = betToken.match(/^([0-9]+)([a-z]+)?$/i);
				if (match) {
					const unit = (match[2] || '').toLowerCase();
					bet = Number(match[1]);
					if (unit) {
						if (!(unit in unitZeros)) bet = NaN;
						else bet *= 10 ** unitZeros[unit];
					}
				}
				else bet = NaN;
			}
			if (!isFinite(bet)) {
				await message.send('Invalid bet amount');
				return true;
			}
			if (bet < minBet) {
				await message.send(`Minimum bet is ${minBet.toLocaleString()}$`);
				return true;
			}
			if (bet > currentMoney) {
				await message.send(`Not enough money — you are short ${(bet - currentMoney).toLocaleString()}$`);
				return true;
			}

			const existing = p.find(($) => String($.id) === sid);
			if (existing) {
				const old = existing.bet_money;
				existing.select = select;
				existing.bet_money = bet;
				await message.send(`Changed bet from ${selectText[existing.select]} ${old.toLocaleString()}$ to ${selectText[select]} ${bet.toLocaleString()}$`);
				return true;
			}
			p.push({ id: sid, select, bet_money: bet });
			await message.send(`You bet ${selectText[select]} with ${bet.toLocaleString()}$`);
			return true;
		}

		// leave
		if (select === 'l') {
			if (sid === tables[tid].author) {
				clearTimeout(tables[tid].set_timeout);
				delete tables[tid];
				await message.send('Table owner left — table cancelled');
				return true;
			}
			const idx = p.findIndex(($) => String($.id) === sid);
			if (idx !== -1) {
				p.splice(idx, 1);
				await message.send('You left the table');
				return true;
			}
			await message.send('❎ You are not in this tai xiu table');
			return true;
		}

		// info
		if (select === 'i') {
			const names = await Promise.all(p.map((pl) => usersData.getName(pl.id)));
			const owner = await usersData.getName(tables[tid].author);
			const bodyMsg = '[ Tai Xiu Table ]\n'
				+ `Total ${p.length} players:\n`
				+ p.map((pl, i) => ` ${i + 1}. ${names[i] || pl.id} bet ${pl.bet_money.toLocaleString()}$ on (${selectText[pl.select]})`).join('\n')
				+ `\nTable owner: ${owner || tables[tid].author}`;
			await message.send(bodyMsg);
			return true;
		}

		// end vote, group admin only
		if (select === 'r') {
			if (await isThreadAdmin(event, threadsData, sid))
				await askEndVote({ message, usersData, table: tables[tid], tid });
			return true;
		}
	},

	onReaction: async function ({ event, message, onReaction }) {
		const data = onReaction || {};
		if (data.type !== 'end.vote') return;
		const tid = String(data.tid);
		if (!(tid in tables)) {
			global.Anchestor.onReaction.delete(event.messageID);
			await message.reply('❎ The tai xiu table already ended — cannot vote anymore');
			return;
		}
		const userID = String(event.senderID);
		if (!data.p.some(($) => String($.id) === userID)) return;
		// one vote per player — elite counted every reaction, so one person
		// spamming reactions could end the table alone
		if (!data.voters) data.voters = [];
		if (data.voters.includes(userID)) return;
		data.voters.push(userID);
		data.r = data.voters.length;
		await message.reply(`📌 ${data.r}/${data.p.length} votes`);
		if (data.r >= Math.ceil(data.p.length * 50 / 100)) {
			clearTimeout(tables[tid].set_timeout);
			delete tables[tid];
			global.Anchestor.onReaction.delete(event.messageID);
			await message.reply('✅ Tai xiu table ended');
		}
	},

	// internal: execute the roll
	_roll: async function ({ api, event, message, usersData }) {
		const tid = String(event.threadID);
		const table = tables[tid];
		if (!table) return;
		table.playing = true;
		const rolling = await api.sendMessage(tid, 'Rolling!!!').catch(() => null);

		const dices = rollDices();
		const sum = sumDices(dices);
		const winner = sum > 10 ? 't' : 'x';

		await new Promise((r) => setTimeout(r, 1000 * rollDelaySec));
		if (rolling && rolling.messageID)
			api.unsendMessage(rolling.messageID, tid).catch(() => {});

		const winnerPlayers = table.players.filter(($) => $.select === winner);
		const losePlayers = table.players.filter(($) => $.select !== winner);

		const ownerName = await usersData.getName(table.author) || table.author;
		const winLines = [];
		for (const $ of winnerPlayers) {
			const inc = $.bet_money * rate;
			await addMoney(usersData, $.id, inc);
			const name = await usersData.getName($.id) || $.id;
			winLines.push(` ${name}: +${inc.toLocaleString()}$`);
		}
		const loseLines = [];
		for (const $ of losePlayers) {
			await subtractMoney(usersData, $.id, $.bet_money);
			const name = await usersData.getName($.id) || $.id;
			loseLines.push(` ${name}: -${$.bet_money.toLocaleString()}$`);
		}

		await api.sendMessage(tid,
			`🎲 ${dices.map((d) => DICE_FACES[d - 1]).join(' ')} — ${sum} points\n`
			+ `Result: ${selectText[winner]}\n`
			+ `Winners:\n${winLines.join('\n') || 'None'}\n`
			+ `Losers:\n${loseLines.join('\n') || 'None'}\n`
			+ `Table owner: ${ownerName}`
		).catch(() => {});

		clearTimeout(table.set_timeout);
		delete tables[tid];
	}
};

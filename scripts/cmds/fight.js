'use strict';

// turn-based duel: challenge someone, then take turns typing attacks.
// the fight lives in memory, one per thread, and times out after 2
// minutes of silence (most HP left wins the timeout).

const { resolveTargets } = require('./_ig/targets');

const TIMEOUT_SECONDS = 120;
const ongoingFights = new Map();
const gameInstances = new Map();

const MOVES = {
	kick: { min: 10, max: 20 },
	punch: { min: 5, max: 15 },
	slap: { min: 1, max: 5 },
	headbutt: { min: 15, max: 25 },
	elbow: { min: 8, max: 18 },
	uppercut: { min: 12, max: 22 },
	'roundhouse kick': { min: 18, max: 30 },
	'jump hit': { min: 10, max: 25 },
	backslash: { min: 20, max: 35 },
	'flying kick': { min: 15, max: 30 },
	'knee strike': { min: 8, max: 18 }
};
const MOVE_LIST = Object.keys(MOVES).join(', ');

function startFight(message, fight) {
	ongoingFights.set(fight.threadID, fight);
	const currentPlayer = fight.participants.find((p) => p.id === fight.currentPlayer);
	const opponent = fight.participants.find((p) => p.id !== fight.currentPlayer);
	message.send(
		`${currentPlayer.name} has challenged ${opponent.name} to a duel!\n\n` +
		`${currentPlayer.name} has ${currentPlayer.hp} HP, and ${opponent.name} has ${opponent.hp} HP.\n\n` +
		`It's ${currentPlayer.name}'s turn currently.\n\nAvailable attacks: ${MOVE_LIST}`
	);
}

function startTimeout(threadID, message) {
	const timeoutID = setTimeout(() => {
		const gameInstance = gameInstances.get(threadID);
		if (!gameInstance) return;
		const currentPlayer = gameInstance.fight.participants.find((p) => p.id === gameInstance.fight.currentPlayer);
		const opponent = gameInstance.fight.participants.find((p) => p.id !== gameInstance.fight.currentPlayer);
		const winner = currentPlayer.hp >= opponent.hp ? currentPlayer : opponent;
		const loser = winner === currentPlayer ? opponent : currentPlayer;
		message.send(
			`Time's up! The game is over. ${winner.name} has more HP, so ${winner.name} wins! ${loser.name} is defeated.`
		);
		endFight(threadID);
	}, TIMEOUT_SECONDS * 1000);
	gameInstances.get(threadID).timeoutID = timeoutID;
}

function endFight(threadID) {
	ongoingFights.delete(threadID);
	const gameInstance = gameInstances.get(threadID);
	if (gameInstance && gameInstance.timeoutID) clearTimeout(gameInstance.timeoutID);
	gameInstances.delete(threadID);
}

module.exports = {
	config: {
		name: 'fight',
		version: '1.0',
		author: 'xemonbae01',
		countDown: 10,
		role: 0,
		description: { en: 'Fight with your friends!' },
		category: 'fun',
		guide: { en: '   {pn} @mention — challenge someone to a duel, then type attacks (kick, punch, slap...) on your turn, or "forfeit"' }
	},

	onStart: async function ({ event, message, usersData, args, api }) {
		const threadID = event.threadID;
		if (ongoingFights.has(threadID)) {
			return message.send('⚔️ A fight is already in progress in this group.');
		}

		const { targets } = await resolveTargets({ api, event, args, includeSelf: false });
		if (targets.length !== 1) {
			return message.send('🤔 Please mention one person to start a fight with.');
		}

		const challengerID = String(event.senderID);
		const opponentID = String(targets[0].id);
		if (challengerID === opponentID) {
			return message.send('🤔 You cannot fight yourself.');
		}
		const challenger = await usersData.getName(challengerID);
		const opponent = targets[0].name || targets[0].username || await usersData.getName(opponentID);

		const fight = {
			participants: [
				{ id: challengerID, name: challenger, hp: 100 },
				{ id: opponentID, name: opponent, hp: 100 }
			],
			currentPlayer: Math.random() < 0.5 ? challengerID : opponentID,
			threadID,
			startTime: Date.now()
		};

		gameInstances.set(threadID, {
			fight,
			lastAttack: null,
			lastPlayer: null,
			timeoutID: null,
			turnMessageSent: false
		});

		startFight(message, fight);
		startTimeout(threadID, message);
	},

	onChat: async function ({ event, message, prefix }) {
		const threadID = event.threadID;
		const gameInstance = gameInstances.get(threadID);
		if (!gameInstance) return;

		const body = (event.body || '').trim();
		if (!body) return;
		// commands are not moves
		if (prefix && body.startsWith(prefix)) return;

		const currentPlayerID = gameInstance.fight.currentPlayer;
		const currentPlayer = gameInstance.fight.participants.find((p) => p.id === currentPlayerID);
		const attack = body.toLowerCase();

		if (String(event.senderID) !== String(currentPlayerID)) {
			if (!gameInstance.turnMessageSent) {
				await message.send(`😒 It's ${currentPlayer.name}'s turn. Please wait for them to make a move.`);
				gameInstance.turnMessageSent = true;
			}
			return;
		}

		if (attack === 'forfeit') {
			const opponent = gameInstance.fight.participants.find((p) => p.id !== currentPlayerID);
			await message.send(`🏃 ${currentPlayer.name} forfeits! ${opponent.name} wins!`);
			return endFight(threadID);
		}

		if (!MOVES[attack]) {
			return message.reply(`❌ Invalid move! Use '${MOVE_LIST}', or 'forfeit'.`);
		}

		let damage = Math.random() < 0.1 ? 0 : Math.floor(Math.random() * (MOVES[attack].max - MOVES[attack].min + 1)) + MOVES[attack].min;
		const isCritical = Math.random() < 0.1;
		if (isCritical) {
			damage = Math.floor(damage * 1.5);
			await message.send(`💥 Critical hit! ${currentPlayer.name}'s ${attack} lands powerfully!`);
		}

		const opponent = gameInstance.fight.participants.find((p) => p.id !== currentPlayerID);
		opponent.hp -= damage;

		if (damage === 0) {
			await message.send(`😲 ${currentPlayer.name}'s ${attack} missed! ${opponent.name} took no damage.`);
		}
		else {
			await message.send(
				`🥊 ${currentPlayer.name} attacks ${opponent.name} with ${attack} and deals ${damage} damage.\n${opponent.name}'s HP: ${opponent.hp}`
			);
		}

		if (opponent.hp <= 0) {
			await message.send(`🎉 ${currentPlayer.name} wins! ${opponent.name} is defeated.`);
			return endFight(threadID);
		}

		gameInstance.fight.currentPlayer = opponent.id;
		gameInstance.turnMessageSent = false;
		await message.send(`💥 It's now ${opponent.name}'s turn!`);
	}
};

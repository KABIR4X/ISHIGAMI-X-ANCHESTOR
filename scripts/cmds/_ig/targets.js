'use strict';

// one place that turns "who did you mean?" into user ids: reply target,
// @mentions, @username args, instagram.com/<username> links, bare numeric
// ids, and finally the sender themself. every command that targets another
// user goes through here so they all behave the same way.
//
// pass only the args that can be targets — a command with subcommands
// (like `-ban list`) must handle its keywords BEFORE calling this, and a
// command like `-pay 100 @user` passes args.slice(1) so the amount is
// never mistaken for a user id.

const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;
const PROFILE_LINK_RE = /instagram\.com\/([A-Za-z0-9._]+)/i;

async function lookup(api, idOrUsername) {
	try {
		const info = await api.getUserInfo(idOrUsername);
		const keys = info ? Object.keys(info) : [];
		const user = keys.length ? info[keys[0]] : null;
		if (!user) return null;
		return {
			id: String(user.id || user.userID || idOrUsername),
			username: user.username || null,
			name: user.name || user.fullName || user.username || null
		};
	}
	catch { return null; }
}

// includeSelf (default true): with no target at all, resolve to the sender.
// set it false for commands where targeting yourself is meaningless (ban,
// pay...) — then an empty result means "no target", not "you".
async function resolveTargets({ api, event, args = [], includeSelf = true }) {
	const found = [];
	const notFound = [];
	const seen = new Set();
	const push = (t) => {
		if (!t || !t.id || seen.has(String(t.id))) return;
		seen.add(String(t.id));
		found.push(t);
	};

	// reply target
	if (event.messageReply && event.messageReply.senderID) {
		const id = String(event.messageReply.senderID);
		push((await lookup(api, id)) || { id, username: null, name: null });
	}

	// @mentions parsed from the message
	for (const id of Object.keys(event.mentions || {})) {
		const known = event.mentions[id];
		push((await lookup(api, id)) || { id: String(id), username: known || null, name: known || null });
	}

	// args: @username, instagram.com/username, or a bare numeric id
	for (const raw of args) {
		const arg = String(raw).trim();
		if (!arg) continue;
		const link = arg.match(PROFILE_LINK_RE);
		if (link) {
			const user = await lookup(api, link[1]);
			if (user) push(user);
			else notFound.push(`@${link[1]}`);
			continue;
		}
		if (arg.startsWith('@')) {
			const username = arg.slice(1);
			if (!USERNAME_RE.test(username)) continue;
			const user = await lookup(api, username);
			if (user) push(user);
			else notFound.push(arg);
			continue;
		}
		if (/^\d+$/.test(arg)) {
			push((await lookup(api, arg)) || { id: arg, username: null, name: null });
			continue;
		}
	}

	if (!found.length && includeSelf && event.senderID) {
		push({
			id: String(event.senderID),
			username: event.senderUsername || null,
			name: event.senderName || event.senderUsername || null
		});
	}

	return { targets: found, notFound };
}

function formatTarget(t) {
	if (!t) return '?';
	if (t.username) return `@${t.username} (${t.id})`;
	if (t.name) return `${t.name} (${t.id})`;
	return String(t.id);
}

module.exports = { resolveTargets, formatTarget };

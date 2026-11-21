'use strict';

const { resolveTargets } = require('./_ig/targets');

module.exports = {
	config: {
		name: "admin",
		version: "1.1.0",
		author: "xemonbae01",
		countDown: 3,
		role: 0,
		description: { en: "list / add / remove bot admins" },
		category: "admin",
		guide: { en: "   {pn} list" +
			"\n   {pn} add <@user | user id | reply>" +
			"\n   {pn} remove <@user | user id | reply>" }
	},

	langs: {
		en: {
			list: "bot admins:\n%1",
			added: "added %1 as bot admin",
			removed: "removed %1 from bot admins",
			already: "%1 is already an admin",
			notAdmin: "%1 is not an admin",
			notFound: "user not found: %1",
			onlyAdmin: "only bot admins can do that"
		}
	},

	// admins from config + admins added at runtime (globalData).
	// entries are numeric ids — the role gate only matches numeric sender
	// ids, so a @username stored here would never match anyone. older
	// versions stored the raw @username, so any non-numeric entry gets
	// resolved to its id once and the list rewritten (heals itself on the
	// next -admin run; entries that can't be resolved are left alone).
	async allAdmins(globalData, api) {
		const fromConfig = (global.Anchestor.config.adminBot || []).map(String);
		const stored = ((await globalData.get("adminBot")) || []).map(String);
		let changed = false;
		const healed = [];
		for (const entry of stored) {
			if (/^\d+$/.test(entry)) { healed.push(entry); continue; }
			let id = null;
			if (api && typeof api.getUserInfo === 'function') {
				try {
					const info = await api.getUserInfo(entry.replace(/^@/, ''));
					const keys = info ? Object.keys(info) : [];
					if (keys.length) id = String(keys[0]);
				}
				catch { /* unresolvable — keep the entry as-is */ }
			}
			if (id && /^\d+$/.test(id)) { healed.push(id); changed = true; }
			else healed.push(entry);
		}
		const deduped = [...new Set(healed)];
		if (changed || deduped.length !== stored.length) {
			await globalData.set("adminBot", deduped);
		}
		return { fromConfig, stored: deduped, all: [...new Set([...fromConfig, ...deduped])] };
	},

	onStart: async function ({ message, event, args, role, api, usersData, globalData, getLang }) {
		const { allAdmins } = module.exports;
		const action = (args[0] || "list").toLowerCase();

		if (action === "list") {
			const { all } = await allAdmins(globalData, api);
			if (!all.length) return message.reply("no bot admins set. add your id in config.json adminBot");
			const lines = all.map((id) => {
				try {
					const u = usersData && typeof usersData.peek === 'function' ? usersData.peek(id) : null;
					if (u && u.username) return `• @${u.username} (${id})`;
				}
				catch { /* plain id */ }
				return `• ${id}`;
			});
			return message.reply(getLang("list", lines.join("\n")));
		}

		if (role < 2) return message.reply(getLang("onlyAdmin"));

		// resolve the target to a numeric id FIRST — storing a @username
		// is useless, the role gate only matches numeric sender ids.
		// an explicit arg wins over a reply, same as before.
		let targetId = null;
		let targetLabel = null;
		if (args[1]) {
			const { targets, notFound } = await resolveTargets({
				api, event: { ...event, messageReply: null, mentions: {} },
				args: [args[1]], includeSelf: false
			});
			if (notFound.length) return message.reply(getLang("notFound", notFound[0]));
			if (!targets.length) return message.SyntaxError();
			targetId = String(targets[0].id);
			targetLabel = targets[0].username ? `@${targets[0].username}` : targetId;
		}
		else {
			const { targets } = await resolveTargets({ api, event, args: [], includeSelf: false });
			if (!targets.length) return message.SyntaxError();
			targetId = String(targets[0].id);
			targetLabel = targets[0].username ? `@${targets[0].username}` : targetId;
		}

		const { fromConfig, stored } = await allAdmins(globalData, api);
		if (action === "add") {
			if (fromConfig.includes(targetId) || stored.includes(targetId)) return message.reply(getLang("already", targetLabel));
			stored.push(targetId);
			await globalData.set("adminBot", stored);
			return message.reply(getLang("added", targetLabel));
		}
		if (action === "remove" || action === "rm") {
			if (fromConfig.includes(targetId)) return message.reply("that admin is in config.json, remove it from there");
			if (!stored.includes(targetId)) return message.reply(getLang("notAdmin", targetLabel));
			await globalData.set("adminBot", stored.filter((id) => id !== targetId));
			return message.reply(getLang("removed", targetLabel));
		}
		return message.SyntaxError();
	}
};

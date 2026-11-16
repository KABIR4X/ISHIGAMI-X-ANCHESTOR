module.exports = {
	config: {
		name: "music",
		aliases: ["sendmusic", "musicsticker"],
		version: "1.0.0",
		author: "Romeo",
		countDown: 5,
		role: 0,
		description: { en: "search and send an Instagram music sticker" },
		category: "media",
		guide: { en: "   {pn} <song name or audio asset id>" }
	},

	onStart: async function ({ message, event, args, api }) {
		const client = api.rawClient;
		if (!client) return message.reply("ig client not available");
		if (!args.length) return message.SyntaxError();
		const query = args.join(" ").trim();
		try {
			await client.sendMusic(event.threadID, query);
			return null;
		}
		catch (err) {
			return message.reply(`failed to send music: ${err.message}`);
		}
	}
};

// a giphy link carries its id — /gifs/slug-<id> or /media/<id>/giphy.gif
function giphyIdFromUrl(text) {
	if (!text || !text.includes('giphy.com')) return null;
	const media = text.match(/media\.giphy\.com\/media\/([A-Za-z0-9]+)/);
	if (media) return media[1];
	const slug = text.match(/giphy\.com\/gifs\/[^/\s]*-([A-Za-z0-9]+)\/?/);
	if (slug) return slug[1];
	return null;
}

module.exports = {
	config: {
		name: "gif",
		version: "1.1.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "search and send a gif" },
		category: "fun",
		guide: { en: "   {pn} <search text>" +
			"\n   {pn} <giphy link>" }
	},

	onStart: async function ({ message, event, args, api }) {
		const client = api.rawClient;
		if (!client) return message.reply("ig client not available");
		if (!args.length) return message.SyntaxError();
		const query = args.join(" ");

		// 1. a giphy link needs no search — the id sends natively
		const directId = giphyIdFromUrl(query);
		if (directId) {
			try {
				await client.sendGif(event.threadID, directId);
				return null;
			}
			catch (err) {
				return message.reply(`failed to send that gif: ${err.message}`);
			}
		}

		// 2. instagram's own gif search + native send
		try {
			const results = await client.searchGifs(query);
			const list = Array.isArray(results) ? results : (results && (results.gifs || results.results)) || [];
			if (list.length) {
				const first = list[0];
				const gifId = first.id || first.gifId || first;
				await client.sendGif(event.threadID, gifId);
				return null;
			}
		}
		catch (err) {
			// the ig gif endpoint 404s for some sessions — fall through to tenor
			if (global.utils && global.utils.log)
				global.utils.log.dev('GIF', `ig gif search failed (${err.message}), trying tenor`);
		}

		// 3. tenor search (no key, no ig session) + send as an image
		try {
			const tenor = await client.searchTenorGifs(query, { limit: 3 });
			if (tenor && tenor.length) {
				const first = tenor[0];
				try {
					if (api.sendImageFromUrl) await api.sendImageFromUrl(event.threadID, first.url);
					else await client.sendImageFromUrl(event.threadID, first.url);
					return null;
				}
				catch {
					// image send failed too — the link still unfurls in the chat
					return message.send(first.url);
				}
			}
		}
		catch (err) {
			if (global.utils && global.utils.log)
				global.utils.log.dev('GIF', `tenor search failed (${err.message})`);
		}

		return message.reply(`no gifs for "${query}"`);
	}
};

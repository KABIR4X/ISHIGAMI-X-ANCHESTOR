'use strict';

// startup banner — the messenger bot's login screen, rebuilt for instagram:
// ascii logo, version, repo, notices, and a lightweight update check that
// reads one file (package.json) off raw.githubusercontent — no github api
// quota burned. prints straight to the console, not through the logger,
// so the art stays clean. never throws: a banner must never kill a boot.
const https = require('https');

const { detectSource } = require('../../update/source');

// --- tiny gradient, no dependency: interpolate rgb across the string ---
function hexToRgb(hex) {
	const h = hex.replace('#', '');
	return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function gradient(text, from, to) {
	const [r1, g1, b1] = hexToRgb(from);
	const [r2, g2, b2] = hexToRgb(to);
	const n = Math.max(text.length - 1, 1);
	let out = '';
	for (let i = 0; i < text.length; i++) {
		const t = i / n;
		const r = Math.round(r1 + (r2 - r1) * t);
		const g = Math.round(g1 + (g2 - g1) * t);
		const b = Math.round(b1 + (b2 - b1) * t);
		out += `\x1b[38;2;${r};${g};${b}m${text[i]}`;
	}
	return out + '\x1b[0m';
}

function termWidth() {
	const w = process.stdout.columns;
	return Number.isFinite(w) && w > 0 ? w : 80;
}

function centerText(text, length) {
	const width = termWidth();
	const len = length || text.length;
	const left = Math.max(Math.floor((width - len) / 2), 0);
	console.log(' '.repeat(left) + text);
}

function createLine(content, isMaxWidth = false) {
	const width = isMaxWidth ? termWidth() : Math.min(termWidth(), 50);
	if (!content) return '─'.repeat(width);
	const label = ` ${String(content).trim()} `;
	const left = Math.max(Math.floor((width - label.length) / 2), 0);
	return '─'.repeat(left) + label + '─'.repeat(left);
}

// --- the logo: 5-row block ANCHESTOR, with narrow-terminal fallbacks ---
const ART_WIDE = [
	' ███  █   █  ████ █   █ █████  ████ █████  ███  ████ ',
	'█   █ ██  █ █     █   █ █     █       █   █   █ █   █',
	'█████ █ █ █ █     █████ ████   ███    █   █   █ ████ ',
	'█   █ █  ██ █     █   █ █         █   █   █   █ █  █ ',
	'█   █ █   █  ████ █   █ █████ ████    █    ███  █   █'
];

function logoLines(version) {
	const width = termWidth();
	if (width > 58) return ART_WIDE;
	if (width > 26) return [`ANCHESTOR v${version}`];
	return ['ANCHESTOR'];
}

// --- version compare: -1 if a < b, 0 if equal, 1 if a > b ---
function compareVersions(a, b) {
	const pa = String(a || '0').split('.').map((n) => parseInt(n, 10) || 0);
	const pb = String(b || '0').split('.').map((n) => parseInt(n, 10) || 0);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const d = (pa[i] || 0) - (pb[i] || 0);
		if (d !== 0) return d < 0 ? -1 : 1;
	}
	return 0;
}

function fetchText(url, timeoutMs) {
	return new Promise((resolve, reject) => {
		const req = https.get(url, { headers: { 'User-Agent': 'anchestor-ig-banner' } }, (res) => {
			if (res.statusCode < 200 || res.statusCode >= 300) {
				res.resume();
				return reject(new Error(`HTTP ${res.statusCode}`));
			}
			const chunks = [];
			res.on('data', (c) => chunks.push(c));
			res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		});
		req.on('error', reject);
		req.setTimeout(timeoutMs, () => req.destroy(new Error('timed out')));
	});
}

// one small file off raw.githubusercontent — no api quota, never throws
async function checkForUpdate(root, localVersion) {
	try {
		const { owner, repo, branch } = detectSource(root, {});
		const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/package.json`;
		const pkg = JSON.parse(await fetchText(url, 5000));
		const remote = pkg && pkg.version;
		if (!remote) return null;
		if (compareVersions(localVersion, remote) < 0) return { available: true, remoteVersion: remote };
		return { available: false, remoteVersion: remote };
	}
	catch {
		return null;
	}
}

async function printBanner({ root, version }) {
	try {
		// terminal title, like the messenger bot
		process.stdout.write('\x1b]2;Anchestor — Instagram DM Bot | Developed by xemonbae01\x1b\\');

		// the update check runs first so the banner prints as one clean block;
		// it gives up after 5s and a failure just means no update line
		const update = await checkForUpdate(root, version);

		console.log(gradient(createLine(null, true), '#f5af19', '#f12711'));
		console.log();
		for (const line of logoLines(version)) {
			centerText(gradient(line, '#FA8BFF', '#2BD2FF'), line.length);
		}
		console.log();
		const lines = [
			'Anchestor — Instagram DM bot',
			'Developed by xemonbae01 (Redwan) with ♡',
			`Version ${version}`,
			'Source: https://github.com/xemonbae01/Anchestor-IG'
		];
		for (const t of lines) centerText(gradient(t, '#9F98E8', '#AFF6CF'), t.length);
		console.log();
		// notices — centered on the visible text, color codes don't count
		for (const notice of [
			'NOTICE: keep your session private — never share account.txt',
			'NOTICE: -help lists every command · -update pulls the latest code'
		]) {
			centerText(`\x1b[33m${notice}\x1b[0m`, notice.length);
		}
		if (update && update.available) {
			centerText(`\x1b[1m\x1b[33mUPDATE AVAILABLE: v${update.remoteVersion} — run -update to upgrade\x1b[0m`, `UPDATE AVAILABLE: v${update.remoteVersion} — run -update to upgrade`.length);
		}
		console.log(gradient(createLine(null, true), '#f5af19', '#f12711'));
	}
	catch {
		// a banner must never kill a boot
	}
}

module.exports = { printBanner, checkForUpdate, compareVersions, logoLines, gradient, ART_WIDE };

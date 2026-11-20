'use strict';

// xe mo's sovereign command dashboard — elite rendered this as a 960x720
// canvas image. the canvas was pure decoration: every number on it came
// from local system stats, so this is the same dashboard as text, with
// the same four cards (uptime / cpu / ram / disk) plus the system info.

const os = require('os');
const { exec } = require('child_process');

function bar(pct, width = 10) {
	const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)));
	return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function fmtUptime(seconds) {
	const s = Math.floor(seconds);
	const days = Math.floor(s / 86400);
	const hours = Math.floor((s % 86400) / 3600);
	const mins = Math.floor((s % 3600) / 60);
	const parts = [];
	if (days) parts.push(`${days}d`);
	if (hours || days) parts.push(`${hours}h`);
	parts.push(`${mins}m`);
	return parts.join(' ');
}

function fmtBytes(bytes) {
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let n = Number(bytes) || 0;
	let i = 0;
	while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
	return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function cpuSnapshot() {
	let idle = 0;
	let total = 0;
	for (const c of os.cpus()) {
		for (const k of Object.keys(c.times)) total += c.times[k];
		idle += c.times.idle;
	}
	return { idle, total };
}

// real cpu load: two samples 100ms apart, same idea as top
async function cpuPercent() {
	const a = cpuSnapshot();
	await new Promise((r) => setTimeout(r, 100));
	const b = cpuSnapshot();
	const totalDiff = b.total - a.total;
	if (!totalDiff) return 0;
	return Math.max(0, Math.min(100, (1 - (b.idle - a.idle) / totalDiff) * 100));
}

function diskPercent() {
	return new Promise((resolve) => {
		exec("df / | awk 'NR==2 {print $5}' | tr -d '%'", (err, stdout) => {
			if (err) return resolve(null);
			const n = parseFloat(stdout);
			resolve(Number.isFinite(n) ? n : null);
		});
	});
}

module.exports = {
	config: {
		name: 'anc',
		version: '8.0',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: "Xe Mo's Sovereign Command Dashboard" },
		category: 'system',
		guide: { en: '   {pn}' }
	},

	onStart: async function ({ message }) {
		const cpu = await cpuPercent();
		const totalMem = os.totalmem();
		const freeMem = os.freemem();
		const usedMem = totalMem - freeMem;
		const memPct = totalMem ? (usedMem / totalMem) * 100 : 0;
		const disk = await diskPercent();
		const cores = os.cpus();
		const cpuModel = (cores[0] && cores[0].model) || 'Unknown CPU';

		const now = new Date();
		const dateStr = new Intl.DateTimeFormat('en-US', {
			timeZone: 'Asia/Dhaka', year: 'numeric', month: 'short', day: 'numeric'
		}).format(now);
		const timeStr = new Intl.DateTimeFormat('en-GB', {
			timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
		}).format(now);

		let botUp = 'N/A';
		try {
			if (global.Anchestor && global.Anchestor.startTime && global.utils && global.utils.convertTime)
				botUp = global.utils.convertTime(Date.now() - global.Anchestor.startTime);
		}
		catch { /* bot uptime is a bonus, not the point */ }

		const lines = [
			'⚡ SOVEREIGN COMMAND',
			'DASHBOARD  ·  ULTRA PREMIUM  ·  SYSTEM MONITOR',
			`✦  REDWAN (XE MO)  ✦   |   ${dateStr}  |  ${timeStr} (Dhaka)`,
			'',
			'◆  SYSTEM STATUS OVERVIEW  ◆',
			'',
			`◈ UPTIME — ${fmtUptime(os.uptime())}`,
			`  System active · bot up ${botUp}`,
			`  ${bar(80)}`,
			'',
			`◈ CPU LOAD — ${cpu.toFixed(1)}%`,
			`  ${cores.length} cores · ${cpuModel}`,
			`  ${bar(cpu)} ${cpu.toFixed(0)}%`,
			'',
			`◈ RAM USAGE — ${memPct.toFixed(1)}%`,
			`  ${fmtBytes(usedMem)} / ${fmtBytes(totalMem)}`,
			`  ${bar(memPct)} ${memPct.toFixed(0)}%`,
			'',
			disk === null
				? '◈ DISK USAGE — N/A\n  Root partition unreadable'
				: `◈ DISK USAGE — ${disk.toFixed(1)}%\n  Root partition\n  ${bar(disk)} ${disk.toFixed(0)}%`,
			'',
			'◆  SYSTEM ENVIRONMENT  ◆',
			'',
			`  OS       ${os.type()} ${os.release()}`,
			`  Platform ${os.platform()} (${os.arch()})`,
			`  Node     ${process.version}`,
			`  Host     ${os.hostname()}`,
			'',
			'v8.0  ·  SOVEREIGN COMMAND DASHBOARD  ·  ◆ ◆ ◆  ·  CRAFTED BY REDWAN (XE MO)',
			`SYS::ARCH_${os.arch().toUpperCase()}  //  NET::STABLE  //  SEC::ACTIVE`,
			`UPT::${fmtUptime(os.uptime())}  //  PRC::NOMINAL  //  AUTH::XE_MO`
		];

		return message.reply(lines.join('\n'));
	}
};

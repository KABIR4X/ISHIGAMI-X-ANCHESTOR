'use strict';

// system info — elite used the systeminformation + pidusage packages for
// this. both are heavy native-ish deps we don't ship, so this is a clean
// rewrite on node's built-in os module only: cpu, memory, os, node and
// process numbers. gpu, temperatures and disk layout can't come from the
// os module, so those elite sections are gone — everything here is real.
//
// this is not usage.js (command usage stats) or uptime.js (bot uptime) —
// it's the hardware + process readout neither of them has.

const os = require('os');

function byte2mb(bytes) {
	const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	let l = 0;
	let n = parseInt(bytes, 10) || 0;
	while (n >= 1024 && ++l) n = n / 1024;
	return `${n.toFixed(n < 10 && l > 0 ? 1 : 0)}${units[l]}`;
}

function fmtUptime(seconds) {
	const s = Math.floor(seconds);
	const hours = Math.floor(s / 3600);
	const mins = Math.floor((s % 3600) / 60);
	const secs = s % 60;
	const pad = (n) => String(n).padStart(2, '0');
	return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
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

// node process cpu share since the bot started
function processCpuPercent() {
	const usage = process.cpuUsage();
	const uptimeSec = process.uptime();
	if (!uptimeSec) return 0;
	const busySec = (usage.user + usage.system) / 1e6;
	return Math.max(0, (busySec / uptimeSec) * 100);
}

module.exports = {
	config: {
		name: 'system',
		version: '2.0.0',
		author: 'xemonbae01',
		countDown: 5,
		role: 0,
		description: { en: 'Hardware and process info the bot is running on' },
		category: 'system',
		guide: { en: '   {pn}' }
	},

	onStart: async function ({ message }) {
		const timeStart = Date.now();
		try {
			const cpus = os.cpus();
			const cpu = cpus[0] || {};
			const load = await cpuPercent();
			const loadAvg = os.loadavg();
			const memTotal = os.totalmem();
			const memFree = os.freemem();
			const memUsed = memTotal - memFree;
			const procMem = process.memoryUsage();

			const msg =
				'==== 「 CPU 」 ====\n' +
				`Model: ${cpu.model || 'Unknown'}\n` +
				`Cores: ${cpus.length}\n` +
				`Speed: ${cpu.speed ? `${(cpu.speed / 1000).toFixed(2)}GHz` : 'N/A'}\n` +
				`Load: ${load.toFixed(1)}%\n` +
				`Load avg (1/5/15m): ${loadAvg.map((v) => v.toFixed(2)).join(' / ')}\n` +
				`Node CPU: ${processCpuPercent().toFixed(1)}%\n` +
				'\n==== 「 MEMORY 」 ====\n' +
				`Total: ${byte2mb(memTotal)}\n` +
				`Used: ${byte2mb(memUsed)} (${memTotal ? ((memUsed / memTotal) * 100).toFixed(1) : '0'}%)\n` +
				`Free: ${byte2mb(memFree)}\n` +
				`Node RSS: ${byte2mb(procMem.rss)}\n` +
				`Node heap: ${byte2mb(procMem.heapUsed)} / ${byte2mb(procMem.heapTotal)}\n` +
				'\n==== 「 OS 」 ====\n' +
				`Platform: ${os.platform()} (${os.arch()})\n` +
				`Release: ${os.release()}\n` +
				`Hostname: ${os.hostname()}\n` +
				`System uptime: ${fmtUptime(os.uptime())}\n` +
				`Bot uptime: ${fmtUptime(process.uptime())}\n` +
				'\n==== 「 RUNTIME 」 ====\n' +
				`Node: ${process.version}\n` +
				`PID: ${process.pid}\n` +
				`Gathered in: ${Date.now() - timeStart}ms`;

			return message.reply(msg);
		}
		catch (e) {
			return message.reply('⚠️ Error: ' + e.message);
		}
	}
};

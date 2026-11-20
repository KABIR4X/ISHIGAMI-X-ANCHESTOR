'use strict';

// console + file logger. levels: error < warn < info < debug (dev).
// config.log.level picks what shows ('debug' shows everything, the
// default); config.log.file writes a plain-text copy to
// logs/anchestor-YYYY-MM-DD.log, one file per day, pruned after
// config.log.keepDays (default 7). file logging never throws — if the
// disk says no, it quietly stays console-only.
const fs = require('fs');
const path = require('path');

const colors = require('./logColor');

const LEVELS = { error: 0, warn: 1, info: 2, success: 2, master: 2, dev: 3 };
const LEVEL_NAMES = { error: 0, warn: 1, info: 2, debug: 3 };

const LOGS_DIR = path.join(__dirname, '..', 'logs');

let fileDisabled = false;
let lastPruneDate = '';

function logConfig() {
	try {
		const cfg = (global.Anchestor && global.Anchestor.config && global.Anchestor.config.log) || {};
		const level = LEVEL_NAMES[String(cfg.level || 'debug').toLowerCase()];
		return {
			level: level === undefined ? 3 : level,
			file: cfg.file !== false,
			keepDays: Number(cfg.keepDays) > 0 ? Math.floor(Number(cfg.keepDays)) : 7
		};
	}
	catch {
		return { level: 3, file: true, keepDays: 7 };
	}
}

function timeParts() {
	try {
		const tz = (global.Anchestor && global.Anchestor.config && global.Anchestor.config.timeZone) || 'Asia/Dhaka';
		const fmt = new Intl.DateTimeFormat('en-CA', {
			timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
			hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
		});
		const parts = {};
		for (const p of fmt.formatToParts(new Date())) parts[p.type] = p.value;
		return {
			stamp: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`,
			date: `${parts.year}-${parts.month}-${parts.day}`
		};
	}
	catch {
		const d = new Date();
		const pad = (n) => String(n).padStart(2, '0');
		const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
		return { stamp: `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`, date };
	}
}

function pruneOldLogs(today, keepDays) {
	if (lastPruneDate === today) return;
	lastPruneDate = today;
	try {
		if (!fs.existsSync(LOGS_DIR)) return;
		const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
		for (const file of fs.readdirSync(LOGS_DIR)) {
			if (!/^anchestor-\d{4}-\d{2}-\d{2}\.log$/.test(file)) continue;
			const full = path.join(LOGS_DIR, file);
			try {
				if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
			}
			catch { /* one stubborn file never blocks the rest */ }
		}
	}
	catch { /* pruning is housekeeping, never fatal */ }
}

function writeFile(stamp, date, level, tag, message) {
	if (fileDisabled) return;
	try {
		if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
		pruneOldLogs(date, logConfig().keepDays);
		fs.appendFileSync(
			path.join(LOGS_DIR, `anchestor-${date}.log`),
			`[${stamp}] [${level.toUpperCase()}] ${tag} » ${message}\n`
		);
	}
	catch {
		// disk full, read-only fs, whatever — stay console-only from here
		fileDisabled = true;
	}
}

function make(level, colorFn, label) {
	return function (tag, message) {
		if (message === undefined) {
			message = tag;
			tag = level.toUpperCase();
		}
		if (typeof message !== 'string') {
			try { message = JSON.stringify(message); }
			catch { message = String(message); }
		}
		const cfg = logConfig();
		if (LEVELS[level] > cfg.level) return;
		const { stamp, date } = timeParts();
		console.log(`${colors.gray(stamp)} ${colorFn(label)} ${colors.bold(String(tag))} » ${message}`);
		if (cfg.file) writeFile(stamp, date, level, String(tag), message);
	};
}

module.exports = {
	error: make('error', colors.red, '✖'),
	warn: make('warn', colors.yellow, '⚠'),
	info: make('info', colors.cyan, 'ℹ'),
	success: make('success', colors.green, '✔'),
	master: make('master', colors.magenta, '★'),
	dev: make('dev', colors.gray, '›'),
	colors
};

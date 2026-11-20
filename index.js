/**
 * @author xemonbae01
 * Developed By Redwan Ahemed https://GitHub.com/xemonbae01
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// the banner prints here, in the parent, before the bot process even
// starts — so the logo is always the first thing on the screen and the
// boot logs come after it. it prints again on every restart.
async function printBanner() {
	try {
		const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
		await require('./bot/login/banner').printBanner({ root: __dirname, version: pkg.version || '?' });
	}
	catch { /* the banner is cosmetic, the bot starts either way */ }
}

async function startBot() {
	await printBanner();
	const child = spawn(process.execPath, [path.join(__dirname, 'Anchestor.js')], {
		cwd: __dirname,
		stdio: 'inherit',
		// tells the child a supervisor is watching, so the auto-updater
		// knows a restart will actually come back
		env: { ...process.env, ANCHESTOR_SPAWNED: '1' }
	});
	child.on('close', (code) => {
		if (code === 2) {
			console.log('[anchestor] restarting...');
			startBot();
		}
		else if (code !== 0 && code !== null) {
			console.log(`[anchestor] exited with code ${code}`);
		}
	});
	child.on('error', (err) => {
		console.error('[anchestor] failed to start:', err.message);
	});
}

startBot();

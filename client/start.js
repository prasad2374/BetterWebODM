import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Parse Arguments
const args = process.argv.slice(2);
const isDev = args.includes('--dev');

// 2. Determine API URL
// If --dev is present, force localhost.
// Otherwise, use SERVER_ADDR from env (default to localhost if missing).
const serverAddr = process.env.SERVER_ADDR || 'localhost';
const apiUrl = isDev ? 'http://localhost:5000/api' : `http://${serverAddr}:5000/api`;

console.log(`[Config] Mode: ${isDev ? 'DEV (--dev)' : 'PROD (Env)'}`);
console.log(`[Config] Target Server: ${apiUrl}`);

// 3. Update .env file
const envPath = path.resolve(__dirname, '.env');
let envContent = '';

try {
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
    }

    if (envContent.includes('VITE_API_URL=')) {
        envContent = envContent.replace(/VITE_API_URL=.*/g, `VITE_API_URL=${apiUrl}`);
    } else {
        // Ensure newline if file has content and no newline at end
        if (envContent && !envContent.endsWith('\n')) envContent += '\n';
        envContent += `VITE_API_URL=${apiUrl}\n`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log(`[Config] Updated .env successfully.`);
} catch (err) {
    console.error(`[Config] Error updating .env:`, err);
}

// 4. Run Vite
// Remove our custom --dev flag before passing to vite
const viteArgs = args.filter(a => a !== '--dev');
const viteCmd = process.platform === 'win32' ? 'vite.cmd' : 'vite';

console.log(`[Config] Starting Vite...`);
const child = spawn(viteCmd, viteArgs, { stdio: 'inherit', shell: true });

child.on('close', (code) => {
    process.exit(code);
});

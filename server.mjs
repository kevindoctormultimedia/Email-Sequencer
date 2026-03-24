import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

const child = spawn('/opt/homebrew/bin/node', [
  join(__dirname, 'node_modules/.bin/next'),
  'dev',
  '--webpack'
], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || ''}` },
});

child.on('exit', (code) => process.exit(code || 0));

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const suites = [
  ['core', {}], ['worker', {}], ['migration', {}], ['migration', { INVALID_SAVE: '1' }],
  ['editor', {}], ['renderer', {}], ['persistence', {}], ['page', {}],
];
let assertions = 0;
for (const [name, extra] of suites) {
  const filename = fileURLToPath(new URL(`./${name}.test.mjs`, import.meta.url));
  const result = spawnSync(process.execPath, [filename], { encoding: 'utf8', env: { ...process.env, ...extra } });
  process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
  if (result.status !== 0) process.exit(result.status || 1);
  assertions += JSON.parse(result.stdout).assertions;
}
console.log(JSON.stringify({ summary: true, passed: true, suiteRuns: suites.length, assertions }));

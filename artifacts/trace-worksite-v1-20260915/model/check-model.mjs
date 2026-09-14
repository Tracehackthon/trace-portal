import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SCREENS, createWorksiteDemo, selectWorksiteView } from './worksite-model.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const taskRoot = resolve(directory, '..');
const contextHash = createHash('sha256').update(readFileSync(resolve(taskRoot, 'coordination/context-package.json'))).digest('hex').toUpperCase();
const commands = [
  ['--check', 'worksite-model.mjs'],
  ['--check', 'worksite-fixture.mjs'],
  ['--test', '--test-reporter=tap', 'worksite-model.test.mjs'],
];
const checks = commands.map(args => {
  const result = spawnSync(process.execPath, args, { cwd: directory, encoding: 'utf8' });
  return { command: ['node', ...args].join(' '), exitCode: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message ?? null };
});
const sample = selectWorksiteView(createWorksiteDemo('overview'));
writeFileSync(resolve(directory, 'sample-view.json'), `${JSON.stringify(sample, null, 2)}\n`);
writeFileSync(resolve(directory, 'sample-views.json'), `${JSON.stringify(Object.fromEntries(SCREENS.map(screen => [screen, selectWorksiteView(createWorksiteDemo(screen))])), null, 2)}\n`);
const output = {
  taskId: 'trace-worksite-v1-20260915',
  verifiedAt: new Date().toISOString(),
  node: process.version,
  repositoryHeadBaseline: '2f4377864aa353dcecb3f60005d884b11486c84e',
  contextPackageSHA256: contextHash,
  checks,
  passed: checks.every(check => check.exitCode === 0),
  runHistory: [
    { run: 'initial-33', result: '33/33 passed', note: '首次实现自测；之后审阅增加无依据 confirmed 防护，并纳入第 8 项测试重跑。' },
    { run: 'this-run', result: checks.every(check => check.exitCode === 0) ? 'passed' : 'failed' },
  ],
  notRun: ['app integration', 'browser UI behavior', 'Electron file://', 'real Overlay', 'shared chain domain store', 'persistence or real Agent'],
};
writeFileSync(resolve(directory, 'checks.json'), `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ passed: output.passed, commands: checks.map(check => ({ command: check.command, exitCode: check.exitCode })) }, null, 2)}\n`);
if (!output.passed) process.exitCode = 1;

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SCREENS, createComparisonDemo, selectComparisonView } from './comparison-model.mjs';

const directory = new URL('./', import.meta.url);
const testPath = fileURLToPath(new URL('comparison-model.test.mjs', directory));
const result = spawnSync(process.execPath, ['--test', testPath], { encoding: 'utf8', cwd: fileURLToPath(directory) });
const output = (result.stdout || '') + (result.stderr || '');
writeFileSync(new URL('checks.latest.tap', directory), output, 'utf8');
const views = Object.fromEntries(SCREENS.map((screen) => [screen, selectComparisonView(createComparisonDemo(screen))]));
writeFileSync(new URL('sample-view.json', directory), JSON.stringify({ taskId: 'trace-compare-v1-20260915', fixture: true, views }, null, 2) + '\n', 'utf8');
const numeric = (name) => Number(output.match(new RegExp(`^# ${name} (\\d+)$`, 'm'))?.[1] ?? 0);
const checkedFiles = ['comparison-model.mjs', 'comparison-model.test.mjs', 'sample-view.json', 'README.md'];
const hashes = Object.fromEntries(checkedFiles.map((name) => [name, createHash('sha256').update(readFileSync(new URL(name, directory))).digest('hex').toUpperCase()]));
const report = {
  taskId: 'trace-compare-v1-20260915', measuredAt: new Date().toISOString(), node: process.version,
  head: '2f4377864aa353dcecb3f60005d884b11486c84e',
  contextPackageSha256: 'B7417F6FD5E3F6FE1F699F5B9316BE15B8129DF8077EEC77D909679A9C5A61EC',
  command: 'node --test artifacts/trace-compare-v1-20260915/model/comparison-model.test.mjs',
  result: { status: result.status === 0 ? 'passed-after-fixture-correction' : 'failed', tests: numeric('tests'), pass: numeric('pass'), fail: numeric('fail'), exitCode: result.status },
  firstRun: { tests: 38, pass: 37, fail: 1, failingTest: 'text remains literal; unsafe-looking IDs cannot poison per-candidate draft records',
    observed: 'Expected the literal string but got empty string because the custom candidate was not returned for the default demo query.',
    correction: 'Test now patches question to 收藏 with empty instructions before SEARCH; no production search matcher relaxation.' },
  views: Object.fromEntries(Object.entries(views).map(([screen, view]) => [screen, { screen: view.screen, candidateCount: view.candidates.length, hasReceipt: !!view.receipt, version: view.matter.version }])),
  hashes,
  notIntegrated: ['desktop app', 'chain host adapter', 'Electron Overlay', 'real search/model', 'persistence'],
  notVerified: ['browser visual/accessibility/IME', 'real host atomic concurrency and draftVersion guard'],
};
writeFileSync(new URL('checks.json', directory), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report.result));
process.exitCode = result.status || 0;

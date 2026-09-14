import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createResultReturnDemo } from './fixture.mjs';
import { SCREENS, selectResultReturnView } from './result-return-model.mjs';
const dir = dirname(fileURLToPath(import.meta.url));
const run = spawnSync(process.execPath, ['--test', 'result-return-model.test.mjs'], { cwd: dir, encoding: 'utf8' });
const output = run.stdout + run.stderr;
let history = []; try { history = JSON.parse(readFileSync(join(dir, 'checks.json'), 'utf8')).history || []; } catch {}
const entry = { run: history.length + 1, at: new Date().toISOString(), command: 'node --test result-return-model.test.mjs', exitCode: run.status,
  tests: Number(output.match(/# tests (\d+)/)?.[1] || 0), pass: Number(output.match(/# pass (\d+)/)?.[1] || 0), fail: Number(output.match(/# fail (\d+)/)?.[1] || 0),
  failedNames: [...output.matchAll(/^not ok \d+ - (.+)$/gm)].map(match => match[1]), evidence: `checks.run-${history.length + 1}.tap` };
history.push(entry);
writeFileSync(join(dir, entry.evidence), output);
writeFileSync(join(dir, 'checks.json'), JSON.stringify({ scope: 'pure reducer and explicit in-memory host fixture; no app, network or persistence validation', history }, null, 2) + '\n');
writeFileSync(join(dir, 'sample-views.json'), JSON.stringify(Object.fromEntries(SCREENS.map(screen => [screen, selectResultReturnView(createResultReturnDemo(screen).state)])), null, 2) + '\n');
process.stdout.write(output);
process.exitCode = run.status ?? 1;

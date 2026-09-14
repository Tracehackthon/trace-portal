// Local build/parse checks only. Never load or execute upstream application code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expected = String.raw`D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\components`;
if (root !== expected) throw new Error('Unexpected writer root');
const require = createRequire(import.meta.url);
const esbuildPath = String.raw`D:\AGeneral Workspace\AI-powered\harness\trace-runtime\plugins\trace-harness-plugin\node_modules\esbuild\lib\main.js`;
const esbuild = require(esbuildPath);
const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.components.length !== 5) throw new Error('Download phase is not complete');
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex').toUpperCase();
const contextPath = path.join(root, '..', 'coordination', 'context-package.json');
const contextBytes = fs.readFileSync(contextPath);
if (sha256(contextBytes) !== manifest.context_package_sha256) throw new Error('Context package changed');
const context = JSON.parse(contextBytes.toString('utf8'));
const scopeBaselineChecks = context.source_baseline.map(item => {
  const observed = sha256(fs.readFileSync(item.path));
  if (observed !== item.sha256) throw new Error('Desktop source baseline changed: ' + item.path);
  return { path: item.path, sha256: observed, status: 'unchanged-from-context-package' };
});
const checks = [];
for (const component of manifest.components) {
  for (const file of component.downloaded_files) {
    const full = path.join(root, file.path);
    const data = fs.readFileSync(full);
    if (sha256(data) !== file.sha256) throw new Error('Original changed: ' + file.path);
    const record = { path: file.path, original_sha256: 'pass', bytes: data.length };
    if (file.path.endsWith('.js')) {
      execFileSync(process.execPath, ['--input-type=module', '--check'], { input: data, encoding: 'utf8' });
      record.syntax = 'node-esm-parse-pass';
    } else if (/\.tsx?$/.test(file.path) && !file.path.endsWith('.d.ts')) {
      const result = esbuild.transformSync(data.toString('utf8'), { loader: file.path.endsWith('.tsx') ? 'tsx' : 'ts', format: 'esm', target: 'es2022', sourcefile: full, tsconfigRaw: { compilerOptions: {} } });
      record.syntax = 'esbuild-static-parse-pass-not-typecheck';
      record.warnings = result.warnings;
    } else if (file.path.endsWith('.json')) {
      JSON.parse(data.toString('utf8'));
      record.syntax = 'json-parse-pass';
    }
    checks.push(record);
  }
}

const derivedRoot = path.join(root, 'derived', 'liquidglassjs');
fs.mkdirSync(derivedRoot, { recursive: true });
const entryPath = path.join(derivedRoot, 'shape-entry.ts');
fs.writeFileSync(entryPath, "// Locally selected export. Upstream originals are unchanged.\nexport { mountGlassShape, GLASS_SHAPE_DEFAULTS } from '../../originals/liquidglassjs/packages/core/src/glass-shape';\n", 'utf8');
const outfile = path.join(derivedRoot, 'shape-only.mjs');
const buildResult = esbuild.buildSync({
  entryPoints: [entryPath], outfile, absWorkingDir: root, bundle: true,
  platform: 'browser', format: 'esm', target: 'es2022', minify: false,
  legalComments: 'inline', metafile: true, sourcemap: false,
  tsconfigRaw: { compilerOptions: {} }, logLevel: 'silent',
  banner: { js: '/* Derived local bundle of @liquidglassjs/core 0.5.2.\n * Upstream commit: 07ad06ea197a07269af56da83d1fc9498bca94f5\n * MIT Copyright (c) 2026 Amir Abushanab. Full text: ./LICENSE\n * Source-only preparation: not runtime or visual acceptance. */' }
});
for (const input of Object.keys(buildResult.metafile.inputs)) {
  const full = path.resolve(root, input);
  if (!full.startsWith(root + path.sep)) throw new Error('Unexpected bundle input outside component area: ' + input);
}
for (const output of Object.values(buildResult.metafile.outputs)) {
  if (output.imports.length) throw new Error('Unexpected remaining bundle imports');
}
fs.copyFileSync(path.join(root, 'originals', 'liquidglassjs', 'LICENSE'), path.join(derivedRoot, 'LICENSE'));
fs.writeFileSync(path.join(derivedRoot, 'build-metafile.json'), JSON.stringify(buildResult.metafile, null, 2) + '\n', 'utf8');
execFileSync(process.execPath, ['--check', outfile], { encoding: 'utf8' });

const result = {
  task_id: manifest.task_id, context_package_sha256: manifest.context_package_sha256,
  git_baseline: manifest.git_baseline, checked_at_utc: new Date().toISOString(),
  tools: { node: process.version, esbuild: esbuild.version, esbuild_path: esbuildPath },
  scope_baseline_checks: scopeBaselineChecks,
  downloaded_file_count: checks.length, checks,
  build: { status: 'pass', output: path.relative(root, outfile).split(path.sep).join('/'), warnings: buildResult.warnings, inputs: Object.keys(buildResult.metafile.inputs), remaining_imports: [], syntax: 'node-mjs-parse-pass', application_modules_executed: false },
  not_run: ['TypeScript semantic typecheck', 'DOM initialization', 'file:// import in actual Electron shell', 'SVG displacement rendering', '60 fps animation/performance', 'six-image visual acceptance', 'source shape updates during morph'],
  constraints: ['No upstream scripts, npm installs, lifecycle commands or project dependency edits ran.', 'Codrops remains reference-only and is absent from the derived bundle.', 'React AnimatedBeam is source-only; static parse does not satisfy dependency resolution or runtime validation.']
};
fs.writeFileSync(path.join(root, 'validation.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
manifest.validation = { source_integrity: 'all-fixed-commit-git-blobs-and-sha256-pass', downloaded_file_count: checks.length, javascript_syntax: 'pass', typescript_static_parse: 'pass-not-semantic-typecheck', shape_bundle: 'pass-no-external-imports', report: 'validation.json', runtime_rendering: 'not-run', visual_acceptance: 'not-run', file_protocol_integration: 'not-run' };
for (const component of manifest.components) {
  component.preparation_only = true;
  component.can_bulk_copy_to_app = false;
  component.reference_only = component.id.startsWith('codrops-');
  if (component.reference_only) component.distribution_authorization = 'unresolved-do-not-import-bundle-or-distribute';
}
manifest.derived_files = ['shape-entry.ts', 'shape-only.mjs', 'LICENSE', 'build-metafile.json'].map(name => {
  const full = path.join(derivedRoot, name);
  const raw = fs.readFileSync(full);
  return { path: path.relative(root, full).split(path.sep).join('/'), bytes: raw.length, sha256: sha256(raw), provenance: 'liquidglassjs@07ad06ea197a07269af56da83d1fc9498bca94f5; local export selection and esbuild compilation' };
});
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ downloadedFiles: checks.length, bundleBytes: fs.statSync(outfile).size, esbuild: esbuild.version, warnings: buildResult.warnings.length, notRun: result.not_run }, null, 2));

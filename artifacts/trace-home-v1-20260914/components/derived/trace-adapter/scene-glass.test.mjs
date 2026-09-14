import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Imports only locally authored geometry; no DOM or upstream vendor is executed.
const source = fs.readFileSync(new URL('./scene-glass.js', import.meta.url), 'utf8');
const { calculateCoverSample } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const almost = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('same-ratio scene sampling uses global origin, not per-card cover', () => {
  const sample = calculateCoverSample({ left: 0, top: 0, width: 1672, height: 941 }, { left: 120, top: 530, width: 440, height: 150 }, 1672, 941);
  almost(sample.x, -120 / 440 * 1000);
  almost(sample.y, -530 / 150 * 300);
  almost(sample.width, 1672 / 440 * 1000);
  almost(sample.height, 941 / 150 * 300);
});

test('uniform scene scaling and page translation preserve normalized sampling', () => {
  const a = calculateCoverSample({ left: 0, top: 0, width: 1672, height: 941 }, { left: 120, top: 530, width: 440, height: 150 }, 1824, 1024);
  const b = calculateCoverSample({ left: 40, top: 30, width: 836, height: 470.5 }, { left: 100, top: 295, width: 220, height: 75 }, 1824, 1024);
  for (const key of Object.keys(a)) almost(a[key], b[key]);
});

test('cover centers horizontal crop when source is wider', () => {
  const a = calculateCoverSample({ left: 0, top: 0, width: 1000, height: 1000 }, { left: 0, top: 0, width: 1000, height: 1000 }, 2000, 1000);
  assert.deepEqual(a, { x: -500, y: 0, width: 2000, height: 300 });
});

test('zero-size and invalid measurements skip sampling', () => {
  assert.equal(calculateCoverSample({ left: 0, top: 0, width: 0, height: 100 }, { left: 0, top: 0, width: 10, height: 10 }, 100, 100), null);
  assert.equal(calculateCoverSample({ left: 0, top: 0, width: 100, height: 100 }, { left: 0, top: 0, width: 10, height: 10 }, NaN, 100), null);
});

import { writeFile } from 'node:fs/promises';
import { SCREENS, createChainDemo, selectChainView } from './chain-model.mjs';

const output = Object.fromEntries(SCREENS.map((screen) => [screen, selectChainView(createChainDemo(screen))]));
await writeFile(new URL('./sample-view.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Wrote ${SCREENS.length} explicitly labeled demo views. No user session or app state touched.`);

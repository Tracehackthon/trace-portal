import test from 'node:test';
import assert from 'node:assert/strict';
import { canonical, createResultReturnState as create, reduceResultReturn as reduce, selectResultReturnView as view, SCREENS } from './result-return-model.mjs';
import { demoSeed, createResultReturnDemo as demo, createFixtureHost, applyFixtureCommand, DEMO_BEFORE, DEMO_AFTER } from './fixture.mjs';
const pending = state => view(state).status.pending;
const dispatch = (state, ...actions) => actions.reduce(reduce, state);
function commit(state, host = createFixtureHost(), options) {
  const outcome = applyFixtureCommand(host, pending(state), options);
  return { state: reduce(state, { type: 'HOST_RECEIPT', receipt: outcome.receipt }), ...outcome };
}
const revision = () => demo('revision').state;
const requested = () => reduce(revision(), { type: 'CONFIRM_REVISION' });
const blank = () => create({ ...demoSeed(), rawText: '', comparison: {}, isDemo: false });

test('five samples are selector output and only completed has successful revision receipt', () => {
  for (const screen of SCREENS) {
    const { state } = demo(screen), v = view(state);
    assert.equal(v.screen, screen);
    assert.equal(v.isDemo, true);
    assert.equal(Boolean(v.receipt), screen === 'completed');
    assert.equal(v.status.phase === 'completed', screen === 'completed');
  }
});
test('host must issue explicit stable IDs and command namespace', () => {
  assert.throws(() => create({}), /instanceId/);
  assert.throws(() => create({ instanceId: 'x' }), /sessionId/);
  assert.throws(() => create({ ...demoSeed(), sessions: [demoSeed(), demoSeed()] }), /uniquely/);
  assert.throws(() => create({ ...demoSeed(), matter: { id: 'a', version: -1 } }), /version/);
});
test('empty or whitespace input neither saves nor compares nor revises', () => {
  for (const text of ['', '  \n\t']) {
    let state = reduce(blank(), { type: 'EDIT_INTAKE', text });
    for (const type of ['KEEP_RESULT_ONLY', 'OPEN_COMPARISON', 'CONFIRM_REVISION']) state = reduce(state, { type });
    assert.equal(pending(state), null); assert.equal(view(state).screen, 'intake');
  }
});
test('arbitrary user input never borrows demo observation, interpretation or suggestion', () => {
  let state = reduce(blank(), { type: 'EDIT_INTAKE', text: '完全不同的工作 <img src=x onerror=x> 😀' });
  state = reduce(state, { type: 'OPEN_COMPARISON' });
  assert.equal(view(state).intake.text, '完全不同的工作 <img src=x onerror=x> 😀');
  assert.equal(view(state).comparison.observation, '');
  assert.equal(view(state).comparison.interpretation, ''); assert.equal(view(state).impact.suggestion, null);
});
test('comparison observation, interpretation and unknown remain separate editable strings', () => {
  let state = blank();
  for (const [field, text] of Object.entries({ observation: '我看到 A', interpretation: '我猜 B', unconfirmed: '还不知道 C' })) state = reduce(state, { type: 'EDIT_COMPARISON', field, text });
  assert.deepEqual(view(state).comparison, { observation: '我看到 A', interpretation: '我猜 B', unconfirmed: '还不知道 C', summary: '' });
  assert.equal(view(state).intake.text, '');
});
test('only explicit selected material content is accepted and duplicate/removal are local', () => {
  let state = blank();
  const before = view(state).intake.materials.length;
  state = reduce(state, { type: 'ADD_MATERIAL', material: { id: 'whole', title: 'whole conversation', conversation: 'not selected' } });
  assert.equal(view(state).intake.materials.length, before);
  const material = { id: 'selected', title: '选中的一段', text: '只带回这句', url: 'https://example.test' };
  state = dispatch(state, { type: 'ADD_MATERIAL', material }, { type: 'ADD_MATERIAL', material });
  assert.equal(view(state).intake.materials.length, before + 1);
  assert.equal(view(state).intake.materials.at(-1).url, undefined);
  state = reduce(state, { type: 'REMOVE_MATERIAL', id: 'selected' });
  assert.equal(view(state).intake.materials.length, before);
});
test('unlinked result can be retained without inventing a matter or a revision', () => {
  let state = reduce(create(demoSeed()), { type: 'UNLINK_MATTER' });
  assert.equal(view(state).identity.matterId, null);
  state = reduce(state, { type: 'KEEP_RESULT_ONLY' });
  assert.equal(pending(state).expectedVersion, null);
  const result = commit(state, createFixtureHost({ matter: null }));
  assert.equal(result.host.results.length, 1); assert.equal(result.host.matter, null);
  assert.equal(view(result.state).status.phase, 'saved-result'); assert.notEqual(view(result.state).screen, 'completed');
});
test('result-only save with later understanding or unsaved draft does not mutate that understanding', () => {
  const state = reduce(create(demoSeed()), { type: 'KEEP_RESULT_ONLY' });
  const host = createFixtureHost(); host.matter.version++; host.matter.understanding = '更晚的内容'; host.matter.hasUnsavedDraft = true;
  const result = commit(state, host);
  assert.equal(result.receipt.ok, true); assert.deepEqual(result.host.matter, host.matter);
  assert.equal(view(result.state).status.phase, 'saved-result');
});
test('saved original result cannot be edited or reassigned silently', () => {
  let state = commit(reduce(create(demoSeed()), { type: 'KEEP_RESULT_ONLY' })).state;
  const raw = view(state).intake.text;
  state = dispatch(state, { type: 'EDIT_INTAKE', text: 'replace' }, { type: 'REMOVE_MATERIAL', id: 'demo-screenshot-note' }, { type: 'UNLINK_MATTER' });
  assert.equal(view(state).intake.text, raw); assert.equal(view(state).intake.materials.length, 1);
  assert.equal(view(state).identity.matterId, 'demo-matter-recall');
  state = reduce(state, { type: 'KEEP_RESULT_ONLY' }); assert.equal(pending(state), null);
});
test('result-only save can later open a reviewed revision without duplicating evidence', () => {
  const saved = commit(reduce(revision(), { type: 'KEEP_RESULT_ONLY' }));
  const next = commit(reduce(saved.state, { type: 'CONFIRM_REVISION' }), saved.host);
  assert.equal(next.host.results.length, 1); assert.equal(next.host.revisions.length, 1);
  assert.equal(view(next.state).screen, 'completed');
});
test('fragment identity is exact text + offsets + baseVersion, stale selections rejected', () => {
  let state = demo('impact').state;
  const before = view(state).impact.fragments;
  for (const patch of [{ baseVersion: 2 }, { text: 'wrong' }, { start: -1 }, { end: 999 }]) state = reduce(state, { type: 'SELECT_FRAGMENT', start: 0, end: 4, text: DEMO_BEFORE.slice(0, 4), baseVersion: 3, ...patch });
  assert.deepEqual(view(state).impact.fragments, before);
});
test('UTF-16 selection cannot split an emoji surrogate pair', () => {
  const seed = { ...demoSeed(), matter: { ...demoSeed().matter, understanding: '甲😀乙' } };
  let state = create(seed);
  state = reduce(state, { type: 'SELECT_FRAGMENT', start: 1, end: 2, text: '甲😀乙'.slice(1, 2), baseVersion: 3 });
  assert.equal(view(state).impact.fragments.length, 0);
  state = reduce(state, { type: 'SELECT_FRAGMENT', start: 1, end: 3, text: '😀', baseVersion: 3 });
  assert.equal(view(state).impact.fragments.length, 1);
});
test('separate fragments can have support and limit relations; removing selection repairs state', () => {
  let state = demo('impact').state;
  state = reduce(state, { type: 'SELECT_FRAGMENT', start: 0, end: 4, text: DEMO_BEFORE.slice(0, 4), baseVersion: 3 });
  const id = view(state).impact.selectedFragmentId;
  state = reduce(state, { type: 'SET_RELATION', fragmentId: id, relation: 'support', note: '只指认出位置' });
  assert.deepEqual(view(state).impact.fragments.map(f => f.relation), ['limit', 'support']);
  state = reduce(state, { type: 'REMOVE_FRAGMENT', id });
  assert.equal(view(state).impact.selectedFragmentId, null); assert.equal(view(state).impact.fragments.length, 1);
});
test('relation suggestion and revision draft do not mutate any host state', () => {
  const host = createFixtureHost(), state = demo('revision').state;
  assert.equal(view(state).revision.before, DEMO_BEFORE); assert.equal(view(state).revision.after, DEMO_AFTER);
  assert.equal(view(state).impact.fragments[0].status, 'proposed');
  assert.equal(host.matter.understanding, DEMO_BEFORE); assert.equal(host.results.length, 0); assert.equal(pending(state), null);
});
test('draft storage is local and does not display result saved or screen five', () => {
  const state = reduce(revision(), { type: 'SAVE_DRAFT' });
  assert.equal(view(state).status.phase, 'draft'); assert.equal(pending(state), null);
  assert.equal(view(state).status.resultSaved, false); assert.notEqual(view(state).screen, 'completed');
});
test('empty or identical revision is not submitted', () => {
  for (const after of ['', '  ', DEMO_BEFORE]) {
    const state = dispatch(revision(), { type: 'EDIT_REVISION', after }, { type: 'CONFIRM_REVISION' });
    assert.equal(pending(state), null);
  }
});
test('confirmation creates a complete immutable command but stays in screen four until receipt', () => {
  const original = revision(), state = reduce(original, { type: 'CONFIRM_REVISION' }), c = pending(state);
  assert.equal(c.operation, 'revise-understanding'); assert.equal(c.expectedVersion, 3); assert.equal(c.expectedDraftVersion, 7);
  assert.equal(c.snapshot.revision.before, DEMO_BEFORE); assert.equal(c.snapshot.revision.after, DEMO_AFTER);
  assert.equal(c.scope, 'matter-current-understanding'); assert.equal(view(state).screen, 'revision');
  assert.equal(view(state).receipt, null); assert.equal(pending(original), null);
  c.snapshot.revision.after = 'mutated view'; assert.equal(pending(state).snapshot.revision.after, DEMO_AFTER);
});
test('duplicate confirmation never creates a second pending command', () => {
  const state = requested(); assert.deepEqual(pending(reduce(state, { type: 'CONFIRM_REVISION' })), pending(state));
});
test('only correctly matched host success enters completed and updates projected version', () => {
  const result = commit(requested());
  assert.equal(result.host.matter.understanding, DEMO_AFTER); assert.equal(result.host.matter.version, 4);
  assert.equal(result.host.results.length, 1); assert.equal(result.host.revisions.length, 1);
  assert.equal(view(result.state).screen, 'completed'); assert.equal(view(result.state).intake.matter.version, 4);
});
test('wrong command, operation, object, fingerprint or session receipt cannot resolve pending', () => {
  const state = requested(), receipt = applyFixtureCommand(createFixtureHost(), pending(state)).receipt;
  for (const key of ['commandId', 'operationId', 'operation', 'resultId', 'matterId', 'workId', 'sessionKey', 'fingerprint', 'snapshotFingerprint']) {
    const actual = reduce(state, { type: 'HOST_RECEIPT', receipt: { ...receipt, [key]: 'wrong' } });
    assert.deepEqual(actual, state, key);
  }
});
test('forged success shape without saved result, exact after or monotonic version is rejected', () => {
  const state = requested(), receipt = applyFixtureCommand(createFixtureHost(), pending(state)).receipt;
  for (const patch of [{ resultSaved: false }, { resultFingerprint: 'wrong' }, { version: 3 }, { after: 'wrong' }, { draftVersion: 7 }, { revisionId: null }]) {
    const actual = reduce(state, { type: 'HOST_RECEIPT', receipt: { ...receipt, ...patch } });
    assert.notEqual(view(actual).screen, 'completed'); assert.equal(view(actual).status.phase, 'conflict');
    assert.equal(view(actual).revision.after, DEMO_AFTER);
  }
});
test('failed save leaves draft; retry issues new attempt ID with same operation idempotency key', () => {
  let state = requested(); const old = pending(state);
  state = commit(state, createFixtureHost(), { fail: 'network_error' }).state;
  assert.equal(view(state).status.phase, 'failed'); assert.equal(view(state).revision.after, DEMO_AFTER);
  state = reduce(state, { type: 'RETRY_COMMAND' });
  assert.notEqual(pending(state).commandId, old.commandId); assert.equal(pending(state).operationId, old.operationId);
  assert.deepEqual(pending(state).snapshot, old.snapshot);
  assert.equal(view(commit(state).state).screen, 'completed');
});
test('late original receipt cannot resolve the newer retry attempt', () => {
  const state = requested(), oldReceipt = applyFixtureCommand(createFixtureHost(), pending(state)).receipt;
  let retried = reduce(commit(state, createFixtureHost(), { fail: 'network_error' }).state, { type: 'RETRY_COMMAND' });
  assert.deepEqual(reduce(retried, { type: 'HOST_RECEIPT', receipt: oldReceipt }), retried);
});
test('host committed but reply was lost: retry replays stable operation without another revision', () => {
  const state = requested(), committed = applyFixtureCommand(createFixtureHost(), pending(state));
  let retried = reduce(commit(state, createFixtureHost(), { fail: 'network_error' }).state, { type: 'RETRY_COMMAND' });
  const result = commit(retried, committed.host);
  assert.equal(result.receipt.replayed, true); assert.equal(result.host.revisions.length, 1); assert.equal(result.host.results.length, 1);
  assert.equal(view(result.state).screen, 'completed');
});
test('duplicate successful receipt and command are read-only replays', () => {
  const state = requested(), result = commit(state);
  assert.deepEqual(reduce(result.state, { type: 'HOST_RECEIPT', receipt: result.receipt }), result.state);
  const again = applyFixtureCommand(result.host, pending(state)); assert.equal(again.host.revisions.length, 1);
  assert.deepEqual(again.receipt, result.receipt);
});
test('host later version rejects pending commit atomically, retaining no partial result', () => {
  const host = createFixtureHost(); host.matter.version = 4; host.matter.understanding = '别人后来修改';
  const result = commit(requested(), host);
  assert.equal(result.receipt.ok, false); assert.equal(result.host.results.length, 0);
  assert.equal(view(result.state).status.phase, 'conflict'); assert.equal(view(result.state).revision.after, DEMO_AFTER);
});
test('unsaved host draft blocks revision even if saved version did not change', () => {
  const host = createFixtureHost(); host.matter.hasUnsavedDraft = true;
  const result = commit(requested(), host); assert.equal(result.receipt.ok, false); assert.equal(result.host.results.length, 0);
});
test('host snapshot arriving before older receipt cannot roll local projection backward', () => {
  const state = requested(), receipt = applyFixtureCommand(createFixtureHost(), pending(state)).receipt;
  let latest = reduce(state, { type: 'HOST_SNAPSHOT', matter: { ...demoSeed().matter, understanding: '最新理解', version: 5, draftVersion: 9 } });
  latest = reduce(latest, { type: 'HOST_RECEIPT', receipt });
  assert.equal(view(latest).intake.matter.version, 5); assert.equal(view(latest).intake.matter.understanding, '最新理解');
  assert.equal(view(latest).status.phase, 'conflict'); assert.notEqual(view(latest).screen, 'completed');
});
test('new local edits while pending survive receipt and are not falsely marked completed', () => {
  let state = requested(); const command = pending(state);
  state = reduce(state, { type: 'EDIT_REVISION', after: '用户后来继续编辑的草稿' });
  assert.equal(pending(state).snapshot.revision.after, DEMO_AFTER);
  const result = applyFixtureCommand(createFixtureHost(), command);
  state = reduce(state, { type: 'HOST_RECEIPT', receipt: result.receipt });
  assert.equal(view(state).revision.after, '用户后来继续编辑的草稿');
  assert.equal(view(state).status.phase, 'draft'); assert.equal(view(state).screen, 'revision');
  assert.equal(view(state).intake.matter.understanding, DEMO_AFTER);
});
test('editing after failure invalidates retry of stale snapshot', () => {
  const state = commit(requested(), createFixtureHost(), { fail: 'network_error' }).state;
  const edited = dispatch(state, { type: 'EDIT_REVISION', after: '新内容' }, { type: 'RETRY_COMMAND' });
  assert.equal(pending(edited), null); assert.equal(view(edited).status.canRetry, false);
});
test('rebase keeps user text, requires new anchors and never auto-confirms', () => {
  let state = reduce(revision(), { type: 'HOST_SNAPSHOT', matter: { ...demoSeed().matter, understanding: '新版本的理解', version: 4, draftVersion: 8 } });
  state = reduce(state, { type: 'REBASE_REVISION' });
  assert.equal(view(state).revision.after, DEMO_AFTER); assert.equal(view(state).impact.fragments.length, 0);
  state = reduce(state, { type: 'SELECT_FRAGMENT', start: 0, end: 3, text: '新版本', baseVersion: 4 });
  state = reduce(state, { type: 'OPEN_REVISION' });
  assert.equal(view(state).revision.after, DEMO_AFTER); assert.equal(view(state).revision.before, '新版本的理解');
  assert.equal(pending(state), null);
});
test('undo awaits receipt, restores old text with a higher version, keeps original result', () => {
  const saved = commit(requested());
  let state = reduce(saved.state, { type: 'REQUEST_UNDO' });
  assert.equal(view(state).intake.matter.version, 4); assert.equal(pending(state).operation, 'undo-revision');
  const undone = commit(state, saved.host);
  assert.equal(undone.host.matter.understanding, DEMO_BEFORE); assert.equal(undone.host.matter.version, 5);
  assert.equal(undone.host.results.length, 1); assert.equal(undone.host.revisions.length, 2);
  assert.equal(view(undone.state).status.phase, 'undone'); assert.equal(view(undone.state).status.resultSaved, true);
  assert.equal(view(undone.state).status.canUndo, false); assert.notEqual(view(undone.state).screen, 'completed');
});
test('failed undo can retry while original revised understanding and raw result remain', () => {
  const saved = commit(requested());
  const failed = commit(reduce(saved.state, { type: 'REQUEST_UNDO' }), saved.host, { fail: 'network_error' });
  assert.equal(failed.host.matter.version, 4); assert.equal(view(failed.state).receipt.undone, false);
  const retried = commit(reduce(failed.state, { type: 'RETRY_COMMAND' }), saved.host);
  assert.equal(retried.host.matter.version, 5); assert.equal(retried.host.results.length, 1);
});
test('later version or same-version draft edit forbids stale undo', () => {
  for (const patch of [{ version: 5, draftVersion: 9, understanding: 'later' }, { version: 4, draftVersion: 9, hasUnsavedDraft: true, understanding: DEMO_AFTER }]) {
    let state = commit(requested()).state;
    state = reduce(state, { type: 'HOST_SNAPSHOT', matter: { ...demoSeed().matter, ...patch } });
    assert.equal(view(state).status.canUndo, false); assert.equal(pending(reduce(state, { type: 'REQUEST_UNDO' })), null);
  }
});
test('old version viewer toggles without modifying current content', () => {
  const saved = commit(requested()).state;
  const opened = reduce(saved, { type: 'VIEW_OLD_VERSION' }); assert.equal(view(opened).oldVersionOpen, true);
  assert.equal(view(opened).receipt.before, DEMO_BEFORE); assert.equal(view(opened).intake.matter.understanding, DEMO_AFTER);
  assert.equal(view(reduce(opened, { type: 'VIEW_OLD_VERSION' })).oldVersionOpen, false);
});
test('no original understanding permits result-only and refuses invented revision', () => {
  const seed = { ...demoSeed(), matter: { ...demoSeed().matter, understanding: '', version: 0 }, suggestion: undefined, isDemo: false };
  let state = dispatch(create(seed), { type: 'OPEN_IMPACT' }, { type: 'OPEN_REVISION', after: 'invented' }, { type: 'CONFIRM_REVISION' });
  assert.equal(pending(state), null); assert.equal(view(state).impact.understanding, '');
  const saved = commit(reduce(state, { type: 'KEEP_RESULT_ONLY' }), createFixtureHost(seed));
  assert.equal(saved.host.results.length, 1); assert.equal(saved.host.matter.understanding, '');
});
test('different work and matter sessions keep raw, interpretation, revision and pending isolated', () => {
  const first = demoSeed(), second = { ...demoSeed(), sessionId: 's2', workId: 'w2', resultId: 'r2', rawText: '第二个工作', comparison: {}, matter: { id: 'm2', title: '第二件事', version: 1, understanding: '第二个理解', draftVersion: 0 } };
  let state = create({ instanceId: 'isolation', sessions: [first, second] }); const key1 = state.activeKey, key2 = state.sessions[1].key;
  state = reduce(state, { type: 'EDIT_COMPARISON', field: 'interpretation', text: '第一份解释' });
  state = reduce(state, { type: 'KEEP_RESULT_ONLY' }); const command = pending(state);
  state = reduce(state, { type: 'SWITCH_SESSION', key: key2 }); assert.equal(view(state).comparison.interpretation, '');
  state = reduce(state, { type: 'EDIT_COMPARISON', field: 'interpretation', text: '第二份解释' });
  const outcome = applyFixtureCommand(createFixtureHost(), command);
  state = reduce(state, { type: 'HOST_RECEIPT', receipt: outcome.receipt }); assert.equal(state.activeKey, key2);
  assert.equal(view(state).comparison.interpretation, '第二份解释');
  state = reduce(state, { type: 'SWITCH_SESSION', key: key1 });
  assert.equal(view(state).comparison.interpretation, '第一份解释'); assert.equal(view(state).status.resultSaved, true);
});
test('changing association selects independent draft and restores old matter draft on return', () => {
  let state = create(demoSeed());
  state = reduce(state, { type: 'EDIT_COMPARISON', field: 'interpretation', text: '第一件事解释' });
  state = reduce(state, { type: 'LINK_MATTER', matter: { id: 'other', title: '另一件事', version: 1, understanding: 'other' } });
  assert.equal(view(state).comparison.interpretation, ''); assert.equal(view(state).identity.returnAnchor, null);
  state = reduce(state, { type: 'EDIT_COMPARISON', field: 'interpretation', text: '另一件事解释' });
  state = reduce(state, { type: 'LINK_MATTER', matter: demoSeed().matter });
  assert.equal(view(state).comparison.interpretation, '第一件事解释');
});
test('retry work requires explicit target and never submits or sends work automatically', () => {
  let state = commit(requested()).state;
  state = dispatch(state, { type: 'OPEN_RETRY' }, { type: 'CONFIRM_RETRY_TARGET' });
  assert.equal(view(state).retry.navigation, null);
  state = dispatch(state, { type: 'EDIT_RETRY_TARGET', destination: { agent: 'Codex', project: 'harness', task: '只试停点提示' } }, { type: 'CONFIRM_RETRY_TARGET' });
  assert.equal(view(state).retry.sent, false); assert.equal(view(state).retry.navigation.sent, false); assert.equal(pending(state), null);
  assert.equal(view(state).retry.navigation.matterId, view(state).identity.matterId);
  assert.equal(view(state).retry.navigation.sourceVersion, 4);
});
test('GO_SCREEN cannot bypass missing revision or host receipt', () => {
  for (const screen of ['revision', 'completed']) assert.equal(view(reduce(create(demoSeed()), { type: 'GO_SCREEN', screen })).screen, 'intake');
});
test('selectors and reducer preserve source objects, and stale host snapshots cannot regress state', () => {
  const state = commit(requested()).state, before = structuredClone(state);
  const detached = view(state); detached.intake.matter.understanding = 'oops'; detached.receipt.after = 'oops';
  assert.deepEqual(state, before);
  const older = reduce(state, { type: 'HOST_SNAPSHOT', matter: demoSeed().matter });
  assert.equal(view(older).intake.matter.version, 4);
});
test('host fixture rejects changed payload under original command fingerprint', () => {
  const c = pending(requested()); c.snapshot.revision.after = 'tampered';
  assert.equal(applyFixtureCommand(createFixtureHost(), c).receipt.ok, false);
});
test('command fingerprints are stable for property ordering, not security signatures', () => {
  assert.equal(canonical({ b: 1, a: [2, 3] }), canonical({ a: [2, 3], b: 1 }));
});

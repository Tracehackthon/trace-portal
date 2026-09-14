import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS, createChainState, createChainDemo, reduceChain, selectChainView } from './chain-model.mjs';

const view = selectChainView;
const act = (state, type, fields = {}) => reduceChain(state, { type, ...fields });
function capture(text = '我这次的原话') {
  return act(act(createChainState(), 'CAPTURE_DRAFT', { text }), 'CAPTURE', { intent: 'discuss' });
}
function save(state, text = '这是我自己的理解。') {
  return act(act(state, 'UNDERSTANDING_DRAFT', { text }), 'SAVE_UNDERSTANDING');
}
function result(state, patch = {}) {
  return act(state, 'RESULT_DRAFT', { patch: { fact: '这一次没有写附言，也接回了问题。', interpretation: '可能与问题一起保留有关。', unconfirmed: '换个情形会怎样？', proposedUnderstanding: '部分情况下，不写附言也能接回。', ...patch } });
}
function roundtrip(state = save(capture())) {
  state = act(state, 'STOP_DRAFT', { text: '我的原停点' });
  state = act(state, 'CONFIRM_HANDOFF');
  return act(result(state), 'COMMIT_REVISION');
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}

test('empty baseline has neither historical understanding nor auto-assigned sources', () => {
  const v = view(createChainState());
  assert.equal(v.screen, 'reading');
  assert.equal(v.selectedId, null);
  assert.deepEqual(v.matters, []);
  assert.equal(v.matter.understanding, '');
  assert.deepEqual(v.matter.sources, []);
  assert.ok(v.availableSources.every((s) => s.kind.startsWith('example-')));
});

test('first capture preserves exact user words and no title, summary or history is invented', () => {
  const text = '  只是还没说清的一点\n，不是结论。  ';
  const v = view(capture(text));
  assert.equal(v.matter.originalText, text);
  assert.equal(v.matter.whyCare, text);
  assert.equal(v.matter.title, '');
  for (const field of ['stop', 'understanding', 'understandingDraft']) assert.equal(v.matter[field], '');
  for (const field of ['revisions', 'results', 'observations', 'branches']) assert.deepEqual(v.matter[field], []);
  assert.deepEqual(v.discussion.messages, []);
});

test('empty and whitespace-only capture refused; source-only capture succeeds', () => {
  let state = act(createChainState(), 'CAPTURE');
  assert.equal(view(state).matters.length, 0);
  state = act(state, 'CAPTURE_DRAFT', { text: ' \n ' });
  state = act(state, 'CAPTURE');
  assert.equal(view(state).matters.length, 0);
  state = act(state, 'TOGGLE_SOURCE', { id: 'source-article' });
  state = act(state, 'CAPTURE', { intent: 'leave' });
  assert.equal(view(state).screen, 'paused');
  assert.equal(view(state).matter.sources[0].id, 'source-article');
  assert.equal(view(state).matter.understanding, '');
});

test('excerpt and personal expression remain separate; selection alone is not capture', () => {
  let state = createChainState();
  state = act(state, 'CAPTURE_EXCERPT', { sourceId: 'source-article', text: '原文选中的一句' });
  state = act(state, 'CAPTURE_DRAFT', { text: '我现在有另一种感受' });
  assert.equal(view(state).matters.length, 0);
  state = act(state, 'CAPTURE');
  assert.equal(view(state).matter.originalText, '原文选中的一句');
  assert.equal(view(state).matter.whyCare, '我现在有另一种感受');
});

test('removing excerpt source removes hidden excerpt but not personal input', () => {
  let state = act(createChainState(), 'CAPTURE_EXCERPT', { sourceId: 'source-article', text: '摘录' });
  state = act(state, 'CAPTURE_DRAFT', { text: '个人输入' });
  state = act(state, 'TOGGLE_SOURCE', { id: 'source-article' });
  assert.equal(view(state).capture.excerpt, '');
  assert.deepEqual(view(state).capture.sourceIds, []);
  state = act(state, 'CAPTURE');
  assert.deepEqual(view(state).matter.sources, []);
  assert.equal(view(state).matter.originalText, '个人输入');
});

test('invalid source rejected and a later excerpt cannot mutate already captured matter', () => {
  let state = act(createChainState(), 'CAPTURE_EXCERPT', { sourceId: 'unknown', text: '不应进来' });
  assert.equal(view(state).capture.excerpt, '');
  state = capture();
  const before = view(state).matter;
  state = act(state, 'CAPTURE_EXCERPT', { sourceId: 'source-article', text: '新的原文' });
  assert.deepEqual(view(state).matter, before);
});

test('draft, explicit save, stop, collapse and reopen form a narrow continuous loop', () => {
  let state = capture(); const id = view(state).selectedId;
  state = act(state, 'NAVIGATE', { screen: 'understanding' });
  state = act(state, 'UNDERSTANDING_DRAFT', { text: '尚未保存的理解' });
  assert.equal(view(state).matter.understanding, '');
  state = act(state, 'SAVE_UNDERSTANDING');
  state = act(state, 'STOP_DRAFT', { text: '还没分清的条件' });
  state = act(state, 'COLLAPSE'); state = act(state, 'REOPEN');
  assert.equal(view(state).selectedId, id);
  assert.equal(view(state).matter.understanding, '尚未保存的理解');
  assert.equal(view(state).matter.stop, '还没分清的条件');
  assert.equal(view(state).handoff.confirmed, false);
  assert.equal(view(state).handoffSnapshot, null);
});

test('collapse undo restores only screen and never rolls back a later draft', () => {
  let state = act(capture(), 'NAVIGATE', { screen: 'understanding' });
  state = act(state, 'COLLAPSE');
  state = act(state, 'UNDERSTANDING_DRAFT', { text: '收起之后的新编辑' });
  state = act(state, 'UNDO_COLLAPSE');
  assert.equal(view(state).screen, 'understanding');
  assert.equal(view(state).matter.understandingDraft, '收起之后的新编辑');
});

test('navigation does not manufacture result, adoption or revisions and revised cannot be bypassed', () => {
  let state = save(capture()); const before = view(state).matter;
  for (const screen of ['resume', 'understanding', 'reentry', 'handoff', 'results', 'revised']) state = act(state, 'NAVIGATE', { screen });
  assert.notEqual(view(state).screen, 'revised');
  assert.deepEqual(view(state).matter, before);
  assert.equal(view(state).handoff.confirmed, false);
  assert.deepEqual(view(state).matter.results, []);
});

test('fresh context removes old understanding, sources and all prior conversation from provided context', () => {
  let state = createChainDemo('discussion');
  state = act(state, 'COMPOSER_DRAFT', { text: '这是旧讨论' }); state = act(state, 'SEND');
  state = act(state, 'FRESH_CONTEXT');
  const fresh = view(state).context;
  for (const field of ['whyCare', 'understanding', 'stop']) assert.equal(fresh[field], '');
  assert.deepEqual(fresh.sources, []); assert.deepEqual(fresh.messages, []);
  state = act(state, 'COMPOSER_DRAFT', { text: '这次先重新看' }); state = act(state, 'SEND');
  assert.deepEqual(view(state).context.messages.map((m) => m.text), ['这次先重新看']);
  assert.equal(view(state).discussion.text, '这次先重新看');
  assert.deepEqual(view(state).discussion.cases, []);
  assert.equal(view(state).discussion.possibility, '');
  state = act(state, 'FOCUS', { field: 'discussion', start: 0, end: 2, text: '这次' });
  assert.equal(view(state).focus.text, '这次');
  state = act(state, 'RESUME_CONTEXT');
  assert.notEqual(view(state).context.understanding, '');
  assert.equal(view(state).matter.revisions.length, 0);
});

test('a second fresh context starts a new isolated boundary, not the previous fresh conversation', () => {
  let state = act(capture(), 'FRESH_CONTEXT');
  state = act(state, 'COMPOSER_DRAFT', { text: '上一次 fresh 的话' }); state = act(state, 'SEND');
  state = act(state, 'RESUME_CONTEXT'); state = act(state, 'FRESH_CONTEXT');
  assert.deepEqual(view(state).context.messages, []);
});

test('send keeps literal user text and valid focus, and generates no pretend model answer', () => {
  let state = createChainDemo('discussion');
  const text = '<script>alert(1)</script>\n中文原话';
  state = act(state, 'COMPOSER_DRAFT', { text }); state = act(state, 'SEND');
  const message = view(state).discussion.messages.at(-1);
  assert.equal(message.text, text); assert.equal(message.role, 'user');
  assert.equal(message.focus.text, '第二种好像更需要我自己写点什么。');
  assert.equal(view(state).composer.text, '');
});

test('focus verifies real selected range, can clear, and branch keeps precise origin', () => {
  let state = createChainDemo('discussion');
  state = act(state, 'BRANCH');
  const branch = view(state).matter.branches[0];
  assert.equal(branch.origin.matterId, view(state).selectedId);
  assert.equal(branch.text, branch.origin.text);
  const oldFocus = view(state).focus;
  state = act(state, 'FOCUS', { field: 'discussion', start: 0, end: 2, text: '伪造' });
  assert.deepEqual(view(state).focus, oldFocus);
  state = act(state, 'CLEAR_FOCUS'); assert.equal(view(state).focus, null);
});

test('selection to understanding appends a draft but does not adopt or replace the whole text', () => {
  let state = createChainDemo('discussion');
  const before = view(state).matter.understanding;
  const selected = view(state).focus.text;
  state = act(state, 'FOCUS_TO_UNDERSTANDING');
  assert.equal(view(state).matter.understanding, before);
  assert.equal(view(state).matter.understandingDraft, `${before}\n\n${selected}`);
});

test('comparison link returns to its actual origin and does not adopt conclusion', () => {
  let state = act(save(capture()), 'NAVIGATE', { screen: 'understanding' });
  const before = view(state).matter.understanding;
  state = act(state, 'OPEN_COMPARISON', { sourceId: 'source-comparison' });
  state = act(state, 'RELATION_DRAFT', { relation: 'limitation', target: '只讨论是否每次都要附言' });
  state = act(state, 'LINK_COMPARISON');
  assert.equal(view(state).screen, 'understanding');
  assert.equal(view(state).matter.understanding, before);
  assert.equal(view(state).matter.observations.at(-1).relation, 'limitation');
});

test('reject comparison retains material but does not include rejected association in context', () => {
  let state = save(capture());
  state = act(state, 'OPEN_COMPARISON', { sourceId: 'source-comparison' });
  state = act(state, 'LINK_COMPARISON');
  state = act(state, 'REJECT_COMPARISON');
  assert.equal(view(state).comparison.decision, 'rejected');
  assert.ok(view(state).availableSources.find((m) => m.id === 'source-comparison'));
  assert.equal(view(state).matter.observations.length, 0);
  assert.equal(view(state).context.sources.some((m) => m.id === 'source-comparison'), false);
});

test('exact local replacement changes only one duplicate occurrence and supports safe undo', () => {
  let state = save(capture(), '甲相同乙，相同丙');
  state = act(state, 'SUGGEST', { start: 1, end: 3, replacement: '新说法' });
  state = act(state, 'ACCEPT_SUGGESTION');
  assert.equal(view(state).matter.understandingDraft, '甲新说法乙，相同丙');
  assert.equal(view(state).matter.understanding, '甲相同乙，相同丙');
  assert.equal(view(state).undo.suggestion, true);
  state = act(state, 'UNDO_SUGGESTION');
  assert.equal(view(state).matter.understandingDraft, '甲相同乙，相同丙');
});

test('suggestion with stale draft version cannot overwrite even when original substring still matches', () => {
  let state = save(capture(), '甲原句乙');
  state = act(state, 'SUGGEST', { start: 1, end: 3, replacement: '建议' });
  state = act(state, 'UNDERSTANDING_DRAFT', { text: '甲原句乙我后来写的' });
  state = act(state, 'ACCEPT_SUGGESTION');
  assert.equal(view(state).matter.understandingDraft, '甲原句乙我后来写的');
  assert.equal(view(state).suggestion.status, 'stale');
});

test('suggestion version check detects edit-away then edit-back (ABA)', () => {
  let state = save(capture(), '原句');
  state = act(state, 'SUGGEST', { start: 0, end: 2, replacement: '建议' });
  state = act(state, 'UNDERSTANDING_DRAFT', { text: '临时' });
  state = act(state, 'UNDERSTANDING_DRAFT', { text: '原句' });
  state = act(state, 'ACCEPT_SUGGESTION');
  assert.equal(view(state).matter.understandingDraft, '原句');
  assert.equal(view(state).suggestion.status, 'stale');
});

test('dismiss has no content mutation; expired suggestion undo cannot overwrite later draft or save', () => {
  let state = save(capture(), '原句');
  state = act(state, 'SUGGEST', { start: 0, end: 2, replacement: '建议' });
  state = act(state, 'DISMISS_SUGGESTION');
  assert.equal(view(state).matter.understandingDraft, '原句');
  state = act(state, 'SUGGEST', { start: 0, end: 2, replacement: '建议' });
  state = act(state, 'ACCEPT_SUGGESTION'); state = act(state, 'SAVE_UNDERSTANDING');
  state = act(state, 'UNDO_SUGGESTION');
  assert.equal(view(state).matter.understandingDraft, '建议');
  assert.equal(view(state).undo.suggestion, false);
});

test('invalid selection offsets never corrupt text including surrogate pair bounds', () => {
  let state = save(capture(), '甲😀乙');
  for (const fields of [{ start: -1, end: 2 }, { start: 0, end: 20 }, { start: 2, end: 3 }, { start: 0.2, end: 2 }]) {
    state = act(state, 'SUGGEST', { ...fields, replacement: '改' });
    state = act(state, 'ACCEPT_SUGGESTION');
  }
  assert.equal(view(state).matter.understandingDraft, '甲😀乙');
});

test('new material can remain unrelated or saved; raw source survives and understanding does not change', () => {
  for (const decision of ['unrelated', 'saved']) {
    let state = save(capture()); const before = view(state).matter.understanding;
    state = act(state, 'INCOMING_DRAFT', { text: '这是另一件事的新观察' });
    state = act(state, 'INCOMING_DECISION', { decision });
    assert.equal(view(state).matter.understanding, before);
    assert.equal(view(state).matter.observations.length, 0);
    assert.equal(view(state).unassignedMaterials[0].text, '这是另一件事的新观察');
    assert.ok(view(state).availableSources.find((s) => s.id === view(state).incoming.sourceId));
  }
});

test('incorrect incoming link can be removed without deleting source or changing understanding', () => {
  let state = save(capture());
  state = act(state, 'INCOMING_DRAFT', { text: '关联有误的观察' });
  state = act(state, 'INCOMING_DECISION', { decision: 'linked' });
  const id = view(state).incoming.sourceId;
  state = act(state, 'INCOMING_DECISION', { decision: 'unrelated' });
  assert.equal(view(state).matter.sources.some((s) => s.id === id), false);
  assert.equal(view(state).matter.observations.length, 0);
  assert.ok(view(state).availableSources.find((s) => s.id === id));
});

test('handoff rejects missing destination and scope widening, supports distinct reference/trial/exclude', () => {
  let state = save(capture());
  state = act(state, 'HANDOFF_DRAFT', { patch: { scope: 'forever' } });
  assert.equal(view(state).handoff.scope, 'current-task');
  state = act(state, 'HANDOFF_DRAFT', { patch: { destination: { task: '' } } });
  state = act(state, 'CONFIRM_HANDOFF'); assert.equal(view(state).handoffSnapshot, null);
  state = act(state, 'HANDOFF_DRAFT', { patch: { destination: { task: '我的任务' }, role: 'reference' } });
  state = act(state, 'CONFIRM_HANDOFF'); assert.equal(view(state).handoffSnapshot.role, 'reference');
  assert.equal(view(state).handoffSnapshot.scope, 'current-task');
  assert.equal(view(state).handoffSnapshot.actualDelivery, false);
  assert.equal(view(state).handoffSnapshot.evidenceLevel, 'none');
  state = act(state, 'EXCLUDE_HANDOFF');
  assert.equal(view(state).handoffSnapshot, null);
  assert.equal(view(state).handoff.role, 'exclude');
  assert.equal(view(state).matter.understanding, '这是我自己的理解。');
});

test('confirmed handoff is a snapshot and later understanding edits cannot silently change it', () => {
  let state = act(save(capture(), '旧理解'), 'CONFIRM_HANDOFF');
  const snapshot = view(state).handoffSnapshot;
  state = save(state, '用户后来保存的新理解');
  assert.deepEqual(view(state).handoffSnapshot, snapshot);
  assert.equal(view(state).handoff.selectedText, '旧理解');
  assert.equal(view(state).matter.understanding, '用户后来保存的新理解');
});

test('an explicitly selected older handoff text is not relabeled as a newer understanding version', () => {
  let state = save(capture(), '旧理解');
  const oldVersion = view(state).matter.understandingVersion;
  state = act(state, 'HANDOFF_DRAFT', { patch: { selectedText: '旧理解' } });
  state = save(state, '新理解'); state = act(state, 'CONFIRM_HANDOFF');
  assert.equal(view(state).handoffSnapshot.understandingVersion, oldVersion);
  assert.equal(view(state).handoffSnapshot.selectedText, '旧理解');
});

test('work findings preserve precise work origin and do not count as results or revisions', () => {
  let state = act(save(capture()), 'CONFIRM_HANDOFF');
  state = act(state, 'WORK_FINDING', { text: '此处仍需要观察' });
  const v = view(state);
  assert.equal(v.workFindings[0].origin.matterId, v.selectedId);
  assert.equal(v.workFindings[0].origin.handoffId, v.handoffSnapshot.id);
  assert.deepEqual(v.matter.results, []); assert.deepEqual(v.matter.revisions, []);
});

test('no facts means no result, even when interpretation or proposed understanding exists', () => {
  let state = save(capture());
  state = result(state, { fact: '  ' });
  state = act(state, 'KEEP_RESULT_ONLY'); state = act(state, 'COMMIT_REVISION');
  assert.equal(view(state).matter.results.length, 0);
  assert.equal(view(state).matter.revisions.length, 0);
});

test('KEEP_RESULT_ONLY leaves understanding, draft and stop bit-for-bit unchanged and deduplicates repeat click', () => {
  let state = save(capture()); state = act(state, 'STOP_DRAFT', { text: '旧停点' });
  state = act(state, 'UNDERSTANDING_DRAFT', { text: '另外的未保存草稿' });
  const before = view(state).matter;
  state = act(result(state), 'KEEP_RESULT_ONLY'); state = act(state, 'KEEP_RESULT_ONLY');
  for (const field of ['understanding', 'understandingDraft', 'stop', 'understandingVersion']) assert.equal(view(state).matter[field], before[field]);
  assert.equal(view(state).matter.results.length, 1);
  assert.equal(view(state).matter.revisions.length, 0);
  assert.equal(view(state).result.decision, 'result-only');
});

test('revision returns to the same ID, restores latest understanding and stop after reopen and next handoff', () => {
  let state = save(capture()); const id = view(state).selectedId;
  state = roundtrip(state);
  assert.equal(view(state).screen, 'revised'); assert.equal(view(state).selectedId, id);
  state = act(state, 'COLLAPSE'); state = act(state, 'REOPEN');
  assert.equal(view(state).context.understanding, '部分情况下，不写附言也能接回。');
  assert.equal(view(state).context.stop, '换个情形会怎样？');
  state = act(state, 'TRY_AGAIN');
  assert.equal(view(state).handoff.selectedText, view(state).matter.understanding);
  assert.equal(view(state).handoff.confirmed, false);
});

test('revision undo keeps result facts and historical revision, and is one-shot', () => {
  let state = save(capture(), '此前理解'); state = act(state, 'STOP_DRAFT', { text: '此前停点' });
  state = act(result(state), 'COMMIT_REVISION');
  const facts = view(state).matter.results;
  const version = view(state).matter.understandingVersion;
  state = act(state, 'UNDO_REVISION');
  assert.equal(view(state).matter.understanding, '此前理解');
  assert.equal(view(state).matter.stop, '此前停点');
  assert.deepEqual(view(state).matter.results, facts);
  assert.equal(view(state).matter.revisions[0].undone, true);
  assert.ok(view(state).matter.understandingVersion > version);
  assert.equal(view(state).undo.revision, false);
});

test('expired revision undo cannot overwrite later saved understanding, unsaved draft or stop', () => {
  for (const edit of [(s) => save(s, '更晚的理解'), (s) => act(s, 'UNDERSTANDING_DRAFT', { text: '更晚的草稿' }), (s) => act(s, 'STOP_DRAFT', { text: '更晚的停点' })]) {
    let state = edit(roundtrip()); const before = view(state).matter;
    state = act(state, 'UNDO_REVISION');
    assert.deepEqual(view(state).matter, before);
    assert.equal(view(state).undo.revision, false);
  }
});

test('identical proposed understanding saves only facts and does not manufacture a change', () => {
  let state = save(capture(), '不变的理解');
  state = result(state, { proposedUnderstanding: '不变的理解' });
  state = act(state, 'COMMIT_REVISION');
  assert.equal(view(state).matter.results.length, 1); assert.equal(view(state).matter.revisions.length, 0);
  assert.equal(view(state).result.decision, 'result-only');
});

test('TRY_AGAIN preserves provided facts before opening a clean handoff, but never invents them', () => {
  let state = result(save(capture()));
  state = act(state, 'TRY_AGAIN');
  assert.equal(view(state).matter.results.length, 1);
  assert.equal(view(state).matter.results[0].fact, '这一次没有写附言，也接回了问题。');
  assert.equal(view(state).result.fact, '');
  assert.equal(view(state).handoff.confirmed, false);
  assert.equal(view(act(save(capture()), 'TRY_AGAIN')).matter.results.length, 0);
});

test('a stale proposed revision cannot overwrite subsequent edits before confirmation', () => {
  let state = result(save(capture()));
  state = save(state, '结果面打开后，我另做的新编辑');
  state = act(state, 'COMMIT_REVISION');
  assert.equal(view(state).matter.understanding, '结果面打开后，我另做的新编辑');
  assert.equal(view(state).matter.revisions.length, 0);
  state = act(state, 'RESULT_DRAFT', { patch: { proposedUnderstanding: '我核对新编辑后愿意保留的版本' } });
  state = act(state, 'COMMIT_REVISION');
  assert.equal(view(state).matter.understanding, '我核对新编辑后愿意保留的版本');
});

test('material candidates do not leak another matter’s incoming draft/source into selected matter', () => {
  let state = capture();
  state = act(state, 'INCOMING_DRAFT', { text: '属于第一件事的材料' });
  state = act(state, 'INCOMING_DECISION', { decision: 'saved' });
  const sourceId = view(state).incoming.sourceId;
  state = act(state, 'CAPTURE_DRAFT', { text: '第二件事' }); state = act(state, 'CAPTURE');
  assert.equal(view(state).availableSources.some((entry) => entry.id === sourceId), false);
  assert.deepEqual(view(state).unassignedMaterials, []);
  state = act(state, 'OPEN_COMPARISON', { sourceId });
  assert.equal(view(state).comparison, null);
  state = act(state, 'CAPTURE_EXCERPT', { sourceId, text: '残留的另一事项事件' });
  assert.equal(view(state).capture.excerpt, '');
});

test('cross-matter drafts, incoming, composer, focus, handoff and results stay isolated', () => {
  let state = roundtrip(); const firstId = view(state).selectedId;
  state = act(state, 'COMPOSER_DRAFT', { text: '第一件事的输入' });
  state = act(state, 'INCOMING_DRAFT', { text: '第一件事的新材料' });
  const first = view(state);
  state = act(state, 'CAPTURE_DRAFT', { text: '另一件完全不同的事' }); state = act(state, 'CAPTURE', { intent: 'discuss' });
  const secondId = view(state).selectedId; assert.notEqual(secondId, firstId);
  assert.equal(view(state).composer.text, ''); assert.equal(view(state).incoming.text, '');
  assert.equal(view(state).handoffSnapshot, null); assert.equal(view(state).result.fact, '');
  assert.equal(view(state).focus, null); assert.equal(view(state).matter.understandingDraft, '');
  state = save(state, '第二件事自己的理解');
  state = act(state, 'OPEN', { id: firstId });
  for (const field of ['composer', 'incoming', 'handoffSnapshot', 'result', 'matter']) assert.deepEqual(view(state)[field], first[field]);
  state = act(state, 'OPEN', { id: secondId });
  assert.equal(view(state).matter.understanding, '第二件事自己的理解');
});

test('unknown IDs/actions are safe and reducer/selector do not mutate their inputs', () => {
  let state = freeze(save(capture()));
  assert.equal(reduceChain(state, { type: 'NOT_AN_ACTION' }), state);
  const id = view(state).selectedId;
  const newState = act(state, 'OPEN', { id: 'wrong' });
  assert.equal(view(newState).selectedId, id);
  const output = view(state); output.matter.understanding = '外部篡改';
  assert.equal(view(state).matter.understanding, '这是我自己的理解。');
  state = act(state, 'UNDERSTANDING_DRAFT', { text: '纯 reducer 新状态' });
  assert.equal(view(state).matter.understandingDraft, '纯 reducer 新状态');
});

test('all eleven explicit demo views are deterministic and never share mutable fixture references', () => {
  for (const screen of SCREENS) {
    const a = createChainDemo(screen), b = createChainDemo(screen);
    assert.deepEqual(view(a), view(b)); assert.equal(view(a).screen, screen); assert.equal(view(a).isDemo, true);
    act(a, 'CAPTURE_DRAFT', { text: '修改' });
    assert.deepEqual(view(b), view(createChainDemo(screen)));
  }
});

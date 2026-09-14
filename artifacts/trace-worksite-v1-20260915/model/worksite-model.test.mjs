import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS, createWorksiteState, createWorksiteDemo, reduceWorksite, selectWorksiteView } from './worksite-model.mjs';

const view = selectWorksiteView;
const act = (state, type, payload = {}) => reduceWorksite(state, { type, ...payload });
const saved = () => createWorksiteState({ fixture: 'saved' });
const workA = 'demo-worksite-save';
const workB = 'demo-worksite-return';
const matterId = 'demo-worksite-recall';
const intakeId = 'demo-intake-recall';
const resultDraft = { matterId, fact: '实际观察：未写附言，仍借助原文想起了原因。', interpretation: '可能因为保留了现场。', unconfirmed: '其他场景尚未知。', proposedUnderstanding: '先保留现场，附言按需补充。', relation: 'limit' };
const draft = (state, patch = {}) => act(state, 'RESULT_DRAFT', { patch: { ...resultDraft, ...patch } });
const commit = state => act(act(state, 'OPEN_REVISION_REVIEW'), 'CONFIRM_REVISION');
function freeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

test('empty default contains no fabricated history, intake, impact, result or receipt', () => {
  const data = view(createWorksiteState());
  assert.equal(data.isDemo, false);
  assert.equal(data.work.connected, false);
  assert.equal(data.work.title, '尚未接入工作');
  for (const key of ['matters', 'intake', 'results', 'findings', 'contextIntakeIds']) assert.deepEqual(data[key], []);
  assert.deepEqual(data.impact.stages, { provided: false, decision: false, artifact: false, usage: false });
  assert.equal(data.result.fact, '');
  assert.equal(data.receipt, null);
});

test('five previews are explicit isolated demos, never receipts or saved user results', () => {
  for (const screen of SCREENS) {
    const state = createWorksiteDemo(screen);
    const data = view(state);
    assert.equal(data.screen, screen);
    assert.equal(data.isDemo, true);
    assert.equal(data.work.connected, false);
    assert.equal(data.receipt, null);
    assert.equal(data.results.length, 0);
  }
  const a = createWorksiteDemo('results');
  const b = createWorksiteDemo('results');
  a.sessions[workA].result.fact = 'changed';
  assert.notEqual(view(b).result.fact, 'changed');
});

test('navigation and back do not invent findings, results, revisions or usage', () => {
  let state = saved();
  const before = view(state);
  for (const screen of SCREENS) state = act(state, 'NAVIGATE', { screen });
  state = act(state, 'BACK');
  const after = view(state);
  assert.equal(after.screen, 'finding');
  for (const key of ['matters', 'findings', 'result', 'results', 'receipt', 'impact']) assert.deepEqual(after[key], before[key]);
});

test('unknown screens, actions, work IDs and intake IDs do not corrupt selection or drafts', () => {
  const state = saved();
  assert.equal(act(state, 'NAVIGATE', { screen: 'revised' }), state);
  assert.equal(act(state, 'UNRECOGNIZED'), state);
  assert.equal(view(act(state, 'SELECT_WORK', { id: 'missing' })).selectedWorkId, workA);
  assert.equal(view(act(state, 'OPEN_INTAKE', { id: 'missing' })).selectedIntakeId, view(state).selectedIntakeId);
  assert.match(view(act(state, 'SET_INTAKE_ROLE', { id: 'demo-intake-recall-later', role: 'exclude' })).notice, /不属于当前工作/);
});

test('reference, trial, contrast have distinct selector instructions; exclusion really removes context', () => {
  let state = saved();
  const before = view(state);
  const instructions = new Set();
  for (const role of ['reference', 'trial', 'contrast']) {
    state = act(state, 'SET_INTAKE_ROLE', { id: intakeId, role });
    const entry = view(state).context.find(item => item.id === intakeId);
    assert.equal(entry.role, role);
    instructions.add(entry.instruction);
    assert.equal(view(state).contextSummary[role] >= 1, true);
  }
  assert.equal(instructions.size, 3);
  state = act(state, 'SET_INTAKE_ROLE', { id: intakeId, role: 'exclude' });
  const data = view(state);
  assert.equal(data.contextIntakeIds.includes(intakeId), false);
  assert.equal(data.context.some(item => item.id === intakeId), false);
  assert.equal(data.contextSummary.exclude, 1);
  assert.equal(data.intake.length, before.intake.length);
  assert.deepEqual(data.matters, before.matters);
  assert.deepEqual(data.impact, before.impact);
  assert.deepEqual(data.decision, before.decision);
});

test('local role/note changes preserve source snapshot and do not affect other work', () => {
  let state = saved();
  const before = view(state);
  state = act(state, 'SET_INTAKE_ROLE', { id: intakeId, role: 'exclude' });
  state = act(state, 'SET_INTAKE_NOTE', { id: intakeId, text: '只在这次原型中不参考。' });
  const item = view(state).intake.find(entry => entry.id === intakeId);
  assert.equal(item.sourceText, before.intake.find(entry => entry.id === intakeId).sourceText);
  assert.equal(item.sourceVersion, 1);
  assert.deepEqual(view(state).matters, before.matters);
  state = act(state, 'SELECT_WORK', { id: workB });
  assert.equal(view(state).intake[0].role, 'contrast');
  assert.equal(view(state).intake[0].note, '');
});

test('all 16 independent stage combinations require exact stage evidence, with no cascade', () => {
  const stages = ['provided', 'decision', 'artifact', 'usage'];
  for (let mask = 0; mask < 16; mask++) {
    const expected = Object.fromEntries(stages.map((stage, index) => [stage, !!(mask & (1 << index))]));
    const evidence = stages.filter(stage => expected[stage]).map(stage => ({ id: stage, stage, text: `Actual ${stage} evidence`, source: { title: 'Provided test record' } }));
    const state = createWorksiteState({ works: [{ id: 'isolated', title: 'Stage fixture', impact: { stages: expected, evidence } }] });
    assert.deepEqual(view(state).impact.stages, expected);
  }
});

test('stage flags with no corresponding evidence never establish delivery or effectiveness', () => {
  const state = createWorksiteState({ works: [{ id: 'isolated', impact: { relation: 'confirmed', confirmed: ['An unsupported claim'], stages: { provided: true, decision: true, artifact: true, usage: true } } }] });
  assert.deepEqual(view(state).impact.stages, { provided: false, decision: false, artifact: false, usage: false });
  assert.deepEqual(view(state).impact.confirmed, []);
  assert.equal(view(state).impact.relation, 'proposed');
});

test('disputing influence preserves all original evidence and never revises understanding', () => {
  const original = saved();
  const next = act(original, 'DISPUTE_IMPACT', { text: '这里不是因为旧理解才这样实现。' });
  assert.equal(view(next).impact.relation, 'disputed');
  assert.deepEqual(view(next).impact.evidence, view(original).impact.evidence);
  assert.deepEqual(view(next).impact.stages, view(original).impact.stages);
  assert.deepEqual(view(next).matters, view(original).matters);
});

test('composer raw text and source survive opening, refusing relation, and keeping finding', () => {
  let state = saved();
  const raw = '  <script>alert("finding")</script>\n保留原话  ';
  state = act(state, 'COMPOSER_DRAFT', { text: raw });
  state = act(state, 'OPEN_FINDING');
  const sourceBefore = view(state).finding.source;
  assert.equal(view(state).finding.text, raw);
  assert.equal(view(state).finding.relation, 'pending');
  state = act(state, 'SET_FINDING_RELATION', { decision: 'unrelated' });
  state = act(state, 'KEEP_FINDING');
  assert.equal(view(state).finding.relation, 'unrelated');
  assert.equal(view(state).finding.suggestedMatterId, null);
  assert.equal(view(state).findings[0].text, raw);
  assert.deepEqual(view(state).findings[0].source, sourceBefore);
  assert.equal(view(state).results.length, 0);
});

test('empty composer and whitespace findings cannot submit', () => {
  let state = act(saved(), 'COMPOSER_DRAFT', { text: ' \n ' });
  state = act(state, 'OPEN_FINDING');
  assert.equal(view(state).screen, 'overview');
  state = act(state, 'FINDING_DRAFT', { patch: { text: ' \n ' } });
  state = act(state, 'KEEP_FINDING');
  state = act(state, 'USE_FINDING_IN_WORK');
  assert.equal(view(state).findings.length, 0);
  assert.equal(view(state).contextFindings.length, 0);
});

test('finding relation requires valid matter but never adopts the finding as understanding', () => {
  let state = createWorksiteDemo('finding');
  const before = view(state).matters;
  state = act(state, 'SET_FINDING_RELATION', { decision: 'linked', matterId: 'missing' });
  assert.equal(view(state).finding.relation, 'pending');
  state = act(state, 'SET_FINDING_RELATION', { decision: 'linked', matterId });
  state = act(state, 'KEEP_FINDING');
  assert.equal(view(state).finding.relation, 'linked');
  assert.equal(view(state).finding.suggestedMatterId, matterId);
  assert.deepEqual(view(state).matters, before);
});

test('use finding affects only actual current-work selector and never sends a task or rule', () => {
  let state = createWorksiteDemo('finding');
  const before = view(state).matters;
  state = act(state, 'USE_FINDING_IN_WORK');
  assert.equal(view(state).contextFindings.length, 1);
  assert.equal(view(state).contextSummary.findings, 1);
  assert.equal(view(state).finding.useInCurrentWork, true);
  assert.deepEqual(view(state).matters, before);
  assert.equal(view(state).work.connected, false);
  state = act(state, 'SELECT_WORK', { id: workB });
  assert.deepEqual(view(state).contextFindings, []);
});

test('keep/use finding is idempotent; editing a saved finding leaves original text intact', () => {
  let state = createWorksiteDemo('finding');
  state = act(state, 'KEEP_FINDING');
  const first = view(state).finding;
  state = act(state, 'KEEP_FINDING');
  state = act(state, 'USE_FINDING_IN_WORK');
  assert.equal(view(state).findings.length, 1);
  assert.equal(view(state).finding.id, first.id);
  state = act(state, 'FINDING_DRAFT', { patch: { text: '第二条不同的发现' } });
  assert.equal(view(state).finding.saved, false);
  state = act(state, 'KEEP_FINDING');
  assert.equal(view(state).findings.length, 2);
  assert.equal(view(state).findings[0].text, first.text);
});

test('result classification and draft do not save, modify understanding or claim usage', () => {
  let state = saved();
  const before = view(state);
  for (const relation of ['support', 'limit', 'challenge', 'unknown']) {
    state = draft(state, { relation });
    assert.equal(view(state).result.relation, relation);
    assert.deepEqual(view(state).matters, before.matters);
    assert.equal(view(state).results.length, 0);
    assert.equal(view(state).impact.stages.usage, false);
  }
});

test('empty results, unknown matter and invalid classification cannot produce history', () => {
  let state = saved();
  state = draft(state, { fact: '\n ' });
  for (const type of ['KEEP_RESULT_ONLY', 'OPEN_REVISION_REVIEW', 'CONFIRM_REVISION', 'TRY_AGAIN']) state = act(state, type);
  assert.equal(view(state).results.length, 0);
  assert.equal(view(state).receipt, null);
  state = act(state, 'RESULT_DRAFT', { patch: { matterId: 'missing', fact: 'Should not apply atomically' } });
  assert.equal(view(state).result.fact, '\n ');
  const before = state;
  state = act(state, 'RESULT_DRAFT', { patch: { relation: 'verified' } });
  assert.equal(state, before);
});

test('KEEP_RESULT_ONLY saves separated facts exactly once and cannot revise understanding', () => {
  let state = draft(saved());
  const before = view(state).matters;
  state = act(state, 'KEEP_RESULT_ONLY');
  state = act(state, 'KEEP_RESULT_ONLY');
  const data = view(state);
  assert.equal(data.results.length, 1);
  assert.equal(data.results[0].fact, resultDraft.fact);
  assert.equal(data.results[0].interpretation, resultDraft.interpretation);
  assert.equal(data.results[0].unconfirmed, resultDraft.unconfirmed);
  assert.equal(data.results[0].decision, 'result-only');
  assert.deepEqual(data.matters, before);
  assert.equal(data.receipt, null);
});

test('OPEN and CANCEL review only display/cancel a difference and preserve the result draft', () => {
  let state = draft(saved());
  const before = view(state);
  state = act(state, 'OPEN_REVISION_REVIEW');
  assert.equal(view(state).review.open, true);
  assert.equal(view(state).review.matterId, matterId);
  assert.equal(view(state).review.baseVersion, 1);
  assert.equal(view(state).review.after, resultDraft.proposedUnderstanding);
  assert.deepEqual(view(state).matters, before.matters);
  assert.equal(view(state).receipt, null);
  state = act(state, 'CANCEL_REVISION_REVIEW');
  assert.equal(view(state).review.open, false);
  assert.deepEqual(view(state).result, before.result);
});

test('explicit confirmation updates only reviewed matter and exact after text, once', () => {
  let state = draft(saved());
  const before = view(state);
  state = act(state, 'OPEN_REVISION_REVIEW');
  state = act(state, 'REVISION_DRAFT', { text: '用户在确认面板中亲自修改后的表达。' });
  state = act(state, 'CONFIRM_REVISION');
  const data = view(state);
  assert.equal(data.matters.find(item => item.id === matterId).understanding, '用户在确认面板中亲自修改后的表达。');
  assert.equal(data.matters.find(item => item.id === matterId).version, 2);
  assert.deepEqual(data.matters.find(item => item.id !== matterId), before.matters.find(item => item.id !== matterId));
  assert.equal(data.receipt.workId, workA);
  assert.equal(data.receipt.matterId, matterId);
  assert.equal(data.receipt.resultId, data.results[0].id);
  assert.equal(data.results.length, 1);
  assert.equal(data.undo.revision, true);
  assert.equal(act(state, 'CONFIRM_REVISION'), state);
});

test('confirm without open review, blank after, or identical text cannot commit', () => {
  let state = draft(saved());
  assert.equal(act(state, 'CONFIRM_REVISION'), state);
  state = act(state, 'OPEN_REVISION_REVIEW');
  state = act(state, 'REVISION_DRAFT', { text: ' ' });
  state = act(state, 'CONFIRM_REVISION');
  assert.equal(view(state).receipt, null);
  state = act(state, 'REVISION_DRAFT', { text: view(state).review.before });
  state = act(state, 'CONFIRM_REVISION');
  assert.equal(view(state).receipt, null);
  assert.equal(view(state).results.length, 0);
});

test('editing the underlying result while review is open marks it stale and blocks confirmation', () => {
  let state = act(draft(saved()), 'OPEN_REVISION_REVIEW');
  state = act(state, 'RESULT_DRAFT', { patch: { fact: '更晚的另一条事实' } });
  assert.equal(view(state).review.stale, true);
  state = act(state, 'CONFIRM_REVISION');
  assert.equal(view(state).receipt, null);
  assert.equal(view(state).results.length, 0);
  assert.match(view(state).notice, /已变化/);
});

test('another work updating the same matter makes the earlier review stale', () => {
  let state = act(draft(saved()), 'OPEN_REVISION_REVIEW');
  state = act(state, 'SELECT_WORK', { id: workB });
  state = commit(draft(state, { proposedUnderstanding: '另一个工作刚确认的新理解。' }));
  state = act(state, 'SELECT_WORK', { id: workA });
  assert.equal(view(state).review.stale, true);
  state = act(state, 'CONFIRM_REVISION');
  assert.equal(view(state).receipt, null);
  assert.equal(view(state).matters.find(item => item.id === matterId).understanding, '另一个工作刚确认的新理解。');
});

test('reopening a stale review captures the new version and requires explicit confirmation again', () => {
  let state = act(draft(saved()), 'OPEN_REVISION_REVIEW');
  state = act(state, 'SELECT_WORK', { id: workB });
  state = commit(draft(state, { proposedUnderstanding: '另一个工作的理解。' }));
  state = act(state, 'SELECT_WORK', { id: workA });
  state = act(state, 'CANCEL_REVISION_REVIEW');
  state = act(state, 'OPEN_REVISION_REVIEW');
  assert.equal(view(state).review.baseVersion, 2);
  assert.equal(view(state).review.before, '另一个工作的理解。');
  assert.equal(view(state).review.stale, false);
  state = act(state, 'CONFIRM_REVISION');
  assert.equal(view(state).receipt.version, 3);
});

test('confirmed snapshot is never silently updated after the underlying understanding changes', () => {
  let state = saved();
  const snapshot = view(state).intake;
  state = commit(draft(state));
  assert.deepEqual(view(state).intake, snapshot);
  assert.equal(view(state).context.find(item => item.id === intakeId).sourceVersion, 1);
  assert.equal(view(state).matters.find(item => item.id === matterId).version, 2);
});

test('undo restores content with monotonic version, retaining fact and revision history', () => {
  let state = draft(saved());
  const before = view(state).matters.find(item => item.id === matterId).understanding;
  state = commit(state);
  const receipt = view(state).receipt;
  state = act(state, 'UNDO_REVISION');
  assert.equal(view(state).matters.find(item => item.id === matterId).understanding, before);
  assert.equal(view(state).matters.find(item => item.id === matterId).version, 3);
  assert.equal(view(state).results[0].fact, resultDraft.fact);
  assert.equal(view(state).results[0].revertedRevisionId, receipt.id);
  assert.equal(view(state).receipt.undone, true);
  assert.equal(view(state).undo.revision, false);
  assert.equal(state.matters[matterId].revisions.length, 2);
  assert.equal(act(state, 'UNDO_REVISION'), state);
});

test('expired undo cannot overwrite a later same-matter change from another work', () => {
  let state = commit(draft(saved()));
  state = act(state, 'SELECT_WORK', { id: workB });
  state = commit(draft(state, { proposedUnderstanding: '更晚已确认的内容。' }));
  state = act(state, 'SELECT_WORK', { id: workA });
  assert.equal(view(state).undo.revision, false);
  state = act(state, 'UNDO_REVISION');
  assert.equal(view(state).matters.find(item => item.id === matterId).understanding, '更晚已确认的内容。');
  assert.equal(view(state).results[0].fact, resultDraft.fact);
  assert.match(view(state).notice, /后续变化/);
});

test('result-only cannot relabel an already revised result or conceal the understanding mutation', () => {
  let state = commit(draft(saved()));
  state = act(state, 'KEEP_RESULT_ONLY');
  assert.equal(view(state).result.decision, 'revised');
  assert.equal(view(state).receipt.undone, false);
});

test('a result saved without revision can subsequently be reviewed without duplicating its fact', () => {
  let state = act(draft(saved()), 'KEEP_RESULT_ONLY');
  const id = view(state).result.id;
  state = commit(state);
  assert.equal(view(state).results.length, 1);
  assert.equal(view(state).receipt.resultId, id);
  assert.equal(view(state).results[0].decision, 'revised');
});

test('editing a saved result starts a new pending record and leaves original evidence intact', () => {
  let state = act(draft(saved()), 'KEEP_RESULT_ONLY');
  state = act(state, 'RESULT_DRAFT', { patch: { fact: '新的第二次观察' } });
  assert.equal(view(state).result.id, null);
  state = act(state, 'KEEP_RESULT_ONLY');
  assert.equal(view(state).results.length, 2);
  assert.equal(view(state).results[0].fact, resultDraft.fact);
  assert.equal(view(state).results[1].fact, '新的第二次观察');
});

test('try again preserves facts and current understanding but does not adopt a suggestion or send work', () => {
  let state = draft(saved());
  const before = view(state).matters;
  state = act(state, 'TRY_AGAIN');
  assert.deepEqual(view(state).matters, before);
  assert.equal(view(state).results[0].fact, resultDraft.fact);
  assert.equal(view(state).retry.status, 'planned');
  assert.equal(view(state).retry.sent, false);
  assert.equal(view(state).retry.scope, 'current-task');
  assert.equal(view(state).receipt, null);
});

test('work selection isolates screen, composer, finding, result, review and receipt', () => {
  let state = createWorksiteDemo('finding');
  state = act(state, 'FINDING_DRAFT', { patch: { note: '工作 A 的独有附言' } });
  state = act(draft(state), 'OPEN_REVISION_REVIEW');
  const a = view(state);
  state = act(state, 'SELECT_WORK', { id: workB });
  assert.equal(view(state).screen, 'overview');
  assert.equal(view(state).composer.text, '');
  assert.equal(view(state).finding.text, '');
  assert.equal(view(state).result.fact, '');
  assert.equal(view(state).review.open, false);
  assert.equal(view(state).receipt, null);
  state = act(state, 'COMPOSER_DRAFT', { text: '工作 B 的草稿' });
  state = act(state, 'SELECT_WORK', { id: workA });
  for (const key of ['composer', 'finding', 'result', 'review', 'receipt', 'screen']) assert.deepEqual(view(state)[key], a[key]);
});

test('pure reducer accepts deep-frozen state; selector returns detached copies', () => {
  const state = freeze(saved());
  const result = draft(state);
  assert.equal(view(state).result.fact, '');
  assert.equal(view(result).result.fact, resultDraft.fact);
  const data = view(result);
  data.matters[0].understanding = 'tampered';
  data.intake[0].sourceText = 'tampered';
  assert.notEqual(view(result).matters[0].understanding, 'tampered');
  assert.notEqual(view(result).intake[0].sourceText, 'tampered');
});

test('seed IDs are preserved, duplicate IDs rejected, empty work list produces a safe empty view', () => {
  const state = createWorksiteState({ matters: [{ id: 'shared-matter-42', understanding: 'A', version: 7 }], works: [{ id: 'shared-work-9', intake: [{ id: 'snapshot-4', matterId: 'shared-matter-42', sourceText: 'old A', sourceVersion: 6 }] }] });
  assert.equal(view(state).selectedWorkId, 'shared-work-9');
  assert.equal(view(state).matters[0].version, 7);
  assert.equal(view(state).intake[0].sourceVersion, 6);
  assert.throws(() => createWorksiteState({ matters: [{ id: 'same' }, { id: 'same' }] }), /Duplicate matter/);
  assert.throws(() => createWorksiteState({ works: [{ id: 'same' }, { id: 'same' }] }), /Duplicate work/);
  const empty = createWorksiteState({ works: [] });
  assert.equal(view(empty).work, null);
  assert.equal(view(empty).receipt, null);
  assert.match(view(act(empty, 'KEEP_FINDING')).notice, /尚未接入/);
});

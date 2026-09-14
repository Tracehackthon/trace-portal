import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS, createComparisonState, createComparisonDemo, reduceComparison as reduce, selectComparisonView as view, applyComparisonRequest as apply } from './comparison-model.mjs';

const clone = structuredClone;
const compare = () => createComparisonDemo('compare');
function requestRevision(state = compare(), after = '自己的表达有帮助，但不是恢复思考的唯一方式。') {
  state = reduce(state, { type: 'OPEN_REVISION' });
  state = reduce(state, { type: 'REVISION_DRAFT', text: after });
  return reduce(state, { type: 'CONFIRM_REVISION' });
}
function commit(state, host = state.matter) {
  const result = apply(host, state.request);
  return { result, state: reduce(state, { type: 'COMMIT_RESULT', requestId: state.request.id, ...result }) };
}
function deepFreeze(object) {
  if (!object || typeof object !== 'object' || Object.isFrozen(object)) return object;
  Object.freeze(object);
  Object.values(object).forEach(deepFreeze);
  return object;
}

test('fresh session has no candidates before SEARCH and explicitly uses a local demo provider', () => {
  const state = createComparisonState();
  assert.equal(state.screen, 'search');
  assert.deepEqual(view(state).candidates, []);
  assert.equal(view(state).search.status, 'idle');
  assert.equal(view(state).search.provider, 'local-demo');
  assert.equal(view(state).isDemo, true);
  assert.equal(view(state).receipt, null);
});

test('default search gives the three visual-reference fixtures, no URL or fabricated author', () => {
  const state = reduce(createComparisonState(), { type: 'SEARCH' });
  assert.equal(state.screen, 'candidates');
  assert.equal(view(state).candidates.length, 3);
  assert.deepEqual(view(state).candidates.map((candidate) => candidate.relationship.summary), [
    '可能限制：必须写下个人表达', '可能补充：表达里需要留下什么', '可能有关：再次出现的情境',
  ]);
  assert.equal(view(state).query.shortQuestion, '不写附言，也能接回来吗？');
  assert.notEqual(view(state).candidates[0].relationship.reason, view(state).candidates[0].relationship.summary);
  const explicitlyTyped = reduce(state, { type: 'QUERY_PATCH', patch: { question: state.query.question } });
  assert.equal(view(explicitlyTyped).query.shortQuestion, state.query.question);
  const opened = reduce(state, { type: 'OPEN_CANDIDATE', id: 'demo-project' });
  for (const patch of [{ type: 'supplement' }, { target: '用户重新指定的关系描述' }]) {
    const changed = reduce(opened, { type: 'RELATION_PATCH', patch });
    assert.equal(view(changed).selectedCandidate.relationship.summary, undefined);
    assert.equal(view(changed).selectedCandidate.relationship.reason, view(opened).selectedCandidate.relationship.reason);
  }
  for (const candidate of view(state).candidates) {
    assert.equal(candidate.kind, 'demo');
    assert.equal(candidate.url, null);
    assert.match(candidate.sourceLabel, /^演示材料/);
    assert.equal(candidate.decision, 'pending');
    assert.equal(candidate.author, undefined);
  }
});

test('search to LINK produces a request but does not change understanding or claim returned', () => {
  const before = compare();
  const state = reduce(before, { type: 'LINK' });
  assert.equal(state.request.kind, 'link');
  assert.deepEqual(state.matter, before.matter);
  assert.equal(state.screen, 'compare');
  assert.equal(state.receipt, null);
  assert.equal(view(state).pending, true);
});

test('successful link only adds relation and material, not text/version/revision/unresolved', () => {
  const original = compare();
  const { result, state } = commit(reduce(original, { type: 'LINK' }));
  assert.equal(result.ok, true);
  assert.equal(state.matter.understanding, original.matter.understanding);
  assert.equal(state.matter.version, original.matter.version);
  assert.deepEqual(state.matter.unresolved, original.matter.unresolved);
  assert.deepEqual(state.matter.revisions, []);
  assert.equal(state.matter.links.length, 1);
  assert.equal(view(state).selectedCandidate.decision, 'linked');
  assert.equal(state.screen, 'compare');
  assert.equal(state.receipt.kind, 'link');
  assert.equal(state.receipt.before, state.receipt.after);
});

test('linked candidate REJECT is blocked, preserving host, decision, and truth of notice', () => {
  const linked = commit(reduce(compare(), { type: 'LINK' })).state;
  const state = reduce(linked, { type: 'REJECT' });
  assert.deepEqual(state.matter, linked.matter);
  assert.equal(view(state).selectedCandidate.decision, 'linked');
  assert.match(state.notice, /已关联，本次未解除关系/);
});

test('repeat LINK with a different request ID does not duplicate a source relation', () => {
  const first = commit(reduce(compare(), { type: 'LINK' })).state;
  const second = commit(reduce(first, { type: 'LINK' })).state;
  assert.equal(second.matter.links.length, 1);
  assert.equal(second.receipt.linkAdded, false);
  assert.equal(second.matter.version, first.matter.version);
  assert.equal(second.matter.comparisonRequests.length, 2);
});

test('explicit local editing and confirmation are mandatory before revise request', () => {
  let state = compare();
  state = reduce(state, { type: 'CONFIRM_REVISION' });
  assert.equal(state.request, null);
  state = reduce(state, { type: 'OPEN_REVISION' });
  assert.equal(view(state).revision.canConfirm, false);
  state = reduce(state, { type: 'REVISION_DRAFT', text: '  ' });
  assert.equal(reduce(state, { type: 'CONFIRM_REVISION' }).request, null);
  state = reduce(state, { type: 'REVISION_DRAFT', text: '没有任务时是否仍能接回，还不能说明。' });
  assert.equal(view(state).revision.canConfirm, true);
  const requested = reduce(state, { type: 'CONFIRM_REVISION' });
  assert.equal(requested.request.kind, 'revise');
  assert.equal(requested.screen, 'compare');
  assert.equal(requested.receipt, null);
  assert.deepEqual(requested.matter, state.matter);
});

test('successful revise replaces only the original focus and returns an authoritative receipt', () => {
  let state = compare();
  const prefix = '保留前文。\n', suffix = '\n后文也不该被重写。';
  state.matter.understanding = prefix + state.matter.understanding + suffix;
  state.matter.focus.start = prefix.length;
  state.matter.focus.end = prefix.length + state.matter.focus.text.length;
  const requested = requestRevision(state, '改过的局部。');
  const { result, state: saved } = commit(requested);
  assert.equal(result.ok, true);
  assert.equal(saved.matter.understanding, prefix + '改过的局部。' + suffix);
  assert.equal(saved.matter.version, state.matter.version + 1);
  assert.equal(saved.matter.revisions.length, 1);
  assert.equal(saved.matter.links.length, 1);
  assert.equal(saved.screen, 'returned');
  assert.equal(saved.receipt.before, state.matter.focus.text);
  assert.equal(saved.receipt.after, '改过的局部。');
  assert.equal(saved.receipt.target.start, prefix.length);
  assert.equal(view(saved).canUndo, true);
});

test('host mutation alone does not change reducer; COMMIT_RESULT is the decisive UI boundary', () => {
  const requested = requestRevision();
  const result = apply(requested.matter, requested.request);
  assert.equal(result.ok, true);
  assert.equal(requested.screen, 'compare');
  assert.equal(requested.matter.version, 1);
  const saved = reduce(requested, { type: 'COMMIT_RESULT', requestId: requested.request.id, ...result });
  assert.equal(saved.screen, 'returned');
  assert.equal(saved.matter.version, 2);
});

test('wrong request response cannot acknowledge a pending mutation', () => {
  const requested = requestRevision();
  const result = apply(requested.matter, requested.request);
  assert.equal(reduce(requested, { type: 'COMMIT_RESULT', requestId: 'another-request', ...result }), requested);
});

test('an ok flag with fake receipt or unchanged matter is not sufficient to claim updated', () => {
  const requested = requestRevision();
  const result = apply(requested.matter, requested.request);
  for (const tampered of [
    { ...result, matter: requested.matter },
    { ...result, receipt: { ...result.receipt, revisionId: 'missing-revision' } },
    { ...result, receipt: { ...result.receipt, requestFingerprint: 'unrelated' } },
    { ...result, receipt: { ...result.receipt, before: '凭空拼出的旧理解' } },
    { ...result, receipt: { ...result.receipt, target: { ...result.receipt.target, start: 1 } } },
  ]) {
    const state = reduce(requested, { type: 'COMMIT_RESULT', requestId: requested.request.id, ...tampered });
    assert.equal(state.screen, 'compare');
    assert.equal(state.receipt, null);
    assert.match(state.notice, /回执.*不一致/);
  }
});

test('failed host submission preserves local draft and never enters returned', () => {
  const requested = requestRevision();
  const state = reduce(requested, { type: 'COMMIT_RESULT', requestId: requested.request.id, ok: false, error: '暂时无法保存。' });
  assert.equal(state.screen, 'compare');
  assert.equal(state.revision.draft, requested.revision.draft);
  assert.equal(state.revision.open, true);
  assert.equal(state.request, null);
  assert.equal(state.receipt, null);
});

test('later host version blocks stale revise and cannot silently rebase an old draft', () => {
  const requested = requestRevision();
  const later = clone(requested.matter);
  later.understanding = '后来亲自编辑的新版本。'; later.version++;
  later.focus = { start: 0, end: later.understanding.length, text: later.understanding };
  const { result, state } = commit(requested, later);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'version_conflict');
  assert.deepEqual(result.matter, later);
  assert.equal(state.matter.understanding, later.understanding);
  assert.equal(view(state).revision.canConfirm, false);
  assert.equal(reduce(state, { type: 'CONFIRM_REVISION' }).request, null);
});

test('original focus mismatch blocks even if host accidentally failed to increment version', () => {
  const requested = requestRevision();
  const host = clone(requested.matter);
  host.understanding = '选区已被修改。';
  host.focus = { start: 0, end: host.understanding.length, text: host.understanding };
  const { result, state } = commit(requested, host);
  assert.equal(result.error.code, 'focus_conflict');
  assert.equal(view(state).revision.canConfirm, false);
  assert.equal(state.screen, 'compare');
});

test('host rejects another matter, unknown source kind, empty target, and revision whitespace', () => {
  const state = requestRevision();
  const variants = [
    [{ ...state.request, matterId: 'other' }, 'matter_mismatch'],
    [{ ...state.request, source: { ...state.request.source, kind: 'verified-real' } }, 'invalid_relation'],
    [{ ...state.request, relationship: { ...state.request.relationship, target: '' } }, 'invalid_relation'],
    [{ ...state.request, after: '\n ' }, 'invalid_revision'],
  ];
  for (const [request, code] of variants) {
    const result = apply(state.matter, request);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, code);
    assert.deepEqual(result.matter, state.matter);
  }
});

test('host rejects forged broader range even when text and version are valid', () => {
  const requested = requestRevision();
  const matter = clone(requested.matter);
  matter.understanding += '\n另一段。';
  const request = { ...requested.request, target: { field: 'understanding', start: 0, end: matter.understanding.length, text: matter.understanding }, before: matter.understanding };
  assert.equal(apply(matter, request).error.code, 'focus_conflict');
});

test('same request replay is idempotent, including after a successful undo', () => {
  const requested = requestRevision();
  const first = apply(requested.matter, requested.request);
  const second = apply(first.matter, requested.request);
  assert.equal(second.ok, true); assert.equal(second.receipt.replayed, true);
  assert.deepEqual(second.matter, first.matter);
  let state = reduce(requested, { type: 'COMMIT_RESULT', requestId: requested.request.id, ...first });
  state = reduce(state, { type: 'UNDO_REVISION' });
  const undone = apply(state.matter, state.request);
  const repeatUndo = apply(undone.matter, state.request);
  assert.equal(repeatUndo.ok, true);
  assert.deepEqual(repeatUndo.matter, undone.matter);
});

test('request replay after later editing cannot falsely redisplay the old revised state', () => {
  const requested = requestRevision();
  const first = apply(requested.matter, requested.request);
  const later = clone(first.matter);
  later.understanding = '另一份新理解。'; later.version++;
  later.focus = { start: 0, end: later.understanding.length, text: later.understanding };
  const replay = apply(later, requested.request);
  assert.equal(replay.ok, true); assert.equal(replay.receipt.replayed, true);
  const state = reduce(requested, { type: 'COMMIT_RESULT', requestId: requested.request.id, ...replay });
  assert.equal(state.screen, 'compare');
  assert.equal(state.receipt, null);
});

test('same request ID with changed content is rejected; property order alone is not changed content', () => {
  const requested = requestRevision();
  const first = apply(requested.matter, requested.request);
  const bad = apply(first.matter, { ...requested.request, after: '不同内容。' });
  assert.equal(bad.error.code, 'request_id_collision');
  const reordered = Object.fromEntries(Object.entries(requested.request).reverse());
  assert.equal(apply(first.matter, reordered).ok, true);
});

test('undo only restores the focus and preserves sources, new facts, and current unresolved field', () => {
  let state = commit(requestRevision()).state;
  const originalText = state.receipt.before;
  state = reduce(state, { type: 'UNDO_REVISION' });
  const host = clone(state.matter);
  host.links.push({ id: 'later-source', sourceId: 'later-source', source: { excerpt: '后来带回的新事实' } });
  host.results = [{ id: 'new-fact', fact: '后来实际发生了的事' }];
  host.unresolved = '后来重新写下的未决。';
  const { result, state: undone } = commit(state, host);
  assert.equal(result.ok, true);
  assert.equal(undone.matter.understanding, originalText);
  assert.equal(undone.matter.version, host.version + 1);
  assert.deepEqual(undone.matter.links, host.links);
  assert.deepEqual(undone.matter.results, host.results);
  assert.equal(undone.matter.unresolved, host.unresolved);
  assert.equal(view(undone).canUndo, false);
  assert.equal(undone.screen, 'compare');
});

test('undo after later understanding edit conflicts, does not cover the later version', () => {
  let state = commit(requestRevision()).state;
  state = reduce(state, { type: 'UNDO_REVISION' });
  const later = clone(state.matter); later.version++;
  later.understanding += ' 后来的独立补充。';
  const { result } = commit(state, later);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'version_conflict');
  assert.deepEqual(result.matter, later);
});

test('undo cannot switch to a different focus without changing the version', () => {
  const saved = commit(requestRevision()).state;
  const oldFocus = clone(saved.matter.focus);
  const host = clone(saved.matter);
  host.understanding += '另一个段落。';
  host.focus = { start: oldFocus.end, end: host.understanding.length, text: '另一个段落。' };
  const request = { ...reduce(saved, { type: 'UNDO_REVISION' }).request, target: { field: 'understanding', ...host.focus } };
  assert.equal(apply(host, request).error.code, 'focus_conflict');
  const moved = { ...saved, matter: host };
  assert.equal(view(moved).canUndo, false);
  assert.equal(reduce(moved, { type: 'UNDO_REVISION' }).request, null);
});

test('undo cannot target unknown revisions or re-undo an already reversed revision with a new ID', () => {
  let state = commit(requestRevision()).state;
  state = reduce(state, { type: 'UNDO_REVISION' });
  assert.equal(apply(state.matter, { ...state.request, revisionId: 'unknown' }).error.code, 'unknown_revision');
  const undone = commit(state).state;
  assert.equal(reduce(undone, { type: 'UNDO_REVISION' }).request, null);
  const retry = { ...state.request, id: 'fresh-undo', baseVersion: undone.matter.version,
    target: { field: 'understanding', ...undone.matter.focus } };
  assert.equal(apply(undone.matter, retry).error.code, 'already_undone');
});

test('candidate comparison drafts and saved notes never cross-contaminate', () => {
  let state = compare(); const firstId = state.selectedId;
  state = reduce(state, { type: 'COMPARISON_DRAFT', text: '只属于第一份材料的判断。' });
  state = reduce(state, { type: 'SAVE_COMPARISON_NOTE' });
  state = reduce(state, { type: 'OPEN_CANDIDATE', id: 'demo-reading' });
  assert.equal(view(state).comparisonDraft, ''); assert.equal(view(state).savedComparisonNote, '');
  state = reduce(state, { type: 'COMPARISON_DRAFT', text: '第二份的不同判断。' });
  state = reduce(state, { type: 'OPEN_CANDIDATE', id: firstId });
  assert.equal(view(state).comparisonDraft, '只属于第一份材料的判断。');
  assert.equal(view(state).savedComparisonNote, view(state).comparisonDraft);
  assert.equal(state.matter.revisions.length, 0);
});

test('candidate switches discard open revision panel, preventing draft submission to another source', () => {
  let state = reduce(compare(), { type: 'OPEN_REVISION' });
  state = reduce(state, { type: 'REVISION_DRAFT', text: '第一份的局部修改' });
  state = reduce(state, { type: 'OPEN_CANDIDATE', id: 'demo-reading' });
  assert.equal(view(state).revision.open, false);
  assert.equal(reduce(state, { type: 'CONFIRM_REVISION' }).request, null);
});

test('reject, view, note, adjust, and cancel do not mutate the host or erase catalog material', () => {
  const original = compare();
  let state = reduce(original, { type: 'SAVE_COMPARISON_NOTE' });
  state = reduce(state, { type: 'OPEN_REVISION' });
  state = reduce(state, { type: 'REVISION_DRAFT', text: '仍只是草稿。' });
  state = reduce(state, { type: 'CANCEL_REVISION' });
  state = reduce(state, { type: 'REJECT' });
  assert.equal(state.catalog.find(({ id }) => id === original.selectedId).decision, 'rejected');
  state = reduce(state, { type: 'ADJUST_SEARCH' });
  assert.deepEqual(state.matter, original.matter);
  assert.equal(state.catalog.length, original.catalog.length);
  assert.equal(state.request, null);
});

test('direction and scope are real query/provider inputs, not decorative controls', () => {
  let state = createComparisonState();
  state = reduce(state, { type: 'QUERY_PATCH', patch: { direction: 'experience', instructions: '看任务重新出现时的情境', scopes: ['prior'] } });
  state = reduce(state, { type: 'SEARCH' });
  assert.equal(state.candidateIds[0], 'demo-task');
  assert.equal(view(state).search.request.direction, 'experience');
  assert.equal(view(state).search.request.instructions, '看任务重新出现时的情境');
  state = reduce(state, { type: 'QUERY_PATCH', patch: { direction: 'condition' } });
  state = reduce(state, { type: 'SEARCH' });
  assert.equal(state.candidateIds[0], 'demo-reading');
});

test('empty scopes or unsupported topic yields explicit local empty result without fake external search', () => {
  for (const patch of [{ scopes: [] }, { question: '如何培育火星土豆？', instructions: '' }]) {
    let state = reduce(createComparisonState(), { type: 'QUERY_PATCH', patch });
    state = reduce(state, { type: 'SEARCH' });
    assert.equal(view(state).search.status, 'empty');
    assert.deepEqual(view(state).candidates, []);
    assert.match(state.notice, /不代表外部没有材料/);
  }
});

test('empty question, invalid query options, unknown candidate and missing selection are safe', () => {
  let state = createComparisonState();
  const original = clone(state);
  state = reduce(state, { type: 'QUERY_PATCH', patch: { direction: 'invented' } });
  assert.deepEqual(state.query, original.query);
  state = reduce(state, { type: 'QUERY_PATCH', patch: { scopes: ['anywhere'] } });
  assert.deepEqual(state.query, original.query);
  state = reduce(state, { type: 'QUERY_PATCH', patch: { question: ' ' } });
  assert.equal(view(state).query.shortQuestion, ' ');
  assert.equal(reduce(state, { type: 'SEARCH' }).screen, 'search');
  assert.equal(reduce(state, { type: 'OPEN_CANDIDATE', id: 'unknown' }).selectedId, null);
  assert.equal(reduce(state, { type: 'LINK' }).request, null);
});

test('user pasted material is explicitly user-provided; source kind and relation remain separate', () => {
  let state = reduce(createComparisonState(), { type: 'IMPORT_MATERIAL', material: { title: '我的摘录', excerpt: '收藏之外的情境。', context: '我自己带入的上下文。', sourceType: '自己的笔记', kind: 'demo', url: null } });
  assert.equal(view(state).selectedCandidate.kind, 'user');
  assert.equal(view(state).selectedCandidate.sourceType, '自己的笔记');
  assert.equal(view(state).selectedCandidate.url, null);
  state = reduce(state, { type: 'RELATION_PATCH', patch: { type: 'challenge', target: state.matter.focus.text } });
  assert.equal(view(state).selectedCandidate.kind, 'user');
  assert.equal(view(state).selectedCandidate.relationship.type, 'challenge');
  assert.equal(state.matter.links.length, 0);
  assert.equal(view(state).selectedCandidate.relationship.summary, undefined);
});

test('hypothetical source remains labelled hypothetical after successful link and revision', () => {
  let state = createComparisonState({ candidates: [{ id: 'hypothesis', title: '如果任务没有再出现', kind: 'hypothetical', sourceType: '假设情形', excerpt: '如果收藏后没有再出现任务，是否仍能接回？', url: null }] });
  state = reduce(state, { type: 'SEARCH' });
  state = reduce(state, { type: 'OPEN_CANDIDATE', id: 'hypothesis' });
  assert.match(view(state).selectedCandidate.sourceLabel, /^假设情形/);
  state = commit(requestRevision(state)).state;
  assert.equal(state.receipt.linkedSource.kind, 'hypothetical');
  assert.equal(state.matter.links[0].source.kind, 'hypothetical');
});

test('blank/link-only import fails and never invents a source fetch', () => {
  const before = createComparisonState();
  for (const material of [{ excerpt: ' ' }, { url: 'https://example.com' }, { excerpt: '摘录', url: 'https://example.com' }]) {
    const after = reduce(before, { type: 'IMPORT_MATERIAL', material });
    assert.equal(after.catalog.length, before.catalog.length);
    assert.equal(after.selectedId, null);
    assert.equal(after.request, null);
  }
});

test('text remains literal; unsafe-looking IDs cannot poison per-candidate draft records', () => {
  const literal = '<img src=x onerror=alert(1)> & "自己的表达"';
  let state = createComparisonState({ candidates: [{ id: '__proto__', title: '收藏材料', kind: 'user', excerpt: '收藏现场', scopes: ['prior'] }] });
  state = reduce(state, { type: 'QUERY_PATCH', patch: { question: '收藏', instructions: '' } });
  state = reduce(state, { type: 'SEARCH' });
  state = reduce(state, { type: 'OPEN_CANDIDATE', id: '__proto__' });
  state = reduce(state, { type: 'COMPARISON_DRAFT', text: literal });
  state = reduce(state, { type: 'SAVE_COMPARISON_NOTE' });
  assert.equal(view(state).comparisonDraft, literal);
  assert.equal(view(state).savedComparisonNote, literal);
  const saved = commit(requestRevision(state, literal)).state;
  assert.equal(saved.matter.understanding, literal);
  assert.equal({}.polluted, undefined);
});

test('duplicate clicks cannot emit a second request or change selection while awaiting commit', () => {
  const requested = requestRevision();
  for (const action of [{ type: 'CONFIRM_REVISION' }, { type: 'LINK' }, { type: 'OPEN_CANDIDATE', id: 'demo-reading' }, { type: 'REJECT' }]) {
    const state = reduce(requested, action);
    assert.deepEqual(state.request, requested.request);
    assert.equal(state.selectedId, requested.selectedId);
    assert.equal(state.screen, 'compare');
  }
});

test('source identifier reuse cannot overwrite material already attached to the host', () => {
  const linked = commit(reduce(compare(), { type: 'LINK' })).state;
  const state = reduce(linked, { type: 'LINK' });
  const request = { ...state.request, source: { ...state.request.source, excerpt: '篡改过的原材料。' } };
  const result = apply(state.matter, request);
  assert.equal(result.error.code, 'source_conflict');
  assert.deepEqual(result.matter, state.matter);
});

test('model, selector and host are pure and accept frozen inputs', () => {
  const original = deepFreeze(compare());
  const requested = reduce(original, { type: 'LINK' });
  const result = apply(deepFreeze(requested.matter), deepFreeze(requested.request));
  assert.equal(result.ok, true);
  const selectedView = view(original);
  selectedView.matter.title = 'changed outside';
  selectedView.candidates[0].relationship.target = 'external mutation';
  assert.notEqual(original.matter.title, 'changed outside');
  assert.notEqual(original.catalog[0].relationship.target, 'external mutation');
  assert.equal(original.matter.links.length, 0);
});

test('UTF-16 focus boundaries cannot split an emoji surrogate pair', () => {
  const text = '前😀后';
  const matter = { id: 'unicode', title: '', understanding: text, version: 0, focus: { start: 1, end: 3, text: '😀' }, links: [], revisions: [] };
  assert.equal(createComparisonState({ matter }).matter.focus.text, '😀');
  assert.throws(() => createComparisonState({ matter: { ...matter, focus: { start: 1, end: 2, text: text.slice(1, 2) } } }), TypeError);
});

test('fixtures cover all four screens; returned fixture is backed by a committed revision', () => {
  for (const screen of SCREENS) {
    const state = createComparisonDemo(screen);
    assert.equal(view(state).screen, screen);
    assert.equal(view(state).isDemo, true);
  }
  const returned = createComparisonDemo('returned');
  assert.equal(returned.matter.revisions.length, 1);
  assert.equal(returned.matter.comparisonRequests.length, 1);
  assert.equal(returned.receipt.kind, 'revise');
  assert.equal(createComparisonDemo('invalid').screen, 'search');
});

test('unknown action and stray completed response are inert; malformed host request fails cleanly', () => {
  const state = createComparisonState();
  assert.equal(reduce(state, { type: 'PAUSE_WITHOUT_MUTATION' }), state);
  assert.equal(reduce(state, { type: 'COMMIT_RESULT', requestId: 'unknown', ok: true }), state);
  assert.equal(apply(state.matter, null).error.code, 'invalid_request');
  assert.equal(apply(null, {}).error.code, 'invalid_matter');
});

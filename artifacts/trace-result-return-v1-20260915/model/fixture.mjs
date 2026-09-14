/** Explicit static-design examples and an in-memory host fixture. Not a live connector. */
import { canonical, createResultReturnState, reduceResultReturn, selectResultReturnView, SCREENS } from './result-return-model.mjs';
export const DEMO_BEFORE = '原位展开能够帮助用户接续思考。';
export const DEMO_AFTER = '原位展开可能帮助用户认出思考的位置；要让用户继续往下想，还需要恢复上次停点和未决问题。';
export function demoSeed() {
  return { instanceId: 'demo-result-return', sessionId: 'demo-session', resultId: 'demo-result-1', workId: 'demo-work-harness',
    matter: { id: 'demo-matter-recall', title: '收藏后为什么接不回来', understanding: DEMO_BEFORE, version: 3, draftVersion: 7 },
    sourceVersion: 3, returnAnchor: { target: 'worksite', workId: 'demo-work-harness', section: 'results' },
    source: { title: 'Codex · harness', label: '气泡展开原型', selectedText: '我的一次原型试用。' },
    trialText: '原位展开可能帮助我从原来的地方接着想。',
    rawText: '我试了原型。原位展开让我认出是哪件事，但我还是不知道接下来该想什么。',
    materials: [{ id: 'demo-screenshot-note', title: '原型截图说明（示例）', text: '静态设计案例中选中的原型截图说明；不是真实测试截图。', kind: 'selected-text' }],
    comparison: { observation: '这次试用中，我认出了原来的事情，但不知道下一步从哪里继续。', interpretation: '原位展开可能恢复了位置，却没有恢复上次停点。', unconfirmed: '是缺少停点提示，还是原来的讨论没有留下可继续的问题？', summary: '这次，认出了位置，却没有接着想' },
    suggestion: { title: '建议：补上边界', text: '这次没有否定原位展开的价值。它可能帮助认出位置，但不足以单独支持继续思考。', after: DEMO_AFTER }, isDemo: true };
}

export function createFixtureHost(seed = demoSeed()) {
  return { mode: 'fixture-memory', matter: structuredClone(seed.matter ?? null), results: [], revisions: [], receipts: [] };
}

/** Executable host contract example. Apply to a copied projection, never any app/user state. */
export function applyFixtureCommand(host, command, options = {}) {
  const c = structuredClone(command);
  if (!c) throw new TypeError('No pending command');
  const common = { commandId: c.commandId, operationId: c.operationId, operation: c.operation, sessionKey: c.sessionKey, resultId: c.resultId,
    workId: c.workId, matterId: c.matterId, expectedVersion: c.expectedVersion, fingerprint: c.fingerprint, snapshotFingerprint: c.snapshotFingerprint, store: 'fixture-memory' };
  const fail = (code, message) => ({ host, receipt: { ...common, ok: false, error: { code, message } } });
  const replay = host.receipts.find(r => r.commandId === c.commandId);
  if (replay) return replay.fingerprint === c.fingerprint ? { host, receipt: structuredClone(replay) } : fail('command_conflict', '请求 ID 被不同内容复用。');
  const fingerprint = c.fingerprint; delete c.fingerprint;
  if (canonical(c) !== fingerprint) return fail('snapshot_conflict', '请求内容与指纹不一致。');
  c.fingerprint = fingerprint;
  if (c.snapshotFingerprint !== canonical({ operation: c.operation, resultId: c.resultId, workId: c.workId, matterId: c.matterId,
    expectedVersion: c.expectedVersion, expectedDraftVersion: c.expectedDraftVersion, scope: c.scope, snapshot: c.snapshot })) return fail('snapshot_conflict', '幂等内容快照不一致。');
  const priorOperation = host.receipts.find(receipt => receipt.operationId === c.operationId);
  if (priorOperation) return priorOperation.snapshotFingerprint === c.snapshotFingerprint
    ? { host, receipt: { ...structuredClone(priorOperation), ...common, replayed: true } }
    : fail('operation_conflict', '幂等操作 ID 被不同内容复用。');
  if (options.fail) return fail(options.fail, '演示宿主拒绝了本次保存；本地草稿仍保留。');
  if (!['save-result', 'revise-understanding', 'undo-revision'].includes(c.operation) || c.scope !== 'matter-current-understanding') return fail('invalid_operation', '不支持此操作或作用范围。');
  const result = c.snapshot.result;
  if (!result.text.trim() || result.resultId !== c.resultId || result.workId !== c.workId || result.matterId !== c.matterId) return fail('result_conflict', '结果归属或内容无效。');
  const existing = host.results.find(r => r.resultId === c.resultId);
  if (existing && canonical(existing) !== canonical(result)) return fail('result_conflict', '原始结果不可被不同内容覆盖。');
  if (c.matterId !== null && host.matter?.id !== c.matterId) return fail('matter_conflict', '目标事项不存在或不匹配。');
  const m = host.matter;
  if (c.operation !== 'save-result' && (!m || m.version !== c.expectedVersion || m.draftVersion !== c.expectedDraftVersion || m.hasUnsavedDraft)) return fail('version_conflict', '宿主已有新版本或未保存草稿，不覆盖它。');
  if (c.operation === 'revise-understanding') {
    const r = c.snapshot.revision;
    if (!r || r.matterId !== m.id || r.baseVersion !== m.version || r.baseDraftVersion !== m.draftVersion || r.before !== m.understanding || !r.after.trim() || r.after === r.before || !r.fragments.length) return fail('revision_conflict', '修订基线、内容或选区无效。');
    if (r.fragments.some(f => f.baseVersion !== m.version || !Number.isInteger(f.start) || !Number.isInteger(f.end) || f.start < 0 || f.end <= f.start || f.end > m.understanding.length || m.understanding.slice(f.start, f.end) !== f.text)) return fail('anchor_conflict', '理解片段已失效。');
    if (host.revisions.some(entry => entry.resultId === c.resultId && entry.kind === 'revision' && !host.revisions.some(undo => undo.undoOf === entry.id))) return fail('duplicate_revision', '该结果已有生效修订。');
  }
  if (c.operation === 'undo-revision') {
    const old = host.revisions.find(r => r.id === c.snapshot.undo?.revisionId);
    if (!old || old.resultId !== c.resultId || old.matterId !== c.matterId || m.understanding !== old.after || m.version !== old.version || c.snapshot.undo.before !== old.after || c.snapshot.undo.after !== old.before) return fail('undo_conflict', '旧撤销不能覆盖后来的理解。');
  }
  const next = structuredClone(host);
  if (!existing) next.results.push(structuredClone(result));
  const receipt = { ...common, ok: true, resultSaved: true, resultFingerprint: canonical(result), version: c.expectedVersion };
  if (c.operation !== 'save-result') {
    const before = m.understanding, after = c.operation === 'undo-revision' ? c.snapshot.undo.after : c.snapshot.revision.after;
    next.matter = { ...m, understanding: after, version: m.version + 1, draftVersion: m.draftVersion + 1, hasUnsavedDraft: false };
    Object.assign(receipt, { before, after, version: next.matter.version, draftVersion: next.matter.draftVersion, revisionId: `${c.commandId}:revision` });
    next.revisions.push({ id: receipt.revisionId, kind: c.operation === 'undo-revision' ? 'undo' : 'revision',
      undoOf: c.operation === 'undo-revision' ? c.snapshot.undo.revisionId : null, resultId: c.resultId, matterId: c.matterId,
      before, after, version: receipt.version, fragments: structuredClone(c.snapshot.fragments), unresolved: c.snapshot.revision?.unresolved ?? null });
  }
  next.receipts.push(receipt);
  return { host: next, receipt };
}

export function createResultReturnDemo(screen = 'intake') {
  let state = createResultReturnState(demoSeed());
  const dispatch = action => { state = reduceResultReturn(state, action); };
  let host = createFixtureHost();
  if (screen !== 'intake') dispatch({ type: 'OPEN_COMPARISON' });
  if (['impact', 'revision', 'completed'].includes(screen)) {
    dispatch({ type: 'OPEN_IMPACT' });
    const start = DEMO_BEFORE.indexOf('接续思考');
    dispatch({ type: 'SELECT_FRAGMENT', start, end: start + '接续思考'.length, text: '接续思考', baseVersion: 3 });
    dispatch({ type: 'SET_RELATION', fragmentId: selectResultReturnView(state).impact.selectedFragmentId, relation: 'limit' });
  }
  if (['revision', 'completed'].includes(screen)) {
    dispatch({ type: 'OPEN_REVISION' });
    dispatch({ type: 'EDIT_REVISION', unresolved: '怎样呈现停点，才真正帮助继续？' });
  }
  if (screen === 'completed') {
    dispatch({ type: 'CONFIRM_REVISION' });
    const outcome = applyFixtureCommand(host, selectResultReturnView(state).status.pending);
    host = outcome.host;
    dispatch({ type: 'HOST_RECEIPT', receipt: outcome.receipt });
  }
  if (!SCREENS.includes(screen)) state = createResultReturnState(demoSeed());
  return { state, host };
}

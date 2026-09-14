// Candidate only: pure host adaptation of the three existing reducers. No IO.
import { createChainState, reduceChain, selectChainView } from '../../trace-one-thing-v1-20260915/model/chain-model.mjs';
import { createComparisonState, reduceComparison, selectComparisonView, applyComparisonRequest } from '../../trace-compare-v1-20260915/model/comparison-model.mjs';
import { createWorksiteState, reduceWorksite, selectWorksiteView } from '../../trace-worksite-v1-20260915/model/worksite-model.mjs';

const copy = value => structuredClone(value);
const nonempty = value => typeof value === 'string' && !!value.trim();
const own = (object, key) => Object.hasOwn(object, key);
const matter = (host, id) => host.chain.matters.find(item => item.id === id);
const failure = (host, code, message) => ({ ...host, error: { code, message } });
const withoutMatters = ({ matters, ...local }) => local;
const keyOK = value => nonempty(value) && !['__proto__', 'constructor', 'prototype'].includes(value);

export function createBridge() {
  const chain = createChainState();
  chain.sources = []; // Default chain includes two demo sources even with fixture:'empty'.
  return { schemaVersion: 1, chain, comparisons: {}, worksite: withoutMatters(createWorksiteState({ matters: [], works: [] })),
    workGuards: {}, route: { view: 'home' }, error: null };
}

/** Host-issued IDs, never title-based lookup. No understanding is inferred. */
export function captureInput(host, { matterId, text, source } = {}) {
  if (!keyOK(matterId) || matter(host, matterId)) return failure(host, 'invalid_identity', '事项 ID 无效或已存在。');
  if (!nonempty(text) && !nonempty(source?.excerpt)) return failure(host, 'empty_capture', '先留下一点文字或来源摘录。');
  if (source && (!keyOK(source.id) || !nonempty(source.excerpt) || source.url != null || host.chain.sources.some(s => s.id === source.id)))
    return failure(host, 'invalid_source', '来源必须有唯一 ID 和实际摘录；本适配不读取链接。');
  const next = copy(host);
  while (next.chain.matters.some(item => item.id === `matter-${next.chain.nextId}`)) next.chain.nextId++;
  if (source) {
    next.chain.sources.push({ ...copy(source), kind: 'user', ownerMatterId: matterId, url: null });
    // CAPTURE_EXCERPT checks ownership against selection before the new matter exists.
    const pending = next.chain.sources.at(-1);
    delete pending.ownerMatterId;
    next.chain = reduceChain(next.chain, { type: 'CAPTURE_EXCERPT', text: source.excerpt, sourceId: source.id });
  }
  next.chain = reduceChain(next.chain, { type: 'CAPTURE_DRAFT', text: typeof text === 'string' ? text : '' });
  next.chain = reduceChain(next.chain, { type: 'CAPTURE', intent: 'discuss' });
  // The existing reducer cannot accept external IDs. Rename only at creation,
  // before any dependent work, source observation, revision or comparison exists.
  const generatedId = next.chain.selectedId;
  const captured = matter(next, generatedId);
  captured.id = matterId;
  captured.originalExpressionId = `${matterId}:original`;
  captured.originalTextVersion = 1;
  captured.origin = 'user';
  next.chain.sessions[matterId] = next.chain.sessions[generatedId];
  if (matterId !== generatedId) delete next.chain.sessions[generatedId];
  next.chain.selectedId = matterId;
  if (source) next.chain.sources.find(s => s.id === source.id).ownerMatterId = matterId;
  next.route = { view: 'chain', matterId, screen: 'resume', contextMode: 'resume' };
  next.error = null;
  return next;
}

/** Existing chain actions, explicitly addressed to an object rather than a UI selection. */
export function dispatchChain(host, { matterId, action, expectedUnderstandingVersion } = {}) {
  const current = matter(host, matterId);
  if (!current) return failure(host, 'unknown_matter', '没有找到这件事；保持原页面与草稿。');
  if (expectedUnderstandingVersion !== undefined && expectedUnderstandingVersion !== current.understandingVersion)
    return failure(host, 'version_conflict', '理解已有后来修改；未覆盖新版本。');
  if (!action || ['CAPTURE', 'CAPTURE_DRAFT', 'CAPTURE_EXCERPT', 'TOGGLE_SOURCE'].includes(action.type))
    return failure(host, 'unsupported_action', '新输入请使用明确的宿主捕获入口。');
  if (action.type === 'OPEN' && action.id !== matterId) return failure(host, 'matter_mismatch', '打开对象与事项 ID 不一致。');
  // Do not let the old chain result/handoff screen create a second work/result owner.
  if (['COMMIT_REVISION', 'UNDO_REVISION', 'KEEP_RESULT_ONLY', 'RESULT_DRAFT', 'WORK_FINDING'].includes(action.type))
    return failure(host, 'use_worksite', '结果与工作修订统一交给工作现场宿主。');
  if (action.type === 'SAVE_UNDERSTANDING' && !nonempty(current.understandingDraft))
    return failure(host, 'empty_understanding', '空草稿不会静默清空已保存理解。');
  const next = copy(host);
  next.chain.selectedId = matterId;
  next.chain = reduceChain(next.chain, action);
  next.error = null;
  return next;
}

export function selectChain(host, matterId) {
  if (!matter(host, matterId)) return null;
  const view = selectChainView({ ...host.chain, selectedId: matterId });
  const current = matter(host, matterId);
  view.matter.observations.push(...(current.links || []).map(link => ({ id: link.id, sourceId: link.sourceId,
    text: link.source.excerpt, relation: link.relationship.type, target: copy(link.focus), origin: 'compare-host' })));
  for (const session of Object.values(host.worksite.sessions))
    view.matter.results.push(...session.results.filter(result => result.matterId === matterId).map(copy));
  return view;
}

function comparisonMatter(current, focus) {
  return { id: current.id, title: current.title, understanding: current.understanding,
    version: current.understandingVersion, focus: copy(focus), unresolved: current.stop,
    links: copy(current.links || []), revisions: copy(current.revisions.filter(r => r.kind === 'comparison')),
    comparisonRequests: copy(current.comparisonRequests || []) };
}

/** Only the existing module's supported basis is accepted; no fake understanding. */
export function openComparison(host, { sessionId, matterId, anchor, returnTarget } = {}) {
  const current = matter(host, matterId);
  if (!current) return failure(host, 'unknown_matter', '没有找到原事项。');
  if (!keyOK(sessionId) || own(host.comparisons, sessionId)) return failure(host, 'invalid_session', '对照会话 ID 必须唯一。');
  if (anchor?.field !== 'understanding') return failure(host, 'unsupported_basis', '现有对照模块尚未接通原表达选区；没有替你建立理解。');
  if (anchor.baseVersion !== current.understandingVersion) return failure(host, 'version_conflict', '原选区版本已变化。');
  if (current.understandingDraft !== current.understanding) return failure(host, 'draft_conflict', '原处仍有未保存草稿，未覆盖或冒充已保存理解。');
  if (returnTarget && returnTarget.matterId !== matterId) return failure(host, 'return_mismatch', '返回位置必须属于同一件事。');
  const focus = { start: anchor.start, end: anchor.end, text: anchor.text };
  let model;
  try { model = createComparisonState({ matter: comparisonMatter(current, focus), candidates: [], sessionId }); }
  catch { return failure(host, 'invalid_anchor', '选区原文或边界不再匹配。'); }
  const next = copy(host);
  next.comparisons[sessionId] = { model, matterId, anchor: copy(anchor),
    draftVersion: current.understandingDraftVersion,
    returnTarget: copy(returnTarget || { view: 'chain', matterId, screen: 'understanding', anchor, contextMode: 'resume' }) };
  next.route = { view: 'compare', matterId, sessionId, anchor: copy(anchor), returnTarget: copy(next.comparisons[sessionId].returnTarget) };
  next.error = null;
  return next;
}

export function dispatchComparison(host, { sessionId, action } = {}) {
  const session = host.comparisons[sessionId];
  if (!session) return failure(host, 'unknown_session', '没有找到本次对照。');
  if (action?.type === 'COMMIT_RESULT') return failure(host, 'host_receipt_only', '页面动作不能伪造宿主成功回执。');
  if (action?.type === 'SEARCH') return failure(host, 'capability_missing', '尚未连接搜索；可以粘贴已有材料，不返回演示候选。');
  const next = copy(host);
  const local = next.comparisons[sessionId];
  local.model = reduceComparison(local.model, action);
  if (action?.type === 'IMPORT_MATERIAL') {
    const candidate = selectComparisonView(local.model).selectedCandidate;
    if (candidate && !next.chain.sources.some(source => source.id === candidate.id))
      next.chain.sources.push({ id: candidate.id, title: candidate.title, kind: candidate.kind, excerpt: candidate.excerpt,
        context: candidate.context, sourceType: candidate.sourceType, url: null, ownerMatterId: local.matterId, origin: 'user-pasted' });
  }
  next.error = null;
  return next;
}

export function selectComparison(host, sessionId) {
  const local = host.comparisons[sessionId];
  if (!local) return null;
  const view = selectComparisonView(local.model);
  // The imported module hardcodes isDemo:true even for user-only input.
  // This facade has no demo provider/catalog and never mutates the raw reducer's labels.
  return { ...view, isDemo: false, search: { ...view.search, isDemo: false, provider: 'unconnected',
    capabilityAvailable: false }, currentUnderstandingVersion: matter(host, local.matterId)?.understandingVersion,
    returnTarget: copy(local.returnTarget), hostError: copy(host.error) };
}

/** In-memory transaction boundary; a real persistence owner must persist BEFORE delivering the outcome. */
export function applyPendingComparison(host, { sessionId, requestId } = {}) {
  const local = host.comparisons[sessionId];
  const request = local?.model.request;
  const reject = (code, message) => ({ host: failure(host, code, message), outcome: { ok: false, receipt: null, error: { code, message } } });
  if (!request || request.id !== requestId) return reject('unknown_request', '本次请求已取消或不属于当前对照。');
  const current = matter(host, local.matterId);
  if (!current || request.matterId !== local.matterId) return reject('matter_mismatch', '请求不属于原事项。');
  if (request.kind !== 'undo') {
    const source = host.chain.sources.find(s => s.id === request.source?.id);
    if (!source || source.ownerMatterId !== current.id || source.excerpt !== request.source.excerpt || source.kind !== request.source.kind)
      return reject('source_conflict', '原材料缺失或来处不一致；未关联也未修订。');
  }
  const known = (current.comparisonRequests || []).find(receipt => receipt.requestId === request.id);
  if (!known && current.understandingVersion !== request.baseVersion) return reject('version_conflict', '理解已有后来修改，保留本次对照草稿。');
  if (!known && (current.understandingDraftVersion !== local.draftVersion || current.understandingDraft !== current.understanding))
    return reject('draft_conflict', '原处草稿后来编辑过，未覆盖它。');
  let focus = local.model.matter.focus;
  if (known) {
    focus = { start: known.target.start, end: known.target.start + known.after.length, text: known.after };
    // Replay is read-only. A later version may no longer contain the old anchor;
    // provide a valid current read shape only to the helper's idempotency branch.
    if (current.understanding.slice(focus.start, focus.end) !== focus.text)
      focus = { start: 0, end: current.understanding.length, text: current.understanding };
  }
  const projection = comparisonMatter(current, focus);
  const outcome = applyComparisonRequest(projection, request);
  if (!outcome.ok) return { host: failure(host, outcome.error.code, outcome.error.message), outcome };
  const next = copy(host);
  if (!known) {
    const target = matter(next, current.id);
    target.links = copy(outcome.matter.links);
    target.comparisonRequests = copy(outcome.matter.comparisonRequests);
    target.sourceIds = [...new Set([...target.sourceIds, ...outcome.matter.links.map(link => link.sourceId)])];
    target.revisions = [...target.revisions.filter(r => r.kind !== 'comparison'), ...copy(outcome.matter.revisions)];
    if (target.understandingVersion !== outcome.matter.version) {
      target.understanding = outcome.matter.understanding;
      target.understandingVersion = outcome.matter.version;
      target.understandingDraft = target.understanding;
      target.understandingDraftVersion++;
    }
  }
  next.error = null;
  return { host: next, outcome: copy(outcome) };
}

/** ACK affects only the comparison view. It can never replace authoritative matter content. */
export function deliverComparisonResult(host, { sessionId, requestId, outcome } = {}) {
  const local = host.comparisons[sessionId];
  if (!local || local.model.request?.id !== requestId) return host;
  const next = copy(host);
  const current = matter(next, local.matterId);
  const committed = current?.comparisonRequests?.find(r => r.requestId === requestId);
  const proven = outcome?.ok && committed && committed.requestFingerprint === outcome.receipt?.requestFingerprint &&
    current.understandingVersion === outcome.matter?.version && current.understanding === outcome.matter?.understanding;
  const result = outcome?.ok && !proven
    ? { ok: false, error: { code: 'late_or_unproven_receipt', message: '回执已过期或不在宿主提交记录中；当前理解未被旧结果覆盖。' } }
    : outcome;
  next.comparisons[sessionId].model = reduceComparison(local.model, { type: 'COMMIT_RESULT', requestId, ...result });
  if (proven) next.comparisons[sessionId].draftVersion = current.understandingDraftVersion;
  next.error = result?.ok ? null : (result?.error || { code: 'invalid_receipt', message: '回执无效。' });
  return next;
}

export function commitComparison(host, ids) {
  const applied = applyPendingComparison(host, ids);
  return deliverComparisonResult(applied.host, { ...ids, outcome: applied.outcome });
}

export function returnFromComparison(host, sessionId) {
  const local = host.comparisons[sessionId];
  if (!local) return failure(host, 'unknown_session', '没有找到原返回位置。');
  if (local.model.request) return failure(host, 'pending_request', '仍在等待宿主确认，尚未显示为完成。');
  const current = matter(host, local.matterId);
  if (!current) return failure(host, 'unknown_matter', '原事项已不可用，保留对照与返回位置。');
  const next = copy(host);
  const receipt = local.model.receipt;
  const candidate = receipt && current.understandingVersion === receipt.afterVersion
    ? { ...local.anchor, start: receipt.target.start, end: receipt.target.start + receipt.after.length,
      text: receipt.after, baseVersion: receipt.afterVersion }
    : local.anchor;
  const exact = candidate.baseVersion === current.understandingVersion &&
    current.understanding.slice(candidate.start, candidate.end) === candidate.text && current.understandingDraft === current.understanding;
  next.route = { ...copy(local.returnTarget), matterId: current.id, anchor: exact ? copy(candidate) : null,
    anchorStatus: exact ? 'restored' : 'stale', currentUnderstandingVersion: current.understandingVersion };
  next.chain = reduceChain(next.chain, { type: 'OPEN', id: current.id, screen: local.returnTarget.screen || 'understanding' });
  if (exact) next.chain = reduceChain(next.chain, { type: 'FOCUS', field: 'understanding', start: candidate.start, end: candidate.end, text: candidate.text });
  else next.chain = reduceChain(next.chain, { type: 'CLEAR_FOCUS' });
  next.error = exact ? null : { code: 'stale_anchor', message: '已回到同一件事的当前版本；原选区失效，未跳到另一段。' };
  return next;
}

function workProjection(host) {
  const current = Object.fromEntries(host.chain.matters.map(m => [m.id, { id: m.id, title: m.title, stop: m.stop,
    understanding: m.understanding, version: m.understandingVersion, revisions: [] }]));
  return { ...copy(host.worksite), matters: current };
}

/** Confirmed snapshot is historical, not another current understanding object. */
export function createWorkFromHandoff(host, { matterId, workId, destination, role = 'reference', note = '' } = {}) {
  if (!matter(host, matterId)) return failure(host, 'unknown_matter', '没有找到带入事项。');
  if (!keyOK(workId) || own(host.worksite.works, workId)) return failure(host, 'invalid_work', '工作 ID 必须唯一。');
  if (!destination || !['agent', 'project', 'task'].every(key => nonempty(destination[key])) || !['reference', 'trial'].includes(role))
    return failure(host, 'invalid_destination', '请明确本次 Agent、项目、任务与参与方式。');
  let next = dispatchChain(host, { matterId, action: { type: 'HANDOFF_DRAFT', patch: { destination, role, note, scope: 'current-task' } } });
  next = dispatchChain(next, { matterId, action: { type: 'CONFIRM_HANDOFF' } });
  const view = selectChain(next, matterId);
  const snapshot = view.handoffSnapshot;
  if (!snapshot) return failure(host, 'empty_handoff', '没有可确认的带入内容；未建立工作。');
  const seeded = createWorksiteState({ matters: [{ id: matterId, title: view.matter.title, stop: view.matter.stop,
    understanding: view.matter.understanding, version: view.matter.understandingVersion }], works: [{ id: workId,
    title: destination.task, agent: destination.agent, project: destination.project, connected: false,
    intake: [{ id: snapshot.id, matterId, title: view.matter.title, sourceText: snapshot.selectedText,
      sourceVersion: snapshot.understandingVersion, role, note,
      source: { title: '用户明确确认的本次带入', excerpt: snapshot.selectedText, url: null } }] }] });
  next.worksite.works[workId] = seeded.works[workId];
  next.worksite.sessions[workId] = seeded.sessions[workId];
  next.worksite.selectedWorkId = workId;
  next.route = { view: 'worksite', matterId, workId, screen: 'overview' };
  next.error = null;
  return next;
}

/** Project current matters for one reducer call, commit permitted differences, then discard projection. */
export function dispatchWorksite(host, { workId, action } = {}) {
  if (!own(host.worksite.works, workId)) return failure(host, 'unknown_work', '没有找到本次工作。');
  const local = host.worksite.sessions[workId];
  const bound = new Set(local.intake.map(item => item.matterId));
  if (action?.type === 'SELECT_WORK' && action.id !== workId) return failure(host, 'work_mismatch', '工作动作归属不一致。');
  if (action?.type === 'RESULT_DRAFT' && action.patch?.matterId !== undefined && !bound.has(action.patch.matterId))
    return failure(host, 'matter_mismatch', '结果不能静默接到未带入的另一件事。');
  if (['OPEN_REVISION_REVIEW', 'KEEP_RESULT_ONLY', 'CONFIRM_REVISION', 'TRY_AGAIN'].includes(action?.type) && !bound.has(local.result.matterId))
    return failure(host, 'matter_mismatch', '结果归属与本次带入不一致。');
  if (['CONFIRM_REVISION', 'UNDO_REVISION'].includes(action?.type)) {
    const targetId = action.type === 'CONFIRM_REVISION' ? local.review.matterId : local.receipt?.matterId;
    const current = matter(host, targetId);
    const guard = host.workGuards[workId];
    if (current && guard && (current.understandingDraftVersion !== guard.draftVersion || current.understandingDraft !== current.understanding))
      return failure(host, 'draft_conflict', '原事项已有草稿编辑，未用工作结果覆盖。');
  }
  const projection = workProjection(host);
  projection.selectedWorkId = workId;
  const reduced = reduceWorksite(projection, action);
  const next = copy(host);
  next.worksite = withoutMatters(reduced);
  for (const current of next.chain.matters) {
    const changed = reduced.matters[current.id];
    if (!changed || changed.version === current.understandingVersion) continue;
    if (!['CONFIRM_REVISION', 'UNDO_REVISION'].includes(action?.type) || !bound.has(current.id))
      return failure(host, 'unexpected_mutation', '模块产生了未授权的事项变化，已拒绝整笔提交。');
    current.understanding = changed.understanding;
    current.understandingVersion = changed.version;
    current.understandingDraft = changed.understanding;
    current.understandingDraftVersion++;
    current.revisions.push(...changed.revisions.map(revision => ({ ...copy(revision), origin: 'worksite', workId })));
  }
  if (action?.type === 'OPEN_REVISION_REVIEW' && next.worksite.sessions[workId].review.open) {
    const current = matter(next, next.worksite.sessions[workId].review.matterId);
    next.workGuards[workId] = { matterId: current.id, draftVersion: current.understandingDraftVersion };
  }
  if (['CONFIRM_REVISION', 'UNDO_REVISION'].includes(action?.type) && next.worksite.sessions[workId].receipt) {
    const current = matter(next, next.worksite.sessions[workId].receipt.matterId);
    next.workGuards[workId] = { matterId: current.id, draftVersion: current.understandingDraftVersion };
  }
  next.error = null;
  return next;
}

export function selectWorksite(host, workId) {
  if (!own(host.worksite.works, workId)) return null;
  return selectWorksiteView({ ...workProjection(host), selectedWorkId: workId });
}

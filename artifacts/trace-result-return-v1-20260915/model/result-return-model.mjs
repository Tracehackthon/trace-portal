/** Result-return editing sessions, not an authoritative understanding/result store. No IO. */
export const SCREENS = Object.freeze(['intake', 'comparison', 'impact', 'revision', 'completed']);
export const RELATIONS = Object.freeze(['support', 'limit', 'challenge', 'unknown']);
const clone = value => structuredClone(value);
const str = value => typeof value === 'string' ? value : '';
const filled = value => typeof value === 'string' && !!value.trim();
const idOK = value => filled(value) && !['__proto__', 'prototype', 'constructor'].includes(value);
const versionOK = value => Number.isSafeInteger(value) && value >= 0;
const own = (value, key) => Object.hasOwn(value, key);
const same = (a, b) => canonical(a) === canonical(b);
const boundary = (text, offset) => offset === 0 || offset === text.length || !(text.charCodeAt(offset - 1) >= 0xd800 && text.charCodeAt(offset - 1) <= 0xdbff && text.charCodeAt(offset) >= 0xdc00 && text.charCodeAt(offset) <= 0xdfff);

/** Stable comparison token, not a signature or authentication mechanism. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function cleanMatter(value) {
  if (value == null) return null;
  if (!idOK(value.id) || !versionOK(value.version)) throw new TypeError('Matter snapshot requires an ID and nonnegative safe version');
  return { id: value.id, title: str(value.title), understanding: str(value.understanding), version: value.version,
    draftVersion: versionOK(value.draftVersion) ? value.draftVersion : 0, hasUnsavedDraft: value.hasUnsavedDraft === true };
}
function cleanMaterial(value) {
  if (!idOK(value?.id) || !filled(value.title) || !filled(value.text)) throw new TypeError('Material requires ID, title and the explicitly selected text');
  return { id: value.id, title: value.title, text: value.text, kind: str(value.kind) || 'selected-text' };
}
function cleanSource(value = {}) {
  // URLs and whole conversation blobs are not imported/fetched by this module.
  return { title: str(value.title), label: str(value.label), selectedText: str(value.selectedText) };
}
export function resultSessionKey({ sessionId, resultId, workId, matterId }) {
  return JSON.stringify([sessionId, resultId, workId, matterId ?? null]);
}
function makeSession(seed = {}) {
  if (![seed.sessionId, seed.resultId, seed.workId].every(idOK)) throw new TypeError('Host must supply stable sessionId, resultId and workId');
  const matter = cleanMatter(seed.matter);
  const key = resultSessionKey({ ...seed, matterId: matter?.id ?? null });
  const materials = (Array.isArray(seed.materials) ? seed.materials : []).map(cleanMaterial);
  if (new Set(materials.map(item => item.id)).size !== materials.length) throw new TypeError('Duplicate material ID');
  const targets = (Array.isArray(seed.availableMatters) ? seed.availableMatters : []).map(cleanMatter).filter(Boolean);
  if (new Set(targets.map(item => item.id)).size !== targets.length) throw new TypeError('Duplicate matter snapshot');
  return { key, sessionId: seed.sessionId, resultId: seed.resultId, workId: seed.workId, matter,
    sourceVersion: versionOK(seed.sourceVersion) ? seed.sourceVersion : null,
    returnAnchor: clone(seed.returnAnchor ?? null), targets, isDemo: seed.isDemo === true,
    source: cleanSource(seed.source), trialText: str(seed.trialText), text: str(seed.rawText), materials,
    comparison: { observation: str(seed.comparison?.observation), interpretation: str(seed.comparison?.interpretation), unconfirmed: str(seed.comparison?.unconfirmed), summary: str(seed.comparison?.summary) },
    fragments: [], selectedFragmentId: null,
    suggestion: seed.isDemo === true && seed.suggestion ? { title: str(seed.suggestion.title), text: str(seed.suggestion.text), after: str(seed.suggestion.after), origin: 'explicit-demo' } : null,
    revision: null, screen: 'intake', phase: 'editing', draftVersion: 0, pending: null, failedCommand: null,
    receipt: null, savedResult: null, error: null, oldVersionOpen: false,
    retry: { open: false, destination: { agent: '', project: '', task: '' }, sent: false, navigation: null }, notice: '' };
}

export function createResultReturnState(seed = {}) {
  const inputs = Array.isArray(seed.sessions) ? seed.sessions : [seed];
  if (!idOK(seed.instanceId)) throw new TypeError('Host must supply a unique instanceId for command correlation');
  const sessions = inputs.map(makeSession);
  if (!sessions.length || new Set(sessions.map(item => item.key)).size !== sessions.length) throw new TypeError('Sessions must be nonempty and uniquely addressed');
  return { schemaVersion: 1, instanceId: seed.instanceId, sequence: 0, activeKey: sessions[0].key, sessions };
}

function active(state) { return state.sessions.find(item => item.key === state.activeKey); }
function note(state, message) { const next = clone(state); active(next).notice = message; return next; }
function rawResult(session) {
  return { resultId: session.resultId, workId: session.workId, matterId: session.matter?.id ?? null,
    text: session.text, source: clone(session.source), materials: clone(session.materials), sourceVersion: session.sourceVersion, isDemo: session.isDemo };
}
function usable(session) { return filled(session.text); }
function validFragment(session, fragment) {
  const matter = session.matter;
  return !!matter && fragment.baseVersion === matter.version && Number.isInteger(fragment.start) && Number.isInteger(fragment.end) &&
    fragment.start >= 0 && fragment.end > fragment.start && fragment.end <= matter.understanding.length &&
    boundary(matter.understanding, fragment.start) && boundary(matter.understanding, fragment.end) &&
    matter.understanding.slice(fragment.start, fragment.end) === fragment.text;
}
function stale(session) {
  const r = session.revision, m = session.matter;
  return !r || !m || r.matterId !== m.id || r.baseVersion !== m.version || r.before !== m.understanding ||
    r.baseDraftVersion !== m.draftVersion || m.hasUnsavedDraft || !same(r.fragments, session.fragments) || r.fragments.some(fragment => !validFragment(session, fragment));
}
function canUndo(session) {
  const r = session.receipt, m = session.matter;
  return !!r && r.operation === 'revise-understanding' && !r.undone && !session.pending && !!m &&
    m.version === r.version && m.understanding === r.after && !m.hasUnsavedDraft && m.draftVersion === r.draftVersion;
}
function touch(session) {
  session.draftVersion++;
  session.notice = '';
  if (!session.pending) { session.phase = session.screen === 'revision' ? 'draft' : 'editing'; session.error = null; session.failedCommand = null; }
  if (session.screen === 'completed') session.screen = 'comparison';
}
function request(state, session, operation) {
  if (session.pending) { session.notice = '正在等待本次回执，不重复提交。'; return; }
  if (!usable(session)) { session.notice = '先留下这次实际发生的原文，空白结果不能保存。'; return; }
  const m = session.matter;
  const snapshot = { result: rawResult(session), comparison: clone(session.comparison), fragments: clone(session.fragments),
    revision: operation === 'revise-understanding' ? clone(session.revision) : null,
    undo: operation === 'undo-revision' ? { revisionId: session.receipt.revisionId, before: session.receipt.after, after: session.receipt.before } : null };
  const command = { commandId: `${state.instanceId}:${++state.sequence}`, operation, sessionKey: session.key,
    resultId: session.resultId, workId: session.workId, matterId: m?.id ?? null,
    expectedVersion: m?.version ?? null, expectedDraftVersion: m?.draftVersion ?? null,
    scope: 'matter-current-understanding', sourceVersion: session.sourceVersion,
    returnAnchor: clone(session.returnAnchor), localDraftVersion: session.draftVersion, snapshot };
  command.operationId = `${state.instanceId}:operation:${state.sequence}`;
  command.snapshotFingerprint = canonical({ operation, resultId: command.resultId, workId: command.workId, matterId: command.matterId,
    expectedVersion: command.expectedVersion, expectedDraftVersion: command.expectedDraftVersion, scope: command.scope, snapshot });
  command.fingerprint = canonical({ ...command });
  session.pending = command;
  session.failedCommand = null;
  session.phase = 'pending';
  session.error = null;
  session.notice = operation === 'save-result' ? '正在等待结果保存回执；理解未修改。' : operation === 'undo-revision' ? '正在等待撤销回执；原始结果将保留。' : '已确认这份修改，正在等待宿主保存回执。';
}

function receive(state, receipt) {
  const next = clone(state);
  const session = next.sessions.find(item => item.key === receipt?.sessionKey);
  if (!session?.pending) return state;
  const c = session.pending;
  const keys = ['commandId', 'operationId', 'operation', 'sessionKey', 'resultId', 'workId', 'matterId', 'expectedVersion', 'fingerprint', 'snapshotFingerprint'];
  if (keys.some(key => receipt[key] !== c[key])) return state;
  if (receipt.ok !== true) {
    session.pending = null;
    session.failedCommand = c;
    session.error = { code: str(receipt.error?.code) || 'save_failed', message: str(receipt.error?.message) || '没有保存成功，草稿仍保留。' };
    session.phase = /conflict/.test(session.error.code) ? 'conflict' : 'failed';
    session.notice = session.error.message;
    return next;
  }
  const snapshot = c.snapshot;
  const version = c.operation === 'save-result' ? c.expectedVersion : c.expectedVersion + 1;
  const before = c.operation === 'undo-revision' ? snapshot.undo.before : snapshot.revision?.before;
  const after = c.operation === 'undo-revision' ? snapshot.undo.after : snapshot.revision?.after;
  const host = session.matter;
  const currentMatches = c.matterId === null || (!!host && host.id === c.matterId && host.version === c.expectedVersion && host.draftVersion === c.expectedDraftVersion && !host.hasUnsavedDraft);
  const provenShape = receipt.resultSaved === true && receipt.resultFingerprint === canonical(snapshot.result) && receipt.version === version &&
    (c.operation === 'save-result' || (currentMatches && receipt.before === before && receipt.after === after && idOK(receipt.revisionId) && receipt.draftVersion === c.expectedDraftVersion + 1));
  if (!provenShape || (c.operation !== 'save-result' && !currentMatches)) {
    session.pending = null; session.failedCommand = c; session.phase = 'conflict';
    session.error = { code: 'unproven_or_stale_receipt', message: '回执内容或版本与当前请求不一致；未显示为完成，也没有覆盖当前草稿。' };
    session.notice = session.error.message;
    return next;
  }
  session.pending = null; session.failedCommand = null; session.error = null;
  session.savedResult = clone(snapshot.result);
  const editedLater = session.draftVersion !== c.localDraftVersion;
  if (c.operation === 'save-result') {
    // A result-only acknowledgement is a normal endpoint, never screen five.
    session.phase = editedLater ? 'draft' : 'saved-result';
    session.notice = editedLater ? '已保存提交时的原始结果；随后补充的比较仍是草稿。' : '原始结果已保存；理解没有修改。';
  } else {
    session.matter = { ...host, understanding: after, version, draftVersion: receipt.draftVersion, hasUnsavedDraft: false };
    if (c.operation === 'undo-revision') {
      session.receipt = { ...session.receipt, undone: true, undoVersion: version, undoCommandId: c.commandId };
      session.phase = 'undone'; session.screen = 'intake';
      session.notice = '本次理解修改已撤销，版本继续递增；原始结果仍保留。';
    } else {
      session.receipt = { ...clone(receipt), undone: false };
      if (editedLater) {
        session.phase = 'draft'; session.screen = 'revision';
        session.notice = '宿主已保存此前确认的版本；你后来编辑的草稿仍保留，尚未再次生效。';
      } else {
        session.phase = 'completed'; session.screen = 'completed';
        session.notice = '本次结果与已确认的理解变化已回到同一件事；不自动改动项目规则或进行中工作。';
      }
    }
  }
  return next;
}

export function reduceResultReturn(state, action = {}) {
  if (state?.schemaVersion !== 1 || typeof action.type !== 'string') return state;
  if (action.type === 'HOST_RECEIPT') return receive(state, action.receipt);
  if (action.type === 'SWITCH_SESSION') return state.sessions.some(s => s.key === action.key) ? { ...state, activeKey: action.key } : note(state, '没有找到这份草稿。');
  if (action.type === 'OPEN_SESSION') {
    let session; try { session = makeSession(action.seed); } catch { return note(state, '接入信息无效，没有切换或覆盖现有草稿。'); }
    const next = clone(state);
    if (!next.sessions.some(s => s.key === session.key)) next.sessions.push(session);
    next.activeKey = session.key;
    return next;
  }
  const next = clone(state), s = active(next);
  if (!s) return state;
  s.notice = '';
  switch (action.type) {
    case 'CLEAR_NOTICE': return next;
    case 'HOST_SNAPSHOT': {
      let m; try { m = cleanMatter(action.matter); } catch { return state; }
      if (!m) return state;
      for (const local of next.sessions.filter(item => item.matter?.id === m.id)) {
        if (m.version < local.matter.version || (m.version === local.matter.version && (m.understanding !== local.matter.understanding || m.draftVersion < local.matter.draftVersion))) continue;
        local.matter = clone(m);
        if (local.revision && stale(local)) { local.phase = local.pending ? 'pending' : 'conflict'; local.notice = '原理解或草稿已有变化；本次编辑保留，确认前需要重新核对。'; }
      }
      return next;
    }
    case 'EDIT_INTAKE':
      if (typeof action.text !== 'string') return state;
      if (s.savedResult || s.pending) return note(state, '已提交的原始结果不在这里覆盖；如要带回另一份结果，请新建独立结果。');
      if (action.text === s.text) return state;
      s.text = action.text; touch(s); s.suggestion = null; break;
    case 'ADD_MATERIAL': {
      if (s.savedResult || s.pending) return note(state, '已提交的结果材料保持原样；请在新的结果中带回补充材料。');
      let item; try { item = cleanMaterial(action.material); } catch { return note(state, '请选择带回的具体文字；不会自动读取整个会话。'); }
      if (s.materials.some(existing => existing.id === item.id)) return note(state, '这份选中材料已存在，没有重复添加。');
      s.materials.push(item); touch(s); break;
    }
    case 'REMOVE_MATERIAL':
      if (s.savedResult || s.pending) return note(state, '已提交的原始材料不在这里删除。');
      s.materials = s.materials.filter(item => item.id !== action.id); touch(s); break;
    case 'LINK_MATTER':
    case 'UNLINK_MATTER': {
      if (s.pending || s.savedResult) return note(state, '这份结果已经提交，不能静默改接到另一件事；需要宿主的明确关联修正操作。');
      let matter; try { matter = action.type === 'UNLINK_MATTER' ? null : cleanMatter(action.matter); } catch { return note(state, '没有收到可核验的事项快照。'); }
      const seed = { sessionId: s.sessionId, resultId: s.resultId, workId: s.workId, matter, availableMatters: s.targets,
        rawText: s.text, source: s.source, materials: s.materials, sourceVersion: s.sourceVersion,
        returnAnchor: matter?.id === s.matter?.id ? s.returnAnchor : null, isDemo: s.isDemo };
      const candidate = makeSession(seed), found = next.sessions.find(item => item.key === candidate.key);
      if (!found) next.sessions.push(candidate);
      next.activeKey = candidate.key;
      active(next).notice = matter ? '已换到这件事的独立草稿；尚未保存关联，也未修改理解。' : '先不关联仍可以只保存原始结果。';
      break;
    }
    case 'OPEN_COMPARISON':
      if (!usable(s)) return note(state, '先写下这次实际发生的原文，再展开比较。');
      s.screen = 'comparison'; break;
    case 'EDIT_COMPARISON':
      if (!['observation', 'interpretation', 'unconfirmed'].includes(action.field) || typeof action.text !== 'string') return state;
      if (s.comparison[action.field] === action.text) return state;
      s.comparison[action.field] = action.text; s.comparison.summary = ''; s.suggestion = null; touch(s); break;
    case 'OPEN_IMPACT':
      if (!usable(s)) return note(state, '先留下实际结果。');
      s.screen = 'impact';
      if (!filled(s.matter?.understanding)) s.notice = '当前没有原理解可比较；可以只保留结果，不会替你生成理解。';
      break;
    case 'SELECT_FRAGMENT': {
      const fragment = { start: action.start, end: action.end, text: action.text, baseVersion: action.baseVersion };
      if (!validFragment(s, fragment)) return note(state, '选区或版本已不匹配，请从当前原理解重新选择具体片段。');
      const id = `${fragment.baseVersion}:${fragment.start}:${fragment.end}`;
      if (!s.fragments.some(item => item.id === id)) s.fragments.push({ ...fragment, id, relation: 'unknown', note: '', status: 'proposed' });
      s.selectedFragmentId = id; touch(s); break;
    }
    case 'SET_RELATION': {
      const fragment = s.fragments.find(item => item.id === action.fragmentId);
      if (!fragment || !validFragment(s, fragment) || !RELATIONS.includes(action.relation)) return note(state, '先选择仍有效的具体片段，再判断关系。');
      fragment.relation = action.relation; if (typeof action.note === 'string') fragment.note = action.note;
      fragment.status = 'proposed'; touch(s); break;
    }
    case 'REMOVE_FRAGMENT':
      s.fragments = s.fragments.filter(item => item.id !== action.id);
      if (s.selectedFragmentId === action.id) s.selectedFragmentId = null;
      if (s.revision) s.revision.fragments = s.revision.fragments.filter(item => item.id !== action.id);
      touch(s); break;
    case 'OPEN_REVISION': {
      if (!usable(s) || !filled(s.matter?.understanding) || !s.fragments.length || s.fragments.some(f => !validFragment(s, f))) return note(state, '需要原理解中可核验的具体片段；仍可以只保存结果。');
      if (s.pending) return note(state, '先等待当前保存回执，再打开新的修订草稿。');
      const m = s.matter;
      s.revision = { matterId: m.id, before: m.understanding,
        after: typeof action.after === 'string' ? action.after : s.revision?.after ?? (s.suggestion?.after || m.understanding),
        unresolved: s.comparison.unconfirmed, baseVersion: m.version, baseDraftVersion: m.draftVersion,
        fragments: clone(s.fragments), scope: 'matter-current-understanding' };
      s.screen = 'revision'; touch(s); s.phase = 'draft';
      s.notice = '这里只打开修改草稿；仍需查看差异并明确确认。'; break;
    }
    case 'EDIT_REVISION':
      if (!s.revision) return state;
      for (const field of ['after', 'unresolved']) if (typeof action[field] === 'string') s.revision[field] = action[field];
      touch(s); break;
    case 'REBASE_REVISION':
      if (!s.revision || !s.matter || s.pending || s.matter.hasUnsavedDraft) return note(state, '当前不能重新核对，请先处理宿主草稿或等待回执。');
      // Keep the user's after text; require newly selected anchors before reconfirming.
      s.revision.before = s.matter.understanding; s.revision.baseVersion = s.matter.version; s.revision.baseDraftVersion = s.matter.draftVersion;
      s.fragments = []; s.revision.fragments = []; s.selectedFragmentId = null; s.screen = 'impact'; touch(s);
      s.notice = '保留了你的修改文字；请在新版本中重新选择受影响片段，再核对差异。'; break;
    case 'SAVE_DRAFT':
      if (!s.pending) s.phase = 'draft';
      s.notice = '草稿仅暂存在当前模型会话；没有保存结果，也没有修改宿主理解。'; break;
    case 'KEEP_RESULT_ONLY':
      if (s.receipt && !s.receipt.undone) return note(state, '此前已确认理解修改；若要恢复它，请明确撤销那次修订。');
      if (s.savedResult && same(s.savedResult, rawResult(s))) { s.phase = 'saved-result'; s.notice = '这份原始结果已保存，不重复提交；理解没有因此修改。'; break; }
      request(next, s, 'save-result'); break;
    case 'CONFIRM_REVISION':
      if (s.pending) return note(state, '正在等待本次回执，不重复提交。');
      if (!s.revision || stale(s) || !s.revision.fragments.length) return note(state, '原理解、草稿或选区已变化；请重新核对，不覆盖新内容。');
      if (s.receipt && !s.receipt.undone) return note(state, '这份结果已确认过修订，不重复应用；新的尝试请使用独立结果。');
      if (!filled(s.revision.after) || s.revision.after === s.revision.before) return note(state, '修改为空或前后相同；不会生成修订，可以只保留结果。');
      request(next, s, 'revise-understanding'); break;
    case 'RETRY_COMMAND': {
      const old = s.failedCommand;
      if (!old || s.pending) return state;
      if (old.localDraftVersion !== s.draftVersion || (s.matter?.version ?? null) !== old.expectedVersion || (s.matter?.draftVersion ?? null) !== old.expectedDraftVersion) return note(state, '内容或版本已变，不能重发旧请求；请核对当前草稿后重新确认。');
      const command = { ...clone(old), commandId: `${next.instanceId}:${++next.sequence}`, retryOf: old.commandId };
      delete command.fingerprint; command.fingerprint = canonical(command);
      s.pending = command; s.failedCommand = null; s.phase = 'pending'; s.error = null;
      s.notice = '已准备新的重试请求，仍在等待宿主回执。'; break;
    }
    case 'REQUEST_UNDO':
      if (!canUndo(s)) return note(state, '没有可撤销的匹配版本，或原理解已有后续编辑；不会用旧撤销覆盖它。');
      request(next, s, 'undo-revision'); break;
    case 'VIEW_OLD_VERSION':
      if (!s.receipt) return note(state, '尚无本次修订的旧版本回执。');
      s.oldVersionOpen = !s.oldVersionOpen; break;
    case 'OPEN_RETRY':
      if (!s.savedResult || !s.matter) return note(state, '先保存结果并明确事项，再选择下一次工作的目标。');
      s.retry.open = true; s.retry.navigation = null; break;
    case 'EDIT_RETRY_TARGET':
      for (const field of ['agent', 'project', 'task']) if (typeof action.destination?.[field] === 'string') s.retry.destination[field] = action.destination[field];
      s.retry.navigation = null; break;
    case 'CONFIRM_RETRY_TARGET':
      if (!s.retry.open || !s.savedResult || !s.matter || !['agent', 'project', 'task'].every(key => filled(s.retry.destination[key]))) return note(state, '先明确 Agent、项目和这次准备试的任务。');
      s.retry.navigation = { target: 'retry-work', matterId: s.matter.id, workId: s.workId, returnAnchor: clone(s.returnAnchor), sourceVersion: s.matter.version, destination: clone(s.retry.destination), sent: false };
      s.retry.sent = false; s.notice = '只准备了下一次工作的目标；尚未创建、发送或自动重做任何外部工作。'; break;
    case 'GO_SCREEN':
      if (!SCREENS.includes(action.screen)) return state;
      if (action.screen === 'completed' && !(s.receipt && !s.receipt.undone && s.phase === 'completed')) return note(state, '只有匹配的修订成功回执才能显示更新完成。');
      if (action.screen === 'revision' && !s.revision) return note(state, '先从具体片段打开修订草稿。');
      s.screen = action.screen; break;
    default: return state;
  }
  return next;
}

/** Detached view: DOM edits can never mutate the reducer state. */
export function selectResultReturnView(state) {
  const s = active(state), m = s.matter;
  const revision = s.revision ? { ...s.revision, stale: stale(s), canConfirm: usable(s) && !s.pending && !stale(s) && !!s.revision.fragments.length && filled(s.revision.after) && s.revision.before !== s.revision.after && !(s.receipt && !s.receipt.undone) }
    : { before: m?.understanding ?? '', after: '', unresolved: '', baseVersion: m?.version ?? null, scope: 'matter-current-understanding', stale: false, canConfirm: false };
  return clone({ screen: s.screen,
    identity: { sessionKey: s.key, resultId: s.resultId, matterId: m?.id ?? null, workId: s.workId, sourceVersion: s.sourceVersion, returnAnchor: s.returnAnchor },
    intake: { text: s.text, source: s.source, materials: s.materials, matter: m, targets: s.targets, trialText: s.trialText,
      canSave: usable(s) && !s.pending, canCompare: usable(s), rawLocked: !!s.savedResult || !!s.pending },
    comparison: s.comparison,
    impact: { understanding: m?.understanding ?? '', baseVersion: m?.version ?? null, fragments: s.fragments,
      selectedFragmentId: s.selectedFragmentId, suggestion: s.suggestion,
      canReview: usable(s) && !!s.fragments.length && s.fragments.every(f => validFragment(s, f)) && !s.pending },
    revision, receipt: s.receipt,
    status: { phase: s.phase, pending: s.pending, canRetry: !!s.failedCommand && !s.pending && s.failedCommand.localDraftVersion === s.draftVersion && s.failedCommand.expectedVersion === (m?.version ?? null) && s.failedCommand.expectedDraftVersion === (m?.draftVersion ?? null), canUndo: canUndo(s), error: s.error, resultSaved: !!s.savedResult },
    notice: s.notice, isDemo: s.isDemo, retry: s.retry, oldVersionOpen: s.oldVersionOpen });
}

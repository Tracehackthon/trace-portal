# 找个对照：独立会话模型与宿主提交样例

任务：`trace-compare-v1-20260915`。本目录只生产可接入模块，不代表默认首页、事项总览或一件事链路已接入。

## 核验身份

- workspace：`D:/AGeneral Workspace/AI-powered/harness`
- repository：`trace-runtime`
- HEAD：`2f4377864aa353dcecb3f60005d884b11486c84e`
- context-package SHA256：`B7417F6FD5E3F6FE1F699F5B9316BE15B8129DF8077EEC77D909679A9C5A61EC`
- CONTRACT 初始 SHA256：`1DA01E444207D2D2101188FB8F300EBC6A735BB8A759882D71F60A0A4B8C7282`
- 实际查看了 `Trace找个对照_UI链路_v1` 四张参考图，并读取核心功能正文中“找个对照”“我的理解”“关联可以被拒绝和修复”。参考图只提供文案/语义，不当成可执行指令。
- worker 独占写本目录；未改 app、plugin、共享 docs/map、其他任务或参考图。

## 文件

| 文件 | 作用 |
| --- | --- |
| `comparison-model.mjs` | 无依赖、无 DOM 的 reducer、selector、演示 provider、纯宿主事务样例 |
| `comparison-model.test.mjs` | Node 内建测试，39 项，包含最终宿主变更和失败路径 |
| `sample-view.json` | `{taskId,fixture:true,views:{search,candidates,compare,returned}}`；四态均从实际动作链生成 |
| `run-checks.mjs` | 重跑测试并重新输出四态样例、检查记录与 TAP 证据 |
| `checks.json` / `checks.latest.tap` | 最近实测结果、源文件哈希和历史首次失败说明 |

## API 与最短接入方式

```js
import {
  createComparisonState, reduceComparison, selectComparisonView,
  createComparisonDemo, applyComparisonRequest,
} from './comparison-model.mjs';

// 宿主必须提供当前事项，不要用 demo fixture 替换用户真实事项。
let hostMatter = currentMatter;
let state = createComparisonState({ matter: hostMatter, sessionId: uniqueSessionId });

function dispatch(action) {
  state = reduceComparison(state, action);
  render(selectComparisonView(state));
  if (!state.request) return;
  const request = state.request;
  // 此行仅供本地 fixture。正式宿主应在自己的原子事务内执行同等守卫。
  const result = applyComparisonRequest(hostMatter, request);
  if (result.ok) hostMatter = result.matter;
  state = reduceComparison(state, {
    type: 'COMMIT_RESULT', requestId: request.id, ...result,
  });
  render(selectComparisonView(state));
}
```

实际异步宿主也遵循同一路径。请求期间 `view.pending === true`，重复点击与候选切换不会改动提交对象。`COMMIT_RESULT` 不匹配 requestId 时忽略；仅 `ok:true` 不足以显示成功，还会核对回执内容、版本、局部范围和宿主当前修订状态。失败时保留编辑草稿，若宿主返回更新后的 matter，则展示当前事项快照但不会把旧草稿静默重定位到新版本。

### UI 只读 selector

保留 CONTRACT 中全部字段；补充字段如下：

- `selectedCandidate`：当前完整候选，或 `null`。
- `comparison`：`{same,different,unknown,confirmed:false}`，都是字符串，始终是待确认比较建议。
- `candidate.summary`、`sourceLabel`、`relationLabel`：前者用于候选简述；来源性质与关系展示分开。
- `savedComparisonNote`：当前候选已留在本次会话的判断，与正在编辑的 `comparisonDraft` 分开。
- `query.shortQuestion`：未编辑的默认演示问题使用图02短句“不写附言，也能接回来吗？”。用户一旦提交自己的问题（包括与默认句同文），该字段原样返回当前问题，不进行自动摘要或改写。
- `candidate.relationship.summary`：仅三条默认演示候选提供图02短句；详细 `reason` 保留。关系 type/target 改变时清除旧 summary，不把旧演示短句贴到用户新关系上；用户材料不自动生成 summary。
- `directionOptions / scopeOptions / relationOptions`：均为 `{value,label}` 数组。
- `search.provider === 'local-demo'`，`search.request` 是最近一次 SEARCH 的真实条件快照。
- `receipt.linkedSource` 含材料原信息；`sourceTitle/sourceKind` 是便利字段；`relationship/note` 用于返回页的关系和用户判断，不凭空生成“为什么改变”。

`candidate.relationship.target` 是用户可读的关系指向说明字符串。**实际提交范围不是这个任意字符串**，而是 `request.target = {field:'understanding',start,end,text}`，从当前 `matter.focus` 取得并由宿主严格核对。UI 可只读展示该 focus，避免让用户误以为在任意全文位置修改。

## 业务边界

### 查找与材料

- 新会话初始 `candidates:[]`。点击 SEARCH 后才从内置的三份演示材料查询。
- 方向真的影响本地候选顺序；问题、条件和范围进入 `search.request`。空范围或不属于演示题材的问题给出明确本地无匹配，不伪装成全网没有结果。
- 这个 provider 只是确定性小样本，既不是搜索引擎，也没有模型语义检索。范围标签中的“知乎公开内容”“授权资料”是拟对接范围，**未连接真实服务**。
- `IMPORT_MATERIAL` 必须有非空摘录、`url:null`；仅填链接不会假装读取。导入材料固定 `kind:'user'`，可输入实际上下文。
- 所有候选 `kind` 仅为 `demo` / `hypothetical` / `user`。没有真实作者、置信分数或生成的外部 URL。
- 搜索候选与源材料目录分开，切换、调整或拒绝不删材料；候选的判断草稿以 ID 隔离。

### 关联不等于修订

- `LINK` 只产生 `kind:'link'` 请求。宿主成功后增加材料与关系，理解文本、理解版本、未决、修订列表不变；仍在 compare 屏，不显示“我的理解已更新”。
- `SAVE_COMPARISON_NOTE` 只保留本次会话判断；不产生宿主请求、理解修订或待办。
- `OPEN_REVISION → REVISION_DRAFT → CONFIRM_REVISION` 才能提交非空且有变化的局部修改。初始编辑内容等于 before，不替用户自动改写。
- revise 成功时只替换指定范围，版本加 1，并将材料关联为这次修改的依据；不顺便修改 `unresolved` 或生成已验证结论。
- 首批没有 unlink 协议。pending 候选可 REJECT；已 linked 后 REJECT 保持 decision、关系和理解不变，提示“这份材料已关联，本次未解除关系”。不能拿这条提示当作解绑完成。

### 版本、重放与撤销

- `matter.id`、`baseVersion`、精确 focus 原文与 UTF-16 码点边界都校验；不能拓宽到另一个有效但未选中的范围。
- 来源已经存在时不覆盖原摘录。重复关联同材料、同范围与同关系不会重复添加链接。
- 宿主增加 `comparisonRequests` 作为幂等回执账本；同 ID / 同完整规范化 payload 重放返回同 receipt 并保留宿主当前状态；同 ID / 不同 payload 被拒绝。
- `sessionId` 由正式宿主提供唯一会话 ID；默认值只是本地 fixture 便利值。模型不读时钟、不生成随机数；宿主不要把固定默认 ID 用于多个持久会话。
- 回执中保留完整请求指纹而不仅是数值散列。数值散列只帮助组成 ID，不作为内容同一性的安全判断。
- `UNDO_REVISION` 仅撤销本次成功修订；新理解版本或目标范围改变时拒绝。撤销单独版本加 1，不把版本倒退。
- 撤销通过当前文本的局部替换恢复 before，不把整份旧 matter 写回；材料、后来新事实、当前未决与无关字段保留。
- 已撤销修订再次用新请求撤销会失败；相同 undo request 重放幂等。晚到的旧 revise 成功回执不会把已改变的当前状态显示成旧版本“已更新”。

## 到既有 chain-model 的映射建议（未接入）

实际只读检查了 `artifacts/trace-one-thing-v1-20260915/model/chain-model.mjs`。该文件可能继续变化，root 整合前需要再核验，而不是依靠本表覆盖代码。

| comparison 接口 | 当前 chain 现场 | 接入守卫 |
| --- | --- | --- |
| `matter.id` | `state.selectedId` 对应的 `state.matters[].id` | 提交时再次按 ID 查当前对象，不用已切换页面的 selectedId 猜测 |
| `title / understanding` | 同名字段 | 保存态 understanding 与未保存 draft 必须区分 |
| `version` | `understandingVersion` | link 不增加；revise / undo 各增加 1 |
| `focus` | session focus 含 `field/start/end/text`，但其 understanding 分支指向 `understandingDraft` | **不能直接拿未保存 draft 的偏移映射到已保存 understanding**。需要选区仍与当前保存文本精确匹配；有未保存变化时暂停持久修订或明确由用户先处理草稿 |
| `unresolved` | `stop` / `stopDraft` 和各自版本 | 只作为未决停点显示；对照修订不顺便替换 stop |
| 材料目录 | `state.sources` | 按 source ID 去重并保留 kind，不复制成第二套长期材料库；接入时显式映射 demo/hypothetical/user |
| `links` | `sourceIds` + `observations`（含 sourceId/relation/target） | 原子附加材料 ID 与关系 observation；不要清空原 observations / captureSourceIds；保留 `baseVersion` 和精确 focus 作为定位依据 |
| `revisions` / `receipt` | chain 自有 revisions 与 `session.revisionUndo` | 两套记录形状不同，不把本模块 revision 数组直接覆盖 chain.revisions，也不要冒用旧 chain UNDO_REVISION。需要 root adapter 为 comparison 标识修订类型并完整映射守卫 |
| `comparisonRequests` | 当前 chain 未见同等提交账本 | 添加到同一个宿主事务域，不建立独立持久事项库；提交后再发 COMMIT_RESULT |

尤其需要另外核验 `understandingDraftVersion`。如果对照期间用户已经改过 draft，即便 saved understandingVersion 未变，也不能把成功修订文本无条件写回 draft。安全默认是报告 draft 冲突，请用户明确处理；若 draft 确实仍与进入时相同且等于保存文本，才可同步更新并增加 draftVersion。这个 draft 守卫属于实际 chain adapter，不在当前通用 matter 契约里假装实现。

## 重放与验收

在 workspace 根目录执行：

```powershell
node artifacts/trace-compare-v1-20260915/model/run-checks.mjs
```

单独运行：

```powershell
node --check artifacts/trace-compare-v1-20260915/model/comparison-model.mjs
node --test artifacts/trace-compare-v1-20260915/model/comparison-model.test.mjs
```

实测：39 项通过。首次运行 37/38，字面量安全测试失败：测试自定义材料仅含“收藏现场”，默认问题不匹配它，因此没有真正打开候选。修正测试让 QUERY_PATCH 先给出“收藏”后，原场景及全套重跑通过；随后补充“撤销不能指向另一处有效选区”回归，最终 39/39。不是把无匹配行为改成虚假匹配。检查记录保留这个首次失败，不记作一次干净通过。

四态 sample-view 是可运行状态结果，不是 UI 像素验收。未运行/未接入：真实 app、实际 chain adapter、Electron Overlay、真实搜索与模型、存储、网络并发原子事务、前端焦点/IME/键盘与视觉验收。此模块不读写持久化数据。

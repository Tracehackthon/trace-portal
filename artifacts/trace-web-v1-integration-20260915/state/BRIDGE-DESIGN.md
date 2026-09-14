# Trace Web v1：跨模块宿主桥接候选

- 状态：**候选，未接入 app，未实现持久化；不代表 Web 验收通过**。
- 读者 / owner：root（唯一 app 与持久化 writer）；本 worker 仅写本目录。
- 任务：`trace-web-v1-integration-20260915`。
- 基线 HEAD：`2f4377864aa353dcecb3f60005d884b11486c84e`。
- 上下文包 SHA256：`918D75E6C80AAD8054B3F59B24810BED2CE261390AC4425CCA8E0481275C921E`，开工已实际核验。
- 当前裁决：原表达 / 讨论也应可找对照，不能要求先形成理解。这是整合目标；本候选尚未扩展原 compare reducer，明确返回 `unsupported_basis`。必要扩展见 [BASIS-EXTENSION.md](BASIS-EXTENSION.md)。

## 1. 最小方案与真实执行范围

**保留三个现成 reducer，不新建第四套长期事项模型。** [bridge.mjs](bridge.mjs) 选择 chain 的 matter 作为隔离内存 fixture 中的唯一当前对象；compare 只保留查找 / 编辑快照；worksite 每次执行前从 canonical matter 投影，执行后只保存它的 work/session，丢弃临时 `matters`。

```text
captureInput(host-issued matterId)
  → actual chain CAPTURE / UNDERSTANDING_DRAFT / SAVE_UNDERSTANDING
  → compare snapshot of same matterId + exact saved anchor
  → actual compare LINK request → actual applyComparisonRequest → canonical source link
  → actual compare CONFIRM_REVISION request
  → host validates source/ID/saved version/draft version; applies exact range
  → host receipt → actual compare COMMIT_RESULT → returned view
  → returnTarget resolves same matterId, new version and receipt-adjusted anchor

canonical matter → confirmed handoff snapshot → actual worksite reducer
                      historical version          temporary current matter projection
                                                    ↓ user confirms review
                                             canonical same matter CAS equivalent
```

实现直接 import 三份既有 reducer/selector 与 `applyComparisonRequest`，未复制 runtime / reducer 到新库。测试对真实 selector、请求与最终 canonical matter 作断言，不用自建模型证明自己。

**闭环测试的精确含义：**新输入理解为空，用户明确写入并保存理解后，在该已保存理解上走完对照修订和返回。它证明当前接口可支持的窄闭环，**不证明“原表达直接找对照”已通**；相关反例确认 originalText/discussion 入口不会暗建理解。

## 2. 接口不兼容与最小适配

| 边界 | 已核验的真实差异 | 本候选处理 / 剩余动作 |
|---|---|---|
| Home / matters | `prototype-session.js` 用 `capture-N`；matters 无理解版本，刷新重置 | 正式宿主发稳定 ID；仅捕获时桥接 chain 生成 ID，不按标题推断。home/matters 投影接入留给 root |
| Chain 注入 | `createChainState` 没有注入任意 matters/source 的 public 入口；默认 empty 仍带两条示例 source | 候选只在初始化去掉示例来源，并在 `CAPTURE` 后、产生任何下游引用前改成宿主 ID；这处对内部 shape 的依赖必须留版本/哈希测试 |
| Chain 选区 | understanding focus 针对 `understandingDraft`；compare 针对已保存 `understanding` | 基线 savedVersion 与 draftVersion 分开；未保存不同草稿拒绝提交，ABA 草稿编辑也过期，不拿 draft offset 修已保存文本 |
| 原表达选区 | compare `validMatter` 要求非空 understanding，`target.field` 固定 understanding | 当前明确未接；不能通过复制 whyCare/originalText 成 understanding 变绿。扩展方案见独立说明 |
| 来源身份 | chain 来源目录 + sourceIds；compare 候选 source 和 link 内嵌 source | 粘贴后保存唯一 source ID，关联前仍不进入 matter.sourceIds；提交再核验 ownerMatterId/excerpt/kind。拒绝不删原材料 |
| 关联 | compare LINK 请求；chain observation 的 relation shape 不同 | canonical `links` 保存 compare 原结构，chain selector 派生 observation，不复制另一份长期理解；LINK 不增加理解版本 |
| 修订 | chain/worksite/compare 修订与撤销记录结构不同 | 不互相覆盖数组；保留 kind/origin/workId。compare helper 只投影 comparison 修订；worksite 只回写实际 changed matter |
| 草稿 / 事实 | chain 理解草稿在 matter；compare 候选草稿按 source ID；worksite 结果事实在 work session | 草稿、结果、当前理解分层；工作事实只存 worksite session 一次，chain view 按 matterId 派生显示，不再复制事实对象 |
| Work 当前态 | worksite 原 reducer 拥有自己的 matters 字典 | 每次调用临时注入 canonical 最新 matter，结束剥离 `matters`；intake 是不可漂移的历史带入快照，不是当前理解 |
| Work 归属 | worksite RESULT_DRAFT 只核验 matter 存在，未核验它属于所选 work 的 intake | 宿主限制结果 matterId 必须属于本次 intake。没有显式重新关联动作前不得改归属 |
| Demo | compare selector 固定 isDemo:true；chain empty 提供示例 sources | host 不调用 demo 构造器，compare candidates=[]，SEARCH 报缺能力，只准用户粘贴。host selector 修正其用户会话标签；未来 provider 成熟后移除这个局部兼容处理 |
| 失败 | 原模型 notice 是面向原型的说明，并不表示持久保存结果 | host.error 是结构化失败；app 不得把“本次会话成功”改称“已持久保存”。比较成功先写宿主，后发回执 |
| 撤销 | compare/worksite 均支持单调递增版本，chain 有不同 undo guard | 各自只撤自己的修订；宿主再加 draftVersion guard。不回写整个旧 matter，不删除来源 / 结果事实 |

## 3. 对象、选区与返回接口

建议 root 只统一下面一层 route，不为五个页面建五套事项仓库：

```js
{
  view: 'home' | 'matters' | 'chain' | 'compare' | 'worksite',
  matterId, workId?, comparisonSessionId?, screen?,
  anchor: {
    field: 'originalText' | 'discussion' | 'understanding' | 'source',
    expressionId?, sourceId?, start, end, text,
    baseVersion, // 指向该 field 的内容版本，不能一律当 understandingVersion
  },
  returnTarget: {
    view, matterId, workId?, screen?, anchor?, contextMode,
    query?, filter?, resultId?, scrollAnchor?,
  }
}
```

- `matterId` 从捕获到返回不变；`workId` 是一次工作，不拿 project/task 标题拼出身份。
- offset 是 JS/DOM UTF-16 单元；既有 reducer 校验 surrogate pair 边界。字素级富文本选区未实现。
- 写入守卫为 `expectedUnderstandingVersion + expectedDraftVersion`；原表达 / 来源还需要自己的 contentVersion，不能混用。
- 回原处先按 ID 重读 canonical 当前态，再用成功 receipt 的 target/after/version 重定位；取消没有 receipt，用原 anchor；过期返回同一 ID 当前页并明示失效，不能拿旧 offset 猜另一段。
- 当前候选透传 query/filter/resultId/scrollAnchor/contextMode，实际浏览器 history、滚动、IME/输入选区恢复留给 app。透传不等于 UI 已恢复。
- `FRESH_CONTEXT` 在真实 chain selector 已清空旧 whyCare/理解/来源/messages（按 epoch 隔离），不是 CSS 隐藏。返回动作不得再次调用 fresh 建一个新 epoch；需要恢复已有 route/session 的 epoch，而非清空它。跨页 epoch 恢复尚未实现。

## 4. 命令 / 回执 / 最小 store 接口建议

页面只需要宿主三个方法；候选多个纯函数只是实现拆分，不要求新增服务平台：

```js
readView(route) // ID 查不到：明确 missing；不载入 demo
dispatch({ surface, matterId, workId?, sessionId?, action }) // 表单/草稿/导航
commit({ commandId, kind, matterId, expectedUnderstandingVersion,
         expectedDraftVersion, target?, payload })
// -> { ok, currentVersion, receipt?, error? }
```

1. host 从自己的 pending request 取实际 payload，不信页面传来的 `ok:true`；compare `COMMIT_RESULT` 禁止作为普通页面 action。
2. canonical mutation、来源关联、revision、command ledger 必须属于同一提交边界。异步持久化失败不发成功 ACK。
3. 同 commandId / 同规范化 payload 幂等；同 ID 不同 payload 拒绝。compare 原 helper 已有全 payload 指纹账本，本候选直接用它。
4. [applyPendingComparison](bridge.mjs) 只提交隔离内存 host；[deliverComparisonResult](bridge.mjs) 只影响比较页面、绝不再回写事项。延迟回执核验 canonical 当前版本和已存在账本，不把旧成功遮住后来编辑。
5. 工作结果在 `OPEN_REVISION_REVIEW` 捕获版本/正文，在 `CONFIRM_REVISION` 才写；同步 reducer 只证明内存的原子变化，**不证明跨数据库记录事务或断电一致性**。

## 5. 既有 packages/product 与 core public API：已查、未误用

当前不存在 `packages/product/core`，实际为并列 `packages/product` 与 `packages/core`。

- [product/application public service](../../../trace-runtime/packages/product/application/src/index.ts)：现有 `inspectProject/inspectSource/listInbox/listAbilities/inspectUpgrade`，以及 project/profile/hooks 的 `propose* → apply*`。没有这些页面对象的 matter/understanding/work CRUD。它已经采用状态指纹、显式确认、回执模式，可扩小的产品动作；**不要复制旧 runtime 建第二套 service**。
- [product/application README](../../../trace-runtime/packages/product/application/README.md) 明确 UI/宿主不直接访问 core storage；新产品动作先定义提案、影响、回滚和 receipt。
- [core/storage VersionedStore](../../../trace-runtime/packages/core/storage/src/jsonl.ts)：公开 `read(recordId, revision?)`、`appendIfAbsent`、`compareAndSwap`，有单记录 CAS 基础。不能据此宣称多对象事务已具备。
- [core/data DataEnvelope](../../../trace-runtime/packages/core/data/src/contracts.ts)：已有 source_snapshot / normalized_result / candidate_precedent 等 kind、lineage/ref 与 schemaVersion，**当前没有独立 matter / understanding / work kind**。不能随便把整个 prototype JSON 塞进 artifact/runtime_event 冒充完成对象持久化。
- [core/continuity](../../../trace-runtime/packages/core/continuity/src/index.ts)：`ContinuityLedger.createThread/updateThread/appendTurn/createReceipt`，updateThread 走 expected_revision。thread/current_summary、候选/采用引用与页面 matter 的空理解/草稿/局部修订不是同一语义，不能把一次“个人理解保存”标成认知来源 adopted。

### 持久化 schema 候选（仅建议，root 决定）

保留一个 canonical matter（stable ID、origin、原表达/来源引用、current understanding+单调 version、停点）与 append-only revision/receipt；sources、work intake snapshots 和 results 有自己的 ID + matter/work/version refs；草稿按 matter/work/candidate/context epoch 分区，不能在保存 aggregate 时误升级为当前事实。demo 与用户 scope 物理或明确逻辑隔离，正常查询不加载 demo。

还需另有**aggregate revision**表示关联/元数据/草稿持久化变化；`understandingVersion` 仅在理解变化时增加，不能用它保护所有持久字段。链接不改理解版本但仍需要宿主事务并发检查。本候选同步函数未实现多窗口 storage CAS。

不指定新的 SQLite 表、JSON 文件路径或 public protocol kind；这些须由 root 根据现有 runtime 的迁移和产品边界确认。若先用浏览器本地持久化，也必须有明确版本/分区/迁移与恢复失败行为，不能只 `JSON.stringify(createBridge())` 当交付。

## 6. 验证与剩余限制

工作目录：`D:/AGeneral Workspace/AI-powered/harness`。

```powershell
node --check artifacts/trace-web-v1-integration-20260915/state/bridge.mjs
node --test artifacts/trace-web-v1-integration-20260915/state/bridge.test.mjs
```

首次 24/24，通过后只扩充四个相邻测试；最终 28/28。日志 [test-first.tap](test-first.tap)、[test-final.tap](test-final.tap)。未掩盖失败重试，本批没有失败的测试运行。

已验证：同 ID 新捕获/明确保存/对照 link 不采用/确认局部修订/回执后返回新 anchor；带入快照与当前理解差别；keep-result-only；work confirm/undo；原 source 保留；空输入/空保存/缺来源/取消/错归属/陈旧保存版本/ABA 草稿/重复请求和 ACK/延迟成功/伪造成功均不误改；双 compare、双 work 的草稿隔离；fresh selector 真改变上下文。

尚未验证或未实现：原表达/讨论直接找对照（关键功能缺口）；真实 home/matters/app 路由；DOM focus/IME/滚动和浏览器 Back；持久化/刷新恢复/多窗口事务；真实搜索/模型/外部 Agent 发送/账户；完整 rich-text；跨面统一解除关联命令；候选/草稿保留的产品期限；将原图 11 态所有动作投影到工作现场的 UI 映射。**不得把 28 项纯状态测试说成这些业务能力已通。**

接入顺序建议：root 确认当前 canonical 对象与产品服务 → 实施原表达 basis 扩展 → 接真实来源/route/保存 ACK → 对照/工作提交读写同一对象 → 干净隔离数据跑 [experience 验收](../experience/acceptance.md) → 才评估桌面封装。候选回滚仅撤掉接入层；原模块与数据未被本 worker 修改。

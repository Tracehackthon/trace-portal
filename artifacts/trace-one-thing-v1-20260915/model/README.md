# 一件事连续页面 v1 · 纯状态模块

## 身份与边界

- 任务：`trace-one-thing-v1-20260915`。
- 基线 HEAD：`2f4377864aa353dcecb3f60005d884b11486c84e`，已实际 `git rev-parse HEAD` 核验。
- 上下文包 SHA256：`5419BAC2804EB001F853B968060478429AA5AFCE08F1ACECEFA14F64E4B3E562`。
- 契约 SHA256：`85DE599401E165D985E476A39849BD07CA04DCBC8E4D249AC2DC7071BF708E2C`。
- 补充 01 SHA256：`38432B1AC331AD069C9056FF4347B9C7C806BFCCD6A8EBD9A626C9156B01F226`。
- 本 worker 仅写 `artifacts/trace-one-thing-v1-20260915/model/`；没有写 app、plugin、参考图或另一任务目录。
- 已读取核心功能与内容对象、看图说明，并亲看 11 张图。静态示例不是用户已有历史、真实使用反馈或外部接入。

## 文件

| 文件 | 用途 |
| --- | --- |
| `chain-model.mjs` | 无依赖 ESM，纯 reducer 与唯一 selector |
| `chain-model.test.mjs` | Node 内置测试，39 项闭环/相邻反例 |
| `sample-view.json` | 由真正 selector 生成的 11 态示例；screen 为顶层 key |
| `emit-sample.mjs` | 重建 sample-view，不改任何用户会话 |
| `test-first.log` | 首次实跑 36 项：32 通过、4 失败 |
| `test-rerun.log` | 修复与扩展后的 39 项通过日志 |

## 接入 API

```js
import { createChainState, createChainDemo, reduceChain, selectChainView } from './chain-model.mjs';

let state = createChainState(); // reading，空事项，不编造历史
const dispatch = (action) => {
  state = reduceChain(state, action);
  mountedScreen.update(selectChainView(state));
};

// 仅显式原型预览用，不可用于 NAVIGATE 或覆盖活跃用户 state：
const demo = selectChainView(createChainDemo('revised'));
```

`createChainState({fixture:'saved'})` 明确创建已有停点的示例，`isDemo:true`。默认无参数是真空会话。`selectedId` 只接受当前状态中已存在 ID。UI 只能读 selector，不能读或写 `sessions`、内部 ID 计数等存储。

selector 保持基础契约字段。没有选中事项时仍返回完整空 `matter` 形状，`matter.id` 和 `selectedId` 为 `null`。空标题保持空值，UI 可用“刚留的一点”作为显示占位，不能写回成自动标题。

### 兼容增加的字段

- `capture.excerpt/excerptSourceId`：来源原选段；`capture.text` 是个人输入，不混为一份“个人表达”。
- `availableSources`：显式示例候选与当前事项的材料，未关联不是已采用；不会把其他事项观察混到本事项候选。
- `discussion.text`：可选区正文的唯一精确文本；偏移是 JS/DOM UTF-16 代码单元。fresh 模式时仅本次 fresh 的新消息，cases/possibility 不再呈现旧情形；FOCUS 使用完全相同的文本核验。恢复上下文后才显示原讨论。
- `context`：真正准备供当前帮助使用的上下文。fresh 时清空历史 whyCare/理解/停点/来源，并按本次 fresh epoch 仅返回新消息。`matter` 仍可按需追溯原记录，不能绕过 context 当作 fresh 推理输入。
- `matter.understandingDraftVersion`：每次草稿变化递增；保存版本与草稿版本分开。
- `matter.stopDraft`：用户直接写的停点，不由模型总结。
- `handoffSnapshot/handoffHistory`：已确认本次带入快照和历史；后续编辑不静默改变快照。
- `handoffSnapshot.actualDelivery:false`：本模块没有真的向 Codex/原生 Agent 发送；live 原型确认仍是 `evidenceLevel:'none'`。只有显式示例预览使用 `artifact-demo`。
- `unassignedMaterials`：用户选择“不是这件事”或“先只留”的当前事项来处材料。
- `workFindings`：保留 matter/handoff/destination 来源的新发现，不是自动形成的结果。

## 关键动作语义

| 动作 | 真实变化与保护 |
| --- | --- |
| `CAPTURE_EXCERPT` | sourceId 必须属于可用来源；只修改捕获草稿，选区不会覆盖个人输入 |
| `TOGGLE_SOURCE` | 移除选区来源时同步移除选段，不暗中带入；个人输入保留 |
| `CAPTURE` | 来源或文字任一可留；原选段存 originalText，个人表达存 whyCare；不产生标题、理解、历史停点或模型答复 |
| `SEND` | 精确保留用户文本和有效 focus；不伪造 Agent 回复 |
| `FOCUS` / `BRANCH` | 严格核验完整文本的确切选区，保留旁支原处；半个 surrogate pair 被拒绝 |
| `FOCUS_TO_UNDERSTANDING` | 只把选段附到草稿，不自动保存或采用 |
| `FRESH_CONTEXT` | 创建新的隔离 epoch；再一次 fresh 不混入上一轮 fresh 的消息 |
| `LINK_COMPARISON` | 挑战/补充/限制/旁支落到具体 target，不采用材料结论 |
| `REJECT_COMPARISON` | 去除对应关系与无其他有效用途的上下文来源；原始材料留在候选库 |
| `UNDERSTANDING_DRAFT` / `SAVE_UNDERSTANDING` | 书写与显式保存分开；保存是个人当前理解，不是工作要求 |
| `SUGGEST` / `ACCEPT_SUGGESTION` | 显式示例建议，仅替换精确范围；核验保存版本、草稿版本和原文字串；ABA 编辑也过期 |
| `UNDO_SUGGESTION` | 只恢复接受的局部；后续编辑或保存使旧撤销失效，不覆盖新内容 |
| `COLLAPSE` / `UNDO_COLLAPSE` | 只改工作面，保留草稿；撤销收起绝不回滚更晚编辑 |
| `INCOMING_DECISION` | 关联、无关、只留均保留原材料；无关与只留不改当前理解 |
| `HANDOFF_DRAFT` / `CONFIRM_HANDOFF` | 核验 destination、内容、role；只支持 current-task；旧选文不被标成新理解版本 |
| `EXCLUDE_HANDOFF` | 移除本次活动快照，历史标记排除，保留个人理解及事实 |
| `KEEP_RESULT_ONLY` | 必须有用户事实；只留结果，不改理解、草稿或停点；重复点击不重复保存 |
| `COMMIT_REVISION` | 有事实、有 proposedUnderstanding、原版本仍适用；落回同一 ID 并更新停点；相同文字只留结果，不制造变化 |
| `UNDO_REVISION` | 版本保护，一次性恢复此前理解/草稿/停点；保留结果事实和撤销过的修订来路 |
| `TRY_AGAIN` | 有输入事实先保留；清下一次结果草稿，重新选择最新理解，只带当前任务 |

`NAVIGATE` 不生成修订/结果，也不确认带入。没有真实修订不能绕过确认进入 `revised`。`BACK` 从 comparison/handoff 返回真实来路。

## 最小重放

1. 默认空状态：`CAPTURE_DRAFT` → `CAPTURE {intent:'discuss'}`。
2. `UNDERSTANDING_DRAFT` → `SAVE_UNDERSTANDING` → `STOP_DRAFT`。
3. `COLLAPSE` → `REOPEN`，核验同一 ID、原输入、当前理解与停点。
4. `HANDOFF_DRAFT` 核对 destination/role/current-task → `CONFIRM_HANDOFF`，读取不可变 `handoffSnapshot`。
5. `RESULT_DRAFT` 分别输入事实、解释、未确认、愿意留下的理解 → `COMMIT_REVISION`。
6. `COLLAPSE` → `REOPEN` → `TRY_AGAIN`，后续带入读取新版本；旧快照和结果事实不被改写。

## 实际验证与失败记录

工作目录：`D:/AGeneral Workspace/AI-powered/harness`。

```powershell
node --check artifacts/trace-one-thing-v1-20260915/model/chain-model.mjs
node --test artifacts/trace-one-thing-v1-20260915/model/chain-model.test.mjs
node artifacts/trace-one-thing-v1-20260915/model/emit-sample.mjs
```

首轮 36 项测试 32 过、4 失败，保留原日志。实际修复：

1. 第二次 fresh 仍返回上一次 fresh 消息 → 增加 context epoch。
2. 拒绝曾接入对照后仍携带来源 → 去除无其他有效关系的上下文关联，不删原始 source。
3. 手工 offset 可切断 emoji surrogate pair → 核验代码点边界。
4. 较旧的明确选文被重标为新理解版本 → 在选择时保存理解版本及 basis。

修复后并扩展“再试保留事实”“过期 proposal 不覆盖新理解”“候选材料跨事项隔离”三项，39/39 通过。最后补同一跨事项用例中的残留事件拒绝断言后再次全量通过。

### 未验证 / 不声称

- 这是已独立执行测试的状态模块，**尚未由本 worker 接入 app 或浏览器 UI**，不声称完整原型完成。
- 未验证真实 Overlay、Codex 消息发送、持久化、多端同步、真实模型生成或真实使用成效。
- 精确纯文本选择与局部替换已测，不声称完整 rich-text 编辑/组合字符字素级编辑器。
- 所有状态仅内存；刷新重置。示例正文和产物状态只能在明确的 demo 中使用。
- 首次有一次文档读取 cwd 指向 `trace-runtime`，路径未找到；已回到 harness 正确路径完整重读。不把读取失败当成已读取。

# 工作现场五态：独立状态模块

面向后续 app 整合 writer。模块只提供纯内存状态、动作与只读 view，未接入 app、插件、真实 Overlay、存储或 Agent。

## 身份与边界

- 任务：`trace-worksite-v1-20260915`
- 仓库 HEAD 已核验：`2f4377864aa353dcecb3f60005d884b11486c84e`
- context-package SHA256：`DD9BDA87EDB138B15C3A3E9535BD78BF5E51934DA333A4175C251BF8F7078C06`
- 已读工作现场五图及 README、核心功能的“带去用/结果回来”、本任务 CONTRACT 和 AMENDMENT-01，以及 chain 基础契约和阅读选区补充。
- writer 只修改本任务 `model/`；未修改 app、插件、参考图、锁文件、其他任务或地图，未启动服务器。

## 调用

```js
import {
  createWorksiteState, createWorksiteDemo,
  reduceWorksite, selectWorksiteView,
} from './worksite-model.mjs';

let state = createWorksiteState(); // 默认空白，无伪造用户事实
let preview = createWorksiteDemo('results'); // 显式独立示例，不与上面的会话混合
const view = selectWorksiteView(preview);
state = reduceWorksite(state, { type: 'COMPOSER_DRAFT', text: '这次发现……' });
```

固定导出 `SCREENS` 为 overview/intake/impact/finding/results。`createWorksiteState({fixture:'saved'})` 是明示示例；可用 `{matters,works,selectedWorkId}` 注入 ID 和初始快照，但这仍是隔离状态，不代表共享领域持久化已经完成。注入项重复 ID 会抛 `TypeError`，未知动作与无效 enum 不改变状态，已知动作的无效目标会返回可见 notice。

UI 只绑定 `selectWorksiteView`，不要读取内部 `sessions`。selector 深拷贝输出，UI 修改 view 不会修改 store。活跃 textarea 应由 UI 保持，不能因每次 reducer 返回新引用而重建输入元素。

## view 补充字段

基础字段、动作名保持 CONTRACT 一致。

- `context`: 真正排除 exclude 的带入数组，每条有不同 role 的 instruction。不能仅从样式判断带入。
- `contextSummary`: `{reference,trial,contrast,exclude,included,findings}`，从当前工作数据计算。
- `contextFindings`: 只有明确 `USE_FINDING_IN_WORK` 的已保存发现；仅当前工作，没有发送外部任务。
- `finding.id`: 本次会话保存后分配；反复“先留一下/用于当前工作”不会复制同一记录。
- `impact.confirmed/unconfirmed`: `string[]`。`evidence`: `{id,stage,text,source,isDemo}[]`。
- `receipt`: 仅确认修订后出现，含 `{id,workId,matterId,resultId,before,after,baseVersion,version,undone,isDemo}`。撤销追加 undoVersion；初始/示例进入页面都不会伪造回执。

## 已实现的语义

- 每项工作隔离 screen、返回路径、带入角色/附言、composer、发现、结果、review、receipt 和 retry；understanding 按明确 matter ID 共享在本模块唯一 matters 字典中。
- role/note 是本次调整，不改原理解和 source snapshot。过去决定/产物/影响依据不会因为这次 exclude 而被删掉。
- provided/decision/artifact/usage 独立核对同 stage evidence；单个 true 或一段无依据 confirmed 文案不能建立确认。示例始终保留 isDemo。
- 发现允许 pending 或 unrelated；保存保留原话和现场。把发现用于工作会进入 contextFindings，但不会变成理解/长期规则，不会向 Agent 发送。
- 结果的事实、解释、未知、提议、分类分开。只保存结果不会修订；仅看差异也不会写入。已保存内容再编辑会创建新的待提交记录，原始事实不被覆盖。
- 修改 review.after 只改确认草稿；确认时核对 matter ID、当前 version、before、review 期间结果是否变化。有效确认只写目标 matter，并产生一次可撤销会话回执；双击不重复写入。
- 撤销恢复 before **内容**，version 继续 +1，避免 ABA；更晚变化让旧 review/undo 失效，原结果事实和修订历史均保留。
- 再试只留下计划，不采用建议、不自动创建工作或发送任务。

## 文件与验证

- `worksite-model.mjs`：纯状态和 selector。
- `worksite-fixture.mjs`：假设案例与两项示例工作，和逻辑分离。
- `sample-view.json`：overview 单 view；`sample-views.json`：五态 view keyed by screen。
- `worksite-model.test.mjs`：33 项 Node 测试，包含 16 种程度组合以及跨工作过期 review/undo。
- `check-model.mjs`：语法检查、单测、再生成 sample、写入 `checks.json`。
- `chain-mapping.md`：稳定 ID、sourceVersion、结果和修订的接入边界。

从当前目录执行：

```powershell
node .\check-model.mjs
```

首次 33 项测试全部通过；之后代码审阅补上“无依据 confirmed 文案不能成立”的防护并扩展同一测试后复跑，详见 `checks.json`。期间第一次 `git rev-parse HEAD` 在外层 harness 运行失败；随后在实际 trace-runtime 仓库运行成功，未因此改动文件或推定仓库状态。

未运行：UI 浏览器、Electron file://、真实 Overlay、共享 chain store、跨模块回归、性能及持久化。独立模块测试通过不等于五态 UI 已接入或全链路验收。

## 整合前必须处理

1. 阅读 `chain-mapping.md`，明确唯一长期 store 和 CAS 提交边界，禁止复制第二套长期理解。
2. 将真实工作/事项/快照的 ID 注入，而非用独立 demo ID 覆盖另一任务数据。
3. 默认空状态使用 `createWorksiteState()`；展示参考图的假设内容用独立 demo 并保留明显示例标识。
4. “保存”提示限定本次会话，真实返回 Agent/产物仅在宿主回调可用时提供。

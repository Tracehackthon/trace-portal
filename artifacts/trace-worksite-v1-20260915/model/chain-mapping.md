# 工作现场与一件事链路：接入边界

- 任务：`trace-worksite-v1-20260915`；本文件面向后续唯一整合 writer。
- 状态：独立模块的映射说明，**尚未与 chain 共用或同步状态**。
- 依据：已读取 `trace-one-thing-v1-20260915/coordination/CONTRACT.md`、`AMENDMENT-01.md`；没有 import、复制或修改生产中的 chain 源码。

## 不变身份

工作现场的 `demo-worksite-recall` 和 `demo-worksite-light-capture` 是独立示例 ID，不能靠同标题、近似原文或改成同名 ID 宣称已经是 chain 的同一对象。正式入口必须由统一领域 store 提供真实 `matterId`、`workId` 与已确认带入的快照 ID。

`createWorksiteState({matters, works, selectedWorkId})` 保留注入的 ID，不做标题匹配。它目前仍创建隔离内存数据；**仅注入一份快照不等于完成共享写入**。整合时应使用一个 store 承担长期理解，或为每次查看/提交设置明确的读取与提交适配器，不能让 chain 和 worksite 各自长期写一份理解再互相覆盖。

## 字段映射

| 工作现场 | chain 契约 | 映射/限制 |
| --- | --- | --- |
| `matters[].id` | `matter.id` / `selectedId` | 必须是上游给出的稳定 ID，禁止标题猜测 |
| `matters[].understanding` / `.version` | `matter.understanding` / `.understandingVersion` | 读同一权威值；草稿不是已确认理解 |
| `matters[].stop` | `matter.stop` | 恢复真实停点；工作现场本次修订不会自动重写停点 |
| `work.{agent,project,title}` | `handoff.destination.{agent,project,task}` | 只映射已明确的工作身份；字符串显示不是宿主连接证明 |
| `intake[].{id,matterId,sourceText,sourceVersion}` | `handoffSnapshot` 与被带入 matter | `sourceText` 固定为当时确认的 selectedText；`sourceVersion` 固定为当时理解版本，不随后来编辑漂移 |
| `intake[].role/note` | `handoff.role/note` | reference/trial/exclude 可直接映射；**contrast 在 chain 基础契约中未定义**，不可静默降级为 reference，须兼容扩展后才向该模型提交 |
| `work.scope` | `handoff.scope` | 固定 `current-task`，不扩大为个人/团队规则 |
| `finding.text/source` | `WORK_FINDING` / `workFindings` | 保留原话、出处和 work ID；纯工作发现不是已有理解，也不是阅读原文选区 |
| `finding.relation` | `incoming.decision` 等关系动作 | 只在明确对象与用户选择后适配；拒绝关联时保留原始材料，不能传成已 linked |
| `result.{fact,interpretation,unconfirmed,proposedUnderstanding}` | 同名 `result` 字段 | 四项分开；支持/限制/挑战/未知是本模块额外分类，不能当作 chain 已有字段或已验证结论 |
| `review.before/after/baseVersion/matterId` | chain 修订目标与版本 | review 是工作现场确认前提，不可把进入结果页映射成 `COMMIT_REVISION` |
| `receipt.{resultId,matterId,baseVersion,version}` | 统一 result/revision 记录 | 在权威提交成功后生成共享回执；本模块 `revision:N` 只在本次会话唯一，不是跨 store 幂等键 |

## 提交路径

1. 确认当前工作、结果目标 matter 与已读版本，显示事实、解释、未知和建议。打开 review 只捕获差异，不写长期理解。
2. 只有显式确认才向权威 store 提交 `{matterId, expectedVersion, before, after, resultFact, idempotencyKey}`。在同一事务中保存结果事实、compare-and-swap 理解、记录修订和回执。
3. 版本或 before 不一致时拒绝并重新读差异。不能先修改 worksite、再无条件发送 chain 的 `COMMIT_REVISION`；双 store 分别成功不能证明一个事务完成。
4. “只留下结果”只导入事实/解释/未知/提议及关系，不调用修订动作。后续真正修订时复用已保存结果 ID，不能复制同一事实。
5. 撤销先检查权威当前 version 和 after 均仍匹配该回执；恢复 before 内容，但 version 单调递增。保留 result、原修订和撤销记录。任何后来的变化都会使旧撤销不可用。
6. 再试计划只记录观察点、当前理解版本与本次任务范围，不自动向 Codex 发消息，也不提前采用 proposedUnderstanding。

## 影响依据不能缩成一个枚举

工作现场 `impact.stages` 的 provided、decision、artifact、usage 独立存在，每一项须有同 stage 的 evidence。chain 的 `handoff.evidenceLevel` 为较窄的 `none | provided | artifact-demo`，不能完整表达四项事实。映射时保留 evidence 明细，不能从 artifact-demo 推导真实产物，更不能推导 usage。

示例 evidence 的 `isDemo:true` 和示例 artifact 标记必须穿过适配器；work.connected 只能由真实连接层核验，不能从示例标题 `Codex · harness` 得到。

## 当前未完成

- 未接入 app 路由、真实宿主、持久化、共享 store 或跨模块事务。
- chain 当前只读契约没有公共 CAS 接口、全局 result ID 或 contrast 角色；上述接入步骤是必须补齐的边界，不是已实现能力。
- 本模块的单测证明独立 reducer 行为，不能证明两个模块在真实壳内已经操作同一件事。

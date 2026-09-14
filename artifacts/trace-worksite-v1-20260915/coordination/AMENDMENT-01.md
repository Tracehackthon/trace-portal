# 契约补充 01：带入上下文与撤销版本

任务 `trace-worksite-v1-20260915`；2026-09-15 root 批准，基础 CONTRACT 与 context-package 不改 hash。

- selector 兼容增加 `context:[{id,matterId,text,sourceVersion,role,instruction,note}]` 和 `contextSummary`。reference/trial/contrast 显示不同参与方式；exclude 不进入 context。UI 的当前带入角色/摘要应来自这些实际字段，不只改变选中样式。
- 撤销修订恢复 before 内容，但 matter.version 仍单调 +1；避免旧 review 在恢复同一旧版本号后误判有效。撤销不得删除原结果事实。
- 独立示例使用 `demo-worksite-recall` / `demo-worksite-light-capture` ID 可接受，不与 chain fixture 名字相同就假称同一对象。正式接入由 root 注入领域 ID / 快照及明确提交，mapping 必须记录转换和版本检查，不静默拷贝两份长期状态。

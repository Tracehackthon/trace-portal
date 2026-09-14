# 契约补充 01：阅读选区不等于个人表达

任务 `trace-one-thing-v1-20260915`；root 于 2026-09-15 批准，基础包与 CONTRACT.md 保持原 hash，不原地改写已分发基线。本补充为兼容增加，不删除/改名旧字段。

## 新动作和字段
- 增加 `CAPTURE_EXCERPT {text,sourceId}` 和 `capture.excerpt`（string）。选中示例文章的文本与个人 `capture.text` 分开；不将原文选区写成用户自己的表达。
- `sourceId` 必须存在于可用示例来源，不识别时 no-op/提示，不能伪造已读取外部页面。
- 捕获后 `originalText` 保留来源选区原话，用户 capture.text 保留在对应个人表达中；移除来源时应一并解除该选区的来源选择，不能暗中仍带入被取消的来源。直接用户输入不受影响。
- 已有 `CAPTURE_DRAFT` / `TOGGLE_SOURCE` 保持兼容；全空不提交。选择动作本身不是保存或形成历史。
- 允许只读 selector 增加：`availableSources`、`isDemo`、`unassignedMaterials`、`handoffSnapshot`、`workFindings`、`discussion.text`、`matter.stopDraft`、`matter.understandingDraftVersion`。UI 仅依赖明确字段，不读 reducer 内部存储。

## 验证
原文选区与个人输入不同仍分别保留；取消来源不带入；无效来源拒绝；再次选择只更新 capture，不改已有 matter 历史；空输入但有效原文片段可留。模型 worker 负责测试，UI worker 用该动作交付图 01 的真实选段。

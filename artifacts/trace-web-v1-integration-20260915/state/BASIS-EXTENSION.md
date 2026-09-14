# 原表达 / 讨论直接找对照：最小必要接口扩展

状态：**接口建议，不是已执行 patch，也不把它计为验收通过。** root 已确认不应强迫用户先形成理解。这份说明给 app/model 唯一 writer 明确需要改哪条契约。

## 问题证据

现有 [comparison-model.mjs](../../trace-compare-v1-20260915/model/comparison-model.mjs) 的 `validMatter`、`createComparisonState`、`requestFor`、`applyComparisonRequest` 共同把比较依据限定为 understanding；`target.field` 固定 understanding。UI `revisionModal` 写“只替换选中片段”，也假定依据与写入对象相同。新捕获的 `whyCare/originalText` 非空，但 understanding/version 是空串/0，这是正确状态。

只在 host 把 `understanding = originalText` 会同时造成：

1. 将尚未形成判断的原表达伪装成个人理解；
2. 错把原表达 offset/version 当成理解 offset/version；
3. 关联与修订的 receipt 说改了理解，实际可能改错对象；
4. 返回页错称已有理解已更新。

因此不能以“给 compare 喂一个假 matter”兼容。

## 兼容增加，不重做四态 UI

原 matter 保留 `understanding/version` 的当前态，增加独立只读比较依据：

```js
matter = {
  id, title,
  understanding: '', version: 0, // 始终真实；允许空
  basis: {
    field: 'originalText' | 'discussion' | 'understanding' | 'source',
    objectId, // originalExpressionId、discussion message ID、understanding ID 或 source ID
    text, contentVersion,
    focus: { start, end, text },
  },
  links: [], revisions: [],
}
```

兼容旧调用：未提供 basis 时，从真正的已保存 understanding/focus/version 建 basis；不能反向把 basis 复制回 understanding。查找、比较建议与左侧引用显示 `basis.focus.text`，页内标签随 basis.field 为“原表达/讨论片段/我的理解/来源摘录”，不将所有依据称作已有理解。

### 请求拆开“依据锚点”与“写入目标”

```js
linkRequest = {
  id, kind: 'link', matterId,
  basis: { field, objectId, contentVersion, start, end, text },
  expectedMatterRevision, source, relationship, note,
}

reviseRequest = {
  id, kind: 'revise-understanding', matterId,
  basis, // 比较来处，不是隐含写入目标
  expectedUnderstandingVersion, expectedDraftVersion,
  target: { field: 'understanding', start, end, text },
  before, after, source, relationship,
}

createRequest = {
  id, kind: 'create-understanding', matterId,
  basis, expectedUnderstandingVersion: 0, expectedDraftVersion,
  before: '', after, source, relationship,
}
```

- `LINK` 对任何有效 basis 均可提交，只增加关联；理解保持 `''/0` 也合法。
- 已有理解 basis：保持当前“局部 before/after → 确认修订”操作。
- 原表达/讨论 basis 且理解为空：允许“写进我的理解”打开空草稿编辑，用户输入并查看**新建理解**确认面。确认后独立 `create-understanding`，不得预填原文并默认为已采用。
- 原表达/讨论 basis 且理解已有内容：用户明确选择理解内的写入选区，或进入理解编辑；如果没选目标，不可用 basis offset 静默局部替换。
- 草稿未提交时依然可查找/关联原表达；只有真正改理解的请求需要处理理解草稿冲突，不用草稿状态封死查找入口。

## 实际需要调整的最少边界

| 原函数 / 模块 | 必须改变的判断 | 不改变的原则 |
|---|---|---|
| `validMatter` / 初始化 | 允许 understanding 为空，独立校验 basis 的原文和精确选区 | 不改 matter ID，不从默认 demo 推内容 |
| `normalizedCandidate` / `query.question` | 使用 basis.focus.text 做比较来处 | 不伪造外网搜索结果 |
| `requestFor` | link 捕获 basis.contentVersion；revise 捕获真实理解目标和 saved/draft 版本 | 用户提交后等待宿主成功 |
| `OPEN_REVISION` / selector | 增加 create / local-revise 语义；canConfirm 按真实写入模式计算 | 取消保留原来状态，草稿不代表提交 |
| `applyComparisonRequest` | link 校验 basis 归属/版本；create 确认当前理解仍空；revise 校验理解目标；三者独立 | 不全篇 replace，不丢来源，幂等账本 |
| `validReceipt` | link 不要求理解选区非空；create 回执 kind 单列；basis 与 mutation target 分开检查 | ACK 必须对应真实提交，过期 ACK 不冒充最新 |
| comparison UI | 左栏 basis 标签；新建理解确认文案；返回页“已留下新的理解” vs “已修订这一处” | 复用现有 DOM/CSS/素材，不能新造一套页面 |
| host return | 默认回原 basis anchor；receipt 可显示旁边的理解变化标识 | 不将原表达 route 偷改为理解 route；“查看理解”作为明确次级动作 |

## 必须补的验收（当前未运行）

1. 新输入理解 `''/0` → 在原表达选区打开 compare → 粘贴材料 → LINK → 返回同原表达；理解仍 `''/0`，材料有精确原表达锚点。
2. 同上 → 用户明确写新理解并确认 → canonical 理解 `text/1`；原表达与来源原文未变，receipt.kind 明确 create。
3. 查找途中原表达内容版本变化 → link 失败保留比较草稿；只改变理解版本而原表达没变时，不误把两种版本冲突混为一谈（仍核验 aggregate concurrent write）。
4. 原表达 basis + 已有理解 → 无理解目标时不允许局部提交；选中真实理解范围后修订正确对象。
5. 创建请求晚到，用户已在别处形成理解 v1 → create 拒绝，不能全篇覆盖；撤销只撤自己创建/修订的版本，保留原材料。
6. 回原讨论消息须按 message ID + contentVersion 定位，不用包含多条消息的拼接正文 offset 作为长期锚点。

本候选的 `unsupported_basis` 是临时缺能力响应，**不是最终产品设计**。root 只有实施以上必要边界并通过新输入验收后，才可宣称功能 A 已接通。

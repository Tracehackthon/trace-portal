# 在意的事：模型接入说明

给主 Agent 与场景实现者使用；本目录只交付可整合模块，不表示已完成应用接入或像素验收。

- 任务：`trace-matters-v1-20260915`
- 基线 HEAD：`2f4377864aa353dcecb3f60005d884b11486c84e`
- context-package SHA256：`BDF5906EC3208A9C254499C5082E5E689971A7547BCC9A1A303BA5F28FA45068`
- 接口权威：`../coordination/CONTRACT.md`；本说明解释实现，不修改契约。

## 接入方式

```js
import { createMattersState, reduceMatters, selectMattersView } from './matters-model.mjs'
let state = createMattersState()
const onAction = action => {
  state = reduceMatters(state, action)
  screen.update(selectMattersView(state))
}
```

模块无 DOM、网络、时间、随机数、存储或第三方依赖。`createMattersState()` 的会话彼此独立；`reduceMatters()` 不原地修改输入；无效动作返回同一个 state 引用。selector 返回与 state 脱离的视图副本；`view.selected` 严格引用 `view.matters` 内对应对象。

`view-fixtures.json` 提供 `overview`、`reentry`、`deep`、`search`、`fresh`、`changed` 六个可复制 view，供场景开发和检查，不是另一份运行时事实源。

## 状态与内容边界

- 六个固定 ID：`collection/work/fresh/handoff/ideas/team`。标题和初始总览停点从图 01/07 转录；collection 的主要内容来自图 04/05/06。
- 其他对象图中未提供的深层段落，是根据对应主题补充的**本地示例内容**；`example: true` 明确标识。所有来源 `url: null`，不制造可点击的真实知乎链接。
- 初始 `changed: false`，collection 的 `hasComparison: true` 可显示“刚有新的对照”。打开、返回、TAB、搜索、输入草稿、FRESH 都不设 changed，不生成停点或分支。
- `RELATE` 只改变关系及 changed。`challenge` 不采用结论；`irrelevant` 保留 comparison、原来源与引文，但从 `view.context.comparison` 和本次 `sourceIds` 排除这个对照来源。重新选择 challenge 可修复关系。
- `SAVE_JUDGMENT` 只接受明确的非空字符串，trim 外侧空白后精确保留文本，同时更新同一对象的 `lastStop/currentJudgment`，新增一条用户引文并返回总览。再次保存相同判断仍折回，但不重复新增引文或变化；branch 使用用户提交原文作为标题，不自动总结或生成新议题。
- 新增 `understanding` 字符串：保存用户显式提交的当前“我的理解”。`originalUnderstanding` 保留原始示例理解，不覆盖；理解 tab 使用 `understanding || originalUnderstanding`。保存理解不暗改原停点。
- 草稿按 matter ID 隔离。fresh 另有 `freshDraft/freshUnderstandingDraft`，不会覆盖此前 resume 草稿。用户引文 `example: false`，其关联父对象仍是示例对象。
- action 对象只有 OPEN 接受 `id`；其他动作附带 `id` 时安全 no-op，避免错误目标参数静默落到当前条目。

## FRESH 不只是遮住旧文字

`FRESH` 进入 `deep/care`，本次模式为 `fresh`。源 state 和原文不删；但在 deep/reentry 的 active selected 投影中：

1. `originalUnderstanding/currentJudgment/unresolved/lastStop` 为空字符串。
2. `understanding` 初始为空，只在本次 fresh 明确 SAVE_UNDERSTANDING 后出现新表达。
3. `draft/understandingDraft` 投影为该对象的 fresh 专属草稿。
4. `view.context` 是后续上下文消费者应使用的明确入口：旧理解、旧停点和旧未决为 null，不带旧 quotes；保留原现场 ID 与未拒绝的新对照。

场景不得为了填充空白又退回 state、旧 fixture 或其他缓存中的理解。`BACK` 从 deep 回 reentry 时仍为 fresh；`OVERVIEW`、搜索或重新 OPEN 结束这次 fresh，恢复真实保存的总览停点。切 TAB 不保存内容。

本模块不调用模型；将来新增模型/RPC 时应接 `view.context` 的明确选择，不直接序列化整份 state 作为“本次上下文”。

## 搜索规则与回到对象

查询做 Unicode NFKC、大小写归一、连续空白归一，再按空白分词，所有词 AND 匹配。不是语义检索，也不宣称相关性排序。

- matters：匹配标题、当前停点、场景提示、在意理由、原理解、显式当前理解/判断、未决与后续变化。
- quotes：匹配引文文字和其父对象标题。
- sources：匹配来源标题、类型、摘录和其父对象标题。
- 各分类从实际数组计算 counts，保持 fixture 顺序。例图查询 `收藏 为什么接不回来` 因父对象关联实际得到 1 件事 / 2 句话 / 3 个现场，不是固定常量。
- 搜索草稿不参加索引；明确保存后新增引文和当前停点即时参加索引。示例来源不会因保存用户判断而被伪造修改。
- quote/source 带 `matterId` 与补充的 `matterTitle`。点击后先 OPEN 其 matterId，再在本地材料面板展示该条源记录；未知 ID 不跳到其他条目。
- 空白查询回总览，搜索结果数组为空；无匹配的非空查询留在搜索态，分类计数全部为 0。

## 实测与复跑

在 workspace 根执行：

```powershell
& 'C:\Users\HoSheil\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test 'artifacts\trace-matters-v1-20260915\model\matters-model.test.mjs'
```

21 项 Node 测试通过；具体 TAP 见 `node-test.tap`。覆盖跨条目草稿/原文、关系拒绝与修复、挑战非采用、fresh 上下文排除、保存折回同一停点、真实分类计数和空结果、导航不造变化、未知输入、纯函数与 HTML-like 字面文本。还检查重复保存不造新修订，以及 fresh 模式中用户明确重写同一表达后才允许它进入上下文。

**未运行：**本 worker 不接入 app；尚未对新功能运行浏览器 DOM、实际 IME、Electron `file://`、视觉、动画或性能验收。数据保持字面字符串，不意味着下游可以用 `innerHTML` 拼接用户内容；场景必须使用 `textContent/value` 或安全转义。

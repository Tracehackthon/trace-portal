# 在意的事 v1：首批并行接入契约

任务 `trace-matters-v1-20260915`。七张新图为本功能唯一视觉方向；旧首页作为入口保留。主 Agent 整合应用，worker 仅写独占 artifact 目录，不改 app/plugin/锁文件，不迁移框架。

## 边界
- 原生 HTML/JS/CSS，离线文件页面可用，无 CDN、真实模型调用或长期状态写入。
- 入口规划 `?view=matters`；旧首页“全部”进入此功能，品牌返回首页。路由和入口由主 Agent 修改，本批 worker 不抢写。
- 示例内容可演示，必须可见标识。输入、关联决定、当前停点按 matter ID 隔离；只因打开页面/返回不能生成新变化。
- “接为挑战”表示用户决定材料关系，不等于采用结论。“这次无关”不删除源材料。“先不带回旧理解”真的改变本次呈现/上下文选择，而不只是盖住文字。
- 悬停为短暂 UI 状态；图 03 是可中断的进入动画，不是假的网络加载。减少动态时直达。搜索与总览必须指向同一对象、同一当前停点。

## 模型 worker 的交付 API
`model/matters-model.mjs`：
- `createMattersState()`：产生全新独立会话；mode 初始 overview。
- `reduceMatters(state, action)`：纯函数，不原地写 state。
- `selectMattersView(state)`：为 UI 提供下列稳定视图结构。
- 测试文件 `model/matters-model.test.mjs`，命令 `node --test <该文件>`。

视图字段（可增加，但已有字段不可擅自改名）：
```js
{
  mode: 'overview' | 'reentry' | 'deep' | 'search',
  selectedId: 'collection',
  query: '',
  deepTab: 'care' | 'understanding' | 'comparison' | 'stop',
  contextMode: 'resume' | 'fresh',
  matters: [
    { id, title, lastStop, contextHint, changed, relation,
      whyCare, originalUnderstanding, unresolved, laterChange,
      currentJudgment, draft, understandingDraft,
      comparison: { title, challenges, uncertain, sourceId },
      branch: null | { title, subtitle },
      quotes: [{ id, matterId, text }],
      sources: [{ id, matterId, title, kind, excerpt, url }] }
  ],
  selected: /* 同一 matters 条目 */,
  search: { matters: [], quotes: [], sources: [], counts: { matters: 0, quotes: 0, sources: 0 } },
  notice: ''
}
```
- 六件示例 IDs：`collection`（收藏后为什么接不回来）、`work`、`fresh`、`handoff`、`ideas`、`team`，文案以图 01/07 为准。
- source URL 未给真实链接时为 null，不制造可用知乎原文；UI 展示示例摘录。
- 返回总览后 selected/用户新停点仍保持在本次会话；刷新才清空。changed 只来自明确提交/关系决定。

动作约定：
```js
{type:'OPEN',id}                       // 选择并进入重新进入面
{type:'BACK'}                          // deep→reentry，其他→overview，保留输入
{type:'OVERVIEW'}
{type:'SEARCH',query}                  // 非空进入搜索；空串回总览
{type:'CONTINUE',tab:'comparison'}      // 进入指定深度 tab
{type:'TAB',tab}
{type:'FRESH'}                         // 不带回旧理解，进入深度继续
{type:'DRAFT',text}                    // 当前对象判断草稿
{type:'UNDERSTANDING_DRAFT',text}
{type:'RELATE',relation:'challenge'|'irrelevant'}
{type:'SAVE_JUDGMENT',text}             // 非空时修改真实停点并折回总览
{type:'SAVE_UNDERSTANDING',text}         // 显式保存会话内我的理解，不自动采用其他段落
{type:'CLEAR_NOTICE'}
```
未知 ID / action、空白提交安全 no-op。搜索按数据实际匹配并计算分类计数，匹配方法和片段回到对象方式写说明，不能把图中 1/2/3 写死。输入 HTML-like 文本不得造成 UI HTML 插入。

## 场景 worker 的交付 API
`scene/matters-screen.mjs`、`scene/matters.css`：
```js
mountMattersScreen({
  root, view, onAction, onHome,
  assets: { background, birdPerched, birdTakeoff, serifFont, sansFont },
  services: { animate, svg, mountSceneGlass }
}) -> { update(nextView), destroy() }
```
- root 为独占容器；由主 Agent 加载此 CSS，禁止全局 body/:root 样式污染旧页。样式类统一 `matters-` 前缀。
- 使用上方 view，用户动作回调 onAction；UI 不复制领域状态。搜索输入、动态文字安全 DOM 设置。
- 原现场/引文检查面板可由 UI 管理临时状态；关闭回到正确位置，不发真实外部请求。
- 主 Agent 提供已下载 Anime.js 和玻璃 adapter；没有可用 service 时降级到静态形状仍能操作。
- 图 03 的进场动画、图 02 的悬停提示、图 04 的三段融合异形面、图 05 的四节点深度继续、图 06 分类搜索、图 07 变化节点均需有对应代码，而非七张整页背景图切换。
- 原型默认参考 1672×941，实际以参考 PNG metadata 为准；大区块正文可滚动，操作不可被遮住，键盘可达、Esc、输入法组合 Enter、reduced motion。
- 新背景未交付时使用传入 URL，不擅自用旧图定义本功能构图。鸟优先复用修复的两张，不重新生成身份。

## 字体与生成素材
- 字体 worker 只从已有完整 OFL 原字体为本七图固定文案补子集，保留旧字体；不得全局安装。交付 `fonts/`、许可、覆盖说明及 copy-codepoints 清单。动态中文依旧系统 fallback。
- 图片 worker 优先交付一个从新图 01 提取/补绘的干净环境：树影、远山、雾、水面、岩石、光与球体保留；去除全部 UI、小鸟、人工连线。另对图 04/05 复杂玻璃评估：优先代码轮廓+现有材质；确有纹理缺口才补一件无文字、无 UI 的材质纹理，不把整卡内容栅格化。
- 生成用内置生图工具；原始与派生分开，保存实际 prompt、模型身份是否可见、尺寸、hash、目视判断。不能将棋盘格当透明；已有授权仅用于此前鸟图，新的图像修复若超出授权先报缺口，不偷偷脚本重绘。

## 交接标准
- 回显任务 ID、基线 HEAD 和 context-package SHA256。
- 给真实文件、实际执行检查和限制；未接到 app 不声称整页完成。
- 首批文件生成后主 Agent 审查接口与实际像素，再整合路由/素材/状态。旧首页/讨论的现有测试必须保留。

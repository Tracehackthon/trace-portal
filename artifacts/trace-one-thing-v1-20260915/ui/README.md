# Trace 一件事连续页面：独立 UI 模块

任务 `trace-one-thing-v1-20260915`。**本目录是可执行独立模块，不是 app 合并完成声明。** 未改默认首页、插件、真实宿主或其他任务。

## 基线和视觉依据

- 已核验 HEAD `2f4377864aa353dcecb3f60005d884b11486c84e`。
- 已核验 `coordination/context-package.json` SHA256 `5419BAC2804EB001F853B968060478429AA5AFCE08F1ACECEFA14F64E4B3E562`。
- 已核验 `coordination/AMENDMENT-01.md` SHA256 `38432B1AC331AD069C9056FF4347B9C7C806BFCCD6A8EBD9A626C9156B01F226`。
- 亲看 `Trace一件事连续页面_v1` 全部 11 张 PNG 与看图说明；没有使用“在意的事”七图替代。
- 02 / 03 / 05 / 07 / 11 共享标题、玻璃主面、输入及事件骨架；04 / 08 按上下文左右面；01 是示例阅读页实际文字选区；09 是明确示例工作承接面，无可发送的 Agent 聊天。

设计：松绿 `#005a47`、墨绿 `#0d332c`、湖灰 `#73899a`、水白 `#f7ffff`、少量琥珀 `#b87716`；标题使用官方字体衍生的 Trace Chain Serif，正文 Trace Chain Sans。主框架按 1672×941 定位，外部山水背景 cover，内部等比 fit，玻璃编辑层保持文字真实可编辑。标志性连续性是同一件事周围的细线节点和单只鸟，不添加固定侧栏。

## 接口

```js
import { mountChainScreen } from './chain-screen.mjs';

const ui = mountChainScreen({
  root, // 独占、已给定 width / height 的 DOM Element
  view: selectChainView(state),
  onAction(action) {
    state = reduceChain(state, action);
    ui.update(selectChainView(state));
  },
  onHome, // 可选，宿主决定路由
  onMatters, // 可选，缺省展示 view.matters 的会话内列表
  assets: {
    background, overviewBackground, birdPerched, birdTakeoff,
    serifFont, sansFont,
  },
  services: { animate, svg, mountSceneGlass },
});
// 宿主另行加载 chain.css；本模块不改 body、:root 或旧页 CSS。
ui.update(nextView);
ui.destroy();
```

`view` 只读，所有已提交领域变化经契约 action。UI 使用 selector 的 `availableSources`、`isDemo`、`discussion.text`、`context`、`handoffSnapshot`、`workFindings` 等兼容增字段，不读 reducer 内部。弹窗显示状态和未提交的局部建议 / 粘贴摘录 / 工作发现表单文本留在 UI；后两者按 selectedId 隔离，提交后立即交 reducer。

### 资源注入

- 背景：`../images/ready/chain-environment.png`（02 内页）和 `chain-overview-environment.png`（06 收起）。已用本任务新生成资源实测，不再以旧背景占位。
- 鸟：本任务 ready 目录的既有透明修复原样副本。当前 UI 使用 perched，takeoff 参数保留给统一动效；不声称自然振翅 / 真实飞行动画。
- 字体：`../fonts/derived/TraceChainSerif-fixed.woff2` / `TraceChainSans-fixed.woff2`，固定文案覆盖。动态中文仍会用系统 fallback。
- services：既有 Anime.js 的短暂工作面进入动效；既有 `mountSceneGlass` 仅用于 06 异形气泡。大编辑面用轻量 CSS 玻璃，不逐帧重建昂贵滤镜。
- 不复制 Codrops 或引入 React。应用集成需保留已有 vendor 许可及字体 OFL。

## 已实现交互

- 原文选段 `CAPTURE_EXCERPT` 与用户表达 `CAPTURE_DRAFT` 分开；取消对应来源也取消选段携带；不能空提交。
- 正文选择围绕具体范围、取消选区、接到理解、留旁支。格式化展示保留 `discussion.text` 的精确文本偏移。
- 对照：真实关系下拉与位置输入，确认或拒绝；不会自动采纳结论。
- 纯文本理解编辑；自选片段、手写替换建议、显式生成示例建议、接受一处、自己改、放弃及撤销。无假富文本按钮。
- 草稿显式保存，独立停点，收回与撤销收回；重开进入图 07，可沿“上次停在”回到原问题。
- 新观察允许接回、拒绝、只留；带入前确认 Agent、项目、任务、文字、trial / reference / exclude、说明、仅本次任务范围。
- 工作旁的新增发现写入 reducer；没有真实结果就不制造反馈。
- 结果事实、解释、未确认、拟修订分别编辑；“只留下结果”“保留修订”“再试一次”独立动作；修订后仍为同一事项，可查看依据与撤销。
- 活动 textarea DOM identity 保持；支持 IME、Shift+Enter 换行、Enter 提交、Esc / 模态焦点约束、reduced motion、滚动内容与固定底部操作。

## 独立复验

`fixture.html` 导入本目录 UI、相邻 model 与 assets，并只读引用已存在 app 的 Anime / glass service。fixture 使用新的内存状态，不复用真实用户数据。

```powershell
node "D:/AGeneral Workspace/AI-powered/harness/artifacts/trace-one-thing-v1-20260915/ui/check-fixture.cjs" acceptance
```

脚本为本轮环境提供：启动独占的 `127.0.0.1` 随机端口静态服务，启动隔离 Chromium，结束后关闭自己的服务和浏览器；不碰 4173 等已有服务，也不使用用户浏览器配置。

输出 `acceptance-checks.json` 和 `acceptance-*.png`。保留 `first-*` / `final-*` / `verified-*` 初轮记录，不把重试通过说成首次全过。测试脚本中 Playwright 包与 Chromium 路径是当前机器真实路径，换机需重新配置，不是产品运行依赖。

## 实测历史与限制

1. 第一轮 11 态资源加载 / 页面运行没有错误，13 项检查 12 通过；闭环测试先遇到两个 reopen 按钮的严格选择器冲突。
2. 后续闭环测试仍失败：脚本误假设 REOPEN 回 resume / understanding；现场 reducer 实际回图 07 reentry，脚本须点击“上次停在”才能回 resume。没有按错误测试假设修改模型。
3. 目视批量检查后修正：结果拟修订区、对照关系字段、带入说明与范围默认藏在滚动区，未决停点标签断行，重复收起提示，正文段距过大。原图 vs 代码不是逐像素一致验收。
4. 最终 `acceptance-checks.json` 为 15 / 15 通过；11 态没有 pageerror、console error、请求失败、主面横向溢出或主操作超出画布。截图包括 1672×941 全 11 态，以及 1280×800、880×620。880 宽目前等比缩小后文字偏小，**未宣称窄屏易读性 / 移动端通过**。
5. 尚未接 app 路由、真实 Electron 壳、原生 Overlay、模型、文件上传、长期保存、跨端同步。未做屏幕阅读器实机或完整性能验收。
6. 大玻璃面为 CSS 近似；图片参考里的未命名 / 过度生成文本按 view 真实性校准。示例图 09 原生主场以明确说明替代假聊天，属于有意差异。

### 最后字体补集复验

固定文案新增 6 字后，assets worker 将两字体补至 646 可见码点并离线核验；UI 又单独加载最终字体，两个 FontFace 均 `loaded`，补充字串检查通过，无页面错误。见 `font-browser-check.json`。15 项完整交互检查与补集后的字体加载检查分开留证；补字未改 UI 逻辑。

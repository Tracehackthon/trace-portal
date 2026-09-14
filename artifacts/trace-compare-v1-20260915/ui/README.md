# Trace 找个对照：独立 UI 模块交付

## 身份与范围

- 任务：`trace-compare-v1-20260915`。
- 委派仓库基线：`trace-runtime` HEAD `2f4377864aa353dcecb3f60005d884b11486c84e`。
- 已核验 context-package SHA256：`B7417F6FD5E3F6FE1F699F5B9316BE15B8129DF8077EEC77D909679A9C5A61EC`。
- 本 worker 只写 `artifacts/trace-compare-v1-20260915/ui/`。未修改 `app`、插件、公共文档、参考图或其他 worker 目录；未动已有 `4173` 服务。
- 已亲看四张 1672 × 941 参考图。`generation-prompts.json` 只补充文案语义，不替代图稿。
- 这是可接入、已通过独立 fixture 检查的原生 DOM 模块；**尚未接入默认桌面 app / 同一件事宿主 / Electron，不能作为最终业务验收**。

## 产物

| 文件 | 职责 |
|---|---|
| `comparison-screen.mjs` | 四屏共壳、真实表单、材料详情、关系确认、局部修订确认、receipt / 撤销显示 |
| `comparison.css` | 所有规则限定 `.compare-root`，类名前缀 `compare-`；不改 `body/:root` |
| `copy.txt` | 四图固定文案与补充确认面的字体覆盖输入 |
| `fixture.html` / `fixture.mjs` | 独立宿主，直接导入 `../model` 的 reducer、selector 和纯宿主 helper |
| `preview.mjs` | 可选手动预览，启动自己的动态 loopback 端口，Ctrl+C 停止 |
| `selfcheck.cjs` | 自动检查，启动自己的动态 loopback 服务 + 隔离 headless Chromium，并在 finally 关闭 |
| `checks/first-*` | 初次行为检查与四态截图，保留候选按钮裁切问题证据 |
| `checks/final-*` | 修复后 22 项检查与四态 / 确认面 / 880px 截图 |
| `checks/release-report.json` | 最终依赖组合的 23 项非截图功能复验，记录模块 / 模型 / 资产 SHA256 |

## 视觉实现

- 模式：**Operate + Read**。任务不是展示搜索成绩，而是把一处可疑的表达和候选材料放在一起，支持明确选择“关联”或“修订”。
- 视觉权威：01 从这一处找、02 发现候选、03 放在一起看、04 接回原处。保留无侧栏、纸白阅读面、细水墨连接、玉绿主行动、少量琥珀条件差异。
- Token：纸白 `#f9fdfc`、墨黑 `#101b23`、阅读灰 `#516676`、深绿 `#005b49`、浅水线 `#cfe0e4`、琥珀 `#efb24d`。
- 主标题与操作：`Trace Compare Sans`，标题 700；原表达与摘录：`Trace Compare Serif` 600；04 新理解使用 Sans 650。未覆盖动态中文系统字体回退，不能声称全部中文都在本地子集中。
- 特征：一处原表达与一份候选并置，由细曲线联系；关系建议与用户判断分开。01 锚点和02首候选实际使用已有 alpha glass adapter，03/04 优先纸白，不把阅读区做成折射特效。
- >= 1000px 使用 1672 × 941 标尺按容器等比居中；< 1000px 重排为可滚动原生布局，不简单缩成微型截图。880px / 390px 已检查核心动作可达。
- 两姿态鸟只作小型静态位置提示；Anime.js 仅用 380ms 页面淡入/轻位移，减弱动态偏好时禁用。没有宣称自然拍翅或生成了新的全页组件图。

## 接口

```js
import {mountComparisonScreen} from './comparison-screen.mjs';
// 由宿主加载 comparison.css；不修改全局 CSS。
const screen = mountComparisonScreen({
  root,
  view: selectComparisonView(state),
  onAction(action) { /* 更新 reducer，提交 request 给当前事项宿主 */ },
  onReturn(view) { /* 返回同一 matterId 的原处；不自动变更理解 */ },
  onContinue(view) { /* 宿主选择后续入口 */ },
  onAll(view) { /* 宿主选择轨迹入口 */ },
  assets: {background,birdPerched,birdTakeoff,serifFont,sansFont},
  services: {animate,svg,mountSceneGlass},
});
screen.update(selectComparisonView(nextState));
screen.destroy();
```

`onAction` 是唯一业务动作出口。UI 不导入业务 reducer，不维护第二份事项库。输入发生时只修改既有控件；同步 selector update 不重建输入、焦点与选区，IME composition 结束后才派发完整文本。UI 仅自持范围弹层开关、未提交粘贴材料表单、候选页调整输入等临时面状态。

### 必须保留的宿主提交顺序

```js
state = reduceComparison(state, action);
screen.update(selectComparisonView(state));
if (state.request) {
  const request = state.request;
  const result = applyComparisonRequest(currentMatter, request);
  if (result.ok) currentMatter = result.matter;
  state = reduceComparison(state, {
    type: 'COMMIT_RESULT', requestId: request.id, ...result,
  });
  screen.update(selectComparisonView(state));
}
```

`applyComparisonRequest` 仅作为隔离 fixture 的纯宿主。正式接入应由 root adapter 映射到同一事项真实版本，不能直接把示例 `currentMatter` 当长期事实源。

## 交互与真实性

1. 01 真实问题、方向、补充条件与范围；开始前无候选。范围显示平台是本地演示条件，不请求知乎。
2. 02 真实候选集；空匹配有空态。调整输入进入可确认搜索表单，用户再开始找；不虚构线上搜索。
3. 03 原表达/原文上下文/材料信息/未确认关系/用户判断彼此区分。候选切换的判断草稿由模型按 ID 隔离。保存判断不修改理解。
4. `接到这件事` 先打开关系与具体位置确认，再派发 LINK；成功仍在 compare，理解/版本不变。已关联候选不能在此“这次无关”解除，UI 禁用并说明；仍可进入修订理解。
5. `补进我的理解` 打开独立 before / editable after / after preview。变更确认前、等待宿主期间、冲突失败时都不显示已更新。取消/Esc 不改理解。
6. 04 仅跟随模型返回的实际 revise receipt，查看精确片段差异与修订 ID。撤销再次提交给宿主；不能覆盖后来的编辑，不能丢掉已接材料。
7. 自带材料只读用户明确粘贴的字符串，`kind=user`、`url=null`，不假装上传、读取网页或作者验证。所有用户文本 `textContent` / `value` 输出。

## 复用与依赖出处

- **Anime.js 4.5.0 / MIT**：fixture 从现有 `trace-runtime/apps/desktop/src/vendor/anime.esm.js` 读取。主模块接受 `services.animate`，不重新下载整仓、不跑第三方 lifecycle。
- **@liquidglassjs/core 0.5.2 / MIT**：通过已有 `src/home/scene-glass.js` 和 `src/vendor/shape-only.mjs` 使用。UI 借用该本地 adapter；`data-refraction=requested` 只说明库已请求，不能单凭标记声称物理渲染完全正确。
- **原生 Trace 图标**：`comparison-screen.mjs` 的基础路径改造自已有 `src/home-icons.js`，统一 SVG classname 到 `compare-icon`；必要编辑/纸夹/信息图标在本模块用简单原生笔画补全。
- **字体 / 背景 / 透明鸟**：由 `compare_assets` 交付 `../fonts` 与 `../images`，许可、原图与派生关系以该 worker manifest 为准。旧鸟授权的透明修复结果直接复用，本次未再修新图。
- **没有**复制 Codrops 受限制源码，没有 React 迁移，没有新增 npm 依赖、锁文件或整仓模板。

## 重放验证

工作目录：`D:/AGeneral Workspace/AI-powered/harness`。

```powershell
node --check artifacts/trace-compare-v1-20260915/ui/comparison-screen.mjs
node --check artifacts/trace-compare-v1-20260915/ui/fixture.mjs
node artifacts/trace-compare-v1-20260915/ui/selfcheck.cjs rerun
# 仅功能/几何/依赖复验，不追加视觉截图：
node artifacts/trace-compare-v1-20260915/ui/selfcheck.cjs rerun --no-screenshots

# 可选手动预览，实际地址以命令输出为准：
node artifacts/trace-compare-v1-20260915/ui/preview.mjs
```

`selfcheck.cjs` 当前使用已核验的本机 Node Playwright 包与 Chromium 路径，移机需修改脚本常量；不会使用个人浏览器 profile。单独浏览器禁用跨源 file 模块时请用本脚本 HTTP fixture，未声称 file:// Electron 已测。

手动 fixture 支持 URL `?screen=search|candidates|compare|returned` 与 Alt+1/2/3/4，仅用于明确示例快照；正常交互依然走 reducer → request → host mutation → receipt。`window.compareFixture` 仅是独立测试页调试入口，不应打入实际 app。

### 已运行

- 初次 18 项交互检查全部通过，控制台 / HTTP 错误为空；**人工亲看发现02后两张候选按钮底部被裁切**，初次报告保留，不能称首次完整通过。
- 修复后第二轮 **22/22**：四态实际本地字体/图载入、无横向溢出/按钮裁切；搜索/空结果/范围方向、输入节点与 selection、IME、详情、候选草稿、保存判断不变更、LINK 不修订、before/after 确认、等待回执、冲突、撤销保留材料、文字安全、宿主回调、880px/390px操作、长引文滚动、destroy。
- 交付前针对“用户材料超长标题可能挤掉动作”的明确鲁棒性缺口加了标题区滚动上限和回归例；同时接收模型新增的默认短摘要、默认短问句，以及最终 439-codepoint 字体补集。最终 **23/23 非截图功能复验**通过，`checks/release-report.json` 记录当前实际依赖哈希；无控制台 / HTTP 错误。
- 初次动态端口 `50787`、第二次 `62118`、最终依赖复验 `64354` 均为本测试自建，测试结束正常关闭；无本模块服务遗留。
- 视觉检查共两批，已停止泛化微调。`checks/final-*.png` 直接由可交互页面生成，不是参考图替换。
- 最终字体和默认02短摘要比 `final-*.png` 截图晚到；截图保留其当时画面，不冒充最新短文案截图。最终组合已在真实浏览器非截图复验加载和动作，具体版本以 `release-report.json` 为准。
- Impeccable detector 运行一次有 7 条静态提醒：4 条是模板中鸟 `src` 由 `setBirds()` 同步填入（实际四态图片加载已确认）；2 条左边线为04图稿明确的未决停点标记与引用语义；1 条 Arial 只用于 Trace 拉丁字标，中文仍使用已交付字体。未为了消除静态提示偏离指定视觉，也不将提示隐藏为零。

### 未验证 / 限制

- 默认 app 路由、原事项字段映射、原生 Electron 和真实 Overlay 最终状态未由本 worker 测试。
- 不调用真实搜索、模型、知乎、存储或外部动作。返回/继续/全部轨迹只交宿主回调。
- 字体真实动态中文使用系统回退；不是全字库。手机只作为鲁棒性检查，本次视觉权威仍为桌面四图。
- 背景和小鸟为生成/复用素材，玻璃为适配库 + 纸白降级；与参考图并非像素逐点相同，也不承诺全 GPU / 全设备帧率指标。

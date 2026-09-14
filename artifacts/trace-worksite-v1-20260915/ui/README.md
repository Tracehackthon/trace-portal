# Trace 工作现场五态：独立 DOM UI 模块

## 身份与边界

- 任务：`trace-worksite-v1-20260915`；owner：`worksite_ui`。
- 仓库基线：`2f4377864aa353dcecb3f60005d884b11486c84e`。
- 已核验 context-package SHA256：`DD9BDA87EDB138B15C3A3E9535BD78BF5E51934DA333A4175C251BF8F7078C06`。
- 读取基础 CONTRACT 和 AMENDMENT-01，亲看五张 1672×941 参考图及 README。视觉方向只来自指定的工作现场五图，没有沿用旧首页作为版式方向。
- **尚未接入 app、路由或真实 Overlay**。本目录只交付可挂载组件及独立 fixture。未修改 app/plugin/锁文件/参考图/其他任务。

## 文件

| 文件 | 职责 |
| --- | --- |
| `worksite-screen.mjs` | `mountWorksiteScreen`、真实输入、局部面板、可中断鸟运动和五态 view 映射 |
| `worksite.css` | 仅 `.worksite-root` 内生效的 `worksite-` 样式；1672×941 场景和 <1000px 纵向重排 |
| `worksite-icons.mjs` | 复用既有 home-icons 的本地 SVG 语法及 Trace 标记，补工作切换/结果等少量原生图标 |
| `copy.txt` | 固定 UI、fixture、notice 字集；最终资源 Agent 对照该文件补字体 |
| `fixture.html` / `fixture.mjs` | 独立示例。通过状态 Agent 模型驱动真实点击，非五张整页图片切换 |
| `fixture-server.mjs` | 本地只读静态测试服务，端口默认动态分配，不杀已有进程 |
| `browser-checks.cjs` | 独立 Chromium 点击与视觉批次；环境路径可覆盖 |
| `first-checks.json` / `final-checks.json` / `behavior-final-checks.json` | 原始首轮失败、二轮渲染及收尾功能检查 |
| `first-*.png` / `final-*.png` | 实际浏览器截图，不是生成参考图 |

## 接口

```js
import {mountWorksiteScreen} from './worksite-screen.mjs';
// consumer loads worksite.css once, and owns the only domain store.
const ui = mountWorksiteScreen({
  root,
  view: selectWorksiteView(state),
  onAction(action) {
    state = reduceWorksite(state, action);
    ui.update(selectWorksiteView(state));
  },
  onHome,
  onOpenMatter,     // receives an explicit matterId
  onOpenArtifact,   // receives {title,url,...}; only called for a real nonempty URL
  onReturnToAgent,  // receives work; requires work.connected === true
  assets: {background,birdPerched,birdTakeoff,serifFont,sansFont},
  services: {animate,svg,mountSceneGlass},
});
ui.update(nextView);
ui.destroy();
```

业务状态只从 view 读取；不复制第二份理解、工作结果或修订 store。局部状态仅用于弹层、焦点、动画、输入 composition 标记。切换工作通过 `SELECT_WORK`，表单会更新到对应工作的草稿，而非沿用另一工作的内容。

`update` 不重建 textarea。活动输入不被赋值，composition 期间不发半成品草稿；compositionend 提交完整文本。外部强制切换 work/intake 才切换对应字段值。`destroy` 清理自身 ResizeObserver、window listener、字体实例、玻璃实例、动画及 DOM，不清理用户的其他组件。

### 第三方复用与许可

没有下载或安装新框架。fixture 复用当前项目已有的：

- `trace-runtime/apps/desktop/src/vendor/anime.esm.js`：Anime.js 4.5.0，MIT；动画通过注入服务使用。
- `trace-runtime/apps/desktop/src/home/scene-glass.js` 及其 `vendor/shape-only.mjs`：本地 adapter + @liquidglassjs/core 0.5.2，MIT；材料通过服务注入，不复制另一份 vendor。
- `trace-runtime/apps/desktop/src/home-icons.js` 中的 Trace 本地图标语法。`worksite-icons.mjs` 标明复用来源，新增 glyph 为同一风格的本地 SVG。
- 字体、背景、鸟图由同批 assets owner 交付，来源/哈希/OFL 见 `../fonts/`、`../images/manifest.json` 及资源说明。不是全局字体安装。

**没有复制 Codrops reference-only 源码。** 组件本身不访问 CDN。fixture 使用跨目录本地 import，仅为独立检查；根整合时用现有 app 的相同服务注入。

玻璃不是截图换页：景物由 adapter 对齐取样，文字和控件是上层 DOM。adapter 对大面积表面采用预算内的 CSS/SVG fallback，`data-refraction=requested` 只能说明调用了材料服务，不单独证明物理折射质量。两个鸟姿态是透明 PNG + 路径运动，不声称自然扑翼动画。工作现场用 `.08` 源像素缩放，复用经授权修复的 alpha，未再编辑鸟原图。

## 五态与补充状态

- `overview`：本次带入、具体取舍、现场发现入口、带回结果。排除项仍保留原文记录，实际 context 不含排除项。
- `intake`：原文快照/相关性/本次用法，四个显式角色；`context.instruction` 直接反映 selector 的真实参与方式，不只是选中颜色。
- `impact`：理解→取舍→示例产物；provided/decision/artifact/usage 各自来自 view，不推导自动进度；确认与未知分栏。样例原型始终标示例，外部入口未接时显示提示。
- `finding`：可编辑原始发现与补充文本；关联可以拒绝；先留、展开想想、用于当前工作分开。未接入 `onOpenMatter` 时保留发现并提示，不假开讨论。
- `results`：实际事实、解释、未知、候选理解分别输入；只留结果不修改理解；查看差异只是 review，确认后才有回执；撤销保留结果事实。

**以下是实现补充，不在原五图展开范围内：**工作选择面板、未接入/无带入、来源快照、影响纠错、拒绝候选后的重新选择关联、结果归属选择、before/after 确认面板、回执和撤销、个人区域未接入说明。没有增加永久导航侧栏或强制五步向导。

从 footer 示例提示可以识别 fixture；示例按钮不冒充连接 Codex。即使消费者提供 callback，Artifact 无实际 URL 或 work.connected=false 也不会发出外部打开/返回。

## 运行与重放

工作目录为 harness 根目录：

```powershell
node artifacts/trace-worksite-v1-20260915/ui/fixture-server.mjs
```

取服务真实输出中的 URL（不要假定端口）。`?screen=intake|impact|finding|results` 创建独立示例；默认 overview；`?empty=1` 不注入示例数据。导航不自动载入其他示例。

本次检查服务地址：`http://127.0.0.1:64335/artifacts/trace-worksite-v1-20260915/ui/fixture.html`，owner worksite_ui，exec session `90534`，PID `35824`。交付时已关闭并确认端口释放；没有触碰首页等其他预览服务。按上面的命令重新启动即可，重启后端口可不同。

手动窄链路：

1. 点击第一条“查看这次怎样用”；切到“这次不用”，核对说明“不再进入本次上下文”；切回“这次只作对照”。
2. 点击“查看实际影响”；点示例原型会明确“尚未连接”，不会假跳转；可以保留一条影响纠错。
3. 回“工作总览”，输入自己的现场发现并按 Enter；核对原话、拒绝关联、先留，再“用于当前工作”。
4. 回总览“带回结果”，确认事实最初为空；填写事实与候选理解，先“只留下结果”，核对理解未变。
5. “查看修改并确认”→编辑 after→明确确认→撤销，核对事实还在且版本单调增长。

自动检查：

```powershell
$env:FIXTURE_URL = '上面实际输出的 fixture URL'
node artifacts/trace-worksite-v1-20260915/ui/browser-checks.cjs final
```

脚本默认使用本机已存在的 Chromium 与 bundled Playwright；可通过 `CHROMIUM_PATH`、`PLAYWRIGHT_MODULE` 显式覆盖。不下载新浏览器，不使用用户 profile。报告包含实际 URL、时间、逐项断言、错误、字体/图片/溢出等。

## 已验证、首轮失败与限制

- `node --check ui/worksite-screen.mjs` 通过。
- 首轮真实点击 **19/20**：唯一失败是测试错误要求 contrast 文案必须含“对照”，实际 selector 文案为“只用于比较条件和差异，不据此约束当前实现”。改正为该实际语义断言，保留 `first-checks.json`，不将其记为产品 defect。
- 首轮截图识别并一批修正：小取舍标题换行裁切、reset 后局部提示残留、节点被内容表面盖住、空态仍出现关系线。二轮 **24/24**；无 console/pageerror、无 4xx。
- 两轮视觉后停止打磨。收尾仅补契约要求的点击来源→玻璃面原位展开，以及拒绝候选后的显式重新关联。`behavior-final-checks.json` **26/26**，没有再拍第三轮截图；包含真实普通运动中的展开 transform、打断后的清理。截图保持二轮文件，稳定终态未改。
- 最终实际素材与两 face 加载；8 个截图检查项（五态 1672×941、发现 880×720、结果 390×844、空态）无整体横溢出。长正文、可滚动字段、390px 确认按钮可达实际测试通过。
- 输入节点/选区保留与 `CompositionEvent` 合成 IME 测试通过；这不是 Windows 实体中文输入法设备验收。
- 测试覆盖可中断普通运动、reduced motion、Esc/Tab 对话框焦点、空提交、XSS 字面文本、当前工作隔离、明确确认/撤销、未接外部提示。
- 机械检测仅运行一次，报 3 个提示：模板鸟 img 的 src 由 assets 在 mount 时赋入（实际请求与 naturalWidth 均通过）；Trace 既有字标使用 Arial 触发“常见字体”。这是已核对的注入素材/既有字标选择，不是实际破图或全页系统字体。正文字体已自托管并验证。
- 尚未做工作现场模块的 Electron/file://、真实 Agent/Overlay、真实 Artifact、长期状态或完整性能验收。本地字体独立 file:// 检查由 assets owner 完成，不等同本模块原生运行验收。
- 与其他 chain/matters 独立产物尚不共享长期理解；根接入前必须按模型 mapping 统一领域 ID/store，不把 fixture 的同名事项当成已接续状态。
- 当前模型的只留结果/再试仍要求明确 `matterId`。UI 可以先写事实，但没有事项时会得到模型的明确提示而不是假保存；未关联内容可作为 finding 保存。是否支持“孤立结果”留待根 Agent 确认领域边界，UI 没有擅自绕过模型校验。

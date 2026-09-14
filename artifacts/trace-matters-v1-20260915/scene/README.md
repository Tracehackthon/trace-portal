# 在意的事 v1：场景模块交接

面向主 Agent / 应用整合者。状态：**独立模块已运行检查；尚不能据此声称主应用路由、Electron 或整体原型验收完成**。

- 任务：`trace-matters-v1-20260915`
- 基线 HEAD：`2f4377864aa353dcecb3f60005d884b11486c84e`
- 已核验上下文包 SHA256：`BDF5906EC3208A9C254499C5082E5E689971A7547BCC9A1A303BA5F28FA45068`
- 唯一视觉依据：`Trace在意的事完整交互链路_v1` 的七张 1672×941 PNG，均已亲看。
- 本 worker 只写当前 `scene/`；不修改应用、插件、模型、字体、共享契约或锁文件。

## 接入

只需复制 `matters-screen.mjs`、`matters.css`；预览与检查文件不是运行时依赖。父级负责加载 CSS、管理模型、配置资源 URL 和路由。

```js
import { mountMattersScreen } from './matters-screen.mjs';

// createMattersState / reduceMatters / selectMattersView 由 model worker 提供。
let state = createMattersState();
const screen = mountMattersScreen({
  root, // 独占、有非零宽高的容器；建议覆盖当前视口。
  view: selectMattersView(state),
  onAction(action) {
    state = reduceMatters(state, action);
    screen.update(selectMattersView(state));
  },
  onHome() { /* 父级路由回既有首页 */ },
  assets: { background, birdPerched, birdTakeoff, serifFont, sansFont },
  services: { animate, svg, mountSceneGlass },
});

// 离开页面：
screen.destroy();
```

`assets` 均为父级准备的本地 URL，不含环境硬编码；`services` 可全部缺省。组件不自行加载 CDN，不调用模型、不写存储、不改 URL。

`svg` 为预留注入字段，目前原生 SVG 路径已足够，未依赖它。`animate` 仅用于进入的约 720 ms 局部动画。`mountSceneGlass` 只用于主泡，三瓣与深读大面始终使用 SVG 膜层。

## 与七图的对应

| 图 | 具体实现 |
|---|---|
| 01 静默总览 | 六个真实对象按钮、静默场景连线、搜索、主泡和小鸟 |
| 02 悬停 | pointer/focus 共用识别高光、其他气泡淡化、来源语境提示；不会写领域状态 |
| 03 生长 | OPEN 后从被点击气泡位置扩展；`Esc` 返回，跳过按钮直达；减少动态或无动画服务时不等待 |
| 04 重新进入 | 一条连续三瓣 SVG 轮廓；三列标题、正文、现场链接与行动都是独立 DOM；正文可滚动 |
| 05 深度继续 | 四节点导航、四个实际内容分支；对照的两个关系选择、原文面板、判断/理解草稿与明确提交 |
| 06 搜索 | 三组结果与模型实际计数；对象跳到真实当前停点；引文/来源先选择相同对象，再打开本地材料面板 |
| 07 返回 | 仅消费模型 `changed/branch/lastStop`；改变节点与分支只在模型存在时显示，不制造自动结论 |

所有 view 文本均经 `textContent` / `value` 写入。唯一 `innerHTML` 是源码中的固定图标表。已用 `<b>收藏的新判断</b>` 验证其作为文本显示，不插入标签。

`understanding` 是明确保存的当前理解；不覆盖 `originalUnderstanding`。fresh 使用模型投影后的 selected，不从原对象 fallback 旧理解/停点；空值提示“先写下此刻的感受”。草稿更新不重建输入框，输入法组合中的 Enter 不提交。

键盘路径包括 Tab、焦点高光、Enter 保存、Shift + Enter 换行、Esc 关闭材料/返回上级。材料使用原生 dialog；关闭恢复焦点。动画结束同样恢复可操作焦点。标明“示例内容 · 仅本次会话”，原现场不冒充已连接的外部原文。

## 材质和布局取舍

- 主体坐标以 1672×941 为基准；小窗口等比缩放 UI，并提高正文字号、长标题泡高度。背景只保留一个 cover 平面，避免 880×620 上下拼接第二张照片。
- 主泡的 scene-glass 采样面传入 **shell**，即实际背景所属元素；不是舞台内部坐标。`mountGlassShape` 过滤的是 SourceGraphic，因此仍要求背景 URL 与 shell 当前 cover 背景一致。不是“任意背景开箱折射”。
- 大面使用连续 SVG + objectBoundingBox 裁切的轻 backdrop blur + 多道边缘高光。材质没有文字，不用整张概念图承载 UI。
- 位移图只由现有 adapter 在静止尺寸/resize 稳定后创建；进入动画没有折射重建循环。API 失败退回自有 SVG，不影响点击与输入。
- 小鸟复用原来修复的两张，按真实脚部锚点定位。只有栖息与起飞两个姿势，不伪装成完整振翅序列。
- 宋体注入轴声明为实际 `250 900`，黑体 `100 900`；固定文案自托管子集，动态中文系统 fallback。
- 没有复制 Codrops 或引入框架。当前物体轮廓是为七图写的原生路径，而非宣称某个成熟组件可直接还原整图。

## 实际检查

在项目根目录执行：

```powershell
node --check artifacts/trace-matters-v1-20260915/scene/matters-screen.mjs
node artifacts/trace-matters-v1-20260915/scene/smoke.cjs
```

`smoke.cjs` 使用本机已有 Playwright 和 Chromium；可用 `TRACE_TEST_CHROMIUM` 覆盖可执行路径。没有安装依赖或启动 HTTP 服务：隔离浏览器通过 `route.fulfill` 读取明确白名单文件，并在 `finally` 关闭自身实例。不连接用户浏览器或用户资料目录。`preview.html` 是供该检查脚本拦截加载的 harness，不承诺直接双击 HTML 能跨目录 import。

最终结果见 `smoke-result.json`：**17 项通过，pageerror / console error / 请求失败均为 0**。包括六对象、悬停/OPEN、减少动态、dialog/Esc、明确关系与停点、HTML-like 输入安全、搜索/来源同对象、fresh、草稿隔离、四 tab/理解保存、IME Enter、动画中断/结束焦点、destroy、无 service、service 抛错及真实既有 glass adapter 挂载/resize/释放。

尺寸截图实际覆盖 1672×941、1440×900、880×620。截图 `check-*.png` 已亲看总览、悬停、三瓣、对照、分类搜索、880 总览/重入/深读、真实 glass 主泡。程序检查指定文本容器未发现横向溢出；这不等于全部长文本、对比度、触达尺寸均验收。

### 首次失败与修复

保留 `smoke-first-failure.json`。首轮在展开结束后发现 skip 控件被移除，焦点落到 body，随后 Esc 不到达组件。现已在结束时恢复到重入面的返回按钮，并分开验证“动画中途 Esc”和“结束后 Esc”；后续重跑通过。目视同时修复了对照页关系按钮裁切、长标题挤掉副标题和小窗口背景拼缝，未包装为首次干净通过。

## 限制 / 交给主 Agent 的下一步

1. 这里只验证独立场景 + 模型；未验主应用入口、返回旧首页、既有讨论窗口或 Electron `file://` / preload。主 Agent 应在实际页面再跑完整链路。
2. 新背景有较细密的水面与山林，和参考图的空气感仍需主 Agent 逐像素评估。膜层、分叉弧线、鸟的移动是接近构图的实现，不声称像素级复刻。
3. 880 模式仍保留场景缩放，不是专门的移动端重排；一些长内容需滚动。主 Agent 应重点验最小窗口可读性与触达尺寸，不以“无横向溢出”替代该验收。
4. 搜索组会随用户保存增多，列表超出面板时滚动；截图中的数量来自当时状态，不是固定的 1/2/3。
5. 材质成功检查只证明本机 Chromium 已进入 `data-refraction=requested` 并能 resize/释放；没有 GPU 性能基准或其他壳兼容保证。大面不启用高成本折射。
6. “全部痕迹”目前按本任务 API 返回事项总览；更广泛的全局痕迹浏览不在这个契约内。

## 当前运行文件身份

| 文件 | SHA256 |
|---|---|
| `matters-screen.mjs` | `2CD3BC190732F771BA27CEBEAFA14EB320CA21941CF6F3467A69F38233D9023F` |
| `matters.css` | `9DEB663CC6F2E315BD61DA4E7902313782193FBB83177370B43185668518517E` |
| `smoke-result.json` | `7E0E7A356E4AC04B0D7956D9838B94C593F1630293660FB0733A740DE1028183` |

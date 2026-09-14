# Trace 首页 v1 组件资源接入说明

面向后续整合首页的主 Agent。**本包仅交付源码、许可和一个离线形状材质 bundle；尚未组装首页，也未验收渲染效果。**

- 任务：`trace-home-v1-assets-20260914`
- 包哈希：`FEC12772D27033E54E9EDB811486DE7C749DB5AFF054BF1BA3DE06628DC00CD7`
- Git 基线：`2f4377864aa353dcecb3f60005d884b11486c84e`
- 组件资源根：`D:/AGeneral Workspace/AI-powered/harness/artifacts/trace-home-v1-20260914/components/`
- 单一清单：[manifest.json](./manifest.json)；检查证据：[validation.json](./validation.json)。每个原始文件均记录固定 commit URL、Git blob SHA-1 和 SHA256。
- 只有主 Agent 可以将选中的资源整合进 app/plugin。不要把整个 `originals/` 目录复制进应用。

## 交付内容

| 部件 | 已准备文件 | 可复用部分 | 接入状态 |
| --- | --- | --- | --- |
| `@liquidglassjs/core` 0.5.2 | `originals/liquidglassjs/`：核心 TS/CSS、LICENSE、README、包清单、GOTCHAS，共 27 文件；`derived/liquidglassjs/shape-only.mjs` | `mountGlassShape`、`buildAlphaDisplacementMap`、`mountAlphaGlass`；`createGlassSurface` 源码也保留但未编译到此 bundle | MIT；形状专用 ESM 已本地编译。运行与视觉未验收 |
| Anime.js 4.5.0 | `originals/animejs/dist/bundles/anime.esm.js` 和 `.min.js`、LICENSE.md、README、包清单 | `morphTo`、`createMotionPath`、`createDrawable`、`createTimeline` | MIT；官方自包含 ESM 文件，无需在线 CDN；不代表具体动效已实现 |
| Magic UI `AnimatedBeam` | `originals/magicui-animated-beam/apps/www/registry/magicui/animated-beam.tsx`、多输入/多输出源码、LICENSE.md | 端点测量、底线与高光双层路径、渐变方向控制 | MIT；React 源码，需要移植，未提供可执行原生组件 |
| Codrops `ShapeMorphIdeas demo5` | `originals/codrops-shape-morph-reference-only/` 内的 JS、HTML、CSS、README | `Blob.reveal/unreveal`、动画防重入、内容进入与收回顺序 | **仅研究参考；资源级许可未解决，禁止导入、打包、分发** |
| rizzy liquid-glass 0.1.0 | `originals/rizzy-liquid-glass/core/liquid-glass.js`、LICENSE、README、包清单 | `createLiquidGlass`、规则圆角矩形的位移图与 SVG 滤镜 | MIT；单文件 ESM 轻量备选，未运行 |

源码与派生结果分离：`originals/` 文件保持上游字节不变；`derived/` 的入口选择、bundle 和构建清单有单独哈希。下载的包脚本、示例页面和第三方资源均未执行。

## 形状材质的真实边界

`mountGlassShape` 的 alpha 源可来自 SVG、Canvas、图片或 `draw` 回调；它沿该轮廓构建位移图，使用 SVG `feDisplacementMap` 折射 **target 自身的 `SourceGraphic`**。这不是一个自动折射任意页面背景的完整容器。

接入前必须完成：

1. 给 target 准备与全局场景同一坐标、同一缩放的背景采样层；在气泡内保持连续，而不是把整张背景各自 `cover` 一遍。
2. 令目标 alpha 与地图中的气泡轮廓一致，保留必要的采样边界。**文字、图标、输入与按钮放在独立的未折射层。**
3. 气泡位置变化只改变布局或 transform；`strength/chroma/blur` 可调滤镜属性。尺寸、轮廓、`bevel/dome/edge/glow/shade` 会影响地图；不能默认每帧重算 PNG。
4. `source` 的 SVG 会先转成位图；后续改 SVG path 不等于库会自动重新读取源。动态轮廓需要明确刷新/重建策略；这一点本包未实现。
5. 验证 `file://`、本地图片/Blob/data URI、实际 Electron Chromium 的滤镜链与 CSP。编译目标 `es2022` 是语法输出设置，不是浏览器兼容性验收。

派生 bundle 仅导出 `mountGlassShape`、`GLASS_SHAPE_DEFAULTS`，包含 7 个上游核心模块，没有 React、WebGL 或外部 imports。它不含 UI 皮肤、页面、自动背景对齐或动画状态机。MIT 全文随 bundle 放在 `derived/liquidglassjs/LICENSE`。

## 形状展开与光路

- **展开：** Codrops 的初始/展开路径配对与 `reveal/unreveal` 可作结构参考；其原例全屏展开、隐藏其他对象，不符合 Trace 场景内保留旁支的要求。暂不复制到可分发实现，先解决资源级授权范围。详见 [REFERENCE-ONLY.md](./REFERENCE-ONLY.md)。
- **光路：** `AnimatedBeam` 直接导入 React、`motion/react` 和项目级 `cn`，不能通过相对路径直接运行于现有原生页面。只移植端点计算、底线与高光路径结构，不把整页改成 React。
- **端点同步：** 原 Beam 主要观察容器 resize，不会覆盖所有节点 transform 动画；节点和路径应共享场景坐标/时间轴。分叉共用主干，不用几条重叠线充当分叉。
- **编排：** 后续可以用本地 Anime ESM 统一 morph、沿路径运动、线条绘制；本批没有把 Codrops 旧版 anime API 与新版库强行混用。
- **轻量备选：** rizzy 库的位移地图是 `roundRect`。仅加异形 `clip-path` 不会使折射方向自动跟随异形边缘。适合输入框或规则面板候选；大面积/父层 opacity/连续 resize 时缓存增长需实测。

## 已执行的检查

本批下载 44 个文件，约 942 KB（未压缩）。全部对上游固定 commit 的 Git blob 哈希与本地 SHA256 做了逐文件核验，下载没有需要重试的文件。

- 4 个原始 JavaScript：`node --input-type=module --check` 语法解析通过，未执行模块。
- 24 个 TS/TSX 实现文件：现有 esbuild 静态解析通过；**不是 TypeScript 语义类型检查**。声明文件未做语义验证。
- 3 个包清单：JSON 解析通过。
- 形状专用离线 ESM：现有 esbuild 0.25.9 编译通过，17,644 bytes，0 warnings，0 remaining imports；`node --check` 通过。
- 下载源码没有加载插件、构建配置、安装脚本或 npm 生命周期。编译输入仅为 components/ 中已下载模块及本地选出的入口。
- 上下文包列出的 5 个 app/plugin 源文件哈希仍与基线相同。

重新执行**本地检查和派生构建**（会更新本包自己的 `derived/`、manifest 与 validation，不改应用）：

```powershell
node 'D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\components\scripts\verify_and_bundle.mjs'
```

此检查依赖现场已有 `D:/AGeneral Workspace/AI-powered/harness/trace-runtime/plugins/trace-harness-plugin/node_modules/esbuild/lib/main.js`。换机器需提供可信现有 esbuild，不应自动执行下载仓库的 install/build scripts。

`scripts/download_sources.py` 记录了固定源列表及可重放下载逻辑。它会重建下载阶段 manifest，因此不要为验收重复下载；本地检查用上面的脚本即可。

## 未运行与下一步

未运行：真实 DOM 初始化、Electron `file://` 模块加载、SVG 位移渲染、60 fps 性能、六状态视觉对照、动态 path 刷新、动画可中断与交互回归。所有“pass”仅限上述静态检查和构建。

下一批由主 Agent 先组装一个异形气泡的静止 → 唤醒 → 展开 → 收回样片，再决定扩大使用材质引擎。生图负责场景、同一只鸟的姿态与难以稳定代码还原的材质叠层；真实文字、输入、按钮及关系仍由代码实现。

## 官方来源与版本

- [Amir liquid-glass-js 固定源码](https://github.com/Amir-Abushanab/liquid-glass-js/tree/07ad06ea197a07269af56da83d1fc9498bca94f5) · [演示](https://amir-abushanab.github.io/liquid-glass-js/)
- [Anime.js 固定源码](https://github.com/juliangarnier/anime/tree/01b81be1df6843ccfe0a71c0699a746bf740dd77) · [SVG 文档/演示](https://animejs.com/documentation/svg/)
- [AnimatedBeam 固定源码](https://github.com/magicuidesign/magicui/blob/52bc69354621e5cd7c9bc84a0e42b42f2d0c07b1/apps/www/registry/magicui/animated-beam.tsx) · [演示](https://magicui.design/docs/components/animated-beam)
- [Codrops 固定示例](https://github.com/codrops/ShapeMorphIdeas/blob/eeb7a4f4d7cf580bf8f0b8fb921f1af10f5ffce7/js/demo5.js) · [演示](https://tympanus.net/Development/ShapeMorphIdeas/index5.html)
- [rizzy 固定核心](https://github.com/rizzytoday/liquid-glass/blob/841af14fb3eb9653d24aacf4eb049c9f389db1ef/core/liquid-glass.js) · [演示](https://rizzy.today/liquid-glass/)

以上演示仅为来源导航，本批没有运行官方页面，也未将官方演示效果当成 Trace 已验收效果。

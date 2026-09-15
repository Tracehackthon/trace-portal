# Trace Web UI renovation · parity matrix

任务：`trace-web-ui-renovation-20260915-phase1`  
基线：`1bb35b26833ed9451fbdee91ef57368dc10b86e8`  
视觉依据：

- 首页：`D:/AGeneral Workspace/AI-powered/harness/manunl/具体页面与视觉实现/桌面端/首页/Trace首页交互状态_v1/`
- 在意的事：`D:/AGeneral Workspace/AI-powered/harness/manunl/具体页面与视觉实现/桌面端/核心功能页面/Trace在意的事完整交互链路_v1/`
- 后续原型：`D:/AGeneral Workspace/AI-powered/harness/manunl/具体页面与视觉实现/桌面端/一件事完整交互链路/Trace一件事连续页面_v1/`、`我的理解完整交互链路/`、`结果回来完整交互链路/`、`工作现场完整交互链路/`

## 状态标记

| 标记 | 含义 |
| --- | --- |
| **Present** | 当前 React 外壳中的真实可达界面或动作，使用本机 canonical state。 |
| **Exists, but bypassed** | 有可复用的原生/派生实现，但默认产品路径尚未把它作为独立路由或完整图序列使用。 |
| **Absent** | 当前阶段没有实现；不能用截图或示例文案冒充。 |
| **Deliberately unavailable** | 入口存在但明确告诉用户没有真实连接/凭证/产物，不伪造成功。 |

“存在”不等于像素逐点一致。本阶段验收重点是保留各自参考图的环境、构图、异形玻璃、字体层级、对象来处和可逆状态流。

## 首页六态

实现入口：`apps/web/src/home.js`、`apps/web/src/home.css`、`apps/web/src/react-main.tsx`。首页的背景、鸟、路径和气泡仍以 1672 × 941 场景坐标绘制；React 只持有稳定外壳、资源门和路由，首页 DOM 作为明确 adapter 挂载。

| 参考 PNG | 状态 | 当前实现与差异 |
| --- | --- | --- |
| `01-首页静默总览态.png` | **Present** | `view=home` 显示真实事项投影、输入 composer、搜索/全部/工作入口、原场景背景与鸟。无数据时显示诚实空态，不注入示例事项。 |
| `02-气泡唤醒四帧分镜.png` | **Present** | hover/focus 设置 `data-awake`，只改变路径光流、聚焦/弱化和玻璃刷新，不写 SQLite；click 先在首页本地进入 thinking。四帧作为连续过渡，不作为四个伪路由。 |
| `03-思考接续态.png` | **Present** | thinking 下原位展开 detail card；`继续想`、`查看原现场`、`带去工作` 为显式动作，分别进入 canonical chain resume/discussion/handoff。Escape/收起返回原气泡。 |
| `04-思考生长态.png` | **Exists, but bypassed** | 旧首页 adapter 仍保留 growth/return 的 Anime/SVG 结构，供会话预览使用；真实产品的理解、对照和结果由同一事项的 chain/compare/worksite 承接，未把概念图生长做成独立假数据页面。 |
| `05-工作接续态.png` | **Present + Deliberately unavailable boundary** | 首页“带去工作”只在已有工作记录时打开 worksite，否则进入 handoff 确认；未确认前不创建 Agent/工作。原生 Codex 连接不可用时显示明确本地记录说明。 |
| `06-结果回流态.png` | **Exists, but bypassed** | 真实结果从 worksite 回到同一事项并通过明确修订动作更新理解；首页结果气泡/视觉结构保留为 adapter，不能在没有真实结果时显示“已验证”。 |

## 在意的事七态

实现入口：`apps/web/src/matters/matters-screen.mjs`、`apps/web/src/matters/matters.css`、`apps/web/src/react/runtime.ts`。产品模式由 bridge 的真实事项投影驱动；`overview → reentry` 是短生命周期 presentation state，canonical 内容仍只由 bridge/SQLite 所有。

| 参考 PNG | 状态 | 当前实现与差异 |
| --- | --- | --- |
| `01-静默总览态.png` | **Present** | 真实事项按场景位置显示，背景单平面填充，空态不使用示例 fixture。 |
| `02-悬停识别态.png` | **Present** | hover/focus 显示当前停点提示、弱化其他气泡；不触发保存或关系改变。 |
| `03-点击进入-气泡生长态.png` | **Present** | 真实气泡 click 先留在 `view=matters`，由 Anime/`matters-growth` 展开；reduced-motion 直接跳过装饰运动但保留入口。 |
| `04-重新进入面.png` | **Present** | 生长完成后显示真实 `whyCare`、停点、来源与继续动作；来源不存在时保持诚实空缺。 |
| `05-新的对照-深度继续态.png` | **Exists, but bypassed** | 事项 adapter 保留深度面；“继续”进入 canonical chain/compare，避免事项页面另持一份理解/对照状态。 |
| `06-搜索精确找回态.png` | **Present** | 搜索动作进入真实 `library.mjs` records projection，按原话、理解、材料、结果和来路检索，不显示常量计数。 |
| `07-变化折回总览态.png` | **Present** | 明确保存判断/理解或确认关系后才产生变化；打开、返回、hover 不制造变化。返回使用同一事项 id 和焦点恢复。 |

## 后续页面库存（不提前宣称集成）

| 原型库存 | 阶段结论 | 当前可复用落点 |
| --- | --- | --- |
| `Trace一件事连续页面_v1` 11 张 | **Exists, but bypassed** | `product/chain-screen.mjs`、bridge、URL `screen` 已承接 resume/discussion/understanding/reentry/handoff/work/results/revised 等真实状态；未逐张复制为 11 个图片路由。 |
| `Trace我的理解` 9 张 | **Exists, but bypassed** | chain understanding editor + comparison/worksite revision guard；独立活页稿的完整视觉序列留后续阶段，当前不把草稿冒充已保存理解。 |
| `Trace结果回来` 5 张 | **Present for real work / Deliberately unavailable without one** | worksite results 面分开事实、解释、未确认和修订；没有实际带回事实时按钮禁用并显示诚实空态。 |
| `Trace工作现场` 5 张 | **Present** | worksite adapter 复用真实工作记录、快照和回执；未连接外部 Agent，不显示虚构执行结果。 |

## 共享组件与资源边界

- React 壳层实际复用 `RecoveryButton`、`StatusBar`、`Chrome`、`DialogHost`、稳定 route host、`runtime` typed boundary；各旧场景保留为有命名入口的 adapter，而非清空 `#app` 后再异步重挂。
- `resource-cache.mjs` 对图片 `decode()`、超时、失败清理和 `FontFace` 使用稳定 key；切页在新模块、样式、图片和字体 ready 前保留旧 surface。导航 token/AbortController 取消迟到的 A→B；入场后同步移除旧 root，避免重复 form/id。
- `apps/web/src/product/web.css` 中的共享按钮、状态、对话框与 reduced-motion token 被多个 surface 使用；场景玻璃仍来自既有 `mountSceneGlass`，动画只使用锁定的 Anime.js，不引入 Animate UI、Motion 或 MagicUI 运行时。Codrops 目录仅 reference-only。
- 静态构建资源通过 Vite fingerprint/ETag 与 immutable cache；`/api/web/*` 保持 `no-store`。dev 使用 4186 UI + 4187 API 同源代理，built server 使用单一 origin；桌面打包仍后置。

## 证据入口

浏览器证据由 `scripts/ui-renovation-e2e.cjs` 写入：
`D:/AGeneral Workspace/AI-powered/harness/trace-portal/.test-results/ui-renovation/run-<timestamp>/results.json`。

本轮已验证证据：
`D:/AGeneral Workspace/AI-powered/harness/trace-portal/.test-results/ui-renovation/run-1789420540709/results.json`；产品 25 项浏览器链最新回放：
`D:/AGeneral Workspace/AI-powered/harness/trace-portal/.test-results/e2e/run-1789420587006/results.json`。
该脚本覆盖冷启动/深链、慢背景无空白帧、warm image/font cache、A-B-A 取消、图片失败/模块失败恢复、reduced-motion、首页气泡显式动作、事项生长与原锚点返回、重复提交、hover/back 无 mutation 和 pageerror。截图同目录保存 1440 × 900、1280 × 800 与宽桌面样本。具体 PASS/失败/重试/未运行以对应 `results.json` 为准，不以文件存在代替验收。

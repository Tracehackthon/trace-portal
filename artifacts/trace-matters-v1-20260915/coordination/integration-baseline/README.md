# Trace Desktop Agent（UI Prototype）

## 默认首页原型（2026-09-15）

`apps/desktop/` 默认展示 Trace 首页；唯一视觉依据是 `manunl/具体页面与视觉实现/桌面端/首页/Trace首页交互状态_v1/` 的六张图，不使用旧单张概念图。原讨论页面仍保留，用来承接 DeepSeek Harness 中的“继续讨论”。

首页以同一场景承接静默总览 → 气泡唤醒/原位展开 → 思考接续 → 新理解生长 → 工作接续 → 结果回流。文字、输入框和操作均是真实 DOM；生成图片只承担山水环境与小鸟形象。

### 运行与检查

在当前目录、已有 Node.js 环境中运行：

```powershell
npm run dev
npm run build
npm test
```

`build` 是源码语法检查；桌面分发产物由 `../../plugins/trace-harness-plugin` 的 `npm run build` 生成。无需额外安装首页框架或在线字体。

### 路由与复放

- `/`：默认首页；右下角“交互原型”可选择五个稳定状态，唤醒作为状态间的交互过程。
- `/?state=thinking`、`growth`、`work`、`return`：直接查看对应示例。
- `/?view=discussion`：原讨论界面。
- 出现 `from`、`observationId`、`text`、`status`、`source` 任一参数（包括空值）时仍进入讨论；显式 `view=home` 优先。
- 手动闭环：写入原文并提交 → 在展开卡内写新理解 → 点击工作气泡 → 写实践结果并提交。用户结果标记“已带回 · 待再判断”，不自动采用/验证。
- `Esc` 关闭面板或收回首页；`Ctrl/Cmd + K` 搜索；`Enter` 提交，`Shift + Enter` 换行；组合输入期间的 Enter 不提交。

### 实现与素材边界

- `src/main.js` 仅分流并加载一套样式；原有用户修改的讨论代码完整保存在 `src/discussion.js`，`src/style.css` 未改。
- `src/home-model.js` 维护会话内状态与场景几何；`src/home.js`、`src/home.css` 实现首页。
- 使用本地 Anime.js 4.5.0 与 @liquidglassjs/core 0.5.2 派生核心；场景玻璃由 `src/home/scene-glass.js` 提供对齐的背景采样。大详情卡为性能考虑使用轻量材质，不逐帧重建位移图。
- 字体是思源宋体 / Noto Sans SC 的固定文案子集，动态中文使用系统字体回退。五份许可保留在 `public/home/licenses/`。
- 小鸟使用获用户授权的脚本修复 alpha，原图未覆盖。停驻与起飞两张图沿路径切换，不是自然振翅动画。Codrops 仅作交互参考，受限制源码未拷入应用。
- 主验收尺寸为 1672 × 941；1440 × 900 和 880 × 620 做过边界检查。小窗口仍是缩放桌面场景，详情可滚动，不是移动端适配。

### 实测与仍未接入

- 源码检查及 8 项状态测试通过；独立浏览器回归修复后 23/23 通过，控制台与请求错误为 0。
- 插件构建通过。隔离 Electron 44.3.0 窗口从打包后的 `file://` 页面加载，6/6 检查通过；素材/字体无外网请求，实际 preload 发出的两次候选 IPC payload 正确。
- Electron 测试保留缺少 CSP 的开发警告；尚未验证真实 Overlay 接收后的最终业务状态、完整 GPU 性能与操作系统输入法。不能将隔离 IPC 测试视为这些验收。
- 首页输入、草稿、新理解和结果只在本次页面会话内；刷新/进入讨论后重置。不调用真实模型、不写长期状态、不发送 Codex 消息。讨论页继续明确使用 Mock Agent。

详细失败、修复及复跑记录见 [任务交接](../../../docs/tasks/trace-home-v1-assets.md)；测试脚本与截图在该记录链接的 `prototype-checks/`。

## 原讨论界面与后续集成

原讨论界面聚焦产品闭环：接收一条观察、进入深度讨论、查看现场与待回答问题，并在会话内形成候选状态。

```powershell
pnpm --filter @trace/app-desktop dev
```

默认地址：`http://127.0.0.1:4173/`。

同一讨论界面也会在 `plugins/trace-harness-plugin` 构建时复制到原生桌面插件中。原生入口从本地文件加载，不依赖 `4173` 服务；候选状态通过隔离的 preload bridge 返回悬浮插件。这里仍是演示交互，不代表已经接入 Trace runtime。

Harness 可以通过查询参数带入现场：

```text
/?from=deepseek-harness&observationId=...&text=...&status=...&source=...
```

当前边界：

- UI 与交互为可演示原型，讨论回复使用明确标识的 Mock Agent；
- 不直接读写 SQLite / JSONL；
- 不自动保存用户输入；
- Electron 本地页面与候选 preload 已存在；Tauri / Wails 与真实模型调用未接入；
- 后续通过 product application / MCP / SDK 接入 Trace runtime。

已经确定的集成方向：

```text
desktop renderer / main process
          ↓ explicit product application / MCP / SDK
Trace runtime（project-local .trace/state/trace.sqlite）
          ↓
core protocol / data / storage
```

桌面端与 Codex 必须共享同一项目本地 `.trace/`，不会另建隐蔽状态库。可复用的用户动作是：状态、来源安全摘要、候选 review、proposal、adopt、receipt；renderer 不得直接读写 SQLite/JSONL，也不得将输入框 prompt 自动入库。

进入真实 Agent 阶段前，仍需以 Change Set 固化 desktop event schema、版本与 replay fixture；将文件、网络和认知源权限转成可见且可撤销的确认；通过多次使用、恢复、backup/restore、不同 profile 的端到端验证后，才可标记 desktop runtime 已实现。

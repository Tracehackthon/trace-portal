# 首页 bootstrap 与旧讨论入口：只读集成审查

- 任务：`trace-home-v1-prototype-20260914`
- 基线：`2f4377864aa353dcecb3f60005d884b11486c84e`；工作树含用户修改。
- 本次仅审查已有源码及给定拆分策略，未改 app/plugin、未启动服务、未运行浏览器或 Electron。
- 读取时旧 `apps/desktop/src/main.js` SHA256：`0D9ECFDD8D779ADB47F4B545935FDC0EA1523203EABFF4FFE9A3C3891BC2F50D`。
- 读取时旧 `apps/desktop/src/style.css` SHA256：`67BD3DBC61A825B146211C200F2D7D63D0A3F64D1E3B93A57B53AECA83819C74`。

## 结论

**保留旧模块、新 bootstrap 选择入口的方向可行，但“旧 JS 原样复制”不是全部兼容条件。**还必须保留旧 CSS、query 原值、单分支初始化和两条候选回传链路。下列结论是源码审查，不是运行通过。

### 不可丢失的入口与桥接路径

1. **Web 输入。** `TraceOverlay.tsx` 的 `continueDiscussion()` 生成 `http://127.0.0.1:4173/?from=deepseek-harness&observationId=…&text=…&status=…&source=…`，参数由 `URLSearchParams` 编码；使用具名窗口 `trace-desktop-agent` 打开。不要把 4173/127.0.0.1 随意换成相对 URL、localhost 或其他开发端口。
2. **Native 输入。** Overlay 调用 `traceNative.openDiscussion(url)` → `preload.cjs` 发 `trace-native:open-discussion` → `main.mjs` 校验发送者与 `http://127.0.0.1:4173` origin → 仅转存 `from/observationId/text/status/source`，并强制 `from=trace-native` → `loadFile(.../discussion/index.html, { query })`。**原生讨论不依赖 4173 服务。**`view` 目前不在 native 白名单中；给 `openDiscussion()` 加 `view=home` 不会打开首页。
3. **Native 返回。** 旧讨论 `window.traceNative.reportCandidate(payload)` → `discussion-preload.cjs` 发 `trace-native:discussion-candidate` → main 验证发送窗口属于 `discussionWindows`，验证 payload → Overlay 接收 `trace-native:candidate` → `preload.cjs.onCandidate()` → `TraceOverlay.tsx` 更新匹配 `observationId` 的观察项。
4. **Web 返回。** 没有 native bridge，且 `from=deepseek-harness`、`window.opener` 存在时，旧讨论向 opener 的 **`http://127.0.0.1:3080`** 发 `postMessage`；Overlay 仅接收 origin **`http://127.0.0.1:4173`** 的消息。不能用首页重定向或新增 `noopener` 意外切断 opener。
5. **消息契约。** `{ type: 'trace.desktop.candidate', observationId: <原输入 id>, status: '候选中' | '待确认' }`。有 native bridge 时优先走 bridge，不应同时 postMessage。成功证据必须落到 Overlay 中对应观察项的 status，不能只看讨论页 toast。

源码依据：`plugins/trace-harness-plugin/src/client/TraceOverlay.tsx:200–228,272–294`；`src/desktop/main.mjs:31–77,161–172`；`src/desktop/preload.cjs`；`src/desktop/discussion-preload.cjs`；旧 `apps/desktop/src/main.js:307–324`。

## 拆分策略的具体风险

- **分支优先级：**建议明确 `view=home` 优先，其次 `view=discussion` 或 `has('observationId'/'text'/'from')` 进旧讨论，其余进首页。应按参数存在性判断，不能只判断非空字符串；尤其 native 强制写入的是 `from=trace-native`，不是 `deepseek-harness`。
- **原参数不得在导入前清空或重写。**旧模块直接再次读取 `window.location.search`，依赖 5 个 query 值；`from=deepseek-harness` 还控制一次 1500 ms 的交接过渡。原生的 `from=trace-native` 本来不触发该过渡，不要把这个差异当新回归。
- **只能初始化一支。**旧模块会立即写入 `#app`、捕获 DOM 引用并注册 document 级监听。不得静态导入两支，或先初始化首页再让旧模块覆盖 DOM；应只惰性导入所选固定模块路径。
- **必须保留旧样式。**旧 JS 本身不 import CSS。旧 `style.css` 含 `:root`、`html/body/#app`、`button/textarea`、`min-width:1080px`、`overflow:hidden` 等全局规则：既不能让它污染首页，也不能用首页 CSS 替换后声称旧讨论已保留。按页面选择完整样式，且处理加载顺序/失败提示。
- **`status/source` 单独出现的兼容范围需显式决定。**旧页面可以读取这两项单独 query；给定新规则会把它们送到首页。当前 Overlay 生产者总会同时发送 from/id/text，因此不是已确认的生产链路中断，但不要宣称所有历史 query 组合完全兼容。
- **本地文件路径。**构建只复制 `apps/desktop/index.html`、`src/`、`public/` 到 `lib/desktop/discussion/`。新 bootstrap 应使用 `./discussion.js` 等相对模块路径；不要依赖 `/src/…`、开发服务器 fallback 或 artifacts 绝对路径。必须检查实际复制后的产物，而不仅是源码。

## 8 条具体回归检查（本审查未执行）

| # | 操作 | 必须观察的结果 |
| --- | --- | --- |
| 1 | 对拆分前 JS/CSS 和保存后的 `discussion.js` / 旧样式文件做 SHA256 比对 | 与上面两个旧文件哈希一致；用户现有 candidate bridge 修改、白狐入口、Mock 声明没有丢失。若非逐字节相同，逐项审查差异，不以“主要内容一样”代替。 |
| 2 | 分别打开空 query、`?view=home&from=trace-native&observationId=x`、`?view=discussion`、`?from=trace-native`、`?observationId=`、`?text=` | 前两个进首页；其余进旧讨论；只初始化对应模块。明确记录 `?status=候选中&source=x` 的预期，不默默改变路由承诺。 |
| 3 | 用 `URLSearchParams` 构造已知 id、status/source，以及含中文、`& + ? # <b>引用</b> "` 的 text，从旧 Web 入口打开 | 标题、首条消息、原始现场和来源/状态按原逻辑显示；特殊字符按文本呈现，未被二次解码或截断；from 的交接过渡仍出现一次。 |
| 4 | 在 Web Overlay 选一条已知观察继续讨论，点击“形成候选”，再点击撤回 | 向 3080 opener 回传正确 type/id/status；Overlay **同 id 的观察项**先变候选中、再变待确认。不要只检查 toast。无 opener 独立打开时不崩溃。 |
| 5 | 在未启动 4173 的环境，从真实 native Overlay 打开同一观察 | 通过 `loadFile` 打开复制后的本地旧讨论；URL 有 `from=trace-native`；旧文字、按钮、CSS 均可用，无 HTTP 依赖或模块资源错误；不是误入新首页。 |
| 6 | 在该 native 讨论窗口形成/撤回候选 | 走隔离 preload 的 `reportCandidate`，main 确认合法发送窗口，Overlay 对应观察项实际更新；无 opener 也工作，不产生重复回传。 |
| 7 | 分别在新首页与旧讨论检查样式/交互；旧页试 Enter、Shift+Enter、右侧现场关闭重开、白狐“记下它/深度思考” | 首页不继承旧 1080px 全局最小宽度；旧页保持三栏、输入发送与换行、现场重开和白狐操作。页面间不串 CSS 或遗留 document 监听。 |
| 8 | 检查构建后的 `lib/desktop/discussion/`：index、bootstrap、旧模块、各页样式和 public 资源全部存在；保留 native 安全设置/白名单并做负例 | 实际产物的相对引用可解析；`contextIsolation=true/nodeIntegration=false/sandbox=true` 未降级。错误 origin 的 openDiscussion、不属于 discussionWindows 的候选 IPC、错误 type/status 不更新 Overlay。 |

### 不应误判为本次新问题的旧行为

- 旧讨论仍是 Mock Agent；候选不是长期采用，不能把 UI 回传验收称为 runtime 持久化验收。
- Overlay 撤回时会更新 observation.status，但全局 `candidateStatus` 并不在该分支同步重置。这是读取到的既有代码行为；本次应先核对对应观察项，不顺手扩大成状态机重构。
- Native 白名单不传 `view` 是现有契约；若之后要通过 native 专门打开首页，应另行设计明确入口，而不是靠当前 openDiscussion URL 隐式实现。

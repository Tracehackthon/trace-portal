# Web 源码导入说明

日期：2026-09-15。供本仓库维护者核对导入范围与重跑检查；启动说明以[根 README](../README.md)为准。

## 导入范围

- 目标基线：`b5ec5d728fdc17a334afc11bad313155abcb316d`，保留原有 `manunl/`、`artifacts/` 与旧 ZIP。
- 来源：`trace-runtime/apps/desktop` 的已实现 Web 工作区快照，以及 `trace-runtime/tests/web-store.test.mjs`。来源包含尚未提交的 Web 改动，不能仅靠后端仓库基线 `2f4377864aa353dcecb3f60005d884b11486c84e` 重建本次内容。
- 应用进入 `apps/web`；不携带后端运行时、Electron 插件、用户数据库、测试数据库、私人协作来源或机器凭证。
- 资产、字体、vendor 和应用业务代码不重新设计；12 项固定运行资产由原锁文件逐一核验，许可证原样保留。
- [文件哈希清单](web-import.files.json)记录 74 个来源文件。68 项与复制时快照相同；6 项仅作下面的路径、包名或文档适配。

复制完成后发现来源 `src/web-main.js` 被并行修改；没有写回来源，也没有混入尚在变化的后续修改。本次提交和以下验证均针对已复制的快照。清单单独记录后来观察到的源文件哈希，不把它标成导入结果。

## 仓库适配

| 文件 | 变更 |
| --- | --- |
| `apps/web/server.mjs` | 仓库根从原布局的 `../../..` 改为 `../..`，默认 SQLite 留在本仓库，不落到上级工作区 |
| `apps/web/package.json` | 包名改为 `@trace/portal-web`；单测入口不再依赖仓库外文件 |
| `apps/web/tests/web-store.test.mjs` | 收入应用 tests，存储模块 import 改为应用内路径 |
| `apps/web/README.md` | 操作说明收口到根 README，去掉不存在的插件构建入口 |
| `apps/web/PRODUCT.md`、`DESIGN.md` | 原型与说明链接适配到本仓库；未更换视觉规范 |

根目录补充 `package.json`、依赖锁、Node 版本、忽略规则、README，以及可移植浏览器测试脚本。`.gitattributes` 保留导入应用的准确字节，避免 Windows autocrlf 改变受资产锁约束的 vendor 文件。Playwright 仅为开发测试依赖，Web 运行本身不依赖它。

## 本次验证

在导入后的本仓库执行，Node.js `22.23.1`，Windows：

| 检查 | 结果 |
| --- | --- |
| `npm run build` | 新旧入口和运行模块语法通过；不是桌面打包 |
| `npm test` | 96/96：模型、跨页面桥接、素材锁与真实 SQLite HTTP |
| `npm ci --ignore-scripts --no-audit --no-fund` | 依赖锁安装通过 |
| `npm run test:e2e` | 25/25；独立空库，浏览器 pageerror 0 |
| 从 Git 暂存区导出到空目录后重跑 | build 通过、96/96 测试、25/25 E2E；不是只验证原工作区 |
| 默认存储 smoke | 不传数据路径，确认库只创建在导出仓库内、初始为空、HTTP 不暴露数据库 |

E2E 使用已安装的兼容 Chromium，通过环境变量传入路径；没有将开发机器的路径硬编码进脚本，也未在本次下载浏览器。覆盖捕获、原表达对照、关联不采用、精确返回、理解刷新、工作快照、结果取消/确认修订、搜索返回、设置/导出、新工作版本、fresh、断网重试与多标签冲突。

本次运行证据留在本地 `.test-results/import/` 和 `.test-results/e2e/run-1789414975983/`；Git 暂存内容的独立重跑在 `.test-results/clean-checkout/.test-results/e2e/run-1789415156166/`。不提交数据库或截图。可按 README 在新空库重跑，不依赖这些本地输出。Linux/macOS、全新 Chromium 下载、远程部署、外部 AI 和桌面打包未在本次验证。

首次稀疏克隆遇到 TLS 错误，导致 checkout 不完整；随后通过 GitHub API 取回目标仓库原有 ZIP，核验其 Git blob ID `8ecf0ee2dcb236e9f728546dc0ea5af8596ca3d1`，恢复新克隆的索引。没有重写远程历史，没有删除旧资料。Node 的 SQLite 实验性 warning 保留。

初次暂存时脚本目录尚未纳入稀疏 checkout，扩充到 `apps/docs/scripts` 后完成。`git diff --check` 报告原应用/上游许可证的尾随空白和文件末尾空行；为保留快照与许可证原字节，没有在本次导入中清洗这些内容，因此不宣称 whitespace 全绿。

## 维护边界

本仓库的 Web 后续以 `apps/web` 为修改和验收入口；原开发工作区不会自动同步。原型资料仍作视觉和产品来源，不把旧原型状态误当当前 Web 实现。GitHub 源码提交不代表站点已经上线，当前服务仍只监听本机 loopback。

# Vercel 静态版部署与自动构建

面向仓库维护者。2026-09-15 用户确认首版仅在当前浏览器保存，云同步后接。

## 当前状态

- 已准备 Vercel 配置、独立构建目录和浏览器持久化适配。
- **尚未完成 Vercel 登录、项目创建/关联、Git 连接和线上验收。** 配置文件存在不代表自动部署已启用；代码推送状态以 Git 远端为准。
- 首次登录使用的 CLI 凭证无效；两次 device login 等待均结束，未取得有效凭证。宿主 C 盘已满，网页控制工具也因磁盘不足无法启动。未删除用户文件。
- 已与共享工作区的首页 UI 任务协调，当前 checkpoint 已停止写入，保留 React/Vite 整合、首页/品牌/关联摘要修正和独立预览 server。响应式仍未完成，不能把功能链通过当作完整 UI 验收。

## 两个构建目标

| 目标 | 命令 | 产物 | 保存方式 |
| --- | --- | --- | --- |
| 本机 | `npm run build` | `apps/web/dist` | 同源 Node API + SQLite |
| Vercel | `npm run build:vercel` | `apps/web/dist-vercel` | 当前 origin 的 IndexedDB |

`scripts/build-vercel.mjs` 显式设置 `VITE_TRACE_STORAGE=browser` 和 `TRACE_WEB_OUT_DIR=dist-vercel`。不要手动用浏览器模式覆盖本机 `dist`，本机预览可能直接使用该目录。

存储模式是编译时选择，API/存储出错时不会偷偷切换为空库。Vercel 不运行 `server.mjs`，不会上传 SQLite 数据，也不需要数据库密钥。部署只公开编译后的静态资源，不把源码目录作为网站根。

## 完成首次部署

前提：有 GitHub 仓库写权限；Vercel 账号可导入私有仓库 `Tracehackthon/trace-portal`。组织私有仓库能否导入取决于 Vercel 账号/团队方案与 GitHub App 授权，尚未核验；不要为了绕过限制把仓库改为公开或另建公开仓库。

1. 冻结、检查并提交所需源码（包括已有 React/Vite 整合）。不要提交 `.trace`、`.vercel`、数据库、环境文件、构建目录或测试输出。
2. 在仓库根目录执行 `vercel login`，完成网页授权。若需把 CLI 配置放在项目内，统一在以下 CLI 命令后加 `--global-config .trace/vercel-user`；此目录已被 Git/Vercel 排除。
3. 执行 `vercel link`，选择目标团队和项目 `trace-portal`。已有项目应复用，不重复创建。
4. 执行 `vercel git connect https://github.com/Tracehackthon/trace-portal.git`，在 Vercel 项目设置确认 GitHub App 可读此仓库、Production Branch 为 `main`、Root Directory 为仓库根目录。
5. 确认 Node.js 为兼容项目要求的 22.x。构建由根 `vercel.json` 管理：`npm ci` → `npm test && npm run build:vercel` → `apps/web/dist-vercel`。无需手填 `VITE_TRACE_STORAGE`。
6. 推送一个已检查的提交到 `main`，在 Vercel Deployments 核验 Git SHA、构建日志和最终 `Ready`。必要的初次 CLI 部署可用 `vercel --prod`，但它成功也不能代替验证 Git 触发。
7. 在固定正式域名中完成下方验收，记录 URL、项目 ID、Git SHA 和部署 ID，再把本文件的待完成状态更新为实测事实。

接入成功后：push `main` 触发正式构建/部署；其他分支 push 触发 Preview。仅在本地 `git commit` 不触发 Vercel。无需额外添加本地 Git hook 或长期轮询任务。

官方依据：[Git 自动部署](https://vercel.com/docs/git)、[Git 构建开关](https://vercel.com/docs/project-configuration/git-configuration)、[SQLite 的平台限制](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)。

## 验证与故障恢复

仓库根目录：

```sh
npm test
npm run build:vercel
npx playwright install chromium
npm run test:browser-storage
```

已有兼容 Chromium 时可用 `TRACE_CHROMIUM_EXECUTABLE` 指定路径，不必重复安装。宿主临时盘已满时，先将当前终端的 `TEMP`/`TMP` 指向有空间的目录再运行测试；不要为测试自动清理用户目录。

浏览器测试以纯静态服务启动独立 origin，不启动 API、不访问真实用户库。覆盖创建/刷新/理解/工作结果/导出、同 origin 多标签 CAS 冲突与恢复、失败重试、幂等重放、并发提交、不同浏览器隔离、损坏不清空及没有 `/api` 网络请求。结果位于 `.test-results/browser-storage/run-*/results.json`，首次失败与修复后重跑记录都保留。

本次本地验证：

- Vercel 构建与 TypeScript 检查通过，日志 `.test-results/vercel-build.log`。
- 单元/SQLite：首次受 C 盘满影响，84/96 通过；切换 D 盘临时目录后重试 96/96 通过，日志 `.test-results/unit-tests.log`。
- 浏览器静态版：初次因缺少 Playwright 自带 Chromium 未运行，改用现有 Chrome。两次测试选择器修正后暴露“显式恢复后首页保留旧输入”的真实问题，已用 runtime recoveryGeneration 修复；最终 19/19 通过，证据 `.test-results/browser-storage/run-1789432281356/results.json`，无 pageerror、无 API 请求。
- 本机 SQLite 完整产品链：使用独立 `.test-results/sqlite-deploy-check/dist` 和测试库，25/25 通过，证据 `.test-results/e2e/run-1789432309265/results.json`。未覆盖正常 `dist`，未重启用户 4173 或另一任务 4191。
- 全工作区 `git diff --check` 仍报告既有 UI 文件行尾空白；部署配置相关差异检查通过，未顺手改写另一任务的 UI 文件。
- 线上 URL、实际 Vercel 构建和 push 自动触发均未验证。

线上验收：打开正式 URL → 新建事项 → 刷新保留 → 保存理解 → 工作结果 → 设置中导出；Network 不应发出 `/api/web/*` 请求。另开同 origin 标签页验证冲突不会静默覆盖。核验深链接回到同一件事，静态资源返回正确 MIME，未知 API 不被 SPA fallback 假装返回 HTML。

**数据边界：** 数据属于同一浏览器配置下的同一 origin；Preview URL、正式 URL、自定义域名彼此隔离。清除网站数据、隐私窗口关闭或浏览器存储回收可能丢失内容。建议固定使用正式域名并定期导出；当前未实现云备份或导入/迁移 UI。导出的文件必须自行保管。

代码回滚可以在 Vercel 选择上一成功部署，也可以 revert 后 push；不会恢复已删除的浏览器数据。浏览器库采用固定名称 `trace-portal-workspace-v1`，不要通过改库名或清空站点数据掩盖异常。后续破坏性数据结构变更需另设计迁移和回退路径。

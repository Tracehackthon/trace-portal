# Vercel 静态版部署与自动构建

面向仓库维护者。2026-09-15 用户确认首版仅在当前浏览器保存，云同步后接。

## 当前状态

- 正式站已上线：[https://trace-portal.vercel.app](https://trace-portal.vercel.app)。首次 CLI 部署 `dpl_5iJPTyBKDWVTdZmvFxyZd4w9U4WP` 为 `READY`，源码基线 `3883615740b6fab92698fad664c32fa7fba87ea3`；部署元数据 `gitDirty=1` 仅来自 CLI 追加重复 `.vercel` ignore 条目，已去重。不可变地址为 [首次部署](https://trace-portal-pk3x8nthb-neutronm.vercel.app)。
- 项目 `neutronm/trace-portal`：`prj_BeLXiPAMHdb3ySclLDNPMt3Q1DkO`，团队 `team_4VYYDNxIFVhktqZCeuvO4End`，Hobby 免费方案；未升级、付费或公开源码仓库。
- 原生 Git 关联实际返回 HTTP 400 `repo_not_found`；Vercel 集成当前看不到此组织私库。此外官方明确 Hobby 不支持 GitHub 组织私库直连。采用官方支持的 GitHub Actions + CLI prebuilt 路径，不伪造 Git 来源；`vercel.json` 中关闭原生 Git 自动部署，避免未来重复触发。
- 工作流和仓库 Secret 名称已配置；**首次真实 push 自动部署验收待运行，不能把首次 CLI 成功当作自动部署通过。**
- CLI 登录现已成功。早期两次 device login 未完成，且 C 盘满曾阻断网页工具；本轮未删除用户文件。CLI 登录 Token 是短期 OAuth 凭证，不复制进 CI。
- 已与共享工作区的首页 UI 任务协调，当前 checkpoint 已停止写入，保留 React/Vite 整合、首页/品牌/关联摘要修正和独立预览 server。响应式仍未完成，不能把功能链通过当作完整 UI 验收。

## 两个构建目标

| 目标 | 命令 | 产物 | 保存方式 |
| --- | --- | --- | --- |
| 本机 | `npm run build` | `apps/web/dist` | 同源 Node API + SQLite |
| Vercel | `npm run build:vercel` | `apps/web/dist-vercel` | 当前 origin 的 IndexedDB |

`scripts/build-vercel.mjs` 显式设置 `VITE_TRACE_STORAGE=browser` 和 `TRACE_WEB_OUT_DIR=dist-vercel`。不要手动用浏览器模式覆盖本机 `dist`，本机预览可能直接使用该目录。

存储模式是编译时选择，API/存储出错时不会偷偷切换为空库。Vercel 不运行 `server.mjs`，不会上传 SQLite 数据，也不需要数据库密钥。部署只公开编译后的静态资源，不把源码目录作为网站根。

## 自动构建与部署

唯一入口是 [`.github/workflows/vercel.yml`](../.github/workflows/vercel.yml)。push 任意分支自动运行；`main` 发布 Production，其余分支发布 Preview；可在 Actions 手动触发 `workflow_dispatch`。仅本地 `git commit` 不触发。

流程：固定 SHA 的 checkout/setup-node → Node `.node-version` → 固定 Vercel CLI 59.17.0 → `vercel pull` → `vercel build`（依照 `vercel.json` 执行 `npm ci`、96 项测试、TypeScript/Vite）→ 19 项浏览器存储检查 → 核验当前分支头 → `vercel deploy --prebuilt`。构建一次，只把验证后的产物上传；无 `pull_request_target`，GitHub token 仅 `contents: read`。

同分支串行运行，不取消可能正在发布的任务。若排队期间已有新提交，旧构建可通过但不会替代新版本。部署 URL 和 Git SHA 写入每次 Actions 的 Job Summary。Preview 地址不能当作固定正式数据入口。

仓库 Actions Secrets：

- `VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`：已配置上述项目 ID。
- `VERCEL_TOKEN`：专用持续部署凭证。用户实际创建名为 `TRACEPORTAL` 的 Secret，工作流兼容 `secrets.VERCEL_TOKEN || secrets.TRACEPORTAL`；不读取、打印或提交 Secret 值。Token 的范围与有效期由 Vercel 管理，过期/撤销后需在 GitHub Secret 中更新。

目前采用的项目根是仓库根目录，输出 `apps/web/dist-vercel`。根 `package.json` 的 Node 范围固定为 `22.x`，避免原来的 `>=22.23.1` 自动选用新 major（首次云端部署实际使用 24.x，虽通过测试，但不应漂移）。无需另外手填 `VITE_TRACE_STORAGE`。

手动故障恢复可在仓库根使用 `vercel pull --yes --environment=production`、`vercel build --prod`、`vercel deploy --prebuilt --prod`；本机 CLI 统一追加 `--scope neutronm --global-config .trace/vercel-user`。不要在其他任务使用的共享依赖目录随意执行会重装依赖的构建；优先隔离 checkout 或 CI。

官方依据：[Hobby/Git 限制](https://vercel.com/docs/git)、[GitHub Actions + prebuilt](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel)、[SQLite 的平台限制](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)。

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
- 首次 Vercel 云端构建已实测 `npm ci`、96/96 测试、TypeScript/Vite 通过；日志 `.test-results/vercel-first-deploy.log`。
- 另一首页任务独立完成真实公网 10/10 验收：空库、创建事项、刷新/深链、理解 v1、工作结果不自动改理解、设置边界、真实导出、无 API 请求、无页面错误/失败资源。使用一次性浏览器配置，不触用户数据；证据位于父工作区 `artifacts/trace-web-ui-renovation-20260915/root-public/results.json` 及同目录截图、回放脚本。
- Actions push 自动触发、CI 凭证权限与 prebuilt 部署仍待本次提交后实测。

线上验收：打开正式 URL → 新建事项 → 刷新保留 → 保存理解 → 工作结果 → 设置中导出；Network 不应发出 `/api/web/*` 请求。另开同 origin 标签页验证冲突不会静默覆盖。核验深链接回到同一件事，静态资源返回正确 MIME，未知 API 不被 SPA fallback 假装返回 HTML。

**数据边界：** 数据属于同一浏览器配置下的同一 origin；Preview URL、正式 URL、自定义域名彼此隔离。清除网站数据、隐私窗口关闭或浏览器存储回收可能丢失内容。建议固定使用正式域名并定期导出；当前未实现云备份或导入/迁移 UI。导出的文件必须自行保管。

代码回滚可以在 Vercel 选择上一成功部署，也可以 revert 后 push；不会恢复已删除的浏览器数据。浏览器库采用固定名称 `trace-portal-workspace-v1`，不要通过改库名或清空站点数据掩盖异常。后续破坏性数据结构变更需另设计迁移和回退路径。

# Trace Portal

Trace 的本机 Web：围绕同一件仍在变化的事，留下一点、接着想、找对照、保存理解、带去用，再让结果回来。

**当前可运行入口是 `apps/web`，不是根目录旧 ZIP，也不是 `artifacts` 中的单页原型。** 既有原型和资料原样保留；Web 复用已确认的背景、鸟、字体与组件，不重新生成视觉资产。

## 启动

使用 **Node.js 22.23.1 或更新的兼容版本**（已实测 22.23.1）。运行时只依赖 Node 内置模块；启动无需安装第三方包。

```sh
git clone https://github.com/Tracehackthon/trace-portal.git
cd trace-portal
npm start
```

打开 [本机首页](http://127.0.0.1:4173/?view=home)。保持终端运行，使用 `Ctrl+C` 停止服务。`node:sqlite` 的实验性警告不等于启动失败。

## 现在可以做什么

- 首页创建真实事项，刷新后仍能继续；空库不灌入示例内容。
- 选原表达找对照、手工粘贴材料、建立关联；关联不会自动成为“我的理解”。
- 明确保存理解，确认带去用，保留这次工作带入的理解版本。
- 保存实际结果，取消或确认理解修订；旧工作快照不被新理解覆盖。
- 搜索、全部痕迹、工作列表打开同一对象，返回保留查询和筛选。
- 修改本机称呼、减少动效、查看保存位置、导出数据。

**边界：** 当前是本机、手工内容闭环。自动模型回复、联网材料搜索、外部 Agent 真正执行、账号和云同步尚未接入；桌面打包后置。它不是可以直接公开为多用户服务的后端，也不是纯静态网站，不能只用 GitHub Pages 承载当前持久化接口。

## 数据与配置

- 默认只监听 `127.0.0.1:4173`。
- 首次运行创建仓库内 `.trace/state/web.sqlite`。不会读取或迁移其它仓库的数据。
- 数据库、导出和测试输出不应提交；`.gitignore` 已排除数据库、环境文件和测试产物。
- 支持 `TRACE_DESKTOP_PORT`（保留原兼容名称）和 `TRACE_WEB_STATE_FILE`。后者建议使用绝对路径；没有自动读取 `.env`。
- 多标签保存使用 revision 检查，冲突拒绝静默覆盖；保存失败时可重试或导出未确认内容。
- 备份数据库前先停止服务。当前历史修订没有自动压缩。

PowerShell 自定义示例：

```powershell
$env:TRACE_DESKTOP_PORT = '4174'
$env:TRACE_WEB_STATE_FILE = Join-Path (Get-Location) '.trace/state/another-workspace.sqlite'
npm start
```

## 验证

```sh
npm run build
npm test
```

`build` 是源码语法检查，不生成桌面安装包。单元与真实 SQLite HTTP 测试共 96 项。

浏览器回归需要开发依赖与 Chromium：

```sh
npm ci
npx playwright install chromium
npm run test:e2e
```

E2E 在 `4182` 启动独立服务，每次使用 `.test-results/e2e/run-*/web.sqlite`，不向正常 `4173` 写入。端口占用会失败，不复用未知服务。可用 `TRACE_TEST_PORT` 改测试端口，`TRACE_CHROMIUM_EXECUTABLE` 指定已有兼容 Chromium；不设置时使用 Playwright 安装的浏览器。截图与断言写在同次测试目录，结束后停止测试服务。

## 目录与维护

| 位置 | 用途 |
| --- | --- |
| [apps/web](apps/web/) | 实际 Web、服务端、单测与可直接使用的素材 |
| [产品边界](apps/web/PRODUCT.md) | 当前已接入功能与未接能力 |
| [视觉规范](apps/web/DESIGN.md) | 沿用的页面、字体和交互规则 |
| [资产锁](apps/web/approved-assets.lock.json) | 12 项固定运行资产的 SHA-256、来源与许可线索 |
| [导入说明](docs/web-import.md) | 本次源代码范围、路径适配和验证 |
| `scripts/product-e2e.cjs` | 浏览器完整链路回归 |
| `manunl/`、`artifacts/` | 已存在的产品原型与生产资料，不是运行时数据库 |

字体与 vendor 许可随文件保留。生成图是项目素材，不能因组件采用 MIT/OFL 就将整套图片也声明为这些许可证。修改运行资产前先核对来源，不得仅为消除测试失败而更新锁文件。

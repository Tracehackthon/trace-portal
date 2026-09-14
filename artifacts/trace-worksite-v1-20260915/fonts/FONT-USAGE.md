# 工作现场固定文案字体

本批复用首页已从官方仓库下载并核验的完整 OFL 原件，在本任务目录另做固定文案 WOFF2 子集。未联网重下、未全局安装、未改 app。确切来源 commit、Git blob 身份、版本、原件及派生 SHA-256、字体元数据见 `manifest.json`。

## 文件与用途

| 派生字体 | CSS 家族 | 用途 |
| --- | --- | --- |
| `derived/TraceWorksiteSerif-fixed.woff2` | `Trace Worksite Serif` | 项目任务标题、主理解、发现及比较标题；原件 Source Han Serif CN，变量字重 250–900 |
| `derived/TraceWorksiteSans-fixed.woff2` | `Trace Worksite Sans` | 按钮、说明、正文与元信息；原件 Noto Sans SC，变量字重 100–900 |

`derived/font-face.css` 只定义本地 `@font-face`，不改 body/:root 或 app 选择器。每个分发字体旁保留对应 `OFL-*.txt`。版权、作者、商标及 OFL name 表项保留；派生的 family/full/PostScript/instance 名称改成 Trace Worksite，避免沿用声明的保留名 `Source`。

建议标题使用 600 字重，正文 400，按钮 500/600。实际选择仍由五张参考的排版与真实渲染校准，不把这份建议当成视觉验收。

```css
.worksite-root {
  font-family: "Trace Worksite Sans", "Microsoft YaHei", "PingFang SC", sans-serif;
}
.worksite-root .worksite-title {
  font-family: "Trace Worksite Serif", "Songti SC", SimSun, serif;
  font-weight: 600;
}
```

## 覆盖与重放

- 本次最终 copy SHA-256：`6F696241FF8CE31FC7752D6BDD294D1EFE89111A9B3DDA73C856DBFE7A2529D5`；覆盖 465 个可见字符（含基本 ASCII/空格），两字体缺字 0。Serif 191,992 B，Sans 144,176 B。
- 第一版按初始 UI copy 覆盖 413 字；在 UI 合入 model/fixture/notice 文案后正常补至 465 字，不是缺字失败后隐瞒重试。最终 browser-check 已随新字体重跑，旧结果不作为当前验收。
- 固定文案唯一输入为相邻 `../ui/copy.txt`；构建时另保存 `fixed-copy-snapshot.txt`。
- 覆盖其非空白字符，加基本 ASCII、空格、NBSP、全角空格。manifest 记录当时 copy hash 与字符数。
- 动态中文和任意用户文本 **不保证** 包含在子集中，必须保留平台中文系统字体回退。仓库中完整官方源也不是全部 Unicode。
- 原图中的错误/不一致字样以 UI owner 核对后的 DOM copy 为准；不把生成图文字直接贴成位图。

从 `D:\AGeneral Workspace\AI-powered\harness` 执行：

```powershell
python artifacts/trace-worksite-v1-20260915/fonts/prepare_fonts.py
python artifacts/trace-worksite-v1-20260915/fonts/prepare_fonts.py --verify-only
node artifacts/trace-worksite-v1-20260915/fonts/check-fonts.cjs
```

首命令在本目录复制已下载的同 hash 原件与许可，验证固定官方 Git blob，构建改名子集，保留上游署名，输出 cmap/字形/轴检查报告。后命令只读核验原件/派生/许可、当前 copy hash、五图/README/提示词/清单 hash，不写文件。copy 变化时 verify 会明确失败，需要重建，不能继续用过期“全覆盖”结论。

Python/fontTools/Brotli 均使用现场已有安装。没有全局字体或依赖安装，没有修改旧任务产物。

## 未运行与限制

本 owner 另外运行了隔离 Chromium 的 `file://` 字体样本检查：两个字体 face 均 loaded，无控制台错误，无 HTTP 请求，样本截图为 `font-check.png`，报告 `browser-check.json` 绑定确切字体 SHA-256。样本已亲看，中文和拉丁可读，衬线/无衬线角色区分明确。该脚本使用现场已存在的 Playwright 与独立 Chromium，不使用用户 profile，并在结束关闭自己的 browser。

这是独立字体加载/样本检查，不是 app 的字体采用、完整 shaping、中文断行、宽窄窗/缩放、动态回退、Electron 或最终视觉验收。后续字体重建会使旧 browser-check 的 hash 过期；必须重跑检查，不能沿用旧结论。实际场景文字密度和 DOM 字体采用仍由 UI/整合阶段另记证据。

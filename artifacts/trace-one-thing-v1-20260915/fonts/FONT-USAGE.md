# Trace Chain 字体资源

任务 `trace-one-thing-v1-20260915`；上下文包 SHA256 `5419BAC2804EB001F853B968060478429AA5AFCE08F1ACECEFA14F64E4B3E562`；HEAD 基线 `2f4377864aa353dcecb3f60005d884b11486c84e`。

沿用本地此前已从官方固定 commit 获取、核对 Git blob 与 SHA256 的完整 OFL 原字体，不新增网络下载、不装系统字体、不搬组件整仓。

| 角色 | 原始字体 | 本次派生家族/文件 | 字重范围 |
| --- | --- | --- | --- |
| 标题、主要节标题、示例正文的衬线层次 | Source Han Serif CN VF 2.003 | `Trace Chain Serif` / `derived/TraceChainSerif-fixed.woff2` | 250—900 |
| 说明、输入、按钮、元信息、Trace 字标 | Noto Sans SC 2.004 | `Trace Chain Sans` / `derived/TraceChainSans-fixed.woff2` | 100—900 |

这是按 11 张图选择的可用字体组合，不声称识别了图中真正字体。CSS 显式选择正文 400、强调 500/600；上游可变轴默认分别为 250/100，未改称默认 Regular。真实字号、行宽、字重、换行仍由 UI 对图校验。

## 覆盖和来源

`prepare_fonts.py` 从 `ui/copy.txt`、本套《看图说明》整理字符；存在 `model/sample-view.json` / `model/fixed-copy.txt` 时一并纳入，另纳入 `model/chain-model.mjs` 的固定提示字符，并补 ASCII、中文标点与基本箭头。实际本次输入哈希、字符数和 cmap 覆盖在 `manifest.json`，`fixed-copy.txt` 是构建快照。每个所需可见码点对两种派生字体均实际核验，不把生成文件当成字体覆盖证明。

首次仅按 UI/说明构建的 603 码点候选保留在 `candidates/initial-ui-only/`，不是失败。Model 输出生成后再合并全套 fixture/提示文案补集，最终应只整合 `derived/`；不要把早期候选错认成最后版本。

中间版本检查：**640 个可见码点，两字体均无缺字**；Serif 250592 字节、Sans 189976 字节；该修订下 `--refresh-copy` 与 `--verify-only` 均通过。随后 UI 完整实现文案与 model 提示增加了 6 个原子集不含的字“况命址多物返”；最后一次快速 refresh 明确失败并要求重建，没有沿用“640 已覆盖”的旧结论。中间版本保留在 `candidates/model-fixture-640/`，失败与后续完整补集结果记录在 `validation-history.json` 及 manifest。最终只使用 `derived/`，当前覆盖以 manifest 中输入哈希为准。

**最后补集结果：646 个可见码点，两字体均无缺字；Serif 252444 字节，Sans 191652 字节。** 由完整官方原件重建后，`--verify-only` 再次通过，构建与复验期间最终 UI/model 文案哈希未变。最后快速 refresh 失败、完整补集重试通过分别保留，不称为首次一遍通过。

这份子集只保证快照内固定文案。UI 新增固定文案必须更新 `copy.txt` 后重建；任意用户输入、生僻字、其他语言和 emoji **不保证**在子集内，必须有系统 fallback。示例：

```css
/* @font-face 在 derived/font-face.css，整合时换成实际本地打包 URL。 */
.chain-display {
  font-family: 'Trace Chain Serif', 'Noto Serif CJK SC', 'Songti SC', SimSun, serif;
  font-synthesis: none;
}
.chain-ui {
  font-family: 'Trace Chain Sans', 'Noto Sans CJK SC', 'Microsoft YaHei', 'PingFang SC', sans-serif;
  font-synthesis: none;
}
```

`font-display: swap` 避免长期不可见。截图等待 `document.fonts.ready` 后还要核验真实字体命中；仅声明 family 不等于已用该字体。不要添加 Google Fonts 在线 CSS 或 CDN。原始完整字体放 `originals/` 供追溯与后续子集重建，不要求把 28 MB 原件全打进应用；本次默认派生字体配系统 fallback。

## 许可与派生身份

原件从此前 `trace-home-v1-20260914/fonts/originals/` 逐字节复制，并重新核对原始 SHA256 与锁定 Git blob SHA1；原始仓库 URL、固定 commit、官方许可、版本和历史下载失败完整保留在 `originals/previous-font-provenance.json`，本任务 manifest 也附相应来源数据。

两个实际 OFL 原许可都保留名称 `Source`。本次子集全部改用 `Trace Chain Serif` / `Trace Chain Sans` 主家族、full name、PostScript 和 instance 命名；保留原始版权、作者、商标、许可/URL、字重子家族及变量轴。派生变化仅字符子集、WOFF2 编码、命名及确定性时间戳。

必须随派生字体打包 `derived/OFL-source-han-serif-cn.txt` 和 `derived/OFL-noto-sans-sc.txt`。仍按 OFL 1.1 分发字体，不能单独售卖字体，不代表官方作者为应用背书。字体许可不要求整个应用采用 OFL。

## 离线重建 / 复验

```powershell
python 'D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-one-thing-v1-20260915\fonts\prepare_fonts.py'
python 'D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-one-thing-v1-20260915\fonts\prepare_fonts.py' --verify-only
```

如果只是代码或文案哈希改变、现有子集已经覆盖所有新字符，可以运行 `--refresh-copy`：先重新核对现有字体 cmap，再更新文案快照与 manifest，字体字节不变；缺任何字符会失败并要求完整重建。它不会以“只是代码变化”为由跳过字符验证。

使用已有 Python / FontTools / Brotli，未安装新包。构建只写本任务 fonts；原字体、其他任务与 app 不修改。`--verify-only` 不重写字体，检查本次文案哈希（变化会要求重建）、原始与派生哈希、派生 cmap、家族与保留元数据。参数不提供网络下载 fallback。

原始字体历史下载曾有 TLS/传输截断重试，记录属于此前准备阶段；本次无下载。当前执行结果与任何失败/复跑记录以 manifest 为准。

未验收：实际浏览器与原生 file:// 的加载、字形命中、长输入排版、跨平台 fallback、视觉贴合。字符 cmap 检查通过不等于这几项通过；整合 owner 需补真实渲染验证。

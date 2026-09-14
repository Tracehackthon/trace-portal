# Trace 首页字体资源使用说明

面向后续整合字体的 Agent / 前端维护者。本目录只准备资源，不修改桌面首页、原生插件、构建配置或系统字体。

- 任务：`trace-home-v1-assets-20260914`
- 上下文包 SHA256：`FEC12772D27033E54E9EDB811486DE7C749DB5AFF054BF1BA3DE06628DC00CD7`
- Git 基线：`2f4377864aa353dcecb3f60005d884b11486c84e`，不代表工作树干净。
- 唯一视觉依据：上下文包中的 `Trace首页交互状态_v1` 六图；不是旧的单张首页概念图。
- 字体具体版本、实际字节数、SHA256、Git blob SHA1、不可变下载 URL 及解析报告以 `manifest.json` 为准。

## 采用与分工

只准备一套主用组合：

| 角色 | 官方原件 | 固定文案派生字体 | 初始试排值 |
| --- | --- | --- | --- |
| 主标题、气泡标题、思考分组标题 | Source Han Serif CN 可变字体，官方简中字符集、TrueType-flavored WOFF2 | `Trace Home Serif` | `500` 与 `600` 对图比较，片段暂用 `600` |
| 输入、按钮、说明、中英文元信息、Trace 字标 | Noto Sans SC 可变 TTF | `Trace Home Sans` | 正文 `400`；需要强调时试 `500` |

这是一套待对图排版核验的匹配资源，**不声称识别出了原图字体**。新六图的 Trace 字标是无衬线，不继承旧单图的衬线字标。字号、字距、行高和具体字重仍须由主 Agent 在真实页面中确认。

## 文件与离线加载

```text
fonts/
  originals/source-han-serif-cn/   官方原始 WOFF2 与 LICENSE.txt，不修改
  originals/noto-sans-sc/          官方原始 TTF 与 OFL.txt，不修改
  derived/TraceHomeSerif-fixed.woff2
  derived/TraceHomeSans-fixed.woff2
  derived/font-face.css           固定文案 @font-face + 可选角色类
  derived/font-face-full-fallback.css  可选完整原件 fallback
  derived/OFL-*.txt               两份官方许可的逐字节副本，随子集打包
  fixed-copy.json                 六图人工核对文案与基本 Latin/标点补充
  prepare_fonts.py                固定来源下载、派生、检查与离线复验
  manifest.json                  来源、许可、哈希、体积、字形覆盖与验证边界
```

1. 将字体及许可作为本地资源一并打包；不要引入 Google Fonts 在线 CSS、CDN 或系统字体安装步骤。
2. `derived/font-face.css` 的 URL 相对这份 CSS；复制到应用时保持相对布局或显式改成实际构建路径。当前片段没有全局 `body` 或 reset 规则，不会自动覆盖现有 UI。
3. `font-face.css` 只引用两个固定文案子集。真实 DOM 文字、输入和按钮应继续使用字体，不烘焙进背景。
4. 动态内容若需要随包字符覆盖，**显式同时加载** `font-face-full-fallback.css` 并保留对应 `originals/` 字体。它将同一原件注册为 `Trace Home Serif Full` / `Trace Home Sans Full` 这两个 CSS 别名，不修改原始字体家族或版权。
5. 不加载完整 fallback 时，子集缺字会落到 CSS 中的系统字体。系统未安装相关字体时由浏览器继续 fallback；不同平台的字形与行宽可能变化，不能把它当成视觉一致性保障。
6. 原件虽保留较完整的简中字符集，也不是全部 Unicode。生僻字、emoji、其他语言仍须最终兜底；子集不可代表任意用户输入已覆盖。

片段使用 `font-display: swap` 防止长期不可见文本。截图验收必须等待相关字体加载完成后再取图；`document.fonts.ready` 只能作为加载同步条件，不能替代逐字检查字体是否真实命中。`file://` / 原生 WebView 的路径、权限与字体加载行为须实际测试，本资源准备未做该测试。

## 子集边界与许可处理

- `fixed-copy.json` 按六图整理可见固定文案，包含分镜的静止/唤醒/进入/落下标签，仅用于字符覆盖，不主张把分镜编号加入真实 UI。
- 两个派生字体都覆盖完整固定文案，而不是各自只含标题或按钮字。额外保留基础 ASCII、中文标点和箭头。代码级检查对每个所需可见码点检查 Unicode cmap，不以“文件生成了”当成字形覆盖通过。
- 派生字体保留可变字重轴；CSS 字重范围从真实字体轴元数据生成，没有伪造静态字重。
- 本次实际下载的思源宋体与 Noto Sans SC 官方 OFL 文件**都声明保留名称 `Source`**，不能凭字体叫 Noto 就假定不存在保留名称。派生字体分别改用 `Trace Home Serif` / `Trace Home Sans`，避免和官方原件混淆。家族、full name、PostScript / instance 名称按脚本改名；原有子家族名、默认字重、官方版权、作者、商标和许可元数据保留并核对。默认轴值分别为 250 / 100，不伪称原件默认就是 Regular 400；CSS 明确选择显示用字重。
- 派生字体仍按 OFL 1.1 分发，原始许可与版权文本必须同行。应用本身不因嵌入字体而必须变成 OFL；不得把字体文件单独售卖，不声称字体原作者为 Trace 背书。
- 官方原件与派生资源分开放置。原件已锁定 commit 及 Git blob 身份；重新生成不会覆盖 app、plugin 或其他 worker 的目录。

官方来源与工具：

- [思源宋体官方仓库](https://github.com/adobe-fonts/source-han-serif)
- [思源宋体许可](https://github.com/adobe-fonts/source-han-serif/blob/master/LICENSE.txt)
- [Noto Sans SC 官方目录与文件](https://github.com/google/fonts/tree/main/ofl/notosanssc)
- [Noto Sans SC 许可](https://github.com/google/fonts/blob/main/ofl/notosanssc/OFL.txt)
- [FontTools 子集文档](https://fonttools.readthedocs.io/en/stable/subset/)

## 重放与验证

前提：本次使用已有 Python 3.11、FontTools 4.63.0 与 Brotli。未全局安装任何包。若换环境，先核验版本；不同压缩库版本的 WOFF2 字节结果可能变化。

从已有原件重建；缺少原件时才从已锁定的官方 GitHub API 下载：

```powershell
python 'D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\fonts\prepare_fonts.py'
```

离线复验（不下载、不重写派生文件）：重新核对原件和许可哈希，原件完整解析结果以同一哈希关联本次构建报告；对子集重新解析并检查固定文案覆盖与主要家族名。不会每次重复解压十余 MB 的原件。

```powershell
python 'D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\fonts\prepare_fonts.py' --verify-only
```

脚本首先核验上下文包及六张参考图哈希，再核验官方 Git blob、字体和许可 SHA256、字体 metadata / cmap / variable axes / TrueType glyph table、固定文案覆盖、派生字体版权保留。原件下载曾在 `raw.githubusercontent.com` TLS 握手时失败；已转官方 GitHub API，未关闭证书校验。Noto 的大体积 Git Blob JSON 响应随后传输中断；Contents raw 响应也曾提前结束，被字节数 / Git blob 校验抓出。确认官方 API 返回精确 HTTP 206 / Content-Range 后补齐其余字节，完整文件再次校验通过。重放脚本现在用最多 4 MiB 的分段传输并支持 `.part` 续传；最终 Git blob 不一致不会提升为正式原件。重试与最终状态见 `manifest.json`，不称为首次网络下载即成功。

**未运行：**真实浏览器 / 原生 WebView 排版、离线 `file://` 加载、实际字重视觉选择、中文换行对齐、跨平台 fallback、屏幕截图对图。元数据检查通过不等于排版验收通过。

## 整合后需要确认

- 六图文案在实际视口下不缺字、不溢出，标题和气泡没有意外换行。
- 浏览器检查实际渲染字体；不要只看 CSS 声明。
- 改固定文案后同步更新 `fixed-copy.json`，重新生成并复验。
- 输入一段不在固定文案中的中文及 emoji，确认 fallback 可见且布局可用。
- 断网启动真实打包产物，确认 CSS 与字体资源一起复制且加载成功；不依赖开发服务器替代该验收。

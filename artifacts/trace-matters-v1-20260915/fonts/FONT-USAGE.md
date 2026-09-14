# 在意的事 v1：固定文案字体

给应用整合者使用。本批仅为七张新参考图与场景固定文案扩展字体子集；不换审美方向，不安装系统字体，不改旧首页字体。

任务 `trace-matters-v1-20260915`；基线 HEAD `2f4377864aa353dcecb3f60005d884b11486c84e`；context-package SHA256 `BDF5906EC3208A9C254499C5082E5E689971A7547BCC9A1A303BA5F28FA45068`。

## 交付与来源

- 标题：`derived/TraceMattersSerif-fixed.woff2`，族名 **Trace Matters Serif**，源为思源宋体 CN VF。
- UI：`derived/TraceMattersSans-fixed.woff2`，族名 **Trace Matters Sans**，源为 Noto Sans SC。
- `derived/font-face.css` 可复制；相对 URL 以该 CSS 所在目录解析。只声明字体，不修改 body 或其他页面选择器。
- `derived/OFL-source-han-serif-cn.txt` 和 `derived/OFL-noto-sans-sc.txt` 打包时必须随附。
- 精确字形覆盖清单在 `copy-codepoints.json`；逐图固定文案在 `fixed-copy.json`；实际字重、大小、SHA256、cmap 与字形表验证在 `manifest.json`。

最终实测：两字体均覆盖 **473 个必需码点，缺字 0**；Serif **195,532 bytes**、`wght 250–900`，Sans **146,468 bytes**、`wght 100–900`。在 `scene-copy-audit.json` 所记录的场景源码快照中，全部非 ASCII 字符（含固定操作与可访问性标签）都已覆盖；源码后来新增文字时需重新审计。这仍不代表动态用户内容覆盖。

完整字体没有重下或复制，仍位于上一批 `artifacts/trace-home-v1-20260914/fonts/originals/`。`originals/references.json` 指向这些原件并保留其官方 URL、commit、版本与哈希。它是引用清单，不是字体字节包。

两份官方 OFL 均包含保留字体名 `Source`。派生字体已改为新的 Trace Matters 字族名；版权、作者、商标说明、许可及许可 URL 元数据保持原样。原始字体未改名、未改字节。不将子集描述成官方原版字体。

## 离线接入与动态内容

```css
/* 同目录放置新 WOFF2 与 OFL，复制 font-face.css 的两个声明。 */
.matters-display {
  font-family: "Trace Matters Serif", "Noto Serif CJK SC", "Songti SC", SimSun, serif;
  font-weight: 600;
  font-synthesis: none;
}
.matters-ui {
  font-family: "Trace Matters Sans", "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", sans-serif;
  font-weight: 400;
  font-synthesis: none;
}
```

这两个子集只覆盖七图、场景 worker 给出的固定词和模型示例 fixture 中的字。**不覆盖任意用户中文输入。** 缺字会使用系统 fallback，字体风格、字宽、换行可能变化；这不是完整中文字体。

若后续要求离线动态中文也保持统一，需显式打包上一批保留的完整官方字体，并设计 full-font fallback。原始 CN 字库也不是全 Unicode；不能承诺所有生僻字、其他书写系统或 emoji 都一致。不要从 CDN 临时拉字体来掩盖缺字。

## 复跑与验证边界

无需联网、无需 pip/npm 安装。脚本复用上一批已核验 SHA256 的 FontTools 子集与改名函数，不调用下载函数，写入只限本 fonts 目录。

```powershell
& 'C:\Users\HoSheil\AppData\Local\Programs\Python\Python311\python.exe' 'artifacts\trace-matters-v1-20260915\fonts\prepare_fonts.py'
& 'C:\Users\HoSheil\AppData\Local\Programs\Python\Python311\python.exe' 'artifacts\trace-matters-v1-20260915\fonts\prepare_fonts.py' --verify-only
```

脚本先核验新 context-package、七图、旧 helper/manifest、原字体和许可，再生成新命名字体。新子集实际重新解析 cmap、名称、variable axes 与 TrueType 字形表并查缺字；完整原字库的元数据报告通过原 SHA256 复用，不谎称本轮再次全面排版检查。

**未运行：**浏览器 shaping、实际字重对照、中文断行、动态 fallback、Electron `file://` 与最终视觉排版验收。这些需要在应用接入后由主 Agent 检查。

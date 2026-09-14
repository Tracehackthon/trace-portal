# 结果回来固定文案：复用 base + 小字形补丁

不重新造一套完整字体，不改旧字体。固定文案来源为 `../../ui/copy.json`；本次初始 corpus 为 412 个 Unicode codepoints（包括 ASCII/共用标点补充）。所有 5 套既有字体都已实际读取 cmap，详见 `existing-coverage.json`。

## 接入

- `serifUrl`：`artifacts/trace-one-thing-v1-20260915/fonts/derived/TraceChainSerif-fixed.woff2`
- `sansUrl`：`artifacts/trace-one-thing-v1-20260915/fonts/derived/TraceChainSans-fixed.woff2`
- optional `serifDeltaUrl`：本目录 `TraceResultReturnSerif-delta.woff2`
- optional `sansDeltaUrl`：本目录 `TraceResultReturnSans-delta.woff2`

URL 由宿主注入，不向组件写入本机路径。可选 delta 不破坏原 5 项 assets 结构。`font-face.css` 提供独立 fixture 可用的相对路径声明；正式打包时由宿主重定向到同字节文件，不能直接带错相对目录。

```css
.trace-result-return { font-family: "Trace Result Return Sans Delta", "Trace Result Return Sans", "Microsoft YaHei", "PingFang SC", sans-serif; }
.trace-result-return h1,
.trace-result-return h2 { font-family: "Trace Result Return Serif Delta", "Trace Result Return Serif", "Songti SC", SimSun, serif; }
```

动态 FontFace 加载用上述 CSS 别名。基础字库和补丁来自同一原始家族，字体形状/字宽一致；缺字补丁只包含 base 不具有的 Unicode cmap，因此正常文字仍由 base 渲染，不改变它原有 glyph。

来源为此前下载且固定 commit/blob 验证的官方原字体：Source Han Serif CN VF（宋体）和 Noto Sans SC（黑体）。完整来源/原hash、派生改名、OFL 和版权元数据保存于 `manifest.json`，不需要重新下载或安装。

## 实测范围与失败边界

固定文案码点覆盖与浏览器字体加载是两项检查。cmap 报告不能证明页面的 font-family 真正应用、更不能证明字距/对比度/任意动态用户文字可读。未知用户文字必须保留系统回退。

本次初始实际缺字 27：`–✓冲则加呈味响异弄影往所拟显测添独知称突签纠规足道／`。宋体 delta 13,328 bytes；黑体 delta 10,160 bytes。现有五套所有字体的联合字形只缺 9，但串联五套字体会增加加载/管理开销，因此没有采取五套全加载。

独立 Chromium 字体 fixture 已实跑：4 个 FontFace 全部 loaded，CDP `CSS.getPlatformFontsForNode` 对 base serif/sans 和 delta serif/sans 的 4 个探针均回报预期自托管字体，未落入系统字体。无 console/page/network 错误。`font-proof.png` 已亲看。这比仅 `document.fonts.check` 更能说明实际字形来源，但仍不是最终页面可读性验收。独立动态端口/浏览器已正常关闭，不接触 4173。

`prepare_fonts.py --verify-only` 会检查 copy hash、两补丁/两 base 的联合 cmap、原字库哈希、许可和元数据；copy 更新需要重做 coverage / delta。首次曾启动完整子集预备流程，但在输出字体前主动中止，改为 root 确认的 delta-only；没有把中止的结果标为已验收资源。

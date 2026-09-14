# Trace 找个对照：本地固定文案字体

这套参考的主标题明显比首页更偏黑体。因此延用已下载的官方 OFL 字体来源，但按本套 `ui/copy.txt` 重新生成专用子集，不重复下载，不全局安装。

## 家族与用途

| 角色 | 家族 / ready 文件 | 建议 |
| --- | --- | --- |
| 主标题、UI、按钮、正文 | `Trace Compare Sans` / `derived/TraceCompareSans-fixed.woff2` | 标题 700，正文 400–500，控件 500–600 |
| 原表达、材料摘录、前后理解 | `Trace Compare Serif` / `derived/TraceCompareSerif-fixed.woff2` | 引用 500–600，避免把整页 UI 设成衬线 |

`derived/font-face.css` 只声明两个字体，不修改 body、:root 或共享全局样式。独立 UI 可通过传入字体 URL 创建同名 @font-face。

```css
.compare-title { font-family: "Trace Compare Sans", "Microsoft YaHei", "PingFang SC", sans-serif; font-weight: 700; }
.compare-quote { font-family: "Trace Compare Serif", "Songti SC", SimSun, serif; font-weight: 600; }
```

## 来源与许可

- Noto Sans SC，Google Fonts 官方仓库既有固定 commit `a85815a42757630ce188fdad368c2dfc444d4773`，原字节来自首页阶段已核验的完整字体。
- Source Han Serif CN，Adobe 官方仓库既有固定 commit `7889f11bf31170b5d092a083b357c8c8130f89e0`，原字节同样复用首页完整字体。
- 每次生成前核对完整字体 SHA256。修改子集重命名为 `Trace Compare` 家族，保留上游 copyright、作者、商标与许可元数据。不要把子集重新命名为上游保留字体名。
- 发布子集时同时带上 `derived/OFL-noto-sans-sc.txt`、`derived/OFL-source-han-serif-cn.txt`。manifest 保留准确 upstream URL、commit、原文件与子集 hash。

## 覆盖与复现

`copy-snapshot.txt` 记录构建使用的固定文案；脚本额外保留 ASCII 字母数字/标点及少量引号/箭头。用户动态输入不保证全字覆盖，仍需系统中文字体 fallback。图片中的精确字体身份未知，这里是视觉近似选型，不称原字体识别结果。

```powershell
python 'artifacts/trace-compare-v1-20260915/fonts/prepare_fonts.py'
python 'artifacts/trace-compare-v1-20260915/fonts/prepare_fonts.py' --verify-only
```

命令只读既有完整字体，写本目录。`--verify-only` 会发现 UI copy 变化；若新增界面固定文案，应更新 copy 并重新生成，再做页面渲染检查。解析/cmap/许可 checks 不等于浏览器排版、折行或最终视觉验收。

本次首轮构建与离线复验通过：两家族均覆盖 **433 个固定 codepoint**；Sans 为 135,300 字节，Serif 为 179,200 字节。未出现下载/生成重试。

UI 冻结后追加 8 行固定文案，已进行一次计划内补集（不是失败重试）：copy SHA256 `E3C51B97E171AB9729124BD9A3F0B9FC220DE57E67D4867A3F1BE5F92D8CA1B3`，新增 6 个 codepoint，当前两家族覆盖 **439 个固定 codepoint**。当前 Sans 为 **137,156 字节**，Serif 为 **181,180 字节**；重新从同一完整原始字体构建并离线复验通过。初次成功的 manifest、copy 快照与浏览器检查记录保存在 `history/initial-433/`，没有覆盖历史为“首次即最终”。

已额外运行 `node 'artifacts/trace-compare-v1-20260915/fonts/browser-check.cjs'`，以隔离无头 Chromium 打开本地 `preview.html`。两家族 file:// 加载成功、零控制台错误、无横向溢出；`font-proof.png` 已亲看，标题/引文清楚，无缺字方框。这是字体单项 proof，不是四态 UI 验收。该脚本中的浏览器与 Playwright 路径为当前机器已存在依赖，换机器需自行传入/调整，不会自动安装。

该浏览器 proof 和 `font-proof.png` 取样于初次 433-codepoint 字体。最终补集后未重拍截图或重跑浏览器，不将旧截图宣称为新增 6 字逐字渲染证明；最终新增字的 cmap 覆盖与字体二进制完整性已由离线解析检查。

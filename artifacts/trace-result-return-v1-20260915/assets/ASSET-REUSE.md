# 结果回来 v1：既有资源复用候选

任务 `trace-result-return-v1-20260915`；HEAD `2f4377864aa353dcecb3f60005d884b11486c84e`；上下文包 SHA256 `D314692521774A4B7F205F31634EE68551186ABEA3D2FA5FD9ABFE3A849ABC27`。本 worker 只写本目录，没有操作 app、4173 服务或当前浏览器，没有下载、安装或生成新图。

已实际读取指定五张原图、README、生产契约，逐张目视比较六张既有干净背景。索引、前轮“ready”标签和文件哈希本身不是本次视觉验收。

## 固定资产决定

### 背景：复用 chain 的总览，不增第六套

推荐且 root 已接受：`artifacts/trace-one-thing-v1-20260915/images/ready/chain-overview-environment.png`，1672×941 RGB，1,719,534 bytes，SHA256 `A4DDA0E97BF3FFEF2D87D48BE07C272E6C69633A236B07676A92A4DC755C6875`。

| 已亲看的候选 | 与本次五图的可见区别 | 决定 |
| --- | --- | --- |
| home-environment | 右侧巨型玻璃波峰，下部两个小球，树木很少 | 不选 |
| matters-environment | 树石、水面和右上月都接近，但左上大树枝侵入标题区 | 备选，不替换它原来的页面用途 |
| chain-environment | 低丘、中央更空，月贴右缘，前景竹叶明显 | 不选 |
| **chain-overview-environment** | 有层叠树石、右上青月、左下近景、水面；最接近这五图共同环境 | **同一张用于五态** |
| worksite-environment | 中部山体太低/留白过多，月右边被截去 | 不选 |
| compare-environment | 没有月，几乎没有近景水面，中部整体很空 | 不选 |

这只是现成资源中最接近，不是逐像素相同。参考图中远山、月尺寸、树石具体位置仍有差异，但没有形成需要另一次生图的必要缺口。不要逐态切五张不同背景，避免一件事展开时环境跳变。

应用应使用 URL 注入并 `cover/center`；不能把本机绝对目录硬写进组件。背景只含山水，不含五张参考里的标题、面板、按钮、鸟或线路；那些内容必须保持真实 DOM/SVG 可编辑。

### 鸟：原透明修复资源，无再生图

| 资源 | 源路径（workspace-relative） | 尺寸 / 真实 alpha | SHA256 |
| --- | --- | --- | --- |
| 停驻 | `artifacts/trace-home-v1-20260914/images/repaired/bird-perched.png` | 1086×839 RGBA / 0—255 | `81DE590D9C88D27AD73BE569385D8B1D6999F08FC269912B4B97B5D403B4EFEC` |
| 起飞 | `artifacts/trace-home-v1-20260914/images/repaired/bird-takeoff.png` | 1156×1215 RGBA / 0—255 | `9BCE1F159D48AB6A8D3230ACA3F41FD4C4A114A064F59DFCC4B62F05EFA7ED93` |

脚锚点分别 `[772,588]`、`[750,955]`。两姿态同源像素倍率 0.09：停驻宽 97.74、相对脚点 left −69.48 / top −52.92；起飞宽 104.04、left −67.50 / top −85.95。每态一只，注意点由琥珀变绿只能发生在匹配保存成功回执之后。

两姿态可以移动/交叉淡入淡出，不是自然振翅序列。保留旧 `repair-manifest.json` 的失败与修复记录，本次仅引用已获许可修复后的字节；未扩大图像处理授权。不要把有棋盘格的 RGB 原生成鸟或检查拼图当运行资源。

## 真正可复用的现有组件

以下相对路径均从 workspace 根起算。行号是本次核验时的导航；精确源快照 SHA256 在 `assets.candidate.json`，接入前检查变化。

| 需求 | 已有源码位置 / 可复用接口 | 改造成本与边界 |
| --- | --- | --- |
| 原句片段选择 | `artifacts/trace-one-thing-v1-20260915/ui/chain-helpers.mjs:65` 的 `selectedRange(container)` 返回 `{start,end,text}`；`chain-screen.mjs:139` 的 `selectText()` 已区分 textarea 选区和 DOM Range | **低**：换事件名、data 属性。offset 是 JS UTF-16 位置，必须连同原文/baseVersion 交给本次 reducer 核验，不能只凭文字搜索给整件事贴标签。重复短句须凭精确 offset 区分。 |
| 输入中不丢光标/IME | 同 `chain-helpers.mjs:30`，`patchDOM(parent,fresh,isComposing)` 以 `data-key` reconcile，文本域保留选择区；`comparison-screen.mjs:98` `field()` 是不重建屏幕的替代模式 | **低至中**：复用一套，不再做第二套；所有动态数据必须 textContent/转义。当前结果/事项切换要换身份 key，避免继承别人的草稿。 |
| 观察/解释/未确认三列 | `chain-screen.mjs:92` `results()` 的 `.chain-fact-grid`；`worksite-screen.mjs:64-68` 结果面板中的 interpretation/unknown | **低**：抽结构重命名到 `.trace-result-return`，直接绑定本次 view；不能把原示例的解释填给新输入。 |
| 修改前后差异与依据 | `artifacts/trace-compare-v1-20260915/ui/comparison-screen.mjs` 的 `returned` 模板、`:166 revisionModal()`、`:195 openChanges()`；对应 `comparison.css:171-175` before/after、`:308-315` 窄窗布局 | **中**：把 before/after、basis、scope、unresolved 绑定新 view。现有实现是两块文本对照，不是通用字符 diff 算法；没有必要安装 diff 编辑器。不可保留仅示例词“必须”的硬编码划线逻辑。 |
| 材料条 / 查看原文 | `comparison-screen.mjs:192 openImport()` 的原生表单、`openMaterial()` 原文/上下文展示，`comparison.css:138-140` 来源动作；`worksite-screen.mjs:59` 来源追踪条 | **中**：新建材料 id，名称/原文分开，移除只改此次选中集合。原实现只支持摘录，不是文件上传；截图缩略图必须有真实附件或明确标示示例，不拿背景伪装截图。 |
| 关系单选 | `worksite-screen.mjs:66` `.worksite-result-relations` 的 `role=group` / `aria-pressed` 和 `result-relation` dispatch；compare 的 relation select | **中**：原结构偏整条结果，本次要为每个片段分别保存 relation。四按钮可直接改造，领域保存不能复用整条关系的旧 reducer。 |
| 回执与撤销 | `worksite-screen.mjs:264-269` 区分 revised / result-only / undone，并按 undo availability 显示动作；compare `returned` 中 before/after/receipt | **中**：仅借布局与文案真值分离，完成态由本次 `commandId/expectedVersion/receipt` 合同控制。不能调用旧本地即时 commit 动作绕过宿主确认。撤销不删原始结果。 |
| 有机小气泡 / 材质 | `trace-runtime/apps/desktop/src/home/scene-glass.js:35` 的 `mountSceneGlass({host,backgroundUrl,scene,path,width,height,tone}) → {refresh,destroy}`，`calculateCoverSample()` | **低**：可注入服务，空 decorative host、真实文字为 sibling；path 是 1000×300。大面板应沿用白色透底 CSS/SVG，面积大于 260000 px² 时 adapter 本就不跑重滤镜。 |
| 支流 / 注意点 / 鸟路径 | 现有 `src/vendor/anime.esm.js` 的 `animate` / `svg.createMotionPath`；paired SVG stroke/highlight 模式已移植在 home。 | **低**：有限状态路径动画，reduced-motion 立即落位；destroy 取消动画/监听。无需安装 React/Motion。 |

这些不是独立发布的通用组件包。可以复用局部函数或结构，但不能直接把旧页面 mount 与它的业务 state 一起拷贝成另一个事项库。

## 字体与许可

固定文案来自同任务 `ui/copy.json`，既有五套字体的每个 cmap 都会实际读取，不按文件名推断覆盖。root 确认复用覆盖最接近的 chain 字体，必要时只补缺字 delta；原 serifUrl/sansUrl 保持兼容，新增 serifDeltaUrl/sansDeltaUrl 为可选项。详见 `fonts/FONT-USAGE.md`、`fonts/existing-coverage.json` 与 `fonts/manifest.json`。

- 原字体是此前已核验的官方 Source Han Serif CN VF 2.003 / Noto Sans SC 2.004；本次不联网下载、不装系统字体。原始源 URL、commit、hash 在 font manifest。
- 新子集改名、原版权/OFL 元数据保留；两份 OFL 副本随包。动态用户文字仍要系统中文 fallback，固定文案零缺字不等于全汉字覆盖。
- Anime.js 4.5.0、@liquidglassjs/core 0.5.2 为既有 MIT，本目录 `licenses/` 保存相同许可。MagicUI 的 paired-path 模式来源保留 MIT；没有重新导入 React source。
- Codrops ShapeMorphIdeas 的资源分发范围未清晰，仍为 reference-only，**本次不复制/导入/分发**。
- 背景和鸟是项目生成资源/批准派生，不编造 MIT/OFL 或第三方图库授权。Trace 本地组件在 repo 根未发现独立分发许可；仅作本项目复用，不将其宣称为对外开源授权。

## 重放与验证界限

```powershell
# cwd: D:\AGeneral Workspace\AI-powered\harness
python artifacts/trace-result-return-v1-20260915/assets/verify_assets.py
python artifacts/trace-result-return-v1-20260915/assets/prepare_fonts.py --verify-only
node artifacts/trace-result-return-v1-20260915/assets/font-browser-check.cjs
```

资源脚本实际核验：五图 hash/尺寸、六个干净背景 RGB 解码、选定背景固定 hash、两鸟 alpha 与已批准源字节相等、九处组件 hash、许可副本一致。只读像素，不修图。

字体准备器会先检测既有覆盖；只有缺字时从已下载官方原字体派生。若 UI 固定文案变化，verify-only 会失败要求重验，不静默声称旧字体仍覆盖。

本次初始 copy 412 码点，最接近的 chain base 各缺 27；最终仅补 13,328 bytes 宋体 + 10,160 bytes 黑体，两 base + delta 联合零缺。独立字体 fixture 4 字体加载和 4 CDP 实际 glyph-source 探针首次通过，无控制台/网络错误；截图已目视检查。字体 fixture 不启动 app，自己的临时端口/浏览器已关闭。

本候选不代表 app 已接入、浏览器合成可读性、真实附件上传、真实保存/撤销或完整性能通过。UI worker 自己做真实 fixture 渲染，root 后续整合验收。


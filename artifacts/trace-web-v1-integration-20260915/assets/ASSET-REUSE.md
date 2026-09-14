# Trace Web v1 资产定版候选与组件复用指南

面向 root / 后续 Web 整合维护者。本文帮助引用现有资源和处理必要差异，不另造完整组件库，不重新设计页面。

- 任务：`trace-web-v1-integration-20260915`。
- 基线 HEAD：`2f4377864aa353dcecb3f60005d884b11486c84e`。
- 上下文包 SHA256：`918D75E6C80AAD8054B3F59B24810BED2CE261390AC4425CCA8E0481275C921E`。
- 状态：**待 root / 用户确认的 freeze candidate，不是发布批准，不是五页业务/视觉验收。**
- 本 worker 仅写当前任务 `assets/`。未改 app、旧 artifacts、参考图、PNG/字体字节、锁文件、全局字体或 Skill；未生成新图、下载资源、启动服务。
- 原始依据为五组各自参考、有效交付说明/manifest 和现场哈希；本轮没有重做目视验收，历史视觉结论按各自来源保留，未根据 mtime 猜“最终”。

## 1. 本批锁定什么、不锁定什么

唯一机器清单：[approved-assets.candidate.json](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-web-v1-integration-20260915/assets/approved-assets.candidate.json)。每项有语义 key、workspace 相对来源路径、完整 SHA256、用途/页面、原件关系、许可/生成凭据入口、有效 manifest 的 JSON pointer、当前 app 的已存在同字节路径。

**22 个资源候选**：6 张场景背景、2 张共享鸟图、2 个完整原字体、10 个页面固定文案子集、2 个现用 vendor。不是 22 张图片，也不包括测试截图。

`files` 另保护 332 个已存在文件，显式区分：33 张视觉参考原图、6 个生成背景原件、3 个透明失败的原鸟、4 个已被替代的 Chain 子集、149 张测试截图、24 个鸟修复检查/诊断图、原字体副本、许可及 provenance 等。`implementationSnapshots` 记录 15 个相关实现文件身份；app 文件由 root 整合，可变化而报告 warning，不把业务代码误冻住。

候选选定后，后续 Agent **不得默默替换**：

1. `bird.perched` / `bird.takeoff` 的像素、裁切、透明通道、身份及脚点。
2. 六个 `environment.*` 的场景语义与字节；不能因另页“更美”或名字都叫 environment 而互换。
3. `font.original.sans` / `font.original.serif` 的上游 commit、字节与许可；页面子集不能靠同名文件覆盖。当前缺字时应报告并更新明确的字体方案，而非线上拉新字体或静默 fallback。
4. 现用 Anime 压缩版与 shape-only bundle 的版本/字节；不为整合顺手升级依赖。
5. 品牌 SVG 的既有形状。页面文字、材料、表单、返回入口始终是 DOM / 行为，不把整页参考或测试截图当静态替代。

调整需先指出语义 key、旧/新 hash、原因、原件/许可链及实际回归，再由 owner 接受；旧原件和旧证据不覆盖。资源发布本身仍需单独确认。

## 2. 可共用鸟图；背景保留六个场景

| Key | 来源交付 | 当前 app | 保留理由 |
|---|---|---|---|
| `environment.home` | home / `images/ready/home-environment.png` | 是，public/home/environment.png 同字节 | 首页玉青透明山水、大球与前景两小球 |
| `environment.matters` | matters / `images/ready/matters-environment.png` | 是，public/matters/environment.png 同字节 | 七图森林岩石湖景；不能换成首页玻璃波峰 |
| `environment.chain.inner` | one-thing / `images/ready/chain-environment.png` | 此次快照未接入 | 02/03/04/05/07/08/10/11 的低丘、右缘月球、竹叶；01/09 Trace 承接区域可按需采样 |
| `environment.chain.overview` | one-thing / `images/ready/chain-overview-environment.png` | 此次快照未接入 | 06 的月球位置、横向山丘、无近景竹叶与内页不同 |
| `environment.worksite` | worksite / `images/ready/worksite-environment.png` | 此次快照未接入 | 工作五态共用的高留白、两侧低山与珍珠水面 |
| `environment.compare` | compare / `images/ready/compare-environment.png` | 此次快照未接入 | 四态近纸白水墨外围；正文可读性优先，不再叠首页强色调滤镜 |

六背景均 1672 × 941 RGB，**六个 hash 互不相同**；每张 ready 与本任务生成 original 完全同字节。因此每场景引用一张，不给每状态造一张；但不能把六场景去重成一张。具体视觉参考路径全部随各 `environment.*.visualReferencePaths` 记录，33 张参考现场哈希匹配各原上下文包。

鸟的唯一候选来源：

- [bird-perched.png](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-home-v1-20260914/images/repaired/bird-perched.png)：1086 × 839 RGBA；SHA256 `81DE590D9C88D27AD73BE569385D8B1D6999F08FC269912B4B97B5D403B4EFEC`；脚点 `(772,588)`。
- [bird-takeoff.png](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-home-v1-20260914/images/repaired/bird-takeoff.png)：1156 × 1215 RGBA；SHA256 `9BCE1F159D48AB6A8D3230ACA3F41FD4C4A114A064F59DFCC4B62F05EFA7ED93`；脚点 `(750,955)`。

每姿态现场找到 **5 个同字节路径**：home repaired 原候选、app public/home、chain ready、worksite ready、compare ready。matters 当前直接由 host 注入 app public/home 的鸟，不需要另复制。最终部署可以统一 URL，但旧交付保留，不移动/删同字节原副本。

使用相同源像素倍率 `s`，而非相同 CSS 宽度：`left = X − footX*s`、`top = Y − footY*s`。例如 home 当前 `.09`；worksite 当前 `.08`，compare 素材说明给 `.065`。统一身份不要求各场景强制同显示尺寸。Chain 当前主要用 perched，takeoff 接口预留。两张静态姿态只支持状态切换/路径移动，不是自然振翅；历史修复羽缘有 1–2 个源像素的估计限制。

明确排除：home `images/originals/B-*`、`B2-*`、`C-*` 鸟是 RGB 棋盘底原始失败；`debug-*`、`*-alpha.png`、`*-full.png`、深绿/灰底及 `bird-small-size-check.png` 是修复证据，不能当正式 sprite。参考整页和 `first/final/verified/acceptance` 截图均非运行资产。

## 3. 字体：统一来源与加载职责，不把十个子集冒充两套全字库

### 原件与许可

| 语义角色 | 唯一原始来源 | 大小 / 实际轴 | 原件 SHA256 |
|---|---|---|---|
| `font.original.sans` | [NotoSansSC[wght].ttf](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-home-v1-20260914/fonts/originals/noto-sans-sc/NotoSansSC%5Bwght%5D.ttf) | 17,772,300 B；`wght 100–900`，默认 100 | `A3041811A78C361B1DE50F953C805E0244951C21C5BD412F7232EF0D899AF0DA` |
| `font.original.serif` | [SourceHanSerifCN-VF.ttf.woff2](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-home-v1-20260914/fonts/originals/source-han-serif-cn/SourceHanSerifCN-VF.ttf.woff2) | 11,035,128 B；`wght 250–900`，默认 250 | `556749BA783B148FA1F48644E8883E5B9351F01ABD0D1FAAD0BA24A21185E76A` |

原件分别固定 Google Fonts commit `a85815a42757630ce188fdad368c2dfc444d4773`、Adobe commit `7889f11bf31170b5d092a083b357c8c8130f89e0`。来源版本、下载历史及 Git blob 见 [home 字体 manifest](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-home-v1-20260914/fonts/manifest.json)。Chain 与 Worksite 各保留同字节原件，Matters / Compare 引用 home；无需重新下载或把原字库复制五遍。

两份本地官方许可都为 OFL 1.1 并含保留名 `Source`。派生文件已有不同 Trace family/PS/instance 名称，不能把子集伪装成官方原件。随字体分发对应 OFL 原文与版权；CSS 别名不等于改原件名字。本包仅核验已存许可入口/字节与已有 provenance，不作新的许可解释或补造图片开源许可。

### 固定子集的实际差异

本轮用既有 FontTools 4.63.0 **重新只读解析了 12 个字体的 cmap/variable axes**，见 [font-cmap-audit.json](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-web-v1-integration-20260915/assets/font-cmap-audit.json)。不是只复述旧 manifest。

| 页面 | 有效交付固定码点数 | 当前实际 cmap | 缺少五页 cmap 并集中的码点 | 选择 |
|---|---:|---:|---:|---|
| Home | 319 | 319 | 441 | 只用本页最终 derived |
| Matters | 473 | 474 | 286 | 473 是必需文案数，474 是实际 cmap，不把两数混为失败 |
| Chain | 646 | 646 | 114 | 只用最终 derived；603 / 640 版在 candidates 中保留排除 |
| Worksite | 465 | 465 | 295 | 最终 465 补集，不是旧 413 文案 |
| Compare | 439 | 439 | 321 | 最终 439 补集，433 的旧 proof 不证明新增字渲染 |

**五页当前子集 cmap 并集是 760，连最大的 Chain 子集也缺 114。不能选“最大的一个”替换全站。** 上述数字对 Sans/Serif 一致；同源不等于同字节、同字符覆盖。并集不是所有新 UI 文案，更不是用户未来输入。

### 最小整合路径

1. 现在保留 `font.fixed.<page>.<sans|serif>` 的最终字节和场景角色；由 host 的资源表给各模块传 URL，不再新增第五套字体来源。已存在 CSS-family 名称可以保留，别急于改全局样式。
2. 若 Web 要求动态中文也尽量一致：将**这两份既有完整原件**各自作为可复用本地 full fallback 注册一次，在各页子集后、系统字体前按角色引用；候选原件合计 28,807,428 B，加载体积需 root 明确取舍。本轮未复制/打包它们，也未宣称动态显示已通过。完整 fallback 声明的既有参考为 [font-face-full-fallback.css](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-home-v1-20260914/fonts/derived/font-face-full-fallback.css)。
3. 全字体也非所有 Unicode。本轮样本 `动态输入：龘、𠮷与🙂` 中，两原字体都没有 `U+20BB7`（𠮷）与 `U+1F642`（🙂）；原字体覆盖当前 760 并集，却仍需系统 CJK / emoji 最后兜底。不可用“document.fonts.ready”代替逐字命中与排版检查。
4. 若之后真要合并两套全站固定子集，应按**实际五页 DOM/ARIA/notice/fixture 固定文案并集**重新产出独立新候选、重新命名/保留 OFL 并验收；不是此批操作。不能仅把十份同名 `@font-face` 叠在一起，浏览器 face 匹配和重叠字符覆盖需要显式策略。
5. 字体加载应由 host 统一职责管理、复用 URL、保留 `font-display:swap`，不要场景卸载时删除另一个场景仍依赖的 shared FontFace。当前每模块局部创建/销毁行为不同，简单“同 family 重命名”会造成覆盖/卸载风险。

### 已发现的加载描述符差异（待 root 有界处理）

- Home CSS 和 Matters 实例 `@font-face` 已声明真实范围：Sans `100 900`、Serif `250 900`。
- [chain-screen.mjs:33](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-one-thing-v1-20260915/ui/chain-screen.mjs#L33) 的 `new FontFace(family, ...)` 未传 weight 描述符；[worksite-screen.mjs:91](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-worksite-v1-20260915/ui/worksite-screen.mjs#L91) 仅传 `display:swap`。这不能被当成已正确声明 variable 字重范围；未实测是否发生合成字重。
- [comparison-screen.mjs:87](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-compare-v1-20260915/ui/comparison-screen.mjs#L87) 对两字体都传 `100 900`，与 Serif 真实最小值 250 不一致。
- UI 使用 `font-synthesis:none` 的声明并不处处一致；host 修描述符后仍须在目标权重实测。**本轮未改这些模块，不用静态发现冒充视觉 defect 已确认。**

### 角色必须保留的差异

Home / Matters / Chain / Worksite 以 Serif 标题、Sans UI 为主；**Compare 主标题和新理解用 Sans，原表达/材料引文用 Serif**，不能被一个全局 `h1,h2,h3 { serif }` 统一掉。五页不能仅凭同源就套同字号、行高或字重。

Trace 字标形状一致，字标文字目前并不完全同实现：Home 继承 Home Sans；Chain / Worksite / Compare 显式 Arial（仅拉丁字标），Matters 保留其局部字标样式。这是待选择的差异，不以“统一字体”名义偷偷改变已核验字标宽度。

## 4. 公共组件复用映射：保留一套源，不复制整库

以下是**首选来源与局部变体映射**；不是新组件库 API，也不授权本 worker 重构 app。

| 候选公共部件 | 首选既有实现 | 必须保留的差异 / host 边界 |
|---|---|---|
| 品牌 SVG | [home-icons.js](D:/AGeneral%20Workspace/AI-powered/harness/trace-runtime/apps/desktop/src/home-icons.js) 的 `mark` | 32 viewBox / 2px stroke 的现有路径在 Chain helpers、Worksite icons、Compare 内相同；Matters 已 import。用同一形状，不统一所有页壳尺寸/阴影/字标字体；Compare 当前品牌不是返回按钮，返回语义由独立入口决定 |
| 基础图标 | 同上 `icon()` 的原生 24 viewBox / 1.65px SVG | Home/Matters 已共享；Worksite 多个基本 glyph 同路径，补 `external/switch/info/...`。Chain 的 back 是 chevron，Home/Worksite/Compare 为长返回箭头；Compare stroke 1.7。应按 action 语义映射 `back` / `chevron` / `send-up` / `next-right`，不能只按同名 key 替换：Worksite `arrow` 向右、Home `arrow` 向上，Matters 也有自己方向 |
| 主要/轻量/图标按钮 | [home.css](D:/AGeneral%20Workspace/AI-powered/harness/trace-runtime/apps/desktop/src/home.css) 的 `.send-orb`、`.source-pills`；各模块 `.chain-button` / `.worksite-button` / `.compare-button` 与局部 button helper | 复用圆角、玉绿主行动、焦点/disabled 语义；发送圆钮与阅读确认矩形/胶囊不是一个强制皮肤。不要把 `disabled` 提交改成可点击的“先返回演示” |
| 输入与受控更新 | [chain-helpers.mjs](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-one-thing-v1-20260915/ui/chain-helpers.mjs) 的 `patchDOM` / `selectedRange` 可作既有实现参考；Worksite/Compare 保持控件节点 | UI 的输入、composition、选区不能被 host 整页重建破坏。Chain 局部编辑有精确正文 offset；Worksite 草稿按 work 隔离；Compare 判断按 candidate 隔离；不要为共用 textarea 合并这些领域归属 |
| 异形玻璃 | app [scene-glass.js](D:/AGeneral%20Workspace/AI-powered/harness/trace-runtime/apps/desktop/src/home/scene-glass.js) 的 `mountSceneGlass`，依赖既有 `shape-only.mjs` | 同背景 URL + cover/center 采样、文字/控件在独立未折射 DOM。约 260000 viewport px² 以上降级，160ms 静止后重建；不每帧重算位移图。变换后由已有 `refresh()` 同步 |
| 膜面 / 阅读面 | [matters-screen.mjs](D:/AGeneral%20Workspace/AI-powered/harness/trace-runtime/apps/desktop/src/matters/matters-screen.mjs) 的 `MERGED/DEEP` 连续 SVG；各页局部 CSS | Matters 融合膜面、Chain 大编辑面轻量 CSS、Worksite 条件/结果面、Compare 03/04 纸白面必须并存。Compare 01 锚点/02首候选可用 adapter，03/04 不套折射；不要把整页变一张玻璃白卡 |
| 材料弹层 | Matters 原生 `dialog`、Compare `dialog` 的 `modal/openMaterial/closeModal` 是轻量信息阅读的首选实现模式 | 保留标题、来源类型、原文/摘录、未确认关系、关闭与焦点回归。Chain 本地表单/选区和 Worksite 带入快照面有不同 draft/identity；应共用外壳行为，不把“只看来源”做成“确认采用”。不能显示不存在的外链/上传能力 |
| 返回入口 | 保留各模块现有回调：Chain `onHome/onMatters`、Worksite `onHome/onOpenMatter`、Compare `onReturn/onContinue/onAll` | host 负责同 matterId、来源位置和返回目标；不统统写成回首页/overview。当前返回按钮样式可复用，目标与 receipt 边界不可因换壳丢失 |
| 动效 | app Anime 服务注入给三个独立模块；沿用 reduced-motion、可取消与 destroy 清理 | Home/Matters 原位生长/收回；Worksite 可中断源卡展开与鸟路径；Chain 轻进入和06气泡；Compare 380ms 淡入/轻位移。统一服务而非把每次跳页都加完整鸟飞行/玻璃展开 |

玻璃详情与代码边界参考：[Scene glass 原生 adapter 说明](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-home-v1-20260914/components/derived/trace-adapter/README.md)、[Matters 膜面判断](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-matters-v1-20260915/images/ASSET-NOTES.md)、[Compare UI 视觉与接口](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-compare-v1-20260915/ui/README.md)。这些说明中的旧“未接入”仅属其原时间点；本包当前 app 快照确认 Home/Matters 已引用，另外三模块仍独立。

### Vendor 身份与许可证

- **现用 Anime.js 4.5.0 是上游压缩版。** [app vendor/anime.esm.js](D:/AGeneral%20Workspace/AI-powered/harness/trace-runtime/apps/desktop/src/vendor/anime.esm.js) 虽文件名无 `.min`，实际与 [originals/.../anime.esm.min.js](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-home-v1-20260914/components/originals/animejs/dist/bundles/anime.esm.min.js) 逐字节相同，118,678 B；SHA256 `A19015A1A92D52025A2FB6703B6D67EADD1CC2AEAF880770E96E04CF6AA07BE1`。不能误用 408,414 B 未压缩原件假称当前 byte reuse。
- `shape-only.mjs` 为既有 17,644 B 派生 bundle，app 与 artifacts hash 同为 `30CE49881E35EC8ED8E4235CE6934A19F56761069E072DA11E77C9B6191E6D22`。两者 MIT 入口与 app 随包许可均已查存在/字节；本轮未重新打 bundle。
- Magic UI AnimatedBeam 的 MIT 来源及 app 随包许可保留，但现成 React 源码不是原生页面可直接导入组件。已有路径/高光/端点语义可沿用，不为复用安装 React。
- rizzy liquid-glass 是旧准备包的备选，未见当前 app import，不为“统一材质”换到备选。
- Codrops 仍为 [REFERENCE-ONLY](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-home-v1-20260914/components/REFERENCE-ONLY.md)，不导入/打包/分发；其 JS 文件头不能替代资源级条款边界。

## 5. 回放、首次失败与检查结果

在任意 cwd 使用完整路径，Node 不需要新增依赖：

```powershell
node 'D:/AGeneral Workspace/AI-powered/harness/artifacts/trace-web-v1-integration-20260915/assets/verify-assets.mjs'
node --test 'D:/AGeneral Workspace/AI-powered/harness/artifacts/trace-web-v1-integration-20260915/assets/verify-assets.test.mjs'
python 'D:/AGeneral Workspace/AI-powered/harness/artifacts/trace-web-v1-integration-20260915/assets/audit-font-cmap.py'
```

- `verify-assets.mjs` 本身只读，stdout JSON、失败非零退出；不写清单、不刷新 hash、不执行其它模块、不联网。会核验资源 hash/长度、PNG 头尺寸类型、历史 manifest 精确 pointer、原件/别名、许可入口、33 张参考及历史证据 hash。其文件访问限制为工作区内的已登记路径，拒绝 traversal/绝对路径与跳出工作区的 symlink。
- 本轮结果：[verify-result.json](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-web-v1-integration-20260915/assets/verify-result.json)：**332/332 文件、22/22 候选、16/16 同字节组通过；15/15 实现快照未变化；0 failures / 0 warnings。** 56 个 `original/reference` 分类文件检查通过；全部原件与已记录 hash 一致。
- [verify-assets.test-result.txt](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-web-v1-integration-20260915/assets/verify-assets.test-result.txt)：**10/10**。包含 UTF-8 / 方括号文件名、路径越界、hash/长度不符、重复 key、缺许可、缺文件、别名篡改、指向错误资源的 authority 等反例。反例只在内存中发生，没有篡改原图做测试。
- FontTools 检查的 12 个真实字体 hash 均匹配候选，当前 760 并集/缺字与原轴结果见 `font-cmap-audit.json`。未写回任何字体或旧 manifest。
- **首次候选构建曾失败一次**：错误将 app Anime 当成上游未压缩文件，逐字节断言阻断；重新核验 app 文件头与两个上游 hash，确认是 `.min.js`，改的是本包映射而非源字节。随后构建/核验通过。不将第一次失败描述为首次全过。
- 探索时尝试读取不存在的 `components/README.md`，得到不存在；实际读取入口改为已存在的 `components/INTEGRATION.md`。没有据此补造旧文档。

`build-candidate.mjs` 是本轮记录可重放的**显式构建器**，仅输出本目录候选 JSON，不能代替只读 verifier；日常验收不要用重建清单刷新 hash 来“修复”漂移。确需重建时先核对上游资产/交付记录，owner 对新候选作新的确认。它没有发布动作，也没有任何图像/字体构建或下载逻辑。

## 6. 仍需 owner 实测 / 决定

1. 是否正式接受 22 个语义资源的 freeze；是否随 Web 打包 28.8 MB 完整原字体用于动态中文 fallback。
2. 整合后的实际本地 URL / CSS 相对路径、字体真实命中、中文长输入/标点/emoji、字重与换行；静态 hash 不证明浏览器真实使用。
3. 三模块字体 weight 描述符、品牌拉丁字标差异、旧 `home.css` 全局 reset 与隔离模块 CSS 的加载边界；不应为消除差异而改视觉方向。
4. 同一事项/材料/工作上的前进与返回、来源弹层、确认/撤销、键盘焦点与 IME；纯资源证据不能替代功能接续有感的业务验收。
5. Web 完整路线与各页参考的真实渲染对照；桌面封装在 Web 统一后另验，不能把此前单模块 file:// font proof 当成整包通过。

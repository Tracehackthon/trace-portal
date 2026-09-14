# Trace 首页素材接入说明

## 2026-09-14 更新：用户授权脚本修复后，两只鸟已成为 RGBA 候选

本段是当前状态；下方初始生图失败完整保留为历史。新任务：`trace-home-v1-prototype-20260914`。用户明确允许“脚本修复透明通道”，因此本轮使用现场已有 Pillow / NumPy / OpenCV / SciPy 处理此前生成图。没有安装库、没有重启生图、没有重画鸟的形象，也没有修改原图或应用。

### 当前可接入项

| 文件 | 尺寸 | alpha | 裁后脚点建议 |
|---|---|---|---|
| `repaired/bird-perched.png` | 1086 × 839 | 0–255；713729 全透明 / 12503 半透明 | [772, 588] |
| `repaired/bird-takeoff.png` | 1156 × 1215 | 0–255；997122 全透明 / 20340 半透明 | [750, 955] |

完整路径：
- `D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\images\repaired\bird-perched.png`
- `D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\images\repaired\bird-takeoff.png`

背景仍使用 `D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\images\ready\home-environment.png`。初始 `originals` 鸟图仍无透明通道；不要误用。

### 方法、实际检查与限制

不是全局删浅色，也不是用几何多边形硬裁轮廓。先利用背景近中性、灰白格高频纹理与鸟的彩色/深色、平滑浅色羽毛建立候选；做连通区域筛选、3 px 局部闭合、从边界区分背景与前景内部空洞；以亲看原图获得的腿间背景点保留真实空隙。最后仅对约 1 px 轮廓带做轻量抗锯齿，并用最近的内侧前景颜色去掉原棋盘底混入的边缘灰白色。不改变不透明内侧的 RGB。

- 两张均在深绿底、中灰底亲看；白腹、白颈、眼、足、尾羽和展翅完整，腿间空隙透明。
- 四类保护点的 alpha 均为 255，RGB 与原图完全相同；PNG 为真实 RGBA。
- 原始 1254 × 1254 图保留；裁切范围、alpha bbox、脚点、眼点与精确哈希都在修复 manifest。
- 以 0.075 / 0.13 源像素倍率亲看小尺寸检查图，未见明显棋盘块。
- 脚本复跑后两张 PNG SHA256 不变。没有把第一次丢失白腹的诊断结果或第二次内部孔洞未补齐的结果当作交付。
- 高倍下个别 1–2 源像素浅色羽丝和原始混合边缘只能近似恢复；这是小尺寸 UI 候选，不宣称无损、像素级完美抠像。两张静态姿态不等于自然振翅动画。

**对齐方式：使用相同的“原始像素 → CSS px”倍率，不要把裁切后的宽度强设为相同。** 例如倍率 `s = 0.075` 时，停驻渲染尺寸约 `81.45 × 62.93`，起飞约 `86.70 × 91.13`。若锚定全局脚点 `(X,Y)`，图像左上角为 `(X - footX*s, Y - footY*s)`。脚点来自目视登记，不是精确解剖跟踪；需要在真实状态切换中调校。

### 修复重放与证据

```powershell
$env:PYTHONIOENCODING = 'utf-8'
python 'D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\images\repair_checkerboard.py' --pose all
```

脚本验证两张输入的固定 SHA256；不匹配会在处理前停止。重跑只写修复输出，不写 originals。注意自动生成的单文件 metadata 会回到 `pending_visual_review`，新的产物仍需目视复核，不能靠运行脚本自动宣称视觉通过。

- 修复总记录：`D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\images\repaired\repair-manifest.json`
- 小尺寸检查图：`D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\images\repaired\bird-small-size-check.png`
- 重放哈希：`D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\images\repaired\replay-hashes.json`
- PNG 结构：`D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\images\repaired\png-structure.json`

主 manifest 已追加当前授权修复记录，初次 Prompt、原始失败和工具回执未删除。此 worker 未完成应用、桌面壳或动画验收。

---

# 初始生图批次历史（保留失败，不代表当前可用状态）


- 日期：2026-09-14
- 读者：主 Agent / 后续桌面首页实现者
- 任务：`trace-home-v1-assets-20260914`
- 基线：`2f4377864aa353dcecb3f60005d884b11486c84e`
- 上下文包 SHA256：`FEC12772D27033E54E9EDB811486DE7C749DB5AFF054BF1BA3DE06628DC00CD7`
- 本 worker 只写入本目录。未修改用户参考图、应用源码、配置、锁文件；未安装依赖、未提交 Git。

## 交付结论

**部分交付：只有清洁景观背景达到素材级接入候选标准。鸟的两种姿态已经真实生成，但透明失败，不能直接用于页面。**

| 项目 | 实际生成与检查 | 状态 |
|---|---|---|
| A 清洁背景 | 1672 × 941，RGB PNG，1,564,971 字节 | 素材级目视通过，放入 ready |
| B 停驻鸟 | 1254 × 1254，RGB PNG；灰白棋盘格是图片像素 | 失败，只留 originals |
| B2 停驻鸟透明修复 | 唯一针对性重试，1254 × 1254，仍是 RGB 棋盘格 | 重试失败，已停止 |
| C 起飞鸟 | 1254 × 1254，右向展翅形象候选；仍是 RGB 棋盘格 | 不可直接接入，只留 originals |
| D 玻璃气泡边缘 | 未调用 | A/B/C 到位前提未满足，跳过 |

共 **3 次主生成 + 1 次针对性重试**。全部通过内置 `image_gen__imagegen` 完成，并通过 `generatedImage` 展示。没有使用外部 API / CLI 替代，没有用 Python 或手工图形代码重绘、抠图或伪造透明。内置工具仅返回 `image_url` 与 `output_hint`，**具体模型身份未暴露，无法宣称已核验某个“最新”模型**。

## 可以接入的文件

`D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\images\ready\home-environment.png`

SHA256：`16BC94CF2D00D7ECFA63FCB635C90067F650B6FA15F6738560C520E0825F1A05`

它与以下原始生成文件字节相同，未做缩放、裁剪或编码转换：

`D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\images\originals\A-home-environment.png`

素材级目视核验：
- 使用六态材料中的 `01-首页静默总览态.png` 作为唯一编辑目标；没有回到旧单张概念图。
- 保留左右山体、玉青色透明材质、水面与暖光、远处大球、前景两颗小球、左上树影、中央留白。
- 未见文字、Logo、输入框、按钮、气泡、人工连线、节点或小鸟残留。
- 被原 UI 遮挡的区域由模型补绘；没有原始无 UI 底稿可证明这些隐藏区域“像素级还原”。
- Prompt 请求优先至少 2048 像素宽，工具实际返回 1672 像素宽；**分辨率目标未达到**。未另行上采样或伪称 2K/4K。
- 环境背景本来就无需透明；RGB 对此用途不是失败。

## 鸟图的限制

停驻鸟与起飞鸟沿用了右向、深绿青色背翅、白腹和长尾的参考特征，但放大后更突出圆眼和分叉尾羽，是模型重建候选，不是精确抠取原始鸟像素，也没有通过用户形象验收。

C 使用经过目视检查但已知透明失败的 B2 作为身份编辑目标，再以 `02-气泡唤醒四帧分镜.png` 右上帧为姿态参考。得到双翅抬起的单张图，**未生成自然飞行动画**，也未归一化中心、脚点或姿态切换比例。

三张鸟图都是 PNG color type 2，且没有 `tRNS` 块，因此没有透明信息，解码 alpha 全为 255。展示时看到的灰白格子并非查看器透明底，是文件内的实际像素。禁止把这些文件重命名为 sprite 后直接接入，禁止用 `mix-blend-mode`、白底遮盖或“PNG 格式”说法当作透明已解决。

## 原始输出、Prompt 与证据

完整每次 Prompt、输入角色/绝对路径/SHA256、工具实际保存提示、模型身份未知、输出参数、视觉评价与限制统一记录在：

- `D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\images\manifest.json`
- `D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\images\evidence\tool-results.json`
- `D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\images\evidence\png-metadata.json`
- `D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\images\evidence\reference-hashes.json`

独立 Prompt 文本位于同一 evidence 目录：
`A-background-prompt.txt`、`B-bird-perched-prompt.txt`、`B2-bird-alpha-retry-prompt.txt`、`C-bird-takeoff-prompt.txt`。

内置工具生成文件保留在工具实际返回的 `C:\Users\HoSheil\.codex\generated_images\01a0a02c-f4b2-7312-92c2-2ce424e308b8\`，同时已经复制到项目 artifacts。本项目不需要依赖仅存于 .codex 的路径。用户输入原图未覆盖。

## 重放检查

前提：Windows PowerShell 7 / 当前可用的 System.Drawing。脚本只读取 PNG 头、块类型、像素样本与哈希，不更改图片。

```powershell
$base = 'D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\images'
$paths = @(
  (Join-Path $base 'originals\A-home-environment.png'),
  (Join-Path $base 'originals\B-bird-perched-initial.png'),
  (Join-Path $base 'originals\B2-bird-perched-alpha-retry.png'),
  (Join-Path $base 'originals\C-bird-takeoff.png'),
  (Join-Path $base 'ready\home-environment.png')
)
& (Join-Path $base 'evidence\inspect-png.ps1') -Paths $paths
```

已运行结果：5 个文件均能解码；A 的 originals 与 ready 哈希相同；3 个鸟图均无 alpha / tRNS。原始六张参考图哈希全部与上下文包一致。生成前已亲看 01、02、03、06；生成后亲看所有输出。

检查脚本首次运行因 PowerShell 数组表达式中的减法优先级出错；修正括号后重试通过。此失败不影响 PNG 内容，未掩饰为首次通过。生图服务 4 次调用均返回图片，但服务返回成功不等于素材透明验收成功。

## 未运行与下一步边界

- 未接入桌面应用，未测浏览器 / 原生桌面壳 / 高 DPI / 不同窗口比例。
- 未验真实输入、节点联动、气泡形变或小鸟动画。
- 背景可以供主 Agent 进入组装小样；成品页面仍须截图对照与实际操作验收。
- 鸟需要新的透明处理路径后才能变成可直接使用的组件素材；不得继续无依据重复本批已经失败的透明生成。
- 气泡材质先由组件实现小样确定缺口。D 本轮未生产，不能说已有可用玻璃皮肤。

# Trace 结果回来 v1：并行生产契约

## 范围与现场
- 任务 ID `trace-result-return-v1-20260915`。用户指定 Trace结果回来_UI状态_v1 五图并要求并行分配模型任务。
- 唯一视觉方向为本次指定目录五张 1672×941 PNG；目录 README 的事实/解释/未确认、作用范围和确认语义同时适用。静态示例不是真实测试证据。
- 当前 app 首页/matters 已实现；chain/worksite/compare 与 Web 整合候选在其他 artifacts。不得改写它们或假定其已接入。已有资源先复用，不重新造一套视觉风格。
- 本轮产出独立模块与接入候选，主 Agent 后续整合；不修改 app、插件、其他任务目录、原图、全局配置、锁文件和用户状态，不运行 Git reset/commit。
- Web 优先；不操作当前 4173 服务或用户浏览器，不做桌面构建。测试可用独立 fixture/临时端口并清理自己创建的进程。

## 同一条连续链路
稳定 screen ID：`intake`、`comparison`、`impact`、`revision`、`completed`。
另有局部状态：未关联、只保存结果的回执、暂存草稿、保存中、保存失败/重试、版本冲突、撤销中/失败。它们不伪装为第五图的已修订。

1. 带入：真实原文、选中材料、来源、workId、准备接回 matterId；可换一处或先不关联。只带回用户选中内容，不自动带全会话。
2. 比较：分别编辑实际观察、个人解释、未确认部分。对任意新输入不套用示例解释；无 Agent 接口时只展示用户填写或明确示例内容。
3. 影响：理解中可定位的原句/片段 + baseVersion，支持/限制/挑战/未知可分别落在不同片段；不能只给整件事贴标签。无旧理解仍能保存结果，不能伪造理解。
4. 修订：before/after 可编辑差异、原始结果依据、未决点、仅这件事当前理解的作用范围。第三态接受建议只打开草稿，不直接保存修改。
5. 完成：只在用户确认且匹配的宿主回执成功后进入；回到同一 matter、看旧版本、再次带去试的目标选择、撤销本次修订。撤销版本单调，不删除结果，不改项目规则，不自动重做进行中工作。

## 文件归属
- result_state：仅 `model/`，纯 reducer/selector、fixture、单测、sample-views.json、HOST-MAPPING.md。
- result_ui：仅 `ui/`，五态 DOM/CSS、copy.json、独立 fixture/demo、交互检查。所有 CSS 以 `.trace-result-return` 命名空间隔离。
- result_assets：仅 `assets/`，已有背景/鸟/组件/字体复用清单、覆盖检查与必要的固定文案字体子集，许可/哈希/说明。先不生图、不下载新组件、不全局安装字体；明确缺口先报 root。
- root：仅 coordination 与本任务记录/地图；本轮不抢写正在 Web 整合的 app。

## 最小接入接口（候选）
Model exports：`createResultReturnState(seed)`、`reduceResultReturn(state, action)`、`selectResultReturnView(state)`。
UI export：`mountResultReturn(container, { view, dispatch, assets, onNavigate }) -> { update(view), destroy() }`。

view 至少包含 `screen`、`identity`（resultId/matterId/workId/sourceVersion/returnAnchor）、`intake`、`comparison`、`impact`、`revision`、`receipt`、`status`、`notice`、`isDemo`。Model 先交 sample-views.json 与 action schema，让 UI 消费真实 selector，不维护第二套领域状态。UI 草稿要按对象隔离，避免每次输入整体重渲染丢光标/IME。

assets 接收 `{ backgroundUrl, birdPerchedUrl, birdTakeoffUrl, serifUrl, sansUrl }`；vendor/adapter 使用显式 import 或注入，正式路径由 root 接入时决定。禁止把本机 `D:` 路径写入应用组件。

onNavigate 仅发语义目标 `{ target: 'worksite'|'matter'|'retry-work', matterId, workId, returnAnchor, sourceVersion }`。宿主没有接入时明确提示，不偷建新对象、不自行拼 query 或发送外部任务。

保存/修订/撤销必须有明确 commandId、operation、target IDs、expectedVersion 与内容快照。reducer 先暴露 pending command，接入层提交后回传 receipt；只有匹配 pending 的成功回执才改变已保存版本/进入完成态。迟到、重复、错对象/错 operation 回执不能升级成功；冲突不能覆盖新编辑。独立 fixture 可明确模拟成功/失败/冲突，不称真实保存。

## 与现有工作协调
优先读取实际 worksite-model、chain-model 与 Web bridge 候选，复用结果/版本/撤销语义，不复制第二个长期理解库。相关文件由别的任务 owner 维护，仅映射、候选 adapter，不直接改依赖。state 在 HOST-MAPPING.md 明示冲突与建议，root 决定整合，不让 UI 自行绕过。

## 本批验收
- Model：至少覆盖空结果、未关联可保存、只留结果不修订、观察/解释不混淆、片段关系、草稿未生效、成功/失败/冲突、重复提交、错/迟回执、撤销保留结果、多 work/matter 草稿隔离、无旧理解、再次尝试不自动发送。
- UI：五态真实输入/按钮/展开收回，非强制步骤条；第 04→05 受 receipt 控制。HTML 文本转义、键盘 focus/IME/reduced-motion、窄窗溢出、销毁监听。演示失败/重试、只留结果和撤销。
- 资源：先亲看五图并对照已有 ready 背景；复用图和字体身份可核验，许可随附；未知覆盖如实记录。不得把整页概念图当可编辑 UI 背景，不能把引用成功当视觉通过。
- 首次失败与复跑记录都保留；独立候选通过不等于 app/真实保存已接入。

## 首次回传
各 worker 先回显任务 ID、repo HEAD、上下文包 SHA256、实际所读五图、写入边界和首批发现。state 先发 action/view 合同给 UI；UI 先发 copy.json 给 assets；接口实质变化先报 root，不静默分叉。

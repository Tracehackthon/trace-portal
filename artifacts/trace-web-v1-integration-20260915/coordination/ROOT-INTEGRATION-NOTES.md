# root：Web 整合首批现场与裁决

状态：源码只读核验与并行派发，尚未改运行 app / 真实数据库。

## 已确认现场
- 当前 apps/desktop/server.mjs 只提供静态文件，没有事项保存 API。仅静态拼接其它页面不能满足刷新后继续。
- packages/product/application/src/index.ts 已有项目初始化、profile、Hook 与摘要列表边界，不是新 Web 事项/理解/工作对象的现成 CRUD。
- packages/core/runtime/src/runtime.ts 通过 TraceRuntime 提供版本化 DataLedger、ContinuityLedger 与 receipt，storage 已支持 SQLite。其认知记录及已采用判断不能随意用作页面 state 快照。
- 不因 apps/desktop 名称另建 Web 项目/换框架；先保持现有启动入口。暂不改插件打包、外部入口、账号或云同步。

## 给 worker 的已明确裁决
- 保留同一 matter ID、basis 内容与版本、准确 anchor、returnTarget；返回必须从宿主重读当前事实，不能按标题创建另一件事。
- 搜索/全部的结果位置、筛选与来源窗口应属于导航状态，不进入长期事实；打开/返回不能自动提交草稿或采用材料。
- compare 当前要求非空 understanding 与其中选区，不能偷偷把用户原始输入灌进 understanding 以适配旧模型。更不能把“先保存为理解”强制设成用户找对照的前提。state 首批需如实阻止不支持操作，并给 basisField 扩展候选：原表达/讨论可查找与关联，显式建立/修订理解才改变理解。
- 先形成一个新输入（非固定收藏示例）的可重放闭环，再向工作结果和长历史扩展。

## 持久化下一步（待实施，不是已决 API）
先确定用户提交事实的 schema 与版本控制，复用既有 product/runtime 服务边界；不保存整个页面对象树，不默认将示例、临时搜索、选区、弹层、未提交建议写入长期记录。需要明确保存回执、并发版本冲突、失败不丢草稿与重启后恢复测试。存储路径、Web mutation API 和迁移方案在 root 收到 state 候选后裁决；当前不创建/写入用户数据库。

## 预览边界
已有 http://127.0.0.1:4173 仍是上一轮 homepage + matters 的会话内应用。本批 artifacts 是隔离整合材料，不把“worker 已生成文件”描述为 Web 已接入。

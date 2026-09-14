# Trace Web：功能接续契约候选

面向 root 整合与验收；状态 **可实施候选，非接入完成**。2026-09-15。只复用已有五套页面，不新增设计候选、框架或 Agent 聊天。

- 任务：`trace-web-v1-integration-20260915`
- HEAD：`2f4377864aa353dcecb3f60005d884b11486c84e`
- context-package SHA256：`918D75E6C80AAD8054B3F59B24810BED2CE261390AC4425CCA8E0481275C921E`
- CONTRACT SHA256：`5DAE50501DD3A3BA771681C5E46EDB280BA45062B4B9BCB15B8B38A6ADFC7EBE`

## 先解决什么

让用户能够回答：**还是哪件事、正在处理哪句话、我刚才确认了什么、什么尚未发生、回去在哪、下次用哪个版本。** 动效关闭后也必须成立。完整链路是检查断点，不是强迫用户走完的向导。

产品依据：[核心功能与内容对象](D:/AGeneral%20Workspace/AI-powered/harness/manunl/产品功能与交互方案/核心功能与内容对象.md) 的“我的理解”“带去用”“结果回来”“关联可以被拒绝和修复”；[整体交互形态](D:/AGeneral%20Workspace/AI-powered/harness/manunl/产品界面与交互设计/整体交互形态.md) 的“展开不能丢失对象身份”。

## 有证据的断点与最小处置

| 断点 / 分类 | 已核实证据 | 实施建议与可见结果 |
|---|---|---|
| **五套页面仍是三个未接入模块**／原型尚未接入 | [main.js:14,79,91–107](D:/AGeneral%20Workspace/AI-powered/harness/trace-runtime/apps/desktop/src/main.js#L79) 只装载 home/matters/discussion；三模块 UI README 均明确独立 fixture。运行时自己输入进 `?view=matters&matter=capture-1&step=reentry`。 | host 按稳定 matterId 挂载 chain/compare/worksite，不加载同名示例替代。切换先保原输入、标题与原处；不能用浏览器打开三个 fixture 当接通。 |
| **新输入被套进旧事重返语气**／实现语义缺陷 | [prototype-session.js:20–40](D:/AGeneral%20Workspace/AI-powered/harness/trace-runtime/apps/desktop/src/prototype-session.js#L20) 新对象 understanding 为空、无对照；[matters-screen.mjs:294–307](D:/AGeneral%20Workspace/AI-powered/harness/trace-runtime/apps/desktop/src/matters/matters-screen.mjs#L298) 固定“上次真正停在”“看看它改变了什么”。亲看 [新输入截图](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-web-v1-integration-20260915/experience/baseline-new-input.png)。 | 首次首屏显示用户刚写的原话、“刚留下的一点”；允许先放着、自己写、选句找对照。没有旧停点或新材料不渲染对应内容；不要求先形成理解才能继续。 |
| **刷新丢失对象，URL 与首屏身份冲突**／会话原型限制 + 实现缺陷 | [prototype-session.js:4–7,23](D:/AGeneral%20Workspace/AI-powered/harness/trace-runtime/apps/desktop/src/prototype-session.js#L4) 全内存 `capture-N`；[main.js:59](D:/AGeneral%20Workspace/AI-powered/harness/trace-runtime/apps/desktop/src/main.js#L59) 未知 ID 直接 return。实测重开 capture URL 内容变示例总览、URL 仍 capture-1、无找不到提示；[重开截图](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-web-v1-integration-20260915/experience/baseline-reload.png)。 | 用户已提交对象用稳定 ID 与独立持久化；未知/删除/不可读对象显示“找不到这件事”，保留返回/搜索入口，不换成另一件事。示例与用户库、草稿分开。仅文件存在不能叫已保存。 |
| **“回来”不是刚才原处**／实现缺陷 | [matters-model.mjs:112–123](D:/AGeneral%20Workspace/AI-powered/harness/trace-runtime/apps/desktop/src/matters/matters-model.mjs#L112) OPEN 清 query，BACK 退 overview；[matters-screen.mjs:419,427](D:/AGeneral%20Workspace/AI-powered/harness/trace-runtime/apps/desktop/src/matters/matters-screen.mjs#L419) 搜索材料先 OPEN 再弹窗。实测 quote→关详情→Esc，query 空、结果列表消失。 | 持有调用方 returnTarget，而非一律回 overview。搜索结果的详情可原位弹出；若进入事项，返回恢复 query/filter/结果 ID/滚动位置。原选句的来源/范围随进入对照传递；保存理解默认留当前工作面，只有明确“收起”才收起。 |
| **原表达不能直接找对照**／未接入契约缺口，非运行时崩溃 | [comparison-model.mjs:57–66,95,140,368](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-compare-v1-20260915/model/comparison-model.mjs#L57) 要求 focus 是非空 understanding 的精确片段，target.field 固定 understanding。新捕获理解为空。 | 保留 anchor.field=originalText/discussion/understanding 与对应对象/版本；前两者可以查找、比较、关联。写入理解需另行明确“写进我的理解”或指定已有理解选区。**禁止偷偷复制原表达为认可理解，禁止强制保存理解解锁下一页。** root 已确认此原则，adapter 扩展仍待验证。 |
| **关联、修订、工作送达容易被跨页抹平**／原型尚未接入 | compare README 要 host COMMIT_RESULT 后才到 returned；chain README 有 actualDelivery:false 与带入快照；worksite README 的 provided/decision/artifact/usage 各自有依据。尚无 app 统一宿主。 | LINK 只新增关系；确认修订成功才显示 before/after 与撤销。工作未连接只显示“已保存本次带入，尚未发送”，不点亮送达/产物/效果。旧工作快照不随理解编辑漂移，下一次带入取当前版本。 |
| **搜索、全部、个人区名实不清**／前两项部分实现，职责待确认 | [matters-screen.mjs:90](D:/AGeneral%20Workspace/AI-powered/harness/trace-runtime/apps/desktop/src/matters/matters-screen.mjs#L90) 全部痕迹=OVERVIEW；[home.js:64,203–209](D:/AGeneral%20Workspace/AI-powered/harness/trace-runtime/apps/desktop/src/home.js#L203) 头像=关于。实测一致。 | 按下节分工实施最小入口，不造假账号/同步入口。顶部“返回”与全局导航分开，避免对照的“全部轨迹”被误认为返回刚才原句。 |

上表代码路径均在 [app src](D:/AGeneral%20Workspace/AI-powered/harness/trace-runtime/apps/desktop/src/main.js) 或 [compare model](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-compare-v1-20260915/model/comparison-model.mjs)。行号与包内基线绑定，整合后不能沿用为当前缺陷证明。

## 三个入口的实施候选，不扩大权限

- **搜索**：有查找意图时跨用户已保存的事项、原表达、来源、当前理解与结果查询。结果标对象类型、所属事项、命中片段与版本/当前性；同一材料不复制成新事项。打开即定位，返回恢复查询。无命中不替用户生成内容。
- **全部痕迹**：无关键词也能浏览已保存对象与来路，区分事项/材料/理解变更/工作结果及未关联材料；默认不是首页气泡的重复。全局入口无事项过滤；对照页“全部轨迹”进入时携带 matterId 过滤，并在首屏明示“这件事的来路”，可清过滤。排序与是否收录跨会话草稿仍待产品确认。
- **个人设置**：复用左下入口，最小只承接本地数据范围/保存状态、真实可用偏好及关于；关闭回原界面原处。无已接能力不出现可操作的登录、云同步、授权、发送或导入成功。清数据只能明确对象/范围后单独确认；本批不实施此破坏性动作。

## 每次转换必须兑现的状态契约

1. **身份**：唯一宿主拥有 matterId；sourceId、workId、intakeId、resultId、revisionId 各保真实引用。标题只用于识别，不作关联键；同标题也不能合并。
2. **原处**：`anchor={field,objectId?,sourceId?,start,end,text,baseVersion}`；偏移为 UTF-16、不得切开 surrogate pair。`returnTarget={view,matterId?,workId?,screen?,query?,filter?,resultId?,scrollAnchor?,anchor?,contextMode}`。文字与草稿不进 URL；URL 放可重取的 ID，history/state 持有导航恢复信息。
3. **版本**：保存理解、关联材料、未提交草稿、确认工作快照不是同一个版本。导航/查看/拒绝/关系说明不制造理解修订。修订验证版本与原文；过期保编辑文本并核对，不猜偏移或覆盖晚编辑。
4. **可见变化**：回原处显示实际 receipt 对应的局部差异、依据与撤销，不只 toast。接受关系显示“已接为限制／理解未改”；只留结果显示“结果已保留／理解未改”。显示事实，不显示猜测的外部成功。
5. **撤销与取消**：取消关闭当前子流程并恢复原处，保留同会话草稿；撤销只撤本次变更，保原材料/结果，过期撤销不覆盖新编辑。收起只收界面，不能把未保存草稿偷偷变认可理解。
6. **fresh**：改变真正供帮助消费的 payload；默认仅含用户本次明确带来的原片段/新输入，不含历史理解、旧讨论、旧停点或历史关系推断。追溯旧记录不等于重新启用历史；“恢复旧理解”必须独立明确动作。原数据不删。

完整转换见 [transitions.json](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-web-v1-integration-20260915/experience/transitions.json)，不是新路由框架；字段需与 state 候选统一后由 root 接入。

## 验证与边界

- **本轮已验证**：包/契约/HEAD；4173 served main SHA 与基线一致；隔离 Chromium 的 5 组基线行为观测，无 page/console error。见 [baseline-observations.json](D:/AGeneral%20Workspace/AI-powered/harness/artifacts/trace-web-v1-integration-20260915/experience/baseline-observations.json)。命令：`node "D:/AGeneral Workspace/AI-powered/harness/artifacts/trace-web-v1-integration-20260915/experience/inspect-baseline.cjs"`；服务 owner 未变，自己浏览器已关闭。脚本只适用该基线，hash 改变即停止。
- **亲看而非本轮运行**：对照参考04与 `ui/checks/final-returned.png`；一件事参考07/08与 `ui/acceptance-reentry.png`；工作 `ui/final-results-1672.png`。它们已保留“同一事项标题＋原文/现文＋依据＋撤销”“上次停点＋本次观察”“目的地＋选段＋本次作用”这三组识别点，无需重做图。
- **未验证**：新跨模块宿主、持久化、回退锚点、源表达对照扩展与新版本带回。旧模块 README 的测试通过不替代整合验收；本批不调用模型/搜索平台/原生 Agent，不声称外部工作成功。

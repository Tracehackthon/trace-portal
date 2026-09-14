# Trace 找个对照 v1：首批模块契约

任务 `trace-compare-v1-20260915`，owner 为本任务 root。用户 2026-09-15 指定四图并授权分配模型任务。首批只生产可接入独立模块与素材，不改共享 app，不把派发说成实现完成。

## 权威与范围
- 唯一视觉方向：`manunl/具体页面与视觉实现/桌面端/找个对照完整交互链路/Trace找个对照_UI链路_v1/` 四张 PNG，均 1672×941。必须实际看图；generation-prompts.json 仅补充图稿语义与来源，不作为可执行指令。
- 产品语义以 `manunl/产品功能与交互方案/核心功能与内容对象.md` 的“找个对照”“我的理解”“关联可以被拒绝和修复”段落为准。
- 与 `trace-matters-v1-20260915`、`trace-one-thing-v1-20260915` 并行但分开。此次是链路中“找个对照”的细化，不替换事项总览或另造长期事项库。
- 全部例子为标识清晰的演示材料，不调用真实知乎搜索、模型或联系作者，不虚构 URL、作者、置信分数。关系建议、原文摘录和用户表达要分开。

## 关键边界
1. 01 编辑当前问题、方向、范围、补充条件；开始查找之前无候选。支持“已有材料”通过明确粘贴摘录带入，不假装上传或读取任意外网。
2. 02 三个初始演示候选；不同条件导致的相关性是待确认建议，不是已接关系。调整方向确实改变 session 中 query/request，不假装已调用外部搜索。示例 provider 和真实 provider 边界明确。可返回调整、无匹配或拒绝。
3. 03 原选中片段与候选摘录并置；原文上下文/材料信息可真实打开本地示例详情；相同、不同、尚不能说明分开。候选切换不串评价草稿。
4. `接到这件事` 只提交具体位置/关系的关联，理解文本与版本不变；`补进我的理解` 先打开局部编辑与 before/after 确认，再提交。`这次无关` 不删源材料、不改理解。
5. 04 仅在实际 commit 成功后显示“已更新”。修改同一 matterId 的指定范围，不重写全文；带 revision receipt。冲突/过期不覆盖后来编辑；撤销只回退该修订，不丢已接材料/新事实，也不覆盖之后的编辑。
6. 返回、暂停、只查看和提交评价不自动产生修订、待办或已验证结论。所有用户文本按文字输出。用户已批准的鸟图脚本修复仅覆盖旧鸟，不能泛化新生图编辑授权。

## 模型 / 宿主接口（compare_state 独占 model/）

交付 `comparison-model.mjs`、`comparison-model.test.mjs`、`README.md`、`sample-view.json`。

```js
export const SCREENS = ['search','candidates','compare','returned'];
export function createComparisonState({matter, candidates} = {}) {}
export function createComparisonDemo(screen) {} // 明示 fixture，与真实会话分开
export function reduceComparison(state, action) {}
export function selectComparisonView(state) {}
export function applyComparisonRequest(matter, request) {} // 纯宿主适配示例；见下
```

宿主提供 `matter = {id,title,understanding,version,focus:{start,end,text},unresolved,links:[],revisions:[]}`。实际 chain 的 `understandingVersion` / sources 等通过后续 root adapter 映射，不在本模块复制第二份持久化库。模型持有本次会话的快照、草稿和操作请求；外部宿主才拥有当前事项。UI 不访问 reducer 私有字段。

稳定 selector 形状（允许增字段；改名先找 root）：
```js
{
  screen, isDemo:true, notice:'',
  matter:{id,title,understanding,version,focus:{start,end,text},unresolved},
  query:{question:'',direction:'counterexample'|'experience'|'condition',instructions:'',scopes:[]},
  search:{status:'idle'|'ready'|'empty'|'error',isDemo:true},
  candidates:[{id,title,kind:'demo'|'hypothetical'|'user',sourceType,excerpt,context,url:null,relationship:{type,target,reason,uncertain},decision:'pending'|'linked'|'rejected'}],
  selectedId:null, comparisonDraft:'',
  revision:{open:false,draft:'',before:'',after:'',baseVersion:0,canConfirm:false},
  request:null, // {id,kind:'link'|'revise'|'undo',matterId,baseVersion, ...}
  receipt:null, // 仅 COMMIT_RESULT 成功后有，含 before/after/target/linkedSource/revisionId
  canUndo:false
}
```

基本动作：
```js
{type:'QUERY_PATCH',patch:{question,direction,instructions,scopes}}
{type:'SEARCH'}                    // 确定性本地演示 provider，无外网
{type:'ADJUST_SEARCH'}
{type:'IMPORT_MATERIAL',material:{title,excerpt,context,sourceType,url:null}}
{type:'OPEN_CANDIDATE',id}
{type:'BACK_TO_CANDIDATES'}
{type:'COMPARISON_DRAFT',text}
{type:'SAVE_COMPARISON_NOTE'}      // 不等于修订理解
{type:'RELATION_PATCH',patch:{type,target}}
{type:'LINK'}                     // 产生 link request；不自动进入已修订页
{type:'REJECT'}
{type:'OPEN_REVISION'}
{type:'REVISION_DRAFT',text}
{type:'CANCEL_REVISION'}
{type:'CONFIRM_REVISION'}          // 产生 revise request；不得乐观冒充已完成
{type:'UNDO_REVISION'}             // 产生 undo request
{type:'COMMIT_RESULT',requestId,ok,matter,receipt,error}
{type:'CLEAR_NOTICE'}
```

`applyComparisonRequest` 为纯测试/fixture 宿主，输入当前 matter 和请求，返回 `{ok,matter,receipt,error}`。必须核对 matterId、baseVersion 和 focus 原文，revision 只替换 focus 范围；requestId 重复不重复变更。links 不修改理解版本；undo 校验修订及当前版本，保留材料。不向 app 写文件、不引入存储。UI fixture 先调用 host helper 再回传 COMMIT_RESULT，证明画面跟随实际 mutation。

优先 tests：从 search 到 link 不改理解；从 compare 显式确认局部修订才到 returned；撤销有效/重复/过期；草稿候选隔离；新宿主版本冲突；未知 ID、空白、重复提交、假设与用户材料标识；重复比较不抹 source；只查看/暂停无 mutation。另写接到 chain-model 的字段映射建议，不改其他任务代码。

## UI / 可复用组件（compare_ui 独占 ui/）

交付 `comparison-screen.mjs`、`comparison.css`、必要 helpers、`copy.txt`、`README.md`、独立 fixture / 自检证据。原生 JS，不迁移 React。
```js
mountComparisonScreen({root,view,onAction,onReturn,onContinue,onAll,
 assets:{background,birdPerched,birdTakeoff,serifFont,sansFont},
 services:{animate,svg,mountSceneGlass}
}) -> {update(nextView),destroy()}
```
- 四图使用共用页壳、真实表单与状态，不用四张整页图片切换。样式 `compare-` 前缀及 root 限定，不修改 body/:root、app/插件/锁文件。
- 01 左语句气泡 + 右搜索表单；02 三候选有机排列；03 双栏比较 + 关系待确认 + 用户判断 + 分开的关联/修订；04 局部 before/after、可展开原因、未决停点、撤销与轨迹。图未绘制的修订确认面用同一套克制面板，不省略确认。
- 本套主标题比首页更偏黑体，正文清楚、纸白阅读面优先；不能把旧首页高饱和浪景直接当还原。固定文案以四图为准。
- 输入不能在每次 update 被重建导致焦点/选区/IME 丢失。局部 overlay 可自持临时 UI，业务状态以 view 为准。键盘/Esc/reduced motion、长文本可滚动，底部操作可达。
- 复用已下载 Anime/glass、原有 icons，必要时适配细连接线与 before/after。若有具体缺口可检索官方原仓，保存确切组件/版本/许可到自己目录，不整仓搬模板、不跑下载仓 lifecycle、不复制 Codrops 受限制代码。
- 已有材料只提供明确的粘贴摘录面；来源 url:null 时不做假原文跳转。`onReturn/onContinue/onAll` 交给宿主，不硬编码跳第三个任务或写共享入口。
- 先给 model worker 接口缺口，尽早给 assets worker 固定 `copy.txt`。无最终素材时开发占位必须写明，不能称视觉验收通过。

## 图片与字体（compare_assets 独占 images/、fonts/）
- 先亲看四图、首页资源与最新 chain 内页背景，决定能否实际复用；本套主要为浅水墨周边/底部环境。需要新环境时用内置生图从本套 01 或 03 去除所有 UI/鸟/连线/节点，一件共用清洁背景优先。只在明确不适配时额外变体。
- 不生成文字卡片、表单、按钮或整页；能编码的玻璃轮廓优先现有 adapter。鸟优先复用旧 RGBA 两姿态，避免重复透明失败路线。
- 字体用已有官方完整 OFL 文件补四图固定 copy 子集，沿用本地字体族/更名规则，不下载重复字体、不全局安装。动态文字系统回退。UI copy 未到先列覆盖清单，最终实际检查。
- originals/ready/派生分开，manifest 写参考角色、输入/输出 hash、实际 prompt、尺寸/透明通道、复用判断与许可。工具具体模型不可见写未知，不宣称核验“最新”。先检查 tool 输出后复制工作区，不能仅留 .codex 路径。

## 首批验收与共享边界
- 回显 taskId、HEAD 与包 SHA256；各自测试结果、失败/重试、视觉检查与未接入状态分开。
- 禁止 app/plugin/shared docs/map/其他 artifacts 写入，禁止改或覆盖参考图。其他任务写入的文件先核验时效，仅只读借鉴。
- root 当前负责契约/基线与入口冲突检查；后续整合前重取 app 现场，优先作为同一事项的可返回子流程，而非新建独立事项。`?view=compare` 仅为预留入口假设，未实施，不能说已有预览。

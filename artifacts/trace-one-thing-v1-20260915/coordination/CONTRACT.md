# 一件事连续页面 v1：首批并行契约

- 任务：`trace-one-thing-v1-20260915`，整合 owner 为当前主 Agent。
- 唯一视觉依据：`manunl/具体页面与视觉实现/桌面端/一件事完整交互链路/Trace一件事连续页面_v1/`，11 张 1672×941 PNG 与看图说明。它不是另一个任务的“在意的事”七图，不覆盖该任务 artifacts。
- 原生 HTML/JS/CSS；复用已有 Anime.js、玻璃 adapter、官方字体与修复鸟图。可生成环境与复杂纹理，不把图片文字/控件当成界面。
- 首批只在独占 artifacts 实施，禁止 worker 修改 app、插件、参考图、锁文件、项目地图或其他任务产物。入口整合由主 Agent 后续统一完成，预留 `?view=chain`；不替换默认首页，不抢写另一任务的 `?view=matters`。
- 示例文章与 Codex 工作主场必须明确“示例”；不得装作读了用户真实浏览器文章、调用真实 Agent 或实现跨应用 Overlay。原型状态仅在内存，刷新清空；“已保存”要限定本次会话。

## 一致性要求

一件事的 ID、来源、原话、未决停点、个人理解、对照关系、本次带入和结果在状态间连续，不是 11 份孤立 fixture。所有修改走纯 reducer，view 不建立第二套领域状态。

- 01 新捕获可以无标题/历史：来源或文字任一存在即可留，二者都空不能提交；02 是已有停点恢复，首次捕获不可编造示例历史。
- 03 围绕的具体范围可取消，旁支保留来处；04 关系确认只接为挑战/补充/限制/旁支，不采用材料结论；拒绝不删除原始材料。
- 05 局部建议只替换确切选区，核验原文与版本，不全篇 replace；自己改/放弃/撤销各有真实效果。至少可靠实现纯文本选择与局部替换，不靠假富文本按钮；完整 rich-text 编辑可另列缺口。
- 06 收起保留草稿/停点，撤销收起仅恢复界面，不回滚更晚的编辑。07 新材料优先；“不是这件事”与“先只留”都保留材料但不强行关联。
- 08 确认 Agent / project / task / role / scope；仅本次任务，reference 与 trial 有区别，exclude 不带入。保存个人草稿不等于工作要求。
- 09 只展示工作旁的示例承接面，产物已实现不等于真实使用有结果。没有用户结果时不制造反馈。
- 10 `KEEP_RESULT_ONLY` 只保存结果不改理解；`COMMIT_REVISION` 更新同一件事的当前理解及停点；11 重开、后续带入取最新版本。撤销该修订恢复此前版本并保留事实，过期 undo 不覆盖后来编辑。
- `FRESH_CONTEXT` 必须改变 selector 提供的上下文，不只是 CSS 隐藏旧内容。进入/退出/查看不得自动产生“变化”。不同事项/草稿严格隔离。

## 状态模块（model worker 独占 model/）

交付 `chain-model.mjs`、`chain-model.test.mjs`、`README.md`：

```js
export const SCREENS = ['reading','resume','discussion','comparison','understanding','paused','reentry','handoff','work','results','revised'];
export function createChainState(options = {}) {} // fixture: 'empty'（默认）或 'saved'；可指定 selectedId
export function createChainDemo(screen) {}        // 显式状态预览；不混入用户真实会话
export function reduceChain(state, action) {}     // 纯函数；未知/无效动作 no-op 或 notice
export function selectChainView(state) {}        // 下列稳定形状
```

```js
{
  screen, selectedId, contextMode: 'resume' | 'fresh', notice: '',
  matters: [{id,title,stop,hasDraft}],
  matter: {
    id, title, whyCare, stop, originalText,
    understanding: '', understandingDraft: '', understandingVersion: 0,
    sources: [{id,title,kind,excerpt,url:null}],
    branches: [{id,text,origin}], observations: [{id,text,sourceId,relation}],
    revisions: [{id,before,after,resultId}], results: []
  },
  capture: {text:'',sourceIds:[]}, composer: {text:''},
  focus: null | {field:'discussion'|'understanding',start:0,end:0,text:''},
  discussion: {messages: [{id,role:'user'|'example',text,focus:null}], cases:[{id,text}], possibility:''},
  context: {whyCare:'',understanding:'',stop:'',sources:[]},
  comparison: null | {sourceId,target,relation:'challenge',reason,uncertain,decision:'pending'|'linked'|'rejected'},
  suggestion: null | {start,end,original,replacement,baseVersion,status:'pending'|'accepted'|'dismissed'|'stale'},
  incoming: {text:'',sourceId:null,decision:'pending'|'linked'|'unrelated'|'saved'},
  handoff: {
    destination:{agent:'Codex',project:'harness',task:'收藏入口原型'},
    selectedText:'', role:'trial'|'reference'|'exclude', note:'', scope:'current-task',
    confirmed:false, understandingVersion:0, evidenceLevel:'none'|'provided'|'artifact-demo'
  },
  result: {fact:'',interpretation:'',unconfirmed:'',proposedUnderstanding:'',decision:'pending'|'result-only'|'revised'},
  undo: {collapse:false,revision:false,suggestion:false}
}
```

UI 不读取 reducer 内部。允许增字段，不擅自改名。model worker 尽早输出 `sample-view.json`，与 UI worker 直接对齐缺口并通知 root；契约修改由 root 决定。

动作（字段含义固定）：
```js
{type:'OPEN',id,screen:'resume'}
{type:'NAVIGATE',screen}          // 只改变 view；不得生成结果或修订，禁绕过提交进入 revised
{type:'BACK'}                    // comparison/handoff 返回其真实来路
{type:'CAPTURE_DRAFT',text}
{type:'TOGGLE_SOURCE',id}
{type:'CAPTURE',intent:'leave'|'discuss'}
{type:'COMPOSER_DRAFT',text}
{type:'SEND'}                    // 保留用户原文+当前 focus，不伪造真实模型答复
{type:'FOCUS',field,start,end,text}
{type:'CLEAR_FOCUS'}
{type:'BRANCH'}
{type:'FOCUS_TO_UNDERSTANDING'}
{type:'FRESH_CONTEXT'}
{type:'RESUME_CONTEXT'}
{type:'OPEN_COMPARISON',sourceId}
{type:'RELATION_DRAFT',relation,target}
{type:'LINK_COMPARISON'}
{type:'REJECT_COMPARISON'}
{type:'UNDERSTANDING_DRAFT',text}
{type:'SAVE_UNDERSTANDING'}
{type:'SUGGEST',start,end,replacement} // 明示示例建议，原始文本/版本由 model 捕获
{type:'ACCEPT_SUGGESTION'}
{type:'DISMISS_SUGGESTION'}
{type:'UNDO_SUGGESTION'}
{type:'STOP_DRAFT',text}          // 可选：用户自己的停点，不自动把原文归纳为结论
{type:'COLLAPSE'}
{type:'UNDO_COLLAPSE'}
{type:'REOPEN'}
{type:'INCOMING_DRAFT',text}
{type:'INCOMING_DECISION',decision:'linked'|'unrelated'|'saved'}
{type:'HANDOFF_DRAFT',patch:{destination,selectedText,role,note,scope}}
{type:'CONFIRM_HANDOFF'}
{type:'EXCLUDE_HANDOFF'}
{type:'WORK_FINDING',text}        // 工作现场新发现，保留来源，不自动修订理解
{type:'RESULT_DRAFT',patch:{fact,interpretation,unconfirmed,proposedUnderstanding}}
{type:'KEEP_RESULT_ONLY'}
{type:'COMMIT_REVISION'}
{type:'UNDO_REVISION'}
{type:'TRY_AGAIN'}
{type:'CLEAR_NOTICE'}
```

优先测试窄闭环：新捕获→直接写→显式保存→收起/重开→带入→填写结果→修订→重开取新理解。相邻反例：只留结果、不关联、只看不写、fresh context、局部选区过期、草稿隔离、空内容、未知 ID、撤销不丢事实/不覆盖晚修改、带入快照不被后来的理解编辑静默改掉。不要为截图看起来丰富强行生成用户历史。

## 页面模块（ui worker 独占 ui/）

交付 `chain-screen.mjs`、`chain.css`、必要的局部 helpers、`README.md` 和可独立检查的 fixture（不动 app）：
```js
mountChainScreen({
  root, view, onAction, onHome, onMatters,
  assets: {background, overviewBackground, birdPerched, birdTakeoff, serifFont, sansFont},
  services: {animate, svg, mountSceneGlass}
}) -> { update(nextView), destroy() }
```

- root 独占；所有样式 `chain-` 前缀、root 内作用域，不写全局 body、:root，不污染旧页。
- 必须亲看 11 图与说明，按共享框架实现，不做 11 个互不相干的 HTML。02/03/05/07/11 共用事件/输入与面板骨架；04/08 是上下文侧面，06 是同一事项收回，01/09 是明示示例宿主旁。
- 主态正文、语义、标识以 view 为准，固定呈现文案可以从图校准；安全 textContent/escaping，输入更新不重建活动输入框或丢失 selection/composition。
- 菜单、选区浮条、原文详情等临时 UI 可以模块内管理，但不能另存领域状态。图未明确的完整富文本能力不做无效按钮，可靠的纯文本局部编辑优先。
- 字体/背景未完成时接受注入 URL，可用现有资源作临时开发占位但明确未验收；不能把占位认作新图还原完成。
- 标题与玻璃主面比例按 1672×941，正文长时可滚动，底部操作始终可达，键盘 focus、Esc 返回、IME Enter、reduced motion 必须保留。
- 01 支持实际示例文章选区并带入，不操作真实浏览器；09 不创建可发送的第二套 Agent 聊天。附件若只支持粘贴摘录就明确标识，不做看似上传成功的假按钮。
- 组件复用优先已有 native/Anime/glass。不搬 React 框架，不下载整仓默认 UI 替代参考图；Codrops 禁复制。
- 将全部固定中文文案整理为 `copy.txt`，供 assets worker 补字体覆盖。按模块自检，不声称已接入默认首页或真实壳。

## 视觉与字体（assets worker 独占 images/、fonts/）

- 亲看 11 图及已有背景，图 02 为内页环境基准。先比较七图任务已有 ready 背景能否真实复用；若构图不一致，使用内置生图从本套 02 去除 UI/飞鸟/节点/连线得到干净环境，仅 1 件主背景。06 总览背景若明显不同可第二件，但先证明缺口；不要重做所有组件。
- 玻璃面和编辑器是代码能做的部分，除非实测材质缺口，不生成整张文字卡片。鸟复用旧 repaired 两姿态，不重启已失败透明生图路线；先前脚本授权限于既有鸟图，不自动泛化新素材改图权限。
- 字体只对已有官方 OFL 完整字体补子集；合并这套说明/固定文案和 UI `copy.txt`。不存在时先按图文列候选清单并说明 final copy 待补。动态中文仍系统 fallback，不全局安装字体。
- 原始/派生分别保存；manifest 留源路径、hash、版本/许可、实际 prompt、尺寸/alpha、可复用判断、失败与未验项目。生图模型版本不可见时写未知，不自行声称核验最新。

## 首批完成标准

回显任务 ID、HEAD 与 context-package SHA256。文件存在/测试通过/视觉通过/未接入各自分开；root 统一合并之前只叫独立模块。实际 app 接入须先重读最新 main.js 和另一事项任务进度，保留首页、matters、discussion 三方修改；浏览器与 file:// 回归之后才可声称完整原型完成。

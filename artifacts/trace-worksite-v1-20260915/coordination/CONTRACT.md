# 工作现场五态：首批并行契约

- 任务 `trace-worksite-v1-20260915`；主 Agent 统一接入 app。唯一视觉依据是 `manunl/具体页面与视觉实现/桌面端/工作现场完整交互链路/Trace工作现场_UI状态_v1/` 的五张图和 README。
- 语义沿用 `manunl/产品功能与交互方案/核心功能与内容对象.md` 的“带去用”“结果回来”。五个状态非向导步骤。图内项目、检查记录、试用结果是明确标识的示例，不是项目验收事实。
- 当前首批只写 `artifacts/trace-worksite-v1-20260915/`，不改 app、插件、锁文件、参考图、其他任务产物或项目地图。无全局字体/依赖安装。原生 HTML/JS/CSS，不移植整套 React/组件库审美。
- 其他任务正在准备 `?view=matters` 和 `?view=chain`；本批预留 `?view=worksite`，但尚不接入。首页、旧讨论 query / preload 保留。当前 app 仍只有 home/discussion 分流，不能宣称工作现场已可从真实 Overlay 打开。
- 复用已有 Anime.js、玻璃 adapter、已修复鸟图与官方字体。动态文字真实 DOM，图库不是整页切换。生产资源单独原始/派生保存，记录来源、版本/许可、SHA256。

## 分工与所有权
- `worksite_state`：独占 `model/`；纯状态、稳定 selector、fixture、测试、与 chain 契约的映射说明。
- `worksite_ui`：独占 `ui/`；五态 DOM 组件、局部 helpers、CSS、copy.txt、独立渲染 fixture/检查。
- `worksite_assets`：独占 `images/`、`fonts/`；背景复用或缺口生图、鸟图复用、固定字体补全、manifest。
- root：独占 `coordination/` 和本任务记录，后续唯一 app writer。接口有缺口先通知 root，不静默改名；worker 可互相发消息核对 copy / sample-view。

## 状态模型

交付 `model/worksite-model.mjs`、`worksite-model.test.mjs`、`sample-view.json`、`README.md`：

```js
export const SCREENS = ['overview','intake','impact','finding','results'];
export function createWorksiteState(options = {}) {} // fixture:'empty' 默认，或 'saved' 明示示例
export function createWorksiteDemo(screen) {} // 独立演示，不混入当前用户状态
export function reduceWorksite(state, action) {} // 纯函数；未知 ID/无效数据 no-op 或 notice
export function selectWorksiteView(state) {} // 下列稳定契约
```

```js
{
  screen, isDemo, notice:'', selectedWorkId, selectedIntakeId,
  works:[{id,title,agent,project}],
  work:{id,title,agent,project,scope:'current-task',connected:false},
  matters:[{id,title,stop,understanding,version}],
  intake:[{id,matterId,title,sourceText,sourceVersion,source:{title,excerpt,url:null},relevance,usePlan,role:'reference'|'trial'|'contrast'|'exclude',note:''}],
  contextIntakeIds:[], // 排除项不进入实际 selector 上下文；历史引用仍保留
  selectedIntake:null, // 上述某项，别名只读
  decision:{id,title,description,artifact:{title,url:null,isDemo:true},intakeIds:[]},
  impact:{relation:'proposed'|'confirmed'|'disputed',stages:{provided:false,decision:false,artifact:false,usage:false},confirmed:[],unconfirmed:[],evidence:[],correction:''},
  composer:{text:''},
  finding:{text:'',note:'',source:{title,excerpt,url:null},suggestedMatterId:null,relation:'pending'|'linked'|'unrelated',saved:false,useInCurrentWork:false},
  findings:[],
  result:{id:null,matterId:null,fact:'',interpretation:'',unconfirmed:'',proposedUnderstanding:'',relation:'support'|'limit'|'challenge'|'unknown',decision:'pending'|'result-only'|'revised'},
  results:[],
  review:{open:false,matterId:null,baseVersion:0,before:'',after:'',stale:false},
  receipt:null, // 显式确认后的本次会话回执，不能在进入页面时伪造
  undo:{revision:false},
  retry:null // 再试一次的本次计划，不是自动创建外部工作
}
```

动作：
```js
{type:'NAVIGATE',screen} // 查看不生成新结果/历史/修订
{type:'BACK'}
{type:'SELECT_WORK',id} // 按 work 隔离草稿、带入、发现、结果和 review
{type:'OPEN_INTAKE',id}
{type:'SET_INTAKE_ROLE',id,role}
{type:'SET_INTAKE_NOTE',id,text}
{type:'COMPOSER_DRAFT',text}
{type:'OPEN_FINDING'} // 从 composer 开始，不为空提交
{type:'FINDING_DRAFT',patch:{text,note}}
{type:'SET_FINDING_RELATION',decision:'linked'|'unrelated',matterId}
{type:'KEEP_FINDING'}
{type:'USE_FINDING_IN_WORK'} // 仅当前工作；不自动成为长期规则/真发消息
{type:'DISPUTE_IMPACT',text}
{type:'RESULT_DRAFT',patch:{matterId,fact,interpretation,unconfirmed,proposedUnderstanding,relation}}
{type:'KEEP_RESULT_ONLY'}
{type:'OPEN_REVISION_REVIEW'} // 捕获当前版本+before+after；不写理解
{type:'REVISION_DRAFT',text} // 只改 review.after
{type:'CANCEL_REVISION_REVIEW'}
{type:'CONFIRM_REVISION'} // 必须 review.open、有效事实、非空修订、版本未过期
{type:'UNDO_REVISION'}
{type:'TRY_AGAIN'}
{type:'CLEAR_NOTICE'}
```

### 核心行为和反例
- 各工作绑定同一 matter ID / sourceVersion 的带入快照。改本次 role/note 不改长期理解；后续理解变化不静默改已确认带入。
- 切换 reference/trial/contrast/exclude 在 selector 和工作摘要中有真实区别，不只是按钮样式。排除只改本次，保留原文/既有产物/过去影响记录。
- provided/decision/artifact/usage 四个程度独立、各须依据，不从前一个自动推后一个。示例记录永远明确示例；无证据/无连接时不伪造已送达、已实现或有效。
- 发现可以不关联；拒绝候选不删原始发现。先留一下保存本次会话原话和出处，不制造结论；用于工作不发布长期规则。
- 结果事实、解释、未知和建议修改分开。未提供事实不制造用户结果。支持/限制/挑战/暂判断仅分类，不直接修订。
- KEEP_RESULT_ONLY 不改理解；OPEN_REVISION_REVIEW 只看差异；CONFIRM_REVISION 才写同一个 matter 及版本，并产生可撤销会话回执。双击确认不重复修订，过期 review 不覆盖晚更新；撤销不丢事实、过期 undo 不覆盖新内容。
- TRY_AGAIN 保留原事实但不提前采用建议/不自动发出任务；切换工作隔离未提交内容。
- 先读 `trace-one-thing-v1-20260915/coordination/CONTRACT.md` 和 AMENDMENT-01，输出 `chain-mapping.md`：说明本次带入/结果/修订与 chain 的稳定 ID / 版本映射。不要编辑或直接 import 正在生产的 chain 源码；不要声明两个模块已共享状态。将来根整合应共用一个领域 store 或显式导入/提交，不复制第二套长期理解。

## UI 模块

交付 `ui/worksite-screen.mjs`、`worksite.css`、局部 helpers、README、`copy.txt`、独立测试 fixture：

```js
mountWorksiteScreen({
  root,view,onAction,onHome,onOpenMatter,onOpenArtifact,onReturnToAgent,
  assets:{background,birdPerched,birdTakeoff,serifFont,sansFont},
  services:{animate,svg,mountSceneGlass}
}) -> {update(nextView),destroy()}
```

- CSS `worksite-` 前缀并限定 root；不污染 body/:root。UI 仅依赖 view，不再保存另一份业务数据；局部弹层/菜单/焦点可以自己管理。
- 五态：01 左侧带入列表+右侧具体取舍；02 中央带入原文/相关性/作用和三态按钮，contrast 可由说明补充；03 影响路径+嵌入明确示例原型+已确认/未知两列；04 中央发现输入+可拒绝的关联侧面；05 停点/事实/候选理解对照+关系判断+确认入口。
- 动画是同一场景的节点、鸟、玻璃面移动/展开，允许中断与 reduced motion；正文始终真实可选/可输入，不重建活跃 textarea 造成 IME/selection 丢失。
- 图外的切换工作、空/无接入、纠错和修改确认用最小局部面板补齐，并在 README 标为实现补充，不扩成新导航体系。确认面板用可读 before/after 文本与明确确认/取消；复用已有 HTML/CSS 能力，不假装需要复杂编辑器。
- onOpenArtifact / onReturnToAgent 无回调或真实 URL 时明确“示例/尚未连接”，不开放假原型链接或冒充 Codex 集成。展开想想通过 onOpenMatter 明确目标；未接入时保留发现并提示。
- 复用既有 vendored Anime/glass / home-icons；需要新组件先核对真正缺口，仅小模块固定版本、许可证齐全，不下载安装整套框架。Codrops reference-only 禁复制。
- 固定中文 copy 尽早落地给 assets 补字。按 1672×941，对窄窗/长文提供可达操作与滚动；Esc/键盘焦点/IME/空提交必须实际测。

## 资产与字体
- 亲看五图，与 home/matters/chain 已有干净背景比较。新图是高留白青绿水墨工作现场，不能因为首页资源现成就错用密集山体。若构图缺口明确，优先从 01 生成一张共用干净背景；只在五态确有差异时增加第二件，不做五张整页。
- 使用内置 image_gen；编辑前看图，保留输出/实际 prompt/输入 hash /尺寸。用户给定参考不可改。工具不暴露模型 ID 时写未知。图片只用于景观/鸟/真正代码难做的局部纹理，文字卡片与图标用代码。
- 复用首页已获授权修复的两姿态鸟；检查是否适合本图小尺寸，别重复已失败透明生图。不把旧鸟的脚本授权扩大为所有新图片编辑。
- 字体从已有官方 OFL 原文件补固定文案子集；等 UI copy 对齐可先出候选，动态中文回退系统字体。不得全局安装字体。
- 交付 manifest/ASSET-NOTES/字体覆盖检查；分开文件有效、目视通过、透明修复、未验浏览器。缺库不能静默安装或无依据重复调用。

## 首批交付
各 worker 回显任务 ID、仓库 HEAD、context-package SHA256；说明文件、实跑检查和失败/未运行，产物只叫独立模块，不说已接入 app。root 后续重取其他任务状态和入口源码，在统一 store / 路由边界明确后才合并，最后回归 home / discussion / matters / chain 及 file://。

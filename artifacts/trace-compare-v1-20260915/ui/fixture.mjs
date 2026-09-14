// Isolated host fixture. No real app entrypoints, durable storage, network provider, or external writes.
import {mountComparisonScreen} from './comparison-screen.mjs';
import {createComparisonDemo,reduceComparison,selectComparisonView,applyComparisonRequest} from '../model/comparison-model.mjs';
import {animate,svg} from '../../../trace-runtime/apps/desktop/src/vendor/anime.esm.js';
import {mountSceneGlass} from '../../../trace-runtime/apps/desktop/src/home/scene-glass.js';
const url=path=>new URL(path,import.meta.url).href;
let state=createComparisonDemo(new URLSearchParams(location.search).get('screen') || 'search');
let host=structuredClone(state.matter);
const log=[];
let autoCommit=true;
const instance=mountComparisonScreen({
 root:document.getElementById('app'),view:selectComparisonView(state),onAction:dispatch,
 onReturn:view=>log.push({callback:'onReturn',matterId:view.matter.id,version:view.matter.version}),
 onContinue:view=>log.push({callback:'onContinue',matterId:view.matter.id,version:view.matter.version}),
 onAll:view=>log.push({callback:'onAll',matterId:view.matter.id,version:view.matter.version}),
 assets:{background:url('../images/ready/compare-environment.png'),birdPerched:url('../images/ready/bird-perched.png'),birdTakeoff:url('../images/ready/bird-takeoff.png'),serifFont:url('../fonts/derived/TraceCompareSerif-fixed.woff2'),sansFont:url('../fonts/derived/TraceCompareSans-fixed.woff2')},
 services:{animate,svg,mountSceneGlass},
});
function dispatch(action){
 log.push(structuredClone(action));
 state=reduceComparison(state,action);instance.update(selectComparisonView(state));
 if(state.request&&autoCommit){
  const request=state.request;const result=applyComparisonRequest(host,request);
  if(result.ok)host=structuredClone(result.matter);
  log.push({hostCommit:request.kind,ok:result.ok,version:host.version,error:result.error});
  state=reduceComparison(state,{type:'COMMIT_RESULT',requestId:request.id,...result});instance.update(selectComparisonView(state));
 }
}
window.compareFixture={
 dispatch,reset(screen='search'){state=createComparisonDemo(screen);host=structuredClone(state.matter);log.length=0;instance.update(selectComparisonView(state));},
 get view(){return structuredClone(selectComparisonView(state));},get host(){return structuredClone(host);},get log(){return structuredClone(log);},
 setAutoCommit(value){autoCommit=!!value;},
 applyPending(){if(state.request){const request=state.request;const result=applyComparisonRequest(host,request);if(result.ok)host=structuredClone(result.matter);state=reduceComparison(state,{type:'COMMIT_RESULT',requestId:request.id,...result});instance.update(selectComparisonView(state));return result;}return null;},
 hostEdit(understanding){host={...host,understanding,version:host.version+1};},
 injectView(view){instance.update(view);},destroy(){instance.destroy();},
};
document.addEventListener('keydown',event=>{if(event.altKey&&['1','2','3','4'].includes(event.key)){event.preventDefault();window.compareFixture.reset(['search','candidates','compare','returned'][Number(event.key)-1]);}});

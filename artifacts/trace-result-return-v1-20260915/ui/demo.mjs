import {mountResultReturn} from './result-return.mjs';
import {createResultReturnState,reduceResultReturn,selectResultReturnView} from '../model/result-return-model.mjs';
import {createResultReturnDemo,createFixtureHost,applyFixtureCommand,demoSeed} from '../model/fixture.mjs';
const workspaceUrl=new URL('../../../',import.meta.url);
const local=path=>new URL(path,workspaceUrl).href;
const assets={
  backgroundUrl:local('artifacts/trace-one-thing-v1-20260915/images/ready/chain-overview-environment.png'),
  birdPerchedUrl:local('artifacts/trace-home-v1-20260914/images/repaired/bird-perched.png'),
  birdTakeoffUrl:local('artifacts/trace-home-v1-20260914/images/repaired/bird-takeoff.png'),
  serifUrl:local('artifacts/trace-one-thing-v1-20260915/fonts/derived/TraceChainSerif-fixed.woff2'),
  sansUrl:local('artifacts/trace-one-thing-v1-20260915/fonts/derived/TraceChainSans-fixed.woff2'),
  serifDeltaUrl:local('artifacts/trace-result-return-v1-20260915/assets/fonts/TraceResultReturnSerif-delta.woff2'),
  sansDeltaUrl:local('artifacts/trace-result-return-v1-20260915/assets/fonts/TraceResultReturnSans-delta.woff2')
};
let state,host,ui,timer,version=0;
const actions=[],navigation=[];
function current(){return selectResultReturnView(state);}
function dispatch(action){
  actions.push(structuredClone(action));
  state=reduceResultReturn(state,action);ui?.update(current());
  const command=current().status.pending;
  if(command&&action.type!=='HOST_RECEIPT') {
    clearTimeout(timer);const mode=document.querySelector('#fixture-mode').value;const captured=version;
    if(mode!=='manual')timer=setTimeout(()=>{if(captured!==version)return;respond(mode);},340);
  }
}
function respond(mode='success') {
  const command=current().status.pending;if(!command)return;
  const outcome=applyFixtureCommand(host,command,mode==='failure'?{fail:'network_error'}:mode==='conflict'?{fail:'version_conflict'}:{});
  host=outcome.host;dispatch({type:'HOST_RECEIPT',receipt:outcome.receipt});
}
function reset(screen='intake',seed=null) {
  version++;clearTimeout(timer);ui?.destroy();actions.length=0;navigation.length=0;
  if(seed){state=createResultReturnState(seed);host=createFixtureHost(seed);}else({state,host}=createResultReturnDemo(screen));
  ui=mountResultReturn(document.querySelector('#demo-root'),{view:current(),dispatch,assets,onNavigate(target){navigation.push(target);document.querySelector('#fixture-note').textContent='只收到导航意图，未接入真实宿主、未发送工作。';return false;}});
  document.querySelector('#fixture-screen').value=screen;
}
document.querySelector('#fixture-reset').addEventListener('click',()=>reset(document.querySelector('#fixture-screen').value));
document.querySelector('#fixture-receipt').addEventListener('click',()=>respond());
document.querySelector('#fixture-screen').addEventListener('change',event=>reset(event.target.value));
const params=new URLSearchParams(location.search);
reset(params.get('screen')||'intake');
if(params.has('capture'))document.querySelector('#fixture-tools').hidden=true;
// Test-only harness; the UI module never creates or simulates a persistence receipt.
window.__resultDemo={current,dispatch,reset,respond,seed:demoSeed,host:()=>structuredClone(host),actions,navigation,destroy(){clearTimeout(timer);ui.destroy();},mount(){ui=mountResultReturn(document.querySelector('#demo-root'),{view:current(),dispatch,assets});}};

import {mountWorksiteScreen} from './worksite-screen.mjs';
import {createWorksiteState,createWorksiteDemo,reduceWorksite,selectWorksiteView} from '../model/worksite-model.mjs';
import {animate,svg} from '../../../trace-runtime/apps/desktop/src/vendor/anime.esm.js';
import {mountSceneGlass} from '../../../trace-runtime/apps/desktop/src/home/scene-glass.js';

const params=new URLSearchParams(location.search);
let state=params.has('empty')?createWorksiteState():createWorksiteDemo(params.get('screen')||'overview');
const actions=[];
const assets={
  background:new URL('../images/ready/worksite-environment.png',import.meta.url).href,
  birdPerched:new URL('../images/ready/bird-perched.png',import.meta.url).href,
  birdTakeoff:new URL('../images/ready/bird-takeoff.png',import.meta.url).href,
  serifFont:new URL('../fonts/derived/TraceWorksiteSerif-fixed.woff2',import.meta.url).href,
  sansFont:new URL('../fonts/derived/TraceWorksiteSans-fixed.woff2',import.meta.url).href,
};
const screen=mountWorksiteScreen({root:document.querySelector('#fixture-root'),view:selectWorksiteView(state),onAction(action){actions.push(structuredClone(action));state=reduceWorksite(state,action);screen.update(selectWorksiteView(state));},assets,services:{animate,svg,mountSceneGlass}});
// Test-only bridge, absent from the reusable UI module.
window.worksiteFixture={get state(){return state;},get view(){return selectWorksiteView(state);},get actions(){return actions;},dispatch(action){actions.push(structuredClone(action));state=reduceWorksite(state,action);screen.update(selectWorksiteView(state));},reset(next='overview'){state=next==='empty'?createWorksiteState():createWorksiteDemo(next);screen.update(selectWorksiteView(state));},screen};

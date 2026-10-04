import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the actual route controller against a tiny disconnected graph.
const timers=[];
const context=vm.createContext({window:{CanalRecallGameModules:[],location:{origin:'http://test',pathname:'/'},CanalRecallPreferences:{travelProfile:()=>({networkNoun:'streets',networkNounSingular:'street'})}},
  document:{querySelector:()=>({textContent:''})},history:{replaceState(){}},console,
  GameState:{MENU:0,LOADING:1,RACING:4},MAX_SNAP_DIST:500,HOME_MAX_SNAP_DIST:1500,MIN_START_FINISH_DIST:100,MAX_ROUTE_REROLLS:3,TRACK_MODE_POINT_TO_POINT:1,
  setTimeout:callback=>timers.push(callback)});
vm.runInContext(fs.readFileSync('public/canal-drive/js/game-route.js','utf8'),context);
const Runtime=context.window.CanalRecallGameModules[0];
function fixture({snaps=true,pattern='home',rerolls=0,retarget=false}={}){
  const game=new Runtime(),start={x:0,y:0},finish={x:1000,y:0};let swaps=0,retargets=0,retries=0,error='';
  const track={setEndpoints(){},clearFrameCache(){},setRouteMastery(){},setHomeBias(){},planRoute:()=>retargets?{path:[start,finish]}:null};
  const world={lat:0,lng:0,segments:[],track};
  Object.assign(game,{_activeCity:()=>({name:'Amsterdam'}),_loadToken:0,travelMode:'car',routePattern:pattern,_routeRerolls:rerolls,routeFrom:{id:'from',name:'Origin'},routeTo:{id:'chosen',name:'Chosen station'},track,recall:null,vectorMap:{},
    osmLoader:{latLngToGamePoint:lat=>lat===1?start:snaps?finish:null},_reusableWorld:()=>world,
    _nearestSnappableDestination:()=>{swaps++;return{poi:{id:'other',name:'Other'},point:finish}},
    _retargetToReachableDestination:()=>{retargets++;return retarget?{poi:{id:'other',name:'Other',lat:2,lng:0},finish,path:[start,finish]}:null},
    _startConfiguredRoute:()=>{retries++},_returnToRouteSetup:message=>{error=message},_idealRouteLength:()=>1000,renderer:{preRenderTrack(){}},_setupRace(){},_beginIntro(){}});
  return{game,get stats(){return{swaps,retargets,retries,error}}};
}
for(const snaps of [false,true]){
  const f=fixture({snaps});await f.game._onLocationSelected(0,0,{lat:1,lng:0},{lat:2,lng:0},{explicitDestination:true});
  timers.splice(0).forEach(callback=>callback());
  assert.equal(f.game.routeTo.id,'chosen');assert.equal(f.stats.swaps,0);assert.equal(f.stats.retargets,0);
  assert.match(f.stats.error,/Chosen station.*mapped streets/);assert.doesNotMatch(f.stats.error,/^Error:/);
}
const retry=fixture({pattern:'surprise'});
await retry.game._onLocationSelected(0,0,{lat:1,lng:0},{lat:2,lng:0},{explicitDestination:true});
assert.equal(retry.stats.retries,1);assert.equal(retry.stats.retargets,0);assert.equal(retry.game.routeTo.id,'chosen');
const exhausted=fixture({pattern:'surprise',rerolls:3});
await exhausted.game._onLocationSelected(0,0,{lat:1,lng:0},{lat:2,lng:0},{explicitDestination:true});timers.splice(0).forEach(callback=>callback());
assert.equal(exhausted.stats.retries,0);assert.match(exhausted.stats.error,/Chosen station/);
const automatic=fixture({retarget:true});
await automatic.game._onLocationSelected(0,0,{lat:1,lng:0},{lat:2,lng:0});
assert.equal(automatic.stats.retargets,1,'automatic destinations retain reachable-place fallback');
assert.equal(automatic.game.routeTo.id,'other');assert.equal(automatic.game.state,4);assert.equal(automatic.stats.error,'');
timers.splice(0);

// The flag belongs to this launch, so riding on cannot inherit it accidentally.
const launch=new Runtime();let args;
Object.assign(launch,{_prefs:()=>({}),_applyPrefsToRuntime(){},_setRouteError(){},_overlay:{store:{setSetupOpen(){}}},_onLocationSelected:(...values)=>{args=values}});
launch._launchPoiRoute({lat:1,lng:1},{lat:2,lng:2},{explicitDestination:true});assert.equal(args[4].explicitDestination,true);
launch._launchPoiRoute({lat:1,lng:1},{lat:2,lng:2});assert.equal(args[4].explicitDestination,false);
console.log('Explicit POI routes preserve the chosen destination, report failures, bound origin retries, and retain automatic fallback.');

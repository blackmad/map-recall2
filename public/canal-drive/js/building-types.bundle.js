"use strict";var CanalRecallBuildingTypes=(()=>{var dt=Object.defineProperty;var io=Object.getOwnPropertyDescriptor;var lo=Object.getOwnPropertyNames;var uo=Object.prototype.hasOwnProperty;var co=(e,t)=>{for(var n in t)dt(e,n,{get:t[n],enumerable:!0})},mo=(e,t,n,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of lo(t))!uo.call(e,o)&&o!==n&&dt(e,o,{get:()=>t[o],enumerable:!(r=io(t,o))||r.enumerable});return e};var fo=e=>mo(dt({},"__esModule",{value:!0}),e);var Hi={};co(Hi,{areaAnchor:()=>ut,areaRadiusMetres:()=>oo,createBuildingTypes:()=>so,farMassing:()=>Yt,groupByArea:()=>ro,instanceMatrix:()=>jt,partitionByDistance:()=>Kt,suppressionIds:()=>qt});var ho=.7,po=46,bo=null,go=()=>bo??=[K["pantile-red"].hex,K["pantile-dark"].hex,xe[0],xe[1],K.gravel.hex,K["bitumen-dark"].hex,K["white-membrane"].hex];function xo(e,t){let n=globalThis,r=n[t]??(typeof URLSearchParams=="function"?new URLSearchParams(n.location?.search??"").get(e):null);return r===!0||r==="1"||r==="true"||r==="on"}var yo=null;var ht=()=>yo??=xo("roofFamily","__canalRecallRoofFamily");var Mo=(e,t)=>Math.hypot(e[0]-t[0],e[1]-t[1],e[2]-t[2]);function wo(e,t=go(),n=po){let r=S(e),o=null,s=n;for(let a of t){let i=Mo(r,S(a));i<=s&&(s=i,o=a)}return o}function pt(e,t=ho){let n=wo(e);if(!n)return e;let r=S(e),o=S(n);return O([0,1,2].map(s=>r[s]+(o[s]-r[s])*t))}function Jt(){let e=globalThis;return(e.__canalRecallLook??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("look"):null))==="toon"}var U=["#a8503a","#9a4a38","#8c4632","#b05a40","#7a3b2c"],Ee=["#2b2d2c","#2f4a3a","#5a2a26","#25344a"],ye=["#e8dfc9","#f1eee6","#d3b184","#e2d5ba"],bt=[U[0],U[0],U[1],U[2],U[3],U[4],Ee[0],Ee[1],Ee[2],ye[0],ye[2]],Zt=["#2f4a3a","#25344a","#5a2a26","#2b2d2c","#e0a526"],Qt={canal:[U[4],U[4],U[1],U[2],Ee[0],Ee[1],ye[0]],c19:[U[0],U[3],U[1],ye[3],ye[2],ye[0]],school:[U[2],U[4],U[1],U[3]]},en=["#f1eee6","#f1eee6","#f1eee6","#e8dfc9","#e8dfc9","#2b2d2c","#2f4a3a","#5a2a26","#25344a","#8b8f8c"];function tn(){if(!Jt())return!1;let e=globalThis;return(e.__canalRecallToonFronts??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("toonFronts"):null))!=="candy"}var Pe=225;var gt={wallPull:.7,glassLift:.5,liftBrick:!0},nn={wallPull:.35,glassLift:.25,liftBrick:!1},Ji={photo:{cells:"photo",shadeBands:0,flatColour:!1,...gt,cartoonRoofCells:!1,outline:!1,litWallGain:255/Pe},procedural:{cells:"procedural",shadeBands:0,flatColour:!1,...gt,cartoonRoofCells:!1,outline:!1,litWallGain:1},untextured:{cells:"procedural",shadeBands:0,flatColour:!0,...gt,cartoonRoofCells:!1,outline:!1,litWallGain:1},storybook:{cells:"storybook",shadeBands:0,flatColour:!1,...nn,cartoonRoofCells:!1,outline:!0,litWallGain:1,tone:{hueShift:-4,satMul:1.15,satAdd:0,keepDarkBelow:0,lightMul:1,lightAdd:.03,lightMax:.9}},cartoon:{cells:"cartoon",shadeBands:3,flatColour:!1,...nn,cartoonRoofCells:!0,outline:!0,litWallGain:1,tone:{hueShift:0,satMul:1.7,satAdd:.08,keepDarkBelow:.35,lightMul:1.08,lightAdd:0,lightMax:.85}}};var me=(e,t,n)=>Math.max(t,Math.min(n,e));function S(e){let t=/^#?([0-9a-f]{6})$/i.exec(e.trim());if(!t)throw Error(`Bad colour ${e}`);let n=parseInt(t[1],16);return[n>>16&255,n>>8&255,n&255]}var O=e=>"#"+e.map(t=>Math.round(me(t,0,255)).toString(16).padStart(2,"0")).join("");function E([e,t,n]){let r=e/255,o=t/255,s=n/255,a=Math.max(r,o,s),i=Math.min(r,o,s),u=(a+i)/2;if(a===i)return[0,0,u];let l=a-i,m=u>.5?l/(2-a-i):l/(a+i);return[(a===r?(o-s)/l+(o<s?6:0):a===o?(s-r)/l+2:(r-o)/l+4)*60,m,u]}function $([e,t,n]){let r=(1-Math.abs(2*n-1))*t,o=r*(1-Math.abs(e/60%2-1)),s=n-r/2,[a,i,u]=e<60?[r,o,0]:e<120?[o,r,0]:e<180?[0,r,o]:e<240?[0,o,r]:e<300?[o,0,r]:[r,0,o];return[(a+s)*255,(i+s)*255,(u+s)*255]}var hn=(e,t,n)=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n];var xt={canal:-1/0,c19:1860,school:1915,modern:1945};var xe=["#76808f","#606b79","#8c939c"],Ie={procedural:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:xe},untextured:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:xe},photo:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:xe},storybook:{tile:["#b9553a","#a94a33","#c46a45"],slate:["#556070","#4a5666","#657282"]},cartoon:{tile:["#e85a3c","#f08a2b","#d94a3a"],slate:["#3f5f8f","#2f4a78","#4f7bb0"]}};var K={gravel:{hex:"#9e9281",luma:[112,156],cell:"flat"},"bitumen-dark":{hex:"#56585e",luma:[62,96],cell:"flat"},"bitumen-light":{hex:"#a99b84",luma:[150,182],cell:"flat"},"white-membrane":{hex:"#d9d9d3",luma:[196,228],cell:"flat"},"pantile-red":{hex:"#b5543a",luma:[84,124],cell:"tile"},"pantile-dark":{hex:"#6a5248",luma:[64,98],cell:"tile"},slate:{hex:"#76808f",luma:[62,140],cell:"slate"},zinc:{hex:"#9aa1a6",luma:[138,176],cell:"slate"},sedum:{hex:"#7a8350",luma:[96,132],cell:"flat"},solar:{hex:"#2e3a52",luma:[44,70],cell:"flat"},terrace:{hex:"#a38d74",luma:[124,162],cell:"flat"},glass:{hex:"#8fa3ad",luma:[130,170],cell:"flat"}},qe={gravel:K.gravel.hex,membrane:K["white-membrane"].hex,bitumen:K["bitumen-dark"].hex,pebble:K["bitumen-light"].hex},pn=[qe.gravel,qe.membrane,qe.bitumen,qe.pebble];var ee={tile:Ie.photo.tile,slate:Ie.photo.slate,flat:pn};var rn=["#d9674a","#e58a5c","#eab85f","#f0dfb8","#e5a396","#9dbb9b","#7ea3c2","#c9714a","#f2c14e","#b9a1c9"],on=["#2a8c8c","#e0a526","#d9453d","#2c4a7c","#7a3b6e","#2f6b45","#4aa3d9"],an={canal:{walls:rn,accents:on},c19:{walls:rn,accents:on},school:{walls:["#9c5a42","#8a4b3a","#a8664c","#7a4a40"],accents:["#2c4a7c","#2a8c8c","#e0a526"]},modern:{walls:["#f4efe6","#dcdcd6","#e9d9c0","#b9c4cc","#f0c9a9"],accents:["#2a8c8c","#d9453d","#2c4a7c","#e0a526"]}},sn=["#ffffff","#f2d9c8","#d9b9a4","#e6c9b0","#c9a38c","#f0e4d2","#ffd9b0","#e8c0b0","#d0c8c0"],ln=["#243a2f","#1f2a3a","#3a1f1c","#222222","#2f4a3c","#6b2b2b","#2c3e50"],un={cartoon:an,storybook:an,photo:{canal:{walls:sn,accents:ln},c19:{walls:sn,accents:ln},school:{walls:["#b89080","#a88070","#9c7868"],accents:["#1f2a3a","#243a2f","#3a1f1c"]},modern:{walls:["#f2f2ee","#d8d8d2","#e8dcc8","#c8d0d4"],accents:["#2c3e50","#6b2b2b","#243a2f"]}}};var cn=["#e8573d","#e8573d","#ee7f2c","#f2b92e","#f2b92e","#2a9d8f","#4672b0","#f3e6c8","#d96a4d"],we={photo:{canal:["#7a3b2c","#7a3b2c","#6b3428","#8c4632","#9a5846","#b05a40","#4a2e26","#2e2a27","#3e4a40","#5d605a","#e4ddcd"],c19:["#b05a40","#b05a40","#bd6a45","#a24d38","#c58b5e","#d3b184","#e2d5ba","#e2d5ba","#d9c5a4","#9a5846"],school:["#8c4a38","#7a4535","#9a5240","#6e3d33","#a85a3c","#5e3a32","#b0603f"],modern:["#c9b79a","#b9ad9a","#a8a49c","#d3c6ad","#8f8a82","#bfb3a0","#9c7a62","#b05a40"]},storybook:{canal:["#b9583f","#9a4a38","#7a4a3c","#4a5048","#3f4a5a","#ead9b0","#c8664a"],c19:["#c8664a","#d98b5f","#e0b36a","#ead9b0","#d9b995","#c9a08c","#c8664a"],school:["#a8553f","#9a5a48","#b87a5c","#c8664a","#8a4e40"],modern:null},cartoon:{canal:["#d9453d","#a8433a","#3b3b4a","#2a9d8f","#4672b0","#fffaf0","#e8573d"],c19:["#e8573d","#ee7f2c","#f2b92e","#f3e6c8","#d96a4d","#f2b92e"],school:["#d96a4d","#e8573d","#b9583f","#ee7f2c"],modern:null}},_o={photo:["#f1eee6","#f1eee6","#f1eee6","#e8dfc9","#e8dfc9","#2b2d2c","#2f4a3a","#5a2a26","#25344a","#8b8f8c"],storybook:["#f6f1e4","#f6f1e4","#f6f1e4","#efe2c2","#efe2c2","#3a3d3c","#3f6a52","#8a3b33","#3a527a","#a3a8a4"],cartoon:["#fffaf0","#fffaf0","#fffaf0","#ffe9b8","#ffe9b8","#3b3b4a","#2a9d8f","#d9453d","#4672b0","#f2b92e"]};if(tn()){for(let t of["canal","c19","school"])we.cartoon[t]=Qt[t];let e={walls:[...bt],accents:[...Zt]};un.cartoon={canal:e,c19:e,school:e,modern:un.cartoon.modern},cn.splice(0,cn.length,...bt),_o.cartoon=en}var Zi={canal:{label:"canal-house centre (before 1860)",wall:we.photo.canal[0],roof:Ie.photo.tile[0]},c19:{label:"19th-century ring (1860-1914)",wall:we.photo.c19[0],roof:Ie.photo.tile[1]},school:{label:"Amsterdamse School (1915-1944)",wall:we.photo.school[0],roof:Ie.photo.slate[0]},modern:{label:"post-war and contemporary (1945+)",wall:we.photo.modern[0],roof:pn[0]}};var bn=["brick","stucco","accent","stone","frame","door","glass","roofTile","slate","bitumen","paint"],yt={brick:"brick",accent:"brick",stucco:"stucco",stone:"stone",frame:"frame",door:"door",glass:"glass",roofTile:"tile",slate:"slate",bitumen:"flat",paint:"frame"},q={brick:3.36,stucco:2.4,accent:3.36,stone:1.28,frame:1,door:1,glass:1,roofTile:1.2,slate:1.2,bitumen:1.2,paint:1},oe=[.3,.6],Ro="#f1ede2",vo="#cfc8b8";function So(e){let[t,n,r]=E(S(e)),o=me(.12+r*.9,oe[0],oe[1]);return O($([t,me(n,.12,.5),o]))}function Lo(e){let[t,n,r]=E(S(e));return O($([t,me(n,0,.55),me(r*1.06+.03,.4,.97)]))}function Ao(e){let t=S(e),[n,r,o]=E(t);return o>=.5?O(hn(t,S(Ro),.75)):O($([n,r,Math.max(o,.16)]))}function ko(e){let[t,n,r]=E(S(e));return O(hn($([t,n,Math.max(r,.62)]),S(vo),.45))}function To(e){let[t,n,r]=E(S(e));return r>=.17?e.startsWith("#")?e.toLowerCase():"#"+e.toLowerCase():O($([t,n<.15?0:n,.17]))}function Fo(e,t){let n=E(S(t))[2];if(e==="roofTile"){let[r,o]=E(S(t));return o<.2?ee.slate[1]:O($([r,me(o*1.1,.35,.6),me(.2+n*.85,.38,.5)]))}return e==="slate"?n<.27?ee.slate[1]:n<.31?ee.slate[0]:ee.slate[2]:n<.4?ee.flat[2]:ee.flat[0]}var Me="measured",Oo=.18,Co=Pe/255;function Do(e){let[t,n,r]=E(S(e)),[o,s,a]=S(O($([t,n,Math.max(r,Oo)])));return O([o,s,a].map(i=>Math.min(255,Math.round(i/Co))))}var fe=32,de=64,re=[157.19,92.83,69.17],gn=240.95,xn=.16,Eo=255/(re[0]+(gn-re[0])*xn);function Mt(e,t){let n=t/(de-1),r=n<.5?re[0]+(re[1]-re[0])*(n/.5):re[1]+(re[2]-re[1])*((n-.5)/.5),o=5-15*t/35,s=17-15*t/35,a=t<35&&e+.5>=o&&e+.5<s;return Math.min(255,Math.round((a?r+(gn-r)*xn:r)*Eo))}var Io=(()=>{let e=0;for(let t=0;t<de;t++)for(let n=0;n<fe;n++)e+=Mt(n,t);return e/(fe*de)})(),mn=.4;function Po(e){let[t,n,r]=E(S(e)),s=(r>=mn?S(e):$([t,n,mn])).map(i=>i/(Io/255)),a=Math.max(1,...s.map(i=>i/255));return O(s.map(i=>Math.min(255,Math.round(i/a))))}var Bo=228/255;function No(e){return O(S(e).map(t=>Math.min(255,Math.round(t/Bo))))}function fn(e){return O(S(e))}function dn(e){return O(S(e))}var Go=["brick","accent","glass","stone","bitumen","slate","roofTile"],yn=(e,t)=>t===Me&&Go.includes(e);function Ye(e,t,n){if(n===Me&&(e==="brick"||e==="accent"))return Do(t);if(n===Me&&e==="glass")return Po(t);if(n===Me&&e==="stone")return No(t);if(n===Me&&e==="bitumen")return ht()?pt(fn(t)):fn(t);if(n===Me&&(e==="slate"||e==="roofTile"))return ht()?pt(dn(t)):dn(t);switch(e){case"brick":case"accent":return So(t);case"stucco":return Lo(t);case"stone":return ko(t);case"frame":return Ao(t);case"door":return To(t);case"glass":return"#ffffff";case"paint":return t.startsWith("#")?t.toLowerCase():"#"+t.toLowerCase();default:return Fo(e,t)}}var wt={asphalt:{base:[86,88,93]},cycle:{base:[150,66,58]},klinker:{base:[122,90,80],joint:"#4b3d38"},pavement:{base:[174,162,152],joint:"#7f756b"},kerb:"#cfcac0",paint:"#f2f0ea",rail:"#6c6e72",bollard:"#5a2a26"},Mn="#ffd21f",wn="#ff8033",_n="#b4682c";var Rn={land:{base:[168,158,142],joint:"#857b6d"},paving:{base:[184,174,158],joint:"#8f8577"},square:{base:[190,179,161],joint:"#958a7c"},klinker:{base:[158,124,114],joint:"#7a6660"},asphalt:[68,72,80],cycle:[156,76,66],gravel:[180,166,136],park:[96,140,70],wood:[70,112,58],parking:[102,102,105],kerb:"#aaa498",water:"#46707c",lawn:[110,154,74],bed:{soil:[98,80,60],leaf:[84,122,58]},shrub:{base:[56,92,46],leaf:[76,116,56]},bark:[118,84,58],sand:[212,194,150],parkGravel:[198,184,152],parkPath:[110,110,112],pond:"#46707c"};var Wo="highlight",Ho="__canalRecallHighlight",$o="highlightAccent",Vo="__canalRecallHighlightAccent",Be={yellow:{keepMaterials:!1,outline:!1,rim:!1,desaturate:!1,ring:!1,beacon:!1,wash:!1,animated:!1},a:{keepMaterials:!0,outline:!0,rim:!1,desaturate:!1,ring:!0,beacon:!0,wash:!0,animated:!1},b:{keepMaterials:!0,outline:!1,rim:!0,desaturate:!1,ring:!0,beacon:!1,wash:!1,animated:!0},c:{keepMaterials:!0,outline:!1,rim:!1,desaturate:!0,ring:!0,beacon:!1,wash:!1,animated:!1}};var zo=60,ae=.4,_e=2,Lt=3.5,vn=100,jo=300;var qo=.75,_t=.35,Yo="__canalRecallHighlightBoost";function Sn(){let e=Number(globalThis[Yo]);return Number.isFinite(e)?Math.min(1,Math.max(0,e)):0}var Rt="__canalRecallHighlightExtent";function Fn(){let e=globalThis;return e[Rt]instanceof Map?e[Rt]:e[Rt]=new Map}var Ko=.3,Xo=2.4,Jo=.9,Zo=2.2;var Qo=.28;function Ln(e){if(typeof e!="string")return null;let t=e.trim().toLowerCase();return t==="a"||t==="outline"?"a":t==="b"||t==="rim"?"b":t==="c"||t==="desaturate"?"c":t==="yellow"||t==="0"||t==="off"||t==="old"?"yellow":t==="default"?vt:null}var vt="a";function Re(e){try{let t=globalThis;if(e===void 0){let n=Ln(t[Ho]);if(n)return n}return Ln(new URLSearchParams(e??t.location?.search??"").get(Wo))??vt}catch{return vt}}function On(e=Re(),t){if(e==="yellow")return Mn;try{let n=globalThis,r=(t===void 0?n[Vo]:void 0)??new URLSearchParams(t??n.location?.search??"").get($o);if(r==="hud")return _n;if(typeof r=="string"&&/^#?[0-9a-f]{6}$/i.test(r))return r.startsWith("#")?r:`#${r}`}catch{}return wn}function At(e=Re()){return Be[e].keepMaterials?{HL_KEEP:""}:{}}var kt=`
#ifdef HL_KEEP
#define HL_PAINT(h) false
#else
#define HL_PAINT(h) ((h) > 0.5 && (h) < 1.5)
#endif
#define HL_GHOST(h) ((h) > 2.5 && fract(dot(floor(gl_FragCoord.xy), vec2(0.569840296, 0.754877666))) >= ${Qo.toFixed(3)})
float hlState(float hidden) { return hidden > 3.5 ? 3.0 : (hidden > 2.5 ? 2.0 : (hidden > 1.5 ? 1.0 : 0.0)); }
vec3 hlDesat(vec3 c, float h) { return h > 1.5 && h < 2.5 ? mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), ${ae.toFixed(2)}) : c; }`,ea=110540,ta=e=>111320*Math.cos(e*Math.PI/180);function na(e,t){let n=(e[1]+t[1])/2;return Math.hypot((e[0]-t[0])*ta(n),(e[1]-t[1])*ea)}var Cn=(e,t,n=zo)=>!!e&&na(e,t)<=n;var An=`
attribute float hidden;
uniform vec2 hlViewport;
uniform float hlWidthPx;
uniform float hlFarScale;
uniform vec3 hlCentre;
uniform float hlDepthPush;
uniform vec3 hlEye;
varying vec3 vHlPos;
varying vec3 vHlNormal;
void main() {
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
  n = mat3(instanceMatrix) * n;
#endif
  vHlPos = p.xyz;
  vHlNormal = n;
#ifdef HL_MERGED
  if (hidden < 1.5 || hidden > 2.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
#endif
#ifdef HL_FEATURE
  // A batched tile (3DBAG detailed mode): only the highlighted feature's vertices.
  if (abs(HL_FEATURE - hlFeatureId) > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
#endif
  mat4 mvp = projectionMatrix * modelViewMatrix;
#ifdef HL_OUTLINE
  // Behind the building's own surface (metres along the view ray), so it shows only past the silhouette.
  vec3 away = p.xyz - hlEye;
  if (dot(away, away) > 1e-6) p.xyz += normalize(away) * hlDepthPush;
#endif
  vec4 clip = mvp * p;
#ifdef HL_OUTLINE
  // Screen-space push: along the projected normal and away from the building's projected centre (closes the
  // corners split normals leave open, and serves meshes without normals).
  vec2 dir = vec2(0.0);
  vec4 cn = mvp * vec4(n, 0.0);
  vec2 dn = (cn.xy * clip.w - clip.xy * cn.w) * hlViewport;
  if (dot(dn, dn) > 1e-12) dir += normalize(dn);
  vec4 c4 = vec4(hlCentre, 1.0);
#ifdef USE_INSTANCING
  c4 = instanceMatrix * c4;
#endif
  vec4 cc = mvp * c4;
  if (cc.w > 0.0 && clip.w > 0.0) {
    vec2 dr = (clip.xy / clip.w - cc.xy / cc.w) * hlViewport;
    if (dot(dr, dr) > 1e-6) dir += normalize(dr);
  }
  // Wider far away (outlineWidthPx): by the camera's distance to the building's centre, one width per outline.
  float far = clamp((length(c4.xyz - hlEye) - ${vn.toFixed(1)}) / ${(jo-vn).toFixed(1)}, 0.0, 1.0);
  float width = hlWidthPx * mix(1.0, hlFarScale, far);
  if (dot(dir, dir) > 1e-12) clip.xy += normalize(dir) * width * 2.0 / hlViewport * clip.w;
#endif
  gl_Position = clip;
}`,ra=`
uniform vec3 hlAccent;
uniform vec3 hlEye;
uniform float hlTime;
uniform float hlHasNormal;
uniform vec3 hlUp;
uniform float hlWash;
varying vec3 vHlPos;
varying vec3 vHlNormal;
void main() {
#if defined(HL_OUTLINE)
  gl_FragColor = vec4(hlAccent, 1.0);
#elif defined(HL_ROOF)
  // Roof wash: upward faces only (walls keep their own colours). Derived normals have no reliable sign: |up|.
  vec3 n = hlHasNormal > 0.5 ? normalize(vHlNormal) : normalize(cross(dFdx(vHlPos), dFdy(vHlPos)));
  float up = dot(n, hlUp);
  if (hlHasNormal < 0.5) up = abs(up);
  if (up < ${_t.toFixed(2)} || hlWash <= 0.0) discard;
  gl_FragColor = vec4(hlAccent, hlWash * smoothstep(${_t.toFixed(2)}, ${(_t+.15).toFixed(2)}, up));
#else
  vec3 n = hlHasNormal > 0.5 ? normalize(vHlNormal) : normalize(cross(dFdx(vHlPos), dFdy(vHlPos)));
  vec3 v = normalize(hlEye - vHlPos);
  float f = pow(1.0 - abs(dot(n, v)), ${Zo.toFixed(2)});
  float pulse = 0.775 + 0.225 * sin(hlTime * 6.2831853 / ${Xo.toFixed(2)});
  gl_FragColor = vec4(hlAccent * f * ${Jo.toFixed(2)} * pulse, 1.0);
#endif
}`,Ke="canalRecallHighlightPass",oa="__canalRecallHighlightOutlinePx";function aa(){let e=globalThis[oa],t=e==null||e===""?NaN:Number(e);return Number.isFinite(t)&&t>=0?t:null}var sa=(e,t)=>{let[n,r,o]=S(t);return new e.Vector3(n/255,r/255,o/255)};function ia(e,t,n={}){let r={};n.merged&&(r.HL_MERGED=""),t==="outline"&&(r.HL_OUTLINE=""),t==="roof"&&(r.HL_ROOF="");let o=An;if(n.feature){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n.feature.attribute))throw new Error(`highlight: bad feature attribute ${n.feature.attribute}`);r.HL_FEATURE=n.feature.attribute,o=`attribute float ${n.feature.attribute};
uniform float hlFeatureId;
${An}`}let s=new e.ShaderMaterial({defines:r,uniforms:{hlViewport:{value:new e.Vector2(1,1)},hlWidthPx:{value:_e},hlFarScale:{value:Lt/_e},hlCentre:{value:new e.Vector3},hlDepthPush:{value:Ko},hlAccent:{value:sa(e,n.accent??On())},hlEye:{value:new e.Vector3},hlTime:{value:0},hlHasNormal:{value:1},hlFeatureId:{value:n.feature?.id??0},hlUp:{value:new e.Vector3(0,0,1)},hlWash:{value:0}},vertexShader:o,fragmentShader:ra,side:t==="outline"?e.BackSide:e.FrontSide,transparent:!0,depthTest:!0,depthWrite:t==="outline",blending:t==="rim"?e.AdditiveBlending:e.NormalBlending,polygonOffset:t!=="outline",polygonOffsetFactor:-1,polygonOffsetUnits:t==="roof"?-4:-2});return s.name=`highlight/${t}${n.merged?"/merged":""}`,s.userData={[Ke]:!0},s.defaultAttributeValues={hidden:[0],normal:[0,0,0]},s}function la(e,t,n,r){let o=e.geometry?.boundingBox,s=t.elements;if(!o)return;let a=n.domElement,i=a?.clientWidth||r.x,u=a?.clientHeight||r.y,l=[],m=!1;for(let c=0;c<8;c++){let h=c&1?o.max.x:o.min.x,d=c&2?o.max.y:o.min.y,g=c&4?o.max.z:o.min.z,w=s[0]*h+s[4]*d+s[8]*g+s[12],b=s[1]*h+s[5]*d+s[9]*g+s[13],M=s[3]*h+s[7]*d+s[11]*g+s[15];if(!(M>1e-9)){m=!0;break}l.push((w/M+1)/2*i,(1-b/M)/2*u)}Fn().set(e,{t:performance.now(),points:l,behind:m,width:i,height:u})}function ua(e){for(let t of e?.userData?.[Ke]??[])e.remove(t),da(t.material),Fn().delete(t);e?.userData&&delete e.userData[Ke]}var ca=4,St=new Map,Dn=Symbol("highlightPassPool");function ma(e,t){return`${e}|${t.merged?1:0}|${t.feature?.attribute??""}|${t.accent??""}`}function fa(e,t,n={}){let r=ma(t,n),o=St.get(r)?.pop();if(o){let a=o.uniforms;return a.hlCentre.value.set(0,0,0),a.hlHasNormal.value=1,a.hlFeatureId.value=n.feature?.id??0,a.hlUp.value.set(0,0,1),a.hlWash.value=0,a.hlEye.value.set(0,0,0),a.hlTime.value=0,a.hlWidthPx.value=_e,a.hlFarScale.value=Lt/_e,o}let s=ia(e,t,n);return s.userData[Dn]=r,s}function da(e){let t=e?.userData?.[Dn];if(!t){e?.dispose?.();return}let n=St.get(t)??[];St.set(t,n),n.length<ca&&!n.includes(e)?n.push(e):e.dispose()}function kn(e){let t=e?.getAttribute?.("position")??e?.attributes?.position;return!t||!!t.array}function En(e,t,n={}){ua(t);let r=Be[n.style??Re()],o=[...r.outline?["outline"]:[],...r.rim?["rim"]:[],...r.wash&&!n.feature?["roof"]:[]];if(!o.length||!t?.geometry)return[];let s=t.geometry,a=n.centre;if(!a){!s.boundingBox&&kn(s)&&s.computeBoundingBox?.();let b=s.boundingBox?.getCenter(new e.Vector3)??s.boundingSphere?.center;a=b?[b.x,b.y,b.z]:[0,0,0]}let i=s.getAttribute?.("normal")?1:0,u=[],l=new e.Matrix4,m=new e.Vector4,c=new e.Vector2,h=new e.Matrix3,d=new e.Vector3,g=n.up??[0,0,1],w=!n.merged&&!n.feature&&!t.isInstancedMesh;w&&!s.boundingBox&&kn(s)&&s.computeBoundingBox?.();for(let b of o){let M=fa(e,b,{merged:n.merged,feature:n.feature,accent:n.accent??On(n.style)});M.uniforms.hlCentre.value.set(a[0],a[1],a[2]),M.uniforms.hlHasNormal.value=i;let p=t.isInstancedMesh?new e.InstancedMesh(s,M,t.count):new e.Mesh(s,M);t.isInstancedMesh&&(p.instanceMatrix=t.instanceMatrix),p.name=`${t.name||"mesh"}/highlight-${b}`,p.frustumCulled=!1,p.castShadow=p.receiveShadow=!1,p.renderOrder=(t.renderOrder??0)+1,p.raycast=()=>{},b==="roof"&&Object.defineProperty(p,"visible",{get:()=>t.visible&&Sn()>.001,set:()=>{},configurable:!0}),p.onBeforeRender=(L,Y,_)=>{t.isInstancedMesh&&(p.count=t.count),b!=="roof"&&(p.visible=t.visible);let T=M.uniforms;if(b==="roof"){h.setFromMatrix4(p.matrixWorld),d.setFromMatrixColumn(p.matrixWorld,0);let H=d.length()<.001?[0,0,1]:g;T.hlUp.value.set(H[0],H[1],H[2]).applyMatrix3(h.invert()).normalize(),T.hlWash.value=qo*Sn()}L.getDrawingBufferSize(c),T.hlViewport.value.copy(c);let X=L.domElement?.clientWidth||c.x,j=aa();T.hlWidthPx.value=(j??_e)*(c.x/X),T.hlFarScale.value=j==null?Lt/_e:1,l.multiplyMatrices(_.projectionMatrix,_.matrixWorldInverse).multiply(p.matrixWorld),b==="outline"&&w&&la(p,l,L,c),l.invert(),m.set(0,0,1,0).applyMatrix4(l),Math.abs(m.w)>1e-12&&T.hlEye.value.set(m.x/m.w,m.y/m.w,m.z/m.w),T.hlTime.value=performance.now()/1e3,M.uniformsNeedUpdate=!0},t.add(p),u.push(p)}return t.userData??={},t.userData[Ke]=u,u}var Tn=new WeakMap;function Tt(e,t,n,r=Re()){if(!t||n==="plain"||n==="highlight"&&Be[r].keepMaterials)return t;let o=Tn.get(t);o||Tn.set(t,o=new Map);let s=`${n}|${r}`,a=o.get(s);if(a)return a;if(n==="highlight")a=new e.MeshLambertMaterial({color:16765471,emissive:7033856,side:t.side??e.FrontSide});else if(t.isShaderMaterial&&t.uniforms?.tint?.value?.isVector3)a=t.clone(),a.uniforms={...t.uniforms,tint:{value:ha(t.uniforms.tint.value.clone())}};else if(t.isShaderMaterial&&t.uniforms?.hlDimAll)a=t.clone(),a.uniforms={...t.uniforms,hlDimAll:{value:1}};else if(t.isShaderMaterial)a=t.clone(),a.uniforms=t.uniforms,a.defines={...t.defines??{},HL_DIM_ALL:""};else{if(a=t.clone(),a.color){let i=a.color,u=.2126*i.r+.7152*i.g+.0722*i.b;i.setRGB(i.r+(u-i.r)*ae,i.g+(u-i.g)*ae,i.b+(u-i.b)*ae)}if(a.map){let i=a.onBeforeCompile;a.onBeforeCompile=(u,l)=>{i?.call(a,u,l),u.fragmentShader=u.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${ae.toFixed(2)});`)},a.customProgramCacheKey=()=>`${t.customProgramCacheKey?.()??""}|hl-dim`}}return a.name=`${t.name||"material"}/${n}`,a.userData={...t.userData??{},highlightVariantOf:t},o.set(s,a),a}function ha(e){let t=.2126*e.x+.7152*e.y+.0722*e.z;return e.set(e.x+(t-e.x)*ae,e.y+(t-e.y)*ae,e.z+(t-e.z)*ae)}var V={other:0,wall:1,roof:2,lid:3,trim:4,cornice:5,frontage:6,extrasStrip:7,extrasBox:8,extrasOther:9,shell:10},pa=[{name:"other",id:V.other,rgb:[0,0,0]},{name:"wall",id:V.wall,rgb:[255,255,255]},{name:"roof",id:V.roof,rgb:[255,0,0]},{name:"lid",id:V.lid,rgb:[128,0,128]},{name:"trim-decal",id:V.trim,rgb:[0,255,0]},{name:"cornice",id:V.cornice,rgb:[0,0,255]},{name:"frontage",id:V.frontage,rgb:[255,255,0]},{name:"extras-strip",id:V.extrasStrip,rgb:[255,0,255]},{name:"extras-box",id:V.extrasBox,rgb:[0,255,255]},{name:"extras-other",id:V.extrasOther,rgb:[128,128,0]},{name:"shell",id:V.shell,rgb:[0,128,128]}],In=1,ba=2,ga=4e-6;var xa=(e,t)=>e*t/2;function Nn(e){try{return typeof URLSearchParams=="function"?new URLSearchParams(globalThis.location?.search??"").get(e):null}catch{return null}}function ya(){let t=globalThis.__canalRecallThinFade??Nn("thinFade");return!(t===!1||t==="0"||t==="false"||t==="off")}function Ma(){return(globalThis.__canalRecallThinDebug??Nn("thinDebug"))==="owner"?"owner":null}var Ne=e=>Number.isInteger(e)?e.toFixed(1):String(e),wa=e=>`vec3(${e.map(t=>(t/255).toFixed(4)).join(", ")})`,_a=`
attribute vec2 thin;
varying float vThinM;
flat varying float vThinClass;
`,Ra=`
vThinM = thin.x * 0.01; vThinClass = thin.y;
#ifdef CITY_THIN_FADE
if (thin.y > ${Ne(V.trim-.5)} && thin.y < ${Ne(V.trim+.5)}) gl_Position.z -= ${ga.toExponential()} * gl_Position.w;
#endif
`,va=`
uniform float thinFocalPx;
varying float vThinM;
flat varying float vThinClass;
vec3 thinOwnerColour(float c) {
${pa.map(e=>`  if (c < ${Ne(e.id+.5)}) return ${wa(e.rgb)};`).join(`
`)}
  return vec3(0.5);
}
`,Sa=`
#ifdef CITY_THIN_FADE
if (vThinM > 0.0) {
  float thinPx = vThinM * thinFocalPx / max(vFacDist, 0.01);
  float thinCover = clamp((thinPx - ${Ne(In)}) / ${Ne(ba-In)}, 0.0, 1.0);
  if (thinCover < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= thinCover) discard;
}
#endif
`,Pn=`
#ifdef CITY_THIN_OWNER
gl_FragColor = vec4(thinOwnerColour(vThinClass), 1.0);
#endif
`,Ft={value:1e3};function Bn(e,t,n){let r="void main() {",o=/vFacDist = length\([^;]*\);/,s="if (HL_GHOST(vHighlight)) discard;";if(!e.includes(r)||!o.test(e)||!t.includes(r)||!t.includes(s))return null;let a=e.replace(r,`${_a}${r}`).replace(o,u=>`${u}${Ra}`),i=t.replace(r,`${va}${r}`).replace(s,`${s}${Sa}`);if(n){if(!i.includes("#include <dithering_fragment>"))return null;i=i.replace("#include <dithering_fragment>",`#include <dithering_fragment>${Pn}`)}else{let u=i.lastIndexOf("}");i=`${i.slice(0,u)}${Pn}${i.slice(u)}`}return{vertex:a,fragment:i}}function Gn(e,t,n={}){let r=n.fade??ya(),o=n.debug===void 0?Ma():n.debug;if(!r&&!o)return e;if(e.defines={...e.defines??{},...r?{CITY_THIN_FADE:""}:{},...o?{CITY_THIN_OWNER:""}:{}},e.defaultAttributeValues={...e.defaultAttributeValues??{},thin:[0,0]},t){let i=e.onBeforeCompile;e.onBeforeCompile=function(u,l){i?.call(this,u,l);let m=Bn(u.vertexShader,u.fragmentShader,!0);m&&(u.vertexShader=m.vertex,u.fragmentShader=m.fragment,u.uniforms.thinFocalPx=Ft)}}else{let i=Bn(e.vertexShader,e.fragmentShader,!1);if(!i)return e;e.vertexShader=i.vertex,e.fragmentShader=i.fragment,e.uniforms={...e.uniforms,thinFocalPx:Ft}}let s=e.onBeforeRender,a={x:0,y:0,set(i,u){return this.x=i,this.y=u,this},floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}};return e.onBeforeRender=function(i,u,l,...m){s?.call(this,i,u,l,...m);let c=i?.getDrawingBufferSize?i.getDrawingBufferSize(a).y:0,h=l?.projectionMatrix?.elements?.[5];c>0&&Number.isFinite(h)&&(Ft.value=xa(h,c))},e.userData={...e.userData??{},thinFade:r,thinDebug:o},e}var Un=e=>{let t=globalThis,n=new RegExp(`[?&]${e}=([^&]*)`).exec(t.location?.search??"");return n?decodeURIComponent(n[1]):null};function Ot(){let t=globalThis.__canalRecallDrawLimit??Un("drawLimit");return t===!0||t==="1"||t==="true"||t==="on"?!0:!(t===!1||t==="0"||t==="false"||t==="off")}var La=e=>Number.isInteger(e)?`${e}.0`:`${e}`,Wn=`(fogNear * (1.0 + fract(fogFar) * ${La(8)}))`;var Aa=!0;function Hn(){if(!Ot())return!1;let e=globalThis.__canalRecallLandmarkHaze??Un("landmarkHaze");return e===!0||e==="1"||e==="true"||e==="on"?!0:e===!1||e==="0"||e==="false"||e==="off"?!1:Aa}var $n="DEPTH_FADE_LIMIT_ONLY";var ka=.5,Ta=.38,Vn=250,Fa=600,Oa=.4;function zn(){let e=globalThis,t=typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("fadeStrength"):null,n=e.__canalRecallFadeStrength??t,r=n==null||n===""?NaN:Number(n);return Number.isFinite(r)?Math.max(0,Math.min(2,r)):1}var he=e=>Number.isInteger(e)?`${e}.0`:`${e}`;var Ca=(e=zn())=>`#ifdef USE_FOG
	float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	float fadeLuma = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( fadeLuma ), fogFactor * ${he(ka*e)} );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * ${he(Ta*e)} );
#endif`,ll=Ca(1),jn=`uniform vec3 fogColor;
	varying vec3 vFogEye;
	#define vFogDepth length( vFogEye )
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif`,ul=`#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
	${jn}
#endif`,qn=`
#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
#define DEPTH_FADE_FOG_PARS
	${jn}
#endif
`,Yn=(e,t=zn(),n=Ot())=>{let r=n?Wn:"fogFar";return`${he(Math.min(1,t))} * smoothstep(max(${he(Vn)}, fogNear), max(max(${he(Fa)}, fogNear + (${r} - fogNear) * ${he(Oa)}), max(${he(Vn)}, fogNear) + 1.0), ${e})`};var Da="canalRecallDepthFadeOptOut";function Kn(e,t=Hn()){t&&e.fog!==!1?e.defines={...e.defines??{},[$n]:""}:e.fog=!1,e.userData={...e.userData??{},[Da]:!0}}var Xn="inferred",Ea=e=>E(S(e))[1]<.2,Ia=e=>{let[t,n,r]=E(S(e));return(t<45||t>340)&&n>=.15&&r<.7},Pa=e=>Ea(e)?"slate":"roofTile",Ct=e=>Ia(e)?"brick":"stucco",Ba=[{test:/glass|glaz|window|vitr|ruit|pane/,slot:"glass",confidence:"name",rule:"glazing name"},{test:/decal|sign|mural|logo|letter|clock|dial/,slot:"paint",confidence:"name",rule:"signage / decal"},{test:/door|deur|gate/,slot:"door",confidence:"name",rule:"door name"},{test:/frame|kozijn|louvre|louver|blind|shutter|rail|mullion|sash/,slot:"frame",confidence:"name",rule:"joinery name"},{test:/brick|baksteen|klinker|terracotta/,slot:"brick",confidence:"name",rule:"brick name"},{test:/slate|leien|lei$/,slot:"slate",confidence:"name",rule:"slate name"},{test:/bitumen|asphalt|tar$|felt|flatroof|flat-roof|gravel/,slot:"bitumen",confidence:"name",rule:"flat roof name"},{test:/roof|tile|pantile|dakpan|dak/,slot:Pa,confidence:"name",rule:"roof name, grey \u2192 slate, else pantile"},{test:/sandstone|stone|steen|column|marble|granite|limestone|plinth/,slot:"stone",confidence:"name",rule:"stone name"},{test:/stucco|render|plaster|pleister|concrete|beton|slab/,slot:"stucco",confidence:"name",rule:"render / concrete name"},{test:/gold|gilt|bronze|copper|brass|zinc|metal|steel|iron|lead|alu/,slot:"paint",confidence:"name",rule:"metal name (flat colour)"},{test:/wall|facade|gevel/,slot:Ct,confidence:"name",rule:"wall name, brick hue \u2192 brick, else stucco"},{test:/ochre|yellow|buff/,slot:Ct,confidence:"colour-word",rule:"ochre: yellow brick (brick hue) or render"},{test:/pink|rose/,slot:"stucco",confidence:"colour-word",rule:"pink: painted render"},{test:/moss|grass|green|blue|orange|purple|paint|teal/,slot:"paint",confidence:"colour-word",rule:"coloured paint word"},{test:/white|cream|ivory/,slot:"stucco",confidence:"colour-word",rule:"white: stucco (could be white trim)"},{test:/dark|black|charcoal|anthracite/,slot:"frame",confidence:"colour-word",rule:"dark: painted joinery / ironwork (could be a dark wall)"},{test:/red/,slot:Ct,confidence:"colour-word",rule:"red: brick hue \u2192 brick (could be red tile or paint)"},{test:/grey|gray/,slot:"stucco",confidence:"colour-word",rule:"grey: render (could be concrete or zinc)"}];function Jn(e){return String(e??"").toLowerCase().replace(/[-_.\s]*\d+$/,"").trim()}function Na(e){let[t,n,r]=E(S(e));return r<.22?{slot:"frame",rule:"very dark: joinery / ironwork"}:n>=.15&&(t<45||t>340)&&r<.62?{slot:"brick",rule:"brick hue"}:n<.2&&r>=.6?{slot:"stucco",rule:"pale neutral: render"}:n<.2&&r>=.22&&t>180&&t<260?{slot:"slate",rule:"blue-grey: slate"}:n<.25?{slot:"stone",rule:"neutral mid-tone: stone"}:{slot:"paint",rule:"saturated colour: paint"}}function Zn(e,t){let n=t.toLowerCase(),r=Jn(e);for(let s of Ba)if(s.test.test(r))return{slot:typeof s.slot=="function"?s.slot(n):s.slot,tint:n,confidence:s.confidence,rule:s.rule};let o=Na(n);return{slot:o.slot,tint:n,confidence:"colour",rule:`no material word in "${r||"unnamed"}"; ${o.rule}`}}var Qn=e=>/white|cream|ivory/.test(Jn(e)),er=e=>typeof e=="string"&&bn.includes(e);var rr={ribs:{pitch:.5,min:.25,max:2,w:.09,out:.04},boards:{pitch:.4,min:.15,max:1.5,w:.05,out:.035},louvres:{pitch:.35,min:.2,max:1,w:.12,out:.12},panels:{pitch:1.2,min:.6,max:6,w:.05,out:.035}};var jl={min:.15,max:rr.ribs.max};var or={canal:["#6e5352","#8c7768","#977f73","#a79276","#b8a17a","#575245","#60564b","#62544d","#61584c","#655850","#655b50","#6a5454","#6f6058","#726359","#726459","#76615d","#77685d","#7a6c60","#826c66","#918174","#9a887f","#a89f8a","#6b6163","#dfdcd2"],c19:["#70564f","#6f5b52","#7a665c","#86695b","#886a5f","#857266","#8b746d","#9b887e","#a38e83","#ad9585","#61534a","#63564e","#685b52","#6f6057","#716259","#75665c","#7b6961","#7c6962","#7f6a64","#7f7664","#8e796f","#9c9181","#95787e","#dad8cf"],school:["#665247","#775744","#735d52","#786158","#8c5957","#896559","#856f63","#9d7f6d","#ad997f","#5c4f48","#61564c","#67564e","#6b5554","#6b5851","#6b5b50","#716057","#745e5b","#75655c","#78665f","#806d64","#89706b","#a19888","#614a4e","#a4a09f"],modern:["#715d53","#7c6459","#816b64","#8f7265","#9c8980","#ac9a86","#60594c","#635c4e","#6a5a50","#6c5a54","#6c5e55","#6e6256","#72675a","#776a5d","#7b6a61","#7f6f64","#807265","#886f6b","#8b7d6d","#958b79","#a29189","#695256","#a59b8d","#c8c5ba"]};var Dt={"#4f4834":[215,215,215],"#463823":[216,215,215],"#5f5950":[215,215,215],"#a69873":[215,215,215],"#57423e":[215,215,215],"#473c3b":[215,215,215],"#5d5d5c":[214,215,215],"#7e573b":[215,215,215],"#705449":[215,215,215],"#7f8283":[215,214,215],"#796764":[215,215,215],"#5d534b":[215,215,215],"#7d6e52":[215,215,215],"#88735e":[215,215,215],"#88715f":[215,215,215],"#736352":[215,215,215],"#241d1c":[172,172,172],"#4b3f37":[215,215,215],"#615551":[215,215,215],"#595651":[214,215,214],"#423931":[215,215,215],"#7b6d6a":[215,214,216],"#382418":[215,215,215],"#866343":[215,215,215],"#6e6256":[215,215,215],"#625650":[205,205,205],"#252c24":[185,185,186],"#2d281b":[215,214,215],"#3b342b":[215,215,215],"#6f5c56":[215,215,215],"#393535":[215,215,215],"#786357":[215,215,215],"#383d43":[205,215,215],"#554e4a":[215,216,215],"#3d3432":[215,215,215],"#3d353c":[215,215,215],"#4e443f":[215,215,215],"#70574d":[207,207,207],"#d49662":[215,215,215],"#917b5c":[215,215,215],"#494341":[215,215,215],"#645f5f":[215,215,214],"#342a18":[215,215,215],"#825746":[215,216,215],"#99604e":[212,215,215],"#706868":[215,215,215],"#786b61":[215,215,214],"#5c5b57":[215,215,215],"#7a655b":[215,215,215],"#6f5b54":[215,215,215],"#4a3f3a":[215,214,215],"#614f44":[216,215,215],"#654e44":[215,215,215],"#6f5f53":[215,215,216],"#584d49":[215,215,215],"#d3c9b2":[215,215,215],"#544b46":[215,215,215],"#929289":[215,215,215],"#68584f":[215,215,216],"#574d47":[215,215,215],"#5e4e41":[215,215,215],"#6e605a":[215,215,215],"#605d5c":[215,215,215],"#8c7a6f":[215,215,215],"#4a3832":[165,165,166],"#81614f":[215,215,215],"#3d3533":[215,215,215],"#6d5351":[215,215,215],"#5c3d33":[214,214,215],"#906553":[215,215,215],"#65493d":[215,215,215],"#8e5f49":[215,215,215],"#8c6858":[215,215,215],"#8b5946":[215,215,215],"#665253":[209,209,209],"#3e3222":[215,215,215],"#000000":[197,198,197],"#7b081b":[215,215,215],"#383131":[215,215,215],"#3d3b37":[211,215,215],"#877d76":[214,215,215],"#191d0c":[215,214,213],"#bcab88":[215,215,215],"#656462":[215,215,215],"#3f3634":[174,174,175],"#463e3c":[197,197,198],"#453d3a":[177,177,176],"#1f1a1b":[156,156,157],"#615450":[214,215,215],"#5b4f4b":[215,215,215],"#574c4a":[215,215,215],"#413333":[215,215,215],"#7b5c53":[215,215,215],"#5f342b":[216,215,215],"#4e2422":[215,215,215],"#5b4b44":[209,209,209],"#493d32":[215,215,215],"#6a5048":[216,216,215],"#5e5855":[215,215,215],"#5e3f35":[215,215,215],"#68564f":[215,215,215],"#6b3e33":[215,214,215],"#5f3c30":[215,214,215],"#929191":[215,215,215],"#a2acb3":[215,215,215],"#8f7b65":[215,215,215],"#988e7d":[215,215,215],"#726d60":[215,215,215],"#584c45":[215,214,215],"#594643":[216,215,215],"#5e5750":[212,215,215],"#78645b":[215,215,215],"#484440":[215,215,215],"#73645e":[215,215,215],"#5c4f47":[215,215,215],"#3c3d39":[215,215,215],"#645451":[215,215,214],"#37333d":[179,179,178],"#a6856f":[215,215,215],"#574d4d":[205,205,205],"#393737":[215,215,215],"#6f4a3b":[215,214,215],"#ffa169":[212,215,215],"#576465":[216,215,216],"#71614a":[215,215,215],"#6c584f":[215,215,215],"#5b463e":[215,216,215],"#765e52":[214,215,215],"#4f4e4c":[215,215,215],"#544945":[215,215,215],"#504140":[194,195,194],"#51514f":[215,215,215],"#74665f":[215,215,215],"#735c59":[215,215,215],"#474d56":[215,215,215],"#7d6e5a":[215,215,215],"#514a43":[215,215,215],"#4e4e49":[215,215,215],"#745c51":[215,215,215],"#47403c":[215,215,215],"#4c3a37":[215,215,215],"#675d5a":[215,215,215],"#574e48":[215,215,215],"#686360":[215,215,215],"#4a413f":[215,215,215],"#423735":[215,215,215],"#756860":[215,215,215],"#5e5144":[215,215,215]};var zu={street:{...wt,brick:wt.klinker},tones:Rn};var qa=["sunny","legacy"],Ya="sunny";function se(e){let t=globalThis,r=/[?&]look=([\w-]+)/.exec(e??t.location?.search??"")?.[1]??t.__canalRecallLook;return qa.includes(r??"")?r:Ya}var Le=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},Ka=e=>255*(e<=.0031308?e*12.92:1.055*e**(1/2.4)-.055),pe=e=>{let t=parseInt(e.replace("#",""),16);return[t>>16&255,t>>8&255,t&255]},Et=e=>"#"+e.map(t=>Math.round(Math.max(0,Math.min(255,t))).toString(16).padStart(2,"0")).join(""),Xa=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],Se=e=>Xa(pe(e).map(Le)),Ja=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],Za={zenith:"#9ec3ed",horizon:"#a1c6e5"};function Qa(e){let t=e.sunElevationDeg*Math.PI/180,n=Se(e.sunColour)*e.sunIntensity/Math.PI,r=Se(e.skyColour)*e.skyIntensity/Math.PI,o=Se(e.groundColour)*e.skyIntensity/Math.PI,s=(r+o)/2;return{flat:n*Math.sin(t)+r,sunWall:n*Math.cos(t)+s,shadeWall:s}}var es=.55;function ts(e="#ffe2bf",t="#aca497",n=es){let r=40*Math.PI/180,o=u=>{let l=Et(pe(Za.horizon).map(d=>d+(255-d)*u)),m=Se(e)*2.15/Math.PI*Math.cos(r),c=(Se(l)+Se(t))/2/Math.PI,h=n*m/(1-n)/c;return{sunColour:e,sunIntensity:2.15,skyColour:l,groundColour:t,skyIntensity:h,sunElevationDeg:40}},s=u=>{let l=o(u),m=pe(l.sunColour).map(Le),c=pe(l.skyColour).map(Le),h=[0,2].map(d=>m[d]*l.sunIntensity*Math.sin(r)+c[d]*l.skyIntensity);return h[0]/h[1]},a=0,i=1;for(let u=0;u<40;u++){let l=(a+i)/2;s(l)<1?a=l:i=l}return{...o(i),whiteMix:+i.toFixed(3)}}var ve=ts(),ar=1/Qa(ve).sunWall,lr={sunColour:ve.sunColour,sunIntensity:+(ve.sunIntensity*ar).toFixed(4),skyColour:ve.skyColour,groundColour:ve.groundColour,skyIntensity:+(ve.skyIntensity*ar).toFixed(4)},sr=[.85,1.6],ns=e=>typeof e=="string"?pe(e):e;function It(e){let t=e?Le(219)/Le(Ja(ns(e))):1.106;return Math.max(sr[0],Math.min(sr[1],t))}function Ae(e,t){let n=pe(e).map(o=>Le(o)*t),r=Math.max(1,...n);return Et(n.map(o=>Ka(o/r)))}function ir(e,t=Dt[e.toLowerCase()]){return Ae(e,It(t))}function ur(e,t,n,r=se(),o){return r!=="sunny"||n!=="measured"||e!=="brick"&&e!=="accent"?t:o?ir(t,o):ir(t)}var Ju=(()=>{let e=Object.keys(Dt).map(pe),t=n=>n.slice().sort((r,o)=>r-o)[n.length>>1];return Et([0,1,2].map(n=>t(e.map(r=>r[n]))))})();var rs=2,os=.62;function as(e,t=rs){let n=Ae(e,t);if(E(S(e))[2]>=os)return n;let[r,o,s]=E(S(n));return s<=oe[1]?n:O($([r,o,oe[1]]))}var ss=e=>Object.fromEntries(Object.entries(e).map(([t,n])=>[t,n?n.map(r=>as(r)):null])),ic=ss(or);var is={anonymous:"This building has no name or date in the map data.",named:"The map data has no date for this building.",place:"A mapped place; the map data has no date for its building."},dc=new Set(Object.values(is));var cr=["canal","c19","school","postwar","modern","tower"];var us=8;var Uc=16+Math.log2(us);var C=256,cs=["upper","ground","door","plain","shop"],ms=2;var Vc=cr.length*ms*cs.length;var z=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16));var zc=z("#7d93a0"),jc=z("#1f2a33");var qc=z("#b8ad98"),Yc=z("#cfc6b4"),Kc=z("#ece8dd"),Xc=z("#e2d9c2"),Jc=[z("#2c4a3d"),z("#3a2a22"),z("#1f3b57"),z("#5a2a24")],Zc=[z("#2f4a3a"),z("#7a2f27"),z("#27384f")];var mr=.6;function Je(e,t,n){let r=Math.imul(e|0,374761393)^Math.imul(t|0,668265263)^Math.imul(n|0,2246822519);return r=Math.imul(r^r>>>13,1274126177),((r^r>>>16)>>>0)/4294967296}function fr(e,t){let n=0;for(let o=0;o<e.length;o+=4)n+=e[o];let r=n/(e.length/4);for(let o=0;o<e.length;o+=4){let s=Math.round(Math.max(0,Math.min(255,r+(e[o]-r)*t)));e[o]=e[o+1]=e[o+2]=s}}function dr(e,t){let n=new Uint8ClampedArray(C*C*4),r=(o,s,a,i,u)=>{let l=(s*C+o)*4,m=u??[a,a,a];n[l]=m[0],n[l+1]=m[1],n[l+2]=m[2],n[l+3]=i};if(e==="flat")for(let o=0;o<C;o++)for(let s=0;s<C;s++)r(s,o,Math.round((t?.96:.9+(Je(s>>3,o>>3,3)-.5)*.08)*255),255);else if(e==="tile"){let a=C/8,i=C/5;for(let u=0;u<C;u++)for(let l=0;l<C;l++){let m=Math.floor(u/a),c=u%a/a,h=(l+m%2*i*.5)%C,d=Math.floor(h/i),g=h%i/i,w=Math.sin(g*Math.PI),b=t?.92:.7+.22*w-.28*Math.pow(Math.max(0,1-c*3.2),1.5)*0-.22*Math.max(0,(.18-c)/.18);t||(b+=(Je(d,m,7)-.5)*.14);let M=t?c<.07||g<.035||g>.965:!1;r(l,u,Math.round(Math.max(0,Math.min(1,M?.28:b))*255),255)}t||fr(n,mr)}else if(e==="slate"){let a=C/11,i=C/6;for(let u=0;u<C;u++)for(let l=0;l<C;l++){let m=Math.floor(u/a),c=u%a/a,h=(l+m%2*i*.5)%C,d=Math.floor(h/i),g=h%i/i,w=t?.9:.82+(Je(d,m,11)-.5)*.16-.16*Math.max(0,(.16-c)/.16);(g<(t?.05:.025)||c<(t?.09:.04))&&(w=t?.3:w*.7),r(l,u,Math.round(Math.max(0,Math.min(1,w))*255),255)}t||fr(n,mr)}else for(let u=0;u<C;u++)for(let l=0;l<C;l++){let m=l/C,c=u/C,h=m>.2-.06&&m<.8+.06&&c>.2-.06&&c<.82+.06,d=m>.2+.03&&m<.8-.03&&c>.2+.03&&c<.82-.03,g=Math.abs(m-.5)<.018||Math.abs(c-.5)<.018;if(d&&!g){let w=(c-.2)/.6199999999999999,b=t?[150+60*w,200+30*w,235]:[40+80*w*w,55+90*w*w,68+90*w*w];r(l,u,0,0,[b[0],b[1],b[2]])}else if(h)r(l,u,0,0,t?[255,250,240]:[236,232,221]);else{let w=t?.92:.85+(Je(l>>3,u>>3,5)-.5)*.12,b=t&&(l<5||u<5||l>C-6||u>C-6);r(l,u,Math.round((b?.3:w)*255),255)}}return n}function hr(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let m=0;m<336;m+=112)o.drawImage(t,m,l,112,112);else{let l=7,m=()=>(l=l*16807%2147483647)/2147483647;for(let c=0,h=0;h<336;h+=14,c++)for(let d=-(c%2)*24;d<336;d+=48){let g=150+m()*50;o.fillStyle=`rgb(${g},${g*.92},${g*.86})`,o.fillRect(d,h,48,14)}}o.strokeStyle="rgba(235,223,205,0.18)",o.lineWidth=1.7;for(let l=0,m=6;m<336;m+=14,l++){o.beginPath(),o.moveTo(0,m),o.lineTo(336,m),o.stroke();for(let c=l%2*24;c<336;c+=48)o.beginPath(),o.moveTo(c,m),o.lineTo(c,m+14),o.stroke()}let s=o.getImageData(0,0,336,336),a=s.data,i=0;for(let l=0;l<a.length;l+=4)i+=(a[l]+a[l+1]+a[l+2])/3;i/=a.length/4;let u=i>0?Math.min(2.4,225/i):1;for(let l=0;l<a.length;l+=4){let m=(a[l]+a[l+1]+a[l+2])/3,c=Math.min(255,(m+(i-m)*.7)*u);a[l]=a[l+1]=a[l+2]=c,a[l+3]=255}return o.putImageData(s,0,0),r}function pr(e){let t=e.createElement("canvas");t.width=64,t.height=128;let n=t.getContext("2d"),r=n.createLinearGradient(0,0,0,128);return r.addColorStop(0,"#8aa1b0"),r.addColorStop(.5,"#4d606c"),r.addColorStop(1,"#3c474e"),n.fillStyle=r,n.fillRect(0,0,64,128),n.fillStyle="rgba(235,242,248,0.16)",n.beginPath(),n.moveTo(10,0),n.lineTo(34,0),n.lineTo(4,70),n.lineTo(-20,70),n.closePath(),n.fill(),t}function br(e){let t=e.createElement("canvas");t.width=fe,t.height=de;let n=t.getContext("2d"),r=n.createImageData(fe,de);for(let o=0;o<de;o++)for(let s=0;s<fe;s++){let a=(o*fe+s)*4,i=Mt(s,o);r.data[a]=r.data[a+1]=r.data[a+2]=i,r.data[a+3]=255}return n.putImageData(r,0,0),t}function gr(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d");n.fillStyle="#ffffff",n.fillRect(0,0,128,128),n.fillStyle="rgba(0,0,0,0.10)";for(let r=0;r<128;r+=16)n.fillRect(r,0,1.5,128);return t}function xr(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=23,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++){let i=(s()-.5)*3;for(let u=0;u<128;u++){let l=(a*128+u)*4,m=s()<.012?-14:0,c=243+(s()-.5)*8+i+m;r.data[l]=r.data[l+1]=r.data[l+2]=c,r.data[l+3]=255}}return n.putImageData(r,0,0),t}function yr(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=11,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<r.data.length;a+=4){let i=228+(s()-.5)*16;r.data[a]=r.data[a+1]=r.data[a+2]=i,r.data[a+3]=255}return n.putImageData(r,0,0),n.fillStyle="rgba(80,70,60,0.18)",n.fillRect(0,0,128,1.5),t}function Ze(e,t){let n=dr(t,!1),r=Math.round(Math.sqrt(n.length/4)),o=e.createElement("canvas");o.width=o.height=r;let s=o.getContext("2d"),a=s.createImageData(r,r);for(let i=0;i<n.length;i+=4)a.data[i]=n[i],a.data[i+1]=n[i+1],a.data[i+2]=n[i+2],a.data[i+3]=255;return s.putImageData(a,0,0),o}var fs=238;function Mr(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let m=0;m<336;m+=112)o.drawImage(t,m,l,112,112);else{let l=13,m=()=>(l=l*16807%2147483647)/2147483647;for(let c=0,h=0;h<336;h+=14,c++)for(let d=-(c%2)*24;d<336;d+=48){let g=165+m()*30;o.fillStyle=`rgb(${g},${g*.93},${g*.88})`,o.fillRect(d,h,48,14)}}o.strokeStyle="rgba(245,240,230,0.26)",o.lineWidth=1.2;for(let l=0,m=6;m<336;m+=14,l++){o.beginPath(),o.moveTo(0,m),o.lineTo(336,m),o.stroke();for(let c=l%2*24;c<336;c+=48)o.beginPath(),o.moveTo(c,m),o.lineTo(c,m+14),o.stroke()}let s=o.getImageData(0,0,336,336),a=s.data,i=0;for(let l=0;l<a.length;l+=4)i+=(a[l]+a[l+1]+a[l+2])/3;i/=a.length/4;let u=i>0?Math.min(2.6,fs/i):1;for(let l=0;l<a.length;l+=4){let m=(a[l]+a[l+1]+a[l+2])/3,c=Math.min(255,(m+(i-m)*.82)*u);a[l]=a[l+1]=a[l+2]=c,a[l+3]=255}return o.putImageData(s,0,0),r}function wr(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=31,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++)for(let i=0;i<128;i++){let u=(a*128+i)*4,l=246+(s()-.5)*3;r.data[u]=r.data[u+1]=r.data[u+2]=l,r.data[u+3]=255}return n.putImageData(r,0,0),t}function _r(e){let t=e.createElement("canvas");t.width=t.height=4;let n=t.getContext("2d");return n.fillStyle="#fff",n.fillRect(0,0,4,4),t}var Rr={minFilter:"LinearMipmapLinear",magFilter:"Linear",generateMipmaps:!0};function ds(e,t){let n=t.coarse?128:256,r=e==="facadeCells"?Math.min(t.gpuMaxAnisotropy,t.coarse?4:16):4;return{...Rr,cellPx:n,anisotropy:r,tierScale:1}}function hs(e,t){if(!t.enabled||t.coarse||t.tier!=="high")return ds(e,t);let n=Number.isFinite(t.gpuMaxAnisotropy)&&t.gpuMaxAnisotropy>=1?t.gpuMaxAnisotropy:1,r=Number(t.cellPx),o=Number.isInteger(r)&&r>256&&r<=512&&r%32===0?r:256,s=Number(t.facadeAnisotropy),a=e==="facadeCells"?Number.isFinite(s)&&s>=1?Math.min(s,16):4:16;return{...Rr,cellPx:o,anisotropy:Math.min(n,a),tierScale:o/256}}function ps(){try{let e=globalThis,t=Number(e.__canalRecallTexAniso??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texAniso"):null)??NaN);return Number.isFinite(t)&&t>=1?t:null}catch{return null}}function bs(){try{let e=globalThis,t=e.__canalRecallTexturePolicy??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texturePolicy"):null);return!(t===!1||t==="0"||t==="false"||t==="off")}catch{return!0}}function gs(){try{let e=globalThis,t=Number(e.__canalRecallCellPx??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("cellPx"):null)??NaN);return Number.isFinite(t)&&t>0?t:null}catch{return null}}function xs(){let e=globalThis.__canalPerf?.tier;return e==="low"||e==="mid"||e==="high"?e:null}function ys(){return!!globalThis.matchMedia?.("(pointer: coarse)").matches}function vr(e,t){return hs(e,{tier:xs(),coarse:ys(),gpuMaxAnisotropy:t,enabled:bs(),cellPx:gs(),facadeAnisotropy:ps()})}var ke=(e,t)=>`(${e}.g + 1.0 - ${t}.a)`;function Ms(){let e=globalThis;return(e.__canalRecallMaskFormat??new URLSearchParams(e.location?.search??"").get("maskFormat"))==="rg"?"rg":"r8"}function Sr(e,t,n=Ms()){let r=t.length>>1;if(e.length!==r*4)throw new Error(`packMask: ${e.length} colour bytes for ${r} mask texels`);if(n==="rg"){for(let s=0;s<r;s++)e[s*4+3]=255;return{colour:e,mask:t,channels:2}}let o=new Uint8Array(r);for(let s=0;s<r;s++)o[s]=t[s*2],e[s*4+3]=255-t[s*2+1];return{colour:e,mask:o,channels:1}}var ws=70,_s=190,Rs=.5,Lr=15,Ar=40;var Pt="12.0";var kr=[-1,-1];var Tr=[-1,-1],Fr=()=>[ws,_s,Rs],Qe=e=>Number.isInteger(e)?e.toFixed(1):String(e),Or=`
uniform vec2 roofLayers;
uniform vec3 roofTier;
vec3 roofTierColour(vec3 fine, vec2 uv, float layer, float dist) {
  if (roofLayers.x < 0.0 || layer < roofLayers.x - 0.5 || layer > roofLayers.y - 0.5) return fine;
  float mid = smoothstep(roofTier.x - ${Qe(Lr)}, roofTier.x + ${Qe(Lr)}, dist);
  if (mid <= 0.0) return fine;
  float far = smoothstep(roofTier.y - ${Qe(Ar)}, roofTier.y + ${Qe(Ar)}, dist);
  vec3 coarse = texture(cells, vec3(uv * roofTier.z, layer)).rgb;
  vec3 flatMean = textureLod(cells, vec3(uv, layer), ${Pt}).rgb;
  return mix(mix(fine, coarse, mid), flatMean, far);
}`;var vs={threshold:20,taps:9,spread:1,grad:.85,sdf:1},Ss=`
uniform vec4 cellTaps;
uniform float cellTapsSdf;
float cellTapW = 0.0;
float cellTapsWeight(float rho) { return cellTaps.y > 1.5 && cellTaps.x >= 0.0 ? smoothstep(cellTaps.x, max(1.25 * cellTaps.x, cellTaps.x + 1e-3), rho) : 0.0; }
void cellTapsSample(vec3 p, vec2 dx, vec2 dy, out vec4 cc, out vec2 mm) {
  cc = vec4(0.0); mm = vec2(0.0);
  float s = cellTaps.z;
  if (cellTaps.y > 6.5) {
    // 3 x 3 at -s, 0, s on both screen axes, tent weights 1/4 1/2 1/4.
    vec2 gx = dx * cellTaps.w, gy = dy * cellTaps.w;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      float w = (i == 0 ? 0.5 : 0.25) * (j == 0 ? 0.5 : 0.25);
      vec3 q = vec3(p.xy + (float(i) * s) * dx + (float(j) * s) * dy, p.z);
      cc += w * textureGrad(cells, q, gx, gy); mm += w * textureGrad(masks, q, gx, gy).rg;
    }
  } else if (cellTaps.y > 3.5) {
    // 2 x 2 at +-s/2 on both screen axes, equal weights (the tent of a two-tap row).
    vec2 gx = dx * cellTaps.w, gy = dy * cellTaps.w;
    for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
      vec3 q = vec3(p.xy + ((float(i) - 0.5) * s) * dx + ((float(j) - 0.5) * s) * dy, p.z);
      cc += 0.25 * textureGrad(cells, q, gx, gy); mm += 0.25 * textureGrad(masks, q, gx, gy).rg;
    }
  } else {
    // 2 taps at +-s/2 along the longer screen derivative; only that axis's gradient is scaled.
    bool alongX = dot(dx, dx) >= dot(dy, dy);
    vec2 ax = alongX ? dx : dy;
    vec2 gx = alongX ? dx * cellTaps.w : dx, gy = alongX ? dy : dy * cellTaps.w;
    for (int i = 0; i < 2; i++) {
      vec3 q = vec3(p.xy + ((float(i) - 0.5) * s) * ax, p.z);
      cc += 0.5 * textureGrad(cells, q, gx, gy); mm += 0.5 * textureGrad(masks, q, gx, gy).rg;
    }
  }
}`;function Bt(e=vs,t=1){let n=Number.isFinite(t)&&t>0?t:1;return{cellTaps:[e.threshold*n,e.taps,e.spread,e.grad],cellTapsSdf:e.sdf}}var Cr=`${qn}
uniform vec2 cellTier;
#ifdef CELL_TIER_PROBE
// What the last cellTierSample saw (look/windowSdf.ts reads them: the ?cellDebug=rho view, the analytic windows' fade).
float cellRho = 0.0; float cellFarTier = 0.0; float cellFar = 0.0;
#endif
#ifdef CELL_TIER_ANISO
// The anisotropy-aware footprint (lane R3-D #233, off by default, ?cellTierAniso=1 adds the define): cellAniso is the anisotropy the
// cells texture was given (look/texturePolicy.ts); <= 0 falls back to the major-axis rule in the same program (A/B).
// cellAnisoRule = (flatten on the effective footprint 1/0, fade where the filter undersamples: 0 off, 1 on the |dFdx|/|dFdy|
// axes, 2 on the footprint ellipse's axes; fade band from, to).
uniform float cellAniso;
uniform vec4 cellAnisoRule;
#ifdef CELL_TIER_PROBE
float cellRhoEff = 0.0; float cellUnder = 0.0; float cellFarFlat = 0.0; float cellFarUnder = 0.0;
#endif
#endif
#ifdef CELL_LOD_BIAS
// ?cellLodBias=<b> (lane R3-B #231, look/cellMips.ts): a mip bias on the facade cell sample, the cheap sharpness A/B.
uniform float cellLodBias;
#endif
#ifdef CELL_TAPS
${Ss}
#endif
void cellTierSample(vec3 p, float dist, out vec3 c, out vec2 m) {
#ifdef CELL_LOD_BIAS
  vec4 cc = texture(cells, p, cellLodBias); vec2 mm = texture(masks, p, cellLodBias).rg;
#else
  vec4 cc = texture(cells, p); vec2 mm = texture(masks, p).rg;
#endif
  c = cc.rgb; m = vec2(mm.r, ${ke("mm","cc")});
  float far = 0.0;
#ifdef CELL_TIER_PROBE
  cellRho = max(length(dFdx(p.xy)), length(dFdy(p.xy))) * float(textureSize(cells, 0).x);
#endif
  if (cellTier.x >= 0.0) {
#ifdef CELL_TIER_ANISO
    // The footprint the anisotropic filter samples at (EXT_texture_filter_anisotropic: N = min(ceil(major / minor),
    // aniso) probes at level log2(major / N)), i.e. max(minor, major / aniso): flatten on that, not on the major axis, so
    // a grazing wall keeps the windows the filter can still draw. Where major / (aniso x max(minor, 1)) passes 1 the
    // probes no longer cover the footprint along the wall (minification stops at level 0 across it) and the grid
    // beats against the pixels: fade toward the mean there instead.
    float texels = float(textureSize(cells, 0).x);
    vec2 ja = dFdx(p.xy) * texels, jb = dFdy(p.xy) * texels;
    float lx = length(ja), ly = length(jb);
    float major = max(lx, ly), minor = min(lx, ly);
    float rhoEff = cellAniso > 0.0 && cellAnisoRule.x > 0.5 ? max(minor, major / cellAniso) : major;
    float under = 0.0;
    if (cellAniso > 0.0) {
      if (cellAnisoRule.y > 1.5) {
        // The footprint ellipse's own axes (the singular values of the uv Jacobian): on a wall receding diagonally
        // across the screen both derivatives are long and min(|dFdx|, |dFdy|) hides how thin the footprint is.
        float tr = dot(ja, ja) + dot(jb, jb), det = abs(ja.x * jb.y - ja.y * jb.x);
        float s1 = sqrt(0.5 * (tr + sqrt(max(tr * tr - 4.0 * det * det, 0.0))));
        under = s1 / (cellAniso * max(det / max(s1, 1e-6), 1.0));
      } else under = major / (cellAniso * max(minor, 1.0));
    }
    float farFlat = smoothstep(cellTier.x, cellTier.y, rhoEff);
    float farUnder = cellAniso > 0.0 && cellAnisoRule.y > 0.5 ? smoothstep(cellAnisoRule.z, cellAnisoRule.w, under) : 0.0;
    far = max(farFlat, farUnder);
#ifdef CELL_TIER_PROBE
    cellRhoEff = rhoEff; cellUnder = under; cellFarFlat = farFlat; cellFarUnder = farUnder;
#endif
#else
    float rho = max(length(dFdx(p.xy)), length(dFdy(p.xy))) * float(textureSize(cells, 0).x);
    far = smoothstep(cellTier.x, cellTier.y, rho);
#endif
  }
#ifdef CELL_TIER_PROBE
  cellFarTier = far;
#endif
#if defined( USE_FOG ) && ! defined( DEPTH_FADE_LIMIT_ONLY )
  far = max(far, ${Yn("dist")});
#endif
#ifdef CELL_TIER_PROBE
  cellFar = far;
#endif
#ifdef CELL_TAPS
  // The footprint prefilter (lane R4-D #246): above the threshold the one sample becomes several over the pixel (skipped
  // where the tier or the depth fade has made the texel wholly the mean colour).
  if (far < 1.0) {
    vec2 tdx = dFdx(p.xy), tdy = dFdy(p.xy);
    cellTapW = cellTapsWeight(max(length(tdx), length(tdy)) * float(textureSize(cells, 0).x));
    if (cellTapW > 0.0) {
      vec4 tc; vec2 tm; cellTapsSample(p, tdx, tdy, tc, tm);
      c = mix(c, tc.rgb, cellTapW); m = mix(m, vec2(tm.r, ${ke("tm","tc")}), cellTapW);
    }
  }
#endif
  if (far <= 0.0) return;
  vec4 fc = textureLod(cells, p, ${Pt}); vec2 fm = textureLod(masks, p, ${Pt}).rg;
  c = mix(c, fc.rgb, far); m = mix(m, vec2(fm.r, ${ke("fm","fc")}), far);
}`,Ls=[1,2];function Nt(e,t=Ls){return{cellAniso:Number.isFinite(e)&&e>=1?e:1,cellAnisoRule:[1,1,t[0],t[1]]}}var As=.5,tt={sunAzimuthDeg:215,sunElevationDeg:40,sunColour:"#ffe9cc",sunIntensity:2.15,skyColour:"#e3ebf6",groundColour:"#998a72",skyIntensity:1.75,shadows:!0,shadowMapSize:2048,shadowIntensity:1-As};var ym={...tt,...lr};function ks(e,t){let n=e*Math.PI/180,r=t*Math.PI/180;return[Math.sin(n)*Math.cos(r),Math.cos(n)*Math.cos(r),Math.sin(r)]}var Mm=ks(tt.sunAzimuthDeg,tt.sunElevationDeg),nt=(()=>{let e=tt.sunAzimuthDeg*Math.PI/180;return[Math.sin(e),Math.cos(e)]})(),et=[nt[0]*.6,nt[1]*.6,.8],Dr=.84;function Ts(e){let t=e[0]*et[0]+e[1]*et[1]+e[2]*et[2];return Math.max(.5,Math.min(1,.58+.42*Math.max(0,t)))}var wm=Ts([0,0,1]),Ge=e=>Number.isInteger(e)?e.toFixed(1):String(+e.toFixed(6)),rt=`
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = ${Ge(Dr)} + ${Ge(1-Dr)} * (0.5 + 0.5 * dot(h, vec2(${Ge(nt[0])}, ${Ge(nt[1])}))); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, dot(n, vec3(${et.map(Ge).join(", ")}))), 0.5, 1.0);`;var Er=[.4,2.5],Fs=["brick","accent","stucco"];function Os(e){let t=(e?.white?It(e.white):1.106)*(e?.stripOverDrawn??1);return Math.max(Er[0],Math.min(Er[1],t))}var Cs=["brick","accent"];function Ir(e,t,n,r,o=se()){return o!=="sunny"||r==="measured"?t:n?Fs.includes(e)?Ae(t,Os(n)):t:Cs.includes(e)?Ae(t,1.106):t}var I=[{name:"magnified (rho < 1)",rgb:[255,0,0]},{name:"rho 1-2",rgb:[255,255,0]},{name:"rho 2-4",rgb:[0,255,0]},{name:"rho 4-8",rgb:[0,255,255]},{name:"rho 8-16",rgb:[0,0,255]},{name:"rho 16-tier",rgb:[255,128,0]},{name:"tier far > 0",rgb:[255,0,255]},{name:"depth-fade far > 0 (tier 0)",rgb:[255,255,255]},{name:"under fade > 0",rgb:[128,0,255]},{name:"roof layer",rgb:[128,128,128]}];var Tm=I.length-1,Ds=3;var Es=520,Is=Es.toFixed(1),Ps=String(Ds),P=e=>`vec3(${e.map(t=>(t/255).toFixed(4)).join(", ")})`,Br=`
#ifdef CELL_DEBUG_RHO
vec3 cellDebugColour(float layer) {
  if (roofLayers.x >= 0.0 && layer > roofLayers.x - 0.5 && layer < roofLayers.y - 0.5) return ${P(I[9].rgb)};
#if defined(CELL_TIER_ANISO) && defined(CELL_DEBUG_UNDER)
  if (cellFarFlat > 0.001) return ${P(I[6].rgb)};
  if (cellFarTier <= 0.001 && cellFar > 0.001) return ${P(I[7].rgb)};
  if (cellUnder < 0.5) return ${P(I[0].rgb)};
  if (cellUnder < 0.75) return ${P(I[1].rgb)};
  if (cellUnder < 1.0) return ${P(I[2].rgb)};
  if (cellUnder < 1.5) return ${P(I[3].rgb)};
  if (cellUnder < 2.0) return ${P(I[4].rgb)};
  return ${P(I[5].rgb)};
#else
#ifdef CELL_TIER_ANISO
  if (cellFarFlat > 0.001) return ${P(I[6].rgb)};
  if (cellFarUnder > 0.001) return ${P(I[8].rgb)};
#else
  if (cellFarTier > 0.001) return ${P(I[6].rgb)};
#endif
  if (cellFar > 0.001) return ${P(I[7].rgb)};
  if (cellRho < 1.0) return ${P(I[0].rgb)};
  if (cellRho < 2.0) return ${P(I[1].rgb)};
  if (cellRho < 4.0) return ${P(I[2].rgb)};
  if (cellRho < 8.0) return ${P(I[3].rgb)};
  if (cellRho < 16.0) return ${P(I[4].rgb)};
  return ${P(I[5].rgb)};
#endif
}
#endif`;function Te(e){try{return typeof URLSearchParams=="function"?new URLSearchParams(globalThis.location?.search??"").get(e):null}catch{return null}}var Bs=1.25,Pr=[2.5,5],Ns={footprint:1,fadePx:[2,4],frameMinPx:0,barPx:[0,0],tent:!0};function Gs(){let t=globalThis.__canalRecallWindowSdfBand??Te("windowSdfBand");return!(t===!1||t==="0"||t==="false"||t==="off")}var ot=(e,t)=>{if(e==null)return null;let n=e.split(",").map(Number);return n.length===t&&n.every(r=>Number.isFinite(r)&&r>=0)?n:null};function Us(){let e=Ns,t=ot(Te("windowSdfFoot"),1)?.[0]??e.footprint,n=ot(Te("windowSdfFade"),2)??e.fadePx,r=ot(Te("windowSdfFrameMin"),1)?.[0]??e.frameMinPx,o=ot(Te("windowSdfBar"),2)??e.barPx,s=Te("windowSdfTent"),a=s==null?e.tent:s==="1";return{band:[Gs()?1:0,t,n[0],n[1]],shape:[r,o[0],o[1],a?1:0]}}var Gt=null;function Nr(){let e=`${globalThis.location?.search??""}|${String(globalThis.__canalRecallWindowSdfBand)}`;Gt?.key!==e&&(Gt={key:e,v:Us()});let t=Gt.v;return{windowSdfBand:{value:[...t.band]},windowSdfShape:{value:[...t.shape]}}}var at=["#6f8796","#2f4350","#1d2a33"],st=e=>P([parseInt(e.slice(1,3),16),parseInt(e.slice(3,5),16),parseInt(e.slice(5,7),16)]),Gr=`
#ifdef CITY_WINDOW_SDF
uniform highp sampler2D windowTable;
// 1 in the game; the A/B probes set 0 to draw the painted cell in the same page and pose (tests/e2e/crisp-textures).
uniform float windowSdfMix;
// Band-limited windows (lane R3-B #231): [on, footprint, fade from px, fade to px], [frame min px, bar fade from px, to px, tent].
// x = 0 is round two's shader exactly (?windowSdfBand=0).
uniform vec4 windowSdfBand;
uniform vec4 windowSdfShape;
// Coverage of [a, b] by a pixel of width fw centred at x (exact for a box pixel; thin bars give their area). Band mode
// with windowSdfShape.w = 1: a tent reaching fw either side instead (a partition of unity at the pixel pitch, so a thin bar's
// summed coverage and its peak stay the same at every sub-pixel phase).
float wsTentCdf(float u) { u = clamp(u, -1.0, 1.0); return u < 0.0 ? 0.5 * (1.0 + u) * (1.0 + u) : 1.0 - 0.5 * (1.0 - u) * (1.0 - u); }
float wsCover(float x, float a, float b, float fw) {
  if (windowSdfBand.x > 0.5 && windowSdfShape.w > 0.5) return max(wsTentCdf((b - x) / fw) - wsTentCdf((a - x) / fw), 0.0);
  return clamp((min(b, x + 0.5 * fw) - max(a, x - 0.5 * fw)) / fw, 0.0, 1.0);
}
// Coverage of the opening [x0, x1] x [y0, top(x)] in canvas px (y up); shape 1 segmental, 2 arch.
float wsOpening(vec2 p, vec2 fw, float x0, float x1, float y0, float y1, float shape, float rise) {
  float cx = wsCover(p.x, x0, x1, fw.x);
  if (shape > 1.5) {
    float r = 0.5 * (x1 - x0), cy = y1 - r;
    float below = wsCover(p.y, y0, cy, fw.y);
    float d = length(p - vec2(x0 + r, cy)) - r, fwr = max(0.5 * (fw.x + fw.y), 1e-4);
    float above = p.y > cy ? clamp(0.5 - d / fwr, 0.0, 1.0) : 0.0;
    return max(cx * below, above * wsCover(p.y, cy, y1, fw.y));
  }
  float top = y1;
  if (shape > 0.5) { float s = clamp((p.x - x0) / max(x1 - x0, 1e-4), 0.0, 1.0); top = y1 - rise + 4.0 * rise * s * (1.0 - s); }
  return cx * wsCover(p.y, y0, top, fw.y);
}
float wsBarH(vec2 p, vec2 fw, float x0, float x1, float yc, float hw) { return wsCover(p.x, x0, x1, fw.x) * wsCover(p.y, yc - hw, yc + hw, fw.y); }
float wsBarV(vec2 p, vec2 fw, float y0, float y1, float xc, float hw) { return wsCover(p.y, y0, y1, fw.y) * wsCover(p.x, xc - hw, xc + hw, fw.x); }
// Band mode: a bar's weight as its width on screen (2 hw / fw across it) falls through the bar fade, and its area share
// of the span it crosses (what the glass takes over as it fades).
float wsBarFade(float hw, float fwAcross) { return windowSdfShape.z <= 0.0 ? 1.0 : smoothstep(windowSdfShape.y, windowSdfShape.z, 2.0 * hw / max(fwAcross, 1e-4)); }
void windowSdf(vec2 uv, float layer, float weight, inout vec3 c, inout vec2 m) {
  weight *= windowSdfMix;
  if (weight <= 0.0) return;
  int row = int(layer + 0.5);
  vec4 head = texelFetch(windowTable, ivec2(0, row), 0);
  int count = int(head.x + 0.5);
  if (count <= 0) return;
  bool band = windowSdfBand.x > 0.5;
  vec2 cell = vec2(${Is}, head.y);
  vec2 p = fract(uv) * cell;
  // The pixel's footprint from the continuous uv (fract jumps at the cell seam), in canvas px per framebuffer px.
  vec2 fpx = max(fwidth(uv * cell), vec2(1e-3));
  vec2 fw = fpx * (band ? windowSdfBand.y : ${Bs.toFixed(2)});
#ifdef CELL_TAPS
  // The footprint prefilter's taps (roofTier.ts, lane R4-D #246) widen the edge box with the wall under the windows.
  fw *= mix(1.0, cellTapsSdf, cellTapW);
#endif
  vec2 fade = band ? windowSdfBand.zw : vec2(${Pr[0].toFixed(1)}, ${Pr[1].toFixed(1)});
  for (int i = 0; i < ${Ps}; i++) {
    if (i >= count) break;
    vec4 r = texelFetch(windowTable, ivec2(1 + 4 * i, row), 0) * vec4(cell.x, cell.x, cell.y, cell.y);
    // Windows never overlap in x: skip any whose opening (plus a footprint) does not hold this pixel.
    if (p.x < r.x - fw.x || p.x > r.y + fw.x || p.y < r.z - fw.y || p.y > r.w + fw.y) continue;
    vec4 t1 = texelFetch(windowTable, ivec2(2 + 4 * i, row), 0);
    vec4 frame = texelFetch(windowTable, ivec2(3 + 4 * i, row), 0);
    vec4 t3 = texelFetch(windowTable, ivec2(4 + 4 * i, row), 0);
    float shape = t1.x, muntin = t1.y, ix = t1.z * cell.x, iy = t1.w * cell.y, rise = t3.x * cell.y, lift = t3.y;
    // Small windows go back to the painted (mip-filtered) cell: a box-filtered grid of 2-4 px openings beats against
    // the pixel grid as the camera moves (S3 still pan, DPR 2 and the phone), where the trilinear texel does not.
    // Band mode measures the opening in true pixels (the footprint widens the box, not the size test).
    vec2 fs = band ? fpx : fw;
    float sizePx = min((r.y - r.x) / fs.x, (r.w - r.z) / fs.y);
    float wk = weight * smoothstep(fade.x, fade.y, sizePx);
    if (wk <= 0.0) continue;
    float outer = wsOpening(p, fw, r.x, r.y, r.z, r.w, shape, rise);
    if (outer <= 0.0) continue;
    // Band mode: the frame ring at least frameMinPx wide on screen (widened into the glass, the outline stays), drawn
    // at the contrast k that keeps its integrated tone: true ring area over the drawn ring's.
    float k = 1.0, ixd = ix, iyd = iy;
    if (band) {
      ixd = min(max(ix, windowSdfShape.x * fpx.x), 0.35 * (r.y - r.x));
      iyd = min(max(iy, windowSdfShape.x * fpx.y), 0.35 * (r.w - r.z));
      float W = r.y - r.x, H = r.w - r.z;
      float trueRing = W * H - max(W - 2.0 * ix, 0.0) * max(H - 2.0 * iy, 0.0);
      float drawnRing = W * H - max(W - 2.0 * ixd, 0.0) * max(H - 2.0 * iyd, 0.0);
      k = drawnRing > 0.0 ? clamp(trueRing / drawnRing, 0.0, 1.0) : 1.0;
    }
    float px0 = r.x + ixd, px1 = r.y - ixd, py0 = r.z + iyd, py1 = r.w - iyd;
    float paneRise = shape > 0.5 && shape < 1.5 ? rise : 0.0;
    float pane = wsOpening(p, fw, px0, px1, py0, py1, shape, paneRise);
    // Muntins, the painter's bars (bayTextures.ts windowAt), positioned on the opening's height h from its top. In band
    // mode each bar fades out by its width on screen and its lost area goes into the glass mean (barMean).
    float h = r.w - r.z, top = r.w, xm = 0.5 * (r.x + r.y), bars = 0.0, barMean = 0.0;
    float bh = 1.0, bv = 1.0;
    float hp = max(py1 - py0, 1e-3), wp = max(px1 - px0, 1e-3);
    if (muntin > 0.5 && muntin < 1.5) {
      if (band) { bh = wsBarFade(2.0, fpx.y); barMean = (1.0 - bh) * 4.0 / hp; }
      bars = bh * wsBarH(p, fw, px0, px1, top - 0.29 * h, 2.0);
    } else if (muntin < 2.5 && muntin > 1.5) {
      if (band) { bh = wsBarFade(2.0, fpx.y); bv = wsBarFade(2.0, fpx.x); barMean = (1.0 - bh) * 4.0 / hp + (1.0 - bv) * 4.0 / wp; }
      bars = max(bh * wsBarH(p, fw, px0, px1, top - 0.27 * h, 2.0), bv * wsBarV(p, fw, py0, py1, xm, 2.0));
    } else if (muntin < 3.5 && muntin > 2.5) {
      if (band) { bh = wsBarFade(4.0, fpx.y); bv = wsBarFade(4.0, fpx.x); barMean = (1.0 - bh) * 8.0 / hp + (1.0 - bv) * 8.0 / wp; }
      bars = max(bh * wsBarH(p, fw, px0, px1, top - 0.42 * h - 4.0, 4.0), bv * wsBarV(p, fw, py0, py1, xm, 4.0));
    } else if (muntin < 4.5 && muntin > 3.5) {
      float bh3 = 1.0, bh15 = 1.0, bv15 = 1.0;
      if (band) { bh3 = wsBarFade(3.0, fpx.y); bh15 = wsBarFade(1.5, fpx.y); bv15 = wsBarFade(1.5, fpx.x); barMean = ((1.0 - bh3) * 6.0 + (1.0 - bh15) * 6.0) / hp + (1.0 - bv15) * 6.0 / wp; }
      bars = max(bh3 * wsBarH(p, fw, px0, px1, top - 0.5 * h, 3.0), bh15 * max(wsBarH(p, fw, px0, px1, top - 0.25 * h, 1.5), wsBarH(p, fw, px0, px1, top - 0.75 * h, 1.5)));
      float third = (px1 - px0) / 3.0;
      bars = max(bars, bv15 * max(wsBarV(p, fw, py0, py1, px0 + third, 1.5), wsBarV(p, fw, py0, py1, px0 + 2.0 * third, 1.5)));
    } else if (muntin > 4.5) {
      if (band) { bv = wsBarFade(3.0, fpx.x); barMean = (1.0 - bv) * 18.0 / wp; }
      float quarter = (px1 - px0) / 4.0;
      bars = bv * max(wsBarV(p, fw, py0, py1, px0 + quarter, 3.0), max(wsBarV(p, fw, py0, py1, px0 + 2.0 * quarter, 3.0), wsBarV(p, fw, py0, py1, px0 + 3.0 * quarter, 3.0)));
    }
    float glass = pane * (1.0 - bars);
    // The glazing gradient down the opening, then the atlas's calm lift of dark texels (paintLookAtlas.ts).
    float g = clamp((top - p.y) / max(h, 1e-3), 0.0, 1.0);
    vec3 gc = g < 0.55 ? mix(${st(at[0])}, ${st(at[1])}, g / 0.55) : mix(${st(at[1])}, ${st(at[2])}, (g - 0.55) / 0.45);
    float lum = (gc.r + gc.g + gc.b) / 3.0;
    if (lum < ${(90/255).toFixed(5)}) gc += (vec3(${(150/255).toFixed(5)}) - gc) * lift * (1.0 - lum / ${(90/255).toFixed(5)});
    if (band) {
      // The glass takes the faded bars' mean; the drawn ring is frame over that glass at contrast k.
      vec3 gm = mix(gc, frame.rgb, clamp(barMean, 0.0, 1.0));
      float mf = frame.a * clamp(barMean, 0.0, 1.0);
      c = mix(c, mix(gm, frame.rgb, k), outer * wk); m = mix(m, vec2(0.0, mix(mf, frame.a, k)), outer * wk);
      c = mix(c, mix(gm, frame.rgb, bars), pane * wk); m = mix(m, vec2(0.0, mix(mf, frame.a, bars)), pane * wk);
      continue;
    }
    c = mix(c, frame.rgb, outer * wk); m = mix(m, vec2(0.0, frame.a), outer * wk);
    c = mix(c, gc, glass * wk); m = mix(m, vec2(0.0), glass * wk);
  }
}
#endif`;var Ws={legacy:.9,sunny:1},Hs=(e=se())=>Ws[e],te=Hs(),Ue=255/Pe,$s=255/228,Vs=255/243,zs=255/246,lt=[{cell:"brick",tileM:q.brick,clampUv:!1,litGain:Ue*te,skyTint:!1},{cell:"stucco",tileM:q.stucco,clampUv:!1,litGain:Vs*te,skyTint:!1},{cell:"stone",tileM:q.stone,clampUv:!1,litGain:$s*te,skyTint:!1},{cell:"white",tileM:1,clampUv:!1,litGain:1,skyTint:!1},{cell:"door",tileM:q.door,clampUv:!1,litGain:1,skyTint:!1},{cell:"glass",tileM:q.glass,clampUv:!0,litGain:1,skyTint:!0},{cell:"tile",tileM:q.roofTile,clampUv:!1,litGain:Ue*te,skyTint:!1},{cell:"slate",tileM:q.slate,clampUv:!1,litGain:Ue*te,skyTint:!1},{cell:"flat",tileM:q.bitumen,clampUv:!1,litGain:Ue*te,skyTint:!1},{cell:"brick20",tileM:q.brick,clampUv:!1,litGain:Ue*te,skyTint:!1},{cell:"whiteStucco",tileM:q.stucco,clampUv:!1,litGain:zs*te,skyTint:!1},{cell:"glassTint",tileM:q.glass,clampUv:!0,litGain:1,skyTint:!0}],it=lt.length,We=Object.fromEntries(lt.map((e,t)=>[e.cell,t])),Wt=64,js=3,qs=3.2,Fe={x0:.28,x1:.72,y0:.3,y1:.8,frame:.035},ie=e=>Number.isInteger(e)?e.toFixed(1):String(e),Ys=`
void cityWindowGrid(vec2 m, inout vec3 c, inout vec2 mk) {
  vec2 cell = fract(m / vec2(${ie(js)}, ${ie(qs)}));
  vec2 lo = vec2(${ie(Fe.x0)}, ${ie(Fe.y0)}), hi = vec2(${ie(Fe.x1)}, ${ie(Fe.y1)});
  vec2 aa = max(fwidth(cell), vec2(1e-4));
  vec2 inO = smoothstep(lo - aa, lo + aa, cell) * (1.0 - smoothstep(hi - aa, hi + aa, cell));
  vec2 lg = lo + ${ie(Fe.frame)}, hg = hi - ${ie(Fe.frame)};
  vec2 inG = smoothstep(lg - aa, lg + aa, cell) * (1.0 - smoothstep(hg - aa, hg + aa, cell));
  float outer = inO.x * inO.y, glass = inG.x * inG.y;
  // far away the cells shrink under a pixel: fade the grid to the wall rather than shimmer
  float fade = 1.0 - smoothstep(0.08, 0.2, max(aa.x, aa.y));
  vec3 win = mix(vec3(0.86, 0.85, 0.82), mix(vec3(0.17, 0.21, 0.25), vec3(0.33, 0.39, 0.44), cell.y), glass);
  float k = outer * fade;
  c = mix(c, win, k);
  mk.r *= 1.0 - k;
  mk.g *= 1.0 - k;
}`,Ks=xt.school;function $t(e,t={}){let n=Js(e,t);return t.windowGrid&&Xs.has(yt[e])?n+Wt:n}var Xs=new Set(["brick","stucco","stone"]);function Js(e,t){let n=yt[e],r=t.source==="measured";return n==="glass"&&r?We.glassTint:n==="brick"&&!r&&typeof t.year=="number"&&t.year>=Ks?We.brick20:n==="stucco"&&t.white?We.whiteStucco:n==="frame"?We.white:We[n]}function Zs(){return lt.map(e=>[1/e.tileM,e.clampUv?1:0,e.litGain,e.skyTint?1:0])}var Qs=.38,ei=.8,ti=.27,ni=.97,ri=.75,oi=.5,ai=.12,si=(e,t)=>(e<45||e>340)&&t>=.2;function ii(e,t,n,r=se(),o){if(yn(e,n))return Ye(e,ur(e,t,n,r,o),n);let s=S(t),[a,i,u]=E(s);return e==="slate"&&si(a,i)?Ye("roofTile",t):(e==="brick"||e==="accent")&&i<ai?O($([a,i,Math.min(oe[1],Math.max(oe[0],.12+u*.9))])):e==="slate"&&u>Qs?O($([a,Math.min(i,.12),Math.min(.72,u/ei)])):e==="slate"?u<ti?ee.slate[1]:ee.slate[0]:e==="frame"&&u>=.5&&u<ri?O(s):e==="stone"&&u<oi?O(s):Ye(e,t)}function $r(e,t,n,r=se(),o,s){let a=ii(e,t,n,r,o),[i,u,l]=S(Ir(e,a,s??null,n,r));return[i,u,l,255]}function li(e,t,n){switch(t){case"brick":return hr(e,n);case"brick20":return Mr(e,n);case"stucco":return xr(e);case"whiteStucco":return wr(e);case"stone":return yr(e);case"white":case"frame":return _r(e);case"door":return gr(e);case"glass":return pr(e);case"glassTint":return br(e);case"tile":return Ze(e,"tile");case"slate":return Ze(e,"slate");case"flat":return Ze(e,"flat")}}function ui(e,t,n){let r=n*n,o=new Uint8Array(r*4*it),s=new Uint8Array(r*2*it),a=e.createElement("canvas");a.width=a.height=n;let i=a.getContext("2d",{willReadFrequently:!0});return i.imageSmoothingQuality="high",lt.forEach((u,l)=>{i.clearRect(0,0,n,n),i.drawImage(li(e,u.cell,t),0,0,n,n);let m=i.getImageData(0,0,n,n).data;for(let c=0;c<n;c++)for(let h=0;h<n;h++){let d=((n-1-c)*n+h)*4,g=l*r+c*n+h;o[g*4]=m[d],o[g*4+1]=m[d+1],o[g*4+2]=m[d+2],o[g*4+3]=255,s[g*2]=255,s[g*2+1]=0}}),{colour:o,mask:s}}async function ci(e=document){let t=new Image;t.src=new URL("materials/ambientcg/Bricks057/colour.jpg",e.baseURI).href;try{return await t.decode(),t}catch{return null}}var Vt=e=>`${e.lit?"lit":"unlit"}|${e.kind}|${e.kind==="slot"?e.uv??"uv":"-"}|${e.highlight?"hl":e.dim?"dim":"-"}|${e.side??0}${e.noFade?"|nofade":""}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf2":""}${e.lodBias?"|lodb":""}${e.aniso?"|aniso":""}${e.taps?"|taps":""}`;function mi(e){let t={CITY_SLOT_COUNT:String(it)};return e.kind==="slot"&&(t.CITY_SLOT=""),e.swap&&(t.CITY_SWAP=""),e.cellDebug&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CELL_DEBUG_RHO="",e.cellDebug==="under"&&(t.CELL_DEBUG_UNDER="")),e.windows&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CITY_WINDOW_SDF=""),e.lodBias&&e.kind==="chunk"&&(t.CELL_LOD_BIAS=""),e.aniso&&e.kind==="chunk"&&(t.CELL_TIER_ANISO=""),e.taps&&e.kind==="chunk"&&(t.CELL_TAPS=""),e.lit?(t.CITY_VARIANT_UNIFORMS="",{...t,...At()}):(e.kind==="slot"&&e.uv==="box"&&(t.CITY_BOX_UV=""),e.highlight?t.CITY_HIGHLIGHT="":e.dim&&(t.CITY_DIM=""),{...t,...At()})}function fi(e){return{cityForce:{value:e.highlight?1:e.dim?2:0},cityBoxUv:{value:e.kind==="slot"&&e.uv==="box"?1:0}}}var di=e=>e.lit?`city-look-v4|lit|${e.kind}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf2":""}${e.lodBias?"|lodb":""}${e.aniso?"|aniso":""}${e.taps?"|taps":""}`:`city-look-v3|${Vt({...e,side:0})}`,hi="vec3(1.0, 0.824, 0.122)",Ur="vec3(1.0, 0.637, 0.0137)",Wr="vec3(0.035, 0.05, 0.07)",pi=1,bi=.2,gi=.75,xi=1.8,Oe=e=>Number.isInteger(e)?e.toFixed(1):String(e),yi=`
float cityGrain(vec3 cell) {
  float g = clamp(dot(cell, vec3(0.299, 0.587, 0.114)) / ${Oe(Pe/255)}, 0.45, 1.1);
  return mix(1.0, g, ${Oe(gi)});
}`,Vr=16,Mi=`
#ifdef CITY_SWAP
attribute float swapSlot;
uniform vec4 citySwapUnder[${Vr/4}];
uniform float cityUnder;
flat varying float vCityUnder;
#endif`,wi=`
#ifdef CITY_SWAP
int citySw = int(swapSlot + 0.5) - 1;
vCityUnder = citySw >= 0 ? citySwapUnder[citySw / 4][citySw % 4] : cityUnder;
#endif`,zr=`
attribute float layer;
attribute vec4 tint;
attribute vec4 accent;
attribute float hidden;
uniform float slotBase;
uniform vec4 slotParams[CITY_SLOT_COUNT];
varying vec2 vFacUv;
flat varying float vLayer;
flat varying vec4 vSlot;
flat varying float vGrid;
varying vec3 vTint;
varying vec3 vAccent;
flat varying float vHighlight;
varying float vFacDist;
#ifdef CITY_VARIANT_UNIFORMS
uniform float cityForce;
uniform float cityBoxUv;
#endif
${Mi}
${kt}`,jr=`
${wi}
vTint = tint.rgb; vAccent = accent.rgb;
vHighlight = hlState(hidden);
#ifdef CITY_VARIANT_UNIFORMS
if (cityForce > 0.5) vHighlight = cityForce;
#endif
#ifdef CITY_HIGHLIGHT
vHighlight = 1.0;
#endif
#ifdef CITY_DIM
vHighlight = 2.0;
#endif
vGrid = 0.0;
#ifdef CITY_SLOT
  // WINDOW_GRID_LAYER_FLAG on the slot ordinal: a blank wall painted with the shader window grid (cityWindowGrid).
  vGrid = step(${Wt-.5}, layer);
  int cityS = int(clamp(layer - ${Wt}.0 * vGrid + 0.5, 0.0, float(CITY_SLOT_COUNT - 1)));
  vSlot = slotParams[cityS];
  vLayer = slotBase + float(cityS);
  #if defined(CITY_VARIANT_UNIFORMS)
  if (cityBoxUv > 0.5) {
    vec3 cityN = abs(normal);
    vec3 cityQ = position * length(modelMatrix[0].xyz);
    vec2 cityUv = cityN.y > max(cityN.x, cityN.z) ? cityQ.xz : (cityN.x > cityN.z ? cityQ.zy : cityQ.xy);
    vFacUv = cityUv * vSlot.x;
    vSlot.y = 0.0;
  } else {
    vFacUv = vSlot.y > 0.5 ? uv : uv * vSlot.x;
  }
  #elif defined(CITY_BOX_UV)
    vec3 cityN = abs(normal);
    vec3 cityQ = position * length(modelMatrix[0].xyz);
    vec2 cityUv = cityN.y > max(cityN.x, cityN.z) ? cityQ.xz : (cityN.x > cityN.z ? cityQ.zy : cityQ.xy);
    vFacUv = cityUv * vSlot.x;
    vSlot.y = 0.0;
  #else
    vFacUv = vSlot.y > 0.5 ? uv : uv * vSlot.x;
  #endif
#else
  vSlot = vec4(1.0, 0.0, 1.0, 0.0);
  vLayer = layer;
  vFacUv = uv;
#endif`,qr=`
vFacDist = length((modelViewMatrix * vec4(position, 1.0)).xyz);
if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`,Yr=`
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${Or}
${Cr}
${Br}
${Gr}
${Ys}
varying vec2 vFacUv;
flat varying float vLayer;
flat varying vec4 vSlot;
flat varying float vGrid;
varying vec3 vTint;
varying vec3 vAccent;
flat varying float vHighlight;
varying float vFacDist;
#ifdef CITY_SWAP
flat varying float vCityUnder;
#endif
${yi}
${kt}`,Kr=`
if (HL_GHOST(vHighlight)) discard;
#ifdef CITY_SWAP
float cityHash = fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296)));
if (cityFade < 1.0 && cityHash >= cityFade) discard;
// The complement of a replacement dissolving in over (or out from) this mesh: where it draws, this one does not.
if (cityHash < vCityUnder) discard;
#else
if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;
#endif`,Xr=`
vec2 cityUv = vSlot.y > 0.5 ? clamp(vFacUv, 0.0, 1.0) : vFacUv;
vec3 cityP = vec3(cityUv, vLayer);
vec3 cityC; vec2 cityM;
#ifdef CITY_SLOT
vec4 cityCC = texture(cells, cityP); vec2 cityMM = texture(masks, cityP).rg;
cityC = cityCC.rgb; cityM = vec2(cityMM.r, ${ke("cityMM","cityCC")});
if (vGrid > 0.5) cityWindowGrid(vFacUv / vSlot.x, cityC, cityM);
#else
cellTierSample(cityP, vFacDist, cityC, cityM);
#ifdef CITY_WINDOW_SDF
windowSdf(cityUv, vLayer, 1.0 - cellFar, cityC, cityM);
#endif
cityC = roofTierColour(cityC, cityUv, vLayer, vFacDist);
#endif
float cityG = cityGrain(cityC);
cityC *= mix(vec3(1.0), vTint, cityM.r) * mix(vec3(1.0), vAccent, cityM.g);`,_i=`
uniform mat3 enuFromWorld;
${zr}
varying float vShade;
void main() {
${jr}
#ifdef USE_INSTANCING
  mat4 cityModel = modelMatrix * instanceMatrix;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
#else
  mat4 cityModel = modelMatrix;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
#endif
#ifdef CITY_SLOT
  // The city's fixed light (threeBuildingMesh.ts wallShade and the roof formula), from the ENU normal.
  vec3 n = normalize(enuFromWorld * (mat3(cityModel) * normal));
${rt}
  vShade = shade;
#else
  vShade = tint.a;
#endif
${qr}
}`,Ri=`
precision highp float;
${Yr}
varying float vShade;
void main() {
${Kr}
${Xr}
  if (HL_PAINT(vHighlight)) {
    float hlShade = clamp(1.0 - (1.0 - vShade) * ${Oe(xi)}, 0.6, 1.0);
    gl_FragColor = vec4(${hi} * (flatColour > 0.5 ? 1.0 : cityG) * hlShade, 1.0);
    return;
  }
  if (flatColour > 0.5) cityC = vTint;
  cityC = hlDesat(cityC, vHighlight);
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  gl_FragColor = vec4(cityC * shade, 1.0);
#ifdef CELL_DEBUG_RHO
  gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif
}`;function vi(e,t={}){return{cells:t.cells??{value:null},masks:t.masks??{value:null},slotBase:t.slotBase??{value:0},slotParams:t.slotParams??{value:Zs().map(n=>new e.Vector4(...n))},bands:t.bands??{value:0},flatColour:t.flatColour??{value:0},cityFade:t.cityFade??{value:1},wallGain:t.wallGain??{value:1},roofLayers:t.roofLayers??{value:Tr},roofTier:t.roofTier??{value:Fr()},cellTier:t.cellTier??{value:kr},enuFromWorld:t.enuFromWorld??{value:new e.Matrix3},citySwapUnder:t.citySwapUnder??{value:new Float32Array(Vr)},cityUnder:t.cityUnder??{value:0},windowTable:t.windowTable??{value:null},windowSdfMix:t.windowSdfMix??{value:1},cellLodBias:t.cellLodBias??{value:0},cellAniso:t.cellAniso??{value:Nt(16).cellAniso},cellAnisoRule:t.cellAnisoRule??{value:Nt(16).cellAnisoRule},cellTaps:t.cellTaps??{value:Bt().cellTaps},cellTapsSdf:t.cellTapsSdf??{value:Bt().cellTapsSdf},...Nr(),...t.windowSdfBand?{windowSdfBand:t.windowSdfBand}:{},...t.windowSdfShape?{windowSdfShape:t.windowSdfShape}:{}}}var Si={accent:[1,1,1,1],hidden:[0],color:[1,1,1],uv:[0,0],uv1:[0,0],swapSlot:[0]},Ht="recipeLookShared";function Li(e,t,n){let r=mi(t),o=t.side??e.FrontSide,s;if(!t.lit)s=new e.ShaderMaterial({uniforms:n,defines:r,vertexShader:_i,fragmentShader:Ri,side:o});else{s=new e.MeshLambertMaterial({side:o,flatShading:t.kind==="chunk"}),s.defines={...s.defines??{},...r};let a=fi(t);s.onBeforeCompile=u=>{for(let l of Object.keys(n))u.uniforms[l]=n[l];Object.assign(u.uniforms,a),u.vertexShader=u.vertexShader.replace("#include <common>",`#include <common>${zr}`).replace("#include <begin_vertex>",`#include <begin_vertex>${jr}`).replace("#include <project_vertex>",`#include <project_vertex>${qr}`),u.fragmentShader=u.fragmentShader.replace("#include <common>",`#include <common>${Yr}
float cityLuma;`).replace("#include <dithering_fragment>",`#include <dithering_fragment>
#ifdef CELL_DEBUG_RHO
gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>${Kr}`).replace("#include <map_fragment>",`${Xr}
#ifdef CITY_SLOT
cityC *= vSlot.z;
#else
cityC *= mix(1.0, wallGain * ${Oe(te)}, cityM.r);
#endif
if (flatColour > 0.5) cityC = vTint;
cityLuma = dot(cityC, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= HL_PAINT(vHighlight) ? ${Ur} * ${Oe(pi)} * pow(flatColour > 0.5 ? 1.0 : cityG, 2.2) : pow(hlDesat(cityC, vHighlight), vec3(2.2));`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
if (HL_PAINT(vHighlight)) totalEmissiveRadiance += ${Ur} * ${Oe(bi)};
#ifdef CITY_SLOT
else totalEmissiveRadiance += ${Wr} * vSlot.w;
#else
// Bay glazing (dark, untinted texels): the same constant sky tint as landmark glass, never a hotspot.
else totalEmissiveRadiance += ${Wr} * (1.0 - smoothstep(0.06, 0.2, cityLuma)) * (1.0 - cityM.r);
#endif`)};let i=di(t);s.customProgramCacheKey=()=>i,s.uniforms=n}return s.defaultAttributeValues={...Si},s.name=`city-look/${Vt(t)}`,s.userData={cityLook:!0,cityVariant:{...t},[Ht]:!0},t.noFade&&Kn(s),t.kind==="chunk"?Gn(s,!!t.lit):s}function Ai(e){return e?e.isMeshBasicMaterial||e.userData?.unlit?"unlit (decal / emissive sign)":e.transparent||(e.opacity??1)<1?"transparent":e.vertexColors?"vertex colours":e.map?"own texture":null:"no material"}function ki(e,t){let n=e?.userData??{};if(er(n.materialSlot)&&typeof n.tint=="string"){let s=n.tintSource==="measured";return{slot:n.materialSlot,tint:n.tint,inferred:n.materialSlotSource===Xn,...s?{source:"measured"}:{},...s&&typeof n.tintWhitePoint=="string"?{white:n.tintWhitePoint}:{},...n.windowGrid===!0?{windowGrid:!0}:{}}}if(!t||Ai(e)||!e.color)return null;let r="#"+e.color.getHexString(),o=Zn(e.name,r);return{slot:o.slot,tint:o.tint,inferred:!0}}function Hr(e,t,n,r,o={}){let s=t.getAttribute("position")?.count??0,a=$t(n,o),i=$r(n,r,o.source,void 0,o.whitePoint,o.exposure),u=t.getAttribute("layer"),l=t.getAttribute("tint");if(u&&l)return u.getX(0)===a&&Math.round(l.getX(0)*255)===i[0]&&Math.round(l.getY(0)*255)===i[1]&&Math.round(l.getZ(0)*255)===i[2];t.setAttribute("layer",new e.BufferAttribute(new Uint8Array(s).fill(a),1,!1));let m=new Uint8Array(s*4);for(let c=0;c<s;c++)m.set(i,c*4);return t.setAttribute("tint",new e.BufferAttribute(m,4,!0)),!0}function Ti(e,t,n,r,o,s={}){let a=r.getAttribute("normal"),i=r.getAttribute("layer"),u=r.getAttribute("tint");if(!a||!i||!u)return 0;let[l,m,c]=$r("bitumen",o,s.source);t.updateWorldMatrix(!0,!0);let h=new e.Matrix4().copy(t.matrixWorld).invert().multiply(n.matrixWorld),d=new e.Matrix3().getNormalMatrix(h),g=new e.Vector3,w=$t("bitumen",s),b=0;for(let M=0;M<a.count;M++)g.set(a.getX(M),a.getY(M),a.getZ(M)).applyMatrix3(d).normalize(),!(g.y<ni)&&(i.setX(M,w),u.setXYZW(M,l/255,m/255,c/255,1),b++);return b&&(i.needsUpdate=!0,u.needsUpdate=!0),b}var Fi="__canalRecallCityLookShared";function Jr(e,t={}){let n=globalThis,r=n[Fi]??=new Map,o=r.get(e);return o||r.set(e,o=Oi(e,t)),o}function Oi(e,t={}){let n=t.document??globalThis.document,r=t.size??(globalThis.matchMedia?.("(pointer: coarse)").matches?128:256),o=vi(e),s=new Map,a=null,i=!1,u=(c,h)=>{let d=new e.DataArrayTexture(c,r,r,it);return d.format=h,d.type=e.UnsignedByteType,d.wrapS=d.wrapT=e.RepeatWrapping,d.minFilter=e.LinearMipmapLinearFilter,d.magFilter=e.LinearFilter,d.generateMipmaps=!0,d.anisotropy=t.anisotropy??vr("slotCells",16).anisotropy,d.unpackAlignment=1,d.needsUpdate=!0,d.userData={bytes:c.byteLength,[Ht]:!0},d},l=(async()=>{if(!n)return;let c=t.brick!==void 0?t.brick:await ci(n),{colour:h,mask:d}=ui(n,c,r),g=Sr(h,d);a={colour:u(g.colour,e.RGBAFormat),mask:u(g.mask,g.channels===1?e.RedFormat:e.RGFormat)},i||(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)})(),m=c=>{let h=Vt(c),d=s.get(h);return d||s.set(h,d=Li(e,c,o)),d};return{uniforms:o,ready:l,material:m,dress(c,{lit:h,infer:d=!1,year:g=null,wallExposure:w=null}){let b=0;return c.traverse(M=>{if(!M.isMesh||Array.isArray(M.material)||M.material?.userData?.cityLook)return;let p=ki(M.material,d);if(!p)return;let L=M.geometry;if(!L?.getAttribute("position"))return;let Y=!!L.getAttribute("uv");!Y&&!L.getAttribute("normal")&&L.computeVertexNormals();let _={year:g,white:p.inferred&&Qn(M.material.name),source:p.source,...p.white?{whitePoint:p.white}:{},...w?{exposure:w}:{},...p.windowGrid?{windowGrid:!0}:{}};Hr(e,L,p.slot,p.tint,_)||(L=M.geometry=L.clone(),L.deleteAttribute("layer"),L.deleteAttribute("tint"),Hr(e,L,p.slot,p.tint,_)),p.inferred&&p.slot==="slate"&&!p.source&&Ti(e,c,M,L,p.tint,_);let T=M.material;M.material=m({lit:h,kind:"slot",uv:Y?"uv":"box",side:T.side}),M.userData.citySlot={slot:p.slot,tint:p.tint,...p.source?{source:p.source}:{},inferred:p.inferred,from:T.name,layer:$t(p.slot,_)},T.userData?.[Ht]||T.dispose(),b++}),b},highlighted(c,h){let d=c?.userData?.cityVariant;return d?m({...d,highlight:h,dim:!1}):c},dimmed(c,h){let d=c?.userData?.cityVariant;return d?m({...d,highlight:!1,dim:h}):c},bindAtlas(c){i=!!c,c?(o.cells.value=c.colour,o.masks.value=c.mask,o.slotBase.value=c.slotBase):a&&(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)},textureBytes(){return a&&!i?Math.round((a.colour.userData.bytes+a.mask.userData.bytes)*4/3):0}}}var Ci=2*Math.PI*6378137;function Zr(e,t){return[(180+e)/360,(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+t*Math.PI/360)))/360]}var Di=e=>1/Ci/Math.cos(e*Math.PI/180);function zt(e,t){let[n,r]=Zr(e[0],e[1]),[o,s]=Zr(t[0],t[1]),a=Di(e[1]);return[(o-n)/a,(s-r)/a]}function ut(e){let t=e.map(r=>r.anchor[0]),n=e.map(r=>r.anchor[1]);return[(Math.min(...t)+Math.max(...t))/2,(Math.min(...n)+Math.max(...n))/2]}var Ei=e=>Math.PI-(180+e)*Math.PI/180;function jt(e,t){let[n,r]=zt(t,e.anchor),o=Ei(e.northOffsetDegrees),s=Math.cos(o),a=Math.sin(o),[i,u,l]=e.scale;return[s*i,0,-a*i,0,0,u,0,0,a*l,0,s*l,0,n,e.groundAltitudeMetres,r,1]}function ro(e){let t=new Map;for(let n of e)t.set(n.area??"default",[...t.get(n.area??"default")??[],n]);return t}function oo(e){let t=ut(e);return Math.max(50,...e.map(n=>Math.hypot(...zt(t,n.anchor))))+30}var Ii=e=>`NL.IMBAG.Pand.${e}`;function qt(e){return[...new Set(e.flatMap(t=>[t.pand,...t.alsoSuppress??[]].map(Ii)))].sort()}function Yt(e){let t=e.L0/2,n=e.W0/2,r=e.E0,o={positions:[],normals:[],uvs:[],index:[]},s={positions:[],normals:[],uvs:[],index:[]},a=(c,h,d,g,w,b,M)=>{let p=c.positions.length/3;for(let L of[h,d,g,w])c.positions.push(...L),c.normals.push(...b),c.uvs.push(...M(L));c.index.push(p,p+1,p+2,p,p+2,p+3)},i=c=>[c[0],c[1]],u=c=>[c[2],c[1]],l=c=>[c[0],c[2]];a(o,[-t,0,n],[t,0,n],[t,r,n],[-t,r,n],[0,0,1],i),a(o,[t,0,-n],[-t,0,-n],[-t,r,-n],[t,r,-n],[0,0,-1],i),a(o,[t,0,n],[t,0,-n],[t,r,-n],[t,r,n],[1,0,0],u),a(o,[-t,0,-n],[-t,0,n],[-t,r,n],[-t,r,-n],[-1,0,0],u);let m=e.R0!==void 0&&e.R0>r+.3?e.R0:void 0;if(m===void 0)a(s,[-t,r,n],[t,r,n],[t,r,-n],[-t,r,-n],[0,1,0],l);else{let c=m-r,h=Math.hypot(n,c),d=c/h,g=n/h;a(s,[-t,r,n],[t,r,n],[t,m,0],[-t,m,0],[0,g,d],l),a(s,[t,r,-n],[-t,r,-n],[-t,m,0],[t,m,0],[0,g,-d],l);let w=(b,M,p)=>{let L=o.positions.length/3,Y=p?[[b,r,-n],[b,r,n],[b,m,0]]:[[b,r,n],[b,r,-n],[b,m,0]];for(let _ of Y)o.positions.push(..._),o.normals.push(M,0,0),o.uvs.push(...u(_));o.index.push(L,L+1,L+2)};w(t,1,!1),w(-t,-1,!0)}return{walls:o,roof:s}}function Pi(e,t=ao){return e?Math.max(t,Math.round(3*Math.max(e.L0,e.E0))):t}function Kt(e,t,n,r,o,s=20){let a=new Set(o?.near),i=new Set(o?.far),u=[],l=[];return e.forEach((m,c)=>{let h=Math.hypot(m.x-t.x,m.z-t.z),d=typeof n=="number"?n:n[c],g=a.has(c)?d+s:d-(i.has(c)?s:0),w=a.has(c)||i.has(c)?r+s:r;h<=g?u.push(c):h<=w&&l.push(c)}),{near:u,far:l,culled:e.length-u.length-l.length}}var ao=140,Bi=700;function Ni(e){let t=e.reduce((a,i)=>a+i.positions.length/3,0),n=e.reduce((a,i)=>a+(i.index?i.index.length:i.positions.length/3),0),r={positions:new Float32Array(t*3),normals:new Float32Array(t*3),uvs:new Float32Array(t*2),textures:new Float32Array(t),tints:new Float32Array(t*3),index:new Uint32Array(n)},o=0,s=0;for(let a of e){let i=a.matrix,u=a.positions.length/3,l=i[0],m=i[4],c=i[8],h=i[1],d=i[5],g=i[9],w=i[2],b=i[6],M=i[10],p=[d*M-g*b,g*w-h*M,h*b-d*w,c*b-m*M,l*M-c*w,m*w-l*b,m*g-c*d,c*h-l*g,l*d-m*h],L=l*p[0]+m*p[1]+c*p[2]<0;for(let _=0;_<u;_++){let T=a.positions[_*3],X=a.positions[_*3+1],j=a.positions[_*3+2],H=(o+_)*3;r.positions[H]=i[0]*T+i[4]*X+i[8]*j+i[12],r.positions[H+1]=i[1]*T+i[5]*X+i[9]*j+i[13],r.positions[H+2]=i[2]*T+i[6]*X+i[10]*j+i[14];let le=a.normals[_*3],Ce=a.normals[_*3+1],ne=a.normals[_*3+2],ue=p[0]*le+p[1]*Ce+p[2]*ne,be=p[3]*le+p[4]*Ce+p[5]*ne,$e=p[6]*le+p[7]*Ce+p[8]*ne,J=(Math.hypot(ue,be,$e)||1)*(L?-1:1);r.normals[H]=ue/J,r.normals[H+1]=be/J,r.normals[H+2]=$e/J,r.uvs[(o+_)*2]=a.uvs[_*2]*a.uvScale,r.uvs[(o+_)*2+1]=a.uvs[_*2+1]*a.uvScale,r.textures[o+_]=a.texture,r.tints[H]=a.tint[0],r.tints[H+1]=a.tint[1],r.tints[H+2]=a.tint[2]}let Y=a.index?a.index.length:u;for(let _=0;_<Y;_+=3){let T=a.index?a.index[_]:_,X=a.index?a.index[_+1]:_+1,j=a.index?a.index[_+2]:_+2;r.index[s++]=o+T,r.index[s++]=o+(L?j:X),r.index[s++]=o+(L?X:j)}o+=u}return r}function Gi(e){let t=Math.max(1,e),n=Array.from({length:t},(r,o)=>o===t-1?`c = texture2D(t${o}, vUv).rgb;`:`if (vTex < ${o}.5) c = texture2D(t${o}, vUv).rgb; else`).join(`
  `);return{vertexShader:`
uniform mat3 enuFromWorld;
attribute float aTex;
attribute vec3 aTint;
varying vec2 vUv;
varying float vShade;
varying float vTex;
varying vec3 vTint;
void main() {
  vUv = uv;
  vTex = aTex;
  vTint = aTint;
  vec3 n = normalize(enuFromWorld * (mat3(modelMatrix * instanceMatrix) * normal));
${rt}
  vShade = shade;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`,fragmentShader:`
${Array.from({length:t},(r,o)=>`uniform sampler2D t${o};`).join(`
`)}
uniform float hlDimAll;
varying vec2 vUv;
varying float vShade;
varying float vTex;
varying vec3 vTint;
void main() {
  vec3 c;
  ${n}
  c *= vTint;
#ifdef HL_DIM_ALL
  c = mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), 0.4);
#else
  if (hlDimAll > 0.5) c = mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), 0.4);
#endif
  gl_FragColor = vec4(c * vShade, 1.0);
}`}}var He=10;function Ui(e){let t=Math.max(1,e),n=Array.from({length:t},(r,o)=>o===t-1?`btC = texture2D(btT${o}, vBtUv);`:`if (vBtTex < ${o}.5) btC = texture2D(btT${o}, vBtUv); else`).join(`
  `);return{declarations:`${Array.from({length:t},(r,o)=>`uniform sampler2D btT${o};`).join(`
`)}
varying float vBtTex;
varying vec3 vBtTint;
varying vec2 vBtUv;`,sample:`vec4 btC;
  ${n}
  diffuseColor *= vec4(btC.rgb * vBtTint, btC.a);
#undef USE_MAP
#include <map_fragment>`}}var Qr=new WeakMap;function Wi(e,t,n){let r=Qr.get(e.MeshLambertMaterial);r||(r=class extends e.MeshLambertMaterial{btTextures=[];constructor(s){super(s),this.onBeforeCompile=function(a){let{declarations:i,sample:u}=Ui(He);for(let l=0;l<He;l++)a.uniforms[`btT${l}`]={value:this.btTextures[l]??this.btTextures[0]??null};a.vertexShader=a.vertexShader.replace("#include <common>",`#include <common>
attribute float btTex;
attribute vec3 btTint;
varying float vBtTex;
varying vec3 vBtTint;
varying vec2 vBtUv;`).replace("#include <uv_vertex>",`#include <uv_vertex>
  vBtUv = uv; vBtTex = btTex; vBtTint = btTint;`),a.fragmentShader=a.fragmentShader.replace("#include <common>",`#include <common>
${i}`).replace("#include <map_fragment>",u)},this.customProgramCacheKey=function(){return`building-types/lit-merged/${He}`}}copy(s){return super.copy(s),this.btTextures=[...s.btTextures??[]],this.onBeforeCompile=s.onBeforeCompile,this.customProgramCacheKey=s.customProgramCacheKey,this}},Qr.set(e.MeshLambertMaterial,r));let o=new r({map:t[0],side:n});return o.btTextures=[...t],o.name="building-types/lit-merged",o.userData={recipeLookShared:!0,litMerged:!0},o}function eo(e,t,n){if(!t?.isShaderMaterial)return t;let r=n.get(t);if(!r){let o=String(t.vertexShader).replace("mat3(modelMatrix) * normal","mat3(modelMatrix * instanceMatrix) * normal").replace("modelViewMatrix * vec4(position, 1.0)","modelViewMatrix * instanceMatrix * vec4(position, 1.0)");if(o===t.vertexShader)throw new Error("recipe look vertex shader changed: instancing patch no longer applies");r=new e.ShaderMaterial({uniforms:t.uniforms,vertexShader:o,fragmentShader:t.fragmentShader,side:t.side}),r.name=`${t.name}/instanced`,r.userData={...t.userData},n.set(t,r)}return r}var to=new Set(["brick","stucco","stone"]),no=new Set(["roofTile","slate","bitumen"]);async function so(e,t){let{THREE:n}=e,r=e.nearMetres??ao,o=e.cullMetres??Bi;if(!t.length)throw new Error("no building-type instances");let s=ut(t),a=new n.Group;a.name="building-types";let i=t.map(f=>new n.Matrix4().fromArray(jt(f,s))),u=i.map(f=>({x:f.elements[12],z:f.elements[14]})),l=Math.max(50,...u.map(f=>Math.hypot(f.x,f.z)))+30,m=new Map,c=new Map;t.forEach((f,x)=>c.set(f.unit,[...c.get(f.unit)??[],x]));let h=[],d=[],g=[],w=t.map(()=>r),b=[],M=f=>!!(f?.isShaderMaterial&&f.uniforms?.map?.value&&f.uniforms.tint?.value&&f.uniforms.uvScale&&f.uniforms.enuFromWorld),p=f=>!!f?.userData?.cityLook,L=f=>!!(f?.isMeshLambertMaterial&&f.userData?.recipeLookShared&&!f.userData?.litMerged&&f.map&&f.color&&Math.abs(f.map.repeat.x-f.map.repeat.y)<1e-9&&!f.map.offset.x&&!f.map.offset.y&&!f.map.rotation),Y=!0,_=f=>M(f)||p(f)||Y&&L(f);for(let[f,x]of c){let y=await e.loadUnit(f);y.updateMatrixWorld(!0);let v;y.traverse(A=>{A.userData?.nominal&&(v=A.userData.nominal)});let R=[];y.traverse(A=>{A.isMesh&&R.push(A)});for(let A of R)M(A.material)&&!b.includes(A.material.uniforms.map.value)&&b.push(A.material.uniforms.map.value),L(A.material)&&!b.includes(A.material.map)&&b.push(A.material.map);if(g.push({unit:f,indices:x,meshes:R,nominal:v}),e.nearMetres===void 0)for(let A of x)w[A]=Pi(v,r)}Y=b.length<=He,!Y&&g.some(f=>f.meshes.some(x=>L(x.material)))&&console.warn(`building types: ${b.length} textures, over ${He}; lit units keep one draw per material`);let T=new Map,X=f=>{if(p(f))return f;if(L(f)){let y=T.get(`lit|${f.side}`);return y||(y=Wi(n,b,f.side),T.set(`lit|${f.side}`,y)),y}let x=T.get(f.side);if(!x){let y={enuFromWorld:f.uniforms.enuFromWorld,hlDimAll:{value:0}};b.forEach((v,R)=>{y[`t${R}`]={value:v}}),x=new n.ShaderMaterial({uniforms:y,...Gi(b.length),side:f.side}),x.name="building-types/merged",x.userData={recipeLookShared:!0},T.set(f.side,x)}return x},j=(f,x,y)=>{if(p(f.material)){let R=f.geometry.getAttribute("layer"),A=f.geometry.getAttribute("tint");return{...x,matrix:y,uvScale:1,texture:R.getX(0),tint:[A.getX(0),A.getY(0),A.getZ(0)]}}if(L(f.material)){let R=f.material.color;return{...x,matrix:y,uvScale:f.material.map.repeat.x,texture:b.indexOf(f.material.map),tint:[R.r,R.g,R.b]}}let v=f.material.uniforms.tint.value;return{...x,matrix:y,uvScale:f.material.uniforms.uvScale.value,texture:b.indexOf(f.material.uniforms.map.value),tint:[v.x,v.y,v.z]}},H=(f,x="recipe")=>{let y=new n.BufferGeometry;return y.setAttribute("position",new n.BufferAttribute(f.positions,3)),y.setAttribute("normal",new n.BufferAttribute(f.normals,3)),y.setAttribute("uv",new n.BufferAttribute(f.uvs,2)),y.setAttribute(x==="city"?"layer":x==="lit"?"btTex":"aTex",new n.BufferAttribute(f.textures,1)),y.setAttribute(x==="city"?"tint":x==="lit"?"btTint":"aTint",new n.BufferAttribute(f.tints,3)),y.setIndex(new n.BufferAttribute(f.index,1)),d.push(y),y},le=(f,x)=>{let y=[];for(let v=0;v<f.count;v++)y.push(f.getX(v)),x>1&&y.push(f.getY(v)),x>2&&y.push(f.getZ(v));return y},Ce=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];for(let{unit:f,indices:x,meshes:y,nominal:v}of g){let R=new Map,A=new Map,k=new Map;for(let F of y){let D=F.geometry;if(!_(F.material)){let Z=new n.InstancedMesh(D,eo(n,F.material,m),x.length);Z.name=`${f}/near/${F.name}`,Z.userData.layer="near",h.push({mesh:Z,indices:x,local:F.matrixWorld.clone(),far:!1,triangles:(D.index?.count??D.attributes.position.count)/3}),a.add(Z);continue}let N=F.material.side;k.set(N,F.material),R.set(N,[...R.get(N)??[],j(F,{positions:le(D.attributes.position,3),normals:le(D.attributes.normal,3),uvs:le(D.attributes.uv,2),index:D.index?.array},F.matrixWorld.elements)])}if(v){let F=W=>p(W.material)?W.userData?.citySlot?.slot:W.material?.userData?.materialSlot,D=W=>y.filter(B=>_(B.material)&&W.has(F(B))).sort((B,ce)=>ce.geometry.attributes.position.count-B.geometry.attributes.position.count)[0],N=D(to),Z=D(no),G=Yt(v);if(!N){let W=ze=>y.filter(Q=>ze.has(Q.material?.userData?.materialSlot)).sort((Q,ft)=>ft.geometry.attributes.position.count-Q.geometry.attributes.position.count)[0],B=W(to),ce=W(no)??B;for(let[ze,Q,ft]of[[B,G.walls,"walls"],[ce,G.roof,"roof"]]){if(!ze||!Q.index.length)continue;let ge=new n.BufferGeometry;ge.setAttribute("position",new n.Float32BufferAttribute(Q.positions,3)),ge.setAttribute("normal",new n.Float32BufferAttribute(Q.normals,3)),ge.setAttribute("uv",new n.Float32BufferAttribute(Q.uvs,2)),ge.setIndex(Q.index),d.push(ge);let je=new n.InstancedMesh(ge,eo(n,ze.material,m),x.length);je.name=`${f}/far/${ft}`,je.userData.layer="far",h.push({mesh:je,indices:x,local:new n.Matrix4,far:!0,triangles:Q.index.length/3}),a.add(je)}}for(let[W,B]of[[N,G.walls],[Z,G.roof]]){if(!W||!B.index.length)continue;let ce=W.material.side;k.set(ce,W.material),A.set(ce,[...A.get(ce)??[],j(W,{positions:B.positions,normals:B.normals,uvs:B.uvs,index:B.index},Ce)])}}for(let[F,D]of[[R,!1],[A,!0]])for(let[N,Z]of F){let G=k.get(N),W=Ni(Z),B=new n.InstancedMesh(H(W,p(G)?"city":L(G)?"lit":"recipe"),X(G),x.length);B.name=`${f}/${D?"far":"near"}/merged-${N}`,B.userData.layer=D?"far":"near",h.push({mesh:B,indices:x,local:new n.Matrix4,far:D,triangles:W.index.length/3}),a.add(B)}}let ne,ue=null,be=new n.Matrix4,$e=new n.Matrix4().makeScale(0,0,0),J=new Map,De=[],Xt={near:0,far:0,culled:0},ct=f=>{ne=f;let x=new Set(f.near),y=new Set(f.far),v=0;for(let R of h){let A=R.indices.map((k,F)=>({global:k,k:F})).filter(({global:k})=>(R.far?y:x).has(k));A.forEach(({global:k},F)=>{be.multiplyMatrices(i[k],R.local),R.mesh.setMatrixAt(F,J.has(k)?$e:be)}),R.mesh.userData.slotToGlobal=A.map(k=>k.global),R.mesh.count=A.length,R.mesh.instanceMatrix.needsUpdate=!0,R.mesh.visible=A.length>0,A.length&&(R.mesh.computeBoundingSphere(),R.mesh.computeBoundingBox(),v++)}Xt={near:f.near.length,far:f.far.length,culled:f.culled};for(let R of De)R.mesh.visible=(R.layer.far?y:x).has(R.global)},mt=(f=!1)=>{let x=e.getCentre();if(!x)return;let[y,v]=zt(s,[x.lng,x.lat]),R={x:y,z:v};!f&&ue&&Math.hypot(R.x-ue.x,R.z-ue.z)<10||(ue=R,ct(Kt(u,R,w,o,ne)))};ct({near:[],far:u.map((f,x)=>x),culled:0}),mt(!0);let Ve=new n.Mesh(new n.BufferGeometry,new n.MeshBasicMaterial);return Ve.name="building-types/driver",Ve.frustumCulled=!1,Ve.onBeforeRender=()=>mt(),a.add(Ve),{anchor:s,group:a,suppress:qt(t),radiusMetres:l,update:mt,setHighlighted(f,x){let y=Re(),v=Be[y],R=new Set([...f].map(k=>String(k).replace(/^NL\.IMBAG\.Pand\./,"")));for(let k of De)a.remove(k.mesh),k.mesh.dispose?.();De=[],J.clear(),t.forEach((k,F)=>{R.has(k.pand)?J.set(F,"highlight"):v.desaturate&&x&&Cn(x.lngLat,k.anchor)&&J.set(F,"dim")});let A=Jr(n);for(let[k,F]of J)for(let D of h){if(!D.indices.includes(k))continue;let N=D.mesh.material,Z=F==="highlight"?v.keepMaterials?N:p(N)?A.highlighted(N,!0):Tt(n,N,"highlight",y):p(N)?A.dimmed(N,!0):Tt(n,N,"dim",y),G=new n.InstancedMesh(D.mesh.geometry,Z,1);G.setMatrixAt(0,be.multiplyMatrices(i[k],D.local)),G.name=`${D.mesh.name}/${F}`,G.userData.slotToGlobal=[k],G.computeBoundingSphere(),G.computeBoundingBox(),F==="highlight"&&En(n,G,{style:y,up:[0,1,0]}),a.add(G),De.push({global:k,layer:D,mesh:G})}return ne&&ct(ne),[...J.values()].filter(k=>k==="highlight").length},pandForHit(f,x){let y=f?.userData?.slotToGlobal;return x===void 0||!y?null:t[y[x]]?.pand??null},stats(){let f=h.filter(v=>v.mesh.visible&&v.mesh.count>0).length,x=0,y=0;for(let v of h)v.mesh.visible&&(v.far?y+=v.triangles*v.mesh.count:x+=v.triangles*v.mesh.count);return{instances:t.length,...Xt,units:c.size,drawCalls:f,nearTriangles:x,farTriangles:y}},dispose(){for(let f of De)f.mesh.dispose?.();for(let f of h)f.mesh.dispose?.();for(let f of d)f.dispose();for(let f of T.values())f.dispose()}}}return fo(Hi);})();

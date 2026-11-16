"use strict";var CanalRecallBuildingTypes=(()=>{var Gt=Object.defineProperty;var Fs=Object.getOwnPropertyDescriptor;var Es=Object.getOwnPropertyNames;var Os=Object.prototype.hasOwnProperty;var Is=(e,t)=>{for(var n in t)Gt(e,n,{get:t[n],enumerable:!0})},Ps=(e,t,n,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of Es(t))!Os.call(e,o)&&o!==n&&Gt(e,o,{get:()=>t[o],enumerable:!(r=Fs(t,o))||r.enumerable});return e};var Ds=e=>Ps(Gt({},"__esModule",{value:!0}),e);var cc={};Is(cc,{areaAnchor:()=>Bt,areaRadiusMetres:()=>$s,createBuildingTypes:()=>Ts,farMassing:()=>Gn,groupByArea:()=>Cs,instanceMatrix:()=>Wn,partitionByDistance:()=>Un,suppressionIds:()=>Hn});var Bs=.7,Ns=46,Ws=null,Hs=()=>Ws??=[te["pantile-red"].hex,te["pantile-dark"].hex,Ee[0],Ee[1],te.gravel.hex,te["bitumen-dark"].hex,te["white-membrane"].hex];function Gs(e,t){let n=globalThis,r=n[t]??(typeof URLSearchParams=="function"?new URLSearchParams(n.location?.search??"").get(e):null);return r===!0||r==="1"||r==="true"||r==="on"}var Us=null;var Ut=()=>Us??=Gs("roofFamily","__canalRecallRoofFamily");var js=(e,t)=>Math.hypot(e[0]-t[0],e[1]-t[1],e[2]-t[2]);function Vs(e,t=Hs(),n=Ns){let r=A(e),o=null,a=n;for(let s of t){let i=js(r,A(s));i<=a&&(a=i,o=s)}return o}function jt(e,t=Bs){let n=Vs(e);if(!n)return e;let r=A(e),o=A(n);return T([0,1,2].map(a=>r[a]+(o[a]-r[a])*t))}function zs(e,t){let n=(e?/[?&]measuredSingleGain=([01])\b/.exec(e)?.[1]:void 0)??t??void 0;return n==="1"}var Vt;function zt(){if(Vt!==void 0)return Vt;let e=globalThis;return Vt=zs(e.location?.search??null,e.process?.env?.MEASURED_SINGLE_GAIN??null)}function Vn(){let e=globalThis;return(e.__canalRecallLook??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("look"):null))==="toon"}var V=["#a8503a","#9a4a38","#8c4632","#b05a40","#7a3b2c"],et=["#2b2d2c","#2f4a3a","#5a2a26","#25344a"],Oe=["#e8dfc9","#f1eee6","#d3b184","#e2d5ba"],qt=[V[0],V[0],V[1],V[2],V[3],V[4],et[0],et[1],et[2],Oe[0],Oe[2]],zn=["#2f4a3a","#25344a","#5a2a26","#2b2d2c","#e0a526"],qn={canal:[V[4],V[4],V[1],V[2],et[0],et[1],Oe[0]],c19:[V[0],V[3],V[1],Oe[3],Oe[2],Oe[0]],school:[V[2],V[4],V[1],V[3]]},Kn=["#f1eee6","#f1eee6","#f1eee6","#e8dfc9","#e8dfc9","#2b2d2c","#2f4a3a","#5a2a26","#25344a","#8b8f8c"];function Yn(){if(!Vn())return!1;let e=globalThis;return(e.__canalRecallToonFronts??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("toonFronts"):null))!=="candy"}var nt=225;var Kt={wallPull:.7,glassLift:.5,liftBrick:!0},Xn={wallPull:.35,glassLift:.25,liftBrick:!1},xc={photo:{cells:"photo",shadeBands:0,flatColour:!1,...Kt,cartoonRoofCells:!1,outline:!1,litWallGain:255/nt},procedural:{cells:"procedural",shadeBands:0,flatColour:!1,...Kt,cartoonRoofCells:!1,outline:!1,litWallGain:1},untextured:{cells:"procedural",shadeBands:0,flatColour:!0,...Kt,cartoonRoofCells:!1,outline:!1,litWallGain:1},storybook:{cells:"storybook",shadeBands:0,flatColour:!1,...Xn,cartoonRoofCells:!1,outline:!0,litWallGain:1,tone:{hueShift:-4,satMul:1.15,satAdd:0,keepDarkBelow:0,lightMul:1,lightAdd:.03,lightMax:.9}},cartoon:{cells:"cartoon",shadeBands:3,flatColour:!1,...Xn,cartoonRoofCells:!0,outline:!0,litWallGain:1,tone:{hueShift:0,satMul:1.7,satAdd:.08,keepDarkBelow:.35,lightMul:1.08,lightAdd:0,lightMax:.85}}};var xe=(e,t,n)=>Math.max(t,Math.min(n,e));function A(e){let t=/^#?([0-9a-f]{6})$/i.exec(e.trim());if(!t)throw Error(`Bad colour ${e}`);let n=parseInt(t[1],16);return[n>>16&255,n>>8&255,n&255]}var T=e=>"#"+e.map(t=>Math.round(xe(t,0,255)).toString(16).padStart(2,"0")).join("");function O([e,t,n]){let r=e/255,o=t/255,a=n/255,s=Math.max(r,o,a),i=Math.min(r,o,a),c=(s+i)/2;if(s===i)return[0,0,c];let l=s-i,d=c>.5?l/(2-s-i):l/(s+i);return[(s===r?(o-a)/l+(o<a?6:0):s===o?(a-r)/l+2:(r-o)/l+4)*60,d,c]}function j([e,t,n]){let r=(1-Math.abs(2*n-1))*t,o=r*(1-Math.abs(e/60%2-1)),a=n-r/2,[s,i,c]=e<60?[r,o,0]:e<120?[o,r,0]:e<180?[0,r,o]:e<240?[0,o,r]:e<300?[o,0,r]:[r,0,o];return[(s+a)*255,(i+a)*255,(c+a)*255]}var ir=(e,t,n)=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n];var Yt={canal:-1/0,c19:1860,school:1915,modern:1945};var Ee=["#76808f","#606b79","#8c939c"],tt={procedural:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:Ee},untextured:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:Ee},photo:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:Ee},storybook:{tile:["#b9553a","#a94a33","#c46a45"],slate:["#556070","#4a5666","#657282"]},cartoon:{tile:["#e85a3c","#f08a2b","#d94a3a"],slate:["#3f5f8f","#2f4a78","#4f7bb0"]}};var te={gravel:{hex:"#9e9281",luma:[112,156],cell:"flat"},"bitumen-dark":{hex:"#56585e",luma:[62,96],cell:"flat"},"bitumen-light":{hex:"#a99b84",luma:[150,182],cell:"flat"},"white-membrane":{hex:"#d9d9d3",luma:[196,228],cell:"flat"},"pantile-red":{hex:"#b5543a",luma:[84,124],cell:"tile"},"pantile-dark":{hex:"#6a5248",luma:[64,98],cell:"tile"},slate:{hex:"#76808f",luma:[62,140],cell:"slate"},zinc:{hex:"#9aa1a6",luma:[138,176],cell:"slate"},sedum:{hex:"#7a8350",luma:[96,132],cell:"flat"},solar:{hex:"#2e3a52",luma:[44,70],cell:"flat"},terrace:{hex:"#a38d74",luma:[124,162],cell:"flat"},glass:{hex:"#8fa3ad",luma:[130,170],cell:"flat"}},pt={gravel:te.gravel.hex,membrane:te["white-membrane"].hex,bitumen:te["bitumen-dark"].hex,pebble:te["bitumen-light"].hex},lr=[pt.gravel,pt.membrane,pt.bitumen,pt.pebble];var ae={tile:tt.photo.tile,slate:tt.photo.slate,flat:lr};var Zn=["#d9674a","#e58a5c","#eab85f","#f0dfb8","#e5a396","#9dbb9b","#7ea3c2","#c9714a","#f2c14e","#b9a1c9"],Jn=["#2a8c8c","#e0a526","#d9453d","#2c4a7c","#7a3b6e","#2f6b45","#4aa3d9"],Qn={canal:{walls:Zn,accents:Jn},c19:{walls:Zn,accents:Jn},school:{walls:["#9c5a42","#8a4b3a","#a8664c","#7a4a40"],accents:["#2c4a7c","#2a8c8c","#e0a526"]},modern:{walls:["#f4efe6","#dcdcd6","#e9d9c0","#b9c4cc","#f0c9a9"],accents:["#2a8c8c","#d9453d","#2c4a7c","#e0a526"]}},er=["#ffffff","#f2d9c8","#d9b9a4","#e6c9b0","#c9a38c","#f0e4d2","#ffd9b0","#e8c0b0","#d0c8c0"],tr=["#243a2f","#1f2a3a","#3a1f1c","#222222","#2f4a3c","#6b2b2b","#2c3e50"],nr={cartoon:Qn,storybook:Qn,photo:{canal:{walls:er,accents:tr},c19:{walls:er,accents:tr},school:{walls:["#b89080","#a88070","#9c7868"],accents:["#1f2a3a","#243a2f","#3a1f1c"]},modern:{walls:["#f2f2ee","#d8d8d2","#e8dcc8","#c8d0d4"],accents:["#2c3e50","#6b2b2b","#243a2f"]}}};var rr=["#e8573d","#e8573d","#ee7f2c","#f2b92e","#f2b92e","#2a9d8f","#4672b0","#f3e6c8","#d96a4d"],Pe={photo:{canal:["#7a3b2c","#7a3b2c","#6b3428","#8c4632","#9a5846","#b05a40","#4a2e26","#2e2a27","#3e4a40","#5d605a","#e4ddcd"],c19:["#b05a40","#b05a40","#bd6a45","#a24d38","#c58b5e","#d3b184","#e2d5ba","#e2d5ba","#d9c5a4","#9a5846"],school:["#8c4a38","#7a4535","#9a5240","#6e3d33","#a85a3c","#5e3a32","#b0603f"],modern:["#c9b79a","#b9ad9a","#a8a49c","#d3c6ad","#8f8a82","#bfb3a0","#9c7a62","#b05a40"]},storybook:{canal:["#b9583f","#9a4a38","#7a4a3c","#4a5048","#3f4a5a","#ead9b0","#c8664a"],c19:["#c8664a","#d98b5f","#e0b36a","#ead9b0","#d9b995","#c9a08c","#c8664a"],school:["#a8553f","#9a5a48","#b87a5c","#c8664a","#8a4e40"],modern:null},cartoon:{canal:["#d9453d","#a8433a","#3b3b4a","#2a9d8f","#4672b0","#fffaf0","#e8573d"],c19:["#e8573d","#ee7f2c","#f2b92e","#f3e6c8","#d96a4d","#f2b92e"],school:["#d96a4d","#e8573d","#b9583f","#ee7f2c"],modern:null}},qs={photo:["#f1eee6","#f1eee6","#f1eee6","#e8dfc9","#e8dfc9","#2b2d2c","#2f4a3a","#5a2a26","#25344a","#8b8f8c"],storybook:["#f6f1e4","#f6f1e4","#f6f1e4","#efe2c2","#efe2c2","#3a3d3c","#3f6a52","#8a3b33","#3a527a","#a3a8a4"],cartoon:["#fffaf0","#fffaf0","#fffaf0","#ffe9b8","#ffe9b8","#3b3b4a","#2a9d8f","#d9453d","#4672b0","#f2b92e"]};if(Yn()){for(let t of["canal","c19","school"])Pe.cartoon[t]=qn[t];let e={walls:[...qt],accents:[...zn]};nr.cartoon={canal:e,c19:e,school:e,modern:nr.cartoon.modern},rr.splice(0,rr.length,...qt),qs.cartoon=Kn}var Sc={canal:{label:"canal-house centre (before 1860)",wall:Pe.photo.canal[0],roof:tt.photo.tile[0]},c19:{label:"19th-century ring (1860-1914)",wall:Pe.photo.c19[0],roof:tt.photo.tile[1]},school:{label:"Amsterdamse School (1915-1944)",wall:Pe.photo.school[0],roof:tt.photo.slate[0]},modern:{label:"post-war and contemporary (1945+)",wall:Pe.photo.modern[0],roof:lr[0]}};var ur=["brick","stucco","accent","stone","frame","door","glass","roofTile","slate","bitumen","paint"],Xt={brick:"brick",accent:"brick",stucco:"stucco",stone:"stone",frame:"frame",door:"door",glass:"glass",roofTile:"tile",slate:"slate",bitumen:"flat",paint:"frame"},ee={brick:3.36,stucco:2.4,accent:3.36,stone:1.28,frame:1,door:1,glass:1,roofTile:1.2,slate:1.2,bitumen:1.2,paint:1},me=[.3,.6],Ks="#f1ede2",Ys="#cfc8b8";function Xs(e){let[t,n,r]=O(A(e)),o=xe(.12+r*.9,me[0],me[1]);return T(j([t,xe(n,.12,.5),o]))}function Zs(e){let[t,n,r]=O(A(e));return T(j([t,xe(n,0,.55),xe(r*1.06+.03,.4,.97)]))}function Js(e){let t=A(e),[n,r,o]=O(t);return o>=.5?T(ir(t,A(Ks),.75)):T(j([n,r,Math.max(o,.16)]))}function Qs(e){let[t,n,r]=O(A(e));return T(ir(j([t,n,Math.max(r,.62)]),A(Ys),.45))}function ea(e){let[t,n,r]=O(A(e));return r>=.17?e.startsWith("#")?e.toLowerCase():"#"+e.toLowerCase():T(j([t,n<.15?0:n,.17]))}function ta(e,t){let n=O(A(t))[2];if(e==="roofTile"){let[r,o]=O(A(t));return o<.2?ae.slate[1]:T(j([r,xe(o*1.1,.35,.6),xe(.2+n*.85,.38,.5)]))}return e==="slate"?n<.27?ae.slate[1]:n<.31?ae.slate[0]:ae.slate[2]:n<.4?ae.flat[2]:ae.flat[0]}var Ie="measured",na=.18,cr=nt/255;function ra(e){let[t,n,r]=O(A(e)),[o,a,s]=A(T(j([t,n,Math.max(r,na)]))),i=zt()?1:cr;return T([o,a,s].map(c=>Math.min(255,Math.round(c/i))))}var Se=32,Re=64,fe=[157.19,92.83,69.17],dr=240.95,fr=.16,oa=255/(fe[0]+(dr-fe[0])*fr);function Zt(e,t){let n=t/(Re-1),r=n<.5?fe[0]+(fe[1]-fe[0])*(n/.5):fe[1]+(fe[2]-fe[1])*((n-.5)/.5),o=5-15*t/35,a=17-15*t/35,s=t<35&&e+.5>=o&&e+.5<a;return Math.min(255,Math.round((s?r+(dr-r)*fr:r)*oa))}var sa=(()=>{let e=0;for(let t=0;t<Re;t++)for(let n=0;n<Se;n++)e+=Zt(n,t);return e/(Se*Re)})(),or=.4;function aa(e){let[t,n,r]=O(A(e)),a=(r>=or?A(e):j([t,n,or])).map(i=>i/(sa/255)),s=Math.max(1,...a.map(i=>i/255));return T(a.map(i=>Math.min(255,Math.round(i/s))))}var ia=228/255;function la(e){let t=zt()?1:ia;return T(A(e).map(n=>Math.min(255,Math.round(n/t))))}function sr(e){return T(A(e))}function ar(e){return T(A(e))}var ua=["brick","accent","glass","stone","bitumen","slate","roofTile"],Jt=(e,t)=>t===Ie&&ua.includes(e);function bt(e,t,n){if(n===Ie&&(e==="brick"||e==="accent"))return ra(t);if(n===Ie&&e==="glass")return aa(t);if(n===Ie&&e==="stone")return la(t);if(n===Ie&&e==="bitumen")return Ut()?jt(sr(t)):sr(t);if(n===Ie&&(e==="slate"||e==="roofTile"))return Ut()?jt(ar(t)):ar(t);switch(e){case"brick":case"accent":return Xs(t);case"stucco":return Zs(t);case"stone":return Qs(t);case"frame":return Js(t);case"door":return ea(t);case"glass":return"#ffffff";case"paint":return t.startsWith("#")?t.toLowerCase():"#"+t.toLowerCase();default:return ta(e,t)}}var Qt={asphalt:{base:[86,88,93]},cycle:{base:[150,66,58]},klinker:{base:[122,90,80],joint:"#4b3d38"},pavement:{base:[174,162,152],joint:"#7f756b"},kerb:"#cfcac0",paint:"#f2f0ea",rail:"#6c6e72",bollard:"#5a2a26"},mr="#ffd21f",hr="#ff8033",pr="#b4682c";var br={land:{base:[168,158,142],joint:"#857b6d"},paving:{base:[184,174,158],joint:"#8f8577"},square:{base:[190,179,161],joint:"#958a7c"},klinker:{base:[158,124,114],joint:"#7a6660"},asphalt:[68,72,80],cycle:[156,76,66],gravel:[180,166,136],park:[96,140,70],wood:[70,112,58],parking:[102,102,105],kerb:"#aaa498",water:"#46707c",lawn:[110,154,74],bed:{soil:[98,80,60],leaf:[84,122,58]},shrub:{base:[56,92,46],leaf:[76,116,56]},bark:[118,84,58],sand:[212,194,150],parkGravel:[198,184,152],parkPath:[110,110,112],pond:"#46707c",bare:{base:[160,144,122],grit:[186,174,156]}};var da="highlight",fa="__canalRecallHighlight",ma="highlightAccent",ha="__canalRecallHighlightAccent",rt={yellow:{keepMaterials:!1,outline:!1,rim:!1,desaturate:!1,ring:!1,beacon:!1,wash:!1,animated:!1},a:{keepMaterials:!0,outline:!0,rim:!1,desaturate:!1,ring:!0,beacon:!0,wash:!0,animated:!1},b:{keepMaterials:!0,outline:!1,rim:!0,desaturate:!1,ring:!0,beacon:!1,wash:!1,animated:!0},c:{keepMaterials:!0,outline:!1,rim:!1,desaturate:!0,ring:!0,beacon:!1,wash:!1,animated:!1}};var pa=60,he=.4,De=2,on=3.5,gr=100,ba=300;var ga=.75,en=.35,ya="__canalRecallHighlightBoost";function yr(){let e=Number(globalThis[ya]);return Number.isFinite(e)?Math.min(1,Math.max(0,e)):0}var tn="__canalRecallHighlightExtent";function Rr(){let e=globalThis;return e[tn]instanceof Map?e[tn]:e[tn]=new Map}var Ma=.3,wa=2.4,xa=.9,Sa=2.2;var Ra=.28;function Mr(e){if(typeof e!="string")return null;let t=e.trim().toLowerCase();return t==="a"||t==="outline"?"a":t==="b"||t==="rim"?"b":t==="c"||t==="desaturate"?"c":t==="yellow"||t==="0"||t==="off"||t==="old"?"yellow":t==="default"?nn:null}var nn="a";function Be(e){try{let t=globalThis;if(e===void 0){let n=Mr(t[fa]);if(n)return n}return Mr(new URLSearchParams(e??t.location?.search??"").get(da))??nn}catch{return nn}}function vr(e=Be(),t){if(e==="yellow")return mr;try{let n=globalThis,r=(t===void 0?n[ha]:void 0)??new URLSearchParams(t??n.location?.search??"").get(ma);if(r==="hud")return pr;if(typeof r=="string"&&/^#?[0-9a-f]{6}$/i.test(r))return r.startsWith("#")?r:`#${r}`}catch{}return hr}function sn(e=Be()){return rt[e].keepMaterials?{HL_KEEP:""}:{}}var ot=`
#ifdef HL_KEEP
#define HL_PAINT(h) false
#else
#define HL_PAINT(h) ((h) > 0.5 && (h) < 1.5)
#endif
#define HL_GHOST(h) ((h) > 2.5 && fract(dot(floor(gl_FragCoord.xy), vec2(0.569840296, 0.754877666))) >= ${Ra.toFixed(3)})
float hlState(float hidden) { return hidden > 3.5 ? 3.0 : (hidden > 2.5 ? 2.0 : (hidden > 1.5 ? 1.0 : 0.0)); }
vec3 hlDesat(vec3 c, float h) { return h > 1.5 && h < 2.5 ? mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), ${he.toFixed(2)}) : c; }`,va=110540,ka=e=>111320*Math.cos(e*Math.PI/180);function Aa(e,t){let n=(e[1]+t[1])/2;return Math.hypot((e[0]-t[0])*ka(n),(e[1]-t[1])*va)}var kr=(e,t,n=pa)=>!!e&&Aa(e,t)<=n;var wr=`
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
  float far = clamp((length(c4.xyz - hlEye) - ${gr.toFixed(1)}) / ${(ba-gr).toFixed(1)}, 0.0, 1.0);
  float width = hlWidthPx * mix(1.0, hlFarScale, far);
  if (dot(dir, dir) > 1e-12) clip.xy += normalize(dir) * width * 2.0 / hlViewport * clip.w;
#endif
  gl_Position = clip;
}`,_a=`
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
  if (up < ${en.toFixed(2)} || hlWash <= 0.0) discard;
  gl_FragColor = vec4(hlAccent, hlWash * smoothstep(${en.toFixed(2)}, ${(en+.15).toFixed(2)}, up));
#else
  vec3 n = hlHasNormal > 0.5 ? normalize(vHlNormal) : normalize(cross(dFdx(vHlPos), dFdy(vHlPos)));
  vec3 v = normalize(hlEye - vHlPos);
  float f = pow(1.0 - abs(dot(n, v)), ${Sa.toFixed(2)});
  float pulse = 0.775 + 0.225 * sin(hlTime * 6.2831853 / ${wa.toFixed(2)});
  gl_FragColor = vec4(hlAccent * f * ${xa.toFixed(2)} * pulse, 1.0);
#endif
}`,gt="canalRecallHighlightPass",Ca="__canalRecallHighlightOutlinePx";function $a(){let e=globalThis[Ca],t=e==null||e===""?NaN:Number(e);return Number.isFinite(t)&&t>=0?t:null}var La=(e,t)=>{let[n,r,o]=A(t);return new e.Vector3(n/255,r/255,o/255)};function Ta(e,t,n={}){let r={};n.merged&&(r.HL_MERGED=""),t==="outline"&&(r.HL_OUTLINE=""),t==="roof"&&(r.HL_ROOF="");let o=wr;if(n.feature){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n.feature.attribute))throw new Error(`highlight: bad feature attribute ${n.feature.attribute}`);r.HL_FEATURE=n.feature.attribute,o=`attribute float ${n.feature.attribute};
uniform float hlFeatureId;
${wr}`}let a=new e.ShaderMaterial({defines:r,uniforms:{hlViewport:{value:new e.Vector2(1,1)},hlWidthPx:{value:De},hlFarScale:{value:on/De},hlCentre:{value:new e.Vector3},hlDepthPush:{value:Ma},hlAccent:{value:La(e,n.accent??vr())},hlEye:{value:new e.Vector3},hlTime:{value:0},hlHasNormal:{value:1},hlFeatureId:{value:n.feature?.id??0},hlUp:{value:new e.Vector3(0,0,1)},hlWash:{value:0}},vertexShader:o,fragmentShader:_a,side:t==="outline"?e.BackSide:e.FrontSide,transparent:!0,depthTest:!0,depthWrite:t==="outline",blending:t==="rim"?e.AdditiveBlending:e.NormalBlending,polygonOffset:t!=="outline",polygonOffsetFactor:-1,polygonOffsetUnits:t==="roof"?-4:-2});return a.name=`highlight/${t}${n.merged?"/merged":""}`,a.userData={[gt]:!0},a.defaultAttributeValues={hidden:[0],normal:[0,0,0]},a}function Fa(e,t,n,r){let o=e.geometry?.boundingBox,a=t.elements;if(!o)return;let s=n.domElement,i=s?.clientWidth||r.x,c=s?.clientHeight||r.y,l=[],d=!1;for(let u=0;u<8;u++){let p=u&1?o.max.x:o.min.x,h=u&2?o.max.y:o.min.y,y=u&4?o.max.z:o.min.z,M=a[0]*p+a[4]*h+a[8]*y+a[12],g=a[1]*p+a[5]*h+a[9]*y+a[13],S=a[3]*p+a[7]*h+a[11]*y+a[15];if(!(S>1e-9)){d=!0;break}l.push((M/S+1)/2*i,(1-g/S)/2*c)}Rr().set(e,{t:performance.now(),points:l,behind:d,width:i,height:c})}function Ea(e){for(let t of e?.userData?.[gt]??[])e.remove(t),Da(t.material),Rr().delete(t);e?.userData&&delete e.userData[gt]}var Oa=4,rn=new Map,Ar=Symbol("highlightPassPool");function Ia(e,t){return`${e}|${t.merged?1:0}|${t.feature?.attribute??""}|${t.accent??""}`}function Pa(e,t,n={}){let r=Ia(t,n),o=rn.get(r)?.pop();if(o){let s=o.uniforms;return s.hlCentre.value.set(0,0,0),s.hlHasNormal.value=1,s.hlFeatureId.value=n.feature?.id??0,s.hlUp.value.set(0,0,1),s.hlWash.value=0,s.hlEye.value.set(0,0,0),s.hlTime.value=0,s.hlWidthPx.value=De,s.hlFarScale.value=on/De,o}let a=Ta(e,t,n);return a.userData[Ar]=r,a}function Da(e){let t=e?.userData?.[Ar];if(!t){e?.dispose?.();return}let n=rn.get(t)??[];rn.set(t,n),n.length<Oa&&!n.includes(e)?n.push(e):e.dispose()}function xr(e){let t=e?.getAttribute?.("position")??e?.attributes?.position;return!t||!!t.array}function _r(e,t,n={}){Ea(t);let r=rt[n.style??Be()],o=[...r.outline?["outline"]:[],...r.rim?["rim"]:[],...r.wash&&!n.feature?["roof"]:[]];if(!o.length||!t?.geometry)return[];let a=t.geometry,s=n.centre;if(!s){!a.boundingBox&&xr(a)&&a.computeBoundingBox?.();let g=a.boundingBox?.getCenter(new e.Vector3)??a.boundingSphere?.center;s=g?[g.x,g.y,g.z]:[0,0,0]}let i=a.getAttribute?.("normal")?1:0,c=[],l=new e.Matrix4,d=new e.Vector4,u=new e.Vector2,p=new e.Matrix3,h=new e.Vector3,y=n.up??[0,0,1],M=!n.merged&&!n.feature&&!t.isInstancedMesh;M&&!a.boundingBox&&xr(a)&&a.computeBoundingBox?.();for(let g of o){let S=Pa(e,g,{merged:n.merged,feature:n.feature,accent:n.accent??vr(n.style)});S.uniforms.hlCentre.value.set(s[0],s[1],s[2]),S.uniforms.hlHasNormal.value=i;let b=t.isInstancedMesh?new e.InstancedMesh(a,S,t.count):new e.Mesh(a,S);t.isInstancedMesh&&(b.instanceMatrix=t.instanceMatrix),b.name=`${t.name||"mesh"}/highlight-${g}`,b.frustumCulled=!1,b.castShadow=b.receiveShadow=!1,b.renderOrder=(t.renderOrder??0)+1,b.raycast=()=>{},g==="roof"&&Object.defineProperty(b,"visible",{get:()=>t.visible&&yr()>.001,set:()=>{},configurable:!0}),b.onBeforeRender=(_,Y,v)=>{t.isInstancedMesh&&(b.count=t.count),g!=="roof"&&(b.visible=t.visible);let F=S.uniforms;if(g==="roof"){p.setFromMatrix4(b.matrixWorld),h.setFromMatrixColumn(b.matrixWorld,0);let q=h.length()<.001?[0,0,1]:y;F.hlUp.value.set(q[0],q[1],q[2]).applyMatrix3(p.invert()).normalize(),F.hlWash.value=ga*yr()}_.getDrawingBufferSize(u),F.hlViewport.value.copy(u);let ne=_.domElement?.clientWidth||u.x,Q=$a();F.hlWidthPx.value=(Q??De)*(u.x/ne),F.hlFarScale.value=Q==null?on/De:1,l.multiplyMatrices(v.projectionMatrix,v.matrixWorldInverse).multiply(b.matrixWorld),g==="outline"&&M&&Fa(b,l,_,u),l.invert(),d.set(0,0,1,0).applyMatrix4(l),Math.abs(d.w)>1e-12&&F.hlEye.value.set(d.x/d.w,d.y/d.w,d.z/d.w),F.hlTime.value=performance.now()/1e3,S.uniformsNeedUpdate=!0},t.add(b),c.push(b)}return t.userData??={},t.userData[gt]=c,c}var Sr=new WeakMap;function an(e,t,n,r=Be()){if(!t||n==="plain"||n==="highlight"&&rt[r].keepMaterials)return t;let o=Sr.get(t);o||Sr.set(t,o=new Map);let a=`${n}|${r}`,s=o.get(a);if(s)return s;if(n==="highlight")s=new e.MeshLambertMaterial({color:16765471,emissive:7033856,side:t.side??e.FrontSide});else if(t.isShaderMaterial&&t.uniforms?.tint?.value?.isVector3)s=t.clone(),s.uniforms={...t.uniforms,tint:{value:Ba(t.uniforms.tint.value.clone())}};else if(t.isShaderMaterial&&t.uniforms?.hlDimAll)s=t.clone(),s.uniforms={...t.uniforms,hlDimAll:{value:1}};else if(t.isShaderMaterial)s=t.clone(),s.uniforms=t.uniforms,s.defines={...t.defines??{},HL_DIM_ALL:""};else{if(s=t.clone(),s.color){let i=s.color,c=.2126*i.r+.7152*i.g+.0722*i.b;i.setRGB(i.r+(c-i.r)*he,i.g+(c-i.g)*he,i.b+(c-i.b)*he)}if(s.map){let i=s.onBeforeCompile;s.onBeforeCompile=(c,l)=>{i?.call(s,c,l),c.fragmentShader=c.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${he.toFixed(2)});`)},s.customProgramCacheKey=()=>`${t.customProgramCacheKey?.()??""}|hl-dim`}}return s.name=`${t.name||"material"}/${n}`,s.userData={...t.userData??{},highlightVariantOf:t},o.set(a,s),s}function Ba(e){let t=.2126*e.x+.7152*e.y+.0722*e.z;return e.set(e.x+(t-e.x)*he,e.y+(t-e.y)*he,e.z+(t-e.z)*he)}var pe={k:.2,minL:.34,maxL:.93,chroma:2.4,maxC:.12,hue:{pull:.5,toward:40,warm:[20,85],capAt:[45,70],capC:[.12,.06]},neutralC:[.015,.03],coolKeep:.35,darkL:[.38,.46],darkGain:.35,darkLift:[.3,.5],paleL:[.65,.72],paint:{c0:.01,c1:.018,l0:.45,l1:.6}};function Na(e,t){let{c0:n,c1:r,l0:o,l1:a}=pe.paint,s=i=>Math.max(0,Math.min(1,i));return 1-(1-s((t-n)/(r-n)))*(1-s((e-o)/(a-o)))}var Wa=!0;function Ha(e,t){let n=e?/[?&]wallChroma=([01])\b/.exec(e)?.[1]:void 0,r=n??(t==="0"||t==="1"?t:void 0);return r===void 0?Wa:r==="1"}var ln;function Ga(){if(ln!==void 0)return ln;let e=globalThis;return ln=Ha(e.location?.search??null,e.process?.env?.WALL_CHROMA??null)}var un=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},Ua=e=>255*(e<=.0031308?12.92*e:1.055*e**(1/2.4)-.055);function ie(e){let t=parseInt(e.slice(1),16),n=un(t>>16&255),r=un(t>>8&255),o=un(t&255),a=Math.cbrt(.4122214708*n+.5363325363*r+.0514459929*o),s=Math.cbrt(.2119034982*n+.6806995451*r+.1073969566*o),i=Math.cbrt(.0883024619*n+.2817188376*r+.6299787005*o);return[.2104542553*a+.793617785*s-.0040720468*i,1.9779984951*a-2.428592205*s+.4505937099*i,.0259040371*a+.7827717662*s-.808675766*i]}function cn([e,t,n]){let r=(e+.3963377774*t+.2158037573*n)**3,o=(e-.1055613458*t-.0638541728*n)**3,a=(e-.0894841775*t-1.291485548*n)**3;return[4.0767416621*r-3.3077115913*o+.2309699292*a,-1.2684380046*r+2.6097574011*o-.3413193965*a,-.0041960863*r-.7034186147*o+1.707614701*a]}var Cr=e=>e.every(t=>t>=-1e-4&&t<=1+1e-4);function Ne(e){let[t,n,r]=e,o=cn([t,n,r]);if(!Cr(o)){let a=0,s=1;for(let i=0;i<20;i++){let c=(a+s)/2;Cr(cn([t,n*c,r*c]))?a=c:s=c}n*=a,r*=a,o=cn([t,n,r])}return"#"+o.map(a=>Math.round(Math.max(0,Math.min(255,Ua(Math.max(0,Math.min(1,a)))))).toString(16).padStart(2,"0")).join("")}function Lr(e,t={}){let[n,r,o]=ie(e),a=Math.hypot(r,o),s=Na(n,a),i=pe.k*s*Math.max(0,Math.min(1,(n-pe.darkLift[0])/(pe.darkLift[1]-pe.darkLift[0]))),c=Math.min(pe.maxL,Math.max(t.minL??pe.minL,1-(1-n)*(1-i)));if(t.fromPixel===!1||a<1e-6)return Ne([c,r,o]);let l=pe,d=Y=>Math.max(0,Math.min(1,Y)),u=d((a-l.neutralC[0])/(l.neutralC[1]-l.neutralC[0]))*s,p=d((n-l.darkL[0])/(l.darkL[1]-l.darkL[0])),h=l.darkGain+(1-l.darkGain)*p,y=1-d((n-l.paleL[0])/(l.paleL[1]-l.paleL[0])),M=u*h*y,g=Math.atan2(o,r)*180/Math.PI;if(g<l.hue.warm[0]||g>l.hue.warm[1])return Ne([c,r*l.coolKeep,o*l.coolKeep]);if(Ga())return Ne([c,r,o]);g>l.hue.toward&&(g+=(l.hue.toward-g)*l.hue.pull*u*y*p);let S=d((g-l.hue.capAt[0])/(l.hue.capAt[1]-l.hue.capAt[0])),b=l.hue.capC[0]+(l.hue.capC[1]-l.hue.capC[0])*S,_=Math.min(a*(1+(l.chroma-1)*M),Math.max(a,b));return Ne([c,_*Math.cos(g*Math.PI/180),_*Math.sin(g*Math.PI/180)])}var ja=["white","grey","buff","orange","red","red-brown","brown","dark"],dn={white:"#e8e4da",grey:"#8a8d8f",buff:"#c4a574",orange:"#b8643c",red:"#9c4433","red-brown":"#8a4a3c",brown:"#6a4c3e",dark:"#2b2b2e"},Va=["brown","red-brown","red","orange","buff"];function $r(e,t=ja){let[n,r,o]=ie(e),a=t[0],s=1/0;for(let i of t){let[c,l,d]=ie(dn[i]),u=Math.hypot(n-c,r-l,o-d);u<s&&(s=u,a=i)}return a}var za=.05;function Tr(e,t){let n=t.family??(t.brick?$r(e,Va):null);if(!n)return{hex:e,fromPixel:!0,family:null};let r=ie(e)[0]>ie(dn[n])[0]+za,o=!!t.family&&$r(e)!==t.family;return r&&(t.brick||o)?{hex:dn[n],fromPixel:!1,family:n}:{hex:e,fromPixel:!0,family:n}}var qa=!1;function Ka(e,t){let n=(e?/[?&]modelWallFloor=([01])\b/.exec(e)?.[1]:void 0)??t??void 0;return n==="1"?!0:n==="0"?!1:qa}var fn;function Fr(){if(fn!==void 0)return fn;let e=globalThis;return fn=Ka(e.location?.search??null,e.process?.env?.MODEL_WALL_FLOOR??null)}function Er(e,t){let n=Tr(t,{brick:!0}),r=ie(Lr(n.hex,{fromPixel:n.fromPixel}))[0],[o,a,s]=ie(e);return o<=r+1e-4?e:Ne([r,a*r/o,s*r/o])}var X={other:0,wall:1,roof:2,lid:3,trim:4,cornice:5,frontage:6,extrasStrip:7,extrasBox:8,extrasOther:9,shell:10},Ya=[{name:"other",id:X.other,rgb:[0,0,0]},{name:"wall",id:X.wall,rgb:[255,255,255]},{name:"roof",id:X.roof,rgb:[255,0,0]},{name:"lid",id:X.lid,rgb:[128,0,128]},{name:"trim-decal",id:X.trim,rgb:[0,255,0]},{name:"cornice",id:X.cornice,rgb:[0,0,255]},{name:"frontage",id:X.frontage,rgb:[255,255,0]},{name:"extras-strip",id:X.extrasStrip,rgb:[255,0,255]},{name:"extras-box",id:X.extrasBox,rgb:[0,255,255]},{name:"extras-other",id:X.extrasOther,rgb:[128,128,0]},{name:"shell",id:X.shell,rgb:[0,128,128]}],Or=1,Xa=2,Za=4e-6;var Ja=(e,t)=>e*t/2;function Qa(e){let t=[e[1],e[5],e[9]],n=[e[3],e[7],e[11]],r=Math.hypot(n[0],n[1],n[2]);if(!(r>1e-12))return Math.hypot(t[0],t[1],t[2]);let o=(t[0]*n[0]+t[1]*n[1]+t[2]*n[2])/r;return Math.sqrt(Math.max(0,t[0]**2+t[1]**2+t[2]**2-o*o))/r}function Dr(e){try{return typeof URLSearchParams=="function"?new URLSearchParams(globalThis.location?.search??"").get(e):null}catch{return null}}function ei(){let t=globalThis.__canalRecallThinFade??Dr("thinFade");return!(t===!1||t==="0"||t==="false"||t==="off")}function ti(){return(globalThis.__canalRecallThinDebug??Dr("thinDebug"))==="owner"?"owner":null}var st=e=>Number.isInteger(e)?e.toFixed(1):String(e),ni=e=>`vec3(${e.map(t=>(t/255).toFixed(4)).join(", ")})`,ri=`
attribute vec2 thin;
varying float vThinM;
flat varying float vThinClass;
`,oi=`
vThinM = thin.x * 0.01; vThinClass = thin.y;
#ifdef CITY_THIN_FADE
if (thin.y > ${st(X.trim-.5)} && thin.y < ${st(X.trim+.5)}) gl_Position.z -= ${Za.toExponential()} * gl_Position.w;
#endif
`,si=`
uniform float thinFocalPx;
varying float vThinM;
flat varying float vThinClass;
vec3 thinOwnerColour(float c) {
${Ya.map(e=>`  if (c < ${st(e.id+.5)}) return ${ni(e.rgb)};`).join(`
`)}
  return vec3(0.5);
}
`,ai=`
#ifdef CITY_THIN_FADE
if (vThinM > 0.0) {
  float thinPx = vThinM * thinFocalPx / max(vFacDist, 0.01);
  float thinCover = clamp((thinPx - ${st(Or)}) / ${st(Xa-Or)}, 0.0, 1.0);
  if (thinCover < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= thinCover) discard;
}
#endif
`,Ir=`
#ifdef CITY_THIN_OWNER
gl_FragColor = vec4(thinOwnerColour(vThinClass), 1.0);
#endif
`,mn={value:1e3};function ii(e){if(e?.getCurrentViewport){let t=e.getCurrentViewport(li);if(t&&t.w>0)return t.w}return e?.getDrawingBufferSize?e.getDrawingBufferSize(ui).y:0}var li={x:0,y:0,z:0,w:0,copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w,this}},ui={x:0,y:0,set(e,t){return this.x=e,this.y=t,this},floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}};function Pr(e,t,n){let r="void main() {",o=/vFacDist = length\([^;]*\);/,a="if (HL_GHOST(vHighlight)) discard;";if(!e.includes(r)||!o.test(e)||!t.includes(r)||!t.includes(a))return null;let s=e.replace(r,`${ri}${r}`).replace(o,c=>`${c}${oi}`),i=t.replace(r,`${si}${r}`).replace(a,`${a}${ai}`);if(n){if(!i.includes("#include <dithering_fragment>"))return null;i=i.replace("#include <dithering_fragment>",`#include <dithering_fragment>${Ir}`)}else{let c=i.lastIndexOf("}");i=`${i.slice(0,c)}${Ir}${i.slice(c)}`}return{vertex:s,fragment:i}}function Br(e,t,n={}){let r=n.fade??ei(),o=n.debug===void 0?ti():n.debug;if(!r&&!o)return e;if(e.defines={...e.defines??{},...r?{CITY_THIN_FADE:""}:{},...o?{CITY_THIN_OWNER:""}:{}},e.defaultAttributeValues={...e.defaultAttributeValues??{},thin:[0,0]},t){let s=e.onBeforeCompile;e.onBeforeCompile=function(i,c){s?.call(this,i,c);let l=Pr(i.vertexShader,i.fragmentShader,!0);l&&(i.vertexShader=l.vertex,i.fragmentShader=l.fragment,i.uniforms.thinFocalPx=mn)}}else{let s=Pr(e.vertexShader,e.fragmentShader,!1);if(!s)return e;e.vertexShader=s.vertex,e.fragmentShader=s.fragment,e.uniforms={...e.uniforms,thinFocalPx:mn}}let a=e.onBeforeRender;return e.onBeforeRender=function(s,i,c,...l){a?.call(this,s,i,c,...l);let d=ii(s),u=c?.projectionMatrix?.elements,p=u?Qa(u):NaN;d>0&&Number.isFinite(p)&&p>0&&(mn.value=Ja(p,d))},e.userData={...e.userData??{},thinFade:r,thinDebug:o},e}var Nr=e=>{let t=globalThis,n=new RegExp(`[?&]${e}=([^&]*)`).exec(t.location?.search??"");return n?decodeURIComponent(n[1]):null};function hn(){let t=globalThis.__canalRecallDrawLimit??Nr("drawLimit");return t===!0||t==="1"||t==="true"||t==="on"?!0:!(t===!1||t==="0"||t==="false"||t==="off")}var ci=e=>Number.isInteger(e)?`${e}.0`:`${e}`,Wr=`(fogNear * (1.0 + fract(fogFar) * ${ci(8)}))`;var di=!0;function Hr(){if(!hn())return!1;let e=globalThis.__canalRecallLandmarkHaze??Nr("landmarkHaze");return e===!0||e==="1"||e==="true"||e==="on"?!0:e===!1||e==="0"||e==="false"||e==="off"?!1:di}var Gr="DEPTH_FADE_LIMIT_ONLY";var fi=.5,mi=.38,Ur=250,hi=600,pi=.4;function jr(){let e=globalThis,t=typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("fadeStrength"):null,n=e.__canalRecallFadeStrength??t,r=n==null||n===""?NaN:Number(n);return Number.isFinite(r)?Math.max(0,Math.min(2,r)):1}var ve=e=>Number.isInteger(e)?`${e}.0`:`${e}`;var bi=(e=jr())=>`#ifdef USE_FOG
	float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	float fadeLuma = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( fadeLuma ), fogFactor * ${ve(fi*e)} );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * ${ve(mi*e)} );
#endif`,Ic=bi(1),Vr=`uniform vec3 fogColor;
	varying vec3 vFogEye;
	#define vFogDepth length( vFogEye )
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif`,Pc=`#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
	${Vr}
#endif`,zr=`
#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
#define DEPTH_FADE_FOG_PARS
	${Vr}
#endif
`,pn=(e,t=jr(),n=hn())=>{let r=n?Wr:"fogFar";return`${ve(Math.min(1,t))} * smoothstep(max(${ve(Ur)}, fogNear), max(max(${ve(hi)}, fogNear + (${r} - fogNear) * ${ve(pi)}), max(${ve(Ur)}, fogNear) + 1.0), ${e})`};var gi="canalRecallDepthFadeOptOut";function qr(e,t=Hr()){t&&e.fog!==!1?e.defines={...e.defines??{},[Gr]:""}:e.fog=!1,e.userData={...e.userData??{},[gi]:!0}}var gn="inferred",yi=e=>O(A(e))[1]<.2,Mi=e=>{let[t,n,r]=O(A(e));return(t<45||t>340)&&n>=.15&&r<.7},wi=e=>yi(e)?"slate":"roofTile",bn=e=>Mi(e)?"brick":"stucco",xi=[{test:/glass|glaz|window|vitr|ruit|pane/,slot:"glass",confidence:"name",rule:"glazing name"},{test:/decal|sign|mural|logo|letter|clock|dial/,slot:"paint",confidence:"name",rule:"signage / decal"},{test:/door|deur|gate/,slot:"door",confidence:"name",rule:"door name"},{test:/frame|kozijn|louvre|louver|blind|shutter|rail|mullion|sash/,slot:"frame",confidence:"name",rule:"joinery name"},{test:/brick|baksteen|klinker|terracotta/,slot:"brick",confidence:"name",rule:"brick name"},{test:/slate|leien|lei$/,slot:"slate",confidence:"name",rule:"slate name"},{test:/bitumen|asphalt|tar$|felt|flatroof|flat-roof|gravel/,slot:"bitumen",confidence:"name",rule:"flat roof name"},{test:/roof|tile|pantile|dakpan|dak/,slot:wi,confidence:"name",rule:"roof name, grey \u2192 slate, else pantile"},{test:/sandstone|stone|steen|column|marble|granite|limestone|plinth/,slot:"stone",confidence:"name",rule:"stone name"},{test:/stucco|render|plaster|pleister|concrete|beton|slab/,slot:"stucco",confidence:"name",rule:"render / concrete name"},{test:/gold|gilt|bronze|copper|brass|zinc|metal|steel|iron|lead|alu/,slot:"paint",confidence:"name",rule:"metal name (flat colour)"},{test:/wall|facade|gevel/,slot:bn,confidence:"name",rule:"wall name, brick hue \u2192 brick, else stucco"},{test:/ochre|yellow|buff/,slot:bn,confidence:"colour-word",rule:"ochre: yellow brick (brick hue) or render"},{test:/pink|rose/,slot:"stucco",confidence:"colour-word",rule:"pink: painted render"},{test:/moss|grass|green|blue|orange|purple|paint|teal/,slot:"paint",confidence:"colour-word",rule:"coloured paint word"},{test:/white|cream|ivory/,slot:"stucco",confidence:"colour-word",rule:"white: stucco (could be white trim)"},{test:/dark|black|charcoal|anthracite/,slot:"frame",confidence:"colour-word",rule:"dark: painted joinery / ironwork (could be a dark wall)"},{test:/red/,slot:bn,confidence:"colour-word",rule:"red: brick hue \u2192 brick (could be red tile or paint)"},{test:/grey|gray/,slot:"stucco",confidence:"colour-word",rule:"grey: render (could be concrete or zinc)"}];function Kr(e){return String(e??"").toLowerCase().replace(/[-_.\s]*\d+$/,"").trim()}function Si(e){let[t,n,r]=O(A(e));return r<.22?{slot:"frame",rule:"very dark: joinery / ironwork"}:n>=.15&&(t<45||t>340)&&r<.62?{slot:"brick",rule:"brick hue"}:n<.2&&r>=.6?{slot:"stucco",rule:"pale neutral: render"}:n<.2&&r>=.22&&t>180&&t<260?{slot:"slate",rule:"blue-grey: slate"}:n<.25?{slot:"stone",rule:"neutral mid-tone: stone"}:{slot:"paint",rule:"saturated colour: paint"}}function Yr(e,t){let n=t.toLowerCase(),r=Kr(e);for(let a of xi)if(a.test.test(r))return{slot:typeof a.slot=="function"?a.slot(n):a.slot,tint:n,confidence:a.confidence,rule:a.rule};let o=Si(n);return{slot:o.slot,tint:n,confidence:"colour",rule:`no material word in "${r||"unnamed"}"; ${o.rule}`}}var Xr=e=>/white|cream|ivory/.test(Kr(e)),yn=e=>typeof e=="string"&&ur.includes(e);var W=.045;var Mn={ribs:{pitch:.5,min:.25,max:2,w:.09,out:.04},boards:{pitch:.4,min:.15,max:1.5,w:.05,out:.035},louvres:{pitch:.35,min:.2,max:1,w:.12,out:.12},panels:{pitch:1.2,min:.6,max:6,w:.05,out:.035}};var dd={min:.15,max:Mn.ribs.max};var Ii={installGate:{groups:!0,core:!1,solidBody:!0,clusterWall:!1},houseLine:{groups:!0,core:!0,solidBody:!0,clusterWall:!0}},Qd={...Ii.installGate};var no={canal:["#6e5352","#8c7768","#977f73","#a79276","#b8a17a","#575245","#60564b","#62544d","#61584c","#655850","#655b50","#6a5454","#6f6058","#726359","#726459","#76615d","#77685d","#7a6c60","#826c66","#918174","#9a887f","#a89f8a","#6b6163","#dfdcd2"],c19:["#70564f","#6f5b52","#7a665c","#86695b","#886a5f","#857266","#8b746d","#9b887e","#a38e83","#ad9585","#61534a","#63564e","#685b52","#6f6057","#716259","#75665c","#7b6961","#7c6962","#7f6a64","#7f7664","#8e796f","#9c9181","#95787e","#dad8cf"],school:["#665247","#775744","#735d52","#786158","#8c5957","#896559","#856f63","#9d7f6d","#ad997f","#5c4f48","#61564c","#67564e","#6b5554","#6b5851","#6b5b50","#716057","#745e5b","#75655c","#78665f","#806d64","#89706b","#a19888","#614a4e","#a4a09f"],modern:["#715d53","#7c6459","#816b64","#8f7265","#9c8980","#ac9a86","#60594c","#635c4e","#6a5a50","#6c5a54","#6c5e55","#6e6256","#72675a","#776a5d","#7b6a61","#7f6f64","#807265","#886f6b","#8b7d6d","#958b79","#a29189","#695256","#a59b8d","#c8c5ba"]};var wn={"#4f4834":[215,215,215],"#463823":[216,215,215],"#5f5950":[215,215,215],"#a69873":[215,215,215],"#57423e":[215,215,215],"#473c3b":[215,215,215],"#5d5d5c":[214,215,215],"#7e573b":[215,215,215],"#705449":[215,215,215],"#7f8283":[215,214,215],"#796764":[215,215,215],"#5d534b":[215,215,215],"#7d6e52":[215,215,215],"#88735e":[215,215,215],"#88715f":[215,215,215],"#736352":[215,215,215],"#241d1c":[172,172,172],"#4b3f37":[215,215,215],"#615551":[215,215,215],"#595651":[214,215,214],"#423931":[215,215,215],"#7b6d6a":[215,214,216],"#382418":[215,215,215],"#866343":[215,215,215],"#6e6256":[215,215,215],"#625650":[205,205,205],"#252c24":[185,185,186],"#2d281b":[215,214,215],"#3b342b":[215,215,215],"#6f5c56":[215,215,215],"#393535":[215,215,215],"#786357":[215,215,215],"#383d43":[205,215,215],"#554e4a":[215,216,215],"#3d3432":[215,215,215],"#3d353c":[215,215,215],"#4e443f":[215,215,215],"#70574d":[207,207,207],"#d49662":[215,215,215],"#917b5c":[215,215,215],"#494341":[215,215,215],"#645f5f":[215,215,214],"#342a18":[215,215,215],"#825746":[215,216,215],"#99604e":[212,215,215],"#706868":[215,215,215],"#786b61":[215,215,214],"#5c5b57":[215,215,215],"#7a655b":[215,215,215],"#6f5b54":[215,215,215],"#4a3f3a":[215,214,215],"#614f44":[216,215,215],"#654e44":[215,215,215],"#6f5f53":[215,215,216],"#584d49":[215,215,215],"#d3c9b2":[215,215,215],"#544b46":[215,215,215],"#929289":[215,215,215],"#68584f":[215,215,216],"#574d47":[215,215,215],"#5e4e41":[215,215,215],"#6e605a":[215,215,215],"#605d5c":[215,215,215],"#8c7a6f":[215,215,215],"#4a3832":[165,165,166],"#81614f":[215,215,215],"#3d3533":[215,215,215],"#6d5351":[215,215,215],"#5c3d33":[214,214,215],"#906553":[215,215,215],"#65493d":[215,215,215],"#8e5f49":[215,215,215],"#8c6858":[215,215,215],"#8b5946":[215,215,215],"#665253":[209,209,209],"#3e3222":[215,215,215],"#000000":[197,198,197],"#7b081b":[215,215,215],"#383131":[215,215,215],"#3d3b37":[211,215,215],"#877d76":[214,215,215],"#191d0c":[215,214,213],"#bcab88":[215,215,215],"#656462":[215,215,215],"#3f3634":[174,174,175],"#463e3c":[197,197,198],"#453d3a":[177,177,176],"#1f1a1b":[156,156,157],"#615450":[214,215,215],"#5b4f4b":[215,215,215],"#574c4a":[215,215,215],"#413333":[215,215,215],"#7b5c53":[215,215,215],"#5f342b":[216,215,215],"#4e2422":[215,215,215],"#5b4b44":[209,209,209],"#493d32":[215,215,215],"#6a5048":[216,216,215],"#5e5855":[215,215,215],"#5e3f35":[215,215,215],"#68564f":[215,215,215],"#6b3e33":[215,214,215],"#5f3c30":[215,214,215],"#929191":[215,215,215],"#a2acb3":[215,215,215],"#8f7b65":[215,215,215],"#988e7d":[215,215,215],"#726d60":[215,215,215],"#584c45":[215,214,215],"#594643":[216,215,215],"#5e5750":[212,215,215],"#78645b":[215,215,215],"#484440":[215,215,215],"#73645e":[215,215,215],"#5c4f47":[215,215,215],"#3c3d39":[215,215,215],"#645451":[215,215,214],"#37333d":[179,179,178],"#a6856f":[215,215,215],"#574d4d":[205,205,205],"#393737":[215,215,215],"#6f4a3b":[215,214,215],"#ffa169":[212,215,215],"#576465":[216,215,216],"#71614a":[215,215,215],"#6c584f":[215,215,215],"#5b463e":[215,216,215],"#765e52":[214,215,215],"#4f4e4c":[215,215,215],"#544945":[215,215,215],"#504140":[194,195,194],"#51514f":[215,215,215],"#74665f":[215,215,215],"#735c59":[215,215,215],"#474d56":[215,215,215],"#7d6e5a":[215,215,215],"#514a43":[215,215,215],"#4e4e49":[215,215,215],"#745c51":[215,215,215],"#47403c":[215,215,215],"#4c3a37":[215,215,215],"#675d5a":[215,215,215],"#574e48":[215,215,215],"#686360":[215,215,215],"#4a413f":[215,215,215],"#423735":[215,215,215],"#756860":[215,215,215],"#5e5144":[215,215,215]};var ff={street:{...Qt,brick:Qt.klinker},tones:br};var Di=["sunny","legacy"],Bi="sunny";function be(e){let t=globalThis,r=/[?&]look=([\w-]+)/.exec(e??t.location?.search??"")?.[1]??t.__canalRecallLook;return Di.includes(r??"")?r:Bi}var Ge=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},Ni=e=>255*(e<=.0031308?e*12.92:1.055*e**(1/2.4)-.055),_e=e=>{let t=parseInt(e.replace("#",""),16);return[t>>16&255,t>>8&255,t&255]},xn=e=>"#"+e.map(t=>Math.round(Math.max(0,Math.min(255,t))).toString(16).padStart(2,"0")).join(""),Wi=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],He=e=>Wi(_e(e).map(Ge)),Hi=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],Mt={zenith:"#9ec3ed",horizon:"#a1c6e5"};function Gi(e){let t=e.sunElevationDeg*Math.PI/180,n=He(e.sunColour)*e.sunIntensity/Math.PI,r=He(e.skyColour)*e.skyIntensity/Math.PI,o=He(e.groundColour)*e.skyIntensity/Math.PI,a=(r+o)/2;return{flat:n*Math.sin(t)+r,sunWall:n*Math.cos(t)+a,shadeWall:a}}var Ui=.55;function ji(e="#ffe2bf",t="#aca497",n=Ui){let r=40*Math.PI/180,o=c=>{let l=xn(_e(Mt.horizon).map(h=>h+(255-h)*c)),d=He(e)*2.15/Math.PI*Math.cos(r),u=(He(l)+He(t))/2/Math.PI,p=n*d/(1-n)/u;return{sunColour:e,sunIntensity:2.15,skyColour:l,groundColour:t,skyIntensity:p,sunElevationDeg:40}},a=c=>{let l=o(c),d=_e(l.sunColour).map(Ge),u=_e(l.skyColour).map(Ge),p=[0,2].map(h=>d[h]*l.sunIntensity*Math.sin(r)+u[h]*l.skyIntensity);return p[0]/p[1]},s=0,i=1;for(let c=0;c<40;c++){let l=(s+i)/2;a(l)<1?s=l:i=l}return{...o(i),whiteMix:+i.toFixed(3)}}var We=ji(),ro=1/Gi(We).sunWall,ao={sunColour:We.sunColour,sunIntensity:+(We.sunIntensity*ro).toFixed(4),skyColour:We.skyColour,groundColour:We.groundColour,skyIntensity:+(We.skyIntensity*ro).toFixed(4)},oo=[.85,1.6],Vi=e=>typeof e=="string"?_e(e):e;function Sn(e){let t=e?Ge(219)/Ge(Hi(Vi(e))):1.106;return Math.max(oo[0],Math.min(oo[1],t))}function Ce(e,t){let n=_e(e).map(o=>Ge(o)*t),r=Math.max(1,...n);return xn(n.map(o=>Ni(o/r)))}function so(e,t=wn[e.toLowerCase()]){return Ce(e,Sn(t))}function io(e,t,n,r=be(),o){return r!=="sunny"||n!=="measured"||e!=="brick"&&e!=="accent"?t:o?so(t,o):so(t)}var yf=(()=>{let e=Object.keys(wn).map(_e),t=n=>n.slice().sort((r,o)=>r-o)[n.length>>1];return xn([0,1,2].map(n=>t(e.map(r=>r[n]))))})();var zi=2,qi=.62;function Ki(e,t=zi){let n=Ce(e,t);if(O(A(e))[2]>=qi)return n;let[r,o,a]=O(A(n));return a<=me[1]?n:T(j([r,o,me[1]]))}var Yi=e=>Object.fromEntries(Object.entries(e).map(([t,n])=>[t,n?n.map(r=>Ki(r)):null])),Cf=Yi(no);var Xi={anonymous:"This building has no name or date in the map data.",named:"The map data has no date for this building.",place:"A mapped place; the map data has no date for its building."},Of=new Set(Object.values(Xi));var at=["canal","c19","school","postwar","modern","tower"];var Ji=8;var im=16+Math.log2(Ji);var I=256,Qi=["upper","ground","door","plain","shop"],el=2;var dm=at.length*el*Qi.length;var Z=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16));var fm=Z("#7d93a0"),mm=Z("#1f2a33");var hm=Z("#b8ad98"),pm=Z("#cfc6b4"),bm=Z("#ece8dd"),gm=Z("#e2d9c2"),ym=[Z("#2c4a3d"),Z("#3a2a22"),Z("#1f3b57"),Z("#5a2a24")],Mm=[Z("#2f4a3a"),Z("#7a2f27"),Z("#27384f")];var lo=.6;function wt(e,t,n){let r=Math.imul(e|0,374761393)^Math.imul(t|0,668265263)^Math.imul(n|0,2246822519);return r=Math.imul(r^r>>>13,1274126177),((r^r>>>16)>>>0)/4294967296}function uo(e,t){let n=0;for(let o=0;o<e.length;o+=4)n+=e[o];let r=n/(e.length/4);for(let o=0;o<e.length;o+=4){let a=Math.round(Math.max(0,Math.min(255,r+(e[o]-r)*t)));e[o]=e[o+1]=e[o+2]=a}}function co(e,t){let n=new Uint8ClampedArray(I*I*4),r=(o,a,s,i,c)=>{let l=(a*I+o)*4,d=c??[s,s,s];n[l]=d[0],n[l+1]=d[1],n[l+2]=d[2],n[l+3]=i};if(e==="flat")for(let o=0;o<I;o++)for(let a=0;a<I;a++)r(a,o,Math.round((t?.96:.9+(wt(a>>3,o>>3,3)-.5)*.08)*255),255);else if(e==="tile"){let s=I/8,i=I/5;for(let c=0;c<I;c++)for(let l=0;l<I;l++){let d=Math.floor(c/s),u=c%s/s,p=(l+d%2*i*.5)%I,h=Math.floor(p/i),y=p%i/i,M=Math.sin(y*Math.PI),g=t?.92:.7+.22*M-.28*Math.pow(Math.max(0,1-u*3.2),1.5)*0-.22*Math.max(0,(.18-u)/.18);t||(g+=(wt(h,d,7)-.5)*.14);let S=t?u<.07||y<.035||y>.965:!1;r(l,c,Math.round(Math.max(0,Math.min(1,S?.28:g))*255),255)}t||uo(n,lo)}else if(e==="slate"){let s=I/11,i=I/6;for(let c=0;c<I;c++)for(let l=0;l<I;l++){let d=Math.floor(c/s),u=c%s/s,p=(l+d%2*i*.5)%I,h=Math.floor(p/i),y=p%i/i,M=t?.9:.82+(wt(h,d,11)-.5)*.16-.16*Math.max(0,(.16-u)/.16);(y<(t?.05:.025)||u<(t?.09:.04))&&(M=t?.3:M*.7),r(l,c,Math.round(Math.max(0,Math.min(1,M))*255),255)}t||uo(n,lo)}else for(let c=0;c<I;c++)for(let l=0;l<I;l++){let d=l/I,u=c/I,p=d>.2-.06&&d<.8+.06&&u>.2-.06&&u<.82+.06,h=d>.2+.03&&d<.8-.03&&u>.2+.03&&u<.82-.03,y=Math.abs(d-.5)<.018||Math.abs(u-.5)<.018;if(h&&!y){let M=(u-.2)/.6199999999999999,g=t?[150+60*M,200+30*M,235]:[40+80*M*M,55+90*M*M,68+90*M*M];r(l,c,0,0,[g[0],g[1],g[2]])}else if(p)r(l,c,0,0,t?[255,250,240]:[236,232,221]);else{let M=t?.92:.85+(wt(l>>3,c>>3,5)-.5)*.12,g=t&&(l<5||c<5||l>I-6||c>I-6);r(l,c,Math.round((g?.3:M)*255),255)}}return n}function fo(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let d=0;d<336;d+=112)o.drawImage(t,d,l,112,112);else{let l=7,d=()=>(l=l*16807%2147483647)/2147483647;for(let u=0,p=0;p<336;p+=14,u++)for(let h=-(u%2)*24;h<336;h+=48){let y=150+d()*50;o.fillStyle=`rgb(${y},${y*.92},${y*.86})`,o.fillRect(h,p,48,14)}}o.strokeStyle="rgba(235,223,205,0.18)",o.lineWidth=1.7;for(let l=0,d=6;d<336;d+=14,l++){o.beginPath(),o.moveTo(0,d),o.lineTo(336,d),o.stroke();for(let u=l%2*24;u<336;u+=48)o.beginPath(),o.moveTo(u,d),o.lineTo(u,d+14),o.stroke()}let a=o.getImageData(0,0,336,336),s=a.data,i=0;for(let l=0;l<s.length;l+=4)i+=(s[l]+s[l+1]+s[l+2])/3;i/=s.length/4;let c=i>0?Math.min(2.4,225/i):1;for(let l=0;l<s.length;l+=4){let d=(s[l]+s[l+1]+s[l+2])/3,u=Math.min(255,(d+(i-d)*.7)*c);s[l]=s[l+1]=s[l+2]=u,s[l+3]=255}return o.putImageData(a,0,0),r}function mo(e){let t=e.createElement("canvas");t.width=64,t.height=128;let n=t.getContext("2d"),r=n.createLinearGradient(0,0,0,128);return r.addColorStop(0,"#8aa1b0"),r.addColorStop(.5,"#4d606c"),r.addColorStop(1,"#3c474e"),n.fillStyle=r,n.fillRect(0,0,64,128),n.fillStyle="rgba(235,242,248,0.16)",n.beginPath(),n.moveTo(10,0),n.lineTo(34,0),n.lineTo(4,70),n.lineTo(-20,70),n.closePath(),n.fill(),t}function ho(e){let t=e.createElement("canvas");t.width=Se,t.height=Re;let n=t.getContext("2d"),r=n.createImageData(Se,Re);for(let o=0;o<Re;o++)for(let a=0;a<Se;a++){let s=(o*Se+a)*4,i=Zt(a,o);r.data[s]=r.data[s+1]=r.data[s+2]=i,r.data[s+3]=255}return n.putImageData(r,0,0),t}function po(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d");n.fillStyle="#ffffff",n.fillRect(0,0,128,128),n.fillStyle="rgba(0,0,0,0.10)";for(let r=0;r<128;r+=16)n.fillRect(r,0,1.5,128);return t}function bo(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=23,a=()=>(o=o*16807%2147483647)/2147483647;for(let s=0;s<128;s++){let i=(a()-.5)*3;for(let c=0;c<128;c++){let l=(s*128+c)*4,d=a()<.012?-14:0,u=243+(a()-.5)*8+i+d;r.data[l]=r.data[l+1]=r.data[l+2]=u,r.data[l+3]=255}}return n.putImageData(r,0,0),t}function go(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=11,a=()=>(o=o*16807%2147483647)/2147483647;for(let s=0;s<r.data.length;s+=4){let i=228+(a()-.5)*16;r.data[s]=r.data[s+1]=r.data[s+2]=i,r.data[s+3]=255}return n.putImageData(r,0,0),n.fillStyle="rgba(80,70,60,0.18)",n.fillRect(0,0,128,1.5),t}function xt(e,t){let n=co(t,!1),r=Math.round(Math.sqrt(n.length/4)),o=e.createElement("canvas");o.width=o.height=r;let a=o.getContext("2d"),s=a.createImageData(r,r);for(let i=0;i<n.length;i+=4)s.data[i]=n[i],s.data[i+1]=n[i+1],s.data[i+2]=n[i+2],s.data[i+3]=255;return a.putImageData(s,0,0),o}var tl=238;function yo(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let d=0;d<336;d+=112)o.drawImage(t,d,l,112,112);else{let l=13,d=()=>(l=l*16807%2147483647)/2147483647;for(let u=0,p=0;p<336;p+=14,u++)for(let h=-(u%2)*24;h<336;h+=48){let y=165+d()*30;o.fillStyle=`rgb(${y},${y*.93},${y*.88})`,o.fillRect(h,p,48,14)}}o.strokeStyle="rgba(245,240,230,0.26)",o.lineWidth=1.2;for(let l=0,d=6;d<336;d+=14,l++){o.beginPath(),o.moveTo(0,d),o.lineTo(336,d),o.stroke();for(let u=l%2*24;u<336;u+=48)o.beginPath(),o.moveTo(u,d),o.lineTo(u,d+14),o.stroke()}let a=o.getImageData(0,0,336,336),s=a.data,i=0;for(let l=0;l<s.length;l+=4)i+=(s[l]+s[l+1]+s[l+2])/3;i/=s.length/4;let c=i>0?Math.min(2.6,tl/i):1;for(let l=0;l<s.length;l+=4){let d=(s[l]+s[l+1]+s[l+2])/3,u=Math.min(255,(d+(i-d)*.82)*c);s[l]=s[l+1]=s[l+2]=u,s[l+3]=255}return o.putImageData(a,0,0),r}function Mo(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=31,a=()=>(o=o*16807%2147483647)/2147483647;for(let s=0;s<128;s++)for(let i=0;i<128;i++){let c=(s*128+i)*4,l=246+(a()-.5)*3;r.data[c]=r.data[c+1]=r.data[c+2]=l,r.data[c+3]=255}return n.putImageData(r,0,0),t}function wo(e){let t=e.createElement("canvas");t.width=t.height=4;let n=t.getContext("2d");return n.fillStyle="#fff",n.fillRect(0,0,4,4),t}var xo={minFilter:"LinearMipmapLinear",magFilter:"Linear",generateMipmaps:!0};function nl(e,t){let n=t.coarse?128:256,r=e==="facadeCells"?Math.min(t.gpuMaxAnisotropy,t.coarse?4:16):4;return{...xo,cellPx:n,anisotropy:r,tierScale:1}}function rl(e,t){if(!t.enabled||t.coarse||t.tier!=="high")return nl(e,t);let n=Number.isFinite(t.gpuMaxAnisotropy)&&t.gpuMaxAnisotropy>=1?t.gpuMaxAnisotropy:1,r=Number(t.cellPx),o=Number.isInteger(r)&&r>256&&r<=512&&r%32===0?r:256,a=Number(t.facadeAnisotropy),s=e==="facadeCells"?Number.isFinite(a)&&a>=1?Math.min(a,16):4:16;return{...xo,cellPx:o,anisotropy:Math.min(n,s),tierScale:o/256}}function ol(){try{let e=globalThis,t=Number(e.__canalRecallTexAniso??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texAniso"):null)??NaN);return Number.isFinite(t)&&t>=1?t:null}catch{return null}}function sl(){try{let e=globalThis,t=e.__canalRecallTexturePolicy??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texturePolicy"):null);return!(t===!1||t==="0"||t==="false"||t==="off")}catch{return!0}}function al(){try{let e=globalThis,t=Number(e.__canalRecallCellPx??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("cellPx"):null)??NaN);return Number.isFinite(t)&&t>0?t:null}catch{return null}}function il(){let e=globalThis.__canalPerf?.tier;return e==="low"||e==="mid"||e==="high"?e:null}function ll(){return!!globalThis.matchMedia?.("(pointer: coarse)").matches}function So(e,t){return rl(e,{tier:il(),coarse:ll(),gpuMaxAnisotropy:t,enabled:sl(),cellPx:al(),facadeAnisotropy:ol()})}var Ue=(e,t)=>`(${e}.g + 1.0 - ${t}.a)`;function ul(){let e=globalThis;return(e.__canalRecallMaskFormat??new URLSearchParams(e.location?.search??"").get("maskFormat"))==="rg"?"rg":"r8"}function Ro(e,t,n=ul()){let r=t.length>>1;if(e.length!==r*4)throw new Error(`packMask: ${e.length} colour bytes for ${r} mask texels`);if(n==="rg"){for(let a=0;a<r;a++)e[a*4+3]=255;return{colour:e,mask:t,channels:2}}let o=new Uint8Array(r);for(let a=0;a<r;a++)o[a]=t[a*2],e[a*4+3]=255-t[a*2+1];return{colour:e,mask:o,channels:1}}var cl=70,dl=190,fl=.5,vo=15,ko=40;var Rn="12.0";var Ao=[-1,-1];var _o=[-1,-1],Co=()=>[cl,dl,fl],St=e=>Number.isInteger(e)?e.toFixed(1):String(e),$o=`
uniform vec2 roofLayers;
uniform vec3 roofTier;
vec3 roofTierColour(vec3 fine, vec2 uv, float layer, float dist) {
  if (roofLayers.x < 0.0 || layer < roofLayers.x - 0.5 || layer > roofLayers.y - 0.5) return fine;
  float mid = smoothstep(roofTier.x - ${St(vo)}, roofTier.x + ${St(vo)}, dist);
  if (mid <= 0.0) return fine;
  float far = smoothstep(roofTier.y - ${St(ko)}, roofTier.y + ${St(ko)}, dist);
  vec3 coarse = texture(cells, vec3(uv * roofTier.z, layer)).rgb;
  vec3 flatMean = textureLod(cells, vec3(uv, layer), ${Rn}).rgb;
  return mix(mix(fine, coarse, mid), flatMean, far);
}`;var ml={threshold:20,taps:9,spread:1,grad:.85,sdf:1},hl=`
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
}`;function vn(e=ml,t=1){let n=Number.isFinite(t)&&t>0?t:1;return{cellTaps:[e.threshold*n,e.taps,e.spread,e.grad],cellTapsSdf:e.sdf}}var Lo=`${zr}
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
${hl}
#endif
void cellTierSample(vec3 p, float dist, out vec3 c, out vec2 m) {
#ifdef CELL_LOD_BIAS
  vec4 cc = texture(cells, p, cellLodBias); vec2 mm = texture(masks, p, cellLodBias).rg;
#else
  vec4 cc = texture(cells, p); vec2 mm = texture(masks, p).rg;
#endif
  c = cc.rgb; m = vec2(mm.r, ${Ue("mm","cc")});
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
#if defined( FAR_WINDOWS ) && ! defined( CITY_WINDOW_SDF )
  // ?farWindows on a look with painted windows only (storybook, cartoon, ?windowSdf=0): the cell keeps its windows until
  // the screen-footprint tier flattens them; faces with no UV footprint (far prisms, UV 0) still take the depth fade.
  float farWinUv = max(length(dFdx(p.xy)), length(dFdy(p.xy)));
  if (farWinUv <= 0.0) far = max(far, ${pn("dist")});
#else
  far = max(far, ${pn("dist")});
#endif
#endif
#ifdef CELL_TIER_PROBE
  cellFar = far;
#if defined( FAR_WINDOWS ) && defined( CITY_WINDOW_SDF )
  // ?farWindows (look/windowSdf.ts farWindowsEnabled): the analytic windows, which read cellFar, leave with the screen
  // footprint tier only, not with the depth fade's detail blend; faces with no UV footprint (far prisms) keep it.
  if (cellRho > 0.0) cellFar = cellFarTier;
#endif
#endif
#ifdef CELL_TAPS
  // The footprint prefilter (lane R4-D #246): above the threshold the one sample becomes several over the pixel (skipped
  // where the tier or the depth fade has made the texel wholly the mean colour).
  if (far < 1.0) {
    vec2 tdx = dFdx(p.xy), tdy = dFdy(p.xy);
    cellTapW = cellTapsWeight(max(length(tdx), length(tdy)) * float(textureSize(cells, 0).x));
    if (cellTapW > 0.0) {
      vec4 tc; vec2 tm; cellTapsSample(p, tdx, tdy, tc, tm);
      c = mix(c, tc.rgb, cellTapW); m = mix(m, vec2(tm.r, ${Ue("tm","tc")}), cellTapW);
    }
  }
#endif
  if (far <= 0.0) return;
  vec4 fc = textureLod(cells, p, ${Rn}); vec2 fm = textureLod(masks, p, ${Rn}).rg;
  c = mix(c, fc.rgb, far); m = mix(m, vec2(fm.r, ${Ue("fm","fc")}), far);
}`,pl=[1,2];function kn(e,t=pl){return{cellAniso:Number.isFinite(e)&&e>=1?e:1,cellAnisoRule:[1,1,t[0],t[1]]}}var bl=.5,vt={sunAzimuthDeg:215,sunElevationDeg:40,sunColour:"#ffe9cc",sunIntensity:2.15,skyColour:"#e3ebf6",groundColour:"#998a72",skyIntensity:1.75,shadows:!0,shadowMapSize:2048,shadowIntensity:1-bl};var Wm={...vt,...ao};function gl(e,t){let n=e*Math.PI/180,r=t*Math.PI/180;return[Math.sin(n)*Math.cos(r),Math.cos(n)*Math.cos(r),Math.sin(r)]}var Fo=gl(vt.sunAzimuthDeg,vt.sunElevationDeg),kt=(()=>{let e=vt.sunAzimuthDeg*Math.PI/180;return[Math.sin(e),Math.cos(e)]})(),Rt=[kt[0]*.6,kt[1]*.6,.8],To=.84;function Eo(e){let t=e[0]*Rt[0]+e[1]*Rt[1]+e[2]*Rt[2];return Math.max(.5,Math.min(1,.58+.42*Math.max(0,t)))}var yl=Eo([0,0,1]),it=e=>Number.isInteger(e)?e.toFixed(1):String(+e.toFixed(6)),At=`
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = ${it(To)} + ${it(1-To)} * (0.5 + 0.5 * dot(h, vec2(${it(kt[0])}, ${it(kt[1])}))); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, dot(n, vec3(${Rt.map(it).join(", ")}))), 0.5, 1.0);`;var An;function Ml(e,t){let n=e?/[?&]wallRule=(\w+)/.exec(e)?.[1]:void 0,r=n??t??"";return r==="1"||r==="on"||r==="true"}function wl(){if(An!==void 0)return An;let e=globalThis;return An=Ml(e.location?.search??null,e.process?.env?.WALL_RULE??null)}var xl=new Set(["#7a3e2c","#4e3027","#9a5236","#b39468","#6d6560","#2a2a2a","#e6e2d8","#d9ccaa","#9a9a94","#c8bb9c","#ece9e0","#e4dcc4","#26392f","#1e1e1e","#5a2224","#23303f","#7c7f7c","#4a3426","#7a5a3a","#9a5240","#7d7871","#ac624e"]);function Sl(e,t){return t==="measured"?"measured":xl.has(e.toLowerCase())?"guessed":"measured"}function Oo(e,t,n){return!wl()||n==="measured"||e!=="brick"&&e!=="accent"?n:Sl(t,n)==="measured"?"measured":n}var _n={offset:.05,floor:.14,ceil:.6,paleL:.62,buff:{l:.5,s:.3,h:[35,65]},sat:[.12,.5],greyBelowS:.12,profileGain:.4};function Rl(e){let[t,n,r]=O(A(e)),o=_n.buff;return r<_n.paleL&&!(r>=o.l&&n>=o.s&&t>=o.h[0]&&t<=o.h[1])}function Io(e){if(!Rl(e))return null;let[t,n,r]=O(A(e)),o=_n;return T(j([t,n<o.greyBelowS?n:Math.min(o.sat[1],Math.max(o.sat[0],n)),Math.min(o.ceil,Math.max(o.floor,r+o.offset))]))}var Po=[.4,2.5],vl=["brick","accent","stucco"];function kl(e){let t=(e?.white?Sn(e.white):1.106)*(e?.stripOverDrawn??1);return Math.max(Po[0],Math.min(Po[1],t))}var Al=["brick","accent"];function Do(e,t,n,r,o=be()){return o!=="sunny"||r==="measured"?t:n?vl.includes(e)?Ce(t,kl(n)):t:Al.includes(e)?Ce(t,1.106):t}var B=[{name:"magnified (rho < 1)",rgb:[255,0,0]},{name:"rho 1-2",rgb:[255,255,0]},{name:"rho 2-4",rgb:[0,255,0]},{name:"rho 4-8",rgb:[0,255,255]},{name:"rho 8-16",rgb:[0,0,255]},{name:"rho 16-tier",rgb:[255,128,0]},{name:"tier far > 0",rgb:[255,0,255]},{name:"depth-fade far > 0 (tier 0)",rgb:[255,255,255]},{name:"under fade > 0",rgb:[128,0,255]},{name:"roof layer",rgb:[128,128,128]}];var nh=B.length-1,_l=3;var Cl=520,$l=Cl.toFixed(1),Ll=String(_l),N=e=>`vec3(${e.map(t=>(t/255).toFixed(4)).join(", ")})`,No=`
#ifdef CELL_DEBUG_RHO
vec3 cellDebugColour(float layer) {
  if (roofLayers.x >= 0.0 && layer > roofLayers.x - 0.5 && layer < roofLayers.y - 0.5) return ${N(B[9].rgb)};
#if defined(CELL_TIER_ANISO) && defined(CELL_DEBUG_UNDER)
  if (cellFarFlat > 0.001) return ${N(B[6].rgb)};
  if (cellFarTier <= 0.001 && cellFar > 0.001) return ${N(B[7].rgb)};
  if (cellUnder < 0.5) return ${N(B[0].rgb)};
  if (cellUnder < 0.75) return ${N(B[1].rgb)};
  if (cellUnder < 1.0) return ${N(B[2].rgb)};
  if (cellUnder < 1.5) return ${N(B[3].rgb)};
  if (cellUnder < 2.0) return ${N(B[4].rgb)};
  return ${N(B[5].rgb)};
#else
#ifdef CELL_TIER_ANISO
  if (cellFarFlat > 0.001) return ${N(B[6].rgb)};
  if (cellFarUnder > 0.001) return ${N(B[8].rgb)};
#else
  if (cellFarTier > 0.001) return ${N(B[6].rgb)};
#endif
  if (cellFar > 0.001) return ${N(B[7].rgb)};
  if (cellRho < 1.0) return ${N(B[0].rgb)};
  if (cellRho < 2.0) return ${N(B[1].rgb)};
  if (cellRho < 4.0) return ${N(B[2].rgb)};
  if (cellRho < 8.0) return ${N(B[3].rgb)};
  if (cellRho < 16.0) return ${N(B[4].rgb)};
  return ${N(B[5].rgb)};
#endif
}
#endif`;function je(e){try{return typeof URLSearchParams=="function"?new URLSearchParams(globalThis.location?.search??"").get(e):null}catch{return null}}var Tl=1.25,Bo=[2.5,5],Fl={footprint:1,fadePx:[2,4],frameMinPx:0,barPx:[0,0],tent:!0};function El(){let t=globalThis.__canalRecallWindowSdfBand??je("windowSdfBand");return!(t===!1||t==="0"||t==="false"||t==="off")}var _t=(e,t)=>{if(e==null)return null;let n=e.split(",").map(Number);return n.length===t&&n.every(r=>Number.isFinite(r)&&r>=0)?n:null};function Ol(){let e=Fl,t=_t(je("windowSdfFoot"),1)?.[0]??e.footprint,n=_t(je("windowSdfFade"),2)??e.fadePx,r=_t(je("windowSdfFrameMin"),1)?.[0]??e.frameMinPx,o=_t(je("windowSdfBar"),2)??e.barPx,a=je("windowSdfTent"),s=a==null?e.tent:a==="1";return{band:[El()?1:0,t,n[0],n[1]],shape:[r,o[0],o[1],s?1:0]}}var Cn=null;function Wo(){let e=`${globalThis.location?.search??""}|${String(globalThis.__canalRecallWindowSdfBand)}`;Cn?.key!==e&&(Cn={key:e,v:Ol()});let t=Cn.v;return{windowSdfBand:{value:[...t.band]},windowSdfShape:{value:[...t.shape]}}}var le=["#6f8796","#2f4350","#1d2a33"],Ct=e=>N([parseInt(e.slice(1,3),16),parseInt(e.slice(3,5),16),parseInt(e.slice(5,7),16)]),Ho=`
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
  vec2 cell = vec2(${$l}, head.y);
  vec2 p = fract(uv) * cell;
  // The pixel's footprint from the continuous uv (fract jumps at the cell seam), in canvas px per framebuffer px.
  vec2 fpx = max(fwidth(uv * cell), vec2(1e-3));
  vec2 fw = fpx * (band ? windowSdfBand.y : ${Tl.toFixed(2)});
#ifdef CELL_TAPS
  // The footprint prefilter's taps (roofTier.ts, lane R4-D #246) widen the edge box with the wall under the windows.
  fw *= mix(1.0, cellTapsSdf, cellTapW);
#endif
  vec2 fade = band ? windowSdfBand.zw : vec2(${Bo[0].toFixed(1)}, ${Bo[1].toFixed(1)});
  for (int i = 0; i < ${Ll}; i++) {
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
    vec3 gc = g < 0.55 ? mix(${Ct(le[0])}, ${Ct(le[1])}, g / 0.55) : mix(${Ct(le[1])}, ${Ct(le[2])}, (g - 0.55) / 0.45);
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
#endif`;var Dl=["default","osm","3dbag","ahn","pdok-ortho","vision-judge","bag","monument-text","streetlevel-measured","reviewed"],Th=new Map(Dl.map((e,t)=>[e,t]));var P=["reviewed","default"],Ih={plotWidthM:["bag","3dbag","streetlevel-measured",...P],depthM:["bag","3dbag",...P],eavesHeightM:["ahn","3dbag","streetlevel-measured",...P],ridgeHeightM:["ahn","3dbag","streetlevel-measured",...P],ridgeSagM:["ahn","streetlevel-measured",...P],storeys:["3dbag","osm","monument-text","streetlevel-measured",...P],storeyHeights:["streetlevel-measured",...P],hasSouterrain:["osm","monument-text","streetlevel-measured",...P],hasBelEtage:["osm","monument-text","streetlevel-measured",...P],gable:["monument-text","streetlevel-measured",...P],gableOrnament:["monument-text","streetlevel-measured",...P],corniceType:["monument-text","streetlevel-measured",...P],dressings:["monument-text","streetlevel-measured",...P],windowType:["monument-text","streetlevel-measured",...P],puiType:["monument-text","streetlevel-measured",...P],hoistBeam:["monument-text","streetlevel-measured",...P],bays:["monument-text","streetlevel-measured",...P],bayOffsetsM:["streetlevel-measured",...P],doorPositionM:["streetlevel-measured",...P],hoistBeamOffsetM:["streetlevel-measured",...P],leanDeg:["streetlevel-measured",...P],brick:["streetlevel-measured",...P]};var ap=Object.freeze({shell:"3",roof:"11",frontage:"4",opening:"20",glazedBay:"1",facadeDetail:"11",ornament:"2",dormer:"8",nativeAperture:"1",cornice:"6",crown:"5",entrance:"9",hoist:"1"});var Pp={jamb:.32,out:2*W,entH:.42,maxTympanumH:1.4};var Nl=.012,Dp=W-Nl,Bp=2*W;var Np={postW:.14,postOut:3*W,railH:.12,railOut:2*W,maxSegM:9};var Wl={postW:.1,postOut:3*W,railH:.1,railOut:2*W,maxSegM:9};var Wp={back:W,out:2*W,minH:.15},Hp={...Wl,postOut:4*W,railOut:3*W};var Hl={from:.15,to:.92,joint:.06,back:W,out:2*W,minW:.4};var Gp={post:.24,postOut:4*W,sillH:.12,sillOut:.15,headGap:.06,maxSegM:9};var Up={bayOut:.45,flushOut:2*W,post:.18,slabH:.18,transomH:.1,slabOverhang:.18,maxSegM:9,postOut:2*W,slabOut:4*W};var $n={horizontalBars:[.25,.5,.75],horizontalBarWidthsM:[.03,.06,.03],mullionWidthM:.03},dg={sash:{verticalBars:[.5],horizontalBars:[.55]},"two-light":{verticalBars:[.5],horizontalBars:[.8]},"sash-small-panes":{verticalBars:[1/3,2/3],horizontalBars:[.25,.5,.75]},cross:{verticalBars:[.5],horizontalBars:[.36]},plain:{},arched:{verticalBars:[.5],horizontalBars:[.55]},shop:{},ladder:{horizontalBars:[.2,.4,.6,.8]},"sash-6-over-6":{verticalBars:[1/3,2/3],...$n},"sash-8-over-8":{verticalBars:[.25,.5,.75],...$n},"sash-4-over-4":{verticalBars:[.5],...$n},"sash-1-over-1":{horizontalBars:[.5],horizontalBarWidthsM:[.06]},"sash-9-over-9":{verticalBars:[1/3,2/3],horizontalBars:[1/6,1/3,.5,2/3,5/6],horizontalBarWidthsM:[.03,.03,.06,.03,.03],mullionWidthM:.03},"six-pane":{verticalBars:[.5],horizontalBars:[1/3,2/3],mullionWidthM:.045},"t-window":{horizontalBars:[.76],horizontalBarWidthsM:[.07],diagonalBars:[[[.5,.05],[.5,.73]]]},"small-over-one":{verticalBars:[.5],horizontalBars:[.62,.81],horizontalBarWidthsM:[.06,.03],mullionWidthM:.045,diagonalBars:[[[1/3,.65],[1/3,.95]],[[2/3,.65],[2/3,.95]]]},"cross-transom":{verticalBars:[.5],horizontalBars:[.6],horizontalBarWidthsM:[.07],diagonalBars:[[[.25,.05],[.25,.95]],[[.75,.05],[.75,.95]],[[.05,.3],[.95,.3]],[[.05,.8],[.95,.8]]]},"casement-toplight":{verticalBars:[.5],horizontalBars:[.8],horizontalBarWidthsM:[.05],mullionWidthM:.05},"casement-transom":{horizontalBars:[.8],horizontalBarWidthsM:[.05]},"casement-gridded-toplight":{verticalBars:[.5],horizontalBars:[.8],horizontalBarWidthsM:[.05],mullionWidthM:.05,diagonalBars:[[[.25,.81],[.25,.95]],[[.75,.81],[.75,.95]]]},"casement-triple":{verticalBars:[.27,.73],mullionWidthM:.05},"casement-toplight-double":{verticalBars:[.25,.5,.75],horizontalBars:[.8],horizontalBarWidthsM:[.05],mullionWidthM:.05},"casement-gridded-toplight-double":{verticalBars:[.25,.5,.75],horizontalBars:[.8],horizontalBarWidthsM:[.05],mullionWidthM:.05,diagonalBars:[.125,.375,.625,.875].map(e=>[[e,.81],[e,.95]])},"casement-pair":{verticalBars:[.5],mullionWidthM:.05},"casement-small-panes":{verticalBars:[.25,.5,.75],horizontalBars:[.36,.8],horizontalBarWidthsM:[.03,.05],mullionWidthM:.05},"casement-sidelights-toplight":{verticalBars:[.14,.86],horizontalBars:[.86],horizontalBarWidthsM:[.035],mullionWidthM:.035}};var Vo=["spout","neck","raised-neck","bell","step","point","cornice","flat","shouldered"];var zo=["slate","black-tile","red-tile","bitumen","zinc","copper"];var Ln=64;var U1=[...zo,"flat-bitumen","unknown"];var qo={canal:2.5,c19:2.2,school:1.6,postwar:1.8,modern:2.1,tower:1.5},m=(e,t,n,r,o)=>({name:e,kind:t,byte:n,...r!==void 0?{bit:r,width:o}:{}}),Tn=[m("wall","rgb",0),m("wallMaterial","bits",3,0,4),m("wallSrc","bits",3,4,2),m("lifted","bits",3,6,1),m("frame","rgb",4),m("frameSrc","bits",7,0,2),m("glassTone","bits",7,2,3),m("style","bits",7,5,3),m("wallHcm","u16",8),m("plinthDm","u8",10),m("seed","u8",11),m("roof","rgb",12),m("roofMaterial","bits",15,0,4),m("roofSrc","bits",15,4,2),m("lid","bits",15,6,1),m("storeys","u8",16),m("groundDm","u8",17),m("upperDm","u8",18),m("atticDm","u8",19),m("baysGround","u8",20),m("baysUpper","u8",21),m("baysAttic","u8",22),m("doorBay","u8",23),m("windowKind","u8",24),m("windowHead","bits",25,0,3),m("archRing","bits",25,3,2),m("keystone","bits",25,5,1),m("tympanum","bits",25,6,2),m("windowShare","u8",26),m("windowHeightQ","u8",27),m("cornice","bits",28,0,3),m("corniceDepthDm","bits",28,3,3),m("hoist","bits",28,6,1),m("shutters","bits",28,7,1),m("basement","bits",29,0,2),m("souterrain","bits",29,2,1),m("stoop","bits",29,3,1),m("balconies","bits",29,4,1),m("bayWindow","bits",29,5,1),m("tallGround","bits",29,6,1),m("dormers","bits",29,7,1),m("statedMask","u8",30),m("mirrored","bits",31,0,1),m("shareQ","bits",31,1,7),m("accent","rgb",32),m("bands","bits",35,0,3),m("bandLines","bits",35,3,3),m("sills","bits",35,6,1),m("quoins","bits",35,7,1),m("spekSpacing","u8",36),m("spekCourses","u8",37),m("surround","bits",38,0,3),m("archRingColour","bits",38,3,2),m("quoinsKind","bits",38,5,2),m("bandSillCm","u8",39),m("bandHeadCm","u8",40),m("bandTransomAt","u8",41),m("band","rgb",42),m("bandsSrc","bits",45,0,2),m("surroundSrc","bits",45,2,2),m("keystoneSrc","bits",45,4,2),m("quoinsSrc","bits",45,6,2),m("windowRevealCm","u8",46),m("doorRevealCm","u8",47),m("groundKind","bits",48,0,4),m("groundSrc","bits",48,4,2),m("awning","bits",48,6,1),m("stallriserOn","bits",48,7,1),m("entrance","bits",49,0,3),m("glazing","bits",49,3,2),m("stallriser","bits",49,5,2),m("fasciaOn","bits",49,7,1),m("fascia","rgb",50),m("shopPaint","rgb",53),m("displayWindows","u8",56),m("fasciaHeightDm","u8",57),m("stallriserDm","u8",58),m("shopStoreys2","bits",59,0,1),m("souterrainUnderStoop","bits",59,1,1),m("ribbonStorey1","bits",59,2,1),m("door","rgb",60)],j1=new Map(Tn.map(e=>[e.name,e]));var R=e=>Number.isInteger(e)?e.toFixed(1):String(e),Tt=e=>`vec3(${[1,3,5].map(t=>(parseInt(e.slice(t,t+2),16)/255).toFixed(5)).join(", ")})`;function Ul(){let e=t=>`((frT${t>>4}[${t>>2&3}] >> ${(t&3)*8}u) & 255u)`;return Tn.map(t=>t.kind==="rgb"?`vec3 fr_${t.name}() { return vec3(float(${e(t.byte)}), float(${e(t.byte+1)}), float(${e(t.byte+2)})) / 255.0; }`:t.kind==="u16"?`float fr_${t.name}() { return float(${e(t.byte)} | (${e(t.byte+1)} << 8u)); }`:t.kind==="u8"?`float fr_${t.name}() { return float(${e(t.byte)}); }`:`float fr_${t.name}() { return float((${e(t.byte)} >> ${t.bit}u) & ${(1<<t.width)-1}u); }`).join(`
`)}var jl=`float frPitch(float style) { ${at.map((e,t)=>`if (style < ${R(t+.5)}) return ${R(qo[e])};`).join(" ")} return 2.0; }`,Vl=1;var ue=.0625,Ve=.22,ze=.012,Jo=1.35,zl=.14,Ko=ze/ue+ze/Ve-ze/ue*(ze/Ve),ql=Ko*Jo+(1-Ko),Yo=[1,0,.35,0,0,0,0],Kl=.6,Fn=.125,Xo=.22,Zo=[.55,.7],Yl=.5,$e=[[1,2,0,0,0],[3,4,0,0,0],[2,2,0,0,0],[1,1,0,0,0],[2,1,0,0,0],[1,1,0,0,0],[2,1,0,0,0],[1,5,0,0,0],[3,4,0,0,0],[4,4,0,0,0],[3,6,0,0,0],[2,3,0,0,0],[2,1,1,1,.3],[1,1,4,1,.3],[2,1,2,1,.3],[2,1,1,1,.25],[2,1,2,1,.25],[2,1,4,2,.3],[3,1,3,1,.25],[2,1,2,1,.25],[2,1,6,2,.3],[2,1,0,0,0],[2,4,0,0,0],[3,1,1,1,.25]],Ft=.04,Xl=.45,Et=[0,.25,.4,.55,.5],Zl=e=>e.map(t=>`vec4(${t.map(R).join(", ")})`).join(", "),Jl=`
const vec4 FR_PANES[${$e.length}] = vec4[${$e.length}](${Zl($e.map(e=>e.slice(0,4)))});
const float FR_PANE_TOP[${$e.length}] = float[${$e.length}](${$e.map(e=>R(e[4])).join(", ")});
// Bars dividing [a, b] into n parts (n - 1 bars of FR_BAR), box-filtered; their area share once a part is under a pixel.
float frBars(float x, float a, float b, float n, float fw) {
  if (n < 1.5) return 0.0;
  float part = (b - a) / n, t = (x - a) / part, d = abs(t - floor(t + 0.5)) * part;
  if (t < 0.5 || t > n - 0.5) return 0.0;
  float c = clamp(0.5 + (${R(Ft/2)} - d) / fw, 0.0, 1.0);
  return mix(c, ${R(Ft)} / part, smoothstep(0.5 * part, part, fw));
}
// Glazing bars of a window kind over the pane [x0, x1] x [y0, y1]; a transom bar under the toplight.
float frGlazing(vec2 p, vec2 fw, float x0, float x1, float y0, float y1, float kind) {
  int k = int(clamp(kind, 0.0, ${R($e.length-1)}) + 0.5);
  vec4 g = FR_PANES[k]; float top = FR_PANE_TOP[k];
  float split = top > 0.0 ? y1 - (y1 - y0) * top : y1;
  float c;
  if (p.y < split) c = max(frBars(p.x, x0, x1, g.x, fw.x), frBars(p.y, y0, split, g.y, fw.y));
  else c = max(frBars(p.x, x0, x1, g.z, fw.x), frBars(p.y, split, y1, g.w, fw.y));
  if (top > 0.0) c = max(c, frCover(p.y, split - ${R(Ft/2)}, split + ${R(Ft/2)}, fw.y));
  return c;
}
// The reveal's shadow on the glass: a strip along the head and the left jamb as deep as the reveal (sun from the upper left).
float frReveal(vec2 p, vec2 fw, float x0, float y1, float depth) {
  return max(frCover(p.x, x0, x0 + depth, fw.x), frCover(p.y, y1 - depth, y1, fw.y)) * ${R(Xl)};
}
float frHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// Brick coursing, mean 1 over the wall; it fades to its mean as a course falls under about two pixels. Brick patches
// (two bricks x two courses) carry the brick's texture further out (FR_MOTTLE, S6c).
float frBrick(vec2 w, vec2 fw, float material, float contrast) {
  float amp = material < 0.5 ? ${R(Yo[0])} : (material > 1.5 && material < 2.5 ? ${R(Yo[2])} : 0.0);
  if (amp <= 0.0) return 1.0;
  float prow = floor(w.y / ${R(Fn)}), pcol = floor((w.x + mod(prow, 2.0) * ${R(.5*Xo)}) / ${R(Xo)});
  float brickPatch = 1.0 + amp * contrast * ${R(Kl)} * (frHash(vec2(prow * 7.0 + 3.0, pcol * 3.0 + 11.0)) - 0.5)
    * (1.0 - smoothstep(${R(.3*Fn)}, ${R(.5*Fn)}, max(fw.x, fw.y)));
  amp *= contrast * (1.0 - smoothstep(${R(.25*ue)}, ${R(.6*ue)}, max(fw.x, fw.y)));
  if (amp <= 0.0) return brickPatch;
  float row = floor(w.y / ${R(ue)}), yy = w.y - row * ${R(ue)};
  float x = w.x + mod(row, 2.0) * ${R(.5*Ve)}, col = floor(x / ${R(Ve)}), xx = x - col * ${R(Ve)};
  float joint = max(1.0 - frCover(yy, ${R(ze)}, ${R(ue)}, fw.y), 1.0 - frCover(xx, ${R(ze)}, ${R(Ve)}, fw.x));
  float tone = 1.0 + (frHash(vec2(row, col)) - 0.5) * ${R(zl)};
  return brickPatch * (1.0 + amp * (mix(tone, ${R(Jo)}, joint) / ${R(ql)} - 1.0));
}
// Speklagen: spekCourses stone courses every spekSpacing + spekCourses courses, averaged when under a pixel.
float frSpek(float y, vec2 fw) {
  float s = fr_spekSpacing(), n = fr_spekCourses();
  if (s < 0.5 || n < 0.5) return 0.0;
  float per = (s + n) * ${R(ue)}, h = n * ${R(ue)};
  return mix(frCover(mod(y, per), 0.0, h, fw.y), h / per, smoothstep(0.5 * per, per, fw.y));
}
// Band lines of a storey: bandLines (sill 1, transom 2, head 4) when stated, else by the band kind.
float frBandLines(float sv, float sh, float y0, float y1, float storey, vec2 fw) {
  float b = fr_bands();
  if (b < 0.5 || (b > 4.5 && b < 5.5)) return 0.0;
  float l = fr_bandLines();
  // Unstated lines: a storey band (storey, both, courses, painted) is the string course at each upper floor.
  bool floorLine = l < 0.5 && (b < 1.5 || (b > 2.5 && b < 4.5) || b > 5.5);
  bool sill = l > 0.5 && mod(l, 2.0) > 0.5;
  bool transom = l > 0.5 && mod(floor(l / 2.0), 2.0) > 0.5;
  bool head = l > 0.5 ? l > 3.5 : (b > 1.5 && b < 4.5);
  float hs = fr_bandSillCm() * 0.01, hh = fr_bandHeadCm() * 0.01, c = 0.0;
  if (sill && storey > 0.5) c = max(c, frCover(sv, y0 - hs, y0, fw.y));
  if (floorLine && storey > 0.5) c = max(c, frCover(sv, 0.0, hs, fw.y));
  if (head) c = max(c, frCover(sv, y1, y1 + hh, fw.y));
  if (transom) { float t = y0 + (y1 - y0) * fr_bandTransomAt() / 255.0; c = max(c, frCover(sv, t - 0.04, t + 0.04, fw.y)); }
  return c;
}
// The window's stone (WINDOW_SURROUNDS: 1 stone-lintel, 2 full-frame, 3 keystone, 4 sill, 5 eared-keystone; sills, keystone).
float frSurround(vec2 p, vec2 fw, float x0, float x1, float y0, float y1, float head, float rise) {
  float s = fr_surround(), c = 0.0;
  if (s > 0.5 && s < 1.5) c = max(c, frCover(p.x, x0 - 0.08, x1 + 0.08, fw.x) * frCover(p.y, y1, y1 + 0.16, fw.y));
  if ((s > 1.5 && s < 2.5) || s > 4.5) c = max(c, frOpening(p, fw, x0 - 0.09, x1 + 0.09, y0 - 0.09, y1 + 0.09, head, rise) - frOpening(p, fw, x0, x1, y0, y1, head, rise));
  if (fr_sills() > 0.5 || (s > 3.5 && s < 4.5)) c = max(c, frCover(p.x, x0 - 0.06, x1 + 0.06, fw.x) * frCover(p.y, y0 - 0.08, y0, fw.y));
  if (fr_keystone() > 0.5 || (s > 2.5 && s < 3.5) || s > 4.5) { float xc = 0.5 * (x0 + x1); c = max(c, frCover(p.x, xc - 0.09, xc + 0.09, fw.x) * frCover(p.y, y1 - 0.02, y1 + 0.2, fw.y)); }
  return c;
}
// The eaves cornice band: CORNICES height under the wall top, a shadow line under it.
float frCornice(float y, vec2 fw) {
  int k = int(fr_cornice() + 0.5);
  float h = k == 1 ? ${R(Et[1])} : k == 2 ? ${R(Et[2])} : k == 3 ? ${R(Et[3])} : k == 4 ? ${R(Et[4])} : 0.0;
  if (h <= 0.0) return 0.0;
  float top = fr_wallHcm() * 0.01;
  return frCover(y, top - h, top, fw.y);
}
// Quoins: stones 0.25 m high at both ends of a front, alternately 0.45 and 0.3 m deep into the wall.
float frQuoin(vec2 w, float len, vec2 fw) {
  float k = floor(w.y / 0.25), d = mod(k, 2.0) < 0.5 ? 0.45 : 0.3;
  float joint = frCover(w.y - k * 0.25, 0.015, 0.25, fw.y);
  return max(frCover(w.x, 0.0, d, fw.x), frCover(w.x, len - d, len, fw.x)) * joint;
}
`,Qo=`
attribute vec3 wall;
attribute float rec;
attribute float wallKind;
uniform float wallUnit;
varying vec3 vWall;
flat varying float vRec;
flat varying float vWallKind;
`,es=`
vWall = wall * wallUnit; vRec = rec; vWallKind = wallKind;
`,ts=`
precision highp usampler2D;
uniform usampler2D facadeRecords;
uniform float recBase;
uniform vec4 facadeKnobs;
varying vec3 vWall;
flat varying float vRec;
flat varying float vWallKind;
uvec4 frT0, frT1, frT2, frT3;
void frFetch(float rec) {
  int r = int(rec + 0.5);
  ivec2 at = ivec2((r % ${Ln}) * 4, int(recBase + 0.5) + r / ${Ln});
  frT0 = texelFetch(facadeRecords, at, 0); frT1 = texelFetch(facadeRecords, at + ivec2(1, 0), 0);
  frT2 = texelFetch(facadeRecords, at + ivec2(2, 0), 0); frT3 = texelFetch(facadeRecords, at + ivec2(3, 0), 0);
}
${Ul()}
${jl}
// Coverage of [a, b] by a box pixel of width fw centred at x (windowSdf.ts wsCover, box mode).
float frCover(float x, float a, float b, float fw) { return clamp((min(b, x + 0.5 * fw) - max(a, x - 0.5 * fw)) / fw, 0.0, 1.0); }
// Coverage of an opening [x0, x1] x [y0, top(x)]; head 1 segmental (rise), 2 round.
float frOpening(vec2 p, vec2 fw, float x0, float x1, float y0, float y1, float head, float rise) {
  float cx = frCover(p.x, x0, x1, fw.x);
  if (head > 1.5 && head < 2.5) {
    float r = 0.5 * (x1 - x0), cy = y1 - r;
    float below = frCover(p.y, y0, cy, fw.y);
    float d = length(p - vec2(x0 + r, cy)) - r, fwr = max(0.5 * (fw.x + fw.y), 1e-4);
    float above = p.y > cy ? clamp(0.5 - d / fwr, 0.0, 1.0) : 0.0;
    return max(cx * below, above * frCover(p.y, cy, y1, fw.y));
  }
  float top = y1;
  if (head > 0.5 && head < 1.5) { float s = clamp((p.x - x0) / max(x1 - x0, 1e-4), 0.0, 1.0); top = y1 - rise + 4.0 * rise * s * (1.0 - s); }
  return cx * frCover(p.y, y0, top, fw.y);
}
vec3 frGlass(float g) {
  return g < 0.55 ? mix(${Tt(le[0])}, ${Tt(le[1])}, g / 0.55) : mix(${Tt(le[1])}, ${Tt(le[2])}, (g - 0.55) / 0.45);
}
${Jl}
vec3 facadeRecordColour(out vec2 m) {
  frFetch(vRec);
  vec2 w = vWall.xy;
  vec2 fw = max(fwidth(w), vec2(1e-4));
  float kind = vWallKind - 8.0 * step(7.5, vWallKind);
  bool front = kind < 0.5;
  m = vec2(1.0, 0.0);
  if (kind > 6.5) { m = vec2(0.0); return fr_roof(); }
  // The wall: the record colour at the atlas wall's mean (lookParity), brick coursing around it, speklagen over it.
  vec3 wl = pow(fr_wall(), vec3(2.2));
  float paleK = mix(1.0, ${R(Yl)}, smoothstep(${R(Zo[0])}, ${R(Zo[1])}, pow(dot(wl, vec3(0.2126, 0.7152, 0.0722)), 1.0 / 3.0)));
  vec3 wallC = fr_wall() * ${R(Vl)} * frBrick(w, fw, fr_wallMaterial(), facadeKnobs.x * paleK);
  float spek = frSpek(w.y, fw);
  vec3 bandC = fr_band();
  wallC = mix(wallC, bandC, spek); m.r = 1.0 - spek;
  if (kind > 2.5 && kind < 5.5 || kind > 5.5) return wallC;      // party wall, exposed strip, chamfer, crown field: blank
  float plinth = fr_plinthDm() * 0.1, groundH = max(fr_groundDm() * 0.1, 0.5), upperH = max(fr_upperDm() * 0.1, 0.5);
  float atticH = fr_atticDm() * 0.1, storeys = max(fr_storeys(), 1.0);
  float v = w.y - plinth;
  if (v < 0.0 || w.y > fr_wallHcm() * 0.01) return wallC;          // plinth band; the crown above the eaves
  // The eaves cornice as a band under the wall top (S6b; the projecting ledge is S7's crown instance).
  float corn = front ? frCornice(w.y, fw) : 0.0;
  if (corn > 0.0) { wallC = mix(wallC, fr_accent(), corn); m.r *= 1.0 - corn; if (corn > 0.999) return wallC; }
  float storey, sv, sh;
  if (v < groundH) { storey = 0.0; sh = groundH; sv = v; }
  else {
    float u = (v - groundH) / upperH; storey = 1.0 + floor(u); sh = upperH; sv = (u - floor(u)) * upperH;
    if (atticH > 0.0 && storey >= storeys - 1.0) { storey = storeys - 1.0; sh = atticH; sv = v - groundH - (storeys - 2.0) * upperH; }
  }
  if (storey > storeys - 0.5) return wallC;
  float len = max(vWall.z, 1e-3), pitch = frPitch(fr_style());
  float bays = front ? (storey < 0.5 ? fr_baysGround() : (atticH > 0.0 && storey > storeys - 1.5 && fr_baysAttic() > 0.0 ? fr_baysAttic() : fr_baysUpper())) : 0.0;
  if (bays < 0.5) bays = max(1.0, floor(len / pitch + 0.5));
  float bw = len / bays, bay = floor(w.x / bw), bx = w.x - bay * bw;
  vec3 accentC = fr_accent();
  // Quoins: alternating stones at both ends of a front (stated only).
  if (front && fr_quoins() > 0.5) { float q = frQuoin(w, len, fw); wallC = mix(wallC, accentC, q); m.r *= 1.0 - q; }
  // The door: a front's ground storey, in doorBay (254: the bay nearest the centre; 255 none).
  float doorBay = fr_doorBay(), door = doorBay > 253.5 && doorBay < 254.5 ? floor((bays - 1.0) * 0.5) : doorBay;
  vec2 p = vec2(bx, sv);
  // A shop ground storey (groundKind shop / pui-glazed): stallriser, display glass and fascia across the front (S6b
  // generic; F2 replaces this with the measured pui).
  float gk = fr_groundKind();
  if (front && storey < 0.5 && (abs(gk - 1.0) < 0.5 || abs(gk - 6.0) < 0.5) && !(abs(bay - door) < 0.5 && doorBay < 254.5)) {
    float riser = fr_stallriserOn() > 0.5 || gk < 1.5 ? fr_stallriserDm() * 0.1 : 0.0, fascia = fr_fasciaOn() > 0.5 || gk < 1.5 ? max(fr_fasciaHeightDm() * 0.1, 0.3) : 0.0;
    float top = sh - fascia;
    float fasc = frCover(sv, top, sh, fw.y), glass = frOpening(p, fw, 0.08, bw - 0.08, riser, top - 0.08, 0.0, 0.0);
    vec3 c = mix(wallC, fr_shopPaint(), max(fasc, frCover(sv, 0.0, riser, fw.y)));
    c = mix(c, fr_fascia(), fasc);
    c = mix(c, frGlass(clamp((top - sv) / max(top - riser, 0.1), 0.0, 1.0)), glass);
    m = vec2(m.r * (1.0 - max(glass, max(fasc, frCover(sv, 0.0, riser, fw.y)))), 0.0);
    return c;
  }
  float share = fr_windowShare() / 255.0, winH = fr_windowHeightQ() / 255.0;
  vec3 frame = fr_frame();
  if (front && storey < 0.5 && abs(bay - door) < 0.5 && doorBay < 254.5) {
    float dw = min(1.2, bw * 0.7), x0 = 0.5 * (bw - dw), dh = min(sh * 0.85, 2.6);
    float o = frOpening(p, fw, x0, x0 + dw, 0.0, dh, 0.0, 0.0), leaf = frOpening(p, fw, x0 + 0.06, x0 + dw - 0.06, 0.0, dh - 0.06, 0.0, 0.0);
    vec3 c = mix(wallC, frame, o); c = mix(c, fr_door(), leaf);
    m = vec2(m.r * (1.0 - o), 0.0);
    return c;
  }
  // One window per bay, centred: width share x bay, height winH x storey, its top under the storey's head line.
  float ww = clamp(share, 0.15, 0.9) * bw, wh = clamp(winH, 0.2, 0.92) * sh;
  float x0 = 0.5 * (bw - ww), y0 = max(0.25, (sh - wh) * 0.55), y1 = min(sh - 0.1, y0 + wh);
  float head = fr_windowHead(), rise = head > 0.5 && head < 1.5 ? min(0.1 * ww, 0.15) : 0.0;
  if (head > 1.5 && head < 2.5) y1 = max(y1, y0 + 0.5 * ww + 0.2);
  float hd = head > 2.5 ? 0.0 : head;
  // Storey bands at the sill / head lines, then the window's own stone: lintel, frame, sill, keystone.
  float bnd = frBandLines(sv, sh, y0, y1, storey, fw);
  float acc = max(bnd, frSurround(p, fw, x0, x0 + ww, y0, y1, hd, rise));
  wallC = mix(wallC, bnd > 0.0 ? bandC : accentC, acc); m.r *= 1.0 - acc;
  float outer = frOpening(p, fw, x0, x0 + ww, y0, y1, hd, rise);
  if (outer <= 0.0) return wallC;
  float fr = min(0.07, 0.12 * ww);
  float pane = frOpening(p, fw, x0 + fr, x0 + ww - fr, y0 + fr, y1 - fr, hd, rise);
  float g = clamp((y1 - p.y) / max(y1 - y0, 1e-3), 0.0, 1.0);
  vec3 c = mix(wallC, frame, outer);
  vec3 glassC = frGlass(g) * (1.0 - frReveal(p, fw, x0 + fr, y1 - fr, fr_windowRevealCm() * 0.01 * facadeKnobs.y));
  glassC = mix(glassC, frame, frGlazing(p, fw, x0 + fr, x0 + ww - fr, y0 + fr, y1 - fr, fr_windowKind()));
  c = mix(c, glassC, pane);
  m = vec2(m.r * (1.0 - outer), 0.0);
  return c;
}
`;var ay=[...Vo,"cornice-ledge"];var eu=["STRS","FOOT","ATTR","STYL","ROOF","GRP ","HIDE","SHEL","SHL1","FREC","CROW"],hy=eu.slice(0,7);var Cy=2**-17;var tu=["kind","index","dup","xyCode","dx","dy","quadZ","quadH","quadU","quadDu","quadV","quadDv","z","u","v","layer","shade","colourSame","colour","bids"],$y=[...tu,"thinCm","thinClass"];var ns=.02;var nu="glassReflect";function rs(e){try{let t=globalThis;if(e===void 0&&typeof t.__canalRecallGlassReflect=="boolean")return t.__canalRecallGlassReflect;let n=e??t.location?.search;return n!==void 0?new URLSearchParams(n).get(nu)!=="0":t.process?.env?.GLASS_REFLECT!=="0"}catch{return!0}}var En="glassFinish",ru=["reflective"],os=e=>typeof e=="string"&&ru.includes(e),J={f0:.6,metalness:.2,roughness:.12,skyline:.14,street:-.2,glintPeak:3,clouds:.55},qe={zenith:Mt.zenith,horizon:Mt.horizon,facades:"#69635c",street:"#8f887c",sun:"#fff4e2",cloud:"#e9edf0"},ou=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},Ke=e=>[1,3,5].map(t=>ou(parseInt(e.slice(t,t+2),16))),Ye={zenith:Ke(qe.zenith),horizon:Ke(qe.horizon),facades:Ke(qe.facades),street:Ke(qe.street),sun:Ke(qe.sun),cloud:Ke(qe.cloud)},su=e=>.03+.5*e,au=e=>2/Math.max(e*e,.001);var K=e=>Number.isInteger(e)?e.toFixed(1):String(+e.toFixed(6)),Le=e=>`vec3(${e.map(K).join(", ")})`,ss=`
vec3 cityGlassEnv(vec3 r) {
  float w = ${K(su(J.roughness))};
  float up = smoothstep(${K(J.skyline)}, 1.0, r.z);
  float skyK = smoothstep(${K(J.skyline)} - w, ${K(J.skyline)} + w, r.z);
  float lowK = smoothstep(${K(J.street)} - w, ${K(J.skyline)}, r.z);
  float ck = 3.0 / (max(r.z, 0.0) + 0.3);
  vec2 cp = r.xy * ck;
  float cc = smoothstep(0.45, 0.85, 0.5 + 0.25 * (sin(cp.x * 1.7 + sin(cp.y * 2.3)) + sin(cp.y * 1.3 + sin(cp.x * 2.9 + 1.0))));
  vec3 s = mix(mix(${Le(Ye.horizon)}, ${Le(Ye.zenith)}, up), ${Le(Ye.cloud)}, ${K(J.clouds)} * (skyK > 0.0 ? cc : 0.0));
  vec3 b = mix(${Le(Ye.street)}, ${Le(Ye.facades)}, lowK);
  return mix(b, s, skyK);
}
vec3 cityGlassReflect(vec3 n, vec3 v, vec3 albedo, out vec3 keep) {
  float nv = clamp(dot(n, v), 0.0, 1.0);
  vec3 r = 2.0 * nv * n - v;
  vec3 sunDir = ${Le(Fo)};
  float glint = dot(n, sunDir) > 0.0 ? ${K(J.glintPeak)} * pow(max(dot(r, sunDir), 0.0), ${K(au(J.roughness))}) : 0.0;
  vec3 f0 = mix(vec3(${K(J.f0)}), albedo, ${K(J.metalness)});
  vec3 F = f0 + (max(vec3(${K(1-J.roughness)}), f0) - f0) * pow(1.0 - nv, 5.0);
  keep = (1.0 - F) * ${K(1-J.metalness)};
  return F * (cityGlassEnv(r) + glint * ${Le(Ye.sun)});
}`;var iu={legacy:.9,sunny:1},lu=(e=be())=>iu[e],ce=lu(),lt=255/nt,uu=255/228,cu=255/243,du=255/246,It=[{cell:"brick",tileM:ee.brick,clampUv:!1,litGain:lt*ce,skyTint:!1},{cell:"stucco",tileM:ee.stucco,clampUv:!1,litGain:cu*ce,skyTint:!1},{cell:"stone",tileM:ee.stone,clampUv:!1,litGain:uu*ce,skyTint:!1},{cell:"white",tileM:1,clampUv:!1,litGain:1,skyTint:!1},{cell:"door",tileM:ee.door,clampUv:!1,litGain:1,skyTint:!1},{cell:"glass",tileM:ee.glass,clampUv:!0,litGain:1,skyTint:!0},{cell:"tile",tileM:ee.roofTile,clampUv:!1,litGain:lt*ce,skyTint:!1},{cell:"slate",tileM:ee.slate,clampUv:!1,litGain:lt*ce,skyTint:!1},{cell:"flat",tileM:ee.bitumen,clampUv:!1,litGain:lt*ce,skyTint:!1},{cell:"brick20",tileM:ee.brick,clampUv:!1,litGain:lt*ce,skyTint:!1},{cell:"whiteStucco",tileM:ee.stucco,clampUv:!1,litGain:du*ce,skyTint:!1},{cell:"glassTint",tileM:ee.glass,clampUv:!0,litGain:1,skyTint:!0}],Ot=It.length,ut=Object.fromEntries(It.map((e,t)=>[e.cell,t])),In=64,fu=3,mu=3.2,Xe={x0:.28,x1:.72,y0:.3,y1:.8,frame:.035},ge=e=>Number.isInteger(e)?e.toFixed(1):String(e),hu=`
void cityWindowGrid(vec2 m, inout vec3 c, inout vec2 mk) {
  vec2 cell = fract(m / vec2(${ge(fu)}, ${ge(mu)}));
  vec2 lo = vec2(${ge(Xe.x0)}, ${ge(Xe.y0)}), hi = vec2(${ge(Xe.x1)}, ${ge(Xe.y1)});
  vec2 aa = max(fwidth(cell), vec2(1e-4));
  vec2 inO = smoothstep(lo - aa, lo + aa, cell) * (1.0 - smoothstep(hi - aa, hi + aa, cell));
  vec2 lg = lo + ${ge(Xe.frame)}, hg = hi - ${ge(Xe.frame)};
  vec2 inG = smoothstep(lg - aa, lg + aa, cell) * (1.0 - smoothstep(hg - aa, hg + aa, cell));
  float outer = inO.x * inO.y, glass = inG.x * inG.y;
  // far away the cells shrink under a pixel: fade the grid to the wall rather than shimmer
  float fade = 1.0 - smoothstep(0.08, 0.2, max(aa.x, aa.y));
  vec3 win = mix(vec3(0.86, 0.85, 0.82), mix(vec3(0.17, 0.21, 0.25), vec3(0.33, 0.39, 0.44), cell.y), glass);
  float k = outer * fade;
  c = mix(c, win, k);
  mk.r *= 1.0 - k;
  mk.g *= 1.0 - k;
}`,pu=Yt.school;function Dn(e,t={}){let n=gu(e,t);return t.windowGrid&&bu.has(Xt[e])?n+In:n}var bu=new Set(["brick","stucco","stone"]);function gu(e,t){let n=Xt[e],r=t.source==="measured";return n==="glass"&&r?ut.glassTint:n==="brick"&&!r&&typeof t.year=="number"&&t.year>=pu?ut.brick20:n==="stucco"&&t.white?ut.whiteStucco:n==="frame"?ut.white:ut[n]}function yu(){return It.map(e=>[1/e.tileM,e.clampUv?1:0,e.litGain,e.skyTint?1:0])}var Mu=.38,wu=.8,xu=.27,Su=.97,Ru=.75,vu=.5,ku=.12,Au=(e,t)=>(e<45||e>340)&&t>=.2;function cs(e,t,n,r=be(),o,a=!1,s=!1){if(s&&(e==="brick"||e==="accent")&&!Jt(e,n)&&Fr())return Er(cs(e,t,n,r,o,a),t);if(Jt(e,n))return bt(e,io(e,t,n,r,o),n);let i=A(t),[c,l,d]=O(i);if(e==="slate"&&Au(c,l))return bt("roofTile",t);if((e==="brick"||e==="accent")&&a){let u=Io(t);if(u)return u}return(e==="brick"||e==="accent")&&l<ku?T(j([c,l,Math.min(me[1],Math.max(me[0],.12+d*.9))])):e==="slate"&&d>Mu?T(j([c,Math.min(l,.12),Math.min(.72,d/wu)])):e==="slate"?d<xu?ae.slate[1]:ae.slate[0]:e==="frame"&&d>=.5&&d<Ru?T(i):e==="stone"&&d<vu?T(i):bt(e,t)}function ds(e,t,n,r=be(),o,a,s=!1,i=!1){let c=cs(e,t,n,r,o,s,i),[l,d,u]=A(Do(e,c,a??null,n,r));return[l,d,u,255]}function _u(e,t,n){switch(t){case"brick":return fo(e,n);case"brick20":return yo(e,n);case"stucco":return bo(e);case"whiteStucco":return Mo(e);case"stone":return go(e);case"white":case"frame":return wo(e);case"door":return po(e);case"glass":return mo(e);case"glassTint":return ho(e);case"tile":return xt(e,"tile");case"slate":return xt(e,"slate");case"flat":return xt(e,"flat")}}function Cu(e,t,n){let r=n*n,o=new Uint8Array(r*4*Ot),a=new Uint8Array(r*2*Ot),s=e.createElement("canvas");s.width=s.height=n;let i=s.getContext("2d",{willReadFrequently:!0});return i.imageSmoothingQuality="high",It.forEach((c,l)=>{i.clearRect(0,0,n,n),i.drawImage(_u(e,c.cell,t),0,0,n,n);let d=i.getImageData(0,0,n,n).data;for(let u=0;u<n;u++)for(let p=0;p<n;p++){let h=((n-1-u)*n+p)*4,y=l*r+u*n+p;o[y*4]=d[h],o[y*4+1]=d[h+1],o[y*4+2]=d[h+2],o[y*4+3]=255,a[y*2]=255,a[y*2+1]=0}}),{colour:o,mask:a}}async function $u(e=document){let t=new Image;t.src=new URL("materials/ambientcg/Bricks057/colour.jpg",e.baseURI).href;try{return await t.decode(),t}catch{return null}}var Bn=e=>`${e.lit?"lit":"unlit"}|${e.kind}|${e.kind==="slot"?e.uv??"uv":"-"}|${e.highlight?"hl":e.dim?"dim":"-"}|${e.side??0}${e.noFade?"|nofade":""}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf2":""}${e.farWindows&&e.kind==="chunk"?"|fwin":""}${e.lodBias?"|lodb":""}${e.aniso?"|aniso":""}${e.taps?"|taps":""}${Dt(e)?"|frec":""}${Pt(e)?"|grefl":""}`,Pt=e=>!!e.reflect&&e.lit&&e.kind==="slot",Dt=e=>!!e.records&&e.lit&&e.kind==="chunk";function Lu(e){let t={CITY_SLOT_COUNT:String(Ot)};return e.kind==="slot"&&(t.CITY_SLOT=""),e.swap&&(t.CITY_SWAP=""),e.cellDebug&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CELL_DEBUG_RHO="",e.cellDebug==="under"&&(t.CELL_DEBUG_UNDER="")),e.windows&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CITY_WINDOW_SDF=""),e.farWindows&&e.kind==="chunk"&&(t.FAR_WINDOWS=""),e.lodBias&&e.kind==="chunk"&&(t.CELL_LOD_BIAS=""),e.aniso&&e.kind==="chunk"&&(t.CELL_TIER_ANISO=""),e.taps&&e.kind==="chunk"&&(t.CELL_TAPS=""),Dt(e)&&(t.CITY_FACADE_RECORD=""),Pt(e)&&(t.CITY_GLASS_REFLECT=""),e.lit?(t.CITY_VARIANT_UNIFORMS="",{...t,...sn()}):(e.kind==="slot"&&e.uv==="box"&&(t.CITY_BOX_UV=""),e.highlight?t.CITY_HIGHLIGHT="":e.dim&&(t.CITY_DIM=""),{...t,...sn()})}function as(e){return{cityForce:{value:e.highlight?1:e.dim?2:0},cityBoxUv:{value:e.kind==="slot"&&e.uv==="box"?1:0}}}var Tu=e=>e.lit?`city-look-v4|lit|${e.kind}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf2":""}${e.farWindows&&e.kind==="chunk"?"|fwin":""}${e.lodBias?"|lodb":""}${e.aniso?"|aniso":""}${e.taps?"|taps":""}${Dt(e)?"|frec":""}${Pt(e)?"|grefl":""}`:`city-look-v3|${Bn({...e,side:0})}`,Fu="vec3(1.0, 0.824, 0.122)",is="vec3(1.0, 0.637, 0.0137)",ls="vec3(0.035, 0.05, 0.07)",Eu=`else {
  vec3 cityGN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  vec3 cityGV = normalize((vec4(vViewPosition, 0.0) * viewMatrix).xyz);
  vec3 cityGKeep;
  totalEmissiveRadiance += cityGlassReflect(cityGN, cityGV, diffuseColor.rgb, cityGKeep) * vSlot.w;
  diffuseColor.rgb *= mix(vec3(1.0), cityGKeep, vSlot.w);
}`,Ou=1,Iu=.2,Pu=.75,Du=1.8,Ze=e=>Number.isInteger(e)?e.toFixed(1):String(e),fs=`
float cityGrain(vec3 cell) {
  float g = clamp(dot(cell, vec3(0.299, 0.587, 0.114)) / ${Ze(nt/255)}, 0.45, 1.1);
  return mix(1.0, g, ${Ze(Pu)});
}`,ms=16,hs=`
#ifdef CITY_SWAP
attribute float swapSlot;
uniform vec4 citySwapUnder[${ms/4}];
uniform float cityUnder;
flat varying float vCityUnder;
#endif`,ps=`
#ifdef CITY_SWAP
int citySw = int(swapSlot + 0.5) - 1;
vCityUnder = citySw >= 0 ? citySwapUnder[citySw / 4][citySw % 4] : cityUnder;
#endif`,Bu=[.5,.59],bs=`
#define BOX_PANE_UV vec2(${Bu.map(e=>e.toFixed(2)).join(", ")})
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
${hs}
${ot}`,gs=`
${ps}
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
  vGrid = step(${In-.5}, layer);
  int cityS = int(clamp(layer - ${In}.0 * vGrid + 0.5, 0.0, float(CITY_SLOT_COUNT - 1)));
  vSlot = slotParams[cityS];
  vLayer = slotBase + float(cityS);
  #if defined(CITY_VARIANT_UNIFORMS)
  if (cityBoxUv > 0.5) {
    vec3 cityN = abs(normal);
    vec3 cityQ = position * length(modelMatrix[0].xyz);
    vec2 cityUv = cityN.y > max(cityN.x, cityN.z) ? cityQ.xz : (cityN.x > cityN.z ? cityQ.zy : cityQ.xy);
    // A pane cell (glass: 0..1 per pane) has no pane to span on box-projected UVs: one flat mid-pane sample, not a
    // gradient repeating every metre inside each modelled window (BOX_PANE_UV).
    vFacUv = vSlot.y > 0.5 ? BOX_PANE_UV : cityUv * vSlot.x;
    vSlot.y = 0.0;
  } else {
    vFacUv = vSlot.y > 0.5 ? uv : uv * vSlot.x;
  }
  #elif defined(CITY_BOX_UV)
    vec3 cityN = abs(normal);
    vec3 cityQ = position * length(modelMatrix[0].xyz);
    vec2 cityUv = cityN.y > max(cityN.x, cityN.z) ? cityQ.xz : (cityN.x > cityN.z ? cityQ.zy : cityQ.xy);
    // A pane cell (glass: 0..1 per pane) has no pane to span on box-projected UVs: one flat mid-pane sample, not a
    // gradient repeating every metre inside each modelled window (BOX_PANE_UV).
    vFacUv = vSlot.y > 0.5 ? BOX_PANE_UV : cityUv * vSlot.x;
    vSlot.y = 0.0;
  #else
    vFacUv = vSlot.y > 0.5 ? uv : uv * vSlot.x;
  #endif
#else
  vSlot = vec4(1.0, 0.0, 1.0, 0.0);
  vLayer = layer;
  vFacUv = uv;
#endif`,ys=`
vFacDist = length((modelViewMatrix * vec4(position, 1.0)).xyz);
if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`,Ms=`
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${$o}
${Lo}
${No}
${Ho}
${hu}
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
${fs}
${ot}`,ws=`
if (HL_GHOST(vHighlight)) discard;
#ifdef CITY_SWAP
float cityHash = fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296)));
if (cityFade < 1.0 && cityHash >= cityFade) discard;
// The complement of a replacement dissolving in over (or out from) this mesh: where it draws, this one does not.
if (cityHash < vCityUnder) discard;
#else
if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;
#endif`,xs=`
vec2 cityUv = vSlot.y > 0.5 ? clamp(vFacUv, 0.0, 1.0) : vFacUv;
vec3 cityP = vec3(cityUv, vLayer);
vec3 cityC; vec2 cityM;
#ifdef CITY_SLOT
vec4 cityCC = texture(cells, cityP); vec2 cityMM = texture(masks, cityP).rg;
cityC = cityCC.rgb; cityM = vec2(cityMM.r, ${Ue("cityMM","cityCC")});
if (vGrid > 0.5) cityWindowGrid(vFacUv / vSlot.x, cityC, cityM);
#else
cellTierSample(cityP, vFacDist, cityC, cityM);
#ifdef CITY_WINDOW_SDF
windowSdf(cityUv, vLayer, 1.0 - cellFar, cityC, cityM);
#endif
cityC = roofTierColour(cityC, cityUv, vLayer, vFacDist);
#endif
float cityG = cityGrain(cityC);
cityC *= mix(vec3(1.0), vTint, cityM.r) * mix(vec3(1.0), vAccent, cityM.g);`,Nu=`
uniform mat3 enuFromWorld;
${bs}
varying float vShade;
void main() {
${gs}
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
${At}
  vShade = shade;
#else
  vShade = tint.a;
#endif
${ys}
}`,Wu=`
precision highp float;
${Ms}
varying float vShade;
void main() {
${ws}
${xs}
  if (HL_PAINT(vHighlight)) {
    float hlShade = clamp(1.0 - (1.0 - vShade) * ${Ze(Du)}, 0.6, 1.0);
    gl_FragColor = vec4(${Fu} * (flatColour > 0.5 ? 1.0 : cityG) * hlShade, 1.0);
    return;
  }
  if (flatColour > 0.5) cityC = vTint;
  cityC = hlDesat(cityC, vHighlight);
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  gl_FragColor = vec4(cityC * shade, 1.0);
#ifdef CELL_DEBUG_RHO
  gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif
}`,Hu=`
attribute float hidden;
flat varying float vHighlight;
varying float vFacDist;
#ifdef CITY_VARIANT_UNIFORMS
uniform float cityForce;
uniform float cityBoxUv;
#endif
${hs}
${ot}
${Qo}`,Gu=`
${ps}
vHighlight = hlState(hidden);
#ifdef CITY_VARIANT_UNIFORMS
if (cityForce > 0.5) vHighlight = cityForce;
#endif
${es}`,Uu=`
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${ts}
flat varying float vHighlight;
varying float vFacDist;
#ifdef CITY_SWAP
flat varying float vCityUnder;
#endif
${fs}
${ot}`,ju=`
vec3 cityC; vec2 cityM;
cityC = facadeRecordColour(cityM);
float cityG = cityGrain(cityC);`,Vu=(e=null)=>({facadeRecords:{value:e},recBase:{value:0},facadeKnobs:{value:[1,1,1,0]},wallUnit:{value:ns}});function zu(e,t={}){return{cells:t.cells??{value:null},masks:t.masks??{value:null},slotBase:t.slotBase??{value:0},slotParams:t.slotParams??{value:yu().map(n=>new e.Vector4(...n))},bands:t.bands??{value:0},flatColour:t.flatColour??{value:0},cityFade:t.cityFade??{value:1},wallGain:t.wallGain??{value:1},roofLayers:t.roofLayers??{value:_o},roofTier:t.roofTier??{value:Co()},cellTier:t.cellTier??{value:Ao},enuFromWorld:t.enuFromWorld??{value:new e.Matrix3},citySwapUnder:t.citySwapUnder??{value:new Float32Array(ms)},cityUnder:t.cityUnder??{value:0},windowTable:t.windowTable??{value:null},windowSdfMix:t.windowSdfMix??{value:1},cellLodBias:t.cellLodBias??{value:0},cellAniso:t.cellAniso??{value:kn(16).cellAniso},cellAnisoRule:t.cellAnisoRule??{value:kn(16).cellAnisoRule},cellTaps:t.cellTaps??{value:vn().cellTaps},cellTapsSdf:t.cellTapsSdf??{value:vn().cellTapsSdf},...Wo(),...t.windowSdfBand?{windowSdfBand:t.windowSdfBand}:{},...t.windowSdfShape?{windowSdfShape:t.windowSdfShape}:{}}}var qu={accent:[1,1,1,1],hidden:[0],color:[1,1,1],uv:[0,0],uv1:[0,0],swapSlot:[0]},Pn="recipeLookShared";function Ku(e,t,n){let r=Lu(t),o=t.side??e.FrontSide,a,s;if(!t.lit)a=new e.ShaderMaterial({uniforms:n,defines:r,vertexShader:Nu,fragmentShader:Wu,side:o});else{a=new e.MeshLambertMaterial({side:o,flatShading:t.kind==="chunk"}),a.defines={...a.defines??{},...r};let i=Dt(t),c=i?{...as(t),...Vu()}:as(t);i&&(s=c);let l=i?Hu:bs,d=i?Gu:gs,u=Pt(t),p=(i?Uu:Ms)+(u?ss:""),h=i?ju:xs;a.onBeforeCompile=M=>{for(let g of Object.keys(n))M.uniforms[g]=n[g];Object.assign(M.uniforms,c),M.vertexShader=M.vertexShader.replace("#include <common>",`#include <common>${l}`).replace("#include <begin_vertex>",`#include <begin_vertex>${d}`).replace("#include <project_vertex>",`#include <project_vertex>${ys}`),M.fragmentShader=M.fragmentShader.replace("#include <common>",`#include <common>${p}
float cityLuma;`).replace("#include <dithering_fragment>",`#include <dithering_fragment>
#ifdef CELL_DEBUG_RHO
gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>${ws}`).replace("#include <map_fragment>",`${h}
#ifdef CITY_SLOT
cityC *= vSlot.z;
#else
cityC *= mix(1.0, wallGain * ${Ze(ce)}, cityM.r);
#endif
if (flatColour > 0.5) cityC = ${i?"fr_wall()":"vTint"};
cityLuma = dot(cityC, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= HL_PAINT(vHighlight) ? ${is} * ${Ze(Ou)} * pow(flatColour > 0.5 ? 1.0 : cityG, 2.2) : pow(hlDesat(cityC, vHighlight), vec3(2.2));`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
if (HL_PAINT(vHighlight)) totalEmissiveRadiance += ${is} * ${Ze(Iu)};
#ifdef CITY_SLOT
${u?Eu:`else totalEmissiveRadiance += ${ls} * vSlot.w;`}
#else
// Bay glazing (dark, untinted texels): the same constant sky tint as landmark glass, never a hotspot.
else totalEmissiveRadiance += ${ls} * (1.0 - smoothstep(0.06, 0.2, cityLuma)) * (1.0 - cityM.r);
#endif`)};let y=Tu(t);a.customProgramCacheKey=()=>y,a.uniforms=n}return a.defaultAttributeValues={...qu},a.name=`city-look/${Bn(t)}`,a.userData={cityLook:!0,cityVariant:{...t},[Pn]:!0},s&&(a.userData.facadeRecordUniforms=s),t.noFade&&qr(a),t.kind==="chunk"?Br(a,!!t.lit):a}function Yu(e){return e?e.isMeshBasicMaterial||e.userData?.unlit?"unlit (decal / emissive sign)":e.transparent||(e.opacity??1)<1?"transparent":e.vertexColors?"vertex colours":e.map?"own texture":null:"no material"}function Xu(e,t,n=rs()){let r=e?.userData??{};if(n&&os(r[En])&&yn(r.materialSlot)&&typeof r.tint=="string"){let s=r.materialSlot==="glass"&&r.tintSource==="measured";return{slot:"glass",tint:r.tint,inferred:r.materialSlotSource===gn,...s?{source:"measured"}:{},glassFinish:r[En]}}if(yn(r.materialSlot)&&typeof r.tint=="string"){let s=Oo(r.materialSlot,r.tint,r.tintSource==="measured"?"measured":void 0)==="measured";return{slot:r.materialSlot,tint:r.tint,inferred:r.materialSlotSource===gn,...s?{source:"measured"}:{},...s&&typeof r.tintWhitePoint=="string"?{white:r.tintWhitePoint}:{},...r.windowGrid===!0?{windowGrid:!0}:{}}}if(!t||Yu(e)||!e.color)return null;let o="#"+e.color.getHexString(),a=Yr(e.name,o);return{slot:a.slot,tint:a.tint,inferred:!0}}function us(e,t,n,r,o={}){let a=t.getAttribute("position")?.count??0,s=Dn(n,o),i=ds(n,r,o.source,void 0,o.whitePoint,o.exposure,!1,!0),c=t.getAttribute("layer"),l=t.getAttribute("tint");if(c&&l)return c.getX(0)===s&&Math.round(l.getX(0)*255)===i[0]&&Math.round(l.getY(0)*255)===i[1]&&Math.round(l.getZ(0)*255)===i[2];t.setAttribute("layer",new e.BufferAttribute(new Uint8Array(a).fill(s),1,!1));let d=new Uint8Array(a*4);for(let u=0;u<a;u++)d.set(i,u*4);return t.setAttribute("tint",new e.BufferAttribute(d,4,!0)),!0}function Zu(e,t,n,r,o,a={}){let s=r.getAttribute("normal"),i=r.getAttribute("layer"),c=r.getAttribute("tint");if(!s||!i||!c)return 0;let[l,d,u]=ds("bitumen",o,a.source);t.updateWorldMatrix(!0,!0);let p=new e.Matrix4().copy(t.matrixWorld).invert().multiply(n.matrixWorld),h=new e.Matrix3().getNormalMatrix(p),y=new e.Vector3,M=Dn("bitumen",a),g=0;for(let S=0;S<s.count;S++)y.set(s.getX(S),s.getY(S),s.getZ(S)).applyMatrix3(h).normalize(),!(y.y<Su)&&(i.setX(S,M),c.setXYZW(S,l/255,d/255,u/255,1),g++);return g&&(i.needsUpdate=!0,c.needsUpdate=!0),g}var Ju="__canalRecallCityLookShared";function Ss(e,t={}){let n=globalThis,r=n[Ju]??=new Map,o=r.get(e);return o||r.set(e,o=Qu(e,t)),o}function Qu(e,t={}){let n=t.document??globalThis.document,r=t.size??(globalThis.matchMedia?.("(pointer: coarse)").matches?128:256),o=zu(e),a=new Map,s=null,i=!1,c=(u,p)=>{let h=new e.DataArrayTexture(u,r,r,Ot);return h.format=p,h.type=e.UnsignedByteType,h.wrapS=h.wrapT=e.RepeatWrapping,h.minFilter=e.LinearMipmapLinearFilter,h.magFilter=e.LinearFilter,h.generateMipmaps=!0,h.anisotropy=t.anisotropy??So("slotCells",16).anisotropy,h.unpackAlignment=1,h.needsUpdate=!0,h.userData={bytes:u.byteLength,[Pn]:!0},h},l=(async()=>{if(!n)return;let u=t.brick!==void 0?t.brick:await $u(n),{colour:p,mask:h}=Cu(n,u,r),y=Ro(p,h);s={colour:c(y.colour,e.RGBAFormat),mask:c(y.mask,y.channels===1?e.RedFormat:e.RGFormat)},i||(o.cells.value=s.colour,o.masks.value=s.mask,o.slotBase.value=0)})(),d=u=>{let p=Bn(u),h=a.get(p);return h||a.set(p,h=Ku(e,u,o)),h};return{uniforms:o,ready:l,material:d,dress(u,{lit:p,infer:h=!1,year:y=null,wallExposure:M=null}){let g=0;return u.traverse(S=>{if(!S.isMesh||Array.isArray(S.material)||S.material?.userData?.cityLook)return;let b=Xu(S.material,h);if(!b)return;let _=S.geometry;if(!_?.getAttribute("position"))return;let Y=!!_.getAttribute("uv");!Y&&!_.getAttribute("normal")&&_.computeVertexNormals();let v={year:y,white:b.inferred&&Xr(S.material.name),source:b.source,...b.white?{whitePoint:b.white}:{},...M?{exposure:M}:{},...b.windowGrid?{windowGrid:!0}:{}};us(e,_,b.slot,b.tint,v)||(_=S.geometry=_.clone(),_.deleteAttribute("layer"),_.deleteAttribute("tint"),us(e,_,b.slot,b.tint,v)),b.inferred&&b.slot==="slate"&&!b.source&&Zu(e,u,S,_,b.tint,v);let F=S.material;S.material=d({lit:p,kind:"slot",uv:Y?"uv":"box",side:F.side,...b.glassFinish==="reflective"&&p?{reflect:!0}:{}}),S.userData.citySlot={slot:b.slot,tint:b.tint,...b.source?{source:b.source}:{},...b.glassFinish?{glassFinish:b.glassFinish}:{},inferred:b.inferred,from:F.name,layer:Dn(b.slot,v)},F.userData?.[Pn]||F.dispose(),g++}),g},highlighted(u,p){let h=u?.userData?.cityVariant;return h?d({...h,highlight:p,dim:!1}):u},dimmed(u,p){let h=u?.userData?.cityVariant;return h?d({...h,highlight:!1,dim:p}):u},bindAtlas(u){i=!!u,u?(o.cells.value=u.colour,o.masks.value=u.mask,o.slotBase.value=u.slotBase):s&&(o.cells.value=s.colour,o.masks.value=s.mask,o.slotBase.value=0)},textureBytes(){return s&&!i?Math.round((s.colour.userData.bytes+s.mask.userData.bytes)*4/3):0}}}var ec=2*Math.PI*6378137;function Rs(e,t){return[(180+e)/360,(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+t*Math.PI/360)))/360]}var tc=e=>1/ec/Math.cos(e*Math.PI/180);function Nn(e,t){let[n,r]=Rs(e[0],e[1]),[o,a]=Rs(t[0],t[1]),s=tc(e[1]);return[(o-n)/s,(a-r)/s]}function Bt(e){let t=e.map(r=>r.anchor[0]),n=e.map(r=>r.anchor[1]);return[(Math.min(...t)+Math.max(...t))/2,(Math.min(...n)+Math.max(...n))/2]}var nc=e=>Math.PI-(180+e)*Math.PI/180;function Wn(e,t){let[n,r]=Nn(t,e.anchor),o=nc(e.northOffsetDegrees),a=Math.cos(o),s=Math.sin(o),[i,c,l]=e.scale;return[a*i,0,-s*i,0,0,c,0,0,s*l,0,a*l,0,n,e.groundAltitudeMetres,r,1]}function Cs(e){let t=new Map;for(let n of e)t.set(n.area??"default",[...t.get(n.area??"default")??[],n]);return t}function $s(e){let t=Bt(e);return Math.max(50,...e.map(n=>Math.hypot(...Nn(t,n.anchor))))+30}var rc=e=>`NL.IMBAG.Pand.${e}`;function Hn(e){return[...new Set(e.flatMap(t=>[t.pand,...t.alsoSuppress??[]].map(rc)))].sort()}function Gn(e){let t=e.L0/2,n=e.W0/2,r=e.E0,o={positions:[],normals:[],uvs:[],index:[]},a={positions:[],normals:[],uvs:[],index:[]},s=(u,p,h,y,M,g,S)=>{let b=u.positions.length/3;for(let _ of[p,h,y,M])u.positions.push(..._),u.normals.push(...g),u.uvs.push(...S(_));u.index.push(b,b+1,b+2,b,b+2,b+3)},i=u=>[u[0],u[1]],c=u=>[u[2],u[1]],l=u=>[u[0],u[2]];s(o,[-t,0,n],[t,0,n],[t,r,n],[-t,r,n],[0,0,1],i),s(o,[t,0,-n],[-t,0,-n],[-t,r,-n],[t,r,-n],[0,0,-1],i),s(o,[t,0,n],[t,0,-n],[t,r,-n],[t,r,n],[1,0,0],c),s(o,[-t,0,-n],[-t,0,n],[-t,r,n],[-t,r,-n],[-1,0,0],c);let d=e.R0!==void 0&&e.R0>r+.3?e.R0:void 0;if(d===void 0)s(a,[-t,r,n],[t,r,n],[t,r,-n],[-t,r,-n],[0,1,0],l);else{let u=d-r,p=Math.hypot(n,u),h=u/p,y=n/p;s(a,[-t,r,n],[t,r,n],[t,d,0],[-t,d,0],[0,y,h],l),s(a,[t,r,-n],[-t,r,-n],[-t,d,0],[t,d,0],[0,y,-h],l);let M=(g,S,b)=>{let _=o.positions.length/3,Y=b?[[g,r,-n],[g,r,n],[g,d,0]]:[[g,r,n],[g,r,-n],[g,d,0]];for(let v of Y)o.positions.push(...v),o.normals.push(S,0,0),o.uvs.push(...c(v));o.index.push(_,_+1,_+2)};M(t,1,!1),M(-t,-1,!0)}return{walls:o,roof:a}}function oc(e,t=Ls){return e?Math.max(t,Math.round(3*Math.max(e.L0,e.E0))):t}function Un(e,t,n,r,o,a=20){let s=new Set(o?.near),i=new Set(o?.far),c=[],l=[];return e.forEach((d,u)=>{let p=Math.hypot(d.x-t.x,d.z-t.z),h=typeof n=="number"?n:n[u],y=s.has(u)?h+a:h-(i.has(u)?a:0),M=s.has(u)||i.has(u)?r+a:r;p<=y?c.push(u):p<=M&&l.push(u)}),{near:c,far:l,culled:e.length-c.length-l.length}}var Ls=140,sc=700;function ac(e){let t=e.reduce((s,i)=>s+i.positions.length/3,0),n=e.reduce((s,i)=>s+(i.index?i.index.length:i.positions.length/3),0),r={positions:new Float32Array(t*3),normals:new Float32Array(t*3),uvs:new Float32Array(t*2),textures:new Float32Array(t),tints:new Float32Array(t*3),index:new Uint32Array(n)},o=0,a=0;for(let s of e){let i=s.matrix,c=s.positions.length/3,l=i[0],d=i[4],u=i[8],p=i[1],h=i[5],y=i[9],M=i[2],g=i[6],S=i[10],b=[h*S-y*g,y*M-p*S,p*g-h*M,u*g-d*S,l*S-u*M,d*M-l*g,d*y-u*h,u*p-l*y,l*h-d*p],_=l*b[0]+d*b[1]+u*b[2]<0;for(let v=0;v<c;v++){let F=s.positions[v*3],ne=s.positions[v*3+1],Q=s.positions[v*3+2],q=(o+v)*3;r.positions[q]=i[0]*F+i[4]*ne+i[8]*Q+i[12],r.positions[q+1]=i[1]*F+i[5]*ne+i[9]*Q+i[13],r.positions[q+2]=i[2]*F+i[6]*ne+i[10]*Q+i[14];let ye=s.normals[v*3],Je=s.normals[v*3+1],de=s.normals[v*3+2],Me=b[0]*ye+b[1]*Je+b[2]*de,Te=b[3]*ye+b[4]*Je+b[5]*de,dt=b[6]*ye+b[7]*Je+b[8]*de,re=(Math.hypot(Me,Te,dt)||1)*(_?-1:1);r.normals[q]=Me/re,r.normals[q+1]=Te/re,r.normals[q+2]=dt/re,r.uvs[(o+v)*2]=s.uvs[v*2]*s.uvScale,r.uvs[(o+v)*2+1]=s.uvs[v*2+1]*s.uvScale,r.textures[o+v]=s.texture,r.tints[q]=s.tint[0],r.tints[q+1]=s.tint[1],r.tints[q+2]=s.tint[2]}let Y=s.index?s.index.length:c;for(let v=0;v<Y;v+=3){let F=s.index?s.index[v]:v,ne=s.index?s.index[v+1]:v+1,Q=s.index?s.index[v+2]:v+2;r.index[a++]=o+F,r.index[a++]=o+(_?Q:ne),r.index[a++]=o+(_?ne:Q)}o+=c}return r}function ic(e){let t=Math.max(1,e),n=Array.from({length:t},(r,o)=>o===t-1?`c = texture2D(t${o}, vUv).rgb;`:`if (vTex < ${o}.5) c = texture2D(t${o}, vUv).rgb; else`).join(`
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
${At}
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
}`}}var ct=10;function lc(e){let t=Math.max(1,e),n=Array.from({length:t},(r,o)=>o===t-1?`btC = texture2D(btT${o}, vBtUv);`:`if (vBtTex < ${o}.5) btC = texture2D(btT${o}, vBtUv); else`).join(`
  `);return{declarations:`${Array.from({length:t},(r,o)=>`uniform sampler2D btT${o};`).join(`
`)}
varying float vBtTex;
varying vec3 vBtTint;
varying vec2 vBtUv;`,sample:`vec4 btC;
  ${n}
  diffuseColor *= vec4(btC.rgb * vBtTint, btC.a);
#undef USE_MAP
#include <map_fragment>`}}var vs=new WeakMap;function uc(e,t,n){let r=vs.get(e.MeshLambertMaterial);r||(r=class extends e.MeshLambertMaterial{btTextures=[];constructor(a){super(a),this.onBeforeCompile=function(s){let{declarations:i,sample:c}=lc(ct);for(let l=0;l<ct;l++)s.uniforms[`btT${l}`]={value:this.btTextures[l]??this.btTextures[0]??null};s.vertexShader=s.vertexShader.replace("#include <common>",`#include <common>
attribute float btTex;
attribute vec3 btTint;
varying float vBtTex;
varying vec3 vBtTint;
varying vec2 vBtUv;`).replace("#include <uv_vertex>",`#include <uv_vertex>
  vBtUv = uv; vBtTex = btTex; vBtTint = btTint;`),s.fragmentShader=s.fragmentShader.replace("#include <common>",`#include <common>
${i}`).replace("#include <map_fragment>",c)},this.customProgramCacheKey=function(){return`building-types/lit-merged/${ct}`}}copy(a){return super.copy(a),this.btTextures=[...a.btTextures??[]],this.onBeforeCompile=a.onBeforeCompile,this.customProgramCacheKey=a.customProgramCacheKey,this}},vs.set(e.MeshLambertMaterial,r));let o=new r({map:t[0],side:n});return o.btTextures=[...t],o.name="building-types/lit-merged",o.userData={recipeLookShared:!0,litMerged:!0},o}function ks(e,t,n){if(!t?.isShaderMaterial)return t;let r=n.get(t);if(!r){let o=String(t.vertexShader).replace("mat3(modelMatrix) * normal","mat3(modelMatrix * instanceMatrix) * normal").replace("modelViewMatrix * vec4(position, 1.0)","modelViewMatrix * instanceMatrix * vec4(position, 1.0)");if(o===t.vertexShader)throw new Error("recipe look vertex shader changed: instancing patch no longer applies");r=new e.ShaderMaterial({uniforms:t.uniforms,vertexShader:o,fragmentShader:t.fragmentShader,side:t.side}),r.name=`${t.name}/instanced`,r.userData={...t.userData},n.set(t,r)}return r}var As=new Set(["brick","stucco","stone"]),_s=new Set(["roofTile","slate","bitumen"]);async function Ts(e,t){let{THREE:n}=e,r=e.nearMetres??Ls,o=e.cullMetres??sc;if(!t.length)throw new Error("no building-type instances");let a=Bt(t),s=new n.Group;s.name="building-types";let i=t.map(f=>new n.Matrix4().fromArray(Wn(f,a))),c=i.map(f=>({x:f.elements[12],z:f.elements[14]})),l=Math.max(50,...c.map(f=>Math.hypot(f.x,f.z)))+30,d=new Map,u=new Map;t.forEach((f,w)=>u.set(f.unit,[...u.get(f.unit)??[],w]));let p=[],h=[],y=[],M=t.map(()=>r),g=[],S=f=>!!(f?.isShaderMaterial&&f.uniforms?.map?.value&&f.uniforms.tint?.value&&f.uniforms.uvScale&&f.uniforms.enuFromWorld),b=f=>!!f?.userData?.cityLook,_=f=>!!(f?.isMeshLambertMaterial&&f.userData?.recipeLookShared&&!f.userData?.litMerged&&f.map&&f.color&&Math.abs(f.map.repeat.x-f.map.repeat.y)<1e-9&&!f.map.offset.x&&!f.map.offset.y&&!f.map.rotation),Y=!0,v=f=>S(f)||b(f)||Y&&_(f);for(let[f,w]of u){let x=await e.loadUnit(f);x.updateMatrixWorld(!0);let C;x.traverse($=>{$.userData?.nominal&&(C=$.userData.nominal)});let k=[];x.traverse($=>{$.isMesh&&k.push($)});for(let $ of k)S($.material)&&!g.includes($.material.uniforms.map.value)&&g.push($.material.uniforms.map.value),_($.material)&&!g.includes($.material.map)&&g.push($.material.map);if(y.push({unit:f,indices:w,meshes:k,nominal:C}),e.nearMetres===void 0)for(let $ of w)M[$]=oc(C,r)}Y=g.length<=ct,!Y&&y.some(f=>f.meshes.some(w=>_(w.material)))&&console.warn(`building types: ${g.length} textures, over ${ct}; lit units keep one draw per material`);let F=new Map,ne=f=>{if(b(f))return f;if(_(f)){let x=F.get(`lit|${f.side}`);return x||(x=uc(n,g,f.side),F.set(`lit|${f.side}`,x)),x}let w=F.get(f.side);if(!w){let x={enuFromWorld:f.uniforms.enuFromWorld,hlDimAll:{value:0}};g.forEach((C,k)=>{x[`t${k}`]={value:C}}),w=new n.ShaderMaterial({uniforms:x,...ic(g.length),side:f.side}),w.name="building-types/merged",w.userData={recipeLookShared:!0},F.set(f.side,w)}return w},Q=(f,w,x)=>{if(b(f.material)){let k=f.geometry.getAttribute("layer"),$=f.geometry.getAttribute("tint");return{...w,matrix:x,uvScale:1,texture:k.getX(0),tint:[$.getX(0),$.getY(0),$.getZ(0)]}}if(_(f.material)){let k=f.material.color;return{...w,matrix:x,uvScale:f.material.map.repeat.x,texture:g.indexOf(f.material.map),tint:[k.r,k.g,k.b]}}let C=f.material.uniforms.tint.value;return{...w,matrix:x,uvScale:f.material.uniforms.uvScale.value,texture:g.indexOf(f.material.uniforms.map.value),tint:[C.x,C.y,C.z]}},q=(f,w="recipe")=>{let x=new n.BufferGeometry;return x.setAttribute("position",new n.BufferAttribute(f.positions,3)),x.setAttribute("normal",new n.BufferAttribute(f.normals,3)),x.setAttribute("uv",new n.BufferAttribute(f.uvs,2)),x.setAttribute(w==="city"?"layer":w==="lit"?"btTex":"aTex",new n.BufferAttribute(f.textures,1)),x.setAttribute(w==="city"?"tint":w==="lit"?"btTint":"aTint",new n.BufferAttribute(f.tints,3)),x.setIndex(new n.BufferAttribute(f.index,1)),h.push(x),x},ye=(f,w)=>{let x=[];for(let C=0;C<f.count;C++)x.push(f.getX(C)),w>1&&x.push(f.getY(C)),w>2&&x.push(f.getZ(C));return x},Je=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];for(let{unit:f,indices:w,meshes:x,nominal:C}of y){let k=new Map,$=new Map,L=new Map;for(let E of x){let D=E.geometry;if(!v(E.material)){let oe=new n.InstancedMesh(D,ks(n,E.material,d),w.length);oe.name=`${f}/near/${E.name}`,oe.userData.layer="near",p.push({mesh:oe,indices:w,local:E.matrixWorld.clone(),far:!1,triangles:(D.index?.count??D.attributes.position.count)/3}),s.add(oe);continue}let G=E.material.side;L.set(G,E.material),k.set(G,[...k.get(G)??[],Q(E,{positions:ye(D.attributes.position,3),normals:ye(D.attributes.normal,3),uvs:ye(D.attributes.uv,2),index:D.index?.array},E.matrixWorld.elements)])}if(C){let E=z=>b(z.material)?z.userData?.citySlot?.slot:z.material?.userData?.materialSlot,D=z=>x.filter(H=>v(H.material)&&z.has(E(H))).sort((H,we)=>we.geometry.attributes.position.count-H.geometry.attributes.position.count)[0],G=D(As),oe=D(_s),U=Gn(C);if(!G){let z=mt=>x.filter(se=>mt.has(se.material?.userData?.materialSlot)).sort((se,Ht)=>Ht.geometry.attributes.position.count-se.geometry.attributes.position.count)[0],H=z(As),we=z(_s)??H;for(let[mt,se,Ht]of[[H,U.walls,"walls"],[we,U.roof,"roof"]]){if(!mt||!se.index.length)continue;let Fe=new n.BufferGeometry;Fe.setAttribute("position",new n.Float32BufferAttribute(se.positions,3)),Fe.setAttribute("normal",new n.Float32BufferAttribute(se.normals,3)),Fe.setAttribute("uv",new n.Float32BufferAttribute(se.uvs,2)),Fe.setIndex(se.index),h.push(Fe);let ht=new n.InstancedMesh(Fe,ks(n,mt.material,d),w.length);ht.name=`${f}/far/${Ht}`,ht.userData.layer="far",p.push({mesh:ht,indices:w,local:new n.Matrix4,far:!0,triangles:se.index.length/3}),s.add(ht)}}for(let[z,H]of[[G,U.walls],[oe,U.roof]]){if(!z||!H.index.length)continue;let we=z.material.side;L.set(we,z.material),$.set(we,[...$.get(we)??[],Q(z,{positions:H.positions,normals:H.normals,uvs:H.uvs,index:H.index},Je)])}}for(let[E,D]of[[k,!1],[$,!0]])for(let[G,oe]of E){let U=L.get(G),z=ac(oe),H=new n.InstancedMesh(q(z,b(U)?"city":_(U)?"lit":"recipe"),ne(U),w.length);H.name=`${f}/${D?"far":"near"}/merged-${G}`,H.userData.layer=D?"far":"near",p.push({mesh:H,indices:w,local:new n.Matrix4,far:D,triangles:z.index.length/3}),s.add(H)}}let de,Me=null,Te=new n.Matrix4,dt=new n.Matrix4().makeScale(0,0,0),re=new Map,Qe=[],jn={near:0,far:0,culled:0},Nt=f=>{de=f;let w=new Set(f.near),x=new Set(f.far),C=0;for(let k of p){let $=k.indices.map((L,E)=>({global:L,k:E})).filter(({global:L})=>(k.far?x:w).has(L));$.forEach(({global:L},E)=>{Te.multiplyMatrices(i[L],k.local),k.mesh.setMatrixAt(E,re.has(L)?dt:Te)}),k.mesh.userData.slotToGlobal=$.map(L=>L.global),k.mesh.count=$.length,k.mesh.instanceMatrix.needsUpdate=!0,k.mesh.visible=$.length>0,$.length&&(k.mesh.computeBoundingSphere(),k.mesh.computeBoundingBox(),C++)}jn={near:f.near.length,far:f.far.length,culled:f.culled};for(let k of Qe)k.mesh.visible=(k.layer.far?x:w).has(k.global)},Wt=(f=!1)=>{let w=e.getCentre();if(!w)return;let[x,C]=Nn(a,[w.lng,w.lat]),k={x,z:C};!f&&Me&&Math.hypot(k.x-Me.x,k.z-Me.z)<10||(Me=k,Nt(Un(c,k,M,o,de)))};Nt({near:[],far:c.map((f,w)=>w),culled:0}),Wt(!0);let ft=new n.Mesh(new n.BufferGeometry,new n.MeshBasicMaterial);return ft.name="building-types/driver",ft.frustumCulled=!1,ft.onBeforeRender=()=>Wt(),s.add(ft),{anchor:a,group:s,suppress:Hn(t),radiusMetres:l,update:Wt,setHighlighted(f,w){let x=Be(),C=rt[x],k=new Set([...f].map(L=>String(L).replace(/^NL\.IMBAG\.Pand\./,"")));for(let L of Qe)s.remove(L.mesh),L.mesh.dispose?.();Qe=[],re.clear(),t.forEach((L,E)=>{k.has(L.pand)?re.set(E,"highlight"):C.desaturate&&w&&kr(w.lngLat,L.anchor)&&re.set(E,"dim")});let $=Ss(n);for(let[L,E]of re)for(let D of p){if(!D.indices.includes(L))continue;let G=D.mesh.material,oe=E==="highlight"?C.keepMaterials?G:b(G)?$.highlighted(G,!0):an(n,G,"highlight",x):b(G)?$.dimmed(G,!0):an(n,G,"dim",x),U=new n.InstancedMesh(D.mesh.geometry,oe,1);U.setMatrixAt(0,Te.multiplyMatrices(i[L],D.local)),U.name=`${D.mesh.name}/${E}`,U.userData.slotToGlobal=[L],U.computeBoundingSphere(),U.computeBoundingBox(),E==="highlight"&&_r(n,U,{style:x,up:[0,1,0]}),s.add(U),Qe.push({global:L,layer:D,mesh:U})}return de&&Nt(de),[...re.values()].filter(L=>L==="highlight").length},pandForHit(f,w){let x=f?.userData?.slotToGlobal;return w===void 0||!x?null:t[x[w]]?.pand??null},stats(){let f=p.filter(C=>C.mesh.visible&&C.mesh.count>0).length,w=0,x=0;for(let C of p)C.mesh.visible&&(C.far?x+=C.triangles*C.mesh.count:w+=C.triangles*C.mesh.count);return{instances:t.length,...jn,units:u.size,drawCalls:f,nearTriangles:w,farTriangles:x}},dispose(){for(let f of Qe)f.mesh.dispose?.();for(let f of p)f.mesh.dispose?.();for(let f of h)f.dispose();for(let f of F.values())f.dispose()}}}return Ds(cc);})();

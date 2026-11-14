"use strict";var CanalRecallBuildingTypes=(()=>{var Ot=Object.defineProperty;var gs=Object.getOwnPropertyDescriptor;var ys=Object.getOwnPropertyNames;var Ms=Object.prototype.hasOwnProperty;var ws=(e,t)=>{for(var n in t)Ot(e,n,{get:t[n],enumerable:!0})},xs=(e,t,n,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of ys(t))!Ms.call(e,o)&&o!==n&&Ot(e,o,{get:()=>t[o],enumerable:!(r=gs(t,o))||r.enumerable});return e};var Ss=e=>xs(Ot({},"__esModule",{value:!0}),e);var Uu={};ws(Uu,{areaAnchor:()=>Tt,areaRadiusMetres:()=>hs,createBuildingTypes:()=>bs,farMassing:()=>Cn,groupByArea:()=>ms,instanceMatrix:()=>An,partitionByDistance:()=>$n,suppressionIds:()=>_n});var Rs=.7,vs=46,ks=null,As=()=>ks??=[Q["pantile-red"].hex,Q["pantile-dark"].hex,Te[0],Te[1],Q.gravel.hex,Q["bitumen-dark"].hex,Q["white-membrane"].hex];function _s(e,t){let n=globalThis,r=n[t]??(typeof URLSearchParams=="function"?new URLSearchParams(n.location?.search??"").get(e):null);return r===!0||r==="1"||r==="true"||r==="on"}var Cs=null;var It=()=>Cs??=_s("roofFamily","__canalRecallRoofFamily");var $s=(e,t)=>Math.hypot(e[0]-t[0],e[1]-t[1],e[2]-t[2]);function Ts(e,t=As(),n=vs){let r=A(e),o=null,a=n;for(let s of t){let i=$s(r,A(s));i<=a&&(a=i,o=s)}return o}function Pt(e,t=Rs){let n=Ts(e);if(!n)return e;let r=A(e),o=A(n);return L([0,1,2].map(a=>r[a]+(o[a]-r[a])*t))}function Ln(){let e=globalThis;return(e.__canalRecallLook??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("look"):null))==="toon"}var V=["#a8503a","#9a4a38","#8c4632","#b05a40","#7a3b2c"],Ye=["#2b2d2c","#2f4a3a","#5a2a26","#25344a"],Le=["#e8dfc9","#f1eee6","#d3b184","#e2d5ba"],Dt=[V[0],V[0],V[1],V[2],V[3],V[4],Ye[0],Ye[1],Ye[2],Le[0],Le[2]],Fn=["#2f4a3a","#25344a","#5a2a26","#2b2d2c","#e0a526"],En={canal:[V[4],V[4],V[1],V[2],Ye[0],Ye[1],Le[0]],c19:[V[0],V[3],V[1],Le[3],Le[2],Le[0]],school:[V[2],V[4],V[1],V[3]]},On=["#f1eee6","#f1eee6","#f1eee6","#e8dfc9","#e8dfc9","#2b2d2c","#2f4a3a","#5a2a26","#25344a","#8b8f8c"];function In(){if(!Ln())return!1;let e=globalThis;return(e.__canalRecallToonFronts??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("toonFronts"):null))!=="candy"}var Xe=225;var Bt={wallPull:.7,glassLift:.5,liftBrick:!0},Pn={wallPull:.35,glassLift:.25,liftBrick:!1},Ju={photo:{cells:"photo",shadeBands:0,flatColour:!1,...Bt,cartoonRoofCells:!1,outline:!1,litWallGain:255/Xe},procedural:{cells:"procedural",shadeBands:0,flatColour:!1,...Bt,cartoonRoofCells:!1,outline:!1,litWallGain:1},untextured:{cells:"procedural",shadeBands:0,flatColour:!0,...Bt,cartoonRoofCells:!1,outline:!1,litWallGain:1},storybook:{cells:"storybook",shadeBands:0,flatColour:!1,...Pn,cartoonRoofCells:!1,outline:!0,litWallGain:1,tone:{hueShift:-4,satMul:1.15,satAdd:0,keepDarkBelow:0,lightMul:1,lightAdd:.03,lightMax:.9}},cartoon:{cells:"cartoon",shadeBands:3,flatColour:!1,...Pn,cartoonRoofCells:!0,outline:!0,litWallGain:1,tone:{hueShift:0,satMul:1.7,satAdd:.08,keepDarkBelow:.35,lightMul:1.08,lightAdd:0,lightMax:.85}}};var Me=(e,t,n)=>Math.max(t,Math.min(n,e));function A(e){let t=/^#?([0-9a-f]{6})$/i.exec(e.trim());if(!t)throw Error(`Bad colour ${e}`);let n=parseInt(t[1],16);return[n>>16&255,n>>8&255,n&255]}var L=e=>"#"+e.map(t=>Math.round(Me(t,0,255)).toString(16).padStart(2,"0")).join("");function O([e,t,n]){let r=e/255,o=t/255,a=n/255,s=Math.max(r,o,a),i=Math.min(r,o,a),c=(s+i)/2;if(s===i)return[0,0,c];let l=s-i,d=c>.5?l/(2-s-i):l/(s+i);return[(s===r?(o-a)/l+(o<a?6:0):s===o?(a-r)/l+2:(r-o)/l+4)*60,d,c]}function j([e,t,n]){let r=(1-Math.abs(2*n-1))*t,o=r*(1-Math.abs(e/60%2-1)),a=n-r/2,[s,i,c]=e<60?[r,o,0]:e<120?[o,r,0]:e<180?[0,r,o]:e<240?[0,o,r]:e<300?[o,0,r]:[r,0,o];return[(s+a)*255,(i+a)*255,(c+a)*255]}var qn=(e,t,n)=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n];var Nt={canal:-1/0,c19:1860,school:1915,modern:1945};var Te=["#76808f","#606b79","#8c939c"],Ke={procedural:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:Te},untextured:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:Te},photo:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:Te},storybook:{tile:["#b9553a","#a94a33","#c46a45"],slate:["#556070","#4a5666","#657282"]},cartoon:{tile:["#e85a3c","#f08a2b","#d94a3a"],slate:["#3f5f8f","#2f4a78","#4f7bb0"]}};var Q={gravel:{hex:"#9e9281",luma:[112,156],cell:"flat"},"bitumen-dark":{hex:"#56585e",luma:[62,96],cell:"flat"},"bitumen-light":{hex:"#a99b84",luma:[150,182],cell:"flat"},"white-membrane":{hex:"#d9d9d3",luma:[196,228],cell:"flat"},"pantile-red":{hex:"#b5543a",luma:[84,124],cell:"tile"},"pantile-dark":{hex:"#6a5248",luma:[64,98],cell:"tile"},slate:{hex:"#76808f",luma:[62,140],cell:"slate"},zinc:{hex:"#9aa1a6",luma:[138,176],cell:"slate"},sedum:{hex:"#7a8350",luma:[96,132],cell:"flat"},solar:{hex:"#2e3a52",luma:[44,70],cell:"flat"},terrace:{hex:"#a38d74",luma:[124,162],cell:"flat"},glass:{hex:"#8fa3ad",luma:[130,170],cell:"flat"}},ut={gravel:Q.gravel.hex,membrane:Q["white-membrane"].hex,bitumen:Q["bitumen-dark"].hex,pebble:Q["bitumen-light"].hex},Yn=[ut.gravel,ut.membrane,ut.bitumen,ut.pebble];var oe={tile:Ke.photo.tile,slate:Ke.photo.slate,flat:Yn};var Dn=["#d9674a","#e58a5c","#eab85f","#f0dfb8","#e5a396","#9dbb9b","#7ea3c2","#c9714a","#f2c14e","#b9a1c9"],Bn=["#2a8c8c","#e0a526","#d9453d","#2c4a7c","#7a3b6e","#2f6b45","#4aa3d9"],Nn={canal:{walls:Dn,accents:Bn},c19:{walls:Dn,accents:Bn},school:{walls:["#9c5a42","#8a4b3a","#a8664c","#7a4a40"],accents:["#2c4a7c","#2a8c8c","#e0a526"]},modern:{walls:["#f4efe6","#dcdcd6","#e9d9c0","#b9c4cc","#f0c9a9"],accents:["#2a8c8c","#d9453d","#2c4a7c","#e0a526"]}},Wn=["#ffffff","#f2d9c8","#d9b9a4","#e6c9b0","#c9a38c","#f0e4d2","#ffd9b0","#e8c0b0","#d0c8c0"],Hn=["#243a2f","#1f2a3a","#3a1f1c","#222222","#2f4a3c","#6b2b2b","#2c3e50"],Gn={cartoon:Nn,storybook:Nn,photo:{canal:{walls:Wn,accents:Hn},c19:{walls:Wn,accents:Hn},school:{walls:["#b89080","#a88070","#9c7868"],accents:["#1f2a3a","#243a2f","#3a1f1c"]},modern:{walls:["#f2f2ee","#d8d8d2","#e8dcc8","#c8d0d4"],accents:["#2c3e50","#6b2b2b","#243a2f"]}}};var Un=["#e8573d","#e8573d","#ee7f2c","#f2b92e","#f2b92e","#2a9d8f","#4672b0","#f3e6c8","#d96a4d"],Ee={photo:{canal:["#7a3b2c","#7a3b2c","#6b3428","#8c4632","#9a5846","#b05a40","#4a2e26","#2e2a27","#3e4a40","#5d605a","#e4ddcd"],c19:["#b05a40","#b05a40","#bd6a45","#a24d38","#c58b5e","#d3b184","#e2d5ba","#e2d5ba","#d9c5a4","#9a5846"],school:["#8c4a38","#7a4535","#9a5240","#6e3d33","#a85a3c","#5e3a32","#b0603f"],modern:["#c9b79a","#b9ad9a","#a8a49c","#d3c6ad","#8f8a82","#bfb3a0","#9c7a62","#b05a40"]},storybook:{canal:["#b9583f","#9a4a38","#7a4a3c","#4a5048","#3f4a5a","#ead9b0","#c8664a"],c19:["#c8664a","#d98b5f","#e0b36a","#ead9b0","#d9b995","#c9a08c","#c8664a"],school:["#a8553f","#9a5a48","#b87a5c","#c8664a","#8a4e40"],modern:null},cartoon:{canal:["#d9453d","#a8433a","#3b3b4a","#2a9d8f","#4672b0","#fffaf0","#e8573d"],c19:["#e8573d","#ee7f2c","#f2b92e","#f3e6c8","#d96a4d","#f2b92e"],school:["#d96a4d","#e8573d","#b9583f","#ee7f2c"],modern:null}},Ls={photo:["#f1eee6","#f1eee6","#f1eee6","#e8dfc9","#e8dfc9","#2b2d2c","#2f4a3a","#5a2a26","#25344a","#8b8f8c"],storybook:["#f6f1e4","#f6f1e4","#f6f1e4","#efe2c2","#efe2c2","#3a3d3c","#3f6a52","#8a3b33","#3a527a","#a3a8a4"],cartoon:["#fffaf0","#fffaf0","#fffaf0","#ffe9b8","#ffe9b8","#3b3b4a","#2a9d8f","#d9453d","#4672b0","#f2b92e"]};if(In()){for(let t of["canal","c19","school"])Ee.cartoon[t]=En[t];let e={walls:[...Dt],accents:[...Fn]};Gn.cartoon={canal:e,c19:e,school:e,modern:Gn.cartoon.modern},Un.splice(0,Un.length,...Dt),Ls.cartoon=On}var Qu={canal:{label:"canal-house centre (before 1860)",wall:Ee.photo.canal[0],roof:Ke.photo.tile[0]},c19:{label:"19th-century ring (1860-1914)",wall:Ee.photo.c19[0],roof:Ke.photo.tile[1]},school:{label:"Amsterdamse School (1915-1944)",wall:Ee.photo.school[0],roof:Ke.photo.slate[0]},modern:{label:"post-war and contemporary (1945+)",wall:Ee.photo.modern[0],roof:Yn[0]}};var Kn=["brick","stucco","accent","stone","frame","door","glass","roofTile","slate","bitumen","paint"],Wt={brick:"brick",accent:"brick",stucco:"stucco",stone:"stone",frame:"frame",door:"door",glass:"glass",roofTile:"tile",slate:"slate",bitumen:"flat",paint:"frame"},J={brick:3.36,stucco:2.4,accent:3.36,stone:1.28,frame:1,door:1,glass:1,roofTile:1.2,slate:1.2,bitumen:1.2,paint:1},de=[.3,.6],Fs="#f1ede2",Es="#cfc8b8";function Os(e){let[t,n,r]=O(A(e)),o=Me(.12+r*.9,de[0],de[1]);return L(j([t,Me(n,.12,.5),o]))}function Is(e){let[t,n,r]=O(A(e));return L(j([t,Me(n,0,.55),Me(r*1.06+.03,.4,.97)]))}function Ps(e){let t=A(e),[n,r,o]=O(t);return o>=.5?L(qn(t,A(Fs),.75)):L(j([n,r,Math.max(o,.16)]))}function Ds(e){let[t,n,r]=O(A(e));return L(qn(j([t,n,Math.max(r,.62)]),A(Es),.45))}function Bs(e){let[t,n,r]=O(A(e));return r>=.17?e.startsWith("#")?e.toLowerCase():"#"+e.toLowerCase():L(j([t,n<.15?0:n,.17]))}function Ns(e,t){let n=O(A(t))[2];if(e==="roofTile"){let[r,o]=O(A(t));return o<.2?oe.slate[1]:L(j([r,Me(o*1.1,.35,.6),Me(.2+n*.85,.38,.5)]))}return e==="slate"?n<.27?oe.slate[1]:n<.31?oe.slate[0]:oe.slate[2]:n<.4?oe.flat[2]:oe.flat[0]}var Fe="measured",Ws=.18,Xn=Xe/255;function Hs(e){let[t,n,r]=O(A(e)),[o,a,s]=A(L(j([t,n,Math.max(r,Ws)])));return L([o,a,s].map(i=>Math.min(255,Math.round(i/Xn))))}var we=32,xe=64,ce=[157.19,92.83,69.17],Zn=240.95,Jn=.16,Gs=255/(ce[0]+(Zn-ce[0])*Jn);function Ht(e,t){let n=t/(xe-1),r=n<.5?ce[0]+(ce[1]-ce[0])*(n/.5):ce[1]+(ce[2]-ce[1])*((n-.5)/.5),o=5-15*t/35,a=17-15*t/35,s=t<35&&e+.5>=o&&e+.5<a;return Math.min(255,Math.round((s?r+(Zn-r)*Jn:r)*Gs))}var Us=(()=>{let e=0;for(let t=0;t<xe;t++)for(let n=0;n<we;n++)e+=Ht(n,t);return e/(we*xe)})(),jn=.4;function js(e){let[t,n,r]=O(A(e)),a=(r>=jn?A(e):j([t,n,jn])).map(i=>i/(Us/255)),s=Math.max(1,...a.map(i=>i/255));return L(a.map(i=>Math.min(255,Math.round(i/s))))}var Vs=228/255;function zs(e){return L(A(e).map(t=>Math.min(255,Math.round(t/Vs))))}function Vn(e){return L(A(e))}function zn(e){return L(A(e))}var qs=["brick","accent","glass","stone","bitumen","slate","roofTile"],Gt=(e,t)=>t===Fe&&qs.includes(e);function ct(e,t,n){if(n===Fe&&(e==="brick"||e==="accent"))return Hs(t);if(n===Fe&&e==="glass")return js(t);if(n===Fe&&e==="stone")return zs(t);if(n===Fe&&e==="bitumen")return It()?Pt(Vn(t)):Vn(t);if(n===Fe&&(e==="slate"||e==="roofTile"))return It()?Pt(zn(t)):zn(t);switch(e){case"brick":case"accent":return Os(t);case"stucco":return Is(t);case"stone":return Ds(t);case"frame":return Ps(t);case"door":return Bs(t);case"glass":return"#ffffff";case"paint":return t.startsWith("#")?t.toLowerCase():"#"+t.toLowerCase();default:return Ns(e,t)}}var Ut={asphalt:{base:[86,88,93]},cycle:{base:[150,66,58]},klinker:{base:[122,90,80],joint:"#4b3d38"},pavement:{base:[174,162,152],joint:"#7f756b"},kerb:"#cfcac0",paint:"#f2f0ea",rail:"#6c6e72",bollard:"#5a2a26"},Qn="#ffd21f",er="#ff8033",tr="#b4682c";var nr={land:{base:[168,158,142],joint:"#857b6d"},paving:{base:[184,174,158],joint:"#8f8577"},square:{base:[190,179,161],joint:"#958a7c"},klinker:{base:[158,124,114],joint:"#7a6660"},asphalt:[68,72,80],cycle:[156,76,66],gravel:[180,166,136],park:[96,140,70],wood:[70,112,58],parking:[102,102,105],kerb:"#aaa498",water:"#46707c",lawn:[110,154,74],bed:{soil:[98,80,60],leaf:[84,122,58]},shrub:{base:[56,92,46],leaf:[76,116,56]},bark:[118,84,58],sand:[212,194,150],parkGravel:[198,184,152],parkPath:[110,110,112],pond:"#46707c",bare:{base:[160,144,122],grit:[186,174,156]}};var Ks="highlight",Xs="__canalRecallHighlight",Zs="highlightAccent",Js="__canalRecallHighlightAccent",Ze={yellow:{keepMaterials:!1,outline:!1,rim:!1,desaturate:!1,ring:!1,beacon:!1,wash:!1,animated:!1},a:{keepMaterials:!0,outline:!0,rim:!1,desaturate:!1,ring:!0,beacon:!0,wash:!0,animated:!1},b:{keepMaterials:!0,outline:!1,rim:!0,desaturate:!1,ring:!0,beacon:!1,wash:!1,animated:!0},c:{keepMaterials:!0,outline:!1,rim:!1,desaturate:!0,ring:!0,beacon:!1,wash:!1,animated:!1}};var Qs=60,fe=.4,Oe=2,Yt=3.5,rr=100,ea=300;var ta=.75,jt=.35,na="__canalRecallHighlightBoost";function or(){let e=Number(globalThis[na]);return Number.isFinite(e)?Math.min(1,Math.max(0,e)):0}var Vt="__canalRecallHighlightExtent";function ur(){let e=globalThis;return e[Vt]instanceof Map?e[Vt]:e[Vt]=new Map}var ra=.3,oa=2.4,sa=.9,aa=2.2;var ia=.28;function sr(e){if(typeof e!="string")return null;let t=e.trim().toLowerCase();return t==="a"||t==="outline"?"a":t==="b"||t==="rim"?"b":t==="c"||t==="desaturate"?"c":t==="yellow"||t==="0"||t==="off"||t==="old"?"yellow":t==="default"?zt:null}var zt="a";function Ie(e){try{let t=globalThis;if(e===void 0){let n=sr(t[Xs]);if(n)return n}return sr(new URLSearchParams(e??t.location?.search??"").get(Ks))??zt}catch{return zt}}function cr(e=Ie(),t){if(e==="yellow")return Qn;try{let n=globalThis,r=(t===void 0?n[Js]:void 0)??new URLSearchParams(t??n.location?.search??"").get(Zs);if(r==="hud")return tr;if(typeof r=="string"&&/^#?[0-9a-f]{6}$/i.test(r))return r.startsWith("#")?r:`#${r}`}catch{}return er}function Kt(e=Ie()){return Ze[e].keepMaterials?{HL_KEEP:""}:{}}var Je=`
#ifdef HL_KEEP
#define HL_PAINT(h) false
#else
#define HL_PAINT(h) ((h) > 0.5 && (h) < 1.5)
#endif
#define HL_GHOST(h) ((h) > 2.5 && fract(dot(floor(gl_FragCoord.xy), vec2(0.569840296, 0.754877666))) >= ${ia.toFixed(3)})
float hlState(float hidden) { return hidden > 3.5 ? 3.0 : (hidden > 2.5 ? 2.0 : (hidden > 1.5 ? 1.0 : 0.0)); }
vec3 hlDesat(vec3 c, float h) { return h > 1.5 && h < 2.5 ? mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), ${fe.toFixed(2)}) : c; }`,la=110540,ua=e=>111320*Math.cos(e*Math.PI/180);function ca(e,t){let n=(e[1]+t[1])/2;return Math.hypot((e[0]-t[0])*ua(n),(e[1]-t[1])*la)}var dr=(e,t,n=Qs)=>!!e&&ca(e,t)<=n;var ar=`
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
  float far = clamp((length(c4.xyz - hlEye) - ${rr.toFixed(1)}) / ${(ea-rr).toFixed(1)}, 0.0, 1.0);
  float width = hlWidthPx * mix(1.0, hlFarScale, far);
  if (dot(dir, dir) > 1e-12) clip.xy += normalize(dir) * width * 2.0 / hlViewport * clip.w;
#endif
  gl_Position = clip;
}`,da=`
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
  if (up < ${jt.toFixed(2)} || hlWash <= 0.0) discard;
  gl_FragColor = vec4(hlAccent, hlWash * smoothstep(${jt.toFixed(2)}, ${(jt+.15).toFixed(2)}, up));
#else
  vec3 n = hlHasNormal > 0.5 ? normalize(vHlNormal) : normalize(cross(dFdx(vHlPos), dFdy(vHlPos)));
  vec3 v = normalize(hlEye - vHlPos);
  float f = pow(1.0 - abs(dot(n, v)), ${aa.toFixed(2)});
  float pulse = 0.775 + 0.225 * sin(hlTime * 6.2831853 / ${oa.toFixed(2)});
  gl_FragColor = vec4(hlAccent * f * ${sa.toFixed(2)} * pulse, 1.0);
#endif
}`,dt="canalRecallHighlightPass",fa="__canalRecallHighlightOutlinePx";function ma(){let e=globalThis[fa],t=e==null||e===""?NaN:Number(e);return Number.isFinite(t)&&t>=0?t:null}var ha=(e,t)=>{let[n,r,o]=A(t);return new e.Vector3(n/255,r/255,o/255)};function pa(e,t,n={}){let r={};n.merged&&(r.HL_MERGED=""),t==="outline"&&(r.HL_OUTLINE=""),t==="roof"&&(r.HL_ROOF="");let o=ar;if(n.feature){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n.feature.attribute))throw new Error(`highlight: bad feature attribute ${n.feature.attribute}`);r.HL_FEATURE=n.feature.attribute,o=`attribute float ${n.feature.attribute};
uniform float hlFeatureId;
${ar}`}let a=new e.ShaderMaterial({defines:r,uniforms:{hlViewport:{value:new e.Vector2(1,1)},hlWidthPx:{value:Oe},hlFarScale:{value:Yt/Oe},hlCentre:{value:new e.Vector3},hlDepthPush:{value:ra},hlAccent:{value:ha(e,n.accent??cr())},hlEye:{value:new e.Vector3},hlTime:{value:0},hlHasNormal:{value:1},hlFeatureId:{value:n.feature?.id??0},hlUp:{value:new e.Vector3(0,0,1)},hlWash:{value:0}},vertexShader:o,fragmentShader:da,side:t==="outline"?e.BackSide:e.FrontSide,transparent:!0,depthTest:!0,depthWrite:t==="outline",blending:t==="rim"?e.AdditiveBlending:e.NormalBlending,polygonOffset:t!=="outline",polygonOffsetFactor:-1,polygonOffsetUnits:t==="roof"?-4:-2});return a.name=`highlight/${t}${n.merged?"/merged":""}`,a.userData={[dt]:!0},a.defaultAttributeValues={hidden:[0],normal:[0,0,0]},a}function ba(e,t,n,r){let o=e.geometry?.boundingBox,a=t.elements;if(!o)return;let s=n.domElement,i=s?.clientWidth||r.x,c=s?.clientHeight||r.y,l=[],d=!1;for(let u=0;u<8;u++){let p=u&1?o.max.x:o.min.x,h=u&2?o.max.y:o.min.y,y=u&4?o.max.z:o.min.z,x=a[0]*p+a[4]*h+a[8]*y+a[12],g=a[1]*p+a[5]*h+a[9]*y+a[13],S=a[3]*p+a[7]*h+a[11]*y+a[15];if(!(S>1e-9)){d=!0;break}l.push((x/S+1)/2*i,(1-g/S)/2*c)}ur().set(e,{t:performance.now(),points:l,behind:d,width:i,height:c})}function ga(e){for(let t of e?.userData?.[dt]??[])e.remove(t),xa(t.material),ur().delete(t);e?.userData&&delete e.userData[dt]}var ya=4,qt=new Map,fr=Symbol("highlightPassPool");function Ma(e,t){return`${e}|${t.merged?1:0}|${t.feature?.attribute??""}|${t.accent??""}`}function wa(e,t,n={}){let r=Ma(t,n),o=qt.get(r)?.pop();if(o){let s=o.uniforms;return s.hlCentre.value.set(0,0,0),s.hlHasNormal.value=1,s.hlFeatureId.value=n.feature?.id??0,s.hlUp.value.set(0,0,1),s.hlWash.value=0,s.hlEye.value.set(0,0,0),s.hlTime.value=0,s.hlWidthPx.value=Oe,s.hlFarScale.value=Yt/Oe,o}let a=pa(e,t,n);return a.userData[fr]=r,a}function xa(e){let t=e?.userData?.[fr];if(!t){e?.dispose?.();return}let n=qt.get(t)??[];qt.set(t,n),n.length<ya&&!n.includes(e)?n.push(e):e.dispose()}function ir(e){let t=e?.getAttribute?.("position")??e?.attributes?.position;return!t||!!t.array}function mr(e,t,n={}){ga(t);let r=Ze[n.style??Ie()],o=[...r.outline?["outline"]:[],...r.rim?["rim"]:[],...r.wash&&!n.feature?["roof"]:[]];if(!o.length||!t?.geometry)return[];let a=t.geometry,s=n.centre;if(!s){!a.boundingBox&&ir(a)&&a.computeBoundingBox?.();let g=a.boundingBox?.getCenter(new e.Vector3)??a.boundingSphere?.center;s=g?[g.x,g.y,g.z]:[0,0,0]}let i=a.getAttribute?.("normal")?1:0,c=[],l=new e.Matrix4,d=new e.Vector4,u=new e.Vector2,p=new e.Matrix3,h=new e.Vector3,y=n.up??[0,0,1],x=!n.merged&&!n.feature&&!t.isInstancedMesh;x&&!a.boundingBox&&ir(a)&&a.computeBoundingBox?.();for(let g of o){let S=wa(e,g,{merged:n.merged,feature:n.feature,accent:n.accent??cr(n.style)});S.uniforms.hlCentre.value.set(s[0],s[1],s[2]),S.uniforms.hlHasNormal.value=i;let b=t.isInstancedMesh?new e.InstancedMesh(a,S,t.count):new e.Mesh(a,S);t.isInstancedMesh&&(b.instanceMatrix=t.instanceMatrix),b.name=`${t.name||"mesh"}/highlight-${g}`,b.frustumCulled=!1,b.castShadow=b.receiveShadow=!1,b.renderOrder=(t.renderOrder??0)+1,b.raycast=()=>{},g==="roof"&&Object.defineProperty(b,"visible",{get:()=>t.visible&&or()>.001,set:()=>{},configurable:!0}),b.onBeforeRender=(_,Y,v)=>{t.isInstancedMesh&&(b.count=t.count),g!=="roof"&&(b.visible=t.visible);let F=S.uniforms;if(g==="roof"){p.setFromMatrix4(b.matrixWorld),h.setFromMatrixColumn(b.matrixWorld,0);let q=h.length()<.001?[0,0,1]:y;F.hlUp.value.set(q[0],q[1],q[2]).applyMatrix3(p.invert()).normalize(),F.hlWash.value=ta*or()}_.getDrawingBufferSize(u),F.hlViewport.value.copy(u);let ee=_.domElement?.clientWidth||u.x,Z=ma();F.hlWidthPx.value=(Z??Oe)*(u.x/ee),F.hlFarScale.value=Z==null?Yt/Oe:1,l.multiplyMatrices(v.projectionMatrix,v.matrixWorldInverse).multiply(b.matrixWorld),g==="outline"&&x&&ba(b,l,_,u),l.invert(),d.set(0,0,1,0).applyMatrix4(l),Math.abs(d.w)>1e-12&&F.hlEye.value.set(d.x/d.w,d.y/d.w,d.z/d.w),F.hlTime.value=performance.now()/1e3,S.uniformsNeedUpdate=!0},t.add(b),c.push(b)}return t.userData??={},t.userData[dt]=c,c}var lr=new WeakMap;function Xt(e,t,n,r=Ie()){if(!t||n==="plain"||n==="highlight"&&Ze[r].keepMaterials)return t;let o=lr.get(t);o||lr.set(t,o=new Map);let a=`${n}|${r}`,s=o.get(a);if(s)return s;if(n==="highlight")s=new e.MeshLambertMaterial({color:16765471,emissive:7033856,side:t.side??e.FrontSide});else if(t.isShaderMaterial&&t.uniforms?.tint?.value?.isVector3)s=t.clone(),s.uniforms={...t.uniforms,tint:{value:Sa(t.uniforms.tint.value.clone())}};else if(t.isShaderMaterial&&t.uniforms?.hlDimAll)s=t.clone(),s.uniforms={...t.uniforms,hlDimAll:{value:1}};else if(t.isShaderMaterial)s=t.clone(),s.uniforms=t.uniforms,s.defines={...t.defines??{},HL_DIM_ALL:""};else{if(s=t.clone(),s.color){let i=s.color,c=.2126*i.r+.7152*i.g+.0722*i.b;i.setRGB(i.r+(c-i.r)*fe,i.g+(c-i.g)*fe,i.b+(c-i.b)*fe)}if(s.map){let i=s.onBeforeCompile;s.onBeforeCompile=(c,l)=>{i?.call(s,c,l),c.fragmentShader=c.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${fe.toFixed(2)});`)},s.customProgramCacheKey=()=>`${t.customProgramCacheKey?.()??""}|hl-dim`}}return s.name=`${t.name||"material"}/${n}`,s.userData={...t.userData??{},highlightVariantOf:t},o.set(a,s),s}function Sa(e){let t=.2126*e.x+.7152*e.y+.0722*e.z;return e.set(e.x+(t-e.x)*fe,e.y+(t-e.y)*fe,e.z+(t-e.z)*fe)}var me={k:.2,minL:.34,maxL:.93,chroma:2.4,maxC:.12,hue:{pull:.5,toward:40,warm:[20,85],capAt:[45,70],capC:[.12,.06]},neutralC:[.015,.03],coolKeep:.35,darkL:[.38,.46],darkGain:.35,darkLift:[.3,.5],paleL:[.65,.72],paint:{c0:.01,c1:.018,l0:.45,l1:.6}};function Ra(e,t){let{c0:n,c1:r,l0:o,l1:a}=me.paint,s=i=>Math.max(0,Math.min(1,i));return 1-(1-s((t-n)/(r-n)))*(1-s((e-o)/(a-o)))}var va=!0;function ka(e,t){let n=e?/[?&]wallChroma=([01])\b/.exec(e)?.[1]:void 0,r=n??(t==="0"||t==="1"?t:void 0);return r===void 0?va:r==="1"}var Zt;function Aa(){if(Zt!==void 0)return Zt;let e=globalThis;return Zt=ka(e.location?.search??null,e.process?.env?.WALL_CHROMA??null)}var Jt=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},_a=e=>255*(e<=.0031308?12.92*e:1.055*e**(1/2.4)-.055);function se(e){let t=parseInt(e.slice(1),16),n=Jt(t>>16&255),r=Jt(t>>8&255),o=Jt(t&255),a=Math.cbrt(.4122214708*n+.5363325363*r+.0514459929*o),s=Math.cbrt(.2119034982*n+.6806995451*r+.1073969566*o),i=Math.cbrt(.0883024619*n+.2817188376*r+.6299787005*o);return[.2104542553*a+.793617785*s-.0040720468*i,1.9779984951*a-2.428592205*s+.4505937099*i,.0259040371*a+.7827717662*s-.808675766*i]}function Qt([e,t,n]){let r=(e+.3963377774*t+.2158037573*n)**3,o=(e-.1055613458*t-.0638541728*n)**3,a=(e-.0894841775*t-1.291485548*n)**3;return[4.0767416621*r-3.3077115913*o+.2309699292*a,-1.2684380046*r+2.6097574011*o-.3413193965*a,-.0041960863*r-.7034186147*o+1.707614701*a]}var hr=e=>e.every(t=>t>=-1e-4&&t<=1+1e-4);function Pe(e){let[t,n,r]=e,o=Qt([t,n,r]);if(!hr(o)){let a=0,s=1;for(let i=0;i<20;i++){let c=(a+s)/2;hr(Qt([t,n*c,r*c]))?a=c:s=c}n*=a,r*=a,o=Qt([t,n,r])}return"#"+o.map(a=>Math.round(Math.max(0,Math.min(255,_a(Math.max(0,Math.min(1,a)))))).toString(16).padStart(2,"0")).join("")}function br(e,t={}){let[n,r,o]=se(e),a=Math.hypot(r,o),s=Ra(n,a),i=me.k*s*Math.max(0,Math.min(1,(n-me.darkLift[0])/(me.darkLift[1]-me.darkLift[0]))),c=Math.min(me.maxL,Math.max(t.minL??me.minL,1-(1-n)*(1-i)));if(t.fromPixel===!1||a<1e-6)return Pe([c,r,o]);let l=me,d=Y=>Math.max(0,Math.min(1,Y)),u=d((a-l.neutralC[0])/(l.neutralC[1]-l.neutralC[0]))*s,p=d((n-l.darkL[0])/(l.darkL[1]-l.darkL[0])),h=l.darkGain+(1-l.darkGain)*p,y=1-d((n-l.paleL[0])/(l.paleL[1]-l.paleL[0])),x=u*h*y,g=Math.atan2(o,r)*180/Math.PI;if(g<l.hue.warm[0]||g>l.hue.warm[1])return Pe([c,r*l.coolKeep,o*l.coolKeep]);if(Aa())return Pe([c,r,o]);g>l.hue.toward&&(g+=(l.hue.toward-g)*l.hue.pull*u*y*p);let S=d((g-l.hue.capAt[0])/(l.hue.capAt[1]-l.hue.capAt[0])),b=l.hue.capC[0]+(l.hue.capC[1]-l.hue.capC[0])*S,_=Math.min(a*(1+(l.chroma-1)*x),Math.max(a,b));return Pe([c,_*Math.cos(g*Math.PI/180),_*Math.sin(g*Math.PI/180)])}var Ca=["white","grey","buff","orange","red","red-brown","brown","dark"],en={white:"#e8e4da",grey:"#8a8d8f",buff:"#c4a574",orange:"#b8643c",red:"#9c4433","red-brown":"#8a4a3c",brown:"#6a4c3e",dark:"#2b2b2e"},$a=["brown","red-brown","red","orange","buff"];function pr(e,t=Ca){let[n,r,o]=se(e),a=t[0],s=1/0;for(let i of t){let[c,l,d]=se(en[i]),u=Math.hypot(n-c,r-l,o-d);u<s&&(s=u,a=i)}return a}var Ta=.05;function gr(e,t){let n=t.family??(t.brick?pr(e,$a):null);if(!n)return{hex:e,fromPixel:!0,family:null};let r=se(e)[0]>se(en[n])[0]+Ta,o=!!t.family&&pr(e)!==t.family;return r&&(t.brick||o)?{hex:en[n],fromPixel:!1,family:n}:{hex:e,fromPixel:!0,family:n}}var La=!1;function Fa(e,t){let n=(e?/[?&]modelWallFloor=([01])\b/.exec(e)?.[1]:void 0)??t??void 0;return n==="1"?!0:n==="0"?!1:La}var tn;function yr(){if(tn!==void 0)return tn;let e=globalThis;return tn=Fa(e.location?.search??null,e.process?.env?.MODEL_WALL_FLOOR??null)}function Mr(e,t){let n=gr(t,{brick:!0}),r=se(br(n.hex,{fromPixel:n.fromPixel}))[0],[o,a,s]=se(e);return o<=r+1e-4?e:Pe([r,a*r/o,s*r/o])}var K={other:0,wall:1,roof:2,lid:3,trim:4,cornice:5,frontage:6,extrasStrip:7,extrasBox:8,extrasOther:9,shell:10},Ea=[{name:"other",id:K.other,rgb:[0,0,0]},{name:"wall",id:K.wall,rgb:[255,255,255]},{name:"roof",id:K.roof,rgb:[255,0,0]},{name:"lid",id:K.lid,rgb:[128,0,128]},{name:"trim-decal",id:K.trim,rgb:[0,255,0]},{name:"cornice",id:K.cornice,rgb:[0,0,255]},{name:"frontage",id:K.frontage,rgb:[255,255,0]},{name:"extras-strip",id:K.extrasStrip,rgb:[255,0,255]},{name:"extras-box",id:K.extrasBox,rgb:[0,255,255]},{name:"extras-other",id:K.extrasOther,rgb:[128,128,0]},{name:"shell",id:K.shell,rgb:[0,128,128]}],wr=1,Oa=2,Ia=4e-6;var Pa=(e,t)=>e*t/2;function Da(e){let t=[e[1],e[5],e[9]],n=[e[3],e[7],e[11]],r=Math.hypot(n[0],n[1],n[2]);if(!(r>1e-12))return Math.hypot(t[0],t[1],t[2]);let o=(t[0]*n[0]+t[1]*n[1]+t[2]*n[2])/r;return Math.sqrt(Math.max(0,t[0]**2+t[1]**2+t[2]**2-o*o))/r}function Rr(e){try{return typeof URLSearchParams=="function"?new URLSearchParams(globalThis.location?.search??"").get(e):null}catch{return null}}function Ba(){let t=globalThis.__canalRecallThinFade??Rr("thinFade");return!(t===!1||t==="0"||t==="false"||t==="off")}function Na(){return(globalThis.__canalRecallThinDebug??Rr("thinDebug"))==="owner"?"owner":null}var Qe=e=>Number.isInteger(e)?e.toFixed(1):String(e),Wa=e=>`vec3(${e.map(t=>(t/255).toFixed(4)).join(", ")})`,Ha=`
attribute vec2 thin;
varying float vThinM;
flat varying float vThinClass;
`,Ga=`
vThinM = thin.x * 0.01; vThinClass = thin.y;
#ifdef CITY_THIN_FADE
if (thin.y > ${Qe(K.trim-.5)} && thin.y < ${Qe(K.trim+.5)}) gl_Position.z -= ${Ia.toExponential()} * gl_Position.w;
#endif
`,Ua=`
uniform float thinFocalPx;
varying float vThinM;
flat varying float vThinClass;
vec3 thinOwnerColour(float c) {
${Ea.map(e=>`  if (c < ${Qe(e.id+.5)}) return ${Wa(e.rgb)};`).join(`
`)}
  return vec3(0.5);
}
`,ja=`
#ifdef CITY_THIN_FADE
if (vThinM > 0.0) {
  float thinPx = vThinM * thinFocalPx / max(vFacDist, 0.01);
  float thinCover = clamp((thinPx - ${Qe(wr)}) / ${Qe(Oa-wr)}, 0.0, 1.0);
  if (thinCover < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= thinCover) discard;
}
#endif
`,xr=`
#ifdef CITY_THIN_OWNER
gl_FragColor = vec4(thinOwnerColour(vThinClass), 1.0);
#endif
`,nn={value:1e3};function Va(e){if(e?.getCurrentViewport){let t=e.getCurrentViewport(za);if(t&&t.w>0)return t.w}return e?.getDrawingBufferSize?e.getDrawingBufferSize(qa).y:0}var za={x:0,y:0,z:0,w:0,copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w,this}},qa={x:0,y:0,set(e,t){return this.x=e,this.y=t,this},floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}};function Sr(e,t,n){let r="void main() {",o=/vFacDist = length\([^;]*\);/,a="if (HL_GHOST(vHighlight)) discard;";if(!e.includes(r)||!o.test(e)||!t.includes(r)||!t.includes(a))return null;let s=e.replace(r,`${Ha}${r}`).replace(o,c=>`${c}${Ga}`),i=t.replace(r,`${Ua}${r}`).replace(a,`${a}${ja}`);if(n){if(!i.includes("#include <dithering_fragment>"))return null;i=i.replace("#include <dithering_fragment>",`#include <dithering_fragment>${xr}`)}else{let c=i.lastIndexOf("}");i=`${i.slice(0,c)}${xr}${i.slice(c)}`}return{vertex:s,fragment:i}}function vr(e,t,n={}){let r=n.fade??Ba(),o=n.debug===void 0?Na():n.debug;if(!r&&!o)return e;if(e.defines={...e.defines??{},...r?{CITY_THIN_FADE:""}:{},...o?{CITY_THIN_OWNER:""}:{}},e.defaultAttributeValues={...e.defaultAttributeValues??{},thin:[0,0]},t){let s=e.onBeforeCompile;e.onBeforeCompile=function(i,c){s?.call(this,i,c);let l=Sr(i.vertexShader,i.fragmentShader,!0);l&&(i.vertexShader=l.vertex,i.fragmentShader=l.fragment,i.uniforms.thinFocalPx=nn)}}else{let s=Sr(e.vertexShader,e.fragmentShader,!1);if(!s)return e;e.vertexShader=s.vertex,e.fragmentShader=s.fragment,e.uniforms={...e.uniforms,thinFocalPx:nn}}let a=e.onBeforeRender;return e.onBeforeRender=function(s,i,c,...l){a?.call(this,s,i,c,...l);let d=Va(s),u=c?.projectionMatrix?.elements,p=u?Da(u):NaN;d>0&&Number.isFinite(p)&&p>0&&(nn.value=Pa(p,d))},e.userData={...e.userData??{},thinFade:r,thinDebug:o},e}var kr=e=>{let t=globalThis,n=new RegExp(`[?&]${e}=([^&]*)`).exec(t.location?.search??"");return n?decodeURIComponent(n[1]):null};function rn(){let t=globalThis.__canalRecallDrawLimit??kr("drawLimit");return t===!0||t==="1"||t==="true"||t==="on"?!0:!(t===!1||t==="0"||t==="false"||t==="off")}var Ya=e=>Number.isInteger(e)?`${e}.0`:`${e}`,Ar=`(fogNear * (1.0 + fract(fogFar) * ${Ya(8)}))`;var Ka=!0;function _r(){if(!rn())return!1;let e=globalThis.__canalRecallLandmarkHaze??kr("landmarkHaze");return e===!0||e==="1"||e==="true"||e==="on"?!0:e===!1||e==="0"||e==="false"||e==="off"?!1:Ka}var Cr="DEPTH_FADE_LIMIT_ONLY";var Xa=.5,Za=.38,$r=250,Ja=600,Qa=.4;function Tr(){let e=globalThis,t=typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("fadeStrength"):null,n=e.__canalRecallFadeStrength??t,r=n==null||n===""?NaN:Number(n);return Number.isFinite(r)?Math.max(0,Math.min(2,r)):1}var Se=e=>Number.isInteger(e)?`${e}.0`:`${e}`;var ei=(e=Tr())=>`#ifdef USE_FOG
	float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	float fadeLuma = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( fadeLuma ), fogFactor * ${Se(Xa*e)} );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * ${Se(Za*e)} );
#endif`,fc=ei(1),Lr=`uniform vec3 fogColor;
	varying vec3 vFogEye;
	#define vFogDepth length( vFogEye )
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif`,mc=`#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
	${Lr}
#endif`,Fr=`
#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
#define DEPTH_FADE_FOG_PARS
	${Lr}
#endif
`,Er=(e,t=Tr(),n=rn())=>{let r=n?Ar:"fogFar";return`${Se(Math.min(1,t))} * smoothstep(max(${Se($r)}, fogNear), max(max(${Se(Ja)}, fogNear + (${r} - fogNear) * ${Se(Qa)}), max(${Se($r)}, fogNear) + 1.0), ${e})`};var ti="canalRecallDepthFadeOptOut";function Or(e,t=_r()){t&&e.fog!==!1?e.defines={...e.defines??{},[Cr]:""}:e.fog=!1,e.userData={...e.userData??{},[ti]:!0}}var Ir="inferred",ni=e=>O(A(e))[1]<.2,ri=e=>{let[t,n,r]=O(A(e));return(t<45||t>340)&&n>=.15&&r<.7},oi=e=>ni(e)?"slate":"roofTile",on=e=>ri(e)?"brick":"stucco",si=[{test:/glass|glaz|window|vitr|ruit|pane/,slot:"glass",confidence:"name",rule:"glazing name"},{test:/decal|sign|mural|logo|letter|clock|dial/,slot:"paint",confidence:"name",rule:"signage / decal"},{test:/door|deur|gate/,slot:"door",confidence:"name",rule:"door name"},{test:/frame|kozijn|louvre|louver|blind|shutter|rail|mullion|sash/,slot:"frame",confidence:"name",rule:"joinery name"},{test:/brick|baksteen|klinker|terracotta/,slot:"brick",confidence:"name",rule:"brick name"},{test:/slate|leien|lei$/,slot:"slate",confidence:"name",rule:"slate name"},{test:/bitumen|asphalt|tar$|felt|flatroof|flat-roof|gravel/,slot:"bitumen",confidence:"name",rule:"flat roof name"},{test:/roof|tile|pantile|dakpan|dak/,slot:oi,confidence:"name",rule:"roof name, grey \u2192 slate, else pantile"},{test:/sandstone|stone|steen|column|marble|granite|limestone|plinth/,slot:"stone",confidence:"name",rule:"stone name"},{test:/stucco|render|plaster|pleister|concrete|beton|slab/,slot:"stucco",confidence:"name",rule:"render / concrete name"},{test:/gold|gilt|bronze|copper|brass|zinc|metal|steel|iron|lead|alu/,slot:"paint",confidence:"name",rule:"metal name (flat colour)"},{test:/wall|facade|gevel/,slot:on,confidence:"name",rule:"wall name, brick hue \u2192 brick, else stucco"},{test:/ochre|yellow|buff/,slot:on,confidence:"colour-word",rule:"ochre: yellow brick (brick hue) or render"},{test:/pink|rose/,slot:"stucco",confidence:"colour-word",rule:"pink: painted render"},{test:/moss|grass|green|blue|orange|purple|paint|teal/,slot:"paint",confidence:"colour-word",rule:"coloured paint word"},{test:/white|cream|ivory/,slot:"stucco",confidence:"colour-word",rule:"white: stucco (could be white trim)"},{test:/dark|black|charcoal|anthracite/,slot:"frame",confidence:"colour-word",rule:"dark: painted joinery / ironwork (could be a dark wall)"},{test:/red/,slot:on,confidence:"colour-word",rule:"red: brick hue \u2192 brick (could be red tile or paint)"},{test:/grey|gray/,slot:"stucco",confidence:"colour-word",rule:"grey: render (could be concrete or zinc)"}];function Pr(e){return String(e??"").toLowerCase().replace(/[-_.\s]*\d+$/,"").trim()}function ai(e){let[t,n,r]=O(A(e));return r<.22?{slot:"frame",rule:"very dark: joinery / ironwork"}:n>=.15&&(t<45||t>340)&&r<.62?{slot:"brick",rule:"brick hue"}:n<.2&&r>=.6?{slot:"stucco",rule:"pale neutral: render"}:n<.2&&r>=.22&&t>180&&t<260?{slot:"slate",rule:"blue-grey: slate"}:n<.25?{slot:"stone",rule:"neutral mid-tone: stone"}:{slot:"paint",rule:"saturated colour: paint"}}function Dr(e,t){let n=t.toLowerCase(),r=Pr(e);for(let a of si)if(a.test.test(r))return{slot:typeof a.slot=="function"?a.slot(n):a.slot,tint:n,confidence:a.confidence,rule:a.rule};let o=ai(n);return{slot:o.slot,tint:n,confidence:"colour",rule:`no material word in "${r||"unnamed"}"; ${o.rule}`}}var Br=e=>/white|cream|ivory/.test(Pr(e)),Nr=e=>typeof e=="string"&&Kn.includes(e);var W=.045;var sn={ribs:{pitch:.5,min:.25,max:2,w:.09,out:.04},boards:{pitch:.4,min:.15,max:1.5,w:.05,out:.035},louvres:{pitch:.35,min:.2,max:1,w:.12,out:.12},panels:{pitch:1.2,min:.6,max:6,w:.05,out:.035}};var Gc={min:.15,max:sn.ribs.max};var Mi={installGate:{groups:!0,core:!1,solidBody:!0,clusterWall:!1},houseLine:{groups:!0,core:!0,solidBody:!0,clusterWall:!0}},Td={...Mi.installGate};var Vr={canal:["#6e5352","#8c7768","#977f73","#a79276","#b8a17a","#575245","#60564b","#62544d","#61584c","#655850","#655b50","#6a5454","#6f6058","#726359","#726459","#76615d","#77685d","#7a6c60","#826c66","#918174","#9a887f","#a89f8a","#6b6163","#dfdcd2"],c19:["#70564f","#6f5b52","#7a665c","#86695b","#886a5f","#857266","#8b746d","#9b887e","#a38e83","#ad9585","#61534a","#63564e","#685b52","#6f6057","#716259","#75665c","#7b6961","#7c6962","#7f6a64","#7f7664","#8e796f","#9c9181","#95787e","#dad8cf"],school:["#665247","#775744","#735d52","#786158","#8c5957","#896559","#856f63","#9d7f6d","#ad997f","#5c4f48","#61564c","#67564e","#6b5554","#6b5851","#6b5b50","#716057","#745e5b","#75655c","#78665f","#806d64","#89706b","#a19888","#614a4e","#a4a09f"],modern:["#715d53","#7c6459","#816b64","#8f7265","#9c8980","#ac9a86","#60594c","#635c4e","#6a5a50","#6c5a54","#6c5e55","#6e6256","#72675a","#776a5d","#7b6a61","#7f6f64","#807265","#886f6b","#8b7d6d","#958b79","#a29189","#695256","#a59b8d","#c8c5ba"]};var an={"#4f4834":[215,215,215],"#463823":[216,215,215],"#5f5950":[215,215,215],"#a69873":[215,215,215],"#57423e":[215,215,215],"#473c3b":[215,215,215],"#5d5d5c":[214,215,215],"#7e573b":[215,215,215],"#705449":[215,215,215],"#7f8283":[215,214,215],"#796764":[215,215,215],"#5d534b":[215,215,215],"#7d6e52":[215,215,215],"#88735e":[215,215,215],"#88715f":[215,215,215],"#736352":[215,215,215],"#241d1c":[172,172,172],"#4b3f37":[215,215,215],"#615551":[215,215,215],"#595651":[214,215,214],"#423931":[215,215,215],"#7b6d6a":[215,214,216],"#382418":[215,215,215],"#866343":[215,215,215],"#6e6256":[215,215,215],"#625650":[205,205,205],"#252c24":[185,185,186],"#2d281b":[215,214,215],"#3b342b":[215,215,215],"#6f5c56":[215,215,215],"#393535":[215,215,215],"#786357":[215,215,215],"#383d43":[205,215,215],"#554e4a":[215,216,215],"#3d3432":[215,215,215],"#3d353c":[215,215,215],"#4e443f":[215,215,215],"#70574d":[207,207,207],"#d49662":[215,215,215],"#917b5c":[215,215,215],"#494341":[215,215,215],"#645f5f":[215,215,214],"#342a18":[215,215,215],"#825746":[215,216,215],"#99604e":[212,215,215],"#706868":[215,215,215],"#786b61":[215,215,214],"#5c5b57":[215,215,215],"#7a655b":[215,215,215],"#6f5b54":[215,215,215],"#4a3f3a":[215,214,215],"#614f44":[216,215,215],"#654e44":[215,215,215],"#6f5f53":[215,215,216],"#584d49":[215,215,215],"#d3c9b2":[215,215,215],"#544b46":[215,215,215],"#929289":[215,215,215],"#68584f":[215,215,216],"#574d47":[215,215,215],"#5e4e41":[215,215,215],"#6e605a":[215,215,215],"#605d5c":[215,215,215],"#8c7a6f":[215,215,215],"#4a3832":[165,165,166],"#81614f":[215,215,215],"#3d3533":[215,215,215],"#6d5351":[215,215,215],"#5c3d33":[214,214,215],"#906553":[215,215,215],"#65493d":[215,215,215],"#8e5f49":[215,215,215],"#8c6858":[215,215,215],"#8b5946":[215,215,215],"#665253":[209,209,209],"#3e3222":[215,215,215],"#000000":[197,198,197],"#7b081b":[215,215,215],"#383131":[215,215,215],"#3d3b37":[211,215,215],"#877d76":[214,215,215],"#191d0c":[215,214,213],"#bcab88":[215,215,215],"#656462":[215,215,215],"#3f3634":[174,174,175],"#463e3c":[197,197,198],"#453d3a":[177,177,176],"#1f1a1b":[156,156,157],"#615450":[214,215,215],"#5b4f4b":[215,215,215],"#574c4a":[215,215,215],"#413333":[215,215,215],"#7b5c53":[215,215,215],"#5f342b":[216,215,215],"#4e2422":[215,215,215],"#5b4b44":[209,209,209],"#493d32":[215,215,215],"#6a5048":[216,216,215],"#5e5855":[215,215,215],"#5e3f35":[215,215,215],"#68564f":[215,215,215],"#6b3e33":[215,214,215],"#5f3c30":[215,214,215],"#929191":[215,215,215],"#a2acb3":[215,215,215],"#8f7b65":[215,215,215],"#988e7d":[215,215,215],"#726d60":[215,215,215],"#584c45":[215,214,215],"#594643":[216,215,215],"#5e5750":[212,215,215],"#78645b":[215,215,215],"#484440":[215,215,215],"#73645e":[215,215,215],"#5c4f47":[215,215,215],"#3c3d39":[215,215,215],"#645451":[215,215,214],"#37333d":[179,179,178],"#a6856f":[215,215,215],"#574d4d":[205,205,205],"#393737":[215,215,215],"#6f4a3b":[215,214,215],"#ffa169":[212,215,215],"#576465":[216,215,216],"#71614a":[215,215,215],"#6c584f":[215,215,215],"#5b463e":[215,216,215],"#765e52":[214,215,215],"#4f4e4c":[215,215,215],"#544945":[215,215,215],"#504140":[194,195,194],"#51514f":[215,215,215],"#74665f":[215,215,215],"#735c59":[215,215,215],"#474d56":[215,215,215],"#7d6e5a":[215,215,215],"#514a43":[215,215,215],"#4e4e49":[215,215,215],"#745c51":[215,215,215],"#47403c":[215,215,215],"#4c3a37":[215,215,215],"#675d5a":[215,215,215],"#574e48":[215,215,215],"#686360":[215,215,215],"#4a413f":[215,215,215],"#423735":[215,215,215],"#756860":[215,215,215],"#5e5144":[215,215,215]};var Gd={street:{...Ut,brick:Ut.klinker},tones:nr};var xi=["sunny","legacy"],Si="sunny";function he(e){let t=globalThis,r=/[?&]look=([\w-]+)/.exec(e??t.location?.search??"")?.[1]??t.__canalRecallLook;return xi.includes(r??"")?r:Si}var Ne=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},Ri=e=>255*(e<=.0031308?e*12.92:1.055*e**(1/2.4)-.055),ke=e=>{let t=parseInt(e.replace("#",""),16);return[t>>16&255,t>>8&255,t&255]},ln=e=>"#"+e.map(t=>Math.round(Math.max(0,Math.min(255,t))).toString(16).padStart(2,"0")).join(""),vi=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],Be=e=>vi(ke(e).map(Ne)),ki=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],Ai={zenith:"#9ec3ed",horizon:"#a1c6e5"};function _i(e){let t=e.sunElevationDeg*Math.PI/180,n=Be(e.sunColour)*e.sunIntensity/Math.PI,r=Be(e.skyColour)*e.skyIntensity/Math.PI,o=Be(e.groundColour)*e.skyIntensity/Math.PI,a=(r+o)/2;return{flat:n*Math.sin(t)+r,sunWall:n*Math.cos(t)+a,shadeWall:a}}var Ci=.55;function $i(e="#ffe2bf",t="#aca497",n=Ci){let r=40*Math.PI/180,o=c=>{let l=ln(ke(Ai.horizon).map(h=>h+(255-h)*c)),d=Be(e)*2.15/Math.PI*Math.cos(r),u=(Be(l)+Be(t))/2/Math.PI,p=n*d/(1-n)/u;return{sunColour:e,sunIntensity:2.15,skyColour:l,groundColour:t,skyIntensity:p,sunElevationDeg:40}},a=c=>{let l=o(c),d=ke(l.sunColour).map(Ne),u=ke(l.skyColour).map(Ne),p=[0,2].map(h=>d[h]*l.sunIntensity*Math.sin(r)+u[h]*l.skyIntensity);return p[0]/p[1]},s=0,i=1;for(let c=0;c<40;c++){let l=(s+i)/2;a(l)<1?s=l:i=l}return{...o(i),whiteMix:+i.toFixed(3)}}var De=$i(),zr=1/_i(De).sunWall,Kr={sunColour:De.sunColour,sunIntensity:+(De.sunIntensity*zr).toFixed(4),skyColour:De.skyColour,groundColour:De.groundColour,skyIntensity:+(De.skyIntensity*zr).toFixed(4)},qr=[.85,1.6],Ti=e=>typeof e=="string"?ke(e):e;function un(e){let t=e?Ne(219)/Ne(ki(Ti(e))):1.106;return Math.max(qr[0],Math.min(qr[1],t))}function Ae(e,t){let n=ke(e).map(o=>Ne(o)*t),r=Math.max(1,...n);return ln(n.map(o=>Ri(o/r)))}function Yr(e,t=an[e.toLowerCase()]){return Ae(e,un(t))}function Xr(e,t,n,r=he(),o){return r!=="sunny"||n!=="measured"||e!=="brick"&&e!=="accent"?t:o?Yr(t,o):Yr(t)}var Yd=(()=>{let e=Object.keys(an).map(ke),t=n=>n.slice().sort((r,o)=>r-o)[n.length>>1];return ln([0,1,2].map(n=>t(e.map(r=>r[n]))))})();var Li=2,Fi=.62;function Ei(e,t=Li){let n=Ae(e,t);if(O(A(e))[2]>=Fi)return n;let[r,o,a]=O(A(n));return a<=de[1]?n:L(j([r,o,de[1]]))}var Oi=e=>Object.fromEntries(Object.entries(e).map(([t,n])=>[t,n?n.map(r=>Ei(r)):null])),of=Oi(Vr);var Ii={anonymous:"This building has no name or date in the map data.",named:"The map data has no date for this building.",place:"A mapped place; the map data has no date for its building."},df=new Set(Object.values(Ii));var et=["canal","c19","school","postwar","modern","tower"];var Di=8;var Bf=16+Math.log2(Di);var I=256,Bi=["upper","ground","door","plain","shop"],Ni=2;var Gf=et.length*Ni*Bi.length;var X=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16));var Uf=X("#7d93a0"),jf=X("#1f2a33");var Vf=X("#b8ad98"),zf=X("#cfc6b4"),qf=X("#ece8dd"),Yf=X("#e2d9c2"),Kf=[X("#2c4a3d"),X("#3a2a22"),X("#1f3b57"),X("#5a2a24")],Xf=[X("#2f4a3a"),X("#7a2f27"),X("#27384f")];var Zr=.6;function mt(e,t,n){let r=Math.imul(e|0,374761393)^Math.imul(t|0,668265263)^Math.imul(n|0,2246822519);return r=Math.imul(r^r>>>13,1274126177),((r^r>>>16)>>>0)/4294967296}function Jr(e,t){let n=0;for(let o=0;o<e.length;o+=4)n+=e[o];let r=n/(e.length/4);for(let o=0;o<e.length;o+=4){let a=Math.round(Math.max(0,Math.min(255,r+(e[o]-r)*t)));e[o]=e[o+1]=e[o+2]=a}}function Qr(e,t){let n=new Uint8ClampedArray(I*I*4),r=(o,a,s,i,c)=>{let l=(a*I+o)*4,d=c??[s,s,s];n[l]=d[0],n[l+1]=d[1],n[l+2]=d[2],n[l+3]=i};if(e==="flat")for(let o=0;o<I;o++)for(let a=0;a<I;a++)r(a,o,Math.round((t?.96:.9+(mt(a>>3,o>>3,3)-.5)*.08)*255),255);else if(e==="tile"){let s=I/8,i=I/5;for(let c=0;c<I;c++)for(let l=0;l<I;l++){let d=Math.floor(c/s),u=c%s/s,p=(l+d%2*i*.5)%I,h=Math.floor(p/i),y=p%i/i,x=Math.sin(y*Math.PI),g=t?.92:.7+.22*x-.28*Math.pow(Math.max(0,1-u*3.2),1.5)*0-.22*Math.max(0,(.18-u)/.18);t||(g+=(mt(h,d,7)-.5)*.14);let S=t?u<.07||y<.035||y>.965:!1;r(l,c,Math.round(Math.max(0,Math.min(1,S?.28:g))*255),255)}t||Jr(n,Zr)}else if(e==="slate"){let s=I/11,i=I/6;for(let c=0;c<I;c++)for(let l=0;l<I;l++){let d=Math.floor(c/s),u=c%s/s,p=(l+d%2*i*.5)%I,h=Math.floor(p/i),y=p%i/i,x=t?.9:.82+(mt(h,d,11)-.5)*.16-.16*Math.max(0,(.16-u)/.16);(y<(t?.05:.025)||u<(t?.09:.04))&&(x=t?.3:x*.7),r(l,c,Math.round(Math.max(0,Math.min(1,x))*255),255)}t||Jr(n,Zr)}else for(let c=0;c<I;c++)for(let l=0;l<I;l++){let d=l/I,u=c/I,p=d>.2-.06&&d<.8+.06&&u>.2-.06&&u<.82+.06,h=d>.2+.03&&d<.8-.03&&u>.2+.03&&u<.82-.03,y=Math.abs(d-.5)<.018||Math.abs(u-.5)<.018;if(h&&!y){let x=(u-.2)/.6199999999999999,g=t?[150+60*x,200+30*x,235]:[40+80*x*x,55+90*x*x,68+90*x*x];r(l,c,0,0,[g[0],g[1],g[2]])}else if(p)r(l,c,0,0,t?[255,250,240]:[236,232,221]);else{let x=t?.92:.85+(mt(l>>3,c>>3,5)-.5)*.12,g=t&&(l<5||c<5||l>I-6||c>I-6);r(l,c,Math.round((g?.3:x)*255),255)}}return n}function eo(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let d=0;d<336;d+=112)o.drawImage(t,d,l,112,112);else{let l=7,d=()=>(l=l*16807%2147483647)/2147483647;for(let u=0,p=0;p<336;p+=14,u++)for(let h=-(u%2)*24;h<336;h+=48){let y=150+d()*50;o.fillStyle=`rgb(${y},${y*.92},${y*.86})`,o.fillRect(h,p,48,14)}}o.strokeStyle="rgba(235,223,205,0.18)",o.lineWidth=1.7;for(let l=0,d=6;d<336;d+=14,l++){o.beginPath(),o.moveTo(0,d),o.lineTo(336,d),o.stroke();for(let u=l%2*24;u<336;u+=48)o.beginPath(),o.moveTo(u,d),o.lineTo(u,d+14),o.stroke()}let a=o.getImageData(0,0,336,336),s=a.data,i=0;for(let l=0;l<s.length;l+=4)i+=(s[l]+s[l+1]+s[l+2])/3;i/=s.length/4;let c=i>0?Math.min(2.4,225/i):1;for(let l=0;l<s.length;l+=4){let d=(s[l]+s[l+1]+s[l+2])/3,u=Math.min(255,(d+(i-d)*.7)*c);s[l]=s[l+1]=s[l+2]=u,s[l+3]=255}return o.putImageData(a,0,0),r}function to(e){let t=e.createElement("canvas");t.width=64,t.height=128;let n=t.getContext("2d"),r=n.createLinearGradient(0,0,0,128);return r.addColorStop(0,"#8aa1b0"),r.addColorStop(.5,"#4d606c"),r.addColorStop(1,"#3c474e"),n.fillStyle=r,n.fillRect(0,0,64,128),n.fillStyle="rgba(235,242,248,0.16)",n.beginPath(),n.moveTo(10,0),n.lineTo(34,0),n.lineTo(4,70),n.lineTo(-20,70),n.closePath(),n.fill(),t}function no(e){let t=e.createElement("canvas");t.width=we,t.height=xe;let n=t.getContext("2d"),r=n.createImageData(we,xe);for(let o=0;o<xe;o++)for(let a=0;a<we;a++){let s=(o*we+a)*4,i=Ht(a,o);r.data[s]=r.data[s+1]=r.data[s+2]=i,r.data[s+3]=255}return n.putImageData(r,0,0),t}function ro(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d");n.fillStyle="#ffffff",n.fillRect(0,0,128,128),n.fillStyle="rgba(0,0,0,0.10)";for(let r=0;r<128;r+=16)n.fillRect(r,0,1.5,128);return t}function oo(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=23,a=()=>(o=o*16807%2147483647)/2147483647;for(let s=0;s<128;s++){let i=(a()-.5)*3;for(let c=0;c<128;c++){let l=(s*128+c)*4,d=a()<.012?-14:0,u=243+(a()-.5)*8+i+d;r.data[l]=r.data[l+1]=r.data[l+2]=u,r.data[l+3]=255}}return n.putImageData(r,0,0),t}function so(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=11,a=()=>(o=o*16807%2147483647)/2147483647;for(let s=0;s<r.data.length;s+=4){let i=228+(a()-.5)*16;r.data[s]=r.data[s+1]=r.data[s+2]=i,r.data[s+3]=255}return n.putImageData(r,0,0),n.fillStyle="rgba(80,70,60,0.18)",n.fillRect(0,0,128,1.5),t}function ht(e,t){let n=Qr(t,!1),r=Math.round(Math.sqrt(n.length/4)),o=e.createElement("canvas");o.width=o.height=r;let a=o.getContext("2d"),s=a.createImageData(r,r);for(let i=0;i<n.length;i+=4)s.data[i]=n[i],s.data[i+1]=n[i+1],s.data[i+2]=n[i+2],s.data[i+3]=255;return a.putImageData(s,0,0),o}var Wi=238;function ao(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let d=0;d<336;d+=112)o.drawImage(t,d,l,112,112);else{let l=13,d=()=>(l=l*16807%2147483647)/2147483647;for(let u=0,p=0;p<336;p+=14,u++)for(let h=-(u%2)*24;h<336;h+=48){let y=165+d()*30;o.fillStyle=`rgb(${y},${y*.93},${y*.88})`,o.fillRect(h,p,48,14)}}o.strokeStyle="rgba(245,240,230,0.26)",o.lineWidth=1.2;for(let l=0,d=6;d<336;d+=14,l++){o.beginPath(),o.moveTo(0,d),o.lineTo(336,d),o.stroke();for(let u=l%2*24;u<336;u+=48)o.beginPath(),o.moveTo(u,d),o.lineTo(u,d+14),o.stroke()}let a=o.getImageData(0,0,336,336),s=a.data,i=0;for(let l=0;l<s.length;l+=4)i+=(s[l]+s[l+1]+s[l+2])/3;i/=s.length/4;let c=i>0?Math.min(2.6,Wi/i):1;for(let l=0;l<s.length;l+=4){let d=(s[l]+s[l+1]+s[l+2])/3,u=Math.min(255,(d+(i-d)*.82)*c);s[l]=s[l+1]=s[l+2]=u,s[l+3]=255}return o.putImageData(a,0,0),r}function io(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=31,a=()=>(o=o*16807%2147483647)/2147483647;for(let s=0;s<128;s++)for(let i=0;i<128;i++){let c=(s*128+i)*4,l=246+(a()-.5)*3;r.data[c]=r.data[c+1]=r.data[c+2]=l,r.data[c+3]=255}return n.putImageData(r,0,0),t}function lo(e){let t=e.createElement("canvas");t.width=t.height=4;let n=t.getContext("2d");return n.fillStyle="#fff",n.fillRect(0,0,4,4),t}var uo={minFilter:"LinearMipmapLinear",magFilter:"Linear",generateMipmaps:!0};function Hi(e,t){let n=t.coarse?128:256,r=e==="facadeCells"?Math.min(t.gpuMaxAnisotropy,t.coarse?4:16):4;return{...uo,cellPx:n,anisotropy:r,tierScale:1}}function Gi(e,t){if(!t.enabled||t.coarse||t.tier!=="high")return Hi(e,t);let n=Number.isFinite(t.gpuMaxAnisotropy)&&t.gpuMaxAnisotropy>=1?t.gpuMaxAnisotropy:1,r=Number(t.cellPx),o=Number.isInteger(r)&&r>256&&r<=512&&r%32===0?r:256,a=Number(t.facadeAnisotropy),s=e==="facadeCells"?Number.isFinite(a)&&a>=1?Math.min(a,16):4:16;return{...uo,cellPx:o,anisotropy:Math.min(n,s),tierScale:o/256}}function Ui(){try{let e=globalThis,t=Number(e.__canalRecallTexAniso??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texAniso"):null)??NaN);return Number.isFinite(t)&&t>=1?t:null}catch{return null}}function ji(){try{let e=globalThis,t=e.__canalRecallTexturePolicy??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texturePolicy"):null);return!(t===!1||t==="0"||t==="false"||t==="off")}catch{return!0}}function Vi(){try{let e=globalThis,t=Number(e.__canalRecallCellPx??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("cellPx"):null)??NaN);return Number.isFinite(t)&&t>0?t:null}catch{return null}}function zi(){let e=globalThis.__canalPerf?.tier;return e==="low"||e==="mid"||e==="high"?e:null}function qi(){return!!globalThis.matchMedia?.("(pointer: coarse)").matches}function co(e,t){return Gi(e,{tier:zi(),coarse:qi(),gpuMaxAnisotropy:t,enabled:ji(),cellPx:Vi(),facadeAnisotropy:Ui()})}var We=(e,t)=>`(${e}.g + 1.0 - ${t}.a)`;function Yi(){let e=globalThis;return(e.__canalRecallMaskFormat??new URLSearchParams(e.location?.search??"").get("maskFormat"))==="rg"?"rg":"r8"}function fo(e,t,n=Yi()){let r=t.length>>1;if(e.length!==r*4)throw new Error(`packMask: ${e.length} colour bytes for ${r} mask texels`);if(n==="rg"){for(let a=0;a<r;a++)e[a*4+3]=255;return{colour:e,mask:t,channels:2}}let o=new Uint8Array(r);for(let a=0;a<r;a++)o[a]=t[a*2],e[a*4+3]=255-t[a*2+1];return{colour:e,mask:o,channels:1}}var Ki=70,Xi=190,Zi=.5,mo=15,ho=40;var cn="12.0";var po=[-1,-1];var bo=[-1,-1],go=()=>[Ki,Xi,Zi],pt=e=>Number.isInteger(e)?e.toFixed(1):String(e),yo=`
uniform vec2 roofLayers;
uniform vec3 roofTier;
vec3 roofTierColour(vec3 fine, vec2 uv, float layer, float dist) {
  if (roofLayers.x < 0.0 || layer < roofLayers.x - 0.5 || layer > roofLayers.y - 0.5) return fine;
  float mid = smoothstep(roofTier.x - ${pt(mo)}, roofTier.x + ${pt(mo)}, dist);
  if (mid <= 0.0) return fine;
  float far = smoothstep(roofTier.y - ${pt(ho)}, roofTier.y + ${pt(ho)}, dist);
  vec3 coarse = texture(cells, vec3(uv * roofTier.z, layer)).rgb;
  vec3 flatMean = textureLod(cells, vec3(uv, layer), ${cn}).rgb;
  return mix(mix(fine, coarse, mid), flatMean, far);
}`;var Ji={threshold:20,taps:9,spread:1,grad:.85,sdf:1},Qi=`
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
}`;function dn(e=Ji,t=1){let n=Number.isFinite(t)&&t>0?t:1;return{cellTaps:[e.threshold*n,e.taps,e.spread,e.grad],cellTapsSdf:e.sdf}}var Mo=`${Fr}
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
${Qi}
#endif
void cellTierSample(vec3 p, float dist, out vec3 c, out vec2 m) {
#ifdef CELL_LOD_BIAS
  vec4 cc = texture(cells, p, cellLodBias); vec2 mm = texture(masks, p, cellLodBias).rg;
#else
  vec4 cc = texture(cells, p); vec2 mm = texture(masks, p).rg;
#endif
  c = cc.rgb; m = vec2(mm.r, ${We("mm","cc")});
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
  far = max(far, ${Er("dist")});
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
      c = mix(c, tc.rgb, cellTapW); m = mix(m, vec2(tm.r, ${We("tm","tc")}), cellTapW);
    }
  }
#endif
  if (far <= 0.0) return;
  vec4 fc = textureLod(cells, p, ${cn}); vec2 fm = textureLod(masks, p, ${cn}).rg;
  c = mix(c, fc.rgb, far); m = mix(m, vec2(fm.r, ${We("fm","fc")}), far);
}`,el=[1,2];function fn(e,t=el){return{cellAniso:Number.isFinite(e)&&e>=1?e:1,cellAnisoRule:[1,1,t[0],t[1]]}}var tl=.5,gt={sunAzimuthDeg:215,sunElevationDeg:40,sunColour:"#ffe9cc",sunIntensity:2.15,skyColour:"#e3ebf6",groundColour:"#998a72",skyIntensity:1.75,shadows:!0,shadowMapSize:2048,shadowIntensity:1-tl};var gm={...gt,...Kr};function nl(e,t){let n=e*Math.PI/180,r=t*Math.PI/180;return[Math.sin(n)*Math.cos(r),Math.cos(n)*Math.cos(r),Math.sin(r)]}var ym=nl(gt.sunAzimuthDeg,gt.sunElevationDeg),yt=(()=>{let e=gt.sunAzimuthDeg*Math.PI/180;return[Math.sin(e),Math.cos(e)]})(),bt=[yt[0]*.6,yt[1]*.6,.8],wo=.84;function xo(e){let t=e[0]*bt[0]+e[1]*bt[1]+e[2]*bt[2];return Math.max(.5,Math.min(1,.58+.42*Math.max(0,t)))}var rl=xo([0,0,1]),tt=e=>Number.isInteger(e)?e.toFixed(1):String(+e.toFixed(6)),Mt=`
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = ${tt(wo)} + ${tt(1-wo)} * (0.5 + 0.5 * dot(h, vec2(${tt(yt[0])}, ${tt(yt[1])}))); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, dot(n, vec3(${bt.map(tt).join(", ")}))), 0.5, 1.0);`;var mn;function ol(e,t){let n=e?/[?&]wallRule=(\w+)/.exec(e)?.[1]:void 0,r=n??t??"";return r==="1"||r==="on"||r==="true"}function sl(){if(mn!==void 0)return mn;let e=globalThis;return mn=ol(e.location?.search??null,e.process?.env?.WALL_RULE??null)}var al=new Set(["#7a3e2c","#4e3027","#9a5236","#b39468","#6d6560","#2a2a2a","#e6e2d8","#d9ccaa","#9a9a94","#c8bb9c","#ece9e0","#e4dcc4","#26392f","#1e1e1e","#5a2224","#23303f","#7c7f7c","#4a3426","#7a5a3a","#9a5240","#7d7871","#ac624e"]);function il(e,t){return t==="measured"?"measured":al.has(e.toLowerCase())?"guessed":"measured"}function So(e,t,n){return!sl()||n==="measured"||e!=="brick"&&e!=="accent"?n:il(t,n)==="measured"?"measured":n}var hn={offset:.05,floor:.14,ceil:.6,paleL:.62,buff:{l:.5,s:.3,h:[35,65]},sat:[.12,.5],greyBelowS:.12,profileGain:.4};function ll(e){let[t,n,r]=O(A(e)),o=hn.buff;return r<hn.paleL&&!(r>=o.l&&n>=o.s&&t>=o.h[0]&&t<=o.h[1])}function Ro(e){if(!ll(e))return null;let[t,n,r]=O(A(e)),o=hn;return L(j([t,n<o.greyBelowS?n:Math.min(o.sat[1],Math.max(o.sat[0],n)),Math.min(o.ceil,Math.max(o.floor,r+o.offset))]))}var vo=[.4,2.5],ul=["brick","accent","stucco"];function cl(e){let t=(e?.white?un(e.white):1.106)*(e?.stripOverDrawn??1);return Math.max(vo[0],Math.min(vo[1],t))}var dl=["brick","accent"];function ko(e,t,n,r,o=he()){return o!=="sunny"||r==="measured"?t:n?ul.includes(e)?Ae(t,cl(n)):t:dl.includes(e)?Ae(t,1.106):t}var B=[{name:"magnified (rho < 1)",rgb:[255,0,0]},{name:"rho 1-2",rgb:[255,255,0]},{name:"rho 2-4",rgb:[0,255,0]},{name:"rho 4-8",rgb:[0,255,255]},{name:"rho 8-16",rgb:[0,0,255]},{name:"rho 16-tier",rgb:[255,128,0]},{name:"tier far > 0",rgb:[255,0,255]},{name:"depth-fade far > 0 (tier 0)",rgb:[255,255,255]},{name:"under fade > 0",rgb:[128,0,255]},{name:"roof layer",rgb:[128,128,128]}];var Om=B.length-1,fl=3;var ml=520,hl=ml.toFixed(1),pl=String(fl),N=e=>`vec3(${e.map(t=>(t/255).toFixed(4)).join(", ")})`,_o=`
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
#endif`;function He(e){try{return typeof URLSearchParams=="function"?new URLSearchParams(globalThis.location?.search??"").get(e):null}catch{return null}}var bl=1.25,Ao=[2.5,5],gl={footprint:1,fadePx:[2,4],frameMinPx:0,barPx:[0,0],tent:!0};function yl(){let t=globalThis.__canalRecallWindowSdfBand??He("windowSdfBand");return!(t===!1||t==="0"||t==="false"||t==="off")}var wt=(e,t)=>{if(e==null)return null;let n=e.split(",").map(Number);return n.length===t&&n.every(r=>Number.isFinite(r)&&r>=0)?n:null};function Ml(){let e=gl,t=wt(He("windowSdfFoot"),1)?.[0]??e.footprint,n=wt(He("windowSdfFade"),2)??e.fadePx,r=wt(He("windowSdfFrameMin"),1)?.[0]??e.frameMinPx,o=wt(He("windowSdfBar"),2)??e.barPx,a=He("windowSdfTent"),s=a==null?e.tent:a==="1";return{band:[yl()?1:0,t,n[0],n[1]],shape:[r,o[0],o[1],s?1:0]}}var pn=null;function Co(){let e=`${globalThis.location?.search??""}|${String(globalThis.__canalRecallWindowSdfBand)}`;pn?.key!==e&&(pn={key:e,v:Ml()});let t=pn.v;return{windowSdfBand:{value:[...t.band]},windowSdfShape:{value:[...t.shape]}}}var ae=["#6f8796","#2f4350","#1d2a33"],xt=e=>N([parseInt(e.slice(1,3),16),parseInt(e.slice(3,5),16),parseInt(e.slice(5,7),16)]),$o=`
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
  vec2 cell = vec2(${hl}, head.y);
  vec2 p = fract(uv) * cell;
  // The pixel's footprint from the continuous uv (fract jumps at the cell seam), in canvas px per framebuffer px.
  vec2 fpx = max(fwidth(uv * cell), vec2(1e-3));
  vec2 fw = fpx * (band ? windowSdfBand.y : ${bl.toFixed(2)});
#ifdef CELL_TAPS
  // The footprint prefilter's taps (roofTier.ts, lane R4-D #246) widen the edge box with the wall under the windows.
  fw *= mix(1.0, cellTapsSdf, cellTapW);
#endif
  vec2 fade = band ? windowSdfBand.zw : vec2(${Ao[0].toFixed(1)}, ${Ao[1].toFixed(1)});
  for (int i = 0; i < ${pl}; i++) {
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
    vec3 gc = g < 0.55 ? mix(${xt(ae[0])}, ${xt(ae[1])}, g / 0.55) : mix(${xt(ae[1])}, ${xt(ae[2])}, (g - 0.55) / 0.45);
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
#endif`;var Sl=["default","osm","3dbag","ahn","pdok-ortho","vision-judge","bag","monument-text","streetlevel-measured","reviewed"],uh=new Map(Sl.map((e,t)=>[e,t]));var P=["reviewed","default"],mh={plotWidthM:["bag","3dbag","streetlevel-measured",...P],depthM:["bag","3dbag",...P],eavesHeightM:["ahn","3dbag","streetlevel-measured",...P],ridgeHeightM:["ahn","3dbag","streetlevel-measured",...P],ridgeSagM:["ahn","streetlevel-measured",...P],storeys:["3dbag","osm","monument-text","streetlevel-measured",...P],storeyHeights:["streetlevel-measured",...P],hasSouterrain:["osm","monument-text","streetlevel-measured",...P],hasBelEtage:["osm","monument-text","streetlevel-measured",...P],gable:["monument-text","streetlevel-measured",...P],gableOrnament:["monument-text","streetlevel-measured",...P],corniceType:["monument-text","streetlevel-measured",...P],dressings:["monument-text","streetlevel-measured",...P],windowType:["monument-text","streetlevel-measured",...P],puiType:["monument-text","streetlevel-measured",...P],hoistBeam:["monument-text","streetlevel-measured",...P],bays:["monument-text","streetlevel-measured",...P],bayOffsetsM:["streetlevel-measured",...P],doorPositionM:["streetlevel-measured",...P],hoistBeamOffsetM:["streetlevel-measured",...P],leanDeg:["streetlevel-measured",...P],brick:["streetlevel-measured",...P]};var Bh=Object.freeze({shell:"3",roof:"11",frontage:"4",opening:"20",glazedBay:"1",facadeDetail:"11",ornament:"2",dormer:"8",nativeAperture:"1",cornice:"6",crown:"5",entrance:"9",hoist:"1"});var up={jamb:.32,out:2*W,entH:.42,maxTympanumH:1.4};var vl=.012,cp=W-vl,dp=2*W;var fp={postW:.14,postOut:3*W,railH:.12,railOut:2*W,maxSegM:9};var kl={postW:.1,postOut:3*W,railH:.1,railOut:2*W,maxSegM:9};var mp={back:W,out:2*W,minH:.15},hp={...kl,postOut:4*W,railOut:3*W};var Al={from:.15,to:.92,joint:.06,back:W,out:2*W,minW:.4};var pp={post:.24,postOut:4*W,sillH:.12,sillOut:.15,headGap:.06,maxSegM:9};var bp={bayOut:.45,flushOut:2*W,post:.18,slabH:.18,transomH:.1,slabOverhang:.18,maxSegM:9,postOut:2*W,slabOut:4*W};var bn={horizontalBars:[.25,.5,.75],horizontalBarWidthsM:[.03,.06,.03],mullionWidthM:.03},Db={sash:{verticalBars:[.5],horizontalBars:[.55]},"two-light":{verticalBars:[.5],horizontalBars:[.8]},"sash-small-panes":{verticalBars:[1/3,2/3],horizontalBars:[.25,.5,.75]},cross:{verticalBars:[.5],horizontalBars:[.36]},plain:{},arched:{verticalBars:[.5],horizontalBars:[.55]},shop:{},ladder:{horizontalBars:[.2,.4,.6,.8]},"sash-6-over-6":{verticalBars:[1/3,2/3],...bn},"sash-8-over-8":{verticalBars:[.25,.5,.75],...bn},"sash-4-over-4":{verticalBars:[.5],...bn},"sash-1-over-1":{horizontalBars:[.5],horizontalBarWidthsM:[.06]},"sash-9-over-9":{verticalBars:[1/3,2/3],horizontalBars:[1/6,1/3,.5,2/3,5/6],horizontalBarWidthsM:[.03,.03,.06,.03,.03],mullionWidthM:.03},"six-pane":{verticalBars:[.5],horizontalBars:[1/3,2/3],mullionWidthM:.045},"t-window":{horizontalBars:[.76],horizontalBarWidthsM:[.07],diagonalBars:[[[.5,.05],[.5,.73]]]},"small-over-one":{verticalBars:[.5],horizontalBars:[.62,.81],horizontalBarWidthsM:[.06,.03],mullionWidthM:.045,diagonalBars:[[[1/3,.65],[1/3,.95]],[[2/3,.65],[2/3,.95]]]},"cross-transom":{verticalBars:[.5],horizontalBars:[.6],horizontalBarWidthsM:[.07],diagonalBars:[[[.25,.05],[.25,.95]],[[.75,.05],[.75,.95]],[[.05,.3],[.95,.3]],[[.05,.8],[.95,.8]]]},"casement-toplight":{verticalBars:[.5],horizontalBars:[.8],horizontalBarWidthsM:[.05],mullionWidthM:.05},"casement-transom":{horizontalBars:[.8],horizontalBarWidthsM:[.05]},"casement-gridded-toplight":{verticalBars:[.5],horizontalBars:[.8],horizontalBarWidthsM:[.05],mullionWidthM:.05,diagonalBars:[[[.25,.81],[.25,.95]],[[.75,.81],[.75,.95]]]},"casement-triple":{verticalBars:[.27,.73],mullionWidthM:.05},"casement-toplight-double":{verticalBars:[.25,.5,.75],horizontalBars:[.8],horizontalBarWidthsM:[.05],mullionWidthM:.05},"casement-gridded-toplight-double":{verticalBars:[.25,.5,.75],horizontalBars:[.8],horizontalBarWidthsM:[.05],mullionWidthM:.05,diagonalBars:[.125,.375,.625,.875].map(e=>[[e,.81],[e,.95]])},"casement-pair":{verticalBars:[.5],mullionWidthM:.05},"casement-small-panes":{verticalBars:[.25,.5,.75],horizontalBars:[.36,.8],horizontalBarWidthsM:[.03,.05],mullionWidthM:.05},"casement-sidelights-toplight":{verticalBars:[.14,.86],horizontalBars:[.86],horizontalBarWidthsM:[.035],mullionWidthM:.035}};var Eo=["spout","neck","raised-neck","bell","step","point","cornice","flat","shouldered"];var Oo=["slate","black-tile","red-tile","bitumen","zinc","copper"];var gn=64;var p1=[...Oo,"flat-bitumen","unknown"];var Io={canal:2.5,c19:2.2,school:1.6,postwar:1.8,modern:2.1,tower:1.5},m=(e,t,n,r,o)=>({name:e,kind:t,byte:n,...r!==void 0?{bit:r,width:o}:{}}),yn=[m("wall","rgb",0),m("wallMaterial","bits",3,0,4),m("wallSrc","bits",3,4,2),m("lifted","bits",3,6,1),m("frame","rgb",4),m("frameSrc","bits",7,0,2),m("glassTone","bits",7,2,3),m("style","bits",7,5,3),m("wallHcm","u16",8),m("plinthDm","u8",10),m("seed","u8",11),m("roof","rgb",12),m("roofMaterial","bits",15,0,4),m("roofSrc","bits",15,4,2),m("lid","bits",15,6,1),m("storeys","u8",16),m("groundDm","u8",17),m("upperDm","u8",18),m("atticDm","u8",19),m("baysGround","u8",20),m("baysUpper","u8",21),m("baysAttic","u8",22),m("doorBay","u8",23),m("windowKind","u8",24),m("windowHead","bits",25,0,3),m("archRing","bits",25,3,2),m("keystone","bits",25,5,1),m("tympanum","bits",25,6,2),m("windowShare","u8",26),m("windowHeightQ","u8",27),m("cornice","bits",28,0,3),m("corniceDepthDm","bits",28,3,3),m("hoist","bits",28,6,1),m("shutters","bits",28,7,1),m("basement","bits",29,0,2),m("souterrain","bits",29,2,1),m("stoop","bits",29,3,1),m("balconies","bits",29,4,1),m("bayWindow","bits",29,5,1),m("tallGround","bits",29,6,1),m("dormers","bits",29,7,1),m("statedMask","u8",30),m("mirrored","bits",31,0,1),m("shareQ","bits",31,1,7),m("accent","rgb",32),m("bands","bits",35,0,3),m("bandLines","bits",35,3,3),m("sills","bits",35,6,1),m("quoins","bits",35,7,1),m("spekSpacing","u8",36),m("spekCourses","u8",37),m("surround","bits",38,0,3),m("archRingColour","bits",38,3,2),m("quoinsKind","bits",38,5,2),m("bandSillCm","u8",39),m("bandHeadCm","u8",40),m("bandTransomAt","u8",41),m("band","rgb",42),m("bandsSrc","bits",45,0,2),m("surroundSrc","bits",45,2,2),m("keystoneSrc","bits",45,4,2),m("quoinsSrc","bits",45,6,2),m("windowRevealCm","u8",46),m("doorRevealCm","u8",47),m("groundKind","bits",48,0,4),m("groundSrc","bits",48,4,2),m("awning","bits",48,6,1),m("stallriserOn","bits",48,7,1),m("entrance","bits",49,0,3),m("glazing","bits",49,3,2),m("stallriser","bits",49,5,2),m("fasciaOn","bits",49,7,1),m("fascia","rgb",50),m("shopPaint","rgb",53),m("displayWindows","u8",56),m("fasciaHeightDm","u8",57),m("stallriserDm","u8",58),m("shopStoreys2","bits",59,0,1),m("souterrainUnderStoop","bits",59,1,1),m("ribbonStorey1","bits",59,2,1),m("door","rgb",60)],b1=new Map(yn.map(e=>[e.name,e]));var R=e=>Number.isInteger(e)?e.toFixed(1):String(e),vt=e=>`vec3(${[1,3,5].map(t=>(parseInt(e.slice(t,t+2),16)/255).toFixed(5)).join(", ")})`;function Cl(){let e=t=>`((frT${t>>4}[${t>>2&3}] >> ${(t&3)*8}u) & 255u)`;return yn.map(t=>t.kind==="rgb"?`vec3 fr_${t.name}() { return vec3(float(${e(t.byte)}), float(${e(t.byte+1)}), float(${e(t.byte+2)})) / 255.0; }`:t.kind==="u16"?`float fr_${t.name}() { return float(${e(t.byte)} | (${e(t.byte+1)} << 8u)); }`:t.kind==="u8"?`float fr_${t.name}() { return float(${e(t.byte)}); }`:`float fr_${t.name}() { return float((${e(t.byte)} >> ${t.bit}u) & ${(1<<t.width)-1}u); }`).join(`
`)}var $l=`float frPitch(float style) { ${et.map((e,t)=>`if (style < ${R(t+.5)}) return ${R(Io[e])};`).join(" ")} return 2.0; }`,Tl=1;var ie=.0625,Ge=.22,Ue=.012,Wo=1.35,Ll=.14,Po=Ue/ie+Ue/Ge-Ue/ie*(Ue/Ge),Fl=Po*Wo+(1-Po),Do=[1,0,.35,0,0,0,0],El=.6,Mn=.125,Bo=.22,No=[.55,.7],Ol=.5,_e=[[1,2,0,0,0],[3,4,0,0,0],[2,2,0,0,0],[1,1,0,0,0],[2,1,0,0,0],[1,1,0,0,0],[2,1,0,0,0],[1,5,0,0,0],[3,4,0,0,0],[4,4,0,0,0],[3,6,0,0,0],[2,3,0,0,0],[2,1,1,1,.3],[1,1,4,1,.3],[2,1,2,1,.3],[2,1,1,1,.25],[2,1,2,1,.25],[2,1,4,2,.3],[3,1,3,1,.25],[2,1,2,1,.25],[2,1,6,2,.3],[2,1,0,0,0],[2,4,0,0,0],[3,1,1,1,.25]],kt=.04,Il=.45,At=[0,.25,.4,.55,.5],Pl=e=>e.map(t=>`vec4(${t.map(R).join(", ")})`).join(", "),Dl=`
const vec4 FR_PANES[${_e.length}] = vec4[${_e.length}](${Pl(_e.map(e=>e.slice(0,4)))});
const float FR_PANE_TOP[${_e.length}] = float[${_e.length}](${_e.map(e=>R(e[4])).join(", ")});
// Bars dividing [a, b] into n parts (n - 1 bars of FR_BAR), box-filtered; their area share once a part is under a pixel.
float frBars(float x, float a, float b, float n, float fw) {
  if (n < 1.5) return 0.0;
  float part = (b - a) / n, t = (x - a) / part, d = abs(t - floor(t + 0.5)) * part;
  if (t < 0.5 || t > n - 0.5) return 0.0;
  float c = clamp(0.5 + (${R(kt/2)} - d) / fw, 0.0, 1.0);
  return mix(c, ${R(kt)} / part, smoothstep(0.5 * part, part, fw));
}
// Glazing bars of a window kind over the pane [x0, x1] x [y0, y1]; a transom bar under the toplight.
float frGlazing(vec2 p, vec2 fw, float x0, float x1, float y0, float y1, float kind) {
  int k = int(clamp(kind, 0.0, ${R(_e.length-1)}) + 0.5);
  vec4 g = FR_PANES[k]; float top = FR_PANE_TOP[k];
  float split = top > 0.0 ? y1 - (y1 - y0) * top : y1;
  float c;
  if (p.y < split) c = max(frBars(p.x, x0, x1, g.x, fw.x), frBars(p.y, y0, split, g.y, fw.y));
  else c = max(frBars(p.x, x0, x1, g.z, fw.x), frBars(p.y, split, y1, g.w, fw.y));
  if (top > 0.0) c = max(c, frCover(p.y, split - ${R(kt/2)}, split + ${R(kt/2)}, fw.y));
  return c;
}
// The reveal's shadow on the glass: a strip along the head and the left jamb as deep as the reveal (sun from the upper left).
float frReveal(vec2 p, vec2 fw, float x0, float y1, float depth) {
  return max(frCover(p.x, x0, x0 + depth, fw.x), frCover(p.y, y1 - depth, y1, fw.y)) * ${R(Il)};
}
float frHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// Brick coursing, mean 1 over the wall; it fades to its mean as a course falls under about two pixels. Brick patches
// (two bricks x two courses) carry the brick's texture further out (FR_MOTTLE, S6c).
float frBrick(vec2 w, vec2 fw, float material, float contrast) {
  float amp = material < 0.5 ? ${R(Do[0])} : (material > 1.5 && material < 2.5 ? ${R(Do[2])} : 0.0);
  if (amp <= 0.0) return 1.0;
  float prow = floor(w.y / ${R(Mn)}), pcol = floor((w.x + mod(prow, 2.0) * ${R(.5*Bo)}) / ${R(Bo)});
  float brickPatch = 1.0 + amp * contrast * ${R(El)} * (frHash(vec2(prow * 7.0 + 3.0, pcol * 3.0 + 11.0)) - 0.5)
    * (1.0 - smoothstep(${R(.3*Mn)}, ${R(.5*Mn)}, max(fw.x, fw.y)));
  amp *= contrast * (1.0 - smoothstep(${R(.25*ie)}, ${R(.6*ie)}, max(fw.x, fw.y)));
  if (amp <= 0.0) return brickPatch;
  float row = floor(w.y / ${R(ie)}), yy = w.y - row * ${R(ie)};
  float x = w.x + mod(row, 2.0) * ${R(.5*Ge)}, col = floor(x / ${R(Ge)}), xx = x - col * ${R(Ge)};
  float joint = max(1.0 - frCover(yy, ${R(Ue)}, ${R(ie)}, fw.y), 1.0 - frCover(xx, ${R(Ue)}, ${R(Ge)}, fw.x));
  float tone = 1.0 + (frHash(vec2(row, col)) - 0.5) * ${R(Ll)};
  return brickPatch * (1.0 + amp * (mix(tone, ${R(Wo)}, joint) / ${R(Fl)} - 1.0));
}
// Speklagen: spekCourses stone courses every spekSpacing + spekCourses courses, averaged when under a pixel.
float frSpek(float y, vec2 fw) {
  float s = fr_spekSpacing(), n = fr_spekCourses();
  if (s < 0.5 || n < 0.5) return 0.0;
  float per = (s + n) * ${R(ie)}, h = n * ${R(ie)};
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
  float h = k == 1 ? ${R(At[1])} : k == 2 ? ${R(At[2])} : k == 3 ? ${R(At[3])} : k == 4 ? ${R(At[4])} : 0.0;
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
`,Ho=`
attribute vec3 wall;
attribute float rec;
attribute float wallKind;
uniform float wallUnit;
varying vec3 vWall;
flat varying float vRec;
flat varying float vWallKind;
`,Go=`
vWall = wall * wallUnit; vRec = rec; vWallKind = wallKind;
`,Uo=`
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
  ivec2 at = ivec2((r % ${gn}) * 4, int(recBase + 0.5) + r / ${gn});
  frT0 = texelFetch(facadeRecords, at, 0); frT1 = texelFetch(facadeRecords, at + ivec2(1, 0), 0);
  frT2 = texelFetch(facadeRecords, at + ivec2(2, 0), 0); frT3 = texelFetch(facadeRecords, at + ivec2(3, 0), 0);
}
${Cl()}
${$l}
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
  return g < 0.55 ? mix(${vt(ae[0])}, ${vt(ae[1])}, g / 0.55) : mix(${vt(ae[1])}, ${vt(ae[2])}, (g - 0.55) / 0.45);
}
${Dl}
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
  float paleK = mix(1.0, ${R(Ol)}, smoothstep(${R(No[0])}, ${R(No[1])}, pow(dot(wl, vec3(0.2126, 0.7152, 0.0722)), 1.0 / 3.0)));
  vec3 wallC = fr_wall() * ${R(Tl)} * frBrick(w, fw, fr_wallMaterial(), facadeKnobs.x * paleK);
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
`;var F1=[...Eo,"cornice-ledge"];var Nl=["STRS","FOOT","ATTR","STYL","ROOF","GRP ","HIDE","SHEL","SHL1","FREC","CROW"],W1=Nl.slice(0,7);var ey=2**-17;var Wl=["kind","index","dup","xyCode","dx","dy","quadZ","quadH","quadU","quadDu","quadV","quadDv","z","u","v","layer","shade","colourSame","colour","bids"],ty=[...Wl,"thinCm","thinClass"];var jo=.02;var Hl={legacy:.9,sunny:1},Gl=(e=he())=>Hl[e],le=Gl(),nt=255/Xe,Ul=255/228,jl=255/243,Vl=255/246,Ct=[{cell:"brick",tileM:J.brick,clampUv:!1,litGain:nt*le,skyTint:!1},{cell:"stucco",tileM:J.stucco,clampUv:!1,litGain:jl*le,skyTint:!1},{cell:"stone",tileM:J.stone,clampUv:!1,litGain:Ul*le,skyTint:!1},{cell:"white",tileM:1,clampUv:!1,litGain:1,skyTint:!1},{cell:"door",tileM:J.door,clampUv:!1,litGain:1,skyTint:!1},{cell:"glass",tileM:J.glass,clampUv:!0,litGain:1,skyTint:!0},{cell:"tile",tileM:J.roofTile,clampUv:!1,litGain:nt*le,skyTint:!1},{cell:"slate",tileM:J.slate,clampUv:!1,litGain:nt*le,skyTint:!1},{cell:"flat",tileM:J.bitumen,clampUv:!1,litGain:nt*le,skyTint:!1},{cell:"brick20",tileM:J.brick,clampUv:!1,litGain:nt*le,skyTint:!1},{cell:"whiteStucco",tileM:J.stucco,clampUv:!1,litGain:Vl*le,skyTint:!1},{cell:"glassTint",tileM:J.glass,clampUv:!0,litGain:1,skyTint:!0}],_t=Ct.length,rt=Object.fromEntries(Ct.map((e,t)=>[e.cell,t])),xn=64,zl=3,ql=3.2,je={x0:.28,x1:.72,y0:.3,y1:.8,frame:.035},pe=e=>Number.isInteger(e)?e.toFixed(1):String(e),Yl=`
void cityWindowGrid(vec2 m, inout vec3 c, inout vec2 mk) {
  vec2 cell = fract(m / vec2(${pe(zl)}, ${pe(ql)}));
  vec2 lo = vec2(${pe(je.x0)}, ${pe(je.y0)}), hi = vec2(${pe(je.x1)}, ${pe(je.y1)});
  vec2 aa = max(fwidth(cell), vec2(1e-4));
  vec2 inO = smoothstep(lo - aa, lo + aa, cell) * (1.0 - smoothstep(hi - aa, hi + aa, cell));
  vec2 lg = lo + ${pe(je.frame)}, hg = hi - ${pe(je.frame)};
  vec2 inG = smoothstep(lg - aa, lg + aa, cell) * (1.0 - smoothstep(hg - aa, hg + aa, cell));
  float outer = inO.x * inO.y, glass = inG.x * inG.y;
  // far away the cells shrink under a pixel: fade the grid to the wall rather than shimmer
  float fade = 1.0 - smoothstep(0.08, 0.2, max(aa.x, aa.y));
  vec3 win = mix(vec3(0.86, 0.85, 0.82), mix(vec3(0.17, 0.21, 0.25), vec3(0.33, 0.39, 0.44), cell.y), glass);
  float k = outer * fade;
  c = mix(c, win, k);
  mk.r *= 1.0 - k;
  mk.g *= 1.0 - k;
}`,Kl=Nt.school;function Rn(e,t={}){let n=Zl(e,t);return t.windowGrid&&Xl.has(Wt[e])?n+xn:n}var Xl=new Set(["brick","stucco","stone"]);function Zl(e,t){let n=Wt[e],r=t.source==="measured";return n==="glass"&&r?rt.glassTint:n==="brick"&&!r&&typeof t.year=="number"&&t.year>=Kl?rt.brick20:n==="stucco"&&t.white?rt.whiteStucco:n==="frame"?rt.white:rt[n]}function Jl(){return Ct.map(e=>[1/e.tileM,e.clampUv?1:0,e.litGain,e.skyTint?1:0])}var Ql=.38,eu=.8,tu=.27,nu=.97,ru=.75,ou=.5,su=.12,au=(e,t)=>(e<45||e>340)&&t>=.2;function Ko(e,t,n,r=he(),o,a=!1,s=!1){if(s&&(e==="brick"||e==="accent")&&!Gt(e,n)&&yr())return Mr(Ko(e,t,n,r,o,a),t);if(Gt(e,n))return ct(e,Xr(e,t,n,r,o),n);let i=A(t),[c,l,d]=O(i);if(e==="slate"&&au(c,l))return ct("roofTile",t);if((e==="brick"||e==="accent")&&a){let u=Ro(t);if(u)return u}return(e==="brick"||e==="accent")&&l<su?L(j([c,l,Math.min(de[1],Math.max(de[0],.12+d*.9))])):e==="slate"&&d>Ql?L(j([c,Math.min(l,.12),Math.min(.72,d/eu)])):e==="slate"?d<tu?oe.slate[1]:oe.slate[0]:e==="frame"&&d>=.5&&d<ru?L(i):e==="stone"&&d<ou?L(i):ct(e,t)}function Xo(e,t,n,r=he(),o,a,s=!1,i=!1){let c=Ko(e,t,n,r,o,s,i),[l,d,u]=A(ko(e,c,a??null,n,r));return[l,d,u,255]}function iu(e,t,n){switch(t){case"brick":return eo(e,n);case"brick20":return ao(e,n);case"stucco":return oo(e);case"whiteStucco":return io(e);case"stone":return so(e);case"white":case"frame":return lo(e);case"door":return ro(e);case"glass":return to(e);case"glassTint":return no(e);case"tile":return ht(e,"tile");case"slate":return ht(e,"slate");case"flat":return ht(e,"flat")}}function lu(e,t,n){let r=n*n,o=new Uint8Array(r*4*_t),a=new Uint8Array(r*2*_t),s=e.createElement("canvas");s.width=s.height=n;let i=s.getContext("2d",{willReadFrequently:!0});return i.imageSmoothingQuality="high",Ct.forEach((c,l)=>{i.clearRect(0,0,n,n),i.drawImage(iu(e,c.cell,t),0,0,n,n);let d=i.getImageData(0,0,n,n).data;for(let u=0;u<n;u++)for(let p=0;p<n;p++){let h=((n-1-u)*n+p)*4,y=l*r+u*n+p;o[y*4]=d[h],o[y*4+1]=d[h+1],o[y*4+2]=d[h+2],o[y*4+3]=255,a[y*2]=255,a[y*2+1]=0}}),{colour:o,mask:a}}async function uu(e=document){let t=new Image;t.src=new URL("materials/ambientcg/Bricks057/colour.jpg",e.baseURI).href;try{return await t.decode(),t}catch{return null}}var vn=e=>`${e.lit?"lit":"unlit"}|${e.kind}|${e.kind==="slot"?e.uv??"uv":"-"}|${e.highlight?"hl":e.dim?"dim":"-"}|${e.side??0}${e.noFade?"|nofade":""}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf2":""}${e.lodBias?"|lodb":""}${e.aniso?"|aniso":""}${e.taps?"|taps":""}${$t(e)?"|frec":""}`,$t=e=>!!e.records&&e.lit&&e.kind==="chunk";function cu(e){let t={CITY_SLOT_COUNT:String(_t)};return e.kind==="slot"&&(t.CITY_SLOT=""),e.swap&&(t.CITY_SWAP=""),e.cellDebug&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CELL_DEBUG_RHO="",e.cellDebug==="under"&&(t.CELL_DEBUG_UNDER="")),e.windows&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CITY_WINDOW_SDF=""),e.lodBias&&e.kind==="chunk"&&(t.CELL_LOD_BIAS=""),e.aniso&&e.kind==="chunk"&&(t.CELL_TIER_ANISO=""),e.taps&&e.kind==="chunk"&&(t.CELL_TAPS=""),$t(e)&&(t.CITY_FACADE_RECORD=""),e.lit?(t.CITY_VARIANT_UNIFORMS="",{...t,...Kt()}):(e.kind==="slot"&&e.uv==="box"&&(t.CITY_BOX_UV=""),e.highlight?t.CITY_HIGHLIGHT="":e.dim&&(t.CITY_DIM=""),{...t,...Kt()})}function Vo(e){return{cityForce:{value:e.highlight?1:e.dim?2:0},cityBoxUv:{value:e.kind==="slot"&&e.uv==="box"?1:0}}}var du=e=>e.lit?`city-look-v4|lit|${e.kind}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf2":""}${e.lodBias?"|lodb":""}${e.aniso?"|aniso":""}${e.taps?"|taps":""}${$t(e)?"|frec":""}`:`city-look-v3|${vn({...e,side:0})}`,fu="vec3(1.0, 0.824, 0.122)",zo="vec3(1.0, 0.637, 0.0137)",qo="vec3(0.035, 0.05, 0.07)",mu=1,hu=.2,pu=.75,bu=1.8,Ve=e=>Number.isInteger(e)?e.toFixed(1):String(e),Zo=`
float cityGrain(vec3 cell) {
  float g = clamp(dot(cell, vec3(0.299, 0.587, 0.114)) / ${Ve(Xe/255)}, 0.45, 1.1);
  return mix(1.0, g, ${Ve(pu)});
}`,Jo=16,Qo=`
#ifdef CITY_SWAP
attribute float swapSlot;
uniform vec4 citySwapUnder[${Jo/4}];
uniform float cityUnder;
flat varying float vCityUnder;
#endif`,es=`
#ifdef CITY_SWAP
int citySw = int(swapSlot + 0.5) - 1;
vCityUnder = citySw >= 0 ? citySwapUnder[citySw / 4][citySw % 4] : cityUnder;
#endif`,gu=[.5,.59],ts=`
#define BOX_PANE_UV vec2(${gu.map(e=>e.toFixed(2)).join(", ")})
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
${Qo}
${Je}`,ns=`
${es}
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
  vGrid = step(${xn-.5}, layer);
  int cityS = int(clamp(layer - ${xn}.0 * vGrid + 0.5, 0.0, float(CITY_SLOT_COUNT - 1)));
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
#endif`,rs=`
vFacDist = length((modelViewMatrix * vec4(position, 1.0)).xyz);
if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`,os=`
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${yo}
${Mo}
${_o}
${$o}
${Yl}
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
${Zo}
${Je}`,ss=`
if (HL_GHOST(vHighlight)) discard;
#ifdef CITY_SWAP
float cityHash = fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296)));
if (cityFade < 1.0 && cityHash >= cityFade) discard;
// The complement of a replacement dissolving in over (or out from) this mesh: where it draws, this one does not.
if (cityHash < vCityUnder) discard;
#else
if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;
#endif`,as=`
vec2 cityUv = vSlot.y > 0.5 ? clamp(vFacUv, 0.0, 1.0) : vFacUv;
vec3 cityP = vec3(cityUv, vLayer);
vec3 cityC; vec2 cityM;
#ifdef CITY_SLOT
vec4 cityCC = texture(cells, cityP); vec2 cityMM = texture(masks, cityP).rg;
cityC = cityCC.rgb; cityM = vec2(cityMM.r, ${We("cityMM","cityCC")});
if (vGrid > 0.5) cityWindowGrid(vFacUv / vSlot.x, cityC, cityM);
#else
cellTierSample(cityP, vFacDist, cityC, cityM);
#ifdef CITY_WINDOW_SDF
windowSdf(cityUv, vLayer, 1.0 - cellFar, cityC, cityM);
#endif
cityC = roofTierColour(cityC, cityUv, vLayer, vFacDist);
#endif
float cityG = cityGrain(cityC);
cityC *= mix(vec3(1.0), vTint, cityM.r) * mix(vec3(1.0), vAccent, cityM.g);`,yu=`
uniform mat3 enuFromWorld;
${ts}
varying float vShade;
void main() {
${ns}
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
${Mt}
  vShade = shade;
#else
  vShade = tint.a;
#endif
${rs}
}`,Mu=`
precision highp float;
${os}
varying float vShade;
void main() {
${ss}
${as}
  if (HL_PAINT(vHighlight)) {
    float hlShade = clamp(1.0 - (1.0 - vShade) * ${Ve(bu)}, 0.6, 1.0);
    gl_FragColor = vec4(${fu} * (flatColour > 0.5 ? 1.0 : cityG) * hlShade, 1.0);
    return;
  }
  if (flatColour > 0.5) cityC = vTint;
  cityC = hlDesat(cityC, vHighlight);
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  gl_FragColor = vec4(cityC * shade, 1.0);
#ifdef CELL_DEBUG_RHO
  gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif
}`,wu=`
attribute float hidden;
flat varying float vHighlight;
varying float vFacDist;
#ifdef CITY_VARIANT_UNIFORMS
uniform float cityForce;
uniform float cityBoxUv;
#endif
${Qo}
${Je}
${Ho}`,xu=`
${es}
vHighlight = hlState(hidden);
#ifdef CITY_VARIANT_UNIFORMS
if (cityForce > 0.5) vHighlight = cityForce;
#endif
${Go}`,Su=`
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${Uo}
flat varying float vHighlight;
varying float vFacDist;
#ifdef CITY_SWAP
flat varying float vCityUnder;
#endif
${Zo}
${Je}`,Ru=`
vec3 cityC; vec2 cityM;
cityC = facadeRecordColour(cityM);
float cityG = cityGrain(cityC);`,vu=(e=null)=>({facadeRecords:{value:e},recBase:{value:0},facadeKnobs:{value:[1,1,1,0]},wallUnit:{value:jo}});function ku(e,t={}){return{cells:t.cells??{value:null},masks:t.masks??{value:null},slotBase:t.slotBase??{value:0},slotParams:t.slotParams??{value:Jl().map(n=>new e.Vector4(...n))},bands:t.bands??{value:0},flatColour:t.flatColour??{value:0},cityFade:t.cityFade??{value:1},wallGain:t.wallGain??{value:1},roofLayers:t.roofLayers??{value:bo},roofTier:t.roofTier??{value:go()},cellTier:t.cellTier??{value:po},enuFromWorld:t.enuFromWorld??{value:new e.Matrix3},citySwapUnder:t.citySwapUnder??{value:new Float32Array(Jo)},cityUnder:t.cityUnder??{value:0},windowTable:t.windowTable??{value:null},windowSdfMix:t.windowSdfMix??{value:1},cellLodBias:t.cellLodBias??{value:0},cellAniso:t.cellAniso??{value:fn(16).cellAniso},cellAnisoRule:t.cellAnisoRule??{value:fn(16).cellAnisoRule},cellTaps:t.cellTaps??{value:dn().cellTaps},cellTapsSdf:t.cellTapsSdf??{value:dn().cellTapsSdf},...Co(),...t.windowSdfBand?{windowSdfBand:t.windowSdfBand}:{},...t.windowSdfShape?{windowSdfShape:t.windowSdfShape}:{}}}var Au={accent:[1,1,1,1],hidden:[0],color:[1,1,1],uv:[0,0],uv1:[0,0],swapSlot:[0]},Sn="recipeLookShared";function _u(e,t,n){let r=cu(t),o=t.side??e.FrontSide,a,s;if(!t.lit)a=new e.ShaderMaterial({uniforms:n,defines:r,vertexShader:yu,fragmentShader:Mu,side:o});else{a=new e.MeshLambertMaterial({side:o,flatShading:t.kind==="chunk"}),a.defines={...a.defines??{},...r};let i=$t(t),c=i?{...Vo(t),...vu()}:Vo(t);i&&(s=c);let l=i?wu:ts,d=i?xu:ns,u=i?Su:os,p=i?Ru:as;a.onBeforeCompile=y=>{for(let x of Object.keys(n))y.uniforms[x]=n[x];Object.assign(y.uniforms,c),y.vertexShader=y.vertexShader.replace("#include <common>",`#include <common>${l}`).replace("#include <begin_vertex>",`#include <begin_vertex>${d}`).replace("#include <project_vertex>",`#include <project_vertex>${rs}`),y.fragmentShader=y.fragmentShader.replace("#include <common>",`#include <common>${u}
float cityLuma;`).replace("#include <dithering_fragment>",`#include <dithering_fragment>
#ifdef CELL_DEBUG_RHO
gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>${ss}`).replace("#include <map_fragment>",`${p}
#ifdef CITY_SLOT
cityC *= vSlot.z;
#else
cityC *= mix(1.0, wallGain * ${Ve(le)}, cityM.r);
#endif
if (flatColour > 0.5) cityC = ${i?"fr_wall()":"vTint"};
cityLuma = dot(cityC, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= HL_PAINT(vHighlight) ? ${zo} * ${Ve(mu)} * pow(flatColour > 0.5 ? 1.0 : cityG, 2.2) : pow(hlDesat(cityC, vHighlight), vec3(2.2));`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
if (HL_PAINT(vHighlight)) totalEmissiveRadiance += ${zo} * ${Ve(hu)};
#ifdef CITY_SLOT
else totalEmissiveRadiance += ${qo} * vSlot.w;
#else
// Bay glazing (dark, untinted texels): the same constant sky tint as landmark glass, never a hotspot.
else totalEmissiveRadiance += ${qo} * (1.0 - smoothstep(0.06, 0.2, cityLuma)) * (1.0 - cityM.r);
#endif`)};let h=du(t);a.customProgramCacheKey=()=>h,a.uniforms=n}return a.defaultAttributeValues={...Au},a.name=`city-look/${vn(t)}`,a.userData={cityLook:!0,cityVariant:{...t},[Sn]:!0},s&&(a.userData.facadeRecordUniforms=s),t.noFade&&Or(a),t.kind==="chunk"?vr(a,!!t.lit):a}function Cu(e){return e?e.isMeshBasicMaterial||e.userData?.unlit?"unlit (decal / emissive sign)":e.transparent||(e.opacity??1)<1?"transparent":e.vertexColors?"vertex colours":e.map?"own texture":null:"no material"}function $u(e,t){let n=e?.userData??{};if(Nr(n.materialSlot)&&typeof n.tint=="string"){let a=So(n.materialSlot,n.tint,n.tintSource==="measured"?"measured":void 0)==="measured";return{slot:n.materialSlot,tint:n.tint,inferred:n.materialSlotSource===Ir,...a?{source:"measured"}:{},...a&&typeof n.tintWhitePoint=="string"?{white:n.tintWhitePoint}:{},...n.windowGrid===!0?{windowGrid:!0}:{}}}if(!t||Cu(e)||!e.color)return null;let r="#"+e.color.getHexString(),o=Dr(e.name,r);return{slot:o.slot,tint:o.tint,inferred:!0}}function Yo(e,t,n,r,o={}){let a=t.getAttribute("position")?.count??0,s=Rn(n,o),i=Xo(n,r,o.source,void 0,o.whitePoint,o.exposure,!1,!0),c=t.getAttribute("layer"),l=t.getAttribute("tint");if(c&&l)return c.getX(0)===s&&Math.round(l.getX(0)*255)===i[0]&&Math.round(l.getY(0)*255)===i[1]&&Math.round(l.getZ(0)*255)===i[2];t.setAttribute("layer",new e.BufferAttribute(new Uint8Array(a).fill(s),1,!1));let d=new Uint8Array(a*4);for(let u=0;u<a;u++)d.set(i,u*4);return t.setAttribute("tint",new e.BufferAttribute(d,4,!0)),!0}function Tu(e,t,n,r,o,a={}){let s=r.getAttribute("normal"),i=r.getAttribute("layer"),c=r.getAttribute("tint");if(!s||!i||!c)return 0;let[l,d,u]=Xo("bitumen",o,a.source);t.updateWorldMatrix(!0,!0);let p=new e.Matrix4().copy(t.matrixWorld).invert().multiply(n.matrixWorld),h=new e.Matrix3().getNormalMatrix(p),y=new e.Vector3,x=Rn("bitumen",a),g=0;for(let S=0;S<s.count;S++)y.set(s.getX(S),s.getY(S),s.getZ(S)).applyMatrix3(h).normalize(),!(y.y<nu)&&(i.setX(S,x),c.setXYZW(S,l/255,d/255,u/255,1),g++);return g&&(i.needsUpdate=!0,c.needsUpdate=!0),g}var Lu="__canalRecallCityLookShared";function is(e,t={}){let n=globalThis,r=n[Lu]??=new Map,o=r.get(e);return o||r.set(e,o=Fu(e,t)),o}function Fu(e,t={}){let n=t.document??globalThis.document,r=t.size??(globalThis.matchMedia?.("(pointer: coarse)").matches?128:256),o=ku(e),a=new Map,s=null,i=!1,c=(u,p)=>{let h=new e.DataArrayTexture(u,r,r,_t);return h.format=p,h.type=e.UnsignedByteType,h.wrapS=h.wrapT=e.RepeatWrapping,h.minFilter=e.LinearMipmapLinearFilter,h.magFilter=e.LinearFilter,h.generateMipmaps=!0,h.anisotropy=t.anisotropy??co("slotCells",16).anisotropy,h.unpackAlignment=1,h.needsUpdate=!0,h.userData={bytes:u.byteLength,[Sn]:!0},h},l=(async()=>{if(!n)return;let u=t.brick!==void 0?t.brick:await uu(n),{colour:p,mask:h}=lu(n,u,r),y=fo(p,h);s={colour:c(y.colour,e.RGBAFormat),mask:c(y.mask,y.channels===1?e.RedFormat:e.RGFormat)},i||(o.cells.value=s.colour,o.masks.value=s.mask,o.slotBase.value=0)})(),d=u=>{let p=vn(u),h=a.get(p);return h||a.set(p,h=_u(e,u,o)),h};return{uniforms:o,ready:l,material:d,dress(u,{lit:p,infer:h=!1,year:y=null,wallExposure:x=null}){let g=0;return u.traverse(S=>{if(!S.isMesh||Array.isArray(S.material)||S.material?.userData?.cityLook)return;let b=$u(S.material,h);if(!b)return;let _=S.geometry;if(!_?.getAttribute("position"))return;let Y=!!_.getAttribute("uv");!Y&&!_.getAttribute("normal")&&_.computeVertexNormals();let v={year:y,white:b.inferred&&Br(S.material.name),source:b.source,...b.white?{whitePoint:b.white}:{},...x?{exposure:x}:{},...b.windowGrid?{windowGrid:!0}:{}};Yo(e,_,b.slot,b.tint,v)||(_=S.geometry=_.clone(),_.deleteAttribute("layer"),_.deleteAttribute("tint"),Yo(e,_,b.slot,b.tint,v)),b.inferred&&b.slot==="slate"&&!b.source&&Tu(e,u,S,_,b.tint,v);let F=S.material;S.material=d({lit:p,kind:"slot",uv:Y?"uv":"box",side:F.side}),S.userData.citySlot={slot:b.slot,tint:b.tint,...b.source?{source:b.source}:{},inferred:b.inferred,from:F.name,layer:Rn(b.slot,v)},F.userData?.[Sn]||F.dispose(),g++}),g},highlighted(u,p){let h=u?.userData?.cityVariant;return h?d({...h,highlight:p,dim:!1}):u},dimmed(u,p){let h=u?.userData?.cityVariant;return h?d({...h,highlight:!1,dim:p}):u},bindAtlas(u){i=!!u,u?(o.cells.value=u.colour,o.masks.value=u.mask,o.slotBase.value=u.slotBase):s&&(o.cells.value=s.colour,o.masks.value=s.mask,o.slotBase.value=0)},textureBytes(){return s&&!i?Math.round((s.colour.userData.bytes+s.mask.userData.bytes)*4/3):0}}}var Eu=2*Math.PI*6378137;function ls(e,t){return[(180+e)/360,(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+t*Math.PI/360)))/360]}var Ou=e=>1/Eu/Math.cos(e*Math.PI/180);function kn(e,t){let[n,r]=ls(e[0],e[1]),[o,a]=ls(t[0],t[1]),s=Ou(e[1]);return[(o-n)/s,(a-r)/s]}function Tt(e){let t=e.map(r=>r.anchor[0]),n=e.map(r=>r.anchor[1]);return[(Math.min(...t)+Math.max(...t))/2,(Math.min(...n)+Math.max(...n))/2]}var Iu=e=>Math.PI-(180+e)*Math.PI/180;function An(e,t){let[n,r]=kn(t,e.anchor),o=Iu(e.northOffsetDegrees),a=Math.cos(o),s=Math.sin(o),[i,c,l]=e.scale;return[a*i,0,-s*i,0,0,c,0,0,s*l,0,a*l,0,n,e.groundAltitudeMetres,r,1]}function ms(e){let t=new Map;for(let n of e)t.set(n.area??"default",[...t.get(n.area??"default")??[],n]);return t}function hs(e){let t=Tt(e);return Math.max(50,...e.map(n=>Math.hypot(...kn(t,n.anchor))))+30}var Pu=e=>`NL.IMBAG.Pand.${e}`;function _n(e){return[...new Set(e.flatMap(t=>[t.pand,...t.alsoSuppress??[]].map(Pu)))].sort()}function Cn(e){let t=e.L0/2,n=e.W0/2,r=e.E0,o={positions:[],normals:[],uvs:[],index:[]},a={positions:[],normals:[],uvs:[],index:[]},s=(u,p,h,y,x,g,S)=>{let b=u.positions.length/3;for(let _ of[p,h,y,x])u.positions.push(..._),u.normals.push(...g),u.uvs.push(...S(_));u.index.push(b,b+1,b+2,b,b+2,b+3)},i=u=>[u[0],u[1]],c=u=>[u[2],u[1]],l=u=>[u[0],u[2]];s(o,[-t,0,n],[t,0,n],[t,r,n],[-t,r,n],[0,0,1],i),s(o,[t,0,-n],[-t,0,-n],[-t,r,-n],[t,r,-n],[0,0,-1],i),s(o,[t,0,n],[t,0,-n],[t,r,-n],[t,r,n],[1,0,0],c),s(o,[-t,0,-n],[-t,0,n],[-t,r,n],[-t,r,-n],[-1,0,0],c);let d=e.R0!==void 0&&e.R0>r+.3?e.R0:void 0;if(d===void 0)s(a,[-t,r,n],[t,r,n],[t,r,-n],[-t,r,-n],[0,1,0],l);else{let u=d-r,p=Math.hypot(n,u),h=u/p,y=n/p;s(a,[-t,r,n],[t,r,n],[t,d,0],[-t,d,0],[0,y,h],l),s(a,[t,r,-n],[-t,r,-n],[-t,d,0],[t,d,0],[0,y,-h],l);let x=(g,S,b)=>{let _=o.positions.length/3,Y=b?[[g,r,-n],[g,r,n],[g,d,0]]:[[g,r,n],[g,r,-n],[g,d,0]];for(let v of Y)o.positions.push(...v),o.normals.push(S,0,0),o.uvs.push(...c(v));o.index.push(_,_+1,_+2)};x(t,1,!1),x(-t,-1,!0)}return{walls:o,roof:a}}function Du(e,t=ps){return e?Math.max(t,Math.round(3*Math.max(e.L0,e.E0))):t}function $n(e,t,n,r,o,a=20){let s=new Set(o?.near),i=new Set(o?.far),c=[],l=[];return e.forEach((d,u)=>{let p=Math.hypot(d.x-t.x,d.z-t.z),h=typeof n=="number"?n:n[u],y=s.has(u)?h+a:h-(i.has(u)?a:0),x=s.has(u)||i.has(u)?r+a:r;p<=y?c.push(u):p<=x&&l.push(u)}),{near:c,far:l,culled:e.length-c.length-l.length}}var ps=140,Bu=700;function Nu(e){let t=e.reduce((s,i)=>s+i.positions.length/3,0),n=e.reduce((s,i)=>s+(i.index?i.index.length:i.positions.length/3),0),r={positions:new Float32Array(t*3),normals:new Float32Array(t*3),uvs:new Float32Array(t*2),textures:new Float32Array(t),tints:new Float32Array(t*3),index:new Uint32Array(n)},o=0,a=0;for(let s of e){let i=s.matrix,c=s.positions.length/3,l=i[0],d=i[4],u=i[8],p=i[1],h=i[5],y=i[9],x=i[2],g=i[6],S=i[10],b=[h*S-y*g,y*x-p*S,p*g-h*x,u*g-d*S,l*S-u*x,d*x-l*g,d*y-u*h,u*p-l*y,l*h-d*p],_=l*b[0]+d*b[1]+u*b[2]<0;for(let v=0;v<c;v++){let F=s.positions[v*3],ee=s.positions[v*3+1],Z=s.positions[v*3+2],q=(o+v)*3;r.positions[q]=i[0]*F+i[4]*ee+i[8]*Z+i[12],r.positions[q+1]=i[1]*F+i[5]*ee+i[9]*Z+i[13],r.positions[q+2]=i[2]*F+i[6]*ee+i[10]*Z+i[14];let be=s.normals[v*3],ze=s.normals[v*3+1],ue=s.normals[v*3+2],ge=b[0]*be+b[1]*ze+b[2]*ue,Ce=b[3]*be+b[4]*ze+b[5]*ue,st=b[6]*be+b[7]*ze+b[8]*ue,te=(Math.hypot(ge,Ce,st)||1)*(_?-1:1);r.normals[q]=ge/te,r.normals[q+1]=Ce/te,r.normals[q+2]=st/te,r.uvs[(o+v)*2]=s.uvs[v*2]*s.uvScale,r.uvs[(o+v)*2+1]=s.uvs[v*2+1]*s.uvScale,r.textures[o+v]=s.texture,r.tints[q]=s.tint[0],r.tints[q+1]=s.tint[1],r.tints[q+2]=s.tint[2]}let Y=s.index?s.index.length:c;for(let v=0;v<Y;v+=3){let F=s.index?s.index[v]:v,ee=s.index?s.index[v+1]:v+1,Z=s.index?s.index[v+2]:v+2;r.index[a++]=o+F,r.index[a++]=o+(_?Z:ee),r.index[a++]=o+(_?ee:Z)}o+=c}return r}function Wu(e){let t=Math.max(1,e),n=Array.from({length:t},(r,o)=>o===t-1?`c = texture2D(t${o}, vUv).rgb;`:`if (vTex < ${o}.5) c = texture2D(t${o}, vUv).rgb; else`).join(`
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
${Mt}
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
}`}}var ot=10;function Hu(e){let t=Math.max(1,e),n=Array.from({length:t},(r,o)=>o===t-1?`btC = texture2D(btT${o}, vBtUv);`:`if (vBtTex < ${o}.5) btC = texture2D(btT${o}, vBtUv); else`).join(`
  `);return{declarations:`${Array.from({length:t},(r,o)=>`uniform sampler2D btT${o};`).join(`
`)}
varying float vBtTex;
varying vec3 vBtTint;
varying vec2 vBtUv;`,sample:`vec4 btC;
  ${n}
  diffuseColor *= vec4(btC.rgb * vBtTint, btC.a);
#undef USE_MAP
#include <map_fragment>`}}var us=new WeakMap;function Gu(e,t,n){let r=us.get(e.MeshLambertMaterial);r||(r=class extends e.MeshLambertMaterial{btTextures=[];constructor(a){super(a),this.onBeforeCompile=function(s){let{declarations:i,sample:c}=Hu(ot);for(let l=0;l<ot;l++)s.uniforms[`btT${l}`]={value:this.btTextures[l]??this.btTextures[0]??null};s.vertexShader=s.vertexShader.replace("#include <common>",`#include <common>
attribute float btTex;
attribute vec3 btTint;
varying float vBtTex;
varying vec3 vBtTint;
varying vec2 vBtUv;`).replace("#include <uv_vertex>",`#include <uv_vertex>
  vBtUv = uv; vBtTex = btTex; vBtTint = btTint;`),s.fragmentShader=s.fragmentShader.replace("#include <common>",`#include <common>
${i}`).replace("#include <map_fragment>",c)},this.customProgramCacheKey=function(){return`building-types/lit-merged/${ot}`}}copy(a){return super.copy(a),this.btTextures=[...a.btTextures??[]],this.onBeforeCompile=a.onBeforeCompile,this.customProgramCacheKey=a.customProgramCacheKey,this}},us.set(e.MeshLambertMaterial,r));let o=new r({map:t[0],side:n});return o.btTextures=[...t],o.name="building-types/lit-merged",o.userData={recipeLookShared:!0,litMerged:!0},o}function cs(e,t,n){if(!t?.isShaderMaterial)return t;let r=n.get(t);if(!r){let o=String(t.vertexShader).replace("mat3(modelMatrix) * normal","mat3(modelMatrix * instanceMatrix) * normal").replace("modelViewMatrix * vec4(position, 1.0)","modelViewMatrix * instanceMatrix * vec4(position, 1.0)");if(o===t.vertexShader)throw new Error("recipe look vertex shader changed: instancing patch no longer applies");r=new e.ShaderMaterial({uniforms:t.uniforms,vertexShader:o,fragmentShader:t.fragmentShader,side:t.side}),r.name=`${t.name}/instanced`,r.userData={...t.userData},n.set(t,r)}return r}var ds=new Set(["brick","stucco","stone"]),fs=new Set(["roofTile","slate","bitumen"]);async function bs(e,t){let{THREE:n}=e,r=e.nearMetres??ps,o=e.cullMetres??Bu;if(!t.length)throw new Error("no building-type instances");let a=Tt(t),s=new n.Group;s.name="building-types";let i=t.map(f=>new n.Matrix4().fromArray(An(f,a))),c=i.map(f=>({x:f.elements[12],z:f.elements[14]})),l=Math.max(50,...c.map(f=>Math.hypot(f.x,f.z)))+30,d=new Map,u=new Map;t.forEach((f,M)=>u.set(f.unit,[...u.get(f.unit)??[],M]));let p=[],h=[],y=[],x=t.map(()=>r),g=[],S=f=>!!(f?.isShaderMaterial&&f.uniforms?.map?.value&&f.uniforms.tint?.value&&f.uniforms.uvScale&&f.uniforms.enuFromWorld),b=f=>!!f?.userData?.cityLook,_=f=>!!(f?.isMeshLambertMaterial&&f.userData?.recipeLookShared&&!f.userData?.litMerged&&f.map&&f.color&&Math.abs(f.map.repeat.x-f.map.repeat.y)<1e-9&&!f.map.offset.x&&!f.map.offset.y&&!f.map.rotation),Y=!0,v=f=>S(f)||b(f)||Y&&_(f);for(let[f,M]of u){let w=await e.loadUnit(f);w.updateMatrixWorld(!0);let C;w.traverse($=>{$.userData?.nominal&&(C=$.userData.nominal)});let k=[];w.traverse($=>{$.isMesh&&k.push($)});for(let $ of k)S($.material)&&!g.includes($.material.uniforms.map.value)&&g.push($.material.uniforms.map.value),_($.material)&&!g.includes($.material.map)&&g.push($.material.map);if(y.push({unit:f,indices:M,meshes:k,nominal:C}),e.nearMetres===void 0)for(let $ of M)x[$]=Du(C,r)}Y=g.length<=ot,!Y&&y.some(f=>f.meshes.some(M=>_(M.material)))&&console.warn(`building types: ${g.length} textures, over ${ot}; lit units keep one draw per material`);let F=new Map,ee=f=>{if(b(f))return f;if(_(f)){let w=F.get(`lit|${f.side}`);return w||(w=Gu(n,g,f.side),F.set(`lit|${f.side}`,w)),w}let M=F.get(f.side);if(!M){let w={enuFromWorld:f.uniforms.enuFromWorld,hlDimAll:{value:0}};g.forEach((C,k)=>{w[`t${k}`]={value:C}}),M=new n.ShaderMaterial({uniforms:w,...Wu(g.length),side:f.side}),M.name="building-types/merged",M.userData={recipeLookShared:!0},F.set(f.side,M)}return M},Z=(f,M,w)=>{if(b(f.material)){let k=f.geometry.getAttribute("layer"),$=f.geometry.getAttribute("tint");return{...M,matrix:w,uvScale:1,texture:k.getX(0),tint:[$.getX(0),$.getY(0),$.getZ(0)]}}if(_(f.material)){let k=f.material.color;return{...M,matrix:w,uvScale:f.material.map.repeat.x,texture:g.indexOf(f.material.map),tint:[k.r,k.g,k.b]}}let C=f.material.uniforms.tint.value;return{...M,matrix:w,uvScale:f.material.uniforms.uvScale.value,texture:g.indexOf(f.material.uniforms.map.value),tint:[C.x,C.y,C.z]}},q=(f,M="recipe")=>{let w=new n.BufferGeometry;return w.setAttribute("position",new n.BufferAttribute(f.positions,3)),w.setAttribute("normal",new n.BufferAttribute(f.normals,3)),w.setAttribute("uv",new n.BufferAttribute(f.uvs,2)),w.setAttribute(M==="city"?"layer":M==="lit"?"btTex":"aTex",new n.BufferAttribute(f.textures,1)),w.setAttribute(M==="city"?"tint":M==="lit"?"btTint":"aTint",new n.BufferAttribute(f.tints,3)),w.setIndex(new n.BufferAttribute(f.index,1)),h.push(w),w},be=(f,M)=>{let w=[];for(let C=0;C<f.count;C++)w.push(f.getX(C)),M>1&&w.push(f.getY(C)),M>2&&w.push(f.getZ(C));return w},ze=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];for(let{unit:f,indices:M,meshes:w,nominal:C}of y){let k=new Map,$=new Map,T=new Map;for(let E of w){let D=E.geometry;if(!v(E.material)){let ne=new n.InstancedMesh(D,cs(n,E.material,d),M.length);ne.name=`${f}/near/${E.name}`,ne.userData.layer="near",p.push({mesh:ne,indices:M,local:E.matrixWorld.clone(),far:!1,triangles:(D.index?.count??D.attributes.position.count)/3}),s.add(ne);continue}let G=E.material.side;T.set(G,E.material),k.set(G,[...k.get(G)??[],Z(E,{positions:be(D.attributes.position,3),normals:be(D.attributes.normal,3),uvs:be(D.attributes.uv,2),index:D.index?.array},E.matrixWorld.elements)])}if(C){let E=z=>b(z.material)?z.userData?.citySlot?.slot:z.material?.userData?.materialSlot,D=z=>w.filter(H=>v(H.material)&&z.has(E(H))).sort((H,ye)=>ye.geometry.attributes.position.count-H.geometry.attributes.position.count)[0],G=D(ds),ne=D(fs),U=Cn(C);if(!G){let z=it=>w.filter(re=>it.has(re.material?.userData?.materialSlot)).sort((re,Et)=>Et.geometry.attributes.position.count-re.geometry.attributes.position.count)[0],H=z(ds),ye=z(fs)??H;for(let[it,re,Et]of[[H,U.walls,"walls"],[ye,U.roof,"roof"]]){if(!it||!re.index.length)continue;let $e=new n.BufferGeometry;$e.setAttribute("position",new n.Float32BufferAttribute(re.positions,3)),$e.setAttribute("normal",new n.Float32BufferAttribute(re.normals,3)),$e.setAttribute("uv",new n.Float32BufferAttribute(re.uvs,2)),$e.setIndex(re.index),h.push($e);let lt=new n.InstancedMesh($e,cs(n,it.material,d),M.length);lt.name=`${f}/far/${Et}`,lt.userData.layer="far",p.push({mesh:lt,indices:M,local:new n.Matrix4,far:!0,triangles:re.index.length/3}),s.add(lt)}}for(let[z,H]of[[G,U.walls],[ne,U.roof]]){if(!z||!H.index.length)continue;let ye=z.material.side;T.set(ye,z.material),$.set(ye,[...$.get(ye)??[],Z(z,{positions:H.positions,normals:H.normals,uvs:H.uvs,index:H.index},ze)])}}for(let[E,D]of[[k,!1],[$,!0]])for(let[G,ne]of E){let U=T.get(G),z=Nu(ne),H=new n.InstancedMesh(q(z,b(U)?"city":_(U)?"lit":"recipe"),ee(U),M.length);H.name=`${f}/${D?"far":"near"}/merged-${G}`,H.userData.layer=D?"far":"near",p.push({mesh:H,indices:M,local:new n.Matrix4,far:D,triangles:z.index.length/3}),s.add(H)}}let ue,ge=null,Ce=new n.Matrix4,st=new n.Matrix4().makeScale(0,0,0),te=new Map,qe=[],Tn={near:0,far:0,culled:0},Lt=f=>{ue=f;let M=new Set(f.near),w=new Set(f.far),C=0;for(let k of p){let $=k.indices.map((T,E)=>({global:T,k:E})).filter(({global:T})=>(k.far?w:M).has(T));$.forEach(({global:T},E)=>{Ce.multiplyMatrices(i[T],k.local),k.mesh.setMatrixAt(E,te.has(T)?st:Ce)}),k.mesh.userData.slotToGlobal=$.map(T=>T.global),k.mesh.count=$.length,k.mesh.instanceMatrix.needsUpdate=!0,k.mesh.visible=$.length>0,$.length&&(k.mesh.computeBoundingSphere(),k.mesh.computeBoundingBox(),C++)}Tn={near:f.near.length,far:f.far.length,culled:f.culled};for(let k of qe)k.mesh.visible=(k.layer.far?w:M).has(k.global)},Ft=(f=!1)=>{let M=e.getCentre();if(!M)return;let[w,C]=kn(a,[M.lng,M.lat]),k={x:w,z:C};!f&&ge&&Math.hypot(k.x-ge.x,k.z-ge.z)<10||(ge=k,Lt($n(c,k,x,o,ue)))};Lt({near:[],far:c.map((f,M)=>M),culled:0}),Ft(!0);let at=new n.Mesh(new n.BufferGeometry,new n.MeshBasicMaterial);return at.name="building-types/driver",at.frustumCulled=!1,at.onBeforeRender=()=>Ft(),s.add(at),{anchor:a,group:s,suppress:_n(t),radiusMetres:l,update:Ft,setHighlighted(f,M){let w=Ie(),C=Ze[w],k=new Set([...f].map(T=>String(T).replace(/^NL\.IMBAG\.Pand\./,"")));for(let T of qe)s.remove(T.mesh),T.mesh.dispose?.();qe=[],te.clear(),t.forEach((T,E)=>{k.has(T.pand)?te.set(E,"highlight"):C.desaturate&&M&&dr(M.lngLat,T.anchor)&&te.set(E,"dim")});let $=is(n);for(let[T,E]of te)for(let D of p){if(!D.indices.includes(T))continue;let G=D.mesh.material,ne=E==="highlight"?C.keepMaterials?G:b(G)?$.highlighted(G,!0):Xt(n,G,"highlight",w):b(G)?$.dimmed(G,!0):Xt(n,G,"dim",w),U=new n.InstancedMesh(D.mesh.geometry,ne,1);U.setMatrixAt(0,Ce.multiplyMatrices(i[T],D.local)),U.name=`${D.mesh.name}/${E}`,U.userData.slotToGlobal=[T],U.computeBoundingSphere(),U.computeBoundingBox(),E==="highlight"&&mr(n,U,{style:w,up:[0,1,0]}),s.add(U),qe.push({global:T,layer:D,mesh:U})}return ue&&Lt(ue),[...te.values()].filter(T=>T==="highlight").length},pandForHit(f,M){let w=f?.userData?.slotToGlobal;return M===void 0||!w?null:t[w[M]]?.pand??null},stats(){let f=p.filter(C=>C.mesh.visible&&C.mesh.count>0).length,M=0,w=0;for(let C of p)C.mesh.visible&&(C.far?w+=C.triangles*C.mesh.count:M+=C.triangles*C.mesh.count);return{instances:t.length,...Tn,units:u.size,drawCalls:f,nearTriangles:M,farTriangles:w}},dispose(){for(let f of qe)f.mesh.dispose?.();for(let f of p)f.mesh.dispose?.();for(let f of h)f.dispose();for(let f of F.values())f.dispose()}}}return Ss(Uu);})();

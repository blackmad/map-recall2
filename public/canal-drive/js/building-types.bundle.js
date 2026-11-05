"use strict";var CanalRecallBuildingTypes=(()=>{var Ze=Object.defineProperty;var ur=Object.getOwnPropertyDescriptor;var cr=Object.getOwnPropertyNames;var mr=Object.prototype.hasOwnProperty;var fr=(e,t)=>{for(var n in t)Ze(e,n,{get:t[n],enumerable:!0})},hr=(e,t,n,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of cr(t))!mr.call(e,o)&&o!==n&&Ze(e,o,{get:()=>t[o],enumerable:!(r=ur(t,o))||r.enumerable});return e};var dr=e=>hr(Ze({},"__esModule",{value:!0}),e);var ns={};fr(ns,{areaAnchor:()=>Ye,areaRadiusMetres:()=>sr,createBuildingTypes:()=>lr,farMassing:()=>St,groupByArea:()=>ar,instanceMatrix:()=>wt,partitionByDistance:()=>vt,suppressionIds:()=>Rt});var Qe={wallPull:.7,glassLift:.5,liftBrick:!0},At={wallPull:.35,glassLift:.25,liftBrick:!1},os={photo:{cells:"photo",shadeBands:0,flatColour:!1,...Qe,cartoonRoofCells:!1,outline:!1,litWallGain:255/225},procedural:{cells:"procedural",shadeBands:0,flatColour:!1,...Qe,cartoonRoofCells:!1,outline:!1,litWallGain:1},untextured:{cells:"procedural",shadeBands:0,flatColour:!0,...Qe,cartoonRoofCells:!1,outline:!1,litWallGain:1},storybook:{cells:"storybook",shadeBands:0,flatColour:!1,...At,cartoonRoofCells:!1,outline:!0,litWallGain:1,tone:{hueShift:-4,satMul:1.15,satAdd:0,keepDarkBelow:0,lightMul:1,lightAdd:.03,lightMax:.9}},cartoon:{cells:"cartoon",shadeBands:3,flatColour:!1,...At,cartoonRoofCells:!0,outline:!0,litWallGain:1,tone:{hueShift:0,satMul:1.7,satAdd:.08,keepDarkBelow:.35,lightMul:1.08,lightAdd:0,lightMax:.85}}};var ae=(e,t,n)=>Math.max(t,Math.min(n,e));function k(e){let t=/^#?([0-9a-f]{6})$/i.exec(e.trim());if(!t)throw Error(`Bad colour ${e}`);let n=parseInt(t[1],16);return[n>>16&255,n>>8&255,n&255]}var C=e=>"#"+e.map(t=>Math.round(ae(t,0,255)).toString(16).padStart(2,"0")).join("");function P([e,t,n]){let r=e/255,o=t/255,s=n/255,a=Math.max(r,o,s),i=Math.min(r,o,s),c=(a+i)/2;if(a===i)return[0,0,c];let l=a-i,m=c>.5?l/(2-a-i):l/(a+i);return[(a===r?(o-s)/l+(o<s?6:0):a===o?(s-r)/l+2:(r-o)/l+4)*60,m,c]}function U([e,t,n]){let r=(1-Math.abs(2*n-1))*t,o=r*(1-Math.abs(e/60%2-1)),s=n-r/2,[a,i,c]=e<60?[r,o,0]:e<120?[o,r,0]:e<180?[0,r,o]:e<240?[0,o,r]:e<300?[o,0,r]:[r,0,o];return[(a+s)*255,(i+s)*255,(c+s)*255]}var Lt=(e,t,n)=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n];var tt={canal:-1/0,c19:1860,school:1915,modern:1945};var et=["#76808f","#606b79","#8c939c"],ve={procedural:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:et},untextured:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:et},photo:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:et},storybook:{tile:["#b9553a","#a94a33","#c46a45"],slate:["#556070","#4a5666","#657282"]},cartoon:{tile:["#e85a3c","#f08a2b","#d94a3a"],slate:["#3f5f8f","#2f4a78","#4f7bb0"]}};var Re={gravel:{hex:"#9e9281",luma:[112,156],cell:"flat"},"bitumen-dark":{hex:"#56585e",luma:[62,96],cell:"flat"},"bitumen-light":{hex:"#a99b84",luma:[150,182],cell:"flat"},"white-membrane":{hex:"#d9d9d3",luma:[196,228],cell:"flat"},"pantile-red":{hex:"#b5543a",luma:[84,124],cell:"tile"},"pantile-dark":{hex:"#6a5248",luma:[64,98],cell:"tile"},slate:{hex:"#76808f",luma:[62,140],cell:"slate"},zinc:{hex:"#9aa1a6",luma:[138,176],cell:"slate"},sedum:{hex:"#7a8350",luma:[96,132],cell:"flat"},solar:{hex:"#2e3a52",luma:[44,70],cell:"flat"},terrace:{hex:"#a38d74",luma:[124,162],cell:"flat"},glass:{hex:"#8fa3ad",luma:[130,170],cell:"flat"}},De={gravel:Re.gravel.hex,membrane:Re["white-membrane"].hex,bitumen:Re["bitumen-dark"].hex,pebble:Re["bitumen-light"].hex},Tt=[De.gravel,De.membrane,De.bitumen,De.pebble],K={tile:ve.photo.tile,slate:ve.photo.slate,flat:Tt};var Se={photo:{canal:["#7a3b2c","#7a3b2c","#6b3428","#8c4632","#9a5846","#b05a40","#4a2e26","#2e2a27","#3e4a40","#5d605a","#e4ddcd"],c19:["#b05a40","#b05a40","#bd6a45","#a24d38","#c58b5e","#d3b184","#e2d5ba","#e2d5ba","#d9c5a4","#9a5846"],school:["#8c4a38","#7a4535","#9a5240","#6e3d33","#a85a3c","#5e3a32","#b0603f"],modern:["#c9b79a","#b9ad9a","#a8a49c","#d3c6ad","#8f8a82","#bfb3a0","#9c7a62","#b05a40"]},storybook:{canal:["#b9583f","#9a4a38","#7a4a3c","#4a5048","#3f4a5a","#ead9b0","#c8664a"],c19:["#c8664a","#d98b5f","#e0b36a","#ead9b0","#d9b995","#c9a08c","#c8664a"],school:["#a8553f","#9a5a48","#b87a5c","#c8664a","#8a4e40"],modern:null},cartoon:{canal:["#d9453d","#a8433a","#3b3b4a","#2a9d8f","#4672b0","#fffaf0","#e8573d"],c19:["#e8573d","#ee7f2c","#f2b92e","#f3e6c8","#d96a4d","#f2b92e"],school:["#d96a4d","#e8573d","#b9583f","#ee7f2c"],modern:null}};var as={canal:{label:"canal-house centre (before 1860)",wall:Se.photo.canal[0],roof:ve.photo.tile[0]},c19:{label:"19th-century ring (1860-1914)",wall:Se.photo.c19[0],roof:ve.photo.tile[1]},school:{label:"Amsterdamse School (1915-1944)",wall:Se.photo.school[0],roof:ve.photo.slate[0]},modern:{label:"post-war and contemporary (1945+)",wall:Se.photo.modern[0],roof:Tt[0]}};var Ft=["brick","stucco","accent","stone","frame","door","glass","roofTile","slate","bitumen","paint"],Ct={brick:"brick",accent:"brick",stucco:"stucco",stone:"stone",frame:"frame",door:"door",glass:"glass",roofTile:"tile",slate:"slate",bitumen:"flat",paint:"frame"},$={brick:3.36,stucco:2.4,accent:3.36,stone:1.28,frame:1,door:1,glass:1,roofTile:1.2,slate:1.2,bitumen:1.2,paint:1},Q=[.3,.6],br="#f1ede2",pr="#cfc8b8";function gr(e){let[t,n,r]=P(k(e)),o=ae(.12+r*.9,Q[0],Q[1]);return C(U([t,ae(n,.12,.5),o]))}function yr(e){let[t,n,r]=P(k(e));return C(U([t,ae(n,0,.55),ae(r*1.06+.03,.4,.97)]))}function xr(e){let t=k(e),[n,r,o]=P(t);return o>=.5?C(Lt(t,k(br),.75)):C(U([n,r,Math.max(o,.16)]))}function Mr(e){let[t,n,r]=P(k(e));return C(Lt(U([t,n,Math.max(r,.62)]),k(pr),.45))}function wr(e){let[t,n,r]=P(k(e));return r>=.17?e.startsWith("#")?e.toLowerCase():"#"+e.toLowerCase():C(U([t,n<.15?0:n,.17]))}function Rr(e,t){let n=P(k(t))[2];if(e==="roofTile"){let[r,o]=P(k(t));return o<.2?K.slate[1]:C(U([r,ae(o*1.1,.35,.6),ae(.2+n*.85,.38,.5)]))}return e==="slate"?n<.27?K.slate[1]:n<.31?K.slate[0]:K.slate[2]:n<.4?K.flat[2]:K.flat[0]}var fe="measured",Sr=.18,vr=225/255;function _r(e){let[t,n,r]=P(k(e)),[o,s,a]=k(C(U([t,n,Math.max(r,Sr)])));return C([o,s,a].map(i=>Math.min(255,Math.round(i/vr))))}var se=32,ie=64,Z=[157.19,92.83,69.17],Ot=240.95,Et=.16,Ar=255/(Z[0]+(Ot-Z[0])*Et);function nt(e,t){let n=t/(ie-1),r=n<.5?Z[0]+(Z[1]-Z[0])*(n/.5):Z[1]+(Z[2]-Z[1])*((n-.5)/.5),o=5-15*t/35,s=17-15*t/35,a=t<35&&e+.5>=o&&e+.5<s;return Math.min(255,Math.round((a?r+(Ot-r)*Et:r)*Ar))}var kr=(()=>{let e=0;for(let t=0;t<ie;t++)for(let n=0;n<se;n++)e+=nt(n,t);return e/(se*ie)})(),kt=.4;function Lr(e){let[t,n,r]=P(k(e)),s=(r>=kt?k(e):U([t,n,kt])).map(i=>i/(kr/255)),a=Math.max(1,...s.map(i=>i/255));return C(s.map(i=>Math.min(255,Math.round(i/a))))}var Tr=228/255;function Fr(e){return C(k(e).map(t=>Math.min(255,Math.round(t/Tr))))}function Cr(e){return C(k(e))}function Or(e){return C(k(e))}var Er=["brick","accent","glass","stone","bitumen","slate","roofTile"],Pt=(e,t)=>t===fe&&Er.includes(e);function Ie(e,t,n){if(n===fe&&(e==="brick"||e==="accent"))return _r(t);if(n===fe&&e==="glass")return Lr(t);if(n===fe&&e==="stone")return Fr(t);if(n===fe&&e==="bitumen")return Cr(t);if(n===fe&&(e==="slate"||e==="roofTile"))return Or(t);switch(e){case"brick":case"accent":return gr(t);case"stucco":return yr(t);case"stone":return Mr(t);case"frame":return xr(t);case"door":return wr(t);case"glass":return"#ffffff";case"paint":return t.startsWith("#")?t.toLowerCase():"#"+t.toLowerCase();default:return Rr(e,t)}}var rt={asphalt:{base:[86,88,93]},cycle:{base:[150,66,58]},klinker:{base:[122,90,80],joint:"#4b3d38"},pavement:{base:[174,162,152],joint:"#7f756b"},kerb:"#cfcac0",paint:"#f2f0ea",rail:"#6c6e72",bollard:"#5a2a26"},Dt="#ffd21f",It="#ff8033",Bt="#b4682c";var Nt={land:{base:[168,158,142],joint:"#857b6d"},paving:{base:[184,174,158],joint:"#8f8577"},square:{base:[190,179,161],joint:"#958a7c"},klinker:{base:[158,124,114],joint:"#7a6660"},asphalt:[68,72,80],cycle:[156,76,66],gravel:[180,166,136],park:[96,140,70],wood:[70,112,58],parking:[102,102,105],kerb:"#aaa498",water:"#46707c",lawn:[110,154,74],bed:{soil:[98,80,60],leaf:[84,122,58]},shrub:{base:[56,92,46],leaf:[76,116,56]},bark:[118,84,58],sand:[212,194,150],parkGravel:[198,184,152],parkPath:[110,110,112],pond:"#46707c"};var Dr="highlight",Ir="__canalRecallHighlight",Br="highlightAccent",Nr="__canalRecallHighlightAccent",_e={yellow:{keepMaterials:!1,outline:!1,rim:!1,desaturate:!1,ring:!1,beacon:!1,wash:!1,animated:!1},a:{keepMaterials:!0,outline:!0,rim:!1,desaturate:!1,ring:!0,beacon:!0,wash:!0,animated:!1},b:{keepMaterials:!0,outline:!1,rim:!0,desaturate:!1,ring:!0,beacon:!1,wash:!1,animated:!0},c:{keepMaterials:!0,outline:!1,rim:!1,desaturate:!0,ring:!0,beacon:!1,wash:!1,animated:!1}};var Gr=60,ee=.4,he=2,lt=3.5,Gt=100,Ur=300;var Hr=.75,ot=.35,Wr="__canalRecallHighlightBoost";function Ut(){let e=Number(globalThis[Wr]);return Number.isFinite(e)?Math.min(1,Math.max(0,e)):0}var at="__canalRecallHighlightExtent";function zt(){let e=globalThis;return e[at]instanceof Map?e[at]:e[at]=new Map}var $r=.3,Vr=2.4,zr=.9,jr=2.2;var qr=.28;function Ht(e){if(typeof e!="string")return null;let t=e.trim().toLowerCase();return t==="a"||t==="outline"?"a":t==="b"||t==="rim"?"b":t==="c"||t==="desaturate"?"c":t==="yellow"||t==="0"||t==="off"||t==="old"?"yellow":t==="default"?st:null}var st="a";function de(e){try{let t=globalThis;if(e===void 0){let n=Ht(t[Ir]);if(n)return n}return Ht(new URLSearchParams(e??t.location?.search??"").get(Dr))??st}catch{return st}}function jt(e=de(),t){if(e==="yellow")return Dt;try{let n=globalThis,r=(t===void 0?n[Nr]:void 0)??new URLSearchParams(t??n.location?.search??"").get(Br);if(r==="hud")return Bt;if(typeof r=="string"&&/^#?[0-9a-f]{6}$/i.test(r))return r.startsWith("#")?r:`#${r}`}catch{}return It}function ut(e=de()){return _e[e].keepMaterials?{HL_KEEP:""}:{}}var ct=`
#ifdef HL_KEEP
#define HL_PAINT(h) false
#else
#define HL_PAINT(h) ((h) > 0.5 && (h) < 1.5)
#endif
#define HL_GHOST(h) ((h) > 2.5 && fract(dot(floor(gl_FragCoord.xy), vec2(0.569840296, 0.754877666))) >= ${qr.toFixed(3)})
float hlState(float hidden) { return hidden > 3.5 ? 3.0 : (hidden > 2.5 ? 2.0 : (hidden > 1.5 ? 1.0 : 0.0)); }
vec3 hlDesat(vec3 c, float h) { return h > 1.5 && h < 2.5 ? mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), ${ee.toFixed(2)}) : c; }`,Yr=110540,Kr=e=>111320*Math.cos(e*Math.PI/180);function Xr(e,t){let n=(e[1]+t[1])/2;return Math.hypot((e[0]-t[0])*Kr(n),(e[1]-t[1])*Yr)}var qt=(e,t,n=Gr)=>!!e&&Xr(e,t)<=n;var Wt=`
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
  float far = clamp((length(c4.xyz - hlEye) - ${Gt.toFixed(1)}) / ${(Ur-Gt).toFixed(1)}, 0.0, 1.0);
  float width = hlWidthPx * mix(1.0, hlFarScale, far);
  if (dot(dir, dir) > 1e-12) clip.xy += normalize(dir) * width * 2.0 / hlViewport * clip.w;
#endif
  gl_Position = clip;
}`,Jr=`
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
  if (up < ${ot.toFixed(2)} || hlWash <= 0.0) discard;
  gl_FragColor = vec4(hlAccent, hlWash * smoothstep(${ot.toFixed(2)}, ${(ot+.15).toFixed(2)}, up));
#else
  vec3 n = hlHasNormal > 0.5 ? normalize(vHlNormal) : normalize(cross(dFdx(vHlPos), dFdy(vHlPos)));
  vec3 v = normalize(hlEye - vHlPos);
  float f = pow(1.0 - abs(dot(n, v)), ${jr.toFixed(2)});
  float pulse = 0.775 + 0.225 * sin(hlTime * 6.2831853 / ${Vr.toFixed(2)});
  gl_FragColor = vec4(hlAccent * f * ${zr.toFixed(2)} * pulse, 1.0);
#endif
}`,Be="canalRecallHighlightPass",Zr="__canalRecallHighlightOutlinePx";function Qr(){let e=globalThis[Zr],t=e==null||e===""?NaN:Number(e);return Number.isFinite(t)&&t>=0?t:null}var eo=(e,t)=>{let[n,r,o]=k(t);return new e.Vector3(n/255,r/255,o/255)};function to(e,t,n={}){let r={};n.merged&&(r.HL_MERGED=""),t==="outline"&&(r.HL_OUTLINE=""),t==="roof"&&(r.HL_ROOF="");let o=Wt;if(n.feature){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n.feature.attribute))throw new Error(`highlight: bad feature attribute ${n.feature.attribute}`);r.HL_FEATURE=n.feature.attribute,o=`attribute float ${n.feature.attribute};
uniform float hlFeatureId;
${Wt}`}let s=new e.ShaderMaterial({defines:r,uniforms:{hlViewport:{value:new e.Vector2(1,1)},hlWidthPx:{value:he},hlFarScale:{value:lt/he},hlCentre:{value:new e.Vector3},hlDepthPush:{value:$r},hlAccent:{value:eo(e,n.accent??jt())},hlEye:{value:new e.Vector3},hlTime:{value:0},hlHasNormal:{value:1},hlFeatureId:{value:n.feature?.id??0},hlUp:{value:new e.Vector3(0,0,1)},hlWash:{value:0}},vertexShader:o,fragmentShader:Jr,side:t==="outline"?e.BackSide:e.FrontSide,transparent:!0,depthTest:!0,depthWrite:t==="outline",blending:t==="rim"?e.AdditiveBlending:e.NormalBlending,polygonOffset:t!=="outline",polygonOffsetFactor:-1,polygonOffsetUnits:t==="roof"?-4:-2});return s.name=`highlight/${t}${n.merged?"/merged":""}`,s.userData={[Be]:!0},s.defaultAttributeValues={hidden:[0],normal:[0,0,0]},s}function no(e,t,n,r){let o=e.geometry?.boundingBox,s=t.elements;if(!o)return;let a=n.domElement,i=a?.clientWidth||r.x,c=a?.clientHeight||r.y,l=[],m=!1;for(let u=0;u<8;u++){let d=u&1?o.max.x:o.min.x,h=u&2?o.max.y:o.min.y,g=u&4?o.max.z:o.min.z,w=s[0]*d+s[4]*h+s[8]*g+s[12],p=s[1]*d+s[5]*h+s[9]*g+s[13],M=s[3]*d+s[7]*h+s[11]*g+s[15];if(!(M>1e-9)){m=!0;break}l.push((w/M+1)/2*i,(1-p/M)/2*c)}zt().set(e,{t:performance.now(),points:l,behind:m,width:i,height:c})}function ro(e){for(let t of e?.userData?.[Be]??[])e.remove(t),io(t.material),zt().delete(t);e?.userData&&delete e.userData[Be]}var oo=4,it=new Map,Yt=Symbol("highlightPassPool");function ao(e,t){return`${e}|${t.merged?1:0}|${t.feature?.attribute??""}|${t.accent??""}`}function so(e,t,n={}){let r=ao(t,n),o=it.get(r)?.pop();if(o){let a=o.uniforms;return a.hlCentre.value.set(0,0,0),a.hlHasNormal.value=1,a.hlFeatureId.value=n.feature?.id??0,a.hlUp.value.set(0,0,1),a.hlWash.value=0,a.hlEye.value.set(0,0,0),a.hlTime.value=0,a.hlWidthPx.value=he,a.hlFarScale.value=lt/he,o}let s=to(e,t,n);return s.userData[Yt]=r,s}function io(e){let t=e?.userData?.[Yt];if(!t){e?.dispose?.();return}let n=it.get(t)??[];it.set(t,n),n.length<oo&&!n.includes(e)?n.push(e):e.dispose()}function $t(e){let t=e?.getAttribute?.("position")??e?.attributes?.position;return!t||!!t.array}function Kt(e,t,n={}){ro(t);let r=_e[n.style??de()],o=[...r.outline?["outline"]:[],...r.rim?["rim"]:[],...r.wash&&!n.feature?["roof"]:[]];if(!o.length||!t?.geometry)return[];let s=t.geometry,a=n.centre;if(!a){!s.boundingBox&&$t(s)&&s.computeBoundingBox?.();let p=s.boundingBox?.getCenter(new e.Vector3)??s.boundingSphere?.center;a=p?[p.x,p.y,p.z]:[0,0,0]}let i=s.getAttribute?.("normal")?1:0,c=[],l=new e.Matrix4,m=new e.Vector4,u=new e.Vector2,d=new e.Matrix3,h=new e.Vector3,g=n.up??[0,0,1],w=!n.merged&&!n.feature&&!t.isInstancedMesh;w&&!s.boundingBox&&$t(s)&&s.computeBoundingBox?.();for(let p of o){let M=so(e,p,{merged:n.merged,feature:n.feature,accent:n.accent??jt(n.style)});M.uniforms.hlCentre.value.set(a[0],a[1],a[2]),M.uniforms.hlHasNormal.value=i;let b=t.isInstancedMesh?new e.InstancedMesh(s,M,t.count):new e.Mesh(s,M);t.isInstancedMesh&&(b.instanceMatrix=t.instanceMatrix),b.name=`${t.name||"mesh"}/highlight-${p}`,b.frustumCulled=!1,b.castShadow=b.receiveShadow=!1,b.renderOrder=(t.renderOrder??0)+1,b.raycast=()=>{},p==="roof"&&Object.defineProperty(b,"visible",{get:()=>t.visible&&Ut()>.001,set:()=>{},configurable:!0}),b.onBeforeRender=(_,V,R)=>{t.isInstancedMesh&&(b.count=t.count),p!=="roof"&&(b.visible=t.visible);let T=M.uniforms;if(p==="roof"){d.setFromMatrix4(b.matrixWorld),h.setFromMatrixColumn(b.matrixWorld,0);let G=h.length()<.001?[0,0,1]:g;T.hlUp.value.set(G[0],G[1],G[2]).applyMatrix3(d.invert()).normalize(),T.hlWash.value=Hr*Ut()}_.getDrawingBufferSize(u),T.hlViewport.value.copy(u);let z=_.domElement?.clientWidth||u.x,W=Qr();T.hlWidthPx.value=(W??he)*(u.x/z),T.hlFarScale.value=W==null?lt/he:1,l.multiplyMatrices(R.projectionMatrix,R.matrixWorldInverse).multiply(b.matrixWorld),p==="outline"&&w&&no(b,l,_,u),l.invert(),m.set(0,0,1,0).applyMatrix4(l),Math.abs(m.w)>1e-12&&T.hlEye.value.set(m.x/m.w,m.y/m.w,m.z/m.w),T.hlTime.value=performance.now()/1e3,M.uniformsNeedUpdate=!0},t.add(b),c.push(b)}return t.userData??={},t.userData[Be]=c,c}var Vt=new WeakMap;function mt(e,t,n,r=de()){if(!t||n==="plain"||n==="highlight"&&_e[r].keepMaterials)return t;let o=Vt.get(t);o||Vt.set(t,o=new Map);let s=`${n}|${r}`,a=o.get(s);if(a)return a;if(n==="highlight")a=new e.MeshLambertMaterial({color:16765471,emissive:7033856,side:t.side??e.FrontSide});else if(t.isShaderMaterial&&t.uniforms?.tint?.value?.isVector3)a=t.clone(),a.uniforms={...t.uniforms,tint:{value:lo(t.uniforms.tint.value.clone())}};else if(t.isShaderMaterial&&t.uniforms?.hlDimAll)a=t.clone(),a.uniforms={...t.uniforms,hlDimAll:{value:1}};else if(t.isShaderMaterial)a=t.clone(),a.uniforms=t.uniforms,a.defines={...t.defines??{},HL_DIM_ALL:""};else{if(a=t.clone(),a.color){let i=a.color,c=.2126*i.r+.7152*i.g+.0722*i.b;i.setRGB(i.r+(c-i.r)*ee,i.g+(c-i.g)*ee,i.b+(c-i.b)*ee)}if(a.map){let i=a.onBeforeCompile;a.onBeforeCompile=(c,l)=>{i?.call(a,c,l),c.fragmentShader=c.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${ee.toFixed(2)});`)},a.customProgramCacheKey=()=>`${t.customProgramCacheKey?.()??""}|hl-dim`}}return a.name=`${t.name||"material"}/${n}`,a.userData={...t.userData??{},highlightVariantOf:t},o.set(s,a),a}function lo(e){let t=.2126*e.x+.7152*e.y+.0722*e.z;return e.set(e.x+(t-e.x)*ee,e.y+(t-e.y)*ee,e.z+(t-e.z)*ee)}var Xt="inferred",uo=e=>P(k(e))[1]<.2,co=e=>{let[t,n,r]=P(k(e));return(t<45||t>340)&&n>=.15&&r<.7},mo=e=>uo(e)?"slate":"roofTile",ft=e=>co(e)?"brick":"stucco",fo=[{test:/glass|glaz|window|vitr|ruit|pane/,slot:"glass",confidence:"name",rule:"glazing name"},{test:/decal|sign|mural|logo|letter|clock|dial/,slot:"paint",confidence:"name",rule:"signage / decal"},{test:/door|deur|gate/,slot:"door",confidence:"name",rule:"door name"},{test:/frame|kozijn|louvre|louver|blind|shutter|rail|mullion|sash/,slot:"frame",confidence:"name",rule:"joinery name"},{test:/brick|baksteen|klinker|terracotta/,slot:"brick",confidence:"name",rule:"brick name"},{test:/slate|leien|lei$/,slot:"slate",confidence:"name",rule:"slate name"},{test:/bitumen|asphalt|tar$|felt|flatroof|flat-roof|gravel/,slot:"bitumen",confidence:"name",rule:"flat roof name"},{test:/roof|tile|pantile|dakpan|dak/,slot:mo,confidence:"name",rule:"roof name, grey \u2192 slate, else pantile"},{test:/sandstone|stone|steen|column|marble|granite|limestone|plinth/,slot:"stone",confidence:"name",rule:"stone name"},{test:/stucco|render|plaster|pleister|concrete|beton|slab/,slot:"stucco",confidence:"name",rule:"render / concrete name"},{test:/gold|gilt|bronze|copper|brass|zinc|metal|steel|iron|lead|alu/,slot:"paint",confidence:"name",rule:"metal name (flat colour)"},{test:/wall|facade|gevel/,slot:ft,confidence:"name",rule:"wall name, brick hue \u2192 brick, else stucco"},{test:/ochre|yellow|buff/,slot:ft,confidence:"colour-word",rule:"ochre: yellow brick (brick hue) or render"},{test:/pink|rose/,slot:"stucco",confidence:"colour-word",rule:"pink: painted render"},{test:/moss|grass|green|blue|orange|purple|paint|teal/,slot:"paint",confidence:"colour-word",rule:"coloured paint word"},{test:/white|cream|ivory/,slot:"stucco",confidence:"colour-word",rule:"white: stucco (could be white trim)"},{test:/dark|black|charcoal|anthracite/,slot:"frame",confidence:"colour-word",rule:"dark: painted joinery / ironwork (could be a dark wall)"},{test:/red/,slot:ft,confidence:"colour-word",rule:"red: brick hue \u2192 brick (could be red tile or paint)"},{test:/grey|gray/,slot:"stucco",confidence:"colour-word",rule:"grey: render (could be concrete or zinc)"}];function Jt(e){return String(e??"").toLowerCase().replace(/[-_.\s]*\d+$/,"").trim()}function ho(e){let[t,n,r]=P(k(e));return r<.22?{slot:"frame",rule:"very dark: joinery / ironwork"}:n>=.15&&(t<45||t>340)&&r<.62?{slot:"brick",rule:"brick hue"}:n<.2&&r>=.6?{slot:"stucco",rule:"pale neutral: render"}:n<.2&&r>=.22&&t>180&&t<260?{slot:"slate",rule:"blue-grey: slate"}:n<.25?{slot:"stone",rule:"neutral mid-tone: stone"}:{slot:"paint",rule:"saturated colour: paint"}}function Zt(e,t){let n=t.toLowerCase(),r=Jt(e);for(let s of fo)if(s.test.test(r))return{slot:typeof s.slot=="function"?s.slot(n):s.slot,tint:n,confidence:s.confidence,rule:s.rule};let o=ho(n);return{slot:o.slot,tint:n,confidence:"colour",rule:`no material word in "${r||"unnamed"}"; ${o.rule}`}}var Qt=e=>/white|cream|ivory/.test(Jt(e)),en=e=>typeof e=="string"&&Ft.includes(e);var rn={ribs:{pitch:.5,min:.25,max:2,w:.09,out:.04},boards:{pitch:.4,min:.15,max:1.5,w:.05,out:.035},louvres:{pitch:.35,min:.2,max:1,w:.12,out:.12},panels:{pitch:1.2,min:.6,max:6,w:.05,out:.035}};var js={min:.15,max:rn.ribs.max};var on={canal:["#6e5352","#8c7768","#977f73","#a79276","#b8a17a","#575245","#60564b","#62544d","#61584c","#655850","#655b50","#6a5454","#6f6058","#726359","#726459","#76615d","#77685d","#7a6c60","#826c66","#918174","#9a887f","#a89f8a","#6b6163","#dfdcd2"],c19:["#70564f","#6f5b52","#7a665c","#86695b","#886a5f","#857266","#8b746d","#9b887e","#a38e83","#ad9585","#61534a","#63564e","#685b52","#6f6057","#716259","#75665c","#7b6961","#7c6962","#7f6a64","#7f7664","#8e796f","#9c9181","#95787e","#dad8cf"],school:["#665247","#775744","#735d52","#786158","#8c5957","#896559","#856f63","#9d7f6d","#ad997f","#5c4f48","#61564c","#67564e","#6b5554","#6b5851","#6b5b50","#716057","#745e5b","#75655c","#78665f","#806d64","#89706b","#a19888","#614a4e","#a4a09f"],modern:["#715d53","#7c6459","#816b64","#8f7265","#9c8980","#ac9a86","#60594c","#635c4e","#6a5a50","#6c5a54","#6c5e55","#6e6256","#72675a","#776a5d","#7b6a61","#7f6f64","#807265","#886f6b","#8b7d6d","#958b79","#a29189","#695256","#a59b8d","#c8c5ba"]};var ht={"#4f4834":[215,215,215],"#463823":[216,215,215],"#5f5950":[215,215,215],"#a69873":[215,215,215],"#57423e":[215,215,215],"#473c3b":[215,215,215],"#5d5d5c":[214,215,215],"#7e573b":[215,215,215],"#705449":[215,215,215],"#7f8283":[215,214,215],"#796764":[215,215,215],"#5d534b":[215,215,215],"#7d6e52":[215,215,215],"#88735e":[215,215,215],"#88715f":[215,215,215],"#736352":[215,215,215],"#241d1c":[172,172,172],"#4b3f37":[215,215,215],"#615551":[215,215,215],"#595651":[214,215,214],"#423931":[215,215,215],"#7b6d6a":[215,214,216],"#382418":[215,215,215],"#866343":[215,215,215],"#6e6256":[215,215,215],"#625650":[205,205,205],"#252c24":[185,185,186],"#2d281b":[215,214,215],"#3b342b":[215,215,215],"#6f5c56":[215,215,215],"#393535":[215,215,215],"#786357":[215,215,215],"#383d43":[205,215,215],"#554e4a":[215,216,215],"#3d3432":[215,215,215],"#3d353c":[215,215,215],"#4e443f":[215,215,215],"#70574d":[207,207,207],"#d49662":[215,215,215],"#917b5c":[215,215,215],"#494341":[215,215,215],"#645f5f":[215,215,214],"#342a18":[215,215,215],"#825746":[215,216,215],"#99604e":[212,215,215],"#706868":[215,215,215],"#786b61":[215,215,214],"#5c5b57":[215,215,215],"#7a655b":[215,215,215],"#6f5b54":[215,215,215],"#4a3f3a":[215,214,215],"#614f44":[216,215,215],"#654e44":[215,215,215],"#6f5f53":[215,215,216],"#584d49":[215,215,215],"#d3c9b2":[215,215,215],"#544b46":[215,215,215],"#929289":[215,215,215],"#68584f":[215,215,216],"#574d47":[215,215,215],"#5e4e41":[215,215,215],"#6e605a":[215,215,215],"#605d5c":[215,215,215],"#8c7a6f":[215,215,215],"#4a3832":[165,165,166],"#81614f":[215,215,215],"#3d3533":[215,215,215],"#6d5351":[215,215,215],"#5c3d33":[214,214,215],"#906553":[215,215,215],"#65493d":[215,215,215],"#8e5f49":[215,215,215],"#8c6858":[215,215,215],"#8b5946":[215,215,215],"#665253":[209,209,209],"#3e3222":[215,215,215],"#000000":[197,198,197],"#7b081b":[215,215,215],"#383131":[215,215,215],"#3d3b37":[211,215,215],"#877d76":[214,215,215],"#191d0c":[215,214,213],"#bcab88":[215,215,215],"#656462":[215,215,215],"#3f3634":[174,174,175],"#463e3c":[197,197,198],"#453d3a":[177,177,176],"#1f1a1b":[156,156,157],"#615450":[214,215,215],"#5b4f4b":[215,215,215],"#574c4a":[215,215,215],"#413333":[215,215,215],"#7b5c53":[215,215,215],"#5f342b":[216,215,215],"#4e2422":[215,215,215],"#5b4b44":[209,209,209],"#493d32":[215,215,215],"#6a5048":[216,216,215],"#5e5855":[215,215,215],"#5e3f35":[215,215,215],"#68564f":[215,215,215],"#6b3e33":[215,214,215],"#5f3c30":[215,214,215],"#929191":[215,215,215],"#a2acb3":[215,215,215],"#8f7b65":[215,215,215],"#988e7d":[215,215,215],"#726d60":[215,215,215],"#584c45":[215,214,215],"#594643":[216,215,215],"#5e5750":[212,215,215],"#78645b":[215,215,215],"#484440":[215,215,215],"#73645e":[215,215,215],"#5c4f47":[215,215,215],"#3c3d39":[215,215,215],"#645451":[215,215,214],"#37333d":[179,179,178],"#a6856f":[215,215,215],"#574d4d":[205,205,205],"#393737":[215,215,215],"#6f4a3b":[215,214,215],"#ffa169":[212,215,215],"#576465":[216,215,216],"#71614a":[215,215,215],"#6c584f":[215,215,215],"#5b463e":[215,216,215],"#765e52":[214,215,215],"#4f4e4c":[215,215,215],"#544945":[215,215,215],"#504140":[194,195,194],"#51514f":[215,215,215],"#74665f":[215,215,215],"#735c59":[215,215,215],"#474d56":[215,215,215],"#7d6e5a":[215,215,215],"#514a43":[215,215,215],"#4e4e49":[215,215,215],"#745c51":[215,215,215],"#47403c":[215,215,215],"#4c3a37":[215,215,215],"#675d5a":[215,215,215],"#574e48":[215,215,215],"#686360":[215,215,215],"#4a413f":[215,215,215],"#423735":[215,215,215],"#756860":[215,215,215],"#5e5144":[215,215,215]};var zi={street:{...rt,brick:rt.klinker},tones:Nt};var So=["sunny","legacy"],vo="sunny";function te(e){let t=globalThis,r=/[?&]look=([\w-]+)/.exec(e??t.location?.search??"")?.[1]??t.__canalRecallLook;return So.includes(r??"")?r:vo}var ge=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},_o=e=>255*(e<=.0031308?e*12.92:1.055*e**(1/2.4)-.055),le=e=>{let t=parseInt(e.replace("#",""),16);return[t>>16&255,t>>8&255,t&255]},dt=e=>"#"+e.map(t=>Math.round(Math.max(0,Math.min(255,t))).toString(16).padStart(2,"0")).join(""),Ao=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],pe=e=>Ao(le(e).map(ge)),ko=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],Lo={zenith:"#9ec3ed",horizon:"#a1c6e5"};function To(e){let t=e.sunElevationDeg*Math.PI/180,n=pe(e.sunColour)*e.sunIntensity/Math.PI,r=pe(e.skyColour)*e.skyIntensity/Math.PI,o=pe(e.groundColour)*e.skyIntensity/Math.PI,s=(r+o)/2;return{flat:n*Math.sin(t)+r,sunWall:n*Math.cos(t)+s,shadeWall:s}}var Fo=.55;function Co(e="#ffe2bf",t="#aca497",n=Fo){let r=40*Math.PI/180,o=c=>{let l=dt(le(Lo.horizon).map(h=>h+(255-h)*c)),m=pe(e)*2.15/Math.PI*Math.cos(r),u=(pe(l)+pe(t))/2/Math.PI,d=n*m/(1-n)/u;return{sunColour:e,sunIntensity:2.15,skyColour:l,groundColour:t,skyIntensity:d,sunElevationDeg:40}},s=c=>{let l=o(c),m=le(l.sunColour).map(ge),u=le(l.skyColour).map(ge),d=[0,2].map(h=>m[h]*l.sunIntensity*Math.sin(r)+u[h]*l.skyIntensity);return d[0]/d[1]},a=0,i=1;for(let c=0;c<40;c++){let l=(a+i)/2;s(l)<1?a=l:i=l}return{...o(i),whiteMix:+i.toFixed(3)}}var be=Co(),an=1/To(be).sunWall,un={sunColour:be.sunColour,sunIntensity:+(be.sunIntensity*an).toFixed(4),skyColour:be.skyColour,groundColour:be.groundColour,skyIntensity:+(be.skyIntensity*an).toFixed(4)},sn=[.85,1.6],Oo=e=>typeof e=="string"?le(e):e;function bt(e){let t=e?ge(219)/ge(ko(Oo(e))):1.106;return Math.max(sn[0],Math.min(sn[1],t))}function ye(e,t){let n=le(e).map(o=>ge(o)*t),r=Math.max(1,...n);return dt(n.map(o=>_o(o/r)))}function ln(e,t=ht[e.toLowerCase()]){return ye(e,bt(t))}function cn(e,t,n,r=te(),o){return r!=="sunny"||n!=="measured"||e!=="brick"&&e!=="accent"?t:o?ln(t,o):ln(t)}var Ji=(()=>{let e=Object.keys(ht).map(le),t=n=>n.slice().sort((r,o)=>r-o)[n.length>>1];return dt([0,1,2].map(n=>t(e.map(r=>r[n]))))})();var Eo=2,Po=.62;function Do(e,t=Eo){let n=ye(e,t);if(P(k(e))[2]>=Po)return n;let[r,o,s]=P(k(n));return s<=Q[1]?n:C(U([r,o,Q[1]]))}var Io=e=>Object.fromEntries(Object.entries(e).map(([t,n])=>[t,n?n.map(r=>Do(r)):null])),il=Io(on);var mn=["canal","c19","school","postwar","modern","tower"];var No=8;var Il=16+Math.log2(No);var O=256,Go=["upper","ground","door","plain","shop"],Uo=2;var Ul=mn.length*Uo*Go.length;var H=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16));var Hl=H("#7d93a0"),Wl=H("#1f2a33");var $l=H("#b8ad98"),Vl=H("#cfc6b4"),zl=H("#ece8dd"),jl=H("#e2d9c2"),ql=[H("#2c4a3d"),H("#3a2a22"),H("#1f3b57"),H("#5a2a24")],Yl=[H("#2f4a3a"),H("#7a2f27"),H("#27384f")];var fn=.6;function Ge(e,t,n){let r=Math.imul(e|0,374761393)^Math.imul(t|0,668265263)^Math.imul(n|0,2246822519);return r=Math.imul(r^r>>>13,1274126177),((r^r>>>16)>>>0)/4294967296}function hn(e,t){let n=0;for(let o=0;o<e.length;o+=4)n+=e[o];let r=n/(e.length/4);for(let o=0;o<e.length;o+=4){let s=Math.round(Math.max(0,Math.min(255,r+(e[o]-r)*t)));e[o]=e[o+1]=e[o+2]=s}}function dn(e,t){let n=new Uint8ClampedArray(O*O*4),r=(o,s,a,i,c)=>{let l=(s*O+o)*4,m=c??[a,a,a];n[l]=m[0],n[l+1]=m[1],n[l+2]=m[2],n[l+3]=i};if(e==="flat")for(let o=0;o<O;o++)for(let s=0;s<O;s++)r(s,o,Math.round((t?.96:.9+(Ge(s>>3,o>>3,3)-.5)*.08)*255),255);else if(e==="tile"){let a=O/8,i=O/5;for(let c=0;c<O;c++)for(let l=0;l<O;l++){let m=Math.floor(c/a),u=c%a/a,d=(l+m%2*i*.5)%O,h=Math.floor(d/i),g=d%i/i,w=Math.sin(g*Math.PI),p=t?.92:.7+.22*w-.28*Math.pow(Math.max(0,1-u*3.2),1.5)*0-.22*Math.max(0,(.18-u)/.18);t||(p+=(Ge(h,m,7)-.5)*.14);let M=t?u<.07||g<.035||g>.965:!1;r(l,c,Math.round(Math.max(0,Math.min(1,M?.28:p))*255),255)}t||hn(n,fn)}else if(e==="slate"){let a=O/11,i=O/6;for(let c=0;c<O;c++)for(let l=0;l<O;l++){let m=Math.floor(c/a),u=c%a/a,d=(l+m%2*i*.5)%O,h=Math.floor(d/i),g=d%i/i,w=t?.9:.82+(Ge(h,m,11)-.5)*.16-.16*Math.max(0,(.16-u)/.16);(g<(t?.05:.025)||u<(t?.09:.04))&&(w=t?.3:w*.7),r(l,c,Math.round(Math.max(0,Math.min(1,w))*255),255)}t||hn(n,fn)}else for(let c=0;c<O;c++)for(let l=0;l<O;l++){let m=l/O,u=c/O,d=m>.2-.06&&m<.8+.06&&u>.2-.06&&u<.82+.06,h=m>.2+.03&&m<.8-.03&&u>.2+.03&&u<.82-.03,g=Math.abs(m-.5)<.018||Math.abs(u-.5)<.018;if(h&&!g){let w=(u-.2)/.6199999999999999,p=t?[150+60*w,200+30*w,235]:[40+80*w*w,55+90*w*w,68+90*w*w];r(l,c,0,0,[p[0],p[1],p[2]])}else if(d)r(l,c,0,0,t?[255,250,240]:[236,232,221]);else{let w=t?.92:.85+(Ge(l>>3,c>>3,5)-.5)*.12,p=t&&(l<5||c<5||l>O-6||c>O-6);r(l,c,Math.round((p?.3:w)*255),255)}}return n}function bn(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let m=0;m<336;m+=112)o.drawImage(t,m,l,112,112);else{let l=7,m=()=>(l=l*16807%2147483647)/2147483647;for(let u=0,d=0;d<336;d+=14,u++)for(let h=-(u%2)*24;h<336;h+=48){let g=150+m()*50;o.fillStyle=`rgb(${g},${g*.92},${g*.86})`,o.fillRect(h,d,48,14)}}o.strokeStyle="rgba(235,223,205,0.18)",o.lineWidth=1.7;for(let l=0,m=6;m<336;m+=14,l++){o.beginPath(),o.moveTo(0,m),o.lineTo(336,m),o.stroke();for(let u=l%2*24;u<336;u+=48)o.beginPath(),o.moveTo(u,m),o.lineTo(u,m+14),o.stroke()}let s=o.getImageData(0,0,336,336),a=s.data,i=0;for(let l=0;l<a.length;l+=4)i+=(a[l]+a[l+1]+a[l+2])/3;i/=a.length/4;let c=i>0?Math.min(2.4,225/i):1;for(let l=0;l<a.length;l+=4){let m=(a[l]+a[l+1]+a[l+2])/3,u=Math.min(255,(m+(i-m)*.7)*c);a[l]=a[l+1]=a[l+2]=u,a[l+3]=255}return o.putImageData(s,0,0),r}function pn(e){let t=e.createElement("canvas");t.width=64,t.height=128;let n=t.getContext("2d"),r=n.createLinearGradient(0,0,0,128);return r.addColorStop(0,"#8aa1b0"),r.addColorStop(.5,"#4d606c"),r.addColorStop(1,"#3c474e"),n.fillStyle=r,n.fillRect(0,0,64,128),n.fillStyle="rgba(235,242,248,0.16)",n.beginPath(),n.moveTo(10,0),n.lineTo(34,0),n.lineTo(4,70),n.lineTo(-20,70),n.closePath(),n.fill(),t}function gn(e){let t=e.createElement("canvas");t.width=se,t.height=ie;let n=t.getContext("2d"),r=n.createImageData(se,ie);for(let o=0;o<ie;o++)for(let s=0;s<se;s++){let a=(o*se+s)*4,i=nt(s,o);r.data[a]=r.data[a+1]=r.data[a+2]=i,r.data[a+3]=255}return n.putImageData(r,0,0),t}function yn(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d");n.fillStyle="#ffffff",n.fillRect(0,0,128,128),n.fillStyle="rgba(0,0,0,0.10)";for(let r=0;r<128;r+=16)n.fillRect(r,0,1.5,128);return t}function xn(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=23,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++){let i=(s()-.5)*3;for(let c=0;c<128;c++){let l=(a*128+c)*4,m=s()<.012?-14:0,u=243+(s()-.5)*8+i+m;r.data[l]=r.data[l+1]=r.data[l+2]=u,r.data[l+3]=255}}return n.putImageData(r,0,0),t}function Mn(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=11,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<r.data.length;a+=4){let i=228+(s()-.5)*16;r.data[a]=r.data[a+1]=r.data[a+2]=i,r.data[a+3]=255}return n.putImageData(r,0,0),n.fillStyle="rgba(80,70,60,0.18)",n.fillRect(0,0,128,1.5),t}function Ue(e,t){let n=dn(t,!1),r=Math.round(Math.sqrt(n.length/4)),o=e.createElement("canvas");o.width=o.height=r;let s=o.getContext("2d"),a=s.createImageData(r,r);for(let i=0;i<n.length;i+=4)a.data[i]=n[i],a.data[i+1]=n[i+1],a.data[i+2]=n[i+2],a.data[i+3]=255;return s.putImageData(a,0,0),o}var Ho=238;function wn(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let m=0;m<336;m+=112)o.drawImage(t,m,l,112,112);else{let l=13,m=()=>(l=l*16807%2147483647)/2147483647;for(let u=0,d=0;d<336;d+=14,u++)for(let h=-(u%2)*24;h<336;h+=48){let g=165+m()*30;o.fillStyle=`rgb(${g},${g*.93},${g*.88})`,o.fillRect(h,d,48,14)}}o.strokeStyle="rgba(245,240,230,0.26)",o.lineWidth=1.2;for(let l=0,m=6;m<336;m+=14,l++){o.beginPath(),o.moveTo(0,m),o.lineTo(336,m),o.stroke();for(let u=l%2*24;u<336;u+=48)o.beginPath(),o.moveTo(u,m),o.lineTo(u,m+14),o.stroke()}let s=o.getImageData(0,0,336,336),a=s.data,i=0;for(let l=0;l<a.length;l+=4)i+=(a[l]+a[l+1]+a[l+2])/3;i/=a.length/4;let c=i>0?Math.min(2.6,Ho/i):1;for(let l=0;l<a.length;l+=4){let m=(a[l]+a[l+1]+a[l+2])/3,u=Math.min(255,(m+(i-m)*.82)*c);a[l]=a[l+1]=a[l+2]=u,a[l+3]=255}return o.putImageData(s,0,0),r}function Rn(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=31,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++)for(let i=0;i<128;i++){let c=(a*128+i)*4,l=246+(s()-.5)*3;r.data[c]=r.data[c+1]=r.data[c+2]=l,r.data[c+3]=255}return n.putImageData(r,0,0),t}function Sn(e){let t=e.createElement("canvas");t.width=t.height=4;let n=t.getContext("2d");return n.fillStyle="#fff",n.fillRect(0,0,4,4),t}var vn={minFilter:"LinearMipmapLinear",magFilter:"Linear",generateMipmaps:!0};function Wo(e,t){let n=t.coarse?128:256,r=e==="facadeCells"?Math.min(t.gpuMaxAnisotropy,t.coarse?4:16):4;return{...vn,cellPx:n,anisotropy:r,tierScale:1}}function $o(e,t){if(!t.enabled||t.coarse||t.tier!=="high")return Wo(e,t);let n=Number.isFinite(t.gpuMaxAnisotropy)&&t.gpuMaxAnisotropy>=1?t.gpuMaxAnisotropy:1,r=Number(t.cellPx),o=Number.isInteger(r)&&r>256&&r<=512&&r%32===0?r:256;return{...vn,cellPx:o,anisotropy:Math.min(n,16),tierScale:o/256}}function Vo(){try{let e=globalThis,t=e.__canalRecallTexturePolicy??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texturePolicy"):null);return!(t===!1||t==="0"||t==="false"||t==="off")}catch{return!0}}function zo(){try{let e=globalThis,t=Number(e.__canalRecallCellPx??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("cellPx"):null)??NaN);return Number.isFinite(t)&&t>0?t:null}catch{return null}}function jo(){let e=globalThis.__canalPerf?.tier;return e==="low"||e==="mid"||e==="high"?e:null}function qo(){return!!globalThis.matchMedia?.("(pointer: coarse)").matches}function _n(e,t){return $o(e,{tier:jo(),coarse:qo(),gpuMaxAnisotropy:t,enabled:Vo(),cellPx:zo()})}var Ae=(e,t)=>`(${e}.g + 1.0 - ${t}.a)`;function Yo(){let e=globalThis;return(e.__canalRecallMaskFormat??new URLSearchParams(e.location?.search??"").get("maskFormat"))==="rg"?"rg":"r8"}function An(e,t,n=Yo()){let r=t.length>>1;if(e.length!==r*4)throw new Error(`packMask: ${e.length} colour bytes for ${r} mask texels`);if(n==="rg"){for(let s=0;s<r;s++)e[s*4+3]=255;return{colour:e,mask:t,channels:2}}let o=new Uint8Array(r);for(let s=0;s<r;s++)o[s]=t[s*2],e[s*4+3]=255-t[s*2+1];return{colour:e,mask:o,channels:1}}function kn(){let e=globalThis,t=typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("fadeStrength"):null,n=e.__canalRecallFadeStrength??t,r=n==null||n===""?NaN:Number(n);return Number.isFinite(r)?Math.max(0,Math.min(2,r)):1}var ue=e=>Number.isInteger(e)?`${e}.0`:`${e}`;var Ko=(e=kn())=>`#ifdef USE_FOG
	float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	float fadeLuma = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( fadeLuma ), fogFactor * ${ue(.5*e)} );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * ${ue(.38*e)} );
#endif`,ru=Ko(1),Ln=`uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif`,ou=`#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
	${Ln}
#endif`,Tn=`
#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
#define DEPTH_FADE_FOG_PARS
	${Ln}
#endif
`,Fn=(e,t=kn())=>`${ue(Math.min(1,t))} * smoothstep(max(${ue(250)}, fogNear), max(max(${ue(600)}, fogNear + (fogFar - fogNear) * ${ue(.4)}), max(${ue(250)}, fogNear) + 1.0), ${e})`;var Xo=70,Jo=190,Zo=.5,Cn=15,On=40;var pt="12.0";var En=[-1,-1];var Pn=[-1,-1],Dn=()=>[Xo,Jo,Zo],He=e=>Number.isInteger(e)?e.toFixed(1):String(e),In=`
uniform vec2 roofLayers;
uniform vec3 roofTier;
vec3 roofTierColour(vec3 fine, vec2 uv, float layer, float dist) {
  if (roofLayers.x < 0.0 || layer < roofLayers.x - 0.5 || layer > roofLayers.y - 0.5) return fine;
  float mid = smoothstep(roofTier.x - ${He(Cn)}, roofTier.x + ${He(Cn)}, dist);
  if (mid <= 0.0) return fine;
  float far = smoothstep(roofTier.y - ${He(On)}, roofTier.y + ${He(On)}, dist);
  vec3 coarse = texture(cells, vec3(uv * roofTier.z, layer)).rgb;
  vec3 flatMean = textureLod(cells, vec3(uv, layer), ${pt}).rgb;
  return mix(mix(fine, coarse, mid), flatMean, far);
}`,Bn=`${Tn}
uniform vec2 cellTier;
void cellTierSample(vec3 p, float dist, out vec3 c, out vec2 m) {
  vec4 cc = texture(cells, p); vec2 mm = texture(masks, p).rg;
  c = cc.rgb; m = vec2(mm.r, ${Ae("mm","cc")});
  float far = 0.0;
  if (cellTier.x >= 0.0) {
    float rho = max(length(dFdx(p.xy)), length(dFdy(p.xy))) * float(textureSize(cells, 0).x);
    far = smoothstep(cellTier.x, cellTier.y, rho);
  }
#ifdef USE_FOG
  far = max(far, ${Fn("dist")});
#endif
  if (far <= 0.0) return;
  vec4 fc = textureLod(cells, p, ${pt}); vec2 fm = textureLod(masks, p, ${pt}).rg;
  c = mix(c, fc.rgb, far); m = mix(m, vec2(fm.r, ${Ae("fm","fc")}), far);
}`;var Qo=.5,$e={sunAzimuthDeg:215,sunElevationDeg:40,sunColour:"#ffe9cc",sunIntensity:2.15,skyColour:"#e3ebf6",groundColour:"#998a72",skyIntensity:1.75,shadows:!0,shadowMapSize:2048,shadowIntensity:1-Qo};var du={...$e,...un};function ea(e,t){let n=e*Math.PI/180,r=t*Math.PI/180;return[Math.sin(n)*Math.cos(r),Math.cos(n)*Math.cos(r),Math.sin(r)]}var bu=ea($e.sunAzimuthDeg,$e.sunElevationDeg),Ve=(()=>{let e=$e.sunAzimuthDeg*Math.PI/180;return[Math.sin(e),Math.cos(e)]})(),We=[Ve[0]*.6,Ve[1]*.6,.8],Nn=.84;function ta(e){let t=e[0]*We[0]+e[1]*We[1]+e[2]*We[2];return Math.max(.5,Math.min(1,.58+.42*Math.max(0,t)))}var pu=ta([0,0,1]),ke=e=>Number.isInteger(e)?e.toFixed(1):String(+e.toFixed(6)),ze=`
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = ${ke(Nn)} + ${ke(1-Nn)} * (0.5 + 0.5 * dot(h, vec2(${ke(Ve[0])}, ${ke(Ve[1])}))); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, dot(n, vec3(${We.map(ke).join(", ")}))), 0.5, 1.0);`;var Gn=[.4,2.5],na=["brick","accent","stucco"];function ra(e){let t=(e?.white?bt(e.white):1.106)*(e?.stripOverDrawn??1);return Math.max(Gn[0],Math.min(Gn[1],t))}var oa=["brick","accent"];function Un(e,t,n,r,o=te()){return o!=="sunny"||r==="measured"?t:n?na.includes(e)?ye(t,ra(n)):t:oa.includes(e)?ye(t,1.106):t}var sa={legacy:.9,sunny:1},ia=(e=te())=>sa[e],X=ia(),Le=255/225,la=255/228,ua=255/243,ca=255/246,qe=[{cell:"brick",tileM:$.brick,clampUv:!1,litGain:Le*X,skyTint:!1},{cell:"stucco",tileM:$.stucco,clampUv:!1,litGain:ua*X,skyTint:!1},{cell:"stone",tileM:$.stone,clampUv:!1,litGain:la*X,skyTint:!1},{cell:"white",tileM:1,clampUv:!1,litGain:1,skyTint:!1},{cell:"door",tileM:$.door,clampUv:!1,litGain:1,skyTint:!1},{cell:"glass",tileM:$.glass,clampUv:!0,litGain:1,skyTint:!0},{cell:"tile",tileM:$.roofTile,clampUv:!1,litGain:Le*X,skyTint:!1},{cell:"slate",tileM:$.slate,clampUv:!1,litGain:Le*X,skyTint:!1},{cell:"flat",tileM:$.bitumen,clampUv:!1,litGain:Le*X,skyTint:!1},{cell:"brick20",tileM:$.brick,clampUv:!1,litGain:Le*X,skyTint:!1},{cell:"whiteStucco",tileM:$.stucco,clampUv:!1,litGain:ca*X,skyTint:!1},{cell:"glassTint",tileM:$.glass,clampUv:!0,litGain:1,skyTint:!0}],je=qe.length,Te=Object.fromEntries(qe.map((e,t)=>[e.cell,t])),ma=tt.school;function yt(e,t={}){let n=Ct[e],r=t.source==="measured";return n==="glass"&&r?Te.glassTint:n==="brick"&&!r&&typeof t.year=="number"&&t.year>=ma?Te.brick20:n==="stucco"&&t.white?Te.whiteStucco:n==="frame"?Te.white:Te[n]}function fa(){return qe.map(e=>[1/e.tileM,e.clampUv?1:0,e.litGain,e.skyTint?1:0])}var ha=.38,da=.8,ba=.27,pa=.97,ga=.75,ya=.5,xa=.12,Ma=(e,t)=>(e<45||e>340)&&t>=.2;function wa(e,t,n,r=te(),o){if(Pt(e,n))return Ie(e,cn(e,t,n,r,o),n);let s=k(t),[a,i,c]=P(s);return e==="slate"&&Ma(a,i)?Ie("roofTile",t):(e==="brick"||e==="accent")&&i<xa?C(U([a,i,Math.min(Q[1],Math.max(Q[0],.12+c*.9))])):e==="slate"&&c>ha?C(U([a,Math.min(i,.12),Math.min(.72,c/da)])):e==="slate"?c<ba?K.slate[1]:K.slate[0]:e==="frame"&&c>=.5&&c<ga?C(s):e==="stone"&&c<ya?C(s):Ie(e,t)}function zn(e,t,n,r=te(),o,s){let a=wa(e,t,n,r,o),[i,c,l]=k(Un(e,a,s??null,n,r));return[i,c,l,255]}function Ra(e,t,n){switch(t){case"brick":return bn(e,n);case"brick20":return wn(e,n);case"stucco":return xn(e);case"whiteStucco":return Rn(e);case"stone":return Mn(e);case"white":case"frame":return Sn(e);case"door":return yn(e);case"glass":return pn(e);case"glassTint":return gn(e);case"tile":return Ue(e,"tile");case"slate":return Ue(e,"slate");case"flat":return Ue(e,"flat")}}function Sa(e,t,n){let r=n*n,o=new Uint8Array(r*4*je),s=new Uint8Array(r*2*je),a=e.createElement("canvas");a.width=a.height=n;let i=a.getContext("2d",{willReadFrequently:!0});return i.imageSmoothingQuality="high",qe.forEach((c,l)=>{i.clearRect(0,0,n,n),i.drawImage(Ra(e,c.cell,t),0,0,n,n);let m=i.getImageData(0,0,n,n).data;for(let u=0;u<n;u++)for(let d=0;d<n;d++){let h=((n-1-u)*n+d)*4,g=l*r+u*n+d;o[g*4]=m[h],o[g*4+1]=m[h+1],o[g*4+2]=m[h+2],o[g*4+3]=255,s[g*2]=255,s[g*2+1]=0}}),{colour:o,mask:s}}async function va(e=document){let t=new Image;t.src=new URL("materials/ambientcg/Bricks057/colour.jpg",e.baseURI).href;try{return await t.decode(),t}catch{return null}}var xt=e=>`${e.lit?"lit":"unlit"}|${e.kind}|${e.kind==="slot"?e.uv??"uv":"-"}|${e.highlight?"hl":e.dim?"dim":"-"}|${e.side??0}${e.noFade?"|nofade":""}${e.swap?"|swap":""}`;function _a(e){let t={CITY_SLOT_COUNT:String(je)};return e.kind==="slot"&&(t.CITY_SLOT=""),e.swap&&(t.CITY_SWAP=""),e.lit?(t.CITY_VARIANT_UNIFORMS="",{...t,...ut()}):(e.kind==="slot"&&e.uv==="box"&&(t.CITY_BOX_UV=""),e.highlight?t.CITY_HIGHLIGHT="":e.dim&&(t.CITY_DIM=""),{...t,...ut()})}function Aa(e){return{cityForce:{value:e.highlight?1:e.dim?2:0},cityBoxUv:{value:e.kind==="slot"&&e.uv==="box"?1:0}}}var ka=e=>e.lit?`city-look-v4|lit|${e.kind}${e.swap?"|swap":""}`:`city-look-v3|${xt({...e,side:0})}`,La="vec3(1.0, 0.824, 0.122)",Hn="vec3(1.0, 0.637, 0.0137)",Wn="vec3(0.035, 0.05, 0.07)",Ta=1,Fa=.2,Ca=.75,Oa=1.8,xe=e=>Number.isInteger(e)?e.toFixed(1):String(e),Ea=`
float cityGrain(vec3 cell) {
  float g = clamp(dot(cell, vec3(0.299, 0.587, 0.114)) / ${xe(225/255)}, 0.45, 1.1);
  return mix(1.0, g, ${xe(Ca)});
}`,jn=16,Pa=`
#ifdef CITY_SWAP
attribute float swapSlot;
uniform vec4 citySwapUnder[${jn/4}];
uniform float cityUnder;
flat varying float vCityUnder;
#endif`,Da=`
#ifdef CITY_SWAP
int citySw = int(swapSlot + 0.5) - 1;
vCityUnder = citySw >= 0 ? citySwapUnder[citySw / 4][citySw % 4] : cityUnder;
#endif`,qn=`
attribute float layer;
attribute vec4 tint;
attribute vec4 accent;
attribute float hidden;
uniform float slotBase;
uniform vec4 slotParams[CITY_SLOT_COUNT];
varying vec2 vFacUv;
flat varying float vLayer;
flat varying vec4 vSlot;
varying vec3 vTint;
varying vec3 vAccent;
flat varying float vHighlight;
varying float vFacDist;
#ifdef CITY_VARIANT_UNIFORMS
uniform float cityForce;
uniform float cityBoxUv;
#endif
${Pa}
${ct}`,Yn=`
${Da}
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
#ifdef CITY_SLOT
  int cityS = int(clamp(layer + 0.5, 0.0, float(CITY_SLOT_COUNT - 1)));
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
#endif`,Kn=`
vFacDist = length((modelViewMatrix * vec4(position, 1.0)).xyz);
if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`,Xn=`
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${In}
${Bn}
varying vec2 vFacUv;
flat varying float vLayer;
flat varying vec4 vSlot;
varying vec3 vTint;
varying vec3 vAccent;
flat varying float vHighlight;
varying float vFacDist;
#ifdef CITY_SWAP
flat varying float vCityUnder;
#endif
${Ea}
${ct}`,Jn=`
if (HL_GHOST(vHighlight)) discard;
#ifdef CITY_SWAP
float cityHash = fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296)));
if (cityFade < 1.0 && cityHash >= cityFade) discard;
// The complement of a replacement dissolving in over (or out from) this mesh: where it draws, this one does not.
if (cityHash < vCityUnder) discard;
#else
if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;
#endif`,Zn=`
vec2 cityUv = vSlot.y > 0.5 ? clamp(vFacUv, 0.0, 1.0) : vFacUv;
vec3 cityP = vec3(cityUv, vLayer);
vec3 cityC; vec2 cityM;
#ifdef CITY_SLOT
vec4 cityCC = texture(cells, cityP); vec2 cityMM = texture(masks, cityP).rg;
cityC = cityCC.rgb; cityM = vec2(cityMM.r, ${Ae("cityMM","cityCC")});
#else
cellTierSample(cityP, vFacDist, cityC, cityM);
cityC = roofTierColour(cityC, cityUv, vLayer, vFacDist);
#endif
float cityG = cityGrain(cityC);
cityC *= mix(vec3(1.0), vTint, cityM.r) * mix(vec3(1.0), vAccent, cityM.g);`,Ia=`
uniform mat3 enuFromWorld;
${qn}
varying float vShade;
void main() {
${Yn}
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
${ze}
  vShade = shade;
#else
  vShade = tint.a;
#endif
${Kn}
}`,Ba=`
precision highp float;
${Xn}
varying float vShade;
void main() {
${Jn}
${Zn}
  if (HL_PAINT(vHighlight)) {
    float hlShade = clamp(1.0 - (1.0 - vShade) * ${xe(Oa)}, 0.6, 1.0);
    gl_FragColor = vec4(${La} * (flatColour > 0.5 ? 1.0 : cityG) * hlShade, 1.0);
    return;
  }
  if (flatColour > 0.5) cityC = vTint;
  cityC = hlDesat(cityC, vHighlight);
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  gl_FragColor = vec4(cityC * shade, 1.0);
}`;function Na(e,t={}){return{cells:t.cells??{value:null},masks:t.masks??{value:null},slotBase:t.slotBase??{value:0},slotParams:t.slotParams??{value:fa().map(n=>new e.Vector4(...n))},bands:t.bands??{value:0},flatColour:t.flatColour??{value:0},cityFade:t.cityFade??{value:1},wallGain:t.wallGain??{value:1},roofLayers:t.roofLayers??{value:Pn},roofTier:t.roofTier??{value:Dn()},cellTier:t.cellTier??{value:En},enuFromWorld:t.enuFromWorld??{value:new e.Matrix3},citySwapUnder:t.citySwapUnder??{value:new Float32Array(jn)},cityUnder:t.cityUnder??{value:0}}}var Ga={accent:[1,1,1,1],hidden:[0],color:[1,1,1],uv:[0,0],uv1:[0,0],swapSlot:[0]},gt="recipeLookShared";function Ua(e,t,n){let r=_a(t),o=t.side??e.FrontSide,s;if(!t.lit)s=new e.ShaderMaterial({uniforms:n,defines:r,vertexShader:Ia,fragmentShader:Ba,side:o});else{s=new e.MeshLambertMaterial({side:o,flatShading:t.kind==="chunk"}),s.defines={...s.defines??{},...r};let a=Aa(t);s.onBeforeCompile=c=>{for(let l of Object.keys(n))c.uniforms[l]=n[l];Object.assign(c.uniforms,a),c.vertexShader=c.vertexShader.replace("#include <common>",`#include <common>${qn}`).replace("#include <begin_vertex>",`#include <begin_vertex>${Yn}`).replace("#include <project_vertex>",`#include <project_vertex>${Kn}`),c.fragmentShader=c.fragmentShader.replace("#include <common>",`#include <common>${Xn}
float cityLuma;`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>${Jn}`).replace("#include <map_fragment>",`${Zn}
#ifdef CITY_SLOT
cityC *= vSlot.z;
#else
cityC *= mix(1.0, wallGain * ${xe(X)}, cityM.r);
#endif
if (flatColour > 0.5) cityC = vTint;
cityLuma = dot(cityC, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= HL_PAINT(vHighlight) ? ${Hn} * ${xe(Ta)} * pow(flatColour > 0.5 ? 1.0 : cityG, 2.2) : pow(hlDesat(cityC, vHighlight), vec3(2.2));`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
if (HL_PAINT(vHighlight)) totalEmissiveRadiance += ${Hn} * ${xe(Fa)};
#ifdef CITY_SLOT
else totalEmissiveRadiance += ${Wn} * vSlot.w;
#else
// Bay glazing (dark, untinted texels): the same constant sky tint as landmark glass, never a hotspot.
else totalEmissiveRadiance += ${Wn} * (1.0 - smoothstep(0.06, 0.2, cityLuma)) * (1.0 - cityM.r);
#endif`)};let i=ka(t);s.customProgramCacheKey=()=>i,s.uniforms=n}return s.defaultAttributeValues={...Ga},t.noFade&&(s.fog=!1),s.name=`city-look/${xt(t)}`,s.userData={cityLook:!0,cityVariant:{...t},[gt]:!0},s}function Ha(e){return e?e.isMeshBasicMaterial||e.userData?.unlit?"unlit (decal / emissive sign)":e.transparent||(e.opacity??1)<1?"transparent":e.vertexColors?"vertex colours":e.map?"own texture":null:"no material"}function Wa(e,t){let n=e?.userData??{};if(en(n.materialSlot)&&typeof n.tint=="string"){let s=n.tintSource==="measured";return{slot:n.materialSlot,tint:n.tint,inferred:n.materialSlotSource===Xt,...s?{source:"measured"}:{},...s&&typeof n.tintWhitePoint=="string"?{white:n.tintWhitePoint}:{}}}if(!t||Ha(e)||!e.color)return null;let r="#"+e.color.getHexString(),o=Zt(e.name,r);return{slot:o.slot,tint:o.tint,inferred:!0}}function $n(e,t,n,r,o={}){let s=t.getAttribute("position")?.count??0,a=yt(n,o),i=zn(n,r,o.source,void 0,o.whitePoint,o.exposure),c=t.getAttribute("layer"),l=t.getAttribute("tint");if(c&&l)return c.getX(0)===a&&Math.round(l.getX(0)*255)===i[0]&&Math.round(l.getY(0)*255)===i[1]&&Math.round(l.getZ(0)*255)===i[2];t.setAttribute("layer",new e.BufferAttribute(new Uint8Array(s).fill(a),1,!1));let m=new Uint8Array(s*4);for(let u=0;u<s;u++)m.set(i,u*4);return t.setAttribute("tint",new e.BufferAttribute(m,4,!0)),!0}function $a(e,t,n,r,o,s={}){let a=r.getAttribute("normal"),i=r.getAttribute("layer"),c=r.getAttribute("tint");if(!a||!i||!c)return 0;let[l,m,u]=zn("bitumen",o,s.source);t.updateWorldMatrix(!0,!0);let d=new e.Matrix4().copy(t.matrixWorld).invert().multiply(n.matrixWorld),h=new e.Matrix3().getNormalMatrix(d),g=new e.Vector3,w=yt("bitumen",s),p=0;for(let M=0;M<a.count;M++)g.set(a.getX(M),a.getY(M),a.getZ(M)).applyMatrix3(h).normalize(),!(g.y<pa)&&(i.setX(M,w),c.setXYZW(M,l/255,m/255,u/255,1),p++);return p&&(i.needsUpdate=!0,c.needsUpdate=!0),p}var Va="__canalRecallCityLookShared";function Qn(e,t={}){let n=globalThis,r=n[Va]??=new Map,o=r.get(e);return o||r.set(e,o=za(e,t)),o}function za(e,t={}){let n=t.document??globalThis.document,r=t.size??(globalThis.matchMedia?.("(pointer: coarse)").matches?128:256),o=Na(e),s=new Map,a=null,i=!1,c=(u,d)=>{let h=new e.DataArrayTexture(u,r,r,je);return h.format=d,h.type=e.UnsignedByteType,h.wrapS=h.wrapT=e.RepeatWrapping,h.minFilter=e.LinearMipmapLinearFilter,h.magFilter=e.LinearFilter,h.generateMipmaps=!0,h.anisotropy=t.anisotropy??_n("slotCells",16).anisotropy,h.unpackAlignment=1,h.needsUpdate=!0,h.userData={bytes:u.byteLength,[gt]:!0},h},l=(async()=>{if(!n)return;let u=t.brick!==void 0?t.brick:await va(n),{colour:d,mask:h}=Sa(n,u,r),g=An(d,h);a={colour:c(g.colour,e.RGBAFormat),mask:c(g.mask,g.channels===1?e.RedFormat:e.RGFormat)},i||(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)})(),m=u=>{let d=xt(u),h=s.get(d);return h||s.set(d,h=Ua(e,u,o)),h};return{uniforms:o,ready:l,material:m,dress(u,{lit:d,infer:h=!1,year:g=null,wallExposure:w=null}){let p=0;return u.traverse(M=>{if(!M.isMesh||Array.isArray(M.material)||M.material?.userData?.cityLook)return;let b=Wa(M.material,h);if(!b)return;let _=M.geometry;if(!_?.getAttribute("position"))return;let V=!!_.getAttribute("uv");!V&&!_.getAttribute("normal")&&_.computeVertexNormals();let R={year:g,white:b.inferred&&Qt(M.material.name),source:b.source,...b.white?{whitePoint:b.white}:{},...w?{exposure:w}:{}};$n(e,_,b.slot,b.tint,R)||(_=M.geometry=_.clone(),_.deleteAttribute("layer"),_.deleteAttribute("tint"),$n(e,_,b.slot,b.tint,R)),b.inferred&&b.slot==="slate"&&!b.source&&$a(e,u,M,_,b.tint,R);let T=M.material;M.material=m({lit:d,kind:"slot",uv:V?"uv":"box",side:T.side}),M.userData.citySlot={slot:b.slot,tint:b.tint,...b.source?{source:b.source}:{},inferred:b.inferred,from:T.name,layer:yt(b.slot,R)},T.userData?.[gt]||T.dispose(),p++}),p},highlighted(u,d){let h=u?.userData?.cityVariant;return h?m({...h,highlight:d,dim:!1}):u},dimmed(u,d){let h=u?.userData?.cityVariant;return h?m({...h,highlight:!1,dim:d}):u},bindAtlas(u){i=!!u,u?(o.cells.value=u.colour,o.masks.value=u.mask,o.slotBase.value=u.slotBase):a&&(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)},textureBytes(){return a&&!i?Math.round((a.colour.userData.bytes+a.mask.userData.bytes)*4/3):0}}}var ja=2*Math.PI*6378137;function er(e,t){return[(180+e)/360,(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+t*Math.PI/360)))/360]}var qa=e=>1/ja/Math.cos(e*Math.PI/180);function Mt(e,t){let[n,r]=er(e[0],e[1]),[o,s]=er(t[0],t[1]),a=qa(e[1]);return[(o-n)/a,(s-r)/a]}function Ye(e){let t=e.map(r=>r.anchor[0]),n=e.map(r=>r.anchor[1]);return[(Math.min(...t)+Math.max(...t))/2,(Math.min(...n)+Math.max(...n))/2]}var Ya=e=>Math.PI-(180+e)*Math.PI/180;function wt(e,t){let[n,r]=Mt(t,e.anchor),o=Ya(e.northOffsetDegrees),s=Math.cos(o),a=Math.sin(o),[i,c,l]=e.scale;return[s*i,0,-a*i,0,0,c,0,0,a*l,0,s*l,0,n,e.groundAltitudeMetres,r,1]}function ar(e){let t=new Map;for(let n of e)t.set(n.area??"default",[...t.get(n.area??"default")??[],n]);return t}function sr(e){let t=Ye(e);return Math.max(50,...e.map(n=>Math.hypot(...Mt(t,n.anchor))))+30}var Ka=e=>`NL.IMBAG.Pand.${e}`;function Rt(e){return[...new Set(e.flatMap(t=>[t.pand,...t.alsoSuppress??[]].map(Ka)))].sort()}function St(e){let t=e.L0/2,n=e.W0/2,r=e.E0,o={positions:[],normals:[],uvs:[],index:[]},s={positions:[],normals:[],uvs:[],index:[]},a=(u,d,h,g,w,p,M)=>{let b=u.positions.length/3;for(let _ of[d,h,g,w])u.positions.push(..._),u.normals.push(...p),u.uvs.push(...M(_));u.index.push(b,b+1,b+2,b,b+2,b+3)},i=u=>[u[0],u[1]],c=u=>[u[2],u[1]],l=u=>[u[0],u[2]];a(o,[-t,0,n],[t,0,n],[t,r,n],[-t,r,n],[0,0,1],i),a(o,[t,0,-n],[-t,0,-n],[-t,r,-n],[t,r,-n],[0,0,-1],i),a(o,[t,0,n],[t,0,-n],[t,r,-n],[t,r,n],[1,0,0],c),a(o,[-t,0,-n],[-t,0,n],[-t,r,n],[-t,r,-n],[-1,0,0],c);let m=e.R0!==void 0&&e.R0>r+.3?e.R0:void 0;if(m===void 0)a(s,[-t,r,n],[t,r,n],[t,r,-n],[-t,r,-n],[0,1,0],l);else{let u=m-r,d=Math.hypot(n,u),h=u/d,g=n/d;a(s,[-t,r,n],[t,r,n],[t,m,0],[-t,m,0],[0,g,h],l),a(s,[t,r,-n],[-t,r,-n],[-t,m,0],[t,m,0],[0,g,-h],l);let w=(p,M,b)=>{let _=o.positions.length/3,V=b?[[p,r,-n],[p,r,n],[p,m,0]]:[[p,r,n],[p,r,-n],[p,m,0]];for(let R of V)o.positions.push(...R),o.normals.push(M,0,0),o.uvs.push(...c(R));o.index.push(_,_+1,_+2)};w(t,1,!1),w(-t,-1,!0)}return{walls:o,roof:s}}function Xa(e,t=ir){return e?Math.max(t,Math.round(3*Math.max(e.L0,e.E0))):t}function vt(e,t,n,r,o,s=20){let a=new Set(o?.near),i=new Set(o?.far),c=[],l=[];return e.forEach((m,u)=>{let d=Math.hypot(m.x-t.x,m.z-t.z),h=typeof n=="number"?n:n[u],g=a.has(u)?h+s:h-(i.has(u)?s:0),w=a.has(u)||i.has(u)?r+s:r;d<=g?c.push(u):d<=w&&l.push(u)}),{near:c,far:l,culled:e.length-c.length-l.length}}var ir=140,Ja=700;function Za(e){let t=e.reduce((a,i)=>a+i.positions.length/3,0),n=e.reduce((a,i)=>a+(i.index?i.index.length:i.positions.length/3),0),r={positions:new Float32Array(t*3),normals:new Float32Array(t*3),uvs:new Float32Array(t*2),textures:new Float32Array(t),tints:new Float32Array(t*3),index:new Uint32Array(n)},o=0,s=0;for(let a of e){let i=a.matrix,c=a.positions.length/3,l=i[0],m=i[4],u=i[8],d=i[1],h=i[5],g=i[9],w=i[2],p=i[6],M=i[10],b=[h*M-g*p,g*w-d*M,d*p-h*w,u*p-m*M,l*M-u*w,m*w-l*p,m*g-u*h,u*d-l*g,l*h-m*d],_=l*b[0]+m*b[1]+u*b[2]<0;for(let R=0;R<c;R++){let T=a.positions[R*3],z=a.positions[R*3+1],W=a.positions[R*3+2],G=(o+R)*3;r.positions[G]=i[0]*T+i[4]*z+i[8]*W+i[12],r.positions[G+1]=i[1]*T+i[5]*z+i[9]*W+i[13],r.positions[G+2]=i[2]*T+i[6]*z+i[10]*W+i[14];let ne=a.normals[R*3],Me=a.normals[R*3+1],J=a.normals[R*3+2],re=b[0]*ne+b[1]*Me+b[2]*J,ce=b[3]*ne+b[4]*Me+b[5]*J,Ce=b[6]*ne+b[7]*Me+b[8]*J,j=(Math.hypot(re,ce,Ce)||1)*(_?-1:1);r.normals[G]=re/j,r.normals[G+1]=ce/j,r.normals[G+2]=Ce/j,r.uvs[(o+R)*2]=a.uvs[R*2]*a.uvScale,r.uvs[(o+R)*2+1]=a.uvs[R*2+1]*a.uvScale,r.textures[o+R]=a.texture,r.tints[G]=a.tint[0],r.tints[G+1]=a.tint[1],r.tints[G+2]=a.tint[2]}let V=a.index?a.index.length:c;for(let R=0;R<V;R+=3){let T=a.index?a.index[R]:R,z=a.index?a.index[R+1]:R+1,W=a.index?a.index[R+2]:R+2;r.index[s++]=o+T,r.index[s++]=o+(_?W:z),r.index[s++]=o+(_?z:W)}o+=c}return r}function Qa(e){let t=Math.max(1,e),n=Array.from({length:t},(r,o)=>o===t-1?`c = texture2D(t${o}, vUv).rgb;`:`if (vTex < ${o}.5) c = texture2D(t${o}, vUv).rgb; else`).join(`
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
${ze}
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
}`}}var Fe=10;function es(e){let t=Math.max(1,e),n=Array.from({length:t},(r,o)=>o===t-1?`btC = texture2D(btT${o}, vBtUv);`:`if (vBtTex < ${o}.5) btC = texture2D(btT${o}, vBtUv); else`).join(`
  `);return{declarations:`${Array.from({length:t},(r,o)=>`uniform sampler2D btT${o};`).join(`
`)}
varying float vBtTex;
varying vec3 vBtTint;
varying vec2 vBtUv;`,sample:`vec4 btC;
  ${n}
  diffuseColor *= vec4(btC.rgb * vBtTint, btC.a);
#undef USE_MAP
#include <map_fragment>`}}var tr=new WeakMap;function ts(e,t,n){let r=tr.get(e.MeshLambertMaterial);r||(r=class extends e.MeshLambertMaterial{btTextures=[];constructor(s){super(s),this.onBeforeCompile=function(a){let{declarations:i,sample:c}=es(Fe);for(let l=0;l<Fe;l++)a.uniforms[`btT${l}`]={value:this.btTextures[l]??this.btTextures[0]??null};a.vertexShader=a.vertexShader.replace("#include <common>",`#include <common>
attribute float btTex;
attribute vec3 btTint;
varying float vBtTex;
varying vec3 vBtTint;
varying vec2 vBtUv;`).replace("#include <uv_vertex>",`#include <uv_vertex>
  vBtUv = uv; vBtTex = btTex; vBtTint = btTint;`),a.fragmentShader=a.fragmentShader.replace("#include <common>",`#include <common>
${i}`).replace("#include <map_fragment>",c)},this.customProgramCacheKey=function(){return`building-types/lit-merged/${Fe}`}}copy(s){return super.copy(s),this.btTextures=[...s.btTextures??[]],this.onBeforeCompile=s.onBeforeCompile,this.customProgramCacheKey=s.customProgramCacheKey,this}},tr.set(e.MeshLambertMaterial,r));let o=new r({map:t[0],side:n});return o.btTextures=[...t],o.name="building-types/lit-merged",o.userData={recipeLookShared:!0,litMerged:!0},o}function nr(e,t,n){if(!t?.isShaderMaterial)return t;let r=n.get(t);if(!r){let o=String(t.vertexShader).replace("mat3(modelMatrix) * normal","mat3(modelMatrix * instanceMatrix) * normal").replace("modelViewMatrix * vec4(position, 1.0)","modelViewMatrix * instanceMatrix * vec4(position, 1.0)");if(o===t.vertexShader)throw new Error("recipe look vertex shader changed: instancing patch no longer applies");r=new e.ShaderMaterial({uniforms:t.uniforms,vertexShader:o,fragmentShader:t.fragmentShader,side:t.side}),r.name=`${t.name}/instanced`,r.userData={...t.userData},n.set(t,r)}return r}var rr=new Set(["brick","stucco","stone"]),or=new Set(["roofTile","slate","bitumen"]);async function lr(e,t){let{THREE:n}=e,r=e.nearMetres??ir,o=e.cullMetres??Ja;if(!t.length)throw new Error("no building-type instances");let s=Ye(t),a=new n.Group;a.name="building-types";let i=t.map(f=>new n.Matrix4().fromArray(wt(f,s))),c=i.map(f=>({x:f.elements[12],z:f.elements[14]})),l=Math.max(50,...c.map(f=>Math.hypot(f.x,f.z)))+30,m=new Map,u=new Map;t.forEach((f,y)=>u.set(f.unit,[...u.get(f.unit)??[],y]));let d=[],h=[],g=[],w=t.map(()=>r),p=[],M=f=>!!(f?.isShaderMaterial&&f.uniforms?.map?.value&&f.uniforms.tint?.value&&f.uniforms.uvScale&&f.uniforms.enuFromWorld),b=f=>!!f?.userData?.cityLook,_=f=>!!(f?.isMeshLambertMaterial&&f.userData?.recipeLookShared&&!f.userData?.litMerged&&f.map&&f.color&&Math.abs(f.map.repeat.x-f.map.repeat.y)<1e-9&&!f.map.offset.x&&!f.map.offset.y&&!f.map.rotation),V=!0,R=f=>M(f)||b(f)||V&&_(f);for(let[f,y]of u){let x=await e.loadUnit(f);x.updateMatrixWorld(!0);let v;x.traverse(A=>{A.userData?.nominal&&(v=A.userData.nominal)});let S=[];x.traverse(A=>{A.isMesh&&S.push(A)});for(let A of S)M(A.material)&&!p.includes(A.material.uniforms.map.value)&&p.push(A.material.uniforms.map.value),_(A.material)&&!p.includes(A.material.map)&&p.push(A.material.map);if(g.push({unit:f,indices:y,meshes:S,nominal:v}),e.nearMetres===void 0)for(let A of y)w[A]=Xa(v,r)}V=p.length<=Fe,!V&&g.some(f=>f.meshes.some(y=>_(y.material)))&&console.warn(`building types: ${p.length} textures, over ${Fe}; lit units keep one draw per material`);let T=new Map,z=f=>{if(b(f))return f;if(_(f)){let x=T.get(`lit|${f.side}`);return x||(x=ts(n,p,f.side),T.set(`lit|${f.side}`,x)),x}let y=T.get(f.side);if(!y){let x={enuFromWorld:f.uniforms.enuFromWorld,hlDimAll:{value:0}};p.forEach((v,S)=>{x[`t${S}`]={value:v}}),y=new n.ShaderMaterial({uniforms:x,...Qa(p.length),side:f.side}),y.name="building-types/merged",y.userData={recipeLookShared:!0},T.set(f.side,y)}return y},W=(f,y,x)=>{if(b(f.material)){let S=f.geometry.getAttribute("layer"),A=f.geometry.getAttribute("tint");return{...y,matrix:x,uvScale:1,texture:S.getX(0),tint:[A.getX(0),A.getY(0),A.getZ(0)]}}if(_(f.material)){let S=f.material.color;return{...y,matrix:x,uvScale:f.material.map.repeat.x,texture:p.indexOf(f.material.map),tint:[S.r,S.g,S.b]}}let v=f.material.uniforms.tint.value;return{...y,matrix:x,uvScale:f.material.uniforms.uvScale.value,texture:p.indexOf(f.material.uniforms.map.value),tint:[v.x,v.y,v.z]}},G=(f,y="recipe")=>{let x=new n.BufferGeometry;return x.setAttribute("position",new n.BufferAttribute(f.positions,3)),x.setAttribute("normal",new n.BufferAttribute(f.normals,3)),x.setAttribute("uv",new n.BufferAttribute(f.uvs,2)),x.setAttribute(y==="city"?"layer":y==="lit"?"btTex":"aTex",new n.BufferAttribute(f.textures,1)),x.setAttribute(y==="city"?"tint":y==="lit"?"btTint":"aTint",new n.BufferAttribute(f.tints,3)),x.setIndex(new n.BufferAttribute(f.index,1)),h.push(x),x},ne=(f,y)=>{let x=[];for(let v=0;v<f.count;v++)x.push(f.getX(v)),y>1&&x.push(f.getY(v)),y>2&&x.push(f.getZ(v));return x},Me=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];for(let{unit:f,indices:y,meshes:x,nominal:v}of g){let S=new Map,A=new Map,L=new Map;for(let F of x){let E=F.geometry;if(!R(F.material)){let q=new n.InstancedMesh(E,nr(n,F.material,m),y.length);q.name=`${f}/near/${F.name}`,q.userData.layer="near",d.push({mesh:q,indices:y,local:F.matrixWorld.clone(),far:!1,triangles:(E.index?.count??E.attributes.position.count)/3}),a.add(q);continue}let I=F.material.side;L.set(I,F.material),S.set(I,[...S.get(I)??[],W(F,{positions:ne(E.attributes.position,3),normals:ne(E.attributes.normal,3),uvs:ne(E.attributes.uv,2),index:E.index?.array},F.matrixWorld.elements)])}if(v){let F=N=>b(N.material)?N.userData?.citySlot?.slot:N.material?.userData?.materialSlot,E=N=>x.filter(D=>R(D.material)&&N.has(F(D))).sort((D,oe)=>oe.geometry.attributes.position.count-D.geometry.attributes.position.count)[0],I=E(rr),q=E(or),B=St(v);if(!I){let N=Ee=>x.filter(Y=>Ee.has(Y.material?.userData?.materialSlot)).sort((Y,Je)=>Je.geometry.attributes.position.count-Y.geometry.attributes.position.count)[0],D=N(rr),oe=N(or)??D;for(let[Ee,Y,Je]of[[D,B.walls,"walls"],[oe,B.roof,"roof"]]){if(!Ee||!Y.index.length)continue;let me=new n.BufferGeometry;me.setAttribute("position",new n.Float32BufferAttribute(Y.positions,3)),me.setAttribute("normal",new n.Float32BufferAttribute(Y.normals,3)),me.setAttribute("uv",new n.Float32BufferAttribute(Y.uvs,2)),me.setIndex(Y.index),h.push(me);let Pe=new n.InstancedMesh(me,nr(n,Ee.material,m),y.length);Pe.name=`${f}/far/${Je}`,Pe.userData.layer="far",d.push({mesh:Pe,indices:y,local:new n.Matrix4,far:!0,triangles:Y.index.length/3}),a.add(Pe)}}for(let[N,D]of[[I,B.walls],[q,B.roof]]){if(!N||!D.index.length)continue;let oe=N.material.side;L.set(oe,N.material),A.set(oe,[...A.get(oe)??[],W(N,{positions:D.positions,normals:D.normals,uvs:D.uvs,index:D.index},Me)])}}for(let[F,E]of[[S,!1],[A,!0]])for(let[I,q]of F){let B=L.get(I),N=Za(q),D=new n.InstancedMesh(G(N,b(B)?"city":_(B)?"lit":"recipe"),z(B),y.length);D.name=`${f}/${E?"far":"near"}/merged-${I}`,D.userData.layer=E?"far":"near",d.push({mesh:D,indices:y,local:new n.Matrix4,far:E,triangles:N.index.length/3}),a.add(D)}}let J,re=null,ce=new n.Matrix4,Ce=new n.Matrix4().makeScale(0,0,0),j=new Map,we=[],_t={near:0,far:0,culled:0},Ke=f=>{J=f;let y=new Set(f.near),x=new Set(f.far),v=0;for(let S of d){let A=S.indices.map((L,F)=>({global:L,k:F})).filter(({global:L})=>(S.far?x:y).has(L));A.forEach(({global:L},F)=>{ce.multiplyMatrices(i[L],S.local),S.mesh.setMatrixAt(F,j.has(L)?Ce:ce)}),S.mesh.userData.slotToGlobal=A.map(L=>L.global),S.mesh.count=A.length,S.mesh.instanceMatrix.needsUpdate=!0,S.mesh.visible=A.length>0,A.length&&(S.mesh.computeBoundingSphere(),S.mesh.computeBoundingBox(),v++)}_t={near:f.near.length,far:f.far.length,culled:f.culled};for(let S of we)S.mesh.visible=(S.layer.far?x:y).has(S.global)},Xe=(f=!1)=>{let y=e.getCentre();if(!y)return;let[x,v]=Mt(s,[y.lng,y.lat]),S={x,z:v};!f&&re&&Math.hypot(S.x-re.x,S.z-re.z)<10||(re=S,Ke(vt(c,S,w,o,J)))};Ke({near:[],far:c.map((f,y)=>y),culled:0}),Xe(!0);let Oe=new n.Mesh(new n.BufferGeometry,new n.MeshBasicMaterial);return Oe.name="building-types/driver",Oe.frustumCulled=!1,Oe.onBeforeRender=()=>Xe(),a.add(Oe),{anchor:s,group:a,suppress:Rt(t),radiusMetres:l,update:Xe,setHighlighted(f,y){let x=de(),v=_e[x],S=new Set([...f].map(L=>String(L).replace(/^NL\.IMBAG\.Pand\./,"")));for(let L of we)a.remove(L.mesh),L.mesh.dispose?.();we=[],j.clear(),t.forEach((L,F)=>{S.has(L.pand)?j.set(F,"highlight"):v.desaturate&&y&&qt(y.lngLat,L.anchor)&&j.set(F,"dim")});let A=Qn(n);for(let[L,F]of j)for(let E of d){if(!E.indices.includes(L))continue;let I=E.mesh.material,q=F==="highlight"?v.keepMaterials?I:b(I)?A.highlighted(I,!0):mt(n,I,"highlight",x):b(I)?A.dimmed(I,!0):mt(n,I,"dim",x),B=new n.InstancedMesh(E.mesh.geometry,q,1);B.setMatrixAt(0,ce.multiplyMatrices(i[L],E.local)),B.name=`${E.mesh.name}/${F}`,B.userData.slotToGlobal=[L],B.computeBoundingSphere(),B.computeBoundingBox(),F==="highlight"&&Kt(n,B,{style:x,up:[0,1,0]}),a.add(B),we.push({global:L,layer:E,mesh:B})}return J&&Ke(J),[...j.values()].filter(L=>L==="highlight").length},pandForHit(f,y){let x=f?.userData?.slotToGlobal;return y===void 0||!x?null:t[x[y]]?.pand??null},stats(){let f=d.filter(v=>v.mesh.visible&&v.mesh.count>0).length,y=0,x=0;for(let v of d)v.mesh.visible&&(v.far?x+=v.triangles*v.mesh.count:y+=v.triangles*v.mesh.count);return{instances:t.length,..._t,units:u.size,drawCalls:f,nearTriangles:y,farTriangles:x}},dispose(){for(let f of we)f.mesh.dispose?.();for(let f of d)f.mesh.dispose?.();for(let f of h)f.dispose();for(let f of T.values())f.dispose()}}}return dr(ns);})();

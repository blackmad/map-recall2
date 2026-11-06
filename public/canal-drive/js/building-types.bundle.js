"use strict";var CanalRecallBuildingTypes=(()=>{var nt=Object.defineProperty;var pr=Object.getOwnPropertyDescriptor;var gr=Object.getOwnPropertyNames;var yr=Object.prototype.hasOwnProperty;var xr=(e,t)=>{for(var n in t)nt(e,n,{get:t[n],enumerable:!0})},Mr=(e,t,n,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of gr(t))!yr.call(e,o)&&o!==n&&nt(e,o,{get:()=>t[o],enumerable:!(r=pr(t,o))||r.enumerable});return e};var wr=e=>Mr(nt({},"__esModule",{value:!0}),e);var ds={};xr(ds,{areaAnchor:()=>Ze,areaRadiusMetres:()=>hr,createBuildingTypes:()=>br,farMassing:()=>kt,groupByArea:()=>fr,instanceMatrix:()=>_t,partitionByDistance:()=>Lt,suppressionIds:()=>At});var rt={wallPull:.7,glassLift:.5,liftBrick:!0},Ft={wallPull:.35,glassLift:.25,liftBrick:!1},ps={photo:{cells:"photo",shadeBands:0,flatColour:!1,...rt,cartoonRoofCells:!1,outline:!1,litWallGain:255/225},procedural:{cells:"procedural",shadeBands:0,flatColour:!1,...rt,cartoonRoofCells:!1,outline:!1,litWallGain:1},untextured:{cells:"procedural",shadeBands:0,flatColour:!0,...rt,cartoonRoofCells:!1,outline:!1,litWallGain:1},storybook:{cells:"storybook",shadeBands:0,flatColour:!1,...Ft,cartoonRoofCells:!1,outline:!0,litWallGain:1,tone:{hueShift:-4,satMul:1.15,satAdd:0,keepDarkBelow:0,lightMul:1,lightAdd:.03,lightMax:.9}},cartoon:{cells:"cartoon",shadeBands:3,flatColour:!1,...Ft,cartoonRoofCells:!0,outline:!0,litWallGain:1,tone:{hueShift:0,satMul:1.7,satAdd:.08,keepDarkBelow:.35,lightMul:1.08,lightAdd:0,lightMax:.85}}};var ie=(e,t,n)=>Math.max(t,Math.min(n,e));function k(e){let t=/^#?([0-9a-f]{6})$/i.exec(e.trim());if(!t)throw Error(`Bad colour ${e}`);let n=parseInt(t[1],16);return[n>>16&255,n>>8&255,n&255]}var C=e=>"#"+e.map(t=>Math.round(ie(t,0,255)).toString(16).padStart(2,"0")).join("");function D([e,t,n]){let r=e/255,o=t/255,s=n/255,a=Math.max(r,o,s),i=Math.min(r,o,s),c=(a+i)/2;if(a===i)return[0,0,c];let l=a-i,m=c>.5?l/(2-a-i):l/(a+i);return[(a===r?(o-s)/l+(o<s?6:0):a===o?(s-r)/l+2:(r-o)/l+4)*60,m,c]}function U([e,t,n]){let r=(1-Math.abs(2*n-1))*t,o=r*(1-Math.abs(e/60%2-1)),s=n-r/2,[a,i,c]=e<60?[r,o,0]:e<120?[o,r,0]:e<180?[0,r,o]:e<240?[0,o,r]:e<300?[o,0,r]:[r,0,o];return[(a+s)*255,(i+s)*255,(c+s)*255]}var Et=(e,t,n)=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n];var at={canal:-1/0,c19:1860,school:1915,modern:1945};var ot=["#76808f","#606b79","#8c939c"],Ae={procedural:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:ot},untextured:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:ot},photo:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:ot},storybook:{tile:["#b9553a","#a94a33","#c46a45"],slate:["#556070","#4a5666","#657282"]},cartoon:{tile:["#e85a3c","#f08a2b","#d94a3a"],slate:["#3f5f8f","#2f4a78","#4f7bb0"]}};var Se={gravel:{hex:"#9e9281",luma:[112,156],cell:"flat"},"bitumen-dark":{hex:"#56585e",luma:[62,96],cell:"flat"},"bitumen-light":{hex:"#a99b84",luma:[150,182],cell:"flat"},"white-membrane":{hex:"#d9d9d3",luma:[196,228],cell:"flat"},"pantile-red":{hex:"#b5543a",luma:[84,124],cell:"tile"},"pantile-dark":{hex:"#6a5248",luma:[64,98],cell:"tile"},slate:{hex:"#76808f",luma:[62,140],cell:"slate"},zinc:{hex:"#9aa1a6",luma:[138,176],cell:"slate"},sedum:{hex:"#7a8350",luma:[96,132],cell:"flat"},solar:{hex:"#2e3a52",luma:[44,70],cell:"flat"},terrace:{hex:"#a38d74",luma:[124,162],cell:"flat"},glass:{hex:"#8fa3ad",luma:[130,170],cell:"flat"}},Be={gravel:Se.gravel.hex,membrane:Se["white-membrane"].hex,bitumen:Se["bitumen-dark"].hex,pebble:Se["bitumen-light"].hex},Ot=[Be.gravel,Be.membrane,Be.bitumen,Be.pebble],J={tile:Ae.photo.tile,slate:Ae.photo.slate,flat:Ot};var _e={photo:{canal:["#7a3b2c","#7a3b2c","#6b3428","#8c4632","#9a5846","#b05a40","#4a2e26","#2e2a27","#3e4a40","#5d605a","#e4ddcd"],c19:["#b05a40","#b05a40","#bd6a45","#a24d38","#c58b5e","#d3b184","#e2d5ba","#e2d5ba","#d9c5a4","#9a5846"],school:["#8c4a38","#7a4535","#9a5240","#6e3d33","#a85a3c","#5e3a32","#b0603f"],modern:["#c9b79a","#b9ad9a","#a8a49c","#d3c6ad","#8f8a82","#bfb3a0","#9c7a62","#b05a40"]},storybook:{canal:["#b9583f","#9a4a38","#7a4a3c","#4a5048","#3f4a5a","#ead9b0","#c8664a"],c19:["#c8664a","#d98b5f","#e0b36a","#ead9b0","#d9b995","#c9a08c","#c8664a"],school:["#a8553f","#9a5a48","#b87a5c","#c8664a","#8a4e40"],modern:null},cartoon:{canal:["#d9453d","#a8433a","#3b3b4a","#2a9d8f","#4672b0","#fffaf0","#e8573d"],c19:["#e8573d","#ee7f2c","#f2b92e","#f3e6c8","#d96a4d","#f2b92e"],school:["#d96a4d","#e8573d","#b9583f","#ee7f2c"],modern:null}};var gs={canal:{label:"canal-house centre (before 1860)",wall:_e.photo.canal[0],roof:Ae.photo.tile[0]},c19:{label:"19th-century ring (1860-1914)",wall:_e.photo.c19[0],roof:Ae.photo.tile[1]},school:{label:"Amsterdamse School (1915-1944)",wall:_e.photo.school[0],roof:Ae.photo.slate[0]},modern:{label:"post-war and contemporary (1945+)",wall:_e.photo.modern[0],roof:Ot[0]}};var Dt=["brick","stucco","accent","stone","frame","door","glass","roofTile","slate","bitumen","paint"],Pt={brick:"brick",accent:"brick",stucco:"stucco",stone:"stone",frame:"frame",door:"door",glass:"glass",roofTile:"tile",slate:"slate",bitumen:"flat",paint:"frame"},$={brick:3.36,stucco:2.4,accent:3.36,stone:1.28,frame:1,door:1,glass:1,roofTile:1.2,slate:1.2,bitumen:1.2,paint:1},te=[.3,.6],Rr="#f1ede2",vr="#cfc8b8";function Sr(e){let[t,n,r]=D(k(e)),o=ie(.12+r*.9,te[0],te[1]);return C(U([t,ie(n,.12,.5),o]))}function _r(e){let[t,n,r]=D(k(e));return C(U([t,ie(n,0,.55),ie(r*1.06+.03,.4,.97)]))}function Ar(e){let t=k(e),[n,r,o]=D(t);return o>=.5?C(Et(t,k(Rr),.75)):C(U([n,r,Math.max(o,.16)]))}function kr(e){let[t,n,r]=D(k(e));return C(Et(U([t,n,Math.max(r,.62)]),k(vr),.45))}function Lr(e){let[t,n,r]=D(k(e));return r>=.17?e.startsWith("#")?e.toLowerCase():"#"+e.toLowerCase():C(U([t,n<.15?0:n,.17]))}function Tr(e,t){let n=D(k(t))[2];if(e==="roofTile"){let[r,o]=D(k(t));return o<.2?J.slate[1]:C(U([r,ie(o*1.1,.35,.6),ie(.2+n*.85,.38,.5)]))}return e==="slate"?n<.27?J.slate[1]:n<.31?J.slate[0]:J.slate[2]:n<.4?J.flat[2]:J.flat[0]}var de="measured",Fr=.18,Cr=225/255;function Er(e){let[t,n,r]=D(k(e)),[o,s,a]=k(C(U([t,n,Math.max(r,Fr)])));return C([o,s,a].map(i=>Math.min(255,Math.round(i/Cr))))}var le=32,ue=64,ee=[157.19,92.83,69.17],It=240.95,Bt=.16,Or=255/(ee[0]+(It-ee[0])*Bt);function st(e,t){let n=t/(ue-1),r=n<.5?ee[0]+(ee[1]-ee[0])*(n/.5):ee[1]+(ee[2]-ee[1])*((n-.5)/.5),o=5-15*t/35,s=17-15*t/35,a=t<35&&e+.5>=o&&e+.5<s;return Math.min(255,Math.round((a?r+(It-r)*Bt:r)*Or))}var Dr=(()=>{let e=0;for(let t=0;t<ue;t++)for(let n=0;n<le;n++)e+=st(n,t);return e/(le*ue)})(),Ct=.4;function Pr(e){let[t,n,r]=D(k(e)),s=(r>=Ct?k(e):U([t,n,Ct])).map(i=>i/(Dr/255)),a=Math.max(1,...s.map(i=>i/255));return C(s.map(i=>Math.min(255,Math.round(i/a))))}var Ir=228/255;function Br(e){return C(k(e).map(t=>Math.min(255,Math.round(t/Ir))))}function Nr(e){return C(k(e))}function Gr(e){return C(k(e))}var Ur=["brick","accent","glass","stone","bitumen","slate","roofTile"],Nt=(e,t)=>t===de&&Ur.includes(e);function Ne(e,t,n){if(n===de&&(e==="brick"||e==="accent"))return Er(t);if(n===de&&e==="glass")return Pr(t);if(n===de&&e==="stone")return Br(t);if(n===de&&e==="bitumen")return Nr(t);if(n===de&&(e==="slate"||e==="roofTile"))return Gr(t);switch(e){case"brick":case"accent":return Sr(t);case"stucco":return _r(t);case"stone":return kr(t);case"frame":return Ar(t);case"door":return Lr(t);case"glass":return"#ffffff";case"paint":return t.startsWith("#")?t.toLowerCase():"#"+t.toLowerCase();default:return Tr(e,t)}}var it={asphalt:{base:[86,88,93]},cycle:{base:[150,66,58]},klinker:{base:[122,90,80],joint:"#4b3d38"},pavement:{base:[174,162,152],joint:"#7f756b"},kerb:"#cfcac0",paint:"#f2f0ea",rail:"#6c6e72",bollard:"#5a2a26"},Gt="#ffd21f",Ut="#ff8033",Ht="#b4682c";var Wt={land:{base:[168,158,142],joint:"#857b6d"},paving:{base:[184,174,158],joint:"#8f8577"},square:{base:[190,179,161],joint:"#958a7c"},klinker:{base:[158,124,114],joint:"#7a6660"},asphalt:[68,72,80],cycle:[156,76,66],gravel:[180,166,136],park:[96,140,70],wood:[70,112,58],parking:[102,102,105],kerb:"#aaa498",water:"#46707c",lawn:[110,154,74],bed:{soil:[98,80,60],leaf:[84,122,58]},shrub:{base:[56,92,46],leaf:[76,116,56]},bark:[118,84,58],sand:[212,194,150],parkGravel:[198,184,152],parkPath:[110,110,112],pond:"#46707c"};var Wr="highlight",$r="__canalRecallHighlight",Vr="highlightAccent",zr="__canalRecallHighlightAccent",ke={yellow:{keepMaterials:!1,outline:!1,rim:!1,desaturate:!1,ring:!1,beacon:!1,wash:!1,animated:!1},a:{keepMaterials:!0,outline:!0,rim:!1,desaturate:!1,ring:!0,beacon:!0,wash:!0,animated:!1},b:{keepMaterials:!0,outline:!1,rim:!0,desaturate:!1,ring:!0,beacon:!1,wash:!1,animated:!0},c:{keepMaterials:!0,outline:!1,rim:!1,desaturate:!0,ring:!0,beacon:!1,wash:!1,animated:!1}};var jr=60,ne=.4,be=2,ft=3.5,$t=100,qr=300;var Yr=.75,lt=.35,Kr="__canalRecallHighlightBoost";function Vt(){let e=Number(globalThis[Kr]);return Number.isFinite(e)?Math.min(1,Math.max(0,e)):0}var ut="__canalRecallHighlightExtent";function Kt(){let e=globalThis;return e[ut]instanceof Map?e[ut]:e[ut]=new Map}var Xr=.3,Jr=2.4,Zr=.9,Qr=2.2;var eo=.28;function zt(e){if(typeof e!="string")return null;let t=e.trim().toLowerCase();return t==="a"||t==="outline"?"a":t==="b"||t==="rim"?"b":t==="c"||t==="desaturate"?"c":t==="yellow"||t==="0"||t==="off"||t==="old"?"yellow":t==="default"?ct:null}var ct="a";function pe(e){try{let t=globalThis;if(e===void 0){let n=zt(t[$r]);if(n)return n}return zt(new URLSearchParams(e??t.location?.search??"").get(Wr))??ct}catch{return ct}}function Xt(e=pe(),t){if(e==="yellow")return Gt;try{let n=globalThis,r=(t===void 0?n[zr]:void 0)??new URLSearchParams(t??n.location?.search??"").get(Vr);if(r==="hud")return Ht;if(typeof r=="string"&&/^#?[0-9a-f]{6}$/i.test(r))return r.startsWith("#")?r:`#${r}`}catch{}return Ut}function ht(e=pe()){return ke[e].keepMaterials?{HL_KEEP:""}:{}}var dt=`
#ifdef HL_KEEP
#define HL_PAINT(h) false
#else
#define HL_PAINT(h) ((h) > 0.5 && (h) < 1.5)
#endif
#define HL_GHOST(h) ((h) > 2.5 && fract(dot(floor(gl_FragCoord.xy), vec2(0.569840296, 0.754877666))) >= ${eo.toFixed(3)})
float hlState(float hidden) { return hidden > 3.5 ? 3.0 : (hidden > 2.5 ? 2.0 : (hidden > 1.5 ? 1.0 : 0.0)); }
vec3 hlDesat(vec3 c, float h) { return h > 1.5 && h < 2.5 ? mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), ${ne.toFixed(2)}) : c; }`,to=110540,no=e=>111320*Math.cos(e*Math.PI/180);function ro(e,t){let n=(e[1]+t[1])/2;return Math.hypot((e[0]-t[0])*no(n),(e[1]-t[1])*to)}var Jt=(e,t,n=jr)=>!!e&&ro(e,t)<=n;var jt=`
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
  float far = clamp((length(c4.xyz - hlEye) - ${$t.toFixed(1)}) / ${(qr-$t).toFixed(1)}, 0.0, 1.0);
  float width = hlWidthPx * mix(1.0, hlFarScale, far);
  if (dot(dir, dir) > 1e-12) clip.xy += normalize(dir) * width * 2.0 / hlViewport * clip.w;
#endif
  gl_Position = clip;
}`,oo=`
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
  if (up < ${lt.toFixed(2)} || hlWash <= 0.0) discard;
  gl_FragColor = vec4(hlAccent, hlWash * smoothstep(${lt.toFixed(2)}, ${(lt+.15).toFixed(2)}, up));
#else
  vec3 n = hlHasNormal > 0.5 ? normalize(vHlNormal) : normalize(cross(dFdx(vHlPos), dFdy(vHlPos)));
  vec3 v = normalize(hlEye - vHlPos);
  float f = pow(1.0 - abs(dot(n, v)), ${Qr.toFixed(2)});
  float pulse = 0.775 + 0.225 * sin(hlTime * 6.2831853 / ${Jr.toFixed(2)});
  gl_FragColor = vec4(hlAccent * f * ${Zr.toFixed(2)} * pulse, 1.0);
#endif
}`,Ge="canalRecallHighlightPass",ao="__canalRecallHighlightOutlinePx";function so(){let e=globalThis[ao],t=e==null||e===""?NaN:Number(e);return Number.isFinite(t)&&t>=0?t:null}var io=(e,t)=>{let[n,r,o]=k(t);return new e.Vector3(n/255,r/255,o/255)};function lo(e,t,n={}){let r={};n.merged&&(r.HL_MERGED=""),t==="outline"&&(r.HL_OUTLINE=""),t==="roof"&&(r.HL_ROOF="");let o=jt;if(n.feature){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n.feature.attribute))throw new Error(`highlight: bad feature attribute ${n.feature.attribute}`);r.HL_FEATURE=n.feature.attribute,o=`attribute float ${n.feature.attribute};
uniform float hlFeatureId;
${jt}`}let s=new e.ShaderMaterial({defines:r,uniforms:{hlViewport:{value:new e.Vector2(1,1)},hlWidthPx:{value:be},hlFarScale:{value:ft/be},hlCentre:{value:new e.Vector3},hlDepthPush:{value:Xr},hlAccent:{value:io(e,n.accent??Xt())},hlEye:{value:new e.Vector3},hlTime:{value:0},hlHasNormal:{value:1},hlFeatureId:{value:n.feature?.id??0},hlUp:{value:new e.Vector3(0,0,1)},hlWash:{value:0}},vertexShader:o,fragmentShader:oo,side:t==="outline"?e.BackSide:e.FrontSide,transparent:!0,depthTest:!0,depthWrite:t==="outline",blending:t==="rim"?e.AdditiveBlending:e.NormalBlending,polygonOffset:t!=="outline",polygonOffsetFactor:-1,polygonOffsetUnits:t==="roof"?-4:-2});return s.name=`highlight/${t}${n.merged?"/merged":""}`,s.userData={[Ge]:!0},s.defaultAttributeValues={hidden:[0],normal:[0,0,0]},s}function uo(e,t,n,r){let o=e.geometry?.boundingBox,s=t.elements;if(!o)return;let a=n.domElement,i=a?.clientWidth||r.x,c=a?.clientHeight||r.y,l=[],m=!1;for(let u=0;u<8;u++){let d=u&1?o.max.x:o.min.x,h=u&2?o.max.y:o.min.y,g=u&4?o.max.z:o.min.z,w=s[0]*d+s[4]*h+s[8]*g+s[12],p=s[1]*d+s[5]*h+s[9]*g+s[13],M=s[3]*d+s[7]*h+s[11]*g+s[15];if(!(M>1e-9)){m=!0;break}l.push((w/M+1)/2*i,(1-p/M)/2*c)}Kt().set(e,{t:performance.now(),points:l,behind:m,width:i,height:c})}function co(e){for(let t of e?.userData?.[Ge]??[])e.remove(t),bo(t.material),Kt().delete(t);e?.userData&&delete e.userData[Ge]}var mo=4,mt=new Map,Zt=Symbol("highlightPassPool");function fo(e,t){return`${e}|${t.merged?1:0}|${t.feature?.attribute??""}|${t.accent??""}`}function ho(e,t,n={}){let r=fo(t,n),o=mt.get(r)?.pop();if(o){let a=o.uniforms;return a.hlCentre.value.set(0,0,0),a.hlHasNormal.value=1,a.hlFeatureId.value=n.feature?.id??0,a.hlUp.value.set(0,0,1),a.hlWash.value=0,a.hlEye.value.set(0,0,0),a.hlTime.value=0,a.hlWidthPx.value=be,a.hlFarScale.value=ft/be,o}let s=lo(e,t,n);return s.userData[Zt]=r,s}function bo(e){let t=e?.userData?.[Zt];if(!t){e?.dispose?.();return}let n=mt.get(t)??[];mt.set(t,n),n.length<mo&&!n.includes(e)?n.push(e):e.dispose()}function qt(e){let t=e?.getAttribute?.("position")??e?.attributes?.position;return!t||!!t.array}function Qt(e,t,n={}){co(t);let r=ke[n.style??pe()],o=[...r.outline?["outline"]:[],...r.rim?["rim"]:[],...r.wash&&!n.feature?["roof"]:[]];if(!o.length||!t?.geometry)return[];let s=t.geometry,a=n.centre;if(!a){!s.boundingBox&&qt(s)&&s.computeBoundingBox?.();let p=s.boundingBox?.getCenter(new e.Vector3)??s.boundingSphere?.center;a=p?[p.x,p.y,p.z]:[0,0,0]}let i=s.getAttribute?.("normal")?1:0,c=[],l=new e.Matrix4,m=new e.Vector4,u=new e.Vector2,d=new e.Matrix3,h=new e.Vector3,g=n.up??[0,0,1],w=!n.merged&&!n.feature&&!t.isInstancedMesh;w&&!s.boundingBox&&qt(s)&&s.computeBoundingBox?.();for(let p of o){let M=ho(e,p,{merged:n.merged,feature:n.feature,accent:n.accent??Xt(n.style)});M.uniforms.hlCentre.value.set(a[0],a[1],a[2]),M.uniforms.hlHasNormal.value=i;let b=t.isInstancedMesh?new e.InstancedMesh(s,M,t.count):new e.Mesh(s,M);t.isInstancedMesh&&(b.instanceMatrix=t.instanceMatrix),b.name=`${t.name||"mesh"}/highlight-${p}`,b.frustumCulled=!1,b.castShadow=b.receiveShadow=!1,b.renderOrder=(t.renderOrder??0)+1,b.raycast=()=>{},p==="roof"&&Object.defineProperty(b,"visible",{get:()=>t.visible&&Vt()>.001,set:()=>{},configurable:!0}),b.onBeforeRender=(_,V,R)=>{t.isInstancedMesh&&(b.count=t.count),p!=="roof"&&(b.visible=t.visible);let T=M.uniforms;if(p==="roof"){d.setFromMatrix4(b.matrixWorld),h.setFromMatrixColumn(b.matrixWorld,0);let G=h.length()<.001?[0,0,1]:g;T.hlUp.value.set(G[0],G[1],G[2]).applyMatrix3(d.invert()).normalize(),T.hlWash.value=Yr*Vt()}_.getDrawingBufferSize(u),T.hlViewport.value.copy(u);let z=_.domElement?.clientWidth||u.x,W=so();T.hlWidthPx.value=(W??be)*(u.x/z),T.hlFarScale.value=W==null?ft/be:1,l.multiplyMatrices(R.projectionMatrix,R.matrixWorldInverse).multiply(b.matrixWorld),p==="outline"&&w&&uo(b,l,_,u),l.invert(),m.set(0,0,1,0).applyMatrix4(l),Math.abs(m.w)>1e-12&&T.hlEye.value.set(m.x/m.w,m.y/m.w,m.z/m.w),T.hlTime.value=performance.now()/1e3,M.uniformsNeedUpdate=!0},t.add(b),c.push(b)}return t.userData??={},t.userData[Ge]=c,c}var Yt=new WeakMap;function bt(e,t,n,r=pe()){if(!t||n==="plain"||n==="highlight"&&ke[r].keepMaterials)return t;let o=Yt.get(t);o||Yt.set(t,o=new Map);let s=`${n}|${r}`,a=o.get(s);if(a)return a;if(n==="highlight")a=new e.MeshLambertMaterial({color:16765471,emissive:7033856,side:t.side??e.FrontSide});else if(t.isShaderMaterial&&t.uniforms?.tint?.value?.isVector3)a=t.clone(),a.uniforms={...t.uniforms,tint:{value:po(t.uniforms.tint.value.clone())}};else if(t.isShaderMaterial&&t.uniforms?.hlDimAll)a=t.clone(),a.uniforms={...t.uniforms,hlDimAll:{value:1}};else if(t.isShaderMaterial)a=t.clone(),a.uniforms=t.uniforms,a.defines={...t.defines??{},HL_DIM_ALL:""};else{if(a=t.clone(),a.color){let i=a.color,c=.2126*i.r+.7152*i.g+.0722*i.b;i.setRGB(i.r+(c-i.r)*ne,i.g+(c-i.g)*ne,i.b+(c-i.b)*ne)}if(a.map){let i=a.onBeforeCompile;a.onBeforeCompile=(c,l)=>{i?.call(a,c,l),c.fragmentShader=c.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${ne.toFixed(2)});`)},a.customProgramCacheKey=()=>`${t.customProgramCacheKey?.()??""}|hl-dim`}}return a.name=`${t.name||"material"}/${n}`,a.userData={...t.userData??{},highlightVariantOf:t},o.set(s,a),a}function po(e){let t=.2126*e.x+.7152*e.y+.0722*e.z;return e.set(e.x+(t-e.x)*ne,e.y+(t-e.y)*ne,e.z+(t-e.z)*ne)}var en="inferred",go=e=>D(k(e))[1]<.2,yo=e=>{let[t,n,r]=D(k(e));return(t<45||t>340)&&n>=.15&&r<.7},xo=e=>go(e)?"slate":"roofTile",pt=e=>yo(e)?"brick":"stucco",Mo=[{test:/glass|glaz|window|vitr|ruit|pane/,slot:"glass",confidence:"name",rule:"glazing name"},{test:/decal|sign|mural|logo|letter|clock|dial/,slot:"paint",confidence:"name",rule:"signage / decal"},{test:/door|deur|gate/,slot:"door",confidence:"name",rule:"door name"},{test:/frame|kozijn|louvre|louver|blind|shutter|rail|mullion|sash/,slot:"frame",confidence:"name",rule:"joinery name"},{test:/brick|baksteen|klinker|terracotta/,slot:"brick",confidence:"name",rule:"brick name"},{test:/slate|leien|lei$/,slot:"slate",confidence:"name",rule:"slate name"},{test:/bitumen|asphalt|tar$|felt|flatroof|flat-roof|gravel/,slot:"bitumen",confidence:"name",rule:"flat roof name"},{test:/roof|tile|pantile|dakpan|dak/,slot:xo,confidence:"name",rule:"roof name, grey \u2192 slate, else pantile"},{test:/sandstone|stone|steen|column|marble|granite|limestone|plinth/,slot:"stone",confidence:"name",rule:"stone name"},{test:/stucco|render|plaster|pleister|concrete|beton|slab/,slot:"stucco",confidence:"name",rule:"render / concrete name"},{test:/gold|gilt|bronze|copper|brass|zinc|metal|steel|iron|lead|alu/,slot:"paint",confidence:"name",rule:"metal name (flat colour)"},{test:/wall|facade|gevel/,slot:pt,confidence:"name",rule:"wall name, brick hue \u2192 brick, else stucco"},{test:/ochre|yellow|buff/,slot:pt,confidence:"colour-word",rule:"ochre: yellow brick (brick hue) or render"},{test:/pink|rose/,slot:"stucco",confidence:"colour-word",rule:"pink: painted render"},{test:/moss|grass|green|blue|orange|purple|paint|teal/,slot:"paint",confidence:"colour-word",rule:"coloured paint word"},{test:/white|cream|ivory/,slot:"stucco",confidence:"colour-word",rule:"white: stucco (could be white trim)"},{test:/dark|black|charcoal|anthracite/,slot:"frame",confidence:"colour-word",rule:"dark: painted joinery / ironwork (could be a dark wall)"},{test:/red/,slot:pt,confidence:"colour-word",rule:"red: brick hue \u2192 brick (could be red tile or paint)"},{test:/grey|gray/,slot:"stucco",confidence:"colour-word",rule:"grey: render (could be concrete or zinc)"}];function tn(e){return String(e??"").toLowerCase().replace(/[-_.\s]*\d+$/,"").trim()}function wo(e){let[t,n,r]=D(k(e));return r<.22?{slot:"frame",rule:"very dark: joinery / ironwork"}:n>=.15&&(t<45||t>340)&&r<.62?{slot:"brick",rule:"brick hue"}:n<.2&&r>=.6?{slot:"stucco",rule:"pale neutral: render"}:n<.2&&r>=.22&&t>180&&t<260?{slot:"slate",rule:"blue-grey: slate"}:n<.25?{slot:"stone",rule:"neutral mid-tone: stone"}:{slot:"paint",rule:"saturated colour: paint"}}function nn(e,t){let n=t.toLowerCase(),r=tn(e);for(let s of Mo)if(s.test.test(r))return{slot:typeof s.slot=="function"?s.slot(n):s.slot,tint:n,confidence:s.confidence,rule:s.rule};let o=wo(n);return{slot:o.slot,tint:n,confidence:"colour",rule:`no material word in "${r||"unnamed"}"; ${o.rule}`}}var rn=e=>/white|cream|ivory/.test(tn(e)),on=e=>typeof e=="string"&&Dt.includes(e);var ln={ribs:{pitch:.5,min:.25,max:2,w:.09,out:.04},boards:{pitch:.4,min:.15,max:1.5,w:.05,out:.035},louvres:{pitch:.35,min:.2,max:1,w:.12,out:.12},panels:{pitch:1.2,min:.6,max:6,w:.05,out:.035}};var oi={min:.15,max:ln.ribs.max};var un={canal:["#6e5352","#8c7768","#977f73","#a79276","#b8a17a","#575245","#60564b","#62544d","#61584c","#655850","#655b50","#6a5454","#6f6058","#726359","#726459","#76615d","#77685d","#7a6c60","#826c66","#918174","#9a887f","#a89f8a","#6b6163","#dfdcd2"],c19:["#70564f","#6f5b52","#7a665c","#86695b","#886a5f","#857266","#8b746d","#9b887e","#a38e83","#ad9585","#61534a","#63564e","#685b52","#6f6057","#716259","#75665c","#7b6961","#7c6962","#7f6a64","#7f7664","#8e796f","#9c9181","#95787e","#dad8cf"],school:["#665247","#775744","#735d52","#786158","#8c5957","#896559","#856f63","#9d7f6d","#ad997f","#5c4f48","#61564c","#67564e","#6b5554","#6b5851","#6b5b50","#716057","#745e5b","#75655c","#78665f","#806d64","#89706b","#a19888","#614a4e","#a4a09f"],modern:["#715d53","#7c6459","#816b64","#8f7265","#9c8980","#ac9a86","#60594c","#635c4e","#6a5a50","#6c5a54","#6c5e55","#6e6256","#72675a","#776a5d","#7b6a61","#7f6f64","#807265","#886f6b","#8b7d6d","#958b79","#a29189","#695256","#a59b8d","#c8c5ba"]};var gt={"#4f4834":[215,215,215],"#463823":[216,215,215],"#5f5950":[215,215,215],"#a69873":[215,215,215],"#57423e":[215,215,215],"#473c3b":[215,215,215],"#5d5d5c":[214,215,215],"#7e573b":[215,215,215],"#705449":[215,215,215],"#7f8283":[215,214,215],"#796764":[215,215,215],"#5d534b":[215,215,215],"#7d6e52":[215,215,215],"#88735e":[215,215,215],"#88715f":[215,215,215],"#736352":[215,215,215],"#241d1c":[172,172,172],"#4b3f37":[215,215,215],"#615551":[215,215,215],"#595651":[214,215,214],"#423931":[215,215,215],"#7b6d6a":[215,214,216],"#382418":[215,215,215],"#866343":[215,215,215],"#6e6256":[215,215,215],"#625650":[205,205,205],"#252c24":[185,185,186],"#2d281b":[215,214,215],"#3b342b":[215,215,215],"#6f5c56":[215,215,215],"#393535":[215,215,215],"#786357":[215,215,215],"#383d43":[205,215,215],"#554e4a":[215,216,215],"#3d3432":[215,215,215],"#3d353c":[215,215,215],"#4e443f":[215,215,215],"#70574d":[207,207,207],"#d49662":[215,215,215],"#917b5c":[215,215,215],"#494341":[215,215,215],"#645f5f":[215,215,214],"#342a18":[215,215,215],"#825746":[215,216,215],"#99604e":[212,215,215],"#706868":[215,215,215],"#786b61":[215,215,214],"#5c5b57":[215,215,215],"#7a655b":[215,215,215],"#6f5b54":[215,215,215],"#4a3f3a":[215,214,215],"#614f44":[216,215,215],"#654e44":[215,215,215],"#6f5f53":[215,215,216],"#584d49":[215,215,215],"#d3c9b2":[215,215,215],"#544b46":[215,215,215],"#929289":[215,215,215],"#68584f":[215,215,216],"#574d47":[215,215,215],"#5e4e41":[215,215,215],"#6e605a":[215,215,215],"#605d5c":[215,215,215],"#8c7a6f":[215,215,215],"#4a3832":[165,165,166],"#81614f":[215,215,215],"#3d3533":[215,215,215],"#6d5351":[215,215,215],"#5c3d33":[214,214,215],"#906553":[215,215,215],"#65493d":[215,215,215],"#8e5f49":[215,215,215],"#8c6858":[215,215,215],"#8b5946":[215,215,215],"#665253":[209,209,209],"#3e3222":[215,215,215],"#000000":[197,198,197],"#7b081b":[215,215,215],"#383131":[215,215,215],"#3d3b37":[211,215,215],"#877d76":[214,215,215],"#191d0c":[215,214,213],"#bcab88":[215,215,215],"#656462":[215,215,215],"#3f3634":[174,174,175],"#463e3c":[197,197,198],"#453d3a":[177,177,176],"#1f1a1b":[156,156,157],"#615450":[214,215,215],"#5b4f4b":[215,215,215],"#574c4a":[215,215,215],"#413333":[215,215,215],"#7b5c53":[215,215,215],"#5f342b":[216,215,215],"#4e2422":[215,215,215],"#5b4b44":[209,209,209],"#493d32":[215,215,215],"#6a5048":[216,216,215],"#5e5855":[215,215,215],"#5e3f35":[215,215,215],"#68564f":[215,215,215],"#6b3e33":[215,214,215],"#5f3c30":[215,214,215],"#929191":[215,215,215],"#a2acb3":[215,215,215],"#8f7b65":[215,215,215],"#988e7d":[215,215,215],"#726d60":[215,215,215],"#584c45":[215,214,215],"#594643":[216,215,215],"#5e5750":[212,215,215],"#78645b":[215,215,215],"#484440":[215,215,215],"#73645e":[215,215,215],"#5c4f47":[215,215,215],"#3c3d39":[215,215,215],"#645451":[215,215,214],"#37333d":[179,179,178],"#a6856f":[215,215,215],"#574d4d":[205,205,205],"#393737":[215,215,215],"#6f4a3b":[215,214,215],"#ffa169":[212,215,215],"#576465":[216,215,216],"#71614a":[215,215,215],"#6c584f":[215,215,215],"#5b463e":[215,216,215],"#765e52":[214,215,215],"#4f4e4c":[215,215,215],"#544945":[215,215,215],"#504140":[194,195,194],"#51514f":[215,215,215],"#74665f":[215,215,215],"#735c59":[215,215,215],"#474d56":[215,215,215],"#7d6e5a":[215,215,215],"#514a43":[215,215,215],"#4e4e49":[215,215,215],"#745c51":[215,215,215],"#47403c":[215,215,215],"#4c3a37":[215,215,215],"#675d5a":[215,215,215],"#574e48":[215,215,215],"#686360":[215,215,215],"#4a413f":[215,215,215],"#423735":[215,215,215],"#756860":[215,215,215],"#5e5144":[215,215,215]};var rl={street:{...it,brick:it.klinker},tones:Wt};var Fo=["sunny","legacy"],Co="sunny";function re(e){let t=globalThis,r=/[?&]look=([\w-]+)/.exec(e??t.location?.search??"")?.[1]??t.__canalRecallLook;return Fo.includes(r??"")?r:Co}var xe=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},Eo=e=>255*(e<=.0031308?e*12.92:1.055*e**(1/2.4)-.055),ce=e=>{let t=parseInt(e.replace("#",""),16);return[t>>16&255,t>>8&255,t&255]},yt=e=>"#"+e.map(t=>Math.round(Math.max(0,Math.min(255,t))).toString(16).padStart(2,"0")).join(""),Oo=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],ye=e=>Oo(ce(e).map(xe)),Do=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],Po={zenith:"#9ec3ed",horizon:"#a1c6e5"};function Io(e){let t=e.sunElevationDeg*Math.PI/180,n=ye(e.sunColour)*e.sunIntensity/Math.PI,r=ye(e.skyColour)*e.skyIntensity/Math.PI,o=ye(e.groundColour)*e.skyIntensity/Math.PI,s=(r+o)/2;return{flat:n*Math.sin(t)+r,sunWall:n*Math.cos(t)+s,shadeWall:s}}var Bo=.55;function No(e="#ffe2bf",t="#aca497",n=Bo){let r=40*Math.PI/180,o=c=>{let l=yt(ce(Po.horizon).map(h=>h+(255-h)*c)),m=ye(e)*2.15/Math.PI*Math.cos(r),u=(ye(l)+ye(t))/2/Math.PI,d=n*m/(1-n)/u;return{sunColour:e,sunIntensity:2.15,skyColour:l,groundColour:t,skyIntensity:d,sunElevationDeg:40}},s=c=>{let l=o(c),m=ce(l.sunColour).map(xe),u=ce(l.skyColour).map(xe),d=[0,2].map(h=>m[h]*l.sunIntensity*Math.sin(r)+u[h]*l.skyIntensity);return d[0]/d[1]},a=0,i=1;for(let c=0;c<40;c++){let l=(a+i)/2;s(l)<1?a=l:i=l}return{...o(i),whiteMix:+i.toFixed(3)}}var ge=No(),cn=1/Io(ge).sunWall,hn={sunColour:ge.sunColour,sunIntensity:+(ge.sunIntensity*cn).toFixed(4),skyColour:ge.skyColour,groundColour:ge.groundColour,skyIntensity:+(ge.skyIntensity*cn).toFixed(4)},mn=[.85,1.6],Go=e=>typeof e=="string"?ce(e):e;function xt(e){let t=e?xe(219)/xe(Do(Go(e))):1.106;return Math.max(mn[0],Math.min(mn[1],t))}function Me(e,t){let n=ce(e).map(o=>xe(o)*t),r=Math.max(1,...n);return yt(n.map(o=>Eo(o/r)))}function fn(e,t=gt[e.toLowerCase()]){return Me(e,xt(t))}function dn(e,t,n,r=re(),o){return r!=="sunny"||n!=="measured"||e!=="brick"&&e!=="accent"?t:o?fn(t,o):fn(t)}var ul=(()=>{let e=Object.keys(gt).map(ce),t=n=>n.slice().sort((r,o)=>r-o)[n.length>>1];return yt([0,1,2].map(n=>t(e.map(r=>r[n]))))})();var Uo=2,Ho=.62;function Wo(e,t=Uo){let n=Me(e,t);if(D(k(e))[2]>=Ho)return n;let[r,o,s]=D(k(n));return s<=te[1]?n:C(U([r,o,te[1]]))}var $o=e=>Object.fromEntries(Object.entries(e).map(([t,n])=>[t,n?n.map(r=>Wo(r)):null])),xl=$o(un);var bn=["canal","c19","school","postwar","modern","tower"];var zo=8;var Yl=16+Math.log2(zo);var E=256,jo=["upper","ground","door","plain","shop"],qo=2;var Zl=bn.length*qo*jo.length;var H=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16));var Ql=H("#7d93a0"),eu=H("#1f2a33");var tu=H("#b8ad98"),nu=H("#cfc6b4"),ru=H("#ece8dd"),ou=H("#e2d9c2"),au=[H("#2c4a3d"),H("#3a2a22"),H("#1f3b57"),H("#5a2a24")],su=[H("#2f4a3a"),H("#7a2f27"),H("#27384f")];var pn=.6;function He(e,t,n){let r=Math.imul(e|0,374761393)^Math.imul(t|0,668265263)^Math.imul(n|0,2246822519);return r=Math.imul(r^r>>>13,1274126177),((r^r>>>16)>>>0)/4294967296}function gn(e,t){let n=0;for(let o=0;o<e.length;o+=4)n+=e[o];let r=n/(e.length/4);for(let o=0;o<e.length;o+=4){let s=Math.round(Math.max(0,Math.min(255,r+(e[o]-r)*t)));e[o]=e[o+1]=e[o+2]=s}}function yn(e,t){let n=new Uint8ClampedArray(E*E*4),r=(o,s,a,i,c)=>{let l=(s*E+o)*4,m=c??[a,a,a];n[l]=m[0],n[l+1]=m[1],n[l+2]=m[2],n[l+3]=i};if(e==="flat")for(let o=0;o<E;o++)for(let s=0;s<E;s++)r(s,o,Math.round((t?.96:.9+(He(s>>3,o>>3,3)-.5)*.08)*255),255);else if(e==="tile"){let a=E/8,i=E/5;for(let c=0;c<E;c++)for(let l=0;l<E;l++){let m=Math.floor(c/a),u=c%a/a,d=(l+m%2*i*.5)%E,h=Math.floor(d/i),g=d%i/i,w=Math.sin(g*Math.PI),p=t?.92:.7+.22*w-.28*Math.pow(Math.max(0,1-u*3.2),1.5)*0-.22*Math.max(0,(.18-u)/.18);t||(p+=(He(h,m,7)-.5)*.14);let M=t?u<.07||g<.035||g>.965:!1;r(l,c,Math.round(Math.max(0,Math.min(1,M?.28:p))*255),255)}t||gn(n,pn)}else if(e==="slate"){let a=E/11,i=E/6;for(let c=0;c<E;c++)for(let l=0;l<E;l++){let m=Math.floor(c/a),u=c%a/a,d=(l+m%2*i*.5)%E,h=Math.floor(d/i),g=d%i/i,w=t?.9:.82+(He(h,m,11)-.5)*.16-.16*Math.max(0,(.16-u)/.16);(g<(t?.05:.025)||u<(t?.09:.04))&&(w=t?.3:w*.7),r(l,c,Math.round(Math.max(0,Math.min(1,w))*255),255)}t||gn(n,pn)}else for(let c=0;c<E;c++)for(let l=0;l<E;l++){let m=l/E,u=c/E,d=m>.2-.06&&m<.8+.06&&u>.2-.06&&u<.82+.06,h=m>.2+.03&&m<.8-.03&&u>.2+.03&&u<.82-.03,g=Math.abs(m-.5)<.018||Math.abs(u-.5)<.018;if(h&&!g){let w=(u-.2)/.6199999999999999,p=t?[150+60*w,200+30*w,235]:[40+80*w*w,55+90*w*w,68+90*w*w];r(l,c,0,0,[p[0],p[1],p[2]])}else if(d)r(l,c,0,0,t?[255,250,240]:[236,232,221]);else{let w=t?.92:.85+(He(l>>3,c>>3,5)-.5)*.12,p=t&&(l<5||c<5||l>E-6||c>E-6);r(l,c,Math.round((p?.3:w)*255),255)}}return n}function xn(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let m=0;m<336;m+=112)o.drawImage(t,m,l,112,112);else{let l=7,m=()=>(l=l*16807%2147483647)/2147483647;for(let u=0,d=0;d<336;d+=14,u++)for(let h=-(u%2)*24;h<336;h+=48){let g=150+m()*50;o.fillStyle=`rgb(${g},${g*.92},${g*.86})`,o.fillRect(h,d,48,14)}}o.strokeStyle="rgba(235,223,205,0.18)",o.lineWidth=1.7;for(let l=0,m=6;m<336;m+=14,l++){o.beginPath(),o.moveTo(0,m),o.lineTo(336,m),o.stroke();for(let u=l%2*24;u<336;u+=48)o.beginPath(),o.moveTo(u,m),o.lineTo(u,m+14),o.stroke()}let s=o.getImageData(0,0,336,336),a=s.data,i=0;for(let l=0;l<a.length;l+=4)i+=(a[l]+a[l+1]+a[l+2])/3;i/=a.length/4;let c=i>0?Math.min(2.4,225/i):1;for(let l=0;l<a.length;l+=4){let m=(a[l]+a[l+1]+a[l+2])/3,u=Math.min(255,(m+(i-m)*.7)*c);a[l]=a[l+1]=a[l+2]=u,a[l+3]=255}return o.putImageData(s,0,0),r}function Mn(e){let t=e.createElement("canvas");t.width=64,t.height=128;let n=t.getContext("2d"),r=n.createLinearGradient(0,0,0,128);return r.addColorStop(0,"#8aa1b0"),r.addColorStop(.5,"#4d606c"),r.addColorStop(1,"#3c474e"),n.fillStyle=r,n.fillRect(0,0,64,128),n.fillStyle="rgba(235,242,248,0.16)",n.beginPath(),n.moveTo(10,0),n.lineTo(34,0),n.lineTo(4,70),n.lineTo(-20,70),n.closePath(),n.fill(),t}function wn(e){let t=e.createElement("canvas");t.width=le,t.height=ue;let n=t.getContext("2d"),r=n.createImageData(le,ue);for(let o=0;o<ue;o++)for(let s=0;s<le;s++){let a=(o*le+s)*4,i=st(s,o);r.data[a]=r.data[a+1]=r.data[a+2]=i,r.data[a+3]=255}return n.putImageData(r,0,0),t}function Rn(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d");n.fillStyle="#ffffff",n.fillRect(0,0,128,128),n.fillStyle="rgba(0,0,0,0.10)";for(let r=0;r<128;r+=16)n.fillRect(r,0,1.5,128);return t}function vn(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=23,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++){let i=(s()-.5)*3;for(let c=0;c<128;c++){let l=(a*128+c)*4,m=s()<.012?-14:0,u=243+(s()-.5)*8+i+m;r.data[l]=r.data[l+1]=r.data[l+2]=u,r.data[l+3]=255}}return n.putImageData(r,0,0),t}function Sn(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=11,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<r.data.length;a+=4){let i=228+(s()-.5)*16;r.data[a]=r.data[a+1]=r.data[a+2]=i,r.data[a+3]=255}return n.putImageData(r,0,0),n.fillStyle="rgba(80,70,60,0.18)",n.fillRect(0,0,128,1.5),t}function We(e,t){let n=yn(t,!1),r=Math.round(Math.sqrt(n.length/4)),o=e.createElement("canvas");o.width=o.height=r;let s=o.getContext("2d"),a=s.createImageData(r,r);for(let i=0;i<n.length;i+=4)a.data[i]=n[i],a.data[i+1]=n[i+1],a.data[i+2]=n[i+2],a.data[i+3]=255;return s.putImageData(a,0,0),o}var Yo=238;function _n(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let m=0;m<336;m+=112)o.drawImage(t,m,l,112,112);else{let l=13,m=()=>(l=l*16807%2147483647)/2147483647;for(let u=0,d=0;d<336;d+=14,u++)for(let h=-(u%2)*24;h<336;h+=48){let g=165+m()*30;o.fillStyle=`rgb(${g},${g*.93},${g*.88})`,o.fillRect(h,d,48,14)}}o.strokeStyle="rgba(245,240,230,0.26)",o.lineWidth=1.2;for(let l=0,m=6;m<336;m+=14,l++){o.beginPath(),o.moveTo(0,m),o.lineTo(336,m),o.stroke();for(let u=l%2*24;u<336;u+=48)o.beginPath(),o.moveTo(u,m),o.lineTo(u,m+14),o.stroke()}let s=o.getImageData(0,0,336,336),a=s.data,i=0;for(let l=0;l<a.length;l+=4)i+=(a[l]+a[l+1]+a[l+2])/3;i/=a.length/4;let c=i>0?Math.min(2.6,Yo/i):1;for(let l=0;l<a.length;l+=4){let m=(a[l]+a[l+1]+a[l+2])/3,u=Math.min(255,(m+(i-m)*.82)*c);a[l]=a[l+1]=a[l+2]=u,a[l+3]=255}return o.putImageData(s,0,0),r}function An(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=31,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++)for(let i=0;i<128;i++){let c=(a*128+i)*4,l=246+(s()-.5)*3;r.data[c]=r.data[c+1]=r.data[c+2]=l,r.data[c+3]=255}return n.putImageData(r,0,0),t}function kn(e){let t=e.createElement("canvas");t.width=t.height=4;let n=t.getContext("2d");return n.fillStyle="#fff",n.fillRect(0,0,4,4),t}var Ln={minFilter:"LinearMipmapLinear",magFilter:"Linear",generateMipmaps:!0};function Ko(e,t){let n=t.coarse?128:256,r=e==="facadeCells"?Math.min(t.gpuMaxAnisotropy,t.coarse?4:16):4;return{...Ln,cellPx:n,anisotropy:r,tierScale:1}}function Xo(e,t){if(!t.enabled||t.coarse||t.tier!=="high")return Ko(e,t);let n=Number.isFinite(t.gpuMaxAnisotropy)&&t.gpuMaxAnisotropy>=1?t.gpuMaxAnisotropy:1,r=Number(t.cellPx),o=Number.isInteger(r)&&r>256&&r<=512&&r%32===0?r:256;return{...Ln,cellPx:o,anisotropy:Math.min(n,16),tierScale:o/256}}function Jo(){try{let e=globalThis,t=e.__canalRecallTexturePolicy??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texturePolicy"):null);return!(t===!1||t==="0"||t==="false"||t==="off")}catch{return!0}}function Zo(){try{let e=globalThis,t=Number(e.__canalRecallCellPx??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("cellPx"):null)??NaN);return Number.isFinite(t)&&t>0?t:null}catch{return null}}function Qo(){let e=globalThis.__canalPerf?.tier;return e==="low"||e==="mid"||e==="high"?e:null}function ea(){return!!globalThis.matchMedia?.("(pointer: coarse)").matches}function Tn(e,t){return Xo(e,{tier:Qo(),coarse:ea(),gpuMaxAnisotropy:t,enabled:Jo(),cellPx:Zo()})}var Le=(e,t)=>`(${e}.g + 1.0 - ${t}.a)`;function ta(){let e=globalThis;return(e.__canalRecallMaskFormat??new URLSearchParams(e.location?.search??"").get("maskFormat"))==="rg"?"rg":"r8"}function Fn(e,t,n=ta()){let r=t.length>>1;if(e.length!==r*4)throw new Error(`packMask: ${e.length} colour bytes for ${r} mask texels`);if(n==="rg"){for(let s=0;s<r;s++)e[s*4+3]=255;return{colour:e,mask:t,channels:2}}let o=new Uint8Array(r);for(let s=0;s<r;s++)o[s]=t[s*2],e[s*4+3]=255-t[s*2+1];return{colour:e,mask:o,channels:1}}function Cn(){let e=globalThis,t=typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("fadeStrength"):null,n=e.__canalRecallFadeStrength??t,r=n==null||n===""?NaN:Number(n);return Number.isFinite(r)?Math.max(0,Math.min(2,r)):1}var me=e=>Number.isInteger(e)?`${e}.0`:`${e}`;var na=(e=Cn())=>`#ifdef USE_FOG
	float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	float fadeLuma = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( fadeLuma ), fogFactor * ${me(.5*e)} );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * ${me(.38*e)} );
#endif`,bu=na(1),En=`uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif`,pu=`#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
	${En}
#endif`,On=`
#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
#define DEPTH_FADE_FOG_PARS
	${En}
#endif
`,Dn=(e,t=Cn())=>`${me(Math.min(1,t))} * smoothstep(max(${me(250)}, fogNear), max(max(${me(600)}, fogNear + (fogFar - fogNear) * ${me(.4)}), max(${me(250)}, fogNear) + 1.0), ${e})`;var ra=70,oa=190,aa=.5,Pn=15,In=40;var Mt="12.0";var Bn=[-1,-1];var Nn=[-1,-1],Gn=()=>[ra,oa,aa],$e=e=>Number.isInteger(e)?e.toFixed(1):String(e),Un=`
uniform vec2 roofLayers;
uniform vec3 roofTier;
vec3 roofTierColour(vec3 fine, vec2 uv, float layer, float dist) {
  if (roofLayers.x < 0.0 || layer < roofLayers.x - 0.5 || layer > roofLayers.y - 0.5) return fine;
  float mid = smoothstep(roofTier.x - ${$e(Pn)}, roofTier.x + ${$e(Pn)}, dist);
  if (mid <= 0.0) return fine;
  float far = smoothstep(roofTier.y - ${$e(In)}, roofTier.y + ${$e(In)}, dist);
  vec3 coarse = texture(cells, vec3(uv * roofTier.z, layer)).rgb;
  vec3 flatMean = textureLod(cells, vec3(uv, layer), ${Mt}).rgb;
  return mix(mix(fine, coarse, mid), flatMean, far);
}`,Hn=`${On}
uniform vec2 cellTier;
#ifdef CELL_TIER_PROBE
// What the last cellTierSample saw (look/windowSdf.ts reads them: the ?cellDebug=rho view, the analytic windows' fade).
float cellRho = 0.0; float cellFarTier = 0.0; float cellFar = 0.0;
#endif
void cellTierSample(vec3 p, float dist, out vec3 c, out vec2 m) {
  vec4 cc = texture(cells, p); vec2 mm = texture(masks, p).rg;
  c = cc.rgb; m = vec2(mm.r, ${Le("mm","cc")});
  float far = 0.0;
#ifdef CELL_TIER_PROBE
  cellRho = max(length(dFdx(p.xy)), length(dFdy(p.xy))) * float(textureSize(cells, 0).x);
#endif
  if (cellTier.x >= 0.0) {
    float rho = max(length(dFdx(p.xy)), length(dFdy(p.xy))) * float(textureSize(cells, 0).x);
    far = smoothstep(cellTier.x, cellTier.y, rho);
  }
#ifdef CELL_TIER_PROBE
  cellFarTier = far;
#endif
#ifdef USE_FOG
  far = max(far, ${Dn("dist")});
#endif
#ifdef CELL_TIER_PROBE
  cellFar = far;
#endif
  if (far <= 0.0) return;
  vec4 fc = textureLod(cells, p, ${Mt}); vec2 fm = textureLod(masks, p, ${Mt}).rg;
  c = mix(c, fc.rgb, far); m = mix(m, vec2(fm.r, ${Le("fm","fc")}), far);
}`;var sa=.5,ze={sunAzimuthDeg:215,sunElevationDeg:40,sunColour:"#ffe9cc",sunIntensity:2.15,skyColour:"#e3ebf6",groundColour:"#998a72",skyIntensity:1.75,shadows:!0,shadowMapSize:2048,shadowIntensity:1-sa};var Au={...ze,...hn};function ia(e,t){let n=e*Math.PI/180,r=t*Math.PI/180;return[Math.sin(n)*Math.cos(r),Math.cos(n)*Math.cos(r),Math.sin(r)]}var ku=ia(ze.sunAzimuthDeg,ze.sunElevationDeg),je=(()=>{let e=ze.sunAzimuthDeg*Math.PI/180;return[Math.sin(e),Math.cos(e)]})(),Ve=[je[0]*.6,je[1]*.6,.8],Wn=.84;function la(e){let t=e[0]*Ve[0]+e[1]*Ve[1]+e[2]*Ve[2];return Math.max(.5,Math.min(1,.58+.42*Math.max(0,t)))}var Lu=la([0,0,1]),Te=e=>Number.isInteger(e)?e.toFixed(1):String(+e.toFixed(6)),qe=`
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = ${Te(Wn)} + ${Te(1-Wn)} * (0.5 + 0.5 * dot(h, vec2(${Te(je[0])}, ${Te(je[1])}))); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, dot(n, vec3(${Ve.map(Te).join(", ")}))), 0.5, 1.0);`;var $n=[.4,2.5],ua=["brick","accent","stucco"];function ca(e){let t=(e?.white?xt(e.white):1.106)*(e?.stripOverDrawn??1);return Math.max($n[0],Math.min($n[1],t))}var ma=["brick","accent"];function Vn(e,t,n,r,o=re()){return o!=="sunny"||r==="measured"?t:n?ua.includes(e)?Me(t,ca(n)):t:ma.includes(e)?Me(t,1.106):t}var K=[{name:"magnified (rho < 1)",rgb:[255,0,0]},{name:"rho 1-2",rgb:[255,255,0]},{name:"rho 2-4",rgb:[0,255,0]},{name:"rho 4-8",rgb:[0,255,255]},{name:"rho 8-16",rgb:[0,0,255]},{name:"rho 16-tier",rgb:[255,128,0]},{name:"tier far > 0",rgb:[255,0,255]},{name:"depth-fade far > 0 (tier 0)",rgb:[255,255,255]},{name:"roof layer",rgb:[128,128,128]}],Iu=K.length-1,fa=3;var ha=520,da=ha.toFixed(1),ba=String(fa),X=e=>`vec3(${e.map(t=>(t/255).toFixed(4)).join(", ")})`,jn=`
#ifdef CELL_DEBUG_RHO
vec3 cellDebugColour(float layer) {
  if (roofLayers.x >= 0.0 && layer > roofLayers.x - 0.5 && layer < roofLayers.y - 0.5) return ${X(K[8].rgb)};
  if (cellFarTier > 0.001) return ${X(K[6].rgb)};
  if (cellFar > 0.001) return ${X(K[7].rgb)};
  if (cellRho < 1.0) return ${X(K[0].rgb)};
  if (cellRho < 2.0) return ${X(K[1].rgb)};
  if (cellRho < 4.0) return ${X(K[2].rgb)};
  if (cellRho < 8.0) return ${X(K[3].rgb)};
  if (cellRho < 16.0) return ${X(K[4].rgb)};
  return ${X(K[5].rgb)};
}
#endif`;var pa=1.25,zn=[2.5,5],Ye=["#6f8796","#2f4350","#1d2a33"],Ke=e=>X([parseInt(e.slice(1,3),16),parseInt(e.slice(3,5),16),parseInt(e.slice(5,7),16)]),qn=`
#ifdef CITY_WINDOW_SDF
uniform highp sampler2D windowTable;
// 1 in the game; the A/B probes set 0 to draw the painted cell in the same page and pose (tests/e2e/crisp-textures).
uniform float windowSdfMix;
// Coverage of [a, b] by a pixel of width fw centred at x (exact for a box pixel; thin bars give their area).
float wsCover(float x, float a, float b, float fw) { return clamp((min(b, x + 0.5 * fw) - max(a, x - 0.5 * fw)) / fw, 0.0, 1.0); }
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
void windowSdf(vec2 uv, float layer, float weight, inout vec3 c, inout vec2 m) {
  weight *= windowSdfMix;
  if (weight <= 0.0) return;
  int row = int(layer + 0.5);
  vec4 head = texelFetch(windowTable, ivec2(0, row), 0);
  int count = int(head.x + 0.5);
  if (count <= 0) return;
  vec2 cell = vec2(${da}, head.y);
  vec2 p = fract(uv) * cell;
  // The footprint from the continuous uv (fract jumps at the cell seam).
  vec2 fw = max(fwidth(uv * cell), vec2(1e-3)) * ${pa.toFixed(2)};
  for (int i = 0; i < ${ba}; i++) {
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
    float sizePx = min((r.y - r.x) / fw.x, (r.w - r.z) / fw.y);
    float wk = weight * smoothstep(${zn[0].toFixed(1)}, ${zn[1].toFixed(1)}, sizePx);
    if (wk <= 0.0) continue;
    float outer = wsOpening(p, fw, r.x, r.y, r.z, r.w, shape, rise);
    if (outer <= 0.0) continue;
    float px0 = r.x + ix, px1 = r.y - ix, py0 = r.z + iy, py1 = r.w - iy;
    float paneRise = shape > 0.5 && shape < 1.5 ? rise : 0.0;
    float pane = wsOpening(p, fw, px0, px1, py0, py1, shape, paneRise);
    // Muntins, the painter's bars (bayTextures.ts windowAt), positioned on the opening's height h from its top.
    float h = r.w - r.z, top = r.w, xm = 0.5 * (r.x + r.y), bars = 0.0;
    if (muntin > 0.5 && muntin < 1.5) bars = wsBarH(p, fw, px0, px1, top - 0.29 * h, 2.0);
    else if (muntin < 2.5 && muntin > 1.5) bars = max(wsBarH(p, fw, px0, px1, top - 0.27 * h, 2.0), wsBarV(p, fw, py0, py1, xm, 2.0));
    else if (muntin < 3.5 && muntin > 2.5) bars = max(wsBarH(p, fw, px0, px1, top - 0.42 * h - 4.0, 4.0), wsBarV(p, fw, py0, py1, xm, 4.0));
    else if (muntin < 4.5 && muntin > 3.5) {
      bars = max(wsBarH(p, fw, px0, px1, top - 0.5 * h, 3.0), max(wsBarH(p, fw, px0, px1, top - 0.25 * h, 1.5), wsBarH(p, fw, px0, px1, top - 0.75 * h, 1.5)));
      float third = (px1 - px0) / 3.0;
      bars = max(bars, max(wsBarV(p, fw, py0, py1, px0 + third, 1.5), wsBarV(p, fw, py0, py1, px0 + 2.0 * third, 1.5)));
    } else if (muntin > 4.5) {
      float quarter = (px1 - px0) / 4.0;
      bars = max(wsBarV(p, fw, py0, py1, px0 + quarter, 3.0), max(wsBarV(p, fw, py0, py1, px0 + 2.0 * quarter, 3.0), wsBarV(p, fw, py0, py1, px0 + 3.0 * quarter, 3.0)));
    }
    float glass = pane * (1.0 - bars);
    // The glazing gradient down the opening, then the atlas's calm lift of dark texels (paintLookAtlas.ts).
    float g = clamp((top - p.y) / max(h, 1e-3), 0.0, 1.0);
    vec3 gc = g < 0.55 ? mix(${Ke(Ye[0])}, ${Ke(Ye[1])}, g / 0.55) : mix(${Ke(Ye[1])}, ${Ke(Ye[2])}, (g - 0.55) / 0.45);
    float lum = (gc.r + gc.g + gc.b) / 3.0;
    if (lum < ${(90/255).toFixed(5)}) gc += (vec3(${(150/255).toFixed(5)}) - gc) * lift * (1.0 - lum / ${(90/255).toFixed(5)});
    c = mix(c, frame.rgb, outer * wk); m = mix(m, vec2(0.0, frame.a), outer * wk);
    c = mix(c, gc, glass * wk); m = mix(m, vec2(0.0), glass * wk);
  }
}
#endif`;var ya={legacy:.9,sunny:1},xa=(e=re())=>ya[e],Z=xa(),Fe=255/225,Ma=255/228,wa=255/243,Ra=255/246,Je=[{cell:"brick",tileM:$.brick,clampUv:!1,litGain:Fe*Z,skyTint:!1},{cell:"stucco",tileM:$.stucco,clampUv:!1,litGain:wa*Z,skyTint:!1},{cell:"stone",tileM:$.stone,clampUv:!1,litGain:Ma*Z,skyTint:!1},{cell:"white",tileM:1,clampUv:!1,litGain:1,skyTint:!1},{cell:"door",tileM:$.door,clampUv:!1,litGain:1,skyTint:!1},{cell:"glass",tileM:$.glass,clampUv:!0,litGain:1,skyTint:!0},{cell:"tile",tileM:$.roofTile,clampUv:!1,litGain:Fe*Z,skyTint:!1},{cell:"slate",tileM:$.slate,clampUv:!1,litGain:Fe*Z,skyTint:!1},{cell:"flat",tileM:$.bitumen,clampUv:!1,litGain:Fe*Z,skyTint:!1},{cell:"brick20",tileM:$.brick,clampUv:!1,litGain:Fe*Z,skyTint:!1},{cell:"whiteStucco",tileM:$.stucco,clampUv:!1,litGain:Ra*Z,skyTint:!1},{cell:"glassTint",tileM:$.glass,clampUv:!0,litGain:1,skyTint:!0}],Xe=Je.length,Ce=Object.fromEntries(Je.map((e,t)=>[e.cell,t])),va=at.school;function Rt(e,t={}){let n=Pt[e],r=t.source==="measured";return n==="glass"&&r?Ce.glassTint:n==="brick"&&!r&&typeof t.year=="number"&&t.year>=va?Ce.brick20:n==="stucco"&&t.white?Ce.whiteStucco:n==="frame"?Ce.white:Ce[n]}function Sa(){return Je.map(e=>[1/e.tileM,e.clampUv?1:0,e.litGain,e.skyTint?1:0])}var _a=.38,Aa=.8,ka=.27,La=.97,Ta=.75,Fa=.5,Ca=.12,Ea=(e,t)=>(e<45||e>340)&&t>=.2;function Oa(e,t,n,r=re(),o){if(Nt(e,n))return Ne(e,dn(e,t,n,r,o),n);let s=k(t),[a,i,c]=D(s);return e==="slate"&&Ea(a,i)?Ne("roofTile",t):(e==="brick"||e==="accent")&&i<Ca?C(U([a,i,Math.min(te[1],Math.max(te[0],.12+c*.9))])):e==="slate"&&c>_a?C(U([a,Math.min(i,.12),Math.min(.72,c/Aa)])):e==="slate"?c<ka?J.slate[1]:J.slate[0]:e==="frame"&&c>=.5&&c<Ta?C(s):e==="stone"&&c<Fa?C(s):Ne(e,t)}function Zn(e,t,n,r=re(),o,s){let a=Oa(e,t,n,r,o),[i,c,l]=k(Vn(e,a,s??null,n,r));return[i,c,l,255]}function Da(e,t,n){switch(t){case"brick":return xn(e,n);case"brick20":return _n(e,n);case"stucco":return vn(e);case"whiteStucco":return An(e);case"stone":return Sn(e);case"white":case"frame":return kn(e);case"door":return Rn(e);case"glass":return Mn(e);case"glassTint":return wn(e);case"tile":return We(e,"tile");case"slate":return We(e,"slate");case"flat":return We(e,"flat")}}function Pa(e,t,n){let r=n*n,o=new Uint8Array(r*4*Xe),s=new Uint8Array(r*2*Xe),a=e.createElement("canvas");a.width=a.height=n;let i=a.getContext("2d",{willReadFrequently:!0});return i.imageSmoothingQuality="high",Je.forEach((c,l)=>{i.clearRect(0,0,n,n),i.drawImage(Da(e,c.cell,t),0,0,n,n);let m=i.getImageData(0,0,n,n).data;for(let u=0;u<n;u++)for(let d=0;d<n;d++){let h=((n-1-u)*n+d)*4,g=l*r+u*n+d;o[g*4]=m[h],o[g*4+1]=m[h+1],o[g*4+2]=m[h+2],o[g*4+3]=255,s[g*2]=255,s[g*2+1]=0}}),{colour:o,mask:s}}async function Ia(e=document){let t=new Image;t.src=new URL("materials/ambientcg/Bricks057/colour.jpg",e.baseURI).href;try{return await t.decode(),t}catch{return null}}var vt=e=>`${e.lit?"lit":"unlit"}|${e.kind}|${e.kind==="slot"?e.uv??"uv":"-"}|${e.highlight?"hl":e.dim?"dim":"-"}|${e.side??0}${e.noFade?"|nofade":""}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf1":""}`;function Ba(e){let t={CITY_SLOT_COUNT:String(Xe)};return e.kind==="slot"&&(t.CITY_SLOT=""),e.swap&&(t.CITY_SWAP=""),e.cellDebug==="rho"&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CELL_DEBUG_RHO=""),e.windows&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CITY_WINDOW_SDF=""),e.lit?(t.CITY_VARIANT_UNIFORMS="",{...t,...ht()}):(e.kind==="slot"&&e.uv==="box"&&(t.CITY_BOX_UV=""),e.highlight?t.CITY_HIGHLIGHT="":e.dim&&(t.CITY_DIM=""),{...t,...ht()})}function Na(e){return{cityForce:{value:e.highlight?1:e.dim?2:0},cityBoxUv:{value:e.kind==="slot"&&e.uv==="box"?1:0}}}var Ga=e=>e.lit?`city-look-v4|lit|${e.kind}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf1":""}`:`city-look-v3|${vt({...e,side:0})}`,Ua="vec3(1.0, 0.824, 0.122)",Yn="vec3(1.0, 0.637, 0.0137)",Kn="vec3(0.035, 0.05, 0.07)",Ha=1,Wa=.2,$a=.75,Va=1.8,we=e=>Number.isInteger(e)?e.toFixed(1):String(e),za=`
float cityGrain(vec3 cell) {
  float g = clamp(dot(cell, vec3(0.299, 0.587, 0.114)) / ${we(225/255)}, 0.45, 1.1);
  return mix(1.0, g, ${we($a)});
}`,Qn=16,ja=`
#ifdef CITY_SWAP
attribute float swapSlot;
uniform vec4 citySwapUnder[${Qn/4}];
uniform float cityUnder;
flat varying float vCityUnder;
#endif`,qa=`
#ifdef CITY_SWAP
int citySw = int(swapSlot + 0.5) - 1;
vCityUnder = citySw >= 0 ? citySwapUnder[citySw / 4][citySw % 4] : cityUnder;
#endif`,er=`
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
${ja}
${dt}`,tr=`
${qa}
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
#endif`,nr=`
vFacDist = length((modelViewMatrix * vec4(position, 1.0)).xyz);
if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`,rr=`
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${Un}
${Hn}
${jn}
${qn}
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
${za}
${dt}`,or=`
if (HL_GHOST(vHighlight)) discard;
#ifdef CITY_SWAP
float cityHash = fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296)));
if (cityFade < 1.0 && cityHash >= cityFade) discard;
// The complement of a replacement dissolving in over (or out from) this mesh: where it draws, this one does not.
if (cityHash < vCityUnder) discard;
#else
if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;
#endif`,ar=`
vec2 cityUv = vSlot.y > 0.5 ? clamp(vFacUv, 0.0, 1.0) : vFacUv;
vec3 cityP = vec3(cityUv, vLayer);
vec3 cityC; vec2 cityM;
#ifdef CITY_SLOT
vec4 cityCC = texture(cells, cityP); vec2 cityMM = texture(masks, cityP).rg;
cityC = cityCC.rgb; cityM = vec2(cityMM.r, ${Le("cityMM","cityCC")});
#else
cellTierSample(cityP, vFacDist, cityC, cityM);
#ifdef CITY_WINDOW_SDF
windowSdf(cityUv, vLayer, 1.0 - cellFar, cityC, cityM);
#endif
cityC = roofTierColour(cityC, cityUv, vLayer, vFacDist);
#endif
float cityG = cityGrain(cityC);
cityC *= mix(vec3(1.0), vTint, cityM.r) * mix(vec3(1.0), vAccent, cityM.g);`,Ya=`
uniform mat3 enuFromWorld;
${er}
varying float vShade;
void main() {
${tr}
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
${qe}
  vShade = shade;
#else
  vShade = tint.a;
#endif
${nr}
}`,Ka=`
precision highp float;
${rr}
varying float vShade;
void main() {
${or}
${ar}
  if (HL_PAINT(vHighlight)) {
    float hlShade = clamp(1.0 - (1.0 - vShade) * ${we(Va)}, 0.6, 1.0);
    gl_FragColor = vec4(${Ua} * (flatColour > 0.5 ? 1.0 : cityG) * hlShade, 1.0);
    return;
  }
  if (flatColour > 0.5) cityC = vTint;
  cityC = hlDesat(cityC, vHighlight);
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  gl_FragColor = vec4(cityC * shade, 1.0);
#ifdef CELL_DEBUG_RHO
  gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif
}`;function Xa(e,t={}){return{cells:t.cells??{value:null},masks:t.masks??{value:null},slotBase:t.slotBase??{value:0},slotParams:t.slotParams??{value:Sa().map(n=>new e.Vector4(...n))},bands:t.bands??{value:0},flatColour:t.flatColour??{value:0},cityFade:t.cityFade??{value:1},wallGain:t.wallGain??{value:1},roofLayers:t.roofLayers??{value:Nn},roofTier:t.roofTier??{value:Gn()},cellTier:t.cellTier??{value:Bn},enuFromWorld:t.enuFromWorld??{value:new e.Matrix3},citySwapUnder:t.citySwapUnder??{value:new Float32Array(Qn)},cityUnder:t.cityUnder??{value:0},windowTable:t.windowTable??{value:null},windowSdfMix:t.windowSdfMix??{value:1}}}var Ja={accent:[1,1,1,1],hidden:[0],color:[1,1,1],uv:[0,0],uv1:[0,0],swapSlot:[0]},wt="recipeLookShared";function Za(e,t,n){let r=Ba(t),o=t.side??e.FrontSide,s;if(!t.lit)s=new e.ShaderMaterial({uniforms:n,defines:r,vertexShader:Ya,fragmentShader:Ka,side:o});else{s=new e.MeshLambertMaterial({side:o,flatShading:t.kind==="chunk"}),s.defines={...s.defines??{},...r};let a=Na(t);s.onBeforeCompile=c=>{for(let l of Object.keys(n))c.uniforms[l]=n[l];Object.assign(c.uniforms,a),c.vertexShader=c.vertexShader.replace("#include <common>",`#include <common>${er}`).replace("#include <begin_vertex>",`#include <begin_vertex>${tr}`).replace("#include <project_vertex>",`#include <project_vertex>${nr}`),c.fragmentShader=c.fragmentShader.replace("#include <common>",`#include <common>${rr}
float cityLuma;`).replace("#include <dithering_fragment>",`#include <dithering_fragment>
#ifdef CELL_DEBUG_RHO
gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>${or}`).replace("#include <map_fragment>",`${ar}
#ifdef CITY_SLOT
cityC *= vSlot.z;
#else
cityC *= mix(1.0, wallGain * ${we(Z)}, cityM.r);
#endif
if (flatColour > 0.5) cityC = vTint;
cityLuma = dot(cityC, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= HL_PAINT(vHighlight) ? ${Yn} * ${we(Ha)} * pow(flatColour > 0.5 ? 1.0 : cityG, 2.2) : pow(hlDesat(cityC, vHighlight), vec3(2.2));`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
if (HL_PAINT(vHighlight)) totalEmissiveRadiance += ${Yn} * ${we(Wa)};
#ifdef CITY_SLOT
else totalEmissiveRadiance += ${Kn} * vSlot.w;
#else
// Bay glazing (dark, untinted texels): the same constant sky tint as landmark glass, never a hotspot.
else totalEmissiveRadiance += ${Kn} * (1.0 - smoothstep(0.06, 0.2, cityLuma)) * (1.0 - cityM.r);
#endif`)};let i=Ga(t);s.customProgramCacheKey=()=>i,s.uniforms=n}return s.defaultAttributeValues={...Ja},t.noFade&&(s.fog=!1),s.name=`city-look/${vt(t)}`,s.userData={cityLook:!0,cityVariant:{...t},[wt]:!0},s}function Qa(e){return e?e.isMeshBasicMaterial||e.userData?.unlit?"unlit (decal / emissive sign)":e.transparent||(e.opacity??1)<1?"transparent":e.vertexColors?"vertex colours":e.map?"own texture":null:"no material"}function es(e,t){let n=e?.userData??{};if(on(n.materialSlot)&&typeof n.tint=="string"){let s=n.tintSource==="measured";return{slot:n.materialSlot,tint:n.tint,inferred:n.materialSlotSource===en,...s?{source:"measured"}:{},...s&&typeof n.tintWhitePoint=="string"?{white:n.tintWhitePoint}:{}}}if(!t||Qa(e)||!e.color)return null;let r="#"+e.color.getHexString(),o=nn(e.name,r);return{slot:o.slot,tint:o.tint,inferred:!0}}function Xn(e,t,n,r,o={}){let s=t.getAttribute("position")?.count??0,a=Rt(n,o),i=Zn(n,r,o.source,void 0,o.whitePoint,o.exposure),c=t.getAttribute("layer"),l=t.getAttribute("tint");if(c&&l)return c.getX(0)===a&&Math.round(l.getX(0)*255)===i[0]&&Math.round(l.getY(0)*255)===i[1]&&Math.round(l.getZ(0)*255)===i[2];t.setAttribute("layer",new e.BufferAttribute(new Uint8Array(s).fill(a),1,!1));let m=new Uint8Array(s*4);for(let u=0;u<s;u++)m.set(i,u*4);return t.setAttribute("tint",new e.BufferAttribute(m,4,!0)),!0}function ts(e,t,n,r,o,s={}){let a=r.getAttribute("normal"),i=r.getAttribute("layer"),c=r.getAttribute("tint");if(!a||!i||!c)return 0;let[l,m,u]=Zn("bitumen",o,s.source);t.updateWorldMatrix(!0,!0);let d=new e.Matrix4().copy(t.matrixWorld).invert().multiply(n.matrixWorld),h=new e.Matrix3().getNormalMatrix(d),g=new e.Vector3,w=Rt("bitumen",s),p=0;for(let M=0;M<a.count;M++)g.set(a.getX(M),a.getY(M),a.getZ(M)).applyMatrix3(h).normalize(),!(g.y<La)&&(i.setX(M,w),c.setXYZW(M,l/255,m/255,u/255,1),p++);return p&&(i.needsUpdate=!0,c.needsUpdate=!0),p}var ns="__canalRecallCityLookShared";function sr(e,t={}){let n=globalThis,r=n[ns]??=new Map,o=r.get(e);return o||r.set(e,o=rs(e,t)),o}function rs(e,t={}){let n=t.document??globalThis.document,r=t.size??(globalThis.matchMedia?.("(pointer: coarse)").matches?128:256),o=Xa(e),s=new Map,a=null,i=!1,c=(u,d)=>{let h=new e.DataArrayTexture(u,r,r,Xe);return h.format=d,h.type=e.UnsignedByteType,h.wrapS=h.wrapT=e.RepeatWrapping,h.minFilter=e.LinearMipmapLinearFilter,h.magFilter=e.LinearFilter,h.generateMipmaps=!0,h.anisotropy=t.anisotropy??Tn("slotCells",16).anisotropy,h.unpackAlignment=1,h.needsUpdate=!0,h.userData={bytes:u.byteLength,[wt]:!0},h},l=(async()=>{if(!n)return;let u=t.brick!==void 0?t.brick:await Ia(n),{colour:d,mask:h}=Pa(n,u,r),g=Fn(d,h);a={colour:c(g.colour,e.RGBAFormat),mask:c(g.mask,g.channels===1?e.RedFormat:e.RGFormat)},i||(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)})(),m=u=>{let d=vt(u),h=s.get(d);return h||s.set(d,h=Za(e,u,o)),h};return{uniforms:o,ready:l,material:m,dress(u,{lit:d,infer:h=!1,year:g=null,wallExposure:w=null}){let p=0;return u.traverse(M=>{if(!M.isMesh||Array.isArray(M.material)||M.material?.userData?.cityLook)return;let b=es(M.material,h);if(!b)return;let _=M.geometry;if(!_?.getAttribute("position"))return;let V=!!_.getAttribute("uv");!V&&!_.getAttribute("normal")&&_.computeVertexNormals();let R={year:g,white:b.inferred&&rn(M.material.name),source:b.source,...b.white?{whitePoint:b.white}:{},...w?{exposure:w}:{}};Xn(e,_,b.slot,b.tint,R)||(_=M.geometry=_.clone(),_.deleteAttribute("layer"),_.deleteAttribute("tint"),Xn(e,_,b.slot,b.tint,R)),b.inferred&&b.slot==="slate"&&!b.source&&ts(e,u,M,_,b.tint,R);let T=M.material;M.material=m({lit:d,kind:"slot",uv:V?"uv":"box",side:T.side}),M.userData.citySlot={slot:b.slot,tint:b.tint,...b.source?{source:b.source}:{},inferred:b.inferred,from:T.name,layer:Rt(b.slot,R)},T.userData?.[wt]||T.dispose(),p++}),p},highlighted(u,d){let h=u?.userData?.cityVariant;return h?m({...h,highlight:d,dim:!1}):u},dimmed(u,d){let h=u?.userData?.cityVariant;return h?m({...h,highlight:!1,dim:d}):u},bindAtlas(u){i=!!u,u?(o.cells.value=u.colour,o.masks.value=u.mask,o.slotBase.value=u.slotBase):a&&(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)},textureBytes(){return a&&!i?Math.round((a.colour.userData.bytes+a.mask.userData.bytes)*4/3):0}}}var os=2*Math.PI*6378137;function ir(e,t){return[(180+e)/360,(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+t*Math.PI/360)))/360]}var as=e=>1/os/Math.cos(e*Math.PI/180);function St(e,t){let[n,r]=ir(e[0],e[1]),[o,s]=ir(t[0],t[1]),a=as(e[1]);return[(o-n)/a,(s-r)/a]}function Ze(e){let t=e.map(r=>r.anchor[0]),n=e.map(r=>r.anchor[1]);return[(Math.min(...t)+Math.max(...t))/2,(Math.min(...n)+Math.max(...n))/2]}var ss=e=>Math.PI-(180+e)*Math.PI/180;function _t(e,t){let[n,r]=St(t,e.anchor),o=ss(e.northOffsetDegrees),s=Math.cos(o),a=Math.sin(o),[i,c,l]=e.scale;return[s*i,0,-a*i,0,0,c,0,0,a*l,0,s*l,0,n,e.groundAltitudeMetres,r,1]}function fr(e){let t=new Map;for(let n of e)t.set(n.area??"default",[...t.get(n.area??"default")??[],n]);return t}function hr(e){let t=Ze(e);return Math.max(50,...e.map(n=>Math.hypot(...St(t,n.anchor))))+30}var is=e=>`NL.IMBAG.Pand.${e}`;function At(e){return[...new Set(e.flatMap(t=>[t.pand,...t.alsoSuppress??[]].map(is)))].sort()}function kt(e){let t=e.L0/2,n=e.W0/2,r=e.E0,o={positions:[],normals:[],uvs:[],index:[]},s={positions:[],normals:[],uvs:[],index:[]},a=(u,d,h,g,w,p,M)=>{let b=u.positions.length/3;for(let _ of[d,h,g,w])u.positions.push(..._),u.normals.push(...p),u.uvs.push(...M(_));u.index.push(b,b+1,b+2,b,b+2,b+3)},i=u=>[u[0],u[1]],c=u=>[u[2],u[1]],l=u=>[u[0],u[2]];a(o,[-t,0,n],[t,0,n],[t,r,n],[-t,r,n],[0,0,1],i),a(o,[t,0,-n],[-t,0,-n],[-t,r,-n],[t,r,-n],[0,0,-1],i),a(o,[t,0,n],[t,0,-n],[t,r,-n],[t,r,n],[1,0,0],c),a(o,[-t,0,-n],[-t,0,n],[-t,r,n],[-t,r,-n],[-1,0,0],c);let m=e.R0!==void 0&&e.R0>r+.3?e.R0:void 0;if(m===void 0)a(s,[-t,r,n],[t,r,n],[t,r,-n],[-t,r,-n],[0,1,0],l);else{let u=m-r,d=Math.hypot(n,u),h=u/d,g=n/d;a(s,[-t,r,n],[t,r,n],[t,m,0],[-t,m,0],[0,g,h],l),a(s,[t,r,-n],[-t,r,-n],[-t,m,0],[t,m,0],[0,g,-h],l);let w=(p,M,b)=>{let _=o.positions.length/3,V=b?[[p,r,-n],[p,r,n],[p,m,0]]:[[p,r,n],[p,r,-n],[p,m,0]];for(let R of V)o.positions.push(...R),o.normals.push(M,0,0),o.uvs.push(...c(R));o.index.push(_,_+1,_+2)};w(t,1,!1),w(-t,-1,!0)}return{walls:o,roof:s}}function ls(e,t=dr){return e?Math.max(t,Math.round(3*Math.max(e.L0,e.E0))):t}function Lt(e,t,n,r,o,s=20){let a=new Set(o?.near),i=new Set(o?.far),c=[],l=[];return e.forEach((m,u)=>{let d=Math.hypot(m.x-t.x,m.z-t.z),h=typeof n=="number"?n:n[u],g=a.has(u)?h+s:h-(i.has(u)?s:0),w=a.has(u)||i.has(u)?r+s:r;d<=g?c.push(u):d<=w&&l.push(u)}),{near:c,far:l,culled:e.length-c.length-l.length}}var dr=140,us=700;function cs(e){let t=e.reduce((a,i)=>a+i.positions.length/3,0),n=e.reduce((a,i)=>a+(i.index?i.index.length:i.positions.length/3),0),r={positions:new Float32Array(t*3),normals:new Float32Array(t*3),uvs:new Float32Array(t*2),textures:new Float32Array(t),tints:new Float32Array(t*3),index:new Uint32Array(n)},o=0,s=0;for(let a of e){let i=a.matrix,c=a.positions.length/3,l=i[0],m=i[4],u=i[8],d=i[1],h=i[5],g=i[9],w=i[2],p=i[6],M=i[10],b=[h*M-g*p,g*w-d*M,d*p-h*w,u*p-m*M,l*M-u*w,m*w-l*p,m*g-u*h,u*d-l*g,l*h-m*d],_=l*b[0]+m*b[1]+u*b[2]<0;for(let R=0;R<c;R++){let T=a.positions[R*3],z=a.positions[R*3+1],W=a.positions[R*3+2],G=(o+R)*3;r.positions[G]=i[0]*T+i[4]*z+i[8]*W+i[12],r.positions[G+1]=i[1]*T+i[5]*z+i[9]*W+i[13],r.positions[G+2]=i[2]*T+i[6]*z+i[10]*W+i[14];let oe=a.normals[R*3],Re=a.normals[R*3+1],Q=a.normals[R*3+2],ae=b[0]*oe+b[1]*Re+b[2]*Q,fe=b[3]*oe+b[4]*Re+b[5]*Q,Oe=b[6]*oe+b[7]*Re+b[8]*Q,j=(Math.hypot(ae,fe,Oe)||1)*(_?-1:1);r.normals[G]=ae/j,r.normals[G+1]=fe/j,r.normals[G+2]=Oe/j,r.uvs[(o+R)*2]=a.uvs[R*2]*a.uvScale,r.uvs[(o+R)*2+1]=a.uvs[R*2+1]*a.uvScale,r.textures[o+R]=a.texture,r.tints[G]=a.tint[0],r.tints[G+1]=a.tint[1],r.tints[G+2]=a.tint[2]}let V=a.index?a.index.length:c;for(let R=0;R<V;R+=3){let T=a.index?a.index[R]:R,z=a.index?a.index[R+1]:R+1,W=a.index?a.index[R+2]:R+2;r.index[s++]=o+T,r.index[s++]=o+(_?W:z),r.index[s++]=o+(_?z:W)}o+=c}return r}function ms(e){let t=Math.max(1,e),n=Array.from({length:t},(r,o)=>o===t-1?`c = texture2D(t${o}, vUv).rgb;`:`if (vTex < ${o}.5) c = texture2D(t${o}, vUv).rgb; else`).join(`
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
${qe}
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
}`}}var Ee=10;function fs(e){let t=Math.max(1,e),n=Array.from({length:t},(r,o)=>o===t-1?`btC = texture2D(btT${o}, vBtUv);`:`if (vBtTex < ${o}.5) btC = texture2D(btT${o}, vBtUv); else`).join(`
  `);return{declarations:`${Array.from({length:t},(r,o)=>`uniform sampler2D btT${o};`).join(`
`)}
varying float vBtTex;
varying vec3 vBtTint;
varying vec2 vBtUv;`,sample:`vec4 btC;
  ${n}
  diffuseColor *= vec4(btC.rgb * vBtTint, btC.a);
#undef USE_MAP
#include <map_fragment>`}}var lr=new WeakMap;function hs(e,t,n){let r=lr.get(e.MeshLambertMaterial);r||(r=class extends e.MeshLambertMaterial{btTextures=[];constructor(s){super(s),this.onBeforeCompile=function(a){let{declarations:i,sample:c}=fs(Ee);for(let l=0;l<Ee;l++)a.uniforms[`btT${l}`]={value:this.btTextures[l]??this.btTextures[0]??null};a.vertexShader=a.vertexShader.replace("#include <common>",`#include <common>
attribute float btTex;
attribute vec3 btTint;
varying float vBtTex;
varying vec3 vBtTint;
varying vec2 vBtUv;`).replace("#include <uv_vertex>",`#include <uv_vertex>
  vBtUv = uv; vBtTex = btTex; vBtTint = btTint;`),a.fragmentShader=a.fragmentShader.replace("#include <common>",`#include <common>
${i}`).replace("#include <map_fragment>",c)},this.customProgramCacheKey=function(){return`building-types/lit-merged/${Ee}`}}copy(s){return super.copy(s),this.btTextures=[...s.btTextures??[]],this.onBeforeCompile=s.onBeforeCompile,this.customProgramCacheKey=s.customProgramCacheKey,this}},lr.set(e.MeshLambertMaterial,r));let o=new r({map:t[0],side:n});return o.btTextures=[...t],o.name="building-types/lit-merged",o.userData={recipeLookShared:!0,litMerged:!0},o}function ur(e,t,n){if(!t?.isShaderMaterial)return t;let r=n.get(t);if(!r){let o=String(t.vertexShader).replace("mat3(modelMatrix) * normal","mat3(modelMatrix * instanceMatrix) * normal").replace("modelViewMatrix * vec4(position, 1.0)","modelViewMatrix * instanceMatrix * vec4(position, 1.0)");if(o===t.vertexShader)throw new Error("recipe look vertex shader changed: instancing patch no longer applies");r=new e.ShaderMaterial({uniforms:t.uniforms,vertexShader:o,fragmentShader:t.fragmentShader,side:t.side}),r.name=`${t.name}/instanced`,r.userData={...t.userData},n.set(t,r)}return r}var cr=new Set(["brick","stucco","stone"]),mr=new Set(["roofTile","slate","bitumen"]);async function br(e,t){let{THREE:n}=e,r=e.nearMetres??dr,o=e.cullMetres??us;if(!t.length)throw new Error("no building-type instances");let s=Ze(t),a=new n.Group;a.name="building-types";let i=t.map(f=>new n.Matrix4().fromArray(_t(f,s))),c=i.map(f=>({x:f.elements[12],z:f.elements[14]})),l=Math.max(50,...c.map(f=>Math.hypot(f.x,f.z)))+30,m=new Map,u=new Map;t.forEach((f,y)=>u.set(f.unit,[...u.get(f.unit)??[],y]));let d=[],h=[],g=[],w=t.map(()=>r),p=[],M=f=>!!(f?.isShaderMaterial&&f.uniforms?.map?.value&&f.uniforms.tint?.value&&f.uniforms.uvScale&&f.uniforms.enuFromWorld),b=f=>!!f?.userData?.cityLook,_=f=>!!(f?.isMeshLambertMaterial&&f.userData?.recipeLookShared&&!f.userData?.litMerged&&f.map&&f.color&&Math.abs(f.map.repeat.x-f.map.repeat.y)<1e-9&&!f.map.offset.x&&!f.map.offset.y&&!f.map.rotation),V=!0,R=f=>M(f)||b(f)||V&&_(f);for(let[f,y]of u){let x=await e.loadUnit(f);x.updateMatrixWorld(!0);let S;x.traverse(A=>{A.userData?.nominal&&(S=A.userData.nominal)});let v=[];x.traverse(A=>{A.isMesh&&v.push(A)});for(let A of v)M(A.material)&&!p.includes(A.material.uniforms.map.value)&&p.push(A.material.uniforms.map.value),_(A.material)&&!p.includes(A.material.map)&&p.push(A.material.map);if(g.push({unit:f,indices:y,meshes:v,nominal:S}),e.nearMetres===void 0)for(let A of y)w[A]=ls(S,r)}V=p.length<=Ee,!V&&g.some(f=>f.meshes.some(y=>_(y.material)))&&console.warn(`building types: ${p.length} textures, over ${Ee}; lit units keep one draw per material`);let T=new Map,z=f=>{if(b(f))return f;if(_(f)){let x=T.get(`lit|${f.side}`);return x||(x=hs(n,p,f.side),T.set(`lit|${f.side}`,x)),x}let y=T.get(f.side);if(!y){let x={enuFromWorld:f.uniforms.enuFromWorld,hlDimAll:{value:0}};p.forEach((S,v)=>{x[`t${v}`]={value:S}}),y=new n.ShaderMaterial({uniforms:x,...ms(p.length),side:f.side}),y.name="building-types/merged",y.userData={recipeLookShared:!0},T.set(f.side,y)}return y},W=(f,y,x)=>{if(b(f.material)){let v=f.geometry.getAttribute("layer"),A=f.geometry.getAttribute("tint");return{...y,matrix:x,uvScale:1,texture:v.getX(0),tint:[A.getX(0),A.getY(0),A.getZ(0)]}}if(_(f.material)){let v=f.material.color;return{...y,matrix:x,uvScale:f.material.map.repeat.x,texture:p.indexOf(f.material.map),tint:[v.r,v.g,v.b]}}let S=f.material.uniforms.tint.value;return{...y,matrix:x,uvScale:f.material.uniforms.uvScale.value,texture:p.indexOf(f.material.uniforms.map.value),tint:[S.x,S.y,S.z]}},G=(f,y="recipe")=>{let x=new n.BufferGeometry;return x.setAttribute("position",new n.BufferAttribute(f.positions,3)),x.setAttribute("normal",new n.BufferAttribute(f.normals,3)),x.setAttribute("uv",new n.BufferAttribute(f.uvs,2)),x.setAttribute(y==="city"?"layer":y==="lit"?"btTex":"aTex",new n.BufferAttribute(f.textures,1)),x.setAttribute(y==="city"?"tint":y==="lit"?"btTint":"aTint",new n.BufferAttribute(f.tints,3)),x.setIndex(new n.BufferAttribute(f.index,1)),h.push(x),x},oe=(f,y)=>{let x=[];for(let S=0;S<f.count;S++)x.push(f.getX(S)),y>1&&x.push(f.getY(S)),y>2&&x.push(f.getZ(S));return x},Re=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];for(let{unit:f,indices:y,meshes:x,nominal:S}of g){let v=new Map,A=new Map,L=new Map;for(let F of x){let O=F.geometry;if(!R(F.material)){let q=new n.InstancedMesh(O,ur(n,F.material,m),y.length);q.name=`${f}/near/${F.name}`,q.userData.layer="near",d.push({mesh:q,indices:y,local:F.matrixWorld.clone(),far:!1,triangles:(O.index?.count??O.attributes.position.count)/3}),a.add(q);continue}let I=F.material.side;L.set(I,F.material),v.set(I,[...v.get(I)??[],W(F,{positions:oe(O.attributes.position,3),normals:oe(O.attributes.normal,3),uvs:oe(O.attributes.uv,2),index:O.index?.array},F.matrixWorld.elements)])}if(S){let F=N=>b(N.material)?N.userData?.citySlot?.slot:N.material?.userData?.materialSlot,O=N=>x.filter(P=>R(P.material)&&N.has(F(P))).sort((P,se)=>se.geometry.attributes.position.count-P.geometry.attributes.position.count)[0],I=O(cr),q=O(mr),B=kt(S);if(!I){let N=Pe=>x.filter(Y=>Pe.has(Y.material?.userData?.materialSlot)).sort((Y,tt)=>tt.geometry.attributes.position.count-Y.geometry.attributes.position.count)[0],P=N(cr),se=N(mr)??P;for(let[Pe,Y,tt]of[[P,B.walls,"walls"],[se,B.roof,"roof"]]){if(!Pe||!Y.index.length)continue;let he=new n.BufferGeometry;he.setAttribute("position",new n.Float32BufferAttribute(Y.positions,3)),he.setAttribute("normal",new n.Float32BufferAttribute(Y.normals,3)),he.setAttribute("uv",new n.Float32BufferAttribute(Y.uvs,2)),he.setIndex(Y.index),h.push(he);let Ie=new n.InstancedMesh(he,ur(n,Pe.material,m),y.length);Ie.name=`${f}/far/${tt}`,Ie.userData.layer="far",d.push({mesh:Ie,indices:y,local:new n.Matrix4,far:!0,triangles:Y.index.length/3}),a.add(Ie)}}for(let[N,P]of[[I,B.walls],[q,B.roof]]){if(!N||!P.index.length)continue;let se=N.material.side;L.set(se,N.material),A.set(se,[...A.get(se)??[],W(N,{positions:P.positions,normals:P.normals,uvs:P.uvs,index:P.index},Re)])}}for(let[F,O]of[[v,!1],[A,!0]])for(let[I,q]of F){let B=L.get(I),N=cs(q),P=new n.InstancedMesh(G(N,b(B)?"city":_(B)?"lit":"recipe"),z(B),y.length);P.name=`${f}/${O?"far":"near"}/merged-${I}`,P.userData.layer=O?"far":"near",d.push({mesh:P,indices:y,local:new n.Matrix4,far:O,triangles:N.index.length/3}),a.add(P)}}let Q,ae=null,fe=new n.Matrix4,Oe=new n.Matrix4().makeScale(0,0,0),j=new Map,ve=[],Tt={near:0,far:0,culled:0},Qe=f=>{Q=f;let y=new Set(f.near),x=new Set(f.far),S=0;for(let v of d){let A=v.indices.map((L,F)=>({global:L,k:F})).filter(({global:L})=>(v.far?x:y).has(L));A.forEach(({global:L},F)=>{fe.multiplyMatrices(i[L],v.local),v.mesh.setMatrixAt(F,j.has(L)?Oe:fe)}),v.mesh.userData.slotToGlobal=A.map(L=>L.global),v.mesh.count=A.length,v.mesh.instanceMatrix.needsUpdate=!0,v.mesh.visible=A.length>0,A.length&&(v.mesh.computeBoundingSphere(),v.mesh.computeBoundingBox(),S++)}Tt={near:f.near.length,far:f.far.length,culled:f.culled};for(let v of ve)v.mesh.visible=(v.layer.far?x:y).has(v.global)},et=(f=!1)=>{let y=e.getCentre();if(!y)return;let[x,S]=St(s,[y.lng,y.lat]),v={x,z:S};!f&&ae&&Math.hypot(v.x-ae.x,v.z-ae.z)<10||(ae=v,Qe(Lt(c,v,w,o,Q)))};Qe({near:[],far:c.map((f,y)=>y),culled:0}),et(!0);let De=new n.Mesh(new n.BufferGeometry,new n.MeshBasicMaterial);return De.name="building-types/driver",De.frustumCulled=!1,De.onBeforeRender=()=>et(),a.add(De),{anchor:s,group:a,suppress:At(t),radiusMetres:l,update:et,setHighlighted(f,y){let x=pe(),S=ke[x],v=new Set([...f].map(L=>String(L).replace(/^NL\.IMBAG\.Pand\./,"")));for(let L of ve)a.remove(L.mesh),L.mesh.dispose?.();ve=[],j.clear(),t.forEach((L,F)=>{v.has(L.pand)?j.set(F,"highlight"):S.desaturate&&y&&Jt(y.lngLat,L.anchor)&&j.set(F,"dim")});let A=sr(n);for(let[L,F]of j)for(let O of d){if(!O.indices.includes(L))continue;let I=O.mesh.material,q=F==="highlight"?S.keepMaterials?I:b(I)?A.highlighted(I,!0):bt(n,I,"highlight",x):b(I)?A.dimmed(I,!0):bt(n,I,"dim",x),B=new n.InstancedMesh(O.mesh.geometry,q,1);B.setMatrixAt(0,fe.multiplyMatrices(i[L],O.local)),B.name=`${O.mesh.name}/${F}`,B.userData.slotToGlobal=[L],B.computeBoundingSphere(),B.computeBoundingBox(),F==="highlight"&&Qt(n,B,{style:x,up:[0,1,0]}),a.add(B),ve.push({global:L,layer:O,mesh:B})}return Q&&Qe(Q),[...j.values()].filter(L=>L==="highlight").length},pandForHit(f,y){let x=f?.userData?.slotToGlobal;return y===void 0||!x?null:t[x[y]]?.pand??null},stats(){let f=d.filter(S=>S.mesh.visible&&S.mesh.count>0).length,y=0,x=0;for(let S of d)S.mesh.visible&&(S.far?x+=S.triangles*S.mesh.count:y+=S.triangles*S.mesh.count);return{instances:t.length,...Tt,units:u.size,drawCalls:f,nearTriangles:y,farTriangles:x}},dispose(){for(let f of ve)f.mesh.dispose?.();for(let f of d)f.mesh.dispose?.();for(let f of h)f.dispose();for(let f of T.values())f.dispose()}}}return wr(ds);})();

"use strict";var CanalRecallBuildingTypes=(()=>{var st=Object.defineProperty;var Nr=Object.getOwnPropertyDescriptor;var Gr=Object.getOwnPropertyNames;var Ur=Object.prototype.hasOwnProperty;var Wr=(e,t)=>{for(var n in t)st(e,n,{get:t[n],enumerable:!0})},Hr=(e,t,n,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of Gr(t))!Ur.call(e,o)&&o!==n&&st(e,o,{get:()=>t[o],enumerable:!(r=Nr(t,o))||r.enumerable});return e};var $r=e=>Hr(st({},"__esModule",{value:!0}),e);var ii={};Wr(ii,{areaAnchor:()=>nt,areaRadiusMetres:()=>Ir,createBuildingTypes:()=>Br,farMassing:()=>Bt,groupByArea:()=>Dr,instanceMatrix:()=>It,partitionByDistance:()=>Nt,suppressionIds:()=>Pt});var it={wallPull:.7,glassLift:.5,liftBrick:!0},Ut={wallPull:.35,glassLift:.25,liftBrick:!1},ui={photo:{cells:"photo",shadeBands:0,flatColour:!1,...it,cartoonRoofCells:!1,outline:!1,litWallGain:255/225},procedural:{cells:"procedural",shadeBands:0,flatColour:!1,...it,cartoonRoofCells:!1,outline:!1,litWallGain:1},untextured:{cells:"procedural",shadeBands:0,flatColour:!0,...it,cartoonRoofCells:!1,outline:!1,litWallGain:1},storybook:{cells:"storybook",shadeBands:0,flatColour:!1,...Ut,cartoonRoofCells:!1,outline:!0,litWallGain:1,tone:{hueShift:-4,satMul:1.15,satAdd:0,keepDarkBelow:0,lightMul:1,lightAdd:.03,lightMax:.9}},cartoon:{cells:"cartoon",shadeBands:3,flatColour:!1,...Ut,cartoonRoofCells:!0,outline:!0,litWallGain:1,tone:{hueShift:0,satMul:1.7,satAdd:.08,keepDarkBelow:.35,lightMul:1.08,lightAdd:0,lightMax:.85}}};var le=(e,t,n)=>Math.max(t,Math.min(n,e));function A(e){let t=/^#?([0-9a-f]{6})$/i.exec(e.trim());if(!t)throw Error(`Bad colour ${e}`);let n=parseInt(t[1],16);return[n>>16&255,n>>8&255,n&255]}var C=e=>"#"+e.map(t=>Math.round(le(t,0,255)).toString(16).padStart(2,"0")).join("");function P([e,t,n]){let r=e/255,o=t/255,s=n/255,a=Math.max(r,o,s),i=Math.min(r,o,s),u=(a+i)/2;if(a===i)return[0,0,u];let l=a-i,m=u>.5?l/(2-a-i):l/(a+i);return[(a===r?(o-s)/l+(o<s?6:0):a===o?(s-r)/l+2:(r-o)/l+4)*60,m,u]}function H([e,t,n]){let r=(1-Math.abs(2*n-1))*t,o=r*(1-Math.abs(e/60%2-1)),s=n-r/2,[a,i,u]=e<60?[r,o,0]:e<120?[o,r,0]:e<180?[0,r,o]:e<240?[0,o,r]:e<300?[o,0,r]:[r,0,o];return[(a+s)*255,(i+s)*255,(u+s)*255]}var Ht=(e,t,n)=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n];var ut={canal:-1/0,c19:1860,school:1915,modern:1945};var lt=["#76808f","#606b79","#8c939c"],Te={procedural:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:lt},untextured:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:lt},photo:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:lt},storybook:{tile:["#b9553a","#a94a33","#c46a45"],slate:["#556070","#4a5666","#657282"]},cartoon:{tile:["#e85a3c","#f08a2b","#d94a3a"],slate:["#3f5f8f","#2f4a78","#4f7bb0"]}};var Ae={gravel:{hex:"#9e9281",luma:[112,156],cell:"flat"},"bitumen-dark":{hex:"#56585e",luma:[62,96],cell:"flat"},"bitumen-light":{hex:"#a99b84",luma:[150,182],cell:"flat"},"white-membrane":{hex:"#d9d9d3",luma:[196,228],cell:"flat"},"pantile-red":{hex:"#b5543a",luma:[84,124],cell:"tile"},"pantile-dark":{hex:"#6a5248",luma:[64,98],cell:"tile"},slate:{hex:"#76808f",luma:[62,140],cell:"slate"},zinc:{hex:"#9aa1a6",luma:[138,176],cell:"slate"},sedum:{hex:"#7a8350",luma:[96,132],cell:"flat"},solar:{hex:"#2e3a52",luma:[44,70],cell:"flat"},terrace:{hex:"#a38d74",luma:[124,162],cell:"flat"},glass:{hex:"#8fa3ad",luma:[130,170],cell:"flat"}},Ue={gravel:Ae.gravel.hex,membrane:Ae["white-membrane"].hex,bitumen:Ae["bitumen-dark"].hex,pebble:Ae["bitumen-light"].hex},$t=[Ue.gravel,Ue.membrane,Ue.bitumen,Ue.pebble];var Z={tile:Te.photo.tile,slate:Te.photo.slate,flat:$t};var ke={photo:{canal:["#7a3b2c","#7a3b2c","#6b3428","#8c4632","#9a5846","#b05a40","#4a2e26","#2e2a27","#3e4a40","#5d605a","#e4ddcd"],c19:["#b05a40","#b05a40","#bd6a45","#a24d38","#c58b5e","#d3b184","#e2d5ba","#e2d5ba","#d9c5a4","#9a5846"],school:["#8c4a38","#7a4535","#9a5240","#6e3d33","#a85a3c","#5e3a32","#b0603f"],modern:["#c9b79a","#b9ad9a","#a8a49c","#d3c6ad","#8f8a82","#bfb3a0","#9c7a62","#b05a40"]},storybook:{canal:["#b9583f","#9a4a38","#7a4a3c","#4a5048","#3f4a5a","#ead9b0","#c8664a"],c19:["#c8664a","#d98b5f","#e0b36a","#ead9b0","#d9b995","#c9a08c","#c8664a"],school:["#a8553f","#9a5a48","#b87a5c","#c8664a","#8a4e40"],modern:null},cartoon:{canal:["#d9453d","#a8433a","#3b3b4a","#2a9d8f","#4672b0","#fffaf0","#e8573d"],c19:["#e8573d","#ee7f2c","#f2b92e","#f3e6c8","#d96a4d","#f2b92e"],school:["#d96a4d","#e8573d","#b9583f","#ee7f2c"],modern:null}};var ci={canal:{label:"canal-house centre (before 1860)",wall:ke.photo.canal[0],roof:Te.photo.tile[0]},c19:{label:"19th-century ring (1860-1914)",wall:ke.photo.c19[0],roof:Te.photo.tile[1]},school:{label:"Amsterdamse School (1915-1944)",wall:ke.photo.school[0],roof:Te.photo.slate[0]},modern:{label:"post-war and contemporary (1945+)",wall:ke.photo.modern[0],roof:$t[0]}};var Vt=["brick","stucco","accent","stone","frame","door","glass","roofTile","slate","bitumen","paint"],zt={brick:"brick",accent:"brick",stucco:"stucco",stone:"stone",frame:"frame",door:"door",glass:"glass",roofTile:"tile",slate:"slate",bitumen:"flat",paint:"frame"},j={brick:3.36,stucco:2.4,accent:3.36,stone:1.28,frame:1,door:1,glass:1,roofTile:1.2,slate:1.2,bitumen:1.2,paint:1},ne=[.3,.6],Vr="#f1ede2",zr="#cfc8b8";function jr(e){let[t,n,r]=P(A(e)),o=le(.12+r*.9,ne[0],ne[1]);return C(H([t,le(n,.12,.5),o]))}function qr(e){let[t,n,r]=P(A(e));return C(H([t,le(n,0,.55),le(r*1.06+.03,.4,.97)]))}function Yr(e){let t=A(e),[n,r,o]=P(t);return o>=.5?C(Ht(t,A(Vr),.75)):C(H([n,r,Math.max(o,.16)]))}function Kr(e){let[t,n,r]=P(A(e));return C(Ht(H([t,n,Math.max(r,.62)]),A(zr),.45))}function Xr(e){let[t,n,r]=P(A(e));return r>=.17?e.startsWith("#")?e.toLowerCase():"#"+e.toLowerCase():C(H([t,n<.15?0:n,.17]))}function Jr(e,t){let n=P(A(t))[2];if(e==="roofTile"){let[r,o]=P(A(t));return o<.2?Z.slate[1]:C(H([r,le(o*1.1,.35,.6),le(.2+n*.85,.38,.5)]))}return e==="slate"?n<.27?Z.slate[1]:n<.31?Z.slate[0]:Z.slate[2]:n<.4?Z.flat[2]:Z.flat[0]}var be="measured",Zr=.18,Qr=225/255;function eo(e){let[t,n,r]=P(A(e)),[o,s,a]=A(C(H([t,n,Math.max(r,Zr)])));return C([o,s,a].map(i=>Math.min(255,Math.round(i/Qr))))}var ue=32,ce=64,te=[157.19,92.83,69.17],jt=240.95,qt=.16,to=255/(te[0]+(jt-te[0])*qt);function ct(e,t){let n=t/(ce-1),r=n<.5?te[0]+(te[1]-te[0])*(n/.5):te[1]+(te[2]-te[1])*((n-.5)/.5),o=5-15*t/35,s=17-15*t/35,a=t<35&&e+.5>=o&&e+.5<s;return Math.min(255,Math.round((a?r+(jt-r)*qt:r)*to))}var no=(()=>{let e=0;for(let t=0;t<ce;t++)for(let n=0;n<ue;n++)e+=ct(n,t);return e/(ue*ce)})(),Wt=.4;function ro(e){let[t,n,r]=P(A(e)),s=(r>=Wt?A(e):H([t,n,Wt])).map(i=>i/(no/255)),a=Math.max(1,...s.map(i=>i/255));return C(s.map(i=>Math.min(255,Math.round(i/a))))}var oo=228/255;function ao(e){return C(A(e).map(t=>Math.min(255,Math.round(t/oo))))}function so(e){return C(A(e))}function io(e){return C(A(e))}var lo=["brick","accent","glass","stone","bitumen","slate","roofTile"],Yt=(e,t)=>t===be&&lo.includes(e);function We(e,t,n){if(n===be&&(e==="brick"||e==="accent"))return eo(t);if(n===be&&e==="glass")return ro(t);if(n===be&&e==="stone")return ao(t);if(n===be&&e==="bitumen")return so(t);if(n===be&&(e==="slate"||e==="roofTile"))return io(t);switch(e){case"brick":case"accent":return jr(t);case"stucco":return qr(t);case"stone":return Kr(t);case"frame":return Yr(t);case"door":return Xr(t);case"glass":return"#ffffff";case"paint":return t.startsWith("#")?t.toLowerCase():"#"+t.toLowerCase();default:return Jr(e,t)}}var mt={asphalt:{base:[86,88,93]},cycle:{base:[150,66,58]},klinker:{base:[122,90,80],joint:"#4b3d38"},pavement:{base:[174,162,152],joint:"#7f756b"},kerb:"#cfcac0",paint:"#f2f0ea",rail:"#6c6e72",bollard:"#5a2a26"},Kt="#ffd21f",Xt="#ff8033",Jt="#b4682c";var Zt={land:{base:[168,158,142],joint:"#857b6d"},paving:{base:[184,174,158],joint:"#8f8577"},square:{base:[190,179,161],joint:"#958a7c"},klinker:{base:[158,124,114],joint:"#7a6660"},asphalt:[68,72,80],cycle:[156,76,66],gravel:[180,166,136],park:[96,140,70],wood:[70,112,58],parking:[102,102,105],kerb:"#aaa498",water:"#46707c",lawn:[110,154,74],bed:{soil:[98,80,60],leaf:[84,122,58]},shrub:{base:[56,92,46],leaf:[76,116,56]},bark:[118,84,58],sand:[212,194,150],parkGravel:[198,184,152],parkPath:[110,110,112],pond:"#46707c"};var co="highlight",mo="__canalRecallHighlight",fo="highlightAccent",ho="__canalRecallHighlightAccent",Fe={yellow:{keepMaterials:!1,outline:!1,rim:!1,desaturate:!1,ring:!1,beacon:!1,wash:!1,animated:!1},a:{keepMaterials:!0,outline:!0,rim:!1,desaturate:!1,ring:!0,beacon:!0,wash:!0,animated:!1},b:{keepMaterials:!0,outline:!1,rim:!0,desaturate:!1,ring:!0,beacon:!1,wash:!1,animated:!0},c:{keepMaterials:!0,outline:!1,rim:!1,desaturate:!0,ring:!0,beacon:!1,wash:!1,animated:!1}};var bo=60,re=.4,pe=2,pt=3.5,Qt=100,po=300;var go=.75,ft=.35,xo="__canalRecallHighlightBoost";function en(){let e=Number(globalThis[xo]);return Number.isFinite(e)?Math.min(1,Math.max(0,e)):0}var dt="__canalRecallHighlightExtent";function an(){let e=globalThis;return e[dt]instanceof Map?e[dt]:e[dt]=new Map}var yo=.3,Mo=2.4,wo=.9,_o=2.2;var Ro=.28;function tn(e){if(typeof e!="string")return null;let t=e.trim().toLowerCase();return t==="a"||t==="outline"?"a":t==="b"||t==="rim"?"b":t==="c"||t==="desaturate"?"c":t==="yellow"||t==="0"||t==="off"||t==="old"?"yellow":t==="default"?ht:null}var ht="a";function ge(e){try{let t=globalThis;if(e===void 0){let n=tn(t[mo]);if(n)return n}return tn(new URLSearchParams(e??t.location?.search??"").get(co))??ht}catch{return ht}}function sn(e=ge(),t){if(e==="yellow")return Kt;try{let n=globalThis,r=(t===void 0?n[ho]:void 0)??new URLSearchParams(t??n.location?.search??"").get(fo);if(r==="hud")return Jt;if(typeof r=="string"&&/^#?[0-9a-f]{6}$/i.test(r))return r.startsWith("#")?r:`#${r}`}catch{}return Xt}function gt(e=ge()){return Fe[e].keepMaterials?{HL_KEEP:""}:{}}var xt=`
#ifdef HL_KEEP
#define HL_PAINT(h) false
#else
#define HL_PAINT(h) ((h) > 0.5 && (h) < 1.5)
#endif
#define HL_GHOST(h) ((h) > 2.5 && fract(dot(floor(gl_FragCoord.xy), vec2(0.569840296, 0.754877666))) >= ${Ro.toFixed(3)})
float hlState(float hidden) { return hidden > 3.5 ? 3.0 : (hidden > 2.5 ? 2.0 : (hidden > 1.5 ? 1.0 : 0.0)); }
vec3 hlDesat(vec3 c, float h) { return h > 1.5 && h < 2.5 ? mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), ${re.toFixed(2)}) : c; }`,So=110540,vo=e=>111320*Math.cos(e*Math.PI/180);function Lo(e,t){let n=(e[1]+t[1])/2;return Math.hypot((e[0]-t[0])*vo(n),(e[1]-t[1])*So)}var ln=(e,t,n=bo)=>!!e&&Lo(e,t)<=n;var nn=`
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
  float far = clamp((length(c4.xyz - hlEye) - ${Qt.toFixed(1)}) / ${(po-Qt).toFixed(1)}, 0.0, 1.0);
  float width = hlWidthPx * mix(1.0, hlFarScale, far);
  if (dot(dir, dir) > 1e-12) clip.xy += normalize(dir) * width * 2.0 / hlViewport * clip.w;
#endif
  gl_Position = clip;
}`,Ao=`
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
  if (up < ${ft.toFixed(2)} || hlWash <= 0.0) discard;
  gl_FragColor = vec4(hlAccent, hlWash * smoothstep(${ft.toFixed(2)}, ${(ft+.15).toFixed(2)}, up));
#else
  vec3 n = hlHasNormal > 0.5 ? normalize(vHlNormal) : normalize(cross(dFdx(vHlPos), dFdy(vHlPos)));
  vec3 v = normalize(hlEye - vHlPos);
  float f = pow(1.0 - abs(dot(n, v)), ${_o.toFixed(2)});
  float pulse = 0.775 + 0.225 * sin(hlTime * 6.2831853 / ${Mo.toFixed(2)});
  gl_FragColor = vec4(hlAccent * f * ${wo.toFixed(2)} * pulse, 1.0);
#endif
}`,He="canalRecallHighlightPass",ko="__canalRecallHighlightOutlinePx";function To(){let e=globalThis[ko],t=e==null||e===""?NaN:Number(e);return Number.isFinite(t)&&t>=0?t:null}var Fo=(e,t)=>{let[n,r,o]=A(t);return new e.Vector3(n/255,r/255,o/255)};function Co(e,t,n={}){let r={};n.merged&&(r.HL_MERGED=""),t==="outline"&&(r.HL_OUTLINE=""),t==="roof"&&(r.HL_ROOF="");let o=nn;if(n.feature){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n.feature.attribute))throw new Error(`highlight: bad feature attribute ${n.feature.attribute}`);r.HL_FEATURE=n.feature.attribute,o=`attribute float ${n.feature.attribute};
uniform float hlFeatureId;
${nn}`}let s=new e.ShaderMaterial({defines:r,uniforms:{hlViewport:{value:new e.Vector2(1,1)},hlWidthPx:{value:pe},hlFarScale:{value:pt/pe},hlCentre:{value:new e.Vector3},hlDepthPush:{value:yo},hlAccent:{value:Fo(e,n.accent??sn())},hlEye:{value:new e.Vector3},hlTime:{value:0},hlHasNormal:{value:1},hlFeatureId:{value:n.feature?.id??0},hlUp:{value:new e.Vector3(0,0,1)},hlWash:{value:0}},vertexShader:o,fragmentShader:Ao,side:t==="outline"?e.BackSide:e.FrontSide,transparent:!0,depthTest:!0,depthWrite:t==="outline",blending:t==="rim"?e.AdditiveBlending:e.NormalBlending,polygonOffset:t!=="outline",polygonOffsetFactor:-1,polygonOffsetUnits:t==="roof"?-4:-2});return s.name=`highlight/${t}${n.merged?"/merged":""}`,s.userData={[He]:!0},s.defaultAttributeValues={hidden:[0],normal:[0,0,0]},s}function Eo(e,t,n,r){let o=e.geometry?.boundingBox,s=t.elements;if(!o)return;let a=n.domElement,i=a?.clientWidth||r.x,u=a?.clientHeight||r.y,l=[],m=!1;for(let c=0;c<8;c++){let h=c&1?o.max.x:o.min.x,d=c&2?o.max.y:o.min.y,g=c&4?o.max.z:o.min.z,w=s[0]*h+s[4]*d+s[8]*g+s[12],p=s[1]*h+s[5]*d+s[9]*g+s[13],M=s[3]*h+s[7]*d+s[11]*g+s[15];if(!(M>1e-9)){m=!0;break}l.push((w/M+1)/2*i,(1-p/M)/2*u)}an().set(e,{t:performance.now(),points:l,behind:m,width:i,height:u})}function Oo(e){for(let t of e?.userData?.[He]??[])e.remove(t),Bo(t.material),an().delete(t);e?.userData&&delete e.userData[He]}var Do=4,bt=new Map,un=Symbol("highlightPassPool");function Io(e,t){return`${e}|${t.merged?1:0}|${t.feature?.attribute??""}|${t.accent??""}`}function Po(e,t,n={}){let r=Io(t,n),o=bt.get(r)?.pop();if(o){let a=o.uniforms;return a.hlCentre.value.set(0,0,0),a.hlHasNormal.value=1,a.hlFeatureId.value=n.feature?.id??0,a.hlUp.value.set(0,0,1),a.hlWash.value=0,a.hlEye.value.set(0,0,0),a.hlTime.value=0,a.hlWidthPx.value=pe,a.hlFarScale.value=pt/pe,o}let s=Co(e,t,n);return s.userData[un]=r,s}function Bo(e){let t=e?.userData?.[un];if(!t){e?.dispose?.();return}let n=bt.get(t)??[];bt.set(t,n),n.length<Do&&!n.includes(e)?n.push(e):e.dispose()}function rn(e){let t=e?.getAttribute?.("position")??e?.attributes?.position;return!t||!!t.array}function cn(e,t,n={}){Oo(t);let r=Fe[n.style??ge()],o=[...r.outline?["outline"]:[],...r.rim?["rim"]:[],...r.wash&&!n.feature?["roof"]:[]];if(!o.length||!t?.geometry)return[];let s=t.geometry,a=n.centre;if(!a){!s.boundingBox&&rn(s)&&s.computeBoundingBox?.();let p=s.boundingBox?.getCenter(new e.Vector3)??s.boundingSphere?.center;a=p?[p.x,p.y,p.z]:[0,0,0]}let i=s.getAttribute?.("normal")?1:0,u=[],l=new e.Matrix4,m=new e.Vector4,c=new e.Vector2,h=new e.Matrix3,d=new e.Vector3,g=n.up??[0,0,1],w=!n.merged&&!n.feature&&!t.isInstancedMesh;w&&!s.boundingBox&&rn(s)&&s.computeBoundingBox?.();for(let p of o){let M=Po(e,p,{merged:n.merged,feature:n.feature,accent:n.accent??sn(n.style)});M.uniforms.hlCentre.value.set(a[0],a[1],a[2]),M.uniforms.hlHasNormal.value=i;let b=t.isInstancedMesh?new e.InstancedMesh(s,M,t.count):new e.Mesh(s,M);t.isInstancedMesh&&(b.instanceMatrix=t.instanceMatrix),b.name=`${t.name||"mesh"}/highlight-${p}`,b.frustumCulled=!1,b.castShadow=b.receiveShadow=!1,b.renderOrder=(t.renderOrder??0)+1,b.raycast=()=>{},p==="roof"&&Object.defineProperty(b,"visible",{get:()=>t.visible&&en()>.001,set:()=>{},configurable:!0}),b.onBeforeRender=(v,q,_)=>{t.isInstancedMesh&&(b.count=t.count),p!=="roof"&&(b.visible=t.visible);let T=M.uniforms;if(p==="roof"){h.setFromMatrix4(b.matrixWorld),d.setFromMatrixColumn(b.matrixWorld,0);let W=d.length()<.001?[0,0,1]:g;T.hlUp.value.set(W[0],W[1],W[2]).applyMatrix3(h.invert()).normalize(),T.hlWash.value=go*en()}v.getDrawingBufferSize(c),T.hlViewport.value.copy(c);let Y=v.domElement?.clientWidth||c.x,z=To();T.hlWidthPx.value=(z??pe)*(c.x/Y),T.hlFarScale.value=z==null?pt/pe:1,l.multiplyMatrices(_.projectionMatrix,_.matrixWorldInverse).multiply(b.matrixWorld),p==="outline"&&w&&Eo(b,l,v,c),l.invert(),m.set(0,0,1,0).applyMatrix4(l),Math.abs(m.w)>1e-12&&T.hlEye.value.set(m.x/m.w,m.y/m.w,m.z/m.w),T.hlTime.value=performance.now()/1e3,M.uniformsNeedUpdate=!0},t.add(b),u.push(b)}return t.userData??={},t.userData[He]=u,u}var on=new WeakMap;function yt(e,t,n,r=ge()){if(!t||n==="plain"||n==="highlight"&&Fe[r].keepMaterials)return t;let o=on.get(t);o||on.set(t,o=new Map);let s=`${n}|${r}`,a=o.get(s);if(a)return a;if(n==="highlight")a=new e.MeshLambertMaterial({color:16765471,emissive:7033856,side:t.side??e.FrontSide});else if(t.isShaderMaterial&&t.uniforms?.tint?.value?.isVector3)a=t.clone(),a.uniforms={...t.uniforms,tint:{value:No(t.uniforms.tint.value.clone())}};else if(t.isShaderMaterial&&t.uniforms?.hlDimAll)a=t.clone(),a.uniforms={...t.uniforms,hlDimAll:{value:1}};else if(t.isShaderMaterial)a=t.clone(),a.uniforms=t.uniforms,a.defines={...t.defines??{},HL_DIM_ALL:""};else{if(a=t.clone(),a.color){let i=a.color,u=.2126*i.r+.7152*i.g+.0722*i.b;i.setRGB(i.r+(u-i.r)*re,i.g+(u-i.g)*re,i.b+(u-i.b)*re)}if(a.map){let i=a.onBeforeCompile;a.onBeforeCompile=(u,l)=>{i?.call(a,u,l),u.fragmentShader=u.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${re.toFixed(2)});`)},a.customProgramCacheKey=()=>`${t.customProgramCacheKey?.()??""}|hl-dim`}}return a.name=`${t.name||"material"}/${n}`,a.userData={...t.userData??{},highlightVariantOf:t},o.set(s,a),a}function No(e){let t=.2126*e.x+.7152*e.y+.0722*e.z;return e.set(e.x+(t-e.x)*re,e.y+(t-e.y)*re,e.z+(t-e.z)*re)}var $={other:0,wall:1,roof:2,lid:3,trim:4,cornice:5,frontage:6,extrasStrip:7,extrasBox:8,extrasOther:9,shell:10},Go=[{name:"other",id:$.other,rgb:[0,0,0]},{name:"wall",id:$.wall,rgb:[255,255,255]},{name:"roof",id:$.roof,rgb:[255,0,0]},{name:"lid",id:$.lid,rgb:[128,0,128]},{name:"trim-decal",id:$.trim,rgb:[0,255,0]},{name:"cornice",id:$.cornice,rgb:[0,0,255]},{name:"frontage",id:$.frontage,rgb:[255,255,0]},{name:"extras-strip",id:$.extrasStrip,rgb:[255,0,255]},{name:"extras-box",id:$.extrasBox,rgb:[0,255,255]},{name:"extras-other",id:$.extrasOther,rgb:[128,128,0]},{name:"shell",id:$.shell,rgb:[0,128,128]}],mn=1,Uo=2,Wo=4e-6;var Ho=(e,t)=>e*t/2;function hn(e){try{return typeof URLSearchParams=="function"?new URLSearchParams(globalThis.location?.search??"").get(e):null}catch{return null}}function $o(){let t=globalThis.__canalRecallThinFade??hn("thinFade");return!(t===!1||t==="0"||t==="false"||t==="off")}function Vo(){return(globalThis.__canalRecallThinDebug??hn("thinDebug"))==="owner"?"owner":null}var Ce=e=>Number.isInteger(e)?e.toFixed(1):String(e),zo=e=>`vec3(${e.map(t=>(t/255).toFixed(4)).join(", ")})`,jo=`
attribute vec2 thin;
varying float vThinM;
flat varying float vThinClass;
`,qo=`
vThinM = thin.x * 0.01; vThinClass = thin.y;
#ifdef CITY_THIN_FADE
if (thin.y > ${Ce($.trim-.5)} && thin.y < ${Ce($.trim+.5)}) gl_Position.z -= ${Wo.toExponential()} * gl_Position.w;
#endif
`,Yo=`
uniform float thinFocalPx;
varying float vThinM;
flat varying float vThinClass;
vec3 thinOwnerColour(float c) {
${Go.map(e=>`  if (c < ${Ce(e.id+.5)}) return ${zo(e.rgb)};`).join(`
`)}
  return vec3(0.5);
}
`,Ko=`
#ifdef CITY_THIN_FADE
if (vThinM > 0.0) {
  float thinPx = vThinM * thinFocalPx / max(vFacDist, 0.01);
  float thinCover = clamp((thinPx - ${Ce(mn)}) / ${Ce(Uo-mn)}, 0.0, 1.0);
  if (thinCover < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= thinCover) discard;
}
#endif
`,fn=`
#ifdef CITY_THIN_OWNER
gl_FragColor = vec4(thinOwnerColour(vThinClass), 1.0);
#endif
`,Mt={value:1e3};function dn(e,t,n){let r="void main() {",o=/vFacDist = length\([^;]*\);/,s="if (HL_GHOST(vHighlight)) discard;";if(!e.includes(r)||!o.test(e)||!t.includes(r)||!t.includes(s))return null;let a=e.replace(r,`${jo}${r}`).replace(o,u=>`${u}${qo}`),i=t.replace(r,`${Yo}${r}`).replace(s,`${s}${Ko}`);if(n){if(!i.includes("#include <dithering_fragment>"))return null;i=i.replace("#include <dithering_fragment>",`#include <dithering_fragment>${fn}`)}else{let u=i.lastIndexOf("}");i=`${i.slice(0,u)}${fn}${i.slice(u)}`}return{vertex:a,fragment:i}}function bn(e,t,n={}){let r=n.fade??$o(),o=n.debug===void 0?Vo():n.debug;if(!r&&!o)return e;if(e.defines={...e.defines??{},...r?{CITY_THIN_FADE:""}:{},...o?{CITY_THIN_OWNER:""}:{}},e.defaultAttributeValues={...e.defaultAttributeValues??{},thin:[0,0]},t){let i=e.onBeforeCompile;e.onBeforeCompile=function(u,l){i?.call(this,u,l);let m=dn(u.vertexShader,u.fragmentShader,!0);m&&(u.vertexShader=m.vertex,u.fragmentShader=m.fragment,u.uniforms.thinFocalPx=Mt)}}else{let i=dn(e.vertexShader,e.fragmentShader,!1);if(!i)return e;e.vertexShader=i.vertex,e.fragmentShader=i.fragment,e.uniforms={...e.uniforms,thinFocalPx:Mt}}let s=e.onBeforeRender,a={x:0,y:0,set(i,u){return this.x=i,this.y=u,this},floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}};return e.onBeforeRender=function(i,u,l,...m){s?.call(this,i,u,l,...m);let c=i?.getDrawingBufferSize?i.getDrawingBufferSize(a).y:0,h=l?.projectionMatrix?.elements?.[5];c>0&&Number.isFinite(h)&&(Mt.value=Ho(h,c))},e.userData={...e.userData??{},thinFade:r,thinDebug:o},e}var pn=e=>{let t=globalThis,n=new RegExp(`[?&]${e}=([^&]*)`).exec(t.location?.search??"");return n?decodeURIComponent(n[1]):null};function wt(){let t=globalThis.__canalRecallDrawLimit??pn("drawLimit");return t===!0||t==="1"||t==="true"||t==="on"?!0:!(t===!1||t==="0"||t==="false"||t==="off")}var Xo=e=>Number.isInteger(e)?`${e}.0`:`${e}`,gn=`(fogNear * (1.0 + fract(fogFar) * ${Xo(8)}))`;var Jo=!0;function xn(){if(!wt())return!1;let e=globalThis.__canalRecallLandmarkHaze??pn("landmarkHaze");return e===!0||e==="1"||e==="true"||e==="on"?!0:e===!1||e==="0"||e==="false"||e==="off"?!1:Jo}var yn="DEPTH_FADE_LIMIT_ONLY";var Zo=.5,Qo=.38,Mn=250,ea=600,ta=.4;function wn(){let e=globalThis,t=typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("fadeStrength"):null,n=e.__canalRecallFadeStrength??t,r=n==null||n===""?NaN:Number(n);return Number.isFinite(r)?Math.max(0,Math.min(2,r)):1}var me=e=>Number.isInteger(e)?`${e}.0`:`${e}`;var na=(e=wn())=>`#ifdef USE_FOG
	float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	float fadeLuma = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( fadeLuma ), fogFactor * ${me(Zo*e)} );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * ${me(Qo*e)} );
#endif`,Mi=na(1),_n=`uniform vec3 fogColor;
	varying vec3 vFogEye;
	#define vFogDepth length( vFogEye )
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif`,wi=`#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
	${_n}
#endif`,Rn=`
#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
#define DEPTH_FADE_FOG_PARS
	${_n}
#endif
`,Sn=(e,t=wn(),n=wt())=>{let r=n?gn:"fogFar";return`${me(Math.min(1,t))} * smoothstep(max(${me(Mn)}, fogNear), max(max(${me(ea)}, fogNear + (${r} - fogNear) * ${me(ta)}), max(${me(Mn)}, fogNear) + 1.0), ${e})`};var ra="canalRecallDepthFadeOptOut";function vn(e,t=xn()){t&&e.fog!==!1?e.defines={...e.defines??{},[yn]:""}:e.fog=!1,e.userData={...e.userData??{},[ra]:!0}}var Ln="inferred",oa=e=>P(A(e))[1]<.2,aa=e=>{let[t,n,r]=P(A(e));return(t<45||t>340)&&n>=.15&&r<.7},sa=e=>oa(e)?"slate":"roofTile",_t=e=>aa(e)?"brick":"stucco",ia=[{test:/glass|glaz|window|vitr|ruit|pane/,slot:"glass",confidence:"name",rule:"glazing name"},{test:/decal|sign|mural|logo|letter|clock|dial/,slot:"paint",confidence:"name",rule:"signage / decal"},{test:/door|deur|gate/,slot:"door",confidence:"name",rule:"door name"},{test:/frame|kozijn|louvre|louver|blind|shutter|rail|mullion|sash/,slot:"frame",confidence:"name",rule:"joinery name"},{test:/brick|baksteen|klinker|terracotta/,slot:"brick",confidence:"name",rule:"brick name"},{test:/slate|leien|lei$/,slot:"slate",confidence:"name",rule:"slate name"},{test:/bitumen|asphalt|tar$|felt|flatroof|flat-roof|gravel/,slot:"bitumen",confidence:"name",rule:"flat roof name"},{test:/roof|tile|pantile|dakpan|dak/,slot:sa,confidence:"name",rule:"roof name, grey \u2192 slate, else pantile"},{test:/sandstone|stone|steen|column|marble|granite|limestone|plinth/,slot:"stone",confidence:"name",rule:"stone name"},{test:/stucco|render|plaster|pleister|concrete|beton|slab/,slot:"stucco",confidence:"name",rule:"render / concrete name"},{test:/gold|gilt|bronze|copper|brass|zinc|metal|steel|iron|lead|alu/,slot:"paint",confidence:"name",rule:"metal name (flat colour)"},{test:/wall|facade|gevel/,slot:_t,confidence:"name",rule:"wall name, brick hue \u2192 brick, else stucco"},{test:/ochre|yellow|buff/,slot:_t,confidence:"colour-word",rule:"ochre: yellow brick (brick hue) or render"},{test:/pink|rose/,slot:"stucco",confidence:"colour-word",rule:"pink: painted render"},{test:/moss|grass|green|blue|orange|purple|paint|teal/,slot:"paint",confidence:"colour-word",rule:"coloured paint word"},{test:/white|cream|ivory/,slot:"stucco",confidence:"colour-word",rule:"white: stucco (could be white trim)"},{test:/dark|black|charcoal|anthracite/,slot:"frame",confidence:"colour-word",rule:"dark: painted joinery / ironwork (could be a dark wall)"},{test:/red/,slot:_t,confidence:"colour-word",rule:"red: brick hue \u2192 brick (could be red tile or paint)"},{test:/grey|gray/,slot:"stucco",confidence:"colour-word",rule:"grey: render (could be concrete or zinc)"}];function An(e){return String(e??"").toLowerCase().replace(/[-_.\s]*\d+$/,"").trim()}function la(e){let[t,n,r]=P(A(e));return r<.22?{slot:"frame",rule:"very dark: joinery / ironwork"}:n>=.15&&(t<45||t>340)&&r<.62?{slot:"brick",rule:"brick hue"}:n<.2&&r>=.6?{slot:"stucco",rule:"pale neutral: render"}:n<.2&&r>=.22&&t>180&&t<260?{slot:"slate",rule:"blue-grey: slate"}:n<.25?{slot:"stone",rule:"neutral mid-tone: stone"}:{slot:"paint",rule:"saturated colour: paint"}}function kn(e,t){let n=t.toLowerCase(),r=An(e);for(let s of ia)if(s.test.test(r))return{slot:typeof s.slot=="function"?s.slot(n):s.slot,tint:n,confidence:s.confidence,rule:s.rule};let o=la(n);return{slot:o.slot,tint:n,confidence:"colour",rule:`no material word in "${r||"unnamed"}"; ${o.rule}`}}var Tn=e=>/white|cream|ivory/.test(An(e)),Fn=e=>typeof e=="string"&&Vt.includes(e);var On={ribs:{pitch:.5,min:.25,max:2,w:.09,out:.04},boards:{pitch:.4,min:.15,max:1.5,w:.05,out:.035},louvres:{pitch:.35,min:.2,max:1,w:.12,out:.12},panels:{pitch:1.2,min:.6,max:6,w:.05,out:.035}};var ol={min:.15,max:On.ribs.max};var Dn={canal:["#6e5352","#8c7768","#977f73","#a79276","#b8a17a","#575245","#60564b","#62544d","#61584c","#655850","#655b50","#6a5454","#6f6058","#726359","#726459","#76615d","#77685d","#7a6c60","#826c66","#918174","#9a887f","#a89f8a","#6b6163","#dfdcd2"],c19:["#70564f","#6f5b52","#7a665c","#86695b","#886a5f","#857266","#8b746d","#9b887e","#a38e83","#ad9585","#61534a","#63564e","#685b52","#6f6057","#716259","#75665c","#7b6961","#7c6962","#7f6a64","#7f7664","#8e796f","#9c9181","#95787e","#dad8cf"],school:["#665247","#775744","#735d52","#786158","#8c5957","#896559","#856f63","#9d7f6d","#ad997f","#5c4f48","#61564c","#67564e","#6b5554","#6b5851","#6b5b50","#716057","#745e5b","#75655c","#78665f","#806d64","#89706b","#a19888","#614a4e","#a4a09f"],modern:["#715d53","#7c6459","#816b64","#8f7265","#9c8980","#ac9a86","#60594c","#635c4e","#6a5a50","#6c5a54","#6c5e55","#6e6256","#72675a","#776a5d","#7b6a61","#7f6f64","#807265","#886f6b","#8b7d6d","#958b79","#a29189","#695256","#a59b8d","#c8c5ba"]};var Rt={"#4f4834":[215,215,215],"#463823":[216,215,215],"#5f5950":[215,215,215],"#a69873":[215,215,215],"#57423e":[215,215,215],"#473c3b":[215,215,215],"#5d5d5c":[214,215,215],"#7e573b":[215,215,215],"#705449":[215,215,215],"#7f8283":[215,214,215],"#796764":[215,215,215],"#5d534b":[215,215,215],"#7d6e52":[215,215,215],"#88735e":[215,215,215],"#88715f":[215,215,215],"#736352":[215,215,215],"#241d1c":[172,172,172],"#4b3f37":[215,215,215],"#615551":[215,215,215],"#595651":[214,215,214],"#423931":[215,215,215],"#7b6d6a":[215,214,216],"#382418":[215,215,215],"#866343":[215,215,215],"#6e6256":[215,215,215],"#625650":[205,205,205],"#252c24":[185,185,186],"#2d281b":[215,214,215],"#3b342b":[215,215,215],"#6f5c56":[215,215,215],"#393535":[215,215,215],"#786357":[215,215,215],"#383d43":[205,215,215],"#554e4a":[215,216,215],"#3d3432":[215,215,215],"#3d353c":[215,215,215],"#4e443f":[215,215,215],"#70574d":[207,207,207],"#d49662":[215,215,215],"#917b5c":[215,215,215],"#494341":[215,215,215],"#645f5f":[215,215,214],"#342a18":[215,215,215],"#825746":[215,216,215],"#99604e":[212,215,215],"#706868":[215,215,215],"#786b61":[215,215,214],"#5c5b57":[215,215,215],"#7a655b":[215,215,215],"#6f5b54":[215,215,215],"#4a3f3a":[215,214,215],"#614f44":[216,215,215],"#654e44":[215,215,215],"#6f5f53":[215,215,216],"#584d49":[215,215,215],"#d3c9b2":[215,215,215],"#544b46":[215,215,215],"#929289":[215,215,215],"#68584f":[215,215,216],"#574d47":[215,215,215],"#5e4e41":[215,215,215],"#6e605a":[215,215,215],"#605d5c":[215,215,215],"#8c7a6f":[215,215,215],"#4a3832":[165,165,166],"#81614f":[215,215,215],"#3d3533":[215,215,215],"#6d5351":[215,215,215],"#5c3d33":[214,214,215],"#906553":[215,215,215],"#65493d":[215,215,215],"#8e5f49":[215,215,215],"#8c6858":[215,215,215],"#8b5946":[215,215,215],"#665253":[209,209,209],"#3e3222":[215,215,215],"#000000":[197,198,197],"#7b081b":[215,215,215],"#383131":[215,215,215],"#3d3b37":[211,215,215],"#877d76":[214,215,215],"#191d0c":[215,214,213],"#bcab88":[215,215,215],"#656462":[215,215,215],"#3f3634":[174,174,175],"#463e3c":[197,197,198],"#453d3a":[177,177,176],"#1f1a1b":[156,156,157],"#615450":[214,215,215],"#5b4f4b":[215,215,215],"#574c4a":[215,215,215],"#413333":[215,215,215],"#7b5c53":[215,215,215],"#5f342b":[216,215,215],"#4e2422":[215,215,215],"#5b4b44":[209,209,209],"#493d32":[215,215,215],"#6a5048":[216,216,215],"#5e5855":[215,215,215],"#5e3f35":[215,215,215],"#68564f":[215,215,215],"#6b3e33":[215,214,215],"#5f3c30":[215,214,215],"#929191":[215,215,215],"#a2acb3":[215,215,215],"#8f7b65":[215,215,215],"#988e7d":[215,215,215],"#726d60":[215,215,215],"#584c45":[215,214,215],"#594643":[216,215,215],"#5e5750":[212,215,215],"#78645b":[215,215,215],"#484440":[215,215,215],"#73645e":[215,215,215],"#5c4f47":[215,215,215],"#3c3d39":[215,215,215],"#645451":[215,215,214],"#37333d":[179,179,178],"#a6856f":[215,215,215],"#574d4d":[205,205,205],"#393737":[215,215,215],"#6f4a3b":[215,214,215],"#ffa169":[212,215,215],"#576465":[216,215,216],"#71614a":[215,215,215],"#6c584f":[215,215,215],"#5b463e":[215,216,215],"#765e52":[214,215,215],"#4f4e4c":[215,215,215],"#544945":[215,215,215],"#504140":[194,195,194],"#51514f":[215,215,215],"#74665f":[215,215,215],"#735c59":[215,215,215],"#474d56":[215,215,215],"#7d6e5a":[215,215,215],"#514a43":[215,215,215],"#4e4e49":[215,215,215],"#745c51":[215,215,215],"#47403c":[215,215,215],"#4c3a37":[215,215,215],"#675d5a":[215,215,215],"#574e48":[215,215,215],"#686360":[215,215,215],"#4a413f":[215,215,215],"#423735":[215,215,215],"#756860":[215,215,215],"#5e5144":[215,215,215]};var ru={street:{...mt,brick:mt.klinker},tones:Zt};var ga=["sunny","legacy"],xa="sunny";function oe(e){let t=globalThis,r=/[?&]look=([\w-]+)/.exec(e??t.location?.search??"")?.[1]??t.__canalRecallLook;return ga.includes(r??"")?r:xa}var Me=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},ya=e=>255*(e<=.0031308?e*12.92:1.055*e**(1/2.4)-.055),fe=e=>{let t=parseInt(e.replace("#",""),16);return[t>>16&255,t>>8&255,t&255]},St=e=>"#"+e.map(t=>Math.round(Math.max(0,Math.min(255,t))).toString(16).padStart(2,"0")).join(""),Ma=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],ye=e=>Ma(fe(e).map(Me)),wa=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],_a={zenith:"#9ec3ed",horizon:"#a1c6e5"};function Ra(e){let t=e.sunElevationDeg*Math.PI/180,n=ye(e.sunColour)*e.sunIntensity/Math.PI,r=ye(e.skyColour)*e.skyIntensity/Math.PI,o=ye(e.groundColour)*e.skyIntensity/Math.PI,s=(r+o)/2;return{flat:n*Math.sin(t)+r,sunWall:n*Math.cos(t)+s,shadeWall:s}}var Sa=.55;function va(e="#ffe2bf",t="#aca497",n=Sa){let r=40*Math.PI/180,o=u=>{let l=St(fe(_a.horizon).map(d=>d+(255-d)*u)),m=ye(e)*2.15/Math.PI*Math.cos(r),c=(ye(l)+ye(t))/2/Math.PI,h=n*m/(1-n)/c;return{sunColour:e,sunIntensity:2.15,skyColour:l,groundColour:t,skyIntensity:h,sunElevationDeg:40}},s=u=>{let l=o(u),m=fe(l.sunColour).map(Me),c=fe(l.skyColour).map(Me),h=[0,2].map(d=>m[d]*l.sunIntensity*Math.sin(r)+c[d]*l.skyIntensity);return h[0]/h[1]},a=0,i=1;for(let u=0;u<40;u++){let l=(a+i)/2;s(l)<1?a=l:i=l}return{...o(i),whiteMix:+i.toFixed(3)}}var xe=va(),In=1/Ra(xe).sunWall,Nn={sunColour:xe.sunColour,sunIntensity:+(xe.sunIntensity*In).toFixed(4),skyColour:xe.skyColour,groundColour:xe.groundColour,skyIntensity:+(xe.skyIntensity*In).toFixed(4)},Pn=[.85,1.6],La=e=>typeof e=="string"?fe(e):e;function vt(e){let t=e?Me(219)/Me(wa(La(e))):1.106;return Math.max(Pn[0],Math.min(Pn[1],t))}function we(e,t){let n=fe(e).map(o=>Me(o)*t),r=Math.max(1,...n);return St(n.map(o=>ya(o/r)))}function Bn(e,t=Rt[e.toLowerCase()]){return we(e,vt(t))}function Gn(e,t,n,r=oe(),o){return r!=="sunny"||n!=="measured"||e!=="brick"&&e!=="accent"?t:o?Bn(t,o):Bn(t)}var uu=(()=>{let e=Object.keys(Rt).map(fe),t=n=>n.slice().sort((r,o)=>r-o)[n.length>>1];return St([0,1,2].map(n=>t(e.map(r=>r[n]))))})();var Aa=2,ka=.62;function Ta(e,t=Aa){let n=we(e,t);if(P(A(e))[2]>=ka)return n;let[r,o,s]=P(A(n));return s<=ne[1]?n:C(H([r,o,ne[1]]))}var Fa=e=>Object.fromEntries(Object.entries(e).map(([t,n])=>[t,n?n.map(r=>Ta(r)):null])),yu=Fa(Dn);var Ca={anonymous:"This building has no name or date in the map data.",named:"The map data has no date for this building.",place:"A mapped place; the map data has no date for its building."},vu=new Set(Object.values(Ca));var Un=["canal","c19","school","postwar","modern","tower"];var Oa=8;var Zu=16+Math.log2(Oa);var E=256,Da=["upper","ground","door","plain","shop"],Ia=2;var nc=Un.length*Ia*Da.length;var V=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16));var rc=V("#7d93a0"),oc=V("#1f2a33");var ac=V("#b8ad98"),sc=V("#cfc6b4"),ic=V("#ece8dd"),lc=V("#e2d9c2"),uc=[V("#2c4a3d"),V("#3a2a22"),V("#1f3b57"),V("#5a2a24")],cc=[V("#2f4a3a"),V("#7a2f27"),V("#27384f")];var Wn=.6;function Ve(e,t,n){let r=Math.imul(e|0,374761393)^Math.imul(t|0,668265263)^Math.imul(n|0,2246822519);return r=Math.imul(r^r>>>13,1274126177),((r^r>>>16)>>>0)/4294967296}function Hn(e,t){let n=0;for(let o=0;o<e.length;o+=4)n+=e[o];let r=n/(e.length/4);for(let o=0;o<e.length;o+=4){let s=Math.round(Math.max(0,Math.min(255,r+(e[o]-r)*t)));e[o]=e[o+1]=e[o+2]=s}}function $n(e,t){let n=new Uint8ClampedArray(E*E*4),r=(o,s,a,i,u)=>{let l=(s*E+o)*4,m=u??[a,a,a];n[l]=m[0],n[l+1]=m[1],n[l+2]=m[2],n[l+3]=i};if(e==="flat")for(let o=0;o<E;o++)for(let s=0;s<E;s++)r(s,o,Math.round((t?.96:.9+(Ve(s>>3,o>>3,3)-.5)*.08)*255),255);else if(e==="tile"){let a=E/8,i=E/5;for(let u=0;u<E;u++)for(let l=0;l<E;l++){let m=Math.floor(u/a),c=u%a/a,h=(l+m%2*i*.5)%E,d=Math.floor(h/i),g=h%i/i,w=Math.sin(g*Math.PI),p=t?.92:.7+.22*w-.28*Math.pow(Math.max(0,1-c*3.2),1.5)*0-.22*Math.max(0,(.18-c)/.18);t||(p+=(Ve(d,m,7)-.5)*.14);let M=t?c<.07||g<.035||g>.965:!1;r(l,u,Math.round(Math.max(0,Math.min(1,M?.28:p))*255),255)}t||Hn(n,Wn)}else if(e==="slate"){let a=E/11,i=E/6;for(let u=0;u<E;u++)for(let l=0;l<E;l++){let m=Math.floor(u/a),c=u%a/a,h=(l+m%2*i*.5)%E,d=Math.floor(h/i),g=h%i/i,w=t?.9:.82+(Ve(d,m,11)-.5)*.16-.16*Math.max(0,(.16-c)/.16);(g<(t?.05:.025)||c<(t?.09:.04))&&(w=t?.3:w*.7),r(l,u,Math.round(Math.max(0,Math.min(1,w))*255),255)}t||Hn(n,Wn)}else for(let u=0;u<E;u++)for(let l=0;l<E;l++){let m=l/E,c=u/E,h=m>.2-.06&&m<.8+.06&&c>.2-.06&&c<.82+.06,d=m>.2+.03&&m<.8-.03&&c>.2+.03&&c<.82-.03,g=Math.abs(m-.5)<.018||Math.abs(c-.5)<.018;if(d&&!g){let w=(c-.2)/.6199999999999999,p=t?[150+60*w,200+30*w,235]:[40+80*w*w,55+90*w*w,68+90*w*w];r(l,u,0,0,[p[0],p[1],p[2]])}else if(h)r(l,u,0,0,t?[255,250,240]:[236,232,221]);else{let w=t?.92:.85+(Ve(l>>3,u>>3,5)-.5)*.12,p=t&&(l<5||u<5||l>E-6||u>E-6);r(l,u,Math.round((p?.3:w)*255),255)}}return n}function Vn(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let m=0;m<336;m+=112)o.drawImage(t,m,l,112,112);else{let l=7,m=()=>(l=l*16807%2147483647)/2147483647;for(let c=0,h=0;h<336;h+=14,c++)for(let d=-(c%2)*24;d<336;d+=48){let g=150+m()*50;o.fillStyle=`rgb(${g},${g*.92},${g*.86})`,o.fillRect(d,h,48,14)}}o.strokeStyle="rgba(235,223,205,0.18)",o.lineWidth=1.7;for(let l=0,m=6;m<336;m+=14,l++){o.beginPath(),o.moveTo(0,m),o.lineTo(336,m),o.stroke();for(let c=l%2*24;c<336;c+=48)o.beginPath(),o.moveTo(c,m),o.lineTo(c,m+14),o.stroke()}let s=o.getImageData(0,0,336,336),a=s.data,i=0;for(let l=0;l<a.length;l+=4)i+=(a[l]+a[l+1]+a[l+2])/3;i/=a.length/4;let u=i>0?Math.min(2.4,225/i):1;for(let l=0;l<a.length;l+=4){let m=(a[l]+a[l+1]+a[l+2])/3,c=Math.min(255,(m+(i-m)*.7)*u);a[l]=a[l+1]=a[l+2]=c,a[l+3]=255}return o.putImageData(s,0,0),r}function zn(e){let t=e.createElement("canvas");t.width=64,t.height=128;let n=t.getContext("2d"),r=n.createLinearGradient(0,0,0,128);return r.addColorStop(0,"#8aa1b0"),r.addColorStop(.5,"#4d606c"),r.addColorStop(1,"#3c474e"),n.fillStyle=r,n.fillRect(0,0,64,128),n.fillStyle="rgba(235,242,248,0.16)",n.beginPath(),n.moveTo(10,0),n.lineTo(34,0),n.lineTo(4,70),n.lineTo(-20,70),n.closePath(),n.fill(),t}function jn(e){let t=e.createElement("canvas");t.width=ue,t.height=ce;let n=t.getContext("2d"),r=n.createImageData(ue,ce);for(let o=0;o<ce;o++)for(let s=0;s<ue;s++){let a=(o*ue+s)*4,i=ct(s,o);r.data[a]=r.data[a+1]=r.data[a+2]=i,r.data[a+3]=255}return n.putImageData(r,0,0),t}function qn(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d");n.fillStyle="#ffffff",n.fillRect(0,0,128,128),n.fillStyle="rgba(0,0,0,0.10)";for(let r=0;r<128;r+=16)n.fillRect(r,0,1.5,128);return t}function Yn(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=23,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++){let i=(s()-.5)*3;for(let u=0;u<128;u++){let l=(a*128+u)*4,m=s()<.012?-14:0,c=243+(s()-.5)*8+i+m;r.data[l]=r.data[l+1]=r.data[l+2]=c,r.data[l+3]=255}}return n.putImageData(r,0,0),t}function Kn(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=11,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<r.data.length;a+=4){let i=228+(s()-.5)*16;r.data[a]=r.data[a+1]=r.data[a+2]=i,r.data[a+3]=255}return n.putImageData(r,0,0),n.fillStyle="rgba(80,70,60,0.18)",n.fillRect(0,0,128,1.5),t}function ze(e,t){let n=$n(t,!1),r=Math.round(Math.sqrt(n.length/4)),o=e.createElement("canvas");o.width=o.height=r;let s=o.getContext("2d"),a=s.createImageData(r,r);for(let i=0;i<n.length;i+=4)a.data[i]=n[i],a.data[i+1]=n[i+1],a.data[i+2]=n[i+2],a.data[i+3]=255;return s.putImageData(a,0,0),o}var Pa=238;function Xn(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let m=0;m<336;m+=112)o.drawImage(t,m,l,112,112);else{let l=13,m=()=>(l=l*16807%2147483647)/2147483647;for(let c=0,h=0;h<336;h+=14,c++)for(let d=-(c%2)*24;d<336;d+=48){let g=165+m()*30;o.fillStyle=`rgb(${g},${g*.93},${g*.88})`,o.fillRect(d,h,48,14)}}o.strokeStyle="rgba(245,240,230,0.26)",o.lineWidth=1.2;for(let l=0,m=6;m<336;m+=14,l++){o.beginPath(),o.moveTo(0,m),o.lineTo(336,m),o.stroke();for(let c=l%2*24;c<336;c+=48)o.beginPath(),o.moveTo(c,m),o.lineTo(c,m+14),o.stroke()}let s=o.getImageData(0,0,336,336),a=s.data,i=0;for(let l=0;l<a.length;l+=4)i+=(a[l]+a[l+1]+a[l+2])/3;i/=a.length/4;let u=i>0?Math.min(2.6,Pa/i):1;for(let l=0;l<a.length;l+=4){let m=(a[l]+a[l+1]+a[l+2])/3,c=Math.min(255,(m+(i-m)*.82)*u);a[l]=a[l+1]=a[l+2]=c,a[l+3]=255}return o.putImageData(s,0,0),r}function Jn(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=31,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++)for(let i=0;i<128;i++){let u=(a*128+i)*4,l=246+(s()-.5)*3;r.data[u]=r.data[u+1]=r.data[u+2]=l,r.data[u+3]=255}return n.putImageData(r,0,0),t}function Zn(e){let t=e.createElement("canvas");t.width=t.height=4;let n=t.getContext("2d");return n.fillStyle="#fff",n.fillRect(0,0,4,4),t}var Qn={minFilter:"LinearMipmapLinear",magFilter:"Linear",generateMipmaps:!0};function Ba(e,t){let n=t.coarse?128:256,r=e==="facadeCells"?Math.min(t.gpuMaxAnisotropy,t.coarse?4:16):4;return{...Qn,cellPx:n,anisotropy:r,tierScale:1}}function Na(e,t){if(!t.enabled||t.coarse||t.tier!=="high")return Ba(e,t);let n=Number.isFinite(t.gpuMaxAnisotropy)&&t.gpuMaxAnisotropy>=1?t.gpuMaxAnisotropy:1,r=Number(t.cellPx),o=Number.isInteger(r)&&r>256&&r<=512&&r%32===0?r:256,s=Number(t.facadeAnisotropy),a=e==="facadeCells"?Number.isFinite(s)&&s>=1?Math.min(s,16):4:16;return{...Qn,cellPx:o,anisotropy:Math.min(n,a),tierScale:o/256}}function Ga(){try{let e=globalThis,t=Number(e.__canalRecallTexAniso??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texAniso"):null)??NaN);return Number.isFinite(t)&&t>=1?t:null}catch{return null}}function Ua(){try{let e=globalThis,t=e.__canalRecallTexturePolicy??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texturePolicy"):null);return!(t===!1||t==="0"||t==="false"||t==="off")}catch{return!0}}function Wa(){try{let e=globalThis,t=Number(e.__canalRecallCellPx??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("cellPx"):null)??NaN);return Number.isFinite(t)&&t>0?t:null}catch{return null}}function Ha(){let e=globalThis.__canalPerf?.tier;return e==="low"||e==="mid"||e==="high"?e:null}function $a(){return!!globalThis.matchMedia?.("(pointer: coarse)").matches}function er(e,t){return Na(e,{tier:Ha(),coarse:$a(),gpuMaxAnisotropy:t,enabled:Ua(),cellPx:Wa(),facadeAnisotropy:Ga()})}var _e=(e,t)=>`(${e}.g + 1.0 - ${t}.a)`;function Va(){let e=globalThis;return(e.__canalRecallMaskFormat??new URLSearchParams(e.location?.search??"").get("maskFormat"))==="rg"?"rg":"r8"}function tr(e,t,n=Va()){let r=t.length>>1;if(e.length!==r*4)throw new Error(`packMask: ${e.length} colour bytes for ${r} mask texels`);if(n==="rg"){for(let s=0;s<r;s++)e[s*4+3]=255;return{colour:e,mask:t,channels:2}}let o=new Uint8Array(r);for(let s=0;s<r;s++)o[s]=t[s*2],e[s*4+3]=255-t[s*2+1];return{colour:e,mask:o,channels:1}}var za=70,ja=190,qa=.5,nr=15,rr=40;var Lt="12.0";var or=[-1,-1];var ar=[-1,-1],sr=()=>[za,ja,qa],je=e=>Number.isInteger(e)?e.toFixed(1):String(e),ir=`
uniform vec2 roofLayers;
uniform vec3 roofTier;
vec3 roofTierColour(vec3 fine, vec2 uv, float layer, float dist) {
  if (roofLayers.x < 0.0 || layer < roofLayers.x - 0.5 || layer > roofLayers.y - 0.5) return fine;
  float mid = smoothstep(roofTier.x - ${je(nr)}, roofTier.x + ${je(nr)}, dist);
  if (mid <= 0.0) return fine;
  float far = smoothstep(roofTier.y - ${je(rr)}, roofTier.y + ${je(rr)}, dist);
  vec3 coarse = texture(cells, vec3(uv * roofTier.z, layer)).rgb;
  vec3 flatMean = textureLod(cells, vec3(uv, layer), ${Lt}).rgb;
  return mix(mix(fine, coarse, mid), flatMean, far);
}`;var Ya={threshold:20,taps:9,spread:1,grad:.85,sdf:1},Ka=`
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
}`;function At(e=Ya,t=1){let n=Number.isFinite(t)&&t>0?t:1;return{cellTaps:[e.threshold*n,e.taps,e.spread,e.grad],cellTapsSdf:e.sdf}}var lr=`${Rn}
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
${Ka}
#endif
void cellTierSample(vec3 p, float dist, out vec3 c, out vec2 m) {
#ifdef CELL_LOD_BIAS
  vec4 cc = texture(cells, p, cellLodBias); vec2 mm = texture(masks, p, cellLodBias).rg;
#else
  vec4 cc = texture(cells, p); vec2 mm = texture(masks, p).rg;
#endif
  c = cc.rgb; m = vec2(mm.r, ${_e("mm","cc")});
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
  far = max(far, ${Sn("dist")});
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
      c = mix(c, tc.rgb, cellTapW); m = mix(m, vec2(tm.r, ${_e("tm","tc")}), cellTapW);
    }
  }
#endif
  if (far <= 0.0) return;
  vec4 fc = textureLod(cells, p, ${Lt}); vec2 fm = textureLod(masks, p, ${Lt}).rg;
  c = mix(c, fc.rgb, far); m = mix(m, vec2(fm.r, ${_e("fm","fc")}), far);
}`,Xa=[1,2];function kt(e,t=Xa){return{cellAniso:Number.isFinite(e)&&e>=1?e:1,cellAnisoRule:[1,1,t[0],t[1]]}}var Ja=.5,Ye={sunAzimuthDeg:215,sunElevationDeg:40,sunColour:"#ffe9cc",sunIntensity:2.15,skyColour:"#e3ebf6",groundColour:"#998a72",skyIntensity:1.75,shadows:!0,shadowMapSize:2048,shadowIntensity:1-Ja};var Ac={...Ye,...Nn};function Za(e,t){let n=e*Math.PI/180,r=t*Math.PI/180;return[Math.sin(n)*Math.cos(r),Math.cos(n)*Math.cos(r),Math.sin(r)]}var kc=Za(Ye.sunAzimuthDeg,Ye.sunElevationDeg),Ke=(()=>{let e=Ye.sunAzimuthDeg*Math.PI/180;return[Math.sin(e),Math.cos(e)]})(),qe=[Ke[0]*.6,Ke[1]*.6,.8],ur=.84;function Qa(e){let t=e[0]*qe[0]+e[1]*qe[1]+e[2]*qe[2];return Math.max(.5,Math.min(1,.58+.42*Math.max(0,t)))}var Tc=Qa([0,0,1]),Ee=e=>Number.isInteger(e)?e.toFixed(1):String(+e.toFixed(6)),Xe=`
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = ${Ee(ur)} + ${Ee(1-ur)} * (0.5 + 0.5 * dot(h, vec2(${Ee(Ke[0])}, ${Ee(Ke[1])}))); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, dot(n, vec3(${qe.map(Ee).join(", ")}))), 0.5, 1.0);`;var cr=[.4,2.5],es=["brick","accent","stucco"];function ts(e){let t=(e?.white?vt(e.white):1.106)*(e?.stripOverDrawn??1);return Math.max(cr[0],Math.min(cr[1],t))}var ns=["brick","accent"];function mr(e,t,n,r,o=oe()){return o!=="sunny"||r==="measured"?t:n?es.includes(e)?we(t,ts(n)):t:ns.includes(e)?we(t,1.106):t}var D=[{name:"magnified (rho < 1)",rgb:[255,0,0]},{name:"rho 1-2",rgb:[255,255,0]},{name:"rho 2-4",rgb:[0,255,0]},{name:"rho 4-8",rgb:[0,255,255]},{name:"rho 8-16",rgb:[0,0,255]},{name:"rho 16-tier",rgb:[255,128,0]},{name:"tier far > 0",rgb:[255,0,255]},{name:"depth-fade far > 0 (tier 0)",rgb:[255,255,255]},{name:"under fade > 0",rgb:[128,0,255]},{name:"roof layer",rgb:[128,128,128]}];var Bc=D.length-1,rs=3;var os=520,as=os.toFixed(1),ss=String(rs),I=e=>`vec3(${e.map(t=>(t/255).toFixed(4)).join(", ")})`,dr=`
#ifdef CELL_DEBUG_RHO
vec3 cellDebugColour(float layer) {
  if (roofLayers.x >= 0.0 && layer > roofLayers.x - 0.5 && layer < roofLayers.y - 0.5) return ${I(D[9].rgb)};
#if defined(CELL_TIER_ANISO) && defined(CELL_DEBUG_UNDER)
  if (cellFarFlat > 0.001) return ${I(D[6].rgb)};
  if (cellFarTier <= 0.001 && cellFar > 0.001) return ${I(D[7].rgb)};
  if (cellUnder < 0.5) return ${I(D[0].rgb)};
  if (cellUnder < 0.75) return ${I(D[1].rgb)};
  if (cellUnder < 1.0) return ${I(D[2].rgb)};
  if (cellUnder < 1.5) return ${I(D[3].rgb)};
  if (cellUnder < 2.0) return ${I(D[4].rgb)};
  return ${I(D[5].rgb)};
#else
#ifdef CELL_TIER_ANISO
  if (cellFarFlat > 0.001) return ${I(D[6].rgb)};
  if (cellFarUnder > 0.001) return ${I(D[8].rgb)};
#else
  if (cellFarTier > 0.001) return ${I(D[6].rgb)};
#endif
  if (cellFar > 0.001) return ${I(D[7].rgb)};
  if (cellRho < 1.0) return ${I(D[0].rgb)};
  if (cellRho < 2.0) return ${I(D[1].rgb)};
  if (cellRho < 4.0) return ${I(D[2].rgb)};
  if (cellRho < 8.0) return ${I(D[3].rgb)};
  if (cellRho < 16.0) return ${I(D[4].rgb)};
  return ${I(D[5].rgb)};
#endif
}
#endif`;function Re(e){try{return typeof URLSearchParams=="function"?new URLSearchParams(globalThis.location?.search??"").get(e):null}catch{return null}}var is=1.25,fr=[2.5,5],ls={footprint:1,fadePx:[2,4],frameMinPx:0,barPx:[0,0],tent:!0};function us(){let t=globalThis.__canalRecallWindowSdfBand??Re("windowSdfBand");return!(t===!1||t==="0"||t==="false"||t==="off")}var Je=(e,t)=>{if(e==null)return null;let n=e.split(",").map(Number);return n.length===t&&n.every(r=>Number.isFinite(r)&&r>=0)?n:null};function cs(){let e=ls,t=Je(Re("windowSdfFoot"),1)?.[0]??e.footprint,n=Je(Re("windowSdfFade"),2)??e.fadePx,r=Je(Re("windowSdfFrameMin"),1)?.[0]??e.frameMinPx,o=Je(Re("windowSdfBar"),2)??e.barPx,s=Re("windowSdfTent"),a=s==null?e.tent:s==="1";return{band:[us()?1:0,t,n[0],n[1]],shape:[r,o[0],o[1],a?1:0]}}var Tt=null;function hr(){let e=`${globalThis.location?.search??""}|${String(globalThis.__canalRecallWindowSdfBand)}`;Tt?.key!==e&&(Tt={key:e,v:cs()});let t=Tt.v;return{windowSdfBand:{value:[...t.band]},windowSdfShape:{value:[...t.shape]}}}var Ze=["#6f8796","#2f4350","#1d2a33"],Qe=e=>I([parseInt(e.slice(1,3),16),parseInt(e.slice(3,5),16),parseInt(e.slice(5,7),16)]),br=`
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
  vec2 cell = vec2(${as}, head.y);
  vec2 p = fract(uv) * cell;
  // The pixel's footprint from the continuous uv (fract jumps at the cell seam), in canvas px per framebuffer px.
  vec2 fpx = max(fwidth(uv * cell), vec2(1e-3));
  vec2 fw = fpx * (band ? windowSdfBand.y : ${is.toFixed(2)});
#ifdef CELL_TAPS
  // The footprint prefilter's taps (roofTier.ts, lane R4-D #246) widen the edge box with the wall under the windows.
  fw *= mix(1.0, cellTapsSdf, cellTapW);
#endif
  vec2 fade = band ? windowSdfBand.zw : vec2(${fr[0].toFixed(1)}, ${fr[1].toFixed(1)});
  for (int i = 0; i < ${ss}; i++) {
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
    vec3 gc = g < 0.55 ? mix(${Qe(Ze[0])}, ${Qe(Ze[1])}, g / 0.55) : mix(${Qe(Ze[1])}, ${Qe(Ze[2])}, (g - 0.55) / 0.45);
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
#endif`;var ms={legacy:.9,sunny:1},fs=(e=oe())=>ms[e],Q=fs(),Oe=255/225,ds=255/228,hs=255/243,bs=255/246,tt=[{cell:"brick",tileM:j.brick,clampUv:!1,litGain:Oe*Q,skyTint:!1},{cell:"stucco",tileM:j.stucco,clampUv:!1,litGain:hs*Q,skyTint:!1},{cell:"stone",tileM:j.stone,clampUv:!1,litGain:ds*Q,skyTint:!1},{cell:"white",tileM:1,clampUv:!1,litGain:1,skyTint:!1},{cell:"door",tileM:j.door,clampUv:!1,litGain:1,skyTint:!1},{cell:"glass",tileM:j.glass,clampUv:!0,litGain:1,skyTint:!0},{cell:"tile",tileM:j.roofTile,clampUv:!1,litGain:Oe*Q,skyTint:!1},{cell:"slate",tileM:j.slate,clampUv:!1,litGain:Oe*Q,skyTint:!1},{cell:"flat",tileM:j.bitumen,clampUv:!1,litGain:Oe*Q,skyTint:!1},{cell:"brick20",tileM:j.brick,clampUv:!1,litGain:Oe*Q,skyTint:!1},{cell:"whiteStucco",tileM:j.stucco,clampUv:!1,litGain:bs*Q,skyTint:!1},{cell:"glassTint",tileM:j.glass,clampUv:!0,litGain:1,skyTint:!0}],et=tt.length,De=Object.fromEntries(tt.map((e,t)=>[e.cell,t])),ps=ut.school;function Et(e,t={}){let n=zt[e],r=t.source==="measured";return n==="glass"&&r?De.glassTint:n==="brick"&&!r&&typeof t.year=="number"&&t.year>=ps?De.brick20:n==="stucco"&&t.white?De.whiteStucco:n==="frame"?De.white:De[n]}function gs(){return tt.map(e=>[1/e.tileM,e.clampUv?1:0,e.litGain,e.skyTint?1:0])}var xs=.38,ys=.8,Ms=.27,ws=.97,_s=.75,Rs=.5,Ss=.12,vs=(e,t)=>(e<45||e>340)&&t>=.2;function Ls(e,t,n,r=oe(),o){if(Yt(e,n))return We(e,Gn(e,t,n,r,o),n);let s=A(t),[a,i,u]=P(s);return e==="slate"&&vs(a,i)?We("roofTile",t):(e==="brick"||e==="accent")&&i<Ss?C(H([a,i,Math.min(ne[1],Math.max(ne[0],.12+u*.9))])):e==="slate"&&u>xs?C(H([a,Math.min(i,.12),Math.min(.72,u/ys)])):e==="slate"?u<Ms?Z.slate[1]:Z.slate[0]:e==="frame"&&u>=.5&&u<_s?C(s):e==="stone"&&u<Rs?C(s):We(e,t)}function Mr(e,t,n,r=oe(),o,s){let a=Ls(e,t,n,r,o),[i,u,l]=A(mr(e,a,s??null,n,r));return[i,u,l,255]}function As(e,t,n){switch(t){case"brick":return Vn(e,n);case"brick20":return Xn(e,n);case"stucco":return Yn(e);case"whiteStucco":return Jn(e);case"stone":return Kn(e);case"white":case"frame":return Zn(e);case"door":return qn(e);case"glass":return zn(e);case"glassTint":return jn(e);case"tile":return ze(e,"tile");case"slate":return ze(e,"slate");case"flat":return ze(e,"flat")}}function ks(e,t,n){let r=n*n,o=new Uint8Array(r*4*et),s=new Uint8Array(r*2*et),a=e.createElement("canvas");a.width=a.height=n;let i=a.getContext("2d",{willReadFrequently:!0});return i.imageSmoothingQuality="high",tt.forEach((u,l)=>{i.clearRect(0,0,n,n),i.drawImage(As(e,u.cell,t),0,0,n,n);let m=i.getImageData(0,0,n,n).data;for(let c=0;c<n;c++)for(let h=0;h<n;h++){let d=((n-1-c)*n+h)*4,g=l*r+c*n+h;o[g*4]=m[d],o[g*4+1]=m[d+1],o[g*4+2]=m[d+2],o[g*4+3]=255,s[g*2]=255,s[g*2+1]=0}}),{colour:o,mask:s}}async function Ts(e=document){let t=new Image;t.src=new URL("materials/ambientcg/Bricks057/colour.jpg",e.baseURI).href;try{return await t.decode(),t}catch{return null}}var Ot=e=>`${e.lit?"lit":"unlit"}|${e.kind}|${e.kind==="slot"?e.uv??"uv":"-"}|${e.highlight?"hl":e.dim?"dim":"-"}|${e.side??0}${e.noFade?"|nofade":""}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf2":""}${e.lodBias?"|lodb":""}${e.aniso?"|aniso":""}${e.taps?"|taps":""}`;function Fs(e){let t={CITY_SLOT_COUNT:String(et)};return e.kind==="slot"&&(t.CITY_SLOT=""),e.swap&&(t.CITY_SWAP=""),e.cellDebug&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CELL_DEBUG_RHO="",e.cellDebug==="under"&&(t.CELL_DEBUG_UNDER="")),e.windows&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CITY_WINDOW_SDF=""),e.lodBias&&e.kind==="chunk"&&(t.CELL_LOD_BIAS=""),e.aniso&&e.kind==="chunk"&&(t.CELL_TIER_ANISO=""),e.taps&&e.kind==="chunk"&&(t.CELL_TAPS=""),e.lit?(t.CITY_VARIANT_UNIFORMS="",{...t,...gt()}):(e.kind==="slot"&&e.uv==="box"&&(t.CITY_BOX_UV=""),e.highlight?t.CITY_HIGHLIGHT="":e.dim&&(t.CITY_DIM=""),{...t,...gt()})}function Cs(e){return{cityForce:{value:e.highlight?1:e.dim?2:0},cityBoxUv:{value:e.kind==="slot"&&e.uv==="box"?1:0}}}var Es=e=>e.lit?`city-look-v4|lit|${e.kind}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf2":""}${e.lodBias?"|lodb":""}${e.aniso?"|aniso":""}${e.taps?"|taps":""}`:`city-look-v3|${Ot({...e,side:0})}`,Os="vec3(1.0, 0.824, 0.122)",pr="vec3(1.0, 0.637, 0.0137)",gr="vec3(0.035, 0.05, 0.07)",Ds=1,Is=.2,Ps=.75,Bs=1.8,Se=e=>Number.isInteger(e)?e.toFixed(1):String(e),Ns=`
float cityGrain(vec3 cell) {
  float g = clamp(dot(cell, vec3(0.299, 0.587, 0.114)) / ${Se(225/255)}, 0.45, 1.1);
  return mix(1.0, g, ${Se(Ps)});
}`,wr=16,Gs=`
#ifdef CITY_SWAP
attribute float swapSlot;
uniform vec4 citySwapUnder[${wr/4}];
uniform float cityUnder;
flat varying float vCityUnder;
#endif`,Us=`
#ifdef CITY_SWAP
int citySw = int(swapSlot + 0.5) - 1;
vCityUnder = citySw >= 0 ? citySwapUnder[citySw / 4][citySw % 4] : cityUnder;
#endif`,_r=`
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
${Gs}
${xt}`,Rr=`
${Us}
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
#endif`,Sr=`
vFacDist = length((modelViewMatrix * vec4(position, 1.0)).xyz);
if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`,vr=`
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${ir}
${lr}
${dr}
${br}
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
${Ns}
${xt}`,Lr=`
if (HL_GHOST(vHighlight)) discard;
#ifdef CITY_SWAP
float cityHash = fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296)));
if (cityFade < 1.0 && cityHash >= cityFade) discard;
// The complement of a replacement dissolving in over (or out from) this mesh: where it draws, this one does not.
if (cityHash < vCityUnder) discard;
#else
if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;
#endif`,Ar=`
vec2 cityUv = vSlot.y > 0.5 ? clamp(vFacUv, 0.0, 1.0) : vFacUv;
vec3 cityP = vec3(cityUv, vLayer);
vec3 cityC; vec2 cityM;
#ifdef CITY_SLOT
vec4 cityCC = texture(cells, cityP); vec2 cityMM = texture(masks, cityP).rg;
cityC = cityCC.rgb; cityM = vec2(cityMM.r, ${_e("cityMM","cityCC")});
#else
cellTierSample(cityP, vFacDist, cityC, cityM);
#ifdef CITY_WINDOW_SDF
windowSdf(cityUv, vLayer, 1.0 - cellFar, cityC, cityM);
#endif
cityC = roofTierColour(cityC, cityUv, vLayer, vFacDist);
#endif
float cityG = cityGrain(cityC);
cityC *= mix(vec3(1.0), vTint, cityM.r) * mix(vec3(1.0), vAccent, cityM.g);`,Ws=`
uniform mat3 enuFromWorld;
${_r}
varying float vShade;
void main() {
${Rr}
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
${Xe}
  vShade = shade;
#else
  vShade = tint.a;
#endif
${Sr}
}`,Hs=`
precision highp float;
${vr}
varying float vShade;
void main() {
${Lr}
${Ar}
  if (HL_PAINT(vHighlight)) {
    float hlShade = clamp(1.0 - (1.0 - vShade) * ${Se(Bs)}, 0.6, 1.0);
    gl_FragColor = vec4(${Os} * (flatColour > 0.5 ? 1.0 : cityG) * hlShade, 1.0);
    return;
  }
  if (flatColour > 0.5) cityC = vTint;
  cityC = hlDesat(cityC, vHighlight);
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  gl_FragColor = vec4(cityC * shade, 1.0);
#ifdef CELL_DEBUG_RHO
  gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif
}`;function $s(e,t={}){return{cells:t.cells??{value:null},masks:t.masks??{value:null},slotBase:t.slotBase??{value:0},slotParams:t.slotParams??{value:gs().map(n=>new e.Vector4(...n))},bands:t.bands??{value:0},flatColour:t.flatColour??{value:0},cityFade:t.cityFade??{value:1},wallGain:t.wallGain??{value:1},roofLayers:t.roofLayers??{value:ar},roofTier:t.roofTier??{value:sr()},cellTier:t.cellTier??{value:or},enuFromWorld:t.enuFromWorld??{value:new e.Matrix3},citySwapUnder:t.citySwapUnder??{value:new Float32Array(wr)},cityUnder:t.cityUnder??{value:0},windowTable:t.windowTable??{value:null},windowSdfMix:t.windowSdfMix??{value:1},cellLodBias:t.cellLodBias??{value:0},cellAniso:t.cellAniso??{value:kt(16).cellAniso},cellAnisoRule:t.cellAnisoRule??{value:kt(16).cellAnisoRule},cellTaps:t.cellTaps??{value:At().cellTaps},cellTapsSdf:t.cellTapsSdf??{value:At().cellTapsSdf},...hr(),...t.windowSdfBand?{windowSdfBand:t.windowSdfBand}:{},...t.windowSdfShape?{windowSdfShape:t.windowSdfShape}:{}}}var Vs={accent:[1,1,1,1],hidden:[0],color:[1,1,1],uv:[0,0],uv1:[0,0],swapSlot:[0]},Ct="recipeLookShared";function zs(e,t,n){let r=Fs(t),o=t.side??e.FrontSide,s;if(!t.lit)s=new e.ShaderMaterial({uniforms:n,defines:r,vertexShader:Ws,fragmentShader:Hs,side:o});else{s=new e.MeshLambertMaterial({side:o,flatShading:t.kind==="chunk"}),s.defines={...s.defines??{},...r};let a=Cs(t);s.onBeforeCompile=u=>{for(let l of Object.keys(n))u.uniforms[l]=n[l];Object.assign(u.uniforms,a),u.vertexShader=u.vertexShader.replace("#include <common>",`#include <common>${_r}`).replace("#include <begin_vertex>",`#include <begin_vertex>${Rr}`).replace("#include <project_vertex>",`#include <project_vertex>${Sr}`),u.fragmentShader=u.fragmentShader.replace("#include <common>",`#include <common>${vr}
float cityLuma;`).replace("#include <dithering_fragment>",`#include <dithering_fragment>
#ifdef CELL_DEBUG_RHO
gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>${Lr}`).replace("#include <map_fragment>",`${Ar}
#ifdef CITY_SLOT
cityC *= vSlot.z;
#else
cityC *= mix(1.0, wallGain * ${Se(Q)}, cityM.r);
#endif
if (flatColour > 0.5) cityC = vTint;
cityLuma = dot(cityC, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= HL_PAINT(vHighlight) ? ${pr} * ${Se(Ds)} * pow(flatColour > 0.5 ? 1.0 : cityG, 2.2) : pow(hlDesat(cityC, vHighlight), vec3(2.2));`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
if (HL_PAINT(vHighlight)) totalEmissiveRadiance += ${pr} * ${Se(Is)};
#ifdef CITY_SLOT
else totalEmissiveRadiance += ${gr} * vSlot.w;
#else
// Bay glazing (dark, untinted texels): the same constant sky tint as landmark glass, never a hotspot.
else totalEmissiveRadiance += ${gr} * (1.0 - smoothstep(0.06, 0.2, cityLuma)) * (1.0 - cityM.r);
#endif`)};let i=Es(t);s.customProgramCacheKey=()=>i,s.uniforms=n}return s.defaultAttributeValues={...Vs},s.name=`city-look/${Ot(t)}`,s.userData={cityLook:!0,cityVariant:{...t},[Ct]:!0},t.noFade&&vn(s),t.kind==="chunk"?bn(s,!!t.lit):s}function js(e){return e?e.isMeshBasicMaterial||e.userData?.unlit?"unlit (decal / emissive sign)":e.transparent||(e.opacity??1)<1?"transparent":e.vertexColors?"vertex colours":e.map?"own texture":null:"no material"}function qs(e,t){let n=e?.userData??{};if(Fn(n.materialSlot)&&typeof n.tint=="string"){let s=n.tintSource==="measured";return{slot:n.materialSlot,tint:n.tint,inferred:n.materialSlotSource===Ln,...s?{source:"measured"}:{},...s&&typeof n.tintWhitePoint=="string"?{white:n.tintWhitePoint}:{}}}if(!t||js(e)||!e.color)return null;let r="#"+e.color.getHexString(),o=kn(e.name,r);return{slot:o.slot,tint:o.tint,inferred:!0}}function xr(e,t,n,r,o={}){let s=t.getAttribute("position")?.count??0,a=Et(n,o),i=Mr(n,r,o.source,void 0,o.whitePoint,o.exposure),u=t.getAttribute("layer"),l=t.getAttribute("tint");if(u&&l)return u.getX(0)===a&&Math.round(l.getX(0)*255)===i[0]&&Math.round(l.getY(0)*255)===i[1]&&Math.round(l.getZ(0)*255)===i[2];t.setAttribute("layer",new e.BufferAttribute(new Uint8Array(s).fill(a),1,!1));let m=new Uint8Array(s*4);for(let c=0;c<s;c++)m.set(i,c*4);return t.setAttribute("tint",new e.BufferAttribute(m,4,!0)),!0}function Ys(e,t,n,r,o,s={}){let a=r.getAttribute("normal"),i=r.getAttribute("layer"),u=r.getAttribute("tint");if(!a||!i||!u)return 0;let[l,m,c]=Mr("bitumen",o,s.source);t.updateWorldMatrix(!0,!0);let h=new e.Matrix4().copy(t.matrixWorld).invert().multiply(n.matrixWorld),d=new e.Matrix3().getNormalMatrix(h),g=new e.Vector3,w=Et("bitumen",s),p=0;for(let M=0;M<a.count;M++)g.set(a.getX(M),a.getY(M),a.getZ(M)).applyMatrix3(d).normalize(),!(g.y<ws)&&(i.setX(M,w),u.setXYZW(M,l/255,m/255,c/255,1),p++);return p&&(i.needsUpdate=!0,u.needsUpdate=!0),p}var Ks="__canalRecallCityLookShared";function kr(e,t={}){let n=globalThis,r=n[Ks]??=new Map,o=r.get(e);return o||r.set(e,o=Xs(e,t)),o}function Xs(e,t={}){let n=t.document??globalThis.document,r=t.size??(globalThis.matchMedia?.("(pointer: coarse)").matches?128:256),o=$s(e),s=new Map,a=null,i=!1,u=(c,h)=>{let d=new e.DataArrayTexture(c,r,r,et);return d.format=h,d.type=e.UnsignedByteType,d.wrapS=d.wrapT=e.RepeatWrapping,d.minFilter=e.LinearMipmapLinearFilter,d.magFilter=e.LinearFilter,d.generateMipmaps=!0,d.anisotropy=t.anisotropy??er("slotCells",16).anisotropy,d.unpackAlignment=1,d.needsUpdate=!0,d.userData={bytes:c.byteLength,[Ct]:!0},d},l=(async()=>{if(!n)return;let c=t.brick!==void 0?t.brick:await Ts(n),{colour:h,mask:d}=ks(n,c,r),g=tr(h,d);a={colour:u(g.colour,e.RGBAFormat),mask:u(g.mask,g.channels===1?e.RedFormat:e.RGFormat)},i||(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)})(),m=c=>{let h=Ot(c),d=s.get(h);return d||s.set(h,d=zs(e,c,o)),d};return{uniforms:o,ready:l,material:m,dress(c,{lit:h,infer:d=!1,year:g=null,wallExposure:w=null}){let p=0;return c.traverse(M=>{if(!M.isMesh||Array.isArray(M.material)||M.material?.userData?.cityLook)return;let b=qs(M.material,d);if(!b)return;let v=M.geometry;if(!v?.getAttribute("position"))return;let q=!!v.getAttribute("uv");!q&&!v.getAttribute("normal")&&v.computeVertexNormals();let _={year:g,white:b.inferred&&Tn(M.material.name),source:b.source,...b.white?{whitePoint:b.white}:{},...w?{exposure:w}:{}};xr(e,v,b.slot,b.tint,_)||(v=M.geometry=v.clone(),v.deleteAttribute("layer"),v.deleteAttribute("tint"),xr(e,v,b.slot,b.tint,_)),b.inferred&&b.slot==="slate"&&!b.source&&Ys(e,c,M,v,b.tint,_);let T=M.material;M.material=m({lit:h,kind:"slot",uv:q?"uv":"box",side:T.side}),M.userData.citySlot={slot:b.slot,tint:b.tint,...b.source?{source:b.source}:{},inferred:b.inferred,from:T.name,layer:Et(b.slot,_)},T.userData?.[Ct]||T.dispose(),p++}),p},highlighted(c,h){let d=c?.userData?.cityVariant;return d?m({...d,highlight:h,dim:!1}):c},dimmed(c,h){let d=c?.userData?.cityVariant;return d?m({...d,highlight:!1,dim:h}):c},bindAtlas(c){i=!!c,c?(o.cells.value=c.colour,o.masks.value=c.mask,o.slotBase.value=c.slotBase):a&&(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)},textureBytes(){return a&&!i?Math.round((a.colour.userData.bytes+a.mask.userData.bytes)*4/3):0}}}var Js=2*Math.PI*6378137;function Tr(e,t){return[(180+e)/360,(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+t*Math.PI/360)))/360]}var Zs=e=>1/Js/Math.cos(e*Math.PI/180);function Dt(e,t){let[n,r]=Tr(e[0],e[1]),[o,s]=Tr(t[0],t[1]),a=Zs(e[1]);return[(o-n)/a,(s-r)/a]}function nt(e){let t=e.map(r=>r.anchor[0]),n=e.map(r=>r.anchor[1]);return[(Math.min(...t)+Math.max(...t))/2,(Math.min(...n)+Math.max(...n))/2]}var Qs=e=>Math.PI-(180+e)*Math.PI/180;function It(e,t){let[n,r]=Dt(t,e.anchor),o=Qs(e.northOffsetDegrees),s=Math.cos(o),a=Math.sin(o),[i,u,l]=e.scale;return[s*i,0,-a*i,0,0,u,0,0,a*l,0,s*l,0,n,e.groundAltitudeMetres,r,1]}function Dr(e){let t=new Map;for(let n of e)t.set(n.area??"default",[...t.get(n.area??"default")??[],n]);return t}function Ir(e){let t=nt(e);return Math.max(50,...e.map(n=>Math.hypot(...Dt(t,n.anchor))))+30}var ei=e=>`NL.IMBAG.Pand.${e}`;function Pt(e){return[...new Set(e.flatMap(t=>[t.pand,...t.alsoSuppress??[]].map(ei)))].sort()}function Bt(e){let t=e.L0/2,n=e.W0/2,r=e.E0,o={positions:[],normals:[],uvs:[],index:[]},s={positions:[],normals:[],uvs:[],index:[]},a=(c,h,d,g,w,p,M)=>{let b=c.positions.length/3;for(let v of[h,d,g,w])c.positions.push(...v),c.normals.push(...p),c.uvs.push(...M(v));c.index.push(b,b+1,b+2,b,b+2,b+3)},i=c=>[c[0],c[1]],u=c=>[c[2],c[1]],l=c=>[c[0],c[2]];a(o,[-t,0,n],[t,0,n],[t,r,n],[-t,r,n],[0,0,1],i),a(o,[t,0,-n],[-t,0,-n],[-t,r,-n],[t,r,-n],[0,0,-1],i),a(o,[t,0,n],[t,0,-n],[t,r,-n],[t,r,n],[1,0,0],u),a(o,[-t,0,-n],[-t,0,n],[-t,r,n],[-t,r,-n],[-1,0,0],u);let m=e.R0!==void 0&&e.R0>r+.3?e.R0:void 0;if(m===void 0)a(s,[-t,r,n],[t,r,n],[t,r,-n],[-t,r,-n],[0,1,0],l);else{let c=m-r,h=Math.hypot(n,c),d=c/h,g=n/h;a(s,[-t,r,n],[t,r,n],[t,m,0],[-t,m,0],[0,g,d],l),a(s,[t,r,-n],[-t,r,-n],[-t,m,0],[t,m,0],[0,g,-d],l);let w=(p,M,b)=>{let v=o.positions.length/3,q=b?[[p,r,-n],[p,r,n],[p,m,0]]:[[p,r,n],[p,r,-n],[p,m,0]];for(let _ of q)o.positions.push(..._),o.normals.push(M,0,0),o.uvs.push(...u(_));o.index.push(v,v+1,v+2)};w(t,1,!1),w(-t,-1,!0)}return{walls:o,roof:s}}function ti(e,t=Pr){return e?Math.max(t,Math.round(3*Math.max(e.L0,e.E0))):t}function Nt(e,t,n,r,o,s=20){let a=new Set(o?.near),i=new Set(o?.far),u=[],l=[];return e.forEach((m,c)=>{let h=Math.hypot(m.x-t.x,m.z-t.z),d=typeof n=="number"?n:n[c],g=a.has(c)?d+s:d-(i.has(c)?s:0),w=a.has(c)||i.has(c)?r+s:r;h<=g?u.push(c):h<=w&&l.push(c)}),{near:u,far:l,culled:e.length-u.length-l.length}}var Pr=140,ni=700;function ri(e){let t=e.reduce((a,i)=>a+i.positions.length/3,0),n=e.reduce((a,i)=>a+(i.index?i.index.length:i.positions.length/3),0),r={positions:new Float32Array(t*3),normals:new Float32Array(t*3),uvs:new Float32Array(t*2),textures:new Float32Array(t),tints:new Float32Array(t*3),index:new Uint32Array(n)},o=0,s=0;for(let a of e){let i=a.matrix,u=a.positions.length/3,l=i[0],m=i[4],c=i[8],h=i[1],d=i[5],g=i[9],w=i[2],p=i[6],M=i[10],b=[d*M-g*p,g*w-h*M,h*p-d*w,c*p-m*M,l*M-c*w,m*w-l*p,m*g-c*d,c*h-l*g,l*d-m*h],v=l*b[0]+m*b[1]+c*b[2]<0;for(let _=0;_<u;_++){let T=a.positions[_*3],Y=a.positions[_*3+1],z=a.positions[_*3+2],W=(o+_)*3;r.positions[W]=i[0]*T+i[4]*Y+i[8]*z+i[12],r.positions[W+1]=i[1]*T+i[5]*Y+i[9]*z+i[13],r.positions[W+2]=i[2]*T+i[6]*Y+i[10]*z+i[14];let ae=a.normals[_*3],ve=a.normals[_*3+1],ee=a.normals[_*3+2],se=b[0]*ae+b[1]*ve+b[2]*ee,de=b[3]*ae+b[4]*ve+b[5]*ee,Pe=b[6]*ae+b[7]*ve+b[8]*ee,K=(Math.hypot(se,de,Pe)||1)*(v?-1:1);r.normals[W]=se/K,r.normals[W+1]=de/K,r.normals[W+2]=Pe/K,r.uvs[(o+_)*2]=a.uvs[_*2]*a.uvScale,r.uvs[(o+_)*2+1]=a.uvs[_*2+1]*a.uvScale,r.textures[o+_]=a.texture,r.tints[W]=a.tint[0],r.tints[W+1]=a.tint[1],r.tints[W+2]=a.tint[2]}let q=a.index?a.index.length:u;for(let _=0;_<q;_+=3){let T=a.index?a.index[_]:_,Y=a.index?a.index[_+1]:_+1,z=a.index?a.index[_+2]:_+2;r.index[s++]=o+T,r.index[s++]=o+(v?z:Y),r.index[s++]=o+(v?Y:z)}o+=u}return r}function oi(e){let t=Math.max(1,e),n=Array.from({length:t},(r,o)=>o===t-1?`c = texture2D(t${o}, vUv).rgb;`:`if (vTex < ${o}.5) c = texture2D(t${o}, vUv).rgb; else`).join(`
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
${Xe}
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
}`}}var Ie=10;function ai(e){let t=Math.max(1,e),n=Array.from({length:t},(r,o)=>o===t-1?`btC = texture2D(btT${o}, vBtUv);`:`if (vBtTex < ${o}.5) btC = texture2D(btT${o}, vBtUv); else`).join(`
  `);return{declarations:`${Array.from({length:t},(r,o)=>`uniform sampler2D btT${o};`).join(`
`)}
varying float vBtTex;
varying vec3 vBtTint;
varying vec2 vBtUv;`,sample:`vec4 btC;
  ${n}
  diffuseColor *= vec4(btC.rgb * vBtTint, btC.a);
#undef USE_MAP
#include <map_fragment>`}}var Fr=new WeakMap;function si(e,t,n){let r=Fr.get(e.MeshLambertMaterial);r||(r=class extends e.MeshLambertMaterial{btTextures=[];constructor(s){super(s),this.onBeforeCompile=function(a){let{declarations:i,sample:u}=ai(Ie);for(let l=0;l<Ie;l++)a.uniforms[`btT${l}`]={value:this.btTextures[l]??this.btTextures[0]??null};a.vertexShader=a.vertexShader.replace("#include <common>",`#include <common>
attribute float btTex;
attribute vec3 btTint;
varying float vBtTex;
varying vec3 vBtTint;
varying vec2 vBtUv;`).replace("#include <uv_vertex>",`#include <uv_vertex>
  vBtUv = uv; vBtTex = btTex; vBtTint = btTint;`),a.fragmentShader=a.fragmentShader.replace("#include <common>",`#include <common>
${i}`).replace("#include <map_fragment>",u)},this.customProgramCacheKey=function(){return`building-types/lit-merged/${Ie}`}}copy(s){return super.copy(s),this.btTextures=[...s.btTextures??[]],this.onBeforeCompile=s.onBeforeCompile,this.customProgramCacheKey=s.customProgramCacheKey,this}},Fr.set(e.MeshLambertMaterial,r));let o=new r({map:t[0],side:n});return o.btTextures=[...t],o.name="building-types/lit-merged",o.userData={recipeLookShared:!0,litMerged:!0},o}function Cr(e,t,n){if(!t?.isShaderMaterial)return t;let r=n.get(t);if(!r){let o=String(t.vertexShader).replace("mat3(modelMatrix) * normal","mat3(modelMatrix * instanceMatrix) * normal").replace("modelViewMatrix * vec4(position, 1.0)","modelViewMatrix * instanceMatrix * vec4(position, 1.0)");if(o===t.vertexShader)throw new Error("recipe look vertex shader changed: instancing patch no longer applies");r=new e.ShaderMaterial({uniforms:t.uniforms,vertexShader:o,fragmentShader:t.fragmentShader,side:t.side}),r.name=`${t.name}/instanced`,r.userData={...t.userData},n.set(t,r)}return r}var Er=new Set(["brick","stucco","stone"]),Or=new Set(["roofTile","slate","bitumen"]);async function Br(e,t){let{THREE:n}=e,r=e.nearMetres??Pr,o=e.cullMetres??ni;if(!t.length)throw new Error("no building-type instances");let s=nt(t),a=new n.Group;a.name="building-types";let i=t.map(f=>new n.Matrix4().fromArray(It(f,s))),u=i.map(f=>({x:f.elements[12],z:f.elements[14]})),l=Math.max(50,...u.map(f=>Math.hypot(f.x,f.z)))+30,m=new Map,c=new Map;t.forEach((f,x)=>c.set(f.unit,[...c.get(f.unit)??[],x]));let h=[],d=[],g=[],w=t.map(()=>r),p=[],M=f=>!!(f?.isShaderMaterial&&f.uniforms?.map?.value&&f.uniforms.tint?.value&&f.uniforms.uvScale&&f.uniforms.enuFromWorld),b=f=>!!f?.userData?.cityLook,v=f=>!!(f?.isMeshLambertMaterial&&f.userData?.recipeLookShared&&!f.userData?.litMerged&&f.map&&f.color&&Math.abs(f.map.repeat.x-f.map.repeat.y)<1e-9&&!f.map.offset.x&&!f.map.offset.y&&!f.map.rotation),q=!0,_=f=>M(f)||b(f)||q&&v(f);for(let[f,x]of c){let y=await e.loadUnit(f);y.updateMatrixWorld(!0);let S;y.traverse(L=>{L.userData?.nominal&&(S=L.userData.nominal)});let R=[];y.traverse(L=>{L.isMesh&&R.push(L)});for(let L of R)M(L.material)&&!p.includes(L.material.uniforms.map.value)&&p.push(L.material.uniforms.map.value),v(L.material)&&!p.includes(L.material.map)&&p.push(L.material.map);if(g.push({unit:f,indices:x,meshes:R,nominal:S}),e.nearMetres===void 0)for(let L of x)w[L]=ti(S,r)}q=p.length<=Ie,!q&&g.some(f=>f.meshes.some(x=>v(x.material)))&&console.warn(`building types: ${p.length} textures, over ${Ie}; lit units keep one draw per material`);let T=new Map,Y=f=>{if(b(f))return f;if(v(f)){let y=T.get(`lit|${f.side}`);return y||(y=si(n,p,f.side),T.set(`lit|${f.side}`,y)),y}let x=T.get(f.side);if(!x){let y={enuFromWorld:f.uniforms.enuFromWorld,hlDimAll:{value:0}};p.forEach((S,R)=>{y[`t${R}`]={value:S}}),x=new n.ShaderMaterial({uniforms:y,...oi(p.length),side:f.side}),x.name="building-types/merged",x.userData={recipeLookShared:!0},T.set(f.side,x)}return x},z=(f,x,y)=>{if(b(f.material)){let R=f.geometry.getAttribute("layer"),L=f.geometry.getAttribute("tint");return{...x,matrix:y,uvScale:1,texture:R.getX(0),tint:[L.getX(0),L.getY(0),L.getZ(0)]}}if(v(f.material)){let R=f.material.color;return{...x,matrix:y,uvScale:f.material.map.repeat.x,texture:p.indexOf(f.material.map),tint:[R.r,R.g,R.b]}}let S=f.material.uniforms.tint.value;return{...x,matrix:y,uvScale:f.material.uniforms.uvScale.value,texture:p.indexOf(f.material.uniforms.map.value),tint:[S.x,S.y,S.z]}},W=(f,x="recipe")=>{let y=new n.BufferGeometry;return y.setAttribute("position",new n.BufferAttribute(f.positions,3)),y.setAttribute("normal",new n.BufferAttribute(f.normals,3)),y.setAttribute("uv",new n.BufferAttribute(f.uvs,2)),y.setAttribute(x==="city"?"layer":x==="lit"?"btTex":"aTex",new n.BufferAttribute(f.textures,1)),y.setAttribute(x==="city"?"tint":x==="lit"?"btTint":"aTint",new n.BufferAttribute(f.tints,3)),y.setIndex(new n.BufferAttribute(f.index,1)),d.push(y),y},ae=(f,x)=>{let y=[];for(let S=0;S<f.count;S++)y.push(f.getX(S)),x>1&&y.push(f.getY(S)),x>2&&y.push(f.getZ(S));return y},ve=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];for(let{unit:f,indices:x,meshes:y,nominal:S}of g){let R=new Map,L=new Map,k=new Map;for(let F of y){let O=F.geometry;if(!_(F.material)){let X=new n.InstancedMesh(O,Cr(n,F.material,m),x.length);X.name=`${f}/near/${F.name}`,X.userData.layer="near",h.push({mesh:X,indices:x,local:F.matrixWorld.clone(),far:!1,triangles:(O.index?.count??O.attributes.position.count)/3}),a.add(X);continue}let N=F.material.side;k.set(N,F.material),R.set(N,[...R.get(N)??[],z(F,{positions:ae(O.attributes.position,3),normals:ae(O.attributes.normal,3),uvs:ae(O.attributes.uv,2),index:O.index?.array},F.matrixWorld.elements)])}if(S){let F=U=>b(U.material)?U.userData?.citySlot?.slot:U.material?.userData?.materialSlot,O=U=>y.filter(B=>_(B.material)&&U.has(F(B))).sort((B,ie)=>ie.geometry.attributes.position.count-B.geometry.attributes.position.count)[0],N=O(Er),X=O(Or),G=Bt(S);if(!N){let U=Ne=>y.filter(J=>Ne.has(J.material?.userData?.materialSlot)).sort((J,at)=>at.geometry.attributes.position.count-J.geometry.attributes.position.count)[0],B=U(Er),ie=U(Or)??B;for(let[Ne,J,at]of[[B,G.walls,"walls"],[ie,G.roof,"roof"]]){if(!Ne||!J.index.length)continue;let he=new n.BufferGeometry;he.setAttribute("position",new n.Float32BufferAttribute(J.positions,3)),he.setAttribute("normal",new n.Float32BufferAttribute(J.normals,3)),he.setAttribute("uv",new n.Float32BufferAttribute(J.uvs,2)),he.setIndex(J.index),d.push(he);let Ge=new n.InstancedMesh(he,Cr(n,Ne.material,m),x.length);Ge.name=`${f}/far/${at}`,Ge.userData.layer="far",h.push({mesh:Ge,indices:x,local:new n.Matrix4,far:!0,triangles:J.index.length/3}),a.add(Ge)}}for(let[U,B]of[[N,G.walls],[X,G.roof]]){if(!U||!B.index.length)continue;let ie=U.material.side;k.set(ie,U.material),L.set(ie,[...L.get(ie)??[],z(U,{positions:B.positions,normals:B.normals,uvs:B.uvs,index:B.index},ve)])}}for(let[F,O]of[[R,!1],[L,!0]])for(let[N,X]of F){let G=k.get(N),U=ri(X),B=new n.InstancedMesh(W(U,b(G)?"city":v(G)?"lit":"recipe"),Y(G),x.length);B.name=`${f}/${O?"far":"near"}/merged-${N}`,B.userData.layer=O?"far":"near",h.push({mesh:B,indices:x,local:new n.Matrix4,far:O,triangles:U.index.length/3}),a.add(B)}}let ee,se=null,de=new n.Matrix4,Pe=new n.Matrix4().makeScale(0,0,0),K=new Map,Le=[],Gt={near:0,far:0,culled:0},rt=f=>{ee=f;let x=new Set(f.near),y=new Set(f.far),S=0;for(let R of h){let L=R.indices.map((k,F)=>({global:k,k:F})).filter(({global:k})=>(R.far?y:x).has(k));L.forEach(({global:k},F)=>{de.multiplyMatrices(i[k],R.local),R.mesh.setMatrixAt(F,K.has(k)?Pe:de)}),R.mesh.userData.slotToGlobal=L.map(k=>k.global),R.mesh.count=L.length,R.mesh.instanceMatrix.needsUpdate=!0,R.mesh.visible=L.length>0,L.length&&(R.mesh.computeBoundingSphere(),R.mesh.computeBoundingBox(),S++)}Gt={near:f.near.length,far:f.far.length,culled:f.culled};for(let R of Le)R.mesh.visible=(R.layer.far?y:x).has(R.global)},ot=(f=!1)=>{let x=e.getCentre();if(!x)return;let[y,S]=Dt(s,[x.lng,x.lat]),R={x:y,z:S};!f&&se&&Math.hypot(R.x-se.x,R.z-se.z)<10||(se=R,rt(Nt(u,R,w,o,ee)))};rt({near:[],far:u.map((f,x)=>x),culled:0}),ot(!0);let Be=new n.Mesh(new n.BufferGeometry,new n.MeshBasicMaterial);return Be.name="building-types/driver",Be.frustumCulled=!1,Be.onBeforeRender=()=>ot(),a.add(Be),{anchor:s,group:a,suppress:Pt(t),radiusMetres:l,update:ot,setHighlighted(f,x){let y=ge(),S=Fe[y],R=new Set([...f].map(k=>String(k).replace(/^NL\.IMBAG\.Pand\./,"")));for(let k of Le)a.remove(k.mesh),k.mesh.dispose?.();Le=[],K.clear(),t.forEach((k,F)=>{R.has(k.pand)?K.set(F,"highlight"):S.desaturate&&x&&ln(x.lngLat,k.anchor)&&K.set(F,"dim")});let L=kr(n);for(let[k,F]of K)for(let O of h){if(!O.indices.includes(k))continue;let N=O.mesh.material,X=F==="highlight"?S.keepMaterials?N:b(N)?L.highlighted(N,!0):yt(n,N,"highlight",y):b(N)?L.dimmed(N,!0):yt(n,N,"dim",y),G=new n.InstancedMesh(O.mesh.geometry,X,1);G.setMatrixAt(0,de.multiplyMatrices(i[k],O.local)),G.name=`${O.mesh.name}/${F}`,G.userData.slotToGlobal=[k],G.computeBoundingSphere(),G.computeBoundingBox(),F==="highlight"&&cn(n,G,{style:y,up:[0,1,0]}),a.add(G),Le.push({global:k,layer:O,mesh:G})}return ee&&rt(ee),[...K.values()].filter(k=>k==="highlight").length},pandForHit(f,x){let y=f?.userData?.slotToGlobal;return x===void 0||!y?null:t[y[x]]?.pand??null},stats(){let f=h.filter(S=>S.mesh.visible&&S.mesh.count>0).length,x=0,y=0;for(let S of h)S.mesh.visible&&(S.far?y+=S.triangles*S.mesh.count:x+=S.triangles*S.mesh.count);return{instances:t.length,...Gt,units:c.size,drawCalls:f,nearTriangles:x,farTriangles:y}},dispose(){for(let f of Le)f.mesh.dispose?.();for(let f of h)f.mesh.dispose?.();for(let f of d)f.dispose();for(let f of T.values())f.dispose()}}}return $r(ii);})();

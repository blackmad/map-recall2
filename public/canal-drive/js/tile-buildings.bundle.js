"use strict";var CanalRecallTileBuildings=(()=>{var He=Object.defineProperty;var Cr=Object.getOwnPropertyDescriptor;var Er=Object.getOwnPropertyNames;var Ir=Object.prototype.hasOwnProperty;var Dr=(e,t)=>{for(var n in t)He(e,n,{get:t[n],enumerable:!0})},Pr=(e,t,n,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of Er(t))!Ir.call(e,o)&&o!==n&&He(e,o,{get:()=>t[o],enumerable:!(r=Cr(t,o))||r.enumerable});return e};var Nr=e=>Pr(He({},"__esModule",{value:!0}),e);var wi={};Dr(wi,{RefCache:()=>ye,TileBuildings:()=>xe,coverUnion:()=>xt,mountRecipeTiles:()=>Mi,pandOfFace:()=>yt,recipeTilesBase:()=>Or,recipeTilesEnabled:()=>Fr,wantedTiles:()=>gt});var Mt={minFilter:"LinearMipmapLinear",magFilter:"Linear",generateMipmaps:!0};function Br(e,t){let n=t.coarse?128:256,r=e==="facadeCells"?Math.min(t.gpuMaxAnisotropy,t.coarse?4:16):4;return{...Mt,cellPx:n,anisotropy:r,tierScale:1}}function Gr(e,t){if(!t.enabled||t.coarse||t.tier!=="high")return Br(e,t);let n=Number.isFinite(t.gpuMaxAnisotropy)&&t.gpuMaxAnisotropy>=1?t.gpuMaxAnisotropy:1,r=Number(t.cellPx),o=Number.isInteger(r)&&r>256&&r<=512&&r%32===0?r:256,s=Number(t.facadeAnisotropy),a=e==="facadeCells"?Number.isFinite(s)&&s>=1?Math.min(s,16):4:16;return{...Mt,cellPx:o,anisotropy:Math.min(n,a),tierScale:o/256}}function Hr(){try{let e=globalThis,t=Number(e.__canalRecallTexAniso??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texAniso"):null)??NaN);return Number.isFinite(t)&&t>=1?t:null}catch{return null}}function Ur(){try{let e=globalThis,t=e.__canalRecallTexturePolicy??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texturePolicy"):null);return!(t===!1||t==="0"||t==="false"||t==="off")}catch{return!0}}function Wr(){try{let e=globalThis,t=Number(e.__canalRecallCellPx??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("cellPx"):null)??NaN);return Number.isFinite(t)&&t>0?t:null}catch{return null}}function $r(){let e=globalThis.__canalPerf?.tier;return e==="low"||e==="mid"||e==="high"?e:null}function Vr(){return!!globalThis.matchMedia?.("(pointer: coarse)").matches}function Me(e,t){return Gr(e,{tier:$r(),coarse:Vr(),gpuMaxAnisotropy:t,enabled:Ur(),cellPx:Wr(),facadeAnisotropy:Hr()})}var O={other:0,wall:1,roof:2,lid:3,trim:4,cornice:5,frontage:6,extrasStrip:7,extrasBox:8,extrasOther:9,shell:10},zr=[{name:"other",id:O.other,rgb:[0,0,0]},{name:"wall",id:O.wall,rgb:[255,255,255]},{name:"roof",id:O.roof,rgb:[255,0,0]},{name:"lid",id:O.lid,rgb:[128,0,128]},{name:"trim-decal",id:O.trim,rgb:[0,255,0]},{name:"cornice",id:O.cornice,rgb:[0,0,255]},{name:"frontage",id:O.frontage,rgb:[255,255,0]},{name:"extras-strip",id:O.extrasStrip,rgb:[255,0,255]},{name:"extras-box",id:O.extrasBox,rgb:[0,255,255]},{name:"extras-other",id:O.extrasOther,rgb:[128,128,0]},{name:"shell",id:O.shell,rgb:[0,128,128]}],wt=1,jr=2,qr=4e-6;var Yr=(e,t)=>e*t/2;function St(e){try{return typeof URLSearchParams=="function"?new URLSearchParams(globalThis.location?.search??"").get(e):null}catch{return null}}function Kr(){let t=globalThis.__canalRecallThinFade??St("thinFade");return!(t===!1||t==="0"||t==="false"||t==="off")}function Xr(){return(globalThis.__canalRecallThinDebug??St("thinDebug"))==="owner"?"owner":null}var ce=e=>Number.isInteger(e)?e.toFixed(1):String(e),Jr=e=>`vec3(${e.map(t=>(t/255).toFixed(4)).join(", ")})`,Zr=`
attribute vec2 thin;
varying float vThinM;
flat varying float vThinClass;
`,Qr=`
vThinM = thin.x * 0.01; vThinClass = thin.y;
#ifdef CITY_THIN_FADE
if (thin.y > ${ce(O.trim-.5)} && thin.y < ${ce(O.trim+.5)}) gl_Position.z -= ${qr.toExponential()} * gl_Position.w;
#endif
`,eo=`
uniform float thinFocalPx;
varying float vThinM;
flat varying float vThinClass;
vec3 thinOwnerColour(float c) {
${zr.map(e=>`  if (c < ${ce(e.id+.5)}) return ${Jr(e.rgb)};`).join(`
`)}
  return vec3(0.5);
}
`,to=`
#ifdef CITY_THIN_FADE
if (vThinM > 0.0) {
  float thinPx = vThinM * thinFocalPx / max(vFacDist, 0.01);
  float thinCover = clamp((thinPx - ${ce(wt)}) / ${ce(jr-wt)}, 0.0, 1.0);
  if (thinCover < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= thinCover) discard;
}
#endif
`,Rt=`
#ifdef CITY_THIN_OWNER
gl_FragColor = vec4(thinOwnerColour(vThinClass), 1.0);
#endif
`,Ue={value:1e3};function _t(e,t,n){let r="void main() {",o=/vFacDist = length\([^;]*\);/,s="if (HL_GHOST(vHighlight)) discard;";if(!e.includes(r)||!o.test(e)||!t.includes(r)||!t.includes(s))return null;let a=e.replace(r,`${Zr}${r}`).replace(o,u=>`${u}${Qr}`),i=t.replace(r,`${eo}${r}`).replace(s,`${s}${to}`);if(n){if(!i.includes("#include <dithering_fragment>"))return null;i=i.replace("#include <dithering_fragment>",`#include <dithering_fragment>${Rt}`)}else{let u=i.lastIndexOf("}");i=`${i.slice(0,u)}${Rt}${i.slice(u)}`}return{vertex:a,fragment:i}}function vt(e,t,n={}){let r=n.fade??Kr(),o=n.debug===void 0?Xr():n.debug;if(!r&&!o)return e;if(e.defines={...e.defines??{},...r?{CITY_THIN_FADE:""}:{},...o?{CITY_THIN_OWNER:""}:{}},e.defaultAttributeValues={...e.defaultAttributeValues??{},thin:[0,0]},t){let i=e.onBeforeCompile;e.onBeforeCompile=function(u,l){i?.call(this,u,l);let m=_t(u.vertexShader,u.fragmentShader,!0);m&&(u.vertexShader=m.vertex,u.fragmentShader=m.fragment,u.uniforms.thinFocalPx=Ue)}}else{let i=_t(e.vertexShader,e.fragmentShader,!1);if(!i)return e;e.vertexShader=i.vertex,e.fragmentShader=i.fragment,e.uniforms={...e.uniforms,thinFocalPx:Ue}}let s=e.onBeforeRender,a={x:0,y:0,set(i,u){return this.x=i,this.y=u,this},floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}};return e.onBeforeRender=function(i,u,l,...m){s?.call(this,i,u,l,...m);let f=i?.getDrawingBufferSize?i.getDrawingBufferSize(a).y:0,c=l?.projectionMatrix?.elements?.[5];f>0&&Number.isFinite(c)&&(Ue.value=Yr(c,f))},e.userData={...e.userData??{},thinFade:r,thinDebug:o},e}var Lt=e=>{let t=globalThis,n=new RegExp(`[?&]${e}=([^&]*)`).exec(t.location?.search??"");return n?decodeURIComponent(n[1]):null};function We(){let t=globalThis.__canalRecallDrawLimit??Lt("drawLimit");return t===!0||t==="1"||t==="true"||t==="on"?!0:!(t===!1||t==="0"||t==="false"||t==="off")}var no=e=>Number.isInteger(e)?`${e}.0`:`${e}`,At=`(fogNear * (1.0 + fract(fogFar) * ${no(8)}))`;var ro=!0;function Tt(){if(!We())return!1;let e=globalThis.__canalRecallLandmarkHaze??Lt("landmarkHaze");return e===!0||e==="1"||e==="true"||e==="on"?!0:e===!1||e==="0"||e==="false"||e==="off"?!1:ro}var kt="DEPTH_FADE_LIMIT_ONLY";var oo=.5,ao=.38,Ft=250,so=600,io=.4;function Ot(){let e=globalThis,t=typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("fadeStrength"):null,n=e.__canalRecallFadeStrength??t,r=n==null||n===""?NaN:Number(n);return Number.isFinite(r)?Math.max(0,Math.min(2,r)):1}var V=e=>Number.isInteger(e)?`${e}.0`:`${e}`;var lo=(e=Ot())=>`#ifdef USE_FOG
	float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	float fadeLuma = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( fadeLuma ), fogFactor * ${V(oo*e)} );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * ${V(ao*e)} );
#endif`,Ti=lo(1),Ct=`uniform vec3 fogColor;
	varying vec3 vFogEye;
	#define vFogDepth length( vFogEye )
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif`,ki=`#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
	${Ct}
#endif`,Et=`
#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
#define DEPTH_FADE_FOG_PARS
	${Ct}
#endif
`,It=(e,t=Ot(),n=We())=>{let r=n?At:"fogFar";return`${V(Math.min(1,t))} * smoothstep(max(${V(Ft)}, fogNear), max(max(${V(so)}, fogNear + (${r} - fogNear) * ${V(io)}), max(${V(Ft)}, fogNear) + 1.0), ${e})`};var uo="canalRecallDepthFadeOptOut";function Dt(e,t=Tt()){t&&e.fog!==!1?e.defines={...e.defines??{},[kt]:""}:e.fog=!1,e.userData={...e.userData??{},[uo]:!0}}var co=.7,mo=46,fo=null,ho=()=>fo??=[D["pantile-red"].hex,D["pantile-dark"].hex,K[0],K[1],D.gravel.hex,D["bitumen-dark"].hex,D["white-membrane"].hex];function po(e,t){let n=globalThis,r=n[t]??(typeof URLSearchParams=="function"?new URLSearchParams(n.location?.search??"").get(e):null);return r===!0||r==="1"||r==="true"||r==="on"}var bo=null;var $e=()=>bo??=po("roofFamily","__canalRecallRoofFamily");var go=(e,t)=>Math.hypot(e[0]-t[0],e[1]-t[1],e[2]-t[2]);function yo(e,t=ho(),n=mo){let r=M(e),o=null,s=n;for(let a of t){let i=go(r,M(a));i<=s&&(s=i,o=a)}return o}function Ve(e,t=co){let n=yo(e);if(!n)return e;let r=M(e),o=M(n);return w([0,1,2].map(s=>r[s]+(o[s]-r[s])*t))}function Pt(){let e=globalThis;return(e.__canalRecallLook??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("look"):null))==="toon"}var T=["#a8503a","#9a4a38","#8c4632","#b05a40","#7a3b2c"],me=["#2b2d2c","#2f4a3a","#5a2a26","#25344a"],X=["#e8dfc9","#f1eee6","#d3b184","#e2d5ba"],ze=[T[0],T[0],T[1],T[2],T[3],T[4],me[0],me[1],me[2],X[0],X[2]],Nt=["#2f4a3a","#25344a","#5a2a26","#2b2d2c","#e0a526"],Bt={canal:[T[4],T[4],T[1],T[2],me[0],me[1],X[0]],c19:[T[0],T[3],T[1],X[3],X[2],X[0]],school:[T[2],T[4],T[1],T[3]]},Gt=["#f1eee6","#f1eee6","#f1eee6","#e8dfc9","#e8dfc9","#2b2d2c","#2f4a3a","#5a2a26","#25344a","#8b8f8c"];function Ht(){if(!Pt())return!1;let e=globalThis;return(e.__canalRecallToonFronts??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("toonFronts"):null))!=="candy"}var de=225;var je={wallPull:.7,glassLift:.5,liftBrick:!0},Ut={wallPull:.35,glassLift:.25,liftBrick:!1},Bi={photo:{cells:"photo",shadeBands:0,flatColour:!1,...je,cartoonRoofCells:!1,outline:!1,litWallGain:255/de},procedural:{cells:"procedural",shadeBands:0,flatColour:!1,...je,cartoonRoofCells:!1,outline:!1,litWallGain:1},untextured:{cells:"procedural",shadeBands:0,flatColour:!0,...je,cartoonRoofCells:!1,outline:!1,litWallGain:1},storybook:{cells:"storybook",shadeBands:0,flatColour:!1,...Ut,cartoonRoofCells:!1,outline:!0,litWallGain:1,tone:{hueShift:-4,satMul:1.15,satAdd:0,keepDarkBelow:0,lightMul:1,lightAdd:.03,lightMax:.9}},cartoon:{cells:"cartoon",shadeBands:3,flatColour:!1,...Ut,cartoonRoofCells:!0,outline:!0,litWallGain:1,tone:{hueShift:0,satMul:1.7,satAdd:.08,keepDarkBelow:.35,lightMul:1.08,lightAdd:0,lightMax:.85}}};var z=(e,t,n)=>Math.max(t,Math.min(n,e));function M(e){let t=/^#?([0-9a-f]{6})$/i.exec(e.trim());if(!t)throw Error(`Bad colour ${e}`);let n=parseInt(t[1],16);return[n>>16&255,n>>8&255,n&255]}var w=e=>"#"+e.map(t=>Math.round(z(t,0,255)).toString(16).padStart(2,"0")).join("");function _([e,t,n]){let r=e/255,o=t/255,s=n/255,a=Math.max(r,o,s),i=Math.min(r,o,s),u=(a+i)/2;if(a===i)return[0,0,u];let l=a-i,m=u>.5?l/(2-a-i):l/(a+i);return[(a===r?(o-s)/l+(o<s?6:0):a===o?(s-r)/l+2:(r-o)/l+4)*60,m,u]}function k([e,t,n]){let r=(1-Math.abs(2*n-1))*t,o=r*(1-Math.abs(e/60%2-1)),s=n-r/2,[a,i,u]=e<60?[r,o,0]:e<120?[o,r,0]:e<180?[0,r,o]:e<240?[0,o,r]:e<300?[o,0,r]:[r,0,o];return[(a+s)*255,(i+s)*255,(u+s)*255]}var Zt=(e,t,n)=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n];var qe={canal:-1/0,c19:1860,school:1915,modern:1945};var K=["#76808f","#606b79","#8c939c"],fe={procedural:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:K},untextured:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:K},photo:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:K},storybook:{tile:["#b9553a","#a94a33","#c46a45"],slate:["#556070","#4a5666","#657282"]},cartoon:{tile:["#e85a3c","#f08a2b","#d94a3a"],slate:["#3f5f8f","#2f4a78","#4f7bb0"]}};var D={gravel:{hex:"#9e9281",luma:[112,156],cell:"flat"},"bitumen-dark":{hex:"#56585e",luma:[62,96],cell:"flat"},"bitumen-light":{hex:"#a99b84",luma:[150,182],cell:"flat"},"white-membrane":{hex:"#d9d9d3",luma:[196,228],cell:"flat"},"pantile-red":{hex:"#b5543a",luma:[84,124],cell:"tile"},"pantile-dark":{hex:"#6a5248",luma:[64,98],cell:"tile"},slate:{hex:"#76808f",luma:[62,140],cell:"slate"},zinc:{hex:"#9aa1a6",luma:[138,176],cell:"slate"},sedum:{hex:"#7a8350",luma:[96,132],cell:"flat"},solar:{hex:"#2e3a52",luma:[44,70],cell:"flat"},terrace:{hex:"#a38d74",luma:[124,162],cell:"flat"},glass:{hex:"#8fa3ad",luma:[130,170],cell:"flat"}},we={gravel:D.gravel.hex,membrane:D["white-membrane"].hex,bitumen:D["bitumen-dark"].hex,pebble:D["bitumen-light"].hex},Qt=[we.gravel,we.membrane,we.bitumen,we.pebble];var P={tile:fe.photo.tile,slate:fe.photo.slate,flat:Qt};var Wt=["#d9674a","#e58a5c","#eab85f","#f0dfb8","#e5a396","#9dbb9b","#7ea3c2","#c9714a","#f2c14e","#b9a1c9"],$t=["#2a8c8c","#e0a526","#d9453d","#2c4a7c","#7a3b6e","#2f6b45","#4aa3d9"],Vt={canal:{walls:Wt,accents:$t},c19:{walls:Wt,accents:$t},school:{walls:["#9c5a42","#8a4b3a","#a8664c","#7a4a40"],accents:["#2c4a7c","#2a8c8c","#e0a526"]},modern:{walls:["#f4efe6","#dcdcd6","#e9d9c0","#b9c4cc","#f0c9a9"],accents:["#2a8c8c","#d9453d","#2c4a7c","#e0a526"]}},zt=["#ffffff","#f2d9c8","#d9b9a4","#e6c9b0","#c9a38c","#f0e4d2","#ffd9b0","#e8c0b0","#d0c8c0"],jt=["#243a2f","#1f2a3a","#3a1f1c","#222222","#2f4a3c","#6b2b2b","#2c3e50"],qt={cartoon:Vt,storybook:Vt,photo:{canal:{walls:zt,accents:jt},c19:{walls:zt,accents:jt},school:{walls:["#b89080","#a88070","#9c7868"],accents:["#1f2a3a","#243a2f","#3a1f1c"]},modern:{walls:["#f2f2ee","#d8d8d2","#e8dcc8","#c8d0d4"],accents:["#2c3e50","#6b2b2b","#243a2f"]}}};var Yt=["#e8573d","#e8573d","#ee7f2c","#f2b92e","#f2b92e","#2a9d8f","#4672b0","#f3e6c8","#d96a4d"],Z={photo:{canal:["#7a3b2c","#7a3b2c","#6b3428","#8c4632","#9a5846","#b05a40","#4a2e26","#2e2a27","#3e4a40","#5d605a","#e4ddcd"],c19:["#b05a40","#b05a40","#bd6a45","#a24d38","#c58b5e","#d3b184","#e2d5ba","#e2d5ba","#d9c5a4","#9a5846"],school:["#8c4a38","#7a4535","#9a5240","#6e3d33","#a85a3c","#5e3a32","#b0603f"],modern:["#c9b79a","#b9ad9a","#a8a49c","#d3c6ad","#8f8a82","#bfb3a0","#9c7a62","#b05a40"]},storybook:{canal:["#b9583f","#9a4a38","#7a4a3c","#4a5048","#3f4a5a","#ead9b0","#c8664a"],c19:["#c8664a","#d98b5f","#e0b36a","#ead9b0","#d9b995","#c9a08c","#c8664a"],school:["#a8553f","#9a5a48","#b87a5c","#c8664a","#8a4e40"],modern:null},cartoon:{canal:["#d9453d","#a8433a","#3b3b4a","#2a9d8f","#4672b0","#fffaf0","#e8573d"],c19:["#e8573d","#ee7f2c","#f2b92e","#f3e6c8","#d96a4d","#f2b92e"],school:["#d96a4d","#e8573d","#b9583f","#ee7f2c"],modern:null}},xo={photo:["#f1eee6","#f1eee6","#f1eee6","#e8dfc9","#e8dfc9","#2b2d2c","#2f4a3a","#5a2a26","#25344a","#8b8f8c"],storybook:["#f6f1e4","#f6f1e4","#f6f1e4","#efe2c2","#efe2c2","#3a3d3c","#3f6a52","#8a3b33","#3a527a","#a3a8a4"],cartoon:["#fffaf0","#fffaf0","#fffaf0","#ffe9b8","#ffe9b8","#3b3b4a","#2a9d8f","#d9453d","#4672b0","#f2b92e"]};if(Ht()){for(let t of["canal","c19","school"])Z.cartoon[t]=Bt[t];let e={walls:[...ze],accents:[...Nt]};qt.cartoon={canal:e,c19:e,school:e,modern:qt.cartoon.modern},Yt.splice(0,Yt.length,...ze),xo.cartoon=Gt}var Mo={canal:{label:"canal-house centre (before 1860)",wall:Z.photo.canal[0],roof:fe.photo.tile[0]},c19:{label:"19th-century ring (1860-1914)",wall:Z.photo.c19[0],roof:fe.photo.tile[1]},school:{label:"Amsterdamse School (1915-1944)",wall:Z.photo.school[0],roof:fe.photo.slate[0]},modern:{label:"post-war and contemporary (1945+)",wall:Z.photo.modern[0],roof:Qt[0]}};var en=["brick","stucco","accent","stone","frame","door","glass","roofTile","slate","bitumen","paint"],Ye={brick:"brick",accent:"brick",stucco:"stucco",stone:"stone",frame:"frame",door:"door",glass:"glass",roofTile:"tile",slate:"slate",bitumen:"flat",paint:"frame"},E={brick:3.36,stucco:2.4,accent:3.36,stone:1.28,frame:1,door:1,glass:1,roofTile:1.2,slate:1.2,bitumen:1.2,paint:1},G=[.3,.6],wo="#f1ede2",Ro="#cfc8b8";function _o(e){let[t,n,r]=_(M(e)),o=z(.12+r*.9,G[0],G[1]);return w(k([t,z(n,.12,.5),o]))}function So(e){let[t,n,r]=_(M(e));return w(k([t,z(n,0,.55),z(r*1.06+.03,.4,.97)]))}function vo(e){let t=M(e),[n,r,o]=_(t);return o>=.5?w(Zt(t,M(wo),.75)):w(k([n,r,Math.max(o,.16)]))}function Lo(e){let[t,n,r]=_(M(e));return w(Zt(k([t,n,Math.max(r,.62)]),M(Ro),.45))}function Ao(e){let[t,n,r]=_(M(e));return r>=.17?e.startsWith("#")?e.toLowerCase():"#"+e.toLowerCase():w(k([t,n<.15?0:n,.17]))}function To(e,t){let n=_(M(t))[2];if(e==="roofTile"){let[r,o]=_(M(t));return o<.2?P.slate[1]:w(k([r,z(o*1.1,.35,.6),z(.2+n*.85,.38,.5)]))}return e==="slate"?n<.27?P.slate[1]:n<.31?P.slate[0]:P.slate[2]:n<.4?P.flat[2]:P.flat[0]}var J="measured",ko=.18,Fo=de/255;function Oo(e){let[t,n,r]=_(M(e)),[o,s,a]=M(w(k([t,n,Math.max(r,ko)])));return w([o,s,a].map(i=>Math.min(255,Math.round(i/Fo))))}var j=32,q=64,B=[157.19,92.83,69.17],tn=240.95,nn=.16,Co=255/(B[0]+(tn-B[0])*nn);function Ke(e,t){let n=t/(q-1),r=n<.5?B[0]+(B[1]-B[0])*(n/.5):B[1]+(B[2]-B[1])*((n-.5)/.5),o=5-15*t/35,s=17-15*t/35,a=t<35&&e+.5>=o&&e+.5<s;return Math.min(255,Math.round((a?r+(tn-r)*nn:r)*Co))}var Eo=(()=>{let e=0;for(let t=0;t<q;t++)for(let n=0;n<j;n++)e+=Ke(n,t);return e/(j*q)})(),Kt=.4;function Io(e){let[t,n,r]=_(M(e)),s=(r>=Kt?M(e):k([t,n,Kt])).map(i=>i/(Eo/255)),a=Math.max(1,...s.map(i=>i/255));return w(s.map(i=>Math.min(255,Math.round(i/a))))}var Do=228/255;function Po(e){return w(M(e).map(t=>Math.min(255,Math.round(t/Do))))}function Xt(e){return w(M(e))}function Jt(e){return w(M(e))}var No=["brick","accent","glass","stone","bitumen","slate","roofTile"],rn=(e,t)=>t===J&&No.includes(e);function Re(e,t,n){if(n===J&&(e==="brick"||e==="accent"))return Oo(t);if(n===J&&e==="glass")return Io(t);if(n===J&&e==="stone")return Po(t);if(n===J&&e==="bitumen")return $e()?Ve(Xt(t)):Xt(t);if(n===J&&(e==="slate"||e==="roofTile"))return $e()?Ve(Jt(t)):Jt(t);switch(e){case"brick":case"accent":return _o(t);case"stucco":return So(t);case"stone":return Lo(t);case"frame":return vo(t);case"door":return Ao(t);case"glass":return"#ffffff";case"paint":return t.startsWith("#")?t.toLowerCase():"#"+t.toLowerCase();default:return To(e,t)}}var Xe={asphalt:{base:[86,88,93]},cycle:{base:[150,66,58]},klinker:{base:[122,90,80],joint:"#4b3d38"},pavement:{base:[174,162,152],joint:"#7f756b"},kerb:"#cfcac0",paint:"#f2f0ea",rail:"#6c6e72",bollard:"#5a2a26"},on="#ffd21f",an="#ff8033",sn="#b4682c";var ln={land:{base:[168,158,142],joint:"#857b6d"},paving:{base:[184,174,158],joint:"#8f8577"},square:{base:[190,179,161],joint:"#958a7c"},klinker:{base:[158,124,114],joint:"#7a6660"},asphalt:[68,72,80],cycle:[156,76,66],gravel:[180,166,136],park:[96,140,70],wood:[70,112,58],parking:[102,102,105],kerb:"#aaa498",water:"#46707c",lawn:[110,154,74],bed:{soil:[98,80,60],leaf:[84,122,58]},shrub:{base:[56,92,46],leaf:[76,116,56]},bark:[118,84,58],sand:[212,194,150],parkGravel:[198,184,152],parkPath:[110,110,112],pond:"#46707c"};var un="inferred",Bo=e=>_(M(e))[1]<.2,Go=e=>{let[t,n,r]=_(M(e));return(t<45||t>340)&&n>=.15&&r<.7},Ho=e=>Bo(e)?"slate":"roofTile",Je=e=>Go(e)?"brick":"stucco",Uo=[{test:/glass|glaz|window|vitr|ruit|pane/,slot:"glass",confidence:"name",rule:"glazing name"},{test:/decal|sign|mural|logo|letter|clock|dial/,slot:"paint",confidence:"name",rule:"signage / decal"},{test:/door|deur|gate/,slot:"door",confidence:"name",rule:"door name"},{test:/frame|kozijn|louvre|louver|blind|shutter|rail|mullion|sash/,slot:"frame",confidence:"name",rule:"joinery name"},{test:/brick|baksteen|klinker|terracotta/,slot:"brick",confidence:"name",rule:"brick name"},{test:/slate|leien|lei$/,slot:"slate",confidence:"name",rule:"slate name"},{test:/bitumen|asphalt|tar$|felt|flatroof|flat-roof|gravel/,slot:"bitumen",confidence:"name",rule:"flat roof name"},{test:/roof|tile|pantile|dakpan|dak/,slot:Ho,confidence:"name",rule:"roof name, grey \u2192 slate, else pantile"},{test:/sandstone|stone|steen|column|marble|granite|limestone|plinth/,slot:"stone",confidence:"name",rule:"stone name"},{test:/stucco|render|plaster|pleister|concrete|beton|slab/,slot:"stucco",confidence:"name",rule:"render / concrete name"},{test:/gold|gilt|bronze|copper|brass|zinc|metal|steel|iron|lead|alu/,slot:"paint",confidence:"name",rule:"metal name (flat colour)"},{test:/wall|facade|gevel/,slot:Je,confidence:"name",rule:"wall name, brick hue \u2192 brick, else stucco"},{test:/ochre|yellow|buff/,slot:Je,confidence:"colour-word",rule:"ochre: yellow brick (brick hue) or render"},{test:/pink|rose/,slot:"stucco",confidence:"colour-word",rule:"pink: painted render"},{test:/moss|grass|green|blue|orange|purple|paint|teal/,slot:"paint",confidence:"colour-word",rule:"coloured paint word"},{test:/white|cream|ivory/,slot:"stucco",confidence:"colour-word",rule:"white: stucco (could be white trim)"},{test:/dark|black|charcoal|anthracite/,slot:"frame",confidence:"colour-word",rule:"dark: painted joinery / ironwork (could be a dark wall)"},{test:/red/,slot:Je,confidence:"colour-word",rule:"red: brick hue \u2192 brick (could be red tile or paint)"},{test:/grey|gray/,slot:"stucco",confidence:"colour-word",rule:"grey: render (could be concrete or zinc)"}];function cn(e){return String(e??"").toLowerCase().replace(/[-_.\s]*\d+$/,"").trim()}function Wo(e){let[t,n,r]=_(M(e));return r<.22?{slot:"frame",rule:"very dark: joinery / ironwork"}:n>=.15&&(t<45||t>340)&&r<.62?{slot:"brick",rule:"brick hue"}:n<.2&&r>=.6?{slot:"stucco",rule:"pale neutral: render"}:n<.2&&r>=.22&&t>180&&t<260?{slot:"slate",rule:"blue-grey: slate"}:n<.25?{slot:"stone",rule:"neutral mid-tone: stone"}:{slot:"paint",rule:"saturated colour: paint"}}function mn(e,t){let n=t.toLowerCase(),r=cn(e);for(let s of Uo)if(s.test.test(r))return{slot:typeof s.slot=="function"?s.slot(n):s.slot,tint:n,confidence:s.confidence,rule:s.rule};let o=Wo(n);return{slot:o.slot,tint:n,confidence:"colour",rule:`no material word in "${r||"unnamed"}"; ${o.rule}`}}var fn=e=>/white|cream|ivory/.test(cn(e)),dn=e=>typeof e=="string"&&en.includes(e);var bn={ribs:{pitch:.5,min:.25,max:2,w:.09,out:.04},boards:{pitch:.4,min:.15,max:1.5,w:.05,out:.035},louvres:{pitch:.35,min:.2,max:1,w:.12,out:.12},panels:{pitch:1.2,min:.6,max:6,w:.05,out:.035}};var wl={min:.15,max:bn.ribs.max};var gn={canal:["#6e5352","#8c7768","#977f73","#a79276","#b8a17a","#575245","#60564b","#62544d","#61584c","#655850","#655b50","#6a5454","#6f6058","#726359","#726459","#76615d","#77685d","#7a6c60","#826c66","#918174","#9a887f","#a89f8a","#6b6163","#dfdcd2"],c19:["#70564f","#6f5b52","#7a665c","#86695b","#886a5f","#857266","#8b746d","#9b887e","#a38e83","#ad9585","#61534a","#63564e","#685b52","#6f6057","#716259","#75665c","#7b6961","#7c6962","#7f6a64","#7f7664","#8e796f","#9c9181","#95787e","#dad8cf"],school:["#665247","#775744","#735d52","#786158","#8c5957","#896559","#856f63","#9d7f6d","#ad997f","#5c4f48","#61564c","#67564e","#6b5554","#6b5851","#6b5b50","#716057","#745e5b","#75655c","#78665f","#806d64","#89706b","#a19888","#614a4e","#a4a09f"],modern:["#715d53","#7c6459","#816b64","#8f7265","#9c8980","#ac9a86","#60594c","#635c4e","#6a5a50","#6c5a54","#6c5e55","#6e6256","#72675a","#776a5d","#7b6a61","#7f6f64","#807265","#886f6b","#8b7d6d","#958b79","#a29189","#695256","#a59b8d","#c8c5ba"]};var Ze={"#4f4834":[215,215,215],"#463823":[216,215,215],"#5f5950":[215,215,215],"#a69873":[215,215,215],"#57423e":[215,215,215],"#473c3b":[215,215,215],"#5d5d5c":[214,215,215],"#7e573b":[215,215,215],"#705449":[215,215,215],"#7f8283":[215,214,215],"#796764":[215,215,215],"#5d534b":[215,215,215],"#7d6e52":[215,215,215],"#88735e":[215,215,215],"#88715f":[215,215,215],"#736352":[215,215,215],"#241d1c":[172,172,172],"#4b3f37":[215,215,215],"#615551":[215,215,215],"#595651":[214,215,214],"#423931":[215,215,215],"#7b6d6a":[215,214,216],"#382418":[215,215,215],"#866343":[215,215,215],"#6e6256":[215,215,215],"#625650":[205,205,205],"#252c24":[185,185,186],"#2d281b":[215,214,215],"#3b342b":[215,215,215],"#6f5c56":[215,215,215],"#393535":[215,215,215],"#786357":[215,215,215],"#383d43":[205,215,215],"#554e4a":[215,216,215],"#3d3432":[215,215,215],"#3d353c":[215,215,215],"#4e443f":[215,215,215],"#70574d":[207,207,207],"#d49662":[215,215,215],"#917b5c":[215,215,215],"#494341":[215,215,215],"#645f5f":[215,215,214],"#342a18":[215,215,215],"#825746":[215,216,215],"#99604e":[212,215,215],"#706868":[215,215,215],"#786b61":[215,215,214],"#5c5b57":[215,215,215],"#7a655b":[215,215,215],"#6f5b54":[215,215,215],"#4a3f3a":[215,214,215],"#614f44":[216,215,215],"#654e44":[215,215,215],"#6f5f53":[215,215,216],"#584d49":[215,215,215],"#d3c9b2":[215,215,215],"#544b46":[215,215,215],"#929289":[215,215,215],"#68584f":[215,215,216],"#574d47":[215,215,215],"#5e4e41":[215,215,215],"#6e605a":[215,215,215],"#605d5c":[215,215,215],"#8c7a6f":[215,215,215],"#4a3832":[165,165,166],"#81614f":[215,215,215],"#3d3533":[215,215,215],"#6d5351":[215,215,215],"#5c3d33":[214,214,215],"#906553":[215,215,215],"#65493d":[215,215,215],"#8e5f49":[215,215,215],"#8c6858":[215,215,215],"#8b5946":[215,215,215],"#665253":[209,209,209],"#3e3222":[215,215,215],"#000000":[197,198,197],"#7b081b":[215,215,215],"#383131":[215,215,215],"#3d3b37":[211,215,215],"#877d76":[214,215,215],"#191d0c":[215,214,213],"#bcab88":[215,215,215],"#656462":[215,215,215],"#3f3634":[174,174,175],"#463e3c":[197,197,198],"#453d3a":[177,177,176],"#1f1a1b":[156,156,157],"#615450":[214,215,215],"#5b4f4b":[215,215,215],"#574c4a":[215,215,215],"#413333":[215,215,215],"#7b5c53":[215,215,215],"#5f342b":[216,215,215],"#4e2422":[215,215,215],"#5b4b44":[209,209,209],"#493d32":[215,215,215],"#6a5048":[216,216,215],"#5e5855":[215,215,215],"#5e3f35":[215,215,215],"#68564f":[215,215,215],"#6b3e33":[215,214,215],"#5f3c30":[215,214,215],"#929191":[215,215,215],"#a2acb3":[215,215,215],"#8f7b65":[215,215,215],"#988e7d":[215,215,215],"#726d60":[215,215,215],"#584c45":[215,214,215],"#594643":[216,215,215],"#5e5750":[212,215,215],"#78645b":[215,215,215],"#484440":[215,215,215],"#73645e":[215,215,215],"#5c4f47":[215,215,215],"#3c3d39":[215,215,215],"#645451":[215,215,214],"#37333d":[179,179,178],"#a6856f":[215,215,215],"#574d4d":[205,205,205],"#393737":[215,215,215],"#6f4a3b":[215,214,215],"#ffa169":[212,215,215],"#576465":[216,215,216],"#71614a":[215,215,215],"#6c584f":[215,215,215],"#5b463e":[215,216,215],"#765e52":[214,215,215],"#4f4e4c":[215,215,215],"#544945":[215,215,215],"#504140":[194,195,194],"#51514f":[215,215,215],"#74665f":[215,215,215],"#735c59":[215,215,215],"#474d56":[215,215,215],"#7d6e5a":[215,215,215],"#514a43":[215,215,215],"#4e4e49":[215,215,215],"#745c51":[215,215,215],"#47403c":[215,215,215],"#4c3a37":[215,215,215],"#675d5a":[215,215,215],"#574e48":[215,215,215],"#686360":[215,215,215],"#4a413f":[215,215,215],"#423735":[215,215,215],"#756860":[215,215,215],"#5e5144":[215,215,215]};var Mu={street:{...Xe,brick:Xe.klinker},tones:ln};var Jo=["sunny","legacy"],Zo="sunny";function H(e){let t=globalThis,r=/[?&]look=([\w-]+)/.exec(e??t.location?.search??"")?.[1]??t.__canalRecallLook;return Jo.includes(r??"")?r:Zo}var te=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},Qo=e=>255*(e<=.0031308?e*12.92:1.055*e**(1/2.4)-.055),Y=e=>{let t=parseInt(e.replace("#",""),16);return[t>>16&255,t>>8&255,t&255]},Qe=e=>"#"+e.map(t=>Math.round(Math.max(0,Math.min(255,t))).toString(16).padStart(2,"0")).join(""),ea=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],ee=e=>ea(Y(e).map(te)),ta=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],na={zenith:"#9ec3ed",horizon:"#a1c6e5"};function ra(e){let t=e.sunElevationDeg*Math.PI/180,n=ee(e.sunColour)*e.sunIntensity/Math.PI,r=ee(e.skyColour)*e.skyIntensity/Math.PI,o=ee(e.groundColour)*e.skyIntensity/Math.PI,s=(r+o)/2;return{flat:n*Math.sin(t)+r,sunWall:n*Math.cos(t)+s,shadeWall:s}}var oa=.55;function aa(e="#ffe2bf",t="#aca497",n=oa){let r=40*Math.PI/180,o=u=>{let l=Qe(Y(na.horizon).map(d=>d+(255-d)*u)),m=ee(e)*2.15/Math.PI*Math.cos(r),f=(ee(l)+ee(t))/2/Math.PI,c=n*m/(1-n)/f;return{sunColour:e,sunIntensity:2.15,skyColour:l,groundColour:t,skyIntensity:c,sunElevationDeg:40}},s=u=>{let l=o(u),m=Y(l.sunColour).map(te),f=Y(l.skyColour).map(te),c=[0,2].map(d=>m[d]*l.sunIntensity*Math.sin(r)+f[d]*l.skyIntensity);return c[0]/c[1]},a=0,i=1;for(let u=0;u<40;u++){let l=(a+i)/2;s(l)<1?a=l:i=l}return{...o(i),whiteMix:+i.toFixed(3)}}var Q=aa(),yn=1/ra(Q).sunWall,wn={sunColour:Q.sunColour,sunIntensity:+(Q.sunIntensity*yn).toFixed(4),skyColour:Q.skyColour,groundColour:Q.groundColour,skyIntensity:+(Q.skyIntensity*yn).toFixed(4)},xn=[.85,1.6],sa=e=>typeof e=="string"?Y(e):e;function et(e){let t=e?te(219)/te(ta(sa(e))):1.106;return Math.max(xn[0],Math.min(xn[1],t))}function ne(e,t){let n=Y(e).map(o=>te(o)*t),r=Math.max(1,...n);return Qe(n.map(o=>Qo(o/r)))}function Mn(e,t=Ze[e.toLowerCase()]){return ne(e,et(t))}function Rn(e,t,n,r=H(),o){return r!=="sunny"||n!=="measured"||e!=="brick"&&e!=="accent"?t:o?Mn(t,o):Mn(t)}var Lu=(()=>{let e=Object.keys(Ze).map(Y),t=n=>n.slice().sort((r,o)=>r-o)[n.length>>1];return Qe([0,1,2].map(n=>t(e.map(r=>r[n]))))})();var la=2,ua=.62;function ca(e,t=la){let n=ne(e,t);if(_(M(e))[2]>=ua)return n;let[r,o,s]=_(M(n));return s<=G[1]?n:w(k([r,o,G[1]]))}var ma=e=>Object.fromEntries(Object.entries(e).map(([t,n])=>[t,n?n.map(r=>ca(r)):null])),Du=ma(gn);var fa={anonymous:"This building has no name or date in the map data.",named:"The map data has no date for this building.",place:"A mapped place; the map data has no date for its building."},Uu=new Set(Object.values(fa));var _n=["canal","c19","school","postwar","modern","tower"];var pa=8;var dc=16+Math.log2(pa);var R=256,ba=["upper","ground","door","plain","shop"],ga=2;var gc=_n.length*ga*ba.length;var C=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16));var yc=C("#7d93a0"),xc=C("#1f2a33");var Mc=C("#b8ad98"),wc=C("#cfc6b4"),Rc=C("#ece8dd"),_c=C("#e2d9c2"),Sc=[C("#2c4a3d"),C("#3a2a22"),C("#1f3b57"),C("#5a2a24")],vc=[C("#2f4a3a"),C("#7a2f27"),C("#27384f")];var Sn=.6;function Se(e,t,n){let r=Math.imul(e|0,374761393)^Math.imul(t|0,668265263)^Math.imul(n|0,2246822519);return r=Math.imul(r^r>>>13,1274126177),((r^r>>>16)>>>0)/4294967296}function vn(e,t){let n=0;for(let o=0;o<e.length;o+=4)n+=e[o];let r=n/(e.length/4);for(let o=0;o<e.length;o+=4){let s=Math.round(Math.max(0,Math.min(255,r+(e[o]-r)*t)));e[o]=e[o+1]=e[o+2]=s}}function Ln(e,t){let n=new Uint8ClampedArray(R*R*4),r=(o,s,a,i,u)=>{let l=(s*R+o)*4,m=u??[a,a,a];n[l]=m[0],n[l+1]=m[1],n[l+2]=m[2],n[l+3]=i};if(e==="flat")for(let o=0;o<R;o++)for(let s=0;s<R;s++)r(s,o,Math.round((t?.96:.9+(Se(s>>3,o>>3,3)-.5)*.08)*255),255);else if(e==="tile"){let a=R/8,i=R/5;for(let u=0;u<R;u++)for(let l=0;l<R;l++){let m=Math.floor(u/a),f=u%a/a,c=(l+m%2*i*.5)%R,d=Math.floor(c/i),h=c%i/i,p=Math.sin(h*Math.PI),y=t?.92:.7+.22*p-.28*Math.pow(Math.max(0,1-f*3.2),1.5)*0-.22*Math.max(0,(.18-f)/.18);t||(y+=(Se(d,m,7)-.5)*.14);let b=t?f<.07||h<.035||h>.965:!1;r(l,u,Math.round(Math.max(0,Math.min(1,b?.28:y))*255),255)}t||vn(n,Sn)}else if(e==="slate"){let a=R/11,i=R/6;for(let u=0;u<R;u++)for(let l=0;l<R;l++){let m=Math.floor(u/a),f=u%a/a,c=(l+m%2*i*.5)%R,d=Math.floor(c/i),h=c%i/i,p=t?.9:.82+(Se(d,m,11)-.5)*.16-.16*Math.max(0,(.16-f)/.16);(h<(t?.05:.025)||f<(t?.09:.04))&&(p=t?.3:p*.7),r(l,u,Math.round(Math.max(0,Math.min(1,p))*255),255)}t||vn(n,Sn)}else for(let u=0;u<R;u++)for(let l=0;l<R;l++){let m=l/R,f=u/R,c=m>.2-.06&&m<.8+.06&&f>.2-.06&&f<.82+.06,d=m>.2+.03&&m<.8-.03&&f>.2+.03&&f<.82-.03,h=Math.abs(m-.5)<.018||Math.abs(f-.5)<.018;if(d&&!h){let p=(f-.2)/.6199999999999999,y=t?[150+60*p,200+30*p,235]:[40+80*p*p,55+90*p*p,68+90*p*p];r(l,u,0,0,[y[0],y[1],y[2]])}else if(c)r(l,u,0,0,t?[255,250,240]:[236,232,221]);else{let p=t?.92:.85+(Se(l>>3,u>>3,5)-.5)*.12,y=t&&(l<5||u<5||l>R-6||u>R-6);r(l,u,Math.round((y?.3:p)*255),255)}}return n}function An(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let m=0;m<336;m+=112)o.drawImage(t,m,l,112,112);else{let l=7,m=()=>(l=l*16807%2147483647)/2147483647;for(let f=0,c=0;c<336;c+=14,f++)for(let d=-(f%2)*24;d<336;d+=48){let h=150+m()*50;o.fillStyle=`rgb(${h},${h*.92},${h*.86})`,o.fillRect(d,c,48,14)}}o.strokeStyle="rgba(235,223,205,0.18)",o.lineWidth=1.7;for(let l=0,m=6;m<336;m+=14,l++){o.beginPath(),o.moveTo(0,m),o.lineTo(336,m),o.stroke();for(let f=l%2*24;f<336;f+=48)o.beginPath(),o.moveTo(f,m),o.lineTo(f,m+14),o.stroke()}let s=o.getImageData(0,0,336,336),a=s.data,i=0;for(let l=0;l<a.length;l+=4)i+=(a[l]+a[l+1]+a[l+2])/3;i/=a.length/4;let u=i>0?Math.min(2.4,225/i):1;for(let l=0;l<a.length;l+=4){let m=(a[l]+a[l+1]+a[l+2])/3,f=Math.min(255,(m+(i-m)*.7)*u);a[l]=a[l+1]=a[l+2]=f,a[l+3]=255}return o.putImageData(s,0,0),r}function Tn(e){let t=e.createElement("canvas");t.width=64,t.height=128;let n=t.getContext("2d"),r=n.createLinearGradient(0,0,0,128);return r.addColorStop(0,"#8aa1b0"),r.addColorStop(.5,"#4d606c"),r.addColorStop(1,"#3c474e"),n.fillStyle=r,n.fillRect(0,0,64,128),n.fillStyle="rgba(235,242,248,0.16)",n.beginPath(),n.moveTo(10,0),n.lineTo(34,0),n.lineTo(4,70),n.lineTo(-20,70),n.closePath(),n.fill(),t}function kn(e){let t=e.createElement("canvas");t.width=j,t.height=q;let n=t.getContext("2d"),r=n.createImageData(j,q);for(let o=0;o<q;o++)for(let s=0;s<j;s++){let a=(o*j+s)*4,i=Ke(s,o);r.data[a]=r.data[a+1]=r.data[a+2]=i,r.data[a+3]=255}return n.putImageData(r,0,0),t}function Fn(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d");n.fillStyle="#ffffff",n.fillRect(0,0,128,128),n.fillStyle="rgba(0,0,0,0.10)";for(let r=0;r<128;r+=16)n.fillRect(r,0,1.5,128);return t}function On(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=23,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++){let i=(s()-.5)*3;for(let u=0;u<128;u++){let l=(a*128+u)*4,m=s()<.012?-14:0,f=243+(s()-.5)*8+i+m;r.data[l]=r.data[l+1]=r.data[l+2]=f,r.data[l+3]=255}}return n.putImageData(r,0,0),t}function Cn(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=11,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<r.data.length;a+=4){let i=228+(s()-.5)*16;r.data[a]=r.data[a+1]=r.data[a+2]=i,r.data[a+3]=255}return n.putImageData(r,0,0),n.fillStyle="rgba(80,70,60,0.18)",n.fillRect(0,0,128,1.5),t}function ve(e,t){let n=Ln(t,!1),r=Math.round(Math.sqrt(n.length/4)),o=e.createElement("canvas");o.width=o.height=r;let s=o.getContext("2d"),a=s.createImageData(r,r);for(let i=0;i<n.length;i+=4)a.data[i]=n[i],a.data[i+1]=n[i+1],a.data[i+2]=n[i+2],a.data[i+3]=255;return s.putImageData(a,0,0),o}var ya=238;function En(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let m=0;m<336;m+=112)o.drawImage(t,m,l,112,112);else{let l=13,m=()=>(l=l*16807%2147483647)/2147483647;for(let f=0,c=0;c<336;c+=14,f++)for(let d=-(f%2)*24;d<336;d+=48){let h=165+m()*30;o.fillStyle=`rgb(${h},${h*.93},${h*.88})`,o.fillRect(d,c,48,14)}}o.strokeStyle="rgba(245,240,230,0.26)",o.lineWidth=1.2;for(let l=0,m=6;m<336;m+=14,l++){o.beginPath(),o.moveTo(0,m),o.lineTo(336,m),o.stroke();for(let f=l%2*24;f<336;f+=48)o.beginPath(),o.moveTo(f,m),o.lineTo(f,m+14),o.stroke()}let s=o.getImageData(0,0,336,336),a=s.data,i=0;for(let l=0;l<a.length;l+=4)i+=(a[l]+a[l+1]+a[l+2])/3;i/=a.length/4;let u=i>0?Math.min(2.6,ya/i):1;for(let l=0;l<a.length;l+=4){let m=(a[l]+a[l+1]+a[l+2])/3,f=Math.min(255,(m+(i-m)*.82)*u);a[l]=a[l+1]=a[l+2]=f,a[l+3]=255}return o.putImageData(s,0,0),r}function In(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=31,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++)for(let i=0;i<128;i++){let u=(a*128+i)*4,l=246+(s()-.5)*3;r.data[u]=r.data[u+1]=r.data[u+2]=l,r.data[u+3]=255}return n.putImageData(r,0,0),t}function Dn(e){let t=e.createElement("canvas");t.width=t.height=4;let n=t.getContext("2d");return n.fillStyle="#fff",n.fillRect(0,0,4,4),t}var Ma="highlight",wa="__canalRecallHighlight",Ra="highlightAccent",_a="__canalRecallHighlightAccent",Le={yellow:{keepMaterials:!1,outline:!1,rim:!1,desaturate:!1,ring:!1,beacon:!1,wash:!1,animated:!1},a:{keepMaterials:!0,outline:!0,rim:!1,desaturate:!1,ring:!0,beacon:!0,wash:!0,animated:!1},b:{keepMaterials:!0,outline:!1,rim:!0,desaturate:!1,ring:!0,beacon:!1,wash:!1,animated:!0},c:{keepMaterials:!0,outline:!1,rim:!1,desaturate:!0,ring:!0,beacon:!1,wash:!1,animated:!1}};var Sa=60,U=.4,re=2,at=3.5,Pn=100,va=300;var La=.75,tt=.35,Aa="__canalRecallHighlightBoost";function Nn(){let e=Number(globalThis[Aa]);return Number.isFinite(e)?Math.min(1,Math.max(0,e)):0}var nt="__canalRecallHighlightExtent";function Wn(){let e=globalThis;return e[nt]instanceof Map?e[nt]:e[nt]=new Map}var Ta=.3,ka=2.4,Fa=.9,Oa=2.2,Ae={drawn:0,hide:1,highlight:2,dim:3,ghost:4},Ca=.28;function Bn(e){if(typeof e!="string")return null;let t=e.trim().toLowerCase();return t==="a"||t==="outline"?"a":t==="b"||t==="rim"?"b":t==="c"||t==="desaturate"?"c":t==="yellow"||t==="0"||t==="off"||t==="old"?"yellow":t==="default"?rt:null}var rt="a";function ae(e){try{let t=globalThis;if(e===void 0){let n=Bn(t[wa]);if(n)return n}return Bn(new URLSearchParams(e??t.location?.search??"").get(Ma))??rt}catch{return rt}}var $n=(e=ae())=>Le[e];function Vn(e=ae(),t){if(e==="yellow")return on;try{let n=globalThis,r=(t===void 0?n[_a]:void 0)??new URLSearchParams(t??n.location?.search??"").get(Ra);if(r==="hud")return sn;if(typeof r=="string"&&/^#?[0-9a-f]{6}$/i.test(r))return r.startsWith("#")?r:`#${r}`}catch{}return an}function st(e=ae()){return Le[e].keepMaterials?{HL_KEEP:""}:{}}var it=`
#ifdef HL_KEEP
#define HL_PAINT(h) false
#else
#define HL_PAINT(h) ((h) > 0.5 && (h) < 1.5)
#endif
#define HL_GHOST(h) ((h) > 2.5 && fract(dot(floor(gl_FragCoord.xy), vec2(0.569840296, 0.754877666))) >= ${Ca.toFixed(3)})
float hlState(float hidden) { return hidden > 3.5 ? 3.0 : (hidden > 2.5 ? 2.0 : (hidden > 1.5 ? 1.0 : 0.0)); }
vec3 hlDesat(vec3 c, float h) { return h > 1.5 && h < 2.5 ? mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), ${U.toFixed(2)}) : c; }`,Ea=110540,Ia=e=>111320*Math.cos(e*Math.PI/180);function Da(e,t){let n=(e[1]+t[1])/2;return Math.hypot((e[0]-t[0])*Ia(n),(e[1]-t[1])*Ea)}var zn=(e,t,n=Sa)=>!!e&&Da(e,t)<=n;var Gn=`
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
  float far = clamp((length(c4.xyz - hlEye) - ${Pn.toFixed(1)}) / ${(va-Pn).toFixed(1)}, 0.0, 1.0);
  float width = hlWidthPx * mix(1.0, hlFarScale, far);
  if (dot(dir, dir) > 1e-12) clip.xy += normalize(dir) * width * 2.0 / hlViewport * clip.w;
#endif
  gl_Position = clip;
}`,Pa=`
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
  if (up < ${tt.toFixed(2)} || hlWash <= 0.0) discard;
  gl_FragColor = vec4(hlAccent, hlWash * smoothstep(${tt.toFixed(2)}, ${(tt+.15).toFixed(2)}, up));
#else
  vec3 n = hlHasNormal > 0.5 ? normalize(vHlNormal) : normalize(cross(dFdx(vHlPos), dFdy(vHlPos)));
  vec3 v = normalize(hlEye - vHlPos);
  float f = pow(1.0 - abs(dot(n, v)), ${Oa.toFixed(2)});
  float pulse = 0.775 + 0.225 * sin(hlTime * 6.2831853 / ${ka.toFixed(2)});
  gl_FragColor = vec4(hlAccent * f * ${Fa.toFixed(2)} * pulse, 1.0);
#endif
}`,oe="canalRecallHighlightPass",Na="__canalRecallHighlightOutlinePx";function Ba(){let e=globalThis[Na],t=e==null||e===""?NaN:Number(e);return Number.isFinite(t)&&t>=0?t:null}var Ga=(e,t)=>{let[n,r,o]=M(t);return new e.Vector3(n/255,r/255,o/255)};function Ha(e,t,n={}){let r={};n.merged&&(r.HL_MERGED=""),t==="outline"&&(r.HL_OUTLINE=""),t==="roof"&&(r.HL_ROOF="");let o=Gn;if(n.feature){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n.feature.attribute))throw new Error(`highlight: bad feature attribute ${n.feature.attribute}`);r.HL_FEATURE=n.feature.attribute,o=`attribute float ${n.feature.attribute};
uniform float hlFeatureId;
${Gn}`}let s=new e.ShaderMaterial({defines:r,uniforms:{hlViewport:{value:new e.Vector2(1,1)},hlWidthPx:{value:re},hlFarScale:{value:at/re},hlCentre:{value:new e.Vector3},hlDepthPush:{value:Ta},hlAccent:{value:Ga(e,n.accent??Vn())},hlEye:{value:new e.Vector3},hlTime:{value:0},hlHasNormal:{value:1},hlFeatureId:{value:n.feature?.id??0},hlUp:{value:new e.Vector3(0,0,1)},hlWash:{value:0}},vertexShader:o,fragmentShader:Pa,side:t==="outline"?e.BackSide:e.FrontSide,transparent:!0,depthTest:!0,depthWrite:t==="outline",blending:t==="rim"?e.AdditiveBlending:e.NormalBlending,polygonOffset:t!=="outline",polygonOffsetFactor:-1,polygonOffsetUnits:t==="roof"?-4:-2});return s.name=`highlight/${t}${n.merged?"/merged":""}`,s.userData={[oe]:!0},s.defaultAttributeValues={hidden:[0],normal:[0,0,0]},s}function Ua(e,t,n,r){let o=e.geometry?.boundingBox,s=t.elements;if(!o)return;let a=n.domElement,i=a?.clientWidth||r.x,u=a?.clientHeight||r.y,l=[],m=!1;for(let f=0;f<8;f++){let c=f&1?o.max.x:o.min.x,d=f&2?o.max.y:o.min.y,h=f&4?o.max.z:o.min.z,p=s[0]*c+s[4]*d+s[8]*h+s[12],y=s[1]*c+s[5]*d+s[9]*h+s[13],b=s[3]*c+s[7]*d+s[11]*h+s[15];if(!(b>1e-9)){m=!0;break}l.push((p/b+1)/2*i,(1-y/b)/2*u)}Wn().set(e,{t:performance.now(),points:l,behind:m,width:i,height:u})}function Te(e){for(let t of e?.userData?.[oe]??[])e.remove(t),za(t.material),Wn().delete(t);e?.userData&&delete e.userData[oe]}var Wa=4,ot=new Map,jn=Symbol("highlightPassPool");function $a(e,t){return`${e}|${t.merged?1:0}|${t.feature?.attribute??""}|${t.accent??""}`}function Va(e,t,n={}){let r=$a(t,n),o=ot.get(r)?.pop();if(o){let a=o.uniforms;return a.hlCentre.value.set(0,0,0),a.hlHasNormal.value=1,a.hlFeatureId.value=n.feature?.id??0,a.hlUp.value.set(0,0,1),a.hlWash.value=0,a.hlEye.value.set(0,0,0),a.hlTime.value=0,a.hlWidthPx.value=re,a.hlFarScale.value=at/re,o}let s=Ha(e,t,n);return s.userData[jn]=r,s}function za(e){let t=e?.userData?.[jn];if(!t){e?.dispose?.();return}let n=ot.get(t)??[];ot.set(t,n),n.length<Wa&&!n.includes(e)?n.push(e):e.dispose()}function Hn(e){let t=e?.getAttribute?.("position")??e?.attributes?.position;return!t||!!t.array}function lt(e,t,n={}){Te(t);let r=Le[n.style??ae()],o=[...r.outline?["outline"]:[],...r.rim?["rim"]:[],...r.wash&&!n.feature?["roof"]:[]];if(!o.length||!t?.geometry)return[];let s=t.geometry,a=n.centre;if(!a){!s.boundingBox&&Hn(s)&&s.computeBoundingBox?.();let y=s.boundingBox?.getCenter(new e.Vector3)??s.boundingSphere?.center;a=y?[y.x,y.y,y.z]:[0,0,0]}let i=s.getAttribute?.("normal")?1:0,u=[],l=new e.Matrix4,m=new e.Vector4,f=new e.Vector2,c=new e.Matrix3,d=new e.Vector3,h=n.up??[0,0,1],p=!n.merged&&!n.feature&&!t.isInstancedMesh;p&&!s.boundingBox&&Hn(s)&&s.computeBoundingBox?.();for(let y of o){let b=Va(e,y,{merged:n.merged,feature:n.feature,accent:n.accent??Vn(n.style)});b.uniforms.hlCentre.value.set(a[0],a[1],a[2]),b.uniforms.hlHasNormal.value=i;let g=t.isInstancedMesh?new e.InstancedMesh(s,b,t.count):new e.Mesh(s,b);t.isInstancedMesh&&(g.instanceMatrix=t.instanceMatrix),g.name=`${t.name||"mesh"}/highlight-${y}`,g.frustumCulled=!1,g.castShadow=g.receiveShadow=!1,g.renderOrder=(t.renderOrder??0)+1,g.raycast=()=>{},y==="roof"&&Object.defineProperty(g,"visible",{get:()=>t.visible&&Nn()>.001,set:()=>{},configurable:!0}),g.onBeforeRender=(x,I,F)=>{t.isInstancedMesh&&(g.count=t.count),y!=="roof"&&(g.visible=t.visible);let A=b.uniforms;if(y==="roof"){c.setFromMatrix4(g.matrixWorld),d.setFromMatrixColumn(g.matrixWorld,0);let L=d.length()<.001?[0,0,1]:h;A.hlUp.value.set(L[0],L[1],L[2]).applyMatrix3(c.invert()).normalize(),A.hlWash.value=La*Nn()}x.getDrawingBufferSize(f),A.hlViewport.value.copy(f);let Ge=x.domElement?.clientWidth||f.x,$=Ba();A.hlWidthPx.value=($??re)*(f.x/Ge),A.hlFarScale.value=$==null?at/re:1,l.multiplyMatrices(F.projectionMatrix,F.matrixWorldInverse).multiply(g.matrixWorld),y==="outline"&&p&&Ua(g,l,x,f),l.invert(),m.set(0,0,1,0).applyMatrix4(l),Math.abs(m.w)>1e-12&&A.hlEye.value.set(m.x/m.w,m.y/m.w,m.z/m.w),A.hlTime.value=performance.now()/1e3,b.uniformsNeedUpdate=!0},t.add(g),u.push(g)}return t.userData??={},t.userData[oe]=u,u}var Un=new WeakMap;function ja(e,t,n,r=ae()){if(!t||n==="plain"||n==="highlight"&&Le[r].keepMaterials)return t;let o=Un.get(t);o||Un.set(t,o=new Map);let s=`${n}|${r}`,a=o.get(s);if(a)return a;if(n==="highlight")a=new e.MeshLambertMaterial({color:16765471,emissive:7033856,side:t.side??e.FrontSide});else if(t.isShaderMaterial&&t.uniforms?.tint?.value?.isVector3)a=t.clone(),a.uniforms={...t.uniforms,tint:{value:qa(t.uniforms.tint.value.clone())}};else if(t.isShaderMaterial&&t.uniforms?.hlDimAll)a=t.clone(),a.uniforms={...t.uniforms,hlDimAll:{value:1}};else if(t.isShaderMaterial)a=t.clone(),a.uniforms=t.uniforms,a.defines={...t.defines??{},HL_DIM_ALL:""};else{if(a=t.clone(),a.color){let i=a.color,u=.2126*i.r+.7152*i.g+.0722*i.b;i.setRGB(i.r+(u-i.r)*U,i.g+(u-i.g)*U,i.b+(u-i.b)*U)}if(a.map){let i=a.onBeforeCompile;a.onBeforeCompile=(u,l)=>{i?.call(a,u,l),u.fragmentShader=u.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${U.toFixed(2)});`)},a.customProgramCacheKey=()=>`${t.customProgramCacheKey?.()??""}|hl-dim`}}return a.name=`${t.name||"material"}/${n}`,a.userData={...t.userData??{},highlightVariantOf:t},o.set(s,a),a}function qa(e){let t=.2126*e.x+.7152*e.y+.0722*e.z;return e.set(e.x+(t-e.x)*U,e.y+(t-e.y)*U,e.z+(t-e.z)*U)}var Ya=e=>e?.userData?.highlightVariantOf??e;function qn(e,t,n,r={}){let o=r.style??ae(),s=[];t.traverse(a=>{a.isMesh&&a.material&&!a.material.userData?.[oe]&&s.push(a)});for(let a of s){let i=u=>u?.userData?.[oe]?u:u?.userData?.cityLook&&r.cityVariant?r.cityVariant(u,n):ja(e,Ya(u),n,o);a.material=Array.isArray(a.material)?a.material.map(i):i(a.material),n==="highlight"?lt(e,a,{style:o,up:r.up}):Te(a)}}var se=(e,t)=>`(${e}.g + 1.0 - ${t}.a)`;function Ka(){let e=globalThis;return(e.__canalRecallMaskFormat??new URLSearchParams(e.location?.search??"").get("maskFormat"))==="rg"?"rg":"r8"}function Yn(e,t,n=Ka()){let r=t.length>>1;if(e.length!==r*4)throw new Error(`packMask: ${e.length} colour bytes for ${r} mask texels`);if(n==="rg"){for(let s=0;s<r;s++)e[s*4+3]=255;return{colour:e,mask:t,channels:2}}let o=new Uint8Array(r);for(let s=0;s<r;s++)o[s]=t[s*2],e[s*4+3]=255-t[s*2+1];return{colour:e,mask:o,channels:1}}var Xa=70,Ja=190,Za=.5,Kn=15,Xn=40;var ut="12.0";var Jn=[-1,-1];var Zn=[-1,-1],Qn=()=>[Xa,Ja,Za],ke=e=>Number.isInteger(e)?e.toFixed(1):String(e),er=`
uniform vec2 roofLayers;
uniform vec3 roofTier;
vec3 roofTierColour(vec3 fine, vec2 uv, float layer, float dist) {
  if (roofLayers.x < 0.0 || layer < roofLayers.x - 0.5 || layer > roofLayers.y - 0.5) return fine;
  float mid = smoothstep(roofTier.x - ${ke(Kn)}, roofTier.x + ${ke(Kn)}, dist);
  if (mid <= 0.0) return fine;
  float far = smoothstep(roofTier.y - ${ke(Xn)}, roofTier.y + ${ke(Xn)}, dist);
  vec3 coarse = texture(cells, vec3(uv * roofTier.z, layer)).rgb;
  vec3 flatMean = textureLod(cells, vec3(uv, layer), ${ut}).rgb;
  return mix(mix(fine, coarse, mid), flatMean, far);
}`;var Qa={threshold:20,taps:9,spread:1,grad:.85,sdf:1},es=`
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
}`;function ct(e=Qa,t=1){let n=Number.isFinite(t)&&t>0?t:1;return{cellTaps:[e.threshold*n,e.taps,e.spread,e.grad],cellTapsSdf:e.sdf}}var tr=`${Et}
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
${es}
#endif
void cellTierSample(vec3 p, float dist, out vec3 c, out vec2 m) {
#ifdef CELL_LOD_BIAS
  vec4 cc = texture(cells, p, cellLodBias); vec2 mm = texture(masks, p, cellLodBias).rg;
#else
  vec4 cc = texture(cells, p); vec2 mm = texture(masks, p).rg;
#endif
  c = cc.rgb; m = vec2(mm.r, ${se("mm","cc")});
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
  far = max(far, ${It("dist")});
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
      c = mix(c, tc.rgb, cellTapW); m = mix(m, vec2(tm.r, ${se("tm","tc")}), cellTapW);
    }
  }
#endif
  if (far <= 0.0) return;
  vec4 fc = textureLod(cells, p, ${ut}); vec2 fm = textureLod(masks, p, ${ut}).rg;
  c = mix(c, fc.rgb, far); m = mix(m, vec2(fm.r, ${se("fm","fc")}), far);
}`,ts=[1,2];function mt(e,t=ts){return{cellAniso:Number.isFinite(e)&&e>=1?e:1,cellAnisoRule:[1,1,t[0],t[1]]}}var ns=.5,Oe={sunAzimuthDeg:215,sunElevationDeg:40,sunColour:"#ffe9cc",sunIntensity:2.15,skyColour:"#e3ebf6",groundColour:"#998a72",skyIntensity:1.75,shadows:!0,shadowMapSize:2048,shadowIntensity:1-ns};var Kc={...Oe,...wn};function rs(e,t){let n=e*Math.PI/180,r=t*Math.PI/180;return[Math.sin(n)*Math.cos(r),Math.cos(n)*Math.cos(r),Math.sin(r)]}var Xc=rs(Oe.sunAzimuthDeg,Oe.sunElevationDeg),Ce=(()=>{let e=Oe.sunAzimuthDeg*Math.PI/180;return[Math.sin(e),Math.cos(e)]})(),Fe=[Ce[0]*.6,Ce[1]*.6,.8],nr=.84;function os(e){let t=e[0]*Fe[0]+e[1]*Fe[1]+e[2]*Fe[2];return Math.max(.5,Math.min(1,.58+.42*Math.max(0,t)))}var Jc=os([0,0,1]),he=e=>Number.isInteger(e)?e.toFixed(1):String(+e.toFixed(6)),rr=`
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = ${he(nr)} + ${he(1-nr)} * (0.5 + 0.5 * dot(h, vec2(${he(Ce[0])}, ${he(Ce[1])}))); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, dot(n, vec3(${Fe.map(he).join(", ")}))), 0.5, 1.0);`;var or=[.4,2.5],as=["brick","accent","stucco"];function ss(e){let t=(e?.white?et(e.white):1.106)*(e?.stripOverDrawn??1);return Math.max(or[0],Math.min(or[1],t))}var is=["brick","accent"];function ar(e,t,n,r,o=H()){return o!=="sunny"||r==="measured"?t:n?as.includes(e)?ne(t,ss(n)):t:is.includes(e)?ne(t,1.106):t}var S=[{name:"magnified (rho < 1)",rgb:[255,0,0]},{name:"rho 1-2",rgb:[255,255,0]},{name:"rho 2-4",rgb:[0,255,0]},{name:"rho 4-8",rgb:[0,255,255]},{name:"rho 8-16",rgb:[0,0,255]},{name:"rho 16-tier",rgb:[255,128,0]},{name:"tier far > 0",rgb:[255,0,255]},{name:"depth-fade far > 0 (tier 0)",rgb:[255,255,255]},{name:"under fade > 0",rgb:[128,0,255]},{name:"roof layer",rgb:[128,128,128]}];var am=S.length-1,ls=3;var us=520,cs=us.toFixed(1),ms=String(ls),v=e=>`vec3(${e.map(t=>(t/255).toFixed(4)).join(", ")})`,ir=`
#ifdef CELL_DEBUG_RHO
vec3 cellDebugColour(float layer) {
  if (roofLayers.x >= 0.0 && layer > roofLayers.x - 0.5 && layer < roofLayers.y - 0.5) return ${v(S[9].rgb)};
#if defined(CELL_TIER_ANISO) && defined(CELL_DEBUG_UNDER)
  if (cellFarFlat > 0.001) return ${v(S[6].rgb)};
  if (cellFarTier <= 0.001 && cellFar > 0.001) return ${v(S[7].rgb)};
  if (cellUnder < 0.5) return ${v(S[0].rgb)};
  if (cellUnder < 0.75) return ${v(S[1].rgb)};
  if (cellUnder < 1.0) return ${v(S[2].rgb)};
  if (cellUnder < 1.5) return ${v(S[3].rgb)};
  if (cellUnder < 2.0) return ${v(S[4].rgb)};
  return ${v(S[5].rgb)};
#else
#ifdef CELL_TIER_ANISO
  if (cellFarFlat > 0.001) return ${v(S[6].rgb)};
  if (cellFarUnder > 0.001) return ${v(S[8].rgb)};
#else
  if (cellFarTier > 0.001) return ${v(S[6].rgb)};
#endif
  if (cellFar > 0.001) return ${v(S[7].rgb)};
  if (cellRho < 1.0) return ${v(S[0].rgb)};
  if (cellRho < 2.0) return ${v(S[1].rgb)};
  if (cellRho < 4.0) return ${v(S[2].rgb)};
  if (cellRho < 8.0) return ${v(S[3].rgb)};
  if (cellRho < 16.0) return ${v(S[4].rgb)};
  return ${v(S[5].rgb)};
#endif
}
#endif`;function ie(e){try{return typeof URLSearchParams=="function"?new URLSearchParams(globalThis.location?.search??"").get(e):null}catch{return null}}var fs=1.25,sr=[2.5,5],ds={footprint:1,fadePx:[2,4],frameMinPx:0,barPx:[0,0],tent:!0};function hs(){let t=globalThis.__canalRecallWindowSdfBand??ie("windowSdfBand");return!(t===!1||t==="0"||t==="false"||t==="off")}var Ee=(e,t)=>{if(e==null)return null;let n=e.split(",").map(Number);return n.length===t&&n.every(r=>Number.isFinite(r)&&r>=0)?n:null};function ps(){let e=ds,t=Ee(ie("windowSdfFoot"),1)?.[0]??e.footprint,n=Ee(ie("windowSdfFade"),2)??e.fadePx,r=Ee(ie("windowSdfFrameMin"),1)?.[0]??e.frameMinPx,o=Ee(ie("windowSdfBar"),2)??e.barPx,s=ie("windowSdfTent"),a=s==null?e.tent:s==="1";return{band:[hs()?1:0,t,n[0],n[1]],shape:[r,o[0],o[1],a?1:0]}}var ft=null;function lr(){let e=`${globalThis.location?.search??""}|${String(globalThis.__canalRecallWindowSdfBand)}`;ft?.key!==e&&(ft={key:e,v:ps()});let t=ft.v;return{windowSdfBand:{value:[...t.band]},windowSdfShape:{value:[...t.shape]}}}var Ie=["#6f8796","#2f4350","#1d2a33"],De=e=>v([parseInt(e.slice(1,3),16),parseInt(e.slice(3,5),16),parseInt(e.slice(5,7),16)]),ur=`
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
  vec2 cell = vec2(${cs}, head.y);
  vec2 p = fract(uv) * cell;
  // The pixel's footprint from the continuous uv (fract jumps at the cell seam), in canvas px per framebuffer px.
  vec2 fpx = max(fwidth(uv * cell), vec2(1e-3));
  vec2 fw = fpx * (band ? windowSdfBand.y : ${fs.toFixed(2)});
#ifdef CELL_TAPS
  // The footprint prefilter's taps (roofTier.ts, lane R4-D #246) widen the edge box with the wall under the windows.
  fw *= mix(1.0, cellTapsSdf, cellTapW);
#endif
  vec2 fade = band ? windowSdfBand.zw : vec2(${sr[0].toFixed(1)}, ${sr[1].toFixed(1)});
  for (int i = 0; i < ${ms}; i++) {
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
    vec3 gc = g < 0.55 ? mix(${De(Ie[0])}, ${De(Ie[1])}, g / 0.55) : mix(${De(Ie[1])}, ${De(Ie[2])}, (g - 0.55) / 0.45);
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
#endif`;var bs={legacy:.9,sunny:1},gs=(e=H())=>bs[e],N=gs(),pe=255/de,ys=255/228,xs=255/243,Ms=255/246,Ne=[{cell:"brick",tileM:E.brick,clampUv:!1,litGain:pe*N,skyTint:!1},{cell:"stucco",tileM:E.stucco,clampUv:!1,litGain:xs*N,skyTint:!1},{cell:"stone",tileM:E.stone,clampUv:!1,litGain:ys*N,skyTint:!1},{cell:"white",tileM:1,clampUv:!1,litGain:1,skyTint:!1},{cell:"door",tileM:E.door,clampUv:!1,litGain:1,skyTint:!1},{cell:"glass",tileM:E.glass,clampUv:!0,litGain:1,skyTint:!0},{cell:"tile",tileM:E.roofTile,clampUv:!1,litGain:pe*N,skyTint:!1},{cell:"slate",tileM:E.slate,clampUv:!1,litGain:pe*N,skyTint:!1},{cell:"flat",tileM:E.bitumen,clampUv:!1,litGain:pe*N,skyTint:!1},{cell:"brick20",tileM:E.brick,clampUv:!1,litGain:pe*N,skyTint:!1},{cell:"whiteStucco",tileM:E.stucco,clampUv:!1,litGain:Ms*N,skyTint:!1},{cell:"glassTint",tileM:E.glass,clampUv:!0,litGain:1,skyTint:!0}],Pe=Ne.length,be=Object.fromEntries(Ne.map((e,t)=>[e.cell,t])),dt=64,ws=3,Rs=3.2,le={x0:.28,x1:.72,y0:.3,y1:.8,frame:.035},W=e=>Number.isInteger(e)?e.toFixed(1):String(e),_s=`
void cityWindowGrid(vec2 m, inout vec3 c, inout vec2 mk) {
  vec2 cell = fract(m / vec2(${W(ws)}, ${W(Rs)}));
  vec2 lo = vec2(${W(le.x0)}, ${W(le.y0)}), hi = vec2(${W(le.x1)}, ${W(le.y1)});
  vec2 aa = max(fwidth(cell), vec2(1e-4));
  vec2 inO = smoothstep(lo - aa, lo + aa, cell) * (1.0 - smoothstep(hi - aa, hi + aa, cell));
  vec2 lg = lo + ${W(le.frame)}, hg = hi - ${W(le.frame)};
  vec2 inG = smoothstep(lg - aa, lg + aa, cell) * (1.0 - smoothstep(hg - aa, hg + aa, cell));
  float outer = inO.x * inO.y, glass = inG.x * inG.y;
  // far away the cells shrink under a pixel: fade the grid to the wall rather than shimmer
  float fade = 1.0 - smoothstep(0.08, 0.2, max(aa.x, aa.y));
  vec3 win = mix(vec3(0.86, 0.85, 0.82), mix(vec3(0.17, 0.21, 0.25), vec3(0.33, 0.39, 0.44), cell.y), glass);
  float k = outer * fade;
  c = mix(c, win, k);
  mk.r *= 1.0 - k;
  mk.g *= 1.0 - k;
}`,Ss=qe.school;function pt(e,t={}){let n=Ls(e,t);return t.windowGrid&&vs.has(Ye[e])?n+dt:n}var vs=new Set(["brick","stucco","stone"]);function Ls(e,t){let n=Ye[e],r=t.source==="measured";return n==="glass"&&r?be.glassTint:n==="brick"&&!r&&typeof t.year=="number"&&t.year>=Ss?be.brick20:n==="stucco"&&t.white?be.whiteStucco:n==="frame"?be.white:be[n]}function As(){return Ne.map(e=>[1/e.tileM,e.clampUv?1:0,e.litGain,e.skyTint?1:0])}var Ts=.38,ks=.8,Fs=.27,Os=.97,Cs=.75,Es=.5,Is=.12,Ds=(e,t)=>(e<45||e>340)&&t>=.2;function Ps(e,t,n,r=H(),o){if(rn(e,n))return Re(e,Rn(e,t,n,r,o),n);let s=M(t),[a,i,u]=_(s);return e==="slate"&&Ds(a,i)?Re("roofTile",t):(e==="brick"||e==="accent")&&i<Is?w(k([a,i,Math.min(G[1],Math.max(G[0],.12+u*.9))])):e==="slate"&&u>Ts?w(k([a,Math.min(i,.12),Math.min(.72,u/ks)])):e==="slate"?u<Fs?P.slate[1]:P.slate[0]:e==="frame"&&u>=.5&&u<Cs?w(s):e==="stone"&&u<Es?w(s):Re(e,t)}function dr(e,t,n,r=H(),o,s){let a=Ps(e,t,n,r,o),[i,u,l]=M(ar(e,a,s??null,n,r));return[i,u,l,255]}function Ns(e,t,n){switch(t){case"brick":return An(e,n);case"brick20":return En(e,n);case"stucco":return On(e);case"whiteStucco":return In(e);case"stone":return Cn(e);case"white":case"frame":return Dn(e);case"door":return Fn(e);case"glass":return Tn(e);case"glassTint":return kn(e);case"tile":return ve(e,"tile");case"slate":return ve(e,"slate");case"flat":return ve(e,"flat")}}function Bs(e,t,n){let r=n*n,o=new Uint8Array(r*4*Pe),s=new Uint8Array(r*2*Pe),a=e.createElement("canvas");a.width=a.height=n;let i=a.getContext("2d",{willReadFrequently:!0});return i.imageSmoothingQuality="high",Ne.forEach((u,l)=>{i.clearRect(0,0,n,n),i.drawImage(Ns(e,u.cell,t),0,0,n,n);let m=i.getImageData(0,0,n,n).data;for(let f=0;f<n;f++)for(let c=0;c<n;c++){let d=((n-1-f)*n+c)*4,h=l*r+f*n+c;o[h*4]=m[d],o[h*4+1]=m[d+1],o[h*4+2]=m[d+2],o[h*4+3]=255,s[h*2]=255,s[h*2+1]=0}}),{colour:o,mask:s}}async function Gs(e=document){let t=new Image;t.src=new URL("materials/ambientcg/Bricks057/colour.jpg",e.baseURI).href;try{return await t.decode(),t}catch{return null}}var bt=e=>`${e.lit?"lit":"unlit"}|${e.kind}|${e.kind==="slot"?e.uv??"uv":"-"}|${e.highlight?"hl":e.dim?"dim":"-"}|${e.side??0}${e.noFade?"|nofade":""}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf2":""}${e.lodBias?"|lodb":""}${e.aniso?"|aniso":""}${e.taps?"|taps":""}`;function Hs(e){let t={CITY_SLOT_COUNT:String(Pe)};return e.kind==="slot"&&(t.CITY_SLOT=""),e.swap&&(t.CITY_SWAP=""),e.cellDebug&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CELL_DEBUG_RHO="",e.cellDebug==="under"&&(t.CELL_DEBUG_UNDER="")),e.windows&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CITY_WINDOW_SDF=""),e.lodBias&&e.kind==="chunk"&&(t.CELL_LOD_BIAS=""),e.aniso&&e.kind==="chunk"&&(t.CELL_TIER_ANISO=""),e.taps&&e.kind==="chunk"&&(t.CELL_TAPS=""),e.lit?(t.CITY_VARIANT_UNIFORMS="",{...t,...st()}):(e.kind==="slot"&&e.uv==="box"&&(t.CITY_BOX_UV=""),e.highlight?t.CITY_HIGHLIGHT="":e.dim&&(t.CITY_DIM=""),{...t,...st()})}function Us(e){return{cityForce:{value:e.highlight?1:e.dim?2:0},cityBoxUv:{value:e.kind==="slot"&&e.uv==="box"?1:0}}}var Ws=e=>e.lit?`city-look-v4|lit|${e.kind}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf2":""}${e.lodBias?"|lodb":""}${e.aniso?"|aniso":""}${e.taps?"|taps":""}`:`city-look-v3|${bt({...e,side:0})}`,$s="vec3(1.0, 0.824, 0.122)",cr="vec3(1.0, 0.637, 0.0137)",mr="vec3(0.035, 0.05, 0.07)",Vs=1,zs=.2,js=.75,qs=1.8,ue=e=>Number.isInteger(e)?e.toFixed(1):String(e),Ys=`
float cityGrain(vec3 cell) {
  float g = clamp(dot(cell, vec3(0.299, 0.587, 0.114)) / ${ue(de/255)}, 0.45, 1.1);
  return mix(1.0, g, ${ue(js)});
}`,hr=16,Ks=`
#ifdef CITY_SWAP
attribute float swapSlot;
uniform vec4 citySwapUnder[${hr/4}];
uniform float cityUnder;
flat varying float vCityUnder;
#endif`,Xs=`
#ifdef CITY_SWAP
int citySw = int(swapSlot + 0.5) - 1;
vCityUnder = citySw >= 0 ? citySwapUnder[citySw / 4][citySw % 4] : cityUnder;
#endif`,pr=`
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
${Ks}
${it}`,br=`
${Xs}
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
  vGrid = step(${dt-.5}, layer);
  int cityS = int(clamp(layer - ${dt}.0 * vGrid + 0.5, 0.0, float(CITY_SLOT_COUNT - 1)));
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
#endif`,gr=`
vFacDist = length((modelViewMatrix * vec4(position, 1.0)).xyz);
if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`,yr=`
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${er}
${tr}
${ir}
${ur}
${_s}
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
${Ys}
${it}`,xr=`
if (HL_GHOST(vHighlight)) discard;
#ifdef CITY_SWAP
float cityHash = fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296)));
if (cityFade < 1.0 && cityHash >= cityFade) discard;
// The complement of a replacement dissolving in over (or out from) this mesh: where it draws, this one does not.
if (cityHash < vCityUnder) discard;
#else
if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;
#endif`,Mr=`
vec2 cityUv = vSlot.y > 0.5 ? clamp(vFacUv, 0.0, 1.0) : vFacUv;
vec3 cityP = vec3(cityUv, vLayer);
vec3 cityC; vec2 cityM;
#ifdef CITY_SLOT
vec4 cityCC = texture(cells, cityP); vec2 cityMM = texture(masks, cityP).rg;
cityC = cityCC.rgb; cityM = vec2(cityMM.r, ${se("cityMM","cityCC")});
if (vGrid > 0.5) cityWindowGrid(vFacUv / vSlot.x, cityC, cityM);
#else
cellTierSample(cityP, vFacDist, cityC, cityM);
#ifdef CITY_WINDOW_SDF
windowSdf(cityUv, vLayer, 1.0 - cellFar, cityC, cityM);
#endif
cityC = roofTierColour(cityC, cityUv, vLayer, vFacDist);
#endif
float cityG = cityGrain(cityC);
cityC *= mix(vec3(1.0), vTint, cityM.r) * mix(vec3(1.0), vAccent, cityM.g);`,Js=`
uniform mat3 enuFromWorld;
${pr}
varying float vShade;
void main() {
${br}
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
${rr}
  vShade = shade;
#else
  vShade = tint.a;
#endif
${gr}
}`,Zs=`
precision highp float;
${yr}
varying float vShade;
void main() {
${xr}
${Mr}
  if (HL_PAINT(vHighlight)) {
    float hlShade = clamp(1.0 - (1.0 - vShade) * ${ue(qs)}, 0.6, 1.0);
    gl_FragColor = vec4(${$s} * (flatColour > 0.5 ? 1.0 : cityG) * hlShade, 1.0);
    return;
  }
  if (flatColour > 0.5) cityC = vTint;
  cityC = hlDesat(cityC, vHighlight);
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  gl_FragColor = vec4(cityC * shade, 1.0);
#ifdef CELL_DEBUG_RHO
  gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif
}`;function Qs(e,t={}){return{cells:t.cells??{value:null},masks:t.masks??{value:null},slotBase:t.slotBase??{value:0},slotParams:t.slotParams??{value:As().map(n=>new e.Vector4(...n))},bands:t.bands??{value:0},flatColour:t.flatColour??{value:0},cityFade:t.cityFade??{value:1},wallGain:t.wallGain??{value:1},roofLayers:t.roofLayers??{value:Zn},roofTier:t.roofTier??{value:Qn()},cellTier:t.cellTier??{value:Jn},enuFromWorld:t.enuFromWorld??{value:new e.Matrix3},citySwapUnder:t.citySwapUnder??{value:new Float32Array(hr)},cityUnder:t.cityUnder??{value:0},windowTable:t.windowTable??{value:null},windowSdfMix:t.windowSdfMix??{value:1},cellLodBias:t.cellLodBias??{value:0},cellAniso:t.cellAniso??{value:mt(16).cellAniso},cellAnisoRule:t.cellAnisoRule??{value:mt(16).cellAnisoRule},cellTaps:t.cellTaps??{value:ct().cellTaps},cellTapsSdf:t.cellTapsSdf??{value:ct().cellTapsSdf},...lr(),...t.windowSdfBand?{windowSdfBand:t.windowSdfBand}:{},...t.windowSdfShape?{windowSdfShape:t.windowSdfShape}:{}}}var ei={accent:[1,1,1,1],hidden:[0],color:[1,1,1],uv:[0,0],uv1:[0,0],swapSlot:[0]},ht="recipeLookShared";function ti(e,t,n){let r=Hs(t),o=t.side??e.FrontSide,s;if(!t.lit)s=new e.ShaderMaterial({uniforms:n,defines:r,vertexShader:Js,fragmentShader:Zs,side:o});else{s=new e.MeshLambertMaterial({side:o,flatShading:t.kind==="chunk"}),s.defines={...s.defines??{},...r};let a=Us(t);s.onBeforeCompile=u=>{for(let l of Object.keys(n))u.uniforms[l]=n[l];Object.assign(u.uniforms,a),u.vertexShader=u.vertexShader.replace("#include <common>",`#include <common>${pr}`).replace("#include <begin_vertex>",`#include <begin_vertex>${br}`).replace("#include <project_vertex>",`#include <project_vertex>${gr}`),u.fragmentShader=u.fragmentShader.replace("#include <common>",`#include <common>${yr}
float cityLuma;`).replace("#include <dithering_fragment>",`#include <dithering_fragment>
#ifdef CELL_DEBUG_RHO
gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>${xr}`).replace("#include <map_fragment>",`${Mr}
#ifdef CITY_SLOT
cityC *= vSlot.z;
#else
cityC *= mix(1.0, wallGain * ${ue(N)}, cityM.r);
#endif
if (flatColour > 0.5) cityC = vTint;
cityLuma = dot(cityC, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= HL_PAINT(vHighlight) ? ${cr} * ${ue(Vs)} * pow(flatColour > 0.5 ? 1.0 : cityG, 2.2) : pow(hlDesat(cityC, vHighlight), vec3(2.2));`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
if (HL_PAINT(vHighlight)) totalEmissiveRadiance += ${cr} * ${ue(zs)};
#ifdef CITY_SLOT
else totalEmissiveRadiance += ${mr} * vSlot.w;
#else
// Bay glazing (dark, untinted texels): the same constant sky tint as landmark glass, never a hotspot.
else totalEmissiveRadiance += ${mr} * (1.0 - smoothstep(0.06, 0.2, cityLuma)) * (1.0 - cityM.r);
#endif`)};let i=Ws(t);s.customProgramCacheKey=()=>i,s.uniforms=n}return s.defaultAttributeValues={...ei},s.name=`city-look/${bt(t)}`,s.userData={cityLook:!0,cityVariant:{...t},[ht]:!0},t.noFade&&Dt(s),t.kind==="chunk"?vt(s,!!t.lit):s}function ni(e){return e?e.isMeshBasicMaterial||e.userData?.unlit?"unlit (decal / emissive sign)":e.transparent||(e.opacity??1)<1?"transparent":e.vertexColors?"vertex colours":e.map?"own texture":null:"no material"}function ri(e,t){let n=e?.userData??{};if(dn(n.materialSlot)&&typeof n.tint=="string"){let s=n.tintSource==="measured";return{slot:n.materialSlot,tint:n.tint,inferred:n.materialSlotSource===un,...s?{source:"measured"}:{},...s&&typeof n.tintWhitePoint=="string"?{white:n.tintWhitePoint}:{},...n.windowGrid===!0?{windowGrid:!0}:{}}}if(!t||ni(e)||!e.color)return null;let r="#"+e.color.getHexString(),o=mn(e.name,r);return{slot:o.slot,tint:o.tint,inferred:!0}}function fr(e,t,n,r,o={}){let s=t.getAttribute("position")?.count??0,a=pt(n,o),i=dr(n,r,o.source,void 0,o.whitePoint,o.exposure),u=t.getAttribute("layer"),l=t.getAttribute("tint");if(u&&l)return u.getX(0)===a&&Math.round(l.getX(0)*255)===i[0]&&Math.round(l.getY(0)*255)===i[1]&&Math.round(l.getZ(0)*255)===i[2];t.setAttribute("layer",new e.BufferAttribute(new Uint8Array(s).fill(a),1,!1));let m=new Uint8Array(s*4);for(let f=0;f<s;f++)m.set(i,f*4);return t.setAttribute("tint",new e.BufferAttribute(m,4,!0)),!0}function oi(e,t,n,r,o,s={}){let a=r.getAttribute("normal"),i=r.getAttribute("layer"),u=r.getAttribute("tint");if(!a||!i||!u)return 0;let[l,m,f]=dr("bitumen",o,s.source);t.updateWorldMatrix(!0,!0);let c=new e.Matrix4().copy(t.matrixWorld).invert().multiply(n.matrixWorld),d=new e.Matrix3().getNormalMatrix(c),h=new e.Vector3,p=pt("bitumen",s),y=0;for(let b=0;b<a.count;b++)h.set(a.getX(b),a.getY(b),a.getZ(b)).applyMatrix3(d).normalize(),!(h.y<Os)&&(i.setX(b,p),u.setXYZW(b,l/255,m/255,f/255,1),y++);return y&&(i.needsUpdate=!0,u.needsUpdate=!0),y}var ai="__canalRecallCityLookShared";function wr(e,t={}){let n=globalThis,r=n[ai]??=new Map,o=r.get(e);return o||r.set(e,o=si(e,t)),o}function si(e,t={}){let n=t.document??globalThis.document,r=t.size??(globalThis.matchMedia?.("(pointer: coarse)").matches?128:256),o=Qs(e),s=new Map,a=null,i=!1,u=(f,c)=>{let d=new e.DataArrayTexture(f,r,r,Pe);return d.format=c,d.type=e.UnsignedByteType,d.wrapS=d.wrapT=e.RepeatWrapping,d.minFilter=e.LinearMipmapLinearFilter,d.magFilter=e.LinearFilter,d.generateMipmaps=!0,d.anisotropy=t.anisotropy??Me("slotCells",16).anisotropy,d.unpackAlignment=1,d.needsUpdate=!0,d.userData={bytes:f.byteLength,[ht]:!0},d},l=(async()=>{if(!n)return;let f=t.brick!==void 0?t.brick:await Gs(n),{colour:c,mask:d}=Bs(n,f,r),h=Yn(c,d);a={colour:u(h.colour,e.RGBAFormat),mask:u(h.mask,h.channels===1?e.RedFormat:e.RGFormat)},i||(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)})(),m=f=>{let c=bt(f),d=s.get(c);return d||s.set(c,d=ti(e,f,o)),d};return{uniforms:o,ready:l,material:m,dress(f,{lit:c,infer:d=!1,year:h=null,wallExposure:p=null}){let y=0;return f.traverse(b=>{if(!b.isMesh||Array.isArray(b.material)||b.material?.userData?.cityLook)return;let g=ri(b.material,d);if(!g)return;let x=b.geometry;if(!x?.getAttribute("position"))return;let I=!!x.getAttribute("uv");!I&&!x.getAttribute("normal")&&x.computeVertexNormals();let F={year:h,white:g.inferred&&fn(b.material.name),source:g.source,...g.white?{whitePoint:g.white}:{},...p?{exposure:p}:{},...g.windowGrid?{windowGrid:!0}:{}};fr(e,x,g.slot,g.tint,F)||(x=b.geometry=x.clone(),x.deleteAttribute("layer"),x.deleteAttribute("tint"),fr(e,x,g.slot,g.tint,F)),g.inferred&&g.slot==="slate"&&!g.source&&oi(e,f,b,x,g.tint,F);let A=b.material;b.material=m({lit:c,kind:"slot",uv:I?"uv":"box",side:A.side}),b.userData.citySlot={slot:g.slot,tint:g.tint,...g.source?{source:g.source}:{},inferred:g.inferred,from:A.name,layer:pt(g.slot,F)},A.userData?.[ht]||A.dispose(),y++}),y},highlighted(f,c){let d=f?.userData?.cityVariant;return d?m({...d,highlight:c,dim:!1}):f},dimmed(f,c){let d=f?.userData?.cityVariant;return d?m({...d,highlight:!1,dim:c}):f},bindAtlas(f){i=!!f,f?(o.cells.value=f.colour,o.masks.value=f.mask,o.slotBase.value=f.slotBase):a&&(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)},textureBytes(){return a&&!i?Math.round((a.colour.userData.bytes+a.mask.userData.bytes)*4/3):0}}}var ui="NL.IMBAG.Pand.";var Be=e=>/^\d{16}$/.test(e)?`${ui}${e}`:e;var ci=2*Math.PI*6378137;function mi(e,t){return[(180+e)/360,(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+t*Math.PI/360)))/360]}function fi(e,t){let n=e*360-180,r=180-t*360;return[n,360/Math.PI*Math.atan(Math.exp(r*Math.PI/180))-90]}var di=e=>1/ci/Math.cos(e*Math.PI/180),_r=e=>`${e.z}/${e.x}/${e.y}`;var hi=e=>[(e.x+.5)/2**e.z,(e.y+.5)/2**e.z];function Sr(e){let t=hi(e),n=fi(t[0],t[1]);return{tile:e,centre:t,anchor:n,units:di(n[1])}}function vr(e){let t=e.units;return[t,0,0,0,0,0,t,0,0,t,0,0,e.centre[0],e.centre[1],0,1]}function Lr(e,t,n=16,r,o=.25){let[s,a]=mi(e,t),i=2**n,u=s*i,l=a*i,m=Math.round(u)-1,f=Math.round(l)-1;return r&&Math.abs(u-(r.x+1))<=.5+o&&Math.abs(l-(r.y+1))<=.5+o&&({x:m,y:f}=r),{x:m,y:f,tiles:[[0,0],[1,0],[0,1],[1,1]].map(([c,d])=>({z:n,x:m+c,y:f+d}))}}var pi="recipeTiles";function Fr(e){try{let t=globalThis;return e===void 0&&t.__canalRecallRecipeTiles===!0?!0:new URLSearchParams(e??t.location?.search??"").get(pi)==="1"}catch{return!1}}function gt(e,t,n){let r=Lr(t.lng,t.lat,16,n);return{block:{x:r.x,y:r.y},tiles:r.tiles.map(_r).filter(o=>!!e.tiles[o])}}var ye=class{constructor(t,n){this.load=t;this.free=n}items=new Map;acquire(t){let n=this.items.get(t);if(!n){let r={refs:0,promise:null};r.promise=this.load(t).then(o=>r.value=o),this.items.set(t,n=r),n.promise.catch(()=>this.items.delete(t))}return n.refs++,n.promise}release(t){let n=this.items.get(t);n&&(--n.refs>0||(this.items.delete(t),n.value!==void 0?this.free(n.value,t):n.promise.then(r=>this.free(r,t),()=>{})))}get size(){return this.items.size}refs(t){return this.items.get(t)?.refs??0}};function yt(e,t){if(!e||t===void 0)return-1;for(let[n,r,o]of e)if(t>=r&&t<r+o)return n;return-1}function bi(e,t){let n=new Map;for(let[r,o,s]of t){let a=new Set;for(let i=o*3;i<(o+s)*3;i++)a.add(e[i]);n.set(r,Uint32Array.from([...a].sort((i,u)=>i-u)))}return n}function xt(e){let t=new Set;for(let n of e)for(let r of n.covers)for(let o of r)t.add(o);return[...t].sort()}var Wm=Ae.hide,Ar=Ae.highlight,gi=Ae.dim,xe=class{constructor(t){this.host=t;let n=t.THREE;this.root=new n.Group,this.root.name="recipe-tiles",this.units=new ye(r=>this.loadUnit(r),r=>{for(let o of r)o.geometry.dispose()})}root;index=null;tiles=new Map;block=null;units;unregister=null;clipFromWorld=null;highlighted=new Set;focus=null;recipe=$n();lastHidden="";pendingHidden=!1;lastCheck=0;revisionN=0;loading=0;errors=[];async start(t=21){let n=await fetch(new URL("index.json",this.host.baseUrl).href,{cache:"no-cache"});if(!n.ok)throw Error(`recipe tiles index ${n.status}`);return this.index=await n.json(),this.unregister=this.host.frame.register("recipe-tiles",{root:this.root,beforeRender:r=>(this.clipFromWorld=r.clipFromWorld,this.update(),this.root.children.length>0),revision:()=>this.revisionN},{order:t}),this.update(!0),!0}update(t=!1){if(!this.index)return;let n=performance.now();if(!t&&n-this.lastCheck<250){this.pendingHidden&&this.syncHidden();return}this.lastCheck=n;let r=this.host.getCentre();if(!r)return;let{block:o,tiles:s}=gt(this.index,r,this.block);this.block=o;let a=new Set(s);for(let u of a)this.tiles.has(u)||this.loadTile(u);if([...a].every(u=>this.tiles.get(u)?.ready))for(let[u,l]of this.tiles)a.has(u)||this.dropTile(l);this.pendingHidden&&this.syncHidden()}async loadTile(t){let n=this.host.THREE,r={id:t,meta:null,group:new n.Group,ready:!1,disposed:!1,merged:[],instanced:[],triangles:0};this.tiles.set(t,r),this.loading++;try{let o=await this.host.loadGltf(new URL(`building-mesh/${t}.glb`,this.host.baseUrl).href);if(r.disposed)return;if(r.meta=o.userData?.recipeTile,!r.meta)throw Error(`${t}: no recipeTile extras`);let[s,a,i]=r.meta.tile,u=Sr({z:s,x:a,y:i});r.group.name=`recipe-tile/${t}`,r.group.matrixAutoUpdate=!1,r.group.matrix.fromArray(vr(u)),o.scene.updateMatrixWorld(!0);let l=this.host.cityLook,m=this.host.lit!==!1,f=[];o.scene.traverse(c=>{c.isMesh&&f.push(c)});for(let c of f){if(c.isInstancedMesh){let g=c.geometry.getAttribute("_PAND"),x=c.count,I=new Int32Array(x),F=new Float32Array(x*16);for(let L=0;L<x;L++)I[L]=Math.round(g.getX(L));let A=new n.Matrix4,Ge=c.matrixWorld;for(let L=0;L<x;L++)c.getMatrixAt(L,A),A.premultiply(Ge),A.toArray(F,L*16);let $=new n.InstancedMesh(c.geometry,c.material,x);for(let L=0;L<x;L++)$.setMatrixAt(L,A.fromArray(F,L*16));$.name=`stub/${c.userData.unit}`,r.group.add($),r.instanced.push({unit:c.userData.unit,matrices:F,pands:I,meshes:[],stub:$});continue}let d=c.geometry;this.cityAttributes(d);let h=d.userData?.pandRanges??[];d.setAttribute("hidden",new n.BufferAttribute(new Uint8Array(d.getAttribute("position").count),1,!1));let p=c.material?.side??n.FrontSide,y=c.material?.userData?.cityLook?.uv??"uv",b=new n.Mesh(d,l.material({lit:m,kind:"slot",uv:y,side:p}));b.name=`recipe-tile/${t}/uniques`,b.matrixAutoUpdate=!1,b.matrix.copy(c.matrixWorld),b.userData.recipeTile={tile:t,ranges:h},this.host.frame.constructor.setShadows?.(b,!0,!0),r.group.add(b),r.merged.push({mesh:b,ranges:h,verts:bi(d.index.array,h)}),r.triangles+=d.index.count/3}if(this.root.add(r.group),this.revisionN++,this.host.repaint(),await Promise.all(r.instanced.map(async c=>{let d=await this.units.acquire(c.unit);if(r.disposed){this.units.release(c.unit);return}for(let h of d){let p=new n.InstancedMesh(h.geometry,h.material,c.pands.length),y=new n.Matrix4;for(let b=0;b<c.pands.length;b++)p.setMatrixAt(b,y.fromArray(c.matrices,b*16).multiply(h.local));p.name=`recipe-tile/${t}/unit/${c.unit}`,p.userData.recipeTile={tile:t,pands:c.pands},p.computeBoundingSphere(),p.computeBoundingBox(),this.host.frame.constructor.setShadows?.(p,!0,!0),r.group.add(p),c.meshes.push(p),r.triangles+=h.triangles*c.pands.length}r.group.remove(c.stub),c.stub.dispose?.()})),r.disposed)return;r.ready=!0,this.applyHighlight(r),this.pendingHidden=!0,this.revisionN++,this.host.repaint()}catch(o){this.errors.push(String(o?.message??o)),console.warn(`Recipe tile ${t} unavailable; the mid/far layers keep drawing it.`,o),this.tiles.delete(t),r.group.parent?.remove(r.group)}finally{this.loading--}}cityAttributes(t){for(let[n,r]of[["_layer","layer"],["_tint","tint"],["_LAYER","layer"],["_TINT","tint"]]){let o=t.getAttribute(n);o&&(t.setAttribute(r,o),t.deleteAttribute(n))}}async loadUnit(t){let n=this.host.THREE,r=this.host.cityLook,o=this.host.lit!==!1,s=await this.host.loadGltf(new URL(`units/${t}.glb`,this.host.baseUrl).href);s.scene.updateMatrixWorld(!0);let a=[];return s.scene.traverse(i=>{if(!i.isMesh)return;let u=!!i.material?.userData?.cityLook;u&&this.cityAttributes(i.geometry);let l=u?r.material({lit:o,kind:"slot",uv:i.material.userData.cityLook.uv??"uv",side:i.material.side}):i.material;a.push({geometry:i.geometry,material:l,local:i.matrixWorld.clone(),triangles:(i.geometry.index?.count??i.geometry.getAttribute("position").count)/3,city:u})}),a}dropTile(t){t.disposed=!0,this.tiles.delete(t.id),t.group.parent?.remove(t.group);for(let n of t.merged)n.mesh.geometry.dispose();for(let n of t.instanced){for(let r of n.meshes)r.dispose?.();n.stub?.geometry?.dispose?.(),n.meshes.length&&this.units.release(n.unit)}this.pendingHidden=!0,this.revisionN++}syncHidden(){let t=[...this.tiles.values()].filter(o=>o.ready),n=xt(t.map(o=>o.meta)),r=n.join(",");if(r!==this.lastHidden){if(this.host.setHidden(n)===!1)return;this.lastHidden=r}this.host.setReplacedSpecs?.(new Set(t.flatMap(o=>o.meta.specs))),this.pendingHidden=!1}setHighlighted(t,n){this.highlighted=new Set([...t].map(r=>Be(String(r)))),this.focus=n&&this.highlighted.size?n:null;for(let r of this.tiles.values())r.ready&&this.applyHighlight(r);this.host.repaint()}applyHighlight(t){let n=this.host.THREE,r=this.host.cityLook,o=this.recipe,s=c=>this.highlighted.has(Be(t.meta.pands[c]))||t.meta.covers[c].some(d=>this.highlighted.has(d)),a=c=>o.desaturate&&zn(this.focus?.lngLat,c),i=new n.Vector3,u=c=>(i.copy(c).applyMatrix4(t.group.matrix),Tr(i.x,i.y));for(let c of t.merged){let d=c.mesh.geometry.getAttribute("hidden"),h=!1,p=null;(o.desaturate||o.outline||o.rim)&&(c.where??=yi(n,c.mesh,c.verts,u));for(let[y,b]of c.verts){let g=c.where?.get(y),x=s(y)?Ar:g&&this.focus&&a(g.lngLat)?gi:0;if(x===Ar&&g&&(p??=g.local),d.array[b[0]]!==x){for(let I of b)d.array[I]=x;h=!0}}h&&(d.needsUpdate=!0),p&&(o.outline||o.rim)?lt(n,c.mesh,{merged:!0,centre:p}):Te(c.mesh)}let l=new n.Matrix4().makeScale(0,0,0),m=new n.Matrix4,f=new n.Vector3;for(let c of t.instanced)for(let d of c.meshes){for(let p of d.userData.highlights??[])d.parent?.remove(p);d.userData.highlights=[];let h=d.userData.saved??=new Map;for(let p=0;p<c.pands.length;p++){h.has(p)?m.copy(h.get(p)):d.getMatrixAt(p,m);let y=s(c.pands[p])?"highlight":this.focus&&o.desaturate&&a(u(f.setFromMatrixPosition(m)))?"dim":"plain";if(y!=="plain"){let b=d.material?.userData?.cityVariant,g=o.keepMaterials||y==="dim"?d.material:b?r.highlighted(d.material,!0):xi(n,d.material),x=new n.Mesh(d.geometry,g);x.matrixAutoUpdate=!1,x.matrix.copy(m),x.name=`recipe-tile/${y}`,o.keepMaterials&&qn(n,x,y,{cityVariant:(I,F)=>F==="dim"?r.dimmed(I,!0):I}),d.parent.add(x),d.userData.highlights.push(x),h.set(p,m.clone()),d.setMatrixAt(p,l)}else h.has(p)&&(d.setMatrixAt(p,h.get(p)),h.delete(p))}d.instanceMatrix.needsUpdate=!0}}inspectAtScreen(t,n,r,o){let s=this.host.THREE;if(!this.clipFromWorld||!r||!o||!this.root.children.length)return null;let a=t/r*2-1,i=1-n/o*2,u=this.clipFromWorld.clone().invert(),l=new s.Vector3(a,i,-1).applyMatrix4(u),m=new s.Vector3(a,i,1).applyMatrix4(u);this.root.updateWorldMatrix(!0,!0);let f=new s.Raycaster(l,m.sub(l).normalize());for(let c of f.intersectObject(this.root,!0)){let d=c.object.userData?.recipeTile,h=d&&this.tiles.get(d.tile);if(!h?.ready||!c.object.visible)continue;let p=d.ranges?yt(d.ranges,c.faceIndex):d.pands?.[c.instanceId??-1]??-1;if(p<0)continue;let y=c.point.clone().applyMatrix4(this.clipFromWorld).z;if(y<-1||y>1)continue;let b=h.meta.pands[p],g=c.point.clone().applyMatrix4(this.root.matrixWorld.clone().invert()),x=Tr(g.x,g.y);return{id:/^\d{16}$/.test(b)?Be(b):b,name:h.meta.names[p]??b,depth:y,lngLat:x,recipeTile:h.id}}return null}stats(){let t=0,n=0,r=0;for(let o of this.tiles.values()){n+=o.triangles;for(let s of o.merged)s.mesh.visible&&t++;for(let s of o.instanced)t+=s.meshes.length||1,r+=s.pands.length}return{tiles:[...this.tiles.keys()].sort(),ready:[...this.tiles.values()].filter(o=>o.ready).length,loading:this.loading,units:this.units.size,draws:t,triangles:n,instances:r,hidden:this.lastHidden?this.lastHidden.split(",").length:0,errors:this.errors.slice(-5)}}dispose(){for(let t of[...this.tiles.values()])this.dropTile(t);this.host.setHidden([]),this.host.setReplacedSpecs?.(new Set),this.unregister?.()}};function yi(e,t,n,r){let o=new Map,s=t.geometry.getAttribute("position"),a=new e.Vector3;for(let[i,u]of n){let l=0,m=0,f=0;for(let h of u)l+=s.getX(h),m+=s.getY(h),f+=s.getZ(h);let c=Math.max(1,u.length),d=[l/c,m/c,f/c];o.set(i,{local:d,lngLat:r(a.set(...d).applyMatrix4(t.matrix))})}return o}function Tr(e,t){let n=e*360-180,r=180-t*360;return[n,360/Math.PI*Math.atan(Math.exp(r*Math.PI/180))-90]}var kr=new WeakMap;function xi(e,t){let n=kr.get(t);return n||(n=new e.MeshLambertMaterial({color:16765471,emissive:7033856,side:t?.side??e.FrontSide}),kr.set(t,n)),n}function Or(){let e=globalThis;return new URL(e.__canalRecallRecipeTilesBase??"./recipe-tiles/",e.location.href).href}async function Mi(e){let t=globalThis.CanalRecallThree,n=t?.THREE,r=e._sharedFrame??e._ensureSharedFrame?.();if(!n||!r)throw Error("recipe tiles need the shared frame (?sharedFrame=1 is implied by ?recipeTiles=1)");let o=new t.GLTFLoader;t.MeshoptDecoder&&o.setMeshoptDecoder(t.MeshoptDecoder);let s=new Set,a=()=>{let l=e._signatureLandmarks;if(!l||l.__recipeTilesWrapped)return;let m=l.canShowModel.bind(l);l.canShowModel=f=>!s.has(f.id)&&m(f),l.__recipeTilesWrapped=!0},i={THREE:n,frame:r,baseUrl:Or(),lit:!0,cityLook:wr(n,{anisotropy:globalThis.matchMedia?.("(pointer: coarse)").matches?1:Me("slotCells",16).anisotropy}),loadGltf:l=>o.loadAsync(l),getCentre:()=>e.map?.getCenter?.(),setHidden:l=>{let m=e._threeBuildings;return m?.setHidden?(m.setHidden("recipe-tiles",l),e._pyramidalRoofs?.setHiddenReason?.("recipe-tiles",l),!0):!1},setReplacedSpecs:l=>{a(),s=l,e.map?.triggerRepaint?.()},repaint:()=>e.map?.triggerRepaint?.()},u=new xe(i);return globalThis.__canalRecallTileBuildings=u,await u.start(),u}return Nr(wi);})();

"use strict";var CanalRecallTileBuildings=(()=>{var pt=Object.defineProperty;var ss=Object.getOwnPropertyDescriptor;var as=Object.getOwnPropertyNames;var is=Object.prototype.hasOwnProperty;var ls=(e,t)=>{for(var n in t)pt(e,n,{get:t[n],enumerable:!0})},us=(e,t,n,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of as(t))!is.call(e,o)&&o!==n&&pt(e,o,{get:()=>t[o],enumerable:!(r=ss(t,o))||r.enumerable});return e};var cs=e=>us(pt({},"__esModule",{value:!0}),e);var Wu={};ls(Wu,{RefCache:()=>He,TileBuildings:()=>Ge,coverUnion:()=>mn,mountRecipeTiles:()=>Nu,pandOfFace:()=>fn,recipeTilesBase:()=>os,recipeTilesEnabled:()=>rs,wantedTiles:()=>dn});var hn={minFilter:"LinearMipmapLinear",magFilter:"Linear",generateMipmaps:!0};function ds(e,t){let n=t.coarse?128:256,r=e==="facadeCells"?Math.min(t.gpuMaxAnisotropy,t.coarse?4:16):4;return{...hn,cellPx:n,anisotropy:r,tierScale:1}}function fs(e,t){if(!t.enabled||t.coarse||t.tier!=="high")return ds(e,t);let n=Number.isFinite(t.gpuMaxAnisotropy)&&t.gpuMaxAnisotropy>=1?t.gpuMaxAnisotropy:1,r=Number(t.cellPx),o=Number.isInteger(r)&&r>256&&r<=512&&r%32===0?r:256,a=Number(t.facadeAnisotropy),s=e==="facadeCells"?Number.isFinite(a)&&a>=1?Math.min(a,16):4:16;return{...hn,cellPx:o,anisotropy:Math.min(n,s),tierScale:o/256}}function ms(){try{let e=globalThis,t=Number(e.__canalRecallTexAniso??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texAniso"):null)??NaN);return Number.isFinite(t)&&t>=1?t:null}catch{return null}}function hs(){try{let e=globalThis,t=e.__canalRecallTexturePolicy??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texturePolicy"):null);return!(t===!1||t==="0"||t==="false"||t==="off")}catch{return!0}}function ps(){try{let e=globalThis,t=Number(e.__canalRecallCellPx??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("cellPx"):null)??NaN);return Number.isFinite(t)&&t>0?t:null}catch{return null}}function bs(){let e=globalThis.__canalPerf?.tier;return e==="low"||e==="mid"||e==="high"?e:null}function gs(){return!!globalThis.matchMedia?.("(pointer: coarse)").matches}function Ue(e,t){return fs(e,{tier:bs(),coarse:gs(),gpuMaxAnisotropy:t,enabled:hs(),cellPx:ps(),facadeAnisotropy:ms()})}var q={k:.2,minL:.34,maxL:.93,chroma:2.4,maxC:.12,hue:{pull:.5,toward:40,warm:[20,85],capAt:[45,70],capC:[.12,.06]},neutralC:[.015,.03],coolKeep:.35,darkL:[.38,.46],darkGain:.35,darkLift:[.3,.5],paleL:[.65,.72],paint:{c0:.01,c1:.018,l0:.45,l1:.6}};function ys(e,t){let{c0:n,c1:r,l0:o,l1:a}=q.paint,s=i=>Math.max(0,Math.min(1,i));return 1-(1-s((t-n)/(r-n)))*(1-s((e-o)/(a-o)))}var bt=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},Ms=e=>255*(e<=.0031308?12.92*e:1.055*e**(1/2.4)-.055);function G(e){let t=parseInt(e.slice(1),16),n=bt(t>>16&255),r=bt(t>>8&255),o=bt(t&255),a=Math.cbrt(.4122214708*n+.5363325363*r+.0514459929*o),s=Math.cbrt(.2119034982*n+.6806995451*r+.1073969566*o),i=Math.cbrt(.0883024619*n+.2817188376*r+.6299787005*o);return[.2104542553*a+.793617785*s-.0040720468*i,1.9779984951*a-2.428592205*s+.4505937099*i,.0259040371*a+.7827717662*s-.808675766*i]}function gt([e,t,n]){let r=(e+.3963377774*t+.2158037573*n)**3,o=(e-.1055613458*t-.0638541728*n)**3,a=(e-.0894841775*t-1.291485548*n)**3;return[4.0767416621*r-3.3077115913*o+.2309699292*a,-1.2684380046*r+2.6097574011*o-.3413193965*a,-.0041960863*r-.7034186147*o+1.707614701*a]}var pn=e=>e.every(t=>t>=-1e-4&&t<=1+1e-4);function Ce(e){let[t,n,r]=e,o=gt([t,n,r]);if(!pn(o)){let a=0,s=1;for(let i=0;i<20;i++){let u=(a+s)/2;pn(gt([t,n*u,r*u]))?a=u:s=u}n*=a,r*=a,o=gt([t,n,r])}return"#"+o.map(a=>Math.round(Math.max(0,Math.min(255,Ms(Math.max(0,Math.min(1,a)))))).toString(16).padStart(2,"0")).join("")}function gn(e,t={}){let[n,r,o]=G(e),a=Math.hypot(r,o),s=ys(n,a),i=q.k*s*Math.max(0,Math.min(1,(n-q.darkLift[0])/(q.darkLift[1]-q.darkLift[0]))),u=Math.min(q.maxL,Math.max(t.minL??q.minL,1-(1-n)*(1-i)));if(t.fromPixel===!1||a<1e-6)return Ce([u,r,o]);let l=q,c=Math.atan2(o,r)*180/Math.PI;return c<l.hue.warm[0]||c>l.hue.warm[1]?Ce([u,r*l.coolKeep,o*l.coolKeep]):Ce([u,r,o])}var ws=["white","grey","buff","orange","red","red-brown","brown","dark"],yt={white:"#e8e4da",grey:"#8a8d8f",buff:"#c4a574",orange:"#b8643c",red:"#9c4433","red-brown":"#8a4a3c",brown:"#6a4c3e",dark:"#2b2b2e"},xs=["brown","red-brown","red","orange","buff"];function bn(e,t=ws){let[n,r,o]=G(e),a=t[0],s=1/0;for(let i of t){let[u,l,c]=G(yt[i]),d=Math.hypot(n-u,r-l,o-c);d<s&&(s=d,a=i)}return a}var Ss=.05;function yn(e,t){let n=t.family??(t.brick?bn(e,xs):null);if(!n)return{hex:e,fromPixel:!0,family:null};let r=G(e)[0]>G(yt[n])[0]+Ss,o=!!t.family&&bn(e)!==t.family;return r&&(t.brick||o)?{hex:yt[n],fromPixel:!1,family:n}:{hex:e,fromPixel:!0,family:n}}var Rs=!1;function ks(e,t){let n=(e?/[?&]modelWallFloor=([01])\b/.exec(e)?.[1]:void 0)??t??void 0;return n==="1"?!0:n==="0"?!1:Rs}var Mt;function Mn(){if(Mt!==void 0)return Mt;let e=globalThis;return Mt=ks(e.location?.search??null,e.process?.env?.MODEL_WALL_FLOOR??null)}function wn(e,t){let n=yn(t,{brick:!0}),r=G(gn(n.hex,{fromPixel:n.fromPixel}))[0],[o,a,s]=G(e);return o<=r+1e-4?e:Ce([r,a*r/o,s*r/o])}var P={other:0,wall:1,roof:2,lid:3,trim:4,cornice:5,frontage:6,extrasStrip:7,extrasBox:8,extrasOther:9,shell:10},vs=[{name:"other",id:P.other,rgb:[0,0,0]},{name:"wall",id:P.wall,rgb:[255,255,255]},{name:"roof",id:P.roof,rgb:[255,0,0]},{name:"lid",id:P.lid,rgb:[128,0,128]},{name:"trim-decal",id:P.trim,rgb:[0,255,0]},{name:"cornice",id:P.cornice,rgb:[0,0,255]},{name:"frontage",id:P.frontage,rgb:[255,255,0]},{name:"extras-strip",id:P.extrasStrip,rgb:[255,0,255]},{name:"extras-box",id:P.extrasBox,rgb:[0,255,255]},{name:"extras-other",id:P.extrasOther,rgb:[128,128,0]},{name:"shell",id:P.shell,rgb:[0,128,128]}],xn=1,As=2,_s=4e-6;var $s=(e,t)=>e*t/2;function Cs(e){let t=[e[1],e[5],e[9]],n=[e[3],e[7],e[11]],r=Math.hypot(n[0],n[1],n[2]);if(!(r>1e-12))return Math.hypot(t[0],t[1],t[2]);let o=(t[0]*n[0]+t[1]*n[1]+t[2]*n[2])/r;return Math.sqrt(Math.max(0,t[0]**2+t[1]**2+t[2]**2-o*o))/r}function kn(e){try{return typeof URLSearchParams=="function"?new URLSearchParams(globalThis.location?.search??"").get(e):null}catch{return null}}function Fs(){let t=globalThis.__canalRecallThinFade??kn("thinFade");return!(t===!1||t==="0"||t==="false"||t==="off")}function Ts(){return(globalThis.__canalRecallThinDebug??kn("thinDebug"))==="owner"?"owner":null}var Fe=e=>Number.isInteger(e)?e.toFixed(1):String(e),Ls=e=>`vec3(${e.map(t=>(t/255).toFixed(4)).join(", ")})`,Es=`
attribute vec2 thin;
varying float vThinM;
flat varying float vThinClass;
`,Os=`
vThinM = thin.x * 0.01; vThinClass = thin.y;
#ifdef CITY_THIN_FADE
if (thin.y > ${Fe(P.trim-.5)} && thin.y < ${Fe(P.trim+.5)}) gl_Position.z -= ${_s.toExponential()} * gl_Position.w;
#endif
`,Is=`
uniform float thinFocalPx;
varying float vThinM;
flat varying float vThinClass;
vec3 thinOwnerColour(float c) {
${vs.map(e=>`  if (c < ${Fe(e.id+.5)}) return ${Ls(e.rgb)};`).join(`
`)}
  return vec3(0.5);
}
`,Ps=`
#ifdef CITY_THIN_FADE
if (vThinM > 0.0) {
  float thinPx = vThinM * thinFocalPx / max(vFacDist, 0.01);
  float thinCover = clamp((thinPx - ${Fe(xn)}) / ${Fe(As-xn)}, 0.0, 1.0);
  if (thinCover < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= thinCover) discard;
}
#endif
`,Sn=`
#ifdef CITY_THIN_OWNER
gl_FragColor = vec4(thinOwnerColour(vThinClass), 1.0);
#endif
`,wt={value:1e3};function Ds(e){if(e?.getCurrentViewport){let t=e.getCurrentViewport(Bs);if(t&&t.w>0)return t.w}return e?.getDrawingBufferSize?e.getDrawingBufferSize(Ns).y:0}var Bs={x:0,y:0,z:0,w:0,copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w,this}},Ns={x:0,y:0,set(e,t){return this.x=e,this.y=t,this},floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}};function Rn(e,t,n){let r="void main() {",o=/vFacDist = length\([^;]*\);/,a="if (HL_GHOST(vHighlight)) discard;";if(!e.includes(r)||!o.test(e)||!t.includes(r)||!t.includes(a))return null;let s=e.replace(r,`${Es}${r}`).replace(o,u=>`${u}${Os}`),i=t.replace(r,`${Is}${r}`).replace(a,`${a}${Ps}`);if(n){if(!i.includes("#include <dithering_fragment>"))return null;i=i.replace("#include <dithering_fragment>",`#include <dithering_fragment>${Sn}`)}else{let u=i.lastIndexOf("}");i=`${i.slice(0,u)}${Sn}${i.slice(u)}`}return{vertex:s,fragment:i}}function vn(e,t,n={}){let r=n.fade??Fs(),o=n.debug===void 0?Ts():n.debug;if(!r&&!o)return e;if(e.defines={...e.defines??{},...r?{CITY_THIN_FADE:""}:{},...o?{CITY_THIN_OWNER:""}:{}},e.defaultAttributeValues={...e.defaultAttributeValues??{},thin:[0,0]},t){let s=e.onBeforeCompile;e.onBeforeCompile=function(i,u){s?.call(this,i,u);let l=Rn(i.vertexShader,i.fragmentShader,!0);l&&(i.vertexShader=l.vertex,i.fragmentShader=l.fragment,i.uniforms.thinFocalPx=wt)}}else{let s=Rn(e.vertexShader,e.fragmentShader,!1);if(!s)return e;e.vertexShader=s.vertex,e.fragmentShader=s.fragment,e.uniforms={...e.uniforms,thinFocalPx:wt}}let a=e.onBeforeRender;return e.onBeforeRender=function(s,i,u,...l){a?.call(this,s,i,u,...l);let c=Ds(s),d=u?.projectionMatrix?.elements,f=d?Cs(d):NaN;c>0&&Number.isFinite(f)&&f>0&&(wt.value=$s(f,c))},e.userData={...e.userData??{},thinFade:r,thinDebug:o},e}var An=e=>{let t=globalThis,n=new RegExp(`[?&]${e}=([^&]*)`).exec(t.location?.search??"");return n?decodeURIComponent(n[1]):null};function xt(){let t=globalThis.__canalRecallDrawLimit??An("drawLimit");return t===!0||t==="1"||t==="true"||t==="on"?!0:!(t===!1||t==="0"||t==="false"||t==="off")}var Ws=e=>Number.isInteger(e)?`${e}.0`:`${e}`,_n=`(fogNear * (1.0 + fract(fogFar) * ${Ws(8)}))`;var Hs=!0;function $n(){if(!xt())return!1;let e=globalThis.__canalRecallLandmarkHaze??An("landmarkHaze");return e===!0||e==="1"||e==="true"||e==="on"?!0:e===!1||e==="0"||e==="false"||e==="off"?!1:Hs}var Cn="DEPTH_FADE_LIMIT_ONLY";var Gs=.5,Us=.38,Fn=250,js=600,Vs=.4;function Tn(){let e=globalThis,t=typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("fadeStrength"):null,n=e.__canalRecallFadeStrength??t,r=n==null||n===""?NaN:Number(n);return Number.isFinite(r)?Math.max(0,Math.min(2,r)):1}var ne=e=>Number.isInteger(e)?`${e}.0`:`${e}`;var zs=(e=Tn())=>`#ifdef USE_FOG
	float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	float fadeLuma = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( fadeLuma ), fogFactor * ${ne(Gs*e)} );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * ${ne(Us*e)} );
#endif`,Xu=zs(1),Ln=`uniform vec3 fogColor;
	varying vec3 vFogEye;
	#define vFogDepth length( vFogEye )
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif`,Zu=`#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
	${Ln}
#endif`,En=`
#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
#define DEPTH_FADE_FOG_PARS
	${Ln}
#endif
`,St=(e,t=Tn(),n=xt())=>{let r=n?_n:"fogFar";return`${ne(Math.min(1,t))} * smoothstep(max(${ne(Fn)}, fogNear), max(max(${ne(js)}, fogNear + (${r} - fogNear) * ${ne(Vs)}), max(${ne(Fn)}, fogNear) + 1.0), ${e})`};var qs="canalRecallDepthFadeOptOut";function On(e,t=$n()){t&&e.fog!==!1?e.defines={...e.defines??{},[Cn]:""}:e.fog=!1,e.userData={...e.userData??{},[qs]:!0}}var Ks=.7,Ys=46,Xs=null,Zs=()=>Xs??=[H["pantile-red"].hex,H["pantile-dark"].hex,de[0],de[1],H.gravel.hex,H["bitumen-dark"].hex,H["white-membrane"].hex];function Js(e,t){let n=globalThis,r=n[t]??(typeof URLSearchParams=="function"?new URLSearchParams(n.location?.search??"").get(e):null);return r===!0||r==="1"||r==="true"||r==="on"}var Qs=null;var Rt=()=>Qs??=Js("roofFamily","__canalRecallRoofFamily");var ea=(e,t)=>Math.hypot(e[0]-t[0],e[1]-t[1],e[2]-t[2]);function ta(e,t=Zs(),n=Ys){let r=x(e),o=null,a=n;for(let s of t){let i=ea(r,x(s));i<=a&&(a=i,o=s)}return o}function kt(e,t=Ks){let n=ta(e);if(!n)return e;let r=x(e),o=x(n);return R([0,1,2].map(a=>r[a]+(o[a]-r[a])*t))}function na(e,t){let n=(e?/[?&]measuredSingleGain=([01])\b/.exec(e)?.[1]:void 0)??t??void 0;return n==="1"}var vt;function At(){if(vt!==void 0)return vt;let e=globalThis;return vt=na(e.location?.search??null,e.process?.env?.MEASURED_SINGLE_GAIN??null)}function In(){let e=globalThis;return(e.__canalRecallLook??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("look"):null))==="toon"}var E=["#a8503a","#9a4a38","#8c4632","#b05a40","#7a3b2c"],Te=["#2b2d2c","#2f4a3a","#5a2a26","#25344a"],fe=["#e8dfc9","#f1eee6","#d3b184","#e2d5ba"],_t=[E[0],E[0],E[1],E[2],E[3],E[4],Te[0],Te[1],Te[2],fe[0],fe[2]],Pn=["#2f4a3a","#25344a","#5a2a26","#2b2d2c","#e0a526"],Dn={canal:[E[4],E[4],E[1],E[2],Te[0],Te[1],fe[0]],c19:[E[0],E[3],E[1],fe[3],fe[2],fe[0]],school:[E[2],E[4],E[1],E[3]]},Bn=["#f1eee6","#f1eee6","#f1eee6","#e8dfc9","#e8dfc9","#2b2d2c","#2f4a3a","#5a2a26","#25344a","#8b8f8c"];function Nn(){if(!In())return!1;let e=globalThis;return(e.__canalRecallToonFronts??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("toonFronts"):null))!=="candy"}var Ee=225;var $t={wallPull:.7,glassLift:.5,liftBrick:!0},Wn={wallPull:.35,glassLift:.25,liftBrick:!1},lc={photo:{cells:"photo",shadeBands:0,flatColour:!1,...$t,cartoonRoofCells:!1,outline:!1,litWallGain:255/Ee},procedural:{cells:"procedural",shadeBands:0,flatColour:!1,...$t,cartoonRoofCells:!1,outline:!1,litWallGain:1},untextured:{cells:"procedural",shadeBands:0,flatColour:!0,...$t,cartoonRoofCells:!1,outline:!1,litWallGain:1},storybook:{cells:"storybook",shadeBands:0,flatColour:!1,...Wn,cartoonRoofCells:!1,outline:!0,litWallGain:1,tone:{hueShift:-4,satMul:1.15,satAdd:0,keepDarkBelow:0,lightMul:1,lightAdd:.03,lightMax:.9}},cartoon:{cells:"cartoon",shadeBands:3,flatColour:!1,...Wn,cartoonRoofCells:!0,outline:!0,litWallGain:1,tone:{hueShift:0,satMul:1.7,satAdd:.08,keepDarkBelow:.35,lightMul:1.08,lightAdd:0,lightMax:.85}}};var re=(e,t,n)=>Math.max(t,Math.min(n,e));function x(e){let t=/^#?([0-9a-f]{6})$/i.exec(e.trim());if(!t)throw Error(`Bad colour ${e}`);let n=parseInt(t[1],16);return[n>>16&255,n>>8&255,n&255]}var R=e=>"#"+e.map(t=>Math.round(re(t,0,255)).toString(16).padStart(2,"0")).join("");function k([e,t,n]){let r=e/255,o=t/255,a=n/255,s=Math.max(r,o,a),i=Math.min(r,o,a),u=(s+i)/2;if(s===i)return[0,0,u];let l=s-i,c=u>.5?l/(2-s-i):l/(s+i);return[(s===r?(o-a)/l+(o<a?6:0):s===o?(a-r)/l+2:(r-o)/l+4)*60,c,u]}function L([e,t,n]){let r=(1-Math.abs(2*n-1))*t,o=r*(1-Math.abs(e/60%2-1)),a=n-r/2,[s,i,u]=e<60?[r,o,0]:e<120?[o,r,0]:e<180?[0,r,o]:e<240?[0,o,r]:e<300?[o,0,r]:[r,0,o];return[(s+a)*255,(i+a)*255,(u+a)*255]}var Zn=(e,t,n)=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n];var Ct={canal:-1/0,c19:1860,school:1915,modern:1945};var de=["#76808f","#606b79","#8c939c"],Le={procedural:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:de},untextured:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:de},photo:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:de},storybook:{tile:["#b9553a","#a94a33","#c46a45"],slate:["#556070","#4a5666","#657282"]},cartoon:{tile:["#e85a3c","#f08a2b","#d94a3a"],slate:["#3f5f8f","#2f4a78","#4f7bb0"]}};var H={gravel:{hex:"#9e9281",luma:[112,156],cell:"flat"},"bitumen-dark":{hex:"#56585e",luma:[62,96],cell:"flat"},"bitumen-light":{hex:"#a99b84",luma:[150,182],cell:"flat"},"white-membrane":{hex:"#d9d9d3",luma:[196,228],cell:"flat"},"pantile-red":{hex:"#b5543a",luma:[84,124],cell:"tile"},"pantile-dark":{hex:"#6a5248",luma:[64,98],cell:"tile"},slate:{hex:"#76808f",luma:[62,140],cell:"slate"},zinc:{hex:"#9aa1a6",luma:[138,176],cell:"slate"},sedum:{hex:"#7a8350",luma:[96,132],cell:"flat"},solar:{hex:"#2e3a52",luma:[44,70],cell:"flat"},terrace:{hex:"#a38d74",luma:[124,162],cell:"flat"},glass:{hex:"#8fa3ad",luma:[130,170],cell:"flat"}},je={gravel:H.gravel.hex,membrane:H["white-membrane"].hex,bitumen:H["bitumen-dark"].hex,pebble:H["bitumen-light"].hex},Jn=[je.gravel,je.membrane,je.bitumen,je.pebble];var U={tile:Le.photo.tile,slate:Le.photo.slate,flat:Jn};var Hn=["#d9674a","#e58a5c","#eab85f","#f0dfb8","#e5a396","#9dbb9b","#7ea3c2","#c9714a","#f2c14e","#b9a1c9"],Gn=["#2a8c8c","#e0a526","#d9453d","#2c4a7c","#7a3b6e","#2f6b45","#4aa3d9"],Un={canal:{walls:Hn,accents:Gn},c19:{walls:Hn,accents:Gn},school:{walls:["#9c5a42","#8a4b3a","#a8664c","#7a4a40"],accents:["#2c4a7c","#2a8c8c","#e0a526"]},modern:{walls:["#f4efe6","#dcdcd6","#e9d9c0","#b9c4cc","#f0c9a9"],accents:["#2a8c8c","#d9453d","#2c4a7c","#e0a526"]}},jn=["#ffffff","#f2d9c8","#d9b9a4","#e6c9b0","#c9a38c","#f0e4d2","#ffd9b0","#e8c0b0","#d0c8c0"],Vn=["#243a2f","#1f2a3a","#3a1f1c","#222222","#2f4a3c","#6b2b2b","#2c3e50"],zn={cartoon:Un,storybook:Un,photo:{canal:{walls:jn,accents:Vn},c19:{walls:jn,accents:Vn},school:{walls:["#b89080","#a88070","#9c7868"],accents:["#1f2a3a","#243a2f","#3a1f1c"]},modern:{walls:["#f2f2ee","#d8d8d2","#e8dcc8","#c8d0d4"],accents:["#2c3e50","#6b2b2b","#243a2f"]}}};var qn=["#e8573d","#e8573d","#ee7f2c","#f2b92e","#f2b92e","#2a9d8f","#4672b0","#f3e6c8","#d96a4d"],he={photo:{canal:["#7a3b2c","#7a3b2c","#6b3428","#8c4632","#9a5846","#b05a40","#4a2e26","#2e2a27","#3e4a40","#5d605a","#e4ddcd"],c19:["#b05a40","#b05a40","#bd6a45","#a24d38","#c58b5e","#d3b184","#e2d5ba","#e2d5ba","#d9c5a4","#9a5846"],school:["#8c4a38","#7a4535","#9a5240","#6e3d33","#a85a3c","#5e3a32","#b0603f"],modern:["#c9b79a","#b9ad9a","#a8a49c","#d3c6ad","#8f8a82","#bfb3a0","#9c7a62","#b05a40"]},storybook:{canal:["#b9583f","#9a4a38","#7a4a3c","#4a5048","#3f4a5a","#ead9b0","#c8664a"],c19:["#c8664a","#d98b5f","#e0b36a","#ead9b0","#d9b995","#c9a08c","#c8664a"],school:["#a8553f","#9a5a48","#b87a5c","#c8664a","#8a4e40"],modern:null},cartoon:{canal:["#d9453d","#a8433a","#3b3b4a","#2a9d8f","#4672b0","#fffaf0","#e8573d"],c19:["#e8573d","#ee7f2c","#f2b92e","#f3e6c8","#d96a4d","#f2b92e"],school:["#d96a4d","#e8573d","#b9583f","#ee7f2c"],modern:null}},ra={photo:["#f1eee6","#f1eee6","#f1eee6","#e8dfc9","#e8dfc9","#2b2d2c","#2f4a3a","#5a2a26","#25344a","#8b8f8c"],storybook:["#f6f1e4","#f6f1e4","#f6f1e4","#efe2c2","#efe2c2","#3a3d3c","#3f6a52","#8a3b33","#3a527a","#a3a8a4"],cartoon:["#fffaf0","#fffaf0","#fffaf0","#ffe9b8","#ffe9b8","#3b3b4a","#2a9d8f","#d9453d","#4672b0","#f2b92e"]};if(Nn()){for(let t of["canal","c19","school"])he.cartoon[t]=Dn[t];let e={walls:[..._t],accents:[...Pn]};zn.cartoon={canal:e,c19:e,school:e,modern:zn.cartoon.modern},qn.splice(0,qn.length,..._t),ra.cartoon=Bn}var oa={canal:{label:"canal-house centre (before 1860)",wall:he.photo.canal[0],roof:Le.photo.tile[0]},c19:{label:"19th-century ring (1860-1914)",wall:he.photo.c19[0],roof:Le.photo.tile[1]},school:{label:"Amsterdamse School (1915-1944)",wall:he.photo.school[0],roof:Le.photo.slate[0]},modern:{label:"post-war and contemporary (1945+)",wall:he.photo.modern[0],roof:Jn[0]}};var Qn=["brick","stucco","accent","stone","frame","door","glass","roofTile","slate","bitumen","paint"],Ft={brick:"brick",accent:"brick",stucco:"stucco",stone:"stone",frame:"frame",door:"door",glass:"glass",roofTile:"tile",slate:"slate",bitumen:"flat",paint:"frame"},N={brick:3.36,stucco:2.4,accent:3.36,stone:1.28,frame:1,door:1,glass:1,roofTile:1.2,slate:1.2,bitumen:1.2,paint:1},Y=[.3,.6],sa="#f1ede2",aa="#cfc8b8";function ia(e){let[t,n,r]=k(x(e)),o=re(.12+r*.9,Y[0],Y[1]);return R(L([t,re(n,.12,.5),o]))}function la(e){let[t,n,r]=k(x(e));return R(L([t,re(n,0,.55),re(r*1.06+.03,.4,.97)]))}function ua(e){let t=x(e),[n,r,o]=k(t);return o>=.5?R(Zn(t,x(sa),.75)):R(L([n,r,Math.max(o,.16)]))}function ca(e){let[t,n,r]=k(x(e));return R(Zn(L([t,n,Math.max(r,.62)]),x(aa),.45))}function da(e){let[t,n,r]=k(x(e));return r>=.17?e.startsWith("#")?e.toLowerCase():"#"+e.toLowerCase():R(L([t,n<.15?0:n,.17]))}function fa(e,t){let n=k(x(t))[2];if(e==="roofTile"){let[r,o]=k(x(t));return o<.2?U.slate[1]:R(L([r,re(o*1.1,.35,.6),re(.2+n*.85,.38,.5)]))}return e==="slate"?n<.27?U.slate[1]:n<.31?U.slate[0]:U.slate[2]:n<.4?U.flat[2]:U.flat[0]}var me="measured",ma=.18,er=Ee/255;function ha(e){let[t,n,r]=k(x(e)),[o,a,s]=x(R(L([t,n,Math.max(r,ma)]))),i=At()?1:er;return R([o,a,s].map(u=>Math.min(255,Math.round(u/i))))}var oe=32,se=64,K=[157.19,92.83,69.17],tr=240.95,nr=.16,pa=255/(K[0]+(tr-K[0])*nr);function Tt(e,t){let n=t/(se-1),r=n<.5?K[0]+(K[1]-K[0])*(n/.5):K[1]+(K[2]-K[1])*((n-.5)/.5),o=5-15*t/35,a=17-15*t/35,s=t<35&&e+.5>=o&&e+.5<a;return Math.min(255,Math.round((s?r+(tr-r)*nr:r)*pa))}var ba=(()=>{let e=0;for(let t=0;t<se;t++)for(let n=0;n<oe;n++)e+=Tt(n,t);return e/(oe*se)})(),Kn=.4;function ga(e){let[t,n,r]=k(x(e)),a=(r>=Kn?x(e):L([t,n,Kn])).map(i=>i/(ba/255)),s=Math.max(1,...a.map(i=>i/255));return R(a.map(i=>Math.min(255,Math.round(i/s))))}var ya=228/255;function Ma(e){let t=At()?1:ya;return R(x(e).map(n=>Math.min(255,Math.round(n/t))))}function Yn(e){return R(x(e))}function Xn(e){return R(x(e))}var wa=["brick","accent","glass","stone","bitumen","slate","roofTile"],Lt=(e,t)=>t===me&&wa.includes(e);function Ve(e,t,n){if(n===me&&(e==="brick"||e==="accent"))return ha(t);if(n===me&&e==="glass")return ga(t);if(n===me&&e==="stone")return Ma(t);if(n===me&&e==="bitumen")return Rt()?kt(Yn(t)):Yn(t);if(n===me&&(e==="slate"||e==="roofTile"))return Rt()?kt(Xn(t)):Xn(t);switch(e){case"brick":case"accent":return ia(t);case"stucco":return la(t);case"stone":return ca(t);case"frame":return ua(t);case"door":return da(t);case"glass":return"#ffffff";case"paint":return t.startsWith("#")?t.toLowerCase():"#"+t.toLowerCase();default:return fa(e,t)}}var Et={asphalt:{base:[86,88,93]},cycle:{base:[150,66,58]},klinker:{base:[122,90,80],joint:"#4b3d38"},pavement:{base:[174,162,152],joint:"#7f756b"},kerb:"#cfcac0",paint:"#f2f0ea",rail:"#6c6e72",bollard:"#5a2a26"},rr="#ffd21f",or="#ff8033",sr="#b4682c";var ar={land:{base:[168,158,142],joint:"#857b6d"},paving:{base:[184,174,158],joint:"#8f8577"},square:{base:[190,179,161],joint:"#958a7c"},klinker:{base:[158,124,114],joint:"#7a6660"},asphalt:[68,72,80],cycle:[156,76,66],gravel:[180,166,136],park:[96,140,70],wood:[70,112,58],parking:[102,102,105],kerb:"#aaa498",water:"#46707c",lawn:[110,154,74],bed:{soil:[98,80,60],leaf:[84,122,58]},shrub:{base:[56,92,46],leaf:[76,116,56]},bark:[118,84,58],sand:[212,194,150],parkGravel:[198,184,152],parkPath:[110,110,112],pond:"#46707c",bare:{base:[160,144,122],grit:[186,174,156]}};var It="inferred",xa=e=>k(x(e))[1]<.2,Sa=e=>{let[t,n,r]=k(x(e));return(t<45||t>340)&&n>=.15&&r<.7},Ra=e=>xa(e)?"slate":"roofTile",Ot=e=>Sa(e)?"brick":"stucco",ka=[{test:/glass|glaz|window|vitr|ruit|pane/,slot:"glass",confidence:"name",rule:"glazing name"},{test:/decal|sign|mural|logo|letter|clock|dial/,slot:"paint",confidence:"name",rule:"signage / decal"},{test:/door|deur|gate/,slot:"door",confidence:"name",rule:"door name"},{test:/frame|kozijn|louvre|louver|blind|shutter|rail|mullion|sash/,slot:"frame",confidence:"name",rule:"joinery name"},{test:/brick|baksteen|klinker|terracotta/,slot:"brick",confidence:"name",rule:"brick name"},{test:/slate|leien|lei$/,slot:"slate",confidence:"name",rule:"slate name"},{test:/bitumen|asphalt|tar$|felt|flatroof|flat-roof|gravel/,slot:"bitumen",confidence:"name",rule:"flat roof name"},{test:/roof|tile|pantile|dakpan|dak/,slot:Ra,confidence:"name",rule:"roof name, grey \u2192 slate, else pantile"},{test:/sandstone|stone|steen|column|marble|granite|limestone|plinth/,slot:"stone",confidence:"name",rule:"stone name"},{test:/stucco|render|plaster|pleister|concrete|beton|slab/,slot:"stucco",confidence:"name",rule:"render / concrete name"},{test:/gold|gilt|bronze|copper|brass|zinc|metal|steel|iron|lead|alu/,slot:"paint",confidence:"name",rule:"metal name (flat colour)"},{test:/wall|facade|gevel/,slot:Ot,confidence:"name",rule:"wall name, brick hue \u2192 brick, else stucco"},{test:/ochre|yellow|buff/,slot:Ot,confidence:"colour-word",rule:"ochre: yellow brick (brick hue) or render"},{test:/pink|rose/,slot:"stucco",confidence:"colour-word",rule:"pink: painted render"},{test:/moss|grass|green|blue|orange|purple|paint|teal/,slot:"paint",confidence:"colour-word",rule:"coloured paint word"},{test:/white|cream|ivory/,slot:"stucco",confidence:"colour-word",rule:"white: stucco (could be white trim)"},{test:/dark|black|charcoal|anthracite/,slot:"frame",confidence:"colour-word",rule:"dark: painted joinery / ironwork (could be a dark wall)"},{test:/red/,slot:Ot,confidence:"colour-word",rule:"red: brick hue \u2192 brick (could be red tile or paint)"},{test:/grey|gray/,slot:"stucco",confidence:"colour-word",rule:"grey: render (could be concrete or zinc)"}];function ir(e){return String(e??"").toLowerCase().replace(/[-_.\s]*\d+$/,"").trim()}function va(e){let[t,n,r]=k(x(e));return r<.22?{slot:"frame",rule:"very dark: joinery / ironwork"}:n>=.15&&(t<45||t>340)&&r<.62?{slot:"brick",rule:"brick hue"}:n<.2&&r>=.6?{slot:"stucco",rule:"pale neutral: render"}:n<.2&&r>=.22&&t>180&&t<260?{slot:"slate",rule:"blue-grey: slate"}:n<.25?{slot:"stone",rule:"neutral mid-tone: stone"}:{slot:"paint",rule:"saturated colour: paint"}}function lr(e,t){let n=t.toLowerCase(),r=ir(e);for(let a of ka)if(a.test.test(r))return{slot:typeof a.slot=="function"?a.slot(n):a.slot,tint:n,confidence:a.confidence,rule:a.rule};let o=va(n);return{slot:o.slot,tint:n,confidence:"colour",rule:`no material word in "${r||"unnamed"}"; ${o.rule}`}}var ur=e=>/white|cream|ivory/.test(ir(e)),Pt=e=>typeof e=="string"&&Qn.includes(e);var C=.045;var Bt={ribs:{pitch:.5,min:.25,max:2,w:.09,out:.04},boards:{pitch:.4,min:.15,max:1.5,w:.05,out:.035},louvres:{pitch:.35,min:.2,max:1,w:.12,out:.12},panels:{pitch:1.2,min:.6,max:6,w:.05,out:.035}};var Uc={min:.15,max:Bt.ribs.max};var Da={installGate:{groups:!0,core:!1,solidBody:!0,clusterWall:!1},houseLine:{groups:!0,core:!0,solidBody:!0,clusterWall:!0}},Td={...Da.installGate};var br={canal:["#6e5352","#8c7768","#977f73","#a79276","#b8a17a","#575245","#60564b","#62544d","#61584c","#655850","#655b50","#6a5454","#6f6058","#726359","#726459","#76615d","#77685d","#7a6c60","#826c66","#918174","#9a887f","#a89f8a","#6b6163","#dfdcd2"],c19:["#70564f","#6f5b52","#7a665c","#86695b","#886a5f","#857266","#8b746d","#9b887e","#a38e83","#ad9585","#61534a","#63564e","#685b52","#6f6057","#716259","#75665c","#7b6961","#7c6962","#7f6a64","#7f7664","#8e796f","#9c9181","#95787e","#dad8cf"],school:["#665247","#775744","#735d52","#786158","#8c5957","#896559","#856f63","#9d7f6d","#ad997f","#5c4f48","#61564c","#67564e","#6b5554","#6b5851","#6b5b50","#716057","#745e5b","#75655c","#78665f","#806d64","#89706b","#a19888","#614a4e","#a4a09f"],modern:["#715d53","#7c6459","#816b64","#8f7265","#9c8980","#ac9a86","#60594c","#635c4e","#6a5a50","#6c5a54","#6c5e55","#6e6256","#72675a","#776a5d","#7b6a61","#7f6f64","#807265","#886f6b","#8b7d6d","#958b79","#a29189","#695256","#a59b8d","#c8c5ba"]};var Nt={"#4f4834":[215,215,215],"#463823":[216,215,215],"#5f5950":[215,215,215],"#a69873":[215,215,215],"#57423e":[215,215,215],"#473c3b":[215,215,215],"#5d5d5c":[214,215,215],"#7e573b":[215,215,215],"#705449":[215,215,215],"#7f8283":[215,214,215],"#796764":[215,215,215],"#5d534b":[215,215,215],"#7d6e52":[215,215,215],"#88735e":[215,215,215],"#88715f":[215,215,215],"#736352":[215,215,215],"#241d1c":[172,172,172],"#4b3f37":[215,215,215],"#615551":[215,215,215],"#595651":[214,215,214],"#423931":[215,215,215],"#7b6d6a":[215,214,216],"#382418":[215,215,215],"#866343":[215,215,215],"#6e6256":[215,215,215],"#625650":[205,205,205],"#252c24":[185,185,186],"#2d281b":[215,214,215],"#3b342b":[215,215,215],"#6f5c56":[215,215,215],"#393535":[215,215,215],"#786357":[215,215,215],"#383d43":[205,215,215],"#554e4a":[215,216,215],"#3d3432":[215,215,215],"#3d353c":[215,215,215],"#4e443f":[215,215,215],"#70574d":[207,207,207],"#d49662":[215,215,215],"#917b5c":[215,215,215],"#494341":[215,215,215],"#645f5f":[215,215,214],"#342a18":[215,215,215],"#825746":[215,216,215],"#99604e":[212,215,215],"#706868":[215,215,215],"#786b61":[215,215,214],"#5c5b57":[215,215,215],"#7a655b":[215,215,215],"#6f5b54":[215,215,215],"#4a3f3a":[215,214,215],"#614f44":[216,215,215],"#654e44":[215,215,215],"#6f5f53":[215,215,216],"#584d49":[215,215,215],"#d3c9b2":[215,215,215],"#544b46":[215,215,215],"#929289":[215,215,215],"#68584f":[215,215,216],"#574d47":[215,215,215],"#5e4e41":[215,215,215],"#6e605a":[215,215,215],"#605d5c":[215,215,215],"#8c7a6f":[215,215,215],"#4a3832":[165,165,166],"#81614f":[215,215,215],"#3d3533":[215,215,215],"#6d5351":[215,215,215],"#5c3d33":[214,214,215],"#906553":[215,215,215],"#65493d":[215,215,215],"#8e5f49":[215,215,215],"#8c6858":[215,215,215],"#8b5946":[215,215,215],"#665253":[209,209,209],"#3e3222":[215,215,215],"#000000":[197,198,197],"#7b081b":[215,215,215],"#383131":[215,215,215],"#3d3b37":[211,215,215],"#877d76":[214,215,215],"#191d0c":[215,214,213],"#bcab88":[215,215,215],"#656462":[215,215,215],"#3f3634":[174,174,175],"#463e3c":[197,197,198],"#453d3a":[177,177,176],"#1f1a1b":[156,156,157],"#615450":[214,215,215],"#5b4f4b":[215,215,215],"#574c4a":[215,215,215],"#413333":[215,215,215],"#7b5c53":[215,215,215],"#5f342b":[216,215,215],"#4e2422":[215,215,215],"#5b4b44":[209,209,209],"#493d32":[215,215,215],"#6a5048":[216,216,215],"#5e5855":[215,215,215],"#5e3f35":[215,215,215],"#68564f":[215,215,215],"#6b3e33":[215,214,215],"#5f3c30":[215,214,215],"#929191":[215,215,215],"#a2acb3":[215,215,215],"#8f7b65":[215,215,215],"#988e7d":[215,215,215],"#726d60":[215,215,215],"#584c45":[215,214,215],"#594643":[216,215,215],"#5e5750":[212,215,215],"#78645b":[215,215,215],"#484440":[215,215,215],"#73645e":[215,215,215],"#5c4f47":[215,215,215],"#3c3d39":[215,215,215],"#645451":[215,215,214],"#37333d":[179,179,178],"#a6856f":[215,215,215],"#574d4d":[205,205,205],"#393737":[215,215,215],"#6f4a3b":[215,214,215],"#ffa169":[212,215,215],"#576465":[216,215,216],"#71614a":[215,215,215],"#6c584f":[215,215,215],"#5b463e":[215,216,215],"#765e52":[214,215,215],"#4f4e4c":[215,215,215],"#544945":[215,215,215],"#504140":[194,195,194],"#51514f":[215,215,215],"#74665f":[215,215,215],"#735c59":[215,215,215],"#474d56":[215,215,215],"#7d6e5a":[215,215,215],"#514a43":[215,215,215],"#4e4e49":[215,215,215],"#745c51":[215,215,215],"#47403c":[215,215,215],"#4c3a37":[215,215,215],"#675d5a":[215,215,215],"#574e48":[215,215,215],"#686360":[215,215,215],"#4a413f":[215,215,215],"#423735":[215,215,215],"#756860":[215,215,215],"#5e5144":[215,215,215]};var Ud={street:{...Et,brick:Et.klinker},tones:ar};var Na=["sunny","legacy"],Wa="sunny";function J(e){let t=globalThis,r=/[?&]look=([\w-]+)/.exec(e??t.location?.search??"")?.[1]??t.__canalRecallLook;return Na.includes(r??"")?r:Wa}var ge=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},Ha=e=>255*(e<=.0031308?e*12.92:1.055*e**(1/2.4)-.055),ae=e=>{let t=parseInt(e.replace("#",""),16);return[t>>16&255,t>>8&255,t&255]},Wt=e=>"#"+e.map(t=>Math.round(Math.max(0,Math.min(255,t))).toString(16).padStart(2,"0")).join(""),Ga=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],be=e=>Ga(ae(e).map(ge)),Ua=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],qe={zenith:"#9ec3ed",horizon:"#a1c6e5"};function ja(e){let t=e.sunElevationDeg*Math.PI/180,n=be(e.sunColour)*e.sunIntensity/Math.PI,r=be(e.skyColour)*e.skyIntensity/Math.PI,o=be(e.groundColour)*e.skyIntensity/Math.PI,a=(r+o)/2;return{flat:n*Math.sin(t)+r,sunWall:n*Math.cos(t)+a,shadeWall:a}}var Va=.55;function za(e="#ffe2bf",t="#aca497",n=Va){let r=40*Math.PI/180,o=u=>{let l=Wt(ae(qe.horizon).map(m=>m+(255-m)*u)),c=be(e)*2.15/Math.PI*Math.cos(r),d=(be(l)+be(t))/2/Math.PI,f=n*c/(1-n)/d;return{sunColour:e,sunIntensity:2.15,skyColour:l,groundColour:t,skyIntensity:f,sunElevationDeg:40}},a=u=>{let l=o(u),c=ae(l.sunColour).map(ge),d=ae(l.skyColour).map(ge),f=[0,2].map(m=>c[m]*l.sunIntensity*Math.sin(r)+d[m]*l.skyIntensity);return f[0]/f[1]},s=0,i=1;for(let u=0;u<40;u++){let l=(s+i)/2;a(l)<1?s=l:i=l}return{...o(i),whiteMix:+i.toFixed(3)}}var pe=za(),gr=1/ja(pe).sunWall,wr={sunColour:pe.sunColour,sunIntensity:+(pe.sunIntensity*gr).toFixed(4),skyColour:pe.skyColour,groundColour:pe.groundColour,skyIntensity:+(pe.skyIntensity*gr).toFixed(4)},yr=[.85,1.6],qa=e=>typeof e=="string"?ae(e):e;function Ht(e){let t=e?ge(219)/ge(Ua(qa(e))):1.106;return Math.max(yr[0],Math.min(yr[1],t))}function ie(e,t){let n=ae(e).map(o=>ge(o)*t),r=Math.max(1,...n);return Wt(n.map(o=>Ha(o/r)))}function Mr(e,t=Nt[e.toLowerCase()]){return ie(e,Ht(t))}function xr(e,t,n,r=J(),o){return r!=="sunny"||n!=="measured"||e!=="brick"&&e!=="accent"?t:o?Mr(t,o):Mr(t)}var Yd=(()=>{let e=Object.keys(Nt).map(ae),t=n=>n.slice().sort((r,o)=>r-o)[n.length>>1];return Wt([0,1,2].map(n=>t(e.map(r=>r[n]))))})();var Ya=2,Xa=.62;function Za(e,t=Ya){let n=ie(e,t);if(k(x(e))[2]>=Xa)return n;let[r,o,a]=k(x(n));return a<=Y[1]?n:R(L([r,o,Y[1]]))}var Ja=e=>Object.fromEntries(Object.entries(e).map(([t,n])=>[t,n?n.map(r=>Za(r)):null])),of=Ja(br);var Qa={anonymous:"This building has no name or date in the map data.",named:"The map data has no date for this building.",place:"A mapped place; the map data has no date for its building."},df=new Set(Object.values(Qa));var Oe=["canal","c19","school","postwar","modern","tower"];var ni=8;var Bf=16+Math.log2(ni);var v=256,ri=["upper","ground","door","plain","shop"],oi=2;var Gf=Oe.length*oi*ri.length;var D=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16));var Uf=D("#7d93a0"),jf=D("#1f2a33");var Vf=D("#b8ad98"),zf=D("#cfc6b4"),qf=D("#ece8dd"),Kf=D("#e2d9c2"),Yf=[D("#2c4a3d"),D("#3a2a22"),D("#1f3b57"),D("#5a2a24")],Xf=[D("#2f4a3a"),D("#7a2f27"),D("#27384f")];var Sr=.6;function Ke(e,t,n){let r=Math.imul(e|0,374761393)^Math.imul(t|0,668265263)^Math.imul(n|0,2246822519);return r=Math.imul(r^r>>>13,1274126177),((r^r>>>16)>>>0)/4294967296}function Rr(e,t){let n=0;for(let o=0;o<e.length;o+=4)n+=e[o];let r=n/(e.length/4);for(let o=0;o<e.length;o+=4){let a=Math.round(Math.max(0,Math.min(255,r+(e[o]-r)*t)));e[o]=e[o+1]=e[o+2]=a}}function kr(e,t){let n=new Uint8ClampedArray(v*v*4),r=(o,a,s,i,u)=>{let l=(a*v+o)*4,c=u??[s,s,s];n[l]=c[0],n[l+1]=c[1],n[l+2]=c[2],n[l+3]=i};if(e==="flat")for(let o=0;o<v;o++)for(let a=0;a<v;a++)r(a,o,Math.round((t?.96:.9+(Ke(a>>3,o>>3,3)-.5)*.08)*255),255);else if(e==="tile"){let s=v/8,i=v/5;for(let u=0;u<v;u++)for(let l=0;l<v;l++){let c=Math.floor(u/s),d=u%s/s,f=(l+c%2*i*.5)%v,m=Math.floor(f/i),p=f%i/i,b=Math.sin(p*Math.PI),M=t?.92:.7+.22*b-.28*Math.pow(Math.max(0,1-d*3.2),1.5)*0-.22*Math.max(0,(.18-d)/.18);t||(M+=(Ke(m,c,7)-.5)*.14);let g=t?d<.07||p<.035||p>.965:!1;r(l,u,Math.round(Math.max(0,Math.min(1,g?.28:M))*255),255)}t||Rr(n,Sr)}else if(e==="slate"){let s=v/11,i=v/6;for(let u=0;u<v;u++)for(let l=0;l<v;l++){let c=Math.floor(u/s),d=u%s/s,f=(l+c%2*i*.5)%v,m=Math.floor(f/i),p=f%i/i,b=t?.9:.82+(Ke(m,c,11)-.5)*.16-.16*Math.max(0,(.16-d)/.16);(p<(t?.05:.025)||d<(t?.09:.04))&&(b=t?.3:b*.7),r(l,u,Math.round(Math.max(0,Math.min(1,b))*255),255)}t||Rr(n,Sr)}else for(let u=0;u<v;u++)for(let l=0;l<v;l++){let c=l/v,d=u/v,f=c>.2-.06&&c<.8+.06&&d>.2-.06&&d<.82+.06,m=c>.2+.03&&c<.8-.03&&d>.2+.03&&d<.82-.03,p=Math.abs(c-.5)<.018||Math.abs(d-.5)<.018;if(m&&!p){let b=(d-.2)/.6199999999999999,M=t?[150+60*b,200+30*b,235]:[40+80*b*b,55+90*b*b,68+90*b*b];r(l,u,0,0,[M[0],M[1],M[2]])}else if(f)r(l,u,0,0,t?[255,250,240]:[236,232,221]);else{let b=t?.92:.85+(Ke(l>>3,u>>3,5)-.5)*.12,M=t&&(l<5||u<5||l>v-6||u>v-6);r(l,u,Math.round((M?.3:b)*255),255)}}return n}function vr(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let c=0;c<336;c+=112)o.drawImage(t,c,l,112,112);else{let l=7,c=()=>(l=l*16807%2147483647)/2147483647;for(let d=0,f=0;f<336;f+=14,d++)for(let m=-(d%2)*24;m<336;m+=48){let p=150+c()*50;o.fillStyle=`rgb(${p},${p*.92},${p*.86})`,o.fillRect(m,f,48,14)}}o.strokeStyle="rgba(235,223,205,0.18)",o.lineWidth=1.7;for(let l=0,c=6;c<336;c+=14,l++){o.beginPath(),o.moveTo(0,c),o.lineTo(336,c),o.stroke();for(let d=l%2*24;d<336;d+=48)o.beginPath(),o.moveTo(d,c),o.lineTo(d,c+14),o.stroke()}let a=o.getImageData(0,0,336,336),s=a.data,i=0;for(let l=0;l<s.length;l+=4)i+=(s[l]+s[l+1]+s[l+2])/3;i/=s.length/4;let u=i>0?Math.min(2.4,225/i):1;for(let l=0;l<s.length;l+=4){let c=(s[l]+s[l+1]+s[l+2])/3,d=Math.min(255,(c+(i-c)*.7)*u);s[l]=s[l+1]=s[l+2]=d,s[l+3]=255}return o.putImageData(a,0,0),r}function Ar(e){let t=e.createElement("canvas");t.width=64,t.height=128;let n=t.getContext("2d"),r=n.createLinearGradient(0,0,0,128);return r.addColorStop(0,"#8aa1b0"),r.addColorStop(.5,"#4d606c"),r.addColorStop(1,"#3c474e"),n.fillStyle=r,n.fillRect(0,0,64,128),n.fillStyle="rgba(235,242,248,0.16)",n.beginPath(),n.moveTo(10,0),n.lineTo(34,0),n.lineTo(4,70),n.lineTo(-20,70),n.closePath(),n.fill(),t}function _r(e){let t=e.createElement("canvas");t.width=oe,t.height=se;let n=t.getContext("2d"),r=n.createImageData(oe,se);for(let o=0;o<se;o++)for(let a=0;a<oe;a++){let s=(o*oe+a)*4,i=Tt(a,o);r.data[s]=r.data[s+1]=r.data[s+2]=i,r.data[s+3]=255}return n.putImageData(r,0,0),t}function $r(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d");n.fillStyle="#ffffff",n.fillRect(0,0,128,128),n.fillStyle="rgba(0,0,0,0.10)";for(let r=0;r<128;r+=16)n.fillRect(r,0,1.5,128);return t}function Cr(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=23,a=()=>(o=o*16807%2147483647)/2147483647;for(let s=0;s<128;s++){let i=(a()-.5)*3;for(let u=0;u<128;u++){let l=(s*128+u)*4,c=a()<.012?-14:0,d=243+(a()-.5)*8+i+c;r.data[l]=r.data[l+1]=r.data[l+2]=d,r.data[l+3]=255}}return n.putImageData(r,0,0),t}function Fr(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=11,a=()=>(o=o*16807%2147483647)/2147483647;for(let s=0;s<r.data.length;s+=4){let i=228+(a()-.5)*16;r.data[s]=r.data[s+1]=r.data[s+2]=i,r.data[s+3]=255}return n.putImageData(r,0,0),n.fillStyle="rgba(80,70,60,0.18)",n.fillRect(0,0,128,1.5),t}function Ye(e,t){let n=kr(t,!1),r=Math.round(Math.sqrt(n.length/4)),o=e.createElement("canvas");o.width=o.height=r;let a=o.getContext("2d"),s=a.createImageData(r,r);for(let i=0;i<n.length;i+=4)s.data[i]=n[i],s.data[i+1]=n[i+1],s.data[i+2]=n[i+2],s.data[i+3]=255;return a.putImageData(s,0,0),o}var si=238;function Tr(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let c=0;c<336;c+=112)o.drawImage(t,c,l,112,112);else{let l=13,c=()=>(l=l*16807%2147483647)/2147483647;for(let d=0,f=0;f<336;f+=14,d++)for(let m=-(d%2)*24;m<336;m+=48){let p=165+c()*30;o.fillStyle=`rgb(${p},${p*.93},${p*.88})`,o.fillRect(m,f,48,14)}}o.strokeStyle="rgba(245,240,230,0.26)",o.lineWidth=1.2;for(let l=0,c=6;c<336;c+=14,l++){o.beginPath(),o.moveTo(0,c),o.lineTo(336,c),o.stroke();for(let d=l%2*24;d<336;d+=48)o.beginPath(),o.moveTo(d,c),o.lineTo(d,c+14),o.stroke()}let a=o.getImageData(0,0,336,336),s=a.data,i=0;for(let l=0;l<s.length;l+=4)i+=(s[l]+s[l+1]+s[l+2])/3;i/=s.length/4;let u=i>0?Math.min(2.6,si/i):1;for(let l=0;l<s.length;l+=4){let c=(s[l]+s[l+1]+s[l+2])/3,d=Math.min(255,(c+(i-c)*.82)*u);s[l]=s[l+1]=s[l+2]=d,s[l+3]=255}return o.putImageData(a,0,0),r}function Lr(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=31,a=()=>(o=o*16807%2147483647)/2147483647;for(let s=0;s<128;s++)for(let i=0;i<128;i++){let u=(s*128+i)*4,l=246+(a()-.5)*3;r.data[u]=r.data[u+1]=r.data[u+2]=l,r.data[u+3]=255}return n.putImageData(r,0,0),t}function Er(e){let t=e.createElement("canvas");t.width=t.height=4;let n=t.getContext("2d");return n.fillStyle="#fff",n.fillRect(0,0,4,4),t}var ii="highlight",li="__canalRecallHighlight",ui="highlightAccent",ci="__canalRecallHighlightAccent",Xe={yellow:{keepMaterials:!1,outline:!1,rim:!1,desaturate:!1,ring:!1,beacon:!1,wash:!1,animated:!1},a:{keepMaterials:!0,outline:!0,rim:!1,desaturate:!1,ring:!0,beacon:!0,wash:!0,animated:!1},b:{keepMaterials:!0,outline:!1,rim:!0,desaturate:!1,ring:!0,beacon:!1,wash:!1,animated:!0},c:{keepMaterials:!0,outline:!1,rim:!1,desaturate:!0,ring:!0,beacon:!1,wash:!1,animated:!1}};var di=60,Q=.4,ye=2,zt=3.5,Or=100,fi=300;var mi=.75,Gt=.35,hi="__canalRecallHighlightBoost";function Ir(){let e=Number(globalThis[hi]);return Number.isFinite(e)?Math.min(1,Math.max(0,e)):0}var Ut="__canalRecallHighlightExtent";function Wr(){let e=globalThis;return e[Ut]instanceof Map?e[Ut]:e[Ut]=new Map}var pi=.3,bi=2.4,gi=.9,yi=2.2,Ze={drawn:0,hide:1,highlight:2,dim:3,ghost:4},Mi=.28;function Pr(e){if(typeof e!="string")return null;let t=e.trim().toLowerCase();return t==="a"||t==="outline"?"a":t==="b"||t==="rim"?"b":t==="c"||t==="desaturate"?"c":t==="yellow"||t==="0"||t==="off"||t==="old"?"yellow":t==="default"?jt:null}var jt="a";function we(e){try{let t=globalThis;if(e===void 0){let n=Pr(t[li]);if(n)return n}return Pr(new URLSearchParams(e??t.location?.search??"").get(ii))??jt}catch{return jt}}var Hr=(e=we())=>Xe[e];function Gr(e=we(),t){if(e==="yellow")return rr;try{let n=globalThis,r=(t===void 0?n[ci]:void 0)??new URLSearchParams(t??n.location?.search??"").get(ui);if(r==="hud")return sr;if(typeof r=="string"&&/^#?[0-9a-f]{6}$/i.test(r))return r.startsWith("#")?r:`#${r}`}catch{}return or}function qt(e=we()){return Xe[e].keepMaterials?{HL_KEEP:""}:{}}var Ie=`
#ifdef HL_KEEP
#define HL_PAINT(h) false
#else
#define HL_PAINT(h) ((h) > 0.5 && (h) < 1.5)
#endif
#define HL_GHOST(h) ((h) > 2.5 && fract(dot(floor(gl_FragCoord.xy), vec2(0.569840296, 0.754877666))) >= ${Mi.toFixed(3)})
float hlState(float hidden) { return hidden > 3.5 ? 3.0 : (hidden > 2.5 ? 2.0 : (hidden > 1.5 ? 1.0 : 0.0)); }
vec3 hlDesat(vec3 c, float h) { return h > 1.5 && h < 2.5 ? mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), ${Q.toFixed(2)}) : c; }`,wi=110540,xi=e=>111320*Math.cos(e*Math.PI/180);function Si(e,t){let n=(e[1]+t[1])/2;return Math.hypot((e[0]-t[0])*xi(n),(e[1]-t[1])*wi)}var Ur=(e,t,n=di)=>!!e&&Si(e,t)<=n;var Dr=`
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
  float far = clamp((length(c4.xyz - hlEye) - ${Or.toFixed(1)}) / ${(fi-Or).toFixed(1)}, 0.0, 1.0);
  float width = hlWidthPx * mix(1.0, hlFarScale, far);
  if (dot(dir, dir) > 1e-12) clip.xy += normalize(dir) * width * 2.0 / hlViewport * clip.w;
#endif
  gl_Position = clip;
}`,Ri=`
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
  if (up < ${Gt.toFixed(2)} || hlWash <= 0.0) discard;
  gl_FragColor = vec4(hlAccent, hlWash * smoothstep(${Gt.toFixed(2)}, ${(Gt+.15).toFixed(2)}, up));
#else
  vec3 n = hlHasNormal > 0.5 ? normalize(vHlNormal) : normalize(cross(dFdx(vHlPos), dFdy(vHlPos)));
  vec3 v = normalize(hlEye - vHlPos);
  float f = pow(1.0 - abs(dot(n, v)), ${yi.toFixed(2)});
  float pulse = 0.775 + 0.225 * sin(hlTime * 6.2831853 / ${bi.toFixed(2)});
  gl_FragColor = vec4(hlAccent * f * ${gi.toFixed(2)} * pulse, 1.0);
#endif
}`,Me="canalRecallHighlightPass",ki="__canalRecallHighlightOutlinePx";function vi(){let e=globalThis[ki],t=e==null||e===""?NaN:Number(e);return Number.isFinite(t)&&t>=0?t:null}var Ai=(e,t)=>{let[n,r,o]=x(t);return new e.Vector3(n/255,r/255,o/255)};function _i(e,t,n={}){let r={};n.merged&&(r.HL_MERGED=""),t==="outline"&&(r.HL_OUTLINE=""),t==="roof"&&(r.HL_ROOF="");let o=Dr;if(n.feature){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n.feature.attribute))throw new Error(`highlight: bad feature attribute ${n.feature.attribute}`);r.HL_FEATURE=n.feature.attribute,o=`attribute float ${n.feature.attribute};
uniform float hlFeatureId;
${Dr}`}let a=new e.ShaderMaterial({defines:r,uniforms:{hlViewport:{value:new e.Vector2(1,1)},hlWidthPx:{value:ye},hlFarScale:{value:zt/ye},hlCentre:{value:new e.Vector3},hlDepthPush:{value:pi},hlAccent:{value:Ai(e,n.accent??Gr())},hlEye:{value:new e.Vector3},hlTime:{value:0},hlHasNormal:{value:1},hlFeatureId:{value:n.feature?.id??0},hlUp:{value:new e.Vector3(0,0,1)},hlWash:{value:0}},vertexShader:o,fragmentShader:Ri,side:t==="outline"?e.BackSide:e.FrontSide,transparent:!0,depthTest:!0,depthWrite:t==="outline",blending:t==="rim"?e.AdditiveBlending:e.NormalBlending,polygonOffset:t!=="outline",polygonOffsetFactor:-1,polygonOffsetUnits:t==="roof"?-4:-2});return a.name=`highlight/${t}${n.merged?"/merged":""}`,a.userData={[Me]:!0},a.defaultAttributeValues={hidden:[0],normal:[0,0,0]},a}function $i(e,t,n,r){let o=e.geometry?.boundingBox,a=t.elements;if(!o)return;let s=n.domElement,i=s?.clientWidth||r.x,u=s?.clientHeight||r.y,l=[],c=!1;for(let d=0;d<8;d++){let f=d&1?o.max.x:o.min.x,m=d&2?o.max.y:o.min.y,p=d&4?o.max.z:o.min.z,b=a[0]*f+a[4]*m+a[8]*p+a[12],M=a[1]*f+a[5]*m+a[9]*p+a[13],g=a[3]*f+a[7]*m+a[11]*p+a[15];if(!(g>1e-9)){c=!0;break}l.push((b/g+1)/2*i,(1-M/g)/2*u)}Wr().set(e,{t:performance.now(),points:l,behind:c,width:i,height:u})}function Je(e){for(let t of e?.userData?.[Me]??[])e.remove(t),Li(t.material),Wr().delete(t);e?.userData&&delete e.userData[Me]}var Ci=4,Vt=new Map,jr=Symbol("highlightPassPool");function Fi(e,t){return`${e}|${t.merged?1:0}|${t.feature?.attribute??""}|${t.accent??""}`}function Ti(e,t,n={}){let r=Fi(t,n),o=Vt.get(r)?.pop();if(o){let s=o.uniforms;return s.hlCentre.value.set(0,0,0),s.hlHasNormal.value=1,s.hlFeatureId.value=n.feature?.id??0,s.hlUp.value.set(0,0,1),s.hlWash.value=0,s.hlEye.value.set(0,0,0),s.hlTime.value=0,s.hlWidthPx.value=ye,s.hlFarScale.value=zt/ye,o}let a=_i(e,t,n);return a.userData[jr]=r,a}function Li(e){let t=e?.userData?.[jr];if(!t){e?.dispose?.();return}let n=Vt.get(t)??[];Vt.set(t,n),n.length<Ci&&!n.includes(e)?n.push(e):e.dispose()}function Br(e){let t=e?.getAttribute?.("position")??e?.attributes?.position;return!t||!!t.array}function Kt(e,t,n={}){Je(t);let r=Xe[n.style??we()],o=[...r.outline?["outline"]:[],...r.rim?["rim"]:[],...r.wash&&!n.feature?["roof"]:[]];if(!o.length||!t?.geometry)return[];let a=t.geometry,s=n.centre;if(!s){!a.boundingBox&&Br(a)&&a.computeBoundingBox?.();let M=a.boundingBox?.getCenter(new e.Vector3)??a.boundingSphere?.center;s=M?[M.x,M.y,M.z]:[0,0,0]}let i=a.getAttribute?.("normal")?1:0,u=[],l=new e.Matrix4,c=new e.Vector4,d=new e.Vector2,f=new e.Matrix3,m=new e.Vector3,p=n.up??[0,0,1],b=!n.merged&&!n.feature&&!t.isInstancedMesh;b&&!a.boundingBox&&Br(a)&&a.computeBoundingBox?.();for(let M of o){let g=Ti(e,M,{merged:n.merged,feature:n.feature,accent:n.accent??Gr(n.style)});g.uniforms.hlCentre.value.set(s[0],s[1],s[2]),g.uniforms.hlHasNormal.value=i;let y=t.isInstancedMesh?new e.InstancedMesh(a,g,t.count):new e.Mesh(a,g);t.isInstancedMesh&&(y.instanceMatrix=t.instanceMatrix),y.name=`${t.name||"mesh"}/highlight-${M}`,y.frustumCulled=!1,y.castShadow=y.receiveShadow=!1,y.renderOrder=(t.renderOrder??0)+1,y.raycast=()=>{},M==="roof"&&Object.defineProperty(y,"visible",{get:()=>t.visible&&Ir()>.001,set:()=>{},configurable:!0}),y.onBeforeRender=(S,W,I)=>{t.isInstancedMesh&&(y.count=t.count),M!=="roof"&&(y.visible=t.visible);let T=g.uniforms;if(M==="roof"){f.setFromMatrix4(y.matrixWorld),m.setFromMatrixColumn(y.matrixWorld,0);let F=m.length()<.001?[0,0,1]:p;T.hlUp.value.set(F[0],F[1],F[2]).applyMatrix3(f.invert()).normalize(),T.hlWash.value=mi*Ir()}S.getDrawingBufferSize(d),T.hlViewport.value.copy(d);let ht=S.domElement?.clientWidth||d.x,te=vi();T.hlWidthPx.value=(te??ye)*(d.x/ht),T.hlFarScale.value=te==null?zt/ye:1,l.multiplyMatrices(I.projectionMatrix,I.matrixWorldInverse).multiply(y.matrixWorld),M==="outline"&&b&&$i(y,l,S,d),l.invert(),c.set(0,0,1,0).applyMatrix4(l),Math.abs(c.w)>1e-12&&T.hlEye.value.set(c.x/c.w,c.y/c.w,c.z/c.w),T.hlTime.value=performance.now()/1e3,g.uniformsNeedUpdate=!0},t.add(y),u.push(y)}return t.userData??={},t.userData[Me]=u,u}var Nr=new WeakMap;function Ei(e,t,n,r=we()){if(!t||n==="plain"||n==="highlight"&&Xe[r].keepMaterials)return t;let o=Nr.get(t);o||Nr.set(t,o=new Map);let a=`${n}|${r}`,s=o.get(a);if(s)return s;if(n==="highlight")s=new e.MeshLambertMaterial({color:16765471,emissive:7033856,side:t.side??e.FrontSide});else if(t.isShaderMaterial&&t.uniforms?.tint?.value?.isVector3)s=t.clone(),s.uniforms={...t.uniforms,tint:{value:Oi(t.uniforms.tint.value.clone())}};else if(t.isShaderMaterial&&t.uniforms?.hlDimAll)s=t.clone(),s.uniforms={...t.uniforms,hlDimAll:{value:1}};else if(t.isShaderMaterial)s=t.clone(),s.uniforms=t.uniforms,s.defines={...t.defines??{},HL_DIM_ALL:""};else{if(s=t.clone(),s.color){let i=s.color,u=.2126*i.r+.7152*i.g+.0722*i.b;i.setRGB(i.r+(u-i.r)*Q,i.g+(u-i.g)*Q,i.b+(u-i.b)*Q)}if(s.map){let i=s.onBeforeCompile;s.onBeforeCompile=(u,l)=>{i?.call(s,u,l),u.fragmentShader=u.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${Q.toFixed(2)});`)},s.customProgramCacheKey=()=>`${t.customProgramCacheKey?.()??""}|hl-dim`}}return s.name=`${t.name||"material"}/${n}`,s.userData={...t.userData??{},highlightVariantOf:t},o.set(a,s),s}function Oi(e){let t=.2126*e.x+.7152*e.y+.0722*e.z;return e.set(e.x+(t-e.x)*Q,e.y+(t-e.y)*Q,e.z+(t-e.z)*Q)}var Ii=e=>e?.userData?.highlightVariantOf??e;function Vr(e,t,n,r={}){let o=r.style??we(),a=[];t.traverse(s=>{s.isMesh&&s.material&&!s.material.userData?.[Me]&&a.push(s)});for(let s of a){let i=u=>u?.userData?.[Me]?u:u?.userData?.cityLook&&r.cityVariant?r.cityVariant(u,n):Ei(e,Ii(u),n,o);s.material=Array.isArray(s.material)?s.material.map(i):i(s.material),n==="highlight"?Kt(e,s,{style:o,up:r.up}):Je(s)}}var ee=e=>Number.isInteger(e)?e.toFixed(1):String(e);var le={x0:.28,x1:.72,y0:.3,y1:.8,frame:.035},zr=`
void cityWindowGrid(vec2 m, inout vec3 c, inout vec2 mk) {
  vec2 cell = fract(m / vec2(${ee(3)}, ${ee(3.2)}));
  vec2 lo = vec2(${ee(le.x0)}, ${ee(le.y0)}), hi = vec2(${ee(le.x1)}, ${ee(le.y1)});
  vec2 aa = max(fwidth(cell), vec2(1e-4));
  vec2 inO = smoothstep(lo - aa, lo + aa, cell) * (1.0 - smoothstep(hi - aa, hi + aa, cell));
  vec2 lg = lo + ${ee(le.frame)}, hg = hi - ${ee(le.frame)};
  vec2 inG = smoothstep(lg - aa, lg + aa, cell) * (1.0 - smoothstep(hg - aa, hg + aa, cell));
  float outer = inO.x * inO.y, glass = inG.x * inG.y;
  // far away the cells shrink under a pixel: fade the grid to the wall rather than shimmer
  float fade = 1.0 - smoothstep(0.08, 0.2, max(aa.x, aa.y));
  vec3 win = mix(vec3(0.86, 0.85, 0.82), mix(vec3(0.17, 0.21, 0.25), vec3(0.33, 0.39, 0.44), cell.y), glass);
  float k = outer * fade;
  c = mix(c, win, k);
  mk.r *= 1.0 - k;
  mk.g *= 1.0 - k;
}`;var xe=(e,t)=>`(${e}.g + 1.0 - ${t}.a)`;function Pi(){let e=globalThis;return(e.__canalRecallMaskFormat??new URLSearchParams(e.location?.search??"").get("maskFormat"))==="rg"?"rg":"r8"}function qr(e,t,n=Pi()){let r=t.length>>1;if(e.length!==r*4)throw new Error(`packMask: ${e.length} colour bytes for ${r} mask texels`);if(n==="rg"){for(let a=0;a<r;a++)e[a*4+3]=255;return{colour:e,mask:t,channels:2}}let o=new Uint8Array(r);for(let a=0;a<r;a++)o[a]=t[a*2],e[a*4+3]=255-t[a*2+1];return{colour:e,mask:o,channels:1}}var Di=70,Bi=190,Ni=.5,Kr=15,Yr=40;var Yt="12.0";var Xr=[-1,-1];var Zr=[-1,-1],Jr=()=>[Di,Bi,Ni],Qe=e=>Number.isInteger(e)?e.toFixed(1):String(e),Qr=`
uniform vec2 roofLayers;
uniform vec3 roofTier;
vec3 roofTierColour(vec3 fine, vec2 uv, float layer, float dist) {
  if (roofLayers.x < 0.0 || layer < roofLayers.x - 0.5 || layer > roofLayers.y - 0.5) return fine;
  float mid = smoothstep(roofTier.x - ${Qe(Kr)}, roofTier.x + ${Qe(Kr)}, dist);
  if (mid <= 0.0) return fine;
  float far = smoothstep(roofTier.y - ${Qe(Yr)}, roofTier.y + ${Qe(Yr)}, dist);
  vec3 coarse = texture(cells, vec3(uv * roofTier.z, layer)).rgb;
  vec3 flatMean = textureLod(cells, vec3(uv, layer), ${Yt}).rgb;
  return mix(mix(fine, coarse, mid), flatMean, far);
}`;var Wi={threshold:20,taps:9,spread:1,grad:.85,sdf:1},Hi=`
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
}`;function Xt(e=Wi,t=1){let n=Number.isFinite(t)&&t>0?t:1;return{cellTaps:[e.threshold*n,e.taps,e.spread,e.grad],cellTapsSdf:e.sdf}}var eo=`${En}
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
${Hi}
#endif
void cellTierSample(vec3 p, float dist, out vec3 c, out vec2 m) {
#ifdef CELL_LOD_BIAS
  vec4 cc = texture(cells, p, cellLodBias); vec2 mm = texture(masks, p, cellLodBias).rg;
#else
  vec4 cc = texture(cells, p); vec2 mm = texture(masks, p).rg;
#endif
  c = cc.rgb; m = vec2(mm.r, ${xe("mm","cc")});
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
  if (farWinUv <= 0.0) far = max(far, ${St("dist")});
#else
  far = max(far, ${St("dist")});
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
      c = mix(c, tc.rgb, cellTapW); m = mix(m, vec2(tm.r, ${xe("tm","tc")}), cellTapW);
    }
  }
#endif
  if (far <= 0.0) return;
  vec4 fc = textureLod(cells, p, ${Yt}); vec2 fm = textureLod(masks, p, ${Yt}).rg;
  c = mix(c, fc.rgb, far); m = mix(m, vec2(fm.r, ${xe("fm","fc")}), far);
}`,Gi=[1,2];function Zt(e,t=Gi){return{cellAniso:Number.isFinite(e)&&e>=1?e:1,cellAnisoRule:[1,1,t[0],t[1]]}}var Ui=.5,tt={sunAzimuthDeg:215,sunElevationDeg:40,sunColour:"#ffe9cc",sunIntensity:2.15,skyColour:"#e3ebf6",groundColour:"#998a72",skyIntensity:1.75,shadows:!0,shadowMapSize:2048,shadowIntensity:1-Ui};var xm={...tt,...wr};function ji(e,t){let n=e*Math.PI/180,r=t*Math.PI/180;return[Math.sin(n)*Math.cos(r),Math.cos(n)*Math.cos(r),Math.sin(r)]}var no=ji(tt.sunAzimuthDeg,tt.sunElevationDeg),nt=(()=>{let e=tt.sunAzimuthDeg*Math.PI/180;return[Math.sin(e),Math.cos(e)]})(),et=[nt[0]*.6,nt[1]*.6,.8],to=.84;function ro(e){let t=e[0]*et[0]+e[1]*et[1]+e[2]*et[2];return Math.max(.5,Math.min(1,.58+.42*Math.max(0,t)))}var Vi=ro([0,0,1]),Pe=e=>Number.isInteger(e)?e.toFixed(1):String(+e.toFixed(6)),oo=`
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = ${Pe(to)} + ${Pe(1-to)} * (0.5 + 0.5 * dot(h, vec2(${Pe(nt[0])}, ${Pe(nt[1])}))); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, dot(n, vec3(${et.map(Pe).join(", ")}))), 0.5, 1.0);`;var Jt;function zi(e,t){let n=e?/[?&]wallRule=(\w+)/.exec(e)?.[1]:void 0,r=n??t??"";return r==="1"||r==="on"||r==="true"}function qi(){if(Jt!==void 0)return Jt;let e=globalThis;return Jt=zi(e.location?.search??null,e.process?.env?.WALL_RULE??null)}var Ki=new Set(["#7a3e2c","#4e3027","#9a5236","#b39468","#6d6560","#2a2a2a","#e6e2d8","#d9ccaa","#9a9a94","#c8bb9c","#ece9e0","#e4dcc4","#26392f","#1e1e1e","#5a2224","#23303f","#7c7f7c","#4a3426","#7a5a3a","#9a5240","#7d7871","#ac624e"]);function Yi(e,t){return t==="measured"?"measured":Ki.has(e.toLowerCase())?"guessed":"measured"}function so(e,t,n){return!qi()||n==="measured"||e!=="brick"&&e!=="accent"?n:Yi(t,n)==="measured"?"measured":n}var Qt={offset:.05,floor:.14,ceil:.6,paleL:.62,buff:{l:.5,s:.3,h:[35,65]},sat:[.12,.5],greyBelowS:.12,profileGain:.4};function Xi(e){let[t,n,r]=k(x(e)),o=Qt.buff;return r<Qt.paleL&&!(r>=o.l&&n>=o.s&&t>=o.h[0]&&t<=o.h[1])}function ao(e){if(!Xi(e))return null;let[t,n,r]=k(x(e)),o=Qt;return R(L([t,n<o.greyBelowS?n:Math.min(o.sat[1],Math.max(o.sat[0],n)),Math.min(o.ceil,Math.max(o.floor,r+o.offset))]))}var io=[.4,2.5],Zi=["brick","accent","stucco"];function Ji(e){let t=(e?.white?Ht(e.white):1.106)*(e?.stripOverDrawn??1);return Math.max(io[0],Math.min(io[1],t))}var Qi=["brick","accent"];function lo(e,t,n,r,o=J()){return o!=="sunny"||r==="measured"?t:n?Zi.includes(e)?ie(t,Ji(n)):t:Qi.includes(e)?ie(t,1.106):t}var _=[{name:"magnified (rho < 1)",rgb:[255,0,0]},{name:"rho 1-2",rgb:[255,255,0]},{name:"rho 2-4",rgb:[0,255,0]},{name:"rho 4-8",rgb:[0,255,255]},{name:"rho 8-16",rgb:[0,0,255]},{name:"rho 16-tier",rgb:[255,128,0]},{name:"tier far > 0",rgb:[255,0,255]},{name:"depth-fade far > 0 (tier 0)",rgb:[255,255,255]},{name:"under fade > 0",rgb:[128,0,255]},{name:"roof layer",rgb:[128,128,128]}];var Dm=_.length-1,el=3;var tl=520,nl=tl.toFixed(1),rl=String(el),$=e=>`vec3(${e.map(t=>(t/255).toFixed(4)).join(", ")})`,co=`
#ifdef CELL_DEBUG_RHO
vec3 cellDebugColour(float layer) {
  if (roofLayers.x >= 0.0 && layer > roofLayers.x - 0.5 && layer < roofLayers.y - 0.5) return ${$(_[9].rgb)};
#if defined(CELL_TIER_ANISO) && defined(CELL_DEBUG_UNDER)
  if (cellFarFlat > 0.001) return ${$(_[6].rgb)};
  if (cellFarTier <= 0.001 && cellFar > 0.001) return ${$(_[7].rgb)};
  if (cellUnder < 0.5) return ${$(_[0].rgb)};
  if (cellUnder < 0.75) return ${$(_[1].rgb)};
  if (cellUnder < 1.0) return ${$(_[2].rgb)};
  if (cellUnder < 1.5) return ${$(_[3].rgb)};
  if (cellUnder < 2.0) return ${$(_[4].rgb)};
  return ${$(_[5].rgb)};
#else
#ifdef CELL_TIER_ANISO
  if (cellFarFlat > 0.001) return ${$(_[6].rgb)};
  if (cellFarUnder > 0.001) return ${$(_[8].rgb)};
#else
  if (cellFarTier > 0.001) return ${$(_[6].rgb)};
#endif
  if (cellFar > 0.001) return ${$(_[7].rgb)};
  if (cellRho < 1.0) return ${$(_[0].rgb)};
  if (cellRho < 2.0) return ${$(_[1].rgb)};
  if (cellRho < 4.0) return ${$(_[2].rgb)};
  if (cellRho < 8.0) return ${$(_[3].rgb)};
  if (cellRho < 16.0) return ${$(_[4].rgb)};
  return ${$(_[5].rgb)};
#endif
}
#endif`;function De(e){try{return typeof URLSearchParams=="function"?new URLSearchParams(globalThis.location?.search??"").get(e):null}catch{return null}}var ol=1.25,uo=[2.5,5],sl={footprint:1,fadePx:[2,4],frameMinPx:0,barPx:[0,0],tent:!0};function al(){let t=globalThis.__canalRecallWindowSdfBand??De("windowSdfBand");return!(t===!1||t==="0"||t==="false"||t==="off")}var rt=(e,t)=>{if(e==null)return null;let n=e.split(",").map(Number);return n.length===t&&n.every(r=>Number.isFinite(r)&&r>=0)?n:null};function il(){let e=sl,t=rt(De("windowSdfFoot"),1)?.[0]??e.footprint,n=rt(De("windowSdfFade"),2)??e.fadePx,r=rt(De("windowSdfFrameMin"),1)?.[0]??e.frameMinPx,o=rt(De("windowSdfBar"),2)??e.barPx;return{band:[al()?1:0,t,n[0],n[1]],shape:[r,o[0],o[1],e.tent?1:0]}}var en=null;function fo(){let e=`${globalThis.location?.search??""}|${String(globalThis.__canalRecallWindowSdfBand)}`;en?.key!==e&&(en={key:e,v:il()});let t=en.v;return{windowSdfBand:{value:[...t.band]},windowSdfShape:{value:[...t.shape]}}}var j=["#6f8796","#2f4350","#1d2a33"],ot=e=>$([parseInt(e.slice(1,3),16),parseInt(e.slice(3,5),16),parseInt(e.slice(5,7),16)]),mo=`
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
  vec2 cell = vec2(${nl}, head.y);
  vec2 p = fract(uv) * cell;
  // The pixel's footprint from the continuous uv (fract jumps at the cell seam), in canvas px per framebuffer px.
  vec2 fpx = max(fwidth(uv * cell), vec2(1e-3));
  vec2 fw = fpx * (band ? windowSdfBand.y : ${ol.toFixed(2)});
#ifdef CELL_TAPS
  // The footprint prefilter's taps (roofTier.ts, lane R4-D #246) widen the edge box with the wall under the windows.
  fw *= mix(1.0, cellTapsSdf, cellTapW);
#endif
  vec2 fade = band ? windowSdfBand.zw : vec2(${uo[0].toFixed(1)}, ${uo[1].toFixed(1)});
  for (int i = 0; i < ${rl}; i++) {
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
    vec3 gc = g < 0.55 ? mix(${ot(j[0])}, ${ot(j[1])}, g / 0.55) : mix(${ot(j[1])}, ${ot(j[2])}, (g - 0.55) / 0.45);
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
#endif`;var cl=["default","osm","3dbag","ahn","pdok-ortho","vision-judge","bag","monument-text","streetlevel-measured","reviewed"],fh=new Map(cl.map((e,t)=>[e,t]));var A=["reviewed","default"],bh={plotWidthM:["bag","3dbag","streetlevel-measured",...A],depthM:["bag","3dbag",...A],eavesHeightM:["ahn","3dbag","streetlevel-measured",...A],ridgeHeightM:["ahn","3dbag","streetlevel-measured",...A],ridgeSagM:["ahn","streetlevel-measured",...A],storeys:["3dbag","osm","monument-text","streetlevel-measured",...A],storeyHeights:["streetlevel-measured",...A],hasSouterrain:["osm","monument-text","streetlevel-measured",...A],hasBelEtage:["osm","monument-text","streetlevel-measured",...A],gable:["monument-text","streetlevel-measured",...A],gableOrnament:["monument-text","streetlevel-measured",...A],corniceType:["monument-text","streetlevel-measured",...A],dressings:["monument-text","streetlevel-measured",...A],windowType:["monument-text","streetlevel-measured",...A],puiType:["monument-text","streetlevel-measured",...A],hoistBeam:["monument-text","streetlevel-measured",...A],bays:["monument-text","streetlevel-measured",...A],bayOffsetsM:["streetlevel-measured",...A],doorPositionM:["streetlevel-measured",...A],hoistBeamOffsetM:["streetlevel-measured",...A],leanDeg:["streetlevel-measured",...A],brick:["streetlevel-measured",...A]};var Hh=Object.freeze({shell:"3",roof:"11",frontage:"4",opening:"20",glazedBay:"1",facadeDetail:"11",ornament:"2",dormer:"8",nativeAperture:"1",cornice:"6",crown:"5",entrance:"9",hoist:"1"});var Rp={jamb:.32,out:2*C,entH:.42,maxTympanumH:1.4};var hl=.012,kp=C-hl,vp=2*C;var Ap={postW:.14,postOut:3*C,railH:.12,railOut:2*C,maxSegM:9};var pl={postW:.1,postOut:3*C,railH:.1,railOut:2*C,maxSegM:9};var _p={back:C,out:2*C,minH:.15},$p={...pl,postOut:4*C,railOut:3*C};var bl={from:.15,to:.92,joint:.06,back:C,out:2*C,minW:.4};var Cp={post:.24,postOut:4*C,sillH:.12,sillOut:.15,headGap:.06,maxSegM:9};var Fp={bayOut:.45,flushOut:2*C,post:.18,slabH:.18,transomH:.1,slabOverhang:.18,maxSegM:9,postOut:2*C,slabOut:4*C};var tn={horizontalBars:[.25,.5,.75],horizontalBarWidthsM:[.03,.06,.03],mullionWidthM:.03},gg={sash:{verticalBars:[.5],horizontalBars:[.55]},"two-light":{verticalBars:[.5],horizontalBars:[.8]},"sash-small-panes":{verticalBars:[1/3,2/3],horizontalBars:[.25,.5,.75]},cross:{verticalBars:[.5],horizontalBars:[.36]},plain:{},arched:{verticalBars:[.5],horizontalBars:[.55]},shop:{},ladder:{horizontalBars:[.2,.4,.6,.8]},"sash-6-over-6":{verticalBars:[1/3,2/3],...tn},"sash-8-over-8":{verticalBars:[.25,.5,.75],...tn},"sash-4-over-4":{verticalBars:[.5],...tn},"sash-1-over-1":{horizontalBars:[.5],horizontalBarWidthsM:[.06]},"sash-9-over-9":{verticalBars:[1/3,2/3],horizontalBars:[1/6,1/3,.5,2/3,5/6],horizontalBarWidthsM:[.03,.03,.06,.03,.03],mullionWidthM:.03},"six-pane":{verticalBars:[.5],horizontalBars:[1/3,2/3],mullionWidthM:.045},"t-window":{horizontalBars:[.76],horizontalBarWidthsM:[.07],diagonalBars:[[[.5,.05],[.5,.73]]]},"small-over-one":{verticalBars:[.5],horizontalBars:[.62,.81],horizontalBarWidthsM:[.06,.03],mullionWidthM:.045,diagonalBars:[[[1/3,.65],[1/3,.95]],[[2/3,.65],[2/3,.95]]]},"cross-transom":{verticalBars:[.5],horizontalBars:[.6],horizontalBarWidthsM:[.07],diagonalBars:[[[.25,.05],[.25,.95]],[[.75,.05],[.75,.95]],[[.05,.3],[.95,.3]],[[.05,.8],[.95,.8]]]},"casement-toplight":{verticalBars:[.5],horizontalBars:[.8],horizontalBarWidthsM:[.05],mullionWidthM:.05},"casement-transom":{horizontalBars:[.8],horizontalBarWidthsM:[.05]},"casement-gridded-toplight":{verticalBars:[.5],horizontalBars:[.8],horizontalBarWidthsM:[.05],mullionWidthM:.05,diagonalBars:[[[.25,.81],[.25,.95]],[[.75,.81],[.75,.95]]]},"casement-triple":{verticalBars:[.27,.73],mullionWidthM:.05},"casement-toplight-double":{verticalBars:[.25,.5,.75],horizontalBars:[.8],horizontalBarWidthsM:[.05],mullionWidthM:.05},"casement-gridded-toplight-double":{verticalBars:[.25,.5,.75],horizontalBars:[.8],horizontalBarWidthsM:[.05],mullionWidthM:.05,diagonalBars:[.125,.375,.625,.875].map(e=>[[e,.81],[e,.95]])},"casement-pair":{verticalBars:[.5],mullionWidthM:.05},"casement-small-panes":{verticalBars:[.25,.5,.75],horizontalBars:[.36,.8],horizontalBarWidthsM:[.03,.05],mullionWidthM:.05},"casement-sidelights-toplight":{verticalBars:[.14,.86],horizontalBars:[.86],horizontalBarWidthsM:[.035],mullionWidthM:.035}};var go=["spout","neck","raised-neck","bell","step","point","cornice","flat","shouldered"];var yo=["slate","black-tile","red-tile","bitumen","zinc","copper"];var nn=64;var ay=[...yo,"flat-bitumen","unknown"];var Mo={canal:2.5,c19:2.2,school:1.6,postwar:1.8,modern:2.1,tower:1.5},h=(e,t,n,r,o)=>({name:e,kind:t,byte:n,...r!==void 0?{bit:r,width:o}:{}}),rn=[h("wall","rgb",0),h("wallMaterial","bits",3,0,4),h("wallSrc","bits",3,4,2),h("lifted","bits",3,6,1),h("frame","rgb",4),h("frameSrc","bits",7,0,2),h("glassTone","bits",7,2,3),h("style","bits",7,5,3),h("wallHcm","u16",8),h("plinthDm","u8",10),h("seed","u8",11),h("roof","rgb",12),h("roofMaterial","bits",15,0,4),h("roofSrc","bits",15,4,2),h("lid","bits",15,6,1),h("storeys","u8",16),h("groundDm","u8",17),h("upperDm","u8",18),h("atticDm","u8",19),h("baysGround","u8",20),h("baysUpper","u8",21),h("baysAttic","u8",22),h("doorBay","u8",23),h("windowKind","u8",24),h("windowHead","bits",25,0,3),h("archRing","bits",25,3,2),h("keystone","bits",25,5,1),h("tympanum","bits",25,6,2),h("windowShare","u8",26),h("windowHeightQ","u8",27),h("cornice","bits",28,0,3),h("corniceDepthDm","bits",28,3,3),h("hoist","bits",28,6,1),h("shutters","bits",28,7,1),h("basement","bits",29,0,2),h("souterrain","bits",29,2,1),h("stoop","bits",29,3,1),h("balconies","bits",29,4,1),h("bayWindow","bits",29,5,1),h("tallGround","bits",29,6,1),h("dormers","bits",29,7,1),h("statedMask","u8",30),h("mirrored","bits",31,0,1),h("shareQ","bits",31,1,7),h("accent","rgb",32),h("bands","bits",35,0,3),h("bandLines","bits",35,3,3),h("sills","bits",35,6,1),h("quoins","bits",35,7,1),h("spekSpacing","u8",36),h("spekCourses","u8",37),h("surround","bits",38,0,3),h("archRingColour","bits",38,3,2),h("quoinsKind","bits",38,5,2),h("bandSillCm","u8",39),h("bandHeadCm","u8",40),h("bandTransomAt","u8",41),h("band","rgb",42),h("bandsSrc","bits",45,0,2),h("surroundSrc","bits",45,2,2),h("keystoneSrc","bits",45,4,2),h("quoinsSrc","bits",45,6,2),h("windowRevealCm","u8",46),h("doorRevealCm","u8",47),h("groundKind","bits",48,0,4),h("groundSrc","bits",48,4,2),h("awning","bits",48,6,1),h("stallriserOn","bits",48,7,1),h("entrance","bits",49,0,3),h("glazing","bits",49,3,2),h("stallriser","bits",49,5,2),h("fasciaOn","bits",49,7,1),h("fascia","rgb",50),h("shopPaint","rgb",53),h("displayWindows","u8",56),h("fasciaHeightDm","u8",57),h("stallriserDm","u8",58),h("shopStoreys2","bits",59,0,1),h("souterrainUnderStoop","bits",59,1,1),h("ribbonStorey1","bits",59,2,1),h("door","rgb",60)],iy=new Map(rn.map(e=>[e.name,e]));var w=e=>Number.isInteger(e)?e.toFixed(1):String(e),at=e=>`vec3(${[1,3,5].map(t=>(parseInt(e.slice(t,t+2),16)/255).toFixed(5)).join(", ")})`;function yl(){let e=t=>`((frT${t>>4}[${t>>2&3}] >> ${(t&3)*8}u) & 255u)`;return rn.map(t=>t.kind==="rgb"?`vec3 fr_${t.name}() { return vec3(float(${e(t.byte)}), float(${e(t.byte+1)}), float(${e(t.byte+2)})) / 255.0; }`:t.kind==="u16"?`float fr_${t.name}() { return float(${e(t.byte)} | (${e(t.byte+1)} << 8u)); }`:t.kind==="u8"?`float fr_${t.name}() { return float(${e(t.byte)}); }`:`float fr_${t.name}() { return float((${e(t.byte)} >> ${t.bit}u) & ${(1<<t.width)-1}u); }`).join(`
`)}var Ml=`float frPitch(float style) { ${Oe.map((e,t)=>`if (style < ${w(t+.5)}) return ${w(Mo[e])};`).join(" ")} return 2.0; }`,wl=1;var V=.0625,Re=.22,ke=.012,ko=1.35,xl=.14,wo=ke/V+ke/Re-ke/V*(ke/Re),Sl=wo*ko+(1-wo),xo=[1,0,.35,0,0,0,0],Rl=.6,on=.125,So=.22,Ro=[.55,.7],kl=.5,ue=[[1,2,0,0,0],[3,4,0,0,0],[2,2,0,0,0],[1,1,0,0,0],[2,1,0,0,0],[1,1,0,0,0],[2,1,0,0,0],[1,5,0,0,0],[3,4,0,0,0],[4,4,0,0,0],[3,6,0,0,0],[2,3,0,0,0],[2,1,1,1,.3],[1,1,4,1,.3],[2,1,2,1,.3],[2,1,1,1,.25],[2,1,2,1,.25],[2,1,4,2,.3],[3,1,3,1,.25],[2,1,2,1,.25],[2,1,6,2,.3],[2,1,0,0,0],[2,4,0,0,0],[3,1,1,1,.25]],it=.04,vl=.45,lt=[0,.25,.4,.55,.5],Al=e=>e.map(t=>`vec4(${t.map(w).join(", ")})`).join(", "),_l=`
const vec4 FR_PANES[${ue.length}] = vec4[${ue.length}](${Al(ue.map(e=>e.slice(0,4)))});
const float FR_PANE_TOP[${ue.length}] = float[${ue.length}](${ue.map(e=>w(e[4])).join(", ")});
// Bars dividing [a, b] into n parts (n - 1 bars of FR_BAR), box-filtered; their area share once a part is under a pixel.
float frBars(float x, float a, float b, float n, float fw) {
  if (n < 1.5) return 0.0;
  float part = (b - a) / n, t = (x - a) / part, d = abs(t - floor(t + 0.5)) * part;
  if (t < 0.5 || t > n - 0.5) return 0.0;
  float c = clamp(0.5 + (${w(it/2)} - d) / fw, 0.0, 1.0);
  return mix(c, ${w(it)} / part, smoothstep(0.5 * part, part, fw));
}
// Glazing bars of a window kind over the pane [x0, x1] x [y0, y1]; a transom bar under the toplight.
float frGlazing(vec2 p, vec2 fw, float x0, float x1, float y0, float y1, float kind) {
  int k = int(clamp(kind, 0.0, ${w(ue.length-1)}) + 0.5);
  vec4 g = FR_PANES[k]; float top = FR_PANE_TOP[k];
  float split = top > 0.0 ? y1 - (y1 - y0) * top : y1;
  float c;
  if (p.y < split) c = max(frBars(p.x, x0, x1, g.x, fw.x), frBars(p.y, y0, split, g.y, fw.y));
  else c = max(frBars(p.x, x0, x1, g.z, fw.x), frBars(p.y, split, y1, g.w, fw.y));
  if (top > 0.0) c = max(c, frCover(p.y, split - ${w(it/2)}, split + ${w(it/2)}, fw.y));
  return c;
}
// The reveal's shadow on the glass: a strip along the head and the left jamb as deep as the reveal (sun from the upper left).
float frReveal(vec2 p, vec2 fw, float x0, float y1, float depth) {
  return max(frCover(p.x, x0, x0 + depth, fw.x), frCover(p.y, y1 - depth, y1, fw.y)) * ${w(vl)};
}
float frHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// Brick coursing, mean 1 over the wall; it fades to its mean as a course falls under about two pixels. Brick patches
// (two bricks x two courses) carry the brick's texture further out (FR_MOTTLE, S6c).
float frBrick(vec2 w, vec2 fw, float material, float contrast) {
  float amp = material < 0.5 ? ${w(xo[0])} : (material > 1.5 && material < 2.5 ? ${w(xo[2])} : 0.0);
  if (amp <= 0.0) return 1.0;
  float prow = floor(w.y / ${w(on)}), pcol = floor((w.x + mod(prow, 2.0) * ${w(.5*So)}) / ${w(So)});
  float brickPatch = 1.0 + amp * contrast * ${w(Rl)} * (frHash(vec2(prow * 7.0 + 3.0, pcol * 3.0 + 11.0)) - 0.5)
    * (1.0 - smoothstep(${w(.3*on)}, ${w(.5*on)}, max(fw.x, fw.y)));
  amp *= contrast * (1.0 - smoothstep(${w(.25*V)}, ${w(.6*V)}, max(fw.x, fw.y)));
  if (amp <= 0.0) return brickPatch;
  float row = floor(w.y / ${w(V)}), yy = w.y - row * ${w(V)};
  float x = w.x + mod(row, 2.0) * ${w(.5*Re)}, col = floor(x / ${w(Re)}), xx = x - col * ${w(Re)};
  float joint = max(1.0 - frCover(yy, ${w(ke)}, ${w(V)}, fw.y), 1.0 - frCover(xx, ${w(ke)}, ${w(Re)}, fw.x));
  float tone = 1.0 + (frHash(vec2(row, col)) - 0.5) * ${w(xl)};
  return brickPatch * (1.0 + amp * (mix(tone, ${w(ko)}, joint) / ${w(Sl)} - 1.0));
}
// Speklagen: spekCourses stone courses every spekSpacing + spekCourses courses, averaged when under a pixel.
float frSpek(float y, vec2 fw) {
  float s = fr_spekSpacing(), n = fr_spekCourses();
  if (s < 0.5 || n < 0.5) return 0.0;
  float per = (s + n) * ${w(V)}, h = n * ${w(V)};
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
  float h = k == 1 ? ${w(lt[1])} : k == 2 ? ${w(lt[2])} : k == 3 ? ${w(lt[3])} : k == 4 ? ${w(lt[4])} : 0.0;
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
`,vo=`
attribute vec3 wall;
attribute float rec;
attribute float wallKind;
uniform float wallUnit;
varying vec3 vWall;
flat varying float vRec;
flat varying float vWallKind;
`,Ao=`
vWall = wall * wallUnit; vRec = rec; vWallKind = wallKind;
`,_o=`
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
  ivec2 at = ivec2((r % ${nn}) * 4, int(recBase + 0.5) + r / ${nn});
  frT0 = texelFetch(facadeRecords, at, 0); frT1 = texelFetch(facadeRecords, at + ivec2(1, 0), 0);
  frT2 = texelFetch(facadeRecords, at + ivec2(2, 0), 0); frT3 = texelFetch(facadeRecords, at + ivec2(3, 0), 0);
}
${yl()}
${Ml}
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
  return g < 0.55 ? mix(${at(j[0])}, ${at(j[1])}, g / 0.55) : mix(${at(j[1])}, ${at(j[2])}, (g - 0.55) / 0.45);
}
${_l}
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
  float paleK = mix(1.0, ${w(kl)}, smoothstep(${w(Ro[0])}, ${w(Ro[1])}, pow(dot(wl, vec3(0.2126, 0.7152, 0.0722)), 1.0 / 3.0)));
  vec3 wallC = fr_wall() * ${w(wl)} * frBrick(w, fw, fr_wallMaterial(), facadeKnobs.x * paleK);
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
`;var Ry=[...go,"cornice-ledge"];var Cl=["STRS","FOOT","ATTR","STYL","ROOF","GRP ","HIDE","SHEL","SHL1","FREC","CROW"],Ty=Cl.slice(0,7);var Vy=2**-17;var Fl=["kind","index","dup","xyCode","dx","dy","quadZ","quadH","quadU","quadDu","quadV","quadDv","z","u","v","layer","shade","colourSame","colour","bids"],zy=[...Fl,"thinCm","thinClass"];var $o=.02;var Tl="glassReflect";function Co(e){try{let t=globalThis;if(e===void 0&&typeof t.__canalRecallGlassReflect=="boolean")return t.__canalRecallGlassReflect;let n=e??t.location?.search;return n!==void 0?new URLSearchParams(n).get(Tl)!=="0":t.process?.env?.GLASS_REFLECT!=="0"}catch{return!0}}var sn="glassFinish",Ll=["reflective"],Fo=e=>typeof e=="string"&&Ll.includes(e),B={f0:.6,metalness:.2,roughness:.12,skyline:.14,street:-.2,glintPeak:3,clouds:.55},ve={zenith:qe.zenith,horizon:qe.horizon,facades:"#69635c",street:"#8f887c",sun:"#fff4e2",cloud:"#e9edf0"},El=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},Ae=e=>[1,3,5].map(t=>El(parseInt(e.slice(t,t+2),16))),_e={zenith:Ae(ve.zenith),horizon:Ae(ve.horizon),facades:Ae(ve.facades),street:Ae(ve.street),sun:Ae(ve.sun),cloud:Ae(ve.cloud)},Ol=e=>.03+.5*e,Il=e=>2/Math.max(e*e,.001);var O=e=>Number.isInteger(e)?e.toFixed(1):String(+e.toFixed(6)),ce=e=>`vec3(${e.map(O).join(", ")})`,To=`
vec3 cityGlassEnv(vec3 r) {
  float w = ${O(Ol(B.roughness))};
  float up = smoothstep(${O(B.skyline)}, 1.0, r.z);
  float skyK = smoothstep(${O(B.skyline)} - w, ${O(B.skyline)} + w, r.z);
  float lowK = smoothstep(${O(B.street)} - w, ${O(B.skyline)}, r.z);
  float ck = 3.0 / (max(r.z, 0.0) + 0.3);
  vec2 cp = r.xy * ck;
  float cc = smoothstep(0.45, 0.85, 0.5 + 0.25 * (sin(cp.x * 1.7 + sin(cp.y * 2.3)) + sin(cp.y * 1.3 + sin(cp.x * 2.9 + 1.0))));
  vec3 s = mix(mix(${ce(_e.horizon)}, ${ce(_e.zenith)}, up), ${ce(_e.cloud)}, ${O(B.clouds)} * (skyK > 0.0 ? cc : 0.0));
  vec3 b = mix(${ce(_e.street)}, ${ce(_e.facades)}, lowK);
  return mix(b, s, skyK);
}
vec3 cityGlassReflect(vec3 n, vec3 v, vec3 albedo, out vec3 keep) {
  float nv = clamp(dot(n, v), 0.0, 1.0);
  vec3 r = 2.0 * nv * n - v;
  vec3 sunDir = ${ce(no)};
  float glint = dot(n, sunDir) > 0.0 ? ${O(B.glintPeak)} * pow(max(dot(r, sunDir), 0.0), ${O(Il(B.roughness))}) : 0.0;
  vec3 f0 = mix(vec3(${O(B.f0)}), albedo, ${O(B.metalness)});
  vec3 F = f0 + (max(vec3(${O(1-B.roughness)}), f0) - f0) * pow(1.0 - nv, 5.0);
  keep = (1.0 - F) * ${O(1-B.metalness)};
  return F * (cityGlassEnv(r) + glint * ${ce(_e.sun)});
}`;var Pl={legacy:.9,sunny:1},Dl=(e=J())=>Pl[e],z=Dl(),Be=255/Ee,Bl=255/228,Nl=255/243,Wl=255/246,ct=[{cell:"brick",tileM:N.brick,clampUv:!1,litGain:Be*z,skyTint:!1},{cell:"stucco",tileM:N.stucco,clampUv:!1,litGain:Nl*z,skyTint:!1},{cell:"stone",tileM:N.stone,clampUv:!1,litGain:Bl*z,skyTint:!1},{cell:"white",tileM:1,clampUv:!1,litGain:1,skyTint:!1},{cell:"door",tileM:N.door,clampUv:!1,litGain:1,skyTint:!1},{cell:"glass",tileM:N.glass,clampUv:!0,litGain:1,skyTint:!0},{cell:"tile",tileM:N.roofTile,clampUv:!1,litGain:Be*z,skyTint:!1},{cell:"slate",tileM:N.slate,clampUv:!1,litGain:Be*z,skyTint:!1},{cell:"flat",tileM:N.bitumen,clampUv:!1,litGain:Be*z,skyTint:!1},{cell:"brick20",tileM:N.brick,clampUv:!1,litGain:Be*z,skyTint:!1},{cell:"whiteStucco",tileM:N.stucco,clampUv:!1,litGain:Wl*z,skyTint:!1},{cell:"glassTint",tileM:N.glass,clampUv:!0,litGain:1,skyTint:!0}],ut=ct.length,Ne=Object.fromEntries(ct.map((e,t)=>[e.cell,t])),an=64,Hl=Ct.school;function un(e,t={}){let n=Ul(e,t);return t.windowGrid&&Gl.has(Ft[e])?n+an:n}var Gl=new Set(["brick","stucco","stone"]);function Ul(e,t){let n=Ft[e],r=t.source==="measured";return n==="glass"&&r?Ne.glassTint:n==="brick"&&!r&&typeof t.year=="number"&&t.year>=Hl?Ne.brick20:n==="stucco"&&t.white?Ne.whiteStucco:n==="frame"?Ne.white:Ne[n]}function jl(){return ct.map(e=>[1/e.tileM,e.clampUv?1:0,e.litGain,e.skyTint?1:0])}var Vl=.38,zl=.8,ql=.27,Kl=.97,Yl=.75,Xl=.5,Zl=.12,Jl=(e,t)=>(e<45||e>340)&&t>=.2;function Po(e,t,n,r=J(),o,a=!1,s=!1){if(s&&(e==="brick"||e==="accent")&&!Lt(e,n)&&Mn())return wn(Po(e,t,n,r,o,a),t);if(Lt(e,n))return Ve(e,xr(e,t,n,r,o),n);let i=x(t),[u,l,c]=k(i);if(e==="slate"&&Jl(u,l))return Ve("roofTile",t);if((e==="brick"||e==="accent")&&a){let d=ao(t);if(d)return d}return(e==="brick"||e==="accent")&&l<Zl?R(L([u,l,Math.min(Y[1],Math.max(Y[0],.12+c*.9))])):e==="slate"&&c>Vl?R(L([u,Math.min(l,.12),Math.min(.72,c/zl)])):e==="slate"?c<ql?U.slate[1]:U.slate[0]:e==="frame"&&c>=.5&&c<Yl?R(i):e==="stone"&&c<Xl?R(i):Ve(e,t)}function Do(e,t,n,r=J(),o,a,s=!1,i=!1){let u=Po(e,t,n,r,o,s,i),[l,c,d]=x(lo(e,u,a??null,n,r));return[l,c,d,255]}function Ql(e,t,n){switch(t){case"brick":return vr(e,n);case"brick20":return Tr(e,n);case"stucco":return Cr(e);case"whiteStucco":return Lr(e);case"stone":return Fr(e);case"white":case"frame":return Er(e);case"door":return $r(e);case"glass":return Ar(e);case"glassTint":return _r(e);case"tile":return Ye(e,"tile");case"slate":return Ye(e,"slate");case"flat":return Ye(e,"flat")}}function eu(e,t,n){let r=n*n,o=new Uint8Array(r*4*ut),a=new Uint8Array(r*2*ut),s=e.createElement("canvas");s.width=s.height=n;let i=s.getContext("2d",{willReadFrequently:!0});return i.imageSmoothingQuality="high",ct.forEach((u,l)=>{i.clearRect(0,0,n,n),i.drawImage(Ql(e,u.cell,t),0,0,n,n);let c=i.getImageData(0,0,n,n).data;for(let d=0;d<n;d++)for(let f=0;f<n;f++){let m=((n-1-d)*n+f)*4,p=l*r+d*n+f;o[p*4]=c[m],o[p*4+1]=c[m+1],o[p*4+2]=c[m+2],o[p*4+3]=255,a[p*2]=255,a[p*2+1]=0}}),{colour:o,mask:a}}async function tu(e=document){let t=new Image;t.src=new URL("materials/ambientcg/Bricks057/colour.jpg",e.baseURI).href;try{return await t.decode(),t}catch{return null}}var cn=e=>`${e.lit?"lit":"unlit"}|${e.kind}|${e.kind==="slot"?e.uv??"uv":"-"}|${e.highlight?"hl":e.dim?"dim":"-"}|${e.side??0}${e.noFade?"|nofade":""}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf2":""}${e.farWindows&&e.kind==="chunk"?"|fwin":""}${e.lodBias?"|lodb":""}${e.aniso?"|aniso":""}${e.taps?"|taps":""}${ft(e)?"|frec":""}${dt(e)?"|grefl":""}`,dt=e=>!!e.reflect&&e.lit&&e.kind==="slot",ft=e=>!!e.records&&e.lit&&e.kind==="chunk";function nu(e){let t={CITY_SLOT_COUNT:String(ut)};return e.kind==="slot"&&(t.CITY_SLOT=""),e.swap&&(t.CITY_SWAP=""),e.cellDebug&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CELL_DEBUG_RHO="",e.cellDebug==="under"&&(t.CELL_DEBUG_UNDER="")),e.windows&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CITY_WINDOW_SDF=""),e.farWindows&&e.kind==="chunk"&&(t.FAR_WINDOWS=""),e.lodBias&&e.kind==="chunk"&&(t.CELL_LOD_BIAS=""),e.aniso&&e.kind==="chunk"&&(t.CELL_TIER_ANISO=""),e.taps&&e.kind==="chunk"&&(t.CELL_TAPS=""),ft(e)&&(t.CITY_FACADE_RECORD=""),dt(e)&&(t.CITY_GLASS_REFLECT=""),e.lit?(t.CITY_VARIANT_UNIFORMS="",{...t,...qt()}):(e.kind==="slot"&&e.uv==="box"&&(t.CITY_BOX_UV=""),e.highlight?t.CITY_HIGHLIGHT="":e.dim&&(t.CITY_DIM=""),{...t,...qt()})}function Lo(e){return{cityForce:{value:e.highlight?1:e.dim?2:0},cityBoxUv:{value:e.kind==="slot"&&e.uv==="box"?1:0}}}var ru=e=>e.lit?`city-look-v4|lit|${e.kind}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf2":""}${e.farWindows&&e.kind==="chunk"?"|fwin":""}${e.lodBias?"|lodb":""}${e.aniso?"|aniso":""}${e.taps?"|taps":""}${ft(e)?"|frec":""}${dt(e)?"|grefl":""}`:`city-look-v3|${cn({...e,side:0})}`,ou="vec3(1.0, 0.824, 0.122)",Eo="vec3(1.0, 0.637, 0.0137)",Oo="vec3(0.035, 0.05, 0.07)",su=`else {
  vec3 cityGN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  vec3 cityGV = normalize((vec4(vViewPosition, 0.0) * viewMatrix).xyz);
  vec3 cityGKeep;
  totalEmissiveRadiance += cityGlassReflect(cityGN, cityGV, diffuseColor.rgb, cityGKeep) * vSlot.w;
  diffuseColor.rgb *= mix(vec3(1.0), cityGKeep, vSlot.w);
}`,au=1,iu=.2,lu=.75,uu=1.8,$e=e=>Number.isInteger(e)?e.toFixed(1):String(e),Bo=`
float cityGrain(vec3 cell) {
  float g = clamp(dot(cell, vec3(0.299, 0.587, 0.114)) / ${$e(Ee/255)}, 0.45, 1.1);
  return mix(1.0, g, ${$e(lu)});
}`,No=32,Wo=`
#ifdef CITY_SWAP
attribute float swapSlot;
uniform vec4 citySwapUnder[${No/4}];
uniform float cityUnder;
flat varying float vCityUnder;
#endif`,Ho=`
#ifdef CITY_SWAP
int citySw = int(swapSlot + 0.5) - 1;
vCityUnder = citySw >= 0 ? citySwapUnder[citySw / 4][citySw % 4] : cityUnder;
#endif`,cu=[.5,.59],Go=`
#define BOX_PANE_UV vec2(${cu.map(e=>e.toFixed(2)).join(", ")})
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
${Wo}
${Ie}`,Uo=`
${Ho}
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
  vGrid = step(${an-.5}, layer);
  int cityS = int(clamp(layer - ${an}.0 * vGrid + 0.5, 0.0, float(CITY_SLOT_COUNT - 1)));
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
#endif`,jo=`
vFacDist = length((modelViewMatrix * vec4(position, 1.0)).xyz);
if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`,Vo=`
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${Qr}
${eo}
${co}
${mo}
${zr}
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
${Bo}
${Ie}`,zo=`
if (HL_GHOST(vHighlight)) discard;
#ifdef CITY_SWAP
float cityHash = fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296)));
if (cityFade < 1.0 && cityHash >= cityFade) discard;
// The complement of a replacement dissolving in over (or out from) this mesh: where it draws, this one does not.
if (cityHash < vCityUnder) discard;
#else
if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;
#endif`,qo=`
vec2 cityUv = vSlot.y > 0.5 ? clamp(vFacUv, 0.0, 1.0) : vFacUv;
vec3 cityP = vec3(cityUv, vLayer);
vec3 cityC; vec2 cityM;
#ifdef CITY_SLOT
vec4 cityCC = texture(cells, cityP); vec2 cityMM = texture(masks, cityP).rg;
cityC = cityCC.rgb; cityM = vec2(cityMM.r, ${xe("cityMM","cityCC")});
if (vGrid > 0.5) cityWindowGrid(vFacUv / vSlot.x, cityC, cityM);
#else
cellTierSample(cityP, vFacDist, cityC, cityM);
#ifdef CITY_WINDOW_SDF
windowSdf(cityUv, vLayer, 1.0 - cellFar, cityC, cityM);
#endif
cityC = roofTierColour(cityC, cityUv, vLayer, vFacDist);
#endif
float cityG = cityGrain(cityC);
cityC *= mix(vec3(1.0), vTint, cityM.r) * mix(vec3(1.0), vAccent, cityM.g);`,du=`
uniform mat3 enuFromWorld;
${Go}
varying float vShade;
void main() {
${Uo}
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
${oo}
  vShade = shade;
#else
  vShade = tint.a;
#endif
${jo}
}`,fu=`
precision highp float;
${Vo}
varying float vShade;
void main() {
${zo}
${qo}
  if (HL_PAINT(vHighlight)) {
    float hlShade = clamp(1.0 - (1.0 - vShade) * ${$e(uu)}, 0.6, 1.0);
    gl_FragColor = vec4(${ou} * (flatColour > 0.5 ? 1.0 : cityG) * hlShade, 1.0);
    return;
  }
  if (flatColour > 0.5) cityC = vTint;
  cityC = hlDesat(cityC, vHighlight);
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  gl_FragColor = vec4(cityC * shade, 1.0);
#ifdef CELL_DEBUG_RHO
  gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif
}`,mu=`
attribute float hidden;
flat varying float vHighlight;
varying float vFacDist;
#ifdef CITY_VARIANT_UNIFORMS
uniform float cityForce;
uniform float cityBoxUv;
#endif
${Wo}
${Ie}
${vo}`,hu=`
${Ho}
vHighlight = hlState(hidden);
#ifdef CITY_VARIANT_UNIFORMS
if (cityForce > 0.5) vHighlight = cityForce;
#endif
${Ao}`,pu=`
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${_o}
flat varying float vHighlight;
varying float vFacDist;
#ifdef CITY_SWAP
flat varying float vCityUnder;
#endif
${Bo}
${Ie}`,bu=`
vec3 cityC; vec2 cityM;
cityC = facadeRecordColour(cityM);
float cityG = cityGrain(cityC);`,gu=(e=null)=>({facadeRecords:{value:e},recBase:{value:0},facadeKnobs:{value:[1,1,1,0]},wallUnit:{value:$o}});function yu(e,t={}){return{cells:t.cells??{value:null},masks:t.masks??{value:null},slotBase:t.slotBase??{value:0},slotParams:t.slotParams??{value:jl().map(n=>new e.Vector4(...n))},bands:t.bands??{value:0},flatColour:t.flatColour??{value:0},cityFade:t.cityFade??{value:1},wallGain:t.wallGain??{value:1},roofLayers:t.roofLayers??{value:Zr},roofTier:t.roofTier??{value:Jr()},cellTier:t.cellTier??{value:Xr},enuFromWorld:t.enuFromWorld??{value:new e.Matrix3},citySwapUnder:t.citySwapUnder??{value:new Float32Array(No)},cityUnder:t.cityUnder??{value:0},windowTable:t.windowTable??{value:null},windowSdfMix:t.windowSdfMix??{value:1},cellLodBias:t.cellLodBias??{value:0},cellAniso:t.cellAniso??{value:Zt(16).cellAniso},cellAnisoRule:t.cellAnisoRule??{value:Zt(16).cellAnisoRule},cellTaps:t.cellTaps??{value:Xt().cellTaps},cellTapsSdf:t.cellTapsSdf??{value:Xt().cellTapsSdf},...fo(),...t.windowSdfBand?{windowSdfBand:t.windowSdfBand}:{},...t.windowSdfShape?{windowSdfShape:t.windowSdfShape}:{}}}var Mu={accent:[1,1,1,1],hidden:[0],color:[1,1,1],uv:[0,0],uv1:[0,0],swapSlot:[0]},ln="recipeLookShared";function wu(e,t,n){let r=nu(t),o=t.side??e.FrontSide,a,s;if(!t.lit)a=new e.ShaderMaterial({uniforms:n,defines:r,vertexShader:du,fragmentShader:fu,side:o});else{a=new e.MeshLambertMaterial({side:o,flatShading:t.kind==="chunk"}),a.defines={...a.defines??{},...r};let i=ft(t),u=i?{...Lo(t),...gu()}:Lo(t);i&&(s=u);let l=i?mu:Go,c=i?hu:Uo,d=dt(t),f=(i?pu:Vo)+(d?To:""),m=i?bu:qo;a.onBeforeCompile=b=>{for(let M of Object.keys(n))b.uniforms[M]=n[M];Object.assign(b.uniforms,u),b.vertexShader=b.vertexShader.replace("#include <common>",`#include <common>${l}`).replace("#include <begin_vertex>",`#include <begin_vertex>${c}`).replace("#include <project_vertex>",`#include <project_vertex>${jo}`),b.fragmentShader=b.fragmentShader.replace("#include <common>",`#include <common>${f}
float cityLuma;`).replace("#include <dithering_fragment>",`#include <dithering_fragment>
#ifdef CELL_DEBUG_RHO
gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>${zo}`).replace("#include <map_fragment>",`${m}
#ifdef CITY_SLOT
cityC *= vSlot.z;
#else
cityC *= mix(1.0, wallGain * ${$e(z)}, cityM.r);
#endif
if (flatColour > 0.5) cityC = ${i?"fr_wall()":"vTint"};
cityLuma = dot(cityC, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= HL_PAINT(vHighlight) ? ${Eo} * ${$e(au)} * pow(flatColour > 0.5 ? 1.0 : cityG, 2.2) : pow(hlDesat(cityC, vHighlight), vec3(2.2));`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
if (HL_PAINT(vHighlight)) totalEmissiveRadiance += ${Eo} * ${$e(iu)};
#ifdef CITY_SLOT
${d?su:`else totalEmissiveRadiance += ${Oo} * vSlot.w;`}
#else
// Bay glazing (dark, untinted texels): the same constant sky tint as landmark glass, never a hotspot.
else totalEmissiveRadiance += ${Oo} * (1.0 - smoothstep(0.06, 0.2, cityLuma)) * (1.0 - cityM.r);
#endif`)};let p=ru(t);a.customProgramCacheKey=()=>p,a.uniforms=n}return a.defaultAttributeValues={...Mu},a.name=`city-look/${cn(t)}`,a.userData={cityLook:!0,cityVariant:{...t},[ln]:!0},s&&(a.userData.facadeRecordUniforms=s),t.noFade&&On(a),t.kind==="chunk"?vn(a,!!t.lit):a}function xu(e){return e?e.isMeshBasicMaterial||e.userData?.unlit?"unlit (decal / emissive sign)":e.transparent||(e.opacity??1)<1?"transparent":e.vertexColors?"vertex colours":e.map?"own texture":null:"no material"}function Su(e,t,n=Co()){let r=e?.userData??{};if(n&&Fo(r[sn])&&Pt(r.materialSlot)&&typeof r.tint=="string"){let s=r.materialSlot==="glass"&&r.tintSource==="measured";return{slot:"glass",tint:r.tint,inferred:r.materialSlotSource===It,...s?{source:"measured"}:{},glassFinish:r[sn]}}if(Pt(r.materialSlot)&&typeof r.tint=="string"){let s=so(r.materialSlot,r.tint,r.tintSource==="measured"?"measured":void 0)==="measured";return{slot:r.materialSlot,tint:r.tint,inferred:r.materialSlotSource===It,...s?{source:"measured"}:{},...s&&typeof r.tintWhitePoint=="string"?{white:r.tintWhitePoint}:{},...r.windowGrid===!0?{windowGrid:!0}:{}}}if(!t||xu(e)||!e.color)return null;let o="#"+e.color.getHexString(),a=lr(e.name,o);return{slot:a.slot,tint:a.tint,inferred:!0}}function Io(e,t,n,r,o={}){let a=t.getAttribute("position")?.count??0,s=un(n,o),i=Do(n,r,o.source,void 0,o.whitePoint,o.exposure,!1,!0),u=t.getAttribute("layer"),l=t.getAttribute("tint");if(u&&l)return u.getX(0)===s&&Math.round(l.getX(0)*255)===i[0]&&Math.round(l.getY(0)*255)===i[1]&&Math.round(l.getZ(0)*255)===i[2];t.setAttribute("layer",new e.BufferAttribute(new Uint8Array(a).fill(s),1,!1));let c=new Uint8Array(a*4);for(let d=0;d<a;d++)c.set(i,d*4);return t.setAttribute("tint",new e.BufferAttribute(c,4,!0)),!0}function Ru(e,t,n,r,o,a={}){let s=r.getAttribute("normal"),i=r.getAttribute("layer"),u=r.getAttribute("tint");if(!s||!i||!u)return 0;let[l,c,d]=Do("bitumen",o,a.source);t.updateWorldMatrix(!0,!0);let f=new e.Matrix4().copy(t.matrixWorld).invert().multiply(n.matrixWorld),m=new e.Matrix3().getNormalMatrix(f),p=new e.Vector3,b=un("bitumen",a),M=0;for(let g=0;g<s.count;g++)p.set(s.getX(g),s.getY(g),s.getZ(g)).applyMatrix3(m).normalize(),!(p.y<Kl)&&(i.setX(g,b),u.setXYZW(g,l/255,c/255,d/255,1),M++);return M&&(i.needsUpdate=!0,u.needsUpdate=!0),M}var ku="__canalRecallCityLookShared";function Ko(e,t={}){let n=globalThis,r=n[ku]??=new Map,o=r.get(e);return o||r.set(e,o=vu(e,t)),o}function vu(e,t={}){let n=t.document??globalThis.document,r=t.size??(globalThis.matchMedia?.("(pointer: coarse)").matches?128:256),o=yu(e),a=new Map,s=null,i=!1,u=(d,f)=>{let m=new e.DataArrayTexture(d,r,r,ut);return m.format=f,m.type=e.UnsignedByteType,m.wrapS=m.wrapT=e.RepeatWrapping,m.minFilter=e.LinearMipmapLinearFilter,m.magFilter=e.LinearFilter,m.generateMipmaps=!0,m.anisotropy=t.anisotropy??Ue("slotCells",16).anisotropy,m.unpackAlignment=1,m.needsUpdate=!0,m.userData={bytes:d.byteLength,[ln]:!0},m},l=(async()=>{if(!n)return;let d=t.brick!==void 0?t.brick:await tu(n),{colour:f,mask:m}=eu(n,d,r),p=qr(f,m);s={colour:u(p.colour,e.RGBAFormat),mask:u(p.mask,p.channels===1?e.RedFormat:e.RGFormat)},i||(o.cells.value=s.colour,o.masks.value=s.mask,o.slotBase.value=0)})(),c=d=>{let f=cn(d),m=a.get(f);return m||a.set(f,m=wu(e,d,o)),m};return{uniforms:o,ready:l,material:c,dress(d,{lit:f,infer:m=!1,year:p=null,wallExposure:b=null}){let M=0;return d.traverse(g=>{if(!g.isMesh||Array.isArray(g.material)||g.material?.userData?.cityLook)return;let y=Su(g.material,m);if(!y)return;let S=g.geometry;if(!S?.getAttribute("position"))return;let W=!!S.getAttribute("uv");!W&&!S.getAttribute("normal")&&S.computeVertexNormals();let I={year:p,white:y.inferred&&ur(g.material.name),source:y.source,...y.white?{whitePoint:y.white}:{},...b?{exposure:b}:{},...y.windowGrid?{windowGrid:!0}:{}};Io(e,S,y.slot,y.tint,I)||(S=g.geometry=S.clone(),S.deleteAttribute("layer"),S.deleteAttribute("tint"),Io(e,S,y.slot,y.tint,I)),y.inferred&&y.slot==="slate"&&!y.source&&Ru(e,d,g,S,y.tint,I);let T=g.material;g.material=c({lit:f,kind:"slot",uv:W?"uv":"box",side:T.side,...y.glassFinish==="reflective"&&f?{reflect:!0}:{}}),g.userData.citySlot={slot:y.slot,tint:y.tint,...y.source?{source:y.source}:{},...y.glassFinish?{glassFinish:y.glassFinish}:{},inferred:y.inferred,from:T.name,layer:un(y.slot,I)},T.userData?.[ln]||T.dispose(),M++}),M},highlighted(d,f){let m=d?.userData?.cityVariant;return m?c({...m,highlight:f,dim:!1}):d},dimmed(d,f){let m=d?.userData?.cityVariant;return m?c({...m,highlight:!1,dim:f}):d},bindAtlas(d){i=!!d,d?(o.cells.value=d.colour,o.masks.value=d.mask,o.slotBase.value=d.slotBase):s&&(o.cells.value=s.colour,o.masks.value=s.mask,o.slotBase.value=0)},textureBytes(){return s&&!i?Math.round((s.colour.userData.bytes+s.mask.userData.bytes)*4/3):0}}}var $u="NL.IMBAG.Pand.";var mt=e=>/^\d{16}$/.test(e)?`${$u}${e}`:e;var Cu=2*Math.PI*6378137;function Fu(e,t){return[(180+e)/360,(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+t*Math.PI/360)))/360]}function Tu(e,t){let n=e*360-180,r=180-t*360;return[n,360/Math.PI*Math.atan(Math.exp(r*Math.PI/180))-90]}var Lu=e=>1/Cu/Math.cos(e*Math.PI/180),Xo=e=>`${e.z}/${e.x}/${e.y}`;var Eu=e=>[(e.x+.5)/2**e.z,(e.y+.5)/2**e.z];function Zo(e){let t=Eu(e),n=Tu(t[0],t[1]);return{tile:e,centre:t,anchor:n,units:Lu(n[1])}}function Jo(e){let t=e.units;return[t,0,0,0,0,0,t,0,0,t,0,0,e.centre[0],e.centre[1],0,1]}function Qo(e,t,n=16,r,o=.25){let[a,s]=Fu(e,t),i=2**n,u=a*i,l=s*i,c=Math.round(u)-1,d=Math.round(l)-1;return r&&Math.abs(u-(r.x+1))<=.5+o&&Math.abs(l-(r.y+1))<=.5+o&&({x:c,y:d}=r),{x:c,y:d,tiles:[[0,0],[1,0],[0,1],[1,1]].map(([f,m])=>({z:n,x:c+f,y:d+m}))}}var Ou="recipeTiles";function rs(e){try{let t=globalThis;return e===void 0&&t.__canalRecallRecipeTiles===!0?!0:new URLSearchParams(e??t.location?.search??"").get(Ou)==="1"}catch{return!1}}function dn(e,t,n){let r=Qo(t.lng,t.lat,16,n);return{block:{x:r.x,y:r.y},tiles:r.tiles.map(Xo).filter(o=>!!e.tiles[o])}}var He=class{constructor(t,n){this.load=t;this.free=n}items=new Map;acquire(t){let n=this.items.get(t);if(!n){let r={refs:0,promise:null};r.promise=this.load(t).then(o=>r.value=o),this.items.set(t,n=r),n.promise.catch(()=>this.items.delete(t))}return n.refs++,n.promise}release(t){let n=this.items.get(t);n&&(--n.refs>0||(this.items.delete(t),n.value!==void 0?this.free(n.value,t):n.promise.then(r=>this.free(r,t),()=>{})))}get size(){return this.items.size}refs(t){return this.items.get(t)?.refs??0}};function fn(e,t){if(!e||t===void 0)return-1;for(let[n,r,o]of e)if(t>=r&&t<r+o)return n;return-1}function Iu(e,t){let n=new Map;for(let[r,o,a]of t){let s=new Set;for(let i=o*3;i<(o+a)*3;i++)s.add(e[i]);n.set(r,Uint32Array.from([...s].sort((i,u)=>i-u)))}return n}function mn(e){let t=new Set;for(let n of e)for(let r of n.covers)for(let o of r)t.add(o);return[...t].sort()}var GM=Ze.hide,es=Ze.highlight,Pu=Ze.dim,Ge=class{constructor(t){this.host=t;let n=t.THREE;this.root=new n.Group,this.root.name="recipe-tiles",this.units=new He(r=>this.loadUnit(r),r=>{for(let o of r)o.geometry.dispose()})}root;index=null;tiles=new Map;block=null;units;unregister=null;clipFromWorld=null;highlighted=new Set;focus=null;recipe=Hr();lastHidden="";pendingHidden=!1;lastCheck=0;revisionN=0;loading=0;errors=[];async start(t=21){let n=await fetch(new URL("index.json",this.host.baseUrl).href,{cache:"no-cache"});if(!n.ok)throw Error(`recipe tiles index ${n.status}`);return this.index=await n.json(),this.unregister=this.host.frame.register("recipe-tiles",{root:this.root,beforeRender:r=>(this.clipFromWorld=r.clipFromWorld,this.update(),this.root.children.length>0),revision:()=>this.revisionN},{order:t}),this.update(!0),!0}update(t=!1){if(!this.index)return;let n=performance.now();if(!t&&n-this.lastCheck<250){this.pendingHidden&&this.syncHidden();return}this.lastCheck=n;let r=this.host.getCentre();if(!r)return;let{block:o,tiles:a}=dn(this.index,r,this.block);this.block=o;let s=new Set(a);for(let u of s)this.tiles.has(u)||this.loadTile(u);if([...s].every(u=>this.tiles.get(u)?.ready))for(let[u,l]of this.tiles)s.has(u)||this.dropTile(l);this.pendingHidden&&this.syncHidden()}async loadTile(t){let n=this.host.THREE,r={id:t,meta:null,group:new n.Group,ready:!1,disposed:!1,merged:[],instanced:[],triangles:0};this.tiles.set(t,r),this.loading++;try{let o=await this.host.loadGltf(new URL(`building-mesh/${t}.glb`,this.host.baseUrl).href);if(r.disposed)return;if(r.meta=o.userData?.recipeTile,!r.meta)throw Error(`${t}: no recipeTile extras`);let[a,s,i]=r.meta.tile,u=Zo({z:a,x:s,y:i});r.group.name=`recipe-tile/${t}`,r.group.matrixAutoUpdate=!1,r.group.matrix.fromArray(Jo(u)),o.scene.updateMatrixWorld(!0);let l=this.host.cityLook,c=this.host.lit!==!1,d=[];o.scene.traverse(f=>{f.isMesh&&d.push(f)});for(let f of d){if(f.isInstancedMesh){let y=f.geometry.getAttribute("_PAND"),S=f.count,W=new Int32Array(S),I=new Float32Array(S*16);for(let F=0;F<S;F++)W[F]=Math.round(y.getX(F));let T=new n.Matrix4,ht=f.matrixWorld;for(let F=0;F<S;F++)f.getMatrixAt(F,T),T.premultiply(ht),T.toArray(I,F*16);let te=new n.InstancedMesh(f.geometry,f.material,S);for(let F=0;F<S;F++)te.setMatrixAt(F,T.fromArray(I,F*16));te.name=`stub/${f.userData.unit}`,r.group.add(te),r.instanced.push({unit:f.userData.unit,matrices:I,pands:W,meshes:[],stub:te});continue}let m=f.geometry;this.cityAttributes(m);let p=m.userData?.pandRanges??[];m.setAttribute("hidden",new n.BufferAttribute(new Uint8Array(m.getAttribute("position").count),1,!1));let b=f.material?.side??n.FrontSide,M=f.material?.userData?.cityLook?.uv??"uv",g=new n.Mesh(m,l.material({lit:c,kind:"slot",uv:M,side:b}));g.name=`recipe-tile/${t}/uniques`,g.matrixAutoUpdate=!1,g.matrix.copy(f.matrixWorld),g.userData.recipeTile={tile:t,ranges:p},this.host.frame.constructor.setShadows?.(g,!0,!0),r.group.add(g),r.merged.push({mesh:g,ranges:p,verts:Iu(m.index.array,p)}),r.triangles+=m.index.count/3}if(this.root.add(r.group),this.revisionN++,this.host.repaint(),await Promise.all(r.instanced.map(async f=>{let m=await this.units.acquire(f.unit);if(r.disposed){this.units.release(f.unit);return}for(let p of m){let b=new n.InstancedMesh(p.geometry,p.material,f.pands.length),M=new n.Matrix4;for(let g=0;g<f.pands.length;g++)b.setMatrixAt(g,M.fromArray(f.matrices,g*16).multiply(p.local));b.name=`recipe-tile/${t}/unit/${f.unit}`,b.userData.recipeTile={tile:t,pands:f.pands},b.computeBoundingSphere(),b.computeBoundingBox(),this.host.frame.constructor.setShadows?.(b,!0,!0),r.group.add(b),f.meshes.push(b),r.triangles+=p.triangles*f.pands.length}r.group.remove(f.stub),f.stub.dispose?.()})),r.disposed)return;r.ready=!0,this.applyHighlight(r),this.pendingHidden=!0,this.revisionN++,this.host.repaint()}catch(o){this.errors.push(String(o?.message??o)),console.warn(`Recipe tile ${t} unavailable; the mid/far layers keep drawing it.`,o),this.tiles.delete(t),r.group.parent?.remove(r.group)}finally{this.loading--}}cityAttributes(t){for(let[n,r]of[["_layer","layer"],["_tint","tint"],["_LAYER","layer"],["_TINT","tint"]]){let o=t.getAttribute(n);o&&(t.setAttribute(r,o),t.deleteAttribute(n))}}async loadUnit(t){let n=this.host.THREE,r=this.host.cityLook,o=this.host.lit!==!1,a=await this.host.loadGltf(new URL(`units/${t}.glb`,this.host.baseUrl).href);a.scene.updateMatrixWorld(!0);let s=[];return a.scene.traverse(i=>{if(!i.isMesh)return;let u=!!i.material?.userData?.cityLook;u&&this.cityAttributes(i.geometry);let l=u?r.material({lit:o,kind:"slot",uv:i.material.userData.cityLook.uv??"uv",side:i.material.side}):i.material;s.push({geometry:i.geometry,material:l,local:i.matrixWorld.clone(),triangles:(i.geometry.index?.count??i.geometry.getAttribute("position").count)/3,city:u})}),s}dropTile(t){t.disposed=!0,this.tiles.delete(t.id),t.group.parent?.remove(t.group);for(let n of t.merged)n.mesh.geometry.dispose();for(let n of t.instanced){for(let r of n.meshes)r.dispose?.();n.stub?.geometry?.dispose?.(),n.meshes.length&&this.units.release(n.unit)}this.pendingHidden=!0,this.revisionN++}syncHidden(){let t=[...this.tiles.values()].filter(o=>o.ready),n=mn(t.map(o=>o.meta)),r=n.join(",");if(r!==this.lastHidden){if(this.host.setHidden(n)===!1)return;this.lastHidden=r}this.host.setReplacedSpecs?.(new Set(t.flatMap(o=>o.meta.specs))),this.pendingHidden=!1}setHighlighted(t,n){this.highlighted=new Set([...t].map(r=>mt(String(r)))),this.focus=n&&this.highlighted.size?n:null;for(let r of this.tiles.values())r.ready&&this.applyHighlight(r);this.host.repaint()}applyHighlight(t){let n=this.host.THREE,r=this.host.cityLook,o=this.recipe,a=f=>this.highlighted.has(mt(t.meta.pands[f]))||t.meta.covers[f].some(m=>this.highlighted.has(m)),s=f=>o.desaturate&&Ur(this.focus?.lngLat,f),i=new n.Vector3,u=f=>(i.copy(f).applyMatrix4(t.group.matrix),ts(i.x,i.y));for(let f of t.merged){let m=f.mesh.geometry.getAttribute("hidden"),p=!1,b=null;(o.desaturate||o.outline||o.rim)&&(f.where??=Du(n,f.mesh,f.verts,u));for(let[M,g]of f.verts){let y=f.where?.get(M),S=a(M)?es:y&&this.focus&&s(y.lngLat)?Pu:0;if(S===es&&y&&(b??=y.local),m.array[g[0]]!==S){for(let W of g)m.array[W]=S;p=!0}}p&&(m.needsUpdate=!0),b&&(o.outline||o.rim)?Kt(n,f.mesh,{merged:!0,centre:b}):Je(f.mesh)}let l=new n.Matrix4().makeScale(0,0,0),c=new n.Matrix4,d=new n.Vector3;for(let f of t.instanced)for(let m of f.meshes){for(let b of m.userData.highlights??[])m.parent?.remove(b);m.userData.highlights=[];let p=m.userData.saved??=new Map;for(let b=0;b<f.pands.length;b++){p.has(b)?c.copy(p.get(b)):m.getMatrixAt(b,c);let M=a(f.pands[b])?"highlight":this.focus&&o.desaturate&&s(u(d.setFromMatrixPosition(c)))?"dim":"plain";if(M!=="plain"){let g=m.material?.userData?.cityVariant,y=o.keepMaterials||M==="dim"?m.material:g?r.highlighted(m.material,!0):Bu(n,m.material),S=new n.Mesh(m.geometry,y);S.matrixAutoUpdate=!1,S.matrix.copy(c),S.name=`recipe-tile/${M}`,o.keepMaterials&&Vr(n,S,M,{cityVariant:(W,I)=>I==="dim"?r.dimmed(W,!0):W}),m.parent.add(S),m.userData.highlights.push(S),p.set(b,c.clone()),m.setMatrixAt(b,l)}else p.has(b)&&(m.setMatrixAt(b,p.get(b)),p.delete(b))}m.instanceMatrix.needsUpdate=!0}}inspectAtScreen(t,n,r,o){let a=this.host.THREE;if(!this.clipFromWorld||!r||!o||!this.root.children.length)return null;let s=t/r*2-1,i=1-n/o*2,u=this.clipFromWorld.clone().invert(),l=new a.Vector3(s,i,-1).applyMatrix4(u),c=new a.Vector3(s,i,1).applyMatrix4(u);this.root.updateWorldMatrix(!0,!0);let d=new a.Raycaster(l,c.sub(l).normalize());for(let f of d.intersectObject(this.root,!0)){let m=f.object.userData?.recipeTile,p=m&&this.tiles.get(m.tile);if(!p?.ready||!f.object.visible)continue;let b=m.ranges?fn(m.ranges,f.faceIndex):m.pands?.[f.instanceId??-1]??-1;if(b<0)continue;let M=f.point.clone().applyMatrix4(this.clipFromWorld).z;if(M<-1||M>1)continue;let g=p.meta.pands[b],y=f.point.clone().applyMatrix4(this.root.matrixWorld.clone().invert()),S=ts(y.x,y.y);return{id:/^\d{16}$/.test(g)?mt(g):g,name:p.meta.names[b]??g,depth:M,lngLat:S,recipeTile:p.id}}return null}stats(){let t=0,n=0,r=0;for(let o of this.tiles.values()){n+=o.triangles;for(let a of o.merged)a.mesh.visible&&t++;for(let a of o.instanced)t+=a.meshes.length||1,r+=a.pands.length}return{tiles:[...this.tiles.keys()].sort(),ready:[...this.tiles.values()].filter(o=>o.ready).length,loading:this.loading,units:this.units.size,draws:t,triangles:n,instances:r,hidden:this.lastHidden?this.lastHidden.split(",").length:0,errors:this.errors.slice(-5)}}dispose(){for(let t of[...this.tiles.values()])this.dropTile(t);this.host.setHidden([]),this.host.setReplacedSpecs?.(new Set),this.unregister?.()}};function Du(e,t,n,r){let o=new Map,a=t.geometry.getAttribute("position"),s=new e.Vector3;for(let[i,u]of n){let l=0,c=0,d=0;for(let p of u)l+=a.getX(p),c+=a.getY(p),d+=a.getZ(p);let f=Math.max(1,u.length),m=[l/f,c/f,d/f];o.set(i,{local:m,lngLat:r(s.set(...m).applyMatrix4(t.matrix))})}return o}function ts(e,t){let n=e*360-180,r=180-t*360;return[n,360/Math.PI*Math.atan(Math.exp(r*Math.PI/180))-90]}var ns=new WeakMap;function Bu(e,t){let n=ns.get(t);return n||(n=new e.MeshLambertMaterial({color:16765471,emissive:7033856,side:t?.side??e.FrontSide}),ns.set(t,n)),n}function os(){let e=globalThis;return new URL(e.__canalRecallRecipeTilesBase??"./recipe-tiles/",e.location.href).href}async function Nu(e){let t=globalThis.CanalRecallThree,n=t?.THREE,r=e._sharedFrame??e._ensureSharedFrame?.();if(!n||!r)throw Error("recipe tiles need the shared frame (?sharedFrame=1 is implied by ?recipeTiles=1)");let o=new t.GLTFLoader;t.MeshoptDecoder&&o.setMeshoptDecoder(t.MeshoptDecoder);let a=new Set,s=()=>{let l=e._signatureLandmarks;if(!l||l.__recipeTilesWrapped)return;let c=l.canShowModel.bind(l);l.canShowModel=d=>!a.has(d.id)&&c(d),l.__recipeTilesWrapped=!0},i={THREE:n,frame:r,baseUrl:os(),lit:!0,cityLook:Ko(n,{anisotropy:globalThis.matchMedia?.("(pointer: coarse)").matches?1:Ue("slotCells",16).anisotropy}),loadGltf:l=>o.loadAsync(l),getCentre:()=>e.map?.getCenter?.(),setHidden:l=>{let c=e._threeBuildings;return c?.setHidden?(c.setHidden("recipe-tiles",l),e._pyramidalRoofs?.setHiddenReason?.("recipe-tiles",l),!0):!1},setReplacedSpecs:l=>{s(),a=l,e.map?.triggerRepaint?.()},repaint:()=>e.map?.triggerRepaint?.()},u=new Ge(i);return await u.start(),u}return cs(Wu);})();

"use strict";var CanalRecallTileBuildings=(()=>{var Oe=Object.defineProperty;var ur=Object.getOwnPropertyDescriptor;var cr=Object.getOwnPropertyNames;var mr=Object.prototype.hasOwnProperty;var fr=(e,t)=>{for(var n in t)Oe(e,n,{get:t[n],enumerable:!0})},dr=(e,t,n,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of cr(t))!mr.call(e,o)&&o!==n&&Oe(e,o,{get:()=>t[o],enumerable:!(r=ur(t,o))||r.enumerable});return e};var hr=e=>dr(Oe({},"__esModule",{value:!0}),e);var Gs={};fr(Gs,{RefCache:()=>me,TileBuildings:()=>fe,coverUnion:()=>lt,mountRecipeTiles:()=>Hs,pandOfFace:()=>it,recipeTilesBase:()=>lr,recipeTilesEnabled:()=>ir,wantedTiles:()=>st});var ut={minFilter:"LinearMipmapLinear",magFilter:"Linear",generateMipmaps:!0};function pr(e,t){let n=t.coarse?128:256,r=e==="facadeCells"?Math.min(t.gpuMaxAnisotropy,t.coarse?4:16):4;return{...ut,cellPx:n,anisotropy:r,tierScale:1}}function br(e,t){if(!t.enabled||t.coarse||t.tier!=="high")return pr(e,t);let n=Number.isFinite(t.gpuMaxAnisotropy)&&t.gpuMaxAnisotropy>=1?t.gpuMaxAnisotropy:1,r=Number(t.cellPx),o=Number.isInteger(r)&&r>256&&r<=512&&r%32===0?r:256,s=Number(t.facadeAnisotropy),a=e==="facadeCells"?Number.isFinite(s)&&s>=1?Math.min(s,16):4:16;return{...ut,cellPx:o,anisotropy:Math.min(n,a),tierScale:o/256}}function gr(){try{let e=globalThis,t=Number(e.__canalRecallTexAniso??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texAniso"):null)??NaN);return Number.isFinite(t)&&t>=1?t:null}catch{return null}}function yr(){try{let e=globalThis,t=e.__canalRecallTexturePolicy??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texturePolicy"):null);return!(t===!1||t==="0"||t==="false"||t==="off")}catch{return!0}}function xr(){try{let e=globalThis,t=Number(e.__canalRecallCellPx??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("cellPx"):null)??NaN);return Number.isFinite(t)&&t>0?t:null}catch{return null}}function Mr(){let e=globalThis.__canalPerf?.tier;return e==="low"||e==="mid"||e==="high"?e:null}function wr(){return!!globalThis.matchMedia?.("(pointer: coarse)").matches}function de(e,t){return br(e,{tier:Mr(),coarse:wr(),gpuMaxAnisotropy:t,enabled:yr(),cellPx:xr(),facadeAnisotropy:gr()})}var F={other:0,wall:1,roof:2,lid:3,trim:4,cornice:5,frontage:6,extrasStrip:7,extrasBox:8,extrasOther:9,shell:10},Rr=[{name:"other",id:F.other,rgb:[0,0,0]},{name:"wall",id:F.wall,rgb:[255,255,255]},{name:"roof",id:F.roof,rgb:[255,0,0]},{name:"lid",id:F.lid,rgb:[128,0,128]},{name:"trim-decal",id:F.trim,rgb:[0,255,0]},{name:"cornice",id:F.cornice,rgb:[0,0,255]},{name:"frontage",id:F.frontage,rgb:[255,255,0]},{name:"extras-strip",id:F.extrasStrip,rgb:[255,0,255]},{name:"extras-box",id:F.extrasBox,rgb:[0,255,255]},{name:"extras-other",id:F.extrasOther,rgb:[128,128,0]},{name:"shell",id:F.shell,rgb:[0,128,128]}],ct=1,_r=2,Sr=4e-6;var vr=(e,t)=>e*t/2;function dt(e){try{return typeof URLSearchParams=="function"?new URLSearchParams(globalThis.location?.search??"").get(e):null}catch{return null}}function Lr(){let t=globalThis.__canalRecallThinFade??dt("thinFade");return!(t===!1||t==="0"||t==="false"||t==="off")}function Ar(){return(globalThis.__canalRecallThinDebug??dt("thinDebug"))==="owner"?"owner":null}var re=e=>Number.isInteger(e)?e.toFixed(1):String(e),Tr=e=>`vec3(${e.map(t=>(t/255).toFixed(4)).join(", ")})`,kr=`
attribute vec2 thin;
varying float vThinM;
flat varying float vThinClass;
`,Fr=`
vThinM = thin.x * 0.01; vThinClass = thin.y;
#ifdef CITY_THIN_FADE
if (thin.y > ${re(F.trim-.5)} && thin.y < ${re(F.trim+.5)}) gl_Position.z -= ${Sr.toExponential()} * gl_Position.w;
#endif
`,Cr=`
uniform float thinFocalPx;
varying float vThinM;
flat varying float vThinClass;
vec3 thinOwnerColour(float c) {
${Rr.map(e=>`  if (c < ${re(e.id+.5)}) return ${Tr(e.rgb)};`).join(`
`)}
  return vec3(0.5);
}
`,Er=`
#ifdef CITY_THIN_FADE
if (vThinM > 0.0) {
  float thinPx = vThinM * thinFocalPx / max(vFacDist, 0.01);
  float thinCover = clamp((thinPx - ${re(ct)}) / ${re(_r-ct)}, 0.0, 1.0);
  if (thinCover < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= thinCover) discard;
}
#endif
`,mt=`
#ifdef CITY_THIN_OWNER
gl_FragColor = vec4(thinOwnerColour(vThinClass), 1.0);
#endif
`,Ie={value:1e3};function ft(e,t,n){let r="void main() {",o=/vFacDist = length\([^;]*\);/,s="if (HL_GHOST(vHighlight)) discard;";if(!e.includes(r)||!o.test(e)||!t.includes(r)||!t.includes(s))return null;let a=e.replace(r,`${kr}${r}`).replace(o,u=>`${u}${Fr}`),i=t.replace(r,`${Cr}${r}`).replace(s,`${s}${Er}`);if(n){if(!i.includes("#include <dithering_fragment>"))return null;i=i.replace("#include <dithering_fragment>",`#include <dithering_fragment>${mt}`)}else{let u=i.lastIndexOf("}");i=`${i.slice(0,u)}${mt}${i.slice(u)}`}return{vertex:a,fragment:i}}function ht(e,t,n={}){let r=n.fade??Lr(),o=n.debug===void 0?Ar():n.debug;if(!r&&!o)return e;if(e.defines={...e.defines??{},...r?{CITY_THIN_FADE:""}:{},...o?{CITY_THIN_OWNER:""}:{}},e.defaultAttributeValues={...e.defaultAttributeValues??{},thin:[0,0]},t){let i=e.onBeforeCompile;e.onBeforeCompile=function(u,l){i?.call(this,u,l);let m=ft(u.vertexShader,u.fragmentShader,!0);m&&(u.vertexShader=m.vertex,u.fragmentShader=m.fragment,u.uniforms.thinFocalPx=Ie)}}else{let i=ft(e.vertexShader,e.fragmentShader,!1);if(!i)return e;e.vertexShader=i.vertex,e.fragmentShader=i.fragment,e.uniforms={...e.uniforms,thinFocalPx:Ie}}let s=e.onBeforeRender,a={x:0,y:0,set(i,u){return this.x=i,this.y=u,this},floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}};return e.onBeforeRender=function(i,u,l,...m){s?.call(this,i,u,l,...m);let f=i?.getDrawingBufferSize?i.getDrawingBufferSize(a).y:0,c=l?.projectionMatrix?.elements?.[5];f>0&&Number.isFinite(c)&&(Ie.value=vr(c,f))},e.userData={...e.userData??{},thinFade:r,thinDebug:o},e}var pt=e=>{let t=globalThis,n=new RegExp(`[?&]${e}=([^&]*)`).exec(t.location?.search??"");return n?decodeURIComponent(n[1]):null};function De(){let t=globalThis.__canalRecallDrawLimit??pt("drawLimit");return t===!0||t==="1"||t==="true"||t==="on"?!0:!(t===!1||t==="0"||t==="false"||t==="off")}var Or=e=>Number.isInteger(e)?`${e}.0`:`${e}`,bt=`(fogNear * (1.0 + fract(fogFar) * ${Or(8)}))`;var Ir=!0;function gt(){if(!De())return!1;let e=globalThis.__canalRecallLandmarkHaze??pt("landmarkHaze");return e===!0||e==="1"||e==="true"||e==="on"?!0:e===!1||e==="0"||e==="false"||e==="off"?!1:Ir}var yt="DEPTH_FADE_LIMIT_ONLY";var Dr=.5,Pr=.38,xt=250,Nr=600,Br=.4;function Mt(){let e=globalThis,t=typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("fadeStrength"):null,n=e.__canalRecallFadeStrength??t,r=n==null||n===""?NaN:Number(n);return Number.isFinite(r)?Math.max(0,Math.min(2,r)):1}var U=e=>Number.isInteger(e)?`${e}.0`:`${e}`;var Hr=(e=Mt())=>`#ifdef USE_FOG
	float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	float fadeLuma = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( fadeLuma ), fogFactor * ${U(Dr*e)} );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * ${U(Pr*e)} );
#endif`,qs=Hr(1),wt=`uniform vec3 fogColor;
	varying vec3 vFogEye;
	#define vFogDepth length( vFogEye )
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif`,Ys=`#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
	${wt}
#endif`,Rt=`
#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
#define DEPTH_FADE_FOG_PARS
	${wt}
#endif
`,_t=(e,t=Mt(),n=De())=>{let r=n?bt:"fogFar";return`${U(Math.min(1,t))} * smoothstep(max(${U(xt)}, fogNear), max(max(${U(Nr)}, fogNear + (${r} - fogNear) * ${U(Br)}), max(${U(xt)}, fogNear) + 1.0), ${e})`};var Gr="canalRecallDepthFadeOptOut";function St(e,t=gt()){t&&e.fog!==!1?e.defines={...e.defines??{},[yt]:""}:e.fog=!1,e.userData={...e.userData??{},[Gr]:!0}}var Pe={wallPull:.7,glassLift:.5,liftBrick:!0},vt={wallPull:.35,glassLift:.25,liftBrick:!1},Xs={photo:{cells:"photo",shadeBands:0,flatColour:!1,...Pe,cartoonRoofCells:!1,outline:!1,litWallGain:255/225},procedural:{cells:"procedural",shadeBands:0,flatColour:!1,...Pe,cartoonRoofCells:!1,outline:!1,litWallGain:1},untextured:{cells:"procedural",shadeBands:0,flatColour:!0,...Pe,cartoonRoofCells:!1,outline:!1,litWallGain:1},storybook:{cells:"storybook",shadeBands:0,flatColour:!1,...vt,cartoonRoofCells:!1,outline:!0,litWallGain:1,tone:{hueShift:-4,satMul:1.15,satAdd:0,keepDarkBelow:0,lightMul:1,lightAdd:.03,lightMax:.9}},cartoon:{cells:"cartoon",shadeBands:3,flatColour:!1,...vt,cartoonRoofCells:!0,outline:!0,litWallGain:1,tone:{hueShift:0,satMul:1.7,satAdd:.08,keepDarkBelow:.35,lightMul:1.08,lightAdd:0,lightMax:.85}}};var W=(e,t,n)=>Math.max(t,Math.min(n,e));function M(e){let t=/^#?([0-9a-f]{6})$/i.exec(e.trim());if(!t)throw Error(`Bad colour ${e}`);let n=parseInt(t[1],16);return[n>>16&255,n>>8&255,n&255]}var w=e=>"#"+e.map(t=>Math.round(W(t,0,255)).toString(16).padStart(2,"0")).join("");function v([e,t,n]){let r=e/255,o=t/255,s=n/255,a=Math.max(r,o,s),i=Math.min(r,o,s),u=(a+i)/2;if(a===i)return[0,0,u];let l=a-i,m=u>.5?l/(2-a-i):l/(a+i);return[(a===r?(o-s)/l+(o<s?6:0):a===o?(s-r)/l+2:(r-o)/l+4)*60,m,u]}function T([e,t,n]){let r=(1-Math.abs(2*n-1))*t,o=r*(1-Math.abs(e/60%2-1)),s=n-r/2,[a,i,u]=e<60?[r,o,0]:e<120?[o,r,0]:e<180?[0,r,o]:e<240?[0,o,r]:e<300?[o,0,r]:[r,0,o];return[(a+s)*255,(i+s)*255,(u+s)*255]}var At=(e,t,n)=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n];var Be={canal:-1/0,c19:1860,school:1915,modern:1945};var Ne=["#76808f","#606b79","#8c939c"],se={procedural:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:Ne},untextured:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:Ne},photo:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:Ne},storybook:{tile:["#b9553a","#a94a33","#c46a45"],slate:["#556070","#4a5666","#657282"]},cartoon:{tile:["#e85a3c","#f08a2b","#d94a3a"],slate:["#3f5f8f","#2f4a78","#4f7bb0"]}};var oe={gravel:{hex:"#9e9281",luma:[112,156],cell:"flat"},"bitumen-dark":{hex:"#56585e",luma:[62,96],cell:"flat"},"bitumen-light":{hex:"#a99b84",luma:[150,182],cell:"flat"},"white-membrane":{hex:"#d9d9d3",luma:[196,228],cell:"flat"},"pantile-red":{hex:"#b5543a",luma:[84,124],cell:"tile"},"pantile-dark":{hex:"#6a5248",luma:[64,98],cell:"tile"},slate:{hex:"#76808f",luma:[62,140],cell:"slate"},zinc:{hex:"#9aa1a6",luma:[138,176],cell:"slate"},sedum:{hex:"#7a8350",luma:[96,132],cell:"flat"},solar:{hex:"#2e3a52",luma:[44,70],cell:"flat"},terrace:{hex:"#a38d74",luma:[124,162],cell:"flat"},glass:{hex:"#8fa3ad",luma:[130,170],cell:"flat"}},he={gravel:oe.gravel.hex,membrane:oe["white-membrane"].hex,bitumen:oe["bitumen-dark"].hex,pebble:oe["bitumen-light"].hex},Tt=[he.gravel,he.membrane,he.bitumen,he.pebble];var I={tile:se.photo.tile,slate:se.photo.slate,flat:Tt};var ae={photo:{canal:["#7a3b2c","#7a3b2c","#6b3428","#8c4632","#9a5846","#b05a40","#4a2e26","#2e2a27","#3e4a40","#5d605a","#e4ddcd"],c19:["#b05a40","#b05a40","#bd6a45","#a24d38","#c58b5e","#d3b184","#e2d5ba","#e2d5ba","#d9c5a4","#9a5846"],school:["#8c4a38","#7a4535","#9a5240","#6e3d33","#a85a3c","#5e3a32","#b0603f"],modern:["#c9b79a","#b9ad9a","#a8a49c","#d3c6ad","#8f8a82","#bfb3a0","#9c7a62","#b05a40"]},storybook:{canal:["#b9583f","#9a4a38","#7a4a3c","#4a5048","#3f4a5a","#ead9b0","#c8664a"],c19:["#c8664a","#d98b5f","#e0b36a","#ead9b0","#d9b995","#c9a08c","#c8664a"],school:["#a8553f","#9a5a48","#b87a5c","#c8664a","#8a4e40"],modern:null},cartoon:{canal:["#d9453d","#a8433a","#3b3b4a","#2a9d8f","#4672b0","#fffaf0","#e8573d"],c19:["#e8573d","#ee7f2c","#f2b92e","#f3e6c8","#d96a4d","#f2b92e"],school:["#d96a4d","#e8573d","#b9583f","#ee7f2c"],modern:null}};var Ur={canal:{label:"canal-house centre (before 1860)",wall:ae.photo.canal[0],roof:se.photo.tile[0]},c19:{label:"19th-century ring (1860-1914)",wall:ae.photo.c19[0],roof:se.photo.tile[1]},school:{label:"Amsterdamse School (1915-1944)",wall:ae.photo.school[0],roof:se.photo.slate[0]},modern:{label:"post-war and contemporary (1945+)",wall:ae.photo.modern[0],roof:Tt[0]}};var kt=["brick","stucco","accent","stone","frame","door","glass","roofTile","slate","bitumen","paint"],Ft={brick:"brick",accent:"brick",stucco:"stucco",stone:"stone",frame:"frame",door:"door",glass:"glass",roofTile:"tile",slate:"slate",bitumen:"flat",paint:"frame"},E={brick:3.36,stucco:2.4,accent:3.36,stone:1.28,frame:1,door:1,glass:1,roofTile:1.2,slate:1.2,bitumen:1.2,paint:1},N=[.3,.6],Wr="#f1ede2",$r="#cfc8b8";function Vr(e){let[t,n,r]=v(M(e)),o=W(.12+r*.9,N[0],N[1]);return w(T([t,W(n,.12,.5),o]))}function zr(e){let[t,n,r]=v(M(e));return w(T([t,W(n,0,.55),W(r*1.06+.03,.4,.97)]))}function jr(e){let t=M(e),[n,r,o]=v(t);return o>=.5?w(At(t,M(Wr),.75)):w(T([n,r,Math.max(o,.16)]))}function qr(e){let[t,n,r]=v(M(e));return w(At(T([t,n,Math.max(r,.62)]),M($r),.45))}function Yr(e){let[t,n,r]=v(M(e));return r>=.17?e.startsWith("#")?e.toLowerCase():"#"+e.toLowerCase():w(T([t,n<.15?0:n,.17]))}function Kr(e,t){let n=v(M(t))[2];if(e==="roofTile"){let[r,o]=v(M(t));return o<.2?I.slate[1]:w(T([r,W(o*1.1,.35,.6),W(.2+n*.85,.38,.5)]))}return e==="slate"?n<.27?I.slate[1]:n<.31?I.slate[0]:I.slate[2]:n<.4?I.flat[2]:I.flat[0]}var j="measured",Xr=.18,Jr=225/255;function Zr(e){let[t,n,r]=v(M(e)),[o,s,a]=M(w(T([t,n,Math.max(r,Xr)])));return w([o,s,a].map(i=>Math.min(255,Math.round(i/Jr))))}var $=32,V=64,P=[157.19,92.83,69.17],Ct=240.95,Et=.16,Qr=255/(P[0]+(Ct-P[0])*Et);function He(e,t){let n=t/(V-1),r=n<.5?P[0]+(P[1]-P[0])*(n/.5):P[1]+(P[2]-P[1])*((n-.5)/.5),o=5-15*t/35,s=17-15*t/35,a=t<35&&e+.5>=o&&e+.5<s;return Math.min(255,Math.round((a?r+(Ct-r)*Et:r)*Qr))}var eo=(()=>{let e=0;for(let t=0;t<V;t++)for(let n=0;n<$;n++)e+=He(n,t);return e/($*V)})(),Lt=.4;function to(e){let[t,n,r]=v(M(e)),s=(r>=Lt?M(e):T([t,n,Lt])).map(i=>i/(eo/255)),a=Math.max(1,...s.map(i=>i/255));return w(s.map(i=>Math.min(255,Math.round(i/a))))}var no=228/255;function ro(e){return w(M(e).map(t=>Math.min(255,Math.round(t/no))))}function oo(e){return w(M(e))}function ao(e){return w(M(e))}var so=["brick","accent","glass","stone","bitumen","slate","roofTile"],Ot=(e,t)=>t===j&&so.includes(e);function pe(e,t,n){if(n===j&&(e==="brick"||e==="accent"))return Zr(t);if(n===j&&e==="glass")return to(t);if(n===j&&e==="stone")return ro(t);if(n===j&&e==="bitumen")return oo(t);if(n===j&&(e==="slate"||e==="roofTile"))return ao(t);switch(e){case"brick":case"accent":return Vr(t);case"stucco":return zr(t);case"stone":return qr(t);case"frame":return jr(t);case"door":return Yr(t);case"glass":return"#ffffff";case"paint":return t.startsWith("#")?t.toLowerCase():"#"+t.toLowerCase();default:return Kr(e,t)}}var Ge={asphalt:{base:[86,88,93]},cycle:{base:[150,66,58]},klinker:{base:[122,90,80],joint:"#4b3d38"},pavement:{base:[174,162,152],joint:"#7f756b"},kerb:"#cfcac0",paint:"#f2f0ea",rail:"#6c6e72",bollard:"#5a2a26"},It="#ffd21f",Dt="#ff8033",Pt="#b4682c";var Nt={land:{base:[168,158,142],joint:"#857b6d"},paving:{base:[184,174,158],joint:"#8f8577"},square:{base:[190,179,161],joint:"#958a7c"},klinker:{base:[158,124,114],joint:"#7a6660"},asphalt:[68,72,80],cycle:[156,76,66],gravel:[180,166,136],park:[96,140,70],wood:[70,112,58],parking:[102,102,105],kerb:"#aaa498",water:"#46707c",lawn:[110,154,74],bed:{soil:[98,80,60],leaf:[84,122,58]},shrub:{base:[56,92,46],leaf:[76,116,56]},bark:[118,84,58],sand:[212,194,150],parkGravel:[198,184,152],parkPath:[110,110,112],pond:"#46707c"};var Bt="inferred",io=e=>v(M(e))[1]<.2,lo=e=>{let[t,n,r]=v(M(e));return(t<45||t>340)&&n>=.15&&r<.7},uo=e=>io(e)?"slate":"roofTile",Ue=e=>lo(e)?"brick":"stucco",co=[{test:/glass|glaz|window|vitr|ruit|pane/,slot:"glass",confidence:"name",rule:"glazing name"},{test:/decal|sign|mural|logo|letter|clock|dial/,slot:"paint",confidence:"name",rule:"signage / decal"},{test:/door|deur|gate/,slot:"door",confidence:"name",rule:"door name"},{test:/frame|kozijn|louvre|louver|blind|shutter|rail|mullion|sash/,slot:"frame",confidence:"name",rule:"joinery name"},{test:/brick|baksteen|klinker|terracotta/,slot:"brick",confidence:"name",rule:"brick name"},{test:/slate|leien|lei$/,slot:"slate",confidence:"name",rule:"slate name"},{test:/bitumen|asphalt|tar$|felt|flatroof|flat-roof|gravel/,slot:"bitumen",confidence:"name",rule:"flat roof name"},{test:/roof|tile|pantile|dakpan|dak/,slot:uo,confidence:"name",rule:"roof name, grey \u2192 slate, else pantile"},{test:/sandstone|stone|steen|column|marble|granite|limestone|plinth/,slot:"stone",confidence:"name",rule:"stone name"},{test:/stucco|render|plaster|pleister|concrete|beton|slab/,slot:"stucco",confidence:"name",rule:"render / concrete name"},{test:/gold|gilt|bronze|copper|brass|zinc|metal|steel|iron|lead|alu/,slot:"paint",confidence:"name",rule:"metal name (flat colour)"},{test:/wall|facade|gevel/,slot:Ue,confidence:"name",rule:"wall name, brick hue \u2192 brick, else stucco"},{test:/ochre|yellow|buff/,slot:Ue,confidence:"colour-word",rule:"ochre: yellow brick (brick hue) or render"},{test:/pink|rose/,slot:"stucco",confidence:"colour-word",rule:"pink: painted render"},{test:/moss|grass|green|blue|orange|purple|paint|teal/,slot:"paint",confidence:"colour-word",rule:"coloured paint word"},{test:/white|cream|ivory/,slot:"stucco",confidence:"colour-word",rule:"white: stucco (could be white trim)"},{test:/dark|black|charcoal|anthracite/,slot:"frame",confidence:"colour-word",rule:"dark: painted joinery / ironwork (could be a dark wall)"},{test:/red/,slot:Ue,confidence:"colour-word",rule:"red: brick hue \u2192 brick (could be red tile or paint)"},{test:/grey|gray/,slot:"stucco",confidence:"colour-word",rule:"grey: render (could be concrete or zinc)"}];function Ht(e){return String(e??"").toLowerCase().replace(/[-_.\s]*\d+$/,"").trim()}function mo(e){let[t,n,r]=v(M(e));return r<.22?{slot:"frame",rule:"very dark: joinery / ironwork"}:n>=.15&&(t<45||t>340)&&r<.62?{slot:"brick",rule:"brick hue"}:n<.2&&r>=.6?{slot:"stucco",rule:"pale neutral: render"}:n<.2&&r>=.22&&t>180&&t<260?{slot:"slate",rule:"blue-grey: slate"}:n<.25?{slot:"stone",rule:"neutral mid-tone: stone"}:{slot:"paint",rule:"saturated colour: paint"}}function Gt(e,t){let n=t.toLowerCase(),r=Ht(e);for(let s of co)if(s.test.test(r))return{slot:typeof s.slot=="function"?s.slot(n):s.slot,tint:n,confidence:s.confidence,rule:s.rule};let o=mo(n);return{slot:o.slot,tint:n,confidence:"colour",rule:`no material word in "${r||"unnamed"}"; ${o.rule}`}}var Ut=e=>/white|cream|ivory/.test(Ht(e)),Wt=e=>typeof e=="string"&&kt.includes(e);var zt={ribs:{pitch:.5,min:.25,max:2,w:.09,out:.04},boards:{pitch:.4,min:.15,max:1.5,w:.05,out:.035},louvres:{pitch:.35,min:.2,max:1,w:.12,out:.12},panels:{pitch:1.2,min:.6,max:6,w:.05,out:.035}};var Oi={min:.15,max:zt.ribs.max};var jt={canal:["#6e5352","#8c7768","#977f73","#a79276","#b8a17a","#575245","#60564b","#62544d","#61584c","#655850","#655b50","#6a5454","#6f6058","#726359","#726459","#76615d","#77685d","#7a6c60","#826c66","#918174","#9a887f","#a89f8a","#6b6163","#dfdcd2"],c19:["#70564f","#6f5b52","#7a665c","#86695b","#886a5f","#857266","#8b746d","#9b887e","#a38e83","#ad9585","#61534a","#63564e","#685b52","#6f6057","#716259","#75665c","#7b6961","#7c6962","#7f6a64","#7f7664","#8e796f","#9c9181","#95787e","#dad8cf"],school:["#665247","#775744","#735d52","#786158","#8c5957","#896559","#856f63","#9d7f6d","#ad997f","#5c4f48","#61564c","#67564e","#6b5554","#6b5851","#6b5b50","#716057","#745e5b","#75655c","#78665f","#806d64","#89706b","#a19888","#614a4e","#a4a09f"],modern:["#715d53","#7c6459","#816b64","#8f7265","#9c8980","#ac9a86","#60594c","#635c4e","#6a5a50","#6c5a54","#6c5e55","#6e6256","#72675a","#776a5d","#7b6a61","#7f6f64","#807265","#886f6b","#8b7d6d","#958b79","#a29189","#695256","#a59b8d","#c8c5ba"]};var We={"#4f4834":[215,215,215],"#463823":[216,215,215],"#5f5950":[215,215,215],"#a69873":[215,215,215],"#57423e":[215,215,215],"#473c3b":[215,215,215],"#5d5d5c":[214,215,215],"#7e573b":[215,215,215],"#705449":[215,215,215],"#7f8283":[215,214,215],"#796764":[215,215,215],"#5d534b":[215,215,215],"#7d6e52":[215,215,215],"#88735e":[215,215,215],"#88715f":[215,215,215],"#736352":[215,215,215],"#241d1c":[172,172,172],"#4b3f37":[215,215,215],"#615551":[215,215,215],"#595651":[214,215,214],"#423931":[215,215,215],"#7b6d6a":[215,214,216],"#382418":[215,215,215],"#866343":[215,215,215],"#6e6256":[215,215,215],"#625650":[205,205,205],"#252c24":[185,185,186],"#2d281b":[215,214,215],"#3b342b":[215,215,215],"#6f5c56":[215,215,215],"#393535":[215,215,215],"#786357":[215,215,215],"#383d43":[205,215,215],"#554e4a":[215,216,215],"#3d3432":[215,215,215],"#3d353c":[215,215,215],"#4e443f":[215,215,215],"#70574d":[207,207,207],"#d49662":[215,215,215],"#917b5c":[215,215,215],"#494341":[215,215,215],"#645f5f":[215,215,214],"#342a18":[215,215,215],"#825746":[215,216,215],"#99604e":[212,215,215],"#706868":[215,215,215],"#786b61":[215,215,214],"#5c5b57":[215,215,215],"#7a655b":[215,215,215],"#6f5b54":[215,215,215],"#4a3f3a":[215,214,215],"#614f44":[216,215,215],"#654e44":[215,215,215],"#6f5f53":[215,215,216],"#584d49":[215,215,215],"#d3c9b2":[215,215,215],"#544b46":[215,215,215],"#929289":[215,215,215],"#68584f":[215,215,216],"#574d47":[215,215,215],"#5e4e41":[215,215,215],"#6e605a":[215,215,215],"#605d5c":[215,215,215],"#8c7a6f":[215,215,215],"#4a3832":[165,165,166],"#81614f":[215,215,215],"#3d3533":[215,215,215],"#6d5351":[215,215,215],"#5c3d33":[214,214,215],"#906553":[215,215,215],"#65493d":[215,215,215],"#8e5f49":[215,215,215],"#8c6858":[215,215,215],"#8b5946":[215,215,215],"#665253":[209,209,209],"#3e3222":[215,215,215],"#000000":[197,198,197],"#7b081b":[215,215,215],"#383131":[215,215,215],"#3d3b37":[211,215,215],"#877d76":[214,215,215],"#191d0c":[215,214,213],"#bcab88":[215,215,215],"#656462":[215,215,215],"#3f3634":[174,174,175],"#463e3c":[197,197,198],"#453d3a":[177,177,176],"#1f1a1b":[156,156,157],"#615450":[214,215,215],"#5b4f4b":[215,215,215],"#574c4a":[215,215,215],"#413333":[215,215,215],"#7b5c53":[215,215,215],"#5f342b":[216,215,215],"#4e2422":[215,215,215],"#5b4b44":[209,209,209],"#493d32":[215,215,215],"#6a5048":[216,216,215],"#5e5855":[215,215,215],"#5e3f35":[215,215,215],"#68564f":[215,215,215],"#6b3e33":[215,214,215],"#5f3c30":[215,214,215],"#929191":[215,215,215],"#a2acb3":[215,215,215],"#8f7b65":[215,215,215],"#988e7d":[215,215,215],"#726d60":[215,215,215],"#584c45":[215,214,215],"#594643":[216,215,215],"#5e5750":[212,215,215],"#78645b":[215,215,215],"#484440":[215,215,215],"#73645e":[215,215,215],"#5c4f47":[215,215,215],"#3c3d39":[215,215,215],"#645451":[215,215,214],"#37333d":[179,179,178],"#a6856f":[215,215,215],"#574d4d":[205,205,205],"#393737":[215,215,215],"#6f4a3b":[215,214,215],"#ffa169":[212,215,215],"#576465":[216,215,216],"#71614a":[215,215,215],"#6c584f":[215,215,215],"#5b463e":[215,216,215],"#765e52":[214,215,215],"#4f4e4c":[215,215,215],"#544945":[215,215,215],"#504140":[194,195,194],"#51514f":[215,215,215],"#74665f":[215,215,215],"#735c59":[215,215,215],"#474d56":[215,215,215],"#7d6e5a":[215,215,215],"#514a43":[215,215,215],"#4e4e49":[215,215,215],"#745c51":[215,215,215],"#47403c":[215,215,215],"#4c3a37":[215,215,215],"#675d5a":[215,215,215],"#574e48":[215,215,215],"#686360":[215,215,215],"#4a413f":[215,215,215],"#423735":[215,215,215],"#756860":[215,215,215],"#5e5144":[215,215,215]};var El={street:{...Ge,brick:Ge.klinker},tones:Nt};var wo=["sunny","legacy"],Ro="sunny";function B(e){let t=globalThis,r=/[?&]look=([\w-]+)/.exec(e??t.location?.search??"")?.[1]??t.__canalRecallLook;return wo.includes(r??"")?r:Ro}var K=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},_o=e=>255*(e<=.0031308?e*12.92:1.055*e**(1/2.4)-.055),z=e=>{let t=parseInt(e.replace("#",""),16);return[t>>16&255,t>>8&255,t&255]},$e=e=>"#"+e.map(t=>Math.round(Math.max(0,Math.min(255,t))).toString(16).padStart(2,"0")).join(""),So=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],Y=e=>So(z(e).map(K)),vo=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],Lo={zenith:"#9ec3ed",horizon:"#a1c6e5"};function Ao(e){let t=e.sunElevationDeg*Math.PI/180,n=Y(e.sunColour)*e.sunIntensity/Math.PI,r=Y(e.skyColour)*e.skyIntensity/Math.PI,o=Y(e.groundColour)*e.skyIntensity/Math.PI,s=(r+o)/2;return{flat:n*Math.sin(t)+r,sunWall:n*Math.cos(t)+s,shadeWall:s}}var To=.55;function ko(e="#ffe2bf",t="#aca497",n=To){let r=40*Math.PI/180,o=u=>{let l=$e(z(Lo.horizon).map(d=>d+(255-d)*u)),m=Y(e)*2.15/Math.PI*Math.cos(r),f=(Y(l)+Y(t))/2/Math.PI,c=n*m/(1-n)/f;return{sunColour:e,sunIntensity:2.15,skyColour:l,groundColour:t,skyIntensity:c,sunElevationDeg:40}},s=u=>{let l=o(u),m=z(l.sunColour).map(K),f=z(l.skyColour).map(K),c=[0,2].map(d=>m[d]*l.sunIntensity*Math.sin(r)+f[d]*l.skyIntensity);return c[0]/c[1]},a=0,i=1;for(let u=0;u<40;u++){let l=(a+i)/2;s(l)<1?a=l:i=l}return{...o(i),whiteMix:+i.toFixed(3)}}var q=ko(),qt=1/Ao(q).sunWall,Xt={sunColour:q.sunColour,sunIntensity:+(q.sunIntensity*qt).toFixed(4),skyColour:q.skyColour,groundColour:q.groundColour,skyIntensity:+(q.skyIntensity*qt).toFixed(4)},Yt=[.85,1.6],Fo=e=>typeof e=="string"?z(e):e;function Ve(e){let t=e?K(219)/K(vo(Fo(e))):1.106;return Math.max(Yt[0],Math.min(Yt[1],t))}function X(e,t){let n=z(e).map(o=>K(o)*t),r=Math.max(1,...n);return $e(n.map(o=>_o(o/r)))}function Kt(e,t=We[e.toLowerCase()]){return X(e,Ve(t))}function Jt(e,t,n,r=B(),o){return r!=="sunny"||n!=="measured"||e!=="brick"&&e!=="accent"?t:o?Kt(t,o):Kt(t)}var Bl=(()=>{let e=Object.keys(We).map(z),t=n=>n.slice().sort((r,o)=>r-o)[n.length>>1];return $e([0,1,2].map(n=>t(e.map(r=>r[n]))))})();var Eo=2,Oo=.62;function Io(e,t=Eo){let n=X(e,t);if(v(M(e))[2]>=Oo)return n;let[r,o,s]=v(M(n));return s<=N[1]?n:w(T([r,o,N[1]]))}var Do=e=>Object.fromEntries(Object.entries(e).map(([t,n])=>[t,n?n.map(r=>Io(r)):null])),ql=Do(jt);var Po={anonymous:"This building has no name or date in the map data.",named:"The map data has no date for this building.",place:"A mapped place; the map data has no date for its building."},Ql=new Set(Object.values(Po));var Zt=["canal","c19","school","postwar","modern","tower"];var Ho=8;var vu=16+Math.log2(Ho);var R=256,Go=["upper","ground","door","plain","shop"],Uo=2;var ku=Zt.length*Uo*Go.length;var C=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16));var Fu=C("#7d93a0"),Cu=C("#1f2a33");var Eu=C("#b8ad98"),Ou=C("#cfc6b4"),Iu=C("#ece8dd"),Du=C("#e2d9c2"),Pu=[C("#2c4a3d"),C("#3a2a22"),C("#1f3b57"),C("#5a2a24")],Nu=[C("#2f4a3a"),C("#7a2f27"),C("#27384f")];var Qt=.6;function ge(e,t,n){let r=Math.imul(e|0,374761393)^Math.imul(t|0,668265263)^Math.imul(n|0,2246822519);return r=Math.imul(r^r>>>13,1274126177),((r^r>>>16)>>>0)/4294967296}function en(e,t){let n=0;for(let o=0;o<e.length;o+=4)n+=e[o];let r=n/(e.length/4);for(let o=0;o<e.length;o+=4){let s=Math.round(Math.max(0,Math.min(255,r+(e[o]-r)*t)));e[o]=e[o+1]=e[o+2]=s}}function tn(e,t){let n=new Uint8ClampedArray(R*R*4),r=(o,s,a,i,u)=>{let l=(s*R+o)*4,m=u??[a,a,a];n[l]=m[0],n[l+1]=m[1],n[l+2]=m[2],n[l+3]=i};if(e==="flat")for(let o=0;o<R;o++)for(let s=0;s<R;s++)r(s,o,Math.round((t?.96:.9+(ge(s>>3,o>>3,3)-.5)*.08)*255),255);else if(e==="tile"){let a=R/8,i=R/5;for(let u=0;u<R;u++)for(let l=0;l<R;l++){let m=Math.floor(u/a),f=u%a/a,c=(l+m%2*i*.5)%R,d=Math.floor(c/i),h=c%i/i,p=Math.sin(h*Math.PI),y=t?.92:.7+.22*p-.28*Math.pow(Math.max(0,1-f*3.2),1.5)*0-.22*Math.max(0,(.18-f)/.18);t||(y+=(ge(d,m,7)-.5)*.14);let b=t?f<.07||h<.035||h>.965:!1;r(l,u,Math.round(Math.max(0,Math.min(1,b?.28:y))*255),255)}t||en(n,Qt)}else if(e==="slate"){let a=R/11,i=R/6;for(let u=0;u<R;u++)for(let l=0;l<R;l++){let m=Math.floor(u/a),f=u%a/a,c=(l+m%2*i*.5)%R,d=Math.floor(c/i),h=c%i/i,p=t?.9:.82+(ge(d,m,11)-.5)*.16-.16*Math.max(0,(.16-f)/.16);(h<(t?.05:.025)||f<(t?.09:.04))&&(p=t?.3:p*.7),r(l,u,Math.round(Math.max(0,Math.min(1,p))*255),255)}t||en(n,Qt)}else for(let u=0;u<R;u++)for(let l=0;l<R;l++){let m=l/R,f=u/R,c=m>.2-.06&&m<.8+.06&&f>.2-.06&&f<.82+.06,d=m>.2+.03&&m<.8-.03&&f>.2+.03&&f<.82-.03,h=Math.abs(m-.5)<.018||Math.abs(f-.5)<.018;if(d&&!h){let p=(f-.2)/.6199999999999999,y=t?[150+60*p,200+30*p,235]:[40+80*p*p,55+90*p*p,68+90*p*p];r(l,u,0,0,[y[0],y[1],y[2]])}else if(c)r(l,u,0,0,t?[255,250,240]:[236,232,221]);else{let p=t?.92:.85+(ge(l>>3,u>>3,5)-.5)*.12,y=t&&(l<5||u<5||l>R-6||u>R-6);r(l,u,Math.round((y?.3:p)*255),255)}}return n}function nn(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let m=0;m<336;m+=112)o.drawImage(t,m,l,112,112);else{let l=7,m=()=>(l=l*16807%2147483647)/2147483647;for(let f=0,c=0;c<336;c+=14,f++)for(let d=-(f%2)*24;d<336;d+=48){let h=150+m()*50;o.fillStyle=`rgb(${h},${h*.92},${h*.86})`,o.fillRect(d,c,48,14)}}o.strokeStyle="rgba(235,223,205,0.18)",o.lineWidth=1.7;for(let l=0,m=6;m<336;m+=14,l++){o.beginPath(),o.moveTo(0,m),o.lineTo(336,m),o.stroke();for(let f=l%2*24;f<336;f+=48)o.beginPath(),o.moveTo(f,m),o.lineTo(f,m+14),o.stroke()}let s=o.getImageData(0,0,336,336),a=s.data,i=0;for(let l=0;l<a.length;l+=4)i+=(a[l]+a[l+1]+a[l+2])/3;i/=a.length/4;let u=i>0?Math.min(2.4,225/i):1;for(let l=0;l<a.length;l+=4){let m=(a[l]+a[l+1]+a[l+2])/3,f=Math.min(255,(m+(i-m)*.7)*u);a[l]=a[l+1]=a[l+2]=f,a[l+3]=255}return o.putImageData(s,0,0),r}function rn(e){let t=e.createElement("canvas");t.width=64,t.height=128;let n=t.getContext("2d"),r=n.createLinearGradient(0,0,0,128);return r.addColorStop(0,"#8aa1b0"),r.addColorStop(.5,"#4d606c"),r.addColorStop(1,"#3c474e"),n.fillStyle=r,n.fillRect(0,0,64,128),n.fillStyle="rgba(235,242,248,0.16)",n.beginPath(),n.moveTo(10,0),n.lineTo(34,0),n.lineTo(4,70),n.lineTo(-20,70),n.closePath(),n.fill(),t}function on(e){let t=e.createElement("canvas");t.width=$,t.height=V;let n=t.getContext("2d"),r=n.createImageData($,V);for(let o=0;o<V;o++)for(let s=0;s<$;s++){let a=(o*$+s)*4,i=He(s,o);r.data[a]=r.data[a+1]=r.data[a+2]=i,r.data[a+3]=255}return n.putImageData(r,0,0),t}function an(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d");n.fillStyle="#ffffff",n.fillRect(0,0,128,128),n.fillStyle="rgba(0,0,0,0.10)";for(let r=0;r<128;r+=16)n.fillRect(r,0,1.5,128);return t}function sn(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=23,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++){let i=(s()-.5)*3;for(let u=0;u<128;u++){let l=(a*128+u)*4,m=s()<.012?-14:0,f=243+(s()-.5)*8+i+m;r.data[l]=r.data[l+1]=r.data[l+2]=f,r.data[l+3]=255}}return n.putImageData(r,0,0),t}function ln(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=11,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<r.data.length;a+=4){let i=228+(s()-.5)*16;r.data[a]=r.data[a+1]=r.data[a+2]=i,r.data[a+3]=255}return n.putImageData(r,0,0),n.fillStyle="rgba(80,70,60,0.18)",n.fillRect(0,0,128,1.5),t}function ye(e,t){let n=tn(t,!1),r=Math.round(Math.sqrt(n.length/4)),o=e.createElement("canvas");o.width=o.height=r;let s=o.getContext("2d"),a=s.createImageData(r,r);for(let i=0;i<n.length;i+=4)a.data[i]=n[i],a.data[i+1]=n[i+1],a.data[i+2]=n[i+2],a.data[i+3]=255;return s.putImageData(a,0,0),o}var Wo=238;function un(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let l=0;l<336;l+=112)for(let m=0;m<336;m+=112)o.drawImage(t,m,l,112,112);else{let l=13,m=()=>(l=l*16807%2147483647)/2147483647;for(let f=0,c=0;c<336;c+=14,f++)for(let d=-(f%2)*24;d<336;d+=48){let h=165+m()*30;o.fillStyle=`rgb(${h},${h*.93},${h*.88})`,o.fillRect(d,c,48,14)}}o.strokeStyle="rgba(245,240,230,0.26)",o.lineWidth=1.2;for(let l=0,m=6;m<336;m+=14,l++){o.beginPath(),o.moveTo(0,m),o.lineTo(336,m),o.stroke();for(let f=l%2*24;f<336;f+=48)o.beginPath(),o.moveTo(f,m),o.lineTo(f,m+14),o.stroke()}let s=o.getImageData(0,0,336,336),a=s.data,i=0;for(let l=0;l<a.length;l+=4)i+=(a[l]+a[l+1]+a[l+2])/3;i/=a.length/4;let u=i>0?Math.min(2.6,Wo/i):1;for(let l=0;l<a.length;l+=4){let m=(a[l]+a[l+1]+a[l+2])/3,f=Math.min(255,(m+(i-m)*.82)*u);a[l]=a[l+1]=a[l+2]=f,a[l+3]=255}return o.putImageData(s,0,0),r}function cn(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=31,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++)for(let i=0;i<128;i++){let u=(a*128+i)*4,l=246+(s()-.5)*3;r.data[u]=r.data[u+1]=r.data[u+2]=l,r.data[u+3]=255}return n.putImageData(r,0,0),t}function mn(e){let t=e.createElement("canvas");t.width=t.height=4;let n=t.getContext("2d");return n.fillStyle="#fff",n.fillRect(0,0,4,4),t}var Vo="highlight",zo="__canalRecallHighlight",jo="highlightAccent",qo="__canalRecallHighlightAccent",xe={yellow:{keepMaterials:!1,outline:!1,rim:!1,desaturate:!1,ring:!1,beacon:!1,wash:!1,animated:!1},a:{keepMaterials:!0,outline:!0,rim:!1,desaturate:!1,ring:!0,beacon:!0,wash:!0,animated:!1},b:{keepMaterials:!0,outline:!1,rim:!0,desaturate:!1,ring:!0,beacon:!1,wash:!1,animated:!0},c:{keepMaterials:!0,outline:!1,rim:!1,desaturate:!0,ring:!0,beacon:!1,wash:!1,animated:!1}};var Yo=60,H=.4,J=2,Ke=3.5,fn=100,Ko=300;var Xo=.75,ze=.35,Jo="__canalRecallHighlightBoost";function dn(){let e=Number(globalThis[Jo]);return Number.isFinite(e)?Math.min(1,Math.max(0,e)):0}var je="__canalRecallHighlightExtent";function yn(){let e=globalThis;return e[je]instanceof Map?e[je]:e[je]=new Map}var Zo=.3,Qo=2.4,ea=.9,ta=2.2,Me={drawn:0,hide:1,highlight:2,dim:3,ghost:4},na=.28;function hn(e){if(typeof e!="string")return null;let t=e.trim().toLowerCase();return t==="a"||t==="outline"?"a":t==="b"||t==="rim"?"b":t==="c"||t==="desaturate"?"c":t==="yellow"||t==="0"||t==="off"||t==="old"?"yellow":t==="default"?qe:null}var qe="a";function Q(e){try{let t=globalThis;if(e===void 0){let n=hn(t[zo]);if(n)return n}return hn(new URLSearchParams(e??t.location?.search??"").get(Vo))??qe}catch{return qe}}var xn=(e=Q())=>xe[e];function Mn(e=Q(),t){if(e==="yellow")return It;try{let n=globalThis,r=(t===void 0?n[qo]:void 0)??new URLSearchParams(t??n.location?.search??"").get(jo);if(r==="hud")return Pt;if(typeof r=="string"&&/^#?[0-9a-f]{6}$/i.test(r))return r.startsWith("#")?r:`#${r}`}catch{}return Dt}function Xe(e=Q()){return xe[e].keepMaterials?{HL_KEEP:""}:{}}var Je=`
#ifdef HL_KEEP
#define HL_PAINT(h) false
#else
#define HL_PAINT(h) ((h) > 0.5 && (h) < 1.5)
#endif
#define HL_GHOST(h) ((h) > 2.5 && fract(dot(floor(gl_FragCoord.xy), vec2(0.569840296, 0.754877666))) >= ${na.toFixed(3)})
float hlState(float hidden) { return hidden > 3.5 ? 3.0 : (hidden > 2.5 ? 2.0 : (hidden > 1.5 ? 1.0 : 0.0)); }
vec3 hlDesat(vec3 c, float h) { return h > 1.5 && h < 2.5 ? mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), ${H.toFixed(2)}) : c; }`,ra=110540,oa=e=>111320*Math.cos(e*Math.PI/180);function aa(e,t){let n=(e[1]+t[1])/2;return Math.hypot((e[0]-t[0])*oa(n),(e[1]-t[1])*ra)}var wn=(e,t,n=Yo)=>!!e&&aa(e,t)<=n;var pn=`
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
  float far = clamp((length(c4.xyz - hlEye) - ${fn.toFixed(1)}) / ${(Ko-fn).toFixed(1)}, 0.0, 1.0);
  float width = hlWidthPx * mix(1.0, hlFarScale, far);
  if (dot(dir, dir) > 1e-12) clip.xy += normalize(dir) * width * 2.0 / hlViewport * clip.w;
#endif
  gl_Position = clip;
}`,sa=`
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
  if (up < ${ze.toFixed(2)} || hlWash <= 0.0) discard;
  gl_FragColor = vec4(hlAccent, hlWash * smoothstep(${ze.toFixed(2)}, ${(ze+.15).toFixed(2)}, up));
#else
  vec3 n = hlHasNormal > 0.5 ? normalize(vHlNormal) : normalize(cross(dFdx(vHlPos), dFdy(vHlPos)));
  vec3 v = normalize(hlEye - vHlPos);
  float f = pow(1.0 - abs(dot(n, v)), ${ta.toFixed(2)});
  float pulse = 0.775 + 0.225 * sin(hlTime * 6.2831853 / ${Qo.toFixed(2)});
  gl_FragColor = vec4(hlAccent * f * ${ea.toFixed(2)} * pulse, 1.0);
#endif
}`,Z="canalRecallHighlightPass",ia="__canalRecallHighlightOutlinePx";function la(){let e=globalThis[ia],t=e==null||e===""?NaN:Number(e);return Number.isFinite(t)&&t>=0?t:null}var ua=(e,t)=>{let[n,r,o]=M(t);return new e.Vector3(n/255,r/255,o/255)};function ca(e,t,n={}){let r={};n.merged&&(r.HL_MERGED=""),t==="outline"&&(r.HL_OUTLINE=""),t==="roof"&&(r.HL_ROOF="");let o=pn;if(n.feature){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n.feature.attribute))throw new Error(`highlight: bad feature attribute ${n.feature.attribute}`);r.HL_FEATURE=n.feature.attribute,o=`attribute float ${n.feature.attribute};
uniform float hlFeatureId;
${pn}`}let s=new e.ShaderMaterial({defines:r,uniforms:{hlViewport:{value:new e.Vector2(1,1)},hlWidthPx:{value:J},hlFarScale:{value:Ke/J},hlCentre:{value:new e.Vector3},hlDepthPush:{value:Zo},hlAccent:{value:ua(e,n.accent??Mn())},hlEye:{value:new e.Vector3},hlTime:{value:0},hlHasNormal:{value:1},hlFeatureId:{value:n.feature?.id??0},hlUp:{value:new e.Vector3(0,0,1)},hlWash:{value:0}},vertexShader:o,fragmentShader:sa,side:t==="outline"?e.BackSide:e.FrontSide,transparent:!0,depthTest:!0,depthWrite:t==="outline",blending:t==="rim"?e.AdditiveBlending:e.NormalBlending,polygonOffset:t!=="outline",polygonOffsetFactor:-1,polygonOffsetUnits:t==="roof"?-4:-2});return s.name=`highlight/${t}${n.merged?"/merged":""}`,s.userData={[Z]:!0},s.defaultAttributeValues={hidden:[0],normal:[0,0,0]},s}function ma(e,t,n,r){let o=e.geometry?.boundingBox,s=t.elements;if(!o)return;let a=n.domElement,i=a?.clientWidth||r.x,u=a?.clientHeight||r.y,l=[],m=!1;for(let f=0;f<8;f++){let c=f&1?o.max.x:o.min.x,d=f&2?o.max.y:o.min.y,h=f&4?o.max.z:o.min.z,p=s[0]*c+s[4]*d+s[8]*h+s[12],y=s[1]*c+s[5]*d+s[9]*h+s[13],b=s[3]*c+s[7]*d+s[11]*h+s[15];if(!(b>1e-9)){m=!0;break}l.push((p/b+1)/2*i,(1-y/b)/2*u)}yn().set(e,{t:performance.now(),points:l,behind:m,width:i,height:u})}function we(e){for(let t of e?.userData?.[Z]??[])e.remove(t),pa(t.material),yn().delete(t);e?.userData&&delete e.userData[Z]}var fa=4,Ye=new Map,Rn=Symbol("highlightPassPool");function da(e,t){return`${e}|${t.merged?1:0}|${t.feature?.attribute??""}|${t.accent??""}`}function ha(e,t,n={}){let r=da(t,n),o=Ye.get(r)?.pop();if(o){let a=o.uniforms;return a.hlCentre.value.set(0,0,0),a.hlHasNormal.value=1,a.hlFeatureId.value=n.feature?.id??0,a.hlUp.value.set(0,0,1),a.hlWash.value=0,a.hlEye.value.set(0,0,0),a.hlTime.value=0,a.hlWidthPx.value=J,a.hlFarScale.value=Ke/J,o}let s=ca(e,t,n);return s.userData[Rn]=r,s}function pa(e){let t=e?.userData?.[Rn];if(!t){e?.dispose?.();return}let n=Ye.get(t)??[];Ye.set(t,n),n.length<fa&&!n.includes(e)?n.push(e):e.dispose()}function bn(e){let t=e?.getAttribute?.("position")??e?.attributes?.position;return!t||!!t.array}function Ze(e,t,n={}){we(t);let r=xe[n.style??Q()],o=[...r.outline?["outline"]:[],...r.rim?["rim"]:[],...r.wash&&!n.feature?["roof"]:[]];if(!o.length||!t?.geometry)return[];let s=t.geometry,a=n.centre;if(!a){!s.boundingBox&&bn(s)&&s.computeBoundingBox?.();let y=s.boundingBox?.getCenter(new e.Vector3)??s.boundingSphere?.center;a=y?[y.x,y.y,y.z]:[0,0,0]}let i=s.getAttribute?.("normal")?1:0,u=[],l=new e.Matrix4,m=new e.Vector4,f=new e.Vector2,c=new e.Matrix3,d=new e.Vector3,h=n.up??[0,0,1],p=!n.merged&&!n.feature&&!t.isInstancedMesh;p&&!s.boundingBox&&bn(s)&&s.computeBoundingBox?.();for(let y of o){let b=ha(e,y,{merged:n.merged,feature:n.feature,accent:n.accent??Mn(n.style)});b.uniforms.hlCentre.value.set(a[0],a[1],a[2]),b.uniforms.hlHasNormal.value=i;let g=t.isInstancedMesh?new e.InstancedMesh(s,b,t.count):new e.Mesh(s,b);t.isInstancedMesh&&(g.instanceMatrix=t.instanceMatrix),g.name=`${t.name||"mesh"}/highlight-${y}`,g.frustumCulled=!1,g.castShadow=g.receiveShadow=!1,g.renderOrder=(t.renderOrder??0)+1,g.raycast=()=>{},y==="roof"&&Object.defineProperty(g,"visible",{get:()=>t.visible&&dn()>.001,set:()=>{},configurable:!0}),g.onBeforeRender=(x,O,k)=>{t.isInstancedMesh&&(g.count=t.count),y!=="roof"&&(g.visible=t.visible);let A=b.uniforms;if(y==="roof"){c.setFromMatrix4(g.matrixWorld),d.setFromMatrixColumn(g.matrixWorld,0);let L=d.length()<.001?[0,0,1]:h;A.hlUp.value.set(L[0],L[1],L[2]).applyMatrix3(c.invert()).normalize(),A.hlWash.value=Xo*dn()}x.getDrawingBufferSize(f),A.hlViewport.value.copy(f);let Ee=x.domElement?.clientWidth||f.x,G=la();A.hlWidthPx.value=(G??J)*(f.x/Ee),A.hlFarScale.value=G==null?Ke/J:1,l.multiplyMatrices(k.projectionMatrix,k.matrixWorldInverse).multiply(g.matrixWorld),y==="outline"&&p&&ma(g,l,x,f),l.invert(),m.set(0,0,1,0).applyMatrix4(l),Math.abs(m.w)>1e-12&&A.hlEye.value.set(m.x/m.w,m.y/m.w,m.z/m.w),A.hlTime.value=performance.now()/1e3,b.uniformsNeedUpdate=!0},t.add(g),u.push(g)}return t.userData??={},t.userData[Z]=u,u}var gn=new WeakMap;function ba(e,t,n,r=Q()){if(!t||n==="plain"||n==="highlight"&&xe[r].keepMaterials)return t;let o=gn.get(t);o||gn.set(t,o=new Map);let s=`${n}|${r}`,a=o.get(s);if(a)return a;if(n==="highlight")a=new e.MeshLambertMaterial({color:16765471,emissive:7033856,side:t.side??e.FrontSide});else if(t.isShaderMaterial&&t.uniforms?.tint?.value?.isVector3)a=t.clone(),a.uniforms={...t.uniforms,tint:{value:ga(t.uniforms.tint.value.clone())}};else if(t.isShaderMaterial&&t.uniforms?.hlDimAll)a=t.clone(),a.uniforms={...t.uniforms,hlDimAll:{value:1}};else if(t.isShaderMaterial)a=t.clone(),a.uniforms=t.uniforms,a.defines={...t.defines??{},HL_DIM_ALL:""};else{if(a=t.clone(),a.color){let i=a.color,u=.2126*i.r+.7152*i.g+.0722*i.b;i.setRGB(i.r+(u-i.r)*H,i.g+(u-i.g)*H,i.b+(u-i.b)*H)}if(a.map){let i=a.onBeforeCompile;a.onBeforeCompile=(u,l)=>{i?.call(a,u,l),u.fragmentShader=u.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${H.toFixed(2)});`)},a.customProgramCacheKey=()=>`${t.customProgramCacheKey?.()??""}|hl-dim`}}return a.name=`${t.name||"material"}/${n}`,a.userData={...t.userData??{},highlightVariantOf:t},o.set(s,a),a}function ga(e){let t=.2126*e.x+.7152*e.y+.0722*e.z;return e.set(e.x+(t-e.x)*H,e.y+(t-e.y)*H,e.z+(t-e.z)*H)}var ya=e=>e?.userData?.highlightVariantOf??e;function _n(e,t,n,r={}){let o=r.style??Q(),s=[];t.traverse(a=>{a.isMesh&&a.material&&!a.material.userData?.[Z]&&s.push(a)});for(let a of s){let i=u=>u?.userData?.[Z]?u:u?.userData?.cityLook&&r.cityVariant?r.cityVariant(u,n):ba(e,ya(u),n,o);a.material=Array.isArray(a.material)?a.material.map(i):i(a.material),n==="highlight"?Ze(e,a,{style:o,up:r.up}):we(a)}}var ee=(e,t)=>`(${e}.g + 1.0 - ${t}.a)`;function xa(){let e=globalThis;return(e.__canalRecallMaskFormat??new URLSearchParams(e.location?.search??"").get("maskFormat"))==="rg"?"rg":"r8"}function Sn(e,t,n=xa()){let r=t.length>>1;if(e.length!==r*4)throw new Error(`packMask: ${e.length} colour bytes for ${r} mask texels`);if(n==="rg"){for(let s=0;s<r;s++)e[s*4+3]=255;return{colour:e,mask:t,channels:2}}let o=new Uint8Array(r);for(let s=0;s<r;s++)o[s]=t[s*2],e[s*4+3]=255-t[s*2+1];return{colour:e,mask:o,channels:1}}var Ma=70,wa=190,Ra=.5,vn=15,Ln=40;var Qe="12.0";var An=[-1,-1];var Tn=[-1,-1],kn=()=>[Ma,wa,Ra],Re=e=>Number.isInteger(e)?e.toFixed(1):String(e),Fn=`
uniform vec2 roofLayers;
uniform vec3 roofTier;
vec3 roofTierColour(vec3 fine, vec2 uv, float layer, float dist) {
  if (roofLayers.x < 0.0 || layer < roofLayers.x - 0.5 || layer > roofLayers.y - 0.5) return fine;
  float mid = smoothstep(roofTier.x - ${Re(vn)}, roofTier.x + ${Re(vn)}, dist);
  if (mid <= 0.0) return fine;
  float far = smoothstep(roofTier.y - ${Re(Ln)}, roofTier.y + ${Re(Ln)}, dist);
  vec3 coarse = texture(cells, vec3(uv * roofTier.z, layer)).rgb;
  vec3 flatMean = textureLod(cells, vec3(uv, layer), ${Qe}).rgb;
  return mix(mix(fine, coarse, mid), flatMean, far);
}`;var _a={threshold:20,taps:9,spread:1,grad:.85,sdf:1},Sa=`
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
}`;function et(e=_a,t=1){let n=Number.isFinite(t)&&t>0?t:1;return{cellTaps:[e.threshold*n,e.taps,e.spread,e.grad],cellTapsSdf:e.sdf}}var Cn=`${Rt}
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
${Sa}
#endif
void cellTierSample(vec3 p, float dist, out vec3 c, out vec2 m) {
#ifdef CELL_LOD_BIAS
  vec4 cc = texture(cells, p, cellLodBias); vec2 mm = texture(masks, p, cellLodBias).rg;
#else
  vec4 cc = texture(cells, p); vec2 mm = texture(masks, p).rg;
#endif
  c = cc.rgb; m = vec2(mm.r, ${ee("mm","cc")});
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
  far = max(far, ${_t("dist")});
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
      c = mix(c, tc.rgb, cellTapW); m = mix(m, vec2(tm.r, ${ee("tm","tc")}), cellTapW);
    }
  }
#endif
  if (far <= 0.0) return;
  vec4 fc = textureLod(cells, p, ${Qe}); vec2 fm = textureLod(masks, p, ${Qe}).rg;
  c = mix(c, fc.rgb, far); m = mix(m, vec2(fm.r, ${ee("fm","fc")}), far);
}`,va=[1,2];function tt(e,t=va){return{cellAniso:Number.isFinite(e)&&e>=1?e:1,cellAnisoRule:[1,1,t[0],t[1]]}}var La=.5,Se={sunAzimuthDeg:215,sunElevationDeg:40,sunColour:"#ffe9cc",sunIntensity:2.15,skyColour:"#e3ebf6",groundColour:"#998a72",skyIntensity:1.75,shadows:!0,shadowMapSize:2048,shadowIntensity:1-La};var rc={...Se,...Xt};function Aa(e,t){let n=e*Math.PI/180,r=t*Math.PI/180;return[Math.sin(n)*Math.cos(r),Math.cos(n)*Math.cos(r),Math.sin(r)]}var oc=Aa(Se.sunAzimuthDeg,Se.sunElevationDeg),ve=(()=>{let e=Se.sunAzimuthDeg*Math.PI/180;return[Math.sin(e),Math.cos(e)]})(),_e=[ve[0]*.6,ve[1]*.6,.8],En=.84;function Ta(e){let t=e[0]*_e[0]+e[1]*_e[1]+e[2]*_e[2];return Math.max(.5,Math.min(1,.58+.42*Math.max(0,t)))}var ac=Ta([0,0,1]),ie=e=>Number.isInteger(e)?e.toFixed(1):String(+e.toFixed(6)),On=`
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = ${ie(En)} + ${ie(1-En)} * (0.5 + 0.5 * dot(h, vec2(${ie(ve[0])}, ${ie(ve[1])}))); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, dot(n, vec3(${_e.map(ie).join(", ")}))), 0.5, 1.0);`;var In=[.4,2.5],ka=["brick","accent","stucco"];function Fa(e){let t=(e?.white?Ve(e.white):1.106)*(e?.stripOverDrawn??1);return Math.max(In[0],Math.min(In[1],t))}var Ca=["brick","accent"];function Dn(e,t,n,r,o=B()){return o!=="sunny"||r==="measured"?t:n?ka.includes(e)?X(t,Fa(n)):t:Ca.includes(e)?X(t,1.106):t}var _=[{name:"magnified (rho < 1)",rgb:[255,0,0]},{name:"rho 1-2",rgb:[255,255,0]},{name:"rho 2-4",rgb:[0,255,0]},{name:"rho 4-8",rgb:[0,255,255]},{name:"rho 8-16",rgb:[0,0,255]},{name:"rho 16-tier",rgb:[255,128,0]},{name:"tier far > 0",rgb:[255,0,255]},{name:"depth-fade far > 0 (tier 0)",rgb:[255,255,255]},{name:"under fade > 0",rgb:[128,0,255]},{name:"roof layer",rgb:[128,128,128]}];var dc=_.length-1,Ea=3;var Oa=520,Ia=Oa.toFixed(1),Da=String(Ea),S=e=>`vec3(${e.map(t=>(t/255).toFixed(4)).join(", ")})`,Nn=`
#ifdef CELL_DEBUG_RHO
vec3 cellDebugColour(float layer) {
  if (roofLayers.x >= 0.0 && layer > roofLayers.x - 0.5 && layer < roofLayers.y - 0.5) return ${S(_[9].rgb)};
#if defined(CELL_TIER_ANISO) && defined(CELL_DEBUG_UNDER)
  if (cellFarFlat > 0.001) return ${S(_[6].rgb)};
  if (cellFarTier <= 0.001 && cellFar > 0.001) return ${S(_[7].rgb)};
  if (cellUnder < 0.5) return ${S(_[0].rgb)};
  if (cellUnder < 0.75) return ${S(_[1].rgb)};
  if (cellUnder < 1.0) return ${S(_[2].rgb)};
  if (cellUnder < 1.5) return ${S(_[3].rgb)};
  if (cellUnder < 2.0) return ${S(_[4].rgb)};
  return ${S(_[5].rgb)};
#else
#ifdef CELL_TIER_ANISO
  if (cellFarFlat > 0.001) return ${S(_[6].rgb)};
  if (cellFarUnder > 0.001) return ${S(_[8].rgb)};
#else
  if (cellFarTier > 0.001) return ${S(_[6].rgb)};
#endif
  if (cellFar > 0.001) return ${S(_[7].rgb)};
  if (cellRho < 1.0) return ${S(_[0].rgb)};
  if (cellRho < 2.0) return ${S(_[1].rgb)};
  if (cellRho < 4.0) return ${S(_[2].rgb)};
  if (cellRho < 8.0) return ${S(_[3].rgb)};
  if (cellRho < 16.0) return ${S(_[4].rgb)};
  return ${S(_[5].rgb)};
#endif
}
#endif`;function te(e){try{return typeof URLSearchParams=="function"?new URLSearchParams(globalThis.location?.search??"").get(e):null}catch{return null}}var Pa=1.25,Pn=[2.5,5],Na={footprint:1,fadePx:[2,4],frameMinPx:0,barPx:[0,0],tent:!0};function Ba(){let t=globalThis.__canalRecallWindowSdfBand??te("windowSdfBand");return!(t===!1||t==="0"||t==="false"||t==="off")}var Le=(e,t)=>{if(e==null)return null;let n=e.split(",").map(Number);return n.length===t&&n.every(r=>Number.isFinite(r)&&r>=0)?n:null};function Ha(){let e=Na,t=Le(te("windowSdfFoot"),1)?.[0]??e.footprint,n=Le(te("windowSdfFade"),2)??e.fadePx,r=Le(te("windowSdfFrameMin"),1)?.[0]??e.frameMinPx,o=Le(te("windowSdfBar"),2)??e.barPx,s=te("windowSdfTent"),a=s==null?e.tent:s==="1";return{band:[Ba()?1:0,t,n[0],n[1]],shape:[r,o[0],o[1],a?1:0]}}var nt=null;function Bn(){let e=`${globalThis.location?.search??""}|${String(globalThis.__canalRecallWindowSdfBand)}`;nt?.key!==e&&(nt={key:e,v:Ha()});let t=nt.v;return{windowSdfBand:{value:[...t.band]},windowSdfShape:{value:[...t.shape]}}}var Ae=["#6f8796","#2f4350","#1d2a33"],Te=e=>S([parseInt(e.slice(1,3),16),parseInt(e.slice(3,5),16),parseInt(e.slice(5,7),16)]),Hn=`
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
  vec2 cell = vec2(${Ia}, head.y);
  vec2 p = fract(uv) * cell;
  // The pixel's footprint from the continuous uv (fract jumps at the cell seam), in canvas px per framebuffer px.
  vec2 fpx = max(fwidth(uv * cell), vec2(1e-3));
  vec2 fw = fpx * (band ? windowSdfBand.y : ${Pa.toFixed(2)});
#ifdef CELL_TAPS
  // The footprint prefilter's taps (roofTier.ts, lane R4-D #246) widen the edge box with the wall under the windows.
  fw *= mix(1.0, cellTapsSdf, cellTapW);
#endif
  vec2 fade = band ? windowSdfBand.zw : vec2(${Pn[0].toFixed(1)}, ${Pn[1].toFixed(1)});
  for (int i = 0; i < ${Da}; i++) {
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
    vec3 gc = g < 0.55 ? mix(${Te(Ae[0])}, ${Te(Ae[1])}, g / 0.55) : mix(${Te(Ae[1])}, ${Te(Ae[2])}, (g - 0.55) / 0.45);
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
#endif`;var Ga={legacy:.9,sunny:1},Ua=(e=B())=>Ga[e],D=Ua(),le=255/225,Wa=255/228,$a=255/243,Va=255/246,Fe=[{cell:"brick",tileM:E.brick,clampUv:!1,litGain:le*D,skyTint:!1},{cell:"stucco",tileM:E.stucco,clampUv:!1,litGain:$a*D,skyTint:!1},{cell:"stone",tileM:E.stone,clampUv:!1,litGain:Wa*D,skyTint:!1},{cell:"white",tileM:1,clampUv:!1,litGain:1,skyTint:!1},{cell:"door",tileM:E.door,clampUv:!1,litGain:1,skyTint:!1},{cell:"glass",tileM:E.glass,clampUv:!0,litGain:1,skyTint:!0},{cell:"tile",tileM:E.roofTile,clampUv:!1,litGain:le*D,skyTint:!1},{cell:"slate",tileM:E.slate,clampUv:!1,litGain:le*D,skyTint:!1},{cell:"flat",tileM:E.bitumen,clampUv:!1,litGain:le*D,skyTint:!1},{cell:"brick20",tileM:E.brick,clampUv:!1,litGain:le*D,skyTint:!1},{cell:"whiteStucco",tileM:E.stucco,clampUv:!1,litGain:Va*D,skyTint:!1},{cell:"glassTint",tileM:E.glass,clampUv:!0,litGain:1,skyTint:!0}],ke=Fe.length,ue=Object.fromEntries(Fe.map((e,t)=>[e.cell,t])),za=Be.school;function ot(e,t={}){let n=Ft[e],r=t.source==="measured";return n==="glass"&&r?ue.glassTint:n==="brick"&&!r&&typeof t.year=="number"&&t.year>=za?ue.brick20:n==="stucco"&&t.white?ue.whiteStucco:n==="frame"?ue.white:ue[n]}function ja(){return Fe.map(e=>[1/e.tileM,e.clampUv?1:0,e.litGain,e.skyTint?1:0])}var qa=.38,Ya=.8,Ka=.27,Xa=.97,Ja=.75,Za=.5,Qa=.12,es=(e,t)=>(e<45||e>340)&&t>=.2;function ts(e,t,n,r=B(),o){if(Ot(e,n))return pe(e,Jt(e,t,n,r,o),n);let s=M(t),[a,i,u]=v(s);return e==="slate"&&es(a,i)?pe("roofTile",t):(e==="brick"||e==="accent")&&i<Qa?w(T([a,i,Math.min(N[1],Math.max(N[0],.12+u*.9))])):e==="slate"&&u>qa?w(T([a,Math.min(i,.12),Math.min(.72,u/Ya)])):e==="slate"?u<Ka?I.slate[1]:I.slate[0]:e==="frame"&&u>=.5&&u<Ja?w(s):e==="stone"&&u<Za?w(s):pe(e,t)}function Vn(e,t,n,r=B(),o,s){let a=ts(e,t,n,r,o),[i,u,l]=M(Dn(e,a,s??null,n,r));return[i,u,l,255]}function ns(e,t,n){switch(t){case"brick":return nn(e,n);case"brick20":return un(e,n);case"stucco":return sn(e);case"whiteStucco":return cn(e);case"stone":return ln(e);case"white":case"frame":return mn(e);case"door":return an(e);case"glass":return rn(e);case"glassTint":return on(e);case"tile":return ye(e,"tile");case"slate":return ye(e,"slate");case"flat":return ye(e,"flat")}}function rs(e,t,n){let r=n*n,o=new Uint8Array(r*4*ke),s=new Uint8Array(r*2*ke),a=e.createElement("canvas");a.width=a.height=n;let i=a.getContext("2d",{willReadFrequently:!0});return i.imageSmoothingQuality="high",Fe.forEach((u,l)=>{i.clearRect(0,0,n,n),i.drawImage(ns(e,u.cell,t),0,0,n,n);let m=i.getImageData(0,0,n,n).data;for(let f=0;f<n;f++)for(let c=0;c<n;c++){let d=((n-1-f)*n+c)*4,h=l*r+f*n+c;o[h*4]=m[d],o[h*4+1]=m[d+1],o[h*4+2]=m[d+2],o[h*4+3]=255,s[h*2]=255,s[h*2+1]=0}}),{colour:o,mask:s}}async function os(e=document){let t=new Image;t.src=new URL("materials/ambientcg/Bricks057/colour.jpg",e.baseURI).href;try{return await t.decode(),t}catch{return null}}var at=e=>`${e.lit?"lit":"unlit"}|${e.kind}|${e.kind==="slot"?e.uv??"uv":"-"}|${e.highlight?"hl":e.dim?"dim":"-"}|${e.side??0}${e.noFade?"|nofade":""}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf2":""}${e.lodBias?"|lodb":""}${e.aniso?"|aniso":""}${e.taps?"|taps":""}`;function as(e){let t={CITY_SLOT_COUNT:String(ke)};return e.kind==="slot"&&(t.CITY_SLOT=""),e.swap&&(t.CITY_SWAP=""),e.cellDebug&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CELL_DEBUG_RHO="",e.cellDebug==="under"&&(t.CELL_DEBUG_UNDER="")),e.windows&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CITY_WINDOW_SDF=""),e.lodBias&&e.kind==="chunk"&&(t.CELL_LOD_BIAS=""),e.aniso&&e.kind==="chunk"&&(t.CELL_TIER_ANISO=""),e.taps&&e.kind==="chunk"&&(t.CELL_TAPS=""),e.lit?(t.CITY_VARIANT_UNIFORMS="",{...t,...Xe()}):(e.kind==="slot"&&e.uv==="box"&&(t.CITY_BOX_UV=""),e.highlight?t.CITY_HIGHLIGHT="":e.dim&&(t.CITY_DIM=""),{...t,...Xe()})}function ss(e){return{cityForce:{value:e.highlight?1:e.dim?2:0},cityBoxUv:{value:e.kind==="slot"&&e.uv==="box"?1:0}}}var is=e=>e.lit?`city-look-v4|lit|${e.kind}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf2":""}${e.lodBias?"|lodb":""}${e.aniso?"|aniso":""}${e.taps?"|taps":""}`:`city-look-v3|${at({...e,side:0})}`,ls="vec3(1.0, 0.824, 0.122)",Gn="vec3(1.0, 0.637, 0.0137)",Un="vec3(0.035, 0.05, 0.07)",us=1,cs=.2,ms=.75,fs=1.8,ne=e=>Number.isInteger(e)?e.toFixed(1):String(e),ds=`
float cityGrain(vec3 cell) {
  float g = clamp(dot(cell, vec3(0.299, 0.587, 0.114)) / ${ne(225/255)}, 0.45, 1.1);
  return mix(1.0, g, ${ne(ms)});
}`,zn=16,hs=`
#ifdef CITY_SWAP
attribute float swapSlot;
uniform vec4 citySwapUnder[${zn/4}];
uniform float cityUnder;
flat varying float vCityUnder;
#endif`,ps=`
#ifdef CITY_SWAP
int citySw = int(swapSlot + 0.5) - 1;
vCityUnder = citySw >= 0 ? citySwapUnder[citySw / 4][citySw % 4] : cityUnder;
#endif`,jn=`
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
${hs}
${Je}`,qn=`
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
#endif`,Yn=`
vFacDist = length((modelViewMatrix * vec4(position, 1.0)).xyz);
if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`,Kn=`
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${Fn}
${Cn}
${Nn}
${Hn}
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
${ds}
${Je}`,Xn=`
if (HL_GHOST(vHighlight)) discard;
#ifdef CITY_SWAP
float cityHash = fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296)));
if (cityFade < 1.0 && cityHash >= cityFade) discard;
// The complement of a replacement dissolving in over (or out from) this mesh: where it draws, this one does not.
if (cityHash < vCityUnder) discard;
#else
if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;
#endif`,Jn=`
vec2 cityUv = vSlot.y > 0.5 ? clamp(vFacUv, 0.0, 1.0) : vFacUv;
vec3 cityP = vec3(cityUv, vLayer);
vec3 cityC; vec2 cityM;
#ifdef CITY_SLOT
vec4 cityCC = texture(cells, cityP); vec2 cityMM = texture(masks, cityP).rg;
cityC = cityCC.rgb; cityM = vec2(cityMM.r, ${ee("cityMM","cityCC")});
#else
cellTierSample(cityP, vFacDist, cityC, cityM);
#ifdef CITY_WINDOW_SDF
windowSdf(cityUv, vLayer, 1.0 - cellFar, cityC, cityM);
#endif
cityC = roofTierColour(cityC, cityUv, vLayer, vFacDist);
#endif
float cityG = cityGrain(cityC);
cityC *= mix(vec3(1.0), vTint, cityM.r) * mix(vec3(1.0), vAccent, cityM.g);`,bs=`
uniform mat3 enuFromWorld;
${jn}
varying float vShade;
void main() {
${qn}
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
${On}
  vShade = shade;
#else
  vShade = tint.a;
#endif
${Yn}
}`,gs=`
precision highp float;
${Kn}
varying float vShade;
void main() {
${Xn}
${Jn}
  if (HL_PAINT(vHighlight)) {
    float hlShade = clamp(1.0 - (1.0 - vShade) * ${ne(fs)}, 0.6, 1.0);
    gl_FragColor = vec4(${ls} * (flatColour > 0.5 ? 1.0 : cityG) * hlShade, 1.0);
    return;
  }
  if (flatColour > 0.5) cityC = vTint;
  cityC = hlDesat(cityC, vHighlight);
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  gl_FragColor = vec4(cityC * shade, 1.0);
#ifdef CELL_DEBUG_RHO
  gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif
}`;function ys(e,t={}){return{cells:t.cells??{value:null},masks:t.masks??{value:null},slotBase:t.slotBase??{value:0},slotParams:t.slotParams??{value:ja().map(n=>new e.Vector4(...n))},bands:t.bands??{value:0},flatColour:t.flatColour??{value:0},cityFade:t.cityFade??{value:1},wallGain:t.wallGain??{value:1},roofLayers:t.roofLayers??{value:Tn},roofTier:t.roofTier??{value:kn()},cellTier:t.cellTier??{value:An},enuFromWorld:t.enuFromWorld??{value:new e.Matrix3},citySwapUnder:t.citySwapUnder??{value:new Float32Array(zn)},cityUnder:t.cityUnder??{value:0},windowTable:t.windowTable??{value:null},windowSdfMix:t.windowSdfMix??{value:1},cellLodBias:t.cellLodBias??{value:0},cellAniso:t.cellAniso??{value:tt(16).cellAniso},cellAnisoRule:t.cellAnisoRule??{value:tt(16).cellAnisoRule},cellTaps:t.cellTaps??{value:et().cellTaps},cellTapsSdf:t.cellTapsSdf??{value:et().cellTapsSdf},...Bn(),...t.windowSdfBand?{windowSdfBand:t.windowSdfBand}:{},...t.windowSdfShape?{windowSdfShape:t.windowSdfShape}:{}}}var xs={accent:[1,1,1,1],hidden:[0],color:[1,1,1],uv:[0,0],uv1:[0,0],swapSlot:[0]},rt="recipeLookShared";function Ms(e,t,n){let r=as(t),o=t.side??e.FrontSide,s;if(!t.lit)s=new e.ShaderMaterial({uniforms:n,defines:r,vertexShader:bs,fragmentShader:gs,side:o});else{s=new e.MeshLambertMaterial({side:o,flatShading:t.kind==="chunk"}),s.defines={...s.defines??{},...r};let a=ss(t);s.onBeforeCompile=u=>{for(let l of Object.keys(n))u.uniforms[l]=n[l];Object.assign(u.uniforms,a),u.vertexShader=u.vertexShader.replace("#include <common>",`#include <common>${jn}`).replace("#include <begin_vertex>",`#include <begin_vertex>${qn}`).replace("#include <project_vertex>",`#include <project_vertex>${Yn}`),u.fragmentShader=u.fragmentShader.replace("#include <common>",`#include <common>${Kn}
float cityLuma;`).replace("#include <dithering_fragment>",`#include <dithering_fragment>
#ifdef CELL_DEBUG_RHO
gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>${Xn}`).replace("#include <map_fragment>",`${Jn}
#ifdef CITY_SLOT
cityC *= vSlot.z;
#else
cityC *= mix(1.0, wallGain * ${ne(D)}, cityM.r);
#endif
if (flatColour > 0.5) cityC = vTint;
cityLuma = dot(cityC, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= HL_PAINT(vHighlight) ? ${Gn} * ${ne(us)} * pow(flatColour > 0.5 ? 1.0 : cityG, 2.2) : pow(hlDesat(cityC, vHighlight), vec3(2.2));`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
if (HL_PAINT(vHighlight)) totalEmissiveRadiance += ${Gn} * ${ne(cs)};
#ifdef CITY_SLOT
else totalEmissiveRadiance += ${Un} * vSlot.w;
#else
// Bay glazing (dark, untinted texels): the same constant sky tint as landmark glass, never a hotspot.
else totalEmissiveRadiance += ${Un} * (1.0 - smoothstep(0.06, 0.2, cityLuma)) * (1.0 - cityM.r);
#endif`)};let i=is(t);s.customProgramCacheKey=()=>i,s.uniforms=n}return s.defaultAttributeValues={...xs},s.name=`city-look/${at(t)}`,s.userData={cityLook:!0,cityVariant:{...t},[rt]:!0},t.noFade&&St(s),t.kind==="chunk"?ht(s,!!t.lit):s}function ws(e){return e?e.isMeshBasicMaterial||e.userData?.unlit?"unlit (decal / emissive sign)":e.transparent||(e.opacity??1)<1?"transparent":e.vertexColors?"vertex colours":e.map?"own texture":null:"no material"}function Rs(e,t){let n=e?.userData??{};if(Wt(n.materialSlot)&&typeof n.tint=="string"){let s=n.tintSource==="measured";return{slot:n.materialSlot,tint:n.tint,inferred:n.materialSlotSource===Bt,...s?{source:"measured"}:{},...s&&typeof n.tintWhitePoint=="string"?{white:n.tintWhitePoint}:{}}}if(!t||ws(e)||!e.color)return null;let r="#"+e.color.getHexString(),o=Gt(e.name,r);return{slot:o.slot,tint:o.tint,inferred:!0}}function Wn(e,t,n,r,o={}){let s=t.getAttribute("position")?.count??0,a=ot(n,o),i=Vn(n,r,o.source,void 0,o.whitePoint,o.exposure),u=t.getAttribute("layer"),l=t.getAttribute("tint");if(u&&l)return u.getX(0)===a&&Math.round(l.getX(0)*255)===i[0]&&Math.round(l.getY(0)*255)===i[1]&&Math.round(l.getZ(0)*255)===i[2];t.setAttribute("layer",new e.BufferAttribute(new Uint8Array(s).fill(a),1,!1));let m=new Uint8Array(s*4);for(let f=0;f<s;f++)m.set(i,f*4);return t.setAttribute("tint",new e.BufferAttribute(m,4,!0)),!0}function _s(e,t,n,r,o,s={}){let a=r.getAttribute("normal"),i=r.getAttribute("layer"),u=r.getAttribute("tint");if(!a||!i||!u)return 0;let[l,m,f]=Vn("bitumen",o,s.source);t.updateWorldMatrix(!0,!0);let c=new e.Matrix4().copy(t.matrixWorld).invert().multiply(n.matrixWorld),d=new e.Matrix3().getNormalMatrix(c),h=new e.Vector3,p=ot("bitumen",s),y=0;for(let b=0;b<a.count;b++)h.set(a.getX(b),a.getY(b),a.getZ(b)).applyMatrix3(d).normalize(),!(h.y<Xa)&&(i.setX(b,p),u.setXYZW(b,l/255,m/255,f/255,1),y++);return y&&(i.needsUpdate=!0,u.needsUpdate=!0),y}var Ss="__canalRecallCityLookShared";function Zn(e,t={}){let n=globalThis,r=n[Ss]??=new Map,o=r.get(e);return o||r.set(e,o=vs(e,t)),o}function vs(e,t={}){let n=t.document??globalThis.document,r=t.size??(globalThis.matchMedia?.("(pointer: coarse)").matches?128:256),o=ys(e),s=new Map,a=null,i=!1,u=(f,c)=>{let d=new e.DataArrayTexture(f,r,r,ke);return d.format=c,d.type=e.UnsignedByteType,d.wrapS=d.wrapT=e.RepeatWrapping,d.minFilter=e.LinearMipmapLinearFilter,d.magFilter=e.LinearFilter,d.generateMipmaps=!0,d.anisotropy=t.anisotropy??de("slotCells",16).anisotropy,d.unpackAlignment=1,d.needsUpdate=!0,d.userData={bytes:f.byteLength,[rt]:!0},d},l=(async()=>{if(!n)return;let f=t.brick!==void 0?t.brick:await os(n),{colour:c,mask:d}=rs(n,f,r),h=Sn(c,d);a={colour:u(h.colour,e.RGBAFormat),mask:u(h.mask,h.channels===1?e.RedFormat:e.RGFormat)},i||(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)})(),m=f=>{let c=at(f),d=s.get(c);return d||s.set(c,d=Ms(e,f,o)),d};return{uniforms:o,ready:l,material:m,dress(f,{lit:c,infer:d=!1,year:h=null,wallExposure:p=null}){let y=0;return f.traverse(b=>{if(!b.isMesh||Array.isArray(b.material)||b.material?.userData?.cityLook)return;let g=Rs(b.material,d);if(!g)return;let x=b.geometry;if(!x?.getAttribute("position"))return;let O=!!x.getAttribute("uv");!O&&!x.getAttribute("normal")&&x.computeVertexNormals();let k={year:h,white:g.inferred&&Ut(b.material.name),source:g.source,...g.white?{whitePoint:g.white}:{},...p?{exposure:p}:{}};Wn(e,x,g.slot,g.tint,k)||(x=b.geometry=x.clone(),x.deleteAttribute("layer"),x.deleteAttribute("tint"),Wn(e,x,g.slot,g.tint,k)),g.inferred&&g.slot==="slate"&&!g.source&&_s(e,f,b,x,g.tint,k);let A=b.material;b.material=m({lit:c,kind:"slot",uv:O?"uv":"box",side:A.side}),b.userData.citySlot={slot:g.slot,tint:g.tint,...g.source?{source:g.source}:{},inferred:g.inferred,from:A.name,layer:ot(g.slot,k)},A.userData?.[rt]||A.dispose(),y++}),y},highlighted(f,c){let d=f?.userData?.cityVariant;return d?m({...d,highlight:c,dim:!1}):f},dimmed(f,c){let d=f?.userData?.cityVariant;return d?m({...d,highlight:!1,dim:c}):f},bindAtlas(f){i=!!f,f?(o.cells.value=f.colour,o.masks.value=f.mask,o.slotBase.value=f.slotBase):a&&(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)},textureBytes(){return a&&!i?Math.round((a.colour.userData.bytes+a.mask.userData.bytes)*4/3):0}}}var Ts="NL.IMBAG.Pand.";var Ce=e=>/^\d{16}$/.test(e)?`${Ts}${e}`:e;var ks=2*Math.PI*6378137;function Fs(e,t){return[(180+e)/360,(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+t*Math.PI/360)))/360]}function Cs(e,t){let n=e*360-180,r=180-t*360;return[n,360/Math.PI*Math.atan(Math.exp(r*Math.PI/180))-90]}var Es=e=>1/ks/Math.cos(e*Math.PI/180),er=e=>`${e.z}/${e.x}/${e.y}`;var Os=e=>[(e.x+.5)/2**e.z,(e.y+.5)/2**e.z];function tr(e){let t=Os(e),n=Cs(t[0],t[1]);return{tile:e,centre:t,anchor:n,units:Es(n[1])}}function nr(e){let t=e.units;return[t,0,0,0,0,0,t,0,0,t,0,0,e.centre[0],e.centre[1],0,1]}function rr(e,t,n=16,r,o=.25){let[s,a]=Fs(e,t),i=2**n,u=s*i,l=a*i,m=Math.round(u)-1,f=Math.round(l)-1;return r&&Math.abs(u-(r.x+1))<=.5+o&&Math.abs(l-(r.y+1))<=.5+o&&({x:m,y:f}=r),{x:m,y:f,tiles:[[0,0],[1,0],[0,1],[1,1]].map(([c,d])=>({z:n,x:m+c,y:f+d}))}}var Is="recipeTiles";function ir(e){try{let t=globalThis;return e===void 0&&t.__canalRecallRecipeTiles===!0?!0:new URLSearchParams(e??t.location?.search??"").get(Is)==="1"}catch{return!1}}function st(e,t,n){let r=rr(t.lng,t.lat,16,n);return{block:{x:r.x,y:r.y},tiles:r.tiles.map(er).filter(o=>!!e.tiles[o])}}var me=class{constructor(t,n){this.load=t;this.free=n}items=new Map;acquire(t){let n=this.items.get(t);if(!n){let r={refs:0,promise:null};r.promise=this.load(t).then(o=>r.value=o),this.items.set(t,n=r),n.promise.catch(()=>this.items.delete(t))}return n.refs++,n.promise}release(t){let n=this.items.get(t);n&&(--n.refs>0||(this.items.delete(t),n.value!==void 0?this.free(n.value,t):n.promise.then(r=>this.free(r,t),()=>{})))}get size(){return this.items.size}refs(t){return this.items.get(t)?.refs??0}};function it(e,t){if(!e||t===void 0)return-1;for(let[n,r,o]of e)if(t>=r&&t<r+o)return n;return-1}function Ds(e,t){let n=new Map;for(let[r,o,s]of t){let a=new Set;for(let i=o*3;i<(o+s)*3;i++)a.add(e[i]);n.set(r,Uint32Array.from([...a].sort((i,u)=>i-u)))}return n}function lt(e){let t=new Set;for(let n of e)for(let r of n.covers)for(let o of r)t.add(o);return[...t].sort()}var Xc=Me.hide,or=Me.highlight,Ps=Me.dim,fe=class{constructor(t){this.host=t;let n=t.THREE;this.root=new n.Group,this.root.name="recipe-tiles",this.units=new me(r=>this.loadUnit(r),r=>{for(let o of r)o.geometry.dispose()})}root;index=null;tiles=new Map;block=null;units;unregister=null;clipFromWorld=null;highlighted=new Set;focus=null;recipe=xn();lastHidden="";pendingHidden=!1;lastCheck=0;revisionN=0;loading=0;errors=[];async start(t=21){let n=await fetch(new URL("index.json",this.host.baseUrl).href,{cache:"no-cache"});if(!n.ok)throw Error(`recipe tiles index ${n.status}`);return this.index=await n.json(),this.unregister=this.host.frame.register("recipe-tiles",{root:this.root,beforeRender:r=>(this.clipFromWorld=r.clipFromWorld,this.update(),this.root.children.length>0),revision:()=>this.revisionN},{order:t}),this.update(!0),!0}update(t=!1){if(!this.index)return;let n=performance.now();if(!t&&n-this.lastCheck<250){this.pendingHidden&&this.syncHidden();return}this.lastCheck=n;let r=this.host.getCentre();if(!r)return;let{block:o,tiles:s}=st(this.index,r,this.block);this.block=o;let a=new Set(s);for(let u of a)this.tiles.has(u)||this.loadTile(u);if([...a].every(u=>this.tiles.get(u)?.ready))for(let[u,l]of this.tiles)a.has(u)||this.dropTile(l);this.pendingHidden&&this.syncHidden()}async loadTile(t){let n=this.host.THREE,r={id:t,meta:null,group:new n.Group,ready:!1,disposed:!1,merged:[],instanced:[],triangles:0};this.tiles.set(t,r),this.loading++;try{let o=await this.host.loadGltf(new URL(`building-mesh/${t}.glb`,this.host.baseUrl).href);if(r.disposed)return;if(r.meta=o.userData?.recipeTile,!r.meta)throw Error(`${t}: no recipeTile extras`);let[s,a,i]=r.meta.tile,u=tr({z:s,x:a,y:i});r.group.name=`recipe-tile/${t}`,r.group.matrixAutoUpdate=!1,r.group.matrix.fromArray(nr(u)),o.scene.updateMatrixWorld(!0);let l=this.host.cityLook,m=this.host.lit!==!1,f=[];o.scene.traverse(c=>{c.isMesh&&f.push(c)});for(let c of f){if(c.isInstancedMesh){let g=c.geometry.getAttribute("_PAND"),x=c.count,O=new Int32Array(x),k=new Float32Array(x*16);for(let L=0;L<x;L++)O[L]=Math.round(g.getX(L));let A=new n.Matrix4,Ee=c.matrixWorld;for(let L=0;L<x;L++)c.getMatrixAt(L,A),A.premultiply(Ee),A.toArray(k,L*16);let G=new n.InstancedMesh(c.geometry,c.material,x);for(let L=0;L<x;L++)G.setMatrixAt(L,A.fromArray(k,L*16));G.name=`stub/${c.userData.unit}`,r.group.add(G),r.instanced.push({unit:c.userData.unit,matrices:k,pands:O,meshes:[],stub:G});continue}let d=c.geometry;this.cityAttributes(d);let h=d.userData?.pandRanges??[];d.setAttribute("hidden",new n.BufferAttribute(new Uint8Array(d.getAttribute("position").count),1,!1));let p=c.material?.side??n.FrontSide,y=c.material?.userData?.cityLook?.uv??"uv",b=new n.Mesh(d,l.material({lit:m,kind:"slot",uv:y,side:p}));b.name=`recipe-tile/${t}/uniques`,b.matrixAutoUpdate=!1,b.matrix.copy(c.matrixWorld),b.userData.recipeTile={tile:t,ranges:h},this.host.frame.constructor.setShadows?.(b,!0,!0),r.group.add(b),r.merged.push({mesh:b,ranges:h,verts:Ds(d.index.array,h)}),r.triangles+=d.index.count/3}if(this.root.add(r.group),this.revisionN++,this.host.repaint(),await Promise.all(r.instanced.map(async c=>{let d=await this.units.acquire(c.unit);if(r.disposed){this.units.release(c.unit);return}for(let h of d){let p=new n.InstancedMesh(h.geometry,h.material,c.pands.length),y=new n.Matrix4;for(let b=0;b<c.pands.length;b++)p.setMatrixAt(b,y.fromArray(c.matrices,b*16).multiply(h.local));p.name=`recipe-tile/${t}/unit/${c.unit}`,p.userData.recipeTile={tile:t,pands:c.pands},p.computeBoundingSphere(),p.computeBoundingBox(),this.host.frame.constructor.setShadows?.(p,!0,!0),r.group.add(p),c.meshes.push(p),r.triangles+=h.triangles*c.pands.length}r.group.remove(c.stub),c.stub.dispose?.()})),r.disposed)return;r.ready=!0,this.applyHighlight(r),this.pendingHidden=!0,this.revisionN++,this.host.repaint()}catch(o){this.errors.push(String(o?.message??o)),console.warn(`Recipe tile ${t} unavailable; the mid/far layers keep drawing it.`,o),this.tiles.delete(t),r.group.parent?.remove(r.group)}finally{this.loading--}}cityAttributes(t){for(let[n,r]of[["_layer","layer"],["_tint","tint"],["_LAYER","layer"],["_TINT","tint"]]){let o=t.getAttribute(n);o&&(t.setAttribute(r,o),t.deleteAttribute(n))}}async loadUnit(t){let n=this.host.THREE,r=this.host.cityLook,o=this.host.lit!==!1,s=await this.host.loadGltf(new URL(`units/${t}.glb`,this.host.baseUrl).href);s.scene.updateMatrixWorld(!0);let a=[];return s.scene.traverse(i=>{if(!i.isMesh)return;let u=!!i.material?.userData?.cityLook;u&&this.cityAttributes(i.geometry);let l=u?r.material({lit:o,kind:"slot",uv:i.material.userData.cityLook.uv??"uv",side:i.material.side}):i.material;a.push({geometry:i.geometry,material:l,local:i.matrixWorld.clone(),triangles:(i.geometry.index?.count??i.geometry.getAttribute("position").count)/3,city:u})}),a}dropTile(t){t.disposed=!0,this.tiles.delete(t.id),t.group.parent?.remove(t.group);for(let n of t.merged)n.mesh.geometry.dispose();for(let n of t.instanced){for(let r of n.meshes)r.dispose?.();n.stub?.geometry?.dispose?.(),n.meshes.length&&this.units.release(n.unit)}this.pendingHidden=!0,this.revisionN++}syncHidden(){let t=[...this.tiles.values()].filter(o=>o.ready),n=lt(t.map(o=>o.meta)),r=n.join(",");if(r!==this.lastHidden){if(this.host.setHidden(n)===!1)return;this.lastHidden=r}this.host.setReplacedSpecs?.(new Set(t.flatMap(o=>o.meta.specs))),this.pendingHidden=!1}setHighlighted(t,n){this.highlighted=new Set([...t].map(r=>Ce(String(r)))),this.focus=n&&this.highlighted.size?n:null;for(let r of this.tiles.values())r.ready&&this.applyHighlight(r);this.host.repaint()}applyHighlight(t){let n=this.host.THREE,r=this.host.cityLook,o=this.recipe,s=c=>this.highlighted.has(Ce(t.meta.pands[c]))||t.meta.covers[c].some(d=>this.highlighted.has(d)),a=c=>o.desaturate&&wn(this.focus?.lngLat,c),i=new n.Vector3,u=c=>(i.copy(c).applyMatrix4(t.group.matrix),ar(i.x,i.y));for(let c of t.merged){let d=c.mesh.geometry.getAttribute("hidden"),h=!1,p=null;(o.desaturate||o.outline||o.rim)&&(c.where??=Ns(n,c.mesh,c.verts,u));for(let[y,b]of c.verts){let g=c.where?.get(y),x=s(y)?or:g&&this.focus&&a(g.lngLat)?Ps:0;if(x===or&&g&&(p??=g.local),d.array[b[0]]!==x){for(let O of b)d.array[O]=x;h=!0}}h&&(d.needsUpdate=!0),p&&(o.outline||o.rim)?Ze(n,c.mesh,{merged:!0,centre:p}):we(c.mesh)}let l=new n.Matrix4().makeScale(0,0,0),m=new n.Matrix4,f=new n.Vector3;for(let c of t.instanced)for(let d of c.meshes){for(let p of d.userData.highlights??[])d.parent?.remove(p);d.userData.highlights=[];let h=d.userData.saved??=new Map;for(let p=0;p<c.pands.length;p++){h.has(p)?m.copy(h.get(p)):d.getMatrixAt(p,m);let y=s(c.pands[p])?"highlight":this.focus&&o.desaturate&&a(u(f.setFromMatrixPosition(m)))?"dim":"plain";if(y!=="plain"){let b=d.material?.userData?.cityVariant,g=o.keepMaterials||y==="dim"?d.material:b?r.highlighted(d.material,!0):Bs(n,d.material),x=new n.Mesh(d.geometry,g);x.matrixAutoUpdate=!1,x.matrix.copy(m),x.name=`recipe-tile/${y}`,o.keepMaterials&&_n(n,x,y,{cityVariant:(O,k)=>k==="dim"?r.dimmed(O,!0):O}),d.parent.add(x),d.userData.highlights.push(x),h.set(p,m.clone()),d.setMatrixAt(p,l)}else h.has(p)&&(d.setMatrixAt(p,h.get(p)),h.delete(p))}d.instanceMatrix.needsUpdate=!0}}inspectAtScreen(t,n,r,o){let s=this.host.THREE;if(!this.clipFromWorld||!r||!o||!this.root.children.length)return null;let a=t/r*2-1,i=1-n/o*2,u=this.clipFromWorld.clone().invert(),l=new s.Vector3(a,i,-1).applyMatrix4(u),m=new s.Vector3(a,i,1).applyMatrix4(u);this.root.updateWorldMatrix(!0,!0);let f=new s.Raycaster(l,m.sub(l).normalize());for(let c of f.intersectObject(this.root,!0)){let d=c.object.userData?.recipeTile,h=d&&this.tiles.get(d.tile);if(!h?.ready||!c.object.visible)continue;let p=d.ranges?it(d.ranges,c.faceIndex):d.pands?.[c.instanceId??-1]??-1;if(p<0)continue;let y=c.point.clone().applyMatrix4(this.clipFromWorld).z;if(y<-1||y>1)continue;let b=h.meta.pands[p],g=c.point.clone().applyMatrix4(this.root.matrixWorld.clone().invert()),x=ar(g.x,g.y);return{id:/^\d{16}$/.test(b)?Ce(b):b,name:h.meta.names[p]??b,depth:y,lngLat:x,recipeTile:h.id}}return null}stats(){let t=0,n=0,r=0;for(let o of this.tiles.values()){n+=o.triangles;for(let s of o.merged)s.mesh.visible&&t++;for(let s of o.instanced)t+=s.meshes.length||1,r+=s.pands.length}return{tiles:[...this.tiles.keys()].sort(),ready:[...this.tiles.values()].filter(o=>o.ready).length,loading:this.loading,units:this.units.size,draws:t,triangles:n,instances:r,hidden:this.lastHidden?this.lastHidden.split(",").length:0,errors:this.errors.slice(-5)}}dispose(){for(let t of[...this.tiles.values()])this.dropTile(t);this.host.setHidden([]),this.host.setReplacedSpecs?.(new Set),this.unregister?.()}};function Ns(e,t,n,r){let o=new Map,s=t.geometry.getAttribute("position"),a=new e.Vector3;for(let[i,u]of n){let l=0,m=0,f=0;for(let h of u)l+=s.getX(h),m+=s.getY(h),f+=s.getZ(h);let c=Math.max(1,u.length),d=[l/c,m/c,f/c];o.set(i,{local:d,lngLat:r(a.set(...d).applyMatrix4(t.matrix))})}return o}function ar(e,t){let n=e*360-180,r=180-t*360;return[n,360/Math.PI*Math.atan(Math.exp(r*Math.PI/180))-90]}var sr=new WeakMap;function Bs(e,t){let n=sr.get(t);return n||(n=new e.MeshLambertMaterial({color:16765471,emissive:7033856,side:t?.side??e.FrontSide}),sr.set(t,n)),n}function lr(){let e=globalThis;return new URL(e.__canalRecallRecipeTilesBase??"./recipe-tiles/",e.location.href).href}async function Hs(e){let t=globalThis.CanalRecallThree,n=t?.THREE,r=e._sharedFrame??e._ensureSharedFrame?.();if(!n||!r)throw Error("recipe tiles need the shared frame (?sharedFrame=1 is implied by ?recipeTiles=1)");let o=new t.GLTFLoader;t.MeshoptDecoder&&o.setMeshoptDecoder(t.MeshoptDecoder);let s=new Set,a=()=>{let l=e._signatureLandmarks;if(!l||l.__recipeTilesWrapped)return;let m=l.canShowModel.bind(l);l.canShowModel=f=>!s.has(f.id)&&m(f),l.__recipeTilesWrapped=!0},i={THREE:n,frame:r,baseUrl:lr(),lit:!0,cityLook:Zn(n,{anisotropy:globalThis.matchMedia?.("(pointer: coarse)").matches?1:de("slotCells",16).anisotropy}),loadGltf:l=>o.loadAsync(l),getCentre:()=>e.map?.getCenter?.(),setHidden:l=>{let m=e._threeBuildings;return m?.setHidden?(m.setHidden("recipe-tiles",l),e._pyramidalRoofs?.setHiddenReason?.("recipe-tiles",l),!0):!1},setReplacedSpecs:l=>{a(),s=l,e.map?.triggerRepaint?.()},repaint:()=>e.map?.triggerRepaint?.()},u=new fe(i);return globalThis.__canalRecallTileBuildings=u,await u.start(),u}return hr(Gs);})();

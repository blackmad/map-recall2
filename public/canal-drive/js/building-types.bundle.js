"use strict";var CanalRecallBuildingTypes=(()=>{var Ce=Object.defineProperty;var zt=Object.getOwnPropertyDescriptor;var Wt=Object.getOwnPropertyNames;var Vt=Object.prototype.hasOwnProperty;var Yt=(t,e)=>{for(var r in e)Ce(t,r,{get:e[r],enumerable:!0})},jt=(t,e,r,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let o of Wt(e))!Vt.call(t,o)&&o!==r&&Ce(t,o,{get:()=>e[o],enumerable:!(n=zt(e,o))||n.enumerable});return t};var Kt=t=>jt(Ce({},"__esModule",{value:!0}),t);var Sn={};Yt(Sn,{areaAnchor:()=>_e,areaRadiusMetres:()=>Ut,createBuildingTypes:()=>$t,farMassing:()=>Ue,groupByArea:()=>Nt,instanceMatrix:()=>Pe,partitionByDistance:()=>$e,suppressionIds:()=>Ne});var Ae={wallPull:.7,glassLift:.5,liftBrick:!0},ze={wallPull:.35,glassLift:.25,liftBrick:!1},Ln={photo:{cells:"photo",shadeBands:0,flatColour:!1,...Ae,cartoonRoofCells:!1,outline:!1,litWallGain:255/225},procedural:{cells:"procedural",shadeBands:0,flatColour:!1,...Ae,cartoonRoofCells:!1,outline:!1,litWallGain:1},untextured:{cells:"procedural",shadeBands:0,flatColour:!0,...Ae,cartoonRoofCells:!1,outline:!1,litWallGain:1},storybook:{cells:"storybook",shadeBands:0,flatColour:!1,...ze,cartoonRoofCells:!1,outline:!0,litWallGain:1,tone:{hueShift:-4,satMul:1.15,satAdd:0,keepDarkBelow:0,lightMul:1,lightAdd:.03,lightMax:.9}},cartoon:{cells:"cartoon",shadeBands:3,flatColour:!1,...ze,cartoonRoofCells:!0,outline:!0,litWallGain:1,tone:{hueShift:0,satMul:1.7,satAdd:.08,keepDarkBelow:.35,lightMul:1.08,lightAdd:0,lightMax:.85}}};var ee=(t,e,r)=>Math.max(e,Math.min(r,t));function I(t){let e=/^#?([0-9a-f]{6})$/i.exec(t.trim());if(!e)throw Error(`Bad colour ${t}`);let r=parseInt(e[1],16);return[r>>16&255,r>>8&255,r&255]}var B=t=>"#"+t.map(e=>Math.round(ee(e,0,255)).toString(16).padStart(2,"0")).join("");function G([t,e,r]){let n=t/255,o=e/255,c=r/255,a=Math.max(n,o,c),i=Math.min(n,o,c),f=(a+i)/2;if(a===i)return[0,0,f];let s=a-i,u=f>.5?s/(2-a-i):s/(a+i);return[(a===n?(o-c)/s+(o<c?6:0):a===o?(c-n)/s+2:(n-o)/s+4)*60,u,f]}function z([t,e,r]){let n=(1-Math.abs(2*r-1))*e,o=n*(1-Math.abs(t/60%2-1)),c=r-n/2,[a,i,f]=t<60?[n,o,0]:t<120?[o,n,0]:t<180?[0,n,o]:t<240?[0,o,n]:t<300?[o,0,n]:[n,0,o];return[(a+c)*255,(i+c)*255,(f+c)*255]}var We=(t,e,r)=>[t[0]+(e[0]-t[0])*r,t[1]+(e[1]-t[1])*r,t[2]+(e[2]-t[2])*r];var ke={canal:-1/0,c19:1860,school:1915,modern:1945};var le={procedural:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:["#4b525c","#3f464f","#5a6068"]},untextured:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:["#4b525c","#3f464f","#5a6068"]},photo:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:["#4b525c","#3f464f","#5a6068"]},storybook:{tile:["#b9553a","#a94a33","#c46a45"],slate:["#556070","#4a5666","#657282"]},cartoon:{tile:["#e85a3c","#f08a2b","#d94a3a"],slate:["#3f5f8f","#2f4a78","#4f7bb0"]}};var se={gravel:{hex:"#9e9281",luma:[112,156],cell:"flat"},"bitumen-dark":{hex:"#56585e",luma:[62,96],cell:"flat"},"bitumen-light":{hex:"#a99b84",luma:[150,182],cell:"flat"},"white-membrane":{hex:"#d9d9d3",luma:[196,228],cell:"flat"},"pantile-red":{hex:"#b5543a",luma:[84,124],cell:"tile"},"pantile-dark":{hex:"#6a5248",luma:[64,98],cell:"tile"},slate:{hex:"#4b525c",luma:[62,140],cell:"slate"},zinc:{hex:"#9aa1a6",luma:[138,176],cell:"slate"},sedum:{hex:"#7a8350",luma:[96,132],cell:"flat"},solar:{hex:"#2e3a52",luma:[44,70],cell:"flat"},terrace:{hex:"#a38d74",luma:[124,162],cell:"flat"},glass:{hex:"#8fa3ad",luma:[130,170],cell:"flat"}},he={gravel:se.gravel.hex,membrane:se["white-membrane"].hex,bitumen:se["bitumen-dark"].hex,pebble:se["bitumen-light"].hex},Ve=[he.gravel,he.membrane,he.bitumen,he.pebble],te={tile:le.photo.tile,slate:le.photo.slate,flat:Ve};var pe={photo:{canal:["#7a3b2c","#7a3b2c","#6b3428","#8c4632","#9a5846","#b05a40","#4a2e26","#2e2a27","#3e4a40","#5d605a","#e4ddcd"],c19:["#b05a40","#b05a40","#bd6a45","#a24d38","#c58b5e","#d3b184","#e2d5ba","#e2d5ba","#d9c5a4","#9a5846"],school:["#8c4a38","#7a4535","#9a5240","#6e3d33","#a85a3c","#5e3a32","#b0603f"],modern:["#c9b79a","#b9ad9a","#a8a49c","#d3c6ad","#8f8a82","#bfb3a0","#9c7a62","#b05a40"]},storybook:{canal:["#b9583f","#9a4a38","#7a4a3c","#4a5048","#3f4a5a","#ead9b0","#c8664a"],c19:["#c8664a","#d98b5f","#e0b36a","#ead9b0","#d9b995","#c9a08c","#c8664a"],school:["#a8553f","#9a5a48","#b87a5c","#c8664a","#8a4e40"],modern:null},cartoon:{canal:["#d9453d","#a8433a","#3b3b4a","#2a9d8f","#4672b0","#fffaf0","#e8573d"],c19:["#e8573d","#ee7f2c","#f2b92e","#f3e6c8","#d96a4d","#f2b92e"],school:["#d96a4d","#e8573d","#b9583f","#ee7f2c"],modern:null}};var _n={canal:{label:"canal-house centre (before 1860)",wall:pe.photo.canal[0],roof:le.photo.tile[0]},c19:{label:"19th-century ring (1860-1914)",wall:pe.photo.c19[0],roof:le.photo.tile[1]},school:{label:"Amsterdamse School (1915-1944)",wall:pe.photo.school[0],roof:le.photo.slate[0]},modern:{label:"post-war and contemporary (1945+)",wall:pe.photo.modern[0],roof:Ve[0]}};var Ye=["brick","stucco","accent","stone","frame","door","glass","roofTile","slate","bitumen","paint"],je={brick:"brick",accent:"brick",stucco:"stucco",stone:"stone",frame:"frame",door:"door",glass:"glass",roofTile:"tile",slate:"slate",bitumen:"flat",paint:"frame"},N={brick:3.36,stucco:2.4,accent:3.36,stone:1.28,frame:1,door:1,glass:1,roofTile:1.2,slate:1.2,bitumen:1.2,paint:1},ce=[.3,.6],Xt="#f1ede2",qt="#cfc8b8";function Zt(t){let[e,r,n]=G(I(t)),o=ee(.12+n*.9,ce[0],ce[1]);return B(z([e,ee(r,.12,.5),o]))}function Jt(t){let[e,r,n]=G(I(t));return B(z([e,ee(r,0,.55),ee(n*1.06+.03,.4,.97)]))}function Qt(t){let e=I(t),[r,n,o]=G(e);return o>=.5?B(We(e,I(Xt),.75)):B(z([r,n,Math.max(o,.16)]))}function er(t){let[e,r,n]=G(I(t));return B(We(z([e,r,Math.max(n,.62)]),I(qt),.45))}function tr(t){let[e,r,n]=G(I(t));return n>=.17?t.startsWith("#")?t.toLowerCase():"#"+t.toLowerCase():B(z([e,r<.15?0:r,.17]))}function rr(t,e){let r=G(I(e))[2];if(t==="roofTile"){let[n,o]=G(I(e));return o<.2?te.slate[1]:B(z([n,ee(o*1.1,.35,.6),ee(.2+r*.85,.38,.5)]))}return t==="slate"?r<.27?te.slate[1]:r<.31?te.slate[0]:te.slate[2]:r<.4?te.flat[2]:te.flat[0]}function Ie(t,e){switch(t){case"brick":case"accent":return Zt(e);case"stucco":return Jt(e);case"stone":return er(e);case"frame":return Qt(e);case"door":return tr(e);case"glass":return"#ffffff";case"paint":return e.startsWith("#")?e.toLowerCase():"#"+e.toLowerCase();default:return rr(t,e)}}var Ke="#ffd21f",Xe="#ff8033",qe="#b4682c";var nr="highlight",or="__canalRecallHighlight",ar="highlightAccent",ir="__canalRecallHighlightAccent",ue={yellow:{keepMaterials:!1,outline:!1,rim:!1,desaturate:!1,ring:!1,beacon:!1,animated:!1},a:{keepMaterials:!0,outline:!0,rim:!1,desaturate:!1,ring:!0,beacon:!0,animated:!1},b:{keepMaterials:!0,outline:!1,rim:!0,desaturate:!1,ring:!0,beacon:!1,animated:!0},c:{keepMaterials:!0,outline:!1,rim:!1,desaturate:!0,ring:!0,beacon:!1,animated:!1}};var sr=60,q=.4,Qe=2,lr=.3,cr=2.4,ur=.9,fr=2.2;function Ze(t){if(typeof t!="string")return null;let e=t.trim().toLowerCase();return e==="a"||e==="outline"?"a":e==="b"||e==="rim"?"b":e==="c"||e==="desaturate"?"c":e==="yellow"||e==="0"||e==="off"||e==="default"?"yellow":null}function re(t){try{let e=globalThis;if(t===void 0){let r=Ze(e[or]);if(r)return r}return Ze(new URLSearchParams(t??e.location?.search??"").get(nr))??"yellow"}catch{return"yellow"}}function et(t=re(),e){if(t==="yellow")return Ke;try{let r=globalThis,n=(e===void 0?r[ir]:void 0)??new URLSearchParams(e??r.location?.search??"").get(ar);if(n==="hud")return qe;if(typeof n=="string"&&/^#?[0-9a-f]{6}$/i.test(n))return n.startsWith("#")?n:`#${n}`}catch{}return Xe}function tt(t=re()){return ue[t].keepMaterials?{HL_KEEP:""}:{}}var Ee=`
#ifdef HL_KEEP
#define HL_PAINT(h) false
#else
#define HL_PAINT(h) ((h) > 0.5 && (h) < 1.5)
#endif
float hlState(float hidden) { return hidden > 2.5 ? 2.0 : (hidden > 1.5 ? 1.0 : 0.0); }
vec3 hlDesat(vec3 c, float h) { return h > 1.5 ? mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), ${q.toFixed(2)}) : c; }`,mr=110540,dr=t=>111320*Math.cos(t*Math.PI/180);function hr(t,e){let r=(t[1]+e[1])/2;return Math.hypot((t[0]-e[0])*dr(r),(t[1]-e[1])*mr)}var rt=(t,e,r=sr)=>!!t&&hr(t,e)<=r;var pr=`
attribute float hidden;
uniform vec2 hlViewport;
uniform float hlWidthPx;
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
  if (dot(dir, dir) > 1e-12) clip.xy += normalize(dir) * hlWidthPx * 2.0 / hlViewport * clip.w;
#endif
  gl_Position = clip;
}`,gr=`
uniform vec3 hlAccent;
uniform vec3 hlEye;
uniform float hlTime;
uniform float hlHasNormal;
varying vec3 vHlPos;
varying vec3 vHlNormal;
void main() {
#ifdef HL_OUTLINE
  gl_FragColor = vec4(hlAccent, 1.0);
#else
  vec3 n = hlHasNormal > 0.5 ? normalize(vHlNormal) : normalize(cross(dFdx(vHlPos), dFdy(vHlPos)));
  vec3 v = normalize(hlEye - vHlPos);
  float f = pow(1.0 - abs(dot(n, v)), ${fr.toFixed(2)});
  float pulse = 0.775 + 0.225 * sin(hlTime * 6.2831853 / ${cr.toFixed(2)});
  gl_FragColor = vec4(hlAccent * f * ${ur.toFixed(2)} * pulse, 1.0);
#endif
}`,ge="canalRecallHighlightPass",br=(t,e)=>{let[r,n,o]=I(e);return new t.Vector3(r/255,n/255,o/255)};function yr(t,e,r={}){let n={};r.merged&&(n.HL_MERGED=""),e==="outline"&&(n.HL_OUTLINE="");let o=new t.ShaderMaterial({defines:n,uniforms:{hlViewport:{value:new t.Vector2(1,1)},hlWidthPx:{value:Qe},hlCentre:{value:new t.Vector3},hlDepthPush:{value:lr},hlAccent:{value:br(t,r.accent??et())},hlEye:{value:new t.Vector3},hlTime:{value:0},hlHasNormal:{value:1}},vertexShader:pr,fragmentShader:gr,side:e==="outline"?t.BackSide:t.FrontSide,transparent:!0,depthTest:!0,depthWrite:e==="outline",blending:e==="rim"?t.AdditiveBlending:t.NormalBlending,polygonOffset:e==="rim",polygonOffsetFactor:-1,polygonOffsetUnits:-2});return o.name=`highlight/${e}${r.merged?"/merged":""}`,o.userData={[ge]:!0},o.defaultAttributeValues={hidden:[0],normal:[0,0,0]},o}function xr(t){for(let e of t?.userData?.[ge]??[])t.remove(e),e.material.dispose();t?.userData&&delete t.userData[ge]}function nt(t,e,r={}){xr(e);let n=ue[r.style??re()],o=[...n.outline?["outline"]:[],...n.rim?["rim"]:[]];if(!o.length||!e?.geometry)return[];let c=e.geometry,a=r.centre;if(!a){c.boundingBox||c.computeBoundingBox?.();let h=c.boundingBox?.getCenter(new t.Vector3);a=h?[h.x,h.y,h.z]:[0,0,0]}let i=c.getAttribute?.("normal")?1:0,f=[],s=new t.Matrix4,u=new t.Vector4,l=new t.Vector2;for(let h of o){let d=yr(t,h,{merged:r.merged,accent:r.accent??et(r.style)});d.uniforms.hlCentre.value.set(a[0],a[1],a[2]),d.uniforms.hlHasNormal.value=i;let p=e.isInstancedMesh?new t.InstancedMesh(c,d,e.count):new t.Mesh(c,d);e.isInstancedMesh&&(p.instanceMatrix=e.instanceMatrix),p.name=`${e.name||"mesh"}/highlight-${h}`,p.frustumCulled=!1,p.castShadow=p.receiveShadow=!1,p.renderOrder=(e.renderOrder??0)+1,p.raycast=()=>{},p.onBeforeRender=(x,M,R)=>{e.isInstancedMesh&&(p.count=e.count),p.visible=e.visible;let y=d.uniforms;x.getDrawingBufferSize(l),y.hlViewport.value.copy(l);let k=x.domElement?.clientWidth||l.x;y.hlWidthPx.value=Qe*(l.x/k),s.multiplyMatrices(R.projectionMatrix,R.matrixWorldInverse).multiply(p.matrixWorld).invert(),u.set(0,0,1,0).applyMatrix4(s),Math.abs(u.w)>1e-12&&y.hlEye.value.set(u.x/u.w,u.y/u.w,u.z/u.w),y.hlTime.value=performance.now()/1e3,d.uniformsNeedUpdate=!0},e.add(p),f.push(p)}return e.userData??={},e.userData[ge]=f,f}var Je=new WeakMap;function Oe(t,e,r,n=re()){if(!e||r==="plain"||r==="highlight"&&ue[n].keepMaterials)return e;let o=Je.get(e);o||Je.set(e,o=new Map);let c=`${r}|${n}`,a=o.get(c);if(a)return a;if(r==="highlight")a=new t.MeshLambertMaterial({color:16765471,emissive:7033856,side:e.side??t.FrontSide});else if(e.isShaderMaterial&&e.uniforms?.tint?.value?.isVector3)a=e.clone(),a.uniforms={...e.uniforms,tint:{value:Mr(e.uniforms.tint.value.clone())}};else if(e.isShaderMaterial)a=e.clone(),a.uniforms=e.uniforms,a.defines={...e.defines??{},HL_DIM_ALL:""};else{if(a=e.clone(),a.color){let i=a.color,f=.2126*i.r+.7152*i.g+.0722*i.b;i.setRGB(i.r+(f-i.r)*q,i.g+(f-i.g)*q,i.b+(f-i.b)*q)}if(a.map){let i=a.onBeforeCompile;a.onBeforeCompile=(f,s)=>{i?.call(a,f,s),f.fragmentShader=f.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${q.toFixed(2)});`)},a.customProgramCacheKey=()=>`${e.customProgramCacheKey?.()??""}|hl-dim`}}return a.name=`${e.name||"material"}/${r}`,a.userData={...e.userData??{},highlightVariantOf:e},o.set(c,a),a}function Mr(t){let e=.2126*t.x+.7152*t.y+.0722*t.z;return t.set(t.x+(e-t.x)*q,t.y+(e-t.y)*q,t.z+(e-t.z)*q)}var ot="inferred",wr=t=>G(I(t))[1]<.2,vr=t=>{let[e,r,n]=G(I(t));return(e<45||e>340)&&r>=.15&&n<.7},Sr=t=>wr(t)?"slate":"roofTile",Fe=t=>vr(t)?"brick":"stucco",Rr=[{test:/glass|glaz|window|vitr|ruit|pane/,slot:"glass",confidence:"name",rule:"glazing name"},{test:/decal|sign|mural|logo|letter|clock|dial/,slot:"paint",confidence:"name",rule:"signage / decal"},{test:/door|deur|gate/,slot:"door",confidence:"name",rule:"door name"},{test:/frame|kozijn|louvre|louver|blind|shutter|rail|mullion|sash/,slot:"frame",confidence:"name",rule:"joinery name"},{test:/brick|baksteen|klinker|terracotta/,slot:"brick",confidence:"name",rule:"brick name"},{test:/slate|leien|lei$/,slot:"slate",confidence:"name",rule:"slate name"},{test:/bitumen|asphalt|tar$|felt|flatroof|flat-roof|gravel/,slot:"bitumen",confidence:"name",rule:"flat roof name"},{test:/roof|tile|pantile|dakpan|dak/,slot:Sr,confidence:"name",rule:"roof name, grey \u2192 slate, else pantile"},{test:/sandstone|stone|steen|column|marble|granite|limestone|plinth/,slot:"stone",confidence:"name",rule:"stone name"},{test:/stucco|render|plaster|pleister|concrete|beton|slab/,slot:"stucco",confidence:"name",rule:"render / concrete name"},{test:/gold|gilt|bronze|copper|brass|zinc|metal|steel|iron|lead|alu/,slot:"paint",confidence:"name",rule:"metal name (flat colour)"},{test:/wall|facade|gevel/,slot:Fe,confidence:"name",rule:"wall name, brick hue \u2192 brick, else stucco"},{test:/ochre|yellow|buff/,slot:Fe,confidence:"colour-word",rule:"ochre: yellow brick (brick hue) or render"},{test:/pink|rose/,slot:"stucco",confidence:"colour-word",rule:"pink: painted render"},{test:/moss|grass|green|blue|orange|purple|paint|teal/,slot:"paint",confidence:"colour-word",rule:"coloured paint word"},{test:/white|cream|ivory/,slot:"stucco",confidence:"colour-word",rule:"white: stucco (could be white trim)"},{test:/dark|black|charcoal|anthracite/,slot:"frame",confidence:"colour-word",rule:"dark: painted joinery / ironwork (could be a dark wall)"},{test:/red/,slot:Fe,confidence:"colour-word",rule:"red: brick hue \u2192 brick (could be red tile or paint)"},{test:/grey|gray/,slot:"stucco",confidence:"colour-word",rule:"grey: render (could be concrete or zinc)"}];function at(t){return String(t??"").toLowerCase().replace(/[-_.\s]*\d+$/,"").trim()}function Lr(t){let[e,r,n]=G(I(t));return n<.22?{slot:"frame",rule:"very dark: joinery / ironwork"}:r>=.15&&(e<45||e>340)&&n<.62?{slot:"brick",rule:"brick hue"}:r<.2&&n>=.6?{slot:"stucco",rule:"pale neutral: render"}:r<.2&&n>=.22&&e>180&&e<260?{slot:"slate",rule:"blue-grey: slate"}:r<.25?{slot:"stone",rule:"neutral mid-tone: stone"}:{slot:"paint",rule:"saturated colour: paint"}}function it(t,e){let r=e.toLowerCase(),n=at(t);for(let c of Rr)if(c.test.test(n))return{slot:typeof c.slot=="function"?c.slot(r):c.slot,tint:r,confidence:c.confidence,rule:c.rule};let o=Lr(r);return{slot:o.slot,tint:r,confidence:"colour",rule:`no material word in "${n||"unnamed"}"; ${o.rule}`}}var st=t=>/white|cream|ivory/.test(at(t)),lt=t=>typeof t=="string"&&Ye.includes(t);var ct=["canal","c19","school","postwar","modern","tower"];var Tr=8;var Jn=16+Math.log2(Tr);var C=256,Cr=["upper","ground","door","plain","shop"],Ar=2;var ro=ct.length*Ar*Cr.length;var P=t=>[1,3,5].map(e=>parseInt(t.slice(e,e+2),16));var no=P("#7d93a0"),oo=P("#1f2a33");var ao=P("#b8ad98"),io=P("#cfc6b4"),so=P("#ece8dd"),lo=P("#e2d9c2"),co=[P("#2c4a3d"),P("#3a2a22"),P("#1f3b57"),P("#5a2a24")],uo=[P("#2f4a3a"),P("#7a2f27"),P("#27384f")];var ut=.6;function be(t,e,r){let n=Math.imul(t|0,374761393)^Math.imul(e|0,668265263)^Math.imul(r|0,2246822519);return n=Math.imul(n^n>>>13,1274126177),((n^n>>>16)>>>0)/4294967296}function ft(t,e){let r=0;for(let o=0;o<t.length;o+=4)r+=t[o];let n=r/(t.length/4);for(let o=0;o<t.length;o+=4){let c=Math.round(Math.max(0,Math.min(255,n+(t[o]-n)*e)));t[o]=t[o+1]=t[o+2]=c}}function mt(t,e){let r=new Uint8ClampedArray(C*C*4),n=(o,c,a,i,f)=>{let s=(c*C+o)*4,u=f??[a,a,a];r[s]=u[0],r[s+1]=u[1],r[s+2]=u[2],r[s+3]=i};if(t==="flat")for(let o=0;o<C;o++)for(let c=0;c<C;c++)n(c,o,Math.round((e?.96:.9+(be(c>>3,o>>3,3)-.5)*.08)*255),255);else if(t==="tile"){let a=C/8,i=C/5;for(let f=0;f<C;f++)for(let s=0;s<C;s++){let u=Math.floor(f/a),l=f%a/a,h=(s+u%2*i*.5)%C,d=Math.floor(h/i),p=h%i/i,x=Math.sin(p*Math.PI),M=e?.92:.7+.22*x-.28*Math.pow(Math.max(0,1-l*3.2),1.5)*0-.22*Math.max(0,(.18-l)/.18);e||(M+=(be(d,u,7)-.5)*.14);let R=e?l<.07||p<.035||p>.965:!1;n(s,f,Math.round(Math.max(0,Math.min(1,R?.28:M))*255),255)}e||ft(r,ut)}else if(t==="slate"){let a=C/11,i=C/6;for(let f=0;f<C;f++)for(let s=0;s<C;s++){let u=Math.floor(f/a),l=f%a/a,h=(s+u%2*i*.5)%C,d=Math.floor(h/i),p=h%i/i,x=e?.9:.82+(be(d,u,11)-.5)*.16-.16*Math.max(0,(.16-l)/.16);(p<(e?.05:.025)||l<(e?.09:.04))&&(x=e?.3:x*.7),n(s,f,Math.round(Math.max(0,Math.min(1,x))*255),255)}e||ft(r,ut)}else for(let f=0;f<C;f++)for(let s=0;s<C;s++){let u=s/C,l=f/C,h=u>.2-.06&&u<.8+.06&&l>.2-.06&&l<.82+.06,d=u>.2+.03&&u<.8-.03&&l>.2+.03&&l<.82-.03,p=Math.abs(u-.5)<.018||Math.abs(l-.5)<.018;if(d&&!p){let x=(l-.2)/.6199999999999999,M=e?[150+60*x,200+30*x,235]:[40+80*x*x,55+90*x*x,68+90*x*x];n(s,f,0,0,[M[0],M[1],M[2]])}else if(h)n(s,f,0,0,e?[255,250,240]:[236,232,221]);else{let x=e?.92:.85+(be(s>>3,f>>3,5)-.5)*.12,M=e&&(s<5||f<5||s>C-6||f>C-6);n(s,f,Math.round((M?.3:x)*255),255)}}return r}function dt(t,e){let n=t.createElement("canvas");n.width=n.height=336;let o=n.getContext("2d",{willReadFrequently:!0});if(e)for(let s=0;s<336;s+=112)for(let u=0;u<336;u+=112)o.drawImage(e,u,s,112,112);else{let s=7,u=()=>(s=s*16807%2147483647)/2147483647;for(let l=0,h=0;h<336;h+=14,l++)for(let d=-(l%2)*24;d<336;d+=48){let p=150+u()*50;o.fillStyle=`rgb(${p},${p*.92},${p*.86})`,o.fillRect(d,h,48,14)}}o.strokeStyle="rgba(235,223,205,0.18)",o.lineWidth=1.7;for(let s=0,u=6;u<336;u+=14,s++){o.beginPath(),o.moveTo(0,u),o.lineTo(336,u),o.stroke();for(let l=s%2*24;l<336;l+=48)o.beginPath(),o.moveTo(l,u),o.lineTo(l,u+14),o.stroke()}let c=o.getImageData(0,0,336,336),a=c.data,i=0;for(let s=0;s<a.length;s+=4)i+=(a[s]+a[s+1]+a[s+2])/3;i/=a.length/4;let f=i>0?Math.min(2.4,225/i):1;for(let s=0;s<a.length;s+=4){let u=(a[s]+a[s+1]+a[s+2])/3,l=Math.min(255,(u+(i-u)*.7)*f);a[s]=a[s+1]=a[s+2]=l,a[s+3]=255}return o.putImageData(c,0,0),n}function ht(t){let e=t.createElement("canvas");e.width=64,e.height=128;let r=e.getContext("2d"),n=r.createLinearGradient(0,0,0,128);return n.addColorStop(0,"#8aa1b0"),n.addColorStop(.5,"#4d606c"),n.addColorStop(1,"#3c474e"),r.fillStyle=n,r.fillRect(0,0,64,128),r.fillStyle="rgba(235,242,248,0.16)",r.beginPath(),r.moveTo(10,0),r.lineTo(34,0),r.lineTo(4,70),r.lineTo(-20,70),r.closePath(),r.fill(),e}function pt(t){let e=t.createElement("canvas");e.width=e.height=128;let r=e.getContext("2d");r.fillStyle="#ffffff",r.fillRect(0,0,128,128),r.fillStyle="rgba(0,0,0,0.10)";for(let n=0;n<128;n+=16)r.fillRect(n,0,1.5,128);return e}function gt(t){let e=t.createElement("canvas");e.width=e.height=128;let r=e.getContext("2d"),n=r.createImageData(128,128),o=23,c=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++){let i=(c()-.5)*3;for(let f=0;f<128;f++){let s=(a*128+f)*4,u=c()<.012?-14:0,l=243+(c()-.5)*8+i+u;n.data[s]=n.data[s+1]=n.data[s+2]=l,n.data[s+3]=255}}return r.putImageData(n,0,0),e}function bt(t){let e=t.createElement("canvas");e.width=e.height=128;let r=e.getContext("2d"),n=r.createImageData(128,128),o=11,c=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<n.data.length;a+=4){let i=228+(c()-.5)*16;n.data[a]=n.data[a+1]=n.data[a+2]=i,n.data[a+3]=255}return r.putImageData(n,0,0),r.fillStyle="rgba(80,70,60,0.18)",r.fillRect(0,0,128,1.5),e}function ye(t,e){let r=mt(e,!1),n=Math.round(Math.sqrt(r.length/4)),o=t.createElement("canvas");o.width=o.height=n;let c=o.getContext("2d"),a=c.createImageData(n,n);for(let i=0;i<r.length;i+=4)a.data[i]=r[i],a.data[i+1]=r[i+1],a.data[i+2]=r[i+2],a.data[i+3]=255;return c.putImageData(a,0,0),o}var kr=238;function yt(t,e){let n=t.createElement("canvas");n.width=n.height=336;let o=n.getContext("2d",{willReadFrequently:!0});if(e)for(let s=0;s<336;s+=112)for(let u=0;u<336;u+=112)o.drawImage(e,u,s,112,112);else{let s=13,u=()=>(s=s*16807%2147483647)/2147483647;for(let l=0,h=0;h<336;h+=14,l++)for(let d=-(l%2)*24;d<336;d+=48){let p=165+u()*30;o.fillStyle=`rgb(${p},${p*.93},${p*.88})`,o.fillRect(d,h,48,14)}}o.strokeStyle="rgba(245,240,230,0.26)",o.lineWidth=1.2;for(let s=0,u=6;u<336;u+=14,s++){o.beginPath(),o.moveTo(0,u),o.lineTo(336,u),o.stroke();for(let l=s%2*24;l<336;l+=48)o.beginPath(),o.moveTo(l,u),o.lineTo(l,u+14),o.stroke()}let c=o.getImageData(0,0,336,336),a=c.data,i=0;for(let s=0;s<a.length;s+=4)i+=(a[s]+a[s+1]+a[s+2])/3;i/=a.length/4;let f=i>0?Math.min(2.6,kr/i):1;for(let s=0;s<a.length;s+=4){let u=(a[s]+a[s+1]+a[s+2])/3,l=Math.min(255,(u+(i-u)*.82)*f);a[s]=a[s+1]=a[s+2]=l,a[s+3]=255}return o.putImageData(c,0,0),n}function xt(t){let e=t.createElement("canvas");e.width=e.height=128;let r=e.getContext("2d"),n=r.createImageData(128,128),o=31,c=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++)for(let i=0;i<128;i++){let f=(a*128+i)*4,s=246+(c()-.5)*3;n.data[f]=n.data[f+1]=n.data[f+2]=s,n.data[f+3]=255}return r.putImageData(n,0,0),e}function Mt(t){let e=t.createElement("canvas");e.width=e.height=4;let r=e.getContext("2d");return r.fillStyle="#fff",r.fillRect(0,0,4,4),e}var wt=[-1,-1];var vt=[-1,-1],St=()=>[70,190,.5],xe=t=>Number.isInteger(t)?t.toFixed(1):String(t),Rt=`
uniform vec2 roofLayers;
uniform vec3 roofTier;
vec3 roofTierColour(vec3 fine, vec2 uv, float layer, float dist) {
  if (roofLayers.x < 0.0 || layer < roofLayers.x - 0.5 || layer > roofLayers.y - 0.5) return fine;
  float mid = smoothstep(roofTier.x - ${xe(15)}, roofTier.x + ${xe(15)}, dist);
  if (mid <= 0.0) return fine;
  float far = smoothstep(roofTier.y - ${xe(40)}, roofTier.y + ${xe(40)}, dist);
  vec3 coarse = texture(cells, vec3(uv * roofTier.z, layer)).rgb;
  vec3 flatMean = textureLod(cells, vec3(uv, layer), 8.0).rgb;
  return mix(mix(fine, coarse, mid), flatMean, far);
}`,Lt=`
uniform vec2 cellTier;
void cellTierSample(vec3 p, float dist, out vec3 c, out vec2 m) {
  c = texture(cells, p).rgb; m = texture(masks, p).rg;
  if (cellTier.x < 0.0) return;
  float rho = max(length(dFdx(p.xy)), length(dFdy(p.xy))) * float(textureSize(cells, 0).x);
  float far = smoothstep(cellTier.x, cellTier.y, rho);
  if (far <= 0.0) return;
  c = mix(c, textureLod(cells, p, 8.0).rgb, far); m = mix(m, textureLod(masks, p, 8.0).rg, far);
}`;var De={sunAzimuthDeg:215,sunElevationDeg:40,sunColour:"#ffe9cc",sunIntensity:2.15,skyColour:"#e3ebf6",groundColour:"#998a72",skyIntensity:1.75,shadows:!0,shadowMapSize:2048};function Ir(t,e){let r=t*Math.PI/180,n=e*Math.PI/180;return[Math.sin(r)*Math.cos(n),Math.cos(r)*Math.cos(n),Math.sin(n)]}var vo=Ir(De.sunAzimuthDeg,De.sunElevationDeg),we=(()=>{let t=De.sunAzimuthDeg*Math.PI/180;return[Math.sin(t),Math.cos(t)]})(),Me=[we[0]*.6,we[1]*.6,.8],_t=.84;function Er(t){let e=t[0]*Me[0]+t[1]*Me[1]+t[2]*Me[2];return Math.max(.5,Math.min(1,.58+.42*Math.max(0,e)))}var So=Er([0,0,1]),fe=t=>Number.isInteger(t)?t.toFixed(1):String(+t.toFixed(6)),ve=`
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = ${fe(_t)} + ${fe(1-_t)} * (0.5 + 0.5 * dot(h, vec2(${fe(we[0])}, ${fe(we[1])}))); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, dot(n, vec3(${Me.map(fe).join(", ")}))), 0.5, 1.0);`;var Y=.9,me=255/225,Or=255/228,Fr=255/243,Dr=255/246,Le=[{cell:"brick",tileM:N.brick,clampUv:!1,litGain:me*Y,skyTint:!1},{cell:"stucco",tileM:N.stucco,clampUv:!1,litGain:Fr*Y,skyTint:!1},{cell:"stone",tileM:N.stone,clampUv:!1,litGain:Or*Y,skyTint:!1},{cell:"white",tileM:1,clampUv:!1,litGain:1,skyTint:!1},{cell:"door",tileM:N.door,clampUv:!1,litGain:1,skyTint:!1},{cell:"glass",tileM:N.glass,clampUv:!0,litGain:1,skyTint:!0},{cell:"tile",tileM:N.roofTile,clampUv:!1,litGain:me*Y,skyTint:!1},{cell:"slate",tileM:N.slate,clampUv:!1,litGain:me*Y,skyTint:!1},{cell:"flat",tileM:N.bitumen,clampUv:!1,litGain:me*Y,skyTint:!1},{cell:"brick20",tileM:N.brick,clampUv:!1,litGain:me*Y,skyTint:!1},{cell:"whiteStucco",tileM:N.stucco,clampUv:!1,litGain:Dr*Y,skyTint:!1}],Re=Le.length,Se=Object.fromEntries(Le.map((t,e)=>[t.cell,e])),Br=ke.school;function It(t,e={}){let r=je[t];return r==="brick"&&typeof e.year=="number"&&e.year>=Br?Se.brick20:r==="stucco"&&e.white?Se.whiteStucco:r==="frame"?Se.white:Se[r]}function Gr(){return Le.map(t=>[1/t.tileM,t.clampUv?1:0,t.litGain,t.skyTint?1:0])}var Hr=.38,Pr=.8,Nr=.75,Ur=.5,$r=.12,zr=(t,e)=>(t<45||t>340)&&e>=.2;function Wr(t,e){let r=I(e),[n,o,c]=G(r);return t==="slate"&&zr(n,o)?Ie("roofTile",e):(t==="brick"||t==="accent")&&o<$r?B(z([n,o,Math.min(ce[1],Math.max(ce[0],.12+c*.9))])):t==="slate"&&c>Hr?B(z([n,Math.min(o,.12),Math.min(.72,c/Pr)])):t==="frame"&&c>=.5&&c<Nr?B(r):t==="stone"&&c<Ur?B(r):Ie(t,e)}function Vr(t,e){let[r,n,o]=I(Wr(t,e));return[r,n,o,255]}function Yr(t,e,r){switch(e){case"brick":return dt(t,r);case"brick20":return yt(t,r);case"stucco":return gt(t);case"whiteStucco":return xt(t);case"stone":return bt(t);case"white":case"frame":return Mt(t);case"door":return pt(t);case"glass":return ht(t);case"tile":return ye(t,"tile");case"slate":return ye(t,"slate");case"flat":return ye(t,"flat")}}function jr(t,e,r){let n=r*r,o=new Uint8Array(n*4*Re),c=new Uint8Array(n*2*Re),a=t.createElement("canvas");a.width=a.height=r;let i=a.getContext("2d",{willReadFrequently:!0});return i.imageSmoothingQuality="high",Le.forEach((f,s)=>{i.clearRect(0,0,r,r),i.drawImage(Yr(t,f.cell,e),0,0,r,r);let u=i.getImageData(0,0,r,r).data;for(let l=0;l<r;l++)for(let h=0;h<r;h++){let d=((r-1-l)*r+h)*4,p=s*n+l*r+h;o[p*4]=u[d],o[p*4+1]=u[d+1],o[p*4+2]=u[d+2],o[p*4+3]=255,c[p*2]=255,c[p*2+1]=0}}),{colour:o,mask:c}}async function Kr(t=document){let e=new Image;e.src=new URL("materials/ambientcg/Bricks057/colour.jpg",t.baseURI).href;try{return await e.decode(),e}catch{return null}}var Be=t=>`${t.lit?"lit":"unlit"}|${t.kind}|${t.kind==="slot"?t.uv??"uv":"-"}|${t.highlight?"hl":t.dim?"dim":"-"}|${t.side??0}`;function Xr(t){let e={CITY_SLOT_COUNT:String(Re)};return t.kind==="slot"&&(e.CITY_SLOT=""),t.kind==="slot"&&t.uv==="box"&&(e.CITY_BOX_UV=""),t.highlight?e.CITY_HIGHLIGHT="":t.dim&&(e.CITY_DIM=""),{...e,...tt()}}var qr="vec3(1.0, 0.824, 0.122)",Tt="vec3(1.0, 0.637, 0.0137)",Ct="vec3(0.035, 0.05, 0.07)",Zr=1,Jr=.2,Qr=.75,en=1.8,ne=t=>Number.isInteger(t)?t.toFixed(1):String(t),tn=`
float cityGrain(vec3 cell) {
  float g = clamp(dot(cell, vec3(0.299, 0.587, 0.114)) / ${ne(225/255)}, 0.45, 1.1);
  return mix(1.0, g, ${ne(Qr)});
}`,Et=`
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
${Ee}`,Ot=`
vTint = tint.rgb; vAccent = accent.rgb;
vHighlight = hlState(hidden);
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
  #ifdef CITY_BOX_UV
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
#endif`,Ft=`
vFacDist = length((modelViewMatrix * vec4(position, 1.0)).xyz);
if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`,Dt=`
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${Rt}
${Lt}
varying vec2 vFacUv;
flat varying float vLayer;
flat varying vec4 vSlot;
varying vec3 vTint;
varying vec3 vAccent;
flat varying float vHighlight;
varying float vFacDist;
${tn}
${Ee}`,Bt=`
if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;`,Gt=`
vec2 cityUv = vSlot.y > 0.5 ? clamp(vFacUv, 0.0, 1.0) : vFacUv;
vec3 cityP = vec3(cityUv, vLayer);
vec3 cityC; vec2 cityM;
#ifdef CITY_SLOT
cityC = texture(cells, cityP).rgb; cityM = texture(masks, cityP).rg;
#else
cellTierSample(cityP, vFacDist, cityC, cityM);
cityC = roofTierColour(cityC, cityUv, vLayer, vFacDist);
#endif
float cityG = cityGrain(cityC);
cityC *= mix(vec3(1.0), vTint, cityM.r) * mix(vec3(1.0), vAccent, cityM.g);`,rn=`
uniform mat3 enuFromWorld;
${Et}
varying float vShade;
void main() {
${Ot}
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
${ve}
  vShade = shade;
#else
  vShade = tint.a;
#endif
${Ft}
}`,nn=`
precision highp float;
${Dt}
varying float vShade;
void main() {
${Bt}
${Gt}
  if (HL_PAINT(vHighlight)) {
    float hlShade = clamp(1.0 - (1.0 - vShade) * ${ne(en)}, 0.6, 1.0);
    gl_FragColor = vec4(${qr} * (flatColour > 0.5 ? 1.0 : cityG) * hlShade, 1.0);
    return;
  }
  if (flatColour > 0.5) cityC = vTint;
  cityC = hlDesat(cityC, vHighlight);
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  gl_FragColor = vec4(cityC * shade, 1.0);
}`;function on(t,e={}){return{cells:e.cells??{value:null},masks:e.masks??{value:null},slotBase:e.slotBase??{value:0},slotParams:e.slotParams??{value:Gr().map(r=>new t.Vector4(...r))},bands:e.bands??{value:0},flatColour:e.flatColour??{value:0},cityFade:e.cityFade??{value:1},wallGain:e.wallGain??{value:1},roofLayers:e.roofLayers??{value:vt},roofTier:e.roofTier??{value:St()},cellTier:e.cellTier??{value:wt},enuFromWorld:e.enuFromWorld??{value:new t.Matrix3}}}var an={accent:[1,1,1,1],hidden:[0],color:[1,1,1],uv:[0,0],uv1:[0,0]},Ge="recipeLookShared";function sn(t,e,r){let n=Xr(e),o=e.side??t.FrontSide,c;return e.lit?(c=new t.MeshLambertMaterial({side:o,flatShading:e.kind==="chunk"}),c.defines={...c.defines??{},...n},c.onBeforeCompile=a=>{for(let i of Object.keys(r))a.uniforms[i]=r[i];a.vertexShader=a.vertexShader.replace("#include <common>",`#include <common>${Et}`).replace("#include <begin_vertex>",`#include <begin_vertex>${Ot}`).replace("#include <project_vertex>",`#include <project_vertex>${Ft}`),a.fragmentShader=a.fragmentShader.replace("#include <common>",`#include <common>${Dt}
float cityLuma;`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>${Bt}`).replace("#include <map_fragment>",`${Gt}
#ifdef CITY_SLOT
cityC *= vSlot.z;
#else
cityC *= mix(1.0, wallGain * ${ne(Y)}, cityM.r);
#endif
if (flatColour > 0.5) cityC = vTint;
cityLuma = dot(cityC, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= HL_PAINT(vHighlight) ? ${Tt} * ${ne(Zr)} * pow(flatColour > 0.5 ? 1.0 : cityG, 2.2) : pow(hlDesat(cityC, vHighlight), vec3(2.2));`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
if (HL_PAINT(vHighlight)) totalEmissiveRadiance += ${Tt} * ${ne(Jr)};
#ifdef CITY_SLOT
else totalEmissiveRadiance += ${Ct} * vSlot.w;
#else
// Bay glazing (dark, untinted texels): the same constant sky tint as landmark glass, never a hotspot.
else totalEmissiveRadiance += ${Ct} * (1.0 - smoothstep(0.06, 0.2, cityLuma)) * (1.0 - cityM.r);
#endif`)},c.customProgramCacheKey=()=>`city-look-v3|${Be({...e,side:0})}`,c.uniforms=r):c=new t.ShaderMaterial({uniforms:r,defines:n,vertexShader:rn,fragmentShader:nn,side:o}),c.defaultAttributeValues={...an},c.name=`city-look/${Be(e)}`,c.userData={cityLook:!0,cityVariant:{...e},[Ge]:!0},c}function ln(t){return t?t.isMeshBasicMaterial||t.userData?.unlit?"unlit (decal / emissive sign)":t.transparent||(t.opacity??1)<1?"transparent":t.vertexColors?"vertex colours":t.map?"own texture":null:"no material"}function cn(t,e){let r=t?.userData??{};if(lt(r.materialSlot)&&typeof r.tint=="string")return{slot:r.materialSlot,tint:r.tint,inferred:r.materialSlotSource===ot};if(!e||ln(t)||!t.color)return null;let n="#"+t.color.getHexString(),o=it(t.name,n);return{slot:o.slot,tint:o.tint,inferred:!0}}function At(t,e,r,n,o={}){let c=e.getAttribute("position")?.count??0,a=It(r,o),i=Vr(r,n),f=e.getAttribute("layer"),s=e.getAttribute("tint");if(f&&s)return f.getX(0)===a&&Math.round(s.getX(0)*255)===i[0]&&Math.round(s.getY(0)*255)===i[1]&&Math.round(s.getZ(0)*255)===i[2];e.setAttribute("layer",new t.BufferAttribute(new Uint8Array(c).fill(a),1,!1));let u=new Uint8Array(c*4);for(let l=0;l<c;l++)u.set(i,l*4);return e.setAttribute("tint",new t.BufferAttribute(u,4,!0)),!0}var un="__canalRecallCityLookShared";function Ht(t,e={}){let r=globalThis,n=r[un]??=new Map,o=n.get(t);return o||n.set(t,o=fn(t,e)),o}function fn(t,e={}){let r=e.document??globalThis.document,n=e.size??(globalThis.matchMedia?.("(pointer: coarse)").matches?128:256),o=on(t),c=new Map,a=null,i=!1,f=(l,h)=>{let d=new t.DataArrayTexture(l,n,n,Re);return d.format=h,d.type=t.UnsignedByteType,d.wrapS=d.wrapT=t.RepeatWrapping,d.minFilter=t.LinearMipmapLinearFilter,d.magFilter=t.LinearFilter,d.generateMipmaps=!0,d.anisotropy=e.anisotropy??4,d.unpackAlignment=1,d.needsUpdate=!0,d.userData={bytes:l.byteLength,[Ge]:!0},d},s=(async()=>{if(!r)return;let l=e.brick!==void 0?e.brick:await Kr(r),{colour:h,mask:d}=jr(r,l,n);a={colour:f(h,t.RGBAFormat),mask:f(d,t.RGFormat)},i||(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)})(),u=l=>{let h=Be(l),d=c.get(h);return d||c.set(h,d=sn(t,l,o)),d};return{uniforms:o,ready:s,material:u,dress(l,{lit:h,infer:d=!1,year:p=null}){let x=0;return l.traverse(M=>{if(!M.isMesh||Array.isArray(M.material)||M.material?.userData?.cityLook)return;let R=cn(M.material,d);if(!R)return;let y=M.geometry;if(!y?.getAttribute("position"))return;let k=!!y.getAttribute("uv");!k&&!y.getAttribute("normal")&&y.computeVertexNormals();let W={year:p,white:R.inferred&&st(M.material.name)};At(t,y,R.slot,R.tint,W)||(y=M.geometry=y.clone(),y.deleteAttribute("layer"),y.deleteAttribute("tint"),At(t,y,R.slot,R.tint,W));let v=M.material;M.material=u({lit:h,kind:"slot",uv:k?"uv":"box",side:v.side}),M.userData.citySlot={slot:R.slot,tint:R.tint,inferred:R.inferred,from:v.name,layer:It(R.slot,W)},v.userData?.[Ge]||v.dispose(),x++}),x},highlighted(l,h){let d=l?.userData?.cityVariant;return d?u({...d,highlight:h,dim:!1}):l},dimmed(l,h){let d=l?.userData?.cityVariant;return d?u({...d,highlight:!1,dim:h}):l},bindAtlas(l){i=!!l,l?(o.cells.value=l.colour,o.masks.value=l.mask,o.slotBase.value=l.slotBase):a&&(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)},textureBytes(){return a&&!i?Math.round((a.colour.userData.bytes+a.mask.userData.bytes)*4/3):0}}}var mn=2*Math.PI*6378137;function Pt(t,e){return[(180+t)/360,(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+e*Math.PI/360)))/360]}var dn=t=>1/mn/Math.cos(t*Math.PI/180);function He(t,e){let[r,n]=Pt(t[0],t[1]),[o,c]=Pt(e[0],e[1]),a=dn(t[1]);return[(o-r)/a,(c-n)/a]}function _e(t){let e=t.map(n=>n.anchor[0]),r=t.map(n=>n.anchor[1]);return[(Math.min(...e)+Math.max(...e))/2,(Math.min(...r)+Math.max(...r))/2]}var hn=t=>Math.PI-(180+t)*Math.PI/180;function Pe(t,e){let[r,n]=He(e,t.anchor),o=hn(t.northOffsetDegrees),c=Math.cos(o),a=Math.sin(o),[i,f,s]=t.scale;return[c*i,0,-a*i,0,0,f,0,0,a*s,0,c*s,0,r,t.groundAltitudeMetres,n,1]}function Nt(t){let e=new Map;for(let r of t)e.set(r.area??"default",[...e.get(r.area??"default")??[],r]);return e}function Ut(t){let e=_e(t);return Math.max(50,...t.map(r=>Math.hypot(...He(e,r.anchor))))+30}var pn=t=>`NL.IMBAG.Pand.${t}`;function Ne(t){return[...new Set(t.map(e=>pn(e.pand)))].sort()}function Ue(t){let e=t.L0/2,r=t.W0/2,n=t.E0,o={positions:[],normals:[],uvs:[],index:[]},c={positions:[],normals:[],uvs:[],index:[]},a=(l,h,d,p,x,M,R)=>{let y=l.positions.length/3;for(let k of[h,d,p,x])l.positions.push(...k),l.normals.push(...M),l.uvs.push(...R(k));l.index.push(y,y+1,y+2,y,y+2,y+3)},i=l=>[l[0],l[1]],f=l=>[l[2],l[1]],s=l=>[l[0],l[2]];a(o,[-e,0,r],[e,0,r],[e,n,r],[-e,n,r],[0,0,1],i),a(o,[e,0,-r],[-e,0,-r],[-e,n,-r],[e,n,-r],[0,0,-1],i),a(o,[e,0,r],[e,0,-r],[e,n,-r],[e,n,r],[1,0,0],f),a(o,[-e,0,-r],[-e,0,r],[-e,n,r],[-e,n,-r],[-1,0,0],f);let u=t.R0!==void 0&&t.R0>n+.3?t.R0:void 0;if(u===void 0)a(c,[-e,n,r],[e,n,r],[e,n,-r],[-e,n,-r],[0,1,0],s);else{let l=u-n,h=Math.hypot(r,l),d=l/h,p=r/h;a(c,[-e,n,r],[e,n,r],[e,u,0],[-e,u,0],[0,p,d],s),a(c,[e,n,-r],[-e,n,-r],[-e,u,0],[e,u,0],[0,p,-d],s);let x=(M,R,y)=>{let k=o.positions.length/3,W=y?[[M,n,-r],[M,n,r],[M,u,0]]:[[M,n,r],[M,n,-r],[M,u,0]];for(let v of W)o.positions.push(...v),o.normals.push(R,0,0),o.uvs.push(...f(v));o.index.push(k,k+1,k+2)};x(e,1,!1),x(-e,-1,!0)}return{walls:o,roof:c}}function $e(t,e,r,n,o,c=20){let a=new Set(o?.near),i=new Set(o?.far),f=[],s=[];return t.forEach((u,l)=>{let h=Math.hypot(u.x-e.x,u.z-e.z),d=a.has(l)?r+c:r-(i.has(l)?c:0),p=a.has(l)||i.has(l)?n+c:n;h<=d?f.push(l):h<=p&&s.push(l)}),{near:f,far:s,culled:t.length-f.length-s.length}}var gn=140,bn=700;function yn(t){let e=t.reduce((a,i)=>a+i.positions.length/3,0),r=t.reduce((a,i)=>a+(i.index?i.index.length:i.positions.length/3),0),n={positions:new Float32Array(e*3),normals:new Float32Array(e*3),uvs:new Float32Array(e*2),textures:new Float32Array(e),tints:new Float32Array(e*3),index:new Uint32Array(r)},o=0,c=0;for(let a of t){let i=a.matrix,f=a.positions.length/3,s=i[0],u=i[4],l=i[8],h=i[1],d=i[5],p=i[9],x=i[2],M=i[6],R=i[10],y=[d*R-p*M,p*x-h*R,h*M-d*x,l*M-u*R,s*R-l*x,u*x-s*M,u*p-l*d,l*h-s*p,s*d-u*h],k=s*y[0]+u*y[1]+l*y[2]<0;for(let v=0;v<f;v++){let Z=a.positions[v*3],U=a.positions[v*3+1],j=a.positions[v*3+2],F=(o+v)*3;n.positions[F]=i[0]*Z+i[4]*U+i[8]*j+i[12],n.positions[F+1]=i[1]*Z+i[5]*U+i[9]*j+i[13],n.positions[F+2]=i[2]*Z+i[6]*U+i[10]*j+i[14];let K=a.normals[v*3],J=a.normals[v*3+1],oe=a.normals[v*3+2],V=y[0]*K+y[1]*J+y[2]*oe,X=y[3]*K+y[4]*J+y[5]*oe,ae=y[6]*K+y[7]*J+y[8]*oe,Q=(Math.hypot(V,X,ae)||1)*(k?-1:1);n.normals[F]=V/Q,n.normals[F+1]=X/Q,n.normals[F+2]=ae/Q,n.uvs[(o+v)*2]=a.uvs[v*2]*a.uvScale,n.uvs[(o+v)*2+1]=a.uvs[v*2+1]*a.uvScale,n.textures[o+v]=a.texture,n.tints[F]=a.tint[0],n.tints[F+1]=a.tint[1],n.tints[F+2]=a.tint[2]}let W=a.index?a.index.length:f;for(let v=0;v<W;v+=3){let Z=a.index?a.index[v]:v,U=a.index?a.index[v+1]:v+1,j=a.index?a.index[v+2]:v+2;n.index[c++]=o+Z,n.index[c++]=o+(k?j:U),n.index[c++]=o+(k?U:j)}o+=f}return n}function xn(t){let e=Math.max(1,t),r=Array.from({length:e},(n,o)=>o===e-1?`c = texture2D(t${o}, vUv).rgb;`:`if (vTex < ${o}.5) c = texture2D(t${o}, vUv).rgb; else`).join(`
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
${ve}
  vShade = shade;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`,fragmentShader:`
${Array.from({length:e},(n,o)=>`uniform sampler2D t${o};`).join(`
`)}
varying vec2 vUv;
varying float vShade;
varying float vTex;
varying vec3 vTint;
void main() {
  vec3 c;
  ${r}
  c *= vTint;
#ifdef HL_DIM_ALL
  c = mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), 0.4);
#endif
  gl_FragColor = vec4(c * vShade, 1.0);
}`}}function Mn(t,e,r){if(!e?.isShaderMaterial)return e;let n=r.get(e);if(!n){let o=String(e.vertexShader).replace("mat3(modelMatrix) * normal","mat3(modelMatrix * instanceMatrix) * normal").replace("modelViewMatrix * vec4(position, 1.0)","modelViewMatrix * instanceMatrix * vec4(position, 1.0)");if(o===e.vertexShader)throw new Error("recipe look vertex shader changed: instancing patch no longer applies");n=new t.ShaderMaterial({uniforms:e.uniforms,vertexShader:o,fragmentShader:e.fragmentShader,side:e.side}),n.name=`${e.name}/instanced`,n.userData={...e.userData},r.set(e,n)}return n}var wn=new Set(["brick","stucco","stone"]),vn=new Set(["roofTile","slate","bitumen"]);async function $t(t,e){let{THREE:r}=t,n=t.nearMetres??gn,o=t.cullMetres??bn;if(!e.length)throw new Error("no building-type instances");let c=_e(e),a=new r.Group;a.name="building-types";let i=e.map(m=>new r.Matrix4().fromArray(Pe(m,c))),f=i.map(m=>({x:m.elements[12],z:m.elements[14]})),s=Math.max(50,...f.map(m=>Math.hypot(m.x,m.z)))+30,u=new Map,l=new Map;e.forEach((m,g)=>l.set(m.unit,[...l.get(m.unit)??[],g]));let h=[],d=[],p=[],x=[],M=m=>!!(m?.isShaderMaterial&&m.uniforms?.map?.value&&m.uniforms.tint?.value&&m.uniforms.uvScale&&m.uniforms.enuFromWorld),R=m=>!!m?.userData?.cityLook,y=m=>M(m)||R(m);for(let[m,g]of l){let b=await t.loadUnit(m);b.updateMatrixWorld(!0);let w;b.traverse(_=>{_.userData?.nominal&&(w=_.userData.nominal)});let S=[];b.traverse(_=>{_.isMesh&&S.push(_)});for(let _ of S)M(_.material)&&!x.includes(_.material.uniforms.map.value)&&x.push(_.material.uniforms.map.value);p.push({unit:m,indices:g,meshes:S,nominal:w})}let k=new Map,W=m=>{if(R(m))return m;let g=k.get(m.side);if(!g){let b={enuFromWorld:m.uniforms.enuFromWorld};x.forEach((w,S)=>{b[`t${S}`]={value:w}}),g=new r.ShaderMaterial({uniforms:b,...xn(x.length),side:m.side}),g.name="building-types/merged",g.userData={recipeLookShared:!0},k.set(m.side,g)}return g},v=(m,g,b)=>{if(R(m.material)){let S=m.geometry.getAttribute("layer"),_=m.geometry.getAttribute("tint");return{...g,matrix:b,uvScale:1,texture:S.getX(0),tint:[_.getX(0),_.getY(0),_.getZ(0)]}}let w=m.material.uniforms.tint.value;return{...g,matrix:b,uvScale:m.material.uniforms.uvScale.value,texture:x.indexOf(m.material.uniforms.map.value),tint:[w.x,w.y,w.z]}},Z=(m,g=!1)=>{let b=new r.BufferGeometry;return b.setAttribute("position",new r.BufferAttribute(m.positions,3)),b.setAttribute("normal",new r.BufferAttribute(m.normals,3)),b.setAttribute("uv",new r.BufferAttribute(m.uvs,2)),b.setAttribute(g?"layer":"aTex",new r.BufferAttribute(m.textures,1)),b.setAttribute(g?"tint":"aTint",new r.BufferAttribute(m.tints,3)),b.setIndex(new r.BufferAttribute(m.index,1)),d.push(b),b},U=(m,g)=>{let b=[];for(let w=0;w<m.count;w++)b.push(m.getX(w)),g>1&&b.push(m.getY(w)),g>2&&b.push(m.getZ(w));return b},j=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];for(let{unit:m,indices:g,meshes:b,nominal:w}of p){let S=new Map,_=new Map,L=new Map;for(let T of b){let A=T.geometry;if(!y(T.material)){let $=new r.InstancedMesh(A,Mn(r,T.material,u),g.length);$.name=`${m}/near/${T.name}`,$.userData.layer="near",h.push({mesh:$,indices:g,local:T.matrixWorld.clone(),far:!1,triangles:(A.index?.count??A.attributes.position.count)/3}),a.add($);continue}let E=T.material.side;L.set(E,T.material),S.set(E,[...S.get(E)??[],v(T,{positions:U(A.attributes.position,3),normals:U(A.attributes.normal,3),uvs:U(A.attributes.uv,2),index:A.index?.array},T.matrixWorld.elements)])}if(w){let T=H=>R(H.material)?H.userData?.citySlot?.slot:H.material?.userData?.materialSlot,A=H=>b.filter(O=>y(O.material)&&H.has(T(O))).sort((O,ie)=>ie.geometry.attributes.position.count-O.geometry.attributes.position.count)[0],E=A(wn),$=A(vn),D=Ue(w);for(let[H,O]of[[E,D.walls],[$,D.roof]]){if(!H||!O.index.length)continue;let ie=H.material.side;L.set(ie,H.material),_.set(ie,[..._.get(ie)??[],v(H,{positions:O.positions,normals:O.normals,uvs:O.uvs,index:O.index},j)])}}for(let[T,A]of[[S,!1],[_,!0]])for(let[E,$]of T){let D=L.get(E),H=yn($),O=new r.InstancedMesh(Z(H,R(D)),W(D),g.length);O.name=`${m}/${A?"far":"near"}/merged-${E}`,O.userData.layer=A?"far":"near",h.push({mesh:O,indices:g,local:new r.Matrix4,far:A,triangles:H.index.length/3}),a.add(O)}}let F,K=null,J=new r.Matrix4,oe=new r.Matrix4().makeScale(0,0,0),V=new Map,X=[],ae={near:0,far:0,culled:0},Q=m=>{F=m;let g=new Set(m.near),b=new Set(m.far),w=0;for(let S of h){let _=S.indices.map((L,T)=>({global:L,k:T})).filter(({global:L})=>(S.far?b:g).has(L));_.forEach(({global:L},T)=>{J.multiplyMatrices(i[L],S.local),S.mesh.setMatrixAt(T,V.has(L)?oe:J)}),S.mesh.userData.slotToGlobal=_.map(L=>L.global),S.mesh.count=_.length,S.mesh.instanceMatrix.needsUpdate=!0,S.mesh.visible=_.length>0,_.length&&(S.mesh.computeBoundingSphere(),S.mesh.computeBoundingBox(),w++)}ae={near:m.near.length,far:m.far.length,culled:m.culled};for(let S of X)S.mesh.visible=(S.layer.far?b:g).has(S.global)},Te=(m=!1)=>{let g=t.getCentre();if(!g)return;let[b,w]=He(c,[g.lng,g.lat]),S={x:b,z:w};!m&&K&&Math.hypot(S.x-K.x,S.z-K.z)<10||(K=S,Q($e(f,S,n,o,F)))};Q({near:[],far:f.map((m,g)=>g),culled:0}),Te(!0);let de=new r.Mesh(new r.BufferGeometry,new r.MeshBasicMaterial);return de.name="building-types/driver",de.frustumCulled=!1,de.onBeforeRender=()=>Te(),a.add(de),{anchor:c,group:a,suppress:Ne(e),radiusMetres:s,update:Te,setHighlighted(m,g){let b=re(),w=ue[b],S=new Set([...m].map(L=>String(L).replace(/^NL\.IMBAG\.Pand\./,"")));for(let L of X)a.remove(L.mesh),L.mesh.dispose?.();X=[],V.clear(),e.forEach((L,T)=>{S.has(L.pand)?V.set(T,"highlight"):w.desaturate&&g&&rt(g.lngLat,L.anchor)&&V.set(T,"dim")});let _=Ht(r);for(let[L,T]of V)for(let A of h){if(!A.indices.includes(L))continue;let E=A.mesh.material,$=T==="highlight"?w.keepMaterials?E:R(E)?_.highlighted(E,!0):Oe(r,E,"highlight",b):R(E)?_.dimmed(E,!0):Oe(r,E,"dim",b),D=new r.InstancedMesh(A.mesh.geometry,$,1);D.setMatrixAt(0,J.multiplyMatrices(i[L],A.local)),D.name=`${A.mesh.name}/${T}`,D.userData.slotToGlobal=[L],D.computeBoundingSphere(),D.computeBoundingBox(),T==="highlight"&&nt(r,D,{style:b}),a.add(D),X.push({global:L,layer:A,mesh:D})}return F&&Q(F),[...V.values()].filter(L=>L==="highlight").length},pandForHit(m,g){let b=m?.userData?.slotToGlobal;return g===void 0||!b?null:e[b[g]]?.pand??null},stats(){let m=h.filter(w=>w.mesh.visible&&w.mesh.count>0).length,g=0,b=0;for(let w of h)w.mesh.visible&&(w.far?b+=w.triangles*w.mesh.count:g+=w.triangles*w.mesh.count);return{instances:e.length,...ae,units:l.size,drawCalls:m,nearTriangles:g,farTriangles:b}},dispose(){for(let m of X)m.mesh.dispose?.();for(let m of h)m.mesh.dispose?.();for(let m of d)m.dispose();for(let m of k.values())m.dispose()}}}return Kt(Sn);})();

"use strict";var CanalRecallBuildingTypes=(()=>{var we=Object.defineProperty;var Bt=Object.getOwnPropertyDescriptor;var Dt=Object.getOwnPropertyNames;var Gt=Object.prototype.hasOwnProperty;var Ht=(t,e)=>{for(var r in e)we(t,r,{get:e[r],enumerable:!0})},Pt=(t,e,r,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let o of Dt(e))!Gt.call(t,o)&&o!==r&&we(t,o,{get:()=>e[o],enumerable:!(n=Bt(e,o))||n.enumerable});return t};var Nt=t=>Pt(we({},"__esModule",{value:!0}),t);var dn={};Ht(dn,{areaAnchor:()=>Me,areaRadiusMetres:()=>Ot,createBuildingTypes:()=>Ft,farMassing:()=>Fe,groupByArea:()=>Et,instanceMatrix:()=>Ee,partitionByDistance:()=>Be,suppressionIds:()=>Oe});var Se={wallPull:.7,glassLift:.5,liftBrick:!0},De={wallPull:.35,glassLift:.25,liftBrick:!1},hn={photo:{cells:"photo",shadeBands:0,flatColour:!1,...Se,cartoonRoofCells:!1,outline:!1,litWallGain:255/225},procedural:{cells:"procedural",shadeBands:0,flatColour:!1,...Se,cartoonRoofCells:!1,outline:!1,litWallGain:1},untextured:{cells:"procedural",shadeBands:0,flatColour:!0,...Se,cartoonRoofCells:!1,outline:!1,litWallGain:1},storybook:{cells:"storybook",shadeBands:0,flatColour:!1,...De,cartoonRoofCells:!1,outline:!0,litWallGain:1,tone:{hueShift:-4,satMul:1.15,satAdd:0,keepDarkBelow:0,lightMul:1,lightAdd:.03,lightMax:.9}},cartoon:{cells:"cartoon",shadeBands:3,flatColour:!1,...De,cartoonRoofCells:!0,outline:!0,litWallGain:1,tone:{hueShift:0,satMul:1.7,satAdd:.08,keepDarkBelow:.35,lightMul:1.08,lightAdd:0,lightMax:.85}}};var ee=(t,e,r)=>Math.max(e,Math.min(r,t));function k(t){let e=/^#?([0-9a-f]{6})$/i.exec(t.trim());if(!e)throw Error(`Bad colour ${t}`);let r=parseInt(e[1],16);return[r>>16&255,r>>8&255,r&255]}var P=t=>"#"+t.map(e=>Math.round(ee(e,0,255)).toString(16).padStart(2,"0")).join("");function G([t,e,r]){let n=t/255,o=e/255,c=r/255,a=Math.max(n,o,c),i=Math.min(n,o,c),f=(a+i)/2;if(a===i)return[0,0,f];let s=a-i,u=f>.5?s/(2-a-i):s/(a+i);return[(a===n?(o-c)/s+(o<c?6:0):a===o?(c-n)/s+2:(n-o)/s+4)*60,u,f]}function V([t,e,r]){let n=(1-Math.abs(2*r-1))*e,o=n*(1-Math.abs(t/60%2-1)),c=r-n/2,[a,i,f]=t<60?[n,o,0]:t<120?[o,n,0]:t<180?[0,n,o]:t<240?[0,o,n]:t<300?[o,0,n]:[n,0,o];return[(a+c)*255,(i+c)*255,(f+c)*255]}var Ge=(t,e,r)=>[t[0]+(e[0]-t[0])*r,t[1]+(e[1]-t[1])*r,t[2]+(e[2]-t[2])*r];var Le={canal:-1/0,c19:1860,school:1915,modern:1945};var se={procedural:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:["#4b525c","#3f464f","#5a6068"]},untextured:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:["#4b525c","#3f464f","#5a6068"]},photo:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:["#4b525c","#3f464f","#5a6068"]},storybook:{tile:["#b9553a","#a94a33","#c46a45"],slate:["#556070","#4a5666","#657282"]},cartoon:{tile:["#e85a3c","#f08a2b","#d94a3a"],slate:["#3f5f8f","#2f4a78","#4f7bb0"]}},He=["#8f8a83","#9a958c","#85817c","#a09789"],te={tile:se.photo.tile,slate:se.photo.slate,flat:He};var de={photo:{canal:["#7a3b2c","#7a3b2c","#6b3428","#8c4632","#9a5846","#b05a40","#4a2e26","#2e2a27","#3e4a40","#5d605a","#e4ddcd"],c19:["#b05a40","#b05a40","#bd6a45","#a24d38","#c58b5e","#d3b184","#e2d5ba","#e2d5ba","#d9c5a4","#9a5846"],school:["#8c4a38","#7a4535","#9a5240","#6e3d33","#a85a3c","#5e3a32","#b0603f"],modern:["#c9b79a","#b9ad9a","#a8a49c","#d3c6ad","#8f8a82","#bfb3a0","#9c7a62","#b05a40"]},storybook:{canal:["#b9583f","#9a4a38","#7a4a3c","#4a5048","#3f4a5a","#ead9b0","#c8664a"],c19:["#c8664a","#d98b5f","#e0b36a","#ead9b0","#d9b995","#c9a08c","#c8664a"],school:["#a8553f","#9a5a48","#b87a5c","#c8664a","#8a4e40"],modern:null},cartoon:{canal:["#d9453d","#a8433a","#3b3b4a","#2a9d8f","#4672b0","#fffaf0","#e8573d"],c19:["#e8573d","#ee7f2c","#f2b92e","#f3e6c8","#d96a4d","#f2b92e"],school:["#d96a4d","#e8573d","#b9583f","#ee7f2c"],modern:null}};var pn={canal:{label:"canal-house centre (before 1860)",wall:de.photo.canal[0],roof:se.photo.tile[0]},c19:{label:"19th-century ring (1860-1914)",wall:de.photo.c19[0],roof:se.photo.tile[1]},school:{label:"Amsterdamse School (1915-1944)",wall:de.photo.school[0],roof:se.photo.slate[0]},modern:{label:"post-war and contemporary (1945+)",wall:de.photo.modern[0],roof:He[0]}};var Pe=["brick","stucco","accent","stone","frame","door","glass","roofTile","slate","bitumen","paint"],Ne={brick:"brick",accent:"brick",stucco:"stucco",stone:"stone",frame:"frame",door:"door",glass:"glass",roofTile:"tile",slate:"slate",bitumen:"flat",paint:"frame"},N={brick:3.36,stucco:2.4,accent:3.36,stone:1.28,frame:1,door:1,glass:1,roofTile:1.2,slate:1.2,bitumen:1.2,paint:1},le=[.3,.6],Ut="#f1ede2",$t="#cfc8b8";function Wt(t){let[e,r,n]=G(k(t)),o=ee(.12+n*.9,le[0],le[1]);return P(V([e,ee(r,.12,.5),o]))}function zt(t){let[e,r,n]=G(k(t));return P(V([e,ee(r,0,.55),ee(n*1.06+.03,.4,.97)]))}function Vt(t){let e=k(t),[r,n,o]=G(e);return o>=.5?P(Ge(e,k(Ut),.75)):P(V([r,n,Math.max(o,.16)]))}function Yt(t){let[e,r,n]=G(k(t));return P(Ge(V([e,r,Math.max(n,.62)]),k($t),.45))}function jt(t){let[e,r,n]=G(k(t));return n>=.17?t.startsWith("#")?t.toLowerCase():"#"+t.toLowerCase():P(V([e,r<.15?0:r,.17]))}function Kt(t,e){let r=G(k(e))[2];if(t==="roofTile"){let[n,o]=G(k(e));return o<.2?te.slate[1]:P(V([n,ee(o*1.1,.35,.6),ee(.2+r*.85,.38,.5)]))}return t==="slate"?r<.27?te.slate[1]:r<.31?te.slate[0]:te.slate[2]:r<.4?te.flat[2]:te.flat[0]}function _e(t,e){switch(t){case"brick":case"accent":return Wt(e);case"stucco":return zt(e);case"stone":return Yt(e);case"frame":return Vt(e);case"door":return jt(e);case"glass":return"#ffffff";case"paint":return e.startsWith("#")?e.toLowerCase():"#"+e.toLowerCase();default:return Kt(t,e)}}var Ue="#ffd21f",$e="#ff8033",We="#b4682c";var Xt="highlight",qt="__canalRecallHighlight",Zt="highlightAccent",Qt="__canalRecallHighlightAccent",ce={yellow:{keepMaterials:!1,outline:!1,rim:!1,desaturate:!1,ring:!1,beacon:!1,animated:!1},a:{keepMaterials:!0,outline:!0,rim:!1,desaturate:!1,ring:!0,beacon:!0,animated:!1},b:{keepMaterials:!0,outline:!1,rim:!0,desaturate:!1,ring:!0,beacon:!1,animated:!0},c:{keepMaterials:!0,outline:!1,rim:!1,desaturate:!0,ring:!0,beacon:!1,animated:!1}};var Jt=60,q=.4,Ye=2,er=.3,tr=2.4,rr=.9,nr=2.2;function ze(t){if(typeof t!="string")return null;let e=t.trim().toLowerCase();return e==="a"||e==="outline"?"a":e==="b"||e==="rim"?"b":e==="c"||e==="desaturate"?"c":e==="yellow"||e==="0"||e==="off"||e==="default"?"yellow":null}function re(t){try{let e=globalThis;if(t===void 0){let r=ze(e[qt]);if(r)return r}return ze(new URLSearchParams(t??e.location?.search??"").get(Xt))??"yellow"}catch{return"yellow"}}function je(t=re(),e){if(t==="yellow")return Ue;try{let r=globalThis,n=(e===void 0?r[Qt]:void 0)??new URLSearchParams(e??r.location?.search??"").get(Zt);if(n==="hud")return We;if(typeof n=="string"&&/^#?[0-9a-f]{6}$/i.test(n))return n.startsWith("#")?n:`#${n}`}catch{}return $e}function Ke(t=re()){return ce[t].keepMaterials?{HL_KEEP:""}:{}}var Te=`
#ifdef HL_KEEP
#define HL_PAINT(h) false
#else
#define HL_PAINT(h) ((h) > 0.5 && (h) < 1.5)
#endif
float hlState(float hidden) { return hidden > 2.5 ? 2.0 : (hidden > 1.5 ? 1.0 : 0.0); }
vec3 hlDesat(vec3 c, float h) { return h > 1.5 ? mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), ${q.toFixed(2)}) : c; }`,or=110540,ar=t=>111320*Math.cos(t*Math.PI/180);function ir(t,e){let r=(t[1]+e[1])/2;return Math.hypot((t[0]-e[0])*ar(r),(t[1]-e[1])*or)}var Xe=(t,e,r=Jt)=>!!t&&ir(t,e)<=r;var sr=`
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
}`,lr=`
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
  float f = pow(1.0 - abs(dot(n, v)), ${nr.toFixed(2)});
  float pulse = 0.775 + 0.225 * sin(hlTime * 6.2831853 / ${tr.toFixed(2)});
  gl_FragColor = vec4(hlAccent * f * ${rr.toFixed(2)} * pulse, 1.0);
#endif
}`,me="canalRecallHighlightPass",cr=(t,e)=>{let[r,n,o]=k(e);return new t.Vector3(r/255,n/255,o/255)};function ur(t,e,r={}){let n={};r.merged&&(n.HL_MERGED=""),e==="outline"&&(n.HL_OUTLINE="");let o=new t.ShaderMaterial({defines:n,uniforms:{hlViewport:{value:new t.Vector2(1,1)},hlWidthPx:{value:Ye},hlCentre:{value:new t.Vector3},hlDepthPush:{value:er},hlAccent:{value:cr(t,r.accent??je())},hlEye:{value:new t.Vector3},hlTime:{value:0},hlHasNormal:{value:1}},vertexShader:sr,fragmentShader:lr,side:e==="outline"?t.BackSide:t.FrontSide,transparent:!0,depthTest:!0,depthWrite:e==="outline",blending:e==="rim"?t.AdditiveBlending:t.NormalBlending,polygonOffset:e==="rim",polygonOffsetFactor:-1,polygonOffsetUnits:-2});return o.name=`highlight/${e}${r.merged?"/merged":""}`,o.userData={[me]:!0},o.defaultAttributeValues={hidden:[0],normal:[0,0,0]},o}function fr(t){for(let e of t?.userData?.[me]??[])t.remove(e),e.material.dispose();t?.userData&&delete t.userData[me]}function qe(t,e,r={}){fr(e);let n=ce[r.style??re()],o=[...n.outline?["outline"]:[],...n.rim?["rim"]:[]];if(!o.length||!e?.geometry)return[];let c=e.geometry,a=r.centre;if(!a){c.boundingBox||c.computeBoundingBox?.();let h=c.boundingBox?.getCenter(new t.Vector3);a=h?[h.x,h.y,h.z]:[0,0,0]}let i=c.getAttribute?.("normal")?1:0,f=[],s=new t.Matrix4,u=new t.Vector4,l=new t.Vector2;for(let h of o){let m=ur(t,h,{merged:r.merged,accent:r.accent??je(r.style)});m.uniforms.hlCentre.value.set(a[0],a[1],a[2]),m.uniforms.hlHasNormal.value=i;let p=e.isInstancedMesh?new t.InstancedMesh(c,m,e.count):new t.Mesh(c,m);e.isInstancedMesh&&(p.instanceMatrix=e.instanceMatrix),p.name=`${e.name||"mesh"}/highlight-${h}`,p.frustumCulled=!1,p.castShadow=p.receiveShadow=!1,p.renderOrder=(e.renderOrder??0)+1,p.raycast=()=>{},p.onBeforeRender=(x,M,L)=>{e.isInstancedMesh&&(p.count=e.count),p.visible=e.visible;let y=m.uniforms;x.getDrawingBufferSize(l),y.hlViewport.value.copy(l);let I=x.domElement?.clientWidth||l.x;y.hlWidthPx.value=Ye*(l.x/I),s.multiplyMatrices(L.projectionMatrix,L.matrixWorldInverse).multiply(p.matrixWorld).invert(),u.set(0,0,1,0).applyMatrix4(s),Math.abs(u.w)>1e-12&&y.hlEye.value.set(u.x/u.w,u.y/u.w,u.z/u.w),y.hlTime.value=performance.now()/1e3,m.uniformsNeedUpdate=!0},e.add(p),f.push(p)}return e.userData??={},e.userData[me]=f,f}var Ve=new WeakMap;function Ce(t,e,r,n=re()){if(!e||r==="plain"||r==="highlight"&&ce[n].keepMaterials)return e;let o=Ve.get(e);o||Ve.set(e,o=new Map);let c=`${r}|${n}`,a=o.get(c);if(a)return a;if(r==="highlight")a=new t.MeshLambertMaterial({color:16765471,emissive:7033856,side:e.side??t.FrontSide});else if(e.isShaderMaterial&&e.uniforms?.tint?.value?.isVector3)a=e.clone(),a.uniforms={...e.uniforms,tint:{value:dr(e.uniforms.tint.value.clone())}};else if(e.isShaderMaterial)a=e.clone(),a.uniforms=e.uniforms,a.defines={...e.defines??{},HL_DIM_ALL:""};else{if(a=e.clone(),a.color){let i=a.color,f=.2126*i.r+.7152*i.g+.0722*i.b;i.setRGB(i.r+(f-i.r)*q,i.g+(f-i.g)*q,i.b+(f-i.b)*q)}if(a.map){let i=a.onBeforeCompile;a.onBeforeCompile=(f,s)=>{i?.call(a,f,s),f.fragmentShader=f.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${q.toFixed(2)});`)},a.customProgramCacheKey=()=>`${e.customProgramCacheKey?.()??""}|hl-dim`}}return a.name=`${e.name||"material"}/${r}`,a.userData={...e.userData??{},highlightVariantOf:e},o.set(c,a),a}function dr(t){let e=.2126*t.x+.7152*t.y+.0722*t.z;return t.set(t.x+(e-t.x)*q,t.y+(e-t.y)*q,t.z+(e-t.z)*q)}var Ze="inferred",mr=t=>G(k(t))[1]<.2,hr=t=>{let[e,r,n]=G(k(t));return(e<45||e>340)&&r>=.15&&n<.7},pr=t=>mr(t)?"slate":"roofTile",Re=t=>hr(t)?"brick":"stucco",gr=[{test:/glass|glaz|window|vitr|ruit|pane/,slot:"glass",confidence:"name",rule:"glazing name"},{test:/decal|sign|mural|logo|letter|clock|dial/,slot:"paint",confidence:"name",rule:"signage / decal"},{test:/door|deur|gate/,slot:"door",confidence:"name",rule:"door name"},{test:/frame|kozijn|louvre|louver|blind|shutter|rail|mullion|sash/,slot:"frame",confidence:"name",rule:"joinery name"},{test:/brick|baksteen|klinker|terracotta/,slot:"brick",confidence:"name",rule:"brick name"},{test:/slate|leien|lei$/,slot:"slate",confidence:"name",rule:"slate name"},{test:/bitumen|asphalt|tar$|felt|flatroof|flat-roof|gravel/,slot:"bitumen",confidence:"name",rule:"flat roof name"},{test:/roof|tile|pantile|dakpan|dak/,slot:pr,confidence:"name",rule:"roof name, grey \u2192 slate, else pantile"},{test:/sandstone|stone|steen|column|marble|granite|limestone|plinth/,slot:"stone",confidence:"name",rule:"stone name"},{test:/stucco|render|plaster|pleister|concrete|beton|slab/,slot:"stucco",confidence:"name",rule:"render / concrete name"},{test:/gold|gilt|bronze|copper|brass|zinc|metal|steel|iron|lead|alu/,slot:"paint",confidence:"name",rule:"metal name (flat colour)"},{test:/wall|facade|gevel/,slot:Re,confidence:"name",rule:"wall name, brick hue \u2192 brick, else stucco"},{test:/ochre|yellow|buff/,slot:Re,confidence:"colour-word",rule:"ochre: yellow brick (brick hue) or render"},{test:/pink|rose/,slot:"stucco",confidence:"colour-word",rule:"pink: painted render"},{test:/moss|grass|green|blue|orange|purple|paint|teal/,slot:"paint",confidence:"colour-word",rule:"coloured paint word"},{test:/white|cream|ivory/,slot:"stucco",confidence:"colour-word",rule:"white: stucco (could be white trim)"},{test:/dark|black|charcoal|anthracite/,slot:"frame",confidence:"colour-word",rule:"dark: painted joinery / ironwork (could be a dark wall)"},{test:/red/,slot:Re,confidence:"colour-word",rule:"red: brick hue \u2192 brick (could be red tile or paint)"},{test:/grey|gray/,slot:"stucco",confidence:"colour-word",rule:"grey: render (could be concrete or zinc)"}];function Qe(t){return String(t??"").toLowerCase().replace(/[-_.\s]*\d+$/,"").trim()}function br(t){let[e,r,n]=G(k(t));return n<.22?{slot:"frame",rule:"very dark: joinery / ironwork"}:r>=.15&&(e<45||e>340)&&n<.62?{slot:"brick",rule:"brick hue"}:r<.2&&n>=.6?{slot:"stucco",rule:"pale neutral: render"}:r<.2&&n>=.22&&e>180&&e<260?{slot:"slate",rule:"blue-grey: slate"}:r<.25?{slot:"stone",rule:"neutral mid-tone: stone"}:{slot:"paint",rule:"saturated colour: paint"}}function Je(t,e){let r=e.toLowerCase(),n=Qe(t);for(let c of gr)if(c.test.test(n))return{slot:typeof c.slot=="function"?c.slot(r):c.slot,tint:r,confidence:c.confidence,rule:c.rule};let o=br(r);return{slot:o.slot,tint:r,confidence:"colour",rule:`no material word in "${n||"unnamed"}"; ${o.rule}`}}var et=t=>/white|cream|ivory/.test(Qe(t)),tt=t=>typeof t=="string"&&Pe.includes(t);var rt=["canal","c19","school","postwar","modern","tower"];var yr=8;var In=16+Math.log2(yr);var R=256,xr=["upper","ground","door","plain","shop"],Mr=2;var On=rt.length*Mr*xr.length;var H=t=>[1,3,5].map(e=>parseInt(t.slice(e,e+2),16));var Fn=H("#7d93a0"),Bn=H("#1f2a33");var Dn=H("#b8ad98"),Gn=H("#cfc6b4"),Hn=H("#ece8dd"),Pn=H("#e2d9c2"),Nn=[H("#2c4a3d"),H("#3a2a22"),H("#1f3b57"),H("#5a2a24")],Un=[H("#2f4a3a"),H("#7a2f27"),H("#27384f")];var nt=.6;function he(t,e,r){let n=Math.imul(t|0,374761393)^Math.imul(e|0,668265263)^Math.imul(r|0,2246822519);return n=Math.imul(n^n>>>13,1274126177),((n^n>>>16)>>>0)/4294967296}function ot(t,e){let r=0;for(let o=0;o<t.length;o+=4)r+=t[o];let n=r/(t.length/4);for(let o=0;o<t.length;o+=4){let c=Math.round(Math.max(0,Math.min(255,n+(t[o]-n)*e)));t[o]=t[o+1]=t[o+2]=c}}function at(t,e){let r=new Uint8ClampedArray(R*R*4),n=(o,c,a,i,f)=>{let s=(c*R+o)*4,u=f??[a,a,a];r[s]=u[0],r[s+1]=u[1],r[s+2]=u[2],r[s+3]=i};if(t==="flat")for(let o=0;o<R;o++)for(let c=0;c<R;c++)n(c,o,Math.round((e?.96:.9+(he(c>>3,o>>3,3)-.5)*.08)*255),255);else if(t==="tile"){let a=R/8,i=R/5;for(let f=0;f<R;f++)for(let s=0;s<R;s++){let u=Math.floor(f/a),l=f%a/a,h=(s+u%2*i*.5)%R,m=Math.floor(h/i),p=h%i/i,x=Math.sin(p*Math.PI),M=e?.92:.7+.22*x-.28*Math.pow(Math.max(0,1-l*3.2),1.5)*0-.22*Math.max(0,(.18-l)/.18);e||(M+=(he(m,u,7)-.5)*.14);let L=e?l<.07||p<.035||p>.965:!1;n(s,f,Math.round(Math.max(0,Math.min(1,L?.28:M))*255),255)}e||ot(r,nt)}else if(t==="slate"){let a=R/11,i=R/6;for(let f=0;f<R;f++)for(let s=0;s<R;s++){let u=Math.floor(f/a),l=f%a/a,h=(s+u%2*i*.5)%R,m=Math.floor(h/i),p=h%i/i,x=e?.9:.82+(he(m,u,11)-.5)*.16-.16*Math.max(0,(.16-l)/.16);(p<(e?.05:.025)||l<(e?.09:.04))&&(x=e?.3:x*.7),n(s,f,Math.round(Math.max(0,Math.min(1,x))*255),255)}e||ot(r,nt)}else for(let f=0;f<R;f++)for(let s=0;s<R;s++){let u=s/R,l=f/R,h=u>.2-.06&&u<.8+.06&&l>.2-.06&&l<.82+.06,m=u>.2+.03&&u<.8-.03&&l>.2+.03&&l<.82-.03,p=Math.abs(u-.5)<.018||Math.abs(l-.5)<.018;if(m&&!p){let x=(l-.2)/.6199999999999999,M=e?[150+60*x,200+30*x,235]:[40+80*x*x,55+90*x*x,68+90*x*x];n(s,f,0,0,[M[0],M[1],M[2]])}else if(h)n(s,f,0,0,e?[255,250,240]:[236,232,221]);else{let x=e?.92:.85+(he(s>>3,f>>3,5)-.5)*.12,M=e&&(s<5||f<5||s>R-6||f>R-6);n(s,f,Math.round((M?.3:x)*255),255)}}return r}function it(t,e){let n=t.createElement("canvas");n.width=n.height=336;let o=n.getContext("2d",{willReadFrequently:!0});if(e)for(let s=0;s<336;s+=112)for(let u=0;u<336;u+=112)o.drawImage(e,u,s,112,112);else{let s=7,u=()=>(s=s*16807%2147483647)/2147483647;for(let l=0,h=0;h<336;h+=14,l++)for(let m=-(l%2)*24;m<336;m+=48){let p=150+u()*50;o.fillStyle=`rgb(${p},${p*.92},${p*.86})`,o.fillRect(m,h,48,14)}}o.strokeStyle="rgba(235,223,205,0.18)",o.lineWidth=1.7;for(let s=0,u=6;u<336;u+=14,s++){o.beginPath(),o.moveTo(0,u),o.lineTo(336,u),o.stroke();for(let l=s%2*24;l<336;l+=48)o.beginPath(),o.moveTo(l,u),o.lineTo(l,u+14),o.stroke()}let c=o.getImageData(0,0,336,336),a=c.data,i=0;for(let s=0;s<a.length;s+=4)i+=(a[s]+a[s+1]+a[s+2])/3;i/=a.length/4;let f=i>0?Math.min(2.4,225/i):1;for(let s=0;s<a.length;s+=4){let u=(a[s]+a[s+1]+a[s+2])/3,l=Math.min(255,(u+(i-u)*.7)*f);a[s]=a[s+1]=a[s+2]=l,a[s+3]=255}return o.putImageData(c,0,0),n}function st(t){let e=t.createElement("canvas");e.width=64,e.height=128;let r=e.getContext("2d"),n=r.createLinearGradient(0,0,0,128);return n.addColorStop(0,"#8aa1b0"),n.addColorStop(.5,"#4d606c"),n.addColorStop(1,"#3c474e"),r.fillStyle=n,r.fillRect(0,0,64,128),r.fillStyle="rgba(235,242,248,0.16)",r.beginPath(),r.moveTo(10,0),r.lineTo(34,0),r.lineTo(4,70),r.lineTo(-20,70),r.closePath(),r.fill(),e}function lt(t){let e=t.createElement("canvas");e.width=e.height=128;let r=e.getContext("2d");r.fillStyle="#ffffff",r.fillRect(0,0,128,128),r.fillStyle="rgba(0,0,0,0.10)";for(let n=0;n<128;n+=16)r.fillRect(n,0,1.5,128);return e}function ct(t){let e=t.createElement("canvas");e.width=e.height=128;let r=e.getContext("2d"),n=r.createImageData(128,128),o=23,c=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++){let i=(c()-.5)*3;for(let f=0;f<128;f++){let s=(a*128+f)*4,u=c()<.012?-14:0,l=243+(c()-.5)*8+i+u;n.data[s]=n.data[s+1]=n.data[s+2]=l,n.data[s+3]=255}}return r.putImageData(n,0,0),e}function ut(t){let e=t.createElement("canvas");e.width=e.height=128;let r=e.getContext("2d"),n=r.createImageData(128,128),o=11,c=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<n.data.length;a+=4){let i=228+(c()-.5)*16;n.data[a]=n.data[a+1]=n.data[a+2]=i,n.data[a+3]=255}return r.putImageData(n,0,0),r.fillStyle="rgba(80,70,60,0.18)",r.fillRect(0,0,128,1.5),e}function pe(t,e){let r=at(e,!1),n=Math.round(Math.sqrt(r.length/4)),o=t.createElement("canvas");o.width=o.height=n;let c=o.getContext("2d"),a=c.createImageData(n,n);for(let i=0;i<r.length;i+=4)a.data[i]=r[i],a.data[i+1]=r[i+1],a.data[i+2]=r[i+2],a.data[i+3]=255;return c.putImageData(a,0,0),o}var vr=238;function ft(t,e){let n=t.createElement("canvas");n.width=n.height=336;let o=n.getContext("2d",{willReadFrequently:!0});if(e)for(let s=0;s<336;s+=112)for(let u=0;u<336;u+=112)o.drawImage(e,u,s,112,112);else{let s=13,u=()=>(s=s*16807%2147483647)/2147483647;for(let l=0,h=0;h<336;h+=14,l++)for(let m=-(l%2)*24;m<336;m+=48){let p=165+u()*30;o.fillStyle=`rgb(${p},${p*.93},${p*.88})`,o.fillRect(m,h,48,14)}}o.strokeStyle="rgba(245,240,230,0.26)",o.lineWidth=1.2;for(let s=0,u=6;u<336;u+=14,s++){o.beginPath(),o.moveTo(0,u),o.lineTo(336,u),o.stroke();for(let l=s%2*24;l<336;l+=48)o.beginPath(),o.moveTo(l,u),o.lineTo(l,u+14),o.stroke()}let c=o.getImageData(0,0,336,336),a=c.data,i=0;for(let s=0;s<a.length;s+=4)i+=(a[s]+a[s+1]+a[s+2])/3;i/=a.length/4;let f=i>0?Math.min(2.6,vr/i):1;for(let s=0;s<a.length;s+=4){let u=(a[s]+a[s+1]+a[s+2])/3,l=Math.min(255,(u+(i-u)*.82)*f);a[s]=a[s+1]=a[s+2]=l,a[s+3]=255}return o.putImageData(c,0,0),n}function dt(t){let e=t.createElement("canvas");e.width=e.height=128;let r=e.getContext("2d"),n=r.createImageData(128,128),o=31,c=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++)for(let i=0;i<128;i++){let f=(a*128+i)*4,s=246+(c()-.5)*3;n.data[f]=n.data[f+1]=n.data[f+2]=s,n.data[f+3]=255}return r.putImageData(n,0,0),e}function mt(t){let e=t.createElement("canvas");e.width=e.height=4;let r=e.getContext("2d");return r.fillStyle="#fff",r.fillRect(0,0,4,4),e}var ht=[-1,-1];var pt=[-1,-1],gt=()=>[70,190,.5],ge=t=>Number.isInteger(t)?t.toFixed(1):String(t),bt=`
uniform vec2 roofLayers;
uniform vec3 roofTier;
vec3 roofTierColour(vec3 fine, vec2 uv, float layer, float dist) {
  if (roofLayers.x < 0.0 || layer < roofLayers.x - 0.5 || layer > roofLayers.y - 0.5) return fine;
  float mid = smoothstep(roofTier.x - ${ge(15)}, roofTier.x + ${ge(15)}, dist);
  if (mid <= 0.0) return fine;
  float far = smoothstep(roofTier.y - ${ge(40)}, roofTier.y + ${ge(40)}, dist);
  vec3 coarse = texture(cells, vec3(uv * roofTier.z, layer)).rgb;
  vec3 flatMean = textureLod(cells, vec3(uv, layer), 8.0).rgb;
  return mix(mix(fine, coarse, mid), flatMean, far);
}`,yt=`
uniform vec2 cellTier;
void cellTierSample(vec3 p, float dist, out vec3 c, out vec2 m) {
  c = texture(cells, p).rgb; m = texture(masks, p).rg;
  if (cellTier.x < 0.0) return;
  float rho = max(length(dFdx(p.xy)), length(dFdy(p.xy))) * float(textureSize(cells, 0).x);
  float far = smoothstep(cellTier.x, cellTier.y, rho);
  if (far <= 0.0) return;
  c = mix(c, textureLod(cells, p, 8.0).rgb, far); m = mix(m, textureLod(masks, p, 8.0).rg, far);
}`;var Y=.9,ue=255/225,wr=255/228,Sr=255/243,Lr=255/246,xe=[{cell:"brick",tileM:N.brick,clampUv:!1,litGain:ue*Y,skyTint:!1},{cell:"stucco",tileM:N.stucco,clampUv:!1,litGain:Sr*Y,skyTint:!1},{cell:"stone",tileM:N.stone,clampUv:!1,litGain:wr*Y,skyTint:!1},{cell:"white",tileM:1,clampUv:!1,litGain:1,skyTint:!1},{cell:"door",tileM:N.door,clampUv:!1,litGain:1,skyTint:!1},{cell:"glass",tileM:N.glass,clampUv:!0,litGain:1,skyTint:!0},{cell:"tile",tileM:N.roofTile,clampUv:!1,litGain:ue*Y,skyTint:!1},{cell:"slate",tileM:N.slate,clampUv:!1,litGain:ue*Y,skyTint:!1},{cell:"flat",tileM:N.bitumen,clampUv:!1,litGain:ue*Y,skyTint:!1},{cell:"brick20",tileM:N.brick,clampUv:!1,litGain:ue*Y,skyTint:!1},{cell:"whiteStucco",tileM:N.stucco,clampUv:!1,litGain:Lr*Y,skyTint:!1}],ye=xe.length,be=Object.fromEntries(xe.map((t,e)=>[t.cell,e])),_r=Le.school;function St(t,e={}){let r=Ne[t];return r==="brick"&&typeof e.year=="number"&&e.year>=_r?be.brick20:r==="stucco"&&e.white?be.whiteStucco:r==="frame"?be.white:be[r]}function Tr(){return xe.map(t=>[1/t.tileM,t.clampUv?1:0,t.litGain,t.skyTint?1:0])}var Cr=.38,Rr=.8,Ar=.75,Ir=.5,kr=.12,Er=(t,e)=>(t<45||t>340)&&e>=.2;function Or(t,e){let r=k(e),[n,o,c]=G(r);return t==="slate"&&Er(n,o)?_e("roofTile",e):(t==="brick"||t==="accent")&&o<kr?P(V([n,o,Math.min(le[1],Math.max(le[0],.12+c*.9))])):t==="slate"&&c>Cr?P(V([n,Math.min(o,.12),Math.min(.72,c/Rr)])):t==="frame"&&c>=.5&&c<Ar?P(r):t==="stone"&&c<Ir?P(r):_e(t,e)}function Fr(t,e){let[r,n,o]=k(Or(t,e));return[r,n,o,255]}function Br(t,e,r){switch(e){case"brick":return it(t,r);case"brick20":return ft(t,r);case"stucco":return ct(t);case"whiteStucco":return dt(t);case"stone":return ut(t);case"white":case"frame":return mt(t);case"door":return lt(t);case"glass":return st(t);case"tile":return pe(t,"tile");case"slate":return pe(t,"slate");case"flat":return pe(t,"flat")}}function Dr(t,e,r){let n=r*r,o=new Uint8Array(n*4*ye),c=new Uint8Array(n*2*ye),a=t.createElement("canvas");a.width=a.height=r;let i=a.getContext("2d",{willReadFrequently:!0});return i.imageSmoothingQuality="high",xe.forEach((f,s)=>{i.clearRect(0,0,r,r),i.drawImage(Br(t,f.cell,e),0,0,r,r);let u=i.getImageData(0,0,r,r).data;for(let l=0;l<r;l++)for(let h=0;h<r;h++){let m=((r-1-l)*r+h)*4,p=s*n+l*r+h;o[p*4]=u[m],o[p*4+1]=u[m+1],o[p*4+2]=u[m+2],o[p*4+3]=255,c[p*2]=255,c[p*2+1]=0}}),{colour:o,mask:c}}async function Gr(t=document){let e=new Image;e.src=new URL("materials/ambientcg/Bricks057/colour.jpg",t.baseURI).href;try{return await e.decode(),e}catch{return null}}var Ae=t=>`${t.lit?"lit":"unlit"}|${t.kind}|${t.kind==="slot"?t.uv??"uv":"-"}|${t.highlight?"hl":t.dim?"dim":"-"}|${t.side??0}`;function Hr(t){let e={CITY_SLOT_COUNT:String(ye)};return t.kind==="slot"&&(e.CITY_SLOT=""),t.kind==="slot"&&t.uv==="box"&&(e.CITY_BOX_UV=""),t.highlight?e.CITY_HIGHLIGHT="":t.dim&&(e.CITY_DIM=""),{...e,...Ke()}}var Pr="vec3(1.0, 0.824, 0.122)",xt="vec3(1.0, 0.637, 0.0137)",Mt="vec3(0.035, 0.05, 0.07)",Nr=1,Ur=.2,$r=.75,Wr=1.8,ne=t=>Number.isInteger(t)?t.toFixed(1):String(t),zr=`
float cityGrain(vec3 cell) {
  float g = clamp(dot(cell, vec3(0.299, 0.587, 0.114)) / ${ne(225/255)}, 0.45, 1.1);
  return mix(1.0, g, ${ne($r)});
}`,Lt=`
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
${Te}`,_t=`
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
#endif`,Tt=`
vFacDist = length((modelViewMatrix * vec4(position, 1.0)).xyz);
if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`,Ct=`
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${bt}
${yt}
varying vec2 vFacUv;
flat varying float vLayer;
flat varying vec4 vSlot;
varying vec3 vTint;
varying vec3 vAccent;
flat varying float vHighlight;
varying float vFacDist;
${zr}
${Te}`,Rt=`
if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;`,At=`
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
cityC *= mix(vec3(1.0), vTint, cityM.r) * mix(vec3(1.0), vAccent, cityM.g);`,Vr=`
uniform mat3 enuFromWorld;
${Lt}
varying float vShade;
void main() {
${_t}
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
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = 0.8 + 0.2 * (0.5 + 0.5 * (h.x * -0.45 + h.y * 0.89)); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, n.x * -0.35 + n.y * 0.5 + n.z * 0.8), 0.5, 1.0);
  vShade = shade;
#else
  vShade = tint.a;
#endif
${Tt}
}`,Yr=`
precision highp float;
${Ct}
varying float vShade;
void main() {
${Rt}
${At}
  if (HL_PAINT(vHighlight)) {
    float hlShade = clamp(1.0 - (1.0 - vShade) * ${ne(Wr)}, 0.6, 1.0);
    gl_FragColor = vec4(${Pr} * (flatColour > 0.5 ? 1.0 : cityG) * hlShade, 1.0);
    return;
  }
  if (flatColour > 0.5) cityC = vTint;
  cityC = hlDesat(cityC, vHighlight);
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  gl_FragColor = vec4(cityC * shade, 1.0);
}`;function jr(t,e={}){return{cells:e.cells??{value:null},masks:e.masks??{value:null},slotBase:e.slotBase??{value:0},slotParams:e.slotParams??{value:Tr().map(r=>new t.Vector4(...r))},bands:e.bands??{value:0},flatColour:e.flatColour??{value:0},cityFade:e.cityFade??{value:1},wallGain:e.wallGain??{value:1},roofLayers:e.roofLayers??{value:pt},roofTier:e.roofTier??{value:gt()},cellTier:e.cellTier??{value:ht},enuFromWorld:e.enuFromWorld??{value:new t.Matrix3}}}var Kr={accent:[1,1,1,1],hidden:[0],color:[1,1,1],uv:[0,0],uv1:[0,0]},Ie="recipeLookShared";function Xr(t,e,r){let n=Hr(e),o=e.side??t.FrontSide,c;return e.lit?(c=new t.MeshLambertMaterial({side:o,flatShading:e.kind==="chunk"}),c.defines={...c.defines??{},...n},c.onBeforeCompile=a=>{for(let i of Object.keys(r))a.uniforms[i]=r[i];a.vertexShader=a.vertexShader.replace("#include <common>",`#include <common>${Lt}`).replace("#include <begin_vertex>",`#include <begin_vertex>${_t}`).replace("#include <project_vertex>",`#include <project_vertex>${Tt}`),a.fragmentShader=a.fragmentShader.replace("#include <common>",`#include <common>${Ct}
float cityLuma;`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>${Rt}`).replace("#include <map_fragment>",`${At}
#ifdef CITY_SLOT
cityC *= vSlot.z;
#else
cityC *= mix(1.0, wallGain * ${ne(Y)}, cityM.r);
#endif
if (flatColour > 0.5) cityC = vTint;
cityLuma = dot(cityC, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= HL_PAINT(vHighlight) ? ${xt} * ${ne(Nr)} * pow(flatColour > 0.5 ? 1.0 : cityG, 2.2) : pow(hlDesat(cityC, vHighlight), vec3(2.2));`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
if (HL_PAINT(vHighlight)) totalEmissiveRadiance += ${xt} * ${ne(Ur)};
#ifdef CITY_SLOT
else totalEmissiveRadiance += ${Mt} * vSlot.w;
#else
// Bay glazing (dark, untinted texels): the same constant sky tint as landmark glass, never a hotspot.
else totalEmissiveRadiance += ${Mt} * (1.0 - smoothstep(0.06, 0.2, cityLuma)) * (1.0 - cityM.r);
#endif`)},c.customProgramCacheKey=()=>`city-look-v3|${Ae({...e,side:0})}`,c.uniforms=r):c=new t.ShaderMaterial({uniforms:r,defines:n,vertexShader:Vr,fragmentShader:Yr,side:o}),c.defaultAttributeValues={...Kr},c.name=`city-look/${Ae(e)}`,c.userData={cityLook:!0,cityVariant:{...e},[Ie]:!0},c}function qr(t){return t?t.isMeshBasicMaterial||t.userData?.unlit?"unlit (decal / emissive sign)":t.transparent||(t.opacity??1)<1?"transparent":t.vertexColors?"vertex colours":t.map?"own texture":null:"no material"}function Zr(t,e){let r=t?.userData??{};if(tt(r.materialSlot)&&typeof r.tint=="string")return{slot:r.materialSlot,tint:r.tint,inferred:r.materialSlotSource===Ze};if(!e||qr(t)||!t.color)return null;let n="#"+t.color.getHexString(),o=Je(t.name,n);return{slot:o.slot,tint:o.tint,inferred:!0}}function vt(t,e,r,n,o={}){let c=e.getAttribute("position")?.count??0,a=St(r,o),i=Fr(r,n),f=e.getAttribute("layer"),s=e.getAttribute("tint");if(f&&s)return f.getX(0)===a&&Math.round(s.getX(0)*255)===i[0]&&Math.round(s.getY(0)*255)===i[1]&&Math.round(s.getZ(0)*255)===i[2];e.setAttribute("layer",new t.BufferAttribute(new Uint8Array(c).fill(a),1,!1));let u=new Uint8Array(c*4);for(let l=0;l<c;l++)u.set(i,l*4);return e.setAttribute("tint",new t.BufferAttribute(u,4,!0)),!0}var Qr="__canalRecallCityLookShared";function It(t,e={}){let r=globalThis,n=r[Qr]??=new Map,o=n.get(t);return o||n.set(t,o=Jr(t,e)),o}function Jr(t,e={}){let r=e.document??globalThis.document,n=e.size??(globalThis.matchMedia?.("(pointer: coarse)").matches?128:256),o=jr(t),c=new Map,a=null,i=!1,f=(l,h)=>{let m=new t.DataArrayTexture(l,n,n,ye);return m.format=h,m.type=t.UnsignedByteType,m.wrapS=m.wrapT=t.RepeatWrapping,m.minFilter=t.LinearMipmapLinearFilter,m.magFilter=t.LinearFilter,m.generateMipmaps=!0,m.anisotropy=e.anisotropy??4,m.unpackAlignment=1,m.needsUpdate=!0,m.userData={bytes:l.byteLength,[Ie]:!0},m},s=(async()=>{if(!r)return;let l=e.brick!==void 0?e.brick:await Gr(r),{colour:h,mask:m}=Dr(r,l,n);a={colour:f(h,t.RGBAFormat),mask:f(m,t.RGFormat)},i||(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)})(),u=l=>{let h=Ae(l),m=c.get(h);return m||c.set(h,m=Xr(t,l,o)),m};return{uniforms:o,ready:s,material:u,dress(l,{lit:h,infer:m=!1,year:p=null}){let x=0;return l.traverse(M=>{if(!M.isMesh||Array.isArray(M.material)||M.material?.userData?.cityLook)return;let L=Zr(M.material,m);if(!L)return;let y=M.geometry;if(!y?.getAttribute("position"))return;let I=!!y.getAttribute("uv");!I&&!y.getAttribute("normal")&&y.computeVertexNormals();let W={year:p,white:L.inferred&&et(M.material.name)};vt(t,y,L.slot,L.tint,W)||(y=M.geometry=y.clone(),y.deleteAttribute("layer"),y.deleteAttribute("tint"),vt(t,y,L.slot,L.tint,W));let w=M.material;M.material=u({lit:h,kind:"slot",uv:I?"uv":"box",side:w.side}),M.userData.citySlot={slot:L.slot,tint:L.tint,inferred:L.inferred,from:w.name,layer:St(L.slot,W)},w.userData?.[Ie]||w.dispose(),x++}),x},highlighted(l,h){let m=l?.userData?.cityVariant;return m?u({...m,highlight:h,dim:!1}):l},dimmed(l,h){let m=l?.userData?.cityVariant;return m?u({...m,highlight:!1,dim:h}):l},bindAtlas(l){i=!!l,l?(o.cells.value=l.colour,o.masks.value=l.mask,o.slotBase.value=l.slotBase):a&&(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)},textureBytes(){return a&&!i?Math.round((a.colour.userData.bytes+a.mask.userData.bytes)*4/3):0}}}var en=2*Math.PI*6378137;function kt(t,e){return[(180+t)/360,(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+e*Math.PI/360)))/360]}var tn=t=>1/en/Math.cos(t*Math.PI/180);function ke(t,e){let[r,n]=kt(t[0],t[1]),[o,c]=kt(e[0],e[1]),a=tn(t[1]);return[(o-r)/a,(c-n)/a]}function Me(t){let e=t.map(n=>n.anchor[0]),r=t.map(n=>n.anchor[1]);return[(Math.min(...e)+Math.max(...e))/2,(Math.min(...r)+Math.max(...r))/2]}var rn=t=>Math.PI-(180+t)*Math.PI/180;function Ee(t,e){let[r,n]=ke(e,t.anchor),o=rn(t.northOffsetDegrees),c=Math.cos(o),a=Math.sin(o),[i,f,s]=t.scale;return[c*i,0,-a*i,0,0,f,0,0,a*s,0,c*s,0,r,t.groundAltitudeMetres,n,1]}function Et(t){let e=new Map;for(let r of t)e.set(r.area??"default",[...e.get(r.area??"default")??[],r]);return e}function Ot(t){let e=Me(t);return Math.max(50,...t.map(r=>Math.hypot(...ke(e,r.anchor))))+30}var nn=t=>`NL.IMBAG.Pand.${t}`;function Oe(t){return[...new Set(t.map(e=>nn(e.pand)))].sort()}function Fe(t){let e=t.L0/2,r=t.W0/2,n=t.E0,o={positions:[],normals:[],uvs:[],index:[]},c={positions:[],normals:[],uvs:[],index:[]},a=(l,h,m,p,x,M,L)=>{let y=l.positions.length/3;for(let I of[h,m,p,x])l.positions.push(...I),l.normals.push(...M),l.uvs.push(...L(I));l.index.push(y,y+1,y+2,y,y+2,y+3)},i=l=>[l[0],l[1]],f=l=>[l[2],l[1]],s=l=>[l[0],l[2]];a(o,[-e,0,r],[e,0,r],[e,n,r],[-e,n,r],[0,0,1],i),a(o,[e,0,-r],[-e,0,-r],[-e,n,-r],[e,n,-r],[0,0,-1],i),a(o,[e,0,r],[e,0,-r],[e,n,-r],[e,n,r],[1,0,0],f),a(o,[-e,0,-r],[-e,0,r],[-e,n,r],[-e,n,-r],[-1,0,0],f);let u=t.R0!==void 0&&t.R0>n+.3?t.R0:void 0;if(u===void 0)a(c,[-e,n,r],[e,n,r],[e,n,-r],[-e,n,-r],[0,1,0],s);else{let l=u-n,h=Math.hypot(r,l),m=l/h,p=r/h;a(c,[-e,n,r],[e,n,r],[e,u,0],[-e,u,0],[0,p,m],s),a(c,[e,n,-r],[-e,n,-r],[-e,u,0],[e,u,0],[0,p,-m],s);let x=(M,L,y)=>{let I=o.positions.length/3,W=y?[[M,n,-r],[M,n,r],[M,u,0]]:[[M,n,r],[M,n,-r],[M,u,0]];for(let w of W)o.positions.push(...w),o.normals.push(L,0,0),o.uvs.push(...f(w));o.index.push(I,I+1,I+2)};x(e,1,!1),x(-e,-1,!0)}return{walls:o,roof:c}}function Be(t,e,r,n,o,c=20){let a=new Set(o?.near),i=new Set(o?.far),f=[],s=[];return t.forEach((u,l)=>{let h=Math.hypot(u.x-e.x,u.z-e.z),m=a.has(l)?r+c:r-(i.has(l)?c:0),p=a.has(l)||i.has(l)?n+c:n;h<=m?f.push(l):h<=p&&s.push(l)}),{near:f,far:s,culled:t.length-f.length-s.length}}var on=140,an=700;function sn(t){let e=t.reduce((a,i)=>a+i.positions.length/3,0),r=t.reduce((a,i)=>a+(i.index?i.index.length:i.positions.length/3),0),n={positions:new Float32Array(e*3),normals:new Float32Array(e*3),uvs:new Float32Array(e*2),textures:new Float32Array(e),tints:new Float32Array(e*3),index:new Uint32Array(r)},o=0,c=0;for(let a of t){let i=a.matrix,f=a.positions.length/3,s=i[0],u=i[4],l=i[8],h=i[1],m=i[5],p=i[9],x=i[2],M=i[6],L=i[10],y=[m*L-p*M,p*x-h*L,h*M-m*x,l*M-u*L,s*L-l*x,u*x-s*M,u*p-l*m,l*h-s*p,s*m-u*h],I=s*y[0]+u*y[1]+l*y[2]<0;for(let w=0;w<f;w++){let Z=a.positions[w*3],U=a.positions[w*3+1],j=a.positions[w*3+2],F=(o+w)*3;n.positions[F]=i[0]*Z+i[4]*U+i[8]*j+i[12],n.positions[F+1]=i[1]*Z+i[5]*U+i[9]*j+i[13],n.positions[F+2]=i[2]*Z+i[6]*U+i[10]*j+i[14];let K=a.normals[w*3],Q=a.normals[w*3+1],oe=a.normals[w*3+2],z=y[0]*K+y[1]*Q+y[2]*oe,X=y[3]*K+y[4]*Q+y[5]*oe,ae=y[6]*K+y[7]*Q+y[8]*oe,J=(Math.hypot(z,X,ae)||1)*(I?-1:1);n.normals[F]=z/J,n.normals[F+1]=X/J,n.normals[F+2]=ae/J,n.uvs[(o+w)*2]=a.uvs[w*2]*a.uvScale,n.uvs[(o+w)*2+1]=a.uvs[w*2+1]*a.uvScale,n.textures[o+w]=a.texture,n.tints[F]=a.tint[0],n.tints[F+1]=a.tint[1],n.tints[F+2]=a.tint[2]}let W=a.index?a.index.length:f;for(let w=0;w<W;w+=3){let Z=a.index?a.index[w]:w,U=a.index?a.index[w+1]:w+1,j=a.index?a.index[w+2]:w+2;n.index[c++]=o+Z,n.index[c++]=o+(I?j:U),n.index[c++]=o+(I?U:j)}o+=f}return n}function ln(t){let e=Math.max(1,t),r=Array.from({length:e},(n,o)=>o===e-1?`c = texture2D(t${o}, vUv).rgb;`:`if (vTex < ${o}.5) c = texture2D(t${o}, vUv).rgb; else`).join(`
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
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = 0.8 + 0.2 * (0.5 + 0.5 * (h.x * -0.45 + h.y * 0.89)); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, n.x * -0.35 + n.y * 0.5 + n.z * 0.8), 0.5, 1.0);
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
}`}}function cn(t,e,r){if(!e?.isShaderMaterial)return e;let n=r.get(e);if(!n){let o=String(e.vertexShader).replace("mat3(modelMatrix) * normal","mat3(modelMatrix * instanceMatrix) * normal").replace("modelViewMatrix * vec4(position, 1.0)","modelViewMatrix * instanceMatrix * vec4(position, 1.0)");if(o===e.vertexShader)throw new Error("recipe look vertex shader changed: instancing patch no longer applies");n=new t.ShaderMaterial({uniforms:e.uniforms,vertexShader:o,fragmentShader:e.fragmentShader,side:e.side}),n.name=`${e.name}/instanced`,n.userData={...e.userData},r.set(e,n)}return n}var un=new Set(["brick","stucco","stone"]),fn=new Set(["roofTile","slate","bitumen"]);async function Ft(t,e){let{THREE:r}=t,n=t.nearMetres??on,o=t.cullMetres??an;if(!e.length)throw new Error("no building-type instances");let c=Me(e),a=new r.Group;a.name="building-types";let i=e.map(d=>new r.Matrix4().fromArray(Ee(d,c))),f=i.map(d=>({x:d.elements[12],z:d.elements[14]})),s=Math.max(50,...f.map(d=>Math.hypot(d.x,d.z)))+30,u=new Map,l=new Map;e.forEach((d,g)=>l.set(d.unit,[...l.get(d.unit)??[],g]));let h=[],m=[],p=[],x=[],M=d=>!!(d?.isShaderMaterial&&d.uniforms?.map?.value&&d.uniforms.tint?.value&&d.uniforms.uvScale&&d.uniforms.enuFromWorld),L=d=>!!d?.userData?.cityLook,y=d=>M(d)||L(d);for(let[d,g]of l){let b=await t.loadUnit(d);b.updateMatrixWorld(!0);let v;b.traverse(T=>{T.userData?.nominal&&(v=T.userData.nominal)});let S=[];b.traverse(T=>{T.isMesh&&S.push(T)});for(let T of S)M(T.material)&&!x.includes(T.material.uniforms.map.value)&&x.push(T.material.uniforms.map.value);p.push({unit:d,indices:g,meshes:S,nominal:v})}let I=new Map,W=d=>{if(L(d))return d;let g=I.get(d.side);if(!g){let b={enuFromWorld:d.uniforms.enuFromWorld};x.forEach((v,S)=>{b[`t${S}`]={value:v}}),g=new r.ShaderMaterial({uniforms:b,...ln(x.length),side:d.side}),g.name="building-types/merged",g.userData={recipeLookShared:!0},I.set(d.side,g)}return g},w=(d,g,b)=>{if(L(d.material)){let S=d.geometry.getAttribute("layer"),T=d.geometry.getAttribute("tint");return{...g,matrix:b,uvScale:1,texture:S.getX(0),tint:[T.getX(0),T.getY(0),T.getZ(0)]}}let v=d.material.uniforms.tint.value;return{...g,matrix:b,uvScale:d.material.uniforms.uvScale.value,texture:x.indexOf(d.material.uniforms.map.value),tint:[v.x,v.y,v.z]}},Z=(d,g=!1)=>{let b=new r.BufferGeometry;return b.setAttribute("position",new r.BufferAttribute(d.positions,3)),b.setAttribute("normal",new r.BufferAttribute(d.normals,3)),b.setAttribute("uv",new r.BufferAttribute(d.uvs,2)),b.setAttribute(g?"layer":"aTex",new r.BufferAttribute(d.textures,1)),b.setAttribute(g?"tint":"aTint",new r.BufferAttribute(d.tints,3)),b.setIndex(new r.BufferAttribute(d.index,1)),m.push(b),b},U=(d,g)=>{let b=[];for(let v=0;v<d.count;v++)b.push(d.getX(v)),g>1&&b.push(d.getY(v)),g>2&&b.push(d.getZ(v));return b},j=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];for(let{unit:d,indices:g,meshes:b,nominal:v}of p){let S=new Map,T=new Map,_=new Map;for(let C of b){let A=C.geometry;if(!y(C.material)){let $=new r.InstancedMesh(A,cn(r,C.material,u),g.length);$.name=`${d}/near/${C.name}`,$.userData.layer="near",h.push({mesh:$,indices:g,local:C.matrixWorld.clone(),far:!1,triangles:(A.index?.count??A.attributes.position.count)/3}),a.add($);continue}let E=C.material.side;_.set(E,C.material),S.set(E,[...S.get(E)??[],w(C,{positions:U(A.attributes.position,3),normals:U(A.attributes.normal,3),uvs:U(A.attributes.uv,2),index:A.index?.array},C.matrixWorld.elements)])}if(v){let C=D=>L(D.material)?D.userData?.citySlot?.slot:D.material?.userData?.materialSlot,A=D=>b.filter(O=>y(O.material)&&D.has(C(O))).sort((O,ie)=>ie.geometry.attributes.position.count-O.geometry.attributes.position.count)[0],E=A(un),$=A(fn),B=Fe(v);for(let[D,O]of[[E,B.walls],[$,B.roof]]){if(!D||!O.index.length)continue;let ie=D.material.side;_.set(ie,D.material),T.set(ie,[...T.get(ie)??[],w(D,{positions:O.positions,normals:O.normals,uvs:O.uvs,index:O.index},j)])}}for(let[C,A]of[[S,!1],[T,!0]])for(let[E,$]of C){let B=_.get(E),D=sn($),O=new r.InstancedMesh(Z(D,L(B)),W(B),g.length);O.name=`${d}/${A?"far":"near"}/merged-${E}`,O.userData.layer=A?"far":"near",h.push({mesh:O,indices:g,local:new r.Matrix4,far:A,triangles:D.index.length/3}),a.add(O)}}let F,K=null,Q=new r.Matrix4,oe=new r.Matrix4().makeScale(0,0,0),z=new Map,X=[],ae={near:0,far:0,culled:0},J=d=>{F=d;let g=new Set(d.near),b=new Set(d.far),v=0;for(let S of h){let T=S.indices.map((_,C)=>({global:_,k:C})).filter(({global:_})=>(S.far?b:g).has(_));T.forEach(({global:_},C)=>{Q.multiplyMatrices(i[_],S.local),S.mesh.setMatrixAt(C,z.has(_)?oe:Q)}),S.mesh.userData.slotToGlobal=T.map(_=>_.global),S.mesh.count=T.length,S.mesh.instanceMatrix.needsUpdate=!0,S.mesh.visible=T.length>0,T.length&&(S.mesh.computeBoundingSphere(),S.mesh.computeBoundingBox(),v++)}ae={near:d.near.length,far:d.far.length,culled:d.culled};for(let S of X)S.mesh.visible=(S.layer.far?b:g).has(S.global)},ve=(d=!1)=>{let g=t.getCentre();if(!g)return;let[b,v]=ke(c,[g.lng,g.lat]),S={x:b,z:v};!d&&K&&Math.hypot(S.x-K.x,S.z-K.z)<10||(K=S,J(Be(f,S,n,o,F)))};J({near:[],far:f.map((d,g)=>g),culled:0}),ve(!0);let fe=new r.Mesh(new r.BufferGeometry,new r.MeshBasicMaterial);return fe.name="building-types/driver",fe.frustumCulled=!1,fe.onBeforeRender=()=>ve(),a.add(fe),{anchor:c,group:a,suppress:Oe(e),radiusMetres:s,update:ve,setHighlighted(d,g){let b=re(),v=ce[b],S=new Set([...d].map(_=>String(_).replace(/^NL\.IMBAG\.Pand\./,"")));for(let _ of X)a.remove(_.mesh),_.mesh.dispose?.();X=[],z.clear(),e.forEach((_,C)=>{S.has(_.pand)?z.set(C,"highlight"):v.desaturate&&g&&Xe(g.lngLat,_.anchor)&&z.set(C,"dim")});let T=It(r);for(let[_,C]of z)for(let A of h){if(!A.indices.includes(_))continue;let E=A.mesh.material,$=C==="highlight"?v.keepMaterials?E:L(E)?T.highlighted(E,!0):Ce(r,E,"highlight",b):L(E)?T.dimmed(E,!0):Ce(r,E,"dim",b),B=new r.InstancedMesh(A.mesh.geometry,$,1);B.setMatrixAt(0,Q.multiplyMatrices(i[_],A.local)),B.name=`${A.mesh.name}/${C}`,B.userData.slotToGlobal=[_],B.computeBoundingSphere(),B.computeBoundingBox(),C==="highlight"&&qe(r,B,{style:b}),a.add(B),X.push({global:_,layer:A,mesh:B})}return F&&J(F),[...z.values()].filter(_=>_==="highlight").length},pandForHit(d,g){let b=d?.userData?.slotToGlobal;return g===void 0||!b?null:e[b[g]]?.pand??null},stats(){let d=h.filter(v=>v.mesh.visible&&v.mesh.count>0).length,g=0,b=0;for(let v of h)v.mesh.visible&&(v.far?b+=v.triangles*v.mesh.count:g+=v.triangles*v.mesh.count);return{instances:e.length,...ae,units:l.size,drawCalls:d,nearTriangles:g,farTriangles:b}},dispose(){for(let d of X)d.mesh.dispose?.();for(let d of h)d.mesh.dispose?.();for(let d of m)d.dispose();for(let d of I.values())d.dispose()}}}return Nt(dn);})();

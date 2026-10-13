"use strict";var CanalRecallBuildingTypes=(()=>{var Ce=Object.defineProperty;var Xt=Object.getOwnPropertyDescriptor;var qt=Object.getOwnPropertyNames;var Zt=Object.prototype.hasOwnProperty;var Jt=(t,e)=>{for(var r in e)Ce(t,r,{get:e[r],enumerable:!0})},Qt=(t,e,r,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let o of qt(e))!Zt.call(t,o)&&o!==r&&Ce(t,o,{get:()=>e[o],enumerable:!(n=Xt(e,o))||n.enumerable});return t};var er=t=>Qt(Ce({},"__esModule",{value:!0}),t);var On={};Jt(On,{areaAnchor:()=>Te,areaRadiusMetres:()=>jt,createBuildingTypes:()=>Kt,farMassing:()=>We,groupByArea:()=>Yt,instanceMatrix:()=>$e,partitionByDistance:()=>Ve,suppressionIds:()=>ze});var Ie={wallPull:.7,glassLift:.5,liftBrick:!0},Ye={wallPull:.35,glassLift:.25,liftBrick:!1},Dn={photo:{cells:"photo",shadeBands:0,flatColour:!1,...Ie,cartoonRoofCells:!1,outline:!1,litWallGain:255/225},procedural:{cells:"procedural",shadeBands:0,flatColour:!1,...Ie,cartoonRoofCells:!1,outline:!1,litWallGain:1},untextured:{cells:"procedural",shadeBands:0,flatColour:!0,...Ie,cartoonRoofCells:!1,outline:!1,litWallGain:1},storybook:{cells:"storybook",shadeBands:0,flatColour:!1,...Ye,cartoonRoofCells:!1,outline:!0,litWallGain:1,tone:{hueShift:-4,satMul:1.15,satAdd:0,keepDarkBelow:0,lightMul:1,lightAdd:.03,lightMax:.9}},cartoon:{cells:"cartoon",shadeBands:3,flatColour:!1,...Ye,cartoonRoofCells:!0,outline:!0,litWallGain:1,tone:{hueShift:0,satMul:1.7,satAdd:.08,keepDarkBelow:.35,lightMul:1.08,lightAdd:0,lightMax:.85}}};var ee=(t,e,r)=>Math.max(e,Math.min(r,t));function I(t){let e=/^#?([0-9a-f]{6})$/i.exec(t.trim());if(!e)throw Error(`Bad colour ${t}`);let r=parseInt(e[1],16);return[r>>16&255,r>>8&255,r&255]}var B=t=>"#"+t.map(e=>Math.round(ee(e,0,255)).toString(16).padStart(2,"0")).join("");function H([t,e,r]){let n=t/255,o=e/255,l=r/255,a=Math.max(n,o,l),i=Math.min(n,o,l),f=(a+i)/2;if(a===i)return[0,0,f];let s=a-i,u=f>.5?s/(2-a-i):s/(a+i);return[(a===n?(o-l)/s+(o<l?6:0):a===o?(l-n)/s+2:(n-o)/s+4)*60,u,f]}function V([t,e,r]){let n=(1-Math.abs(2*r-1))*e,o=n*(1-Math.abs(t/60%2-1)),l=r-n/2,[a,i,f]=t<60?[n,o,0]:t<120?[o,n,0]:t<180?[0,n,o]:t<240?[0,o,n]:t<300?[o,0,n]:[n,0,o];return[(a+l)*255,(i+l)*255,(f+l)*255]}var je=(t,e,r)=>[t[0]+(e[0]-t[0])*r,t[1]+(e[1]-t[1])*r,t[2]+(e[2]-t[2])*r];var ke={canal:-1/0,c19:1860,school:1915,modern:1945};var le={procedural:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:["#4b525c","#3f464f","#5a6068"]},untextured:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:["#4b525c","#3f464f","#5a6068"]},photo:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:["#4b525c","#3f464f","#5a6068"]},storybook:{tile:["#b9553a","#a94a33","#c46a45"],slate:["#556070","#4a5666","#657282"]},cartoon:{tile:["#e85a3c","#f08a2b","#d94a3a"],slate:["#3f5f8f","#2f4a78","#4f7bb0"]}};var se={gravel:{hex:"#9e9281",luma:[112,156],cell:"flat"},"bitumen-dark":{hex:"#56585e",luma:[62,96],cell:"flat"},"bitumen-light":{hex:"#a99b84",luma:[150,182],cell:"flat"},"white-membrane":{hex:"#d9d9d3",luma:[196,228],cell:"flat"},"pantile-red":{hex:"#b5543a",luma:[84,124],cell:"tile"},"pantile-dark":{hex:"#6a5248",luma:[64,98],cell:"tile"},slate:{hex:"#4b525c",luma:[62,140],cell:"slate"},zinc:{hex:"#9aa1a6",luma:[138,176],cell:"slate"},sedum:{hex:"#7a8350",luma:[96,132],cell:"flat"},solar:{hex:"#2e3a52",luma:[44,70],cell:"flat"},terrace:{hex:"#a38d74",luma:[124,162],cell:"flat"},glass:{hex:"#8fa3ad",luma:[130,170],cell:"flat"}},he={gravel:se.gravel.hex,membrane:se["white-membrane"].hex,bitumen:se["bitumen-dark"].hex,pebble:se["bitumen-light"].hex},Ke=[he.gravel,he.membrane,he.bitumen,he.pebble],te={tile:le.photo.tile,slate:le.photo.slate,flat:Ke};var pe={photo:{canal:["#7a3b2c","#7a3b2c","#6b3428","#8c4632","#9a5846","#b05a40","#4a2e26","#2e2a27","#3e4a40","#5d605a","#e4ddcd"],c19:["#b05a40","#b05a40","#bd6a45","#a24d38","#c58b5e","#d3b184","#e2d5ba","#e2d5ba","#d9c5a4","#9a5846"],school:["#8c4a38","#7a4535","#9a5240","#6e3d33","#a85a3c","#5e3a32","#b0603f"],modern:["#c9b79a","#b9ad9a","#a8a49c","#d3c6ad","#8f8a82","#bfb3a0","#9c7a62","#b05a40"]},storybook:{canal:["#b9583f","#9a4a38","#7a4a3c","#4a5048","#3f4a5a","#ead9b0","#c8664a"],c19:["#c8664a","#d98b5f","#e0b36a","#ead9b0","#d9b995","#c9a08c","#c8664a"],school:["#a8553f","#9a5a48","#b87a5c","#c8664a","#8a4e40"],modern:null},cartoon:{canal:["#d9453d","#a8433a","#3b3b4a","#2a9d8f","#4672b0","#fffaf0","#e8573d"],c19:["#e8573d","#ee7f2c","#f2b92e","#f3e6c8","#d96a4d","#f2b92e"],school:["#d96a4d","#e8573d","#b9583f","#ee7f2c"],modern:null}};var Bn={canal:{label:"canal-house centre (before 1860)",wall:pe.photo.canal[0],roof:le.photo.tile[0]},c19:{label:"19th-century ring (1860-1914)",wall:pe.photo.c19[0],roof:le.photo.tile[1]},school:{label:"Amsterdamse School (1915-1944)",wall:pe.photo.school[0],roof:le.photo.slate[0]},modern:{label:"post-war and contemporary (1945+)",wall:pe.photo.modern[0],roof:Ke[0]}};var Xe=["brick","stucco","accent","stone","frame","door","glass","roofTile","slate","bitumen","paint"],qe={brick:"brick",accent:"brick",stucco:"stucco",stone:"stone",frame:"frame",door:"door",glass:"glass",roofTile:"tile",slate:"slate",bitumen:"flat",paint:"frame"},z={brick:3.36,stucco:2.4,accent:3.36,stone:1.28,frame:1,door:1,glass:1,roofTile:1.2,slate:1.2,bitumen:1.2,paint:1},ce=[.3,.6],tr="#f1ede2",rr="#cfc8b8";function nr(t){let[e,r,n]=H(I(t)),o=ee(.12+n*.9,ce[0],ce[1]);return B(V([e,ee(r,.12,.5),o]))}function or(t){let[e,r,n]=H(I(t));return B(V([e,ee(r,0,.55),ee(n*1.06+.03,.4,.97)]))}function ar(t){let e=I(t),[r,n,o]=H(e);return o>=.5?B(je(e,I(tr),.75)):B(V([r,n,Math.max(o,.16)]))}function ir(t){let[e,r,n]=H(I(t));return B(je(V([e,r,Math.max(n,.62)]),I(rr),.45))}function sr(t){let[e,r,n]=H(I(t));return n>=.17?t.startsWith("#")?t.toLowerCase():"#"+t.toLowerCase():B(V([e,r<.15?0:r,.17]))}function lr(t,e){let r=H(I(e))[2];if(t==="roofTile"){let[n,o]=H(I(e));return o<.2?te.slate[1]:B(V([n,ee(o*1.1,.35,.6),ee(.2+r*.85,.38,.5)]))}return t==="slate"?r<.27?te.slate[1]:r<.31?te.slate[0]:te.slate[2]:r<.4?te.flat[2]:te.flat[0]}function Fe(t,e){switch(t){case"brick":case"accent":return nr(e);case"stucco":return or(e);case"stone":return ir(e);case"frame":return ar(e);case"door":return sr(e);case"glass":return"#ffffff";case"paint":return e.startsWith("#")?e.toLowerCase():"#"+e.toLowerCase();default:return lr(t,e)}}var Ze="#ffd21f",Je="#ff8033",Qe="#b4682c";var cr="highlight",ur="__canalRecallHighlight",fr="highlightAccent",mr="__canalRecallHighlightAccent",ue={yellow:{keepMaterials:!1,outline:!1,rim:!1,desaturate:!1,ring:!1,beacon:!1,wash:!1,animated:!1},a:{keepMaterials:!0,outline:!0,rim:!1,desaturate:!1,ring:!0,beacon:!0,wash:!0,animated:!1},b:{keepMaterials:!0,outline:!1,rim:!0,desaturate:!1,ring:!0,beacon:!1,wash:!1,animated:!0},c:{keepMaterials:!0,outline:!1,rim:!1,desaturate:!0,ring:!0,beacon:!1,wash:!1,animated:!1}};var dr=60,Z=.4,ge=2,at=3.5,et=100,hr=300;var pr=.75,Oe=.35,gr="__canalRecallHighlightBoost";function tt(){let t=Number(globalThis[gr]);return Number.isFinite(t)?Math.min(1,Math.max(0,t)):0}var br=.3,yr=2.4,xr=.9,Mr=2.2;function rt(t){if(typeof t!="string")return null;let e=t.trim().toLowerCase();return e==="a"||e==="outline"?"a":e==="b"||e==="rim"?"b":e==="c"||e==="desaturate"?"c":e==="yellow"||e==="0"||e==="off"||e==="old"?"yellow":e==="default"?Ee:null}var Ee="a";function re(t){try{let e=globalThis;if(t===void 0){let r=rt(e[ur]);if(r)return r}return rt(new URLSearchParams(t??e.location?.search??"").get(cr))??Ee}catch{return Ee}}function it(t=re(),e){if(t==="yellow")return Ze;try{let r=globalThis,n=(e===void 0?r[mr]:void 0)??new URLSearchParams(e??r.location?.search??"").get(fr);if(n==="hud")return Qe;if(typeof n=="string"&&/^#?[0-9a-f]{6}$/i.test(n))return n.startsWith("#")?n:`#${n}`}catch{}return Je}function st(t=re()){return ue[t].keepMaterials?{HL_KEEP:""}:{}}var De=`
#ifdef HL_KEEP
#define HL_PAINT(h) false
#else
#define HL_PAINT(h) ((h) > 0.5 && (h) < 1.5)
#endif
float hlState(float hidden) { return hidden > 2.5 ? 2.0 : (hidden > 1.5 ? 1.0 : 0.0); }
vec3 hlDesat(vec3 c, float h) { return h > 1.5 ? mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), ${Z.toFixed(2)}) : c; }`,wr=110540,vr=t=>111320*Math.cos(t*Math.PI/180);function Sr(t,e){let r=(t[1]+e[1])/2;return Math.hypot((t[0]-e[0])*vr(r),(t[1]-e[1])*wr)}var lt=(t,e,r=dr)=>!!t&&Sr(t,e)<=r;var nt=`
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
  float far = clamp((length(c4.xyz - hlEye) - ${et.toFixed(1)}) / ${(hr-et).toFixed(1)}, 0.0, 1.0);
  float width = hlWidthPx * mix(1.0, hlFarScale, far);
  if (dot(dir, dir) > 1e-12) clip.xy += normalize(dir) * width * 2.0 / hlViewport * clip.w;
#endif
  gl_Position = clip;
}`,Rr=`
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
  if (up < ${Oe.toFixed(2)} || hlWash <= 0.0) discard;
  gl_FragColor = vec4(hlAccent, hlWash * smoothstep(${Oe.toFixed(2)}, ${(Oe+.15).toFixed(2)}, up));
#else
  vec3 n = hlHasNormal > 0.5 ? normalize(vHlNormal) : normalize(cross(dFdx(vHlPos), dFdy(vHlPos)));
  vec3 v = normalize(hlEye - vHlPos);
  float f = pow(1.0 - abs(dot(n, v)), ${Mr.toFixed(2)});
  float pulse = 0.775 + 0.225 * sin(hlTime * 6.2831853 / ${yr.toFixed(2)});
  gl_FragColor = vec4(hlAccent * f * ${xr.toFixed(2)} * pulse, 1.0);
#endif
}`,be="canalRecallHighlightPass",Lr="__canalRecallHighlightOutlinePx";function _r(){let t=globalThis[Lr],e=t==null||t===""?NaN:Number(t);return Number.isFinite(e)&&e>=0?e:null}var Tr=(t,e)=>{let[r,n,o]=I(e);return new t.Vector3(r/255,n/255,o/255)};function Ar(t,e,r={}){let n={};r.merged&&(n.HL_MERGED=""),e==="outline"&&(n.HL_OUTLINE=""),e==="roof"&&(n.HL_ROOF="");let o=nt;if(r.feature){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(r.feature.attribute))throw new Error(`highlight: bad feature attribute ${r.feature.attribute}`);n.HL_FEATURE=r.feature.attribute,o=`attribute float ${r.feature.attribute};
uniform float hlFeatureId;
${nt}`}let l=new t.ShaderMaterial({defines:n,uniforms:{hlViewport:{value:new t.Vector2(1,1)},hlWidthPx:{value:ge},hlFarScale:{value:at/ge},hlCentre:{value:new t.Vector3},hlDepthPush:{value:br},hlAccent:{value:Tr(t,r.accent??it())},hlEye:{value:new t.Vector3},hlTime:{value:0},hlHasNormal:{value:1},hlFeatureId:{value:r.feature?.id??0},hlUp:{value:new t.Vector3(0,0,1)},hlWash:{value:0}},vertexShader:o,fragmentShader:Rr,side:e==="outline"?t.BackSide:t.FrontSide,transparent:!0,depthTest:!0,depthWrite:e==="outline",blending:e==="rim"?t.AdditiveBlending:t.NormalBlending,polygonOffset:e!=="outline",polygonOffsetFactor:-1,polygonOffsetUnits:e==="roof"?-4:-2});return l.name=`highlight/${e}${r.merged?"/merged":""}`,l.userData={[be]:!0},l.defaultAttributeValues={hidden:[0],normal:[0,0,0]},l}function Cr(t){for(let e of t?.userData?.[be]??[])t.remove(e),e.material.dispose();t?.userData&&delete t.userData[be]}function ct(t,e,r={}){Cr(e);let n=ue[r.style??re()],o=[...n.outline?["outline"]:[],...n.rim?["rim"]:[],...n.wash&&!r.feature?["roof"]:[]];if(!o.length||!e?.geometry)return[];let l=e.geometry,a=r.centre;if(!a){l.boundingBox||l.computeBoundingBox?.();let p=l.boundingBox?.getCenter(new t.Vector3);a=p?[p.x,p.y,p.z]:[0,0,0]}let i=l.getAttribute?.("normal")?1:0,f=[],s=new t.Matrix4,u=new t.Vector4,c=new t.Vector2,h=new t.Matrix3,d=new t.Vector3,w=r.up??[0,0,1];for(let p of o){let b=Ar(t,p,{merged:r.merged,feature:r.feature,accent:r.accent??it(r.style)});b.uniforms.hlCentre.value.set(a[0],a[1],a[2]),b.uniforms.hlHasNormal.value=i;let g=e.isInstancedMesh?new t.InstancedMesh(l,b,e.count):new t.Mesh(l,b);e.isInstancedMesh&&(g.instanceMatrix=e.instanceMatrix),g.name=`${e.name||"mesh"}/highlight-${p}`,g.frustumCulled=!1,g.castShadow=g.receiveShadow=!1,g.renderOrder=(e.renderOrder??0)+1,g.raycast=()=>{},p==="roof"&&Object.defineProperty(g,"visible",{get:()=>e.visible&&tt()>.001,set:()=>{},configurable:!0}),g.onBeforeRender=(v,k,U)=>{e.isInstancedMesh&&(g.count=e.count),p!=="roof"&&(g.visible=e.visible);let y=b.uniforms;if(p==="roof"){h.setFromMatrix4(g.matrixWorld),d.setFromMatrixColumn(g.matrixWorld,0);let $=d.length()<.001?[0,0,1]:w;y.hlUp.value.set($[0],$[1],$[2]).applyMatrix3(h.invert()).normalize(),y.hlWash.value=pr*tt()}v.getDrawingBufferSize(c),y.hlViewport.value.copy(c);let Y=v.domElement?.clientWidth||c.x,G=_r();y.hlWidthPx.value=(G??ge)*(c.x/Y),y.hlFarScale.value=G==null?at/ge:1,s.multiplyMatrices(U.projectionMatrix,U.matrixWorldInverse).multiply(g.matrixWorld).invert(),u.set(0,0,1,0).applyMatrix4(s),Math.abs(u.w)>1e-12&&y.hlEye.value.set(u.x/u.w,u.y/u.w,u.z/u.w),y.hlTime.value=performance.now()/1e3,b.uniformsNeedUpdate=!0},e.add(g),f.push(g)}return e.userData??={},e.userData[be]=f,f}var ot=new WeakMap;function Be(t,e,r,n=re()){if(!e||r==="plain"||r==="highlight"&&ue[n].keepMaterials)return e;let o=ot.get(e);o||ot.set(e,o=new Map);let l=`${r}|${n}`,a=o.get(l);if(a)return a;if(r==="highlight")a=new t.MeshLambertMaterial({color:16765471,emissive:7033856,side:e.side??t.FrontSide});else if(e.isShaderMaterial&&e.uniforms?.tint?.value?.isVector3)a=e.clone(),a.uniforms={...e.uniforms,tint:{value:Ir(e.uniforms.tint.value.clone())}};else if(e.isShaderMaterial)a=e.clone(),a.uniforms=e.uniforms,a.defines={...e.defines??{},HL_DIM_ALL:""};else{if(a=e.clone(),a.color){let i=a.color,f=.2126*i.r+.7152*i.g+.0722*i.b;i.setRGB(i.r+(f-i.r)*Z,i.g+(f-i.g)*Z,i.b+(f-i.b)*Z)}if(a.map){let i=a.onBeforeCompile;a.onBeforeCompile=(f,s)=>{i?.call(a,f,s),f.fragmentShader=f.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${Z.toFixed(2)});`)},a.customProgramCacheKey=()=>`${e.customProgramCacheKey?.()??""}|hl-dim`}}return a.name=`${e.name||"material"}/${r}`,a.userData={...e.userData??{},highlightVariantOf:e},o.set(l,a),a}function Ir(t){let e=.2126*t.x+.7152*t.y+.0722*t.z;return t.set(t.x+(e-t.x)*Z,t.y+(e-t.y)*Z,t.z+(e-t.z)*Z)}var ut="inferred",kr=t=>H(I(t))[1]<.2,Fr=t=>{let[e,r,n]=H(I(t));return(e<45||e>340)&&r>=.15&&n<.7},Or=t=>kr(t)?"slate":"roofTile",He=t=>Fr(t)?"brick":"stucco",Er=[{test:/glass|glaz|window|vitr|ruit|pane/,slot:"glass",confidence:"name",rule:"glazing name"},{test:/decal|sign|mural|logo|letter|clock|dial/,slot:"paint",confidence:"name",rule:"signage / decal"},{test:/door|deur|gate/,slot:"door",confidence:"name",rule:"door name"},{test:/frame|kozijn|louvre|louver|blind|shutter|rail|mullion|sash/,slot:"frame",confidence:"name",rule:"joinery name"},{test:/brick|baksteen|klinker|terracotta/,slot:"brick",confidence:"name",rule:"brick name"},{test:/slate|leien|lei$/,slot:"slate",confidence:"name",rule:"slate name"},{test:/bitumen|asphalt|tar$|felt|flatroof|flat-roof|gravel/,slot:"bitumen",confidence:"name",rule:"flat roof name"},{test:/roof|tile|pantile|dakpan|dak/,slot:Or,confidence:"name",rule:"roof name, grey \u2192 slate, else pantile"},{test:/sandstone|stone|steen|column|marble|granite|limestone|plinth/,slot:"stone",confidence:"name",rule:"stone name"},{test:/stucco|render|plaster|pleister|concrete|beton|slab/,slot:"stucco",confidence:"name",rule:"render / concrete name"},{test:/gold|gilt|bronze|copper|brass|zinc|metal|steel|iron|lead|alu/,slot:"paint",confidence:"name",rule:"metal name (flat colour)"},{test:/wall|facade|gevel/,slot:He,confidence:"name",rule:"wall name, brick hue \u2192 brick, else stucco"},{test:/ochre|yellow|buff/,slot:He,confidence:"colour-word",rule:"ochre: yellow brick (brick hue) or render"},{test:/pink|rose/,slot:"stucco",confidence:"colour-word",rule:"pink: painted render"},{test:/moss|grass|green|blue|orange|purple|paint|teal/,slot:"paint",confidence:"colour-word",rule:"coloured paint word"},{test:/white|cream|ivory/,slot:"stucco",confidence:"colour-word",rule:"white: stucco (could be white trim)"},{test:/dark|black|charcoal|anthracite/,slot:"frame",confidence:"colour-word",rule:"dark: painted joinery / ironwork (could be a dark wall)"},{test:/red/,slot:He,confidence:"colour-word",rule:"red: brick hue \u2192 brick (could be red tile or paint)"},{test:/grey|gray/,slot:"stucco",confidence:"colour-word",rule:"grey: render (could be concrete or zinc)"}];function ft(t){return String(t??"").toLowerCase().replace(/[-_.\s]*\d+$/,"").trim()}function Dr(t){let[e,r,n]=H(I(t));return n<.22?{slot:"frame",rule:"very dark: joinery / ironwork"}:r>=.15&&(e<45||e>340)&&n<.62?{slot:"brick",rule:"brick hue"}:r<.2&&n>=.6?{slot:"stucco",rule:"pale neutral: render"}:r<.2&&n>=.22&&e>180&&e<260?{slot:"slate",rule:"blue-grey: slate"}:r<.25?{slot:"stone",rule:"neutral mid-tone: stone"}:{slot:"paint",rule:"saturated colour: paint"}}function mt(t,e){let r=e.toLowerCase(),n=ft(t);for(let l of Er)if(l.test.test(n))return{slot:typeof l.slot=="function"?l.slot(r):l.slot,tint:r,confidence:l.confidence,rule:l.rule};let o=Dr(r);return{slot:o.slot,tint:r,confidence:"colour",rule:`no material word in "${n||"unnamed"}"; ${o.rule}`}}var dt=t=>/white|cream|ivory/.test(ft(t)),ht=t=>typeof t=="string"&&Xe.includes(t);var pt=["canal","c19","school","postwar","modern","tower"];var Hr=8;var lo=16+Math.log2(Hr);var A=256,Gr=["upper","ground","door","plain","shop"],Pr=2;var mo=pt.length*Pr*Gr.length;var N=t=>[1,3,5].map(e=>parseInt(t.slice(e,e+2),16));var ho=N("#7d93a0"),po=N("#1f2a33");var go=N("#b8ad98"),bo=N("#cfc6b4"),yo=N("#ece8dd"),xo=N("#e2d9c2"),Mo=[N("#2c4a3d"),N("#3a2a22"),N("#1f3b57"),N("#5a2a24")],wo=[N("#2f4a3a"),N("#7a2f27"),N("#27384f")];var gt=.6;function ye(t,e,r){let n=Math.imul(t|0,374761393)^Math.imul(e|0,668265263)^Math.imul(r|0,2246822519);return n=Math.imul(n^n>>>13,1274126177),((n^n>>>16)>>>0)/4294967296}function bt(t,e){let r=0;for(let o=0;o<t.length;o+=4)r+=t[o];let n=r/(t.length/4);for(let o=0;o<t.length;o+=4){let l=Math.round(Math.max(0,Math.min(255,n+(t[o]-n)*e)));t[o]=t[o+1]=t[o+2]=l}}function yt(t,e){let r=new Uint8ClampedArray(A*A*4),n=(o,l,a,i,f)=>{let s=(l*A+o)*4,u=f??[a,a,a];r[s]=u[0],r[s+1]=u[1],r[s+2]=u[2],r[s+3]=i};if(t==="flat")for(let o=0;o<A;o++)for(let l=0;l<A;l++)n(l,o,Math.round((e?.96:.9+(ye(l>>3,o>>3,3)-.5)*.08)*255),255);else if(t==="tile"){let a=A/8,i=A/5;for(let f=0;f<A;f++)for(let s=0;s<A;s++){let u=Math.floor(f/a),c=f%a/a,h=(s+u%2*i*.5)%A,d=Math.floor(h/i),w=h%i/i,p=Math.sin(w*Math.PI),b=e?.92:.7+.22*p-.28*Math.pow(Math.max(0,1-c*3.2),1.5)*0-.22*Math.max(0,(.18-c)/.18);e||(b+=(ye(d,u,7)-.5)*.14);let g=e?c<.07||w<.035||w>.965:!1;n(s,f,Math.round(Math.max(0,Math.min(1,g?.28:b))*255),255)}e||bt(r,gt)}else if(t==="slate"){let a=A/11,i=A/6;for(let f=0;f<A;f++)for(let s=0;s<A;s++){let u=Math.floor(f/a),c=f%a/a,h=(s+u%2*i*.5)%A,d=Math.floor(h/i),w=h%i/i,p=e?.9:.82+(ye(d,u,11)-.5)*.16-.16*Math.max(0,(.16-c)/.16);(w<(e?.05:.025)||c<(e?.09:.04))&&(p=e?.3:p*.7),n(s,f,Math.round(Math.max(0,Math.min(1,p))*255),255)}e||bt(r,gt)}else for(let f=0;f<A;f++)for(let s=0;s<A;s++){let u=s/A,c=f/A,h=u>.2-.06&&u<.8+.06&&c>.2-.06&&c<.82+.06,d=u>.2+.03&&u<.8-.03&&c>.2+.03&&c<.82-.03,w=Math.abs(u-.5)<.018||Math.abs(c-.5)<.018;if(d&&!w){let p=(c-.2)/.6199999999999999,b=e?[150+60*p,200+30*p,235]:[40+80*p*p,55+90*p*p,68+90*p*p];n(s,f,0,0,[b[0],b[1],b[2]])}else if(h)n(s,f,0,0,e?[255,250,240]:[236,232,221]);else{let p=e?.92:.85+(ye(s>>3,f>>3,5)-.5)*.12,b=e&&(s<5||f<5||s>A-6||f>A-6);n(s,f,Math.round((b?.3:p)*255),255)}}return r}function xt(t,e){let n=t.createElement("canvas");n.width=n.height=336;let o=n.getContext("2d",{willReadFrequently:!0});if(e)for(let s=0;s<336;s+=112)for(let u=0;u<336;u+=112)o.drawImage(e,u,s,112,112);else{let s=7,u=()=>(s=s*16807%2147483647)/2147483647;for(let c=0,h=0;h<336;h+=14,c++)for(let d=-(c%2)*24;d<336;d+=48){let w=150+u()*50;o.fillStyle=`rgb(${w},${w*.92},${w*.86})`,o.fillRect(d,h,48,14)}}o.strokeStyle="rgba(235,223,205,0.18)",o.lineWidth=1.7;for(let s=0,u=6;u<336;u+=14,s++){o.beginPath(),o.moveTo(0,u),o.lineTo(336,u),o.stroke();for(let c=s%2*24;c<336;c+=48)o.beginPath(),o.moveTo(c,u),o.lineTo(c,u+14),o.stroke()}let l=o.getImageData(0,0,336,336),a=l.data,i=0;for(let s=0;s<a.length;s+=4)i+=(a[s]+a[s+1]+a[s+2])/3;i/=a.length/4;let f=i>0?Math.min(2.4,225/i):1;for(let s=0;s<a.length;s+=4){let u=(a[s]+a[s+1]+a[s+2])/3,c=Math.min(255,(u+(i-u)*.7)*f);a[s]=a[s+1]=a[s+2]=c,a[s+3]=255}return o.putImageData(l,0,0),n}function Mt(t){let e=t.createElement("canvas");e.width=64,e.height=128;let r=e.getContext("2d"),n=r.createLinearGradient(0,0,0,128);return n.addColorStop(0,"#8aa1b0"),n.addColorStop(.5,"#4d606c"),n.addColorStop(1,"#3c474e"),r.fillStyle=n,r.fillRect(0,0,64,128),r.fillStyle="rgba(235,242,248,0.16)",r.beginPath(),r.moveTo(10,0),r.lineTo(34,0),r.lineTo(4,70),r.lineTo(-20,70),r.closePath(),r.fill(),e}function wt(t){let e=t.createElement("canvas");e.width=e.height=128;let r=e.getContext("2d");r.fillStyle="#ffffff",r.fillRect(0,0,128,128),r.fillStyle="rgba(0,0,0,0.10)";for(let n=0;n<128;n+=16)r.fillRect(n,0,1.5,128);return e}function vt(t){let e=t.createElement("canvas");e.width=e.height=128;let r=e.getContext("2d"),n=r.createImageData(128,128),o=23,l=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++){let i=(l()-.5)*3;for(let f=0;f<128;f++){let s=(a*128+f)*4,u=l()<.012?-14:0,c=243+(l()-.5)*8+i+u;n.data[s]=n.data[s+1]=n.data[s+2]=c,n.data[s+3]=255}}return r.putImageData(n,0,0),e}function St(t){let e=t.createElement("canvas");e.width=e.height=128;let r=e.getContext("2d"),n=r.createImageData(128,128),o=11,l=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<n.data.length;a+=4){let i=228+(l()-.5)*16;n.data[a]=n.data[a+1]=n.data[a+2]=i,n.data[a+3]=255}return r.putImageData(n,0,0),r.fillStyle="rgba(80,70,60,0.18)",r.fillRect(0,0,128,1.5),e}function xe(t,e){let r=yt(e,!1),n=Math.round(Math.sqrt(r.length/4)),o=t.createElement("canvas");o.width=o.height=n;let l=o.getContext("2d"),a=l.createImageData(n,n);for(let i=0;i<r.length;i+=4)a.data[i]=r[i],a.data[i+1]=r[i+1],a.data[i+2]=r[i+2],a.data[i+3]=255;return l.putImageData(a,0,0),o}var Nr=238;function Rt(t,e){let n=t.createElement("canvas");n.width=n.height=336;let o=n.getContext("2d",{willReadFrequently:!0});if(e)for(let s=0;s<336;s+=112)for(let u=0;u<336;u+=112)o.drawImage(e,u,s,112,112);else{let s=13,u=()=>(s=s*16807%2147483647)/2147483647;for(let c=0,h=0;h<336;h+=14,c++)for(let d=-(c%2)*24;d<336;d+=48){let w=165+u()*30;o.fillStyle=`rgb(${w},${w*.93},${w*.88})`,o.fillRect(d,h,48,14)}}o.strokeStyle="rgba(245,240,230,0.26)",o.lineWidth=1.2;for(let s=0,u=6;u<336;u+=14,s++){o.beginPath(),o.moveTo(0,u),o.lineTo(336,u),o.stroke();for(let c=s%2*24;c<336;c+=48)o.beginPath(),o.moveTo(c,u),o.lineTo(c,u+14),o.stroke()}let l=o.getImageData(0,0,336,336),a=l.data,i=0;for(let s=0;s<a.length;s+=4)i+=(a[s]+a[s+1]+a[s+2])/3;i/=a.length/4;let f=i>0?Math.min(2.6,Nr/i):1;for(let s=0;s<a.length;s+=4){let u=(a[s]+a[s+1]+a[s+2])/3,c=Math.min(255,(u+(i-u)*.82)*f);a[s]=a[s+1]=a[s+2]=c,a[s+3]=255}return o.putImageData(l,0,0),n}function Lt(t){let e=t.createElement("canvas");e.width=e.height=128;let r=e.getContext("2d"),n=r.createImageData(128,128),o=31,l=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++)for(let i=0;i<128;i++){let f=(a*128+i)*4,s=246+(l()-.5)*3;n.data[f]=n.data[f+1]=n.data[f+2]=s,n.data[f+3]=255}return r.putImageData(n,0,0),e}function _t(t){let e=t.createElement("canvas");e.width=e.height=4;let r=e.getContext("2d");return r.fillStyle="#fff",r.fillRect(0,0,4,4),e}var Tt=[-1,-1];var At=[-1,-1],Ct=()=>[70,190,.5],Me=t=>Number.isInteger(t)?t.toFixed(1):String(t),It=`
uniform vec2 roofLayers;
uniform vec3 roofTier;
vec3 roofTierColour(vec3 fine, vec2 uv, float layer, float dist) {
  if (roofLayers.x < 0.0 || layer < roofLayers.x - 0.5 || layer > roofLayers.y - 0.5) return fine;
  float mid = smoothstep(roofTier.x - ${Me(15)}, roofTier.x + ${Me(15)}, dist);
  if (mid <= 0.0) return fine;
  float far = smoothstep(roofTier.y - ${Me(40)}, roofTier.y + ${Me(40)}, dist);
  vec3 coarse = texture(cells, vec3(uv * roofTier.z, layer)).rgb;
  vec3 flatMean = textureLod(cells, vec3(uv, layer), 8.0).rgb;
  return mix(mix(fine, coarse, mid), flatMean, far);
}`,kt=`
uniform vec2 cellTier;
void cellTierSample(vec3 p, float dist, out vec3 c, out vec2 m) {
  c = texture(cells, p).rgb; m = texture(masks, p).rg;
  if (cellTier.x < 0.0) return;
  float rho = max(length(dFdx(p.xy)), length(dFdy(p.xy))) * float(textureSize(cells, 0).x);
  float far = smoothstep(cellTier.x, cellTier.y, rho);
  if (far <= 0.0) return;
  c = mix(c, textureLod(cells, p, 8.0).rgb, far); m = mix(m, textureLod(masks, p, 8.0).rg, far);
}`;var Ge={sunAzimuthDeg:215,sunElevationDeg:40,sunColour:"#ffe9cc",sunIntensity:2.15,skyColour:"#e3ebf6",groundColour:"#998a72",skyIntensity:1.75,shadows:!0,shadowMapSize:2048};function Ur(t,e){let r=t*Math.PI/180,n=e*Math.PI/180;return[Math.sin(r)*Math.cos(n),Math.cos(r)*Math.cos(n),Math.sin(n)]}var Fo=Ur(Ge.sunAzimuthDeg,Ge.sunElevationDeg),ve=(()=>{let t=Ge.sunAzimuthDeg*Math.PI/180;return[Math.sin(t),Math.cos(t)]})(),we=[ve[0]*.6,ve[1]*.6,.8],Ft=.84;function $r(t){let e=t[0]*we[0]+t[1]*we[1]+t[2]*we[2];return Math.max(.5,Math.min(1,.58+.42*Math.max(0,e)))}var Oo=$r([0,0,1]),fe=t=>Number.isInteger(t)?t.toFixed(1):String(+t.toFixed(6)),Se=`
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = ${fe(Ft)} + ${fe(1-Ft)} * (0.5 + 0.5 * dot(h, vec2(${fe(ve[0])}, ${fe(ve[1])}))); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, dot(n, vec3(${we.map(fe).join(", ")}))), 0.5, 1.0);`;var K=.9,me=255/225,zr=255/228,Wr=255/243,Vr=255/246,_e=[{cell:"brick",tileM:z.brick,clampUv:!1,litGain:me*K,skyTint:!1},{cell:"stucco",tileM:z.stucco,clampUv:!1,litGain:Wr*K,skyTint:!1},{cell:"stone",tileM:z.stone,clampUv:!1,litGain:zr*K,skyTint:!1},{cell:"white",tileM:1,clampUv:!1,litGain:1,skyTint:!1},{cell:"door",tileM:z.door,clampUv:!1,litGain:1,skyTint:!1},{cell:"glass",tileM:z.glass,clampUv:!0,litGain:1,skyTint:!0},{cell:"tile",tileM:z.roofTile,clampUv:!1,litGain:me*K,skyTint:!1},{cell:"slate",tileM:z.slate,clampUv:!1,litGain:me*K,skyTint:!1},{cell:"flat",tileM:z.bitumen,clampUv:!1,litGain:me*K,skyTint:!1},{cell:"brick20",tileM:z.brick,clampUv:!1,litGain:me*K,skyTint:!1},{cell:"whiteStucco",tileM:z.stucco,clampUv:!1,litGain:Vr*K,skyTint:!1}],Le=_e.length,Re=Object.fromEntries(_e.map((t,e)=>[t.cell,e])),Yr=ke.school;function Ht(t,e={}){let r=qe[t];return r==="brick"&&typeof e.year=="number"&&e.year>=Yr?Re.brick20:r==="stucco"&&e.white?Re.whiteStucco:r==="frame"?Re.white:Re[r]}function jr(){return _e.map(t=>[1/t.tileM,t.clampUv?1:0,t.litGain,t.skyTint?1:0])}var Kr=.38,Xr=.8,qr=.75,Zr=.5,Jr=.12,Qr=(t,e)=>(t<45||t>340)&&e>=.2;function en(t,e){let r=I(e),[n,o,l]=H(r);return t==="slate"&&Qr(n,o)?Fe("roofTile",e):(t==="brick"||t==="accent")&&o<Jr?B(V([n,o,Math.min(ce[1],Math.max(ce[0],.12+l*.9))])):t==="slate"&&l>Kr?B(V([n,Math.min(o,.12),Math.min(.72,l/Xr)])):t==="frame"&&l>=.5&&l<qr?B(r):t==="stone"&&l<Zr?B(r):Fe(t,e)}function tn(t,e){let[r,n,o]=I(en(t,e));return[r,n,o,255]}function rn(t,e,r){switch(e){case"brick":return xt(t,r);case"brick20":return Rt(t,r);case"stucco":return vt(t);case"whiteStucco":return Lt(t);case"stone":return St(t);case"white":case"frame":return _t(t);case"door":return wt(t);case"glass":return Mt(t);case"tile":return xe(t,"tile");case"slate":return xe(t,"slate");case"flat":return xe(t,"flat")}}function nn(t,e,r){let n=r*r,o=new Uint8Array(n*4*Le),l=new Uint8Array(n*2*Le),a=t.createElement("canvas");a.width=a.height=r;let i=a.getContext("2d",{willReadFrequently:!0});return i.imageSmoothingQuality="high",_e.forEach((f,s)=>{i.clearRect(0,0,r,r),i.drawImage(rn(t,f.cell,e),0,0,r,r);let u=i.getImageData(0,0,r,r).data;for(let c=0;c<r;c++)for(let h=0;h<r;h++){let d=((r-1-c)*r+h)*4,w=s*n+c*r+h;o[w*4]=u[d],o[w*4+1]=u[d+1],o[w*4+2]=u[d+2],o[w*4+3]=255,l[w*2]=255,l[w*2+1]=0}}),{colour:o,mask:l}}async function on(t=document){let e=new Image;e.src=new URL("materials/ambientcg/Bricks057/colour.jpg",t.baseURI).href;try{return await e.decode(),e}catch{return null}}var Pe=t=>`${t.lit?"lit":"unlit"}|${t.kind}|${t.kind==="slot"?t.uv??"uv":"-"}|${t.highlight?"hl":t.dim?"dim":"-"}|${t.side??0}`;function an(t){let e={CITY_SLOT_COUNT:String(Le)};return t.kind==="slot"&&(e.CITY_SLOT=""),t.kind==="slot"&&t.uv==="box"&&(e.CITY_BOX_UV=""),t.highlight?e.CITY_HIGHLIGHT="":t.dim&&(e.CITY_DIM=""),{...e,...st()}}var sn="vec3(1.0, 0.824, 0.122)",Ot="vec3(1.0, 0.637, 0.0137)",Et="vec3(0.035, 0.05, 0.07)",ln=1,cn=.2,un=.75,fn=1.8,ne=t=>Number.isInteger(t)?t.toFixed(1):String(t),mn=`
float cityGrain(vec3 cell) {
  float g = clamp(dot(cell, vec3(0.299, 0.587, 0.114)) / ${ne(225/255)}, 0.45, 1.1);
  return mix(1.0, g, ${ne(un)});
}`,Gt=`
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
${De}`,Pt=`
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
#endif`,Nt=`
vFacDist = length((modelViewMatrix * vec4(position, 1.0)).xyz);
if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`,Ut=`
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${It}
${kt}
varying vec2 vFacUv;
flat varying float vLayer;
flat varying vec4 vSlot;
varying vec3 vTint;
varying vec3 vAccent;
flat varying float vHighlight;
varying float vFacDist;
${mn}
${De}`,$t=`
if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;`,zt=`
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
cityC *= mix(vec3(1.0), vTint, cityM.r) * mix(vec3(1.0), vAccent, cityM.g);`,dn=`
uniform mat3 enuFromWorld;
${Gt}
varying float vShade;
void main() {
${Pt}
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
${Se}
  vShade = shade;
#else
  vShade = tint.a;
#endif
${Nt}
}`,hn=`
precision highp float;
${Ut}
varying float vShade;
void main() {
${$t}
${zt}
  if (HL_PAINT(vHighlight)) {
    float hlShade = clamp(1.0 - (1.0 - vShade) * ${ne(fn)}, 0.6, 1.0);
    gl_FragColor = vec4(${sn} * (flatColour > 0.5 ? 1.0 : cityG) * hlShade, 1.0);
    return;
  }
  if (flatColour > 0.5) cityC = vTint;
  cityC = hlDesat(cityC, vHighlight);
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  gl_FragColor = vec4(cityC * shade, 1.0);
}`;function pn(t,e={}){return{cells:e.cells??{value:null},masks:e.masks??{value:null},slotBase:e.slotBase??{value:0},slotParams:e.slotParams??{value:jr().map(r=>new t.Vector4(...r))},bands:e.bands??{value:0},flatColour:e.flatColour??{value:0},cityFade:e.cityFade??{value:1},wallGain:e.wallGain??{value:1},roofLayers:e.roofLayers??{value:At},roofTier:e.roofTier??{value:Ct()},cellTier:e.cellTier??{value:Tt},enuFromWorld:e.enuFromWorld??{value:new t.Matrix3}}}var gn={accent:[1,1,1,1],hidden:[0],color:[1,1,1],uv:[0,0],uv1:[0,0]},Ne="recipeLookShared";function bn(t,e,r){let n=an(e),o=e.side??t.FrontSide,l;return e.lit?(l=new t.MeshLambertMaterial({side:o,flatShading:e.kind==="chunk"}),l.defines={...l.defines??{},...n},l.onBeforeCompile=a=>{for(let i of Object.keys(r))a.uniforms[i]=r[i];a.vertexShader=a.vertexShader.replace("#include <common>",`#include <common>${Gt}`).replace("#include <begin_vertex>",`#include <begin_vertex>${Pt}`).replace("#include <project_vertex>",`#include <project_vertex>${Nt}`),a.fragmentShader=a.fragmentShader.replace("#include <common>",`#include <common>${Ut}
float cityLuma;`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>${$t}`).replace("#include <map_fragment>",`${zt}
#ifdef CITY_SLOT
cityC *= vSlot.z;
#else
cityC *= mix(1.0, wallGain * ${ne(K)}, cityM.r);
#endif
if (flatColour > 0.5) cityC = vTint;
cityLuma = dot(cityC, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= HL_PAINT(vHighlight) ? ${Ot} * ${ne(ln)} * pow(flatColour > 0.5 ? 1.0 : cityG, 2.2) : pow(hlDesat(cityC, vHighlight), vec3(2.2));`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
if (HL_PAINT(vHighlight)) totalEmissiveRadiance += ${Ot} * ${ne(cn)};
#ifdef CITY_SLOT
else totalEmissiveRadiance += ${Et} * vSlot.w;
#else
// Bay glazing (dark, untinted texels): the same constant sky tint as landmark glass, never a hotspot.
else totalEmissiveRadiance += ${Et} * (1.0 - smoothstep(0.06, 0.2, cityLuma)) * (1.0 - cityM.r);
#endif`)},l.customProgramCacheKey=()=>`city-look-v3|${Pe({...e,side:0})}`,l.uniforms=r):l=new t.ShaderMaterial({uniforms:r,defines:n,vertexShader:dn,fragmentShader:hn,side:o}),l.defaultAttributeValues={...gn},l.name=`city-look/${Pe(e)}`,l.userData={cityLook:!0,cityVariant:{...e},[Ne]:!0},l}function yn(t){return t?t.isMeshBasicMaterial||t.userData?.unlit?"unlit (decal / emissive sign)":t.transparent||(t.opacity??1)<1?"transparent":t.vertexColors?"vertex colours":t.map?"own texture":null:"no material"}function xn(t,e){let r=t?.userData??{};if(ht(r.materialSlot)&&typeof r.tint=="string")return{slot:r.materialSlot,tint:r.tint,inferred:r.materialSlotSource===ut};if(!e||yn(t)||!t.color)return null;let n="#"+t.color.getHexString(),o=mt(t.name,n);return{slot:o.slot,tint:o.tint,inferred:!0}}function Dt(t,e,r,n,o={}){let l=e.getAttribute("position")?.count??0,a=Ht(r,o),i=tn(r,n),f=e.getAttribute("layer"),s=e.getAttribute("tint");if(f&&s)return f.getX(0)===a&&Math.round(s.getX(0)*255)===i[0]&&Math.round(s.getY(0)*255)===i[1]&&Math.round(s.getZ(0)*255)===i[2];e.setAttribute("layer",new t.BufferAttribute(new Uint8Array(l).fill(a),1,!1));let u=new Uint8Array(l*4);for(let c=0;c<l;c++)u.set(i,c*4);return e.setAttribute("tint",new t.BufferAttribute(u,4,!0)),!0}var Mn="__canalRecallCityLookShared";function Wt(t,e={}){let r=globalThis,n=r[Mn]??=new Map,o=n.get(t);return o||n.set(t,o=wn(t,e)),o}function wn(t,e={}){let r=e.document??globalThis.document,n=e.size??(globalThis.matchMedia?.("(pointer: coarse)").matches?128:256),o=pn(t),l=new Map,a=null,i=!1,f=(c,h)=>{let d=new t.DataArrayTexture(c,n,n,Le);return d.format=h,d.type=t.UnsignedByteType,d.wrapS=d.wrapT=t.RepeatWrapping,d.minFilter=t.LinearMipmapLinearFilter,d.magFilter=t.LinearFilter,d.generateMipmaps=!0,d.anisotropy=e.anisotropy??4,d.unpackAlignment=1,d.needsUpdate=!0,d.userData={bytes:c.byteLength,[Ne]:!0},d},s=(async()=>{if(!r)return;let c=e.brick!==void 0?e.brick:await on(r),{colour:h,mask:d}=nn(r,c,n);a={colour:f(h,t.RGBAFormat),mask:f(d,t.RGFormat)},i||(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)})(),u=c=>{let h=Pe(c),d=l.get(h);return d||l.set(h,d=bn(t,c,o)),d};return{uniforms:o,ready:s,material:u,dress(c,{lit:h,infer:d=!1,year:w=null}){let p=0;return c.traverse(b=>{if(!b.isMesh||Array.isArray(b.material)||b.material?.userData?.cityLook)return;let g=xn(b.material,d);if(!g)return;let v=b.geometry;if(!v?.getAttribute("position"))return;let k=!!v.getAttribute("uv");!k&&!v.getAttribute("normal")&&v.computeVertexNormals();let U={year:w,white:g.inferred&&dt(b.material.name)};Dt(t,v,g.slot,g.tint,U)||(v=b.geometry=v.clone(),v.deleteAttribute("layer"),v.deleteAttribute("tint"),Dt(t,v,g.slot,g.tint,U));let y=b.material;b.material=u({lit:h,kind:"slot",uv:k?"uv":"box",side:y.side}),b.userData.citySlot={slot:g.slot,tint:g.tint,inferred:g.inferred,from:y.name,layer:Ht(g.slot,U)},y.userData?.[Ne]||y.dispose(),p++}),p},highlighted(c,h){let d=c?.userData?.cityVariant;return d?u({...d,highlight:h,dim:!1}):c},dimmed(c,h){let d=c?.userData?.cityVariant;return d?u({...d,highlight:!1,dim:h}):c},bindAtlas(c){i=!!c,c?(o.cells.value=c.colour,o.masks.value=c.mask,o.slotBase.value=c.slotBase):a&&(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)},textureBytes(){return a&&!i?Math.round((a.colour.userData.bytes+a.mask.userData.bytes)*4/3):0}}}var vn=2*Math.PI*6378137;function Vt(t,e){return[(180+t)/360,(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+e*Math.PI/360)))/360]}var Sn=t=>1/vn/Math.cos(t*Math.PI/180);function Ue(t,e){let[r,n]=Vt(t[0],t[1]),[o,l]=Vt(e[0],e[1]),a=Sn(t[1]);return[(o-r)/a,(l-n)/a]}function Te(t){let e=t.map(n=>n.anchor[0]),r=t.map(n=>n.anchor[1]);return[(Math.min(...e)+Math.max(...e))/2,(Math.min(...r)+Math.max(...r))/2]}var Rn=t=>Math.PI-(180+t)*Math.PI/180;function $e(t,e){let[r,n]=Ue(e,t.anchor),o=Rn(t.northOffsetDegrees),l=Math.cos(o),a=Math.sin(o),[i,f,s]=t.scale;return[l*i,0,-a*i,0,0,f,0,0,a*s,0,l*s,0,r,t.groundAltitudeMetres,n,1]}function Yt(t){let e=new Map;for(let r of t)e.set(r.area??"default",[...e.get(r.area??"default")??[],r]);return e}function jt(t){let e=Te(t);return Math.max(50,...t.map(r=>Math.hypot(...Ue(e,r.anchor))))+30}var Ln=t=>`NL.IMBAG.Pand.${t}`;function ze(t){return[...new Set(t.map(e=>Ln(e.pand)))].sort()}function We(t){let e=t.L0/2,r=t.W0/2,n=t.E0,o={positions:[],normals:[],uvs:[],index:[]},l={positions:[],normals:[],uvs:[],index:[]},a=(c,h,d,w,p,b,g)=>{let v=c.positions.length/3;for(let k of[h,d,w,p])c.positions.push(...k),c.normals.push(...b),c.uvs.push(...g(k));c.index.push(v,v+1,v+2,v,v+2,v+3)},i=c=>[c[0],c[1]],f=c=>[c[2],c[1]],s=c=>[c[0],c[2]];a(o,[-e,0,r],[e,0,r],[e,n,r],[-e,n,r],[0,0,1],i),a(o,[e,0,-r],[-e,0,-r],[-e,n,-r],[e,n,-r],[0,0,-1],i),a(o,[e,0,r],[e,0,-r],[e,n,-r],[e,n,r],[1,0,0],f),a(o,[-e,0,-r],[-e,0,r],[-e,n,r],[-e,n,-r],[-1,0,0],f);let u=t.R0!==void 0&&t.R0>n+.3?t.R0:void 0;if(u===void 0)a(l,[-e,n,r],[e,n,r],[e,n,-r],[-e,n,-r],[0,1,0],s);else{let c=u-n,h=Math.hypot(r,c),d=c/h,w=r/h;a(l,[-e,n,r],[e,n,r],[e,u,0],[-e,u,0],[0,w,d],s),a(l,[e,n,-r],[-e,n,-r],[-e,u,0],[e,u,0],[0,w,-d],s);let p=(b,g,v)=>{let k=o.positions.length/3,U=v?[[b,n,-r],[b,n,r],[b,u,0]]:[[b,n,r],[b,n,-r],[b,u,0]];for(let y of U)o.positions.push(...y),o.normals.push(g,0,0),o.uvs.push(...f(y));o.index.push(k,k+1,k+2)};p(e,1,!1),p(-e,-1,!0)}return{walls:o,roof:l}}function Ve(t,e,r,n,o,l=20){let a=new Set(o?.near),i=new Set(o?.far),f=[],s=[];return t.forEach((u,c)=>{let h=Math.hypot(u.x-e.x,u.z-e.z),d=a.has(c)?r+l:r-(i.has(c)?l:0),w=a.has(c)||i.has(c)?n+l:n;h<=d?f.push(c):h<=w&&s.push(c)}),{near:f,far:s,culled:t.length-f.length-s.length}}var _n=140,Tn=700;function An(t){let e=t.reduce((a,i)=>a+i.positions.length/3,0),r=t.reduce((a,i)=>a+(i.index?i.index.length:i.positions.length/3),0),n={positions:new Float32Array(e*3),normals:new Float32Array(e*3),uvs:new Float32Array(e*2),textures:new Float32Array(e),tints:new Float32Array(e*3),index:new Uint32Array(r)},o=0,l=0;for(let a of t){let i=a.matrix,f=a.positions.length/3,s=i[0],u=i[4],c=i[8],h=i[1],d=i[5],w=i[9],p=i[2],b=i[6],g=i[10],v=[d*g-w*b,w*p-h*g,h*b-d*p,c*b-u*g,s*g-c*p,u*p-s*b,u*w-c*d,c*h-s*w,s*d-u*h],k=s*v[0]+u*v[1]+c*v[2]<0;for(let y=0;y<f;y++){let Y=a.positions[y*3],G=a.positions[y*3+1],$=a.positions[y*3+2],E=(o+y)*3;n.positions[E]=i[0]*Y+i[4]*G+i[8]*$+i[12],n.positions[E+1]=i[1]*Y+i[5]*G+i[9]*$+i[13],n.positions[E+2]=i[2]*Y+i[6]*G+i[10]*$+i[14];let X=a.normals[y*3],J=a.normals[y*3+1],oe=a.normals[y*3+2],j=v[0]*X+v[1]*J+v[2]*oe,q=v[3]*X+v[4]*J+v[5]*oe,ae=v[6]*X+v[7]*J+v[8]*oe,Q=(Math.hypot(j,q,ae)||1)*(k?-1:1);n.normals[E]=j/Q,n.normals[E+1]=q/Q,n.normals[E+2]=ae/Q,n.uvs[(o+y)*2]=a.uvs[y*2]*a.uvScale,n.uvs[(o+y)*2+1]=a.uvs[y*2+1]*a.uvScale,n.textures[o+y]=a.texture,n.tints[E]=a.tint[0],n.tints[E+1]=a.tint[1],n.tints[E+2]=a.tint[2]}let U=a.index?a.index.length:f;for(let y=0;y<U;y+=3){let Y=a.index?a.index[y]:y,G=a.index?a.index[y+1]:y+1,$=a.index?a.index[y+2]:y+2;n.index[l++]=o+Y,n.index[l++]=o+(k?$:G),n.index[l++]=o+(k?G:$)}o+=f}return n}function Cn(t){let e=Math.max(1,t),r=Array.from({length:e},(n,o)=>o===e-1?`c = texture2D(t${o}, vUv).rgb;`:`if (vTex < ${o}.5) c = texture2D(t${o}, vUv).rgb; else`).join(`
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
${Se}
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
}`}}function In(t,e,r){if(!e?.isShaderMaterial)return e;let n=r.get(e);if(!n){let o=String(e.vertexShader).replace("mat3(modelMatrix) * normal","mat3(modelMatrix * instanceMatrix) * normal").replace("modelViewMatrix * vec4(position, 1.0)","modelViewMatrix * instanceMatrix * vec4(position, 1.0)");if(o===e.vertexShader)throw new Error("recipe look vertex shader changed: instancing patch no longer applies");n=new t.ShaderMaterial({uniforms:e.uniforms,vertexShader:o,fragmentShader:e.fragmentShader,side:e.side}),n.name=`${e.name}/instanced`,n.userData={...e.userData},r.set(e,n)}return n}var kn=new Set(["brick","stucco","stone"]),Fn=new Set(["roofTile","slate","bitumen"]);async function Kt(t,e){let{THREE:r}=t,n=t.nearMetres??_n,o=t.cullMetres??Tn;if(!e.length)throw new Error("no building-type instances");let l=Te(e),a=new r.Group;a.name="building-types";let i=e.map(m=>new r.Matrix4().fromArray($e(m,l))),f=i.map(m=>({x:m.elements[12],z:m.elements[14]})),s=Math.max(50,...f.map(m=>Math.hypot(m.x,m.z)))+30,u=new Map,c=new Map;e.forEach((m,x)=>c.set(m.unit,[...c.get(m.unit)??[],x]));let h=[],d=[],w=[],p=[],b=m=>!!(m?.isShaderMaterial&&m.uniforms?.map?.value&&m.uniforms.tint?.value&&m.uniforms.uvScale&&m.uniforms.enuFromWorld),g=m=>!!m?.userData?.cityLook,v=m=>b(m)||g(m);for(let[m,x]of c){let M=await t.loadUnit(m);M.updateMatrixWorld(!0);let S;M.traverse(_=>{_.userData?.nominal&&(S=_.userData.nominal)});let R=[];M.traverse(_=>{_.isMesh&&R.push(_)});for(let _ of R)b(_.material)&&!p.includes(_.material.uniforms.map.value)&&p.push(_.material.uniforms.map.value);w.push({unit:m,indices:x,meshes:R,nominal:S})}let k=new Map,U=m=>{if(g(m))return m;let x=k.get(m.side);if(!x){let M={enuFromWorld:m.uniforms.enuFromWorld};p.forEach((S,R)=>{M[`t${R}`]={value:S}}),x=new r.ShaderMaterial({uniforms:M,...Cn(p.length),side:m.side}),x.name="building-types/merged",x.userData={recipeLookShared:!0},k.set(m.side,x)}return x},y=(m,x,M)=>{if(g(m.material)){let R=m.geometry.getAttribute("layer"),_=m.geometry.getAttribute("tint");return{...x,matrix:M,uvScale:1,texture:R.getX(0),tint:[_.getX(0),_.getY(0),_.getZ(0)]}}let S=m.material.uniforms.tint.value;return{...x,matrix:M,uvScale:m.material.uniforms.uvScale.value,texture:p.indexOf(m.material.uniforms.map.value),tint:[S.x,S.y,S.z]}},Y=(m,x=!1)=>{let M=new r.BufferGeometry;return M.setAttribute("position",new r.BufferAttribute(m.positions,3)),M.setAttribute("normal",new r.BufferAttribute(m.normals,3)),M.setAttribute("uv",new r.BufferAttribute(m.uvs,2)),M.setAttribute(x?"layer":"aTex",new r.BufferAttribute(m.textures,1)),M.setAttribute(x?"tint":"aTint",new r.BufferAttribute(m.tints,3)),M.setIndex(new r.BufferAttribute(m.index,1)),d.push(M),M},G=(m,x)=>{let M=[];for(let S=0;S<m.count;S++)M.push(m.getX(S)),x>1&&M.push(m.getY(S)),x>2&&M.push(m.getZ(S));return M},$=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];for(let{unit:m,indices:x,meshes:M,nominal:S}of w){let R=new Map,_=new Map,L=new Map;for(let T of M){let C=T.geometry;if(!v(T.material)){let W=new r.InstancedMesh(C,In(r,T.material,u),x.length);W.name=`${m}/near/${T.name}`,W.userData.layer="near",h.push({mesh:W,indices:x,local:T.matrixWorld.clone(),far:!1,triangles:(C.index?.count??C.attributes.position.count)/3}),a.add(W);continue}let F=T.material.side;L.set(F,T.material),R.set(F,[...R.get(F)??[],y(T,{positions:G(C.attributes.position,3),normals:G(C.attributes.normal,3),uvs:G(C.attributes.uv,2),index:C.index?.array},T.matrixWorld.elements)])}if(S){let T=P=>g(P.material)?P.userData?.citySlot?.slot:P.material?.userData?.materialSlot,C=P=>M.filter(O=>v(O.material)&&P.has(T(O))).sort((O,ie)=>ie.geometry.attributes.position.count-O.geometry.attributes.position.count)[0],F=C(kn),W=C(Fn),D=We(S);for(let[P,O]of[[F,D.walls],[W,D.roof]]){if(!P||!O.index.length)continue;let ie=P.material.side;L.set(ie,P.material),_.set(ie,[..._.get(ie)??[],y(P,{positions:O.positions,normals:O.normals,uvs:O.uvs,index:O.index},$)])}}for(let[T,C]of[[R,!1],[_,!0]])for(let[F,W]of T){let D=L.get(F),P=An(W),O=new r.InstancedMesh(Y(P,g(D)),U(D),x.length);O.name=`${m}/${C?"far":"near"}/merged-${F}`,O.userData.layer=C?"far":"near",h.push({mesh:O,indices:x,local:new r.Matrix4,far:C,triangles:P.index.length/3}),a.add(O)}}let E,X=null,J=new r.Matrix4,oe=new r.Matrix4().makeScale(0,0,0),j=new Map,q=[],ae={near:0,far:0,culled:0},Q=m=>{E=m;let x=new Set(m.near),M=new Set(m.far),S=0;for(let R of h){let _=R.indices.map((L,T)=>({global:L,k:T})).filter(({global:L})=>(R.far?M:x).has(L));_.forEach(({global:L},T)=>{J.multiplyMatrices(i[L],R.local),R.mesh.setMatrixAt(T,j.has(L)?oe:J)}),R.mesh.userData.slotToGlobal=_.map(L=>L.global),R.mesh.count=_.length,R.mesh.instanceMatrix.needsUpdate=!0,R.mesh.visible=_.length>0,_.length&&(R.mesh.computeBoundingSphere(),R.mesh.computeBoundingBox(),S++)}ae={near:m.near.length,far:m.far.length,culled:m.culled};for(let R of q)R.mesh.visible=(R.layer.far?M:x).has(R.global)},Ae=(m=!1)=>{let x=t.getCentre();if(!x)return;let[M,S]=Ue(l,[x.lng,x.lat]),R={x:M,z:S};!m&&X&&Math.hypot(R.x-X.x,R.z-X.z)<10||(X=R,Q(Ve(f,R,n,o,E)))};Q({near:[],far:f.map((m,x)=>x),culled:0}),Ae(!0);let de=new r.Mesh(new r.BufferGeometry,new r.MeshBasicMaterial);return de.name="building-types/driver",de.frustumCulled=!1,de.onBeforeRender=()=>Ae(),a.add(de),{anchor:l,group:a,suppress:ze(e),radiusMetres:s,update:Ae,setHighlighted(m,x){let M=re(),S=ue[M],R=new Set([...m].map(L=>String(L).replace(/^NL\.IMBAG\.Pand\./,"")));for(let L of q)a.remove(L.mesh),L.mesh.dispose?.();q=[],j.clear(),e.forEach((L,T)=>{R.has(L.pand)?j.set(T,"highlight"):S.desaturate&&x&&lt(x.lngLat,L.anchor)&&j.set(T,"dim")});let _=Wt(r);for(let[L,T]of j)for(let C of h){if(!C.indices.includes(L))continue;let F=C.mesh.material,W=T==="highlight"?S.keepMaterials?F:g(F)?_.highlighted(F,!0):Be(r,F,"highlight",M):g(F)?_.dimmed(F,!0):Be(r,F,"dim",M),D=new r.InstancedMesh(C.mesh.geometry,W,1);D.setMatrixAt(0,J.multiplyMatrices(i[L],C.local)),D.name=`${C.mesh.name}/${T}`,D.userData.slotToGlobal=[L],D.computeBoundingSphere(),D.computeBoundingBox(),T==="highlight"&&ct(r,D,{style:M,up:[0,1,0]}),a.add(D),q.push({global:L,layer:C,mesh:D})}return E&&Q(E),[...j.values()].filter(L=>L==="highlight").length},pandForHit(m,x){let M=m?.userData?.slotToGlobal;return x===void 0||!M?null:e[M[x]]?.pand??null},stats(){let m=h.filter(S=>S.mesh.visible&&S.mesh.count>0).length,x=0,M=0;for(let S of h)S.mesh.visible&&(S.far?M+=S.triangles*S.mesh.count:x+=S.triangles*S.mesh.count);return{instances:e.length,...ae,units:c.size,drawCalls:m,nearTriangles:x,farTriangles:M}},dispose(){for(let m of q)m.mesh.dispose?.();for(let m of h)m.mesh.dispose?.();for(let m of d)m.dispose();for(let m of k.values())m.dispose()}}}return er(On);})();

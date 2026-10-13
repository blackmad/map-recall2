"use strict";var CanalRecallBuildingTypes=(()=>{var Ce=Object.defineProperty;var jt=Object.getOwnPropertyDescriptor;var Kt=Object.getOwnPropertyNames;var Xt=Object.prototype.hasOwnProperty;var qt=(t,e)=>{for(var r in e)Ce(t,r,{get:e[r],enumerable:!0})},Zt=(t,e,r,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let o of Kt(e))!Xt.call(t,o)&&o!==r&&Ce(t,o,{get:()=>e[o],enumerable:!(n=jt(e,o))||n.enumerable});return t};var Jt=t=>Zt(Ce({},"__esModule",{value:!0}),t);var Cn={};qt(Cn,{areaAnchor:()=>Te,areaRadiusMetres:()=>Vt,createBuildingTypes:()=>Yt,farMassing:()=>ze,groupByArea:()=>Wt,instanceMatrix:()=>Ue,partitionByDistance:()=>We,suppressionIds:()=>$e});var Ie={wallPull:.7,glassLift:.5,liftBrick:!0},Ve={wallPull:.35,glassLift:.25,liftBrick:!1},kn={photo:{cells:"photo",shadeBands:0,flatColour:!1,...Ie,cartoonRoofCells:!1,outline:!1,litWallGain:255/225},procedural:{cells:"procedural",shadeBands:0,flatColour:!1,...Ie,cartoonRoofCells:!1,outline:!1,litWallGain:1},untextured:{cells:"procedural",shadeBands:0,flatColour:!0,...Ie,cartoonRoofCells:!1,outline:!1,litWallGain:1},storybook:{cells:"storybook",shadeBands:0,flatColour:!1,...Ve,cartoonRoofCells:!1,outline:!0,litWallGain:1,tone:{hueShift:-4,satMul:1.15,satAdd:0,keepDarkBelow:0,lightMul:1,lightAdd:.03,lightMax:.9}},cartoon:{cells:"cartoon",shadeBands:3,flatColour:!1,...Ve,cartoonRoofCells:!0,outline:!0,litWallGain:1,tone:{hueShift:0,satMul:1.7,satAdd:.08,keepDarkBelow:.35,lightMul:1.08,lightAdd:0,lightMax:.85}}};var ee=(t,e,r)=>Math.max(e,Math.min(r,t));function k(t){let e=/^#?([0-9a-f]{6})$/i.exec(t.trim());if(!e)throw Error(`Bad colour ${t}`);let r=parseInt(e[1],16);return[r>>16&255,r>>8&255,r&255]}var B=t=>"#"+t.map(e=>Math.round(ee(e,0,255)).toString(16).padStart(2,"0")).join("");function G([t,e,r]){let n=t/255,o=e/255,l=r/255,a=Math.max(n,o,l),i=Math.min(n,o,l),f=(a+i)/2;if(a===i)return[0,0,f];let s=a-i,u=f>.5?s/(2-a-i):s/(a+i);return[(a===n?(o-l)/s+(o<l?6:0):a===o?(l-n)/s+2:(n-o)/s+4)*60,u,f]}function W([t,e,r]){let n=(1-Math.abs(2*r-1))*e,o=n*(1-Math.abs(t/60%2-1)),l=r-n/2,[a,i,f]=t<60?[n,o,0]:t<120?[o,n,0]:t<180?[0,n,o]:t<240?[0,o,n]:t<300?[o,0,n]:[n,0,o];return[(a+l)*255,(i+l)*255,(f+l)*255]}var Ye=(t,e,r)=>[t[0]+(e[0]-t[0])*r,t[1]+(e[1]-t[1])*r,t[2]+(e[2]-t[2])*r];var ke={canal:-1/0,c19:1860,school:1915,modern:1945};var le={procedural:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:["#4b525c","#3f464f","#5a6068"]},untextured:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:["#4b525c","#3f464f","#5a6068"]},photo:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:["#4b525c","#3f464f","#5a6068"]},storybook:{tile:["#b9553a","#a94a33","#c46a45"],slate:["#556070","#4a5666","#657282"]},cartoon:{tile:["#e85a3c","#f08a2b","#d94a3a"],slate:["#3f5f8f","#2f4a78","#4f7bb0"]}};var se={gravel:{hex:"#9e9281",luma:[112,156],cell:"flat"},"bitumen-dark":{hex:"#56585e",luma:[62,96],cell:"flat"},"bitumen-light":{hex:"#a99b84",luma:[150,182],cell:"flat"},"white-membrane":{hex:"#d9d9d3",luma:[196,228],cell:"flat"},"pantile-red":{hex:"#b5543a",luma:[84,124],cell:"tile"},"pantile-dark":{hex:"#6a5248",luma:[64,98],cell:"tile"},slate:{hex:"#4b525c",luma:[62,140],cell:"slate"},zinc:{hex:"#9aa1a6",luma:[138,176],cell:"slate"},sedum:{hex:"#7a8350",luma:[96,132],cell:"flat"},solar:{hex:"#2e3a52",luma:[44,70],cell:"flat"},terrace:{hex:"#a38d74",luma:[124,162],cell:"flat"},glass:{hex:"#8fa3ad",luma:[130,170],cell:"flat"}},he={gravel:se.gravel.hex,membrane:se["white-membrane"].hex,bitumen:se["bitumen-dark"].hex,pebble:se["bitumen-light"].hex},je=[he.gravel,he.membrane,he.bitumen,he.pebble],te={tile:le.photo.tile,slate:le.photo.slate,flat:je};var pe={photo:{canal:["#7a3b2c","#7a3b2c","#6b3428","#8c4632","#9a5846","#b05a40","#4a2e26","#2e2a27","#3e4a40","#5d605a","#e4ddcd"],c19:["#b05a40","#b05a40","#bd6a45","#a24d38","#c58b5e","#d3b184","#e2d5ba","#e2d5ba","#d9c5a4","#9a5846"],school:["#8c4a38","#7a4535","#9a5240","#6e3d33","#a85a3c","#5e3a32","#b0603f"],modern:["#c9b79a","#b9ad9a","#a8a49c","#d3c6ad","#8f8a82","#bfb3a0","#9c7a62","#b05a40"]},storybook:{canal:["#b9583f","#9a4a38","#7a4a3c","#4a5048","#3f4a5a","#ead9b0","#c8664a"],c19:["#c8664a","#d98b5f","#e0b36a","#ead9b0","#d9b995","#c9a08c","#c8664a"],school:["#a8553f","#9a5a48","#b87a5c","#c8664a","#8a4e40"],modern:null},cartoon:{canal:["#d9453d","#a8433a","#3b3b4a","#2a9d8f","#4672b0","#fffaf0","#e8573d"],c19:["#e8573d","#ee7f2c","#f2b92e","#f3e6c8","#d96a4d","#f2b92e"],school:["#d96a4d","#e8573d","#b9583f","#ee7f2c"],modern:null}};var En={canal:{label:"canal-house centre (before 1860)",wall:pe.photo.canal[0],roof:le.photo.tile[0]},c19:{label:"19th-century ring (1860-1914)",wall:pe.photo.c19[0],roof:le.photo.tile[1]},school:{label:"Amsterdamse School (1915-1944)",wall:pe.photo.school[0],roof:le.photo.slate[0]},modern:{label:"post-war and contemporary (1945+)",wall:pe.photo.modern[0],roof:je[0]}};var Ke=["brick","stucco","accent","stone","frame","door","glass","roofTile","slate","bitumen","paint"],Xe={brick:"brick",accent:"brick",stucco:"stucco",stone:"stone",frame:"frame",door:"door",glass:"glass",roofTile:"tile",slate:"slate",bitumen:"flat",paint:"frame"},U={brick:3.36,stucco:2.4,accent:3.36,stone:1.28,frame:1,door:1,glass:1,roofTile:1.2,slate:1.2,bitumen:1.2,paint:1},ce=[.3,.6],Qt="#f1ede2",er="#cfc8b8";function tr(t){let[e,r,n]=G(k(t)),o=ee(.12+n*.9,ce[0],ce[1]);return B(W([e,ee(r,.12,.5),o]))}function rr(t){let[e,r,n]=G(k(t));return B(W([e,ee(r,0,.55),ee(n*1.06+.03,.4,.97)]))}function nr(t){let e=k(t),[r,n,o]=G(e);return o>=.5?B(Ye(e,k(Qt),.75)):B(W([r,n,Math.max(o,.16)]))}function or(t){let[e,r,n]=G(k(t));return B(Ye(W([e,r,Math.max(n,.62)]),k(er),.45))}function ar(t){let[e,r,n]=G(k(t));return n>=.17?t.startsWith("#")?t.toLowerCase():"#"+t.toLowerCase():B(W([e,r<.15?0:r,.17]))}function ir(t,e){let r=G(k(e))[2];if(t==="roofTile"){let[n,o]=G(k(e));return o<.2?te.slate[1]:B(W([n,ee(o*1.1,.35,.6),ee(.2+r*.85,.38,.5)]))}return t==="slate"?r<.27?te.slate[1]:r<.31?te.slate[0]:te.slate[2]:r<.4?te.flat[2]:te.flat[0]}function Ee(t,e){switch(t){case"brick":case"accent":return tr(e);case"stucco":return rr(e);case"stone":return or(e);case"frame":return nr(e);case"door":return ar(e);case"glass":return"#ffffff";case"paint":return e.startsWith("#")?e.toLowerCase():"#"+e.toLowerCase();default:return ir(t,e)}}var qe="#ffd21f",Ze="#ff8033",Je="#b4682c";var sr="highlight",lr="__canalRecallHighlight",cr="highlightAccent",ur="__canalRecallHighlightAccent",ue={yellow:{keepMaterials:!1,outline:!1,rim:!1,desaturate:!1,ring:!1,beacon:!1,animated:!1},a:{keepMaterials:!0,outline:!0,rim:!1,desaturate:!1,ring:!0,beacon:!0,animated:!1},b:{keepMaterials:!0,outline:!1,rim:!0,desaturate:!1,ring:!0,beacon:!1,animated:!0},c:{keepMaterials:!0,outline:!1,rim:!1,desaturate:!0,ring:!0,beacon:!1,animated:!1}};var fr=60,q=.4,ge=2,nt=3.5,Qe=100,mr=300;var dr=.3,hr=2.4,pr=.9,gr=2.2;function et(t){if(typeof t!="string")return null;let e=t.trim().toLowerCase();return e==="a"||e==="outline"?"a":e==="b"||e==="rim"?"b":e==="c"||e==="desaturate"?"c":e==="yellow"||e==="0"||e==="off"||e==="old"?"yellow":e==="default"?Fe:null}var Fe="a";function re(t){try{let e=globalThis;if(t===void 0){let r=et(e[lr]);if(r)return r}return et(new URLSearchParams(t??e.location?.search??"").get(sr))??Fe}catch{return Fe}}function ot(t=re(),e){if(t==="yellow")return qe;try{let r=globalThis,n=(e===void 0?r[ur]:void 0)??new URLSearchParams(e??r.location?.search??"").get(cr);if(n==="hud")return Je;if(typeof n=="string"&&/^#?[0-9a-f]{6}$/i.test(n))return n.startsWith("#")?n:`#${n}`}catch{}return Ze}function at(t=re()){return ue[t].keepMaterials?{HL_KEEP:""}:{}}var Oe=`
#ifdef HL_KEEP
#define HL_PAINT(h) false
#else
#define HL_PAINT(h) ((h) > 0.5 && (h) < 1.5)
#endif
float hlState(float hidden) { return hidden > 2.5 ? 2.0 : (hidden > 1.5 ? 1.0 : 0.0); }
vec3 hlDesat(vec3 c, float h) { return h > 1.5 ? mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), ${q.toFixed(2)}) : c; }`,br=110540,yr=t=>111320*Math.cos(t*Math.PI/180);function xr(t,e){let r=(t[1]+e[1])/2;return Math.hypot((t[0]-e[0])*yr(r),(t[1]-e[1])*br)}var it=(t,e,r=fr)=>!!t&&xr(t,e)<=r;var tt=`
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
  float far = clamp((length(c4.xyz - hlEye) - ${Qe.toFixed(1)}) / ${(mr-Qe).toFixed(1)}, 0.0, 1.0);
  float width = hlWidthPx * mix(1.0, hlFarScale, far);
  if (dot(dir, dir) > 1e-12) clip.xy += normalize(dir) * width * 2.0 / hlViewport * clip.w;
#endif
  gl_Position = clip;
}`,Mr=`
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
  float f = pow(1.0 - abs(dot(n, v)), ${gr.toFixed(2)});
  float pulse = 0.775 + 0.225 * sin(hlTime * 6.2831853 / ${hr.toFixed(2)});
  gl_FragColor = vec4(hlAccent * f * ${pr.toFixed(2)} * pulse, 1.0);
#endif
}`,be="canalRecallHighlightPass",wr="__canalRecallHighlightOutlinePx";function vr(){let t=globalThis[wr],e=t==null||t===""?NaN:Number(t);return Number.isFinite(e)&&e>=0?e:null}var Sr=(t,e)=>{let[r,n,o]=k(e);return new t.Vector3(r/255,n/255,o/255)};function Rr(t,e,r={}){let n={};r.merged&&(n.HL_MERGED=""),e==="outline"&&(n.HL_OUTLINE="");let o=tt;if(r.feature){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(r.feature.attribute))throw new Error(`highlight: bad feature attribute ${r.feature.attribute}`);n.HL_FEATURE=r.feature.attribute,o=`attribute float ${r.feature.attribute};
uniform float hlFeatureId;
${tt}`}let l=new t.ShaderMaterial({defines:n,uniforms:{hlViewport:{value:new t.Vector2(1,1)},hlWidthPx:{value:ge},hlFarScale:{value:nt/ge},hlCentre:{value:new t.Vector3},hlDepthPush:{value:dr},hlAccent:{value:Sr(t,r.accent??ot())},hlEye:{value:new t.Vector3},hlTime:{value:0},hlHasNormal:{value:1},hlFeatureId:{value:r.feature?.id??0}},vertexShader:o,fragmentShader:Mr,side:e==="outline"?t.BackSide:t.FrontSide,transparent:!0,depthTest:!0,depthWrite:e==="outline",blending:e==="rim"?t.AdditiveBlending:t.NormalBlending,polygonOffset:e==="rim",polygonOffsetFactor:-1,polygonOffsetUnits:-2});return l.name=`highlight/${e}${r.merged?"/merged":""}`,l.userData={[be]:!0},l.defaultAttributeValues={hidden:[0],normal:[0,0,0]},l}function Lr(t){for(let e of t?.userData?.[be]??[])t.remove(e),e.material.dispose();t?.userData&&delete t.userData[be]}function st(t,e,r={}){Lr(e);let n=ue[r.style??re()],o=[...n.outline?["outline"]:[],...n.rim?["rim"]:[]];if(!o.length||!e?.geometry)return[];let l=e.geometry,a=r.centre;if(!a){l.boundingBox||l.computeBoundingBox?.();let h=l.boundingBox?.getCenter(new t.Vector3);a=h?[h.x,h.y,h.z]:[0,0,0]}let i=l.getAttribute?.("normal")?1:0,f=[],s=new t.Matrix4,u=new t.Vector4,c=new t.Vector2;for(let h of o){let d=Rr(t,h,{merged:r.merged,feature:r.feature,accent:r.accent??ot(r.style)});d.uniforms.hlCentre.value.set(a[0],a[1],a[2]),d.uniforms.hlHasNormal.value=i;let p=e.isInstancedMesh?new t.InstancedMesh(l,d,e.count):new t.Mesh(l,d);e.isInstancedMesh&&(p.instanceMatrix=e.instanceMatrix),p.name=`${e.name||"mesh"}/highlight-${h}`,p.frustumCulled=!1,p.castShadow=p.receiveShadow=!1,p.renderOrder=(e.renderOrder??0)+1,p.raycast=()=>{},p.onBeforeRender=(x,M,R)=>{e.isInstancedMesh&&(p.count=e.count),p.visible=e.visible;let y=d.uniforms;x.getDrawingBufferSize(c),y.hlViewport.value.copy(c);let I=x.domElement?.clientWidth||c.x,N=vr();y.hlWidthPx.value=(N??ge)*(c.x/I),y.hlFarScale.value=N==null?nt/ge:1,s.multiplyMatrices(R.projectionMatrix,R.matrixWorldInverse).multiply(p.matrixWorld).invert(),u.set(0,0,1,0).applyMatrix4(s),Math.abs(u.w)>1e-12&&y.hlEye.value.set(u.x/u.w,u.y/u.w,u.z/u.w),y.hlTime.value=performance.now()/1e3,d.uniformsNeedUpdate=!0},e.add(p),f.push(p)}return e.userData??={},e.userData[be]=f,f}var rt=new WeakMap;function De(t,e,r,n=re()){if(!e||r==="plain"||r==="highlight"&&ue[n].keepMaterials)return e;let o=rt.get(e);o||rt.set(e,o=new Map);let l=`${r}|${n}`,a=o.get(l);if(a)return a;if(r==="highlight")a=new t.MeshLambertMaterial({color:16765471,emissive:7033856,side:e.side??t.FrontSide});else if(e.isShaderMaterial&&e.uniforms?.tint?.value?.isVector3)a=e.clone(),a.uniforms={...e.uniforms,tint:{value:_r(e.uniforms.tint.value.clone())}};else if(e.isShaderMaterial)a=e.clone(),a.uniforms=e.uniforms,a.defines={...e.defines??{},HL_DIM_ALL:""};else{if(a=e.clone(),a.color){let i=a.color,f=.2126*i.r+.7152*i.g+.0722*i.b;i.setRGB(i.r+(f-i.r)*q,i.g+(f-i.g)*q,i.b+(f-i.b)*q)}if(a.map){let i=a.onBeforeCompile;a.onBeforeCompile=(f,s)=>{i?.call(a,f,s),f.fragmentShader=f.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${q.toFixed(2)});`)},a.customProgramCacheKey=()=>`${e.customProgramCacheKey?.()??""}|hl-dim`}}return a.name=`${e.name||"material"}/${r}`,a.userData={...e.userData??{},highlightVariantOf:e},o.set(l,a),a}function _r(t){let e=.2126*t.x+.7152*t.y+.0722*t.z;return t.set(t.x+(e-t.x)*q,t.y+(e-t.y)*q,t.z+(e-t.z)*q)}var lt="inferred",Tr=t=>G(k(t))[1]<.2,Ar=t=>{let[e,r,n]=G(k(t));return(e<45||e>340)&&r>=.15&&n<.7},Cr=t=>Tr(t)?"slate":"roofTile",Be=t=>Ar(t)?"brick":"stucco",Ir=[{test:/glass|glaz|window|vitr|ruit|pane/,slot:"glass",confidence:"name",rule:"glazing name"},{test:/decal|sign|mural|logo|letter|clock|dial/,slot:"paint",confidence:"name",rule:"signage / decal"},{test:/door|deur|gate/,slot:"door",confidence:"name",rule:"door name"},{test:/frame|kozijn|louvre|louver|blind|shutter|rail|mullion|sash/,slot:"frame",confidence:"name",rule:"joinery name"},{test:/brick|baksteen|klinker|terracotta/,slot:"brick",confidence:"name",rule:"brick name"},{test:/slate|leien|lei$/,slot:"slate",confidence:"name",rule:"slate name"},{test:/bitumen|asphalt|tar$|felt|flatroof|flat-roof|gravel/,slot:"bitumen",confidence:"name",rule:"flat roof name"},{test:/roof|tile|pantile|dakpan|dak/,slot:Cr,confidence:"name",rule:"roof name, grey \u2192 slate, else pantile"},{test:/sandstone|stone|steen|column|marble|granite|limestone|plinth/,slot:"stone",confidence:"name",rule:"stone name"},{test:/stucco|render|plaster|pleister|concrete|beton|slab/,slot:"stucco",confidence:"name",rule:"render / concrete name"},{test:/gold|gilt|bronze|copper|brass|zinc|metal|steel|iron|lead|alu/,slot:"paint",confidence:"name",rule:"metal name (flat colour)"},{test:/wall|facade|gevel/,slot:Be,confidence:"name",rule:"wall name, brick hue \u2192 brick, else stucco"},{test:/ochre|yellow|buff/,slot:Be,confidence:"colour-word",rule:"ochre: yellow brick (brick hue) or render"},{test:/pink|rose/,slot:"stucco",confidence:"colour-word",rule:"pink: painted render"},{test:/moss|grass|green|blue|orange|purple|paint|teal/,slot:"paint",confidence:"colour-word",rule:"coloured paint word"},{test:/white|cream|ivory/,slot:"stucco",confidence:"colour-word",rule:"white: stucco (could be white trim)"},{test:/dark|black|charcoal|anthracite/,slot:"frame",confidence:"colour-word",rule:"dark: painted joinery / ironwork (could be a dark wall)"},{test:/red/,slot:Be,confidence:"colour-word",rule:"red: brick hue \u2192 brick (could be red tile or paint)"},{test:/grey|gray/,slot:"stucco",confidence:"colour-word",rule:"grey: render (could be concrete or zinc)"}];function ct(t){return String(t??"").toLowerCase().replace(/[-_.\s]*\d+$/,"").trim()}function kr(t){let[e,r,n]=G(k(t));return n<.22?{slot:"frame",rule:"very dark: joinery / ironwork"}:r>=.15&&(e<45||e>340)&&n<.62?{slot:"brick",rule:"brick hue"}:r<.2&&n>=.6?{slot:"stucco",rule:"pale neutral: render"}:r<.2&&n>=.22&&e>180&&e<260?{slot:"slate",rule:"blue-grey: slate"}:r<.25?{slot:"stone",rule:"neutral mid-tone: stone"}:{slot:"paint",rule:"saturated colour: paint"}}function ut(t,e){let r=e.toLowerCase(),n=ct(t);for(let l of Ir)if(l.test.test(n))return{slot:typeof l.slot=="function"?l.slot(r):l.slot,tint:r,confidence:l.confidence,rule:l.rule};let o=kr(r);return{slot:o.slot,tint:r,confidence:"colour",rule:`no material word in "${n||"unnamed"}"; ${o.rule}`}}var ft=t=>/white|cream|ivory/.test(ct(t)),mt=t=>typeof t=="string"&&Ke.includes(t);var dt=["canal","c19","school","postwar","modern","tower"];var Fr=8;var oo=16+Math.log2(Fr);var A=256,Or=["upper","ground","door","plain","shop"],Dr=2;var lo=dt.length*Dr*Or.length;var P=t=>[1,3,5].map(e=>parseInt(t.slice(e,e+2),16));var co=P("#7d93a0"),uo=P("#1f2a33");var fo=P("#b8ad98"),mo=P("#cfc6b4"),ho=P("#ece8dd"),po=P("#e2d9c2"),go=[P("#2c4a3d"),P("#3a2a22"),P("#1f3b57"),P("#5a2a24")],bo=[P("#2f4a3a"),P("#7a2f27"),P("#27384f")];var ht=.6;function ye(t,e,r){let n=Math.imul(t|0,374761393)^Math.imul(e|0,668265263)^Math.imul(r|0,2246822519);return n=Math.imul(n^n>>>13,1274126177),((n^n>>>16)>>>0)/4294967296}function pt(t,e){let r=0;for(let o=0;o<t.length;o+=4)r+=t[o];let n=r/(t.length/4);for(let o=0;o<t.length;o+=4){let l=Math.round(Math.max(0,Math.min(255,n+(t[o]-n)*e)));t[o]=t[o+1]=t[o+2]=l}}function gt(t,e){let r=new Uint8ClampedArray(A*A*4),n=(o,l,a,i,f)=>{let s=(l*A+o)*4,u=f??[a,a,a];r[s]=u[0],r[s+1]=u[1],r[s+2]=u[2],r[s+3]=i};if(t==="flat")for(let o=0;o<A;o++)for(let l=0;l<A;l++)n(l,o,Math.round((e?.96:.9+(ye(l>>3,o>>3,3)-.5)*.08)*255),255);else if(t==="tile"){let a=A/8,i=A/5;for(let f=0;f<A;f++)for(let s=0;s<A;s++){let u=Math.floor(f/a),c=f%a/a,h=(s+u%2*i*.5)%A,d=Math.floor(h/i),p=h%i/i,x=Math.sin(p*Math.PI),M=e?.92:.7+.22*x-.28*Math.pow(Math.max(0,1-c*3.2),1.5)*0-.22*Math.max(0,(.18-c)/.18);e||(M+=(ye(d,u,7)-.5)*.14);let R=e?c<.07||p<.035||p>.965:!1;n(s,f,Math.round(Math.max(0,Math.min(1,R?.28:M))*255),255)}e||pt(r,ht)}else if(t==="slate"){let a=A/11,i=A/6;for(let f=0;f<A;f++)for(let s=0;s<A;s++){let u=Math.floor(f/a),c=f%a/a,h=(s+u%2*i*.5)%A,d=Math.floor(h/i),p=h%i/i,x=e?.9:.82+(ye(d,u,11)-.5)*.16-.16*Math.max(0,(.16-c)/.16);(p<(e?.05:.025)||c<(e?.09:.04))&&(x=e?.3:x*.7),n(s,f,Math.round(Math.max(0,Math.min(1,x))*255),255)}e||pt(r,ht)}else for(let f=0;f<A;f++)for(let s=0;s<A;s++){let u=s/A,c=f/A,h=u>.2-.06&&u<.8+.06&&c>.2-.06&&c<.82+.06,d=u>.2+.03&&u<.8-.03&&c>.2+.03&&c<.82-.03,p=Math.abs(u-.5)<.018||Math.abs(c-.5)<.018;if(d&&!p){let x=(c-.2)/.6199999999999999,M=e?[150+60*x,200+30*x,235]:[40+80*x*x,55+90*x*x,68+90*x*x];n(s,f,0,0,[M[0],M[1],M[2]])}else if(h)n(s,f,0,0,e?[255,250,240]:[236,232,221]);else{let x=e?.92:.85+(ye(s>>3,f>>3,5)-.5)*.12,M=e&&(s<5||f<5||s>A-6||f>A-6);n(s,f,Math.round((M?.3:x)*255),255)}}return r}function bt(t,e){let n=t.createElement("canvas");n.width=n.height=336;let o=n.getContext("2d",{willReadFrequently:!0});if(e)for(let s=0;s<336;s+=112)for(let u=0;u<336;u+=112)o.drawImage(e,u,s,112,112);else{let s=7,u=()=>(s=s*16807%2147483647)/2147483647;for(let c=0,h=0;h<336;h+=14,c++)for(let d=-(c%2)*24;d<336;d+=48){let p=150+u()*50;o.fillStyle=`rgb(${p},${p*.92},${p*.86})`,o.fillRect(d,h,48,14)}}o.strokeStyle="rgba(235,223,205,0.18)",o.lineWidth=1.7;for(let s=0,u=6;u<336;u+=14,s++){o.beginPath(),o.moveTo(0,u),o.lineTo(336,u),o.stroke();for(let c=s%2*24;c<336;c+=48)o.beginPath(),o.moveTo(c,u),o.lineTo(c,u+14),o.stroke()}let l=o.getImageData(0,0,336,336),a=l.data,i=0;for(let s=0;s<a.length;s+=4)i+=(a[s]+a[s+1]+a[s+2])/3;i/=a.length/4;let f=i>0?Math.min(2.4,225/i):1;for(let s=0;s<a.length;s+=4){let u=(a[s]+a[s+1]+a[s+2])/3,c=Math.min(255,(u+(i-u)*.7)*f);a[s]=a[s+1]=a[s+2]=c,a[s+3]=255}return o.putImageData(l,0,0),n}function yt(t){let e=t.createElement("canvas");e.width=64,e.height=128;let r=e.getContext("2d"),n=r.createLinearGradient(0,0,0,128);return n.addColorStop(0,"#8aa1b0"),n.addColorStop(.5,"#4d606c"),n.addColorStop(1,"#3c474e"),r.fillStyle=n,r.fillRect(0,0,64,128),r.fillStyle="rgba(235,242,248,0.16)",r.beginPath(),r.moveTo(10,0),r.lineTo(34,0),r.lineTo(4,70),r.lineTo(-20,70),r.closePath(),r.fill(),e}function xt(t){let e=t.createElement("canvas");e.width=e.height=128;let r=e.getContext("2d");r.fillStyle="#ffffff",r.fillRect(0,0,128,128),r.fillStyle="rgba(0,0,0,0.10)";for(let n=0;n<128;n+=16)r.fillRect(n,0,1.5,128);return e}function Mt(t){let e=t.createElement("canvas");e.width=e.height=128;let r=e.getContext("2d"),n=r.createImageData(128,128),o=23,l=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++){let i=(l()-.5)*3;for(let f=0;f<128;f++){let s=(a*128+f)*4,u=l()<.012?-14:0,c=243+(l()-.5)*8+i+u;n.data[s]=n.data[s+1]=n.data[s+2]=c,n.data[s+3]=255}}return r.putImageData(n,0,0),e}function wt(t){let e=t.createElement("canvas");e.width=e.height=128;let r=e.getContext("2d"),n=r.createImageData(128,128),o=11,l=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<n.data.length;a+=4){let i=228+(l()-.5)*16;n.data[a]=n.data[a+1]=n.data[a+2]=i,n.data[a+3]=255}return r.putImageData(n,0,0),r.fillStyle="rgba(80,70,60,0.18)",r.fillRect(0,0,128,1.5),e}function xe(t,e){let r=gt(e,!1),n=Math.round(Math.sqrt(r.length/4)),o=t.createElement("canvas");o.width=o.height=n;let l=o.getContext("2d"),a=l.createImageData(n,n);for(let i=0;i<r.length;i+=4)a.data[i]=r[i],a.data[i+1]=r[i+1],a.data[i+2]=r[i+2],a.data[i+3]=255;return l.putImageData(a,0,0),o}var Br=238;function vt(t,e){let n=t.createElement("canvas");n.width=n.height=336;let o=n.getContext("2d",{willReadFrequently:!0});if(e)for(let s=0;s<336;s+=112)for(let u=0;u<336;u+=112)o.drawImage(e,u,s,112,112);else{let s=13,u=()=>(s=s*16807%2147483647)/2147483647;for(let c=0,h=0;h<336;h+=14,c++)for(let d=-(c%2)*24;d<336;d+=48){let p=165+u()*30;o.fillStyle=`rgb(${p},${p*.93},${p*.88})`,o.fillRect(d,h,48,14)}}o.strokeStyle="rgba(245,240,230,0.26)",o.lineWidth=1.2;for(let s=0,u=6;u<336;u+=14,s++){o.beginPath(),o.moveTo(0,u),o.lineTo(336,u),o.stroke();for(let c=s%2*24;c<336;c+=48)o.beginPath(),o.moveTo(c,u),o.lineTo(c,u+14),o.stroke()}let l=o.getImageData(0,0,336,336),a=l.data,i=0;for(let s=0;s<a.length;s+=4)i+=(a[s]+a[s+1]+a[s+2])/3;i/=a.length/4;let f=i>0?Math.min(2.6,Br/i):1;for(let s=0;s<a.length;s+=4){let u=(a[s]+a[s+1]+a[s+2])/3,c=Math.min(255,(u+(i-u)*.82)*f);a[s]=a[s+1]=a[s+2]=c,a[s+3]=255}return o.putImageData(l,0,0),n}function St(t){let e=t.createElement("canvas");e.width=e.height=128;let r=e.getContext("2d"),n=r.createImageData(128,128),o=31,l=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++)for(let i=0;i<128;i++){let f=(a*128+i)*4,s=246+(l()-.5)*3;n.data[f]=n.data[f+1]=n.data[f+2]=s,n.data[f+3]=255}return r.putImageData(n,0,0),e}function Rt(t){let e=t.createElement("canvas");e.width=e.height=4;let r=e.getContext("2d");return r.fillStyle="#fff",r.fillRect(0,0,4,4),e}var Lt=[-1,-1];var _t=[-1,-1],Tt=()=>[70,190,.5],Me=t=>Number.isInteger(t)?t.toFixed(1):String(t),At=`
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
}`,Ct=`
uniform vec2 cellTier;
void cellTierSample(vec3 p, float dist, out vec3 c, out vec2 m) {
  c = texture(cells, p).rgb; m = texture(masks, p).rg;
  if (cellTier.x < 0.0) return;
  float rho = max(length(dFdx(p.xy)), length(dFdy(p.xy))) * float(textureSize(cells, 0).x);
  float far = smoothstep(cellTier.x, cellTier.y, rho);
  if (far <= 0.0) return;
  c = mix(c, textureLod(cells, p, 8.0).rgb, far); m = mix(m, textureLod(masks, p, 8.0).rg, far);
}`;var Ge={sunAzimuthDeg:215,sunElevationDeg:40,sunColour:"#ffe9cc",sunIntensity:2.15,skyColour:"#e3ebf6",groundColour:"#998a72",skyIntensity:1.75,shadows:!0,shadowMapSize:2048};function Gr(t,e){let r=t*Math.PI/180,n=e*Math.PI/180;return[Math.sin(r)*Math.cos(n),Math.cos(r)*Math.cos(n),Math.sin(n)]}var Ao=Gr(Ge.sunAzimuthDeg,Ge.sunElevationDeg),ve=(()=>{let t=Ge.sunAzimuthDeg*Math.PI/180;return[Math.sin(t),Math.cos(t)]})(),we=[ve[0]*.6,ve[1]*.6,.8],It=.84;function Hr(t){let e=t[0]*we[0]+t[1]*we[1]+t[2]*we[2];return Math.max(.5,Math.min(1,.58+.42*Math.max(0,e)))}var Co=Hr([0,0,1]),fe=t=>Number.isInteger(t)?t.toFixed(1):String(+t.toFixed(6)),Se=`
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = ${fe(It)} + ${fe(1-It)} * (0.5 + 0.5 * dot(h, vec2(${fe(ve[0])}, ${fe(ve[1])}))); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, dot(n, vec3(${we.map(fe).join(", ")}))), 0.5, 1.0);`;var Y=.9,me=255/225,Pr=255/228,Nr=255/243,Ur=255/246,_e=[{cell:"brick",tileM:U.brick,clampUv:!1,litGain:me*Y,skyTint:!1},{cell:"stucco",tileM:U.stucco,clampUv:!1,litGain:Nr*Y,skyTint:!1},{cell:"stone",tileM:U.stone,clampUv:!1,litGain:Pr*Y,skyTint:!1},{cell:"white",tileM:1,clampUv:!1,litGain:1,skyTint:!1},{cell:"door",tileM:U.door,clampUv:!1,litGain:1,skyTint:!1},{cell:"glass",tileM:U.glass,clampUv:!0,litGain:1,skyTint:!0},{cell:"tile",tileM:U.roofTile,clampUv:!1,litGain:me*Y,skyTint:!1},{cell:"slate",tileM:U.slate,clampUv:!1,litGain:me*Y,skyTint:!1},{cell:"flat",tileM:U.bitumen,clampUv:!1,litGain:me*Y,skyTint:!1},{cell:"brick20",tileM:U.brick,clampUv:!1,litGain:me*Y,skyTint:!1},{cell:"whiteStucco",tileM:U.stucco,clampUv:!1,litGain:Ur*Y,skyTint:!1}],Le=_e.length,Re=Object.fromEntries(_e.map((t,e)=>[t.cell,e])),$r=ke.school;function Dt(t,e={}){let r=Xe[t];return r==="brick"&&typeof e.year=="number"&&e.year>=$r?Re.brick20:r==="stucco"&&e.white?Re.whiteStucco:r==="frame"?Re.white:Re[r]}function zr(){return _e.map(t=>[1/t.tileM,t.clampUv?1:0,t.litGain,t.skyTint?1:0])}var Wr=.38,Vr=.8,Yr=.75,jr=.5,Kr=.12,Xr=(t,e)=>(t<45||t>340)&&e>=.2;function qr(t,e){let r=k(e),[n,o,l]=G(r);return t==="slate"&&Xr(n,o)?Ee("roofTile",e):(t==="brick"||t==="accent")&&o<Kr?B(W([n,o,Math.min(ce[1],Math.max(ce[0],.12+l*.9))])):t==="slate"&&l>Wr?B(W([n,Math.min(o,.12),Math.min(.72,l/Vr)])):t==="frame"&&l>=.5&&l<Yr?B(r):t==="stone"&&l<jr?B(r):Ee(t,e)}function Zr(t,e){let[r,n,o]=k(qr(t,e));return[r,n,o,255]}function Jr(t,e,r){switch(e){case"brick":return bt(t,r);case"brick20":return vt(t,r);case"stucco":return Mt(t);case"whiteStucco":return St(t);case"stone":return wt(t);case"white":case"frame":return Rt(t);case"door":return xt(t);case"glass":return yt(t);case"tile":return xe(t,"tile");case"slate":return xe(t,"slate");case"flat":return xe(t,"flat")}}function Qr(t,e,r){let n=r*r,o=new Uint8Array(n*4*Le),l=new Uint8Array(n*2*Le),a=t.createElement("canvas");a.width=a.height=r;let i=a.getContext("2d",{willReadFrequently:!0});return i.imageSmoothingQuality="high",_e.forEach((f,s)=>{i.clearRect(0,0,r,r),i.drawImage(Jr(t,f.cell,e),0,0,r,r);let u=i.getImageData(0,0,r,r).data;for(let c=0;c<r;c++)for(let h=0;h<r;h++){let d=((r-1-c)*r+h)*4,p=s*n+c*r+h;o[p*4]=u[d],o[p*4+1]=u[d+1],o[p*4+2]=u[d+2],o[p*4+3]=255,l[p*2]=255,l[p*2+1]=0}}),{colour:o,mask:l}}async function en(t=document){let e=new Image;e.src=new URL("materials/ambientcg/Bricks057/colour.jpg",t.baseURI).href;try{return await e.decode(),e}catch{return null}}var He=t=>`${t.lit?"lit":"unlit"}|${t.kind}|${t.kind==="slot"?t.uv??"uv":"-"}|${t.highlight?"hl":t.dim?"dim":"-"}|${t.side??0}`;function tn(t){let e={CITY_SLOT_COUNT:String(Le)};return t.kind==="slot"&&(e.CITY_SLOT=""),t.kind==="slot"&&t.uv==="box"&&(e.CITY_BOX_UV=""),t.highlight?e.CITY_HIGHLIGHT="":t.dim&&(e.CITY_DIM=""),{...e,...at()}}var rn="vec3(1.0, 0.824, 0.122)",kt="vec3(1.0, 0.637, 0.0137)",Et="vec3(0.035, 0.05, 0.07)",nn=1,on=.2,an=.75,sn=1.8,ne=t=>Number.isInteger(t)?t.toFixed(1):String(t),ln=`
float cityGrain(vec3 cell) {
  float g = clamp(dot(cell, vec3(0.299, 0.587, 0.114)) / ${ne(225/255)}, 0.45, 1.1);
  return mix(1.0, g, ${ne(an)});
}`,Bt=`
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
${Oe}`,Gt=`
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
#endif`,Ht=`
vFacDist = length((modelViewMatrix * vec4(position, 1.0)).xyz);
if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`,Pt=`
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${At}
${Ct}
varying vec2 vFacUv;
flat varying float vLayer;
flat varying vec4 vSlot;
varying vec3 vTint;
varying vec3 vAccent;
flat varying float vHighlight;
varying float vFacDist;
${ln}
${Oe}`,Nt=`
if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;`,Ut=`
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
cityC *= mix(vec3(1.0), vTint, cityM.r) * mix(vec3(1.0), vAccent, cityM.g);`,cn=`
uniform mat3 enuFromWorld;
${Bt}
varying float vShade;
void main() {
${Gt}
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
${Ht}
}`,un=`
precision highp float;
${Pt}
varying float vShade;
void main() {
${Nt}
${Ut}
  if (HL_PAINT(vHighlight)) {
    float hlShade = clamp(1.0 - (1.0 - vShade) * ${ne(sn)}, 0.6, 1.0);
    gl_FragColor = vec4(${rn} * (flatColour > 0.5 ? 1.0 : cityG) * hlShade, 1.0);
    return;
  }
  if (flatColour > 0.5) cityC = vTint;
  cityC = hlDesat(cityC, vHighlight);
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  gl_FragColor = vec4(cityC * shade, 1.0);
}`;function fn(t,e={}){return{cells:e.cells??{value:null},masks:e.masks??{value:null},slotBase:e.slotBase??{value:0},slotParams:e.slotParams??{value:zr().map(r=>new t.Vector4(...r))},bands:e.bands??{value:0},flatColour:e.flatColour??{value:0},cityFade:e.cityFade??{value:1},wallGain:e.wallGain??{value:1},roofLayers:e.roofLayers??{value:_t},roofTier:e.roofTier??{value:Tt()},cellTier:e.cellTier??{value:Lt},enuFromWorld:e.enuFromWorld??{value:new t.Matrix3}}}var mn={accent:[1,1,1,1],hidden:[0],color:[1,1,1],uv:[0,0],uv1:[0,0]},Pe="recipeLookShared";function dn(t,e,r){let n=tn(e),o=e.side??t.FrontSide,l;return e.lit?(l=new t.MeshLambertMaterial({side:o,flatShading:e.kind==="chunk"}),l.defines={...l.defines??{},...n},l.onBeforeCompile=a=>{for(let i of Object.keys(r))a.uniforms[i]=r[i];a.vertexShader=a.vertexShader.replace("#include <common>",`#include <common>${Bt}`).replace("#include <begin_vertex>",`#include <begin_vertex>${Gt}`).replace("#include <project_vertex>",`#include <project_vertex>${Ht}`),a.fragmentShader=a.fragmentShader.replace("#include <common>",`#include <common>${Pt}
float cityLuma;`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>${Nt}`).replace("#include <map_fragment>",`${Ut}
#ifdef CITY_SLOT
cityC *= vSlot.z;
#else
cityC *= mix(1.0, wallGain * ${ne(Y)}, cityM.r);
#endif
if (flatColour > 0.5) cityC = vTint;
cityLuma = dot(cityC, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= HL_PAINT(vHighlight) ? ${kt} * ${ne(nn)} * pow(flatColour > 0.5 ? 1.0 : cityG, 2.2) : pow(hlDesat(cityC, vHighlight), vec3(2.2));`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
if (HL_PAINT(vHighlight)) totalEmissiveRadiance += ${kt} * ${ne(on)};
#ifdef CITY_SLOT
else totalEmissiveRadiance += ${Et} * vSlot.w;
#else
// Bay glazing (dark, untinted texels): the same constant sky tint as landmark glass, never a hotspot.
else totalEmissiveRadiance += ${Et} * (1.0 - smoothstep(0.06, 0.2, cityLuma)) * (1.0 - cityM.r);
#endif`)},l.customProgramCacheKey=()=>`city-look-v3|${He({...e,side:0})}`,l.uniforms=r):l=new t.ShaderMaterial({uniforms:r,defines:n,vertexShader:cn,fragmentShader:un,side:o}),l.defaultAttributeValues={...mn},l.name=`city-look/${He(e)}`,l.userData={cityLook:!0,cityVariant:{...e},[Pe]:!0},l}function hn(t){return t?t.isMeshBasicMaterial||t.userData?.unlit?"unlit (decal / emissive sign)":t.transparent||(t.opacity??1)<1?"transparent":t.vertexColors?"vertex colours":t.map?"own texture":null:"no material"}function pn(t,e){let r=t?.userData??{};if(mt(r.materialSlot)&&typeof r.tint=="string")return{slot:r.materialSlot,tint:r.tint,inferred:r.materialSlotSource===lt};if(!e||hn(t)||!t.color)return null;let n="#"+t.color.getHexString(),o=ut(t.name,n);return{slot:o.slot,tint:o.tint,inferred:!0}}function Ft(t,e,r,n,o={}){let l=e.getAttribute("position")?.count??0,a=Dt(r,o),i=Zr(r,n),f=e.getAttribute("layer"),s=e.getAttribute("tint");if(f&&s)return f.getX(0)===a&&Math.round(s.getX(0)*255)===i[0]&&Math.round(s.getY(0)*255)===i[1]&&Math.round(s.getZ(0)*255)===i[2];e.setAttribute("layer",new t.BufferAttribute(new Uint8Array(l).fill(a),1,!1));let u=new Uint8Array(l*4);for(let c=0;c<l;c++)u.set(i,c*4);return e.setAttribute("tint",new t.BufferAttribute(u,4,!0)),!0}var gn="__canalRecallCityLookShared";function $t(t,e={}){let r=globalThis,n=r[gn]??=new Map,o=n.get(t);return o||n.set(t,o=bn(t,e)),o}function bn(t,e={}){let r=e.document??globalThis.document,n=e.size??(globalThis.matchMedia?.("(pointer: coarse)").matches?128:256),o=fn(t),l=new Map,a=null,i=!1,f=(c,h)=>{let d=new t.DataArrayTexture(c,n,n,Le);return d.format=h,d.type=t.UnsignedByteType,d.wrapS=d.wrapT=t.RepeatWrapping,d.minFilter=t.LinearMipmapLinearFilter,d.magFilter=t.LinearFilter,d.generateMipmaps=!0,d.anisotropy=e.anisotropy??4,d.unpackAlignment=1,d.needsUpdate=!0,d.userData={bytes:c.byteLength,[Pe]:!0},d},s=(async()=>{if(!r)return;let c=e.brick!==void 0?e.brick:await en(r),{colour:h,mask:d}=Qr(r,c,n);a={colour:f(h,t.RGBAFormat),mask:f(d,t.RGFormat)},i||(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)})(),u=c=>{let h=He(c),d=l.get(h);return d||l.set(h,d=dn(t,c,o)),d};return{uniforms:o,ready:s,material:u,dress(c,{lit:h,infer:d=!1,year:p=null}){let x=0;return c.traverse(M=>{if(!M.isMesh||Array.isArray(M.material)||M.material?.userData?.cityLook)return;let R=pn(M.material,d);if(!R)return;let y=M.geometry;if(!y?.getAttribute("position"))return;let I=!!y.getAttribute("uv");!I&&!y.getAttribute("normal")&&y.computeVertexNormals();let N={year:p,white:R.inferred&&ft(M.material.name)};Ft(t,y,R.slot,R.tint,N)||(y=M.geometry=y.clone(),y.deleteAttribute("layer"),y.deleteAttribute("tint"),Ft(t,y,R.slot,R.tint,N));let v=M.material;M.material=u({lit:h,kind:"slot",uv:I?"uv":"box",side:v.side}),M.userData.citySlot={slot:R.slot,tint:R.tint,inferred:R.inferred,from:v.name,layer:Dt(R.slot,N)},v.userData?.[Pe]||v.dispose(),x++}),x},highlighted(c,h){let d=c?.userData?.cityVariant;return d?u({...d,highlight:h,dim:!1}):c},dimmed(c,h){let d=c?.userData?.cityVariant;return d?u({...d,highlight:!1,dim:h}):c},bindAtlas(c){i=!!c,c?(o.cells.value=c.colour,o.masks.value=c.mask,o.slotBase.value=c.slotBase):a&&(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)},textureBytes(){return a&&!i?Math.round((a.colour.userData.bytes+a.mask.userData.bytes)*4/3):0}}}var yn=2*Math.PI*6378137;function zt(t,e){return[(180+t)/360,(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+e*Math.PI/360)))/360]}var xn=t=>1/yn/Math.cos(t*Math.PI/180);function Ne(t,e){let[r,n]=zt(t[0],t[1]),[o,l]=zt(e[0],e[1]),a=xn(t[1]);return[(o-r)/a,(l-n)/a]}function Te(t){let e=t.map(n=>n.anchor[0]),r=t.map(n=>n.anchor[1]);return[(Math.min(...e)+Math.max(...e))/2,(Math.min(...r)+Math.max(...r))/2]}var Mn=t=>Math.PI-(180+t)*Math.PI/180;function Ue(t,e){let[r,n]=Ne(e,t.anchor),o=Mn(t.northOffsetDegrees),l=Math.cos(o),a=Math.sin(o),[i,f,s]=t.scale;return[l*i,0,-a*i,0,0,f,0,0,a*s,0,l*s,0,r,t.groundAltitudeMetres,n,1]}function Wt(t){let e=new Map;for(let r of t)e.set(r.area??"default",[...e.get(r.area??"default")??[],r]);return e}function Vt(t){let e=Te(t);return Math.max(50,...t.map(r=>Math.hypot(...Ne(e,r.anchor))))+30}var wn=t=>`NL.IMBAG.Pand.${t}`;function $e(t){return[...new Set(t.map(e=>wn(e.pand)))].sort()}function ze(t){let e=t.L0/2,r=t.W0/2,n=t.E0,o={positions:[],normals:[],uvs:[],index:[]},l={positions:[],normals:[],uvs:[],index:[]},a=(c,h,d,p,x,M,R)=>{let y=c.positions.length/3;for(let I of[h,d,p,x])c.positions.push(...I),c.normals.push(...M),c.uvs.push(...R(I));c.index.push(y,y+1,y+2,y,y+2,y+3)},i=c=>[c[0],c[1]],f=c=>[c[2],c[1]],s=c=>[c[0],c[2]];a(o,[-e,0,r],[e,0,r],[e,n,r],[-e,n,r],[0,0,1],i),a(o,[e,0,-r],[-e,0,-r],[-e,n,-r],[e,n,-r],[0,0,-1],i),a(o,[e,0,r],[e,0,-r],[e,n,-r],[e,n,r],[1,0,0],f),a(o,[-e,0,-r],[-e,0,r],[-e,n,r],[-e,n,-r],[-1,0,0],f);let u=t.R0!==void 0&&t.R0>n+.3?t.R0:void 0;if(u===void 0)a(l,[-e,n,r],[e,n,r],[e,n,-r],[-e,n,-r],[0,1,0],s);else{let c=u-n,h=Math.hypot(r,c),d=c/h,p=r/h;a(l,[-e,n,r],[e,n,r],[e,u,0],[-e,u,0],[0,p,d],s),a(l,[e,n,-r],[-e,n,-r],[-e,u,0],[e,u,0],[0,p,-d],s);let x=(M,R,y)=>{let I=o.positions.length/3,N=y?[[M,n,-r],[M,n,r],[M,u,0]]:[[M,n,r],[M,n,-r],[M,u,0]];for(let v of N)o.positions.push(...v),o.normals.push(R,0,0),o.uvs.push(...f(v));o.index.push(I,I+1,I+2)};x(e,1,!1),x(-e,-1,!0)}return{walls:o,roof:l}}function We(t,e,r,n,o,l=20){let a=new Set(o?.near),i=new Set(o?.far),f=[],s=[];return t.forEach((u,c)=>{let h=Math.hypot(u.x-e.x,u.z-e.z),d=a.has(c)?r+l:r-(i.has(c)?l:0),p=a.has(c)||i.has(c)?n+l:n;h<=d?f.push(c):h<=p&&s.push(c)}),{near:f,far:s,culled:t.length-f.length-s.length}}var vn=140,Sn=700;function Rn(t){let e=t.reduce((a,i)=>a+i.positions.length/3,0),r=t.reduce((a,i)=>a+(i.index?i.index.length:i.positions.length/3),0),n={positions:new Float32Array(e*3),normals:new Float32Array(e*3),uvs:new Float32Array(e*2),textures:new Float32Array(e),tints:new Float32Array(e*3),index:new Uint32Array(r)},o=0,l=0;for(let a of t){let i=a.matrix,f=a.positions.length/3,s=i[0],u=i[4],c=i[8],h=i[1],d=i[5],p=i[9],x=i[2],M=i[6],R=i[10],y=[d*R-p*M,p*x-h*R,h*M-d*x,c*M-u*R,s*R-c*x,u*x-s*M,u*p-c*d,c*h-s*p,s*d-u*h],I=s*y[0]+u*y[1]+c*y[2]<0;for(let v=0;v<f;v++){let Z=a.positions[v*3],$=a.positions[v*3+1],j=a.positions[v*3+2],O=(o+v)*3;n.positions[O]=i[0]*Z+i[4]*$+i[8]*j+i[12],n.positions[O+1]=i[1]*Z+i[5]*$+i[9]*j+i[13],n.positions[O+2]=i[2]*Z+i[6]*$+i[10]*j+i[14];let K=a.normals[v*3],J=a.normals[v*3+1],oe=a.normals[v*3+2],V=y[0]*K+y[1]*J+y[2]*oe,X=y[3]*K+y[4]*J+y[5]*oe,ae=y[6]*K+y[7]*J+y[8]*oe,Q=(Math.hypot(V,X,ae)||1)*(I?-1:1);n.normals[O]=V/Q,n.normals[O+1]=X/Q,n.normals[O+2]=ae/Q,n.uvs[(o+v)*2]=a.uvs[v*2]*a.uvScale,n.uvs[(o+v)*2+1]=a.uvs[v*2+1]*a.uvScale,n.textures[o+v]=a.texture,n.tints[O]=a.tint[0],n.tints[O+1]=a.tint[1],n.tints[O+2]=a.tint[2]}let N=a.index?a.index.length:f;for(let v=0;v<N;v+=3){let Z=a.index?a.index[v]:v,$=a.index?a.index[v+1]:v+1,j=a.index?a.index[v+2]:v+2;n.index[l++]=o+Z,n.index[l++]=o+(I?j:$),n.index[l++]=o+(I?$:j)}o+=f}return n}function Ln(t){let e=Math.max(1,t),r=Array.from({length:e},(n,o)=>o===e-1?`c = texture2D(t${o}, vUv).rgb;`:`if (vTex < ${o}.5) c = texture2D(t${o}, vUv).rgb; else`).join(`
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
}`}}function _n(t,e,r){if(!e?.isShaderMaterial)return e;let n=r.get(e);if(!n){let o=String(e.vertexShader).replace("mat3(modelMatrix) * normal","mat3(modelMatrix * instanceMatrix) * normal").replace("modelViewMatrix * vec4(position, 1.0)","modelViewMatrix * instanceMatrix * vec4(position, 1.0)");if(o===e.vertexShader)throw new Error("recipe look vertex shader changed: instancing patch no longer applies");n=new t.ShaderMaterial({uniforms:e.uniforms,vertexShader:o,fragmentShader:e.fragmentShader,side:e.side}),n.name=`${e.name}/instanced`,n.userData={...e.userData},r.set(e,n)}return n}var Tn=new Set(["brick","stucco","stone"]),An=new Set(["roofTile","slate","bitumen"]);async function Yt(t,e){let{THREE:r}=t,n=t.nearMetres??vn,o=t.cullMetres??Sn;if(!e.length)throw new Error("no building-type instances");let l=Te(e),a=new r.Group;a.name="building-types";let i=e.map(m=>new r.Matrix4().fromArray(Ue(m,l))),f=i.map(m=>({x:m.elements[12],z:m.elements[14]})),s=Math.max(50,...f.map(m=>Math.hypot(m.x,m.z)))+30,u=new Map,c=new Map;e.forEach((m,g)=>c.set(m.unit,[...c.get(m.unit)??[],g]));let h=[],d=[],p=[],x=[],M=m=>!!(m?.isShaderMaterial&&m.uniforms?.map?.value&&m.uniforms.tint?.value&&m.uniforms.uvScale&&m.uniforms.enuFromWorld),R=m=>!!m?.userData?.cityLook,y=m=>M(m)||R(m);for(let[m,g]of c){let b=await t.loadUnit(m);b.updateMatrixWorld(!0);let w;b.traverse(_=>{_.userData?.nominal&&(w=_.userData.nominal)});let S=[];b.traverse(_=>{_.isMesh&&S.push(_)});for(let _ of S)M(_.material)&&!x.includes(_.material.uniforms.map.value)&&x.push(_.material.uniforms.map.value);p.push({unit:m,indices:g,meshes:S,nominal:w})}let I=new Map,N=m=>{if(R(m))return m;let g=I.get(m.side);if(!g){let b={enuFromWorld:m.uniforms.enuFromWorld};x.forEach((w,S)=>{b[`t${S}`]={value:w}}),g=new r.ShaderMaterial({uniforms:b,...Ln(x.length),side:m.side}),g.name="building-types/merged",g.userData={recipeLookShared:!0},I.set(m.side,g)}return g},v=(m,g,b)=>{if(R(m.material)){let S=m.geometry.getAttribute("layer"),_=m.geometry.getAttribute("tint");return{...g,matrix:b,uvScale:1,texture:S.getX(0),tint:[_.getX(0),_.getY(0),_.getZ(0)]}}let w=m.material.uniforms.tint.value;return{...g,matrix:b,uvScale:m.material.uniforms.uvScale.value,texture:x.indexOf(m.material.uniforms.map.value),tint:[w.x,w.y,w.z]}},Z=(m,g=!1)=>{let b=new r.BufferGeometry;return b.setAttribute("position",new r.BufferAttribute(m.positions,3)),b.setAttribute("normal",new r.BufferAttribute(m.normals,3)),b.setAttribute("uv",new r.BufferAttribute(m.uvs,2)),b.setAttribute(g?"layer":"aTex",new r.BufferAttribute(m.textures,1)),b.setAttribute(g?"tint":"aTint",new r.BufferAttribute(m.tints,3)),b.setIndex(new r.BufferAttribute(m.index,1)),d.push(b),b},$=(m,g)=>{let b=[];for(let w=0;w<m.count;w++)b.push(m.getX(w)),g>1&&b.push(m.getY(w)),g>2&&b.push(m.getZ(w));return b},j=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];for(let{unit:m,indices:g,meshes:b,nominal:w}of p){let S=new Map,_=new Map,L=new Map;for(let T of b){let C=T.geometry;if(!y(T.material)){let z=new r.InstancedMesh(C,_n(r,T.material,u),g.length);z.name=`${m}/near/${T.name}`,z.userData.layer="near",h.push({mesh:z,indices:g,local:T.matrixWorld.clone(),far:!1,triangles:(C.index?.count??C.attributes.position.count)/3}),a.add(z);continue}let E=T.material.side;L.set(E,T.material),S.set(E,[...S.get(E)??[],v(T,{positions:$(C.attributes.position,3),normals:$(C.attributes.normal,3),uvs:$(C.attributes.uv,2),index:C.index?.array},T.matrixWorld.elements)])}if(w){let T=H=>R(H.material)?H.userData?.citySlot?.slot:H.material?.userData?.materialSlot,C=H=>b.filter(F=>y(F.material)&&H.has(T(F))).sort((F,ie)=>ie.geometry.attributes.position.count-F.geometry.attributes.position.count)[0],E=C(Tn),z=C(An),D=ze(w);for(let[H,F]of[[E,D.walls],[z,D.roof]]){if(!H||!F.index.length)continue;let ie=H.material.side;L.set(ie,H.material),_.set(ie,[..._.get(ie)??[],v(H,{positions:F.positions,normals:F.normals,uvs:F.uvs,index:F.index},j)])}}for(let[T,C]of[[S,!1],[_,!0]])for(let[E,z]of T){let D=L.get(E),H=Rn(z),F=new r.InstancedMesh(Z(H,R(D)),N(D),g.length);F.name=`${m}/${C?"far":"near"}/merged-${E}`,F.userData.layer=C?"far":"near",h.push({mesh:F,indices:g,local:new r.Matrix4,far:C,triangles:H.index.length/3}),a.add(F)}}let O,K=null,J=new r.Matrix4,oe=new r.Matrix4().makeScale(0,0,0),V=new Map,X=[],ae={near:0,far:0,culled:0},Q=m=>{O=m;let g=new Set(m.near),b=new Set(m.far),w=0;for(let S of h){let _=S.indices.map((L,T)=>({global:L,k:T})).filter(({global:L})=>(S.far?b:g).has(L));_.forEach(({global:L},T)=>{J.multiplyMatrices(i[L],S.local),S.mesh.setMatrixAt(T,V.has(L)?oe:J)}),S.mesh.userData.slotToGlobal=_.map(L=>L.global),S.mesh.count=_.length,S.mesh.instanceMatrix.needsUpdate=!0,S.mesh.visible=_.length>0,_.length&&(S.mesh.computeBoundingSphere(),S.mesh.computeBoundingBox(),w++)}ae={near:m.near.length,far:m.far.length,culled:m.culled};for(let S of X)S.mesh.visible=(S.layer.far?b:g).has(S.global)},Ae=(m=!1)=>{let g=t.getCentre();if(!g)return;let[b,w]=Ne(l,[g.lng,g.lat]),S={x:b,z:w};!m&&K&&Math.hypot(S.x-K.x,S.z-K.z)<10||(K=S,Q(We(f,S,n,o,O)))};Q({near:[],far:f.map((m,g)=>g),culled:0}),Ae(!0);let de=new r.Mesh(new r.BufferGeometry,new r.MeshBasicMaterial);return de.name="building-types/driver",de.frustumCulled=!1,de.onBeforeRender=()=>Ae(),a.add(de),{anchor:l,group:a,suppress:$e(e),radiusMetres:s,update:Ae,setHighlighted(m,g){let b=re(),w=ue[b],S=new Set([...m].map(L=>String(L).replace(/^NL\.IMBAG\.Pand\./,"")));for(let L of X)a.remove(L.mesh),L.mesh.dispose?.();X=[],V.clear(),e.forEach((L,T)=>{S.has(L.pand)?V.set(T,"highlight"):w.desaturate&&g&&it(g.lngLat,L.anchor)&&V.set(T,"dim")});let _=$t(r);for(let[L,T]of V)for(let C of h){if(!C.indices.includes(L))continue;let E=C.mesh.material,z=T==="highlight"?w.keepMaterials?E:R(E)?_.highlighted(E,!0):De(r,E,"highlight",b):R(E)?_.dimmed(E,!0):De(r,E,"dim",b),D=new r.InstancedMesh(C.mesh.geometry,z,1);D.setMatrixAt(0,J.multiplyMatrices(i[L],C.local)),D.name=`${C.mesh.name}/${T}`,D.userData.slotToGlobal=[L],D.computeBoundingSphere(),D.computeBoundingBox(),T==="highlight"&&st(r,D,{style:b}),a.add(D),X.push({global:L,layer:C,mesh:D})}return O&&Q(O),[...V.values()].filter(L=>L==="highlight").length},pandForHit(m,g){let b=m?.userData?.slotToGlobal;return g===void 0||!b?null:e[b[g]]?.pand??null},stats(){let m=h.filter(w=>w.mesh.visible&&w.mesh.count>0).length,g=0,b=0;for(let w of h)w.mesh.visible&&(w.far?b+=w.triangles*w.mesh.count:g+=w.triangles*w.mesh.count);return{instances:e.length,...ae,units:c.size,drawCalls:m,nearTriangles:g,farTriangles:b}},dispose(){for(let m of X)m.mesh.dispose?.();for(let m of h)m.mesh.dispose?.();for(let m of d)m.dispose();for(let m of I.values())m.dispose()}}}return Jt(Cn);})();

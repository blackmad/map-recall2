"use strict";var CanalRecallTileBuildings=(()=>{var Le=Object.defineProperty;var Wn=Object.getOwnPropertyDescriptor;var $n=Object.getOwnPropertyNames;var Vn=Object.prototype.hasOwnProperty;var zn=(e,t)=>{for(var n in t)Le(e,n,{get:t[n],enumerable:!0})},jn=(e,t,n,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of $n(t))!Vn.call(e,o)&&o!==n&&Le(e,o,{get:()=>t[o],enumerable:!(r=Wn(t,o))||r.enumerable});return e};var qn=e=>jn(Le({},"__esModule",{value:!0}),e);var qa={};zn(qa,{RefCache:()=>ie,TileBuildings:()=>le,coverUnion:()=>Qe,mountRecipeTiles:()=>ja,pandOfFace:()=>Ze,recipeTilesBase:()=>Un,recipeTilesEnabled:()=>Gn,wantedTiles:()=>Je});var et={minFilter:"LinearMipmapLinear",magFilter:"Linear",generateMipmaps:!0};function Yn(e,t){let n=t.coarse?128:256,r=e==="facadeCells"?Math.min(t.gpuMaxAnisotropy,t.coarse?4:16):4;return{...et,cellPx:n,anisotropy:r,tierScale:1}}function Kn(e,t){if(!t.enabled||t.coarse||t.tier!=="high")return Yn(e,t);let n=Number.isFinite(t.gpuMaxAnisotropy)&&t.gpuMaxAnisotropy>=1?t.gpuMaxAnisotropy:1,r=Number(t.cellPx),o=Number.isInteger(r)&&r>256&&r<=512&&r%32===0?r:256;return{...et,cellPx:o,anisotropy:Math.min(n,16),tierScale:o/256}}function Xn(){try{let e=globalThis,t=e.__canalRecallTexturePolicy??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("texturePolicy"):null);return!(t===!1||t==="0"||t==="false"||t==="off")}catch{return!0}}function Jn(){try{let e=globalThis,t=Number(e.__canalRecallCellPx??(typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("cellPx"):null)??NaN);return Number.isFinite(t)&&t>0?t:null}catch{return null}}function Zn(){let e=globalThis.__canalPerf?.tier;return e==="low"||e==="mid"||e==="high"?e:null}function Qn(){return!!globalThis.matchMedia?.("(pointer: coarse)").matches}function ue(e,t){return Kn(e,{tier:Zn(),coarse:Qn(),gpuMaxAnisotropy:t,enabled:Xn(),cellPx:Jn()})}var Te={wallPull:.7,glassLift:.5,liftBrick:!0},tt={wallPull:.35,glassLift:.25,liftBrick:!1},Xa={photo:{cells:"photo",shadeBands:0,flatColour:!1,...Te,cartoonRoofCells:!1,outline:!1,litWallGain:255/225},procedural:{cells:"procedural",shadeBands:0,flatColour:!1,...Te,cartoonRoofCells:!1,outline:!1,litWallGain:1},untextured:{cells:"procedural",shadeBands:0,flatColour:!0,...Te,cartoonRoofCells:!1,outline:!1,litWallGain:1},storybook:{cells:"storybook",shadeBands:0,flatColour:!1,...tt,cartoonRoofCells:!1,outline:!0,litWallGain:1,tone:{hueShift:-4,satMul:1.15,satAdd:0,keepDarkBelow:0,lightMul:1,lightAdd:.03,lightMax:.9}},cartoon:{cells:"cartoon",shadeBands:3,flatColour:!1,...tt,cartoonRoofCells:!0,outline:!0,litWallGain:1,tone:{hueShift:0,satMul:1.7,satAdd:.08,keepDarkBelow:.35,lightMul:1.08,lightAdd:0,lightMax:.85}}};var G=(e,t,n)=>Math.max(t,Math.min(n,e));function M(e){let t=/^#?([0-9a-f]{6})$/i.exec(e.trim());if(!t)throw Error(`Bad colour ${e}`);let n=parseInt(t[1],16);return[n>>16&255,n>>8&255,n&255]}var w=e=>"#"+e.map(t=>Math.round(G(t,0,255)).toString(16).padStart(2,"0")).join("");function S([e,t,n]){let r=e/255,o=t/255,s=n/255,a=Math.max(r,o,s),l=Math.min(r,o,s),u=(a+l)/2;if(a===l)return[0,0,u];let i=a-l,f=u>.5?i/(2-a-l):i/(a+l);return[(a===r?(o-s)/i+(o<s?6:0):a===o?(s-r)/i+2:(r-o)/i+4)*60,f,u]}function k([e,t,n]){let r=(1-Math.abs(2*n-1))*t,o=r*(1-Math.abs(e/60%2-1)),s=n-r/2,[a,l,u]=e<60?[r,o,0]:e<120?[o,r,0]:e<180?[0,r,o]:e<240?[0,o,r]:e<300?[o,0,r]:[r,0,o];return[(a+s)*255,(l+s)*255,(u+s)*255]}var rt=(e,t,n)=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n];var Ce={canal:-1/0,c19:1860,school:1915,modern:1945};var Fe=["#76808f","#606b79","#8c939c"],ne={procedural:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:Fe},untextured:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:Fe},photo:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:Fe},storybook:{tile:["#b9553a","#a94a33","#c46a45"],slate:["#556070","#4a5666","#657282"]},cartoon:{tile:["#e85a3c","#f08a2b","#d94a3a"],slate:["#3f5f8f","#2f4a78","#4f7bb0"]}};var ee={gravel:{hex:"#9e9281",luma:[112,156],cell:"flat"},"bitumen-dark":{hex:"#56585e",luma:[62,96],cell:"flat"},"bitumen-light":{hex:"#a99b84",luma:[150,182],cell:"flat"},"white-membrane":{hex:"#d9d9d3",luma:[196,228],cell:"flat"},"pantile-red":{hex:"#b5543a",luma:[84,124],cell:"tile"},"pantile-dark":{hex:"#6a5248",luma:[64,98],cell:"tile"},slate:{hex:"#76808f",luma:[62,140],cell:"slate"},zinc:{hex:"#9aa1a6",luma:[138,176],cell:"slate"},sedum:{hex:"#7a8350",luma:[96,132],cell:"flat"},solar:{hex:"#2e3a52",luma:[44,70],cell:"flat"},terrace:{hex:"#a38d74",luma:[124,162],cell:"flat"},glass:{hex:"#8fa3ad",luma:[130,170],cell:"flat"}},ce={gravel:ee.gravel.hex,membrane:ee["white-membrane"].hex,bitumen:ee["bitumen-dark"].hex,pebble:ee["bitumen-light"].hex},ot=[ce.gravel,ce.membrane,ce.bitumen,ce.pebble],O={tile:ne.photo.tile,slate:ne.photo.slate,flat:ot};var te={photo:{canal:["#7a3b2c","#7a3b2c","#6b3428","#8c4632","#9a5846","#b05a40","#4a2e26","#2e2a27","#3e4a40","#5d605a","#e4ddcd"],c19:["#b05a40","#b05a40","#bd6a45","#a24d38","#c58b5e","#d3b184","#e2d5ba","#e2d5ba","#d9c5a4","#9a5846"],school:["#8c4a38","#7a4535","#9a5240","#6e3d33","#a85a3c","#5e3a32","#b0603f"],modern:["#c9b79a","#b9ad9a","#a8a49c","#d3c6ad","#8f8a82","#bfb3a0","#9c7a62","#b05a40"]},storybook:{canal:["#b9583f","#9a4a38","#7a4a3c","#4a5048","#3f4a5a","#ead9b0","#c8664a"],c19:["#c8664a","#d98b5f","#e0b36a","#ead9b0","#d9b995","#c9a08c","#c8664a"],school:["#a8553f","#9a5a48","#b87a5c","#c8664a","#8a4e40"],modern:null},cartoon:{canal:["#d9453d","#a8433a","#3b3b4a","#2a9d8f","#4672b0","#fffaf0","#e8573d"],c19:["#e8573d","#ee7f2c","#f2b92e","#f3e6c8","#d96a4d","#f2b92e"],school:["#d96a4d","#e8573d","#b9583f","#ee7f2c"],modern:null}};var er={canal:{label:"canal-house centre (before 1860)",wall:te.photo.canal[0],roof:ne.photo.tile[0]},c19:{label:"19th-century ring (1860-1914)",wall:te.photo.c19[0],roof:ne.photo.tile[1]},school:{label:"Amsterdamse School (1915-1944)",wall:te.photo.school[0],roof:ne.photo.slate[0]},modern:{label:"post-war and contemporary (1945+)",wall:te.photo.modern[0],roof:ot[0]}};var at=["brick","stucco","accent","stone","frame","door","glass","roofTile","slate","bitumen","paint"],st={brick:"brick",accent:"brick",stucco:"stucco",stone:"stone",frame:"frame",door:"door",glass:"glass",roofTile:"tile",slate:"slate",bitumen:"flat",paint:"frame"},T={brick:3.36,stucco:2.4,accent:3.36,stone:1.28,frame:1,door:1,glass:1,roofTile:1.2,slate:1.2,bitumen:1.2,paint:1},I=[.3,.6],tr="#f1ede2",nr="#cfc8b8";function rr(e){let[t,n,r]=S(M(e)),o=G(.12+r*.9,I[0],I[1]);return w(k([t,G(n,.12,.5),o]))}function or(e){let[t,n,r]=S(M(e));return w(k([t,G(n,0,.55),G(r*1.06+.03,.4,.97)]))}function ar(e){let t=M(e),[n,r,o]=S(t);return o>=.5?w(rt(t,M(tr),.75)):w(k([n,r,Math.max(o,.16)]))}function sr(e){let[t,n,r]=S(M(e));return w(rt(k([t,n,Math.max(r,.62)]),M(nr),.45))}function ir(e){let[t,n,r]=S(M(e));return r>=.17?e.startsWith("#")?e.toLowerCase():"#"+e.toLowerCase():w(k([t,n<.15?0:n,.17]))}function lr(e,t){let n=S(M(t))[2];if(e==="roofTile"){let[r,o]=S(M(t));return o<.2?O.slate[1]:w(k([r,G(o*1.1,.35,.6),G(.2+n*.85,.38,.5)]))}return e==="slate"?n<.27?O.slate[1]:n<.31?O.slate[0]:O.slate[2]:n<.4?O.flat[2]:O.flat[0]}var z="measured",ur=.18,cr=225/255;function mr(e){let[t,n,r]=S(M(e)),[o,s,a]=M(w(k([t,n,Math.max(r,ur)])));return w([o,s,a].map(l=>Math.min(255,Math.round(l/cr))))}var U=32,W=64,P=[157.19,92.83,69.17],it=240.95,lt=.16,fr=255/(P[0]+(it-P[0])*lt);function Ee(e,t){let n=t/(W-1),r=n<.5?P[0]+(P[1]-P[0])*(n/.5):P[1]+(P[2]-P[1])*((n-.5)/.5),o=5-15*t/35,s=17-15*t/35,a=t<35&&e+.5>=o&&e+.5<s;return Math.min(255,Math.round((a?r+(it-r)*lt:r)*fr))}var hr=(()=>{let e=0;for(let t=0;t<W;t++)for(let n=0;n<U;n++)e+=Ee(n,t);return e/(U*W)})(),nt=.4;function dr(e){let[t,n,r]=S(M(e)),s=(r>=nt?M(e):k([t,n,nt])).map(l=>l/(hr/255)),a=Math.max(1,...s.map(l=>l/255));return w(s.map(l=>Math.min(255,Math.round(l/a))))}var pr=228/255;function br(e){return w(M(e).map(t=>Math.min(255,Math.round(t/pr))))}function gr(e){return w(M(e))}function yr(e){return w(M(e))}var xr=["brick","accent","glass","stone","bitumen","slate","roofTile"],ut=(e,t)=>t===z&&xr.includes(e);function me(e,t,n){if(n===z&&(e==="brick"||e==="accent"))return mr(t);if(n===z&&e==="glass")return dr(t);if(n===z&&e==="stone")return br(t);if(n===z&&e==="bitumen")return gr(t);if(n===z&&(e==="slate"||e==="roofTile"))return yr(t);switch(e){case"brick":case"accent":return rr(t);case"stucco":return or(t);case"stone":return sr(t);case"frame":return ar(t);case"door":return ir(t);case"glass":return"#ffffff";case"paint":return t.startsWith("#")?t.toLowerCase():"#"+t.toLowerCase();default:return lr(e,t)}}var Oe={asphalt:{base:[86,88,93]},cycle:{base:[150,66,58]},klinker:{base:[122,90,80],joint:"#4b3d38"},pavement:{base:[174,162,152],joint:"#7f756b"},kerb:"#cfcac0",paint:"#f2f0ea",rail:"#6c6e72",bollard:"#5a2a26"},ct="#ffd21f",mt="#ff8033",ft="#b4682c";var ht={land:{base:[168,158,142],joint:"#857b6d"},paving:{base:[184,174,158],joint:"#8f8577"},square:{base:[190,179,161],joint:"#958a7c"},klinker:{base:[158,124,114],joint:"#7a6660"},asphalt:[68,72,80],cycle:[156,76,66],gravel:[180,166,136],park:[96,140,70],wood:[70,112,58],parking:[102,102,105],kerb:"#aaa498",water:"#46707c",lawn:[110,154,74],bed:{soil:[98,80,60],leaf:[84,122,58]},shrub:{base:[56,92,46],leaf:[76,116,56]},bark:[118,84,58],sand:[212,194,150],parkGravel:[198,184,152],parkPath:[110,110,112],pond:"#46707c"};var dt="inferred",Mr=e=>S(M(e))[1]<.2,wr=e=>{let[t,n,r]=S(M(e));return(t<45||t>340)&&n>=.15&&r<.7},Rr=e=>Mr(e)?"slate":"roofTile",De=e=>wr(e)?"brick":"stucco",Sr=[{test:/glass|glaz|window|vitr|ruit|pane/,slot:"glass",confidence:"name",rule:"glazing name"},{test:/decal|sign|mural|logo|letter|clock|dial/,slot:"paint",confidence:"name",rule:"signage / decal"},{test:/door|deur|gate/,slot:"door",confidence:"name",rule:"door name"},{test:/frame|kozijn|louvre|louver|blind|shutter|rail|mullion|sash/,slot:"frame",confidence:"name",rule:"joinery name"},{test:/brick|baksteen|klinker|terracotta/,slot:"brick",confidence:"name",rule:"brick name"},{test:/slate|leien|lei$/,slot:"slate",confidence:"name",rule:"slate name"},{test:/bitumen|asphalt|tar$|felt|flatroof|flat-roof|gravel/,slot:"bitumen",confidence:"name",rule:"flat roof name"},{test:/roof|tile|pantile|dakpan|dak/,slot:Rr,confidence:"name",rule:"roof name, grey \u2192 slate, else pantile"},{test:/sandstone|stone|steen|column|marble|granite|limestone|plinth/,slot:"stone",confidence:"name",rule:"stone name"},{test:/stucco|render|plaster|pleister|concrete|beton|slab/,slot:"stucco",confidence:"name",rule:"render / concrete name"},{test:/gold|gilt|bronze|copper|brass|zinc|metal|steel|iron|lead|alu/,slot:"paint",confidence:"name",rule:"metal name (flat colour)"},{test:/wall|facade|gevel/,slot:De,confidence:"name",rule:"wall name, brick hue \u2192 brick, else stucco"},{test:/ochre|yellow|buff/,slot:De,confidence:"colour-word",rule:"ochre: yellow brick (brick hue) or render"},{test:/pink|rose/,slot:"stucco",confidence:"colour-word",rule:"pink: painted render"},{test:/moss|grass|green|blue|orange|purple|paint|teal/,slot:"paint",confidence:"colour-word",rule:"coloured paint word"},{test:/white|cream|ivory/,slot:"stucco",confidence:"colour-word",rule:"white: stucco (could be white trim)"},{test:/dark|black|charcoal|anthracite/,slot:"frame",confidence:"colour-word",rule:"dark: painted joinery / ironwork (could be a dark wall)"},{test:/red/,slot:De,confidence:"colour-word",rule:"red: brick hue \u2192 brick (could be red tile or paint)"},{test:/grey|gray/,slot:"stucco",confidence:"colour-word",rule:"grey: render (could be concrete or zinc)"}];function pt(e){return String(e??"").toLowerCase().replace(/[-_.\s]*\d+$/,"").trim()}function _r(e){let[t,n,r]=S(M(e));return r<.22?{slot:"frame",rule:"very dark: joinery / ironwork"}:n>=.15&&(t<45||t>340)&&r<.62?{slot:"brick",rule:"brick hue"}:n<.2&&r>=.6?{slot:"stucco",rule:"pale neutral: render"}:n<.2&&r>=.22&&t>180&&t<260?{slot:"slate",rule:"blue-grey: slate"}:n<.25?{slot:"stone",rule:"neutral mid-tone: stone"}:{slot:"paint",rule:"saturated colour: paint"}}function bt(e,t){let n=t.toLowerCase(),r=pt(e);for(let s of Sr)if(s.test.test(r))return{slot:typeof s.slot=="function"?s.slot(n):s.slot,tint:n,confidence:s.confidence,rule:s.rule};let o=_r(n);return{slot:o.slot,tint:n,confidence:"colour",rule:`no material word in "${r||"unnamed"}"; ${o.rule}`}}var gt=e=>/white|cream|ivory/.test(pt(e)),yt=e=>typeof e=="string"&&at.includes(e);var wt={ribs:{pitch:.5,min:.25,max:2,w:.09,out:.04},boards:{pitch:.4,min:.15,max:1.5,w:.05,out:.035},louvres:{pitch:.35,min:.2,max:1,w:.12,out:.12},panels:{pitch:1.2,min:.6,max:6,w:.05,out:.035}};var Os={min:.15,max:wt.ribs.max};var Rt={canal:["#6e5352","#8c7768","#977f73","#a79276","#b8a17a","#575245","#60564b","#62544d","#61584c","#655850","#655b50","#6a5454","#6f6058","#726359","#726459","#76615d","#77685d","#7a6c60","#826c66","#918174","#9a887f","#a89f8a","#6b6163","#dfdcd2"],c19:["#70564f","#6f5b52","#7a665c","#86695b","#886a5f","#857266","#8b746d","#9b887e","#a38e83","#ad9585","#61534a","#63564e","#685b52","#6f6057","#716259","#75665c","#7b6961","#7c6962","#7f6a64","#7f7664","#8e796f","#9c9181","#95787e","#dad8cf"],school:["#665247","#775744","#735d52","#786158","#8c5957","#896559","#856f63","#9d7f6d","#ad997f","#5c4f48","#61564c","#67564e","#6b5554","#6b5851","#6b5b50","#716057","#745e5b","#75655c","#78665f","#806d64","#89706b","#a19888","#614a4e","#a4a09f"],modern:["#715d53","#7c6459","#816b64","#8f7265","#9c8980","#ac9a86","#60594c","#635c4e","#6a5a50","#6c5a54","#6c5e55","#6e6256","#72675a","#776a5d","#7b6a61","#7f6f64","#807265","#886f6b","#8b7d6d","#958b79","#a29189","#695256","#a59b8d","#c8c5ba"]};var Pe={"#4f4834":[215,215,215],"#463823":[216,215,215],"#5f5950":[215,215,215],"#a69873":[215,215,215],"#57423e":[215,215,215],"#473c3b":[215,215,215],"#5d5d5c":[214,215,215],"#7e573b":[215,215,215],"#705449":[215,215,215],"#7f8283":[215,214,215],"#796764":[215,215,215],"#5d534b":[215,215,215],"#7d6e52":[215,215,215],"#88735e":[215,215,215],"#88715f":[215,215,215],"#736352":[215,215,215],"#241d1c":[172,172,172],"#4b3f37":[215,215,215],"#615551":[215,215,215],"#595651":[214,215,214],"#423931":[215,215,215],"#7b6d6a":[215,214,216],"#382418":[215,215,215],"#866343":[215,215,215],"#6e6256":[215,215,215],"#625650":[205,205,205],"#252c24":[185,185,186],"#2d281b":[215,214,215],"#3b342b":[215,215,215],"#6f5c56":[215,215,215],"#393535":[215,215,215],"#786357":[215,215,215],"#383d43":[205,215,215],"#554e4a":[215,216,215],"#3d3432":[215,215,215],"#3d353c":[215,215,215],"#4e443f":[215,215,215],"#70574d":[207,207,207],"#d49662":[215,215,215],"#917b5c":[215,215,215],"#494341":[215,215,215],"#645f5f":[215,215,214],"#342a18":[215,215,215],"#825746":[215,216,215],"#99604e":[212,215,215],"#706868":[215,215,215],"#786b61":[215,215,214],"#5c5b57":[215,215,215],"#7a655b":[215,215,215],"#6f5b54":[215,215,215],"#4a3f3a":[215,214,215],"#614f44":[216,215,215],"#654e44":[215,215,215],"#6f5f53":[215,215,216],"#584d49":[215,215,215],"#d3c9b2":[215,215,215],"#544b46":[215,215,215],"#929289":[215,215,215],"#68584f":[215,215,216],"#574d47":[215,215,215],"#5e4e41":[215,215,215],"#6e605a":[215,215,215],"#605d5c":[215,215,215],"#8c7a6f":[215,215,215],"#4a3832":[165,165,166],"#81614f":[215,215,215],"#3d3533":[215,215,215],"#6d5351":[215,215,215],"#5c3d33":[214,214,215],"#906553":[215,215,215],"#65493d":[215,215,215],"#8e5f49":[215,215,215],"#8c6858":[215,215,215],"#8b5946":[215,215,215],"#665253":[209,209,209],"#3e3222":[215,215,215],"#000000":[197,198,197],"#7b081b":[215,215,215],"#383131":[215,215,215],"#3d3b37":[211,215,215],"#877d76":[214,215,215],"#191d0c":[215,214,213],"#bcab88":[215,215,215],"#656462":[215,215,215],"#3f3634":[174,174,175],"#463e3c":[197,197,198],"#453d3a":[177,177,176],"#1f1a1b":[156,156,157],"#615450":[214,215,215],"#5b4f4b":[215,215,215],"#574c4a":[215,215,215],"#413333":[215,215,215],"#7b5c53":[215,215,215],"#5f342b":[216,215,215],"#4e2422":[215,215,215],"#5b4b44":[209,209,209],"#493d32":[215,215,215],"#6a5048":[216,216,215],"#5e5855":[215,215,215],"#5e3f35":[215,215,215],"#68564f":[215,215,215],"#6b3e33":[215,214,215],"#5f3c30":[215,214,215],"#929191":[215,215,215],"#a2acb3":[215,215,215],"#8f7b65":[215,215,215],"#988e7d":[215,215,215],"#726d60":[215,215,215],"#584c45":[215,214,215],"#594643":[216,215,215],"#5e5750":[212,215,215],"#78645b":[215,215,215],"#484440":[215,215,215],"#73645e":[215,215,215],"#5c4f47":[215,215,215],"#3c3d39":[215,215,215],"#645451":[215,215,214],"#37333d":[179,179,178],"#a6856f":[215,215,215],"#574d4d":[205,205,205],"#393737":[215,215,215],"#6f4a3b":[215,214,215],"#ffa169":[212,215,215],"#576465":[216,215,216],"#71614a":[215,215,215],"#6c584f":[215,215,215],"#5b463e":[215,216,215],"#765e52":[214,215,215],"#4f4e4c":[215,215,215],"#544945":[215,215,215],"#504140":[194,195,194],"#51514f":[215,215,215],"#74665f":[215,215,215],"#735c59":[215,215,215],"#474d56":[215,215,215],"#7d6e5a":[215,215,215],"#514a43":[215,215,215],"#4e4e49":[215,215,215],"#745c51":[215,215,215],"#47403c":[215,215,215],"#4c3a37":[215,215,215],"#675d5a":[215,215,215],"#574e48":[215,215,215],"#686360":[215,215,215],"#4a413f":[215,215,215],"#423735":[215,215,215],"#756860":[215,215,215],"#5e5144":[215,215,215]};var Ei={street:{...Oe,brick:Oe.klinker},tones:ht};var Or=["sunny","legacy"],Dr="sunny";function B(e){let t=globalThis,r=/[?&]look=([\w-]+)/.exec(e??t.location?.search??"")?.[1]??t.__canalRecallLook;return Or.includes(r??"")?r:Dr}var Y=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},Pr=e=>255*(e<=.0031308?e*12.92:1.055*e**(1/2.4)-.055),$=e=>{let t=parseInt(e.replace("#",""),16);return[t>>16&255,t>>8&255,t&255]},Ie=e=>"#"+e.map(t=>Math.round(Math.max(0,Math.min(255,t))).toString(16).padStart(2,"0")).join(""),Ir=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],q=e=>Ir($(e).map(Y)),Br=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],Nr={zenith:"#9ec3ed",horizon:"#a1c6e5"};function Hr(e){let t=e.sunElevationDeg*Math.PI/180,n=q(e.sunColour)*e.sunIntensity/Math.PI,r=q(e.skyColour)*e.skyIntensity/Math.PI,o=q(e.groundColour)*e.skyIntensity/Math.PI,s=(r+o)/2;return{flat:n*Math.sin(t)+r,sunWall:n*Math.cos(t)+s,shadeWall:s}}var Gr=.55;function Ur(e="#ffe2bf",t="#aca497",n=Gr){let r=40*Math.PI/180,o=u=>{let i=Ie($(Nr.horizon).map(h=>h+(255-h)*u)),f=q(e)*2.15/Math.PI*Math.cos(r),m=(q(i)+q(t))/2/Math.PI,c=n*f/(1-n)/m;return{sunColour:e,sunIntensity:2.15,skyColour:i,groundColour:t,skyIntensity:c,sunElevationDeg:40}},s=u=>{let i=o(u),f=$(i.sunColour).map(Y),m=$(i.skyColour).map(Y),c=[0,2].map(h=>f[h]*i.sunIntensity*Math.sin(r)+m[h]*i.skyIntensity);return c[0]/c[1]},a=0,l=1;for(let u=0;u<40;u++){let i=(a+l)/2;s(i)<1?a=i:l=i}return{...o(l),whiteMix:+l.toFixed(3)}}var j=Ur(),St=1/Hr(j).sunWall,kt={sunColour:j.sunColour,sunIntensity:+(j.sunIntensity*St).toFixed(4),skyColour:j.skyColour,groundColour:j.groundColour,skyIntensity:+(j.skyIntensity*St).toFixed(4)},_t=[.85,1.6],Wr=e=>typeof e=="string"?$(e):e;function Be(e){let t=e?Y(219)/Y(Br(Wr(e))):1.106;return Math.max(_t[0],Math.min(_t[1],t))}function K(e,t){let n=$(e).map(o=>Y(o)*t),r=Math.max(1,...n);return Ie(n.map(o=>Pr(o/r)))}function vt(e,t=Pe[e.toLowerCase()]){return K(e,Be(t))}function At(e,t,n,r=B(),o){return r!=="sunny"||n!=="measured"||e!=="brick"&&e!=="accent"?t:o?vt(t,o):vt(t)}var Ni=(()=>{let e=Object.keys(Pe).map($),t=n=>n.slice().sort((r,o)=>r-o)[n.length>>1];return Ie([0,1,2].map(n=>t(e.map(r=>r[n]))))})();var Vr=2,zr=.62;function jr(e,t=Vr){let n=K(e,t);if(S(M(e))[2]>=zr)return n;let[r,o,s]=S(M(n));return s<=I[1]?n:w(k([r,o,I[1]]))}var qr=e=>Object.fromEntries(Object.entries(e).map(([t,n])=>[t,n?n.map(r=>jr(r)):null])),qi=qr(Rt);var Lt=["canal","c19","school","postwar","modern","tower"];var Xr=8;var wl=16+Math.log2(Xr);var R=256,Jr=["upper","ground","door","plain","shop"],Zr=2;var vl=Lt.length*Zr*Jr.length;var L=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16));var kl=L("#7d93a0"),Al=L("#1f2a33");var Ll=L("#b8ad98"),Tl=L("#cfc6b4"),Fl=L("#ece8dd"),Cl=L("#e2d9c2"),El=[L("#2c4a3d"),L("#3a2a22"),L("#1f3b57"),L("#5a2a24")],Ol=[L("#2f4a3a"),L("#7a2f27"),L("#27384f")];var Tt=.6;function he(e,t,n){let r=Math.imul(e|0,374761393)^Math.imul(t|0,668265263)^Math.imul(n|0,2246822519);return r=Math.imul(r^r>>>13,1274126177),((r^r>>>16)>>>0)/4294967296}function Ft(e,t){let n=0;for(let o=0;o<e.length;o+=4)n+=e[o];let r=n/(e.length/4);for(let o=0;o<e.length;o+=4){let s=Math.round(Math.max(0,Math.min(255,r+(e[o]-r)*t)));e[o]=e[o+1]=e[o+2]=s}}function Ct(e,t){let n=new Uint8ClampedArray(R*R*4),r=(o,s,a,l,u)=>{let i=(s*R+o)*4,f=u??[a,a,a];n[i]=f[0],n[i+1]=f[1],n[i+2]=f[2],n[i+3]=l};if(e==="flat")for(let o=0;o<R;o++)for(let s=0;s<R;s++)r(s,o,Math.round((t?.96:.9+(he(s>>3,o>>3,3)-.5)*.08)*255),255);else if(e==="tile"){let a=R/8,l=R/5;for(let u=0;u<R;u++)for(let i=0;i<R;i++){let f=Math.floor(u/a),m=u%a/a,c=(i+f%2*l*.5)%R,h=Math.floor(c/l),d=c%l/l,p=Math.sin(d*Math.PI),y=t?.92:.7+.22*p-.28*Math.pow(Math.max(0,1-m*3.2),1.5)*0-.22*Math.max(0,(.18-m)/.18);t||(y+=(he(h,f,7)-.5)*.14);let b=t?m<.07||d<.035||d>.965:!1;r(i,u,Math.round(Math.max(0,Math.min(1,b?.28:y))*255),255)}t||Ft(n,Tt)}else if(e==="slate"){let a=R/11,l=R/6;for(let u=0;u<R;u++)for(let i=0;i<R;i++){let f=Math.floor(u/a),m=u%a/a,c=(i+f%2*l*.5)%R,h=Math.floor(c/l),d=c%l/l,p=t?.9:.82+(he(h,f,11)-.5)*.16-.16*Math.max(0,(.16-m)/.16);(d<(t?.05:.025)||m<(t?.09:.04))&&(p=t?.3:p*.7),r(i,u,Math.round(Math.max(0,Math.min(1,p))*255),255)}t||Ft(n,Tt)}else for(let u=0;u<R;u++)for(let i=0;i<R;i++){let f=i/R,m=u/R,c=f>.2-.06&&f<.8+.06&&m>.2-.06&&m<.82+.06,h=f>.2+.03&&f<.8-.03&&m>.2+.03&&m<.82-.03,d=Math.abs(f-.5)<.018||Math.abs(m-.5)<.018;if(h&&!d){let p=(m-.2)/.6199999999999999,y=t?[150+60*p,200+30*p,235]:[40+80*p*p,55+90*p*p,68+90*p*p];r(i,u,0,0,[y[0],y[1],y[2]])}else if(c)r(i,u,0,0,t?[255,250,240]:[236,232,221]);else{let p=t?.92:.85+(he(i>>3,u>>3,5)-.5)*.12,y=t&&(i<5||u<5||i>R-6||u>R-6);r(i,u,Math.round((y?.3:p)*255),255)}}return n}function Et(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let i=0;i<336;i+=112)for(let f=0;f<336;f+=112)o.drawImage(t,f,i,112,112);else{let i=7,f=()=>(i=i*16807%2147483647)/2147483647;for(let m=0,c=0;c<336;c+=14,m++)for(let h=-(m%2)*24;h<336;h+=48){let d=150+f()*50;o.fillStyle=`rgb(${d},${d*.92},${d*.86})`,o.fillRect(h,c,48,14)}}o.strokeStyle="rgba(235,223,205,0.18)",o.lineWidth=1.7;for(let i=0,f=6;f<336;f+=14,i++){o.beginPath(),o.moveTo(0,f),o.lineTo(336,f),o.stroke();for(let m=i%2*24;m<336;m+=48)o.beginPath(),o.moveTo(m,f),o.lineTo(m,f+14),o.stroke()}let s=o.getImageData(0,0,336,336),a=s.data,l=0;for(let i=0;i<a.length;i+=4)l+=(a[i]+a[i+1]+a[i+2])/3;l/=a.length/4;let u=l>0?Math.min(2.4,225/l):1;for(let i=0;i<a.length;i+=4){let f=(a[i]+a[i+1]+a[i+2])/3,m=Math.min(255,(f+(l-f)*.7)*u);a[i]=a[i+1]=a[i+2]=m,a[i+3]=255}return o.putImageData(s,0,0),r}function Ot(e){let t=e.createElement("canvas");t.width=64,t.height=128;let n=t.getContext("2d"),r=n.createLinearGradient(0,0,0,128);return r.addColorStop(0,"#8aa1b0"),r.addColorStop(.5,"#4d606c"),r.addColorStop(1,"#3c474e"),n.fillStyle=r,n.fillRect(0,0,64,128),n.fillStyle="rgba(235,242,248,0.16)",n.beginPath(),n.moveTo(10,0),n.lineTo(34,0),n.lineTo(4,70),n.lineTo(-20,70),n.closePath(),n.fill(),t}function Dt(e){let t=e.createElement("canvas");t.width=U,t.height=W;let n=t.getContext("2d"),r=n.createImageData(U,W);for(let o=0;o<W;o++)for(let s=0;s<U;s++){let a=(o*U+s)*4,l=Ee(s,o);r.data[a]=r.data[a+1]=r.data[a+2]=l,r.data[a+3]=255}return n.putImageData(r,0,0),t}function Pt(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d");n.fillStyle="#ffffff",n.fillRect(0,0,128,128),n.fillStyle="rgba(0,0,0,0.10)";for(let r=0;r<128;r+=16)n.fillRect(r,0,1.5,128);return t}function It(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=23,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++){let l=(s()-.5)*3;for(let u=0;u<128;u++){let i=(a*128+u)*4,f=s()<.012?-14:0,m=243+(s()-.5)*8+l+f;r.data[i]=r.data[i+1]=r.data[i+2]=m,r.data[i+3]=255}}return n.putImageData(r,0,0),t}function Bt(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=11,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<r.data.length;a+=4){let l=228+(s()-.5)*16;r.data[a]=r.data[a+1]=r.data[a+2]=l,r.data[a+3]=255}return n.putImageData(r,0,0),n.fillStyle="rgba(80,70,60,0.18)",n.fillRect(0,0,128,1.5),t}function de(e,t){let n=Ct(t,!1),r=Math.round(Math.sqrt(n.length/4)),o=e.createElement("canvas");o.width=o.height=r;let s=o.getContext("2d"),a=s.createImageData(r,r);for(let l=0;l<n.length;l+=4)a.data[l]=n[l],a.data[l+1]=n[l+1],a.data[l+2]=n[l+2],a.data[l+3]=255;return s.putImageData(a,0,0),o}var Qr=238;function Nt(e,t){let r=e.createElement("canvas");r.width=r.height=336;let o=r.getContext("2d",{willReadFrequently:!0});if(t)for(let i=0;i<336;i+=112)for(let f=0;f<336;f+=112)o.drawImage(t,f,i,112,112);else{let i=13,f=()=>(i=i*16807%2147483647)/2147483647;for(let m=0,c=0;c<336;c+=14,m++)for(let h=-(m%2)*24;h<336;h+=48){let d=165+f()*30;o.fillStyle=`rgb(${d},${d*.93},${d*.88})`,o.fillRect(h,c,48,14)}}o.strokeStyle="rgba(245,240,230,0.26)",o.lineWidth=1.2;for(let i=0,f=6;f<336;f+=14,i++){o.beginPath(),o.moveTo(0,f),o.lineTo(336,f),o.stroke();for(let m=i%2*24;m<336;m+=48)o.beginPath(),o.moveTo(m,f),o.lineTo(m,f+14),o.stroke()}let s=o.getImageData(0,0,336,336),a=s.data,l=0;for(let i=0;i<a.length;i+=4)l+=(a[i]+a[i+1]+a[i+2])/3;l/=a.length/4;let u=l>0?Math.min(2.6,Qr/l):1;for(let i=0;i<a.length;i+=4){let f=(a[i]+a[i+1]+a[i+2])/3,m=Math.min(255,(f+(l-f)*.82)*u);a[i]=a[i+1]=a[i+2]=m,a[i+3]=255}return o.putImageData(s,0,0),r}function Ht(e){let t=e.createElement("canvas");t.width=t.height=128;let n=t.getContext("2d"),r=n.createImageData(128,128),o=31,s=()=>(o=o*16807%2147483647)/2147483647;for(let a=0;a<128;a++)for(let l=0;l<128;l++){let u=(a*128+l)*4,i=246+(s()-.5)*3;r.data[u]=r.data[u+1]=r.data[u+2]=i,r.data[u+3]=255}return n.putImageData(r,0,0),t}function Gt(e){let t=e.createElement("canvas");t.width=t.height=4;let n=t.getContext("2d");return n.fillStyle="#fff",n.fillRect(0,0,4,4),t}var to="highlight",no="__canalRecallHighlight",ro="highlightAccent",oo="__canalRecallHighlightAccent",pe={yellow:{keepMaterials:!1,outline:!1,rim:!1,desaturate:!1,ring:!1,beacon:!1,wash:!1,animated:!1},a:{keepMaterials:!0,outline:!0,rim:!1,desaturate:!1,ring:!0,beacon:!0,wash:!0,animated:!1},b:{keepMaterials:!0,outline:!1,rim:!0,desaturate:!1,ring:!0,beacon:!1,wash:!1,animated:!0},c:{keepMaterials:!0,outline:!1,rim:!1,desaturate:!0,ring:!0,beacon:!1,wash:!1,animated:!1}};var ao=60,N=.4,X=2,We=3.5,Ut=100,so=300;var io=.75,Ne=.35,lo="__canalRecallHighlightBoost";function Wt(){let e=Number(globalThis[lo]);return Number.isFinite(e)?Math.min(1,Math.max(0,e)):0}var He="__canalRecallHighlightExtent";function qt(){let e=globalThis;return e[He]instanceof Map?e[He]:e[He]=new Map}var uo=.3,co=2.4,mo=.9,fo=2.2,be={drawn:0,hide:1,highlight:2,dim:3,ghost:4},ho=.28;function $t(e){if(typeof e!="string")return null;let t=e.trim().toLowerCase();return t==="a"||t==="outline"?"a":t==="b"||t==="rim"?"b":t==="c"||t==="desaturate"?"c":t==="yellow"||t==="0"||t==="off"||t==="old"?"yellow":t==="default"?Ge:null}var Ge="a";function Z(e){try{let t=globalThis;if(e===void 0){let n=$t(t[no]);if(n)return n}return $t(new URLSearchParams(e??t.location?.search??"").get(to))??Ge}catch{return Ge}}var Yt=(e=Z())=>pe[e];function Kt(e=Z(),t){if(e==="yellow")return ct;try{let n=globalThis,r=(t===void 0?n[oo]:void 0)??new URLSearchParams(t??n.location?.search??"").get(ro);if(r==="hud")return ft;if(typeof r=="string"&&/^#?[0-9a-f]{6}$/i.test(r))return r.startsWith("#")?r:`#${r}`}catch{}return mt}function $e(e=Z()){return pe[e].keepMaterials?{HL_KEEP:""}:{}}var Ve=`
#ifdef HL_KEEP
#define HL_PAINT(h) false
#else
#define HL_PAINT(h) ((h) > 0.5 && (h) < 1.5)
#endif
#define HL_GHOST(h) ((h) > 2.5 && fract(dot(floor(gl_FragCoord.xy), vec2(0.569840296, 0.754877666))) >= ${ho.toFixed(3)})
float hlState(float hidden) { return hidden > 3.5 ? 3.0 : (hidden > 2.5 ? 2.0 : (hidden > 1.5 ? 1.0 : 0.0)); }
vec3 hlDesat(vec3 c, float h) { return h > 1.5 && h < 2.5 ? mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), ${N.toFixed(2)}) : c; }`,po=110540,bo=e=>111320*Math.cos(e*Math.PI/180);function go(e,t){let n=(e[1]+t[1])/2;return Math.hypot((e[0]-t[0])*bo(n),(e[1]-t[1])*po)}var Xt=(e,t,n=ao)=>!!e&&go(e,t)<=n;var Vt=`
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
  float far = clamp((length(c4.xyz - hlEye) - ${Ut.toFixed(1)}) / ${(so-Ut).toFixed(1)}, 0.0, 1.0);
  float width = hlWidthPx * mix(1.0, hlFarScale, far);
  if (dot(dir, dir) > 1e-12) clip.xy += normalize(dir) * width * 2.0 / hlViewport * clip.w;
#endif
  gl_Position = clip;
}`,yo=`
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
  if (up < ${Ne.toFixed(2)} || hlWash <= 0.0) discard;
  gl_FragColor = vec4(hlAccent, hlWash * smoothstep(${Ne.toFixed(2)}, ${(Ne+.15).toFixed(2)}, up));
#else
  vec3 n = hlHasNormal > 0.5 ? normalize(vHlNormal) : normalize(cross(dFdx(vHlPos), dFdy(vHlPos)));
  vec3 v = normalize(hlEye - vHlPos);
  float f = pow(1.0 - abs(dot(n, v)), ${fo.toFixed(2)});
  float pulse = 0.775 + 0.225 * sin(hlTime * 6.2831853 / ${co.toFixed(2)});
  gl_FragColor = vec4(hlAccent * f * ${mo.toFixed(2)} * pulse, 1.0);
#endif
}`,J="canalRecallHighlightPass",xo="__canalRecallHighlightOutlinePx";function Mo(){let e=globalThis[xo],t=e==null||e===""?NaN:Number(e);return Number.isFinite(t)&&t>=0?t:null}var wo=(e,t)=>{let[n,r,o]=M(t);return new e.Vector3(n/255,r/255,o/255)};function Ro(e,t,n={}){let r={};n.merged&&(r.HL_MERGED=""),t==="outline"&&(r.HL_OUTLINE=""),t==="roof"&&(r.HL_ROOF="");let o=Vt;if(n.feature){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n.feature.attribute))throw new Error(`highlight: bad feature attribute ${n.feature.attribute}`);r.HL_FEATURE=n.feature.attribute,o=`attribute float ${n.feature.attribute};
uniform float hlFeatureId;
${Vt}`}let s=new e.ShaderMaterial({defines:r,uniforms:{hlViewport:{value:new e.Vector2(1,1)},hlWidthPx:{value:X},hlFarScale:{value:We/X},hlCentre:{value:new e.Vector3},hlDepthPush:{value:uo},hlAccent:{value:wo(e,n.accent??Kt())},hlEye:{value:new e.Vector3},hlTime:{value:0},hlHasNormal:{value:1},hlFeatureId:{value:n.feature?.id??0},hlUp:{value:new e.Vector3(0,0,1)},hlWash:{value:0}},vertexShader:o,fragmentShader:yo,side:t==="outline"?e.BackSide:e.FrontSide,transparent:!0,depthTest:!0,depthWrite:t==="outline",blending:t==="rim"?e.AdditiveBlending:e.NormalBlending,polygonOffset:t!=="outline",polygonOffsetFactor:-1,polygonOffsetUnits:t==="roof"?-4:-2});return s.name=`highlight/${t}${n.merged?"/merged":""}`,s.userData={[J]:!0},s.defaultAttributeValues={hidden:[0],normal:[0,0,0]},s}function So(e,t,n,r){let o=e.geometry?.boundingBox,s=t.elements;if(!o)return;let a=n.domElement,l=a?.clientWidth||r.x,u=a?.clientHeight||r.y,i=[],f=!1;for(let m=0;m<8;m++){let c=m&1?o.max.x:o.min.x,h=m&2?o.max.y:o.min.y,d=m&4?o.max.z:o.min.z,p=s[0]*c+s[4]*h+s[8]*d+s[12],y=s[1]*c+s[5]*h+s[9]*d+s[13],b=s[3]*c+s[7]*h+s[11]*d+s[15];if(!(b>1e-9)){f=!0;break}i.push((p/b+1)/2*l,(1-y/b)/2*u)}qt().set(e,{t:performance.now(),points:i,behind:f,width:l,height:u})}function ge(e){for(let t of e?.userData?.[J]??[])e.remove(t),Ao(t.material),qt().delete(t);e?.userData&&delete e.userData[J]}var _o=4,Ue=new Map,Jt=Symbol("highlightPassPool");function vo(e,t){return`${e}|${t.merged?1:0}|${t.feature?.attribute??""}|${t.accent??""}`}function ko(e,t,n={}){let r=vo(t,n),o=Ue.get(r)?.pop();if(o){let a=o.uniforms;return a.hlCentre.value.set(0,0,0),a.hlHasNormal.value=1,a.hlFeatureId.value=n.feature?.id??0,a.hlUp.value.set(0,0,1),a.hlWash.value=0,a.hlEye.value.set(0,0,0),a.hlTime.value=0,a.hlWidthPx.value=X,a.hlFarScale.value=We/X,o}let s=Ro(e,t,n);return s.userData[Jt]=r,s}function Ao(e){let t=e?.userData?.[Jt];if(!t){e?.dispose?.();return}let n=Ue.get(t)??[];Ue.set(t,n),n.length<_o&&!n.includes(e)?n.push(e):e.dispose()}function zt(e){let t=e?.getAttribute?.("position")??e?.attributes?.position;return!t||!!t.array}function ze(e,t,n={}){ge(t);let r=pe[n.style??Z()],o=[...r.outline?["outline"]:[],...r.rim?["rim"]:[],...r.wash&&!n.feature?["roof"]:[]];if(!o.length||!t?.geometry)return[];let s=t.geometry,a=n.centre;if(!a){!s.boundingBox&&zt(s)&&s.computeBoundingBox?.();let y=s.boundingBox?.getCenter(new e.Vector3)??s.boundingSphere?.center;a=y?[y.x,y.y,y.z]:[0,0,0]}let l=s.getAttribute?.("normal")?1:0,u=[],i=new e.Matrix4,f=new e.Vector4,m=new e.Vector2,c=new e.Matrix3,h=new e.Vector3,d=n.up??[0,0,1],p=!n.merged&&!n.feature&&!t.isInstancedMesh;p&&!s.boundingBox&&zt(s)&&s.computeBoundingBox?.();for(let y of o){let b=ko(e,y,{merged:n.merged,feature:n.feature,accent:n.accent??Kt(n.style)});b.uniforms.hlCentre.value.set(a[0],a[1],a[2]),b.uniforms.hlHasNormal.value=l;let g=t.isInstancedMesh?new e.InstancedMesh(s,b,t.count):new e.Mesh(s,b);t.isInstancedMesh&&(g.instanceMatrix=t.instanceMatrix),g.name=`${t.name||"mesh"}/highlight-${y}`,g.frustumCulled=!1,g.castShadow=g.receiveShadow=!1,g.renderOrder=(t.renderOrder??0)+1,g.raycast=()=>{},y==="roof"&&Object.defineProperty(g,"visible",{get:()=>t.visible&&Wt()>.001,set:()=>{},configurable:!0}),g.onBeforeRender=(x,F,A)=>{t.isInstancedMesh&&(g.count=t.count),y!=="roof"&&(g.visible=t.visible);let v=b.uniforms;if(y==="roof"){c.setFromMatrix4(g.matrixWorld),h.setFromMatrixColumn(g.matrixWorld,0);let _=h.length()<.001?[0,0,1]:d;v.hlUp.value.set(_[0],_[1],_[2]).applyMatrix3(c.invert()).normalize(),v.hlWash.value=io*Wt()}x.getDrawingBufferSize(m),v.hlViewport.value.copy(m);let Ae=x.domElement?.clientWidth||m.x,H=Mo();v.hlWidthPx.value=(H??X)*(m.x/Ae),v.hlFarScale.value=H==null?We/X:1,i.multiplyMatrices(A.projectionMatrix,A.matrixWorldInverse).multiply(g.matrixWorld),y==="outline"&&p&&So(g,i,x,m),i.invert(),f.set(0,0,1,0).applyMatrix4(i),Math.abs(f.w)>1e-12&&v.hlEye.value.set(f.x/f.w,f.y/f.w,f.z/f.w),v.hlTime.value=performance.now()/1e3,b.uniformsNeedUpdate=!0},t.add(g),u.push(g)}return t.userData??={},t.userData[J]=u,u}var jt=new WeakMap;function Lo(e,t,n,r=Z()){if(!t||n==="plain"||n==="highlight"&&pe[r].keepMaterials)return t;let o=jt.get(t);o||jt.set(t,o=new Map);let s=`${n}|${r}`,a=o.get(s);if(a)return a;if(n==="highlight")a=new e.MeshLambertMaterial({color:16765471,emissive:7033856,side:t.side??e.FrontSide});else if(t.isShaderMaterial&&t.uniforms?.tint?.value?.isVector3)a=t.clone(),a.uniforms={...t.uniforms,tint:{value:To(t.uniforms.tint.value.clone())}};else if(t.isShaderMaterial&&t.uniforms?.hlDimAll)a=t.clone(),a.uniforms={...t.uniforms,hlDimAll:{value:1}};else if(t.isShaderMaterial)a=t.clone(),a.uniforms=t.uniforms,a.defines={...t.defines??{},HL_DIM_ALL:""};else{if(a=t.clone(),a.color){let l=a.color,u=.2126*l.r+.7152*l.g+.0722*l.b;l.setRGB(l.r+(u-l.r)*N,l.g+(u-l.g)*N,l.b+(u-l.b)*N)}if(a.map){let l=a.onBeforeCompile;a.onBeforeCompile=(u,i)=>{l?.call(a,u,i),u.fragmentShader=u.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${N.toFixed(2)});`)},a.customProgramCacheKey=()=>`${t.customProgramCacheKey?.()??""}|hl-dim`}}return a.name=`${t.name||"material"}/${n}`,a.userData={...t.userData??{},highlightVariantOf:t},o.set(s,a),a}function To(e){let t=.2126*e.x+.7152*e.y+.0722*e.z;return e.set(e.x+(t-e.x)*N,e.y+(t-e.y)*N,e.z+(t-e.z)*N)}var Fo=e=>e?.userData?.highlightVariantOf??e;function Zt(e,t,n,r={}){let o=r.style??Z(),s=[];t.traverse(a=>{a.isMesh&&a.material&&!a.material.userData?.[J]&&s.push(a)});for(let a of s){let l=u=>u?.userData?.[J]?u:u?.userData?.cityLook&&r.cityVariant?r.cityVariant(u,n):Lo(e,Fo(u),n,o);a.material=Array.isArray(a.material)?a.material.map(l):l(a.material),n==="highlight"?ze(e,a,{style:o,up:r.up}):ge(a)}}var re=(e,t)=>`(${e}.g + 1.0 - ${t}.a)`;function Co(){let e=globalThis;return(e.__canalRecallMaskFormat??new URLSearchParams(e.location?.search??"").get("maskFormat"))==="rg"?"rg":"r8"}function Qt(e,t,n=Co()){let r=t.length>>1;if(e.length!==r*4)throw new Error(`packMask: ${e.length} colour bytes for ${r} mask texels`);if(n==="rg"){for(let s=0;s<r;s++)e[s*4+3]=255;return{colour:e,mask:t,channels:2}}let o=new Uint8Array(r);for(let s=0;s<r;s++)o[s]=t[s*2],e[s*4+3]=255-t[s*2+1];return{colour:e,mask:o,channels:1}}function en(){let e=globalThis,t=typeof URLSearchParams=="function"?new URLSearchParams(e.location?.search??"").get("fadeStrength"):null,n=e.__canalRecallFadeStrength??t,r=n==null||n===""?NaN:Number(n);return Number.isFinite(r)?Math.max(0,Math.min(2,r)):1}var V=e=>Number.isInteger(e)?`${e}.0`:`${e}`;var Eo=(e=en())=>`#ifdef USE_FOG
	float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	float fadeLuma = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( fadeLuma ), fogFactor * ${V(.5*e)} );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * ${V(.38*e)} );
#endif`,zl=Eo(1),tn=`uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif`,jl=`#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
	${tn}
#endif`,nn=`
#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
#define DEPTH_FADE_FOG_PARS
	${tn}
#endif
`,rn=(e,t=en())=>`${V(Math.min(1,t))} * smoothstep(max(${V(250)}, fogNear), max(max(${V(600)}, fogNear + (fogFar - fogNear) * ${V(.4)}), max(${V(250)}, fogNear) + 1.0), ${e})`;var Oo=70,Do=190,Po=.5,on=15,an=40;var je="12.0";var sn=[-1,-1];var ln=[-1,-1],un=()=>[Oo,Do,Po],ye=e=>Number.isInteger(e)?e.toFixed(1):String(e),cn=`
uniform vec2 roofLayers;
uniform vec3 roofTier;
vec3 roofTierColour(vec3 fine, vec2 uv, float layer, float dist) {
  if (roofLayers.x < 0.0 || layer < roofLayers.x - 0.5 || layer > roofLayers.y - 0.5) return fine;
  float mid = smoothstep(roofTier.x - ${ye(on)}, roofTier.x + ${ye(on)}, dist);
  if (mid <= 0.0) return fine;
  float far = smoothstep(roofTier.y - ${ye(an)}, roofTier.y + ${ye(an)}, dist);
  vec3 coarse = texture(cells, vec3(uv * roofTier.z, layer)).rgb;
  vec3 flatMean = textureLod(cells, vec3(uv, layer), ${je}).rgb;
  return mix(mix(fine, coarse, mid), flatMean, far);
}`,mn=`${nn}
uniform vec2 cellTier;
#ifdef CELL_TIER_PROBE
// What the last cellTierSample saw (look/windowSdf.ts reads them: the ?cellDebug=rho view, the analytic windows' fade).
float cellRho = 0.0; float cellFarTier = 0.0; float cellFar = 0.0;
#endif
void cellTierSample(vec3 p, float dist, out vec3 c, out vec2 m) {
  vec4 cc = texture(cells, p); vec2 mm = texture(masks, p).rg;
  c = cc.rgb; m = vec2(mm.r, ${re("mm","cc")});
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
  far = max(far, ${rn("dist")});
#endif
#ifdef CELL_TIER_PROBE
  cellFar = far;
#endif
  if (far <= 0.0) return;
  vec4 fc = textureLod(cells, p, ${je}); vec2 fm = textureLod(masks, p, ${je}).rg;
  c = mix(c, fc.rgb, far); m = mix(m, vec2(fm.r, ${re("fm","fc")}), far);
}`;var Io=.5,Me={sunAzimuthDeg:215,sunElevationDeg:40,sunColour:"#ffe9cc",sunIntensity:2.15,skyColour:"#e3ebf6",groundColour:"#998a72",skyIntensity:1.75,shadows:!0,shadowMapSize:2048,shadowIntensity:1-Io};var nu={...Me,...kt};function Bo(e,t){let n=e*Math.PI/180,r=t*Math.PI/180;return[Math.sin(n)*Math.cos(r),Math.cos(n)*Math.cos(r),Math.sin(r)]}var ru=Bo(Me.sunAzimuthDeg,Me.sunElevationDeg),we=(()=>{let e=Me.sunAzimuthDeg*Math.PI/180;return[Math.sin(e),Math.cos(e)]})(),xe=[we[0]*.6,we[1]*.6,.8],fn=.84;function No(e){let t=e[0]*xe[0]+e[1]*xe[1]+e[2]*xe[2];return Math.max(.5,Math.min(1,.58+.42*Math.max(0,t)))}var ou=No([0,0,1]),oe=e=>Number.isInteger(e)?e.toFixed(1):String(+e.toFixed(6)),hn=`
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = ${oe(fn)} + ${oe(1-fn)} * (0.5 + 0.5 * dot(h, vec2(${oe(we[0])}, ${oe(we[1])}))); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, dot(n, vec3(${xe.map(oe).join(", ")}))), 0.5, 1.0);`;var dn=[.4,2.5],Ho=["brick","accent","stucco"];function Go(e){let t=(e?.white?Be(e.white):1.106)*(e?.stripOverDrawn??1);return Math.max(dn[0],Math.min(dn[1],t))}var Uo=["brick","accent"];function pn(e,t,n,r,o=B()){return o!=="sunny"||r==="measured"?t:n?Ho.includes(e)?K(t,Go(n)):t:Uo.includes(e)?K(t,1.106):t}var C=[{name:"magnified (rho < 1)",rgb:[255,0,0]},{name:"rho 1-2",rgb:[255,255,0]},{name:"rho 2-4",rgb:[0,255,0]},{name:"rho 4-8",rgb:[0,255,255]},{name:"rho 8-16",rgb:[0,0,255]},{name:"rho 16-tier",rgb:[255,128,0]},{name:"tier far > 0",rgb:[255,0,255]},{name:"depth-fade far > 0 (tier 0)",rgb:[255,255,255]},{name:"roof layer",rgb:[128,128,128]}],fu=C.length-1,Wo=3;var $o=520,Vo=$o.toFixed(1),zo=String(Wo),E=e=>`vec3(${e.map(t=>(t/255).toFixed(4)).join(", ")})`,gn=`
#ifdef CELL_DEBUG_RHO
vec3 cellDebugColour(float layer) {
  if (roofLayers.x >= 0.0 && layer > roofLayers.x - 0.5 && layer < roofLayers.y - 0.5) return ${E(C[8].rgb)};
  if (cellFarTier > 0.001) return ${E(C[6].rgb)};
  if (cellFar > 0.001) return ${E(C[7].rgb)};
  if (cellRho < 1.0) return ${E(C[0].rgb)};
  if (cellRho < 2.0) return ${E(C[1].rgb)};
  if (cellRho < 4.0) return ${E(C[2].rgb)};
  if (cellRho < 8.0) return ${E(C[3].rgb)};
  if (cellRho < 16.0) return ${E(C[4].rgb)};
  return ${E(C[5].rgb)};
}
#endif`;var jo=1.25,bn=[2.5,5],Re=["#6f8796","#2f4350","#1d2a33"],Se=e=>E([parseInt(e.slice(1,3),16),parseInt(e.slice(3,5),16),parseInt(e.slice(5,7),16)]),yn=`
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
  vec2 cell = vec2(${Vo}, head.y);
  vec2 p = fract(uv) * cell;
  // The footprint from the continuous uv (fract jumps at the cell seam).
  vec2 fw = max(fwidth(uv * cell), vec2(1e-3)) * ${jo.toFixed(2)};
  for (int i = 0; i < ${zo}; i++) {
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
    float wk = weight * smoothstep(${bn[0].toFixed(1)}, ${bn[1].toFixed(1)}, sizePx);
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
    vec3 gc = g < 0.55 ? mix(${Se(Re[0])}, ${Se(Re[1])}, g / 0.55) : mix(${Se(Re[1])}, ${Se(Re[2])}, (g - 0.55) / 0.45);
    float lum = (gc.r + gc.g + gc.b) / 3.0;
    if (lum < ${(90/255).toFixed(5)}) gc += (vec3(${(150/255).toFixed(5)}) - gc) * lift * (1.0 - lum / ${(90/255).toFixed(5)});
    c = mix(c, frame.rgb, outer * wk); m = mix(m, vec2(0.0, frame.a), outer * wk);
    c = mix(c, gc, glass * wk); m = mix(m, vec2(0.0), glass * wk);
  }
}
#endif`;var qo={legacy:.9,sunny:1},Yo=(e=B())=>qo[e],D=Yo(),ae=255/225,Ko=255/228,Xo=255/243,Jo=255/246,ve=[{cell:"brick",tileM:T.brick,clampUv:!1,litGain:ae*D,skyTint:!1},{cell:"stucco",tileM:T.stucco,clampUv:!1,litGain:Xo*D,skyTint:!1},{cell:"stone",tileM:T.stone,clampUv:!1,litGain:Ko*D,skyTint:!1},{cell:"white",tileM:1,clampUv:!1,litGain:1,skyTint:!1},{cell:"door",tileM:T.door,clampUv:!1,litGain:1,skyTint:!1},{cell:"glass",tileM:T.glass,clampUv:!0,litGain:1,skyTint:!0},{cell:"tile",tileM:T.roofTile,clampUv:!1,litGain:ae*D,skyTint:!1},{cell:"slate",tileM:T.slate,clampUv:!1,litGain:ae*D,skyTint:!1},{cell:"flat",tileM:T.bitumen,clampUv:!1,litGain:ae*D,skyTint:!1},{cell:"brick20",tileM:T.brick,clampUv:!1,litGain:ae*D,skyTint:!1},{cell:"whiteStucco",tileM:T.stucco,clampUv:!1,litGain:Jo*D,skyTint:!1},{cell:"glassTint",tileM:T.glass,clampUv:!0,litGain:1,skyTint:!0}],_e=ve.length,se=Object.fromEntries(ve.map((e,t)=>[e.cell,t])),Zo=Ce.school;function Ke(e,t={}){let n=st[e],r=t.source==="measured";return n==="glass"&&r?se.glassTint:n==="brick"&&!r&&typeof t.year=="number"&&t.year>=Zo?se.brick20:n==="stucco"&&t.white?se.whiteStucco:n==="frame"?se.white:se[n]}function Qo(){return ve.map(e=>[1/e.tileM,e.clampUv?1:0,e.litGain,e.skyTint?1:0])}var ea=.38,ta=.8,na=.27,ra=.97,oa=.75,aa=.5,sa=.12,ia=(e,t)=>(e<45||e>340)&&t>=.2;function la(e,t,n,r=B(),o){if(ut(e,n))return me(e,At(e,t,n,r,o),n);let s=M(t),[a,l,u]=S(s);return e==="slate"&&ia(a,l)?me("roofTile",t):(e==="brick"||e==="accent")&&l<sa?w(k([a,l,Math.min(I[1],Math.max(I[0],.12+u*.9))])):e==="slate"&&u>ea?w(k([a,Math.min(l,.12),Math.min(.72,u/ta)])):e==="slate"?u<na?O.slate[1]:O.slate[0]:e==="frame"&&u>=.5&&u<oa?w(s):e==="stone"&&u<aa?w(s):me(e,t)}function Sn(e,t,n,r=B(),o,s){let a=la(e,t,n,r,o),[l,u,i]=M(pn(e,a,s??null,n,r));return[l,u,i,255]}function ua(e,t,n){switch(t){case"brick":return Et(e,n);case"brick20":return Nt(e,n);case"stucco":return It(e);case"whiteStucco":return Ht(e);case"stone":return Bt(e);case"white":case"frame":return Gt(e);case"door":return Pt(e);case"glass":return Ot(e);case"glassTint":return Dt(e);case"tile":return de(e,"tile");case"slate":return de(e,"slate");case"flat":return de(e,"flat")}}function ca(e,t,n){let r=n*n,o=new Uint8Array(r*4*_e),s=new Uint8Array(r*2*_e),a=e.createElement("canvas");a.width=a.height=n;let l=a.getContext("2d",{willReadFrequently:!0});return l.imageSmoothingQuality="high",ve.forEach((u,i)=>{l.clearRect(0,0,n,n),l.drawImage(ua(e,u.cell,t),0,0,n,n);let f=l.getImageData(0,0,n,n).data;for(let m=0;m<n;m++)for(let c=0;c<n;c++){let h=((n-1-m)*n+c)*4,d=i*r+m*n+c;o[d*4]=f[h],o[d*4+1]=f[h+1],o[d*4+2]=f[h+2],o[d*4+3]=255,s[d*2]=255,s[d*2+1]=0}}),{colour:o,mask:s}}async function ma(e=document){let t=new Image;t.src=new URL("materials/ambientcg/Bricks057/colour.jpg",e.baseURI).href;try{return await t.decode(),t}catch{return null}}var Xe=e=>`${e.lit?"lit":"unlit"}|${e.kind}|${e.kind==="slot"?e.uv??"uv":"-"}|${e.highlight?"hl":e.dim?"dim":"-"}|${e.side??0}${e.noFade?"|nofade":""}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf1":""}`;function fa(e){let t={CITY_SLOT_COUNT:String(_e)};return e.kind==="slot"&&(t.CITY_SLOT=""),e.swap&&(t.CITY_SWAP=""),e.cellDebug==="rho"&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CELL_DEBUG_RHO=""),e.windows&&e.kind==="chunk"&&(t.CELL_TIER_PROBE="",t.CITY_WINDOW_SDF=""),e.lit?(t.CITY_VARIANT_UNIFORMS="",{...t,...$e()}):(e.kind==="slot"&&e.uv==="box"&&(t.CITY_BOX_UV=""),e.highlight?t.CITY_HIGHLIGHT="":e.dim&&(t.CITY_DIM=""),{...t,...$e()})}function ha(e){return{cityForce:{value:e.highlight?1:e.dim?2:0},cityBoxUv:{value:e.kind==="slot"&&e.uv==="box"?1:0}}}var da=e=>e.lit?`city-look-v4|lit|${e.kind}${e.swap?"|swap":""}${e.cellDebug?`|dbg-${e.cellDebug}`:""}${e.windows?"|wsdf1":""}`:`city-look-v3|${Xe({...e,side:0})}`,pa="vec3(1.0, 0.824, 0.122)",xn="vec3(1.0, 0.637, 0.0137)",Mn="vec3(0.035, 0.05, 0.07)",ba=1,ga=.2,ya=.75,xa=1.8,Q=e=>Number.isInteger(e)?e.toFixed(1):String(e),Ma=`
float cityGrain(vec3 cell) {
  float g = clamp(dot(cell, vec3(0.299, 0.587, 0.114)) / ${Q(225/255)}, 0.45, 1.1);
  return mix(1.0, g, ${Q(ya)});
}`,_n=16,wa=`
#ifdef CITY_SWAP
attribute float swapSlot;
uniform vec4 citySwapUnder[${_n/4}];
uniform float cityUnder;
flat varying float vCityUnder;
#endif`,Ra=`
#ifdef CITY_SWAP
int citySw = int(swapSlot + 0.5) - 1;
vCityUnder = citySw >= 0 ? citySwapUnder[citySw / 4][citySw % 4] : cityUnder;
#endif`,vn=`
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
${wa}
${Ve}`,kn=`
${Ra}
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
#endif`,An=`
vFacDist = length((modelViewMatrix * vec4(position, 1.0)).xyz);
if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`,Ln=`
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
${cn}
${mn}
${gn}
${yn}
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
${Ma}
${Ve}`,Tn=`
if (HL_GHOST(vHighlight)) discard;
#ifdef CITY_SWAP
float cityHash = fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296)));
if (cityFade < 1.0 && cityHash >= cityFade) discard;
// The complement of a replacement dissolving in over (or out from) this mesh: where it draws, this one does not.
if (cityHash < vCityUnder) discard;
#else
if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;
#endif`,Fn=`
vec2 cityUv = vSlot.y > 0.5 ? clamp(vFacUv, 0.0, 1.0) : vFacUv;
vec3 cityP = vec3(cityUv, vLayer);
vec3 cityC; vec2 cityM;
#ifdef CITY_SLOT
vec4 cityCC = texture(cells, cityP); vec2 cityMM = texture(masks, cityP).rg;
cityC = cityCC.rgb; cityM = vec2(cityMM.r, ${re("cityMM","cityCC")});
#else
cellTierSample(cityP, vFacDist, cityC, cityM);
#ifdef CITY_WINDOW_SDF
windowSdf(cityUv, vLayer, 1.0 - cellFar, cityC, cityM);
#endif
cityC = roofTierColour(cityC, cityUv, vLayer, vFacDist);
#endif
float cityG = cityGrain(cityC);
cityC *= mix(vec3(1.0), vTint, cityM.r) * mix(vec3(1.0), vAccent, cityM.g);`,Sa=`
uniform mat3 enuFromWorld;
${vn}
varying float vShade;
void main() {
${kn}
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
${hn}
  vShade = shade;
#else
  vShade = tint.a;
#endif
${An}
}`,_a=`
precision highp float;
${Ln}
varying float vShade;
void main() {
${Tn}
${Fn}
  if (HL_PAINT(vHighlight)) {
    float hlShade = clamp(1.0 - (1.0 - vShade) * ${Q(xa)}, 0.6, 1.0);
    gl_FragColor = vec4(${pa} * (flatColour > 0.5 ? 1.0 : cityG) * hlShade, 1.0);
    return;
  }
  if (flatColour > 0.5) cityC = vTint;
  cityC = hlDesat(cityC, vHighlight);
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  gl_FragColor = vec4(cityC * shade, 1.0);
#ifdef CELL_DEBUG_RHO
  gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif
}`;function va(e,t={}){return{cells:t.cells??{value:null},masks:t.masks??{value:null},slotBase:t.slotBase??{value:0},slotParams:t.slotParams??{value:Qo().map(n=>new e.Vector4(...n))},bands:t.bands??{value:0},flatColour:t.flatColour??{value:0},cityFade:t.cityFade??{value:1},wallGain:t.wallGain??{value:1},roofLayers:t.roofLayers??{value:ln},roofTier:t.roofTier??{value:un()},cellTier:t.cellTier??{value:sn},enuFromWorld:t.enuFromWorld??{value:new e.Matrix3},citySwapUnder:t.citySwapUnder??{value:new Float32Array(_n)},cityUnder:t.cityUnder??{value:0},windowTable:t.windowTable??{value:null},windowSdfMix:t.windowSdfMix??{value:1}}}var ka={accent:[1,1,1,1],hidden:[0],color:[1,1,1],uv:[0,0],uv1:[0,0],swapSlot:[0]},qe="recipeLookShared";function Aa(e,t,n){let r=fa(t),o=t.side??e.FrontSide,s;if(!t.lit)s=new e.ShaderMaterial({uniforms:n,defines:r,vertexShader:Sa,fragmentShader:_a,side:o});else{s=new e.MeshLambertMaterial({side:o,flatShading:t.kind==="chunk"}),s.defines={...s.defines??{},...r};let a=ha(t);s.onBeforeCompile=u=>{for(let i of Object.keys(n))u.uniforms[i]=n[i];Object.assign(u.uniforms,a),u.vertexShader=u.vertexShader.replace("#include <common>",`#include <common>${vn}`).replace("#include <begin_vertex>",`#include <begin_vertex>${kn}`).replace("#include <project_vertex>",`#include <project_vertex>${An}`),u.fragmentShader=u.fragmentShader.replace("#include <common>",`#include <common>${Ln}
float cityLuma;`).replace("#include <dithering_fragment>",`#include <dithering_fragment>
#ifdef CELL_DEBUG_RHO
gl_FragColor = vec4(cellDebugColour(vLayer), 1.0);
#endif`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>${Tn}`).replace("#include <map_fragment>",`${Fn}
#ifdef CITY_SLOT
cityC *= vSlot.z;
#else
cityC *= mix(1.0, wallGain * ${Q(D)}, cityM.r);
#endif
if (flatColour > 0.5) cityC = vTint;
cityLuma = dot(cityC, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= HL_PAINT(vHighlight) ? ${xn} * ${Q(ba)} * pow(flatColour > 0.5 ? 1.0 : cityG, 2.2) : pow(hlDesat(cityC, vHighlight), vec3(2.2));`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
if (HL_PAINT(vHighlight)) totalEmissiveRadiance += ${xn} * ${Q(ga)};
#ifdef CITY_SLOT
else totalEmissiveRadiance += ${Mn} * vSlot.w;
#else
// Bay glazing (dark, untinted texels): the same constant sky tint as landmark glass, never a hotspot.
else totalEmissiveRadiance += ${Mn} * (1.0 - smoothstep(0.06, 0.2, cityLuma)) * (1.0 - cityM.r);
#endif`)};let l=da(t);s.customProgramCacheKey=()=>l,s.uniforms=n}return s.defaultAttributeValues={...ka},t.noFade&&(s.fog=!1),s.name=`city-look/${Xe(t)}`,s.userData={cityLook:!0,cityVariant:{...t},[qe]:!0},s}function La(e){return e?e.isMeshBasicMaterial||e.userData?.unlit?"unlit (decal / emissive sign)":e.transparent||(e.opacity??1)<1?"transparent":e.vertexColors?"vertex colours":e.map?"own texture":null:"no material"}function Ta(e,t){let n=e?.userData??{};if(yt(n.materialSlot)&&typeof n.tint=="string"){let s=n.tintSource==="measured";return{slot:n.materialSlot,tint:n.tint,inferred:n.materialSlotSource===dt,...s?{source:"measured"}:{},...s&&typeof n.tintWhitePoint=="string"?{white:n.tintWhitePoint}:{}}}if(!t||La(e)||!e.color)return null;let r="#"+e.color.getHexString(),o=bt(e.name,r);return{slot:o.slot,tint:o.tint,inferred:!0}}function wn(e,t,n,r,o={}){let s=t.getAttribute("position")?.count??0,a=Ke(n,o),l=Sn(n,r,o.source,void 0,o.whitePoint,o.exposure),u=t.getAttribute("layer"),i=t.getAttribute("tint");if(u&&i)return u.getX(0)===a&&Math.round(i.getX(0)*255)===l[0]&&Math.round(i.getY(0)*255)===l[1]&&Math.round(i.getZ(0)*255)===l[2];t.setAttribute("layer",new e.BufferAttribute(new Uint8Array(s).fill(a),1,!1));let f=new Uint8Array(s*4);for(let m=0;m<s;m++)f.set(l,m*4);return t.setAttribute("tint",new e.BufferAttribute(f,4,!0)),!0}function Fa(e,t,n,r,o,s={}){let a=r.getAttribute("normal"),l=r.getAttribute("layer"),u=r.getAttribute("tint");if(!a||!l||!u)return 0;let[i,f,m]=Sn("bitumen",o,s.source);t.updateWorldMatrix(!0,!0);let c=new e.Matrix4().copy(t.matrixWorld).invert().multiply(n.matrixWorld),h=new e.Matrix3().getNormalMatrix(c),d=new e.Vector3,p=Ke("bitumen",s),y=0;for(let b=0;b<a.count;b++)d.set(a.getX(b),a.getY(b),a.getZ(b)).applyMatrix3(h).normalize(),!(d.y<ra)&&(l.setX(b,p),u.setXYZW(b,i/255,f/255,m/255,1),y++);return y&&(l.needsUpdate=!0,u.needsUpdate=!0),y}var Ca="__canalRecallCityLookShared";function Cn(e,t={}){let n=globalThis,r=n[Ca]??=new Map,o=r.get(e);return o||r.set(e,o=Ea(e,t)),o}function Ea(e,t={}){let n=t.document??globalThis.document,r=t.size??(globalThis.matchMedia?.("(pointer: coarse)").matches?128:256),o=va(e),s=new Map,a=null,l=!1,u=(m,c)=>{let h=new e.DataArrayTexture(m,r,r,_e);return h.format=c,h.type=e.UnsignedByteType,h.wrapS=h.wrapT=e.RepeatWrapping,h.minFilter=e.LinearMipmapLinearFilter,h.magFilter=e.LinearFilter,h.generateMipmaps=!0,h.anisotropy=t.anisotropy??ue("slotCells",16).anisotropy,h.unpackAlignment=1,h.needsUpdate=!0,h.userData={bytes:m.byteLength,[qe]:!0},h},i=(async()=>{if(!n)return;let m=t.brick!==void 0?t.brick:await ma(n),{colour:c,mask:h}=ca(n,m,r),d=Qt(c,h);a={colour:u(d.colour,e.RGBAFormat),mask:u(d.mask,d.channels===1?e.RedFormat:e.RGFormat)},l||(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)})(),f=m=>{let c=Xe(m),h=s.get(c);return h||s.set(c,h=Aa(e,m,o)),h};return{uniforms:o,ready:i,material:f,dress(m,{lit:c,infer:h=!1,year:d=null,wallExposure:p=null}){let y=0;return m.traverse(b=>{if(!b.isMesh||Array.isArray(b.material)||b.material?.userData?.cityLook)return;let g=Ta(b.material,h);if(!g)return;let x=b.geometry;if(!x?.getAttribute("position"))return;let F=!!x.getAttribute("uv");!F&&!x.getAttribute("normal")&&x.computeVertexNormals();let A={year:d,white:g.inferred&&gt(b.material.name),source:g.source,...g.white?{whitePoint:g.white}:{},...p?{exposure:p}:{}};wn(e,x,g.slot,g.tint,A)||(x=b.geometry=x.clone(),x.deleteAttribute("layer"),x.deleteAttribute("tint"),wn(e,x,g.slot,g.tint,A)),g.inferred&&g.slot==="slate"&&!g.source&&Fa(e,m,b,x,g.tint,A);let v=b.material;b.material=f({lit:c,kind:"slot",uv:F?"uv":"box",side:v.side}),b.userData.citySlot={slot:g.slot,tint:g.tint,...g.source?{source:g.source}:{},inferred:g.inferred,from:v.name,layer:Ke(g.slot,A)},v.userData?.[qe]||v.dispose(),y++}),y},highlighted(m,c){let h=m?.userData?.cityVariant;return h?f({...h,highlight:c,dim:!1}):m},dimmed(m,c){let h=m?.userData?.cityVariant;return h?f({...h,highlight:!1,dim:c}):m},bindAtlas(m){l=!!m,m?(o.cells.value=m.colour,o.masks.value=m.mask,o.slotBase.value=m.slotBase):a&&(o.cells.value=a.colour,o.masks.value=a.mask,o.slotBase.value=0)},textureBytes(){return a&&!l?Math.round((a.colour.userData.bytes+a.mask.userData.bytes)*4/3):0}}}var Pa="NL.IMBAG.Pand.";var ke=e=>/^\d{16}$/.test(e)?`${Pa}${e}`:e;var Ia=2*Math.PI*6378137;function Ba(e,t){return[(180+e)/360,(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+t*Math.PI/360)))/360]}function Na(e,t){let n=e*360-180,r=180-t*360;return[n,360/Math.PI*Math.atan(Math.exp(r*Math.PI/180))-90]}var Ha=e=>1/Ia/Math.cos(e*Math.PI/180),On=e=>`${e.z}/${e.x}/${e.y}`;var Ga=e=>[(e.x+.5)/2**e.z,(e.y+.5)/2**e.z];function Dn(e){let t=Ga(e),n=Na(t[0],t[1]);return{tile:e,centre:t,anchor:n,units:Ha(n[1])}}function Pn(e){let t=e.units;return[t,0,0,0,0,0,t,0,0,t,0,0,e.centre[0],e.centre[1],0,1]}function In(e,t,n=16,r,o=.25){let[s,a]=Ba(e,t),l=2**n,u=s*l,i=a*l,f=Math.round(u)-1,m=Math.round(i)-1;return r&&Math.abs(u-(r.x+1))<=.5+o&&Math.abs(i-(r.y+1))<=.5+o&&({x:f,y:m}=r),{x:f,y:m,tiles:[[0,0],[1,0],[0,1],[1,1]].map(([c,h])=>({z:n,x:f+c,y:m+h}))}}var Ua="recipeTiles";function Gn(e){try{let t=globalThis;return e===void 0&&t.__canalRecallRecipeTiles===!0?!0:new URLSearchParams(e??t.location?.search??"").get(Ua)==="1"}catch{return!1}}function Je(e,t,n){let r=In(t.lng,t.lat,16,n);return{block:{x:r.x,y:r.y},tiles:r.tiles.map(On).filter(o=>!!e.tiles[o])}}var ie=class{constructor(t,n){this.load=t;this.free=n}items=new Map;acquire(t){let n=this.items.get(t);if(!n){let r={refs:0,promise:null};r.promise=this.load(t).then(o=>r.value=o),this.items.set(t,n=r),n.promise.catch(()=>this.items.delete(t))}return n.refs++,n.promise}release(t){let n=this.items.get(t);n&&(--n.refs>0||(this.items.delete(t),n.value!==void 0?this.free(n.value,t):n.promise.then(r=>this.free(r,t),()=>{})))}get size(){return this.items.size}refs(t){return this.items.get(t)?.refs??0}};function Ze(e,t){if(!e||t===void 0)return-1;for(let[n,r,o]of e)if(t>=r&&t<r+o)return n;return-1}function Wa(e,t){let n=new Map;for(let[r,o,s]of t){let a=new Set;for(let l=o*3;l<(o+s)*3;l++)a.add(e[l]);n.set(r,Uint32Array.from([...a].sort((l,u)=>l-u)))}return n}function Qe(e){let t=new Set;for(let n of e)for(let r of n.covers)for(let o of r)t.add(o);return[...t].sort()}var qu=be.hide,Bn=be.highlight,$a=be.dim,le=class{constructor(t){this.host=t;let n=t.THREE;this.root=new n.Group,this.root.name="recipe-tiles",this.units=new ie(r=>this.loadUnit(r),r=>{for(let o of r)o.geometry.dispose()})}root;index=null;tiles=new Map;block=null;units;unregister=null;clipFromWorld=null;highlighted=new Set;focus=null;recipe=Yt();lastHidden="";pendingHidden=!1;lastCheck=0;revisionN=0;loading=0;errors=[];async start(t=21){let n=await fetch(new URL("index.json",this.host.baseUrl).href,{cache:"no-cache"});if(!n.ok)throw Error(`recipe tiles index ${n.status}`);return this.index=await n.json(),this.unregister=this.host.frame.register("recipe-tiles",{root:this.root,beforeRender:r=>(this.clipFromWorld=r.clipFromWorld,this.update(),this.root.children.length>0),revision:()=>this.revisionN},{order:t}),this.update(!0),!0}update(t=!1){if(!this.index)return;let n=performance.now();if(!t&&n-this.lastCheck<250){this.pendingHidden&&this.syncHidden();return}this.lastCheck=n;let r=this.host.getCentre();if(!r)return;let{block:o,tiles:s}=Je(this.index,r,this.block);this.block=o;let a=new Set(s);for(let u of a)this.tiles.has(u)||this.loadTile(u);if([...a].every(u=>this.tiles.get(u)?.ready))for(let[u,i]of this.tiles)a.has(u)||this.dropTile(i);this.pendingHidden&&this.syncHidden()}async loadTile(t){let n=this.host.THREE,r={id:t,meta:null,group:new n.Group,ready:!1,disposed:!1,merged:[],instanced:[],triangles:0};this.tiles.set(t,r),this.loading++;try{let o=await this.host.loadGltf(new URL(`building-mesh/${t}.glb`,this.host.baseUrl).href);if(r.disposed)return;if(r.meta=o.userData?.recipeTile,!r.meta)throw Error(`${t}: no recipeTile extras`);let[s,a,l]=r.meta.tile,u=Dn({z:s,x:a,y:l});r.group.name=`recipe-tile/${t}`,r.group.matrixAutoUpdate=!1,r.group.matrix.fromArray(Pn(u)),o.scene.updateMatrixWorld(!0);let i=this.host.cityLook,f=this.host.lit!==!1,m=[];o.scene.traverse(c=>{c.isMesh&&m.push(c)});for(let c of m){if(c.isInstancedMesh){let g=c.geometry.getAttribute("_PAND"),x=c.count,F=new Int32Array(x),A=new Float32Array(x*16);for(let _=0;_<x;_++)F[_]=Math.round(g.getX(_));let v=new n.Matrix4,Ae=c.matrixWorld;for(let _=0;_<x;_++)c.getMatrixAt(_,v),v.premultiply(Ae),v.toArray(A,_*16);let H=new n.InstancedMesh(c.geometry,c.material,x);for(let _=0;_<x;_++)H.setMatrixAt(_,v.fromArray(A,_*16));H.name=`stub/${c.userData.unit}`,r.group.add(H),r.instanced.push({unit:c.userData.unit,matrices:A,pands:F,meshes:[],stub:H});continue}let h=c.geometry;this.cityAttributes(h);let d=h.userData?.pandRanges??[];h.setAttribute("hidden",new n.BufferAttribute(new Uint8Array(h.getAttribute("position").count),1,!1));let p=c.material?.side??n.FrontSide,y=c.material?.userData?.cityLook?.uv??"uv",b=new n.Mesh(h,i.material({lit:f,kind:"slot",uv:y,side:p}));b.name=`recipe-tile/${t}/uniques`,b.matrixAutoUpdate=!1,b.matrix.copy(c.matrixWorld),b.userData.recipeTile={tile:t,ranges:d},this.host.frame.constructor.setShadows?.(b,!0,!0),r.group.add(b),r.merged.push({mesh:b,ranges:d,verts:Wa(h.index.array,d)}),r.triangles+=h.index.count/3}if(this.root.add(r.group),this.revisionN++,this.host.repaint(),await Promise.all(r.instanced.map(async c=>{let h=await this.units.acquire(c.unit);if(r.disposed){this.units.release(c.unit);return}for(let d of h){let p=new n.InstancedMesh(d.geometry,d.material,c.pands.length),y=new n.Matrix4;for(let b=0;b<c.pands.length;b++)p.setMatrixAt(b,y.fromArray(c.matrices,b*16).multiply(d.local));p.name=`recipe-tile/${t}/unit/${c.unit}`,p.userData.recipeTile={tile:t,pands:c.pands},p.computeBoundingSphere(),p.computeBoundingBox(),this.host.frame.constructor.setShadows?.(p,!0,!0),r.group.add(p),c.meshes.push(p),r.triangles+=d.triangles*c.pands.length}r.group.remove(c.stub),c.stub.dispose?.()})),r.disposed)return;r.ready=!0,this.applyHighlight(r),this.pendingHidden=!0,this.revisionN++,this.host.repaint()}catch(o){this.errors.push(String(o?.message??o)),console.warn(`Recipe tile ${t} unavailable; the mid/far layers keep drawing it.`,o),this.tiles.delete(t),r.group.parent?.remove(r.group)}finally{this.loading--}}cityAttributes(t){for(let[n,r]of[["_layer","layer"],["_tint","tint"],["_LAYER","layer"],["_TINT","tint"]]){let o=t.getAttribute(n);o&&(t.setAttribute(r,o),t.deleteAttribute(n))}}async loadUnit(t){let n=this.host.THREE,r=this.host.cityLook,o=this.host.lit!==!1,s=await this.host.loadGltf(new URL(`units/${t}.glb`,this.host.baseUrl).href);s.scene.updateMatrixWorld(!0);let a=[];return s.scene.traverse(l=>{if(!l.isMesh)return;let u=!!l.material?.userData?.cityLook;u&&this.cityAttributes(l.geometry);let i=u?r.material({lit:o,kind:"slot",uv:l.material.userData.cityLook.uv??"uv",side:l.material.side}):l.material;a.push({geometry:l.geometry,material:i,local:l.matrixWorld.clone(),triangles:(l.geometry.index?.count??l.geometry.getAttribute("position").count)/3,city:u})}),a}dropTile(t){t.disposed=!0,this.tiles.delete(t.id),t.group.parent?.remove(t.group);for(let n of t.merged)n.mesh.geometry.dispose();for(let n of t.instanced){for(let r of n.meshes)r.dispose?.();n.stub?.geometry?.dispose?.(),n.meshes.length&&this.units.release(n.unit)}this.pendingHidden=!0,this.revisionN++}syncHidden(){let t=[...this.tiles.values()].filter(o=>o.ready),n=Qe(t.map(o=>o.meta)),r=n.join(",");if(r!==this.lastHidden){if(this.host.setHidden(n)===!1)return;this.lastHidden=r}this.host.setReplacedSpecs?.(new Set(t.flatMap(o=>o.meta.specs))),this.pendingHidden=!1}setHighlighted(t,n){this.highlighted=new Set([...t].map(r=>ke(String(r)))),this.focus=n&&this.highlighted.size?n:null;for(let r of this.tiles.values())r.ready&&this.applyHighlight(r);this.host.repaint()}applyHighlight(t){let n=this.host.THREE,r=this.host.cityLook,o=this.recipe,s=c=>this.highlighted.has(ke(t.meta.pands[c]))||t.meta.covers[c].some(h=>this.highlighted.has(h)),a=c=>o.desaturate&&Xt(this.focus?.lngLat,c),l=new n.Vector3,u=c=>(l.copy(c).applyMatrix4(t.group.matrix),Nn(l.x,l.y));for(let c of t.merged){let h=c.mesh.geometry.getAttribute("hidden"),d=!1,p=null;(o.desaturate||o.outline||o.rim)&&(c.where??=Va(n,c.mesh,c.verts,u));for(let[y,b]of c.verts){let g=c.where?.get(y),x=s(y)?Bn:g&&this.focus&&a(g.lngLat)?$a:0;if(x===Bn&&g&&(p??=g.local),h.array[b[0]]!==x){for(let F of b)h.array[F]=x;d=!0}}d&&(h.needsUpdate=!0),p&&(o.outline||o.rim)?ze(n,c.mesh,{merged:!0,centre:p}):ge(c.mesh)}let i=new n.Matrix4().makeScale(0,0,0),f=new n.Matrix4,m=new n.Vector3;for(let c of t.instanced)for(let h of c.meshes){for(let p of h.userData.highlights??[])h.parent?.remove(p);h.userData.highlights=[];let d=h.userData.saved??=new Map;for(let p=0;p<c.pands.length;p++){d.has(p)?f.copy(d.get(p)):h.getMatrixAt(p,f);let y=s(c.pands[p])?"highlight":this.focus&&o.desaturate&&a(u(m.setFromMatrixPosition(f)))?"dim":"plain";if(y!=="plain"){let b=h.material?.userData?.cityVariant,g=o.keepMaterials||y==="dim"?h.material:b?r.highlighted(h.material,!0):za(n,h.material),x=new n.Mesh(h.geometry,g);x.matrixAutoUpdate=!1,x.matrix.copy(f),x.name=`recipe-tile/${y}`,o.keepMaterials&&Zt(n,x,y,{cityVariant:(F,A)=>A==="dim"?r.dimmed(F,!0):F}),h.parent.add(x),h.userData.highlights.push(x),d.set(p,f.clone()),h.setMatrixAt(p,i)}else d.has(p)&&(h.setMatrixAt(p,d.get(p)),d.delete(p))}h.instanceMatrix.needsUpdate=!0}}inspectAtScreen(t,n,r,o){let s=this.host.THREE;if(!this.clipFromWorld||!r||!o||!this.root.children.length)return null;let a=t/r*2-1,l=1-n/o*2,u=this.clipFromWorld.clone().invert(),i=new s.Vector3(a,l,-1).applyMatrix4(u),f=new s.Vector3(a,l,1).applyMatrix4(u);this.root.updateWorldMatrix(!0,!0);let m=new s.Raycaster(i,f.sub(i).normalize());for(let c of m.intersectObject(this.root,!0)){let h=c.object.userData?.recipeTile,d=h&&this.tiles.get(h.tile);if(!d?.ready||!c.object.visible)continue;let p=h.ranges?Ze(h.ranges,c.faceIndex):h.pands?.[c.instanceId??-1]??-1;if(p<0)continue;let y=c.point.clone().applyMatrix4(this.clipFromWorld).z;if(y<-1||y>1)continue;let b=d.meta.pands[p],g=c.point.clone().applyMatrix4(this.root.matrixWorld.clone().invert()),x=Nn(g.x,g.y);return{id:/^\d{16}$/.test(b)?ke(b):b,name:d.meta.names[p]??b,depth:y,lngLat:x,recipeTile:d.id}}return null}stats(){let t=0,n=0,r=0;for(let o of this.tiles.values()){n+=o.triangles;for(let s of o.merged)s.mesh.visible&&t++;for(let s of o.instanced)t+=s.meshes.length||1,r+=s.pands.length}return{tiles:[...this.tiles.keys()].sort(),ready:[...this.tiles.values()].filter(o=>o.ready).length,loading:this.loading,units:this.units.size,draws:t,triangles:n,instances:r,hidden:this.lastHidden?this.lastHidden.split(",").length:0,errors:this.errors.slice(-5)}}dispose(){for(let t of[...this.tiles.values()])this.dropTile(t);this.host.setHidden([]),this.host.setReplacedSpecs?.(new Set),this.unregister?.()}};function Va(e,t,n,r){let o=new Map,s=t.geometry.getAttribute("position"),a=new e.Vector3;for(let[l,u]of n){let i=0,f=0,m=0;for(let d of u)i+=s.getX(d),f+=s.getY(d),m+=s.getZ(d);let c=Math.max(1,u.length),h=[i/c,f/c,m/c];o.set(l,{local:h,lngLat:r(a.set(...h).applyMatrix4(t.matrix))})}return o}function Nn(e,t){let n=e*360-180,r=180-t*360;return[n,360/Math.PI*Math.atan(Math.exp(r*Math.PI/180))-90]}var Hn=new WeakMap;function za(e,t){let n=Hn.get(t);return n||(n=new e.MeshLambertMaterial({color:16765471,emissive:7033856,side:t?.side??e.FrontSide}),Hn.set(t,n)),n}function Un(){let e=globalThis;return new URL(e.__canalRecallRecipeTilesBase??"./recipe-tiles/",e.location.href).href}async function ja(e){let t=globalThis.CanalRecallThree,n=t?.THREE,r=e._sharedFrame??e._ensureSharedFrame?.();if(!n||!r)throw Error("recipe tiles need the shared frame (?sharedFrame=1 is implied by ?recipeTiles=1)");let o=new t.GLTFLoader;t.MeshoptDecoder&&o.setMeshoptDecoder(t.MeshoptDecoder);let s=new Set,a=()=>{let i=e._signatureLandmarks;if(!i||i.__recipeTilesWrapped)return;let f=i.canShowModel.bind(i);i.canShowModel=m=>!s.has(m.id)&&f(m),i.__recipeTilesWrapped=!0},l={THREE:n,frame:r,baseUrl:Un(),lit:!0,cityLook:Cn(n,{anisotropy:globalThis.matchMedia?.("(pointer: coarse)").matches?1:ue("slotCells",16).anisotropy}),loadGltf:i=>o.loadAsync(i),getCentre:()=>e.map?.getCenter?.(),setHidden:i=>{let f=e._threeBuildings;return f?.setHidden?(f.setHidden("recipe-tiles",i),e._pyramidalRoofs?.setHiddenReason?.("recipe-tiles",i),!0):!1},setReplacedSpecs:i=>{a(),s=i,e.map?.triggerRepaint?.()},repaint:()=>e.map?.triggerRepaint?.()},u=new le(l);return globalThis.__canalRecallTileBuildings=u,await u.start(),u}return qn(qa);})();

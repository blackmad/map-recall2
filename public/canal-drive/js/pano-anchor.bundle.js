"use strict";var CanalRecallPanoAnchor=(()=>{var V=Object.defineProperty;var we=Object.getOwnPropertyDescriptor;var ye=Object.getOwnPropertyNames;var ve=Object.prototype.hasOwnProperty;var Me=(p,i)=>{for(var f in i)V(p,f,{get:i[f],enumerable:!0})},Te=(p,i,f,c)=>{if(i&&typeof i=="object"||typeof i=="function")for(let M of ye(i))!ve.call(p,M)&&M!==f&&V(p,M,{get:()=>i[M],enumerable:!(c=we(i,M))||c.enumerable});return p};var Le=p=>Te(V({},"__esModule",{value:!0}),p);var Se={};Me(Se,{mountPanoAnchor:()=>ce});var Ee=`
.pa-root{position:fixed;inset:0;display:flex;flex-direction:column;background:#101418;color:#e8ecef;font:14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif}
.pa-bar{display:flex;align-items:center;gap:12px;padding:9px 14px;background:#161c22;border-bottom:1px solid #2a333c;flex-wrap:wrap}
.pa-title{font-weight:700;letter-spacing:.01em}
.pa-progress{color:#9fb0bd}
.pa-spacer{flex:1}
.pa-btn{background:#22303a;color:#e8ecef;border:1px solid #37474f;border-radius:6px;padding:6px 12px;cursor:pointer;font:inherit}
.pa-btn:hover{background:#2c3d49}
.pa-btn:disabled{opacity:.4;cursor:default}
.pa-btn.pa-primary{background:#1d6f4a;border-color:#2a8f61}
.pa-btn.pa-primary:hover{background:#22855a}
.pa-status{font-size:12px;color:#8ea0ad;min-width:120px}
.pa-stage{position:relative;flex:1;min-height:0;overflow:hidden;cursor:grab}
.pa-stage.pa-panning{cursor:grabbing}
.pa-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.pa-loupe{position:absolute;right:14px;bottom:14px;width:190px;height:190px;border:2px solid #d7e2ea;border-radius:8px;background:#000;box-shadow:0 6px 24px rgba(0,0,0,.5)}
.pa-map{position:absolute;right:14px;top:14px;width:190px;height:190px;border:2px solid #d7e2ea;border-radius:8px;background:#0b0f12;box-shadow:0 6px 24px rgba(0,0,0,.5)}
.pa-readout{position:absolute;left:14px;bottom:14px;background:rgba(16,20,24,.9);border:1px solid #2a333c;border-radius:8px;padding:12px 14px;max-width:min(600px,62vw)}
.pa-readout .pa-q{color:#ffd25a;font-weight:600;margin-bottom:4px}
.pa-res{color:#7fd4a0}.pa-res.pa-warn{color:#f0b46b}
.pa-status-line{font-size:12px;color:#8ea0ad}
.pa-help{position:absolute;inset:auto 14px 14px 14px;top:64px;background:#161c22;border:1px solid #2a333c;border-radius:10px;padding:16px 20px;max-width:720px;margin:0 auto;box-shadow:0 12px 40px rgba(0,0,0,.6);overflow:auto;line-height:1.55}
.pa-help h2{margin:0 0 8px;font-size:16px}
.pa-help p{margin:8px 0}
.pa-help kbd{display:inline-block;border:1px solid #37474f;border-radius:4px;padding:0 6px;color:#cfd9e0;font-size:12px;background:#1c242b}
.pa-help ul{margin:8px 0;padding-left:20px}
.pa-help li{margin:5px 0}
.pa-modal{position:fixed;inset:0;background:rgba(6,9,12,.82);display:flex;align-items:center;justify-content:center;z-index:20;padding:20px}
.pa-modal .pa-card{background:#161c22;border:1px solid #2a333c;border-radius:12px;padding:22px 26px;max-width:620px;box-shadow:0 20px 60px rgba(0,0,0,.7)}
.pa-modal h2{margin:0 0 10px;font-size:19px}
.pa-modal p{margin:9px 0;line-height:1.55}
.pa-modal .pa-row{display:flex;gap:12px;justify-content:flex-end;margin-top:16px}
.pa-key{display:inline-block;border:1px solid #37474f;border-radius:4px;padding:0 5px;color:#cfd9e0;font-size:11px;background:#1c242b}
.pa-root [hidden]{display:none !important}
`,Ie=`
  <h2>What am I doing?</h2>
  <p>We are teaching the app where each 360\xB0 street camera is pointing, so we can line
  photographs up with the real buildings. It already knows where every building
  <em>should</em> be; this checks that it is looking at the right spot.</p>
  <p><b>The yellow ring is the app's guess</b> for where a known building corner appears
  in the photo. <b>The green dot is your answer.</b> The <b>map (top-right)</b> shows the
  building from above: the <b>yellow line</b> is the photographed street-facing wall, the
  <b>yellow dot</b> is the wall end this marker wants, and the green dot is the camera.
  You only ever align to a corner on that street-facing wall.</p>
  <ul>
    <li>If the yellow ring is already sitting on the corner, press <kbd>Enter</kbd> (or <b>Accept</b>).</li>
    <li>If it is not, drag the <b>green dot</b> onto the corner \u2014 the vertical edge where
    two walls meet. Arrow keys nudge it; <kbd>Shift</kbd>+arrows move 10\xD7.</li>
    <li>Can't tell (hidden by a car, tree, etc.)? Press <kbd>S</kbd> to skip.</li>
    <li>Mistake? Press <kbd>Ctrl</kbd>+<kbd>Z</kbd> or <b>Undo</b>.</li>
  </ul>
  <p>Use the mouse wheel to zoom, drag the background to look around. The loupe (bottom
  right) is a magnified view of the current marker. The corner does not have to be
  perfect \u2014 a few pixels is fine.</p>
  <p>You have a handful of markers across three streets. The last street is a
  <b>holdout</b>: mark it exactly the same way, we just won't tune on it.</p>`,m=(p,i,f)=>Math.max(i,Math.min(f,p));function ce(p){p.innerHTML=`
    <style>${Ee}</style>
    <div class="pa-root">
      <div class="pa-bar">
        <span class="pa-title">Pano anchors</span>
        <span class="pa-progress" data-progress>loading\u2026</span>
        <span class="pa-spacer"></span>
        <span class="pa-status" data-status></span>
        <button class="pa-btn" data-undo title="Ctrl/Cmd+Z">\u21B6 Undo</button>
        <button class="pa-btn" data-prev>\u25C0 Prev</button>
        <button class="pa-btn pa-primary" data-accept>Accept \u23CE</button>
        <button class="pa-btn" data-skip>Skip (S)</button>
        <button class="pa-btn" data-next>Next \u25B6</button>
        <button class="pa-btn" data-pano>Next pano (N)</button>
        <button class="pa-btn" data-help>? Help</button>
      </div>
      <div class="pa-stage" data-stage>
        <canvas class="pa-canvas" data-canvas></canvas>
        <canvas class="pa-map" data-map width="190" height="190"></canvas>
        <canvas class="pa-loupe" data-loupe width="190" height="190"></canvas>
        <div class="pa-readout" data-readout></div>
      </div>
      <div class="pa-help" data-help-panel hidden>${Ie}</div>
      <div class="pa-modal" data-intro>
        <div class="pa-card">
          <h2>Mark the building corners</h2>
          <p>The <b>yellow ring</b> is where the app guesses a known building corner is.
          Drag the <b>green dot</b> onto the real corner, or press <b>Enter</b> if it's
          already right. Press <b>S</b> if you can't tell. <b>Undo</b> fixes mistakes.</p>
          <p style="color:#8ea0ad">You'll do this for a few markers on three streets. It takes a couple of minutes.</p>
          <div class="pa-row"><button class="pa-btn" data-help-from-intro>More detail</button><button class="pa-btn pa-primary" data-start>Start</button></div>
        </div>
      </div>
    </div>`;let i=e=>p.querySelector(e),f=i("[data-stage]"),c=i("[data-canvas]"),M=i("[data-loupe]"),ue=i("[data-progress]"),_=i("[data-status]"),he=i("[data-readout]"),B=i("[data-undo]"),A=i("[data-help-panel]"),Y=i("[data-intro]"),o=c.getContext("2d"),h=M.getContext("2d"),n=i("[data-map]").getContext("2d"),k=null,w=0,y=0,u=.35,T=0,L=0,H=null,z=!1,$=null,v=null,D=[],ee=new Map,C=Math.min(2,window.devicePixelRatio||1),l=()=>k.panos[w],x=()=>l().markers[y];function U(){let e=x();D.push({panoIndex:w,markerIndex:y,pixel:[...e.pixel],status:e.status}),D.length>200&&D.shift(),B.disabled=D.length===0}function te(){let e=D.pop();if(B.disabled=D.length===0,!e)return;w=e.panoIndex,y=e.markerIndex;let t=x();t.pixel=[...e.pixel],t.status=e.status,q(),F(),b(),X("undone")}function ae(){let e=f.getBoundingClientRect();c.width=Math.round(e.width*C),c.height=Math.round(e.height*C),b()}let W=()=>c.width/C,N=()=>c.height/C,j=(e,t)=>[(e-T)*u+W()/2,(t-L)*u+N()/2],ne=(e,t)=>[(e-W()/2)/u+T,(t-N()/2)/u+L];function F(){let e=x();T=m(e.pixel[0],0,l().width),L=m(e.pixel[1],0,l().height)}function b(){let e=W(),t=N();if(o.setTransform(C,0,0,C,0,0),o.fillStyle="#0b0f12",o.fillRect(0,0,e,t),H&&z){let a=T-e/(2*u),r=L-t/(2*u);o.imageSmoothingEnabled=u<1,o.drawImage(H,a,r,e/u,t/u,0,0,e,t)}if(H&&z){let[,a]=j(0,l().height/2);o.strokeStyle="rgba(120,200,255,.35)",o.setLineDash([6,6]),o.beginPath(),o.moveTo(0,a),o.lineTo(e,a),o.stroke(),o.setLineDash([])}for(let a of l().markers){let r=a===x(),[d,s]=j(a.predicted[0],a.predicted[1]),[E,I]=j(a.pixel[0],a.pixel[1]);if(a.status==="skipped"){o.strokeStyle="rgba(150,160,170,.5)",o.beginPath(),o.moveTo(d-6,s-6),o.lineTo(d+6,s+6),o.moveTo(d+6,s-6),o.lineTo(d-6,s+6),o.stroke();continue}o.strokeStyle="rgba(255,210,90,.9)",o.lineWidth=r?2:1,o.beginPath(),o.arc(d,s,r?11:7,0,Math.PI*2),o.stroke(),o.fillStyle=a.status==="pending"?"rgba(255,210,90,.35)":"rgba(255,210,90,.9)",o.beginPath(),o.arc(d,s,2.5,0,Math.PI*2),o.fill(),(a.pixel[0]!==a.predicted[0]||a.pixel[1]!==a.predicted[1])&&(o.strokeStyle="rgba(255,210,90,.6)",o.setLineDash([3,3]),o.beginPath(),o.moveTo(d,s),o.lineTo(E,I),o.stroke(),o.setLineDash([])),o.fillStyle=r?"#7fe0a8":"#ffd25a",o.beginPath(),o.arc(E,I,r?5:3.5,0,Math.PI*2),o.fill()}be(),me(),fe()}function be(){let e=x(),t=190,a=7;if(h.fillStyle="#000",h.fillRect(0,0,t,t),H&&z){let r=t/(2*a);h.imageSmoothingEnabled=!0,h.drawImage(H,e.pixel[0]-r,e.pixel[1]-r,r*2,r*2,0,0,t,t)}h.strokeStyle="rgba(127,224,168,.9)",h.lineWidth=1,h.beginPath(),h.moveTo(t/2,t/2-14),h.lineTo(t/2,t/2+14),h.moveTo(t/2-14,t/2),h.lineTo(t/2+14,t/2),h.stroke()}function me(){let e=x(),t=190;n.setTransform(1,0,0,1,0,0),n.clearRect(0,0,t,t),n.fillStyle="#0b0f12",n.fillRect(0,0,t,t);let a=e.footprint,r=l().camera;if(!a?.length||!r){n.fillStyle="#8ea0ad",n.font="12px system-ui",n.fillText("no footprint",10,22);return}let d=[...a,[e.world.x,e.world.y]],s=d.map(g=>g[0]),E=d.map(g=>g[1]),I=Math.min(...s),R=Math.max(...s),oe=Math.min(...E),ie=Math.max(...E),se=24,de=Math.min((t-2*se)/Math.max(1,R-I),(t-2*se)/Math.max(1,ie-oe)),ge=(I+R)/2,xe=(oe+ie)/2,S=g=>(g-ge)*de+t/2,P=g=>-(g-xe)*de+t/2,G=m(S(r.x),9,t-9),Q=m(P(r.y),9,t-9);n.beginPath(),a.forEach((g,ke)=>{let le=S(g[0]),pe=P(g[1]);ke?n.lineTo(le,pe):n.moveTo(le,pe)}),n.closePath(),n.fillStyle="rgba(120,200,255,.15)",n.fill(),n.strokeStyle="rgba(150,190,220,.9)",n.lineWidth=1.5,n.stroke(),e.wall?.length===2&&(n.strokeStyle="#ffd25a",n.lineWidth=3,n.beginPath(),n.moveTo(S(e.wall[0][0]),P(e.wall[0][1])),n.lineTo(S(e.wall[1][0]),P(e.wall[1][1])),n.stroke()),n.setLineDash([4,3]),n.strokeStyle="rgba(255,210,90,.75)",n.beginPath(),n.moveTo(G,Q),n.lineTo(S(e.world.x),P(e.world.y)),n.stroke(),n.setLineDash([]),n.fillStyle="#7fd4a0",n.beginPath(),n.arc(G,Q,4,0,Math.PI*2),n.fill(),n.fillStyle="#9fb0bd",n.font="10px system-ui",n.fillText("camera",G+7,Q+3),n.strokeStyle="#ffd25a",n.lineWidth=2.5,n.beginPath(),n.arc(S(e.world.x),P(e.world.y),7,0,Math.PI*2),n.stroke(),n.fillStyle="#ffd25a",n.beginPath(),n.arc(S(e.world.x),P(e.world.y),3,0,Math.PI*2),n.fill(),n.fillStyle="#cfd9e0",n.font="bold 11px system-ui",n.fillText("N \u2191",8,16)}function fe(){let e=x(),t=Math.hypot(e.pixel[0]-e.predicted[0],e.pixel[1]-e.predicted[1]),a=l().markers.filter(r=>r.status!=="pending").length;he.innerHTML=`<div class="pa-q">Put the green dot on the end of the yellow wall shown on the map (top-right).</div>
      <b>${e.label}</b> \xB7 <span class="pa-status-line">${e.address}</span><br>
      <span class="pa-status-line">street-facing wall \xB7 obliquity ${e.obliquityDeg}\xB0 \xB7 standoff ${e.standoffM} m</span><br>
      predicted ${e.predicted[0].toFixed(0)}, ${e.predicted[1].toFixed(0)} \xB7 your pixel ${e.pixel[0].toFixed(0)}, ${e.pixel[1].toFixed(0)} \xB7 residual <span class="pa-res${t>60?" pa-warn":""}">${t.toFixed(1)} px</span>`,ue.textContent=`pano ${w+1}/${k.panos.length} \xB7 marker ${y+1}/${l().markers.length} \xB7 ${a}/${l().markers.length} decided${l().usedFor==="holdout"?" \xB7 HOLDOUT":""}`}function X(e){_.textContent=e,e&&window.setTimeout(()=>{_.textContent===e&&(_.textContent="")},2500)}async function q(){let e=l().markers;try{let t=await fetch("/api/pano-anchor/save",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({panoramaId:l().panoramaId,cameraModelId:k.cameraModelId,markers:e.map(r=>({markerId:r.id,kind:r.kind,buildingId:r.buildingId,address:r.address,world:r.world,predicted:r.predicted,pixel:r.pixel,status:r.status}))})}),a=await t.json();if(!t.ok)throw new Error(a.error??"save failed");X(`saved \u2713 (${a.decided} decided)`)}catch(t){X(`save failed: ${String(t)}`)}}function O(e){let t=x();U(),t.status=e,(e==="accepted"||e==="skipped")&&(t.pixel=[...t.predicted]),e==="corrected"&&Math.hypot(t.pixel[0]-t.predicted[0],t.pixel[1]-t.predicted[1])<.5&&(t.status="accepted"),q(),K(1)}function K(e){y=m(y+e,0,l().markers.length-1),F(),b()}function Z(e){w=m(e,0,k.panos.length-1),y=0,z=!1;let t=new Image;t.onload=()=>{H=t,z=!0,F(),b()},t.onerror=()=>X("failed to load panorama"),t.src=l().imageUrl;for(let a of l().markers){let r=ee.get(`${l().panoramaId}|${a.id}`);r&&(a.pixel=[...r.pixel],a.status=r.status)}F(),b()}function J(e){let t=c.getBoundingClientRect();return[e.clientX-t.left,e.clientY-t.top]}c.addEventListener("pointerdown",e=>{let[t,a]=J(e),r=null,d=14;for(let s of l().markers){let[E,I]=j(s.pixel[0],s.pixel[1]),R=Math.hypot(E-t,I-a);R<d&&(r=s,d=R)}r?(y=l().markers.indexOf(r),U(),$={marker:r,pointerId:e.pointerId},c.setPointerCapture(e.pointerId),b()):(v={pointerId:e.pointerId,x:t,y:a,cx:T,cy:L},f.classList.add("pa-panning"))}),c.addEventListener("pointermove",e=>{if($){let[t,a]=J(e),[r,d]=ne(t,a);$.marker.pixel=[r,d],b()}else if(v){let[t,a]=J(e);T=m(v.cx-(t-v.x)/u,0,l().width),L=m(v.cy-(a-v.y)/u,0,l().height),b()}});function re(e){if($){let t=$.marker,a=Math.hypot(t.pixel[0]-t.predicted[0],t.pixel[1]-t.predicted[1]);t.status=a<.5?"accepted":"corrected",$=null,q(),b()}v&&(v=null,f.classList.remove("pa-panning")),c.hasPointerCapture(e.pointerId)&&c.releasePointerCapture(e.pointerId)}c.addEventListener("pointerup",re),c.addEventListener("pointercancel",re),c.addEventListener("wheel",e=>{e.preventDefault();let[t,a]=J(e),[r,d]=ne(t,a);u=m(u*(e.deltaY<0?1.15:1/1.15),.05,8),T=m(r-(t-W()/2)/u,0,l().width),L=m(d-(a-N()/2)/u,0,l().height),b()},{passive:!1}),window.addEventListener("keydown",e=>{if(!k)return;if((e.ctrlKey||e.metaKey)&&(e.key==="z"||e.key==="Z")){e.preventDefault(),te();return}if(e.key==="Escape"){Y.hidden=!0,A.hidden=!0;return}let t=x(),a=e.shiftKey?10:1,r=(d,s)=>{U(),t.pixel=[t.pixel[0]+d,t.pixel[1]+s],t.status=Math.hypot(t.pixel[0]-t.predicted[0],t.pixel[1]-t.predicted[1])<.5?"accepted":"corrected",b()};switch(e.key){case"Enter":e.preventDefault(),O("accepted");break;case"s":case"S":O("skipped");break;case"Tab":e.preventDefault(),K(e.shiftKey?-1:1);break;case"n":case"N":e.preventDefault(),Z(w+1);break;case"p":case"P":e.preventDefault(),Z(w-1);break;case"r":case"R":U(),t.pixel=[...t.predicted],t.status="pending",q(),b();break;case"ArrowUp":e.preventDefault(),r(0,-a);break;case"ArrowDown":e.preventDefault(),r(0,a);break;case"ArrowLeft":e.preventDefault(),r(-a,0);break;case"ArrowRight":e.preventDefault(),r(a,0);break;default:break}}),i("[data-accept]").addEventListener("click",()=>O("accepted")),i("[data-skip]").addEventListener("click",()=>O("skipped")),i("[data-prev]").addEventListener("click",()=>K(-1)),i("[data-next]").addEventListener("click",()=>K(1)),i("[data-pano]").addEventListener("click",()=>Z(w+1)),B.addEventListener("click",te),i("[data-help]").addEventListener("click",()=>{A.hidden=!A.hidden}),i("[data-start]").addEventListener("click",()=>{Y.hidden=!0}),i("[data-help-from-intro]").addEventListener("click",()=>{Y.hidden=!0,A.hidden=!1}),window.addEventListener("resize",ae),(async()=>{let e=new URLSearchParams(window.location.search).get("task"),t=e&&/^[a-z0-9-]+$/.test(e)?`/api/pano-anchor/task/${e}`:"/api/pano-anchor/task",[a,r]=await Promise.all([fetch(t),fetch("/api/pano-anchor/anchors").catch(()=>null)]);if(!a.ok){p.innerHTML='<p style="padding:24px;color:#fff">No anchor task. Run: npx tsx scripts/review/build-pano-anchor-task.ts</p>';return}k=await a.json();for(let d of k.panos)for(let s of d.markers)s.pixel=[...s.predicted],s.status="pending";if(r?.ok){let d=await r.json();for(let s of d.anchors??[])ee.set(`${s.panoramaId}|${s.markerId}`,s)}if(!k.panos.length){p.innerHTML='<p style="padding:24px;color:#fff">Task has no panos.</p>';return}B.disabled=!0,Z(0),ae(),window.localStorage?.getItem("pano-anchor-intro-seen")?Y.hidden=!0:i("[data-start]").addEventListener("click",()=>window.localStorage?.setItem("pano-anchor-intro-seen","1"))})()}if(typeof document<"u"){let p=()=>{let i=document.getElementById("pano-anchor");i&&ce(i)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",p):p()}return Le(Se);})();

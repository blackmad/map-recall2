"use strict";var CanalRecallSculptures=(()=>{var C=Object.defineProperty;var J=Object.getOwnPropertyDescriptor;var Q=Object.getOwnPropertyNames;var X=Object.prototype.hasOwnProperty;var ee=(r,e,t)=>e in r?C(r,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):r[e]=t;var te=(r,e)=>{for(var t in e)C(r,t,{get:e[t],enumerable:!0})},re=(r,e,t,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let a of Q(e))!X.call(r,a)&&a!==t&&C(r,a,{get:()=>e[a],enumerable:!(n=J(e,a))||n.enumerable});return r};var ne=r=>re(C({},"__esModule",{value:!0}),r);var v=(r,e,t)=>ee(r,typeof e!="symbol"?e+"":e,t);var de={};te(de,{SculptureLod:()=>D,Sculptures:()=>_,createSplatObject:()=>z,decodeSplats:()=>O,encodeSplats:()=>H,eyeDistanceM:()=>R,landmarkHost:()=>E,mountSculptures:()=>Z,sculptureMercatorFromLocal:()=>G});var oe=2*Math.PI*6378137;function ae(r){return Math.atan(Math.sinh(Math.PI*(1-2*r)))*180/Math.PI}function W(r){let e=ae(r)*Math.PI/180;return 1/(oe*Math.cos(e))}function T(r,e,t=0){let n=(180+r)/360,a=(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+e*Math.PI/360)))/360;return[n,a,t*W(a)]}function Y(r,e){let t=1/r.unitsPerMetre;return[(e[0]-r.eye[0])*t,-(e[1]-r.eye[1])*t,(e[2]-r.eye[2])*t]}var B=r=>((r+180)%360+360)%360-180;function se(r,e,t=.12){if(!r.length)return{a:0,b:0,t:0};if(r.length===1)return{a:r[0].tile,b:r[0].tile,t:0};let n=[...r].sort((o,i)=>B(o.azimuthDeg)-B(i.azimuthDeg)),a=B(e);for(let o=0;o<n.length;o++){let i=n[o],c=n[(o+1)%n.length],u=B(i.azimuthDeg),p=B(c.azimuthDeg)-u;p<=0&&(p+=360);let s=a-u;if(s<0&&(s+=360),s<=p){let l=s/p,f=t<=0?l<.5?0:1:ie(.5-t,.5+t,l);return{a:i.tile,b:c.tile,t:f}}}return{a:n[0].tile,b:n[0].tile,t:0}}function ie(r,e,t){let n=Math.min(1,Math.max(0,(t-r)/(e-r)));return n*n*(3-2*n)}function le(r,e,t){let n=t*Math.PI/180,a=Math.sin(n),o=Math.cos(n),i=a*e-o*r,c=a*r+o*e;return Math.atan2(i,c)*180/Math.PI}var ce=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,ue=`
uniform sampler2D atlas;
uniform vec2 grid;
uniform float tileA;
uniform float tileB;
uniform float mixB;
uniform float brightness;
varying vec2 vUv;
vec4 tile(float i, vec2 uv) {
  float c = mod(i, grid.x);
  float r = floor(i / grid.x);
  vec2 o = vec2(c, grid.y - 1.0 - r);
  return texture2D(atlas, (o + clamp(uv, 0.003, 0.997)) / grid);
}
void main() {
  vec4 a = tile(tileA, vUv);
  vec4 b = tile(tileB, vUv);
  vec4 c = mix(a, b, mixB);
  if (c.a < 0.5) discard;
  gl_FragColor = vec4(c.rgb * brightness, 1.0);
  #include <colorspace_fragment>
}`;function $(r,e,t,n){t.colorSpace=r.SRGBColorSpace,t.anisotropy=4,t.generateMipmaps=!0,t.minFilter=r.LinearMipmapLinearFilter;let a=e.tileWidthM,o=e.tileHeightM,i=new r.PlaneGeometry(a,o);i.rotateX(Math.PI/2),i.translate(0,0,o/2-e.feetFromBottom*o);let c=new r.ShaderMaterial({vertexShader:ce,fragmentShader:ue,uniforms:{atlas:{value:t},grid:{value:new r.Vector2(e.cols,e.rows)},tileA:{value:0},tileB:{value:0},mixB:{value:0},brightness:{value:n.brightness??1}},side:r.DoubleSide,transparent:!1,depthWrite:!0}),u=new r.Mesh(i,c);return u.name="sculpture-impostor",u.position.set(0,0,n.baseZ),u.castShadow=!1,u.receiveShadow=!1,{mesh:u,meta:e,update(p){let s=Math.atan2(p[1],p[0]);u.rotation.z=s+Math.PI/2;let l=le(p[0],p[1],n.facingDeg),f=se(e.views,l,n.band);return c.uniforms.tileA.value=f.a,c.uniforms.tileB.value=f.b,c.uniforms.mixB.value=f.t,l},dispose(){i.dispose(),c.dispose(),t.dispose()}}}var D=class{constructor(e={}){v(this,"level","far");v(this,"nearM");v(this,"hysteresisM");v(this,"switches",0);this.nearM=e.nearM??50,this.hysteresisM=e.hysteresisM??5}update(e){if(!Number.isFinite(e))return this.level;let t=this.level==="near"?e>this.nearM+this.hysteresisM?"far":"near":e<this.nearM?"near":"far";return t!==this.level&&(this.level=t,this.switches++),this.level}};var q="MRSPLAT1";var pe=(r,e,t)=>r<e?e:r>t?t:r;function H(r){let e=r.count,t=[1/0,1/0,1/0],n=[-1/0,-1/0,-1/0],a=1/0,o=-1/0;for(let s=0;s<e;s++)for(let l=0;l<3;l++){let f=r.positions[s*3+l];f<t[l]&&(t[l]=f),f>n[l]&&(n[l]=f);let h=Math.log(Math.max(1e-6,r.scales[s*3+l]));h<a&&(a=h),h>o&&(o=h)}e||(t.fill(0),n.fill(0),a=0,o=0);let i=new Uint8Array(48+e*17),c=new DataView(i.buffer);for(let s=0;s<8;s++)i[s]=q.charCodeAt(s);c.setUint32(8,e,!0),c.setUint32(12,0,!0);for(let s=0;s<3;s++)c.setFloat32(16+s*4,t[s],!0),c.setFloat32(28+s*4,n[s],!0);c.setFloat32(40,a,!0),c.setFloat32(44,o,!0);let u=48;for(let s=0;s<e*3;s++,u+=2){let l=s%3,f=n[l]-t[l];c.setUint16(u,f>0?Math.round((r.positions[s]-t[l])/f*65535):0,!0)}let p=o-a;for(let s=0;s<e*3;s++)i[u++]=p>0?Math.round((Math.log(Math.max(1e-6,r.scales[s]))-a)/p*255):0;i.set(r.colors.subarray(0,e*4),u),u+=e*4;for(let s=0;s<e;s++){let l=r.rotations.subarray(s*4,s*4+4),f=Math.hypot(l[0],l[1],l[2],l[3])||1,h=l[0]<0?-1:1;for(let y=0;y<4;y++)i[u++]=Math.round(pe(h*l[y]/f,-1,1)*127.5+127.5)}return i}function O(r){let e=r instanceof Uint8Array?r:new Uint8Array(r);if(e.length<48)throw new Error("splat file too short");for(let h=0;h<8;h++)if(e[h]!==q.charCodeAt(h))throw new Error("not an MRSPLAT1 file");let t=new DataView(e.buffer,e.byteOffset,e.byteLength),n=t.getUint32(8,!0);if(e.length<48+n*17)throw new Error(`splat file truncated (${n} splats declared)`);let a=[0,1,2].map(h=>t.getFloat32(16+h*4,!0)),o=[0,1,2].map(h=>t.getFloat32(28+h*4,!0)),i=t.getFloat32(40,!0),c=t.getFloat32(44,!0),u=new Float32Array(n*3),p=new Float32Array(n*3),s=new Float32Array(n*4),l=48;for(let h=0;h<n*3;h++,l+=2){let y=h%3;u[h]=a[y]+t.getUint16(l,!0)/65535*(o[y]-a[y])}for(let h=0;h<n*3;h++)p[h]=Math.exp(i+e[l++]/255*(c-i));let f=e.slice(l,l+n*4);l+=n*4;for(let h=0;h<n;h++){let y=0;for(let m=0;m<4;m++){let b=(e[l++]-127.5)/127.5;s[h*4+m]=b,y+=b*b}y=Math.sqrt(y)||1;for(let m=0;m<4;m++)s[h*4+m]/=y}return{count:n,positions:u,scales:p,rotations:s,colors:f}}function K(r){let e=new Float32Array(r.count*6);for(let t=0;t<r.count;t++){let[n,a,o,i]=r.rotations.subarray(t*4,t*4+4),c=r.scales[t*3],u=r.scales[t*3+1],p=r.scales[t*3+2],s=1-2*(o*o+i*i),l=2*(a*o-n*i),f=2*(a*i+n*o),h=2*(a*o+n*i),y=1-2*(a*a+i*i),m=2*(o*i-n*a),b=2*(a*i-n*o),M=2*(o*i+n*a),L=1-2*(a*a+o*o),A=s*c,w=l*u,F=f*p,g=h*c,d=y*u,U=m*p,S=b*c,x=M*u,I=L*p,P=t*6;e[P]=A*A+w*w+F*F,e[P+1]=A*g+w*d+F*U,e[P+2]=A*S+w*x+F*I,e[P+3]=g*g+d*d+U*U,e[P+4]=g*S+d*x+U*I,e[P+5]=S*S+x*x+I*I}return e}var j=class{constructor(e,t=e.length/3){this.positions=e;this.count=t;v(this,"order");v(this,"depthKeys");v(this,"counts",new Uint32Array(65536));v(this,"starts",new Uint32Array(65536));v(this,"lastEye",null);v(this,"lastDir",null);v(this,"sorts",0);this.order=new Uint32Array(t),this.depthKeys=new Uint32Array(t);for(let n=0;n<t;n++)this.order[n]=n}sort(e){let t=this.count,n=this.positions,a=e[3],o=e[7],i=e[11],c=e[15],u=1/0,p=-1/0,s=this.depthKeys,l=new Float32Array(s.buffer);for(let m=0;m<t;m++){let b=a*n[m*3]+o*n[m*3+1]+i*n[m*3+2]+c;l[m]=b,b<u&&(u=b),b>p&&(p=b)}let f=p>u?65535/(p-u):0,h=this.counts;h.fill(0);for(let m=0;m<t;m++){let b=65535-(l[m]-u)*f|0;s[m]=b,h[b]++}let y=this.starts;y[0]=0;for(let m=1;m<65536;m++)y[m]=y[m-1]+h[m-1];for(let m=0;m<t;m++)this.order[y[s[m]]++]=m;return this.sorts++,this.order}needsSort(e,t,n=.05,a=.02){let o=this.lastEye,i=this.lastDir;if(o&&i){let c=Math.hypot(e[0]-o[0],e[1]-o[1],e[2]-o[2]),u=t[0]*i[0]+t[1]*i[1]+t[2]*i[2];if(c<=n&&u>=Math.cos(a))return!1}return this.lastEye=[e[0],e[1],e[2]],this.lastDir=[t[0],t[1],t[2]],!0}invalidate(){this.lastEye=null,this.lastDir=null}};var me=`
precision highp float;
precision highp int;
uniform sampler2D centers;
uniform sampler2D covA;
uniform sampler2D covB;
uniform sampler2D colors;
uniform int texWidth;
uniform vec2 viewport;
uniform float opacityScale;
in float splatIndex;
out vec4 vColor;
out vec2 vPos;
void main() {
  int i = int(splatIndex + 0.5);
  ivec2 uv = ivec2(i % texWidth, i / texWidth);
  vec3 c = texelFetch(centers, uv, 0).xyz;
  mat4 M = projectionMatrix * modelViewMatrix;
  vec4 clip = M * vec4(c, 1.0);
  if (clip.w <= 0.01) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  float iw = 1.0 / clip.w;
  vec3 rx = vec3(M[0][0], M[1][0], M[2][0]);
  vec3 ry = vec3(M[0][1], M[1][1], M[2][1]);
  vec3 rw = vec3(M[0][3], M[1][3], M[2][3]);
  // d(ndc)/d(local), then to pixels.
  vec3 jx = (rx - clip.x * iw * rw) * iw * 0.5 * viewport.x;
  vec3 jy = (ry - clip.y * iw * rw) * iw * 0.5 * viewport.y;
  vec4 a = texelFetch(covA, uv, 0);
  vec2 b = texelFetch(covB, uv, 0).xy;
  mat3 S = mat3(a.x, a.y, a.z, a.y, a.w, b.x, a.z, b.x, b.y);
  vec3 sjx = S * jx, sjy = S * jy;
  // +0.3 px\xB2: the usual low-pass so sub-pixel splats do not alias.
  float sxx = dot(jx, sjx) + 0.3, sxy = dot(jx, sjy), syy = dot(jy, sjy) + 0.3;
  float mid = 0.5 * (sxx + syy);
  float rad = length(vec2(0.5 * (sxx - syy), sxy));
  float l1 = mid + rad, l2 = max(mid - rad, 0.1);
  vec2 v1 = abs(sxy) < 1e-7 ? (sxx >= syy ? vec2(1.0, 0.0) : vec2(0.0, 1.0)) : normalize(vec2(sxy, l1 - sxx));
  vec2 v2 = vec2(-v1.y, v1.x);
  vec2 ax1 = min(sqrt(2.0 * l1), 512.0) * v1;
  vec2 ax2 = min(sqrt(2.0 * l2), 512.0) * v2;
  vPos = position.xy;
  vec2 offset = (position.x * ax1 + position.y * ax2) / (0.5 * viewport);
  gl_Position = vec4(clip.xy * iw + offset, clip.z * iw, 1.0);
  vColor = texelFetch(colors, uv, 0);
  vColor.a *= opacityScale;
}`,he=`
precision highp float;
in vec4 vColor;
in vec2 vPos;
out vec4 fragColor;
void main() {
  float A = -dot(vPos, vPos);
  if (A < -4.0) discard;
  float B = exp(A) * vColor.a;
  if (B < 1.0 / 255.0) discard;
  fragColor = vec4(vColor.rgb * B, B);
}`;function V(r,e,t,n,a){let o=new r.DataTexture(e,t,n,r.RGBAFormat,a?r.FloatType:r.UnsignedByteType);return o.minFilter=r.NearestFilter,o.magFilter=r.NearestFilter,o.generateMipmaps=!1,o.needsUpdate=!0,o}function z(r,e){let t=e.count,n=Math.min(4096,Math.max(1,Math.ceil(Math.sqrt(t)))),a=Math.max(1,Math.ceil(t/n)),o=n*a,i=new Float32Array(o*4),c=new Float32Array(o*4),u=new Float32Array(o*4),p=new Uint8Array(o*4),s=K(e);for(let d=0;d<t;d++)i.set(e.positions.subarray(d*3,d*3+3),d*4),c[d*4]=s[d*6],c[d*4+1]=s[d*6+1],c[d*4+2]=s[d*6+2],c[d*4+3]=s[d*6+3],u[d*4]=s[d*6+4],u[d*4+1]=s[d*6+5];p.set(e.colors.subarray(0,t*4));let l=[V(r,i,n,a,!0),V(r,c,n,a,!0),V(r,u,n,a,!0),V(r,p,n,a,!1)];l[3].colorSpace=r.NoColorSpace;let f=new r.InstancedBufferGeometry;f.setAttribute("position",new r.BufferAttribute(new Float32Array([-2,-2,0,2,-2,0,2,2,0,-2,2,0]),3)),f.setIndex([0,1,2,0,2,3]);let h=new Float32Array(t);for(let d=0;d<t;d++)h[d]=d;let y=new r.InstancedBufferAttribute(h,1);y.setUsage(r.DynamicDrawUsage),f.setAttribute("splatIndex",y),f.instanceCount=t;let m=0,b=0,M=0,L=0;for(let d=0;d<t;d++)b+=e.positions[d*3],M+=e.positions[d*3+1],L+=e.positions[d*3+2];t&&(b/=t,M/=t,L/=t);for(let d=0;d<t;d++)m=Math.max(m,Math.hypot(e.positions[d*3]-b,e.positions[d*3+1]-M,e.positions[d*3+2]-L));f.boundingSphere=new r.Sphere(new r.Vector3(b,M,L),m+.5);let A=new r.ShaderMaterial({glslVersion:r.GLSL3,vertexShader:me,fragmentShader:he,uniforms:{centers:{value:l[0]},covA:{value:l[1]},covB:{value:l[2]},colors:{value:l[3]},texWidth:{value:n},viewport:{value:new r.Vector2(1,1)},opacityScale:{value:1}},transparent:!0,depthTest:!0,depthWrite:!1,blending:r.CustomBlending,blendSrc:r.OneFactor,blendDst:r.OneMinusSrcAlphaFactor,blendSrcAlpha:r.OneFactor,blendDstAlpha:r.OneMinusSrcAlphaFactor}),w=new r.Mesh(f,A);w.name="sculpture-splat",w.castShadow=!1,w.receiveShadow=!1;let F=new j(e.positions,t),g=new Float64Array(16);return{mesh:w,sorter:F,count:t,update(d,U){A.uniforms.viewport.value.set(U[0],U[1]);let S=d,x=[S[3],S[7],S[11]],I=Math.hypot(x[0],x[1],x[2])||1;if(x[0]/=I,x[1]/=I,x[2]/=I,N(S,g),!F.needsSort([g[0],g[1],g[2]],x))return!1;let P=F.sort(d);for(let k=0;k<t;k++)h[k]=P[k];return y.needsUpdate=!0,!0},dispose(){f.dispose(),A.dispose();for(let d of l)d.dispose()}}}function N(r,e){let t=[r[0],r[4],r[8],r[12]],n=[r[1],r[5],r[9],r[13]],a=[r[3],r[7],r[11],r[15]],o=(m,b,M)=>m[0]*(b[1]*M[2]-b[2]*M[1])-m[1]*(b[0]*M[2]-b[2]*M[0])+m[2]*(b[0]*M[1]-b[1]*M[0]),i=m=>[t[m],n[m],a[m]],c=i(0),u=i(1),p=i(2),s=i(3),l=o(u,p,s),f=-o(c,p,s),h=o(c,u,s),y=-o(c,u,p);e[0]=l/y,e[1]=f/y,e[2]=h/y}function G(r){let[e,t,n]=T(r[0],r[1],0),a=W(t);return[a,0,0,0,0,-a,0,0,0,0,a,0,e,t,n,1]}function R(r,e){let t=Y(r,T(e[0],e[1],0));return Math.hypot(t[0],t[1],t[2])}var _=class{constructor(e,t,n){v(this,"root");v(this,"entries",[]);v(this,"stats",{near:0,updateMs:0,loads:0});v(this,"THREE");v(this,"options");v(this,"tmp");v(this,"tmp2");v(this,"eye",new Float64Array(3));v(this,"unregister",null);v(this,"frame",null);v(this,"enabled",!0);this.THREE=e,this.options=n,this.root=new e.Group,this.root.name="sculptures",this.tmp=new e.Matrix4,this.tmp2=new e.Matrix4;for(let a of t.sculptures){let o=new e.Group;o.name=`sculpture/${a.id}`,o.matrixAutoUpdate=!1;let i=G(a.anchor);o.matrix.fromArray(i),o.visible=!1,o.add(this.makePlinth(a)),this.root.add(o),this.entries.push({spec:a,root:o,near:null,lod:new D({nearM:a.nearM,hysteresisM:a.hysteresisM}),mercatorFromLocal:i,loading:null,failed:!1,azimuthDeg:null})}}makePlinth(e){let t=this.THREE,{widthM:n,depthM:a,heightM:o,color:i}=e.plinth,c=new t.BoxGeometry(n,a,o);c.translate(0,0,o/2);let u=new t.MeshStandardMaterial({color:new t.Color(i),roughness:.95,metalness:0}),p=new t.Mesh(c,u);return p.name="sculpture-plinth",p.rotation.z=-e.facingDeg*Math.PI/180,p.castShadow=!0,p.receiveShadow=!0,p.userData.landmarkId=e.landmarkId,p}participant(){return{root:this.root,beforeRender:e=>this.beforeRender(e)}}attach(e,t=25){this.frame=e,this.unregister=e.register("sculptures",this.participant(),{order:t})}detach(){this.unregister?.(),this.unregister=null}beforeRender(e){if(e.pass!=="main")return!1;let t=!1;this.stats.near=0;let n=performance.now();for(let a of this.entries){let o=this.enabled&&!a.failed?a.lod.update(R(e.frame,a.spec.anchor)):"far",i=o==="near"&&!!a.near;o==="near"&&!a.near&&!a.loading&&!a.failed&&(a.loading=this.load(a)),i&&this.options.host?.setHandModelHidden?.(a.spec.handModelId,!0),a.root.visible=i,i&&(t=!0,this.stats.near++,this.tmp.copy(e.clipFromWorld).multiply(e.worldFromMercator).multiply(this.tmp2.fromArray(a.mercatorFromLocal)),N(this.tmp.elements,this.eye),a.near.update(this.tmp.elements,this.viewport(),this.eye))}return this.stats.updateMs=performance.now()-n,t}viewport(){let e=this.frame?.renderer?.getContext?.();return e?[e.drawingBufferWidth,e.drawingBufferHeight]:[1,1]}async load(e){let t=this.THREE,n=e.spec.reconstruction,a=o=>new URL(o,this.options.baseUrl).href;try{let o;if(n.kind==="impostor"){let[i,c]=await Promise.all([fetch(a(n.metaUrl)).then(p=>{if(!p.ok)throw new Error(`${p.status} ${n.metaUrl}`);return p.json()}),(this.options.loadTexture??(p=>new t.TextureLoader().loadAsync(p)))(a(n.atlasUrl))]),u=$(t,i,c,{facingDeg:e.spec.facingDeg,baseZ:e.spec.plinth.heightM,band:n.band,brightness:n.brightness});o={mesh:u.mesh,update:(p,s,l)=>{e.azimuthDeg=u.update(l)},dispose:()=>u.dispose()}}else{let i=await fetch(a(n.url));if(!i.ok)throw new Error(`${i.status} ${n.url}`);let c=z(t,O(await i.arrayBuffer()));o={mesh:c.mesh,update:(u,p)=>{c.update(u,p)},dispose:()=>c.dispose()}}o.mesh.userData.landmarkId=e.spec.landmarkId,e.near=o,e.root.add(o.mesh),this.stats.loads++,this.frame?.compile?.(e.root),this.frame?.map?.triggerRepaint?.()}catch(o){e.failed=!0,console.warn(`Sculpture ${e.spec.id}: reconstruction unavailable, the hand model stays.`,o)}finally{e.loading=null}}pick(e,t,n,a){let o=this.THREE,i=new o.Matrix4().fromArray(Array.from(n)).invert(),c=new o.Vector3(e,t,-1).applyMatrix4(i),u=new o.Vector3(e,t,1).applyMatrix4(i),p=new o.Ray(c,u.sub(c).normalize());for(let s of this.entries){if(!s.root.visible||!s.near)continue;let l=new o.Matrix4().fromArray(Array.from(a)).multiply(new o.Matrix4().fromArray(s.mercatorFromLocal)),f=s.near.mesh.geometry;f.boundingSphere||f.computeBoundingSphere();let h=f.boundingSphere,y=s.spec.plinth,m=Math.max(Math.hypot(y.widthM,y.depthM)/2,Math.hypot(h.center.x,h.center.y)+h.radius),b=Math.max(y.heightM,s.near.mesh.position.z+h.center.z+h.radius),M=new o.Box3(new o.Vector3(-m,-m,0),new o.Vector3(m,m,b));if(p.intersectsBox(M.applyMatrix4(l)))return s.spec.landmarkId}return null}dispose(){this.detach();for(let e of this.entries)e.near?.dispose()}};async function Z(r,e,t){let n=await fetch(t.manifestUrl);if(!n.ok)throw new Error(`${n.status} ${t.manifestUrl}`);let a=await n.json(),o=new _(r,a,{baseUrl:new URL(t.manifestUrl,globalThis.location?.href).href,host:t.host});return o.attach(e),o}function E(r){return{setHandModelHidden(e,t){if(t)for(let n of r?._entries??[])n.spec?.id===e&&n.holder&&(n.holder.visible=!1)}}}return ne(de);})();

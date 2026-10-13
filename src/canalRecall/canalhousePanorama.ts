import * as T from 'three';

export interface StreetPanorama { url:string; headingDeg:number; pitchDeg:number; capturedAt:string; rights:string; fovDeg?:number }

/** World-aligned municipal panorama, using the same rays as our source crops. */
export class CanalhousePanorama {
 private renderer = new T.WebGLRenderer({antialias:true});
 private scene = new T.Scene();
 private camera = new T.Camera();
 private texture?:T.Texture;
 private request=0;
 private yaw=0; private pitch=0; private fov=70;
 private uniforms={photo:{value:null as T.Texture|null},yaw:{value:0},pitch:{value:0},scale:{value:1},aspect:{value:1}};
 constructor(private host:HTMLElement, private caption:HTMLElement) {
  this.renderer.outputColorSpace=T.SRGBColorSpace;
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  host.append(this.renderer.domElement);
  this.renderer.domElement.style.touchAction='none';
  this.scene.add(new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({uniforms:this.uniforms,
   vertexShader:'varying vec2 uvPhoto; void main(){uvPhoto=uv;gl_Position=vec4(position.xy,0.,1.);}',
   fragmentShader:`uniform sampler2D photo;uniform float yaw,pitch,scale,aspect;varying vec2 uvPhoto;
   void main(){float u=(uvPhoto.x*2.-1.)*scale;float v=(uvPhoto.y*2.-1.)*scale/aspect;
   vec3 forward=vec3(sin(yaw)*cos(pitch),cos(yaw)*cos(pitch),sin(pitch));
   vec3 right=vec3(cos(yaw),-sin(yaw),0.);
   vec3 up=vec3(-sin(yaw)*sin(pitch),-cos(yaw)*sin(pitch),cos(pitch));
   vec3 ray=normalize(forward+u*right+v*up);
   vec2 pixel=vec2(fract(atan(ray.x,ray.y)/6.28318530718+.5),.5-asin(ray.z)/3.14159265359);
   gl_FragColor=texture2D(photo,vec2(pixel.x,1.-pixel.y));
   #include <colorspace_fragment>
   }`})));
  let drag:{x:number;y:number}|undefined;
  host.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};host.setPointerCapture(e.pointerId);};
  host.onpointermove=e=>{if(!drag)return;const degrees=this.fov/host.clientWidth;this.yaw-=(e.clientX-drag.x)*degrees;this.pitch=Math.max(-80,Math.min(80,this.pitch+(e.clientY-drag.y)*degrees));drag={x:e.clientX,y:e.clientY};this.draw();};
  host.onpointerup=host.onpointercancel=()=>{drag=undefined;};
  host.addEventListener('wheel',e=>{e.preventDefault();this.fov=Math.max(25,Math.min(110,this.fov+e.deltaY*.04));this.draw();},{passive:false});
  new ResizeObserver(()=>this.draw()).observe(host);
 }
 async show(source:StreetPanorama, row=false) {
  const request=++this.request;this.yaw=source.headingDeg;this.pitch=source.pitchDeg;this.fov=source.fovDeg??(row?95:65);
  this.renderer.domElement.style.visibility='hidden';
  this.caption.textContent='Loading street panorama…';
  try {
   const url=new URL(source.url);
   // A fixed public host, with no access to private archive filesystem paths.
   const imageUrl=['localhost','127.0.0.1'].includes(location.hostname)&&url.hostname==='t1.data.amsterdam.nl'
    ?url.pathname.replace(/^\/panorama\//,'/canalhouse-panorama/'):source.url;
   const texture=await new T.TextureLoader().loadAsync(imageUrl);
   if(request!==this.request){texture.dispose();return;}
   texture.colorSpace=T.SRGBColorSpace;texture.wrapS=T.RepeatWrapping;
   this.texture?.dispose();this.texture=texture;this.uniforms.photo.value=texture;
   this.renderer.domElement.style.visibility='visible';
   this.caption.textContent=`${source.capturedAt.slice(0,10)} · ${source.rights??'Source rights not recorded'} · Drag to look around; scroll to zoom.`;this.draw();
  }catch{if(request===this.request)this.caption.textContent='Panorama unavailable. Open the municipal source link below.';}
 }
 clear(){++this.request;this.renderer.domElement.style.visibility='hidden';this.texture?.dispose();this.texture=undefined;this.uniforms.photo.value=null;this.caption.textContent='No street panorama recorded for this selection.';}
 private draw(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.uniforms.yaw.value=this.yaw*Math.PI/180;this.uniforms.pitch.value=this.pitch*Math.PI/180;this.uniforms.scale.value=Math.tan(this.fov*Math.PI/360);this.uniforms.aspect.value=w/h;if(this.texture)this.renderer.render(this.scene,this.camera);}
}

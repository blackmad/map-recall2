var dh=0,Jl=1,fh=2;var hs=1,ph=2,Ar=3,ei=0,Wt=1,On=2,Bn=0,Vi=1,Ql=2,ec=3,tc=4,mh=5;var yi=100,gh=101,yh=102,xh=103,bh=104,_h=200,vh=201,Mh=202,Sh=203,po=204,mo=205,wh=206,Eh=207,Ah=208,Th=209,Rh=210,Ch=211,Ph=212,Lh=213,Ih=214,go=0,yo=1,xo=2,Gi=3,bo=4,_o=5,vo=6,Mo=7,jo=0,kh=1,Nh=2,vn=0,nc=1,ic=2,rc=3,sc=4,oc=5,ac=6,lc=7;var cc=300,Si=301,Yi=302,$o=303,Zo=304,ds=306,So=1e3,Nn=1001,wo=1002,Ct=1003,Dh=1004;var fs=1005;var Nt=1006,Ko=1007;var zn=1008;var jt=1009,uc=1010,hc=1011,Tr=1012,Jo=1013,Mn=1014,Sn=1015,Vn=1016,Qo=1017,ea=1018,Rr=1020,dc=35902,fc=35899,pc=1021,mc=1022,ln=1023,Dn=1026,wi=1027,gc=1028,ta=1029,Ei=1030,na=1031;var ia=1033,ps=33776,ms=33777,gs=33778,ys=33779,ra=35840,sa=35841,oa=35842,aa=35843,la=36196,ca=37492,ua=37496,ha=37488,da=37489,xs=37490,fa=37491,pa=37808,ma=37809,ga=37810,ya=37811,xa=37812,ba=37813,_a=37814,va=37815,Ma=37816,Sa=37817,wa=37818,Ea=37819,Aa=37820,Ta=37821,Ra=36492,Ca=36494,Pa=36495,La=36283,Ia=36284,bs=36285,ka=36286;var Zr=2300,Eo=2301,fo=2302,Gl=2303,Hl=2400,Wl=2401,ql=2402;var Fh=3200;var Na=0,Uh=1,ii="",en="srgb",Hi="srgb-linear",Kr="linear",je="srgb";var Bi=7680;var Xl=519,Oh=512,Bh=513,zh=514,Da=515,Vh=516,Gh=517,Fa=518,Hh=519,Yl=35044;var yc="300 es",bn=2e3,xr=2001;function Dp(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function Fp(n){return ArrayBuffer.isView(n)&&!(n instanceof DataView)}function Jr(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function Wh(){let n=Jr("canvas");return n.style.display="block",n}var Xu={},br=null;function xc(...n){let e="THREE."+n.shift();br?br("log",e,...n):console.log(e,...n)}function qh(n){let e=n[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=n[1];t&&t.isStackTrace?n[0]+=" "+t.getLocation():n[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return n}function Te(...n){n=qh(n);let e="THREE."+n.shift();if(br)br("warn",e,...n);else{let t=n[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...n)}}function Re(...n){n=qh(n);let e="THREE."+n.shift();if(br)br("error",e,...n);else{let t=n[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...n)}}function zi(...n){let e=n.join(" ");e in Xu||(Xu[e]=!0,Te(...n))}function Xh(n,e,t){return new Promise(function(i,r){function s(){switch(n.clientWaitSync(e,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:r();break;case n.TIMEOUT_EXPIRED:setTimeout(s,t);break;default:i()}}setTimeout(s,t)})}var Yh={[go]:yo,[xo]:vo,[bo]:Mo,[Gi]:_o,[yo]:go,[vo]:xo,[Mo]:bo,[_o]:Gi},Fn=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){let i=this._listeners;return i===void 0?!1:i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){let i=this._listeners;if(i===void 0)return;let r=i[e];if(r!==void 0){let s=r.indexOf(t);s!==-1&&r.splice(s,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let i=t[e.type];if(i!==void 0){e.target=this;let r=i.slice(0);for(let s=0,o=r.length;s<o;s++)r[s].call(this,e);e.target=null}}},Ot=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var xl=Math.PI/180,Ao=180/Math.PI;function _s(){let n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Ot[n&255]+Ot[n>>8&255]+Ot[n>>16&255]+Ot[n>>24&255]+"-"+Ot[e&255]+Ot[e>>8&255]+"-"+Ot[e>>16&15|64]+Ot[e>>24&255]+"-"+Ot[t&63|128]+Ot[t>>8&255]+"-"+Ot[t>>16&255]+Ot[t>>24&255]+Ot[i&255]+Ot[i>>8&255]+Ot[i>>16&255]+Ot[i>>24&255]).toLowerCase()}function Ge(n,e,t){return Math.max(e,Math.min(t,n))}function Up(n,e){return(n%e+e)%e}function bl(n,e,t){return(1-t)*n+t*e}function qr(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function Yt(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Be=class n{static{n.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,i=this.y,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6],this.y=r[1]*t+r[4]*i+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Ge(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(Ge(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let i=Math.cos(t),r=Math.sin(t),s=this.x-e.x,o=this.y-e.y;return this.x=s*i-o*r+e.x,this.y=s*r+o*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Un=class{constructor(e=0,t=0,i=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=r}static slerpFlat(e,t,i,r,s,o,a){let l=i[r+0],c=i[r+1],h=i[r+2],f=i[r+3],u=s[o+0],d=s[o+1],g=s[o+2],x=s[o+3];if(f!==x||l!==u||c!==d||h!==g){let p=l*u+c*d+h*g+f*x;p<0&&(u=-u,d=-d,g=-g,x=-x,p=-p);let m=1-a;if(p<.9995){let v=Math.acos(p),M=Math.sin(v);m=Math.sin(m*v)/M,a=Math.sin(a*v)/M,l=l*m+u*a,c=c*m+d*a,h=h*m+g*a,f=f*m+x*a}else{l=l*m+u*a,c=c*m+d*a,h=h*m+g*a,f=f*m+x*a;let v=1/Math.sqrt(l*l+c*c+h*h+f*f);l*=v,c*=v,h*=v,f*=v}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=f}static multiplyQuaternionsFlat(e,t,i,r,s,o){let a=i[r],l=i[r+1],c=i[r+2],h=i[r+3],f=s[o],u=s[o+1],d=s[o+2],g=s[o+3];return e[t]=a*g+h*f+l*d-c*u,e[t+1]=l*g+h*u+c*f-a*d,e[t+2]=c*g+h*d+a*u-l*f,e[t+3]=h*g-a*f-l*u-c*d,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,r){return this._x=e,this._y=t,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let i=e._x,r=e._y,s=e._z,o=e._order,a=Math.cos,l=Math.sin,c=a(i/2),h=a(r/2),f=a(s/2),u=l(i/2),d=l(r/2),g=l(s/2);switch(o){case"XYZ":this._x=u*h*f+c*d*g,this._y=c*d*f-u*h*g,this._z=c*h*g+u*d*f,this._w=c*h*f-u*d*g;break;case"YXZ":this._x=u*h*f+c*d*g,this._y=c*d*f-u*h*g,this._z=c*h*g-u*d*f,this._w=c*h*f+u*d*g;break;case"ZXY":this._x=u*h*f-c*d*g,this._y=c*d*f+u*h*g,this._z=c*h*g+u*d*f,this._w=c*h*f-u*d*g;break;case"ZYX":this._x=u*h*f-c*d*g,this._y=c*d*f+u*h*g,this._z=c*h*g-u*d*f,this._w=c*h*f+u*d*g;break;case"YZX":this._x=u*h*f+c*d*g,this._y=c*d*f+u*h*g,this._z=c*h*g-u*d*f,this._w=c*h*f-u*d*g;break;case"XZY":this._x=u*h*f-c*d*g,this._y=c*d*f-u*h*g,this._z=c*h*g+u*d*f,this._w=c*h*f+u*d*g;break;default:Te("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let i=t/2,r=Math.sin(i);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,i=t[0],r=t[4],s=t[8],o=t[1],a=t[5],l=t[9],c=t[2],h=t[6],f=t[10],u=i+a+f;if(u>0){let d=.5/Math.sqrt(u+1);this._w=.25/d,this._x=(h-l)*d,this._y=(s-c)*d,this._z=(o-r)*d}else if(i>a&&i>f){let d=2*Math.sqrt(1+i-a-f);this._w=(h-l)/d,this._x=.25*d,this._y=(r+o)/d,this._z=(s+c)/d}else if(a>f){let d=2*Math.sqrt(1+a-i-f);this._w=(s-c)/d,this._x=(r+o)/d,this._y=.25*d,this._z=(l+h)/d}else{let d=2*Math.sqrt(1+f-i-a);this._w=(o-r)/d,this._x=(s+c)/d,this._y=(l+h)/d,this._z=.25*d}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<1e-8?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Ge(this.dot(e),-1,1)))}rotateTowards(e,t){let i=this.angleTo(e);if(i===0)return this;let r=Math.min(1,t/i);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let i=e._x,r=e._y,s=e._z,o=e._w,a=t._x,l=t._y,c=t._z,h=t._w;return this._x=i*h+o*a+r*c-s*l,this._y=r*h+o*l+s*a-i*c,this._z=s*h+o*c+i*l-r*a,this._w=o*h-i*a-r*l-s*c,this._onChangeCallback(),this}slerp(e,t){let i=e._x,r=e._y,s=e._z,o=e._w,a=this.dot(e);a<0&&(i=-i,r=-r,s=-s,o=-o,a=-a);let l=1-t;if(a<.9995){let c=Math.acos(a),h=Math.sin(c);l=Math.sin(l*c)/h,t=Math.sin(t*c)/h,this._x=this._x*l+i*t,this._y=this._y*l+r*t,this._z=this._z*l+s*t,this._w=this._w*l+o*t,this._onChangeCallback()}else this._x=this._x*l+i*t,this._y=this._y*l+r*t,this._z=this._z*l+s*t,this._w=this._w*l+o*t,this.normalize();return this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),r=Math.sqrt(1-i),s=Math.sqrt(i);return this.set(r*Math.sin(e),r*Math.cos(e),s*Math.sin(t),s*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},V=class n{static{n.prototype.isVector3=!0}constructor(e=0,t=0,i=0){this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Yu.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Yu.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[3]*i+s[6]*r,this.y=s[1]*t+s[4]*i+s[7]*r,this.z=s[2]*t+s[5]*i+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,i=this.y,r=this.z,s=e.elements,o=1/(s[3]*t+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*t+s[4]*i+s[8]*r+s[12])*o,this.y=(s[1]*t+s[5]*i+s[9]*r+s[13])*o,this.z=(s[2]*t+s[6]*i+s[10]*r+s[14])*o,this}applyQuaternion(e){let t=this.x,i=this.y,r=this.z,s=e.x,o=e.y,a=e.z,l=e.w,c=2*(o*r-a*i),h=2*(a*t-s*r),f=2*(s*i-o*t);return this.x=t+l*c+o*f-a*h,this.y=i+l*h+a*c-s*f,this.z=r+l*f+s*h-o*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[4]*i+s[8]*r,this.y=s[1]*t+s[5]*i+s[9]*r,this.z=s[2]*t+s[6]*i+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this.z=Ge(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this.z=Ge(this.z,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Ge(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let i=e.x,r=e.y,s=e.z,o=t.x,a=t.y,l=t.z;return this.x=r*l-s*a,this.y=s*o-i*l,this.z=i*a-r*o,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return _l.copy(this).projectOnVector(e),this.sub(_l)}reflect(e){return this.sub(_l.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(Ge(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y,r=this.z-e.z;return t*t+i*i+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){let r=Math.sin(t)*e;return this.x=r*Math.sin(i),this.y=Math.cos(t)*e,this.z=r*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},_l=new V,Yu=new Un,Le=class n{static{n.prototype.isMatrix3=!0}constructor(e,t,i,r,s,o,a,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,o,a,l,c)}set(e,t,i,r,s,o,a,l,c){let h=this.elements;return h[0]=e,h[1]=r,h[2]=a,h[3]=t,h[4]=s,h[5]=l,h[6]=i,h[7]=o,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,r=t.elements,s=this.elements,o=i[0],a=i[3],l=i[6],c=i[1],h=i[4],f=i[7],u=i[2],d=i[5],g=i[8],x=r[0],p=r[3],m=r[6],v=r[1],M=r[4],y=r[7],w=r[2],E=r[5],T=r[8];return s[0]=o*x+a*v+l*w,s[3]=o*p+a*M+l*E,s[6]=o*m+a*y+l*T,s[1]=c*x+h*v+f*w,s[4]=c*p+h*M+f*E,s[7]=c*m+h*y+f*T,s[2]=u*x+d*v+g*w,s[5]=u*p+d*M+g*E,s[8]=u*m+d*y+g*T,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8];return t*o*h-t*a*c-i*s*h+i*a*l+r*s*c-r*o*l}invert(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8],f=h*o-a*c,u=a*l-h*s,d=c*s-o*l,g=t*f+i*u+r*d;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let x=1/g;return e[0]=f*x,e[1]=(r*c-h*i)*x,e[2]=(a*i-r*o)*x,e[3]=u*x,e[4]=(h*t-r*l)*x,e[5]=(r*s-a*t)*x,e[6]=d*x,e[7]=(i*l-c*t)*x,e[8]=(o*t-i*s)*x,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,r,s,o,a){let l=Math.cos(s),c=Math.sin(s);return this.set(i*l,i*c,-i*(l*o+c*a)+o+e,-r*c,r*l,-r*(-c*o+l*a)+a+t,0,0,1),this}scale(e,t){return zi("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(vl.makeScale(e,t)),this}rotate(e){return zi("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(vl.makeRotation(-e)),this}translate(e,t){return zi("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(vl.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,i=e.elements;for(let r=0;r<9;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}},vl=new Le,ju=new Le().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),$u=new Le().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Op(){let n={enabled:!0,workingColorSpace:Hi,spaces:{},convert:function(r,s,o){return this.enabled===!1||s===o||!s||!o||(this.spaces[s].transfer===je&&(r.r=Qn(r.r),r.g=Qn(r.g),r.b=Qn(r.b)),this.spaces[s].primaries!==this.spaces[o].primaries&&(r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===je&&(r.r=yr(r.r),r.g=yr(r.g),r.b=yr(r.b))),r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){return r===ii?Kr:this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,o){return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,s){return zi("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),n.workingToColorSpace(r,s)},toWorkingColorSpace:function(r,s){return zi("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),n.colorSpaceToWorking(r,s)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],i=[.3127,.329];return n.define({[Hi]:{primaries:e,whitePoint:i,transfer:Kr,toXYZ:ju,fromXYZ:$u,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:en},outputColorSpaceConfig:{drawingBufferColorSpace:en}},[en]:{primaries:e,whitePoint:i,transfer:je,toXYZ:ju,fromXYZ:$u,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:en}}}),n}var Ve=Op();function Qn(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function yr(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}var sr,To=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let i;if(e instanceof HTMLCanvasElement)i=e;else{sr===void 0&&(sr=Jr("canvas")),sr.width=e.width,sr.height=e.height;let r=sr.getContext("2d");e instanceof ImageData?r.putImageData(e,0,0):r.drawImage(e,0,0,e.width,e.height),i=sr}return i.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=Jr("canvas");t.width=e.width,t.height=e.height;let i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);let r=i.getImageData(0,0,e.width,e.height),s=r.data;for(let o=0;o<s.length;o++)s[o]=Qn(s[o]/255)*255;return i.putImageData(r,0,0),t}else if(e.data){let t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor(Qn(t[i]/255)*255):t[i]=Qn(t[i]);return{data:t,width:e.width,height:e.height}}else return Te("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},Bp=0,_r=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Bp++}),this.uuid=_s(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let i={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let o=0,a=r.length;o<a;o++)r[o].isDataTexture?s.push(Ml(r[o].image)):s.push(Ml(r[o]))}else s=Ml(r);i.url=s}return t||(e.images[this.uuid]=i),i}};function Ml(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?To.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(Te("Texture: Unable to serialize Texture."),{})}var zp=0,Sl=new V,Gt=class n extends Fn{constructor(e=n.DEFAULT_IMAGE,t=n.DEFAULT_MAPPING,i=Nn,r=Nn,s=Nt,o=zn,a=ln,l=jt,c=n.DEFAULT_ANISOTROPY,h=ii){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:zp++}),this.uuid=_s(),this.name="",this.source=new _r(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new Be(0,0),this.repeat=new Be(1,1),this.center=new Be(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Le,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Sl).x}get height(){return this.source.getSize(Sl).y}get depth(){return this.source.getSize(Sl).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let i=e[t];if(i===void 0){Te(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){Te(`Texture.setValues(): property '${t}' does not exist.`);continue}r&&i&&r.isVector2&&i.isVector2||r&&i&&r.isVector3&&i.isVector3||r&&i&&r.isMatrix3&&i.isMatrix3?r.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==cc)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case So:e.x=e.x-Math.floor(e.x);break;case Nn:e.x=e.x<0?0:1;break;case wo:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case So:e.y=e.y-Math.floor(e.y);break;case Nn:e.y=e.y<0?0:1;break;case wo:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Gt.DEFAULT_IMAGE=null;Gt.DEFAULT_MAPPING=cc;Gt.DEFAULT_ANISOTROPY=1;var st=class n{static{n.prototype.isVector4=!0}constructor(e=0,t=0,i=0,r=1){this.x=e,this.y=t,this.z=i,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,r){return this.x=e,this.y=t,this.z=i,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,i=this.y,r=this.z,s=this.w,o=e.elements;return this.x=o[0]*t+o[4]*i+o[8]*r+o[12]*s,this.y=o[1]*t+o[5]*i+o[9]*r+o[13]*s,this.z=o[2]*t+o[6]*i+o[10]*r+o[14]*s,this.w=o[3]*t+o[7]*i+o[11]*r+o[15]*s,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,r,s,l=e.elements,c=l[0],h=l[4],f=l[8],u=l[1],d=l[5],g=l[9],x=l[2],p=l[6],m=l[10];if(Math.abs(h-u)<.01&&Math.abs(f-x)<.01&&Math.abs(g-p)<.01){if(Math.abs(h+u)<.1&&Math.abs(f+x)<.1&&Math.abs(g+p)<.1&&Math.abs(c+d+m-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let M=(c+1)/2,y=(d+1)/2,w=(m+1)/2,E=(h+u)/4,T=(f+x)/4,_=(g+p)/4;return M>y&&M>w?M<.01?(i=0,r=.707106781,s=.707106781):(i=Math.sqrt(M),r=E/i,s=T/i):y>w?y<.01?(i=.707106781,r=0,s=.707106781):(r=Math.sqrt(y),i=E/r,s=_/r):w<.01?(i=.707106781,r=.707106781,s=0):(s=Math.sqrt(w),i=T/s,r=_/s),this.set(i,r,s,t),this}let v=Math.sqrt((p-g)*(p-g)+(f-x)*(f-x)+(u-h)*(u-h));return Math.abs(v)<.001&&(v=1),this.x=(p-g)/v,this.y=(f-x)/v,this.z=(u-h)/v,this.w=Math.acos((c+d+m-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this.z=Ge(this.z,e.z,t.z),this.w=Ge(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this.z=Ge(this.z,e,t),this.w=Ge(this.w,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Ge(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Ro=class extends Fn{constructor(e=1,t=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Nt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=i.depth,this.scissor=new st(0,0,e,t),this.scissorTest=!1,this.viewport=new st(0,0,e,t),this.textures=[];let r={width:e,height:t,depth:i.depth},s=new Gt(r),o=i.count;for(let a=0;a<o;a++)this.textures[a]=s.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:Nt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let r=0,s=this.textures.length;r<s;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=i,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,i=e.textures.length;t<i;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let r=Object.assign({},e.textures[t].image);this.textures[t].source=new _r(r)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},tn=class extends Ro{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}},Qr=class extends Gt{constructor(e=null,t=1,i=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=Ct,this.minFilter=Ct,this.wrapR=Nn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var Co=class extends Gt{constructor(e=null,t=1,i=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=Ct,this.minFilter=Ct,this.wrapR=Nn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var at=class n{static{n.prototype.isMatrix4=!0}constructor(e,t,i,r,s,o,a,l,c,h,f,u,d,g,x,p){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,o,a,l,c,h,f,u,d,g,x,p)}set(e,t,i,r,s,o,a,l,c,h,f,u,d,g,x,p){let m=this.elements;return m[0]=e,m[4]=t,m[8]=i,m[12]=r,m[1]=s,m[5]=o,m[9]=a,m[13]=l,m[2]=c,m[6]=h,m[10]=f,m[14]=u,m[3]=d,m[7]=g,m[11]=x,m[15]=p,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new n().fromArray(this.elements)}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){let t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),i.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,i=e.elements,r=1/or.setFromMatrixColumn(e,0).length(),s=1/or.setFromMatrixColumn(e,1).length(),o=1/or.setFromMatrixColumn(e,2).length();return t[0]=i[0]*r,t[1]=i[1]*r,t[2]=i[2]*r,t[3]=0,t[4]=i[4]*s,t[5]=i[5]*s,t[6]=i[6]*s,t[7]=0,t[8]=i[8]*o,t[9]=i[9]*o,t[10]=i[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,i=e.x,r=e.y,s=e.z,o=Math.cos(i),a=Math.sin(i),l=Math.cos(r),c=Math.sin(r),h=Math.cos(s),f=Math.sin(s);if(e.order==="XYZ"){let u=o*h,d=o*f,g=a*h,x=a*f;t[0]=l*h,t[4]=-l*f,t[8]=c,t[1]=d+g*c,t[5]=u-x*c,t[9]=-a*l,t[2]=x-u*c,t[6]=g+d*c,t[10]=o*l}else if(e.order==="YXZ"){let u=l*h,d=l*f,g=c*h,x=c*f;t[0]=u+x*a,t[4]=g*a-d,t[8]=o*c,t[1]=o*f,t[5]=o*h,t[9]=-a,t[2]=d*a-g,t[6]=x+u*a,t[10]=o*l}else if(e.order==="ZXY"){let u=l*h,d=l*f,g=c*h,x=c*f;t[0]=u-x*a,t[4]=-o*f,t[8]=g+d*a,t[1]=d+g*a,t[5]=o*h,t[9]=x-u*a,t[2]=-o*c,t[6]=a,t[10]=o*l}else if(e.order==="ZYX"){let u=o*h,d=o*f,g=a*h,x=a*f;t[0]=l*h,t[4]=g*c-d,t[8]=u*c+x,t[1]=l*f,t[5]=x*c+u,t[9]=d*c-g,t[2]=-c,t[6]=a*l,t[10]=o*l}else if(e.order==="YZX"){let u=o*l,d=o*c,g=a*l,x=a*c;t[0]=l*h,t[4]=x-u*f,t[8]=g*f+d,t[1]=f,t[5]=o*h,t[9]=-a*h,t[2]=-c*h,t[6]=d*f+g,t[10]=u-x*f}else if(e.order==="XZY"){let u=o*l,d=o*c,g=a*l,x=a*c;t[0]=l*h,t[4]=-f,t[8]=c*h,t[1]=u*f+x,t[5]=o*h,t[9]=d*f-g,t[2]=g*f-d,t[6]=a*h,t[10]=x*f+u}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Vp,e,Gp)}lookAt(e,t,i){let r=this.elements;return Jt.subVectors(e,t),Jt.lengthSq()===0&&(Jt.z=1),Jt.normalize(),ui.crossVectors(i,Jt),ui.lengthSq()===0&&(Math.abs(i.z)===1?Jt.x+=1e-4:Jt.z+=1e-4,Jt.normalize(),ui.crossVectors(i,Jt)),ui.normalize(),Xs.crossVectors(Jt,ui),r[0]=ui.x,r[4]=Xs.x,r[8]=Jt.x,r[1]=ui.y,r[5]=Xs.y,r[9]=Jt.y,r[2]=ui.z,r[6]=Xs.z,r[10]=Jt.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,r=t.elements,s=this.elements,o=i[0],a=i[4],l=i[8],c=i[12],h=i[1],f=i[5],u=i[9],d=i[13],g=i[2],x=i[6],p=i[10],m=i[14],v=i[3],M=i[7],y=i[11],w=i[15],E=r[0],T=r[4],_=r[8],A=r[12],P=r[1],C=r[5],I=r[9],L=r[13],H=r[2],k=r[6],O=r[10],W=r[14],J=r[3],Q=r[7],j=r[11],te=r[15];return s[0]=o*E+a*P+l*H+c*J,s[4]=o*T+a*C+l*k+c*Q,s[8]=o*_+a*I+l*O+c*j,s[12]=o*A+a*L+l*W+c*te,s[1]=h*E+f*P+u*H+d*J,s[5]=h*T+f*C+u*k+d*Q,s[9]=h*_+f*I+u*O+d*j,s[13]=h*A+f*L+u*W+d*te,s[2]=g*E+x*P+p*H+m*J,s[6]=g*T+x*C+p*k+m*Q,s[10]=g*_+x*I+p*O+m*j,s[14]=g*A+x*L+p*W+m*te,s[3]=v*E+M*P+y*H+w*J,s[7]=v*T+M*C+y*k+w*Q,s[11]=v*_+M*I+y*O+w*j,s[15]=v*A+M*L+y*W+w*te,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[4],r=e[8],s=e[12],o=e[1],a=e[5],l=e[9],c=e[13],h=e[2],f=e[6],u=e[10],d=e[14],g=e[3],x=e[7],p=e[11],m=e[15],v=l*d-c*u,M=a*d-c*f,y=a*u-l*f,w=o*d-c*h,E=o*u-l*h,T=o*f-a*h;return t*(x*v-p*M+m*y)-i*(g*v-p*w+m*E)+r*(g*M-x*w+m*T)-s*(g*y-x*E+p*T)}determinantAffine(){let e=this.elements,t=e[0],i=e[4],r=e[8],s=e[1],o=e[5],a=e[9],l=e[2],c=e[6],h=e[10];return t*(o*h-a*c)-i*(s*h-a*l)+r*(s*c-o*l)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=i),this}invert(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8],f=e[9],u=e[10],d=e[11],g=e[12],x=e[13],p=e[14],m=e[15],v=t*a-i*o,M=t*l-r*o,y=t*c-s*o,w=i*l-r*a,E=i*c-s*a,T=r*c-s*l,_=h*x-f*g,A=h*p-u*g,P=h*m-d*g,C=f*p-u*x,I=f*m-d*x,L=u*m-d*p,H=v*L-M*I+y*C+w*P-E*A+T*_;if(H===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let k=1/H;return e[0]=(a*L-l*I+c*C)*k,e[1]=(r*I-i*L-s*C)*k,e[2]=(x*T-p*E+m*w)*k,e[3]=(u*E-f*T-d*w)*k,e[4]=(l*P-o*L-c*A)*k,e[5]=(t*L-r*P+s*A)*k,e[6]=(p*y-g*T-m*M)*k,e[7]=(h*T-u*y+d*M)*k,e[8]=(o*I-a*P+c*_)*k,e[9]=(i*P-t*I-s*_)*k,e[10]=(g*E-x*y+m*v)*k,e[11]=(f*y-h*E-d*v)*k,e[12]=(a*A-o*C-l*_)*k,e[13]=(t*C-i*A+r*_)*k,e[14]=(x*M-g*w-p*v)*k,e[15]=(h*w-f*M+u*v)*k,this}scale(e){let t=this.elements,i=e.x,r=e.y,s=e.z;return t[0]*=i,t[4]*=r,t[8]*=s,t[1]*=i,t[5]*=r,t[9]*=s,t[2]*=i,t[6]*=r,t[10]*=s,t[3]*=i,t[7]*=r,t[11]*=s,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,r))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let i=Math.cos(t),r=Math.sin(t),s=1-i,o=e.x,a=e.y,l=e.z,c=s*o,h=s*a;return this.set(c*o+i,c*a-r*l,c*l+r*a,0,c*a+r*l,h*a+i,h*l-r*o,0,c*l-r*a,h*l+r*o,s*l*l+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,r,s,o){return this.set(1,i,s,0,e,1,o,0,t,r,1,0,0,0,0,1),this}compose(e,t,i){let r=this.elements,s=t._x,o=t._y,a=t._z,l=t._w,c=s+s,h=o+o,f=a+a,u=s*c,d=s*h,g=s*f,x=o*h,p=o*f,m=a*f,v=l*c,M=l*h,y=l*f,w=i.x,E=i.y,T=i.z;return r[0]=(1-(x+m))*w,r[1]=(d+y)*w,r[2]=(g-M)*w,r[3]=0,r[4]=(d-y)*E,r[5]=(1-(u+m))*E,r[6]=(p+v)*E,r[7]=0,r[8]=(g+M)*T,r[9]=(p-v)*T,r[10]=(1-(u+x))*T,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,i){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let s=this.determinantAffine();if(s===0)return i.set(1,1,1),t.identity(),this;let o=or.set(r[0],r[1],r[2]).length(),a=or.set(r[4],r[5],r[6]).length(),l=or.set(r[8],r[9],r[10]).length();s<0&&(o=-o),gn.copy(this);let c=1/o,h=1/a,f=1/l;return gn.elements[0]*=c,gn.elements[1]*=c,gn.elements[2]*=c,gn.elements[4]*=h,gn.elements[5]*=h,gn.elements[6]*=h,gn.elements[8]*=f,gn.elements[9]*=f,gn.elements[10]*=f,t.setFromRotationMatrix(gn),i.x=o,i.y=a,i.z=l,this}makePerspective(e,t,i,r,s,o,a=bn,l=!1){let c=this.elements,h=2*s/(t-e),f=2*s/(i-r),u=(t+e)/(t-e),d=(i+r)/(i-r),g,x;if(l)g=s/(o-s),x=o*s/(o-s);else if(a===bn)g=-(o+s)/(o-s),x=-2*o*s/(o-s);else if(a===xr)g=-o/(o-s),x=-o*s/(o-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=f,c[9]=d,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=x,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,i,r,s,o,a=bn,l=!1){let c=this.elements,h=2/(t-e),f=2/(i-r),u=-(t+e)/(t-e),d=-(i+r)/(i-r),g,x;if(l)g=1/(o-s),x=o/(o-s);else if(a===bn)g=-2/(o-s),x=-(o+s)/(o-s);else if(a===xr)g=-1/(o-s),x=-s/(o-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=0,c[12]=u,c[1]=0,c[5]=f,c[9]=0,c[13]=d,c[2]=0,c[6]=0,c[10]=g,c[14]=x,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,i=e.elements;for(let r=0;r<16;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}},or=new V,gn=new at,Vp=new V(0,0,0),Gp=new V(1,1,1),ui=new V,Xs=new V,Jt=new V,Zu=new at,Ku=new Un,ti=class n{constructor(e=0,t=0,i=0,r=n.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,r=this._order){return this._x=e,this._y=t,this._z=i,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){let r=e.elements,s=r[0],o=r[4],a=r[8],l=r[1],c=r[5],h=r[9],f=r[2],u=r[6],d=r[10];switch(t){case"XYZ":this._y=Math.asin(Ge(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,d),this._z=Math.atan2(-o,s)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Ge(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,d),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-f,s),this._z=0);break;case"ZXY":this._x=Math.asin(Ge(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-f,d),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-Ge(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(u,d),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(Ge(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-f,s)):(this._x=0,this._y=Math.atan2(a,d));break;case"XZY":this._z=Math.asin(-Ge(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(a,s)):(this._x=Math.atan2(-h,d),this._y=0);break;default:Te("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return Zu.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Zu,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Ku.setFromEuler(this),this.setFromQuaternion(Ku,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};ti.DEFAULT_ORDER="XYZ";var es=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},Hp=0,Ju=new V,ar=new Un,jn=new at,Ys=new V,Xr=new V,Wp=new V,qp=new Un,Qu=new V(1,0,0),eh=new V(0,1,0),th=new V(0,0,1),nh={type:"added"},Xp={type:"removed"},lr={type:"childadded",child:null},wl={type:"childremoved",child:null},Pt=class n extends Fn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Hp++}),this.uuid=_s(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=n.DEFAULT_UP.clone();let e=new V,t=new ti,i=new Un,r=new V(1,1,1);function s(){i.setFromEuler(t,!1)}function o(){t.setFromQuaternion(i,void 0,!1)}t._onChange(s),i._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new at},normalMatrix:{value:new Le}}),this.matrix=new at,this.matrixWorld=new at,this.matrixAutoUpdate=n.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=n.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new es,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return ar.setFromAxisAngle(e,t),this.quaternion.multiply(ar),this}rotateOnWorldAxis(e,t){return ar.setFromAxisAngle(e,t),this.quaternion.premultiply(ar),this}rotateX(e){return this.rotateOnAxis(Qu,e)}rotateY(e){return this.rotateOnAxis(eh,e)}rotateZ(e){return this.rotateOnAxis(th,e)}translateOnAxis(e,t){return Ju.copy(e).applyQuaternion(this.quaternion),this.position.add(Ju.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Qu,e)}translateY(e){return this.translateOnAxis(eh,e)}translateZ(e){return this.translateOnAxis(th,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(jn.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?Ys.copy(e):Ys.set(e,t,i);let r=this.parent;this.updateWorldMatrix(!0,!1),Xr.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?jn.lookAt(Xr,Ys,this.up):jn.lookAt(Ys,Xr,this.up),this.quaternion.setFromRotationMatrix(jn),r&&(jn.extractRotation(r.matrixWorld),ar.setFromRotationMatrix(jn),this.quaternion.premultiply(ar.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Re("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(nh),lr.child=e,this.dispatchEvent(lr),lr.child=null):Re("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Xp),wl.child=e,this.dispatchEvent(wl),wl.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),jn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),jn.multiply(e.parent.matrixWorld)),e.applyMatrix4(jn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(nh),lr.child=e,this.dispatchEvent(lr),lr.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,r=this.children.length;i<r;i++){let o=this.children[i].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);let r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Xr,e,Wp),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Xr,qp,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,i=e.y,r=e.z,s=this.matrix.elements;s[12]+=t-s[0]*t-s[4]*i-s[8]*r,s[13]+=i-s[1]*t-s[5]*i-s[9]*r,s[14]+=r-s[2]*t-s[6]*i-s[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].updateMatrixWorld(e)}updateWorldMatrix(e,t,i=!1){let r=this.parent;if(e===!0&&r!==null&&r.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),t===!0){let s=this.children;for(let o=0,a=s.length;o<a;o++)s[o].updateWorldMatrix(!1,!0,i)}}toJSON(e){let t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),this.static!==!1&&(r.static=this.static),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(a=>({...a})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function s(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let f=l[c];s(e.shapes,f)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(s(e.materials,this.material[l]));r.material=a}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let a=0;a<this.children.length;a++)r.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];r.animations.push(s(e.animations,l))}}if(t){let a=o(e.geometries),l=o(e.materials),c=o(e.textures),h=o(e.images),f=o(e.shapes),u=o(e.skeletons),d=o(e.animations),g=o(e.nodes);a.length>0&&(i.geometries=a),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),h.length>0&&(i.images=h),f.length>0&&(i.shapes=f),u.length>0&&(i.skeletons=u),d.length>0&&(i.animations=d),g.length>0&&(i.nodes=g)}return i.object=r,i;function o(a){let l=[];for(let c in a){let h=a[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){let r=e.children[i];this.add(r.clone())}return this}};Pt.DEFAULT_UP=new V(0,1,0);Pt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Pt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var _n=class extends Pt{constructor(){super(),this.isGroup=!0,this.type="Group"}},Yp={type:"move"},vr=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new _n,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new _n,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new V,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new V),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new _n,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new V,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new V,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let r=null,s=null,o=null,a=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){o=!0;for(let x of e.hand.values()){let p=t.getJointPose(x,i),m=this._getHandJoint(c,x);p!==null&&(m.matrix.fromArray(p.transform.matrix),m.matrix.decompose(m.position,m.rotation,m.scale),m.matrixWorldNeedsUpdate=!0,m.jointRadius=p.radius),m.visible=p!==null}let h=c.joints["index-finger-tip"],f=c.joints["thumb-tip"],u=h.position.distanceTo(f.position),d=.02,g=.005;c.inputState.pinching&&u>d+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&u<=d-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,i),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));a!==null&&(r=t.getPose(e.targetRaySpace,i),r===null&&s!==null&&(r=s),r!==null&&(a.matrix.fromArray(r.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,r.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(r.linearVelocity)):a.hasLinearVelocity=!1,r.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(r.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(Yp)))}return a!==null&&(a.visible=r!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let i=new _n;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}},jh={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},hi={h:0,s:0,l:0},js={h:0,s:0,l:0};function El(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}var Ue=class{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){let r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=en){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Ve.colorSpaceToWorking(this,t),this}setRGB(e,t,i,r=Ve.workingColorSpace){return this.r=e,this.g=t,this.b=i,Ve.colorSpaceToWorking(this,r),this}setHSL(e,t,i,r=Ve.workingColorSpace){if(e=Up(e,1),t=Ge(t,0,1),i=Ge(i,0,1),t===0)this.r=this.g=this.b=i;else{let s=i<=.5?i*(1+t):i+t-i*t,o=2*i-s;this.r=El(o,s,e+1/3),this.g=El(o,s,e),this.b=El(o,s,e-1/3)}return Ve.colorSpaceToWorking(this,r),this}setStyle(e,t=en){function i(s){s!==void 0&&parseFloat(s)<1&&Te("Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s,o=r[1],a=r[2];switch(o){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:Te("Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let s=r[1],o=s.length;if(o===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(s,16),t);Te("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=en){let i=jh[e.toLowerCase()];return i!==void 0?this.setHex(i,t):Te("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Qn(e.r),this.g=Qn(e.g),this.b=Qn(e.b),this}copyLinearToSRGB(e){return this.r=yr(e.r),this.g=yr(e.g),this.b=yr(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=en){return Ve.workingToColorSpace(Bt.copy(this),e),Math.round(Ge(Bt.r*255,0,255))*65536+Math.round(Ge(Bt.g*255,0,255))*256+Math.round(Ge(Bt.b*255,0,255))}getHexString(e=en){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Ve.workingColorSpace){Ve.workingToColorSpace(Bt.copy(this),t);let i=Bt.r,r=Bt.g,s=Bt.b,o=Math.max(i,r,s),a=Math.min(i,r,s),l,c,h=(a+o)/2;if(a===o)l=0,c=0;else{let f=o-a;switch(c=h<=.5?f/(o+a):f/(2-o-a),o){case i:l=(r-s)/f+(r<s?6:0);break;case r:l=(s-i)/f+2;break;case s:l=(i-r)/f+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=Ve.workingColorSpace){return Ve.workingToColorSpace(Bt.copy(this),t),e.r=Bt.r,e.g=Bt.g,e.b=Bt.b,e}getStyle(e=en){Ve.workingToColorSpace(Bt.copy(this),e);let t=Bt.r,i=Bt.g,r=Bt.b;return e!==en?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(r*255)})`}offsetHSL(e,t,i){return this.getHSL(hi),this.setHSL(hi.h+e,hi.s+t,hi.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(hi),e.getHSL(js);let i=bl(hi.h,js.h,t),r=bl(hi.s,js.s,t),s=bl(hi.l,js.l,t);return this.setHSL(i,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,i=this.g,r=this.b,s=e.elements;return this.r=s[0]*t+s[3]*i+s[6]*r,this.g=s[1]*t+s[4]*i+s[7]*r,this.b=s[2]*t+s[5]*i+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Bt=new Ue;Ue.NAMES=jh;var ts=class extends Pt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new ti,this.environmentIntensity=1,this.environmentRotation=new ti,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}},yn=new V,$n=new V,Al=new V,Zn=new V,cr=new V,ur=new V,ih=new V,Tl=new V,Rl=new V,Cl=new V,Pl=new st,Ll=new st,Il=new st,gi=class n{constructor(e=new V,t=new V,i=new V){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,r){r.subVectors(i,t),yn.subVectors(e,t),r.cross(yn);let s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(e,t,i,r,s){yn.subVectors(r,t),$n.subVectors(i,t),Al.subVectors(e,t);let o=yn.dot(yn),a=yn.dot($n),l=yn.dot(Al),c=$n.dot($n),h=$n.dot(Al),f=o*c-a*a;if(f===0)return s.set(0,0,0),null;let u=1/f,d=(c*l-a*h)*u,g=(o*h-a*l)*u;return s.set(1-d-g,g,d)}static containsPoint(e,t,i,r){return this.getBarycoord(e,t,i,r,Zn)===null?!1:Zn.x>=0&&Zn.y>=0&&Zn.x+Zn.y<=1}static getInterpolation(e,t,i,r,s,o,a,l){return this.getBarycoord(e,t,i,r,Zn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,Zn.x),l.addScaledVector(o,Zn.y),l.addScaledVector(a,Zn.z),l)}static getInterpolatedAttribute(e,t,i,r,s,o){return Pl.setScalar(0),Ll.setScalar(0),Il.setScalar(0),Pl.fromBufferAttribute(e,t),Ll.fromBufferAttribute(e,i),Il.fromBufferAttribute(e,r),o.setScalar(0),o.addScaledVector(Pl,s.x),o.addScaledVector(Ll,s.y),o.addScaledVector(Il,s.z),o}static isFrontFacing(e,t,i,r){return yn.subVectors(i,t),$n.subVectors(e,t),yn.cross($n).dot(r)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,r){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,i,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return yn.subVectors(this.c,this.b),$n.subVectors(this.a,this.b),yn.cross($n).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return n.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return n.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,r,s){return n.getInterpolation(e,this.a,this.b,this.c,t,i,r,s)}containsPoint(e){return n.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return n.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let i=this.a,r=this.b,s=this.c,o,a;cr.subVectors(r,i),ur.subVectors(s,i),Tl.subVectors(e,i);let l=cr.dot(Tl),c=ur.dot(Tl);if(l<=0&&c<=0)return t.copy(i);Rl.subVectors(e,r);let h=cr.dot(Rl),f=ur.dot(Rl);if(h>=0&&f<=h)return t.copy(r);let u=l*f-h*c;if(u<=0&&l>=0&&h<=0)return o=l/(l-h),t.copy(i).addScaledVector(cr,o);Cl.subVectors(e,s);let d=cr.dot(Cl),g=ur.dot(Cl);if(g>=0&&d<=g)return t.copy(s);let x=d*c-l*g;if(x<=0&&c>=0&&g<=0)return a=c/(c-g),t.copy(i).addScaledVector(ur,a);let p=h*g-d*f;if(p<=0&&f-h>=0&&d-g>=0)return ih.subVectors(s,r),a=(f-h)/(f-h+(d-g)),t.copy(r).addScaledVector(ih,a);let m=1/(p+x+u);return o=x*m,a=u*m,t.copy(i).addScaledVector(cr,o).addScaledVector(ur,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},xi=class{constructor(e=new V(1/0,1/0,1/0),t=new V(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(xn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(xn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let i=xn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let i=e.geometry;if(i!==void 0){let s=i.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=s.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,xn):xn.fromBufferAttribute(s,o),xn.applyMatrix4(e.matrixWorld),this.expandByPoint(xn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),$s.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),$s.copy(i.boundingBox)),$s.applyMatrix4(e.matrixWorld),this.union($s)}let r=e.children;for(let s=0,o=r.length;s<o;s++)this.expandByObject(r[s],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,xn),xn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Yr),Zs.subVectors(this.max,Yr),hr.subVectors(e.a,Yr),dr.subVectors(e.b,Yr),fr.subVectors(e.c,Yr),di.subVectors(dr,hr),fi.subVectors(fr,dr),Di.subVectors(hr,fr);let t=[0,-di.z,di.y,0,-fi.z,fi.y,0,-Di.z,Di.y,di.z,0,-di.x,fi.z,0,-fi.x,Di.z,0,-Di.x,-di.y,di.x,0,-fi.y,fi.x,0,-Di.y,Di.x,0];return!kl(t,hr,dr,fr,Zs)||(t=[1,0,0,0,1,0,0,0,1],!kl(t,hr,dr,fr,Zs))?!1:(Ks.crossVectors(di,fi),t=[Ks.x,Ks.y,Ks.z],kl(t,hr,dr,fr,Zs))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,xn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(xn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Kn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Kn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Kn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Kn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Kn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Kn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Kn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Kn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Kn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},Kn=[new V,new V,new V,new V,new V,new V,new V,new V],xn=new V,$s=new xi,hr=new V,dr=new V,fr=new V,di=new V,fi=new V,Di=new V,Yr=new V,Zs=new V,Ks=new V,Fi=new V;function kl(n,e,t,i,r){for(let s=0,o=n.length-3;s<=o;s+=3){Fi.fromArray(n,s);let a=r.x*Math.abs(Fi.x)+r.y*Math.abs(Fi.y)+r.z*Math.abs(Fi.z),l=e.dot(Fi),c=t.dot(Fi),h=i.dot(Fi);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}var bt=new V,Js=new Be,jp=0,rt=class extends Fn{constructor(e,t,i=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:jp++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=Yl,this.updateRanges=[],this.gpuType=Sn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let r=0,s=this.itemSize;r<s;r++)this.array[e+r]=t.array[i+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)Js.fromBufferAttribute(this,t),Js.applyMatrix3(e),this.setXY(t,Js.x,Js.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)bt.fromBufferAttribute(this,t),bt.applyMatrix3(e),this.setXYZ(t,bt.x,bt.y,bt.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)bt.fromBufferAttribute(this,t),bt.applyMatrix4(e),this.setXYZ(t,bt.x,bt.y,bt.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)bt.fromBufferAttribute(this,t),bt.applyNormalMatrix(e),this.setXYZ(t,bt.x,bt.y,bt.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)bt.fromBufferAttribute(this,t),bt.transformDirection(e),this.setXYZ(t,bt.x,bt.y,bt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=qr(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=Yt(i,this.array)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=qr(t,this.array)),t}setX(e,t){return this.normalized&&(t=Yt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=qr(t,this.array)),t}setY(e,t){return this.normalized&&(t=Yt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=qr(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Yt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=qr(t,this.array)),t}setW(e,t){return this.normalized&&(t=Yt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=Yt(t,this.array),i=Yt(i,this.array)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,r){return e*=this.itemSize,this.normalized&&(t=Yt(t,this.array),i=Yt(i,this.array),r=Yt(r,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this}setXYZW(e,t,i,r,s){return e*=this.itemSize,this.normalized&&(t=Yt(t,this.array),i=Yt(i,this.array),r=Yt(r,this.array),s=Yt(s,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Yl&&(e.usage=this.usage),e}dispose(){this.dispatchEvent({type:"dispose"})}};var Wi=class extends rt{constructor(e,t,i){super(new Uint16Array(e),t,i)}};var qi=class extends rt{constructor(e,t,i){super(new Uint32Array(e),t,i)}};var Vt=class extends rt{constructor(e,t,i){super(new Float32Array(e),t,i)}},$p=new xi,jr=new V,Nl=new V,Mr=class{constructor(e=new V,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let i=this.center;t!==void 0?i.copy(t):$p.setFromPoints(e).getCenter(i);let r=0;for(let s=0,o=e.length;s<o;s++)r=Math.max(r,i.distanceToSquared(e[s]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;jr.subVectors(e,this.center);let t=jr.lengthSq();if(t>this.radius*this.radius){let i=Math.sqrt(t),r=(i-this.radius)*.5;this.center.addScaledVector(jr,r/i),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Nl.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(jr.copy(e.center).add(Nl)),this.expandByPoint(jr.copy(e.center).sub(Nl))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},Zp=0,an=new at,Dl=new Pt,pr=new V,Qt=new xi,$r=new xi,Rt=new V,Dt=class n extends Fn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Zp++}),this.uuid=_s(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Dp(e)?qi:Wi)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let s=new Le().getNormalMatrix(e);i.applyNormalMatrix(s),i.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return an.makeRotationFromQuaternion(e),this.applyMatrix4(an),this}rotateX(e){return an.makeRotationX(e),this.applyMatrix4(an),this}rotateY(e){return an.makeRotationY(e),this.applyMatrix4(an),this}rotateZ(e){return an.makeRotationZ(e),this.applyMatrix4(an),this}translate(e,t,i){return an.makeTranslation(e,t,i),this.applyMatrix4(an),this}scale(e,t,i){return an.makeScale(e,t,i),this.applyMatrix4(an),this}lookAt(e){return Dl.lookAt(e),Dl.updateMatrix(),this.applyMatrix4(Dl.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(pr).negate(),this.translate(pr.x,pr.y,pr.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let i=[];for(let r=0,s=e.length;r<s;r++){let o=e[r];i.push(o.x,o.y,o.z||0)}this.setAttribute("position",new Vt(i,3))}else{let i=Math.min(e.length,t.count);for(let r=0;r<i;r++){let s=e[r];t.setXYZ(r,s.x,s.y,s.z||0)}e.length>t.count&&Te("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new xi);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Re("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new V(-1/0,-1/0,-1/0),new V(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,r=t.length;i<r;i++){let s=t[i];Qt.setFromBufferAttribute(s),this.morphTargetsRelative?(Rt.addVectors(this.boundingBox.min,Qt.min),this.boundingBox.expandByPoint(Rt),Rt.addVectors(this.boundingBox.max,Qt.max),this.boundingBox.expandByPoint(Rt)):(this.boundingBox.expandByPoint(Qt.min),this.boundingBox.expandByPoint(Qt.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Re('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Mr);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Re("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new V,1/0);return}if(e){let i=this.boundingSphere.center;if(Qt.setFromBufferAttribute(e),t)for(let s=0,o=t.length;s<o;s++){let a=t[s];$r.setFromBufferAttribute(a),this.morphTargetsRelative?(Rt.addVectors(Qt.min,$r.min),Qt.expandByPoint(Rt),Rt.addVectors(Qt.max,$r.max),Qt.expandByPoint(Rt)):(Qt.expandByPoint($r.min),Qt.expandByPoint($r.max))}Qt.getCenter(i);let r=0;for(let s=0,o=e.count;s<o;s++)Rt.fromBufferAttribute(e,s),r=Math.max(r,i.distanceToSquared(Rt));if(t)for(let s=0,o=t.length;s<o;s++){let a=t[s],l=this.morphTargetsRelative;for(let c=0,h=a.count;c<h;c++)Rt.fromBufferAttribute(a,c),l&&(pr.fromBufferAttribute(e,c),Rt.add(pr)),r=Math.max(r,i.distanceToSquared(Rt))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&Re('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Re("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=t.position,r=t.normal,s=t.uv,o=this.getAttribute("tangent");(o===void 0||o.count!==i.count)&&(o=new rt(new Float32Array(4*i.count),4),this.setAttribute("tangent",o));let a=[],l=[];for(let _=0;_<i.count;_++)a[_]=new V,l[_]=new V;let c=new V,h=new V,f=new V,u=new Be,d=new Be,g=new Be,x=new V,p=new V;function m(_,A,P){c.fromBufferAttribute(i,_),h.fromBufferAttribute(i,A),f.fromBufferAttribute(i,P),u.fromBufferAttribute(s,_),d.fromBufferAttribute(s,A),g.fromBufferAttribute(s,P),h.sub(c),f.sub(c),d.sub(u),g.sub(u);let C=1/(d.x*g.y-g.x*d.y);isFinite(C)&&(x.copy(h).multiplyScalar(g.y).addScaledVector(f,-d.y).multiplyScalar(C),p.copy(f).multiplyScalar(d.x).addScaledVector(h,-g.x).multiplyScalar(C),a[_].add(x),a[A].add(x),a[P].add(x),l[_].add(p),l[A].add(p),l[P].add(p))}let v=this.groups;v.length===0&&(v=[{start:0,count:e.count}]);for(let _=0,A=v.length;_<A;++_){let P=v[_],C=P.start,I=P.count;for(let L=C,H=C+I;L<H;L+=3)m(e.getX(L+0),e.getX(L+1),e.getX(L+2))}let M=new V,y=new V,w=new V,E=new V;function T(_){w.fromBufferAttribute(r,_),E.copy(w);let A=a[_];M.copy(A),M.sub(w.multiplyScalar(w.dot(A))).normalize(),y.crossVectors(E,A);let C=y.dot(l[_])<0?-1:1;o.setXYZW(_,M.x,M.y,M.z,C)}for(let _=0,A=v.length;_<A;++_){let P=v[_],C=P.start,I=P.count;for(let L=C,H=C+I;L<H;L+=3)T(e.getX(L+0)),T(e.getX(L+1)),T(e.getX(L+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==t.count)i=new rt(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let u=0,d=i.count;u<d;u++)i.setXYZ(u,0,0,0);let r=new V,s=new V,o=new V,a=new V,l=new V,c=new V,h=new V,f=new V;if(e)for(let u=0,d=e.count;u<d;u+=3){let g=e.getX(u+0),x=e.getX(u+1),p=e.getX(u+2);r.fromBufferAttribute(t,g),s.fromBufferAttribute(t,x),o.fromBufferAttribute(t,p),h.subVectors(o,s),f.subVectors(r,s),h.cross(f),a.fromBufferAttribute(i,g),l.fromBufferAttribute(i,x),c.fromBufferAttribute(i,p),a.add(h),l.add(h),c.add(h),i.setXYZ(g,a.x,a.y,a.z),i.setXYZ(x,l.x,l.y,l.z),i.setXYZ(p,c.x,c.y,c.z)}else for(let u=0,d=t.count;u<d;u+=3)r.fromBufferAttribute(t,u+0),s.fromBufferAttribute(t,u+1),o.fromBufferAttribute(t,u+2),h.subVectors(o,s),f.subVectors(r,s),h.cross(f),i.setXYZ(u+0,h.x,h.y,h.z),i.setXYZ(u+1,h.x,h.y,h.z),i.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)Rt.fromBufferAttribute(e,t),Rt.normalize(),e.setXYZ(t,Rt.x,Rt.y,Rt.z)}toNonIndexed(){function e(a,l){let c=a.array,h=a.itemSize,f=a.normalized,u=new c.constructor(l.length*h),d=0,g=0;for(let x=0,p=l.length;x<p;x++){a.isInterleavedBufferAttribute?d=l[x]*a.data.stride+a.offset:d=l[x]*h;for(let m=0;m<h;m++)u[g++]=c[d++]}return new rt(u,h,f)}if(this.index===null)return Te("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new n,i=this.index.array,r=this.attributes;for(let a in r){let l=r[a],c=e(l,i);t.setAttribute(a,c)}let s=this.morphAttributes;for(let a in s){let l=[],c=s[a];for(let h=0,f=c.length;h<f;h++){let u=c[h],d=e(u,i);l.push(d)}t.morphAttributes[a]=l}t.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let c=o[a];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let i=this.attributes;for(let l in i){let c=i[l];e.data.attributes[l]=c.toJSON(e.data)}let r={},s=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let f=0,u=c.length;f<u;f++){let d=c[f];h.push(d.toJSON(e.data))}h.length>0&&(r[l]=h,s=!0)}s&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(e.data.boundingSphere=a.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let i=e.index;i!==null&&this.setIndex(i.clone());let r=e.attributes;for(let c in r){let h=r[c];this.setAttribute(c,h.clone(t))}let s=e.morphAttributes;for(let c in s){let h=[],f=s[c];for(let u=0,d=f.length;u<d;u++)h.push(f[u].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;let o=e.groups;for(let c=0,h=o.length;c<h;c++){let f=o[c];this.addGroup(f.start,f.count,f.materialIndex)}let a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Kp=0,bi=class extends Fn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Kp++}),this.uuid=_s(),this.name="",this.type="Material",this.blending=Vi,this.side=ei,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=po,this.blendDst=mo,this.blendEquation=yi,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ue(0,0,0),this.blendAlpha=0,this.depthFunc=Gi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Xl,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Bi,this.stencilZFail=Bi,this.stencilZPass=Bi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let i=e[t];if(i===void 0){Te(`Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){Te(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(i):r&&r.isVector2&&i&&i.isVector2||r&&r.isEuler&&i&&i.isEuler||r&&r.isVector3&&i&&i.isVector3?r.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Vi&&(i.blending=this.blending),this.side!==ei&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==po&&(i.blendSrc=this.blendSrc),this.blendDst!==mo&&(i.blendDst=this.blendDst),this.blendEquation!==yi&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==Gi&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Xl&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Bi&&(i.stencilFail=this.stencilFail),this.stencilZFail!==Bi&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==Bi&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.allowOverride===!1&&(i.allowOverride=!1),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function r(s){let o=[];for(let a in s){let l=s[a];delete l.metadata,o.push(l)}return o}if(t){let s=r(e.textures),o=r(e.images);s.length>0&&(i.textures=s),o.length>0&&(i.images=o)}return i}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Ue().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let i=e.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new Be().fromArray(i)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Be().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,i=null;if(t!==null){let r=t.length;i=new Array(r);for(let s=0;s!==r;++s)i[s]=t[s].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}};var Jn=new V,Fl=new V,Qs=new V,pi=new V,Ul=new V,eo=new V,Ol=new V,Po=class{constructor(e=new V,t=new V(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Jn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Jn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Jn.copy(this.origin).addScaledVector(this.direction,t),Jn.distanceToSquared(e))}distanceSqToSegment(e,t,i,r){Fl.copy(e).add(t).multiplyScalar(.5),Qs.copy(t).sub(e).normalize(),pi.copy(this.origin).sub(Fl);let s=e.distanceTo(t)*.5,o=-this.direction.dot(Qs),a=pi.dot(this.direction),l=-pi.dot(Qs),c=pi.lengthSq(),h=Math.abs(1-o*o),f,u,d,g;if(h>0)if(f=o*l-a,u=o*a-l,g=s*h,f>=0)if(u>=-g)if(u<=g){let x=1/h;f*=x,u*=x,d=f*(f+o*u+2*a)+u*(o*f+u+2*l)+c}else u=s,f=Math.max(0,-(o*u+a)),d=-f*f+u*(u+2*l)+c;else u=-s,f=Math.max(0,-(o*u+a)),d=-f*f+u*(u+2*l)+c;else u<=-g?(f=Math.max(0,-(-o*s+a)),u=f>0?-s:Math.min(Math.max(-s,-l),s),d=-f*f+u*(u+2*l)+c):u<=g?(f=0,u=Math.min(Math.max(-s,-l),s),d=u*(u+2*l)+c):(f=Math.max(0,-(o*s+a)),u=f>0?s:Math.min(Math.max(-s,-l),s),d=-f*f+u*(u+2*l)+c);else u=o>0?-s:s,f=Math.max(0,-(o*u+a)),d=-f*f+u*(u+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,f),r&&r.copy(Fl).addScaledVector(Qs,u),d}intersectSphere(e,t){Jn.subVectors(e.center,this.origin);let i=Jn.dot(this.direction),r=Jn.dot(Jn)-i*i,s=e.radius*e.radius;if(r>s)return null;let o=Math.sqrt(s-r),a=i-o,l=i+o;return l<0?null:a<0?this.at(l,t):this.at(a,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){let i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,r,s,o,a,l,c=1/this.direction.x,h=1/this.direction.y,f=1/this.direction.z,u=this.origin;return c>=0?(i=(e.min.x-u.x)*c,r=(e.max.x-u.x)*c):(i=(e.max.x-u.x)*c,r=(e.min.x-u.x)*c),h>=0?(s=(e.min.y-u.y)*h,o=(e.max.y-u.y)*h):(s=(e.max.y-u.y)*h,o=(e.min.y-u.y)*h),i>o||s>r||((s>i||isNaN(i))&&(i=s),(o<r||isNaN(r))&&(r=o),f>=0?(a=(e.min.z-u.z)*f,l=(e.max.z-u.z)*f):(a=(e.max.z-u.z)*f,l=(e.min.z-u.z)*f),i>l||a>r)||((a>i||i!==i)&&(i=a),(l<r||r!==r)&&(r=l),r<0)?null:this.at(i>=0?i:r,t)}intersectsBox(e){return this.intersectBox(e,Jn)!==null}intersectTriangle(e,t,i,r,s){Ul.subVectors(t,e),eo.subVectors(i,e),Ol.crossVectors(Ul,eo);let o=this.direction.dot(Ol),a;if(o>0){if(r)return null;a=1}else if(o<0)a=-1,o=-o;else return null;pi.subVectors(this.origin,e);let l=a*this.direction.dot(eo.crossVectors(pi,eo));if(l<0)return null;let c=a*this.direction.dot(Ul.cross(pi));if(c<0||l+c>o)return null;let h=-a*pi.dot(Ol);return h<0?null:this.at(h/o,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Xi=class extends bi{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Ue(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ti,this.combine=jo,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},rh=new at,Ui=new Po,to=new Mr,sh=new V,no=new V,io=new V,ro=new V,Bl=new V,so=new V,oh=new V,oo=new V,lt=class extends Pt{constructor(e=new Dt,t=new Xi){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){let a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}getVertexPosition(e,t){let i=this.geometry,r=i.attributes.position,s=i.morphAttributes.position,o=i.morphTargetsRelative;t.fromBufferAttribute(r,e);let a=this.morphTargetInfluences;if(s&&a){so.set(0,0,0);for(let l=0,c=s.length;l<c;l++){let h=a[l],f=s[l];h!==0&&(Bl.fromBufferAttribute(f,e),o?so.addScaledVector(Bl,h):so.addScaledVector(Bl.sub(t),h))}t.add(so)}return t}raycast(e,t){let i=this.geometry,r=this.material,s=this.matrixWorld;r!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),to.copy(i.boundingSphere),to.applyMatrix4(s),Ui.copy(e.ray).recast(e.near),!(to.containsPoint(Ui.origin)===!1&&(Ui.intersectSphere(to,sh)===null||Ui.origin.distanceToSquared(sh)>(e.far-e.near)**2))&&(rh.copy(s).invert(),Ui.copy(e.ray).applyMatrix4(rh),!(i.boundingBox!==null&&Ui.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,Ui)))}_computeIntersections(e,t,i){let r,s=this.geometry,o=this.material,a=s.index,l=s.attributes.position,c=s.attributes.uv,h=s.attributes.uv1,f=s.attributes.normal,u=s.groups,d=s.drawRange;if(a!==null)if(Array.isArray(o))for(let g=0,x=u.length;g<x;g++){let p=u[g],m=o[p.materialIndex],v=Math.max(p.start,d.start),M=Math.min(a.count,Math.min(p.start+p.count,d.start+d.count));for(let y=v,w=M;y<w;y+=3){let E=a.getX(y),T=a.getX(y+1),_=a.getX(y+2);r=ao(this,m,e,i,c,h,f,E,T,_),r&&(r.faceIndex=Math.floor(y/3),r.face.materialIndex=p.materialIndex,t.push(r))}}else{let g=Math.max(0,d.start),x=Math.min(a.count,d.start+d.count);for(let p=g,m=x;p<m;p+=3){let v=a.getX(p),M=a.getX(p+1),y=a.getX(p+2);r=ao(this,o,e,i,c,h,f,v,M,y),r&&(r.faceIndex=Math.floor(p/3),t.push(r))}}else if(l!==void 0)if(Array.isArray(o))for(let g=0,x=u.length;g<x;g++){let p=u[g],m=o[p.materialIndex],v=Math.max(p.start,d.start),M=Math.min(l.count,Math.min(p.start+p.count,d.start+d.count));for(let y=v,w=M;y<w;y+=3){let E=y,T=y+1,_=y+2;r=ao(this,m,e,i,c,h,f,E,T,_),r&&(r.faceIndex=Math.floor(y/3),r.face.materialIndex=p.materialIndex,t.push(r))}}else{let g=Math.max(0,d.start),x=Math.min(l.count,d.start+d.count);for(let p=g,m=x;p<m;p+=3){let v=p,M=p+1,y=p+2;r=ao(this,o,e,i,c,h,f,v,M,y),r&&(r.faceIndex=Math.floor(p/3),t.push(r))}}}};function Jp(n,e,t,i,r,s,o,a){let l;if(e.side===Wt?l=i.intersectTriangle(o,s,r,!0,a):l=i.intersectTriangle(r,s,o,e.side===ei,a),l===null)return null;oo.copy(a),oo.applyMatrix4(n.matrixWorld);let c=t.ray.origin.distanceTo(oo);return c<t.near||c>t.far?null:{distance:c,point:oo.clone(),object:n}}function ao(n,e,t,i,r,s,o,a,l,c){n.getVertexPosition(a,no),n.getVertexPosition(l,io),n.getVertexPosition(c,ro);let h=Jp(n,e,t,i,no,io,ro,oh);if(h){let f=new V;gi.getBarycoord(oh,no,io,ro,f),r&&(h.uv=gi.getInterpolatedAttribute(r,a,l,c,f,new Be)),s&&(h.uv1=gi.getInterpolatedAttribute(s,a,l,c,f,new Be)),o&&(h.normal=gi.getInterpolatedAttribute(o,a,l,c,f,new V),h.normal.dot(i.direction)>0&&h.normal.multiplyScalar(-1));let u={a,b:l,c,normal:new V,materialIndex:0};gi.getNormal(no,io,ro,u.normal),h.face=u,h.barycoord=f}return h}var Lo=class extends Gt{constructor(e=null,t=1,i=1,r,s,o,a,l,c=Ct,h=Ct,f,u){super(null,o,a,l,c,h,r,s,f,u),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var zl=new V,Qp=new V,em=new Le,kn=class{constructor(e=new V(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,r){return this.normal.set(e,t,i),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){let r=zl.subVectors(i,t).cross(Qp.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,i=!0){let r=e.delta(zl),s=this.normal.dot(r);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let o=-(e.start.dot(this.normal)+this.constant)/s;return i===!0&&(o<0||o>1)?null:t.copy(e.start).addScaledVector(r,o)}intersectsLine(e){let t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let i=t||em.getNormalMatrix(e),r=this.coplanarPoint(zl).applyMatrix4(e),s=this.normal.applyMatrix3(i).normalize();return this.constant=-r.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},Oi=new Mr,tm=new Be(.5,.5),lo=new V,Sr=class{constructor(e=new kn,t=new kn,i=new kn,r=new kn,s=new kn,o=new kn){this.planes=[e,t,i,r,s,o]}set(e,t,i,r,s,o){let a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(i),a[3].copy(r),a[4].copy(s),a[5].copy(o),this}copy(e){let t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=bn,i=!1){let r=this.planes,s=e.elements,o=s[0],a=s[1],l=s[2],c=s[3],h=s[4],f=s[5],u=s[6],d=s[7],g=s[8],x=s[9],p=s[10],m=s[11],v=s[12],M=s[13],y=s[14],w=s[15];if(r[0].setComponents(c-o,d-h,m-g,w-v).normalize(),r[1].setComponents(c+o,d+h,m+g,w+v).normalize(),r[2].setComponents(c+a,d+f,m+x,w+M).normalize(),r[3].setComponents(c-a,d-f,m-x,w-M).normalize(),i)r[4].setComponents(l,u,p,y).normalize(),r[5].setComponents(c-l,d-u,m-p,w-y).normalize();else if(r[4].setComponents(c-l,d-u,m-p,w-y).normalize(),t===bn)r[5].setComponents(c+l,d+u,m+p,w+y).normalize();else if(t===xr)r[5].setComponents(l,u,p,y).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Oi.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Oi.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Oi)}intersectsSprite(e){Oi.center.set(0,0,0);let t=tm.distanceTo(e.center);return Oi.radius=.7071067811865476+t,Oi.applyMatrix4(e.matrixWorld),this.intersectsSphere(Oi)}intersectsSphere(e){let t=this.planes,i=e.center,r=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(i)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let i=0;i<6;i++){let r=t[i];if(lo.x=r.normal.x>0?e.max.x:e.min.x,lo.y=r.normal.y>0?e.max.y:e.min.y,lo.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(lo)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var ns=class extends Gt{constructor(e=[],t=Si,i,r,s,o,a,l,c,h){super(e,t,i,r,s,o,a,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}};var ni=class extends Gt{constructor(e,t,i=Mn,r,s,o,a=Ct,l=Ct,c,h=Dn,f=1){if(h!==Dn&&h!==wi)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let u={width:e,height:t,depth:f};super(u,r,s,o,a,l,h,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new _r(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},Io=class extends ni{constructor(e,t=Mn,i=Si,r,s,o=Ct,a=Ct,l,c=Dn){let h={width:e,height:e,depth:1},f=[h,h,h,h,h,h];super(e,e,t,i,r,s,o,a,l,c),this.image=f,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},is=class extends Gt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},wr=class n extends Dt{constructor(e=1,t=1,i=1,r=1,s=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:r,heightSegments:s,depthSegments:o};let a=this;r=Math.floor(r),s=Math.floor(s),o=Math.floor(o);let l=[],c=[],h=[],f=[],u=0,d=0;g("z","y","x",-1,-1,i,t,e,o,s,0),g("z","y","x",1,-1,i,t,-e,o,s,1),g("x","z","y",1,1,e,i,t,r,o,2),g("x","z","y",1,-1,e,i,-t,r,o,3),g("x","y","z",1,-1,e,t,i,r,s,4),g("x","y","z",-1,-1,e,t,-i,r,s,5),this.setIndex(l),this.setAttribute("position",new Vt(c,3)),this.setAttribute("normal",new Vt(h,3)),this.setAttribute("uv",new Vt(f,2));function g(x,p,m,v,M,y,w,E,T,_,A){let P=y/T,C=w/_,I=y/2,L=w/2,H=E/2,k=T+1,O=_+1,W=0,J=0,Q=new V;for(let j=0;j<O;j++){let te=j*C-L;for(let me=0;me<k;me++){let Oe=me*P-I;Q[x]=Oe*v,Q[p]=te*M,Q[m]=H,c.push(Q.x,Q.y,Q.z),Q[x]=0,Q[p]=0,Q[m]=E>0?1:-1,h.push(Q.x,Q.y,Q.z),f.push(me/T),f.push(1-j/_),W+=1}}for(let j=0;j<_;j++)for(let te=0;te<T;te++){let me=u+te+k*j,Oe=u+te+k*(j+1),et=u+(te+1)+k*(j+1),He=u+(te+1)+k*j;l.push(me,Oe,He),l.push(Oe,et,He),J+=6}a.addGroup(d,J,A),d+=J,u+=W}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};var rs=class n extends Dt{constructor(e=1,t=1,i=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:r};let s=e/2,o=t/2,a=Math.floor(i),l=Math.floor(r),c=a+1,h=l+1,f=e/a,u=t/l,d=[],g=[],x=[],p=[];for(let m=0;m<h;m++){let v=m*u-o;for(let M=0;M<c;M++){let y=M*f-s;g.push(y,-v,0),x.push(0,0,1),p.push(M/a),p.push(1-m/l)}}for(let m=0;m<l;m++)for(let v=0;v<a;v++){let M=v+c*m,y=v+c*(m+1),w=v+1+c*(m+1),E=v+1+c*m;d.push(M,y,E),d.push(y,w,E)}this.setIndex(d),this.setAttribute("position",new Vt(g,3)),this.setAttribute("normal",new Vt(x,3)),this.setAttribute("uv",new Vt(p,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.widthSegments,e.heightSegments)}};function ji(n){let e={};for(let t in n){e[t]={};for(let i in n[t]){let r=n[t][i];if(ah(r))r.isRenderTargetTexture?(Te("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=r.clone();else if(Array.isArray(r))if(ah(r[0])){let s=[];for(let o=0,a=r.length;o<a;o++)s[o]=r[o].clone();e[t][i]=s}else e[t][i]=r.slice();else e[t][i]=r}}return e}function Ht(n){let e={};for(let t=0;t<n.length;t++){let i=ji(n[t]);for(let r in i)e[r]=i[r]}return e}function ah(n){return n&&(n.isColor||n.isMatrix3||n.isMatrix4||n.isVector2||n.isVector3||n.isVector4||n.isTexture||n.isQuaternion)}function nm(n){let e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function bc(n){let e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Ve.workingColorSpace}var $h={clone:ji,merge:Ht},im=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,rm=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Ft=class extends bi{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=im,this.fragmentShader=rm,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=ji(e.uniforms),this.uniformsGroups=nm(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let r in this.uniforms){let o=this.uniforms[r].value;o&&o.isTexture?t.uniforms[r]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[r]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[r]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[r]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[r]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[r]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[r]={type:"m4",value:o.toArray()}:t.uniforms[r]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let i={};for(let r in this.extensions)this.extensions[r]===!0&&(i[r]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let i in e.uniforms){let r=e.uniforms[i];switch(this.uniforms[i]={},r.type){case"t":this.uniforms[i].value=t[r.value]||null;break;case"c":this.uniforms[i].value=new Ue().setHex(r.value);break;case"v2":this.uniforms[i].value=new Be().fromArray(r.value);break;case"v3":this.uniforms[i].value=new V().fromArray(r.value);break;case"v4":this.uniforms[i].value=new st().fromArray(r.value);break;case"m3":this.uniforms[i].value=new Le().fromArray(r.value);break;case"m4":this.uniforms[i].value=new at().fromArray(r.value);break;default:this.uniforms[i].value=r.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let i in e.extensions)this.extensions[i]=e.extensions[i];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},ko=class extends Ft{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}};var ss=class extends bi{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new Ue(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ue(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Na,this.normalScale=new Be(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ti,this.combine=jo,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},No=class extends bi{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Fh,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},Do=class extends bi{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function co(n,e){return!n||n.constructor===e?n:typeof e.BYTES_PER_ELEMENT=="number"?new e(n):Array.prototype.slice.call(n)}var _i=class{constructor(e,t,i,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r!==void 0?r:new t.constructor(i),this.sampleValues=t,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,i=this._cachedIndex,r=t[i],s=t[i-1];e:{t:{let o;n:{i:if(!(e<r)){for(let a=i+2;;){if(r===void 0){if(e<s)break i;return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===a)break;if(s=r,r=t[++i],e<r)break t}o=t.length;break n}if(!(e>=s)){let a=t[1];e<a&&(i=2,s=a);for(let l=i-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(r=s,s=t[--i-1],e>=s)break t}o=i,i=0;break n}break e}for(;i<o;){let a=i+o>>>1;e<t[a]?o=a:i=a+1}if(r=t[i],s=t[i-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,s,r)}return this.interpolate_(i,s,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,i=this.sampleValues,r=this.valueSize,s=e*r;for(let o=0;o!==r;++o)t[o]=i[s+o];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},Fo=class extends _i{constructor(e,t,i,r){super(e,t,i,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Hl,endingEnd:Hl}}intervalChanged_(e,t,i){let r=this.parameterPositions,s=e-2,o=e+1,a=r[s],l=r[o];if(a===void 0)switch(this.getSettings_().endingStart){case Wl:s=e,a=2*t-i;break;case ql:s=r.length-2,a=t+r[s]-r[s+1];break;default:s=e,a=i}if(l===void 0)switch(this.getSettings_().endingEnd){case Wl:o=e,l=2*i-t;break;case ql:o=1,l=i+r[1]-r[0];break;default:o=e-1,l=t}let c=(i-t)*.5,h=this.valueSize;this._weightPrev=c/(t-a),this._weightNext=c/(l-i),this._offsetPrev=s*h,this._offsetNext=o*h}interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=this._offsetPrev,f=this._offsetNext,u=this._weightPrev,d=this._weightNext,g=(i-t)/(r-t),x=g*g,p=x*g,m=-u*p+2*u*x-u*g,v=(1+u)*p+(-1.5-2*u)*x+(-.5+u)*g+1,M=(-1-d)*p+(1.5+d)*x+.5*g,y=d*p-d*x;for(let w=0;w!==a;++w)s[w]=m*o[h+w]+v*o[c+w]+M*o[l+w]+y*o[f+w];return s}},Uo=class extends _i{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=(i-t)/(r-t),f=1-h;for(let u=0;u!==a;++u)s[u]=o[c+u]*f+o[l+u]*h;return s}},Oo=class extends _i{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e){return this.copySampleValue_(e-1)}},Bo=class extends _i{interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=this.inTangents,f=this.outTangents;if(!h||!f){let g=(i-t)/(r-t),x=1-g;for(let p=0;p!==a;++p)s[p]=o[c+p]*x+o[l+p]*g;return s}let u=a*2,d=e-1;for(let g=0;g!==a;++g){let x=o[c+g],p=o[l+g],m=d*u+g*2,v=f[m],M=f[m+1],y=e*u+g*2,w=h[y],E=h[y+1],T=(i-t)/(r-t),_,A,P,C,I;for(let L=0;L<8;L++){_=T*T,A=_*T,P=1-T,C=P*P,I=C*P;let k=I*t+3*C*T*v+3*P*_*w+A*r-i;if(Math.abs(k)<1e-10)break;let O=3*C*(v-t)+6*P*T*(w-v)+3*_*(r-w);if(Math.abs(O)<1e-10)break;T=T-k/O,T=Math.max(0,Math.min(1,T))}s[g]=I*x+3*C*T*M+3*P*_*E+A*p}return s}},nn=class{constructor(e,t,i,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=co(t,this.TimeBufferType),this.values=co(i,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,i;if(t.toJSON!==this.toJSON)i=t.toJSON(e);else{i={name:e.name,times:co(e.times,Array),values:co(e.values,Array)};let r=e.getInterpolation();r!==e.DefaultInterpolation&&(i.interpolation=r)}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new Oo(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Uo(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Fo(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new Bo(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case Zr:t=this.InterpolantFactoryMethodDiscrete;break;case Eo:t=this.InterpolantFactoryMethodLinear;break;case fo:t=this.InterpolantFactoryMethodSmooth;break;case Gl:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return Te("KeyframeTrack:",i),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Zr;case this.InterpolantFactoryMethodLinear:return Eo;case this.InterpolantFactoryMethodSmooth:return fo;case this.InterpolantFactoryMethodBezier:return Gl}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]*=e}return this}trim(e,t){let i=this.times,r=i.length,s=0,o=r-1;for(;s!==r&&i[s]<e;)++s;for(;o!==-1&&i[o]>t;)--o;if(++o,s!==0||o!==r){s>=o&&(o=Math.max(o,1),s=o-1);let a=this.getValueSize();this.times=i.slice(s,o),this.values=this.values.slice(s*a,o*a)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(Re("KeyframeTrack: Invalid value size in track.",this),e=!1);let i=this.times,r=this.values,s=i.length;s===0&&(Re("KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==s;a++){let l=i[a];if(typeof l=="number"&&isNaN(l)){Re("KeyframeTrack: Time is not a valid number.",this,a,l),e=!1;break}if(o!==null&&o>l){Re("KeyframeTrack: Out of order keys.",this,a,l,o),e=!1;break}o=l}if(r!==void 0&&Fp(r))for(let a=0,l=r.length;a!==l;++a){let c=r[a];if(isNaN(c)){Re("KeyframeTrack: Value is not a valid number.",this,a,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),i=this.getValueSize(),r=this.getInterpolation()===fo,s=e.length-1,o=1;for(let a=1;a<s;++a){let l=!1,c=e[a],h=e[a+1];if(c!==h&&(a!==1||c!==e[0]))if(r)l=!0;else{let f=a*i,u=f-i,d=f+i;for(let g=0;g!==i;++g){let x=t[f+g];if(x!==t[u+g]||x!==t[d+g]){l=!0;break}}}if(l){if(a!==o){e[o]=e[a];let f=a*i,u=o*i;for(let d=0;d!==i;++d)t[u+d]=t[f+d]}++o}}if(s>0){e[o]=e[s];for(let a=s*i,l=o*i,c=0;c!==i;++c)t[l+c]=t[a+c];++o}return o!==e.length?(this.times=e.slice(0,o),this.values=t.slice(0,o*i)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),i=this.constructor,r=new i(this.name,e,t);return r.createInterpolant=this.createInterpolant,r}};nn.prototype.ValueTypeName="";nn.prototype.TimeBufferType=Float32Array;nn.prototype.ValueBufferType=Float32Array;nn.prototype.DefaultInterpolation=Eo;var vi=class extends nn{constructor(e,t,i){super(e,t,i)}};vi.prototype.ValueTypeName="bool";vi.prototype.ValueBufferType=Array;vi.prototype.DefaultInterpolation=Zr;vi.prototype.InterpolantFactoryMethodLinear=void 0;vi.prototype.InterpolantFactoryMethodSmooth=void 0;var zo=class extends nn{constructor(e,t,i,r){super(e,t,i,r)}};zo.prototype.ValueTypeName="color";var Vo=class extends nn{constructor(e,t,i,r){super(e,t,i,r)}};Vo.prototype.ValueTypeName="number";var Go=class extends _i{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(i-t)/(r-t),c=e*a;for(let h=c+a;c!==h;c+=4)Un.slerpFlat(s,0,o,c-a,o,c,l);return s}},os=class extends nn{constructor(e,t,i,r){super(e,t,i,r)}InterpolantFactoryMethodLinear(e){return new Go(this.times,this.values,this.getValueSize(),e)}};os.prototype.ValueTypeName="quaternion";os.prototype.InterpolantFactoryMethodSmooth=void 0;var Mi=class extends nn{constructor(e,t,i){super(e,t,i)}};Mi.prototype.ValueTypeName="string";Mi.prototype.ValueBufferType=Array;Mi.prototype.DefaultInterpolation=Zr;Mi.prototype.InterpolantFactoryMethodLinear=void 0;Mi.prototype.InterpolantFactoryMethodSmooth=void 0;var Ho=class extends nn{constructor(e,t,i,r){super(e,t,i,r)}};Ho.prototype.ValueTypeName="vector";var Wo=class{constructor(e,t,i){let r=this,s=!1,o=0,a=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=i,this._abortController=null,this.itemStart=function(h){a++,s===!1&&r.onStart!==void 0&&r.onStart(h,o,a),s=!0},this.itemEnd=function(h){o++,r.onProgress!==void 0&&r.onProgress(h,o,a),o===a&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(h){r.onError!==void 0&&r.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,f){return c.push(h,f),this},this.removeHandler=function(h){let f=c.indexOf(h);return f!==-1&&c.splice(f,2),this},this.getHandler=function(h){for(let f=0,u=c.length;f<u;f+=2){let d=c[f],g=c[f+1];if(d.global&&(d.lastIndex=0),d.test(h))return g}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Zh=new Wo,qo=class{constructor(e){this.manager=e!==void 0?e:Zh,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let i=this;return new Promise(function(r,s){i.load(e,r,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};qo.DEFAULT_MATERIAL_NAME="__DEFAULT";var as=class extends Pt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Ue(e),this.intensity=t}dispose(){this.dispatchEvent({type:"dispose"})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},ls=class extends as{constructor(e,t,i){super(e,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Pt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Ue(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},Vl=new at,lh=new V,ch=new V,jl=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Be(512,512),this.mapType=jt,this.map=null,this.mapPass=null,this.matrix=new at,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Sr,this._frameExtents=new Be(1,1),this._viewportCount=1,this._viewports=[new st(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,i=this.matrix;lh.setFromMatrixPosition(e.matrixWorld),t.position.copy(lh),ch.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(ch),t.updateMatrixWorld(),Vl.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Vl,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===xr||t.reversedDepth?i.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(Vl)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},uo=new V,ho=new Un,In=new V,cs=class extends Pt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new at,this.projectionMatrix=new at,this.projectionMatrixInverse=new at,this.coordinateSystem=bn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(uo,ho,In),In.x===1&&In.y===1&&In.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(uo,ho,In.set(1,1,1)).invert()}updateWorldMatrix(e,t,i=!1){super.updateWorldMatrix(e,t,i),this.matrixWorld.decompose(uo,ho,In),In.x===1&&In.y===1&&In.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(uo,ho,In.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},mi=new V,uh=new Be,hh=new Be,zt=class extends cs{constructor(e=50,t=1,i=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=Ao*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(xl*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Ao*2*Math.atan(Math.tan(xl*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){mi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(mi.x,mi.y).multiplyScalar(-e/mi.z),mi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(mi.x,mi.y).multiplyScalar(-e/mi.z)}getViewSize(e,t){return this.getViewBounds(e,uh,hh),t.subVectors(hh,uh)}setViewOffset(e,t,i,r,s,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(xl*.5*this.fov)/this.zoom,i=2*t,r=this.aspect*i,s=-.5*r,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,c=o.fullHeight;s+=o.offsetX*r/l,t-=o.offsetY*i/c,r*=o.width/l,i*=o.height/c}let a=this.filmOffset;a!==0&&(s+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+r,t,t-i,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}};var Er=class extends cs{constructor(e=-1,t=1,i=1,r=-1,s=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=r,this.near=s,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,r,s,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,r=(this.top+this.bottom)/2,s=i-e,o=i+e,a=r+t,l=r-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,o=s+c*this.view.width,a-=h*this.view.offsetY,l=a-h*this.view.height}this.projectionMatrix.makeOrthographic(s,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},$l=class extends jl{constructor(){super(new Er(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},us=class extends as{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Pt.DEFAULT_UP),this.updateMatrix(),this.target=new Pt,this.shadow=new $l}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}};var mr=-90,gr=1,Xo=class extends Pt{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new zt(mr,gr,e,t);r.layers=this.layers,this.add(r);let s=new zt(mr,gr,e,t);s.layers=this.layers,this.add(s);let o=new zt(mr,gr,e,t);o.layers=this.layers,this.add(o);let a=new zt(mr,gr,e,t);a.layers=this.layers,this.add(a);let l=new zt(mr,gr,e,t);l.layers=this.layers,this.add(l);let c=new zt(mr,gr,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[i,r,s,o,a,l]=t;for(let c of t)this.remove(c);if(e===bn)i.up.set(0,1,0),i.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===xr)i.up.set(0,-1,0),i.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[s,o,a,l,c,h]=this.children,f=e.getRenderTarget(),u=e.getActiveCubeFace(),d=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;let x=i.texture.generateMipmaps;i.texture.generateMipmaps=!1;let p=!1;e.isWebGLRenderer===!0?p=e.state.buffers.depth.getReversed():p=e.reversedDepthBuffer,e.setRenderTarget(i,0,r),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(i,1,r),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(i,2,r),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(i,3,r),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(i,4,r),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),i.texture.generateMipmaps=x,e.setRenderTarget(i,5,r),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,h),e.setRenderTarget(f,u,d),e.xr.enabled=g,i.texture.needsPMREMUpdate=!0}},Yo=class extends zt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}};var _c="\\[\\]\\.:\\/",sm=new RegExp("["+_c+"]","g"),vc="[^"+_c+"]",om="[^"+_c.replace("\\.","")+"]",am=/((?:WC+[\/:])*)/.source.replace("WC",vc),lm=/(WCOD+)?/.source.replace("WCOD",om),cm=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",vc),um=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",vc),hm=new RegExp("^"+am+lm+cm+um+"$"),dm=["material","materials","bones","map"],Zl=class{constructor(e,t,i){let r=i||it.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let i=this._targetGroup.nCachedObjects_,r=this._bindings[i];r!==void 0&&r.getValue(e,t)}setValue(e,t){let i=this._bindings;for(let r=this._targetGroup.nCachedObjects_,s=i.length;r!==s;++r)i[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].unbind()}},it=class n{constructor(e,t,i){this.path=t,this.parsedPath=i||n.parseTrackName(t),this.node=n.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,i){return e&&e.isAnimationObjectGroup?new n.Composite(e,t,i):new n(e,t,i)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(sm,"")}static parseTrackName(e){let t=hm.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let i={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=i.nodeName&&i.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){let s=i.nodeName.substring(r+1);dm.indexOf(s)!==-1&&(i.nodeName=i.nodeName.substring(0,r),i.objectName=s)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return i}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let i=e.skeleton.getBoneByName(t);if(i!==void 0)return i}if(e.children){let i=function(s){for(let o=0;o<s.length;o++){let a=s[o];if(a.name===t||a.uuid===t)return a;let l=i(a.children);if(l)return l}return null},r=i(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)e[t++]=i[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,i=t.objectName,r=t.propertyName,s=t.propertyIndex;if(e||(e=n.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){Te("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=t.objectIndex;switch(i){case"materials":if(!e.material){Re("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Re("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Re("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===c){c=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Re("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Re("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[i]===void 0){Re("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[i]}if(c!==void 0){if(e[c]===void 0){Re("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let o=e[r];if(o===void 0){let c=t.nodeName;Re("PropertyBinding: Trying to update property for track: "+c+"."+r+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?a=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(r==="morphTargetInfluences"){if(!e.geometry){Re("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Re("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=s}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=r;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};it.Composite=Zl;it.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};it.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};it.prototype.GetterByBindingType=[it.prototype._getValue_direct,it.prototype._getValue_array,it.prototype._getValue_arrayElement,it.prototype._getValue_toArray];it.prototype.SetterByBindingTypeAndVersioning=[[it.prototype._setValue_direct,it.prototype._setValue_direct_setNeedsUpdate,it.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[it.prototype._setValue_array,it.prototype._setValue_array_setNeedsUpdate,it.prototype._setValue_array_setMatrixWorldNeedsUpdate],[it.prototype._setValue_arrayElement,it.prototype._setValue_arrayElement_setNeedsUpdate,it.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[it.prototype._setValue_fromArray,it.prototype._setValue_fromArray_setNeedsUpdate,it.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var Y_=new Float32Array(1);var Kl=class n{static{n.prototype.isMatrix2=!0}constructor(e,t,i,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,i,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let i=0;i<4;i++)this.elements[i]=e[i+t];return this}set(e,t,i,r){let s=this.elements;return s[0]=e,s[2]=t,s[1]=i,s[3]=r,this}};function Mc(n,e,t,i){let r=fm(i);switch(t){case pc:return n*e;case gc:return n*e/r.components*r.byteLength;case ta:return n*e/r.components*r.byteLength;case Ei:return n*e*2/r.components*r.byteLength;case na:return n*e*2/r.components*r.byteLength;case mc:return n*e*3/r.components*r.byteLength;case ln:return n*e*4/r.components*r.byteLength;case ia:return n*e*4/r.components*r.byteLength;case ps:case ms:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case gs:case ys:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case sa:case aa:return Math.max(n,16)*Math.max(e,8)/4;case ra:case oa:return Math.max(n,8)*Math.max(e,8)/2;case la:case ca:case ha:case da:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case ua:case xs:case fa:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case pa:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case ma:return Math.floor((n+4)/5)*Math.floor((e+3)/4)*16;case ga:return Math.floor((n+4)/5)*Math.floor((e+4)/5)*16;case ya:return Math.floor((n+5)/6)*Math.floor((e+4)/5)*16;case xa:return Math.floor((n+5)/6)*Math.floor((e+5)/6)*16;case ba:return Math.floor((n+7)/8)*Math.floor((e+4)/5)*16;case _a:return Math.floor((n+7)/8)*Math.floor((e+5)/6)*16;case va:return Math.floor((n+7)/8)*Math.floor((e+7)/8)*16;case Ma:return Math.floor((n+9)/10)*Math.floor((e+4)/5)*16;case Sa:return Math.floor((n+9)/10)*Math.floor((e+5)/6)*16;case wa:return Math.floor((n+9)/10)*Math.floor((e+7)/8)*16;case Ea:return Math.floor((n+9)/10)*Math.floor((e+9)/10)*16;case Aa:return Math.floor((n+11)/12)*Math.floor((e+9)/10)*16;case Ta:return Math.floor((n+11)/12)*Math.floor((e+11)/12)*16;case Ra:case Ca:case Pa:return Math.ceil(n/4)*Math.ceil(e/4)*16;case La:case Ia:return Math.ceil(n/4)*Math.ceil(e/4)*8;case bs:case ka:return Math.ceil(n/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function fm(n){switch(n){case jt:case uc:return{byteLength:1,components:1};case Tr:case hc:case Vn:return{byteLength:2,components:1};case Qo:case ea:return{byteLength:2,components:4};case Mn:case Jo:case Sn:return{byteLength:4,components:1};case dc:case fc:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${n}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"185"}}));typeof window<"u"&&(window.__THREE__?Te("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="185");function bd(){let n=null,e=!1,t=null,i=null;function r(s,o){t(s,o),i=n.requestAnimationFrame(r)}return{start:function(){e!==!0&&t!==null&&n!==null&&(i=n.requestAnimationFrame(r),e=!0)},stop:function(){n!==null&&n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){n=s}}}function mm(n){let e=new WeakMap;function t(a,l){let c=a.array,h=a.usage,f=c.byteLength,u=n.createBuffer();n.bindBuffer(l,u),n.bufferData(l,c,h),a.onUploadCallback();let d;if(c instanceof Float32Array)d=n.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)d=n.HALF_FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?d=n.HALF_FLOAT:d=n.UNSIGNED_SHORT;else if(c instanceof Int16Array)d=n.SHORT;else if(c instanceof Uint32Array)d=n.UNSIGNED_INT;else if(c instanceof Int32Array)d=n.INT;else if(c instanceof Int8Array)d=n.BYTE;else if(c instanceof Uint8Array)d=n.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)d=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:d,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:f}}function i(a,l,c){let h=l.array,f=l.updateRanges;if(n.bindBuffer(c,a),f.length===0)n.bufferSubData(c,0,h);else{f.sort((d,g)=>d.start-g.start);let u=0;for(let d=1;d<f.length;d++){let g=f[u],x=f[d];x.start<=g.start+g.count+1?g.count=Math.max(g.count,x.start+x.count-g.start):(++u,f[u]=x)}f.length=u+1;for(let d=0,g=f.length;d<g;d++){let x=f[d];n.bufferSubData(c,x.start*h.BYTES_PER_ELEMENT,h,x.start,x.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function s(a){a.isInterleavedBufferAttribute&&(a=a.data);let l=e.get(a);l&&(n.deleteBuffer(l.buffer),e.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let h=e.get(a);(!h||h.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let c=e.get(a);if(c===void 0)e.set(a,t(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,a,l),c.version=a.version}}return{get:r,remove:s,update:o}}var gm=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,ym=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,xm=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,bm=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,_m=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,vm=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Mm=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Sm=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,wm=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,Em=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Am=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Tm=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Rm=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Cm=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Pm=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Lm=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Im=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,km=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Nm=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Dm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Fm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Um=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Om=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Bm=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,zm=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Vm=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,Gm=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Hm=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Wm=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,qm=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Xm="gl_FragColor = linearToOutputTexel( gl_FragColor );",Ym=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,jm=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,$m=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Zm=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Km=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Jm=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Qm=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,eg=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,tg=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,ng=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,ig=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,rg=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,sg=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,og=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,ag=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,lg=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,cg=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,ug=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,hg=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,dg=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,fg=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,pg=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,mg=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,gg=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,yg=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,xg=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,bg=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,_g=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,vg=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Mg=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Sg=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,wg=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Eg=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Ag=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Tg=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Rg=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Cg=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Pg=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Lg=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Ig=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,kg=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Ng=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Dg=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Fg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Ug=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Og=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Bg=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,zg=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Vg=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Gg=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Hg=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Wg=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,qg=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,Xg=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Yg=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,jg=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,$g=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Zg=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Kg=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Jg=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,Qg=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,e0=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,t0=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,n0=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,i0=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,r0=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,s0=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,o0=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,a0=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,l0=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,c0=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,u0=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,h0=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,d0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,f0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,p0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,m0=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,g0=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,y0=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,x0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,b0=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,_0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,v0=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,M0=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,S0=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,w0=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,E0=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,A0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,T0=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,R0=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,C0=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,P0=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,L0=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,I0=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,k0=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,N0=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,D0=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,F0=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,U0=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,O0=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,B0=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,z0=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,V0=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,G0=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,H0=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,W0=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,q0=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,X0=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Y0=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,j0=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,$0=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,De={alphahash_fragment:gm,alphahash_pars_fragment:ym,alphamap_fragment:xm,alphamap_pars_fragment:bm,alphatest_fragment:_m,alphatest_pars_fragment:vm,aomap_fragment:Mm,aomap_pars_fragment:Sm,batching_pars_vertex:wm,batching_vertex:Em,begin_vertex:Am,beginnormal_vertex:Tm,bsdfs:Rm,iridescence_fragment:Cm,bumpmap_pars_fragment:Pm,clipping_planes_fragment:Lm,clipping_planes_pars_fragment:Im,clipping_planes_pars_vertex:km,clipping_planes_vertex:Nm,color_fragment:Dm,color_pars_fragment:Fm,color_pars_vertex:Um,color_vertex:Om,common:Bm,cube_uv_reflection_fragment:zm,defaultnormal_vertex:Vm,displacementmap_pars_vertex:Gm,displacementmap_vertex:Hm,emissivemap_fragment:Wm,emissivemap_pars_fragment:qm,colorspace_fragment:Xm,colorspace_pars_fragment:Ym,envmap_fragment:jm,envmap_common_pars_fragment:$m,envmap_pars_fragment:Zm,envmap_pars_vertex:Km,envmap_physical_pars_fragment:lg,envmap_vertex:Jm,fog_vertex:Qm,fog_pars_vertex:eg,fog_fragment:tg,fog_pars_fragment:ng,gradientmap_pars_fragment:ig,lightmap_pars_fragment:rg,lights_lambert_fragment:sg,lights_lambert_pars_fragment:og,lights_pars_begin:ag,lights_toon_fragment:cg,lights_toon_pars_fragment:ug,lights_phong_fragment:hg,lights_phong_pars_fragment:dg,lights_physical_fragment:fg,lights_physical_pars_fragment:pg,lights_fragment_begin:mg,lights_fragment_maps:gg,lights_fragment_end:yg,lightprobes_pars_fragment:xg,logdepthbuf_fragment:bg,logdepthbuf_pars_fragment:_g,logdepthbuf_pars_vertex:vg,logdepthbuf_vertex:Mg,map_fragment:Sg,map_pars_fragment:wg,map_particle_fragment:Eg,map_particle_pars_fragment:Ag,metalnessmap_fragment:Tg,metalnessmap_pars_fragment:Rg,morphinstance_vertex:Cg,morphcolor_vertex:Pg,morphnormal_vertex:Lg,morphtarget_pars_vertex:Ig,morphtarget_vertex:kg,normal_fragment_begin:Ng,normal_fragment_maps:Dg,normal_pars_fragment:Fg,normal_pars_vertex:Ug,normal_vertex:Og,normalmap_pars_fragment:Bg,clearcoat_normal_fragment_begin:zg,clearcoat_normal_fragment_maps:Vg,clearcoat_pars_fragment:Gg,iridescence_pars_fragment:Hg,opaque_fragment:Wg,packing:qg,premultiplied_alpha_fragment:Xg,project_vertex:Yg,dithering_fragment:jg,dithering_pars_fragment:$g,roughnessmap_fragment:Zg,roughnessmap_pars_fragment:Kg,shadowmap_pars_fragment:Jg,shadowmap_pars_vertex:Qg,shadowmap_vertex:e0,shadowmask_pars_fragment:t0,skinbase_vertex:n0,skinning_pars_vertex:i0,skinning_vertex:r0,skinnormal_vertex:s0,specularmap_fragment:o0,specularmap_pars_fragment:a0,tonemapping_fragment:l0,tonemapping_pars_fragment:c0,transmission_fragment:u0,transmission_pars_fragment:h0,uv_pars_fragment:d0,uv_pars_vertex:f0,uv_vertex:p0,worldpos_vertex:m0,background_vert:g0,background_frag:y0,backgroundCube_vert:x0,backgroundCube_frag:b0,cube_vert:_0,cube_frag:v0,depth_vert:M0,depth_frag:S0,distance_vert:w0,distance_frag:E0,equirect_vert:A0,equirect_frag:T0,linedashed_vert:R0,linedashed_frag:C0,meshbasic_vert:P0,meshbasic_frag:L0,meshlambert_vert:I0,meshlambert_frag:k0,meshmatcap_vert:N0,meshmatcap_frag:D0,meshnormal_vert:F0,meshnormal_frag:U0,meshphong_vert:O0,meshphong_frag:B0,meshphysical_vert:z0,meshphysical_frag:V0,meshtoon_vert:G0,meshtoon_frag:H0,points_vert:W0,points_frag:q0,shadow_vert:X0,shadow_frag:Y0,sprite_vert:j0,sprite_frag:$0},he={common:{diffuse:{value:new Ue(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Le},alphaMap:{value:null},alphaMapTransform:{value:new Le},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Le}},envmap:{envMap:{value:null},envMapRotation:{value:new Le},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Le}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Le}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Le},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Le},normalScale:{value:new Be(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Le},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Le}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Le}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Le}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ue(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new V},probesMax:{value:new V},probesResolution:{value:new V}},points:{diffuse:{value:new Ue(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Le},alphaTest:{value:0},uvTransform:{value:new Le}},sprite:{diffuse:{value:new Ue(16777215)},opacity:{value:1},center:{value:new Be(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Le},alphaMap:{value:null},alphaMapTransform:{value:new Le},alphaTest:{value:0}}},Hn={basic:{uniforms:Ht([he.common,he.specularmap,he.envmap,he.aomap,he.lightmap,he.fog]),vertexShader:De.meshbasic_vert,fragmentShader:De.meshbasic_frag},lambert:{uniforms:Ht([he.common,he.specularmap,he.envmap,he.aomap,he.lightmap,he.emissivemap,he.bumpmap,he.normalmap,he.displacementmap,he.fog,he.lights,{emissive:{value:new Ue(0)},envMapIntensity:{value:1}}]),vertexShader:De.meshlambert_vert,fragmentShader:De.meshlambert_frag},phong:{uniforms:Ht([he.common,he.specularmap,he.envmap,he.aomap,he.lightmap,he.emissivemap,he.bumpmap,he.normalmap,he.displacementmap,he.fog,he.lights,{emissive:{value:new Ue(0)},specular:{value:new Ue(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:De.meshphong_vert,fragmentShader:De.meshphong_frag},standard:{uniforms:Ht([he.common,he.envmap,he.aomap,he.lightmap,he.emissivemap,he.bumpmap,he.normalmap,he.displacementmap,he.roughnessmap,he.metalnessmap,he.fog,he.lights,{emissive:{value:new Ue(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:De.meshphysical_vert,fragmentShader:De.meshphysical_frag},toon:{uniforms:Ht([he.common,he.aomap,he.lightmap,he.emissivemap,he.bumpmap,he.normalmap,he.displacementmap,he.gradientmap,he.fog,he.lights,{emissive:{value:new Ue(0)}}]),vertexShader:De.meshtoon_vert,fragmentShader:De.meshtoon_frag},matcap:{uniforms:Ht([he.common,he.bumpmap,he.normalmap,he.displacementmap,he.fog,{matcap:{value:null}}]),vertexShader:De.meshmatcap_vert,fragmentShader:De.meshmatcap_frag},points:{uniforms:Ht([he.points,he.fog]),vertexShader:De.points_vert,fragmentShader:De.points_frag},dashed:{uniforms:Ht([he.common,he.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:De.linedashed_vert,fragmentShader:De.linedashed_frag},depth:{uniforms:Ht([he.common,he.displacementmap]),vertexShader:De.depth_vert,fragmentShader:De.depth_frag},normal:{uniforms:Ht([he.common,he.bumpmap,he.normalmap,he.displacementmap,{opacity:{value:1}}]),vertexShader:De.meshnormal_vert,fragmentShader:De.meshnormal_frag},sprite:{uniforms:Ht([he.sprite,he.fog]),vertexShader:De.sprite_vert,fragmentShader:De.sprite_frag},background:{uniforms:{uvTransform:{value:new Le},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:De.background_vert,fragmentShader:De.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Le}},vertexShader:De.backgroundCube_vert,fragmentShader:De.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:De.cube_vert,fragmentShader:De.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:De.equirect_vert,fragmentShader:De.equirect_frag},distance:{uniforms:Ht([he.common,he.displacementmap,{referencePosition:{value:new V},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:De.distance_vert,fragmentShader:De.distance_frag},shadow:{uniforms:Ht([he.lights,he.fog,{color:{value:new Ue(0)},opacity:{value:1}}]),vertexShader:De.shadow_vert,fragmentShader:De.shadow_frag}};Hn.physical={uniforms:Ht([Hn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Le},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Le},clearcoatNormalScale:{value:new Be(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Le},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Le},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Le},sheen:{value:0},sheenColor:{value:new Ue(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Le},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Le},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Le},transmissionSamplerSize:{value:new Be},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Le},attenuationDistance:{value:0},attenuationColor:{value:new Ue(0)},specularColor:{value:new Ue(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Le},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Le},anisotropyVector:{value:new Be},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Le}}]),vertexShader:De.meshphysical_vert,fragmentShader:De.meshphysical_frag};var Ua={r:0,b:0,g:0},Z0=new at,_d=new Le;_d.set(-1,0,0,0,1,0,0,0,1);function K0(n,e,t,i,r,s){let o=new Ue(0),a=r===!0?0:1,l,c,h=null,f=0,u=null;function d(v){let M=v.isScene===!0?v.background:null;if(M&&M.isTexture){let y=v.backgroundBlurriness>0;M=e.get(M,y)}return M}function g(v){let M=!1,y=d(v);y===null?p(o,a):y&&y.isColor&&(p(y,1),M=!0);let w=n.xr.getEnvironmentBlendMode();w==="additive"?t.buffers.color.setClear(0,0,0,1,s):w==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,s),(n.autoClear||M)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function x(v,M){let y=d(M);y&&(y.isCubeTexture||y.mapping===ds)?(c===void 0&&(c=new lt(new wr(1,1,1),new Ft({name:"BackgroundCubeMaterial",uniforms:ji(Hn.backgroundCube.uniforms),vertexShader:Hn.backgroundCube.vertexShader,fragmentShader:Hn.backgroundCube.fragmentShader,side:Wt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(w,E,T){this.matrixWorld.copyPosition(T.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),c.material.uniforms.envMap.value=y,c.material.uniforms.backgroundBlurriness.value=M.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=M.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(Z0.makeRotationFromEuler(M.backgroundRotation)).transpose(),y.isCubeTexture&&y.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(_d),c.material.toneMapped=Ve.getTransfer(y.colorSpace)!==je,(h!==y||f!==y.version||u!==n.toneMapping)&&(c.material.needsUpdate=!0,h=y,f=y.version,u=n.toneMapping),c.layers.enableAll(),v.unshift(c,c.geometry,c.material,0,0,null)):y&&y.isTexture&&(l===void 0&&(l=new lt(new rs(2,2),new Ft({name:"BackgroundMaterial",uniforms:ji(Hn.background.uniforms),vertexShader:Hn.background.vertexShader,fragmentShader:Hn.background.fragmentShader,side:ei,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=y,l.material.uniforms.backgroundIntensity.value=M.backgroundIntensity,l.material.toneMapped=Ve.getTransfer(y.colorSpace)!==je,y.matrixAutoUpdate===!0&&y.updateMatrix(),l.material.uniforms.uvTransform.value.copy(y.matrix),(h!==y||f!==y.version||u!==n.toneMapping)&&(l.material.needsUpdate=!0,h=y,f=y.version,u=n.toneMapping),l.layers.enableAll(),v.unshift(l,l.geometry,l.material,0,0,null))}function p(v,M){v.getRGB(Ua,bc(n)),t.buffers.color.setClear(Ua.r,Ua.g,Ua.b,M,s)}function m(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return o},setClearColor:function(v,M=1){o.set(v),a=M,p(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(v){a=v,p(o,a)},render:g,addToRenderList:x,dispose:m}}function J0(n,e){let t=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},r=u(null),s=r,o=!1;function a(C,I,L,H,k){let O=!1,W=f(C,H,L,I);s!==W&&(s=W,c(s.object)),O=d(C,H,L,k),O&&g(C,H,L,k),k!==null&&e.update(k,n.ELEMENT_ARRAY_BUFFER),(O||o)&&(o=!1,y(C,I,L,H),k!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get(k).buffer))}function l(){return n.createVertexArray()}function c(C){return n.bindVertexArray(C)}function h(C){return n.deleteVertexArray(C)}function f(C,I,L,H){let k=H.wireframe===!0,O=i[I.id];O===void 0&&(O={},i[I.id]=O);let W=C.isInstancedMesh===!0?C.id:0,J=O[W];J===void 0&&(J={},O[W]=J);let Q=J[L.id];Q===void 0&&(Q={},J[L.id]=Q);let j=Q[k];return j===void 0&&(j=u(l()),Q[k]=j),j}function u(C){let I=[],L=[],H=[];for(let k=0;k<t;k++)I[k]=0,L[k]=0,H[k]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:I,enabledAttributes:L,attributeDivisors:H,object:C,attributes:{},index:null}}function d(C,I,L,H){let k=s.attributes,O=I.attributes,W=0,J=L.getAttributes();for(let Q in J)if(J[Q].location>=0){let te=k[Q],me=O[Q];if(me===void 0&&(Q==="instanceMatrix"&&C.instanceMatrix&&(me=C.instanceMatrix),Q==="instanceColor"&&C.instanceColor&&(me=C.instanceColor)),te===void 0||te.attribute!==me||me&&te.data!==me.data)return!0;W++}return s.attributesNum!==W||s.index!==H}function g(C,I,L,H){let k={},O=I.attributes,W=0,J=L.getAttributes();for(let Q in J)if(J[Q].location>=0){let te=O[Q];te===void 0&&(Q==="instanceMatrix"&&C.instanceMatrix&&(te=C.instanceMatrix),Q==="instanceColor"&&C.instanceColor&&(te=C.instanceColor));let me={};me.attribute=te,te&&te.data&&(me.data=te.data),k[Q]=me,W++}s.attributes=k,s.attributesNum=W,s.index=H}function x(){let C=s.newAttributes;for(let I=0,L=C.length;I<L;I++)C[I]=0}function p(C){m(C,0)}function m(C,I){let L=s.newAttributes,H=s.enabledAttributes,k=s.attributeDivisors;L[C]=1,H[C]===0&&(n.enableVertexAttribArray(C),H[C]=1),k[C]!==I&&(n.vertexAttribDivisor(C,I),k[C]=I)}function v(){let C=s.newAttributes,I=s.enabledAttributes;for(let L=0,H=I.length;L<H;L++)I[L]!==C[L]&&(n.disableVertexAttribArray(L),I[L]=0)}function M(C,I,L,H,k,O,W){W===!0?n.vertexAttribIPointer(C,I,L,k,O):n.vertexAttribPointer(C,I,L,H,k,O)}function y(C,I,L,H){x();let k=H.attributes,O=L.getAttributes(),W=I.defaultAttributeValues;for(let J in O){let Q=O[J];if(Q.location>=0){let j=k[J];if(j===void 0&&(J==="instanceMatrix"&&C.instanceMatrix&&(j=C.instanceMatrix),J==="instanceColor"&&C.instanceColor&&(j=C.instanceColor)),j!==void 0){let te=j.normalized,me=j.itemSize,Oe=e.get(j);if(Oe===void 0)continue;let et=Oe.buffer,He=Oe.type,Z=Oe.bytesPerElement,se=He===n.INT||He===n.UNSIGNED_INT||j.gpuType===Jo;if(j.isInterleavedBufferAttribute){let ne=j.data,Pe=ne.stride,Ie=j.offset;if(ne.isInstancedInterleavedBuffer){for(let Ee=0;Ee<Q.locationSize;Ee++)m(Q.location+Ee,ne.meshPerAttribute);C.isInstancedMesh!==!0&&H._maxInstanceCount===void 0&&(H._maxInstanceCount=ne.meshPerAttribute*ne.count)}else for(let Ee=0;Ee<Q.locationSize;Ee++)p(Q.location+Ee);n.bindBuffer(n.ARRAY_BUFFER,et);for(let Ee=0;Ee<Q.locationSize;Ee++)M(Q.location+Ee,me/Q.locationSize,He,te,Pe*Z,(Ie+me/Q.locationSize*Ee)*Z,se)}else{if(j.isInstancedBufferAttribute){for(let ne=0;ne<Q.locationSize;ne++)m(Q.location+ne,j.meshPerAttribute);C.isInstancedMesh!==!0&&H._maxInstanceCount===void 0&&(H._maxInstanceCount=j.meshPerAttribute*j.count)}else for(let ne=0;ne<Q.locationSize;ne++)p(Q.location+ne);n.bindBuffer(n.ARRAY_BUFFER,et);for(let ne=0;ne<Q.locationSize;ne++)M(Q.location+ne,me/Q.locationSize,He,te,me*Z,me/Q.locationSize*ne*Z,se)}}else if(W!==void 0){let te=W[J];if(te!==void 0)switch(te.length){case 2:n.vertexAttrib2fv(Q.location,te);break;case 3:n.vertexAttrib3fv(Q.location,te);break;case 4:n.vertexAttrib4fv(Q.location,te);break;default:n.vertexAttrib1fv(Q.location,te)}}}}v()}function w(){A();for(let C in i){let I=i[C];for(let L in I){let H=I[L];for(let k in H){let O=H[k];for(let W in O)h(O[W].object),delete O[W];delete H[k]}}delete i[C]}}function E(C){if(i[C.id]===void 0)return;let I=i[C.id];for(let L in I){let H=I[L];for(let k in H){let O=H[k];for(let W in O)h(O[W].object),delete O[W];delete H[k]}}delete i[C.id]}function T(C){for(let I in i){let L=i[I];for(let H in L){let k=L[H];if(k[C.id]===void 0)continue;let O=k[C.id];for(let W in O)h(O[W].object),delete O[W];delete k[C.id]}}}function _(C){for(let I in i){let L=i[I],H=C.isInstancedMesh===!0?C.id:0,k=L[H];if(k!==void 0){for(let O in k){let W=k[O];for(let J in W)h(W[J].object),delete W[J];delete k[O]}delete L[H],Object.keys(L).length===0&&delete i[I]}}}function A(){P(),o=!0,s!==r&&(s=r,c(s.object))}function P(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:a,reset:A,resetDefaultState:P,dispose:w,releaseStatesOfGeometry:E,releaseStatesOfObject:_,releaseStatesOfProgram:T,initAttributes:x,enableAttribute:p,disableUnusedAttributes:v}}function Q0(n,e,t){let i;function r(l){i=l}function s(l,c){n.drawArrays(i,l,c),t.update(c,i,1)}function o(l,c,h){h!==0&&(n.drawArraysInstanced(i,l,c,h),t.update(c,i,h))}function a(l,c,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,h);let u=0;for(let d=0;d<h;d++)u+=c[d];t.update(u,i,1)}this.setMode=r,this.render=s,this.renderInstances=o,this.renderMultiDraw=a}function ey(n,e,t,i){let r;function s(){if(r!==void 0)return r;if(e.has("EXT_texture_filter_anisotropic")===!0){let T=e.get("EXT_texture_filter_anisotropic");r=n.getParameter(T.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function o(T){return!(T!==ln&&i.convert(T)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(T){let _=T===Vn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(T!==jt&&i.convert(T)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE)&&T!==Sn&&!_)}function l(T){if(T==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";T="mediump"}return T==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp",h=l(c);h!==c&&(Te("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let f=t.logarithmicDepthBuffer===!0,u=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&u===!1&&Te("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let d=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),g=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),x=n.getParameter(n.MAX_TEXTURE_SIZE),p=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),m=n.getParameter(n.MAX_VERTEX_ATTRIBS),v=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),M=n.getParameter(n.MAX_VARYING_VECTORS),y=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),w=n.getParameter(n.MAX_SAMPLES),E=n.getParameter(n.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:f,reversedDepthBuffer:u,maxTextures:d,maxVertexTextures:g,maxTextureSize:x,maxCubemapSize:p,maxAttributes:m,maxVertexUniforms:v,maxVaryings:M,maxFragmentUniforms:y,maxSamples:w,samples:E}}function ty(n){let e=this,t=null,i=0,r=!1,s=!1,o=new kn,a=new Le,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(f,u){let d=f.length!==0||u||i!==0||r;return r=u,i=f.length,d},this.beginShadows=function(){s=!0,h(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(f,u){t=h(f,u,0)},this.setState=function(f,u,d){let g=f.clippingPlanes,x=f.clipIntersection,p=f.clipShadows,m=n.get(f);if(!r||g===null||g.length===0||s&&!p)s?h(null):c();else{let v=s?0:i,M=v*4,y=m.clippingState||null;l.value=y,y=h(g,u,M,d);for(let w=0;w!==M;++w)y[w]=t[w];m.clippingState=y,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=v}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function h(f,u,d,g){let x=f!==null?f.length:0,p=null;if(x!==0){if(p=l.value,g!==!0||p===null){let m=d+x*4,v=u.matrixWorldInverse;a.getNormalMatrix(v),(p===null||p.length<m)&&(p=new Float32Array(m));for(let M=0,y=d;M!==x;++M,y+=4)o.copy(f[M]).applyMatrix4(v,a),o.normal.toArray(p,y),p[y+3]=o.constant}l.value=p,l.needsUpdate=!0}return e.numPlanes=x,e.numIntersection=0,p}}var Ai=4,Kh=[.125,.215,.35,.446,.526,.582],$i=20,ny=256,vs=new Er,Jh=new Ue,Sc=null,wc=0,Ec=0,Ac=!1,iy=new V,Ba=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,i=.1,r=100,s={}){let{size:o=256,position:a=iy}=s;Sc=this._renderer.getRenderTarget(),wc=this._renderer.getActiveCubeFace(),Ec=this._renderer.getActiveMipmapLevel(),Ac=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,i,r,l,a),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=td(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=ed(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Sc,wc,Ec),this._renderer.xr.enabled=Ac,e.scissorTest=!1,Cr(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Si||e.mapping===Yi?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Sc=this._renderer.getRenderTarget(),wc=this._renderer.getActiveCubeFace(),Ec=this._renderer.getActiveMipmapLevel(),Ac=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let i=t||this._allocateTargets();return this._textureToCubeUV(e,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:Nt,minFilter:Nt,generateMipmaps:!1,type:Vn,format:ln,colorSpace:Hi,depthBuffer:!1},r=Qh(e,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Qh(e,t,i);let{_lodMax:s}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=ry(s)),this._blurMaterial=oy(s,e,t),this._ggxMaterial=sy(s,e,t)}return r}_compileMaterial(e){let t=new lt(new Dt,e);this._renderer.compile(t,vs)}_sceneToCubeUV(e,t,i,r,s){let l=new zt(90,1,t,i),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],f=this._renderer,u=f.autoClear,d=f.toneMapping;f.getClearColor(Jh),f.toneMapping=vn,f.autoClear=!1,f.state.buffers.depth.getReversed()&&(f.setRenderTarget(r),f.clearDepth(),f.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new lt(new wr,new Xi({name:"PMREM.Background",side:Wt,depthWrite:!1,depthTest:!1})));let x=this._backgroundBox,p=x.material,m=!1,v=e.background;v?v.isColor&&(p.color.copy(v),e.background=null,m=!0):(p.color.copy(Jh),m=!0);for(let M=0;M<6;M++){let y=M%3;y===0?(l.up.set(0,c[M],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x+h[M],s.y,s.z)):y===1?(l.up.set(0,0,c[M]),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y+h[M],s.z)):(l.up.set(0,c[M],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y,s.z+h[M]));let w=this._cubeSize;Cr(r,y*w,M>2?w:0,w,w),f.setRenderTarget(r),m&&f.render(x,l),f.render(e,l)}f.toneMapping=d,f.autoClear=u,e.background=v}_textureToCubeUV(e,t){let i=this._renderer,r=e.mapping===Si||e.mapping===Yi;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=td()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=ed());let s=r?this._cubemapMaterial:this._equirectMaterial,o=this._lodMeshes[0];o.material=s;let a=s.uniforms;a.envMap.value=e;let l=this._cubeSize;Cr(t,0,0,3*l,2*l),i.setRenderTarget(t),i.render(o,vs)}_applyPMREM(e){let t=this._renderer,i=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let s=1;s<r;s++)this._applyGGXFilter(e,s-1,s);t.autoClear=i}_applyGGXFilter(e,t,i){let r=this._renderer,s=this._pingPongRenderTarget,o=this._ggxMaterial,a=this._lodMeshes[i];a.material=o;let l=o.uniforms,c=i/(this._lodMeshes.length-1),h=t/(this._lodMeshes.length-1),f=Math.sqrt(c*c-h*h),u=0+c*1.25,d=f*u,{_lodMax:g}=this,x=this._sizeLods[i],p=3*x*(i>g-Ai?i-g+Ai:0),m=4*(this._cubeSize-x);l.envMap.value=e.texture,l.roughness.value=d,l.mipInt.value=g-t,Cr(s,p,m,3*x,2*x),r.setRenderTarget(s),r.render(a,vs),l.envMap.value=s.texture,l.roughness.value=0,l.mipInt.value=g-i,Cr(e,p,m,3*x,2*x),r.setRenderTarget(e),r.render(a,vs)}_blur(e,t,i,r,s){let o=this._pingPongRenderTarget;this._halfBlur(e,o,t,i,r,"latitudinal",s),this._halfBlur(o,e,i,i,r,"longitudinal",s)}_halfBlur(e,t,i,r,s,o,a){let l=this._renderer,c=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&Re("blur direction must be either latitudinal or longitudinal!");let h=3,f=this._lodMeshes[r];f.material=c;let u=c.uniforms,d=this._sizeLods[i]-1,g=isFinite(s)?Math.PI/(2*d):2*Math.PI/(2*$i-1),x=s/g,p=isFinite(s)?1+Math.floor(h*x):$i;p>$i&&Te(`sigmaRadians, ${s}, is too large and will clip, as it requested ${p} samples when the maximum is set to ${$i}`);let m=[],v=0;for(let T=0;T<$i;++T){let _=T/x,A=Math.exp(-_*_/2);m.push(A),T===0?v+=A:T<p&&(v+=2*A)}for(let T=0;T<m.length;T++)m[T]=m[T]/v;u.envMap.value=e.texture,u.samples.value=p,u.weights.value=m,u.latitudinal.value=o==="latitudinal",a&&(u.poleAxis.value=a);let{_lodMax:M}=this;u.dTheta.value=g,u.mipInt.value=M-i;let y=this._sizeLods[r],w=3*y*(r>M-Ai?r-M+Ai:0),E=4*(this._cubeSize-y);Cr(t,w,E,3*y,2*y),l.setRenderTarget(t),l.render(f,vs)}};function ry(n){let e=[],t=[],i=[],r=n,s=n-Ai+1+Kh.length;for(let o=0;o<s;o++){let a=Math.pow(2,r);e.push(a);let l=1/a;o>n-Ai?l=Kh[o-n+Ai-1]:o===0&&(l=0),t.push(l);let c=1/(a-2),h=-c,f=1+c,u=[h,h,f,h,f,f,h,h,f,f,h,f],d=6,g=6,x=3,p=2,m=1,v=new Float32Array(x*g*d),M=new Float32Array(p*g*d),y=new Float32Array(m*g*d);for(let E=0;E<d;E++){let T=E%3*2/3-1,_=E>2?0:-1,A=[T,_,0,T+2/3,_,0,T+2/3,_+1,0,T,_,0,T+2/3,_+1,0,T,_+1,0];v.set(A,x*g*E),M.set(u,p*g*E);let P=[E,E,E,E,E,E];y.set(P,m*g*E)}let w=new Dt;w.setAttribute("position",new rt(v,x)),w.setAttribute("uv",new rt(M,p)),w.setAttribute("faceIndex",new rt(y,m)),i.push(new lt(w,null)),r>Ai&&r--}return{lodMeshes:i,sizeLods:e,sigmas:t}}function Qh(n,e,t){let i=new tn(n,e,t);return i.texture.mapping=ds,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function Cr(n,e,t,i,r){n.viewport.set(e,t,i,r),n.scissor.set(e,t,i,r)}function sy(n,e,t){return new Ft({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:ny,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Ga(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:Bn,depthTest:!1,depthWrite:!1})}function oy(n,e,t){let i=new Float32Array($i),r=new V(0,1,0);return new Ft({name:"SphericalGaussianBlur",defines:{n:$i,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:r}},vertexShader:Ga(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Bn,depthTest:!1,depthWrite:!1})}function ed(){return new Ft({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Ga(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Bn,depthTest:!1,depthWrite:!1})}function td(){return new Ft({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Ga(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Bn,depthTest:!1,depthWrite:!1})}function Ga(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}var za=class extends tn{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let i={width:e,height:e,depth:1},r=[i,i,i,i,i,i];this.texture=new ns(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new wr(5,5,5),s=new Ft({name:"CubemapFromEquirect",uniforms:ji(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:Wt,blending:Bn});s.uniforms.tEquirect.value=t;let o=new lt(r,s),a=t.minFilter;return t.minFilter===zn&&(t.minFilter=Nt),new Xo(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t=!0,i=!0,r=!0){let s=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,i,r);e.setRenderTarget(s)}};function ay(n){let e=new WeakMap,t=new WeakMap,i=null;function r(u,d=!1){return u==null?null:d?o(u):s(u)}function s(u){if(u&&u.isTexture){let d=u.mapping;if(d===$o||d===Zo)if(e.has(u)){let g=e.get(u).texture;return a(g,u.mapping)}else{let g=u.image;if(g&&g.height>0){let x=new za(g.height);return x.fromEquirectangularTexture(n,u),e.set(u,x),u.addEventListener("dispose",c),a(x.texture,u.mapping)}else return null}}return u}function o(u){if(u&&u.isTexture){let d=u.mapping,g=d===$o||d===Zo,x=d===Si||d===Yi;if(g||x){let p=t.get(u),m=p!==void 0?p.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==m)return i===null&&(i=new Ba(n)),p=g?i.fromEquirectangular(u,p):i.fromCubemap(u,p),p.texture.pmremVersion=u.pmremVersion,t.set(u,p),p.texture;if(p!==void 0)return p.texture;{let v=u.image;return g&&v&&v.height>0||x&&v&&l(v)?(i===null&&(i=new Ba(n)),p=g?i.fromEquirectangular(u):i.fromCubemap(u),p.texture.pmremVersion=u.pmremVersion,t.set(u,p),u.addEventListener("dispose",h),p.texture):null}}}return u}function a(u,d){return d===$o?u.mapping=Si:d===Zo&&(u.mapping=Yi),u}function l(u){let d=0,g=6;for(let x=0;x<g;x++)u[x]!==void 0&&d++;return d===g}function c(u){let d=u.target;d.removeEventListener("dispose",c);let g=e.get(d);g!==void 0&&(e.delete(d),g.dispose())}function h(u){let d=u.target;d.removeEventListener("dispose",h);let g=t.get(d);g!==void 0&&(t.delete(d),g.dispose())}function f(){e=new WeakMap,t=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:r,dispose:f}}function ly(n){let e={};function t(i){if(e[i]!==void 0)return e[i];let r=n.getExtension(i);return e[i]=r,r}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){let r=t(i);return r===null&&zi("WebGLRenderer: "+i+" extension not supported."),r}}}function cy(n,e,t,i){let r={},s=new WeakMap;function o(f){let u=f.target;u.index!==null&&e.remove(u.index);for(let g in u.attributes)e.remove(u.attributes[g]);u.removeEventListener("dispose",o),delete r[u.id];let d=s.get(u);d&&(e.remove(d),s.delete(u)),i.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,t.memory.geometries--}function a(f,u){return r[u.id]===!0||(u.addEventListener("dispose",o),r[u.id]=!0,t.memory.geometries++),u}function l(f){let u=f.attributes;for(let d in u)e.update(u[d],n.ARRAY_BUFFER)}function c(f){let u=[],d=f.index,g=f.attributes.position,x=0;if(g===void 0)return;if(d!==null){let v=d.array;x=d.version;for(let M=0,y=v.length;M<y;M+=3){let w=v[M+0],E=v[M+1],T=v[M+2];u.push(w,E,E,T,T,w)}}else{let v=g.array;x=g.version;for(let M=0,y=v.length/3-1;M<y;M+=3){let w=M+0,E=M+1,T=M+2;u.push(w,E,E,T,T,w)}}let p=new(g.count>=65535?qi:Wi)(u,1);p.version=x;let m=s.get(f);m&&e.remove(m),s.set(f,p)}function h(f){let u=s.get(f);if(u){let d=f.index;d!==null&&u.version<d.version&&c(f)}else c(f);return s.get(f)}return{get:a,update:l,getWireframeAttribute:h}}function uy(n,e,t){let i;function r(f){i=f}let s,o;function a(f){s=f.type,o=f.bytesPerElement}function l(f,u){n.drawElements(i,u,s,f*o),t.update(u,i,1)}function c(f,u,d){d!==0&&(n.drawElementsInstanced(i,u,s,f*o,d),t.update(u,i,d))}function h(f,u,d){if(d===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,u,0,s,f,0,d);let x=0;for(let p=0;p<d;p++)x+=u[p];t.update(x,i,1)}this.setMode=r,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function hy(n){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,o,a){switch(t.calls++,o){case n.TRIANGLES:t.triangles+=a*(s/3);break;case n.LINES:t.lines+=a*(s/2);break;case n.LINE_STRIP:t.lines+=a*(s-1);break;case n.LINE_LOOP:t.lines+=a*s;break;case n.POINTS:t.points+=a*s;break;default:Re("WebGLInfo: Unknown draw mode:",o);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:r,update:i}}function dy(n,e,t){let i=new WeakMap,r=new st;function s(o,a,l){let c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,f=h!==void 0?h.length:0,u=i.get(a);if(u===void 0||u.count!==f){let A=function(){T.dispose(),i.delete(a),a.removeEventListener("dispose",A)};u!==void 0&&u.texture.dispose();let d=a.morphAttributes.position!==void 0,g=a.morphAttributes.normal!==void 0,x=a.morphAttributes.color!==void 0,p=a.morphAttributes.position||[],m=a.morphAttributes.normal||[],v=a.morphAttributes.color||[],M=0;d===!0&&(M=1),g===!0&&(M=2),x===!0&&(M=3);let y=a.attributes.position.count*M,w=1;y>e.maxTextureSize&&(w=Math.ceil(y/e.maxTextureSize),y=e.maxTextureSize);let E=new Float32Array(y*w*4*f),T=new Qr(E,y,w,f);T.type=Sn,T.needsUpdate=!0;let _=M*4;for(let P=0;P<f;P++){let C=p[P],I=m[P],L=v[P],H=y*w*4*P;for(let k=0;k<C.count;k++){let O=k*_;d===!0&&(r.fromBufferAttribute(C,k),E[H+O+0]=r.x,E[H+O+1]=r.y,E[H+O+2]=r.z,E[H+O+3]=0),g===!0&&(r.fromBufferAttribute(I,k),E[H+O+4]=r.x,E[H+O+5]=r.y,E[H+O+6]=r.z,E[H+O+7]=0),x===!0&&(r.fromBufferAttribute(L,k),E[H+O+8]=r.x,E[H+O+9]=r.y,E[H+O+10]=r.z,E[H+O+11]=L.itemSize===4?r.w:1)}}u={count:f,texture:T,size:new Be(y,w)},i.set(a,u),a.addEventListener("dispose",A)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(n,"morphTexture",o.morphTexture,t);else{let d=0;for(let x=0;x<c.length;x++)d+=c[x];let g=a.morphTargetsRelative?1:1-d;l.getUniforms().setValue(n,"morphTargetBaseInfluence",g),l.getUniforms().setValue(n,"morphTargetInfluences",c)}l.getUniforms().setValue(n,"morphTargetsTexture",u.texture,t),l.getUniforms().setValue(n,"morphTargetsTextureSize",u.size)}return{update:s}}function fy(n,e,t,i,r){let s=new WeakMap;function o(c){let h=r.render.frame,f=c.geometry,u=e.get(c,f);if(s.get(u)!==h&&(e.update(u),s.set(u,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),s.get(c)!==h&&(t.update(c.instanceMatrix,n.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,n.ARRAY_BUFFER),s.set(c,h))),c.isSkinnedMesh){let d=c.skeleton;s.get(d)!==h&&(d.update(),s.set(d,h))}return u}function a(){s=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),i.releaseStatesOfObject(h),t.remove(h.instanceMatrix),h.instanceColor!==null&&t.remove(h.instanceColor)}return{update:o,dispose:a}}var py={[nc]:"LINEAR_TONE_MAPPING",[ic]:"REINHARD_TONE_MAPPING",[rc]:"CINEON_TONE_MAPPING",[sc]:"ACES_FILMIC_TONE_MAPPING",[ac]:"AGX_TONE_MAPPING",[lc]:"NEUTRAL_TONE_MAPPING",[oc]:"CUSTOM_TONE_MAPPING"};function my(n,e,t,i,r,s){let o=new tn(e,t,{type:n,depthBuffer:r,stencilBuffer:s,samples:i?4:0,depthTexture:r?new ni(e,t):void 0}),a=new tn(e,t,{type:Vn,depthBuffer:!1,stencilBuffer:!1}),l=new Dt;l.setAttribute("position",new Vt([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new Vt([0,2,0,0,2,0],2));let c=new ko({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),h=new lt(l,c),f=new Er(-1,1,1,-1,0,1),u=null,d=null,g=!1,x,p=null,m=[],v=!1;this.setSize=function(M,y){o.setSize(M,y),a.setSize(M,y);for(let w=0;w<m.length;w++){let E=m[w];E.setSize&&E.setSize(M,y)}},this.setEffects=function(M){m=M,v=m.length>0&&m[0].isRenderPass===!0;let y=o.width,w=o.height;for(let E=0;E<m.length;E++){let T=m[E];T.setSize&&T.setSize(y,w)}},this.begin=function(M,y){if(g||M.toneMapping===vn&&m.length===0)return!1;if(p=y,y!==null){let w=y.width,E=y.height;(o.width!==w||o.height!==E)&&this.setSize(w,E)}return v===!1&&M.setRenderTarget(o),x=M.toneMapping,M.toneMapping=vn,!0},this.hasRenderPass=function(){return v},this.end=function(M,y){M.toneMapping=x,g=!0;let w=o,E=a;for(let T=0;T<m.length;T++){let _=m[T];if(_.enabled!==!1&&(_.render(M,E,w,y),_.needsSwap!==!1)){let A=w;w=E,E=A}}if(u!==M.outputColorSpace||d!==M.toneMapping){u=M.outputColorSpace,d=M.toneMapping,c.defines={},Ve.getTransfer(u)===je&&(c.defines.SRGB_TRANSFER="");let T=py[d];T&&(c.defines[T]=""),c.needsUpdate=!0}c.uniforms.tDiffuse.value=w.texture,M.setRenderTarget(p),M.render(h,f),p=null,g=!1},this.isCompositing=function(){return g},this.dispose=function(){o.depthTexture&&o.depthTexture.dispose(),o.dispose(),a.dispose(),l.dispose(),c.dispose()}}var vd=new Gt,Cc=new ni(1,1),Md=new Qr,Sd=new Co,wd=new ns,nd=[],id=[],rd=new Float32Array(16),sd=new Float32Array(9),od=new Float32Array(4);function Lr(n,e,t){let i=n[0];if(i<=0||i>0)return n;let r=e*t,s=nd[r];if(s===void 0&&(s=new Float32Array(r),nd[r]=s),e!==0){i.toArray(s,0);for(let o=1,a=0;o!==e;++o)a+=t,n[o].toArray(s,a)}return s}function St(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function wt(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function Ha(n,e){let t=id[e];t===void 0&&(t=new Int32Array(e),id[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function gy(n,e){let t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function yy(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(St(t,e))return;n.uniform2fv(this.addr,e),wt(t,e)}}function xy(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(St(t,e))return;n.uniform3fv(this.addr,e),wt(t,e)}}function by(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(St(t,e))return;n.uniform4fv(this.addr,e),wt(t,e)}}function _y(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(St(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),wt(t,e)}else{if(St(t,i))return;od.set(i),n.uniformMatrix2fv(this.addr,!1,od),wt(t,i)}}function vy(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(St(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),wt(t,e)}else{if(St(t,i))return;sd.set(i),n.uniformMatrix3fv(this.addr,!1,sd),wt(t,i)}}function My(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(St(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),wt(t,e)}else{if(St(t,i))return;rd.set(i),n.uniformMatrix4fv(this.addr,!1,rd),wt(t,i)}}function Sy(n,e){let t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function wy(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(St(t,e))return;n.uniform2iv(this.addr,e),wt(t,e)}}function Ey(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(St(t,e))return;n.uniform3iv(this.addr,e),wt(t,e)}}function Ay(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(St(t,e))return;n.uniform4iv(this.addr,e),wt(t,e)}}function Ty(n,e){let t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function Ry(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(St(t,e))return;n.uniform2uiv(this.addr,e),wt(t,e)}}function Cy(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(St(t,e))return;n.uniform3uiv(this.addr,e),wt(t,e)}}function Py(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(St(t,e))return;n.uniform4uiv(this.addr,e),wt(t,e)}}function Ly(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r);let s;this.type===n.SAMPLER_2D_SHADOW?(Cc.compareFunction=t.isReversedDepthBuffer()?Fa:Da,s=Cc):s=vd,t.setTexture2D(e||s,r)}function Iy(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture3D(e||Sd,r)}function ky(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTextureCube(e||wd,r)}function Ny(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture2DArray(e||Md,r)}function Dy(n){switch(n){case 5126:return gy;case 35664:return yy;case 35665:return xy;case 35666:return by;case 35674:return _y;case 35675:return vy;case 35676:return My;case 5124:case 35670:return Sy;case 35667:case 35671:return wy;case 35668:case 35672:return Ey;case 35669:case 35673:return Ay;case 5125:return Ty;case 36294:return Ry;case 36295:return Cy;case 36296:return Py;case 35678:case 36198:case 36298:case 36306:case 35682:return Ly;case 35679:case 36299:case 36307:return Iy;case 35680:case 36300:case 36308:case 36293:return ky;case 36289:case 36303:case 36311:case 36292:return Ny}}function Fy(n,e){n.uniform1fv(this.addr,e)}function Uy(n,e){let t=Lr(e,this.size,2);n.uniform2fv(this.addr,t)}function Oy(n,e){let t=Lr(e,this.size,3);n.uniform3fv(this.addr,t)}function By(n,e){let t=Lr(e,this.size,4);n.uniform4fv(this.addr,t)}function zy(n,e){let t=Lr(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function Vy(n,e){let t=Lr(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function Gy(n,e){let t=Lr(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function Hy(n,e){n.uniform1iv(this.addr,e)}function Wy(n,e){n.uniform2iv(this.addr,e)}function qy(n,e){n.uniform3iv(this.addr,e)}function Xy(n,e){n.uniform4iv(this.addr,e)}function Yy(n,e){n.uniform1uiv(this.addr,e)}function jy(n,e){n.uniform2uiv(this.addr,e)}function $y(n,e){n.uniform3uiv(this.addr,e)}function Zy(n,e){n.uniform4uiv(this.addr,e)}function Ky(n,e,t){let i=this.cache,r=e.length,s=Ha(t,r);St(i,s)||(n.uniform1iv(this.addr,s),wt(i,s));let o;this.type===n.SAMPLER_2D_SHADOW?o=Cc:o=vd;for(let a=0;a!==r;++a)t.setTexture2D(e[a]||o,s[a])}function Jy(n,e,t){let i=this.cache,r=e.length,s=Ha(t,r);St(i,s)||(n.uniform1iv(this.addr,s),wt(i,s));for(let o=0;o!==r;++o)t.setTexture3D(e[o]||Sd,s[o])}function Qy(n,e,t){let i=this.cache,r=e.length,s=Ha(t,r);St(i,s)||(n.uniform1iv(this.addr,s),wt(i,s));for(let o=0;o!==r;++o)t.setTextureCube(e[o]||wd,s[o])}function ex(n,e,t){let i=this.cache,r=e.length,s=Ha(t,r);St(i,s)||(n.uniform1iv(this.addr,s),wt(i,s));for(let o=0;o!==r;++o)t.setTexture2DArray(e[o]||Md,s[o])}function tx(n){switch(n){case 5126:return Fy;case 35664:return Uy;case 35665:return Oy;case 35666:return By;case 35674:return zy;case 35675:return Vy;case 35676:return Gy;case 5124:case 35670:return Hy;case 35667:case 35671:return Wy;case 35668:case 35672:return qy;case 35669:case 35673:return Xy;case 5125:return Yy;case 36294:return jy;case 36295:return $y;case 36296:return Zy;case 35678:case 36198:case 36298:case 36306:case 35682:return Ky;case 35679:case 36299:case 36307:return Jy;case 35680:case 36300:case 36308:case 36293:return Qy;case 36289:case 36303:case 36311:case 36292:return ex}}var Pc=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=Dy(t.type)}},Lc=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=tx(t.type)}},Ic=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){let r=this.seq;for(let s=0,o=r.length;s!==o;++s){let a=r[s];a.setValue(e,t[a.id],i)}}},Tc=/(\w+)(\])?(\[|\.)?/g;function ad(n,e){n.seq.push(e),n.map[e.id]=e}function nx(n,e,t){let i=n.name,r=i.length;for(Tc.lastIndex=0;;){let s=Tc.exec(i),o=Tc.lastIndex,a=s[1],l=s[2]==="]",c=s[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===r){ad(t,c===void 0?new Pc(a,n,e):new Lc(a,n,e));break}else{let f=t.map[a];f===void 0&&(f=new Ic(a),ad(t,f)),t=f}}}var Pr=class{constructor(e,t){this.seq=[],this.map={};let i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let o=0;o<i;++o){let a=e.getActiveUniform(t,o),l=e.getUniformLocation(t,a.name);nx(a,l,this)}let r=[],s=[];for(let o of this.seq)o.type===e.SAMPLER_2D_SHADOW||o.type===e.SAMPLER_CUBE_SHADOW||o.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(o):s.push(o);r.length>0&&(this.seq=r.concat(s))}setValue(e,t,i,r){let s=this.map[t];s!==void 0&&s.setValue(e,i,r)}setOptional(e,t,i){let r=t[i];r!==void 0&&this.setValue(e,i,r)}static upload(e,t,i,r){for(let s=0,o=t.length;s!==o;++s){let a=t[s],l=i[a.id];l.needsUpdate!==!1&&a.setValue(e,l.value,r)}}static seqWithValue(e,t){let i=[];for(let r=0,s=e.length;r!==s;++r){let o=e[r];o.id in t&&i.push(o)}return i}};function ld(n,e,t){let i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}var ix=37297,rx=0;function sx(n,e){let t=n.split(`
`),i=[],r=Math.max(e-6,0),s=Math.min(e+6,t.length);for(let o=r;o<s;o++){let a=o+1;i.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return i.join(`
`)}var cd=new Le;function ox(n){Ve._getMatrix(cd,Ve.workingColorSpace,n);let e=`mat3( ${cd.elements.map(t=>t.toFixed(4))} )`;switch(Ve.getTransfer(n)){case Kr:return[e,"LinearTransferOETF"];case je:return[e,"sRGBTransferOETF"];default:return Te("WebGLProgram: Unsupported color space: ",n),[e,"LinearTransferOETF"]}}function ud(n,e,t){let i=n.getShaderParameter(e,n.COMPILE_STATUS),s=(n.getShaderInfoLog(e)||"").trim();if(i&&s==="")return"";let o=/ERROR: 0:(\d+)/.exec(s);if(o){let a=parseInt(o[1]);return t.toUpperCase()+`

`+s+`

`+sx(n.getShaderSource(e),a)}else return s}function ax(n,e){let t=ox(e);return[`vec4 ${n}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}var lx={[nc]:"Linear",[ic]:"Reinhard",[rc]:"Cineon",[sc]:"ACESFilmic",[ac]:"AgX",[lc]:"Neutral",[oc]:"Custom"};function cx(n,e){let t=lx[e];return t===void 0?(Te("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+n+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var Oa=new V;function ux(){Ve.getLuminanceCoefficients(Oa);let n=Oa.x.toFixed(4),e=Oa.y.toFixed(4),t=Oa.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function hx(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Ss).join(`
`)}function dx(n){let e=[];for(let t in n){let i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function fx(n,e){let t={},i=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){let s=n.getActiveAttrib(e,r),o=s.name,a=1;s.type===n.FLOAT_MAT2&&(a=2),s.type===n.FLOAT_MAT3&&(a=3),s.type===n.FLOAT_MAT4&&(a=4),t[o]={type:s.type,location:n.getAttribLocation(e,o),locationSize:a}}return t}function Ss(n){return n!==""}function hd(n,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function dd(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var px=/^[ \t]*#include +<([\w\d./]+)>/gm;function kc(n){return n.replace(px,gx)}var mx=new Map;function gx(n,e){let t=De[e];if(t===void 0){let i=mx.get(e);if(i!==void 0)t=De[i],Te('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return kc(t)}var yx=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function fd(n){return n.replace(yx,xx)}function xx(n,e,t,i){let r="";for(let s=parseInt(e);s<parseInt(t);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function pd(n){let e=`precision ${n.precision} float;
	precision ${n.precision} int;
	precision ${n.precision} sampler2D;
	precision ${n.precision} samplerCube;
	precision ${n.precision} sampler3D;
	precision ${n.precision} sampler2DArray;
	precision ${n.precision} sampler2DShadow;
	precision ${n.precision} samplerCubeShadow;
	precision ${n.precision} sampler2DArrayShadow;
	precision ${n.precision} isampler2D;
	precision ${n.precision} isampler3D;
	precision ${n.precision} isamplerCube;
	precision ${n.precision} isampler2DArray;
	precision ${n.precision} usampler2D;
	precision ${n.precision} usampler3D;
	precision ${n.precision} usamplerCube;
	precision ${n.precision} usampler2DArray;
	`;return n.precision==="highp"?e+=`
#define HIGH_PRECISION`:n.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:n.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}var bx={[hs]:"SHADOWMAP_TYPE_PCF",[Ar]:"SHADOWMAP_TYPE_VSM"};function _x(n){return bx[n.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var vx={[Si]:"ENVMAP_TYPE_CUBE",[Yi]:"ENVMAP_TYPE_CUBE",[ds]:"ENVMAP_TYPE_CUBE_UV"};function Mx(n){return n.envMap===!1?"ENVMAP_TYPE_CUBE":vx[n.envMapMode]||"ENVMAP_TYPE_CUBE"}var Sx={[Yi]:"ENVMAP_MODE_REFRACTION"};function wx(n){return n.envMap===!1?"ENVMAP_MODE_REFLECTION":Sx[n.envMapMode]||"ENVMAP_MODE_REFLECTION"}var Ex={[jo]:"ENVMAP_BLENDING_MULTIPLY",[kh]:"ENVMAP_BLENDING_MIX",[Nh]:"ENVMAP_BLENDING_ADD"};function Ax(n){return n.envMap===!1?"ENVMAP_BLENDING_NONE":Ex[n.combine]||"ENVMAP_BLENDING_NONE"}function Tx(n){let e=n.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,i=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:i,maxMip:t}}function Rx(n,e,t,i){let r=n.getContext(),s=t.defines,o=t.vertexShader,a=t.fragmentShader,l=_x(t),c=Mx(t),h=wx(t),f=Ax(t),u=Tx(t),d=hx(t),g=dx(s),x=r.createProgram(),p,m,v=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(Ss).join(`
`),p.length>0&&(p+=`
`),m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(Ss).join(`
`),m.length>0&&(m+=`
`)):(p=[pd(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Ss).join(`
`),m=[pd(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+f:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==vn?"#define TONE_MAPPING":"",t.toneMapping!==vn?De.tonemapping_pars_fragment:"",t.toneMapping!==vn?cx("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",De.colorspace_pars_fragment,ax("linearToOutputTexel",t.outputColorSpace),ux(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(Ss).join(`
`)),o=kc(o),o=hd(o,t),o=dd(o,t),a=kc(a),a=hd(a,t),a=dd(a,t),o=fd(o),a=fd(a),t.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,p=[d,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+p,m=["#define varying in",t.glslVersion===yc?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===yc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+m);let M=v+p+o,y=v+m+a,w=ld(r,r.VERTEX_SHADER,M),E=ld(r,r.FRAGMENT_SHADER,y);r.attachShader(x,w),r.attachShader(x,E),t.index0AttributeName!==void 0?r.bindAttribLocation(x,0,t.index0AttributeName):t.hasPositionAttribute===!0&&r.bindAttribLocation(x,0,"position"),r.linkProgram(x);function T(C){if(n.debug.checkShaderErrors){let I=r.getProgramInfoLog(x)||"",L=r.getShaderInfoLog(w)||"",H=r.getShaderInfoLog(E)||"",k=I.trim(),O=L.trim(),W=H.trim(),J=!0,Q=!0;if(r.getProgramParameter(x,r.LINK_STATUS)===!1)if(J=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(r,x,w,E);else{let j=ud(r,w,"vertex"),te=ud(r,E,"fragment");Re("WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(x,r.VALIDATE_STATUS)+`

Material Name: `+C.name+`
Material Type: `+C.type+`

Program Info Log: `+k+`
`+j+`
`+te)}else k!==""?Te("WebGLProgram: Program Info Log:",k):(O===""||W==="")&&(Q=!1);Q&&(C.diagnostics={runnable:J,programLog:k,vertexShader:{log:O,prefix:p},fragmentShader:{log:W,prefix:m}})}r.deleteShader(w),r.deleteShader(E),_=new Pr(r,x),A=fx(r,x)}let _;this.getUniforms=function(){return _===void 0&&T(this),_};let A;this.getAttributes=function(){return A===void 0&&T(this),A};let P=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return P===!1&&(P=r.getProgramParameter(x,ix)),P},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(x),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=rx++,this.cacheKey=e,this.usedTimes=1,this.program=x,this.vertexShader=w,this.fragmentShader=E,this}var Cx=0,Nc=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,i){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(i)===!1&&(r.add(i),i.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){let t=this.shaderCache,i=t.get(e);return i===void 0&&(i=new Dc(e),t.set(e,i)),i}},Dc=class{constructor(e){this.id=Cx++,this.code=e,this.usedTimes=0}};function Px(n){return n===Ei||n===xs||n===bs}function Lx(n,e,t,i,r,s){let o=new es,a=new Nc,l=new Set,c=[],h=new Map,f=i.logarithmicDepthBuffer,u=i.precision,d={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(_){return l.add(_),_===0?"uv":`uv${_}`}function x(_,A,P,C,I,L){let H=C.fog,k=I.geometry,O=_.isMeshStandardMaterial||_.isMeshLambertMaterial||_.isMeshPhongMaterial?C.environment:null,W=_.isMeshStandardMaterial||_.isMeshLambertMaterial&&!_.envMap||_.isMeshPhongMaterial&&!_.envMap,J=e.get(_.envMap||O,W),Q=J&&J.mapping===ds?J.image.height:null,j=d[_.type];_.precision!==null&&(u=i.getMaxPrecision(_.precision),u!==_.precision&&Te("WebGLProgram.getParameters:",_.precision,"not supported, using",u,"instead."));let te=k.morphAttributes.position||k.morphAttributes.normal||k.morphAttributes.color,me=te!==void 0?te.length:0,Oe=0;k.morphAttributes.position!==void 0&&(Oe=1),k.morphAttributes.normal!==void 0&&(Oe=2),k.morphAttributes.color!==void 0&&(Oe=3);let et,He,Z,se;if(j){let xe=Hn[j];et=xe.vertexShader,He=xe.fragmentShader}else{et=_.vertexShader,He=_.fragmentShader;let xe=a.getVertexShaderStage(_),ut=a.getFragmentShaderStage(_);a.update(_,xe,ut),Z=xe.id,se=ut.id}let ne=n.getRenderTarget(),Pe=n.state.buffers.depth.getReversed(),Ie=I.isInstancedMesh===!0,Ee=I.isBatchedMesh===!0,ft=!!_.map,ze=!!_.matcap,Ke=!!J,Ye=!!_.aoMap,We=!!_.lightMap,yt=!!_.bumpMap&&_.wireframe===!1,Mt=!!_.normalMap,Tt=!!_.displacementMap,kt=!!_.emissiveMap,ct=!!_.metalnessMap,xt=!!_.roughnessMap,D=_.anisotropy>0,Xt=_.clearcoat>0,$e=_.dispersion>0,R=_.iridescence>0,b=_.sheen>0,U=_.transmission>0,G=D&&!!_.anisotropyMap,X=Xt&&!!_.clearcoatMap,ie=Xt&&!!_.clearcoatNormalMap,oe=Xt&&!!_.clearcoatRoughnessMap,Y=R&&!!_.iridescenceMap,K=R&&!!_.iridescenceThicknessMap,ae=b&&!!_.sheenColorMap,ve=b&&!!_.sheenRoughnessMap,ue=!!_.specularMap,le=!!_.specularColorMap,we=!!_.specularIntensityMap,Ae=U&&!!_.transmissionMap,ke=U&&!!_.thicknessMap,N=!!_.gradientMap,re=!!_.alphaMap,$=_.alphaTest>0,ce=!!_.alphaHash,pe=!!_.extensions,ee=vn;_.toneMapped&&(ne===null||ne.isXRRenderTarget===!0)&&(ee=n.toneMapping);let _e={shaderID:j,shaderType:_.type,shaderName:_.name,vertexShader:et,fragmentShader:He,defines:_.defines,customVertexShaderID:Z,customFragmentShaderID:se,isRawShaderMaterial:_.isRawShaderMaterial===!0,glslVersion:_.glslVersion,precision:u,batching:Ee,batchingColor:Ee&&I._colorsTexture!==null,instancing:Ie,instancingColor:Ie&&I.instanceColor!==null,instancingMorph:Ie&&I.morphTexture!==null,outputColorSpace:ne===null?n.outputColorSpace:ne.isXRRenderTarget===!0?ne.texture.colorSpace:Ve.workingColorSpace,alphaToCoverage:!!_.alphaToCoverage,map:ft,matcap:ze,envMap:Ke,envMapMode:Ke&&J.mapping,envMapCubeUVHeight:Q,aoMap:Ye,lightMap:We,bumpMap:yt,normalMap:Mt,displacementMap:Tt,emissiveMap:kt,normalMapObjectSpace:Mt&&_.normalMapType===Uh,normalMapTangentSpace:Mt&&_.normalMapType===Na,packedNormalMap:Mt&&_.normalMapType===Na&&Px(_.normalMap.format),metalnessMap:ct,roughnessMap:xt,anisotropy:D,anisotropyMap:G,clearcoat:Xt,clearcoatMap:X,clearcoatNormalMap:ie,clearcoatRoughnessMap:oe,dispersion:$e,iridescence:R,iridescenceMap:Y,iridescenceThicknessMap:K,sheen:b,sheenColorMap:ae,sheenRoughnessMap:ve,specularMap:ue,specularColorMap:le,specularIntensityMap:we,transmission:U,transmissionMap:Ae,thicknessMap:ke,gradientMap:N,opaque:_.transparent===!1&&_.blending===Vi&&_.alphaToCoverage===!1,alphaMap:re,alphaTest:$,alphaHash:ce,combine:_.combine,mapUv:ft&&g(_.map.channel),aoMapUv:Ye&&g(_.aoMap.channel),lightMapUv:We&&g(_.lightMap.channel),bumpMapUv:yt&&g(_.bumpMap.channel),normalMapUv:Mt&&g(_.normalMap.channel),displacementMapUv:Tt&&g(_.displacementMap.channel),emissiveMapUv:kt&&g(_.emissiveMap.channel),metalnessMapUv:ct&&g(_.metalnessMap.channel),roughnessMapUv:xt&&g(_.roughnessMap.channel),anisotropyMapUv:G&&g(_.anisotropyMap.channel),clearcoatMapUv:X&&g(_.clearcoatMap.channel),clearcoatNormalMapUv:ie&&g(_.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:oe&&g(_.clearcoatRoughnessMap.channel),iridescenceMapUv:Y&&g(_.iridescenceMap.channel),iridescenceThicknessMapUv:K&&g(_.iridescenceThicknessMap.channel),sheenColorMapUv:ae&&g(_.sheenColorMap.channel),sheenRoughnessMapUv:ve&&g(_.sheenRoughnessMap.channel),specularMapUv:ue&&g(_.specularMap.channel),specularColorMapUv:le&&g(_.specularColorMap.channel),specularIntensityMapUv:we&&g(_.specularIntensityMap.channel),transmissionMapUv:Ae&&g(_.transmissionMap.channel),thicknessMapUv:ke&&g(_.thicknessMap.channel),alphaMapUv:re&&g(_.alphaMap.channel),vertexTangents:!!k.attributes.tangent&&(Mt||D),vertexNormals:!!k.attributes.normal,vertexColors:_.vertexColors,vertexAlphas:_.vertexColors===!0&&!!k.attributes.color&&k.attributes.color.itemSize===4,pointsUvs:I.isPoints===!0&&!!k.attributes.uv&&(ft||re),fog:!!H,useFog:_.fog===!0,fogExp2:!!H&&H.isFogExp2,flatShading:_.wireframe===!1&&(_.flatShading===!0||k.attributes.normal===void 0&&Mt===!1&&(_.isMeshLambertMaterial||_.isMeshPhongMaterial||_.isMeshStandardMaterial||_.isMeshPhysicalMaterial)),sizeAttenuation:_.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:Pe,skinning:I.isSkinnedMesh===!0,hasPositionAttribute:k.attributes.position!==void 0,morphTargets:k.morphAttributes.position!==void 0,morphNormals:k.morphAttributes.normal!==void 0,morphColors:k.morphAttributes.color!==void 0,morphTargetsCount:me,morphTextureStride:Oe,numDirLights:A.directional.length,numPointLights:A.point.length,numSpotLights:A.spot.length,numSpotLightMaps:A.spotLightMap.length,numRectAreaLights:A.rectArea.length,numHemiLights:A.hemi.length,numDirLightShadows:A.directionalShadowMap.length,numPointLightShadows:A.pointShadowMap.length,numSpotLightShadows:A.spotShadowMap.length,numSpotLightShadowsWithMaps:A.numSpotLightShadowsWithMaps,numLightProbes:A.numLightProbes,numLightProbeGrids:L.length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:_.dithering,shadowMapEnabled:n.shadowMap.enabled&&P.length>0,shadowMapType:n.shadowMap.type,toneMapping:ee,decodeVideoTexture:ft&&_.map.isVideoTexture===!0&&Ve.getTransfer(_.map.colorSpace)===je,decodeVideoTextureEmissive:kt&&_.emissiveMap.isVideoTexture===!0&&Ve.getTransfer(_.emissiveMap.colorSpace)===je,premultipliedAlpha:_.premultipliedAlpha,doubleSided:_.side===On,flipSided:_.side===Wt,useDepthPacking:_.depthPacking>=0,depthPacking:_.depthPacking||0,index0AttributeName:_.index0AttributeName,extensionClipCullDistance:pe&&_.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(pe&&_.extensions.multiDraw===!0||Ee)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:_.customProgramCacheKey()};return _e.vertexUv1s=l.has(1),_e.vertexUv2s=l.has(2),_e.vertexUv3s=l.has(3),l.clear(),_e}function p(_){let A=[];if(_.shaderID?A.push(_.shaderID):(A.push(_.customVertexShaderID),A.push(_.customFragmentShaderID)),_.defines!==void 0)for(let P in _.defines)A.push(P),A.push(_.defines[P]);return _.isRawShaderMaterial===!1&&(m(A,_),v(A,_),A.push(n.outputColorSpace)),A.push(_.customProgramCacheKey),A.join()}function m(_,A){_.push(A.precision),_.push(A.outputColorSpace),_.push(A.envMapMode),_.push(A.envMapCubeUVHeight),_.push(A.mapUv),_.push(A.alphaMapUv),_.push(A.lightMapUv),_.push(A.aoMapUv),_.push(A.bumpMapUv),_.push(A.normalMapUv),_.push(A.displacementMapUv),_.push(A.emissiveMapUv),_.push(A.metalnessMapUv),_.push(A.roughnessMapUv),_.push(A.anisotropyMapUv),_.push(A.clearcoatMapUv),_.push(A.clearcoatNormalMapUv),_.push(A.clearcoatRoughnessMapUv),_.push(A.iridescenceMapUv),_.push(A.iridescenceThicknessMapUv),_.push(A.sheenColorMapUv),_.push(A.sheenRoughnessMapUv),_.push(A.specularMapUv),_.push(A.specularColorMapUv),_.push(A.specularIntensityMapUv),_.push(A.transmissionMapUv),_.push(A.thicknessMapUv),_.push(A.combine),_.push(A.fogExp2),_.push(A.sizeAttenuation),_.push(A.morphTargetsCount),_.push(A.morphAttributeCount),_.push(A.numDirLights),_.push(A.numPointLights),_.push(A.numSpotLights),_.push(A.numSpotLightMaps),_.push(A.numHemiLights),_.push(A.numRectAreaLights),_.push(A.numDirLightShadows),_.push(A.numPointLightShadows),_.push(A.numSpotLightShadows),_.push(A.numSpotLightShadowsWithMaps),_.push(A.numLightProbes),_.push(A.shadowMapType),_.push(A.toneMapping),_.push(A.numClippingPlanes),_.push(A.numClipIntersection),_.push(A.depthPacking)}function v(_,A){o.disableAll(),A.instancing&&o.enable(0),A.instancingColor&&o.enable(1),A.instancingMorph&&o.enable(2),A.matcap&&o.enable(3),A.envMap&&o.enable(4),A.normalMapObjectSpace&&o.enable(5),A.normalMapTangentSpace&&o.enable(6),A.clearcoat&&o.enable(7),A.iridescence&&o.enable(8),A.alphaTest&&o.enable(9),A.vertexColors&&o.enable(10),A.vertexAlphas&&o.enable(11),A.vertexUv1s&&o.enable(12),A.vertexUv2s&&o.enable(13),A.vertexUv3s&&o.enable(14),A.vertexTangents&&o.enable(15),A.anisotropy&&o.enable(16),A.alphaHash&&o.enable(17),A.batching&&o.enable(18),A.dispersion&&o.enable(19),A.batchingColor&&o.enable(20),A.gradientMap&&o.enable(21),A.packedNormalMap&&o.enable(22),A.vertexNormals&&o.enable(23),_.push(o.mask),o.disableAll(),A.fog&&o.enable(0),A.useFog&&o.enable(1),A.flatShading&&o.enable(2),A.logarithmicDepthBuffer&&o.enable(3),A.reversedDepthBuffer&&o.enable(4),A.skinning&&o.enable(5),A.morphTargets&&o.enable(6),A.morphNormals&&o.enable(7),A.morphColors&&o.enable(8),A.premultipliedAlpha&&o.enable(9),A.shadowMapEnabled&&o.enable(10),A.doubleSided&&o.enable(11),A.flipSided&&o.enable(12),A.useDepthPacking&&o.enable(13),A.dithering&&o.enable(14),A.transmission&&o.enable(15),A.sheen&&o.enable(16),A.opaque&&o.enable(17),A.pointsUvs&&o.enable(18),A.decodeVideoTexture&&o.enable(19),A.decodeVideoTextureEmissive&&o.enable(20),A.alphaToCoverage&&o.enable(21),A.numLightProbeGrids>0&&o.enable(22),A.hasPositionAttribute&&o.enable(23),_.push(o.mask)}function M(_){let A=d[_.type],P;if(A){let C=Hn[A];P=$h.clone(C.uniforms)}else P=_.uniforms;return P}function y(_,A){let P=h.get(A);return P!==void 0?++P.usedTimes:(P=new Rx(n,A,_,r),c.push(P),h.set(A,P)),P}function w(_){if(--_.usedTimes===0){let A=c.indexOf(_);c[A]=c[c.length-1],c.pop(),h.delete(_.cacheKey),_.destroy()}}function E(_){a.remove(_)}function T(){a.dispose()}return{getParameters:x,getProgramCacheKey:p,getUniforms:M,acquireProgram:y,releaseProgram:w,releaseShaderCache:E,programs:c,dispose:T}}function Ix(){let n=new WeakMap;function e(o){return n.has(o)}function t(o){let a=n.get(o);return a===void 0&&(a={},n.set(o,a)),a}function i(o){n.delete(o)}function r(o,a,l){n.get(o)[a]=l}function s(){n=new WeakMap}return{has:e,get:t,remove:i,update:r,dispose:s}}function kx(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.materialVariant!==e.materialVariant?n.materialVariant-e.materialVariant:n.z!==e.z?n.z-e.z:n.id-e.id}function md(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function gd(){let n=[],e=0,t=[],i=[],r=[];function s(){e=0,t.length=0,i.length=0,r.length=0}function o(u){let d=0;return u.isInstancedMesh&&(d+=2),u.isSkinnedMesh&&(d+=1),d}function a(u,d,g,x,p,m){let v=n[e];return v===void 0?(v={id:u.id,object:u,geometry:d,material:g,materialVariant:o(u),groupOrder:x,renderOrder:u.renderOrder,z:p,group:m},n[e]=v):(v.id=u.id,v.object=u,v.geometry=d,v.material=g,v.materialVariant=o(u),v.groupOrder=x,v.renderOrder=u.renderOrder,v.z=p,v.group=m),e++,v}function l(u,d,g,x,p,m){let v=a(u,d,g,x,p,m);g.transmission>0?i.push(v):g.transparent===!0?r.push(v):t.push(v)}function c(u,d,g,x,p,m){let v=a(u,d,g,x,p,m);g.transmission>0?i.unshift(v):g.transparent===!0?r.unshift(v):t.unshift(v)}function h(u,d,g){t.length>1&&t.sort(u||kx),i.length>1&&i.sort(d||md),r.length>1&&r.sort(d||md),g&&(t.reverse(),i.reverse(),r.reverse())}function f(){for(let u=e,d=n.length;u<d;u++){let g=n[u];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:t,transmissive:i,transparent:r,init:s,push:l,unshift:c,finish:f,sort:h}}function Nx(){let n=new WeakMap;function e(i,r){let s=n.get(i),o;return s===void 0?(o=new gd,n.set(i,[o])):r>=s.length?(o=new gd,s.push(o)):o=s[r],o}function t(){n=new WeakMap}return{get:e,dispose:t}}function Dx(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new V,color:new Ue};break;case"SpotLight":t={position:new V,direction:new V,color:new Ue,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new V,color:new Ue,distance:0,decay:0};break;case"HemisphereLight":t={direction:new V,skyColor:new Ue,groundColor:new Ue};break;case"RectAreaLight":t={color:new Ue,position:new V,halfWidth:new V,halfHeight:new V};break}return n[e.id]=t,t}}}function Fx(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Be};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Be};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Be,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}var Ux=0;function Ox(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function Bx(n){let e=new Dx,t=Fx(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new V);let r=new V,s=new at,o=new at;function a(c){let h=0,f=0,u=0;for(let A=0;A<9;A++)i.probe[A].set(0,0,0);let d=0,g=0,x=0,p=0,m=0,v=0,M=0,y=0,w=0,E=0,T=0;c.sort(Ox);for(let A=0,P=c.length;A<P;A++){let C=c[A],I=C.color,L=C.intensity,H=C.distance,k=null;if(C.shadow&&C.shadow.map&&(C.shadow.map.texture.format===Ei?k=C.shadow.map.texture:k=C.shadow.map.depthTexture||C.shadow.map.texture),C.isAmbientLight)h+=I.r*L,f+=I.g*L,u+=I.b*L;else if(C.isLightProbe){for(let O=0;O<9;O++)i.probe[O].addScaledVector(C.sh.coefficients[O],L);T++}else if(C.isDirectionalLight){let O=e.get(C);if(O.color.copy(C.color).multiplyScalar(C.intensity),C.castShadow){let W=C.shadow,J=t.get(C);J.shadowIntensity=W.intensity,J.shadowBias=W.bias,J.shadowNormalBias=W.normalBias,J.shadowRadius=W.radius,J.shadowMapSize=W.mapSize,i.directionalShadow[d]=J,i.directionalShadowMap[d]=k,i.directionalShadowMatrix[d]=C.shadow.matrix,v++}i.directional[d]=O,d++}else if(C.isSpotLight){let O=e.get(C);O.position.setFromMatrixPosition(C.matrixWorld),O.color.copy(I).multiplyScalar(L),O.distance=H,O.coneCos=Math.cos(C.angle),O.penumbraCos=Math.cos(C.angle*(1-C.penumbra)),O.decay=C.decay,i.spot[x]=O;let W=C.shadow;if(C.map&&(i.spotLightMap[w]=C.map,w++,W.updateMatrices(C),C.castShadow&&E++),i.spotLightMatrix[x]=W.matrix,C.castShadow){let J=t.get(C);J.shadowIntensity=W.intensity,J.shadowBias=W.bias,J.shadowNormalBias=W.normalBias,J.shadowRadius=W.radius,J.shadowMapSize=W.mapSize,i.spotShadow[x]=J,i.spotShadowMap[x]=k,y++}x++}else if(C.isRectAreaLight){let O=e.get(C);O.color.copy(I).multiplyScalar(L),O.halfWidth.set(C.width*.5,0,0),O.halfHeight.set(0,C.height*.5,0),i.rectArea[p]=O,p++}else if(C.isPointLight){let O=e.get(C);if(O.color.copy(C.color).multiplyScalar(C.intensity),O.distance=C.distance,O.decay=C.decay,C.castShadow){let W=C.shadow,J=t.get(C);J.shadowIntensity=W.intensity,J.shadowBias=W.bias,J.shadowNormalBias=W.normalBias,J.shadowRadius=W.radius,J.shadowMapSize=W.mapSize,J.shadowCameraNear=W.camera.near,J.shadowCameraFar=W.camera.far,i.pointShadow[g]=J,i.pointShadowMap[g]=k,i.pointShadowMatrix[g]=C.shadow.matrix,M++}i.point[g]=O,g++}else if(C.isHemisphereLight){let O=e.get(C);O.skyColor.copy(C.color).multiplyScalar(L),O.groundColor.copy(C.groundColor).multiplyScalar(L),i.hemi[m]=O,m++}}p>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=he.LTC_FLOAT_1,i.rectAreaLTC2=he.LTC_FLOAT_2):(i.rectAreaLTC1=he.LTC_HALF_1,i.rectAreaLTC2=he.LTC_HALF_2)),i.ambient[0]=h,i.ambient[1]=f,i.ambient[2]=u;let _=i.hash;(_.directionalLength!==d||_.pointLength!==g||_.spotLength!==x||_.rectAreaLength!==p||_.hemiLength!==m||_.numDirectionalShadows!==v||_.numPointShadows!==M||_.numSpotShadows!==y||_.numSpotMaps!==w||_.numLightProbes!==T)&&(i.directional.length=d,i.spot.length=x,i.rectArea.length=p,i.point.length=g,i.hemi.length=m,i.directionalShadow.length=v,i.directionalShadowMap.length=v,i.pointShadow.length=M,i.pointShadowMap.length=M,i.spotShadow.length=y,i.spotShadowMap.length=y,i.directionalShadowMatrix.length=v,i.pointShadowMatrix.length=M,i.spotLightMatrix.length=y+w-E,i.spotLightMap.length=w,i.numSpotLightShadowsWithMaps=E,i.numLightProbes=T,_.directionalLength=d,_.pointLength=g,_.spotLength=x,_.rectAreaLength=p,_.hemiLength=m,_.numDirectionalShadows=v,_.numPointShadows=M,_.numSpotShadows=y,_.numSpotMaps=w,_.numLightProbes=T,i.version=Ux++)}function l(c,h){let f=0,u=0,d=0,g=0,x=0,p=h.matrixWorldInverse;for(let m=0,v=c.length;m<v;m++){let M=c[m];if(M.isDirectionalLight){let y=i.directional[f];y.direction.setFromMatrixPosition(M.matrixWorld),r.setFromMatrixPosition(M.target.matrixWorld),y.direction.sub(r),y.direction.transformDirection(p),f++}else if(M.isSpotLight){let y=i.spot[d];y.position.setFromMatrixPosition(M.matrixWorld),y.position.applyMatrix4(p),y.direction.setFromMatrixPosition(M.matrixWorld),r.setFromMatrixPosition(M.target.matrixWorld),y.direction.sub(r),y.direction.transformDirection(p),d++}else if(M.isRectAreaLight){let y=i.rectArea[g];y.position.setFromMatrixPosition(M.matrixWorld),y.position.applyMatrix4(p),o.identity(),s.copy(M.matrixWorld),s.premultiply(p),o.extractRotation(s),y.halfWidth.set(M.width*.5,0,0),y.halfHeight.set(0,M.height*.5,0),y.halfWidth.applyMatrix4(o),y.halfHeight.applyMatrix4(o),g++}else if(M.isPointLight){let y=i.point[u];y.position.setFromMatrixPosition(M.matrixWorld),y.position.applyMatrix4(p),u++}else if(M.isHemisphereLight){let y=i.hemi[x];y.direction.setFromMatrixPosition(M.matrixWorld),y.direction.transformDirection(p),x++}}}return{setup:a,setupView:l,state:i}}function yd(n){let e=new Bx(n),t=[],i=[],r=[];function s(u){f.camera=u,t.length=0,i.length=0,r.length=0}function o(u){t.push(u)}function a(u){i.push(u)}function l(u){r.push(u)}function c(){e.setup(t)}function h(u){e.setupView(t,u)}let f={lightsArray:t,shadowsArray:i,lightProbeGridArray:r,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:s,state:f,setupLights:c,setupLightsView:h,pushLight:o,pushShadow:a,pushLightProbeGrid:l}}function zx(n){let e=new WeakMap;function t(r,s=0){let o=e.get(r),a;return o===void 0?(a=new yd(n),e.set(r,[a])):s>=o.length?(a=new yd(n),o.push(a)):a=o[s],a}function i(){e=new WeakMap}return{get:t,dispose:i}}var Vx=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Gx=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Hx=[new V(1,0,0),new V(-1,0,0),new V(0,1,0),new V(0,-1,0),new V(0,0,1),new V(0,0,-1)],Wx=[new V(0,-1,0),new V(0,-1,0),new V(0,0,1),new V(0,0,-1),new V(0,-1,0),new V(0,-1,0)],xd=new at,Ms=new V,Rc=new V;function qx(n,e,t){let i=new Sr,r=new Be,s=new Be,o=new st,a=new No,l=new Do,c={},h=t.maxTextureSize,f={[ei]:Wt,[Wt]:ei,[On]:On},u=new Ft({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Be},radius:{value:4}},vertexShader:Vx,fragmentShader:Gx}),d=u.clone();d.defines.HORIZONTAL_PASS=1;let g=new Dt;g.setAttribute("position",new rt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let x=new lt(g,u),p=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=hs;let m=this.type;this.render=function(E,T,_){if(p.enabled===!1||p.autoUpdate===!1&&p.needsUpdate===!1||E.length===0)return;this.type===ph&&(Te("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=hs);let A=n.getRenderTarget(),P=n.getActiveCubeFace(),C=n.getActiveMipmapLevel(),I=n.state;I.setBlending(Bn),I.buffers.depth.getReversed()===!0?I.buffers.color.setClear(0,0,0,0):I.buffers.color.setClear(1,1,1,1),I.buffers.depth.setTest(!0),I.setScissorTest(!1);let L=m!==this.type;L&&T.traverse(function(H){H.material&&(Array.isArray(H.material)?H.material.forEach(k=>k.needsUpdate=!0):H.material.needsUpdate=!0)});for(let H=0,k=E.length;H<k;H++){let O=E[H],W=O.shadow;if(W===void 0){Te("WebGLShadowMap:",O,"has no shadow.");continue}if(W.autoUpdate===!1&&W.needsUpdate===!1)continue;r.copy(W.mapSize);let J=W.getFrameExtents();r.multiply(J),s.copy(W.mapSize),(r.x>h||r.y>h)&&(r.x>h&&(s.x=Math.floor(h/J.x),r.x=s.x*J.x,W.mapSize.x=s.x),r.y>h&&(s.y=Math.floor(h/J.y),r.y=s.y*J.y,W.mapSize.y=s.y));let Q=n.state.buffers.depth.getReversed();if(W.camera._reversedDepth=Q,W.map===null||L===!0){if(W.map!==null&&(W.map.depthTexture!==null&&(W.map.depthTexture.dispose(),W.map.depthTexture=null),W.map.dispose()),this.type===Ar){if(O.isPointLight){Te("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}W.map=new tn(r.x,r.y,{format:Ei,type:Vn,minFilter:Nt,magFilter:Nt,generateMipmaps:!1}),W.map.texture.name=O.name+".shadowMap",W.map.depthTexture=new ni(r.x,r.y,Sn),W.map.depthTexture.name=O.name+".shadowMapDepth",W.map.depthTexture.format=Dn,W.map.depthTexture.compareFunction=null,W.map.depthTexture.minFilter=Ct,W.map.depthTexture.magFilter=Ct}else O.isPointLight?(W.map=new za(r.x),W.map.depthTexture=new Io(r.x,Mn)):(W.map=new tn(r.x,r.y),W.map.depthTexture=new ni(r.x,r.y,Mn)),W.map.depthTexture.name=O.name+".shadowMap",W.map.depthTexture.format=Dn,this.type===hs?(W.map.depthTexture.compareFunction=Q?Fa:Da,W.map.depthTexture.minFilter=Nt,W.map.depthTexture.magFilter=Nt):(W.map.depthTexture.compareFunction=null,W.map.depthTexture.minFilter=Ct,W.map.depthTexture.magFilter=Ct);W.camera.updateProjectionMatrix()}let j=W.map.isWebGLCubeRenderTarget?6:1;for(let te=0;te<j;te++){if(W.map.isWebGLCubeRenderTarget)n.setRenderTarget(W.map,te),n.clear();else{te===0&&(n.setRenderTarget(W.map),n.clear());let me=W.getViewport(te);o.set(s.x*me.x,s.y*me.y,s.x*me.z,s.y*me.w),I.viewport(o)}if(O.isPointLight){let me=W.camera,Oe=W.matrix,et=O.distance||me.far;et!==me.far&&(me.far=et,me.updateProjectionMatrix()),Ms.setFromMatrixPosition(O.matrixWorld),me.position.copy(Ms),Rc.copy(me.position),Rc.add(Hx[te]),me.up.copy(Wx[te]),me.lookAt(Rc),me.updateMatrixWorld(),Oe.makeTranslation(-Ms.x,-Ms.y,-Ms.z),xd.multiplyMatrices(me.projectionMatrix,me.matrixWorldInverse),W._frustum.setFromProjectionMatrix(xd,me.coordinateSystem,me.reversedDepth)}else W.updateMatrices(O);i=W.getFrustum(),y(T,_,W.camera,O,this.type)}W.isPointLightShadow!==!0&&this.type===Ar&&v(W,_),W.needsUpdate=!1}m=this.type,p.needsUpdate=!1,n.setRenderTarget(A,P,C)};function v(E,T){let _=e.update(x);u.defines.VSM_SAMPLES!==E.blurSamples&&(u.defines.VSM_SAMPLES=E.blurSamples,d.defines.VSM_SAMPLES=E.blurSamples,u.needsUpdate=!0,d.needsUpdate=!0),E.mapPass===null&&(E.mapPass=new tn(r.x,r.y,{format:Ei,type:Vn})),u.uniforms.shadow_pass.value=E.map.depthTexture,u.uniforms.resolution.value=E.mapSize,u.uniforms.radius.value=E.radius,n.setRenderTarget(E.mapPass),n.clear(),n.renderBufferDirect(T,null,_,u,x,null),d.uniforms.shadow_pass.value=E.mapPass.texture,d.uniforms.resolution.value=E.mapSize,d.uniforms.radius.value=E.radius,n.setRenderTarget(E.map),n.clear(),n.renderBufferDirect(T,null,_,d,x,null)}function M(E,T,_,A){let P=null,C=_.isPointLight===!0?E.customDistanceMaterial:E.customDepthMaterial;if(C!==void 0)P=C;else if(P=_.isPointLight===!0?l:a,n.localClippingEnabled&&T.clipShadows===!0&&Array.isArray(T.clippingPlanes)&&T.clippingPlanes.length!==0||T.displacementMap&&T.displacementScale!==0||T.alphaMap&&T.alphaTest>0||T.map&&T.alphaTest>0||T.alphaToCoverage===!0){let I=P.uuid,L=T.uuid,H=c[I];H===void 0&&(H={},c[I]=H);let k=H[L];k===void 0&&(k=P.clone(),H[L]=k,T.addEventListener("dispose",w)),P=k}if(P.visible=T.visible,P.wireframe=T.wireframe,A===Ar?P.side=T.shadowSide!==null?T.shadowSide:T.side:P.side=T.shadowSide!==null?T.shadowSide:f[T.side],P.alphaMap=T.alphaMap,P.alphaTest=T.alphaToCoverage===!0?.5:T.alphaTest,P.map=T.map,P.clipShadows=T.clipShadows,P.clippingPlanes=T.clippingPlanes,P.clipIntersection=T.clipIntersection,P.displacementMap=T.displacementMap,P.displacementScale=T.displacementScale,P.displacementBias=T.displacementBias,P.wireframeLinewidth=T.wireframeLinewidth,P.linewidth=T.linewidth,_.isPointLight===!0&&P.isMeshDistanceMaterial===!0){let I=n.properties.get(P);I.light=_}return P}function y(E,T,_,A,P){if(E.visible===!1)return;if(E.layers.test(T.layers)&&(E.isMesh||E.isLine||E.isPoints)&&(E.castShadow||E.receiveShadow&&P===Ar)&&(!E.frustumCulled||i.intersectsObject(E))){E.modelViewMatrix.multiplyMatrices(_.matrixWorldInverse,E.matrixWorld);let L=e.update(E),H=E.material;if(Array.isArray(H)){let k=L.groups;for(let O=0,W=k.length;O<W;O++){let J=k[O],Q=H[J.materialIndex];if(Q&&Q.visible){let j=M(E,Q,A,P);E.onBeforeShadow(n,E,T,_,L,j,J),n.renderBufferDirect(_,null,L,j,E,J),E.onAfterShadow(n,E,T,_,L,j,J)}}}else if(H.visible){let k=M(E,H,A,P);E.onBeforeShadow(n,E,T,_,L,k,null),n.renderBufferDirect(_,null,L,k,E,null),E.onAfterShadow(n,E,T,_,L,k,null)}}let I=E.children;for(let L=0,H=I.length;L<H;L++)y(I[L],T,_,A,P)}function w(E){E.target.removeEventListener("dispose",w);for(let _ in c){let A=c[_],P=E.target.uuid;P in A&&(A[P].dispose(),delete A[P])}}}function Xx(n,e){function t(){let N=!1,re=new st,$=null,ce=new st(0,0,0,0);return{setMask:function(pe){$!==pe&&!N&&(n.colorMask(pe,pe,pe,pe),$=pe)},setLocked:function(pe){N=pe},setClear:function(pe,ee,_e,xe,ut){ut===!0&&(pe*=xe,ee*=xe,_e*=xe),re.set(pe,ee,_e,xe),ce.equals(re)===!1&&(n.clearColor(pe,ee,_e,xe),ce.copy(re))},reset:function(){N=!1,$=null,ce.set(-1,0,0,0)}}}function i(){let N=!1,re=!1,$=null,ce=null,pe=null;return{setReversed:function(ee){if(re!==ee){let _e=e.get("EXT_clip_control");ee?_e.clipControlEXT(_e.LOWER_LEFT_EXT,_e.ZERO_TO_ONE_EXT):_e.clipControlEXT(_e.LOWER_LEFT_EXT,_e.NEGATIVE_ONE_TO_ONE_EXT),re=ee;let xe=pe;pe=null,this.setClear(xe)}},getReversed:function(){return re},setTest:function(ee){ee?ne(n.DEPTH_TEST):Pe(n.DEPTH_TEST)},setMask:function(ee){$!==ee&&!N&&(n.depthMask(ee),$=ee)},setFunc:function(ee){if(re&&(ee=Yh[ee]),ce!==ee){switch(ee){case go:n.depthFunc(n.NEVER);break;case yo:n.depthFunc(n.ALWAYS);break;case xo:n.depthFunc(n.LESS);break;case Gi:n.depthFunc(n.LEQUAL);break;case bo:n.depthFunc(n.EQUAL);break;case _o:n.depthFunc(n.GEQUAL);break;case vo:n.depthFunc(n.GREATER);break;case Mo:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}ce=ee}},setLocked:function(ee){N=ee},setClear:function(ee){pe!==ee&&(pe=ee,re&&(ee=1-ee),n.clearDepth(ee))},reset:function(){N=!1,$=null,ce=null,pe=null,re=!1}}}function r(){let N=!1,re=null,$=null,ce=null,pe=null,ee=null,_e=null,xe=null,ut=null;return{setTest:function(tt){N||(tt?ne(n.STENCIL_TEST):Pe(n.STENCIL_TEST))},setMask:function(tt){re!==tt&&!N&&(n.stencilMask(tt),re=tt)},setFunc:function(tt,Cn,Pn){($!==tt||ce!==Cn||pe!==Pn)&&(n.stencilFunc(tt,Cn,Pn),$=tt,ce=Cn,pe=Pn)},setOp:function(tt,Cn,Pn){(ee!==tt||_e!==Cn||xe!==Pn)&&(n.stencilOp(tt,Cn,Pn),ee=tt,_e=Cn,xe=Pn)},setLocked:function(tt){N=tt},setClear:function(tt){ut!==tt&&(n.clearStencil(tt),ut=tt)},reset:function(){N=!1,re=null,$=null,ce=null,pe=null,ee=null,_e=null,xe=null,ut=null}}}let s=new t,o=new i,a=new r,l=new WeakMap,c=new WeakMap,h={},f={},u={},d=new WeakMap,g=[],x=null,p=!1,m=null,v=null,M=null,y=null,w=null,E=null,T=null,_=new Ue(0,0,0),A=0,P=!1,C=null,I=null,L=null,H=null,k=null,O=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS),W=!1,J=0,Q=n.getParameter(n.VERSION);Q.indexOf("WebGL")!==-1?(J=parseFloat(/^WebGL (\d)/.exec(Q)[1]),W=J>=1):Q.indexOf("OpenGL ES")!==-1&&(J=parseFloat(/^OpenGL ES (\d)/.exec(Q)[1]),W=J>=2);let j=null,te={},me=n.getParameter(n.SCISSOR_BOX),Oe=n.getParameter(n.VIEWPORT),et=new st().fromArray(me),He=new st().fromArray(Oe);function Z(N,re,$,ce){let pe=new Uint8Array(4),ee=n.createTexture();n.bindTexture(N,ee),n.texParameteri(N,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(N,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let _e=0;_e<$;_e++)N===n.TEXTURE_3D||N===n.TEXTURE_2D_ARRAY?n.texImage3D(re,0,n.RGBA,1,1,ce,0,n.RGBA,n.UNSIGNED_BYTE,pe):n.texImage2D(re+_e,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,pe);return ee}let se={};se[n.TEXTURE_2D]=Z(n.TEXTURE_2D,n.TEXTURE_2D,1),se[n.TEXTURE_CUBE_MAP]=Z(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),se[n.TEXTURE_2D_ARRAY]=Z(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),se[n.TEXTURE_3D]=Z(n.TEXTURE_3D,n.TEXTURE_3D,1,1),s.setClear(0,0,0,1),o.setClear(1),a.setClear(0),ne(n.DEPTH_TEST),o.setFunc(Gi),yt(!1),Mt(Jl),ne(n.CULL_FACE),Ye(Bn);function ne(N){h[N]!==!0&&(n.enable(N),h[N]=!0)}function Pe(N){h[N]!==!1&&(n.disable(N),h[N]=!1)}function Ie(N,re){return u[N]!==re?(n.bindFramebuffer(N,re),u[N]=re,N===n.DRAW_FRAMEBUFFER&&(u[n.FRAMEBUFFER]=re),N===n.FRAMEBUFFER&&(u[n.DRAW_FRAMEBUFFER]=re),!0):!1}function Ee(N,re){let $=g,ce=!1;if(N){$=d.get(re),$===void 0&&($=[],d.set(re,$));let pe=N.textures;if($.length!==pe.length||$[0]!==n.COLOR_ATTACHMENT0){for(let ee=0,_e=pe.length;ee<_e;ee++)$[ee]=n.COLOR_ATTACHMENT0+ee;$.length=pe.length,ce=!0}}else $[0]!==n.BACK&&($[0]=n.BACK,ce=!0);ce&&n.drawBuffers($)}function ft(N){return x!==N?(n.useProgram(N),x=N,!0):!1}let ze={[yi]:n.FUNC_ADD,[gh]:n.FUNC_SUBTRACT,[yh]:n.FUNC_REVERSE_SUBTRACT};ze[xh]=n.MIN,ze[bh]=n.MAX;let Ke={[_h]:n.ZERO,[vh]:n.ONE,[Mh]:n.SRC_COLOR,[po]:n.SRC_ALPHA,[Rh]:n.SRC_ALPHA_SATURATE,[Ah]:n.DST_COLOR,[wh]:n.DST_ALPHA,[Sh]:n.ONE_MINUS_SRC_COLOR,[mo]:n.ONE_MINUS_SRC_ALPHA,[Th]:n.ONE_MINUS_DST_COLOR,[Eh]:n.ONE_MINUS_DST_ALPHA,[Ch]:n.CONSTANT_COLOR,[Ph]:n.ONE_MINUS_CONSTANT_COLOR,[Lh]:n.CONSTANT_ALPHA,[Ih]:n.ONE_MINUS_CONSTANT_ALPHA};function Ye(N,re,$,ce,pe,ee,_e,xe,ut,tt){if(N===Bn){p===!0&&(Pe(n.BLEND),p=!1);return}if(p===!1&&(ne(n.BLEND),p=!0),N!==mh){if(N!==m||tt!==P){if((v!==yi||w!==yi)&&(n.blendEquation(n.FUNC_ADD),v=yi,w=yi),tt)switch(N){case Vi:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Ql:n.blendFunc(n.ONE,n.ONE);break;case ec:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case tc:n.blendFuncSeparate(n.DST_COLOR,n.ONE_MINUS_SRC_ALPHA,n.ZERO,n.ONE);break;default:Re("WebGLState: Invalid blending: ",N);break}else switch(N){case Vi:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Ql:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE,n.ONE,n.ONE);break;case ec:Re("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case tc:Re("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Re("WebGLState: Invalid blending: ",N);break}M=null,y=null,E=null,T=null,_.set(0,0,0),A=0,m=N,P=tt}return}pe=pe||re,ee=ee||$,_e=_e||ce,(re!==v||pe!==w)&&(n.blendEquationSeparate(ze[re],ze[pe]),v=re,w=pe),($!==M||ce!==y||ee!==E||_e!==T)&&(n.blendFuncSeparate(Ke[$],Ke[ce],Ke[ee],Ke[_e]),M=$,y=ce,E=ee,T=_e),(xe.equals(_)===!1||ut!==A)&&(n.blendColor(xe.r,xe.g,xe.b,ut),_.copy(xe),A=ut),m=N,P=!1}function We(N,re){N.side===On?Pe(n.CULL_FACE):ne(n.CULL_FACE);let $=N.side===Wt;re&&($=!$),yt($),N.blending===Vi&&N.transparent===!1?Ye(Bn):Ye(N.blending,N.blendEquation,N.blendSrc,N.blendDst,N.blendEquationAlpha,N.blendSrcAlpha,N.blendDstAlpha,N.blendColor,N.blendAlpha,N.premultipliedAlpha),o.setFunc(N.depthFunc),o.setTest(N.depthTest),o.setMask(N.depthWrite),s.setMask(N.colorWrite);let ce=N.stencilWrite;a.setTest(ce),ce&&(a.setMask(N.stencilWriteMask),a.setFunc(N.stencilFunc,N.stencilRef,N.stencilFuncMask),a.setOp(N.stencilFail,N.stencilZFail,N.stencilZPass)),kt(N.polygonOffset,N.polygonOffsetFactor,N.polygonOffsetUnits),N.alphaToCoverage===!0?ne(n.SAMPLE_ALPHA_TO_COVERAGE):Pe(n.SAMPLE_ALPHA_TO_COVERAGE)}function yt(N){C!==N&&(N?n.frontFace(n.CW):n.frontFace(n.CCW),C=N)}function Mt(N){N!==dh?(ne(n.CULL_FACE),N!==I&&(N===Jl?n.cullFace(n.BACK):N===fh?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):Pe(n.CULL_FACE),I=N}function Tt(N){N!==L&&(W&&n.lineWidth(N),L=N)}function kt(N,re,$){N?(ne(n.POLYGON_OFFSET_FILL),(H!==re||k!==$)&&(H=re,k=$,o.getReversed()&&(re=-re),n.polygonOffset(re,$))):Pe(n.POLYGON_OFFSET_FILL)}function ct(N){N?ne(n.SCISSOR_TEST):Pe(n.SCISSOR_TEST)}function xt(N){N===void 0&&(N=n.TEXTURE0+O-1),j!==N&&(n.activeTexture(N),j=N)}function D(N,re,$){$===void 0&&(j===null?$=n.TEXTURE0+O-1:$=j);let ce=te[$];ce===void 0&&(ce={type:void 0,texture:void 0},te[$]=ce),(ce.type!==N||ce.texture!==re)&&(j!==$&&(n.activeTexture($),j=$),n.bindTexture(N,re||se[N]),ce.type=N,ce.texture=re)}function Xt(){let N=te[j];N!==void 0&&N.type!==void 0&&(n.bindTexture(N.type,null),N.type=void 0,N.texture=void 0)}function $e(){try{n.compressedTexImage2D(...arguments)}catch(N){Re("WebGLState:",N)}}function R(){try{n.compressedTexImage3D(...arguments)}catch(N){Re("WebGLState:",N)}}function b(){try{n.texSubImage2D(...arguments)}catch(N){Re("WebGLState:",N)}}function U(){try{n.texSubImage3D(...arguments)}catch(N){Re("WebGLState:",N)}}function G(){try{n.compressedTexSubImage2D(...arguments)}catch(N){Re("WebGLState:",N)}}function X(){try{n.compressedTexSubImage3D(...arguments)}catch(N){Re("WebGLState:",N)}}function ie(){try{n.texStorage2D(...arguments)}catch(N){Re("WebGLState:",N)}}function oe(){try{n.texStorage3D(...arguments)}catch(N){Re("WebGLState:",N)}}function Y(){try{n.texImage2D(...arguments)}catch(N){Re("WebGLState:",N)}}function K(){try{n.texImage3D(...arguments)}catch(N){Re("WebGLState:",N)}}function ae(N){return f[N]!==void 0?f[N]:n.getParameter(N)}function ve(N,re){f[N]!==re&&(n.pixelStorei(N,re),f[N]=re)}function ue(N){et.equals(N)===!1&&(n.scissor(N.x,N.y,N.z,N.w),et.copy(N))}function le(N){He.equals(N)===!1&&(n.viewport(N.x,N.y,N.z,N.w),He.copy(N))}function we(N,re){let $=c.get(re);$===void 0&&($=new WeakMap,c.set(re,$));let ce=$.get(N);ce===void 0&&(ce=n.getUniformBlockIndex(re,N.name),$.set(N,ce))}function Ae(N,re){let ce=c.get(re).get(N);l.get(re)!==ce&&(n.uniformBlockBinding(re,ce,N.__bindingPointIndex),l.set(re,ce))}function ke(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),o.setReversed(!1),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),n.pixelStorei(n.PACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,n.BROWSER_DEFAULT_WEBGL),n.pixelStorei(n.PACK_ROW_LENGTH,0),n.pixelStorei(n.PACK_SKIP_PIXELS,0),n.pixelStorei(n.PACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_ROW_LENGTH,0),n.pixelStorei(n.UNPACK_IMAGE_HEIGHT,0),n.pixelStorei(n.UNPACK_SKIP_PIXELS,0),n.pixelStorei(n.UNPACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_SKIP_IMAGES,0),h={},f={},j=null,te={},u={},d=new WeakMap,g=[],x=null,p=!1,m=null,v=null,M=null,y=null,w=null,E=null,T=null,_=new Ue(0,0,0),A=0,P=!1,C=null,I=null,L=null,H=null,k=null,et.set(0,0,n.canvas.width,n.canvas.height),He.set(0,0,n.canvas.width,n.canvas.height),s.reset(),o.reset(),a.reset()}return{buffers:{color:s,depth:o,stencil:a},enable:ne,disable:Pe,bindFramebuffer:Ie,drawBuffers:Ee,useProgram:ft,setBlending:Ye,setMaterial:We,setFlipSided:yt,setCullFace:Mt,setLineWidth:Tt,setPolygonOffset:kt,setScissorTest:ct,activeTexture:xt,bindTexture:D,unbindTexture:Xt,compressedTexImage2D:$e,compressedTexImage3D:R,texImage2D:Y,texImage3D:K,pixelStorei:ve,getParameter:ae,updateUBOMapping:we,uniformBlockBinding:Ae,texStorage2D:ie,texStorage3D:oe,texSubImage2D:b,texSubImage3D:U,compressedTexSubImage2D:G,compressedTexSubImage3D:X,scissor:ue,viewport:le,reset:ke}}function Yx(n,e,t,i,r,s,o){let a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Be,h=new WeakMap,f=new Set,u,d=new WeakMap,g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function x(R,b){return g?new OffscreenCanvas(R,b):Jr("canvas")}function p(R,b,U){let G=1,X=$e(R);if((X.width>U||X.height>U)&&(G=U/Math.max(X.width,X.height)),G<1)if(typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&R instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&R instanceof ImageBitmap||typeof VideoFrame<"u"&&R instanceof VideoFrame){let ie=Math.floor(G*X.width),oe=Math.floor(G*X.height);u===void 0&&(u=x(ie,oe));let Y=b?x(ie,oe):u;return Y.width=ie,Y.height=oe,Y.getContext("2d").drawImage(R,0,0,ie,oe),Te("WebGLRenderer: Texture has been resized from ("+X.width+"x"+X.height+") to ("+ie+"x"+oe+")."),Y}else return"data"in R&&Te("WebGLRenderer: Image in DataTexture is too big ("+X.width+"x"+X.height+")."),R;return R}function m(R){return R.generateMipmaps}function v(R){n.generateMipmap(R)}function M(R){return R.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:R.isWebGL3DRenderTarget?n.TEXTURE_3D:R.isWebGLArrayRenderTarget||R.isCompressedArrayTexture?n.TEXTURE_2D_ARRAY:n.TEXTURE_2D}function y(R,b,U,G,X,ie=!1){if(R!==null){if(n[R]!==void 0)return n[R];Te("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+R+"'")}let oe;G&&(oe=e.get("EXT_texture_norm16"),oe||Te("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let Y=b;if(b===n.RED&&(U===n.FLOAT&&(Y=n.R32F),U===n.HALF_FLOAT&&(Y=n.R16F),U===n.UNSIGNED_BYTE&&(Y=n.R8),U===n.UNSIGNED_SHORT&&oe&&(Y=oe.R16_EXT),U===n.SHORT&&oe&&(Y=oe.R16_SNORM_EXT)),b===n.RED_INTEGER&&(U===n.UNSIGNED_BYTE&&(Y=n.R8UI),U===n.UNSIGNED_SHORT&&(Y=n.R16UI),U===n.UNSIGNED_INT&&(Y=n.R32UI),U===n.BYTE&&(Y=n.R8I),U===n.SHORT&&(Y=n.R16I),U===n.INT&&(Y=n.R32I)),b===n.RG&&(U===n.FLOAT&&(Y=n.RG32F),U===n.HALF_FLOAT&&(Y=n.RG16F),U===n.UNSIGNED_BYTE&&(Y=n.RG8),U===n.UNSIGNED_SHORT&&oe&&(Y=oe.RG16_EXT),U===n.SHORT&&oe&&(Y=oe.RG16_SNORM_EXT)),b===n.RG_INTEGER&&(U===n.UNSIGNED_BYTE&&(Y=n.RG8UI),U===n.UNSIGNED_SHORT&&(Y=n.RG16UI),U===n.UNSIGNED_INT&&(Y=n.RG32UI),U===n.BYTE&&(Y=n.RG8I),U===n.SHORT&&(Y=n.RG16I),U===n.INT&&(Y=n.RG32I)),b===n.RGB_INTEGER&&(U===n.UNSIGNED_BYTE&&(Y=n.RGB8UI),U===n.UNSIGNED_SHORT&&(Y=n.RGB16UI),U===n.UNSIGNED_INT&&(Y=n.RGB32UI),U===n.BYTE&&(Y=n.RGB8I),U===n.SHORT&&(Y=n.RGB16I),U===n.INT&&(Y=n.RGB32I)),b===n.RGBA_INTEGER&&(U===n.UNSIGNED_BYTE&&(Y=n.RGBA8UI),U===n.UNSIGNED_SHORT&&(Y=n.RGBA16UI),U===n.UNSIGNED_INT&&(Y=n.RGBA32UI),U===n.BYTE&&(Y=n.RGBA8I),U===n.SHORT&&(Y=n.RGBA16I),U===n.INT&&(Y=n.RGBA32I)),b===n.RGB&&(U===n.UNSIGNED_SHORT&&oe&&(Y=oe.RGB16_EXT),U===n.SHORT&&oe&&(Y=oe.RGB16_SNORM_EXT),U===n.UNSIGNED_INT_5_9_9_9_REV&&(Y=n.RGB9_E5),U===n.UNSIGNED_INT_10F_11F_11F_REV&&(Y=n.R11F_G11F_B10F)),b===n.RGBA){let K=ie?Kr:Ve.getTransfer(X);U===n.FLOAT&&(Y=n.RGBA32F),U===n.HALF_FLOAT&&(Y=n.RGBA16F),U===n.UNSIGNED_BYTE&&(Y=K===je?n.SRGB8_ALPHA8:n.RGBA8),U===n.UNSIGNED_SHORT&&oe&&(Y=oe.RGBA16_EXT),U===n.SHORT&&oe&&(Y=oe.RGBA16_SNORM_EXT),U===n.UNSIGNED_SHORT_4_4_4_4&&(Y=n.RGBA4),U===n.UNSIGNED_SHORT_5_5_5_1&&(Y=n.RGB5_A1)}return(Y===n.R16F||Y===n.R32F||Y===n.RG16F||Y===n.RG32F||Y===n.RGBA16F||Y===n.RGBA32F)&&e.get("EXT_color_buffer_float"),Y}function w(R,b){let U;return R?b===null||b===Mn||b===Rr?U=n.DEPTH24_STENCIL8:b===Sn?U=n.DEPTH32F_STENCIL8:b===Tr&&(U=n.DEPTH24_STENCIL8,Te("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):b===null||b===Mn||b===Rr?U=n.DEPTH_COMPONENT24:b===Sn?U=n.DEPTH_COMPONENT32F:b===Tr&&(U=n.DEPTH_COMPONENT16),U}function E(R,b){return m(R)===!0||R.isFramebufferTexture&&R.minFilter!==Ct&&R.minFilter!==Nt?Math.log2(Math.max(b.width,b.height))+1:R.mipmaps!==void 0&&R.mipmaps.length>0?R.mipmaps.length:R.isCompressedTexture&&Array.isArray(R.image)?b.mipmaps.length:1}function T(R){let b=R.target;b.removeEventListener("dispose",T),A(b),b.isVideoTexture&&h.delete(b),b.isHTMLTexture&&f.delete(b)}function _(R){let b=R.target;b.removeEventListener("dispose",_),C(b)}function A(R){let b=i.get(R);if(b.__webglInit===void 0)return;let U=R.source,G=d.get(U);if(G){let X=G[b.__cacheKey];X.usedTimes--,X.usedTimes===0&&P(R),Object.keys(G).length===0&&d.delete(U)}i.remove(R)}function P(R){let b=i.get(R);n.deleteTexture(b.__webglTexture);let U=R.source,G=d.get(U);delete G[b.__cacheKey],o.memory.textures--}function C(R){let b=i.get(R);if(R.depthTexture&&(R.depthTexture.dispose(),i.remove(R.depthTexture)),R.isWebGLCubeRenderTarget)for(let G=0;G<6;G++){if(Array.isArray(b.__webglFramebuffer[G]))for(let X=0;X<b.__webglFramebuffer[G].length;X++)n.deleteFramebuffer(b.__webglFramebuffer[G][X]);else n.deleteFramebuffer(b.__webglFramebuffer[G]);b.__webglDepthbuffer&&n.deleteRenderbuffer(b.__webglDepthbuffer[G])}else{if(Array.isArray(b.__webglFramebuffer))for(let G=0;G<b.__webglFramebuffer.length;G++)n.deleteFramebuffer(b.__webglFramebuffer[G]);else n.deleteFramebuffer(b.__webglFramebuffer);if(b.__webglDepthbuffer&&n.deleteRenderbuffer(b.__webglDepthbuffer),b.__webglMultisampledFramebuffer&&n.deleteFramebuffer(b.__webglMultisampledFramebuffer),b.__webglColorRenderbuffer)for(let G=0;G<b.__webglColorRenderbuffer.length;G++)b.__webglColorRenderbuffer[G]&&n.deleteRenderbuffer(b.__webglColorRenderbuffer[G]);b.__webglDepthRenderbuffer&&n.deleteRenderbuffer(b.__webglDepthRenderbuffer)}let U=R.textures;for(let G=0,X=U.length;G<X;G++){let ie=i.get(U[G]);ie.__webglTexture&&(n.deleteTexture(ie.__webglTexture),o.memory.textures--),i.remove(U[G])}i.remove(R)}let I=0;function L(){I=0}function H(){return I}function k(R){I=R}function O(){let R=I;return R>=r.maxTextures&&Te("WebGLTextures: Trying to use "+R+" texture units while this GPU supports only "+r.maxTextures),I+=1,R}function W(R){let b=[];return b.push(R.wrapS),b.push(R.wrapT),b.push(R.wrapR||0),b.push(R.magFilter),b.push(R.minFilter),b.push(R.anisotropy),b.push(R.internalFormat),b.push(R.format),b.push(R.type),b.push(R.generateMipmaps),b.push(R.premultiplyAlpha),b.push(R.flipY),b.push(R.unpackAlignment),b.push(R.colorSpace),b.join()}function J(R,b){let U=i.get(R);if(R.isVideoTexture&&D(R),R.isRenderTargetTexture===!1&&R.isExternalTexture!==!0&&R.version>0&&U.__version!==R.version){let G=R.image;if(G===null)Te("WebGLRenderer: Texture marked for update but no image data found.");else if(G.complete===!1)Te("WebGLRenderer: Texture marked for update but image is incomplete");else{Pe(U,R,b);return}}else R.isExternalTexture&&(U.__webglTexture=R.sourceTexture?R.sourceTexture:null);t.bindTexture(n.TEXTURE_2D,U.__webglTexture,n.TEXTURE0+b)}function Q(R,b){let U=i.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&U.__version!==R.version){Pe(U,R,b);return}else R.isExternalTexture&&(U.__webglTexture=R.sourceTexture?R.sourceTexture:null);t.bindTexture(n.TEXTURE_2D_ARRAY,U.__webglTexture,n.TEXTURE0+b)}function j(R,b){let U=i.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&U.__version!==R.version){Pe(U,R,b);return}t.bindTexture(n.TEXTURE_3D,U.__webglTexture,n.TEXTURE0+b)}function te(R,b){let U=i.get(R);if(R.isCubeDepthTexture!==!0&&R.version>0&&U.__version!==R.version){Ie(U,R,b);return}t.bindTexture(n.TEXTURE_CUBE_MAP,U.__webglTexture,n.TEXTURE0+b)}let me={[So]:n.REPEAT,[Nn]:n.CLAMP_TO_EDGE,[wo]:n.MIRRORED_REPEAT},Oe={[Ct]:n.NEAREST,[Dh]:n.NEAREST_MIPMAP_NEAREST,[fs]:n.NEAREST_MIPMAP_LINEAR,[Nt]:n.LINEAR,[Ko]:n.LINEAR_MIPMAP_NEAREST,[zn]:n.LINEAR_MIPMAP_LINEAR},et={[Oh]:n.NEVER,[Hh]:n.ALWAYS,[Bh]:n.LESS,[Da]:n.LEQUAL,[zh]:n.EQUAL,[Fa]:n.GEQUAL,[Vh]:n.GREATER,[Gh]:n.NOTEQUAL};function He(R,b){if(b.type===Sn&&e.has("OES_texture_float_linear")===!1&&(b.magFilter===Nt||b.magFilter===Ko||b.magFilter===fs||b.magFilter===zn||b.minFilter===Nt||b.minFilter===Ko||b.minFilter===fs||b.minFilter===zn)&&Te("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(R,n.TEXTURE_WRAP_S,me[b.wrapS]),n.texParameteri(R,n.TEXTURE_WRAP_T,me[b.wrapT]),(R===n.TEXTURE_3D||R===n.TEXTURE_2D_ARRAY)&&n.texParameteri(R,n.TEXTURE_WRAP_R,me[b.wrapR]),n.texParameteri(R,n.TEXTURE_MAG_FILTER,Oe[b.magFilter]),n.texParameteri(R,n.TEXTURE_MIN_FILTER,Oe[b.minFilter]),b.compareFunction&&(n.texParameteri(R,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(R,n.TEXTURE_COMPARE_FUNC,et[b.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(b.magFilter===Ct||b.minFilter!==fs&&b.minFilter!==zn||b.type===Sn&&e.has("OES_texture_float_linear")===!1)return;if(b.anisotropy>1||i.get(b).__currentAnisotropy){let U=e.get("EXT_texture_filter_anisotropic");n.texParameterf(R,U.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(b.anisotropy,r.getMaxAnisotropy())),i.get(b).__currentAnisotropy=b.anisotropy}}}function Z(R,b){let U=!1;R.__webglInit===void 0&&(R.__webglInit=!0,b.addEventListener("dispose",T));let G=b.source,X=d.get(G);X===void 0&&(X={},d.set(G,X));let ie=W(b);if(ie!==R.__cacheKey){X[ie]===void 0&&(X[ie]={texture:n.createTexture(),usedTimes:0},o.memory.textures++,U=!0),X[ie].usedTimes++;let oe=X[R.__cacheKey];oe!==void 0&&(X[R.__cacheKey].usedTimes--,oe.usedTimes===0&&P(b)),R.__cacheKey=ie,R.__webglTexture=X[ie].texture}return U}function se(R,b,U){return Math.floor(Math.floor(R/U)/b)}function ne(R,b,U,G){let ie=R.updateRanges;if(ie.length===0)t.texSubImage2D(n.TEXTURE_2D,0,0,0,b.width,b.height,U,G,b.data);else{ie.sort((ve,ue)=>ve.start-ue.start);let oe=0;for(let ve=1;ve<ie.length;ve++){let ue=ie[oe],le=ie[ve],we=ue.start+ue.count,Ae=se(le.start,b.width,4),ke=se(ue.start,b.width,4);le.start<=we+1&&Ae===ke&&se(le.start+le.count-1,b.width,4)===Ae?ue.count=Math.max(ue.count,le.start+le.count-ue.start):(++oe,ie[oe]=le)}ie.length=oe+1;let Y=t.getParameter(n.UNPACK_ROW_LENGTH),K=t.getParameter(n.UNPACK_SKIP_PIXELS),ae=t.getParameter(n.UNPACK_SKIP_ROWS);t.pixelStorei(n.UNPACK_ROW_LENGTH,b.width);for(let ve=0,ue=ie.length;ve<ue;ve++){let le=ie[ve],we=Math.floor(le.start/4),Ae=Math.ceil(le.count/4),ke=we%b.width,N=Math.floor(we/b.width),re=Ae,$=1;t.pixelStorei(n.UNPACK_SKIP_PIXELS,ke),t.pixelStorei(n.UNPACK_SKIP_ROWS,N),t.texSubImage2D(n.TEXTURE_2D,0,ke,N,re,$,U,G,b.data)}R.clearUpdateRanges(),t.pixelStorei(n.UNPACK_ROW_LENGTH,Y),t.pixelStorei(n.UNPACK_SKIP_PIXELS,K),t.pixelStorei(n.UNPACK_SKIP_ROWS,ae)}}function Pe(R,b,U){let G=n.TEXTURE_2D;(b.isDataArrayTexture||b.isCompressedArrayTexture)&&(G=n.TEXTURE_2D_ARRAY),b.isData3DTexture&&(G=n.TEXTURE_3D);let X=Z(R,b),ie=b.source;t.bindTexture(G,R.__webglTexture,n.TEXTURE0+U);let oe=i.get(ie);if(ie.version!==oe.__version||X===!0){if(t.activeTexture(n.TEXTURE0+U),(typeof ImageBitmap<"u"&&b.image instanceof ImageBitmap)===!1){let $=Ve.getPrimaries(Ve.workingColorSpace),ce=b.colorSpace===ii?null:Ve.getPrimaries(b.colorSpace),pe=b.colorSpace===ii||$===ce?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,b.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,b.premultiplyAlpha),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,pe)}t.pixelStorei(n.UNPACK_ALIGNMENT,b.unpackAlignment);let K=p(b.image,!1,r.maxTextureSize);K=Xt(b,K);let ae=s.convert(b.format,b.colorSpace),ve=s.convert(b.type),ue=y(b.internalFormat,ae,ve,b.normalized,b.colorSpace,b.isVideoTexture);He(G,b);let le,we=b.mipmaps,Ae=b.isVideoTexture!==!0,ke=oe.__version===void 0||X===!0,N=ie.dataReady,re=E(b,K);if(b.isDepthTexture)ue=w(b.format===wi,b.type),ke&&(Ae?t.texStorage2D(n.TEXTURE_2D,1,ue,K.width,K.height):t.texImage2D(n.TEXTURE_2D,0,ue,K.width,K.height,0,ae,ve,null));else if(b.isDataTexture)if(we.length>0){Ae&&ke&&t.texStorage2D(n.TEXTURE_2D,re,ue,we[0].width,we[0].height);for(let $=0,ce=we.length;$<ce;$++)le=we[$],Ae?N&&t.texSubImage2D(n.TEXTURE_2D,$,0,0,le.width,le.height,ae,ve,le.data):t.texImage2D(n.TEXTURE_2D,$,ue,le.width,le.height,0,ae,ve,le.data);b.generateMipmaps=!1}else Ae?(ke&&t.texStorage2D(n.TEXTURE_2D,re,ue,K.width,K.height),N&&ne(b,K,ae,ve)):t.texImage2D(n.TEXTURE_2D,0,ue,K.width,K.height,0,ae,ve,K.data);else if(b.isCompressedTexture)if(b.isCompressedArrayTexture){Ae&&ke&&t.texStorage3D(n.TEXTURE_2D_ARRAY,re,ue,we[0].width,we[0].height,K.depth);for(let $=0,ce=we.length;$<ce;$++)if(le=we[$],b.format!==ln)if(ae!==null)if(Ae){if(N)if(b.layerUpdates.size>0){let pe=Mc(le.width,le.height,b.format,b.type);for(let ee of b.layerUpdates){let _e=le.data.subarray(ee*pe/le.data.BYTES_PER_ELEMENT,(ee+1)*pe/le.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,$,0,0,ee,le.width,le.height,1,ae,_e)}b.clearLayerUpdates()}else t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,$,0,0,0,le.width,le.height,K.depth,ae,le.data)}else t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,$,ue,le.width,le.height,K.depth,0,le.data,0,0);else Te("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ae?N&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,$,0,0,0,le.width,le.height,K.depth,ae,ve,le.data):t.texImage3D(n.TEXTURE_2D_ARRAY,$,ue,le.width,le.height,K.depth,0,ae,ve,le.data)}else{Ae&&ke&&t.texStorage2D(n.TEXTURE_2D,re,ue,we[0].width,we[0].height);for(let $=0,ce=we.length;$<ce;$++)le=we[$],b.format!==ln?ae!==null?Ae?N&&t.compressedTexSubImage2D(n.TEXTURE_2D,$,0,0,le.width,le.height,ae,le.data):t.compressedTexImage2D(n.TEXTURE_2D,$,ue,le.width,le.height,0,le.data):Te("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ae?N&&t.texSubImage2D(n.TEXTURE_2D,$,0,0,le.width,le.height,ae,ve,le.data):t.texImage2D(n.TEXTURE_2D,$,ue,le.width,le.height,0,ae,ve,le.data)}else if(b.isDataArrayTexture)if(Ae){if(ke&&t.texStorage3D(n.TEXTURE_2D_ARRAY,re,ue,K.width,K.height,K.depth),N)if(b.layerUpdates.size>0){let $=Mc(K.width,K.height,b.format,b.type);for(let ce of b.layerUpdates){let pe=K.data.subarray(ce*$/K.data.BYTES_PER_ELEMENT,(ce+1)*$/K.data.BYTES_PER_ELEMENT);t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,ce,K.width,K.height,1,ae,ve,pe)}b.clearLayerUpdates()}else t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,K.width,K.height,K.depth,ae,ve,K.data)}else t.texImage3D(n.TEXTURE_2D_ARRAY,0,ue,K.width,K.height,K.depth,0,ae,ve,K.data);else if(b.isData3DTexture)Ae?(ke&&t.texStorage3D(n.TEXTURE_3D,re,ue,K.width,K.height,K.depth),N&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,K.width,K.height,K.depth,ae,ve,K.data)):t.texImage3D(n.TEXTURE_3D,0,ue,K.width,K.height,K.depth,0,ae,ve,K.data);else if(b.isFramebufferTexture){if(ke)if(Ae)t.texStorage2D(n.TEXTURE_2D,re,ue,K.width,K.height);else{let $=K.width,ce=K.height;for(let pe=0;pe<re;pe++)t.texImage2D(n.TEXTURE_2D,pe,ue,$,ce,0,ae,ve,null),$>>=1,ce>>=1}}else if(b.isHTMLTexture){if("texElementImage2D"in n){let $=n.canvas;if($.hasAttribute("layoutsubtree")||$.setAttribute("layoutsubtree","true"),K.parentNode!==$){$.appendChild(K),f.add(b),$.onpaint=ce=>{let pe=ce.changedElements;for(let ee of f)pe.includes(ee.image)&&(ee.needsUpdate=!0)},$.requestPaint();return}if(n.texElementImage2D.length===3)n.texElementImage2D(n.TEXTURE_2D,n.RGBA8,K);else{let pe=n.RGBA,ee=n.RGBA,_e=n.UNSIGNED_BYTE;n.texElementImage2D(n.TEXTURE_2D,0,pe,ee,_e,K)}n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE)}}else if(we.length>0){if(Ae&&ke){let $=$e(we[0]);t.texStorage2D(n.TEXTURE_2D,re,ue,$.width,$.height)}for(let $=0,ce=we.length;$<ce;$++)le=we[$],Ae?N&&t.texSubImage2D(n.TEXTURE_2D,$,0,0,ae,ve,le):t.texImage2D(n.TEXTURE_2D,$,ue,ae,ve,le);b.generateMipmaps=!1}else if(Ae){if(ke){let $=$e(K);t.texStorage2D(n.TEXTURE_2D,re,ue,$.width,$.height)}N&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,ae,ve,K)}else t.texImage2D(n.TEXTURE_2D,0,ue,ae,ve,K);m(b)&&v(G),oe.__version=ie.version,b.onUpdate&&b.onUpdate(b)}R.__version=b.version}function Ie(R,b,U){if(b.image.length!==6)return;let G=Z(R,b),X=b.source;t.bindTexture(n.TEXTURE_CUBE_MAP,R.__webglTexture,n.TEXTURE0+U);let ie=i.get(X);if(X.version!==ie.__version||G===!0){t.activeTexture(n.TEXTURE0+U);let oe=Ve.getPrimaries(Ve.workingColorSpace),Y=b.colorSpace===ii?null:Ve.getPrimaries(b.colorSpace),K=b.colorSpace===ii||oe===Y?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,b.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,b.premultiplyAlpha),t.pixelStorei(n.UNPACK_ALIGNMENT,b.unpackAlignment),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,K);let ae=b.isCompressedTexture||b.image[0].isCompressedTexture,ve=b.image[0]&&b.image[0].isDataTexture,ue=[];for(let ee=0;ee<6;ee++)!ae&&!ve?ue[ee]=p(b.image[ee],!0,r.maxCubemapSize):ue[ee]=ve?b.image[ee].image:b.image[ee],ue[ee]=Xt(b,ue[ee]);let le=ue[0],we=s.convert(b.format,b.colorSpace),Ae=s.convert(b.type),ke=y(b.internalFormat,we,Ae,b.normalized,b.colorSpace),N=b.isVideoTexture!==!0,re=ie.__version===void 0||G===!0,$=X.dataReady,ce=E(b,le);He(n.TEXTURE_CUBE_MAP,b);let pe;if(ae){N&&re&&t.texStorage2D(n.TEXTURE_CUBE_MAP,ce,ke,le.width,le.height);for(let ee=0;ee<6;ee++){pe=ue[ee].mipmaps;for(let _e=0;_e<pe.length;_e++){let xe=pe[_e];b.format!==ln?we!==null?N?$&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,_e,0,0,xe.width,xe.height,we,xe.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,_e,ke,xe.width,xe.height,0,xe.data):Te("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):N?$&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,_e,0,0,xe.width,xe.height,we,Ae,xe.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,_e,ke,xe.width,xe.height,0,we,Ae,xe.data)}}}else{if(pe=b.mipmaps,N&&re){pe.length>0&&ce++;let ee=$e(ue[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,ce,ke,ee.width,ee.height)}for(let ee=0;ee<6;ee++)if(ve){N?$&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,0,0,0,ue[ee].width,ue[ee].height,we,Ae,ue[ee].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,0,ke,ue[ee].width,ue[ee].height,0,we,Ae,ue[ee].data);for(let _e=0;_e<pe.length;_e++){let ut=pe[_e].image[ee].image;N?$&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,_e+1,0,0,ut.width,ut.height,we,Ae,ut.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,_e+1,ke,ut.width,ut.height,0,we,Ae,ut.data)}}else{N?$&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,0,0,0,we,Ae,ue[ee]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,0,ke,we,Ae,ue[ee]);for(let _e=0;_e<pe.length;_e++){let xe=pe[_e];N?$&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,_e+1,0,0,we,Ae,xe.image[ee]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,_e+1,ke,we,Ae,xe.image[ee])}}}m(b)&&v(n.TEXTURE_CUBE_MAP),ie.__version=X.version,b.onUpdate&&b.onUpdate(b)}R.__version=b.version}function Ee(R,b,U,G,X,ie){let oe=s.convert(U.format,U.colorSpace),Y=s.convert(U.type),K=y(U.internalFormat,oe,Y,U.normalized,U.colorSpace),ae=i.get(b),ve=i.get(U);if(ve.__renderTarget=b,!ae.__hasExternalTextures){let ue=Math.max(1,b.width>>ie),le=Math.max(1,b.height>>ie);X===n.TEXTURE_3D||X===n.TEXTURE_2D_ARRAY?t.texImage3D(X,ie,K,ue,le,b.depth,0,oe,Y,null):t.texImage2D(X,ie,K,ue,le,0,oe,Y,null)}t.bindFramebuffer(n.FRAMEBUFFER,R),xt(b)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,G,X,ve.__webglTexture,0,ct(b)):(X===n.TEXTURE_2D||X>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&X<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,G,X,ve.__webglTexture,ie),t.bindFramebuffer(n.FRAMEBUFFER,null)}function ft(R,b,U){if(n.bindRenderbuffer(n.RENDERBUFFER,R),b.depthBuffer){let G=b.depthTexture,X=G&&G.isDepthTexture?G.type:null,ie=w(b.stencilBuffer,X),oe=b.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;xt(b)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,ct(b),ie,b.width,b.height):U?n.renderbufferStorageMultisample(n.RENDERBUFFER,ct(b),ie,b.width,b.height):n.renderbufferStorage(n.RENDERBUFFER,ie,b.width,b.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,oe,n.RENDERBUFFER,R)}else{let G=b.textures;for(let X=0;X<G.length;X++){let ie=G[X],oe=s.convert(ie.format,ie.colorSpace),Y=s.convert(ie.type),K=y(ie.internalFormat,oe,Y,ie.normalized,ie.colorSpace);xt(b)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,ct(b),K,b.width,b.height):U?n.renderbufferStorageMultisample(n.RENDERBUFFER,ct(b),K,b.width,b.height):n.renderbufferStorage(n.RENDERBUFFER,K,b.width,b.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function ze(R,b,U){let G=b.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(n.FRAMEBUFFER,R),!(b.depthTexture&&b.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let X=i.get(b.depthTexture);if(X.__renderTarget=b,(!X.__webglTexture||b.depthTexture.image.width!==b.width||b.depthTexture.image.height!==b.height)&&(b.depthTexture.image.width=b.width,b.depthTexture.image.height=b.height,b.depthTexture.needsUpdate=!0),G){if(X.__webglInit===void 0&&(X.__webglInit=!0,b.depthTexture.addEventListener("dispose",T)),X.__webglTexture===void 0){X.__webglTexture=n.createTexture(),t.bindTexture(n.TEXTURE_CUBE_MAP,X.__webglTexture),He(n.TEXTURE_CUBE_MAP,b.depthTexture);let ae=s.convert(b.depthTexture.format),ve=s.convert(b.depthTexture.type),ue;b.depthTexture.format===Dn?ue=n.DEPTH_COMPONENT24:b.depthTexture.format===wi&&(ue=n.DEPTH24_STENCIL8);for(let le=0;le<6;le++)n.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+le,0,ue,b.width,b.height,0,ae,ve,null)}}else J(b.depthTexture,0);let ie=X.__webglTexture,oe=ct(b),Y=G?n.TEXTURE_CUBE_MAP_POSITIVE_X+U:n.TEXTURE_2D,K=b.depthTexture.format===wi?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;if(b.depthTexture.format===Dn)xt(b)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,K,Y,ie,0,oe):n.framebufferTexture2D(n.FRAMEBUFFER,K,Y,ie,0);else if(b.depthTexture.format===wi)xt(b)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,K,Y,ie,0,oe):n.framebufferTexture2D(n.FRAMEBUFFER,K,Y,ie,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function Ke(R){let b=i.get(R),U=R.isWebGLCubeRenderTarget===!0;if(b.__boundDepthTexture!==R.depthTexture){let G=R.depthTexture;if(b.__depthDisposeCallback&&b.__depthDisposeCallback(),G){let X=()=>{delete b.__boundDepthTexture,delete b.__depthDisposeCallback,G.removeEventListener("dispose",X)};G.addEventListener("dispose",X),b.__depthDisposeCallback=X}b.__boundDepthTexture=G}if(R.depthTexture&&!b.__autoAllocateDepthBuffer)if(U)for(let G=0;G<6;G++)ze(b.__webglFramebuffer[G],R,G);else{let G=R.texture.mipmaps;G&&G.length>0?ze(b.__webglFramebuffer[0],R,0):ze(b.__webglFramebuffer,R,0)}else if(U){b.__webglDepthbuffer=[];for(let G=0;G<6;G++)if(t.bindFramebuffer(n.FRAMEBUFFER,b.__webglFramebuffer[G]),b.__webglDepthbuffer[G]===void 0)b.__webglDepthbuffer[G]=n.createRenderbuffer(),ft(b.__webglDepthbuffer[G],R,!1);else{let X=R.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ie=b.__webglDepthbuffer[G];n.bindRenderbuffer(n.RENDERBUFFER,ie),n.framebufferRenderbuffer(n.FRAMEBUFFER,X,n.RENDERBUFFER,ie)}}else{let G=R.texture.mipmaps;if(G&&G.length>0?t.bindFramebuffer(n.FRAMEBUFFER,b.__webglFramebuffer[0]):t.bindFramebuffer(n.FRAMEBUFFER,b.__webglFramebuffer),b.__webglDepthbuffer===void 0)b.__webglDepthbuffer=n.createRenderbuffer(),ft(b.__webglDepthbuffer,R,!1);else{let X=R.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ie=b.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,ie),n.framebufferRenderbuffer(n.FRAMEBUFFER,X,n.RENDERBUFFER,ie)}}t.bindFramebuffer(n.FRAMEBUFFER,null)}function Ye(R,b,U){let G=i.get(R);b!==void 0&&Ee(G.__webglFramebuffer,R,R.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),U!==void 0&&Ke(R)}function We(R){let b=R.texture,U=i.get(R),G=i.get(b);R.addEventListener("dispose",_);let X=R.textures,ie=R.isWebGLCubeRenderTarget===!0,oe=X.length>1;if(oe||(G.__webglTexture===void 0&&(G.__webglTexture=n.createTexture()),G.__version=b.version,o.memory.textures++),ie){U.__webglFramebuffer=[];for(let Y=0;Y<6;Y++)if(b.mipmaps&&b.mipmaps.length>0){U.__webglFramebuffer[Y]=[];for(let K=0;K<b.mipmaps.length;K++)U.__webglFramebuffer[Y][K]=n.createFramebuffer()}else U.__webglFramebuffer[Y]=n.createFramebuffer()}else{if(b.mipmaps&&b.mipmaps.length>0){U.__webglFramebuffer=[];for(let Y=0;Y<b.mipmaps.length;Y++)U.__webglFramebuffer[Y]=n.createFramebuffer()}else U.__webglFramebuffer=n.createFramebuffer();if(oe)for(let Y=0,K=X.length;Y<K;Y++){let ae=i.get(X[Y]);ae.__webglTexture===void 0&&(ae.__webglTexture=n.createTexture(),o.memory.textures++)}if(R.samples>0&&xt(R)===!1){U.__webglMultisampledFramebuffer=n.createFramebuffer(),U.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,U.__webglMultisampledFramebuffer);for(let Y=0;Y<X.length;Y++){let K=X[Y];U.__webglColorRenderbuffer[Y]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,U.__webglColorRenderbuffer[Y]);let ae=s.convert(K.format,K.colorSpace),ve=s.convert(K.type),ue=y(K.internalFormat,ae,ve,K.normalized,K.colorSpace,R.isXRRenderTarget===!0),le=ct(R);n.renderbufferStorageMultisample(n.RENDERBUFFER,le,ue,R.width,R.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+Y,n.RENDERBUFFER,U.__webglColorRenderbuffer[Y])}n.bindRenderbuffer(n.RENDERBUFFER,null),R.depthBuffer&&(U.__webglDepthRenderbuffer=n.createRenderbuffer(),ft(U.__webglDepthRenderbuffer,R,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(ie){t.bindTexture(n.TEXTURE_CUBE_MAP,G.__webglTexture),He(n.TEXTURE_CUBE_MAP,b);for(let Y=0;Y<6;Y++)if(b.mipmaps&&b.mipmaps.length>0)for(let K=0;K<b.mipmaps.length;K++)Ee(U.__webglFramebuffer[Y][K],R,b,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+Y,K);else Ee(U.__webglFramebuffer[Y],R,b,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+Y,0);m(b)&&v(n.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(oe){for(let Y=0,K=X.length;Y<K;Y++){let ae=X[Y],ve=i.get(ae),ue=n.TEXTURE_2D;(R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(ue=R.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(ue,ve.__webglTexture),He(ue,ae),Ee(U.__webglFramebuffer,R,ae,n.COLOR_ATTACHMENT0+Y,ue,0),m(ae)&&v(ue)}t.unbindTexture()}else{let Y=n.TEXTURE_2D;if((R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(Y=R.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(Y,G.__webglTexture),He(Y,b),b.mipmaps&&b.mipmaps.length>0)for(let K=0;K<b.mipmaps.length;K++)Ee(U.__webglFramebuffer[K],R,b,n.COLOR_ATTACHMENT0,Y,K);else Ee(U.__webglFramebuffer,R,b,n.COLOR_ATTACHMENT0,Y,0);m(b)&&v(Y),t.unbindTexture()}R.depthBuffer&&Ke(R)}function yt(R){let b=R.textures;for(let U=0,G=b.length;U<G;U++){let X=b[U];if(m(X)){let ie=M(R),oe=i.get(X).__webglTexture;t.bindTexture(ie,oe),v(ie),t.unbindTexture()}}}let Mt=[],Tt=[];function kt(R){if(R.samples>0){if(xt(R)===!1){let b=R.textures,U=R.width,G=R.height,X=n.COLOR_BUFFER_BIT,ie=R.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,oe=i.get(R),Y=b.length>1;if(Y)for(let ae=0;ae<b.length;ae++)t.bindFramebuffer(n.FRAMEBUFFER,oe.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+ae,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,oe.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+ae,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,oe.__webglMultisampledFramebuffer);let K=R.texture.mipmaps;K&&K.length>0?t.bindFramebuffer(n.DRAW_FRAMEBUFFER,oe.__webglFramebuffer[0]):t.bindFramebuffer(n.DRAW_FRAMEBUFFER,oe.__webglFramebuffer);for(let ae=0;ae<b.length;ae++){if(R.resolveDepthBuffer&&(R.depthBuffer&&(X|=n.DEPTH_BUFFER_BIT),R.stencilBuffer&&R.resolveStencilBuffer&&(X|=n.STENCIL_BUFFER_BIT)),Y){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,oe.__webglColorRenderbuffer[ae]);let ve=i.get(b[ae]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,ve,0)}n.blitFramebuffer(0,0,U,G,0,0,U,G,X,n.NEAREST),l===!0&&(Mt.length=0,Tt.length=0,Mt.push(n.COLOR_ATTACHMENT0+ae),R.depthBuffer&&R.resolveDepthBuffer===!1&&(Mt.push(ie),Tt.push(ie),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,Tt)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,Mt))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),Y)for(let ae=0;ae<b.length;ae++){t.bindFramebuffer(n.FRAMEBUFFER,oe.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+ae,n.RENDERBUFFER,oe.__webglColorRenderbuffer[ae]);let ve=i.get(b[ae]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,oe.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+ae,n.TEXTURE_2D,ve,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,oe.__webglMultisampledFramebuffer)}else if(R.depthBuffer&&R.resolveDepthBuffer===!1&&l){let b=R.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[b])}}}function ct(R){return Math.min(r.maxSamples,R.samples)}function xt(R){let b=i.get(R);return R.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&b.__useRenderToTexture!==!1}function D(R){let b=o.render.frame;h.get(R)!==b&&(h.set(R,b),R.update())}function Xt(R,b){let U=R.colorSpace,G=R.format,X=R.type;return R.isCompressedTexture===!0||R.isVideoTexture===!0||U!==Hi&&U!==ii&&(Ve.getTransfer(U)===je?(G!==ln||X!==jt)&&Te("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Re("WebGLTextures: Unsupported texture color space:",U)),b}function $e(R){return typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement?(c.width=R.naturalWidth||R.width,c.height=R.naturalHeight||R.height):typeof VideoFrame<"u"&&R instanceof VideoFrame?(c.width=R.displayWidth,c.height=R.displayHeight):(c.width=R.width,c.height=R.height),c}this.allocateTextureUnit=O,this.resetTextureUnits=L,this.getTextureUnits=H,this.setTextureUnits=k,this.setTexture2D=J,this.setTexture2DArray=Q,this.setTexture3D=j,this.setTextureCube=te,this.rebindTextures=Ye,this.setupRenderTarget=We,this.updateRenderTargetMipmap=yt,this.updateMultisampleRenderTarget=kt,this.setupDepthRenderbuffer=Ke,this.setupFrameBufferTexture=Ee,this.useMultisampledRTT=xt,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function jx(n,e){function t(i,r=ii){let s,o=Ve.getTransfer(r);if(i===jt)return n.UNSIGNED_BYTE;if(i===Qo)return n.UNSIGNED_SHORT_4_4_4_4;if(i===ea)return n.UNSIGNED_SHORT_5_5_5_1;if(i===dc)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===fc)return n.UNSIGNED_INT_10F_11F_11F_REV;if(i===uc)return n.BYTE;if(i===hc)return n.SHORT;if(i===Tr)return n.UNSIGNED_SHORT;if(i===Jo)return n.INT;if(i===Mn)return n.UNSIGNED_INT;if(i===Sn)return n.FLOAT;if(i===Vn)return n.HALF_FLOAT;if(i===pc)return n.ALPHA;if(i===mc)return n.RGB;if(i===ln)return n.RGBA;if(i===Dn)return n.DEPTH_COMPONENT;if(i===wi)return n.DEPTH_STENCIL;if(i===gc)return n.RED;if(i===ta)return n.RED_INTEGER;if(i===Ei)return n.RG;if(i===na)return n.RG_INTEGER;if(i===ia)return n.RGBA_INTEGER;if(i===ps||i===ms||i===gs||i===ys)if(o===je)if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(i===ps)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===ms)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===gs)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===ys)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=e.get("WEBGL_compressed_texture_s3tc"),s!==null){if(i===ps)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===ms)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===gs)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===ys)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===ra||i===sa||i===oa||i===aa)if(s=e.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(i===ra)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===sa)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===oa)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===aa)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===la||i===ca||i===ua||i===ha||i===da||i===xs||i===fa)if(s=e.get("WEBGL_compressed_texture_etc"),s!==null){if(i===la||i===ca)return o===je?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(i===ua)return o===je?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC;if(i===ha)return s.COMPRESSED_R11_EAC;if(i===da)return s.COMPRESSED_SIGNED_R11_EAC;if(i===xs)return s.COMPRESSED_RG11_EAC;if(i===fa)return s.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===pa||i===ma||i===ga||i===ya||i===xa||i===ba||i===_a||i===va||i===Ma||i===Sa||i===wa||i===Ea||i===Aa||i===Ta)if(s=e.get("WEBGL_compressed_texture_astc"),s!==null){if(i===pa)return o===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===ma)return o===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===ga)return o===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===ya)return o===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===xa)return o===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===ba)return o===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===_a)return o===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===va)return o===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Ma)return o===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Sa)return o===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===wa)return o===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===Ea)return o===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Aa)return o===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Ta)return o===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===Ra||i===Ca||i===Pa)if(s=e.get("EXT_texture_compression_bptc"),s!==null){if(i===Ra)return o===je?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===Ca)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===Pa)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===La||i===Ia||i===bs||i===ka)if(s=e.get("EXT_texture_compression_rgtc"),s!==null){if(i===La)return s.COMPRESSED_RED_RGTC1_EXT;if(i===Ia)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===bs)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===ka)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Rr?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:t}}var $x=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Zx=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,Fc=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let i=new is(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=i}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,i=new Ft({vertexShader:$x,fragmentShader:Zx,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new lt(new rs(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Uc=class extends Fn{constructor(e,t){super();let i=this,r=null,s=1,o=null,a="local-floor",l=1,c=null,h=null,f=null,u=null,d=null,g=null,x=typeof XRWebGLBinding<"u",p=new Fc,m={},v=t.getContextAttributes(),M=null,y=null,w=[],E=[],T=new Be,_=null,A=new zt;A.viewport=new st;let P=new zt;P.viewport=new st;let C=[A,P],I=new Yo,L=null,H=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Z){let se=w[Z];return se===void 0&&(se=new vr,w[Z]=se),se.getTargetRaySpace()},this.getControllerGrip=function(Z){let se=w[Z];return se===void 0&&(se=new vr,w[Z]=se),se.getGripSpace()},this.getHand=function(Z){let se=w[Z];return se===void 0&&(se=new vr,w[Z]=se),se.getHandSpace()};function k(Z){let se=E.indexOf(Z.inputSource);if(se===-1)return;let ne=w[se];ne!==void 0&&(ne.update(Z.inputSource,Z.frame,c||o),ne.dispatchEvent({type:Z.type,data:Z.inputSource}))}function O(){r.removeEventListener("select",k),r.removeEventListener("selectstart",k),r.removeEventListener("selectend",k),r.removeEventListener("squeeze",k),r.removeEventListener("squeezestart",k),r.removeEventListener("squeezeend",k),r.removeEventListener("end",O),r.removeEventListener("inputsourceschange",W);for(let Z=0;Z<w.length;Z++){let se=E[Z];se!==null&&(E[Z]=null,w[Z].disconnect(se))}L=null,H=null,p.reset();for(let Z in m)delete m[Z];e.setRenderTarget(M),d=null,u=null,f=null,r=null,y=null,He.stop(),i.isPresenting=!1,e.setPixelRatio(_),e.setSize(T.width,T.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Z){s=Z,i.isPresenting===!0&&Te("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Z){a=Z,i.isPresenting===!0&&Te("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(Z){c=Z},this.getBaseLayer=function(){return u!==null?u:d},this.getBinding=function(){return f===null&&x&&(f=new XRWebGLBinding(r,t)),f},this.getFrame=function(){return g},this.getSession=function(){return r},this.setSession=async function(Z){if(r=Z,r!==null){if(M=e.getRenderTarget(),r.addEventListener("select",k),r.addEventListener("selectstart",k),r.addEventListener("selectend",k),r.addEventListener("squeeze",k),r.addEventListener("squeezestart",k),r.addEventListener("squeezeend",k),r.addEventListener("end",O),r.addEventListener("inputsourceschange",W),v.xrCompatible!==!0&&await t.makeXRCompatible(),_=e.getPixelRatio(),e.getSize(T),x&&"createProjectionLayer"in XRWebGLBinding.prototype){let ne=null,Pe=null,Ie=null;v.depth&&(Ie=v.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,ne=v.stencil?wi:Dn,Pe=v.stencil?Rr:Mn);let Ee={colorFormat:t.RGBA8,depthFormat:Ie,scaleFactor:s};f=this.getBinding(),u=f.createProjectionLayer(Ee),r.updateRenderState({layers:[u]}),e.setPixelRatio(1),e.setSize(u.textureWidth,u.textureHeight,!1),y=new tn(u.textureWidth,u.textureHeight,{format:ln,type:jt,depthTexture:new ni(u.textureWidth,u.textureHeight,Pe,void 0,void 0,void 0,void 0,void 0,void 0,ne),stencilBuffer:v.stencil,colorSpace:e.outputColorSpace,samples:v.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1})}else{let ne={antialias:v.antialias,alpha:!0,depth:v.depth,stencil:v.stencil,framebufferScaleFactor:s};d=new XRWebGLLayer(r,t,ne),r.updateRenderState({baseLayer:d}),e.setPixelRatio(1),e.setSize(d.framebufferWidth,d.framebufferHeight,!1),y=new tn(d.framebufferWidth,d.framebufferHeight,{format:ln,type:jt,colorSpace:e.outputColorSpace,stencilBuffer:v.stencil,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1})}y.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await r.requestReferenceSpace(a),He.setContext(r),He.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return p.getDepthTexture()};function W(Z){for(let se=0;se<Z.removed.length;se++){let ne=Z.removed[se],Pe=E.indexOf(ne);Pe>=0&&(E[Pe]=null,w[Pe].disconnect(ne))}for(let se=0;se<Z.added.length;se++){let ne=Z.added[se],Pe=E.indexOf(ne);if(Pe===-1){for(let Ee=0;Ee<w.length;Ee++)if(Ee>=E.length){E.push(ne),Pe=Ee;break}else if(E[Ee]===null){E[Ee]=ne,Pe=Ee;break}if(Pe===-1)break}let Ie=w[Pe];Ie&&Ie.connect(ne)}}let J=new V,Q=new V;function j(Z,se,ne){J.setFromMatrixPosition(se.matrixWorld),Q.setFromMatrixPosition(ne.matrixWorld);let Pe=J.distanceTo(Q),Ie=se.projectionMatrix.elements,Ee=ne.projectionMatrix.elements,ft=Ie[14]/(Ie[10]-1),ze=Ie[14]/(Ie[10]+1),Ke=(Ie[9]+1)/Ie[5],Ye=(Ie[9]-1)/Ie[5],We=(Ie[8]-1)/Ie[0],yt=(Ee[8]+1)/Ee[0],Mt=ft*We,Tt=ft*yt,kt=Pe/(-We+yt),ct=kt*-We;if(se.matrixWorld.decompose(Z.position,Z.quaternion,Z.scale),Z.translateX(ct),Z.translateZ(kt),Z.matrixWorld.compose(Z.position,Z.quaternion,Z.scale),Z.matrixWorldInverse.copy(Z.matrixWorld).invert(),Ie[10]===-1)Z.projectionMatrix.copy(se.projectionMatrix),Z.projectionMatrixInverse.copy(se.projectionMatrixInverse);else{let xt=ft+kt,D=ze+kt,Xt=Mt-ct,$e=Tt+(Pe-ct),R=Ke*ze/D*xt,b=Ye*ze/D*xt;Z.projectionMatrix.makePerspective(Xt,$e,R,b,xt,D),Z.projectionMatrixInverse.copy(Z.projectionMatrix).invert()}}function te(Z,se){se===null?Z.matrixWorld.copy(Z.matrix):Z.matrixWorld.multiplyMatrices(se.matrixWorld,Z.matrix),Z.matrixWorldInverse.copy(Z.matrixWorld).invert()}this.updateCamera=function(Z){if(r===null)return;let se=Z.near,ne=Z.far;p.texture!==null&&(p.depthNear>0&&(se=p.depthNear),p.depthFar>0&&(ne=p.depthFar)),I.near=P.near=A.near=se,I.far=P.far=A.far=ne,(L!==I.near||H!==I.far)&&(r.updateRenderState({depthNear:I.near,depthFar:I.far}),L=I.near,H=I.far),I.layers.mask=Z.layers.mask|6,A.layers.mask=I.layers.mask&-5,P.layers.mask=I.layers.mask&-3;let Pe=Z.parent,Ie=I.cameras;te(I,Pe);for(let Ee=0;Ee<Ie.length;Ee++)te(Ie[Ee],Pe);Ie.length===2?j(I,A,P):I.projectionMatrix.copy(A.projectionMatrix),me(Z,I,Pe)};function me(Z,se,ne){ne===null?Z.matrix.copy(se.matrixWorld):(Z.matrix.copy(ne.matrixWorld),Z.matrix.invert(),Z.matrix.multiply(se.matrixWorld)),Z.matrix.decompose(Z.position,Z.quaternion,Z.scale),Z.updateMatrixWorld(!0),Z.projectionMatrix.copy(se.projectionMatrix),Z.projectionMatrixInverse.copy(se.projectionMatrixInverse),Z.isPerspectiveCamera&&(Z.fov=Ao*2*Math.atan(1/Z.projectionMatrix.elements[5]),Z.zoom=1)}this.getCamera=function(){return I},this.getFoveation=function(){if(!(u===null&&d===null))return l},this.setFoveation=function(Z){l=Z,u!==null&&(u.fixedFoveation=Z),d!==null&&d.fixedFoveation!==void 0&&(d.fixedFoveation=Z)},this.hasDepthSensing=function(){return p.texture!==null},this.getDepthSensingMesh=function(){return p.getMesh(I)},this.getCameraTexture=function(Z){return m[Z]};let Oe=null;function et(Z,se){if(h=se.getViewerPose(c||o),g=se,h!==null){let ne=h.views;d!==null&&(e.setRenderTargetFramebuffer(y,d.framebuffer),e.setRenderTarget(y));let Pe=!1;ne.length!==I.cameras.length&&(I.cameras.length=0,Pe=!0);for(let ze=0;ze<ne.length;ze++){let Ke=ne[ze],Ye=null;if(d!==null)Ye=d.getViewport(Ke);else{let yt=f.getViewSubImage(u,Ke);Ye=yt.viewport,ze===0&&(e.setRenderTargetTextures(y,yt.colorTexture,yt.depthStencilTexture),e.setRenderTarget(y))}let We=C[ze];We===void 0&&(We=new zt,We.layers.enable(ze),We.viewport=new st,C[ze]=We),We.matrix.fromArray(Ke.transform.matrix),We.matrix.decompose(We.position,We.quaternion,We.scale),We.projectionMatrix.fromArray(Ke.projectionMatrix),We.projectionMatrixInverse.copy(We.projectionMatrix).invert(),We.viewport.set(Ye.x,Ye.y,Ye.width,Ye.height),ze===0&&(I.matrix.copy(We.matrix),I.matrix.decompose(I.position,I.quaternion,I.scale)),Pe===!0&&I.cameras.push(We)}let Ie=r.enabledFeatures;if(Ie&&Ie.includes("depth-sensing")&&r.depthUsage=="gpu-optimized"&&x){f=i.getBinding();let ze=f.getDepthInformation(ne[0]);ze&&ze.isValid&&ze.texture&&p.init(ze,r.renderState)}if(Ie&&Ie.includes("camera-access")&&x){e.state.unbindTexture(),f=i.getBinding();for(let ze=0;ze<ne.length;ze++){let Ke=ne[ze].camera;if(Ke){let Ye=m[Ke];Ye||(Ye=new is,m[Ke]=Ye);let We=f.getCameraImage(Ke);Ye.sourceTexture=We}}}}for(let ne=0;ne<w.length;ne++){let Pe=E[ne],Ie=w[ne];Pe!==null&&Ie!==void 0&&Ie.update(Pe,se,c||o)}Oe&&Oe(Z,se),se.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:se}),g=null}let He=new bd;He.setAnimationLoop(et),this.setAnimationLoop=function(Z){Oe=Z},this.dispose=function(){}}},Kx=new at,Ed=new Le;Ed.set(-1,0,0,0,1,0,0,0,1);function Jx(n,e){function t(p,m){p.matrixAutoUpdate===!0&&p.updateMatrix(),m.value.copy(p.matrix)}function i(p,m){m.color.getRGB(p.fogColor.value,bc(n)),m.isFog?(p.fogNear.value=m.near,p.fogFar.value=m.far):m.isFogExp2&&(p.fogDensity.value=m.density)}function r(p,m,v,M,y){m.isNodeMaterial?m.uniformsNeedUpdate=!1:m.isMeshBasicMaterial?s(p,m):m.isMeshLambertMaterial?(s(p,m),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)):m.isMeshToonMaterial?(s(p,m),f(p,m)):m.isMeshPhongMaterial?(s(p,m),h(p,m),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)):m.isMeshStandardMaterial?(s(p,m),u(p,m),m.isMeshPhysicalMaterial&&d(p,m,y)):m.isMeshMatcapMaterial?(s(p,m),g(p,m)):m.isMeshDepthMaterial?s(p,m):m.isMeshDistanceMaterial?(s(p,m),x(p,m)):m.isMeshNormalMaterial?s(p,m):m.isLineBasicMaterial?(o(p,m),m.isLineDashedMaterial&&a(p,m)):m.isPointsMaterial?l(p,m,v,M):m.isSpriteMaterial?c(p,m):m.isShadowMaterial?(p.color.value.copy(m.color),p.opacity.value=m.opacity):m.isShaderMaterial&&(m.uniformsNeedUpdate=!1)}function s(p,m){p.opacity.value=m.opacity,m.color&&p.diffuse.value.copy(m.color),m.emissive&&p.emissive.value.copy(m.emissive).multiplyScalar(m.emissiveIntensity),m.map&&(p.map.value=m.map,t(m.map,p.mapTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,t(m.alphaMap,p.alphaMapTransform)),m.bumpMap&&(p.bumpMap.value=m.bumpMap,t(m.bumpMap,p.bumpMapTransform),p.bumpScale.value=m.bumpScale,m.side===Wt&&(p.bumpScale.value*=-1)),m.normalMap&&(p.normalMap.value=m.normalMap,t(m.normalMap,p.normalMapTransform),p.normalScale.value.copy(m.normalScale),m.side===Wt&&p.normalScale.value.negate()),m.displacementMap&&(p.displacementMap.value=m.displacementMap,t(m.displacementMap,p.displacementMapTransform),p.displacementScale.value=m.displacementScale,p.displacementBias.value=m.displacementBias),m.emissiveMap&&(p.emissiveMap.value=m.emissiveMap,t(m.emissiveMap,p.emissiveMapTransform)),m.specularMap&&(p.specularMap.value=m.specularMap,t(m.specularMap,p.specularMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest);let v=e.get(m),M=v.envMap,y=v.envMapRotation;M&&(p.envMap.value=M,p.envMapRotation.value.setFromMatrix4(Kx.makeRotationFromEuler(y)).transpose(),M.isCubeTexture&&M.isRenderTargetTexture===!1&&p.envMapRotation.value.premultiply(Ed),p.reflectivity.value=m.reflectivity,p.ior.value=m.ior,p.refractionRatio.value=m.refractionRatio),m.lightMap&&(p.lightMap.value=m.lightMap,p.lightMapIntensity.value=m.lightMapIntensity,t(m.lightMap,p.lightMapTransform)),m.aoMap&&(p.aoMap.value=m.aoMap,p.aoMapIntensity.value=m.aoMapIntensity,t(m.aoMap,p.aoMapTransform))}function o(p,m){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,m.map&&(p.map.value=m.map,t(m.map,p.mapTransform))}function a(p,m){p.dashSize.value=m.dashSize,p.totalSize.value=m.dashSize+m.gapSize,p.scale.value=m.scale}function l(p,m,v,M){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,p.size.value=m.size*v,p.scale.value=M*.5,m.map&&(p.map.value=m.map,t(m.map,p.uvTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,t(m.alphaMap,p.alphaMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest)}function c(p,m){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,p.rotation.value=m.rotation,m.map&&(p.map.value=m.map,t(m.map,p.mapTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,t(m.alphaMap,p.alphaMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest)}function h(p,m){p.specular.value.copy(m.specular),p.shininess.value=Math.max(m.shininess,1e-4)}function f(p,m){m.gradientMap&&(p.gradientMap.value=m.gradientMap)}function u(p,m){p.metalness.value=m.metalness,m.metalnessMap&&(p.metalnessMap.value=m.metalnessMap,t(m.metalnessMap,p.metalnessMapTransform)),p.roughness.value=m.roughness,m.roughnessMap&&(p.roughnessMap.value=m.roughnessMap,t(m.roughnessMap,p.roughnessMapTransform)),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)}function d(p,m,v){p.ior.value=m.ior,m.sheen>0&&(p.sheenColor.value.copy(m.sheenColor).multiplyScalar(m.sheen),p.sheenRoughness.value=m.sheenRoughness,m.sheenColorMap&&(p.sheenColorMap.value=m.sheenColorMap,t(m.sheenColorMap,p.sheenColorMapTransform)),m.sheenRoughnessMap&&(p.sheenRoughnessMap.value=m.sheenRoughnessMap,t(m.sheenRoughnessMap,p.sheenRoughnessMapTransform))),m.clearcoat>0&&(p.clearcoat.value=m.clearcoat,p.clearcoatRoughness.value=m.clearcoatRoughness,m.clearcoatMap&&(p.clearcoatMap.value=m.clearcoatMap,t(m.clearcoatMap,p.clearcoatMapTransform)),m.clearcoatRoughnessMap&&(p.clearcoatRoughnessMap.value=m.clearcoatRoughnessMap,t(m.clearcoatRoughnessMap,p.clearcoatRoughnessMapTransform)),m.clearcoatNormalMap&&(p.clearcoatNormalMap.value=m.clearcoatNormalMap,t(m.clearcoatNormalMap,p.clearcoatNormalMapTransform),p.clearcoatNormalScale.value.copy(m.clearcoatNormalScale),m.side===Wt&&p.clearcoatNormalScale.value.negate())),m.dispersion>0&&(p.dispersion.value=m.dispersion),m.iridescence>0&&(p.iridescence.value=m.iridescence,p.iridescenceIOR.value=m.iridescenceIOR,p.iridescenceThicknessMinimum.value=m.iridescenceThicknessRange[0],p.iridescenceThicknessMaximum.value=m.iridescenceThicknessRange[1],m.iridescenceMap&&(p.iridescenceMap.value=m.iridescenceMap,t(m.iridescenceMap,p.iridescenceMapTransform)),m.iridescenceThicknessMap&&(p.iridescenceThicknessMap.value=m.iridescenceThicknessMap,t(m.iridescenceThicknessMap,p.iridescenceThicknessMapTransform))),m.transmission>0&&(p.transmission.value=m.transmission,p.transmissionSamplerMap.value=v.texture,p.transmissionSamplerSize.value.set(v.width,v.height),m.transmissionMap&&(p.transmissionMap.value=m.transmissionMap,t(m.transmissionMap,p.transmissionMapTransform)),p.thickness.value=m.thickness,m.thicknessMap&&(p.thicknessMap.value=m.thicknessMap,t(m.thicknessMap,p.thicknessMapTransform)),p.attenuationDistance.value=m.attenuationDistance,p.attenuationColor.value.copy(m.attenuationColor)),m.anisotropy>0&&(p.anisotropyVector.value.set(m.anisotropy*Math.cos(m.anisotropyRotation),m.anisotropy*Math.sin(m.anisotropyRotation)),m.anisotropyMap&&(p.anisotropyMap.value=m.anisotropyMap,t(m.anisotropyMap,p.anisotropyMapTransform))),p.specularIntensity.value=m.specularIntensity,p.specularColor.value.copy(m.specularColor),m.specularColorMap&&(p.specularColorMap.value=m.specularColorMap,t(m.specularColorMap,p.specularColorMapTransform)),m.specularIntensityMap&&(p.specularIntensityMap.value=m.specularIntensityMap,t(m.specularIntensityMap,p.specularIntensityMapTransform))}function g(p,m){m.matcap&&(p.matcap.value=m.matcap)}function x(p,m){let v=e.get(m).light;p.referencePosition.value.setFromMatrixPosition(v.matrixWorld),p.nearDistance.value=v.shadow.camera.near,p.farDistance.value=v.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function Qx(n,e,t,i){let r={},s={},o=[],a=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function l(y,w){let E=w.program;i.uniformBlockBinding(y,E)}function c(y,w){let E=r[y.id];E===void 0&&(p(y),E=h(y),r[y.id]=E,y.addEventListener("dispose",v));let T=w.program;i.updateUBOMapping(y,T);let _=e.render.frame;s[y.id]!==_&&(u(y),s[y.id]=_)}function h(y){let w=f();y.__bindingPointIndex=w;let E=n.createBuffer(),T=y.__size,_=y.usage;return n.bindBuffer(n.UNIFORM_BUFFER,E),n.bufferData(n.UNIFORM_BUFFER,T,_),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,w,E),E}function f(){for(let y=0;y<a;y++)if(o.indexOf(y)===-1)return o.push(y),y;return Re("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(y){let w=r[y.id],E=y.uniforms,T=y.__cache;n.bindBuffer(n.UNIFORM_BUFFER,w);for(let _=0,A=E.length;_<A;_++){let P=E[_];if(Array.isArray(P))for(let C=0,I=P.length;C<I;C++)d(P[C],_,C,T);else d(P,_,0,T)}n.bindBuffer(n.UNIFORM_BUFFER,null)}function d(y,w,E,T){if(x(y,w,E,T)===!0){let _=y.__offset,A=y.value;if(Array.isArray(A)){let P=0;for(let C=0;C<A.length;C++){let I=A[C],L=m(I);g(I,y.__data,P),typeof I!="number"&&typeof I!="boolean"&&!I.isMatrix3&&!ArrayBuffer.isView(I)&&(P+=L.storage/Float32Array.BYTES_PER_ELEMENT)}}else g(A,y.__data,0);n.bufferSubData(n.UNIFORM_BUFFER,_,y.__data)}}function g(y,w,E){typeof y=="number"||typeof y=="boolean"?w[0]=y:y.isMatrix3?(w[0]=y.elements[0],w[1]=y.elements[1],w[2]=y.elements[2],w[3]=0,w[4]=y.elements[3],w[5]=y.elements[4],w[6]=y.elements[5],w[7]=0,w[8]=y.elements[6],w[9]=y.elements[7],w[10]=y.elements[8],w[11]=0):ArrayBuffer.isView(y)?w.set(new y.constructor(y.buffer,y.byteOffset,w.length)):y.toArray(w,E)}function x(y,w,E,T){let _=y.value,A=w+"_"+E;if(T[A]===void 0)return typeof _=="number"||typeof _=="boolean"?T[A]=_:ArrayBuffer.isView(_)?T[A]=_.slice():T[A]=_.clone(),!0;{let P=T[A];if(typeof _=="number"||typeof _=="boolean"){if(P!==_)return T[A]=_,!0}else{if(ArrayBuffer.isView(_))return!0;if(P.equals(_)===!1)return P.copy(_),!0}}return!1}function p(y){let w=y.uniforms,E=0,T=16;for(let A=0,P=w.length;A<P;A++){let C=Array.isArray(w[A])?w[A]:[w[A]];for(let I=0,L=C.length;I<L;I++){let H=C[I],k=Array.isArray(H.value)?H.value:[H.value];for(let O=0,W=k.length;O<W;O++){let J=k[O],Q=m(J),j=E%T,te=j%Q.boundary,me=j+te;E+=te,me!==0&&T-me<Q.storage&&(E+=T-me),H.__data=new Float32Array(Q.storage/Float32Array.BYTES_PER_ELEMENT),H.__offset=E,E+=Q.storage}}}let _=E%T;return _>0&&(E+=T-_),y.__size=E,y.__cache={},this}function m(y){let w={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(w.boundary=4,w.storage=4):y.isVector2?(w.boundary=8,w.storage=8):y.isVector3||y.isColor?(w.boundary=16,w.storage=12):y.isVector4?(w.boundary=16,w.storage=16):y.isMatrix3?(w.boundary=48,w.storage=48):y.isMatrix4?(w.boundary=64,w.storage=64):y.isTexture?Te("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(y)?(w.boundary=16,w.storage=y.byteLength):Te("WebGLRenderer: Unsupported uniform value type.",y),w}function v(y){let w=y.target;w.removeEventListener("dispose",v);let E=o.indexOf(w.__bindingPointIndex);o.splice(E,1),n.deleteBuffer(r[w.id]),delete r[w.id],delete s[w.id]}function M(){for(let y in r)n.deleteBuffer(r[y]);o=[],r={},s={}}return{bind:l,update:c,dispose:M}}var eb=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Gn=null;function tb(){return Gn===null&&(Gn=new Lo(eb,16,16,Ei,Vn),Gn.name="DFG_LUT",Gn.minFilter=Nt,Gn.magFilter=Nt,Gn.wrapS=Nn,Gn.wrapT=Nn,Gn.generateMipmaps=!1,Gn.needsUpdate=!0),Gn}var Va=class{constructor(e={}){let{canvas:t=Wh(),context:i=null,depth:r=!0,stencil:s=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:f=!1,reversedDepthBuffer:u=!1,outputBufferType:d=jt}=e;this.isWebGLRenderer=!0;let g;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=i.getContextAttributes().alpha}else g=o;let x=d,p=new Set([ia,na,ta]),m=new Set([jt,Mn,Tr,Rr,Qo,ea]),v=new Uint32Array(4),M=new Int32Array(4),y=new V,w=null,E=null,T=[],_=[],A=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=vn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let P=this,C=!1,I=null,L=null,H=null,k=null;this._outputColorSpace=en;let O=0,W=0,J=null,Q=-1,j=null,te=new st,me=new st,Oe=null,et=new Ue(0),He=0,Z=t.width,se=t.height,ne=1,Pe=null,Ie=null,Ee=new st(0,0,Z,se),ft=new st(0,0,Z,se),ze=!1,Ke=new Sr,Ye=!1,We=!1,yt=new at,Mt=new V,Tt=new st,kt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},ct=!1;function xt(){return J===null?ne:1}let D=i;function Xt(S,F){return t.getContext(S,F)}try{let S={alpha:!0,depth:r,stencil:s,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:f};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"185"}`),t.addEventListener("webglcontextlost",ut,!1),t.addEventListener("webglcontextrestored",tt,!1),t.addEventListener("webglcontextcreationerror",Cn,!1),D===null){let F="webgl2";if(D=Xt(F,S),D===null)throw Xt(F)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(S){throw Re("WebGLRenderer: "+S.message),S}let $e,R,b,U,G,X,ie,oe,Y,K,ae,ve,ue,le,we,Ae,ke,N,re,$,ce,pe,ee;function _e(){$e=new ly(D),$e.init(),ce=new jx(D,$e),R=new ey(D,$e,e,ce),b=new Xx(D,$e),R.reversedDepthBuffer&&u&&b.buffers.depth.setReversed(!0),L=D.createFramebuffer(),H=D.createFramebuffer(),k=D.createFramebuffer(),U=new hy(D),G=new Ix,X=new Yx(D,$e,b,G,R,ce,U),ie=new ay(P),oe=new mm(D),pe=new J0(D,oe),Y=new cy(D,oe,U,pe),K=new fy(D,Y,oe,pe,U),N=new dy(D,R,X),we=new ty(G),ae=new Lx(P,ie,$e,R,pe,we),ve=new Jx(P,G),ue=new Nx,le=new zx($e),ke=new K0(P,ie,b,K,g,l),Ae=new qx(P,K,R),ee=new Qx(D,U,R,b),re=new Q0(D,$e,U),$=new uy(D,$e,U),U.programs=ae.programs,P.capabilities=R,P.extensions=$e,P.properties=G,P.renderLists=ue,P.shadowMap=Ae,P.state=b,P.info=U}_e(),x!==jt&&(A=new my(x,t.width,t.height,a,r,s));let xe=new Uc(P,D);this.xr=xe,this.getContext=function(){return D},this.getContextAttributes=function(){return D.getContextAttributes()},this.forceContextLoss=function(){let S=$e.get("WEBGL_lose_context");S&&S.loseContext()},this.forceContextRestore=function(){let S=$e.get("WEBGL_lose_context");S&&S.restoreContext()},this.getPixelRatio=function(){return ne},this.setPixelRatio=function(S){S!==void 0&&(ne=S,this.setSize(Z,se,!1))},this.getSize=function(S){return S.set(Z,se)},this.setSize=function(S,F,q=!0){if(xe.isPresenting){Te("WebGLRenderer: Can't change size while VR device is presenting.");return}Z=S,se=F,t.width=Math.floor(S*ne),t.height=Math.floor(F*ne),q===!0&&(t.style.width=S+"px",t.style.height=F+"px"),A!==null&&A.setSize(t.width,t.height),this.setViewport(0,0,S,F)},this.getDrawingBufferSize=function(S){return S.set(Z*ne,se*ne).floor()},this.setDrawingBufferSize=function(S,F,q){Z=S,se=F,ne=q,t.width=Math.floor(S*q),t.height=Math.floor(F*q),this.setViewport(0,0,S,F)},this.setEffects=function(S){if(x===jt){Re("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(S){for(let F=0;F<S.length;F++)if(S[F].isOutputPass===!0){Te("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}A.setEffects(S||[])},this.getCurrentViewport=function(S){return S.copy(te)},this.getViewport=function(S){return S.copy(Ee)},this.setViewport=function(S,F,q,B){S.isVector4?Ee.set(S.x,S.y,S.z,S.w):Ee.set(S,F,q,B),b.viewport(te.copy(Ee).multiplyScalar(ne).round())},this.getScissor=function(S){return S.copy(ft)},this.setScissor=function(S,F,q,B){S.isVector4?ft.set(S.x,S.y,S.z,S.w):ft.set(S,F,q,B),b.scissor(me.copy(ft).multiplyScalar(ne).round())},this.getScissorTest=function(){return ze},this.setScissorTest=function(S){b.setScissorTest(ze=S)},this.setOpaqueSort=function(S){Pe=S},this.setTransparentSort=function(S){Ie=S},this.getClearColor=function(S){return S.copy(ke.getClearColor())},this.setClearColor=function(){ke.setClearColor(...arguments)},this.getClearAlpha=function(){return ke.getClearAlpha()},this.setClearAlpha=function(){ke.setClearAlpha(...arguments)},this.clear=function(S=!0,F=!0,q=!0){let B=0;if(S){let z=!1;if(J!==null){let fe=J.texture.format;z=p.has(fe)}if(z){let fe=J.texture.type,ye=m.has(fe),de=ke.getClearColor(),be=ke.getClearAlpha(),Me=de.r,Ne=de.g,Fe=de.b;ye?(v[0]=Me,v[1]=Ne,v[2]=Fe,v[3]=be,D.clearBufferuiv(D.COLOR,0,v)):(M[0]=Me,M[1]=Ne,M[2]=Fe,M[3]=be,D.clearBufferiv(D.COLOR,0,M))}else B|=D.COLOR_BUFFER_BIT}F&&(B|=D.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),q&&(B|=D.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),B!==0&&D.clear(B)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(S){S.setRenderer(this),I=S},this.dispose=function(){t.removeEventListener("webglcontextlost",ut,!1),t.removeEventListener("webglcontextrestored",tt,!1),t.removeEventListener("webglcontextcreationerror",Cn,!1),ke.dispose(),ue.dispose(),le.dispose(),G.dispose(),ie.dispose(),K.dispose(),pe.dispose(),ee.dispose(),ae.dispose(),xe.dispose(),xe.removeEventListener("sessionstart",Ou),xe.removeEventListener("sessionend",Bu),Ni.stop()};function ut(S){S.preventDefault(),xc("WebGLRenderer: Context Lost."),C=!0}function tt(){xc("WebGLRenderer: Context Restored."),C=!1;let S=U.autoReset,F=Ae.enabled,q=Ae.autoUpdate,B=Ae.needsUpdate,z=Ae.type;_e(),U.autoReset=S,Ae.enabled=F,Ae.autoUpdate=q,Ae.needsUpdate=B,Ae.type=z}function Cn(S){Re("WebGLRenderer: A WebGL context could not be created. Reason: ",S.statusMessage)}function Pn(S){let F=S.target;F.removeEventListener("dispose",Pn),Rp(F)}function Rp(S){Cp(S),G.remove(S)}function Cp(S){let F=G.get(S).programs;F!==void 0&&(F.forEach(function(q){ae.releaseProgram(q)}),S.isShaderMaterial&&ae.releaseShaderCache(S))}this.renderBufferDirect=function(S,F,q,B,z,fe){F===null&&(F=kt);let ye=z.isMesh&&z.matrixWorld.determinantAffine()<0,de=Ip(S,F,q,B,z);b.setMaterial(B,ye);let be=q.index,Me=1;if(B.wireframe===!0){if(be=Y.getWireframeAttribute(q),be===void 0)return;Me=2}let Ne=q.drawRange,Fe=q.attributes.position,Se=Ne.start*Me,Ze=(Ne.start+Ne.count)*Me;fe!==null&&(Se=Math.max(Se,fe.start*Me),Ze=Math.min(Ze,(fe.start+fe.count)*Me)),be!==null?(Se=Math.max(Se,0),Ze=Math.min(Ze,be.count)):Fe!=null&&(Se=Math.max(Se,0),Ze=Math.min(Ze,Fe.count));let pt=Ze-Se;if(pt<0||pt===1/0)return;pe.setup(z,B,de,q,be);let ht,Je=re;if(be!==null&&(ht=oe.get(be),Je=$,Je.setIndex(ht)),z.isMesh)B.wireframe===!0?(b.setLineWidth(B.wireframeLinewidth*xt()),Je.setMode(D.LINES)):Je.setMode(D.TRIANGLES);else if(z.isLine){let Ut=B.linewidth;Ut===void 0&&(Ut=1),b.setLineWidth(Ut*xt()),z.isLineSegments?Je.setMode(D.LINES):z.isLineLoop?Je.setMode(D.LINE_LOOP):Je.setMode(D.LINE_STRIP)}else z.isPoints?Je.setMode(D.POINTS):z.isSprite&&Je.setMode(D.TRIANGLES);if(z.isBatchedMesh)if($e.get("WEBGL_multi_draw"))Je.renderMultiDraw(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount);else{let Ut=z._multiDrawStarts,ge=z._multiDrawCounts,Kt=z._multiDrawCount,qe=be?oe.get(be).bytesPerElement:1,on=G.get(B).currentProgram.getUniforms();for(let Ln=0;Ln<Kt;Ln++)on.setValue(D,"_gl_DrawID",Ln),Je.render(Ut[Ln]/qe,ge[Ln])}else if(z.isInstancedMesh)Je.renderInstances(Se,pt,z.count);else if(q.isInstancedBufferGeometry){let Ut=q._maxInstanceCount!==void 0?q._maxInstanceCount:1/0,ge=Math.min(q.instanceCount,Ut);Je.renderInstances(Se,pt,ge)}else Je.render(Se,pt)};function Uu(S,F,q){S.transparent===!0&&S.side===On&&S.forceSinglePass===!1?(S.side=Wt,S.needsUpdate=!0,qs(S,F,q),S.side=ei,S.needsUpdate=!0,qs(S,F,q),S.side=On):qs(S,F,q)}this.compile=function(S,F,q=null){q===null&&(q=S),E=le.get(q),E.init(F),_.push(E),q.traverseVisible(function(z){z.isLight&&z.layers.test(F.layers)&&(E.pushLight(z),z.castShadow&&E.pushShadow(z))}),S!==q&&S.traverseVisible(function(z){z.isLight&&z.layers.test(F.layers)&&(E.pushLight(z),z.castShadow&&E.pushShadow(z))}),E.setupLights();let B=new Set;return S.traverse(function(z){if(!(z.isMesh||z.isPoints||z.isLine||z.isSprite))return;let fe=z.material;if(fe)if(Array.isArray(fe))for(let ye=0;ye<fe.length;ye++){let de=fe[ye];Uu(de,q,z),B.add(de)}else Uu(fe,q,z),B.add(fe)}),E=_.pop(),B},this.compileAsync=function(S,F,q=null){let B=this.compile(S,F,q);return new Promise(z=>{function fe(){if(B.forEach(function(ye){G.get(ye).currentProgram.isReady()&&B.delete(ye)}),B.size===0){z(S);return}setTimeout(fe,10)}$e.get("KHR_parallel_shader_compile")!==null?fe():setTimeout(fe,10)})};let gl=null;function Pp(S){gl&&gl(S)}function Ou(){Ni.stop()}function Bu(){Ni.start()}let Ni=new bd;Ni.setAnimationLoop(Pp),typeof self<"u"&&Ni.setContext(self),this.setAnimationLoop=function(S){gl=S,xe.setAnimationLoop(S),S===null?Ni.stop():Ni.start()},xe.addEventListener("sessionstart",Ou),xe.addEventListener("sessionend",Bu),this.render=function(S,F){if(F!==void 0&&F.isCamera!==!0){Re("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(C===!0)return;I!==null&&I.renderStart(S,F);let q=xe.enabled===!0&&xe.isPresenting===!0,B=A!==null&&(J===null||q)&&A.begin(P,J);if(S.matrixWorldAutoUpdate===!0&&S.updateMatrixWorld(),F.parent===null&&F.matrixWorldAutoUpdate===!0&&F.updateMatrixWorld(),xe.enabled===!0&&xe.isPresenting===!0&&(A===null||A.isCompositing()===!1)&&(xe.cameraAutoUpdate===!0&&xe.updateCamera(F),F=xe.getCamera()),S.isScene===!0&&S.onBeforeRender(P,S,F,J),E=le.get(S,_.length),E.init(F),E.state.textureUnits=X.getTextureUnits(),_.push(E),yt.multiplyMatrices(F.projectionMatrix,F.matrixWorldInverse),Ke.setFromProjectionMatrix(yt,bn,F.reversedDepth),We=this.localClippingEnabled,Ye=we.init(this.clippingPlanes,We),w=ue.get(S,T.length),w.init(),T.push(w),xe.enabled===!0&&xe.isPresenting===!0){let ye=P.xr.getDepthSensingMesh();ye!==null&&yl(ye,F,-1/0,P.sortObjects)}yl(S,F,0,P.sortObjects),w.finish(),P.sortObjects===!0&&w.sort(Pe,Ie,F.reversedDepth),ct=xe.enabled===!1||xe.isPresenting===!1||xe.hasDepthSensing()===!1,ct&&ke.addToRenderList(w,S),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),Ye===!0&&we.beginShadows();let z=E.state.shadowsArray;if(Ae.render(z,S,F),Ye===!0&&we.endShadows(),(B&&A.hasRenderPass())===!1){let ye=w.opaque,de=w.transmissive;if(E.setupLights(),F.isArrayCamera){let be=F.cameras;if(de.length>0)for(let Me=0,Ne=be.length;Me<Ne;Me++){let Fe=be[Me];Vu(ye,de,S,Fe)}ct&&ke.render(S);for(let Me=0,Ne=be.length;Me<Ne;Me++){let Fe=be[Me];zu(w,S,Fe,Fe.viewport)}}else de.length>0&&Vu(ye,de,S,F),ct&&ke.render(S),zu(w,S,F)}J!==null&&W===0&&(X.updateMultisampleRenderTarget(J),X.updateRenderTargetMipmap(J)),B&&A.end(P),S.isScene===!0&&S.onAfterRender(P,S,F),pe.resetDefaultState(),Q=-1,j=null,_.pop(),_.length>0?(E=_[_.length-1],X.setTextureUnits(E.state.textureUnits),Ye===!0&&we.setGlobalState(P.clippingPlanes,E.state.camera)):E=null,T.pop(),T.length>0?w=T[T.length-1]:w=null,I!==null&&I.renderEnd()};function yl(S,F,q,B){if(S.visible===!1)return;if(S.layers.test(F.layers)){if(S.isGroup)q=S.renderOrder;else if(S.isLOD)S.autoUpdate===!0&&S.update(F);else if(S.isLightProbeGrid)E.pushLightProbeGrid(S);else if(S.isLight)E.pushLight(S),S.castShadow&&E.pushShadow(S);else if(S.isSprite){if(!S.frustumCulled||Ke.intersectsSprite(S)){B&&Tt.setFromMatrixPosition(S.matrixWorld).applyMatrix4(yt);let ye=K.update(S),de=S.material;de.visible&&w.push(S,ye,de,q,Tt.z,null)}}else if((S.isMesh||S.isLine||S.isPoints)&&(!S.frustumCulled||Ke.intersectsObject(S))){let ye=K.update(S),de=S.material;if(B&&(S.boundingSphere!==void 0?(S.boundingSphere===null&&S.computeBoundingSphere(),Tt.copy(S.boundingSphere.center)):(ye.boundingSphere===null&&ye.computeBoundingSphere(),Tt.copy(ye.boundingSphere.center)),Tt.applyMatrix4(S.matrixWorld).applyMatrix4(yt)),Array.isArray(de)){let be=ye.groups;for(let Me=0,Ne=be.length;Me<Ne;Me++){let Fe=be[Me],Se=de[Fe.materialIndex];Se&&Se.visible&&w.push(S,ye,Se,q,Tt.z,Fe)}}else de.visible&&w.push(S,ye,de,q,Tt.z,null)}}let fe=S.children;for(let ye=0,de=fe.length;ye<de;ye++)yl(fe[ye],F,q,B)}function zu(S,F,q,B){let{opaque:z,transmissive:fe,transparent:ye}=S;E.setupLightsView(q),Ye===!0&&we.setGlobalState(P.clippingPlanes,q),B&&b.viewport(te.copy(B)),z.length>0&&Ws(z,F,q),fe.length>0&&Ws(fe,F,q),ye.length>0&&Ws(ye,F,q),b.buffers.depth.setTest(!0),b.buffers.depth.setMask(!0),b.buffers.color.setMask(!0),b.setPolygonOffset(!1)}function Vu(S,F,q,B){if((q.isScene===!0?q.overrideMaterial:null)!==null)return;if(E.state.transmissionRenderTarget[B.id]===void 0){let Se=$e.has("EXT_color_buffer_half_float")||$e.has("EXT_color_buffer_float");E.state.transmissionRenderTarget[B.id]=new tn(1,1,{generateMipmaps:!0,type:Se?Vn:jt,minFilter:zn,samples:Math.max(4,R.samples),stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Ve.workingColorSpace})}let fe=E.state.transmissionRenderTarget[B.id],ye=B.viewport||te;fe.setSize(ye.z*P.transmissionResolutionScale,ye.w*P.transmissionResolutionScale);let de=P.getRenderTarget(),be=P.getActiveCubeFace(),Me=P.getActiveMipmapLevel();P.setRenderTarget(fe),P.getClearColor(et),He=P.getClearAlpha(),He<1&&P.setClearColor(16777215,.5),P.clear(),ct&&ke.render(q);let Ne=P.toneMapping;P.toneMapping=vn;let Fe=B.viewport;if(B.viewport!==void 0&&(B.viewport=void 0),E.setupLightsView(B),Ye===!0&&we.setGlobalState(P.clippingPlanes,B),Ws(S,q,B),X.updateMultisampleRenderTarget(fe),X.updateRenderTargetMipmap(fe),$e.has("WEBGL_multisampled_render_to_texture")===!1){let Se=!1;for(let Ze=0,pt=F.length;Ze<pt;Ze++){let ht=F[Ze],{object:Je,geometry:Ut,material:ge,group:Kt}=ht;if(ge.side===On&&Je.layers.test(B.layers)){let qe=ge.side;ge.side=Wt,ge.needsUpdate=!0,Gu(Je,q,B,Ut,ge,Kt),ge.side=qe,ge.needsUpdate=!0,Se=!0}}Se===!0&&(X.updateMultisampleRenderTarget(fe),X.updateRenderTargetMipmap(fe))}P.setRenderTarget(de,be,Me),P.setClearColor(et,He),Fe!==void 0&&(B.viewport=Fe),P.toneMapping=Ne}function Ws(S,F,q){let B=F.isScene===!0?F.overrideMaterial:null;for(let z=0,fe=S.length;z<fe;z++){let ye=S[z],{object:de,geometry:be,group:Me}=ye,Ne=ye.material;Ne.allowOverride===!0&&B!==null&&(Ne=B),de.layers.test(q.layers)&&Gu(de,F,q,be,Ne,Me)}}function Gu(S,F,q,B,z,fe){S.onBeforeRender(P,F,q,B,z,fe),S.modelViewMatrix.multiplyMatrices(q.matrixWorldInverse,S.matrixWorld),S.normalMatrix.getNormalMatrix(S.modelViewMatrix),z.onBeforeRender(P,F,q,B,S,fe),z.transparent===!0&&z.side===On&&z.forceSinglePass===!1?(z.side=Wt,z.needsUpdate=!0,P.renderBufferDirect(q,F,B,z,S,fe),z.side=ei,z.needsUpdate=!0,P.renderBufferDirect(q,F,B,z,S,fe),z.side=On):P.renderBufferDirect(q,F,B,z,S,fe),S.onAfterRender(P,F,q,B,z,fe)}function qs(S,F,q){F.isScene!==!0&&(F=kt);let B=G.get(S),z=E.state.lights,fe=E.state.shadowsArray,ye=z.state.version,de=ae.getParameters(S,z.state,fe,F,q,E.state.lightProbeGridArray),be=ae.getProgramCacheKey(de),Me=B.programs;B.environment=S.isMeshStandardMaterial||S.isMeshLambertMaterial||S.isMeshPhongMaterial?F.environment:null,B.fog=F.fog;let Ne=S.isMeshStandardMaterial||S.isMeshLambertMaterial&&!S.envMap||S.isMeshPhongMaterial&&!S.envMap;B.envMap=ie.get(S.envMap||B.environment,Ne),B.envMapRotation=B.environment!==null&&S.envMap===null?F.environmentRotation:S.envMapRotation,Me===void 0&&(S.addEventListener("dispose",Pn),Me=new Map,B.programs=Me);let Fe=Me.get(be);if(Fe!==void 0){if(B.currentProgram===Fe&&B.lightsStateVersion===ye)return Wu(S,de),Fe}else de.uniforms=ae.getUniforms(S),I!==null&&S.isNodeMaterial&&I.build(S,q,de),S.onBeforeCompile(de,P),Fe=ae.acquireProgram(de,be),Me.set(be,Fe),B.uniforms=de.uniforms;let Se=B.uniforms;return(!S.isShaderMaterial&&!S.isRawShaderMaterial||S.clipping===!0)&&(Se.clippingPlanes=we.uniform),Wu(S,de),B.needsLights=Np(S),B.lightsStateVersion=ye,B.needsLights&&(Se.ambientLightColor.value=z.state.ambient,Se.lightProbe.value=z.state.probe,Se.directionalLights.value=z.state.directional,Se.directionalLightShadows.value=z.state.directionalShadow,Se.spotLights.value=z.state.spot,Se.spotLightShadows.value=z.state.spotShadow,Se.rectAreaLights.value=z.state.rectArea,Se.ltc_1.value=z.state.rectAreaLTC1,Se.ltc_2.value=z.state.rectAreaLTC2,Se.pointLights.value=z.state.point,Se.pointLightShadows.value=z.state.pointShadow,Se.hemisphereLights.value=z.state.hemi,Se.directionalShadowMatrix.value=z.state.directionalShadowMatrix,Se.spotLightMatrix.value=z.state.spotLightMatrix,Se.spotLightMap.value=z.state.spotLightMap,Se.pointShadowMatrix.value=z.state.pointShadowMatrix),B.lightProbeGrid=E.state.lightProbeGridArray.length>0,B.currentProgram=Fe,B.uniformsList=null,Fe}function Hu(S){if(S.uniformsList===null){let F=S.currentProgram.getUniforms();S.uniformsList=Pr.seqWithValue(F.seq,S.uniforms)}return S.uniformsList}function Wu(S,F){let q=G.get(S);q.outputColorSpace=F.outputColorSpace,q.batching=F.batching,q.batchingColor=F.batchingColor,q.instancing=F.instancing,q.instancingColor=F.instancingColor,q.instancingMorph=F.instancingMorph,q.skinning=F.skinning,q.morphTargets=F.morphTargets,q.morphNormals=F.morphNormals,q.morphColors=F.morphColors,q.morphTargetsCount=F.morphTargetsCount,q.numClippingPlanes=F.numClippingPlanes,q.numIntersection=F.numClipIntersection,q.vertexAlphas=F.vertexAlphas,q.vertexTangents=F.vertexTangents,q.toneMapping=F.toneMapping}function Lp(S,F){if(S.length===0)return null;if(S.length===1)return S[0].texture!==null?S[0]:null;y.setFromMatrixPosition(F.matrixWorld);for(let q=0,B=S.length;q<B;q++){let z=S[q];if(z.texture!==null&&z.boundingBox.containsPoint(y))return z}return null}function Ip(S,F,q,B,z){F.isScene!==!0&&(F=kt),X.resetTextureUnits();let fe=F.fog,ye=B.isMeshStandardMaterial||B.isMeshLambertMaterial||B.isMeshPhongMaterial?F.environment:null,de=J===null?P.outputColorSpace:J.isXRRenderTarget===!0?J.texture.colorSpace:Ve.workingColorSpace,be=B.isMeshStandardMaterial||B.isMeshLambertMaterial&&!B.envMap||B.isMeshPhongMaterial&&!B.envMap,Me=ie.get(B.envMap||ye,be),Ne=B.vertexColors===!0&&!!q.attributes.color&&q.attributes.color.itemSize===4,Fe=!!q.attributes.tangent&&(!!B.normalMap||B.anisotropy>0),Se=!!q.morphAttributes.position,Ze=!!q.morphAttributes.normal,pt=!!q.morphAttributes.color,ht=vn;B.toneMapped&&(J===null||J.isXRRenderTarget===!0)&&(ht=P.toneMapping);let Je=q.morphAttributes.position||q.morphAttributes.normal||q.morphAttributes.color,Ut=Je!==void 0?Je.length:0,ge=G.get(B),Kt=E.state.lights;if(Ye===!0&&(We===!0||S!==j)){let nt=S===j&&B.id===Q;we.setState(B,S,nt)}let qe=!1;B.version===ge.__version?(ge.needsLights&&ge.lightsStateVersion!==Kt.state.version||ge.outputColorSpace!==de||z.isBatchedMesh&&ge.batching===!1||!z.isBatchedMesh&&ge.batching===!0||z.isBatchedMesh&&ge.batchingColor===!0&&z.colorTexture===null||z.isBatchedMesh&&ge.batchingColor===!1&&z.colorTexture!==null||z.isInstancedMesh&&ge.instancing===!1||!z.isInstancedMesh&&ge.instancing===!0||z.isSkinnedMesh&&ge.skinning===!1||!z.isSkinnedMesh&&ge.skinning===!0||z.isInstancedMesh&&ge.instancingColor===!0&&z.instanceColor===null||z.isInstancedMesh&&ge.instancingColor===!1&&z.instanceColor!==null||z.isInstancedMesh&&ge.instancingMorph===!0&&z.morphTexture===null||z.isInstancedMesh&&ge.instancingMorph===!1&&z.morphTexture!==null||ge.envMap!==Me||B.fog===!0&&ge.fog!==fe||ge.numClippingPlanes!==void 0&&(ge.numClippingPlanes!==we.numPlanes||ge.numIntersection!==we.numIntersection)||ge.vertexAlphas!==Ne||ge.vertexTangents!==Fe||ge.morphTargets!==Se||ge.morphNormals!==Ze||ge.morphColors!==pt||ge.toneMapping!==ht||ge.morphTargetsCount!==Ut||!!ge.lightProbeGrid!=E.state.lightProbeGridArray.length>0)&&(qe=!0):(qe=!0,ge.__version=B.version);let on=ge.currentProgram;qe===!0&&(on=qs(B,F,z),I&&B.isNodeMaterial&&I.onUpdateProgram(B,on,ge));let Ln=!1,ai=!1,ir=!1,Qe=on.getUniforms(),mt=ge.uniforms;if(b.useProgram(on.program)&&(Ln=!0,ai=!0,ir=!0),B.id!==Q&&(Q=B.id,ai=!0),ge.needsLights){let nt=Lp(E.state.lightProbeGridArray,z);ge.lightProbeGrid!==nt&&(ge.lightProbeGrid=nt,ai=!0)}if(Ln||j!==S){b.buffers.depth.getReversed()&&S.reversedDepth!==!0&&(S._reversedDepth=!0,S.updateProjectionMatrix()),Qe.setValue(D,"projectionMatrix",S.projectionMatrix),Qe.setValue(D,"viewMatrix",S.matrixWorldInverse);let ci=Qe.map.cameraPosition;ci!==void 0&&ci.setValue(D,Mt.setFromMatrixPosition(S.matrixWorld)),R.logarithmicDepthBuffer&&Qe.setValue(D,"logDepthBufFC",2/(Math.log(S.far+1)/Math.LN2)),(B.isMeshPhongMaterial||B.isMeshToonMaterial||B.isMeshLambertMaterial||B.isMeshBasicMaterial||B.isMeshStandardMaterial||B.isShaderMaterial)&&Qe.setValue(D,"isOrthographic",S.isOrthographicCamera===!0),j!==S&&(j=S,ai=!0,ir=!0)}if(ge.needsLights&&(Kt.state.directionalShadowMap.length>0&&Qe.setValue(D,"directionalShadowMap",Kt.state.directionalShadowMap,X),Kt.state.spotShadowMap.length>0&&Qe.setValue(D,"spotShadowMap",Kt.state.spotShadowMap,X),Kt.state.pointShadowMap.length>0&&Qe.setValue(D,"pointShadowMap",Kt.state.pointShadowMap,X)),z.isSkinnedMesh){Qe.setOptional(D,z,"bindMatrix"),Qe.setOptional(D,z,"bindMatrixInverse");let nt=z.skeleton;nt&&(nt.boneTexture===null&&nt.computeBoneTexture(),Qe.setValue(D,"boneTexture",nt.boneTexture,X))}z.isBatchedMesh&&(Qe.setOptional(D,z,"batchingTexture"),Qe.setValue(D,"batchingTexture",z._matricesTexture,X),Qe.setOptional(D,z,"batchingIdTexture"),Qe.setValue(D,"batchingIdTexture",z._indirectTexture,X),Qe.setOptional(D,z,"batchingColorTexture"),z._colorsTexture!==null&&Qe.setValue(D,"batchingColorTexture",z._colorsTexture,X));let li=q.morphAttributes;if((li.position!==void 0||li.normal!==void 0||li.color!==void 0)&&N.update(z,q,on),(ai||ge.receiveShadow!==z.receiveShadow)&&(ge.receiveShadow=z.receiveShadow,Qe.setValue(D,"receiveShadow",z.receiveShadow)),(B.isMeshStandardMaterial||B.isMeshLambertMaterial||B.isMeshPhongMaterial)&&B.envMap===null&&F.environment!==null&&(mt.envMapIntensity.value=F.environmentIntensity),mt.dfgLUT!==void 0&&(mt.dfgLUT.value=tb()),ai){if(Qe.setValue(D,"toneMappingExposure",P.toneMappingExposure),ge.needsLights&&kp(mt,ir),fe&&B.fog===!0&&ve.refreshFogUniforms(mt,fe),ve.refreshMaterialUniforms(mt,B,ne,se,E.state.transmissionRenderTarget[S.id]),ge.needsLights&&ge.lightProbeGrid){let nt=ge.lightProbeGrid;mt.probesSH.value=nt.texture,mt.probesMin.value.copy(nt.boundingBox.min),mt.probesMax.value.copy(nt.boundingBox.max),mt.probesResolution.value.copy(nt.resolution)}Pr.upload(D,Hu(ge),mt,X)}if(B.isShaderMaterial&&B.uniformsNeedUpdate===!0&&(Pr.upload(D,Hu(ge),mt,X),B.uniformsNeedUpdate=!1),B.isSpriteMaterial&&Qe.setValue(D,"center",z.center),Qe.setValue(D,"modelViewMatrix",z.modelViewMatrix),Qe.setValue(D,"normalMatrix",z.normalMatrix),Qe.setValue(D,"modelMatrix",z.matrixWorld),B.uniformsGroups!==void 0){let nt=B.uniformsGroups;for(let ci=0,rr=nt.length;ci<rr;ci++){let qu=nt[ci];ee.update(qu,on),ee.bind(qu,on)}}return on}function kp(S,F){S.ambientLightColor.needsUpdate=F,S.lightProbe.needsUpdate=F,S.directionalLights.needsUpdate=F,S.directionalLightShadows.needsUpdate=F,S.pointLights.needsUpdate=F,S.pointLightShadows.needsUpdate=F,S.spotLights.needsUpdate=F,S.spotLightShadows.needsUpdate=F,S.rectAreaLights.needsUpdate=F,S.hemisphereLights.needsUpdate=F}function Np(S){return S.isMeshLambertMaterial||S.isMeshToonMaterial||S.isMeshPhongMaterial||S.isMeshStandardMaterial||S.isShadowMaterial||S.isShaderMaterial&&S.lights===!0}this.getActiveCubeFace=function(){return O},this.getActiveMipmapLevel=function(){return W},this.getRenderTarget=function(){return J},this.setRenderTargetTextures=function(S,F,q){let B=G.get(S);B.__autoAllocateDepthBuffer=S.resolveDepthBuffer===!1,B.__autoAllocateDepthBuffer===!1&&(B.__useRenderToTexture=!1),G.get(S.texture).__webglTexture=F,G.get(S.depthTexture).__webglTexture=B.__autoAllocateDepthBuffer?void 0:q,B.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(S,F){let q=G.get(S);q.__webglFramebuffer=F,q.__useDefaultFramebuffer=F===void 0},this.setRenderTarget=function(S,F=0,q=0){J=S,O=F,W=q;let B=null,z=!1,fe=!1;if(S){let de=G.get(S);if(de.__useDefaultFramebuffer!==void 0){b.bindFramebuffer(D.FRAMEBUFFER,de.__webglFramebuffer),te.copy(S.viewport),me.copy(S.scissor),Oe=S.scissorTest,b.viewport(te),b.scissor(me),b.setScissorTest(Oe),Q=-1;return}else if(de.__webglFramebuffer===void 0)X.setupRenderTarget(S);else if(de.__hasExternalTextures)X.rebindTextures(S,G.get(S.texture).__webglTexture,G.get(S.depthTexture).__webglTexture);else if(S.depthBuffer){let Ne=S.depthTexture;if(de.__boundDepthTexture!==Ne){if(Ne!==null&&G.has(Ne)&&(S.width!==Ne.image.width||S.height!==Ne.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");X.setupDepthRenderbuffer(S)}}let be=S.texture;(be.isData3DTexture||be.isDataArrayTexture||be.isCompressedArrayTexture)&&(fe=!0);let Me=G.get(S).__webglFramebuffer;S.isWebGLCubeRenderTarget?(Array.isArray(Me[F])?B=Me[F][q]:B=Me[F],z=!0):S.samples>0&&X.useMultisampledRTT(S)===!1?B=G.get(S).__webglMultisampledFramebuffer:Array.isArray(Me)?B=Me[q]:B=Me,te.copy(S.viewport),me.copy(S.scissor),Oe=S.scissorTest}else te.copy(Ee).multiplyScalar(ne).floor(),me.copy(ft).multiplyScalar(ne).floor(),Oe=ze;if(q!==0&&(B=L),b.bindFramebuffer(D.FRAMEBUFFER,B)&&b.drawBuffers(S,B),b.viewport(te),b.scissor(me),b.setScissorTest(Oe),z){let de=G.get(S.texture);D.framebufferTexture2D(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_CUBE_MAP_POSITIVE_X+F,de.__webglTexture,q)}else if(fe){let de=F;for(let be=0;be<S.textures.length;be++){let Me=G.get(S.textures[be]);D.framebufferTextureLayer(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0+be,Me.__webglTexture,q,de)}}else if(S!==null&&q!==0){let de=G.get(S.texture);D.framebufferTexture2D(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,de.__webglTexture,q)}Q=-1},this.readRenderTargetPixels=function(S,F,q,B,z,fe,ye,de=0){if(!(S&&S.isWebGLRenderTarget)){Re("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let be=G.get(S).__webglFramebuffer;if(S.isWebGLCubeRenderTarget&&ye!==void 0&&(be=be[ye]),be){b.bindFramebuffer(D.FRAMEBUFFER,be);try{let Me=S.textures[de],Ne=Me.format,Fe=Me.type;if(S.textures.length>1&&D.readBuffer(D.COLOR_ATTACHMENT0+de),!R.textureFormatReadable(Ne)){Re("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!R.textureTypeReadable(Fe)){Re("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}F>=0&&F<=S.width-B&&q>=0&&q<=S.height-z&&D.readPixels(F,q,B,z,ce.convert(Ne),ce.convert(Fe),fe)}finally{let Me=J!==null?G.get(J).__webglFramebuffer:null;b.bindFramebuffer(D.FRAMEBUFFER,Me)}}},this.readRenderTargetPixelsAsync=async function(S,F,q,B,z,fe,ye,de=0){if(!(S&&S.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let be=G.get(S).__webglFramebuffer;if(S.isWebGLCubeRenderTarget&&ye!==void 0&&(be=be[ye]),be)if(F>=0&&F<=S.width-B&&q>=0&&q<=S.height-z){b.bindFramebuffer(D.FRAMEBUFFER,be);let Me=S.textures[de],Ne=Me.format,Fe=Me.type;if(S.textures.length>1&&D.readBuffer(D.COLOR_ATTACHMENT0+de),!R.textureFormatReadable(Ne))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!R.textureTypeReadable(Fe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Se=D.createBuffer();D.bindBuffer(D.PIXEL_PACK_BUFFER,Se),D.bufferData(D.PIXEL_PACK_BUFFER,fe.byteLength,D.STREAM_READ),D.readPixels(F,q,B,z,ce.convert(Ne),ce.convert(Fe),0);let Ze=J!==null?G.get(J).__webglFramebuffer:null;b.bindFramebuffer(D.FRAMEBUFFER,Ze);let pt=D.fenceSync(D.SYNC_GPU_COMMANDS_COMPLETE,0);return D.flush(),await Xh(D,pt,4),D.bindBuffer(D.PIXEL_PACK_BUFFER,Se),D.getBufferSubData(D.PIXEL_PACK_BUFFER,0,fe),D.deleteBuffer(Se),D.deleteSync(pt),fe}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(S,F=null,q=0){let B=Math.pow(2,-q),z=Math.floor(S.image.width*B),fe=Math.floor(S.image.height*B),ye=F!==null?F.x:0,de=F!==null?F.y:0;X.setTexture2D(S,0),D.copyTexSubImage2D(D.TEXTURE_2D,q,0,0,ye,de,z,fe),b.unbindTexture()},this.copyTextureToTexture=function(S,F,q=null,B=null,z=0,fe=0){let ye,de,be,Me,Ne,Fe,Se,Ze,pt,ht=S.isCompressedTexture?S.mipmaps[fe]:S.image;if(q!==null)ye=q.max.x-q.min.x,de=q.max.y-q.min.y,be=q.isBox3?q.max.z-q.min.z:1,Me=q.min.x,Ne=q.min.y,Fe=q.isBox3?q.min.z:0;else{let mt=Math.pow(2,-z);ye=Math.floor(ht.width*mt),de=Math.floor(ht.height*mt),S.isDataArrayTexture?be=ht.depth:S.isData3DTexture?be=Math.floor(ht.depth*mt):be=1,Me=0,Ne=0,Fe=0}B!==null?(Se=B.x,Ze=B.y,pt=B.z):(Se=0,Ze=0,pt=0);let Je=ce.convert(F.format),Ut=ce.convert(F.type),ge;F.isData3DTexture?(X.setTexture3D(F,0),ge=D.TEXTURE_3D):F.isDataArrayTexture||F.isCompressedArrayTexture?(X.setTexture2DArray(F,0),ge=D.TEXTURE_2D_ARRAY):(X.setTexture2D(F,0),ge=D.TEXTURE_2D),b.activeTexture(D.TEXTURE0),b.pixelStorei(D.UNPACK_FLIP_Y_WEBGL,F.flipY),b.pixelStorei(D.UNPACK_PREMULTIPLY_ALPHA_WEBGL,F.premultiplyAlpha),b.pixelStorei(D.UNPACK_ALIGNMENT,F.unpackAlignment);let Kt=b.getParameter(D.UNPACK_ROW_LENGTH),qe=b.getParameter(D.UNPACK_IMAGE_HEIGHT),on=b.getParameter(D.UNPACK_SKIP_PIXELS),Ln=b.getParameter(D.UNPACK_SKIP_ROWS),ai=b.getParameter(D.UNPACK_SKIP_IMAGES);b.pixelStorei(D.UNPACK_ROW_LENGTH,ht.width),b.pixelStorei(D.UNPACK_IMAGE_HEIGHT,ht.height),b.pixelStorei(D.UNPACK_SKIP_PIXELS,Me),b.pixelStorei(D.UNPACK_SKIP_ROWS,Ne),b.pixelStorei(D.UNPACK_SKIP_IMAGES,Fe);let ir=S.isDataArrayTexture||S.isData3DTexture,Qe=F.isDataArrayTexture||F.isData3DTexture;if(S.isDepthTexture){let mt=G.get(S),li=G.get(F),nt=G.get(mt.__renderTarget),ci=G.get(li.__renderTarget);b.bindFramebuffer(D.READ_FRAMEBUFFER,nt.__webglFramebuffer),b.bindFramebuffer(D.DRAW_FRAMEBUFFER,ci.__webglFramebuffer);for(let rr=0;rr<be;rr++)ir&&(D.framebufferTextureLayer(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,G.get(S).__webglTexture,z,Fe+rr),D.framebufferTextureLayer(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,G.get(F).__webglTexture,fe,pt+rr)),D.blitFramebuffer(Me,Ne,ye,de,Se,Ze,ye,de,D.DEPTH_BUFFER_BIT,D.NEAREST);b.bindFramebuffer(D.READ_FRAMEBUFFER,null),b.bindFramebuffer(D.DRAW_FRAMEBUFFER,null)}else if(z!==0||S.isRenderTargetTexture||G.has(S)){let mt=G.get(S),li=G.get(F);b.bindFramebuffer(D.READ_FRAMEBUFFER,H),b.bindFramebuffer(D.DRAW_FRAMEBUFFER,k);for(let nt=0;nt<be;nt++)ir?D.framebufferTextureLayer(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,mt.__webglTexture,z,Fe+nt):D.framebufferTexture2D(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,mt.__webglTexture,z),Qe?D.framebufferTextureLayer(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,li.__webglTexture,fe,pt+nt):D.framebufferTexture2D(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,li.__webglTexture,fe),z!==0?D.blitFramebuffer(Me,Ne,ye,de,Se,Ze,ye,de,D.COLOR_BUFFER_BIT,D.NEAREST):Qe?D.copyTexSubImage3D(ge,fe,Se,Ze,pt+nt,Me,Ne,ye,de):D.copyTexSubImage2D(ge,fe,Se,Ze,Me,Ne,ye,de);b.bindFramebuffer(D.READ_FRAMEBUFFER,null),b.bindFramebuffer(D.DRAW_FRAMEBUFFER,null)}else Qe?S.isDataTexture||S.isData3DTexture?D.texSubImage3D(ge,fe,Se,Ze,pt,ye,de,be,Je,Ut,ht.data):F.isCompressedArrayTexture?D.compressedTexSubImage3D(ge,fe,Se,Ze,pt,ye,de,be,Je,ht.data):D.texSubImage3D(ge,fe,Se,Ze,pt,ye,de,be,Je,Ut,ht):S.isDataTexture?D.texSubImage2D(D.TEXTURE_2D,fe,Se,Ze,ye,de,Je,Ut,ht.data):S.isCompressedTexture?D.compressedTexSubImage2D(D.TEXTURE_2D,fe,Se,Ze,ht.width,ht.height,Je,ht.data):D.texSubImage2D(D.TEXTURE_2D,fe,Se,Ze,ye,de,Je,Ut,ht);b.pixelStorei(D.UNPACK_ROW_LENGTH,Kt),b.pixelStorei(D.UNPACK_IMAGE_HEIGHT,qe),b.pixelStorei(D.UNPACK_SKIP_PIXELS,on),b.pixelStorei(D.UNPACK_SKIP_ROWS,Ln),b.pixelStorei(D.UNPACK_SKIP_IMAGES,ai),fe===0&&F.generateMipmaps&&D.generateMipmap(ge),b.unbindTexture()},this.initRenderTarget=function(S){G.get(S).__webglFramebuffer===void 0&&X.setupRenderTarget(S)},this.initTexture=function(S){S.isCubeTexture?X.setTextureCube(S,0):S.isData3DTexture?X.setTexture3D(S,0):S.isDataArrayTexture||S.isCompressedArrayTexture?X.setTexture2DArray(S,0):X.setTexture2D(S,0),b.unbindTexture()},this.resetState=function(){O=0,W=0,J=null,b.reset(),pe.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return bn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=Ve._getDrawingBufferColorSpace(e),t.unpackColorSpace=Ve._getUnpackColorSpace()}};var ws={lng:4.9,lat:52.37},Ad=111320*Math.cos(ws.lat*Math.PI/180),Td=110540,$t=(n,e)=>[(n-ws.lng)*Ad,(e-ws.lat)*Td],Ti=(n,e)=>[ws.lng+n/Ad,ws.lat+e/Td];var Bc=["major","secondary","tertiary","minor","service","cycle","path"];var nb=["green","wood","wetland","sport","cemetery","allotments","farmland","industrial","construction","sand"];var ib=["rail","light_rail","subway","tram","narrow_gauge","monorail","funicular"],rb=1,sb=2,ob=4;function ri(n,e,t=0){let i=[],r=0,s=0;for(let o=t;o+1<n.length;o+=2)r+=n[o],s+=n[o+1],i.push([r*e,s*e]);return i}function Rd(n){if(n.version!==1&&n.version!==2)throw new Error(`own-map overview: unsupported version ${n.version}`);let e=n.unit,t=i=>i>=0?n.names[i]??"":"";return{bounds:n.bounds,water:n.water.map(i=>i.map(r=>ri(r,e))),parks:n.parks.map(([i,...r])=>({name:t(i),rings:r.map(s=>ri(s,e))})),streets:n.streets.map(i=>({cls:Bc[i[0]],name:t(i[1]),points:ri(i,e,2)})),waterLines:n.waterLines.map(i=>({name:t(i[0]),points:ri(i,e,1)})),hoods:n.hoods.map(([i,r,s])=>({name:t(i),at:[r*e,s*e]})),landuse:(n.landuse??[]).map(([[i],...r])=>({cls:nb[i],rings:r.map(s=>ri(s,e))})),rail:(n.rail??[]).map(i=>({kind:ib[i[0]],tunnel:!!(i[1]&rb),bridge:!!(i[1]&sb),service:!!(i[1]&ob),points:ri(i,e,2)})),piers:(n.piers??[]).map(i=>ri(i,e)),pierLines:(n.pierLines??[]).map(i=>ri(i,e)),hoodRings:(n.hoodRings??[]).map(i=>ri(i,e))}}var ab=63710088e-1,lb=36.86989764584402,Gc=85;function cb(n,e){return 2*Math.PI*ab*Math.cos(e*Math.PI/180)/(512*2**n)}var Pd=(n,e)=>[n[0]-e[0],n[1]-e[1],n[2]-e[2]],zc=(n,e)=>n[0]*e[0]+n[1]*e[1]+n[2]*e[2],Cd=(n,e)=>[n[1]*e[2]-n[2]*e[1],n[2]*e[0]-n[0]*e[2],n[0]*e[1]-n[1]*e[0]],Vc=n=>{let e=Math.hypot(n[0],n[1],n[2])||1;return[n[0]/e,n[1]/e,n[2]/e]};function cn(n,e,t){let i=(n.fovDeg??lb)*Math.PI/180,r=t??Ti(n.center[0],n.center[1])[1],s=cb(n.zoom,r),o=.5*e.height/Math.tan(i/2),a=o*s,l=Math.min(Gc,Math.max(0,n.pitch))*Math.PI/180,c=n.bearing*Math.PI/180,h=[Math.sin(c),Math.cos(c),0],f=n.elevation??0,u=[n.center[0],n.center[1],f],d=[u[0]-h[0]*a*Math.sin(l),u[1]-h[1]*a*Math.sin(l),f+a*Math.cos(l)],g=Vc(Pd(u,d)),x=Vc(Cd(h,[0,0,1])),p=Vc(Cd(x,g));return{eye:d,target:u,forward:g,right:x,up:p,focal:o,distance:a,mpp:s,viewport:e}}function Zi(n,e){let t=Pd([e[0],e[1],e[2]??0],n.eye),i=zc(t,n.forward),r=n.focal/(i||1e-9);return{x:n.viewport.width/2+zc(t,n.right)*r,y:n.viewport.height/2-zc(t,n.up)*r,depth:i}}function rn(n,e,t,i=0){let r=(e-n.viewport.width/2)/n.focal,s=-(t-n.viewport.height/2)/n.focal,o=[n.forward[0]+n.right[0]*r+n.up[0]*s,n.forward[1]+n.right[1]*r+n.up[1]*s,n.forward[2]+n.right[2]*r+n.up[2]*s];if(o[2]>=-1e-9)return null;let a=(i-n.eye[2])/o[2];return a<=0?null:[n.eye[0]+o[0]*a,n.eye[1]+o[1]*a]}function Hc(n,e=2e4){let{width:t,height:i}=n.viewport,r=[];for(let[f,u]of[[0,0],[t,0],[0,i],[t,i],[t/2,0],[0,i/2],[t,i/2]]){let d=rn(n,f,u);for(let g=u;!d&&g<i;g+=i/16)d=rn(n,f,g);d&&r.push(d)}let s=n.target[0],o=n.target[1],a=s,l=o,c=s,h=o;for(let[f,u]of r){let d=Math.max(-e,Math.min(e,f-s)),g=Math.max(-e,Math.min(e,u-o));a=Math.min(a,s+d),c=Math.max(c,s+d),l=Math.min(l,o+g),h=Math.max(h,o+g)}return[a,l,c,h]}function Wc(n,e,t={}){let i={top:0,right:0,bottom:0,left:0,...t.padding},r=t.bearing??0,s=t.pitch??0,o=1/0,a=1/0,l=-1/0,c=-1/0;for(let[x,p]of n)o=Math.min(o,x),l=Math.max(l,x),a=Math.min(a,p),c=Math.max(c,p);let h=[(o+l)/2,(a+c)/2],f=x=>{let p=cn({center:h,zoom:x,bearing:r,pitch:s,fovDeg:t.fovDeg},e);return n.every(m=>{let v=Zi(p,m);return v.depth>0&&v.x>=i.left&&v.x<=e.width-i.right&&v.y>=i.top&&v.y<=e.height-i.bottom})},u=x=>{let p=cn({center:h,zoom:x,bearing:r,pitch:s,fovDeg:t.fovDeg},e),m={x:(i.left+e.width-i.right)/2,y:(i.top+e.height-i.bottom)/2},v=rn(p,e.width/2,e.height/2),M=rn(p,m.x,m.y);v&&M&&(h=[h[0]-(M[0]-v[0]),h[1]-(M[1]-v[1])])},d=0,g=t.maxZoom??22;for(let x=0;x<2;x++){d=0,g=t.maxZoom??22;for(let p=0;p<40;p++){let m=(d+g)/2;f(m)?d=m:g=m}x===0&&u(d)}return{center:h,zoom:d,bearing:r,pitch:s,fovDeg:t.fovDeg}}var ub=n=>n*n*(3-2*n),Wa=(n,e,t)=>n+(e-n)*t,hb=(n,e,t)=>n+(((e-n)%360+540)%360-180)*t;function qc(n,e,t){let i=ub(Math.max(0,Math.min(1,t))),r=Wa(n.zoom,e.zoom,i),s=e.zoom-n.zoom,o=Math.abs(s)<1e-6?i:(1-2**-(r-n.zoom))/(1-2**-s);return{center:[Wa(n.center[0],e.center[0],o),Wa(n.center[1],e.center[1],o)],zoom:r,bearing:hb(n.bearing,e.bearing,i),pitch:Wa(n.pitch,e.pitch,i),fovDeg:e.fovDeg??n.fovDeg}}var Es={minZoom:9,maxZoom:20,maxPitch:70};function Ki(n,e=Es){let[t,i]=n.center;return e.bounds&&(t=Math.max(e.bounds[0],Math.min(e.bounds[2],t)),i=Math.max(e.bounds[1],Math.min(e.bounds[3],i))),{...n,center:[t,i],zoom:Math.max(e.minZoom,Math.min(e.maxZoom,n.zoom)),pitch:Math.max(0,Math.min(Math.min(e.maxPitch,Gc),n.pitch)),bearing:(n.bearing%360+540)%360-180}}function Ld(n,e,t,i){let r=cn(n,e),s=rn(r,t.x,t.y),o=rn(r,i.x,i.y);return!s||!o?n:{...n,center:[n.center[0]-(o[0]-s[0]),n.center[1]-(o[1]-s[1])]}}function Id(n,e,t,i,r=Es){let s=rn(cn(n,e),i.x,i.y),o=Ki({...n,zoom:n.zoom+t},r),a=rn(cn(o,e),i.x,i.y);return!s||!a?o:{...o,center:[o.center[0]+s[0]-a[0],o.center[1]+s[1]-a[1]]}}function kd(n,e,t,i){let r=i??{x:e.width/2,y:e.height/2},s=rn(cn(n,e),r.x,r.y),o={...n,bearing:n.bearing+t},a=rn(cn(o,e),r.x,r.y);return!s||!a?o:{...o,center:[o.center[0]+s[0]-a[0],o.center[1]+s[1]-a[1]]}}function Nd(n,e,t=Es){return Ki({...n,pitch:n.pitch+e},t)}function db(n,e,t,i,r=Es){let s=g=>({x:(g[0][0]+g[1][0])/2,y:(g[0][1]+g[1][1])/2}),o=g=>Math.hypot(g[1][0]-g[0][0],g[1][1]-g[0][1])||1,a=g=>Math.atan2(g[1][1]-g[0][1],g[1][0]-g[0][0]),l=s(t),c=s(i),h=i[0][1]-t[0][1],f=i[1][1]-t[1][1];if(Math.sign(h)===Math.sign(f)&&Math.abs(h)>2&&Math.abs(f)>2&&Math.abs(o(i)-o(t))<4&&Math.abs(i[0][0]-t[0][0])<Math.abs(h)*.5)return Nd(n,-(h+f)/2*.4,r);let u=Ld(n,e,l,c);u=Id(u,e,Math.log2(o(i)/o(t)),c,r);let d=(a(i)-a(t))*180/Math.PI;return d=(d+540)%360-180,Math.abs(d)>.3&&(u=kd(u,e,-d,c)),u}var fb=(n,e=0)=>-(e===1?n*40:n)/450;function Dd(n,e,t,i=Es){let r=new Map,s=null,o=()=>({width:n.clientWidth,height:n.clientHeight}),a=d=>{let g=n.getBoundingClientRect();return[d.clientX-g.left,d.clientY-g.top]},l=d=>{n.setPointerCapture(d.pointerId),r.set(d.pointerId,a(d)),s=d.button===2||d.ctrlKey||d.metaKey?"rotate":"pan"},c=d=>{let g=r.get(d.pointerId);if(!g)return;let x=a(d);if(r.size>=2){let p=[...r.keys()].slice(0,2),m=[r.get(p[0]),r.get(p[1])];r.set(d.pointerId,x);let v=[r.get(p[0]),r.get(p[1])];t(Ki(db(e(),o(),m,v,i),i));return}if(r.set(d.pointerId,x),s==="rotate"){let p=kd(e(),o(),(x[0]-g[0])*.4);p=Nd(p,-(x[1]-g[1])*.3,i),t(Ki(p,i))}else t(Ki(Ld(e(),o(),{x:g[0],y:g[1]},{x:x[0],y:x[1]}),i))},h=d=>{r.delete(d.pointerId),r.size||(s=null)},f=d=>{d.preventDefault();let[g,x]=a(d);t(Id(e(),o(),fb(d.deltaY,d.deltaMode),{x:g,y:x},i))},u=d=>d.preventDefault();return n.addEventListener("pointerdown",l),n.addEventListener("pointermove",c),n.addEventListener("pointerup",h),n.addEventListener("pointercancel",h),n.addEventListener("wheel",f,{passive:!1}),n.addEventListener("contextmenu",u),n.style.touchAction="none",()=>{n.removeEventListener("pointerdown",l),n.removeEventListener("pointermove",c),n.removeEventListener("pointerup",h),n.removeEventListener("pointercancel",h),n.removeEventListener("wheel",f),n.removeEventListener("contextmenu",u)}}var Cs=new Set,Xc=!1;function wn(n,e,t=2){let i=e&&e.length,r=i?e[0]*t:n.length;Cs.size&&Cs.clear();let s=Bd(n,0,r,t,!0),o=[];if(!s||s.next===s.prev)return o;let a=0,l=0,c=0;if(i&&(s=xb(n,e,s,t)),n.length>80*t){a=n[0],l=n[1];let h=a,f=l;for(let u=t;u<r;u+=t){let d=n[u],g=n[u+1];d<a&&(a=d),g<l&&(l=g),d>h&&(h=d),g>f&&(f=g)}c=Math.max(h-a,f-l),c=c!==0?32767/c:0}return Yc(s,o,a,l,c),o}function Bd(n,e,t,i,r){let s=null;if(r===Lb(n,e,t,i)>0)for(let o=e;o<t;o+=i)s=Od(o/i|0,n[o],n[o+1],s);else for(let o=t-i;o>=e;o-=i)s=Od(o/i|0,n[o],n[o+1],s);return s&&Ps(s,s.next)&&(Is(s),s=s.next),s}function Qi(n,e=n){let t=e===n,i=n,r;do r=!1,i!==i.next&&(Cs.size===0||!Cs.has(i))&&(Ps(i,i.next)||_t(i.prev,i,i.next)===0)?((t||i===e)&&(e=i.prev),Xc=!0,Is(i),i=i.prev,r=!0):(t||i!==e)&&(i=i.next,r=!t);while(r||i!==e);return e}function Yc(n,e,t,i,r){r&&Eb(n,t,i,r);let s=n,o=!1;for(;n.prev!==n.next;){let a=n.prev,l=n.next;if(_t(a,n,l)<0&&(r?mb(n,t,i,r):pb(n))){e.push(a.i,n.i,l.i),Is(n),n=l,s=l;continue}if(n=l,n===s){if(Xc=!1,n=Qi(n),Xc){s=n;continue}if(!o){n=gb(n,e),s=n,o=!0;continue}yb(n,e,t,i,r);break}}}function pb(n){let e=n.prev,t=n,i=n.next,r=e.x,s=t.x,o=i.x,a=e.y,l=t.y,c=i.y,h=Math.min(r,s,o),f=Math.min(a,l,c),u=Math.max(r,s,o),d=Math.max(a,l,c),g=i.next;for(;g!==e;){if(g.x>=h&&g.x<=u&&g.y>=f&&g.y<=d&&!(r===g.x&&a===g.y)&&ja(r,a,s,l,o,c,g.x,g.y)&&_t(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function mb(n,e,t,i){let r=n.prev,s=n,o=n.next,a=r.x,l=s.x,c=o.x,h=r.y,f=s.y,u=o.y,d=Math.min(a,l,c),g=Math.min(h,f,u),x=Math.max(a,l,c),p=Math.max(h,f,u),m=Kc(d,g,e,t,i),v=Kc(x,p,e,t,i),M=n.prevZ;for(;M&&M.z>=m;){if(M.x>=d&&M.x<=x&&M.y>=g&&M.y<=p&&M!==o&&!(a===M.x&&h===M.y)&&ja(a,h,l,f,c,u,M.x,M.y)&&_t(M.prev,M,M.next)>=0)return!1;M=M.prevZ}let y=n.nextZ;for(;y&&y.z<=v;){if(y.x>=d&&y.x<=x&&y.y>=g&&y.y<=p&&y!==o&&!(a===y.x&&h===y.y)&&ja(a,h,l,f,c,u,y.x,y.y)&&_t(y.prev,y,y.next)>=0)return!1;y=y.nextZ}return!0}function gb(n,e){let t=n,i=!1;do{let r=t.prev,s=t.next.next;Gd(r,t,t.next,s,!1)&&Ls(r,s)&&Ls(s,r)&&(e.push(r.i,t.i,s.i),Is(t),Is(t.next),t=n=s,i=!0),t=t.next}while(t!==n);return i?Qi(t):t}function yb(n,e,t,i,r){let s=n;do{let o=s.next.next;for(;o!==s.prev;){if(s.i!==o.i&&Rb(s,o)){let a=Hd(s,o);s=Qi(s,s.next),a=Qi(a,a.next),Yc(s,e,t,i,r),Yc(a,e,t,i,r);return}o=o.next}s=s.next}while(s!==n)}var jc=!1;function xb(n,e,t,i){let r=[];for(let s=0,o=e.length;s<o;s++){let a=e[s]*i,l=s<o-1?e[s+1]*i:n.length,c=Bd(n,a,l,i,!1);c===c.next&&Cs.add(c),r.push(Tb(c))}r.sort(bb),vb(n.length/i,e.length),Vd(t,t),jc=!0;for(let s=0;s<r.length;s++)t=_b(r[s],t);return jc=!1,Qi(t)}function bb(n,e){return n.x-e.x||n.y-e.y||(n.next.y-n.y)/(n.next.x-n.x)-(e.next.y-e.y)/(e.next.x-e.x)}function _b(n,e){let t=Sb(n,e);if(!t)return e;let i=Hd(t,n),r=i.next;return Vd(t,r.next),Qi(i,i.next),Qi(t,t.next)}var zd=16,dt=new Float64Array(0),Ya=0,$c=[],Zc=[];function vb(n,e){let t=Math.ceil((n+2*e)/zd)+e+2;dt.length<t*4&&(dt=new Float64Array(t*4)),Ya=0}function Vd(n,e){let t=n;do{let i=Ya++;$c[i]=t;let r=1/0,s=1/0,o=-1/0,a=-1/0,l=0;do{let h=t.next;t.z=i,t.x<r&&(r=t.x),t.x>o&&(o=t.x),t.y<s&&(s=t.y),t.y>a&&(a=t.y),h.x<r&&(r=h.x),h.x>o&&(o=h.x),h.y<s&&(s=h.y),h.y>a&&(a=h.y),t=h}while(++l<zd&&t!==e);Zc[i]=t;let c=i*4;dt[c]=r,dt[c+1]=s,dt[c+2]=o,dt[c+3]=a}while(t!==e)}function Mb(n,e){let t=n.z*4;e.x<dt[t]&&(dt[t]=e.x),e.y<dt[t+1]&&(dt[t+1]=e.y),e.x>dt[t+2]&&(dt[t+2]=e.x),e.y>dt[t+3]&&(dt[t+3]=e.y)}function Fd(n){let e=Zc[n];for(;e.prev.next!==e;)e=e.next;return Zc[n]=e,e}function Ud(n){let e=$c[n];for(;e.prev.next!==e;)e=e.next;return $c[n]=e,e}function Sb(n,e){let t=e,i=n.x,r=n.y,s=-1/0,o;if(Ps(n,t))return t;for(let u=0,d=0;u<Ya;u++,d+=4){if(r<dt[d+1]||r>dt[d+3]||dt[d]>i||dt[d+2]<=s)continue;let g=Fd(u);t=Ud(u);do{if(t.prev.next===t){if(Ps(n,t.next))return t.next;if(r<=t.y&&r>=t.next.y&&t.next.y!==t.y){let x=t.x+(r-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(x<=i&&x>s&&(s=x,o=t.x<t.next.x?t:t.next,x===i))return o}}t=t.next}while(t!==g)}if(!o)return null;let a=o.x,l=o.y,c=Math.min(r,l),h=Math.max(r,l),f=1/0;for(let u=0,d=0;u<Ya;u++,d+=4){if(dt[d+2]<a||dt[d]>i||dt[d+3]<c||dt[d+1]>h)continue;let g=Fd(u);t=Ud(u);do{if(t.prev.next===t&&i>=t.x&&t.x>=a&&i!==t.x&&ja(r<l?i:s,r,a,l,r<l?s:i,r,t.x,t.y)){let x=Math.abs(r-t.y)/(i-t.x);(Ls(t,n)||t.y===r&&t.next.y===r&&t.next.x>i)&&(x<f||x===f&&(t.x>o.x||t.x===o.x&&wb(o,t)))&&(o=t,f=x)}t=t.next}while(t!==g)}return o}function wb(n,e){return _t(n.prev,n,e.prev)<0&&_t(e.next,n,n.next)<0}var un=[],As=[],Ji=new Uint32Array(0),Ts=new Uint32Array(0),Rs=new Uint32Array(256);function Eb(n,e,t,i){let r=n,s=0;do r.z=Kc(r.x,r.y,e,t,i),un[s++]=r,r=r.next;while(r!==n);Ab(s);let o=null;for(let a=0;a<s;a++){let l=un[a];l.prevZ=o,o&&(o.nextZ=l),o=l}o.nextZ=null}function Ab(n){if(n<=32){for(let e=1;e<n;e++){let t=un[e],i=t.z,r=e-1;for(;r>=0&&un[r].z>i;)un[r+1]=un[r],r--;un[r+1]=t}return}Ji.length<n&&(Ji=new Uint32Array(n),Ts=new Uint32Array(n),As=new Array(n));for(let e=0;e<n;e++)Ji[e]=un[e].z;qa(n,un,Ji,As,Ts,0),qa(n,As,Ts,un,Ji,8),qa(n,un,Ji,As,Ts,16),qa(n,As,Ts,un,Ji,24)}function qa(n,e,t,i,r,s){Rs.fill(0);for(let a=0;a<n;a++)Rs[t[a]>>>s&255]++;let o=0;for(let a=0;a<256;a++){let l=Rs[a];Rs[a]=o,o+=l}for(let a=0;a<n;a++){let l=t[a],c=Rs[l>>>s&255]++;i[c]=e[a],r[c]=l}}function Kc(n,e,t,i,r){return n=(n-t)*r|0,e=(e-i)*r|0,n=(n|n<<8)&16711935,n=(n|n<<4)&252645135,n=(n|n<<2)&858993459,n=(n|n<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,n|e<<1}function Tb(n){let e=n,t=n;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==n);return t}function ja(n,e,t,i,r,s,o,a){return(r-o)*(e-a)>=(n-o)*(s-a)&&(n-o)*(i-a)>=(t-o)*(e-a)&&(t-o)*(s-a)>=(r-o)*(i-a)}function Rb(n,e){let t=Ps(n,e)&&_t(n.prev,n,n.next)>0&&_t(e.prev,e,e.next)>0;return n.next.i!==e.i&&(t||Ls(n,e)&&Ls(e,n)&&(_t(n.prev,n,e.prev)!==0||_t(n,e.prev,e)!==0))&&!Cb(n,e)&&(t||Pb(n,e))}function _t(n,e,t){return(e.y-n.y)*(t.x-e.x)-(e.x-n.x)*(t.y-e.y)}function Ps(n,e){return n.x===e.x&&n.y===e.y}function Gd(n,e,t,i,r=!0){let s=_t(n,e,t),o=_t(n,e,i),a=_t(t,i,n),l=_t(t,i,e);return(s>0&&o<0||s<0&&o>0)&&(a>0&&l<0||a<0&&l>0)?!0:r?!!(s===0&&Xa(n,t,e)||o===0&&Xa(n,i,e)||a===0&&Xa(t,n,i)||l===0&&Xa(t,e,i)):!1}function Xa(n,e,t){return e.x<=Math.max(n.x,t.x)&&e.x>=Math.min(n.x,t.x)&&e.y<=Math.max(n.y,t.y)&&e.y>=Math.min(n.y,t.y)}function Cb(n,e){let t=Math.min(n.x,e.x),i=Math.max(n.x,e.x),r=Math.min(n.y,e.y),s=Math.max(n.y,e.y),o=n;do{let a=o.next;if(o.x>i&&a.x>i||o.x<t&&a.x<t||o.y>s&&a.y>s||o.y<r&&a.y<r){o=a;continue}if(o.i!==n.i&&a.i!==n.i&&o.i!==e.i&&a.i!==e.i&&Gd(o,a,n,e))return!0;o=a}while(o!==n);return!1}function Ls(n,e){return _t(n.prev,n,n.next)<0?_t(n,e,n.next)>=0&&_t(n,n.prev,e)>=0:_t(n,e,n.prev)<0||_t(n,n.next,e)<0}function Pb(n,e){let t=n,i=!1,r=(n.x+e.x)/2,s=(n.y+e.y)/2;do{let o=t.next;t.y>s!=o.y>s&&r<(o.x-t.x)*(s-t.y)/(o.y-t.y)+t.x&&(i=!i),t=o}while(t!==n);return i}function Hd(n,e){let t=Jc(n.i,n.x,n.y),i=Jc(e.i,e.x,e.y),r=n.next,s=e.prev;return n.next=e,e.prev=n,t.next=r,r.prev=t,i.next=t,t.prev=i,s.next=i,i.prev=s,i}function Od(n,e,t,i){let r=Jc(n,e,t);return i?(r.next=i.next,r.prev=i,i.next.prev=r,i.next=r):(r.prev=r,r.next=r),r}function Is(n){n.next.prev=n.prev,n.prev.next=n.next,n.prevZ&&(n.prevZ.nextZ=n.nextZ),n.nextZ&&(n.nextZ.prevZ=n.prevZ),jc&&Mb(n.prev,n.next)}function Jc(n,e,t){return{i:n,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null}}function Lb(n,e,t,i){let r=0;for(let s=e,o=t-i;s<t;s+=i)r+=(n[o]-n[s])*(n[s+1]+n[o+1]),o=s;return r}function Wd(n){let e=parseInt(n.replace("#",""),16),t=i=>(i/=255,i<=.04045?i/12.92:((i+.055)/1.055)**2.4);return[t(e>>16&255),t(e>>8&255),t(e&255)]}function qd(n,e,t,i){let r=[],s=[],o=[],a=Wd(t),l=Wd(i),c=-.6,h=.8;for(let f of n){let u=f.geometry,d=u.type==="Polygon"?[u.coordinates]:u.type==="MultiPolygon"?u.coordinates:[],g=Math.max(3,Number(f.properties.height)||9);for(let x of d){let p=[],m=[],v=x.map(y=>y.map(([w,E])=>e(w,E)));v.forEach((y,w)=>{w&&m.push(p.length/2);for(let[E,T]of y)p.push(E,T)});let M=r.length/3;for(let y=0;y<p.length;y+=2)r.push(p[y],p[y+1],g),s.push(a[0],a[1],a[2]);for(let y of wn(p,m,2))o.push(M+y);for(let y of v)for(let w=1;w<y.length;w++){let[E,T]=y[w-1],[_,A]=y[w],P=Math.hypot(_-E,A-T)||1,C=.72+.22*Math.max(0,((A-T)*c-(_-E)*h)/P);M=r.length/3,r.push(E,T,0,_,A,0,_,A,g,E,T,g);for(let I=0;I<4;I++)s.push(l[0]*C,l[1]*C,l[2]*C);o.push(M,M+1,M+2,M,M+2,M+3)}}}return{position:new Float32Array(r),color:new Float32Array(s),index:r.length/3>65535?new Uint32Array(o):new Uint16Array(o)}}var jd=`
float bayer4(vec2 p){ int x=int(mod(p.x,4.)), y=int(mod(p.y,4.)); int i=x+y*4;
  float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
  for(int k=0;k<16;k++){ if(k==i) return (m[k]+.5)/16.; } return .5; }
uniform vec2 uRider; uniform float uNearR; uniform float uNear;
float nearKeep(vec2 w){ if(uNear<=0.) return 1.; float d=distance(w,uRider); return mix(1., smoothstep(uNearR*0.8, uNearR, d), uNear); }
`,ks={uRider:{value:new Be},uNearR:{value:600},uNear:{value:0}},Ib=n=>new Ue().setStyle(n,Hi);function eu(n,e){return{uColor:{value:Ib(n)},uOpacity:{value:1},uZ:{value:e},uHalf:{value:1},...ks}}var $d=`
uniform vec3 uColor; uniform float uOpacity; varying vec2 vWorld;
${jd}
void main(){ float a=uOpacity*nearKeep(vWorld); if(a<bayer4(gl_FragCoord.xy)) discard; gl_FragColor=vec4(uColor,1.); }`;function tu(n,e){return new Ft({uniforms:eu(n,e),vertexShader:"uniform float uZ; varying vec2 vWorld; void main(){ vWorld=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position.xy,uZ,1.); }",fragmentShader:$d,transparent:!0,depthWrite:!1})}function Ns(n,e){return new Ft({uniforms:eu(n,e),vertexShader:`
      uniform float uZ; uniform float uHalf; attribute vec2 aDir; attribute vec2 aCorner; varying vec2 vWorld;
      void main(){ vec2 n=vec2(-aDir.y,aDir.x); vec2 p=position.xy+(n*aCorner.x+aDir*aCorner.y)*uHalf; vWorld=p;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,uZ,1.); }`,fragmentShader:$d,transparent:!0,depthWrite:!1})}function nu(n){let e=[],t=[];for(let r of n){let s=[],o=[];r.forEach((l,c)=>{c&&o.push(s.length/2);for(let[h,f]of l)s.push(h,f)});let a=e.length/3;for(let l=0;l<s.length;l+=2)e.push(s[l],s[l+1],0);for(let l of wn(s,o,2))t.push(a+l)}let i=new Dt;return i.setAttribute("position",new Vt(e,3)),i.setIndex(e.length/3>65535?new qi(t,1):new Wi(t,1)),i.computeBoundingSphere(),i}function iu(n){let e=0;for(let l of n)e+=Math.max(0,l.length-1);let t=new Float32Array(e*12),i=new Float32Array(e*8),r=new Float32Array(e*8),s=new Uint32Array(e*6),o=0;for(let l of n)for(let c=1;c<l.length;c++){let[h,f]=l[c-1],[u,d]=l[c],g=Math.hypot(u-h,d-f)||1,x=(u-h)/g,p=(d-f)/g,m=o*4,v=(M,y,w,E,T)=>{t.set([y,w,0],(m+M)*3),i.set([x,p],(m+M)*2),r.set([E,T],(m+M)*2)};v(0,h,f,1,-1),v(1,h,f,-1,-1),v(2,u,d,1,1),v(3,u,d,-1,1),s.set([m,m+1,m+2,m+1,m+3,m+2],o*6),o++}let a=new Dt;return a.setAttribute("position",new rt(t,3)),a.setAttribute("aDir",new rt(i,2)),a.setAttribute("aCorner",new rt(r,2)),a.setIndex(new rt(s,1)),a.computeBoundingSphere(),a}var Qc=n=>Math.log(Math.tan(Math.PI/4+n*Math.PI/360)),Xd=(n,e)=>{let t=Math.PI-2*Math.PI*n/2**e;return 180/Math.PI*Math.atan(Math.sinh(t))},Yd=(n,e)=>n/2**e*360-180;function Zd(n,e,t,i,r=16){let s=Yd(e,n),o=Yd(e+1,n),a=Xd(t,n),l=Xd(t+1,n),c=[],h=[],f=[],u=Qc(a),d=Qc(l);for(let x=0;x<=r;x++){let p=x/r,m=(2*Math.atan(Math.exp(u+(d-u)*p))-Math.PI/2)*180/Math.PI;for(let[v,M]of[[0,s],[1,o]]){let[y,w]=i(M,m);c.push(y,w,0),h.push(v,1-p)}if(x){let v=(x-1)*2;f.push(v,v+2,v+1,v+1,v+2,v+3)}}let g=new Dt;return g.setAttribute("position",new Vt(c,3)),g.setAttribute("uv",new Vt(h,2)),g.setIndex(f),g}function Kd(n,e,t){return new Ft({uniforms:{map:{value:n},...eu(e,t)},vertexShader:"uniform float uZ; varying vec2 vUv; varying vec2 vWorld; void main(){ vUv=uv; vWorld=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position.xy,uZ,1.); }",fragmentShader:`uniform sampler2D map; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; varying vec2 vWorld; ${jd}
      void main(){ vec4 t=texture2D(map,vUv); float a=t.a*uOpacity*nearKeep(vWorld); if(a<0.01) discard; gl_FragColor=vec4(uColor*0.9,a); }`,transparent:!0,depthWrite:!1})}function ru(n){let e=new Dt;return e.setAttribute("position",new rt(n.position,3)),e.setAttribute("color",new rt(n.color,3)),e.setIndex(new rt(n.index,1)),e.computeBoundingSphere(),e}function Jd(n,e,t,i){return ru(qd(n,e,t,i))}function Qd(n){let[e,t]=Ti(n[0],n[1]),[i,r]=Ti(n[2],n[3]),s=l=>Math.floor((l+180)/360*2**14),o=l=>Math.floor((1-Qc(l)/Math.PI)/2*2**14),a=[];for(let l=s(e);l<=s(i);l++)for(let c=o(r);c<=o(t);c++)a.push(`${l}/${c}`);return a}function Ir(n,e){if(e<=n[0][0])return n[0][1];for(let t=1;t<n.length;t++){let[i,r]=n[t];if(e<=i){let[s,o]=n[t-1],a=(e-s)/(i-s);return o>0&&r>0?o*(r/o)**a:o+(r-o)*a}}return n[n.length-1][1]}var hn={land:"#f4f0e8",water:"#a3c6e3",park:"#d2e6b5",building:"#d9d0c6",buildingOutline:"#c4b8ab",route:"#38BDF8",routeCasing:"rgba(3,18,28,0.75)"},Wn={major:{fill:"#fcd68f",casing:"#d9a861",width:[[9,.6],[11,1.1],[12,1.6],[14,4.5],[16,11],[18,30],[20,100]],casingExtra:2,order:6},secondary:{fill:"#fdeaae",casing:"#d8c17d",width:[[10,.4],[12,1.1],[14,3.5],[16,9],[18,24],[20,80]],casingExtra:2,order:5},tertiary:{fill:"#ffffff",casing:"#cfc5b6",width:[[11,.4],[13,1.2],[14,2.6],[16,7],[18,20],[20,66]],casingExtra:1.6,order:4},minor:{fill:"#ffffff",casing:"#d6cec2",width:[[12,.25],[14,1.3],[16,4.5],[18,15],[20,50]],casingExtra:1.4,order:3},service:{fill:"#ffffff",casing:"#ddd6cb",width:[[13,.2],[15,.9],[16,2.2],[18,8],[20,26]],casingExtra:1.2,order:2},cycle:{fill:"#e7a59b",casing:null,width:[[13,.25],[15,.8],[16,1.4],[18,4],[20,12]],casingExtra:0,order:1},path:{fill:"#c8bba9",casing:null,width:[[14,.3],[16,1],[18,3],[20,9]],casingExtra:0,order:0}},ef=.35,tf=[[10,3],[13,4],[16,6],[18,9],[20,18]],nf=[13.4,14.1],rf=13.5,sf=[16,16.8],su=(n,[e,t])=>Math.max(0,Math.min(1,(n-e)/(t-e)));var ou=class{constructor(e=48){this.cell=e}cells=new Map;keys(e){let t=[];for(let i=Math.floor(e[0]/this.cell);i<=Math.floor(e[2]/this.cell);i++)for(let r=Math.floor(e[1]/this.cell);r<=Math.floor(e[3]/this.cell);r++)t.push(i*65536+r);return t}hits(e){for(let t of this.keys(e))for(let i of this.cells.get(t)??[])if(e[0]<i[2]&&e[2]>i[0]&&e[1]<i[3]&&e[3]>i[1])return!0;return!1}insert(e){for(let t of this.keys(e)){let i=this.cells.get(t);i?i.push(e):this.cells.set(t,[e])}}},of=(n,e,t)=>n[0]>=0&&n[1]>=0&&n[2]<=e&&n[3]<=t;function kb(n,e,t,i,r){let s=i.reduce((c,h)=>c+h,0),o=t-s/2;if(o<0||t+s/2>e[e.length-1])return null;let a=[],l=0;for(let c=0;c<r.length;c++){let h=o+i[c]/2;for(;l<e.length-2&&e[l+1]<h;)l++;let f=n[l],u=n[l+1],d=e[l+1]-e[l]||1,g=(h-e[l])/d;a.push({ch:r[c],x:f.x+(u.x-f.x)*g,y:f.y+(u.y-f.y)*g,angle:Math.atan2(u.y-f.y,u.x-f.x)}),o+=i[c]}return a}function af(n,e){let{width:t,height:i,zoom:r}=e,s=e.padding??2,o=e.repeatDistance??280,a=(e.maxGlyphTurn??35)*Math.PI/180,l=new ou,c=new Map,h=[],f=n.filter(x=>(x.minZoom??0)<=r&&r<(x.maxZoom??99)).slice().sort((x,p)=>p.priority-x.priority||(x.id<p.id?-1:1)),u=(x,p,m)=>(c.get(x)??[]).some(v=>Math.hypot(v.x-p,v.y-m)<o),d=(x,p,m)=>{let v=c.get(x);v?v.push({x:p,y:m}):c.set(x,[{x:p,y:m}])},g=x=>{let p=[...x.text],m=p.map(v=>e.advance(v,x.kind));return{chars:p,advances:m,textW:m.reduce((v,M)=>v+M,0)}};for(let x of f){let p=e.fontSize(x.kind,r);if(x.at){let M=e.project(x.at);if(M.depth<=0||e.maxDepth&&M.depth>e.maxDepth||M.x<-50||M.x>t+50||M.y<0||M.y>i||u(x.text,M.x,M.y))continue;let{textW:y}=g(x),w=[M.x-y/2-s,M.y-p/2-s,M.x+y/2+s,M.y+p/2+s];if(!of(w,t,i)||l.hits(w))continue;l.insert(w),d(x.text,M.x,M.y),h.push({id:x.id,text:x.text,kind:x.kind,size:p,x:M.x,y:M.y});continue}if(!x.path||x.path.length<2)continue;let m=[[]];for(let M of x.path){let y=e.project(M);y.depth>0&&(!e.maxDepth||y.depth<e.maxDepth)?m[m.length-1].push({x:y.x,y:y.y}):m[m.length-1].length&&m.push([])}let v=null;for(let M of m){if(M.length<2)continue;let y=1/0,w=1/0,E=-1/0,T=-1/0;for(let k of M)y=Math.min(y,k.x),E=Math.max(E,k.x),w=Math.min(w,k.y),T=Math.max(T,k.y);if(E<0||T<0||y>t||w>i||Math.hypot(E-y,T-w)<x.text.length*p*.45)continue;v??=g(x);let{chars:_,advances:A,textW:P}=v,C=M[M.length-1].x<M[0].x?M.slice().reverse():M,I=[0];for(let k=1;k<C.length;k++)I.push(I[k-1]+Math.hypot(C[k].x-C[k-1].x,C[k].y-C[k-1].y));let L=I[I.length-1];if(L<P*1.15)continue;let H=[L/2];for(let k=P;k<L/2;k+=P)H.push(L/2-k,L/2+k);for(let k of H){let O=kb(C,I,k,A,_);if(!O)continue;let W=!1;for(let j=1;j<O.length&&!W;j++){let te=O[j].angle-O[j-1].angle;te=Math.atan2(Math.sin(te),Math.cos(te)),Math.abs(te)>a&&(W=!0)}if(W||O.some(j=>Math.cos(j.angle)<-.2))continue;let J=O.map(j=>[j.x-p*.55-s,j.y-p*.55-s,j.x+p*.55+s,j.y+p*.55+s]),Q=O[O.length>>1];if(!(J.some(j=>!of(j,t,i)||l.hits(j))||u(x.text,Q.x,Q.y))){for(let j of J)l.insert(j);d(x.text,Q.x,Q.y),h.push({id:x.id,text:x.text,kind:x.kind,size:p,glyphs:O});break}}}}return h}function lf(n,e,t){n.textAlign="center",n.textBaseline="middle",n.lineJoin="round";for(let i of e){let r=t[i.kind];if(n.font=r.font(i.size),n.strokeStyle=r.halo,n.lineWidth=r.haloWidth*2,n.fillStyle=r.fill,i.glyphs)for(let s of[0,1])for(let o of i.glyphs)n.save(),n.translate(o.x,o.y),n.rotate(o.angle),s===0?n.strokeText(o.ch,0,0):n.fillText(o.ch,0,0),n.restore();else n.strokeText(i.text,i.x,i.y),n.fillText(i.text,i.x,i.y)}}var cf={culture:"#8e5bb5",worship:"#8a7560",education:"#4a7bb7",health:"#c4504a",civic:"#5b6b7a",lodging:"#3b8f8a",shop:"#c08a2c",bike:"#d46b2c",leisure:"#4f9a52",market:"#b3702f",food:"#c2553b",art:"#a0527d"};var Db=70;function uf(n,e){if(!n||!Array.isArray(n.pois))return{type:"FeatureCollection",features:[]};let t=n.pois.filter(r=>r[0]&&!e(r[0])).map((r,s)=>({id:String(s).padStart(6,"0"),name:r[0],kind:"own",center:[r[2],r[1]],orientationScore:r[4],category:n.categories[r[3]],band:n.bands[r[5]]??"ground"}));return{type:"FeatureCollection",features:hf(t,{kinds:["own"],cellMetres:Db}).filter(r=>r.category).map(r=>({type:"Feature",properties:{name:r.name,category:r.category,colour:cf[r.category]??"#5b6b7a",rank:r.orientationScore??0,band:r.band},geometry:{type:"Point",coordinates:[r.center[1],r.center[0]]}}))}}var lu={wallPull:.7,glassLift:.5,liftBrick:!0},df={wallPull:.35,glassLift:.25,liftBrick:!1},Qw={photo:{cells:"photo",shadeBands:0,flatColour:!1,...lu,cartoonRoofCells:!1,outline:!1,litWallGain:255/225},procedural:{cells:"procedural",shadeBands:0,flatColour:!1,...lu,cartoonRoofCells:!1,outline:!1,litWallGain:1},untextured:{cells:"procedural",shadeBands:0,flatColour:!0,...lu,cartoonRoofCells:!1,outline:!1,litWallGain:1},storybook:{cells:"storybook",shadeBands:0,flatColour:!1,...df,cartoonRoofCells:!1,outline:!0,litWallGain:1,tone:{hueShift:-4,satMul:1.15,satAdd:0,keepDarkBelow:0,lightMul:1,lightAdd:.03,lightMax:.9}},cartoon:{cells:"cartoon",shadeBands:3,flatColour:!1,...df,cartoonRoofCells:!0,outline:!0,litWallGain:1,tone:{hueShift:0,satMul:1.7,satAdd:.08,keepDarkBelow:.35,lightMul:1.08,lightAdd:0,lightMax:.85}}};var cu=["#76808f","#606b79","#8c939c"],Ds={procedural:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:cu},untextured:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:cu},photo:{tile:["#b5543a","#a8482f","#c0603f","#9c4a35"],slate:cu},storybook:{tile:["#b9553a","#a94a33","#c46a45"],slate:["#556070","#4a5666","#657282"]},cartoon:{tile:["#e85a3c","#f08a2b","#d94a3a"],slate:["#3f5f8f","#2f4a78","#4f7bb0"]}};var $a={gravel:{hex:"#9e9281",luma:[112,156],cell:"flat"},"bitumen-dark":{hex:"#56585e",luma:[62,96],cell:"flat"},"bitumen-light":{hex:"#a99b84",luma:[150,182],cell:"flat"},"white-membrane":{hex:"#d9d9d3",luma:[196,228],cell:"flat"},"pantile-red":{hex:"#b5543a",luma:[84,124],cell:"tile"},"pantile-dark":{hex:"#6a5248",luma:[64,98],cell:"tile"},slate:{hex:"#76808f",luma:[62,140],cell:"slate"},zinc:{hex:"#9aa1a6",luma:[138,176],cell:"slate"},sedum:{hex:"#7a8350",luma:[96,132],cell:"flat"},solar:{hex:"#2e3a52",luma:[44,70],cell:"flat"},terrace:{hex:"#a38d74",luma:[124,162],cell:"flat"},glass:{hex:"#8fa3ad",luma:[130,170],cell:"flat"}},Za={gravel:$a.gravel.hex,membrane:$a["white-membrane"].hex,bitumen:$a["bitumen-dark"].hex,pebble:$a["bitumen-light"].hex},pf=[Za.gravel,Za.membrane,Za.bitumen,Za.pebble],e1={tile:Ds.photo.tile,slate:Ds.photo.slate,flat:pf};var Ka={photo:{canal:["#7a3b2c","#7a3b2c","#6b3428","#8c4632","#9a5846","#b05a40","#4a2e26","#2e2a27","#3e4a40","#5d605a","#e4ddcd"],c19:["#b05a40","#b05a40","#bd6a45","#a24d38","#c58b5e","#d3b184","#e2d5ba","#e2d5ba","#d9c5a4","#9a5846"],school:["#8c4a38","#7a4535","#9a5240","#6e3d33","#a85a3c","#5e3a32","#b0603f"],modern:["#c9b79a","#b9ad9a","#a8a49c","#d3c6ad","#8f8a82","#bfb3a0","#9c7a62","#b05a40"]},storybook:{canal:["#b9583f","#9a4a38","#7a4a3c","#4a5048","#3f4a5a","#ead9b0","#c8664a"],c19:["#c8664a","#d98b5f","#e0b36a","#ead9b0","#d9b995","#c9a08c","#c8664a"],school:["#a8553f","#9a5a48","#b87a5c","#c8664a","#8a4e40"],modern:null},cartoon:{canal:["#d9453d","#a8433a","#3b3b4a","#2a9d8f","#4672b0","#fffaf0","#e8573d"],c19:["#e8573d","#ee7f2c","#f2b92e","#f3e6c8","#d96a4d","#f2b92e"],school:["#d96a4d","#e8573d","#b9583f","#ee7f2c"],modern:null}};var t1={canal:{label:"canal-house centre (before 1860)",wall:Ka.photo.canal[0],roof:Ds.photo.tile[0]},c19:{label:"19th-century ring (1860-1914)",wall:Ka.photo.c19[0],roof:Ds.photo.tile[1]},school:{label:"Amsterdamse School (1915-1944)",wall:Ka.photo.school[0],roof:Ds.photo.slate[0]},modern:{label:"post-war and contemporary (1945+)",wall:Ka.photo.modern[0],roof:pf[0]}};var n1=225/255;var ff=32,uu=64,Ri=[157.19,92.83,69.17],mf=240.95,gf=.16,Ub=255/(Ri[0]+(mf-Ri[0])*gf);function Ob(n,e){let t=e/(uu-1),i=t<.5?Ri[0]+(Ri[1]-Ri[0])*(t/.5):Ri[1]+(Ri[2]-Ri[1])*((t-.5)/.5),r=5-15*e/35,s=17-15*e/35,o=e<35&&n+.5>=r&&n+.5<s;return Math.min(255,Math.round((o?i+(mf-i)*gf:i)*Ub))}var i1=(()=>{let n=0;for(let e=0;e<uu;e++)for(let t=0;t<ff;t++)n+=Ob(t,e);return n/(ff*uu)})();var r1=228/255;var yf="#ff8033";var En={enamel:"#0b3a8c",enamelBright:"#1450b8",enamelDeep:"#072861",night:"#071430",ink:"#ffffff",inkMuted:"rgba(255,255,255,0.72)",inkDim:"rgba(255,255,255,0.86)",line:"rgba(255,255,255,0.28)",rivet:"#c4a35a",rivetDeep:"#8a7040",copper:"#b87333",copperHi:"#d9a05b",copperDeep:"#8a5524",copperMid:"#c9844a",fontPlaque:'"Barlow Condensed", "Arial Narrow", "Helvetica Neue Condensed", sans-serif'},Ja={paper:"#f4efe5",paperRaised:"#fbf8f2",paperSunk:"#ebe4d6",ink:"#1f1c17",inkMuted:"#5f584d",line:"rgba(31,28,23,0.14)",lineStrong:"rgba(31,28,23,0.26)",fill:"rgba(31,28,23,0.045)",fillHover:"rgba(31,28,23,0.085)",accent:"#b4682c",accentInk:"#8a4a18",accentSoft:"rgba(180,104,44,0.13)",scrim:"rgba(28,24,18,0.38)",danger:"#a8321f"},a1={paper:En.enamel,paperRaised:En.enamelBright,paperMuted:En.enamelDeep,ink:En.ink,inkMuted:En.inkMuted,line:En.line,moss:En.enamelBright,mossDark:En.enamelDeep,mossSoft:"rgba(20,80,184,0.28)",terracotta:En.copper,ochre:En.rivet},xf={card:"rgba(251,248,242,0.9)",cardSolid:"rgba(251,248,242,0.97)",border:"rgba(31,28,23,0.14)",borderStrong:"rgba(180,104,44,0.6)",shadow:"rgba(31,28,23,0.22)",control:"rgba(251,248,242,0.72)",controlPressed:Ja.accent,controlInk:"rgba(31,28,23,0.62)",controlKnob:"rgba(31,28,23,0.2)",ink:Ja.ink,inkMuted:Ja.inkMuted,accent:Ja.accentInk,arrow:yf,fontPlaque:En.fontPlaque,fontMono:'"JetBrains Mono", Menlo, Consolas, monospace',fontUi:'system-ui, -apple-system, "Segoe UI", sans-serif'};var Bb=`700 12px ${xf.fontUi}`;var zb=260,bf=111320;function hf(n,e={}){let t=new Set(e.kinds??["local-food"]),i=e.cellMetres??zb;if(!(i>0))return n.slice();let r=[],s=[];for(let c of n)c&&t.has(c.kind)&&Array.isArray(c.center)?s.push(c):c&&r.push(c);if(!s.length)return r;let o=s.reduce((c,h)=>c+h.center[0],0)/s.length,a=bf*Math.cos(o*Math.PI/180),l=new Map;for(let c of s){let h=Math.floor(c.center[0]*bf/i),f=Math.floor(c.center[1]*a/i),u=`${h},${f}`,d=l.get(u);if(!d){l.set(u,c);continue}let g=d.orientationScore??0,x=c.orientationScore??0;(x>g||x===g&&c.id<d.id)&&l.set(u,c)}return r.concat([...l.values()])}var Qa=5,Vb=5,Gb=["dwarsstraat","burgwal","gracht","straat","kanaal","sloot","steeg","plein","kade","brug","laan","dijk","weg","pad","hof"];function kr(n){return n.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}function Fs(n){let e=new Set,t=new Set,i=new Set;for(let r of n){if(!r)continue;let s=kr(r);if(s.length>=Qa&&t.add(r.trim().toLowerCase()),!(s.length<Qa)){e.add(s),i.add(s);for(let o of Gb){if(!s.endsWith(o))continue;let a=s.slice(0,-o.length).trim();a.length>=Qa&&e.add(a);break}}}return{names:e,lowerRaw:t,full:i}}function hu(n,e){if(!n||!e||e.names.size===0)return!1;let t=kr(n).split(" ").filter(Boolean);for(let i=1;i<=Math.min(Vb,t.length);i++)for(let r=0;r+i<=t.length;r++)if(e.names.has(t.slice(r,r+i).join(" ")))return!0;if(e.full&&e.full.size){for(let i of t)for(let r=Qa;r<i.length;r++)if(e.full.has(i.slice(0,r)))return!0}return!1}var du={"language.label":"Language","language.en":"English","language.nl":"Nederlands","language.enShort":"EN","language.nlShort":"NL","language.switchedTo":"Language: {language}","common.more":"More","common.done":"Done","common.off":"Off","common.back":"Back","setup.city":"City","setup.travel":"Travel","setup.travel.boat":"Boat","setup.travel.bike":"Bike","setup.travel.transit":"Transit","setup.view":"View","setup.view.north":"North up","setup.view.northHint":"Flat map, north at top","setup.view.heading":"Heading up","setup.view.headingHint":"Flat map, turns with you","setup.view.chase":"Chase","setup.view.chaseHint":"Low 3D, behind the vehicle","setup.view.cockpit":"Cockpit","setup.view.cockpitHint":"Low 3D, over the bumper","setup.look":"Building look","setup.look.photo":"Photo","setup.look.photoHint":"Brick and sash windows","setup.look.procedural":"Painted","setup.look.proceduralHint":"Fitted windows and doors","setup.look.storybook":"Storybook","setup.look.storybookHint":"Softly painted, natural colours","setup.look.cartoon":"Cartoon","setup.look.cartoonHint":"Flat, bold, cel-shaded","setup.look.untextured":"Untextured","setup.look.untexturedHint":"Plain colours, lightest on the phone","setup.route":"Route","setup.route.surprise":"Surprise","setup.route.surpriseHint":"Landmark to landmark","setup.route.home":"Home","setup.route.homeHint":"Nearby first, expands as you learn","setup.route.here":"Here","setup.route.hereHint":"Start from where you are now","setup.route.free":"Free ride","setup.route.freeHint":"No route, no questions: ride anywhere and tap what you pass","freeRide.badge":"Free ride","freeRide.exit":"Exit","freeRide.exitLabel":"Leave free ride and go back to setup","freeRide.tallyNone":"Tap a marker or a building","freeRide.tallyOne":"1 place opened","freeRide.tallyMany":"{count} places opened","setup.difficulty":"Difficulty","setup.difficulty.easy":"Easy","setup.difficulty.medium":"Medium","setup.difficulty.hard":"Hard","setup.difficulty.expert":"Expert","setup.difficulty.custom":"Custom","setup.difficulty.harder":"Harder difficulties","setup.difficulty.harderGloss":"Expert hides assists. Custom appears when you tweak assists below.","setup.difficulty.customGloss":"Your own mix of help, set under More options.","setup.difficulty.chooseName":"Pick the name from a list.","setup.difficulty.typeName":"Type each name.","setup.difficulty.assistsOff":"No {assists}.","setup.difficulty.assistsOffList":"{list} or {last}","setup.difficulty.lineOn":"Route line shown.","setup.assist.routeLine":"route line","setup.assist.arrow":"arrow","setup.assist.minimap":"minimap","setup.destination":"Destination","setup.destination.surprise":"Surprise me","setup.destination.tourStops":"Tour stops","setup.tours":"Tours","setup.tours.none":"No tour","setup.tours.stops":"{count} stops by bike, one leg at a time","setup.tours.checked":" \xB7 {checked}, shops change","setup.tours.brief":"Ride the {tour} tour stop by stop. Each arrival tells you why it is on the list.","setup.homeAddress":"Home address","setup.homeAddress.placeholder":"Street and number, {city}","setup.homeAddress.saved":"Saved \xB7 starts nearby, expands as you learn \xB7 boats use nearby water","setup.homeAddress.learning":"Learning near home \xB7 ~{km} km \xB7 expands as you learn","setup.liveLocation":"Live location","setup.liveLocation.note":"Starts from where you are now \u2014 not a saved home address. Allow location when asked.","setup.moreOptions":"More options","setup.review":"Review","setup.review.dueOnly":"Due names only","setup.review.dueOnlyHint":"Ask only names due for review","setup.review.measuredColours":"Reviewed colours","setup.review.measuredColoursHint":"Only buildings with checked wall colours","setup.review.measuredColoursHidden":"Buildings without reviewed wall colours are hidden. Coverage may be empty.","setup.savedData":"Your saved data","setup.resetKnowledge":"Reset knowledge\u2026","setup.clearAll":"Clear all data\u2026","setup.startRoute":"Start route","setup.startFreeRide":"Start free ride","setup.startTour":"Start tour","setup.scrollMoreOptions":"Scroll for more options","options.tilt":"3D tilt","options.spin":"3D spin","options.zoom":"Zoom","options.controls":"Controls","options.controls.follow":"Follow","options.controls.followHint":"Rides along the street; choose each turn","options.controls.steer":"Steer","options.controls.steerHint":"Left and right turn the vehicle","options.controls.point":"Point","options.controls.pointHint":"Push the way you want to go","options.answers":"Answers","options.answers.choose":"Choose","options.answers.chooseHint":"Pick from a few names","options.answers.type":"Type","options.answers.typeHint":"Spell the name yourself","options.asksPerMinute":"Questions a minute","options.asksPerMinuteGloss":"Route questions asked per minute while you ride. Off still shows each street name after you pass it.","options.onTheMap":"On the map","options.routeLine":"Route line","options.arrow":"Arrow","options.arrowHint":"Points at the destination","options.minimap":"Minimap","options.scores":"Scores","options.scoresHint":"Points, streaks and ribbons","options.comfort":"Comfort & detail","options.lessMotion":"Less motion","options.trees":"Trees","settings.title":"Ride settings","settings.progress":"My progress","settings.knowledge":"Your knowledge","settings.routeSetup":"Route setup","settings.scrollMore":"Scroll for more settings","settings.signedInAs":"Signed in as {name}","knowledge.title":"Your city knowledge","knowledge.subtitle":"What is sticking, what is fading, and what to ride next.","knowledge.plan":"Plan review \xB7 {count} due","knowledge.nothingDue":"Nothing due now","knowledge.emptyTitle":"Your map starts with one answer","knowledge.emptyBody":"Complete a route and recall a street, canal, bridge, stop, or line. It will appear here with its next review time.","knowledge.firstRoute":"Choose a first route","knowledge.summary":"Knowledge summary","knowledge.dueNow":"due now","knowledge.dueNowBody":"These names have reached their review window.","knowledge.caughtUp":"You are caught up. New reviews will appear here.","knowledge.tracked":"Names tracked","knowledge.mastered":"Mastered","knowledge.recallRate":"Recall rate","knowledge.reviewsLogged":"Reviews logged","knowledge.mapKey":"Map key","knowledge.status.due":"Due for review","knowledge.status.learning":"Learning","knowledge.status.known":"Known","knowledge.status.mastered":"Mastered","knowledge.queue":"Review queue","knowledge.search":"Search knowledge","knowledge.searchPlaceholder":"Search names or cities","knowledge.statusLabel":"Knowledge status","knowledge.filter.due":"Due","knowledge.filter.learning":"Learning","knowledge.filter.known":"Known","knowledge.filter.mastered":"Mastered","knowledge.filter.all":"All","knowledge.queued":"Queued","knowledge.practiceAgain":"Practice again","knowledge.noNames":"No names here","knowledge.noNamesSearch":"Try another search or status.","knowledge.noNamesBody":"Your answers will move names into this group.","knowledge.activity":"Past 7 days","knowledge.activityLabel":"Reviews in the past seven days","knowledge.byCity":"By city","knowledge.explainer":"Mastery rises across successful reviews. A name turns copper when its spaced-review interval expires.","knowledge.backToSetup":"Route setup","knowledge.backToRide":"Back to ride","knowledge.count.one":"{count} name in this view","knowledge.count.other":"{count} names in this view","knowledge.masteryPercent":"{percent} percent mastery","knowledge.successful":"{count} successful","knowledge.lapse.one":"{count} lapse","knowledge.lapse.other":"{count} lapses","knowledge.forget":"Forget","knowledge.places.one":"{count} place","knowledge.places.other":"{count} places","knowledge.reviews.one":"{count} review","knowledge.reviews.other":"{count} reviews","knowledge.weekTotal.one":"{count} review this week","knowledge.weekTotal.other":"{count} reviews this week","knowledge.cityTracked":"{count} tracked","knowledge.cityDue":"{due} due \xB7 {mastered} mastered","knowledge.unit.min":"min","knowledge.unit.hour":"hr","knowledge.unit.day":"day","knowledge.overdue":"{amount} {unit} overdue","knowledge.inFuture":"in {amount} {unit}","hud.tally":"{correct} / {attempts} named","hud.tallyCompact":"{correct}/{attempts} named","hud.points":"{points} pts","hud.zoom":"Zoom {percent}%","hud.streak":"{streak} streak \xB7 {mult}\xD7","hud.streakCompact":"{streak}\xD7streak","hud.toDestination":"to {name}","hud.lap":"LAP {current} / {total}","hud.complete":"{percent}% COMPLETE","hud.ordinal.one":"{position}st","hud.ordinal.two":"{position}nd","hud.ordinal.three":"{position}rd","hud.ordinal.other":"{position}th","hud.recall":"RECALL","hud.street":"STREET","card.noIdea":"No idea","card.submit":"Check","card.correct":"Correct","card.wrong":"Not quite","card.answerWas":"It was {name}","card.continue":"Continue","ride.question.waterway":"Which waterway are you on now?","ride.question.street":"Which street are you on now?","ride.question.line":"Which line are you on now?","ride.question.bridge":"Which bridge are you on?","ride.context.bridge":"Crossing a waterway","ride.context.transit":"Riding the corridor","ride.context.start":"Where you set off","ride.context.turn":"You made a turn","ride.context.nameChanged":"The street name changed","ride.noun.canals":"Canals","ride.noun.streets":"Streets","ride.noun.lines":"Lines","ride.noun.linesAndStops":"lines and stops","ride.network.waterways":"waterways","ride.network.waterway":"waterway","ride.network.streets":"streets","ride.network.street":"street","ride.network.tramLines":"tram lines","ride.network.line":"line","ride.load.city":"Loading {city} {network}\u2026","ride.load.noNamed":"No named {noun} found here.","ride.load.buildingNetwork":"Building the {noun} network\u2026","ride.load.preparingMap":"Preparing the vector map\u2026","ride.load.choosingStart":"Choosing a starting {noun}\u2026","ride.load.renderingStreets":"Rendering streets\u2026","ride.load.renderingTrams":"Rendering tram lines\u2026","ride.load.renderingWaterways":"Rendering waterways\u2026","ride.load.settling":"Settling the map\u2026","ride.load.ready":"Ready!","ride.load.findingWay":"Finding your way\u2026","ride.error.noStartPoint":"No reachable starting point is available for this destination.","ride.error.transitAnchors":"Transit stop anchors failed to load for {city}.","ride.error.notEnoughLandmarks":"Not enough landmarks loaded for {city}.","ride.error.tourUnavailable":"That tour is unavailable. Pick another below.","ride.error.tourUnavailableShort":"That tour is unavailable.","ride.error.snapFailed":"Could not snap your location to a mapped street or waterway. Move closer to the network, or try Surprise.","ride.error.addressTooFar":"That address is too far from a connected mapped waterway. Try a nearby bridge or canal-side address.","ride.error.startFinishClose":"Start and finish are too close. Try different points.","ride.error.routeNotFound":"Route not found between start and finish \u2014 the route line will not display","ride.error.exactAddress":"Could not find that exact {city} address","ride.error.unreachableDestination":"Could not reach {destination} on the mapped {network}. Try another travel mode or destination.","ride.error.addressSearch":"Address search is unavailable right now","ride.error.areaTooSmall":"Area too small. Try a different area.","ride.error.network":"Could not build the canal network.","ride.error.addressNotFound":"Could not find that address.","ride.error.placeRoute":"Could not place start/finish. Try different points.","ride.error.planRoute":"Could not plan a ride from your location. Try Surprise or Home.","ride.error.location":"Could not read your location.","ride.error.homeAddress":"Enter a home address first.","ride.error.waterways":"Failed to load waterways","ride.status.findingYou":"Finding where you are\u2026","ride.status.findingHome":"Finding your home base\u2026","ride.holdSteer":"hold here to drive \u2014 slide to steer, pull back to brake","ride.holdPoint":"hold here and point where you want to go","help.keyboard":"Keyboard","help.rideSection":"Ride","help.answerSection":"Answer","help.viewSection":"View","help.arrows":"Steer and accelerate / brake","help.space":"Handbrake","help.pause":"Pause","help.routeSetup":"Route setup","help.settings":"Settings","help.sound":"Sound","help.multipleChoice":"Multiple-choice answer","help.noIdeaTellMe":"No idea \u2014 tell me","help.wikipediaLandmark":"Wikipedia for the on-screen landmark","help.fullArticle":"Full landmark article","help.minimap":"Minimap","help.routeLine":"Route line","help.destinationArrow":"Destination arrow","help.northUpToggle":"North-up / heading-up","help.zoom":"Zoom (or pinch)","help.panCamera":"Pan camera","help.recenter":"Recenter","help.tilt3d":"3D tilt (Chase view)","help.spin3d":"Spin 3D camera around vehicle","help.spinTrackpad":"Spin 3D camera (trackpad twist in Safari)","help.developerKeys":"Developer keys","help.roadNames":"Road name labels","help.buildingLook":"Building look","help.panCameraKeys":"Pan camera","help.debugOverlay":"Debug overlay","help.close":"Close","prompt.label.street":"Street","prompt.label.waterway":"Waterway","prompt.label.water":"Water","prompt.label.bridge":"Bridge","prompt.label.line":"Line","prompt.label.stop":"Stop","prompt.placeholder.street":"Street name","prompt.placeholder.waterway":"Waterway name","prompt.placeholder.water":"Canal or river name","prompt.placeholder.bridge":"Bridge name","prompt.placeholder.line":"Line name","prompt.placeholder.stop":"Stop name","prompt.waterway":"Waterway","prompt.turn":"You made a turn","prompt.submit":"Submit answer","prompt.noIdea":"No idea \u2014 tell me","prompt.ridingOn":"Riding on","utility.settings":"Settings","utility.help":"How to play","landmark.readArticle":"Read the full article on Wikipedia","help.title":"How to play","help.replayIntro":"Show the 3-step intro","help.rideTitle":"Ride","help.rideTouch":"Hold the ring at the bottom of the screen and slide. Sideways steers, up goes faster, back brakes. In compass mode, point where you want to go.","help.ridePointer":"Arrow keys or WASD steer. In compass mode they point the way instead: \u2192 rides east on a north-up map.","help.nameTitle":"Name it","help.nameBody":"Turn onto a new canal or street and the ride stops to ask its name. Pick it, type it, or choose No idea \u2014 either way the answer is shown, and the right one lights up on the map. Nothing on screen names it before you answer.","help.rememberTitle":"Remember it","help.rememberBody":"Names you get right come back later, just before you would forget them (spaced review). Knowledge on the setup screen shows what is due. \u201C% new\u201D on the destination card is how much of the route you have not ridden before.","mission.destination":"your destination","mission.city":"the city","mission.home":"home","mission.boat.1":"Find your way to {destination} by water","mission.boat.2":"Canal hop to {destination}","mission.boat.3":"Drift toward {destination} \u2014 name what you ride","mission.bike.1":"Ride toward {destination}","mission.bike.2":"Pedal to {destination} \u2014 learn the turns","mission.bike.3":"Learn the way to {destination}","mission.transit.1":"Ride the line toward {destination}","mission.transit.2":"One hop to {destination} \u2014 own the corridor","mission.transit.3":"Transfer-ready: get to {destination}","mission.home.1":"Learn the streets within ~{km} km of home","mission.home.2":"Rides from home reach further as you learn","mission.home.3":"Errand mode: leave knowing the way back","mission.here.1":"From here toward {destination}","mission.here.2":"Start from where you are","mission.here.3":"Start from where you are \u2014 not a saved address","mission.reviewOne":"Review ride: 1 overdue name on the way","mission.reviewMany":"Review ride: {count} overdue names on the way","mission.reviewFirstMinute":"A review waits in the first minute","mission.warmUp":"Warm up with one overdue name","mission.arrive":"Arrive knowing more of {city}","quiz.pinpoint":"Pinpoint","quiz.pinpointHint":"Place the named feature on the map","quiz.guessName":"Guess Name","quiz.guessNameHint":"Name the feature highlighted on the map","quiz.highlighted":"Highlighted on the map","quiz.which":"Which {kind} is this?","quiz.inContext":"In {context}","quiz.noIdeaReveal":"No idea \u2014 reveal the answer","quiz.skipped":"Skipped","quiz.correct":"Correct","quiz.notQuite":"Not quite","quiz.answerWas":"It is {name}","quiz.pts":"PTS","quiz.points":"pts","quiz.seeScore":"See score","quiz.next":"Next","quiz.nextNearby":"Next \xB7 nearby","quiz.hint":"Hint","quiz.hintWithCeiling":"Hint \xB7 up to {points}","quiz.hideHint":"Hide hint","quiz.showHint":"Show hint","quiz.pinPlaced":"Pin placed","quiz.tapToPlace":"Tap the map to place a pin","quiz.tapToMove":"Tap again to move it","quiz.anywhere":"Anywhere you think it is","quiz.confirmPin":"Confirm pin location","quiz.placeFirst":"Place a pin on the map first","quiz.confirm":"Confirm","quiz.placePinFirst":"Place a pin first","quiz.distanceLine":"Dashed line shows distance on map","quiz.sessionComplete":"Session complete","quiz.accuracy":"Accuracy","quiz.finalScore":"Final Score","quiz.missed":"Missed","quiz.overall":"Overall","quiz.playAgain":"Play Again","quiz.reviewOnMap":"Review on map","quiz.showResults":"Show Results Summary","quiz.mapReview":"Map Review: Explore your pins & correct street lines","quiz.greetingsFrom":"Greetings from","quiz.nameLabel":"Name:","quiz.nothingDue":"Nothing due \xB7 0 known yet \u2014 start with canals","quiz.dailyFive":"Daily five","quiz.twoPlaces":"Two places","quiz.bothHighlighted":"Both highlighted","quiz.bonus":"Bonus","quiz.skip":"Skip","quiz.tapMap":"Tap the map","quiz.loadingOsm":"OpenStreetMap data","quiz.cancelAnytime":"You can cancel at any time","quiz.cancelLoading":"Cancel Loading","quiz.startWith":"Start with","quiz.also":"Also","quiz.mode":"Mode","quiz.startNearHome":"Start near home","quiz.started":"Quiz started","quiz.couldNotLoad":"Couldn\u2019t load map features","quiz.loadingLocation":"Finding location\u2026","quiz.loadingBoundaries":"Discovering local boundaries\u2026","quiz.geolocation":"Requesting device geolocation...","quiz.geolocationCoords":"Pinpointing coordinates...","quiz.reverseGeocode":"Reverse geocoding local district...","quiz.couldNotLoadFeatures":"Could not load OpenStreetMap features.","quiz.couldNotLoadLocation":"Could not load this location","quiz.couldNotFindLocation":"Could not find that location","quiz.seenBefore":"Seen before","quiz.currentLocation":"Current Location: {city}","quiz.adjustRadius":"Adjust search radius or administrative boundary","quiz.cycleScope":"Cycle administrative scope","quiz.radiusKm":"{km} km radius","quiz.hood":"Hood","quiz.region":"Region","quiz.city":"City","quiz.featureFilter":"Feature Type Filter: {label}","quiz.encyclopedia":"Encyclopedia","quiz.encyclopediaOnlyTitle":"Only quiz features that have an encyclopedia page","quiz.roundOf":"Round {round} of {total}","quiz.blindMapOn":"Blind Map Mode active (labels hidden). Click to toggle.","quiz.noLabels":"No Labels","quiz.menu":"Open Menu & Settings","quiz.searchArea":"Search area","quiz.searchPlaceholder":"City, address, or postcode","quiz.searchLocation":"Search location","quiz.findThisLocation":"Find this location using the selected radius","quiz.customRadius":"Custom radius circle","quiz.showBoundary":"Show boundary on map","quiz.optionsTitle":"Map Quest Options","quiz.guestProgress":"Guest progress","quiz.syncActive":"Progress sync is active","quiz.savedHere":"Reviews are saved on this device","quiz.myProgress":"My progress","quiz.signOut":"Sign out","quiz.signInToSync":"Sign in to sync","quiz.cloudNotConfigured":"Cloud sync not configured","quiz.signInToSyncTitle":"Sign in to sync progress","quiz.addFirebase":"Add Firebase environment variables to enable cloud sync","quiz.questionPool":"Question pool","quiz.featureCount":"{count} features","quiz.encyclopediaOnlyHint":"Only quiz places with an encyclopedia page","quiz.gameMode":"Game mode","quiz.modeExplainer":"Pinpoint places a named spot on the map. Guess Name names what the map highlights. Neighborhood places area boundaries.","quiz.locateOnMap":"Locate on map","quiz.nameTheHighlight":"Name the highlight","quiz.cityLocation":"City / Location","quiz.useMyLocation":"Use My Location","quiz.locating":"Locating...","quiz.blankBaseMap":"Label-less Base Map","quiz.blankBaseMapHint":"Hides text labels on map tiles (Default: Active)","quiz.mapStyle":"Map Style","quiz.units":"Units","quiz.quizAndMapSettings":"Quiz and map settings","quiz.on":"On","quiz.off":"Off","quiz.kind.water":"Canal / Waterway","quiz.kind.bridge":"Bridge","quiz.kind.square":"Square / Plaza","quiz.kind.park":"Park / Greenway","quiz.kind.landmark":"Landmark","quiz.kind.neighborhood":"Neighborhood","quiz.kind.street":"Street","quiz.known":"Known","quiz.knownHint":"answered well again","quiz.shaky":"Still shaky","quiz.shakyHint":"back soon","quiz.mixed":"Mixed","quiz.rankFirst":"A useful first pass","quiz.rankKnowMap":"You know this map","quiz.rankStrong":"Strong sense of place","quiz.rankBearings":"Getting your bearings","quiz.avgError":"Avg. Error","quiz.averageDistance":"Average distance","quiz.guessMode":"Guess mode","quiz.tryOther":"Try {mode}","quiz.moreAbout":"More about {name}","quiz.nothingDueShort":"Nothing due","quiz.currentLocationLabel":"Current Location","quiz.bonusWhere":"where is {place}?","quiz.bonusTapWhere":"where {place} is","quiz.new":"New","quiz.newHint":"first time right","quiz.roundWord":"Round {round}","quiz.postcardOpen":"Greetings from {name}: open the postcard","quiz.dueTodayLabel":"Due today","account.guest":"Playing as guest","account.guestNote":"Sign in to keep your progress on every device","account.signIn":"Sign in","account.signOut":"Sign out","account.signingIn":"Signing in\u2026","account.syncNote":"Progress syncs to every device","account.signInTitle":"Sign in with Google to keep your progress on every device","account.unavailable":"Sign-in is not configured on this build","account.fallback":"Account","account.masteredSynced":"{count} synced","onb.close":"Close the intro","onb.skip":"Skip","onb.back":"Back","onb.gotIt":"Got it","onb.next":"Next","onb.step":"Step {current} of {total}","onb.rideTitle":"Ride the real city","onb.rideBody":"Pick Boat or Bike and press Start route. Ride to the destination named in the top-right corner; the orange arrow points the way.","onb.ringCaption":"Hold the ring at the bottom and slide: sideways steers, up speeds up, back brakes.","onb.keysCaption":"Arrow keys or WASD steer. Space brakes.","onb.nameTitle":"Name it","onb.nameBody":"When you turn onto a new canal or street, the ride stops and asks its name. The card in the top-left shows ? ? ? until you answer. Not sure? Choose No idea. You see the answer either way.","onb.tapCaption":"Tap a name to answer. On Hard you type it.","onb.pressCaption":"Press 1\u20134 to pick a name, 0 for No idea. On Hard you type it.","onb.scoreTitle":"Points and names learned","onb.scoreBody":"A right answer earns points: more on harder settings, in a streak, and for a name that is new to you. Names you get right come back later for review, so they stick.","onb.tally":"3/4 named \xB7 290 pts","onb.scoreCaption":"3 named out of 4 asked. Knowledge, on the start screen, lists every name you have learned.","site.home":"Home","site.ride":"Ride","site.quiz":"Quiz","site.progress":"Progress","site.buildings":"Buildings","site.label":"Ride Amsterdam","settings.quizTitle":"Quiz & Map Configuration","settings.locationScope":"Location Quiz Scope","settings.neighborhoodScope":"Neighbourhood (~2.2 km)","settings.neighborhoodScopeBody":"A walkable set of streets, canals and landmarks around you.","settings.regionScope":"Region (~15 km)","settings.regionScopeBody":"Uses the county or province returned for your position.","settings.cityScope":"Whole City (~4.5 km)","settings.cityScopeBody":"Encompasses major city canals, bridges, plazas, and citywide landmarks.","settings.boundary":"Administrative Boundary","settings.boundaryBody":"Use an exact OpenStreetMap political boundary, or switch back to the custom radius.","settings.boundaryAdminLevel":"{name} \u2014 admin level {level}","settings.radius":"Search Radius","settings.radiusBody":"Administrative scope chooses the place name; radius controls the actual circular OSM query independently.","settings.importantWaters":"Important canals & waters first","settings.blankMap":"Label-less Base Map (Default)","settings.blankMapBody":"Hides text labels on map tiles; the quiz is about names, not reading them off the map.","settings.mapTheme":"Map Style Theme","settings.units":"Distance Units","settings.unitsBody":"Metric (m / km) or Imperial (ft / mi)","settings.difficulty":"Difficulty","settings.difficultyBody":"Hard hides the landmark and shop clues inside a neighbourhood","settings.rounds":"Rounds per Quiz","settings.roundsBody":"Number of street features per session","settings.cache":"Offline Feature Cache","settings.cacheBody":"Caches queried neighbourhoods, street geometry, and clues locally to provide instant load times and reduce network requests.","settings.cacheCount":"{features} cached places across {entries} area queries","settings.clearCache":"Clear Cache","settings.clearCacheConfirm":"Clear all cached map features? Locations will be re-fetched on demand.","settings.apply":"Apply & Continue","auth.createAccount":"Create account","auth.signIn":"Sign in","auth.email":"Email","auth.password":"Password","auth.pleaseWait":"Please wait\u2026","auth.haveAccount":"Already have an account? Sign in","auth.newHere":"New here? Create an account","auth.couldNotSignIn":"Could not sign in.","postcard.saving":"Saving\u2026","postcard.saveError":"Could not save, try again","postcard.save":"Save postcard","feedback.reportProblem":"Report a problem","ride.hint.keys":"Arrow Keys / WASD - Drive    SPACE - Drift    TAB - Map    -/+ Zoom","ride.hint.touch":"Left side: Steer    Right side: Gas/Brake    Double-tap: Drift","ride.introStreets":"Navigate the real street network and name each street after you turn","ride.introCanals":"Navigate the real canal network and name each waterway after you turn","ride.introTransit":"Ride real tram corridors and name the lines and stops","ride.nextRoute":"Next route","ride.nextStop":"Next stop","ride.routeSetup":"Route setup","ride.shareRoute":"Share this route","ride.linkCopied":"Link copied","ride.startExploring":"Start exploring","ride.noCycling":"No cycling in real life","ride.wikipediaLink":"Wikipedia \u2197","ride.researchSource":"Research source \u2197","ride.rules.title":"HOW TO PLAY","ride.rules.bike1":"1. Use WASD or the arrow keys to steer the bike","ride.rules.bike2":"2. Stay on mapped streets; the road guard keeps you on the network","ride.rules.bike3":"3. After entering a differently named street, name it","ride.rules.boat1":"1. Use WASD or the arrow keys to steer the boat","ride.rules.boat2":"2. The boat slows dramatically when it leaves mapped water","ride.rules.boat3":"3. After entering a differently named waterway, name it","ride.rules.transit1":"1. Follow the mapped corridor toward the destination","ride.rules.transit2":"2. Stops and line names are the questions here","ride.rules.transit3":"3. After entering a differently named line, name it","ride.rules.labels":"4. Map labels are hidden: navigate from the shape of the city","ride.rules.map":"5. TAB toggles the overview map; -/+ changes zoom","ride.rules.prototype":"6. This is an early prototype \u2014 feedback is the point","finish.destination":"your destination","finish.newNames.one":"{count} new name","finish.newNames.other":"{count} new names","finish.newNeighborhoods.one":"{count} new neighbourhood","finish.newNeighborhoods.other":"{count} new neighbourhoods","finish.newLandmarks.one":"{count} landmark","finish.newLandmarks.other":"{count} landmarks","finish.arrivedWith":"You made it to {destination} \xB7 {bits}","finish.arrived":"Arrived at {destination}","finish.sticks":"That knowledge sticks on your {city} map.","finish.cleanRide":"A clean ride \u2014 review something overdue next time.","finish.passport":"Passport: {stamps}","finish.youKnow":"You know {name}","finish.streakFirst":"First new place today","finish.streakDays":"{count}-day place streak"};var nE={en:du["language.en"],nl:du["language.nl"]};var oE=Math.PI/4;var aE=Math.PI/6;function fu(n,e,t,i){return!e||n.hiddenName&&(e===n.hiddenName||kr(e)===kr(n.hiddenName))?!1:n.isLabelled(e,t,i)}function au(n,e){return!(!e||n.quizQuiet||n.spoilerIndex&&hu(e,n.spoilerIndex)||n.hiddenName&&hu(e,Fs([n.hiddenName])))}function _f(n){return!n.quizQuiet}var Ci=250;function pu(n,e){let t=new Map;for(let i of n){let[r,s,o,a]=e(i);for(let l=Math.floor(r/Ci);l<=Math.floor(o/Ci);l++)for(let c=Math.floor(s/Ci);c<=Math.floor(a/Ci);c++){let h=`${l},${c}`,f=t.get(h);f?f.push(i):t.set(h,[i])}}return t}var mu=n=>{let e=1/0,t=1/0,i=-1/0,r=-1/0;for(let[s,o]of n)s<e&&(e=s),s>i&&(i=s),o<t&&(t=o),o>r&&(r=o);return[e,t,i,r]},Hb={major:3.2,secondary:2.6,tertiary:2,minor:1.4,service:.8,cycle:.8,path:.6},el=class{constructor(e,t=450){this.radiusM=t;this.streets=pu(e.streets,i=>mu(i.points)),this.water=pu(e.water,i=>mu(i[0])),this.parks=pu(e.parks.flatMap(i=>i.rings.map(r=>[r])),i=>mu(i[0]))}streets;water;parks;gather(e,t,i,r){let s=new Set;for(let o=Math.floor((t-r)/Ci);o<=Math.floor((t+r)/Ci);o++)for(let a=Math.floor((i-r)/Ci);a<=Math.floor((i+r)/Ci);a++)for(let l of e.get(`${o},${a}`)??[])s.add(l);return s}draw(e,t,i,r,s){let o=t/2/this.radiusM,a=this.radiusM*1.45;e.save(),e.beginPath(),e.arc(t/2,t/2,t/2,0,Math.PI*2),e.clip(),e.fillStyle=hn.land,e.fillRect(0,0,t,t),e.translate(t/2,t/2),e.rotate(-r*Math.PI/180),e.scale(o,-o),e.translate(-i[0],-i[1]);let l=0,c=(f,u)=>{e.fillStyle=u,e.beginPath();for(let d of f){for(let g of d)g.forEach(([x,p],m)=>m?e.lineTo(x,p):e.moveTo(x,p)),e.closePath();l++}e.fill("evenodd")};c(this.gather(this.parks,i[0],i[1],a),hn.park),c(this.gather(this.water,i[0],i[1],a),hn.water);let h=[...this.gather(this.streets,i[0],i[1],a)].sort((f,u)=>Wn[f.cls].order-Wn[u.cls].order);e.lineCap="round",e.lineJoin="round";for(let f of["casing","fill"]){let u="";for(let d of h){let g=Wn[d.cls],x=f==="casing"?g.casing:g.fill;if(!x)continue;let p=`${x}|${d.cls}`;p!==u&&(u&&e.stroke(),u=p,e.strokeStyle=x,e.lineWidth=(Hb[d.cls]+(f==="casing"?1.2:0))/o,e.beginPath()),d.points.forEach(([m,v],M)=>M?e.lineTo(m,v):e.moveTo(m,v)),l++}u&&e.stroke()}return s&&s.length>1&&(e.strokeStyle=hn.routeCasing,e.lineWidth=5/o,e.beginPath(),s.forEach(([f,u],d)=>d?e.lineTo(f,u):e.moveTo(f,u)),e.stroke(),e.strokeStyle=hn.route,e.lineWidth=3/o,e.stroke()),e.restore(),e.save(),e.translate(t/2,t/2),e.fillStyle="#0f172a",e.strokeStyle="#fff",e.lineWidth=2,e.beginPath(),e.moveTo(0,-9),e.lineTo(6.5,7),e.lineTo(0,3.5),e.lineTo(-6.5,7),e.closePath(),e.fill(),e.stroke(),e.restore(),e.strokeStyle="rgba(15,23,42,.55)",e.lineWidth=1.5,e.beginPath(),e.arc(t/2,t/2,t/2-.75,0,Math.PI*2),e.stroke(),l}};var vf=[{id:"nassaukade",label:"Nassaukade / Kostverlorenvaart / Bilderdijkstraat",lng:4.869,lat:52.37,halfM:750},{id:"leidsegracht",label:"Herengracht / Leidsegracht",lng:4.8875,lat:52.3665,halfM:750}];var Wb={asphalt:{mesh:"asphalt",road:!0,what:"grey asphalt carriageway"},cycle:{mesh:"cycle",road:!1,what:"red asphalt cycle path, lane or track"},fietsstraat:{mesh:"cycle",road:!0,what:"red asphalt carriageway (fietsstraat): edge lines, no centre line"},brick:{mesh:"klinker",road:!0,what:"klinker (brick) carriageway, herringbone"},concrete:{mesh:"paving",road:!1,what:"paving tiles: sidewalks, footways, concrete"},gravel:{mesh:"gravel",road:!1,what:"unpaved: gravel, compacted, dirt"}};function qb(n){return(n.cyclestreet==="yes"||n.bicycle_road==="yes"||n["surface:colour"]==="red")&&(!n.surface||n.surface==="asphalt")}function Xb(n,e){if(qb(n))return"fietsstraat";let t=Sf(n.surface,e,!1);return t==="klinker"?"brick":t==="paving"?"concrete":t==="gravel"?"gravel":t==="cycle"?"cycle":"asphalt"}var Mf=.11,tl=.15,Yb=1.8,jb=2.1,nl=1.6,gu={motorway:{width:11,oneway:7.5,laneM:3.5,surface:"asphalt",sidewalks:!1,centre:!0},trunk:{width:10,oneway:7,laneM:3.3,surface:"asphalt",sidewalks:!1,centre:!0},primary:{width:7,oneway:6.5,laneM:3.2,surface:"asphalt",sidewalks:!1,centre:!0},secondary:{width:6.5,oneway:6,laneM:3.1,surface:"asphalt",sidewalks:!1,centre:!0},tertiary:{width:6,oneway:3.6,laneM:3,surface:"asphalt",sidewalks:!0,centre:!0},unclassified:{width:5.5,oneway:3.6,laneM:2.8,surface:"klinker",sidewalks:!0,centre:!1},residential:{width:5.2,oneway:4,laneM:2.75,surface:"klinker",sidewalks:!0,centre:!1},living_street:{width:4.6,oneway:4,laneM:2.6,surface:"klinker",sidewalks:!1,centre:!1},service:{width:3.6,oneway:3.2,laneM:3,surface:"klinker",sidewalks:!1,centre:!1},busway:{width:6,oneway:3.5,laneM:3.2,surface:"asphalt",sidewalks:!1,centre:!1},road:{width:5,oneway:3.6,laneM:3,surface:"asphalt",sidewalks:!1,centre:!1}};for(let n of["motorway","trunk","primary","secondary","tertiary"])gu[`${n}_link`]=gu[n];var $b={cycleway:{width:2.5,kind:"cycleway",surface:"cycle"},footway:{width:2,kind:"footway",surface:"paving"},pedestrian:{width:6,kind:"footway",surface:"paving"},path:{width:2,kind:"path",surface:"paving"},steps:{width:2,kind:"footway",surface:"paving"},track:{width:3,kind:"path",surface:"gravel"},bridleway:{width:2,kind:"path",surface:"gravel"}},Zb=new Set(["proposed","construction","platform","corridor","elevator","bus_stop","raceway","abandoned","disused","razed"]);function Us(n){if(!n)return null;let e=/^\s*([0-9]+(?:[.,][0-9]+)?)\s*(m|meter|metres?)?\s*$/i.exec(n);if(!e)return null;let t=Number(e[1].replace(",","."));return Number.isFinite(t)&&t>.3&&t<60?t:null}function Sf(n,e,t){return n?n==="asphalt"?e==="cycle"?"cycle":"asphalt":["paving_stones","sett","bricks","brick","cobblestone","unhewn_cobblestone","paving_stones:30"].includes(n)?e==="cycle"?"cycle":t||e==="paving"?"paving":"klinker":n==="concrete"||n.startsWith("concrete:")?e==="cycle"?"cycle":"paving":["unpaved","gravel","fine_gravel","compacted","dirt","ground","sand","earth","woodchips","pebblestone"].includes(n)?"gravel":e:e}var Kb=n=>n===void 0?null:n==="both"?["left","right"]:n==="left"||n==="right"?[n]:[];function Jb(n,e){let t=Kb(n.sidewalk);if(t)return{sides:t,source:"tag"};let i=n["sidewalk:both"];if(i!==void 0)return{sides:i==="yes"?["left","right"]:[],source:"tag"};let r=n["sidewalk:left"],s=n["sidewalk:right"];return r!==void 0||s!==void 0?{sides:[...r==="yes"?["left"]:[],...s==="yes"?["right"]:[]],source:"tag"}:{sides:e?["left","right"]:[],source:"prior"}}function Qb(n){let e=s=>s==="lane"||s==="opposite_lane"?"lane":s==="track"||s==="opposite_track"?"track":null,t=n.cycleway??n["cycleway:both"];if(t!==void 0){let s=e(t);return{left:n.oneway==="yes"&&n["cycleway:both"]===void 0&&t!=="opposite_lane"?null:s,right:s,source:"tag"}}let i=n["cycleway:left"],r=n["cycleway:right"];return i!==void 0||r!==void 0?{left:e(i),right:e(r),source:"tag"}:{left:null,right:null,source:"prior"}}function wf(n,e){let t=n.highway;if(!t||Zb.has(t)||n.area==="yes"||n.tunnel&&n.tunnel!=="no"&&n.tunnel!=="building_passage"||Number(n.layer)<0&&!n.bridge||n.level&&Number(n.level)!==0&&!n.bridge)return null;let i=Us(n.width)??Us(n.est_width),r=e&&e[0]>=8?e[0]/10:null,s=e&&e[1]>=5?Math.min(e[1]/10,6):null,o=e&&e[2]>=10?Math.max(1.2,Math.min(e[2]/10,4)):null,a=$b[t];if(r){let _=a?t==="pedestrian"?30:t==="cycleway"||t==="path"&&n.bicycle==="designated"?4.5:6:(Number(n.lanes)>0?Number(n.lanes):n.oneway==="yes"?1:2)*3.75+1.5;a&&i&&r>i*1.8?r=null:r>_&&(r=_)}if(a){let _=a.kind,A=a.surface;t==="path"&&n.bicycle==="designated"&&(_="cycleway",A="cycle");let P=t==="footway"&&n.footway==="sidewalk",C=n.footway==="crossing"||n.cycleway==="crossing";A=Sf(n.surface,A,P),_==="cycleway"&&n.surface&&n.surface!=="asphalt"&&A!=="gravel"&&(A="cycle");let I=r?Math.min(r,30):i??(t==="cycleway"&&n.oneway==="yes"?2.1:a.width),L={kind:P?"sidewalk":_,surface:A,offset:0,width:I,raised:P?Mf:0,kerb:P?"both":"none"},H=["zebra","marked","uncontrolled"].includes(n.crossing)||!!n["crossing:markings"]&&n["crossing:markings"]!=="no",k=C&&H&&!P&&_==="footway"?[{offset:0,width:Math.min(I,3),dash:[.5,.5],mapped:!0}]:[];if(n.cycleway==="crossing"&&n["surface:colour"]!=="red"){let O=Math.max(.6,Math.min(I,4)/2-.2);k.push({offset:O,width:.4,dash:[.4,.4],mapped:!0},{offset:-O,width:.4,dash:[.4,.4],mapped:!0})}return _==="cycleway"&&!C&&I>=1.5&&k.push({offset:I/2-.15,width:.08,dash:null},{offset:-(I/2-.15),width:.08,dash:null}),{bands:[L],paint:k,rails:[],coreHalfWidth:I/2,halfWidth:I/2,source:{width:r?"bgt":i?"tag":"prior",sidewalk:"prior",cycleway:"prior"}}}let l=gu[t];if(!l)return null;let c=n.oneway==="yes"||n.junction==="roundabout",h=Number(n.lanes),f=Qb(n),u=(f.left==="lane"?1:0)+(f.right==="lane"?1:0),d=r?"bgt":i?"tag":h>0?"lanes":"prior",g=r?r-u*nl:i??(h>0?h*l.laneM:c?l.oneway:l.width);!r&&(n.service==="alley"||n.service==="driveway")&&(g=Math.min(g,3)),g=Math.max(2.4,Math.min(30,g));let x=Xb(n,l.surface),p=[{kind:"carriageway",surface:Wb[x].mesh,offset:0,width:g,raised:0,kerb:"none"}],m=[],v=g/2,M={left:v,right:v};for(let _ of["left","right"]){let A=_==="left"?1:-1,P=f[_];if(P==="lane")p.push({kind:"cycle_lane",surface:"cycle",offset:A*(M[_]+nl/2),width:nl,raised:0,kerb:"none"}),m.push({offset:A*M[_],width:tl,dash:[1,1]}),M[_]+=nl;else if(P==="track"){let C=o??jb;p.push({kind:"cycle_track",surface:"cycle",offset:A*(M[_]+.4+C/2),width:C+.8,raised:.04,kerb:_});let I=A*(M[_]+.4+C/2);m.push({offset:I+C/2-.1,width:.08,dash:null},{offset:I-C/2+.1,width:.08,dash:null}),M[_]+=C+.8}}let y=Jb(n,l.sidewalks);for(let _ of y.sides){let A=_==="left"?1:-1,P=s??Us(n[`sidewalk:${_}:width`])??Us(n["sidewalk:both:width"])??Us(n["sidewalk:width"])??Yb;p.push({kind:"sidewalk",surface:"paving",offset:A*(M[_]+P/2),width:P,raised:Mf,kerb:_}),M[_]+=P}!(n.cyclestreet==="yes"||n.bicycle_road==="yes"||x==="fietsstraat")&&(h>=2&&!c||l.centre&&!c&&!h)&&m.push({offset:0,width:tl,dash:[3,5]}),(t.startsWith("primary")||t.startsWith("secondary")||t.startsWith("trunk")||x==="fietsstraat")&&m.push({offset:v-.3,width:tl,dash:null},{offset:-(v-.3),width:tl,dash:null});let T=[];if((n.embedded_rails??"").split(";").includes("tram")){let _=(n["embedded_rails:offsets"]??"").split(";").map(Number).filter(P=>n["embedded_rails:offsets"]&&Number.isFinite(P)&&Math.abs(P)<=12),A=!c||n["oneway:bus"]==="no"||n["oneway:psv"]==="no";_.length?T.push(..._):A&&g>=5.5?T.push(1.5,-1.5):T.push(0)}return{bands:p,paint:m,rails:T,coreHalfWidth:v,halfWidth:Math.max(M.left,M.right),source:{width:d,sidewalk:s&&y.sides.length?"bgt":y.source,cycleway:o&&(f.left==="track"||f.right==="track")?"bgt":f.source,sidewalkSides:y.source}}}var Et=(n=!1)=>({positions:[],uvs:[],indices:[],...n?{colors:[]}:{}});function vt(n,e,t,i,r){return n.positions.push(e,t,i),n.uvs.push(e,t),n.colors&&n.colors.push(...r??[1,1,1]),n.positions.length/3-1}var Nr=n=>n.indices.length/3;function Zt(n){let e=[0];for(let t=1;t<n.length;t++)e.push(e[t-1]+Math.hypot(n[t][0]-n[t-1][0],n[t][1]-n[t-1][1]));return e}function ot(n,e,t){if(t<=0)return n[0];if(t>=e[e.length-1])return n[n.length-1];let i=1;for(;e[i]<t;)i++;let r=(t-e[i-1])/(e[i]-e[i-1]||1);return[n[i-1][0]+(n[i][0]-n[i-1][0])*r,n[i-1][1]+(n[i][1]-n[i-1][1])*r]}function Pi(n,e){let t=Zt(n),i=t[t.length-1],r=[];for(let a of[...e].sort((l,c)=>l[0]-c[0])){let l=r[r.length-1];l&&a[0]<=l[1]?l[1]=Math.max(l[1],a[1]):r.push([a[0],a[1]])}let s=[],o=0;for(let[a,l]of r)a>o&&s.push([o,Math.min(a,i)]),o=Math.max(o,l);return o<i&&s.push([o,i]),s.filter(([a,l])=>l-a>.05).map(([a,l])=>{let c=[ot(n,t,a)];for(let h=0;h<n.length;h++)t[h]>a&&t[h]<l&&c.push(n[h]);return c.push(ot(n,t,l)),c})}function il(n,e){let t=[];for(let i=0;i+1<n.length;i++){let r=n[i],s=n[i+1],o=Math.max(1,Math.ceil(Math.hypot(s[0]-r[0],s[1]-r[1])/e));for(let a=0;a<o;a++)t.push([r[0]+(s[0]-r[0])*a/o,r[1]+(s[1]-r[1])*a/o])}return n.length&&t.push(n[n.length-1]),t}function Ef(n,e=2.5){let t=n.length,i=[],r=s=>{let o=n[s+1][0]-n[s][0],a=n[s+1][1]-n[s][1],l=Math.hypot(o,a)||1;return[-a/l,o/l]};for(let s=0;s<t;s++){let o=s>0?r(s-1):null,a=s<t-1?r(s):null;if(!o||!a){let u=o??a;i.push([u[0],u[1],1]);continue}let l=o[0]+a[0],c=o[1]+a[1],h=Math.hypot(l,c);if(h<1e-6){i.push([a[0],a[1],1]);continue}l/=h,c/=h;let f=l*a[0]+c*a[1];i.push([l,c,Math.min(e,1/Math.max(f,.001))])}return i}function An(n,e,t,i,r,s,o={}){if(e.length<2||i<=0)return;let a=il(e,o.step??3),l=Ef(a),c=Math.max(1,o.across??(i>7?2:1)),h=null;for(let f=0;f<a.length;f++){let[u,d,g]=l[f],x=[];for(let p=0;p<=c;p++){let m=(t+i/2-i*p/c)*g,v=a[f][0]+u*m,M=a[f][1]+d*m,y=o.ramp,w=p/c,E=y?[0,1,2].map(T=>y.left[T]+(y.right[T]-y.left[T])*w):o.colour;x.push(vt(n,v,M,r(v,M)+s,E))}if(h)for(let p=0;p<c;p++){let m=h[p],v=h[p+1],M=x[p+1],y=x[p];n.indices.push(v,M,y,v,y,m)}h=x}}function rl(n,e,t,i,r,s,o,a={}){if(e.length<2)return;let l=il(e,a.step??3),c=Ef(l),h=null;for(let f=0;f<l.length;f++){let[u,d,g]=c[f],x=l[f][0]+u*t*g,p=l[f][1]+d*t*g,m=i(x,p),v=vt(n,x,p,m+r,a.colour),M=vt(n,x,p,m+s,a.colour);h&&(o===1?n.indices.push(h[0],M,h[1],h[0],v,M):n.indices.push(h[0],h[1],M,h[0],M,v)),h=[v,M]}}function yu(n,e,t,i,r,s,o,a,l,c){let h=-t[1],f=t[0],u=i+r/2,d=i-r/2,g=[e[0]+h*u,e[1]+f*u],x=[e[0]+h*d,e[1]+f*d],p=s(g[0],g[1]),m=s(x[0],x[1]),v=vt(n,g[0],g[1],p+o,c),M=vt(n,g[0],g[1],p+a,c),y=vt(n,x[0],x[1],m+o,c),w=vt(n,x[0],x[1],m+a,c);l?n.indices.push(v,w,M,v,y,w):n.indices.push(v,M,w,v,w,y)}function Af(n,e,t,i,r,s=12,o){let a=i(e[0],e[1]),l=0;for(let u=0;u<8;u++){let d=u/8*Math.PI*2,g=Math.cos(d),x=Math.sin(d);l=Math.max(l,Math.abs(i(e[0]+g*t/2,e[1]+x*t/2)-(a+i(e[0]+g*t,e[1]+x*t))/2))}let c=l>.015?Math.max(2,Math.min(4,Math.ceil(t/1.5))):1,h=vt(n,e[0],e[1],a+r,o),f=-1;for(let u=1;u<=c;u++){let d=n.positions.length/3,g=t*u/c;for(let x=0;x<s;x++){let p=x/s*Math.PI*2,m=e[0]+Math.cos(p)*g,v=e[1]+Math.sin(p)*g;vt(n,m,v,i(m,v)+r,o)}for(let x=0;x<s;x++){let p=(x+1)%s;f<0?n.indices.push(h,d+x,d+p):n.indices.push(f+x,d+x,d+p,f+x,d+p,f+p)}f=d}}function Dr(n,e,t,i,r,s=4,o){for(let a=0;a<t.length;a+=3){let l=e[t[a]*2],c=e[t[a]*2+1],h=e[t[a+1]*2],f=e[t[a+1]*2+1],u=e[t[a+2]*2],d=e[t[a+2]*2+1],g=Math.max(Math.hypot(h-l,f-c),Math.hypot(u-h,d-f),Math.hypot(l-u,c-d)),x=Math.max(1,Math.min(64,Math.ceil(g/s))),p=(h-l)*(d-c)-(f-c)*(u-l)>0,m=[];for(let v=0;v<=x;v++){m.push([]);for(let M=0;M<=x-v;M++){let y=v/x,w=M/x,E=1-y-w,T=l*E+h*y+u*w,_=c*E+f*y+d*w;m[v].push(vt(n,T,_,i(T,_)+r,o))}}for(let v=0;v<x;v++)for(let M=0;M<x-v;M++){let y=m[v][M],w=m[v+1][M],E=m[v][M+1];if(p?n.indices.push(y,w,E):n.indices.push(y,E,w),M<x-v-1){let T=m[v+1][M+1];p?n.indices.push(w,T,E):n.indices.push(w,E,T)}}}}function Tf(n){let e=Et(n.some(t=>t.colors));for(let t of n){let i=e.positions.length/3;for(let r of t.positions)e.positions.push(r);for(let r of t.uvs)e.uvs.push(r);if(e.colors)if(t.colors)for(let r of t.colors)e.colors.push(r);else for(let r=0;r<t.positions.length;r++)e.colors.push(1);for(let r of t.indices)e.indices.push(r+i)}return e}var sl=!1,Cf={motorway:7,trunk:6,primary:5,secondary:4,tertiary:3,unclassified:2,busway:2,road:1,residential:1,living_street:0,service:0},ol=n=>Cf[(n??"").replace(/_link$/,"")]??0,e_=new Set(["service","living_street","busway","track","road"]),Pf=30,Lf=20,er={base:.5,height:.6,gap:.25},If=.4,Rf={size:.4,gap:.4};function kf(n,e,t){let i=n.replace(/_link$/,"");return e_.has(i)||!(i in Cf)?null:t?"stop":ol(i)<e?"giveWay":null}var Nf=n=>n.crossing==="traffic_signals"||n["crossing:signals"]==="yes",Lt=(n,e,t)=>[n.o[0]+n.u[0]*e-n.u[1]*t,n.o[1]+n.u[1]*e+n.u[0]*t];function al(n,e,t,i){Dr(n,e.flatMap(r=>[r[0],r[1]]),e.length===3?[0,1,2]:[0,1,2,0,2,3],t,i,1)}function Df(n,e,t,i,r,s,o){let a=i-t,l=er.base+er.gap,c=Math.floor((a+er.gap)/l);if(c<1)return 0;let h=t+(a-(c*l-er.gap))/2,f=0;for(let u=0;u<c;u++){let d=h+u*l,g=d+er.base,x=Lt(e,er.height/3,(d+g)/2);o&&!o(x[0],x[1])||(al(n,[Lt(e,0,d),Lt(e,0,g),Lt(e,er.height,(d+g)/2)],r,s),f++)}return f}function Ff(n,e,t,i,r,s,o,a){if(i-t<.2)return!1;let l=Lt(e,r/2,(t+i)/2);return a&&!a(l[0],l[1])?!1:(al(n,[Lt(e,0,t),Lt(e,0,i),Lt(e,r,i),Lt(e,r,t)],s,o),!0)}function xu(n,e,t,i,r,s=Rf.size,o=Rf.gap,a){let l=Math.hypot(t[0]-e[0],t[1]-e[1]);if(l<s)return 0;let c=[(t[0]-e[0])/l,(t[1]-e[1])/l],h=s+o,f=Math.floor((l+o)/h),u=(l-(f*h-o))/2,d=0;for(let g=0;g<f;g++){let x={o:[e[0]+c[0]*(u+g*h),e[1]+c[1]*(u+g*h)],u:c},p=Lt(x,s/2,0);a&&!a(p[0],p[1])||(al(n,[Lt(x,0,-s/2),Lt(x,s,-s/2),Lt(x,s,s/2),Lt(x,0,s/2)],i,r),d++)}return d}function bu(n,e,t,i,r,s){let o=Math.hypot(t[0]-e[0],t[1]-e[1]);if(o<.3)return;let a={o:e,u:[(t[0]-e[0])/o,(t[1]-e[1])/o]};al(n,[Lt(a,0,-i/2),Lt(a,o,-i/2),Lt(a,o,i/2),Lt(a,0,i/2)],r,s)}function Uf(n,e,t){let i=0;for(let r=0;r+1<n.length;r++){let s=n[r],o=n[r+1],a=o[0]-s[0],l=o[1]-s[1],c=t[0]-e[0],h=t[1]-e[1],f=a*h-l*c,u=Math.hypot(a,l);if(Math.abs(f)>1e-9){let d=((e[0]-s[0])*h-(e[1]-s[1])*c)/f,g=((e[0]-s[0])*l-(e[1]-s[1])*a)/f;if(d>=0&&d<=1&&g>=0&&g<=1)return i+d*u}i+=u}return null}var t_=["land","osmArea","park","bgtCarriage","bgtParking","bgtFoot","bgtPedestrian","bgtCycle","bgtDriveway","bgtIsland","bgtBerm","bgtVerge","bgtSquare","fietsstraat","bgtKerb","band","junctionFill","laneRibbon","cyclePaint","cycleCross","nodePaint","graphPaint","bandPaint","rails","pocket","water","quay","deck","other","photoPaint"],n_=n=>t_.indexOf(n)+1;var ll=null;function dn(n,e){if(!ll)return;(ll.get(n)??(ll.set(n,[]),ll.get(n))).push({tri:n.indices.length/3,code:n_(e)})}function Of(n,e){let t=1/0,i=0,r=0;for(let s=0;s+1<n.length;s++){let o=n[s],a=n[s+1],l=a[0]-o[0],c=a[1]-o[1],h=l*l+c*c,f=Math.sqrt(h),u=h<1e-12?0:Math.max(0,Math.min(1,((e[0]-o[0])*l+(e[1]-o[1])*c)/h)),d=Math.hypot(o[0]+l*u-e[0],o[1]+c*u-e[1]);d<t&&(t=d,i=r+u*f),r+=f}return i}var Bf=(n,e)=>!!n&&n.some(([t,i])=>e>=t&&e<=i);var Mu=!1,i_=.1,Os={lane:.056,paint:.062,rail:.066},At={area:.015,crossing:.025,carriageway:.03,cycleLane:.036,path:.04,paint:.046,rail:.05,raisedBase:.03,route:.07},Li=n=>`${Math.round(n[0]*10)}:${Math.round(n[1]*10)}`,cl=n=>n.section.bands[0]?.kind==="carriageway",qn=n=>!!n.tags.bridge&&n.tags.bridge!=="no",_u=n=>n.tags.footway==="crossing"||n.tags.cycleway==="crossing"||n.tags.path==="crossing";function qf(n,e){let t=[];for(let i of n){let r=wf(i.tags,i.bw);!r||i.g.length<2||t.push({id:i.id,tags:i.tags,points:i.g.map(e),section:r,bw:i.bw})}return t}function Xf(n){let e=0,t=0;for(let i of n.bands)i.kind!=="carriageway"&&i.kind!=="cycle_lane"||(e=Math.max(e,i.offset+i.width/2),t=Math.max(t,-(i.offset-i.width/2)));return{left:e,right:t}}var Yf=(n,e)=>n[0]*e[1]-n[1]*e[0],sn=n=>[-n[1],n[0]];function r_(n,e,t){let i=n[e],r=e+t,s=null;for(;r>=0&&r<n.length&&(s=n[r],!(Math.hypot(s[0]-i[0],s[1]-i[1])>=4));)r+=t;if(!s)return null;let o=s[0]-i[0],a=s[1]-i[1],l=Math.hypot(o,a);return l>.001?[o/l,a/l]:null}function zf(n,e,t){return t>0?n[n.length-1]-n[e]:n[e]}function vu(n,e,t,i){let r=sn(n),s=sn(t),o=-s[0]*i-r[0]*e,a=-s[1]*i-r[1]*e,l=n[0]*-t[1]-n[1]*-t[0];if(Math.abs(l)<1e-6)return null;let c=(o*-t[1]-a*-t[0])/l,h=(n[0]*a-n[1]*o)/l;return{t:c,s:h}}var s_=18,o_=18,jf=35;function a_(n){let e=new Map,t=r=>{let s=Li(r),o=e.get(s);return o||(o={p:r,ways:new Set,arms:[],roadHalf:0,kind:"none",polygon:[],corners:[],owner:1/0},e.set(s,o)),o};for(let r of n){let s=Zt(r.points),o=Xf(r.section);r.points.forEach((a,l)=>{let c=t(a);if(c.ways.add(r.id),!!cl(r))for(let h of[1,-1]){let f=l+h;if(f<0||f>=r.points.length||zf(s,l,h)<.05)continue;let u=r_(r.points,l,h);u&&c.arms.push({way:r,i:l,sign:h,dir:u,angle:Math.atan2(u[1],u[0]),left:h>0?o.left:o.right,right:h>0?o.right:o.left,trim:0,cornerLeft:null,cornerRight:null})}})}let i=Math.sin(o_*Math.PI/180);for(let r of e.values()){let s=r.arms;if(r.roadHalf=s.reduce((l,c)=>Math.max(l,c.left,c.right),0),s.length<2||s.every(l=>l.way===s[0].way))continue;if(r.owner=Math.min(...s.map(l=>l.way.id)),s.sort((l,c)=>l.angle-c.angle),s.length===2&&180-Math.abs(((s[0].angle-s[1].angle)*180/Math.PI+540)%360-180)<=jf){r.kind="continuation";let c=[];for(let h of s){let f=sn(h.dir);for(let[u,d]of[[h.left,1],[h.right,-1]]){let g=[r.p[0]+f[0]*u*d,r.p[1]+f[1]*u*d];c.push({p:g,a:Math.atan2(g[1]-r.p[1],g[0]-r.p[0])})}}r.polygon=[r.p,...c.sort((h,f)=>h.a-f.a).map(h=>h.p)];continue}r.kind="junction";let o=s.length;for(let l=0;l<o;l++){let c=s[l],h=s[(l+1)%o];if(Yf(c.dir,h.dir)<i)continue;let u=vu(c.dir,c.left,h.dir,h.right);if(!u||u.t<-.5||u.s<-.5)continue;let d=Math.max(0,u.t),g=Math.max(0,u.s);c.cornerLeft=d,h.cornerRight=g;let x=sn(c.dir);r.corners.push({a:c,b:h,p:[r.p[0]+c.dir[0]*d+x[0]*c.left,r.p[1]+c.dir[1]*d+x[1]*c.left]})}for(let l of s){let c=Zt(l.way.points),h=zf(c,l.i,l.sign),f=Math.max(l.cornerLeft??0,l.cornerRight??0,.5);l.trim=Math.min(f,s_,h*.45)}let a=[];for(let l=0;l<o;l++){let c=s[l],h=sn(c.dir),f=d=>[r.p[0]+c.dir[0]*c.trim+h[0]*d,r.p[1]+c.dir[1]*c.trim+h[1]*d];a.push(f(-c.right),f(c.left));let u=r.corners.find(d=>d.a===c);u&&a.push(u.p)}r.polygon=a}return e}function l_(n,e,t){let i=[];return n.points.forEach((r,s)=>{let o=e.get(Li(r));if(!(!o||o.kind!=="junction"))for(let a of o.arms)a.way===n&&a.i===s&&i.push(a.sign>0?[t[s]-.001,t[s]+a.trim]:[t[s]-a.trim,t[s]+.001])}),i}function Vf(n,e,t,i){let r=[];return n.points.forEach((s,o)=>{let a=t.get(Li(s));if(!(!a||a.kind!=="junction"))for(let l of a.arms){if(l.way!==n||l.i!==o)continue;let c=l.sign>0==e>0?l.cornerLeft:l.cornerRight;c!==null&&r.push(l.sign>0?[i[o]-.001,i[o]+c]:[i[o]-c,i[o]+.001])}}),r}function c_(n,e,t){if(_u(n))return[];let i=[],r=n.points.length-1;return n.points.forEach((s,o)=>{let a=e.get(Li(s));if(!a||!a.arms.length||a.arms.every(c=>c.way===n))return;let l=Math.min(a.roadHalf+.15,12);i.push([o===0?-1:t[o]-l,o===r?t[o]+1:t[o]+l])}),i}var u_=3,h_=6,d_=30,Gf=(n,e)=>{let t=n.points[0],i=n.points[n.points.length-1],r=e[0],s=e[e.length-1],o=Math.hypot(r[0]-t[0],r[1]-t[1])>.1,a=Math.hypot(s[0]-i[0],s[1]-i[1])>.1;return f_(e)>=(o&&a?h_:u_)},f_=n=>{let e=0;for(let t=1;t<n.length;t++)e+=Math.hypot(n[t][0]-n[t-1][0],n[t][1]-n[t-1][1]);return e};function p_(n){let t=new Map,i=n.filter(s=>cl(s)&&!qn(s));for(let s of i){let o=Xf(s.section),a=Math.min(o.left,o.right);for(let l=0;l+1<s.points.length;l++){let c=s.points[l],h=s.points[l+1];for(let f=Math.floor(Math.min(c[0],h[0])/20);f<=Math.floor(Math.max(c[0],h[0])/20);f++)for(let u=Math.floor(Math.min(c[1],h[1])/20);u<=Math.floor(Math.max(c[1],h[1])/20);u++){let d=`${f}:${u}`;(t.get(d)??t.set(d,[]).get(d)).push({way:s,a:c,b:h,half:a})}}}let r=new Set;for(let s of i){let o=Zt(s.points),a=o[o.length-1];if(a>d_||a<1)continue;let l=s.section.coreHalfWidth,c=0,h=0;for(let f=0;f<=a+1e-6;f+=.5){let u=ot(s.points,o,Math.min(f,a));h++;let d=!1;for(let g of t.get(`${Math.floor(u[0]/20)}:${Math.floor(u[1]/20)}`)??[]){if(g.way.id===s.id||g.half<l+.8)continue;let x=g.b[0]-g.a[0],p=g.b[1]-g.a[1],m=x*x+p*p;if(m<1e-6)continue;let v=Math.max(0,Math.min(1,((u[0]-g.a[0])*x+(u[1]-g.a[1])*p)/m));if(Math.hypot(g.a[0]+x*v-u[0],g.a[1]+p*v-u[1])<=g.half-l*.5){d=!0;break}}d&&c++}c>=.8*h&&r.add(s.id)}return r}function $f(n,e,t={}){let i=t.step??3,r=t.roads??null,s=t.guessedPaint??sl,o={paint:0,rails:0,lanes:0,fills:0,crossCuts:0,coveredWays:0,bandStations:0,bandTris:0,discs:0},a=r?Os.paint:At.paint,l=r?Os.rail:At.rail,c=y=>r?(w,E)=>Mu&&r.index.onRoad(w,E,qn(y)):void 0,h=y=>!!r&&r.index.find(y[0],y[1])>=0,f=r?S_(n):null,u=y=>t.acrossStep?Math.max(y>7?2:1,Math.ceil(y/t.acrossStep)):void 0,d={asphalt:Et(),klinker:Et(),cycle:Et(),paving:Et(),gravel:Et(),paint:Et(),kerb:Et(),tram:Et(),bollard:Et(),stats:{ways:0,bands:0,metres:0,widthFromTags:0,sidewalkFromTags:0,trims:0,junctions:0,corners:0,markings:{stopLines:0,giveWays:0,teeth:0,laneLinks:0,cycleCrossings:0,blocks:0,...r?{clipped:o}:{}}},junctionPoints:[],junctionReach:[]},g=a_(n),x=new Map(n.map(y=>[y.id,y])),p=new Set,m=p_(n),v=n.filter(y=>Nf(y.tags)).flatMap(y=>y.points),M=n.filter(_u);for(let y of n){if(t.only&&!t.only(y)||m.has(y.id))continue;d.stats.ways++,y.section.source.width!=="prior"&&d.stats.widthFromTags++,y.section.source.sidewalk!=="prior"&&d.stats.sidewalkFromTags++;let w=Zt(y.points);d.stats.metres+=w[w.length-1];let E=y.tags.footway==="crossing"||y.tags.cycleway==="crossing"&&y.tags["surface:colour"]!=="red",T=cl(y),_=T?l_(y,g,w):[],A=T?[]:c_(y,g,w),P={1:T?Vf(y,1,g,w):[],[-1]:T?Vf(y,-1,g,w):[]},C=!!r&&r.covered.has(y.id);if(C&&(o.coveredWays++,dn(d.cycle,"laneRibbon"),T))for(let L of y.section.bands)L.kind==="cycle_lane"&&(o.lanes+=b_(d.cycle,y,L,_,r,e,i));for(let L of y.section.bands){if(E||C)break;d.stats.bands++;let H=d[L.surface];dn(H,"band"),dn(d.kerb,"band"),dn(d.bollard,"band");let k=L.kind==="carriageway"||L.kind==="cycle_lane",O=T?k?_:P[L.offset>0?1:-1]:A;if(r){let j=__(y,L,r.index);j.length&&(o.bandStations+=j.length,O=[...O,...j])}d.stats.trims+=O.length;let W=O.length?Pi(y.points,O).filter(j=>T||Gf(y,j)):[y.points],J=H.indices.length;if(L.raised>0){let j=At.raisedBase+L.raised;for(let te of W){if(te.length<2)continue;An(H,te,L.offset,L.width,e,j,{step:i,across:u(L.width)}),r&&(o.bandTris+=Hf(H,J,r.index,qn(y)));let me=L.offset-Math.sign(L.offset||1)*L.width/2;L.kerb==="both"?(rl(d.kerb,te,L.width/2,e,j,0,1,{step:i}),rl(d.kerb,te,-L.width/2,e,j,0,-1,{step:i})):rl(d.kerb,te,me,e,j,0,L.offset>0?-1:1,{step:i});let Oe=Math.sign(L.offset||1);L.kerb==="both"?(An(d.kerb,te,L.width/2-.075,.15,e,j+.002,{step:i}),An(d.kerb,te,-L.width/2+.075,.15,e,j+.002,{step:i})):L.kerb!=="none"&&An(d.kerb,te,me+Oe*.075,.15,e,j+.002,{step:i}),t.canalSide&&L.kind==="sidewalk"&&L.kerb!=="none"&&T_(d.bollard,te,L.kerb==="both"?L.width/2-.3:me+Oe*.3,e,j,t.canalSide);let et=te.length,He=Xn(te[0],te[1]),Z=Xn(te[et-2],te[et-1]);yu(d.kerb,te[0],He,L.offset,L.width,e,j,0,!1),yu(d.kerb,te[et-1],Z,L.offset,L.width,e,j,0,!0)}continue}let Q=L.kind==="carriageway"?At.carriageway:L.kind==="cycle_lane"?At.cycleLane:At.path;for(let j of W)j.length<2||An(H,j,L.offset,L.width,e,Q,{step:i,across:u(L.width)});if(r&&(o.bandTris+=Hf(H,J,r.index,qn(y))),!T&&L.offset===0)for(let j of[y.points[0],y.points[y.points.length-1],...y.points]){let te=g.get(Li(j));if(!te||te.ways.size<2||te.arms.length||r&&r.index.classAt(j[0],j[1],qn(y))!==null)continue;let me=`${Li(j)}:${L.surface}:${L.width.toFixed(1)}`;if(p.has(me))continue;p.add(me);let Oe=Math.min(L.width/2,1.6);if(r&&v_(j,Oe,r.index,qn(y))){o.discs++;continue}Af(H,j,Oe,e,Q-.001,12)}}dn(d.paint,"bandPaint");for(let L of y.section.paint){if(!L.mapped&&!s)continue;let H=y.section.bands.find(Q=>Math.abs(L.offset-Q.offset)<=Q.width/2+.01)??y.section.bands[0],k=H.kind==="carriageway"||H.kind==="cycle_lane",O=E?[]:T?k?_.map(([Q,j])=>[Q-.3,j+.3]):P[H.offset>0?1:-1]:A;if(f&&T&&k&&!E){let Q=E_(y,g,w,f);Q.length&&(o.crossCuts+=Q.length,O=[...O,...Q])}let W=k||E?a:(H.raised>0?At.raisedBase+H.raised:At.path)+.006,J=c(y);for(let Q of O.length?Pi(y.points,O).filter(j=>T||Gf(y,j)):[y.points])Q.length>=2&&(o.paint+=Qf(d.paint,Q,L.offset,L.width,L.dash,e,W,J))}let I=r&&y.section.rails?.length?M_(y,r.index,qn(y)):null;I&&(o.rails+=I.dropped),dn(d.tram,"rails");for(let L of y.section.rails??[])for(let H of[-.7175,.7175])for(let k of I?I.pieces:[y.points])k.length>=2&&An(d.tram,k,L+H,i_,e,l,{step:i});dn(d.cycle,"cycleCross"),dn(d.paint,"cycleCross"),t.markings!==!1&&!T&&y.section.bands[0]?.kind==="cycleway"&&!_u(y)&&(d.stats.markings.blocks+=y_(d,y,g,w,e,r,s))}for(let y of g.values()){if(y.kind==="junction"&&(d.junctionPoints.push(y.p),d.junctionReach.push(1+Math.max(0,...y.arms.map(T=>Math.max(T.left,T.right))))),y.kind==="none"||!y.polygon.length)continue;for(let T of["asphalt","klinker","cycle","paving","gravel","kerb"])dn(d[T],"junctionFill");dn(d.paint,"bandPaint");let w=x.get(y.owner);if(!w||t.only&&!t.only(w))continue;let E=h(y.p);if(E)o.fills++;else{let _=y.arms.reduce((A,P)=>P.left+P.right>A.left+A.right?P:A,y.arms[0]).way.section.bands[0].surface;Jf(d[_],y.polygon,e,At.carriageway,i)}if(y.kind==="junction"){if(d.stats.junctions++,!E)for(let T of y.corners)d.stats.corners+=A_(d,y,T,e,i);dn(d.cycle,"band"),t.markings!==!1&&g_(d,y,v,M,e,r&&E?r:null,s)}}return d}function m_(n){let e=[];for(let t=n.i;t>=0&&t<n.way.points.length;t+=n.sign)e.push(n.way.points[t]);return e}function g_(n,e,t,i,r,s,o=sl){let a=n.stats.markings,l=s?(f,u)=>Mu&&s.index.onRoad(f,u):void 0,c=t.some(f=>Math.hypot(f[0]-e.p[0],f[1]-e.p[1])<=Pf);if(o)for(let f of e.arms){let u=f.way.tags.highway??"",d=Math.max(0,...e.arms.filter(C=>C.way!==f.way).map(C=>ol(C.way.tags.highway))),g=kf(u,d,c);if(!g||qn(f.way))continue;let x=f.way.section.bands[0].width,p=f.way.tags.oneway==="yes"?1:f.way.tags.oneway==="-1"?-1:0;if(p&&p===f.sign)continue;let[m,v]=p?[-x/2+.1,x/2-.1]:[.15,x/2-.1],M=m_(f),y=Zt(M),w=y[y.length-1],E=f.trim+.5;for(let C of i)for(let I=0;I+1<C.points.length;I++){let L=Uf(M,C.points[I],C.points[I+1]);L!==null&&L<=f.trim+Lf&&(E=Math.max(E,L+C.section.coreHalfWidth+.5))}if(E+1>w)continue;let T=ot(M,y,E),_=ot(M,y,Math.min(w,E+1)),A=Xn(T,_),P=s?Os.paint:At.paint;if(g==="stop")Ff(n.paint,{o:T,u:A},m,v,If,r,P,l)&&a.stopLines++;else{let C=Df(n.paint,{o:T,u:A},m,v,r,P,l);a.teeth+=C,C&&a.giveWays++}}if(s)return;let h=(f,u)=>f.way.section.bands.find(d=>d.kind==="cycle_lane"&&(f.sign>0==(u==="left")?d.offset>0:d.offset<0));for(let f of e.arms)for(let u of e.arms){if(f===u||180-Math.abs(((f.angle-u.angle)*180/Math.PI+540)%360-180)>jf)continue;let g=h(f,"left"),x=h(u,"right");if(!g||!x)continue;let p=sn(f.dir),m=sn(u.dir),v=Math.abs(g.offset),M=Math.abs(x.offset),y=Math.min(g.width,x.width),w=[e.p[0]+f.dir[0]*f.trim+p[0]*v,e.p[1]+f.dir[1]*f.trim+p[1]*v],E=[e.p[0]+u.dir[0]*u.trim-m[0]*M,e.p[1]+u.dir[1]*u.trim-m[1]*M];bu(n.cycle,w,E,y,r,At.cycleLane),a.laneLinks++;let T=(u.angle-f.angle+2*Math.PI)%(2*Math.PI),_=e.arms.some(L=>L!==f&&L!==u&&(L.angle-f.angle+2*Math.PI)%(2*Math.PI)<T-1e-6&&(L.angle-f.angle+2*Math.PI)%(2*Math.PI)>1e-6),A=Xn(w,E),P=[-A[1],A[0]],C=y/2-Zf,I=L=>[[w[0]+P[0]*L,w[1]+P[1]*L],[E[0]+P[0]*L,E[1]+P[1]*L]];if(o)if(_){for(let L of[C,-C]){let[H,k]=I(L);a.blocks+=xu(n.paint,H,k,r,At.paint)}a.cycleCrossings++}else{let L=[C,-C].reduce((H,k)=>{let[O]=I(k),W=Math.hypot(O[0]-e.p[0],O[1]-e.p[1]);return W<H.d?{k,d:W}:H},{k:C,d:1/0}).k;Qf(n.paint,I(L),0,.1,[1,1],r,At.paint)}}}var Zf=.2;function y_(n,e,t,i,r,s,o=sl){let a=0,l=e.section.bands[0].width,c=e.points.length-1;return e.points.forEach((h,f)=>{if(f===0||f===c)return;let u=t.get(Li(h));if(!u||!u.arms.length||u.arms.every(w=>w.way===e))return;let d=Math.min(u.roadHalf+.15,12),g=ot(e.points,i,Math.max(0,i[f]-d)),x=ot(e.points,i,Math.min(i[c],i[f]+d)),p=Xn(g,x),m=[-p[1],p[0]],v=Math.max(.3,l/2-Zf),M=!!s&&s.index.find(h[0],h[1])>=0;if(M&&!s.index.onRoad((g[0]+x[0])/2,(g[1]+x[1])/2))return;!M&&Math.max(...u.arms.map(w=>ol(w.way.tags.highway)))<=2&&bu(n.cycle,g,x,l,r,At.cycleLane);let y=s?(w,E)=>Mu&&s.index.onRoad(w,E):void 0;if(o)for(let w of[v,-v])a+=xu(n.paint,[g[0]+m[0]*w,g[1]+m[1]*w],[x[0]+m[0]*w,x[1]+m[1]*w],r,s?Os.paint:At.paint,void 0,void 0,y);n.stats.markings.cycleCrossings++}),a}var x_=2;function b_(n,e,t,i,r,s,o){let a=r.index,l=qn(e),c=t.offset>0?1:-1,h=r.evidence?(r.evidence.lanes.get(e.id)??[]).filter(d=>d.side===c).map(d=>[d.s0,d.s1]):null;if(h&&!h.length)return 0;let f=t.width/2+x_,u=0;for(let d of i.length?Pi(e.points,i):[e.points])if(!(d.length<2))for(let g of Kf(d,2)){let x=Zt(g),p=x[x.length-1]/2,m=ot(g,x,p),v=ot(g,x,Math.min(x[x.length-1],p+.5)),M=ot(g,x,Math.max(0,p-.5)),y=Xn(M,v),w=sn(y),E=[m[0]+w[0]*t.offset,m[1]+w[1]*t.offset],T=!1;for(let _=-f;_<=f+1e-6&&!T;_+=.5)for(let A of[-.8,0,.8])if(a.classAt(E[0]+w[0]*_+y[0]*A,E[1]+w[1]*_+y[1]*A,l)==="cycle"){T=!0;break}if(!a.onRoad(E[0],E[1],l)||T||h&&!Bf(h,Of(e.points,m))){u++;continue}An(n,g,t.offset,t.width,s,Os.lane,{step:o})}return u}function Kf(n,e){let t=Zt(n),i=t[t.length-1];if(i<=e)return[[...n]];let r=[];for(let s=e;s<i;s+=e)r.push([s,s]);return Pi(n,r)}function __(n,e,t){let i=Zt(n.points),r=i[i.length-1],s=qn(n),o=[];for(let a=0;a<=r;a+=1){let l=Math.min(a,r),c=ot(n.points,i,l),h=ot(n.points,i,Math.min(r,l+.5)),f=ot(n.points,i,Math.max(0,l-.5)),u=sn(Xn(f,h));[0,1/6,-1/6,1/3,-1/3].some(d=>t.classAt(c[0]+u[0]*(e.offset+d*e.width),c[1]+u[1]*(e.offset+d*e.width),s)!==null)&&o.push([a-.5,a+.5])}return o}function v_(n,e,t,i){for(let r of[.5,1])for(let s=0;s<12;s++){let o=s/12*2*Math.PI;if(t.classAt(n[0]+Math.cos(o)*e*r,n[1]+Math.sin(o)*e*r,i)!==null)return!0}return!1}function Hf(n,e,t,i){let r=n.indices,s=n.positions,o=e,a=0;for(let l=e;l<r.length;l+=3){let c=r[l]*3,h=r[l+1]*3,f=r[l+2]*3;if(t.classAt((s[c]+s[h]+s[f])/3,(s[c+1]+s[h+1]+s[f+1])/3,i)!==null){a++;continue}o!==l&&(r[o]=r[l],r[o+1]=r[l+1],r[o+2]=r[l+2]),o+=3}return r.length=o,a}function M_(n,e,t){let i=Zt(n.points),r=i[i.length-1],s=[],o=0;for(let a=0;a<=r;a+=1){let l=ot(n.points,i,Math.min(a,r)),c=e.classAt(l[0],l[1],t);c===null||c==="carriage"||(o++,s.push([a-.5,a+.5]))}return{pieces:s.length?Pi(n.points,s):[n.points],dropped:o}}function S_(n){let t=new Map;for(let i of n)if(cl(i))for(let r=0;r+1<i.points.length;r++){let s=i.points[r],o=i.points[r+1];for(let a=Math.floor(Math.min(s[0],o[0])/20);a<=Math.floor(Math.max(s[0],o[0])/20);a++)for(let l=Math.floor(Math.min(s[1],o[1])/20);l<=Math.floor(Math.max(s[1],o[1])/20);l++){let c=`${a}:${l}`;(t.get(c)??t.set(c,[]).get(c)).push({way:i,a:s,b:o})}}return{G:20,grid:t}}var w_=20;function E_(n,e,t,i){let r=new Set([n.id]);for(let l of n.points)for(let c of e.get(Li(l))?.ways??[])r.add(c);let s=t[t.length-1],o=Math.sin(w_*Math.PI/180),a=[];for(let l=0;l<=s;l+=1){let c=ot(n.points,t,Math.min(l,s)),h=ot(n.points,t,Math.min(s,l+.5)),f=ot(n.points,t,Math.max(0,l-.5)),u=Xn(f,h),d=!1,g=Math.floor(c[0]/i.G),x=Math.floor(c[1]/i.G);e:for(let p=g-1;p<=g+1;p++)for(let m=x-1;m<=x+1;m++)for(let v of i.grid.get(`${p}:${m}`)??[]){if(r.has(v.way.id))continue;let M=v.b[0]-v.a[0],y=v.b[1]-v.a[1],w=M*M+y*y;if(w<1e-6)continue;let E=Math.sqrt(w);if(Math.abs(Yf(u,[M/E,y/E]))<o)continue;let T=Math.max(0,Math.min(1,((c[0]-v.a[0])*M+(c[1]-v.a[1])*y)/w));if(Math.hypot(v.a[0]+M*T-c[0],v.a[1]+y*T-c[1])<=v.way.section.coreHalfWidth+1){d=!0;break e}}d&&a.push([l-.5,l+.5])}return a}function Jf(n,e,t,i,r){if(e.length<3)return;let s=e.flatMap(a=>[a[0],a[1]]),o=wn(s);o.length&&Dr(n,s,o,t,i,Math.max(2,r))}function Wf(n,e){let t=n.sign>0==(e==="left");return n.way.section.bands.filter(i=>i.kind!=="carriageway"&&i.kind!=="cycle_lane"&&(t?i.offset>0:i.offset<0)).sort((i,r)=>Math.abs(i.offset)-Math.abs(r.offset))}function A_(n,e,t,i,r){let s=Wf(t.a,"left"),o=Wf(t.b,"right"),a=Math.min(s.length,o.length),l=0;for(let c=0;c<a;c++){let h=s[c],f=o[c],u=Math.abs(h.offset)-h.width/2-t.a.left,d=Math.abs(f.offset)-f.width/2-t.b.right,g=t.a.left+Math.max(0,u),x=g+h.width,p=t.b.right+Math.max(0,d),m=p+f.width,v=vu(t.a.dir,g,t.b.dir,p),M=vu(t.a.dir,x,t.b.dir,m);if(!v||!M||v.t<0||v.s<0)continue;let y=sn(t.a.dir),w=sn(t.b.dir),E=e.p,T=(L,H,k,O)=>[E[0]+L[0]*k+H[0]*O,E[1]+L[1]*k+H[1]*O],_=t.a.cornerLeft??v.t,A=t.b.cornerRight??v.s,P=[T(t.a.dir,y,_,g),T(t.a.dir,y,_,x),T(t.a.dir,y,M.t,x),T(t.b.dir,w,A,-m),T(t.b.dir,w,A,-p),T(t.a.dir,y,v.t,g)],C=P.filter((L,H)=>{let k=P[(H+P.length-1)%P.length];return Math.hypot(L[0]-k[0],L[1]-k[1])>.02}),I=Math.min(h.raised,f.raised);Jf(n[h.surface],C,i,I>0?At.raisedBase+I:At.path,r),l++}return l}function T_(n,e,t,i,r,s){let o=Zt(e),a=o[o.length-1];for(let l=.8;l<a-.4;l+=1.6){let c=ot(e,o,l),h=ot(e,o,Math.min(a,l+.3)),f=Xn(c,h),u=sn(f),d=c[0]+u[0]*t,g=c[1]+u[1]*t;if(!s(d,g))continue;let x=i(d,g)+r,p=x+.8,m=.05,v=[[d-f[0]*m-u[0]*m,g-f[1]*m-u[1]*m],[d+f[0]*m-u[0]*m,g+f[1]*m-u[1]*m],[d+f[0]*m+u[0]*m,g+f[1]*m+u[1]*m],[d-f[0]*m+u[0]*m,g-f[1]*m+u[1]*m]],M=n.positions.length/3;for(let[w,E]of v)n.positions.push(w,E,x,w,E,p),n.uvs.push(w,E,w,E);let y=n.positions.length/3;n.positions.push(d,g,p+.06),n.uvs.push(d,g);for(let w=0;w<4;w++){let E=M+w*2,T=M+(w+1)%4*2;n.indices.push(E,T,T+1,E,T+1,E+1,E+1,T+1,y)}}}var Xn=(n,e)=>{let t=e[0]-n[0],i=e[1]-n[1],r=Math.hypot(t,i)||1;return[t/r,i/r]};function Qf(n,e,t,i,r,s,o,a){if(!r&&!a)return An(n,e,t,i,s,o,{step:3}),0;let l=r?(()=>{let h=Zt(e),f=h[h.length-1],[u,d]=r,g=[];for(let x=u;x<f;x+=u+d)g.push([x,x+d]);return Pi(e,g)})():Kf(e,2),c=0;for(let h of l){if(a){let f=Zt(h),u=f[f.length-1]/2,d=ot(h,f,u),g=ot(h,f,Math.min(f[f.length-1],u+.3)),x=ot(h,f,Math.max(0,u-.3)),p=sn(Xn(x,g));if(!a(d[0]+p[0]*t,d[1]+p[1]*t)){c++;continue}let m=f[f.length-1],v=w=>{let E=ot(h,f,w);return a(E[0]+p[0]*(t-i/2),E[1]+p[1]*(t-i/2))&&a(E[0]+p[0]*(t+i/2),E[1]+p[1]*(t+i/2))},M=0,y=m;for(;M<u&&!v(M);)M+=.1;for(;y>u&&!v(y);)y-=.1;if(M>0||y<m){let w=Pi(h,[[-1,M],[y,m+1]])[0];w&&w.length>=2&&An(n,w,t,i,s,o,{step:3});continue}}An(n,h,t,i,s,o,{step:3})}return c}function ep(n,e){let t=Et();return n.polygons.forEach((i,r)=>{let s=[],o=[],a=n.levels?.[r]??e;i.forEach((h,f)=>{f&&o.push(s.length/2);for(let u of h)s.push(u[0],u[1])});let l=t.positions.length/3;for(let h=0;h<s.length;h+=2)vt(t,s[h],s[h+1],a);let c=wn(s,o,2);for(let h=0;h<c.length;h+=3){let f=c[h],u=c[h+1],d=c[h+2],g=(s[u*2]-s[f*2])*(s[d*2+1]-s[f*2+1])-(s[u*2+1]-s[f*2+1])*(s[d*2]-s[f*2])>0;t.indices.push(l+f,l+(g?u:d),l+(g?d:u))}}),t}var tr={coping:[.64,.61,.56],brick:[.48,.35,.29],algae:[.24,.29,.25]};function tp(n,e,t,i=2,r=0,s){let o=Et(!0);for(let a=0;a<n.shores.length;a++){let l=n.shores[a],c=n.shoreLevels?.[a]??t,h=il(l,i);for(let f=0;f+1<h.length;f++){let u=h[f],d=h[f+1],g=d[0]-u[0],x=d[1]-u[1],p=Math.hypot(g,x);if(p<.001||s?.((u[0]+d[0])/2,(u[1]+d[1])/2))continue;let m=x/p,v=-g/p,M=Math.max(e(u[0]+m*.5,u[1]+v*.5),e(u[0],u[1])),y=Math.max(e(d[0]+m*.5,d[1]+v*.5),e(d[0],d[1]));if(Math.max(M,y)<c+.15)continue;let w=A=>{let P=Math.max(A-.25,c+.36),C=c+.35;return[A,Math.min(A,P),Math.min(A,C),c-.25]};if(r>0){let A=[u[0]+m*r,u[1]+v*r],P=[d[0]+m*r,d[1]+v*r],C=Math.max(M,e(A[0],A[1]))+.012,I=Math.max(y,e(P[0],P[1]))+.012,L=vt(o,u[0],u[1],M+.012,tr.coping),H=vt(o,d[0],d[1],y+.012,tr.coping),k=vt(o,P[0],P[1],I,tr.coping),O=vt(o,A[0],A[1],C,tr.coping);o.indices.push(L,k,H,L,O,k)}let E=w(M+(r>0?.012:0)),T=w(y+(r>0?.012:0)),_=[tr.coping,tr.brick,tr.algae];for(let A=0;A<3;A++){if(E[A]-E[A+1]<.001&&T[A]-T[A+1]<.001)continue;let P=vt(o,u[0],u[1],E[A],_[A]),C=vt(o,d[0],d[1],T[A],_[A]),I=vt(o,d[0],d[1],T[A+1],_[A]),L=vt(o,u[0],u[1],E[A+1],_[A]);o.indices.push(P,I,L,P,C,I)}}}return o}function np(n,e,t){return[n.origin[0]+e/n.metresPerDegree[0],n.origin[1]+t/n.metresPerDegree[1]]}function ip(n,e,t){return[(e-n.origin[0])*n.metresPerDegree[0],(t-n.origin[1])*n.metresPerDegree[1]]}function R_(n,e){return`${n}_${e}`}function rp(n,e,t,i){let r=n.cellSizeM,s=[];for(let[o,a]of n.cells){let l=Math.max(o*r,Math.min(e,(o+1)*r)),c=Math.max(a*r,Math.min(t,(a+1)*r));Math.hypot(l-e,c-t)<=i&&s.push(R_(o,a))}return s}function sp(n){let e=n;if(!e||e.version!==1||!Array.isArray(e.cells)||!Array.isArray(e.origin)||!Array.isArray(e.metresPerDegree)||!(e.cellSizeM>0)||!(e.quayFreeboardM>0&&e.quayFreeboardM<6))throw new Error("Invalid canal elevation index");return e}var op=-1.77,Su=()=>0;function ap(n){for(let e of vf){let[t,i]=$t(e.lng,e.lat);if(Math.abs(n[0]-t)<=e.halfM&&Math.abs(n[1]-i)<=e.halfM)return e}return null}var ul={asphalt:"#5f6266",klinker:"#8e6b5c",cycle:"#a5544b",paving:"#b9b0a2",gravel:"#ab9f88",paint:"#f1efe6",kerb:"#9c978e",park:"#9cbf78",wood:"#7fa262",square:"#c7beb0",parking:"#8f9094",water:"#3f6b78",quay:"#7a5a49"};function hl(n,e,t){if(!n.indices.length)return null;let i=new Dt;i.setAttribute("position",new rt(Float32Array.from(n.positions),3)),i.setIndex(new rt(Uint32Array.from(n.indices),1)),n.colors&&i.setAttribute("color",new rt(Float32Array.from(n.colors,s=>s**2.2),3)),i.computeVertexNormals();let r=new lt(i,new ss({color:n.colors?"#ffffff":e,vertexColors:!!n.colors}));return r.renderOrder=t,r}function lp(n,e){let t=(s,o)=>{let[a,l]=np(n,s,o);return $t(a,l)},i=n.quantization.xy,r={polygons:[],shores:[]};for(let s of e){let o=s.cell[0]*n.cellSizeM,a=s.cell[1]*n.cellSizeM,l=c=>{let h=[];for(let f=0;f<c.length;f+=2)h.push(t(o+c[f]*i,a+c[f+1]*i));return h};for(let c of s.water)r.polygons.push(c.map(l));for(let c of s.shore)r.shores.push(l(c))}return r}function cp(n,e,t,i){let r=performance.now(),s=p=>Math.hypot(p[0]-t[0],p[1]-t[1])<i,o=p=>$t(p[0],p[1]),a=new _n,l=p=>{p&&a.add(p)},c=0,h={park:Et(),wood:Et(),square:Et(),parking:Et()};for(let p of n.areas){let m=p.kind==="grass"?h.park:p.kind==="paved"?h.square:h[p.kind];if(m)for(let v of p.rings){let M=v.slice(0,-1).map(o);if(M.length<3||!M.some(s))continue;let y=M.flatMap(w=>[w[0],w[1]]);Dr(m,y,wn(y),Su,At.area,8)}}for(let[p,m]of Object.entries(h))c+=Nr(m),l(hl(m,ul[p],20));let f=qf(n.ways,o).filter(p=>p.points.some(s)),u=$f(f,Su,{step:6});for(let p of["paving","klinker","asphalt","cycle","gravel","kerb","paint"])c+=Nr(u[p]),l(hl(u[p],ul[p],21));let d={polygons:e.polygons.filter(p=>p[0].some(s)),shores:e.shores.flatMap(p=>{let m=[[]];for(let v of p)s(v)?m[m.length-1].push(v):m[m.length-1].length&&m.push([]);return m.filter(v=>v.length>1)})},g=ep(d,op),x=tp({polygons:[],shores:d.shores},Su,op,4);return c+=Nr(g)+Nr(x),l(hl(g,ul.water,19)),l(hl(Tf([x]),ul.quay,19)),{group:a,stats:{box:n.box,ways:f.length,triangles:c,buildMs:Math.round(performance.now()-r)}}}function Bs(n){let e=0;for(let t=1;t<n.length;t++)e+=Math.hypot(n[t][0]-n[t-1][0],n[t][1]-n[t-1][1]);return e}Pt.DEFAULT_UP.set(0,0,1);var ki="../data/extracts/amsterdam",Rn=new URLSearchParams(location.search),Fr=(n,e)=>Rn.get(n)===null?e:Rn.get(n)!=="0",C_=matchMedia("(pointer: coarse)").matches,gt={view:Rn.get("view")??"city",route:Rn.get("route")??"game-desktop",path:Fr("path",!1),near:Fr("near",!0),mini:Fr("mini",!0),hud:Fr("hud",!0),worker:Fr("worker",!0),dpr:Number(Rn.get("dpr"))||Math.min(devicePixelRatio||1,C_?1.5:2),labelsAll:Rn.get("labels")==="all",quiet:Fr("quiet",!1),ask:Rn.get("ask")??"Kinkerstraat"},P_=["Nassaukade","Bilderdijkstraat","Kinkerstraat","Singelgracht","Prinsengracht","Herengracht","Keizersgracht","Singel","Leidsestraat","Overtoom","Marnixstraat","Rozengracht","Raadhuisstraat","Damrak","Rokin","Stadhouderskade","Amstel","Kostverlorenvaart","Da Costakade","Jan Pieter Heijestraat","Bilderdijkkade","Hugo de Grootkade","Leidsegracht","Vijzelstraat","Weteringschans","Wibautstraat"],up=new Set((Rn.get("learned")??P_.join(",")).split(",").map(n=>n.trim()).filter(Boolean)),mn={bytes:{},ms:{}},Ur=mn.bytes,Tn=mn.ms,It={ready:!1,status:mn,frames:[],renderMs:[],labelMs:[],labelCounts:[],info:{calls:0,triangles:0},labelWorst:null,labelCount:0,everPlaced:new Set,placed:[],cam:null,setCamera:n=>{Xe=n},setView:n=>Du(n),project:(n,e)=>Zi(cn(Xe,Hr()),$t(n,e)),unproject:(n,e)=>{let t=rn(cn(Xe,Hr()),n,e);return t?Ti(t[0],t[1]):null},opts:gt};window.__ownMap=It;var ml=document.getElementById("gl"),zs=document.getElementById("overlay"),Or=document.getElementById("minimap"),L_=document.getElementById("hud"),Ce=zs.getContext("2d"),wu=Or.getContext("2d");gt.hud||(L_.hidden=!0);gt.mini||(Or.hidden=!0);var Hr=()=>({width:ml.clientWidth||innerWidth,height:ml.clientHeight||innerHeight}),Ii=new Va({canvas:ml,antialias:!0});Ii.setPixelRatio(gt.dpr);Ii.setClearColor(hn.land);Ii.info.autoReset=!1;var Yn=new ts,si=new zt(36.87,1,1,1e5);Yn.add(new ls("#ffffff","#b8b0a4",1.4));var xp=new us("#ffffff",1.6);xp.position.set(-300,-400,700);Yn.add(xp);var Xe={center:$t(4.8936,52.3702),zoom:11.5,bearing:0,pitch:0},Cu={minZoom:9.5,maxZoom:20,maxPitch:70};async function Wr(n,e,t){let i=await fetch(n);if(!i.ok||t&&!t.test(i.headers.get("content-type")??""))throw new Error(`${n}: ${i.status} ${i.headers.get("content-type")}`);let r=new Uint8Array(await i.arrayBuffer()),s=performance.getEntriesByName(new URL(n,location.href).href).pop();return Ur[e]=(Ur[e]??0)+(s&&s.transferSize>0?s.transferSize:r.length),Ur[`${e}Decoded`]=(Ur[`${e}Decoded`]??0)+r.length,r}async function Gs(n){let e=n[0]===31&&n[1]===139?await new Response(new Blob([n]).stream().pipeThrough(new DecompressionStream("gzip"))).text():new TextDecoder().decode(n);return JSON.parse(e)}var Vs=async(n,e)=>{let t=performance.now(),i=await e();return Tn[n]=Math.round(performance.now()-t),i},fn,bp=[],Eu,Au,pn=[],oi=null,qt={at:$t(4.8745,52.3729),bearing:40},Pu=[],Lu=null;async function I_(){let n=performance.now(),e=await Vs("fetchOverview",()=>Wr(`${ki}/own-map-v1/overview.json.gz`,"overview")),t=await Vs("inflateParse",()=>Gs(e));fn=await Vs("decode",()=>Rd(t)),await Vs("buildMeshes",()=>{Eu=new lt(nu(fn.water),tu(hn.water,0)),Eu.renderOrder=2,Au=new lt(nu(fn.parks.flatMap(r=>r.rings.map(s=>[s]))),tu(hn.park,0)),Au.renderOrder=1,Yn.add(Au,Eu);let i=[...Bc].sort((r,s)=>Wn[r].order-Wn[s].order);for(let r of i){let s=iu(fn.streets.filter(c=>c.cls===r).map(c=>c.points)),o=Wn[r],a=new lt(s,Ns(o.fill,0));a.renderOrder=20+o.order,a.frustumCulled=!1;let l=null;o.casing&&(l=new lt(s,Ns(o.casing,0)),l.renderOrder=10+o.order,l.frustumCulled=!1,Yn.add(l)),Yn.add(a),bp.push({cls:r,fill:a,casing:l})}}),Tn.overviewTotal=Math.round(performance.now()-n),mn.overview={water:fn.water.length,parks:fn.parks.length,streets:fn.streets.length}}async function k_(){let n=performance.now(),e=await(await fetch(`${ki}/building-overview/index.json`)).json(),t=e.zoom,i=h=>Math.floor((h+180)/360*2**t),r=h=>Math.floor((1-Math.log(Math.tan(Math.PI/4+h*Math.PI/360))/Math.PI)/2*2**t),[s,o,a,l]=e.bounds,c=[];for(let h=i(s);h<=i(a-1e-9);h++)for(let f=r(l);f<=r(o+1e-9);f++)c.push((async()=>{let u,d;try{u=await Wr(`${ki}/building-overview/${t}/${h}/${f}.png`,"buildingRaster",/image/),d=await createImageBitmap(new Blob([u],{type:"image/png"}),{imageOrientation:"flipY"})}catch{return}let g=new Gt(d);g.flipY=!1,g.generateMipmaps=!0,g.minFilter=zn,g.anisotropy=4,g.needsUpdate=!0;let x=new lt(Zd(t,h,f,$t),Kd(g,hn.building,0));x.renderOrder=5,x.frustumCulled=!1,Pu.push(x),Yn.add(x)})());await Promise.all(c),Tn.buildingRaster=Math.round(performance.now()-n),mn.buildingRasterTiles=Pu.length}async function N_(){let n=null;try{let r=await fetch(`own-map-fixtures/route-${gt.route}.json`);r.ok&&(n=await r.json())}catch{}pn=(n?.path??[[4.8837,52.3747],[4.8833,52.3693],[4.8826,52.3641]]).map(([r,s])=>$t(r,s));let t=Rn.get("rider")?.split(",").map(Number);if(t&&t.length>=2)qt={at:$t(t[0],t[1]),bearing:t[2]??0};else{let[r,s]=pn;qt={at:r,bearing:s?(Math.atan2(s[0]-r[0],s[1]-r[1])*180/Math.PI+360)%360:0}}let i=iu([pn]);oi={casing:new lt(i,Ns("#03121c",.3)),line:new lt(i,Ns(hn.route,.32))},oi.casing.renderOrder=40,oi.line.renderOrder=41;for(let r of[oi.casing,oi.line])r.frustumCulled=!1,r.material.uniforms.uNear={value:0},Yn.add(r);oi.casing.material.uniforms.uOpacity.value=.75,mn.route={points:pn.length,lengthM:Math.round(Bs(pn)),fixture:!!n}}var hp="#e3dcd2",dp="#cbbfb2",Tu=new Map,dl=new _n;Yn.add(dl);var Vr=null,D_=0,Iu=new Map;if(gt.worker)try{Vr=new Worker(new URL("js/own-map-footprints.worker.js",location.href)),Vr.onmessage=n=>{Iu.get(n.data.id)?.(n.data),Iu.delete(n.data.id)}}catch{Vr=null}mn.footprintWorker=!!Vr;async function F_(n){let e=new URL(`${ki}/building-tiles/14/${n}.geojson.gz`,location.href).href;if(Vr){let s=++D_,o=await new Promise(c=>{Iu.set(s,c),Vr.postMessage({id:s,url:e,top:hp,wall:dp})});if(!o.ok)throw new Error(o.error);Ur.buildingTiles=(Ur.buildingTiles??0)+o.bytes,Tn.footprintWorkerBuild=(Tn.footprintWorkerBuild??0)+Math.round(o.buildMs);let a=performance.now(),l=ru(o);return Tn.footprintBuild=(Tn.footprintBuild??0)+Math.round(performance.now()-a),l}let t=await Gs(await Wr(e,"buildingTiles")),i=performance.now(),r=Jd(t.features,$t,hp,dp);return Tn.footprintBuild=(Tn.footprintBuild??0)+Math.round(performance.now()-i),r}function U_(n){if(Xe.zoom<rf){dl.visible=!1;return}dl.visible=!0;let e=Qd(n).slice(0,16);for(let t of e)Tu.has(t)||(Tu.set(t,null),(async()=>{try{let i=new lt(await F_(t),new Xi({vertexColors:!0}));i.renderOrder=50,Tu.set(t,i),dl.add(i)}catch{}})())}var ku=550,Gr=null,Ru=!1;async function _p(){if(Gr||Ru||!gt.near)return;let n=ap(qt.at);if(!n){mn.nearField="no own-ground extract here";return}Ru=!0;let e=performance.now(),t=await Gs(await Wr(`${ki}/own-ground-osm-v1/${n.id}.json`,"nearField")),i=sp(await(await fetch(`${ki}/elevation-v1/index.json`)).json()),[r,s]=Ti(qt.at[0],qt.at[1]),[o,a]=ip(i,r,s),l=(await Promise.all(rp(i,o,a,ku+200).map(async h=>{try{return await Gs(await Wr(`${ki}/elevation-v1/cells/${h}.json`,"nearField"))}catch{return null}}))).filter(Boolean),c=cp(t,lp(i,l),qt.at,ku);Gr=c.group,Yn.add(Gr),mn.nearField={...c.stats,loadMs:Math.round(performance.now()-e)},Ru=!1}var fl={isLabelled:gt.labelsAll?()=>!0:n=>up.has(n),hiddenName:gt.ask,spoilerIndex:Fs([...up,gt.ask]),quizQuiet:gt.quiet},Br=500,Nu=new Map,O_={major:12.5,secondary:13.5,tertiary:14.5,minor:15.3,service:16.8,cycle:16.3,path:17};function pl(n){let e=n.path??[n.at],t=new Set(e.map(([i,r])=>`${Math.floor(i/Br)},${Math.floor(r/Br)}`));for(let i of t){let r=Nu.get(i);r?r.push(n):Nu.set(i,[n])}}var nr={street:0,water:0,poi:0,hood:0,withheld:0};function B_(){fn.streets.forEach((n,e)=>{if(!n.name)return;let t=n.points[n.points.length>>1];if(!fu(fl,n.name,t[0],t[1])){n.name===gt.ask&&nr.withheld++;return}nr.street++,pl({id:`s${e}`,text:n.name,kind:"street",priority:(Wn[n.cls].order+1)*1e3+Math.min(999,Bs(n.points)/10),path:n.points,minZoom:O_[n.cls]})}),fn.waterLines.forEach((n,e)=>{let t=n.points[n.points.length>>1];if(!fu(fl,n.name,t[0],t[1])){n.name===gt.ask&&nr.withheld++;return}nr.water++,pl({id:`w${e}`,text:n.name,kind:"water",priority:8e3+Math.min(999,Bs(n.points)/10),path:n.points,minZoom:Bs(n.points)>1500?12.5:14.5})}),_f(fl)&&fn.hoods.forEach((n,e)=>{nr.hood++,pl({id:`h${e}`,text:n.name.toUpperCase(),kind:"hood",priority:9e3,at:n.at,minZoom:13,maxZoom:18.5})})}var fp=!1;async function vp(){if(fp)return;fp=!0;let n=await Gs(await Wr(`${ki}/orientation-pois.json`,"pois"));uf(n,t=>!au(fl,t)).features.forEach((t,i)=>{nr.poi++,pl({id:`p${i}`,text:t.properties.name,kind:"poi",priority:t.properties.rank,at:$t(t.geometry.coordinates[0],t.geometry.coordinates[1]),minZoom:16.5})})}var zr='"Helvetica Neue", Arial, sans-serif',Mp={street:{font:n=>`600 ${n}px ${zr}`,fill:"#34424d",halo:"rgba(255,255,255,.92)",haloWidth:1.8},water:{font:n=>`italic 500 ${n}px ${zr}`,fill:"#2f5f86",halo:"rgba(236,244,250,.9)",haloWidth:1.6},poi:{font:n=>`400 ${n}px ${zr}`,fill:"#34424d",halo:"rgba(255,255,255,.92)",haloWidth:1.6},hood:{font:n=>`700 ${n}px ${zr}`,fill:"#6D28D9",halo:"rgba(255,255,255,.9)",haloWidth:2}},Sp=(n,e)=>Math.round(n==="hood"?Ir([[13,11],[17,16]],e):n==="poi"?Ir([[16.5,10],[18,12]],e):Ir([[13,10.5],[16,12],[18,14.5]],e)),pp=new Map;function z_(n,e){let t=Math.round(Sp(e,Xe.zoom)),i=`${e}|${t}|${n}`,r=pp.get(i);return r===void 0&&(Ce.font=Mp[e].font(t),r=Ce.measureText(n).width+(e==="hood"?t*.12:0),pp.set(i,r)),r}function V_(n,e){let t=performance.now(),i=new Set;for(let a=Math.floor(e[0]/Br);a<=Math.floor(e[2]/Br);a++)for(let l=Math.floor(e[1]/Br);l<=Math.floor(e[3]/Br);l++)for(let c of Nu.get(`${a},${l}`)??[])(c.minZoom??0)<=Xe.zoom&&Xe.zoom<(c.maxZoom??99)&&i.add(c);let r=n.viewport,s=af([...i],{project:a=>Zi(n,a),width:r.width,height:r.height,zoom:Xe.zoom,advance:z_,fontSize:Sp,maxDepth:n.distance*4,repeatDistance:260});lf(Ce,s,Mp);let o=performance.now()-t;o>(It.labelWorst?.ms??0)&&(It.labelWorst={ms:Math.round(o),candidates:i.size,zoom:+Xe.zoom.toFixed(2),pitch:Math.round(Xe.pitch)}),It.labelCount=s.length,It.placed=s.map(a=>({text:a.text,kind:a.kind}));for(let a of s)It.everPlaced.add(a.text);It.labelMs.push(performance.now()-t),It.labelCounts.push(s.length)}function mp(n,e,t,i){Ce.save(),Ce.translate(n,e),Ce.fillStyle=t,Ce.strokeStyle="#fff",Ce.lineWidth=2.5,Ce.beginPath(),Ce.moveTo(0,0),Ce.bezierCurveTo(-12,-16,-12,-32,0,-32),Ce.bezierCurveTo(12,-32,12,-16,0,0),Ce.fill(),Ce.stroke(),Ce.fillStyle="#fff",Ce.beginPath(),Ce.arc(0,-21,4.5,0,Math.PI*2),Ce.fill(),Ce.font=`700 11px ${zr}`,Ce.textAlign="center",Ce.textBaseline="bottom",Ce.lineWidth=3,Ce.strokeStyle="rgba(7,30,43,.85)",Ce.strokeText(i,0,-36),Ce.fillStyle="#fff",Ce.fillText(i,0,-36),Ce.restore()}function G_(n){if(pn.length>1){let t=Zi(n,pn[0]),i=Zi(n,pn[pn.length-1]);i.depth>0&&mp(i.x,i.y,"#E11D48","DESTINATION"),t.depth>0&&Xe.zoom<16&&mp(t.x,t.y,"#16A34A","START")}let e=Zi(n,qt.at);e.depth>0&&(Ce.save(),Ce.translate(e.x,e.y),Ce.rotate((qt.bearing-Xe.bearing)*Math.PI/180),Ce.fillStyle="#0f172a",Ce.strokeStyle="#fff",Ce.lineWidth=2,Ce.beginPath(),Ce.moveTo(0,-10),Ce.lineTo(7,8),Ce.lineTo(0,4),Ce.lineTo(-7,8),Ce.closePath(),Ce.fill(),Ce.stroke(),Ce.restore()),Ce.font=`400 10px ${zr}`,Ce.textAlign="right",Ce.textBaseline="bottom",Ce.fillStyle="rgba(30,41,59,.7)",Ce.fillText("\xA9 OpenStreetMap contributors \xB7 BAG \xB7 own renderer",n.viewport.width-6,n.viewport.height-4)}function wp(){let[n,e,t,i]=fn?.bounds??[-15e3,-12e3,12e3,9e3],r=[[Math.max(n,-9e3),Math.max(e,-8e3)],[Math.min(t,9500),Math.min(i,6500)]];return Wc(r,Hr(),{padding:{top:30,bottom:30,left:20,right:20}})}function Fu(){let n=Hr(),e=pn.length>1?pn:[qt.at];return Wc(e,n,{padding:{top:Math.min(140,n.height*.18),bottom:Math.min(120,n.height*.15),left:56,right:56},maxZoom:16})}function H_(){let n=Fu();return{...n,zoom:Math.max(13.6,Math.min(14.6,n.zoom+1))}}function Ep(){return{center:qt.at,zoom:17.6,bearing:qt.bearing,pitch:55}}function Du(n){let e=Rn.get("cam")?.split(",").map(Number);if(n==="cam"&&e&&e.length>=3){Xe={center:$t(e[0],e[1]),zoom:e[2],pitch:e[3]??0,bearing:e[4]??0,fovDeg:e[5]};return}Xe=n==="route"?Fu():n==="district"?H_():n==="street"?Ep():wp(),Hs=null}var Hs=null;function W_(n){let e=wp(),t=Fu(),i=Ep();return n<2?e:n<7?qc(e,t,(n-2)/5):n<9?t:n<15?qc(t,i,(n-9)/6):{...i,bearing:i.bearing+(n-15)*8}}var gp=performance.now(),yp="";function Ap(n){if(requestAnimationFrame(Ap),It.frames.push(n-gp),gp=n,!It.ready)return;let e=performance.now();gt.path&&(Hs??=n,Xe=W_((n-Hs)/1e3)),Xe=Ki(Xe,{...Cu,maxPitch:Math.max(Cu.maxPitch,Xe.pitch)}),It.cam=Xe;let t=Hr(),i=cn(Xe,t);si.fov=Xe.fovDeg??36.86989764584402,si.aspect=t.width/t.height,si.near=Math.max(.5,i.distance*.02),si.far=i.distance*40,si.position.set(...i.eye),si.up.set(...i.up),si.lookAt(...i.target),si.updateProjectionMatrix();for(let h of bp){let f=Wn[h.cls],u=Ir(f.width,Xe.zoom),d=u>=ef;h.fill.visible=d,h.fill.material.uniforms.uHalf.value=u/2*i.mpp,h.fill.material.uniforms.uOpacity.value=Math.min(1,u/.9),h.casing&&(h.casing.visible=d&&u>1.2,h.casing.material.uniforms.uHalf.value=(u+f.casingExtra)/2*i.mpp)}if(oi){let h=Ir(tf,Xe.zoom);oi.line.material.uniforms.uHalf.value=h/2*i.mpp,oi.casing.material.uniforms.uHalf.value=(h+4)/2*i.mpp}let r=1-su(Xe.zoom,nf);for(let h of Pu)h.visible=r>.01,h.material.uniforms.uOpacity.value=r;let s=Hc(i,6e3),o=s.map(h=>Math.round(h/200)).join(",")+Math.floor(Xe.zoom*2);o!==yp&&(yp=o,U_(s));let a=su(Xe.zoom,sf);a>0&&_p(),Xe.zoom>=16.3&&vp(),ks.uRider.value.set(qt.at[0],qt.at[1]),ks.uNearR.value=ku,ks.uNear.value=Gr?a:0,Gr&&(Gr.visible=a>0),Ii.info.reset(),Ii.render(Yn,si),It.info={calls:Ii.info.render.calls,triangles:Ii.info.render.triangles};let l=gt.dpr;(zs.width!==Math.round(t.width*l)||zs.height!==Math.round(t.height*l))&&(zs.width=Math.round(t.width*l),zs.height=Math.round(t.height*l)),Ce.setTransform(l,0,0,l,0,0),Ce.clearRect(0,0,t.width,t.height),V_(i,Hc(i,Math.min(6e3,i.distance*4))),G_(i);let c=Or.clientWidth;gt.mini&&Lu&&c>=16&&(Or.width!==Math.round(c*l)&&(Or.width=Or.height=Math.round(c*l)),wu.setTransform(l,0,0,l,0,0),wu.clearRect(0,0,c,c),Lu.draw(wu,c,qt.at,qt.bearing,pn)),It.renderMs.push(performance.now()-e),gt.hud&&q_()}function q_(){let n=document.getElementById("stats");if(!n||It.frames.length%15)return;let e=It.renderMs.slice(-60).sort((t,i)=>t-i);n.textContent=`z ${Xe.zoom.toFixed(2)} \xB7 pitch ${Xe.pitch.toFixed(0)}\xB0 \xB7 ${It.labelCount} labels \xB7 ${It.info.calls} calls \xB7 cpu ${(e[e.length>>1]??0).toFixed(1)} ms`}function Tp(){let n=Hr();Ii.setSize(n.width,n.height,!1)}addEventListener("resize",Tp);async function X_(){let n=performance.now();Tp(),requestAnimationFrame(Ap);try{await Promise.all([I_(),N_()]),await Vs("labelCandidates",()=>B_()),mn.labels=nr,Lu=new el(fn),Du(Rn.get("cam")?"cam":gt.view),It.ready=!0,Tn.firstFrameReady=Math.round(performance.now()-n),await k_(),Tn.allLoaded=Math.round(performance.now()-n),Xe.zoom>=16&&(await _p(),await vp()),mn.loaded=!0}catch(e){mn.error=String(e?.stack??e),console.error(e)}Dd(ml,()=>Xe,e=>{Xe=e,Hs=null,gt.path=!1},Cu);for(let e of document.querySelectorAll("[data-view]"))e.onclick=()=>{gt.path=e.dataset.view==="path",Hs=null,gt.path||Du(e.dataset.view)}}X_();
/*! Bundled license information:

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/

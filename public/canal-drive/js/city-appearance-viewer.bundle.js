var pi={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},mi={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},ah=0,sc=1,lh=2;var Es=1,ia=2,Tr=3,bn=0,Jt=1,Ct=2,On=0,Ui=1,oc=2,ac=3,lc=4,ch=5;var ci=100,uh=101,hh=102,dh=103,fh=104,ph=200,mh=201,gh=202,_h=203,To=204,Eo=205,xh=206,yh=207,vh=208,bh=209,Mh=210,Sh=211,wh=212,Th=213,Eh=214,Ao=0,Ro=1,Co=2,Oi=3,Po=4,Io=5,Do=6,Lo=7,ra=0,Ah=1,Rh=2,wn=0,cc=1,uc=2,hc=3,As=4,dc=5,fc=6,pc=7;var mc=300,gi=301,Gi=302,sa=303,oa=304,Rs=306,Fo=1e3,Ln=1001,No=1002,Bt=1003,Ch=1004;var Cs=1005;var Dt=1006,aa=1007;var _i=1008;var Qt=1009,gc=1010,_c=1011,Er=1012,la=1013,Tn=1014,fn=1015,Bn=1016,ca=1017,ua=1018,Ar=1020,xc=35902,yc=35899,vc=1021,bc=1022,pn=1023,Fn=1026,xi=1027,ha=1028,da=1029,yi=1030,fa=1031;var pa=1033,Ps=33776,Is=33777,Ds=33778,Ls=33779,ma=35840,ga=35841,_a=35842,xa=35843,ya=36196,va=37492,ba=37496,Ma=37488,Sa=37489,Fs=37490,wa=37491,Ta=37808,Ea=37809,Aa=37810,Ra=37811,Ca=37812,Pa=37813,Ia=37814,Da=37815,La=37816,Fa=37817,Na=37818,Ua=37819,Oa=37820,Ba=37821,ka=36492,za=36494,Va=36495,Ga=36283,Ha=36284,Ns=36285,Wa=36286;var Jr=2300,Uo=2301,wo=2302,Xl=2303,ql=2400,Yl=2401,$l=2402;var Ph=3200;var Us=0,Ih=1,jn="",Ot="srgb",jr="srgb-linear",Qr="linear",lt="srgb";var Fi=7680;var Zl=519,Dh=512,Lh=513,Fh=514,Xa=515,Nh=516,Uh=517,qa=518,Oh=519,Kl=35044;var Mc="300 es",vn=2e3,fr=2001;function Zf(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function Kf(n){return ArrayBuffer.isView(n)&&!(n instanceof DataView)}function es(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function Bh(){let n=es("canvas");return n.style.display="block",n}var Lu={},pr=null;function Sc(...n){let e="THREE."+n.shift();pr?pr("log",e,...n):console.log(e,...n)}function kh(n){let e=n[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=n[1];t&&t.isStackTrace?n[0]+=" "+t.getLocation():n[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return n}function Be(...n){n=kh(n);let e="THREE."+n.shift();if(pr)pr("warn",e,...n);else{let t=n[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...n)}}function Ve(...n){n=kh(n);let e="THREE."+n.shift();if(pr)pr("error",e,...n);else{let t=n[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...n)}}function Ni(...n){let e=n.join(" ");e in Lu||(Lu[e]=!0,Be(...n))}function zh(n,e,t){return new Promise(function(i,r){function s(){switch(n.clientWaitSync(e,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:r();break;case n.TIMEOUT_EXPIRED:setTimeout(s,t);break;default:i()}}setTimeout(s,t)})}var Vh={[Ao]:Ro,[Co]:Do,[Po]:Lo,[Oi]:Io,[Ro]:Ao,[Do]:Co,[Lo]:Po,[Io]:Oi},Mn=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){let i=this._listeners;return i===void 0?!1:i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){let i=this._listeners;if(i===void 0)return;let r=i[e];if(r!==void 0){let s=r.indexOf(t);s!==-1&&r.splice(s,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let i=t[e.type];if(i!==void 0){e.target=this;let r=i.slice(0);for(let s=0,o=r.length;s<o;s++)r[s].call(this,e);e.target=null}}},Gt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Fu=1234567,Zr=Math.PI/180,mr=180/Math.PI;function Rr(){let n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Gt[n&255]+Gt[n>>8&255]+Gt[n>>16&255]+Gt[n>>24&255]+"-"+Gt[e&255]+Gt[e>>8&255]+"-"+Gt[e>>16&15|64]+Gt[e>>24&255]+"-"+Gt[t&63|128]+Gt[t>>8&255]+"-"+Gt[t>>16&255]+Gt[t>>24&255]+Gt[i&255]+Gt[i>>8&255]+Gt[i>>16&255]+Gt[i>>24&255]).toLowerCase()}function it(n,e,t){return Math.max(e,Math.min(t,n))}function wc(n,e){return(n%e+e)%e}function Jf(n,e,t,i,r){return i+(n-e)*(r-i)/(t-e)}function jf(n,e,t){return n!==e?(t-n)/(e-n):0}function Kr(n,e,t){return(1-t)*n+t*e}function Qf(n,e,t,i){return Kr(n,e,1-Math.exp(-t*i))}function ep(n,e=1){return e-Math.abs(wc(n,e*2)-e)}function tp(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*(3-2*n))}function np(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*n*(n*(n*6-15)+10))}function ip(n,e){return n+Math.floor(Math.random()*(e-n+1))}function rp(n,e){return n+Math.random()*(e-n)}function sp(n){return n*(.5-Math.random())}function op(n){n!==void 0&&(Fu=n);let e=Fu+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function ap(n){return n*Zr}function lp(n){return n*mr}function cp(n){return(n&n-1)===0&&n!==0}function up(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))}function hp(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))}function dp(n,e,t,i,r){let s=Math.cos,o=Math.sin,a=s(t/2),l=o(t/2),c=s((e+i)/2),u=o((e+i)/2),f=s((e-i)/2),h=o((e-i)/2),d=s((i-e)/2),m=o((i-e)/2);switch(r){case"XYX":n.set(a*u,l*f,l*h,a*c);break;case"YZY":n.set(l*h,a*u,l*f,a*c);break;case"ZXZ":n.set(l*f,l*h,a*u,a*c);break;case"XZX":n.set(a*u,l*m,l*d,a*c);break;case"YXY":n.set(l*d,a*u,l*m,a*c);break;case"ZYZ":n.set(l*m,l*d,a*u,a*c);break;default:Be("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+r)}}function hr(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function Yt(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Tc={DEG2RAD:Zr,RAD2DEG:mr,generateUUID:Rr,clamp:it,euclideanModulo:wc,mapLinear:Jf,inverseLerp:jf,lerp:Kr,damp:Qf,pingpong:ep,smoothstep:tp,smootherstep:np,randInt:ip,randFloat:rp,randFloatSpread:sp,seededRandom:op,degToRad:ap,radToDeg:lp,isPowerOfTwo:cp,ceilPowerOfTwo:up,floorPowerOfTwo:hp,setQuaternionFromProperEuler:dp,normalize:Yt,denormalize:hr},De=class n{static{n.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,i=this.y,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6],this.y=r[1]*t+r[4]*i+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=it(this.x,e.x,t.x),this.y=it(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=it(this.x,e,t),this.y=it(this.y,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(it(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(it(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let i=Math.cos(t),r=Math.sin(t),s=this.x-e.x,o=this.y-e.y;return this.x=s*i-o*r+e.x,this.y=s*r+o*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},an=class{constructor(e=0,t=0,i=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=r}static slerpFlat(e,t,i,r,s,o,a){let l=i[r+0],c=i[r+1],u=i[r+2],f=i[r+3],h=s[o+0],d=s[o+1],m=s[o+2],b=s[o+3];if(f!==b||l!==h||c!==d||u!==m){let g=l*h+c*d+u*m+f*b;g<0&&(h=-h,d=-d,m=-m,b=-b,g=-g);let p=1-a;if(g<.9995){let M=Math.acos(g),T=Math.sin(M);p=Math.sin(p*M)/T,a=Math.sin(a*M)/T,l=l*p+h*a,c=c*p+d*a,u=u*p+m*a,f=f*p+b*a}else{l=l*p+h*a,c=c*p+d*a,u=u*p+m*a,f=f*p+b*a;let M=1/Math.sqrt(l*l+c*c+u*u+f*f);l*=M,c*=M,u*=M,f*=M}}e[t]=l,e[t+1]=c,e[t+2]=u,e[t+3]=f}static multiplyQuaternionsFlat(e,t,i,r,s,o){let a=i[r],l=i[r+1],c=i[r+2],u=i[r+3],f=s[o],h=s[o+1],d=s[o+2],m=s[o+3];return e[t]=a*m+u*f+l*d-c*h,e[t+1]=l*m+u*h+c*f-a*d,e[t+2]=c*m+u*d+a*h-l*f,e[t+3]=u*m-a*f-l*h-c*d,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,r){return this._x=e,this._y=t,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let i=e._x,r=e._y,s=e._z,o=e._order,a=Math.cos,l=Math.sin,c=a(i/2),u=a(r/2),f=a(s/2),h=l(i/2),d=l(r/2),m=l(s/2);switch(o){case"XYZ":this._x=h*u*f+c*d*m,this._y=c*d*f-h*u*m,this._z=c*u*m+h*d*f,this._w=c*u*f-h*d*m;break;case"YXZ":this._x=h*u*f+c*d*m,this._y=c*d*f-h*u*m,this._z=c*u*m-h*d*f,this._w=c*u*f+h*d*m;break;case"ZXY":this._x=h*u*f-c*d*m,this._y=c*d*f+h*u*m,this._z=c*u*m+h*d*f,this._w=c*u*f-h*d*m;break;case"ZYX":this._x=h*u*f-c*d*m,this._y=c*d*f+h*u*m,this._z=c*u*m-h*d*f,this._w=c*u*f+h*d*m;break;case"YZX":this._x=h*u*f+c*d*m,this._y=c*d*f+h*u*m,this._z=c*u*m-h*d*f,this._w=c*u*f-h*d*m;break;case"XZY":this._x=h*u*f-c*d*m,this._y=c*d*f-h*u*m,this._z=c*u*m+h*d*f,this._w=c*u*f+h*d*m;break;default:Be("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let i=t/2,r=Math.sin(i);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,i=t[0],r=t[4],s=t[8],o=t[1],a=t[5],l=t[9],c=t[2],u=t[6],f=t[10],h=i+a+f;if(h>0){let d=.5/Math.sqrt(h+1);this._w=.25/d,this._x=(u-l)*d,this._y=(s-c)*d,this._z=(o-r)*d}else if(i>a&&i>f){let d=2*Math.sqrt(1+i-a-f);this._w=(u-l)/d,this._x=.25*d,this._y=(r+o)/d,this._z=(s+c)/d}else if(a>f){let d=2*Math.sqrt(1+a-i-f);this._w=(s-c)/d,this._x=(r+o)/d,this._y=.25*d,this._z=(l+u)/d}else{let d=2*Math.sqrt(1+f-i-a);this._w=(o-r)/d,this._x=(s+c)/d,this._y=(l+u)/d,this._z=.25*d}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<1e-8?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(it(this.dot(e),-1,1)))}rotateTowards(e,t){let i=this.angleTo(e);if(i===0)return this;let r=Math.min(1,t/i);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let i=e._x,r=e._y,s=e._z,o=e._w,a=t._x,l=t._y,c=t._z,u=t._w;return this._x=i*u+o*a+r*c-s*l,this._y=r*u+o*l+s*a-i*c,this._z=s*u+o*c+i*l-r*a,this._w=o*u-i*a-r*l-s*c,this._onChangeCallback(),this}slerp(e,t){let i=e._x,r=e._y,s=e._z,o=e._w,a=this.dot(e);a<0&&(i=-i,r=-r,s=-s,o=-o,a=-a);let l=1-t;if(a<.9995){let c=Math.acos(a),u=Math.sin(c);l=Math.sin(l*c)/u,t=Math.sin(t*c)/u,this._x=this._x*l+i*t,this._y=this._y*l+r*t,this._z=this._z*l+s*t,this._w=this._w*l+o*t,this._onChangeCallback()}else this._x=this._x*l+i*t,this._y=this._y*l+r*t,this._z=this._z*l+s*t,this._w=this._w*l+o*t,this.normalize();return this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),r=Math.sqrt(1-i),s=Math.sqrt(i);return this.set(r*Math.sin(e),r*Math.cos(e),s*Math.sin(t),s*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},k=class n{static{n.prototype.isVector3=!0}constructor(e=0,t=0,i=0){this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Nu.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Nu.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[3]*i+s[6]*r,this.y=s[1]*t+s[4]*i+s[7]*r,this.z=s[2]*t+s[5]*i+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,i=this.y,r=this.z,s=e.elements,o=1/(s[3]*t+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*t+s[4]*i+s[8]*r+s[12])*o,this.y=(s[1]*t+s[5]*i+s[9]*r+s[13])*o,this.z=(s[2]*t+s[6]*i+s[10]*r+s[14])*o,this}applyQuaternion(e){let t=this.x,i=this.y,r=this.z,s=e.x,o=e.y,a=e.z,l=e.w,c=2*(o*r-a*i),u=2*(a*t-s*r),f=2*(s*i-o*t);return this.x=t+l*c+o*f-a*u,this.y=i+l*u+a*c-s*f,this.z=r+l*f+s*u-o*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[4]*i+s[8]*r,this.y=s[1]*t+s[5]*i+s[9]*r,this.z=s[2]*t+s[6]*i+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=it(this.x,e.x,t.x),this.y=it(this.y,e.y,t.y),this.z=it(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=it(this.x,e,t),this.y=it(this.y,e,t),this.z=it(this.z,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(it(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let i=e.x,r=e.y,s=e.z,o=t.x,a=t.y,l=t.z;return this.x=r*l-s*a,this.y=s*o-i*l,this.z=i*a-r*o,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return Sl.copy(this).projectOnVector(e),this.sub(Sl)}reflect(e){return this.sub(Sl.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(it(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y,r=this.z-e.z;return t*t+i*i+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){let r=Math.sin(t)*e;return this.x=r*Math.sin(i),this.y=Math.cos(t)*e,this.z=r*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Sl=new k,Nu=new an,$e=class n{static{n.prototype.isMatrix3=!0}constructor(e,t,i,r,s,o,a,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,o,a,l,c)}set(e,t,i,r,s,o,a,l,c){let u=this.elements;return u[0]=e,u[1]=r,u[2]=a,u[3]=t,u[4]=s,u[5]=l,u[6]=i,u[7]=o,u[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,r=t.elements,s=this.elements,o=i[0],a=i[3],l=i[6],c=i[1],u=i[4],f=i[7],h=i[2],d=i[5],m=i[8],b=r[0],g=r[3],p=r[6],M=r[1],T=r[4],v=r[7],C=r[2],S=r[5],_=r[8];return s[0]=o*b+a*M+l*C,s[3]=o*g+a*T+l*S,s[6]=o*p+a*v+l*_,s[1]=c*b+u*M+f*C,s[4]=c*g+u*T+f*S,s[7]=c*p+u*v+f*_,s[2]=h*b+d*M+m*C,s[5]=h*g+d*T+m*S,s[8]=h*p+d*v+m*_,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8];return t*o*u-t*a*c-i*s*u+i*a*l+r*s*c-r*o*l}invert(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8],f=u*o-a*c,h=a*l-u*s,d=c*s-o*l,m=t*f+i*h+r*d;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);let b=1/m;return e[0]=f*b,e[1]=(r*c-u*i)*b,e[2]=(a*i-r*o)*b,e[3]=h*b,e[4]=(u*t-r*l)*b,e[5]=(r*s-a*t)*b,e[6]=d*b,e[7]=(i*l-c*t)*b,e[8]=(o*t-i*s)*b,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,r,s,o,a){let l=Math.cos(s),c=Math.sin(s);return this.set(i*l,i*c,-i*(l*o+c*a)+o+e,-r*c,r*l,-r*(-c*o+l*a)+a+t,0,0,1),this}scale(e,t){return Ni("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(wl.makeScale(e,t)),this}rotate(e){return Ni("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(wl.makeRotation(-e)),this}translate(e,t){return Ni("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(wl.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,i=e.elements;for(let r=0;r<9;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}},wl=new $e,Uu=new $e().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Ou=new $e().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function fp(){let n={enabled:!0,workingColorSpace:jr,spaces:{},convert:function(r,s,o){return this.enabled===!1||s===o||!s||!o||(this.spaces[s].transfer===lt&&(r.r=$n(r.r),r.g=$n(r.g),r.b=$n(r.b)),this.spaces[s].primaries!==this.spaces[o].primaries&&(r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===lt&&(r.r=dr(r.r),r.g=dr(r.g),r.b=dr(r.b))),r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){return r===jn?Qr:this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,o){return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,s){return Ni("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),n.workingToColorSpace(r,s)},toWorkingColorSpace:function(r,s){return Ni("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),n.colorSpaceToWorking(r,s)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],i=[.3127,.329];return n.define({[jr]:{primaries:e,whitePoint:i,transfer:Qr,toXYZ:Uu,fromXYZ:Ou,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Ot},outputColorSpaceConfig:{drawingBufferColorSpace:Ot}},[Ot]:{primaries:e,whitePoint:i,transfer:lt,toXYZ:Uu,fromXYZ:Ou,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Ot}}}),n}var rt=fp();function $n(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function dr(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}var ji,Oo=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let i;if(e instanceof HTMLCanvasElement)i=e;else{ji===void 0&&(ji=es("canvas")),ji.width=e.width,ji.height=e.height;let r=ji.getContext("2d");e instanceof ImageData?r.putImageData(e,0,0):r.drawImage(e,0,0,e.width,e.height),i=ji}return i.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=es("canvas");t.width=e.width,t.height=e.height;let i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);let r=i.getImageData(0,0,e.width,e.height),s=r.data;for(let o=0;o<s.length;o++)s[o]=$n(s[o]/255)*255;return i.putImageData(r,0,0),t}else if(e.data){let t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor($n(t[i]/255)*255):t[i]=$n(t[i]);return{data:t,width:e.width,height:e.height}}else return Be("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},pp=0,gr=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:pp++}),this.uuid=Rr(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let i={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let o=0,a=r.length;o<a;o++)r[o].isDataTexture?s.push(Tl(r[o].image)):s.push(Tl(r[o]))}else s=Tl(r);i.url=s}return t||(e.images[this.uuid]=i),i}};function Tl(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?Oo.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(Be("Texture: Unable to serialize Texture."),{})}var mp=0,El=new k,Kt=class n extends Mn{constructor(e=n.DEFAULT_IMAGE,t=n.DEFAULT_MAPPING,i=Ln,r=Ln,s=Dt,o=_i,a=pn,l=Qt,c=n.DEFAULT_ANISOTROPY,u=jn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:mp++}),this.uuid=Rr(),this.name="",this.source=new gr(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new De(0,0),this.repeat=new De(1,1),this.center=new De(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new $e,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(El).x}get height(){return this.source.getSize(El).y}get depth(){return this.source.getSize(El).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let i=e[t];if(i===void 0){Be(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){Be(`Texture.setValues(): property '${t}' does not exist.`);continue}r&&i&&r.isVector2&&i.isVector2||r&&i&&r.isVector3&&i.isVector3||r&&i&&r.isMatrix3&&i.isMatrix3?r.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==mc)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Fo:e.x=e.x-Math.floor(e.x);break;case Ln:e.x=e.x<0?0:1;break;case No:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Fo:e.y=e.y-Math.floor(e.y);break;case Ln:e.y=e.y<0?0:1;break;case No:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Kt.DEFAULT_IMAGE=null;Kt.DEFAULT_MAPPING=mc;Kt.DEFAULT_ANISOTROPY=1;var xt=class n{static{n.prototype.isVector4=!0}constructor(e=0,t=0,i=0,r=1){this.x=e,this.y=t,this.z=i,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,r){return this.x=e,this.y=t,this.z=i,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,i=this.y,r=this.z,s=this.w,o=e.elements;return this.x=o[0]*t+o[4]*i+o[8]*r+o[12]*s,this.y=o[1]*t+o[5]*i+o[9]*r+o[13]*s,this.z=o[2]*t+o[6]*i+o[10]*r+o[14]*s,this.w=o[3]*t+o[7]*i+o[11]*r+o[15]*s,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,r,s,l=e.elements,c=l[0],u=l[4],f=l[8],h=l[1],d=l[5],m=l[9],b=l[2],g=l[6],p=l[10];if(Math.abs(u-h)<.01&&Math.abs(f-b)<.01&&Math.abs(m-g)<.01){if(Math.abs(u+h)<.1&&Math.abs(f+b)<.1&&Math.abs(m+g)<.1&&Math.abs(c+d+p-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let T=(c+1)/2,v=(d+1)/2,C=(p+1)/2,S=(u+h)/4,_=(f+b)/4,x=(m+g)/4;return T>v&&T>C?T<.01?(i=0,r=.707106781,s=.707106781):(i=Math.sqrt(T),r=S/i,s=_/i):v>C?v<.01?(i=.707106781,r=0,s=.707106781):(r=Math.sqrt(v),i=S/r,s=x/r):C<.01?(i=.707106781,r=.707106781,s=0):(s=Math.sqrt(C),i=_/s,r=x/s),this.set(i,r,s,t),this}let M=Math.sqrt((g-m)*(g-m)+(f-b)*(f-b)+(h-u)*(h-u));return Math.abs(M)<.001&&(M=1),this.x=(g-m)/M,this.y=(f-b)/M,this.z=(h-u)/M,this.w=Math.acos((c+d+p-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=it(this.x,e.x,t.x),this.y=it(this.y,e.y,t.y),this.z=it(this.z,e.z,t.z),this.w=it(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=it(this.x,e,t),this.y=it(this.y,e,t),this.z=it(this.z,e,t),this.w=it(this.w,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(it(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Bo=class extends Mn{constructor(e=1,t=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Dt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=i.depth,this.scissor=new xt(0,0,e,t),this.scissorTest=!1,this.viewport=new xt(0,0,e,t),this.textures=[];let r={width:e,height:t,depth:i.depth},s=new Kt(r),o=i.count;for(let a=0;a<o;a++)this.textures[a]=s.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:Dt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let r=0,s=this.textures.length;r<s;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=i,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,i=e.textures.length;t<i;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let r=Object.assign({},e.textures[t].image);this.textures[t].source=new gr(r)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},ln=class extends Bo{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}},ts=class extends Kt{constructor(e=null,t=1,i=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=Bt,this.minFilter=Bt,this.wrapR=Ln,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var ko=class extends Kt{constructor(e=null,t=1,i=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=Bt,this.minFilter=Bt,this.wrapR=Ln,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var pt=class n{static{n.prototype.isMatrix4=!0}constructor(e,t,i,r,s,o,a,l,c,u,f,h,d,m,b,g){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,o,a,l,c,u,f,h,d,m,b,g)}set(e,t,i,r,s,o,a,l,c,u,f,h,d,m,b,g){let p=this.elements;return p[0]=e,p[4]=t,p[8]=i,p[12]=r,p[1]=s,p[5]=o,p[9]=a,p[13]=l,p[2]=c,p[6]=u,p[10]=f,p[14]=h,p[3]=d,p[7]=m,p[11]=b,p[15]=g,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new n().fromArray(this.elements)}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){let t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),i.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,i=e.elements,r=1/Qi.setFromMatrixColumn(e,0).length(),s=1/Qi.setFromMatrixColumn(e,1).length(),o=1/Qi.setFromMatrixColumn(e,2).length();return t[0]=i[0]*r,t[1]=i[1]*r,t[2]=i[2]*r,t[3]=0,t[4]=i[4]*s,t[5]=i[5]*s,t[6]=i[6]*s,t[7]=0,t[8]=i[8]*o,t[9]=i[9]*o,t[10]=i[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,i=e.x,r=e.y,s=e.z,o=Math.cos(i),a=Math.sin(i),l=Math.cos(r),c=Math.sin(r),u=Math.cos(s),f=Math.sin(s);if(e.order==="XYZ"){let h=o*u,d=o*f,m=a*u,b=a*f;t[0]=l*u,t[4]=-l*f,t[8]=c,t[1]=d+m*c,t[5]=h-b*c,t[9]=-a*l,t[2]=b-h*c,t[6]=m+d*c,t[10]=o*l}else if(e.order==="YXZ"){let h=l*u,d=l*f,m=c*u,b=c*f;t[0]=h+b*a,t[4]=m*a-d,t[8]=o*c,t[1]=o*f,t[5]=o*u,t[9]=-a,t[2]=d*a-m,t[6]=b+h*a,t[10]=o*l}else if(e.order==="ZXY"){let h=l*u,d=l*f,m=c*u,b=c*f;t[0]=h-b*a,t[4]=-o*f,t[8]=m+d*a,t[1]=d+m*a,t[5]=o*u,t[9]=b-h*a,t[2]=-o*c,t[6]=a,t[10]=o*l}else if(e.order==="ZYX"){let h=o*u,d=o*f,m=a*u,b=a*f;t[0]=l*u,t[4]=m*c-d,t[8]=h*c+b,t[1]=l*f,t[5]=b*c+h,t[9]=d*c-m,t[2]=-c,t[6]=a*l,t[10]=o*l}else if(e.order==="YZX"){let h=o*l,d=o*c,m=a*l,b=a*c;t[0]=l*u,t[4]=b-h*f,t[8]=m*f+d,t[1]=f,t[5]=o*u,t[9]=-a*u,t[2]=-c*u,t[6]=d*f+m,t[10]=h-b*f}else if(e.order==="XZY"){let h=o*l,d=o*c,m=a*l,b=a*c;t[0]=l*u,t[4]=-f,t[8]=c*u,t[1]=h*f+b,t[5]=o*u,t[9]=d*f-m,t[2]=m*f-d,t[6]=a*u,t[10]=b*f+h}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(gp,e,_p)}lookAt(e,t,i){let r=this.elements;return sn.subVectors(e,t),sn.lengthSq()===0&&(sn.z=1),sn.normalize(),ni.crossVectors(i,sn),ni.lengthSq()===0&&(Math.abs(i.z)===1?sn.x+=1e-4:sn.z+=1e-4,sn.normalize(),ni.crossVectors(i,sn)),ni.normalize(),eo.crossVectors(sn,ni),r[0]=ni.x,r[4]=eo.x,r[8]=sn.x,r[1]=ni.y,r[5]=eo.y,r[9]=sn.y,r[2]=ni.z,r[6]=eo.z,r[10]=sn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,r=t.elements,s=this.elements,o=i[0],a=i[4],l=i[8],c=i[12],u=i[1],f=i[5],h=i[9],d=i[13],m=i[2],b=i[6],g=i[10],p=i[14],M=i[3],T=i[7],v=i[11],C=i[15],S=r[0],_=r[4],x=r[8],A=r[12],E=r[1],R=r[5],I=r[9],N=r[13],U=r[2],F=r[6],O=r[10],D=r[14],G=r[3],K=r[7],Q=r[11],ne=r[15];return s[0]=o*S+a*E+l*U+c*G,s[4]=o*_+a*R+l*F+c*K,s[8]=o*x+a*I+l*O+c*Q,s[12]=o*A+a*N+l*D+c*ne,s[1]=u*S+f*E+h*U+d*G,s[5]=u*_+f*R+h*F+d*K,s[9]=u*x+f*I+h*O+d*Q,s[13]=u*A+f*N+h*D+d*ne,s[2]=m*S+b*E+g*U+p*G,s[6]=m*_+b*R+g*F+p*K,s[10]=m*x+b*I+g*O+p*Q,s[14]=m*A+b*N+g*D+p*ne,s[3]=M*S+T*E+v*U+C*G,s[7]=M*_+T*R+v*F+C*K,s[11]=M*x+T*I+v*O+C*Q,s[15]=M*A+T*N+v*D+C*ne,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[4],r=e[8],s=e[12],o=e[1],a=e[5],l=e[9],c=e[13],u=e[2],f=e[6],h=e[10],d=e[14],m=e[3],b=e[7],g=e[11],p=e[15],M=l*d-c*h,T=a*d-c*f,v=a*h-l*f,C=o*d-c*u,S=o*h-l*u,_=o*f-a*u;return t*(b*M-g*T+p*v)-i*(m*M-g*C+p*S)+r*(m*T-b*C+p*_)-s*(m*v-b*S+g*_)}determinantAffine(){let e=this.elements,t=e[0],i=e[4],r=e[8],s=e[1],o=e[5],a=e[9],l=e[2],c=e[6],u=e[10];return t*(o*u-a*c)-i*(s*u-a*l)+r*(s*c-o*l)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=i),this}invert(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8],f=e[9],h=e[10],d=e[11],m=e[12],b=e[13],g=e[14],p=e[15],M=t*a-i*o,T=t*l-r*o,v=t*c-s*o,C=i*l-r*a,S=i*c-s*a,_=r*c-s*l,x=u*b-f*m,A=u*g-h*m,E=u*p-d*m,R=f*g-h*b,I=f*p-d*b,N=h*p-d*g,U=M*N-T*I+v*R+C*E-S*A+_*x;if(U===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let F=1/U;return e[0]=(a*N-l*I+c*R)*F,e[1]=(r*I-i*N-s*R)*F,e[2]=(b*_-g*S+p*C)*F,e[3]=(h*S-f*_-d*C)*F,e[4]=(l*E-o*N-c*A)*F,e[5]=(t*N-r*E+s*A)*F,e[6]=(g*v-m*_-p*T)*F,e[7]=(u*_-h*v+d*T)*F,e[8]=(o*I-a*E+c*x)*F,e[9]=(i*E-t*I-s*x)*F,e[10]=(m*S-b*v+p*M)*F,e[11]=(f*v-u*S-d*M)*F,e[12]=(a*A-o*R-l*x)*F,e[13]=(t*R-i*A+r*x)*F,e[14]=(b*T-m*C-g*M)*F,e[15]=(u*C-f*T+h*M)*F,this}scale(e){let t=this.elements,i=e.x,r=e.y,s=e.z;return t[0]*=i,t[4]*=r,t[8]*=s,t[1]*=i,t[5]*=r,t[9]*=s,t[2]*=i,t[6]*=r,t[10]*=s,t[3]*=i,t[7]*=r,t[11]*=s,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,r))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let i=Math.cos(t),r=Math.sin(t),s=1-i,o=e.x,a=e.y,l=e.z,c=s*o,u=s*a;return this.set(c*o+i,c*a-r*l,c*l+r*a,0,c*a+r*l,u*a+i,u*l-r*o,0,c*l-r*a,u*l+r*o,s*l*l+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,r,s,o){return this.set(1,i,s,0,e,1,o,0,t,r,1,0,0,0,0,1),this}compose(e,t,i){let r=this.elements,s=t._x,o=t._y,a=t._z,l=t._w,c=s+s,u=o+o,f=a+a,h=s*c,d=s*u,m=s*f,b=o*u,g=o*f,p=a*f,M=l*c,T=l*u,v=l*f,C=i.x,S=i.y,_=i.z;return r[0]=(1-(b+p))*C,r[1]=(d+v)*C,r[2]=(m-T)*C,r[3]=0,r[4]=(d-v)*S,r[5]=(1-(h+p))*S,r[6]=(g+M)*S,r[7]=0,r[8]=(m+T)*_,r[9]=(g-M)*_,r[10]=(1-(h+b))*_,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,i){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let s=this.determinantAffine();if(s===0)return i.set(1,1,1),t.identity(),this;let o=Qi.set(r[0],r[1],r[2]).length(),a=Qi.set(r[4],r[5],r[6]).length(),l=Qi.set(r[8],r[9],r[10]).length();s<0&&(o=-o),_n.copy(this);let c=1/o,u=1/a,f=1/l;return _n.elements[0]*=c,_n.elements[1]*=c,_n.elements[2]*=c,_n.elements[4]*=u,_n.elements[5]*=u,_n.elements[6]*=u,_n.elements[8]*=f,_n.elements[9]*=f,_n.elements[10]*=f,t.setFromRotationMatrix(_n),i.x=o,i.y=a,i.z=l,this}makePerspective(e,t,i,r,s,o,a=vn,l=!1){let c=this.elements,u=2*s/(t-e),f=2*s/(i-r),h=(t+e)/(t-e),d=(i+r)/(i-r),m,b;if(l)m=s/(o-s),b=o*s/(o-s);else if(a===vn)m=-(o+s)/(o-s),b=-2*o*s/(o-s);else if(a===fr)m=-o/(o-s),b=-o*s/(o-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=u,c[4]=0,c[8]=h,c[12]=0,c[1]=0,c[5]=f,c[9]=d,c[13]=0,c[2]=0,c[6]=0,c[10]=m,c[14]=b,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,i,r,s,o,a=vn,l=!1){let c=this.elements,u=2/(t-e),f=2/(i-r),h=-(t+e)/(t-e),d=-(i+r)/(i-r),m,b;if(l)m=1/(o-s),b=o/(o-s);else if(a===vn)m=-2/(o-s),b=-(o+s)/(o-s);else if(a===fr)m=-1/(o-s),b=-s/(o-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=u,c[4]=0,c[8]=0,c[12]=h,c[1]=0,c[5]=f,c[9]=0,c[13]=d,c[2]=0,c[6]=0,c[10]=m,c[14]=b,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,i=e.elements;for(let r=0;r<16;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}},Qi=new k,_n=new pt,gp=new k(0,0,0),_p=new k(1,1,1),ni=new k,eo=new k,sn=new k,Bu=new pt,ku=new an,Nn=class n{constructor(e=0,t=0,i=0,r=n.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,r=this._order){return this._x=e,this._y=t,this._z=i,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){let r=e.elements,s=r[0],o=r[4],a=r[8],l=r[1],c=r[5],u=r[9],f=r[2],h=r[6],d=r[10];switch(t){case"XYZ":this._y=Math.asin(it(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-u,d),this._z=Math.atan2(-o,s)):(this._x=Math.atan2(h,c),this._z=0);break;case"YXZ":this._x=Math.asin(-it(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(a,d),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-f,s),this._z=0);break;case"ZXY":this._x=Math.asin(it(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(-f,d),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-it(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(h,d),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(it(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-u,c),this._y=Math.atan2(-f,s)):(this._x=0,this._y=Math.atan2(a,d));break;case"XZY":this._z=Math.asin(-it(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(h,c),this._y=Math.atan2(a,s)):(this._x=Math.atan2(-u,d),this._y=0);break;default:Be("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return Bu.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Bu,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return ku.setFromEuler(this),this.setFromQuaternion(ku,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Nn.DEFAULT_ORDER="XYZ";var _r=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},xp=0,zu=new k,er=new an,Hn=new pt,to=new k,Gr=new k,yp=new k,vp=new an,Vu=new k(1,0,0),Gu=new k(0,1,0),Hu=new k(0,0,1),Wu={type:"added"},bp={type:"removed"},tr={type:"childadded",child:null},Al={type:"childremoved",child:null},kt=class n extends Mn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:xp++}),this.uuid=Rr(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=n.DEFAULT_UP.clone();let e=new k,t=new Nn,i=new an,r=new k(1,1,1);function s(){i.setFromEuler(t,!1)}function o(){t.setFromQuaternion(i,void 0,!1)}t._onChange(s),i._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new pt},normalMatrix:{value:new $e}}),this.matrix=new pt,this.matrixWorld=new pt,this.matrixAutoUpdate=n.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=n.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new _r,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return er.setFromAxisAngle(e,t),this.quaternion.multiply(er),this}rotateOnWorldAxis(e,t){return er.setFromAxisAngle(e,t),this.quaternion.premultiply(er),this}rotateX(e){return this.rotateOnAxis(Vu,e)}rotateY(e){return this.rotateOnAxis(Gu,e)}rotateZ(e){return this.rotateOnAxis(Hu,e)}translateOnAxis(e,t){return zu.copy(e).applyQuaternion(this.quaternion),this.position.add(zu.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Vu,e)}translateY(e){return this.translateOnAxis(Gu,e)}translateZ(e){return this.translateOnAxis(Hu,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Hn.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?to.copy(e):to.set(e,t,i);let r=this.parent;this.updateWorldMatrix(!0,!1),Gr.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Hn.lookAt(Gr,to,this.up):Hn.lookAt(to,Gr,this.up),this.quaternion.setFromRotationMatrix(Hn),r&&(Hn.extractRotation(r.matrixWorld),er.setFromRotationMatrix(Hn),this.quaternion.premultiply(er.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Ve("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Wu),tr.child=e,this.dispatchEvent(tr),tr.child=null):Ve("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(bp),Al.child=e,this.dispatchEvent(Al),Al.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Hn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Hn.multiply(e.parent.matrixWorld)),e.applyMatrix4(Hn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Wu),tr.child=e,this.dispatchEvent(tr),tr.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,r=this.children.length;i<r;i++){let o=this.children[i].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);let r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Gr,e,yp),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Gr,vp,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,i=e.y,r=e.z,s=this.matrix.elements;s[12]+=t-s[0]*t-s[4]*i-s[8]*r,s[13]+=i-s[1]*t-s[5]*i-s[9]*r,s[14]+=r-s[2]*t-s[6]*i-s[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].updateMatrixWorld(e)}updateWorldMatrix(e,t,i=!1){let r=this.parent;if(e===!0&&r!==null&&r.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),t===!0){let s=this.children;for(let o=0,a=s.length;o<a;o++)s[o].updateWorldMatrix(!1,!0,i)}}toJSON(e){let t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),this.static!==!1&&(r.static=this.static),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(a=>({...a})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function s(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let c=0,u=l.length;c<u;c++){let f=l[c];s(e.shapes,f)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(s(e.materials,this.material[l]));r.material=a}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let a=0;a<this.children.length;a++)r.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];r.animations.push(s(e.animations,l))}}if(t){let a=o(e.geometries),l=o(e.materials),c=o(e.textures),u=o(e.images),f=o(e.shapes),h=o(e.skeletons),d=o(e.animations),m=o(e.nodes);a.length>0&&(i.geometries=a),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),u.length>0&&(i.images=u),f.length>0&&(i.shapes=f),h.length>0&&(i.skeletons=h),d.length>0&&(i.animations=d),m.length>0&&(i.nodes=m)}return i.object=r,i;function o(a){let l=[];for(let c in a){let u=a[c];delete u.metadata,l.push(u)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){let r=e.children[i];this.add(r.clone())}return this}};kt.DEFAULT_UP=new k(0,1,0);kt.DEFAULT_MATRIX_AUTO_UPDATE=!0;kt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var $t=class extends kt{constructor(){super(),this.isGroup=!0,this.type="Group"}},Mp={type:"move"},xr=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new $t,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new $t,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new k,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new k),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new $t,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new k,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new k,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let r=null,s=null,o=null,a=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){o=!0;for(let b of e.hand.values()){let g=t.getJointPose(b,i),p=this._getHandJoint(c,b);g!==null&&(p.matrix.fromArray(g.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=g.radius),p.visible=g!==null}let u=c.joints["index-finger-tip"],f=c.joints["thumb-tip"],h=u.position.distanceTo(f.position),d=.02,m=.005;c.inputState.pinching&&h>d+m?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&h<=d-m&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,i),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));a!==null&&(r=t.getPose(e.targetRaySpace,i),r===null&&s!==null&&(r=s),r!==null&&(a.matrix.fromArray(r.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,r.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(r.linearVelocity)):a.hasLinearVelocity=!1,r.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(r.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(Mp)))}return a!==null&&(a.visible=r!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let i=new $t;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}},Gh={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},ii={h:0,s:0,l:0},no={h:0,s:0,l:0};function Rl(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}var qe=class{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){let r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Ot){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,rt.colorSpaceToWorking(this,t),this}setRGB(e,t,i,r=rt.workingColorSpace){return this.r=e,this.g=t,this.b=i,rt.colorSpaceToWorking(this,r),this}setHSL(e,t,i,r=rt.workingColorSpace){if(e=wc(e,1),t=it(t,0,1),i=it(i,0,1),t===0)this.r=this.g=this.b=i;else{let s=i<=.5?i*(1+t):i+t-i*t,o=2*i-s;this.r=Rl(o,s,e+1/3),this.g=Rl(o,s,e),this.b=Rl(o,s,e-1/3)}return rt.colorSpaceToWorking(this,r),this}setStyle(e,t=Ot){function i(s){s!==void 0&&parseFloat(s)<1&&Be("Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s,o=r[1],a=r[2];switch(o){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:Be("Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let s=r[1],o=s.length;if(o===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(s,16),t);Be("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Ot){let i=Gh[e.toLowerCase()];return i!==void 0?this.setHex(i,t):Be("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=$n(e.r),this.g=$n(e.g),this.b=$n(e.b),this}copyLinearToSRGB(e){return this.r=dr(e.r),this.g=dr(e.g),this.b=dr(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Ot){return rt.workingToColorSpace(Ht.copy(this),e),Math.round(it(Ht.r*255,0,255))*65536+Math.round(it(Ht.g*255,0,255))*256+Math.round(it(Ht.b*255,0,255))}getHexString(e=Ot){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=rt.workingColorSpace){rt.workingToColorSpace(Ht.copy(this),t);let i=Ht.r,r=Ht.g,s=Ht.b,o=Math.max(i,r,s),a=Math.min(i,r,s),l,c,u=(a+o)/2;if(a===o)l=0,c=0;else{let f=o-a;switch(c=u<=.5?f/(o+a):f/(2-o-a),o){case i:l=(r-s)/f+(r<s?6:0);break;case r:l=(s-i)/f+2;break;case s:l=(i-r)/f+4;break}l/=6}return e.h=l,e.s=c,e.l=u,e}getRGB(e,t=rt.workingColorSpace){return rt.workingToColorSpace(Ht.copy(this),t),e.r=Ht.r,e.g=Ht.g,e.b=Ht.b,e}getStyle(e=Ot){rt.workingToColorSpace(Ht.copy(this),e);let t=Ht.r,i=Ht.g,r=Ht.b;return e!==Ot?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(r*255)})`}offsetHSL(e,t,i){return this.getHSL(ii),this.setHSL(ii.h+e,ii.s+t,ii.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(ii),e.getHSL(no);let i=Kr(ii.h,no.h,t),r=Kr(ii.s,no.s,t),s=Kr(ii.l,no.l,t);return this.setHSL(i,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,i=this.g,r=this.b,s=e.elements;return this.r=s[0]*t+s[3]*i+s[6]*r,this.g=s[1]*t+s[4]*i+s[7]*r,this.b=s[2]*t+s[5]*i+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Ht=new qe;qe.NAMES=Gh;var ns=class n{constructor(e,t=1,i=1e3){this.isFog=!0,this.name="",this.color=new qe(e),this.near=t,this.far=i}clone(){return new n(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}},is=class extends kt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Nn,this.environmentIntensity=1,this.environmentRotation=new Nn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}},xn=new k,Wn=new k,Cl=new k,Xn=new k,nr=new k,ir=new k,Xu=new k,Pl=new k,Il=new k,Dl=new k,Ll=new xt,Fl=new xt,Nl=new xt,li=class n{constructor(e=new k,t=new k,i=new k){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,r){r.subVectors(i,t),xn.subVectors(e,t),r.cross(xn);let s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(e,t,i,r,s){xn.subVectors(r,t),Wn.subVectors(i,t),Cl.subVectors(e,t);let o=xn.dot(xn),a=xn.dot(Wn),l=xn.dot(Cl),c=Wn.dot(Wn),u=Wn.dot(Cl),f=o*c-a*a;if(f===0)return s.set(0,0,0),null;let h=1/f,d=(c*l-a*u)*h,m=(o*u-a*l)*h;return s.set(1-d-m,m,d)}static containsPoint(e,t,i,r){return this.getBarycoord(e,t,i,r,Xn)===null?!1:Xn.x>=0&&Xn.y>=0&&Xn.x+Xn.y<=1}static getInterpolation(e,t,i,r,s,o,a,l){return this.getBarycoord(e,t,i,r,Xn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,Xn.x),l.addScaledVector(o,Xn.y),l.addScaledVector(a,Xn.z),l)}static getInterpolatedAttribute(e,t,i,r,s,o){return Ll.setScalar(0),Fl.setScalar(0),Nl.setScalar(0),Ll.fromBufferAttribute(e,t),Fl.fromBufferAttribute(e,i),Nl.fromBufferAttribute(e,r),o.setScalar(0),o.addScaledVector(Ll,s.x),o.addScaledVector(Fl,s.y),o.addScaledVector(Nl,s.z),o}static isFrontFacing(e,t,i,r){return xn.subVectors(i,t),Wn.subVectors(e,t),xn.cross(Wn).dot(r)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,r){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,i,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return xn.subVectors(this.c,this.b),Wn.subVectors(this.a,this.b),xn.cross(Wn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return n.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return n.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,r,s){return n.getInterpolation(e,this.a,this.b,this.c,t,i,r,s)}containsPoint(e){return n.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return n.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let i=this.a,r=this.b,s=this.c,o,a;nr.subVectors(r,i),ir.subVectors(s,i),Pl.subVectors(e,i);let l=nr.dot(Pl),c=ir.dot(Pl);if(l<=0&&c<=0)return t.copy(i);Il.subVectors(e,r);let u=nr.dot(Il),f=ir.dot(Il);if(u>=0&&f<=u)return t.copy(r);let h=l*f-u*c;if(h<=0&&l>=0&&u<=0)return o=l/(l-u),t.copy(i).addScaledVector(nr,o);Dl.subVectors(e,s);let d=nr.dot(Dl),m=ir.dot(Dl);if(m>=0&&d<=m)return t.copy(s);let b=d*c-l*m;if(b<=0&&c>=0&&m<=0)return a=c/(c-m),t.copy(i).addScaledVector(ir,a);let g=u*m-d*f;if(g<=0&&f-u>=0&&d-m>=0)return Xu.subVectors(s,r),a=(f-u)/(f-u+(d-m)),t.copy(r).addScaledVector(Xu,a);let p=1/(g+b+h);return o=b*p,a=h*p,t.copy(i).addScaledVector(nr,o).addScaledVector(ir,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},Un=class{constructor(e=new k(1/0,1/0,1/0),t=new k(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(yn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(yn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let i=yn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let i=e.geometry;if(i!==void 0){let s=i.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=s.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,yn):yn.fromBufferAttribute(s,o),yn.applyMatrix4(e.matrixWorld),this.expandByPoint(yn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),io.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),io.copy(i.boundingBox)),io.applyMatrix4(e.matrixWorld),this.union(io)}let r=e.children;for(let s=0,o=r.length;s<o;s++)this.expandByObject(r[s],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,yn),yn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Hr),ro.subVectors(this.max,Hr),rr.subVectors(e.a,Hr),sr.subVectors(e.b,Hr),or.subVectors(e.c,Hr),ri.subVectors(sr,rr),si.subVectors(or,sr),Pi.subVectors(rr,or);let t=[0,-ri.z,ri.y,0,-si.z,si.y,0,-Pi.z,Pi.y,ri.z,0,-ri.x,si.z,0,-si.x,Pi.z,0,-Pi.x,-ri.y,ri.x,0,-si.y,si.x,0,-Pi.y,Pi.x,0];return!Ul(t,rr,sr,or,ro)||(t=[1,0,0,0,1,0,0,0,1],!Ul(t,rr,sr,or,ro))?!1:(so.crossVectors(ri,si),t=[so.x,so.y,so.z],Ul(t,rr,sr,or,ro))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,yn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(yn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(qn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),qn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),qn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),qn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),qn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),qn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),qn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),qn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(qn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},qn=[new k,new k,new k,new k,new k,new k,new k,new k],yn=new k,io=new Un,rr=new k,sr=new k,or=new k,ri=new k,si=new k,Pi=new k,Hr=new k,ro=new k,so=new k,Ii=new k;function Ul(n,e,t,i,r){for(let s=0,o=n.length-3;s<=o;s+=3){Ii.fromArray(n,s);let a=r.x*Math.abs(Ii.x)+r.y*Math.abs(Ii.y)+r.z*Math.abs(Ii.z),l=e.dot(Ii),c=t.dot(Ii),u=i.dot(Ii);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>a)return!1}return!0}var Pt=new k,oo=new De,Sp=0,Zt=class extends Mn{constructor(e,t,i=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Sp++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=Kl,this.updateRanges=[],this.gpuType=fn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let r=0,s=this.itemSize;r<s;r++)this.array[e+r]=t.array[i+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)oo.fromBufferAttribute(this,t),oo.applyMatrix3(e),this.setXY(t,oo.x,oo.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)Pt.fromBufferAttribute(this,t),Pt.applyMatrix3(e),this.setXYZ(t,Pt.x,Pt.y,Pt.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)Pt.fromBufferAttribute(this,t),Pt.applyMatrix4(e),this.setXYZ(t,Pt.x,Pt.y,Pt.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)Pt.fromBufferAttribute(this,t),Pt.applyNormalMatrix(e),this.setXYZ(t,Pt.x,Pt.y,Pt.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)Pt.fromBufferAttribute(this,t),Pt.transformDirection(e),this.setXYZ(t,Pt.x,Pt.y,Pt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=hr(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=Yt(i,this.array)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=hr(t,this.array)),t}setX(e,t){return this.normalized&&(t=Yt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=hr(t,this.array)),t}setY(e,t){return this.normalized&&(t=Yt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=hr(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Yt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=hr(t,this.array)),t}setW(e,t){return this.normalized&&(t=Yt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=Yt(t,this.array),i=Yt(i,this.array)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,r){return e*=this.itemSize,this.normalized&&(t=Yt(t,this.array),i=Yt(i,this.array),r=Yt(r,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this}setXYZW(e,t,i,r,s){return e*=this.itemSize,this.normalized&&(t=Yt(t,this.array),i=Yt(i,this.array),r=Yt(r,this.array),s=Yt(s,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Kl&&(e.usage=this.usage),e}dispose(){this.dispatchEvent({type:"dispose"})}},rs=class extends Zt{constructor(e,t,i){super(new Int8Array(e),t,i)}};var ss=class extends Zt{constructor(e,t,i){super(new Uint16Array(e),t,i)}};var os=class extends Zt{constructor(e,t,i){super(new Uint32Array(e),t,i)}};var ct=class extends Zt{constructor(e,t,i){super(new Float32Array(e),t,i)}},wp=new Un,Wr=new k,Ol=new k,ui=class{constructor(e=new k,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let i=this.center;t!==void 0?i.copy(t):wp.setFromPoints(e).getCenter(i);let r=0;for(let s=0,o=e.length;s<o;s++)r=Math.max(r,i.distanceToSquared(e[s]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Wr.subVectors(e,this.center);let t=Wr.lengthSq();if(t>this.radius*this.radius){let i=Math.sqrt(t),r=(i-this.radius)*.5;this.center.addScaledVector(Wr,r/i),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Ol.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Wr.copy(e.center).add(Ol)),this.expandByPoint(Wr.copy(e.center).sub(Ol))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},Tp=0,dn=new pt,Bl=new kt,ar=new k,on=new Un,Xr=new Un,Ut=new k,Rt=class n extends Mn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Tp++}),this.uuid=Rr(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Zf(e)?os:ss)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let s=new $e().getNormalMatrix(e);i.applyNormalMatrix(s),i.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return dn.makeRotationFromQuaternion(e),this.applyMatrix4(dn),this}rotateX(e){return dn.makeRotationX(e),this.applyMatrix4(dn),this}rotateY(e){return dn.makeRotationY(e),this.applyMatrix4(dn),this}rotateZ(e){return dn.makeRotationZ(e),this.applyMatrix4(dn),this}translate(e,t,i){return dn.makeTranslation(e,t,i),this.applyMatrix4(dn),this}scale(e,t,i){return dn.makeScale(e,t,i),this.applyMatrix4(dn),this}lookAt(e){return Bl.lookAt(e),Bl.updateMatrix(),this.applyMatrix4(Bl.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ar).negate(),this.translate(ar.x,ar.y,ar.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let i=[];for(let r=0,s=e.length;r<s;r++){let o=e[r];i.push(o.x,o.y,o.z||0)}this.setAttribute("position",new ct(i,3))}else{let i=Math.min(e.length,t.count);for(let r=0;r<i;r++){let s=e[r];t.setXYZ(r,s.x,s.y,s.z||0)}e.length>t.count&&Be("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Un);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ve("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new k(-1/0,-1/0,-1/0),new k(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,r=t.length;i<r;i++){let s=t[i];on.setFromBufferAttribute(s),this.morphTargetsRelative?(Ut.addVectors(this.boundingBox.min,on.min),this.boundingBox.expandByPoint(Ut),Ut.addVectors(this.boundingBox.max,on.max),this.boundingBox.expandByPoint(Ut)):(this.boundingBox.expandByPoint(on.min),this.boundingBox.expandByPoint(on.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ve('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ui);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ve("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new k,1/0);return}if(e){let i=this.boundingSphere.center;if(on.setFromBufferAttribute(e),t)for(let s=0,o=t.length;s<o;s++){let a=t[s];Xr.setFromBufferAttribute(a),this.morphTargetsRelative?(Ut.addVectors(on.min,Xr.min),on.expandByPoint(Ut),Ut.addVectors(on.max,Xr.max),on.expandByPoint(Ut)):(on.expandByPoint(Xr.min),on.expandByPoint(Xr.max))}on.getCenter(i);let r=0;for(let s=0,o=e.count;s<o;s++)Ut.fromBufferAttribute(e,s),r=Math.max(r,i.distanceToSquared(Ut));if(t)for(let s=0,o=t.length;s<o;s++){let a=t[s],l=this.morphTargetsRelative;for(let c=0,u=a.count;c<u;c++)Ut.fromBufferAttribute(a,c),l&&(ar.fromBufferAttribute(e,c),Ut.add(ar)),r=Math.max(r,i.distanceToSquared(Ut))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&Ve('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Ve("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=t.position,r=t.normal,s=t.uv,o=this.getAttribute("tangent");(o===void 0||o.count!==i.count)&&(o=new Zt(new Float32Array(4*i.count),4),this.setAttribute("tangent",o));let a=[],l=[];for(let x=0;x<i.count;x++)a[x]=new k,l[x]=new k;let c=new k,u=new k,f=new k,h=new De,d=new De,m=new De,b=new k,g=new k;function p(x,A,E){c.fromBufferAttribute(i,x),u.fromBufferAttribute(i,A),f.fromBufferAttribute(i,E),h.fromBufferAttribute(s,x),d.fromBufferAttribute(s,A),m.fromBufferAttribute(s,E),u.sub(c),f.sub(c),d.sub(h),m.sub(h);let R=1/(d.x*m.y-m.x*d.y);isFinite(R)&&(b.copy(u).multiplyScalar(m.y).addScaledVector(f,-d.y).multiplyScalar(R),g.copy(f).multiplyScalar(d.x).addScaledVector(u,-m.x).multiplyScalar(R),a[x].add(b),a[A].add(b),a[E].add(b),l[x].add(g),l[A].add(g),l[E].add(g))}let M=this.groups;M.length===0&&(M=[{start:0,count:e.count}]);for(let x=0,A=M.length;x<A;++x){let E=M[x],R=E.start,I=E.count;for(let N=R,U=R+I;N<U;N+=3)p(e.getX(N+0),e.getX(N+1),e.getX(N+2))}let T=new k,v=new k,C=new k,S=new k;function _(x){C.fromBufferAttribute(r,x),S.copy(C);let A=a[x];T.copy(A),T.sub(C.multiplyScalar(C.dot(A))).normalize(),v.crossVectors(S,A);let R=v.dot(l[x])<0?-1:1;o.setXYZW(x,T.x,T.y,T.z,R)}for(let x=0,A=M.length;x<A;++x){let E=M[x],R=E.start,I=E.count;for(let N=R,U=R+I;N<U;N+=3)_(e.getX(N+0)),_(e.getX(N+1)),_(e.getX(N+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==t.count)i=new Zt(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let h=0,d=i.count;h<d;h++)i.setXYZ(h,0,0,0);let r=new k,s=new k,o=new k,a=new k,l=new k,c=new k,u=new k,f=new k;if(e)for(let h=0,d=e.count;h<d;h+=3){let m=e.getX(h+0),b=e.getX(h+1),g=e.getX(h+2);r.fromBufferAttribute(t,m),s.fromBufferAttribute(t,b),o.fromBufferAttribute(t,g),u.subVectors(o,s),f.subVectors(r,s),u.cross(f),a.fromBufferAttribute(i,m),l.fromBufferAttribute(i,b),c.fromBufferAttribute(i,g),a.add(u),l.add(u),c.add(u),i.setXYZ(m,a.x,a.y,a.z),i.setXYZ(b,l.x,l.y,l.z),i.setXYZ(g,c.x,c.y,c.z)}else for(let h=0,d=t.count;h<d;h+=3)r.fromBufferAttribute(t,h+0),s.fromBufferAttribute(t,h+1),o.fromBufferAttribute(t,h+2),u.subVectors(o,s),f.subVectors(r,s),u.cross(f),i.setXYZ(h+0,u.x,u.y,u.z),i.setXYZ(h+1,u.x,u.y,u.z),i.setXYZ(h+2,u.x,u.y,u.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)Ut.fromBufferAttribute(e,t),Ut.normalize(),e.setXYZ(t,Ut.x,Ut.y,Ut.z)}toNonIndexed(){function e(a,l){let c=a.array,u=a.itemSize,f=a.normalized,h=new c.constructor(l.length*u),d=0,m=0;for(let b=0,g=l.length;b<g;b++){a.isInterleavedBufferAttribute?d=l[b]*a.data.stride+a.offset:d=l[b]*u;for(let p=0;p<u;p++)h[m++]=c[d++]}return new Zt(h,u,f)}if(this.index===null)return Be("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new n,i=this.index.array,r=this.attributes;for(let a in r){let l=r[a],c=e(l,i);t.setAttribute(a,c)}let s=this.morphAttributes;for(let a in s){let l=[],c=s[a];for(let u=0,f=c.length;u<f;u++){let h=c[u],d=e(h,i);l.push(d)}t.morphAttributes[a]=l}t.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let c=o[a];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let i=this.attributes;for(let l in i){let c=i[l];e.data.attributes[l]=c.toJSON(e.data)}let r={},s=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],u=[];for(let f=0,h=c.length;f<h;f++){let d=c[f];u.push(d.toJSON(e.data))}u.length>0&&(r[l]=u,s=!0)}s&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(e.data.boundingSphere=a.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let i=e.index;i!==null&&this.setIndex(i.clone());let r=e.attributes;for(let c in r){let u=r[c];this.setAttribute(c,u.clone(t))}let s=e.morphAttributes;for(let c in s){let u=[],f=s[c];for(let h=0,d=f.length;h<d;h++)u.push(f[h].clone(t));this.morphAttributes[c]=u}this.morphTargetsRelative=e.morphTargetsRelative;let o=e.groups;for(let c=0,u=o.length;c<u;c++){let f=o[c];this.addGroup(f.start,f.count,f.materialIndex)}let a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Ep=0,Zn=class extends Mn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Ep++}),this.uuid=Rr(),this.name="",this.type="Material",this.blending=Ui,this.side=bn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=To,this.blendDst=Eo,this.blendEquation=ci,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new qe(0,0,0),this.blendAlpha=0,this.depthFunc=Oi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Zl,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Fi,this.stencilZFail=Fi,this.stencilZPass=Fi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let i=e[t];if(i===void 0){Be(`Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){Be(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(i):r&&r.isVector2&&i&&i.isVector2||r&&r.isEuler&&i&&i.isEuler||r&&r.isVector3&&i&&i.isVector3?r.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Ui&&(i.blending=this.blending),this.side!==bn&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==To&&(i.blendSrc=this.blendSrc),this.blendDst!==Eo&&(i.blendDst=this.blendDst),this.blendEquation!==ci&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==Oi&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Zl&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Fi&&(i.stencilFail=this.stencilFail),this.stencilZFail!==Fi&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==Fi&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.allowOverride===!1&&(i.allowOverride=!1),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function r(s){let o=[];for(let a in s){let l=s[a];delete l.metadata,o.push(l)}return o}if(t){let s=r(e.textures),o=r(e.images);s.length>0&&(i.textures=s),o.length>0&&(i.images=o)}return i}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new qe().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let i=e.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new De().fromArray(i)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new De().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,i=null;if(t!==null){let r=t.length;i=new Array(r);for(let s=0;s!==r;++s)i[s]=t[s].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}};var Yn=new k,kl=new k,ao=new k,oi=new k,zl=new k,lo=new k,Vl=new k,Bi=class{constructor(e=new k,t=new k(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Yn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Yn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Yn.copy(this.origin).addScaledVector(this.direction,t),Yn.distanceToSquared(e))}distanceSqToSegment(e,t,i,r){kl.copy(e).add(t).multiplyScalar(.5),ao.copy(t).sub(e).normalize(),oi.copy(this.origin).sub(kl);let s=e.distanceTo(t)*.5,o=-this.direction.dot(ao),a=oi.dot(this.direction),l=-oi.dot(ao),c=oi.lengthSq(),u=Math.abs(1-o*o),f,h,d,m;if(u>0)if(f=o*l-a,h=o*a-l,m=s*u,f>=0)if(h>=-m)if(h<=m){let b=1/u;f*=b,h*=b,d=f*(f+o*h+2*a)+h*(o*f+h+2*l)+c}else h=s,f=Math.max(0,-(o*h+a)),d=-f*f+h*(h+2*l)+c;else h=-s,f=Math.max(0,-(o*h+a)),d=-f*f+h*(h+2*l)+c;else h<=-m?(f=Math.max(0,-(-o*s+a)),h=f>0?-s:Math.min(Math.max(-s,-l),s),d=-f*f+h*(h+2*l)+c):h<=m?(f=0,h=Math.min(Math.max(-s,-l),s),d=h*(h+2*l)+c):(f=Math.max(0,-(o*s+a)),h=f>0?s:Math.min(Math.max(-s,-l),s),d=-f*f+h*(h+2*l)+c);else h=o>0?-s:s,f=Math.max(0,-(o*h+a)),d=-f*f+h*(h+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,f),r&&r.copy(kl).addScaledVector(ao,h),d}intersectSphere(e,t){Yn.subVectors(e.center,this.origin);let i=Yn.dot(this.direction),r=Yn.dot(Yn)-i*i,s=e.radius*e.radius;if(r>s)return null;let o=Math.sqrt(s-r),a=i-o,l=i+o;return l<0?null:a<0?this.at(l,t):this.at(a,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){let i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,r,s,o,a,l,c=1/this.direction.x,u=1/this.direction.y,f=1/this.direction.z,h=this.origin;return c>=0?(i=(e.min.x-h.x)*c,r=(e.max.x-h.x)*c):(i=(e.max.x-h.x)*c,r=(e.min.x-h.x)*c),u>=0?(s=(e.min.y-h.y)*u,o=(e.max.y-h.y)*u):(s=(e.max.y-h.y)*u,o=(e.min.y-h.y)*u),i>o||s>r||((s>i||isNaN(i))&&(i=s),(o<r||isNaN(r))&&(r=o),f>=0?(a=(e.min.z-h.z)*f,l=(e.max.z-h.z)*f):(a=(e.max.z-h.z)*f,l=(e.min.z-h.z)*f),i>l||a>r)||((a>i||i!==i)&&(i=a),(l<r||r!==r)&&(r=l),r<0)?null:this.at(i>=0?i:r,t)}intersectsBox(e){return this.intersectBox(e,Yn)!==null}intersectTriangle(e,t,i,r,s){zl.subVectors(t,e),lo.subVectors(i,e),Vl.crossVectors(zl,lo);let o=this.direction.dot(Vl),a;if(o>0){if(r)return null;a=1}else if(o<0)a=-1,o=-o;else return null;oi.subVectors(this.origin,e);let l=a*this.direction.dot(lo.crossVectors(oi,lo));if(l<0)return null;let c=a*this.direction.dot(zl.cross(oi));if(c<0||l+c>o)return null;let u=-a*oi.dot(Vl);return u<0?null:this.at(u/o,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Kn=class extends Zn{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new qe(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Nn,this.combine=ra,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},qu=new pt,Di=new Bi,co=new ui,Yu=new k,uo=new k,ho=new k,fo=new k,Gl=new k,po=new k,$u=new k,mo=new k,yt=class extends kt{constructor(e=new Rt,t=new Kn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){let a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}getVertexPosition(e,t){let i=this.geometry,r=i.attributes.position,s=i.morphAttributes.position,o=i.morphTargetsRelative;t.fromBufferAttribute(r,e);let a=this.morphTargetInfluences;if(s&&a){po.set(0,0,0);for(let l=0,c=s.length;l<c;l++){let u=a[l],f=s[l];u!==0&&(Gl.fromBufferAttribute(f,e),o?po.addScaledVector(Gl,u):po.addScaledVector(Gl.sub(t),u))}t.add(po)}return t}raycast(e,t){let i=this.geometry,r=this.material,s=this.matrixWorld;r!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),co.copy(i.boundingSphere),co.applyMatrix4(s),Di.copy(e.ray).recast(e.near),!(co.containsPoint(Di.origin)===!1&&(Di.intersectSphere(co,Yu)===null||Di.origin.distanceToSquared(Yu)>(e.far-e.near)**2))&&(qu.copy(s).invert(),Di.copy(e.ray).applyMatrix4(qu),!(i.boundingBox!==null&&Di.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,Di)))}_computeIntersections(e,t,i){let r,s=this.geometry,o=this.material,a=s.index,l=s.attributes.position,c=s.attributes.uv,u=s.attributes.uv1,f=s.attributes.normal,h=s.groups,d=s.drawRange;if(a!==null)if(Array.isArray(o))for(let m=0,b=h.length;m<b;m++){let g=h[m],p=o[g.materialIndex],M=Math.max(g.start,d.start),T=Math.min(a.count,Math.min(g.start+g.count,d.start+d.count));for(let v=M,C=T;v<C;v+=3){let S=a.getX(v),_=a.getX(v+1),x=a.getX(v+2);r=go(this,p,e,i,c,u,f,S,_,x),r&&(r.faceIndex=Math.floor(v/3),r.face.materialIndex=g.materialIndex,t.push(r))}}else{let m=Math.max(0,d.start),b=Math.min(a.count,d.start+d.count);for(let g=m,p=b;g<p;g+=3){let M=a.getX(g),T=a.getX(g+1),v=a.getX(g+2);r=go(this,o,e,i,c,u,f,M,T,v),r&&(r.faceIndex=Math.floor(g/3),t.push(r))}}else if(l!==void 0)if(Array.isArray(o))for(let m=0,b=h.length;m<b;m++){let g=h[m],p=o[g.materialIndex],M=Math.max(g.start,d.start),T=Math.min(l.count,Math.min(g.start+g.count,d.start+d.count));for(let v=M,C=T;v<C;v+=3){let S=v,_=v+1,x=v+2;r=go(this,p,e,i,c,u,f,S,_,x),r&&(r.faceIndex=Math.floor(v/3),r.face.materialIndex=g.materialIndex,t.push(r))}}else{let m=Math.max(0,d.start),b=Math.min(l.count,d.start+d.count);for(let g=m,p=b;g<p;g+=3){let M=g,T=g+1,v=g+2;r=go(this,o,e,i,c,u,f,M,T,v),r&&(r.faceIndex=Math.floor(g/3),t.push(r))}}}};function Ap(n,e,t,i,r,s,o,a){let l;if(e.side===Jt?l=i.intersectTriangle(o,s,r,!0,a):l=i.intersectTriangle(r,s,o,e.side===bn,a),l===null)return null;mo.copy(a),mo.applyMatrix4(n.matrixWorld);let c=t.ray.origin.distanceTo(mo);return c<t.near||c>t.far?null:{distance:c,point:mo.clone(),object:n}}function go(n,e,t,i,r,s,o,a,l,c){n.getVertexPosition(a,uo),n.getVertexPosition(l,ho),n.getVertexPosition(c,fo);let u=Ap(n,e,t,i,uo,ho,fo,$u);if(u){let f=new k;li.getBarycoord($u,uo,ho,fo,f),r&&(u.uv=li.getInterpolatedAttribute(r,a,l,c,f,new De)),s&&(u.uv1=li.getInterpolatedAttribute(s,a,l,c,f,new De)),o&&(u.normal=li.getInterpolatedAttribute(o,a,l,c,f,new k),u.normal.dot(i.direction)>0&&u.normal.multiplyScalar(-1));let h={a,b:l,c,normal:new k,materialIndex:0};li.getNormal(uo,ho,fo,h.normal),u.face=h,u.barycoord=f}return u}var as=class extends Kt{constructor(e=null,t=1,i=1,r,s,o,a,l,c=Bt,u=Bt,f,h){super(null,o,a,l,c,u,r,s,f,h),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var ls=class extends Zt{constructor(e,t,i,r=1){super(e,t,i),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},lr=new pt,Zu=new pt,_o=[],Ku=new Un,Rp=new pt,qr=new yt,Yr=new ui,cs=class extends yt{constructor(e,t,i){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new ls(new Float32Array(i*16),16),this.instanceColor=null,this.morphTexture=null,this.count=i,this.boundingBox=null,this.boundingSphere=null;for(let r=0;r<i;r++)this.setMatrixAt(r,Rp)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new Un),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,lr),Ku.copy(e.boundingBox).applyMatrix4(lr),this.boundingBox.union(Ku)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new ui),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,lr),Yr.copy(e.boundingSphere).applyMatrix4(lr),this.boundingSphere.union(Yr)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let i=t.morphTargetInfluences,r=this.morphTexture.source.data.data,s=i.length+1,o=e*s+1;for(let a=0;a<i.length;a++)i[a]=r[o+a]}raycast(e,t){let i=this.matrixWorld,r=this.count;if(qr.geometry=this.geometry,qr.material=this.material,qr.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Yr.copy(this.boundingSphere),Yr.applyMatrix4(i),e.ray.intersectsSphere(Yr)!==!1))for(let s=0;s<r;s++){this.getMatrixAt(s,lr),Zu.multiplyMatrices(i,lr),qr.matrixWorld=Zu,qr.raycast(e,_o);for(let o=0,a=_o.length;o<a;o++){let l=_o[o];l.instanceId=s,l.object=this,t.push(l)}_o.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new ls(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let i=t.morphTargetInfluences,r=i.length+1;this.morphTexture===null&&(this.morphTexture=new as(new Float32Array(r*this.count),r,this.count,ha,fn));let s=this.morphTexture.source.data.data,o=0;for(let c=0;c<i.length;c++)o+=i[c];let a=this.geometry.morphTargetsRelative?1:1-o,l=r*e;return s[l]=a,s.set(i,l+1),this}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},Hl=new k,Cp=new k,Pp=new $e,zt=class{constructor(e=new k(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,r){return this.normal.set(e,t,i),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){let r=Hl.subVectors(i,t).cross(Cp.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,i=!0){let r=e.delta(Hl),s=this.normal.dot(r);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let o=-(e.start.dot(this.normal)+this.constant)/s;return i===!0&&(o<0||o>1)?null:t.copy(e.start).addScaledVector(r,o)}intersectsLine(e){let t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let i=t||Pp.getNormalMatrix(e),r=this.coplanarPoint(Hl).applyMatrix4(e),s=this.normal.applyMatrix3(i).normalize();return this.constant=-r.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},Li=new ui,Ip=new De(.5,.5),xo=new k,yr=class{constructor(e=new zt,t=new zt,i=new zt,r=new zt,s=new zt,o=new zt){this.planes=[e,t,i,r,s,o]}set(e,t,i,r,s,o){let a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(i),a[3].copy(r),a[4].copy(s),a[5].copy(o),this}copy(e){let t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=vn,i=!1){let r=this.planes,s=e.elements,o=s[0],a=s[1],l=s[2],c=s[3],u=s[4],f=s[5],h=s[6],d=s[7],m=s[8],b=s[9],g=s[10],p=s[11],M=s[12],T=s[13],v=s[14],C=s[15];if(r[0].setComponents(c-o,d-u,p-m,C-M).normalize(),r[1].setComponents(c+o,d+u,p+m,C+M).normalize(),r[2].setComponents(c+a,d+f,p+b,C+T).normalize(),r[3].setComponents(c-a,d-f,p-b,C-T).normalize(),i)r[4].setComponents(l,h,g,v).normalize(),r[5].setComponents(c-l,d-h,p-g,C-v).normalize();else if(r[4].setComponents(c-l,d-h,p-g,C-v).normalize(),t===vn)r[5].setComponents(c+l,d+h,p+g,C+v).normalize();else if(t===fr)r[5].setComponents(l,h,g,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Li.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Li.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Li)}intersectsSprite(e){Li.center.set(0,0,0);let t=Ip.distanceTo(e.center);return Li.radius=.7071067811865476+t,Li.applyMatrix4(e.matrixWorld),this.intersectsSphere(Li)}intersectsSphere(e){let t=this.planes,i=e.center,r=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(i)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let i=0;i<6;i++){let r=t[i];if(xo.x=r.normal.x>0?e.max.x:e.min.x,xo.y=r.normal.y>0?e.max.y:e.min.y,xo.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(xo)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var us=class extends Kt{constructor(e=[],t=gi,i,r,s,o,a,l,c,u){super(e,t,i,r,s,o,a,l,c,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},vr=class extends Kt{constructor(e,t,i,r,s,o,a,l,c){super(e,t,i,r,s,o,a,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}};var Jn=class extends Kt{constructor(e,t,i=Tn,r,s,o,a=Bt,l=Bt,c,u=Fn,f=1){if(u!==Fn&&u!==xi)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let h={width:e,height:t,depth:f};super(h,r,s,o,a,l,u,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new gr(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},zo=class extends Jn{constructor(e,t=Tn,i=gi,r,s,o=Bt,a=Bt,l,c=Fn){let u={width:e,height:e,depth:1},f=[u,u,u,u,u,u];super(e,e,t,i,r,s,o,a,l,c),this.image=f,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},hs=class extends Kt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},br=class n extends Rt{constructor(e=1,t=1,i=1,r=1,s=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:r,heightSegments:s,depthSegments:o};let a=this;r=Math.floor(r),s=Math.floor(s),o=Math.floor(o);let l=[],c=[],u=[],f=[],h=0,d=0;m("z","y","x",-1,-1,i,t,e,o,s,0),m("z","y","x",1,-1,i,t,-e,o,s,1),m("x","z","y",1,1,e,i,t,r,o,2),m("x","z","y",1,-1,e,i,-t,r,o,3),m("x","y","z",1,-1,e,t,i,r,s,4),m("x","y","z",-1,-1,e,t,-i,r,s,5),this.setIndex(l),this.setAttribute("position",new ct(c,3)),this.setAttribute("normal",new ct(u,3)),this.setAttribute("uv",new ct(f,2));function m(b,g,p,M,T,v,C,S,_,x,A){let E=v/_,R=C/x,I=v/2,N=C/2,U=S/2,F=_+1,O=x+1,D=0,G=0,K=new k;for(let Q=0;Q<O;Q++){let ne=Q*R-N;for(let ae=0;ae<F;ae++){let Ne=ae*E-I;K[b]=Ne*M,K[g]=ne*T,K[p]=U,c.push(K.x,K.y,K.z),K[b]=0,K[g]=0,K[p]=S>0?1:-1,u.push(K.x,K.y,K.z),f.push(ae/_),f.push(1-Q/x),D+=1}}for(let Q=0;Q<x;Q++)for(let ne=0;ne<_;ne++){let ae=h+ne+F*Q,Ne=h+ne+F*(Q+1),Ge=h+(ne+1)+F*(Q+1),Ae=h+(ne+1)+F*Q;l.push(ae,Ne,Ae),l.push(Ne,Ge,Ae),G+=6}a.addGroup(d,G,A),d+=G,h+=D}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};var ds=class n extends Rt{constructor(e=1,t=1,i=1,r=32,s=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:i,radialSegments:r,heightSegments:s,openEnded:o,thetaStart:a,thetaLength:l};let c=this;r=Math.floor(r),s=Math.floor(s);let u=[],f=[],h=[],d=[],m=0,b=[],g=i/2,p=0;M(),o===!1&&(e>0&&T(!0),t>0&&T(!1)),this.setIndex(u),this.setAttribute("position",new ct(f,3)),this.setAttribute("normal",new ct(h,3)),this.setAttribute("uv",new ct(d,2));function M(){let v=new k,C=new k,S=0,_=(t-e)/i;for(let x=0;x<=s;x++){let A=[],E=x/s,R=E*(t-e)+e;for(let I=0;I<=r;I++){let N=I/r,U=N*l+a,F=Math.sin(U),O=Math.cos(U);C.x=R*F,C.y=-E*i+g,C.z=R*O,f.push(C.x,C.y,C.z),v.set(F,_,O).normalize(),h.push(v.x,v.y,v.z),d.push(N,1-E),A.push(m++)}b.push(A)}for(let x=0;x<r;x++)for(let A=0;A<s;A++){let E=b[A][x],R=b[A+1][x],I=b[A+1][x+1],N=b[A][x+1];(e>0||A!==0)&&(u.push(E,R,N),S+=3),(t>0||A!==s-1)&&(u.push(R,I,N),S+=3)}c.addGroup(p,S,0),p+=S}function T(v){let C=m,S=new De,_=new k,x=0,A=v===!0?e:t,E=v===!0?1:-1;for(let I=1;I<=r;I++)f.push(0,g*E,0),h.push(0,E,0),d.push(.5,.5),m++;let R=m;for(let I=0;I<=r;I++){let U=I/r*l+a,F=Math.cos(U),O=Math.sin(U);_.x=A*O,_.y=g*E,_.z=A*F,f.push(_.x,_.y,_.z),h.push(0,E,0),S.x=F*.5+.5,S.y=O*.5*E+.5,d.push(S.x,S.y),m++}for(let I=0;I<r;I++){let N=C+I,U=R+I;v===!0?u.push(U,U+1,N):u.push(U+1,U,N),x+=3}c.addGroup(p,x,v===!0?1:2),p+=x}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}};var Vo=class n extends Rt{constructor(e=[],t=[],i=1,r=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:i,detail:r};let s=[],o=[];a(r),c(i),u(),this.setAttribute("position",new ct(s,3)),this.setAttribute("normal",new ct(s.slice(),3)),this.setAttribute("uv",new ct(o,2)),r===0?this.computeVertexNormals():this.normalizeNormals();function a(M){let T=new k,v=new k,C=new k;for(let S=0;S<t.length;S+=3)d(t[S+0],T),d(t[S+1],v),d(t[S+2],C),l(T,v,C,M)}function l(M,T,v,C){let S=C+1,_=[];for(let x=0;x<=S;x++){_[x]=[];let A=M.clone().lerp(v,x/S),E=T.clone().lerp(v,x/S),R=S-x;for(let I=0;I<=R;I++)I===0&&x===S?_[x][I]=A:_[x][I]=A.clone().lerp(E,I/R)}for(let x=0;x<S;x++)for(let A=0;A<2*(S-x)-1;A++){let E=Math.floor(A/2);A%2===0?(h(_[x][E+1]),h(_[x+1][E]),h(_[x][E])):(h(_[x][E+1]),h(_[x+1][E+1]),h(_[x+1][E]))}}function c(M){let T=new k;for(let v=0;v<s.length;v+=3)T.x=s[v+0],T.y=s[v+1],T.z=s[v+2],T.normalize().multiplyScalar(M),s[v+0]=T.x,s[v+1]=T.y,s[v+2]=T.z}function u(){let M=new k;for(let T=0;T<s.length;T+=3){M.x=s[T+0],M.y=s[T+1],M.z=s[T+2];let v=g(M)/2/Math.PI+.5,C=p(M)/Math.PI+.5;o.push(v,1-C)}m(),f()}function f(){for(let M=0;M<o.length;M+=6){let T=o[M+0],v=o[M+2],C=o[M+4],S=Math.max(T,v,C),_=Math.min(T,v,C);S>.9&&_<.1&&(T<.2&&(o[M+0]+=1),v<.2&&(o[M+2]+=1),C<.2&&(o[M+4]+=1))}}function h(M){s.push(M.x,M.y,M.z)}function d(M,T){let v=M*3;T.x=e[v+0],T.y=e[v+1],T.z=e[v+2]}function m(){let M=new k,T=new k,v=new k,C=new k,S=new De,_=new De,x=new De;for(let A=0,E=0;A<s.length;A+=9,E+=6){M.set(s[A+0],s[A+1],s[A+2]),T.set(s[A+3],s[A+4],s[A+5]),v.set(s[A+6],s[A+7],s[A+8]),S.set(o[E+0],o[E+1]),_.set(o[E+2],o[E+3]),x.set(o[E+4],o[E+5]),C.copy(M).add(T).add(v).divideScalar(3);let R=g(C);b(S,E+0,M,R),b(_,E+2,T,R),b(x,E+4,v,R)}}function b(M,T,v,C){C<0&&M.x===1&&(o[T]=M.x-1),v.x===0&&v.z===0&&(o[T]=C/2/Math.PI+.5)}function g(M){return Math.atan2(M.z,-M.x)}function p(M){return Math.atan2(-M.y,Math.sqrt(M.x*M.x+M.z*M.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.vertices,e.indices,e.radius,e.detail)}};function Dp(n,e,t=2){let i=e&&e.length,r=i?e[0]*t:n.length,s=Hh(n,0,r,t,!0),o=[];if(!s||s.next===s.prev)return o;let a,l,c;if(i&&(s=Op(n,e,s,t)),n.length>80*t){a=n[0],l=n[1];let u=a,f=l;for(let h=t;h<r;h+=t){let d=n[h],m=n[h+1];d<a&&(a=d),m<l&&(l=m),d>u&&(u=d),m>f&&(f=m)}c=Math.max(u-a,f-l),c=c!==0?32767/c:0}return fs(s,o,t,a,l,c,0),o}function Hh(n,e,t,i,r){let s;if(r===$p(n,e,t,i)>0)for(let o=e;o<t;o+=i)s=Ju(o/i|0,n[o],n[o+1],s);else for(let o=t-i;o>=e;o-=i)s=Ju(o/i|0,n[o],n[o+1],s);return s&&Mr(s,s.next)&&(ms(s),s=s.next),s}function ki(n,e){if(!n)return n;e||(e=n);let t=n,i;do if(i=!1,!t.steiner&&(Mr(t,t.next)||bt(t.prev,t,t.next)===0)){if(ms(t),t=e=t.prev,t===t.next)break;i=!0}else t=t.next;while(i||t!==e);return e}function fs(n,e,t,i,r,s,o){if(!n)return;!o&&s&&Gp(n,i,r,s);let a=n;for(;n.prev!==n.next;){let l=n.prev,c=n.next;if(s?Fp(n,i,r,s):Lp(n)){e.push(l.i,n.i,c.i),ms(n),n=c.next,a=c.next;continue}if(n=c,n===a){o?o===1?(n=Np(ki(n),e),fs(n,e,t,i,r,s,2)):o===2&&Up(n,e,t,i,r,s):fs(ki(n),e,t,i,r,s,1);break}}}function Lp(n){let e=n.prev,t=n,i=n.next;if(bt(e,t,i)>=0)return!1;let r=e.x,s=t.x,o=i.x,a=e.y,l=t.y,c=i.y,u=Math.min(r,s,o),f=Math.min(a,l,c),h=Math.max(r,s,o),d=Math.max(a,l,c),m=i.next;for(;m!==e;){if(m.x>=u&&m.x<=h&&m.y>=f&&m.y<=d&&$r(r,a,s,l,o,c,m.x,m.y)&&bt(m.prev,m,m.next)>=0)return!1;m=m.next}return!0}function Fp(n,e,t,i){let r=n.prev,s=n,o=n.next;if(bt(r,s,o)>=0)return!1;let a=r.x,l=s.x,c=o.x,u=r.y,f=s.y,h=o.y,d=Math.min(a,l,c),m=Math.min(u,f,h),b=Math.max(a,l,c),g=Math.max(u,f,h),p=Jl(d,m,e,t,i),M=Jl(b,g,e,t,i),T=n.prevZ,v=n.nextZ;for(;T&&T.z>=p&&v&&v.z<=M;){if(T.x>=d&&T.x<=b&&T.y>=m&&T.y<=g&&T!==r&&T!==o&&$r(a,u,l,f,c,h,T.x,T.y)&&bt(T.prev,T,T.next)>=0||(T=T.prevZ,v.x>=d&&v.x<=b&&v.y>=m&&v.y<=g&&v!==r&&v!==o&&$r(a,u,l,f,c,h,v.x,v.y)&&bt(v.prev,v,v.next)>=0))return!1;v=v.nextZ}for(;T&&T.z>=p;){if(T.x>=d&&T.x<=b&&T.y>=m&&T.y<=g&&T!==r&&T!==o&&$r(a,u,l,f,c,h,T.x,T.y)&&bt(T.prev,T,T.next)>=0)return!1;T=T.prevZ}for(;v&&v.z<=M;){if(v.x>=d&&v.x<=b&&v.y>=m&&v.y<=g&&v!==r&&v!==o&&$r(a,u,l,f,c,h,v.x,v.y)&&bt(v.prev,v,v.next)>=0)return!1;v=v.nextZ}return!0}function Np(n,e){let t=n;do{let i=t.prev,r=t.next.next;!Mr(i,r)&&Xh(i,t,t.next,r)&&ps(i,r)&&ps(r,i)&&(e.push(i.i,t.i,r.i),ms(t),ms(t.next),t=n=r),t=t.next}while(t!==n);return ki(t)}function Up(n,e,t,i,r,s){let o=n;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&Xp(o,a)){let l=qh(o,a);o=ki(o,o.next),l=ki(l,l.next),fs(o,e,t,i,r,s,0),fs(l,e,t,i,r,s,0);return}a=a.next}o=o.next}while(o!==n)}function Op(n,e,t,i){let r=[];for(let s=0,o=e.length;s<o;s++){let a=e[s]*i,l=s<o-1?e[s+1]*i:n.length,c=Hh(n,a,l,i,!1);c===c.next&&(c.steiner=!0),r.push(Wp(c))}r.sort(Bp);for(let s=0;s<r.length;s++)t=kp(r[s],t);return t}function Bp(n,e){let t=n.x-e.x;if(t===0&&(t=n.y-e.y,t===0)){let i=(n.next.y-n.y)/(n.next.x-n.x),r=(e.next.y-e.y)/(e.next.x-e.x);t=i-r}return t}function kp(n,e){let t=zp(n,e);if(!t)return e;let i=qh(t,n);return ki(i,i.next),ki(t,t.next)}function zp(n,e){let t=e,i=n.x,r=n.y,s=-1/0,o;if(Mr(n,t))return t;do{if(Mr(n,t.next))return t.next;if(r<=t.y&&r>=t.next.y&&t.next.y!==t.y){let f=t.x+(r-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(f<=i&&f>s&&(s=f,o=t.x<t.next.x?t:t.next,f===i))return o}t=t.next}while(t!==e);if(!o)return null;let a=o,l=o.x,c=o.y,u=1/0;t=o;do{if(i>=t.x&&t.x>=l&&i!==t.x&&Wh(r<c?i:s,r,l,c,r<c?s:i,r,t.x,t.y)){let f=Math.abs(r-t.y)/(i-t.x);ps(t,n)&&(f<u||f===u&&(t.x>o.x||t.x===o.x&&Vp(o,t)))&&(o=t,u=f)}t=t.next}while(t!==a);return o}function Vp(n,e){return bt(n.prev,n,e.prev)<0&&bt(e.next,n,n.next)<0}function Gp(n,e,t,i){let r=n;do r.z===0&&(r.z=Jl(r.x,r.y,e,t,i)),r.prevZ=r.prev,r.nextZ=r.next,r=r.next;while(r!==n);r.prevZ.nextZ=null,r.prevZ=null,Hp(r)}function Hp(n){let e,t=1;do{let i=n,r;n=null;let s=null;for(e=0;i;){e++;let o=i,a=0;for(let c=0;c<t&&(a++,o=o.nextZ,!!o);c++);let l=t;for(;a>0||l>0&&o;)a!==0&&(l===0||!o||i.z<=o.z)?(r=i,i=i.nextZ,a--):(r=o,o=o.nextZ,l--),s?s.nextZ=r:n=r,r.prevZ=s,s=r;i=o}s.nextZ=null,t*=2}while(e>1);return n}function Jl(n,e,t,i,r){return n=(n-t)*r|0,e=(e-i)*r|0,n=(n|n<<8)&16711935,n=(n|n<<4)&252645135,n=(n|n<<2)&858993459,n=(n|n<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,n|e<<1}function Wp(n){let e=n,t=n;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==n);return t}function Wh(n,e,t,i,r,s,o,a){return(r-o)*(e-a)>=(n-o)*(s-a)&&(n-o)*(i-a)>=(t-o)*(e-a)&&(t-o)*(s-a)>=(r-o)*(i-a)}function $r(n,e,t,i,r,s,o,a){return!(n===o&&e===a)&&Wh(n,e,t,i,r,s,o,a)}function Xp(n,e){return n.next.i!==e.i&&n.prev.i!==e.i&&!qp(n,e)&&(ps(n,e)&&ps(e,n)&&Yp(n,e)&&(bt(n.prev,n,e.prev)||bt(n,e.prev,e))||Mr(n,e)&&bt(n.prev,n,n.next)>0&&bt(e.prev,e,e.next)>0)}function bt(n,e,t){return(e.y-n.y)*(t.x-e.x)-(e.x-n.x)*(t.y-e.y)}function Mr(n,e){return n.x===e.x&&n.y===e.y}function Xh(n,e,t,i){let r=vo(bt(n,e,t)),s=vo(bt(n,e,i)),o=vo(bt(t,i,n)),a=vo(bt(t,i,e));return!!(r!==s&&o!==a||r===0&&yo(n,t,e)||s===0&&yo(n,i,e)||o===0&&yo(t,n,i)||a===0&&yo(t,e,i))}function yo(n,e,t){return e.x<=Math.max(n.x,t.x)&&e.x>=Math.min(n.x,t.x)&&e.y<=Math.max(n.y,t.y)&&e.y>=Math.min(n.y,t.y)}function vo(n){return n>0?1:n<0?-1:0}function qp(n,e){let t=n;do{if(t.i!==n.i&&t.next.i!==n.i&&t.i!==e.i&&t.next.i!==e.i&&Xh(t,t.next,n,e))return!0;t=t.next}while(t!==n);return!1}function ps(n,e){return bt(n.prev,n,n.next)<0?bt(n,e,n.next)>=0&&bt(n,n.prev,e)>=0:bt(n,e,n.prev)<0||bt(n,n.next,e)<0}function Yp(n,e){let t=n,i=!1,r=(n.x+e.x)/2,s=(n.y+e.y)/2;do t.y>s!=t.next.y>s&&t.next.y!==t.y&&r<(t.next.x-t.x)*(s-t.y)/(t.next.y-t.y)+t.x&&(i=!i),t=t.next;while(t!==n);return i}function qh(n,e){let t=jl(n.i,n.x,n.y),i=jl(e.i,e.x,e.y),r=n.next,s=e.prev;return n.next=e,e.prev=n,t.next=r,r.prev=t,i.next=t,t.prev=i,s.next=i,i.prev=s,i}function Ju(n,e,t,i){let r=jl(n,e,t);return i?(r.next=i.next,r.prev=i,i.next.prev=r,i.next=r):(r.prev=r,r.next=r),r}function ms(n){n.next.prev=n.prev,n.prev.next=n.next,n.prevZ&&(n.prevZ.nextZ=n.nextZ),n.nextZ&&(n.nextZ.prevZ=n.prevZ)}function jl(n,e,t){return{i:n,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function $p(n,e,t,i){let r=0;for(let s=e,o=t-i;s<t;s+=i)r+=(n[o]-n[s])*(n[s+1]+n[o+1]),o=s;return r}var Ql=class{static triangulate(e,t,i=2){return Dp(e,t,i)}},zi=class n{static area(e){let t=e.length,i=0;for(let r=t-1,s=0;s<t;r=s++)i+=e[r].x*e[s].y-e[s].x*e[r].y;return i*.5}static isClockWise(e){return n.area(e)<0}static triangulateShape(e,t){let i=[],r=[],s=[];ju(e),Qu(i,e);let o=e.length;t.forEach(ju);for(let l=0;l<t.length;l++)r.push(o),o+=t[l].length,Qu(i,t[l]);let a=Ql.triangulate(i,r);for(let l=0;l<a.length;l+=3)s.push(a.slice(l,l+3));return s}};function ju(n){let e=n.length;e>2&&n[e-1].equals(n[0])&&n.pop()}function Qu(n,e){for(let t=0;t<e.length;t++)n.push(e[t].x),n.push(e[t].y)}var gs=class n extends Vo{constructor(e=1,t=0){let i=(1+Math.sqrt(5))/2,r=[-1,i,0,1,i,0,-1,-i,0,1,-i,0,0,-1,i,0,1,i,0,-1,-i,0,1,-i,i,0,-1,i,0,1,-i,0,-1,-i,0,1],s=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(r,s,e,t),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new n(e.radius,e.detail)}};var Vi=class n extends Rt{constructor(e=1,t=1,i=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:r};let s=e/2,o=t/2,a=Math.floor(i),l=Math.floor(r),c=a+1,u=l+1,f=e/a,h=t/l,d=[],m=[],b=[],g=[];for(let p=0;p<u;p++){let M=p*h-o;for(let T=0;T<c;T++){let v=T*f-s;m.push(v,-M,0),b.push(0,0,1),g.push(T/a),g.push(1-p/l)}}for(let p=0;p<l;p++)for(let M=0;M<a;M++){let T=M+c*p,v=M+c*(p+1),C=M+1+c*(p+1),S=M+1+c*p;d.push(T,v,S),d.push(v,C,S)}this.setIndex(d),this.setAttribute("position",new ct(m,3)),this.setAttribute("normal",new ct(b,3)),this.setAttribute("uv",new ct(g,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.widthSegments,e.heightSegments)}};function Hi(n){let e={};for(let t in n){e[t]={};for(let i in n[t]){let r=n[t][i];if(eh(r))r.isRenderTargetTexture?(Be("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=r.clone();else if(Array.isArray(r))if(eh(r[0])){let s=[];for(let o=0,a=r.length;o<a;o++)s[o]=r[o].clone();e[t][i]=s}else e[t][i]=r.slice();else e[t][i]=r}}return e}function Xt(n){let e={};for(let t=0;t<n.length;t++){let i=Hi(n[t]);for(let r in i)e[r]=i[r]}return e}function eh(n){return n&&(n.isColor||n.isMatrix3||n.isMatrix4||n.isVector2||n.isVector3||n.isVector4||n.isTexture||n.isQuaternion)}function Zp(n){let e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function Ec(n){let e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:rt.workingColorSpace}var Yh={clone:Hi,merge:Xt},Kp=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Jp=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,cn=class extends Zn{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Kp,this.fragmentShader=Jp,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Hi(e.uniforms),this.uniformsGroups=Zp(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let r in this.uniforms){let o=this.uniforms[r].value;o&&o.isTexture?t.uniforms[r]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[r]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[r]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[r]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[r]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[r]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[r]={type:"m4",value:o.toArray()}:t.uniforms[r]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let i={};for(let r in this.extensions)this.extensions[r]===!0&&(i[r]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let i in e.uniforms){let r=e.uniforms[i];switch(this.uniforms[i]={},r.type){case"t":this.uniforms[i].value=t[r.value]||null;break;case"c":this.uniforms[i].value=new qe().setHex(r.value);break;case"v2":this.uniforms[i].value=new De().fromArray(r.value);break;case"v3":this.uniforms[i].value=new k().fromArray(r.value);break;case"v4":this.uniforms[i].value=new xt().fromArray(r.value);break;case"m3":this.uniforms[i].value=new $e().fromArray(r.value);break;case"m4":this.uniforms[i].value=new pt().fromArray(r.value);break;default:this.uniforms[i].value=r.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let i in e.extensions)this.extensions[i]=e.extensions[i];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},Go=class extends cn{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},Sn=class extends Zn{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new qe(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new qe(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Us,this.normalScale=new De(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Nn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},_s=class extends Sn{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new De(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return it(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new qe(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new qe(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new qe(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}};var xs=class extends Zn{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new qe(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new qe(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Us,this.normalScale=new De(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Nn,this.combine=ra,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},Ho=class extends Zn{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Ph,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},Wo=class extends Zn{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function bo(n,e){return!n||n.constructor===e?n:typeof e.BYTES_PER_ELEMENT=="number"?new e(n):Array.prototype.slice.call(n)}var hi=class{constructor(e,t,i,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r!==void 0?r:new t.constructor(i),this.sampleValues=t,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,i=this._cachedIndex,r=t[i],s=t[i-1];n:{e:{let o;t:{i:if(!(e<r)){for(let a=i+2;;){if(r===void 0){if(e<s)break i;return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===a)break;if(s=r,r=t[++i],e<r)break e}o=t.length;break t}if(!(e>=s)){let a=t[1];e<a&&(i=2,s=a);for(let l=i-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(r=s,s=t[--i-1],e>=s)break e}o=i,i=0;break t}break n}for(;i<o;){let a=i+o>>>1;e<t[a]?o=a:i=a+1}if(r=t[i],s=t[i-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,s,r)}return this.interpolate_(i,s,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,i=this.sampleValues,r=this.valueSize,s=e*r;for(let o=0;o!==r;++o)t[o]=i[s+o];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},Xo=class extends hi{constructor(e,t,i,r){super(e,t,i,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:ql,endingEnd:ql}}intervalChanged_(e,t,i){let r=this.parameterPositions,s=e-2,o=e+1,a=r[s],l=r[o];if(a===void 0)switch(this.getSettings_().endingStart){case Yl:s=e,a=2*t-i;break;case $l:s=r.length-2,a=t+r[s]-r[s+1];break;default:s=e,a=i}if(l===void 0)switch(this.getSettings_().endingEnd){case Yl:o=e,l=2*i-t;break;case $l:o=1,l=i+r[1]-r[0];break;default:o=e-1,l=t}let c=(i-t)*.5,u=this.valueSize;this._weightPrev=c/(t-a),this._weightNext=c/(l-i),this._offsetPrev=s*u,this._offsetNext=o*u}interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,u=this._offsetPrev,f=this._offsetNext,h=this._weightPrev,d=this._weightNext,m=(i-t)/(r-t),b=m*m,g=b*m,p=-h*g+2*h*b-h*m,M=(1+h)*g+(-1.5-2*h)*b+(-.5+h)*m+1,T=(-1-d)*g+(1.5+d)*b+.5*m,v=d*g-d*b;for(let C=0;C!==a;++C)s[C]=p*o[u+C]+M*o[c+C]+T*o[l+C]+v*o[f+C];return s}},qo=class extends hi{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,u=(i-t)/(r-t),f=1-u;for(let h=0;h!==a;++h)s[h]=o[c+h]*f+o[l+h]*u;return s}},Yo=class extends hi{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e){return this.copySampleValue_(e-1)}},$o=class extends hi{interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,u=this.inTangents,f=this.outTangents;if(!u||!f){let m=(i-t)/(r-t),b=1-m;for(let g=0;g!==a;++g)s[g]=o[c+g]*b+o[l+g]*m;return s}let h=a*2,d=e-1;for(let m=0;m!==a;++m){let b=o[c+m],g=o[l+m],p=d*h+m*2,M=f[p],T=f[p+1],v=e*h+m*2,C=u[v],S=u[v+1],_=(i-t)/(r-t),x,A,E,R,I;for(let N=0;N<8;N++){x=_*_,A=x*_,E=1-_,R=E*E,I=R*E;let F=I*t+3*R*_*M+3*E*x*C+A*r-i;if(Math.abs(F)<1e-10)break;let O=3*R*(M-t)+6*E*_*(C-M)+3*x*(r-C);if(Math.abs(O)<1e-10)break;_=_-F/O,_=Math.max(0,Math.min(1,_))}s[m]=I*b+3*R*_*T+3*E*x*S+A*g}return s}},un=class{constructor(e,t,i,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=bo(t,this.TimeBufferType),this.values=bo(i,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,i;if(t.toJSON!==this.toJSON)i=t.toJSON(e);else{i={name:e.name,times:bo(e.times,Array),values:bo(e.values,Array)};let r=e.getInterpolation();r!==e.DefaultInterpolation&&(i.interpolation=r)}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new Yo(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new qo(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Xo(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new $o(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case Jr:t=this.InterpolantFactoryMethodDiscrete;break;case Uo:t=this.InterpolantFactoryMethodLinear;break;case wo:t=this.InterpolantFactoryMethodSmooth;break;case Xl:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return Be("KeyframeTrack:",i),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Jr;case this.InterpolantFactoryMethodLinear:return Uo;case this.InterpolantFactoryMethodSmooth:return wo;case this.InterpolantFactoryMethodBezier:return Xl}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]*=e}return this}trim(e,t){let i=this.times,r=i.length,s=0,o=r-1;for(;s!==r&&i[s]<e;)++s;for(;o!==-1&&i[o]>t;)--o;if(++o,s!==0||o!==r){s>=o&&(o=Math.max(o,1),s=o-1);let a=this.getValueSize();this.times=i.slice(s,o),this.values=this.values.slice(s*a,o*a)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(Ve("KeyframeTrack: Invalid value size in track.",this),e=!1);let i=this.times,r=this.values,s=i.length;s===0&&(Ve("KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==s;a++){let l=i[a];if(typeof l=="number"&&isNaN(l)){Ve("KeyframeTrack: Time is not a valid number.",this,a,l),e=!1;break}if(o!==null&&o>l){Ve("KeyframeTrack: Out of order keys.",this,a,l,o),e=!1;break}o=l}if(r!==void 0&&Kf(r))for(let a=0,l=r.length;a!==l;++a){let c=r[a];if(isNaN(c)){Ve("KeyframeTrack: Value is not a valid number.",this,a,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),i=this.getValueSize(),r=this.getInterpolation()===wo,s=e.length-1,o=1;for(let a=1;a<s;++a){let l=!1,c=e[a],u=e[a+1];if(c!==u&&(a!==1||c!==e[0]))if(r)l=!0;else{let f=a*i,h=f-i,d=f+i;for(let m=0;m!==i;++m){let b=t[f+m];if(b!==t[h+m]||b!==t[d+m]){l=!0;break}}}if(l){if(a!==o){e[o]=e[a];let f=a*i,h=o*i;for(let d=0;d!==i;++d)t[h+d]=t[f+d]}++o}}if(s>0){e[o]=e[s];for(let a=s*i,l=o*i,c=0;c!==i;++c)t[l+c]=t[a+c];++o}return o!==e.length?(this.times=e.slice(0,o),this.values=t.slice(0,o*i)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),i=this.constructor,r=new i(this.name,e,t);return r.createInterpolant=this.createInterpolant,r}};un.prototype.ValueTypeName="";un.prototype.TimeBufferType=Float32Array;un.prototype.ValueBufferType=Float32Array;un.prototype.DefaultInterpolation=Uo;var di=class extends un{constructor(e,t,i){super(e,t,i)}};di.prototype.ValueTypeName="bool";di.prototype.ValueBufferType=Array;di.prototype.DefaultInterpolation=Jr;di.prototype.InterpolantFactoryMethodLinear=void 0;di.prototype.InterpolantFactoryMethodSmooth=void 0;var Zo=class extends un{constructor(e,t,i,r){super(e,t,i,r)}};Zo.prototype.ValueTypeName="color";var Ko=class extends un{constructor(e,t,i,r){super(e,t,i,r)}};Ko.prototype.ValueTypeName="number";var Jo=class extends hi{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(i-t)/(r-t),c=e*a;for(let u=c+a;c!==u;c+=4)an.slerpFlat(s,0,o,c-a,o,c,l);return s}},ys=class extends un{constructor(e,t,i,r){super(e,t,i,r)}InterpolantFactoryMethodLinear(e){return new Jo(this.times,this.values,this.getValueSize(),e)}};ys.prototype.ValueTypeName="quaternion";ys.prototype.InterpolantFactoryMethodSmooth=void 0;var fi=class extends un{constructor(e,t,i){super(e,t,i)}};fi.prototype.ValueTypeName="string";fi.prototype.ValueBufferType=Array;fi.prototype.DefaultInterpolation=Jr;fi.prototype.InterpolantFactoryMethodLinear=void 0;fi.prototype.InterpolantFactoryMethodSmooth=void 0;var jo=class extends un{constructor(e,t,i,r){super(e,t,i,r)}};jo.prototype.ValueTypeName="vector";var Qo=class{constructor(e,t,i){let r=this,s=!1,o=0,a=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=i,this._abortController=null,this.itemStart=function(u){a++,s===!1&&r.onStart!==void 0&&r.onStart(u,o,a),s=!0},this.itemEnd=function(u){o++,r.onProgress!==void 0&&r.onProgress(u,o,a),o===a&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(u){r.onError!==void 0&&r.onError(u)},this.resolveURL=function(u){return u=u.normalize("NFC"),l?l(u):u},this.setURLModifier=function(u){return l=u,this},this.addHandler=function(u,f){return c.push(u,f),this},this.removeHandler=function(u){let f=c.indexOf(u);return f!==-1&&c.splice(f,2),this},this.getHandler=function(u){for(let f=0,h=c.length;f<h;f+=2){let d=c[f],m=c[f+1];if(d.global&&(d.lastIndex=0),d.test(u))return m}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},$h=new Qo,ea=class{constructor(e){this.manager=e!==void 0?e:$h,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let i=this;return new Promise(function(r,s){i.load(e,r,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};ea.DEFAULT_MATERIAL_NAME="__DEFAULT";var vs=class extends kt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new qe(e),this.intensity=t}dispose(){this.dispatchEvent({type:"dispose"})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},bs=class extends vs{constructor(e,t,i){super(e,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(kt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new qe(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},Wl=new pt,th=new k,nh=new k,ec=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new De(512,512),this.mapType=Qt,this.map=null,this.mapPass=null,this.matrix=new pt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new yr,this._frameExtents=new De(1,1),this._viewportCount=1,this._viewports=[new xt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,i=this.matrix;th.setFromMatrixPosition(e.matrixWorld),t.position.copy(th),nh.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(nh),t.updateMatrixWorld(),Wl.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Wl,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===fr||t.reversedDepth?i.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(Wl)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},Mo=new k,So=new an,Dn=new k,Ms=class extends kt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new pt,this.projectionMatrix=new pt,this.projectionMatrixInverse=new pt,this.coordinateSystem=vn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(Mo,So,Dn),Dn.x===1&&Dn.y===1&&Dn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Mo,So,Dn.set(1,1,1)).invert()}updateWorldMatrix(e,t,i=!1){super.updateWorldMatrix(e,t,i),this.matrixWorld.decompose(Mo,So,Dn),Dn.x===1&&Dn.y===1&&Dn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Mo,So,Dn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},ai=new k,ih=new De,rh=new De,Wt=class extends Ms{constructor(e=50,t=1,i=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=mr*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Zr*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return mr*2*Math.atan(Math.tan(Zr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){ai.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(ai.x,ai.y).multiplyScalar(-e/ai.z),ai.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(ai.x,ai.y).multiplyScalar(-e/ai.z)}getViewSize(e,t){return this.getViewBounds(e,ih,rh),t.subVectors(rh,ih)}setViewOffset(e,t,i,r,s,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Zr*.5*this.fov)/this.zoom,i=2*t,r=this.aspect*i,s=-.5*r,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,c=o.fullHeight;s+=o.offsetX*r/l,t-=o.offsetY*i/c,r*=o.width/l,i*=o.height/c}let a=this.filmOffset;a!==0&&(s+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+r,t,t-i,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}};var Sr=class extends Ms{constructor(e=-1,t=1,i=1,r=-1,s=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=r,this.near=s,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,r,s,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,r=(this.top+this.bottom)/2,s=i-e,o=i+e,a=r+t,l=r-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,o=s+c*this.view.width,a-=u*this.view.offsetY,l=a-u*this.view.height}this.projectionMatrix.makeOrthographic(s,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},tc=class extends ec{constructor(){super(new Sr(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Ss=class extends vs{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(kt.DEFAULT_UP),this.updateMatrix(),this.target=new kt,this.shadow=new tc}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}};var cr=-90,ur=1,ta=class extends kt{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new Wt(cr,ur,e,t);r.layers=this.layers,this.add(r);let s=new Wt(cr,ur,e,t);s.layers=this.layers,this.add(s);let o=new Wt(cr,ur,e,t);o.layers=this.layers,this.add(o);let a=new Wt(cr,ur,e,t);a.layers=this.layers,this.add(a);let l=new Wt(cr,ur,e,t);l.layers=this.layers,this.add(l);let c=new Wt(cr,ur,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[i,r,s,o,a,l]=t;for(let c of t)this.remove(c);if(e===vn)i.up.set(0,1,0),i.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===fr)i.up.set(0,-1,0),i.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[s,o,a,l,c,u]=this.children,f=e.getRenderTarget(),h=e.getActiveCubeFace(),d=e.getActiveMipmapLevel(),m=e.xr.enabled;e.xr.enabled=!1;let b=i.texture.generateMipmaps;i.texture.generateMipmaps=!1;let g=!1;e.isWebGLRenderer===!0?g=e.state.buffers.depth.getReversed():g=e.reversedDepthBuffer,e.setRenderTarget(i,0,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(i,1,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(i,2,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(i,3,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(i,4,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),i.texture.generateMipmaps=b,e.setRenderTarget(i,5,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,u),e.setRenderTarget(f,h,d),e.xr.enabled=m,i.texture.needsPMREMUpdate=!0}},na=class extends Wt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}};var Ac="\\[\\]\\.:\\/",jp=new RegExp("["+Ac+"]","g"),Rc="[^"+Ac+"]",Qp="[^"+Ac.replace("\\.","")+"]",em=/((?:WC+[\/:])*)/.source.replace("WC",Rc),tm=/(WCOD+)?/.source.replace("WCOD",Qp),nm=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Rc),im=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Rc),rm=new RegExp("^"+em+tm+nm+im+"$"),sm=["material","materials","bones","map"],nc=class{constructor(e,t,i){let r=i||_t.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let i=this._targetGroup.nCachedObjects_,r=this._bindings[i];r!==void 0&&r.getValue(e,t)}setValue(e,t){let i=this._bindings;for(let r=this._targetGroup.nCachedObjects_,s=i.length;r!==s;++r)i[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].unbind()}},_t=class n{constructor(e,t,i){this.path=t,this.parsedPath=i||n.parseTrackName(t),this.node=n.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,i){return e&&e.isAnimationObjectGroup?new n.Composite(e,t,i):new n(e,t,i)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(jp,"")}static parseTrackName(e){let t=rm.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let i={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=i.nodeName&&i.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){let s=i.nodeName.substring(r+1);sm.indexOf(s)!==-1&&(i.nodeName=i.nodeName.substring(0,r),i.objectName=s)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return i}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let i=e.skeleton.getBoneByName(t);if(i!==void 0)return i}if(e.children){let i=function(s){for(let o=0;o<s.length;o++){let a=s[o];if(a.name===t||a.uuid===t)return a;let l=i(a.children);if(l)return l}return null},r=i(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)e[t++]=i[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,i=t.objectName,r=t.propertyName,s=t.propertyIndex;if(e||(e=n.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){Be("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=t.objectIndex;switch(i){case"materials":if(!e.material){Ve("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Ve("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Ve("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let u=0;u<e.length;u++)if(e[u].name===c){c=u;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Ve("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Ve("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[i]===void 0){Ve("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[i]}if(c!==void 0){if(e[c]===void 0){Ve("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let o=e[r];if(o===void 0){let c=t.nodeName;Ve("PropertyBinding: Trying to update property for track: "+c+"."+r+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?a=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(r==="morphTargetInfluences"){if(!e.geometry){Ve("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Ve("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=s}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=r;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};_t.Composite=nc;_t.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};_t.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};_t.prototype.GetterByBindingType=[_t.prototype._getValue_direct,_t.prototype._getValue_array,_t.prototype._getValue_arrayElement,_t.prototype._getValue_toArray];_t.prototype.SetterByBindingTypeAndVersioning=[[_t.prototype._setValue_direct,_t.prototype._setValue_direct_setNeedsUpdate,_t.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[_t.prototype._setValue_array,_t.prototype._setValue_array_setNeedsUpdate,_t.prototype._setValue_array_setMatrixWorldNeedsUpdate],[_t.prototype._setValue_arrayElement,_t.prototype._setValue_arrayElement_setNeedsUpdate,_t.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[_t.prototype._setValue_fromArray,_t.prototype._setValue_fromArray_setNeedsUpdate,_t.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var Tv=new Float32Array(1);var sh=new pt,ws=class{constructor(e,t,i=0,r=1/0){this.ray=new Bi(e,t),this.near=i,this.far=r,this.camera=null,this.layers=new _r,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,t.projectionMatrix.elements[14]).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):Ve("Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return sh.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(sh),this}intersectObject(e,t=!0,i=[]){return ic(e,this,i,t),i.sort(oh),i}intersectObjects(e,t=!0,i=[]){for(let r=0,s=e.length;r<s;r++)ic(e[r],this,i,t);return i.sort(oh),i}};function oh(n,e){return n.distance-e.distance}function ic(n,e,t,i){let r=!0;if(n.layers.test(e.layers)&&n.raycast(e,t)===!1&&(r=!1),r===!0&&i===!0){let s=n.children;for(let o=0,a=s.length;o<a;o++)ic(s[o],e,t,!0)}}var wr=class{constructor(e=1,t=0,i=0){this.radius=e,this.phi=t,this.theta=i}set(e,t,i){return this.radius=e,this.phi=t,this.theta=i,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=it(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,i){return this.radius=Math.sqrt(e*e+t*t+i*i),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,i),this.phi=Math.acos(it(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var rc=class n{static{n.prototype.isMatrix2=!0}constructor(e,t,i,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,i,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let i=0;i<4;i++)this.elements[i]=e[i+t];return this}set(e,t,i,r){let s=this.elements;return s[0]=e,s[2]=t,s[1]=i,s[3]=r,this}};var Ts=class extends Mn{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){if(e===void 0){Be("Controls: connect() now requires an element.");return}this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}};function Cc(n,e,t,i){let r=om(i);switch(t){case vc:return n*e;case ha:return n*e/r.components*r.byteLength;case da:return n*e/r.components*r.byteLength;case yi:return n*e*2/r.components*r.byteLength;case fa:return n*e*2/r.components*r.byteLength;case bc:return n*e*3/r.components*r.byteLength;case pn:return n*e*4/r.components*r.byteLength;case pa:return n*e*4/r.components*r.byteLength;case Ps:case Is:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case Ds:case Ls:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case ga:case xa:return Math.max(n,16)*Math.max(e,8)/4;case ma:case _a:return Math.max(n,8)*Math.max(e,8)/2;case ya:case va:case Ma:case Sa:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case ba:case Fs:case wa:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Ta:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Ea:return Math.floor((n+4)/5)*Math.floor((e+3)/4)*16;case Aa:return Math.floor((n+4)/5)*Math.floor((e+4)/5)*16;case Ra:return Math.floor((n+5)/6)*Math.floor((e+4)/5)*16;case Ca:return Math.floor((n+5)/6)*Math.floor((e+5)/6)*16;case Pa:return Math.floor((n+7)/8)*Math.floor((e+4)/5)*16;case Ia:return Math.floor((n+7)/8)*Math.floor((e+5)/6)*16;case Da:return Math.floor((n+7)/8)*Math.floor((e+7)/8)*16;case La:return Math.floor((n+9)/10)*Math.floor((e+4)/5)*16;case Fa:return Math.floor((n+9)/10)*Math.floor((e+5)/6)*16;case Na:return Math.floor((n+9)/10)*Math.floor((e+7)/8)*16;case Ua:return Math.floor((n+9)/10)*Math.floor((e+9)/10)*16;case Oa:return Math.floor((n+11)/12)*Math.floor((e+9)/10)*16;case Ba:return Math.floor((n+11)/12)*Math.floor((e+11)/12)*16;case ka:case za:case Va:return Math.ceil(n/4)*Math.ceil(e/4)*16;case Ga:case Ha:return Math.ceil(n/4)*Math.ceil(e/4)*8;case Ns:case Wa:return Math.ceil(n/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function om(n){switch(n){case Qt:case gc:return{byteLength:1,components:1};case Er:case _c:case Bn:return{byteLength:2,components:1};case ca:case ua:return{byteLength:2,components:4};case Tn:case la:case fn:return{byteLength:4,components:1};case xc:case yc:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${n}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"185"}}));typeof window<"u"&&(window.__THREE__?Be("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="185");function _d(){let n=null,e=!1,t=null,i=null;function r(s,o){t(s,o),i=n.requestAnimationFrame(r)}return{start:function(){e!==!0&&t!==null&&n!==null&&(i=n.requestAnimationFrame(r),e=!0)},stop:function(){n!==null&&n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){n=s}}}function lm(n){let e=new WeakMap;function t(a,l){let c=a.array,u=a.usage,f=c.byteLength,h=n.createBuffer();n.bindBuffer(l,h),n.bufferData(l,c,u),a.onUploadCallback();let d;if(c instanceof Float32Array)d=n.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)d=n.HALF_FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?d=n.HALF_FLOAT:d=n.UNSIGNED_SHORT;else if(c instanceof Int16Array)d=n.SHORT;else if(c instanceof Uint32Array)d=n.UNSIGNED_INT;else if(c instanceof Int32Array)d=n.INT;else if(c instanceof Int8Array)d=n.BYTE;else if(c instanceof Uint8Array)d=n.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)d=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:h,type:d,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:f}}function i(a,l,c){let u=l.array,f=l.updateRanges;if(n.bindBuffer(c,a),f.length===0)n.bufferSubData(c,0,u);else{f.sort((d,m)=>d.start-m.start);let h=0;for(let d=1;d<f.length;d++){let m=f[h],b=f[d];b.start<=m.start+m.count+1?m.count=Math.max(m.count,b.start+b.count-m.start):(++h,f[h]=b)}f.length=h+1;for(let d=0,m=f.length;d<m;d++){let b=f[d];n.bufferSubData(c,b.start*u.BYTES_PER_ELEMENT,u,b.start,b.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function s(a){a.isInterleavedBufferAttribute&&(a=a.data);let l=e.get(a);l&&(n.deleteBuffer(l.buffer),e.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let u=e.get(a);(!u||u.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let c=e.get(a);if(c===void 0)e.set(a,t(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,a,l),c.version=a.version}}return{get:r,remove:s,update:o}}var cm=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,um=`#ifdef USE_ALPHAHASH
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
#endif`,hm=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,dm=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,fm=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,pm=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,mm=`#ifdef USE_AOMAP
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
#endif`,gm=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,_m=`#ifdef USE_BATCHING
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
#endif`,xm=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,ym=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,vm=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bm=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,Mm=`#ifdef USE_IRIDESCENCE
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
#endif`,Sm=`#ifdef USE_BUMPMAP
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
#endif`,wm=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,Tm=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Em=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Am=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Rm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Cm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Pm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Im=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,Dm=`#define PI 3.141592653589793
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
} // validated`,Lm=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,Fm=`vec3 transformedNormal = objectNormal;
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
#endif`,Nm=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Um=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Om=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Bm=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,km="gl_FragColor = linearToOutputTexel( gl_FragColor );",zm=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Vm=`#ifdef USE_ENVMAP
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
#endif`,Gm=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Hm=`#ifdef USE_ENVMAP
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
#endif`,Wm=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Xm=`#ifdef USE_ENVMAP
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
#endif`,qm=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Ym=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,$m=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Zm=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Km=`#ifdef USE_GRADIENTMAP
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
}`,Jm=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,jm=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Qm=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,eg=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,tg=`#ifdef USE_ENVMAP
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
#endif`,ng=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,ig=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,rg=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,sg=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,og=`PhysicalMaterial material;
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
#endif`,ag=`uniform sampler2D dfgLUT;
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
}`,lg=`
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
#endif`,cg=`#if defined( RE_IndirectDiffuse )
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
#endif`,ug=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,hg=`#ifdef USE_LIGHT_PROBES_GRID
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
#endif`,dg=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,fg=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,pg=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,mg=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,gg=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,_g=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,xg=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,yg=`#if defined( USE_POINTS_UV )
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
#endif`,vg=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,bg=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Mg=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Sg=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,wg=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Tg=`#ifdef USE_MORPHTARGETS
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
#endif`,Eg=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Ag=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,Rg=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,Cg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Pg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Ig=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Dg=`#ifdef USE_NORMALMAP
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
#endif`,Lg=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Fg=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Ng=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Ug=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Og=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Bg=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,kg=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,zg=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Vg=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Gg=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Hg=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Wg=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Xg=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,qg=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,Yg=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,$g=`float getShadowMask() {
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
}`,Zg=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Kg=`#ifdef USE_SKINNING
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
#endif`,Jg=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,jg=`#ifdef USE_SKINNING
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
#endif`,Qg=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,e0=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,t0=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,n0=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,i0=`#ifdef USE_TRANSMISSION
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
#endif`,r0=`#ifdef USE_TRANSMISSION
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
#endif`,s0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,o0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,a0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,l0=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,c0=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,u0=`uniform sampler2D t2D;
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
}`,h0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,d0=`#ifdef ENVMAP_TYPE_CUBE
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
}`,f0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,p0=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,m0=`#include <common>
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
}`,g0=`#if DEPTH_PACKING == 3200
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
}`,_0=`#define DISTANCE
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
}`,x0=`#define DISTANCE
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
}`,y0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,v0=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,b0=`uniform float scale;
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
}`,M0=`uniform vec3 diffuse;
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
}`,S0=`#include <common>
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
}`,w0=`uniform vec3 diffuse;
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
}`,T0=`#define LAMBERT
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
}`,E0=`#define LAMBERT
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
}`,A0=`#define MATCAP
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
}`,R0=`#define MATCAP
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
}`,C0=`#define NORMAL
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
}`,P0=`#define NORMAL
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
}`,I0=`#define PHONG
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
}`,D0=`#define PHONG
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
}`,L0=`#define STANDARD
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
}`,F0=`#define STANDARD
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
}`,N0=`#define TOON
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
}`,U0=`#define TOON
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
}`,O0=`uniform float size;
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
}`,B0=`uniform vec3 diffuse;
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
}`,k0=`#include <common>
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
}`,z0=`uniform vec3 color;
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
}`,V0=`uniform float rotation;
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
}`,G0=`uniform vec3 diffuse;
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
}`,tt={alphahash_fragment:cm,alphahash_pars_fragment:um,alphamap_fragment:hm,alphamap_pars_fragment:dm,alphatest_fragment:fm,alphatest_pars_fragment:pm,aomap_fragment:mm,aomap_pars_fragment:gm,batching_pars_vertex:_m,batching_vertex:xm,begin_vertex:ym,beginnormal_vertex:vm,bsdfs:bm,iridescence_fragment:Mm,bumpmap_pars_fragment:Sm,clipping_planes_fragment:wm,clipping_planes_pars_fragment:Tm,clipping_planes_pars_vertex:Em,clipping_planes_vertex:Am,color_fragment:Rm,color_pars_fragment:Cm,color_pars_vertex:Pm,color_vertex:Im,common:Dm,cube_uv_reflection_fragment:Lm,defaultnormal_vertex:Fm,displacementmap_pars_vertex:Nm,displacementmap_vertex:Um,emissivemap_fragment:Om,emissivemap_pars_fragment:Bm,colorspace_fragment:km,colorspace_pars_fragment:zm,envmap_fragment:Vm,envmap_common_pars_fragment:Gm,envmap_pars_fragment:Hm,envmap_pars_vertex:Wm,envmap_physical_pars_fragment:tg,envmap_vertex:Xm,fog_vertex:qm,fog_pars_vertex:Ym,fog_fragment:$m,fog_pars_fragment:Zm,gradientmap_pars_fragment:Km,lightmap_pars_fragment:Jm,lights_lambert_fragment:jm,lights_lambert_pars_fragment:Qm,lights_pars_begin:eg,lights_toon_fragment:ng,lights_toon_pars_fragment:ig,lights_phong_fragment:rg,lights_phong_pars_fragment:sg,lights_physical_fragment:og,lights_physical_pars_fragment:ag,lights_fragment_begin:lg,lights_fragment_maps:cg,lights_fragment_end:ug,lightprobes_pars_fragment:hg,logdepthbuf_fragment:dg,logdepthbuf_pars_fragment:fg,logdepthbuf_pars_vertex:pg,logdepthbuf_vertex:mg,map_fragment:gg,map_pars_fragment:_g,map_particle_fragment:xg,map_particle_pars_fragment:yg,metalnessmap_fragment:vg,metalnessmap_pars_fragment:bg,morphinstance_vertex:Mg,morphcolor_vertex:Sg,morphnormal_vertex:wg,morphtarget_pars_vertex:Tg,morphtarget_vertex:Eg,normal_fragment_begin:Ag,normal_fragment_maps:Rg,normal_pars_fragment:Cg,normal_pars_vertex:Pg,normal_vertex:Ig,normalmap_pars_fragment:Dg,clearcoat_normal_fragment_begin:Lg,clearcoat_normal_fragment_maps:Fg,clearcoat_pars_fragment:Ng,iridescence_pars_fragment:Ug,opaque_fragment:Og,packing:Bg,premultiplied_alpha_fragment:kg,project_vertex:zg,dithering_fragment:Vg,dithering_pars_fragment:Gg,roughnessmap_fragment:Hg,roughnessmap_pars_fragment:Wg,shadowmap_pars_fragment:Xg,shadowmap_pars_vertex:qg,shadowmap_vertex:Yg,shadowmask_pars_fragment:$g,skinbase_vertex:Zg,skinning_pars_vertex:Kg,skinning_vertex:Jg,skinnormal_vertex:jg,specularmap_fragment:Qg,specularmap_pars_fragment:e0,tonemapping_fragment:t0,tonemapping_pars_fragment:n0,transmission_fragment:i0,transmission_pars_fragment:r0,uv_pars_fragment:s0,uv_pars_vertex:o0,uv_vertex:a0,worldpos_vertex:l0,background_vert:c0,background_frag:u0,backgroundCube_vert:h0,backgroundCube_frag:d0,cube_vert:f0,cube_frag:p0,depth_vert:m0,depth_frag:g0,distance_vert:_0,distance_frag:x0,equirect_vert:y0,equirect_frag:v0,linedashed_vert:b0,linedashed_frag:M0,meshbasic_vert:S0,meshbasic_frag:w0,meshlambert_vert:T0,meshlambert_frag:E0,meshmatcap_vert:A0,meshmatcap_frag:R0,meshnormal_vert:C0,meshnormal_frag:P0,meshphong_vert:I0,meshphong_frag:D0,meshphysical_vert:L0,meshphysical_frag:F0,meshtoon_vert:N0,meshtoon_frag:U0,points_vert:O0,points_frag:B0,shadow_vert:k0,shadow_frag:z0,sprite_vert:V0,sprite_frag:G0},xe={common:{diffuse:{value:new qe(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new $e},alphaMap:{value:null},alphaMapTransform:{value:new $e},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new $e}},envmap:{envMap:{value:null},envMapRotation:{value:new $e},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new $e}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new $e}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new $e},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new $e},normalScale:{value:new De(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new $e},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new $e}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new $e}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new $e}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new qe(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new k},probesMax:{value:new k},probesResolution:{value:new k}},points:{diffuse:{value:new qe(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new $e},alphaTest:{value:0},uvTransform:{value:new $e}},sprite:{diffuse:{value:new qe(16777215)},opacity:{value:1},center:{value:new De(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new $e},alphaMap:{value:null},alphaMapTransform:{value:new $e},alphaTest:{value:0}}},zn={basic:{uniforms:Xt([xe.common,xe.specularmap,xe.envmap,xe.aomap,xe.lightmap,xe.fog]),vertexShader:tt.meshbasic_vert,fragmentShader:tt.meshbasic_frag},lambert:{uniforms:Xt([xe.common,xe.specularmap,xe.envmap,xe.aomap,xe.lightmap,xe.emissivemap,xe.bumpmap,xe.normalmap,xe.displacementmap,xe.fog,xe.lights,{emissive:{value:new qe(0)},envMapIntensity:{value:1}}]),vertexShader:tt.meshlambert_vert,fragmentShader:tt.meshlambert_frag},phong:{uniforms:Xt([xe.common,xe.specularmap,xe.envmap,xe.aomap,xe.lightmap,xe.emissivemap,xe.bumpmap,xe.normalmap,xe.displacementmap,xe.fog,xe.lights,{emissive:{value:new qe(0)},specular:{value:new qe(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:tt.meshphong_vert,fragmentShader:tt.meshphong_frag},standard:{uniforms:Xt([xe.common,xe.envmap,xe.aomap,xe.lightmap,xe.emissivemap,xe.bumpmap,xe.normalmap,xe.displacementmap,xe.roughnessmap,xe.metalnessmap,xe.fog,xe.lights,{emissive:{value:new qe(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:tt.meshphysical_vert,fragmentShader:tt.meshphysical_frag},toon:{uniforms:Xt([xe.common,xe.aomap,xe.lightmap,xe.emissivemap,xe.bumpmap,xe.normalmap,xe.displacementmap,xe.gradientmap,xe.fog,xe.lights,{emissive:{value:new qe(0)}}]),vertexShader:tt.meshtoon_vert,fragmentShader:tt.meshtoon_frag},matcap:{uniforms:Xt([xe.common,xe.bumpmap,xe.normalmap,xe.displacementmap,xe.fog,{matcap:{value:null}}]),vertexShader:tt.meshmatcap_vert,fragmentShader:tt.meshmatcap_frag},points:{uniforms:Xt([xe.points,xe.fog]),vertexShader:tt.points_vert,fragmentShader:tt.points_frag},dashed:{uniforms:Xt([xe.common,xe.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:tt.linedashed_vert,fragmentShader:tt.linedashed_frag},depth:{uniforms:Xt([xe.common,xe.displacementmap]),vertexShader:tt.depth_vert,fragmentShader:tt.depth_frag},normal:{uniforms:Xt([xe.common,xe.bumpmap,xe.normalmap,xe.displacementmap,{opacity:{value:1}}]),vertexShader:tt.meshnormal_vert,fragmentShader:tt.meshnormal_frag},sprite:{uniforms:Xt([xe.sprite,xe.fog]),vertexShader:tt.sprite_vert,fragmentShader:tt.sprite_frag},background:{uniforms:{uvTransform:{value:new $e},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:tt.background_vert,fragmentShader:tt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new $e}},vertexShader:tt.backgroundCube_vert,fragmentShader:tt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:tt.cube_vert,fragmentShader:tt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:tt.equirect_vert,fragmentShader:tt.equirect_frag},distance:{uniforms:Xt([xe.common,xe.displacementmap,{referencePosition:{value:new k},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:tt.distance_vert,fragmentShader:tt.distance_frag},shadow:{uniforms:Xt([xe.lights,xe.fog,{color:{value:new qe(0)},opacity:{value:1}}]),vertexShader:tt.shadow_vert,fragmentShader:tt.shadow_frag}};zn.physical={uniforms:Xt([zn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new $e},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new $e},clearcoatNormalScale:{value:new De(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new $e},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new $e},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new $e},sheen:{value:0},sheenColor:{value:new qe(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new $e},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new $e},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new $e},transmissionSamplerSize:{value:new De},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new $e},attenuationDistance:{value:0},attenuationColor:{value:new qe(0)},specularColor:{value:new qe(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new $e},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new $e},anisotropyVector:{value:new De},anisotropyMap:{value:null},anisotropyMapTransform:{value:new $e}}]),vertexShader:tt.meshphysical_vert,fragmentShader:tt.meshphysical_frag};var Ya={r:0,b:0,g:0},H0=new pt,xd=new $e;xd.set(-1,0,0,0,1,0,0,0,1);function W0(n,e,t,i,r,s){let o=new qe(0),a=r===!0?0:1,l,c,u=null,f=0,h=null;function d(M){let T=M.isScene===!0?M.background:null;if(T&&T.isTexture){let v=M.backgroundBlurriness>0;T=e.get(T,v)}return T}function m(M){let T=!1,v=d(M);v===null?g(o,a):v&&v.isColor&&(g(v,1),T=!0);let C=n.xr.getEnvironmentBlendMode();C==="additive"?t.buffers.color.setClear(0,0,0,1,s):C==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,s),(n.autoClear||T)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function b(M,T){let v=d(T);v&&(v.isCubeTexture||v.mapping===Rs)?(c===void 0&&(c=new yt(new br(1,1,1),new cn({name:"BackgroundCubeMaterial",uniforms:Hi(zn.backgroundCube.uniforms),vertexShader:zn.backgroundCube.vertexShader,fragmentShader:zn.backgroundCube.fragmentShader,side:Jt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(C,S,_){this.matrixWorld.copyPosition(_.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),c.material.uniforms.envMap.value=v,c.material.uniforms.backgroundBlurriness.value=T.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=T.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(H0.makeRotationFromEuler(T.backgroundRotation)).transpose(),v.isCubeTexture&&v.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(xd),c.material.toneMapped=rt.getTransfer(v.colorSpace)!==lt,(u!==v||f!==v.version||h!==n.toneMapping)&&(c.material.needsUpdate=!0,u=v,f=v.version,h=n.toneMapping),c.layers.enableAll(),M.unshift(c,c.geometry,c.material,0,0,null)):v&&v.isTexture&&(l===void 0&&(l=new yt(new Vi(2,2),new cn({name:"BackgroundMaterial",uniforms:Hi(zn.background.uniforms),vertexShader:zn.background.vertexShader,fragmentShader:zn.background.fragmentShader,side:bn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=v,l.material.uniforms.backgroundIntensity.value=T.backgroundIntensity,l.material.toneMapped=rt.getTransfer(v.colorSpace)!==lt,v.matrixAutoUpdate===!0&&v.updateMatrix(),l.material.uniforms.uvTransform.value.copy(v.matrix),(u!==v||f!==v.version||h!==n.toneMapping)&&(l.material.needsUpdate=!0,u=v,f=v.version,h=n.toneMapping),l.layers.enableAll(),M.unshift(l,l.geometry,l.material,0,0,null))}function g(M,T){M.getRGB(Ya,Ec(n)),t.buffers.color.setClear(Ya.r,Ya.g,Ya.b,T,s)}function p(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return o},setClearColor:function(M,T=1){o.set(M),a=T,g(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(M){a=M,g(o,a)},render:m,addToRenderList:b,dispose:p}}function X0(n,e){let t=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},r=h(null),s=r,o=!1;function a(R,I,N,U,F){let O=!1,D=f(R,U,N,I);s!==D&&(s=D,c(s.object)),O=d(R,U,N,F),O&&m(R,U,N,F),F!==null&&e.update(F,n.ELEMENT_ARRAY_BUFFER),(O||o)&&(o=!1,v(R,I,N,U),F!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get(F).buffer))}function l(){return n.createVertexArray()}function c(R){return n.bindVertexArray(R)}function u(R){return n.deleteVertexArray(R)}function f(R,I,N,U){let F=U.wireframe===!0,O=i[I.id];O===void 0&&(O={},i[I.id]=O);let D=R.isInstancedMesh===!0?R.id:0,G=O[D];G===void 0&&(G={},O[D]=G);let K=G[N.id];K===void 0&&(K={},G[N.id]=K);let Q=K[F];return Q===void 0&&(Q=h(l()),K[F]=Q),Q}function h(R){let I=[],N=[],U=[];for(let F=0;F<t;F++)I[F]=0,N[F]=0,U[F]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:I,enabledAttributes:N,attributeDivisors:U,object:R,attributes:{},index:null}}function d(R,I,N,U){let F=s.attributes,O=I.attributes,D=0,G=N.getAttributes();for(let K in G)if(G[K].location>=0){let ne=F[K],ae=O[K];if(ae===void 0&&(K==="instanceMatrix"&&R.instanceMatrix&&(ae=R.instanceMatrix),K==="instanceColor"&&R.instanceColor&&(ae=R.instanceColor)),ne===void 0||ne.attribute!==ae||ae&&ne.data!==ae.data)return!0;D++}return s.attributesNum!==D||s.index!==U}function m(R,I,N,U){let F={},O=I.attributes,D=0,G=N.getAttributes();for(let K in G)if(G[K].location>=0){let ne=O[K];ne===void 0&&(K==="instanceMatrix"&&R.instanceMatrix&&(ne=R.instanceMatrix),K==="instanceColor"&&R.instanceColor&&(ne=R.instanceColor));let ae={};ae.attribute=ne,ne&&ne.data&&(ae.data=ne.data),F[K]=ae,D++}s.attributes=F,s.attributesNum=D,s.index=U}function b(){let R=s.newAttributes;for(let I=0,N=R.length;I<N;I++)R[I]=0}function g(R){p(R,0)}function p(R,I){let N=s.newAttributes,U=s.enabledAttributes,F=s.attributeDivisors;N[R]=1,U[R]===0&&(n.enableVertexAttribArray(R),U[R]=1),F[R]!==I&&(n.vertexAttribDivisor(R,I),F[R]=I)}function M(){let R=s.newAttributes,I=s.enabledAttributes;for(let N=0,U=I.length;N<U;N++)I[N]!==R[N]&&(n.disableVertexAttribArray(N),I[N]=0)}function T(R,I,N,U,F,O,D){D===!0?n.vertexAttribIPointer(R,I,N,F,O):n.vertexAttribPointer(R,I,N,U,F,O)}function v(R,I,N,U){b();let F=U.attributes,O=N.getAttributes(),D=I.defaultAttributeValues;for(let G in O){let K=O[G];if(K.location>=0){let Q=F[G];if(Q===void 0&&(G==="instanceMatrix"&&R.instanceMatrix&&(Q=R.instanceMatrix),G==="instanceColor"&&R.instanceColor&&(Q=R.instanceColor)),Q!==void 0){let ne=Q.normalized,ae=Q.itemSize,Ne=e.get(Q);if(Ne===void 0)continue;let Ge=Ne.buffer,Ae=Ne.type,$=Ne.bytesPerElement,W=Ae===n.INT||Ae===n.UNSIGNED_INT||Q.gpuType===la;if(Q.isInterleavedBufferAttribute){let J=Q.data,fe=J.stride,Se=Q.offset;if(J.isInstancedInterleavedBuffer){for(let we=0;we<K.locationSize;we++)p(K.location+we,J.meshPerAttribute);R.isInstancedMesh!==!0&&U._maxInstanceCount===void 0&&(U._maxInstanceCount=J.meshPerAttribute*J.count)}else for(let we=0;we<K.locationSize;we++)g(K.location+we);n.bindBuffer(n.ARRAY_BUFFER,Ge);for(let we=0;we<K.locationSize;we++)T(K.location+we,ae/K.locationSize,Ae,ne,fe*$,(Se+ae/K.locationSize*we)*$,W)}else{if(Q.isInstancedBufferAttribute){for(let J=0;J<K.locationSize;J++)p(K.location+J,Q.meshPerAttribute);R.isInstancedMesh!==!0&&U._maxInstanceCount===void 0&&(U._maxInstanceCount=Q.meshPerAttribute*Q.count)}else for(let J=0;J<K.locationSize;J++)g(K.location+J);n.bindBuffer(n.ARRAY_BUFFER,Ge);for(let J=0;J<K.locationSize;J++)T(K.location+J,ae/K.locationSize,Ae,ne,ae*$,ae/K.locationSize*J*$,W)}}else if(D!==void 0){let ne=D[G];if(ne!==void 0)switch(ne.length){case 2:n.vertexAttrib2fv(K.location,ne);break;case 3:n.vertexAttrib3fv(K.location,ne);break;case 4:n.vertexAttrib4fv(K.location,ne);break;default:n.vertexAttrib1fv(K.location,ne)}}}}M()}function C(){A();for(let R in i){let I=i[R];for(let N in I){let U=I[N];for(let F in U){let O=U[F];for(let D in O)u(O[D].object),delete O[D];delete U[F]}}delete i[R]}}function S(R){if(i[R.id]===void 0)return;let I=i[R.id];for(let N in I){let U=I[N];for(let F in U){let O=U[F];for(let D in O)u(O[D].object),delete O[D];delete U[F]}}delete i[R.id]}function _(R){for(let I in i){let N=i[I];for(let U in N){let F=N[U];if(F[R.id]===void 0)continue;let O=F[R.id];for(let D in O)u(O[D].object),delete O[D];delete F[R.id]}}}function x(R){for(let I in i){let N=i[I],U=R.isInstancedMesh===!0?R.id:0,F=N[U];if(F!==void 0){for(let O in F){let D=F[O];for(let G in D)u(D[G].object),delete D[G];delete F[O]}delete N[U],Object.keys(N).length===0&&delete i[I]}}}function A(){E(),o=!0,s!==r&&(s=r,c(s.object))}function E(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:a,reset:A,resetDefaultState:E,dispose:C,releaseStatesOfGeometry:S,releaseStatesOfObject:x,releaseStatesOfProgram:_,initAttributes:b,enableAttribute:g,disableUnusedAttributes:M}}function q0(n,e,t){let i;function r(l){i=l}function s(l,c){n.drawArrays(i,l,c),t.update(c,i,1)}function o(l,c,u){u!==0&&(n.drawArraysInstanced(i,l,c,u),t.update(c,i,u))}function a(l,c,u){if(u===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,u);let h=0;for(let d=0;d<u;d++)h+=c[d];t.update(h,i,1)}this.setMode=r,this.render=s,this.renderInstances=o,this.renderMultiDraw=a}function Y0(n,e,t,i){let r;function s(){if(r!==void 0)return r;if(e.has("EXT_texture_filter_anisotropic")===!0){let _=e.get("EXT_texture_filter_anisotropic");r=n.getParameter(_.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function o(_){return!(_!==pn&&i.convert(_)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(_){let x=_===Bn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(_!==Qt&&i.convert(_)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE)&&_!==fn&&!x)}function l(_){if(_==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";_="mediump"}return _==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp",u=l(c);u!==c&&(Be("WebGLRenderer:",c,"not supported, using",u,"instead."),c=u);let f=t.logarithmicDepthBuffer===!0,h=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&h===!1&&Be("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let d=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),m=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),b=n.getParameter(n.MAX_TEXTURE_SIZE),g=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),p=n.getParameter(n.MAX_VERTEX_ATTRIBS),M=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),T=n.getParameter(n.MAX_VARYING_VECTORS),v=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),C=n.getParameter(n.MAX_SAMPLES),S=n.getParameter(n.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:f,reversedDepthBuffer:h,maxTextures:d,maxVertexTextures:m,maxTextureSize:b,maxCubemapSize:g,maxAttributes:p,maxVertexUniforms:M,maxVaryings:T,maxFragmentUniforms:v,maxSamples:C,samples:S}}function $0(n){let e=this,t=null,i=0,r=!1,s=!1,o=new zt,a=new $e,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(f,h){let d=f.length!==0||h||i!==0||r;return r=h,i=f.length,d},this.beginShadows=function(){s=!0,u(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(f,h){t=u(f,h,0)},this.setState=function(f,h,d){let m=f.clippingPlanes,b=f.clipIntersection,g=f.clipShadows,p=n.get(f);if(!r||m===null||m.length===0||s&&!g)s?u(null):c();else{let M=s?0:i,T=M*4,v=p.clippingState||null;l.value=v,v=u(m,h,T,d);for(let C=0;C!==T;++C)v[C]=t[C];p.clippingState=v,this.numIntersection=b?this.numPlanes:0,this.numPlanes+=M}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function u(f,h,d,m){let b=f!==null?f.length:0,g=null;if(b!==0){if(g=l.value,m!==!0||g===null){let p=d+b*4,M=h.matrixWorldInverse;a.getNormalMatrix(M),(g===null||g.length<p)&&(g=new Float32Array(p));for(let T=0,v=d;T!==b;++T,v+=4)o.copy(f[T]).applyMatrix4(M,a),o.normal.toArray(g,v),g[v+3]=o.constant}l.value=g,l.needsUpdate=!0}return e.numPlanes=b,e.numIntersection=0,g}}var vi=4,Zh=[.125,.215,.35,.446,.526,.582],Wi=20,Z0=256,Os=new Sr,Kh=new qe,Pc=null,Ic=0,Dc=0,Lc=!1,K0=new k,Za=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,i=.1,r=100,s={}){let{size:o=256,position:a=K0}=s;Pc=this._renderer.getRenderTarget(),Ic=this._renderer.getActiveCubeFace(),Dc=this._renderer.getActiveMipmapLevel(),Lc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,i,r,l,a),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Qh(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=jh(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Pc,Ic,Dc),this._renderer.xr.enabled=Lc,e.scissorTest=!1,Cr(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===gi||e.mapping===Gi?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Pc=this._renderer.getRenderTarget(),Ic=this._renderer.getActiveCubeFace(),Dc=this._renderer.getActiveMipmapLevel(),Lc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let i=t||this._allocateTargets();return this._textureToCubeUV(e,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:Dt,minFilter:Dt,generateMipmaps:!1,type:Bn,format:pn,colorSpace:jr,depthBuffer:!1},r=Jh(e,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Jh(e,t,i);let{_lodMax:s}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=J0(s)),this._blurMaterial=Q0(s,e,t),this._ggxMaterial=j0(s,e,t)}return r}_compileMaterial(e){let t=new yt(new Rt,e);this._renderer.compile(t,Os)}_sceneToCubeUV(e,t,i,r,s){let l=new Wt(90,1,t,i),c=[1,-1,1,1,1,1],u=[1,1,1,-1,-1,-1],f=this._renderer,h=f.autoClear,d=f.toneMapping;f.getClearColor(Kh),f.toneMapping=wn,f.autoClear=!1,f.state.buffers.depth.getReversed()&&(f.setRenderTarget(r),f.clearDepth(),f.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new yt(new br,new Kn({name:"PMREM.Background",side:Jt,depthWrite:!1,depthTest:!1})));let b=this._backgroundBox,g=b.material,p=!1,M=e.background;M?M.isColor&&(g.color.copy(M),e.background=null,p=!0):(g.color.copy(Kh),p=!0);for(let T=0;T<6;T++){let v=T%3;v===0?(l.up.set(0,c[T],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x+u[T],s.y,s.z)):v===1?(l.up.set(0,0,c[T]),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y+u[T],s.z)):(l.up.set(0,c[T],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y,s.z+u[T]));let C=this._cubeSize;Cr(r,v*C,T>2?C:0,C,C),f.setRenderTarget(r),p&&f.render(b,l),f.render(e,l)}f.toneMapping=d,f.autoClear=h,e.background=M}_textureToCubeUV(e,t){let i=this._renderer,r=e.mapping===gi||e.mapping===Gi;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Qh()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=jh());let s=r?this._cubemapMaterial:this._equirectMaterial,o=this._lodMeshes[0];o.material=s;let a=s.uniforms;a.envMap.value=e;let l=this._cubeSize;Cr(t,0,0,3*l,2*l),i.setRenderTarget(t),i.render(o,Os)}_applyPMREM(e){let t=this._renderer,i=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let s=1;s<r;s++)this._applyGGXFilter(e,s-1,s);t.autoClear=i}_applyGGXFilter(e,t,i){let r=this._renderer,s=this._pingPongRenderTarget,o=this._ggxMaterial,a=this._lodMeshes[i];a.material=o;let l=o.uniforms,c=i/(this._lodMeshes.length-1),u=t/(this._lodMeshes.length-1),f=Math.sqrt(c*c-u*u),h=0+c*1.25,d=f*h,{_lodMax:m}=this,b=this._sizeLods[i],g=3*b*(i>m-vi?i-m+vi:0),p=4*(this._cubeSize-b);l.envMap.value=e.texture,l.roughness.value=d,l.mipInt.value=m-t,Cr(s,g,p,3*b,2*b),r.setRenderTarget(s),r.render(a,Os),l.envMap.value=s.texture,l.roughness.value=0,l.mipInt.value=m-i,Cr(e,g,p,3*b,2*b),r.setRenderTarget(e),r.render(a,Os)}_blur(e,t,i,r,s){let o=this._pingPongRenderTarget;this._halfBlur(e,o,t,i,r,"latitudinal",s),this._halfBlur(o,e,i,i,r,"longitudinal",s)}_halfBlur(e,t,i,r,s,o,a){let l=this._renderer,c=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&Ve("blur direction must be either latitudinal or longitudinal!");let u=3,f=this._lodMeshes[r];f.material=c;let h=c.uniforms,d=this._sizeLods[i]-1,m=isFinite(s)?Math.PI/(2*d):2*Math.PI/(2*Wi-1),b=s/m,g=isFinite(s)?1+Math.floor(u*b):Wi;g>Wi&&Be(`sigmaRadians, ${s}, is too large and will clip, as it requested ${g} samples when the maximum is set to ${Wi}`);let p=[],M=0;for(let _=0;_<Wi;++_){let x=_/b,A=Math.exp(-x*x/2);p.push(A),_===0?M+=A:_<g&&(M+=2*A)}for(let _=0;_<p.length;_++)p[_]=p[_]/M;h.envMap.value=e.texture,h.samples.value=g,h.weights.value=p,h.latitudinal.value=o==="latitudinal",a&&(h.poleAxis.value=a);let{_lodMax:T}=this;h.dTheta.value=m,h.mipInt.value=T-i;let v=this._sizeLods[r],C=3*v*(r>T-vi?r-T+vi:0),S=4*(this._cubeSize-v);Cr(t,C,S,3*v,2*v),l.setRenderTarget(t),l.render(f,Os)}};function J0(n){let e=[],t=[],i=[],r=n,s=n-vi+1+Zh.length;for(let o=0;o<s;o++){let a=Math.pow(2,r);e.push(a);let l=1/a;o>n-vi?l=Zh[o-n+vi-1]:o===0&&(l=0),t.push(l);let c=1/(a-2),u=-c,f=1+c,h=[u,u,f,u,f,f,u,u,f,f,u,f],d=6,m=6,b=3,g=2,p=1,M=new Float32Array(b*m*d),T=new Float32Array(g*m*d),v=new Float32Array(p*m*d);for(let S=0;S<d;S++){let _=S%3*2/3-1,x=S>2?0:-1,A=[_,x,0,_+2/3,x,0,_+2/3,x+1,0,_,x,0,_+2/3,x+1,0,_,x+1,0];M.set(A,b*m*S),T.set(h,g*m*S);let E=[S,S,S,S,S,S];v.set(E,p*m*S)}let C=new Rt;C.setAttribute("position",new Zt(M,b)),C.setAttribute("uv",new Zt(T,g)),C.setAttribute("faceIndex",new Zt(v,p)),i.push(new yt(C,null)),r>vi&&r--}return{lodMeshes:i,sizeLods:e,sigmas:t}}function Jh(n,e,t){let i=new ln(n,e,t);return i.texture.mapping=Rs,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function Cr(n,e,t,i,r){n.viewport.set(e,t,i,r),n.scissor.set(e,t,i,r)}function j0(n,e,t){return new cn({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:Z0,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:ja(),fragmentShader:`

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
		`,blending:On,depthTest:!1,depthWrite:!1})}function Q0(n,e,t){let i=new Float32Array(Wi),r=new k(0,1,0);return new cn({name:"SphericalGaussianBlur",defines:{n:Wi,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:r}},vertexShader:ja(),fragmentShader:`

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
		`,blending:On,depthTest:!1,depthWrite:!1})}function jh(){return new cn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:ja(),fragmentShader:`

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
		`,blending:On,depthTest:!1,depthWrite:!1})}function Qh(){return new cn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:ja(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:On,depthTest:!1,depthWrite:!1})}function ja(){return`

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
	`}var Ka=class extends ln{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let i={width:e,height:e,depth:1},r=[i,i,i,i,i,i];this.texture=new us(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},r=new br(5,5,5),s=new cn({name:"CubemapFromEquirect",uniforms:Hi(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:Jt,blending:On});s.uniforms.tEquirect.value=t;let o=new yt(r,s),a=t.minFilter;return t.minFilter===_i&&(t.minFilter=Dt),new ta(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t=!0,i=!0,r=!0){let s=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,i,r);e.setRenderTarget(s)}};function e_(n){let e=new WeakMap,t=new WeakMap,i=null;function r(h,d=!1){return h==null?null:d?o(h):s(h)}function s(h){if(h&&h.isTexture){let d=h.mapping;if(d===sa||d===oa)if(e.has(h)){let m=e.get(h).texture;return a(m,h.mapping)}else{let m=h.image;if(m&&m.height>0){let b=new Ka(m.height);return b.fromEquirectangularTexture(n,h),e.set(h,b),h.addEventListener("dispose",c),a(b.texture,h.mapping)}else return null}}return h}function o(h){if(h&&h.isTexture){let d=h.mapping,m=d===sa||d===oa,b=d===gi||d===Gi;if(m||b){let g=t.get(h),p=g!==void 0?g.texture.pmremVersion:0;if(h.isRenderTargetTexture&&h.pmremVersion!==p)return i===null&&(i=new Za(n)),g=m?i.fromEquirectangular(h,g):i.fromCubemap(h,g),g.texture.pmremVersion=h.pmremVersion,t.set(h,g),g.texture;if(g!==void 0)return g.texture;{let M=h.image;return m&&M&&M.height>0||b&&M&&l(M)?(i===null&&(i=new Za(n)),g=m?i.fromEquirectangular(h):i.fromCubemap(h),g.texture.pmremVersion=h.pmremVersion,t.set(h,g),h.addEventListener("dispose",u),g.texture):null}}}return h}function a(h,d){return d===sa?h.mapping=gi:d===oa&&(h.mapping=Gi),h}function l(h){let d=0,m=6;for(let b=0;b<m;b++)h[b]!==void 0&&d++;return d===m}function c(h){let d=h.target;d.removeEventListener("dispose",c);let m=e.get(d);m!==void 0&&(e.delete(d),m.dispose())}function u(h){let d=h.target;d.removeEventListener("dispose",u);let m=t.get(d);m!==void 0&&(t.delete(d),m.dispose())}function f(){e=new WeakMap,t=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:r,dispose:f}}function t_(n){let e={};function t(i){if(e[i]!==void 0)return e[i];let r=n.getExtension(i);return e[i]=r,r}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){let r=t(i);return r===null&&Ni("WebGLRenderer: "+i+" extension not supported."),r}}}function n_(n,e,t,i){let r={},s=new WeakMap;function o(f){let h=f.target;h.index!==null&&e.remove(h.index);for(let m in h.attributes)e.remove(h.attributes[m]);h.removeEventListener("dispose",o),delete r[h.id];let d=s.get(h);d&&(e.remove(d),s.delete(h)),i.releaseStatesOfGeometry(h),h.isInstancedBufferGeometry===!0&&delete h._maxInstanceCount,t.memory.geometries--}function a(f,h){return r[h.id]===!0||(h.addEventListener("dispose",o),r[h.id]=!0,t.memory.geometries++),h}function l(f){let h=f.attributes;for(let d in h)e.update(h[d],n.ARRAY_BUFFER)}function c(f){let h=[],d=f.index,m=f.attributes.position,b=0;if(m===void 0)return;if(d!==null){let M=d.array;b=d.version;for(let T=0,v=M.length;T<v;T+=3){let C=M[T+0],S=M[T+1],_=M[T+2];h.push(C,S,S,_,_,C)}}else{let M=m.array;b=m.version;for(let T=0,v=M.length/3-1;T<v;T+=3){let C=T+0,S=T+1,_=T+2;h.push(C,S,S,_,_,C)}}let g=new(m.count>=65535?os:ss)(h,1);g.version=b;let p=s.get(f);p&&e.remove(p),s.set(f,g)}function u(f){let h=s.get(f);if(h){let d=f.index;d!==null&&h.version<d.version&&c(f)}else c(f);return s.get(f)}return{get:a,update:l,getWireframeAttribute:u}}function i_(n,e,t){let i;function r(f){i=f}let s,o;function a(f){s=f.type,o=f.bytesPerElement}function l(f,h){n.drawElements(i,h,s,f*o),t.update(h,i,1)}function c(f,h,d){d!==0&&(n.drawElementsInstanced(i,h,s,f*o,d),t.update(h,i,d))}function u(f,h,d){if(d===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,h,0,s,f,0,d);let b=0;for(let g=0;g<d;g++)b+=h[g];t.update(b,i,1)}this.setMode=r,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=u}function r_(n){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,o,a){switch(t.calls++,o){case n.TRIANGLES:t.triangles+=a*(s/3);break;case n.LINES:t.lines+=a*(s/2);break;case n.LINE_STRIP:t.lines+=a*(s-1);break;case n.LINE_LOOP:t.lines+=a*s;break;case n.POINTS:t.points+=a*s;break;default:Ve("WebGLInfo: Unknown draw mode:",o);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:r,update:i}}function s_(n,e,t){let i=new WeakMap,r=new xt;function s(o,a,l){let c=o.morphTargetInfluences,u=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,f=u!==void 0?u.length:0,h=i.get(a);if(h===void 0||h.count!==f){let A=function(){_.dispose(),i.delete(a),a.removeEventListener("dispose",A)};h!==void 0&&h.texture.dispose();let d=a.morphAttributes.position!==void 0,m=a.morphAttributes.normal!==void 0,b=a.morphAttributes.color!==void 0,g=a.morphAttributes.position||[],p=a.morphAttributes.normal||[],M=a.morphAttributes.color||[],T=0;d===!0&&(T=1),m===!0&&(T=2),b===!0&&(T=3);let v=a.attributes.position.count*T,C=1;v>e.maxTextureSize&&(C=Math.ceil(v/e.maxTextureSize),v=e.maxTextureSize);let S=new Float32Array(v*C*4*f),_=new ts(S,v,C,f);_.type=fn,_.needsUpdate=!0;let x=T*4;for(let E=0;E<f;E++){let R=g[E],I=p[E],N=M[E],U=v*C*4*E;for(let F=0;F<R.count;F++){let O=F*x;d===!0&&(r.fromBufferAttribute(R,F),S[U+O+0]=r.x,S[U+O+1]=r.y,S[U+O+2]=r.z,S[U+O+3]=0),m===!0&&(r.fromBufferAttribute(I,F),S[U+O+4]=r.x,S[U+O+5]=r.y,S[U+O+6]=r.z,S[U+O+7]=0),b===!0&&(r.fromBufferAttribute(N,F),S[U+O+8]=r.x,S[U+O+9]=r.y,S[U+O+10]=r.z,S[U+O+11]=N.itemSize===4?r.w:1)}}h={count:f,texture:_,size:new De(v,C)},i.set(a,h),a.addEventListener("dispose",A)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(n,"morphTexture",o.morphTexture,t);else{let d=0;for(let b=0;b<c.length;b++)d+=c[b];let m=a.morphTargetsRelative?1:1-d;l.getUniforms().setValue(n,"morphTargetBaseInfluence",m),l.getUniforms().setValue(n,"morphTargetInfluences",c)}l.getUniforms().setValue(n,"morphTargetsTexture",h.texture,t),l.getUniforms().setValue(n,"morphTargetsTextureSize",h.size)}return{update:s}}function o_(n,e,t,i,r){let s=new WeakMap;function o(c){let u=r.render.frame,f=c.geometry,h=e.get(c,f);if(s.get(h)!==u&&(e.update(h),s.set(h,u)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),s.get(c)!==u&&(t.update(c.instanceMatrix,n.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,n.ARRAY_BUFFER),s.set(c,u))),c.isSkinnedMesh){let d=c.skeleton;s.get(d)!==u&&(d.update(),s.set(d,u))}return h}function a(){s=new WeakMap}function l(c){let u=c.target;u.removeEventListener("dispose",l),i.releaseStatesOfObject(u),t.remove(u.instanceMatrix),u.instanceColor!==null&&t.remove(u.instanceColor)}return{update:o,dispose:a}}var a_={[cc]:"LINEAR_TONE_MAPPING",[uc]:"REINHARD_TONE_MAPPING",[hc]:"CINEON_TONE_MAPPING",[As]:"ACES_FILMIC_TONE_MAPPING",[fc]:"AGX_TONE_MAPPING",[pc]:"NEUTRAL_TONE_MAPPING",[dc]:"CUSTOM_TONE_MAPPING"};function l_(n,e,t,i,r,s){let o=new ln(e,t,{type:n,depthBuffer:r,stencilBuffer:s,samples:i?4:0,depthTexture:r?new Jn(e,t):void 0}),a=new ln(e,t,{type:Bn,depthBuffer:!1,stencilBuffer:!1}),l=new Rt;l.setAttribute("position",new ct([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new ct([0,2,0,0,2,0],2));let c=new Go({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),u=new yt(l,c),f=new Sr(-1,1,1,-1,0,1),h=null,d=null,m=!1,b,g=null,p=[],M=!1;this.setSize=function(T,v){o.setSize(T,v),a.setSize(T,v);for(let C=0;C<p.length;C++){let S=p[C];S.setSize&&S.setSize(T,v)}},this.setEffects=function(T){p=T,M=p.length>0&&p[0].isRenderPass===!0;let v=o.width,C=o.height;for(let S=0;S<p.length;S++){let _=p[S];_.setSize&&_.setSize(v,C)}},this.begin=function(T,v){if(m||T.toneMapping===wn&&p.length===0)return!1;if(g=v,v!==null){let C=v.width,S=v.height;(o.width!==C||o.height!==S)&&this.setSize(C,S)}return M===!1&&T.setRenderTarget(o),b=T.toneMapping,T.toneMapping=wn,!0},this.hasRenderPass=function(){return M},this.end=function(T,v){T.toneMapping=b,m=!0;let C=o,S=a;for(let _=0;_<p.length;_++){let x=p[_];if(x.enabled!==!1&&(x.render(T,S,C,v),x.needsSwap!==!1)){let A=C;C=S,S=A}}if(h!==T.outputColorSpace||d!==T.toneMapping){h=T.outputColorSpace,d=T.toneMapping,c.defines={},rt.getTransfer(h)===lt&&(c.defines.SRGB_TRANSFER="");let _=a_[d];_&&(c.defines[_]=""),c.needsUpdate=!0}c.uniforms.tDiffuse.value=C.texture,T.setRenderTarget(g),T.render(u,f),g=null,m=!1},this.isCompositing=function(){return m},this.dispose=function(){o.depthTexture&&o.depthTexture.dispose(),o.dispose(),a.dispose(),l.dispose(),c.dispose()}}var yd=new Kt,Uc=new Jn(1,1),vd=new ts,bd=new ko,Md=new us,ed=[],td=[],nd=new Float32Array(16),id=new Float32Array(9),rd=new Float32Array(4);function Ir(n,e,t){let i=n[0];if(i<=0||i>0)return n;let r=e*t,s=ed[r];if(s===void 0&&(s=new Float32Array(r),ed[r]=s),e!==0){i.toArray(s,0);for(let o=1,a=0;o!==e;++o)a+=t,n[o].toArray(s,a)}return s}function Lt(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function Ft(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function Qa(n,e){let t=td[e];t===void 0&&(t=new Int32Array(e),td[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function c_(n,e){let t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function u_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Lt(t,e))return;n.uniform2fv(this.addr,e),Ft(t,e)}}function h_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Lt(t,e))return;n.uniform3fv(this.addr,e),Ft(t,e)}}function d_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Lt(t,e))return;n.uniform4fv(this.addr,e),Ft(t,e)}}function f_(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(Lt(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),Ft(t,e)}else{if(Lt(t,i))return;rd.set(i),n.uniformMatrix2fv(this.addr,!1,rd),Ft(t,i)}}function p_(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(Lt(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),Ft(t,e)}else{if(Lt(t,i))return;id.set(i),n.uniformMatrix3fv(this.addr,!1,id),Ft(t,i)}}function m_(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(Lt(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),Ft(t,e)}else{if(Lt(t,i))return;nd.set(i),n.uniformMatrix4fv(this.addr,!1,nd),Ft(t,i)}}function g_(n,e){let t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function __(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Lt(t,e))return;n.uniform2iv(this.addr,e),Ft(t,e)}}function x_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Lt(t,e))return;n.uniform3iv(this.addr,e),Ft(t,e)}}function y_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Lt(t,e))return;n.uniform4iv(this.addr,e),Ft(t,e)}}function v_(n,e){let t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function b_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Lt(t,e))return;n.uniform2uiv(this.addr,e),Ft(t,e)}}function M_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Lt(t,e))return;n.uniform3uiv(this.addr,e),Ft(t,e)}}function S_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Lt(t,e))return;n.uniform4uiv(this.addr,e),Ft(t,e)}}function w_(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r);let s;this.type===n.SAMPLER_2D_SHADOW?(Uc.compareFunction=t.isReversedDepthBuffer()?qa:Xa,s=Uc):s=yd,t.setTexture2D(e||s,r)}function T_(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture3D(e||bd,r)}function E_(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTextureCube(e||Md,r)}function A_(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture2DArray(e||vd,r)}function R_(n){switch(n){case 5126:return c_;case 35664:return u_;case 35665:return h_;case 35666:return d_;case 35674:return f_;case 35675:return p_;case 35676:return m_;case 5124:case 35670:return g_;case 35667:case 35671:return __;case 35668:case 35672:return x_;case 35669:case 35673:return y_;case 5125:return v_;case 36294:return b_;case 36295:return M_;case 36296:return S_;case 35678:case 36198:case 36298:case 36306:case 35682:return w_;case 35679:case 36299:case 36307:return T_;case 35680:case 36300:case 36308:case 36293:return E_;case 36289:case 36303:case 36311:case 36292:return A_}}function C_(n,e){n.uniform1fv(this.addr,e)}function P_(n,e){let t=Ir(e,this.size,2);n.uniform2fv(this.addr,t)}function I_(n,e){let t=Ir(e,this.size,3);n.uniform3fv(this.addr,t)}function D_(n,e){let t=Ir(e,this.size,4);n.uniform4fv(this.addr,t)}function L_(n,e){let t=Ir(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function F_(n,e){let t=Ir(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function N_(n,e){let t=Ir(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function U_(n,e){n.uniform1iv(this.addr,e)}function O_(n,e){n.uniform2iv(this.addr,e)}function B_(n,e){n.uniform3iv(this.addr,e)}function k_(n,e){n.uniform4iv(this.addr,e)}function z_(n,e){n.uniform1uiv(this.addr,e)}function V_(n,e){n.uniform2uiv(this.addr,e)}function G_(n,e){n.uniform3uiv(this.addr,e)}function H_(n,e){n.uniform4uiv(this.addr,e)}function W_(n,e,t){let i=this.cache,r=e.length,s=Qa(t,r);Lt(i,s)||(n.uniform1iv(this.addr,s),Ft(i,s));let o;this.type===n.SAMPLER_2D_SHADOW?o=Uc:o=yd;for(let a=0;a!==r;++a)t.setTexture2D(e[a]||o,s[a])}function X_(n,e,t){let i=this.cache,r=e.length,s=Qa(t,r);Lt(i,s)||(n.uniform1iv(this.addr,s),Ft(i,s));for(let o=0;o!==r;++o)t.setTexture3D(e[o]||bd,s[o])}function q_(n,e,t){let i=this.cache,r=e.length,s=Qa(t,r);Lt(i,s)||(n.uniform1iv(this.addr,s),Ft(i,s));for(let o=0;o!==r;++o)t.setTextureCube(e[o]||Md,s[o])}function Y_(n,e,t){let i=this.cache,r=e.length,s=Qa(t,r);Lt(i,s)||(n.uniform1iv(this.addr,s),Ft(i,s));for(let o=0;o!==r;++o)t.setTexture2DArray(e[o]||vd,s[o])}function $_(n){switch(n){case 5126:return C_;case 35664:return P_;case 35665:return I_;case 35666:return D_;case 35674:return L_;case 35675:return F_;case 35676:return N_;case 5124:case 35670:return U_;case 35667:case 35671:return O_;case 35668:case 35672:return B_;case 35669:case 35673:return k_;case 5125:return z_;case 36294:return V_;case 36295:return G_;case 36296:return H_;case 35678:case 36198:case 36298:case 36306:case 35682:return W_;case 35679:case 36299:case 36307:return X_;case 35680:case 36300:case 36308:case 36293:return q_;case 36289:case 36303:case 36311:case 36292:return Y_}}var Oc=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=R_(t.type)}},Bc=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=$_(t.type)}},kc=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){let r=this.seq;for(let s=0,o=r.length;s!==o;++s){let a=r[s];a.setValue(e,t[a.id],i)}}},Fc=/(\w+)(\])?(\[|\.)?/g;function sd(n,e){n.seq.push(e),n.map[e.id]=e}function Z_(n,e,t){let i=n.name,r=i.length;for(Fc.lastIndex=0;;){let s=Fc.exec(i),o=Fc.lastIndex,a=s[1],l=s[2]==="]",c=s[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===r){sd(t,c===void 0?new Oc(a,n,e):new Bc(a,n,e));break}else{let f=t.map[a];f===void 0&&(f=new kc(a),sd(t,f)),t=f}}}var Pr=class{constructor(e,t){this.seq=[],this.map={};let i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let o=0;o<i;++o){let a=e.getActiveUniform(t,o),l=e.getUniformLocation(t,a.name);Z_(a,l,this)}let r=[],s=[];for(let o of this.seq)o.type===e.SAMPLER_2D_SHADOW||o.type===e.SAMPLER_CUBE_SHADOW||o.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(o):s.push(o);r.length>0&&(this.seq=r.concat(s))}setValue(e,t,i,r){let s=this.map[t];s!==void 0&&s.setValue(e,i,r)}setOptional(e,t,i){let r=t[i];r!==void 0&&this.setValue(e,i,r)}static upload(e,t,i,r){for(let s=0,o=t.length;s!==o;++s){let a=t[s],l=i[a.id];l.needsUpdate!==!1&&a.setValue(e,l.value,r)}}static seqWithValue(e,t){let i=[];for(let r=0,s=e.length;r!==s;++r){let o=e[r];o.id in t&&i.push(o)}return i}};function od(n,e,t){let i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}var K_=37297,J_=0;function j_(n,e){let t=n.split(`
`),i=[],r=Math.max(e-6,0),s=Math.min(e+6,t.length);for(let o=r;o<s;o++){let a=o+1;i.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return i.join(`
`)}var ad=new $e;function Q_(n){rt._getMatrix(ad,rt.workingColorSpace,n);let e=`mat3( ${ad.elements.map(t=>t.toFixed(4))} )`;switch(rt.getTransfer(n)){case Qr:return[e,"LinearTransferOETF"];case lt:return[e,"sRGBTransferOETF"];default:return Be("WebGLProgram: Unsupported color space: ",n),[e,"LinearTransferOETF"]}}function ld(n,e,t){let i=n.getShaderParameter(e,n.COMPILE_STATUS),s=(n.getShaderInfoLog(e)||"").trim();if(i&&s==="")return"";let o=/ERROR: 0:(\d+)/.exec(s);if(o){let a=parseInt(o[1]);return t.toUpperCase()+`

`+s+`

`+j_(n.getShaderSource(e),a)}else return s}function ex(n,e){let t=Q_(e);return[`vec4 ${n}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}var tx={[cc]:"Linear",[uc]:"Reinhard",[hc]:"Cineon",[As]:"ACESFilmic",[fc]:"AgX",[pc]:"Neutral",[dc]:"Custom"};function nx(n,e){let t=tx[e];return t===void 0?(Be("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+n+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var $a=new k;function ix(){rt.getLuminanceCoefficients($a);let n=$a.x.toFixed(4),e=$a.y.toFixed(4),t=$a.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function rx(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ks).join(`
`)}function sx(n){let e=[];for(let t in n){let i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function ox(n,e){let t={},i=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){let s=n.getActiveAttrib(e,r),o=s.name,a=1;s.type===n.FLOAT_MAT2&&(a=2),s.type===n.FLOAT_MAT3&&(a=3),s.type===n.FLOAT_MAT4&&(a=4),t[o]={type:s.type,location:n.getAttribLocation(e,o),locationSize:a}}return t}function ks(n){return n!==""}function cd(n,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function ud(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var ax=/^[ \t]*#include +<([\w\d./]+)>/gm;function zc(n){return n.replace(ax,cx)}var lx=new Map;function cx(n,e){let t=tt[e];if(t===void 0){let i=lx.get(e);if(i!==void 0)t=tt[i],Be('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return zc(t)}var ux=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function hd(n){return n.replace(ux,hx)}function hx(n,e,t,i){let r="";for(let s=parseInt(e);s<parseInt(t);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function dd(n){let e=`precision ${n.precision} float;
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
#define LOW_PRECISION`),e}var dx={[Es]:"SHADOWMAP_TYPE_PCF",[Tr]:"SHADOWMAP_TYPE_VSM"};function fx(n){return dx[n.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var px={[gi]:"ENVMAP_TYPE_CUBE",[Gi]:"ENVMAP_TYPE_CUBE",[Rs]:"ENVMAP_TYPE_CUBE_UV"};function mx(n){return n.envMap===!1?"ENVMAP_TYPE_CUBE":px[n.envMapMode]||"ENVMAP_TYPE_CUBE"}var gx={[Gi]:"ENVMAP_MODE_REFRACTION"};function _x(n){return n.envMap===!1?"ENVMAP_MODE_REFLECTION":gx[n.envMapMode]||"ENVMAP_MODE_REFLECTION"}var xx={[ra]:"ENVMAP_BLENDING_MULTIPLY",[Ah]:"ENVMAP_BLENDING_MIX",[Rh]:"ENVMAP_BLENDING_ADD"};function yx(n){return n.envMap===!1?"ENVMAP_BLENDING_NONE":xx[n.combine]||"ENVMAP_BLENDING_NONE"}function vx(n){let e=n.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,i=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:i,maxMip:t}}function bx(n,e,t,i){let r=n.getContext(),s=t.defines,o=t.vertexShader,a=t.fragmentShader,l=fx(t),c=mx(t),u=_x(t),f=yx(t),h=vx(t),d=rx(t),m=sx(s),b=r.createProgram(),g,p,M=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(g=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m].filter(ks).join(`
`),g.length>0&&(g+=`
`),p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m].filter(ks).join(`
`),p.length>0&&(p+=`
`)):(g=[dd(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ks).join(`
`),p=[dd(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+u:"",t.envMap?"#define "+f:"",h?"#define CUBEUV_TEXEL_WIDTH "+h.texelWidth:"",h?"#define CUBEUV_TEXEL_HEIGHT "+h.texelHeight:"",h?"#define CUBEUV_MAX_MIP "+h.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==wn?"#define TONE_MAPPING":"",t.toneMapping!==wn?tt.tonemapping_pars_fragment:"",t.toneMapping!==wn?nx("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",tt.colorspace_pars_fragment,ex("linearToOutputTexel",t.outputColorSpace),ix(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(ks).join(`
`)),o=zc(o),o=cd(o,t),o=ud(o,t),a=zc(a),a=cd(a,t),a=ud(a,t),o=hd(o),a=hd(a),t.isRawShaderMaterial!==!0&&(M=`#version 300 es
`,g=[d,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+g,p=["#define varying in",t.glslVersion===Mc?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Mc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);let T=M+g+o,v=M+p+a,C=od(r,r.VERTEX_SHADER,T),S=od(r,r.FRAGMENT_SHADER,v);r.attachShader(b,C),r.attachShader(b,S),t.index0AttributeName!==void 0?r.bindAttribLocation(b,0,t.index0AttributeName):t.hasPositionAttribute===!0&&r.bindAttribLocation(b,0,"position"),r.linkProgram(b);function _(R){if(n.debug.checkShaderErrors){let I=r.getProgramInfoLog(b)||"",N=r.getShaderInfoLog(C)||"",U=r.getShaderInfoLog(S)||"",F=I.trim(),O=N.trim(),D=U.trim(),G=!0,K=!0;if(r.getProgramParameter(b,r.LINK_STATUS)===!1)if(G=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(r,b,C,S);else{let Q=ld(r,C,"vertex"),ne=ld(r,S,"fragment");Ve("WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(b,r.VALIDATE_STATUS)+`

Material Name: `+R.name+`
Material Type: `+R.type+`

Program Info Log: `+F+`
`+Q+`
`+ne)}else F!==""?Be("WebGLProgram: Program Info Log:",F):(O===""||D==="")&&(K=!1);K&&(R.diagnostics={runnable:G,programLog:F,vertexShader:{log:O,prefix:g},fragmentShader:{log:D,prefix:p}})}r.deleteShader(C),r.deleteShader(S),x=new Pr(r,b),A=ox(r,b)}let x;this.getUniforms=function(){return x===void 0&&_(this),x};let A;this.getAttributes=function(){return A===void 0&&_(this),A};let E=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return E===!1&&(E=r.getProgramParameter(b,K_)),E},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(b),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=J_++,this.cacheKey=e,this.usedTimes=1,this.program=b,this.vertexShader=C,this.fragmentShader=S,this}var Mx=0,Vc=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,i){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(i)===!1&&(r.add(i),i.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){let t=this.shaderCache,i=t.get(e);return i===void 0&&(i=new Gc(e),t.set(e,i)),i}},Gc=class{constructor(e){this.id=Mx++,this.code=e,this.usedTimes=0}};function Sx(n){return n===yi||n===Fs||n===Ns}function wx(n,e,t,i,r,s){let o=new _r,a=new Vc,l=new Set,c=[],u=new Map,f=i.logarithmicDepthBuffer,h=i.precision,d={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function m(x){return l.add(x),x===0?"uv":`uv${x}`}function b(x,A,E,R,I,N){let U=R.fog,F=I.geometry,O=x.isMeshStandardMaterial||x.isMeshLambertMaterial||x.isMeshPhongMaterial?R.environment:null,D=x.isMeshStandardMaterial||x.isMeshLambertMaterial&&!x.envMap||x.isMeshPhongMaterial&&!x.envMap,G=e.get(x.envMap||O,D),K=G&&G.mapping===Rs?G.image.height:null,Q=d[x.type];x.precision!==null&&(h=i.getMaxPrecision(x.precision),h!==x.precision&&Be("WebGLProgram.getParameters:",x.precision,"not supported, using",h,"instead."));let ne=F.morphAttributes.position||F.morphAttributes.normal||F.morphAttributes.color,ae=ne!==void 0?ne.length:0,Ne=0;F.morphAttributes.position!==void 0&&(Ne=1),F.morphAttributes.normal!==void 0&&(Ne=2),F.morphAttributes.color!==void 0&&(Ne=3);let Ge,Ae,$,W;if(Q){let Ce=zn[Q];Ge=Ce.vertexShader,Ae=Ce.fragmentShader}else{Ge=x.vertexShader,Ae=x.fragmentShader;let Ce=a.getVertexShaderStage(x),Mt=a.getFragmentShaderStage(x);a.update(x,Ce,Mt),$=Ce.id,W=Mt.id}let J=n.getRenderTarget(),fe=n.state.buffers.depth.getReversed(),Se=I.isInstancedMesh===!0,we=I.isBatchedMesh===!0,Re=!!x.map,ie=!!x.matcap,ue=!!G,he=!!x.aoMap,Me=!!x.lightMap,Xe=!!x.bumpMap&&x.wireframe===!1,et=!!x.normalMap,Qe=!!x.displacementMap,He=!!x.emissiveMap,ke=!!x.metalnessMap,Ye=!!x.roughnessMap,L=x.anisotropy>0,vt=x.clearcoat>0,Ke=x.dispersion>0,P=x.iridescence>0,y=x.sheen>0,z=x.transmission>0,H=L&&!!x.anisotropyMap,Z=vt&&!!x.clearcoatMap,le=vt&&!!x.clearcoatNormalMap,ce=vt&&!!x.clearcoatRoughnessMap,j=P&&!!x.iridescenceMap,ee=P&&!!x.iridescenceThicknessMap,pe=y&&!!x.sheenColorMap,Le=y&&!!x.sheenRoughnessMap,_e=!!x.specularMap,me=!!x.specularColorMap,Oe=!!x.specularIntensityMap,ze=z&&!!x.transmissionMap,Je=z&&!!x.thicknessMap,B=!!x.gradientMap,de=!!x.alphaMap,te=x.alphaTest>0,ge=!!x.alphaHash,be=!!x.extensions,re=wn;x.toneMapped&&(J===null||J.isXRRenderTarget===!0)&&(re=n.toneMapping);let Ie={shaderID:Q,shaderType:x.type,shaderName:x.name,vertexShader:Ge,fragmentShader:Ae,defines:x.defines,customVertexShaderID:$,customFragmentShaderID:W,isRawShaderMaterial:x.isRawShaderMaterial===!0,glslVersion:x.glslVersion,precision:h,batching:we,batchingColor:we&&I._colorsTexture!==null,instancing:Se,instancingColor:Se&&I.instanceColor!==null,instancingMorph:Se&&I.morphTexture!==null,outputColorSpace:J===null?n.outputColorSpace:J.isXRRenderTarget===!0?J.texture.colorSpace:rt.workingColorSpace,alphaToCoverage:!!x.alphaToCoverage,map:Re,matcap:ie,envMap:ue,envMapMode:ue&&G.mapping,envMapCubeUVHeight:K,aoMap:he,lightMap:Me,bumpMap:Xe,normalMap:et,displacementMap:Qe,emissiveMap:He,normalMapObjectSpace:et&&x.normalMapType===Ih,normalMapTangentSpace:et&&x.normalMapType===Us,packedNormalMap:et&&x.normalMapType===Us&&Sx(x.normalMap.format),metalnessMap:ke,roughnessMap:Ye,anisotropy:L,anisotropyMap:H,clearcoat:vt,clearcoatMap:Z,clearcoatNormalMap:le,clearcoatRoughnessMap:ce,dispersion:Ke,iridescence:P,iridescenceMap:j,iridescenceThicknessMap:ee,sheen:y,sheenColorMap:pe,sheenRoughnessMap:Le,specularMap:_e,specularColorMap:me,specularIntensityMap:Oe,transmission:z,transmissionMap:ze,thicknessMap:Je,gradientMap:B,opaque:x.transparent===!1&&x.blending===Ui&&x.alphaToCoverage===!1,alphaMap:de,alphaTest:te,alphaHash:ge,combine:x.combine,mapUv:Re&&m(x.map.channel),aoMapUv:he&&m(x.aoMap.channel),lightMapUv:Me&&m(x.lightMap.channel),bumpMapUv:Xe&&m(x.bumpMap.channel),normalMapUv:et&&m(x.normalMap.channel),displacementMapUv:Qe&&m(x.displacementMap.channel),emissiveMapUv:He&&m(x.emissiveMap.channel),metalnessMapUv:ke&&m(x.metalnessMap.channel),roughnessMapUv:Ye&&m(x.roughnessMap.channel),anisotropyMapUv:H&&m(x.anisotropyMap.channel),clearcoatMapUv:Z&&m(x.clearcoatMap.channel),clearcoatNormalMapUv:le&&m(x.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:ce&&m(x.clearcoatRoughnessMap.channel),iridescenceMapUv:j&&m(x.iridescenceMap.channel),iridescenceThicknessMapUv:ee&&m(x.iridescenceThicknessMap.channel),sheenColorMapUv:pe&&m(x.sheenColorMap.channel),sheenRoughnessMapUv:Le&&m(x.sheenRoughnessMap.channel),specularMapUv:_e&&m(x.specularMap.channel),specularColorMapUv:me&&m(x.specularColorMap.channel),specularIntensityMapUv:Oe&&m(x.specularIntensityMap.channel),transmissionMapUv:ze&&m(x.transmissionMap.channel),thicknessMapUv:Je&&m(x.thicknessMap.channel),alphaMapUv:de&&m(x.alphaMap.channel),vertexTangents:!!F.attributes.tangent&&(et||L),vertexNormals:!!F.attributes.normal,vertexColors:x.vertexColors,vertexAlphas:x.vertexColors===!0&&!!F.attributes.color&&F.attributes.color.itemSize===4,pointsUvs:I.isPoints===!0&&!!F.attributes.uv&&(Re||de),fog:!!U,useFog:x.fog===!0,fogExp2:!!U&&U.isFogExp2,flatShading:x.wireframe===!1&&(x.flatShading===!0||F.attributes.normal===void 0&&et===!1&&(x.isMeshLambertMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isMeshPhysicalMaterial)),sizeAttenuation:x.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:fe,skinning:I.isSkinnedMesh===!0,hasPositionAttribute:F.attributes.position!==void 0,morphTargets:F.morphAttributes.position!==void 0,morphNormals:F.morphAttributes.normal!==void 0,morphColors:F.morphAttributes.color!==void 0,morphTargetsCount:ae,morphTextureStride:Ne,numDirLights:A.directional.length,numPointLights:A.point.length,numSpotLights:A.spot.length,numSpotLightMaps:A.spotLightMap.length,numRectAreaLights:A.rectArea.length,numHemiLights:A.hemi.length,numDirLightShadows:A.directionalShadowMap.length,numPointLightShadows:A.pointShadowMap.length,numSpotLightShadows:A.spotShadowMap.length,numSpotLightShadowsWithMaps:A.numSpotLightShadowsWithMaps,numLightProbes:A.numLightProbes,numLightProbeGrids:N.length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:x.dithering,shadowMapEnabled:n.shadowMap.enabled&&E.length>0,shadowMapType:n.shadowMap.type,toneMapping:re,decodeVideoTexture:Re&&x.map.isVideoTexture===!0&&rt.getTransfer(x.map.colorSpace)===lt,decodeVideoTextureEmissive:He&&x.emissiveMap.isVideoTexture===!0&&rt.getTransfer(x.emissiveMap.colorSpace)===lt,premultipliedAlpha:x.premultipliedAlpha,doubleSided:x.side===Ct,flipSided:x.side===Jt,useDepthPacking:x.depthPacking>=0,depthPacking:x.depthPacking||0,index0AttributeName:x.index0AttributeName,extensionClipCullDistance:be&&x.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(be&&x.extensions.multiDraw===!0||we)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:x.customProgramCacheKey()};return Ie.vertexUv1s=l.has(1),Ie.vertexUv2s=l.has(2),Ie.vertexUv3s=l.has(3),l.clear(),Ie}function g(x){let A=[];if(x.shaderID?A.push(x.shaderID):(A.push(x.customVertexShaderID),A.push(x.customFragmentShaderID)),x.defines!==void 0)for(let E in x.defines)A.push(E),A.push(x.defines[E]);return x.isRawShaderMaterial===!1&&(p(A,x),M(A,x),A.push(n.outputColorSpace)),A.push(x.customProgramCacheKey),A.join()}function p(x,A){x.push(A.precision),x.push(A.outputColorSpace),x.push(A.envMapMode),x.push(A.envMapCubeUVHeight),x.push(A.mapUv),x.push(A.alphaMapUv),x.push(A.lightMapUv),x.push(A.aoMapUv),x.push(A.bumpMapUv),x.push(A.normalMapUv),x.push(A.displacementMapUv),x.push(A.emissiveMapUv),x.push(A.metalnessMapUv),x.push(A.roughnessMapUv),x.push(A.anisotropyMapUv),x.push(A.clearcoatMapUv),x.push(A.clearcoatNormalMapUv),x.push(A.clearcoatRoughnessMapUv),x.push(A.iridescenceMapUv),x.push(A.iridescenceThicknessMapUv),x.push(A.sheenColorMapUv),x.push(A.sheenRoughnessMapUv),x.push(A.specularMapUv),x.push(A.specularColorMapUv),x.push(A.specularIntensityMapUv),x.push(A.transmissionMapUv),x.push(A.thicknessMapUv),x.push(A.combine),x.push(A.fogExp2),x.push(A.sizeAttenuation),x.push(A.morphTargetsCount),x.push(A.morphAttributeCount),x.push(A.numDirLights),x.push(A.numPointLights),x.push(A.numSpotLights),x.push(A.numSpotLightMaps),x.push(A.numHemiLights),x.push(A.numRectAreaLights),x.push(A.numDirLightShadows),x.push(A.numPointLightShadows),x.push(A.numSpotLightShadows),x.push(A.numSpotLightShadowsWithMaps),x.push(A.numLightProbes),x.push(A.shadowMapType),x.push(A.toneMapping),x.push(A.numClippingPlanes),x.push(A.numClipIntersection),x.push(A.depthPacking)}function M(x,A){o.disableAll(),A.instancing&&o.enable(0),A.instancingColor&&o.enable(1),A.instancingMorph&&o.enable(2),A.matcap&&o.enable(3),A.envMap&&o.enable(4),A.normalMapObjectSpace&&o.enable(5),A.normalMapTangentSpace&&o.enable(6),A.clearcoat&&o.enable(7),A.iridescence&&o.enable(8),A.alphaTest&&o.enable(9),A.vertexColors&&o.enable(10),A.vertexAlphas&&o.enable(11),A.vertexUv1s&&o.enable(12),A.vertexUv2s&&o.enable(13),A.vertexUv3s&&o.enable(14),A.vertexTangents&&o.enable(15),A.anisotropy&&o.enable(16),A.alphaHash&&o.enable(17),A.batching&&o.enable(18),A.dispersion&&o.enable(19),A.batchingColor&&o.enable(20),A.gradientMap&&o.enable(21),A.packedNormalMap&&o.enable(22),A.vertexNormals&&o.enable(23),x.push(o.mask),o.disableAll(),A.fog&&o.enable(0),A.useFog&&o.enable(1),A.flatShading&&o.enable(2),A.logarithmicDepthBuffer&&o.enable(3),A.reversedDepthBuffer&&o.enable(4),A.skinning&&o.enable(5),A.morphTargets&&o.enable(6),A.morphNormals&&o.enable(7),A.morphColors&&o.enable(8),A.premultipliedAlpha&&o.enable(9),A.shadowMapEnabled&&o.enable(10),A.doubleSided&&o.enable(11),A.flipSided&&o.enable(12),A.useDepthPacking&&o.enable(13),A.dithering&&o.enable(14),A.transmission&&o.enable(15),A.sheen&&o.enable(16),A.opaque&&o.enable(17),A.pointsUvs&&o.enable(18),A.decodeVideoTexture&&o.enable(19),A.decodeVideoTextureEmissive&&o.enable(20),A.alphaToCoverage&&o.enable(21),A.numLightProbeGrids>0&&o.enable(22),A.hasPositionAttribute&&o.enable(23),x.push(o.mask)}function T(x){let A=d[x.type],E;if(A){let R=zn[A];E=Yh.clone(R.uniforms)}else E=x.uniforms;return E}function v(x,A){let E=u.get(A);return E!==void 0?++E.usedTimes:(E=new bx(n,A,x,r),c.push(E),u.set(A,E)),E}function C(x){if(--x.usedTimes===0){let A=c.indexOf(x);c[A]=c[c.length-1],c.pop(),u.delete(x.cacheKey),x.destroy()}}function S(x){a.remove(x)}function _(){a.dispose()}return{getParameters:b,getProgramCacheKey:g,getUniforms:T,acquireProgram:v,releaseProgram:C,releaseShaderCache:S,programs:c,dispose:_}}function Tx(){let n=new WeakMap;function e(o){return n.has(o)}function t(o){let a=n.get(o);return a===void 0&&(a={},n.set(o,a)),a}function i(o){n.delete(o)}function r(o,a,l){n.get(o)[a]=l}function s(){n=new WeakMap}return{has:e,get:t,remove:i,update:r,dispose:s}}function Ex(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.materialVariant!==e.materialVariant?n.materialVariant-e.materialVariant:n.z!==e.z?n.z-e.z:n.id-e.id}function fd(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function pd(){let n=[],e=0,t=[],i=[],r=[];function s(){e=0,t.length=0,i.length=0,r.length=0}function o(h){let d=0;return h.isInstancedMesh&&(d+=2),h.isSkinnedMesh&&(d+=1),d}function a(h,d,m,b,g,p){let M=n[e];return M===void 0?(M={id:h.id,object:h,geometry:d,material:m,materialVariant:o(h),groupOrder:b,renderOrder:h.renderOrder,z:g,group:p},n[e]=M):(M.id=h.id,M.object=h,M.geometry=d,M.material=m,M.materialVariant=o(h),M.groupOrder=b,M.renderOrder=h.renderOrder,M.z=g,M.group=p),e++,M}function l(h,d,m,b,g,p){let M=a(h,d,m,b,g,p);m.transmission>0?i.push(M):m.transparent===!0?r.push(M):t.push(M)}function c(h,d,m,b,g,p){let M=a(h,d,m,b,g,p);m.transmission>0?i.unshift(M):m.transparent===!0?r.unshift(M):t.unshift(M)}function u(h,d,m){t.length>1&&t.sort(h||Ex),i.length>1&&i.sort(d||fd),r.length>1&&r.sort(d||fd),m&&(t.reverse(),i.reverse(),r.reverse())}function f(){for(let h=e,d=n.length;h<d;h++){let m=n[h];if(m.id===null)break;m.id=null,m.object=null,m.geometry=null,m.material=null,m.group=null}}return{opaque:t,transmissive:i,transparent:r,init:s,push:l,unshift:c,finish:f,sort:u}}function Ax(){let n=new WeakMap;function e(i,r){let s=n.get(i),o;return s===void 0?(o=new pd,n.set(i,[o])):r>=s.length?(o=new pd,s.push(o)):o=s[r],o}function t(){n=new WeakMap}return{get:e,dispose:t}}function Rx(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new k,color:new qe};break;case"SpotLight":t={position:new k,direction:new k,color:new qe,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new k,color:new qe,distance:0,decay:0};break;case"HemisphereLight":t={direction:new k,skyColor:new qe,groundColor:new qe};break;case"RectAreaLight":t={color:new qe,position:new k,halfWidth:new k,halfHeight:new k};break}return n[e.id]=t,t}}}function Cx(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new De};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new De};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new De,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}var Px=0;function Ix(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function Dx(n){let e=new Rx,t=Cx(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new k);let r=new k,s=new pt,o=new pt;function a(c){let u=0,f=0,h=0;for(let A=0;A<9;A++)i.probe[A].set(0,0,0);let d=0,m=0,b=0,g=0,p=0,M=0,T=0,v=0,C=0,S=0,_=0;c.sort(Ix);for(let A=0,E=c.length;A<E;A++){let R=c[A],I=R.color,N=R.intensity,U=R.distance,F=null;if(R.shadow&&R.shadow.map&&(R.shadow.map.texture.format===yi?F=R.shadow.map.texture:F=R.shadow.map.depthTexture||R.shadow.map.texture),R.isAmbientLight)u+=I.r*N,f+=I.g*N,h+=I.b*N;else if(R.isLightProbe){for(let O=0;O<9;O++)i.probe[O].addScaledVector(R.sh.coefficients[O],N);_++}else if(R.isDirectionalLight){let O=e.get(R);if(O.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){let D=R.shadow,G=t.get(R);G.shadowIntensity=D.intensity,G.shadowBias=D.bias,G.shadowNormalBias=D.normalBias,G.shadowRadius=D.radius,G.shadowMapSize=D.mapSize,i.directionalShadow[d]=G,i.directionalShadowMap[d]=F,i.directionalShadowMatrix[d]=R.shadow.matrix,M++}i.directional[d]=O,d++}else if(R.isSpotLight){let O=e.get(R);O.position.setFromMatrixPosition(R.matrixWorld),O.color.copy(I).multiplyScalar(N),O.distance=U,O.coneCos=Math.cos(R.angle),O.penumbraCos=Math.cos(R.angle*(1-R.penumbra)),O.decay=R.decay,i.spot[b]=O;let D=R.shadow;if(R.map&&(i.spotLightMap[C]=R.map,C++,D.updateMatrices(R),R.castShadow&&S++),i.spotLightMatrix[b]=D.matrix,R.castShadow){let G=t.get(R);G.shadowIntensity=D.intensity,G.shadowBias=D.bias,G.shadowNormalBias=D.normalBias,G.shadowRadius=D.radius,G.shadowMapSize=D.mapSize,i.spotShadow[b]=G,i.spotShadowMap[b]=F,v++}b++}else if(R.isRectAreaLight){let O=e.get(R);O.color.copy(I).multiplyScalar(N),O.halfWidth.set(R.width*.5,0,0),O.halfHeight.set(0,R.height*.5,0),i.rectArea[g]=O,g++}else if(R.isPointLight){let O=e.get(R);if(O.color.copy(R.color).multiplyScalar(R.intensity),O.distance=R.distance,O.decay=R.decay,R.castShadow){let D=R.shadow,G=t.get(R);G.shadowIntensity=D.intensity,G.shadowBias=D.bias,G.shadowNormalBias=D.normalBias,G.shadowRadius=D.radius,G.shadowMapSize=D.mapSize,G.shadowCameraNear=D.camera.near,G.shadowCameraFar=D.camera.far,i.pointShadow[m]=G,i.pointShadowMap[m]=F,i.pointShadowMatrix[m]=R.shadow.matrix,T++}i.point[m]=O,m++}else if(R.isHemisphereLight){let O=e.get(R);O.skyColor.copy(R.color).multiplyScalar(N),O.groundColor.copy(R.groundColor).multiplyScalar(N),i.hemi[p]=O,p++}}g>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=xe.LTC_FLOAT_1,i.rectAreaLTC2=xe.LTC_FLOAT_2):(i.rectAreaLTC1=xe.LTC_HALF_1,i.rectAreaLTC2=xe.LTC_HALF_2)),i.ambient[0]=u,i.ambient[1]=f,i.ambient[2]=h;let x=i.hash;(x.directionalLength!==d||x.pointLength!==m||x.spotLength!==b||x.rectAreaLength!==g||x.hemiLength!==p||x.numDirectionalShadows!==M||x.numPointShadows!==T||x.numSpotShadows!==v||x.numSpotMaps!==C||x.numLightProbes!==_)&&(i.directional.length=d,i.spot.length=b,i.rectArea.length=g,i.point.length=m,i.hemi.length=p,i.directionalShadow.length=M,i.directionalShadowMap.length=M,i.pointShadow.length=T,i.pointShadowMap.length=T,i.spotShadow.length=v,i.spotShadowMap.length=v,i.directionalShadowMatrix.length=M,i.pointShadowMatrix.length=T,i.spotLightMatrix.length=v+C-S,i.spotLightMap.length=C,i.numSpotLightShadowsWithMaps=S,i.numLightProbes=_,x.directionalLength=d,x.pointLength=m,x.spotLength=b,x.rectAreaLength=g,x.hemiLength=p,x.numDirectionalShadows=M,x.numPointShadows=T,x.numSpotShadows=v,x.numSpotMaps=C,x.numLightProbes=_,i.version=Px++)}function l(c,u){let f=0,h=0,d=0,m=0,b=0,g=u.matrixWorldInverse;for(let p=0,M=c.length;p<M;p++){let T=c[p];if(T.isDirectionalLight){let v=i.directional[f];v.direction.setFromMatrixPosition(T.matrixWorld),r.setFromMatrixPosition(T.target.matrixWorld),v.direction.sub(r),v.direction.transformDirection(g),f++}else if(T.isSpotLight){let v=i.spot[d];v.position.setFromMatrixPosition(T.matrixWorld),v.position.applyMatrix4(g),v.direction.setFromMatrixPosition(T.matrixWorld),r.setFromMatrixPosition(T.target.matrixWorld),v.direction.sub(r),v.direction.transformDirection(g),d++}else if(T.isRectAreaLight){let v=i.rectArea[m];v.position.setFromMatrixPosition(T.matrixWorld),v.position.applyMatrix4(g),o.identity(),s.copy(T.matrixWorld),s.premultiply(g),o.extractRotation(s),v.halfWidth.set(T.width*.5,0,0),v.halfHeight.set(0,T.height*.5,0),v.halfWidth.applyMatrix4(o),v.halfHeight.applyMatrix4(o),m++}else if(T.isPointLight){let v=i.point[h];v.position.setFromMatrixPosition(T.matrixWorld),v.position.applyMatrix4(g),h++}else if(T.isHemisphereLight){let v=i.hemi[b];v.direction.setFromMatrixPosition(T.matrixWorld),v.direction.transformDirection(g),b++}}}return{setup:a,setupView:l,state:i}}function md(n){let e=new Dx(n),t=[],i=[],r=[];function s(h){f.camera=h,t.length=0,i.length=0,r.length=0}function o(h){t.push(h)}function a(h){i.push(h)}function l(h){r.push(h)}function c(){e.setup(t)}function u(h){e.setupView(t,h)}let f={lightsArray:t,shadowsArray:i,lightProbeGridArray:r,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:s,state:f,setupLights:c,setupLightsView:u,pushLight:o,pushShadow:a,pushLightProbeGrid:l}}function Lx(n){let e=new WeakMap;function t(r,s=0){let o=e.get(r),a;return o===void 0?(a=new md(n),e.set(r,[a])):s>=o.length?(a=new md(n),o.push(a)):a=o[s],a}function i(){e=new WeakMap}return{get:t,dispose:i}}var Fx=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Nx=`uniform sampler2D shadow_pass;
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
}`,Ux=[new k(1,0,0),new k(-1,0,0),new k(0,1,0),new k(0,-1,0),new k(0,0,1),new k(0,0,-1)],Ox=[new k(0,-1,0),new k(0,-1,0),new k(0,0,1),new k(0,0,-1),new k(0,-1,0),new k(0,-1,0)],gd=new pt,Bs=new k,Nc=new k;function Bx(n,e,t){let i=new yr,r=new De,s=new De,o=new xt,a=new Ho,l=new Wo,c={},u=t.maxTextureSize,f={[bn]:Jt,[Jt]:bn,[Ct]:Ct},h=new cn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new De},radius:{value:4}},vertexShader:Fx,fragmentShader:Nx}),d=h.clone();d.defines.HORIZONTAL_PASS=1;let m=new Rt;m.setAttribute("position",new Zt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let b=new yt(m,h),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Es;let p=this.type;this.render=function(S,_,x){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||S.length===0)return;this.type===ia&&(Be("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=Es);let A=n.getRenderTarget(),E=n.getActiveCubeFace(),R=n.getActiveMipmapLevel(),I=n.state;I.setBlending(On),I.buffers.depth.getReversed()===!0?I.buffers.color.setClear(0,0,0,0):I.buffers.color.setClear(1,1,1,1),I.buffers.depth.setTest(!0),I.setScissorTest(!1);let N=p!==this.type;N&&_.traverse(function(U){U.material&&(Array.isArray(U.material)?U.material.forEach(F=>F.needsUpdate=!0):U.material.needsUpdate=!0)});for(let U=0,F=S.length;U<F;U++){let O=S[U],D=O.shadow;if(D===void 0){Be("WebGLShadowMap:",O,"has no shadow.");continue}if(D.autoUpdate===!1&&D.needsUpdate===!1)continue;r.copy(D.mapSize);let G=D.getFrameExtents();r.multiply(G),s.copy(D.mapSize),(r.x>u||r.y>u)&&(r.x>u&&(s.x=Math.floor(u/G.x),r.x=s.x*G.x,D.mapSize.x=s.x),r.y>u&&(s.y=Math.floor(u/G.y),r.y=s.y*G.y,D.mapSize.y=s.y));let K=n.state.buffers.depth.getReversed();if(D.camera._reversedDepth=K,D.map===null||N===!0){if(D.map!==null&&(D.map.depthTexture!==null&&(D.map.depthTexture.dispose(),D.map.depthTexture=null),D.map.dispose()),this.type===Tr){if(O.isPointLight){Be("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}D.map=new ln(r.x,r.y,{format:yi,type:Bn,minFilter:Dt,magFilter:Dt,generateMipmaps:!1}),D.map.texture.name=O.name+".shadowMap",D.map.depthTexture=new Jn(r.x,r.y,fn),D.map.depthTexture.name=O.name+".shadowMapDepth",D.map.depthTexture.format=Fn,D.map.depthTexture.compareFunction=null,D.map.depthTexture.minFilter=Bt,D.map.depthTexture.magFilter=Bt}else O.isPointLight?(D.map=new Ka(r.x),D.map.depthTexture=new zo(r.x,Tn)):(D.map=new ln(r.x,r.y),D.map.depthTexture=new Jn(r.x,r.y,Tn)),D.map.depthTexture.name=O.name+".shadowMap",D.map.depthTexture.format=Fn,this.type===Es?(D.map.depthTexture.compareFunction=K?qa:Xa,D.map.depthTexture.minFilter=Dt,D.map.depthTexture.magFilter=Dt):(D.map.depthTexture.compareFunction=null,D.map.depthTexture.minFilter=Bt,D.map.depthTexture.magFilter=Bt);D.camera.updateProjectionMatrix()}let Q=D.map.isWebGLCubeRenderTarget?6:1;for(let ne=0;ne<Q;ne++){if(D.map.isWebGLCubeRenderTarget)n.setRenderTarget(D.map,ne),n.clear();else{ne===0&&(n.setRenderTarget(D.map),n.clear());let ae=D.getViewport(ne);o.set(s.x*ae.x,s.y*ae.y,s.x*ae.z,s.y*ae.w),I.viewport(o)}if(O.isPointLight){let ae=D.camera,Ne=D.matrix,Ge=O.distance||ae.far;Ge!==ae.far&&(ae.far=Ge,ae.updateProjectionMatrix()),Bs.setFromMatrixPosition(O.matrixWorld),ae.position.copy(Bs),Nc.copy(ae.position),Nc.add(Ux[ne]),ae.up.copy(Ox[ne]),ae.lookAt(Nc),ae.updateMatrixWorld(),Ne.makeTranslation(-Bs.x,-Bs.y,-Bs.z),gd.multiplyMatrices(ae.projectionMatrix,ae.matrixWorldInverse),D._frustum.setFromProjectionMatrix(gd,ae.coordinateSystem,ae.reversedDepth)}else D.updateMatrices(O);i=D.getFrustum(),v(_,x,D.camera,O,this.type)}D.isPointLightShadow!==!0&&this.type===Tr&&M(D,x),D.needsUpdate=!1}p=this.type,g.needsUpdate=!1,n.setRenderTarget(A,E,R)};function M(S,_){let x=e.update(b);h.defines.VSM_SAMPLES!==S.blurSamples&&(h.defines.VSM_SAMPLES=S.blurSamples,d.defines.VSM_SAMPLES=S.blurSamples,h.needsUpdate=!0,d.needsUpdate=!0),S.mapPass===null&&(S.mapPass=new ln(r.x,r.y,{format:yi,type:Bn})),h.uniforms.shadow_pass.value=S.map.depthTexture,h.uniforms.resolution.value=S.mapSize,h.uniforms.radius.value=S.radius,n.setRenderTarget(S.mapPass),n.clear(),n.renderBufferDirect(_,null,x,h,b,null),d.uniforms.shadow_pass.value=S.mapPass.texture,d.uniforms.resolution.value=S.mapSize,d.uniforms.radius.value=S.radius,n.setRenderTarget(S.map),n.clear(),n.renderBufferDirect(_,null,x,d,b,null)}function T(S,_,x,A){let E=null,R=x.isPointLight===!0?S.customDistanceMaterial:S.customDepthMaterial;if(R!==void 0)E=R;else if(E=x.isPointLight===!0?l:a,n.localClippingEnabled&&_.clipShadows===!0&&Array.isArray(_.clippingPlanes)&&_.clippingPlanes.length!==0||_.displacementMap&&_.displacementScale!==0||_.alphaMap&&_.alphaTest>0||_.map&&_.alphaTest>0||_.alphaToCoverage===!0){let I=E.uuid,N=_.uuid,U=c[I];U===void 0&&(U={},c[I]=U);let F=U[N];F===void 0&&(F=E.clone(),U[N]=F,_.addEventListener("dispose",C)),E=F}if(E.visible=_.visible,E.wireframe=_.wireframe,A===Tr?E.side=_.shadowSide!==null?_.shadowSide:_.side:E.side=_.shadowSide!==null?_.shadowSide:f[_.side],E.alphaMap=_.alphaMap,E.alphaTest=_.alphaToCoverage===!0?.5:_.alphaTest,E.map=_.map,E.clipShadows=_.clipShadows,E.clippingPlanes=_.clippingPlanes,E.clipIntersection=_.clipIntersection,E.displacementMap=_.displacementMap,E.displacementScale=_.displacementScale,E.displacementBias=_.displacementBias,E.wireframeLinewidth=_.wireframeLinewidth,E.linewidth=_.linewidth,x.isPointLight===!0&&E.isMeshDistanceMaterial===!0){let I=n.properties.get(E);I.light=x}return E}function v(S,_,x,A,E){if(S.visible===!1)return;if(S.layers.test(_.layers)&&(S.isMesh||S.isLine||S.isPoints)&&(S.castShadow||S.receiveShadow&&E===Tr)&&(!S.frustumCulled||i.intersectsObject(S))){S.modelViewMatrix.multiplyMatrices(x.matrixWorldInverse,S.matrixWorld);let N=e.update(S),U=S.material;if(Array.isArray(U)){let F=N.groups;for(let O=0,D=F.length;O<D;O++){let G=F[O],K=U[G.materialIndex];if(K&&K.visible){let Q=T(S,K,A,E);S.onBeforeShadow(n,S,_,x,N,Q,G),n.renderBufferDirect(x,null,N,Q,S,G),S.onAfterShadow(n,S,_,x,N,Q,G)}}}else if(U.visible){let F=T(S,U,A,E);S.onBeforeShadow(n,S,_,x,N,F,null),n.renderBufferDirect(x,null,N,F,S,null),S.onAfterShadow(n,S,_,x,N,F,null)}}let I=S.children;for(let N=0,U=I.length;N<U;N++)v(I[N],_,x,A,E)}function C(S){S.target.removeEventListener("dispose",C);for(let x in c){let A=c[x],E=S.target.uuid;E in A&&(A[E].dispose(),delete A[E])}}}function kx(n,e){function t(){let B=!1,de=new xt,te=null,ge=new xt(0,0,0,0);return{setMask:function(be){te!==be&&!B&&(n.colorMask(be,be,be,be),te=be)},setLocked:function(be){B=be},setClear:function(be,re,Ie,Ce,Mt){Mt===!0&&(be*=Ce,re*=Ce,Ie*=Ce),de.set(be,re,Ie,Ce),ge.equals(de)===!1&&(n.clearColor(be,re,Ie,Ce),ge.copy(de))},reset:function(){B=!1,te=null,ge.set(-1,0,0,0)}}}function i(){let B=!1,de=!1,te=null,ge=null,be=null;return{setReversed:function(re){if(de!==re){let Ie=e.get("EXT_clip_control");re?Ie.clipControlEXT(Ie.LOWER_LEFT_EXT,Ie.ZERO_TO_ONE_EXT):Ie.clipControlEXT(Ie.LOWER_LEFT_EXT,Ie.NEGATIVE_ONE_TO_ONE_EXT),de=re;let Ce=be;be=null,this.setClear(Ce)}},getReversed:function(){return de},setTest:function(re){re?J(n.DEPTH_TEST):fe(n.DEPTH_TEST)},setMask:function(re){te!==re&&!B&&(n.depthMask(re),te=re)},setFunc:function(re){if(de&&(re=Vh[re]),ge!==re){switch(re){case Ao:n.depthFunc(n.NEVER);break;case Ro:n.depthFunc(n.ALWAYS);break;case Co:n.depthFunc(n.LESS);break;case Oi:n.depthFunc(n.LEQUAL);break;case Po:n.depthFunc(n.EQUAL);break;case Io:n.depthFunc(n.GEQUAL);break;case Do:n.depthFunc(n.GREATER);break;case Lo:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}ge=re}},setLocked:function(re){B=re},setClear:function(re){be!==re&&(be=re,de&&(re=1-re),n.clearDepth(re))},reset:function(){B=!1,te=null,ge=null,be=null,de=!1}}}function r(){let B=!1,de=null,te=null,ge=null,be=null,re=null,Ie=null,Ce=null,Mt=null;return{setTest:function(mt){B||(mt?J(n.STENCIL_TEST):fe(n.STENCIL_TEST))},setMask:function(mt){de!==mt&&!B&&(n.stencilMask(mt),de=mt)},setFunc:function(mt,Cn,Pn){(te!==mt||ge!==Cn||be!==Pn)&&(n.stencilFunc(mt,Cn,Pn),te=mt,ge=Cn,be=Pn)},setOp:function(mt,Cn,Pn){(re!==mt||Ie!==Cn||Ce!==Pn)&&(n.stencilOp(mt,Cn,Pn),re=mt,Ie=Cn,Ce=Pn)},setLocked:function(mt){B=mt},setClear:function(mt){Mt!==mt&&(n.clearStencil(mt),Mt=mt)},reset:function(){B=!1,de=null,te=null,ge=null,be=null,re=null,Ie=null,Ce=null,Mt=null}}}let s=new t,o=new i,a=new r,l=new WeakMap,c=new WeakMap,u={},f={},h={},d=new WeakMap,m=[],b=null,g=!1,p=null,M=null,T=null,v=null,C=null,S=null,_=null,x=new qe(0,0,0),A=0,E=!1,R=null,I=null,N=null,U=null,F=null,O=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS),D=!1,G=0,K=n.getParameter(n.VERSION);K.indexOf("WebGL")!==-1?(G=parseFloat(/^WebGL (\d)/.exec(K)[1]),D=G>=1):K.indexOf("OpenGL ES")!==-1&&(G=parseFloat(/^OpenGL ES (\d)/.exec(K)[1]),D=G>=2);let Q=null,ne={},ae=n.getParameter(n.SCISSOR_BOX),Ne=n.getParameter(n.VIEWPORT),Ge=new xt().fromArray(ae),Ae=new xt().fromArray(Ne);function $(B,de,te,ge){let be=new Uint8Array(4),re=n.createTexture();n.bindTexture(B,re),n.texParameteri(B,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(B,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let Ie=0;Ie<te;Ie++)B===n.TEXTURE_3D||B===n.TEXTURE_2D_ARRAY?n.texImage3D(de,0,n.RGBA,1,1,ge,0,n.RGBA,n.UNSIGNED_BYTE,be):n.texImage2D(de+Ie,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,be);return re}let W={};W[n.TEXTURE_2D]=$(n.TEXTURE_2D,n.TEXTURE_2D,1),W[n.TEXTURE_CUBE_MAP]=$(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),W[n.TEXTURE_2D_ARRAY]=$(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),W[n.TEXTURE_3D]=$(n.TEXTURE_3D,n.TEXTURE_3D,1,1),s.setClear(0,0,0,1),o.setClear(1),a.setClear(0),J(n.DEPTH_TEST),o.setFunc(Oi),Xe(!1),et(sc),J(n.CULL_FACE),he(On);function J(B){u[B]!==!0&&(n.enable(B),u[B]=!0)}function fe(B){u[B]!==!1&&(n.disable(B),u[B]=!1)}function Se(B,de){return h[B]!==de?(n.bindFramebuffer(B,de),h[B]=de,B===n.DRAW_FRAMEBUFFER&&(h[n.FRAMEBUFFER]=de),B===n.FRAMEBUFFER&&(h[n.DRAW_FRAMEBUFFER]=de),!0):!1}function we(B,de){let te=m,ge=!1;if(B){te=d.get(de),te===void 0&&(te=[],d.set(de,te));let be=B.textures;if(te.length!==be.length||te[0]!==n.COLOR_ATTACHMENT0){for(let re=0,Ie=be.length;re<Ie;re++)te[re]=n.COLOR_ATTACHMENT0+re;te.length=be.length,ge=!0}}else te[0]!==n.BACK&&(te[0]=n.BACK,ge=!0);ge&&n.drawBuffers(te)}function Re(B){return b!==B?(n.useProgram(B),b=B,!0):!1}let ie={[ci]:n.FUNC_ADD,[uh]:n.FUNC_SUBTRACT,[hh]:n.FUNC_REVERSE_SUBTRACT};ie[dh]=n.MIN,ie[fh]=n.MAX;let ue={[ph]:n.ZERO,[mh]:n.ONE,[gh]:n.SRC_COLOR,[To]:n.SRC_ALPHA,[Mh]:n.SRC_ALPHA_SATURATE,[vh]:n.DST_COLOR,[xh]:n.DST_ALPHA,[_h]:n.ONE_MINUS_SRC_COLOR,[Eo]:n.ONE_MINUS_SRC_ALPHA,[bh]:n.ONE_MINUS_DST_COLOR,[yh]:n.ONE_MINUS_DST_ALPHA,[Sh]:n.CONSTANT_COLOR,[wh]:n.ONE_MINUS_CONSTANT_COLOR,[Th]:n.CONSTANT_ALPHA,[Eh]:n.ONE_MINUS_CONSTANT_ALPHA};function he(B,de,te,ge,be,re,Ie,Ce,Mt,mt){if(B===On){g===!0&&(fe(n.BLEND),g=!1);return}if(g===!1&&(J(n.BLEND),g=!0),B!==ch){if(B!==p||mt!==E){if((M!==ci||C!==ci)&&(n.blendEquation(n.FUNC_ADD),M=ci,C=ci),mt)switch(B){case Ui:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case oc:n.blendFunc(n.ONE,n.ONE);break;case ac:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case lc:n.blendFuncSeparate(n.DST_COLOR,n.ONE_MINUS_SRC_ALPHA,n.ZERO,n.ONE);break;default:Ve("WebGLState: Invalid blending: ",B);break}else switch(B){case Ui:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case oc:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE,n.ONE,n.ONE);break;case ac:Ve("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case lc:Ve("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ve("WebGLState: Invalid blending: ",B);break}T=null,v=null,S=null,_=null,x.set(0,0,0),A=0,p=B,E=mt}return}be=be||de,re=re||te,Ie=Ie||ge,(de!==M||be!==C)&&(n.blendEquationSeparate(ie[de],ie[be]),M=de,C=be),(te!==T||ge!==v||re!==S||Ie!==_)&&(n.blendFuncSeparate(ue[te],ue[ge],ue[re],ue[Ie]),T=te,v=ge,S=re,_=Ie),(Ce.equals(x)===!1||Mt!==A)&&(n.blendColor(Ce.r,Ce.g,Ce.b,Mt),x.copy(Ce),A=Mt),p=B,E=!1}function Me(B,de){B.side===Ct?fe(n.CULL_FACE):J(n.CULL_FACE);let te=B.side===Jt;de&&(te=!te),Xe(te),B.blending===Ui&&B.transparent===!1?he(On):he(B.blending,B.blendEquation,B.blendSrc,B.blendDst,B.blendEquationAlpha,B.blendSrcAlpha,B.blendDstAlpha,B.blendColor,B.blendAlpha,B.premultipliedAlpha),o.setFunc(B.depthFunc),o.setTest(B.depthTest),o.setMask(B.depthWrite),s.setMask(B.colorWrite);let ge=B.stencilWrite;a.setTest(ge),ge&&(a.setMask(B.stencilWriteMask),a.setFunc(B.stencilFunc,B.stencilRef,B.stencilFuncMask),a.setOp(B.stencilFail,B.stencilZFail,B.stencilZPass)),He(B.polygonOffset,B.polygonOffsetFactor,B.polygonOffsetUnits),B.alphaToCoverage===!0?J(n.SAMPLE_ALPHA_TO_COVERAGE):fe(n.SAMPLE_ALPHA_TO_COVERAGE)}function Xe(B){R!==B&&(B?n.frontFace(n.CW):n.frontFace(n.CCW),R=B)}function et(B){B!==ah?(J(n.CULL_FACE),B!==I&&(B===sc?n.cullFace(n.BACK):B===lh?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):fe(n.CULL_FACE),I=B}function Qe(B){B!==N&&(D&&n.lineWidth(B),N=B)}function He(B,de,te){B?(J(n.POLYGON_OFFSET_FILL),(U!==de||F!==te)&&(U=de,F=te,o.getReversed()&&(de=-de),n.polygonOffset(de,te))):fe(n.POLYGON_OFFSET_FILL)}function ke(B){B?J(n.SCISSOR_TEST):fe(n.SCISSOR_TEST)}function Ye(B){B===void 0&&(B=n.TEXTURE0+O-1),Q!==B&&(n.activeTexture(B),Q=B)}function L(B,de,te){te===void 0&&(Q===null?te=n.TEXTURE0+O-1:te=Q);let ge=ne[te];ge===void 0&&(ge={type:void 0,texture:void 0},ne[te]=ge),(ge.type!==B||ge.texture!==de)&&(Q!==te&&(n.activeTexture(te),Q=te),n.bindTexture(B,de||W[B]),ge.type=B,ge.texture=de)}function vt(){let B=ne[Q];B!==void 0&&B.type!==void 0&&(n.bindTexture(B.type,null),B.type=void 0,B.texture=void 0)}function Ke(){try{n.compressedTexImage2D(...arguments)}catch(B){Ve("WebGLState:",B)}}function P(){try{n.compressedTexImage3D(...arguments)}catch(B){Ve("WebGLState:",B)}}function y(){try{n.texSubImage2D(...arguments)}catch(B){Ve("WebGLState:",B)}}function z(){try{n.texSubImage3D(...arguments)}catch(B){Ve("WebGLState:",B)}}function H(){try{n.compressedTexSubImage2D(...arguments)}catch(B){Ve("WebGLState:",B)}}function Z(){try{n.compressedTexSubImage3D(...arguments)}catch(B){Ve("WebGLState:",B)}}function le(){try{n.texStorage2D(...arguments)}catch(B){Ve("WebGLState:",B)}}function ce(){try{n.texStorage3D(...arguments)}catch(B){Ve("WebGLState:",B)}}function j(){try{n.texImage2D(...arguments)}catch(B){Ve("WebGLState:",B)}}function ee(){try{n.texImage3D(...arguments)}catch(B){Ve("WebGLState:",B)}}function pe(B){return f[B]!==void 0?f[B]:n.getParameter(B)}function Le(B,de){f[B]!==de&&(n.pixelStorei(B,de),f[B]=de)}function _e(B){Ge.equals(B)===!1&&(n.scissor(B.x,B.y,B.z,B.w),Ge.copy(B))}function me(B){Ae.equals(B)===!1&&(n.viewport(B.x,B.y,B.z,B.w),Ae.copy(B))}function Oe(B,de){let te=c.get(de);te===void 0&&(te=new WeakMap,c.set(de,te));let ge=te.get(B);ge===void 0&&(ge=n.getUniformBlockIndex(de,B.name),te.set(B,ge))}function ze(B,de){let ge=c.get(de).get(B);l.get(de)!==ge&&(n.uniformBlockBinding(de,ge,B.__bindingPointIndex),l.set(de,ge))}function Je(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),o.setReversed(!1),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),n.pixelStorei(n.PACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,n.BROWSER_DEFAULT_WEBGL),n.pixelStorei(n.PACK_ROW_LENGTH,0),n.pixelStorei(n.PACK_SKIP_PIXELS,0),n.pixelStorei(n.PACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_ROW_LENGTH,0),n.pixelStorei(n.UNPACK_IMAGE_HEIGHT,0),n.pixelStorei(n.UNPACK_SKIP_PIXELS,0),n.pixelStorei(n.UNPACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_SKIP_IMAGES,0),u={},f={},Q=null,ne={},h={},d=new WeakMap,m=[],b=null,g=!1,p=null,M=null,T=null,v=null,C=null,S=null,_=null,x=new qe(0,0,0),A=0,E=!1,R=null,I=null,N=null,U=null,F=null,Ge.set(0,0,n.canvas.width,n.canvas.height),Ae.set(0,0,n.canvas.width,n.canvas.height),s.reset(),o.reset(),a.reset()}return{buffers:{color:s,depth:o,stencil:a},enable:J,disable:fe,bindFramebuffer:Se,drawBuffers:we,useProgram:Re,setBlending:he,setMaterial:Me,setFlipSided:Xe,setCullFace:et,setLineWidth:Qe,setPolygonOffset:He,setScissorTest:ke,activeTexture:Ye,bindTexture:L,unbindTexture:vt,compressedTexImage2D:Ke,compressedTexImage3D:P,texImage2D:j,texImage3D:ee,pixelStorei:Le,getParameter:pe,updateUBOMapping:Oe,uniformBlockBinding:ze,texStorage2D:le,texStorage3D:ce,texSubImage2D:y,texSubImage3D:z,compressedTexSubImage2D:H,compressedTexSubImage3D:Z,scissor:_e,viewport:me,reset:Je}}function zx(n,e,t,i,r,s,o){let a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new De,u=new WeakMap,f=new Set,h,d=new WeakMap,m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function b(P,y){return m?new OffscreenCanvas(P,y):es("canvas")}function g(P,y,z){let H=1,Z=Ke(P);if((Z.width>z||Z.height>z)&&(H=z/Math.max(Z.width,Z.height)),H<1)if(typeof HTMLImageElement<"u"&&P instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&P instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&P instanceof ImageBitmap||typeof VideoFrame<"u"&&P instanceof VideoFrame){let le=Math.floor(H*Z.width),ce=Math.floor(H*Z.height);h===void 0&&(h=b(le,ce));let j=y?b(le,ce):h;return j.width=le,j.height=ce,j.getContext("2d").drawImage(P,0,0,le,ce),Be("WebGLRenderer: Texture has been resized from ("+Z.width+"x"+Z.height+") to ("+le+"x"+ce+")."),j}else return"data"in P&&Be("WebGLRenderer: Image in DataTexture is too big ("+Z.width+"x"+Z.height+")."),P;return P}function p(P){return P.generateMipmaps}function M(P){n.generateMipmap(P)}function T(P){return P.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:P.isWebGL3DRenderTarget?n.TEXTURE_3D:P.isWebGLArrayRenderTarget||P.isCompressedArrayTexture?n.TEXTURE_2D_ARRAY:n.TEXTURE_2D}function v(P,y,z,H,Z,le=!1){if(P!==null){if(n[P]!==void 0)return n[P];Be("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+P+"'")}let ce;H&&(ce=e.get("EXT_texture_norm16"),ce||Be("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let j=y;if(y===n.RED&&(z===n.FLOAT&&(j=n.R32F),z===n.HALF_FLOAT&&(j=n.R16F),z===n.UNSIGNED_BYTE&&(j=n.R8),z===n.UNSIGNED_SHORT&&ce&&(j=ce.R16_EXT),z===n.SHORT&&ce&&(j=ce.R16_SNORM_EXT)),y===n.RED_INTEGER&&(z===n.UNSIGNED_BYTE&&(j=n.R8UI),z===n.UNSIGNED_SHORT&&(j=n.R16UI),z===n.UNSIGNED_INT&&(j=n.R32UI),z===n.BYTE&&(j=n.R8I),z===n.SHORT&&(j=n.R16I),z===n.INT&&(j=n.R32I)),y===n.RG&&(z===n.FLOAT&&(j=n.RG32F),z===n.HALF_FLOAT&&(j=n.RG16F),z===n.UNSIGNED_BYTE&&(j=n.RG8),z===n.UNSIGNED_SHORT&&ce&&(j=ce.RG16_EXT),z===n.SHORT&&ce&&(j=ce.RG16_SNORM_EXT)),y===n.RG_INTEGER&&(z===n.UNSIGNED_BYTE&&(j=n.RG8UI),z===n.UNSIGNED_SHORT&&(j=n.RG16UI),z===n.UNSIGNED_INT&&(j=n.RG32UI),z===n.BYTE&&(j=n.RG8I),z===n.SHORT&&(j=n.RG16I),z===n.INT&&(j=n.RG32I)),y===n.RGB_INTEGER&&(z===n.UNSIGNED_BYTE&&(j=n.RGB8UI),z===n.UNSIGNED_SHORT&&(j=n.RGB16UI),z===n.UNSIGNED_INT&&(j=n.RGB32UI),z===n.BYTE&&(j=n.RGB8I),z===n.SHORT&&(j=n.RGB16I),z===n.INT&&(j=n.RGB32I)),y===n.RGBA_INTEGER&&(z===n.UNSIGNED_BYTE&&(j=n.RGBA8UI),z===n.UNSIGNED_SHORT&&(j=n.RGBA16UI),z===n.UNSIGNED_INT&&(j=n.RGBA32UI),z===n.BYTE&&(j=n.RGBA8I),z===n.SHORT&&(j=n.RGBA16I),z===n.INT&&(j=n.RGBA32I)),y===n.RGB&&(z===n.UNSIGNED_SHORT&&ce&&(j=ce.RGB16_EXT),z===n.SHORT&&ce&&(j=ce.RGB16_SNORM_EXT),z===n.UNSIGNED_INT_5_9_9_9_REV&&(j=n.RGB9_E5),z===n.UNSIGNED_INT_10F_11F_11F_REV&&(j=n.R11F_G11F_B10F)),y===n.RGBA){let ee=le?Qr:rt.getTransfer(Z);z===n.FLOAT&&(j=n.RGBA32F),z===n.HALF_FLOAT&&(j=n.RGBA16F),z===n.UNSIGNED_BYTE&&(j=ee===lt?n.SRGB8_ALPHA8:n.RGBA8),z===n.UNSIGNED_SHORT&&ce&&(j=ce.RGBA16_EXT),z===n.SHORT&&ce&&(j=ce.RGBA16_SNORM_EXT),z===n.UNSIGNED_SHORT_4_4_4_4&&(j=n.RGBA4),z===n.UNSIGNED_SHORT_5_5_5_1&&(j=n.RGB5_A1)}return(j===n.R16F||j===n.R32F||j===n.RG16F||j===n.RG32F||j===n.RGBA16F||j===n.RGBA32F)&&e.get("EXT_color_buffer_float"),j}function C(P,y){let z;return P?y===null||y===Tn||y===Ar?z=n.DEPTH24_STENCIL8:y===fn?z=n.DEPTH32F_STENCIL8:y===Er&&(z=n.DEPTH24_STENCIL8,Be("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):y===null||y===Tn||y===Ar?z=n.DEPTH_COMPONENT24:y===fn?z=n.DEPTH_COMPONENT32F:y===Er&&(z=n.DEPTH_COMPONENT16),z}function S(P,y){return p(P)===!0||P.isFramebufferTexture&&P.minFilter!==Bt&&P.minFilter!==Dt?Math.log2(Math.max(y.width,y.height))+1:P.mipmaps!==void 0&&P.mipmaps.length>0?P.mipmaps.length:P.isCompressedTexture&&Array.isArray(P.image)?y.mipmaps.length:1}function _(P){let y=P.target;y.removeEventListener("dispose",_),A(y),y.isVideoTexture&&u.delete(y),y.isHTMLTexture&&f.delete(y)}function x(P){let y=P.target;y.removeEventListener("dispose",x),R(y)}function A(P){let y=i.get(P);if(y.__webglInit===void 0)return;let z=P.source,H=d.get(z);if(H){let Z=H[y.__cacheKey];Z.usedTimes--,Z.usedTimes===0&&E(P),Object.keys(H).length===0&&d.delete(z)}i.remove(P)}function E(P){let y=i.get(P);n.deleteTexture(y.__webglTexture);let z=P.source,H=d.get(z);delete H[y.__cacheKey],o.memory.textures--}function R(P){let y=i.get(P);if(P.depthTexture&&(P.depthTexture.dispose(),i.remove(P.depthTexture)),P.isWebGLCubeRenderTarget)for(let H=0;H<6;H++){if(Array.isArray(y.__webglFramebuffer[H]))for(let Z=0;Z<y.__webglFramebuffer[H].length;Z++)n.deleteFramebuffer(y.__webglFramebuffer[H][Z]);else n.deleteFramebuffer(y.__webglFramebuffer[H]);y.__webglDepthbuffer&&n.deleteRenderbuffer(y.__webglDepthbuffer[H])}else{if(Array.isArray(y.__webglFramebuffer))for(let H=0;H<y.__webglFramebuffer.length;H++)n.deleteFramebuffer(y.__webglFramebuffer[H]);else n.deleteFramebuffer(y.__webglFramebuffer);if(y.__webglDepthbuffer&&n.deleteRenderbuffer(y.__webglDepthbuffer),y.__webglMultisampledFramebuffer&&n.deleteFramebuffer(y.__webglMultisampledFramebuffer),y.__webglColorRenderbuffer)for(let H=0;H<y.__webglColorRenderbuffer.length;H++)y.__webglColorRenderbuffer[H]&&n.deleteRenderbuffer(y.__webglColorRenderbuffer[H]);y.__webglDepthRenderbuffer&&n.deleteRenderbuffer(y.__webglDepthRenderbuffer)}let z=P.textures;for(let H=0,Z=z.length;H<Z;H++){let le=i.get(z[H]);le.__webglTexture&&(n.deleteTexture(le.__webglTexture),o.memory.textures--),i.remove(z[H])}i.remove(P)}let I=0;function N(){I=0}function U(){return I}function F(P){I=P}function O(){let P=I;return P>=r.maxTextures&&Be("WebGLTextures: Trying to use "+P+" texture units while this GPU supports only "+r.maxTextures),I+=1,P}function D(P){let y=[];return y.push(P.wrapS),y.push(P.wrapT),y.push(P.wrapR||0),y.push(P.magFilter),y.push(P.minFilter),y.push(P.anisotropy),y.push(P.internalFormat),y.push(P.format),y.push(P.type),y.push(P.generateMipmaps),y.push(P.premultiplyAlpha),y.push(P.flipY),y.push(P.unpackAlignment),y.push(P.colorSpace),y.join()}function G(P,y){let z=i.get(P);if(P.isVideoTexture&&L(P),P.isRenderTargetTexture===!1&&P.isExternalTexture!==!0&&P.version>0&&z.__version!==P.version){let H=P.image;if(H===null)Be("WebGLRenderer: Texture marked for update but no image data found.");else if(H.complete===!1)Be("WebGLRenderer: Texture marked for update but image is incomplete");else{fe(z,P,y);return}}else P.isExternalTexture&&(z.__webglTexture=P.sourceTexture?P.sourceTexture:null);t.bindTexture(n.TEXTURE_2D,z.__webglTexture,n.TEXTURE0+y)}function K(P,y){let z=i.get(P);if(P.isRenderTargetTexture===!1&&P.version>0&&z.__version!==P.version){fe(z,P,y);return}else P.isExternalTexture&&(z.__webglTexture=P.sourceTexture?P.sourceTexture:null);t.bindTexture(n.TEXTURE_2D_ARRAY,z.__webglTexture,n.TEXTURE0+y)}function Q(P,y){let z=i.get(P);if(P.isRenderTargetTexture===!1&&P.version>0&&z.__version!==P.version){fe(z,P,y);return}t.bindTexture(n.TEXTURE_3D,z.__webglTexture,n.TEXTURE0+y)}function ne(P,y){let z=i.get(P);if(P.isCubeDepthTexture!==!0&&P.version>0&&z.__version!==P.version){Se(z,P,y);return}t.bindTexture(n.TEXTURE_CUBE_MAP,z.__webglTexture,n.TEXTURE0+y)}let ae={[Fo]:n.REPEAT,[Ln]:n.CLAMP_TO_EDGE,[No]:n.MIRRORED_REPEAT},Ne={[Bt]:n.NEAREST,[Ch]:n.NEAREST_MIPMAP_NEAREST,[Cs]:n.NEAREST_MIPMAP_LINEAR,[Dt]:n.LINEAR,[aa]:n.LINEAR_MIPMAP_NEAREST,[_i]:n.LINEAR_MIPMAP_LINEAR},Ge={[Dh]:n.NEVER,[Oh]:n.ALWAYS,[Lh]:n.LESS,[Xa]:n.LEQUAL,[Fh]:n.EQUAL,[qa]:n.GEQUAL,[Nh]:n.GREATER,[Uh]:n.NOTEQUAL};function Ae(P,y){if(y.type===fn&&e.has("OES_texture_float_linear")===!1&&(y.magFilter===Dt||y.magFilter===aa||y.magFilter===Cs||y.magFilter===_i||y.minFilter===Dt||y.minFilter===aa||y.minFilter===Cs||y.minFilter===_i)&&Be("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(P,n.TEXTURE_WRAP_S,ae[y.wrapS]),n.texParameteri(P,n.TEXTURE_WRAP_T,ae[y.wrapT]),(P===n.TEXTURE_3D||P===n.TEXTURE_2D_ARRAY)&&n.texParameteri(P,n.TEXTURE_WRAP_R,ae[y.wrapR]),n.texParameteri(P,n.TEXTURE_MAG_FILTER,Ne[y.magFilter]),n.texParameteri(P,n.TEXTURE_MIN_FILTER,Ne[y.minFilter]),y.compareFunction&&(n.texParameteri(P,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(P,n.TEXTURE_COMPARE_FUNC,Ge[y.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(y.magFilter===Bt||y.minFilter!==Cs&&y.minFilter!==_i||y.type===fn&&e.has("OES_texture_float_linear")===!1)return;if(y.anisotropy>1||i.get(y).__currentAnisotropy){let z=e.get("EXT_texture_filter_anisotropic");n.texParameterf(P,z.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(y.anisotropy,r.getMaxAnisotropy())),i.get(y).__currentAnisotropy=y.anisotropy}}}function $(P,y){let z=!1;P.__webglInit===void 0&&(P.__webglInit=!0,y.addEventListener("dispose",_));let H=y.source,Z=d.get(H);Z===void 0&&(Z={},d.set(H,Z));let le=D(y);if(le!==P.__cacheKey){Z[le]===void 0&&(Z[le]={texture:n.createTexture(),usedTimes:0},o.memory.textures++,z=!0),Z[le].usedTimes++;let ce=Z[P.__cacheKey];ce!==void 0&&(Z[P.__cacheKey].usedTimes--,ce.usedTimes===0&&E(y)),P.__cacheKey=le,P.__webglTexture=Z[le].texture}return z}function W(P,y,z){return Math.floor(Math.floor(P/z)/y)}function J(P,y,z,H){let le=P.updateRanges;if(le.length===0)t.texSubImage2D(n.TEXTURE_2D,0,0,0,y.width,y.height,z,H,y.data);else{le.sort((Le,_e)=>Le.start-_e.start);let ce=0;for(let Le=1;Le<le.length;Le++){let _e=le[ce],me=le[Le],Oe=_e.start+_e.count,ze=W(me.start,y.width,4),Je=W(_e.start,y.width,4);me.start<=Oe+1&&ze===Je&&W(me.start+me.count-1,y.width,4)===ze?_e.count=Math.max(_e.count,me.start+me.count-_e.start):(++ce,le[ce]=me)}le.length=ce+1;let j=t.getParameter(n.UNPACK_ROW_LENGTH),ee=t.getParameter(n.UNPACK_SKIP_PIXELS),pe=t.getParameter(n.UNPACK_SKIP_ROWS);t.pixelStorei(n.UNPACK_ROW_LENGTH,y.width);for(let Le=0,_e=le.length;Le<_e;Le++){let me=le[Le],Oe=Math.floor(me.start/4),ze=Math.ceil(me.count/4),Je=Oe%y.width,B=Math.floor(Oe/y.width),de=ze,te=1;t.pixelStorei(n.UNPACK_SKIP_PIXELS,Je),t.pixelStorei(n.UNPACK_SKIP_ROWS,B),t.texSubImage2D(n.TEXTURE_2D,0,Je,B,de,te,z,H,y.data)}P.clearUpdateRanges(),t.pixelStorei(n.UNPACK_ROW_LENGTH,j),t.pixelStorei(n.UNPACK_SKIP_PIXELS,ee),t.pixelStorei(n.UNPACK_SKIP_ROWS,pe)}}function fe(P,y,z){let H=n.TEXTURE_2D;(y.isDataArrayTexture||y.isCompressedArrayTexture)&&(H=n.TEXTURE_2D_ARRAY),y.isData3DTexture&&(H=n.TEXTURE_3D);let Z=$(P,y),le=y.source;t.bindTexture(H,P.__webglTexture,n.TEXTURE0+z);let ce=i.get(le);if(le.version!==ce.__version||Z===!0){if(t.activeTexture(n.TEXTURE0+z),(typeof ImageBitmap<"u"&&y.image instanceof ImageBitmap)===!1){let te=rt.getPrimaries(rt.workingColorSpace),ge=y.colorSpace===jn?null:rt.getPrimaries(y.colorSpace),be=y.colorSpace===jn||te===ge?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,y.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,y.premultiplyAlpha),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,be)}t.pixelStorei(n.UNPACK_ALIGNMENT,y.unpackAlignment);let ee=g(y.image,!1,r.maxTextureSize);ee=vt(y,ee);let pe=s.convert(y.format,y.colorSpace),Le=s.convert(y.type),_e=v(y.internalFormat,pe,Le,y.normalized,y.colorSpace,y.isVideoTexture);Ae(H,y);let me,Oe=y.mipmaps,ze=y.isVideoTexture!==!0,Je=ce.__version===void 0||Z===!0,B=le.dataReady,de=S(y,ee);if(y.isDepthTexture)_e=C(y.format===xi,y.type),Je&&(ze?t.texStorage2D(n.TEXTURE_2D,1,_e,ee.width,ee.height):t.texImage2D(n.TEXTURE_2D,0,_e,ee.width,ee.height,0,pe,Le,null));else if(y.isDataTexture)if(Oe.length>0){ze&&Je&&t.texStorage2D(n.TEXTURE_2D,de,_e,Oe[0].width,Oe[0].height);for(let te=0,ge=Oe.length;te<ge;te++)me=Oe[te],ze?B&&t.texSubImage2D(n.TEXTURE_2D,te,0,0,me.width,me.height,pe,Le,me.data):t.texImage2D(n.TEXTURE_2D,te,_e,me.width,me.height,0,pe,Le,me.data);y.generateMipmaps=!1}else ze?(Je&&t.texStorage2D(n.TEXTURE_2D,de,_e,ee.width,ee.height),B&&J(y,ee,pe,Le)):t.texImage2D(n.TEXTURE_2D,0,_e,ee.width,ee.height,0,pe,Le,ee.data);else if(y.isCompressedTexture)if(y.isCompressedArrayTexture){ze&&Je&&t.texStorage3D(n.TEXTURE_2D_ARRAY,de,_e,Oe[0].width,Oe[0].height,ee.depth);for(let te=0,ge=Oe.length;te<ge;te++)if(me=Oe[te],y.format!==pn)if(pe!==null)if(ze){if(B)if(y.layerUpdates.size>0){let be=Cc(me.width,me.height,y.format,y.type);for(let re of y.layerUpdates){let Ie=me.data.subarray(re*be/me.data.BYTES_PER_ELEMENT,(re+1)*be/me.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,te,0,0,re,me.width,me.height,1,pe,Ie)}y.clearLayerUpdates()}else t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,te,0,0,0,me.width,me.height,ee.depth,pe,me.data)}else t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,te,_e,me.width,me.height,ee.depth,0,me.data,0,0);else Be("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else ze?B&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,te,0,0,0,me.width,me.height,ee.depth,pe,Le,me.data):t.texImage3D(n.TEXTURE_2D_ARRAY,te,_e,me.width,me.height,ee.depth,0,pe,Le,me.data)}else{ze&&Je&&t.texStorage2D(n.TEXTURE_2D,de,_e,Oe[0].width,Oe[0].height);for(let te=0,ge=Oe.length;te<ge;te++)me=Oe[te],y.format!==pn?pe!==null?ze?B&&t.compressedTexSubImage2D(n.TEXTURE_2D,te,0,0,me.width,me.height,pe,me.data):t.compressedTexImage2D(n.TEXTURE_2D,te,_e,me.width,me.height,0,me.data):Be("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):ze?B&&t.texSubImage2D(n.TEXTURE_2D,te,0,0,me.width,me.height,pe,Le,me.data):t.texImage2D(n.TEXTURE_2D,te,_e,me.width,me.height,0,pe,Le,me.data)}else if(y.isDataArrayTexture)if(ze){if(Je&&t.texStorage3D(n.TEXTURE_2D_ARRAY,de,_e,ee.width,ee.height,ee.depth),B)if(y.layerUpdates.size>0){let te=Cc(ee.width,ee.height,y.format,y.type);for(let ge of y.layerUpdates){let be=ee.data.subarray(ge*te/ee.data.BYTES_PER_ELEMENT,(ge+1)*te/ee.data.BYTES_PER_ELEMENT);t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,ge,ee.width,ee.height,1,pe,Le,be)}y.clearLayerUpdates()}else t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,ee.width,ee.height,ee.depth,pe,Le,ee.data)}else t.texImage3D(n.TEXTURE_2D_ARRAY,0,_e,ee.width,ee.height,ee.depth,0,pe,Le,ee.data);else if(y.isData3DTexture)ze?(Je&&t.texStorage3D(n.TEXTURE_3D,de,_e,ee.width,ee.height,ee.depth),B&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,ee.width,ee.height,ee.depth,pe,Le,ee.data)):t.texImage3D(n.TEXTURE_3D,0,_e,ee.width,ee.height,ee.depth,0,pe,Le,ee.data);else if(y.isFramebufferTexture){if(Je)if(ze)t.texStorage2D(n.TEXTURE_2D,de,_e,ee.width,ee.height);else{let te=ee.width,ge=ee.height;for(let be=0;be<de;be++)t.texImage2D(n.TEXTURE_2D,be,_e,te,ge,0,pe,Le,null),te>>=1,ge>>=1}}else if(y.isHTMLTexture){if("texElementImage2D"in n){let te=n.canvas;if(te.hasAttribute("layoutsubtree")||te.setAttribute("layoutsubtree","true"),ee.parentNode!==te){te.appendChild(ee),f.add(y),te.onpaint=ge=>{let be=ge.changedElements;for(let re of f)be.includes(re.image)&&(re.needsUpdate=!0)},te.requestPaint();return}if(n.texElementImage2D.length===3)n.texElementImage2D(n.TEXTURE_2D,n.RGBA8,ee);else{let be=n.RGBA,re=n.RGBA,Ie=n.UNSIGNED_BYTE;n.texElementImage2D(n.TEXTURE_2D,0,be,re,Ie,ee)}n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE)}}else if(Oe.length>0){if(ze&&Je){let te=Ke(Oe[0]);t.texStorage2D(n.TEXTURE_2D,de,_e,te.width,te.height)}for(let te=0,ge=Oe.length;te<ge;te++)me=Oe[te],ze?B&&t.texSubImage2D(n.TEXTURE_2D,te,0,0,pe,Le,me):t.texImage2D(n.TEXTURE_2D,te,_e,pe,Le,me);y.generateMipmaps=!1}else if(ze){if(Je){let te=Ke(ee);t.texStorage2D(n.TEXTURE_2D,de,_e,te.width,te.height)}B&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,pe,Le,ee)}else t.texImage2D(n.TEXTURE_2D,0,_e,pe,Le,ee);p(y)&&M(H),ce.__version=le.version,y.onUpdate&&y.onUpdate(y)}P.__version=y.version}function Se(P,y,z){if(y.image.length!==6)return;let H=$(P,y),Z=y.source;t.bindTexture(n.TEXTURE_CUBE_MAP,P.__webglTexture,n.TEXTURE0+z);let le=i.get(Z);if(Z.version!==le.__version||H===!0){t.activeTexture(n.TEXTURE0+z);let ce=rt.getPrimaries(rt.workingColorSpace),j=y.colorSpace===jn?null:rt.getPrimaries(y.colorSpace),ee=y.colorSpace===jn||ce===j?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,y.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,y.premultiplyAlpha),t.pixelStorei(n.UNPACK_ALIGNMENT,y.unpackAlignment),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,ee);let pe=y.isCompressedTexture||y.image[0].isCompressedTexture,Le=y.image[0]&&y.image[0].isDataTexture,_e=[];for(let re=0;re<6;re++)!pe&&!Le?_e[re]=g(y.image[re],!0,r.maxCubemapSize):_e[re]=Le?y.image[re].image:y.image[re],_e[re]=vt(y,_e[re]);let me=_e[0],Oe=s.convert(y.format,y.colorSpace),ze=s.convert(y.type),Je=v(y.internalFormat,Oe,ze,y.normalized,y.colorSpace),B=y.isVideoTexture!==!0,de=le.__version===void 0||H===!0,te=Z.dataReady,ge=S(y,me);Ae(n.TEXTURE_CUBE_MAP,y);let be;if(pe){B&&de&&t.texStorage2D(n.TEXTURE_CUBE_MAP,ge,Je,me.width,me.height);for(let re=0;re<6;re++){be=_e[re].mipmaps;for(let Ie=0;Ie<be.length;Ie++){let Ce=be[Ie];y.format!==pn?Oe!==null?B?te&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,Ie,0,0,Ce.width,Ce.height,Oe,Ce.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,Ie,Je,Ce.width,Ce.height,0,Ce.data):Be("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):B?te&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,Ie,0,0,Ce.width,Ce.height,Oe,ze,Ce.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,Ie,Je,Ce.width,Ce.height,0,Oe,ze,Ce.data)}}}else{if(be=y.mipmaps,B&&de){be.length>0&&ge++;let re=Ke(_e[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,ge,Je,re.width,re.height)}for(let re=0;re<6;re++)if(Le){B?te&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,0,0,_e[re].width,_e[re].height,Oe,ze,_e[re].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,Je,_e[re].width,_e[re].height,0,Oe,ze,_e[re].data);for(let Ie=0;Ie<be.length;Ie++){let Mt=be[Ie].image[re].image;B?te&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,Ie+1,0,0,Mt.width,Mt.height,Oe,ze,Mt.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,Ie+1,Je,Mt.width,Mt.height,0,Oe,ze,Mt.data)}}else{B?te&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,0,0,Oe,ze,_e[re]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,Je,Oe,ze,_e[re]);for(let Ie=0;Ie<be.length;Ie++){let Ce=be[Ie];B?te&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,Ie+1,0,0,Oe,ze,Ce.image[re]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,Ie+1,Je,Oe,ze,Ce.image[re])}}}p(y)&&M(n.TEXTURE_CUBE_MAP),le.__version=Z.version,y.onUpdate&&y.onUpdate(y)}P.__version=y.version}function we(P,y,z,H,Z,le){let ce=s.convert(z.format,z.colorSpace),j=s.convert(z.type),ee=v(z.internalFormat,ce,j,z.normalized,z.colorSpace),pe=i.get(y),Le=i.get(z);if(Le.__renderTarget=y,!pe.__hasExternalTextures){let _e=Math.max(1,y.width>>le),me=Math.max(1,y.height>>le);Z===n.TEXTURE_3D||Z===n.TEXTURE_2D_ARRAY?t.texImage3D(Z,le,ee,_e,me,y.depth,0,ce,j,null):t.texImage2D(Z,le,ee,_e,me,0,ce,j,null)}t.bindFramebuffer(n.FRAMEBUFFER,P),Ye(y)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,H,Z,Le.__webglTexture,0,ke(y)):(Z===n.TEXTURE_2D||Z>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&Z<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,H,Z,Le.__webglTexture,le),t.bindFramebuffer(n.FRAMEBUFFER,null)}function Re(P,y,z){if(n.bindRenderbuffer(n.RENDERBUFFER,P),y.depthBuffer){let H=y.depthTexture,Z=H&&H.isDepthTexture?H.type:null,le=C(y.stencilBuffer,Z),ce=y.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;Ye(y)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,ke(y),le,y.width,y.height):z?n.renderbufferStorageMultisample(n.RENDERBUFFER,ke(y),le,y.width,y.height):n.renderbufferStorage(n.RENDERBUFFER,le,y.width,y.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,ce,n.RENDERBUFFER,P)}else{let H=y.textures;for(let Z=0;Z<H.length;Z++){let le=H[Z],ce=s.convert(le.format,le.colorSpace),j=s.convert(le.type),ee=v(le.internalFormat,ce,j,le.normalized,le.colorSpace);Ye(y)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,ke(y),ee,y.width,y.height):z?n.renderbufferStorageMultisample(n.RENDERBUFFER,ke(y),ee,y.width,y.height):n.renderbufferStorage(n.RENDERBUFFER,ee,y.width,y.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function ie(P,y,z){let H=y.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(n.FRAMEBUFFER,P),!(y.depthTexture&&y.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let Z=i.get(y.depthTexture);if(Z.__renderTarget=y,(!Z.__webglTexture||y.depthTexture.image.width!==y.width||y.depthTexture.image.height!==y.height)&&(y.depthTexture.image.width=y.width,y.depthTexture.image.height=y.height,y.depthTexture.needsUpdate=!0),H){if(Z.__webglInit===void 0&&(Z.__webglInit=!0,y.depthTexture.addEventListener("dispose",_)),Z.__webglTexture===void 0){Z.__webglTexture=n.createTexture(),t.bindTexture(n.TEXTURE_CUBE_MAP,Z.__webglTexture),Ae(n.TEXTURE_CUBE_MAP,y.depthTexture);let pe=s.convert(y.depthTexture.format),Le=s.convert(y.depthTexture.type),_e;y.depthTexture.format===Fn?_e=n.DEPTH_COMPONENT24:y.depthTexture.format===xi&&(_e=n.DEPTH24_STENCIL8);for(let me=0;me<6;me++)n.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+me,0,_e,y.width,y.height,0,pe,Le,null)}}else G(y.depthTexture,0);let le=Z.__webglTexture,ce=ke(y),j=H?n.TEXTURE_CUBE_MAP_POSITIVE_X+z:n.TEXTURE_2D,ee=y.depthTexture.format===xi?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;if(y.depthTexture.format===Fn)Ye(y)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,ee,j,le,0,ce):n.framebufferTexture2D(n.FRAMEBUFFER,ee,j,le,0);else if(y.depthTexture.format===xi)Ye(y)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,ee,j,le,0,ce):n.framebufferTexture2D(n.FRAMEBUFFER,ee,j,le,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function ue(P){let y=i.get(P),z=P.isWebGLCubeRenderTarget===!0;if(y.__boundDepthTexture!==P.depthTexture){let H=P.depthTexture;if(y.__depthDisposeCallback&&y.__depthDisposeCallback(),H){let Z=()=>{delete y.__boundDepthTexture,delete y.__depthDisposeCallback,H.removeEventListener("dispose",Z)};H.addEventListener("dispose",Z),y.__depthDisposeCallback=Z}y.__boundDepthTexture=H}if(P.depthTexture&&!y.__autoAllocateDepthBuffer)if(z)for(let H=0;H<6;H++)ie(y.__webglFramebuffer[H],P,H);else{let H=P.texture.mipmaps;H&&H.length>0?ie(y.__webglFramebuffer[0],P,0):ie(y.__webglFramebuffer,P,0)}else if(z){y.__webglDepthbuffer=[];for(let H=0;H<6;H++)if(t.bindFramebuffer(n.FRAMEBUFFER,y.__webglFramebuffer[H]),y.__webglDepthbuffer[H]===void 0)y.__webglDepthbuffer[H]=n.createRenderbuffer(),Re(y.__webglDepthbuffer[H],P,!1);else{let Z=P.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,le=y.__webglDepthbuffer[H];n.bindRenderbuffer(n.RENDERBUFFER,le),n.framebufferRenderbuffer(n.FRAMEBUFFER,Z,n.RENDERBUFFER,le)}}else{let H=P.texture.mipmaps;if(H&&H.length>0?t.bindFramebuffer(n.FRAMEBUFFER,y.__webglFramebuffer[0]):t.bindFramebuffer(n.FRAMEBUFFER,y.__webglFramebuffer),y.__webglDepthbuffer===void 0)y.__webglDepthbuffer=n.createRenderbuffer(),Re(y.__webglDepthbuffer,P,!1);else{let Z=P.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,le=y.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,le),n.framebufferRenderbuffer(n.FRAMEBUFFER,Z,n.RENDERBUFFER,le)}}t.bindFramebuffer(n.FRAMEBUFFER,null)}function he(P,y,z){let H=i.get(P);y!==void 0&&we(H.__webglFramebuffer,P,P.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),z!==void 0&&ue(P)}function Me(P){let y=P.texture,z=i.get(P),H=i.get(y);P.addEventListener("dispose",x);let Z=P.textures,le=P.isWebGLCubeRenderTarget===!0,ce=Z.length>1;if(ce||(H.__webglTexture===void 0&&(H.__webglTexture=n.createTexture()),H.__version=y.version,o.memory.textures++),le){z.__webglFramebuffer=[];for(let j=0;j<6;j++)if(y.mipmaps&&y.mipmaps.length>0){z.__webglFramebuffer[j]=[];for(let ee=0;ee<y.mipmaps.length;ee++)z.__webglFramebuffer[j][ee]=n.createFramebuffer()}else z.__webglFramebuffer[j]=n.createFramebuffer()}else{if(y.mipmaps&&y.mipmaps.length>0){z.__webglFramebuffer=[];for(let j=0;j<y.mipmaps.length;j++)z.__webglFramebuffer[j]=n.createFramebuffer()}else z.__webglFramebuffer=n.createFramebuffer();if(ce)for(let j=0,ee=Z.length;j<ee;j++){let pe=i.get(Z[j]);pe.__webglTexture===void 0&&(pe.__webglTexture=n.createTexture(),o.memory.textures++)}if(P.samples>0&&Ye(P)===!1){z.__webglMultisampledFramebuffer=n.createFramebuffer(),z.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,z.__webglMultisampledFramebuffer);for(let j=0;j<Z.length;j++){let ee=Z[j];z.__webglColorRenderbuffer[j]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,z.__webglColorRenderbuffer[j]);let pe=s.convert(ee.format,ee.colorSpace),Le=s.convert(ee.type),_e=v(ee.internalFormat,pe,Le,ee.normalized,ee.colorSpace,P.isXRRenderTarget===!0),me=ke(P);n.renderbufferStorageMultisample(n.RENDERBUFFER,me,_e,P.width,P.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+j,n.RENDERBUFFER,z.__webglColorRenderbuffer[j])}n.bindRenderbuffer(n.RENDERBUFFER,null),P.depthBuffer&&(z.__webglDepthRenderbuffer=n.createRenderbuffer(),Re(z.__webglDepthRenderbuffer,P,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(le){t.bindTexture(n.TEXTURE_CUBE_MAP,H.__webglTexture),Ae(n.TEXTURE_CUBE_MAP,y);for(let j=0;j<6;j++)if(y.mipmaps&&y.mipmaps.length>0)for(let ee=0;ee<y.mipmaps.length;ee++)we(z.__webglFramebuffer[j][ee],P,y,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ee);else we(z.__webglFramebuffer[j],P,y,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+j,0);p(y)&&M(n.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(ce){for(let j=0,ee=Z.length;j<ee;j++){let pe=Z[j],Le=i.get(pe),_e=n.TEXTURE_2D;(P.isWebGL3DRenderTarget||P.isWebGLArrayRenderTarget)&&(_e=P.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(_e,Le.__webglTexture),Ae(_e,pe),we(z.__webglFramebuffer,P,pe,n.COLOR_ATTACHMENT0+j,_e,0),p(pe)&&M(_e)}t.unbindTexture()}else{let j=n.TEXTURE_2D;if((P.isWebGL3DRenderTarget||P.isWebGLArrayRenderTarget)&&(j=P.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(j,H.__webglTexture),Ae(j,y),y.mipmaps&&y.mipmaps.length>0)for(let ee=0;ee<y.mipmaps.length;ee++)we(z.__webglFramebuffer[ee],P,y,n.COLOR_ATTACHMENT0,j,ee);else we(z.__webglFramebuffer,P,y,n.COLOR_ATTACHMENT0,j,0);p(y)&&M(j),t.unbindTexture()}P.depthBuffer&&ue(P)}function Xe(P){let y=P.textures;for(let z=0,H=y.length;z<H;z++){let Z=y[z];if(p(Z)){let le=T(P),ce=i.get(Z).__webglTexture;t.bindTexture(le,ce),M(le),t.unbindTexture()}}}let et=[],Qe=[];function He(P){if(P.samples>0){if(Ye(P)===!1){let y=P.textures,z=P.width,H=P.height,Z=n.COLOR_BUFFER_BIT,le=P.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ce=i.get(P),j=y.length>1;if(j)for(let pe=0;pe<y.length;pe++)t.bindFramebuffer(n.FRAMEBUFFER,ce.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+pe,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,ce.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+pe,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,ce.__webglMultisampledFramebuffer);let ee=P.texture.mipmaps;ee&&ee.length>0?t.bindFramebuffer(n.DRAW_FRAMEBUFFER,ce.__webglFramebuffer[0]):t.bindFramebuffer(n.DRAW_FRAMEBUFFER,ce.__webglFramebuffer);for(let pe=0;pe<y.length;pe++){if(P.resolveDepthBuffer&&(P.depthBuffer&&(Z|=n.DEPTH_BUFFER_BIT),P.stencilBuffer&&P.resolveStencilBuffer&&(Z|=n.STENCIL_BUFFER_BIT)),j){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,ce.__webglColorRenderbuffer[pe]);let Le=i.get(y[pe]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,Le,0)}n.blitFramebuffer(0,0,z,H,0,0,z,H,Z,n.NEAREST),l===!0&&(et.length=0,Qe.length=0,et.push(n.COLOR_ATTACHMENT0+pe),P.depthBuffer&&P.resolveDepthBuffer===!1&&(et.push(le),Qe.push(le),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,Qe)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,et))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),j)for(let pe=0;pe<y.length;pe++){t.bindFramebuffer(n.FRAMEBUFFER,ce.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+pe,n.RENDERBUFFER,ce.__webglColorRenderbuffer[pe]);let Le=i.get(y[pe]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,ce.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+pe,n.TEXTURE_2D,Le,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,ce.__webglMultisampledFramebuffer)}else if(P.depthBuffer&&P.resolveDepthBuffer===!1&&l){let y=P.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[y])}}}function ke(P){return Math.min(r.maxSamples,P.samples)}function Ye(P){let y=i.get(P);return P.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&y.__useRenderToTexture!==!1}function L(P){let y=o.render.frame;u.get(P)!==y&&(u.set(P,y),P.update())}function vt(P,y){let z=P.colorSpace,H=P.format,Z=P.type;return P.isCompressedTexture===!0||P.isVideoTexture===!0||z!==jr&&z!==jn&&(rt.getTransfer(z)===lt?(H!==pn||Z!==Qt)&&Be("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ve("WebGLTextures: Unsupported texture color space:",z)),y}function Ke(P){return typeof HTMLImageElement<"u"&&P instanceof HTMLImageElement?(c.width=P.naturalWidth||P.width,c.height=P.naturalHeight||P.height):typeof VideoFrame<"u"&&P instanceof VideoFrame?(c.width=P.displayWidth,c.height=P.displayHeight):(c.width=P.width,c.height=P.height),c}this.allocateTextureUnit=O,this.resetTextureUnits=N,this.getTextureUnits=U,this.setTextureUnits=F,this.setTexture2D=G,this.setTexture2DArray=K,this.setTexture3D=Q,this.setTextureCube=ne,this.rebindTextures=he,this.setupRenderTarget=Me,this.updateRenderTargetMipmap=Xe,this.updateMultisampleRenderTarget=He,this.setupDepthRenderbuffer=ue,this.setupFrameBufferTexture=we,this.useMultisampledRTT=Ye,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function Vx(n,e){function t(i,r=jn){let s,o=rt.getTransfer(r);if(i===Qt)return n.UNSIGNED_BYTE;if(i===ca)return n.UNSIGNED_SHORT_4_4_4_4;if(i===ua)return n.UNSIGNED_SHORT_5_5_5_1;if(i===xc)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===yc)return n.UNSIGNED_INT_10F_11F_11F_REV;if(i===gc)return n.BYTE;if(i===_c)return n.SHORT;if(i===Er)return n.UNSIGNED_SHORT;if(i===la)return n.INT;if(i===Tn)return n.UNSIGNED_INT;if(i===fn)return n.FLOAT;if(i===Bn)return n.HALF_FLOAT;if(i===vc)return n.ALPHA;if(i===bc)return n.RGB;if(i===pn)return n.RGBA;if(i===Fn)return n.DEPTH_COMPONENT;if(i===xi)return n.DEPTH_STENCIL;if(i===ha)return n.RED;if(i===da)return n.RED_INTEGER;if(i===yi)return n.RG;if(i===fa)return n.RG_INTEGER;if(i===pa)return n.RGBA_INTEGER;if(i===Ps||i===Is||i===Ds||i===Ls)if(o===lt)if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(i===Ps)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===Is)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===Ds)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===Ls)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=e.get("WEBGL_compressed_texture_s3tc"),s!==null){if(i===Ps)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===Is)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===Ds)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===Ls)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===ma||i===ga||i===_a||i===xa)if(s=e.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(i===ma)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===ga)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===_a)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===xa)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===ya||i===va||i===ba||i===Ma||i===Sa||i===Fs||i===wa)if(s=e.get("WEBGL_compressed_texture_etc"),s!==null){if(i===ya||i===va)return o===lt?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(i===ba)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC;if(i===Ma)return s.COMPRESSED_R11_EAC;if(i===Sa)return s.COMPRESSED_SIGNED_R11_EAC;if(i===Fs)return s.COMPRESSED_RG11_EAC;if(i===wa)return s.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===Ta||i===Ea||i===Aa||i===Ra||i===Ca||i===Pa||i===Ia||i===Da||i===La||i===Fa||i===Na||i===Ua||i===Oa||i===Ba)if(s=e.get("WEBGL_compressed_texture_astc"),s!==null){if(i===Ta)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Ea)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===Aa)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Ra)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Ca)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Pa)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Ia)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Da)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===La)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Fa)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Na)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===Ua)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Oa)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Ba)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===ka||i===za||i===Va)if(s=e.get("EXT_texture_compression_bptc"),s!==null){if(i===ka)return o===lt?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===za)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===Va)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===Ga||i===Ha||i===Ns||i===Wa)if(s=e.get("EXT_texture_compression_rgtc"),s!==null){if(i===Ga)return s.COMPRESSED_RED_RGTC1_EXT;if(i===Ha)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===Ns)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===Wa)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Ar?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:t}}var Gx=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Hx=`
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

}`,Hc=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let i=new hs(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=i}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,i=new cn({vertexShader:Gx,fragmentShader:Hx,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new yt(new Vi(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Wc=class extends Mn{constructor(e,t){super();let i=this,r=null,s=1,o=null,a="local-floor",l=1,c=null,u=null,f=null,h=null,d=null,m=null,b=typeof XRWebGLBinding<"u",g=new Hc,p={},M=t.getContextAttributes(),T=null,v=null,C=[],S=[],_=new De,x=null,A=new Wt;A.viewport=new xt;let E=new Wt;E.viewport=new xt;let R=[A,E],I=new na,N=null,U=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function($){let W=C[$];return W===void 0&&(W=new xr,C[$]=W),W.getTargetRaySpace()},this.getControllerGrip=function($){let W=C[$];return W===void 0&&(W=new xr,C[$]=W),W.getGripSpace()},this.getHand=function($){let W=C[$];return W===void 0&&(W=new xr,C[$]=W),W.getHandSpace()};function F($){let W=S.indexOf($.inputSource);if(W===-1)return;let J=C[W];J!==void 0&&(J.update($.inputSource,$.frame,c||o),J.dispatchEvent({type:$.type,data:$.inputSource}))}function O(){r.removeEventListener("select",F),r.removeEventListener("selectstart",F),r.removeEventListener("selectend",F),r.removeEventListener("squeeze",F),r.removeEventListener("squeezestart",F),r.removeEventListener("squeezeend",F),r.removeEventListener("end",O),r.removeEventListener("inputsourceschange",D);for(let $=0;$<C.length;$++){let W=S[$];W!==null&&(S[$]=null,C[$].disconnect(W))}N=null,U=null,g.reset();for(let $ in p)delete p[$];e.setRenderTarget(T),d=null,h=null,f=null,r=null,v=null,Ae.stop(),i.isPresenting=!1,e.setPixelRatio(x),e.setSize(_.width,_.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function($){s=$,i.isPresenting===!0&&Be("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function($){a=$,i.isPresenting===!0&&Be("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function($){c=$},this.getBaseLayer=function(){return h!==null?h:d},this.getBinding=function(){return f===null&&b&&(f=new XRWebGLBinding(r,t)),f},this.getFrame=function(){return m},this.getSession=function(){return r},this.setSession=async function($){if(r=$,r!==null){if(T=e.getRenderTarget(),r.addEventListener("select",F),r.addEventListener("selectstart",F),r.addEventListener("selectend",F),r.addEventListener("squeeze",F),r.addEventListener("squeezestart",F),r.addEventListener("squeezeend",F),r.addEventListener("end",O),r.addEventListener("inputsourceschange",D),M.xrCompatible!==!0&&await t.makeXRCompatible(),x=e.getPixelRatio(),e.getSize(_),b&&"createProjectionLayer"in XRWebGLBinding.prototype){let J=null,fe=null,Se=null;M.depth&&(Se=M.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,J=M.stencil?xi:Fn,fe=M.stencil?Ar:Tn);let we={colorFormat:t.RGBA8,depthFormat:Se,scaleFactor:s};f=this.getBinding(),h=f.createProjectionLayer(we),r.updateRenderState({layers:[h]}),e.setPixelRatio(1),e.setSize(h.textureWidth,h.textureHeight,!1),v=new ln(h.textureWidth,h.textureHeight,{format:pn,type:Qt,depthTexture:new Jn(h.textureWidth,h.textureHeight,fe,void 0,void 0,void 0,void 0,void 0,void 0,J),stencilBuffer:M.stencil,colorSpace:e.outputColorSpace,samples:M.antialias?4:0,resolveDepthBuffer:h.ignoreDepthValues===!1,resolveStencilBuffer:h.ignoreDepthValues===!1})}else{let J={antialias:M.antialias,alpha:!0,depth:M.depth,stencil:M.stencil,framebufferScaleFactor:s};d=new XRWebGLLayer(r,t,J),r.updateRenderState({baseLayer:d}),e.setPixelRatio(1),e.setSize(d.framebufferWidth,d.framebufferHeight,!1),v=new ln(d.framebufferWidth,d.framebufferHeight,{format:pn,type:Qt,colorSpace:e.outputColorSpace,stencilBuffer:M.stencil,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1})}v.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await r.requestReferenceSpace(a),Ae.setContext(r),Ae.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return g.getDepthTexture()};function D($){for(let W=0;W<$.removed.length;W++){let J=$.removed[W],fe=S.indexOf(J);fe>=0&&(S[fe]=null,C[fe].disconnect(J))}for(let W=0;W<$.added.length;W++){let J=$.added[W],fe=S.indexOf(J);if(fe===-1){for(let we=0;we<C.length;we++)if(we>=S.length){S.push(J),fe=we;break}else if(S[we]===null){S[we]=J,fe=we;break}if(fe===-1)break}let Se=C[fe];Se&&Se.connect(J)}}let G=new k,K=new k;function Q($,W,J){G.setFromMatrixPosition(W.matrixWorld),K.setFromMatrixPosition(J.matrixWorld);let fe=G.distanceTo(K),Se=W.projectionMatrix.elements,we=J.projectionMatrix.elements,Re=Se[14]/(Se[10]-1),ie=Se[14]/(Se[10]+1),ue=(Se[9]+1)/Se[5],he=(Se[9]-1)/Se[5],Me=(Se[8]-1)/Se[0],Xe=(we[8]+1)/we[0],et=Re*Me,Qe=Re*Xe,He=fe/(-Me+Xe),ke=He*-Me;if(W.matrixWorld.decompose($.position,$.quaternion,$.scale),$.translateX(ke),$.translateZ(He),$.matrixWorld.compose($.position,$.quaternion,$.scale),$.matrixWorldInverse.copy($.matrixWorld).invert(),Se[10]===-1)$.projectionMatrix.copy(W.projectionMatrix),$.projectionMatrixInverse.copy(W.projectionMatrixInverse);else{let Ye=Re+He,L=ie+He,vt=et-ke,Ke=Qe+(fe-ke),P=ue*ie/L*Ye,y=he*ie/L*Ye;$.projectionMatrix.makePerspective(vt,Ke,P,y,Ye,L),$.projectionMatrixInverse.copy($.projectionMatrix).invert()}}function ne($,W){W===null?$.matrixWorld.copy($.matrix):$.matrixWorld.multiplyMatrices(W.matrixWorld,$.matrix),$.matrixWorldInverse.copy($.matrixWorld).invert()}this.updateCamera=function($){if(r===null)return;let W=$.near,J=$.far;g.texture!==null&&(g.depthNear>0&&(W=g.depthNear),g.depthFar>0&&(J=g.depthFar)),I.near=E.near=A.near=W,I.far=E.far=A.far=J,(N!==I.near||U!==I.far)&&(r.updateRenderState({depthNear:I.near,depthFar:I.far}),N=I.near,U=I.far),I.layers.mask=$.layers.mask|6,A.layers.mask=I.layers.mask&-5,E.layers.mask=I.layers.mask&-3;let fe=$.parent,Se=I.cameras;ne(I,fe);for(let we=0;we<Se.length;we++)ne(Se[we],fe);Se.length===2?Q(I,A,E):I.projectionMatrix.copy(A.projectionMatrix),ae($,I,fe)};function ae($,W,J){J===null?$.matrix.copy(W.matrixWorld):($.matrix.copy(J.matrixWorld),$.matrix.invert(),$.matrix.multiply(W.matrixWorld)),$.matrix.decompose($.position,$.quaternion,$.scale),$.updateMatrixWorld(!0),$.projectionMatrix.copy(W.projectionMatrix),$.projectionMatrixInverse.copy(W.projectionMatrixInverse),$.isPerspectiveCamera&&($.fov=mr*2*Math.atan(1/$.projectionMatrix.elements[5]),$.zoom=1)}this.getCamera=function(){return I},this.getFoveation=function(){if(!(h===null&&d===null))return l},this.setFoveation=function($){l=$,h!==null&&(h.fixedFoveation=$),d!==null&&d.fixedFoveation!==void 0&&(d.fixedFoveation=$)},this.hasDepthSensing=function(){return g.texture!==null},this.getDepthSensingMesh=function(){return g.getMesh(I)},this.getCameraTexture=function($){return p[$]};let Ne=null;function Ge($,W){if(u=W.getViewerPose(c||o),m=W,u!==null){let J=u.views;d!==null&&(e.setRenderTargetFramebuffer(v,d.framebuffer),e.setRenderTarget(v));let fe=!1;J.length!==I.cameras.length&&(I.cameras.length=0,fe=!0);for(let ie=0;ie<J.length;ie++){let ue=J[ie],he=null;if(d!==null)he=d.getViewport(ue);else{let Xe=f.getViewSubImage(h,ue);he=Xe.viewport,ie===0&&(e.setRenderTargetTextures(v,Xe.colorTexture,Xe.depthStencilTexture),e.setRenderTarget(v))}let Me=R[ie];Me===void 0&&(Me=new Wt,Me.layers.enable(ie),Me.viewport=new xt,R[ie]=Me),Me.matrix.fromArray(ue.transform.matrix),Me.matrix.decompose(Me.position,Me.quaternion,Me.scale),Me.projectionMatrix.fromArray(ue.projectionMatrix),Me.projectionMatrixInverse.copy(Me.projectionMatrix).invert(),Me.viewport.set(he.x,he.y,he.width,he.height),ie===0&&(I.matrix.copy(Me.matrix),I.matrix.decompose(I.position,I.quaternion,I.scale)),fe===!0&&I.cameras.push(Me)}let Se=r.enabledFeatures;if(Se&&Se.includes("depth-sensing")&&r.depthUsage=="gpu-optimized"&&b){f=i.getBinding();let ie=f.getDepthInformation(J[0]);ie&&ie.isValid&&ie.texture&&g.init(ie,r.renderState)}if(Se&&Se.includes("camera-access")&&b){e.state.unbindTexture(),f=i.getBinding();for(let ie=0;ie<J.length;ie++){let ue=J[ie].camera;if(ue){let he=p[ue];he||(he=new hs,p[ue]=he);let Me=f.getCameraImage(ue);he.sourceTexture=Me}}}}for(let J=0;J<C.length;J++){let fe=S[J],Se=C[J];fe!==null&&Se!==void 0&&Se.update(fe,W,c||o)}Ne&&Ne($,W),W.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:W}),m=null}let Ae=new _d;Ae.setAnimationLoop(Ge),this.setAnimationLoop=function($){Ne=$},this.dispose=function(){}}},Wx=new pt,Sd=new $e;Sd.set(-1,0,0,0,1,0,0,0,1);function Xx(n,e){function t(g,p){g.matrixAutoUpdate===!0&&g.updateMatrix(),p.value.copy(g.matrix)}function i(g,p){p.color.getRGB(g.fogColor.value,Ec(n)),p.isFog?(g.fogNear.value=p.near,g.fogFar.value=p.far):p.isFogExp2&&(g.fogDensity.value=p.density)}function r(g,p,M,T,v){p.isNodeMaterial?p.uniformsNeedUpdate=!1:p.isMeshBasicMaterial?s(g,p):p.isMeshLambertMaterial?(s(g,p),p.envMap&&(g.envMapIntensity.value=p.envMapIntensity)):p.isMeshToonMaterial?(s(g,p),f(g,p)):p.isMeshPhongMaterial?(s(g,p),u(g,p),p.envMap&&(g.envMapIntensity.value=p.envMapIntensity)):p.isMeshStandardMaterial?(s(g,p),h(g,p),p.isMeshPhysicalMaterial&&d(g,p,v)):p.isMeshMatcapMaterial?(s(g,p),m(g,p)):p.isMeshDepthMaterial?s(g,p):p.isMeshDistanceMaterial?(s(g,p),b(g,p)):p.isMeshNormalMaterial?s(g,p):p.isLineBasicMaterial?(o(g,p),p.isLineDashedMaterial&&a(g,p)):p.isPointsMaterial?l(g,p,M,T):p.isSpriteMaterial?c(g,p):p.isShadowMaterial?(g.color.value.copy(p.color),g.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function s(g,p){g.opacity.value=p.opacity,p.color&&g.diffuse.value.copy(p.color),p.emissive&&g.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(g.map.value=p.map,t(p.map,g.mapTransform)),p.alphaMap&&(g.alphaMap.value=p.alphaMap,t(p.alphaMap,g.alphaMapTransform)),p.bumpMap&&(g.bumpMap.value=p.bumpMap,t(p.bumpMap,g.bumpMapTransform),g.bumpScale.value=p.bumpScale,p.side===Jt&&(g.bumpScale.value*=-1)),p.normalMap&&(g.normalMap.value=p.normalMap,t(p.normalMap,g.normalMapTransform),g.normalScale.value.copy(p.normalScale),p.side===Jt&&g.normalScale.value.negate()),p.displacementMap&&(g.displacementMap.value=p.displacementMap,t(p.displacementMap,g.displacementMapTransform),g.displacementScale.value=p.displacementScale,g.displacementBias.value=p.displacementBias),p.emissiveMap&&(g.emissiveMap.value=p.emissiveMap,t(p.emissiveMap,g.emissiveMapTransform)),p.specularMap&&(g.specularMap.value=p.specularMap,t(p.specularMap,g.specularMapTransform)),p.alphaTest>0&&(g.alphaTest.value=p.alphaTest);let M=e.get(p),T=M.envMap,v=M.envMapRotation;T&&(g.envMap.value=T,g.envMapRotation.value.setFromMatrix4(Wx.makeRotationFromEuler(v)).transpose(),T.isCubeTexture&&T.isRenderTargetTexture===!1&&g.envMapRotation.value.premultiply(Sd),g.reflectivity.value=p.reflectivity,g.ior.value=p.ior,g.refractionRatio.value=p.refractionRatio),p.lightMap&&(g.lightMap.value=p.lightMap,g.lightMapIntensity.value=p.lightMapIntensity,t(p.lightMap,g.lightMapTransform)),p.aoMap&&(g.aoMap.value=p.aoMap,g.aoMapIntensity.value=p.aoMapIntensity,t(p.aoMap,g.aoMapTransform))}function o(g,p){g.diffuse.value.copy(p.color),g.opacity.value=p.opacity,p.map&&(g.map.value=p.map,t(p.map,g.mapTransform))}function a(g,p){g.dashSize.value=p.dashSize,g.totalSize.value=p.dashSize+p.gapSize,g.scale.value=p.scale}function l(g,p,M,T){g.diffuse.value.copy(p.color),g.opacity.value=p.opacity,g.size.value=p.size*M,g.scale.value=T*.5,p.map&&(g.map.value=p.map,t(p.map,g.uvTransform)),p.alphaMap&&(g.alphaMap.value=p.alphaMap,t(p.alphaMap,g.alphaMapTransform)),p.alphaTest>0&&(g.alphaTest.value=p.alphaTest)}function c(g,p){g.diffuse.value.copy(p.color),g.opacity.value=p.opacity,g.rotation.value=p.rotation,p.map&&(g.map.value=p.map,t(p.map,g.mapTransform)),p.alphaMap&&(g.alphaMap.value=p.alphaMap,t(p.alphaMap,g.alphaMapTransform)),p.alphaTest>0&&(g.alphaTest.value=p.alphaTest)}function u(g,p){g.specular.value.copy(p.specular),g.shininess.value=Math.max(p.shininess,1e-4)}function f(g,p){p.gradientMap&&(g.gradientMap.value=p.gradientMap)}function h(g,p){g.metalness.value=p.metalness,p.metalnessMap&&(g.metalnessMap.value=p.metalnessMap,t(p.metalnessMap,g.metalnessMapTransform)),g.roughness.value=p.roughness,p.roughnessMap&&(g.roughnessMap.value=p.roughnessMap,t(p.roughnessMap,g.roughnessMapTransform)),p.envMap&&(g.envMapIntensity.value=p.envMapIntensity)}function d(g,p,M){g.ior.value=p.ior,p.sheen>0&&(g.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),g.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(g.sheenColorMap.value=p.sheenColorMap,t(p.sheenColorMap,g.sheenColorMapTransform)),p.sheenRoughnessMap&&(g.sheenRoughnessMap.value=p.sheenRoughnessMap,t(p.sheenRoughnessMap,g.sheenRoughnessMapTransform))),p.clearcoat>0&&(g.clearcoat.value=p.clearcoat,g.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(g.clearcoatMap.value=p.clearcoatMap,t(p.clearcoatMap,g.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(g.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,t(p.clearcoatRoughnessMap,g.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(g.clearcoatNormalMap.value=p.clearcoatNormalMap,t(p.clearcoatNormalMap,g.clearcoatNormalMapTransform),g.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===Jt&&g.clearcoatNormalScale.value.negate())),p.dispersion>0&&(g.dispersion.value=p.dispersion),p.iridescence>0&&(g.iridescence.value=p.iridescence,g.iridescenceIOR.value=p.iridescenceIOR,g.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],g.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(g.iridescenceMap.value=p.iridescenceMap,t(p.iridescenceMap,g.iridescenceMapTransform)),p.iridescenceThicknessMap&&(g.iridescenceThicknessMap.value=p.iridescenceThicknessMap,t(p.iridescenceThicknessMap,g.iridescenceThicknessMapTransform))),p.transmission>0&&(g.transmission.value=p.transmission,g.transmissionSamplerMap.value=M.texture,g.transmissionSamplerSize.value.set(M.width,M.height),p.transmissionMap&&(g.transmissionMap.value=p.transmissionMap,t(p.transmissionMap,g.transmissionMapTransform)),g.thickness.value=p.thickness,p.thicknessMap&&(g.thicknessMap.value=p.thicknessMap,t(p.thicknessMap,g.thicknessMapTransform)),g.attenuationDistance.value=p.attenuationDistance,g.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(g.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(g.anisotropyMap.value=p.anisotropyMap,t(p.anisotropyMap,g.anisotropyMapTransform))),g.specularIntensity.value=p.specularIntensity,g.specularColor.value.copy(p.specularColor),p.specularColorMap&&(g.specularColorMap.value=p.specularColorMap,t(p.specularColorMap,g.specularColorMapTransform)),p.specularIntensityMap&&(g.specularIntensityMap.value=p.specularIntensityMap,t(p.specularIntensityMap,g.specularIntensityMapTransform))}function m(g,p){p.matcap&&(g.matcap.value=p.matcap)}function b(g,p){let M=e.get(p).light;g.referencePosition.value.setFromMatrixPosition(M.matrixWorld),g.nearDistance.value=M.shadow.camera.near,g.farDistance.value=M.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function qx(n,e,t,i){let r={},s={},o=[],a=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function l(v,C){let S=C.program;i.uniformBlockBinding(v,S)}function c(v,C){let S=r[v.id];S===void 0&&(g(v),S=u(v),r[v.id]=S,v.addEventListener("dispose",M));let _=C.program;i.updateUBOMapping(v,_);let x=e.render.frame;s[v.id]!==x&&(h(v),s[v.id]=x)}function u(v){let C=f();v.__bindingPointIndex=C;let S=n.createBuffer(),_=v.__size,x=v.usage;return n.bindBuffer(n.UNIFORM_BUFFER,S),n.bufferData(n.UNIFORM_BUFFER,_,x),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,C,S),S}function f(){for(let v=0;v<a;v++)if(o.indexOf(v)===-1)return o.push(v),v;return Ve("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function h(v){let C=r[v.id],S=v.uniforms,_=v.__cache;n.bindBuffer(n.UNIFORM_BUFFER,C);for(let x=0,A=S.length;x<A;x++){let E=S[x];if(Array.isArray(E))for(let R=0,I=E.length;R<I;R++)d(E[R],x,R,_);else d(E,x,0,_)}n.bindBuffer(n.UNIFORM_BUFFER,null)}function d(v,C,S,_){if(b(v,C,S,_)===!0){let x=v.__offset,A=v.value;if(Array.isArray(A)){let E=0;for(let R=0;R<A.length;R++){let I=A[R],N=p(I);m(I,v.__data,E),typeof I!="number"&&typeof I!="boolean"&&!I.isMatrix3&&!ArrayBuffer.isView(I)&&(E+=N.storage/Float32Array.BYTES_PER_ELEMENT)}}else m(A,v.__data,0);n.bufferSubData(n.UNIFORM_BUFFER,x,v.__data)}}function m(v,C,S){typeof v=="number"||typeof v=="boolean"?C[0]=v:v.isMatrix3?(C[0]=v.elements[0],C[1]=v.elements[1],C[2]=v.elements[2],C[3]=0,C[4]=v.elements[3],C[5]=v.elements[4],C[6]=v.elements[5],C[7]=0,C[8]=v.elements[6],C[9]=v.elements[7],C[10]=v.elements[8],C[11]=0):ArrayBuffer.isView(v)?C.set(new v.constructor(v.buffer,v.byteOffset,C.length)):v.toArray(C,S)}function b(v,C,S,_){let x=v.value,A=C+"_"+S;if(_[A]===void 0)return typeof x=="number"||typeof x=="boolean"?_[A]=x:ArrayBuffer.isView(x)?_[A]=x.slice():_[A]=x.clone(),!0;{let E=_[A];if(typeof x=="number"||typeof x=="boolean"){if(E!==x)return _[A]=x,!0}else{if(ArrayBuffer.isView(x))return!0;if(E.equals(x)===!1)return E.copy(x),!0}}return!1}function g(v){let C=v.uniforms,S=0,_=16;for(let A=0,E=C.length;A<E;A++){let R=Array.isArray(C[A])?C[A]:[C[A]];for(let I=0,N=R.length;I<N;I++){let U=R[I],F=Array.isArray(U.value)?U.value:[U.value];for(let O=0,D=F.length;O<D;O++){let G=F[O],K=p(G),Q=S%_,ne=Q%K.boundary,ae=Q+ne;S+=ne,ae!==0&&_-ae<K.storage&&(S+=_-ae),U.__data=new Float32Array(K.storage/Float32Array.BYTES_PER_ELEMENT),U.__offset=S,S+=K.storage}}}let x=S%_;return x>0&&(S+=_-x),v.__size=S,v.__cache={},this}function p(v){let C={boundary:0,storage:0};return typeof v=="number"||typeof v=="boolean"?(C.boundary=4,C.storage=4):v.isVector2?(C.boundary=8,C.storage=8):v.isVector3||v.isColor?(C.boundary=16,C.storage=12):v.isVector4?(C.boundary=16,C.storage=16):v.isMatrix3?(C.boundary=48,C.storage=48):v.isMatrix4?(C.boundary=64,C.storage=64):v.isTexture?Be("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(v)?(C.boundary=16,C.storage=v.byteLength):Be("WebGLRenderer: Unsupported uniform value type.",v),C}function M(v){let C=v.target;C.removeEventListener("dispose",M);let S=o.indexOf(C.__bindingPointIndex);o.splice(S,1),n.deleteBuffer(r[C.id]),delete r[C.id],delete s[C.id]}function T(){for(let v in r)n.deleteBuffer(r[v]);o=[],r={},s={}}return{bind:l,update:c,dispose:T}}var Yx=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),kn=null;function $x(){return kn===null&&(kn=new as(Yx,16,16,yi,Bn),kn.name="DFG_LUT",kn.minFilter=Dt,kn.magFilter=Dt,kn.wrapS=Ln,kn.wrapT=Ln,kn.generateMipmaps=!1,kn.needsUpdate=!0),kn}var Ja=class{constructor(e={}){let{canvas:t=Bh(),context:i=null,depth:r=!0,stencil:s=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:f=!1,reversedDepthBuffer:h=!1,outputBufferType:d=Qt}=e;this.isWebGLRenderer=!0;let m;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");m=i.getContextAttributes().alpha}else m=o;let b=d,g=new Set([pa,fa,da]),p=new Set([Qt,Tn,Er,Ar,ca,ua]),M=new Uint32Array(4),T=new Int32Array(4),v=new k,C=null,S=null,_=[],x=[],A=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=wn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let E=this,R=!1,I=null,N=null,U=null,F=null;this._outputColorSpace=Ot;let O=0,D=0,G=null,K=-1,Q=null,ne=new xt,ae=new xt,Ne=null,Ge=new qe(0),Ae=0,$=t.width,W=t.height,J=1,fe=null,Se=null,we=new xt(0,0,$,W),Re=new xt(0,0,$,W),ie=!1,ue=new yr,he=!1,Me=!1,Xe=new pt,et=new k,Qe=new xt,He={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},ke=!1;function Ye(){return G===null?J:1}let L=i;function vt(w,V){return t.getContext(w,V)}try{let w={alpha:!0,depth:r,stencil:s,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:u,failIfMajorPerformanceCaveat:f};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"185"}`),t.addEventListener("webglcontextlost",Mt,!1),t.addEventListener("webglcontextrestored",mt,!1),t.addEventListener("webglcontextcreationerror",Cn,!1),L===null){let V="webgl2";if(L=vt(V,w),L===null)throw vt(V)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(w){throw Ve("WebGLRenderer: "+w.message),w}let Ke,P,y,z,H,Z,le,ce,j,ee,pe,Le,_e,me,Oe,ze,Je,B,de,te,ge,be,re;function Ie(){Ke=new t_(L),Ke.init(),ge=new Vx(L,Ke),P=new Y0(L,Ke,e,ge),y=new kx(L,Ke),P.reversedDepthBuffer&&h&&y.buffers.depth.setReversed(!0),N=L.createFramebuffer(),U=L.createFramebuffer(),F=L.createFramebuffer(),z=new r_(L),H=new Tx,Z=new zx(L,Ke,y,H,P,ge,z),le=new e_(E),ce=new lm(L),be=new X0(L,ce),j=new n_(L,ce,z,be),ee=new o_(L,j,ce,be,z),B=new s_(L,P,Z),Oe=new $0(H),pe=new wx(E,le,Ke,P,be,Oe),Le=new Xx(E,H),_e=new Ax,me=new Lx(Ke),Je=new W0(E,le,y,ee,m,l),ze=new Bx(E,ee,P),re=new qx(L,z,P,y),de=new q0(L,Ke,z),te=new i_(L,Ke,z),z.programs=pe.programs,E.capabilities=P,E.extensions=Ke,E.properties=H,E.renderLists=_e,E.shadowMap=ze,E.state=y,E.info=z}Ie(),b!==Qt&&(A=new l_(b,t.width,t.height,a,r,s));let Ce=new Wc(E,L);this.xr=Ce,this.getContext=function(){return L},this.getContextAttributes=function(){return L.getContextAttributes()},this.forceContextLoss=function(){let w=Ke.get("WEBGL_lose_context");w&&w.loseContext()},this.forceContextRestore=function(){let w=Ke.get("WEBGL_lose_context");w&&w.restoreContext()},this.getPixelRatio=function(){return J},this.setPixelRatio=function(w){w!==void 0&&(J=w,this.setSize($,W,!1))},this.getSize=function(w){return w.set($,W)},this.setSize=function(w,V,Y=!0){if(Ce.isPresenting){Be("WebGLRenderer: Can't change size while VR device is presenting.");return}$=w,W=V,t.width=Math.floor(w*J),t.height=Math.floor(V*J),Y===!0&&(t.style.width=w+"px",t.style.height=V+"px"),A!==null&&A.setSize(t.width,t.height),this.setViewport(0,0,w,V)},this.getDrawingBufferSize=function(w){return w.set($*J,W*J).floor()},this.setDrawingBufferSize=function(w,V,Y){$=w,W=V,J=Y,t.width=Math.floor(w*Y),t.height=Math.floor(V*Y),this.setViewport(0,0,w,V)},this.setEffects=function(w){if(b===Qt){Ve("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(w){for(let V=0;V<w.length;V++)if(w[V].isOutputPass===!0){Be("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}A.setEffects(w||[])},this.getCurrentViewport=function(w){return w.copy(ne)},this.getViewport=function(w){return w.copy(we)},this.setViewport=function(w,V,Y,X){w.isVector4?we.set(w.x,w.y,w.z,w.w):we.set(w,V,Y,X),y.viewport(ne.copy(we).multiplyScalar(J).round())},this.getScissor=function(w){return w.copy(Re)},this.setScissor=function(w,V,Y,X){w.isVector4?Re.set(w.x,w.y,w.z,w.w):Re.set(w,V,Y,X),y.scissor(ae.copy(Re).multiplyScalar(J).round())},this.getScissorTest=function(){return ie},this.setScissorTest=function(w){y.setScissorTest(ie=w)},this.setOpaqueSort=function(w){fe=w},this.setTransparentSort=function(w){Se=w},this.getClearColor=function(w){return w.copy(Je.getClearColor())},this.setClearColor=function(){Je.setClearColor(...arguments)},this.getClearAlpha=function(){return Je.getClearAlpha()},this.setClearAlpha=function(){Je.setClearAlpha(...arguments)},this.clear=function(w=!0,V=!0,Y=!0){let X=0;if(w){let q=!1;if(G!==null){let ve=G.texture.format;q=g.has(ve)}if(q){let ve=G.texture.type,Ee=p.has(ve),ye=Je.getClearColor(),Pe=Je.getClearAlpha(),Fe=ye.r,je=ye.g,nt=ye.b;Ee?(M[0]=Fe,M[1]=je,M[2]=nt,M[3]=Pe,L.clearBufferuiv(L.COLOR,0,M)):(T[0]=Fe,T[1]=je,T[2]=nt,T[3]=Pe,L.clearBufferiv(L.COLOR,0,T))}else X|=L.COLOR_BUFFER_BIT}V&&(X|=L.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),Y&&(X|=L.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),X!==0&&L.clear(X)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(w){w.setRenderer(this),I=w},this.dispose=function(){t.removeEventListener("webglcontextlost",Mt,!1),t.removeEventListener("webglcontextrestored",mt,!1),t.removeEventListener("webglcontextcreationerror",Cn,!1),Je.dispose(),_e.dispose(),me.dispose(),H.dispose(),le.dispose(),ee.dispose(),be.dispose(),re.dispose(),pe.dispose(),Ce.dispose(),Ce.removeEventListener("sessionstart",Tu),Ce.removeEventListener("sessionend",Eu),Ci.stop()};function Mt(w){w.preventDefault(),Sc("WebGLRenderer: Context Lost."),R=!0}function mt(){Sc("WebGLRenderer: Context Restored."),R=!1;let w=z.autoReset,V=ze.enabled,Y=ze.autoUpdate,X=ze.needsUpdate,q=ze.type;Ie(),z.autoReset=w,ze.enabled=V,ze.autoUpdate=Y,ze.needsUpdate=X,ze.type=q}function Cn(w){Ve("WebGLRenderer: A WebGL context could not be created. Reason: ",w.statusMessage)}function Pn(w){let V=w.target;V.removeEventListener("dispose",Pn),Gf(V)}function Gf(w){Hf(w),H.remove(w)}function Hf(w){let V=H.get(w).programs;V!==void 0&&(V.forEach(function(Y){pe.releaseProgram(Y)}),w.isShaderMaterial&&pe.releaseShaderCache(w))}this.renderBufferDirect=function(w,V,Y,X,q,ve){V===null&&(V=He);let Ee=q.isMesh&&q.matrixWorld.determinantAffine()<0,ye=qf(w,V,Y,X,q);y.setMaterial(X,Ee);let Pe=Y.index,Fe=1;if(X.wireframe===!0){if(Pe=j.getWireframeAttribute(Y),Pe===void 0)return;Fe=2}let je=Y.drawRange,nt=Y.attributes.position,Ue=je.start*Fe,ut=(je.start+je.count)*Fe;ve!==null&&(Ue=Math.max(Ue,ve.start*Fe),ut=Math.min(ut,(ve.start+ve.count)*Fe)),Pe!==null?(Ue=Math.max(Ue,0),ut=Math.min(ut,Pe.count)):nt!=null&&(Ue=Math.max(Ue,0),ut=Math.min(ut,nt.count));let Et=ut-Ue;if(Et<0||Et===1/0)return;be.setup(q,X,ye,Y,Pe);let St,dt=de;if(Pe!==null&&(St=ce.get(Pe),dt=te,dt.setIndex(St)),q.isMesh)X.wireframe===!0?(y.setLineWidth(X.wireframeLinewidth*Ye()),dt.setMode(L.LINES)):dt.setMode(L.TRIANGLES);else if(q.isLine){let Vt=X.linewidth;Vt===void 0&&(Vt=1),y.setLineWidth(Vt*Ye()),q.isLineSegments?dt.setMode(L.LINES):q.isLineLoop?dt.setMode(L.LINE_LOOP):dt.setMode(L.LINE_STRIP)}else q.isPoints?dt.setMode(L.POINTS):q.isSprite&&dt.setMode(L.TRIANGLES);if(q.isBatchedMesh)if(Ke.get("WEBGL_multi_draw"))dt.renderMultiDraw(q._multiDrawStarts,q._multiDrawCounts,q._multiDrawCount);else{let Vt=q._multiDrawStarts,Te=q._multiDrawCounts,rn=q._multiDrawCount,st=Pe?ce.get(Pe).bytesPerElement:1,hn=H.get(X).currentProgram.getUniforms();for(let In=0;In<rn;In++)hn.setValue(L,"_gl_DrawID",In),dt.render(Vt[In]/st,Te[In])}else if(q.isInstancedMesh)dt.renderInstances(Ue,Et,q.count);else if(Y.isInstancedBufferGeometry){let Vt=Y._maxInstanceCount!==void 0?Y._maxInstanceCount:1/0,Te=Math.min(Y.instanceCount,Vt);dt.renderInstances(Ue,Et,Te)}else dt.render(Ue,Et)};function wu(w,V,Y){w.transparent===!0&&w.side===Ct&&w.forceSinglePass===!1?(w.side=Jt,w.needsUpdate=!0,Qs(w,V,Y),w.side=bn,w.needsUpdate=!0,Qs(w,V,Y),w.side=Ct):Qs(w,V,Y)}this.compile=function(w,V,Y=null){Y===null&&(Y=w),S=me.get(Y),S.init(V),x.push(S),Y.traverseVisible(function(q){q.isLight&&q.layers.test(V.layers)&&(S.pushLight(q),q.castShadow&&S.pushShadow(q))}),w!==Y&&w.traverseVisible(function(q){q.isLight&&q.layers.test(V.layers)&&(S.pushLight(q),q.castShadow&&S.pushShadow(q))}),S.setupLights();let X=new Set;return w.traverse(function(q){if(!(q.isMesh||q.isPoints||q.isLine||q.isSprite))return;let ve=q.material;if(ve)if(Array.isArray(ve))for(let Ee=0;Ee<ve.length;Ee++){let ye=ve[Ee];wu(ye,Y,q),X.add(ye)}else wu(ve,Y,q),X.add(ve)}),S=x.pop(),X},this.compileAsync=function(w,V,Y=null){let X=this.compile(w,V,Y);return new Promise(q=>{function ve(){if(X.forEach(function(Ee){H.get(Ee).currentProgram.isReady()&&X.delete(Ee)}),X.size===0){q(w);return}setTimeout(ve,10)}Ke.get("KHR_parallel_shader_compile")!==null?ve():setTimeout(ve,10)})};let bl=null;function Wf(w){bl&&bl(w)}function Tu(){Ci.stop()}function Eu(){Ci.start()}let Ci=new _d;Ci.setAnimationLoop(Wf),typeof self<"u"&&Ci.setContext(self),this.setAnimationLoop=function(w){bl=w,Ce.setAnimationLoop(w),w===null?Ci.stop():Ci.start()},Ce.addEventListener("sessionstart",Tu),Ce.addEventListener("sessionend",Eu),this.render=function(w,V){if(V!==void 0&&V.isCamera!==!0){Ve("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(R===!0)return;I!==null&&I.renderStart(w,V);let Y=Ce.enabled===!0&&Ce.isPresenting===!0,X=A!==null&&(G===null||Y)&&A.begin(E,G);if(w.matrixWorldAutoUpdate===!0&&w.updateMatrixWorld(),V.parent===null&&V.matrixWorldAutoUpdate===!0&&V.updateMatrixWorld(),Ce.enabled===!0&&Ce.isPresenting===!0&&(A===null||A.isCompositing()===!1)&&(Ce.cameraAutoUpdate===!0&&Ce.updateCamera(V),V=Ce.getCamera()),w.isScene===!0&&w.onBeforeRender(E,w,V,G),S=me.get(w,x.length),S.init(V),S.state.textureUnits=Z.getTextureUnits(),x.push(S),Xe.multiplyMatrices(V.projectionMatrix,V.matrixWorldInverse),ue.setFromProjectionMatrix(Xe,vn,V.reversedDepth),Me=this.localClippingEnabled,he=Oe.init(this.clippingPlanes,Me),C=_e.get(w,_.length),C.init(),_.push(C),Ce.enabled===!0&&Ce.isPresenting===!0){let Ee=E.xr.getDepthSensingMesh();Ee!==null&&Ml(Ee,V,-1/0,E.sortObjects)}Ml(w,V,0,E.sortObjects),C.finish(),E.sortObjects===!0&&C.sort(fe,Se,V.reversedDepth),ke=Ce.enabled===!1||Ce.isPresenting===!1||Ce.hasDepthSensing()===!1,ke&&Je.addToRenderList(C,w),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),he===!0&&Oe.beginShadows();let q=S.state.shadowsArray;if(ze.render(q,w,V),he===!0&&Oe.endShadows(),(X&&A.hasRenderPass())===!1){let Ee=C.opaque,ye=C.transmissive;if(S.setupLights(),V.isArrayCamera){let Pe=V.cameras;if(ye.length>0)for(let Fe=0,je=Pe.length;Fe<je;Fe++){let nt=Pe[Fe];Ru(Ee,ye,w,nt)}ke&&Je.render(w);for(let Fe=0,je=Pe.length;Fe<je;Fe++){let nt=Pe[Fe];Au(C,w,nt,nt.viewport)}}else ye.length>0&&Ru(Ee,ye,w,V),ke&&Je.render(w),Au(C,w,V)}G!==null&&D===0&&(Z.updateMultisampleRenderTarget(G),Z.updateRenderTargetMipmap(G)),X&&A.end(E),w.isScene===!0&&w.onAfterRender(E,w,V),be.resetDefaultState(),K=-1,Q=null,x.pop(),x.length>0?(S=x[x.length-1],Z.setTextureUnits(S.state.textureUnits),he===!0&&Oe.setGlobalState(E.clippingPlanes,S.state.camera)):S=null,_.pop(),_.length>0?C=_[_.length-1]:C=null,I!==null&&I.renderEnd()};function Ml(w,V,Y,X){if(w.visible===!1)return;if(w.layers.test(V.layers)){if(w.isGroup)Y=w.renderOrder;else if(w.isLOD)w.autoUpdate===!0&&w.update(V);else if(w.isLightProbeGrid)S.pushLightProbeGrid(w);else if(w.isLight)S.pushLight(w),w.castShadow&&S.pushShadow(w);else if(w.isSprite){if(!w.frustumCulled||ue.intersectsSprite(w)){X&&Qe.setFromMatrixPosition(w.matrixWorld).applyMatrix4(Xe);let Ee=ee.update(w),ye=w.material;ye.visible&&C.push(w,Ee,ye,Y,Qe.z,null)}}else if((w.isMesh||w.isLine||w.isPoints)&&(!w.frustumCulled||ue.intersectsObject(w))){let Ee=ee.update(w),ye=w.material;if(X&&(w.boundingSphere!==void 0?(w.boundingSphere===null&&w.computeBoundingSphere(),Qe.copy(w.boundingSphere.center)):(Ee.boundingSphere===null&&Ee.computeBoundingSphere(),Qe.copy(Ee.boundingSphere.center)),Qe.applyMatrix4(w.matrixWorld).applyMatrix4(Xe)),Array.isArray(ye)){let Pe=Ee.groups;for(let Fe=0,je=Pe.length;Fe<je;Fe++){let nt=Pe[Fe],Ue=ye[nt.materialIndex];Ue&&Ue.visible&&C.push(w,Ee,Ue,Y,Qe.z,nt)}}else ye.visible&&C.push(w,Ee,ye,Y,Qe.z,null)}}let ve=w.children;for(let Ee=0,ye=ve.length;Ee<ye;Ee++)Ml(ve[Ee],V,Y,X)}function Au(w,V,Y,X){let{opaque:q,transmissive:ve,transparent:Ee}=w;S.setupLightsView(Y),he===!0&&Oe.setGlobalState(E.clippingPlanes,Y),X&&y.viewport(ne.copy(X)),q.length>0&&js(q,V,Y),ve.length>0&&js(ve,V,Y),Ee.length>0&&js(Ee,V,Y),y.buffers.depth.setTest(!0),y.buffers.depth.setMask(!0),y.buffers.color.setMask(!0),y.setPolygonOffset(!1)}function Ru(w,V,Y,X){if((Y.isScene===!0?Y.overrideMaterial:null)!==null)return;if(S.state.transmissionRenderTarget[X.id]===void 0){let Ue=Ke.has("EXT_color_buffer_half_float")||Ke.has("EXT_color_buffer_float");S.state.transmissionRenderTarget[X.id]=new ln(1,1,{generateMipmaps:!0,type:Ue?Bn:Qt,minFilter:_i,samples:Math.max(4,P.samples),stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:rt.workingColorSpace})}let ve=S.state.transmissionRenderTarget[X.id],Ee=X.viewport||ne;ve.setSize(Ee.z*E.transmissionResolutionScale,Ee.w*E.transmissionResolutionScale);let ye=E.getRenderTarget(),Pe=E.getActiveCubeFace(),Fe=E.getActiveMipmapLevel();E.setRenderTarget(ve),E.getClearColor(Ge),Ae=E.getClearAlpha(),Ae<1&&E.setClearColor(16777215,.5),E.clear(),ke&&Je.render(Y);let je=E.toneMapping;E.toneMapping=wn;let nt=X.viewport;if(X.viewport!==void 0&&(X.viewport=void 0),S.setupLightsView(X),he===!0&&Oe.setGlobalState(E.clippingPlanes,X),js(w,Y,X),Z.updateMultisampleRenderTarget(ve),Z.updateRenderTargetMipmap(ve),Ke.has("WEBGL_multisampled_render_to_texture")===!1){let Ue=!1;for(let ut=0,Et=V.length;ut<Et;ut++){let St=V[ut],{object:dt,geometry:Vt,material:Te,group:rn}=St;if(Te.side===Ct&&dt.layers.test(X.layers)){let st=Te.side;Te.side=Jt,Te.needsUpdate=!0,Cu(dt,Y,X,Vt,Te,rn),Te.side=st,Te.needsUpdate=!0,Ue=!0}}Ue===!0&&(Z.updateMultisampleRenderTarget(ve),Z.updateRenderTargetMipmap(ve))}E.setRenderTarget(ye,Pe,Fe),E.setClearColor(Ge,Ae),nt!==void 0&&(X.viewport=nt),E.toneMapping=je}function js(w,V,Y){let X=V.isScene===!0?V.overrideMaterial:null;for(let q=0,ve=w.length;q<ve;q++){let Ee=w[q],{object:ye,geometry:Pe,group:Fe}=Ee,je=Ee.material;je.allowOverride===!0&&X!==null&&(je=X),ye.layers.test(Y.layers)&&Cu(ye,V,Y,Pe,je,Fe)}}function Cu(w,V,Y,X,q,ve){w.onBeforeRender(E,V,Y,X,q,ve),w.modelViewMatrix.multiplyMatrices(Y.matrixWorldInverse,w.matrixWorld),w.normalMatrix.getNormalMatrix(w.modelViewMatrix),q.onBeforeRender(E,V,Y,X,w,ve),q.transparent===!0&&q.side===Ct&&q.forceSinglePass===!1?(q.side=Jt,q.needsUpdate=!0,E.renderBufferDirect(Y,V,X,q,w,ve),q.side=bn,q.needsUpdate=!0,E.renderBufferDirect(Y,V,X,q,w,ve),q.side=Ct):E.renderBufferDirect(Y,V,X,q,w,ve),w.onAfterRender(E,V,Y,X,q,ve)}function Qs(w,V,Y){V.isScene!==!0&&(V=He);let X=H.get(w),q=S.state.lights,ve=S.state.shadowsArray,Ee=q.state.version,ye=pe.getParameters(w,q.state,ve,V,Y,S.state.lightProbeGridArray),Pe=pe.getProgramCacheKey(ye),Fe=X.programs;X.environment=w.isMeshStandardMaterial||w.isMeshLambertMaterial||w.isMeshPhongMaterial?V.environment:null,X.fog=V.fog;let je=w.isMeshStandardMaterial||w.isMeshLambertMaterial&&!w.envMap||w.isMeshPhongMaterial&&!w.envMap;X.envMap=le.get(w.envMap||X.environment,je),X.envMapRotation=X.environment!==null&&w.envMap===null?V.environmentRotation:w.envMapRotation,Fe===void 0&&(w.addEventListener("dispose",Pn),Fe=new Map,X.programs=Fe);let nt=Fe.get(Pe);if(nt!==void 0){if(X.currentProgram===nt&&X.lightsStateVersion===Ee)return Iu(w,ye),nt}else ye.uniforms=pe.getUniforms(w),I!==null&&w.isNodeMaterial&&I.build(w,Y,ye),w.onBeforeCompile(ye,E),nt=pe.acquireProgram(ye,Pe),Fe.set(Pe,nt),X.uniforms=ye.uniforms;let Ue=X.uniforms;return(!w.isShaderMaterial&&!w.isRawShaderMaterial||w.clipping===!0)&&(Ue.clippingPlanes=Oe.uniform),Iu(w,ye),X.needsLights=$f(w),X.lightsStateVersion=Ee,X.needsLights&&(Ue.ambientLightColor.value=q.state.ambient,Ue.lightProbe.value=q.state.probe,Ue.directionalLights.value=q.state.directional,Ue.directionalLightShadows.value=q.state.directionalShadow,Ue.spotLights.value=q.state.spot,Ue.spotLightShadows.value=q.state.spotShadow,Ue.rectAreaLights.value=q.state.rectArea,Ue.ltc_1.value=q.state.rectAreaLTC1,Ue.ltc_2.value=q.state.rectAreaLTC2,Ue.pointLights.value=q.state.point,Ue.pointLightShadows.value=q.state.pointShadow,Ue.hemisphereLights.value=q.state.hemi,Ue.directionalShadowMatrix.value=q.state.directionalShadowMatrix,Ue.spotLightMatrix.value=q.state.spotLightMatrix,Ue.spotLightMap.value=q.state.spotLightMap,Ue.pointShadowMatrix.value=q.state.pointShadowMatrix),X.lightProbeGrid=S.state.lightProbeGridArray.length>0,X.currentProgram=nt,X.uniformsList=null,nt}function Pu(w){if(w.uniformsList===null){let V=w.currentProgram.getUniforms();w.uniformsList=Pr.seqWithValue(V.seq,w.uniforms)}return w.uniformsList}function Iu(w,V){let Y=H.get(w);Y.outputColorSpace=V.outputColorSpace,Y.batching=V.batching,Y.batchingColor=V.batchingColor,Y.instancing=V.instancing,Y.instancingColor=V.instancingColor,Y.instancingMorph=V.instancingMorph,Y.skinning=V.skinning,Y.morphTargets=V.morphTargets,Y.morphNormals=V.morphNormals,Y.morphColors=V.morphColors,Y.morphTargetsCount=V.morphTargetsCount,Y.numClippingPlanes=V.numClippingPlanes,Y.numIntersection=V.numClipIntersection,Y.vertexAlphas=V.vertexAlphas,Y.vertexTangents=V.vertexTangents,Y.toneMapping=V.toneMapping}function Xf(w,V){if(w.length===0)return null;if(w.length===1)return w[0].texture!==null?w[0]:null;v.setFromMatrixPosition(V.matrixWorld);for(let Y=0,X=w.length;Y<X;Y++){let q=w[Y];if(q.texture!==null&&q.boundingBox.containsPoint(v))return q}return null}function qf(w,V,Y,X,q){V.isScene!==!0&&(V=He),Z.resetTextureUnits();let ve=V.fog,Ee=X.isMeshStandardMaterial||X.isMeshLambertMaterial||X.isMeshPhongMaterial?V.environment:null,ye=G===null?E.outputColorSpace:G.isXRRenderTarget===!0?G.texture.colorSpace:rt.workingColorSpace,Pe=X.isMeshStandardMaterial||X.isMeshLambertMaterial&&!X.envMap||X.isMeshPhongMaterial&&!X.envMap,Fe=le.get(X.envMap||Ee,Pe),je=X.vertexColors===!0&&!!Y.attributes.color&&Y.attributes.color.itemSize===4,nt=!!Y.attributes.tangent&&(!!X.normalMap||X.anisotropy>0),Ue=!!Y.morphAttributes.position,ut=!!Y.morphAttributes.normal,Et=!!Y.morphAttributes.color,St=wn;X.toneMapped&&(G===null||G.isXRRenderTarget===!0)&&(St=E.toneMapping);let dt=Y.morphAttributes.position||Y.morphAttributes.normal||Y.morphAttributes.color,Vt=dt!==void 0?dt.length:0,Te=H.get(X),rn=S.state.lights;if(he===!0&&(Me===!0||w!==Q)){let gt=w===Q&&X.id===K;Oe.setState(X,w,gt)}let st=!1;X.version===Te.__version?(Te.needsLights&&Te.lightsStateVersion!==rn.state.version||Te.outputColorSpace!==ye||q.isBatchedMesh&&Te.batching===!1||!q.isBatchedMesh&&Te.batching===!0||q.isBatchedMesh&&Te.batchingColor===!0&&q.colorTexture===null||q.isBatchedMesh&&Te.batchingColor===!1&&q.colorTexture!==null||q.isInstancedMesh&&Te.instancing===!1||!q.isInstancedMesh&&Te.instancing===!0||q.isSkinnedMesh&&Te.skinning===!1||!q.isSkinnedMesh&&Te.skinning===!0||q.isInstancedMesh&&Te.instancingColor===!0&&q.instanceColor===null||q.isInstancedMesh&&Te.instancingColor===!1&&q.instanceColor!==null||q.isInstancedMesh&&Te.instancingMorph===!0&&q.morphTexture===null||q.isInstancedMesh&&Te.instancingMorph===!1&&q.morphTexture!==null||Te.envMap!==Fe||X.fog===!0&&Te.fog!==ve||Te.numClippingPlanes!==void 0&&(Te.numClippingPlanes!==Oe.numPlanes||Te.numIntersection!==Oe.numIntersection)||Te.vertexAlphas!==je||Te.vertexTangents!==nt||Te.morphTargets!==Ue||Te.morphNormals!==ut||Te.morphColors!==Et||Te.toneMapping!==St||Te.morphTargetsCount!==Vt||!!Te.lightProbeGrid!=S.state.lightProbeGridArray.length>0)&&(st=!0):(st=!0,Te.__version=X.version);let hn=Te.currentProgram;st===!0&&(hn=Qs(X,V,q),I&&X.isNodeMaterial&&I.onUpdateProgram(X,hn,Te));let In=!1,Qn=!1,Ki=!1,ft=hn.getUniforms(),At=Te.uniforms;if(y.useProgram(hn.program)&&(In=!0,Qn=!0,Ki=!0),X.id!==K&&(K=X.id,Qn=!0),Te.needsLights){let gt=Xf(S.state.lightProbeGridArray,q);Te.lightProbeGrid!==gt&&(Te.lightProbeGrid=gt,Qn=!0)}if(In||Q!==w){y.buffers.depth.getReversed()&&w.reversedDepth!==!0&&(w._reversedDepth=!0,w.updateProjectionMatrix()),ft.setValue(L,"projectionMatrix",w.projectionMatrix),ft.setValue(L,"viewMatrix",w.matrixWorldInverse);let ti=ft.map.cameraPosition;ti!==void 0&&ti.setValue(L,et.setFromMatrixPosition(w.matrixWorld)),P.logarithmicDepthBuffer&&ft.setValue(L,"logDepthBufFC",2/(Math.log(w.far+1)/Math.LN2)),(X.isMeshPhongMaterial||X.isMeshToonMaterial||X.isMeshLambertMaterial||X.isMeshBasicMaterial||X.isMeshStandardMaterial||X.isShaderMaterial)&&ft.setValue(L,"isOrthographic",w.isOrthographicCamera===!0),Q!==w&&(Q=w,Qn=!0,Ki=!0)}if(Te.needsLights&&(rn.state.directionalShadowMap.length>0&&ft.setValue(L,"directionalShadowMap",rn.state.directionalShadowMap,Z),rn.state.spotShadowMap.length>0&&ft.setValue(L,"spotShadowMap",rn.state.spotShadowMap,Z),rn.state.pointShadowMap.length>0&&ft.setValue(L,"pointShadowMap",rn.state.pointShadowMap,Z)),q.isSkinnedMesh){ft.setOptional(L,q,"bindMatrix"),ft.setOptional(L,q,"bindMatrixInverse");let gt=q.skeleton;gt&&(gt.boneTexture===null&&gt.computeBoneTexture(),ft.setValue(L,"boneTexture",gt.boneTexture,Z))}q.isBatchedMesh&&(ft.setOptional(L,q,"batchingTexture"),ft.setValue(L,"batchingTexture",q._matricesTexture,Z),ft.setOptional(L,q,"batchingIdTexture"),ft.setValue(L,"batchingIdTexture",q._indirectTexture,Z),ft.setOptional(L,q,"batchingColorTexture"),q._colorsTexture!==null&&ft.setValue(L,"batchingColorTexture",q._colorsTexture,Z));let ei=Y.morphAttributes;if((ei.position!==void 0||ei.normal!==void 0||ei.color!==void 0)&&B.update(q,Y,hn),(Qn||Te.receiveShadow!==q.receiveShadow)&&(Te.receiveShadow=q.receiveShadow,ft.setValue(L,"receiveShadow",q.receiveShadow)),(X.isMeshStandardMaterial||X.isMeshLambertMaterial||X.isMeshPhongMaterial)&&X.envMap===null&&V.environment!==null&&(At.envMapIntensity.value=V.environmentIntensity),At.dfgLUT!==void 0&&(At.dfgLUT.value=$x()),Qn){if(ft.setValue(L,"toneMappingExposure",E.toneMappingExposure),Te.needsLights&&Yf(At,Ki),ve&&X.fog===!0&&Le.refreshFogUniforms(At,ve),Le.refreshMaterialUniforms(At,X,J,W,S.state.transmissionRenderTarget[w.id]),Te.needsLights&&Te.lightProbeGrid){let gt=Te.lightProbeGrid;At.probesSH.value=gt.texture,At.probesMin.value.copy(gt.boundingBox.min),At.probesMax.value.copy(gt.boundingBox.max),At.probesResolution.value.copy(gt.resolution)}Pr.upload(L,Pu(Te),At,Z)}if(X.isShaderMaterial&&X.uniformsNeedUpdate===!0&&(Pr.upload(L,Pu(Te),At,Z),X.uniformsNeedUpdate=!1),X.isSpriteMaterial&&ft.setValue(L,"center",q.center),ft.setValue(L,"modelViewMatrix",q.modelViewMatrix),ft.setValue(L,"normalMatrix",q.normalMatrix),ft.setValue(L,"modelMatrix",q.matrixWorld),X.uniformsGroups!==void 0){let gt=X.uniformsGroups;for(let ti=0,Ji=gt.length;ti<Ji;ti++){let Du=gt[ti];re.update(Du,hn),re.bind(Du,hn)}}return hn}function Yf(w,V){w.ambientLightColor.needsUpdate=V,w.lightProbe.needsUpdate=V,w.directionalLights.needsUpdate=V,w.directionalLightShadows.needsUpdate=V,w.pointLights.needsUpdate=V,w.pointLightShadows.needsUpdate=V,w.spotLights.needsUpdate=V,w.spotLightShadows.needsUpdate=V,w.rectAreaLights.needsUpdate=V,w.hemisphereLights.needsUpdate=V}function $f(w){return w.isMeshLambertMaterial||w.isMeshToonMaterial||w.isMeshPhongMaterial||w.isMeshStandardMaterial||w.isShadowMaterial||w.isShaderMaterial&&w.lights===!0}this.getActiveCubeFace=function(){return O},this.getActiveMipmapLevel=function(){return D},this.getRenderTarget=function(){return G},this.setRenderTargetTextures=function(w,V,Y){let X=H.get(w);X.__autoAllocateDepthBuffer=w.resolveDepthBuffer===!1,X.__autoAllocateDepthBuffer===!1&&(X.__useRenderToTexture=!1),H.get(w.texture).__webglTexture=V,H.get(w.depthTexture).__webglTexture=X.__autoAllocateDepthBuffer?void 0:Y,X.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(w,V){let Y=H.get(w);Y.__webglFramebuffer=V,Y.__useDefaultFramebuffer=V===void 0},this.setRenderTarget=function(w,V=0,Y=0){G=w,O=V,D=Y;let X=null,q=!1,ve=!1;if(w){let ye=H.get(w);if(ye.__useDefaultFramebuffer!==void 0){y.bindFramebuffer(L.FRAMEBUFFER,ye.__webglFramebuffer),ne.copy(w.viewport),ae.copy(w.scissor),Ne=w.scissorTest,y.viewport(ne),y.scissor(ae),y.setScissorTest(Ne),K=-1;return}else if(ye.__webglFramebuffer===void 0)Z.setupRenderTarget(w);else if(ye.__hasExternalTextures)Z.rebindTextures(w,H.get(w.texture).__webglTexture,H.get(w.depthTexture).__webglTexture);else if(w.depthBuffer){let je=w.depthTexture;if(ye.__boundDepthTexture!==je){if(je!==null&&H.has(je)&&(w.width!==je.image.width||w.height!==je.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");Z.setupDepthRenderbuffer(w)}}let Pe=w.texture;(Pe.isData3DTexture||Pe.isDataArrayTexture||Pe.isCompressedArrayTexture)&&(ve=!0);let Fe=H.get(w).__webglFramebuffer;w.isWebGLCubeRenderTarget?(Array.isArray(Fe[V])?X=Fe[V][Y]:X=Fe[V],q=!0):w.samples>0&&Z.useMultisampledRTT(w)===!1?X=H.get(w).__webglMultisampledFramebuffer:Array.isArray(Fe)?X=Fe[Y]:X=Fe,ne.copy(w.viewport),ae.copy(w.scissor),Ne=w.scissorTest}else ne.copy(we).multiplyScalar(J).floor(),ae.copy(Re).multiplyScalar(J).floor(),Ne=ie;if(Y!==0&&(X=N),y.bindFramebuffer(L.FRAMEBUFFER,X)&&y.drawBuffers(w,X),y.viewport(ne),y.scissor(ae),y.setScissorTest(Ne),q){let ye=H.get(w.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_CUBE_MAP_POSITIVE_X+V,ye.__webglTexture,Y)}else if(ve){let ye=V;for(let Pe=0;Pe<w.textures.length;Pe++){let Fe=H.get(w.textures[Pe]);L.framebufferTextureLayer(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0+Pe,Fe.__webglTexture,Y,ye)}}else if(w!==null&&Y!==0){let ye=H.get(w.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,ye.__webglTexture,Y)}K=-1},this.readRenderTargetPixels=function(w,V,Y,X,q,ve,Ee,ye=0){if(!(w&&w.isWebGLRenderTarget)){Ve("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Pe=H.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&Ee!==void 0&&(Pe=Pe[Ee]),Pe){y.bindFramebuffer(L.FRAMEBUFFER,Pe);try{let Fe=w.textures[ye],je=Fe.format,nt=Fe.type;if(w.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+ye),!P.textureFormatReadable(je)){Ve("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!P.textureTypeReadable(nt)){Ve("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}V>=0&&V<=w.width-X&&Y>=0&&Y<=w.height-q&&L.readPixels(V,Y,X,q,ge.convert(je),ge.convert(nt),ve)}finally{let Fe=G!==null?H.get(G).__webglFramebuffer:null;y.bindFramebuffer(L.FRAMEBUFFER,Fe)}}},this.readRenderTargetPixelsAsync=async function(w,V,Y,X,q,ve,Ee,ye=0){if(!(w&&w.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Pe=H.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&Ee!==void 0&&(Pe=Pe[Ee]),Pe)if(V>=0&&V<=w.width-X&&Y>=0&&Y<=w.height-q){y.bindFramebuffer(L.FRAMEBUFFER,Pe);let Fe=w.textures[ye],je=Fe.format,nt=Fe.type;if(w.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+ye),!P.textureFormatReadable(je))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!P.textureTypeReadable(nt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Ue=L.createBuffer();L.bindBuffer(L.PIXEL_PACK_BUFFER,Ue),L.bufferData(L.PIXEL_PACK_BUFFER,ve.byteLength,L.STREAM_READ),L.readPixels(V,Y,X,q,ge.convert(je),ge.convert(nt),0);let ut=G!==null?H.get(G).__webglFramebuffer:null;y.bindFramebuffer(L.FRAMEBUFFER,ut);let Et=L.fenceSync(L.SYNC_GPU_COMMANDS_COMPLETE,0);return L.flush(),await zh(L,Et,4),L.bindBuffer(L.PIXEL_PACK_BUFFER,Ue),L.getBufferSubData(L.PIXEL_PACK_BUFFER,0,ve),L.deleteBuffer(Ue),L.deleteSync(Et),ve}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(w,V=null,Y=0){let X=Math.pow(2,-Y),q=Math.floor(w.image.width*X),ve=Math.floor(w.image.height*X),Ee=V!==null?V.x:0,ye=V!==null?V.y:0;Z.setTexture2D(w,0),L.copyTexSubImage2D(L.TEXTURE_2D,Y,0,0,Ee,ye,q,ve),y.unbindTexture()},this.copyTextureToTexture=function(w,V,Y=null,X=null,q=0,ve=0){let Ee,ye,Pe,Fe,je,nt,Ue,ut,Et,St=w.isCompressedTexture?w.mipmaps[ve]:w.image;if(Y!==null)Ee=Y.max.x-Y.min.x,ye=Y.max.y-Y.min.y,Pe=Y.isBox3?Y.max.z-Y.min.z:1,Fe=Y.min.x,je=Y.min.y,nt=Y.isBox3?Y.min.z:0;else{let At=Math.pow(2,-q);Ee=Math.floor(St.width*At),ye=Math.floor(St.height*At),w.isDataArrayTexture?Pe=St.depth:w.isData3DTexture?Pe=Math.floor(St.depth*At):Pe=1,Fe=0,je=0,nt=0}X!==null?(Ue=X.x,ut=X.y,Et=X.z):(Ue=0,ut=0,Et=0);let dt=ge.convert(V.format),Vt=ge.convert(V.type),Te;V.isData3DTexture?(Z.setTexture3D(V,0),Te=L.TEXTURE_3D):V.isDataArrayTexture||V.isCompressedArrayTexture?(Z.setTexture2DArray(V,0),Te=L.TEXTURE_2D_ARRAY):(Z.setTexture2D(V,0),Te=L.TEXTURE_2D),y.activeTexture(L.TEXTURE0),y.pixelStorei(L.UNPACK_FLIP_Y_WEBGL,V.flipY),y.pixelStorei(L.UNPACK_PREMULTIPLY_ALPHA_WEBGL,V.premultiplyAlpha),y.pixelStorei(L.UNPACK_ALIGNMENT,V.unpackAlignment);let rn=y.getParameter(L.UNPACK_ROW_LENGTH),st=y.getParameter(L.UNPACK_IMAGE_HEIGHT),hn=y.getParameter(L.UNPACK_SKIP_PIXELS),In=y.getParameter(L.UNPACK_SKIP_ROWS),Qn=y.getParameter(L.UNPACK_SKIP_IMAGES);y.pixelStorei(L.UNPACK_ROW_LENGTH,St.width),y.pixelStorei(L.UNPACK_IMAGE_HEIGHT,St.height),y.pixelStorei(L.UNPACK_SKIP_PIXELS,Fe),y.pixelStorei(L.UNPACK_SKIP_ROWS,je),y.pixelStorei(L.UNPACK_SKIP_IMAGES,nt);let Ki=w.isDataArrayTexture||w.isData3DTexture,ft=V.isDataArrayTexture||V.isData3DTexture;if(w.isDepthTexture){let At=H.get(w),ei=H.get(V),gt=H.get(At.__renderTarget),ti=H.get(ei.__renderTarget);y.bindFramebuffer(L.READ_FRAMEBUFFER,gt.__webglFramebuffer),y.bindFramebuffer(L.DRAW_FRAMEBUFFER,ti.__webglFramebuffer);for(let Ji=0;Ji<Pe;Ji++)Ki&&(L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,H.get(w).__webglTexture,q,nt+Ji),L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,H.get(V).__webglTexture,ve,Et+Ji)),L.blitFramebuffer(Fe,je,Ee,ye,Ue,ut,Ee,ye,L.DEPTH_BUFFER_BIT,L.NEAREST);y.bindFramebuffer(L.READ_FRAMEBUFFER,null),y.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else if(q!==0||w.isRenderTargetTexture||H.has(w)){let At=H.get(w),ei=H.get(V);y.bindFramebuffer(L.READ_FRAMEBUFFER,U),y.bindFramebuffer(L.DRAW_FRAMEBUFFER,F);for(let gt=0;gt<Pe;gt++)Ki?L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,At.__webglTexture,q,nt+gt):L.framebufferTexture2D(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,At.__webglTexture,q),ft?L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,ei.__webglTexture,ve,Et+gt):L.framebufferTexture2D(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,ei.__webglTexture,ve),q!==0?L.blitFramebuffer(Fe,je,Ee,ye,Ue,ut,Ee,ye,L.COLOR_BUFFER_BIT,L.NEAREST):ft?L.copyTexSubImage3D(Te,ve,Ue,ut,Et+gt,Fe,je,Ee,ye):L.copyTexSubImage2D(Te,ve,Ue,ut,Fe,je,Ee,ye);y.bindFramebuffer(L.READ_FRAMEBUFFER,null),y.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else ft?w.isDataTexture||w.isData3DTexture?L.texSubImage3D(Te,ve,Ue,ut,Et,Ee,ye,Pe,dt,Vt,St.data):V.isCompressedArrayTexture?L.compressedTexSubImage3D(Te,ve,Ue,ut,Et,Ee,ye,Pe,dt,St.data):L.texSubImage3D(Te,ve,Ue,ut,Et,Ee,ye,Pe,dt,Vt,St):w.isDataTexture?L.texSubImage2D(L.TEXTURE_2D,ve,Ue,ut,Ee,ye,dt,Vt,St.data):w.isCompressedTexture?L.compressedTexSubImage2D(L.TEXTURE_2D,ve,Ue,ut,St.width,St.height,dt,St.data):L.texSubImage2D(L.TEXTURE_2D,ve,Ue,ut,Ee,ye,dt,Vt,St);y.pixelStorei(L.UNPACK_ROW_LENGTH,rn),y.pixelStorei(L.UNPACK_IMAGE_HEIGHT,st),y.pixelStorei(L.UNPACK_SKIP_PIXELS,hn),y.pixelStorei(L.UNPACK_SKIP_ROWS,In),y.pixelStorei(L.UNPACK_SKIP_IMAGES,Qn),ve===0&&V.generateMipmaps&&L.generateMipmap(Te),y.unbindTexture()},this.initRenderTarget=function(w){H.get(w).__webglFramebuffer===void 0&&Z.setupRenderTarget(w)},this.initTexture=function(w){w.isCubeTexture?Z.setTextureCube(w,0):w.isData3DTexture?Z.setTexture3D(w,0):w.isDataArrayTexture||w.isCompressedArrayTexture?Z.setTexture2DArray(w,0):Z.setTexture2D(w,0),y.unbindTexture()},this.resetState=function(){O=0,D=0,G=null,y.reset(),be.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return vn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=rt._getDrawingBufferColorSpace(e),t.unpackColorSpace=rt._getUnpackColorSpace()}};var wd={type:"change"},Yc={type:"start"},Ed={type:"end"},el=new Bi,Td=new zt,Zx=Math.cos(70*Tc.DEG2RAD),Nt=new k,en=2*Math.PI,ht={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},qc=1e-6,tl=class extends Ts{constructor(e,t=null){super(e,t),this.state=ht.NONE,this.target=new k,this.cursor=new k,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:pi.ROTATE,MIDDLE:pi.DOLLY,RIGHT:pi.PAN},this.touches={ONE:mi.ROTATE,TWO:mi.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new k,this._lastQuaternion=new an,this._lastTargetPosition=new k,this._quat=new an().setFromUnitVectors(e.up,new k(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new wr,this._sphericalDelta=new wr,this._scale=1,this._panOffset=new k,this._rotateStart=new De,this._rotateEnd=new De,this._rotateDelta=new De,this._panStart=new De,this._panEnd=new De,this._panDelta=new De,this._dollyStart=new De,this._dollyEnd=new De,this._dollyDelta=new De,this._dollyDirection=new k,this._mouse=new De,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=Jx.bind(this),this._onPointerDown=Kx.bind(this),this._onPointerUp=jx.bind(this),this._onContextMenu=sy.bind(this),this._onMouseWheel=ty.bind(this),this._onKeyDown=ny.bind(this),this._onTouchStart=iy.bind(this),this._onTouchMove=ry.bind(this),this._onMouseDown=Qx.bind(this),this._onMouseMove=ey.bind(this),this._interceptControlDown=oy.bind(this),this._interceptControlUp=ay.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e==="grab"?this.domElement.style.cursor="grab":this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction=""}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(wd),this.update(),this.state=ht.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;Nt.copy(t).sub(this.target),Nt.applyQuaternion(this._quat),this._spherical.setFromVector3(Nt),this.autoRotate&&this.state===ht.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let i=this.minAzimuthAngle,r=this.maxAzimuthAngle;isFinite(i)&&isFinite(r)&&(i<-Math.PI?i+=en:i>Math.PI&&(i-=en),r<-Math.PI?r+=en:r>Math.PI&&(r-=en),i<=r?this._spherical.theta=Math.max(i,Math.min(r,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(i+r)/2?Math.max(i,this._spherical.theta):Math.min(r,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let s=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let o=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),s=o!=this._spherical.radius}if(Nt.setFromSpherical(this._spherical),Nt.applyQuaternion(this._quatInverse),t.copy(this.target).add(Nt),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let o=null;if(this.object.isPerspectiveCamera){let a=Nt.length();o=this._clampDistance(a*this._scale);let l=a-o;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),s=!!l}else if(this.object.isOrthographicCamera){let a=new k(this._mouse.x,this._mouse.y,0);a.unproject(this.object);let l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),s=l!==this.object.zoom;let c=new k(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(a),this.object.updateMatrixWorld(),o=Nt.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;o!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(o).add(this.object.position):(el.origin.copy(this.object.position),el.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(el.direction))<Zx?this.object.lookAt(this.target):(Td.setFromNormalAndCoplanarPoint(this.object.up,this.target),el.intersectPlane(Td,this.target))))}else if(this.object.isOrthographicCamera){let o=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),o!==this.object.zoom&&(this.object.updateProjectionMatrix(),s=!0)}return this._scale=1,this._performCursorZoom=!1,s||this._lastPosition.distanceToSquared(this.object.position)>qc||8*(1-this._lastQuaternion.dot(this.object.quaternion))>qc||this._lastTargetPosition.distanceToSquared(this.target)>qc?(this.dispatchEvent(wd),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?en/60*this.autoRotateSpeed*e:en/60/60*this.autoRotateSpeed}_getZoomScale(e){let t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Nt.setFromMatrixColumn(t,0),Nt.multiplyScalar(-e),this._panOffset.add(Nt)}_panUp(e,t){this.screenSpacePanning===!0?Nt.setFromMatrixColumn(t,1):(Nt.setFromMatrixColumn(t,0),Nt.crossVectors(this.object.up,Nt)),Nt.multiplyScalar(e),this._panOffset.add(Nt)}_pan(e,t){let i=this.domElement;if(this.object.isPerspectiveCamera){let r=this.object.position;Nt.copy(r).sub(this.target);let s=Nt.length();s*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*s/i.clientHeight,this.object.matrix),this._panUp(2*t*s/i.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/i.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/i.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let i=this.domElement.getBoundingClientRect(),r=e-i.left,s=t-i.top,o=i.width,a=i.height;this._mouse.x=r/o*2-1,this._mouse.y=-(s/a)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(en*this._rotateDelta.x/t.clientHeight),this._rotateUp(en*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(en*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-en*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(en*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-en*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._rotateStart.set(i,r)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panStart.set(i,r)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),i=e.pageX-t.x,r=e.pageY-t.y,s=Math.sqrt(i*i+r*r);this._dollyStart.set(0,s)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let i=this._getSecondPointerPosition(e),r=.5*(e.pageX+i.x),s=.5*(e.pageY+i.y);this._rotateEnd.set(r,s)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(en*this._rotateDelta.x/t.clientHeight),this._rotateUp(en*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panEnd.set(i,r)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),i=e.pageX-t.x,r=e.pageY-t.y,s=Math.sqrt(i*i+r*r);this._dollyEnd.set(0,s),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let o=(e.pageX+t.x)*.5,a=(e.pageY+t.y)*.5;this._updateZoomParameters(o,a)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new De,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,i={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:i.deltaY*=16;break;case 2:i.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(i.deltaY*=10),i}};function Kx(n){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(n.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(n)&&(this._addPointer(n),n.pointerType==="touch"?this._onTouchStart(n):this._onMouseDown(n),this._cursorStyle==="grab"&&(this.domElement.style.cursor="grabbing")))}function Jx(n){this.enabled!==!1&&(n.pointerType==="touch"?this._onTouchMove(n):this._onMouseMove(n))}function jx(n){switch(this._removePointer(n),this._pointers.length){case 0:this.domElement.releasePointerCapture(n.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(Ed),this.state=ht.NONE,this._cursorStyle==="grab"&&(this.domElement.style.cursor="grab");break;case 1:let e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function Qx(n){let e;switch(n.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case pi.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(n),this.state=ht.DOLLY;break;case pi.ROTATE:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=ht.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=ht.ROTATE}break;case pi.PAN:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=ht.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=ht.PAN}break;default:this.state=ht.NONE}this.state!==ht.NONE&&this.dispatchEvent(Yc)}function ey(n){switch(this.state){case ht.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(n);break;case ht.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(n);break;case ht.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(n);break}}function ty(n){this.enabled===!1||this.enableZoom===!1||this.state!==ht.NONE||(n.preventDefault(),this.dispatchEvent(Yc),this._handleMouseWheel(this._customWheelEvent(n)),this.dispatchEvent(Ed))}function ny(n){this.enabled!==!1&&this._handleKeyDown(n)}function iy(n){switch(this._trackPointer(n),this._pointers.length){case 1:switch(this.touches.ONE){case mi.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(n),this.state=ht.TOUCH_ROTATE;break;case mi.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(n),this.state=ht.TOUCH_PAN;break;default:this.state=ht.NONE}break;case 2:switch(this.touches.TWO){case mi.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(n),this.state=ht.TOUCH_DOLLY_PAN;break;case mi.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(n),this.state=ht.TOUCH_DOLLY_ROTATE;break;default:this.state=ht.NONE}break;default:this.state=ht.NONE}this.state!==ht.NONE&&this.dispatchEvent(Yc)}function ry(n){switch(this._trackPointer(n),this.state){case ht.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(n),this.update();break;case ht.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(n),this.update();break;case ht.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(n),this.update();break;case ht.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(n),this.update();break;default:this.state=ht.NONE}}function sy(n){this.enabled!==!1&&n.preventDefault()}function oy(n){n.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function ay(n){n.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}var ly=n=>Math.max(-85.0511,Math.min(85.0511,n));function nl(n,e,t){let i=2**t,r=ly(e)*Math.PI/180,s=Math.floor((n+180)/360*i),o=Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*i);return{z:t,x:Math.min(i-1,Math.max(0,s)),y:Math.min(i-1,Math.max(0,o))}}var bi=({z:n,x:e,y:t})=>`${n}/${e}/${t}`;function Dr(n,e,t=0){let i=nl(n.west,n.north,e),r=nl(n.east,n.south,e),s=2**e,o=[];for(let a=i.x-t;a<=r.x+t;a++)for(let l=i.y-t;l<=r.y+t;l++)a<0||l<0||a>=s||l>=s||o.push({z:e,x:a,y:l});return o}var Zc=14,cy=1,uy=24,hy=n=>[(n.west+n.east)/2,(n.south+n.north)/2];function $c(n,e){return(n.x-e.x)**2+(n.y-e.y)**2}function Kc(n,e,t={}){let i=t.zoom??Zc,r=t.margin??cy,s=t.budget??uy,o=Dr(n,i,r),a=o.map(bi),l=new Set(a),c=new Set(e),[u,f]=hy(n),h=Dr({west:u,south:f,east:u,north:f},i)[0],d=o.filter(p=>!c.has(bi(p))).sort((p,M)=>$c(p,h)-$c(M,h)),m=[...c].filter(p=>!l.has(p)).map(p=>{let[,M,T]=p.split("/").map(Number);return{key:p,distance:$c({z:i,x:M,y:T},h)}}).sort((p,M)=>M.distance-p.distance),b=c.size+d.length-s,g=b>0?m.slice(0,Math.min(b,m.length)).map(p=>p.key):[];return{load:d,evict:g,wanted:a}}function il(n){if(n.length===0)return[0,0];let[e,t]=n[0],i=0,r=0,s=0;for(let o=0,a=n.length-1;o<n.length;a=o++){let l=n[o][0]-e,c=n[o][1]-t,u=n[a][0]-e,f=n[a][1]-t,h=u*c-l*f;i+=h,r+=(u+l)*h,s+=(f+c)*h}return Math.abs(i)<1e-18?[n.reduce((o,a)=>o+a[0],0)/n.length,n.reduce((o,a)=>o+a[1],0)/n.length]:[e+r/(3*i),t+s/(3*i)]}function rl(n){return n.type==="Polygon"?[n.coordinates]:n.coordinates}function Ad(n,e=Zc){let t=rl(n.footprint),i=t[0]?.[0];if(!i||i.length<4)throw new Error(`Missing closed footprint: ${n.id}`);for(let r of t)for(let s of r){if(s.length<4||s[0][0]!==s[s.length-1][0]||s[0][1]!==s[s.length-1][1])throw new Error(`Unclosed footprint: ${n.id}`);for(let[o,a]of s)if(!Number.isFinite(o)||!Number.isFinite(a)||Math.abs(o)>180||Math.abs(a)>85.0511)throw new Error(`Non-geographic footprint: ${n.id}`)}return bi(nl(...il(i),e))}function Rd(n,e){if(!Number.isFinite(n)||n<0)throw new Error("Invalid camera distance");return e==="detail"&&n<=95?"detail":e==="massing"&&n>=235?"massing":n<(e==="facade"?65:80)?"detail":n>(e==="facade"?265:250)?"massing":"facade"}var sl=class{constructor(e,t){this.budget=e;this.release=t;if(!Number.isInteger(e)||e<1)throw new Error("Invalid resource budget")}entries=new Map;get keys(){return[...this.entries.keys()]}get size(){return this.entries.size}get(e){return this.entries.get(e)}touch(e){if(!this.entries.has(e))return;let t=this.entries.get(e);this.entries.delete(e),this.entries.set(e,t)}canAdopt(e,t=new Set){return this.entries.has(e)||this.entries.size<this.budget||this.keys.some(i=>!t.has(i))}adopt(e,t,i=new Set){return this.entries.get(e)===t&&this.entries.has(e)?(this.touch(e),!0):this.canAdopt(e,i)?(this.entries.has(e)?this.drop(e):this.entries.size>=this.budget&&this.drop(this.keys.find(r=>!i.has(r))),this.entries.set(e,t),!0):!1}drop(e){if(!this.entries.has(e))return;let t=this.entries.get(e);this.entries.delete(e),this.release(t,e)}clear(){for(let e of this.keys)this.drop(e)}};var zs=class{constructor(e){this.options=e;if(e.index.version!==1||!Number.isInteger(e.index.zoom)||e.index.zoom<0||e.index.zoom>22||!Array.isArray(e.index.tileList))throw new Error("Unsupported appearance index");if(this.published=new Set(e.index.tileList),this.published.size!==e.index.tileList.length||[...this.published].some(t=>!new RegExp(`^${e.index.zoom}/\\d+/\\d+$`).test(t)))throw new Error("Invalid appearance index keys");if(this.concurrency=e.concurrency??2,!Number.isInteger(this.concurrency)||this.concurrency<1||this.concurrency>8)throw new Error("Invalid appearance concurrency");if(!Number.isFinite(e.lodDistanceMultiplier??1)||(e.lodDistanceMultiplier??1)<.25||(e.lodDistanceMultiplier??1)>4)throw new Error("Invalid LOD distance multiplier");this.cache=new sl(e.budget??24,t=>t.resource?.dispose())}cache;published;controllers=new Map;failed=new Set;visibleDependencies=new Map;waiters=[];camera=null;wanted=new Set;queue=[];inFlight=0;disposed=!1;constrained=!1;concurrency;get status(){return{resident:this.cache.size,residentKeys:this.cache.keys,inFlight:this.inFlight,queued:this.queue.length,failed:[...this.failed],budgetConstrained:this.constrained,disposed:this.disposed}}update(e){if(this.disposed)return;let{bounds:t,longitude:i,latitude:r}=e;if(![i,r,t.west,t.south,t.east,t.north].every(Number.isFinite)||t.east<t.west||t.north<t.south||Math.abs(i)>180||Math.abs(r)>85.0511||t.west<-180||t.east>180||t.south<-85.0511||t.north>85.0511)throw new Error("Invalid appearance camera");if(t.east-t.west>1||t.north-t.south>1)throw new Error("Appearance viewport needs massing-only overview");this.camera=structuredClone(e),this.replan(),this.refreshLods(),this.pump()}retryFailed(){this.failed.clear(),this.camera&&!this.disposed&&(this.replan(),this.pump())}replan(){if(!this.camera)return;let{bounds:e}=this.camera,t=Kc(e,[],{zoom:this.options.index.zoom,margin:1,budget:this.cache.budget}).load.map(bi).filter(a=>this.published.has(a)),i=Dr(e,this.options.index.zoom).map(bi);for(let a of this.visibleDependencies.keys())i.includes(a)||this.visibleDependencies.delete(a);for(let a of i){let l=this.cache.get(a);l&&this.visibleDependencies.set(a,l.tile.halo.map(c=>c.ownerTile))}let r=i.flatMap(a=>this.visibleDependencies.get(a)??[]).filter(a=>this.published.has(a)),s=(this.options.priorityTiles??[]).filter(a=>this.published.has(a)),o=[...new Set([...s,...r,...t])];this.constrained=o.length>this.cache.budget,this.wanted=new Set(o.slice(0,this.cache.budget));for(let[a,l]of this.controllers)this.wanted.has(a)||l.abort();for(let a of this.wanted)this.cache.touch(a);this.queue=[...this.wanted].filter(a=>!this.cache.get(a)&&!this.controllers.has(a)&&!this.failed.has(a))}pump(){for(;!this.disposed&&this.inFlight<this.concurrency&&this.queue.length;){let e=this.queue.shift();this.cache.canAdopt(e,this.wanted)&&this.fetch(e)}this.settle()}validate(e,t){if(e.version!==1||e.key!==t||!Array.isArray(e.owners)||!Array.isArray(e.halo))throw new Error("Mismatched appearance tile");let i=new Set,r=new Set;for(let o of e.owners){if(!o.id||!o.geometryRevision||i.has(o.id)||Ad(o,this.options.index.zoom)!==t)throw new Error(`Invalid appearance owner: ${o.id}`);i.add(o.id);for(let a of o.observations){if(!a.id||r.has(a.id)||a.buildingId!==o.id||a.geometryRevision!==o.geometryRevision||!a.evidenceKey)throw new Error(`Unbound appearance observation: ${a.id}`);r.add(a.id)}}let s=new Set;for(let o of e.halo){if(!o.buildingId||!o.geometryRevision||o.ownerTile===t||!this.published.has(o.ownerTile)||i.has(o.buildingId)||s.has(o.buildingId))throw new Error(`Invalid appearance halo: ${o.buildingId}`);s.add(o.buildingId);let a=this.cache.get(o.ownerTile)?.tile;if(a&&!a.owners.some(l=>l.id===o.buildingId&&l.geometryRevision===o.geometryRevision))throw new Error(`Stale appearance halo: ${o.buildingId}`)}for(let o of this.cache.keys)for(let a of this.cache.get(o).tile.halo)if(a.ownerTile===t&&!e.owners.some(l=>l.id===a.buildingId&&l.geometryRevision===a.geometryRevision))throw new Error(`Stale appearance owner: ${a.buildingId}`)}async fetch(e){let t=new AbortController;this.controllers.set(e,t),this.inFlight++;try{let i=await this.options.loadTile(e,t.signal);if(this.disposed||t.signal.aborted||!this.wanted.has(e)||(this.validate(i,e),!this.cache.canAdopt(e,this.wanted)))return;let r={tile:i,resource:i.owners.length?this.options.createResource(i.owners):null,lods:new Map};if(!this.cache.adopt(e,r,this.wanted)){r.resource?.dispose();return}this.replan(),this.refreshLods()}catch(i){!t.signal.aborted&&!this.disposed&&(this.failed.add(e),this.options.onError?.(e,i))}finally{this.controllers.get(e)===t&&this.controllers.delete(e),this.inFlight--,this.disposed||this.replan(),this.pump()}}refreshLods(){if(!this.camera)return;let{longitude:e,latitude:t}=this.camera,i=111320*Math.cos(t*Math.PI/180);for(let r of this.cache.keys){let s=this.cache.get(r);for(let o of s.tile.owners){let[a,l]=il(rl(o.footprint)[0][0]),c=Math.hypot((a-e)*i,(l-t)*111320),u=Rd(c*(this.options.lodDistanceMultiplier??1),s.lods.get(o.id));s.lods.get(o.id)!==u&&(s.resource?.setLod(o.id,u),s.lods.set(o.id,u))}}}whenIdle(){return this.inFlight===0&&this.queue.length===0?Promise.resolve():new Promise(e=>this.waiters.push(e))}settle(){if(this.inFlight===0&&this.queue.length===0)for(let e of this.waiters.splice(0))e()}dispose(){if(!this.disposed){this.disposed=!0,this.queue=[];for(let e of this.controllers.values())e.abort();this.cache.clear(),this.settle()}}};function Cd(n,e,t="y"){let i=new n.MeshStandardMaterial({color:e,roughness:.94,side:n.DoubleSide});return i.customProgramCacheKey=()=>`appearance-brick-v1-${t}`,i.onBeforeCompile=r=>{r.vertexShader=`varying vec3 facadeMetricPosition;
`+r.vertexShader,r.vertexShader=r.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
facadeMetricPosition = position;`),r.fragmentShader=`varying vec3 facadeMetricPosition;
`+r.fragmentShader,r.fragmentShader=r.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
      vec3 brickUp = ${t==="y"?"vec3(0.,1.,0.)":"vec3(0.,0.,1.)"};
      vec3 brickNormal = normalize(cross(dFdx(facadeMetricPosition), dFdy(facadeMetricPosition)));
      vec3 brickTangent = normalize(cross(brickUp,brickNormal));
      vec2 brickMetres = vec2(dot(facadeMetricPosition,brickTangent),dot(facadeMetricPosition,brickUp));
      float brickRow = floor(brickMetres.y / .065);
      vec2 brickCell = vec2(brickMetres.x / .22 + mod(brickRow,2.)*.5, brickMetres.y / .065);
      vec2 brickEdge = min(fract(brickCell),1.-fract(brickCell));
      vec2 brickAA = max(fwidth(brickCell),vec2(.001));
      float brickInterior = smoothstep(.016,.016+brickAA.x,brickEdge.x)*smoothstep(.045,.045+brickAA.y,brickEdge.y);
      float brickFade = 1.-smoothstep(.15,.65,max(brickAA.x,brickAA.y));
      float brickVariation = fract(sin(dot(floor(brickCell),vec2(12.9898,78.233)))*43758.5453);
      diffuseColor.rgb *= mix(1., mix(1.13,.96+brickVariation*.08,brickInterior),brickFade);
    `)},i}var dy="legacy-block-NAP-minus-0.65m";function Pd(n){if(n===dy)return .65;if(n==="NAP")return 0;throw new Error(`Unsupported appearance height datum: ${n}`)}function ol(n,e,t=0){return n+Pd(e)-t}function Mi(n,e){return n-Pd(e)}function jc(n){let e=n.rings?.[0]||[],t,i=0;for(let o of e)for(let a of e){let l=Math.hypot(a[0]-o[0],a[2]-o[2]);l>i&&(t=[o,a],i=l)}if(!t||i<1e-8)return null;t.sort((o,a)=>o[0]-a[0]||o[2]-a[2]);let[r,s]=t;return{origin:[r[0],r[2]],u:[(s[0]-r[0])/i,(s[2]-r[2])/i],length:i}}var Jc=(n,e)=>(e[0]-n.origin[0])*n.u[0]+(e[2]-n.origin[1])*n.u[1];function Si(n,e,t,i=[]){let r=jc(n);if(!r)return{axis:null,sourceSurfaceIndex:e,intervals:[]};let s=[];for(let l of i){if(l.renderBuildingId!==t||!l.renderSurfaceIndices?.includes(e)||["rejected","uncertain","crop-repair"].includes(l.review?.placement)||!l.effectiveProposal||l.effectiveProposal.wholeUsable==="no")continue;let c=l.review?.placement==="accepted"&&l.review.targetId&&l.review.targetId!==l.id?i.find(m=>m.id===l.review.targetId):l;if(!c||c.buildingId&&c.buildingId!==t)continue;let u=[c.localStart,c.localEnd];if(u.some(m=>!Array.isArray(m)||m.length!==2||!m.every(Number.isFinite))||u.some(m=>Math.abs((m[0]-r.origin[0])*r.u[1]-(m[1]-r.origin[1])*r.u[0])>=.8))continue;let f=u.map(m=>Jc(r,[m[0],0,m[1]])),h=Math.max(0,Math.min(...f)),d=Math.min(r.length,Math.max(...f));d-h>1e-8&&s.push({record:l,startM:h,endM:d})}let o=[...new Set([0,r.length,...s.flatMap(l=>[l.startM,l.endM])])].sort((l,c)=>l-c),a=[];for(let l=0;l<o.length-1;l++){let c=o[l],u=o[l+1];if(u-c<1e-8)continue;let f=(c+u)/2,h=s.filter(g=>g.startM<=f&&g.endM>=f),d=h.filter(g=>g.record.review?.placement==="accepted"),m=d.length?d:h,b=m.length===1?m[0].record:null;a.push({startM:c,endM:u,observation:b,candidateIds:h.map(g=>g.record.id).sort(),status:b?d.length?"human":"machine":m.length?"conflict":"uncovered"})}return{axis:r,sourceSurfaceIndex:e,intervals:a}}function Id(n,e,t,i){function r(o,a,l){let c=[];for(let u=0;u<o.length;u++){let f=o[u],h=o[(u+1)%o.length],d=l*(Jc(e,f)-a),m=l*(Jc(e,h)-a);if(d>=0&&c.push(f),d>=0!=m>=0){let b=d/(d-m);c.push(f.map((g,p)=>g+(h[p]-g)*b))}}return c}let s=[];for(let o=0;o<n.length;o+=9){let a=[n.slice(o,o+3),n.slice(o+3,o+6),n.slice(o+6,o+9)];a=r(r(a,t,1),i,-1);for(let l=1;l<a.length-1;l++){let[c,u,f]=[a[0],a[l],a[l+1]],h=u.map((m,b)=>m-c[b]),d=f.map((m,b)=>m-c[b]);Math.hypot(h[1]*d[2]-h[2]*d[1],h[2]*d[0]-h[0]*d[2],h[0]*d[1]-h[1]*d[0])>1e-10&&s.push(...c,...u,...f)}}return s}function Vs(n,e,t){if(!n)return null;let i=c=>[e.origin[0]+e.u[0]*c,e.origin[1]+e.u[1]*c],r=[t.startM,t.endM].map(i).map(c=>(c[0]-n.a[0])*n.u[0]+(c[1]-n.a[1])*n.u[1]),s=Math.max(0,Math.min(...r)),o=Math.min(n.width,Math.max(...r));if(o-s<1e-8)return null;let a=[n.a[0]+n.u[0]*s,n.a[1]+n.u[1]*s],l=o-s;return{...n,a,width:l,mid:[a[0]+n.u[0]*l/2,a[1]+n.u[1]*l/2],polygon:n.polygon.map(c=>[c[0]-s,c[1]]),holes:(n.holes||[]).map(c=>c.map(u=>[u[0]-s,u[1]])),intervalBounded:!0,observation:t.observation,intervalStatus:t.status}}function fy(n,e,t){let i=t[0]-e[0],r=t[1]-e[1],s=Math.hypot(i,r);return s<1e-7?Math.hypot(n[0]-e[0],n[1]-e[1])<=1e-7:Math.abs((n[0]-e[0])*r-(n[1]-e[1])*i)<=1e-7*s&&(n[0]-e[0])*i+(n[1]-e[1])*r>=-1e-7*s&&(n[0]-t[0])*i+(n[1]-t[1])*r<=1e-7*s}function Dd(n,e){let t=!1;for(let i=0,r=e.length-1;i<e.length;r=i++){let s=e[r],o=e[i];if(fy(n,s,o))return{inside:!1,boundary:!0};s[1]>n[1]!=o[1]>n[1]&&n[0]<(o[0]-s[0])*(n[1]-s[1])/(o[1]-s[1])+s[0]&&(t=!t)}return{inside:t,boundary:!1}}function py(n,e,t){let i=0,r=1;for(let s=0;s<2;s++){let o=t[s]+1e-7,a=t[s+2]-1e-7,l=e[s]-n[s];if(o>=a)return!1;if(Math.abs(l)<1e-7){if(n[s]<=o||n[s]>=a)return!1;continue}let c=(o-n[s])/l,u=(a-n[s])/l;if(i=Math.max(i,Math.min(c,u)),r=Math.min(r,Math.max(c,u)),i>r)return!1}return i<=r}function tn(n,e,t,i,r){if(![e,t,i,r].every(Number.isFinite)||i<=0||r<=0)return!1;let s=[e-i/2,t-r/2,e+i/2,t+r/2];if(n.intervalBounded&&(s[0]<-1e-7||s[2]>n.width+1e-7))return!1;let o=[n.polygon,...n.holes||[]];if(o.some(l=>!Array.isArray(l)||l.length<3||l.some(c=>!Array.isArray(c)||c.length<2||!c.slice(0,2).every(Number.isFinite))))return!1;let a=[[s[0],s[1]],[s[0],s[3]],[s[2],s[1]],[s[2],s[3]]];return a.some(l=>{let c=Dd(l,o[0]);return!c.inside&&!c.boundary})||o.slice(1).some(l=>a.some(c=>Dd(c,l).inside))?!1:!o.some(l=>l.some((c,u)=>py(c,l[(u+1)%l.length],s)))}function my(n){let e=n.awningEvidence;if(!e||e.origin!=="agent-visual-review"||e.derivationKey!==n.derivationKey||e.buildingMatch!=="yes"||e.appearanceEligible!==!0)return null;let t=Object.values(n.images||{});return!Array.isArray(e.images)||!e.images.length||!e.images.every(i=>t.some(r=>i.file===r.file&&i.sha256===r.sha256&&(!i.panoramaSha256||i.panoramaSha256===r.panoramaSha256)))?null:e.awningObservation||null}function Ld(n){let e=n.review;if(e?.placement!=="accepted"||e.targetId!==n.id||n.effectiveProposal?.awning!=="yes"||n.effectiveProposal?.wholeUsable==="no")return!1;if(e.awningKind!==void 0||e.awningDeployment!==void 0)return e.awningKind==="fabric"&&e.awningDeployment==="deployed";let t=my(n);return t?.presence==="yes"&&t.fabricAwningPresence==="yes"&&t.kind==="fabric"&&t.observedDeployment==="deployed"}var wi={minimumWidthM:.65,minimumPairedWidthM:1.1,minimumHeightM:1.8,maximumGroundGapM:.3,maximumWidthGrowthM:.2,maximumHeightGrowthM:.25};function Fd(n,e){let t={feature:n,adjustments:[]};if(n.kind!=="door"||!Number.isFinite(e)||n.thresholdHeightM!==void 0||n.disposition==="human-reviewed")return t;let i=n.y-n.height/2,r=n.y+n.height/2,s=i-e;if(s<-1e-6||s>wi.maximumGroundGapM+1e-6)return t;let o=n.paired?wi.minimumPairedWidthM:wi.minimumWidthM;if(n.width<o-wi.maximumWidthGrowthM||n.height<wi.minimumHeightM-wi.maximumHeightGrowthM-s)return t;let a=[],l=i,c=r,u=n.width;if(s>1e-6&&(l=e,a.push("door-ground-extension")),u<o&&(u=o,a.push("door-minimum-width")),c-l<wi.minimumHeightM&&(c=l+wi.minimumHeightM,a.push("door-minimum-height")),!a.length)return t;let f=c-l,h={...n,width:u,height:f,y:(c+l)/2};for(let d of["archRise","lintelRise","transom"])n[d]!==void 0&&(h[d]=n[d]*n.height/f);return n.topCornerRadius!==void 0&&(h.topCornerRadius=n.topCornerRadius*Math.min(n.width,n.height)/Math.min(u,f)),{feature:h,adjustments:a}}var Nd=(n,e)=>JSON.stringify(n)===JSON.stringify(e);function Xi(n,e,t,i){let r=n.facadeDescription;if(!r||r.version!==1||!r.extractionVersion||r.buildingId!==e.id||r.geometryRevision!==e.geometryRevision||r.evidenceKey!==n.evidenceKey||!r.surfaceIndices?.includes(t)||!Nd(r.frontage,[n.localStart,n.localEnd])||n.machineRevocation?.revoked||["rejected","uncertain","crop-repair"].includes(n.review?.placement))return null;let s=r.sources?.[i],o=n.images?.[i];if(!s||!/^[a-f0-9]{64}$/i.test(s.cropSha256)||s.cropSha256!==o?.sha256||!s.captureDate||s.captureDate!==(o.date??o.capturedAt)||!Number.isInteger(s.imageDimensions?.width)||!Number.isInteger(s.imageDimensions?.height)||s.imageDimensions.width<=0||s.imageDimensions.height<=0||s.imageDimensions.width!==o?.width||s.imageDimensions.height!==o?.height||!Array.isArray(s.features)||s.features.length>256||new Set(s.features.map(u=>u.id)).size!==s.features.length)return null;let a=Object.values(r.sources).flatMap(u=>Array.isArray(u?.features)?u.features.map(f=>f.id):[]);if(new Set(a).size!==a.length)return null;let l=s.registration,c=l?.status==="correspondence-verified"&&Number.isFinite(l.residualM?.median)&&l.residualM.median<=.25&&Number.isFinite(l.residualM?.p95)&&l.residualM.p95<=.5&&Number.isInteger(l.independentAnchors)&&l.independentAnchors>=3;return!l||l.status!=="registered"&&!c||l.surfaceIndex!==t||!Number.isFinite(l.uncertaintyM)||l.uncertaintyM<0||l.imageToWall?.length!==9||!l.imageToWall.every(Number.isFinite)||l.status==="registered"&&l.uncertaintyM>.15||l.sourceDatum&&l.sourceDatum!=="NAP"||l.canonicalDatum&&l.canonicalDatum!=="surface-base"||l.pixelConvention&&l.pixelConvention!=="pixel-edge"||l.wallDirection&&(!Array.isArray(l.wallDirection)||l.wallDirection.length!==2||!l.wallDirection.every(Number.isFinite)||Math.abs(Math.hypot(...l.wallDirection)-1)>.001)||l.status==="registered"&&(!l.alignment||l.alignment.wallIdentity!=="verified"||l.alignment.boundaryEvidence!==!0||l.alignment.rooflineEvidence!==!0||l.alignment.cameraHeightResolved!==!0||l.alignment.orientationVerified!==!0)?null:c?{...s,registration:{...l,uncertaintyM:l.residualM.median}}:s}function Gs(n,e,t,i){let r=n.facadeDescription;if(!r||r.version!==1||!r.extractionVersion||r.buildingId!==e.id||r.geometryRevision!==e.geometryRevision||r.evidenceKey!==n.evidenceKey||!r.surfaceIndices?.includes(t)||!Nd(r.frontage,[n.localStart,n.localEnd])||n.machineRevocation?.revoked||["rejected","uncertain","crop-repair"].includes(n.review?.placement))return null;let s=r.sources?.[i],o=n.images?.[i],a=s?.registration,l=a?.preview;return!s||!o||!/^[a-f0-9]{64}$/i.test(s.cropSha256)||s.cropSha256!==o.sha256||s.captureDate!==(o.date??o.capturedAt)||!Number.isInteger(s.imageDimensions?.width)||!Number.isInteger(s.imageDimensions?.height)||s.imageDimensions.width<=0||s.imageDimensions.height<=0||s.imageDimensions.width!==o.width||s.imageDimensions.height!==o.height||!Array.isArray(s.features)||s.features.length>256||new Set(s.features.map(c=>c.id)).size!==s.features.length||a?.status!=="ambiguous"||a.surfaceIndex!==t||a.sourceDatum!=="NAP"||a.canonicalDatum!=="surface-base"||a.pixelConvention!=="pixel-edge"||!l||l.kind!=="native-crop-plane"||l.cropSha256!==s.cropSha256||l.imageDimensions?.width!==s.imageDimensions.width||l.imageDimensions?.height!==s.imageDimensions.height||!Array.isArray(l.imageToWall)||l.imageToWall.length!==9||!l.imageToWall.every(Number.isFinite)||!l.note?.trim()?null:{...s,registration:{...a,imageToWall:l.imageToWall,uncertaintyM:.15}}}function Lr(n,e,t){let i=t.review?.facadeFeatures?.[n.id];if(n.disposition==="revoked"||i?.disposition==="revoked"||t.featureRevocations?.[n.id]||t.visualReview?.fieldEligibility?.[n.id]===!1&&i?.disposition!=="human-reviewed")return null;let r=i?.disposition==="human-reviewed"?{...n,...i}:n;if(!["machine-observed-unreviewed","agent-inspected","human-reviewed"].includes(r.disposition)||r.signMount!==void 0&&(!["wall","glazing"].includes(r.signMount)||r.kind!=="fascia")||r.doorStyle!==void 0&&(!["panelled","glazed","plain"].includes(r.doorStyle)||r.kind!=="door")||r.doorFurniture!==void 0&&(!["knob","pull","none"].includes(r.doorFurniture)||r.kind!=="door")||r.doorGlazingRatio!==void 0&&(r.kind!=="door"||r.doorStyle!=="glazed"||!Number.isFinite(r.doorGlazingRatio)||r.doorGlazingRatio<.35||r.doorGlazingRatio>.95)||!r.id||!Array.isArray(r.bounds)||r.bounds.length!==4||!r.bounds.every(Number.isFinite)||r.archRise!==void 0&&(!Number.isFinite(r.archRise)||r.archRise<=0||r.archRise>.5||!["rounded","segmental"].includes(r.head??""))||r.lintelRise!==void 0&&(!Number.isFinite(r.lintelRise)||r.lintelRise<=0||r.lintelRise>.5||!["rounded","segmental"].includes(r.lintelHead??""))||r.topCornerRadius!==void 0&&(!Number.isFinite(r.topCornerRadius)||r.topCornerRadius<=0||r.topCornerRadius>.25||r.head!=="rectangular"))return null;let[s,o,a,l]=r.bounds;if(s<0||o<0||a<=s||l<=o)return null;let c=Object.values(t.images??{}).find(v=>v.sha256===e.cropSha256);if(a>e.imageDimensions.width||l>e.imageDimensions.height)return null;let u=e.registration.imageToWall,f=[[s,o],[a,o],[a,l],[s,l]],h=f.map(([v,C])=>u[6]*v+u[7]*C+u[8]);if(h.some(v=>Math.abs(v)<1e-8)||h.some(v=>Math.sign(v)!==Math.sign(h[0])))return null;let d=f.map(([v,C],S)=>[(u[0]*v+u[1]*C+u[2])/h[S],(u[3]*v+u[4]*C+u[5])/h[S]]),m=Math.max(.03,e.registration.uncertaintyM);if(Math.max(Math.abs(d[0][1]-d[1][1]),Math.abs(d[2][1]-d[3][1]),Math.abs(d[0][0]-d[3][0]),Math.abs(d[1][0]-d[2][0]))>m)return null;let b=d.map(v=>v[0]),g=d.map(v=>v[1]),p=Math.max(...b)-Math.min(...b),M=Math.max(...g)-Math.min(...g);if(![p,M,...b,...g].every(Number.isFinite)||p<=.02||M<=.02)return null;let T=d[0][0]>d[1][0]&&Array.isArray(r.mullions)?r.mullions.map(v=>1-v).sort((v,C)=>v-C):r.mullions;return{...r,...T?{mullions:T}:{},t:(Math.min(...b)+Math.max(...b))/2,y:(Math.min(...g)+Math.max(...g))/2,width:p,height:M,uncertaintyM:e.registration.uncertaintyM}}function Hs(n,e,t="rectangular",i,r){let s=n/2,o=-e/2,a=e/2;if(t==="rectangular"&&Number.isFinite(r)&&r>0){let h=Math.min(n,e)*r,d=Array.from({length:5},(b,g)=>{let p=g*Math.PI/8;return[s-h+Math.cos(p)*h,a-h+Math.sin(p)*h]}),m=Array.from({length:5},(b,g)=>{let p=Math.PI/2+g*Math.PI/8;return[-s+h+Math.cos(p)*h,a-h+Math.sin(p)*h]});return[[-s,o],[s,o],[s,a-h],...d.slice(1),...m.slice(1),[-s,a-h]]}if(!["rounded","segmental"].includes(t))return[[-s,o],[s,o],[s,a],[-s,a]];let l=Number.isFinite(i)&&i>0&&i<=.5?e*i:void 0,c=Math.min(l??(t==="rounded"?s:n*.2),e*.5),u=a-c,f=Array.from({length:13},(h,d)=>{let m=d*Math.PI/12;return[Math.cos(m)*s,u+Math.sin(m)*c]});return[[-s,o],[s,o],...f]}function Ud(n,e){let t=[];for(let r=0;r<n.length;r++){let s=n[r],o=n[(r+1)%n.length];(s[1]<=e&&e<o[1]||o[1]<=e&&e<s[1])&&t.push(s[0]+(o[0]-s[0])*(e-s[1])/(o[1]-s[1]))}t.sort((r,s)=>r-s);let i=[];for(let r=0;r+1<t.length;r+=2)t[r+1]-t[r]>.001&&i.push([t[r],t[r+1]]);return i}function Od(n,e){let t=[];for(let i=0;i<n.length;i++){let r=n[i],s=n[(i+1)%n.length];(r[0]<=e&&e<s[0]||s[0]<=e&&e<r[0])&&t.push(r[1]+(s[1]-r[1])*(e-r[0])/(s[0]-r[0]))}return t.length<2?null:(t.sort((i,r)=>i-r),[t[0],t[t.length-1]])}var al={windowGlass:"#526a6b",windowGlassBlue:"#4b6268",windowGlassWarm:"#62685d",windowFrame:"#ddd8c7",windowFrameDark:"#676963",doorWood:"#3f342d",shopGlass:"#354a4b",awningFabric:"#807765",facadeTrimLight:"#b9ad96",facadeTrimDark:"#61584e"};function eu(n,e){let t=!1;for(let i=0,r=e.length-1;i<e.length;r=i++){let s=e[i],o=e[r];s[1]>n[1]!=o[1]>n[1]&&n[0]<(o[0]-s[0])*(n[1]-s[1])/(o[1]-s[1])+s[0]&&(t=!t)}return t}function tu(n,e){return(e.type==="Polygon"?[e.coordinates]:e.coordinates).some(i=>eu(n,i[0])&&!i.slice(1).some(r=>eu(n,r)))}var Bd=new WeakMap;function gy(n,e,t){let i=Bd.get(t);if(!i){i=new Map;for(let s of t){let o=s.geometry.building.footprint,a=o.type==="Polygon"?[o.coordinates]:o.coordinates,l=a.flat(2),c=s.geometry.frame.originRD,u=l.map(h=>h[0]+c.x),f=l.map(h=>c.y-h[1]);for(let h=Math.floor(Math.min(...u)/32);h<=Math.floor(Math.max(...u)/32);h++)for(let d=Math.floor(Math.min(...f)/32);d<=Math.floor(Math.max(...f)/32);d++){let m=`${h},${d}`,b=i.get(m)??[];b.push(s),i.set(m,b)}}Bd.set(t,i)}let r=e.geometry.frame.originRD;return i.get(`${Math.floor((n[0]+r.x)/32)},${Math.floor((r.y-n[1])/32)}`)??[]}function Xd(n,e,t){let i=e.geometry.frame.originRD;return gy(n,e,t).some(r=>{if(r.id===e.id)return!1;let s=r.geometry.frame.originRD;return tu([n[0]+i.x-s.x,n[1]+s.y-i.y],r.geometry.building.footprint)})}function Ti(n,e,t,i,r){return[-.5,0,.5].every(s=>{let o=e+t*s;return!Xd([n.a[0]+n.u[0]*o+n.n[0]*.08,n.a[1]+n.u[1]*o+n.n[1]*.08],i,r)})}function Nr(n,e,t){let i=jc(n);if(!i||i.length<1.5||n.rings.flat().some(f=>Math.abs((f[0]-i.origin[0])*i.u[1]-(f[2]-i.origin[1])*i.u[0])>.1))return null;let r=i.origin,s=i.u,o=[r[0]+s[0]*i.length/2,r[1]+s[1]*i.length/2],a=[-s[1],s[0]],l=(f,h)=>[o[0]+f[0]*h,o[1]+f[1]*h];if(tu(l(a,.25),e.geometry.building.footprint)&&(a=a.map(f=>-f)),tu(l(a,.25),e.geometry.building.footprint)||Xd(l(a,.25),e,t))return null;let c=f=>[(f[0]-r[0])*s[0]+(f[2]-r[1])*s[1],f[1]],u=n.rings.map(f=>f.map(c));return{a:r,u:s,n:a,width:i.length,bottom:Math.min(...u[0].map(f=>f[1])),top:Math.max(...u[0].map(f=>f[1])),polygon:u[0],holes:u.slice(1)}}var kd=new WeakMap;function _y(n,e){let t=kd.get(n);if(t!==void 0)return t;let i=-1,r=0;return n.geometry.building.surfaces.forEach((s,o)=>{if(s.type!=="wall")return;let a=Nr(s,n,e);a&&a.width>r&&(r=a.width,i=o)}),kd.set(n,i),i}var qd=(n,e)=>{let t=n.images?.[e];return!!t&&/^[a-f0-9]{64}$/i.test(t.sha256??"")&&/^[a-f0-9]{64}$/i.test(t.panoramaSha256??"")},xy=n=>!["rejected","uncertain","crop-repair"].includes(n.review?.placement);function ll(n){return n.flatMap(e=>e.observations.filter(t=>{let i=t.payload;return t.buildingId===e.id&&t.geometryRevision===e.geometryRevision&&t.evidenceKey&&i?.evidenceKey===t.evidenceKey&&i?.derivationKey&&i.renderBuildingId===e.id&&!i.machineRevocation?.revoked&&xy(i)}).map(t=>t.payload))}function zd(n){return!qd(n,"ground")||!["yes","no"].includes(n.effectiveProposal?.shopfront)?!1:n.review?.placement==="accepted"&&n.proposalSources?.shopfront==="human-review"?!0:n.visualReview?.fieldEligibility?.shopfront===!1?!1:n.visualReview?.fieldEligibility?.shopfront===!0||n.effectiveProposal?.groundUsable==="yes"}function yy(n){return qd(n,"full")&&n.effectiveProposal?.wholeUsable==="yes"&&n.visualReview?.appearanceEligible!==!1}var wt=(n,e,t,i)=>[n.a[0]+n.u[0]*e+n.n[0]*i,t,n.a[1]+n.u[1]*e+n.n[1]*i];function ot(n,e,t,i,r,s){let o=[[e-i/2,t-r/2],[e+i/2,t-r/2],[e+i/2,t+r/2],[e-i/2,t+r/2]].map(([l,c])=>wt(n,l,c,s));return(-n.u[1]*n.n[0]+n.u[0]*n.n[1]>=0?[0,1,2,0,2,3]:[0,2,1,0,3,2]).flatMap(l=>o[l])}var Xs=n=>n.reduce((e,t,i)=>{let r=n[(i+1)%n.length];return e+t[0]*r[1]-r[0]*t[1]},0);function Yd(n){let e=0;for(let t=0;t<n.length;t++){let i=n[t],r=n[(t+1)%n.length],s=n[(t+2)%n.length],o=(r[0]-i[0])*(s[1]-r[1])-(r[1]-i[1])*(s[0]-r[0]);if(Math.abs(o)<1e-9)continue;let a=Math.sign(o);if(e&&a!==e)return!1;e=a}return e!==0}function Vd(n,e){if(e.length<3||Math.abs(Xs(e))<1e-8)return[];let t=Math.sign(Xs(e)),i=n;for(let r=0;r<e.length;r++){let s=e[r],o=e[(r+1)%e.length],a=i;i=[];let l=c=>(o[0]-s[0])*(c[1]-s[1])-(o[1]-s[1])*(c[0]-s[0]);for(let c=0;c<a.length;c++){let u=a[c],f=a[(c+1)%a.length],h=l(u),d=l(f),m=t*h>=-1e-8,b=t*d>=-1e-8;if(m&&i.push(u),m!==b){let g=h/(h-d);i.push([u[0]+(f[0]-u[0])*g,u[1]+(f[1]-u[1])*g])}}}return i}var Fr=(n,e,t)=>(e[0]-n[0])*(t[1]-n[1])-(e[1]-n[1])*(t[0]-n[0]),vy=(n,e)=>e.some((t,i)=>{let r=e[(i+1)%e.length];return Math.abs(Fr(t,r,n))<1e-8&&n[0]>=Math.min(t[0],r[0])-1e-8&&n[0]<=Math.max(t[0],r[0])+1e-8&&n[1]>=Math.min(t[1],r[1])-1e-8&&n[1]<=Math.max(t[1],r[1])+1e-8}),qs=(n,e)=>vy(n,e)||eu(n,e),by=(n,e,t,i)=>{let r=Math.sign(Fr(e,t,i));return r*Fr(e,t,n)>=-1e-8&&r*Fr(t,i,n)>=-1e-8&&r*Fr(i,e,n)>=-1e-8};function My(n,e,t){let i=[e[0]-n[0],e[1]-n[1]],r=i[0]*i[0]+i[1]*i[1];if(r<1e-16)return qs(n,t);let s=[0,1];for(let o=0;o<t.length;o++){let a=t[o],l=t[(o+1)%t.length],c=[l[0]-a[0],l[1]-a[1]],u=[a[0]-n[0],a[1]-n[1]],f=i[0]*c[1]-i[1]*c[0];if(Math.abs(f)<1e-12){if(Math.abs(u[0]*i[1]-u[1]*i[0])<1e-10)for(let m of[a,l])s.push(Math.max(0,Math.min(1,((m[0]-n[0])*i[0]+(m[1]-n[1])*i[1])/r)));continue}let h=(u[0]*c[1]-u[1]*c[0])/f,d=(u[0]*i[1]-u[1]*i[0])/f;h>=-1e-10&&h<=1+1e-10&&d>=-1e-10&&d<=1+1e-10&&s.push(Math.max(0,Math.min(1,h)))}return s.sort((o,a)=>o-a),s.every((o,a)=>a===s.length-1||qs([n[0]+i[0]*(o+s[a+1])/2,n[1]+i[1]*(o+s[a+1])/2],t))}var Sy=(n,e)=>n.every((t,i)=>qs(t,e)&&My(t,n[(i+1)%3],e));function wy(n){let e=n.filter((s,o)=>o===0||Math.abs(s[0]-n[o-1][0])>1e-10||Math.abs(s[1]-n[o-1][1])>1e-10);e.length>2&&Math.abs(e[0][0]-e.at(-1)[0])<1e-10&&Math.abs(e[0][1]-e.at(-1)[1])<1e-10&&e.pop();let t=Math.sign(Xs(e));if(e.length<3||!t)return[];let i=e.map((s,o)=>o),r=[];for(;i.length>3;){let s=-1;for(let o=0;o<i.length;o++){let a=i[(o+i.length-1)%i.length],l=i[o],c=i[(o+1)%i.length],u=e[a],f=e[l],h=e[c];if(!(t*Fr(u,f,h)<=1e-10)&&!i.some(d=>d!==a&&d!==l&&d!==c&&by(e[d],u,f,h))){s=o,r.push([u,f,h]);break}}if(s<0)return[];i.splice(s,1)}return r.push(i.map(s=>e[s])),r}var Gd=new WeakMap;function $d(n,e){if(Yd(e)){let i=Vd(n,e);return i.length>=3&&Math.abs(Xs(i))>1e-10?[i]:[]}let t=Gd.get(e);return t||(t=wy(e),Gd.set(e,t)),t.map(i=>Vd(n,i)).filter(i=>i.length>=3&&Math.abs(Xs(i))>1e-10)}function Ty(n,e,t,i,r,s){let o=[];for(let a of $d([[e-i/2,t-r/2],[e+i/2,t-r/2],[e+i/2,t+r/2],[e-i/2,t+r/2]],n.polygon))for(let l=1;l<a.length-1;l++){let c=[a[0],a[l],a[l+1]],u=[c.reduce((f,h)=>f+h[0],0)/3,c.reduce((f,h)=>f+h[1],0)/3];n.holes.some(f=>qs(u,f))||o.push(...c.flatMap(([f,h])=>wt(n,f,h,s)))}return o}function Qc(n,e,t){return n.flatMap((i,r)=>{if(r%3!==0)return[];let s=(n[r]-e.a[0])*e.u[0]+(n[r+2]-e.a[1])*e.u[1],o=n[r+1],a=(s-t.left)/(t.right-t.left);return t.sourceXForward||(a=1-a),[Math.max(0,Math.min(1,a)),Math.max(0,Math.min(1,(o-t.bottom)/(t.top-t.bottom)))]})}function Ey(n,e){let t=[];for(let i=0;i<n.length;i+=9){let r=[0,1,2].map(c=>n.slice(i+c*3,i+c*3+3)),s=r.map(c=>[(c[0]-e.a[0])*e.u[0]+(c[2]-e.a[1])*e.u[1],c[1]]);if(!e.holes.length&&Sy(s,e.polygon)){t.push(...r.flat());continue}let o=r.map(c=>(c[0]-e.a[0])*e.n[0]+(c[2]-e.a[1])*e.n[1]),a=(s[1][1]-s[2][1])*(s[0][0]-s[2][0])+(s[2][0]-s[1][0])*(s[0][1]-s[2][1]),l=(c,u)=>{if(Math.abs(a)<1e-12)return o[0];let f=((s[1][1]-s[2][1])*(c-s[2][0])+(s[2][0]-s[1][0])*(u-s[2][1]))/a,h=((s[2][1]-s[0][1])*(c-s[2][0])+(s[0][0]-s[2][0])*(u-s[2][1]))/a;return f*o[0]+h*o[1]+(1-f-h)*o[2]};for(let c of $d(s,e.polygon))for(let u=1;u<c.length-1;u++){let f=[c[0],c[u],c[u+1]],h=[f.reduce((d,m)=>d+m[0],0)/3,f.reduce((d,m)=>d+m[1],0)/3];e.holes.some(d=>qs(h,d))||t.push(...f.flatMap(([d,m])=>wt(e,d,m,l(d,m))))}}return t}function Ws(n,e,t,i,r,s,o){return[...ot(n,e,t-r/2-s/2,i+2*s,s,o),...ot(n,e,t+r/2+s/2,i+2*s,s,o),...ot(n,e-i/2-s/2,t,s,r,o),...ot(n,e+i/2+s/2,t,s,r,o)]}function Ay(n,e){let t=e?.bounds;if(!Array.isArray(t)||t.length!==4)return 1/0;let[i,r,s,o]=t,a=1/0;for(let l of n??[]){if(l===e||!["window","door"].includes(l.kind))continue;let c=l.bounds;if(!Array.isArray(c)||c.length!==4)continue;let u=Math.min(o,c[3])-Math.max(r,c[1]);if(u<=0||u<.5*Math.min(o-r,c[3]-c[1]))continue;let f;if(c[2]<=i)f=i-c[2];else if(s<=c[0])f=c[0]-s;else continue;f<a&&(a=f)}return a}function Ry(n,e,t,i,r,s,o=l=>!0,a=!1){let l=[],c=n.geometryRevision==="source-space-unregistered",u=a&&i.facadeDescription?.extractionVersion==="source-facade-owner-candidate/v1",f=a&&["case24-source-facade-candidate/v4-doors-and-display","source-facade-owner-candidate/v1"].includes(i.facadeDescription?.extractionVersion)&&r.registration?.status==="ambiguous"&&r.registration?.preview?.kind==="native-crop-plane",h=new Set,d=new Set,m=Number.isFinite(n.geometry.building.groundNAP)&&["NAP","legacy-block-NAP-minus-0.65m"].includes(n.geometry.frame.heightDatum)?Mi(n.geometry.building.groundNAP,n.geometry.frame.heightDatum)-e.bottom:void 0,b=(M,T)=>/^#[a-f0-9]{6}$/i.test(M??"")?M:T,g=(M,T)=>{if(M.kind==="window"){let v=/^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(M.colour??"");if(v&&[1,2,3].every(C=>parseInt(v[C],16)>=235))return T}return b(M.colour,T)},p=(t.a[0]-e.a[0])*e.u[0]+(t.a[1]-e.a[1])*e.u[1];for(let M of r.features??[]){if(!o(M))continue;if(M.kind==="material"&&M.region&&["accent","band","surround","plinth"].includes(M.region)&&Array.isArray(M.bounds)&&M.bounds.length===4&&M.bounds.every(Number.isFinite)){let W=r.imageDimensions,J=Math.max(0,M.bounds[2]-M.bounds[0])*Math.max(0,M.bounds[3]-M.bounds[1]);if(W&&J/(W.width*W.height)>=.6)continue}let T=i.facadeDescription?.concaveMaterialPreview,v=T?.sourceCropSha256===r.cropSha256&&T?.featureIds?.includes(M.id);if(u&&M.kind==="material"&&!Yd(t.polygon)&&!v)continue;let C=Lr(M,r,i);if(!C)continue;let S=Fd(C,m);if(S.adjustments.length){let W=S.feature,J=W.lintelHead||W.surroundColour?.length?.14:.07;(!tn(t,W.t-p,W.y+e.bottom+J/2,W.width+J*2,W.height+J)||!Ti(t,W.t-p,W.width+J*2,n,s))&&(S={feature:C,adjustments:[]})}let _=S.feature,x=f&&Array.isArray(_.bounds)?(()=>{let W=r.registration.imageToWall,[J,fe,Se,we]=_.bounds,Re=(J+Se)/2,ie=(fe+we)/2,ue=(ke,Ye)=>{let L=W[6]*ke+W[7]*Ye+W[8];return Math.abs(L)>1e-8?[(W[0]*ke+W[1]*Ye+W[2])/L,(W[3]*ke+W[4]*Ye+W[5])/L]:null},he=ue(Re,ie),Me=ue(Re+1,ie),Xe=ue(Re,ie+1);if(!he||!Me||!Xe)return;let et=Math.hypot(Me[0]-he[0],Me[1]-he[1]),Qe=Math.hypot(Xe[0]-he[0],Xe[1]-he[1]),He=(et+Qe)/2;return Number.isFinite(He)&&He>0&&He<.1?He:void 0})():void 0,A=c?.01:x,E=A&&Number.isFinite(_.sourceFrameWidthPx)&&_.sourceFrameWidthPx>0&&_.sourceFrameWidthPx<=12?_.sourceFrameWidthPx*A:void 0,R=A&&Number.isFinite(_.sourceJoineryWidthPx)&&_.sourceJoineryWidthPx>0&&_.sourceJoineryWidthPx<=12?_.sourceJoineryWidthPx*A:void 0,I=A??(()=>{let W=r.registration?.imageToWall;if(!Array.isArray(W)||W.length!==9)return;let[J,fe,Se,we]=_.bounds,Re=(J+Se)/2,ie=(fe+we)/2,ue=(et,Qe)=>{let He=W[6]*et+W[7]*Qe+W[8];return Math.abs(He)>1e-8?[(W[0]*et+W[1]*Qe+W[2])/He,(W[3]*et+W[4]*Qe+W[5])/He]:null},he=ue(Re,ie),Me=ue(Re+1,ie);if(!he||!Me)return;let Xe=Math.hypot(Me[0]-he[0],Me[1]-he[1]);return Number.isFinite(Xe)&&Xe>0&&Xe<.5?Xe:void 0})(),N=E??.14;if(I&&Number.isFinite(_.frameClearancePx)&&_.frameClearancePx>0){let W=Ay(r.features??[],M),J=Number.isFinite(W)?Math.min(_.frameClearancePx,W):_.frameClearancePx;N=Math.min(N,Math.max(0,J*I))}let U=R??.065,F=R?.008:.08,O=_.t-p,D=_.y+e.bottom,G=_.kind==="window"||_.kind==="door",K=G?_.lintelHead||_.surroundColour?.length?.14:.07:0,Q=S.adjustments.length>0,ne=tn(t,O,D+(Q?K/2:0),_.width+K*2,_.height+K*(Q?1:2))&&Ti(t,O,_.width+K*2,n,s),ae=G&&!ne&&a;if((G||_.kind==="awning")&&!ne&&!ae)continue;let Ne=_.kind==="door"?"observed-door":_.kind==="window"?"observed-window":_.kind==="awning"?"observed-awning":_.kind==="fascia"?"observed-fascia":"observed-material",Ge=`${n.id}:${i.id}:${_.id}`;ae&&h.add(Ge),Q&&d.add(Ge);let Ae=(W,J)=>l.push({triangles:W,colour:J,observationId:i.id,featureId:Ge,featureKind:Ne,styleSource:_.disposition,...Q?{heuristics:S.adjustments}:{},..._.kind==="material"&&_.material==="brick"?{material:"brick"}:{}}),$=(W,J,fe,Se)=>[W,J,fe].flatMap(([we,Re])=>wt(t,O+we,D+Re,Se));if(G){if(!_.head||_.head==="unknown")continue;let W=Hs(_.width,_.height,_.head,_.archRise,_.topCornerRadius),J=Hs(_.width+N,_.height+N,_.head,_.archRise,_.topCornerRadius);for(let ie=1;ie<W.length-1;ie++)Ae($(W[0],W[ie],W[ie+1],.032),g(_,_.kind==="door"?"doorWood":"windowGlass"));for(let ie=0;ie<W.length;ie++){let ue=(ie+1)%W.length;Ae([...$(W[ie],J[ie],J[ue],.072),...$(W[ie],J[ue],W[ue],.072)],b(_.frameColour,"windowFrame"))}for(let ie=0;ie<W.length;ie++){let ue=(ie+1)%W.length,he=wt(t,O+W[ie][0],D+W[ie][1],.032),Me=wt(t,O+W[ue][0],D+W[ue][1],.032),Xe=wt(t,O+W[ue][0],D+W[ue][1],.072),et=wt(t,O+W[ie][0],D+W[ie][1],.072);Ae([...he,...Me,...Xe,...he,...Xe,...et],b(_.frameColour,"windowFrame"))}if(_.kind==="window"&&Ae(ot(t,O,D-_.height/2-N/4,_.width+N,N/2,.095),b(_.frameColour,"windowFrame")),_.kind==="door"&&_.transom&&_.transom>0&&_.transom<.6){let ie=_.height*(.5-_.transom),ue=[];for(let he=0;he<W.length;he++){let Me=W[he],Xe=W[(he+1)%W.length];Me[1]>=ie&&ue.push(Me),Me[1]>=ie!=Xe[1]>=ie&&ue.push([Me[0]+(Xe[0]-Me[0])*(ie-Me[1])/(Xe[1]-Me[1]),ie])}for(let he=1;he<ue.length-1;he++)Ae($(ue[0],ue[he],ue[he+1],.04),"windowGlass")}let fe=_.transom&&_.transom>0&&_.transom<.6?_.height*(.5-_.transom):void 0,Se=_.opaqueHeadAboveTransom;if(f&&Se===!0&&_.kind==="window"&&_.head==="rectangular"&&fe!==void 0){let ie=_.height/2-fe;ie>0&&Ae(ot(t,O,D+fe+ie/2,_.width,ie,.04),"windowFrameDark")}let we=ie=>{let ue=Od(W,ie);if(!ue)return;let he=(c||f)&&_.mullionScope==="below-transom"&&_.kind==="window"&&fe!==void 0?Math.min(ue[1],fe):ue[1],Me=R?he-ue[0]-F:Math.max(.02,he-ue[0]-.08);Me>0&&Ae(ot(t,O+ie,D+(ue[0]+he)/2,U,Me,.078),b(_.frameColour,"windowFrame"))},Re=ie=>{for(let[ue,he]of Ud(W,ie))Ae(ot(t,O+(ue+he)/2,D+ie,he-ue,U,.078),b(_.frameColour,"windowFrame"))};_.paired&&we(0),fe!==void 0&&Re(fe);for(let ie of _.mullions??[])ie>0&&ie<1&&we(_.width*(ie-.5));if(_.kind==="door"){let ie=_.doorStyle??"panelled",ue=_.doorFurniture??"knob",he=ie==="glazed"&&_.doorGlazingRatio!==void 0,Me=-_.height/2,Xe=he&&!_.transom?_.height*.5-(_.archRise??0)*_.height-.05:Math.min(_.height*(.5-(_.transom??.12)),_.height*.5-(_.archRise??0)*_.height)-.1,et=_.paired?2:1,Qe=_.width/et,He=Xe-Me,ke=(Ye,L,vt)=>{Ae(Ye,L);let Ke=l[l.length-1];Ke.styleSource="procedural-prior-not-measured",Ke.heuristics=[...Ke.heuristics??[],vt]};if(he&&He>.65){let Ye=He*_.doorGlazingRatio,L=Math.max(.08,_.width-Math.min(.04,_.width*.1));Ae(ot(t,O,D+Xe-Ye/2,L,Ye,.04),"windowGlass")}else if(He>.65&&Qe>.36)for(let Ye=0;Ye<et;Ye++){let L=-_.width/2+Qe*(Ye+.5),vt=Qe*.68,Ke=(z,H,Z=!1)=>{ke(Ws(t,O+L,D+z,vt,H,.025,.083),"#655e50","door-panel-grammar"),ke(ot(t,O+L,D+z,vt,H,.081),Z?"windowGlass":b(_.colour,"doorWood"),"door-panel-grammar")};ie==="glazed"?(Ke(Me+He*.63,He*.53,!0),Ke(Me+He*.19,He*.19)):ie==="panelled"&&(Ke(Me+He*.27,He*.32),Ke(Me+He*.7,He*.36));let P=L+(et===2?Ye===0?1:-1:1)*Qe*.34,y=Me+Math.min(1.02,He*.55);if(ue==="knob"){let z=Math.min(.035,Qe*.05),H=[];for(let le=0;le<10;le++){let ce=le*Math.PI/5;H.push(wt(t,O+P+Math.cos(ce)*z,D+y+Math.sin(ce)*z,.115))}let Z=wt(t,O+P,D+y,.135);ke(H.flatMap((le,ce)=>[...Z,...le,...H[(ce+1)%H.length]]),"#b4a17a","door-furniture-grammar")}else ue==="pull"&&ke(ot(t,O+P,D+y,.026,Math.min(.28,He*.2),.12),"#b8b9b4","door-furniture-grammar");ie==="panelled"&&Ye===0&&ke(ot(t,O+L,D+Me+He*.49,Math.min(.24,vt*.65),.035,.11),"#aaa18a","door-furniture-grammar")}}if(_.lintelHead||_.surroundColour){let ie=Hs(_.width+.14,_.height+.14,_.lintelHead??_.head,_.lintelRise),ue=Hs(_.width+.28,_.height+.28,_.lintelHead??_.head,_.lintelRise);for(let he=2;he<ue.length-1;he++)Ae([...$(ie[he],ue[he],ue[he+1],.06),...$(ie[he],ue[he+1],ie[he+1],.06)],b(_.surroundColour,"facadeTrimLight"))}}else if(_.kind==="awning"){let W=(J,fe,Se,we,Re)=>{if(!_.text?.trim()||!_.physicalSignId?.trim())return;let ie=r.registration.imageToWall,ue=_.bounds[0],he=_.bounds[2],Me=(_.bounds[1]+_.bounds[3])/2,Xe=ke=>ie[6]*ke+ie[7]*Me+ie[8],et=ke=>(ie[0]*ke+ie[1]*Me+ie[2])/Xe(ke),Qe={left:O-_.width/2,right:O+_.width/2,bottom:Se,top:we,sourceXForward:et(he)>et(ue)};Ae(J,fe);let He=l[l.length-1];He.sign={text:_.text.trim(),background:al[fe]??fe,colour:/^#[a-f0-9]{6}$/i.test(_.textColour??"")?_.textColour:"#f4f1e8",..._.signFont?.trim()?{font:_.signFont.trim()}:{},physicalSignId:_.physicalSignId.trim(),aspectRatio:_.width/(we-Se),uv:Qc(J,t,Qe)},He.signMapping=Qe};if(_.state==="retracted"){let J=Math.min(.18,_.height),fe=b(_.frameColour,b(_.colour,"awningFabric"));Ae(ot(t,O,D,_.width,J,.1),b(_.colour,"awningFabric")),W(ot(t,O,D,_.width,J,.104),fe,D-J/2,D+J/2,.104)}if(_.state==="extended"){let J=D+_.height/2,fe=D-_.height/2,Se=Math.min(.26,_.height*.22),we=_.height-Se,Re=Math.min(1.5,Math.max(.45,_.width*.22)),ie=_.stripeColour?Math.max(2,Math.min(48,Math.round(_.stripeCount??20))):1,ue=_.awningProfile==="curved"?8:1,he=ke=>[J-we*(_.awningProfile==="curved"?1-Math.cos(ke*Math.PI/2):ke),.08+Re*(_.awningProfile==="curved"?Math.sin(ke*Math.PI/2):ke)],Me=(ke,Ye)=>Ae([0,1,2,0,2,3].flatMap(L=>ke[L]),Ye);for(let ke=0;ke<ie;ke++){let Ye=O-_.width/2+_.width*ke/ie,L=O-_.width/2+_.width*(ke+1)/ie,vt=b(ke%2?_.stripeColour:_.colour,"awningFabric");for(let P=0;P<ue;P++){let y=he(P/ue),z=he((P+1)/ue);Me([wt(t,Ye,y[0],y[1]),wt(t,L,y[0],y[1]),wt(t,L,z[0],z[1]),wt(t,Ye,z[0],z[1])],vt)}let Ke=_.valance==="scalloped"?Math.max(1,Math.round((L-Ye)/.16)):1;for(let P=0;P<Ke;P++)for(let y=0;y<(_.valance==="scalloped"?6:1);y++){let z=_.valance==="scalloped"?6:1,H=y/z,Z=(y+1)/z,le=Ye+(L-Ye)*(P+H)/Ke,ce=Ye+(L-Ye)*(P+Z)/Ke,j=ee=>fe+(_.valance==="scalloped"?Math.min(.06,Se*.3)*(1-Math.sin(ee*Math.PI)):0);Me([wt(t,le,fe+Se,.08+Re),wt(t,ce,fe+Se,.08+Re),wt(t,ce,j(Z),.08+Re),wt(t,le,j(H),.08+Re)],vt)}}let Xe=b(_.frameColour,b(_.colour,"awningFabric")),et=_.valance==="scalloped"?Math.min(.06,Se*.3):0,Qe=fe+et,He=Se-et;W(ot(t,O,Qe+He/2,_.width,He,.08+Re+.004),Xe,Qe,fe+Se,.08+Re+.004)}}else if(/^#[a-f0-9]{6}$/i.test(_.colour??"")){let W=u&&["cornice","masonry-band","sill"].includes(_.region),J=Ty(t,O,D,_.width,_.height,_.kind==="fascia"?_.signMount==="glazing"?.05:.025:_.region==="upper-wall"?.008:_.region==="ground-floor"?.014:_.region==="plinth"?.018:W?.026:.022);if(J.length){let fe=b(_.colour,"facadeTrimLight");if(Ae(J,fe),_.kind==="fascia"&&_.text?.trim()&&_.physicalSignId?.trim()){let Se=r.registration.imageToWall,we=_.bounds[0],Re=_.bounds[2],ie=(_.bounds[1]+_.bounds[3])/2,ue=Qe=>Se[6]*Qe+Se[7]*ie+Se[8],he=Qe=>(Se[0]*Qe+Se[1]*ie+Se[2])/ue(Qe),Me=he(Re)>he(we),Xe={left:O-_.width/2,right:O+_.width/2,bottom:D-_.height/2,top:D+_.height/2,sourceXForward:Me},et=l[l.length-1];et.sign={text:_.text.trim(),background:al[fe]??fe,colour:/^#[a-f0-9]{6}$/i.test(_.textColour??"")?_.textColour:"#f4f1e8",..._.signFont?.trim()?{font:_.signFont.trim()}:{},physicalSignId:_.physicalSignId.trim(),aspectRatio:_.width/_.height,uv:Qc(J,t,Xe)},et.signMapping=Xe}}}}return a||d.size?l.map(M=>{if(!a&&!d.has(M.featureId))return M;let T=Ey(M.triangles,t);return T.length?{...M,triangles:T,...M.sign&&M.signMapping?{sign:{...M.sign,uv:Qc(T,t,M.signMapping)}}:{},signMapping:void 0,...h.has(M.featureId)?{partialAtFace:!0}:{}}:null}).filter(M=>M!==null).map(M=>{let{signMapping:T,...v}=M;return v}):l.map(M=>{let{signMapping:T,...v}=M;return v})}function Hd(n,e,t,i){if(e.type!=="wall")return[];let r=Nr(e,n,i);if(!r||r.width<2.2||r.top-r.bottom<5)return[];let s=Number.isFinite(n.geometry.building.groundNAP)?Mi(n.geometry.building.groundNAP,n.geometry.frame.heightDatum):r.bottom,o=Math.min(r.top,s+42),a=o-s;if(a<5)return[];let l=Number(n.geometry.building.year),c=Number.isFinite(l)&&l<1940?3.45:3.15,u=Math.max(1,Math.min(10,Math.floor(a/c))),f=Number.isFinite(l)&&l<1940?2.45:3.05,h=Math.max(1,Math.min(14,Math.round(r.width/f))),d=r.width/h,m=Math.min(Number.isFinite(l)&&l<1940?1.18:1.48,d*.55),b=Math.min(Number.isFinite(l)&&l<1940?1.85:1.55,c*.58),g=[],p=[...n.id].reduce((R,I)=>R*31+I.charCodeAt(0),0)>>>0,M=Number.isFinite(l)&&l>=1970||p%11===0?"windowFrameDark":"windowFrame",T=p%3===0?"windowGlassBlue":p%3===1?"windowGlassWarm":"windowGlass",v=_y(n,i),C=[...n.id].reduce((R,I)=>R+I.charCodeAt(0),0)%h,S=t===v&&r.bottom<=s+.7,_=Number.isFinite(l)&&l<1965;for(let R=0;R<u;R++)for(let I=0;I<h;I++){if(S&&R===0&&I===C)continue;let N=(I+.5)*d,U=s+.55+(R+.5)*c;if(!tn(r,N,U,m+.16,b+.16)||!Ti(r,N,m+.16,n,i))continue;let F=`${n.id}:${t}:context-window:${R}:${I}`;g.push({triangles:Ws(r,N,U,m,b,.1,.05),colour:M,observationId:null,featureId:F,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"},{triangles:ot(r,N,U,m,b,.038),colour:T,observationId:null,featureId:F,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"},{triangles:ot(r,N,U+b*.12,m,.065,.058),colour:M,observationId:null,featureId:F,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"}),_&&g.push({triangles:ot(r,N,U,.055,b-.14,.058),colour:M,observationId:null,featureId:F,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"}),g.push({triangles:ot(r,N,U-b/2-.045,m+.28,.09,.07),colour:M,observationId:null,featureId:F,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"})}if(S){let R=(C+.5)*d,I=Math.min(1.15,d*.48),N=Math.min(2.45,c*.76),U=s+.12+N/2;if(tn(r,R,U,I+.2,N+.16)&&Ti(r,R,I+.2,n,i)){let F=`${n.id}:${t}:context-door`,O=(D,G)=>g.push({triangles:D,colour:G,observationId:null,featureId:F,featureKind:"contextual-door-prior",styleSource:"procedural-prior-not-measured"});if(O(ot(r,R,U,I+.2,N+.16,.036),M),O(ot(r,R,U,I,N,.05),"doorWood"),_){let D=Math.min(.42,N*.18),G=U+N/2-D/2-.1;O(ot(r,R,G,I-.18,D,.062),T),O(ot(r,R,G-D/2-.045,I,.09,.068),M)}O(ot(r,R,s+.1,I+.28,.1,.075),M)}}let x=r.width-.32,A=Number.isFinite(l)&&l>=1965?"facadeTrimDark":"facadeTrimLight",E=(R,I,N)=>{x<1.8||!tn(r,r.width/2,I,x,N)||!Ti(r,r.width/2,x,n,i)||g.push({triangles:ot(r,r.width/2,I,x,N,.072),colour:A,observationId:null,featureId:`${n.id}:${t}:context-trim:${R}`,featureKind:"contextual-trim-prior",styleSource:"procedural-prior-not-measured"})};return u>1&&E("street-datum",s+c,.12),Number.isFinite(l)&&l<1965&&E("facade-top",o-.18,.24),g}function Cy(n,e,t,i,r,s=!1,o=!1){if(e.type!=="wall")return[];let a=Nr(e,n,r);if(!a||a.top-a.bottom<2.5)return[];let l=new Map(i.map(d=>[d.id,d])),c=[],u=n.geometry.building.surfaces.filter(d=>d.type==="wall").flatMap(d=>d.rings[0].map(m=>m[1])),f=Number.isFinite(n.geometry.building.groundNAP)?Mi(n.geometry.building.groundNAP,n.geometry.frame.heightDatum):Math.min(...u),h=["upper","ground"].flatMap(d=>{let m=d==="upper"?"full":"ground",b=i.map(p=>{let M=p.facadeDescription?.sources?.[m],T=Xi(p,n,t,m),v=!T&&o?Gs(p,n,t,m):null,C=d==="upper"&&(!!Xi(p,n,t,"ground")||o&&!!Gs(p,n,t,"ground")),S=!!T||!!v||!M&&(d==="upper"?yy(p)||C:zd(p));return{...p,effectiveProposal:S?{wholeUsable:"unknown"}:null}}),g=Si(e,t,n.id,b);return g.intervals.map(p=>({field:d,interval:p,axis:g.axis}))});for(let{field:d,interval:m,axis:b}of h){if(!m.observation||m.status==="conflict")continue;let g=l.get(m.observation.id),p=Vs(a,b,m);if(!g||!p||p.width<1.5)continue;let M=(ne,ae,Ne,Ge)=>c.push({triangles:ne,colour:ae,observationId:g.id,featureId:Ne,featureKind:Ge,styleSource:"procedural-prior-not-measured"}),T=(ne,ae,Ne,Ge,Ae)=>{!tn(p,ne,ae,Ne+.18,Ge+.18)||!Ti(p,ne,Ne+.18,n,r)||(M(Ws(p,ne,ae,Ne,Ge,.09,.05),"windowFrame",Ae,"window-prior"),M(ot(p,ne,ae,Ne,Ge,.038),"windowGlass",Ae,"window-prior"),M(ot(p,ne,ae+Ge*.12,Ne,.065,.058),"windowFrame",Ae,"window-prior"),M(ot(p,ne,ae,.055,Ge-.14,.058),"windowFrame",Ae,"window-prior"))},v=d==="upper"?"full":"ground",C=Xi(g,n,t,v),S=!C&&o?Gs(g,n,t,v):null,_=C??S;if(_){let ne=g.facadeDescription?.extractionVersion==="source-facade-owner-candidate/v1",ae=g.facadeDescription?.sources?.full,Ne=g.facadeDescription?.sources?.ground,Ge=ne&&Number.isFinite(Date.parse(ae?.captureDate))&&Number.isFinite(Date.parse(Ne?.captureDate))&&Date.parse(Ne.captureDate)<Date.parse(ae.captureDate),Ae=Re=>Ge&&Re.kind==="window"&&Array.isArray(Re.bounds)&&Re.bounds[1]<=0,$=d==="upper"&&Xi(g,n,t,"ground"),W=d==="upper"&&!$&&o?Gs(g,n,t,"ground"):null,J=$??W,fe=J?(J.features??[]).filter(Re=>!Ae(Re)&&(!ne||Re.kind==="window"||Re.kind==="door")).map(Re=>Lr(Re,J,g)).filter(Boolean):[],we=Ry(n,a,p,g,_,r,Re=>{if(d==="ground"&&Ae(Re))return!1;if(!J||Re.region==="upper-wall"||g.facadeDescription?.extractionVersion==="source-facade-owner-candidate/v1"&&Re.kind==="material"&&["cornice","masonry-band","sill"].includes(Re.region))return!0;let ie=Lr(Re,_,g);return ie?!fe.some(ue=>Math.abs(ie.t-ue.t)<(ie.width+ue.width)/2&&Math.abs(ie.y-ue.y)<(ie.height+ue.height)/2):!1},o&&!!S);c.push(...S?we.map(Re=>({...Re,previewOnly:!0})):we);continue}let x=3.5,A=Math.max(1,Math.min(12,Math.ceil((p.top-f)/x))),E=Math.max(1,Math.min(16,Math.round(p.width/2.7))),R=p.width/E,I=Math.min(1.25,R*.53),N=Math.min(1.9,x*.56),U=`${n.id}:${t}:${g.id}`;if(d==="upper"){for(let ne=1;ne<A;ne++)for(let ae=0;ae<E;ae++)T((ae+.5)*R,f+(ne+.48)*x,I,N,`${U}:window:${ne}:${ae}`);continue}if(!zd(g)||p.bottom>f+1.5)continue;let F=Math.min(2.35,x*.66),O=f+.55+F/2;if(g.effectiveProposal.shopfront==="no"){let ne=R/2,ae=Math.min(1.1,R*.48),Ne=2.35,Ge=f+.12+Ne/2,Ae=tn(p,ne,Ge,ae+.18,Ne+.18)&&Ti(p,ne,ae+.18,n,r);if(Ae){let $=`${U}:entrance-prior`;M(Ws(p,ne,Ge,ae,Ne,.09,.065),"windowFrame",$,"contextual-door-prior"),M(ot(p,ne,Ge,ae,Ne,.038),"doorWood",$,"contextual-door-prior"),M(ot(p,ne,Ge+Ne/2-.25,ae-.12,.36,.052),"windowGlass",$,"contextual-door-prior")}for(let $=Ae?1:0;$<E;$++)T(($+.5)*R,O,I,Math.min(1.8,F),`${U}:window:0:${$}`);continue}let D=Math.min(p.width-.5,12),G=p.width/2;if(!tn(p,G,O,D+.16,F+.16)||!Ti(p,G,D+.16,n,r))continue;let K=`${U}:shop`;M(Ws(p,G,O,D,F,.08,.05),"windowFrame",K,"shopfront-prior"),M(ot(p,G,O,D,F,.038),"shopGlass",K,"shopfront-prior");let Q=Math.max(2,Math.ceil(D/1.7));for(let ne=1;ne<Q;ne++)M(ot(p,G-D/2+D*ne/Q,O,.065,F,.058),"windowFrame",K,"shopfront-prior");if(s&&Ld(g)){let ne=O+F/2+.3;if(!tn(p,G,ne,D,.2))continue;let ae=[wt(p,G-D/2,ne,.07),wt(p,G+D/2,ne,.07),wt(p,G+D/2,ne-.24,.8),wt(p,G-D/2,ne-.24,.8)];M([0,1,2,0,2,3].flatMap(Ne=>ae[Ne]),"awningFabric",`${U}:awning`,"reviewed-awning-prior")}}return c}function Py(n,e,t,i){let r=i.filter(o=>o.renderBuildingId===n.id&&o.renderSurfaceIndices?.includes(t));return r.length?Si(e,t,n.id,r.map(o=>({...o,effectiveProposal:{wholeUsable:"unknown"}}))).intervals.filter(o=>o.observation||o.status==="conflict").map(o=>[Math.min(o.startM,o.endM),Math.max(o.startM,o.endM)]).filter(([o,a])=>Number.isFinite(o)&&Number.isFinite(a)&&a>o):[]}function Wd(n,e,t,i){let r=o=>(o[0]-e.a[0])*e.u[0]+(o[2]-e.a[1])*e.u[1],s=[];for(let o=0;o<n.length;o++){let a=n[o],l=n[(o+1)%n.length],c=r(a),u=r(l),f=i?c>=t:c<=t,h=i?u>=t:u<=t;if(f&&s.push(a),f!==h){let d=(t-c)/(u-c);s.push(a.map((m,b)=>m+(l[b]-m)*d))}}return s}function Iy(n,e,t){if(!t.length)return n;let i=t.slice().sort((o,a)=>o[0]-a[0]),r=[],s=0;for(let[o,a]of i)o>s&&r.push([s,Math.min(e.width,o)]),s=Math.max(s,a);return s<e.width&&r.push([s,e.width]),n.flatMap(o=>{let a=[];for(let l=0;l<o.triangles.length;l+=9){let c=[0,1,2].map(u=>o.triangles.slice(l+u*3,l+u*3+3));for(let[u,f]of r){let h=Wd(Wd(c,e,u,!0),e,f,!1);for(let d=1;d<h.length-1;d++)a.push(...h[0],...h[d],...h[d+1])}}return a.length?[{...o,triangles:a}]:[]})}function Zd(n,e,t,i,r,s={}){let o=i.filter(d=>d.renderBuildingId===n.id&&d.renderSurfaceIndices?.includes(t)&&d.facadeDescription),a=s.procedural?i:o,l=Cy(n,e,t,s.observed===!1?a.filter(d=>!d.facadeDescription):a,r,s.reviewedAwnings,s.candidateRegistrationPreview===!0);if(!s.contextual)return l;let c=Nr(e,n,r),u=new Set(l.map(d=>d.observationId).filter(d=>typeof d=="string")),f=i.filter(d=>o.includes(d)||u.has(d.id));if(!f.length)return l.length?l:Hd(n,e,t,r);let h=c?Iy(Hd(n,e,t,r),c,Py(n,e,t,f)):[];return[...l,...h]}var Dy=128,Kd="Shop names are machine-read from dated panoramas \u2014 unreviewed",Ly=7.4,Fy=n=>!["rejected","uncertain","crop-repair"].includes(n?.review?.placement),Jd=(n,e)=>{let t=n?.images?.[e];return!!t&&/^[a-f0-9]{64}$/i.test(t.sha256??"")&&/^[a-f0-9]{64}$/i.test(t.panoramaSha256??"")},jd=n=>!Jd(n,"ground")||!["yes","no"].includes(n.effectiveProposal?.shopfront)?!1:n.review?.placement==="accepted"&&n.proposalSources?.shopfront==="human-review"?!0:n.visualReview?.fieldEligibility?.shopfront===!1?!1:n.visualReview?.fieldEligibility?.shopfront===!0||n.effectiveProposal?.groundUsable==="yes";function Ny(n){if(!n)return"missing-record";if(n.machineRevocation?.revoked)return"revoked-observation";if(!Fy(n))return"revoked-placement";if(!n.evidenceKey||!n.derivationKey)return"missing-source-identity";if(!Jd(n,"ground"))return"missing-current-ground-source";if(!n.images?.ground?.date&&!n.images?.ground?.capturedAt)return"missing-capture-date";if(n.effectiveProposal?.shopfront!=="yes")return"shopfront-not-positive";if(n.visualReview?.fieldEligibility?.shopfront===!1||n.visualReview?.fieldEligibility?.signText===!1)return"field-withheld";if(!jd(n))return"ground-source-not-supported";let e=n.machineRoutingProposal;if(!e)return"missing-machine-proposal";if(e.signTextEligible!=="yes")return"sign-text-not-eligible";let t=String(e.signText??"").trim();return t?/[\u0000-\u001f\u007f]/.test(t)?"control-character-sign-text":null:"empty-sign-text"}function Qd(n,e=28){let t=String(n??"").trim();return t.length<=e?t:`${t.slice(0,e-1)}\u2026`}function ef(n){return Ny(n)===null}function Uy(n,e){return Math.min(e-.3,Ly,Math.max(1.4,n.length*.24+.5))}var tf=(n,e,t,i)=>[n.a[0]+n.u[0]*e+n.n[0]*i,t,n.a[1]+n.u[1]*e+n.n[1]*i];function nf(n,e,t=1024,i="#25372e"){let r=n.canvas?.height||Dy;n.fillStyle=/^#[a-f0-9]{6}$/i.test(i)?i:"#25372e",n.fillRect(0,0,t,r),n.fillStyle="#e7e5d9",n.textAlign="center",n.textBaseline="middle";let s=r*.75;for(n.font=`700 ${s}px Arial`;n.measureText(e).width>t*.84&&s>r*.1875;)s-=1,n.font=`700 ${s}px Arial`;n.fillText(e,t/2,r*.53)}function Oy(n,e,t,i,r){if(!ef(n)||t.status==="conflict"||t.observation?.id!==n.id)return null;let s=Vs(e,i,t);if(!s||s.width<1.5||s.bottom>r+1.5)return null;let o=Math.min(2.35,3.5*.66),a=r+.55+o/2,l=a+o/2+.55/2+.05,c=Qd(String(n.machineRoutingProposal.signText).trim()),u=Uy(c,s.width),f=s.width/2;return tn(s,f,l,u,.55)?{observationId:n.id,text:c,displayText:c,localPosition:tf(s,f,l,.06),rotationY:Math.atan2(s.n[0],s.n[1]),width:u,height:.55,intervalWidth:s.width}:null}function rf(n,e,t,i,r){if(e.type!=="wall")return[];let s=Nr(e,n,r);if(!s||s.top-s.bottom<2.5)return[];let o=i.filter(h=>h.renderBuildingId===n.id&&h.renderSurfaceIndices?.includes(t)&&h.facadeDescription);if(o.length){let h=[];for(let d of o){let m=Xi(d,n,t,"ground");if(!m)continue;let b=Si(e,t,n.id,o.map(g=>({...g,effectiveProposal:{wholeUsable:"unknown"}})));for(let g of b.intervals){if(g.observation?.id!==d.id||g.status==="conflict")continue;let p=Vs(s,b.axis,g);if(!p)continue;let M=(p.a[0]-s.a[0])*s.u[0]+(p.a[1]-s.a[1])*s.u[1];for(let T of m.features){let v=Lr(T,m,d);!v||v.kind!=="fascia"||!v.text?.trim()||/[\u0000-\u001f\u007f]/.test(v.text)||!tn(p,v.t-M,v.y,v.width,v.height)||h.push({observationId:d.id,text:v.text.trim(),displayText:Qd(v.text),localPosition:tf(s,v.t,v.y,.09),rotationY:Math.atan2(s.n[0],s.n[1]),width:v.width,height:v.height,intervalWidth:p.width,physicalSignId:v.physicalSignId,colour:v.colour})}}}return h}let a=i.filter(h=>h.renderBuildingId===n.id&&ef(h)&&Array.isArray(h.renderSurfaceIndices)&&h.renderSurfaceIndices.includes(t));if(!a.length)return[];let l=n.geometry.building.surfaces.filter(h=>h.type==="wall").flatMap(h=>h.rings[0].map(d=>d[1])),c=Number.isFinite(n.geometry.building.groundNAP)?Mi(n.geometry.building.groundNAP,n.geometry.frame.heightDatum):Math.min(...l),u=i.map(h=>({...h,effectiveProposal:jd(h)?{wholeUsable:"unknown"}:null})),f=Si(e,t,n.id,u);return f.axis?a.flatMap(h=>f.intervals.map(d=>Oy(h,s,d,f.axis,c)).filter(Boolean)):[]}function sf(n,e){let t=new Map;for(let i of n){let r=e.find(l=>l.id===i.observationId);if(!r)continue;let s=String(i.text??r.machineRoutingProposal?.signText??"").trim().toLocaleLowerCase("en"),o=JSON.stringify([r.images?.ground?.panoramaSha256??r.renderBuildingId,s,r.images?.ground?.date??r.images?.ground?.capturedAt,i.physicalSignId??null]),a=t.get(o);(!a||i.width>a.width||i.width===a.width&&i.observationId<a.observationId)&&t.set(o,i)}return[...t.values()]}function of(n,e={}){if(!e.text?.trim())throw new Error("Source sign text is required");if(typeof document>"u")throw new Error("Facade sign material requires a browser canvas");let t=Math.min(e.width??512,512),i=Number.isFinite(e.aspectRatio)&&(e.aspectRatio??0)>0?e.aspectRatio:null,r=i?Math.max(8,Math.min(128,Math.round(t/i))):Math.min(e.height??128,128),s=document.createElement("canvas");s.width=t,s.height=r;let o=s.getContext("2d");if(!o)throw new Error("Unable to create sign canvas");o.fillStyle=e.background??"#242628",o.fillRect(0,0,t,r),o.fillStyle=e.colour??"#f3eee4";let a=e.font??`italic 700 ${Math.round(r*.45)}px Georgia, serif`,l=a.match(/(\d+(?:\.\d+)?)px/),c=Math.min(l?Number(l[1]):r*.45,r*.8),u=d=>l?a.replace(/\d+(?:\.\d+)?px/,`${Math.max(1,Math.round(d))}px`):`italic 700 ${Math.max(1,Math.round(d))}px Georgia, serif`;for(o.font=u(c);c>1&&o.measureText(e.text.trim()).width>t*.9;)c*=.9,o.font=u(c);o.textAlign="center",o.textBaseline="middle",o.fillText(e.text.trim(),t/2,r/2);let f=new n.CanvasTexture(s);return f.colorSpace=n.SRGBColorSpace??f.colorSpace,f.needsUpdate=!0,{material:new n.MeshBasicMaterial({map:f,transparent:!0,side:n.DoubleSide}),texture:f,canvas:s}}var Ys={priorBrickRed:"#a4523b",priorBrickBrown:"#84503a",priorBrickDark:"#6a3b2e",priorBrickBuff:"#c49a5c",priorPlaster:"#d3c3a0",priorModernLight:"#c2bdb2",priorModernGrey:"#7a8a94",priorCanalGreen:"#557260",roof:"#7c8080",priorRoofWarm:"#9a5e48",priorRoofDark:"#56606a",priorRoofGravel:"#a59e8f"};function cl(n,e){let t=2166136261;for(let i of n)t^=i.charCodeAt(0),t=Math.imul(t,16777619);return e[(t>>>0)%e.length]}function af(n,e){let t=Number(e),i=Number.isFinite(t)&&t<1925?cl(n,["priorBrickRed","priorBrickBrown","priorBrickDark","priorBrickBuff","priorPlaster","priorCanalGreen"]):Number.isFinite(t)&&t<1965?cl(n,["priorBrickRed","priorBrickBrown","priorBrickBuff","priorModernGrey"]):cl(n,["priorBrickBuff","priorModernLight","priorModernGrey","priorPlaster"]),r=cl(n,["roof","priorRoofWarm","priorRoofDark","priorRoofGravel"]),s=i;return{wallKey:i,roofKey:r,groundKey:s,wall:Ys[i],roof:Ys[r],ground:Ys[s]}}var By={wall:"#c4c1b5",...Ys,brown:"#876650",red:"#945c48",buff:"#bba681",grey:"#96938a",white:"#d8d4c3",black:"#57544e",auditedUsable:"#638774",auditedPartial:"#bd875b",...al};function ky(n,e,t){let i=e.previewAppearance;return!t||!n.geometryRevision.startsWith("candidate:")||i?.disposition!=="inferred-preview"||!/^#[a-f0-9]{6}$/i.test(i.colour)||!/^[a-f0-9]{64}$/.test(i.sourceCropSha256)?null:n.observations.some(s=>Object.values(s.payload?.facadeDescription?.sources??{}).some(o=>o.cropSha256===i.sourceCropSha256))?i.colour:null}function zy(n){if(!Number.isFinite(n))throw new Error("Invalid vertex normal");let e=Math.max(-1,Math.min(1,n));return e<=-1?-128:Math.round(e*127)}function Vy(n){let e=n.getAttribute?.("normal");if(!e)return;let t=new Int8Array(e.count*e.itemSize);for(let i=0;i<t.length;i++)t[i]=zy(e.array[i]);n.setAttribute("normal",new rs(t,e.itemSize,!0))}function Or(n){let e=n.map(c=>{if(!c.every(u=>u.length===3&&u.every(Number.isFinite)))throw new Error("Invalid source surface coordinate");return c.length>2&&c[0].every((u,f)=>Math.abs(u-c[c.length-1][f])<1e-8)?c.slice(0,-1):c.slice()});if(!e[0]||e[0].length<3)return[];if(e.slice(1).some(c=>c.length<3))throw new Error("Degenerate source hole");let t=e[0],i=new k;for(let c=0;c<t.length;c++){let u=t[c],f=t[(c+1)%t.length];i.x+=(u[1]-f[1])*(u[2]+f[2]),i.y+=(u[2]-f[2])*(u[0]+f[0]),i.z+=(u[0]-f[0])*(u[1]+f[1])}if(i.lengthSq()<1e-16)return[];let r=[Math.abs(i.x),Math.abs(i.y),Math.abs(i.z)],s=r.indexOf(Math.max(...r)),o=c=>new De(...c.filter((u,f)=>f!==s)),a=e.flat();return zi.triangulateShape(e[0].map(o),e.slice(1).map(c=>c.map(o))).flatMap(c=>{let[u,f,h]=c.map(m=>new k(...a[m]));return(f.sub(u).cross(h.sub(u)).dot(i)>=0?c:[c[0],c[2],c[1]]).flatMap(m=>a[m])})}function lf(n){let e=n.geometry.building,t=e.surfaces.flatMap(a=>a.rings.flatMap(l=>l.map(c=>c[1]))),i=t.length?Math.min(...t):Mi(e.groundNAP??.65,n.geometry.frame.heightDatum),r=t.length?Math.max(...t):i+(e.height??5),s=e.footprint.type==="Polygon"?[e.footprint.coordinates]:e.footprint.coordinates,o=[];for(let a of s){let l=a.map((c,u)=>{let f=c.slice(0,-1).reduce((h,d,m)=>h+d[0]*c[m+1][1]-c[m+1][0]*d[1],0);return(u===0?f>0:f<0)?[...c].reverse():c});o.push({type:"roof",rings:l.map(c=>c.map(([u,f])=>[u,r,f]))});for(let c of l)for(let u=0;u<c.length-1;u++){let f=c[u],h=c[u+1];o.push({type:"wall",rings:[[[f[0],i,f[1]],[h[0],i,h[1]],[h[0],r,h[1]],[f[0],r,f[1]]]]})}}return o}function Ur(n,e,t){let i=e.geometry.frame.originRD,r=t.targetOriginRD,s=ol(0,e.geometry.frame.heightDatum,t.targetOffsetNAP??0);return n.map((o,a)=>a%3===0?o+i.x-r.x:a%3===1?o+s:o+r.y-i.y)}function Gy(n,e,t){let i=e.geometry.frame.originRD,r=t.targetOriginRD,s=ol(0,e.geometry.frame.heightDatum,t.targetOffsetNAP??0);return[n[0]+i.x-r.x,n[1]+s,n[2]+r.y-i.y]}var Hy=new Vi(1,1);function Wy(n,e,t){let i=document.createElement("canvas");i.width=Math.min(512,Math.ceil(64*n.width/n.height)),i.height=64,nf(i.getContext("2d"),n.displayText,i.width,n.colour);let r=new vr(i);r.colorSpace=Ot,r.generateMipmaps=!1,r.minFilter=Dt;let s=new Kn({map:r,side:bn}),o=new yt(Hy,s);return o.scale.set(n.width,n.height,1),o.position.set(...Gy(n.localPosition,e,t)),o.rotation.y=n.rotationY,o.userData.machineSign=!0,o.userData.observationId=n.observationId,o.userData.featureKind="machine-sign-unreviewed",o.name="city-appearance-machine-sign",o}function cf(n){n.material?.map?.dispose?.(),n.material?.dispose?.()}function Xy(n){return n.flatMap(e=>e.observations.filter(t=>t.buildingId===e.id&&t.geometryRevision===e.geometryRevision&&t.evidenceKey&&t.payload?.evidenceKey===t.evidenceKey&&t.payload?.renderBuildingId===e.id&&t.payload?.effectiveProposal?.wholeUsable==="yes"&&t.payload?.visualReview?.fieldEligibility?.wallColour!==!1).map(t=>t.payload))}function qy(n){return n.flatMap(e=>e.observations.filter(t=>t.buildingId===e.id&&t.geometryRevision===e.geometryRevision&&t.evidenceKey&&t.payload?.evidenceKey===t.evidenceKey&&t.payload?.renderBuildingId===e.id&&["usable","partial"].includes(t.payload?.agentSourceAudit?.disposition)).map(t=>t.payload))}function uf(n,e){let t=af(n.id,n.geometry.building.year);return e==="roof"?t.roofKey:t.wallKey}function hf(n){if(![n.targetOriginRD.x,n.targetOriginRD.y,n.targetOffsetNAP??0].every(Number.isFinite))throw new Error("Invalid target RD/NAP origin");return e=>{let t=new Set;for(let E of e){let R=E.geometry?.frame;if(t.has(E.id)||E.geometry?.building?.id!==E.id||!R||R.axes!=="x=east,y=up,z=south"||!["legacy-block-NAP-minus-0.65m","NAP"].includes(R.heightDatum)||![R.originRD.x,R.originRD.y].every(Number.isFinite))throw new Error(`Unsupported or duplicate source frame: ${E.id}`);t.add(E.id)}let i=new $t;i.name="city-appearance-owned-tile",i.userData.buildingIds=[...t],i.userData.experimentalWallColours=n.experimentalWallColours===!0,i.userData.proceduralFacades=n.proceduralFacades===!0,i.userData.facadeStyleSource="Registered source features retain per-feature evidence disposition; legacy and contextual rhythms remain explicit procedural priors.";let r=new Map,s=new Map(e.map(E=>[E.id,"facade"])),o=new Map,a=new Map,l=n.experimentalWallColours?Xy(e):n.auditCoverage?qy(e):[],c=n.proceduralFacades||n.observedFacades!==!1?ll(e):[],u=n.machineSigns===!0?ll(e):[],f=new $t;f.name="city-appearance-machine-signs";let h=[],d=n.machineSigns===!0,m=!1,b=!1,g=(E,R,I=!1,N=null)=>({buildingId:E.id,geometryRevision:E.geometryRevision,sourceSurfaceIndex:R,observationId:N,approximateMassing:I});for(let E of e){let R=!E.geometry.building.surfaces.length,I=R?lf(E):E.geometry.building.surfaces,N=[],U=[];I.forEach((D,G)=>{let K=Or(D.rings),Q=ky(E,D,n.candidateRegistrationPreview===!0),ne=Q??(n.contextualPalette?uf(E,D.type):D.type==="roof"?"roof":"wall"),ae={triangles:Ur(K,E,n),colour:ne,identity:{...g(E,R?null:G,R),...Q?{previewOnly:!0,styleSource:"inferred-source-component-preview"}:{}}};N.push(ae);let Ne=!R&&D.type==="wall"&&(n.experimentalWallColours||n.auditCoverage)?Si(D,G,E.id,l):null;if(!Ne?.axis){U.push(ae);return}for(let Ge of Ne.intervals){let Ae=Ge.observation?.effectiveProposal?.wallColour,$=Ge.observation?.agentSourceAudit?.disposition,W=n.auditCoverage&&$==="usable"?"auditedUsable":n.auditCoverage&&$==="partial"?"auditedPartial":["brown","red","buff","grey","white","black"].includes(Ae)?Ae:null;U.push({triangles:Ur(Id(K,Ne.axis,Ge.startM,Ge.endM),E,n),colour:W??ne,identity:g(E,G,!1,W?Ge.observation.id:null)})}});let F=n.experimentalWallColours||n.auditCoverage?U.slice():N.slice();a.set(E.id,N.flatMap(D=>D.triangles)),(n.proceduralFacades||n.contextualFacades||n.observedFacades!==!1)&&!R&&I.forEach((D,G)=>{let K=Zd(E,D,G,c,e,{procedural:n.proceduralFacades,contextual:n.contextualFacades,reviewedAwnings:n.reviewedAwnings,observed:n.observedFacades,candidateRegistrationPreview:n.candidateRegistrationPreview===!0});for(let Q of K){let ne=Q.sign,ae=ne&&ne.text&&ne.physicalSignId&&Array.isArray(ne.uv)?{sign:ne}:{};Q.featureKind.startsWith("observed-")&&(Q.featureKind==="observed-material"||Q.featureKind==="observed-awning"&&!ne||Q.colour==="doorWood"||Q.colour==="windowGlass")&&F.push({triangles:Ur(Q.triangles,E,n),colour:Q.colour,identity:{...g(E,G,!1,Q.observationId),featureId:Q.featureId,featureKind:Q.featureKind,styleSource:Q.styleSource}}),U.push({triangles:Ur(Q.triangles,E,n),colour:Q.colour,material:Q.material,...ae,identity:{...g(E,G,!1,Q.observationId),featureId:Q.featureId,featureKind:Q.featureKind,styleSource:Q.styleSource,...Q.previewOnly?{previewOnly:!0}:{}}}),ae.sign&&F.push({triangles:Ur(Q.triangles,E,n),colour:Q.colour,sign:ae.sign,identity:{...g(E,G,!1,Q.observationId),featureId:Q.featureId,featureKind:Q.featureKind,styleSource:Q.styleSource}})}}),u.length&&!R&&I.forEach((D,G)=>{for(let K of rf(E,D,G,u,e))h.push({owner:E,placement:K})});let O=lf(E).map(D=>({triangles:Ur(Or(D.rings),E,n),colour:n.contextualPalette?uf(E,D.type):D.type==="roof"?"roof":"wall",identity:g(E,null,!0)}));o.set(E.id,{facade:F,detail:U,massing:O})}let p=sf(h.map(E=>({...E.placement,item:E})),u);h.splice(0,h.length,...p.map(E=>E.item));let M=new Kn({color:"#f2c14e",transparent:!0,opacity:.24,depthWrite:!1,side:Ct,polygonOffset:!0,polygonOffsetFactor:-2}),T=new Map,v=null,C=null;function S(){let E=new Map(h.map((R,I)=>[String(I),R]).filter(([,R])=>d&&!m&&s.get(R.owner.id)==="detail"));for(let R of[...f.children]){let I=R.userData.placementKey;if(E.has(I)){E.delete(I);continue}f.remove(R),cf(R)}for(let[R,{owner:I,placement:N}]of E){let U=Wy(N,I,n);U.userData.placementKey=R,f.add(U)}}n.machineSigns===!0&&(i.add(f),f.visible=d,S());function _(){C&&(i.remove(C),C.geometry.dispose(),C=null);let E=v?a.get(v):null;if(!E?.length||m)return;let R=new Rt;R.setAttribute("position",new ct(E,3)),R.computeBoundingBox(),R.computeBoundingSphere(),C=new yt(R,M),C.name="city-appearance-selection",C.renderOrder=6,C.userData.runtimeSelection=!0,C.raycast=()=>{},i.add(C)}function x(){if(b=!1,m)return;let E=new Map,R=new Map;for(let N of e)for(let U of o.get(N.id)[s.get(N.id)]){if(!U.triangles.length)continue;if(U.sign){let D=`${U.sign.physicalSignId}:${U.sign.text}:${U.sign.background}:${U.sign.colour}:${U.sign.font??""}`,G=R.get(D)??{descriptor:U.sign,positions:[],uvs:[],identities:[]};G.positions.push(...U.triangles),G.uvs.push(...U.sign.uv);for(let K=0;K<U.triangles.length/9;K++)G.identities.push(U.identity);R.set(D,G);continue}let F=`${U.material??"flat"}:${U.colour}`,O=E.get(F)??{colour:U.colour,material:U.material,positions:[],identities:[]};for(let D of U.triangles)O.positions.push(D);for(let D=0;D<U.triangles.length/9;D++)O.identities.push(U.identity);E.set(F,O)}let I=[];for(let[N,U]of E){let F=U.colour;if(!r.has(N)){let G=F.startsWith("#")?F:By[F];r.set(N,U.material==="brick"?Cd({MeshStandardMaterial:Sn,DoubleSide:Ct},G):new Sn({color:G,roughness:.9,side:Ct}))}let O=new Rt;O.setAttribute("position",new ct(U.positions,3)),O.computeVertexNormals(),Vy(O),O.computeBoundingBox(),O.computeBoundingSphere();let D=new yt(O,r.get(N));D.name=`city-appearance-${F}`,D.userData.triangleIdentities=U.identities,D.castShadow=n.castShadows!==!1,D.receiveShadow=!1,I.push(D)}for(let[N,U]of R){let F=T.get(N);F||(F=of({CanvasTexture:vr,MeshBasicMaterial:Kn,DoubleSide:Ct,SRGBColorSpace:Ot},U.descriptor),T.set(N,F));let O=new Rt;O.setAttribute("position",new ct(U.positions,3)),O.setAttribute("uv",new ct(U.uvs,2));let D=new yt(O,F.material);D.name=`city-appearance-source-sign-${U.descriptor.physicalSignId}`,D.userData.triangleIdentities=U.identities,D.userData.sourceSign=!0,I.push(D)}for(let N of[...i.children])N!==C&&N!==f&&N.geometry&&(i.remove(N),N.geometry.dispose(),N.userData.sourceSign);for(let N of I)i.add(N);for(let[N,U]of T)R.has(N)||(U.material.dispose(),U.texture.dispose(),T.delete(N));_(),S()}let A={group:i,flush:x,setSelected(E){if(!m){if(E!==null&&!t.has(E)){v=null,_();return}v!==E&&(v=E,_())}},setLod(E,R){if(!m){if(!t.has(E)||!["massing","facade","detail"].includes(R))throw new Error(`Unknown building or LOD: ${E}`);s.get(E)!==R&&(s.set(E,R),b||(b=!0,queueMicrotask(()=>{b&&x()})))}},setMachineSignsVisible(E){m||d===E||(d=E,E&&!f.parent&&(i.add(f),S()),f.visible=E,S())},pick(E,R){return m||!i.children.includes(E)||!Number.isInteger(R)||R<0?null:E.userData.triangleIdentities?.[R]??null},get stats(){let E=new Map,R=new Set;for(let G of i.children)for(let K of G.userData.triangleIdentities??[])K.featureId&&K.featureKind&&E.set(K.featureId,K.featureKind),K.featureKind==="shopfront-prior"&&K.observationId&&R.add(K.observationId);let I=G=>[...E.values()].filter(K=>K===G).length,N=i.children.flatMap(G=>G===f&&f.parent?G.children:[G]).filter(G=>G.isMesh&&!G.userData.runtimeSelection),U=new Set,F=new Set;for(let G of N){for(let K of Object.values(G.geometry.attributes)){let Q=K.array??K.data?.array;Q?.buffer&&U.add(Q.buffer)}G.geometry.index?.array?.buffer&&U.add(G.geometry.index.array.buffer);for(let K of Array.isArray(G.material)?G.material:[G.material])for(let Q of Object.values(K??{}))Q?.isTexture&&F.add(Q)}let O=[...U].reduce((G,K)=>G+K.byteLength,0),D=[...F].reduce((G,K)=>{let Q=K.image;return G+Math.ceil((Q?.width??0)*(Q?.height??0)*4*(K.generateMipmaps?4/3:1))},0);return{geometryBufferBytes:O,textureBytes:D,buildings:t.size,meshes:N.length,triangles:N.reduce((G,K)=>G+K.geometry.getAttribute("position").count/3,0),windows:I("window-prior")+I("contextual-window-prior")+I("observed-window"),doors:I("contextual-door-prior")+I("observed-door"),storefronts:R.size,storefrontPatches:I("shopfront-prior"),awnings:I("reviewed-awning-prior")+I("observed-awning"),signs:I("observed-sign"),machineSigns:f.children.length,disposed:m}},dispose(){if(!m){m=!0,n.parent.remove(i);for(let E of[...f.children])f.remove(E),cf(E);for(let E of[...i.children])i.remove(E),E!==f&&E.geometry&&E.geometry.dispose();for(let E of r.values())E.dispose();for(let{material:E,texture:R}of T.values())R.dispose(),E.dispose();C=null,M.dispose(),r.clear(),o.clear(),a.clear(),s.clear()}}};return x(),n.parent.add(i),A}}var Yy="inventory-crown-priors/v1",qi=n=>"https://www.vdberk.com/trees/"+n+"/",$y=[[/^platanus (?:hispanica|acerifolia) 'tremonia'$/,"pyramidal","cultivar-prior",qi("platanus-hispanica-tremonia")],[/^platanus (?:hispanica|acerifolia)$/,"rounded","species-prior",qi("platanus-hispanica")],[/^ulmus 'new horizon'$/,"pyramidal","cultivar-prior",qi("ulmus-new-horizon")],[/^ulmus 'dodoens'$/,"pyramidal","cultivar-prior","https://www.vdberk.nl/bomen/Ulmus-Dodoens/"],[/^ulmus hollandica 'vegeta'$/,"pyramidal","cultivar-prior",qi("ulmus-hollandica-vegeta")],[/^ulmus 'clusius'$/,"upright-oval","cultivar-prior",qi("ulmus-clusius")],[/^ulmus glabra$/,"upright-oval","species-prior",qi("ulmus-glabra")],[/^ginkgo biloba$/,"upright-oval","species-prior","https://www.rhs.org.uk/plants/7990/ginkgo-biloba/details"],[/^(?:cupressocyparis|cuprocyparis|cupressus) leylandii$/,"conical-evergreen","species-prior","https://www.rhs.org.uk/plants/321515/cupressus-%C3%97-leylandii/details"],[/^prunus serrulata 'kanzan'$/,"vase","cultivar-prior",qi("prunus-serrulata-kanzan")]];function Zy(n){return String(n||"").toLowerCase().replace(/[’‘`]/g,"'").replace(/×/g," ").replace(/\bx\s+/g,"").replace(/\s+/g," ").trim()}function Ky(n){let e=2166136261;for(let t of String(n??""))e=Math.imul(e^t.charCodeAt(0),16777619);return(e>>>0)/4294967296}function df(n){let e=String(n.type||"").trim().toLowerCase();if(e==="stobbe")return null;let t=Zy(n.species),i=$y.find(([g])=>g.test(t)),r=e==="gekandelaberde boom",s=r?"candelabra-pruned":i?.[1]||"rounded",o=Number.isFinite(n.height)&&n.height>0&&n.height<=60,a=o?n.height:9,l=/\d/.test(String(n.heightClass||"")),c=o&&l?"inventory-height-class-proxy":"authored-height-fallback",u=a,f=Math.max(1.3,u*.22),h=.96+Ky(n.id)*.04,d=f*h,m=(g,p,M,T,v,C,S)=>({offset:[g,p,M],scale:[T,v,C],tone:S}),b;return s==="pyramidal"?b=[m(0,u*.65,0,d*.84,u*.19,d*.78,2),m(0,u*.8,0,d*.62,u*.16,d*.59,0),m(0,u*.9,0,d*.34,u*.1,d*.34,1)]:s==="upright-oval"?b=[m(0,u*.73,0,d*.8,u*.27,d*.72,0),m(-d*.28,u*.68,d*.14,d*.51,u*.22,d*.48,1),m(d*.25,u*.65,-d*.12,d*.5,u*.23,d*.48,2)]:s==="conical-evergreen"?b=[m(0,u*.55,0,d*.7,u*.24,d*.7,2),m(0,u*.74,0,d*.49,u*.19,d*.49,0),m(0,u*.9,0,d*.25,u*.1,d*.25,1)]:s==="vase"?b=[m(0,u*.65,0,d*.6,u*.19,d*.58,2),m(-d*.4,u*.84,0,d*.7,u*.16,d*.75,0),m(d*.4,u*.84,0,d*.7,u*.16,d*.75,1)]:s==="candelabra-pruned"?b=[m(0,u*.85,0,d*.43,u*.15,d*.5,0),m(-d*.5,u*.82,0,d*.36,u*.14,d*.4,1),m(d*.5,u*.82,0,d*.36,u*.14,d*.4,2)]:b=[m(0,u*.76,0,d,u*.24,d*.88,0),m(-d*.48,u*.72,d*.25,d*.65,u*.18,d*.67,1),m(d*.44,u*.7,-d*.23,d*.66,u*.22,d*.65,2)],{version:Yy,id:n.id,position:[...n.position],height:a,archetype:s,lobes:b,trunkHeight:u*(r?.78:.6),trunkWidth:.35,provenance:{position:"municipal inventory",height:c,heightClass:n.heightClass??null,crownBasis:r?"explicit-inventory-management":i?.[2]||"authored-fallback",reference:r?null:i?.[3]||null,species:n.species??null,type:n.type??null,measuredCrown:!1,note:"Shape, width, clearance and summer foliage are authored priors. Not freely growing does not imply pollarding; age, pruning and actual crown extent are unverified."}}}function nu(n,e={}){if(!Array.isArray(n.bounds)||n.bounds.length!==4||!n.bounds.every(Number.isFinite))throw Error("Missing area display bounds");let t=new $t,i=new Map,r=new Map,s=S=>(i.has(S)||i.set(S,S==="#709d98"?new _s({color:S,roughness:.24,metalness:.04,clearcoat:.72,clearcoatRoughness:.2,side:Ct}):new Sn({color:S,roughness:.95,side:Ct})),i.get(S)),o=(S,_)=>{let x=r.get(S)||[];for(let A of _)x.push(A);r.set(S,x)},a=(S,_,x)=>{let A=S.geometry;if(!(!A||!["MultiPolygon","Polygon"].includes(A.type)))for(let E of A.type==="Polygon"?[A.coordinates]:A.coordinates)o(x,Or(E.map(R=>R.map(I=>[I[0],_,I[1]]))))},l=0,c=0,u=S=>{let _=S.geometry;if(!_||!["LineString","MultiLineString"].includes(_.type))return;c++;let x=_.type==="LineString"?[_.coordinates]:_.coordinates;for(let A of x)for(let E=1;E<A.length;E++){let R=A[E-1],I=A[E];o("#817a6b",[R[0],.02,R[1],I[0],.02,I[1],I[0],.55,I[1],R[0],.02,R[1],I[0],.55,I[1],R[0],.55,R[1]])}},f=S=>{let _=S.geometry;if(!(!_||!["MultiPolygon","Polygon"].includes(_.type))){l++;for(let x of _.type==="Polygon"?[_.coordinates]:_.coordinates){o("#bcbdb0",Or(x.map(A=>A.map(E=>[E[0],.12,E[1]]))));for(let A of x)for(let E=1;E<A.length;E++){let R=A[E-1],I=A[E];o("#8f9188",[R[0],.12,R[1],I[0],.12,I[1],I[0],-.18,I[1],R[0],.12,R[1],I[0],-.18,I[1],R[0],-.18,R[1]])}}}},[h,d,m,b]=n.bounds;e.includeBase!==!1&&o("#d5d4c6",Or([[[h,-.6,d],[h,-.6,b],[m,-.6,b],[m,-.6,d]]]));for(let S of n.layers?.onbegroeidterreindeel||[])a(S,-.35,S.kind==="erf"?"#c4c7b1":"#d5d3c2");for(let S of n.layers?.begroeidterreindeel||[])a(S,-.25,"#a5b68d");for(let S of n.layers?.waterdeel||[])a(S,-.2,"#709d98");for(let S of n.layers?.overbruggingsdeel||[])f(S);for(let S of n.layers?.scheiding_lijn||[])["kademuur","walbescherming"].includes(S.kind)&&u(S);for(let S of[...n.layers?.ondersteunendwegdeel||[],...n.layers?.wegdeel||[]]){let _=/voet/.test(S.kind),x=S.kind==="fietspad";a(S,_?.14:.06,_?"#d1cbbb":x?"#aa7c66":S.surface==="open verharding"?"#ab9780":"#9a9f95")}for(let[S,_]of r){if(!_.length)continue;let x=new Rt;x.setAttribute("position",new ct(_,3)),x.computeVertexNormals();let A=new yt(x,s(S));A.receiveShadow=!0,t.add(A)}let g=[],p=[[],[],[]],M=new kt,T=0;for(let S of n.trees||[]){let _=df(S);if(_){T++,g.push({position:[_.position[0],_.trunkHeight/2+.1,_.position[1]],scale:[_.trunkWidth,_.trunkHeight,_.trunkWidth]});for(let x of _.lobes)p[x.tone].push({position:[_.position[0]+x.offset[0],x.offset[1]+.1,_.position[1]+x.offset[2]],scale:x.scale})}}function v(S,_,x){if(!S.length){_.dispose();return}let A=new cs(_,s(x),S.length);S.forEach((E,R)=>{M.position.set(...E.position),M.scale.set(...E.scale),M.updateMatrix(),A.setMatrixAt(R,M.matrix)}),A.instanceMatrix.needsUpdate=!0,A.castShadow=!0,t.add(A)}v(g,new ds(.5,.5,1,6),"#827c61");for(let S=0;S<3;S++)v(p[S],new gs(1,1),["#9dab78","#acb989","#899b68"][S]);let C=!1;return{group:t,stats:{trees:T,bridges:l,boundaries:c,meshes:t.children.length},dispose(){if(!C){C=!0,t.removeFromParent();for(let S of[...t.children])S.isInstancedMesh&&S.dispose(),S.geometry.dispose(),t.remove(S);for(let S of i.values())S.dispose();i.clear()}}}}var ul={x:155e3,y:463e3},ff=52.1551744,pf=5.38720621,Jy=[[0,1,3235.65389],[2,0,-32.58297],[0,2,-.2475],[2,1,-.84978],[0,3,-.0655],[2,2,-.01709],[1,0,-.00738],[4,0,.0053],[2,3,-39e-5],[4,1,33e-5],[1,1,-12e-5]],jy=[[1,0,5260.52916],[1,1,105.94684],[1,2,2.45656],[3,0,-.81885],[1,3,.05594],[3,1,-.05607],[0,1,.01199],[3,2,-.00256],[1,4,.00128],[0,2,22e-5],[2,0,-22e-5],[3,4,26e-5]],Qy=[[0,1,190094.945],[1,1,-11832.228],[2,1,-114.221],[0,3,-32.391],[1,0,-.705],[3,1,-2.34],[1,3,-.608],[0,2,-.008],[2,3,.148]],ev=[[1,0,309056.544],[0,2,3638.893],[2,0,73.077],[1,2,-157.984],[3,0,59.788],[0,1,.433],[2,2,-6.439],[1,1,-.032],[0,4,.092],[1,4,-.054]],hl={east:.183,north:.234},iu=111320,mf=n=>iu*Math.cos(n*Math.PI/180),dl=(n,e,t)=>n.reduce((i,[r,s,o])=>i+o*e**r*t**s,0);function $s({x:n,y:e}){let t=(n-ul.x)*1e-5,i=(e-ul.y)*1e-5,r=ff+dl(Jy,t,i)/3600-hl.north/iu;return[pf+dl(jy,t,i)/3600-hl.east/mf(r),r]}function ru([n,e]){let t=e+hl.north/iu,i=n+hl.east/mf(t),r=.36*(t-ff),s=.36*(i-pf);return{x:ul.x+dl(Qy,r,s),y:ul.y+dl(ev,r,s)}}var su=(n,e)=>n[0]*e[1]-n[1]*e[0],gf=(n,e)=>[n[0]-e[0],n[1]-e[1]],xf=n=>n?.type==="MultiPolygon"?n.coordinates:n?.type==="Polygon"?[n.coordinates]:[];function _f(n,e){let t=!1;for(let i=0,r=e.length-1;i<e.length;r=i++){let s=e[i],o=e[r];s[1]>n[1]!=o[1]>n[1]&&n[0]<(o[0]-s[0])*(n[1]-s[1])/(o[1]-s[1])+s[0]&&(t=!t)}return t}function tv(n,e){return xf(e.footprint).some(t=>_f(n,t[0])&&!t.slice(1).some(i=>_f(n,i)))}function nv(n,e,t,i,{sourceBuildingId:r,sourceBoundaryToleranceM:s=0}={}){let o=null;for(let a of t){let l=[0,i];for(let c of xf(a.footprint).flat())for(let u=0;u<c.length;u++){let f=c[u],h=c[(u+1)%c.length],d=gf(h,f),m=gf(f,n),b=su(e,d);if(Math.abs(b)<1e-9)continue;let g=su(m,d)/b,p=su(m,e)/b;g>0&&g<i&&p>=-1e-8&&p<=1+1e-8&&l.push(g)}l.sort((c,u)=>c-u);for(let c=1;c<l.length;c++){if(l[c]-l[c-1]<1e-7||a.id===r&&l[c-1]<1e-7&&l[c]<=s)continue;let u=(l[c]+l[c-1])/2,f=[n[0]+e[0]*u,n[1]+e[1]*u];if(tv(f,a)&&(!o||l[c-1]<o.distanceM)){o={buildingId:a.id,distanceM:l[c-1]};break}}}return o}function fl(n,e,t,i=95){if(!Number.isFinite(e)||e<=0||!Number.isFinite(t)||t<=0)throw Error("Positive camera aspect and radius required");let r=2*Math.atan(Math.max(n.height*.65,n.wallWidthM*.65/e)/t)*180/Math.PI;return{fov:Math.min(i,Math.max(38,r)),wholeFacadeFits:r<=i}}function yf(n,e,t,{desiredRadius:i=21,clearanceM:r=1.5,maxFov:s=95}={}){if(!Number.isFinite(t)||t<=0)throw Error("Positive camera aspect required");let o=Math.hypot(...n.normal);if(!o)throw Error("Nonzero frontage normal required");let a=n.normal.map(b=>b/o),l=1.4,c=[n.mid[0],Math.min(12,n.height*.5),n.mid[1]],u=i*Math.sin(l),f=nv(n.mid,a,e,u+r,{sourceBuildingId:n.buildingId,sourceBoundaryToleranceM:.25}),h=f?Math.min(u,Math.max(0,f.distanceM-r)):u;if(h<.8)return{version:1,usable:!1,reason:"No clear outward camera position on this wall normal",obstruction:f,target:c};let d=h/Math.sin(l),m=fl(n,t,d,s);return{version:1,usable:!0,target:c,radius:d,theta:Math.atan2(a[0],a[1]),phi:l,...m,position:[c[0]+a[0]*h,c[1]+d*Math.cos(l),c[2]+a[1]*h],constrained:d<i-1e-6,obstruction:f,clearanceM:r,scope:"Initial source-wall framing; conservative footprint geometry only. Trees, overhangs and manual orbit are not collision-tested."}}function vf(n,e,{marginM:t=2,maxExtensionM:i=10}={}){let r=[...n],s=a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite);for(let a of e)for(let l of[a.localStart,a.localEnd])s(l)&&(r[0]=Math.min(r[0],Math.floor(l[0]-t)),r[1]=Math.min(r[1],Math.floor(l[1]-t)),r[2]=Math.max(r[2],Math.ceil(l[0]+t)),r[3]=Math.max(r[3],Math.ceil(l[1]+t)));r[0]=Math.max(r[0],n[0]-i),r[1]=Math.max(r[1],n[1]-i),r[2]=Math.min(r[2],n[2]+i),r[3]=Math.min(r[3],n[3]+i);let o=e.filter(a=>[a.localStart,a.localEnd].some(l=>!s(l)||l[0]<r[0]||l[0]>r[2]||l[1]<r[1]||l[1]>r[3])).map(a=>a.id);return{sourceBounds:[...n],bounds:r,marginM:t,maxExtensionM:i,clippedFrontageIds:o,source:"display-only existing-frontage coverage; no new data acquisition"}}var oe=n=>document.getElementById(n),Vn=new URLSearchParams(location.search),Tt=Vn.get("area")==="expansion",Zs=Vn.get("release");if(Zs&&!/^[a-f0-9]{64}$/.test(Zs))throw Error("Invalid immutable release ID");var iv=Zs?`/data/${Tt?"city-expansion":"city-appearance"}/releases/${Zs}/manifest.json`:Tt?"/data/city-expansion/current.json":"/data/city-appearance/current.json",jt=n=>oe(n).checked,Ks=oe("scene"),Js=oe("stage"),nn=new is;nn.background=new qe("#e9e9df");nn.fog=new ns("#e9e9df",260,850);var It=new Ja({canvas:Ks,antialias:!0,powerPreference:"high-performance"}),rv=Math.min(devicePixelRatio,1.5),Br=rv,hu=0,ou=[],au=0;It.setPixelRatio(Br);It.outputColorSpace=Ot;It.shadowMap.enabled=!0;It.shadowMap.type=ia;It.toneMapping=As;It.toneMappingExposure=1.05;nn.add(new bs("#fbfff5","#87948b",1.75));var Rn=new Ss("#fff0d8",3);Rn.position.set(-130,240,90);Rn.castShadow=!0;Rn.shadow.mapSize.set(2048,2048);Rn.shadow.camera.left=-340;Rn.shadow.camera.right=340;Rn.shadow.camera.top=340;Rn.shadow.camera.bottom=-340;Rn.shadow.camera.near=40;Rn.shadow.camera.far=650;Rn.shadow.bias=-15e-5;nn.add(Rn);var We=new Wt(38,1,.2,9e3),Ze=new tl(We,Ks);Ze.enableDamping=!0;Ze.dampingFactor=.09;Ze.minDistance=.8;Ze.maxDistance=6e3;Ze.maxPolarAngle=Math.PI*.49;Ze.target.set(0,5,-8);We.position.set(160,210,230);Ze.update();function kr(n){zr=n,oe("navigation-orbit")?.setAttribute("aria-pressed",String(n==="orbit")),oe("navigation-explore")?.setAttribute("aria-pressed",String(n==="explore")),Ze.enableRotate=n==="orbit"||n==="explore",Ze.enablePan=n==="explore"}function Tf(n,e){document.querySelectorAll(`button[data-${n}]`).forEach(t=>t.setAttribute("aria-pressed",String(t.dataset[n]===e)))}var mu="ground",yl="ground";function Ef(n){mu=n,Tf("source-tier",n)}function gu(n){yl=n,Tf("camera-preset",n);let e=En?$i().find(t=>t.id===En):null;if(n==="ground"?We.fov=38:n==="front"?We.fov=34:We.fov=48,e&&Gn){let t=fl(e,We.aspect,Math.max(16,We.position.distanceTo(Ze.target)));Number.isFinite(t.fov)&&(We.fov=t.fov)}We.updateProjectionMatrix(),Ze.update(),qt=!0}function sv(){return`cam=${We.position.x.toFixed(2)},${We.position.y.toFixed(2)},${We.position.z.toFixed(2)}|${Ze.target.x.toFixed(2)},${Ze.target.y.toFixed(2)},${Ze.target.z.toFixed(2)}|${We.fov.toFixed(2)}`}function _u(){if(!se?.context?.origin)return;let[n,e]=$s({x:se.context.origin.x+We.position.x,y:se.context.origin.y-We.position.z}),t=oe("location-label");t&&(t.textContent=`${e.toFixed(6)}, ${n.toFixed(6)}`);let i=oe("location-map-link");i instanceof HTMLAnchorElement&&se?.context?.origin&&(i.href=`https://www.openstreetmap.org/?mlat=${e}&mlon=${n}#map=19/${e}/${n}`)}function Af(n){let e=n??new URLSearchParams(location.search).get("camera");if(!e||!se||!e.includes("|"))return;let[t,i,r]=e.split("|"),s=c=>c?.split(",").map(Number),o=s(t),a=s(i),l=parseFloat(r||"");o&&o.length===3&&o.every(c=>Number.isFinite(c))&&We.position.set(o[0],o[1],o[2]),a&&a.length===3&&a.every(c=>Number.isFinite(c))&&Ze.target.set(a[0],a[1],a[2]),Number.isFinite(l)&&l>1&&l<120&&(We.fov=l),qt=!0}function ov(){return new URLSearchParams({...Object.fromEntries(Vn),camera:sv(),sourceTier:mu,cameraPreset:yl}).toString()}var se=null,En=null,Yi=null,An="overview",pl=!1,xu=!1,Gn=null,Ai=null,av=0,gn=!1,mn=0,du=0,fu=0,pu=null,bf=0,qt=!0,Mf=0,gl=null,lu=!1,zr="orbit",at={forward:!1,backward:!1,left:!1,right:!1,turnLeft:!1,turnRight:!1,fast:!1},Ei=0,lv=()=>2*Math.atan(Math.tan(38*Math.PI/360)/Math.min(1,We.aspect))*180/Math.PI,_l=(n,e=!1)=>{oe("release-status").textContent=n,oe("release-status").classList.toggle("error",e)},cv=async n=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",n))].map(e=>e.toString(16).padStart(2,"0")).join("");async function cu(n,e,t){let i=Array.isArray(e)?e:[e];if(!i.length||i.some(l=>!/^[a-f0-9]{64}$/.test(l)))throw Error("Missing source hash");let r=new URL(n,location.href);if(r.origin!==location.origin)throw Error("Release data must be same-origin");let s=await fetch(r,{signal:t});if(!s.ok)throw Error(`Source HTTP ${s.status}`);let o=await s.arrayBuffer();if(!i.includes(await cv(o)))throw Error("Source hash mismatch; previous release retained");let a=new Uint8Array(o);if(a[0]===31&&a[1]===139){let l=new Blob([a]).stream().pipeThrough(new DecompressionStream("gzip"));return JSON.parse(await new Response(l).text())}return JSON.parse(new TextDecoder().decode(a))}function uv(n){let e=[],t=[];for(let s of n){if(!s.footprint)continue;let o=new qe(s.colour),a=Math.max(.1,s.height),l=s.footprint.type==="Polygon"?[s.footprint.coordinates]:s.footprint.coordinates,c=(u,f,h)=>{e.push(...u,...f,...h);for(let d=0;d<3;d++)t.push(o.r,o.g,o.b)};for(let u of l){let f=u.map(d=>d.slice(0,-1).map(m=>new De(m[0],m[1]))),h=f.flat();for(let[d,m,b]of zi.triangulateShape(f[0],f.slice(1)))c([h[d].x,a,h[d].y],[h[b].x,a,h[b].y],[h[m].x,a,h[m].y]);for(let d of f)for(let m=0;m<d.length;m++){let b=d[m],g=d[(m+1)%d.length];c([b.x,0,b.y],[g.x,a,g.y],[g.x,0,g.y]),c([b.x,0,b.y],[b.x,a,b.y],[g.x,a,g.y])}}}let i=new Rt;i.setAttribute("position",new ct(e,3)),i.setAttribute("color",new ct(t,3)),i.computeVertexNormals();let r=new yt(i,new xs({vertexColors:!0,side:Ct}));return r.name="complete-source-footprint-overview",r}function yu(n){let[e,t]=$s({x:n.origin.x+We.position.x,y:n.origin.y-We.position.z}),i=Math.min(900,Math.max(110,We.position.distanceTo(Ze.target)*1.1)),[r,s]=$s({x:n.origin.x+Ze.target.x-i,y:n.origin.y-Ze.target.z-i}),[o,a]=$s({x:n.origin.x+Ze.target.x+i,y:n.origin.y-Ze.target.z+i});return{longitude:e,latitude:t,bounds:{west:r,south:s,east:o,north:a}}}function $i(){return se?[...se.owners.values()].flatMap(n=>n.observations.map(e=>e.payload)).sort((n,e)=>String(n.street??"").localeCompare(String(e.street??""))||n.mid[1]-e.mid[1]||n.id.localeCompare(e.id)):[]}function Rf(){return se?[...se.owners.values()].map(n=>n.geometry.building):[]}function hv(){let n=oe("street-labels");if(n.replaceChildren(),!Tt||!se)return;let e=new Map;for(let i of Rf()){if(!i.street||!Array.isArray(i.center))continue;let r=e.get(i.street)??{x:0,z:0,n:0};r.x+=i.center[0],r.z+=i.center[1],r.n++,e.set(i.street,r)}let t=[...e].sort((i,r)=>r[1].n-i[1].n||i[0].localeCompare(r[0])).slice(0,14);se.streetNames=t.map(([i])=>i),se.streetLabels=t.map(([i,r])=>{let s=document.createElement("span");return s.className="street-label",s.textContent=i,n.append(s),{name:i,element:s,position:new k(r.x/r.n,2,r.z/r.n)}})}function dv(){if(!se)return;let n=oe("building-options");n.replaceChildren();for(let e of se.owners.values()){let t=e.geometry.building,i=document.createElement("option");i.value=e.id,i.label=[t.id,t.street,t.addresses?.[0]].filter(Boolean).join(" \xB7 "),n.append(i)}}function Cf(n){let e=n.trim();if(!e)return;let t=se?.owners.get(e);if(t){Ri(t.id);let s=Sf(t);s&&(Ze.target.set(s[0],s[1],s[2]),We.position.set(s[0]-10,s[1]+8,s[2]+10),qt=!0,Gn=null,An="manual",Zi(se),xl());return}let i=e.toLowerCase(),r=[...se?.owners.values()??[]].find(s=>{let o=s.geometry.building;return String(o.street||"").toLowerCase().includes(i)||String(o.id||"").toLowerCase().includes(i)||o.addresses?.some(a=>a.toLowerCase().includes(i))});if(r){Ri(r.id);let s=Sf(r);s&&(Ze.target.set(s[0],s[1],s[2]),We.position.set(s[0]-10,s[1]+8,s[2]+10),qt=!0,Gn=null,An="manual",Zi(se),xl());return}oe("view-label").textContent=`No building matched ${e}.`}function Sf(n){let e=n.geometry?.building?.center;return Array.isArray(e)&&e.length>=2?[e[0],1.5,e[1]]:null}function Pf(){if(!se?.streetLabels)return;let n=We.position.distanceTo(Ze.target),e=[];for(let t of se.streetLabels){let i=t.position.clone().project(We),r=(i.x*.5+.5)*Js.clientWidth,s=(-i.y*.5+.5)*Js.clientHeight,o=Math.min(150,32+t.element.textContent.length*5.5),a={left:r-o/2,right:r+o/2,top:s-9,bottom:s+9},l=jt("labels")&&t.name!==Ai&&i.z>-1&&i.z<1&&Math.abs(i.x)<1.02&&Math.abs(i.y)<1.02&&!e.some(c=>a.left<c.right+5&&a.right>c.left-5&&a.top<c.bottom+3&&a.bottom>c.top-3);t.element.hidden=!l,l&&(e.push(a),t.element.style.left=`${r}px`,t.element.style.top=`${s}px`,t.element.classList.toggle("far",n>300))}}function If(){se?.streetNames?.length&&(Ai=se.streetNames[av++%se.streetNames.length],oe("view-label").textContent=`Find ${Ai} \xB7 click one of its buildings`,oe("street-quiz").textContent="Skip to another street")}function Df(n){if(!Ai)return null;let e=Ai,t=se?.owners.get(n)?.geometry.building.street,i=t===e;return i?(oe("view-label").textContent=`Correct \xB7 ${e}`,Ai=null,oe("street-quiz").textContent="Another street"):oe("view-label").textContent=`That is ${t||"an unnamed building"} \xB7 find ${e}`,{correct:i,street:t||null,target:e}}function Zi(n){n?.group?.traverse?.(e=>{e.isInstancedMesh&&(e.visible=jt("trees")&&An!=="frontage")})}function fv(){let n=0;return se?.group?.traverse?.(e=>{e.isInstancedMesh&&e.visible&&n++}),n}function Lf(){return[...se?.resources||[]].reduce((n,e)=>n+e.stats.machineSigns,0)}function Ff(){let n=oe("machine-sign-badge");if(!Tt){n.hidden=!0;return}let e=Lf(),t=jt("machine-signs");n.hidden=!t||e<1,n.textContent=Kd}function vu(n){for(let e of se?.resources||[])e.setMachineSignsVisible(n);Ff()}function pv(n){if(!n)return"geometry-only";if(n.sourceTier||n.tier)return n.sourceTier||n.tier;let e=n.images?.full,t=n.images?.ground;return e&&t?"full + ground":t?"ground":e?"full":"source metadata only"}function mv(n){return n?.images?.ground?.date||n?.images?.full?.date||n?.captureDate||n?.capturedAt||"date unknown"}function gv(n){if(!n)return["facade evidence"];let e=n.machineRoutingProposal||{},t=[];return String(e.signText||"").trim()||t.push("literal sign text"),e.signTextEligible==="unknown"&&t.push("sign text uncertain"),(n.effectiveProposal?.shopfront==="unknown"||n.effectiveProposal?.shopfront==null)&&t.push("shopfront"),n.visualReview?.fieldEligibility?.signText===!1&&t.push("sign text withheld"),[...new Set(t)]}function _v(n){if(!n)return"No source observation is bound to this building; generated facade details remain omitted.";let e=n.images?.ground,t=n.images?.full,i=[n.id,n.evidenceKey,n.derivationKey].filter(Boolean).join(" \xB7 ")||"identity unavailable",r=e?.panoramaId||t?.panoramaId||"panorama unavailable",s=gv(n),o=String(mv(n));return`Source ${i} \xB7 panorama ${r} \xB7 captured ${o.slice(0,10)} \xB7 tier ${pv(n)}. Render omissions: ${s.length?s.join(", "):"none recorded"}. Machine text stays unreviewed and is revoked when this source binding changes.`}function xv(n){let e=new $t,t=[];for(let o=1;o<n.points.length;o++){let[a,l]=n.points[o-1],[c,u]=n.points[o],f=c-a,h=u-l,d=Math.hypot(f,h);if(!d)continue;let m=-h/d*.4,b=f/d*.4,g=[[a+m,.2,l+b],[c+m,.2,u+b],[c-m,.2,u-b],[a-m,.2,l-b]];for(let p of[0,1,2,0,2,3])t.push(...g[p])}let i=new Rt;i.setAttribute("position",new ct(t,3)),i.computeVertexNormals();let r=new Sn({color:"#d7a82f",emissive:"#60440a",emissiveIntensity:.16,roughness:.78,polygonOffset:!0,polygonOffsetFactor:-2,side:Ct}),s=new yt(i,r);return s.name="map-recall-guided-route",s.renderOrder=3,e.add(s),{group:e,dispose(){e.removeFromParent(),i.dispose(),r.dispose()}}}function uu(n){let e=se?.context.guidedRoute?.points;if(!e?.length)return null;let t=n;for(let i=1;i<e.length;i++){let r=e[i-1],s=e[i],o=Math.hypot(s[0]-r[0],s[1]-r[1]);if(t<=o){let a=o?t/o:0;return{point:[r[0]+(s[0]-r[0])*a,r[1]+(s[1]-r[1])*a],ahead:s}}t-=o}return{point:e.at(-1),ahead:e.at(-1)}}function yv(n){return se?.context.guidedRoute?.legs?.find((e,t,i)=>n>=e.fromM&&(n<e.toM||t===i.length-1))?.streetName??null}function Nf(){se?.context.guidedRoute&&(gn=!gn,Ze.enabled=!gn,oe("follow-route").textContent=gn?"Pause street tour":"Resume street tour",gn&&(vu(jt("machine-signs")),Ai=null,mn=mn>=se.context.guidedRoute.distanceM?0:mn,du=performance.now()))}function Uf(n){se?.priorityTiles&&(se.priorityTiles.length=0),An="route",nn.fog&&(nn.fog.near=260,nn.fog.far=850);let e=se?.context.guidedRoute;if(!e)return;mn=Math.max(0,Math.min(e.distanceM,n));let t=uu(mn),i=uu(Math.min(e.distanceM,mn+12));if(!t||!i)return;let[r,s]=t.point,o=i.point[0]-r,a=i.point[1]-s;if(Math.hypot(o,a)<.1){let u=uu(Math.max(0,mn-12));o=r-(u?.point[0]??r-1),a=s-(u?.point[1]??s)}let l=Math.hypot(o,a)||1;We.position.set(r-o/l*4,2.35,s-a/l*4),Ze.target.set(r+o/l*12,1.75,s+a/l*12),We.fov=58,We.updateProjectionMatrix(),Ze.update();let c=yv(mn);oe("view-label").textContent=`Street tour \xB7 ${c?`${c} \xB7 `:""}${Math.round(mn)} / ${Math.round(e.distanceM)} m \xB7 ${Math.round(mn/e.distanceM*100)}%`,qt=!0}function vv(n){if(!gn)return;let e=se?.context.guidedRoute;if(!e){gn=!1;return}let t=mn+Math.min(.1,(n-du)/1e3)*9;du=n,t>=e.distanceM&&(gn=!1,Ze.enabled=!0,oe("follow-route").textContent="Replay street tour"),Uf(t)}async function Of(){let n=++fu;pu?.abort();let e=new AbortController;pu=e;let t=await fetch(iv,{signal:e.signal,cache:"no-store"});if(!t.ok)throw Error("No published scene yet. Run the matching city demo publisher.");let i=await t.json();if(i.version!==1||!i.releaseId||!Array.isArray(i.tiles)||!i.context?.url)throw Error("Unsupported scene release");let r=!!Zs&&i.developmentCandidate===!0;if(r){let M=oe("machine-preview").closest("label")?.querySelector("span");M&&(M.textContent="Photo-derived wall colours (unreviewed)"),oe("appearance-copy").textContent="Photo-derived fa\xE7ade details are shown where available. Other buildings retain illustrative patterns. Placement is under review; source roofs are preserved.";let T=document.getElementById("candidate-preview-badge");T||(T=document.createElement("div"),T.id="candidate-preview-badge",T.style.cssText="position:fixed;bottom:12px;left:12px;z-index:20;padding:8px 12px;background:#fff3ce;color:#493c20;font:13px sans-serif;pointer-events:none",document.body.append(T)),T.textContent="Neighbourhood preview \xB7 fa\xE7ade placement under review"}let s=await cu(i.context.url,i.context.sha256,e.signal),o=new $t,a=null,l=null,c=new Map,u=new Set,f=new Set,h=[],d=new Map(i.tiles.map(M=>[M.key,M])),m=hf({parent:o,targetOriginRD:s.origin,targetOffsetNAP:.65,experimentalWallColours:jt(Tt?"machine-preview":"appearance"),observedFacades:r,candidateRegistrationPreview:r,proceduralFacades:jt("patterns"),reviewedAwnings:!Tt&&jt("appearance"),auditCoverage:Tt&&jt("appearance"),contextualPalette:Tt,contextualFacades:Tt,machineSigns:Tt&&jt("machine-signs"),castShadows:!Tt}),b=i.observationIndex?.find(M=>M.id===(Vn.get("frontage")||Vn.get("inspect"))),g=b?.tile?[b.tile]:[],p=new zs({index:i,priorityTiles:g,budget:12,concurrency:2,lodDistanceMultiplier:1,loadTile:async(M,T)=>{let v=d.get(M);if(!v?.url)throw Error("Missing tile in release");return cu(v.url,[v.sha256,v.contentSha256??v.sha256],T)},createResource:M=>{for(let v of M)c.set(v.id,v);let T=m(M);return T.setSelected(Yi),u.add(T),{setLod:(v,C)=>T.setLod(v,C),dispose(){for(let v of M)c.delete(v.id);u.delete(T),T.dispose()}}},onError:(M,T)=>h.push(String(T))});try{if(i.contextTiles){let I=new Map(i.contextTiles.tiles.map(N=>[N.key,N]));l=new zs({index:i.contextTiles,budget:16,concurrency:2,loadTile:async(N,U)=>{let F=I.get(N);if(!F?.url)throw Error("Missing context tile in release");return cu(F.url,[F.sha256,F.contentSha256??F.sha256],U)},createResource:N=>{let U={},F=[];for(let D of N){let G=D.geometry;G.kind==="tree"?F.push(G.tree):G.kind==="feature"&&(U[G.layer]??=[]).push(G.feature)}let O=nu({...s,layers:U,trees:F},{includeBase:!1});return f.add(O),o.add(O.group),{setLod(){},dispose(){f.delete(O),O.dispose()}}},onError:(N,U)=>h.push(String(U))})}b?.mid&&(Ze.target.set(b.mid[0],5,b.mid[1]),We.position.set(b.mid[0],45,b.mid[1]+45),Ze.update());let M=yu(s);p.update(M),l?.update(M),await Promise.all([p.whenIdle(),l?.whenIdle()]);for(let I of u)I.flush();if(xu||n!==fu||e.signal.aborted)throw new DOMException("Superseded","AbortError");if(h.length)throw Error(h[0]);if(!c.size)throw Error("No building tiles loaded for this view");let T=vf(s.bounds,[...c.values()].flatMap(I=>I.observations.map(N=>N.payload)));a=nu({...s,bounds:T.bounds}),o.add(a.group),Zi(a);let v=s.overviewMassing?.buildings?.length?uv(s.overviewMassing.buildings):null;v&&o.add(v);let C=s.guidedRoute?xv(s.guidedRoute):null;C&&(o.add(C.group),C.group.visible=jt("route"));let S=se;se={manifest:i,context:s,displayExtent:T,group:o,terrain:a,overviewMassing:v,priorityTiles:g,routeOverlay:C,owners:c,stream:p,contextStream:l,resources:u,contextResources:f},nn.add(o),S&&(S.stream.dispose(),S.contextStream?.dispose(),S.routeOverlay?.dispose(),S.terrain.dispose(),S.overviewMassing?.geometry.dispose(),S.overviewMassing?.material.dispose(),nn.remove(S.group));let[_,x,A,E]=T.bounds;It.clippingPlanes=[new zt(new k(1,0,0),-_),new zt(new k(-1,0,0),A),new zt(new k(0,0,1),-x),new zt(new k(0,0,-1),E)],oe("coverage").textContent=`${i.buildings} buildings \xB7 ${i.observations} photographed frontages \xB7 ${i.reviewed??0} reviewed`;let R=oe("provenance-ladder");if(Tt&&i.appearanceCoverage){let I=i.appearanceCoverage;R.hidden=!1,R.innerHTML=`<strong>Coverage ladder</strong><br>Geometry ${I.geometryBuildings}/${i.buildings}<br>Contextual display prior ${I.contextualPriorBuildings}/${i.buildings}<br>Audited street evidence ${I.auditedFrontages}/${i.buildings}<br>Machine-observed (unreviewed) ${I.machinePreviewFrontages}/${i.buildings}<br>Human-confirmed appearance ${I.humanConfirmedFrontages}/${i.buildings}${r?`<br>Candidate fa\xE7ade buildings ${I.candidatePreviewBuildings??0}/${i.buildings}`:""}`}Ff(),s.guidedRoute&&(oe("follow-route").textContent=`Play ${Math.round(s.guidedRoute.distanceM)} m street tour`),hv(),dv(),Ef(Vn.get("sourceTier")==="full"?"full":"ground"),gu(Vn.get("cameraPreset")==="front"?"front":Vn.get("cameraPreset")==="oblique"?"oblique":"ground"),Af(),_u(),oe("loading").hidden=!0,_l(`Release ${i.releaseId.slice(0,8)} \xB7 ${i.reviewed??0} reviewed${i.followupCount?` \xB7 ${i.followupCount} follow-up notes`:""}`),Yi&&Ri(Yi,En||void 0),qt=!0}catch(M){throw p.dispose(),l?.dispose(),a?.dispose(),se?.group!==o&&nn.remove(o),M}}function vl(n){if(se?.priorityTiles&&(se.priorityTiles.length=0),Gn=null,gn=!1,Ze.enabled=!0,oe("follow-route").textContent="Play street tour",An=n,vu(Tt&&jt("machine-signs")),kr(zr),n==="canal"){let e=Tt&&se?ru([4.8728,52.372]):null,t=e?e.x-se.context.origin.x:-5,i=e?se.context.origin.y-e.y:-30;Ze.target.set(t,7,i),We.position.set(t-70,58,i+55)}else if(n==="shops"){let e=Tt&&se?ru([4.873,52.37155]):null,t=e?e.x-se.context.origin.x:-22,i=e?se.context.origin.y-e.y:70;Ze.target.set(t,8,i),We.position.set(t-26,23,i+38)}else{let e=se?.displayExtent.bounds||[-130,-147,130,131],t=(e[0]+e[2])/2,i=(e[1]+e[3])/2,r=Math.max(e[2]-e[0],e[3]-e[1]);Ze.target.set(t,5,i),We.position.set(t+r*.5,r*.74,i+r*.7)}nn.fog&&(nn.fog.near=n==="overview"?1800:260,nn.fog.far=n==="overview"?6e3:850),gu(yl),Zi(se),document.querySelectorAll("[data-view]").forEach(e=>e.setAttribute("aria-pressed",String(e.dataset.view===n))),qt=!0}function Ri(n,e){let t=se?.owners.get(n);if(!t)return;Yi=n;for(let h of se?.resources||[])h.setSelected(n);let i=t.observations.map(h=>h.payload),r=i.find(h=>h.id===e)||i[0];En=r?.id||null;let s=t.geometry.building;oe("inspector").hidden=!1,oe("selection-title").textContent=r?.address||s.addresses?.[0]||"Building without a photographed frontage";let o={accepted:"Human-confirmed wall",uncertain:"Human: placement uncertain",rejected:"Human: wrong or unusable","crop-repair":"Human: right building, bad crop"},a=r?.agentSourceAudit?r.agentSourceAudit.disposition==="preflight-passed"?"Automated crop preflight \xB7 identity unreviewed":`Agent source audit: ${r.agentSourceAudit.disposition}`:o[r?.review?.placement]||"Not human-reviewed";oe("selection-tags").replaceChildren();for(let h of[a,t.geometryRevision.slice(0,8)]){let d=document.createElement("span");d.className="tag",d.textContent=h,oe("selection-tags").append(d)}let l=oe("frontage-choice");l.replaceChildren(...i.map((h,d)=>new Option(`${d+1}. ${h.wallWidthM.toFixed(1)} m wall${["accepted","uncertain","rejected","crop-repair"].includes(h.review?.placement)?" \xB7 reviewed":""}`,h.id))),l.hidden=i.length<2,r&&(l.value=r.id);let c=r?.effectiveProposal,u={flat:"flat","flat-with-front-pitch":"mostly flat with a sloped front","pitched-gable":"two slopes meeting at a ridge",hipped:"sloped on all sides",mansard:"steep lower slopes and gentler upper slopes",complex:"several connected roof shapes"};oe("selection-summary").textContent=r?`${r.machineRoutingProposal?`Machine-observed: ${r.machineRoutingProposal.wallColour} ${r.machineRoutingProposal.wallMaterial}, ${r.machineRoutingProposal.family}; ${r.machineRoutingProposal.groundType} ground floor. `:""}Storefront: ${c?.shopfront==="yes"?r.review?.shopfront==="yes"?"human-confirmed":"machine-observed, unreviewed":c?.shopfront==="no"?"no storefront observed":"not established"}. Roof: ${u[c?.roofShape]||"not established"}. The source roof geometry is unchanged.`:"Source geometry only. No facade evidence has been assigned to this building.",oe("source-comparison").textContent=_v(r),oe("inspector-warning").textContent=r?.agentSourceAudit?.note||r?.review?.notes?`${r?.agentSourceAudit?"Source audit":"Your note"}: ${r?.agentSourceAudit?.note||r.review.notes}`:r?.review?.placement==="crop-repair"?"The building is right, but the crop needs repair. Appearance is withheld.":r?.facadeDescription?"Photo-derived fa\xE7ade details; placement is still under review.":"Window patterns are illustrative, not extracted window counts.";let f=oe("evidence-image");f.hidden=!0,f.removeAttribute("src"),f.onload=()=>{f.hidden=!1},f.onerror=()=>{f.hidden=!0,oe("evidence-caption").textContent="Evidence image unavailable; use the review link."},r?.images.full?.file?(f.src=r.images.full.publicUrl||(Tt?"/panorama-audit/evidence/":"/evidence/")+encodeURIComponent(r.images.full.file),oe("evidence-caption").textContent=`Street evidence \xB7 ${r.images.full.date?.slice(0,10)||"date unknown"} \xB7 approximate wall crop`):oe("evidence-caption").textContent="";for(let h of["review-link","frame-frontage","detail-link"])oe(h).hidden=!r;if(r&&(oe("review-link").href=Tt?"./panorama-audit.html#"+encodeURIComponent(r.id):"./neighbourhood-review.html#"+encodeURIComponent(r.id),oe("review-link").textContent=Tt?"See audit evidence \u2197":"Review this wall \u2197",oe("detail-link").href="./da-costa-block.html?neighbourhood=1&frontage="+encodeURIComponent(r.id)),r){let h=oe("review-link"),d=Tt?"./panorama-audit.html":"./neighbourhood-review.html",m=new URL(d+"#"+encodeURIComponent(r.id),location.href);m.searchParams.set("sourceTier",mu),m.searchParams.set("cameraPreset",yl),h.href=m.href}}function Vr(n){let e=$i().find(r=>r.id===n);if(!e)return;let t=e.review?.placement==="accepted"&&$i().find(r=>r.id===e.review.targetId)||e,i=yf(t,Rf(),We.aspect);if(Ri(e.renderBuildingId||e.buildingId,e.id),!i.usable){oe("inspector-warning").textContent="This wall has no clear initial camera position. Use the photographs to review it.";return}Ze.target.set(...i.target),We.position.set(...i.position),We.fov=i.fov,We.updateProjectionMatrix(),Ze.update(),Gn=t,An="frontage",Zi(se),oe("view-label").textContent=e.address,document.querySelectorAll("[data-view]").forEach(r=>r.setAttribute("aria-pressed","false")),qt=!0}function Bf(n){let e=$i();if(!e.length)return;let t=e.findIndex(i=>i.id===En);Vr(e[(t+n+e.length)%e.length].id)}async function bu(){if(!Tt)try{let n=await fetch("/api/city-appearance/status",{cache:"no-store"});n.ok&&(gl=await n.json(),gl.stale&&_l("New saved reviews are available. Load them into this scene."))}catch{}}async function Mu(n=!0){if(pl){n||(lu=!0);return}pl=!0,oe("refresh").disabled=!0;try{if(_l(n?"Checking saved reviews\u2026":"Updating appearance view\u2026"),n&&(await bu(),gl?.token)){let e=await fetch("/api/city-appearance/refresh",{method:"POST",headers:{"content-type":"application/json","x-review-token":gl.token},body:"{}"});if(!e.ok)throw Error((await e.json()).error||"Could not rebuild the scene")}do lu=!1,await Of(),Gn&&Vr(Gn.id);while(lu)}catch(e){e.name!=="AbortError"&&_l(`${String(e)}. The previous scene is retained.`,!0)}finally{pl=!1,oe("refresh").disabled=!1}}function Su(){let n=Js.clientWidth,e=Js.clientHeight;It.setSize(n,e,!1),We.aspect=n/e,Gn?We.fov=fl(Gn,We.aspect,We.position.distanceTo(Ze.target)).fov:An==="overview"&&(We.fov=lv()),We.updateProjectionMatrix(),qt=!0}function bv(n){if(au){let i=n-au;i>0&&i<500&&ou.push(i)}if(au=n,ou.length<30)return;let e=ou.splice(0).sort((i,r)=>i-r),t=e[Math.floor(e.length*.75)];t>35&&Br>.76?(Br=Math.max(.75,Br*.8),It.setPixelRatio(Br),Su(),hu++):t>45&&It.shadowMap.enabled&&(It.shadowMap.enabled=!1,hu++)}new ResizeObserver(Su).observe(Js);Su();Ze.addEventListener("change",()=>{qt=!0});document.querySelectorAll("[data-view]").forEach(n=>n.onclick=()=>vl(n.dataset.view));oe("camera-reset").onclick=()=>vl("overview");oe("previous-frontage").onclick=()=>Bf(-1);oe("next-frontage").onclick=()=>Bf(1);oe("street-quiz").onclick=If;oe("labels").onchange=()=>Pf();oe("follow-route").onclick=Nf;oe("route").onchange=()=>{se?.routeOverlay&&(se.routeOverlay.group.visible=jt("route"))};oe("inspector-close").onclick=()=>{oe("inspector").hidden=!0,Yi=null,En=null;for(let n of se?.resources||[])n.setSelected(null)};oe("frame-frontage").onclick=()=>En&&Vr(En);oe("frontage-choice").onchange=()=>Yi&&Ri(Yi,oe("frontage-choice").value);for(let n of["navigation-orbit","navigation-explore"]){let e=n==="navigation-orbit"?"orbit":"explore",t=oe(n);t&&(t.onclick=()=>kr(e))}oe("building-search-go").onclick=()=>{Cf(oe("building-search").value)};oe("building-search").addEventListener("keydown",n=>{n.key==="Enter"&&(n.preventDefault(),Cf(oe("building-search").value))});oe("search-clear").onclick=()=>{oe("building-search").value="",oe("view-label").textContent="Search cleared"};document.querySelectorAll("button[data-source-tier]").forEach(n=>{n.onclick=()=>Ef(n.dataset.sourceTier)});document.querySelectorAll("button[data-camera-preset]").forEach(n=>{n.onclick=()=>gu(n.dataset.cameraPreset)});oe("camera-copy").onclick=async()=>{let n=ov(),e=new URL(location.href);e.search=n.toString();try{await navigator.clipboard?.writeText(e.toString())}catch{let t=document.createElement("a");t.href=e.toString(),t.download="",t.click()}oe("view-label").textContent="Camera link copied"};oe("camera-share").onclick=()=>{Af(),qt=!0,_u(),oe("view-label").textContent="Camera restored from URL"};oe("refresh").onclick=()=>void Mu();for(let n of["appearance","patterns","machine-preview"])oe(n).onchange=()=>{if(Tt&&n!=="patterns"&&jt(n)){let e=n==="appearance"?"machine-preview":"appearance";oe(e).checked=!1}Mu(!1)};oe("machine-signs").onchange=()=>vu(jt("machine-signs"));oe("trees").onchange=()=>{se&&Zi({group:se.group})};var ml=null,wf=new ws;function kf(){return["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName||"")}Ks.addEventListener("pointerdown",n=>{ml={x:n.clientX,y:n.clientY}});Ks.addEventListener("pointerup",n=>{if(!ml||Math.hypot(n.clientX-ml.x,n.clientY-ml.y)>5)return;let e=Ks.getBoundingClientRect();wf.setFromCamera(new De((n.clientX-e.left)/e.width*2-1,-(n.clientY-e.top)/e.height*2+1),We);let t=wf.intersectObjects(se?[...se.resources].flatMap(i=>i.group.children):[],!1);if(t.length)for(let i of se.resources){let r=i.pick(t[0].object,t[0].faceIndex);if(r){Df(r.buildingId),Ri(r.buildingId,r.observationId||void 0);break}}});function xl(){gn&&(gn=!1,Ze.enabled=!0,oe("follow-route").textContent="Play street tour")}function Mv(n){if(zr==="orbit"||!se||(Ei||(Ei=n),!Object.values(at).some(Boolean)))return;xl(),Gn=null,An="manual",Zi(se);let e=new k;We.getWorldDirection(e),e.y=0,e.normalize();let t=new k(-e.z,0,e.x),i=.015*(at.fast?1.5:1)*Math.min(1,(n-Ei)/16.7);at.turnLeft&&Ze.rotateLeft(i),at.turnRight&&Ze.rotateLeft(-i);let r=new k;if(at.forward&&r.add(e),at.backward&&r.sub(e),at.left&&r.sub(t),at.right&&r.add(t),r.lengthSq()>1e-4){let s=at.fast?1.8:.75,o=(n-Ei)/16.7;r.normalize().multiplyScalar(s*o*2.4),We.position.add(r),Ze.target.add(r)}Ze.update(),qt=!0,Ei=n,_u()}function zf(n,e){switch(n){case"ArrowUp":case"KeyW":return at.forward=e,!0;case"ArrowDown":case"KeyS":return at.backward=e,!0;case"ArrowLeft":case"KeyA":return at.left=e,!0;case"ArrowRight":case"KeyD":return at.right=e,!0;case"KeyQ":return at.turnLeft=e,!0;case"KeyE":return at.turnRight=e,!0;case"ShiftLeft":case"ShiftRight":return at.fast=e,!0}return!1}window.addEventListener("keydown",n=>{if(kf())return;let e=zr,t=n.key.toLowerCase();if(zf(n.code,!0)){n.preventDefault(),e!=="explore"&&kr("explore"),Ei=performance.now();return}t==="f"&&(n.preventDefault(),En&&Vr(En)),t==="o"&&(n.preventDefault(),kr("orbit")),t==="x"&&(n.preventDefault(),kr("explore"))});window.addEventListener("keyup",n=>{kf()||(zf(n.code,!1),Object.values(at).some(Boolean)||(Ei=0))});document.querySelectorAll("#touch-controls button").forEach(n=>{let e=n.id,t=i=>{e==="move-forward"&&(at.forward=i),e==="move-backward"&&(at.backward=i),e==="move-left"&&(at.left=i),e==="move-right"&&(at.right=i),e==="turn-left"&&(at.turnLeft=i),e==="turn-right"&&(at.turnRight=i),e==="speed-toggle"&&(at.fast=i),i&&xl()};n.addEventListener("pointerdown",i=>{i.preventDefault(),zr!=="explore"&&kr("explore"),t(!0)}),n.addEventListener("pointerup",()=>{t(!1)}),n.addEventListener("pointerleave",()=>{t(!1)})});window.addEventListener("pointerup",()=>{zr==="explore"&&(at.forward=!1,at.backward=!1,at.left=!1,at.right=!1,at.turnLeft=!1,at.turnRight=!1,at.fast=!1)});function Vf(n){if(se?.overviewMassing){se.overviewMassing.visible=An==="overview";for(let e of se.resources)e.group.visible=An!=="overview"}if(!xu){if(requestAnimationFrame(Vf),bv(n),Mv(n),vv(n),Ze.update(),se&&qt&&n-bf>120){let e=yu(se.context);se.stream.update(e),se.contextStream?.update(e),Ei=n,bf=n,qt=!1}if(It.render(nn,We),Pf(),se&&n-Mf>900){let e=se.stream.status,t=se.contextStream?.status;oe("metrics").textContent=`${e.resident}/12 building tiles${t?` \xB7 ${t.resident}/16 context tiles`:""} \xB7 ${It.info.render.calls} draws \xB7 ${It.info.render.triangles.toLocaleString()} triangles${e.failed.length||t?.failed.length?" \xB7 tile load failed":""}${e.budgetConstrained||t?.budgetConstrained?" \xB7 detailed extent limited":""}`,Mf=n}}}requestAnimationFrame(Vf);var Sv=setInterval(()=>void bu(),15e3);window.addEventListener("pagehide",()=>{xu=!0,fu++,pu?.abort(),clearInterval(Sv),se?.stream.dispose(),se?.contextStream?.dispose(),se?.routeOverlay?.dispose(),se?.terrain.dispose(),Ze.dispose(),It.dispose()});function wv(){let n=new Set;for(let e of se?.resources||[])for(let t of e.group.children)for(let i of t.userData.triangleIdentities||[])i.observationId&&n.add(`${i.buildingId}:${i.sourceSurfaceIndex}:${i.observationId}`);return n.size}window.cityAppearanceDemo={status:()=>({ready:!!se,developmentCandidate:se?.manifest.developmentCandidate===!0,releaseId:se?.manifest.releaseId,reviewed:se?.manifest.reviewed,buildings:se?.manifest.buildings,residentBuildings:se?.owners.size,observations:se?.manifest.observations,residentObservations:$i().length,stream:se?.stream.status,contextStream:se?.contextStream?.status,displayExtent:se?.displayExtent,facadeWindows:[...se?.resources||[]].reduce((n,e)=>n+e.stats.windows,0),facadeDoors:[...se?.resources||[]].reduce((n,e)=>n+e.stats.doors,0),facadeStorefronts:[...se?.resources||[]].reduce((n,e)=>n+e.stats.storefronts,0),machineSigns:Lf(),intervalPaintedWalls:wv(),selectionMeshes:[...se?.resources||[]].reduce((n,e)=>n+e.group.children.filter(t=>t.userData.runtimeSelection).length,0),contextBridges:[...se?.contextResources||[]].reduce((n,e)=>n+e.stats.bridges,0),visibleTreeMeshes:fv(),residentBuildingGeometryBufferBytes:[...se?.resources||[]].reduce((n,e)=>n+e.stats.geometryBufferBytes,0),residentBuildingTextureBytes:[...se?.resources||[]].reduce((n,e)=>n+e.stats.textureBytes,0),drawCalls:It.info.render.calls,triangles:It.info.render.triangles,gpuGeometries:It.info.memory.geometries,gpuTextures:It.info.memory.textures,pixelRatio:Br,shadows:It.shadowMap.enabled,adaptiveChanges:hu,selectedId:En,view:An,refreshing:pl,quizStreet:Ai,routePlaying:gn,routeDistance:mn,cameraPosition:We.position.toArray(),cameraTarget:Ze.target.toArray()}),view:vl,frontage:Vr,select:Ri,refresh:Mu,quiz:If,answerQuiz:Df,buildingStreets:()=>se?[...se.owners].map(([n,e])=>({id:n,street:e.geometry.building.street})):[],route:Nf,routeAt:Uf,whenIdle:async()=>{if(se&&qt){let n=yu(se.context);se.stream.update(n),se.contextStream?.update(n),qt=!1}await Promise.all([se?.stream.whenIdle(),se?.contextStream?.whenIdle()]);for(let n of se?.resources||[])n.flush();await new Promise(n=>requestAnimationFrame(()=>requestAnimationFrame(()=>n())))},records:$i,context:()=>se?.context};if(Tt){document.title="Da Costa \xB7 expansion geometry",document.querySelector("h1").innerHTML="A larger piece<br>of Amsterdam.",document.querySelector(".eyebrow").textContent="Amsterdam \xB7 source geometry at neighbourhood scale",document.querySelector("h1 + .muted").textContent="Two Amsterdam districts with source buildings, streets, canals and inventory trees.",oe("patterns").closest("label").hidden=!0,oe("street-quiz").hidden=!1,oe("follow-route").hidden=!1,oe("machine-preview").checked=!1,oe("appearance").checked=!1,oe("machine-signs").checked=!0,oe("machine-signs-label").hidden=!1,oe("appearance").nextElementSibling.textContent="Audited source-wall coverage",oe("appearance-copy").textContent="Machine-observed storefronts and shop names are unreviewed. Machine wall colours are optional. The city-wide palette is a deterministic construction-era visualization prior. Switch to audited coverage: green means usable evidence, ochre means partial.";for(let t of["previous-frontage","next-frontage","refresh","review-heading","review-copy"])oe(t).hidden=!0;let n=oe("evidence-link");n.href="./panorama-audit.html",n.textContent="See the new street evidence \u2197";let e=oe("pipeline-link");e.href="./EXPANSION_DEMO_2026-09-10.md",e.textContent="What this demo proves",oe("release-status").textContent="Loading immutable expansion geometry\u2026",oe("view-label").textContent="Da Costa expansion \xB7 source geometry"}else oe("machine-preview").closest("label").hidden=!0,oe("labels").closest("label").hidden=!0,oe("route").closest("label").hidden=!0;Of().then(()=>{let n=Vn.get("frontage"),e=Vn.get("inspect");if(n)Vr(n);else if(vl("overview"),e){let t=$i().find(i=>i.id===e);t&&Ri(t.renderBuildingId||t.buildingId,t.id)}bu()}).catch(n=>{oe("loading").textContent=String(n),oe("loading").classList.add("error")});
/*! Bundled license information:

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/

var pi={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},mi={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},rh=0,ic=1,sh=2;var As=1,na=2,Tr=3,bn=0,Kt=1,Et=2,On=0,Ui=1,rc=2,sc=3,oc=4,oh=5;var ci=100,ah=101,lh=102,ch=103,uh=104,hh=200,dh=201,fh=202,ph=203,wo=204,To=205,mh=206,gh=207,_h=208,xh=209,yh=210,vh=211,bh=212,Mh=213,Sh=214,Eo=0,Ao=1,Ro=2,Oi=3,Co=4,Po=5,Io=6,Lo=7,ia=0,wh=1,Th=2,wn=0,ac=1,lc=2,cc=3,Rs=4,uc=5,hc=6,dc=7;var fc=300,gi=301,Gi=302,ra=303,sa=304,Cs=306,Do=1e3,Dn=1001,No=1002,Ot=1003,Eh=1004;var Ps=1005;var It=1006,oa=1007;var _i=1008;var Qt=1009,pc=1010,mc=1011,Er=1012,aa=1013,Tn=1014,fn=1015,Bn=1016,la=1017,ca=1018,Ar=1020,gc=35902,_c=35899,xc=1021,yc=1022,pn=1023,Nn=1026,xi=1027,ua=1028,ha=1029,yi=1030,da=1031;var fa=1033,Is=33776,Ls=33777,Ds=33778,Ns=33779,pa=35840,ma=35841,ga=35842,_a=35843,xa=36196,ya=37492,va=37496,ba=37488,Ma=37489,Fs=37490,Sa=37491,wa=37808,Ta=37809,Ea=37810,Aa=37811,Ra=37812,Ca=37813,Pa=37814,Ia=37815,La=37816,Da=37817,Na=37818,Fa=37819,Ua=37820,Oa=37821,Ba=36492,ka=36494,za=36495,Va=36283,Ga=36284,Us=36285,Ha=36286;var jr=2300,Fo=2301,So=2302,Hl=2303,Wl=2400,Xl=2401,ql=2402;var Ah=3200;var Os=0,Rh=1,jn="",Ut="srgb",Qr="srgb-linear",es="linear",et="srgb";var Ni=7680;var Yl=519,Ch=512,Ph=513,Ih=514,Wa=515,Lh=516,Dh=517,Xa=518,Nh=519,$l=35044;var vc="300 es",vn=2e3,fr=2001;function Wf(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function Xf(n){return ArrayBuffer.isView(n)&&!(n instanceof DataView)}function ts(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function Fh(){let n=ts("canvas");return n.style.display="block",n}var Pu={},pr=null;function bc(...n){let e="THREE."+n.shift();pr?pr("log",e,...n):console.log(e,...n)}function Uh(n){let e=n[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=n[1];t&&t.isStackTrace?n[0]+=" "+t.getLocation():n[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return n}function De(...n){n=Uh(n);let e="THREE."+n.shift();if(pr)pr("warn",e,...n);else{let t=n[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...n)}}function Ue(...n){n=Uh(n);let e="THREE."+n.shift();if(pr)pr("error",e,...n);else{let t=n[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...n)}}function Fi(...n){let e=n.join(" ");e in Pu||(Pu[e]=!0,De(...n))}function Oh(n,e,t){return new Promise(function(i,r){function s(){switch(n.clientWaitSync(e,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:r();break;case n.TIMEOUT_EXPIRED:setTimeout(s,t);break;default:i()}}setTimeout(s,t)})}var Bh={[Eo]:Ao,[Ro]:Io,[Co]:Lo,[Oi]:Po,[Ao]:Eo,[Io]:Ro,[Lo]:Co,[Po]:Oi},Mn=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){let i=this._listeners;return i===void 0?!1:i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){let i=this._listeners;if(i===void 0)return;let r=i[e];if(r!==void 0){let s=r.indexOf(t);s!==-1&&r.splice(s,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let i=t[e.type];if(i!==void 0){e.target=this;let r=i.slice(0);for(let s=0,o=r.length;s<o;s++)r[s].call(this,e);e.target=null}}},Vt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Iu=1234567,Kr=Math.PI/180,mr=180/Math.PI;function Rr(){let n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Vt[n&255]+Vt[n>>8&255]+Vt[n>>16&255]+Vt[n>>24&255]+"-"+Vt[e&255]+Vt[e>>8&255]+"-"+Vt[e>>16&15|64]+Vt[e>>24&255]+"-"+Vt[t&63|128]+Vt[t>>8&255]+"-"+Vt[t>>16&255]+Vt[t>>24&255]+Vt[i&255]+Vt[i>>8&255]+Vt[i>>16&255]+Vt[i>>24&255]).toLowerCase()}function Ze(n,e,t){return Math.max(e,Math.min(t,n))}function Mc(n,e){return(n%e+e)%e}function qf(n,e,t,i,r){return i+(n-e)*(r-i)/(t-e)}function Yf(n,e,t){return n!==e?(t-n)/(e-n):0}function Jr(n,e,t){return(1-t)*n+t*e}function $f(n,e,t,i){return Jr(n,e,1-Math.exp(-t*i))}function Zf(n,e=1){return e-Math.abs(Mc(n,e*2)-e)}function Kf(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*(3-2*n))}function Jf(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*n*(n*(n*6-15)+10))}function jf(n,e){return n+Math.floor(Math.random()*(e-n+1))}function Qf(n,e){return n+Math.random()*(e-n)}function ep(n){return n*(.5-Math.random())}function tp(n){n!==void 0&&(Iu=n);let e=Iu+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function np(n){return n*Kr}function ip(n){return n*mr}function rp(n){return(n&n-1)===0&&n!==0}function sp(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))}function op(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))}function ap(n,e,t,i,r){let s=Math.cos,o=Math.sin,a=s(t/2),l=o(t/2),c=s((e+i)/2),h=o((e+i)/2),p=s((e-i)/2),u=o((e-i)/2),f=s((i-e)/2),m=o((i-e)/2);switch(r){case"XYX":n.set(a*h,l*p,l*u,a*c);break;case"YZY":n.set(l*u,a*h,l*p,a*c);break;case"ZXZ":n.set(l*p,l*u,a*h,a*c);break;case"XZX":n.set(a*h,l*m,l*f,a*c);break;case"YXY":n.set(l*f,a*h,l*m,a*c);break;case"ZYZ":n.set(l*m,l*f,a*h,a*c);break;default:De("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+r)}}function hr(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function qt(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Sc={DEG2RAD:Kr,RAD2DEG:mr,generateUUID:Rr,clamp:Ze,euclideanModulo:Mc,mapLinear:qf,inverseLerp:Yf,lerp:Jr,damp:$f,pingpong:Zf,smoothstep:Kf,smootherstep:Jf,randInt:jf,randFloat:Qf,randFloatSpread:ep,seededRandom:tp,degToRad:np,radToDeg:ip,isPowerOfTwo:rp,ceilPowerOfTwo:sp,floorPowerOfTwo:op,setQuaternionFromProperEuler:ap,normalize:qt,denormalize:hr},Ee=class n{static{n.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,i=this.y,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6],this.y=r[1]*t+r[4]*i+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Ze(this.x,e.x,t.x),this.y=Ze(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=Ze(this.x,e,t),this.y=Ze(this.y,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Ze(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(Ze(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let i=Math.cos(t),r=Math.sin(t),s=this.x-e.x,o=this.y-e.y;return this.x=s*i-o*r+e.x,this.y=s*r+o*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},an=class{constructor(e=0,t=0,i=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=r}static slerpFlat(e,t,i,r,s,o,a){let l=i[r+0],c=i[r+1],h=i[r+2],p=i[r+3],u=s[o+0],f=s[o+1],m=s[o+2],v=s[o+3];if(p!==v||l!==u||c!==f||h!==m){let g=l*u+c*f+h*m+p*v;g<0&&(u=-u,f=-f,m=-m,v=-v,g=-g);let d=1-a;if(g<.9995){let M=Math.acos(g),w=Math.sin(M);d=Math.sin(d*M)/w,a=Math.sin(a*M)/w,l=l*d+u*a,c=c*d+f*a,h=h*d+m*a,p=p*d+v*a}else{l=l*d+u*a,c=c*d+f*a,h=h*d+m*a,p=p*d+v*a;let M=1/Math.sqrt(l*l+c*c+h*h+p*p);l*=M,c*=M,h*=M,p*=M}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=p}static multiplyQuaternionsFlat(e,t,i,r,s,o){let a=i[r],l=i[r+1],c=i[r+2],h=i[r+3],p=s[o],u=s[o+1],f=s[o+2],m=s[o+3];return e[t]=a*m+h*p+l*f-c*u,e[t+1]=l*m+h*u+c*p-a*f,e[t+2]=c*m+h*f+a*u-l*p,e[t+3]=h*m-a*p-l*u-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,r){return this._x=e,this._y=t,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let i=e._x,r=e._y,s=e._z,o=e._order,a=Math.cos,l=Math.sin,c=a(i/2),h=a(r/2),p=a(s/2),u=l(i/2),f=l(r/2),m=l(s/2);switch(o){case"XYZ":this._x=u*h*p+c*f*m,this._y=c*f*p-u*h*m,this._z=c*h*m+u*f*p,this._w=c*h*p-u*f*m;break;case"YXZ":this._x=u*h*p+c*f*m,this._y=c*f*p-u*h*m,this._z=c*h*m-u*f*p,this._w=c*h*p+u*f*m;break;case"ZXY":this._x=u*h*p-c*f*m,this._y=c*f*p+u*h*m,this._z=c*h*m+u*f*p,this._w=c*h*p-u*f*m;break;case"ZYX":this._x=u*h*p-c*f*m,this._y=c*f*p+u*h*m,this._z=c*h*m-u*f*p,this._w=c*h*p+u*f*m;break;case"YZX":this._x=u*h*p+c*f*m,this._y=c*f*p+u*h*m,this._z=c*h*m-u*f*p,this._w=c*h*p-u*f*m;break;case"XZY":this._x=u*h*p-c*f*m,this._y=c*f*p-u*h*m,this._z=c*h*m+u*f*p,this._w=c*h*p+u*f*m;break;default:De("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let i=t/2,r=Math.sin(i);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,i=t[0],r=t[4],s=t[8],o=t[1],a=t[5],l=t[9],c=t[2],h=t[6],p=t[10],u=i+a+p;if(u>0){let f=.5/Math.sqrt(u+1);this._w=.25/f,this._x=(h-l)*f,this._y=(s-c)*f,this._z=(o-r)*f}else if(i>a&&i>p){let f=2*Math.sqrt(1+i-a-p);this._w=(h-l)/f,this._x=.25*f,this._y=(r+o)/f,this._z=(s+c)/f}else if(a>p){let f=2*Math.sqrt(1+a-i-p);this._w=(s-c)/f,this._x=(r+o)/f,this._y=.25*f,this._z=(l+h)/f}else{let f=2*Math.sqrt(1+p-i-a);this._w=(o-r)/f,this._x=(s+c)/f,this._y=(l+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<1e-8?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Ze(this.dot(e),-1,1)))}rotateTowards(e,t){let i=this.angleTo(e);if(i===0)return this;let r=Math.min(1,t/i);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let i=e._x,r=e._y,s=e._z,o=e._w,a=t._x,l=t._y,c=t._z,h=t._w;return this._x=i*h+o*a+r*c-s*l,this._y=r*h+o*l+s*a-i*c,this._z=s*h+o*c+i*l-r*a,this._w=o*h-i*a-r*l-s*c,this._onChangeCallback(),this}slerp(e,t){let i=e._x,r=e._y,s=e._z,o=e._w,a=this.dot(e);a<0&&(i=-i,r=-r,s=-s,o=-o,a=-a);let l=1-t;if(a<.9995){let c=Math.acos(a),h=Math.sin(c);l=Math.sin(l*c)/h,t=Math.sin(t*c)/h,this._x=this._x*l+i*t,this._y=this._y*l+r*t,this._z=this._z*l+s*t,this._w=this._w*l+o*t,this._onChangeCallback()}else this._x=this._x*l+i*t,this._y=this._y*l+r*t,this._z=this._z*l+s*t,this._w=this._w*l+o*t,this.normalize();return this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),r=Math.sqrt(1-i),s=Math.sqrt(i);return this.set(r*Math.sin(e),r*Math.cos(e),s*Math.sin(t),s*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},B=class n{static{n.prototype.isVector3=!0}constructor(e=0,t=0,i=0){this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Lu.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Lu.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[3]*i+s[6]*r,this.y=s[1]*t+s[4]*i+s[7]*r,this.z=s[2]*t+s[5]*i+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,i=this.y,r=this.z,s=e.elements,o=1/(s[3]*t+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*t+s[4]*i+s[8]*r+s[12])*o,this.y=(s[1]*t+s[5]*i+s[9]*r+s[13])*o,this.z=(s[2]*t+s[6]*i+s[10]*r+s[14])*o,this}applyQuaternion(e){let t=this.x,i=this.y,r=this.z,s=e.x,o=e.y,a=e.z,l=e.w,c=2*(o*r-a*i),h=2*(a*t-s*r),p=2*(s*i-o*t);return this.x=t+l*c+o*p-a*h,this.y=i+l*h+a*c-s*p,this.z=r+l*p+s*h-o*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[4]*i+s[8]*r,this.y=s[1]*t+s[5]*i+s[9]*r,this.z=s[2]*t+s[6]*i+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Ze(this.x,e.x,t.x),this.y=Ze(this.y,e.y,t.y),this.z=Ze(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=Ze(this.x,e,t),this.y=Ze(this.y,e,t),this.z=Ze(this.z,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Ze(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let i=e.x,r=e.y,s=e.z,o=t.x,a=t.y,l=t.z;return this.x=r*l-s*a,this.y=s*o-i*l,this.z=i*a-r*o,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return bl.copy(this).projectOnVector(e),this.sub(bl)}reflect(e){return this.sub(bl.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(Ze(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y,r=this.z-e.z;return t*t+i*i+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){let r=Math.sin(t)*e;return this.x=r*Math.sin(i),this.y=Math.cos(t)*e,this.z=r*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},bl=new B,Lu=new an,ze=class n{static{n.prototype.isMatrix3=!0}constructor(e,t,i,r,s,o,a,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,o,a,l,c)}set(e,t,i,r,s,o,a,l,c){let h=this.elements;return h[0]=e,h[1]=r,h[2]=a,h[3]=t,h[4]=s,h[5]=l,h[6]=i,h[7]=o,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,r=t.elements,s=this.elements,o=i[0],a=i[3],l=i[6],c=i[1],h=i[4],p=i[7],u=i[2],f=i[5],m=i[8],v=r[0],g=r[3],d=r[6],M=r[1],w=r[4],x=r[7],R=r[2],b=r[5],C=r[8];return s[0]=o*v+a*M+l*R,s[3]=o*g+a*w+l*b,s[6]=o*d+a*x+l*C,s[1]=c*v+h*M+p*R,s[4]=c*g+h*w+p*b,s[7]=c*d+h*x+p*C,s[2]=u*v+f*M+m*R,s[5]=u*g+f*w+m*b,s[8]=u*d+f*x+m*C,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8];return t*o*h-t*a*c-i*s*h+i*a*l+r*s*c-r*o*l}invert(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8],p=h*o-a*c,u=a*l-h*s,f=c*s-o*l,m=t*p+i*u+r*f;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);let v=1/m;return e[0]=p*v,e[1]=(r*c-h*i)*v,e[2]=(a*i-r*o)*v,e[3]=u*v,e[4]=(h*t-r*l)*v,e[5]=(r*s-a*t)*v,e[6]=f*v,e[7]=(i*l-c*t)*v,e[8]=(o*t-i*s)*v,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,r,s,o,a){let l=Math.cos(s),c=Math.sin(s);return this.set(i*l,i*c,-i*(l*o+c*a)+o+e,-r*c,r*l,-r*(-c*o+l*a)+a+t,0,0,1),this}scale(e,t){return Fi("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Ml.makeScale(e,t)),this}rotate(e){return Fi("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Ml.makeRotation(-e)),this}translate(e,t){return Fi("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Ml.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,i=e.elements;for(let r=0;r<9;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}},Ml=new ze,Du=new ze().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Nu=new ze().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function lp(){let n={enabled:!0,workingColorSpace:Qr,spaces:{},convert:function(r,s,o){return this.enabled===!1||s===o||!s||!o||(this.spaces[s].transfer===et&&(r.r=$n(r.r),r.g=$n(r.g),r.b=$n(r.b)),this.spaces[s].primaries!==this.spaces[o].primaries&&(r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===et&&(r.r=dr(r.r),r.g=dr(r.g),r.b=dr(r.b))),r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){return r===jn?es:this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,o){return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,s){return Fi("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),n.workingToColorSpace(r,s)},toWorkingColorSpace:function(r,s){return Fi("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),n.colorSpaceToWorking(r,s)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],i=[.3127,.329];return n.define({[Qr]:{primaries:e,whitePoint:i,transfer:es,toXYZ:Du,fromXYZ:Nu,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Ut},outputColorSpaceConfig:{drawingBufferColorSpace:Ut}},[Ut]:{primaries:e,whitePoint:i,transfer:et,toXYZ:Du,fromXYZ:Nu,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Ut}}}),n}var Je=lp();function $n(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function dr(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}var ji,Uo=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let i;if(e instanceof HTMLCanvasElement)i=e;else{ji===void 0&&(ji=ts("canvas")),ji.width=e.width,ji.height=e.height;let r=ji.getContext("2d");e instanceof ImageData?r.putImageData(e,0,0):r.drawImage(e,0,0,e.width,e.height),i=ji}return i.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=ts("canvas");t.width=e.width,t.height=e.height;let i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);let r=i.getImageData(0,0,e.width,e.height),s=r.data;for(let o=0;o<s.length;o++)s[o]=$n(s[o]/255)*255;return i.putImageData(r,0,0),t}else if(e.data){let t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor($n(t[i]/255)*255):t[i]=$n(t[i]);return{data:t,width:e.width,height:e.height}}else return De("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},cp=0,gr=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:cp++}),this.uuid=Rr(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let i={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let o=0,a=r.length;o<a;o++)r[o].isDataTexture?s.push(Sl(r[o].image)):s.push(Sl(r[o]))}else s=Sl(r);i.url=s}return t||(e.images[this.uuid]=i),i}};function Sl(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?Uo.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(De("Texture: Unable to serialize Texture."),{})}var up=0,wl=new B,Zt=class n extends Mn{constructor(e=n.DEFAULT_IMAGE,t=n.DEFAULT_MAPPING,i=Dn,r=Dn,s=It,o=_i,a=pn,l=Qt,c=n.DEFAULT_ANISOTROPY,h=jn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:up++}),this.uuid=Rr(),this.name="",this.source=new gr(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new Ee(0,0),this.repeat=new Ee(1,1),this.center=new Ee(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new ze,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(wl).x}get height(){return this.source.getSize(wl).y}get depth(){return this.source.getSize(wl).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let i=e[t];if(i===void 0){De(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){De(`Texture.setValues(): property '${t}' does not exist.`);continue}r&&i&&r.isVector2&&i.isVector2||r&&i&&r.isVector3&&i.isVector3||r&&i&&r.isMatrix3&&i.isMatrix3?r.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==fc)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Do:e.x=e.x-Math.floor(e.x);break;case Dn:e.x=e.x<0?0:1;break;case No:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Do:e.y=e.y-Math.floor(e.y);break;case Dn:e.y=e.y<0?0:1;break;case No:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Zt.DEFAULT_IMAGE=null;Zt.DEFAULT_MAPPING=fc;Zt.DEFAULT_ANISOTROPY=1;var dt=class n{static{n.prototype.isVector4=!0}constructor(e=0,t=0,i=0,r=1){this.x=e,this.y=t,this.z=i,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,r){return this.x=e,this.y=t,this.z=i,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,i=this.y,r=this.z,s=this.w,o=e.elements;return this.x=o[0]*t+o[4]*i+o[8]*r+o[12]*s,this.y=o[1]*t+o[5]*i+o[9]*r+o[13]*s,this.z=o[2]*t+o[6]*i+o[10]*r+o[14]*s,this.w=o[3]*t+o[7]*i+o[11]*r+o[15]*s,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,r,s,l=e.elements,c=l[0],h=l[4],p=l[8],u=l[1],f=l[5],m=l[9],v=l[2],g=l[6],d=l[10];if(Math.abs(h-u)<.01&&Math.abs(p-v)<.01&&Math.abs(m-g)<.01){if(Math.abs(h+u)<.1&&Math.abs(p+v)<.1&&Math.abs(m+g)<.1&&Math.abs(c+f+d-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let w=(c+1)/2,x=(f+1)/2,R=(d+1)/2,b=(h+u)/4,C=(p+v)/4,_=(m+g)/4;return w>x&&w>R?w<.01?(i=0,r=.707106781,s=.707106781):(i=Math.sqrt(w),r=b/i,s=C/i):x>R?x<.01?(i=.707106781,r=0,s=.707106781):(r=Math.sqrt(x),i=b/r,s=_/r):R<.01?(i=.707106781,r=.707106781,s=0):(s=Math.sqrt(R),i=C/s,r=_/s),this.set(i,r,s,t),this}let M=Math.sqrt((g-m)*(g-m)+(p-v)*(p-v)+(u-h)*(u-h));return Math.abs(M)<.001&&(M=1),this.x=(g-m)/M,this.y=(p-v)/M,this.z=(u-h)/M,this.w=Math.acos((c+f+d-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Ze(this.x,e.x,t.x),this.y=Ze(this.y,e.y,t.y),this.z=Ze(this.z,e.z,t.z),this.w=Ze(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=Ze(this.x,e,t),this.y=Ze(this.y,e,t),this.z=Ze(this.z,e,t),this.w=Ze(this.w,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Ze(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Oo=class extends Mn{constructor(e=1,t=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:It,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=i.depth,this.scissor=new dt(0,0,e,t),this.scissorTest=!1,this.viewport=new dt(0,0,e,t),this.textures=[];let r={width:e,height:t,depth:i.depth},s=new Zt(r),o=i.count;for(let a=0;a<o;a++)this.textures[a]=s.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:It,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let r=0,s=this.textures.length;r<s;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=i,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,i=e.textures.length;t<i;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let r=Object.assign({},e.textures[t].image);this.textures[t].source=new gr(r)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},ln=class extends Oo{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}},ns=class extends Zt{constructor(e=null,t=1,i=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=Ot,this.minFilter=Ot,this.wrapR=Dn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var Bo=class extends Zt{constructor(e=null,t=1,i=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=Ot,this.minFilter=Ot,this.wrapR=Dn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var lt=class n{static{n.prototype.isMatrix4=!0}constructor(e,t,i,r,s,o,a,l,c,h,p,u,f,m,v,g){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,o,a,l,c,h,p,u,f,m,v,g)}set(e,t,i,r,s,o,a,l,c,h,p,u,f,m,v,g){let d=this.elements;return d[0]=e,d[4]=t,d[8]=i,d[12]=r,d[1]=s,d[5]=o,d[9]=a,d[13]=l,d[2]=c,d[6]=h,d[10]=p,d[14]=u,d[3]=f,d[7]=m,d[11]=v,d[15]=g,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new n().fromArray(this.elements)}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){let t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),i.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,i=e.elements,r=1/Qi.setFromMatrixColumn(e,0).length(),s=1/Qi.setFromMatrixColumn(e,1).length(),o=1/Qi.setFromMatrixColumn(e,2).length();return t[0]=i[0]*r,t[1]=i[1]*r,t[2]=i[2]*r,t[3]=0,t[4]=i[4]*s,t[5]=i[5]*s,t[6]=i[6]*s,t[7]=0,t[8]=i[8]*o,t[9]=i[9]*o,t[10]=i[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,i=e.x,r=e.y,s=e.z,o=Math.cos(i),a=Math.sin(i),l=Math.cos(r),c=Math.sin(r),h=Math.cos(s),p=Math.sin(s);if(e.order==="XYZ"){let u=o*h,f=o*p,m=a*h,v=a*p;t[0]=l*h,t[4]=-l*p,t[8]=c,t[1]=f+m*c,t[5]=u-v*c,t[9]=-a*l,t[2]=v-u*c,t[6]=m+f*c,t[10]=o*l}else if(e.order==="YXZ"){let u=l*h,f=l*p,m=c*h,v=c*p;t[0]=u+v*a,t[4]=m*a-f,t[8]=o*c,t[1]=o*p,t[5]=o*h,t[9]=-a,t[2]=f*a-m,t[6]=v+u*a,t[10]=o*l}else if(e.order==="ZXY"){let u=l*h,f=l*p,m=c*h,v=c*p;t[0]=u-v*a,t[4]=-o*p,t[8]=m+f*a,t[1]=f+m*a,t[5]=o*h,t[9]=v-u*a,t[2]=-o*c,t[6]=a,t[10]=o*l}else if(e.order==="ZYX"){let u=o*h,f=o*p,m=a*h,v=a*p;t[0]=l*h,t[4]=m*c-f,t[8]=u*c+v,t[1]=l*p,t[5]=v*c+u,t[9]=f*c-m,t[2]=-c,t[6]=a*l,t[10]=o*l}else if(e.order==="YZX"){let u=o*l,f=o*c,m=a*l,v=a*c;t[0]=l*h,t[4]=v-u*p,t[8]=m*p+f,t[1]=p,t[5]=o*h,t[9]=-a*h,t[2]=-c*h,t[6]=f*p+m,t[10]=u-v*p}else if(e.order==="XZY"){let u=o*l,f=o*c,m=a*l,v=a*c;t[0]=l*h,t[4]=-p,t[8]=c*h,t[1]=u*p+v,t[5]=o*h,t[9]=f*p-m,t[2]=m*p-f,t[6]=a*h,t[10]=v*p+u}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(hp,e,dp)}lookAt(e,t,i){let r=this.elements;return sn.subVectors(e,t),sn.lengthSq()===0&&(sn.z=1),sn.normalize(),ni.crossVectors(i,sn),ni.lengthSq()===0&&(Math.abs(i.z)===1?sn.x+=1e-4:sn.z+=1e-4,sn.normalize(),ni.crossVectors(i,sn)),ni.normalize(),Qs.crossVectors(sn,ni),r[0]=ni.x,r[4]=Qs.x,r[8]=sn.x,r[1]=ni.y,r[5]=Qs.y,r[9]=sn.y,r[2]=ni.z,r[6]=Qs.z,r[10]=sn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,r=t.elements,s=this.elements,o=i[0],a=i[4],l=i[8],c=i[12],h=i[1],p=i[5],u=i[9],f=i[13],m=i[2],v=i[6],g=i[10],d=i[14],M=i[3],w=i[7],x=i[11],R=i[15],b=r[0],C=r[4],_=r[8],E=r[12],T=r[1],A=r[5],P=r[9],D=r[13],N=r[2],F=r[6],k=r[10],L=r[14],U=r[3],G=r[7],Z=r[11],K=r[15];return s[0]=o*b+a*T+l*N+c*U,s[4]=o*C+a*A+l*F+c*G,s[8]=o*_+a*P+l*k+c*Z,s[12]=o*E+a*D+l*L+c*K,s[1]=h*b+p*T+u*N+f*U,s[5]=h*C+p*A+u*F+f*G,s[9]=h*_+p*P+u*k+f*Z,s[13]=h*E+p*D+u*L+f*K,s[2]=m*b+v*T+g*N+d*U,s[6]=m*C+v*A+g*F+d*G,s[10]=m*_+v*P+g*k+d*Z,s[14]=m*E+v*D+g*L+d*K,s[3]=M*b+w*T+x*N+R*U,s[7]=M*C+w*A+x*F+R*G,s[11]=M*_+w*P+x*k+R*Z,s[15]=M*E+w*D+x*L+R*K,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[4],r=e[8],s=e[12],o=e[1],a=e[5],l=e[9],c=e[13],h=e[2],p=e[6],u=e[10],f=e[14],m=e[3],v=e[7],g=e[11],d=e[15],M=l*f-c*u,w=a*f-c*p,x=a*u-l*p,R=o*f-c*h,b=o*u-l*h,C=o*p-a*h;return t*(v*M-g*w+d*x)-i*(m*M-g*R+d*b)+r*(m*w-v*R+d*C)-s*(m*x-v*b+g*C)}determinantAffine(){let e=this.elements,t=e[0],i=e[4],r=e[8],s=e[1],o=e[5],a=e[9],l=e[2],c=e[6],h=e[10];return t*(o*h-a*c)-i*(s*h-a*l)+r*(s*c-o*l)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=i),this}invert(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8],p=e[9],u=e[10],f=e[11],m=e[12],v=e[13],g=e[14],d=e[15],M=t*a-i*o,w=t*l-r*o,x=t*c-s*o,R=i*l-r*a,b=i*c-s*a,C=r*c-s*l,_=h*v-p*m,E=h*g-u*m,T=h*d-f*m,A=p*g-u*v,P=p*d-f*v,D=u*d-f*g,N=M*D-w*P+x*A+R*T-b*E+C*_;if(N===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let F=1/N;return e[0]=(a*D-l*P+c*A)*F,e[1]=(r*P-i*D-s*A)*F,e[2]=(v*C-g*b+d*R)*F,e[3]=(u*b-p*C-f*R)*F,e[4]=(l*T-o*D-c*E)*F,e[5]=(t*D-r*T+s*E)*F,e[6]=(g*x-m*C-d*w)*F,e[7]=(h*C-u*x+f*w)*F,e[8]=(o*P-a*T+c*_)*F,e[9]=(i*T-t*P-s*_)*F,e[10]=(m*b-v*x+d*M)*F,e[11]=(p*x-h*b-f*M)*F,e[12]=(a*E-o*A-l*_)*F,e[13]=(t*A-i*E+r*_)*F,e[14]=(v*w-m*R-g*M)*F,e[15]=(h*R-p*w+u*M)*F,this}scale(e){let t=this.elements,i=e.x,r=e.y,s=e.z;return t[0]*=i,t[4]*=r,t[8]*=s,t[1]*=i,t[5]*=r,t[9]*=s,t[2]*=i,t[6]*=r,t[10]*=s,t[3]*=i,t[7]*=r,t[11]*=s,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,r))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let i=Math.cos(t),r=Math.sin(t),s=1-i,o=e.x,a=e.y,l=e.z,c=s*o,h=s*a;return this.set(c*o+i,c*a-r*l,c*l+r*a,0,c*a+r*l,h*a+i,h*l-r*o,0,c*l-r*a,h*l+r*o,s*l*l+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,r,s,o){return this.set(1,i,s,0,e,1,o,0,t,r,1,0,0,0,0,1),this}compose(e,t,i){let r=this.elements,s=t._x,o=t._y,a=t._z,l=t._w,c=s+s,h=o+o,p=a+a,u=s*c,f=s*h,m=s*p,v=o*h,g=o*p,d=a*p,M=l*c,w=l*h,x=l*p,R=i.x,b=i.y,C=i.z;return r[0]=(1-(v+d))*R,r[1]=(f+x)*R,r[2]=(m-w)*R,r[3]=0,r[4]=(f-x)*b,r[5]=(1-(u+d))*b,r[6]=(g+M)*b,r[7]=0,r[8]=(m+w)*C,r[9]=(g-M)*C,r[10]=(1-(u+v))*C,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,i){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let s=this.determinantAffine();if(s===0)return i.set(1,1,1),t.identity(),this;let o=Qi.set(r[0],r[1],r[2]).length(),a=Qi.set(r[4],r[5],r[6]).length(),l=Qi.set(r[8],r[9],r[10]).length();s<0&&(o=-o),_n.copy(this);let c=1/o,h=1/a,p=1/l;return _n.elements[0]*=c,_n.elements[1]*=c,_n.elements[2]*=c,_n.elements[4]*=h,_n.elements[5]*=h,_n.elements[6]*=h,_n.elements[8]*=p,_n.elements[9]*=p,_n.elements[10]*=p,t.setFromRotationMatrix(_n),i.x=o,i.y=a,i.z=l,this}makePerspective(e,t,i,r,s,o,a=vn,l=!1){let c=this.elements,h=2*s/(t-e),p=2*s/(i-r),u=(t+e)/(t-e),f=(i+r)/(i-r),m,v;if(l)m=s/(o-s),v=o*s/(o-s);else if(a===vn)m=-(o+s)/(o-s),v=-2*o*s/(o-s);else if(a===fr)m=-o/(o-s),v=-o*s/(o-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=p,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=m,c[14]=v,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,i,r,s,o,a=vn,l=!1){let c=this.elements,h=2/(t-e),p=2/(i-r),u=-(t+e)/(t-e),f=-(i+r)/(i-r),m,v;if(l)m=1/(o-s),v=o/(o-s);else if(a===vn)m=-2/(o-s),v=-(o+s)/(o-s);else if(a===fr)m=-1/(o-s),v=-s/(o-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=0,c[12]=u,c[1]=0,c[5]=p,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=m,c[14]=v,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,i=e.elements;for(let r=0;r<16;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}},Qi=new B,_n=new lt,hp=new B(0,0,0),dp=new B(1,1,1),ni=new B,Qs=new B,sn=new B,Fu=new lt,Uu=new an,Fn=class n{constructor(e=0,t=0,i=0,r=n.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,r=this._order){return this._x=e,this._y=t,this._z=i,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){let r=e.elements,s=r[0],o=r[4],a=r[8],l=r[1],c=r[5],h=r[9],p=r[2],u=r[6],f=r[10];switch(t){case"XYZ":this._y=Math.asin(Ze(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-o,s)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Ze(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-p,s),this._z=0);break;case"ZXY":this._x=Math.asin(Ze(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-p,f),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-Ze(p,-1,1)),Math.abs(p)<.9999999?(this._x=Math.atan2(u,f),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(Ze(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-p,s)):(this._x=0,this._y=Math.atan2(a,f));break;case"XZY":this._z=Math.asin(-Ze(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(a,s)):(this._x=Math.atan2(-h,f),this._y=0);break;default:De("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return Fu.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Fu,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Uu.setFromEuler(this),this.setFromQuaternion(Uu,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Fn.DEFAULT_ORDER="XYZ";var _r=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},fp=0,Ou=new B,er=new an,Hn=new lt,eo=new B,Hr=new B,pp=new B,mp=new an,Bu=new B(1,0,0),ku=new B(0,1,0),zu=new B(0,0,1),Vu={type:"added"},gp={type:"removed"},tr={type:"childadded",child:null},Tl={type:"childremoved",child:null},Bt=class n extends Mn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:fp++}),this.uuid=Rr(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=n.DEFAULT_UP.clone();let e=new B,t=new Fn,i=new an,r=new B(1,1,1);function s(){i.setFromEuler(t,!1)}function o(){t.setFromQuaternion(i,void 0,!1)}t._onChange(s),i._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new lt},normalMatrix:{value:new ze}}),this.matrix=new lt,this.matrixWorld=new lt,this.matrixAutoUpdate=n.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=n.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new _r,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return er.setFromAxisAngle(e,t),this.quaternion.multiply(er),this}rotateOnWorldAxis(e,t){return er.setFromAxisAngle(e,t),this.quaternion.premultiply(er),this}rotateX(e){return this.rotateOnAxis(Bu,e)}rotateY(e){return this.rotateOnAxis(ku,e)}rotateZ(e){return this.rotateOnAxis(zu,e)}translateOnAxis(e,t){return Ou.copy(e).applyQuaternion(this.quaternion),this.position.add(Ou.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Bu,e)}translateY(e){return this.translateOnAxis(ku,e)}translateZ(e){return this.translateOnAxis(zu,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Hn.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?eo.copy(e):eo.set(e,t,i);let r=this.parent;this.updateWorldMatrix(!0,!1),Hr.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Hn.lookAt(Hr,eo,this.up):Hn.lookAt(eo,Hr,this.up),this.quaternion.setFromRotationMatrix(Hn),r&&(Hn.extractRotation(r.matrixWorld),er.setFromRotationMatrix(Hn),this.quaternion.premultiply(er.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Ue("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Vu),tr.child=e,this.dispatchEvent(tr),tr.child=null):Ue("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(gp),Tl.child=e,this.dispatchEvent(Tl),Tl.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Hn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Hn.multiply(e.parent.matrixWorld)),e.applyMatrix4(Hn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Vu),tr.child=e,this.dispatchEvent(tr),tr.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,r=this.children.length;i<r;i++){let o=this.children[i].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);let r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Hr,e,pp),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Hr,mp,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,i=e.y,r=e.z,s=this.matrix.elements;s[12]+=t-s[0]*t-s[4]*i-s[8]*r,s[13]+=i-s[1]*t-s[5]*i-s[9]*r,s[14]+=r-s[2]*t-s[6]*i-s[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].updateMatrixWorld(e)}updateWorldMatrix(e,t,i=!1){let r=this.parent;if(e===!0&&r!==null&&r.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),t===!0){let s=this.children;for(let o=0,a=s.length;o<a;o++)s[o].updateWorldMatrix(!1,!0,i)}}toJSON(e){let t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),this.static!==!1&&(r.static=this.static),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(a=>({...a})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function s(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let p=l[c];s(e.shapes,p)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(s(e.materials,this.material[l]));r.material=a}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let a=0;a<this.children.length;a++)r.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];r.animations.push(s(e.animations,l))}}if(t){let a=o(e.geometries),l=o(e.materials),c=o(e.textures),h=o(e.images),p=o(e.shapes),u=o(e.skeletons),f=o(e.animations),m=o(e.nodes);a.length>0&&(i.geometries=a),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),h.length>0&&(i.images=h),p.length>0&&(i.shapes=p),u.length>0&&(i.skeletons=u),f.length>0&&(i.animations=f),m.length>0&&(i.nodes=m)}return i.object=r,i;function o(a){let l=[];for(let c in a){let h=a[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){let r=e.children[i];this.add(r.clone())}return this}};Bt.DEFAULT_UP=new B(0,1,0);Bt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Bt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Yt=class extends Bt{constructor(){super(),this.isGroup=!0,this.type="Group"}},_p={type:"move"},xr=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Yt,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Yt,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new B,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new B),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Yt,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new B,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new B,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let r=null,s=null,o=null,a=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){o=!0;for(let v of e.hand.values()){let g=t.getJointPose(v,i),d=this._getHandJoint(c,v);g!==null&&(d.matrix.fromArray(g.transform.matrix),d.matrix.decompose(d.position,d.rotation,d.scale),d.matrixWorldNeedsUpdate=!0,d.jointRadius=g.radius),d.visible=g!==null}let h=c.joints["index-finger-tip"],p=c.joints["thumb-tip"],u=h.position.distanceTo(p.position),f=.02,m=.005;c.inputState.pinching&&u>f+m?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&u<=f-m&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,i),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));a!==null&&(r=t.getPose(e.targetRaySpace,i),r===null&&s!==null&&(r=s),r!==null&&(a.matrix.fromArray(r.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,r.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(r.linearVelocity)):a.hasLinearVelocity=!1,r.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(r.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(_p)))}return a!==null&&(a.visible=r!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let i=new Yt;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}},kh={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},ii={h:0,s:0,l:0},to={h:0,s:0,l:0};function El(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}var ke=class{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){let r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Ut){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Je.colorSpaceToWorking(this,t),this}setRGB(e,t,i,r=Je.workingColorSpace){return this.r=e,this.g=t,this.b=i,Je.colorSpaceToWorking(this,r),this}setHSL(e,t,i,r=Je.workingColorSpace){if(e=Mc(e,1),t=Ze(t,0,1),i=Ze(i,0,1),t===0)this.r=this.g=this.b=i;else{let s=i<=.5?i*(1+t):i+t-i*t,o=2*i-s;this.r=El(o,s,e+1/3),this.g=El(o,s,e),this.b=El(o,s,e-1/3)}return Je.colorSpaceToWorking(this,r),this}setStyle(e,t=Ut){function i(s){s!==void 0&&parseFloat(s)<1&&De("Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s,o=r[1],a=r[2];switch(o){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:De("Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let s=r[1],o=s.length;if(o===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(s,16),t);De("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Ut){let i=kh[e.toLowerCase()];return i!==void 0?this.setHex(i,t):De("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=$n(e.r),this.g=$n(e.g),this.b=$n(e.b),this}copyLinearToSRGB(e){return this.r=dr(e.r),this.g=dr(e.g),this.b=dr(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Ut){return Je.workingToColorSpace(Gt.copy(this),e),Math.round(Ze(Gt.r*255,0,255))*65536+Math.round(Ze(Gt.g*255,0,255))*256+Math.round(Ze(Gt.b*255,0,255))}getHexString(e=Ut){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Je.workingColorSpace){Je.workingToColorSpace(Gt.copy(this),t);let i=Gt.r,r=Gt.g,s=Gt.b,o=Math.max(i,r,s),a=Math.min(i,r,s),l,c,h=(a+o)/2;if(a===o)l=0,c=0;else{let p=o-a;switch(c=h<=.5?p/(o+a):p/(2-o-a),o){case i:l=(r-s)/p+(r<s?6:0);break;case r:l=(s-i)/p+2;break;case s:l=(i-r)/p+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=Je.workingColorSpace){return Je.workingToColorSpace(Gt.copy(this),t),e.r=Gt.r,e.g=Gt.g,e.b=Gt.b,e}getStyle(e=Ut){Je.workingToColorSpace(Gt.copy(this),e);let t=Gt.r,i=Gt.g,r=Gt.b;return e!==Ut?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(r*255)})`}offsetHSL(e,t,i){return this.getHSL(ii),this.setHSL(ii.h+e,ii.s+t,ii.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(ii),e.getHSL(to);let i=Jr(ii.h,to.h,t),r=Jr(ii.s,to.s,t),s=Jr(ii.l,to.l,t);return this.setHSL(i,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,i=this.g,r=this.b,s=e.elements;return this.r=s[0]*t+s[3]*i+s[6]*r,this.g=s[1]*t+s[4]*i+s[7]*r,this.b=s[2]*t+s[5]*i+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Gt=new ke;ke.NAMES=kh;var is=class n{constructor(e,t=1,i=1e3){this.isFog=!0,this.name="",this.color=new ke(e),this.near=t,this.far=i}clone(){return new n(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}},rs=class extends Bt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Fn,this.environmentIntensity=1,this.environmentRotation=new Fn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}},xn=new B,Wn=new B,Al=new B,Xn=new B,nr=new B,ir=new B,Gu=new B,Rl=new B,Cl=new B,Pl=new B,Il=new dt,Ll=new dt,Dl=new dt,li=class n{constructor(e=new B,t=new B,i=new B){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,r){r.subVectors(i,t),xn.subVectors(e,t),r.cross(xn);let s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(e,t,i,r,s){xn.subVectors(r,t),Wn.subVectors(i,t),Al.subVectors(e,t);let o=xn.dot(xn),a=xn.dot(Wn),l=xn.dot(Al),c=Wn.dot(Wn),h=Wn.dot(Al),p=o*c-a*a;if(p===0)return s.set(0,0,0),null;let u=1/p,f=(c*l-a*h)*u,m=(o*h-a*l)*u;return s.set(1-f-m,m,f)}static containsPoint(e,t,i,r){return this.getBarycoord(e,t,i,r,Xn)===null?!1:Xn.x>=0&&Xn.y>=0&&Xn.x+Xn.y<=1}static getInterpolation(e,t,i,r,s,o,a,l){return this.getBarycoord(e,t,i,r,Xn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,Xn.x),l.addScaledVector(o,Xn.y),l.addScaledVector(a,Xn.z),l)}static getInterpolatedAttribute(e,t,i,r,s,o){return Il.setScalar(0),Ll.setScalar(0),Dl.setScalar(0),Il.fromBufferAttribute(e,t),Ll.fromBufferAttribute(e,i),Dl.fromBufferAttribute(e,r),o.setScalar(0),o.addScaledVector(Il,s.x),o.addScaledVector(Ll,s.y),o.addScaledVector(Dl,s.z),o}static isFrontFacing(e,t,i,r){return xn.subVectors(i,t),Wn.subVectors(e,t),xn.cross(Wn).dot(r)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,r){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,i,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return xn.subVectors(this.c,this.b),Wn.subVectors(this.a,this.b),xn.cross(Wn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return n.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return n.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,r,s){return n.getInterpolation(e,this.a,this.b,this.c,t,i,r,s)}containsPoint(e){return n.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return n.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let i=this.a,r=this.b,s=this.c,o,a;nr.subVectors(r,i),ir.subVectors(s,i),Rl.subVectors(e,i);let l=nr.dot(Rl),c=ir.dot(Rl);if(l<=0&&c<=0)return t.copy(i);Cl.subVectors(e,r);let h=nr.dot(Cl),p=ir.dot(Cl);if(h>=0&&p<=h)return t.copy(r);let u=l*p-h*c;if(u<=0&&l>=0&&h<=0)return o=l/(l-h),t.copy(i).addScaledVector(nr,o);Pl.subVectors(e,s);let f=nr.dot(Pl),m=ir.dot(Pl);if(m>=0&&f<=m)return t.copy(s);let v=f*c-l*m;if(v<=0&&c>=0&&m<=0)return a=c/(c-m),t.copy(i).addScaledVector(ir,a);let g=h*m-f*p;if(g<=0&&p-h>=0&&f-m>=0)return Gu.subVectors(s,r),a=(p-h)/(p-h+(f-m)),t.copy(r).addScaledVector(Gu,a);let d=1/(g+v+u);return o=v*d,a=u*d,t.copy(i).addScaledVector(nr,o).addScaledVector(ir,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},Un=class{constructor(e=new B(1/0,1/0,1/0),t=new B(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(yn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(yn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let i=yn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let i=e.geometry;if(i!==void 0){let s=i.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=s.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,yn):yn.fromBufferAttribute(s,o),yn.applyMatrix4(e.matrixWorld),this.expandByPoint(yn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),no.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),no.copy(i.boundingBox)),no.applyMatrix4(e.matrixWorld),this.union(no)}let r=e.children;for(let s=0,o=r.length;s<o;s++)this.expandByObject(r[s],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,yn),yn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Wr),io.subVectors(this.max,Wr),rr.subVectors(e.a,Wr),sr.subVectors(e.b,Wr),or.subVectors(e.c,Wr),ri.subVectors(sr,rr),si.subVectors(or,sr),Pi.subVectors(rr,or);let t=[0,-ri.z,ri.y,0,-si.z,si.y,0,-Pi.z,Pi.y,ri.z,0,-ri.x,si.z,0,-si.x,Pi.z,0,-Pi.x,-ri.y,ri.x,0,-si.y,si.x,0,-Pi.y,Pi.x,0];return!Nl(t,rr,sr,or,io)||(t=[1,0,0,0,1,0,0,0,1],!Nl(t,rr,sr,or,io))?!1:(ro.crossVectors(ri,si),t=[ro.x,ro.y,ro.z],Nl(t,rr,sr,or,io))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,yn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(yn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(qn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),qn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),qn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),qn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),qn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),qn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),qn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),qn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(qn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},qn=[new B,new B,new B,new B,new B,new B,new B,new B],yn=new B,no=new Un,rr=new B,sr=new B,or=new B,ri=new B,si=new B,Pi=new B,Wr=new B,io=new B,ro=new B,Ii=new B;function Nl(n,e,t,i,r){for(let s=0,o=n.length-3;s<=o;s+=3){Ii.fromArray(n,s);let a=r.x*Math.abs(Ii.x)+r.y*Math.abs(Ii.y)+r.z*Math.abs(Ii.z),l=e.dot(Ii),c=t.dot(Ii),h=i.dot(Ii);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}var Rt=new B,so=new Ee,xp=0,$t=class extends Mn{constructor(e,t,i=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:xp++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=$l,this.updateRanges=[],this.gpuType=fn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let r=0,s=this.itemSize;r<s;r++)this.array[e+r]=t.array[i+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)so.fromBufferAttribute(this,t),so.applyMatrix3(e),this.setXY(t,so.x,so.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)Rt.fromBufferAttribute(this,t),Rt.applyMatrix3(e),this.setXYZ(t,Rt.x,Rt.y,Rt.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)Rt.fromBufferAttribute(this,t),Rt.applyMatrix4(e),this.setXYZ(t,Rt.x,Rt.y,Rt.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)Rt.fromBufferAttribute(this,t),Rt.applyNormalMatrix(e),this.setXYZ(t,Rt.x,Rt.y,Rt.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)Rt.fromBufferAttribute(this,t),Rt.transformDirection(e),this.setXYZ(t,Rt.x,Rt.y,Rt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=hr(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=qt(i,this.array)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=hr(t,this.array)),t}setX(e,t){return this.normalized&&(t=qt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=hr(t,this.array)),t}setY(e,t){return this.normalized&&(t=qt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=hr(t,this.array)),t}setZ(e,t){return this.normalized&&(t=qt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=hr(t,this.array)),t}setW(e,t){return this.normalized&&(t=qt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=qt(t,this.array),i=qt(i,this.array)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,r){return e*=this.itemSize,this.normalized&&(t=qt(t,this.array),i=qt(i,this.array),r=qt(r,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this}setXYZW(e,t,i,r,s){return e*=this.itemSize,this.normalized&&(t=qt(t,this.array),i=qt(i,this.array),r=qt(r,this.array),s=qt(s,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==$l&&(e.usage=this.usage),e}dispose(){this.dispatchEvent({type:"dispose"})}},ss=class extends $t{constructor(e,t,i){super(new Int8Array(e),t,i)}};var os=class extends $t{constructor(e,t,i){super(new Uint16Array(e),t,i)}};var as=class extends $t{constructor(e,t,i){super(new Uint32Array(e),t,i)}};var it=class extends $t{constructor(e,t,i){super(new Float32Array(e),t,i)}},yp=new Un,Xr=new B,Fl=new B,ui=class{constructor(e=new B,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let i=this.center;t!==void 0?i.copy(t):yp.setFromPoints(e).getCenter(i);let r=0;for(let s=0,o=e.length;s<o;s++)r=Math.max(r,i.distanceToSquared(e[s]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Xr.subVectors(e,this.center);let t=Xr.lengthSq();if(t>this.radius*this.radius){let i=Math.sqrt(t),r=(i-this.radius)*.5;this.center.addScaledVector(Xr,r/i),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Fl.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Xr.copy(e.center).add(Fl)),this.expandByPoint(Xr.copy(e.center).sub(Fl))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},vp=0,dn=new lt,Ul=new Bt,ar=new B,on=new Un,qr=new Un,Ft=new B,Tt=class n extends Mn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:vp++}),this.uuid=Rr(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Wf(e)?as:os)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let s=new ze().getNormalMatrix(e);i.applyNormalMatrix(s),i.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return dn.makeRotationFromQuaternion(e),this.applyMatrix4(dn),this}rotateX(e){return dn.makeRotationX(e),this.applyMatrix4(dn),this}rotateY(e){return dn.makeRotationY(e),this.applyMatrix4(dn),this}rotateZ(e){return dn.makeRotationZ(e),this.applyMatrix4(dn),this}translate(e,t,i){return dn.makeTranslation(e,t,i),this.applyMatrix4(dn),this}scale(e,t,i){return dn.makeScale(e,t,i),this.applyMatrix4(dn),this}lookAt(e){return Ul.lookAt(e),Ul.updateMatrix(),this.applyMatrix4(Ul.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ar).negate(),this.translate(ar.x,ar.y,ar.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let i=[];for(let r=0,s=e.length;r<s;r++){let o=e[r];i.push(o.x,o.y,o.z||0)}this.setAttribute("position",new it(i,3))}else{let i=Math.min(e.length,t.count);for(let r=0;r<i;r++){let s=e[r];t.setXYZ(r,s.x,s.y,s.z||0)}e.length>t.count&&De("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Un);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ue("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new B(-1/0,-1/0,-1/0),new B(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,r=t.length;i<r;i++){let s=t[i];on.setFromBufferAttribute(s),this.morphTargetsRelative?(Ft.addVectors(this.boundingBox.min,on.min),this.boundingBox.expandByPoint(Ft),Ft.addVectors(this.boundingBox.max,on.max),this.boundingBox.expandByPoint(Ft)):(this.boundingBox.expandByPoint(on.min),this.boundingBox.expandByPoint(on.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ue('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ui);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ue("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new B,1/0);return}if(e){let i=this.boundingSphere.center;if(on.setFromBufferAttribute(e),t)for(let s=0,o=t.length;s<o;s++){let a=t[s];qr.setFromBufferAttribute(a),this.morphTargetsRelative?(Ft.addVectors(on.min,qr.min),on.expandByPoint(Ft),Ft.addVectors(on.max,qr.max),on.expandByPoint(Ft)):(on.expandByPoint(qr.min),on.expandByPoint(qr.max))}on.getCenter(i);let r=0;for(let s=0,o=e.count;s<o;s++)Ft.fromBufferAttribute(e,s),r=Math.max(r,i.distanceToSquared(Ft));if(t)for(let s=0,o=t.length;s<o;s++){let a=t[s],l=this.morphTargetsRelative;for(let c=0,h=a.count;c<h;c++)Ft.fromBufferAttribute(a,c),l&&(ar.fromBufferAttribute(e,c),Ft.add(ar)),r=Math.max(r,i.distanceToSquared(Ft))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&Ue('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Ue("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=t.position,r=t.normal,s=t.uv,o=this.getAttribute("tangent");(o===void 0||o.count!==i.count)&&(o=new $t(new Float32Array(4*i.count),4),this.setAttribute("tangent",o));let a=[],l=[];for(let _=0;_<i.count;_++)a[_]=new B,l[_]=new B;let c=new B,h=new B,p=new B,u=new Ee,f=new Ee,m=new Ee,v=new B,g=new B;function d(_,E,T){c.fromBufferAttribute(i,_),h.fromBufferAttribute(i,E),p.fromBufferAttribute(i,T),u.fromBufferAttribute(s,_),f.fromBufferAttribute(s,E),m.fromBufferAttribute(s,T),h.sub(c),p.sub(c),f.sub(u),m.sub(u);let A=1/(f.x*m.y-m.x*f.y);isFinite(A)&&(v.copy(h).multiplyScalar(m.y).addScaledVector(p,-f.y).multiplyScalar(A),g.copy(p).multiplyScalar(f.x).addScaledVector(h,-m.x).multiplyScalar(A),a[_].add(v),a[E].add(v),a[T].add(v),l[_].add(g),l[E].add(g),l[T].add(g))}let M=this.groups;M.length===0&&(M=[{start:0,count:e.count}]);for(let _=0,E=M.length;_<E;++_){let T=M[_],A=T.start,P=T.count;for(let D=A,N=A+P;D<N;D+=3)d(e.getX(D+0),e.getX(D+1),e.getX(D+2))}let w=new B,x=new B,R=new B,b=new B;function C(_){R.fromBufferAttribute(r,_),b.copy(R);let E=a[_];w.copy(E),w.sub(R.multiplyScalar(R.dot(E))).normalize(),x.crossVectors(b,E);let A=x.dot(l[_])<0?-1:1;o.setXYZW(_,w.x,w.y,w.z,A)}for(let _=0,E=M.length;_<E;++_){let T=M[_],A=T.start,P=T.count;for(let D=A,N=A+P;D<N;D+=3)C(e.getX(D+0)),C(e.getX(D+1)),C(e.getX(D+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==t.count)i=new $t(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let u=0,f=i.count;u<f;u++)i.setXYZ(u,0,0,0);let r=new B,s=new B,o=new B,a=new B,l=new B,c=new B,h=new B,p=new B;if(e)for(let u=0,f=e.count;u<f;u+=3){let m=e.getX(u+0),v=e.getX(u+1),g=e.getX(u+2);r.fromBufferAttribute(t,m),s.fromBufferAttribute(t,v),o.fromBufferAttribute(t,g),h.subVectors(o,s),p.subVectors(r,s),h.cross(p),a.fromBufferAttribute(i,m),l.fromBufferAttribute(i,v),c.fromBufferAttribute(i,g),a.add(h),l.add(h),c.add(h),i.setXYZ(m,a.x,a.y,a.z),i.setXYZ(v,l.x,l.y,l.z),i.setXYZ(g,c.x,c.y,c.z)}else for(let u=0,f=t.count;u<f;u+=3)r.fromBufferAttribute(t,u+0),s.fromBufferAttribute(t,u+1),o.fromBufferAttribute(t,u+2),h.subVectors(o,s),p.subVectors(r,s),h.cross(p),i.setXYZ(u+0,h.x,h.y,h.z),i.setXYZ(u+1,h.x,h.y,h.z),i.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)Ft.fromBufferAttribute(e,t),Ft.normalize(),e.setXYZ(t,Ft.x,Ft.y,Ft.z)}toNonIndexed(){function e(a,l){let c=a.array,h=a.itemSize,p=a.normalized,u=new c.constructor(l.length*h),f=0,m=0;for(let v=0,g=l.length;v<g;v++){a.isInterleavedBufferAttribute?f=l[v]*a.data.stride+a.offset:f=l[v]*h;for(let d=0;d<h;d++)u[m++]=c[f++]}return new $t(u,h,p)}if(this.index===null)return De("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new n,i=this.index.array,r=this.attributes;for(let a in r){let l=r[a],c=e(l,i);t.setAttribute(a,c)}let s=this.morphAttributes;for(let a in s){let l=[],c=s[a];for(let h=0,p=c.length;h<p;h++){let u=c[h],f=e(u,i);l.push(f)}t.morphAttributes[a]=l}t.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let c=o[a];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let i=this.attributes;for(let l in i){let c=i[l];e.data.attributes[l]=c.toJSON(e.data)}let r={},s=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let p=0,u=c.length;p<u;p++){let f=c[p];h.push(f.toJSON(e.data))}h.length>0&&(r[l]=h,s=!0)}s&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(e.data.boundingSphere=a.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let i=e.index;i!==null&&this.setIndex(i.clone());let r=e.attributes;for(let c in r){let h=r[c];this.setAttribute(c,h.clone(t))}let s=e.morphAttributes;for(let c in s){let h=[],p=s[c];for(let u=0,f=p.length;u<f;u++)h.push(p[u].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;let o=e.groups;for(let c=0,h=o.length;c<h;c++){let p=o[c];this.addGroup(p.start,p.count,p.materialIndex)}let a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var bp=0,Zn=class extends Mn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:bp++}),this.uuid=Rr(),this.name="",this.type="Material",this.blending=Ui,this.side=bn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=wo,this.blendDst=To,this.blendEquation=ci,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new ke(0,0,0),this.blendAlpha=0,this.depthFunc=Oi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Yl,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Ni,this.stencilZFail=Ni,this.stencilZPass=Ni,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let i=e[t];if(i===void 0){De(`Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){De(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(i):r&&r.isVector2&&i&&i.isVector2||r&&r.isEuler&&i&&i.isEuler||r&&r.isVector3&&i&&i.isVector3?r.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Ui&&(i.blending=this.blending),this.side!==bn&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==wo&&(i.blendSrc=this.blendSrc),this.blendDst!==To&&(i.blendDst=this.blendDst),this.blendEquation!==ci&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==Oi&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Yl&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Ni&&(i.stencilFail=this.stencilFail),this.stencilZFail!==Ni&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==Ni&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.allowOverride===!1&&(i.allowOverride=!1),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function r(s){let o=[];for(let a in s){let l=s[a];delete l.metadata,o.push(l)}return o}if(t){let s=r(e.textures),o=r(e.images);s.length>0&&(i.textures=s),o.length>0&&(i.images=o)}return i}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new ke().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let i=e.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new Ee().fromArray(i)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Ee().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,i=null;if(t!==null){let r=t.length;i=new Array(r);for(let s=0;s!==r;++s)i[s]=t[s].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}};var Yn=new B,Ol=new B,oo=new B,oi=new B,Bl=new B,ao=new B,kl=new B,Bi=class{constructor(e=new B,t=new B(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Yn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Yn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Yn.copy(this.origin).addScaledVector(this.direction,t),Yn.distanceToSquared(e))}distanceSqToSegment(e,t,i,r){Ol.copy(e).add(t).multiplyScalar(.5),oo.copy(t).sub(e).normalize(),oi.copy(this.origin).sub(Ol);let s=e.distanceTo(t)*.5,o=-this.direction.dot(oo),a=oi.dot(this.direction),l=-oi.dot(oo),c=oi.lengthSq(),h=Math.abs(1-o*o),p,u,f,m;if(h>0)if(p=o*l-a,u=o*a-l,m=s*h,p>=0)if(u>=-m)if(u<=m){let v=1/h;p*=v,u*=v,f=p*(p+o*u+2*a)+u*(o*p+u+2*l)+c}else u=s,p=Math.max(0,-(o*u+a)),f=-p*p+u*(u+2*l)+c;else u=-s,p=Math.max(0,-(o*u+a)),f=-p*p+u*(u+2*l)+c;else u<=-m?(p=Math.max(0,-(-o*s+a)),u=p>0?-s:Math.min(Math.max(-s,-l),s),f=-p*p+u*(u+2*l)+c):u<=m?(p=0,u=Math.min(Math.max(-s,-l),s),f=u*(u+2*l)+c):(p=Math.max(0,-(o*s+a)),u=p>0?s:Math.min(Math.max(-s,-l),s),f=-p*p+u*(u+2*l)+c);else u=o>0?-s:s,p=Math.max(0,-(o*u+a)),f=-p*p+u*(u+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,p),r&&r.copy(Ol).addScaledVector(oo,u),f}intersectSphere(e,t){Yn.subVectors(e.center,this.origin);let i=Yn.dot(this.direction),r=Yn.dot(Yn)-i*i,s=e.radius*e.radius;if(r>s)return null;let o=Math.sqrt(s-r),a=i-o,l=i+o;return l<0?null:a<0?this.at(l,t):this.at(a,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){let i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,r,s,o,a,l,c=1/this.direction.x,h=1/this.direction.y,p=1/this.direction.z,u=this.origin;return c>=0?(i=(e.min.x-u.x)*c,r=(e.max.x-u.x)*c):(i=(e.max.x-u.x)*c,r=(e.min.x-u.x)*c),h>=0?(s=(e.min.y-u.y)*h,o=(e.max.y-u.y)*h):(s=(e.max.y-u.y)*h,o=(e.min.y-u.y)*h),i>o||s>r||((s>i||isNaN(i))&&(i=s),(o<r||isNaN(r))&&(r=o),p>=0?(a=(e.min.z-u.z)*p,l=(e.max.z-u.z)*p):(a=(e.max.z-u.z)*p,l=(e.min.z-u.z)*p),i>l||a>r)||((a>i||i!==i)&&(i=a),(l<r||r!==r)&&(r=l),r<0)?null:this.at(i>=0?i:r,t)}intersectsBox(e){return this.intersectBox(e,Yn)!==null}intersectTriangle(e,t,i,r,s){Bl.subVectors(t,e),ao.subVectors(i,e),kl.crossVectors(Bl,ao);let o=this.direction.dot(kl),a;if(o>0){if(r)return null;a=1}else if(o<0)a=-1,o=-o;else return null;oi.subVectors(this.origin,e);let l=a*this.direction.dot(ao.crossVectors(oi,ao));if(l<0)return null;let c=a*this.direction.dot(Bl.cross(oi));if(c<0||l+c>o)return null;let h=-a*oi.dot(kl);return h<0?null:this.at(h/o,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Kn=class extends Zn{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new ke(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Fn,this.combine=ia,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},Hu=new lt,Li=new Bi,lo=new ui,Wu=new B,co=new B,uo=new B,ho=new B,zl=new B,fo=new B,Xu=new B,po=new B,ft=class extends Bt{constructor(e=new Tt,t=new Kn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){let a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}getVertexPosition(e,t){let i=this.geometry,r=i.attributes.position,s=i.morphAttributes.position,o=i.morphTargetsRelative;t.fromBufferAttribute(r,e);let a=this.morphTargetInfluences;if(s&&a){fo.set(0,0,0);for(let l=0,c=s.length;l<c;l++){let h=a[l],p=s[l];h!==0&&(zl.fromBufferAttribute(p,e),o?fo.addScaledVector(zl,h):fo.addScaledVector(zl.sub(t),h))}t.add(fo)}return t}raycast(e,t){let i=this.geometry,r=this.material,s=this.matrixWorld;r!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),lo.copy(i.boundingSphere),lo.applyMatrix4(s),Li.copy(e.ray).recast(e.near),!(lo.containsPoint(Li.origin)===!1&&(Li.intersectSphere(lo,Wu)===null||Li.origin.distanceToSquared(Wu)>(e.far-e.near)**2))&&(Hu.copy(s).invert(),Li.copy(e.ray).applyMatrix4(Hu),!(i.boundingBox!==null&&Li.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,Li)))}_computeIntersections(e,t,i){let r,s=this.geometry,o=this.material,a=s.index,l=s.attributes.position,c=s.attributes.uv,h=s.attributes.uv1,p=s.attributes.normal,u=s.groups,f=s.drawRange;if(a!==null)if(Array.isArray(o))for(let m=0,v=u.length;m<v;m++){let g=u[m],d=o[g.materialIndex],M=Math.max(g.start,f.start),w=Math.min(a.count,Math.min(g.start+g.count,f.start+f.count));for(let x=M,R=w;x<R;x+=3){let b=a.getX(x),C=a.getX(x+1),_=a.getX(x+2);r=mo(this,d,e,i,c,h,p,b,C,_),r&&(r.faceIndex=Math.floor(x/3),r.face.materialIndex=g.materialIndex,t.push(r))}}else{let m=Math.max(0,f.start),v=Math.min(a.count,f.start+f.count);for(let g=m,d=v;g<d;g+=3){let M=a.getX(g),w=a.getX(g+1),x=a.getX(g+2);r=mo(this,o,e,i,c,h,p,M,w,x),r&&(r.faceIndex=Math.floor(g/3),t.push(r))}}else if(l!==void 0)if(Array.isArray(o))for(let m=0,v=u.length;m<v;m++){let g=u[m],d=o[g.materialIndex],M=Math.max(g.start,f.start),w=Math.min(l.count,Math.min(g.start+g.count,f.start+f.count));for(let x=M,R=w;x<R;x+=3){let b=x,C=x+1,_=x+2;r=mo(this,d,e,i,c,h,p,b,C,_),r&&(r.faceIndex=Math.floor(x/3),r.face.materialIndex=g.materialIndex,t.push(r))}}else{let m=Math.max(0,f.start),v=Math.min(l.count,f.start+f.count);for(let g=m,d=v;g<d;g+=3){let M=g,w=g+1,x=g+2;r=mo(this,o,e,i,c,h,p,M,w,x),r&&(r.faceIndex=Math.floor(g/3),t.push(r))}}}};function Mp(n,e,t,i,r,s,o,a){let l;if(e.side===Kt?l=i.intersectTriangle(o,s,r,!0,a):l=i.intersectTriangle(r,s,o,e.side===bn,a),l===null)return null;po.copy(a),po.applyMatrix4(n.matrixWorld);let c=t.ray.origin.distanceTo(po);return c<t.near||c>t.far?null:{distance:c,point:po.clone(),object:n}}function mo(n,e,t,i,r,s,o,a,l,c){n.getVertexPosition(a,co),n.getVertexPosition(l,uo),n.getVertexPosition(c,ho);let h=Mp(n,e,t,i,co,uo,ho,Xu);if(h){let p=new B;li.getBarycoord(Xu,co,uo,ho,p),r&&(h.uv=li.getInterpolatedAttribute(r,a,l,c,p,new Ee)),s&&(h.uv1=li.getInterpolatedAttribute(s,a,l,c,p,new Ee)),o&&(h.normal=li.getInterpolatedAttribute(o,a,l,c,p,new B),h.normal.dot(i.direction)>0&&h.normal.multiplyScalar(-1));let u={a,b:l,c,normal:new B,materialIndex:0};li.getNormal(co,uo,ho,u.normal),h.face=u,h.barycoord=p}return h}var ls=class extends Zt{constructor(e=null,t=1,i=1,r,s,o,a,l,c=Ot,h=Ot,p,u){super(null,o,a,l,c,h,r,s,p,u),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var cs=class extends $t{constructor(e,t,i,r=1){super(e,t,i),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},lr=new lt,qu=new lt,go=[],Yu=new Un,Sp=new lt,Yr=new ft,$r=new ui,us=class extends ft{constructor(e,t,i){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new cs(new Float32Array(i*16),16),this.instanceColor=null,this.morphTexture=null,this.count=i,this.boundingBox=null,this.boundingSphere=null;for(let r=0;r<i;r++)this.setMatrixAt(r,Sp)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new Un),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,lr),Yu.copy(e.boundingBox).applyMatrix4(lr),this.boundingBox.union(Yu)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new ui),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,lr),$r.copy(e.boundingSphere).applyMatrix4(lr),this.boundingSphere.union($r)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let i=t.morphTargetInfluences,r=this.morphTexture.source.data.data,s=i.length+1,o=e*s+1;for(let a=0;a<i.length;a++)i[a]=r[o+a]}raycast(e,t){let i=this.matrixWorld,r=this.count;if(Yr.geometry=this.geometry,Yr.material=this.material,Yr.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),$r.copy(this.boundingSphere),$r.applyMatrix4(i),e.ray.intersectsSphere($r)!==!1))for(let s=0;s<r;s++){this.getMatrixAt(s,lr),qu.multiplyMatrices(i,lr),Yr.matrixWorld=qu,Yr.raycast(e,go);for(let o=0,a=go.length;o<a;o++){let l=go[o];l.instanceId=s,l.object=this,t.push(l)}go.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new cs(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let i=t.morphTargetInfluences,r=i.length+1;this.morphTexture===null&&(this.morphTexture=new ls(new Float32Array(r*this.count),r,this.count,ua,fn));let s=this.morphTexture.source.data.data,o=0;for(let c=0;c<i.length;c++)o+=i[c];let a=this.geometry.morphTargetsRelative?1:1-o,l=r*e;return s[l]=a,s.set(i,l+1),this}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},Vl=new B,wp=new B,Tp=new ze,kt=class{constructor(e=new B(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,r){return this.normal.set(e,t,i),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){let r=Vl.subVectors(i,t).cross(wp.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,i=!0){let r=e.delta(Vl),s=this.normal.dot(r);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let o=-(e.start.dot(this.normal)+this.constant)/s;return i===!0&&(o<0||o>1)?null:t.copy(e.start).addScaledVector(r,o)}intersectsLine(e){let t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let i=t||Tp.getNormalMatrix(e),r=this.coplanarPoint(Vl).applyMatrix4(e),s=this.normal.applyMatrix3(i).normalize();return this.constant=-r.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},Di=new ui,Ep=new Ee(.5,.5),_o=new B,yr=class{constructor(e=new kt,t=new kt,i=new kt,r=new kt,s=new kt,o=new kt){this.planes=[e,t,i,r,s,o]}set(e,t,i,r,s,o){let a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(i),a[3].copy(r),a[4].copy(s),a[5].copy(o),this}copy(e){let t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=vn,i=!1){let r=this.planes,s=e.elements,o=s[0],a=s[1],l=s[2],c=s[3],h=s[4],p=s[5],u=s[6],f=s[7],m=s[8],v=s[9],g=s[10],d=s[11],M=s[12],w=s[13],x=s[14],R=s[15];if(r[0].setComponents(c-o,f-h,d-m,R-M).normalize(),r[1].setComponents(c+o,f+h,d+m,R+M).normalize(),r[2].setComponents(c+a,f+p,d+v,R+w).normalize(),r[3].setComponents(c-a,f-p,d-v,R-w).normalize(),i)r[4].setComponents(l,u,g,x).normalize(),r[5].setComponents(c-l,f-u,d-g,R-x).normalize();else if(r[4].setComponents(c-l,f-u,d-g,R-x).normalize(),t===vn)r[5].setComponents(c+l,f+u,d+g,R+x).normalize();else if(t===fr)r[5].setComponents(l,u,g,x).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Di.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Di.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Di)}intersectsSprite(e){Di.center.set(0,0,0);let t=Ep.distanceTo(e.center);return Di.radius=.7071067811865476+t,Di.applyMatrix4(e.matrixWorld),this.intersectsSphere(Di)}intersectsSphere(e){let t=this.planes,i=e.center,r=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(i)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let i=0;i<6;i++){let r=t[i];if(_o.x=r.normal.x>0?e.max.x:e.min.x,_o.y=r.normal.y>0?e.max.y:e.min.y,_o.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(_o)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var hs=class extends Zt{constructor(e=[],t=gi,i,r,s,o,a,l,c,h){super(e,t,i,r,s,o,a,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},vr=class extends Zt{constructor(e,t,i,r,s,o,a,l,c){super(e,t,i,r,s,o,a,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}};var Jn=class extends Zt{constructor(e,t,i=Tn,r,s,o,a=Ot,l=Ot,c,h=Nn,p=1){if(h!==Nn&&h!==xi)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let u={width:e,height:t,depth:p};super(u,r,s,o,a,l,h,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new gr(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},ko=class extends Jn{constructor(e,t=Tn,i=gi,r,s,o=Ot,a=Ot,l,c=Nn){let h={width:e,height:e,depth:1},p=[h,h,h,h,h,h];super(e,e,t,i,r,s,o,a,l,c),this.image=p,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},ds=class extends Zt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},br=class n extends Tt{constructor(e=1,t=1,i=1,r=1,s=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:r,heightSegments:s,depthSegments:o};let a=this;r=Math.floor(r),s=Math.floor(s),o=Math.floor(o);let l=[],c=[],h=[],p=[],u=0,f=0;m("z","y","x",-1,-1,i,t,e,o,s,0),m("z","y","x",1,-1,i,t,-e,o,s,1),m("x","z","y",1,1,e,i,t,r,o,2),m("x","z","y",1,-1,e,i,-t,r,o,3),m("x","y","z",1,-1,e,t,i,r,s,4),m("x","y","z",-1,-1,e,t,-i,r,s,5),this.setIndex(l),this.setAttribute("position",new it(c,3)),this.setAttribute("normal",new it(h,3)),this.setAttribute("uv",new it(p,2));function m(v,g,d,M,w,x,R,b,C,_,E){let T=x/C,A=R/_,P=x/2,D=R/2,N=b/2,F=C+1,k=_+1,L=0,U=0,G=new B;for(let Z=0;Z<k;Z++){let K=Z*A-D;for(let ne=0;ne<F;ne++){let ce=ne*T-P;G[v]=ce*M,G[g]=K*w,G[d]=N,c.push(G.x,G.y,G.z),G[v]=0,G[g]=0,G[d]=b>0?1:-1,h.push(G.x,G.y,G.z),p.push(ne/C),p.push(1-Z/_),L+=1}}for(let Z=0;Z<_;Z++)for(let K=0;K<C;K++){let ne=u+K+F*Z,ce=u+K+F*(Z+1),Ae=u+(K+1)+F*(Z+1),Re=u+(K+1)+F*Z;l.push(ne,ce,Re),l.push(ce,Ae,Re),U+=6}a.addGroup(f,U,E),f+=U,u+=L}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};var fs=class n extends Tt{constructor(e=1,t=1,i=1,r=32,s=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:i,radialSegments:r,heightSegments:s,openEnded:o,thetaStart:a,thetaLength:l};let c=this;r=Math.floor(r),s=Math.floor(s);let h=[],p=[],u=[],f=[],m=0,v=[],g=i/2,d=0;M(),o===!1&&(e>0&&w(!0),t>0&&w(!1)),this.setIndex(h),this.setAttribute("position",new it(p,3)),this.setAttribute("normal",new it(u,3)),this.setAttribute("uv",new it(f,2));function M(){let x=new B,R=new B,b=0,C=(t-e)/i;for(let _=0;_<=s;_++){let E=[],T=_/s,A=T*(t-e)+e;for(let P=0;P<=r;P++){let D=P/r,N=D*l+a,F=Math.sin(N),k=Math.cos(N);R.x=A*F,R.y=-T*i+g,R.z=A*k,p.push(R.x,R.y,R.z),x.set(F,C,k).normalize(),u.push(x.x,x.y,x.z),f.push(D,1-T),E.push(m++)}v.push(E)}for(let _=0;_<r;_++)for(let E=0;E<s;E++){let T=v[E][_],A=v[E+1][_],P=v[E+1][_+1],D=v[E][_+1];(e>0||E!==0)&&(h.push(T,A,D),b+=3),(t>0||E!==s-1)&&(h.push(A,P,D),b+=3)}c.addGroup(d,b,0),d+=b}function w(x){let R=m,b=new Ee,C=new B,_=0,E=x===!0?e:t,T=x===!0?1:-1;for(let P=1;P<=r;P++)p.push(0,g*T,0),u.push(0,T,0),f.push(.5,.5),m++;let A=m;for(let P=0;P<=r;P++){let N=P/r*l+a,F=Math.cos(N),k=Math.sin(N);C.x=E*k,C.y=g*T,C.z=E*F,p.push(C.x,C.y,C.z),u.push(0,T,0),b.x=F*.5+.5,b.y=k*.5*T+.5,f.push(b.x,b.y),m++}for(let P=0;P<r;P++){let D=R+P,N=A+P;x===!0?h.push(N,N+1,D):h.push(N+1,N,D),_+=3}c.addGroup(d,_,x===!0?1:2),d+=_}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}};var zo=class n extends Tt{constructor(e=[],t=[],i=1,r=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:i,detail:r};let s=[],o=[];a(r),c(i),h(),this.setAttribute("position",new it(s,3)),this.setAttribute("normal",new it(s.slice(),3)),this.setAttribute("uv",new it(o,2)),r===0?this.computeVertexNormals():this.normalizeNormals();function a(M){let w=new B,x=new B,R=new B;for(let b=0;b<t.length;b+=3)f(t[b+0],w),f(t[b+1],x),f(t[b+2],R),l(w,x,R,M)}function l(M,w,x,R){let b=R+1,C=[];for(let _=0;_<=b;_++){C[_]=[];let E=M.clone().lerp(x,_/b),T=w.clone().lerp(x,_/b),A=b-_;for(let P=0;P<=A;P++)P===0&&_===b?C[_][P]=E:C[_][P]=E.clone().lerp(T,P/A)}for(let _=0;_<b;_++)for(let E=0;E<2*(b-_)-1;E++){let T=Math.floor(E/2);E%2===0?(u(C[_][T+1]),u(C[_+1][T]),u(C[_][T])):(u(C[_][T+1]),u(C[_+1][T+1]),u(C[_+1][T]))}}function c(M){let w=new B;for(let x=0;x<s.length;x+=3)w.x=s[x+0],w.y=s[x+1],w.z=s[x+2],w.normalize().multiplyScalar(M),s[x+0]=w.x,s[x+1]=w.y,s[x+2]=w.z}function h(){let M=new B;for(let w=0;w<s.length;w+=3){M.x=s[w+0],M.y=s[w+1],M.z=s[w+2];let x=g(M)/2/Math.PI+.5,R=d(M)/Math.PI+.5;o.push(x,1-R)}m(),p()}function p(){for(let M=0;M<o.length;M+=6){let w=o[M+0],x=o[M+2],R=o[M+4],b=Math.max(w,x,R),C=Math.min(w,x,R);b>.9&&C<.1&&(w<.2&&(o[M+0]+=1),x<.2&&(o[M+2]+=1),R<.2&&(o[M+4]+=1))}}function u(M){s.push(M.x,M.y,M.z)}function f(M,w){let x=M*3;w.x=e[x+0],w.y=e[x+1],w.z=e[x+2]}function m(){let M=new B,w=new B,x=new B,R=new B,b=new Ee,C=new Ee,_=new Ee;for(let E=0,T=0;E<s.length;E+=9,T+=6){M.set(s[E+0],s[E+1],s[E+2]),w.set(s[E+3],s[E+4],s[E+5]),x.set(s[E+6],s[E+7],s[E+8]),b.set(o[T+0],o[T+1]),C.set(o[T+2],o[T+3]),_.set(o[T+4],o[T+5]),R.copy(M).add(w).add(x).divideScalar(3);let A=g(R);v(b,T+0,M,A),v(C,T+2,w,A),v(_,T+4,x,A)}}function v(M,w,x,R){R<0&&M.x===1&&(o[w]=M.x-1),x.x===0&&x.z===0&&(o[w]=R/2/Math.PI+.5)}function g(M){return Math.atan2(M.z,-M.x)}function d(M){return Math.atan2(-M.y,Math.sqrt(M.x*M.x+M.z*M.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.vertices,e.indices,e.radius,e.detail)}};function Ap(n,e,t=2){let i=e&&e.length,r=i?e[0]*t:n.length,s=zh(n,0,r,t,!0),o=[];if(!s||s.next===s.prev)return o;let a,l,c;if(i&&(s=Lp(n,e,s,t)),n.length>80*t){a=n[0],l=n[1];let h=a,p=l;for(let u=t;u<r;u+=t){let f=n[u],m=n[u+1];f<a&&(a=f),m<l&&(l=m),f>h&&(h=f),m>p&&(p=m)}c=Math.max(h-a,p-l),c=c!==0?32767/c:0}return ps(s,o,t,a,l,c,0),o}function zh(n,e,t,i,r){let s;if(r===Hp(n,e,t,i)>0)for(let o=e;o<t;o+=i)s=$u(o/i|0,n[o],n[o+1],s);else for(let o=t-i;o>=e;o-=i)s=$u(o/i|0,n[o],n[o+1],s);return s&&Mr(s,s.next)&&(gs(s),s=s.next),s}function ki(n,e){if(!n)return n;e||(e=n);let t=n,i;do if(i=!1,!t.steiner&&(Mr(t,t.next)||mt(t.prev,t,t.next)===0)){if(gs(t),t=e=t.prev,t===t.next)break;i=!0}else t=t.next;while(i||t!==e);return e}function ps(n,e,t,i,r,s,o){if(!n)return;!o&&s&&Op(n,i,r,s);let a=n;for(;n.prev!==n.next;){let l=n.prev,c=n.next;if(s?Cp(n,i,r,s):Rp(n)){e.push(l.i,n.i,c.i),gs(n),n=c.next,a=c.next;continue}if(n=c,n===a){o?o===1?(n=Pp(ki(n),e),ps(n,e,t,i,r,s,2)):o===2&&Ip(n,e,t,i,r,s):ps(ki(n),e,t,i,r,s,1);break}}}function Rp(n){let e=n.prev,t=n,i=n.next;if(mt(e,t,i)>=0)return!1;let r=e.x,s=t.x,o=i.x,a=e.y,l=t.y,c=i.y,h=Math.min(r,s,o),p=Math.min(a,l,c),u=Math.max(r,s,o),f=Math.max(a,l,c),m=i.next;for(;m!==e;){if(m.x>=h&&m.x<=u&&m.y>=p&&m.y<=f&&Zr(r,a,s,l,o,c,m.x,m.y)&&mt(m.prev,m,m.next)>=0)return!1;m=m.next}return!0}function Cp(n,e,t,i){let r=n.prev,s=n,o=n.next;if(mt(r,s,o)>=0)return!1;let a=r.x,l=s.x,c=o.x,h=r.y,p=s.y,u=o.y,f=Math.min(a,l,c),m=Math.min(h,p,u),v=Math.max(a,l,c),g=Math.max(h,p,u),d=Zl(f,m,e,t,i),M=Zl(v,g,e,t,i),w=n.prevZ,x=n.nextZ;for(;w&&w.z>=d&&x&&x.z<=M;){if(w.x>=f&&w.x<=v&&w.y>=m&&w.y<=g&&w!==r&&w!==o&&Zr(a,h,l,p,c,u,w.x,w.y)&&mt(w.prev,w,w.next)>=0||(w=w.prevZ,x.x>=f&&x.x<=v&&x.y>=m&&x.y<=g&&x!==r&&x!==o&&Zr(a,h,l,p,c,u,x.x,x.y)&&mt(x.prev,x,x.next)>=0))return!1;x=x.nextZ}for(;w&&w.z>=d;){if(w.x>=f&&w.x<=v&&w.y>=m&&w.y<=g&&w!==r&&w!==o&&Zr(a,h,l,p,c,u,w.x,w.y)&&mt(w.prev,w,w.next)>=0)return!1;w=w.prevZ}for(;x&&x.z<=M;){if(x.x>=f&&x.x<=v&&x.y>=m&&x.y<=g&&x!==r&&x!==o&&Zr(a,h,l,p,c,u,x.x,x.y)&&mt(x.prev,x,x.next)>=0)return!1;x=x.nextZ}return!0}function Pp(n,e){let t=n;do{let i=t.prev,r=t.next.next;!Mr(i,r)&&Gh(i,t,t.next,r)&&ms(i,r)&&ms(r,i)&&(e.push(i.i,t.i,r.i),gs(t),gs(t.next),t=n=r),t=t.next}while(t!==n);return ki(t)}function Ip(n,e,t,i,r,s){let o=n;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&zp(o,a)){let l=Hh(o,a);o=ki(o,o.next),l=ki(l,l.next),ps(o,e,t,i,r,s,0),ps(l,e,t,i,r,s,0);return}a=a.next}o=o.next}while(o!==n)}function Lp(n,e,t,i){let r=[];for(let s=0,o=e.length;s<o;s++){let a=e[s]*i,l=s<o-1?e[s+1]*i:n.length,c=zh(n,a,l,i,!1);c===c.next&&(c.steiner=!0),r.push(kp(c))}r.sort(Dp);for(let s=0;s<r.length;s++)t=Np(r[s],t);return t}function Dp(n,e){let t=n.x-e.x;if(t===0&&(t=n.y-e.y,t===0)){let i=(n.next.y-n.y)/(n.next.x-n.x),r=(e.next.y-e.y)/(e.next.x-e.x);t=i-r}return t}function Np(n,e){let t=Fp(n,e);if(!t)return e;let i=Hh(t,n);return ki(i,i.next),ki(t,t.next)}function Fp(n,e){let t=e,i=n.x,r=n.y,s=-1/0,o;if(Mr(n,t))return t;do{if(Mr(n,t.next))return t.next;if(r<=t.y&&r>=t.next.y&&t.next.y!==t.y){let p=t.x+(r-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(p<=i&&p>s&&(s=p,o=t.x<t.next.x?t:t.next,p===i))return o}t=t.next}while(t!==e);if(!o)return null;let a=o,l=o.x,c=o.y,h=1/0;t=o;do{if(i>=t.x&&t.x>=l&&i!==t.x&&Vh(r<c?i:s,r,l,c,r<c?s:i,r,t.x,t.y)){let p=Math.abs(r-t.y)/(i-t.x);ms(t,n)&&(p<h||p===h&&(t.x>o.x||t.x===o.x&&Up(o,t)))&&(o=t,h=p)}t=t.next}while(t!==a);return o}function Up(n,e){return mt(n.prev,n,e.prev)<0&&mt(e.next,n,n.next)<0}function Op(n,e,t,i){let r=n;do r.z===0&&(r.z=Zl(r.x,r.y,e,t,i)),r.prevZ=r.prev,r.nextZ=r.next,r=r.next;while(r!==n);r.prevZ.nextZ=null,r.prevZ=null,Bp(r)}function Bp(n){let e,t=1;do{let i=n,r;n=null;let s=null;for(e=0;i;){e++;let o=i,a=0;for(let c=0;c<t&&(a++,o=o.nextZ,!!o);c++);let l=t;for(;a>0||l>0&&o;)a!==0&&(l===0||!o||i.z<=o.z)?(r=i,i=i.nextZ,a--):(r=o,o=o.nextZ,l--),s?s.nextZ=r:n=r,r.prevZ=s,s=r;i=o}s.nextZ=null,t*=2}while(e>1);return n}function Zl(n,e,t,i,r){return n=(n-t)*r|0,e=(e-i)*r|0,n=(n|n<<8)&16711935,n=(n|n<<4)&252645135,n=(n|n<<2)&858993459,n=(n|n<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,n|e<<1}function kp(n){let e=n,t=n;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==n);return t}function Vh(n,e,t,i,r,s,o,a){return(r-o)*(e-a)>=(n-o)*(s-a)&&(n-o)*(i-a)>=(t-o)*(e-a)&&(t-o)*(s-a)>=(r-o)*(i-a)}function Zr(n,e,t,i,r,s,o,a){return!(n===o&&e===a)&&Vh(n,e,t,i,r,s,o,a)}function zp(n,e){return n.next.i!==e.i&&n.prev.i!==e.i&&!Vp(n,e)&&(ms(n,e)&&ms(e,n)&&Gp(n,e)&&(mt(n.prev,n,e.prev)||mt(n,e.prev,e))||Mr(n,e)&&mt(n.prev,n,n.next)>0&&mt(e.prev,e,e.next)>0)}function mt(n,e,t){return(e.y-n.y)*(t.x-e.x)-(e.x-n.x)*(t.y-e.y)}function Mr(n,e){return n.x===e.x&&n.y===e.y}function Gh(n,e,t,i){let r=yo(mt(n,e,t)),s=yo(mt(n,e,i)),o=yo(mt(t,i,n)),a=yo(mt(t,i,e));return!!(r!==s&&o!==a||r===0&&xo(n,t,e)||s===0&&xo(n,i,e)||o===0&&xo(t,n,i)||a===0&&xo(t,e,i))}function xo(n,e,t){return e.x<=Math.max(n.x,t.x)&&e.x>=Math.min(n.x,t.x)&&e.y<=Math.max(n.y,t.y)&&e.y>=Math.min(n.y,t.y)}function yo(n){return n>0?1:n<0?-1:0}function Vp(n,e){let t=n;do{if(t.i!==n.i&&t.next.i!==n.i&&t.i!==e.i&&t.next.i!==e.i&&Gh(t,t.next,n,e))return!0;t=t.next}while(t!==n);return!1}function ms(n,e){return mt(n.prev,n,n.next)<0?mt(n,e,n.next)>=0&&mt(n,n.prev,e)>=0:mt(n,e,n.prev)<0||mt(n,n.next,e)<0}function Gp(n,e){let t=n,i=!1,r=(n.x+e.x)/2,s=(n.y+e.y)/2;do t.y>s!=t.next.y>s&&t.next.y!==t.y&&r<(t.next.x-t.x)*(s-t.y)/(t.next.y-t.y)+t.x&&(i=!i),t=t.next;while(t!==n);return i}function Hh(n,e){let t=Kl(n.i,n.x,n.y),i=Kl(e.i,e.x,e.y),r=n.next,s=e.prev;return n.next=e,e.prev=n,t.next=r,r.prev=t,i.next=t,t.prev=i,s.next=i,i.prev=s,i}function $u(n,e,t,i){let r=Kl(n,e,t);return i?(r.next=i.next,r.prev=i,i.next.prev=r,i.next=r):(r.prev=r,r.next=r),r}function gs(n){n.next.prev=n.prev,n.prev.next=n.next,n.prevZ&&(n.prevZ.nextZ=n.nextZ),n.nextZ&&(n.nextZ.prevZ=n.prevZ)}function Kl(n,e,t){return{i:n,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function Hp(n,e,t,i){let r=0;for(let s=e,o=t-i;s<t;s+=i)r+=(n[o]-n[s])*(n[s+1]+n[o+1]),o=s;return r}var Jl=class{static triangulate(e,t,i=2){return Ap(e,t,i)}},zi=class n{static area(e){let t=e.length,i=0;for(let r=t-1,s=0;s<t;r=s++)i+=e[r].x*e[s].y-e[s].x*e[r].y;return i*.5}static isClockWise(e){return n.area(e)<0}static triangulateShape(e,t){let i=[],r=[],s=[];Zu(e),Ku(i,e);let o=e.length;t.forEach(Zu);for(let l=0;l<t.length;l++)r.push(o),o+=t[l].length,Ku(i,t[l]);let a=Jl.triangulate(i,r);for(let l=0;l<a.length;l+=3)s.push(a.slice(l,l+3));return s}};function Zu(n){let e=n.length;e>2&&n[e-1].equals(n[0])&&n.pop()}function Ku(n,e){for(let t=0;t<e.length;t++)n.push(e[t].x),n.push(e[t].y)}var _s=class n extends zo{constructor(e=1,t=0){let i=(1+Math.sqrt(5))/2,r=[-1,i,0,1,i,0,-1,-i,0,1,-i,0,0,-1,i,0,1,i,0,-1,-i,0,1,-i,i,0,-1,i,0,1,-i,0,-1,-i,0,1],s=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(r,s,e,t),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new n(e.radius,e.detail)}};var Vi=class n extends Tt{constructor(e=1,t=1,i=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:r};let s=e/2,o=t/2,a=Math.floor(i),l=Math.floor(r),c=a+1,h=l+1,p=e/a,u=t/l,f=[],m=[],v=[],g=[];for(let d=0;d<h;d++){let M=d*u-o;for(let w=0;w<c;w++){let x=w*p-s;m.push(x,-M,0),v.push(0,0,1),g.push(w/a),g.push(1-d/l)}}for(let d=0;d<l;d++)for(let M=0;M<a;M++){let w=M+c*d,x=M+c*(d+1),R=M+1+c*(d+1),b=M+1+c*d;f.push(w,x,b),f.push(x,R,b)}this.setIndex(f),this.setAttribute("position",new it(m,3)),this.setAttribute("normal",new it(v,3)),this.setAttribute("uv",new it(g,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.widthSegments,e.heightSegments)}};function Hi(n){let e={};for(let t in n){e[t]={};for(let i in n[t]){let r=n[t][i];if(Ju(r))r.isRenderTargetTexture?(De("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=r.clone();else if(Array.isArray(r))if(Ju(r[0])){let s=[];for(let o=0,a=r.length;o<a;o++)s[o]=r[o].clone();e[t][i]=s}else e[t][i]=r.slice();else e[t][i]=r}}return e}function Wt(n){let e={};for(let t=0;t<n.length;t++){let i=Hi(n[t]);for(let r in i)e[r]=i[r]}return e}function Ju(n){return n&&(n.isColor||n.isMatrix3||n.isMatrix4||n.isVector2||n.isVector3||n.isVector4||n.isTexture||n.isQuaternion)}function Wp(n){let e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function wc(n){let e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Je.workingColorSpace}var Wh={clone:Hi,merge:Wt},Xp=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,qp=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,cn=class extends Zn{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Xp,this.fragmentShader=qp,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Hi(e.uniforms),this.uniformsGroups=Wp(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let r in this.uniforms){let o=this.uniforms[r].value;o&&o.isTexture?t.uniforms[r]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[r]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[r]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[r]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[r]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[r]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[r]={type:"m4",value:o.toArray()}:t.uniforms[r]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let i={};for(let r in this.extensions)this.extensions[r]===!0&&(i[r]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let i in e.uniforms){let r=e.uniforms[i];switch(this.uniforms[i]={},r.type){case"t":this.uniforms[i].value=t[r.value]||null;break;case"c":this.uniforms[i].value=new ke().setHex(r.value);break;case"v2":this.uniforms[i].value=new Ee().fromArray(r.value);break;case"v3":this.uniforms[i].value=new B().fromArray(r.value);break;case"v4":this.uniforms[i].value=new dt().fromArray(r.value);break;case"m3":this.uniforms[i].value=new ze().fromArray(r.value);break;case"m4":this.uniforms[i].value=new lt().fromArray(r.value);break;default:this.uniforms[i].value=r.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let i in e.extensions)this.extensions[i]=e.extensions[i];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},Vo=class extends cn{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},Sn=class extends Zn{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new ke(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ke(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Os,this.normalScale=new Ee(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Fn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},xs=class extends Sn{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new Ee(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return Ze(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new ke(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new ke(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new ke(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}};var ys=class extends Zn{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new ke(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ke(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Os,this.normalScale=new Ee(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Fn,this.combine=ia,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},Go=class extends Zn{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Ah,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},Ho=class extends Zn{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function vo(n,e){return!n||n.constructor===e?n:typeof e.BYTES_PER_ELEMENT=="number"?new e(n):Array.prototype.slice.call(n)}var hi=class{constructor(e,t,i,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r!==void 0?r:new t.constructor(i),this.sampleValues=t,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,i=this._cachedIndex,r=t[i],s=t[i-1];n:{e:{let o;t:{i:if(!(e<r)){for(let a=i+2;;){if(r===void 0){if(e<s)break i;return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===a)break;if(s=r,r=t[++i],e<r)break e}o=t.length;break t}if(!(e>=s)){let a=t[1];e<a&&(i=2,s=a);for(let l=i-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(r=s,s=t[--i-1],e>=s)break e}o=i,i=0;break t}break n}for(;i<o;){let a=i+o>>>1;e<t[a]?o=a:i=a+1}if(r=t[i],s=t[i-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,s,r)}return this.interpolate_(i,s,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,i=this.sampleValues,r=this.valueSize,s=e*r;for(let o=0;o!==r;++o)t[o]=i[s+o];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},Wo=class extends hi{constructor(e,t,i,r){super(e,t,i,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Wl,endingEnd:Wl}}intervalChanged_(e,t,i){let r=this.parameterPositions,s=e-2,o=e+1,a=r[s],l=r[o];if(a===void 0)switch(this.getSettings_().endingStart){case Xl:s=e,a=2*t-i;break;case ql:s=r.length-2,a=t+r[s]-r[s+1];break;default:s=e,a=i}if(l===void 0)switch(this.getSettings_().endingEnd){case Xl:o=e,l=2*i-t;break;case ql:o=1,l=i+r[1]-r[0];break;default:o=e-1,l=t}let c=(i-t)*.5,h=this.valueSize;this._weightPrev=c/(t-a),this._weightNext=c/(l-i),this._offsetPrev=s*h,this._offsetNext=o*h}interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=this._offsetPrev,p=this._offsetNext,u=this._weightPrev,f=this._weightNext,m=(i-t)/(r-t),v=m*m,g=v*m,d=-u*g+2*u*v-u*m,M=(1+u)*g+(-1.5-2*u)*v+(-.5+u)*m+1,w=(-1-f)*g+(1.5+f)*v+.5*m,x=f*g-f*v;for(let R=0;R!==a;++R)s[R]=d*o[h+R]+M*o[c+R]+w*o[l+R]+x*o[p+R];return s}},Xo=class extends hi{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=(i-t)/(r-t),p=1-h;for(let u=0;u!==a;++u)s[u]=o[c+u]*p+o[l+u]*h;return s}},qo=class extends hi{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e){return this.copySampleValue_(e-1)}},Yo=class extends hi{interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=this.inTangents,p=this.outTangents;if(!h||!p){let m=(i-t)/(r-t),v=1-m;for(let g=0;g!==a;++g)s[g]=o[c+g]*v+o[l+g]*m;return s}let u=a*2,f=e-1;for(let m=0;m!==a;++m){let v=o[c+m],g=o[l+m],d=f*u+m*2,M=p[d],w=p[d+1],x=e*u+m*2,R=h[x],b=h[x+1],C=(i-t)/(r-t),_,E,T,A,P;for(let D=0;D<8;D++){_=C*C,E=_*C,T=1-C,A=T*T,P=A*T;let F=P*t+3*A*C*M+3*T*_*R+E*r-i;if(Math.abs(F)<1e-10)break;let k=3*A*(M-t)+6*T*C*(R-M)+3*_*(r-R);if(Math.abs(k)<1e-10)break;C=C-F/k,C=Math.max(0,Math.min(1,C))}s[m]=P*v+3*A*C*w+3*T*_*b+E*g}return s}},un=class{constructor(e,t,i,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=vo(t,this.TimeBufferType),this.values=vo(i,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,i;if(t.toJSON!==this.toJSON)i=t.toJSON(e);else{i={name:e.name,times:vo(e.times,Array),values:vo(e.values,Array)};let r=e.getInterpolation();r!==e.DefaultInterpolation&&(i.interpolation=r)}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new qo(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Xo(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Wo(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new Yo(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case jr:t=this.InterpolantFactoryMethodDiscrete;break;case Fo:t=this.InterpolantFactoryMethodLinear;break;case So:t=this.InterpolantFactoryMethodSmooth;break;case Hl:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return De("KeyframeTrack:",i),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return jr;case this.InterpolantFactoryMethodLinear:return Fo;case this.InterpolantFactoryMethodSmooth:return So;case this.InterpolantFactoryMethodBezier:return Hl}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]*=e}return this}trim(e,t){let i=this.times,r=i.length,s=0,o=r-1;for(;s!==r&&i[s]<e;)++s;for(;o!==-1&&i[o]>t;)--o;if(++o,s!==0||o!==r){s>=o&&(o=Math.max(o,1),s=o-1);let a=this.getValueSize();this.times=i.slice(s,o),this.values=this.values.slice(s*a,o*a)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(Ue("KeyframeTrack: Invalid value size in track.",this),e=!1);let i=this.times,r=this.values,s=i.length;s===0&&(Ue("KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==s;a++){let l=i[a];if(typeof l=="number"&&isNaN(l)){Ue("KeyframeTrack: Time is not a valid number.",this,a,l),e=!1;break}if(o!==null&&o>l){Ue("KeyframeTrack: Out of order keys.",this,a,l,o),e=!1;break}o=l}if(r!==void 0&&Xf(r))for(let a=0,l=r.length;a!==l;++a){let c=r[a];if(isNaN(c)){Ue("KeyframeTrack: Value is not a valid number.",this,a,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),i=this.getValueSize(),r=this.getInterpolation()===So,s=e.length-1,o=1;for(let a=1;a<s;++a){let l=!1,c=e[a],h=e[a+1];if(c!==h&&(a!==1||c!==e[0]))if(r)l=!0;else{let p=a*i,u=p-i,f=p+i;for(let m=0;m!==i;++m){let v=t[p+m];if(v!==t[u+m]||v!==t[f+m]){l=!0;break}}}if(l){if(a!==o){e[o]=e[a];let p=a*i,u=o*i;for(let f=0;f!==i;++f)t[u+f]=t[p+f]}++o}}if(s>0){e[o]=e[s];for(let a=s*i,l=o*i,c=0;c!==i;++c)t[l+c]=t[a+c];++o}return o!==e.length?(this.times=e.slice(0,o),this.values=t.slice(0,o*i)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),i=this.constructor,r=new i(this.name,e,t);return r.createInterpolant=this.createInterpolant,r}};un.prototype.ValueTypeName="";un.prototype.TimeBufferType=Float32Array;un.prototype.ValueBufferType=Float32Array;un.prototype.DefaultInterpolation=Fo;var di=class extends un{constructor(e,t,i){super(e,t,i)}};di.prototype.ValueTypeName="bool";di.prototype.ValueBufferType=Array;di.prototype.DefaultInterpolation=jr;di.prototype.InterpolantFactoryMethodLinear=void 0;di.prototype.InterpolantFactoryMethodSmooth=void 0;var $o=class extends un{constructor(e,t,i,r){super(e,t,i,r)}};$o.prototype.ValueTypeName="color";var Zo=class extends un{constructor(e,t,i,r){super(e,t,i,r)}};Zo.prototype.ValueTypeName="number";var Ko=class extends hi{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(i-t)/(r-t),c=e*a;for(let h=c+a;c!==h;c+=4)an.slerpFlat(s,0,o,c-a,o,c,l);return s}},vs=class extends un{constructor(e,t,i,r){super(e,t,i,r)}InterpolantFactoryMethodLinear(e){return new Ko(this.times,this.values,this.getValueSize(),e)}};vs.prototype.ValueTypeName="quaternion";vs.prototype.InterpolantFactoryMethodSmooth=void 0;var fi=class extends un{constructor(e,t,i){super(e,t,i)}};fi.prototype.ValueTypeName="string";fi.prototype.ValueBufferType=Array;fi.prototype.DefaultInterpolation=jr;fi.prototype.InterpolantFactoryMethodLinear=void 0;fi.prototype.InterpolantFactoryMethodSmooth=void 0;var Jo=class extends un{constructor(e,t,i,r){super(e,t,i,r)}};Jo.prototype.ValueTypeName="vector";var jo=class{constructor(e,t,i){let r=this,s=!1,o=0,a=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=i,this._abortController=null,this.itemStart=function(h){a++,s===!1&&r.onStart!==void 0&&r.onStart(h,o,a),s=!0},this.itemEnd=function(h){o++,r.onProgress!==void 0&&r.onProgress(h,o,a),o===a&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(h){r.onError!==void 0&&r.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,p){return c.push(h,p),this},this.removeHandler=function(h){let p=c.indexOf(h);return p!==-1&&c.splice(p,2),this},this.getHandler=function(h){for(let p=0,u=c.length;p<u;p+=2){let f=c[p],m=c[p+1];if(f.global&&(f.lastIndex=0),f.test(h))return m}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Xh=new jo,Qo=class{constructor(e){this.manager=e!==void 0?e:Xh,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let i=this;return new Promise(function(r,s){i.load(e,r,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};Qo.DEFAULT_MATERIAL_NAME="__DEFAULT";var bs=class extends Bt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new ke(e),this.intensity=t}dispose(){this.dispatchEvent({type:"dispose"})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},Ms=class extends bs{constructor(e,t,i){super(e,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Bt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new ke(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},Gl=new lt,ju=new B,Qu=new B,jl=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Ee(512,512),this.mapType=Qt,this.map=null,this.mapPass=null,this.matrix=new lt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new yr,this._frameExtents=new Ee(1,1),this._viewportCount=1,this._viewports=[new dt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,i=this.matrix;ju.setFromMatrixPosition(e.matrixWorld),t.position.copy(ju),Qu.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Qu),t.updateMatrixWorld(),Gl.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Gl,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===fr||t.reversedDepth?i.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(Gl)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},bo=new B,Mo=new an,Ln=new B,Ss=class extends Bt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new lt,this.projectionMatrix=new lt,this.projectionMatrixInverse=new lt,this.coordinateSystem=vn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(bo,Mo,Ln),Ln.x===1&&Ln.y===1&&Ln.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(bo,Mo,Ln.set(1,1,1)).invert()}updateWorldMatrix(e,t,i=!1){super.updateWorldMatrix(e,t,i),this.matrixWorld.decompose(bo,Mo,Ln),Ln.x===1&&Ln.y===1&&Ln.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(bo,Mo,Ln.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},ai=new B,eh=new Ee,th=new Ee,Ht=class extends Ss{constructor(e=50,t=1,i=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=mr*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Kr*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return mr*2*Math.atan(Math.tan(Kr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){ai.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(ai.x,ai.y).multiplyScalar(-e/ai.z),ai.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(ai.x,ai.y).multiplyScalar(-e/ai.z)}getViewSize(e,t){return this.getViewBounds(e,eh,th),t.subVectors(th,eh)}setViewOffset(e,t,i,r,s,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Kr*.5*this.fov)/this.zoom,i=2*t,r=this.aspect*i,s=-.5*r,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,c=o.fullHeight;s+=o.offsetX*r/l,t-=o.offsetY*i/c,r*=o.width/l,i*=o.height/c}let a=this.filmOffset;a!==0&&(s+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+r,t,t-i,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}};var Sr=class extends Ss{constructor(e=-1,t=1,i=1,r=-1,s=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=r,this.near=s,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,r,s,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,r=(this.top+this.bottom)/2,s=i-e,o=i+e,a=r+t,l=r-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,o=s+c*this.view.width,a-=h*this.view.offsetY,l=a-h*this.view.height}this.projectionMatrix.makeOrthographic(s,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},Ql=class extends jl{constructor(){super(new Sr(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},ws=class extends bs{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Bt.DEFAULT_UP),this.updateMatrix(),this.target=new Bt,this.shadow=new Ql}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}};var cr=-90,ur=1,ea=class extends Bt{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new Ht(cr,ur,e,t);r.layers=this.layers,this.add(r);let s=new Ht(cr,ur,e,t);s.layers=this.layers,this.add(s);let o=new Ht(cr,ur,e,t);o.layers=this.layers,this.add(o);let a=new Ht(cr,ur,e,t);a.layers=this.layers,this.add(a);let l=new Ht(cr,ur,e,t);l.layers=this.layers,this.add(l);let c=new Ht(cr,ur,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[i,r,s,o,a,l]=t;for(let c of t)this.remove(c);if(e===vn)i.up.set(0,1,0),i.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===fr)i.up.set(0,-1,0),i.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[s,o,a,l,c,h]=this.children,p=e.getRenderTarget(),u=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),m=e.xr.enabled;e.xr.enabled=!1;let v=i.texture.generateMipmaps;i.texture.generateMipmaps=!1;let g=!1;e.isWebGLRenderer===!0?g=e.state.buffers.depth.getReversed():g=e.reversedDepthBuffer,e.setRenderTarget(i,0,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(i,1,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(i,2,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(i,3,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(i,4,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),i.texture.generateMipmaps=v,e.setRenderTarget(i,5,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,h),e.setRenderTarget(p,u,f),e.xr.enabled=m,i.texture.needsPMREMUpdate=!0}},ta=class extends Ht{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}};var Tc="\\[\\]\\.:\\/",Yp=new RegExp("["+Tc+"]","g"),Ec="[^"+Tc+"]",$p="[^"+Tc.replace("\\.","")+"]",Zp=/((?:WC+[\/:])*)/.source.replace("WC",Ec),Kp=/(WCOD+)?/.source.replace("WCOD",$p),Jp=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Ec),jp=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Ec),Qp=new RegExp("^"+Zp+Kp+Jp+jp+"$"),em=["material","materials","bones","map"],ec=class{constructor(e,t,i){let r=i||ht.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let i=this._targetGroup.nCachedObjects_,r=this._bindings[i];r!==void 0&&r.getValue(e,t)}setValue(e,t){let i=this._bindings;for(let r=this._targetGroup.nCachedObjects_,s=i.length;r!==s;++r)i[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].unbind()}},ht=class n{constructor(e,t,i){this.path=t,this.parsedPath=i||n.parseTrackName(t),this.node=n.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,i){return e&&e.isAnimationObjectGroup?new n.Composite(e,t,i):new n(e,t,i)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(Yp,"")}static parseTrackName(e){let t=Qp.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let i={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=i.nodeName&&i.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){let s=i.nodeName.substring(r+1);em.indexOf(s)!==-1&&(i.nodeName=i.nodeName.substring(0,r),i.objectName=s)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return i}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let i=e.skeleton.getBoneByName(t);if(i!==void 0)return i}if(e.children){let i=function(s){for(let o=0;o<s.length;o++){let a=s[o];if(a.name===t||a.uuid===t)return a;let l=i(a.children);if(l)return l}return null},r=i(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)e[t++]=i[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,i=t.objectName,r=t.propertyName,s=t.propertyIndex;if(e||(e=n.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){De("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=t.objectIndex;switch(i){case"materials":if(!e.material){Ue("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Ue("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Ue("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===c){c=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Ue("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Ue("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[i]===void 0){Ue("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[i]}if(c!==void 0){if(e[c]===void 0){Ue("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let o=e[r];if(o===void 0){let c=t.nodeName;Ue("PropertyBinding: Trying to update property for track: "+c+"."+r+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?a=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(r==="morphTargetInfluences"){if(!e.geometry){Ue("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Ue("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=s}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=r;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};ht.Composite=ec;ht.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};ht.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};ht.prototype.GetterByBindingType=[ht.prototype._getValue_direct,ht.prototype._getValue_array,ht.prototype._getValue_arrayElement,ht.prototype._getValue_toArray];ht.prototype.SetterByBindingTypeAndVersioning=[[ht.prototype._setValue_direct,ht.prototype._setValue_direct_setNeedsUpdate,ht.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[ht.prototype._setValue_array,ht.prototype._setValue_array_setNeedsUpdate,ht.prototype._setValue_array_setMatrixWorldNeedsUpdate],[ht.prototype._setValue_arrayElement,ht.prototype._setValue_arrayElement_setNeedsUpdate,ht.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[ht.prototype._setValue_fromArray,ht.prototype._setValue_fromArray_setNeedsUpdate,ht.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var fv=new Float32Array(1);var nh=new lt,Ts=class{constructor(e,t,i=0,r=1/0){this.ray=new Bi(e,t),this.near=i,this.far=r,this.camera=null,this.layers=new _r,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,t.projectionMatrix.elements[14]).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):Ue("Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return nh.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(nh),this}intersectObject(e,t=!0,i=[]){return tc(e,this,i,t),i.sort(ih),i}intersectObjects(e,t=!0,i=[]){for(let r=0,s=e.length;r<s;r++)tc(e[r],this,i,t);return i.sort(ih),i}};function ih(n,e){return n.distance-e.distance}function tc(n,e,t,i){let r=!0;if(n.layers.test(e.layers)&&n.raycast(e,t)===!1&&(r=!1),r===!0&&i===!0){let s=n.children;for(let o=0,a=s.length;o<a;o++)tc(s[o],e,t,!0)}}var wr=class{constructor(e=1,t=0,i=0){this.radius=e,this.phi=t,this.theta=i}set(e,t,i){return this.radius=e,this.phi=t,this.theta=i,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=Ze(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,i){return this.radius=Math.sqrt(e*e+t*t+i*i),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,i),this.phi=Math.acos(Ze(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var nc=class n{static{n.prototype.isMatrix2=!0}constructor(e,t,i,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,i,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let i=0;i<4;i++)this.elements[i]=e[i+t];return this}set(e,t,i,r){let s=this.elements;return s[0]=e,s[2]=t,s[1]=i,s[3]=r,this}};var Es=class extends Mn{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){if(e===void 0){De("Controls: connect() now requires an element.");return}this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}};function Ac(n,e,t,i){let r=tm(i);switch(t){case xc:return n*e;case ua:return n*e/r.components*r.byteLength;case ha:return n*e/r.components*r.byteLength;case yi:return n*e*2/r.components*r.byteLength;case da:return n*e*2/r.components*r.byteLength;case yc:return n*e*3/r.components*r.byteLength;case pn:return n*e*4/r.components*r.byteLength;case fa:return n*e*4/r.components*r.byteLength;case Is:case Ls:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case Ds:case Ns:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case ma:case _a:return Math.max(n,16)*Math.max(e,8)/4;case pa:case ga:return Math.max(n,8)*Math.max(e,8)/2;case xa:case ya:case ba:case Ma:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case va:case Fs:case Sa:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case wa:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Ta:return Math.floor((n+4)/5)*Math.floor((e+3)/4)*16;case Ea:return Math.floor((n+4)/5)*Math.floor((e+4)/5)*16;case Aa:return Math.floor((n+5)/6)*Math.floor((e+4)/5)*16;case Ra:return Math.floor((n+5)/6)*Math.floor((e+5)/6)*16;case Ca:return Math.floor((n+7)/8)*Math.floor((e+4)/5)*16;case Pa:return Math.floor((n+7)/8)*Math.floor((e+5)/6)*16;case Ia:return Math.floor((n+7)/8)*Math.floor((e+7)/8)*16;case La:return Math.floor((n+9)/10)*Math.floor((e+4)/5)*16;case Da:return Math.floor((n+9)/10)*Math.floor((e+5)/6)*16;case Na:return Math.floor((n+9)/10)*Math.floor((e+7)/8)*16;case Fa:return Math.floor((n+9)/10)*Math.floor((e+9)/10)*16;case Ua:return Math.floor((n+11)/12)*Math.floor((e+9)/10)*16;case Oa:return Math.floor((n+11)/12)*Math.floor((e+11)/12)*16;case Ba:case ka:case za:return Math.ceil(n/4)*Math.ceil(e/4)*16;case Va:case Ga:return Math.ceil(n/4)*Math.ceil(e/4)*8;case Us:case Ha:return Math.ceil(n/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function tm(n){switch(n){case Qt:case pc:return{byteLength:1,components:1};case Er:case mc:case Bn:return{byteLength:2,components:1};case la:case ca:return{byteLength:2,components:4};case Tn:case aa:case fn:return{byteLength:4,components:1};case gc:case _c:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${n}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"185"}}));typeof window<"u"&&(window.__THREE__?De("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="185");function pd(){let n=null,e=!1,t=null,i=null;function r(s,o){t(s,o),i=n.requestAnimationFrame(r)}return{start:function(){e!==!0&&t!==null&&n!==null&&(i=n.requestAnimationFrame(r),e=!0)},stop:function(){n!==null&&n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){n=s}}}function im(n){let e=new WeakMap;function t(a,l){let c=a.array,h=a.usage,p=c.byteLength,u=n.createBuffer();n.bindBuffer(l,u),n.bufferData(l,c,h),a.onUploadCallback();let f;if(c instanceof Float32Array)f=n.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)f=n.HALF_FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?f=n.HALF_FLOAT:f=n.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=n.SHORT;else if(c instanceof Uint32Array)f=n.UNSIGNED_INT;else if(c instanceof Int32Array)f=n.INT;else if(c instanceof Int8Array)f=n.BYTE;else if(c instanceof Uint8Array)f=n.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:p}}function i(a,l,c){let h=l.array,p=l.updateRanges;if(n.bindBuffer(c,a),p.length===0)n.bufferSubData(c,0,h);else{p.sort((f,m)=>f.start-m.start);let u=0;for(let f=1;f<p.length;f++){let m=p[u],v=p[f];v.start<=m.start+m.count+1?m.count=Math.max(m.count,v.start+v.count-m.start):(++u,p[u]=v)}p.length=u+1;for(let f=0,m=p.length;f<m;f++){let v=p[f];n.bufferSubData(c,v.start*h.BYTES_PER_ELEMENT,h,v.start,v.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function s(a){a.isInterleavedBufferAttribute&&(a=a.data);let l=e.get(a);l&&(n.deleteBuffer(l.buffer),e.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let h=e.get(a);(!h||h.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let c=e.get(a);if(c===void 0)e.set(a,t(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,a,l),c.version=a.version}}return{get:r,remove:s,update:o}}var rm=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,sm=`#ifdef USE_ALPHAHASH
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
#endif`,om=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,am=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,lm=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,cm=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,um=`#ifdef USE_AOMAP
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
#endif`,hm=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,dm=`#ifdef USE_BATCHING
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
#endif`,fm=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,pm=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,mm=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,gm=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,_m=`#ifdef USE_IRIDESCENCE
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
#endif`,xm=`#ifdef USE_BUMPMAP
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
#endif`,ym=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,vm=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,bm=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Mm=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Sm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,wm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Tm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Em=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,Am=`#define PI 3.141592653589793
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
} // validated`,Rm=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,Cm=`vec3 transformedNormal = objectNormal;
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
#endif`,Pm=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Im=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Lm=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Dm=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Nm="gl_FragColor = linearToOutputTexel( gl_FragColor );",Fm=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Um=`#ifdef USE_ENVMAP
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
#endif`,Om=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Bm=`#ifdef USE_ENVMAP
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
#endif`,km=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,zm=`#ifdef USE_ENVMAP
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
#endif`,Vm=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Gm=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Hm=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Wm=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Xm=`#ifdef USE_GRADIENTMAP
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
}`,qm=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Ym=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,$m=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Zm=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,Km=`#ifdef USE_ENVMAP
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
#endif`,Jm=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,jm=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Qm=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,eg=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,tg=`PhysicalMaterial material;
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
#endif`,ng=`uniform sampler2D dfgLUT;
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
}`,ig=`
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
#endif`,rg=`#if defined( RE_IndirectDiffuse )
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
#endif`,sg=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,og=`#ifdef USE_LIGHT_PROBES_GRID
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
#endif`,ag=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,lg=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,cg=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,ug=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,hg=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,dg=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,fg=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,pg=`#if defined( USE_POINTS_UV )
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
#endif`,mg=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,gg=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,_g=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,xg=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,yg=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,vg=`#ifdef USE_MORPHTARGETS
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
#endif`,bg=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Mg=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,Sg=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,wg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Tg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Eg=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Ag=`#ifdef USE_NORMALMAP
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
#endif`,Rg=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Cg=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Pg=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Ig=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Lg=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Dg=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,Ng=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Fg=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Ug=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Og=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Bg=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,kg=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,zg=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,Vg=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,Gg=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,Hg=`float getShadowMask() {
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
}`,Wg=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Xg=`#ifdef USE_SKINNING
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
#endif`,qg=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Yg=`#ifdef USE_SKINNING
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
#endif`,$g=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Zg=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Kg=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Jg=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,jg=`#ifdef USE_TRANSMISSION
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
#endif`,Qg=`#ifdef USE_TRANSMISSION
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
#endif`,e0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,t0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,n0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,i0=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,r0=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,s0=`uniform sampler2D t2D;
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
}`,o0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,a0=`#ifdef ENVMAP_TYPE_CUBE
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
}`,l0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,c0=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,u0=`#include <common>
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
}`,h0=`#if DEPTH_PACKING == 3200
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
}`,d0=`#define DISTANCE
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
}`,f0=`#define DISTANCE
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
}`,p0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,m0=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,g0=`uniform float scale;
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
}`,_0=`uniform vec3 diffuse;
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
}`,x0=`#include <common>
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
}`,y0=`uniform vec3 diffuse;
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
}`,v0=`#define LAMBERT
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
}`,b0=`#define LAMBERT
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
}`,M0=`#define MATCAP
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
}`,S0=`#define MATCAP
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
}`,w0=`#define NORMAL
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
}`,T0=`#define NORMAL
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
}`,E0=`#define PHONG
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
}`,A0=`#define PHONG
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
}`,R0=`#define STANDARD
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
}`,C0=`#define STANDARD
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
}`,P0=`#define TOON
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
}`,I0=`#define TOON
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
}`,L0=`uniform float size;
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
}`,D0=`uniform vec3 diffuse;
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
}`,N0=`#include <common>
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
}`,F0=`uniform vec3 color;
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
}`,U0=`uniform float rotation;
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
}`,O0=`uniform vec3 diffuse;
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
}`,Xe={alphahash_fragment:rm,alphahash_pars_fragment:sm,alphamap_fragment:om,alphamap_pars_fragment:am,alphatest_fragment:lm,alphatest_pars_fragment:cm,aomap_fragment:um,aomap_pars_fragment:hm,batching_pars_vertex:dm,batching_vertex:fm,begin_vertex:pm,beginnormal_vertex:mm,bsdfs:gm,iridescence_fragment:_m,bumpmap_pars_fragment:xm,clipping_planes_fragment:ym,clipping_planes_pars_fragment:vm,clipping_planes_pars_vertex:bm,clipping_planes_vertex:Mm,color_fragment:Sm,color_pars_fragment:wm,color_pars_vertex:Tm,color_vertex:Em,common:Am,cube_uv_reflection_fragment:Rm,defaultnormal_vertex:Cm,displacementmap_pars_vertex:Pm,displacementmap_vertex:Im,emissivemap_fragment:Lm,emissivemap_pars_fragment:Dm,colorspace_fragment:Nm,colorspace_pars_fragment:Fm,envmap_fragment:Um,envmap_common_pars_fragment:Om,envmap_pars_fragment:Bm,envmap_pars_vertex:km,envmap_physical_pars_fragment:Km,envmap_vertex:zm,fog_vertex:Vm,fog_pars_vertex:Gm,fog_fragment:Hm,fog_pars_fragment:Wm,gradientmap_pars_fragment:Xm,lightmap_pars_fragment:qm,lights_lambert_fragment:Ym,lights_lambert_pars_fragment:$m,lights_pars_begin:Zm,lights_toon_fragment:Jm,lights_toon_pars_fragment:jm,lights_phong_fragment:Qm,lights_phong_pars_fragment:eg,lights_physical_fragment:tg,lights_physical_pars_fragment:ng,lights_fragment_begin:ig,lights_fragment_maps:rg,lights_fragment_end:sg,lightprobes_pars_fragment:og,logdepthbuf_fragment:ag,logdepthbuf_pars_fragment:lg,logdepthbuf_pars_vertex:cg,logdepthbuf_vertex:ug,map_fragment:hg,map_pars_fragment:dg,map_particle_fragment:fg,map_particle_pars_fragment:pg,metalnessmap_fragment:mg,metalnessmap_pars_fragment:gg,morphinstance_vertex:_g,morphcolor_vertex:xg,morphnormal_vertex:yg,morphtarget_pars_vertex:vg,morphtarget_vertex:bg,normal_fragment_begin:Mg,normal_fragment_maps:Sg,normal_pars_fragment:wg,normal_pars_vertex:Tg,normal_vertex:Eg,normalmap_pars_fragment:Ag,clearcoat_normal_fragment_begin:Rg,clearcoat_normal_fragment_maps:Cg,clearcoat_pars_fragment:Pg,iridescence_pars_fragment:Ig,opaque_fragment:Lg,packing:Dg,premultiplied_alpha_fragment:Ng,project_vertex:Fg,dithering_fragment:Ug,dithering_pars_fragment:Og,roughnessmap_fragment:Bg,roughnessmap_pars_fragment:kg,shadowmap_pars_fragment:zg,shadowmap_pars_vertex:Vg,shadowmap_vertex:Gg,shadowmask_pars_fragment:Hg,skinbase_vertex:Wg,skinning_pars_vertex:Xg,skinning_vertex:qg,skinnormal_vertex:Yg,specularmap_fragment:$g,specularmap_pars_fragment:Zg,tonemapping_fragment:Kg,tonemapping_pars_fragment:Jg,transmission_fragment:jg,transmission_pars_fragment:Qg,uv_pars_fragment:e0,uv_pars_vertex:t0,uv_vertex:n0,worldpos_vertex:i0,background_vert:r0,background_frag:s0,backgroundCube_vert:o0,backgroundCube_frag:a0,cube_vert:l0,cube_frag:c0,depth_vert:u0,depth_frag:h0,distance_vert:d0,distance_frag:f0,equirect_vert:p0,equirect_frag:m0,linedashed_vert:g0,linedashed_frag:_0,meshbasic_vert:x0,meshbasic_frag:y0,meshlambert_vert:v0,meshlambert_frag:b0,meshmatcap_vert:M0,meshmatcap_frag:S0,meshnormal_vert:w0,meshnormal_frag:T0,meshphong_vert:E0,meshphong_frag:A0,meshphysical_vert:R0,meshphysical_frag:C0,meshtoon_vert:P0,meshtoon_frag:I0,points_vert:L0,points_frag:D0,shadow_vert:N0,shadow_frag:F0,sprite_vert:U0,sprite_frag:O0},me={common:{diffuse:{value:new ke(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new ze},alphaMap:{value:null},alphaMapTransform:{value:new ze},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new ze}},envmap:{envMap:{value:null},envMapRotation:{value:new ze},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new ze}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new ze}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new ze},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new ze},normalScale:{value:new Ee(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new ze},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new ze}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new ze}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new ze}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new ke(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new B},probesMax:{value:new B},probesResolution:{value:new B}},points:{diffuse:{value:new ke(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new ze},alphaTest:{value:0},uvTransform:{value:new ze}},sprite:{diffuse:{value:new ke(16777215)},opacity:{value:1},center:{value:new Ee(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new ze},alphaMap:{value:null},alphaMapTransform:{value:new ze},alphaTest:{value:0}}},zn={basic:{uniforms:Wt([me.common,me.specularmap,me.envmap,me.aomap,me.lightmap,me.fog]),vertexShader:Xe.meshbasic_vert,fragmentShader:Xe.meshbasic_frag},lambert:{uniforms:Wt([me.common,me.specularmap,me.envmap,me.aomap,me.lightmap,me.emissivemap,me.bumpmap,me.normalmap,me.displacementmap,me.fog,me.lights,{emissive:{value:new ke(0)},envMapIntensity:{value:1}}]),vertexShader:Xe.meshlambert_vert,fragmentShader:Xe.meshlambert_frag},phong:{uniforms:Wt([me.common,me.specularmap,me.envmap,me.aomap,me.lightmap,me.emissivemap,me.bumpmap,me.normalmap,me.displacementmap,me.fog,me.lights,{emissive:{value:new ke(0)},specular:{value:new ke(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Xe.meshphong_vert,fragmentShader:Xe.meshphong_frag},standard:{uniforms:Wt([me.common,me.envmap,me.aomap,me.lightmap,me.emissivemap,me.bumpmap,me.normalmap,me.displacementmap,me.roughnessmap,me.metalnessmap,me.fog,me.lights,{emissive:{value:new ke(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Xe.meshphysical_vert,fragmentShader:Xe.meshphysical_frag},toon:{uniforms:Wt([me.common,me.aomap,me.lightmap,me.emissivemap,me.bumpmap,me.normalmap,me.displacementmap,me.gradientmap,me.fog,me.lights,{emissive:{value:new ke(0)}}]),vertexShader:Xe.meshtoon_vert,fragmentShader:Xe.meshtoon_frag},matcap:{uniforms:Wt([me.common,me.bumpmap,me.normalmap,me.displacementmap,me.fog,{matcap:{value:null}}]),vertexShader:Xe.meshmatcap_vert,fragmentShader:Xe.meshmatcap_frag},points:{uniforms:Wt([me.points,me.fog]),vertexShader:Xe.points_vert,fragmentShader:Xe.points_frag},dashed:{uniforms:Wt([me.common,me.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Xe.linedashed_vert,fragmentShader:Xe.linedashed_frag},depth:{uniforms:Wt([me.common,me.displacementmap]),vertexShader:Xe.depth_vert,fragmentShader:Xe.depth_frag},normal:{uniforms:Wt([me.common,me.bumpmap,me.normalmap,me.displacementmap,{opacity:{value:1}}]),vertexShader:Xe.meshnormal_vert,fragmentShader:Xe.meshnormal_frag},sprite:{uniforms:Wt([me.sprite,me.fog]),vertexShader:Xe.sprite_vert,fragmentShader:Xe.sprite_frag},background:{uniforms:{uvTransform:{value:new ze},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Xe.background_vert,fragmentShader:Xe.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new ze}},vertexShader:Xe.backgroundCube_vert,fragmentShader:Xe.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Xe.cube_vert,fragmentShader:Xe.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Xe.equirect_vert,fragmentShader:Xe.equirect_frag},distance:{uniforms:Wt([me.common,me.displacementmap,{referencePosition:{value:new B},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Xe.distance_vert,fragmentShader:Xe.distance_frag},shadow:{uniforms:Wt([me.lights,me.fog,{color:{value:new ke(0)},opacity:{value:1}}]),vertexShader:Xe.shadow_vert,fragmentShader:Xe.shadow_frag}};zn.physical={uniforms:Wt([zn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new ze},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new ze},clearcoatNormalScale:{value:new Ee(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new ze},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new ze},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new ze},sheen:{value:0},sheenColor:{value:new ke(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new ze},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new ze},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new ze},transmissionSamplerSize:{value:new Ee},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new ze},attenuationDistance:{value:0},attenuationColor:{value:new ke(0)},specularColor:{value:new ke(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new ze},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new ze},anisotropyVector:{value:new Ee},anisotropyMap:{value:null},anisotropyMapTransform:{value:new ze}}]),vertexShader:Xe.meshphysical_vert,fragmentShader:Xe.meshphysical_frag};var qa={r:0,b:0,g:0},B0=new lt,md=new ze;md.set(-1,0,0,0,1,0,0,0,1);function k0(n,e,t,i,r,s){let o=new ke(0),a=r===!0?0:1,l,c,h=null,p=0,u=null;function f(M){let w=M.isScene===!0?M.background:null;if(w&&w.isTexture){let x=M.backgroundBlurriness>0;w=e.get(w,x)}return w}function m(M){let w=!1,x=f(M);x===null?g(o,a):x&&x.isColor&&(g(x,1),w=!0);let R=n.xr.getEnvironmentBlendMode();R==="additive"?t.buffers.color.setClear(0,0,0,1,s):R==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,s),(n.autoClear||w)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function v(M,w){let x=f(w);x&&(x.isCubeTexture||x.mapping===Cs)?(c===void 0&&(c=new ft(new br(1,1,1),new cn({name:"BackgroundCubeMaterial",uniforms:Hi(zn.backgroundCube.uniforms),vertexShader:zn.backgroundCube.vertexShader,fragmentShader:zn.backgroundCube.fragmentShader,side:Kt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(R,b,C){this.matrixWorld.copyPosition(C.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),c.material.uniforms.envMap.value=x,c.material.uniforms.backgroundBlurriness.value=w.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=w.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(B0.makeRotationFromEuler(w.backgroundRotation)).transpose(),x.isCubeTexture&&x.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(md),c.material.toneMapped=Je.getTransfer(x.colorSpace)!==et,(h!==x||p!==x.version||u!==n.toneMapping)&&(c.material.needsUpdate=!0,h=x,p=x.version,u=n.toneMapping),c.layers.enableAll(),M.unshift(c,c.geometry,c.material,0,0,null)):x&&x.isTexture&&(l===void 0&&(l=new ft(new Vi(2,2),new cn({name:"BackgroundMaterial",uniforms:Hi(zn.background.uniforms),vertexShader:zn.background.vertexShader,fragmentShader:zn.background.fragmentShader,side:bn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=x,l.material.uniforms.backgroundIntensity.value=w.backgroundIntensity,l.material.toneMapped=Je.getTransfer(x.colorSpace)!==et,x.matrixAutoUpdate===!0&&x.updateMatrix(),l.material.uniforms.uvTransform.value.copy(x.matrix),(h!==x||p!==x.version||u!==n.toneMapping)&&(l.material.needsUpdate=!0,h=x,p=x.version,u=n.toneMapping),l.layers.enableAll(),M.unshift(l,l.geometry,l.material,0,0,null))}function g(M,w){M.getRGB(qa,wc(n)),t.buffers.color.setClear(qa.r,qa.g,qa.b,w,s)}function d(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return o},setClearColor:function(M,w=1){o.set(M),a=w,g(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(M){a=M,g(o,a)},render:m,addToRenderList:v,dispose:d}}function z0(n,e){let t=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},r=u(null),s=r,o=!1;function a(A,P,D,N,F){let k=!1,L=p(A,N,D,P);s!==L&&(s=L,c(s.object)),k=f(A,N,D,F),k&&m(A,N,D,F),F!==null&&e.update(F,n.ELEMENT_ARRAY_BUFFER),(k||o)&&(o=!1,x(A,P,D,N),F!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get(F).buffer))}function l(){return n.createVertexArray()}function c(A){return n.bindVertexArray(A)}function h(A){return n.deleteVertexArray(A)}function p(A,P,D,N){let F=N.wireframe===!0,k=i[P.id];k===void 0&&(k={},i[P.id]=k);let L=A.isInstancedMesh===!0?A.id:0,U=k[L];U===void 0&&(U={},k[L]=U);let G=U[D.id];G===void 0&&(G={},U[D.id]=G);let Z=G[F];return Z===void 0&&(Z=u(l()),G[F]=Z),Z}function u(A){let P=[],D=[],N=[];for(let F=0;F<t;F++)P[F]=0,D[F]=0,N[F]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:P,enabledAttributes:D,attributeDivisors:N,object:A,attributes:{},index:null}}function f(A,P,D,N){let F=s.attributes,k=P.attributes,L=0,U=D.getAttributes();for(let G in U)if(U[G].location>=0){let K=F[G],ne=k[G];if(ne===void 0&&(G==="instanceMatrix"&&A.instanceMatrix&&(ne=A.instanceMatrix),G==="instanceColor"&&A.instanceColor&&(ne=A.instanceColor)),K===void 0||K.attribute!==ne||ne&&K.data!==ne.data)return!0;L++}return s.attributesNum!==L||s.index!==N}function m(A,P,D,N){let F={},k=P.attributes,L=0,U=D.getAttributes();for(let G in U)if(U[G].location>=0){let K=k[G];K===void 0&&(G==="instanceMatrix"&&A.instanceMatrix&&(K=A.instanceMatrix),G==="instanceColor"&&A.instanceColor&&(K=A.instanceColor));let ne={};ne.attribute=K,K&&K.data&&(ne.data=K.data),F[G]=ne,L++}s.attributes=F,s.attributesNum=L,s.index=N}function v(){let A=s.newAttributes;for(let P=0,D=A.length;P<D;P++)A[P]=0}function g(A){d(A,0)}function d(A,P){let D=s.newAttributes,N=s.enabledAttributes,F=s.attributeDivisors;D[A]=1,N[A]===0&&(n.enableVertexAttribArray(A),N[A]=1),F[A]!==P&&(n.vertexAttribDivisor(A,P),F[A]=P)}function M(){let A=s.newAttributes,P=s.enabledAttributes;for(let D=0,N=P.length;D<N;D++)P[D]!==A[D]&&(n.disableVertexAttribArray(D),P[D]=0)}function w(A,P,D,N,F,k,L){L===!0?n.vertexAttribIPointer(A,P,D,F,k):n.vertexAttribPointer(A,P,D,N,F,k)}function x(A,P,D,N){v();let F=N.attributes,k=D.getAttributes(),L=P.defaultAttributeValues;for(let U in k){let G=k[U];if(G.location>=0){let Z=F[U];if(Z===void 0&&(U==="instanceMatrix"&&A.instanceMatrix&&(Z=A.instanceMatrix),U==="instanceColor"&&A.instanceColor&&(Z=A.instanceColor)),Z!==void 0){let K=Z.normalized,ne=Z.itemSize,ce=e.get(Z);if(ce===void 0)continue;let Ae=ce.buffer,Re=ce.type,$=ce.bytesPerElement,ie=Re===n.INT||Re===n.UNSIGNED_INT||Z.gpuType===aa;if(Z.isInterleavedBufferAttribute){let te=Z.data,be=te.stride,Oe=Z.offset;if(te.isInstancedInterleavedBuffer){for(let Se=0;Se<G.locationSize;Se++)d(G.location+Se,te.meshPerAttribute);A.isInstancedMesh!==!0&&N._maxInstanceCount===void 0&&(N._maxInstanceCount=te.meshPerAttribute*te.count)}else for(let Se=0;Se<G.locationSize;Se++)g(G.location+Se);n.bindBuffer(n.ARRAY_BUFFER,Ae);for(let Se=0;Se<G.locationSize;Se++)w(G.location+Se,ne/G.locationSize,Re,K,be*$,(Oe+ne/G.locationSize*Se)*$,ie)}else{if(Z.isInstancedBufferAttribute){for(let te=0;te<G.locationSize;te++)d(G.location+te,Z.meshPerAttribute);A.isInstancedMesh!==!0&&N._maxInstanceCount===void 0&&(N._maxInstanceCount=Z.meshPerAttribute*Z.count)}else for(let te=0;te<G.locationSize;te++)g(G.location+te);n.bindBuffer(n.ARRAY_BUFFER,Ae);for(let te=0;te<G.locationSize;te++)w(G.location+te,ne/G.locationSize,Re,K,ne*$,ne/G.locationSize*te*$,ie)}}else if(L!==void 0){let K=L[U];if(K!==void 0)switch(K.length){case 2:n.vertexAttrib2fv(G.location,K);break;case 3:n.vertexAttrib3fv(G.location,K);break;case 4:n.vertexAttrib4fv(G.location,K);break;default:n.vertexAttrib1fv(G.location,K)}}}}M()}function R(){E();for(let A in i){let P=i[A];for(let D in P){let N=P[D];for(let F in N){let k=N[F];for(let L in k)h(k[L].object),delete k[L];delete N[F]}}delete i[A]}}function b(A){if(i[A.id]===void 0)return;let P=i[A.id];for(let D in P){let N=P[D];for(let F in N){let k=N[F];for(let L in k)h(k[L].object),delete k[L];delete N[F]}}delete i[A.id]}function C(A){for(let P in i){let D=i[P];for(let N in D){let F=D[N];if(F[A.id]===void 0)continue;let k=F[A.id];for(let L in k)h(k[L].object),delete k[L];delete F[A.id]}}}function _(A){for(let P in i){let D=i[P],N=A.isInstancedMesh===!0?A.id:0,F=D[N];if(F!==void 0){for(let k in F){let L=F[k];for(let U in L)h(L[U].object),delete L[U];delete F[k]}delete D[N],Object.keys(D).length===0&&delete i[P]}}}function E(){T(),o=!0,s!==r&&(s=r,c(s.object))}function T(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:a,reset:E,resetDefaultState:T,dispose:R,releaseStatesOfGeometry:b,releaseStatesOfObject:_,releaseStatesOfProgram:C,initAttributes:v,enableAttribute:g,disableUnusedAttributes:M}}function V0(n,e,t){let i;function r(l){i=l}function s(l,c){n.drawArrays(i,l,c),t.update(c,i,1)}function o(l,c,h){h!==0&&(n.drawArraysInstanced(i,l,c,h),t.update(c,i,h))}function a(l,c,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,h);let u=0;for(let f=0;f<h;f++)u+=c[f];t.update(u,i,1)}this.setMode=r,this.render=s,this.renderInstances=o,this.renderMultiDraw=a}function G0(n,e,t,i){let r;function s(){if(r!==void 0)return r;if(e.has("EXT_texture_filter_anisotropic")===!0){let C=e.get("EXT_texture_filter_anisotropic");r=n.getParameter(C.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function o(C){return!(C!==pn&&i.convert(C)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(C){let _=C===Bn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(C!==Qt&&i.convert(C)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE)&&C!==fn&&!_)}function l(C){if(C==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";C="mediump"}return C==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp",h=l(c);h!==c&&(De("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let p=t.logarithmicDepthBuffer===!0,u=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&u===!1&&De("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let f=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),m=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),v=n.getParameter(n.MAX_TEXTURE_SIZE),g=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),d=n.getParameter(n.MAX_VERTEX_ATTRIBS),M=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),w=n.getParameter(n.MAX_VARYING_VECTORS),x=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),R=n.getParameter(n.MAX_SAMPLES),b=n.getParameter(n.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:p,reversedDepthBuffer:u,maxTextures:f,maxVertexTextures:m,maxTextureSize:v,maxCubemapSize:g,maxAttributes:d,maxVertexUniforms:M,maxVaryings:w,maxFragmentUniforms:x,maxSamples:R,samples:b}}function H0(n){let e=this,t=null,i=0,r=!1,s=!1,o=new kt,a=new ze,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(p,u){let f=p.length!==0||u||i!==0||r;return r=u,i=p.length,f},this.beginShadows=function(){s=!0,h(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(p,u){t=h(p,u,0)},this.setState=function(p,u,f){let m=p.clippingPlanes,v=p.clipIntersection,g=p.clipShadows,d=n.get(p);if(!r||m===null||m.length===0||s&&!g)s?h(null):c();else{let M=s?0:i,w=M*4,x=d.clippingState||null;l.value=x,x=h(m,u,w,f);for(let R=0;R!==w;++R)x[R]=t[R];d.clippingState=x,this.numIntersection=v?this.numPlanes:0,this.numPlanes+=M}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function h(p,u,f,m){let v=p!==null?p.length:0,g=null;if(v!==0){if(g=l.value,m!==!0||g===null){let d=f+v*4,M=u.matrixWorldInverse;a.getNormalMatrix(M),(g===null||g.length<d)&&(g=new Float32Array(d));for(let w=0,x=f;w!==v;++w,x+=4)o.copy(p[w]).applyMatrix4(M,a),o.normal.toArray(g,x),g[x+3]=o.constant}l.value=g,l.needsUpdate=!0}return e.numPlanes=v,e.numIntersection=0,g}}var vi=4,qh=[.125,.215,.35,.446,.526,.582],Wi=20,W0=256,Bs=new Sr,Yh=new ke,Rc=null,Cc=0,Pc=0,Ic=!1,X0=new B,$a=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,i=.1,r=100,s={}){let{size:o=256,position:a=X0}=s;Rc=this._renderer.getRenderTarget(),Cc=this._renderer.getActiveCubeFace(),Pc=this._renderer.getActiveMipmapLevel(),Ic=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,i,r,l,a),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Kh(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Zh(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Rc,Cc,Pc),this._renderer.xr.enabled=Ic,e.scissorTest=!1,Cr(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===gi||e.mapping===Gi?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Rc=this._renderer.getRenderTarget(),Cc=this._renderer.getActiveCubeFace(),Pc=this._renderer.getActiveMipmapLevel(),Ic=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let i=t||this._allocateTargets();return this._textureToCubeUV(e,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:It,minFilter:It,generateMipmaps:!1,type:Bn,format:pn,colorSpace:Qr,depthBuffer:!1},r=$h(e,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=$h(e,t,i);let{_lodMax:s}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=q0(s)),this._blurMaterial=$0(s,e,t),this._ggxMaterial=Y0(s,e,t)}return r}_compileMaterial(e){let t=new ft(new Tt,e);this._renderer.compile(t,Bs)}_sceneToCubeUV(e,t,i,r,s){let l=new Ht(90,1,t,i),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],p=this._renderer,u=p.autoClear,f=p.toneMapping;p.getClearColor(Yh),p.toneMapping=wn,p.autoClear=!1,p.state.buffers.depth.getReversed()&&(p.setRenderTarget(r),p.clearDepth(),p.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new ft(new br,new Kn({name:"PMREM.Background",side:Kt,depthWrite:!1,depthTest:!1})));let v=this._backgroundBox,g=v.material,d=!1,M=e.background;M?M.isColor&&(g.color.copy(M),e.background=null,d=!0):(g.color.copy(Yh),d=!0);for(let w=0;w<6;w++){let x=w%3;x===0?(l.up.set(0,c[w],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x+h[w],s.y,s.z)):x===1?(l.up.set(0,0,c[w]),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y+h[w],s.z)):(l.up.set(0,c[w],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y,s.z+h[w]));let R=this._cubeSize;Cr(r,x*R,w>2?R:0,R,R),p.setRenderTarget(r),d&&p.render(v,l),p.render(e,l)}p.toneMapping=f,p.autoClear=u,e.background=M}_textureToCubeUV(e,t){let i=this._renderer,r=e.mapping===gi||e.mapping===Gi;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Kh()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Zh());let s=r?this._cubemapMaterial:this._equirectMaterial,o=this._lodMeshes[0];o.material=s;let a=s.uniforms;a.envMap.value=e;let l=this._cubeSize;Cr(t,0,0,3*l,2*l),i.setRenderTarget(t),i.render(o,Bs)}_applyPMREM(e){let t=this._renderer,i=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let s=1;s<r;s++)this._applyGGXFilter(e,s-1,s);t.autoClear=i}_applyGGXFilter(e,t,i){let r=this._renderer,s=this._pingPongRenderTarget,o=this._ggxMaterial,a=this._lodMeshes[i];a.material=o;let l=o.uniforms,c=i/(this._lodMeshes.length-1),h=t/(this._lodMeshes.length-1),p=Math.sqrt(c*c-h*h),u=0+c*1.25,f=p*u,{_lodMax:m}=this,v=this._sizeLods[i],g=3*v*(i>m-vi?i-m+vi:0),d=4*(this._cubeSize-v);l.envMap.value=e.texture,l.roughness.value=f,l.mipInt.value=m-t,Cr(s,g,d,3*v,2*v),r.setRenderTarget(s),r.render(a,Bs),l.envMap.value=s.texture,l.roughness.value=0,l.mipInt.value=m-i,Cr(e,g,d,3*v,2*v),r.setRenderTarget(e),r.render(a,Bs)}_blur(e,t,i,r,s){let o=this._pingPongRenderTarget;this._halfBlur(e,o,t,i,r,"latitudinal",s),this._halfBlur(o,e,i,i,r,"longitudinal",s)}_halfBlur(e,t,i,r,s,o,a){let l=this._renderer,c=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&Ue("blur direction must be either latitudinal or longitudinal!");let h=3,p=this._lodMeshes[r];p.material=c;let u=c.uniforms,f=this._sizeLods[i]-1,m=isFinite(s)?Math.PI/(2*f):2*Math.PI/(2*Wi-1),v=s/m,g=isFinite(s)?1+Math.floor(h*v):Wi;g>Wi&&De(`sigmaRadians, ${s}, is too large and will clip, as it requested ${g} samples when the maximum is set to ${Wi}`);let d=[],M=0;for(let C=0;C<Wi;++C){let _=C/v,E=Math.exp(-_*_/2);d.push(E),C===0?M+=E:C<g&&(M+=2*E)}for(let C=0;C<d.length;C++)d[C]=d[C]/M;u.envMap.value=e.texture,u.samples.value=g,u.weights.value=d,u.latitudinal.value=o==="latitudinal",a&&(u.poleAxis.value=a);let{_lodMax:w}=this;u.dTheta.value=m,u.mipInt.value=w-i;let x=this._sizeLods[r],R=3*x*(r>w-vi?r-w+vi:0),b=4*(this._cubeSize-x);Cr(t,R,b,3*x,2*x),l.setRenderTarget(t),l.render(p,Bs)}};function q0(n){let e=[],t=[],i=[],r=n,s=n-vi+1+qh.length;for(let o=0;o<s;o++){let a=Math.pow(2,r);e.push(a);let l=1/a;o>n-vi?l=qh[o-n+vi-1]:o===0&&(l=0),t.push(l);let c=1/(a-2),h=-c,p=1+c,u=[h,h,p,h,p,p,h,h,p,p,h,p],f=6,m=6,v=3,g=2,d=1,M=new Float32Array(v*m*f),w=new Float32Array(g*m*f),x=new Float32Array(d*m*f);for(let b=0;b<f;b++){let C=b%3*2/3-1,_=b>2?0:-1,E=[C,_,0,C+2/3,_,0,C+2/3,_+1,0,C,_,0,C+2/3,_+1,0,C,_+1,0];M.set(E,v*m*b),w.set(u,g*m*b);let T=[b,b,b,b,b,b];x.set(T,d*m*b)}let R=new Tt;R.setAttribute("position",new $t(M,v)),R.setAttribute("uv",new $t(w,g)),R.setAttribute("faceIndex",new $t(x,d)),i.push(new ft(R,null)),r>vi&&r--}return{lodMeshes:i,sizeLods:e,sigmas:t}}function $h(n,e,t){let i=new ln(n,e,t);return i.texture.mapping=Cs,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function Cr(n,e,t,i,r){n.viewport.set(e,t,i,r),n.scissor.set(e,t,i,r)}function Y0(n,e,t){return new cn({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:W0,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Ja(),fragmentShader:`

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
		`,blending:On,depthTest:!1,depthWrite:!1})}function $0(n,e,t){let i=new Float32Array(Wi),r=new B(0,1,0);return new cn({name:"SphericalGaussianBlur",defines:{n:Wi,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:r}},vertexShader:Ja(),fragmentShader:`

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
		`,blending:On,depthTest:!1,depthWrite:!1})}function Zh(){return new cn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Ja(),fragmentShader:`

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
		`,blending:On,depthTest:!1,depthWrite:!1})}function Kh(){return new cn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Ja(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:On,depthTest:!1,depthWrite:!1})}function Ja(){return`

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
	`}var Za=class extends ln{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let i={width:e,height:e,depth:1},r=[i,i,i,i,i,i];this.texture=new hs(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},r=new br(5,5,5),s=new cn({name:"CubemapFromEquirect",uniforms:Hi(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:Kt,blending:On});s.uniforms.tEquirect.value=t;let o=new ft(r,s),a=t.minFilter;return t.minFilter===_i&&(t.minFilter=It),new ea(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t=!0,i=!0,r=!0){let s=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,i,r);e.setRenderTarget(s)}};function Z0(n){let e=new WeakMap,t=new WeakMap,i=null;function r(u,f=!1){return u==null?null:f?o(u):s(u)}function s(u){if(u&&u.isTexture){let f=u.mapping;if(f===ra||f===sa)if(e.has(u)){let m=e.get(u).texture;return a(m,u.mapping)}else{let m=u.image;if(m&&m.height>0){let v=new Za(m.height);return v.fromEquirectangularTexture(n,u),e.set(u,v),u.addEventListener("dispose",c),a(v.texture,u.mapping)}else return null}}return u}function o(u){if(u&&u.isTexture){let f=u.mapping,m=f===ra||f===sa,v=f===gi||f===Gi;if(m||v){let g=t.get(u),d=g!==void 0?g.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==d)return i===null&&(i=new $a(n)),g=m?i.fromEquirectangular(u,g):i.fromCubemap(u,g),g.texture.pmremVersion=u.pmremVersion,t.set(u,g),g.texture;if(g!==void 0)return g.texture;{let M=u.image;return m&&M&&M.height>0||v&&M&&l(M)?(i===null&&(i=new $a(n)),g=m?i.fromEquirectangular(u):i.fromCubemap(u),g.texture.pmremVersion=u.pmremVersion,t.set(u,g),u.addEventListener("dispose",h),g.texture):null}}}return u}function a(u,f){return f===ra?u.mapping=gi:f===sa&&(u.mapping=Gi),u}function l(u){let f=0,m=6;for(let v=0;v<m;v++)u[v]!==void 0&&f++;return f===m}function c(u){let f=u.target;f.removeEventListener("dispose",c);let m=e.get(f);m!==void 0&&(e.delete(f),m.dispose())}function h(u){let f=u.target;f.removeEventListener("dispose",h);let m=t.get(f);m!==void 0&&(t.delete(f),m.dispose())}function p(){e=new WeakMap,t=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:r,dispose:p}}function K0(n){let e={};function t(i){if(e[i]!==void 0)return e[i];let r=n.getExtension(i);return e[i]=r,r}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){let r=t(i);return r===null&&Fi("WebGLRenderer: "+i+" extension not supported."),r}}}function J0(n,e,t,i){let r={},s=new WeakMap;function o(p){let u=p.target;u.index!==null&&e.remove(u.index);for(let m in u.attributes)e.remove(u.attributes[m]);u.removeEventListener("dispose",o),delete r[u.id];let f=s.get(u);f&&(e.remove(f),s.delete(u)),i.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,t.memory.geometries--}function a(p,u){return r[u.id]===!0||(u.addEventListener("dispose",o),r[u.id]=!0,t.memory.geometries++),u}function l(p){let u=p.attributes;for(let f in u)e.update(u[f],n.ARRAY_BUFFER)}function c(p){let u=[],f=p.index,m=p.attributes.position,v=0;if(m===void 0)return;if(f!==null){let M=f.array;v=f.version;for(let w=0,x=M.length;w<x;w+=3){let R=M[w+0],b=M[w+1],C=M[w+2];u.push(R,b,b,C,C,R)}}else{let M=m.array;v=m.version;for(let w=0,x=M.length/3-1;w<x;w+=3){let R=w+0,b=w+1,C=w+2;u.push(R,b,b,C,C,R)}}let g=new(m.count>=65535?as:os)(u,1);g.version=v;let d=s.get(p);d&&e.remove(d),s.set(p,g)}function h(p){let u=s.get(p);if(u){let f=p.index;f!==null&&u.version<f.version&&c(p)}else c(p);return s.get(p)}return{get:a,update:l,getWireframeAttribute:h}}function j0(n,e,t){let i;function r(p){i=p}let s,o;function a(p){s=p.type,o=p.bytesPerElement}function l(p,u){n.drawElements(i,u,s,p*o),t.update(u,i,1)}function c(p,u,f){f!==0&&(n.drawElementsInstanced(i,u,s,p*o,f),t.update(u,i,f))}function h(p,u,f){if(f===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,u,0,s,p,0,f);let v=0;for(let g=0;g<f;g++)v+=u[g];t.update(v,i,1)}this.setMode=r,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function Q0(n){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,o,a){switch(t.calls++,o){case n.TRIANGLES:t.triangles+=a*(s/3);break;case n.LINES:t.lines+=a*(s/2);break;case n.LINE_STRIP:t.lines+=a*(s-1);break;case n.LINE_LOOP:t.lines+=a*s;break;case n.POINTS:t.points+=a*s;break;default:Ue("WebGLInfo: Unknown draw mode:",o);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:r,update:i}}function e_(n,e,t){let i=new WeakMap,r=new dt;function s(o,a,l){let c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,p=h!==void 0?h.length:0,u=i.get(a);if(u===void 0||u.count!==p){let E=function(){C.dispose(),i.delete(a),a.removeEventListener("dispose",E)};u!==void 0&&u.texture.dispose();let f=a.morphAttributes.position!==void 0,m=a.morphAttributes.normal!==void 0,v=a.morphAttributes.color!==void 0,g=a.morphAttributes.position||[],d=a.morphAttributes.normal||[],M=a.morphAttributes.color||[],w=0;f===!0&&(w=1),m===!0&&(w=2),v===!0&&(w=3);let x=a.attributes.position.count*w,R=1;x>e.maxTextureSize&&(R=Math.ceil(x/e.maxTextureSize),x=e.maxTextureSize);let b=new Float32Array(x*R*4*p),C=new ns(b,x,R,p);C.type=fn,C.needsUpdate=!0;let _=w*4;for(let T=0;T<p;T++){let A=g[T],P=d[T],D=M[T],N=x*R*4*T;for(let F=0;F<A.count;F++){let k=F*_;f===!0&&(r.fromBufferAttribute(A,F),b[N+k+0]=r.x,b[N+k+1]=r.y,b[N+k+2]=r.z,b[N+k+3]=0),m===!0&&(r.fromBufferAttribute(P,F),b[N+k+4]=r.x,b[N+k+5]=r.y,b[N+k+6]=r.z,b[N+k+7]=0),v===!0&&(r.fromBufferAttribute(D,F),b[N+k+8]=r.x,b[N+k+9]=r.y,b[N+k+10]=r.z,b[N+k+11]=D.itemSize===4?r.w:1)}}u={count:p,texture:C,size:new Ee(x,R)},i.set(a,u),a.addEventListener("dispose",E)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(n,"morphTexture",o.morphTexture,t);else{let f=0;for(let v=0;v<c.length;v++)f+=c[v];let m=a.morphTargetsRelative?1:1-f;l.getUniforms().setValue(n,"morphTargetBaseInfluence",m),l.getUniforms().setValue(n,"morphTargetInfluences",c)}l.getUniforms().setValue(n,"morphTargetsTexture",u.texture,t),l.getUniforms().setValue(n,"morphTargetsTextureSize",u.size)}return{update:s}}function t_(n,e,t,i,r){let s=new WeakMap;function o(c){let h=r.render.frame,p=c.geometry,u=e.get(c,p);if(s.get(u)!==h&&(e.update(u),s.set(u,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),s.get(c)!==h&&(t.update(c.instanceMatrix,n.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,n.ARRAY_BUFFER),s.set(c,h))),c.isSkinnedMesh){let f=c.skeleton;s.get(f)!==h&&(f.update(),s.set(f,h))}return u}function a(){s=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),i.releaseStatesOfObject(h),t.remove(h.instanceMatrix),h.instanceColor!==null&&t.remove(h.instanceColor)}return{update:o,dispose:a}}var n_={[ac]:"LINEAR_TONE_MAPPING",[lc]:"REINHARD_TONE_MAPPING",[cc]:"CINEON_TONE_MAPPING",[Rs]:"ACES_FILMIC_TONE_MAPPING",[hc]:"AGX_TONE_MAPPING",[dc]:"NEUTRAL_TONE_MAPPING",[uc]:"CUSTOM_TONE_MAPPING"};function i_(n,e,t,i,r,s){let o=new ln(e,t,{type:n,depthBuffer:r,stencilBuffer:s,samples:i?4:0,depthTexture:r?new Jn(e,t):void 0}),a=new ln(e,t,{type:Bn,depthBuffer:!1,stencilBuffer:!1}),l=new Tt;l.setAttribute("position",new it([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new it([0,2,0,0,2,0],2));let c=new Vo({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),h=new ft(l,c),p=new Sr(-1,1,1,-1,0,1),u=null,f=null,m=!1,v,g=null,d=[],M=!1;this.setSize=function(w,x){o.setSize(w,x),a.setSize(w,x);for(let R=0;R<d.length;R++){let b=d[R];b.setSize&&b.setSize(w,x)}},this.setEffects=function(w){d=w,M=d.length>0&&d[0].isRenderPass===!0;let x=o.width,R=o.height;for(let b=0;b<d.length;b++){let C=d[b];C.setSize&&C.setSize(x,R)}},this.begin=function(w,x){if(m||w.toneMapping===wn&&d.length===0)return!1;if(g=x,x!==null){let R=x.width,b=x.height;(o.width!==R||o.height!==b)&&this.setSize(R,b)}return M===!1&&w.setRenderTarget(o),v=w.toneMapping,w.toneMapping=wn,!0},this.hasRenderPass=function(){return M},this.end=function(w,x){w.toneMapping=v,m=!0;let R=o,b=a;for(let C=0;C<d.length;C++){let _=d[C];if(_.enabled!==!1&&(_.render(w,b,R,x),_.needsSwap!==!1)){let E=R;R=b,b=E}}if(u!==w.outputColorSpace||f!==w.toneMapping){u=w.outputColorSpace,f=w.toneMapping,c.defines={},Je.getTransfer(u)===et&&(c.defines.SRGB_TRANSFER="");let C=n_[f];C&&(c.defines[C]=""),c.needsUpdate=!0}c.uniforms.tDiffuse.value=R.texture,w.setRenderTarget(g),w.render(h,p),g=null,m=!1},this.isCompositing=function(){return m},this.dispose=function(){o.depthTexture&&o.depthTexture.dispose(),o.dispose(),a.dispose(),l.dispose(),c.dispose()}}var gd=new Zt,Nc=new Jn(1,1),_d=new ns,xd=new Bo,yd=new hs,Jh=[],jh=[],Qh=new Float32Array(16),ed=new Float32Array(9),td=new Float32Array(4);function Ir(n,e,t){let i=n[0];if(i<=0||i>0)return n;let r=e*t,s=Jh[r];if(s===void 0&&(s=new Float32Array(r),Jh[r]=s),e!==0){i.toArray(s,0);for(let o=1,a=0;o!==e;++o)a+=t,n[o].toArray(s,a)}return s}function Lt(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function Dt(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function ja(n,e){let t=jh[e];t===void 0&&(t=new Int32Array(e),jh[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function r_(n,e){let t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function s_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Lt(t,e))return;n.uniform2fv(this.addr,e),Dt(t,e)}}function o_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Lt(t,e))return;n.uniform3fv(this.addr,e),Dt(t,e)}}function a_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Lt(t,e))return;n.uniform4fv(this.addr,e),Dt(t,e)}}function l_(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(Lt(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),Dt(t,e)}else{if(Lt(t,i))return;td.set(i),n.uniformMatrix2fv(this.addr,!1,td),Dt(t,i)}}function c_(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(Lt(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),Dt(t,e)}else{if(Lt(t,i))return;ed.set(i),n.uniformMatrix3fv(this.addr,!1,ed),Dt(t,i)}}function u_(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(Lt(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),Dt(t,e)}else{if(Lt(t,i))return;Qh.set(i),n.uniformMatrix4fv(this.addr,!1,Qh),Dt(t,i)}}function h_(n,e){let t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function d_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Lt(t,e))return;n.uniform2iv(this.addr,e),Dt(t,e)}}function f_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Lt(t,e))return;n.uniform3iv(this.addr,e),Dt(t,e)}}function p_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Lt(t,e))return;n.uniform4iv(this.addr,e),Dt(t,e)}}function m_(n,e){let t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function g_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Lt(t,e))return;n.uniform2uiv(this.addr,e),Dt(t,e)}}function __(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Lt(t,e))return;n.uniform3uiv(this.addr,e),Dt(t,e)}}function x_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Lt(t,e))return;n.uniform4uiv(this.addr,e),Dt(t,e)}}function y_(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r);let s;this.type===n.SAMPLER_2D_SHADOW?(Nc.compareFunction=t.isReversedDepthBuffer()?Xa:Wa,s=Nc):s=gd,t.setTexture2D(e||s,r)}function v_(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture3D(e||xd,r)}function b_(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTextureCube(e||yd,r)}function M_(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture2DArray(e||_d,r)}function S_(n){switch(n){case 5126:return r_;case 35664:return s_;case 35665:return o_;case 35666:return a_;case 35674:return l_;case 35675:return c_;case 35676:return u_;case 5124:case 35670:return h_;case 35667:case 35671:return d_;case 35668:case 35672:return f_;case 35669:case 35673:return p_;case 5125:return m_;case 36294:return g_;case 36295:return __;case 36296:return x_;case 35678:case 36198:case 36298:case 36306:case 35682:return y_;case 35679:case 36299:case 36307:return v_;case 35680:case 36300:case 36308:case 36293:return b_;case 36289:case 36303:case 36311:case 36292:return M_}}function w_(n,e){n.uniform1fv(this.addr,e)}function T_(n,e){let t=Ir(e,this.size,2);n.uniform2fv(this.addr,t)}function E_(n,e){let t=Ir(e,this.size,3);n.uniform3fv(this.addr,t)}function A_(n,e){let t=Ir(e,this.size,4);n.uniform4fv(this.addr,t)}function R_(n,e){let t=Ir(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function C_(n,e){let t=Ir(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function P_(n,e){let t=Ir(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function I_(n,e){n.uniform1iv(this.addr,e)}function L_(n,e){n.uniform2iv(this.addr,e)}function D_(n,e){n.uniform3iv(this.addr,e)}function N_(n,e){n.uniform4iv(this.addr,e)}function F_(n,e){n.uniform1uiv(this.addr,e)}function U_(n,e){n.uniform2uiv(this.addr,e)}function O_(n,e){n.uniform3uiv(this.addr,e)}function B_(n,e){n.uniform4uiv(this.addr,e)}function k_(n,e,t){let i=this.cache,r=e.length,s=ja(t,r);Lt(i,s)||(n.uniform1iv(this.addr,s),Dt(i,s));let o;this.type===n.SAMPLER_2D_SHADOW?o=Nc:o=gd;for(let a=0;a!==r;++a)t.setTexture2D(e[a]||o,s[a])}function z_(n,e,t){let i=this.cache,r=e.length,s=ja(t,r);Lt(i,s)||(n.uniform1iv(this.addr,s),Dt(i,s));for(let o=0;o!==r;++o)t.setTexture3D(e[o]||xd,s[o])}function V_(n,e,t){let i=this.cache,r=e.length,s=ja(t,r);Lt(i,s)||(n.uniform1iv(this.addr,s),Dt(i,s));for(let o=0;o!==r;++o)t.setTextureCube(e[o]||yd,s[o])}function G_(n,e,t){let i=this.cache,r=e.length,s=ja(t,r);Lt(i,s)||(n.uniform1iv(this.addr,s),Dt(i,s));for(let o=0;o!==r;++o)t.setTexture2DArray(e[o]||_d,s[o])}function H_(n){switch(n){case 5126:return w_;case 35664:return T_;case 35665:return E_;case 35666:return A_;case 35674:return R_;case 35675:return C_;case 35676:return P_;case 5124:case 35670:return I_;case 35667:case 35671:return L_;case 35668:case 35672:return D_;case 35669:case 35673:return N_;case 5125:return F_;case 36294:return U_;case 36295:return O_;case 36296:return B_;case 35678:case 36198:case 36298:case 36306:case 35682:return k_;case 35679:case 36299:case 36307:return z_;case 35680:case 36300:case 36308:case 36293:return V_;case 36289:case 36303:case 36311:case 36292:return G_}}var Fc=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=S_(t.type)}},Uc=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=H_(t.type)}},Oc=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){let r=this.seq;for(let s=0,o=r.length;s!==o;++s){let a=r[s];a.setValue(e,t[a.id],i)}}},Lc=/(\w+)(\])?(\[|\.)?/g;function nd(n,e){n.seq.push(e),n.map[e.id]=e}function W_(n,e,t){let i=n.name,r=i.length;for(Lc.lastIndex=0;;){let s=Lc.exec(i),o=Lc.lastIndex,a=s[1],l=s[2]==="]",c=s[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===r){nd(t,c===void 0?new Fc(a,n,e):new Uc(a,n,e));break}else{let p=t.map[a];p===void 0&&(p=new Oc(a),nd(t,p)),t=p}}}var Pr=class{constructor(e,t){this.seq=[],this.map={};let i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let o=0;o<i;++o){let a=e.getActiveUniform(t,o),l=e.getUniformLocation(t,a.name);W_(a,l,this)}let r=[],s=[];for(let o of this.seq)o.type===e.SAMPLER_2D_SHADOW||o.type===e.SAMPLER_CUBE_SHADOW||o.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(o):s.push(o);r.length>0&&(this.seq=r.concat(s))}setValue(e,t,i,r){let s=this.map[t];s!==void 0&&s.setValue(e,i,r)}setOptional(e,t,i){let r=t[i];r!==void 0&&this.setValue(e,i,r)}static upload(e,t,i,r){for(let s=0,o=t.length;s!==o;++s){let a=t[s],l=i[a.id];l.needsUpdate!==!1&&a.setValue(e,l.value,r)}}static seqWithValue(e,t){let i=[];for(let r=0,s=e.length;r!==s;++r){let o=e[r];o.id in t&&i.push(o)}return i}};function id(n,e,t){let i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}var X_=37297,q_=0;function Y_(n,e){let t=n.split(`
`),i=[],r=Math.max(e-6,0),s=Math.min(e+6,t.length);for(let o=r;o<s;o++){let a=o+1;i.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return i.join(`
`)}var rd=new ze;function $_(n){Je._getMatrix(rd,Je.workingColorSpace,n);let e=`mat3( ${rd.elements.map(t=>t.toFixed(4))} )`;switch(Je.getTransfer(n)){case es:return[e,"LinearTransferOETF"];case et:return[e,"sRGBTransferOETF"];default:return De("WebGLProgram: Unsupported color space: ",n),[e,"LinearTransferOETF"]}}function sd(n,e,t){let i=n.getShaderParameter(e,n.COMPILE_STATUS),s=(n.getShaderInfoLog(e)||"").trim();if(i&&s==="")return"";let o=/ERROR: 0:(\d+)/.exec(s);if(o){let a=parseInt(o[1]);return t.toUpperCase()+`

`+s+`

`+Y_(n.getShaderSource(e),a)}else return s}function Z_(n,e){let t=$_(e);return[`vec4 ${n}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}var K_={[ac]:"Linear",[lc]:"Reinhard",[cc]:"Cineon",[Rs]:"ACESFilmic",[hc]:"AgX",[dc]:"Neutral",[uc]:"Custom"};function J_(n,e){let t=K_[e];return t===void 0?(De("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+n+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var Ya=new B;function j_(){Je.getLuminanceCoefficients(Ya);let n=Ya.x.toFixed(4),e=Ya.y.toFixed(4),t=Ya.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Q_(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(zs).join(`
`)}function ex(n){let e=[];for(let t in n){let i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function tx(n,e){let t={},i=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){let s=n.getActiveAttrib(e,r),o=s.name,a=1;s.type===n.FLOAT_MAT2&&(a=2),s.type===n.FLOAT_MAT3&&(a=3),s.type===n.FLOAT_MAT4&&(a=4),t[o]={type:s.type,location:n.getAttribLocation(e,o),locationSize:a}}return t}function zs(n){return n!==""}function od(n,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function ad(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var nx=/^[ \t]*#include +<([\w\d./]+)>/gm;function Bc(n){return n.replace(nx,rx)}var ix=new Map;function rx(n,e){let t=Xe[e];if(t===void 0){let i=ix.get(e);if(i!==void 0)t=Xe[i],De('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return Bc(t)}var sx=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function ld(n){return n.replace(sx,ox)}function ox(n,e,t,i){let r="";for(let s=parseInt(e);s<parseInt(t);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function cd(n){let e=`precision ${n.precision} float;
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
#define LOW_PRECISION`),e}var ax={[As]:"SHADOWMAP_TYPE_PCF",[Tr]:"SHADOWMAP_TYPE_VSM"};function lx(n){return ax[n.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var cx={[gi]:"ENVMAP_TYPE_CUBE",[Gi]:"ENVMAP_TYPE_CUBE",[Cs]:"ENVMAP_TYPE_CUBE_UV"};function ux(n){return n.envMap===!1?"ENVMAP_TYPE_CUBE":cx[n.envMapMode]||"ENVMAP_TYPE_CUBE"}var hx={[Gi]:"ENVMAP_MODE_REFRACTION"};function dx(n){return n.envMap===!1?"ENVMAP_MODE_REFLECTION":hx[n.envMapMode]||"ENVMAP_MODE_REFLECTION"}var fx={[ia]:"ENVMAP_BLENDING_MULTIPLY",[wh]:"ENVMAP_BLENDING_MIX",[Th]:"ENVMAP_BLENDING_ADD"};function px(n){return n.envMap===!1?"ENVMAP_BLENDING_NONE":fx[n.combine]||"ENVMAP_BLENDING_NONE"}function mx(n){let e=n.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,i=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:i,maxMip:t}}function gx(n,e,t,i){let r=n.getContext(),s=t.defines,o=t.vertexShader,a=t.fragmentShader,l=lx(t),c=ux(t),h=dx(t),p=px(t),u=mx(t),f=Q_(t),m=ex(s),v=r.createProgram(),g,d,M=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(g=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m].filter(zs).join(`
`),g.length>0&&(g+=`
`),d=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m].filter(zs).join(`
`),d.length>0&&(d+=`
`)):(g=[cd(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(zs).join(`
`),d=[cd(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+p:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==wn?"#define TONE_MAPPING":"",t.toneMapping!==wn?Xe.tonemapping_pars_fragment:"",t.toneMapping!==wn?J_("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Xe.colorspace_pars_fragment,Z_("linearToOutputTexel",t.outputColorSpace),j_(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(zs).join(`
`)),o=Bc(o),o=od(o,t),o=ad(o,t),a=Bc(a),a=od(a,t),a=ad(a,t),o=ld(o),a=ld(a),t.isRawShaderMaterial!==!0&&(M=`#version 300 es
`,g=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+g,d=["#define varying in",t.glslVersion===vc?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===vc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+d);let w=M+g+o,x=M+d+a,R=id(r,r.VERTEX_SHADER,w),b=id(r,r.FRAGMENT_SHADER,x);r.attachShader(v,R),r.attachShader(v,b),t.index0AttributeName!==void 0?r.bindAttribLocation(v,0,t.index0AttributeName):t.hasPositionAttribute===!0&&r.bindAttribLocation(v,0,"position"),r.linkProgram(v);function C(A){if(n.debug.checkShaderErrors){let P=r.getProgramInfoLog(v)||"",D=r.getShaderInfoLog(R)||"",N=r.getShaderInfoLog(b)||"",F=P.trim(),k=D.trim(),L=N.trim(),U=!0,G=!0;if(r.getProgramParameter(v,r.LINK_STATUS)===!1)if(U=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(r,v,R,b);else{let Z=sd(r,R,"vertex"),K=sd(r,b,"fragment");Ue("WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(v,r.VALIDATE_STATUS)+`

Material Name: `+A.name+`
Material Type: `+A.type+`

Program Info Log: `+F+`
`+Z+`
`+K)}else F!==""?De("WebGLProgram: Program Info Log:",F):(k===""||L==="")&&(G=!1);G&&(A.diagnostics={runnable:U,programLog:F,vertexShader:{log:k,prefix:g},fragmentShader:{log:L,prefix:d}})}r.deleteShader(R),r.deleteShader(b),_=new Pr(r,v),E=tx(r,v)}let _;this.getUniforms=function(){return _===void 0&&C(this),_};let E;this.getAttributes=function(){return E===void 0&&C(this),E};let T=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return T===!1&&(T=r.getProgramParameter(v,X_)),T},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(v),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=q_++,this.cacheKey=e,this.usedTimes=1,this.program=v,this.vertexShader=R,this.fragmentShader=b,this}var _x=0,kc=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,i){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(i)===!1&&(r.add(i),i.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){let t=this.shaderCache,i=t.get(e);return i===void 0&&(i=new zc(e),t.set(e,i)),i}},zc=class{constructor(e){this.id=_x++,this.code=e,this.usedTimes=0}};function xx(n){return n===yi||n===Fs||n===Us}function yx(n,e,t,i,r,s){let o=new _r,a=new kc,l=new Set,c=[],h=new Map,p=i.logarithmicDepthBuffer,u=i.precision,f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function m(_){return l.add(_),_===0?"uv":`uv${_}`}function v(_,E,T,A,P,D){let N=A.fog,F=P.geometry,k=_.isMeshStandardMaterial||_.isMeshLambertMaterial||_.isMeshPhongMaterial?A.environment:null,L=_.isMeshStandardMaterial||_.isMeshLambertMaterial&&!_.envMap||_.isMeshPhongMaterial&&!_.envMap,U=e.get(_.envMap||k,L),G=U&&U.mapping===Cs?U.image.height:null,Z=f[_.type];_.precision!==null&&(u=i.getMaxPrecision(_.precision),u!==_.precision&&De("WebGLProgram.getParameters:",_.precision,"not supported, using",u,"instead."));let K=F.morphAttributes.position||F.morphAttributes.normal||F.morphAttributes.color,ne=K!==void 0?K.length:0,ce=0;F.morphAttributes.position!==void 0&&(ce=1),F.morphAttributes.normal!==void 0&&(ce=2),F.morphAttributes.color!==void 0&&(ce=3);let Ae,Re,$,ie;if(Z){let Me=zn[Z];Ae=Me.vertexShader,Re=Me.fragmentShader}else{Ae=_.vertexShader,Re=_.fragmentShader;let Me=a.getVertexShaderStage(_),xt=a.getFragmentShaderStage(_);a.update(_,Me,xt),$=Me.id,ie=xt.id}let te=n.getRenderTarget(),be=n.state.buffers.depth.getReversed(),Oe=P.isInstancedMesh===!0,Se=P.isBatchedMesh===!0,qe=!!_.map,Ne=!!_.matcap,We=!!U,Ye=!!_.aoMap,Ke=!!_.lightMap,pt=!!_.bumpMap&&_.wireframe===!1,gt=!!_.normalMap,Mt=!!_.displacementMap,Pt=!!_.emissiveMap,_t=!!_.metalnessMap,At=!!_.roughnessMap,z=_.anisotropy>0,jt=_.clearcoat>0,nt=_.dispersion>0,I=_.iridescence>0,y=_.sheen>0,H=_.transmission>0,q=z&&!!_.anisotropyMap,J=jt&&!!_.clearcoatMap,ae=jt&&!!_.clearcoatNormalMap,ue=jt&&!!_.clearcoatRoughnessMap,j=I&&!!_.iridescenceMap,ee=I&&!!_.iridescenceThicknessMap,he=y&&!!_.sheenColorMap,Ce=y&&!!_.sheenRoughnessMap,pe=!!_.specularMap,de=!!_.specularColorMap,Le=!!_.specularIntensityMap,Fe=H&&!!_.transmissionMap,Ge=H&&!!_.thicknessMap,O=!!_.gradientMap,le=!!_.alphaMap,Q=_.alphaTest>0,fe=!!_.alphaHash,xe=!!_.extensions,re=wn;_.toneMapped&&(te===null||te.isXRRenderTarget===!0)&&(re=n.toneMapping);let Te={shaderID:Z,shaderType:_.type,shaderName:_.name,vertexShader:Ae,fragmentShader:Re,defines:_.defines,customVertexShaderID:$,customFragmentShaderID:ie,isRawShaderMaterial:_.isRawShaderMaterial===!0,glslVersion:_.glslVersion,precision:u,batching:Se,batchingColor:Se&&P._colorsTexture!==null,instancing:Oe,instancingColor:Oe&&P.instanceColor!==null,instancingMorph:Oe&&P.morphTexture!==null,outputColorSpace:te===null?n.outputColorSpace:te.isXRRenderTarget===!0?te.texture.colorSpace:Je.workingColorSpace,alphaToCoverage:!!_.alphaToCoverage,map:qe,matcap:Ne,envMap:We,envMapMode:We&&U.mapping,envMapCubeUVHeight:G,aoMap:Ye,lightMap:Ke,bumpMap:pt,normalMap:gt,displacementMap:Mt,emissiveMap:Pt,normalMapObjectSpace:gt&&_.normalMapType===Rh,normalMapTangentSpace:gt&&_.normalMapType===Os,packedNormalMap:gt&&_.normalMapType===Os&&xx(_.normalMap.format),metalnessMap:_t,roughnessMap:At,anisotropy:z,anisotropyMap:q,clearcoat:jt,clearcoatMap:J,clearcoatNormalMap:ae,clearcoatRoughnessMap:ue,dispersion:nt,iridescence:I,iridescenceMap:j,iridescenceThicknessMap:ee,sheen:y,sheenColorMap:he,sheenRoughnessMap:Ce,specularMap:pe,specularColorMap:de,specularIntensityMap:Le,transmission:H,transmissionMap:Fe,thicknessMap:Ge,gradientMap:O,opaque:_.transparent===!1&&_.blending===Ui&&_.alphaToCoverage===!1,alphaMap:le,alphaTest:Q,alphaHash:fe,combine:_.combine,mapUv:qe&&m(_.map.channel),aoMapUv:Ye&&m(_.aoMap.channel),lightMapUv:Ke&&m(_.lightMap.channel),bumpMapUv:pt&&m(_.bumpMap.channel),normalMapUv:gt&&m(_.normalMap.channel),displacementMapUv:Mt&&m(_.displacementMap.channel),emissiveMapUv:Pt&&m(_.emissiveMap.channel),metalnessMapUv:_t&&m(_.metalnessMap.channel),roughnessMapUv:At&&m(_.roughnessMap.channel),anisotropyMapUv:q&&m(_.anisotropyMap.channel),clearcoatMapUv:J&&m(_.clearcoatMap.channel),clearcoatNormalMapUv:ae&&m(_.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:ue&&m(_.clearcoatRoughnessMap.channel),iridescenceMapUv:j&&m(_.iridescenceMap.channel),iridescenceThicknessMapUv:ee&&m(_.iridescenceThicknessMap.channel),sheenColorMapUv:he&&m(_.sheenColorMap.channel),sheenRoughnessMapUv:Ce&&m(_.sheenRoughnessMap.channel),specularMapUv:pe&&m(_.specularMap.channel),specularColorMapUv:de&&m(_.specularColorMap.channel),specularIntensityMapUv:Le&&m(_.specularIntensityMap.channel),transmissionMapUv:Fe&&m(_.transmissionMap.channel),thicknessMapUv:Ge&&m(_.thicknessMap.channel),alphaMapUv:le&&m(_.alphaMap.channel),vertexTangents:!!F.attributes.tangent&&(gt||z),vertexNormals:!!F.attributes.normal,vertexColors:_.vertexColors,vertexAlphas:_.vertexColors===!0&&!!F.attributes.color&&F.attributes.color.itemSize===4,pointsUvs:P.isPoints===!0&&!!F.attributes.uv&&(qe||le),fog:!!N,useFog:_.fog===!0,fogExp2:!!N&&N.isFogExp2,flatShading:_.wireframe===!1&&(_.flatShading===!0||F.attributes.normal===void 0&&gt===!1&&(_.isMeshLambertMaterial||_.isMeshPhongMaterial||_.isMeshStandardMaterial||_.isMeshPhysicalMaterial)),sizeAttenuation:_.sizeAttenuation===!0,logarithmicDepthBuffer:p,reversedDepthBuffer:be,skinning:P.isSkinnedMesh===!0,hasPositionAttribute:F.attributes.position!==void 0,morphTargets:F.morphAttributes.position!==void 0,morphNormals:F.morphAttributes.normal!==void 0,morphColors:F.morphAttributes.color!==void 0,morphTargetsCount:ne,morphTextureStride:ce,numDirLights:E.directional.length,numPointLights:E.point.length,numSpotLights:E.spot.length,numSpotLightMaps:E.spotLightMap.length,numRectAreaLights:E.rectArea.length,numHemiLights:E.hemi.length,numDirLightShadows:E.directionalShadowMap.length,numPointLightShadows:E.pointShadowMap.length,numSpotLightShadows:E.spotShadowMap.length,numSpotLightShadowsWithMaps:E.numSpotLightShadowsWithMaps,numLightProbes:E.numLightProbes,numLightProbeGrids:D.length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:_.dithering,shadowMapEnabled:n.shadowMap.enabled&&T.length>0,shadowMapType:n.shadowMap.type,toneMapping:re,decodeVideoTexture:qe&&_.map.isVideoTexture===!0&&Je.getTransfer(_.map.colorSpace)===et,decodeVideoTextureEmissive:Pt&&_.emissiveMap.isVideoTexture===!0&&Je.getTransfer(_.emissiveMap.colorSpace)===et,premultipliedAlpha:_.premultipliedAlpha,doubleSided:_.side===Et,flipSided:_.side===Kt,useDepthPacking:_.depthPacking>=0,depthPacking:_.depthPacking||0,index0AttributeName:_.index0AttributeName,extensionClipCullDistance:xe&&_.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(xe&&_.extensions.multiDraw===!0||Se)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:_.customProgramCacheKey()};return Te.vertexUv1s=l.has(1),Te.vertexUv2s=l.has(2),Te.vertexUv3s=l.has(3),l.clear(),Te}function g(_){let E=[];if(_.shaderID?E.push(_.shaderID):(E.push(_.customVertexShaderID),E.push(_.customFragmentShaderID)),_.defines!==void 0)for(let T in _.defines)E.push(T),E.push(_.defines[T]);return _.isRawShaderMaterial===!1&&(d(E,_),M(E,_),E.push(n.outputColorSpace)),E.push(_.customProgramCacheKey),E.join()}function d(_,E){_.push(E.precision),_.push(E.outputColorSpace),_.push(E.envMapMode),_.push(E.envMapCubeUVHeight),_.push(E.mapUv),_.push(E.alphaMapUv),_.push(E.lightMapUv),_.push(E.aoMapUv),_.push(E.bumpMapUv),_.push(E.normalMapUv),_.push(E.displacementMapUv),_.push(E.emissiveMapUv),_.push(E.metalnessMapUv),_.push(E.roughnessMapUv),_.push(E.anisotropyMapUv),_.push(E.clearcoatMapUv),_.push(E.clearcoatNormalMapUv),_.push(E.clearcoatRoughnessMapUv),_.push(E.iridescenceMapUv),_.push(E.iridescenceThicknessMapUv),_.push(E.sheenColorMapUv),_.push(E.sheenRoughnessMapUv),_.push(E.specularMapUv),_.push(E.specularColorMapUv),_.push(E.specularIntensityMapUv),_.push(E.transmissionMapUv),_.push(E.thicknessMapUv),_.push(E.combine),_.push(E.fogExp2),_.push(E.sizeAttenuation),_.push(E.morphTargetsCount),_.push(E.morphAttributeCount),_.push(E.numDirLights),_.push(E.numPointLights),_.push(E.numSpotLights),_.push(E.numSpotLightMaps),_.push(E.numHemiLights),_.push(E.numRectAreaLights),_.push(E.numDirLightShadows),_.push(E.numPointLightShadows),_.push(E.numSpotLightShadows),_.push(E.numSpotLightShadowsWithMaps),_.push(E.numLightProbes),_.push(E.shadowMapType),_.push(E.toneMapping),_.push(E.numClippingPlanes),_.push(E.numClipIntersection),_.push(E.depthPacking)}function M(_,E){o.disableAll(),E.instancing&&o.enable(0),E.instancingColor&&o.enable(1),E.instancingMorph&&o.enable(2),E.matcap&&o.enable(3),E.envMap&&o.enable(4),E.normalMapObjectSpace&&o.enable(5),E.normalMapTangentSpace&&o.enable(6),E.clearcoat&&o.enable(7),E.iridescence&&o.enable(8),E.alphaTest&&o.enable(9),E.vertexColors&&o.enable(10),E.vertexAlphas&&o.enable(11),E.vertexUv1s&&o.enable(12),E.vertexUv2s&&o.enable(13),E.vertexUv3s&&o.enable(14),E.vertexTangents&&o.enable(15),E.anisotropy&&o.enable(16),E.alphaHash&&o.enable(17),E.batching&&o.enable(18),E.dispersion&&o.enable(19),E.batchingColor&&o.enable(20),E.gradientMap&&o.enable(21),E.packedNormalMap&&o.enable(22),E.vertexNormals&&o.enable(23),_.push(o.mask),o.disableAll(),E.fog&&o.enable(0),E.useFog&&o.enable(1),E.flatShading&&o.enable(2),E.logarithmicDepthBuffer&&o.enable(3),E.reversedDepthBuffer&&o.enable(4),E.skinning&&o.enable(5),E.morphTargets&&o.enable(6),E.morphNormals&&o.enable(7),E.morphColors&&o.enable(8),E.premultipliedAlpha&&o.enable(9),E.shadowMapEnabled&&o.enable(10),E.doubleSided&&o.enable(11),E.flipSided&&o.enable(12),E.useDepthPacking&&o.enable(13),E.dithering&&o.enable(14),E.transmission&&o.enable(15),E.sheen&&o.enable(16),E.opaque&&o.enable(17),E.pointsUvs&&o.enable(18),E.decodeVideoTexture&&o.enable(19),E.decodeVideoTextureEmissive&&o.enable(20),E.alphaToCoverage&&o.enable(21),E.numLightProbeGrids>0&&o.enable(22),E.hasPositionAttribute&&o.enable(23),_.push(o.mask)}function w(_){let E=f[_.type],T;if(E){let A=zn[E];T=Wh.clone(A.uniforms)}else T=_.uniforms;return T}function x(_,E){let T=h.get(E);return T!==void 0?++T.usedTimes:(T=new gx(n,E,_,r),c.push(T),h.set(E,T)),T}function R(_){if(--_.usedTimes===0){let E=c.indexOf(_);c[E]=c[c.length-1],c.pop(),h.delete(_.cacheKey),_.destroy()}}function b(_){a.remove(_)}function C(){a.dispose()}return{getParameters:v,getProgramCacheKey:g,getUniforms:w,acquireProgram:x,releaseProgram:R,releaseShaderCache:b,programs:c,dispose:C}}function vx(){let n=new WeakMap;function e(o){return n.has(o)}function t(o){let a=n.get(o);return a===void 0&&(a={},n.set(o,a)),a}function i(o){n.delete(o)}function r(o,a,l){n.get(o)[a]=l}function s(){n=new WeakMap}return{has:e,get:t,remove:i,update:r,dispose:s}}function bx(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.materialVariant!==e.materialVariant?n.materialVariant-e.materialVariant:n.z!==e.z?n.z-e.z:n.id-e.id}function ud(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function hd(){let n=[],e=0,t=[],i=[],r=[];function s(){e=0,t.length=0,i.length=0,r.length=0}function o(u){let f=0;return u.isInstancedMesh&&(f+=2),u.isSkinnedMesh&&(f+=1),f}function a(u,f,m,v,g,d){let M=n[e];return M===void 0?(M={id:u.id,object:u,geometry:f,material:m,materialVariant:o(u),groupOrder:v,renderOrder:u.renderOrder,z:g,group:d},n[e]=M):(M.id=u.id,M.object=u,M.geometry=f,M.material=m,M.materialVariant=o(u),M.groupOrder=v,M.renderOrder=u.renderOrder,M.z=g,M.group=d),e++,M}function l(u,f,m,v,g,d){let M=a(u,f,m,v,g,d);m.transmission>0?i.push(M):m.transparent===!0?r.push(M):t.push(M)}function c(u,f,m,v,g,d){let M=a(u,f,m,v,g,d);m.transmission>0?i.unshift(M):m.transparent===!0?r.unshift(M):t.unshift(M)}function h(u,f,m){t.length>1&&t.sort(u||bx),i.length>1&&i.sort(f||ud),r.length>1&&r.sort(f||ud),m&&(t.reverse(),i.reverse(),r.reverse())}function p(){for(let u=e,f=n.length;u<f;u++){let m=n[u];if(m.id===null)break;m.id=null,m.object=null,m.geometry=null,m.material=null,m.group=null}}return{opaque:t,transmissive:i,transparent:r,init:s,push:l,unshift:c,finish:p,sort:h}}function Mx(){let n=new WeakMap;function e(i,r){let s=n.get(i),o;return s===void 0?(o=new hd,n.set(i,[o])):r>=s.length?(o=new hd,s.push(o)):o=s[r],o}function t(){n=new WeakMap}return{get:e,dispose:t}}function Sx(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new B,color:new ke};break;case"SpotLight":t={position:new B,direction:new B,color:new ke,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new B,color:new ke,distance:0,decay:0};break;case"HemisphereLight":t={direction:new B,skyColor:new ke,groundColor:new ke};break;case"RectAreaLight":t={color:new ke,position:new B,halfWidth:new B,halfHeight:new B};break}return n[e.id]=t,t}}}function wx(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ee};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ee};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ee,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}var Tx=0;function Ex(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function Ax(n){let e=new Sx,t=wx(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new B);let r=new B,s=new lt,o=new lt;function a(c){let h=0,p=0,u=0;for(let E=0;E<9;E++)i.probe[E].set(0,0,0);let f=0,m=0,v=0,g=0,d=0,M=0,w=0,x=0,R=0,b=0,C=0;c.sort(Ex);for(let E=0,T=c.length;E<T;E++){let A=c[E],P=A.color,D=A.intensity,N=A.distance,F=null;if(A.shadow&&A.shadow.map&&(A.shadow.map.texture.format===yi?F=A.shadow.map.texture:F=A.shadow.map.depthTexture||A.shadow.map.texture),A.isAmbientLight)h+=P.r*D,p+=P.g*D,u+=P.b*D;else if(A.isLightProbe){for(let k=0;k<9;k++)i.probe[k].addScaledVector(A.sh.coefficients[k],D);C++}else if(A.isDirectionalLight){let k=e.get(A);if(k.color.copy(A.color).multiplyScalar(A.intensity),A.castShadow){let L=A.shadow,U=t.get(A);U.shadowIntensity=L.intensity,U.shadowBias=L.bias,U.shadowNormalBias=L.normalBias,U.shadowRadius=L.radius,U.shadowMapSize=L.mapSize,i.directionalShadow[f]=U,i.directionalShadowMap[f]=F,i.directionalShadowMatrix[f]=A.shadow.matrix,M++}i.directional[f]=k,f++}else if(A.isSpotLight){let k=e.get(A);k.position.setFromMatrixPosition(A.matrixWorld),k.color.copy(P).multiplyScalar(D),k.distance=N,k.coneCos=Math.cos(A.angle),k.penumbraCos=Math.cos(A.angle*(1-A.penumbra)),k.decay=A.decay,i.spot[v]=k;let L=A.shadow;if(A.map&&(i.spotLightMap[R]=A.map,R++,L.updateMatrices(A),A.castShadow&&b++),i.spotLightMatrix[v]=L.matrix,A.castShadow){let U=t.get(A);U.shadowIntensity=L.intensity,U.shadowBias=L.bias,U.shadowNormalBias=L.normalBias,U.shadowRadius=L.radius,U.shadowMapSize=L.mapSize,i.spotShadow[v]=U,i.spotShadowMap[v]=F,x++}v++}else if(A.isRectAreaLight){let k=e.get(A);k.color.copy(P).multiplyScalar(D),k.halfWidth.set(A.width*.5,0,0),k.halfHeight.set(0,A.height*.5,0),i.rectArea[g]=k,g++}else if(A.isPointLight){let k=e.get(A);if(k.color.copy(A.color).multiplyScalar(A.intensity),k.distance=A.distance,k.decay=A.decay,A.castShadow){let L=A.shadow,U=t.get(A);U.shadowIntensity=L.intensity,U.shadowBias=L.bias,U.shadowNormalBias=L.normalBias,U.shadowRadius=L.radius,U.shadowMapSize=L.mapSize,U.shadowCameraNear=L.camera.near,U.shadowCameraFar=L.camera.far,i.pointShadow[m]=U,i.pointShadowMap[m]=F,i.pointShadowMatrix[m]=A.shadow.matrix,w++}i.point[m]=k,m++}else if(A.isHemisphereLight){let k=e.get(A);k.skyColor.copy(A.color).multiplyScalar(D),k.groundColor.copy(A.groundColor).multiplyScalar(D),i.hemi[d]=k,d++}}g>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=me.LTC_FLOAT_1,i.rectAreaLTC2=me.LTC_FLOAT_2):(i.rectAreaLTC1=me.LTC_HALF_1,i.rectAreaLTC2=me.LTC_HALF_2)),i.ambient[0]=h,i.ambient[1]=p,i.ambient[2]=u;let _=i.hash;(_.directionalLength!==f||_.pointLength!==m||_.spotLength!==v||_.rectAreaLength!==g||_.hemiLength!==d||_.numDirectionalShadows!==M||_.numPointShadows!==w||_.numSpotShadows!==x||_.numSpotMaps!==R||_.numLightProbes!==C)&&(i.directional.length=f,i.spot.length=v,i.rectArea.length=g,i.point.length=m,i.hemi.length=d,i.directionalShadow.length=M,i.directionalShadowMap.length=M,i.pointShadow.length=w,i.pointShadowMap.length=w,i.spotShadow.length=x,i.spotShadowMap.length=x,i.directionalShadowMatrix.length=M,i.pointShadowMatrix.length=w,i.spotLightMatrix.length=x+R-b,i.spotLightMap.length=R,i.numSpotLightShadowsWithMaps=b,i.numLightProbes=C,_.directionalLength=f,_.pointLength=m,_.spotLength=v,_.rectAreaLength=g,_.hemiLength=d,_.numDirectionalShadows=M,_.numPointShadows=w,_.numSpotShadows=x,_.numSpotMaps=R,_.numLightProbes=C,i.version=Tx++)}function l(c,h){let p=0,u=0,f=0,m=0,v=0,g=h.matrixWorldInverse;for(let d=0,M=c.length;d<M;d++){let w=c[d];if(w.isDirectionalLight){let x=i.directional[p];x.direction.setFromMatrixPosition(w.matrixWorld),r.setFromMatrixPosition(w.target.matrixWorld),x.direction.sub(r),x.direction.transformDirection(g),p++}else if(w.isSpotLight){let x=i.spot[f];x.position.setFromMatrixPosition(w.matrixWorld),x.position.applyMatrix4(g),x.direction.setFromMatrixPosition(w.matrixWorld),r.setFromMatrixPosition(w.target.matrixWorld),x.direction.sub(r),x.direction.transformDirection(g),f++}else if(w.isRectAreaLight){let x=i.rectArea[m];x.position.setFromMatrixPosition(w.matrixWorld),x.position.applyMatrix4(g),o.identity(),s.copy(w.matrixWorld),s.premultiply(g),o.extractRotation(s),x.halfWidth.set(w.width*.5,0,0),x.halfHeight.set(0,w.height*.5,0),x.halfWidth.applyMatrix4(o),x.halfHeight.applyMatrix4(o),m++}else if(w.isPointLight){let x=i.point[u];x.position.setFromMatrixPosition(w.matrixWorld),x.position.applyMatrix4(g),u++}else if(w.isHemisphereLight){let x=i.hemi[v];x.direction.setFromMatrixPosition(w.matrixWorld),x.direction.transformDirection(g),v++}}}return{setup:a,setupView:l,state:i}}function dd(n){let e=new Ax(n),t=[],i=[],r=[];function s(u){p.camera=u,t.length=0,i.length=0,r.length=0}function o(u){t.push(u)}function a(u){i.push(u)}function l(u){r.push(u)}function c(){e.setup(t)}function h(u){e.setupView(t,u)}let p={lightsArray:t,shadowsArray:i,lightProbeGridArray:r,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:s,state:p,setupLights:c,setupLightsView:h,pushLight:o,pushShadow:a,pushLightProbeGrid:l}}function Rx(n){let e=new WeakMap;function t(r,s=0){let o=e.get(r),a;return o===void 0?(a=new dd(n),e.set(r,[a])):s>=o.length?(a=new dd(n),o.push(a)):a=o[s],a}function i(){e=new WeakMap}return{get:t,dispose:i}}var Cx=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Px=`uniform sampler2D shadow_pass;
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
}`,Ix=[new B(1,0,0),new B(-1,0,0),new B(0,1,0),new B(0,-1,0),new B(0,0,1),new B(0,0,-1)],Lx=[new B(0,-1,0),new B(0,-1,0),new B(0,0,1),new B(0,0,-1),new B(0,-1,0),new B(0,-1,0)],fd=new lt,ks=new B,Dc=new B;function Dx(n,e,t){let i=new yr,r=new Ee,s=new Ee,o=new dt,a=new Go,l=new Ho,c={},h=t.maxTextureSize,p={[bn]:Kt,[Kt]:bn,[Et]:Et},u=new cn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Ee},radius:{value:4}},vertexShader:Cx,fragmentShader:Px}),f=u.clone();f.defines.HORIZONTAL_PASS=1;let m=new Tt;m.setAttribute("position",new $t(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let v=new ft(m,u),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=As;let d=this.type;this.render=function(b,C,_){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||b.length===0)return;this.type===na&&(De("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=As);let E=n.getRenderTarget(),T=n.getActiveCubeFace(),A=n.getActiveMipmapLevel(),P=n.state;P.setBlending(On),P.buffers.depth.getReversed()===!0?P.buffers.color.setClear(0,0,0,0):P.buffers.color.setClear(1,1,1,1),P.buffers.depth.setTest(!0),P.setScissorTest(!1);let D=d!==this.type;D&&C.traverse(function(N){N.material&&(Array.isArray(N.material)?N.material.forEach(F=>F.needsUpdate=!0):N.material.needsUpdate=!0)});for(let N=0,F=b.length;N<F;N++){let k=b[N],L=k.shadow;if(L===void 0){De("WebGLShadowMap:",k,"has no shadow.");continue}if(L.autoUpdate===!1&&L.needsUpdate===!1)continue;r.copy(L.mapSize);let U=L.getFrameExtents();r.multiply(U),s.copy(L.mapSize),(r.x>h||r.y>h)&&(r.x>h&&(s.x=Math.floor(h/U.x),r.x=s.x*U.x,L.mapSize.x=s.x),r.y>h&&(s.y=Math.floor(h/U.y),r.y=s.y*U.y,L.mapSize.y=s.y));let G=n.state.buffers.depth.getReversed();if(L.camera._reversedDepth=G,L.map===null||D===!0){if(L.map!==null&&(L.map.depthTexture!==null&&(L.map.depthTexture.dispose(),L.map.depthTexture=null),L.map.dispose()),this.type===Tr){if(k.isPointLight){De("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}L.map=new ln(r.x,r.y,{format:yi,type:Bn,minFilter:It,magFilter:It,generateMipmaps:!1}),L.map.texture.name=k.name+".shadowMap",L.map.depthTexture=new Jn(r.x,r.y,fn),L.map.depthTexture.name=k.name+".shadowMapDepth",L.map.depthTexture.format=Nn,L.map.depthTexture.compareFunction=null,L.map.depthTexture.minFilter=Ot,L.map.depthTexture.magFilter=Ot}else k.isPointLight?(L.map=new Za(r.x),L.map.depthTexture=new ko(r.x,Tn)):(L.map=new ln(r.x,r.y),L.map.depthTexture=new Jn(r.x,r.y,Tn)),L.map.depthTexture.name=k.name+".shadowMap",L.map.depthTexture.format=Nn,this.type===As?(L.map.depthTexture.compareFunction=G?Xa:Wa,L.map.depthTexture.minFilter=It,L.map.depthTexture.magFilter=It):(L.map.depthTexture.compareFunction=null,L.map.depthTexture.minFilter=Ot,L.map.depthTexture.magFilter=Ot);L.camera.updateProjectionMatrix()}let Z=L.map.isWebGLCubeRenderTarget?6:1;for(let K=0;K<Z;K++){if(L.map.isWebGLCubeRenderTarget)n.setRenderTarget(L.map,K),n.clear();else{K===0&&(n.setRenderTarget(L.map),n.clear());let ne=L.getViewport(K);o.set(s.x*ne.x,s.y*ne.y,s.x*ne.z,s.y*ne.w),P.viewport(o)}if(k.isPointLight){let ne=L.camera,ce=L.matrix,Ae=k.distance||ne.far;Ae!==ne.far&&(ne.far=Ae,ne.updateProjectionMatrix()),ks.setFromMatrixPosition(k.matrixWorld),ne.position.copy(ks),Dc.copy(ne.position),Dc.add(Ix[K]),ne.up.copy(Lx[K]),ne.lookAt(Dc),ne.updateMatrixWorld(),ce.makeTranslation(-ks.x,-ks.y,-ks.z),fd.multiplyMatrices(ne.projectionMatrix,ne.matrixWorldInverse),L._frustum.setFromProjectionMatrix(fd,ne.coordinateSystem,ne.reversedDepth)}else L.updateMatrices(k);i=L.getFrustum(),x(C,_,L.camera,k,this.type)}L.isPointLightShadow!==!0&&this.type===Tr&&M(L,_),L.needsUpdate=!1}d=this.type,g.needsUpdate=!1,n.setRenderTarget(E,T,A)};function M(b,C){let _=e.update(v);u.defines.VSM_SAMPLES!==b.blurSamples&&(u.defines.VSM_SAMPLES=b.blurSamples,f.defines.VSM_SAMPLES=b.blurSamples,u.needsUpdate=!0,f.needsUpdate=!0),b.mapPass===null&&(b.mapPass=new ln(r.x,r.y,{format:yi,type:Bn})),u.uniforms.shadow_pass.value=b.map.depthTexture,u.uniforms.resolution.value=b.mapSize,u.uniforms.radius.value=b.radius,n.setRenderTarget(b.mapPass),n.clear(),n.renderBufferDirect(C,null,_,u,v,null),f.uniforms.shadow_pass.value=b.mapPass.texture,f.uniforms.resolution.value=b.mapSize,f.uniforms.radius.value=b.radius,n.setRenderTarget(b.map),n.clear(),n.renderBufferDirect(C,null,_,f,v,null)}function w(b,C,_,E){let T=null,A=_.isPointLight===!0?b.customDistanceMaterial:b.customDepthMaterial;if(A!==void 0)T=A;else if(T=_.isPointLight===!0?l:a,n.localClippingEnabled&&C.clipShadows===!0&&Array.isArray(C.clippingPlanes)&&C.clippingPlanes.length!==0||C.displacementMap&&C.displacementScale!==0||C.alphaMap&&C.alphaTest>0||C.map&&C.alphaTest>0||C.alphaToCoverage===!0){let P=T.uuid,D=C.uuid,N=c[P];N===void 0&&(N={},c[P]=N);let F=N[D];F===void 0&&(F=T.clone(),N[D]=F,C.addEventListener("dispose",R)),T=F}if(T.visible=C.visible,T.wireframe=C.wireframe,E===Tr?T.side=C.shadowSide!==null?C.shadowSide:C.side:T.side=C.shadowSide!==null?C.shadowSide:p[C.side],T.alphaMap=C.alphaMap,T.alphaTest=C.alphaToCoverage===!0?.5:C.alphaTest,T.map=C.map,T.clipShadows=C.clipShadows,T.clippingPlanes=C.clippingPlanes,T.clipIntersection=C.clipIntersection,T.displacementMap=C.displacementMap,T.displacementScale=C.displacementScale,T.displacementBias=C.displacementBias,T.wireframeLinewidth=C.wireframeLinewidth,T.linewidth=C.linewidth,_.isPointLight===!0&&T.isMeshDistanceMaterial===!0){let P=n.properties.get(T);P.light=_}return T}function x(b,C,_,E,T){if(b.visible===!1)return;if(b.layers.test(C.layers)&&(b.isMesh||b.isLine||b.isPoints)&&(b.castShadow||b.receiveShadow&&T===Tr)&&(!b.frustumCulled||i.intersectsObject(b))){b.modelViewMatrix.multiplyMatrices(_.matrixWorldInverse,b.matrixWorld);let D=e.update(b),N=b.material;if(Array.isArray(N)){let F=D.groups;for(let k=0,L=F.length;k<L;k++){let U=F[k],G=N[U.materialIndex];if(G&&G.visible){let Z=w(b,G,E,T);b.onBeforeShadow(n,b,C,_,D,Z,U),n.renderBufferDirect(_,null,D,Z,b,U),b.onAfterShadow(n,b,C,_,D,Z,U)}}}else if(N.visible){let F=w(b,N,E,T);b.onBeforeShadow(n,b,C,_,D,F,null),n.renderBufferDirect(_,null,D,F,b,null),b.onAfterShadow(n,b,C,_,D,F,null)}}let P=b.children;for(let D=0,N=P.length;D<N;D++)x(P[D],C,_,E,T)}function R(b){b.target.removeEventListener("dispose",R);for(let _ in c){let E=c[_],T=b.target.uuid;T in E&&(E[T].dispose(),delete E[T])}}}function Nx(n,e){function t(){let O=!1,le=new dt,Q=null,fe=new dt(0,0,0,0);return{setMask:function(xe){Q!==xe&&!O&&(n.colorMask(xe,xe,xe,xe),Q=xe)},setLocked:function(xe){O=xe},setClear:function(xe,re,Te,Me,xt){xt===!0&&(xe*=Me,re*=Me,Te*=Me),le.set(xe,re,Te,Me),fe.equals(le)===!1&&(n.clearColor(xe,re,Te,Me),fe.copy(le))},reset:function(){O=!1,Q=null,fe.set(-1,0,0,0)}}}function i(){let O=!1,le=!1,Q=null,fe=null,xe=null;return{setReversed:function(re){if(le!==re){let Te=e.get("EXT_clip_control");re?Te.clipControlEXT(Te.LOWER_LEFT_EXT,Te.ZERO_TO_ONE_EXT):Te.clipControlEXT(Te.LOWER_LEFT_EXT,Te.NEGATIVE_ONE_TO_ONE_EXT),le=re;let Me=xe;xe=null,this.setClear(Me)}},getReversed:function(){return le},setTest:function(re){re?te(n.DEPTH_TEST):be(n.DEPTH_TEST)},setMask:function(re){Q!==re&&!O&&(n.depthMask(re),Q=re)},setFunc:function(re){if(le&&(re=Bh[re]),fe!==re){switch(re){case Eo:n.depthFunc(n.NEVER);break;case Ao:n.depthFunc(n.ALWAYS);break;case Ro:n.depthFunc(n.LESS);break;case Oi:n.depthFunc(n.LEQUAL);break;case Co:n.depthFunc(n.EQUAL);break;case Po:n.depthFunc(n.GEQUAL);break;case Io:n.depthFunc(n.GREATER);break;case Lo:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}fe=re}},setLocked:function(re){O=re},setClear:function(re){xe!==re&&(xe=re,le&&(re=1-re),n.clearDepth(re))},reset:function(){O=!1,Q=null,fe=null,xe=null,le=!1}}}function r(){let O=!1,le=null,Q=null,fe=null,xe=null,re=null,Te=null,Me=null,xt=null;return{setTest:function(ct){O||(ct?te(n.STENCIL_TEST):be(n.STENCIL_TEST))},setMask:function(ct){le!==ct&&!O&&(n.stencilMask(ct),le=ct)},setFunc:function(ct,Cn,Pn){(Q!==ct||fe!==Cn||xe!==Pn)&&(n.stencilFunc(ct,Cn,Pn),Q=ct,fe=Cn,xe=Pn)},setOp:function(ct,Cn,Pn){(re!==ct||Te!==Cn||Me!==Pn)&&(n.stencilOp(ct,Cn,Pn),re=ct,Te=Cn,Me=Pn)},setLocked:function(ct){O=ct},setClear:function(ct){xt!==ct&&(n.clearStencil(ct),xt=ct)},reset:function(){O=!1,le=null,Q=null,fe=null,xe=null,re=null,Te=null,Me=null,xt=null}}}let s=new t,o=new i,a=new r,l=new WeakMap,c=new WeakMap,h={},p={},u={},f=new WeakMap,m=[],v=null,g=!1,d=null,M=null,w=null,x=null,R=null,b=null,C=null,_=new ke(0,0,0),E=0,T=!1,A=null,P=null,D=null,N=null,F=null,k=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS),L=!1,U=0,G=n.getParameter(n.VERSION);G.indexOf("WebGL")!==-1?(U=parseFloat(/^WebGL (\d)/.exec(G)[1]),L=U>=1):G.indexOf("OpenGL ES")!==-1&&(U=parseFloat(/^OpenGL ES (\d)/.exec(G)[1]),L=U>=2);let Z=null,K={},ne=n.getParameter(n.SCISSOR_BOX),ce=n.getParameter(n.VIEWPORT),Ae=new dt().fromArray(ne),Re=new dt().fromArray(ce);function $(O,le,Q,fe){let xe=new Uint8Array(4),re=n.createTexture();n.bindTexture(O,re),n.texParameteri(O,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(O,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let Te=0;Te<Q;Te++)O===n.TEXTURE_3D||O===n.TEXTURE_2D_ARRAY?n.texImage3D(le,0,n.RGBA,1,1,fe,0,n.RGBA,n.UNSIGNED_BYTE,xe):n.texImage2D(le+Te,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,xe);return re}let ie={};ie[n.TEXTURE_2D]=$(n.TEXTURE_2D,n.TEXTURE_2D,1),ie[n.TEXTURE_CUBE_MAP]=$(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),ie[n.TEXTURE_2D_ARRAY]=$(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),ie[n.TEXTURE_3D]=$(n.TEXTURE_3D,n.TEXTURE_3D,1,1),s.setClear(0,0,0,1),o.setClear(1),a.setClear(0),te(n.DEPTH_TEST),o.setFunc(Oi),pt(!1),gt(ic),te(n.CULL_FACE),Ye(On);function te(O){h[O]!==!0&&(n.enable(O),h[O]=!0)}function be(O){h[O]!==!1&&(n.disable(O),h[O]=!1)}function Oe(O,le){return u[O]!==le?(n.bindFramebuffer(O,le),u[O]=le,O===n.DRAW_FRAMEBUFFER&&(u[n.FRAMEBUFFER]=le),O===n.FRAMEBUFFER&&(u[n.DRAW_FRAMEBUFFER]=le),!0):!1}function Se(O,le){let Q=m,fe=!1;if(O){Q=f.get(le),Q===void 0&&(Q=[],f.set(le,Q));let xe=O.textures;if(Q.length!==xe.length||Q[0]!==n.COLOR_ATTACHMENT0){for(let re=0,Te=xe.length;re<Te;re++)Q[re]=n.COLOR_ATTACHMENT0+re;Q.length=xe.length,fe=!0}}else Q[0]!==n.BACK&&(Q[0]=n.BACK,fe=!0);fe&&n.drawBuffers(Q)}function qe(O){return v!==O?(n.useProgram(O),v=O,!0):!1}let Ne={[ci]:n.FUNC_ADD,[ah]:n.FUNC_SUBTRACT,[lh]:n.FUNC_REVERSE_SUBTRACT};Ne[ch]=n.MIN,Ne[uh]=n.MAX;let We={[hh]:n.ZERO,[dh]:n.ONE,[fh]:n.SRC_COLOR,[wo]:n.SRC_ALPHA,[yh]:n.SRC_ALPHA_SATURATE,[_h]:n.DST_COLOR,[mh]:n.DST_ALPHA,[ph]:n.ONE_MINUS_SRC_COLOR,[To]:n.ONE_MINUS_SRC_ALPHA,[xh]:n.ONE_MINUS_DST_COLOR,[gh]:n.ONE_MINUS_DST_ALPHA,[vh]:n.CONSTANT_COLOR,[bh]:n.ONE_MINUS_CONSTANT_COLOR,[Mh]:n.CONSTANT_ALPHA,[Sh]:n.ONE_MINUS_CONSTANT_ALPHA};function Ye(O,le,Q,fe,xe,re,Te,Me,xt,ct){if(O===On){g===!0&&(be(n.BLEND),g=!1);return}if(g===!1&&(te(n.BLEND),g=!0),O!==oh){if(O!==d||ct!==T){if((M!==ci||R!==ci)&&(n.blendEquation(n.FUNC_ADD),M=ci,R=ci),ct)switch(O){case Ui:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case rc:n.blendFunc(n.ONE,n.ONE);break;case sc:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case oc:n.blendFuncSeparate(n.DST_COLOR,n.ONE_MINUS_SRC_ALPHA,n.ZERO,n.ONE);break;default:Ue("WebGLState: Invalid blending: ",O);break}else switch(O){case Ui:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case rc:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE,n.ONE,n.ONE);break;case sc:Ue("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case oc:Ue("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ue("WebGLState: Invalid blending: ",O);break}w=null,x=null,b=null,C=null,_.set(0,0,0),E=0,d=O,T=ct}return}xe=xe||le,re=re||Q,Te=Te||fe,(le!==M||xe!==R)&&(n.blendEquationSeparate(Ne[le],Ne[xe]),M=le,R=xe),(Q!==w||fe!==x||re!==b||Te!==C)&&(n.blendFuncSeparate(We[Q],We[fe],We[re],We[Te]),w=Q,x=fe,b=re,C=Te),(Me.equals(_)===!1||xt!==E)&&(n.blendColor(Me.r,Me.g,Me.b,xt),_.copy(Me),E=xt),d=O,T=!1}function Ke(O,le){O.side===Et?be(n.CULL_FACE):te(n.CULL_FACE);let Q=O.side===Kt;le&&(Q=!Q),pt(Q),O.blending===Ui&&O.transparent===!1?Ye(On):Ye(O.blending,O.blendEquation,O.blendSrc,O.blendDst,O.blendEquationAlpha,O.blendSrcAlpha,O.blendDstAlpha,O.blendColor,O.blendAlpha,O.premultipliedAlpha),o.setFunc(O.depthFunc),o.setTest(O.depthTest),o.setMask(O.depthWrite),s.setMask(O.colorWrite);let fe=O.stencilWrite;a.setTest(fe),fe&&(a.setMask(O.stencilWriteMask),a.setFunc(O.stencilFunc,O.stencilRef,O.stencilFuncMask),a.setOp(O.stencilFail,O.stencilZFail,O.stencilZPass)),Pt(O.polygonOffset,O.polygonOffsetFactor,O.polygonOffsetUnits),O.alphaToCoverage===!0?te(n.SAMPLE_ALPHA_TO_COVERAGE):be(n.SAMPLE_ALPHA_TO_COVERAGE)}function pt(O){A!==O&&(O?n.frontFace(n.CW):n.frontFace(n.CCW),A=O)}function gt(O){O!==rh?(te(n.CULL_FACE),O!==P&&(O===ic?n.cullFace(n.BACK):O===sh?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):be(n.CULL_FACE),P=O}function Mt(O){O!==D&&(L&&n.lineWidth(O),D=O)}function Pt(O,le,Q){O?(te(n.POLYGON_OFFSET_FILL),(N!==le||F!==Q)&&(N=le,F=Q,o.getReversed()&&(le=-le),n.polygonOffset(le,Q))):be(n.POLYGON_OFFSET_FILL)}function _t(O){O?te(n.SCISSOR_TEST):be(n.SCISSOR_TEST)}function At(O){O===void 0&&(O=n.TEXTURE0+k-1),Z!==O&&(n.activeTexture(O),Z=O)}function z(O,le,Q){Q===void 0&&(Z===null?Q=n.TEXTURE0+k-1:Q=Z);let fe=K[Q];fe===void 0&&(fe={type:void 0,texture:void 0},K[Q]=fe),(fe.type!==O||fe.texture!==le)&&(Z!==Q&&(n.activeTexture(Q),Z=Q),n.bindTexture(O,le||ie[O]),fe.type=O,fe.texture=le)}function jt(){let O=K[Z];O!==void 0&&O.type!==void 0&&(n.bindTexture(O.type,null),O.type=void 0,O.texture=void 0)}function nt(){try{n.compressedTexImage2D(...arguments)}catch(O){Ue("WebGLState:",O)}}function I(){try{n.compressedTexImage3D(...arguments)}catch(O){Ue("WebGLState:",O)}}function y(){try{n.texSubImage2D(...arguments)}catch(O){Ue("WebGLState:",O)}}function H(){try{n.texSubImage3D(...arguments)}catch(O){Ue("WebGLState:",O)}}function q(){try{n.compressedTexSubImage2D(...arguments)}catch(O){Ue("WebGLState:",O)}}function J(){try{n.compressedTexSubImage3D(...arguments)}catch(O){Ue("WebGLState:",O)}}function ae(){try{n.texStorage2D(...arguments)}catch(O){Ue("WebGLState:",O)}}function ue(){try{n.texStorage3D(...arguments)}catch(O){Ue("WebGLState:",O)}}function j(){try{n.texImage2D(...arguments)}catch(O){Ue("WebGLState:",O)}}function ee(){try{n.texImage3D(...arguments)}catch(O){Ue("WebGLState:",O)}}function he(O){return p[O]!==void 0?p[O]:n.getParameter(O)}function Ce(O,le){p[O]!==le&&(n.pixelStorei(O,le),p[O]=le)}function pe(O){Ae.equals(O)===!1&&(n.scissor(O.x,O.y,O.z,O.w),Ae.copy(O))}function de(O){Re.equals(O)===!1&&(n.viewport(O.x,O.y,O.z,O.w),Re.copy(O))}function Le(O,le){let Q=c.get(le);Q===void 0&&(Q=new WeakMap,c.set(le,Q));let fe=Q.get(O);fe===void 0&&(fe=n.getUniformBlockIndex(le,O.name),Q.set(O,fe))}function Fe(O,le){let fe=c.get(le).get(O);l.get(le)!==fe&&(n.uniformBlockBinding(le,fe,O.__bindingPointIndex),l.set(le,fe))}function Ge(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),o.setReversed(!1),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),n.pixelStorei(n.PACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,n.BROWSER_DEFAULT_WEBGL),n.pixelStorei(n.PACK_ROW_LENGTH,0),n.pixelStorei(n.PACK_SKIP_PIXELS,0),n.pixelStorei(n.PACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_ROW_LENGTH,0),n.pixelStorei(n.UNPACK_IMAGE_HEIGHT,0),n.pixelStorei(n.UNPACK_SKIP_PIXELS,0),n.pixelStorei(n.UNPACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_SKIP_IMAGES,0),h={},p={},Z=null,K={},u={},f=new WeakMap,m=[],v=null,g=!1,d=null,M=null,w=null,x=null,R=null,b=null,C=null,_=new ke(0,0,0),E=0,T=!1,A=null,P=null,D=null,N=null,F=null,Ae.set(0,0,n.canvas.width,n.canvas.height),Re.set(0,0,n.canvas.width,n.canvas.height),s.reset(),o.reset(),a.reset()}return{buffers:{color:s,depth:o,stencil:a},enable:te,disable:be,bindFramebuffer:Oe,drawBuffers:Se,useProgram:qe,setBlending:Ye,setMaterial:Ke,setFlipSided:pt,setCullFace:gt,setLineWidth:Mt,setPolygonOffset:Pt,setScissorTest:_t,activeTexture:At,bindTexture:z,unbindTexture:jt,compressedTexImage2D:nt,compressedTexImage3D:I,texImage2D:j,texImage3D:ee,pixelStorei:Ce,getParameter:he,updateUBOMapping:Le,uniformBlockBinding:Fe,texStorage2D:ae,texStorage3D:ue,texSubImage2D:y,texSubImage3D:H,compressedTexSubImage2D:q,compressedTexSubImage3D:J,scissor:pe,viewport:de,reset:Ge}}function Fx(n,e,t,i,r,s,o){let a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Ee,h=new WeakMap,p=new Set,u,f=new WeakMap,m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function v(I,y){return m?new OffscreenCanvas(I,y):ts("canvas")}function g(I,y,H){let q=1,J=nt(I);if((J.width>H||J.height>H)&&(q=H/Math.max(J.width,J.height)),q<1)if(typeof HTMLImageElement<"u"&&I instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&I instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&I instanceof ImageBitmap||typeof VideoFrame<"u"&&I instanceof VideoFrame){let ae=Math.floor(q*J.width),ue=Math.floor(q*J.height);u===void 0&&(u=v(ae,ue));let j=y?v(ae,ue):u;return j.width=ae,j.height=ue,j.getContext("2d").drawImage(I,0,0,ae,ue),De("WebGLRenderer: Texture has been resized from ("+J.width+"x"+J.height+") to ("+ae+"x"+ue+")."),j}else return"data"in I&&De("WebGLRenderer: Image in DataTexture is too big ("+J.width+"x"+J.height+")."),I;return I}function d(I){return I.generateMipmaps}function M(I){n.generateMipmap(I)}function w(I){return I.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:I.isWebGL3DRenderTarget?n.TEXTURE_3D:I.isWebGLArrayRenderTarget||I.isCompressedArrayTexture?n.TEXTURE_2D_ARRAY:n.TEXTURE_2D}function x(I,y,H,q,J,ae=!1){if(I!==null){if(n[I]!==void 0)return n[I];De("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+I+"'")}let ue;q&&(ue=e.get("EXT_texture_norm16"),ue||De("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let j=y;if(y===n.RED&&(H===n.FLOAT&&(j=n.R32F),H===n.HALF_FLOAT&&(j=n.R16F),H===n.UNSIGNED_BYTE&&(j=n.R8),H===n.UNSIGNED_SHORT&&ue&&(j=ue.R16_EXT),H===n.SHORT&&ue&&(j=ue.R16_SNORM_EXT)),y===n.RED_INTEGER&&(H===n.UNSIGNED_BYTE&&(j=n.R8UI),H===n.UNSIGNED_SHORT&&(j=n.R16UI),H===n.UNSIGNED_INT&&(j=n.R32UI),H===n.BYTE&&(j=n.R8I),H===n.SHORT&&(j=n.R16I),H===n.INT&&(j=n.R32I)),y===n.RG&&(H===n.FLOAT&&(j=n.RG32F),H===n.HALF_FLOAT&&(j=n.RG16F),H===n.UNSIGNED_BYTE&&(j=n.RG8),H===n.UNSIGNED_SHORT&&ue&&(j=ue.RG16_EXT),H===n.SHORT&&ue&&(j=ue.RG16_SNORM_EXT)),y===n.RG_INTEGER&&(H===n.UNSIGNED_BYTE&&(j=n.RG8UI),H===n.UNSIGNED_SHORT&&(j=n.RG16UI),H===n.UNSIGNED_INT&&(j=n.RG32UI),H===n.BYTE&&(j=n.RG8I),H===n.SHORT&&(j=n.RG16I),H===n.INT&&(j=n.RG32I)),y===n.RGB_INTEGER&&(H===n.UNSIGNED_BYTE&&(j=n.RGB8UI),H===n.UNSIGNED_SHORT&&(j=n.RGB16UI),H===n.UNSIGNED_INT&&(j=n.RGB32UI),H===n.BYTE&&(j=n.RGB8I),H===n.SHORT&&(j=n.RGB16I),H===n.INT&&(j=n.RGB32I)),y===n.RGBA_INTEGER&&(H===n.UNSIGNED_BYTE&&(j=n.RGBA8UI),H===n.UNSIGNED_SHORT&&(j=n.RGBA16UI),H===n.UNSIGNED_INT&&(j=n.RGBA32UI),H===n.BYTE&&(j=n.RGBA8I),H===n.SHORT&&(j=n.RGBA16I),H===n.INT&&(j=n.RGBA32I)),y===n.RGB&&(H===n.UNSIGNED_SHORT&&ue&&(j=ue.RGB16_EXT),H===n.SHORT&&ue&&(j=ue.RGB16_SNORM_EXT),H===n.UNSIGNED_INT_5_9_9_9_REV&&(j=n.RGB9_E5),H===n.UNSIGNED_INT_10F_11F_11F_REV&&(j=n.R11F_G11F_B10F)),y===n.RGBA){let ee=ae?es:Je.getTransfer(J);H===n.FLOAT&&(j=n.RGBA32F),H===n.HALF_FLOAT&&(j=n.RGBA16F),H===n.UNSIGNED_BYTE&&(j=ee===et?n.SRGB8_ALPHA8:n.RGBA8),H===n.UNSIGNED_SHORT&&ue&&(j=ue.RGBA16_EXT),H===n.SHORT&&ue&&(j=ue.RGBA16_SNORM_EXT),H===n.UNSIGNED_SHORT_4_4_4_4&&(j=n.RGBA4),H===n.UNSIGNED_SHORT_5_5_5_1&&(j=n.RGB5_A1)}return(j===n.R16F||j===n.R32F||j===n.RG16F||j===n.RG32F||j===n.RGBA16F||j===n.RGBA32F)&&e.get("EXT_color_buffer_float"),j}function R(I,y){let H;return I?y===null||y===Tn||y===Ar?H=n.DEPTH24_STENCIL8:y===fn?H=n.DEPTH32F_STENCIL8:y===Er&&(H=n.DEPTH24_STENCIL8,De("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):y===null||y===Tn||y===Ar?H=n.DEPTH_COMPONENT24:y===fn?H=n.DEPTH_COMPONENT32F:y===Er&&(H=n.DEPTH_COMPONENT16),H}function b(I,y){return d(I)===!0||I.isFramebufferTexture&&I.minFilter!==Ot&&I.minFilter!==It?Math.log2(Math.max(y.width,y.height))+1:I.mipmaps!==void 0&&I.mipmaps.length>0?I.mipmaps.length:I.isCompressedTexture&&Array.isArray(I.image)?y.mipmaps.length:1}function C(I){let y=I.target;y.removeEventListener("dispose",C),E(y),y.isVideoTexture&&h.delete(y),y.isHTMLTexture&&p.delete(y)}function _(I){let y=I.target;y.removeEventListener("dispose",_),A(y)}function E(I){let y=i.get(I);if(y.__webglInit===void 0)return;let H=I.source,q=f.get(H);if(q){let J=q[y.__cacheKey];J.usedTimes--,J.usedTimes===0&&T(I),Object.keys(q).length===0&&f.delete(H)}i.remove(I)}function T(I){let y=i.get(I);n.deleteTexture(y.__webglTexture);let H=I.source,q=f.get(H);delete q[y.__cacheKey],o.memory.textures--}function A(I){let y=i.get(I);if(I.depthTexture&&(I.depthTexture.dispose(),i.remove(I.depthTexture)),I.isWebGLCubeRenderTarget)for(let q=0;q<6;q++){if(Array.isArray(y.__webglFramebuffer[q]))for(let J=0;J<y.__webglFramebuffer[q].length;J++)n.deleteFramebuffer(y.__webglFramebuffer[q][J]);else n.deleteFramebuffer(y.__webglFramebuffer[q]);y.__webglDepthbuffer&&n.deleteRenderbuffer(y.__webglDepthbuffer[q])}else{if(Array.isArray(y.__webglFramebuffer))for(let q=0;q<y.__webglFramebuffer.length;q++)n.deleteFramebuffer(y.__webglFramebuffer[q]);else n.deleteFramebuffer(y.__webglFramebuffer);if(y.__webglDepthbuffer&&n.deleteRenderbuffer(y.__webglDepthbuffer),y.__webglMultisampledFramebuffer&&n.deleteFramebuffer(y.__webglMultisampledFramebuffer),y.__webglColorRenderbuffer)for(let q=0;q<y.__webglColorRenderbuffer.length;q++)y.__webglColorRenderbuffer[q]&&n.deleteRenderbuffer(y.__webglColorRenderbuffer[q]);y.__webglDepthRenderbuffer&&n.deleteRenderbuffer(y.__webglDepthRenderbuffer)}let H=I.textures;for(let q=0,J=H.length;q<J;q++){let ae=i.get(H[q]);ae.__webglTexture&&(n.deleteTexture(ae.__webglTexture),o.memory.textures--),i.remove(H[q])}i.remove(I)}let P=0;function D(){P=0}function N(){return P}function F(I){P=I}function k(){let I=P;return I>=r.maxTextures&&De("WebGLTextures: Trying to use "+I+" texture units while this GPU supports only "+r.maxTextures),P+=1,I}function L(I){let y=[];return y.push(I.wrapS),y.push(I.wrapT),y.push(I.wrapR||0),y.push(I.magFilter),y.push(I.minFilter),y.push(I.anisotropy),y.push(I.internalFormat),y.push(I.format),y.push(I.type),y.push(I.generateMipmaps),y.push(I.premultiplyAlpha),y.push(I.flipY),y.push(I.unpackAlignment),y.push(I.colorSpace),y.join()}function U(I,y){let H=i.get(I);if(I.isVideoTexture&&z(I),I.isRenderTargetTexture===!1&&I.isExternalTexture!==!0&&I.version>0&&H.__version!==I.version){let q=I.image;if(q===null)De("WebGLRenderer: Texture marked for update but no image data found.");else if(q.complete===!1)De("WebGLRenderer: Texture marked for update but image is incomplete");else{be(H,I,y);return}}else I.isExternalTexture&&(H.__webglTexture=I.sourceTexture?I.sourceTexture:null);t.bindTexture(n.TEXTURE_2D,H.__webglTexture,n.TEXTURE0+y)}function G(I,y){let H=i.get(I);if(I.isRenderTargetTexture===!1&&I.version>0&&H.__version!==I.version){be(H,I,y);return}else I.isExternalTexture&&(H.__webglTexture=I.sourceTexture?I.sourceTexture:null);t.bindTexture(n.TEXTURE_2D_ARRAY,H.__webglTexture,n.TEXTURE0+y)}function Z(I,y){let H=i.get(I);if(I.isRenderTargetTexture===!1&&I.version>0&&H.__version!==I.version){be(H,I,y);return}t.bindTexture(n.TEXTURE_3D,H.__webglTexture,n.TEXTURE0+y)}function K(I,y){let H=i.get(I);if(I.isCubeDepthTexture!==!0&&I.version>0&&H.__version!==I.version){Oe(H,I,y);return}t.bindTexture(n.TEXTURE_CUBE_MAP,H.__webglTexture,n.TEXTURE0+y)}let ne={[Do]:n.REPEAT,[Dn]:n.CLAMP_TO_EDGE,[No]:n.MIRRORED_REPEAT},ce={[Ot]:n.NEAREST,[Eh]:n.NEAREST_MIPMAP_NEAREST,[Ps]:n.NEAREST_MIPMAP_LINEAR,[It]:n.LINEAR,[oa]:n.LINEAR_MIPMAP_NEAREST,[_i]:n.LINEAR_MIPMAP_LINEAR},Ae={[Ch]:n.NEVER,[Nh]:n.ALWAYS,[Ph]:n.LESS,[Wa]:n.LEQUAL,[Ih]:n.EQUAL,[Xa]:n.GEQUAL,[Lh]:n.GREATER,[Dh]:n.NOTEQUAL};function Re(I,y){if(y.type===fn&&e.has("OES_texture_float_linear")===!1&&(y.magFilter===It||y.magFilter===oa||y.magFilter===Ps||y.magFilter===_i||y.minFilter===It||y.minFilter===oa||y.minFilter===Ps||y.minFilter===_i)&&De("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(I,n.TEXTURE_WRAP_S,ne[y.wrapS]),n.texParameteri(I,n.TEXTURE_WRAP_T,ne[y.wrapT]),(I===n.TEXTURE_3D||I===n.TEXTURE_2D_ARRAY)&&n.texParameteri(I,n.TEXTURE_WRAP_R,ne[y.wrapR]),n.texParameteri(I,n.TEXTURE_MAG_FILTER,ce[y.magFilter]),n.texParameteri(I,n.TEXTURE_MIN_FILTER,ce[y.minFilter]),y.compareFunction&&(n.texParameteri(I,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(I,n.TEXTURE_COMPARE_FUNC,Ae[y.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(y.magFilter===Ot||y.minFilter!==Ps&&y.minFilter!==_i||y.type===fn&&e.has("OES_texture_float_linear")===!1)return;if(y.anisotropy>1||i.get(y).__currentAnisotropy){let H=e.get("EXT_texture_filter_anisotropic");n.texParameterf(I,H.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(y.anisotropy,r.getMaxAnisotropy())),i.get(y).__currentAnisotropy=y.anisotropy}}}function $(I,y){let H=!1;I.__webglInit===void 0&&(I.__webglInit=!0,y.addEventListener("dispose",C));let q=y.source,J=f.get(q);J===void 0&&(J={},f.set(q,J));let ae=L(y);if(ae!==I.__cacheKey){J[ae]===void 0&&(J[ae]={texture:n.createTexture(),usedTimes:0},o.memory.textures++,H=!0),J[ae].usedTimes++;let ue=J[I.__cacheKey];ue!==void 0&&(J[I.__cacheKey].usedTimes--,ue.usedTimes===0&&T(y)),I.__cacheKey=ae,I.__webglTexture=J[ae].texture}return H}function ie(I,y,H){return Math.floor(Math.floor(I/H)/y)}function te(I,y,H,q){let ae=I.updateRanges;if(ae.length===0)t.texSubImage2D(n.TEXTURE_2D,0,0,0,y.width,y.height,H,q,y.data);else{ae.sort((Ce,pe)=>Ce.start-pe.start);let ue=0;for(let Ce=1;Ce<ae.length;Ce++){let pe=ae[ue],de=ae[Ce],Le=pe.start+pe.count,Fe=ie(de.start,y.width,4),Ge=ie(pe.start,y.width,4);de.start<=Le+1&&Fe===Ge&&ie(de.start+de.count-1,y.width,4)===Fe?pe.count=Math.max(pe.count,de.start+de.count-pe.start):(++ue,ae[ue]=de)}ae.length=ue+1;let j=t.getParameter(n.UNPACK_ROW_LENGTH),ee=t.getParameter(n.UNPACK_SKIP_PIXELS),he=t.getParameter(n.UNPACK_SKIP_ROWS);t.pixelStorei(n.UNPACK_ROW_LENGTH,y.width);for(let Ce=0,pe=ae.length;Ce<pe;Ce++){let de=ae[Ce],Le=Math.floor(de.start/4),Fe=Math.ceil(de.count/4),Ge=Le%y.width,O=Math.floor(Le/y.width),le=Fe,Q=1;t.pixelStorei(n.UNPACK_SKIP_PIXELS,Ge),t.pixelStorei(n.UNPACK_SKIP_ROWS,O),t.texSubImage2D(n.TEXTURE_2D,0,Ge,O,le,Q,H,q,y.data)}I.clearUpdateRanges(),t.pixelStorei(n.UNPACK_ROW_LENGTH,j),t.pixelStorei(n.UNPACK_SKIP_PIXELS,ee),t.pixelStorei(n.UNPACK_SKIP_ROWS,he)}}function be(I,y,H){let q=n.TEXTURE_2D;(y.isDataArrayTexture||y.isCompressedArrayTexture)&&(q=n.TEXTURE_2D_ARRAY),y.isData3DTexture&&(q=n.TEXTURE_3D);let J=$(I,y),ae=y.source;t.bindTexture(q,I.__webglTexture,n.TEXTURE0+H);let ue=i.get(ae);if(ae.version!==ue.__version||J===!0){if(t.activeTexture(n.TEXTURE0+H),(typeof ImageBitmap<"u"&&y.image instanceof ImageBitmap)===!1){let Q=Je.getPrimaries(Je.workingColorSpace),fe=y.colorSpace===jn?null:Je.getPrimaries(y.colorSpace),xe=y.colorSpace===jn||Q===fe?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,y.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,y.premultiplyAlpha),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,xe)}t.pixelStorei(n.UNPACK_ALIGNMENT,y.unpackAlignment);let ee=g(y.image,!1,r.maxTextureSize);ee=jt(y,ee);let he=s.convert(y.format,y.colorSpace),Ce=s.convert(y.type),pe=x(y.internalFormat,he,Ce,y.normalized,y.colorSpace,y.isVideoTexture);Re(q,y);let de,Le=y.mipmaps,Fe=y.isVideoTexture!==!0,Ge=ue.__version===void 0||J===!0,O=ae.dataReady,le=b(y,ee);if(y.isDepthTexture)pe=R(y.format===xi,y.type),Ge&&(Fe?t.texStorage2D(n.TEXTURE_2D,1,pe,ee.width,ee.height):t.texImage2D(n.TEXTURE_2D,0,pe,ee.width,ee.height,0,he,Ce,null));else if(y.isDataTexture)if(Le.length>0){Fe&&Ge&&t.texStorage2D(n.TEXTURE_2D,le,pe,Le[0].width,Le[0].height);for(let Q=0,fe=Le.length;Q<fe;Q++)de=Le[Q],Fe?O&&t.texSubImage2D(n.TEXTURE_2D,Q,0,0,de.width,de.height,he,Ce,de.data):t.texImage2D(n.TEXTURE_2D,Q,pe,de.width,de.height,0,he,Ce,de.data);y.generateMipmaps=!1}else Fe?(Ge&&t.texStorage2D(n.TEXTURE_2D,le,pe,ee.width,ee.height),O&&te(y,ee,he,Ce)):t.texImage2D(n.TEXTURE_2D,0,pe,ee.width,ee.height,0,he,Ce,ee.data);else if(y.isCompressedTexture)if(y.isCompressedArrayTexture){Fe&&Ge&&t.texStorage3D(n.TEXTURE_2D_ARRAY,le,pe,Le[0].width,Le[0].height,ee.depth);for(let Q=0,fe=Le.length;Q<fe;Q++)if(de=Le[Q],y.format!==pn)if(he!==null)if(Fe){if(O)if(y.layerUpdates.size>0){let xe=Ac(de.width,de.height,y.format,y.type);for(let re of y.layerUpdates){let Te=de.data.subarray(re*xe/de.data.BYTES_PER_ELEMENT,(re+1)*xe/de.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,Q,0,0,re,de.width,de.height,1,he,Te)}y.clearLayerUpdates()}else t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,Q,0,0,0,de.width,de.height,ee.depth,he,de.data)}else t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,Q,pe,de.width,de.height,ee.depth,0,de.data,0,0);else De("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Fe?O&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,Q,0,0,0,de.width,de.height,ee.depth,he,Ce,de.data):t.texImage3D(n.TEXTURE_2D_ARRAY,Q,pe,de.width,de.height,ee.depth,0,he,Ce,de.data)}else{Fe&&Ge&&t.texStorage2D(n.TEXTURE_2D,le,pe,Le[0].width,Le[0].height);for(let Q=0,fe=Le.length;Q<fe;Q++)de=Le[Q],y.format!==pn?he!==null?Fe?O&&t.compressedTexSubImage2D(n.TEXTURE_2D,Q,0,0,de.width,de.height,he,de.data):t.compressedTexImage2D(n.TEXTURE_2D,Q,pe,de.width,de.height,0,de.data):De("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Fe?O&&t.texSubImage2D(n.TEXTURE_2D,Q,0,0,de.width,de.height,he,Ce,de.data):t.texImage2D(n.TEXTURE_2D,Q,pe,de.width,de.height,0,he,Ce,de.data)}else if(y.isDataArrayTexture)if(Fe){if(Ge&&t.texStorage3D(n.TEXTURE_2D_ARRAY,le,pe,ee.width,ee.height,ee.depth),O)if(y.layerUpdates.size>0){let Q=Ac(ee.width,ee.height,y.format,y.type);for(let fe of y.layerUpdates){let xe=ee.data.subarray(fe*Q/ee.data.BYTES_PER_ELEMENT,(fe+1)*Q/ee.data.BYTES_PER_ELEMENT);t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,fe,ee.width,ee.height,1,he,Ce,xe)}y.clearLayerUpdates()}else t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,ee.width,ee.height,ee.depth,he,Ce,ee.data)}else t.texImage3D(n.TEXTURE_2D_ARRAY,0,pe,ee.width,ee.height,ee.depth,0,he,Ce,ee.data);else if(y.isData3DTexture)Fe?(Ge&&t.texStorage3D(n.TEXTURE_3D,le,pe,ee.width,ee.height,ee.depth),O&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,ee.width,ee.height,ee.depth,he,Ce,ee.data)):t.texImage3D(n.TEXTURE_3D,0,pe,ee.width,ee.height,ee.depth,0,he,Ce,ee.data);else if(y.isFramebufferTexture){if(Ge)if(Fe)t.texStorage2D(n.TEXTURE_2D,le,pe,ee.width,ee.height);else{let Q=ee.width,fe=ee.height;for(let xe=0;xe<le;xe++)t.texImage2D(n.TEXTURE_2D,xe,pe,Q,fe,0,he,Ce,null),Q>>=1,fe>>=1}}else if(y.isHTMLTexture){if("texElementImage2D"in n){let Q=n.canvas;if(Q.hasAttribute("layoutsubtree")||Q.setAttribute("layoutsubtree","true"),ee.parentNode!==Q){Q.appendChild(ee),p.add(y),Q.onpaint=fe=>{let xe=fe.changedElements;for(let re of p)xe.includes(re.image)&&(re.needsUpdate=!0)},Q.requestPaint();return}if(n.texElementImage2D.length===3)n.texElementImage2D(n.TEXTURE_2D,n.RGBA8,ee);else{let xe=n.RGBA,re=n.RGBA,Te=n.UNSIGNED_BYTE;n.texElementImage2D(n.TEXTURE_2D,0,xe,re,Te,ee)}n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE)}}else if(Le.length>0){if(Fe&&Ge){let Q=nt(Le[0]);t.texStorage2D(n.TEXTURE_2D,le,pe,Q.width,Q.height)}for(let Q=0,fe=Le.length;Q<fe;Q++)de=Le[Q],Fe?O&&t.texSubImage2D(n.TEXTURE_2D,Q,0,0,he,Ce,de):t.texImage2D(n.TEXTURE_2D,Q,pe,he,Ce,de);y.generateMipmaps=!1}else if(Fe){if(Ge){let Q=nt(ee);t.texStorage2D(n.TEXTURE_2D,le,pe,Q.width,Q.height)}O&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,he,Ce,ee)}else t.texImage2D(n.TEXTURE_2D,0,pe,he,Ce,ee);d(y)&&M(q),ue.__version=ae.version,y.onUpdate&&y.onUpdate(y)}I.__version=y.version}function Oe(I,y,H){if(y.image.length!==6)return;let q=$(I,y),J=y.source;t.bindTexture(n.TEXTURE_CUBE_MAP,I.__webglTexture,n.TEXTURE0+H);let ae=i.get(J);if(J.version!==ae.__version||q===!0){t.activeTexture(n.TEXTURE0+H);let ue=Je.getPrimaries(Je.workingColorSpace),j=y.colorSpace===jn?null:Je.getPrimaries(y.colorSpace),ee=y.colorSpace===jn||ue===j?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,y.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,y.premultiplyAlpha),t.pixelStorei(n.UNPACK_ALIGNMENT,y.unpackAlignment),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,ee);let he=y.isCompressedTexture||y.image[0].isCompressedTexture,Ce=y.image[0]&&y.image[0].isDataTexture,pe=[];for(let re=0;re<6;re++)!he&&!Ce?pe[re]=g(y.image[re],!0,r.maxCubemapSize):pe[re]=Ce?y.image[re].image:y.image[re],pe[re]=jt(y,pe[re]);let de=pe[0],Le=s.convert(y.format,y.colorSpace),Fe=s.convert(y.type),Ge=x(y.internalFormat,Le,Fe,y.normalized,y.colorSpace),O=y.isVideoTexture!==!0,le=ae.__version===void 0||q===!0,Q=J.dataReady,fe=b(y,de);Re(n.TEXTURE_CUBE_MAP,y);let xe;if(he){O&&le&&t.texStorage2D(n.TEXTURE_CUBE_MAP,fe,Ge,de.width,de.height);for(let re=0;re<6;re++){xe=pe[re].mipmaps;for(let Te=0;Te<xe.length;Te++){let Me=xe[Te];y.format!==pn?Le!==null?O?Q&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,Te,0,0,Me.width,Me.height,Le,Me.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,Te,Ge,Me.width,Me.height,0,Me.data):De("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):O?Q&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,Te,0,0,Me.width,Me.height,Le,Fe,Me.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,Te,Ge,Me.width,Me.height,0,Le,Fe,Me.data)}}}else{if(xe=y.mipmaps,O&&le){xe.length>0&&fe++;let re=nt(pe[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,fe,Ge,re.width,re.height)}for(let re=0;re<6;re++)if(Ce){O?Q&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,0,0,pe[re].width,pe[re].height,Le,Fe,pe[re].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,Ge,pe[re].width,pe[re].height,0,Le,Fe,pe[re].data);for(let Te=0;Te<xe.length;Te++){let xt=xe[Te].image[re].image;O?Q&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,Te+1,0,0,xt.width,xt.height,Le,Fe,xt.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,Te+1,Ge,xt.width,xt.height,0,Le,Fe,xt.data)}}else{O?Q&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,0,0,Le,Fe,pe[re]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,Ge,Le,Fe,pe[re]);for(let Te=0;Te<xe.length;Te++){let Me=xe[Te];O?Q&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,Te+1,0,0,Le,Fe,Me.image[re]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,Te+1,Ge,Le,Fe,Me.image[re])}}}d(y)&&M(n.TEXTURE_CUBE_MAP),ae.__version=J.version,y.onUpdate&&y.onUpdate(y)}I.__version=y.version}function Se(I,y,H,q,J,ae){let ue=s.convert(H.format,H.colorSpace),j=s.convert(H.type),ee=x(H.internalFormat,ue,j,H.normalized,H.colorSpace),he=i.get(y),Ce=i.get(H);if(Ce.__renderTarget=y,!he.__hasExternalTextures){let pe=Math.max(1,y.width>>ae),de=Math.max(1,y.height>>ae);J===n.TEXTURE_3D||J===n.TEXTURE_2D_ARRAY?t.texImage3D(J,ae,ee,pe,de,y.depth,0,ue,j,null):t.texImage2D(J,ae,ee,pe,de,0,ue,j,null)}t.bindFramebuffer(n.FRAMEBUFFER,I),At(y)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,q,J,Ce.__webglTexture,0,_t(y)):(J===n.TEXTURE_2D||J>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&J<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,q,J,Ce.__webglTexture,ae),t.bindFramebuffer(n.FRAMEBUFFER,null)}function qe(I,y,H){if(n.bindRenderbuffer(n.RENDERBUFFER,I),y.depthBuffer){let q=y.depthTexture,J=q&&q.isDepthTexture?q.type:null,ae=R(y.stencilBuffer,J),ue=y.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;At(y)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,_t(y),ae,y.width,y.height):H?n.renderbufferStorageMultisample(n.RENDERBUFFER,_t(y),ae,y.width,y.height):n.renderbufferStorage(n.RENDERBUFFER,ae,y.width,y.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,ue,n.RENDERBUFFER,I)}else{let q=y.textures;for(let J=0;J<q.length;J++){let ae=q[J],ue=s.convert(ae.format,ae.colorSpace),j=s.convert(ae.type),ee=x(ae.internalFormat,ue,j,ae.normalized,ae.colorSpace);At(y)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,_t(y),ee,y.width,y.height):H?n.renderbufferStorageMultisample(n.RENDERBUFFER,_t(y),ee,y.width,y.height):n.renderbufferStorage(n.RENDERBUFFER,ee,y.width,y.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function Ne(I,y,H){let q=y.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(n.FRAMEBUFFER,I),!(y.depthTexture&&y.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let J=i.get(y.depthTexture);if(J.__renderTarget=y,(!J.__webglTexture||y.depthTexture.image.width!==y.width||y.depthTexture.image.height!==y.height)&&(y.depthTexture.image.width=y.width,y.depthTexture.image.height=y.height,y.depthTexture.needsUpdate=!0),q){if(J.__webglInit===void 0&&(J.__webglInit=!0,y.depthTexture.addEventListener("dispose",C)),J.__webglTexture===void 0){J.__webglTexture=n.createTexture(),t.bindTexture(n.TEXTURE_CUBE_MAP,J.__webglTexture),Re(n.TEXTURE_CUBE_MAP,y.depthTexture);let he=s.convert(y.depthTexture.format),Ce=s.convert(y.depthTexture.type),pe;y.depthTexture.format===Nn?pe=n.DEPTH_COMPONENT24:y.depthTexture.format===xi&&(pe=n.DEPTH24_STENCIL8);for(let de=0;de<6;de++)n.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+de,0,pe,y.width,y.height,0,he,Ce,null)}}else U(y.depthTexture,0);let ae=J.__webglTexture,ue=_t(y),j=q?n.TEXTURE_CUBE_MAP_POSITIVE_X+H:n.TEXTURE_2D,ee=y.depthTexture.format===xi?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;if(y.depthTexture.format===Nn)At(y)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,ee,j,ae,0,ue):n.framebufferTexture2D(n.FRAMEBUFFER,ee,j,ae,0);else if(y.depthTexture.format===xi)At(y)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,ee,j,ae,0,ue):n.framebufferTexture2D(n.FRAMEBUFFER,ee,j,ae,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function We(I){let y=i.get(I),H=I.isWebGLCubeRenderTarget===!0;if(y.__boundDepthTexture!==I.depthTexture){let q=I.depthTexture;if(y.__depthDisposeCallback&&y.__depthDisposeCallback(),q){let J=()=>{delete y.__boundDepthTexture,delete y.__depthDisposeCallback,q.removeEventListener("dispose",J)};q.addEventListener("dispose",J),y.__depthDisposeCallback=J}y.__boundDepthTexture=q}if(I.depthTexture&&!y.__autoAllocateDepthBuffer)if(H)for(let q=0;q<6;q++)Ne(y.__webglFramebuffer[q],I,q);else{let q=I.texture.mipmaps;q&&q.length>0?Ne(y.__webglFramebuffer[0],I,0):Ne(y.__webglFramebuffer,I,0)}else if(H){y.__webglDepthbuffer=[];for(let q=0;q<6;q++)if(t.bindFramebuffer(n.FRAMEBUFFER,y.__webglFramebuffer[q]),y.__webglDepthbuffer[q]===void 0)y.__webglDepthbuffer[q]=n.createRenderbuffer(),qe(y.__webglDepthbuffer[q],I,!1);else{let J=I.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ae=y.__webglDepthbuffer[q];n.bindRenderbuffer(n.RENDERBUFFER,ae),n.framebufferRenderbuffer(n.FRAMEBUFFER,J,n.RENDERBUFFER,ae)}}else{let q=I.texture.mipmaps;if(q&&q.length>0?t.bindFramebuffer(n.FRAMEBUFFER,y.__webglFramebuffer[0]):t.bindFramebuffer(n.FRAMEBUFFER,y.__webglFramebuffer),y.__webglDepthbuffer===void 0)y.__webglDepthbuffer=n.createRenderbuffer(),qe(y.__webglDepthbuffer,I,!1);else{let J=I.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ae=y.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,ae),n.framebufferRenderbuffer(n.FRAMEBUFFER,J,n.RENDERBUFFER,ae)}}t.bindFramebuffer(n.FRAMEBUFFER,null)}function Ye(I,y,H){let q=i.get(I);y!==void 0&&Se(q.__webglFramebuffer,I,I.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),H!==void 0&&We(I)}function Ke(I){let y=I.texture,H=i.get(I),q=i.get(y);I.addEventListener("dispose",_);let J=I.textures,ae=I.isWebGLCubeRenderTarget===!0,ue=J.length>1;if(ue||(q.__webglTexture===void 0&&(q.__webglTexture=n.createTexture()),q.__version=y.version,o.memory.textures++),ae){H.__webglFramebuffer=[];for(let j=0;j<6;j++)if(y.mipmaps&&y.mipmaps.length>0){H.__webglFramebuffer[j]=[];for(let ee=0;ee<y.mipmaps.length;ee++)H.__webglFramebuffer[j][ee]=n.createFramebuffer()}else H.__webglFramebuffer[j]=n.createFramebuffer()}else{if(y.mipmaps&&y.mipmaps.length>0){H.__webglFramebuffer=[];for(let j=0;j<y.mipmaps.length;j++)H.__webglFramebuffer[j]=n.createFramebuffer()}else H.__webglFramebuffer=n.createFramebuffer();if(ue)for(let j=0,ee=J.length;j<ee;j++){let he=i.get(J[j]);he.__webglTexture===void 0&&(he.__webglTexture=n.createTexture(),o.memory.textures++)}if(I.samples>0&&At(I)===!1){H.__webglMultisampledFramebuffer=n.createFramebuffer(),H.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,H.__webglMultisampledFramebuffer);for(let j=0;j<J.length;j++){let ee=J[j];H.__webglColorRenderbuffer[j]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,H.__webglColorRenderbuffer[j]);let he=s.convert(ee.format,ee.colorSpace),Ce=s.convert(ee.type),pe=x(ee.internalFormat,he,Ce,ee.normalized,ee.colorSpace,I.isXRRenderTarget===!0),de=_t(I);n.renderbufferStorageMultisample(n.RENDERBUFFER,de,pe,I.width,I.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+j,n.RENDERBUFFER,H.__webglColorRenderbuffer[j])}n.bindRenderbuffer(n.RENDERBUFFER,null),I.depthBuffer&&(H.__webglDepthRenderbuffer=n.createRenderbuffer(),qe(H.__webglDepthRenderbuffer,I,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(ae){t.bindTexture(n.TEXTURE_CUBE_MAP,q.__webglTexture),Re(n.TEXTURE_CUBE_MAP,y);for(let j=0;j<6;j++)if(y.mipmaps&&y.mipmaps.length>0)for(let ee=0;ee<y.mipmaps.length;ee++)Se(H.__webglFramebuffer[j][ee],I,y,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ee);else Se(H.__webglFramebuffer[j],I,y,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+j,0);d(y)&&M(n.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(ue){for(let j=0,ee=J.length;j<ee;j++){let he=J[j],Ce=i.get(he),pe=n.TEXTURE_2D;(I.isWebGL3DRenderTarget||I.isWebGLArrayRenderTarget)&&(pe=I.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(pe,Ce.__webglTexture),Re(pe,he),Se(H.__webglFramebuffer,I,he,n.COLOR_ATTACHMENT0+j,pe,0),d(he)&&M(pe)}t.unbindTexture()}else{let j=n.TEXTURE_2D;if((I.isWebGL3DRenderTarget||I.isWebGLArrayRenderTarget)&&(j=I.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(j,q.__webglTexture),Re(j,y),y.mipmaps&&y.mipmaps.length>0)for(let ee=0;ee<y.mipmaps.length;ee++)Se(H.__webglFramebuffer[ee],I,y,n.COLOR_ATTACHMENT0,j,ee);else Se(H.__webglFramebuffer,I,y,n.COLOR_ATTACHMENT0,j,0);d(y)&&M(j),t.unbindTexture()}I.depthBuffer&&We(I)}function pt(I){let y=I.textures;for(let H=0,q=y.length;H<q;H++){let J=y[H];if(d(J)){let ae=w(I),ue=i.get(J).__webglTexture;t.bindTexture(ae,ue),M(ae),t.unbindTexture()}}}let gt=[],Mt=[];function Pt(I){if(I.samples>0){if(At(I)===!1){let y=I.textures,H=I.width,q=I.height,J=n.COLOR_BUFFER_BIT,ae=I.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ue=i.get(I),j=y.length>1;if(j)for(let he=0;he<y.length;he++)t.bindFramebuffer(n.FRAMEBUFFER,ue.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+he,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,ue.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+he,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,ue.__webglMultisampledFramebuffer);let ee=I.texture.mipmaps;ee&&ee.length>0?t.bindFramebuffer(n.DRAW_FRAMEBUFFER,ue.__webglFramebuffer[0]):t.bindFramebuffer(n.DRAW_FRAMEBUFFER,ue.__webglFramebuffer);for(let he=0;he<y.length;he++){if(I.resolveDepthBuffer&&(I.depthBuffer&&(J|=n.DEPTH_BUFFER_BIT),I.stencilBuffer&&I.resolveStencilBuffer&&(J|=n.STENCIL_BUFFER_BIT)),j){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,ue.__webglColorRenderbuffer[he]);let Ce=i.get(y[he]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,Ce,0)}n.blitFramebuffer(0,0,H,q,0,0,H,q,J,n.NEAREST),l===!0&&(gt.length=0,Mt.length=0,gt.push(n.COLOR_ATTACHMENT0+he),I.depthBuffer&&I.resolveDepthBuffer===!1&&(gt.push(ae),Mt.push(ae),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,Mt)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,gt))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),j)for(let he=0;he<y.length;he++){t.bindFramebuffer(n.FRAMEBUFFER,ue.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+he,n.RENDERBUFFER,ue.__webglColorRenderbuffer[he]);let Ce=i.get(y[he]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,ue.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+he,n.TEXTURE_2D,Ce,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,ue.__webglMultisampledFramebuffer)}else if(I.depthBuffer&&I.resolveDepthBuffer===!1&&l){let y=I.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[y])}}}function _t(I){return Math.min(r.maxSamples,I.samples)}function At(I){let y=i.get(I);return I.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&y.__useRenderToTexture!==!1}function z(I){let y=o.render.frame;h.get(I)!==y&&(h.set(I,y),I.update())}function jt(I,y){let H=I.colorSpace,q=I.format,J=I.type;return I.isCompressedTexture===!0||I.isVideoTexture===!0||H!==Qr&&H!==jn&&(Je.getTransfer(H)===et?(q!==pn||J!==Qt)&&De("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ue("WebGLTextures: Unsupported texture color space:",H)),y}function nt(I){return typeof HTMLImageElement<"u"&&I instanceof HTMLImageElement?(c.width=I.naturalWidth||I.width,c.height=I.naturalHeight||I.height):typeof VideoFrame<"u"&&I instanceof VideoFrame?(c.width=I.displayWidth,c.height=I.displayHeight):(c.width=I.width,c.height=I.height),c}this.allocateTextureUnit=k,this.resetTextureUnits=D,this.getTextureUnits=N,this.setTextureUnits=F,this.setTexture2D=U,this.setTexture2DArray=G,this.setTexture3D=Z,this.setTextureCube=K,this.rebindTextures=Ye,this.setupRenderTarget=Ke,this.updateRenderTargetMipmap=pt,this.updateMultisampleRenderTarget=Pt,this.setupDepthRenderbuffer=We,this.setupFrameBufferTexture=Se,this.useMultisampledRTT=At,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function Ux(n,e){function t(i,r=jn){let s,o=Je.getTransfer(r);if(i===Qt)return n.UNSIGNED_BYTE;if(i===la)return n.UNSIGNED_SHORT_4_4_4_4;if(i===ca)return n.UNSIGNED_SHORT_5_5_5_1;if(i===gc)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===_c)return n.UNSIGNED_INT_10F_11F_11F_REV;if(i===pc)return n.BYTE;if(i===mc)return n.SHORT;if(i===Er)return n.UNSIGNED_SHORT;if(i===aa)return n.INT;if(i===Tn)return n.UNSIGNED_INT;if(i===fn)return n.FLOAT;if(i===Bn)return n.HALF_FLOAT;if(i===xc)return n.ALPHA;if(i===yc)return n.RGB;if(i===pn)return n.RGBA;if(i===Nn)return n.DEPTH_COMPONENT;if(i===xi)return n.DEPTH_STENCIL;if(i===ua)return n.RED;if(i===ha)return n.RED_INTEGER;if(i===yi)return n.RG;if(i===da)return n.RG_INTEGER;if(i===fa)return n.RGBA_INTEGER;if(i===Is||i===Ls||i===Ds||i===Ns)if(o===et)if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(i===Is)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===Ls)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===Ds)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===Ns)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=e.get("WEBGL_compressed_texture_s3tc"),s!==null){if(i===Is)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===Ls)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===Ds)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===Ns)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===pa||i===ma||i===ga||i===_a)if(s=e.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(i===pa)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===ma)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===ga)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===_a)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===xa||i===ya||i===va||i===ba||i===Ma||i===Fs||i===Sa)if(s=e.get("WEBGL_compressed_texture_etc"),s!==null){if(i===xa||i===ya)return o===et?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(i===va)return o===et?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC;if(i===ba)return s.COMPRESSED_R11_EAC;if(i===Ma)return s.COMPRESSED_SIGNED_R11_EAC;if(i===Fs)return s.COMPRESSED_RG11_EAC;if(i===Sa)return s.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===wa||i===Ta||i===Ea||i===Aa||i===Ra||i===Ca||i===Pa||i===Ia||i===La||i===Da||i===Na||i===Fa||i===Ua||i===Oa)if(s=e.get("WEBGL_compressed_texture_astc"),s!==null){if(i===wa)return o===et?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Ta)return o===et?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===Ea)return o===et?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Aa)return o===et?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Ra)return o===et?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Ca)return o===et?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Pa)return o===et?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Ia)return o===et?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===La)return o===et?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Da)return o===et?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Na)return o===et?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===Fa)return o===et?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Ua)return o===et?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Oa)return o===et?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===Ba||i===ka||i===za)if(s=e.get("EXT_texture_compression_bptc"),s!==null){if(i===Ba)return o===et?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===ka)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===za)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===Va||i===Ga||i===Us||i===Ha)if(s=e.get("EXT_texture_compression_rgtc"),s!==null){if(i===Va)return s.COMPRESSED_RED_RGTC1_EXT;if(i===Ga)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===Us)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===Ha)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Ar?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:t}}var Ox=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Bx=`
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

}`,Vc=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let i=new ds(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=i}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,i=new cn({vertexShader:Ox,fragmentShader:Bx,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new ft(new Vi(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Gc=class extends Mn{constructor(e,t){super();let i=this,r=null,s=1,o=null,a="local-floor",l=1,c=null,h=null,p=null,u=null,f=null,m=null,v=typeof XRWebGLBinding<"u",g=new Vc,d={},M=t.getContextAttributes(),w=null,x=null,R=[],b=[],C=new Ee,_=null,E=new Ht;E.viewport=new dt;let T=new Ht;T.viewport=new dt;let A=[E,T],P=new ta,D=null,N=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function($){let ie=R[$];return ie===void 0&&(ie=new xr,R[$]=ie),ie.getTargetRaySpace()},this.getControllerGrip=function($){let ie=R[$];return ie===void 0&&(ie=new xr,R[$]=ie),ie.getGripSpace()},this.getHand=function($){let ie=R[$];return ie===void 0&&(ie=new xr,R[$]=ie),ie.getHandSpace()};function F($){let ie=b.indexOf($.inputSource);if(ie===-1)return;let te=R[ie];te!==void 0&&(te.update($.inputSource,$.frame,c||o),te.dispatchEvent({type:$.type,data:$.inputSource}))}function k(){r.removeEventListener("select",F),r.removeEventListener("selectstart",F),r.removeEventListener("selectend",F),r.removeEventListener("squeeze",F),r.removeEventListener("squeezestart",F),r.removeEventListener("squeezeend",F),r.removeEventListener("end",k),r.removeEventListener("inputsourceschange",L);for(let $=0;$<R.length;$++){let ie=b[$];ie!==null&&(b[$]=null,R[$].disconnect(ie))}D=null,N=null,g.reset();for(let $ in d)delete d[$];e.setRenderTarget(w),f=null,u=null,p=null,r=null,x=null,Re.stop(),i.isPresenting=!1,e.setPixelRatio(_),e.setSize(C.width,C.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function($){s=$,i.isPresenting===!0&&De("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function($){a=$,i.isPresenting===!0&&De("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function($){c=$},this.getBaseLayer=function(){return u!==null?u:f},this.getBinding=function(){return p===null&&v&&(p=new XRWebGLBinding(r,t)),p},this.getFrame=function(){return m},this.getSession=function(){return r},this.setSession=async function($){if(r=$,r!==null){if(w=e.getRenderTarget(),r.addEventListener("select",F),r.addEventListener("selectstart",F),r.addEventListener("selectend",F),r.addEventListener("squeeze",F),r.addEventListener("squeezestart",F),r.addEventListener("squeezeend",F),r.addEventListener("end",k),r.addEventListener("inputsourceschange",L),M.xrCompatible!==!0&&await t.makeXRCompatible(),_=e.getPixelRatio(),e.getSize(C),v&&"createProjectionLayer"in XRWebGLBinding.prototype){let te=null,be=null,Oe=null;M.depth&&(Oe=M.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,te=M.stencil?xi:Nn,be=M.stencil?Ar:Tn);let Se={colorFormat:t.RGBA8,depthFormat:Oe,scaleFactor:s};p=this.getBinding(),u=p.createProjectionLayer(Se),r.updateRenderState({layers:[u]}),e.setPixelRatio(1),e.setSize(u.textureWidth,u.textureHeight,!1),x=new ln(u.textureWidth,u.textureHeight,{format:pn,type:Qt,depthTexture:new Jn(u.textureWidth,u.textureHeight,be,void 0,void 0,void 0,void 0,void 0,void 0,te),stencilBuffer:M.stencil,colorSpace:e.outputColorSpace,samples:M.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1})}else{let te={antialias:M.antialias,alpha:!0,depth:M.depth,stencil:M.stencil,framebufferScaleFactor:s};f=new XRWebGLLayer(r,t,te),r.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),x=new ln(f.framebufferWidth,f.framebufferHeight,{format:pn,type:Qt,colorSpace:e.outputColorSpace,stencilBuffer:M.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}x.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await r.requestReferenceSpace(a),Re.setContext(r),Re.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return g.getDepthTexture()};function L($){for(let ie=0;ie<$.removed.length;ie++){let te=$.removed[ie],be=b.indexOf(te);be>=0&&(b[be]=null,R[be].disconnect(te))}for(let ie=0;ie<$.added.length;ie++){let te=$.added[ie],be=b.indexOf(te);if(be===-1){for(let Se=0;Se<R.length;Se++)if(Se>=b.length){b.push(te),be=Se;break}else if(b[Se]===null){b[Se]=te,be=Se;break}if(be===-1)break}let Oe=R[be];Oe&&Oe.connect(te)}}let U=new B,G=new B;function Z($,ie,te){U.setFromMatrixPosition(ie.matrixWorld),G.setFromMatrixPosition(te.matrixWorld);let be=U.distanceTo(G),Oe=ie.projectionMatrix.elements,Se=te.projectionMatrix.elements,qe=Oe[14]/(Oe[10]-1),Ne=Oe[14]/(Oe[10]+1),We=(Oe[9]+1)/Oe[5],Ye=(Oe[9]-1)/Oe[5],Ke=(Oe[8]-1)/Oe[0],pt=(Se[8]+1)/Se[0],gt=qe*Ke,Mt=qe*pt,Pt=be/(-Ke+pt),_t=Pt*-Ke;if(ie.matrixWorld.decompose($.position,$.quaternion,$.scale),$.translateX(_t),$.translateZ(Pt),$.matrixWorld.compose($.position,$.quaternion,$.scale),$.matrixWorldInverse.copy($.matrixWorld).invert(),Oe[10]===-1)$.projectionMatrix.copy(ie.projectionMatrix),$.projectionMatrixInverse.copy(ie.projectionMatrixInverse);else{let At=qe+Pt,z=Ne+Pt,jt=gt-_t,nt=Mt+(be-_t),I=We*Ne/z*At,y=Ye*Ne/z*At;$.projectionMatrix.makePerspective(jt,nt,I,y,At,z),$.projectionMatrixInverse.copy($.projectionMatrix).invert()}}function K($,ie){ie===null?$.matrixWorld.copy($.matrix):$.matrixWorld.multiplyMatrices(ie.matrixWorld,$.matrix),$.matrixWorldInverse.copy($.matrixWorld).invert()}this.updateCamera=function($){if(r===null)return;let ie=$.near,te=$.far;g.texture!==null&&(g.depthNear>0&&(ie=g.depthNear),g.depthFar>0&&(te=g.depthFar)),P.near=T.near=E.near=ie,P.far=T.far=E.far=te,(D!==P.near||N!==P.far)&&(r.updateRenderState({depthNear:P.near,depthFar:P.far}),D=P.near,N=P.far),P.layers.mask=$.layers.mask|6,E.layers.mask=P.layers.mask&-5,T.layers.mask=P.layers.mask&-3;let be=$.parent,Oe=P.cameras;K(P,be);for(let Se=0;Se<Oe.length;Se++)K(Oe[Se],be);Oe.length===2?Z(P,E,T):P.projectionMatrix.copy(E.projectionMatrix),ne($,P,be)};function ne($,ie,te){te===null?$.matrix.copy(ie.matrixWorld):($.matrix.copy(te.matrixWorld),$.matrix.invert(),$.matrix.multiply(ie.matrixWorld)),$.matrix.decompose($.position,$.quaternion,$.scale),$.updateMatrixWorld(!0),$.projectionMatrix.copy(ie.projectionMatrix),$.projectionMatrixInverse.copy(ie.projectionMatrixInverse),$.isPerspectiveCamera&&($.fov=mr*2*Math.atan(1/$.projectionMatrix.elements[5]),$.zoom=1)}this.getCamera=function(){return P},this.getFoveation=function(){if(!(u===null&&f===null))return l},this.setFoveation=function($){l=$,u!==null&&(u.fixedFoveation=$),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=$)},this.hasDepthSensing=function(){return g.texture!==null},this.getDepthSensingMesh=function(){return g.getMesh(P)},this.getCameraTexture=function($){return d[$]};let ce=null;function Ae($,ie){if(h=ie.getViewerPose(c||o),m=ie,h!==null){let te=h.views;f!==null&&(e.setRenderTargetFramebuffer(x,f.framebuffer),e.setRenderTarget(x));let be=!1;te.length!==P.cameras.length&&(P.cameras.length=0,be=!0);for(let Ne=0;Ne<te.length;Ne++){let We=te[Ne],Ye=null;if(f!==null)Ye=f.getViewport(We);else{let pt=p.getViewSubImage(u,We);Ye=pt.viewport,Ne===0&&(e.setRenderTargetTextures(x,pt.colorTexture,pt.depthStencilTexture),e.setRenderTarget(x))}let Ke=A[Ne];Ke===void 0&&(Ke=new Ht,Ke.layers.enable(Ne),Ke.viewport=new dt,A[Ne]=Ke),Ke.matrix.fromArray(We.transform.matrix),Ke.matrix.decompose(Ke.position,Ke.quaternion,Ke.scale),Ke.projectionMatrix.fromArray(We.projectionMatrix),Ke.projectionMatrixInverse.copy(Ke.projectionMatrix).invert(),Ke.viewport.set(Ye.x,Ye.y,Ye.width,Ye.height),Ne===0&&(P.matrix.copy(Ke.matrix),P.matrix.decompose(P.position,P.quaternion,P.scale)),be===!0&&P.cameras.push(Ke)}let Oe=r.enabledFeatures;if(Oe&&Oe.includes("depth-sensing")&&r.depthUsage=="gpu-optimized"&&v){p=i.getBinding();let Ne=p.getDepthInformation(te[0]);Ne&&Ne.isValid&&Ne.texture&&g.init(Ne,r.renderState)}if(Oe&&Oe.includes("camera-access")&&v){e.state.unbindTexture(),p=i.getBinding();for(let Ne=0;Ne<te.length;Ne++){let We=te[Ne].camera;if(We){let Ye=d[We];Ye||(Ye=new ds,d[We]=Ye);let Ke=p.getCameraImage(We);Ye.sourceTexture=Ke}}}}for(let te=0;te<R.length;te++){let be=b[te],Oe=R[te];be!==null&&Oe!==void 0&&Oe.update(be,ie,c||o)}ce&&ce($,ie),ie.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:ie}),m=null}let Re=new pd;Re.setAnimationLoop(Ae),this.setAnimationLoop=function($){ce=$},this.dispose=function(){}}},kx=new lt,vd=new ze;vd.set(-1,0,0,0,1,0,0,0,1);function zx(n,e){function t(g,d){g.matrixAutoUpdate===!0&&g.updateMatrix(),d.value.copy(g.matrix)}function i(g,d){d.color.getRGB(g.fogColor.value,wc(n)),d.isFog?(g.fogNear.value=d.near,g.fogFar.value=d.far):d.isFogExp2&&(g.fogDensity.value=d.density)}function r(g,d,M,w,x){d.isNodeMaterial?d.uniformsNeedUpdate=!1:d.isMeshBasicMaterial?s(g,d):d.isMeshLambertMaterial?(s(g,d),d.envMap&&(g.envMapIntensity.value=d.envMapIntensity)):d.isMeshToonMaterial?(s(g,d),p(g,d)):d.isMeshPhongMaterial?(s(g,d),h(g,d),d.envMap&&(g.envMapIntensity.value=d.envMapIntensity)):d.isMeshStandardMaterial?(s(g,d),u(g,d),d.isMeshPhysicalMaterial&&f(g,d,x)):d.isMeshMatcapMaterial?(s(g,d),m(g,d)):d.isMeshDepthMaterial?s(g,d):d.isMeshDistanceMaterial?(s(g,d),v(g,d)):d.isMeshNormalMaterial?s(g,d):d.isLineBasicMaterial?(o(g,d),d.isLineDashedMaterial&&a(g,d)):d.isPointsMaterial?l(g,d,M,w):d.isSpriteMaterial?c(g,d):d.isShadowMaterial?(g.color.value.copy(d.color),g.opacity.value=d.opacity):d.isShaderMaterial&&(d.uniformsNeedUpdate=!1)}function s(g,d){g.opacity.value=d.opacity,d.color&&g.diffuse.value.copy(d.color),d.emissive&&g.emissive.value.copy(d.emissive).multiplyScalar(d.emissiveIntensity),d.map&&(g.map.value=d.map,t(d.map,g.mapTransform)),d.alphaMap&&(g.alphaMap.value=d.alphaMap,t(d.alphaMap,g.alphaMapTransform)),d.bumpMap&&(g.bumpMap.value=d.bumpMap,t(d.bumpMap,g.bumpMapTransform),g.bumpScale.value=d.bumpScale,d.side===Kt&&(g.bumpScale.value*=-1)),d.normalMap&&(g.normalMap.value=d.normalMap,t(d.normalMap,g.normalMapTransform),g.normalScale.value.copy(d.normalScale),d.side===Kt&&g.normalScale.value.negate()),d.displacementMap&&(g.displacementMap.value=d.displacementMap,t(d.displacementMap,g.displacementMapTransform),g.displacementScale.value=d.displacementScale,g.displacementBias.value=d.displacementBias),d.emissiveMap&&(g.emissiveMap.value=d.emissiveMap,t(d.emissiveMap,g.emissiveMapTransform)),d.specularMap&&(g.specularMap.value=d.specularMap,t(d.specularMap,g.specularMapTransform)),d.alphaTest>0&&(g.alphaTest.value=d.alphaTest);let M=e.get(d),w=M.envMap,x=M.envMapRotation;w&&(g.envMap.value=w,g.envMapRotation.value.setFromMatrix4(kx.makeRotationFromEuler(x)).transpose(),w.isCubeTexture&&w.isRenderTargetTexture===!1&&g.envMapRotation.value.premultiply(vd),g.reflectivity.value=d.reflectivity,g.ior.value=d.ior,g.refractionRatio.value=d.refractionRatio),d.lightMap&&(g.lightMap.value=d.lightMap,g.lightMapIntensity.value=d.lightMapIntensity,t(d.lightMap,g.lightMapTransform)),d.aoMap&&(g.aoMap.value=d.aoMap,g.aoMapIntensity.value=d.aoMapIntensity,t(d.aoMap,g.aoMapTransform))}function o(g,d){g.diffuse.value.copy(d.color),g.opacity.value=d.opacity,d.map&&(g.map.value=d.map,t(d.map,g.mapTransform))}function a(g,d){g.dashSize.value=d.dashSize,g.totalSize.value=d.dashSize+d.gapSize,g.scale.value=d.scale}function l(g,d,M,w){g.diffuse.value.copy(d.color),g.opacity.value=d.opacity,g.size.value=d.size*M,g.scale.value=w*.5,d.map&&(g.map.value=d.map,t(d.map,g.uvTransform)),d.alphaMap&&(g.alphaMap.value=d.alphaMap,t(d.alphaMap,g.alphaMapTransform)),d.alphaTest>0&&(g.alphaTest.value=d.alphaTest)}function c(g,d){g.diffuse.value.copy(d.color),g.opacity.value=d.opacity,g.rotation.value=d.rotation,d.map&&(g.map.value=d.map,t(d.map,g.mapTransform)),d.alphaMap&&(g.alphaMap.value=d.alphaMap,t(d.alphaMap,g.alphaMapTransform)),d.alphaTest>0&&(g.alphaTest.value=d.alphaTest)}function h(g,d){g.specular.value.copy(d.specular),g.shininess.value=Math.max(d.shininess,1e-4)}function p(g,d){d.gradientMap&&(g.gradientMap.value=d.gradientMap)}function u(g,d){g.metalness.value=d.metalness,d.metalnessMap&&(g.metalnessMap.value=d.metalnessMap,t(d.metalnessMap,g.metalnessMapTransform)),g.roughness.value=d.roughness,d.roughnessMap&&(g.roughnessMap.value=d.roughnessMap,t(d.roughnessMap,g.roughnessMapTransform)),d.envMap&&(g.envMapIntensity.value=d.envMapIntensity)}function f(g,d,M){g.ior.value=d.ior,d.sheen>0&&(g.sheenColor.value.copy(d.sheenColor).multiplyScalar(d.sheen),g.sheenRoughness.value=d.sheenRoughness,d.sheenColorMap&&(g.sheenColorMap.value=d.sheenColorMap,t(d.sheenColorMap,g.sheenColorMapTransform)),d.sheenRoughnessMap&&(g.sheenRoughnessMap.value=d.sheenRoughnessMap,t(d.sheenRoughnessMap,g.sheenRoughnessMapTransform))),d.clearcoat>0&&(g.clearcoat.value=d.clearcoat,g.clearcoatRoughness.value=d.clearcoatRoughness,d.clearcoatMap&&(g.clearcoatMap.value=d.clearcoatMap,t(d.clearcoatMap,g.clearcoatMapTransform)),d.clearcoatRoughnessMap&&(g.clearcoatRoughnessMap.value=d.clearcoatRoughnessMap,t(d.clearcoatRoughnessMap,g.clearcoatRoughnessMapTransform)),d.clearcoatNormalMap&&(g.clearcoatNormalMap.value=d.clearcoatNormalMap,t(d.clearcoatNormalMap,g.clearcoatNormalMapTransform),g.clearcoatNormalScale.value.copy(d.clearcoatNormalScale),d.side===Kt&&g.clearcoatNormalScale.value.negate())),d.dispersion>0&&(g.dispersion.value=d.dispersion),d.iridescence>0&&(g.iridescence.value=d.iridescence,g.iridescenceIOR.value=d.iridescenceIOR,g.iridescenceThicknessMinimum.value=d.iridescenceThicknessRange[0],g.iridescenceThicknessMaximum.value=d.iridescenceThicknessRange[1],d.iridescenceMap&&(g.iridescenceMap.value=d.iridescenceMap,t(d.iridescenceMap,g.iridescenceMapTransform)),d.iridescenceThicknessMap&&(g.iridescenceThicknessMap.value=d.iridescenceThicknessMap,t(d.iridescenceThicknessMap,g.iridescenceThicknessMapTransform))),d.transmission>0&&(g.transmission.value=d.transmission,g.transmissionSamplerMap.value=M.texture,g.transmissionSamplerSize.value.set(M.width,M.height),d.transmissionMap&&(g.transmissionMap.value=d.transmissionMap,t(d.transmissionMap,g.transmissionMapTransform)),g.thickness.value=d.thickness,d.thicknessMap&&(g.thicknessMap.value=d.thicknessMap,t(d.thicknessMap,g.thicknessMapTransform)),g.attenuationDistance.value=d.attenuationDistance,g.attenuationColor.value.copy(d.attenuationColor)),d.anisotropy>0&&(g.anisotropyVector.value.set(d.anisotropy*Math.cos(d.anisotropyRotation),d.anisotropy*Math.sin(d.anisotropyRotation)),d.anisotropyMap&&(g.anisotropyMap.value=d.anisotropyMap,t(d.anisotropyMap,g.anisotropyMapTransform))),g.specularIntensity.value=d.specularIntensity,g.specularColor.value.copy(d.specularColor),d.specularColorMap&&(g.specularColorMap.value=d.specularColorMap,t(d.specularColorMap,g.specularColorMapTransform)),d.specularIntensityMap&&(g.specularIntensityMap.value=d.specularIntensityMap,t(d.specularIntensityMap,g.specularIntensityMapTransform))}function m(g,d){d.matcap&&(g.matcap.value=d.matcap)}function v(g,d){let M=e.get(d).light;g.referencePosition.value.setFromMatrixPosition(M.matrixWorld),g.nearDistance.value=M.shadow.camera.near,g.farDistance.value=M.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function Vx(n,e,t,i){let r={},s={},o=[],a=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function l(x,R){let b=R.program;i.uniformBlockBinding(x,b)}function c(x,R){let b=r[x.id];b===void 0&&(g(x),b=h(x),r[x.id]=b,x.addEventListener("dispose",M));let C=R.program;i.updateUBOMapping(x,C);let _=e.render.frame;s[x.id]!==_&&(u(x),s[x.id]=_)}function h(x){let R=p();x.__bindingPointIndex=R;let b=n.createBuffer(),C=x.__size,_=x.usage;return n.bindBuffer(n.UNIFORM_BUFFER,b),n.bufferData(n.UNIFORM_BUFFER,C,_),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,R,b),b}function p(){for(let x=0;x<a;x++)if(o.indexOf(x)===-1)return o.push(x),x;return Ue("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(x){let R=r[x.id],b=x.uniforms,C=x.__cache;n.bindBuffer(n.UNIFORM_BUFFER,R);for(let _=0,E=b.length;_<E;_++){let T=b[_];if(Array.isArray(T))for(let A=0,P=T.length;A<P;A++)f(T[A],_,A,C);else f(T,_,0,C)}n.bindBuffer(n.UNIFORM_BUFFER,null)}function f(x,R,b,C){if(v(x,R,b,C)===!0){let _=x.__offset,E=x.value;if(Array.isArray(E)){let T=0;for(let A=0;A<E.length;A++){let P=E[A],D=d(P);m(P,x.__data,T),typeof P!="number"&&typeof P!="boolean"&&!P.isMatrix3&&!ArrayBuffer.isView(P)&&(T+=D.storage/Float32Array.BYTES_PER_ELEMENT)}}else m(E,x.__data,0);n.bufferSubData(n.UNIFORM_BUFFER,_,x.__data)}}function m(x,R,b){typeof x=="number"||typeof x=="boolean"?R[0]=x:x.isMatrix3?(R[0]=x.elements[0],R[1]=x.elements[1],R[2]=x.elements[2],R[3]=0,R[4]=x.elements[3],R[5]=x.elements[4],R[6]=x.elements[5],R[7]=0,R[8]=x.elements[6],R[9]=x.elements[7],R[10]=x.elements[8],R[11]=0):ArrayBuffer.isView(x)?R.set(new x.constructor(x.buffer,x.byteOffset,R.length)):x.toArray(R,b)}function v(x,R,b,C){let _=x.value,E=R+"_"+b;if(C[E]===void 0)return typeof _=="number"||typeof _=="boolean"?C[E]=_:ArrayBuffer.isView(_)?C[E]=_.slice():C[E]=_.clone(),!0;{let T=C[E];if(typeof _=="number"||typeof _=="boolean"){if(T!==_)return C[E]=_,!0}else{if(ArrayBuffer.isView(_))return!0;if(T.equals(_)===!1)return T.copy(_),!0}}return!1}function g(x){let R=x.uniforms,b=0,C=16;for(let E=0,T=R.length;E<T;E++){let A=Array.isArray(R[E])?R[E]:[R[E]];for(let P=0,D=A.length;P<D;P++){let N=A[P],F=Array.isArray(N.value)?N.value:[N.value];for(let k=0,L=F.length;k<L;k++){let U=F[k],G=d(U),Z=b%C,K=Z%G.boundary,ne=Z+K;b+=K,ne!==0&&C-ne<G.storage&&(b+=C-ne),N.__data=new Float32Array(G.storage/Float32Array.BYTES_PER_ELEMENT),N.__offset=b,b+=G.storage}}}let _=b%C;return _>0&&(b+=C-_),x.__size=b,x.__cache={},this}function d(x){let R={boundary:0,storage:0};return typeof x=="number"||typeof x=="boolean"?(R.boundary=4,R.storage=4):x.isVector2?(R.boundary=8,R.storage=8):x.isVector3||x.isColor?(R.boundary=16,R.storage=12):x.isVector4?(R.boundary=16,R.storage=16):x.isMatrix3?(R.boundary=48,R.storage=48):x.isMatrix4?(R.boundary=64,R.storage=64):x.isTexture?De("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(x)?(R.boundary=16,R.storage=x.byteLength):De("WebGLRenderer: Unsupported uniform value type.",x),R}function M(x){let R=x.target;R.removeEventListener("dispose",M);let b=o.indexOf(R.__bindingPointIndex);o.splice(b,1),n.deleteBuffer(r[R.id]),delete r[R.id],delete s[R.id]}function w(){for(let x in r)n.deleteBuffer(r[x]);o=[],r={},s={}}return{bind:l,update:c,dispose:w}}var Gx=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),kn=null;function Hx(){return kn===null&&(kn=new ls(Gx,16,16,yi,Bn),kn.name="DFG_LUT",kn.minFilter=It,kn.magFilter=It,kn.wrapS=Dn,kn.wrapT=Dn,kn.generateMipmaps=!1,kn.needsUpdate=!0),kn}var Ka=class{constructor(e={}){let{canvas:t=Fh(),context:i=null,depth:r=!0,stencil:s=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:p=!1,reversedDepthBuffer:u=!1,outputBufferType:f=Qt}=e;this.isWebGLRenderer=!0;let m;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");m=i.getContextAttributes().alpha}else m=o;let v=f,g=new Set([fa,da,ha]),d=new Set([Qt,Tn,Er,Ar,la,ca]),M=new Uint32Array(4),w=new Int32Array(4),x=new B,R=null,b=null,C=[],_=[],E=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=wn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let T=this,A=!1,P=null,D=null,N=null,F=null;this._outputColorSpace=Ut;let k=0,L=0,U=null,G=-1,Z=null,K=new dt,ne=new dt,ce=null,Ae=new ke(0),Re=0,$=t.width,ie=t.height,te=1,be=null,Oe=null,Se=new dt(0,0,$,ie),qe=new dt(0,0,$,ie),Ne=!1,We=new yr,Ye=!1,Ke=!1,pt=new lt,gt=new B,Mt=new dt,Pt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},_t=!1;function At(){return U===null?te:1}let z=i;function jt(S,V){return t.getContext(S,V)}try{let S={alpha:!0,depth:r,stencil:s,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:p};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"185"}`),t.addEventListener("webglcontextlost",xt,!1),t.addEventListener("webglcontextrestored",ct,!1),t.addEventListener("webglcontextcreationerror",Cn,!1),z===null){let V="webgl2";if(z=jt(V,S),z===null)throw jt(V)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(S){throw Ue("WebGLRenderer: "+S.message),S}let nt,I,y,H,q,J,ae,ue,j,ee,he,Ce,pe,de,Le,Fe,Ge,O,le,Q,fe,xe,re;function Te(){nt=new K0(z),nt.init(),fe=new Ux(z,nt),I=new G0(z,nt,e,fe),y=new Nx(z,nt),I.reversedDepthBuffer&&u&&y.buffers.depth.setReversed(!0),D=z.createFramebuffer(),N=z.createFramebuffer(),F=z.createFramebuffer(),H=new Q0(z),q=new vx,J=new Fx(z,nt,y,q,I,fe,H),ae=new Z0(T),ue=new im(z),xe=new z0(z,ue),j=new J0(z,ue,H,xe),ee=new t_(z,j,ue,xe,H),O=new e_(z,I,J),Le=new H0(q),he=new yx(T,ae,nt,I,xe,Le),Ce=new zx(T,q),pe=new Mx,de=new Rx(nt),Ge=new k0(T,ae,y,ee,m,l),Fe=new Dx(T,ee,I),re=new Vx(z,H,I,y),le=new V0(z,nt,H),Q=new j0(z,nt,H),H.programs=he.programs,T.capabilities=I,T.extensions=nt,T.properties=q,T.renderLists=pe,T.shadowMap=Fe,T.state=y,T.info=H}Te(),v!==Qt&&(E=new i_(v,t.width,t.height,a,r,s));let Me=new Gc(T,z);this.xr=Me,this.getContext=function(){return z},this.getContextAttributes=function(){return z.getContextAttributes()},this.forceContextLoss=function(){let S=nt.get("WEBGL_lose_context");S&&S.loseContext()},this.forceContextRestore=function(){let S=nt.get("WEBGL_lose_context");S&&S.restoreContext()},this.getPixelRatio=function(){return te},this.setPixelRatio=function(S){S!==void 0&&(te=S,this.setSize($,ie,!1))},this.getSize=function(S){return S.set($,ie)},this.setSize=function(S,V,Y=!0){if(Me.isPresenting){De("WebGLRenderer: Can't change size while VR device is presenting.");return}$=S,ie=V,t.width=Math.floor(S*te),t.height=Math.floor(V*te),Y===!0&&(t.style.width=S+"px",t.style.height=V+"px"),E!==null&&E.setSize(t.width,t.height),this.setViewport(0,0,S,V)},this.getDrawingBufferSize=function(S){return S.set($*te,ie*te).floor()},this.setDrawingBufferSize=function(S,V,Y){$=S,ie=V,te=Y,t.width=Math.floor(S*Y),t.height=Math.floor(V*Y),this.setViewport(0,0,S,V)},this.setEffects=function(S){if(v===Qt){Ue("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(S){for(let V=0;V<S.length;V++)if(S[V].isOutputPass===!0){De("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}E.setEffects(S||[])},this.getCurrentViewport=function(S){return S.copy(K)},this.getViewport=function(S){return S.copy(Se)},this.setViewport=function(S,V,Y,W){S.isVector4?Se.set(S.x,S.y,S.z,S.w):Se.set(S,V,Y,W),y.viewport(K.copy(Se).multiplyScalar(te).round())},this.getScissor=function(S){return S.copy(qe)},this.setScissor=function(S,V,Y,W){S.isVector4?qe.set(S.x,S.y,S.z,S.w):qe.set(S,V,Y,W),y.scissor(ne.copy(qe).multiplyScalar(te).round())},this.getScissorTest=function(){return Ne},this.setScissorTest=function(S){y.setScissorTest(Ne=S)},this.setOpaqueSort=function(S){be=S},this.setTransparentSort=function(S){Oe=S},this.getClearColor=function(S){return S.copy(Ge.getClearColor())},this.setClearColor=function(){Ge.setClearColor(...arguments)},this.getClearAlpha=function(){return Ge.getClearAlpha()},this.setClearAlpha=function(){Ge.setClearAlpha(...arguments)},this.clear=function(S=!0,V=!0,Y=!0){let W=0;if(S){let X=!1;if(U!==null){let _e=U.texture.format;X=g.has(_e)}if(X){let _e=U.texture.type,ve=d.has(_e),ge=Ge.getClearColor(),we=Ge.getClearAlpha(),Pe=ge.r,He=ge.g,$e=ge.b;ve?(M[0]=Pe,M[1]=He,M[2]=$e,M[3]=we,z.clearBufferuiv(z.COLOR,0,M)):(w[0]=Pe,w[1]=He,w[2]=$e,w[3]=we,z.clearBufferiv(z.COLOR,0,w))}else W|=z.COLOR_BUFFER_BIT}V&&(W|=z.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),Y&&(W|=z.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),W!==0&&z.clear(W)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(S){S.setRenderer(this),P=S},this.dispose=function(){t.removeEventListener("webglcontextlost",xt,!1),t.removeEventListener("webglcontextrestored",ct,!1),t.removeEventListener("webglcontextcreationerror",Cn,!1),Ge.dispose(),pe.dispose(),de.dispose(),q.dispose(),ae.dispose(),ee.dispose(),xe.dispose(),re.dispose(),he.dispose(),Me.dispose(),Me.removeEventListener("sessionstart",Mu),Me.removeEventListener("sessionend",Su),Ci.stop()};function xt(S){S.preventDefault(),bc("WebGLRenderer: Context Lost."),A=!0}function ct(){bc("WebGLRenderer: Context Restored."),A=!1;let S=H.autoReset,V=Fe.enabled,Y=Fe.autoUpdate,W=Fe.needsUpdate,X=Fe.type;Te(),H.autoReset=S,Fe.enabled=V,Fe.autoUpdate=Y,Fe.needsUpdate=W,Fe.type=X}function Cn(S){Ue("WebGLRenderer: A WebGL context could not be created. Reason: ",S.statusMessage)}function Pn(S){let V=S.target;V.removeEventListener("dispose",Pn),Of(V)}function Of(S){Bf(S),q.remove(S)}function Bf(S){let V=q.get(S).programs;V!==void 0&&(V.forEach(function(Y){he.releaseProgram(Y)}),S.isShaderMaterial&&he.releaseShaderCache(S))}this.renderBufferDirect=function(S,V,Y,W,X,_e){V===null&&(V=Pt);let ve=X.isMesh&&X.matrixWorld.determinantAffine()<0,ge=Vf(S,V,Y,W,X);y.setMaterial(W,ve);let we=Y.index,Pe=1;if(W.wireframe===!0){if(we=j.getWireframeAttribute(Y),we===void 0)return;Pe=2}let He=Y.drawRange,$e=Y.attributes.position,Ie=He.start*Pe,rt=(He.start+He.count)*Pe;_e!==null&&(Ie=Math.max(Ie,_e.start*Pe),rt=Math.min(rt,(_e.start+_e.count)*Pe)),we!==null?(Ie=Math.max(Ie,0),rt=Math.min(rt,we.count)):$e!=null&&(Ie=Math.max(Ie,0),rt=Math.min(rt,$e.count));let St=rt-Ie;if(St<0||St===1/0)return;xe.setup(X,W,ge,Y,we);let yt,ot=le;if(we!==null&&(yt=ue.get(we),ot=Q,ot.setIndex(yt)),X.isMesh)W.wireframe===!0?(y.setLineWidth(W.wireframeLinewidth*At()),ot.setMode(z.LINES)):ot.setMode(z.TRIANGLES);else if(X.isLine){let zt=W.linewidth;zt===void 0&&(zt=1),y.setLineWidth(zt*At()),X.isLineSegments?ot.setMode(z.LINES):X.isLineLoop?ot.setMode(z.LINE_LOOP):ot.setMode(z.LINE_STRIP)}else X.isPoints?ot.setMode(z.POINTS):X.isSprite&&ot.setMode(z.TRIANGLES);if(X.isBatchedMesh)if(nt.get("WEBGL_multi_draw"))ot.renderMultiDraw(X._multiDrawStarts,X._multiDrawCounts,X._multiDrawCount);else{let zt=X._multiDrawStarts,ye=X._multiDrawCounts,rn=X._multiDrawCount,je=we?ue.get(we).bytesPerElement:1,hn=q.get(W).currentProgram.getUniforms();for(let In=0;In<rn;In++)hn.setValue(z,"_gl_DrawID",In),ot.render(zt[In]/je,ye[In])}else if(X.isInstancedMesh)ot.renderInstances(Ie,St,X.count);else if(Y.isInstancedBufferGeometry){let zt=Y._maxInstanceCount!==void 0?Y._maxInstanceCount:1/0,ye=Math.min(Y.instanceCount,zt);ot.renderInstances(Ie,St,ye)}else ot.render(Ie,St)};function bu(S,V,Y){S.transparent===!0&&S.side===Et&&S.forceSinglePass===!1?(S.side=Kt,S.needsUpdate=!0,js(S,V,Y),S.side=bn,S.needsUpdate=!0,js(S,V,Y),S.side=Et):js(S,V,Y)}this.compile=function(S,V,Y=null){Y===null&&(Y=S),b=de.get(Y),b.init(V),_.push(b),Y.traverseVisible(function(X){X.isLight&&X.layers.test(V.layers)&&(b.pushLight(X),X.castShadow&&b.pushShadow(X))}),S!==Y&&S.traverseVisible(function(X){X.isLight&&X.layers.test(V.layers)&&(b.pushLight(X),X.castShadow&&b.pushShadow(X))}),b.setupLights();let W=new Set;return S.traverse(function(X){if(!(X.isMesh||X.isPoints||X.isLine||X.isSprite))return;let _e=X.material;if(_e)if(Array.isArray(_e))for(let ve=0;ve<_e.length;ve++){let ge=_e[ve];bu(ge,Y,X),W.add(ge)}else bu(_e,Y,X),W.add(_e)}),b=_.pop(),W},this.compileAsync=function(S,V,Y=null){let W=this.compile(S,V,Y);return new Promise(X=>{function _e(){if(W.forEach(function(ve){q.get(ve).currentProgram.isReady()&&W.delete(ve)}),W.size===0){X(S);return}setTimeout(_e,10)}nt.get("KHR_parallel_shader_compile")!==null?_e():setTimeout(_e,10)})};let yl=null;function kf(S){yl&&yl(S)}function Mu(){Ci.stop()}function Su(){Ci.start()}let Ci=new pd;Ci.setAnimationLoop(kf),typeof self<"u"&&Ci.setContext(self),this.setAnimationLoop=function(S){yl=S,Me.setAnimationLoop(S),S===null?Ci.stop():Ci.start()},Me.addEventListener("sessionstart",Mu),Me.addEventListener("sessionend",Su),this.render=function(S,V){if(V!==void 0&&V.isCamera!==!0){Ue("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(A===!0)return;P!==null&&P.renderStart(S,V);let Y=Me.enabled===!0&&Me.isPresenting===!0,W=E!==null&&(U===null||Y)&&E.begin(T,U);if(S.matrixWorldAutoUpdate===!0&&S.updateMatrixWorld(),V.parent===null&&V.matrixWorldAutoUpdate===!0&&V.updateMatrixWorld(),Me.enabled===!0&&Me.isPresenting===!0&&(E===null||E.isCompositing()===!1)&&(Me.cameraAutoUpdate===!0&&Me.updateCamera(V),V=Me.getCamera()),S.isScene===!0&&S.onBeforeRender(T,S,V,U),b=de.get(S,_.length),b.init(V),b.state.textureUnits=J.getTextureUnits(),_.push(b),pt.multiplyMatrices(V.projectionMatrix,V.matrixWorldInverse),We.setFromProjectionMatrix(pt,vn,V.reversedDepth),Ke=this.localClippingEnabled,Ye=Le.init(this.clippingPlanes,Ke),R=pe.get(S,C.length),R.init(),C.push(R),Me.enabled===!0&&Me.isPresenting===!0){let ve=T.xr.getDepthSensingMesh();ve!==null&&vl(ve,V,-1/0,T.sortObjects)}vl(S,V,0,T.sortObjects),R.finish(),T.sortObjects===!0&&R.sort(be,Oe,V.reversedDepth),_t=Me.enabled===!1||Me.isPresenting===!1||Me.hasDepthSensing()===!1,_t&&Ge.addToRenderList(R,S),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),Ye===!0&&Le.beginShadows();let X=b.state.shadowsArray;if(Fe.render(X,S,V),Ye===!0&&Le.endShadows(),(W&&E.hasRenderPass())===!1){let ve=R.opaque,ge=R.transmissive;if(b.setupLights(),V.isArrayCamera){let we=V.cameras;if(ge.length>0)for(let Pe=0,He=we.length;Pe<He;Pe++){let $e=we[Pe];Tu(ve,ge,S,$e)}_t&&Ge.render(S);for(let Pe=0,He=we.length;Pe<He;Pe++){let $e=we[Pe];wu(R,S,$e,$e.viewport)}}else ge.length>0&&Tu(ve,ge,S,V),_t&&Ge.render(S),wu(R,S,V)}U!==null&&L===0&&(J.updateMultisampleRenderTarget(U),J.updateRenderTargetMipmap(U)),W&&E.end(T),S.isScene===!0&&S.onAfterRender(T,S,V),xe.resetDefaultState(),G=-1,Z=null,_.pop(),_.length>0?(b=_[_.length-1],J.setTextureUnits(b.state.textureUnits),Ye===!0&&Le.setGlobalState(T.clippingPlanes,b.state.camera)):b=null,C.pop(),C.length>0?R=C[C.length-1]:R=null,P!==null&&P.renderEnd()};function vl(S,V,Y,W){if(S.visible===!1)return;if(S.layers.test(V.layers)){if(S.isGroup)Y=S.renderOrder;else if(S.isLOD)S.autoUpdate===!0&&S.update(V);else if(S.isLightProbeGrid)b.pushLightProbeGrid(S);else if(S.isLight)b.pushLight(S),S.castShadow&&b.pushShadow(S);else if(S.isSprite){if(!S.frustumCulled||We.intersectsSprite(S)){W&&Mt.setFromMatrixPosition(S.matrixWorld).applyMatrix4(pt);let ve=ee.update(S),ge=S.material;ge.visible&&R.push(S,ve,ge,Y,Mt.z,null)}}else if((S.isMesh||S.isLine||S.isPoints)&&(!S.frustumCulled||We.intersectsObject(S))){let ve=ee.update(S),ge=S.material;if(W&&(S.boundingSphere!==void 0?(S.boundingSphere===null&&S.computeBoundingSphere(),Mt.copy(S.boundingSphere.center)):(ve.boundingSphere===null&&ve.computeBoundingSphere(),Mt.copy(ve.boundingSphere.center)),Mt.applyMatrix4(S.matrixWorld).applyMatrix4(pt)),Array.isArray(ge)){let we=ve.groups;for(let Pe=0,He=we.length;Pe<He;Pe++){let $e=we[Pe],Ie=ge[$e.materialIndex];Ie&&Ie.visible&&R.push(S,ve,Ie,Y,Mt.z,$e)}}else ge.visible&&R.push(S,ve,ge,Y,Mt.z,null)}}let _e=S.children;for(let ve=0,ge=_e.length;ve<ge;ve++)vl(_e[ve],V,Y,W)}function wu(S,V,Y,W){let{opaque:X,transmissive:_e,transparent:ve}=S;b.setupLightsView(Y),Ye===!0&&Le.setGlobalState(T.clippingPlanes,Y),W&&y.viewport(K.copy(W)),X.length>0&&Js(X,V,Y),_e.length>0&&Js(_e,V,Y),ve.length>0&&Js(ve,V,Y),y.buffers.depth.setTest(!0),y.buffers.depth.setMask(!0),y.buffers.color.setMask(!0),y.setPolygonOffset(!1)}function Tu(S,V,Y,W){if((Y.isScene===!0?Y.overrideMaterial:null)!==null)return;if(b.state.transmissionRenderTarget[W.id]===void 0){let Ie=nt.has("EXT_color_buffer_half_float")||nt.has("EXT_color_buffer_float");b.state.transmissionRenderTarget[W.id]=new ln(1,1,{generateMipmaps:!0,type:Ie?Bn:Qt,minFilter:_i,samples:Math.max(4,I.samples),stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Je.workingColorSpace})}let _e=b.state.transmissionRenderTarget[W.id],ve=W.viewport||K;_e.setSize(ve.z*T.transmissionResolutionScale,ve.w*T.transmissionResolutionScale);let ge=T.getRenderTarget(),we=T.getActiveCubeFace(),Pe=T.getActiveMipmapLevel();T.setRenderTarget(_e),T.getClearColor(Ae),Re=T.getClearAlpha(),Re<1&&T.setClearColor(16777215,.5),T.clear(),_t&&Ge.render(Y);let He=T.toneMapping;T.toneMapping=wn;let $e=W.viewport;if(W.viewport!==void 0&&(W.viewport=void 0),b.setupLightsView(W),Ye===!0&&Le.setGlobalState(T.clippingPlanes,W),Js(S,Y,W),J.updateMultisampleRenderTarget(_e),J.updateRenderTargetMipmap(_e),nt.has("WEBGL_multisampled_render_to_texture")===!1){let Ie=!1;for(let rt=0,St=V.length;rt<St;rt++){let yt=V[rt],{object:ot,geometry:zt,material:ye,group:rn}=yt;if(ye.side===Et&&ot.layers.test(W.layers)){let je=ye.side;ye.side=Kt,ye.needsUpdate=!0,Eu(ot,Y,W,zt,ye,rn),ye.side=je,ye.needsUpdate=!0,Ie=!0}}Ie===!0&&(J.updateMultisampleRenderTarget(_e),J.updateRenderTargetMipmap(_e))}T.setRenderTarget(ge,we,Pe),T.setClearColor(Ae,Re),$e!==void 0&&(W.viewport=$e),T.toneMapping=He}function Js(S,V,Y){let W=V.isScene===!0?V.overrideMaterial:null;for(let X=0,_e=S.length;X<_e;X++){let ve=S[X],{object:ge,geometry:we,group:Pe}=ve,He=ve.material;He.allowOverride===!0&&W!==null&&(He=W),ge.layers.test(Y.layers)&&Eu(ge,V,Y,we,He,Pe)}}function Eu(S,V,Y,W,X,_e){S.onBeforeRender(T,V,Y,W,X,_e),S.modelViewMatrix.multiplyMatrices(Y.matrixWorldInverse,S.matrixWorld),S.normalMatrix.getNormalMatrix(S.modelViewMatrix),X.onBeforeRender(T,V,Y,W,S,_e),X.transparent===!0&&X.side===Et&&X.forceSinglePass===!1?(X.side=Kt,X.needsUpdate=!0,T.renderBufferDirect(Y,V,W,X,S,_e),X.side=bn,X.needsUpdate=!0,T.renderBufferDirect(Y,V,W,X,S,_e),X.side=Et):T.renderBufferDirect(Y,V,W,X,S,_e),S.onAfterRender(T,V,Y,W,X,_e)}function js(S,V,Y){V.isScene!==!0&&(V=Pt);let W=q.get(S),X=b.state.lights,_e=b.state.shadowsArray,ve=X.state.version,ge=he.getParameters(S,X.state,_e,V,Y,b.state.lightProbeGridArray),we=he.getProgramCacheKey(ge),Pe=W.programs;W.environment=S.isMeshStandardMaterial||S.isMeshLambertMaterial||S.isMeshPhongMaterial?V.environment:null,W.fog=V.fog;let He=S.isMeshStandardMaterial||S.isMeshLambertMaterial&&!S.envMap||S.isMeshPhongMaterial&&!S.envMap;W.envMap=ae.get(S.envMap||W.environment,He),W.envMapRotation=W.environment!==null&&S.envMap===null?V.environmentRotation:S.envMapRotation,Pe===void 0&&(S.addEventListener("dispose",Pn),Pe=new Map,W.programs=Pe);let $e=Pe.get(we);if($e!==void 0){if(W.currentProgram===$e&&W.lightsStateVersion===ve)return Ru(S,ge),$e}else ge.uniforms=he.getUniforms(S),P!==null&&S.isNodeMaterial&&P.build(S,Y,ge),S.onBeforeCompile(ge,T),$e=he.acquireProgram(ge,we),Pe.set(we,$e),W.uniforms=ge.uniforms;let Ie=W.uniforms;return(!S.isShaderMaterial&&!S.isRawShaderMaterial||S.clipping===!0)&&(Ie.clippingPlanes=Le.uniform),Ru(S,ge),W.needsLights=Hf(S),W.lightsStateVersion=ve,W.needsLights&&(Ie.ambientLightColor.value=X.state.ambient,Ie.lightProbe.value=X.state.probe,Ie.directionalLights.value=X.state.directional,Ie.directionalLightShadows.value=X.state.directionalShadow,Ie.spotLights.value=X.state.spot,Ie.spotLightShadows.value=X.state.spotShadow,Ie.rectAreaLights.value=X.state.rectArea,Ie.ltc_1.value=X.state.rectAreaLTC1,Ie.ltc_2.value=X.state.rectAreaLTC2,Ie.pointLights.value=X.state.point,Ie.pointLightShadows.value=X.state.pointShadow,Ie.hemisphereLights.value=X.state.hemi,Ie.directionalShadowMatrix.value=X.state.directionalShadowMatrix,Ie.spotLightMatrix.value=X.state.spotLightMatrix,Ie.spotLightMap.value=X.state.spotLightMap,Ie.pointShadowMatrix.value=X.state.pointShadowMatrix),W.lightProbeGrid=b.state.lightProbeGridArray.length>0,W.currentProgram=$e,W.uniformsList=null,$e}function Au(S){if(S.uniformsList===null){let V=S.currentProgram.getUniforms();S.uniformsList=Pr.seqWithValue(V.seq,S.uniforms)}return S.uniformsList}function Ru(S,V){let Y=q.get(S);Y.outputColorSpace=V.outputColorSpace,Y.batching=V.batching,Y.batchingColor=V.batchingColor,Y.instancing=V.instancing,Y.instancingColor=V.instancingColor,Y.instancingMorph=V.instancingMorph,Y.skinning=V.skinning,Y.morphTargets=V.morphTargets,Y.morphNormals=V.morphNormals,Y.morphColors=V.morphColors,Y.morphTargetsCount=V.morphTargetsCount,Y.numClippingPlanes=V.numClippingPlanes,Y.numIntersection=V.numClipIntersection,Y.vertexAlphas=V.vertexAlphas,Y.vertexTangents=V.vertexTangents,Y.toneMapping=V.toneMapping}function zf(S,V){if(S.length===0)return null;if(S.length===1)return S[0].texture!==null?S[0]:null;x.setFromMatrixPosition(V.matrixWorld);for(let Y=0,W=S.length;Y<W;Y++){let X=S[Y];if(X.texture!==null&&X.boundingBox.containsPoint(x))return X}return null}function Vf(S,V,Y,W,X){V.isScene!==!0&&(V=Pt),J.resetTextureUnits();let _e=V.fog,ve=W.isMeshStandardMaterial||W.isMeshLambertMaterial||W.isMeshPhongMaterial?V.environment:null,ge=U===null?T.outputColorSpace:U.isXRRenderTarget===!0?U.texture.colorSpace:Je.workingColorSpace,we=W.isMeshStandardMaterial||W.isMeshLambertMaterial&&!W.envMap||W.isMeshPhongMaterial&&!W.envMap,Pe=ae.get(W.envMap||ve,we),He=W.vertexColors===!0&&!!Y.attributes.color&&Y.attributes.color.itemSize===4,$e=!!Y.attributes.tangent&&(!!W.normalMap||W.anisotropy>0),Ie=!!Y.morphAttributes.position,rt=!!Y.morphAttributes.normal,St=!!Y.morphAttributes.color,yt=wn;W.toneMapped&&(U===null||U.isXRRenderTarget===!0)&&(yt=T.toneMapping);let ot=Y.morphAttributes.position||Y.morphAttributes.normal||Y.morphAttributes.color,zt=ot!==void 0?ot.length:0,ye=q.get(W),rn=b.state.lights;if(Ye===!0&&(Ke===!0||S!==Z)){let ut=S===Z&&W.id===G;Le.setState(W,S,ut)}let je=!1;W.version===ye.__version?(ye.needsLights&&ye.lightsStateVersion!==rn.state.version||ye.outputColorSpace!==ge||X.isBatchedMesh&&ye.batching===!1||!X.isBatchedMesh&&ye.batching===!0||X.isBatchedMesh&&ye.batchingColor===!0&&X.colorTexture===null||X.isBatchedMesh&&ye.batchingColor===!1&&X.colorTexture!==null||X.isInstancedMesh&&ye.instancing===!1||!X.isInstancedMesh&&ye.instancing===!0||X.isSkinnedMesh&&ye.skinning===!1||!X.isSkinnedMesh&&ye.skinning===!0||X.isInstancedMesh&&ye.instancingColor===!0&&X.instanceColor===null||X.isInstancedMesh&&ye.instancingColor===!1&&X.instanceColor!==null||X.isInstancedMesh&&ye.instancingMorph===!0&&X.morphTexture===null||X.isInstancedMesh&&ye.instancingMorph===!1&&X.morphTexture!==null||ye.envMap!==Pe||W.fog===!0&&ye.fog!==_e||ye.numClippingPlanes!==void 0&&(ye.numClippingPlanes!==Le.numPlanes||ye.numIntersection!==Le.numIntersection)||ye.vertexAlphas!==He||ye.vertexTangents!==$e||ye.morphTargets!==Ie||ye.morphNormals!==rt||ye.morphColors!==St||ye.toneMapping!==yt||ye.morphTargetsCount!==zt||!!ye.lightProbeGrid!=b.state.lightProbeGridArray.length>0)&&(je=!0):(je=!0,ye.__version=W.version);let hn=ye.currentProgram;je===!0&&(hn=js(W,V,X),P&&W.isNodeMaterial&&P.onUpdateProgram(W,hn,ye));let In=!1,Qn=!1,Ki=!1,at=hn.getUniforms(),wt=ye.uniforms;if(y.useProgram(hn.program)&&(In=!0,Qn=!0,Ki=!0),W.id!==G&&(G=W.id,Qn=!0),ye.needsLights){let ut=zf(b.state.lightProbeGridArray,X);ye.lightProbeGrid!==ut&&(ye.lightProbeGrid=ut,Qn=!0)}if(In||Z!==S){y.buffers.depth.getReversed()&&S.reversedDepth!==!0&&(S._reversedDepth=!0,S.updateProjectionMatrix()),at.setValue(z,"projectionMatrix",S.projectionMatrix),at.setValue(z,"viewMatrix",S.matrixWorldInverse);let ti=at.map.cameraPosition;ti!==void 0&&ti.setValue(z,gt.setFromMatrixPosition(S.matrixWorld)),I.logarithmicDepthBuffer&&at.setValue(z,"logDepthBufFC",2/(Math.log(S.far+1)/Math.LN2)),(W.isMeshPhongMaterial||W.isMeshToonMaterial||W.isMeshLambertMaterial||W.isMeshBasicMaterial||W.isMeshStandardMaterial||W.isShaderMaterial)&&at.setValue(z,"isOrthographic",S.isOrthographicCamera===!0),Z!==S&&(Z=S,Qn=!0,Ki=!0)}if(ye.needsLights&&(rn.state.directionalShadowMap.length>0&&at.setValue(z,"directionalShadowMap",rn.state.directionalShadowMap,J),rn.state.spotShadowMap.length>0&&at.setValue(z,"spotShadowMap",rn.state.spotShadowMap,J),rn.state.pointShadowMap.length>0&&at.setValue(z,"pointShadowMap",rn.state.pointShadowMap,J)),X.isSkinnedMesh){at.setOptional(z,X,"bindMatrix"),at.setOptional(z,X,"bindMatrixInverse");let ut=X.skeleton;ut&&(ut.boneTexture===null&&ut.computeBoneTexture(),at.setValue(z,"boneTexture",ut.boneTexture,J))}X.isBatchedMesh&&(at.setOptional(z,X,"batchingTexture"),at.setValue(z,"batchingTexture",X._matricesTexture,J),at.setOptional(z,X,"batchingIdTexture"),at.setValue(z,"batchingIdTexture",X._indirectTexture,J),at.setOptional(z,X,"batchingColorTexture"),X._colorsTexture!==null&&at.setValue(z,"batchingColorTexture",X._colorsTexture,J));let ei=Y.morphAttributes;if((ei.position!==void 0||ei.normal!==void 0||ei.color!==void 0)&&O.update(X,Y,hn),(Qn||ye.receiveShadow!==X.receiveShadow)&&(ye.receiveShadow=X.receiveShadow,at.setValue(z,"receiveShadow",X.receiveShadow)),(W.isMeshStandardMaterial||W.isMeshLambertMaterial||W.isMeshPhongMaterial)&&W.envMap===null&&V.environment!==null&&(wt.envMapIntensity.value=V.environmentIntensity),wt.dfgLUT!==void 0&&(wt.dfgLUT.value=Hx()),Qn){if(at.setValue(z,"toneMappingExposure",T.toneMappingExposure),ye.needsLights&&Gf(wt,Ki),_e&&W.fog===!0&&Ce.refreshFogUniforms(wt,_e),Ce.refreshMaterialUniforms(wt,W,te,ie,b.state.transmissionRenderTarget[S.id]),ye.needsLights&&ye.lightProbeGrid){let ut=ye.lightProbeGrid;wt.probesSH.value=ut.texture,wt.probesMin.value.copy(ut.boundingBox.min),wt.probesMax.value.copy(ut.boundingBox.max),wt.probesResolution.value.copy(ut.resolution)}Pr.upload(z,Au(ye),wt,J)}if(W.isShaderMaterial&&W.uniformsNeedUpdate===!0&&(Pr.upload(z,Au(ye),wt,J),W.uniformsNeedUpdate=!1),W.isSpriteMaterial&&at.setValue(z,"center",X.center),at.setValue(z,"modelViewMatrix",X.modelViewMatrix),at.setValue(z,"normalMatrix",X.normalMatrix),at.setValue(z,"modelMatrix",X.matrixWorld),W.uniformsGroups!==void 0){let ut=W.uniformsGroups;for(let ti=0,Ji=ut.length;ti<Ji;ti++){let Cu=ut[ti];re.update(Cu,hn),re.bind(Cu,hn)}}return hn}function Gf(S,V){S.ambientLightColor.needsUpdate=V,S.lightProbe.needsUpdate=V,S.directionalLights.needsUpdate=V,S.directionalLightShadows.needsUpdate=V,S.pointLights.needsUpdate=V,S.pointLightShadows.needsUpdate=V,S.spotLights.needsUpdate=V,S.spotLightShadows.needsUpdate=V,S.rectAreaLights.needsUpdate=V,S.hemisphereLights.needsUpdate=V}function Hf(S){return S.isMeshLambertMaterial||S.isMeshToonMaterial||S.isMeshPhongMaterial||S.isMeshStandardMaterial||S.isShadowMaterial||S.isShaderMaterial&&S.lights===!0}this.getActiveCubeFace=function(){return k},this.getActiveMipmapLevel=function(){return L},this.getRenderTarget=function(){return U},this.setRenderTargetTextures=function(S,V,Y){let W=q.get(S);W.__autoAllocateDepthBuffer=S.resolveDepthBuffer===!1,W.__autoAllocateDepthBuffer===!1&&(W.__useRenderToTexture=!1),q.get(S.texture).__webglTexture=V,q.get(S.depthTexture).__webglTexture=W.__autoAllocateDepthBuffer?void 0:Y,W.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(S,V){let Y=q.get(S);Y.__webglFramebuffer=V,Y.__useDefaultFramebuffer=V===void 0},this.setRenderTarget=function(S,V=0,Y=0){U=S,k=V,L=Y;let W=null,X=!1,_e=!1;if(S){let ge=q.get(S);if(ge.__useDefaultFramebuffer!==void 0){y.bindFramebuffer(z.FRAMEBUFFER,ge.__webglFramebuffer),K.copy(S.viewport),ne.copy(S.scissor),ce=S.scissorTest,y.viewport(K),y.scissor(ne),y.setScissorTest(ce),G=-1;return}else if(ge.__webglFramebuffer===void 0)J.setupRenderTarget(S);else if(ge.__hasExternalTextures)J.rebindTextures(S,q.get(S.texture).__webglTexture,q.get(S.depthTexture).__webglTexture);else if(S.depthBuffer){let He=S.depthTexture;if(ge.__boundDepthTexture!==He){if(He!==null&&q.has(He)&&(S.width!==He.image.width||S.height!==He.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");J.setupDepthRenderbuffer(S)}}let we=S.texture;(we.isData3DTexture||we.isDataArrayTexture||we.isCompressedArrayTexture)&&(_e=!0);let Pe=q.get(S).__webglFramebuffer;S.isWebGLCubeRenderTarget?(Array.isArray(Pe[V])?W=Pe[V][Y]:W=Pe[V],X=!0):S.samples>0&&J.useMultisampledRTT(S)===!1?W=q.get(S).__webglMultisampledFramebuffer:Array.isArray(Pe)?W=Pe[Y]:W=Pe,K.copy(S.viewport),ne.copy(S.scissor),ce=S.scissorTest}else K.copy(Se).multiplyScalar(te).floor(),ne.copy(qe).multiplyScalar(te).floor(),ce=Ne;if(Y!==0&&(W=D),y.bindFramebuffer(z.FRAMEBUFFER,W)&&y.drawBuffers(S,W),y.viewport(K),y.scissor(ne),y.setScissorTest(ce),X){let ge=q.get(S.texture);z.framebufferTexture2D(z.FRAMEBUFFER,z.COLOR_ATTACHMENT0,z.TEXTURE_CUBE_MAP_POSITIVE_X+V,ge.__webglTexture,Y)}else if(_e){let ge=V;for(let we=0;we<S.textures.length;we++){let Pe=q.get(S.textures[we]);z.framebufferTextureLayer(z.FRAMEBUFFER,z.COLOR_ATTACHMENT0+we,Pe.__webglTexture,Y,ge)}}else if(S!==null&&Y!==0){let ge=q.get(S.texture);z.framebufferTexture2D(z.FRAMEBUFFER,z.COLOR_ATTACHMENT0,z.TEXTURE_2D,ge.__webglTexture,Y)}G=-1},this.readRenderTargetPixels=function(S,V,Y,W,X,_e,ve,ge=0){if(!(S&&S.isWebGLRenderTarget)){Ue("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let we=q.get(S).__webglFramebuffer;if(S.isWebGLCubeRenderTarget&&ve!==void 0&&(we=we[ve]),we){y.bindFramebuffer(z.FRAMEBUFFER,we);try{let Pe=S.textures[ge],He=Pe.format,$e=Pe.type;if(S.textures.length>1&&z.readBuffer(z.COLOR_ATTACHMENT0+ge),!I.textureFormatReadable(He)){Ue("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!I.textureTypeReadable($e)){Ue("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}V>=0&&V<=S.width-W&&Y>=0&&Y<=S.height-X&&z.readPixels(V,Y,W,X,fe.convert(He),fe.convert($e),_e)}finally{let Pe=U!==null?q.get(U).__webglFramebuffer:null;y.bindFramebuffer(z.FRAMEBUFFER,Pe)}}},this.readRenderTargetPixelsAsync=async function(S,V,Y,W,X,_e,ve,ge=0){if(!(S&&S.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let we=q.get(S).__webglFramebuffer;if(S.isWebGLCubeRenderTarget&&ve!==void 0&&(we=we[ve]),we)if(V>=0&&V<=S.width-W&&Y>=0&&Y<=S.height-X){y.bindFramebuffer(z.FRAMEBUFFER,we);let Pe=S.textures[ge],He=Pe.format,$e=Pe.type;if(S.textures.length>1&&z.readBuffer(z.COLOR_ATTACHMENT0+ge),!I.textureFormatReadable(He))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!I.textureTypeReadable($e))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Ie=z.createBuffer();z.bindBuffer(z.PIXEL_PACK_BUFFER,Ie),z.bufferData(z.PIXEL_PACK_BUFFER,_e.byteLength,z.STREAM_READ),z.readPixels(V,Y,W,X,fe.convert(He),fe.convert($e),0);let rt=U!==null?q.get(U).__webglFramebuffer:null;y.bindFramebuffer(z.FRAMEBUFFER,rt);let St=z.fenceSync(z.SYNC_GPU_COMMANDS_COMPLETE,0);return z.flush(),await Oh(z,St,4),z.bindBuffer(z.PIXEL_PACK_BUFFER,Ie),z.getBufferSubData(z.PIXEL_PACK_BUFFER,0,_e),z.deleteBuffer(Ie),z.deleteSync(St),_e}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(S,V=null,Y=0){let W=Math.pow(2,-Y),X=Math.floor(S.image.width*W),_e=Math.floor(S.image.height*W),ve=V!==null?V.x:0,ge=V!==null?V.y:0;J.setTexture2D(S,0),z.copyTexSubImage2D(z.TEXTURE_2D,Y,0,0,ve,ge,X,_e),y.unbindTexture()},this.copyTextureToTexture=function(S,V,Y=null,W=null,X=0,_e=0){let ve,ge,we,Pe,He,$e,Ie,rt,St,yt=S.isCompressedTexture?S.mipmaps[_e]:S.image;if(Y!==null)ve=Y.max.x-Y.min.x,ge=Y.max.y-Y.min.y,we=Y.isBox3?Y.max.z-Y.min.z:1,Pe=Y.min.x,He=Y.min.y,$e=Y.isBox3?Y.min.z:0;else{let wt=Math.pow(2,-X);ve=Math.floor(yt.width*wt),ge=Math.floor(yt.height*wt),S.isDataArrayTexture?we=yt.depth:S.isData3DTexture?we=Math.floor(yt.depth*wt):we=1,Pe=0,He=0,$e=0}W!==null?(Ie=W.x,rt=W.y,St=W.z):(Ie=0,rt=0,St=0);let ot=fe.convert(V.format),zt=fe.convert(V.type),ye;V.isData3DTexture?(J.setTexture3D(V,0),ye=z.TEXTURE_3D):V.isDataArrayTexture||V.isCompressedArrayTexture?(J.setTexture2DArray(V,0),ye=z.TEXTURE_2D_ARRAY):(J.setTexture2D(V,0),ye=z.TEXTURE_2D),y.activeTexture(z.TEXTURE0),y.pixelStorei(z.UNPACK_FLIP_Y_WEBGL,V.flipY),y.pixelStorei(z.UNPACK_PREMULTIPLY_ALPHA_WEBGL,V.premultiplyAlpha),y.pixelStorei(z.UNPACK_ALIGNMENT,V.unpackAlignment);let rn=y.getParameter(z.UNPACK_ROW_LENGTH),je=y.getParameter(z.UNPACK_IMAGE_HEIGHT),hn=y.getParameter(z.UNPACK_SKIP_PIXELS),In=y.getParameter(z.UNPACK_SKIP_ROWS),Qn=y.getParameter(z.UNPACK_SKIP_IMAGES);y.pixelStorei(z.UNPACK_ROW_LENGTH,yt.width),y.pixelStorei(z.UNPACK_IMAGE_HEIGHT,yt.height),y.pixelStorei(z.UNPACK_SKIP_PIXELS,Pe),y.pixelStorei(z.UNPACK_SKIP_ROWS,He),y.pixelStorei(z.UNPACK_SKIP_IMAGES,$e);let Ki=S.isDataArrayTexture||S.isData3DTexture,at=V.isDataArrayTexture||V.isData3DTexture;if(S.isDepthTexture){let wt=q.get(S),ei=q.get(V),ut=q.get(wt.__renderTarget),ti=q.get(ei.__renderTarget);y.bindFramebuffer(z.READ_FRAMEBUFFER,ut.__webglFramebuffer),y.bindFramebuffer(z.DRAW_FRAMEBUFFER,ti.__webglFramebuffer);for(let Ji=0;Ji<we;Ji++)Ki&&(z.framebufferTextureLayer(z.READ_FRAMEBUFFER,z.COLOR_ATTACHMENT0,q.get(S).__webglTexture,X,$e+Ji),z.framebufferTextureLayer(z.DRAW_FRAMEBUFFER,z.COLOR_ATTACHMENT0,q.get(V).__webglTexture,_e,St+Ji)),z.blitFramebuffer(Pe,He,ve,ge,Ie,rt,ve,ge,z.DEPTH_BUFFER_BIT,z.NEAREST);y.bindFramebuffer(z.READ_FRAMEBUFFER,null),y.bindFramebuffer(z.DRAW_FRAMEBUFFER,null)}else if(X!==0||S.isRenderTargetTexture||q.has(S)){let wt=q.get(S),ei=q.get(V);y.bindFramebuffer(z.READ_FRAMEBUFFER,N),y.bindFramebuffer(z.DRAW_FRAMEBUFFER,F);for(let ut=0;ut<we;ut++)Ki?z.framebufferTextureLayer(z.READ_FRAMEBUFFER,z.COLOR_ATTACHMENT0,wt.__webglTexture,X,$e+ut):z.framebufferTexture2D(z.READ_FRAMEBUFFER,z.COLOR_ATTACHMENT0,z.TEXTURE_2D,wt.__webglTexture,X),at?z.framebufferTextureLayer(z.DRAW_FRAMEBUFFER,z.COLOR_ATTACHMENT0,ei.__webglTexture,_e,St+ut):z.framebufferTexture2D(z.DRAW_FRAMEBUFFER,z.COLOR_ATTACHMENT0,z.TEXTURE_2D,ei.__webglTexture,_e),X!==0?z.blitFramebuffer(Pe,He,ve,ge,Ie,rt,ve,ge,z.COLOR_BUFFER_BIT,z.NEAREST):at?z.copyTexSubImage3D(ye,_e,Ie,rt,St+ut,Pe,He,ve,ge):z.copyTexSubImage2D(ye,_e,Ie,rt,Pe,He,ve,ge);y.bindFramebuffer(z.READ_FRAMEBUFFER,null),y.bindFramebuffer(z.DRAW_FRAMEBUFFER,null)}else at?S.isDataTexture||S.isData3DTexture?z.texSubImage3D(ye,_e,Ie,rt,St,ve,ge,we,ot,zt,yt.data):V.isCompressedArrayTexture?z.compressedTexSubImage3D(ye,_e,Ie,rt,St,ve,ge,we,ot,yt.data):z.texSubImage3D(ye,_e,Ie,rt,St,ve,ge,we,ot,zt,yt):S.isDataTexture?z.texSubImage2D(z.TEXTURE_2D,_e,Ie,rt,ve,ge,ot,zt,yt.data):S.isCompressedTexture?z.compressedTexSubImage2D(z.TEXTURE_2D,_e,Ie,rt,yt.width,yt.height,ot,yt.data):z.texSubImage2D(z.TEXTURE_2D,_e,Ie,rt,ve,ge,ot,zt,yt);y.pixelStorei(z.UNPACK_ROW_LENGTH,rn),y.pixelStorei(z.UNPACK_IMAGE_HEIGHT,je),y.pixelStorei(z.UNPACK_SKIP_PIXELS,hn),y.pixelStorei(z.UNPACK_SKIP_ROWS,In),y.pixelStorei(z.UNPACK_SKIP_IMAGES,Qn),_e===0&&V.generateMipmaps&&z.generateMipmap(ye),y.unbindTexture()},this.initRenderTarget=function(S){q.get(S).__webglFramebuffer===void 0&&J.setupRenderTarget(S)},this.initTexture=function(S){S.isCubeTexture?J.setTextureCube(S,0):S.isData3DTexture?J.setTexture3D(S,0):S.isDataArrayTexture||S.isCompressedArrayTexture?J.setTexture2DArray(S,0):J.setTexture2D(S,0),y.unbindTexture()},this.resetState=function(){k=0,L=0,U=null,y.reset(),xe.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return vn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=Je._getDrawingBufferColorSpace(e),t.unpackColorSpace=Je._getUnpackColorSpace()}};var bd={type:"change"},Xc={type:"start"},Sd={type:"end"},Qa=new Bi,Md=new kt,Wx=Math.cos(70*Sc.DEG2RAD),Nt=new B,en=2*Math.PI,st={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Wc=1e-6,el=class extends Es{constructor(e,t=null){super(e,t),this.state=st.NONE,this.target=new B,this.cursor=new B,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:pi.ROTATE,MIDDLE:pi.DOLLY,RIGHT:pi.PAN},this.touches={ONE:mi.ROTATE,TWO:mi.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new B,this._lastQuaternion=new an,this._lastTargetPosition=new B,this._quat=new an().setFromUnitVectors(e.up,new B(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new wr,this._sphericalDelta=new wr,this._scale=1,this._panOffset=new B,this._rotateStart=new Ee,this._rotateEnd=new Ee,this._rotateDelta=new Ee,this._panStart=new Ee,this._panEnd=new Ee,this._panDelta=new Ee,this._dollyStart=new Ee,this._dollyEnd=new Ee,this._dollyDelta=new Ee,this._dollyDirection=new B,this._mouse=new Ee,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=qx.bind(this),this._onPointerDown=Xx.bind(this),this._onPointerUp=Yx.bind(this),this._onContextMenu=ey.bind(this),this._onMouseWheel=Kx.bind(this),this._onKeyDown=Jx.bind(this),this._onTouchStart=jx.bind(this),this._onTouchMove=Qx.bind(this),this._onMouseDown=$x.bind(this),this._onMouseMove=Zx.bind(this),this._interceptControlDown=ty.bind(this),this._interceptControlUp=ny.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e==="grab"?this.domElement.style.cursor="grab":this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction=""}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(bd),this.update(),this.state=st.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;Nt.copy(t).sub(this.target),Nt.applyQuaternion(this._quat),this._spherical.setFromVector3(Nt),this.autoRotate&&this.state===st.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let i=this.minAzimuthAngle,r=this.maxAzimuthAngle;isFinite(i)&&isFinite(r)&&(i<-Math.PI?i+=en:i>Math.PI&&(i-=en),r<-Math.PI?r+=en:r>Math.PI&&(r-=en),i<=r?this._spherical.theta=Math.max(i,Math.min(r,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(i+r)/2?Math.max(i,this._spherical.theta):Math.min(r,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let s=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let o=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),s=o!=this._spherical.radius}if(Nt.setFromSpherical(this._spherical),Nt.applyQuaternion(this._quatInverse),t.copy(this.target).add(Nt),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let o=null;if(this.object.isPerspectiveCamera){let a=Nt.length();o=this._clampDistance(a*this._scale);let l=a-o;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),s=!!l}else if(this.object.isOrthographicCamera){let a=new B(this._mouse.x,this._mouse.y,0);a.unproject(this.object);let l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),s=l!==this.object.zoom;let c=new B(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(a),this.object.updateMatrixWorld(),o=Nt.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;o!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(o).add(this.object.position):(Qa.origin.copy(this.object.position),Qa.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(Qa.direction))<Wx?this.object.lookAt(this.target):(Md.setFromNormalAndCoplanarPoint(this.object.up,this.target),Qa.intersectPlane(Md,this.target))))}else if(this.object.isOrthographicCamera){let o=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),o!==this.object.zoom&&(this.object.updateProjectionMatrix(),s=!0)}return this._scale=1,this._performCursorZoom=!1,s||this._lastPosition.distanceToSquared(this.object.position)>Wc||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Wc||this._lastTargetPosition.distanceToSquared(this.target)>Wc?(this.dispatchEvent(bd),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?en/60*this.autoRotateSpeed*e:en/60/60*this.autoRotateSpeed}_getZoomScale(e){let t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Nt.setFromMatrixColumn(t,0),Nt.multiplyScalar(-e),this._panOffset.add(Nt)}_panUp(e,t){this.screenSpacePanning===!0?Nt.setFromMatrixColumn(t,1):(Nt.setFromMatrixColumn(t,0),Nt.crossVectors(this.object.up,Nt)),Nt.multiplyScalar(e),this._panOffset.add(Nt)}_pan(e,t){let i=this.domElement;if(this.object.isPerspectiveCamera){let r=this.object.position;Nt.copy(r).sub(this.target);let s=Nt.length();s*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*s/i.clientHeight,this.object.matrix),this._panUp(2*t*s/i.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/i.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/i.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let i=this.domElement.getBoundingClientRect(),r=e-i.left,s=t-i.top,o=i.width,a=i.height;this._mouse.x=r/o*2-1,this._mouse.y=-(s/a)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(en*this._rotateDelta.x/t.clientHeight),this._rotateUp(en*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(en*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-en*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(en*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-en*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._rotateStart.set(i,r)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panStart.set(i,r)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),i=e.pageX-t.x,r=e.pageY-t.y,s=Math.sqrt(i*i+r*r);this._dollyStart.set(0,s)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let i=this._getSecondPointerPosition(e),r=.5*(e.pageX+i.x),s=.5*(e.pageY+i.y);this._rotateEnd.set(r,s)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(en*this._rotateDelta.x/t.clientHeight),this._rotateUp(en*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panEnd.set(i,r)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),i=e.pageX-t.x,r=e.pageY-t.y,s=Math.sqrt(i*i+r*r);this._dollyEnd.set(0,s),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let o=(e.pageX+t.x)*.5,a=(e.pageY+t.y)*.5;this._updateZoomParameters(o,a)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new Ee,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,i={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:i.deltaY*=16;break;case 2:i.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(i.deltaY*=10),i}};function Xx(n){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(n.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(n)&&(this._addPointer(n),n.pointerType==="touch"?this._onTouchStart(n):this._onMouseDown(n),this._cursorStyle==="grab"&&(this.domElement.style.cursor="grabbing")))}function qx(n){this.enabled!==!1&&(n.pointerType==="touch"?this._onTouchMove(n):this._onMouseMove(n))}function Yx(n){switch(this._removePointer(n),this._pointers.length){case 0:this.domElement.releasePointerCapture(n.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(Sd),this.state=st.NONE,this._cursorStyle==="grab"&&(this.domElement.style.cursor="grab");break;case 1:let e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function $x(n){let e;switch(n.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case pi.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(n),this.state=st.DOLLY;break;case pi.ROTATE:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=st.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=st.ROTATE}break;case pi.PAN:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=st.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=st.PAN}break;default:this.state=st.NONE}this.state!==st.NONE&&this.dispatchEvent(Xc)}function Zx(n){switch(this.state){case st.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(n);break;case st.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(n);break;case st.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(n);break}}function Kx(n){this.enabled===!1||this.enableZoom===!1||this.state!==st.NONE||(n.preventDefault(),this.dispatchEvent(Xc),this._handleMouseWheel(this._customWheelEvent(n)),this.dispatchEvent(Sd))}function Jx(n){this.enabled!==!1&&this._handleKeyDown(n)}function jx(n){switch(this._trackPointer(n),this._pointers.length){case 1:switch(this.touches.ONE){case mi.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(n),this.state=st.TOUCH_ROTATE;break;case mi.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(n),this.state=st.TOUCH_PAN;break;default:this.state=st.NONE}break;case 2:switch(this.touches.TWO){case mi.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(n),this.state=st.TOUCH_DOLLY_PAN;break;case mi.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(n),this.state=st.TOUCH_DOLLY_ROTATE;break;default:this.state=st.NONE}break;default:this.state=st.NONE}this.state!==st.NONE&&this.dispatchEvent(Xc)}function Qx(n){switch(this._trackPointer(n),this.state){case st.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(n),this.update();break;case st.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(n),this.update();break;case st.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(n),this.update();break;case st.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(n),this.update();break;default:this.state=st.NONE}}function ey(n){this.enabled!==!1&&n.preventDefault()}function ty(n){n.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function ny(n){n.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}var iy=n=>Math.max(-85.0511,Math.min(85.0511,n));function tl(n,e,t){let i=2**t,r=iy(e)*Math.PI/180,s=Math.floor((n+180)/360*i),o=Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*i);return{z:t,x:Math.min(i-1,Math.max(0,s)),y:Math.min(i-1,Math.max(0,o))}}var bi=({z:n,x:e,y:t})=>`${n}/${e}/${t}`;function Lr(n,e,t=0){let i=tl(n.west,n.north,e),r=tl(n.east,n.south,e),s=2**e,o=[];for(let a=i.x-t;a<=r.x+t;a++)for(let l=i.y-t;l<=r.y+t;l++)a<0||l<0||a>=s||l>=s||o.push({z:e,x:a,y:l});return o}var Yc=14,ry=1,sy=24,oy=n=>[(n.west+n.east)/2,(n.south+n.north)/2];function qc(n,e){return(n.x-e.x)**2+(n.y-e.y)**2}function $c(n,e,t={}){let i=t.zoom??Yc,r=t.margin??ry,s=t.budget??sy,o=Lr(n,i,r),a=o.map(bi),l=new Set(a),c=new Set(e),[h,p]=oy(n),u=Lr({west:h,south:p,east:h,north:p},i)[0],f=o.filter(d=>!c.has(bi(d))).sort((d,M)=>qc(d,u)-qc(M,u)),m=[...c].filter(d=>!l.has(d)).map(d=>{let[,M,w]=d.split("/").map(Number);return{key:d,distance:qc({z:i,x:M,y:w},u)}}).sort((d,M)=>M.distance-d.distance),v=c.size+f.length-s,g=v>0?m.slice(0,Math.min(v,m.length)).map(d=>d.key):[];return{load:f,evict:g,wanted:a}}function nl(n){if(n.length===0)return[0,0];let[e,t]=n[0],i=0,r=0,s=0;for(let o=0,a=n.length-1;o<n.length;a=o++){let l=n[o][0]-e,c=n[o][1]-t,h=n[a][0]-e,p=n[a][1]-t,u=h*c-l*p;i+=u,r+=(h+l)*u,s+=(p+c)*u}return Math.abs(i)<1e-18?[n.reduce((o,a)=>o+a[0],0)/n.length,n.reduce((o,a)=>o+a[1],0)/n.length]:[e+r/(3*i),t+s/(3*i)]}function il(n){return n.type==="Polygon"?[n.coordinates]:n.coordinates}function wd(n,e=Yc){let t=il(n.footprint),i=t[0]?.[0];if(!i||i.length<4)throw new Error(`Missing closed footprint: ${n.id}`);for(let r of t)for(let s of r){if(s.length<4||s[0][0]!==s[s.length-1][0]||s[0][1]!==s[s.length-1][1])throw new Error(`Unclosed footprint: ${n.id}`);for(let[o,a]of s)if(!Number.isFinite(o)||!Number.isFinite(a)||Math.abs(o)>180||Math.abs(a)>85.0511)throw new Error(`Non-geographic footprint: ${n.id}`)}return bi(tl(...nl(i),e))}function Td(n,e){if(!Number.isFinite(n)||n<0)throw new Error("Invalid camera distance");return e==="detail"&&n<=95?"detail":e==="massing"&&n>=235?"massing":n<(e==="facade"?65:80)?"detail":n>(e==="facade"?265:250)?"massing":"facade"}var rl=class{constructor(e,t){this.budget=e;this.release=t;if(!Number.isInteger(e)||e<1)throw new Error("Invalid resource budget")}entries=new Map;get keys(){return[...this.entries.keys()]}get size(){return this.entries.size}get(e){return this.entries.get(e)}touch(e){if(!this.entries.has(e))return;let t=this.entries.get(e);this.entries.delete(e),this.entries.set(e,t)}canAdopt(e,t=new Set){return this.entries.has(e)||this.entries.size<this.budget||this.keys.some(i=>!t.has(i))}adopt(e,t,i=new Set){return this.entries.get(e)===t&&this.entries.has(e)?(this.touch(e),!0):this.canAdopt(e,i)?(this.entries.has(e)?this.drop(e):this.entries.size>=this.budget&&this.drop(this.keys.find(r=>!i.has(r))),this.entries.set(e,t),!0):!1}drop(e){if(!this.entries.has(e))return;let t=this.entries.get(e);this.entries.delete(e),this.release(t,e)}clear(){for(let e of this.keys)this.drop(e)}};var Vs=class{constructor(e){this.options=e;if(e.index.version!==1||!Number.isInteger(e.index.zoom)||e.index.zoom<0||e.index.zoom>22||!Array.isArray(e.index.tileList))throw new Error("Unsupported appearance index");if(this.published=new Set(e.index.tileList),this.published.size!==e.index.tileList.length||[...this.published].some(t=>!new RegExp(`^${e.index.zoom}/\\d+/\\d+$`).test(t)))throw new Error("Invalid appearance index keys");if(this.concurrency=e.concurrency??2,!Number.isInteger(this.concurrency)||this.concurrency<1||this.concurrency>8)throw new Error("Invalid appearance concurrency");if(!Number.isFinite(e.lodDistanceMultiplier??1)||(e.lodDistanceMultiplier??1)<.25||(e.lodDistanceMultiplier??1)>4)throw new Error("Invalid LOD distance multiplier");this.cache=new rl(e.budget??24,t=>t.resource?.dispose())}cache;published;controllers=new Map;failed=new Set;visibleDependencies=new Map;waiters=[];camera=null;wanted=new Set;queue=[];inFlight=0;disposed=!1;constrained=!1;concurrency;get status(){return{resident:this.cache.size,residentKeys:this.cache.keys,inFlight:this.inFlight,queued:this.queue.length,failed:[...this.failed],budgetConstrained:this.constrained,disposed:this.disposed}}update(e){if(this.disposed)return;let{bounds:t,longitude:i,latitude:r}=e;if(![i,r,t.west,t.south,t.east,t.north].every(Number.isFinite)||t.east<t.west||t.north<t.south||Math.abs(i)>180||Math.abs(r)>85.0511||t.west<-180||t.east>180||t.south<-85.0511||t.north>85.0511)throw new Error("Invalid appearance camera");if(t.east-t.west>1||t.north-t.south>1)throw new Error("Appearance viewport needs massing-only overview");this.camera=structuredClone(e),this.replan(),this.refreshLods(),this.pump()}retryFailed(){this.failed.clear(),this.camera&&!this.disposed&&(this.replan(),this.pump())}replan(){if(!this.camera)return;let{bounds:e}=this.camera,t=$c(e,[],{zoom:this.options.index.zoom,margin:1,budget:this.cache.budget}).load.map(bi).filter(a=>this.published.has(a)),i=Lr(e,this.options.index.zoom).map(bi);for(let a of this.visibleDependencies.keys())i.includes(a)||this.visibleDependencies.delete(a);for(let a of i){let l=this.cache.get(a);l&&this.visibleDependencies.set(a,l.tile.halo.map(c=>c.ownerTile))}let r=i.flatMap(a=>this.visibleDependencies.get(a)??[]).filter(a=>this.published.has(a)),s=(this.options.priorityTiles??[]).filter(a=>this.published.has(a)),o=[...new Set([...s,...r,...t])];this.constrained=o.length>this.cache.budget,this.wanted=new Set(o.slice(0,this.cache.budget));for(let[a,l]of this.controllers)this.wanted.has(a)||l.abort();for(let a of this.wanted)this.cache.touch(a);this.queue=[...this.wanted].filter(a=>!this.cache.get(a)&&!this.controllers.has(a)&&!this.failed.has(a))}pump(){for(;!this.disposed&&this.inFlight<this.concurrency&&this.queue.length;){let e=this.queue.shift();this.cache.canAdopt(e,this.wanted)&&this.fetch(e)}this.settle()}validate(e,t){if(e.version!==1||e.key!==t||!Array.isArray(e.owners)||!Array.isArray(e.halo))throw new Error("Mismatched appearance tile");let i=new Set,r=new Set;for(let o of e.owners){if(!o.id||!o.geometryRevision||i.has(o.id)||wd(o,this.options.index.zoom)!==t)throw new Error(`Invalid appearance owner: ${o.id}`);i.add(o.id);for(let a of o.observations){if(!a.id||r.has(a.id)||a.buildingId!==o.id||a.geometryRevision!==o.geometryRevision||!a.evidenceKey)throw new Error(`Unbound appearance observation: ${a.id}`);r.add(a.id)}}let s=new Set;for(let o of e.halo){if(!o.buildingId||!o.geometryRevision||o.ownerTile===t||!this.published.has(o.ownerTile)||i.has(o.buildingId)||s.has(o.buildingId))throw new Error(`Invalid appearance halo: ${o.buildingId}`);s.add(o.buildingId);let a=this.cache.get(o.ownerTile)?.tile;if(a&&!a.owners.some(l=>l.id===o.buildingId&&l.geometryRevision===o.geometryRevision))throw new Error(`Stale appearance halo: ${o.buildingId}`)}for(let o of this.cache.keys)for(let a of this.cache.get(o).tile.halo)if(a.ownerTile===t&&!e.owners.some(l=>l.id===a.buildingId&&l.geometryRevision===a.geometryRevision))throw new Error(`Stale appearance owner: ${a.buildingId}`)}async fetch(e){let t=new AbortController;this.controllers.set(e,t),this.inFlight++;try{let i=await this.options.loadTile(e,t.signal);if(this.disposed||t.signal.aborted||!this.wanted.has(e)||(this.validate(i,e),!this.cache.canAdopt(e,this.wanted)))return;let r={tile:i,resource:i.owners.length?this.options.createResource(i.owners):null,lods:new Map};if(!this.cache.adopt(e,r,this.wanted)){r.resource?.dispose();return}this.replan(),this.refreshLods()}catch(i){!t.signal.aborted&&!this.disposed&&(this.failed.add(e),this.options.onError?.(e,i))}finally{this.controllers.get(e)===t&&this.controllers.delete(e),this.inFlight--,this.disposed||this.replan(),this.pump()}}refreshLods(){if(!this.camera)return;let{longitude:e,latitude:t}=this.camera,i=111320*Math.cos(t*Math.PI/180);for(let r of this.cache.keys){let s=this.cache.get(r);for(let o of s.tile.owners){let[a,l]=nl(il(o.footprint)[0][0]),c=Math.hypot((a-e)*i,(l-t)*111320),h=Td(c*(this.options.lodDistanceMultiplier??1),s.lods.get(o.id));s.lods.get(o.id)!==h&&(s.resource?.setLod(o.id,h),s.lods.set(o.id,h))}}}whenIdle(){return this.inFlight===0&&this.queue.length===0?Promise.resolve():new Promise(e=>this.waiters.push(e))}settle(){if(this.inFlight===0&&this.queue.length===0)for(let e of this.waiters.splice(0))e()}dispose(){if(!this.disposed){this.disposed=!0,this.queue=[];for(let e of this.controllers.values())e.abort();this.cache.clear(),this.settle()}}};function Ed(n,e,t="y"){let i=new n.MeshStandardMaterial({color:e,roughness:.94,side:n.DoubleSide});return i.customProgramCacheKey=()=>`appearance-brick-v1-${t}`,i.onBeforeCompile=r=>{r.vertexShader=`varying vec3 facadeMetricPosition;
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
    `)},i}var ay="legacy-block-NAP-minus-0.65m";function Ad(n){if(n===ay)return .65;if(n==="NAP")return 0;throw new Error(`Unsupported appearance height datum: ${n}`)}function sl(n,e,t=0){return n+Ad(e)-t}function Mi(n,e){return n-Ad(e)}function Kc(n){let e=n.rings?.[0]||[],t,i=0;for(let o of e)for(let a of e){let l=Math.hypot(a[0]-o[0],a[2]-o[2]);l>i&&(t=[o,a],i=l)}if(!t||i<1e-8)return null;t.sort((o,a)=>o[0]-a[0]||o[2]-a[2]);let[r,s]=t;return{origin:[r[0],r[2]],u:[(s[0]-r[0])/i,(s[2]-r[2])/i],length:i}}var Zc=(n,e)=>(e[0]-n.origin[0])*n.u[0]+(e[2]-n.origin[1])*n.u[1];function Si(n,e,t,i=[]){let r=Kc(n);if(!r)return{axis:null,sourceSurfaceIndex:e,intervals:[]};let s=[];for(let l of i){if(l.renderBuildingId!==t||!l.renderSurfaceIndices?.includes(e)||["rejected","uncertain","crop-repair"].includes(l.review?.placement)||!l.effectiveProposal||l.effectiveProposal.wholeUsable==="no")continue;let c=l.review?.placement==="accepted"&&l.review.targetId&&l.review.targetId!==l.id?i.find(m=>m.id===l.review.targetId):l;if(!c||c.buildingId&&c.buildingId!==t)continue;let h=[c.localStart,c.localEnd];if(h.some(m=>!Array.isArray(m)||m.length!==2||!m.every(Number.isFinite))||h.some(m=>Math.abs((m[0]-r.origin[0])*r.u[1]-(m[1]-r.origin[1])*r.u[0])>=.8))continue;let p=h.map(m=>Zc(r,[m[0],0,m[1]])),u=Math.max(0,Math.min(...p)),f=Math.min(r.length,Math.max(...p));f-u>1e-8&&s.push({record:l,startM:u,endM:f})}let o=[...new Set([0,r.length,...s.flatMap(l=>[l.startM,l.endM])])].sort((l,c)=>l-c),a=[];for(let l=0;l<o.length-1;l++){let c=o[l],h=o[l+1];if(h-c<1e-8)continue;let p=(c+h)/2,u=s.filter(g=>g.startM<=p&&g.endM>=p),f=u.filter(g=>g.record.review?.placement==="accepted"),m=f.length?f:u,v=m.length===1?m[0].record:null;a.push({startM:c,endM:h,observation:v,candidateIds:u.map(g=>g.record.id).sort(),status:v?f.length?"human":"machine":m.length?"conflict":"uncovered"})}return{axis:r,sourceSurfaceIndex:e,intervals:a}}function Rd(n,e,t,i){function r(o,a,l){let c=[];for(let h=0;h<o.length;h++){let p=o[h],u=o[(h+1)%o.length],f=l*(Zc(e,p)-a),m=l*(Zc(e,u)-a);if(f>=0&&c.push(p),f>=0!=m>=0){let v=f/(f-m);c.push(p.map((g,d)=>g+(u[d]-g)*v))}}return c}let s=[];for(let o=0;o<n.length;o+=9){let a=[n.slice(o,o+3),n.slice(o+3,o+6),n.slice(o+6,o+9)];a=r(r(a,t,1),i,-1);for(let l=1;l<a.length-1;l++){let[c,h,p]=[a[0],a[l],a[l+1]],u=h.map((m,v)=>m-c[v]),f=p.map((m,v)=>m-c[v]);Math.hypot(u[1]*f[2]-u[2]*f[1],u[2]*f[0]-u[0]*f[2],u[0]*f[1]-u[1]*f[0])>1e-10&&s.push(...c,...h,...p)}}return s}function Gs(n,e,t){if(!n)return null;let i=c=>[e.origin[0]+e.u[0]*c,e.origin[1]+e.u[1]*c],r=[t.startM,t.endM].map(i).map(c=>(c[0]-n.a[0])*n.u[0]+(c[1]-n.a[1])*n.u[1]),s=Math.max(0,Math.min(...r)),o=Math.min(n.width,Math.max(...r));if(o-s<1e-8)return null;let a=[n.a[0]+n.u[0]*s,n.a[1]+n.u[1]*s],l=o-s;return{...n,a,width:l,mid:[a[0]+n.u[0]*l/2,a[1]+n.u[1]*l/2],polygon:n.polygon.map(c=>[c[0]-s,c[1]]),holes:(n.holes||[]).map(c=>c.map(h=>[h[0]-s,h[1]])),intervalBounded:!0,observation:t.observation,intervalStatus:t.status}}function ly(n,e,t){let i=t[0]-e[0],r=t[1]-e[1],s=Math.hypot(i,r);return s<1e-7?Math.hypot(n[0]-e[0],n[1]-e[1])<=1e-7:Math.abs((n[0]-e[0])*r-(n[1]-e[1])*i)<=1e-7*s&&(n[0]-e[0])*i+(n[1]-e[1])*r>=-1e-7*s&&(n[0]-t[0])*i+(n[1]-t[1])*r<=1e-7*s}function Cd(n,e){let t=!1;for(let i=0,r=e.length-1;i<e.length;r=i++){let s=e[r],o=e[i];if(ly(n,s,o))return{inside:!1,boundary:!0};s[1]>n[1]!=o[1]>n[1]&&n[0]<(o[0]-s[0])*(n[1]-s[1])/(o[1]-s[1])+s[0]&&(t=!t)}return{inside:t,boundary:!1}}function cy(n,e,t){let i=0,r=1;for(let s=0;s<2;s++){let o=t[s]+1e-7,a=t[s+2]-1e-7,l=e[s]-n[s];if(o>=a)return!1;if(Math.abs(l)<1e-7){if(n[s]<=o||n[s]>=a)return!1;continue}let c=(o-n[s])/l,h=(a-n[s])/l;if(i=Math.max(i,Math.min(c,h)),r=Math.min(r,Math.max(c,h)),i>r)return!1}return i<=r}function tn(n,e,t,i,r){if(![e,t,i,r].every(Number.isFinite)||i<=0||r<=0)return!1;let s=[e-i/2,t-r/2,e+i/2,t+r/2];if(n.intervalBounded&&(s[0]<-1e-7||s[2]>n.width+1e-7))return!1;let o=[n.polygon,...n.holes||[]];if(o.some(l=>!Array.isArray(l)||l.length<3||l.some(c=>!Array.isArray(c)||c.length<2||!c.slice(0,2).every(Number.isFinite))))return!1;let a=[[s[0],s[1]],[s[0],s[3]],[s[2],s[1]],[s[2],s[3]]];return a.some(l=>{let c=Cd(l,o[0]);return!c.inside&&!c.boundary})||o.slice(1).some(l=>a.some(c=>Cd(c,l).inside))?!1:!o.some(l=>l.some((c,h)=>cy(c,l[(h+1)%l.length],s)))}function uy(n){let e=n.awningEvidence;if(!e||e.origin!=="agent-visual-review"||e.derivationKey!==n.derivationKey||e.buildingMatch!=="yes"||e.appearanceEligible!==!0)return null;let t=Object.values(n.images||{});return!Array.isArray(e.images)||!e.images.length||!e.images.every(i=>t.some(r=>i.file===r.file&&i.sha256===r.sha256&&(!i.panoramaSha256||i.panoramaSha256===r.panoramaSha256)))?null:e.awningObservation||null}function Pd(n){let e=n.review;if(e?.placement!=="accepted"||e.targetId!==n.id||n.effectiveProposal?.awning!=="yes"||n.effectiveProposal?.wholeUsable==="no")return!1;if(e.awningKind!==void 0||e.awningDeployment!==void 0)return e.awningKind==="fabric"&&e.awningDeployment==="deployed";let t=uy(n);return t?.presence==="yes"&&t.fabricAwningPresence==="yes"&&t.kind==="fabric"&&t.observedDeployment==="deployed"}var wi={minimumWidthM:.65,minimumPairedWidthM:1.1,minimumHeightM:1.8,maximumGroundGapM:.3,maximumWidthGrowthM:.2,maximumHeightGrowthM:.25};function Id(n,e){let t={feature:n,adjustments:[]};if(n.kind!=="door"||!Number.isFinite(e)||n.thresholdHeightM!==void 0||n.disposition==="human-reviewed")return t;let i=n.y-n.height/2,r=n.y+n.height/2,s=i-e;if(s<-1e-6||s>wi.maximumGroundGapM+1e-6)return t;let o=n.paired?wi.minimumPairedWidthM:wi.minimumWidthM;if(n.width<o-wi.maximumWidthGrowthM||n.height<wi.minimumHeightM-wi.maximumHeightGrowthM-s)return t;let a=[],l=i,c=r,h=n.width;if(s>1e-6&&(l=e,a.push("door-ground-extension")),h<o&&(h=o,a.push("door-minimum-width")),c-l<wi.minimumHeightM&&(c=l+wi.minimumHeightM,a.push("door-minimum-height")),!a.length)return t;let p=c-l,u={...n,width:h,height:p,y:(c+l)/2};for(let f of["archRise","lintelRise","transom"])n[f]!==void 0&&(u[f]=n[f]*n.height/p);return n.topCornerRadius!==void 0&&(u.topCornerRadius=n.topCornerRadius*Math.min(n.width,n.height)/Math.min(h,p)),{feature:u,adjustments:a}}var Ld=(n,e)=>JSON.stringify(n)===JSON.stringify(e);function Xi(n,e,t,i){let r=n.facadeDescription;if(!r||r.version!==1||!r.extractionVersion||r.buildingId!==e.id||r.geometryRevision!==e.geometryRevision||r.evidenceKey!==n.evidenceKey||!r.surfaceIndices?.includes(t)||!Ld(r.frontage,[n.localStart,n.localEnd])||n.machineRevocation?.revoked||["rejected","uncertain","crop-repair"].includes(n.review?.placement))return null;let s=r.sources?.[i],o=n.images?.[i];if(!s||!/^[a-f0-9]{64}$/i.test(s.cropSha256)||s.cropSha256!==o?.sha256||!s.captureDate||s.captureDate!==(o.date??o.capturedAt)||!Number.isInteger(s.imageDimensions?.width)||!Number.isInteger(s.imageDimensions?.height)||s.imageDimensions.width<=0||s.imageDimensions.height<=0||s.imageDimensions.width!==o?.width||s.imageDimensions.height!==o?.height||!Array.isArray(s.features)||s.features.length>256||new Set(s.features.map(c=>c.id)).size!==s.features.length)return null;let a=Object.values(r.sources).flatMap(c=>Array.isArray(c?.features)?c.features.map(h=>h.id):[]);if(new Set(a).size!==a.length)return null;let l=s.registration;return!l||l.status!=="registered"||l.surfaceIndex!==t||!Number.isFinite(l.uncertaintyM)||l.uncertaintyM<0||l.uncertaintyM>.15||l.imageToWall?.length!==9||!l.imageToWall.every(Number.isFinite)||l.sourceDatum&&l.sourceDatum!=="NAP"||l.canonicalDatum&&l.canonicalDatum!=="surface-base"||l.pixelConvention&&l.pixelConvention!=="pixel-edge"||l.wallDirection&&(!Array.isArray(l.wallDirection)||l.wallDirection.length!==2||!l.wallDirection.every(Number.isFinite)||Math.abs(Math.hypot(...l.wallDirection)-1)>.001)||!l.alignment||l.alignment.wallIdentity!=="verified"||l.alignment.boundaryEvidence!==!0||l.alignment.rooflineEvidence!==!0||l.alignment.cameraHeightResolved!==!0||l.alignment.orientationVerified!==!0?null:s}function Hs(n,e,t,i){let r=n.facadeDescription;if(!r||r.version!==1||!r.extractionVersion||r.buildingId!==e.id||r.geometryRevision!==e.geometryRevision||r.evidenceKey!==n.evidenceKey||!r.surfaceIndices?.includes(t)||!Ld(r.frontage,[n.localStart,n.localEnd])||n.machineRevocation?.revoked||["rejected","uncertain","crop-repair"].includes(n.review?.placement))return null;let s=r.sources?.[i],o=n.images?.[i],a=s?.registration,l=a?.preview;return!s||!o||!/^[a-f0-9]{64}$/i.test(s.cropSha256)||s.cropSha256!==o.sha256||s.captureDate!==(o.date??o.capturedAt)||!Number.isInteger(s.imageDimensions?.width)||!Number.isInteger(s.imageDimensions?.height)||s.imageDimensions.width<=0||s.imageDimensions.height<=0||s.imageDimensions.width!==o.width||s.imageDimensions.height!==o.height||!Array.isArray(s.features)||s.features.length>256||new Set(s.features.map(c=>c.id)).size!==s.features.length||a?.status!=="ambiguous"||a.surfaceIndex!==t||a.sourceDatum!=="NAP"||a.canonicalDatum!=="surface-base"||a.pixelConvention!=="pixel-edge"||!l||l.kind!=="native-crop-plane"||l.cropSha256!==s.cropSha256||l.imageDimensions?.width!==s.imageDimensions.width||l.imageDimensions?.height!==s.imageDimensions.height||!Array.isArray(l.imageToWall)||l.imageToWall.length!==9||!l.imageToWall.every(Number.isFinite)||!l.note?.trim()?null:{...s,registration:{...a,imageToWall:l.imageToWall,uncertaintyM:.15}}}function Dr(n,e,t){let i=t.review?.facadeFeatures?.[n.id];if(n.disposition==="revoked"||i?.disposition==="revoked"||t.featureRevocations?.[n.id]||t.visualReview?.fieldEligibility?.[n.id]===!1&&i?.disposition!=="human-reviewed")return null;let r=i?.disposition==="human-reviewed"?{...n,...i}:n;if(!["machine-observed-unreviewed","agent-inspected","human-reviewed"].includes(r.disposition)||r.signMount!==void 0&&(!["wall","glazing"].includes(r.signMount)||r.kind!=="fascia")||r.doorStyle!==void 0&&(!["panelled","glazed","plain"].includes(r.doorStyle)||r.kind!=="door")||r.doorFurniture!==void 0&&(!["knob","pull","none"].includes(r.doorFurniture)||r.kind!=="door")||!r.id||!Array.isArray(r.bounds)||r.bounds.length!==4||!r.bounds.every(Number.isFinite)||r.archRise!==void 0&&(!Number.isFinite(r.archRise)||r.archRise<=0||r.archRise>.5||!["rounded","segmental"].includes(r.head??""))||r.lintelRise!==void 0&&(!Number.isFinite(r.lintelRise)||r.lintelRise<=0||r.lintelRise>.5||!["rounded","segmental"].includes(r.lintelHead??""))||r.topCornerRadius!==void 0&&(!Number.isFinite(r.topCornerRadius)||r.topCornerRadius<=0||r.topCornerRadius>.25||r.head!=="rectangular"))return null;let[s,o,a,l]=r.bounds;if(s<0||o<0||a<=s||l<=o)return null;let c=Object.values(t.images??{}).find(x=>x.sha256===e.cropSha256);if(a>e.imageDimensions.width||l>e.imageDimensions.height)return null;let h=e.registration.imageToWall,p=[[s,o],[a,o],[a,l],[s,l]],u=p.map(([x,R])=>h[6]*x+h[7]*R+h[8]);if(u.some(x=>Math.abs(x)<1e-8)||u.some(x=>Math.sign(x)!==Math.sign(u[0])))return null;let f=p.map(([x,R],b)=>[(h[0]*x+h[1]*R+h[2])/u[b],(h[3]*x+h[4]*R+h[5])/u[b]]),m=Math.max(.03,e.registration.uncertaintyM);if(Math.max(Math.abs(f[0][1]-f[1][1]),Math.abs(f[2][1]-f[3][1]),Math.abs(f[0][0]-f[3][0]),Math.abs(f[1][0]-f[2][0]))>m)return null;let v=f.map(x=>x[0]),g=f.map(x=>x[1]),d=Math.max(...v)-Math.min(...v),M=Math.max(...g)-Math.min(...g);if(![d,M,...v,...g].every(Number.isFinite)||d<=.02||M<=.02)return null;let w=f[0][0]>f[1][0]&&Array.isArray(r.mullions)?r.mullions.map(x=>1-x).sort((x,R)=>x-R):r.mullions;return{...r,...w?{mullions:w}:{},t:(Math.min(...v)+Math.max(...v))/2,y:(Math.min(...g)+Math.max(...g))/2,width:d,height:M,uncertaintyM:e.registration.uncertaintyM}}function Ws(n,e,t="rectangular",i,r){let s=n/2,o=-e/2,a=e/2;if(t==="rectangular"&&Number.isFinite(r)&&r>0){let u=Math.min(n,e)*r,f=Array.from({length:5},(v,g)=>{let d=g*Math.PI/8;return[s-u+Math.cos(d)*u,a-u+Math.sin(d)*u]}),m=Array.from({length:5},(v,g)=>{let d=Math.PI/2+g*Math.PI/8;return[-s+u+Math.cos(d)*u,a-u+Math.sin(d)*u]});return[[-s,o],[s,o],[s,a-u],...f.slice(1),...m.slice(1),[-s,a-u]]}if(!["rounded","segmental"].includes(t))return[[-s,o],[s,o],[s,a],[-s,a]];let l=Number.isFinite(i)&&i>0&&i<=.5?e*i:void 0,c=Math.min(l??(t==="rounded"?s:n*.2),e*.5),h=a-c,p=Array.from({length:13},(u,f)=>{let m=f*Math.PI/12;return[Math.cos(m)*s,h+Math.sin(m)*c]});return[[-s,o],[s,o],...p]}function Dd(n,e){let t=[];for(let r=0;r<n.length;r++){let s=n[r],o=n[(r+1)%n.length];(s[1]<=e&&e<o[1]||o[1]<=e&&e<s[1])&&t.push(s[0]+(o[0]-s[0])*(e-s[1])/(o[1]-s[1]))}t.sort((r,s)=>r-s);let i=[];for(let r=0;r+1<t.length;r+=2)t[r+1]-t[r]>.001&&i.push([t[r],t[r+1]]);return i}function Nd(n,e){let t=[];for(let i=0;i<n.length;i++){let r=n[i],s=n[(i+1)%n.length];(r[0]<=e&&e<s[0]||s[0]<=e&&e<r[0])&&t.push(r[1]+(s[1]-r[1])*(e-r[0])/(s[0]-r[0]))}return t.length<2?null:(t.sort((i,r)=>i-r),[t[0],t[t.length-1]])}var ol={windowGlass:"#526a6b",windowGlassBlue:"#4b6268",windowGlassWarm:"#62685d",windowFrame:"#ddd8c7",windowFrameDark:"#676963",doorWood:"#3f342d",shopGlass:"#354a4b",awningFabric:"#807765",facadeTrimLight:"#b9ad96",facadeTrimDark:"#61584e"};function Nr(n,e){let t=!1;for(let i=0,r=e.length-1;i<e.length;r=i++){let s=e[i],o=e[r];s[1]>n[1]!=o[1]>n[1]&&n[0]<(o[0]-s[0])*(n[1]-s[1])/(o[1]-s[1])+s[0]&&(t=!t)}return t}function jc(n,e){return(e.type==="Polygon"?[e.coordinates]:e.coordinates).some(i=>Nr(n,i[0])&&!i.slice(1).some(r=>Nr(n,r)))}var Fd=new WeakMap;function hy(n,e,t){let i=Fd.get(t);if(!i){i=new Map;for(let s of t){let o=s.geometry.building.footprint,a=o.type==="Polygon"?[o.coordinates]:o.coordinates,l=a.flat(2),c=s.geometry.frame.originRD,h=l.map(u=>u[0]+c.x),p=l.map(u=>c.y-u[1]);for(let u=Math.floor(Math.min(...h)/32);u<=Math.floor(Math.max(...h)/32);u++)for(let f=Math.floor(Math.min(...p)/32);f<=Math.floor(Math.max(...p)/32);f++){let m=`${u},${f}`,v=i.get(m)??[];v.push(s),i.set(m,v)}}Fd.set(t,i)}let r=e.geometry.frame.originRD;return i.get(`${Math.floor((n[0]+r.x)/32)},${Math.floor((r.y-n[1])/32)}`)??[]}function Vd(n,e,t){let i=e.geometry.frame.originRD;return hy(n,e,t).some(r=>{if(r.id===e.id)return!1;let s=r.geometry.frame.originRD;return jc([n[0]+i.x-s.x,n[1]+s.y-i.y],r.geometry.building.footprint)})}function Ti(n,e,t,i,r){return[-.5,0,.5].every(s=>{let o=e+t*s;return!Vd([n.a[0]+n.u[0]*o+n.n[0]*.08,n.a[1]+n.u[1]*o+n.n[1]*.08],i,r)})}function Fr(n,e,t){let i=Kc(n);if(!i||i.length<1.5||n.rings.flat().some(p=>Math.abs((p[0]-i.origin[0])*i.u[1]-(p[2]-i.origin[1])*i.u[0])>.1))return null;let r=i.origin,s=i.u,o=[r[0]+s[0]*i.length/2,r[1]+s[1]*i.length/2],a=[-s[1],s[0]],l=(p,u)=>[o[0]+p[0]*u,o[1]+p[1]*u];if(jc(l(a,.25),e.geometry.building.footprint)&&(a=a.map(p=>-p)),jc(l(a,.25),e.geometry.building.footprint)||Vd(l(a,.25),e,t))return null;let c=p=>[(p[0]-r[0])*s[0]+(p[2]-r[1])*s[1],p[1]],h=n.rings.map(p=>p.map(c));return{a:r,u:s,n:a,width:i.length,bottom:Math.min(...h[0].map(p=>p[1])),top:Math.max(...h[0].map(p=>p[1])),polygon:h[0],holes:h.slice(1)}}var Ud=new WeakMap;function dy(n,e){let t=Ud.get(n);if(t!==void 0)return t;let i=-1,r=0;return n.geometry.building.surfaces.forEach((s,o)=>{if(s.type!=="wall")return;let a=Fr(s,n,e);a&&a.width>r&&(r=a.width,i=o)}),Ud.set(n,i),i}var Gd=(n,e)=>{let t=n.images?.[e];return!!t&&/^[a-f0-9]{64}$/i.test(t.sha256??"")&&/^[a-f0-9]{64}$/i.test(t.panoramaSha256??"")},fy=n=>!["rejected","uncertain","crop-repair"].includes(n.review?.placement);function al(n){return n.flatMap(e=>e.observations.filter(t=>{let i=t.payload;return t.buildingId===e.id&&t.geometryRevision===e.geometryRevision&&t.evidenceKey&&i?.evidenceKey===t.evidenceKey&&i?.derivationKey&&i.renderBuildingId===e.id&&!i.machineRevocation?.revoked&&fy(i)}).map(t=>t.payload))}function Od(n){return!Gd(n,"ground")||!["yes","no"].includes(n.effectiveProposal?.shopfront)?!1:n.review?.placement==="accepted"&&n.proposalSources?.shopfront==="human-review"?!0:n.visualReview?.fieldEligibility?.shopfront===!1?!1:n.visualReview?.fieldEligibility?.shopfront===!0||n.effectiveProposal?.groundUsable==="yes"}function py(n){return Gd(n,"full")&&n.effectiveProposal?.wholeUsable==="yes"&&n.visualReview?.appearanceEligible!==!1}var vt=(n,e,t,i)=>[n.a[0]+n.u[0]*e+n.n[0]*i,t,n.a[1]+n.u[1]*e+n.n[1]*i];function tt(n,e,t,i,r,s){let o=[[e-i/2,t-r/2],[e+i/2,t-r/2],[e+i/2,t+r/2],[e-i/2,t+r/2]].map(([l,c])=>vt(n,l,c,s));return(-n.u[1]*n.n[0]+n.u[0]*n.n[1]>=0?[0,1,2,0,2,3]:[0,2,1,0,3,2]).flatMap(l=>o[l])}var Bd=n=>n.reduce((e,t,i)=>{let r=n[(i+1)%n.length];return e+t[0]*r[1]-r[0]*t[1]},0);function Hd(n,e){if(e.length<3||Math.abs(Bd(e))<1e-8)return[];let t=Math.sign(Bd(e)),i=n;for(let r=0;r<e.length;r++){let s=e[r],o=e[(r+1)%e.length],a=i;i=[];let l=c=>(o[0]-s[0])*(c[1]-s[1])-(o[1]-s[1])*(c[0]-s[0]);for(let c=0;c<a.length;c++){let h=a[c],p=a[(c+1)%a.length],u=l(h),f=l(p),m=t*u>=-1e-8,v=t*f>=-1e-8;if(m&&i.push(h),m!==v){let g=u/(u-f);i.push([h[0]+(p[0]-h[0])*g,h[1]+(p[1]-h[1])*g])}}}return i}function my(n,e,t,i,r,s){let o=Hd([[e-i/2,t-r/2],[e+i/2,t-r/2],[e+i/2,t+r/2],[e-i/2,t+r/2]],n.polygon),a=[];for(let l=1;l<o.length-1;l++){let c=[o[0],o[l],o[l+1]],h=[c.reduce((p,u)=>p+u[0],0)/3,c.reduce((p,u)=>p+u[1],0)/3];n.holes.some(p=>Nr(h,p))||a.push(...c.flatMap(([p,u])=>vt(n,p,u,s)))}return a}function Jc(n,e,t){return n.flatMap((i,r)=>{if(r%3!==0)return[];let s=(n[r]-e.a[0])*e.u[0]+(n[r+2]-e.a[1])*e.u[1],o=n[r+1],a=(s-t.left)/(t.right-t.left);return t.sourceXForward||(a=1-a),[Math.max(0,Math.min(1,a)),Math.max(0,Math.min(1,(o-t.bottom)/(t.top-t.bottom)))]})}function gy(n,e){let t=[];for(let i=0;i<n.length;i+=9){let r=[0,1,2].map(h=>n.slice(i+h*3,i+h*3+3)),s=r.map(h=>[(h[0]-e.a[0])*e.u[0]+(h[2]-e.a[1])*e.u[1],h[1]]);if(s.every(h=>Nr(h,e.polygon)&&!e.holes.some(p=>Nr(h,p)))){t.push(...r.flat());continue}let o=Hd(s,e.polygon);if(o.length<3)continue;let a=r.map(h=>(h[0]-e.a[0])*e.n[0]+(h[2]-e.a[1])*e.n[1]),l=(s[1][1]-s[2][1])*(s[0][0]-s[2][0])+(s[2][0]-s[1][0])*(s[0][1]-s[2][1]),c=(h,p)=>{if(Math.abs(l)<1e-12)return a[0];let u=((s[1][1]-s[2][1])*(h-s[2][0])+(s[2][0]-s[1][0])*(p-s[2][1]))/l,f=((s[2][1]-s[0][1])*(h-s[2][0])+(s[0][0]-s[2][0])*(p-s[2][1]))/l;return u*a[0]+f*a[1]+(1-u-f)*a[2]};for(let h=1;h<o.length-1;h++){let p=[o[0],o[h],o[h+1]],u=[p.reduce((f,m)=>f+m[0],0)/3,p.reduce((f,m)=>f+m[1],0)/3];e.holes.some(f=>Nr(u,f))||t.push(...p.flatMap(([f,m])=>vt(e,f,m,c(f,m))))}}return t}function Xs(n,e,t,i,r,s,o){return[...tt(n,e,t-r/2-s/2,i+2*s,s,o),...tt(n,e,t+r/2+s/2,i+2*s,s,o),...tt(n,e-i/2-s/2,t,s,r,o),...tt(n,e+i/2+s/2,t,s,r,o)]}function _y(n,e,t,i,r,s,o=l=>!0,a=!1){let l=[],c=new Set,h=new Set,p=Number.isFinite(n.geometry.building.groundNAP)&&["NAP","legacy-block-NAP-minus-0.65m"].includes(n.geometry.frame.heightDatum)?Mi(n.geometry.building.groundNAP,n.geometry.frame.heightDatum)-e.bottom:void 0,u=(m,v)=>/^#[a-f0-9]{6}$/i.test(m??"")?m:v,f=(t.a[0]-e.a[0])*e.u[0]+(t.a[1]-e.a[1])*e.u[1];for(let m of r.features??[]){if(!o(m))continue;let v=Dr(m,r,i);if(!v)continue;let g=Id(v,p);if(g.adjustments.length){let D=g.feature,N=D.lintelHead||D.surroundColour?.length?.14:.07;(!tn(t,D.t-f,D.y+e.bottom+N/2,D.width+N*2,D.height+N)||!Ti(t,D.t-f,D.width+N*2,n,s))&&(g={feature:v,adjustments:[]})}let d=g.feature,M=d.t-f,w=d.y+e.bottom,x=d.kind==="window"||d.kind==="door",R=x?d.lintelHead||d.surroundColour?.length?.14:.07:0,b=g.adjustments.length>0,C=tn(t,M,w+(b?R/2:0),d.width+R*2,d.height+R*(b?1:2))&&Ti(t,M,d.width+R*2,n,s),_=x&&!C&&a;if((x||d.kind==="awning")&&!C&&!_)continue;let E=d.kind==="door"?"observed-door":d.kind==="window"?"observed-window":d.kind==="awning"?"observed-awning":d.kind==="fascia"?"observed-fascia":"observed-material",T=`${n.id}:${i.id}:${d.id}`;_&&c.add(T),b&&h.add(T);let A=(D,N)=>l.push({triangles:D,colour:N,observationId:i.id,featureId:T,featureKind:E,styleSource:d.disposition,...b?{heuristics:g.adjustments}:{},...d.kind==="material"&&d.material==="brick"?{material:"brick"}:{}}),P=(D,N,F,k)=>[D,N,F].flatMap(([L,U])=>vt(t,M+L,w+U,k));if(x){if(!d.head||d.head==="unknown")continue;let D=Ws(d.width,d.height,d.head,d.archRise,d.topCornerRadius),N=Ws(d.width+.14,d.height+.14,d.head,d.archRise,d.topCornerRadius);for(let L=1;L<D.length-1;L++)A(P(D[0],D[L],D[L+1],.032),u(d.colour,d.kind==="door"?"doorWood":"windowGlass"));for(let L=0;L<D.length;L++){let U=(L+1)%D.length;A([...P(D[L],N[L],N[U],.072),...P(D[L],N[U],D[U],.072)],u(d.frameColour,"windowFrame"))}for(let L=0;L<D.length;L++){let U=(L+1)%D.length,G=vt(t,M+D[L][0],w+D[L][1],.032),Z=vt(t,M+D[U][0],w+D[U][1],.032),K=vt(t,M+D[U][0],w+D[U][1],.072),ne=vt(t,M+D[L][0],w+D[L][1],.072);A([...G,...Z,...K,...G,...K,...ne],u(d.frameColour,"windowFrame"))}if(d.kind==="window"&&A(tt(t,M,w-d.height/2-.035,d.width+.14,.07,.095),u(d.frameColour,"windowFrame")),d.kind==="door"&&d.transom&&d.transom>0&&d.transom<.6){let L=d.height*(.5-d.transom),U=[];for(let G=0;G<D.length;G++){let Z=D[G],K=D[(G+1)%D.length];Z[1]>=L&&U.push(Z),Z[1]>=L!=K[1]>=L&&U.push([Z[0]+(K[0]-Z[0])*(L-Z[1])/(K[1]-Z[1]),L])}for(let G=1;G<U.length-1;G++)A(P(U[0],U[G],U[G+1],.04),"windowGlass")}let F=L=>{let U=Nd(D,L);U&&A(tt(t,M+L,w+(U[0]+U[1])/2,.065,Math.max(.02,U[1]-U[0]-.08),.078),u(d.frameColour,"windowFrame"))},k=L=>{for(let[U,G]of Dd(D,L))A(tt(t,M+(U+G)/2,w+L,G-U,.065,.078),u(d.frameColour,"windowFrame"))};d.paired&&F(0),d.transom&&d.transom>0&&d.transom<.6&&k(d.height*(.5-d.transom));for(let L of d.mullions??[])L>0&&L<1&&F(d.width*(L-.5));if(d.kind==="door"){let L=d.doorStyle??"panelled",U=d.doorFurniture??"knob",G=-d.height/2,Z=Math.min(d.height*(.5-(d.transom??.12)),d.height*.5-(d.archRise??0)*d.height)-.1,K=d.paired?2:1,ne=d.width/K,ce=Z-G,Ae=(Re,$,ie)=>{A(Re,$);let te=l[l.length-1];te.styleSource="procedural-prior-not-measured",te.heuristics=[...te.heuristics??[],ie]};if(ce>.65&&ne>.36)for(let Re=0;Re<K;Re++){let $=-d.width/2+ne*(Re+.5),ie=ne*.68,te=(Se,qe,Ne=!1)=>{Ae(Xs(t,M+$,w+Se,ie,qe,.025,.083),"#655e50","door-panel-grammar"),Ae(tt(t,M+$,w+Se,ie,qe,.081),Ne?"windowGlass":u(d.colour,"doorWood"),"door-panel-grammar")};L==="glazed"?(te(G+ce*.63,ce*.53,!0),te(G+ce*.19,ce*.19)):L==="panelled"&&(te(G+ce*.27,ce*.32),te(G+ce*.7,ce*.36));let be=$+(K===2?Re===0?1:-1:1)*ne*.34,Oe=G+Math.min(1.02,ce*.55);if(U==="knob"){let Se=Math.min(.035,ne*.05),qe=[];for(let We=0;We<10;We++){let Ye=We*Math.PI/5;qe.push(vt(t,M+be+Math.cos(Ye)*Se,w+Oe+Math.sin(Ye)*Se,.115))}let Ne=vt(t,M+be,w+Oe,.135);Ae(qe.flatMap((We,Ye)=>[...Ne,...We,...qe[(Ye+1)%qe.length]]),"#b4a17a","door-furniture-grammar")}else U==="pull"&&Ae(tt(t,M+be,w+Oe,.026,Math.min(.28,ce*.2),.12),"#b8b9b4","door-furniture-grammar");L==="panelled"&&Re===0&&Ae(tt(t,M+$,w+G+ce*.49,Math.min(.24,ie*.65),.035,.11),"#aaa18a","door-furniture-grammar")}}if(d.lintelHead||d.surroundColour){let L=Ws(d.width+.14,d.height+.14,d.lintelHead??d.head,d.lintelRise),U=Ws(d.width+.28,d.height+.28,d.lintelHead??d.head,d.lintelRise);for(let G=2;G<U.length-1;G++)A([...P(L[G],U[G],U[G+1],.06),...P(L[G],U[G+1],L[G+1],.06)],u(d.surroundColour,"facadeTrimLight"))}}else if(d.kind==="awning"){let D=(N,F,k,L,U)=>{if(!d.text?.trim()||!d.physicalSignId?.trim())return;let G=r.registration.imageToWall,Z=d.bounds[0],K=d.bounds[2],ne=(d.bounds[1]+d.bounds[3])/2,ce=ie=>G[6]*ie+G[7]*ne+G[8],Ae=ie=>(G[0]*ie+G[1]*ne+G[2])/ce(ie),Re={left:M-d.width/2,right:M+d.width/2,bottom:k,top:L,sourceXForward:Ae(K)>Ae(Z)};A(N,F);let $=l[l.length-1];$.sign={text:d.text.trim(),background:ol[F]??F,colour:/^#[a-f0-9]{6}$/i.test(d.textColour??"")?d.textColour:"#f4f1e8",...d.signFont?.trim()?{font:d.signFont.trim()}:{},physicalSignId:d.physicalSignId.trim(),aspectRatio:d.width/(L-k),uv:Jc(N,t,Re)},$.signMapping=Re};if(d.state==="retracted"){let N=Math.min(.18,d.height),F=u(d.frameColour,u(d.colour,"awningFabric"));A(tt(t,M,w,d.width,N,.1),u(d.colour,"awningFabric")),D(tt(t,M,w,d.width,N,.104),F,w-N/2,w+N/2,.104)}if(d.state==="extended"){let N=w+d.height/2,F=w-d.height/2,k=Math.min(.26,d.height*.22),L=d.height-k,U=Math.min(1.5,Math.max(.45,d.width*.22)),G=d.stripeColour?Math.max(2,Math.min(48,Math.round(d.stripeCount??20))):1,Z=d.awningProfile==="curved"?8:1,K=ie=>[N-L*(d.awningProfile==="curved"?1-Math.cos(ie*Math.PI/2):ie),.08+U*(d.awningProfile==="curved"?Math.sin(ie*Math.PI/2):ie)],ne=(ie,te)=>A([0,1,2,0,2,3].flatMap(be=>ie[be]),te);for(let ie=0;ie<G;ie++){let te=M-d.width/2+d.width*ie/G,be=M-d.width/2+d.width*(ie+1)/G,Oe=u(ie%2?d.stripeColour:d.colour,"awningFabric");for(let qe=0;qe<Z;qe++){let Ne=K(qe/Z),We=K((qe+1)/Z);ne([vt(t,te,Ne[0],Ne[1]),vt(t,be,Ne[0],Ne[1]),vt(t,be,We[0],We[1]),vt(t,te,We[0],We[1])],Oe)}let Se=d.valance==="scalloped"?Math.max(1,Math.round((be-te)/.16)):1;for(let qe=0;qe<Se;qe++)for(let Ne=0;Ne<(d.valance==="scalloped"?6:1);Ne++){let We=d.valance==="scalloped"?6:1,Ye=Ne/We,Ke=(Ne+1)/We,pt=te+(be-te)*(qe+Ye)/Se,gt=te+(be-te)*(qe+Ke)/Se,Mt=Pt=>F+(d.valance==="scalloped"?Math.min(.06,k*.3)*(1-Math.sin(Pt*Math.PI)):0);ne([vt(t,pt,F+k,.08+U),vt(t,gt,F+k,.08+U),vt(t,gt,Mt(Ke),.08+U),vt(t,pt,Mt(Ye),.08+U)],Oe)}}let ce=u(d.frameColour,u(d.colour,"awningFabric")),Ae=d.valance==="scalloped"?Math.min(.06,k*.3):0,Re=F+Ae,$=k-Ae;D(tt(t,M,Re+$/2,d.width,$,.08+U+.004),ce,Re,F+k,.08+U+.004)}}else if(/^#[a-f0-9]{6}$/i.test(d.colour??"")){let D=my(t,M,w,d.width,d.height,d.kind==="fascia"?d.signMount==="glazing"?.05:.025:d.region==="upper-wall"?.008:d.region==="ground-floor"?.014:d.region==="plinth"?.018:.022);if(D.length){let N=u(d.colour,"facadeTrimLight");if(A(D,N),d.kind==="fascia"&&d.text?.trim()&&d.physicalSignId?.trim()){let F=r.registration.imageToWall,k=d.bounds[0],L=d.bounds[2],U=(d.bounds[1]+d.bounds[3])/2,G=Ae=>F[6]*Ae+F[7]*U+F[8],Z=Ae=>(F[0]*Ae+F[1]*U+F[2])/G(Ae),K=Z(L)>Z(k),ne={left:M-d.width/2,right:M+d.width/2,bottom:w-d.height/2,top:w+d.height/2,sourceXForward:K},ce=l[l.length-1];ce.sign={text:d.text.trim(),background:ol[N]??N,colour:/^#[a-f0-9]{6}$/i.test(d.textColour??"")?d.textColour:"#f4f1e8",...d.signFont?.trim()?{font:d.signFont.trim()}:{},physicalSignId:d.physicalSignId.trim(),aspectRatio:d.width/d.height,uv:Jc(D,t,ne)},ce.signMapping=ne}}}}return a||h.size?l.map(m=>{if(!a&&!h.has(m.featureId))return m;let v=gy(m.triangles,t);return v.length?{...m,triangles:v,...m.sign&&m.signMapping?{sign:{...m.sign,uv:Jc(v,t,m.signMapping)}}:{},signMapping:void 0,...c.has(m.featureId)?{partialAtFace:!0}:{}}:null}).filter(m=>m!==null).map(m=>{let{signMapping:v,...g}=m;return g}):l.map(m=>{let{signMapping:v,...g}=m;return g})}function kd(n,e,t,i){if(e.type!=="wall")return[];let r=Fr(e,n,i);if(!r||r.width<2.2||r.top-r.bottom<5)return[];let s=Number.isFinite(n.geometry.building.groundNAP)?Mi(n.geometry.building.groundNAP,n.geometry.frame.heightDatum):r.bottom,o=Math.min(r.top,s+42),a=o-s;if(a<5)return[];let l=Number(n.geometry.building.year),c=Number.isFinite(l)&&l<1940?3.45:3.15,h=Math.max(1,Math.min(10,Math.floor(a/c))),p=Number.isFinite(l)&&l<1940?2.45:3.05,u=Math.max(1,Math.min(14,Math.round(r.width/p))),f=r.width/u,m=Math.min(Number.isFinite(l)&&l<1940?1.18:1.48,f*.55),v=Math.min(Number.isFinite(l)&&l<1940?1.85:1.55,c*.58),g=[],d=[...n.id].reduce((A,P)=>A*31+P.charCodeAt(0),0)>>>0,M=Number.isFinite(l)&&l>=1970||d%11===0?"windowFrameDark":"windowFrame",w=d%3===0?"windowGlassBlue":d%3===1?"windowGlassWarm":"windowGlass",x=dy(n,i),R=[...n.id].reduce((A,P)=>A+P.charCodeAt(0),0)%u,b=t===x&&r.bottom<=s+.7,C=Number.isFinite(l)&&l<1965;for(let A=0;A<h;A++)for(let P=0;P<u;P++){if(b&&A===0&&P===R)continue;let D=(P+.5)*f,N=s+.55+(A+.5)*c;if(!tn(r,D,N,m+.16,v+.16)||!Ti(r,D,m+.16,n,i))continue;let F=`${n.id}:${t}:context-window:${A}:${P}`;g.push({triangles:Xs(r,D,N,m,v,.1,.05),colour:M,observationId:null,featureId:F,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"},{triangles:tt(r,D,N,m,v,.038),colour:w,observationId:null,featureId:F,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"},{triangles:tt(r,D,N+v*.12,m,.065,.058),colour:M,observationId:null,featureId:F,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"}),C&&g.push({triangles:tt(r,D,N,.055,v-.14,.058),colour:M,observationId:null,featureId:F,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"}),g.push({triangles:tt(r,D,N-v/2-.045,m+.28,.09,.07),colour:M,observationId:null,featureId:F,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"})}if(b){let A=(R+.5)*f,P=Math.min(1.15,f*.48),D=Math.min(2.45,c*.76),N=s+.12+D/2;if(tn(r,A,N,P+.2,D+.16)&&Ti(r,A,P+.2,n,i)){let F=`${n.id}:${t}:context-door`,k=(L,U)=>g.push({triangles:L,colour:U,observationId:null,featureId:F,featureKind:"contextual-door-prior",styleSource:"procedural-prior-not-measured"});if(k(tt(r,A,N,P+.2,D+.16,.036),M),k(tt(r,A,N,P,D,.05),"doorWood"),C){let L=Math.min(.42,D*.18),U=N+D/2-L/2-.1;k(tt(r,A,U,P-.18,L,.062),w),k(tt(r,A,U-L/2-.045,P,.09,.068),M)}k(tt(r,A,s+.1,P+.28,.1,.075),M)}}let _=r.width-.32,E=Number.isFinite(l)&&l>=1965?"facadeTrimDark":"facadeTrimLight",T=(A,P,D)=>{_<1.8||!tn(r,r.width/2,P,_,D)||!Ti(r,r.width/2,_,n,i)||g.push({triangles:tt(r,r.width/2,P,_,D,.072),colour:E,observationId:null,featureId:`${n.id}:${t}:context-trim:${A}`,featureKind:"contextual-trim-prior",styleSource:"procedural-prior-not-measured"})};return h>1&&T("street-datum",s+c,.12),Number.isFinite(l)&&l<1965&&T("facade-top",o-.18,.24),g}function xy(n,e,t,i,r,s=!1,o=!1){if(e.type!=="wall")return[];let a=Fr(e,n,r);if(!a||a.top-a.bottom<2.5)return[];let l=new Map(i.map(f=>[f.id,f])),c=[],h=n.geometry.building.surfaces.filter(f=>f.type==="wall").flatMap(f=>f.rings[0].map(m=>m[1])),p=Number.isFinite(n.geometry.building.groundNAP)?Mi(n.geometry.building.groundNAP,n.geometry.frame.heightDatum):Math.min(...h),u=["upper","ground"].flatMap(f=>{let m=f==="upper"?"full":"ground",v=i.map(d=>{let M=d.facadeDescription?.sources?.[m],w=Xi(d,n,t,m),x=!w&&o?Hs(d,n,t,m):null,R=f==="upper"&&(!!Xi(d,n,t,"ground")||o&&!!Hs(d,n,t,"ground")),b=!!w||!!x||!M&&(f==="upper"?py(d)||R:Od(d));return{...d,effectiveProposal:b?{wholeUsable:"unknown"}:null}}),g=Si(e,t,n.id,v);return g.intervals.map(d=>({field:f,interval:d,axis:g.axis}))});for(let{field:f,interval:m,axis:v}of u){if(!m.observation||m.status==="conflict")continue;let g=l.get(m.observation.id),d=Gs(a,v,m);if(!g||!d||d.width<1.5)continue;let M=(K,ne,ce,Ae)=>c.push({triangles:K,colour:ne,observationId:g.id,featureId:ce,featureKind:Ae,styleSource:"procedural-prior-not-measured"}),w=(K,ne,ce,Ae,Re)=>{!tn(d,K,ne,ce+.18,Ae+.18)||!Ti(d,K,ce+.18,n,r)||(M(Xs(d,K,ne,ce,Ae,.09,.05),"windowFrame",Re,"window-prior"),M(tt(d,K,ne,ce,Ae,.038),"windowGlass",Re,"window-prior"),M(tt(d,K,ne+Ae*.12,ce,.065,.058),"windowFrame",Re,"window-prior"),M(tt(d,K,ne,.055,Ae-.14,.058),"windowFrame",Re,"window-prior"))},x=f==="upper"?"full":"ground",R=Xi(g,n,t,x),b=!R&&o?Hs(g,n,t,x):null,C=R??b;if(C){let K=f==="upper"&&Xi(g,n,t,"ground"),ne=f==="upper"&&!K&&o?Hs(g,n,t,"ground"):null,ce=K??ne,Ae=ce?(ce.features??[]).map(ie=>Dr(ie,ce,g)).filter(Boolean):[],$=_y(n,a,d,g,C,r,ce?ie=>{if(ie.region==="upper-wall")return!0;let te=Dr(ie,C,g);return te?!Ae.some(be=>Math.abs(te.t-be.t)<(te.width+be.width)/2&&Math.abs(te.y-be.y)<(te.height+be.height)/2):!1}:void 0,o&&!!b);c.push(...b?$.map(ie=>({...ie,previewOnly:!0})):$);continue}let _=3.5,E=Math.max(1,Math.min(12,Math.ceil((d.top-p)/_))),T=Math.max(1,Math.min(16,Math.round(d.width/2.7))),A=d.width/T,P=Math.min(1.25,A*.53),D=Math.min(1.9,_*.56),N=`${n.id}:${t}:${g.id}`;if(f==="upper"){for(let K=1;K<E;K++)for(let ne=0;ne<T;ne++)w((ne+.5)*A,p+(K+.48)*_,P,D,`${N}:window:${K}:${ne}`);continue}if(!Od(g)||d.bottom>p+1.5)continue;let F=Math.min(2.35,_*.66),k=p+.55+F/2;if(g.effectiveProposal.shopfront==="no"){let K=A/2,ne=Math.min(1.1,A*.48),ce=2.35,Ae=p+.12+ce/2,Re=tn(d,K,Ae,ne+.18,ce+.18)&&Ti(d,K,ne+.18,n,r);if(Re){let $=`${N}:entrance-prior`;M(Xs(d,K,Ae,ne,ce,.09,.065),"windowFrame",$,"contextual-door-prior"),M(tt(d,K,Ae,ne,ce,.038),"doorWood",$,"contextual-door-prior"),M(tt(d,K,Ae+ce/2-.25,ne-.12,.36,.052),"windowGlass",$,"contextual-door-prior")}for(let $=Re?1:0;$<T;$++)w(($+.5)*A,k,P,Math.min(1.8,F),`${N}:window:0:${$}`);continue}let L=Math.min(d.width-.5,12),U=d.width/2;if(!tn(d,U,k,L+.16,F+.16)||!Ti(d,U,L+.16,n,r))continue;let G=`${N}:shop`;M(Xs(d,U,k,L,F,.08,.05),"windowFrame",G,"shopfront-prior"),M(tt(d,U,k,L,F,.038),"shopGlass",G,"shopfront-prior");let Z=Math.max(2,Math.ceil(L/1.7));for(let K=1;K<Z;K++)M(tt(d,U-L/2+L*K/Z,k,.065,F,.058),"windowFrame",G,"shopfront-prior");if(s&&Pd(g)){let K=k+F/2+.3;if(!tn(d,U,K,L,.2))continue;let ne=[vt(d,U-L/2,K,.07),vt(d,U+L/2,K,.07),vt(d,U+L/2,K-.24,.8),vt(d,U-L/2,K-.24,.8)];M([0,1,2,0,2,3].flatMap(ce=>ne[ce]),"awningFabric",`${N}:awning`,"reviewed-awning-prior")}}return c}function yy(n,e,t,i){let r=i.filter(o=>o.renderBuildingId===n.id&&o.renderSurfaceIndices?.includes(t));return r.length?Si(e,t,n.id,r.map(o=>({...o,effectiveProposal:{wholeUsable:"unknown"}}))).intervals.filter(o=>o.observation||o.status==="conflict").map(o=>[Math.min(o.startM,o.endM),Math.max(o.startM,o.endM)]).filter(([o,a])=>Number.isFinite(o)&&Number.isFinite(a)&&a>o):[]}function zd(n,e,t,i){let r=o=>(o[0]-e.a[0])*e.u[0]+(o[2]-e.a[1])*e.u[1],s=[];for(let o=0;o<n.length;o++){let a=n[o],l=n[(o+1)%n.length],c=r(a),h=r(l),p=i?c>=t:c<=t,u=i?h>=t:h<=t;if(p&&s.push(a),p!==u){let f=(t-c)/(h-c);s.push(a.map((m,v)=>m+(l[v]-m)*f))}}return s}function vy(n,e,t){if(!t.length)return n;let i=t.slice().sort((o,a)=>o[0]-a[0]),r=[],s=0;for(let[o,a]of i)o>s&&r.push([s,Math.min(e.width,o)]),s=Math.max(s,a);return s<e.width&&r.push([s,e.width]),n.flatMap(o=>{let a=[];for(let l=0;l<o.triangles.length;l+=9){let c=[0,1,2].map(h=>o.triangles.slice(l+h*3,l+h*3+3));for(let[h,p]of r){let u=zd(zd(c,e,h,!0),e,p,!1);for(let f=1;f<u.length-1;f++)a.push(...u[0],...u[f],...u[f+1])}}return a.length?[{...o,triangles:a}]:[]})}function Wd(n,e,t,i,r,s={}){let o=i.filter(f=>f.renderBuildingId===n.id&&f.renderSurfaceIndices?.includes(t)&&f.facadeDescription),a=s.procedural?i:o,l=xy(n,e,t,s.observed===!1?a.filter(f=>!f.facadeDescription):a,r,s.reviewedAwnings,s.candidateRegistrationPreview===!0);if(!s.contextual)return l;let c=Fr(e,n,r),h=new Set(l.map(f=>f.observationId).filter(f=>typeof f=="string")),p=i.filter(f=>o.includes(f)||h.has(f.id));if(!p.length)return l.length?l:kd(n,e,t,r);let u=c?vy(kd(n,e,t,r),c,yy(n,e,t,p)):[];return[...l,...u]}var by=128,Xd="Shop names are machine-read from dated panoramas \u2014 unreviewed",My=7.4,Sy=n=>!["rejected","uncertain","crop-repair"].includes(n?.review?.placement),qd=(n,e)=>{let t=n?.images?.[e];return!!t&&/^[a-f0-9]{64}$/i.test(t.sha256??"")&&/^[a-f0-9]{64}$/i.test(t.panoramaSha256??"")},Yd=n=>!qd(n,"ground")||!["yes","no"].includes(n.effectiveProposal?.shopfront)?!1:n.review?.placement==="accepted"&&n.proposalSources?.shopfront==="human-review"?!0:n.visualReview?.fieldEligibility?.shopfront===!1?!1:n.visualReview?.fieldEligibility?.shopfront===!0||n.effectiveProposal?.groundUsable==="yes";function wy(n){if(!n)return"missing-record";if(n.machineRevocation?.revoked)return"revoked-observation";if(!Sy(n))return"revoked-placement";if(!n.evidenceKey||!n.derivationKey)return"missing-source-identity";if(!qd(n,"ground"))return"missing-current-ground-source";if(!n.images?.ground?.date&&!n.images?.ground?.capturedAt)return"missing-capture-date";if(n.effectiveProposal?.shopfront!=="yes")return"shopfront-not-positive";if(n.visualReview?.fieldEligibility?.shopfront===!1||n.visualReview?.fieldEligibility?.signText===!1)return"field-withheld";if(!Yd(n))return"ground-source-not-supported";let e=n.machineRoutingProposal;if(!e)return"missing-machine-proposal";if(e.signTextEligible!=="yes")return"sign-text-not-eligible";let t=String(e.signText??"").trim();return t?/[\u0000-\u001f\u007f]/.test(t)?"control-character-sign-text":null:"empty-sign-text"}function $d(n,e=28){let t=String(n??"").trim();return t.length<=e?t:`${t.slice(0,e-1)}\u2026`}function Zd(n){return wy(n)===null}function Ty(n,e){return Math.min(e-.3,My,Math.max(1.4,n.length*.24+.5))}var Kd=(n,e,t,i)=>[n.a[0]+n.u[0]*e+n.n[0]*i,t,n.a[1]+n.u[1]*e+n.n[1]*i];function Jd(n,e,t=1024,i="#25372e"){let r=n.canvas?.height||by;n.fillStyle=/^#[a-f0-9]{6}$/i.test(i)?i:"#25372e",n.fillRect(0,0,t,r),n.fillStyle="#e7e5d9",n.textAlign="center",n.textBaseline="middle";let s=r*.75;for(n.font=`700 ${s}px Arial`;n.measureText(e).width>t*.84&&s>r*.1875;)s-=1,n.font=`700 ${s}px Arial`;n.fillText(e,t/2,r*.53)}function Ey(n,e,t,i,r){if(!Zd(n)||t.status==="conflict"||t.observation?.id!==n.id)return null;let s=Gs(e,i,t);if(!s||s.width<1.5||s.bottom>r+1.5)return null;let o=Math.min(2.35,3.5*.66),a=r+.55+o/2,l=a+o/2+.55/2+.05,c=$d(String(n.machineRoutingProposal.signText).trim()),h=Ty(c,s.width),p=s.width/2;return tn(s,p,l,h,.55)?{observationId:n.id,text:c,displayText:c,localPosition:Kd(s,p,l,.06),rotationY:Math.atan2(s.n[0],s.n[1]),width:h,height:.55,intervalWidth:s.width}:null}function jd(n,e,t,i,r){if(e.type!=="wall")return[];let s=Fr(e,n,r);if(!s||s.top-s.bottom<2.5)return[];let o=i.filter(u=>u.renderBuildingId===n.id&&u.renderSurfaceIndices?.includes(t)&&u.facadeDescription);if(o.length){let u=[];for(let f of o){let m=Xi(f,n,t,"ground");if(!m)continue;let v=Si(e,t,n.id,o.map(g=>({...g,effectiveProposal:{wholeUsable:"unknown"}})));for(let g of v.intervals){if(g.observation?.id!==f.id||g.status==="conflict")continue;let d=Gs(s,v.axis,g);if(!d)continue;let M=(d.a[0]-s.a[0])*s.u[0]+(d.a[1]-s.a[1])*s.u[1];for(let w of m.features){let x=Dr(w,m,f);!x||x.kind!=="fascia"||!x.text?.trim()||/[\u0000-\u001f\u007f]/.test(x.text)||!tn(d,x.t-M,x.y,x.width,x.height)||u.push({observationId:f.id,text:x.text.trim(),displayText:$d(x.text),localPosition:Kd(s,x.t,x.y,.09),rotationY:Math.atan2(s.n[0],s.n[1]),width:x.width,height:x.height,intervalWidth:d.width,physicalSignId:x.physicalSignId,colour:x.colour})}}}return u}let a=i.filter(u=>u.renderBuildingId===n.id&&Zd(u)&&Array.isArray(u.renderSurfaceIndices)&&u.renderSurfaceIndices.includes(t));if(!a.length)return[];let l=n.geometry.building.surfaces.filter(u=>u.type==="wall").flatMap(u=>u.rings[0].map(f=>f[1])),c=Number.isFinite(n.geometry.building.groundNAP)?Mi(n.geometry.building.groundNAP,n.geometry.frame.heightDatum):Math.min(...l),h=i.map(u=>({...u,effectiveProposal:Yd(u)?{wholeUsable:"unknown"}:null})),p=Si(e,t,n.id,h);return p.axis?a.flatMap(u=>p.intervals.map(f=>Ey(u,s,f,p.axis,c)).filter(Boolean)):[]}function Qd(n,e){let t=new Map;for(let i of n){let r=e.find(l=>l.id===i.observationId);if(!r)continue;let s=String(i.text??r.machineRoutingProposal?.signText??"").trim().toLocaleLowerCase("en"),o=JSON.stringify([r.images?.ground?.panoramaSha256??r.renderBuildingId,s,r.images?.ground?.date??r.images?.ground?.capturedAt,i.physicalSignId??null]),a=t.get(o);(!a||i.width>a.width||i.width===a.width&&i.observationId<a.observationId)&&t.set(o,i)}return[...t.values()]}function ef(n,e={}){if(!e.text?.trim())throw new Error("Source sign text is required");if(typeof document>"u")throw new Error("Facade sign material requires a browser canvas");let t=Math.min(e.width??512,512),i=Number.isFinite(e.aspectRatio)&&(e.aspectRatio??0)>0?e.aspectRatio:null,r=i?Math.max(8,Math.min(128,Math.round(t/i))):Math.min(e.height??128,128),s=document.createElement("canvas");s.width=t,s.height=r;let o=s.getContext("2d");if(!o)throw new Error("Unable to create sign canvas");o.fillStyle=e.background??"#242628",o.fillRect(0,0,t,r),o.fillStyle=e.colour??"#f3eee4";let a=e.font??`italic 700 ${Math.round(r*.45)}px Georgia, serif`,l=a.match(/(\d+(?:\.\d+)?)px/),c=Math.min(l?Number(l[1]):r*.45,r*.8),h=f=>l?a.replace(/\d+(?:\.\d+)?px/,`${Math.max(1,Math.round(f))}px`):`italic 700 ${Math.max(1,Math.round(f))}px Georgia, serif`;for(o.font=h(c);c>1&&o.measureText(e.text.trim()).width>t*.9;)c*=.9,o.font=h(c);o.textAlign="center",o.textBaseline="middle",o.fillText(e.text.trim(),t/2,r/2);let p=new n.CanvasTexture(s);return p.colorSpace=n.SRGBColorSpace??p.colorSpace,p.needsUpdate=!0,{material:new n.MeshBasicMaterial({map:p,transparent:!0,side:n.DoubleSide}),texture:p,canvas:s}}var qs={priorBrickRed:"#94553f",priorBrickBrown:"#73513f",priorBrickBuff:"#aa8d62",priorPlaster:"#c3b99e",priorModernLight:"#b6b8b0",priorModernGrey:"#858b87",roof:"#777b7b",priorRoofWarm:"#756b66",priorRoofDark:"#5f6565"};function Ur(n,e){let t=2166136261;for(let i of n)t^=i.charCodeAt(0),t=Math.imul(t,16777619);return e[(t>>>0)%e.length]}function tf(n,e){let t=Number(e),i=Number.isFinite(t)&&t<1925?Ur(n,["priorBrickRed","priorBrickBrown","priorBrickBrown","priorBrickBuff","priorPlaster"]):Number.isFinite(t)&&t<1965?Ur(n,["priorBrickRed","priorBrickBrown","priorBrickBuff","priorModernGrey"]):Ur(n,["priorBrickBuff","priorModernLight","priorModernGrey","priorPlaster"]),r=Ur(n,["roof","priorRoofWarm","priorRoofDark"]),s=Number.isFinite(t)&&t<1925?Ur(`${n}:ground`,["priorBrickBrown","priorBrickRed","priorRoofWarm"]):Ur(`${n}:ground`,["priorModernGrey","priorBrickBuff","priorRoofWarm"]);return{wallKey:i,roofKey:r,groundKey:s,wall:qs[i],roof:qs[r],ground:qs[s]}}var Ay={wall:"#c4c1b5",...qs,brown:"#876650",red:"#945c48",buff:"#bba681",grey:"#96938a",white:"#d8d4c3",black:"#57544e",auditedUsable:"#638774",auditedPartial:"#bd875b",...ol};function Ry(n){if(!Number.isFinite(n))throw new Error("Invalid vertex normal");let e=Math.max(-1,Math.min(1,n));return e<=-1?-128:Math.round(e*127)}function Cy(n){let e=n.getAttribute?.("normal");if(!e)return;let t=new Int8Array(e.count*e.itemSize);for(let i=0;i<t.length;i++)t[i]=Ry(e.array[i]);n.setAttribute("normal",new ss(t,e.itemSize,!0))}function Br(n){let e=n.map(c=>{if(!c.every(h=>h.length===3&&h.every(Number.isFinite)))throw new Error("Invalid source surface coordinate");return c.length>2&&c[0].every((h,p)=>Math.abs(h-c[c.length-1][p])<1e-8)?c.slice(0,-1):c.slice()});if(!e[0]||e[0].length<3)return[];if(e.slice(1).some(c=>c.length<3))throw new Error("Degenerate source hole");let t=e[0],i=new B;for(let c=0;c<t.length;c++){let h=t[c],p=t[(c+1)%t.length];i.x+=(h[1]-p[1])*(h[2]+p[2]),i.y+=(h[2]-p[2])*(h[0]+p[0]),i.z+=(h[0]-p[0])*(h[1]+p[1])}if(i.lengthSq()<1e-16)return[];let r=[Math.abs(i.x),Math.abs(i.y),Math.abs(i.z)],s=r.indexOf(Math.max(...r)),o=c=>new Ee(...c.filter((h,p)=>p!==s)),a=e.flat();return zi.triangulateShape(e[0].map(o),e.slice(1).map(c=>c.map(o))).flatMap(c=>{let[h,p,u]=c.map(m=>new B(...a[m]));return(p.sub(h).cross(u.sub(h)).dot(i)>=0?c:[c[0],c[2],c[1]]).flatMap(m=>a[m])})}function nf(n){let e=n.geometry.building,t=e.surfaces.flatMap(a=>a.rings.flatMap(l=>l.map(c=>c[1]))),i=t.length?Math.min(...t):Mi(e.groundNAP??.65,n.geometry.frame.heightDatum),r=t.length?Math.max(...t):i+(e.height??5),s=e.footprint.type==="Polygon"?[e.footprint.coordinates]:e.footprint.coordinates,o=[];for(let a of s){let l=a.map((c,h)=>{let p=c.slice(0,-1).reduce((u,f,m)=>u+f[0]*c[m+1][1]-c[m+1][0]*f[1],0);return(h===0?p>0:p<0)?[...c].reverse():c});o.push({type:"roof",rings:l.map(c=>c.map(([h,p])=>[h,r,p]))});for(let c of l)for(let h=0;h<c.length-1;h++){let p=c[h],u=c[h+1];o.push({type:"wall",rings:[[[p[0],i,p[1]],[u[0],i,u[1]],[u[0],r,u[1]],[p[0],r,p[1]]]]})}}return o}function Or(n,e,t){let i=e.geometry.frame.originRD,r=t.targetOriginRD,s=sl(0,e.geometry.frame.heightDatum,t.targetOffsetNAP??0);return n.map((o,a)=>a%3===0?o+i.x-r.x:a%3===1?o+s:o+r.y-i.y)}function Py(n,e,t){let i=e.geometry.frame.originRD,r=t.targetOriginRD,s=sl(0,e.geometry.frame.heightDatum,t.targetOffsetNAP??0);return[n[0]+i.x-r.x,n[1]+s,n[2]+r.y-i.y]}var Iy=new Vi(1,1);function Ly(n,e,t){let i=document.createElement("canvas");i.width=Math.min(512,Math.ceil(64*n.width/n.height)),i.height=64,Jd(i.getContext("2d"),n.displayText,i.width,n.colour);let r=new vr(i);r.colorSpace=Ut,r.generateMipmaps=!1,r.minFilter=It;let s=new Kn({map:r,side:bn}),o=new ft(Iy,s);return o.scale.set(n.width,n.height,1),o.position.set(...Py(n.localPosition,e,t)),o.rotation.y=n.rotationY,o.userData.machineSign=!0,o.userData.observationId=n.observationId,o.userData.featureKind="machine-sign-unreviewed",o.name="city-appearance-machine-sign",o}function rf(n){n.material?.map?.dispose?.(),n.material?.dispose?.()}function Dy(n){return n.flatMap(e=>e.observations.filter(t=>t.buildingId===e.id&&t.geometryRevision===e.geometryRevision&&t.evidenceKey&&t.payload?.evidenceKey===t.evidenceKey&&t.payload?.renderBuildingId===e.id&&t.payload?.effectiveProposal?.wholeUsable==="yes"&&t.payload?.visualReview?.fieldEligibility?.wallColour!==!1).map(t=>t.payload))}function Ny(n){return n.flatMap(e=>e.observations.filter(t=>t.buildingId===e.id&&t.geometryRevision===e.geometryRevision&&t.evidenceKey&&t.payload?.evidenceKey===t.evidenceKey&&t.payload?.renderBuildingId===e.id&&["usable","partial"].includes(t.payload?.agentSourceAudit?.disposition)).map(t=>t.payload))}function sf(n,e){let t=tf(n.id,n.geometry.building.year);return e==="roof"?t.roofKey:t.wallKey}function of(n){if(![n.targetOriginRD.x,n.targetOriginRD.y,n.targetOffsetNAP??0].every(Number.isFinite))throw new Error("Invalid target RD/NAP origin");return e=>{let t=new Set;for(let T of e){let A=T.geometry?.frame;if(t.has(T.id)||T.geometry?.building?.id!==T.id||!A||A.axes!=="x=east,y=up,z=south"||!["legacy-block-NAP-minus-0.65m","NAP"].includes(A.heightDatum)||![A.originRD.x,A.originRD.y].every(Number.isFinite))throw new Error(`Unsupported or duplicate source frame: ${T.id}`);t.add(T.id)}let i=new Yt;i.name="city-appearance-owned-tile",i.userData.buildingIds=[...t],i.userData.experimentalWallColours=n.experimentalWallColours===!0,i.userData.proceduralFacades=n.proceduralFacades===!0,i.userData.facadeStyleSource="Registered source features retain per-feature evidence disposition; legacy and contextual rhythms remain explicit procedural priors.";let r=new Map,s=new Map(e.map(T=>[T.id,"facade"])),o=new Map,a=new Map,l=n.experimentalWallColours?Dy(e):n.auditCoverage?Ny(e):[],c=n.proceduralFacades||n.observedFacades!==!1?al(e):[],h=n.machineSigns===!0?al(e):[],p=new Yt;p.name="city-appearance-machine-signs";let u=[],f=n.machineSigns===!0,m=!1,v=!1,g=(T,A,P=!1,D=null)=>({buildingId:T.id,geometryRevision:T.geometryRevision,sourceSurfaceIndex:A,observationId:D,approximateMassing:P});for(let T of e){let A=!T.geometry.building.surfaces.length,P=A?nf(T):T.geometry.building.surfaces,D=[],N=[];P.forEach((L,U)=>{let G=Br(L.rings),Z=n.contextualPalette?sf(T,L.type):L.type==="roof"?"roof":"wall",K={triangles:Or(G,T,n),colour:Z,identity:g(T,A?null:U,A)};D.push(K);let ne=!A&&L.type==="wall"&&(n.experimentalWallColours||n.auditCoverage)?Si(L,U,T.id,l):null;if(!ne?.axis){N.push(K);return}for(let ce of ne.intervals){let Ae=ce.observation?.effectiveProposal?.wallColour,Re=ce.observation?.agentSourceAudit?.disposition,$=n.auditCoverage&&Re==="usable"?"auditedUsable":n.auditCoverage&&Re==="partial"?"auditedPartial":["brown","red","buff","grey","white","black"].includes(Ae)?Ae:null;N.push({triangles:Or(Rd(G,ne.axis,ce.startM,ce.endM),T,n),colour:$??Z,identity:g(T,U,!1,$?ce.observation.id:null)})}});let F=n.experimentalWallColours||n.auditCoverage?N.slice():D.slice();a.set(T.id,D.flatMap(L=>L.triangles)),(n.proceduralFacades||n.contextualFacades||n.observedFacades!==!1)&&!A&&P.forEach((L,U)=>{let G=Wd(T,L,U,c,e,{procedural:n.proceduralFacades,contextual:n.contextualFacades,reviewedAwnings:n.reviewedAwnings,observed:n.observedFacades,candidateRegistrationPreview:n.candidateRegistrationPreview===!0});for(let Z of G){let K=Z.sign,ne=K&&K.text&&K.physicalSignId&&Array.isArray(K.uv)?{sign:K}:{};Z.featureKind.startsWith("observed-")&&(Z.featureKind==="observed-material"||Z.featureKind==="observed-awning"&&!K||Z.colour==="doorWood"||Z.colour==="windowGlass")&&F.push({triangles:Or(Z.triangles,T,n),colour:Z.colour,identity:{...g(T,U,!1,Z.observationId),featureId:Z.featureId,featureKind:Z.featureKind,styleSource:Z.styleSource}}),N.push({triangles:Or(Z.triangles,T,n),colour:Z.colour,material:Z.material,...ne,identity:{...g(T,U,!1,Z.observationId),featureId:Z.featureId,featureKind:Z.featureKind,styleSource:Z.styleSource,...Z.previewOnly?{previewOnly:!0}:{}}}),ne.sign&&F.push({triangles:Or(Z.triangles,T,n),colour:Z.colour,sign:ne.sign,identity:{...g(T,U,!1,Z.observationId),featureId:Z.featureId,featureKind:Z.featureKind,styleSource:Z.styleSource}})}}),h.length&&!A&&P.forEach((L,U)=>{for(let G of jd(T,L,U,h,e))u.push({owner:T,placement:G})});let k=nf(T).map(L=>({triangles:Or(Br(L.rings),T,n),colour:n.contextualPalette?sf(T,L.type):L.type==="roof"?"roof":"wall",identity:g(T,null,!0)}));o.set(T.id,{facade:F,detail:N,massing:k})}let d=Qd(u.map(T=>({...T.placement,item:T})),h);u.splice(0,u.length,...d.map(T=>T.item));let M=new Kn({color:"#f2c14e",transparent:!0,opacity:.24,depthWrite:!1,side:Et,polygonOffset:!0,polygonOffsetFactor:-2}),w=new Map,x=null,R=null;function b(){let T=new Map(u.map((A,P)=>[String(P),A]).filter(([,A])=>f&&!m&&s.get(A.owner.id)==="detail"));for(let A of[...p.children]){let P=A.userData.placementKey;if(T.has(P)){T.delete(P);continue}p.remove(A),rf(A)}for(let[A,{owner:P,placement:D}]of T){let N=Ly(D,P,n);N.userData.placementKey=A,p.add(N)}}n.machineSigns===!0&&(i.add(p),p.visible=f,b());function C(){R&&(i.remove(R),R.geometry.dispose(),R=null);let T=x?a.get(x):null;if(!T?.length||m)return;let A=new Tt;A.setAttribute("position",new it(T,3)),A.computeBoundingBox(),A.computeBoundingSphere(),R=new ft(A,M),R.name="city-appearance-selection",R.renderOrder=6,R.userData.runtimeSelection=!0,R.raycast=()=>{},i.add(R)}function _(){if(v=!1,m)return;let T=new Map,A=new Map;for(let D of e)for(let N of o.get(D.id)[s.get(D.id)]){if(!N.triangles.length)continue;if(N.sign){let L=`${N.sign.physicalSignId}:${N.sign.text}:${N.sign.background}:${N.sign.colour}:${N.sign.font??""}`,U=A.get(L)??{descriptor:N.sign,positions:[],uvs:[],identities:[]};U.positions.push(...N.triangles),U.uvs.push(...N.sign.uv);for(let G=0;G<N.triangles.length/9;G++)U.identities.push(N.identity);A.set(L,U);continue}let F=`${N.material??"flat"}:${N.colour}`,k=T.get(F)??{colour:N.colour,material:N.material,positions:[],identities:[]};for(let L of N.triangles)k.positions.push(L);for(let L=0;L<N.triangles.length/9;L++)k.identities.push(N.identity);T.set(F,k)}let P=[];for(let[D,N]of T){let F=N.colour;if(!r.has(D)){let U=F.startsWith("#")?F:Ay[F];r.set(D,N.material==="brick"?Ed({MeshStandardMaterial:Sn,DoubleSide:Et},U):new Sn({color:U,roughness:.9,side:Et}))}let k=new Tt;k.setAttribute("position",new it(N.positions,3)),k.computeVertexNormals(),Cy(k),k.computeBoundingBox(),k.computeBoundingSphere();let L=new ft(k,r.get(D));L.name=`city-appearance-${F}`,L.userData.triangleIdentities=N.identities,L.castShadow=n.castShadows!==!1,L.receiveShadow=!1,P.push(L)}for(let[D,N]of A){let F=w.get(D);F||(F=ef({CanvasTexture:vr,MeshBasicMaterial:Kn,DoubleSide:Et,SRGBColorSpace:Ut},N.descriptor),w.set(D,F));let k=new Tt;k.setAttribute("position",new it(N.positions,3)),k.setAttribute("uv",new it(N.uvs,2));let L=new ft(k,F.material);L.name=`city-appearance-source-sign-${N.descriptor.physicalSignId}`,L.userData.triangleIdentities=N.identities,L.userData.sourceSign=!0,P.push(L)}for(let D of[...i.children])D!==R&&D!==p&&D.geometry&&(i.remove(D),D.geometry.dispose(),D.userData.sourceSign);for(let D of P)i.add(D);for(let[D,N]of w)A.has(D)||(N.material.dispose(),N.texture.dispose(),w.delete(D));C(),b()}let E={group:i,flush:_,setSelected(T){if(!m){if(T!==null&&!t.has(T)){x=null,C();return}x!==T&&(x=T,C())}},setLod(T,A){if(!m){if(!t.has(T)||!["massing","facade","detail"].includes(A))throw new Error(`Unknown building or LOD: ${T}`);s.get(T)!==A&&(s.set(T,A),v||(v=!0,queueMicrotask(()=>{v&&_()})))}},setMachineSignsVisible(T){m||f===T||(f=T,T&&!p.parent&&(i.add(p),b()),p.visible=T,b())},pick(T,A){return m||!i.children.includes(T)||!Number.isInteger(A)||A<0?null:T.userData.triangleIdentities?.[A]??null},get stats(){let T=new Map,A=new Set;for(let U of i.children)for(let G of U.userData.triangleIdentities??[])G.featureId&&G.featureKind&&T.set(G.featureId,G.featureKind),G.featureKind==="shopfront-prior"&&G.observationId&&A.add(G.observationId);let P=U=>[...T.values()].filter(G=>G===U).length,D=i.children.flatMap(U=>U===p&&p.parent?U.children:[U]).filter(U=>U.isMesh&&!U.userData.runtimeSelection),N=new Set,F=new Set;for(let U of D){for(let G of Object.values(U.geometry.attributes)){let Z=G.array??G.data?.array;Z?.buffer&&N.add(Z.buffer)}U.geometry.index?.array?.buffer&&N.add(U.geometry.index.array.buffer);for(let G of Array.isArray(U.material)?U.material:[U.material])for(let Z of Object.values(G??{}))Z?.isTexture&&F.add(Z)}let k=[...N].reduce((U,G)=>U+G.byteLength,0),L=[...F].reduce((U,G)=>{let Z=G.image;return U+Math.ceil((Z?.width??0)*(Z?.height??0)*4*(G.generateMipmaps?4/3:1))},0);return{geometryBufferBytes:k,textureBytes:L,buildings:t.size,meshes:D.length,triangles:D.reduce((U,G)=>U+G.geometry.getAttribute("position").count/3,0),windows:P("window-prior")+P("contextual-window-prior")+P("observed-window"),doors:P("contextual-door-prior")+P("observed-door"),storefronts:A.size,storefrontPatches:P("shopfront-prior"),awnings:P("reviewed-awning-prior")+P("observed-awning"),signs:P("observed-sign"),machineSigns:p.children.length,disposed:m}},dispose(){if(!m){m=!0,n.parent.remove(i);for(let T of[...p.children])p.remove(T),rf(T);for(let T of[...i.children])i.remove(T),T!==p&&T.geometry&&T.geometry.dispose();for(let T of r.values())T.dispose();for(let{material:T,texture:A}of w.values())A.dispose(),T.dispose();R=null,M.dispose(),r.clear(),o.clear(),a.clear(),s.clear()}}};return _(),n.parent.add(i),E}}var Fy="inventory-crown-priors/v1",qi=n=>"https://www.vdberk.com/trees/"+n+"/",Uy=[[/^platanus (?:hispanica|acerifolia) 'tremonia'$/,"pyramidal","cultivar-prior",qi("platanus-hispanica-tremonia")],[/^platanus (?:hispanica|acerifolia)$/,"rounded","species-prior",qi("platanus-hispanica")],[/^ulmus 'new horizon'$/,"pyramidal","cultivar-prior",qi("ulmus-new-horizon")],[/^ulmus 'dodoens'$/,"pyramidal","cultivar-prior","https://www.vdberk.nl/bomen/Ulmus-Dodoens/"],[/^ulmus hollandica 'vegeta'$/,"pyramidal","cultivar-prior",qi("ulmus-hollandica-vegeta")],[/^ulmus 'clusius'$/,"upright-oval","cultivar-prior",qi("ulmus-clusius")],[/^ulmus glabra$/,"upright-oval","species-prior",qi("ulmus-glabra")],[/^ginkgo biloba$/,"upright-oval","species-prior","https://www.rhs.org.uk/plants/7990/ginkgo-biloba/details"],[/^(?:cupressocyparis|cuprocyparis|cupressus) leylandii$/,"conical-evergreen","species-prior","https://www.rhs.org.uk/plants/321515/cupressus-%C3%97-leylandii/details"],[/^prunus serrulata 'kanzan'$/,"vase","cultivar-prior",qi("prunus-serrulata-kanzan")]];function Oy(n){return String(n||"").toLowerCase().replace(/[’‘`]/g,"'").replace(/×/g," ").replace(/\bx\s+/g,"").replace(/\s+/g," ").trim()}function By(n){let e=2166136261;for(let t of String(n??""))e=Math.imul(e^t.charCodeAt(0),16777619);return(e>>>0)/4294967296}function af(n){let e=String(n.type||"").trim().toLowerCase();if(e==="stobbe")return null;let t=Oy(n.species),i=Uy.find(([g])=>g.test(t)),r=e==="gekandelaberde boom",s=r?"candelabra-pruned":i?.[1]||"rounded",o=Number.isFinite(n.height)&&n.height>0&&n.height<=60,a=o?n.height:9,l=/\d/.test(String(n.heightClass||"")),c=o&&l?"inventory-height-class-proxy":"authored-height-fallback",h=a,p=Math.max(1.3,h*.22),u=.96+By(n.id)*.04,f=p*u,m=(g,d,M,w,x,R,b)=>({offset:[g,d,M],scale:[w,x,R],tone:b}),v;return s==="pyramidal"?v=[m(0,h*.65,0,f*.84,h*.19,f*.78,2),m(0,h*.8,0,f*.62,h*.16,f*.59,0),m(0,h*.9,0,f*.34,h*.1,f*.34,1)]:s==="upright-oval"?v=[m(0,h*.73,0,f*.8,h*.27,f*.72,0),m(-f*.28,h*.68,f*.14,f*.51,h*.22,f*.48,1),m(f*.25,h*.65,-f*.12,f*.5,h*.23,f*.48,2)]:s==="conical-evergreen"?v=[m(0,h*.55,0,f*.7,h*.24,f*.7,2),m(0,h*.74,0,f*.49,h*.19,f*.49,0),m(0,h*.9,0,f*.25,h*.1,f*.25,1)]:s==="vase"?v=[m(0,h*.65,0,f*.6,h*.19,f*.58,2),m(-f*.4,h*.84,0,f*.7,h*.16,f*.75,0),m(f*.4,h*.84,0,f*.7,h*.16,f*.75,1)]:s==="candelabra-pruned"?v=[m(0,h*.85,0,f*.43,h*.15,f*.5,0),m(-f*.5,h*.82,0,f*.36,h*.14,f*.4,1),m(f*.5,h*.82,0,f*.36,h*.14,f*.4,2)]:v=[m(0,h*.76,0,f,h*.24,f*.88,0),m(-f*.48,h*.72,f*.25,f*.65,h*.18,f*.67,1),m(f*.44,h*.7,-f*.23,f*.66,h*.22,f*.65,2)],{version:Fy,id:n.id,position:[...n.position],height:a,archetype:s,lobes:v,trunkHeight:h*(r?.78:.6),trunkWidth:.35,provenance:{position:"municipal inventory",height:c,heightClass:n.heightClass??null,crownBasis:r?"explicit-inventory-management":i?.[2]||"authored-fallback",reference:r?null:i?.[3]||null,species:n.species??null,type:n.type??null,measuredCrown:!1,note:"Shape, width, clearance and summer foliage are authored priors. Not freely growing does not imply pollarding; age, pruning and actual crown extent are unverified."}}}function Qc(n,e={}){if(!Array.isArray(n.bounds)||n.bounds.length!==4||!n.bounds.every(Number.isFinite))throw Error("Missing area display bounds");let t=new Yt,i=new Map,r=new Map,s=b=>(i.has(b)||i.set(b,b==="#709d98"?new xs({color:b,roughness:.24,metalness:.04,clearcoat:.72,clearcoatRoughness:.2,side:Et}):new Sn({color:b,roughness:.95,side:Et})),i.get(b)),o=(b,C)=>{let _=r.get(b)||[];for(let E of C)_.push(E);r.set(b,_)},a=(b,C,_)=>{let E=b.geometry;if(!(!E||!["MultiPolygon","Polygon"].includes(E.type)))for(let T of E.type==="Polygon"?[E.coordinates]:E.coordinates)o(_,Br(T.map(A=>A.map(P=>[P[0],C,P[1]]))))},l=0,c=0,h=b=>{let C=b.geometry;if(!C||!["LineString","MultiLineString"].includes(C.type))return;c++;let _=C.type==="LineString"?[C.coordinates]:C.coordinates;for(let E of _)for(let T=1;T<E.length;T++){let A=E[T-1],P=E[T];o("#817a6b",[A[0],.02,A[1],P[0],.02,P[1],P[0],.55,P[1],A[0],.02,A[1],P[0],.55,P[1],A[0],.55,A[1]])}},p=b=>{let C=b.geometry;if(!(!C||!["MultiPolygon","Polygon"].includes(C.type))){l++;for(let _ of C.type==="Polygon"?[C.coordinates]:C.coordinates){o("#bcbdb0",Br(_.map(E=>E.map(T=>[T[0],.12,T[1]]))));for(let E of _)for(let T=1;T<E.length;T++){let A=E[T-1],P=E[T];o("#8f9188",[A[0],.12,A[1],P[0],.12,P[1],P[0],-.18,P[1],A[0],.12,A[1],P[0],-.18,P[1],A[0],-.18,A[1]])}}}},[u,f,m,v]=n.bounds;e.includeBase!==!1&&o("#d5d4c6",Br([[[u,-.6,f],[u,-.6,v],[m,-.6,v],[m,-.6,f]]]));for(let b of n.layers?.onbegroeidterreindeel||[])a(b,-.35,b.kind==="erf"?"#c4c7b1":"#d5d3c2");for(let b of n.layers?.begroeidterreindeel||[])a(b,-.25,"#a5b68d");for(let b of n.layers?.waterdeel||[])a(b,-.2,"#709d98");for(let b of n.layers?.overbruggingsdeel||[])p(b);for(let b of n.layers?.scheiding_lijn||[])["kademuur","walbescherming"].includes(b.kind)&&h(b);for(let b of[...n.layers?.ondersteunendwegdeel||[],...n.layers?.wegdeel||[]]){let C=/voet/.test(b.kind),_=b.kind==="fietspad";a(b,C?.14:.06,C?"#d1cbbb":_?"#aa7c66":b.surface==="open verharding"?"#ab9780":"#9a9f95")}for(let[b,C]of r){if(!C.length)continue;let _=new Tt;_.setAttribute("position",new it(C,3)),_.computeVertexNormals();let E=new ft(_,s(b));E.receiveShadow=!0,t.add(E)}let g=[],d=[[],[],[]],M=new Bt,w=0;for(let b of n.trees||[]){let C=af(b);if(C){w++,g.push({position:[C.position[0],C.trunkHeight/2+.1,C.position[1]],scale:[C.trunkWidth,C.trunkHeight,C.trunkWidth]});for(let _ of C.lobes)d[_.tone].push({position:[C.position[0]+_.offset[0],_.offset[1]+.1,C.position[1]+_.offset[2]],scale:_.scale})}}function x(b,C,_){if(!b.length){C.dispose();return}let E=new us(C,s(_),b.length);b.forEach((T,A)=>{M.position.set(...T.position),M.scale.set(...T.scale),M.updateMatrix(),E.setMatrixAt(A,M.matrix)}),E.instanceMatrix.needsUpdate=!0,E.castShadow=!0,t.add(E)}x(g,new fs(.5,.5,1,6),"#827c61");for(let b=0;b<3;b++)x(d[b],new _s(1,1),["#9dab78","#acb989","#899b68"][b]);let R=!1;return{group:t,stats:{trees:w,bridges:l,boundaries:c,meshes:t.children.length},dispose(){if(!R){R=!0,t.removeFromParent();for(let b of[...t.children])b.isInstancedMesh&&b.dispose(),b.geometry.dispose(),t.remove(b);for(let b of i.values())b.dispose();i.clear()}}}}var ll={x:155e3,y:463e3},lf=52.1551744,cf=5.38720621,ky=[[0,1,3235.65389],[2,0,-32.58297],[0,2,-.2475],[2,1,-.84978],[0,3,-.0655],[2,2,-.01709],[1,0,-.00738],[4,0,.0053],[2,3,-39e-5],[4,1,33e-5],[1,1,-12e-5]],zy=[[1,0,5260.52916],[1,1,105.94684],[1,2,2.45656],[3,0,-.81885],[1,3,.05594],[3,1,-.05607],[0,1,.01199],[3,2,-.00256],[1,4,.00128],[0,2,22e-5],[2,0,-22e-5],[3,4,26e-5]],Vy=[[0,1,190094.945],[1,1,-11832.228],[2,1,-114.221],[0,3,-32.391],[1,0,-.705],[3,1,-2.34],[1,3,-.608],[0,2,-.008],[2,3,.148]],Gy=[[1,0,309056.544],[0,2,3638.893],[2,0,73.077],[1,2,-157.984],[3,0,59.788],[0,1,.433],[2,2,-6.439],[1,1,-.032],[0,4,.092],[1,4,-.054]],cl={east:.183,north:.234},eu=111320,uf=n=>eu*Math.cos(n*Math.PI/180),ul=(n,e,t)=>n.reduce((i,[r,s,o])=>i+o*e**r*t**s,0);function Ys({x:n,y:e}){let t=(n-ll.x)*1e-5,i=(e-ll.y)*1e-5,r=lf+ul(ky,t,i)/3600-cl.north/eu;return[cf+ul(zy,t,i)/3600-cl.east/uf(r),r]}function tu([n,e]){let t=e+cl.north/eu,i=n+cl.east/uf(t),r=.36*(t-lf),s=.36*(i-cf);return{x:ll.x+ul(Vy,r,s),y:ll.y+ul(Gy,r,s)}}var nu=(n,e)=>n[0]*e[1]-n[1]*e[0],hf=(n,e)=>[n[0]-e[0],n[1]-e[1]],ff=n=>n?.type==="MultiPolygon"?n.coordinates:n?.type==="Polygon"?[n.coordinates]:[];function df(n,e){let t=!1;for(let i=0,r=e.length-1;i<e.length;r=i++){let s=e[i],o=e[r];s[1]>n[1]!=o[1]>n[1]&&n[0]<(o[0]-s[0])*(n[1]-s[1])/(o[1]-s[1])+s[0]&&(t=!t)}return t}function Hy(n,e){return ff(e.footprint).some(t=>df(n,t[0])&&!t.slice(1).some(i=>df(n,i)))}function Wy(n,e,t,i,{sourceBuildingId:r,sourceBoundaryToleranceM:s=0}={}){let o=null;for(let a of t){let l=[0,i];for(let c of ff(a.footprint).flat())for(let h=0;h<c.length;h++){let p=c[h],u=c[(h+1)%c.length],f=hf(u,p),m=hf(p,n),v=nu(e,f);if(Math.abs(v)<1e-9)continue;let g=nu(m,f)/v,d=nu(m,e)/v;g>0&&g<i&&d>=-1e-8&&d<=1+1e-8&&l.push(g)}l.sort((c,h)=>c-h);for(let c=1;c<l.length;c++){if(l[c]-l[c-1]<1e-7||a.id===r&&l[c-1]<1e-7&&l[c]<=s)continue;let h=(l[c]+l[c-1])/2,p=[n[0]+e[0]*h,n[1]+e[1]*h];if(Hy(p,a)&&(!o||l[c-1]<o.distanceM)){o={buildingId:a.id,distanceM:l[c-1]};break}}}return o}function hl(n,e,t,i=95){if(!Number.isFinite(e)||e<=0||!Number.isFinite(t)||t<=0)throw Error("Positive camera aspect and radius required");let r=2*Math.atan(Math.max(n.height*.65,n.wallWidthM*.65/e)/t)*180/Math.PI;return{fov:Math.min(i,Math.max(38,r)),wholeFacadeFits:r<=i}}function pf(n,e,t,{desiredRadius:i=21,clearanceM:r=1.5,maxFov:s=95}={}){if(!Number.isFinite(t)||t<=0)throw Error("Positive camera aspect required");let o=Math.hypot(...n.normal);if(!o)throw Error("Nonzero frontage normal required");let a=n.normal.map(v=>v/o),l=1.4,c=[n.mid[0],Math.min(12,n.height*.5),n.mid[1]],h=i*Math.sin(l),p=Wy(n.mid,a,e,h+r,{sourceBuildingId:n.buildingId,sourceBoundaryToleranceM:.25}),u=p?Math.min(h,Math.max(0,p.distanceM-r)):h;if(u<.8)return{version:1,usable:!1,reason:"No clear outward camera position on this wall normal",obstruction:p,target:c};let f=u/Math.sin(l),m=hl(n,t,f,s);return{version:1,usable:!0,target:c,radius:f,theta:Math.atan2(a[0],a[1]),phi:l,...m,position:[c[0]+a[0]*u,c[1]+f*Math.cos(l),c[2]+a[1]*u],constrained:f<i-1e-6,obstruction:p,clearanceM:r,scope:"Initial source-wall framing; conservative footprint geometry only. Trees, overhangs and manual orbit are not collision-tested."}}function mf(n,e,{marginM:t=2,maxExtensionM:i=10}={}){let r=[...n],s=a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite);for(let a of e)for(let l of[a.localStart,a.localEnd])s(l)&&(r[0]=Math.min(r[0],Math.floor(l[0]-t)),r[1]=Math.min(r[1],Math.floor(l[1]-t)),r[2]=Math.max(r[2],Math.ceil(l[0]+t)),r[3]=Math.max(r[3],Math.ceil(l[1]+t)));r[0]=Math.max(r[0],n[0]-i),r[1]=Math.max(r[1],n[1]-i),r[2]=Math.min(r[2],n[2]+i),r[3]=Math.min(r[3],n[3]+i);let o=e.filter(a=>[a.localStart,a.localEnd].some(l=>!s(l)||l[0]<r[0]||l[0]>r[2]||l[1]<r[1]||l[1]>r[3])).map(a=>a.id);return{sourceBounds:[...n],bounds:r,marginM:t,maxExtensionM:i,clippedFrontageIds:o,source:"display-only existing-frontage coverage; no new data acquisition"}}var oe=n=>document.getElementById(n),Vn=new URLSearchParams(location.search),bt=Vn.get("area")==="expansion",$s=Vn.get("release");if($s&&!/^[a-f0-9]{64}$/.test($s))throw Error("Invalid immutable release ID");var Xy=$s?`/data/${bt?"city-expansion":"city-appearance"}/releases/${$s}/manifest.json`:bt?"/data/city-expansion/current.json":"/data/city-appearance/current.json",Jt=n=>oe(n).checked,Zs=oe("scene"),Ks=oe("stage"),nn=new rs;nn.background=new ke("#e9e9df");nn.fog=new is("#e9e9df",260,850);var Ct=new Ka({canvas:Zs,antialias:!0,powerPreference:"high-performance"}),qy=Math.min(devicePixelRatio,1.5),kr=qy,lu=0,iu=[],ru=0;Ct.setPixelRatio(kr);Ct.outputColorSpace=Ut;Ct.shadowMap.enabled=!0;Ct.shadowMap.type=na;Ct.toneMapping=Rs;Ct.toneMappingExposure=1.05;nn.add(new Ms("#fbfff5","#87948b",1.75));var Rn=new ws("#fff0d8",3);Rn.position.set(-130,240,90);Rn.castShadow=!0;Rn.shadow.mapSize.set(2048,2048);Rn.shadow.camera.left=-340;Rn.shadow.camera.right=340;Rn.shadow.camera.top=340;Rn.shadow.camera.bottom=-340;Rn.shadow.camera.near=40;Rn.shadow.camera.far=650;Rn.shadow.bias=-15e-5;nn.add(Rn);var Be=new Ht(38,1,.2,9e3),Ve=new el(Be,Zs);Ve.enableDamping=!0;Ve.dampingFactor=.09;Ve.minDistance=.8;Ve.maxDistance=6e3;Ve.maxPolarAngle=Math.PI*.49;Ve.target.set(0,5,-8);Be.position.set(160,210,230);Ve.update();function zr(n){Vr=n,oe("navigation-orbit")?.setAttribute("aria-pressed",String(n==="orbit")),oe("navigation-explore")?.setAttribute("aria-pressed",String(n==="explore")),Ve.enableRotate=n==="orbit"||n==="explore",Ve.enablePan=n==="explore"}function vf(n,e){document.querySelectorAll(`button[data-${n}]`).forEach(t=>t.setAttribute("aria-pressed",String(t.dataset[n]===e)))}var du="ground",_l="ground";function bf(n){du=n,vf("source-tier",n)}function fu(n){_l=n,vf("camera-preset",n);let e=En?$i().find(t=>t.id===En):null;if(n==="ground"?Be.fov=38:n==="front"?Be.fov=34:Be.fov=48,e&&Gn){let t=hl(e,Be.aspect,Math.max(16,Be.position.distanceTo(Ve.target)));Number.isFinite(t.fov)&&(Be.fov=t.fov)}Be.updateProjectionMatrix(),Ve.update(),Xt=!0}function Yy(){return`cam=${Be.position.x.toFixed(2)},${Be.position.y.toFixed(2)},${Be.position.z.toFixed(2)}|${Ve.target.x.toFixed(2)},${Ve.target.y.toFixed(2)},${Ve.target.z.toFixed(2)}|${Be.fov.toFixed(2)}`}function pu(){if(!se?.context?.origin)return;let[n,e]=Ys({x:se.context.origin.x+Be.position.x,y:se.context.origin.y-Be.position.z}),t=oe("location-label");t&&(t.textContent=`${e.toFixed(6)}, ${n.toFixed(6)}`);let i=oe("location-map-link");i instanceof HTMLAnchorElement&&se?.context?.origin&&(i.href=`https://www.openstreetmap.org/?mlat=${e}&mlon=${n}#map=19/${e}/${n}`)}function Mf(n){let e=n??new URLSearchParams(location.search).get("camera");if(!e||!se||!e.includes("|"))return;let[t,i,r]=e.split("|"),s=c=>c?.split(",").map(Number),o=s(t),a=s(i),l=parseFloat(r||"");o&&o.length===3&&o.every(c=>Number.isFinite(c))&&Be.position.set(o[0],o[1],o[2]),a&&a.length===3&&a.every(c=>Number.isFinite(c))&&Ve.target.set(a[0],a[1],a[2]),Number.isFinite(l)&&l>1&&l<120&&(Be.fov=l),Xt=!0}function $y(){return new URLSearchParams({...Object.fromEntries(Vn),camera:Yy(),sourceTier:du,cameraPreset:_l}).toString()}var se=null,En=null,Yi=null,An="overview",dl=!1,mu=!1,Gn=null,Ai=null,Zy=0,gn=!1,mn=0,cu=0,uu=0,hu=null,gf=0,Xt=!0,_f=0,pl=null,su=!1,Vr="orbit",Qe={forward:!1,backward:!1,left:!1,right:!1,turnLeft:!1,turnRight:!1,fast:!1},Ei=0,Ky=()=>2*Math.atan(Math.tan(38*Math.PI/360)/Math.min(1,Be.aspect))*180/Math.PI,ml=(n,e=!1)=>{oe("release-status").textContent=n,oe("release-status").classList.toggle("error",e)},Jy=async n=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",n))].map(e=>e.toString(16).padStart(2,"0")).join("");async function ou(n,e,t){let i=Array.isArray(e)?e:[e];if(!i.length||i.some(l=>!/^[a-f0-9]{64}$/.test(l)))throw Error("Missing source hash");let r=new URL(n,location.href);if(r.origin!==location.origin)throw Error("Release data must be same-origin");let s=await fetch(r,{signal:t});if(!s.ok)throw Error(`Source HTTP ${s.status}`);let o=await s.arrayBuffer();if(!i.includes(await Jy(o)))throw Error("Source hash mismatch; previous release retained");let a=new Uint8Array(o);if(a[0]===31&&a[1]===139){let l=new Blob([a]).stream().pipeThrough(new DecompressionStream("gzip"));return JSON.parse(await new Response(l).text())}return JSON.parse(new TextDecoder().decode(a))}function jy(n){let e=[],t=[];for(let s of n){if(!s.footprint)continue;let o=new ke(s.colour),a=Math.max(.1,s.height),l=s.footprint.type==="Polygon"?[s.footprint.coordinates]:s.footprint.coordinates,c=(h,p,u)=>{e.push(...h,...p,...u);for(let f=0;f<3;f++)t.push(o.r,o.g,o.b)};for(let h of l){let p=h.map(f=>f.slice(0,-1).map(m=>new Ee(m[0],m[1]))),u=p.flat();for(let[f,m,v]of zi.triangulateShape(p[0],p.slice(1)))c([u[f].x,a,u[f].y],[u[v].x,a,u[v].y],[u[m].x,a,u[m].y]);for(let f of p)for(let m=0;m<f.length;m++){let v=f[m],g=f[(m+1)%f.length];c([v.x,0,v.y],[g.x,a,g.y],[g.x,0,g.y]),c([v.x,0,v.y],[v.x,a,v.y],[g.x,a,g.y])}}}let i=new Tt;i.setAttribute("position",new it(e,3)),i.setAttribute("color",new it(t,3)),i.computeVertexNormals();let r=new ft(i,new ys({vertexColors:!0,side:Et}));return r.name="complete-source-footprint-overview",r}function gu(n){let[e,t]=Ys({x:n.origin.x+Be.position.x,y:n.origin.y-Be.position.z}),i=Math.min(900,Math.max(110,Be.position.distanceTo(Ve.target)*1.1)),[r,s]=Ys({x:n.origin.x+Ve.target.x-i,y:n.origin.y-Ve.target.z-i}),[o,a]=Ys({x:n.origin.x+Ve.target.x+i,y:n.origin.y-Ve.target.z+i});return{longitude:e,latitude:t,bounds:{west:r,south:s,east:o,north:a}}}function $i(){return se?[...se.owners.values()].flatMap(n=>n.observations.map(e=>e.payload)).sort((n,e)=>String(n.street??"").localeCompare(String(e.street??""))||n.mid[1]-e.mid[1]||n.id.localeCompare(e.id)):[]}function Sf(){return se?[...se.owners.values()].map(n=>n.geometry.building):[]}function Qy(){let n=oe("street-labels");if(n.replaceChildren(),!bt||!se)return;let e=new Map;for(let i of Sf()){if(!i.street||!Array.isArray(i.center))continue;let r=e.get(i.street)??{x:0,z:0,n:0};r.x+=i.center[0],r.z+=i.center[1],r.n++,e.set(i.street,r)}let t=[...e].sort((i,r)=>r[1].n-i[1].n||i[0].localeCompare(r[0])).slice(0,14);se.streetNames=t.map(([i])=>i),se.streetLabels=t.map(([i,r])=>{let s=document.createElement("span");return s.className="street-label",s.textContent=i,n.append(s),{name:i,element:s,position:new B(r.x/r.n,2,r.z/r.n)}})}function ev(){if(!se)return;let n=oe("building-options");n.replaceChildren();for(let e of se.owners.values()){let t=e.geometry.building,i=document.createElement("option");i.value=e.id,i.label=[t.id,t.street,t.addresses?.[0]].filter(Boolean).join(" \xB7 "),n.append(i)}}function wf(n){let e=n.trim();if(!e)return;let t=se?.owners.get(e);if(t){Ri(t.id);let s=xf(t);s&&(Ve.target.set(s[0],s[1],s[2]),Be.position.set(s[0]-10,s[1]+8,s[2]+10),Xt=!0,Gn=null,An="manual",Zi(se),gl());return}let i=e.toLowerCase(),r=[...se?.owners.values()??[]].find(s=>{let o=s.geometry.building;return String(o.street||"").toLowerCase().includes(i)||String(o.id||"").toLowerCase().includes(i)||o.addresses?.some(a=>a.toLowerCase().includes(i))});if(r){Ri(r.id);let s=xf(r);s&&(Ve.target.set(s[0],s[1],s[2]),Be.position.set(s[0]-10,s[1]+8,s[2]+10),Xt=!0,Gn=null,An="manual",Zi(se),gl());return}oe("view-label").textContent=`No building matched ${e}.`}function xf(n){let e=n.geometry?.building?.center;return Array.isArray(e)&&e.length>=2?[e[0],1.5,e[1]]:null}function Tf(){if(!se?.streetLabels)return;let n=Be.position.distanceTo(Ve.target),e=[];for(let t of se.streetLabels){let i=t.position.clone().project(Be),r=(i.x*.5+.5)*Ks.clientWidth,s=(-i.y*.5+.5)*Ks.clientHeight,o=Math.min(150,32+t.element.textContent.length*5.5),a={left:r-o/2,right:r+o/2,top:s-9,bottom:s+9},l=Jt("labels")&&t.name!==Ai&&i.z>-1&&i.z<1&&Math.abs(i.x)<1.02&&Math.abs(i.y)<1.02&&!e.some(c=>a.left<c.right+5&&a.right>c.left-5&&a.top<c.bottom+3&&a.bottom>c.top-3);t.element.hidden=!l,l&&(e.push(a),t.element.style.left=`${r}px`,t.element.style.top=`${s}px`,t.element.classList.toggle("far",n>300))}}function Ef(){se?.streetNames?.length&&(Ai=se.streetNames[Zy++%se.streetNames.length],oe("view-label").textContent=`Find ${Ai} \xB7 click one of its buildings`,oe("street-quiz").textContent="Skip to another street")}function Af(n){if(!Ai)return null;let e=Ai,t=se?.owners.get(n)?.geometry.building.street,i=t===e;return i?(oe("view-label").textContent=`Correct \xB7 ${e}`,Ai=null,oe("street-quiz").textContent="Another street"):oe("view-label").textContent=`That is ${t||"an unnamed building"} \xB7 find ${e}`,{correct:i,street:t||null,target:e}}function Zi(n){n?.group?.traverse?.(e=>{e.isInstancedMesh&&(e.visible=Jt("trees")&&An!=="frontage")})}function tv(){let n=0;return se?.group?.traverse?.(e=>{e.isInstancedMesh&&e.visible&&n++}),n}function Rf(){return[...se?.resources||[]].reduce((n,e)=>n+e.stats.machineSigns,0)}function Cf(){let n=oe("machine-sign-badge");if(!bt){n.hidden=!0;return}let e=Rf(),t=Jt("machine-signs");n.hidden=!t||e<1,n.textContent=Xd}function _u(n){for(let e of se?.resources||[])e.setMachineSignsVisible(n);Cf()}function nv(n){if(!n)return"geometry-only";if(n.sourceTier||n.tier)return n.sourceTier||n.tier;let e=n.images?.full,t=n.images?.ground;return e&&t?"full + ground":t?"ground":e?"full":"source metadata only"}function iv(n){return n?.images?.ground?.date||n?.images?.full?.date||n?.captureDate||n?.capturedAt||"date unknown"}function rv(n){if(!n)return["facade evidence"];let e=n.machineRoutingProposal||{},t=[];return String(e.signText||"").trim()||t.push("literal sign text"),e.signTextEligible==="unknown"&&t.push("sign text uncertain"),(n.effectiveProposal?.shopfront==="unknown"||n.effectiveProposal?.shopfront==null)&&t.push("shopfront"),n.visualReview?.fieldEligibility?.signText===!1&&t.push("sign text withheld"),[...new Set(t)]}function sv(n){if(!n)return"No source observation is bound to this building; generated facade details remain omitted.";let e=n.images?.ground,t=n.images?.full,i=[n.id,n.evidenceKey,n.derivationKey].filter(Boolean).join(" \xB7 ")||"identity unavailable",r=e?.panoramaId||t?.panoramaId||"panorama unavailable",s=rv(n),o=String(iv(n));return`Source ${i} \xB7 panorama ${r} \xB7 captured ${o.slice(0,10)} \xB7 tier ${nv(n)}. Render omissions: ${s.length?s.join(", "):"none recorded"}. Machine text stays unreviewed and is revoked when this source binding changes.`}function ov(n){let e=new Yt,t=[];for(let o=1;o<n.points.length;o++){let[a,l]=n.points[o-1],[c,h]=n.points[o],p=c-a,u=h-l,f=Math.hypot(p,u);if(!f)continue;let m=-u/f*.4,v=p/f*.4,g=[[a+m,.2,l+v],[c+m,.2,h+v],[c-m,.2,h-v],[a-m,.2,l-v]];for(let d of[0,1,2,0,2,3])t.push(...g[d])}let i=new Tt;i.setAttribute("position",new it(t,3)),i.computeVertexNormals();let r=new Sn({color:"#d7a82f",emissive:"#60440a",emissiveIntensity:.16,roughness:.78,polygonOffset:!0,polygonOffsetFactor:-2,side:Et}),s=new ft(i,r);return s.name="map-recall-guided-route",s.renderOrder=3,e.add(s),{group:e,dispose(){e.removeFromParent(),i.dispose(),r.dispose()}}}function au(n){let e=se?.context.guidedRoute?.points;if(!e?.length)return null;let t=n;for(let i=1;i<e.length;i++){let r=e[i-1],s=e[i],o=Math.hypot(s[0]-r[0],s[1]-r[1]);if(t<=o){let a=o?t/o:0;return{point:[r[0]+(s[0]-r[0])*a,r[1]+(s[1]-r[1])*a],ahead:s}}t-=o}return{point:e.at(-1),ahead:e.at(-1)}}function av(n){return se?.context.guidedRoute?.legs?.find((e,t,i)=>n>=e.fromM&&(n<e.toM||t===i.length-1))?.streetName??null}function Pf(){se?.context.guidedRoute&&(gn=!gn,Ve.enabled=!gn,oe("follow-route").textContent=gn?"Pause street tour":"Resume street tour",gn&&(_u(Jt("machine-signs")),Ai=null,mn=mn>=se.context.guidedRoute.distanceM?0:mn,cu=performance.now()))}function If(n){se?.priorityTiles&&(se.priorityTiles.length=0),An="route",nn.fog&&(nn.fog.near=260,nn.fog.far=850);let e=se?.context.guidedRoute;if(!e)return;mn=Math.max(0,Math.min(e.distanceM,n));let t=au(mn),i=au(Math.min(e.distanceM,mn+12));if(!t||!i)return;let[r,s]=t.point,o=i.point[0]-r,a=i.point[1]-s;if(Math.hypot(o,a)<.1){let h=au(Math.max(0,mn-12));o=r-(h?.point[0]??r-1),a=s-(h?.point[1]??s)}let l=Math.hypot(o,a)||1;Be.position.set(r-o/l*4,2.35,s-a/l*4),Ve.target.set(r+o/l*12,1.75,s+a/l*12),Be.fov=58,Be.updateProjectionMatrix(),Ve.update();let c=av(mn);oe("view-label").textContent=`Street tour \xB7 ${c?`${c} \xB7 `:""}${Math.round(mn)} / ${Math.round(e.distanceM)} m \xB7 ${Math.round(mn/e.distanceM*100)}%`,Xt=!0}function lv(n){if(!gn)return;let e=se?.context.guidedRoute;if(!e){gn=!1;return}let t=mn+Math.min(.1,(n-cu)/1e3)*9;cu=n,t>=e.distanceM&&(gn=!1,Ve.enabled=!0,oe("follow-route").textContent="Replay street tour"),If(t)}async function Lf(){let n=++uu;hu?.abort();let e=new AbortController;hu=e;let t=await fetch(Xy,{signal:e.signal,cache:"no-store"});if(!t.ok)throw Error("No published scene yet. Run the matching city demo publisher.");let i=await t.json();if(i.version!==1||!i.releaseId||!Array.isArray(i.tiles)||!i.context?.url)throw Error("Unsupported scene release");let r=!!$s&&i.developmentCandidate===!0;if(r){let M=oe("machine-preview").closest("label")?.querySelector("span");M&&(M.textContent="Photo-derived wall colours (unreviewed)"),oe("appearance-copy").textContent="Photo-derived fa\xE7ade details are shown where available. Other buildings retain illustrative patterns. Placement is under review; source roofs are preserved.";let w=document.getElementById("candidate-preview-badge");w||(w=document.createElement("div"),w.id="candidate-preview-badge",w.style.cssText="position:fixed;bottom:12px;left:12px;z-index:20;padding:8px 12px;background:#fff3ce;color:#493c20;font:13px sans-serif;pointer-events:none",document.body.append(w)),w.textContent="Neighbourhood preview \xB7 fa\xE7ade placement under review"}let s=await ou(i.context.url,i.context.sha256,e.signal),o=new Yt,a=null,l=null,c=new Map,h=new Set,p=new Set,u=[],f=new Map(i.tiles.map(M=>[M.key,M])),m=of({parent:o,targetOriginRD:s.origin,targetOffsetNAP:.65,experimentalWallColours:Jt(bt?"machine-preview":"appearance"),observedFacades:r,candidateRegistrationPreview:r,proceduralFacades:Jt("patterns"),reviewedAwnings:!bt&&Jt("appearance"),auditCoverage:bt&&Jt("appearance"),contextualPalette:bt,contextualFacades:bt,machineSigns:bt&&Jt("machine-signs"),castShadows:!bt}),v=i.observationIndex?.find(M=>M.id===(Vn.get("frontage")||Vn.get("inspect"))),g=v?.tile?[v.tile]:[],d=new Vs({index:i,priorityTiles:g,budget:12,concurrency:2,lodDistanceMultiplier:1,loadTile:async(M,w)=>{let x=f.get(M);if(!x?.url)throw Error("Missing tile in release");return ou(x.url,[x.sha256,x.contentSha256??x.sha256],w)},createResource:M=>{for(let x of M)c.set(x.id,x);let w=m(M);return w.setSelected(Yi),h.add(w),{setLod:(x,R)=>w.setLod(x,R),dispose(){for(let x of M)c.delete(x.id);h.delete(w),w.dispose()}}},onError:(M,w)=>u.push(String(w))});try{if(i.contextTiles){let P=new Map(i.contextTiles.tiles.map(D=>[D.key,D]));l=new Vs({index:i.contextTiles,budget:16,concurrency:2,loadTile:async(D,N)=>{let F=P.get(D);if(!F?.url)throw Error("Missing context tile in release");return ou(F.url,[F.sha256,F.contentSha256??F.sha256],N)},createResource:D=>{let N={},F=[];for(let L of D){let U=L.geometry;U.kind==="tree"?F.push(U.tree):U.kind==="feature"&&(N[U.layer]??=[]).push(U.feature)}let k=Qc({...s,layers:N,trees:F},{includeBase:!1});return p.add(k),o.add(k.group),{setLod(){},dispose(){p.delete(k),k.dispose()}}},onError:(D,N)=>u.push(String(N))})}v?.mid&&(Ve.target.set(v.mid[0],5,v.mid[1]),Be.position.set(v.mid[0],45,v.mid[1]+45),Ve.update());let M=gu(s);d.update(M),l?.update(M),await Promise.all([d.whenIdle(),l?.whenIdle()]);for(let P of h)P.flush();if(mu||n!==uu||e.signal.aborted)throw new DOMException("Superseded","AbortError");if(u.length)throw Error(u[0]);if(!c.size)throw Error("No building tiles loaded for this view");let w=mf(s.bounds,[...c.values()].flatMap(P=>P.observations.map(D=>D.payload)));a=Qc({...s,bounds:w.bounds}),o.add(a.group),Zi(a);let x=s.overviewMassing?.buildings?.length?jy(s.overviewMassing.buildings):null;x&&o.add(x);let R=s.guidedRoute?ov(s.guidedRoute):null;R&&(o.add(R.group),R.group.visible=Jt("route"));let b=se;se={manifest:i,context:s,displayExtent:w,group:o,terrain:a,overviewMassing:x,priorityTiles:g,routeOverlay:R,owners:c,stream:d,contextStream:l,resources:h,contextResources:p},nn.add(o),b&&(b.stream.dispose(),b.contextStream?.dispose(),b.routeOverlay?.dispose(),b.terrain.dispose(),b.overviewMassing?.geometry.dispose(),b.overviewMassing?.material.dispose(),nn.remove(b.group));let[C,_,E,T]=w.bounds;Ct.clippingPlanes=[new kt(new B(1,0,0),-C),new kt(new B(-1,0,0),E),new kt(new B(0,0,1),-_),new kt(new B(0,0,-1),T)],oe("coverage").textContent=`${i.buildings} buildings \xB7 ${i.observations} photographed frontages \xB7 ${i.reviewed??0} reviewed`;let A=oe("provenance-ladder");if(bt&&i.appearanceCoverage){let P=i.appearanceCoverage;A.hidden=!1,A.innerHTML=`<strong>Coverage ladder</strong><br>Geometry ${P.geometryBuildings}/${i.buildings}<br>Contextual display prior ${P.contextualPriorBuildings}/${i.buildings}<br>Audited street evidence ${P.auditedFrontages}/${i.buildings}<br>Machine-observed (unreviewed) ${P.machinePreviewFrontages}/${i.buildings}<br>Human-confirmed appearance ${P.humanConfirmedFrontages}/${i.buildings}${r?`<br>Candidate fa\xE7ade buildings ${P.candidatePreviewBuildings??0}/${i.buildings}`:""}`}Cf(),s.guidedRoute&&(oe("follow-route").textContent=`Play ${Math.round(s.guidedRoute.distanceM)} m street tour`),Qy(),ev(),bf(Vn.get("sourceTier")==="full"?"full":"ground"),fu(Vn.get("cameraPreset")==="front"?"front":Vn.get("cameraPreset")==="oblique"?"oblique":"ground"),Mf(),pu(),oe("loading").hidden=!0,ml(`Release ${i.releaseId.slice(0,8)} \xB7 ${i.reviewed??0} reviewed${i.followupCount?` \xB7 ${i.followupCount} follow-up notes`:""}`),Yi&&Ri(Yi,En||void 0),Xt=!0}catch(M){throw d.dispose(),l?.dispose(),a?.dispose(),se?.group!==o&&nn.remove(o),M}}function xl(n){if(se?.priorityTiles&&(se.priorityTiles.length=0),Gn=null,gn=!1,Ve.enabled=!0,oe("follow-route").textContent="Play street tour",An=n,_u(bt&&Jt("machine-signs")),zr(Vr),n==="canal"){let e=bt&&se?tu([4.8728,52.372]):null,t=e?e.x-se.context.origin.x:-5,i=e?se.context.origin.y-e.y:-30;Ve.target.set(t,7,i),Be.position.set(t-70,58,i+55)}else if(n==="shops"){let e=bt&&se?tu([4.873,52.37155]):null,t=e?e.x-se.context.origin.x:-22,i=e?se.context.origin.y-e.y:70;Ve.target.set(t,8,i),Be.position.set(t-26,23,i+38)}else{let e=se?.displayExtent.bounds||[-130,-147,130,131],t=(e[0]+e[2])/2,i=(e[1]+e[3])/2,r=Math.max(e[2]-e[0],e[3]-e[1]);Ve.target.set(t,5,i),Be.position.set(t+r*.5,r*.74,i+r*.7)}nn.fog&&(nn.fog.near=n==="overview"?1800:260,nn.fog.far=n==="overview"?6e3:850),fu(_l),Zi(se),document.querySelectorAll("[data-view]").forEach(e=>e.setAttribute("aria-pressed",String(e.dataset.view===n))),Xt=!0}function Ri(n,e){let t=se?.owners.get(n);if(!t)return;Yi=n;for(let u of se?.resources||[])u.setSelected(n);let i=t.observations.map(u=>u.payload),r=i.find(u=>u.id===e)||i[0];En=r?.id||null;let s=t.geometry.building;oe("inspector").hidden=!1,oe("selection-title").textContent=r?.address||s.addresses?.[0]||"Building without a photographed frontage";let o={accepted:"Human-confirmed wall",uncertain:"Human: placement uncertain",rejected:"Human: wrong or unusable","crop-repair":"Human: right building, bad crop"},a=r?.agentSourceAudit?r.agentSourceAudit.disposition==="preflight-passed"?"Automated crop preflight \xB7 identity unreviewed":`Agent source audit: ${r.agentSourceAudit.disposition}`:o[r?.review?.placement]||"Not human-reviewed";oe("selection-tags").replaceChildren();for(let u of[a,t.geometryRevision.slice(0,8)]){let f=document.createElement("span");f.className="tag",f.textContent=u,oe("selection-tags").append(f)}let l=oe("frontage-choice");l.replaceChildren(...i.map((u,f)=>new Option(`${f+1}. ${u.wallWidthM.toFixed(1)} m wall${["accepted","uncertain","rejected","crop-repair"].includes(u.review?.placement)?" \xB7 reviewed":""}`,u.id))),l.hidden=i.length<2,r&&(l.value=r.id);let c=r?.effectiveProposal,h={flat:"flat","flat-with-front-pitch":"mostly flat with a sloped front","pitched-gable":"two slopes meeting at a ridge",hipped:"sloped on all sides",mansard:"steep lower slopes and gentler upper slopes",complex:"several connected roof shapes"};oe("selection-summary").textContent=r?`${r.machineRoutingProposal?`Machine-observed: ${r.machineRoutingProposal.wallColour} ${r.machineRoutingProposal.wallMaterial}, ${r.machineRoutingProposal.family}; ${r.machineRoutingProposal.groundType} ground floor. `:""}Storefront: ${c?.shopfront==="yes"?r.review?.shopfront==="yes"?"human-confirmed":"machine-observed, unreviewed":c?.shopfront==="no"?"no storefront observed":"not established"}. Roof: ${h[c?.roofShape]||"not established"}. The source roof geometry is unchanged.`:"Source geometry only. No facade evidence has been assigned to this building.",oe("source-comparison").textContent=sv(r),oe("inspector-warning").textContent=r?.agentSourceAudit?.note||r?.review?.notes?`${r?.agentSourceAudit?"Source audit":"Your note"}: ${r?.agentSourceAudit?.note||r.review.notes}`:r?.review?.placement==="crop-repair"?"The building is right, but the crop needs repair. Appearance is withheld.":r?.facadeDescription?"Photo-derived fa\xE7ade details; placement is still under review.":"Window patterns are illustrative, not extracted window counts.";let p=oe("evidence-image");p.hidden=!0,p.removeAttribute("src"),p.onload=()=>{p.hidden=!1},p.onerror=()=>{p.hidden=!0,oe("evidence-caption").textContent="Evidence image unavailable; use the review link."},r?.images.full?.file?(p.src=r.images.full.publicUrl||(bt?"/panorama-audit/evidence/":"/evidence/")+encodeURIComponent(r.images.full.file),oe("evidence-caption").textContent=`Street evidence \xB7 ${r.images.full.date?.slice(0,10)||"date unknown"} \xB7 approximate wall crop`):oe("evidence-caption").textContent="";for(let u of["review-link","frame-frontage","detail-link"])oe(u).hidden=!r;if(r&&(oe("review-link").href=bt?"./panorama-audit.html#"+encodeURIComponent(r.id):"./neighbourhood-review.html#"+encodeURIComponent(r.id),oe("review-link").textContent=bt?"See audit evidence \u2197":"Review this wall \u2197",oe("detail-link").href="./da-costa-block.html?neighbourhood=1&frontage="+encodeURIComponent(r.id)),r){let u=oe("review-link"),f=bt?"./panorama-audit.html":"./neighbourhood-review.html",m=new URL(f+"#"+encodeURIComponent(r.id),location.href);m.searchParams.set("sourceTier",du),m.searchParams.set("cameraPreset",_l),u.href=m.href}}function Gr(n){let e=$i().find(r=>r.id===n);if(!e)return;let t=e.review?.placement==="accepted"&&$i().find(r=>r.id===e.review.targetId)||e,i=pf(t,Sf(),Be.aspect);if(Ri(e.renderBuildingId||e.buildingId,e.id),!i.usable){oe("inspector-warning").textContent="This wall has no clear initial camera position. Use the photographs to review it.";return}Ve.target.set(...i.target),Be.position.set(...i.position),Be.fov=i.fov,Be.updateProjectionMatrix(),Ve.update(),Gn=t,An="frontage",Zi(se),oe("view-label").textContent=e.address,document.querySelectorAll("[data-view]").forEach(r=>r.setAttribute("aria-pressed","false")),Xt=!0}function Df(n){let e=$i();if(!e.length)return;let t=e.findIndex(i=>i.id===En);Gr(e[(t+n+e.length)%e.length].id)}async function xu(){if(!bt)try{let n=await fetch("/api/city-appearance/status",{cache:"no-store"});n.ok&&(pl=await n.json(),pl.stale&&ml("New saved reviews are available. Load them into this scene."))}catch{}}async function yu(n=!0){if(dl){n||(su=!0);return}dl=!0,oe("refresh").disabled=!0;try{if(ml(n?"Checking saved reviews\u2026":"Updating appearance view\u2026"),n&&(await xu(),pl?.token)){let e=await fetch("/api/city-appearance/refresh",{method:"POST",headers:{"content-type":"application/json","x-review-token":pl.token},body:"{}"});if(!e.ok)throw Error((await e.json()).error||"Could not rebuild the scene")}do su=!1,await Lf(),Gn&&Gr(Gn.id);while(su)}catch(e){e.name!=="AbortError"&&ml(`${String(e)}. The previous scene is retained.`,!0)}finally{dl=!1,oe("refresh").disabled=!1}}function vu(){let n=Ks.clientWidth,e=Ks.clientHeight;Ct.setSize(n,e,!1),Be.aspect=n/e,Gn?Be.fov=hl(Gn,Be.aspect,Be.position.distanceTo(Ve.target)).fov:An==="overview"&&(Be.fov=Ky()),Be.updateProjectionMatrix(),Xt=!0}function cv(n){if(ru){let i=n-ru;i>0&&i<500&&iu.push(i)}if(ru=n,iu.length<30)return;let e=iu.splice(0).sort((i,r)=>i-r),t=e[Math.floor(e.length*.75)];t>35&&kr>.76?(kr=Math.max(.75,kr*.8),Ct.setPixelRatio(kr),vu(),lu++):t>45&&Ct.shadowMap.enabled&&(Ct.shadowMap.enabled=!1,lu++)}new ResizeObserver(vu).observe(Ks);vu();Ve.addEventListener("change",()=>{Xt=!0});document.querySelectorAll("[data-view]").forEach(n=>n.onclick=()=>xl(n.dataset.view));oe("camera-reset").onclick=()=>xl("overview");oe("previous-frontage").onclick=()=>Df(-1);oe("next-frontage").onclick=()=>Df(1);oe("street-quiz").onclick=Ef;oe("labels").onchange=()=>Tf();oe("follow-route").onclick=Pf;oe("route").onchange=()=>{se?.routeOverlay&&(se.routeOverlay.group.visible=Jt("route"))};oe("inspector-close").onclick=()=>{oe("inspector").hidden=!0,Yi=null,En=null;for(let n of se?.resources||[])n.setSelected(null)};oe("frame-frontage").onclick=()=>En&&Gr(En);oe("frontage-choice").onchange=()=>Yi&&Ri(Yi,oe("frontage-choice").value);for(let n of["navigation-orbit","navigation-explore"]){let e=n==="navigation-orbit"?"orbit":"explore",t=oe(n);t&&(t.onclick=()=>zr(e))}oe("building-search-go").onclick=()=>{wf(oe("building-search").value)};oe("building-search").addEventListener("keydown",n=>{n.key==="Enter"&&(n.preventDefault(),wf(oe("building-search").value))});oe("search-clear").onclick=()=>{oe("building-search").value="",oe("view-label").textContent="Search cleared"};document.querySelectorAll("button[data-source-tier]").forEach(n=>{n.onclick=()=>bf(n.dataset.sourceTier)});document.querySelectorAll("button[data-camera-preset]").forEach(n=>{n.onclick=()=>fu(n.dataset.cameraPreset)});oe("camera-copy").onclick=async()=>{let n=$y(),e=new URL(location.href);e.search=n.toString();try{await navigator.clipboard?.writeText(e.toString())}catch{let t=document.createElement("a");t.href=e.toString(),t.download="",t.click()}oe("view-label").textContent="Camera link copied"};oe("camera-share").onclick=()=>{Mf(),Xt=!0,pu(),oe("view-label").textContent="Camera restored from URL"};oe("refresh").onclick=()=>void yu();for(let n of["appearance","patterns","machine-preview"])oe(n).onchange=()=>{if(bt&&n!=="patterns"&&Jt(n)){let e=n==="appearance"?"machine-preview":"appearance";oe(e).checked=!1}yu(!1)};oe("machine-signs").onchange=()=>_u(Jt("machine-signs"));oe("trees").onchange=()=>{se&&Zi({group:se.group})};var fl=null,yf=new Ts;function Nf(){return["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName||"")}Zs.addEventListener("pointerdown",n=>{fl={x:n.clientX,y:n.clientY}});Zs.addEventListener("pointerup",n=>{if(!fl||Math.hypot(n.clientX-fl.x,n.clientY-fl.y)>5)return;let e=Zs.getBoundingClientRect();yf.setFromCamera(new Ee((n.clientX-e.left)/e.width*2-1,-(n.clientY-e.top)/e.height*2+1),Be);let t=yf.intersectObjects(se?[...se.resources].flatMap(i=>i.group.children):[],!1);if(t.length)for(let i of se.resources){let r=i.pick(t[0].object,t[0].faceIndex);if(r){Af(r.buildingId),Ri(r.buildingId,r.observationId||void 0);break}}});function gl(){gn&&(gn=!1,Ve.enabled=!0,oe("follow-route").textContent="Play street tour")}function uv(n){if(Vr==="orbit"||!se||(Ei||(Ei=n),!Object.values(Qe).some(Boolean)))return;gl(),Gn=null,An="manual",Zi(se);let e=new B;Be.getWorldDirection(e),e.y=0,e.normalize();let t=new B(-e.z,0,e.x),i=.015*(Qe.fast?1.5:1)*Math.min(1,(n-Ei)/16.7);Qe.turnLeft&&Ve.rotateLeft(i),Qe.turnRight&&Ve.rotateLeft(-i);let r=new B;if(Qe.forward&&r.add(e),Qe.backward&&r.sub(e),Qe.left&&r.sub(t),Qe.right&&r.add(t),r.lengthSq()>1e-4){let s=Qe.fast?1.8:.75,o=(n-Ei)/16.7;r.normalize().multiplyScalar(s*o*2.4),Be.position.add(r),Ve.target.add(r)}Ve.update(),Xt=!0,Ei=n,pu()}function Ff(n,e){switch(n){case"ArrowUp":case"KeyW":return Qe.forward=e,!0;case"ArrowDown":case"KeyS":return Qe.backward=e,!0;case"ArrowLeft":case"KeyA":return Qe.left=e,!0;case"ArrowRight":case"KeyD":return Qe.right=e,!0;case"KeyQ":return Qe.turnLeft=e,!0;case"KeyE":return Qe.turnRight=e,!0;case"ShiftLeft":case"ShiftRight":return Qe.fast=e,!0}return!1}window.addEventListener("keydown",n=>{if(Nf())return;let e=Vr,t=n.key.toLowerCase();if(Ff(n.code,!0)){n.preventDefault(),e!=="explore"&&zr("explore"),Ei=performance.now();return}t==="f"&&(n.preventDefault(),En&&Gr(En)),t==="o"&&(n.preventDefault(),zr("orbit")),t==="x"&&(n.preventDefault(),zr("explore"))});window.addEventListener("keyup",n=>{Nf()||(Ff(n.code,!1),Object.values(Qe).some(Boolean)||(Ei=0))});document.querySelectorAll("#touch-controls button").forEach(n=>{let e=n.id,t=i=>{e==="move-forward"&&(Qe.forward=i),e==="move-backward"&&(Qe.backward=i),e==="move-left"&&(Qe.left=i),e==="move-right"&&(Qe.right=i),e==="turn-left"&&(Qe.turnLeft=i),e==="turn-right"&&(Qe.turnRight=i),e==="speed-toggle"&&(Qe.fast=i),i&&gl()};n.addEventListener("pointerdown",i=>{i.preventDefault(),Vr!=="explore"&&zr("explore"),t(!0)}),n.addEventListener("pointerup",()=>{t(!1)}),n.addEventListener("pointerleave",()=>{t(!1)})});window.addEventListener("pointerup",()=>{Vr==="explore"&&(Qe.forward=!1,Qe.backward=!1,Qe.left=!1,Qe.right=!1,Qe.turnLeft=!1,Qe.turnRight=!1,Qe.fast=!1)});function Uf(n){if(se?.overviewMassing){se.overviewMassing.visible=An==="overview";for(let e of se.resources)e.group.visible=An!=="overview"}if(!mu){if(requestAnimationFrame(Uf),cv(n),uv(n),lv(n),Ve.update(),se&&Xt&&n-gf>120){let e=gu(se.context);se.stream.update(e),se.contextStream?.update(e),Ei=n,gf=n,Xt=!1}if(Ct.render(nn,Be),Tf(),se&&n-_f>900){let e=se.stream.status,t=se.contextStream?.status;oe("metrics").textContent=`${e.resident}/12 building tiles${t?` \xB7 ${t.resident}/16 context tiles`:""} \xB7 ${Ct.info.render.calls} draws \xB7 ${Ct.info.render.triangles.toLocaleString()} triangles${e.failed.length||t?.failed.length?" \xB7 tile load failed":""}${e.budgetConstrained||t?.budgetConstrained?" \xB7 detailed extent limited":""}`,_f=n}}}requestAnimationFrame(Uf);var hv=setInterval(()=>void xu(),15e3);window.addEventListener("pagehide",()=>{mu=!0,uu++,hu?.abort(),clearInterval(hv),se?.stream.dispose(),se?.contextStream?.dispose(),se?.routeOverlay?.dispose(),se?.terrain.dispose(),Ve.dispose(),Ct.dispose()});function dv(){let n=new Set;for(let e of se?.resources||[])for(let t of e.group.children)for(let i of t.userData.triangleIdentities||[])i.observationId&&n.add(`${i.buildingId}:${i.sourceSurfaceIndex}:${i.observationId}`);return n.size}window.cityAppearanceDemo={status:()=>({ready:!!se,developmentCandidate:se?.manifest.developmentCandidate===!0,releaseId:se?.manifest.releaseId,reviewed:se?.manifest.reviewed,buildings:se?.manifest.buildings,residentBuildings:se?.owners.size,observations:se?.manifest.observations,residentObservations:$i().length,stream:se?.stream.status,contextStream:se?.contextStream?.status,displayExtent:se?.displayExtent,facadeWindows:[...se?.resources||[]].reduce((n,e)=>n+e.stats.windows,0),facadeDoors:[...se?.resources||[]].reduce((n,e)=>n+e.stats.doors,0),facadeStorefronts:[...se?.resources||[]].reduce((n,e)=>n+e.stats.storefronts,0),machineSigns:Rf(),intervalPaintedWalls:dv(),selectionMeshes:[...se?.resources||[]].reduce((n,e)=>n+e.group.children.filter(t=>t.userData.runtimeSelection).length,0),contextBridges:[...se?.contextResources||[]].reduce((n,e)=>n+e.stats.bridges,0),visibleTreeMeshes:tv(),residentBuildingGeometryBufferBytes:[...se?.resources||[]].reduce((n,e)=>n+e.stats.geometryBufferBytes,0),residentBuildingTextureBytes:[...se?.resources||[]].reduce((n,e)=>n+e.stats.textureBytes,0),drawCalls:Ct.info.render.calls,triangles:Ct.info.render.triangles,gpuGeometries:Ct.info.memory.geometries,gpuTextures:Ct.info.memory.textures,pixelRatio:kr,shadows:Ct.shadowMap.enabled,adaptiveChanges:lu,selectedId:En,view:An,refreshing:dl,quizStreet:Ai,routePlaying:gn,routeDistance:mn,cameraPosition:Be.position.toArray(),cameraTarget:Ve.target.toArray()}),view:xl,frontage:Gr,select:Ri,refresh:yu,quiz:Ef,answerQuiz:Af,buildingStreets:()=>se?[...se.owners].map(([n,e])=>({id:n,street:e.geometry.building.street})):[],route:Pf,routeAt:If,whenIdle:async()=>{if(se&&Xt){let n=gu(se.context);se.stream.update(n),se.contextStream?.update(n),Xt=!1}await Promise.all([se?.stream.whenIdle(),se?.contextStream?.whenIdle()]);for(let n of se?.resources||[])n.flush();await new Promise(n=>requestAnimationFrame(()=>requestAnimationFrame(()=>n())))},records:$i,context:()=>se?.context};if(bt){document.title="Da Costa \xB7 expansion geometry",document.querySelector("h1").innerHTML="A larger piece<br>of Amsterdam.",document.querySelector(".eyebrow").textContent="Amsterdam \xB7 source geometry at neighbourhood scale",document.querySelector("h1 + .muted").textContent="Two Amsterdam districts with source buildings, streets, canals and inventory trees.",oe("patterns").closest("label").hidden=!0,oe("street-quiz").hidden=!1,oe("follow-route").hidden=!1,oe("machine-preview").checked=!1,oe("appearance").checked=!1,oe("machine-signs").checked=!0,oe("machine-signs-label").hidden=!1,oe("appearance").nextElementSibling.textContent="Audited source-wall coverage",oe("appearance-copy").textContent="Machine-observed storefronts and shop names are unreviewed. Machine wall colours are optional. The city-wide palette is a deterministic construction-era visualization prior. Switch to audited coverage: green means usable evidence, ochre means partial.";for(let t of["previous-frontage","next-frontage","refresh","review-heading","review-copy"])oe(t).hidden=!0;let n=oe("evidence-link");n.href="./panorama-audit.html",n.textContent="See the new street evidence \u2197";let e=oe("pipeline-link");e.href="./EXPANSION_DEMO_2026-09-10.md",e.textContent="What this demo proves",oe("release-status").textContent="Loading immutable expansion geometry\u2026",oe("view-label").textContent="Da Costa expansion \xB7 source geometry"}else oe("machine-preview").closest("label").hidden=!0,oe("labels").closest("label").hidden=!0,oe("route").closest("label").hidden=!0;Lf().then(()=>{let n=Vn.get("frontage"),e=Vn.get("inspect");if(n)Gr(n);else if(xl("overview"),e){let t=$i().find(i=>i.id===e);t&&Ri(t.renderBuildingId||t.buildingId,t.id)}xu()}).catch(n=>{oe("loading").textContent=String(n),oe("loading").classList.add("error")});
/*! Bundled license information:

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/

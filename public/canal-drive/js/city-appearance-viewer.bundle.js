var mi={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},gi={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},oh=0,sc=1,lh=2;var Es=1,no=2,Ar=3,Mn=0,jt=1,Pt=2,Bn=0,Oi=1,ac=2,oc=3,lc=4,ch=5;var ui=100,uh=101,hh=102,dh=103,fh=104,ph=200,mh=201,gh=202,_h=203,wa=204,Ta=205,xh=206,yh=207,vh=208,bh=209,Mh=210,Sh=211,wh=212,Th=213,Eh=214,Ea=0,Aa=1,Ra=2,Bi=3,Ca=4,Pa=5,Ia=6,Da=7,io=0,Ah=1,Rh=2,Tn=0,cc=1,uc=2,hc=3,As=4,dc=5,fc=6,pc=7;var mc=300,_i=301,Wi=302,ro=303,so=304,Rs=306,La=1e3,Fn=1001,Fa=1002,kt=1003,Ch=1004;var Cs=1005;var Lt=1006,ao=1007;var xi=1008;var en=1009,gc=1010,_c=1011,Rr=1012,oo=1013,En=1014,pn=1015,kn=1016,lo=1017,co=1018,Cr=1020,xc=35902,yc=35899,vc=1021,bc=1022,mn=1023,Nn=1026,yi=1027,uo=1028,ho=1029,vi=1030,fo=1031;var po=1033,Ps=33776,Is=33777,Ds=33778,Ls=33779,mo=35840,go=35841,_o=35842,xo=35843,yo=36196,vo=37492,bo=37496,Mo=37488,So=37489,Fs=37490,wo=37491,To=37808,Eo=37809,Ao=37810,Ro=37811,Co=37812,Po=37813,Io=37814,Do=37815,Lo=37816,Fo=37817,No=37818,Uo=37819,Oo=37820,Bo=37821,ko=36492,zo=36494,Vo=36495,Go=36283,Ho=36284,Ns=36285,Wo=36286;var Qr=2300,Na=2301,Sa=2302,Xl=2303,ql=2400,$l=2401,Yl=2402;var Ph=3200;var Us=0,Ih=1,Qn="",Bt="srgb",es="srgb-linear",ts="linear",ct="srgb";var Ni=7680;var Zl=519,Dh=512,Lh=513,Fh=514,Xo=515,Nh=516,Uh=517,qo=518,Oh=519,Kl=35044;var Mc="300 es",bn=2e3,pr=2001;function Kf(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function Jf(n){return ArrayBuffer.isView(n)&&!(n instanceof DataView)}function ns(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function Bh(){let n=ns("canvas");return n.style.display="block",n}var Lu={},mr=null;function Sc(...n){let e="THREE."+n.shift();mr?mr("log",e,...n):console.log(e,...n)}function kh(n){let e=n[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=n[1];t&&t.isStackTrace?n[0]+=" "+t.getLocation():n[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return n}function ke(...n){n=kh(n);let e="THREE."+n.shift();if(mr)mr("warn",e,...n);else{let t=n[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...n)}}function Ge(...n){n=kh(n);let e="THREE."+n.shift();if(mr)mr("error",e,...n);else{let t=n[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...n)}}function Ui(...n){let e=n.join(" ");e in Lu||(Lu[e]=!0,ke(...n))}function zh(n,e,t){return new Promise(function(i,r){function s(){switch(n.clientWaitSync(e,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:r();break;case n.TIMEOUT_EXPIRED:setTimeout(s,t);break;default:i()}}setTimeout(s,t)})}var Vh={[Ea]:Aa,[Ra]:Ia,[Ca]:Da,[Bi]:Pa,[Aa]:Ea,[Ia]:Ra,[Da]:Ca,[Pa]:Bi},Sn=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){let i=this._listeners;return i===void 0?!1:i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){let i=this._listeners;if(i===void 0)return;let r=i[e];if(r!==void 0){let s=r.indexOf(t);s!==-1&&r.splice(s,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let i=t[e.type];if(i!==void 0){e.target=this;let r=i.slice(0);for(let s=0,a=r.length;s<a;s++)r[s].call(this,e);e.target=null}}},Ht=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Fu=1234567,Jr=Math.PI/180,gr=180/Math.PI;function Pr(){let n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Ht[n&255]+Ht[n>>8&255]+Ht[n>>16&255]+Ht[n>>24&255]+"-"+Ht[e&255]+Ht[e>>8&255]+"-"+Ht[e>>16&15|64]+Ht[e>>24&255]+"-"+Ht[t&63|128]+Ht[t>>8&255]+"-"+Ht[t>>16&255]+Ht[t>>24&255]+Ht[i&255]+Ht[i>>8&255]+Ht[i>>16&255]+Ht[i>>24&255]).toLowerCase()}function rt(n,e,t){return Math.max(e,Math.min(t,n))}function wc(n,e){return(n%e+e)%e}function jf(n,e,t,i,r){return i+(n-e)*(r-i)/(t-e)}function Qf(n,e,t){return n!==e?(t-n)/(e-n):0}function jr(n,e,t){return(1-t)*n+t*e}function ep(n,e,t,i){return jr(n,e,1-Math.exp(-t*i))}function tp(n,e=1){return e-Math.abs(wc(n,e*2)-e)}function np(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*(3-2*n))}function ip(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*n*(n*(n*6-15)+10))}function rp(n,e){return n+Math.floor(Math.random()*(e-n+1))}function sp(n,e){return n+Math.random()*(e-n)}function ap(n){return n*(.5-Math.random())}function op(n){n!==void 0&&(Fu=n);let e=Fu+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function lp(n){return n*Jr}function cp(n){return n*gr}function up(n){return(n&n-1)===0&&n!==0}function hp(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))}function dp(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))}function fp(n,e,t,i,r){let s=Math.cos,a=Math.sin,o=s(t/2),l=a(t/2),c=s((e+i)/2),d=a((e+i)/2),u=s((e-i)/2),h=a((e-i)/2),p=s((i-e)/2),f=a((i-e)/2);switch(r){case"XYX":n.set(o*d,l*u,l*h,o*c);break;case"YZY":n.set(l*h,o*d,l*u,o*c);break;case"ZXZ":n.set(l*u,l*h,o*d,o*c);break;case"XZX":n.set(o*d,l*f,l*p,o*c);break;case"YXY":n.set(l*p,o*d,l*f,o*c);break;case"ZYZ":n.set(l*f,l*p,o*d,o*c);break;default:ke("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+r)}}function dr(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function Yt(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Tc={DEG2RAD:Jr,RAD2DEG:gr,generateUUID:Pr,clamp:rt,euclideanModulo:wc,mapLinear:jf,inverseLerp:Qf,lerp:jr,damp:ep,pingpong:tp,smoothstep:np,smootherstep:ip,randInt:rp,randFloat:sp,randFloatSpread:ap,seededRandom:op,degToRad:lp,radToDeg:cp,isPowerOfTwo:up,ceilPowerOfTwo:hp,floorPowerOfTwo:dp,setQuaternionFromProperEuler:fp,normalize:Yt,denormalize:dr},Le=class n{static{n.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,i=this.y,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6],this.y=r[1]*t+r[4]*i+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=rt(this.x,e.x,t.x),this.y=rt(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=rt(this.x,e,t),this.y=rt(this.y,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(rt(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(rt(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let i=Math.cos(t),r=Math.sin(t),s=this.x-e.x,a=this.y-e.y;return this.x=s*i-a*r+e.x,this.y=s*r+a*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},ln=class{constructor(e=0,t=0,i=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=r}static slerpFlat(e,t,i,r,s,a,o){let l=i[r+0],c=i[r+1],d=i[r+2],u=i[r+3],h=s[a+0],p=s[a+1],f=s[a+2],b=s[a+3];if(u!==b||l!==h||c!==p||d!==f){let g=l*h+c*p+d*f+u*b;g<0&&(h=-h,p=-p,f=-f,b=-b,g=-g);let m=1-o;if(g<.9995){let M=Math.acos(g),E=Math.sin(M);m=Math.sin(m*M)/E,o=Math.sin(o*M)/E,l=l*m+h*o,c=c*m+p*o,d=d*m+f*o,u=u*m+b*o}else{l=l*m+h*o,c=c*m+p*o,d=d*m+f*o,u=u*m+b*o;let M=1/Math.sqrt(l*l+c*c+d*d+u*u);l*=M,c*=M,d*=M,u*=M}}e[t]=l,e[t+1]=c,e[t+2]=d,e[t+3]=u}static multiplyQuaternionsFlat(e,t,i,r,s,a){let o=i[r],l=i[r+1],c=i[r+2],d=i[r+3],u=s[a],h=s[a+1],p=s[a+2],f=s[a+3];return e[t]=o*f+d*u+l*p-c*h,e[t+1]=l*f+d*h+c*u-o*p,e[t+2]=c*f+d*p+o*h-l*u,e[t+3]=d*f-o*u-l*h-c*p,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,r){return this._x=e,this._y=t,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let i=e._x,r=e._y,s=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(i/2),d=o(r/2),u=o(s/2),h=l(i/2),p=l(r/2),f=l(s/2);switch(a){case"XYZ":this._x=h*d*u+c*p*f,this._y=c*p*u-h*d*f,this._z=c*d*f+h*p*u,this._w=c*d*u-h*p*f;break;case"YXZ":this._x=h*d*u+c*p*f,this._y=c*p*u-h*d*f,this._z=c*d*f-h*p*u,this._w=c*d*u+h*p*f;break;case"ZXY":this._x=h*d*u-c*p*f,this._y=c*p*u+h*d*f,this._z=c*d*f+h*p*u,this._w=c*d*u-h*p*f;break;case"ZYX":this._x=h*d*u-c*p*f,this._y=c*p*u+h*d*f,this._z=c*d*f-h*p*u,this._w=c*d*u+h*p*f;break;case"YZX":this._x=h*d*u+c*p*f,this._y=c*p*u+h*d*f,this._z=c*d*f-h*p*u,this._w=c*d*u-h*p*f;break;case"XZY":this._x=h*d*u-c*p*f,this._y=c*p*u-h*d*f,this._z=c*d*f+h*p*u,this._w=c*d*u+h*p*f;break;default:ke("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let i=t/2,r=Math.sin(i);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,i=t[0],r=t[4],s=t[8],a=t[1],o=t[5],l=t[9],c=t[2],d=t[6],u=t[10],h=i+o+u;if(h>0){let p=.5/Math.sqrt(h+1);this._w=.25/p,this._x=(d-l)*p,this._y=(s-c)*p,this._z=(a-r)*p}else if(i>o&&i>u){let p=2*Math.sqrt(1+i-o-u);this._w=(d-l)/p,this._x=.25*p,this._y=(r+a)/p,this._z=(s+c)/p}else if(o>u){let p=2*Math.sqrt(1+o-i-u);this._w=(s-c)/p,this._x=(r+a)/p,this._y=.25*p,this._z=(l+d)/p}else{let p=2*Math.sqrt(1+u-i-o);this._w=(a-r)/p,this._x=(s+c)/p,this._y=(l+d)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<1e-8?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(rt(this.dot(e),-1,1)))}rotateTowards(e,t){let i=this.angleTo(e);if(i===0)return this;let r=Math.min(1,t/i);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let i=e._x,r=e._y,s=e._z,a=e._w,o=t._x,l=t._y,c=t._z,d=t._w;return this._x=i*d+a*o+r*c-s*l,this._y=r*d+a*l+s*o-i*c,this._z=s*d+a*c+i*l-r*o,this._w=a*d-i*o-r*l-s*c,this._onChangeCallback(),this}slerp(e,t){let i=e._x,r=e._y,s=e._z,a=e._w,o=this.dot(e);o<0&&(i=-i,r=-r,s=-s,a=-a,o=-o);let l=1-t;if(o<.9995){let c=Math.acos(o),d=Math.sin(c);l=Math.sin(l*c)/d,t=Math.sin(t*c)/d,this._x=this._x*l+i*t,this._y=this._y*l+r*t,this._z=this._z*l+s*t,this._w=this._w*l+a*t,this._onChangeCallback()}else this._x=this._x*l+i*t,this._y=this._y*l+r*t,this._z=this._z*l+s*t,this._w=this._w*l+a*t,this.normalize();return this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),r=Math.sqrt(1-i),s=Math.sqrt(i);return this.set(r*Math.sin(e),r*Math.cos(e),s*Math.sin(t),s*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},k=class n{static{n.prototype.isVector3=!0}constructor(e=0,t=0,i=0){this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Nu.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Nu.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[3]*i+s[6]*r,this.y=s[1]*t+s[4]*i+s[7]*r,this.z=s[2]*t+s[5]*i+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,i=this.y,r=this.z,s=e.elements,a=1/(s[3]*t+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*t+s[4]*i+s[8]*r+s[12])*a,this.y=(s[1]*t+s[5]*i+s[9]*r+s[13])*a,this.z=(s[2]*t+s[6]*i+s[10]*r+s[14])*a,this}applyQuaternion(e){let t=this.x,i=this.y,r=this.z,s=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*r-o*i),d=2*(o*t-s*r),u=2*(s*i-a*t);return this.x=t+l*c+a*u-o*d,this.y=i+l*d+o*c-s*u,this.z=r+l*u+s*d-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[4]*i+s[8]*r,this.y=s[1]*t+s[5]*i+s[9]*r,this.z=s[2]*t+s[6]*i+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=rt(this.x,e.x,t.x),this.y=rt(this.y,e.y,t.y),this.z=rt(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=rt(this.x,e,t),this.y=rt(this.y,e,t),this.z=rt(this.z,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(rt(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let i=e.x,r=e.y,s=e.z,a=t.x,o=t.y,l=t.z;return this.x=r*l-s*o,this.y=s*a-i*l,this.z=i*o-r*a,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return Sl.copy(this).projectOnVector(e),this.sub(Sl)}reflect(e){return this.sub(Sl.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(rt(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y,r=this.z-e.z;return t*t+i*i+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){let r=Math.sin(t)*e;return this.x=r*Math.sin(i),this.y=Math.cos(t)*e,this.z=r*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Sl=new k,Nu=new ln,Ze=class n{static{n.prototype.isMatrix3=!0}constructor(e,t,i,r,s,a,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,a,o,l,c)}set(e,t,i,r,s,a,o,l,c){let d=this.elements;return d[0]=e,d[1]=r,d[2]=o,d[3]=t,d[4]=s,d[5]=l,d[6]=i,d[7]=a,d[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,r=t.elements,s=this.elements,a=i[0],o=i[3],l=i[6],c=i[1],d=i[4],u=i[7],h=i[2],p=i[5],f=i[8],b=r[0],g=r[3],m=r[6],M=r[1],E=r[4],v=r[7],C=r[2],S=r[5],_=r[8];return s[0]=a*b+o*M+l*C,s[3]=a*g+o*E+l*S,s[6]=a*m+o*v+l*_,s[1]=c*b+d*M+u*C,s[4]=c*g+d*E+u*S,s[7]=c*m+d*v+u*_,s[2]=h*b+p*M+f*C,s[5]=h*g+p*E+f*S,s[8]=h*m+p*v+f*_,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],d=e[8];return t*a*d-t*o*c-i*s*d+i*o*l+r*s*c-r*a*l}invert(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],d=e[8],u=d*a-o*c,h=o*l-d*s,p=c*s-a*l,f=t*u+i*h+r*p;if(f===0)return this.set(0,0,0,0,0,0,0,0,0);let b=1/f;return e[0]=u*b,e[1]=(r*c-d*i)*b,e[2]=(o*i-r*a)*b,e[3]=h*b,e[4]=(d*t-r*l)*b,e[5]=(r*s-o*t)*b,e[6]=p*b,e[7]=(i*l-c*t)*b,e[8]=(a*t-i*s)*b,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,r,s,a,o){let l=Math.cos(s),c=Math.sin(s);return this.set(i*l,i*c,-i*(l*a+c*o)+a+e,-r*c,r*l,-r*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return Ui("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(wl.makeScale(e,t)),this}rotate(e){return Ui("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(wl.makeRotation(-e)),this}translate(e,t){return Ui("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(wl.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,i=e.elements;for(let r=0;r<9;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}},wl=new Ze,Uu=new Ze().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Ou=new Ze().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function pp(){let n={enabled:!0,workingColorSpace:es,spaces:{},convert:function(r,s,a){return this.enabled===!1||s===a||!s||!a||(this.spaces[s].transfer===ct&&(r.r=Zn(r.r),r.g=Zn(r.g),r.b=Zn(r.b)),this.spaces[s].primaries!==this.spaces[a].primaries&&(r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===ct&&(r.r=fr(r.r),r.g=fr(r.g),r.b=fr(r.b))),r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){return r===Qn?ts:this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,a){return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,s){return Ui("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),n.workingToColorSpace(r,s)},toWorkingColorSpace:function(r,s){return Ui("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),n.colorSpaceToWorking(r,s)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],i=[.3127,.329];return n.define({[es]:{primaries:e,whitePoint:i,transfer:ts,toXYZ:Uu,fromXYZ:Ou,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Bt},outputColorSpaceConfig:{drawingBufferColorSpace:Bt}},[Bt]:{primaries:e,whitePoint:i,transfer:ct,toXYZ:Uu,fromXYZ:Ou,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Bt}}}),n}var st=pp();function Zn(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function fr(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}var Qi,Ua=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let i;if(e instanceof HTMLCanvasElement)i=e;else{Qi===void 0&&(Qi=ns("canvas")),Qi.width=e.width,Qi.height=e.height;let r=Qi.getContext("2d");e instanceof ImageData?r.putImageData(e,0,0):r.drawImage(e,0,0,e.width,e.height),i=Qi}return i.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=ns("canvas");t.width=e.width,t.height=e.height;let i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);let r=i.getImageData(0,0,e.width,e.height),s=r.data;for(let a=0;a<s.length;a++)s[a]=Zn(s[a]/255)*255;return i.putImageData(r,0,0),t}else if(e.data){let t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor(Zn(t[i]/255)*255):t[i]=Zn(t[i]);return{data:t,width:e.width,height:e.height}}else return ke("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},mp=0,_r=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:mp++}),this.uuid=Pr(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let i={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let a=0,o=r.length;a<o;a++)r[a].isDataTexture?s.push(Tl(r[a].image)):s.push(Tl(r[a]))}else s=Tl(r);i.url=s}return t||(e.images[this.uuid]=i),i}};function Tl(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?Ua.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(ke("Texture: Unable to serialize Texture."),{})}var gp=0,El=new k,Jt=class n extends Sn{constructor(e=n.DEFAULT_IMAGE,t=n.DEFAULT_MAPPING,i=Fn,r=Fn,s=Lt,a=xi,o=mn,l=en,c=n.DEFAULT_ANISOTROPY,d=Qn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:gp++}),this.uuid=Pr(),this.name="",this.source=new _r(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Le(0,0),this.repeat=new Le(1,1),this.center=new Le(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ze,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=d,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(El).x}get height(){return this.source.getSize(El).y}get depth(){return this.source.getSize(El).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let i=e[t];if(i===void 0){ke(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){ke(`Texture.setValues(): property '${t}' does not exist.`);continue}r&&i&&r.isVector2&&i.isVector2||r&&i&&r.isVector3&&i.isVector3||r&&i&&r.isMatrix3&&i.isMatrix3?r.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==mc)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case La:e.x=e.x-Math.floor(e.x);break;case Fn:e.x=e.x<0?0:1;break;case Fa:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case La:e.y=e.y-Math.floor(e.y);break;case Fn:e.y=e.y<0?0:1;break;case Fa:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Jt.DEFAULT_IMAGE=null;Jt.DEFAULT_MAPPING=mc;Jt.DEFAULT_ANISOTROPY=1;var vt=class n{static{n.prototype.isVector4=!0}constructor(e=0,t=0,i=0,r=1){this.x=e,this.y=t,this.z=i,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,r){return this.x=e,this.y=t,this.z=i,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,i=this.y,r=this.z,s=this.w,a=e.elements;return this.x=a[0]*t+a[4]*i+a[8]*r+a[12]*s,this.y=a[1]*t+a[5]*i+a[9]*r+a[13]*s,this.z=a[2]*t+a[6]*i+a[10]*r+a[14]*s,this.w=a[3]*t+a[7]*i+a[11]*r+a[15]*s,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,r,s,l=e.elements,c=l[0],d=l[4],u=l[8],h=l[1],p=l[5],f=l[9],b=l[2],g=l[6],m=l[10];if(Math.abs(d-h)<.01&&Math.abs(u-b)<.01&&Math.abs(f-g)<.01){if(Math.abs(d+h)<.1&&Math.abs(u+b)<.1&&Math.abs(f+g)<.1&&Math.abs(c+p+m-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let E=(c+1)/2,v=(p+1)/2,C=(m+1)/2,S=(d+h)/4,_=(u+b)/4,x=(f+g)/4;return E>v&&E>C?E<.01?(i=0,r=.707106781,s=.707106781):(i=Math.sqrt(E),r=S/i,s=_/i):v>C?v<.01?(i=.707106781,r=0,s=.707106781):(r=Math.sqrt(v),i=S/r,s=x/r):C<.01?(i=.707106781,r=.707106781,s=0):(s=Math.sqrt(C),i=_/s,r=x/s),this.set(i,r,s,t),this}let M=Math.sqrt((g-f)*(g-f)+(u-b)*(u-b)+(h-d)*(h-d));return Math.abs(M)<.001&&(M=1),this.x=(g-f)/M,this.y=(u-b)/M,this.z=(h-d)/M,this.w=Math.acos((c+p+m-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=rt(this.x,e.x,t.x),this.y=rt(this.y,e.y,t.y),this.z=rt(this.z,e.z,t.z),this.w=rt(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=rt(this.x,e,t),this.y=rt(this.y,e,t),this.z=rt(this.z,e,t),this.w=rt(this.w,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(rt(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Oa=class extends Sn{constructor(e=1,t=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Lt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=i.depth,this.scissor=new vt(0,0,e,t),this.scissorTest=!1,this.viewport=new vt(0,0,e,t),this.textures=[];let r={width:e,height:t,depth:i.depth},s=new Jt(r),a=i.count;for(let o=0;o<a;o++)this.textures[o]=s.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:Lt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let r=0,s=this.textures.length;r<s;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=i,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,i=e.textures.length;t<i;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let r=Object.assign({},e.textures[t].image);this.textures[t].source=new _r(r)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},cn=class extends Oa{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}},is=class extends Jt{constructor(e=null,t=1,i=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=kt,this.minFilter=kt,this.wrapR=Fn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var Ba=class extends Jt{constructor(e=null,t=1,i=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=kt,this.minFilter=kt,this.wrapR=Fn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var mt=class n{static{n.prototype.isMatrix4=!0}constructor(e,t,i,r,s,a,o,l,c,d,u,h,p,f,b,g){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,a,o,l,c,d,u,h,p,f,b,g)}set(e,t,i,r,s,a,o,l,c,d,u,h,p,f,b,g){let m=this.elements;return m[0]=e,m[4]=t,m[8]=i,m[12]=r,m[1]=s,m[5]=a,m[9]=o,m[13]=l,m[2]=c,m[6]=d,m[10]=u,m[14]=h,m[3]=p,m[7]=f,m[11]=b,m[15]=g,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new n().fromArray(this.elements)}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){let t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),i.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,i=e.elements,r=1/er.setFromMatrixColumn(e,0).length(),s=1/er.setFromMatrixColumn(e,1).length(),a=1/er.setFromMatrixColumn(e,2).length();return t[0]=i[0]*r,t[1]=i[1]*r,t[2]=i[2]*r,t[3]=0,t[4]=i[4]*s,t[5]=i[5]*s,t[6]=i[6]*s,t[7]=0,t[8]=i[8]*a,t[9]=i[9]*a,t[10]=i[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,i=e.x,r=e.y,s=e.z,a=Math.cos(i),o=Math.sin(i),l=Math.cos(r),c=Math.sin(r),d=Math.cos(s),u=Math.sin(s);if(e.order==="XYZ"){let h=a*d,p=a*u,f=o*d,b=o*u;t[0]=l*d,t[4]=-l*u,t[8]=c,t[1]=p+f*c,t[5]=h-b*c,t[9]=-o*l,t[2]=b-h*c,t[6]=f+p*c,t[10]=a*l}else if(e.order==="YXZ"){let h=l*d,p=l*u,f=c*d,b=c*u;t[0]=h+b*o,t[4]=f*o-p,t[8]=a*c,t[1]=a*u,t[5]=a*d,t[9]=-o,t[2]=p*o-f,t[6]=b+h*o,t[10]=a*l}else if(e.order==="ZXY"){let h=l*d,p=l*u,f=c*d,b=c*u;t[0]=h-b*o,t[4]=-a*u,t[8]=f+p*o,t[1]=p+f*o,t[5]=a*d,t[9]=b-h*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){let h=a*d,p=a*u,f=o*d,b=o*u;t[0]=l*d,t[4]=f*c-p,t[8]=h*c+b,t[1]=l*u,t[5]=b*c+h,t[9]=p*c-f,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){let h=a*l,p=a*c,f=o*l,b=o*c;t[0]=l*d,t[4]=b-h*u,t[8]=f*u+p,t[1]=u,t[5]=a*d,t[9]=-o*d,t[2]=-c*d,t[6]=p*u+f,t[10]=h-b*u}else if(e.order==="XZY"){let h=a*l,p=a*c,f=o*l,b=o*c;t[0]=l*d,t[4]=-u,t[8]=c*d,t[1]=h*u+b,t[5]=a*d,t[9]=p*u-f,t[2]=f*u-p,t[6]=o*d,t[10]=b*u+h}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(_p,e,xp)}lookAt(e,t,i){let r=this.elements;return an.subVectors(e,t),an.lengthSq()===0&&(an.z=1),an.normalize(),ii.crossVectors(i,an),ii.lengthSq()===0&&(Math.abs(i.z)===1?an.x+=1e-4:an.z+=1e-4,an.normalize(),ii.crossVectors(i,an)),ii.normalize(),ea.crossVectors(an,ii),r[0]=ii.x,r[4]=ea.x,r[8]=an.x,r[1]=ii.y,r[5]=ea.y,r[9]=an.y,r[2]=ii.z,r[6]=ea.z,r[10]=an.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,r=t.elements,s=this.elements,a=i[0],o=i[4],l=i[8],c=i[12],d=i[1],u=i[5],h=i[9],p=i[13],f=i[2],b=i[6],g=i[10],m=i[14],M=i[3],E=i[7],v=i[11],C=i[15],S=r[0],_=r[4],x=r[8],A=r[12],T=r[1],R=r[5],I=r[9],N=r[13],U=r[2],F=r[6],O=r[10],D=r[14],G=r[3],K=r[7],Q=r[11],ne=r[15];return s[0]=a*S+o*T+l*U+c*G,s[4]=a*_+o*R+l*F+c*K,s[8]=a*x+o*I+l*O+c*Q,s[12]=a*A+o*N+l*D+c*ne,s[1]=d*S+u*T+h*U+p*G,s[5]=d*_+u*R+h*F+p*K,s[9]=d*x+u*I+h*O+p*Q,s[13]=d*A+u*N+h*D+p*ne,s[2]=f*S+b*T+g*U+m*G,s[6]=f*_+b*R+g*F+m*K,s[10]=f*x+b*I+g*O+m*Q,s[14]=f*A+b*N+g*D+m*ne,s[3]=M*S+E*T+v*U+C*G,s[7]=M*_+E*R+v*F+C*K,s[11]=M*x+E*I+v*O+C*Q,s[15]=M*A+E*N+v*D+C*ne,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[4],r=e[8],s=e[12],a=e[1],o=e[5],l=e[9],c=e[13],d=e[2],u=e[6],h=e[10],p=e[14],f=e[3],b=e[7],g=e[11],m=e[15],M=l*p-c*h,E=o*p-c*u,v=o*h-l*u,C=a*p-c*d,S=a*h-l*d,_=a*u-o*d;return t*(b*M-g*E+m*v)-i*(f*M-g*C+m*S)+r*(f*E-b*C+m*_)-s*(f*v-b*S+g*_)}determinantAffine(){let e=this.elements,t=e[0],i=e[4],r=e[8],s=e[1],a=e[5],o=e[9],l=e[2],c=e[6],d=e[10];return t*(a*d-o*c)-i*(s*d-o*l)+r*(s*c-a*l)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=i),this}invert(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],d=e[8],u=e[9],h=e[10],p=e[11],f=e[12],b=e[13],g=e[14],m=e[15],M=t*o-i*a,E=t*l-r*a,v=t*c-s*a,C=i*l-r*o,S=i*c-s*o,_=r*c-s*l,x=d*b-u*f,A=d*g-h*f,T=d*m-p*f,R=u*g-h*b,I=u*m-p*b,N=h*m-p*g,U=M*N-E*I+v*R+C*T-S*A+_*x;if(U===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let F=1/U;return e[0]=(o*N-l*I+c*R)*F,e[1]=(r*I-i*N-s*R)*F,e[2]=(b*_-g*S+m*C)*F,e[3]=(h*S-u*_-p*C)*F,e[4]=(l*T-a*N-c*A)*F,e[5]=(t*N-r*T+s*A)*F,e[6]=(g*v-f*_-m*E)*F,e[7]=(d*_-h*v+p*E)*F,e[8]=(a*I-o*T+c*x)*F,e[9]=(i*T-t*I-s*x)*F,e[10]=(f*S-b*v+m*M)*F,e[11]=(u*v-d*S-p*M)*F,e[12]=(o*A-a*R-l*x)*F,e[13]=(t*R-i*A+r*x)*F,e[14]=(b*E-f*C-g*M)*F,e[15]=(d*C-u*E+h*M)*F,this}scale(e){let t=this.elements,i=e.x,r=e.y,s=e.z;return t[0]*=i,t[4]*=r,t[8]*=s,t[1]*=i,t[5]*=r,t[9]*=s,t[2]*=i,t[6]*=r,t[10]*=s,t[3]*=i,t[7]*=r,t[11]*=s,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,r))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let i=Math.cos(t),r=Math.sin(t),s=1-i,a=e.x,o=e.y,l=e.z,c=s*a,d=s*o;return this.set(c*a+i,c*o-r*l,c*l+r*o,0,c*o+r*l,d*o+i,d*l-r*a,0,c*l-r*o,d*l+r*a,s*l*l+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,r,s,a){return this.set(1,i,s,0,e,1,a,0,t,r,1,0,0,0,0,1),this}compose(e,t,i){let r=this.elements,s=t._x,a=t._y,o=t._z,l=t._w,c=s+s,d=a+a,u=o+o,h=s*c,p=s*d,f=s*u,b=a*d,g=a*u,m=o*u,M=l*c,E=l*d,v=l*u,C=i.x,S=i.y,_=i.z;return r[0]=(1-(b+m))*C,r[1]=(p+v)*C,r[2]=(f-E)*C,r[3]=0,r[4]=(p-v)*S,r[5]=(1-(h+m))*S,r[6]=(g+M)*S,r[7]=0,r[8]=(f+E)*_,r[9]=(g-M)*_,r[10]=(1-(h+b))*_,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,i){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let s=this.determinantAffine();if(s===0)return i.set(1,1,1),t.identity(),this;let a=er.set(r[0],r[1],r[2]).length(),o=er.set(r[4],r[5],r[6]).length(),l=er.set(r[8],r[9],r[10]).length();s<0&&(a=-a),xn.copy(this);let c=1/a,d=1/o,u=1/l;return xn.elements[0]*=c,xn.elements[1]*=c,xn.elements[2]*=c,xn.elements[4]*=d,xn.elements[5]*=d,xn.elements[6]*=d,xn.elements[8]*=u,xn.elements[9]*=u,xn.elements[10]*=u,t.setFromRotationMatrix(xn),i.x=a,i.y=o,i.z=l,this}makePerspective(e,t,i,r,s,a,o=bn,l=!1){let c=this.elements,d=2*s/(t-e),u=2*s/(i-r),h=(t+e)/(t-e),p=(i+r)/(i-r),f,b;if(l)f=s/(a-s),b=a*s/(a-s);else if(o===bn)f=-(a+s)/(a-s),b=-2*a*s/(a-s);else if(o===pr)f=-a/(a-s),b=-a*s/(a-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=d,c[4]=0,c[8]=h,c[12]=0,c[1]=0,c[5]=u,c[9]=p,c[13]=0,c[2]=0,c[6]=0,c[10]=f,c[14]=b,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,i,r,s,a,o=bn,l=!1){let c=this.elements,d=2/(t-e),u=2/(i-r),h=-(t+e)/(t-e),p=-(i+r)/(i-r),f,b;if(l)f=1/(a-s),b=a/(a-s);else if(o===bn)f=-2/(a-s),b=-(a+s)/(a-s);else if(o===pr)f=-1/(a-s),b=-s/(a-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=d,c[4]=0,c[8]=0,c[12]=h,c[1]=0,c[5]=u,c[9]=0,c[13]=p,c[2]=0,c[6]=0,c[10]=f,c[14]=b,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,i=e.elements;for(let r=0;r<16;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}},er=new k,xn=new mt,_p=new k(0,0,0),xp=new k(1,1,1),ii=new k,ea=new k,an=new k,Bu=new mt,ku=new ln,Un=class n{constructor(e=0,t=0,i=0,r=n.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,r=this._order){return this._x=e,this._y=t,this._z=i,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){let r=e.elements,s=r[0],a=r[4],o=r[8],l=r[1],c=r[5],d=r[9],u=r[2],h=r[6],p=r[10];switch(t){case"XYZ":this._y=Math.asin(rt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-d,p),this._z=Math.atan2(-a,s)):(this._x=Math.atan2(h,c),this._z=0);break;case"YXZ":this._x=Math.asin(-rt(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(o,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,s),this._z=0);break;case"ZXY":this._x=Math.asin(rt(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(-u,p),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-rt(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(h,p),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(rt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-d,c),this._y=Math.atan2(-u,s)):(this._x=0,this._y=Math.atan2(o,p));break;case"XZY":this._z=Math.asin(-rt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(h,c),this._y=Math.atan2(o,s)):(this._x=Math.atan2(-d,p),this._y=0);break;default:ke("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return Bu.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Bu,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return ku.setFromEuler(this),this.setFromQuaternion(ku,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Un.DEFAULT_ORDER="XYZ";var xr=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},yp=0,zu=new k,tr=new ln,Wn=new mt,ta=new k,Wr=new k,vp=new k,bp=new ln,Vu=new k(1,0,0),Gu=new k(0,1,0),Hu=new k(0,0,1),Wu={type:"added"},Mp={type:"removed"},nr={type:"childadded",child:null},Al={type:"childremoved",child:null},zt=class n extends Sn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:yp++}),this.uuid=Pr(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=n.DEFAULT_UP.clone();let e=new k,t=new Un,i=new ln,r=new k(1,1,1);function s(){i.setFromEuler(t,!1)}function a(){t.setFromQuaternion(i,void 0,!1)}t._onChange(s),i._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new mt},normalMatrix:{value:new Ze}}),this.matrix=new mt,this.matrixWorld=new mt,this.matrixAutoUpdate=n.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=n.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new xr,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return tr.setFromAxisAngle(e,t),this.quaternion.multiply(tr),this}rotateOnWorldAxis(e,t){return tr.setFromAxisAngle(e,t),this.quaternion.premultiply(tr),this}rotateX(e){return this.rotateOnAxis(Vu,e)}rotateY(e){return this.rotateOnAxis(Gu,e)}rotateZ(e){return this.rotateOnAxis(Hu,e)}translateOnAxis(e,t){return zu.copy(e).applyQuaternion(this.quaternion),this.position.add(zu.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Vu,e)}translateY(e){return this.translateOnAxis(Gu,e)}translateZ(e){return this.translateOnAxis(Hu,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Wn.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?ta.copy(e):ta.set(e,t,i);let r=this.parent;this.updateWorldMatrix(!0,!1),Wr.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Wn.lookAt(Wr,ta,this.up):Wn.lookAt(ta,Wr,this.up),this.quaternion.setFromRotationMatrix(Wn),r&&(Wn.extractRotation(r.matrixWorld),tr.setFromRotationMatrix(Wn),this.quaternion.premultiply(tr.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Ge("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Wu),nr.child=e,this.dispatchEvent(nr),nr.child=null):Ge("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Mp),Al.child=e,this.dispatchEvent(Al),Al.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Wn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Wn.multiply(e.parent.matrixWorld)),e.applyMatrix4(Wn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Wu),nr.child=e,this.dispatchEvent(nr),nr.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,r=this.children.length;i<r;i++){let a=this.children[i].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);let r=this.children;for(let s=0,a=r.length;s<a;s++)r[s].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Wr,e,vp),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Wr,bp,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,i=e.y,r=e.z,s=this.matrix.elements;s[12]+=t-s[0]*t-s[4]*i-s[8]*r,s[13]+=i-s[1]*t-s[5]*i-s[9]*r,s[14]+=r-s[2]*t-s[6]*i-s[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].updateMatrixWorld(e)}updateWorldMatrix(e,t,i=!1){let r=this.parent;if(e===!0&&r!==null&&r.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),t===!0){let s=this.children;for(let a=0,o=s.length;a<o;a++)s[a].updateWorldMatrix(!1,!0,i)}}toJSON(e){let t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),this.static!==!1&&(r.static=this.static),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(o=>({...o})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function s(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let l=o.shapes;if(Array.isArray(l))for(let c=0,d=l.length;c<d;c++){let u=l[c];s(e.shapes,u)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(s(e.materials,this.material[l]));r.material=o}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let o=0;o<this.children.length;o++)r.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let o=0;o<this.animations.length;o++){let l=this.animations[o];r.animations.push(s(e.animations,l))}}if(t){let o=a(e.geometries),l=a(e.materials),c=a(e.textures),d=a(e.images),u=a(e.shapes),h=a(e.skeletons),p=a(e.animations),f=a(e.nodes);o.length>0&&(i.geometries=o),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),d.length>0&&(i.images=d),u.length>0&&(i.shapes=u),h.length>0&&(i.skeletons=h),p.length>0&&(i.animations=p),f.length>0&&(i.nodes=f)}return i.object=r,i;function a(o){let l=[];for(let c in o){let d=o[c];delete d.metadata,l.push(d)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){let r=e.children[i];this.add(r.clone())}return this}};zt.DEFAULT_UP=new k(0,1,0);zt.DEFAULT_MATRIX_AUTO_UPDATE=!0;zt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Zt=class extends zt{constructor(){super(),this.isGroup=!0,this.type="Group"}},Sp={type:"move"},yr=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Zt,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Zt,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new k,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new k),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Zt,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new k,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new k,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let r=null,s=null,a=null,o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(let b of e.hand.values()){let g=t.getJointPose(b,i),m=this._getHandJoint(c,b);g!==null&&(m.matrix.fromArray(g.transform.matrix),m.matrix.decompose(m.position,m.rotation,m.scale),m.matrixWorldNeedsUpdate=!0,m.jointRadius=g.radius),m.visible=g!==null}let d=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],h=d.position.distanceTo(u.position),p=.02,f=.005;c.inputState.pinching&&h>p+f?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&h<=p-f&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,i),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));o!==null&&(r=t.getPose(e.targetRaySpace,i),r===null&&s!==null&&(r=s),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Sp)))}return o!==null&&(o.visible=r!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let i=new Zt;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}},Gh={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},ri={h:0,s:0,l:0},na={h:0,s:0,l:0};function Rl(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}var $e=class{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){let r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Bt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,st.colorSpaceToWorking(this,t),this}setRGB(e,t,i,r=st.workingColorSpace){return this.r=e,this.g=t,this.b=i,st.colorSpaceToWorking(this,r),this}setHSL(e,t,i,r=st.workingColorSpace){if(e=wc(e,1),t=rt(t,0,1),i=rt(i,0,1),t===0)this.r=this.g=this.b=i;else{let s=i<=.5?i*(1+t):i+t-i*t,a=2*i-s;this.r=Rl(a,s,e+1/3),this.g=Rl(a,s,e),this.b=Rl(a,s,e-1/3)}return st.colorSpaceToWorking(this,r),this}setStyle(e,t=Bt){function i(s){s!==void 0&&parseFloat(s)<1&&ke("Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s,a=r[1],o=r[2];switch(a){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:ke("Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let s=r[1],a=s.length;if(a===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(s,16),t);ke("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Bt){let i=Gh[e.toLowerCase()];return i!==void 0?this.setHex(i,t):ke("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Zn(e.r),this.g=Zn(e.g),this.b=Zn(e.b),this}copyLinearToSRGB(e){return this.r=fr(e.r),this.g=fr(e.g),this.b=fr(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Bt){return st.workingToColorSpace(Wt.copy(this),e),Math.round(rt(Wt.r*255,0,255))*65536+Math.round(rt(Wt.g*255,0,255))*256+Math.round(rt(Wt.b*255,0,255))}getHexString(e=Bt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=st.workingColorSpace){st.workingToColorSpace(Wt.copy(this),t);let i=Wt.r,r=Wt.g,s=Wt.b,a=Math.max(i,r,s),o=Math.min(i,r,s),l,c,d=(o+a)/2;if(o===a)l=0,c=0;else{let u=a-o;switch(c=d<=.5?u/(a+o):u/(2-a-o),a){case i:l=(r-s)/u+(r<s?6:0);break;case r:l=(s-i)/u+2;break;case s:l=(i-r)/u+4;break}l/=6}return e.h=l,e.s=c,e.l=d,e}getRGB(e,t=st.workingColorSpace){return st.workingToColorSpace(Wt.copy(this),t),e.r=Wt.r,e.g=Wt.g,e.b=Wt.b,e}getStyle(e=Bt){st.workingToColorSpace(Wt.copy(this),e);let t=Wt.r,i=Wt.g,r=Wt.b;return e!==Bt?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(r*255)})`}offsetHSL(e,t,i){return this.getHSL(ri),this.setHSL(ri.h+e,ri.s+t,ri.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(ri),e.getHSL(na);let i=jr(ri.h,na.h,t),r=jr(ri.s,na.s,t),s=jr(ri.l,na.l,t);return this.setHSL(i,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,i=this.g,r=this.b,s=e.elements;return this.r=s[0]*t+s[3]*i+s[6]*r,this.g=s[1]*t+s[4]*i+s[7]*r,this.b=s[2]*t+s[5]*i+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Wt=new $e;$e.NAMES=Gh;var ki=class n{constructor(e,t=1,i=1e3){this.isFog=!0,this.name="",this.color=new $e(e),this.near=t,this.far=i}clone(){return new n(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}},rs=class extends zt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Un,this.environmentIntensity=1,this.environmentRotation=new Un,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}},yn=new k,Xn=new k,Cl=new k,qn=new k,ir=new k,rr=new k,Xu=new k,Pl=new k,Il=new k,Dl=new k,Ll=new vt,Fl=new vt,Nl=new vt,ci=class n{constructor(e=new k,t=new k,i=new k){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,r){r.subVectors(i,t),yn.subVectors(e,t),r.cross(yn);let s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(e,t,i,r,s){yn.subVectors(r,t),Xn.subVectors(i,t),Cl.subVectors(e,t);let a=yn.dot(yn),o=yn.dot(Xn),l=yn.dot(Cl),c=Xn.dot(Xn),d=Xn.dot(Cl),u=a*c-o*o;if(u===0)return s.set(0,0,0),null;let h=1/u,p=(c*l-o*d)*h,f=(a*d-o*l)*h;return s.set(1-p-f,f,p)}static containsPoint(e,t,i,r){return this.getBarycoord(e,t,i,r,qn)===null?!1:qn.x>=0&&qn.y>=0&&qn.x+qn.y<=1}static getInterpolation(e,t,i,r,s,a,o,l){return this.getBarycoord(e,t,i,r,qn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,qn.x),l.addScaledVector(a,qn.y),l.addScaledVector(o,qn.z),l)}static getInterpolatedAttribute(e,t,i,r,s,a){return Ll.setScalar(0),Fl.setScalar(0),Nl.setScalar(0),Ll.fromBufferAttribute(e,t),Fl.fromBufferAttribute(e,i),Nl.fromBufferAttribute(e,r),a.setScalar(0),a.addScaledVector(Ll,s.x),a.addScaledVector(Fl,s.y),a.addScaledVector(Nl,s.z),a}static isFrontFacing(e,t,i,r){return yn.subVectors(i,t),Xn.subVectors(e,t),yn.cross(Xn).dot(r)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,r){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,i,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return yn.subVectors(this.c,this.b),Xn.subVectors(this.a,this.b),yn.cross(Xn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return n.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return n.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,r,s){return n.getInterpolation(e,this.a,this.b,this.c,t,i,r,s)}containsPoint(e){return n.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return n.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let i=this.a,r=this.b,s=this.c,a,o;ir.subVectors(r,i),rr.subVectors(s,i),Pl.subVectors(e,i);let l=ir.dot(Pl),c=rr.dot(Pl);if(l<=0&&c<=0)return t.copy(i);Il.subVectors(e,r);let d=ir.dot(Il),u=rr.dot(Il);if(d>=0&&u<=d)return t.copy(r);let h=l*u-d*c;if(h<=0&&l>=0&&d<=0)return a=l/(l-d),t.copy(i).addScaledVector(ir,a);Dl.subVectors(e,s);let p=ir.dot(Dl),f=rr.dot(Dl);if(f>=0&&p<=f)return t.copy(s);let b=p*c-l*f;if(b<=0&&c>=0&&f<=0)return o=c/(c-f),t.copy(i).addScaledVector(rr,o);let g=d*f-p*u;if(g<=0&&u-d>=0&&p-f>=0)return Xu.subVectors(s,r),o=(u-d)/(u-d+(p-f)),t.copy(r).addScaledVector(Xu,o);let m=1/(g+b+h);return a=b*m,o=h*m,t.copy(i).addScaledVector(ir,a).addScaledVector(rr,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},On=class{constructor(e=new k(1/0,1/0,1/0),t=new k(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(vn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(vn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let i=vn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let i=e.geometry;if(i!==void 0){let s=i.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=s.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,vn):vn.fromBufferAttribute(s,a),vn.applyMatrix4(e.matrixWorld),this.expandByPoint(vn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),ia.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),ia.copy(i.boundingBox)),ia.applyMatrix4(e.matrixWorld),this.union(ia)}let r=e.children;for(let s=0,a=r.length;s<a;s++)this.expandByObject(r[s],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,vn),vn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Xr),ra.subVectors(this.max,Xr),sr.subVectors(e.a,Xr),ar.subVectors(e.b,Xr),or.subVectors(e.c,Xr),si.subVectors(ar,sr),ai.subVectors(or,ar),Ii.subVectors(sr,or);let t=[0,-si.z,si.y,0,-ai.z,ai.y,0,-Ii.z,Ii.y,si.z,0,-si.x,ai.z,0,-ai.x,Ii.z,0,-Ii.x,-si.y,si.x,0,-ai.y,ai.x,0,-Ii.y,Ii.x,0];return!Ul(t,sr,ar,or,ra)||(t=[1,0,0,0,1,0,0,0,1],!Ul(t,sr,ar,or,ra))?!1:(sa.crossVectors(si,ai),t=[sa.x,sa.y,sa.z],Ul(t,sr,ar,or,ra))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,vn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(vn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:($n[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),$n[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),$n[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),$n[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),$n[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),$n[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),$n[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),$n[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints($n),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},$n=[new k,new k,new k,new k,new k,new k,new k,new k],vn=new k,ia=new On,sr=new k,ar=new k,or=new k,si=new k,ai=new k,Ii=new k,Xr=new k,ra=new k,sa=new k,Di=new k;function Ul(n,e,t,i,r){for(let s=0,a=n.length-3;s<=a;s+=3){Di.fromArray(n,s);let o=r.x*Math.abs(Di.x)+r.y*Math.abs(Di.y)+r.z*Math.abs(Di.z),l=e.dot(Di),c=t.dot(Di),d=i.dot(Di);if(Math.max(-Math.max(l,c,d),Math.min(l,c,d))>o)return!1}return!0}var It=new k,aa=new Le,wp=0,Kt=class extends Sn{constructor(e,t,i=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:wp++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=Kl,this.updateRanges=[],this.gpuType=pn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let r=0,s=this.itemSize;r<s;r++)this.array[e+r]=t.array[i+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)aa.fromBufferAttribute(this,t),aa.applyMatrix3(e),this.setXY(t,aa.x,aa.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)It.fromBufferAttribute(this,t),It.applyMatrix3(e),this.setXYZ(t,It.x,It.y,It.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)It.fromBufferAttribute(this,t),It.applyMatrix4(e),this.setXYZ(t,It.x,It.y,It.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)It.fromBufferAttribute(this,t),It.applyNormalMatrix(e),this.setXYZ(t,It.x,It.y,It.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)It.fromBufferAttribute(this,t),It.transformDirection(e),this.setXYZ(t,It.x,It.y,It.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=dr(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=Yt(i,this.array)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=dr(t,this.array)),t}setX(e,t){return this.normalized&&(t=Yt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=dr(t,this.array)),t}setY(e,t){return this.normalized&&(t=Yt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=dr(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Yt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=dr(t,this.array)),t}setW(e,t){return this.normalized&&(t=Yt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=Yt(t,this.array),i=Yt(i,this.array)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,r){return e*=this.itemSize,this.normalized&&(t=Yt(t,this.array),i=Yt(i,this.array),r=Yt(r,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this}setXYZW(e,t,i,r,s){return e*=this.itemSize,this.normalized&&(t=Yt(t,this.array),i=Yt(i,this.array),r=Yt(r,this.array),s=Yt(s,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Kl&&(e.usage=this.usage),e}dispose(){this.dispatchEvent({type:"dispose"})}},ss=class extends Kt{constructor(e,t,i){super(new Int8Array(e),t,i)}};var as=class extends Kt{constructor(e,t,i){super(new Uint16Array(e),t,i)}};var os=class extends Kt{constructor(e,t,i){super(new Uint32Array(e),t,i)}};var ut=class extends Kt{constructor(e,t,i){super(new Float32Array(e),t,i)}},Tp=new On,qr=new k,Ol=new k,hi=class{constructor(e=new k,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let i=this.center;t!==void 0?i.copy(t):Tp.setFromPoints(e).getCenter(i);let r=0;for(let s=0,a=e.length;s<a;s++)r=Math.max(r,i.distanceToSquared(e[s]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;qr.subVectors(e,this.center);let t=qr.lengthSq();if(t>this.radius*this.radius){let i=Math.sqrt(t),r=(i-this.radius)*.5;this.center.addScaledVector(qr,r/i),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Ol.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(qr.copy(e.center).add(Ol)),this.expandByPoint(qr.copy(e.center).sub(Ol))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},Ep=0,fn=new mt,Bl=new zt,lr=new k,on=new On,$r=new On,Ot=new k,Ct=class n extends Sn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Ep++}),this.uuid=Pr(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Kf(e)?os:as)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let s=new Ze().getNormalMatrix(e);i.applyNormalMatrix(s),i.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return fn.makeRotationFromQuaternion(e),this.applyMatrix4(fn),this}rotateX(e){return fn.makeRotationX(e),this.applyMatrix4(fn),this}rotateY(e){return fn.makeRotationY(e),this.applyMatrix4(fn),this}rotateZ(e){return fn.makeRotationZ(e),this.applyMatrix4(fn),this}translate(e,t,i){return fn.makeTranslation(e,t,i),this.applyMatrix4(fn),this}scale(e,t,i){return fn.makeScale(e,t,i),this.applyMatrix4(fn),this}lookAt(e){return Bl.lookAt(e),Bl.updateMatrix(),this.applyMatrix4(Bl.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(lr).negate(),this.translate(lr.x,lr.y,lr.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let i=[];for(let r=0,s=e.length;r<s;r++){let a=e[r];i.push(a.x,a.y,a.z||0)}this.setAttribute("position",new ut(i,3))}else{let i=Math.min(e.length,t.count);for(let r=0;r<i;r++){let s=e[r];t.setXYZ(r,s.x,s.y,s.z||0)}e.length>t.count&&ke("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new On);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ge("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new k(-1/0,-1/0,-1/0),new k(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,r=t.length;i<r;i++){let s=t[i];on.setFromBufferAttribute(s),this.morphTargetsRelative?(Ot.addVectors(this.boundingBox.min,on.min),this.boundingBox.expandByPoint(Ot),Ot.addVectors(this.boundingBox.max,on.max),this.boundingBox.expandByPoint(Ot)):(this.boundingBox.expandByPoint(on.min),this.boundingBox.expandByPoint(on.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ge('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new hi);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ge("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new k,1/0);return}if(e){let i=this.boundingSphere.center;if(on.setFromBufferAttribute(e),t)for(let s=0,a=t.length;s<a;s++){let o=t[s];$r.setFromBufferAttribute(o),this.morphTargetsRelative?(Ot.addVectors(on.min,$r.min),on.expandByPoint(Ot),Ot.addVectors(on.max,$r.max),on.expandByPoint(Ot)):(on.expandByPoint($r.min),on.expandByPoint($r.max))}on.getCenter(i);let r=0;for(let s=0,a=e.count;s<a;s++)Ot.fromBufferAttribute(e,s),r=Math.max(r,i.distanceToSquared(Ot));if(t)for(let s=0,a=t.length;s<a;s++){let o=t[s],l=this.morphTargetsRelative;for(let c=0,d=o.count;c<d;c++)Ot.fromBufferAttribute(o,c),l&&(lr.fromBufferAttribute(e,c),Ot.add(lr)),r=Math.max(r,i.distanceToSquared(Ot))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&Ge('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Ge("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=t.position,r=t.normal,s=t.uv,a=this.getAttribute("tangent");(a===void 0||a.count!==i.count)&&(a=new Kt(new Float32Array(4*i.count),4),this.setAttribute("tangent",a));let o=[],l=[];for(let x=0;x<i.count;x++)o[x]=new k,l[x]=new k;let c=new k,d=new k,u=new k,h=new Le,p=new Le,f=new Le,b=new k,g=new k;function m(x,A,T){c.fromBufferAttribute(i,x),d.fromBufferAttribute(i,A),u.fromBufferAttribute(i,T),h.fromBufferAttribute(s,x),p.fromBufferAttribute(s,A),f.fromBufferAttribute(s,T),d.sub(c),u.sub(c),p.sub(h),f.sub(h);let R=1/(p.x*f.y-f.x*p.y);isFinite(R)&&(b.copy(d).multiplyScalar(f.y).addScaledVector(u,-p.y).multiplyScalar(R),g.copy(u).multiplyScalar(p.x).addScaledVector(d,-f.x).multiplyScalar(R),o[x].add(b),o[A].add(b),o[T].add(b),l[x].add(g),l[A].add(g),l[T].add(g))}let M=this.groups;M.length===0&&(M=[{start:0,count:e.count}]);for(let x=0,A=M.length;x<A;++x){let T=M[x],R=T.start,I=T.count;for(let N=R,U=R+I;N<U;N+=3)m(e.getX(N+0),e.getX(N+1),e.getX(N+2))}let E=new k,v=new k,C=new k,S=new k;function _(x){C.fromBufferAttribute(r,x),S.copy(C);let A=o[x];E.copy(A),E.sub(C.multiplyScalar(C.dot(A))).normalize(),v.crossVectors(S,A);let R=v.dot(l[x])<0?-1:1;a.setXYZW(x,E.x,E.y,E.z,R)}for(let x=0,A=M.length;x<A;++x){let T=M[x],R=T.start,I=T.count;for(let N=R,U=R+I;N<U;N+=3)_(e.getX(N+0)),_(e.getX(N+1)),_(e.getX(N+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==t.count)i=new Kt(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let h=0,p=i.count;h<p;h++)i.setXYZ(h,0,0,0);let r=new k,s=new k,a=new k,o=new k,l=new k,c=new k,d=new k,u=new k;if(e)for(let h=0,p=e.count;h<p;h+=3){let f=e.getX(h+0),b=e.getX(h+1),g=e.getX(h+2);r.fromBufferAttribute(t,f),s.fromBufferAttribute(t,b),a.fromBufferAttribute(t,g),d.subVectors(a,s),u.subVectors(r,s),d.cross(u),o.fromBufferAttribute(i,f),l.fromBufferAttribute(i,b),c.fromBufferAttribute(i,g),o.add(d),l.add(d),c.add(d),i.setXYZ(f,o.x,o.y,o.z),i.setXYZ(b,l.x,l.y,l.z),i.setXYZ(g,c.x,c.y,c.z)}else for(let h=0,p=t.count;h<p;h+=3)r.fromBufferAttribute(t,h+0),s.fromBufferAttribute(t,h+1),a.fromBufferAttribute(t,h+2),d.subVectors(a,s),u.subVectors(r,s),d.cross(u),i.setXYZ(h+0,d.x,d.y,d.z),i.setXYZ(h+1,d.x,d.y,d.z),i.setXYZ(h+2,d.x,d.y,d.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)Ot.fromBufferAttribute(e,t),Ot.normalize(),e.setXYZ(t,Ot.x,Ot.y,Ot.z)}toNonIndexed(){function e(o,l){let c=o.array,d=o.itemSize,u=o.normalized,h=new c.constructor(l.length*d),p=0,f=0;for(let b=0,g=l.length;b<g;b++){o.isInterleavedBufferAttribute?p=l[b]*o.data.stride+o.offset:p=l[b]*d;for(let m=0;m<d;m++)h[f++]=c[p++]}return new Kt(h,d,u)}if(this.index===null)return ke("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new n,i=this.index.array,r=this.attributes;for(let o in r){let l=r[o],c=e(l,i);t.setAttribute(o,c)}let s=this.morphAttributes;for(let o in s){let l=[],c=s[o];for(let d=0,u=c.length;d<u;d++){let h=c[d],p=e(h,i);l.push(p)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;let a=this.groups;for(let o=0,l=a.length;o<l;o++){let c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let i=this.attributes;for(let l in i){let c=i[l];e.data.attributes[l]=c.toJSON(e.data)}let r={},s=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],d=[];for(let u=0,h=c.length;u<h;u++){let p=c[u];d.push(p.toJSON(e.data))}d.length>0&&(r[l]=d,s=!0)}s&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let i=e.index;i!==null&&this.setIndex(i.clone());let r=e.attributes;for(let c in r){let d=r[c];this.setAttribute(c,d.clone(t))}let s=e.morphAttributes;for(let c in s){let d=[],u=s[c];for(let h=0,p=u.length;h<p;h++)d.push(u[h].clone(t));this.morphAttributes[c]=d}this.morphTargetsRelative=e.morphTargetsRelative;let a=e.groups;for(let c=0,d=a.length;c<d;c++){let u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Ap=0,Kn=class extends Sn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Ap++}),this.uuid=Pr(),this.name="",this.type="Material",this.blending=Oi,this.side=Mn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=wa,this.blendDst=Ta,this.blendEquation=ui,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new $e(0,0,0),this.blendAlpha=0,this.depthFunc=Bi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Zl,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Ni,this.stencilZFail=Ni,this.stencilZPass=Ni,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let i=e[t];if(i===void 0){ke(`Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){ke(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(i):r&&r.isVector2&&i&&i.isVector2||r&&r.isEuler&&i&&i.isEuler||r&&r.isVector3&&i&&i.isVector3?r.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Oi&&(i.blending=this.blending),this.side!==Mn&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==wa&&(i.blendSrc=this.blendSrc),this.blendDst!==Ta&&(i.blendDst=this.blendDst),this.blendEquation!==ui&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==Bi&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Zl&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Ni&&(i.stencilFail=this.stencilFail),this.stencilZFail!==Ni&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==Ni&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.allowOverride===!1&&(i.allowOverride=!1),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function r(s){let a=[];for(let o in s){let l=s[o];delete l.metadata,a.push(l)}return a}if(t){let s=r(e.textures),a=r(e.images);s.length>0&&(i.textures=s),a.length>0&&(i.images=a)}return i}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new $e().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let i=e.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new Le().fromArray(i)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Le().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,i=null;if(t!==null){let r=t.length;i=new Array(r);for(let s=0;s!==r;++s)i[s]=t[s].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}};var Yn=new k,kl=new k,oa=new k,oi=new k,zl=new k,la=new k,Vl=new k,zi=class{constructor(e=new k,t=new k(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Yn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Yn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Yn.copy(this.origin).addScaledVector(this.direction,t),Yn.distanceToSquared(e))}distanceSqToSegment(e,t,i,r){kl.copy(e).add(t).multiplyScalar(.5),oa.copy(t).sub(e).normalize(),oi.copy(this.origin).sub(kl);let s=e.distanceTo(t)*.5,a=-this.direction.dot(oa),o=oi.dot(this.direction),l=-oi.dot(oa),c=oi.lengthSq(),d=Math.abs(1-a*a),u,h,p,f;if(d>0)if(u=a*l-o,h=a*o-l,f=s*d,u>=0)if(h>=-f)if(h<=f){let b=1/d;u*=b,h*=b,p=u*(u+a*h+2*o)+h*(a*u+h+2*l)+c}else h=s,u=Math.max(0,-(a*h+o)),p=-u*u+h*(h+2*l)+c;else h=-s,u=Math.max(0,-(a*h+o)),p=-u*u+h*(h+2*l)+c;else h<=-f?(u=Math.max(0,-(-a*s+o)),h=u>0?-s:Math.min(Math.max(-s,-l),s),p=-u*u+h*(h+2*l)+c):h<=f?(u=0,h=Math.min(Math.max(-s,-l),s),p=h*(h+2*l)+c):(u=Math.max(0,-(a*s+o)),h=u>0?s:Math.min(Math.max(-s,-l),s),p=-u*u+h*(h+2*l)+c);else h=a>0?-s:s,u=Math.max(0,-(a*h+o)),p=-u*u+h*(h+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,u),r&&r.copy(kl).addScaledVector(oa,h),p}intersectSphere(e,t){Yn.subVectors(e.center,this.origin);let i=Yn.dot(this.direction),r=Yn.dot(Yn)-i*i,s=e.radius*e.radius;if(r>s)return null;let a=Math.sqrt(s-r),o=i-a,l=i+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){let i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,r,s,a,o,l,c=1/this.direction.x,d=1/this.direction.y,u=1/this.direction.z,h=this.origin;return c>=0?(i=(e.min.x-h.x)*c,r=(e.max.x-h.x)*c):(i=(e.max.x-h.x)*c,r=(e.min.x-h.x)*c),d>=0?(s=(e.min.y-h.y)*d,a=(e.max.y-h.y)*d):(s=(e.max.y-h.y)*d,a=(e.min.y-h.y)*d),i>a||s>r||((s>i||isNaN(i))&&(i=s),(a<r||isNaN(r))&&(r=a),u>=0?(o=(e.min.z-h.z)*u,l=(e.max.z-h.z)*u):(o=(e.max.z-h.z)*u,l=(e.min.z-h.z)*u),i>l||o>r)||((o>i||i!==i)&&(i=o),(l<r||r!==r)&&(r=l),r<0)?null:this.at(i>=0?i:r,t)}intersectsBox(e){return this.intersectBox(e,Yn)!==null}intersectTriangle(e,t,i,r,s){zl.subVectors(t,e),la.subVectors(i,e),Vl.crossVectors(zl,la);let a=this.direction.dot(Vl),o;if(a>0){if(r)return null;o=1}else if(a<0)o=-1,a=-a;else return null;oi.subVectors(this.origin,e);let l=o*this.direction.dot(la.crossVectors(oi,la));if(l<0)return null;let c=o*this.direction.dot(zl.cross(oi));if(c<0||l+c>a)return null;let d=-o*oi.dot(Vl);return d<0?null:this.at(d/a,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Jn=class extends Kn{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new $e(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Un,this.combine=io,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},qu=new mt,Li=new zi,ca=new hi,$u=new k,ua=new k,ha=new k,da=new k,Gl=new k,fa=new k,Yu=new k,pa=new k,gt=class extends zt{constructor(e=new Ct,t=new Jn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=r.length;s<a;s++){let o=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}getVertexPosition(e,t){let i=this.geometry,r=i.attributes.position,s=i.morphAttributes.position,a=i.morphTargetsRelative;t.fromBufferAttribute(r,e);let o=this.morphTargetInfluences;if(s&&o){fa.set(0,0,0);for(let l=0,c=s.length;l<c;l++){let d=o[l],u=s[l];d!==0&&(Gl.fromBufferAttribute(u,e),a?fa.addScaledVector(Gl,d):fa.addScaledVector(Gl.sub(t),d))}t.add(fa)}return t}raycast(e,t){let i=this.geometry,r=this.material,s=this.matrixWorld;r!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),ca.copy(i.boundingSphere),ca.applyMatrix4(s),Li.copy(e.ray).recast(e.near),!(ca.containsPoint(Li.origin)===!1&&(Li.intersectSphere(ca,$u)===null||Li.origin.distanceToSquared($u)>(e.far-e.near)**2))&&(qu.copy(s).invert(),Li.copy(e.ray).applyMatrix4(qu),!(i.boundingBox!==null&&Li.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,Li)))}_computeIntersections(e,t,i){let r,s=this.geometry,a=this.material,o=s.index,l=s.attributes.position,c=s.attributes.uv,d=s.attributes.uv1,u=s.attributes.normal,h=s.groups,p=s.drawRange;if(o!==null)if(Array.isArray(a))for(let f=0,b=h.length;f<b;f++){let g=h[f],m=a[g.materialIndex],M=Math.max(g.start,p.start),E=Math.min(o.count,Math.min(g.start+g.count,p.start+p.count));for(let v=M,C=E;v<C;v+=3){let S=o.getX(v),_=o.getX(v+1),x=o.getX(v+2);r=ma(this,m,e,i,c,d,u,S,_,x),r&&(r.faceIndex=Math.floor(v/3),r.face.materialIndex=g.materialIndex,t.push(r))}}else{let f=Math.max(0,p.start),b=Math.min(o.count,p.start+p.count);for(let g=f,m=b;g<m;g+=3){let M=o.getX(g),E=o.getX(g+1),v=o.getX(g+2);r=ma(this,a,e,i,c,d,u,M,E,v),r&&(r.faceIndex=Math.floor(g/3),t.push(r))}}else if(l!==void 0)if(Array.isArray(a))for(let f=0,b=h.length;f<b;f++){let g=h[f],m=a[g.materialIndex],M=Math.max(g.start,p.start),E=Math.min(l.count,Math.min(g.start+g.count,p.start+p.count));for(let v=M,C=E;v<C;v+=3){let S=v,_=v+1,x=v+2;r=ma(this,m,e,i,c,d,u,S,_,x),r&&(r.faceIndex=Math.floor(v/3),r.face.materialIndex=g.materialIndex,t.push(r))}}else{let f=Math.max(0,p.start),b=Math.min(l.count,p.start+p.count);for(let g=f,m=b;g<m;g+=3){let M=g,E=g+1,v=g+2;r=ma(this,a,e,i,c,d,u,M,E,v),r&&(r.faceIndex=Math.floor(g/3),t.push(r))}}}};function Rp(n,e,t,i,r,s,a,o){let l;if(e.side===jt?l=i.intersectTriangle(a,s,r,!0,o):l=i.intersectTriangle(r,s,a,e.side===Mn,o),l===null)return null;pa.copy(o),pa.applyMatrix4(n.matrixWorld);let c=t.ray.origin.distanceTo(pa);return c<t.near||c>t.far?null:{distance:c,point:pa.clone(),object:n}}function ma(n,e,t,i,r,s,a,o,l,c){n.getVertexPosition(o,ua),n.getVertexPosition(l,ha),n.getVertexPosition(c,da);let d=Rp(n,e,t,i,ua,ha,da,Yu);if(d){let u=new k;ci.getBarycoord(Yu,ua,ha,da,u),r&&(d.uv=ci.getInterpolatedAttribute(r,o,l,c,u,new Le)),s&&(d.uv1=ci.getInterpolatedAttribute(s,o,l,c,u,new Le)),a&&(d.normal=ci.getInterpolatedAttribute(a,o,l,c,u,new k),d.normal.dot(i.direction)>0&&d.normal.multiplyScalar(-1));let h={a:o,b:l,c,normal:new k,materialIndex:0};ci.getNormal(ua,ha,da,h.normal),d.face=h,d.barycoord=u}return d}var ls=class extends Jt{constructor(e=null,t=1,i=1,r,s,a,o,l,c=kt,d=kt,u,h){super(null,a,o,l,c,d,r,s,u,h),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var cs=class extends Kt{constructor(e,t,i,r=1){super(e,t,i),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},cr=new mt,Zu=new mt,ga=[],Ku=new On,Cp=new mt,Yr=new gt,Zr=new hi,vr=class extends gt{constructor(e,t,i){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new cs(new Float32Array(i*16),16),this.instanceColor=null,this.morphTexture=null,this.count=i,this.boundingBox=null,this.boundingSphere=null;for(let r=0;r<i;r++)this.setMatrixAt(r,Cp)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new On),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,cr),Ku.copy(e.boundingBox).applyMatrix4(cr),this.boundingBox.union(Ku)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new hi),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,cr),Zr.copy(e.boundingSphere).applyMatrix4(cr),this.boundingSphere.union(Zr)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let i=t.morphTargetInfluences,r=this.morphTexture.source.data.data,s=i.length+1,a=e*s+1;for(let o=0;o<i.length;o++)i[o]=r[a+o]}raycast(e,t){let i=this.matrixWorld,r=this.count;if(Yr.geometry=this.geometry,Yr.material=this.material,Yr.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Zr.copy(this.boundingSphere),Zr.applyMatrix4(i),e.ray.intersectsSphere(Zr)!==!1))for(let s=0;s<r;s++){this.getMatrixAt(s,cr),Zu.multiplyMatrices(i,cr),Yr.matrixWorld=Zu,Yr.raycast(e,ga);for(let a=0,o=ga.length;a<o;a++){let l=ga[a];l.instanceId=s,l.object=this,t.push(l)}ga.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new cs(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let i=t.morphTargetInfluences,r=i.length+1;this.morphTexture===null&&(this.morphTexture=new ls(new Float32Array(r*this.count),r,this.count,uo,pn));let s=this.morphTexture.source.data.data,a=0;for(let c=0;c<i.length;c++)a+=i[c];let o=this.geometry.morphTargetsRelative?1:1-a,l=r*e;return s[l]=o,s.set(i,l+1),this}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},Hl=new k,Pp=new k,Ip=new Ze,Vt=class{constructor(e=new k(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,r){return this.normal.set(e,t,i),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){let r=Hl.subVectors(i,t).cross(Pp.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,i=!0){let r=e.delta(Hl),s=this.normal.dot(r);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/s;return i===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(r,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let i=t||Ip.getNormalMatrix(e),r=this.coplanarPoint(Hl).applyMatrix4(e),s=this.normal.applyMatrix3(i).normalize();return this.constant=-r.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},Fi=new hi,Dp=new Le(.5,.5),_a=new k,br=class{constructor(e=new Vt,t=new Vt,i=new Vt,r=new Vt,s=new Vt,a=new Vt){this.planes=[e,t,i,r,s,a]}set(e,t,i,r,s,a){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(i),o[3].copy(r),o[4].copy(s),o[5].copy(a),this}copy(e){let t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=bn,i=!1){let r=this.planes,s=e.elements,a=s[0],o=s[1],l=s[2],c=s[3],d=s[4],u=s[5],h=s[6],p=s[7],f=s[8],b=s[9],g=s[10],m=s[11],M=s[12],E=s[13],v=s[14],C=s[15];if(r[0].setComponents(c-a,p-d,m-f,C-M).normalize(),r[1].setComponents(c+a,p+d,m+f,C+M).normalize(),r[2].setComponents(c+o,p+u,m+b,C+E).normalize(),r[3].setComponents(c-o,p-u,m-b,C-E).normalize(),i)r[4].setComponents(l,h,g,v).normalize(),r[5].setComponents(c-l,p-h,m-g,C-v).normalize();else if(r[4].setComponents(c-l,p-h,m-g,C-v).normalize(),t===bn)r[5].setComponents(c+l,p+h,m+g,C+v).normalize();else if(t===pr)r[5].setComponents(l,h,g,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Fi.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Fi.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Fi)}intersectsSprite(e){Fi.center.set(0,0,0);let t=Dp.distanceTo(e.center);return Fi.radius=.7071067811865476+t,Fi.applyMatrix4(e.matrixWorld),this.intersectsSphere(Fi)}intersectsSphere(e){let t=this.planes,i=e.center,r=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(i)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let i=0;i<6;i++){let r=t[i];if(_a.x=r.normal.x>0?e.max.x:e.min.x,_a.y=r.normal.y>0?e.max.y:e.min.y,_a.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(_a)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var us=class extends Jt{constructor(e=[],t=_i,i,r,s,a,o,l,c,d){super(e,t,i,r,s,a,o,l,c,d),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},Mr=class extends Jt{constructor(e,t,i,r,s,a,o,l,c){super(e,t,i,r,s,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}};var jn=class extends Jt{constructor(e,t,i=En,r,s,a,o=kt,l=kt,c,d=Nn,u=1){if(d!==Nn&&d!==yi)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let h={width:e,height:t,depth:u};super(h,r,s,a,o,l,d,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new _r(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},ka=class extends jn{constructor(e,t=En,i=_i,r,s,a=kt,o=kt,l,c=Nn){let d={width:e,height:e,depth:1},u=[d,d,d,d,d,d];super(e,e,t,i,r,s,a,o,l,c),this.image=u,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},hs=class extends Jt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},Sr=class n extends Ct{constructor(e=1,t=1,i=1,r=1,s=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:r,heightSegments:s,depthSegments:a};let o=this;r=Math.floor(r),s=Math.floor(s),a=Math.floor(a);let l=[],c=[],d=[],u=[],h=0,p=0;f("z","y","x",-1,-1,i,t,e,a,s,0),f("z","y","x",1,-1,i,t,-e,a,s,1),f("x","z","y",1,1,e,i,t,r,a,2),f("x","z","y",1,-1,e,i,-t,r,a,3),f("x","y","z",1,-1,e,t,i,r,s,4),f("x","y","z",-1,-1,e,t,-i,r,s,5),this.setIndex(l),this.setAttribute("position",new ut(c,3)),this.setAttribute("normal",new ut(d,3)),this.setAttribute("uv",new ut(u,2));function f(b,g,m,M,E,v,C,S,_,x,A){let T=v/_,R=C/x,I=v/2,N=C/2,U=S/2,F=_+1,O=x+1,D=0,G=0,K=new k;for(let Q=0;Q<O;Q++){let ne=Q*R-N;for(let le=0;le<F;le++){let Ue=le*T-I;K[b]=Ue*M,K[g]=ne*E,K[m]=U,c.push(K.x,K.y,K.z),K[b]=0,K[g]=0,K[m]=S>0?1:-1,d.push(K.x,K.y,K.z),u.push(le/_),u.push(1-Q/x),D+=1}}for(let Q=0;Q<x;Q++)for(let ne=0;ne<_;ne++){let le=h+ne+F*Q,Ue=h+ne+F*(Q+1),He=h+(ne+1)+F*(Q+1),Re=h+(ne+1)+F*Q;l.push(le,Ue,Re),l.push(Ue,He,Re),G+=6}o.addGroup(p,G,A),p+=G,h+=D}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};var ds=class n extends Ct{constructor(e=1,t=1,i=1,r=32,s=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:i,radialSegments:r,heightSegments:s,openEnded:a,thetaStart:o,thetaLength:l};let c=this;r=Math.floor(r),s=Math.floor(s);let d=[],u=[],h=[],p=[],f=0,b=[],g=i/2,m=0;M(),a===!1&&(e>0&&E(!0),t>0&&E(!1)),this.setIndex(d),this.setAttribute("position",new ut(u,3)),this.setAttribute("normal",new ut(h,3)),this.setAttribute("uv",new ut(p,2));function M(){let v=new k,C=new k,S=0,_=(t-e)/i;for(let x=0;x<=s;x++){let A=[],T=x/s,R=T*(t-e)+e;for(let I=0;I<=r;I++){let N=I/r,U=N*l+o,F=Math.sin(U),O=Math.cos(U);C.x=R*F,C.y=-T*i+g,C.z=R*O,u.push(C.x,C.y,C.z),v.set(F,_,O).normalize(),h.push(v.x,v.y,v.z),p.push(N,1-T),A.push(f++)}b.push(A)}for(let x=0;x<r;x++)for(let A=0;A<s;A++){let T=b[A][x],R=b[A+1][x],I=b[A+1][x+1],N=b[A][x+1];(e>0||A!==0)&&(d.push(T,R,N),S+=3),(t>0||A!==s-1)&&(d.push(R,I,N),S+=3)}c.addGroup(m,S,0),m+=S}function E(v){let C=f,S=new Le,_=new k,x=0,A=v===!0?e:t,T=v===!0?1:-1;for(let I=1;I<=r;I++)u.push(0,g*T,0),h.push(0,T,0),p.push(.5,.5),f++;let R=f;for(let I=0;I<=r;I++){let U=I/r*l+o,F=Math.cos(U),O=Math.sin(U);_.x=A*O,_.y=g*T,_.z=A*F,u.push(_.x,_.y,_.z),h.push(0,T,0),S.x=F*.5+.5,S.y=O*.5*T+.5,p.push(S.x,S.y),f++}for(let I=0;I<r;I++){let N=C+I,U=R+I;v===!0?d.push(U,U+1,N):d.push(U+1,U,N),x+=3}c.addGroup(m,x,v===!0?1:2),m+=x}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}};var za=class n extends Ct{constructor(e=[],t=[],i=1,r=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:i,detail:r};let s=[],a=[];o(r),c(i),d(),this.setAttribute("position",new ut(s,3)),this.setAttribute("normal",new ut(s.slice(),3)),this.setAttribute("uv",new ut(a,2)),r===0?this.computeVertexNormals():this.normalizeNormals();function o(M){let E=new k,v=new k,C=new k;for(let S=0;S<t.length;S+=3)p(t[S+0],E),p(t[S+1],v),p(t[S+2],C),l(E,v,C,M)}function l(M,E,v,C){let S=C+1,_=[];for(let x=0;x<=S;x++){_[x]=[];let A=M.clone().lerp(v,x/S),T=E.clone().lerp(v,x/S),R=S-x;for(let I=0;I<=R;I++)I===0&&x===S?_[x][I]=A:_[x][I]=A.clone().lerp(T,I/R)}for(let x=0;x<S;x++)for(let A=0;A<2*(S-x)-1;A++){let T=Math.floor(A/2);A%2===0?(h(_[x][T+1]),h(_[x+1][T]),h(_[x][T])):(h(_[x][T+1]),h(_[x+1][T+1]),h(_[x+1][T]))}}function c(M){let E=new k;for(let v=0;v<s.length;v+=3)E.x=s[v+0],E.y=s[v+1],E.z=s[v+2],E.normalize().multiplyScalar(M),s[v+0]=E.x,s[v+1]=E.y,s[v+2]=E.z}function d(){let M=new k;for(let E=0;E<s.length;E+=3){M.x=s[E+0],M.y=s[E+1],M.z=s[E+2];let v=g(M)/2/Math.PI+.5,C=m(M)/Math.PI+.5;a.push(v,1-C)}f(),u()}function u(){for(let M=0;M<a.length;M+=6){let E=a[M+0],v=a[M+2],C=a[M+4],S=Math.max(E,v,C),_=Math.min(E,v,C);S>.9&&_<.1&&(E<.2&&(a[M+0]+=1),v<.2&&(a[M+2]+=1),C<.2&&(a[M+4]+=1))}}function h(M){s.push(M.x,M.y,M.z)}function p(M,E){let v=M*3;E.x=e[v+0],E.y=e[v+1],E.z=e[v+2]}function f(){let M=new k,E=new k,v=new k,C=new k,S=new Le,_=new Le,x=new Le;for(let A=0,T=0;A<s.length;A+=9,T+=6){M.set(s[A+0],s[A+1],s[A+2]),E.set(s[A+3],s[A+4],s[A+5]),v.set(s[A+6],s[A+7],s[A+8]),S.set(a[T+0],a[T+1]),_.set(a[T+2],a[T+3]),x.set(a[T+4],a[T+5]),C.copy(M).add(E).add(v).divideScalar(3);let R=g(C);b(S,T+0,M,R),b(_,T+2,E,R),b(x,T+4,v,R)}}function b(M,E,v,C){C<0&&M.x===1&&(a[E]=M.x-1),v.x===0&&v.z===0&&(a[E]=C/2/Math.PI+.5)}function g(M){return Math.atan2(M.z,-M.x)}function m(M){return Math.atan2(-M.y,Math.sqrt(M.x*M.x+M.z*M.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.vertices,e.indices,e.radius,e.detail)}};function Lp(n,e,t=2){let i=e&&e.length,r=i?e[0]*t:n.length,s=Hh(n,0,r,t,!0),a=[];if(!s||s.next===s.prev)return a;let o,l,c;if(i&&(s=Bp(n,e,s,t)),n.length>80*t){o=n[0],l=n[1];let d=o,u=l;for(let h=t;h<r;h+=t){let p=n[h],f=n[h+1];p<o&&(o=p),f<l&&(l=f),p>d&&(d=p),f>u&&(u=f)}c=Math.max(d-o,u-l),c=c!==0?32767/c:0}return fs(s,a,t,o,l,c,0),a}function Hh(n,e,t,i,r){let s;if(r===Zp(n,e,t,i)>0)for(let a=e;a<t;a+=i)s=Ju(a/i|0,n[a],n[a+1],s);else for(let a=t-i;a>=e;a-=i)s=Ju(a/i|0,n[a],n[a+1],s);return s&&wr(s,s.next)&&(ms(s),s=s.next),s}function Vi(n,e){if(!n)return n;e||(e=n);let t=n,i;do if(i=!1,!t.steiner&&(wr(t,t.next)||Mt(t.prev,t,t.next)===0)){if(ms(t),t=e=t.prev,t===t.next)break;i=!0}else t=t.next;while(i||t!==e);return e}function fs(n,e,t,i,r,s,a){if(!n)return;!a&&s&&Hp(n,i,r,s);let o=n;for(;n.prev!==n.next;){let l=n.prev,c=n.next;if(s?Np(n,i,r,s):Fp(n)){e.push(l.i,n.i,c.i),ms(n),n=c.next,o=c.next;continue}if(n=c,n===o){a?a===1?(n=Up(Vi(n),e),fs(n,e,t,i,r,s,2)):a===2&&Op(n,e,t,i,r,s):fs(Vi(n),e,t,i,r,s,1);break}}}function Fp(n){let e=n.prev,t=n,i=n.next;if(Mt(e,t,i)>=0)return!1;let r=e.x,s=t.x,a=i.x,o=e.y,l=t.y,c=i.y,d=Math.min(r,s,a),u=Math.min(o,l,c),h=Math.max(r,s,a),p=Math.max(o,l,c),f=i.next;for(;f!==e;){if(f.x>=d&&f.x<=h&&f.y>=u&&f.y<=p&&Kr(r,o,s,l,a,c,f.x,f.y)&&Mt(f.prev,f,f.next)>=0)return!1;f=f.next}return!0}function Np(n,e,t,i){let r=n.prev,s=n,a=n.next;if(Mt(r,s,a)>=0)return!1;let o=r.x,l=s.x,c=a.x,d=r.y,u=s.y,h=a.y,p=Math.min(o,l,c),f=Math.min(d,u,h),b=Math.max(o,l,c),g=Math.max(d,u,h),m=Jl(p,f,e,t,i),M=Jl(b,g,e,t,i),E=n.prevZ,v=n.nextZ;for(;E&&E.z>=m&&v&&v.z<=M;){if(E.x>=p&&E.x<=b&&E.y>=f&&E.y<=g&&E!==r&&E!==a&&Kr(o,d,l,u,c,h,E.x,E.y)&&Mt(E.prev,E,E.next)>=0||(E=E.prevZ,v.x>=p&&v.x<=b&&v.y>=f&&v.y<=g&&v!==r&&v!==a&&Kr(o,d,l,u,c,h,v.x,v.y)&&Mt(v.prev,v,v.next)>=0))return!1;v=v.nextZ}for(;E&&E.z>=m;){if(E.x>=p&&E.x<=b&&E.y>=f&&E.y<=g&&E!==r&&E!==a&&Kr(o,d,l,u,c,h,E.x,E.y)&&Mt(E.prev,E,E.next)>=0)return!1;E=E.prevZ}for(;v&&v.z<=M;){if(v.x>=p&&v.x<=b&&v.y>=f&&v.y<=g&&v!==r&&v!==a&&Kr(o,d,l,u,c,h,v.x,v.y)&&Mt(v.prev,v,v.next)>=0)return!1;v=v.nextZ}return!0}function Up(n,e){let t=n;do{let i=t.prev,r=t.next.next;!wr(i,r)&&Xh(i,t,t.next,r)&&ps(i,r)&&ps(r,i)&&(e.push(i.i,t.i,r.i),ms(t),ms(t.next),t=n=r),t=t.next}while(t!==n);return Vi(t)}function Op(n,e,t,i,r,s){let a=n;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&qp(a,o)){let l=qh(a,o);a=Vi(a,a.next),l=Vi(l,l.next),fs(a,e,t,i,r,s,0),fs(l,e,t,i,r,s,0);return}o=o.next}a=a.next}while(a!==n)}function Bp(n,e,t,i){let r=[];for(let s=0,a=e.length;s<a;s++){let o=e[s]*i,l=s<a-1?e[s+1]*i:n.length,c=Hh(n,o,l,i,!1);c===c.next&&(c.steiner=!0),r.push(Xp(c))}r.sort(kp);for(let s=0;s<r.length;s++)t=zp(r[s],t);return t}function kp(n,e){let t=n.x-e.x;if(t===0&&(t=n.y-e.y,t===0)){let i=(n.next.y-n.y)/(n.next.x-n.x),r=(e.next.y-e.y)/(e.next.x-e.x);t=i-r}return t}function zp(n,e){let t=Vp(n,e);if(!t)return e;let i=qh(t,n);return Vi(i,i.next),Vi(t,t.next)}function Vp(n,e){let t=e,i=n.x,r=n.y,s=-1/0,a;if(wr(n,t))return t;do{if(wr(n,t.next))return t.next;if(r<=t.y&&r>=t.next.y&&t.next.y!==t.y){let u=t.x+(r-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(u<=i&&u>s&&(s=u,a=t.x<t.next.x?t:t.next,u===i))return a}t=t.next}while(t!==e);if(!a)return null;let o=a,l=a.x,c=a.y,d=1/0;t=a;do{if(i>=t.x&&t.x>=l&&i!==t.x&&Wh(r<c?i:s,r,l,c,r<c?s:i,r,t.x,t.y)){let u=Math.abs(r-t.y)/(i-t.x);ps(t,n)&&(u<d||u===d&&(t.x>a.x||t.x===a.x&&Gp(a,t)))&&(a=t,d=u)}t=t.next}while(t!==o);return a}function Gp(n,e){return Mt(n.prev,n,e.prev)<0&&Mt(e.next,n,n.next)<0}function Hp(n,e,t,i){let r=n;do r.z===0&&(r.z=Jl(r.x,r.y,e,t,i)),r.prevZ=r.prev,r.nextZ=r.next,r=r.next;while(r!==n);r.prevZ.nextZ=null,r.prevZ=null,Wp(r)}function Wp(n){let e,t=1;do{let i=n,r;n=null;let s=null;for(e=0;i;){e++;let a=i,o=0;for(let c=0;c<t&&(o++,a=a.nextZ,!!a);c++);let l=t;for(;o>0||l>0&&a;)o!==0&&(l===0||!a||i.z<=a.z)?(r=i,i=i.nextZ,o--):(r=a,a=a.nextZ,l--),s?s.nextZ=r:n=r,r.prevZ=s,s=r;i=a}s.nextZ=null,t*=2}while(e>1);return n}function Jl(n,e,t,i,r){return n=(n-t)*r|0,e=(e-i)*r|0,n=(n|n<<8)&16711935,n=(n|n<<4)&252645135,n=(n|n<<2)&858993459,n=(n|n<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,n|e<<1}function Xp(n){let e=n,t=n;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==n);return t}function Wh(n,e,t,i,r,s,a,o){return(r-a)*(e-o)>=(n-a)*(s-o)&&(n-a)*(i-o)>=(t-a)*(e-o)&&(t-a)*(s-o)>=(r-a)*(i-o)}function Kr(n,e,t,i,r,s,a,o){return!(n===a&&e===o)&&Wh(n,e,t,i,r,s,a,o)}function qp(n,e){return n.next.i!==e.i&&n.prev.i!==e.i&&!$p(n,e)&&(ps(n,e)&&ps(e,n)&&Yp(n,e)&&(Mt(n.prev,n,e.prev)||Mt(n,e.prev,e))||wr(n,e)&&Mt(n.prev,n,n.next)>0&&Mt(e.prev,e,e.next)>0)}function Mt(n,e,t){return(e.y-n.y)*(t.x-e.x)-(e.x-n.x)*(t.y-e.y)}function wr(n,e){return n.x===e.x&&n.y===e.y}function Xh(n,e,t,i){let r=ya(Mt(n,e,t)),s=ya(Mt(n,e,i)),a=ya(Mt(t,i,n)),o=ya(Mt(t,i,e));return!!(r!==s&&a!==o||r===0&&xa(n,t,e)||s===0&&xa(n,i,e)||a===0&&xa(t,n,i)||o===0&&xa(t,e,i))}function xa(n,e,t){return e.x<=Math.max(n.x,t.x)&&e.x>=Math.min(n.x,t.x)&&e.y<=Math.max(n.y,t.y)&&e.y>=Math.min(n.y,t.y)}function ya(n){return n>0?1:n<0?-1:0}function $p(n,e){let t=n;do{if(t.i!==n.i&&t.next.i!==n.i&&t.i!==e.i&&t.next.i!==e.i&&Xh(t,t.next,n,e))return!0;t=t.next}while(t!==n);return!1}function ps(n,e){return Mt(n.prev,n,n.next)<0?Mt(n,e,n.next)>=0&&Mt(n,n.prev,e)>=0:Mt(n,e,n.prev)<0||Mt(n,n.next,e)<0}function Yp(n,e){let t=n,i=!1,r=(n.x+e.x)/2,s=(n.y+e.y)/2;do t.y>s!=t.next.y>s&&t.next.y!==t.y&&r<(t.next.x-t.x)*(s-t.y)/(t.next.y-t.y)+t.x&&(i=!i),t=t.next;while(t!==n);return i}function qh(n,e){let t=jl(n.i,n.x,n.y),i=jl(e.i,e.x,e.y),r=n.next,s=e.prev;return n.next=e,e.prev=n,t.next=r,r.prev=t,i.next=t,t.prev=i,s.next=i,i.prev=s,i}function Ju(n,e,t,i){let r=jl(n,e,t);return i?(r.next=i.next,r.prev=i,i.next.prev=r,i.next=r):(r.prev=r,r.next=r),r}function ms(n){n.next.prev=n.prev,n.prev.next=n.next,n.prevZ&&(n.prevZ.nextZ=n.nextZ),n.nextZ&&(n.nextZ.prevZ=n.prevZ)}function jl(n,e,t){return{i:n,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function Zp(n,e,t,i){let r=0;for(let s=e,a=t-i;s<t;s+=i)r+=(n[a]-n[s])*(n[s+1]+n[a+1]),a=s;return r}var Ql=class{static triangulate(e,t,i=2){return Lp(e,t,i)}},Gi=class n{static area(e){let t=e.length,i=0;for(let r=t-1,s=0;s<t;r=s++)i+=e[r].x*e[s].y-e[s].x*e[r].y;return i*.5}static isClockWise(e){return n.area(e)<0}static triangulateShape(e,t){let i=[],r=[],s=[];ju(e),Qu(i,e);let a=e.length;t.forEach(ju);for(let l=0;l<t.length;l++)r.push(a),a+=t[l].length,Qu(i,t[l]);let o=Ql.triangulate(i,r);for(let l=0;l<o.length;l+=3)s.push(o.slice(l,l+3));return s}};function ju(n){let e=n.length;e>2&&n[e-1].equals(n[0])&&n.pop()}function Qu(n,e){for(let t=0;t<e.length;t++)n.push(e[t].x),n.push(e[t].y)}var gs=class n extends za{constructor(e=1,t=0){let i=(1+Math.sqrt(5))/2,r=[-1,i,0,1,i,0,-1,-i,0,1,-i,0,0,-1,i,0,1,i,0,-1,-i,0,1,-i,i,0,-1,i,0,1,-i,0,-1,-i,0,1],s=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(r,s,e,t),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new n(e.radius,e.detail)}};var Hi=class n extends Ct{constructor(e=1,t=1,i=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:r};let s=e/2,a=t/2,o=Math.floor(i),l=Math.floor(r),c=o+1,d=l+1,u=e/o,h=t/l,p=[],f=[],b=[],g=[];for(let m=0;m<d;m++){let M=m*h-a;for(let E=0;E<c;E++){let v=E*u-s;f.push(v,-M,0),b.push(0,0,1),g.push(E/o),g.push(1-m/l)}}for(let m=0;m<l;m++)for(let M=0;M<o;M++){let E=M+c*m,v=M+c*(m+1),C=M+1+c*(m+1),S=M+1+c*m;p.push(E,v,S),p.push(v,C,S)}this.setIndex(p),this.setAttribute("position",new ut(f,3)),this.setAttribute("normal",new ut(b,3)),this.setAttribute("uv",new ut(g,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.widthSegments,e.heightSegments)}};function Xi(n){let e={};for(let t in n){e[t]={};for(let i in n[t]){let r=n[t][i];if(eh(r))r.isRenderTargetTexture?(ke("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=r.clone();else if(Array.isArray(r))if(eh(r[0])){let s=[];for(let a=0,o=r.length;a<o;a++)s[a]=r[a].clone();e[t][i]=s}else e[t][i]=r.slice();else e[t][i]=r}}return e}function qt(n){let e={};for(let t=0;t<n.length;t++){let i=Xi(n[t]);for(let r in i)e[r]=i[r]}return e}function eh(n){return n&&(n.isColor||n.isMatrix3||n.isMatrix4||n.isVector2||n.isVector3||n.isVector4||n.isTexture||n.isQuaternion)}function Kp(n){let e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function Ec(n){let e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:st.workingColorSpace}var $h={clone:Xi,merge:qt},Jp=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,jp=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,un=class extends Kn{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Jp,this.fragmentShader=jp,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Xi(e.uniforms),this.uniformsGroups=Kp(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let r in this.uniforms){let a=this.uniforms[r].value;a&&a.isTexture?t.uniforms[r]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[r]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[r]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[r]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[r]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[r]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[r]={type:"m4",value:a.toArray()}:t.uniforms[r]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let i={};for(let r in this.extensions)this.extensions[r]===!0&&(i[r]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let i in e.uniforms){let r=e.uniforms[i];switch(this.uniforms[i]={},r.type){case"t":this.uniforms[i].value=t[r.value]||null;break;case"c":this.uniforms[i].value=new $e().setHex(r.value);break;case"v2":this.uniforms[i].value=new Le().fromArray(r.value);break;case"v3":this.uniforms[i].value=new k().fromArray(r.value);break;case"v4":this.uniforms[i].value=new vt().fromArray(r.value);break;case"m3":this.uniforms[i].value=new Ze().fromArray(r.value);break;case"m4":this.uniforms[i].value=new mt().fromArray(r.value);break;default:this.uniforms[i].value=r.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let i in e.extensions)this.extensions[i]=e.extensions[i];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},Va=class extends un{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},wn=class extends Kn{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new $e(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new $e(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Us,this.normalScale=new Le(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Un,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},_s=class extends wn{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new Le(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return rt(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new $e(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new $e(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new $e(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}};var xs=class extends Kn{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new $e(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new $e(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Us,this.normalScale=new Le(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Un,this.combine=io,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},Ga=class extends Kn{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Ph,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},Ha=class extends Kn{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function va(n,e){return!n||n.constructor===e?n:typeof e.BYTES_PER_ELEMENT=="number"?new e(n):Array.prototype.slice.call(n)}var di=class{constructor(e,t,i,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r!==void 0?r:new t.constructor(i),this.sampleValues=t,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,i=this._cachedIndex,r=t[i],s=t[i-1];n:{e:{let a;t:{i:if(!(e<r)){for(let o=i+2;;){if(r===void 0){if(e<s)break i;return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===o)break;if(s=r,r=t[++i],e<r)break e}a=t.length;break t}if(!(e>=s)){let o=t[1];e<o&&(i=2,s=o);for(let l=i-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(r=s,s=t[--i-1],e>=s)break e}a=i,i=0;break t}break n}for(;i<a;){let o=i+a>>>1;e<t[o]?a=o:i=o+1}if(r=t[i],s=t[i-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,s,r)}return this.interpolate_(i,s,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,i=this.sampleValues,r=this.valueSize,s=e*r;for(let a=0;a!==r;++a)t[a]=i[s+a];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},Wa=class extends di{constructor(e,t,i,r){super(e,t,i,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:ql,endingEnd:ql}}intervalChanged_(e,t,i){let r=this.parameterPositions,s=e-2,a=e+1,o=r[s],l=r[a];if(o===void 0)switch(this.getSettings_().endingStart){case $l:s=e,o=2*t-i;break;case Yl:s=r.length-2,o=t+r[s]-r[s+1];break;default:s=e,o=i}if(l===void 0)switch(this.getSettings_().endingEnd){case $l:a=e,l=2*i-t;break;case Yl:a=1,l=i+r[1]-r[0];break;default:a=e-1,l=t}let c=(i-t)*.5,d=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(l-i),this._offsetPrev=s*d,this._offsetNext=a*d}interpolate_(e,t,i,r){let s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,d=this._offsetPrev,u=this._offsetNext,h=this._weightPrev,p=this._weightNext,f=(i-t)/(r-t),b=f*f,g=b*f,m=-h*g+2*h*b-h*f,M=(1+h)*g+(-1.5-2*h)*b+(-.5+h)*f+1,E=(-1-p)*g+(1.5+p)*b+.5*f,v=p*g-p*b;for(let C=0;C!==o;++C)s[C]=m*a[d+C]+M*a[c+C]+E*a[l+C]+v*a[u+C];return s}},Xa=class extends di{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){let s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,d=(i-t)/(r-t),u=1-d;for(let h=0;h!==o;++h)s[h]=a[c+h]*u+a[l+h]*d;return s}},qa=class extends di{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e){return this.copySampleValue_(e-1)}},$a=class extends di{interpolate_(e,t,i,r){let s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,d=this.inTangents,u=this.outTangents;if(!d||!u){let f=(i-t)/(r-t),b=1-f;for(let g=0;g!==o;++g)s[g]=a[c+g]*b+a[l+g]*f;return s}let h=o*2,p=e-1;for(let f=0;f!==o;++f){let b=a[c+f],g=a[l+f],m=p*h+f*2,M=u[m],E=u[m+1],v=e*h+f*2,C=d[v],S=d[v+1],_=(i-t)/(r-t),x,A,T,R,I;for(let N=0;N<8;N++){x=_*_,A=x*_,T=1-_,R=T*T,I=R*T;let F=I*t+3*R*_*M+3*T*x*C+A*r-i;if(Math.abs(F)<1e-10)break;let O=3*R*(M-t)+6*T*_*(C-M)+3*x*(r-C);if(Math.abs(O)<1e-10)break;_=_-F/O,_=Math.max(0,Math.min(1,_))}s[f]=I*b+3*R*_*E+3*T*x*S+A*g}return s}},hn=class{constructor(e,t,i,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=va(t,this.TimeBufferType),this.values=va(i,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,i;if(t.toJSON!==this.toJSON)i=t.toJSON(e);else{i={name:e.name,times:va(e.times,Array),values:va(e.values,Array)};let r=e.getInterpolation();r!==e.DefaultInterpolation&&(i.interpolation=r)}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new qa(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Xa(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Wa(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new $a(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case Qr:t=this.InterpolantFactoryMethodDiscrete;break;case Na:t=this.InterpolantFactoryMethodLinear;break;case Sa:t=this.InterpolantFactoryMethodSmooth;break;case Xl:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return ke("KeyframeTrack:",i),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Qr;case this.InterpolantFactoryMethodLinear:return Na;case this.InterpolantFactoryMethodSmooth:return Sa;case this.InterpolantFactoryMethodBezier:return Xl}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]*=e}return this}trim(e,t){let i=this.times,r=i.length,s=0,a=r-1;for(;s!==r&&i[s]<e;)++s;for(;a!==-1&&i[a]>t;)--a;if(++a,s!==0||a!==r){s>=a&&(a=Math.max(a,1),s=a-1);let o=this.getValueSize();this.times=i.slice(s,a),this.values=this.values.slice(s*o,a*o)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(Ge("KeyframeTrack: Invalid value size in track.",this),e=!1);let i=this.times,r=this.values,s=i.length;s===0&&(Ge("KeyframeTrack: Track is empty.",this),e=!1);let a=null;for(let o=0;o!==s;o++){let l=i[o];if(typeof l=="number"&&isNaN(l)){Ge("KeyframeTrack: Time is not a valid number.",this,o,l),e=!1;break}if(a!==null&&a>l){Ge("KeyframeTrack: Out of order keys.",this,o,l,a),e=!1;break}a=l}if(r!==void 0&&Jf(r))for(let o=0,l=r.length;o!==l;++o){let c=r[o];if(isNaN(c)){Ge("KeyframeTrack: Value is not a valid number.",this,o,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),i=this.getValueSize(),r=this.getInterpolation()===Sa,s=e.length-1,a=1;for(let o=1;o<s;++o){let l=!1,c=e[o],d=e[o+1];if(c!==d&&(o!==1||c!==e[0]))if(r)l=!0;else{let u=o*i,h=u-i,p=u+i;for(let f=0;f!==i;++f){let b=t[u+f];if(b!==t[h+f]||b!==t[p+f]){l=!0;break}}}if(l){if(o!==a){e[a]=e[o];let u=o*i,h=a*i;for(let p=0;p!==i;++p)t[h+p]=t[u+p]}++a}}if(s>0){e[a]=e[s];for(let o=s*i,l=a*i,c=0;c!==i;++c)t[l+c]=t[o+c];++a}return a!==e.length?(this.times=e.slice(0,a),this.values=t.slice(0,a*i)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),i=this.constructor,r=new i(this.name,e,t);return r.createInterpolant=this.createInterpolant,r}};hn.prototype.ValueTypeName="";hn.prototype.TimeBufferType=Float32Array;hn.prototype.ValueBufferType=Float32Array;hn.prototype.DefaultInterpolation=Na;var fi=class extends hn{constructor(e,t,i){super(e,t,i)}};fi.prototype.ValueTypeName="bool";fi.prototype.ValueBufferType=Array;fi.prototype.DefaultInterpolation=Qr;fi.prototype.InterpolantFactoryMethodLinear=void 0;fi.prototype.InterpolantFactoryMethodSmooth=void 0;var Ya=class extends hn{constructor(e,t,i,r){super(e,t,i,r)}};Ya.prototype.ValueTypeName="color";var Za=class extends hn{constructor(e,t,i,r){super(e,t,i,r)}};Za.prototype.ValueTypeName="number";var Ka=class extends di{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){let s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(i-t)/(r-t),c=e*o;for(let d=c+o;c!==d;c+=4)ln.slerpFlat(s,0,a,c-o,a,c,l);return s}},ys=class extends hn{constructor(e,t,i,r){super(e,t,i,r)}InterpolantFactoryMethodLinear(e){return new Ka(this.times,this.values,this.getValueSize(),e)}};ys.prototype.ValueTypeName="quaternion";ys.prototype.InterpolantFactoryMethodSmooth=void 0;var pi=class extends hn{constructor(e,t,i){super(e,t,i)}};pi.prototype.ValueTypeName="string";pi.prototype.ValueBufferType=Array;pi.prototype.DefaultInterpolation=Qr;pi.prototype.InterpolantFactoryMethodLinear=void 0;pi.prototype.InterpolantFactoryMethodSmooth=void 0;var Ja=class extends hn{constructor(e,t,i,r){super(e,t,i,r)}};Ja.prototype.ValueTypeName="vector";var ja=class{constructor(e,t,i){let r=this,s=!1,a=0,o=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=i,this._abortController=null,this.itemStart=function(d){o++,s===!1&&r.onStart!==void 0&&r.onStart(d,a,o),s=!0},this.itemEnd=function(d){a++,r.onProgress!==void 0&&r.onProgress(d,a,o),a===o&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(d){r.onError!==void 0&&r.onError(d)},this.resolveURL=function(d){return d=d.normalize("NFC"),l?l(d):d},this.setURLModifier=function(d){return l=d,this},this.addHandler=function(d,u){return c.push(d,u),this},this.removeHandler=function(d){let u=c.indexOf(d);return u!==-1&&c.splice(u,2),this},this.getHandler=function(d){for(let u=0,h=c.length;u<h;u+=2){let p=c[u],f=c[u+1];if(p.global&&(p.lastIndex=0),p.test(d))return f}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Yh=new ja,Qa=class{constructor(e){this.manager=e!==void 0?e:Yh,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let i=this;return new Promise(function(r,s){i.load(e,r,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};Qa.DEFAULT_MATERIAL_NAME="__DEFAULT";var vs=class extends zt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new $e(e),this.intensity=t}dispose(){this.dispatchEvent({type:"dispose"})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},bs=class extends vs{constructor(e,t,i){super(e,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(zt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new $e(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},Wl=new mt,th=new k,nh=new k,ec=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Le(512,512),this.mapType=en,this.map=null,this.mapPass=null,this.matrix=new mt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new br,this._frameExtents=new Le(1,1),this._viewportCount=1,this._viewports=[new vt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,i=this.matrix;th.setFromMatrixPosition(e.matrixWorld),t.position.copy(th),nh.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(nh),t.updateMatrixWorld(),Wl.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Wl,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===pr||t.reversedDepth?i.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(Wl)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},ba=new k,Ma=new ln,Ln=new k,Ms=class extends zt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new mt,this.projectionMatrix=new mt,this.projectionMatrixInverse=new mt,this.coordinateSystem=bn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(ba,Ma,Ln),Ln.x===1&&Ln.y===1&&Ln.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(ba,Ma,Ln.set(1,1,1)).invert()}updateWorldMatrix(e,t,i=!1){super.updateWorldMatrix(e,t,i),this.matrixWorld.decompose(ba,Ma,Ln),Ln.x===1&&Ln.y===1&&Ln.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(ba,Ma,Ln.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},li=new k,ih=new Le,rh=new Le,Xt=class extends Ms{constructor(e=50,t=1,i=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=gr*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Jr*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return gr*2*Math.atan(Math.tan(Jr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){li.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(li.x,li.y).multiplyScalar(-e/li.z),li.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(li.x,li.y).multiplyScalar(-e/li.z)}getViewSize(e,t){return this.getViewBounds(e,ih,rh),t.subVectors(rh,ih)}setViewOffset(e,t,i,r,s,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Jr*.5*this.fov)/this.zoom,i=2*t,r=this.aspect*i,s=-.5*r,a=this.view;if(this.view!==null&&this.view.enabled){let l=a.fullWidth,c=a.fullHeight;s+=a.offsetX*r/l,t-=a.offsetY*i/c,r*=a.width/l,i*=a.height/c}let o=this.filmOffset;o!==0&&(s+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+r,t,t-i,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}};var Tr=class extends Ms{constructor(e=-1,t=1,i=1,r=-1,s=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=r,this.near=s,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,r,s,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,r=(this.top+this.bottom)/2,s=i-e,a=i+e,o=r+t,l=r-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,d=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,a=s+c*this.view.width,o-=d*this.view.offsetY,l=o-d*this.view.height}this.projectionMatrix.makeOrthographic(s,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},tc=class extends ec{constructor(){super(new Tr(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Ss=class extends vs{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(zt.DEFAULT_UP),this.updateMatrix(),this.target=new zt,this.shadow=new tc}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}};var ur=-90,hr=1,eo=class extends zt{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new Xt(ur,hr,e,t);r.layers=this.layers,this.add(r);let s=new Xt(ur,hr,e,t);s.layers=this.layers,this.add(s);let a=new Xt(ur,hr,e,t);a.layers=this.layers,this.add(a);let o=new Xt(ur,hr,e,t);o.layers=this.layers,this.add(o);let l=new Xt(ur,hr,e,t);l.layers=this.layers,this.add(l);let c=new Xt(ur,hr,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[i,r,s,a,o,l]=t;for(let c of t)this.remove(c);if(e===bn)i.up.set(0,1,0),i.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===pr)i.up.set(0,-1,0),i.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[s,a,o,l,c,d]=this.children,u=e.getRenderTarget(),h=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),f=e.xr.enabled;e.xr.enabled=!1;let b=i.texture.generateMipmaps;i.texture.generateMipmaps=!1;let g=!1;e.isWebGLRenderer===!0?g=e.state.buffers.depth.getReversed():g=e.reversedDepthBuffer,e.setRenderTarget(i,0,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(i,1,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(i,2,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(i,3,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(i,4,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),i.texture.generateMipmaps=b,e.setRenderTarget(i,5,r),g&&e.autoClear===!1&&e.clearDepth(),e.render(t,d),e.setRenderTarget(u,h,p),e.xr.enabled=f,i.texture.needsPMREMUpdate=!0}},to=class extends Xt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}};var Ac="\\[\\]\\.:\\/",Qp=new RegExp("["+Ac+"]","g"),Rc="[^"+Ac+"]",em="[^"+Ac.replace("\\.","")+"]",tm=/((?:WC+[\/:])*)/.source.replace("WC",Rc),nm=/(WCOD+)?/.source.replace("WCOD",em),im=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Rc),rm=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Rc),sm=new RegExp("^"+tm+nm+im+rm+"$"),am=["material","materials","bones","map"],nc=class{constructor(e,t,i){let r=i||yt.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let i=this._targetGroup.nCachedObjects_,r=this._bindings[i];r!==void 0&&r.getValue(e,t)}setValue(e,t){let i=this._bindings;for(let r=this._targetGroup.nCachedObjects_,s=i.length;r!==s;++r)i[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].unbind()}},yt=class n{constructor(e,t,i){this.path=t,this.parsedPath=i||n.parseTrackName(t),this.node=n.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,i){return e&&e.isAnimationObjectGroup?new n.Composite(e,t,i):new n(e,t,i)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(Qp,"")}static parseTrackName(e){let t=sm.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let i={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=i.nodeName&&i.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){let s=i.nodeName.substring(r+1);am.indexOf(s)!==-1&&(i.nodeName=i.nodeName.substring(0,r),i.objectName=s)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return i}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let i=e.skeleton.getBoneByName(t);if(i!==void 0)return i}if(e.children){let i=function(s){for(let a=0;a<s.length;a++){let o=s[a];if(o.name===t||o.uuid===t)return o;let l=i(o.children);if(l)return l}return null},r=i(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)e[t++]=i[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,i=t.objectName,r=t.propertyName,s=t.propertyIndex;if(e||(e=n.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){ke("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=t.objectIndex;switch(i){case"materials":if(!e.material){Ge("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Ge("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Ge("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let d=0;d<e.length;d++)if(e[d].name===c){c=d;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Ge("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Ge("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[i]===void 0){Ge("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[i]}if(c!==void 0){if(e[c]===void 0){Ge("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let a=e[r];if(a===void 0){let c=t.nodeName;Ge("PropertyBinding: Trying to update property for track: "+c+"."+r+" but it wasn't found.",e);return}let o=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?o=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(r==="morphTargetInfluences"){if(!e.geometry){Ge("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Ge("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=s}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=r;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};yt.Composite=nc;yt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};yt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};yt.prototype.GetterByBindingType=[yt.prototype._getValue_direct,yt.prototype._getValue_array,yt.prototype._getValue_arrayElement,yt.prototype._getValue_toArray];yt.prototype.SetterByBindingTypeAndVersioning=[[yt.prototype._setValue_direct,yt.prototype._setValue_direct_setNeedsUpdate,yt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[yt.prototype._setValue_array,yt.prototype._setValue_array_setNeedsUpdate,yt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[yt.prototype._setValue_arrayElement,yt.prototype._setValue_arrayElement_setNeedsUpdate,yt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[yt.prototype._setValue_fromArray,yt.prototype._setValue_fromArray_setNeedsUpdate,yt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var Ev=new Float32Array(1);var sh=new mt,ws=class{constructor(e,t,i=0,r=1/0){this.ray=new zi(e,t),this.near=i,this.far=r,this.camera=null,this.layers=new xr,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,t.projectionMatrix.elements[14]).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):Ge("Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return sh.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(sh),this}intersectObject(e,t=!0,i=[]){return ic(e,this,i,t),i.sort(ah),i}intersectObjects(e,t=!0,i=[]){for(let r=0,s=e.length;r<s;r++)ic(e[r],this,i,t);return i.sort(ah),i}};function ah(n,e){return n.distance-e.distance}function ic(n,e,t,i){let r=!0;if(n.layers.test(e.layers)&&n.raycast(e,t)===!1&&(r=!1),r===!0&&i===!0){let s=n.children;for(let a=0,o=s.length;a<o;a++)ic(s[a],e,t,!0)}}var Er=class{constructor(e=1,t=0,i=0){this.radius=e,this.phi=t,this.theta=i}set(e,t,i){return this.radius=e,this.phi=t,this.theta=i,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=rt(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,i){return this.radius=Math.sqrt(e*e+t*t+i*i),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,i),this.phi=Math.acos(rt(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var rc=class n{static{n.prototype.isMatrix2=!0}constructor(e,t,i,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,i,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let i=0;i<4;i++)this.elements[i]=e[i+t];return this}set(e,t,i,r){let s=this.elements;return s[0]=e,s[2]=t,s[1]=i,s[3]=r,this}};var Ts=class extends Sn{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){if(e===void 0){ke("Controls: connect() now requires an element.");return}this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}};function Cc(n,e,t,i){let r=om(i);switch(t){case vc:return n*e;case uo:return n*e/r.components*r.byteLength;case ho:return n*e/r.components*r.byteLength;case vi:return n*e*2/r.components*r.byteLength;case fo:return n*e*2/r.components*r.byteLength;case bc:return n*e*3/r.components*r.byteLength;case mn:return n*e*4/r.components*r.byteLength;case po:return n*e*4/r.components*r.byteLength;case Ps:case Is:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case Ds:case Ls:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case go:case xo:return Math.max(n,16)*Math.max(e,8)/4;case mo:case _o:return Math.max(n,8)*Math.max(e,8)/2;case yo:case vo:case Mo:case So:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case bo:case Fs:case wo:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case To:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Eo:return Math.floor((n+4)/5)*Math.floor((e+3)/4)*16;case Ao:return Math.floor((n+4)/5)*Math.floor((e+4)/5)*16;case Ro:return Math.floor((n+5)/6)*Math.floor((e+4)/5)*16;case Co:return Math.floor((n+5)/6)*Math.floor((e+5)/6)*16;case Po:return Math.floor((n+7)/8)*Math.floor((e+4)/5)*16;case Io:return Math.floor((n+7)/8)*Math.floor((e+5)/6)*16;case Do:return Math.floor((n+7)/8)*Math.floor((e+7)/8)*16;case Lo:return Math.floor((n+9)/10)*Math.floor((e+4)/5)*16;case Fo:return Math.floor((n+9)/10)*Math.floor((e+5)/6)*16;case No:return Math.floor((n+9)/10)*Math.floor((e+7)/8)*16;case Uo:return Math.floor((n+9)/10)*Math.floor((e+9)/10)*16;case Oo:return Math.floor((n+11)/12)*Math.floor((e+9)/10)*16;case Bo:return Math.floor((n+11)/12)*Math.floor((e+11)/12)*16;case ko:case zo:case Vo:return Math.ceil(n/4)*Math.ceil(e/4)*16;case Go:case Ho:return Math.ceil(n/4)*Math.ceil(e/4)*8;case Ns:case Wo:return Math.ceil(n/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function om(n){switch(n){case en:case gc:return{byteLength:1,components:1};case Rr:case _c:case kn:return{byteLength:2,components:1};case lo:case co:return{byteLength:2,components:4};case En:case oo:case pn:return{byteLength:4,components:1};case xc:case yc:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${n}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"185"}}));typeof window<"u"&&(window.__THREE__?ke("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="185");function _d(){let n=null,e=!1,t=null,i=null;function r(s,a){t(s,a),i=n.requestAnimationFrame(r)}return{start:function(){e!==!0&&t!==null&&n!==null&&(i=n.requestAnimationFrame(r),e=!0)},stop:function(){n!==null&&n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){n=s}}}function cm(n){let e=new WeakMap;function t(o,l){let c=o.array,d=o.usage,u=c.byteLength,h=n.createBuffer();n.bindBuffer(l,h),n.bufferData(l,c,d),o.onUploadCallback();let p;if(c instanceof Float32Array)p=n.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)p=n.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?p=n.HALF_FLOAT:p=n.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=n.SHORT;else if(c instanceof Uint32Array)p=n.UNSIGNED_INT;else if(c instanceof Int32Array)p=n.INT;else if(c instanceof Int8Array)p=n.BYTE;else if(c instanceof Uint8Array)p=n.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:h,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:u}}function i(o,l,c){let d=l.array,u=l.updateRanges;if(n.bindBuffer(c,o),u.length===0)n.bufferSubData(c,0,d);else{u.sort((p,f)=>p.start-f.start);let h=0;for(let p=1;p<u.length;p++){let f=u[h],b=u[p];b.start<=f.start+f.count+1?f.count=Math.max(f.count,b.start+b.count-f.start):(++h,u[h]=b)}u.length=h+1;for(let p=0,f=u.length;p<f;p++){let b=u[p];n.bufferSubData(c,b.start*d.BYTES_PER_ELEMENT,d,b.start,b.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function s(o){o.isInterleavedBufferAttribute&&(o=o.data);let l=e.get(o);l&&(n.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let d=e.get(o);(!d||d.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,o,l),c.version=o.version}}return{get:r,remove:s,update:a}}var um=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,hm=`#ifdef USE_ALPHAHASH
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
#endif`,dm=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,fm=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,pm=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,mm=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,gm=`#ifdef USE_AOMAP
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
#endif`,_m=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,xm=`#ifdef USE_BATCHING
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
#endif`,ym=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,vm=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,bm=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Mm=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,Sm=`#ifdef USE_IRIDESCENCE
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
#endif`,wm=`#ifdef USE_BUMPMAP
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
#endif`,Tm=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,Em=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Am=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Rm=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Cm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Pm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Im=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Dm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,Lm=`#define PI 3.141592653589793
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
} // validated`,Fm=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,Nm=`vec3 transformedNormal = objectNormal;
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
#endif`,Um=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Om=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Bm=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,km=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,zm="gl_FragColor = linearToOutputTexel( gl_FragColor );",Vm=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Gm=`#ifdef USE_ENVMAP
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
#endif`,Hm=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Wm=`#ifdef USE_ENVMAP
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
#endif`,Xm=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,qm=`#ifdef USE_ENVMAP
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
#endif`,$m=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Ym=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Zm=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Km=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Jm=`#ifdef USE_GRADIENTMAP
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
}`,jm=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Qm=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,eg=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,tg=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,ng=`#ifdef USE_ENVMAP
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
#endif`,ig=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,rg=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,sg=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,ag=`varying vec3 vViewPosition;
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
#endif`,lg=`uniform sampler2D dfgLUT;
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
}`,cg=`
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
#endif`,ug=`#if defined( RE_IndirectDiffuse )
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
#endif`,hg=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,dg=`#ifdef USE_LIGHT_PROBES_GRID
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
#endif`,fg=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,pg=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,mg=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,gg=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,_g=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,xg=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,yg=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,vg=`#if defined( USE_POINTS_UV )
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
#endif`,bg=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Mg=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Sg=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,wg=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Tg=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Eg=`#ifdef USE_MORPHTARGETS
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
#endif`,Ag=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Rg=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,Cg=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,Pg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Ig=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Dg=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Lg=`#ifdef USE_NORMALMAP
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
#endif`,Fg=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Ng=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Ug=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Og=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Bg=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,kg=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,zg=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Vg=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Gg=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Hg=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Wg=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Xg=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,qg=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,$g=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,Zg=`float getShadowMask() {
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
}`,Kg=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Jg=`#ifdef USE_SKINNING
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
#endif`,jg=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Qg=`#ifdef USE_SKINNING
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
#endif`,e0=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,t0=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,n0=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,i0=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,r0=`#ifdef USE_TRANSMISSION
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
#endif`,s0=`#ifdef USE_TRANSMISSION
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
#endif`,a0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,l0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,c0=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,u0=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,h0=`uniform sampler2D t2D;
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
}`,d0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,f0=`#ifdef ENVMAP_TYPE_CUBE
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
}`,p0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,m0=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,g0=`#include <common>
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
}`,_0=`#if DEPTH_PACKING == 3200
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
}`,x0=`#define DISTANCE
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
}`,y0=`#define DISTANCE
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
}`,v0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,b0=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,M0=`uniform float scale;
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
}`,S0=`uniform vec3 diffuse;
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
}`,w0=`#include <common>
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
}`,T0=`uniform vec3 diffuse;
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
}`,E0=`#define LAMBERT
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
}`,A0=`#define LAMBERT
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
}`,R0=`#define MATCAP
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
}`,C0=`#define MATCAP
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
}`,P0=`#define NORMAL
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
}`,I0=`#define NORMAL
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
}`,D0=`#define PHONG
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
}`,L0=`#define PHONG
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
}`,F0=`#define STANDARD
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
}`,N0=`#define STANDARD
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
}`,U0=`#define TOON
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
}`,O0=`#define TOON
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
}`,B0=`uniform float size;
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
}`,k0=`uniform vec3 diffuse;
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
}`,z0=`#include <common>
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
}`,V0=`uniform vec3 color;
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
}`,G0=`uniform float rotation;
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
}`,H0=`uniform vec3 diffuse;
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
}`,nt={alphahash_fragment:um,alphahash_pars_fragment:hm,alphamap_fragment:dm,alphamap_pars_fragment:fm,alphatest_fragment:pm,alphatest_pars_fragment:mm,aomap_fragment:gm,aomap_pars_fragment:_m,batching_pars_vertex:xm,batching_vertex:ym,begin_vertex:vm,beginnormal_vertex:bm,bsdfs:Mm,iridescence_fragment:Sm,bumpmap_pars_fragment:wm,clipping_planes_fragment:Tm,clipping_planes_pars_fragment:Em,clipping_planes_pars_vertex:Am,clipping_planes_vertex:Rm,color_fragment:Cm,color_pars_fragment:Pm,color_pars_vertex:Im,color_vertex:Dm,common:Lm,cube_uv_reflection_fragment:Fm,defaultnormal_vertex:Nm,displacementmap_pars_vertex:Um,displacementmap_vertex:Om,emissivemap_fragment:Bm,emissivemap_pars_fragment:km,colorspace_fragment:zm,colorspace_pars_fragment:Vm,envmap_fragment:Gm,envmap_common_pars_fragment:Hm,envmap_pars_fragment:Wm,envmap_pars_vertex:Xm,envmap_physical_pars_fragment:ng,envmap_vertex:qm,fog_vertex:$m,fog_pars_vertex:Ym,fog_fragment:Zm,fog_pars_fragment:Km,gradientmap_pars_fragment:Jm,lightmap_pars_fragment:jm,lights_lambert_fragment:Qm,lights_lambert_pars_fragment:eg,lights_pars_begin:tg,lights_toon_fragment:ig,lights_toon_pars_fragment:rg,lights_phong_fragment:sg,lights_phong_pars_fragment:ag,lights_physical_fragment:og,lights_physical_pars_fragment:lg,lights_fragment_begin:cg,lights_fragment_maps:ug,lights_fragment_end:hg,lightprobes_pars_fragment:dg,logdepthbuf_fragment:fg,logdepthbuf_pars_fragment:pg,logdepthbuf_pars_vertex:mg,logdepthbuf_vertex:gg,map_fragment:_g,map_pars_fragment:xg,map_particle_fragment:yg,map_particle_pars_fragment:vg,metalnessmap_fragment:bg,metalnessmap_pars_fragment:Mg,morphinstance_vertex:Sg,morphcolor_vertex:wg,morphnormal_vertex:Tg,morphtarget_pars_vertex:Eg,morphtarget_vertex:Ag,normal_fragment_begin:Rg,normal_fragment_maps:Cg,normal_pars_fragment:Pg,normal_pars_vertex:Ig,normal_vertex:Dg,normalmap_pars_fragment:Lg,clearcoat_normal_fragment_begin:Fg,clearcoat_normal_fragment_maps:Ng,clearcoat_pars_fragment:Ug,iridescence_pars_fragment:Og,opaque_fragment:Bg,packing:kg,premultiplied_alpha_fragment:zg,project_vertex:Vg,dithering_fragment:Gg,dithering_pars_fragment:Hg,roughnessmap_fragment:Wg,roughnessmap_pars_fragment:Xg,shadowmap_pars_fragment:qg,shadowmap_pars_vertex:$g,shadowmap_vertex:Yg,shadowmask_pars_fragment:Zg,skinbase_vertex:Kg,skinning_pars_vertex:Jg,skinning_vertex:jg,skinnormal_vertex:Qg,specularmap_fragment:e0,specularmap_pars_fragment:t0,tonemapping_fragment:n0,tonemapping_pars_fragment:i0,transmission_fragment:r0,transmission_pars_fragment:s0,uv_pars_fragment:a0,uv_pars_vertex:o0,uv_vertex:l0,worldpos_vertex:c0,background_vert:u0,background_frag:h0,backgroundCube_vert:d0,backgroundCube_frag:f0,cube_vert:p0,cube_frag:m0,depth_vert:g0,depth_frag:_0,distance_vert:x0,distance_frag:y0,equirect_vert:v0,equirect_frag:b0,linedashed_vert:M0,linedashed_frag:S0,meshbasic_vert:w0,meshbasic_frag:T0,meshlambert_vert:E0,meshlambert_frag:A0,meshmatcap_vert:R0,meshmatcap_frag:C0,meshnormal_vert:P0,meshnormal_frag:I0,meshphong_vert:D0,meshphong_frag:L0,meshphysical_vert:F0,meshphysical_frag:N0,meshtoon_vert:U0,meshtoon_frag:O0,points_vert:B0,points_frag:k0,shadow_vert:z0,shadow_frag:V0,sprite_vert:G0,sprite_frag:H0},ye={common:{diffuse:{value:new $e(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ze},alphaMap:{value:null},alphaMapTransform:{value:new Ze},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ze}},envmap:{envMap:{value:null},envMapRotation:{value:new Ze},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ze}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ze}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ze},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ze},normalScale:{value:new Le(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ze},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ze}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ze}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ze}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new $e(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new k},probesMax:{value:new k},probesResolution:{value:new k}},points:{diffuse:{value:new $e(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ze},alphaTest:{value:0},uvTransform:{value:new Ze}},sprite:{diffuse:{value:new $e(16777215)},opacity:{value:1},center:{value:new Le(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ze},alphaMap:{value:null},alphaMapTransform:{value:new Ze},alphaTest:{value:0}}},Vn={basic:{uniforms:qt([ye.common,ye.specularmap,ye.envmap,ye.aomap,ye.lightmap,ye.fog]),vertexShader:nt.meshbasic_vert,fragmentShader:nt.meshbasic_frag},lambert:{uniforms:qt([ye.common,ye.specularmap,ye.envmap,ye.aomap,ye.lightmap,ye.emissivemap,ye.bumpmap,ye.normalmap,ye.displacementmap,ye.fog,ye.lights,{emissive:{value:new $e(0)},envMapIntensity:{value:1}}]),vertexShader:nt.meshlambert_vert,fragmentShader:nt.meshlambert_frag},phong:{uniforms:qt([ye.common,ye.specularmap,ye.envmap,ye.aomap,ye.lightmap,ye.emissivemap,ye.bumpmap,ye.normalmap,ye.displacementmap,ye.fog,ye.lights,{emissive:{value:new $e(0)},specular:{value:new $e(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:nt.meshphong_vert,fragmentShader:nt.meshphong_frag},standard:{uniforms:qt([ye.common,ye.envmap,ye.aomap,ye.lightmap,ye.emissivemap,ye.bumpmap,ye.normalmap,ye.displacementmap,ye.roughnessmap,ye.metalnessmap,ye.fog,ye.lights,{emissive:{value:new $e(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:nt.meshphysical_vert,fragmentShader:nt.meshphysical_frag},toon:{uniforms:qt([ye.common,ye.aomap,ye.lightmap,ye.emissivemap,ye.bumpmap,ye.normalmap,ye.displacementmap,ye.gradientmap,ye.fog,ye.lights,{emissive:{value:new $e(0)}}]),vertexShader:nt.meshtoon_vert,fragmentShader:nt.meshtoon_frag},matcap:{uniforms:qt([ye.common,ye.bumpmap,ye.normalmap,ye.displacementmap,ye.fog,{matcap:{value:null}}]),vertexShader:nt.meshmatcap_vert,fragmentShader:nt.meshmatcap_frag},points:{uniforms:qt([ye.points,ye.fog]),vertexShader:nt.points_vert,fragmentShader:nt.points_frag},dashed:{uniforms:qt([ye.common,ye.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:nt.linedashed_vert,fragmentShader:nt.linedashed_frag},depth:{uniforms:qt([ye.common,ye.displacementmap]),vertexShader:nt.depth_vert,fragmentShader:nt.depth_frag},normal:{uniforms:qt([ye.common,ye.bumpmap,ye.normalmap,ye.displacementmap,{opacity:{value:1}}]),vertexShader:nt.meshnormal_vert,fragmentShader:nt.meshnormal_frag},sprite:{uniforms:qt([ye.sprite,ye.fog]),vertexShader:nt.sprite_vert,fragmentShader:nt.sprite_frag},background:{uniforms:{uvTransform:{value:new Ze},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:nt.background_vert,fragmentShader:nt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ze}},vertexShader:nt.backgroundCube_vert,fragmentShader:nt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:nt.cube_vert,fragmentShader:nt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:nt.equirect_vert,fragmentShader:nt.equirect_frag},distance:{uniforms:qt([ye.common,ye.displacementmap,{referencePosition:{value:new k},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:nt.distance_vert,fragmentShader:nt.distance_frag},shadow:{uniforms:qt([ye.lights,ye.fog,{color:{value:new $e(0)},opacity:{value:1}}]),vertexShader:nt.shadow_vert,fragmentShader:nt.shadow_frag}};Vn.physical={uniforms:qt([Vn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ze},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ze},clearcoatNormalScale:{value:new Le(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ze},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ze},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ze},sheen:{value:0},sheenColor:{value:new $e(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ze},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ze},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ze},transmissionSamplerSize:{value:new Le},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ze},attenuationDistance:{value:0},attenuationColor:{value:new $e(0)},specularColor:{value:new $e(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ze},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ze},anisotropyVector:{value:new Le},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ze}}]),vertexShader:nt.meshphysical_vert,fragmentShader:nt.meshphysical_frag};var $o={r:0,b:0,g:0},W0=new mt,xd=new Ze;xd.set(-1,0,0,0,1,0,0,0,1);function X0(n,e,t,i,r,s){let a=new $e(0),o=r===!0?0:1,l,c,d=null,u=0,h=null;function p(M){let E=M.isScene===!0?M.background:null;if(E&&E.isTexture){let v=M.backgroundBlurriness>0;E=e.get(E,v)}return E}function f(M){let E=!1,v=p(M);v===null?g(a,o):v&&v.isColor&&(g(v,1),E=!0);let C=n.xr.getEnvironmentBlendMode();C==="additive"?t.buffers.color.setClear(0,0,0,1,s):C==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,s),(n.autoClear||E)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function b(M,E){let v=p(E);v&&(v.isCubeTexture||v.mapping===Rs)?(c===void 0&&(c=new gt(new Sr(1,1,1),new un({name:"BackgroundCubeMaterial",uniforms:Xi(Vn.backgroundCube.uniforms),vertexShader:Vn.backgroundCube.vertexShader,fragmentShader:Vn.backgroundCube.fragmentShader,side:jt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(C,S,_){this.matrixWorld.copyPosition(_.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),c.material.uniforms.envMap.value=v,c.material.uniforms.backgroundBlurriness.value=E.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(W0.makeRotationFromEuler(E.backgroundRotation)).transpose(),v.isCubeTexture&&v.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(xd),c.material.toneMapped=st.getTransfer(v.colorSpace)!==ct,(d!==v||u!==v.version||h!==n.toneMapping)&&(c.material.needsUpdate=!0,d=v,u=v.version,h=n.toneMapping),c.layers.enableAll(),M.unshift(c,c.geometry,c.material,0,0,null)):v&&v.isTexture&&(l===void 0&&(l=new gt(new Hi(2,2),new un({name:"BackgroundMaterial",uniforms:Xi(Vn.background.uniforms),vertexShader:Vn.background.vertexShader,fragmentShader:Vn.background.fragmentShader,side:Mn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=v,l.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,l.material.toneMapped=st.getTransfer(v.colorSpace)!==ct,v.matrixAutoUpdate===!0&&v.updateMatrix(),l.material.uniforms.uvTransform.value.copy(v.matrix),(d!==v||u!==v.version||h!==n.toneMapping)&&(l.material.needsUpdate=!0,d=v,u=v.version,h=n.toneMapping),l.layers.enableAll(),M.unshift(l,l.geometry,l.material,0,0,null))}function g(M,E){M.getRGB($o,Ec(n)),t.buffers.color.setClear($o.r,$o.g,$o.b,E,s)}function m(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return a},setClearColor:function(M,E=1){a.set(M),o=E,g(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(M){o=M,g(a,o)},render:f,addToRenderList:b,dispose:m}}function q0(n,e){let t=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},r=h(null),s=r,a=!1;function o(R,I,N,U,F){let O=!1,D=u(R,U,N,I);s!==D&&(s=D,c(s.object)),O=p(R,U,N,F),O&&f(R,U,N,F),F!==null&&e.update(F,n.ELEMENT_ARRAY_BUFFER),(O||a)&&(a=!1,v(R,I,N,U),F!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get(F).buffer))}function l(){return n.createVertexArray()}function c(R){return n.bindVertexArray(R)}function d(R){return n.deleteVertexArray(R)}function u(R,I,N,U){let F=U.wireframe===!0,O=i[I.id];O===void 0&&(O={},i[I.id]=O);let D=R.isInstancedMesh===!0?R.id:0,G=O[D];G===void 0&&(G={},O[D]=G);let K=G[N.id];K===void 0&&(K={},G[N.id]=K);let Q=K[F];return Q===void 0&&(Q=h(l()),K[F]=Q),Q}function h(R){let I=[],N=[],U=[];for(let F=0;F<t;F++)I[F]=0,N[F]=0,U[F]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:I,enabledAttributes:N,attributeDivisors:U,object:R,attributes:{},index:null}}function p(R,I,N,U){let F=s.attributes,O=I.attributes,D=0,G=N.getAttributes();for(let K in G)if(G[K].location>=0){let ne=F[K],le=O[K];if(le===void 0&&(K==="instanceMatrix"&&R.instanceMatrix&&(le=R.instanceMatrix),K==="instanceColor"&&R.instanceColor&&(le=R.instanceColor)),ne===void 0||ne.attribute!==le||le&&ne.data!==le.data)return!0;D++}return s.attributesNum!==D||s.index!==U}function f(R,I,N,U){let F={},O=I.attributes,D=0,G=N.getAttributes();for(let K in G)if(G[K].location>=0){let ne=O[K];ne===void 0&&(K==="instanceMatrix"&&R.instanceMatrix&&(ne=R.instanceMatrix),K==="instanceColor"&&R.instanceColor&&(ne=R.instanceColor));let le={};le.attribute=ne,ne&&ne.data&&(le.data=ne.data),F[K]=le,D++}s.attributes=F,s.attributesNum=D,s.index=U}function b(){let R=s.newAttributes;for(let I=0,N=R.length;I<N;I++)R[I]=0}function g(R){m(R,0)}function m(R,I){let N=s.newAttributes,U=s.enabledAttributes,F=s.attributeDivisors;N[R]=1,U[R]===0&&(n.enableVertexAttribArray(R),U[R]=1),F[R]!==I&&(n.vertexAttribDivisor(R,I),F[R]=I)}function M(){let R=s.newAttributes,I=s.enabledAttributes;for(let N=0,U=I.length;N<U;N++)I[N]!==R[N]&&(n.disableVertexAttribArray(N),I[N]=0)}function E(R,I,N,U,F,O,D){D===!0?n.vertexAttribIPointer(R,I,N,F,O):n.vertexAttribPointer(R,I,N,U,F,O)}function v(R,I,N,U){b();let F=U.attributes,O=N.getAttributes(),D=I.defaultAttributeValues;for(let G in O){let K=O[G];if(K.location>=0){let Q=F[G];if(Q===void 0&&(G==="instanceMatrix"&&R.instanceMatrix&&(Q=R.instanceMatrix),G==="instanceColor"&&R.instanceColor&&(Q=R.instanceColor)),Q!==void 0){let ne=Q.normalized,le=Q.itemSize,Ue=e.get(Q);if(Ue===void 0)continue;let He=Ue.buffer,Re=Ue.type,Y=Ue.bytesPerElement,W=Re===n.INT||Re===n.UNSIGNED_INT||Q.gpuType===oo;if(Q.isInterleavedBufferAttribute){let J=Q.data,pe=J.stride,we=Q.offset;if(J.isInstancedInterleavedBuffer){for(let Te=0;Te<K.locationSize;Te++)m(K.location+Te,J.meshPerAttribute);R.isInstancedMesh!==!0&&U._maxInstanceCount===void 0&&(U._maxInstanceCount=J.meshPerAttribute*J.count)}else for(let Te=0;Te<K.locationSize;Te++)g(K.location+Te);n.bindBuffer(n.ARRAY_BUFFER,He);for(let Te=0;Te<K.locationSize;Te++)E(K.location+Te,le/K.locationSize,Re,ne,pe*Y,(we+le/K.locationSize*Te)*Y,W)}else{if(Q.isInstancedBufferAttribute){for(let J=0;J<K.locationSize;J++)m(K.location+J,Q.meshPerAttribute);R.isInstancedMesh!==!0&&U._maxInstanceCount===void 0&&(U._maxInstanceCount=Q.meshPerAttribute*Q.count)}else for(let J=0;J<K.locationSize;J++)g(K.location+J);n.bindBuffer(n.ARRAY_BUFFER,He);for(let J=0;J<K.locationSize;J++)E(K.location+J,le/K.locationSize,Re,ne,le*Y,le/K.locationSize*J*Y,W)}}else if(D!==void 0){let ne=D[G];if(ne!==void 0)switch(ne.length){case 2:n.vertexAttrib2fv(K.location,ne);break;case 3:n.vertexAttrib3fv(K.location,ne);break;case 4:n.vertexAttrib4fv(K.location,ne);break;default:n.vertexAttrib1fv(K.location,ne)}}}}M()}function C(){A();for(let R in i){let I=i[R];for(let N in I){let U=I[N];for(let F in U){let O=U[F];for(let D in O)d(O[D].object),delete O[D];delete U[F]}}delete i[R]}}function S(R){if(i[R.id]===void 0)return;let I=i[R.id];for(let N in I){let U=I[N];for(let F in U){let O=U[F];for(let D in O)d(O[D].object),delete O[D];delete U[F]}}delete i[R.id]}function _(R){for(let I in i){let N=i[I];for(let U in N){let F=N[U];if(F[R.id]===void 0)continue;let O=F[R.id];for(let D in O)d(O[D].object),delete O[D];delete F[R.id]}}}function x(R){for(let I in i){let N=i[I],U=R.isInstancedMesh===!0?R.id:0,F=N[U];if(F!==void 0){for(let O in F){let D=F[O];for(let G in D)d(D[G].object),delete D[G];delete F[O]}delete N[U],Object.keys(N).length===0&&delete i[I]}}}function A(){T(),a=!0,s!==r&&(s=r,c(s.object))}function T(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:o,reset:A,resetDefaultState:T,dispose:C,releaseStatesOfGeometry:S,releaseStatesOfObject:x,releaseStatesOfProgram:_,initAttributes:b,enableAttribute:g,disableUnusedAttributes:M}}function $0(n,e,t){let i;function r(l){i=l}function s(l,c){n.drawArrays(i,l,c),t.update(c,i,1)}function a(l,c,d){d!==0&&(n.drawArraysInstanced(i,l,c,d),t.update(c,i,d))}function o(l,c,d){if(d===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,d);let h=0;for(let p=0;p<d;p++)h+=c[p];t.update(h,i,1)}this.setMode=r,this.render=s,this.renderInstances=a,this.renderMultiDraw=o}function Y0(n,e,t,i){let r;function s(){if(r!==void 0)return r;if(e.has("EXT_texture_filter_anisotropic")===!0){let _=e.get("EXT_texture_filter_anisotropic");r=n.getParameter(_.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function a(_){return!(_!==mn&&i.convert(_)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(_){let x=_===kn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(_!==en&&i.convert(_)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE)&&_!==pn&&!x)}function l(_){if(_==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";_="mediump"}return _==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp",d=l(c);d!==c&&(ke("WebGLRenderer:",c,"not supported, using",d,"instead."),c=d);let u=t.logarithmicDepthBuffer===!0,h=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&h===!1&&ke("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let p=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),f=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),b=n.getParameter(n.MAX_TEXTURE_SIZE),g=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),m=n.getParameter(n.MAX_VERTEX_ATTRIBS),M=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),E=n.getParameter(n.MAX_VARYING_VECTORS),v=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),C=n.getParameter(n.MAX_SAMPLES),S=n.getParameter(n.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:u,reversedDepthBuffer:h,maxTextures:p,maxVertexTextures:f,maxTextureSize:b,maxCubemapSize:g,maxAttributes:m,maxVertexUniforms:M,maxVaryings:E,maxFragmentUniforms:v,maxSamples:C,samples:S}}function Z0(n){let e=this,t=null,i=0,r=!1,s=!1,a=new Vt,o=new Ze,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,h){let p=u.length!==0||h||i!==0||r;return r=h,i=u.length,p},this.beginShadows=function(){s=!0,d(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(u,h){t=d(u,h,0)},this.setState=function(u,h,p){let f=u.clippingPlanes,b=u.clipIntersection,g=u.clipShadows,m=n.get(u);if(!r||f===null||f.length===0||s&&!g)s?d(null):c();else{let M=s?0:i,E=M*4,v=m.clippingState||null;l.value=v,v=d(f,h,E,p);for(let C=0;C!==E;++C)v[C]=t[C];m.clippingState=v,this.numIntersection=b?this.numPlanes:0,this.numPlanes+=M}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function d(u,h,p,f){let b=u!==null?u.length:0,g=null;if(b!==0){if(g=l.value,f!==!0||g===null){let m=p+b*4,M=h.matrixWorldInverse;o.getNormalMatrix(M),(g===null||g.length<m)&&(g=new Float32Array(m));for(let E=0,v=p;E!==b;++E,v+=4)a.copy(u[E]).applyMatrix4(M,o),a.normal.toArray(g,v),g[v+3]=a.constant}l.value=g,l.needsUpdate=!0}return e.numPlanes=b,e.numIntersection=0,g}}var bi=4,Zh=[.125,.215,.35,.446,.526,.582],qi=20,K0=256,Os=new Tr,Kh=new $e,Pc=null,Ic=0,Dc=0,Lc=!1,J0=new k,Zo=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,i=.1,r=100,s={}){let{size:a=256,position:o=J0}=s;Pc=this._renderer.getRenderTarget(),Ic=this._renderer.getActiveCubeFace(),Dc=this._renderer.getActiveMipmapLevel(),Lc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,i,r,l,o),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Qh(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=jh(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Pc,Ic,Dc),this._renderer.xr.enabled=Lc,e.scissorTest=!1,Ir(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===_i||e.mapping===Wi?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Pc=this._renderer.getRenderTarget(),Ic=this._renderer.getActiveCubeFace(),Dc=this._renderer.getActiveMipmapLevel(),Lc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let i=t||this._allocateTargets();return this._textureToCubeUV(e,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:Lt,minFilter:Lt,generateMipmaps:!1,type:kn,format:mn,colorSpace:es,depthBuffer:!1},r=Jh(e,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Jh(e,t,i);let{_lodMax:s}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=j0(s)),this._blurMaterial=e_(s,e,t),this._ggxMaterial=Q0(s,e,t)}return r}_compileMaterial(e){let t=new gt(new Ct,e);this._renderer.compile(t,Os)}_sceneToCubeUV(e,t,i,r,s){let l=new Xt(90,1,t,i),c=[1,-1,1,1,1,1],d=[1,1,1,-1,-1,-1],u=this._renderer,h=u.autoClear,p=u.toneMapping;u.getClearColor(Kh),u.toneMapping=Tn,u.autoClear=!1,u.state.buffers.depth.getReversed()&&(u.setRenderTarget(r),u.clearDepth(),u.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new gt(new Sr,new Jn({name:"PMREM.Background",side:jt,depthWrite:!1,depthTest:!1})));let b=this._backgroundBox,g=b.material,m=!1,M=e.background;M?M.isColor&&(g.color.copy(M),e.background=null,m=!0):(g.color.copy(Kh),m=!0);for(let E=0;E<6;E++){let v=E%3;v===0?(l.up.set(0,c[E],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x+d[E],s.y,s.z)):v===1?(l.up.set(0,0,c[E]),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y+d[E],s.z)):(l.up.set(0,c[E],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y,s.z+d[E]));let C=this._cubeSize;Ir(r,v*C,E>2?C:0,C,C),u.setRenderTarget(r),m&&u.render(b,l),u.render(e,l)}u.toneMapping=p,u.autoClear=h,e.background=M}_textureToCubeUV(e,t){let i=this._renderer,r=e.mapping===_i||e.mapping===Wi;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Qh()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=jh());let s=r?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=s;let o=s.uniforms;o.envMap.value=e;let l=this._cubeSize;Ir(t,0,0,3*l,2*l),i.setRenderTarget(t),i.render(a,Os)}_applyPMREM(e){let t=this._renderer,i=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let s=1;s<r;s++)this._applyGGXFilter(e,s-1,s);t.autoClear=i}_applyGGXFilter(e,t,i){let r=this._renderer,s=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[i];o.material=a;let l=a.uniforms,c=i/(this._lodMeshes.length-1),d=t/(this._lodMeshes.length-1),u=Math.sqrt(c*c-d*d),h=0+c*1.25,p=u*h,{_lodMax:f}=this,b=this._sizeLods[i],g=3*b*(i>f-bi?i-f+bi:0),m=4*(this._cubeSize-b);l.envMap.value=e.texture,l.roughness.value=p,l.mipInt.value=f-t,Ir(s,g,m,3*b,2*b),r.setRenderTarget(s),r.render(o,Os),l.envMap.value=s.texture,l.roughness.value=0,l.mipInt.value=f-i,Ir(e,g,m,3*b,2*b),r.setRenderTarget(e),r.render(o,Os)}_blur(e,t,i,r,s){let a=this._pingPongRenderTarget;this._halfBlur(e,a,t,i,r,"latitudinal",s),this._halfBlur(a,e,i,i,r,"longitudinal",s)}_halfBlur(e,t,i,r,s,a,o){let l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&Ge("blur direction must be either latitudinal or longitudinal!");let d=3,u=this._lodMeshes[r];u.material=c;let h=c.uniforms,p=this._sizeLods[i]-1,f=isFinite(s)?Math.PI/(2*p):2*Math.PI/(2*qi-1),b=s/f,g=isFinite(s)?1+Math.floor(d*b):qi;g>qi&&ke(`sigmaRadians, ${s}, is too large and will clip, as it requested ${g} samples when the maximum is set to ${qi}`);let m=[],M=0;for(let _=0;_<qi;++_){let x=_/b,A=Math.exp(-x*x/2);m.push(A),_===0?M+=A:_<g&&(M+=2*A)}for(let _=0;_<m.length;_++)m[_]=m[_]/M;h.envMap.value=e.texture,h.samples.value=g,h.weights.value=m,h.latitudinal.value=a==="latitudinal",o&&(h.poleAxis.value=o);let{_lodMax:E}=this;h.dTheta.value=f,h.mipInt.value=E-i;let v=this._sizeLods[r],C=3*v*(r>E-bi?r-E+bi:0),S=4*(this._cubeSize-v);Ir(t,C,S,3*v,2*v),l.setRenderTarget(t),l.render(u,Os)}};function j0(n){let e=[],t=[],i=[],r=n,s=n-bi+1+Zh.length;for(let a=0;a<s;a++){let o=Math.pow(2,r);e.push(o);let l=1/o;a>n-bi?l=Zh[a-n+bi-1]:a===0&&(l=0),t.push(l);let c=1/(o-2),d=-c,u=1+c,h=[d,d,u,d,u,u,d,d,u,u,d,u],p=6,f=6,b=3,g=2,m=1,M=new Float32Array(b*f*p),E=new Float32Array(g*f*p),v=new Float32Array(m*f*p);for(let S=0;S<p;S++){let _=S%3*2/3-1,x=S>2?0:-1,A=[_,x,0,_+2/3,x,0,_+2/3,x+1,0,_,x,0,_+2/3,x+1,0,_,x+1,0];M.set(A,b*f*S),E.set(h,g*f*S);let T=[S,S,S,S,S,S];v.set(T,m*f*S)}let C=new Ct;C.setAttribute("position",new Kt(M,b)),C.setAttribute("uv",new Kt(E,g)),C.setAttribute("faceIndex",new Kt(v,m)),i.push(new gt(C,null)),r>bi&&r--}return{lodMeshes:i,sizeLods:e,sigmas:t}}function Jh(n,e,t){let i=new cn(n,e,t);return i.texture.mapping=Rs,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function Ir(n,e,t,i,r){n.viewport.set(e,t,i,r),n.scissor.set(e,t,i,r)}function Q0(n,e,t){return new un({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:K0,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:jo(),fragmentShader:`

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
		`,blending:Bn,depthTest:!1,depthWrite:!1})}function e_(n,e,t){let i=new Float32Array(qi),r=new k(0,1,0);return new un({name:"SphericalGaussianBlur",defines:{n:qi,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:r}},vertexShader:jo(),fragmentShader:`

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
		`,blending:Bn,depthTest:!1,depthWrite:!1})}function jh(){return new un({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:jo(),fragmentShader:`

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
		`,blending:Bn,depthTest:!1,depthWrite:!1})}function Qh(){return new un({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:jo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Bn,depthTest:!1,depthWrite:!1})}function jo(){return`

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
	`}var Ko=class extends cn{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let i={width:e,height:e,depth:1},r=[i,i,i,i,i,i];this.texture=new us(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},r=new Sr(5,5,5),s=new un({name:"CubemapFromEquirect",uniforms:Xi(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:jt,blending:Bn});s.uniforms.tEquirect.value=t;let a=new gt(r,s),o=t.minFilter;return t.minFilter===xi&&(t.minFilter=Lt),new eo(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,i=!0,r=!0){let s=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,i,r);e.setRenderTarget(s)}};function t_(n){let e=new WeakMap,t=new WeakMap,i=null;function r(h,p=!1){return h==null?null:p?a(h):s(h)}function s(h){if(h&&h.isTexture){let p=h.mapping;if(p===ro||p===so)if(e.has(h)){let f=e.get(h).texture;return o(f,h.mapping)}else{let f=h.image;if(f&&f.height>0){let b=new Ko(f.height);return b.fromEquirectangularTexture(n,h),e.set(h,b),h.addEventListener("dispose",c),o(b.texture,h.mapping)}else return null}}return h}function a(h){if(h&&h.isTexture){let p=h.mapping,f=p===ro||p===so,b=p===_i||p===Wi;if(f||b){let g=t.get(h),m=g!==void 0?g.texture.pmremVersion:0;if(h.isRenderTargetTexture&&h.pmremVersion!==m)return i===null&&(i=new Zo(n)),g=f?i.fromEquirectangular(h,g):i.fromCubemap(h,g),g.texture.pmremVersion=h.pmremVersion,t.set(h,g),g.texture;if(g!==void 0)return g.texture;{let M=h.image;return f&&M&&M.height>0||b&&M&&l(M)?(i===null&&(i=new Zo(n)),g=f?i.fromEquirectangular(h):i.fromCubemap(h),g.texture.pmremVersion=h.pmremVersion,t.set(h,g),h.addEventListener("dispose",d),g.texture):null}}}return h}function o(h,p){return p===ro?h.mapping=_i:p===so&&(h.mapping=Wi),h}function l(h){let p=0,f=6;for(let b=0;b<f;b++)h[b]!==void 0&&p++;return p===f}function c(h){let p=h.target;p.removeEventListener("dispose",c);let f=e.get(p);f!==void 0&&(e.delete(p),f.dispose())}function d(h){let p=h.target;p.removeEventListener("dispose",d);let f=t.get(p);f!==void 0&&(t.delete(p),f.dispose())}function u(){e=new WeakMap,t=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:r,dispose:u}}function n_(n){let e={};function t(i){if(e[i]!==void 0)return e[i];let r=n.getExtension(i);return e[i]=r,r}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){let r=t(i);return r===null&&Ui("WebGLRenderer: "+i+" extension not supported."),r}}}function i_(n,e,t,i){let r={},s=new WeakMap;function a(u){let h=u.target;h.index!==null&&e.remove(h.index);for(let f in h.attributes)e.remove(h.attributes[f]);h.removeEventListener("dispose",a),delete r[h.id];let p=s.get(h);p&&(e.remove(p),s.delete(h)),i.releaseStatesOfGeometry(h),h.isInstancedBufferGeometry===!0&&delete h._maxInstanceCount,t.memory.geometries--}function o(u,h){return r[h.id]===!0||(h.addEventListener("dispose",a),r[h.id]=!0,t.memory.geometries++),h}function l(u){let h=u.attributes;for(let p in h)e.update(h[p],n.ARRAY_BUFFER)}function c(u){let h=[],p=u.index,f=u.attributes.position,b=0;if(f===void 0)return;if(p!==null){let M=p.array;b=p.version;for(let E=0,v=M.length;E<v;E+=3){let C=M[E+0],S=M[E+1],_=M[E+2];h.push(C,S,S,_,_,C)}}else{let M=f.array;b=f.version;for(let E=0,v=M.length/3-1;E<v;E+=3){let C=E+0,S=E+1,_=E+2;h.push(C,S,S,_,_,C)}}let g=new(f.count>=65535?os:as)(h,1);g.version=b;let m=s.get(u);m&&e.remove(m),s.set(u,g)}function d(u){let h=s.get(u);if(h){let p=u.index;p!==null&&h.version<p.version&&c(u)}else c(u);return s.get(u)}return{get:o,update:l,getWireframeAttribute:d}}function r_(n,e,t){let i;function r(u){i=u}let s,a;function o(u){s=u.type,a=u.bytesPerElement}function l(u,h){n.drawElements(i,h,s,u*a),t.update(h,i,1)}function c(u,h,p){p!==0&&(n.drawElementsInstanced(i,h,s,u*a,p),t.update(h,i,p))}function d(u,h,p){if(p===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,h,0,s,u,0,p);let b=0;for(let g=0;g<p;g++)b+=h[g];t.update(b,i,1)}this.setMode=r,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=d}function s_(n){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,a,o){switch(t.calls++,a){case n.TRIANGLES:t.triangles+=o*(s/3);break;case n.LINES:t.lines+=o*(s/2);break;case n.LINE_STRIP:t.lines+=o*(s-1);break;case n.LINE_LOOP:t.lines+=o*s;break;case n.POINTS:t.points+=o*s;break;default:Ge("WebGLInfo: Unknown draw mode:",a);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:r,update:i}}function a_(n,e,t){let i=new WeakMap,r=new vt;function s(a,o,l){let c=a.morphTargetInfluences,d=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=d!==void 0?d.length:0,h=i.get(o);if(h===void 0||h.count!==u){let A=function(){_.dispose(),i.delete(o),o.removeEventListener("dispose",A)};h!==void 0&&h.texture.dispose();let p=o.morphAttributes.position!==void 0,f=o.morphAttributes.normal!==void 0,b=o.morphAttributes.color!==void 0,g=o.morphAttributes.position||[],m=o.morphAttributes.normal||[],M=o.morphAttributes.color||[],E=0;p===!0&&(E=1),f===!0&&(E=2),b===!0&&(E=3);let v=o.attributes.position.count*E,C=1;v>e.maxTextureSize&&(C=Math.ceil(v/e.maxTextureSize),v=e.maxTextureSize);let S=new Float32Array(v*C*4*u),_=new is(S,v,C,u);_.type=pn,_.needsUpdate=!0;let x=E*4;for(let T=0;T<u;T++){let R=g[T],I=m[T],N=M[T],U=v*C*4*T;for(let F=0;F<R.count;F++){let O=F*x;p===!0&&(r.fromBufferAttribute(R,F),S[U+O+0]=r.x,S[U+O+1]=r.y,S[U+O+2]=r.z,S[U+O+3]=0),f===!0&&(r.fromBufferAttribute(I,F),S[U+O+4]=r.x,S[U+O+5]=r.y,S[U+O+6]=r.z,S[U+O+7]=0),b===!0&&(r.fromBufferAttribute(N,F),S[U+O+8]=r.x,S[U+O+9]=r.y,S[U+O+10]=r.z,S[U+O+11]=N.itemSize===4?r.w:1)}}h={count:u,texture:_,size:new Le(v,C)},i.set(o,h),o.addEventListener("dispose",A)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(n,"morphTexture",a.morphTexture,t);else{let p=0;for(let b=0;b<c.length;b++)p+=c[b];let f=o.morphTargetsRelative?1:1-p;l.getUniforms().setValue(n,"morphTargetBaseInfluence",f),l.getUniforms().setValue(n,"morphTargetInfluences",c)}l.getUniforms().setValue(n,"morphTargetsTexture",h.texture,t),l.getUniforms().setValue(n,"morphTargetsTextureSize",h.size)}return{update:s}}function o_(n,e,t,i,r){let s=new WeakMap;function a(c){let d=r.render.frame,u=c.geometry,h=e.get(c,u);if(s.get(h)!==d&&(e.update(h),s.set(h,d)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),s.get(c)!==d&&(t.update(c.instanceMatrix,n.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,n.ARRAY_BUFFER),s.set(c,d))),c.isSkinnedMesh){let p=c.skeleton;s.get(p)!==d&&(p.update(),s.set(p,d))}return h}function o(){s=new WeakMap}function l(c){let d=c.target;d.removeEventListener("dispose",l),i.releaseStatesOfObject(d),t.remove(d.instanceMatrix),d.instanceColor!==null&&t.remove(d.instanceColor)}return{update:a,dispose:o}}var l_={[cc]:"LINEAR_TONE_MAPPING",[uc]:"REINHARD_TONE_MAPPING",[hc]:"CINEON_TONE_MAPPING",[As]:"ACES_FILMIC_TONE_MAPPING",[fc]:"AGX_TONE_MAPPING",[pc]:"NEUTRAL_TONE_MAPPING",[dc]:"CUSTOM_TONE_MAPPING"};function c_(n,e,t,i,r,s){let a=new cn(e,t,{type:n,depthBuffer:r,stencilBuffer:s,samples:i?4:0,depthTexture:r?new jn(e,t):void 0}),o=new cn(e,t,{type:kn,depthBuffer:!1,stencilBuffer:!1}),l=new Ct;l.setAttribute("position",new ut([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new ut([0,2,0,0,2,0],2));let c=new Va({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),d=new gt(l,c),u=new Tr(-1,1,1,-1,0,1),h=null,p=null,f=!1,b,g=null,m=[],M=!1;this.setSize=function(E,v){a.setSize(E,v),o.setSize(E,v);for(let C=0;C<m.length;C++){let S=m[C];S.setSize&&S.setSize(E,v)}},this.setEffects=function(E){m=E,M=m.length>0&&m[0].isRenderPass===!0;let v=a.width,C=a.height;for(let S=0;S<m.length;S++){let _=m[S];_.setSize&&_.setSize(v,C)}},this.begin=function(E,v){if(f||E.toneMapping===Tn&&m.length===0)return!1;if(g=v,v!==null){let C=v.width,S=v.height;(a.width!==C||a.height!==S)&&this.setSize(C,S)}return M===!1&&E.setRenderTarget(a),b=E.toneMapping,E.toneMapping=Tn,!0},this.hasRenderPass=function(){return M},this.end=function(E,v){E.toneMapping=b,f=!0;let C=a,S=o;for(let _=0;_<m.length;_++){let x=m[_];if(x.enabled!==!1&&(x.render(E,S,C,v),x.needsSwap!==!1)){let A=C;C=S,S=A}}if(h!==E.outputColorSpace||p!==E.toneMapping){h=E.outputColorSpace,p=E.toneMapping,c.defines={},st.getTransfer(h)===ct&&(c.defines.SRGB_TRANSFER="");let _=l_[p];_&&(c.defines[_]=""),c.needsUpdate=!0}c.uniforms.tDiffuse.value=C.texture,E.setRenderTarget(g),E.render(d,u),g=null,f=!1},this.isCompositing=function(){return f},this.dispose=function(){a.depthTexture&&a.depthTexture.dispose(),a.dispose(),o.dispose(),l.dispose(),c.dispose()}}var yd=new Jt,Uc=new jn(1,1),vd=new is,bd=new Ba,Md=new us,ed=[],td=[],nd=new Float32Array(16),id=new Float32Array(9),rd=new Float32Array(4);function Lr(n,e,t){let i=n[0];if(i<=0||i>0)return n;let r=e*t,s=ed[r];if(s===void 0&&(s=new Float32Array(r),ed[r]=s),e!==0){i.toArray(s,0);for(let a=1,o=0;a!==e;++a)o+=t,n[a].toArray(s,o)}return s}function Ft(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function Nt(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function Qo(n,e){let t=td[e];t===void 0&&(t=new Int32Array(e),td[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function u_(n,e){let t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function h_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Ft(t,e))return;n.uniform2fv(this.addr,e),Nt(t,e)}}function d_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Ft(t,e))return;n.uniform3fv(this.addr,e),Nt(t,e)}}function f_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Ft(t,e))return;n.uniform4fv(this.addr,e),Nt(t,e)}}function p_(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(Ft(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),Nt(t,e)}else{if(Ft(t,i))return;rd.set(i),n.uniformMatrix2fv(this.addr,!1,rd),Nt(t,i)}}function m_(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(Ft(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),Nt(t,e)}else{if(Ft(t,i))return;id.set(i),n.uniformMatrix3fv(this.addr,!1,id),Nt(t,i)}}function g_(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(Ft(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),Nt(t,e)}else{if(Ft(t,i))return;nd.set(i),n.uniformMatrix4fv(this.addr,!1,nd),Nt(t,i)}}function __(n,e){let t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function x_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Ft(t,e))return;n.uniform2iv(this.addr,e),Nt(t,e)}}function y_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Ft(t,e))return;n.uniform3iv(this.addr,e),Nt(t,e)}}function v_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Ft(t,e))return;n.uniform4iv(this.addr,e),Nt(t,e)}}function b_(n,e){let t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function M_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Ft(t,e))return;n.uniform2uiv(this.addr,e),Nt(t,e)}}function S_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Ft(t,e))return;n.uniform3uiv(this.addr,e),Nt(t,e)}}function w_(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Ft(t,e))return;n.uniform4uiv(this.addr,e),Nt(t,e)}}function T_(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r);let s;this.type===n.SAMPLER_2D_SHADOW?(Uc.compareFunction=t.isReversedDepthBuffer()?qo:Xo,s=Uc):s=yd,t.setTexture2D(e||s,r)}function E_(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture3D(e||bd,r)}function A_(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTextureCube(e||Md,r)}function R_(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture2DArray(e||vd,r)}function C_(n){switch(n){case 5126:return u_;case 35664:return h_;case 35665:return d_;case 35666:return f_;case 35674:return p_;case 35675:return m_;case 35676:return g_;case 5124:case 35670:return __;case 35667:case 35671:return x_;case 35668:case 35672:return y_;case 35669:case 35673:return v_;case 5125:return b_;case 36294:return M_;case 36295:return S_;case 36296:return w_;case 35678:case 36198:case 36298:case 36306:case 35682:return T_;case 35679:case 36299:case 36307:return E_;case 35680:case 36300:case 36308:case 36293:return A_;case 36289:case 36303:case 36311:case 36292:return R_}}function P_(n,e){n.uniform1fv(this.addr,e)}function I_(n,e){let t=Lr(e,this.size,2);n.uniform2fv(this.addr,t)}function D_(n,e){let t=Lr(e,this.size,3);n.uniform3fv(this.addr,t)}function L_(n,e){let t=Lr(e,this.size,4);n.uniform4fv(this.addr,t)}function F_(n,e){let t=Lr(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function N_(n,e){let t=Lr(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function U_(n,e){let t=Lr(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function O_(n,e){n.uniform1iv(this.addr,e)}function B_(n,e){n.uniform2iv(this.addr,e)}function k_(n,e){n.uniform3iv(this.addr,e)}function z_(n,e){n.uniform4iv(this.addr,e)}function V_(n,e){n.uniform1uiv(this.addr,e)}function G_(n,e){n.uniform2uiv(this.addr,e)}function H_(n,e){n.uniform3uiv(this.addr,e)}function W_(n,e){n.uniform4uiv(this.addr,e)}function X_(n,e,t){let i=this.cache,r=e.length,s=Qo(t,r);Ft(i,s)||(n.uniform1iv(this.addr,s),Nt(i,s));let a;this.type===n.SAMPLER_2D_SHADOW?a=Uc:a=yd;for(let o=0;o!==r;++o)t.setTexture2D(e[o]||a,s[o])}function q_(n,e,t){let i=this.cache,r=e.length,s=Qo(t,r);Ft(i,s)||(n.uniform1iv(this.addr,s),Nt(i,s));for(let a=0;a!==r;++a)t.setTexture3D(e[a]||bd,s[a])}function $_(n,e,t){let i=this.cache,r=e.length,s=Qo(t,r);Ft(i,s)||(n.uniform1iv(this.addr,s),Nt(i,s));for(let a=0;a!==r;++a)t.setTextureCube(e[a]||Md,s[a])}function Y_(n,e,t){let i=this.cache,r=e.length,s=Qo(t,r);Ft(i,s)||(n.uniform1iv(this.addr,s),Nt(i,s));for(let a=0;a!==r;++a)t.setTexture2DArray(e[a]||vd,s[a])}function Z_(n){switch(n){case 5126:return P_;case 35664:return I_;case 35665:return D_;case 35666:return L_;case 35674:return F_;case 35675:return N_;case 35676:return U_;case 5124:case 35670:return O_;case 35667:case 35671:return B_;case 35668:case 35672:return k_;case 35669:case 35673:return z_;case 5125:return V_;case 36294:return G_;case 36295:return H_;case 36296:return W_;case 35678:case 36198:case 36298:case 36306:case 35682:return X_;case 35679:case 36299:case 36307:return q_;case 35680:case 36300:case 36308:case 36293:return $_;case 36289:case 36303:case 36311:case 36292:return Y_}}var Oc=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=C_(t.type)}},Bc=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Z_(t.type)}},kc=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){let r=this.seq;for(let s=0,a=r.length;s!==a;++s){let o=r[s];o.setValue(e,t[o.id],i)}}},Fc=/(\w+)(\])?(\[|\.)?/g;function sd(n,e){n.seq.push(e),n.map[e.id]=e}function K_(n,e,t){let i=n.name,r=i.length;for(Fc.lastIndex=0;;){let s=Fc.exec(i),a=Fc.lastIndex,o=s[1],l=s[2]==="]",c=s[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===r){sd(t,c===void 0?new Oc(o,n,e):new Bc(o,n,e));break}else{let u=t.map[o];u===void 0&&(u=new kc(o),sd(t,u)),t=u}}}var Dr=class{constructor(e,t){this.seq=[],this.map={};let i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let a=0;a<i;++a){let o=e.getActiveUniform(t,a),l=e.getUniformLocation(t,o.name);K_(o,l,this)}let r=[],s=[];for(let a of this.seq)a.type===e.SAMPLER_2D_SHADOW||a.type===e.SAMPLER_CUBE_SHADOW||a.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(a):s.push(a);r.length>0&&(this.seq=r.concat(s))}setValue(e,t,i,r){let s=this.map[t];s!==void 0&&s.setValue(e,i,r)}setOptional(e,t,i){let r=t[i];r!==void 0&&this.setValue(e,i,r)}static upload(e,t,i,r){for(let s=0,a=t.length;s!==a;++s){let o=t[s],l=i[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,r)}}static seqWithValue(e,t){let i=[];for(let r=0,s=e.length;r!==s;++r){let a=e[r];a.id in t&&i.push(a)}return i}};function ad(n,e,t){let i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}var J_=37297,j_=0;function Q_(n,e){let t=n.split(`
`),i=[],r=Math.max(e-6,0),s=Math.min(e+6,t.length);for(let a=r;a<s;a++){let o=a+1;i.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return i.join(`
`)}var od=new Ze;function ex(n){st._getMatrix(od,st.workingColorSpace,n);let e=`mat3( ${od.elements.map(t=>t.toFixed(4))} )`;switch(st.getTransfer(n)){case ts:return[e,"LinearTransferOETF"];case ct:return[e,"sRGBTransferOETF"];default:return ke("WebGLProgram: Unsupported color space: ",n),[e,"LinearTransferOETF"]}}function ld(n,e,t){let i=n.getShaderParameter(e,n.COMPILE_STATUS),s=(n.getShaderInfoLog(e)||"").trim();if(i&&s==="")return"";let a=/ERROR: 0:(\d+)/.exec(s);if(a){let o=parseInt(a[1]);return t.toUpperCase()+`

`+s+`

`+Q_(n.getShaderSource(e),o)}else return s}function tx(n,e){let t=ex(e);return[`vec4 ${n}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}var nx={[cc]:"Linear",[uc]:"Reinhard",[hc]:"Cineon",[As]:"ACESFilmic",[fc]:"AgX",[pc]:"Neutral",[dc]:"Custom"};function ix(n,e){let t=nx[e];return t===void 0?(ke("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+n+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var Yo=new k;function rx(){st.getLuminanceCoefficients(Yo);let n=Yo.x.toFixed(4),e=Yo.y.toFixed(4),t=Yo.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function sx(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ks).join(`
`)}function ax(n){let e=[];for(let t in n){let i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function ox(n,e){let t={},i=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){let s=n.getActiveAttrib(e,r),a=s.name,o=1;s.type===n.FLOAT_MAT2&&(o=2),s.type===n.FLOAT_MAT3&&(o=3),s.type===n.FLOAT_MAT4&&(o=4),t[a]={type:s.type,location:n.getAttribLocation(e,a),locationSize:o}}return t}function ks(n){return n!==""}function cd(n,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function ud(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var lx=/^[ \t]*#include +<([\w\d./]+)>/gm;function zc(n){return n.replace(lx,ux)}var cx=new Map;function ux(n,e){let t=nt[e];if(t===void 0){let i=cx.get(e);if(i!==void 0)t=nt[i],ke('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return zc(t)}var hx=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function hd(n){return n.replace(hx,dx)}function dx(n,e,t,i){let r="";for(let s=parseInt(e);s<parseInt(t);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function dd(n){let e=`precision ${n.precision} float;
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
#define LOW_PRECISION`),e}var fx={[Es]:"SHADOWMAP_TYPE_PCF",[Ar]:"SHADOWMAP_TYPE_VSM"};function px(n){return fx[n.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var mx={[_i]:"ENVMAP_TYPE_CUBE",[Wi]:"ENVMAP_TYPE_CUBE",[Rs]:"ENVMAP_TYPE_CUBE_UV"};function gx(n){return n.envMap===!1?"ENVMAP_TYPE_CUBE":mx[n.envMapMode]||"ENVMAP_TYPE_CUBE"}var _x={[Wi]:"ENVMAP_MODE_REFRACTION"};function xx(n){return n.envMap===!1?"ENVMAP_MODE_REFLECTION":_x[n.envMapMode]||"ENVMAP_MODE_REFLECTION"}var yx={[io]:"ENVMAP_BLENDING_MULTIPLY",[Ah]:"ENVMAP_BLENDING_MIX",[Rh]:"ENVMAP_BLENDING_ADD"};function vx(n){return n.envMap===!1?"ENVMAP_BLENDING_NONE":yx[n.combine]||"ENVMAP_BLENDING_NONE"}function bx(n){let e=n.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,i=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:i,maxMip:t}}function Mx(n,e,t,i){let r=n.getContext(),s=t.defines,a=t.vertexShader,o=t.fragmentShader,l=px(t),c=gx(t),d=xx(t),u=vx(t),h=bx(t),p=sx(t),f=ax(s),b=r.createProgram(),g,m,M=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(g=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,f].filter(ks).join(`
`),g.length>0&&(g+=`
`),m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,f].filter(ks).join(`
`),m.length>0&&(m+=`
`)):(g=[dd(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,f,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+d:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ks).join(`
`),m=[dd(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,f,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+d:"",t.envMap?"#define "+u:"",h?"#define CUBEUV_TEXEL_WIDTH "+h.texelWidth:"",h?"#define CUBEUV_TEXEL_HEIGHT "+h.texelHeight:"",h?"#define CUBEUV_MAX_MIP "+h.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Tn?"#define TONE_MAPPING":"",t.toneMapping!==Tn?nt.tonemapping_pars_fragment:"",t.toneMapping!==Tn?ix("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",nt.colorspace_pars_fragment,tx("linearToOutputTexel",t.outputColorSpace),rx(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(ks).join(`
`)),a=zc(a),a=cd(a,t),a=ud(a,t),o=zc(o),o=cd(o,t),o=ud(o,t),a=hd(a),o=hd(o),t.isRawShaderMaterial!==!0&&(M=`#version 300 es
`,g=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+g,m=["#define varying in",t.glslVersion===Mc?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Mc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+m);let E=M+g+a,v=M+m+o,C=ad(r,r.VERTEX_SHADER,E),S=ad(r,r.FRAGMENT_SHADER,v);r.attachShader(b,C),r.attachShader(b,S),t.index0AttributeName!==void 0?r.bindAttribLocation(b,0,t.index0AttributeName):t.hasPositionAttribute===!0&&r.bindAttribLocation(b,0,"position"),r.linkProgram(b);function _(R){if(n.debug.checkShaderErrors){let I=r.getProgramInfoLog(b)||"",N=r.getShaderInfoLog(C)||"",U=r.getShaderInfoLog(S)||"",F=I.trim(),O=N.trim(),D=U.trim(),G=!0,K=!0;if(r.getProgramParameter(b,r.LINK_STATUS)===!1)if(G=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(r,b,C,S);else{let Q=ld(r,C,"vertex"),ne=ld(r,S,"fragment");Ge("WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(b,r.VALIDATE_STATUS)+`

Material Name: `+R.name+`
Material Type: `+R.type+`

Program Info Log: `+F+`
`+Q+`
`+ne)}else F!==""?ke("WebGLProgram: Program Info Log:",F):(O===""||D==="")&&(K=!1);K&&(R.diagnostics={runnable:G,programLog:F,vertexShader:{log:O,prefix:g},fragmentShader:{log:D,prefix:m}})}r.deleteShader(C),r.deleteShader(S),x=new Dr(r,b),A=ox(r,b)}let x;this.getUniforms=function(){return x===void 0&&_(this),x};let A;this.getAttributes=function(){return A===void 0&&_(this),A};let T=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return T===!1&&(T=r.getProgramParameter(b,J_)),T},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(b),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=j_++,this.cacheKey=e,this.usedTimes=1,this.program=b,this.vertexShader=C,this.fragmentShader=S,this}var Sx=0,Vc=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,i){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(i)===!1&&(r.add(i),i.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){let t=this.shaderCache,i=t.get(e);return i===void 0&&(i=new Gc(e),t.set(e,i)),i}},Gc=class{constructor(e){this.id=Sx++,this.code=e,this.usedTimes=0}};function wx(n){return n===vi||n===Fs||n===Ns}function Tx(n,e,t,i,r,s){let a=new xr,o=new Vc,l=new Set,c=[],d=new Map,u=i.logarithmicDepthBuffer,h=i.precision,p={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function f(x){return l.add(x),x===0?"uv":`uv${x}`}function b(x,A,T,R,I,N){let U=R.fog,F=I.geometry,O=x.isMeshStandardMaterial||x.isMeshLambertMaterial||x.isMeshPhongMaterial?R.environment:null,D=x.isMeshStandardMaterial||x.isMeshLambertMaterial&&!x.envMap||x.isMeshPhongMaterial&&!x.envMap,G=e.get(x.envMap||O,D),K=G&&G.mapping===Rs?G.image.height:null,Q=p[x.type];x.precision!==null&&(h=i.getMaxPrecision(x.precision),h!==x.precision&&ke("WebGLProgram.getParameters:",x.precision,"not supported, using",h,"instead."));let ne=F.morphAttributes.position||F.morphAttributes.normal||F.morphAttributes.color,le=ne!==void 0?ne.length:0,Ue=0;F.morphAttributes.position!==void 0&&(Ue=1),F.morphAttributes.normal!==void 0&&(Ue=2),F.morphAttributes.color!==void 0&&(Ue=3);let He,Re,Y,W;if(Q){let Pe=Vn[Q];He=Pe.vertexShader,Re=Pe.fragmentShader}else{He=x.vertexShader,Re=x.fragmentShader;let Pe=o.getVertexShaderStage(x),St=o.getFragmentShaderStage(x);o.update(x,Pe,St),Y=Pe.id,W=St.id}let J=n.getRenderTarget(),pe=n.state.buffers.depth.getReversed(),we=I.isInstancedMesh===!0,Te=I.isBatchedMesh===!0,Ce=!!x.map,ie=!!x.matcap,he=!!G,de=!!x.aoMap,Se=!!x.lightMap,qe=!!x.bumpMap&&x.wireframe===!1,tt=!!x.normalMap,et=!!x.displacementMap,We=!!x.emissiveMap,ze=!!x.metalnessMap,Ye=!!x.roughnessMap,L=x.anisotropy>0,bt=x.clearcoat>0,Je=x.dispersion>0,P=x.iridescence>0,y=x.sheen>0,z=x.transmission>0,H=L&&!!x.anisotropyMap,Z=bt&&!!x.clearcoatMap,ce=bt&&!!x.clearcoatNormalMap,ue=bt&&!!x.clearcoatRoughnessMap,j=P&&!!x.iridescenceMap,ee=P&&!!x.iridescenceThicknessMap,me=y&&!!x.sheenColorMap,Fe=y&&!!x.sheenRoughnessMap,xe=!!x.specularMap,ge=!!x.specularColorMap,Be=!!x.specularIntensityMap,Ve=z&&!!x.transmissionMap,je=z&&!!x.thicknessMap,B=!!x.gradientMap,fe=!!x.alphaMap,te=x.alphaTest>0,_e=!!x.alphaHash,Me=!!x.extensions,re=Tn;x.toneMapped&&(J===null||J.isXRRenderTarget===!0)&&(re=n.toneMapping);let De={shaderID:Q,shaderType:x.type,shaderName:x.name,vertexShader:He,fragmentShader:Re,defines:x.defines,customVertexShaderID:Y,customFragmentShaderID:W,isRawShaderMaterial:x.isRawShaderMaterial===!0,glslVersion:x.glslVersion,precision:h,batching:Te,batchingColor:Te&&I._colorsTexture!==null,instancing:we,instancingColor:we&&I.instanceColor!==null,instancingMorph:we&&I.morphTexture!==null,outputColorSpace:J===null?n.outputColorSpace:J.isXRRenderTarget===!0?J.texture.colorSpace:st.workingColorSpace,alphaToCoverage:!!x.alphaToCoverage,map:Ce,matcap:ie,envMap:he,envMapMode:he&&G.mapping,envMapCubeUVHeight:K,aoMap:de,lightMap:Se,bumpMap:qe,normalMap:tt,displacementMap:et,emissiveMap:We,normalMapObjectSpace:tt&&x.normalMapType===Ih,normalMapTangentSpace:tt&&x.normalMapType===Us,packedNormalMap:tt&&x.normalMapType===Us&&wx(x.normalMap.format),metalnessMap:ze,roughnessMap:Ye,anisotropy:L,anisotropyMap:H,clearcoat:bt,clearcoatMap:Z,clearcoatNormalMap:ce,clearcoatRoughnessMap:ue,dispersion:Je,iridescence:P,iridescenceMap:j,iridescenceThicknessMap:ee,sheen:y,sheenColorMap:me,sheenRoughnessMap:Fe,specularMap:xe,specularColorMap:ge,specularIntensityMap:Be,transmission:z,transmissionMap:Ve,thicknessMap:je,gradientMap:B,opaque:x.transparent===!1&&x.blending===Oi&&x.alphaToCoverage===!1,alphaMap:fe,alphaTest:te,alphaHash:_e,combine:x.combine,mapUv:Ce&&f(x.map.channel),aoMapUv:de&&f(x.aoMap.channel),lightMapUv:Se&&f(x.lightMap.channel),bumpMapUv:qe&&f(x.bumpMap.channel),normalMapUv:tt&&f(x.normalMap.channel),displacementMapUv:et&&f(x.displacementMap.channel),emissiveMapUv:We&&f(x.emissiveMap.channel),metalnessMapUv:ze&&f(x.metalnessMap.channel),roughnessMapUv:Ye&&f(x.roughnessMap.channel),anisotropyMapUv:H&&f(x.anisotropyMap.channel),clearcoatMapUv:Z&&f(x.clearcoatMap.channel),clearcoatNormalMapUv:ce&&f(x.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:ue&&f(x.clearcoatRoughnessMap.channel),iridescenceMapUv:j&&f(x.iridescenceMap.channel),iridescenceThicknessMapUv:ee&&f(x.iridescenceThicknessMap.channel),sheenColorMapUv:me&&f(x.sheenColorMap.channel),sheenRoughnessMapUv:Fe&&f(x.sheenRoughnessMap.channel),specularMapUv:xe&&f(x.specularMap.channel),specularColorMapUv:ge&&f(x.specularColorMap.channel),specularIntensityMapUv:Be&&f(x.specularIntensityMap.channel),transmissionMapUv:Ve&&f(x.transmissionMap.channel),thicknessMapUv:je&&f(x.thicknessMap.channel),alphaMapUv:fe&&f(x.alphaMap.channel),vertexTangents:!!F.attributes.tangent&&(tt||L),vertexNormals:!!F.attributes.normal,vertexColors:x.vertexColors,vertexAlphas:x.vertexColors===!0&&!!F.attributes.color&&F.attributes.color.itemSize===4,pointsUvs:I.isPoints===!0&&!!F.attributes.uv&&(Ce||fe),fog:!!U,useFog:x.fog===!0,fogExp2:!!U&&U.isFogExp2,flatShading:x.wireframe===!1&&(x.flatShading===!0||F.attributes.normal===void 0&&tt===!1&&(x.isMeshLambertMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isMeshPhysicalMaterial)),sizeAttenuation:x.sizeAttenuation===!0,logarithmicDepthBuffer:u,reversedDepthBuffer:pe,skinning:I.isSkinnedMesh===!0,hasPositionAttribute:F.attributes.position!==void 0,morphTargets:F.morphAttributes.position!==void 0,morphNormals:F.morphAttributes.normal!==void 0,morphColors:F.morphAttributes.color!==void 0,morphTargetsCount:le,morphTextureStride:Ue,numDirLights:A.directional.length,numPointLights:A.point.length,numSpotLights:A.spot.length,numSpotLightMaps:A.spotLightMap.length,numRectAreaLights:A.rectArea.length,numHemiLights:A.hemi.length,numDirLightShadows:A.directionalShadowMap.length,numPointLightShadows:A.pointShadowMap.length,numSpotLightShadows:A.spotShadowMap.length,numSpotLightShadowsWithMaps:A.numSpotLightShadowsWithMaps,numLightProbes:A.numLightProbes,numLightProbeGrids:N.length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:x.dithering,shadowMapEnabled:n.shadowMap.enabled&&T.length>0,shadowMapType:n.shadowMap.type,toneMapping:re,decodeVideoTexture:Ce&&x.map.isVideoTexture===!0&&st.getTransfer(x.map.colorSpace)===ct,decodeVideoTextureEmissive:We&&x.emissiveMap.isVideoTexture===!0&&st.getTransfer(x.emissiveMap.colorSpace)===ct,premultipliedAlpha:x.premultipliedAlpha,doubleSided:x.side===Pt,flipSided:x.side===jt,useDepthPacking:x.depthPacking>=0,depthPacking:x.depthPacking||0,index0AttributeName:x.index0AttributeName,extensionClipCullDistance:Me&&x.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Me&&x.extensions.multiDraw===!0||Te)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:x.customProgramCacheKey()};return De.vertexUv1s=l.has(1),De.vertexUv2s=l.has(2),De.vertexUv3s=l.has(3),l.clear(),De}function g(x){let A=[];if(x.shaderID?A.push(x.shaderID):(A.push(x.customVertexShaderID),A.push(x.customFragmentShaderID)),x.defines!==void 0)for(let T in x.defines)A.push(T),A.push(x.defines[T]);return x.isRawShaderMaterial===!1&&(m(A,x),M(A,x),A.push(n.outputColorSpace)),A.push(x.customProgramCacheKey),A.join()}function m(x,A){x.push(A.precision),x.push(A.outputColorSpace),x.push(A.envMapMode),x.push(A.envMapCubeUVHeight),x.push(A.mapUv),x.push(A.alphaMapUv),x.push(A.lightMapUv),x.push(A.aoMapUv),x.push(A.bumpMapUv),x.push(A.normalMapUv),x.push(A.displacementMapUv),x.push(A.emissiveMapUv),x.push(A.metalnessMapUv),x.push(A.roughnessMapUv),x.push(A.anisotropyMapUv),x.push(A.clearcoatMapUv),x.push(A.clearcoatNormalMapUv),x.push(A.clearcoatRoughnessMapUv),x.push(A.iridescenceMapUv),x.push(A.iridescenceThicknessMapUv),x.push(A.sheenColorMapUv),x.push(A.sheenRoughnessMapUv),x.push(A.specularMapUv),x.push(A.specularColorMapUv),x.push(A.specularIntensityMapUv),x.push(A.transmissionMapUv),x.push(A.thicknessMapUv),x.push(A.combine),x.push(A.fogExp2),x.push(A.sizeAttenuation),x.push(A.morphTargetsCount),x.push(A.morphAttributeCount),x.push(A.numDirLights),x.push(A.numPointLights),x.push(A.numSpotLights),x.push(A.numSpotLightMaps),x.push(A.numHemiLights),x.push(A.numRectAreaLights),x.push(A.numDirLightShadows),x.push(A.numPointLightShadows),x.push(A.numSpotLightShadows),x.push(A.numSpotLightShadowsWithMaps),x.push(A.numLightProbes),x.push(A.shadowMapType),x.push(A.toneMapping),x.push(A.numClippingPlanes),x.push(A.numClipIntersection),x.push(A.depthPacking)}function M(x,A){a.disableAll(),A.instancing&&a.enable(0),A.instancingColor&&a.enable(1),A.instancingMorph&&a.enable(2),A.matcap&&a.enable(3),A.envMap&&a.enable(4),A.normalMapObjectSpace&&a.enable(5),A.normalMapTangentSpace&&a.enable(6),A.clearcoat&&a.enable(7),A.iridescence&&a.enable(8),A.alphaTest&&a.enable(9),A.vertexColors&&a.enable(10),A.vertexAlphas&&a.enable(11),A.vertexUv1s&&a.enable(12),A.vertexUv2s&&a.enable(13),A.vertexUv3s&&a.enable(14),A.vertexTangents&&a.enable(15),A.anisotropy&&a.enable(16),A.alphaHash&&a.enable(17),A.batching&&a.enable(18),A.dispersion&&a.enable(19),A.batchingColor&&a.enable(20),A.gradientMap&&a.enable(21),A.packedNormalMap&&a.enable(22),A.vertexNormals&&a.enable(23),x.push(a.mask),a.disableAll(),A.fog&&a.enable(0),A.useFog&&a.enable(1),A.flatShading&&a.enable(2),A.logarithmicDepthBuffer&&a.enable(3),A.reversedDepthBuffer&&a.enable(4),A.skinning&&a.enable(5),A.morphTargets&&a.enable(6),A.morphNormals&&a.enable(7),A.morphColors&&a.enable(8),A.premultipliedAlpha&&a.enable(9),A.shadowMapEnabled&&a.enable(10),A.doubleSided&&a.enable(11),A.flipSided&&a.enable(12),A.useDepthPacking&&a.enable(13),A.dithering&&a.enable(14),A.transmission&&a.enable(15),A.sheen&&a.enable(16),A.opaque&&a.enable(17),A.pointsUvs&&a.enable(18),A.decodeVideoTexture&&a.enable(19),A.decodeVideoTextureEmissive&&a.enable(20),A.alphaToCoverage&&a.enable(21),A.numLightProbeGrids>0&&a.enable(22),A.hasPositionAttribute&&a.enable(23),x.push(a.mask)}function E(x){let A=p[x.type],T;if(A){let R=Vn[A];T=$h.clone(R.uniforms)}else T=x.uniforms;return T}function v(x,A){let T=d.get(A);return T!==void 0?++T.usedTimes:(T=new Mx(n,A,x,r),c.push(T),d.set(A,T)),T}function C(x){if(--x.usedTimes===0){let A=c.indexOf(x);c[A]=c[c.length-1],c.pop(),d.delete(x.cacheKey),x.destroy()}}function S(x){o.remove(x)}function _(){o.dispose()}return{getParameters:b,getProgramCacheKey:g,getUniforms:E,acquireProgram:v,releaseProgram:C,releaseShaderCache:S,programs:c,dispose:_}}function Ex(){let n=new WeakMap;function e(a){return n.has(a)}function t(a){let o=n.get(a);return o===void 0&&(o={},n.set(a,o)),o}function i(a){n.delete(a)}function r(a,o,l){n.get(a)[o]=l}function s(){n=new WeakMap}return{has:e,get:t,remove:i,update:r,dispose:s}}function Ax(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.materialVariant!==e.materialVariant?n.materialVariant-e.materialVariant:n.z!==e.z?n.z-e.z:n.id-e.id}function fd(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function pd(){let n=[],e=0,t=[],i=[],r=[];function s(){e=0,t.length=0,i.length=0,r.length=0}function a(h){let p=0;return h.isInstancedMesh&&(p+=2),h.isSkinnedMesh&&(p+=1),p}function o(h,p,f,b,g,m){let M=n[e];return M===void 0?(M={id:h.id,object:h,geometry:p,material:f,materialVariant:a(h),groupOrder:b,renderOrder:h.renderOrder,z:g,group:m},n[e]=M):(M.id=h.id,M.object=h,M.geometry=p,M.material=f,M.materialVariant=a(h),M.groupOrder=b,M.renderOrder=h.renderOrder,M.z=g,M.group=m),e++,M}function l(h,p,f,b,g,m){let M=o(h,p,f,b,g,m);f.transmission>0?i.push(M):f.transparent===!0?r.push(M):t.push(M)}function c(h,p,f,b,g,m){let M=o(h,p,f,b,g,m);f.transmission>0?i.unshift(M):f.transparent===!0?r.unshift(M):t.unshift(M)}function d(h,p,f){t.length>1&&t.sort(h||Ax),i.length>1&&i.sort(p||fd),r.length>1&&r.sort(p||fd),f&&(t.reverse(),i.reverse(),r.reverse())}function u(){for(let h=e,p=n.length;h<p;h++){let f=n[h];if(f.id===null)break;f.id=null,f.object=null,f.geometry=null,f.material=null,f.group=null}}return{opaque:t,transmissive:i,transparent:r,init:s,push:l,unshift:c,finish:u,sort:d}}function Rx(){let n=new WeakMap;function e(i,r){let s=n.get(i),a;return s===void 0?(a=new pd,n.set(i,[a])):r>=s.length?(a=new pd,s.push(a)):a=s[r],a}function t(){n=new WeakMap}return{get:e,dispose:t}}function Cx(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new k,color:new $e};break;case"SpotLight":t={position:new k,direction:new k,color:new $e,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new k,color:new $e,distance:0,decay:0};break;case"HemisphereLight":t={direction:new k,skyColor:new $e,groundColor:new $e};break;case"RectAreaLight":t={color:new $e,position:new k,halfWidth:new k,halfHeight:new k};break}return n[e.id]=t,t}}}function Px(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Le};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Le};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Le,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}var Ix=0;function Dx(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function Lx(n){let e=new Cx,t=Px(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new k);let r=new k,s=new mt,a=new mt;function o(c){let d=0,u=0,h=0;for(let A=0;A<9;A++)i.probe[A].set(0,0,0);let p=0,f=0,b=0,g=0,m=0,M=0,E=0,v=0,C=0,S=0,_=0;c.sort(Dx);for(let A=0,T=c.length;A<T;A++){let R=c[A],I=R.color,N=R.intensity,U=R.distance,F=null;if(R.shadow&&R.shadow.map&&(R.shadow.map.texture.format===vi?F=R.shadow.map.texture:F=R.shadow.map.depthTexture||R.shadow.map.texture),R.isAmbientLight)d+=I.r*N,u+=I.g*N,h+=I.b*N;else if(R.isLightProbe){for(let O=0;O<9;O++)i.probe[O].addScaledVector(R.sh.coefficients[O],N);_++}else if(R.isDirectionalLight){let O=e.get(R);if(O.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){let D=R.shadow,G=t.get(R);G.shadowIntensity=D.intensity,G.shadowBias=D.bias,G.shadowNormalBias=D.normalBias,G.shadowRadius=D.radius,G.shadowMapSize=D.mapSize,i.directionalShadow[p]=G,i.directionalShadowMap[p]=F,i.directionalShadowMatrix[p]=R.shadow.matrix,M++}i.directional[p]=O,p++}else if(R.isSpotLight){let O=e.get(R);O.position.setFromMatrixPosition(R.matrixWorld),O.color.copy(I).multiplyScalar(N),O.distance=U,O.coneCos=Math.cos(R.angle),O.penumbraCos=Math.cos(R.angle*(1-R.penumbra)),O.decay=R.decay,i.spot[b]=O;let D=R.shadow;if(R.map&&(i.spotLightMap[C]=R.map,C++,D.updateMatrices(R),R.castShadow&&S++),i.spotLightMatrix[b]=D.matrix,R.castShadow){let G=t.get(R);G.shadowIntensity=D.intensity,G.shadowBias=D.bias,G.shadowNormalBias=D.normalBias,G.shadowRadius=D.radius,G.shadowMapSize=D.mapSize,i.spotShadow[b]=G,i.spotShadowMap[b]=F,v++}b++}else if(R.isRectAreaLight){let O=e.get(R);O.color.copy(I).multiplyScalar(N),O.halfWidth.set(R.width*.5,0,0),O.halfHeight.set(0,R.height*.5,0),i.rectArea[g]=O,g++}else if(R.isPointLight){let O=e.get(R);if(O.color.copy(R.color).multiplyScalar(R.intensity),O.distance=R.distance,O.decay=R.decay,R.castShadow){let D=R.shadow,G=t.get(R);G.shadowIntensity=D.intensity,G.shadowBias=D.bias,G.shadowNormalBias=D.normalBias,G.shadowRadius=D.radius,G.shadowMapSize=D.mapSize,G.shadowCameraNear=D.camera.near,G.shadowCameraFar=D.camera.far,i.pointShadow[f]=G,i.pointShadowMap[f]=F,i.pointShadowMatrix[f]=R.shadow.matrix,E++}i.point[f]=O,f++}else if(R.isHemisphereLight){let O=e.get(R);O.skyColor.copy(R.color).multiplyScalar(N),O.groundColor.copy(R.groundColor).multiplyScalar(N),i.hemi[m]=O,m++}}g>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=ye.LTC_FLOAT_1,i.rectAreaLTC2=ye.LTC_FLOAT_2):(i.rectAreaLTC1=ye.LTC_HALF_1,i.rectAreaLTC2=ye.LTC_HALF_2)),i.ambient[0]=d,i.ambient[1]=u,i.ambient[2]=h;let x=i.hash;(x.directionalLength!==p||x.pointLength!==f||x.spotLength!==b||x.rectAreaLength!==g||x.hemiLength!==m||x.numDirectionalShadows!==M||x.numPointShadows!==E||x.numSpotShadows!==v||x.numSpotMaps!==C||x.numLightProbes!==_)&&(i.directional.length=p,i.spot.length=b,i.rectArea.length=g,i.point.length=f,i.hemi.length=m,i.directionalShadow.length=M,i.directionalShadowMap.length=M,i.pointShadow.length=E,i.pointShadowMap.length=E,i.spotShadow.length=v,i.spotShadowMap.length=v,i.directionalShadowMatrix.length=M,i.pointShadowMatrix.length=E,i.spotLightMatrix.length=v+C-S,i.spotLightMap.length=C,i.numSpotLightShadowsWithMaps=S,i.numLightProbes=_,x.directionalLength=p,x.pointLength=f,x.spotLength=b,x.rectAreaLength=g,x.hemiLength=m,x.numDirectionalShadows=M,x.numPointShadows=E,x.numSpotShadows=v,x.numSpotMaps=C,x.numLightProbes=_,i.version=Ix++)}function l(c,d){let u=0,h=0,p=0,f=0,b=0,g=d.matrixWorldInverse;for(let m=0,M=c.length;m<M;m++){let E=c[m];if(E.isDirectionalLight){let v=i.directional[u];v.direction.setFromMatrixPosition(E.matrixWorld),r.setFromMatrixPosition(E.target.matrixWorld),v.direction.sub(r),v.direction.transformDirection(g),u++}else if(E.isSpotLight){let v=i.spot[p];v.position.setFromMatrixPosition(E.matrixWorld),v.position.applyMatrix4(g),v.direction.setFromMatrixPosition(E.matrixWorld),r.setFromMatrixPosition(E.target.matrixWorld),v.direction.sub(r),v.direction.transformDirection(g),p++}else if(E.isRectAreaLight){let v=i.rectArea[f];v.position.setFromMatrixPosition(E.matrixWorld),v.position.applyMatrix4(g),a.identity(),s.copy(E.matrixWorld),s.premultiply(g),a.extractRotation(s),v.halfWidth.set(E.width*.5,0,0),v.halfHeight.set(0,E.height*.5,0),v.halfWidth.applyMatrix4(a),v.halfHeight.applyMatrix4(a),f++}else if(E.isPointLight){let v=i.point[h];v.position.setFromMatrixPosition(E.matrixWorld),v.position.applyMatrix4(g),h++}else if(E.isHemisphereLight){let v=i.hemi[b];v.direction.setFromMatrixPosition(E.matrixWorld),v.direction.transformDirection(g),b++}}}return{setup:o,setupView:l,state:i}}function md(n){let e=new Lx(n),t=[],i=[],r=[];function s(h){u.camera=h,t.length=0,i.length=0,r.length=0}function a(h){t.push(h)}function o(h){i.push(h)}function l(h){r.push(h)}function c(){e.setup(t)}function d(h){e.setupView(t,h)}let u={lightsArray:t,shadowsArray:i,lightProbeGridArray:r,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:s,state:u,setupLights:c,setupLightsView:d,pushLight:a,pushShadow:o,pushLightProbeGrid:l}}function Fx(n){let e=new WeakMap;function t(r,s=0){let a=e.get(r),o;return a===void 0?(o=new md(n),e.set(r,[o])):s>=a.length?(o=new md(n),a.push(o)):o=a[s],o}function i(){e=new WeakMap}return{get:t,dispose:i}}var Nx=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Ux=`uniform sampler2D shadow_pass;
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
}`,Ox=[new k(1,0,0),new k(-1,0,0),new k(0,1,0),new k(0,-1,0),new k(0,0,1),new k(0,0,-1)],Bx=[new k(0,-1,0),new k(0,-1,0),new k(0,0,1),new k(0,0,-1),new k(0,-1,0),new k(0,-1,0)],gd=new mt,Bs=new k,Nc=new k;function kx(n,e,t){let i=new br,r=new Le,s=new Le,a=new vt,o=new Ga,l=new Ha,c={},d=t.maxTextureSize,u={[Mn]:jt,[jt]:Mn,[Pt]:Pt},h=new un({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Le},radius:{value:4}},vertexShader:Nx,fragmentShader:Ux}),p=h.clone();p.defines.HORIZONTAL_PASS=1;let f=new Ct;f.setAttribute("position",new Kt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let b=new gt(f,h),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Es;let m=this.type;this.render=function(S,_,x){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||S.length===0)return;this.type===no&&(ke("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=Es);let A=n.getRenderTarget(),T=n.getActiveCubeFace(),R=n.getActiveMipmapLevel(),I=n.state;I.setBlending(Bn),I.buffers.depth.getReversed()===!0?I.buffers.color.setClear(0,0,0,0):I.buffers.color.setClear(1,1,1,1),I.buffers.depth.setTest(!0),I.setScissorTest(!1);let N=m!==this.type;N&&_.traverse(function(U){U.material&&(Array.isArray(U.material)?U.material.forEach(F=>F.needsUpdate=!0):U.material.needsUpdate=!0)});for(let U=0,F=S.length;U<F;U++){let O=S[U],D=O.shadow;if(D===void 0){ke("WebGLShadowMap:",O,"has no shadow.");continue}if(D.autoUpdate===!1&&D.needsUpdate===!1)continue;r.copy(D.mapSize);let G=D.getFrameExtents();r.multiply(G),s.copy(D.mapSize),(r.x>d||r.y>d)&&(r.x>d&&(s.x=Math.floor(d/G.x),r.x=s.x*G.x,D.mapSize.x=s.x),r.y>d&&(s.y=Math.floor(d/G.y),r.y=s.y*G.y,D.mapSize.y=s.y));let K=n.state.buffers.depth.getReversed();if(D.camera._reversedDepth=K,D.map===null||N===!0){if(D.map!==null&&(D.map.depthTexture!==null&&(D.map.depthTexture.dispose(),D.map.depthTexture=null),D.map.dispose()),this.type===Ar){if(O.isPointLight){ke("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}D.map=new cn(r.x,r.y,{format:vi,type:kn,minFilter:Lt,magFilter:Lt,generateMipmaps:!1}),D.map.texture.name=O.name+".shadowMap",D.map.depthTexture=new jn(r.x,r.y,pn),D.map.depthTexture.name=O.name+".shadowMapDepth",D.map.depthTexture.format=Nn,D.map.depthTexture.compareFunction=null,D.map.depthTexture.minFilter=kt,D.map.depthTexture.magFilter=kt}else O.isPointLight?(D.map=new Ko(r.x),D.map.depthTexture=new ka(r.x,En)):(D.map=new cn(r.x,r.y),D.map.depthTexture=new jn(r.x,r.y,En)),D.map.depthTexture.name=O.name+".shadowMap",D.map.depthTexture.format=Nn,this.type===Es?(D.map.depthTexture.compareFunction=K?qo:Xo,D.map.depthTexture.minFilter=Lt,D.map.depthTexture.magFilter=Lt):(D.map.depthTexture.compareFunction=null,D.map.depthTexture.minFilter=kt,D.map.depthTexture.magFilter=kt);D.camera.updateProjectionMatrix()}let Q=D.map.isWebGLCubeRenderTarget?6:1;for(let ne=0;ne<Q;ne++){if(D.map.isWebGLCubeRenderTarget)n.setRenderTarget(D.map,ne),n.clear();else{ne===0&&(n.setRenderTarget(D.map),n.clear());let le=D.getViewport(ne);a.set(s.x*le.x,s.y*le.y,s.x*le.z,s.y*le.w),I.viewport(a)}if(O.isPointLight){let le=D.camera,Ue=D.matrix,He=O.distance||le.far;He!==le.far&&(le.far=He,le.updateProjectionMatrix()),Bs.setFromMatrixPosition(O.matrixWorld),le.position.copy(Bs),Nc.copy(le.position),Nc.add(Ox[ne]),le.up.copy(Bx[ne]),le.lookAt(Nc),le.updateMatrixWorld(),Ue.makeTranslation(-Bs.x,-Bs.y,-Bs.z),gd.multiplyMatrices(le.projectionMatrix,le.matrixWorldInverse),D._frustum.setFromProjectionMatrix(gd,le.coordinateSystem,le.reversedDepth)}else D.updateMatrices(O);i=D.getFrustum(),v(_,x,D.camera,O,this.type)}D.isPointLightShadow!==!0&&this.type===Ar&&M(D,x),D.needsUpdate=!1}m=this.type,g.needsUpdate=!1,n.setRenderTarget(A,T,R)};function M(S,_){let x=e.update(b);h.defines.VSM_SAMPLES!==S.blurSamples&&(h.defines.VSM_SAMPLES=S.blurSamples,p.defines.VSM_SAMPLES=S.blurSamples,h.needsUpdate=!0,p.needsUpdate=!0),S.mapPass===null&&(S.mapPass=new cn(r.x,r.y,{format:vi,type:kn})),h.uniforms.shadow_pass.value=S.map.depthTexture,h.uniforms.resolution.value=S.mapSize,h.uniforms.radius.value=S.radius,n.setRenderTarget(S.mapPass),n.clear(),n.renderBufferDirect(_,null,x,h,b,null),p.uniforms.shadow_pass.value=S.mapPass.texture,p.uniforms.resolution.value=S.mapSize,p.uniforms.radius.value=S.radius,n.setRenderTarget(S.map),n.clear(),n.renderBufferDirect(_,null,x,p,b,null)}function E(S,_,x,A){let T=null,R=x.isPointLight===!0?S.customDistanceMaterial:S.customDepthMaterial;if(R!==void 0)T=R;else if(T=x.isPointLight===!0?l:o,n.localClippingEnabled&&_.clipShadows===!0&&Array.isArray(_.clippingPlanes)&&_.clippingPlanes.length!==0||_.displacementMap&&_.displacementScale!==0||_.alphaMap&&_.alphaTest>0||_.map&&_.alphaTest>0||_.alphaToCoverage===!0){let I=T.uuid,N=_.uuid,U=c[I];U===void 0&&(U={},c[I]=U);let F=U[N];F===void 0&&(F=T.clone(),U[N]=F,_.addEventListener("dispose",C)),T=F}if(T.visible=_.visible,T.wireframe=_.wireframe,A===Ar?T.side=_.shadowSide!==null?_.shadowSide:_.side:T.side=_.shadowSide!==null?_.shadowSide:u[_.side],T.alphaMap=_.alphaMap,T.alphaTest=_.alphaToCoverage===!0?.5:_.alphaTest,T.map=_.map,T.clipShadows=_.clipShadows,T.clippingPlanes=_.clippingPlanes,T.clipIntersection=_.clipIntersection,T.displacementMap=_.displacementMap,T.displacementScale=_.displacementScale,T.displacementBias=_.displacementBias,T.wireframeLinewidth=_.wireframeLinewidth,T.linewidth=_.linewidth,x.isPointLight===!0&&T.isMeshDistanceMaterial===!0){let I=n.properties.get(T);I.light=x}return T}function v(S,_,x,A,T){if(S.visible===!1)return;if(S.layers.test(_.layers)&&(S.isMesh||S.isLine||S.isPoints)&&(S.castShadow||S.receiveShadow&&T===Ar)&&(!S.frustumCulled||i.intersectsObject(S))){S.modelViewMatrix.multiplyMatrices(x.matrixWorldInverse,S.matrixWorld);let N=e.update(S),U=S.material;if(Array.isArray(U)){let F=N.groups;for(let O=0,D=F.length;O<D;O++){let G=F[O],K=U[G.materialIndex];if(K&&K.visible){let Q=E(S,K,A,T);S.onBeforeShadow(n,S,_,x,N,Q,G),n.renderBufferDirect(x,null,N,Q,S,G),S.onAfterShadow(n,S,_,x,N,Q,G)}}}else if(U.visible){let F=E(S,U,A,T);S.onBeforeShadow(n,S,_,x,N,F,null),n.renderBufferDirect(x,null,N,F,S,null),S.onAfterShadow(n,S,_,x,N,F,null)}}let I=S.children;for(let N=0,U=I.length;N<U;N++)v(I[N],_,x,A,T)}function C(S){S.target.removeEventListener("dispose",C);for(let x in c){let A=c[x],T=S.target.uuid;T in A&&(A[T].dispose(),delete A[T])}}}function zx(n,e){function t(){let B=!1,fe=new vt,te=null,_e=new vt(0,0,0,0);return{setMask:function(Me){te!==Me&&!B&&(n.colorMask(Me,Me,Me,Me),te=Me)},setLocked:function(Me){B=Me},setClear:function(Me,re,De,Pe,St){St===!0&&(Me*=Pe,re*=Pe,De*=Pe),fe.set(Me,re,De,Pe),_e.equals(fe)===!1&&(n.clearColor(Me,re,De,Pe),_e.copy(fe))},reset:function(){B=!1,te=null,_e.set(-1,0,0,0)}}}function i(){let B=!1,fe=!1,te=null,_e=null,Me=null;return{setReversed:function(re){if(fe!==re){let De=e.get("EXT_clip_control");re?De.clipControlEXT(De.LOWER_LEFT_EXT,De.ZERO_TO_ONE_EXT):De.clipControlEXT(De.LOWER_LEFT_EXT,De.NEGATIVE_ONE_TO_ONE_EXT),fe=re;let Pe=Me;Me=null,this.setClear(Pe)}},getReversed:function(){return fe},setTest:function(re){re?J(n.DEPTH_TEST):pe(n.DEPTH_TEST)},setMask:function(re){te!==re&&!B&&(n.depthMask(re),te=re)},setFunc:function(re){if(fe&&(re=Vh[re]),_e!==re){switch(re){case Ea:n.depthFunc(n.NEVER);break;case Aa:n.depthFunc(n.ALWAYS);break;case Ra:n.depthFunc(n.LESS);break;case Bi:n.depthFunc(n.LEQUAL);break;case Ca:n.depthFunc(n.EQUAL);break;case Pa:n.depthFunc(n.GEQUAL);break;case Ia:n.depthFunc(n.GREATER);break;case Da:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}_e=re}},setLocked:function(re){B=re},setClear:function(re){Me!==re&&(Me=re,fe&&(re=1-re),n.clearDepth(re))},reset:function(){B=!1,te=null,_e=null,Me=null,fe=!1}}}function r(){let B=!1,fe=null,te=null,_e=null,Me=null,re=null,De=null,Pe=null,St=null;return{setTest:function(_t){B||(_t?J(n.STENCIL_TEST):pe(n.STENCIL_TEST))},setMask:function(_t){fe!==_t&&!B&&(n.stencilMask(_t),fe=_t)},setFunc:function(_t,Pn,In){(te!==_t||_e!==Pn||Me!==In)&&(n.stencilFunc(_t,Pn,In),te=_t,_e=Pn,Me=In)},setOp:function(_t,Pn,In){(re!==_t||De!==Pn||Pe!==In)&&(n.stencilOp(_t,Pn,In),re=_t,De=Pn,Pe=In)},setLocked:function(_t){B=_t},setClear:function(_t){St!==_t&&(n.clearStencil(_t),St=_t)},reset:function(){B=!1,fe=null,te=null,_e=null,Me=null,re=null,De=null,Pe=null,St=null}}}let s=new t,a=new i,o=new r,l=new WeakMap,c=new WeakMap,d={},u={},h={},p=new WeakMap,f=[],b=null,g=!1,m=null,M=null,E=null,v=null,C=null,S=null,_=null,x=new $e(0,0,0),A=0,T=!1,R=null,I=null,N=null,U=null,F=null,O=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS),D=!1,G=0,K=n.getParameter(n.VERSION);K.indexOf("WebGL")!==-1?(G=parseFloat(/^WebGL (\d)/.exec(K)[1]),D=G>=1):K.indexOf("OpenGL ES")!==-1&&(G=parseFloat(/^OpenGL ES (\d)/.exec(K)[1]),D=G>=2);let Q=null,ne={},le=n.getParameter(n.SCISSOR_BOX),Ue=n.getParameter(n.VIEWPORT),He=new vt().fromArray(le),Re=new vt().fromArray(Ue);function Y(B,fe,te,_e){let Me=new Uint8Array(4),re=n.createTexture();n.bindTexture(B,re),n.texParameteri(B,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(B,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let De=0;De<te;De++)B===n.TEXTURE_3D||B===n.TEXTURE_2D_ARRAY?n.texImage3D(fe,0,n.RGBA,1,1,_e,0,n.RGBA,n.UNSIGNED_BYTE,Me):n.texImage2D(fe+De,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,Me);return re}let W={};W[n.TEXTURE_2D]=Y(n.TEXTURE_2D,n.TEXTURE_2D,1),W[n.TEXTURE_CUBE_MAP]=Y(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),W[n.TEXTURE_2D_ARRAY]=Y(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),W[n.TEXTURE_3D]=Y(n.TEXTURE_3D,n.TEXTURE_3D,1,1),s.setClear(0,0,0,1),a.setClear(1),o.setClear(0),J(n.DEPTH_TEST),a.setFunc(Bi),qe(!1),tt(sc),J(n.CULL_FACE),de(Bn);function J(B){d[B]!==!0&&(n.enable(B),d[B]=!0)}function pe(B){d[B]!==!1&&(n.disable(B),d[B]=!1)}function we(B,fe){return h[B]!==fe?(n.bindFramebuffer(B,fe),h[B]=fe,B===n.DRAW_FRAMEBUFFER&&(h[n.FRAMEBUFFER]=fe),B===n.FRAMEBUFFER&&(h[n.DRAW_FRAMEBUFFER]=fe),!0):!1}function Te(B,fe){let te=f,_e=!1;if(B){te=p.get(fe),te===void 0&&(te=[],p.set(fe,te));let Me=B.textures;if(te.length!==Me.length||te[0]!==n.COLOR_ATTACHMENT0){for(let re=0,De=Me.length;re<De;re++)te[re]=n.COLOR_ATTACHMENT0+re;te.length=Me.length,_e=!0}}else te[0]!==n.BACK&&(te[0]=n.BACK,_e=!0);_e&&n.drawBuffers(te)}function Ce(B){return b!==B?(n.useProgram(B),b=B,!0):!1}let ie={[ui]:n.FUNC_ADD,[uh]:n.FUNC_SUBTRACT,[hh]:n.FUNC_REVERSE_SUBTRACT};ie[dh]=n.MIN,ie[fh]=n.MAX;let he={[ph]:n.ZERO,[mh]:n.ONE,[gh]:n.SRC_COLOR,[wa]:n.SRC_ALPHA,[Mh]:n.SRC_ALPHA_SATURATE,[vh]:n.DST_COLOR,[xh]:n.DST_ALPHA,[_h]:n.ONE_MINUS_SRC_COLOR,[Ta]:n.ONE_MINUS_SRC_ALPHA,[bh]:n.ONE_MINUS_DST_COLOR,[yh]:n.ONE_MINUS_DST_ALPHA,[Sh]:n.CONSTANT_COLOR,[wh]:n.ONE_MINUS_CONSTANT_COLOR,[Th]:n.CONSTANT_ALPHA,[Eh]:n.ONE_MINUS_CONSTANT_ALPHA};function de(B,fe,te,_e,Me,re,De,Pe,St,_t){if(B===Bn){g===!0&&(pe(n.BLEND),g=!1);return}if(g===!1&&(J(n.BLEND),g=!0),B!==ch){if(B!==m||_t!==T){if((M!==ui||C!==ui)&&(n.blendEquation(n.FUNC_ADD),M=ui,C=ui),_t)switch(B){case Oi:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case ac:n.blendFunc(n.ONE,n.ONE);break;case oc:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case lc:n.blendFuncSeparate(n.DST_COLOR,n.ONE_MINUS_SRC_ALPHA,n.ZERO,n.ONE);break;default:Ge("WebGLState: Invalid blending: ",B);break}else switch(B){case Oi:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case ac:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE,n.ONE,n.ONE);break;case oc:Ge("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case lc:Ge("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ge("WebGLState: Invalid blending: ",B);break}E=null,v=null,S=null,_=null,x.set(0,0,0),A=0,m=B,T=_t}return}Me=Me||fe,re=re||te,De=De||_e,(fe!==M||Me!==C)&&(n.blendEquationSeparate(ie[fe],ie[Me]),M=fe,C=Me),(te!==E||_e!==v||re!==S||De!==_)&&(n.blendFuncSeparate(he[te],he[_e],he[re],he[De]),E=te,v=_e,S=re,_=De),(Pe.equals(x)===!1||St!==A)&&(n.blendColor(Pe.r,Pe.g,Pe.b,St),x.copy(Pe),A=St),m=B,T=!1}function Se(B,fe){B.side===Pt?pe(n.CULL_FACE):J(n.CULL_FACE);let te=B.side===jt;fe&&(te=!te),qe(te),B.blending===Oi&&B.transparent===!1?de(Bn):de(B.blending,B.blendEquation,B.blendSrc,B.blendDst,B.blendEquationAlpha,B.blendSrcAlpha,B.blendDstAlpha,B.blendColor,B.blendAlpha,B.premultipliedAlpha),a.setFunc(B.depthFunc),a.setTest(B.depthTest),a.setMask(B.depthWrite),s.setMask(B.colorWrite);let _e=B.stencilWrite;o.setTest(_e),_e&&(o.setMask(B.stencilWriteMask),o.setFunc(B.stencilFunc,B.stencilRef,B.stencilFuncMask),o.setOp(B.stencilFail,B.stencilZFail,B.stencilZPass)),We(B.polygonOffset,B.polygonOffsetFactor,B.polygonOffsetUnits),B.alphaToCoverage===!0?J(n.SAMPLE_ALPHA_TO_COVERAGE):pe(n.SAMPLE_ALPHA_TO_COVERAGE)}function qe(B){R!==B&&(B?n.frontFace(n.CW):n.frontFace(n.CCW),R=B)}function tt(B){B!==oh?(J(n.CULL_FACE),B!==I&&(B===sc?n.cullFace(n.BACK):B===lh?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):pe(n.CULL_FACE),I=B}function et(B){B!==N&&(D&&n.lineWidth(B),N=B)}function We(B,fe,te){B?(J(n.POLYGON_OFFSET_FILL),(U!==fe||F!==te)&&(U=fe,F=te,a.getReversed()&&(fe=-fe),n.polygonOffset(fe,te))):pe(n.POLYGON_OFFSET_FILL)}function ze(B){B?J(n.SCISSOR_TEST):pe(n.SCISSOR_TEST)}function Ye(B){B===void 0&&(B=n.TEXTURE0+O-1),Q!==B&&(n.activeTexture(B),Q=B)}function L(B,fe,te){te===void 0&&(Q===null?te=n.TEXTURE0+O-1:te=Q);let _e=ne[te];_e===void 0&&(_e={type:void 0,texture:void 0},ne[te]=_e),(_e.type!==B||_e.texture!==fe)&&(Q!==te&&(n.activeTexture(te),Q=te),n.bindTexture(B,fe||W[B]),_e.type=B,_e.texture=fe)}function bt(){let B=ne[Q];B!==void 0&&B.type!==void 0&&(n.bindTexture(B.type,null),B.type=void 0,B.texture=void 0)}function Je(){try{n.compressedTexImage2D(...arguments)}catch(B){Ge("WebGLState:",B)}}function P(){try{n.compressedTexImage3D(...arguments)}catch(B){Ge("WebGLState:",B)}}function y(){try{n.texSubImage2D(...arguments)}catch(B){Ge("WebGLState:",B)}}function z(){try{n.texSubImage3D(...arguments)}catch(B){Ge("WebGLState:",B)}}function H(){try{n.compressedTexSubImage2D(...arguments)}catch(B){Ge("WebGLState:",B)}}function Z(){try{n.compressedTexSubImage3D(...arguments)}catch(B){Ge("WebGLState:",B)}}function ce(){try{n.texStorage2D(...arguments)}catch(B){Ge("WebGLState:",B)}}function ue(){try{n.texStorage3D(...arguments)}catch(B){Ge("WebGLState:",B)}}function j(){try{n.texImage2D(...arguments)}catch(B){Ge("WebGLState:",B)}}function ee(){try{n.texImage3D(...arguments)}catch(B){Ge("WebGLState:",B)}}function me(B){return u[B]!==void 0?u[B]:n.getParameter(B)}function Fe(B,fe){u[B]!==fe&&(n.pixelStorei(B,fe),u[B]=fe)}function xe(B){He.equals(B)===!1&&(n.scissor(B.x,B.y,B.z,B.w),He.copy(B))}function ge(B){Re.equals(B)===!1&&(n.viewport(B.x,B.y,B.z,B.w),Re.copy(B))}function Be(B,fe){let te=c.get(fe);te===void 0&&(te=new WeakMap,c.set(fe,te));let _e=te.get(B);_e===void 0&&(_e=n.getUniformBlockIndex(fe,B.name),te.set(B,_e))}function Ve(B,fe){let _e=c.get(fe).get(B);l.get(fe)!==_e&&(n.uniformBlockBinding(fe,_e,B.__bindingPointIndex),l.set(fe,_e))}function je(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),a.setReversed(!1),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),n.pixelStorei(n.PACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,n.BROWSER_DEFAULT_WEBGL),n.pixelStorei(n.PACK_ROW_LENGTH,0),n.pixelStorei(n.PACK_SKIP_PIXELS,0),n.pixelStorei(n.PACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_ROW_LENGTH,0),n.pixelStorei(n.UNPACK_IMAGE_HEIGHT,0),n.pixelStorei(n.UNPACK_SKIP_PIXELS,0),n.pixelStorei(n.UNPACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_SKIP_IMAGES,0),d={},u={},Q=null,ne={},h={},p=new WeakMap,f=[],b=null,g=!1,m=null,M=null,E=null,v=null,C=null,S=null,_=null,x=new $e(0,0,0),A=0,T=!1,R=null,I=null,N=null,U=null,F=null,He.set(0,0,n.canvas.width,n.canvas.height),Re.set(0,0,n.canvas.width,n.canvas.height),s.reset(),a.reset(),o.reset()}return{buffers:{color:s,depth:a,stencil:o},enable:J,disable:pe,bindFramebuffer:we,drawBuffers:Te,useProgram:Ce,setBlending:de,setMaterial:Se,setFlipSided:qe,setCullFace:tt,setLineWidth:et,setPolygonOffset:We,setScissorTest:ze,activeTexture:Ye,bindTexture:L,unbindTexture:bt,compressedTexImage2D:Je,compressedTexImage3D:P,texImage2D:j,texImage3D:ee,pixelStorei:Fe,getParameter:me,updateUBOMapping:Be,uniformBlockBinding:Ve,texStorage2D:ce,texStorage3D:ue,texSubImage2D:y,texSubImage3D:z,compressedTexSubImage2D:H,compressedTexSubImage3D:Z,scissor:xe,viewport:ge,reset:je}}function Vx(n,e,t,i,r,s,a){let o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Le,d=new WeakMap,u=new Set,h,p=new WeakMap,f=!1;try{f=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function b(P,y){return f?new OffscreenCanvas(P,y):ns("canvas")}function g(P,y,z){let H=1,Z=Je(P);if((Z.width>z||Z.height>z)&&(H=z/Math.max(Z.width,Z.height)),H<1)if(typeof HTMLImageElement<"u"&&P instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&P instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&P instanceof ImageBitmap||typeof VideoFrame<"u"&&P instanceof VideoFrame){let ce=Math.floor(H*Z.width),ue=Math.floor(H*Z.height);h===void 0&&(h=b(ce,ue));let j=y?b(ce,ue):h;return j.width=ce,j.height=ue,j.getContext("2d").drawImage(P,0,0,ce,ue),ke("WebGLRenderer: Texture has been resized from ("+Z.width+"x"+Z.height+") to ("+ce+"x"+ue+")."),j}else return"data"in P&&ke("WebGLRenderer: Image in DataTexture is too big ("+Z.width+"x"+Z.height+")."),P;return P}function m(P){return P.generateMipmaps}function M(P){n.generateMipmap(P)}function E(P){return P.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:P.isWebGL3DRenderTarget?n.TEXTURE_3D:P.isWebGLArrayRenderTarget||P.isCompressedArrayTexture?n.TEXTURE_2D_ARRAY:n.TEXTURE_2D}function v(P,y,z,H,Z,ce=!1){if(P!==null){if(n[P]!==void 0)return n[P];ke("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+P+"'")}let ue;H&&(ue=e.get("EXT_texture_norm16"),ue||ke("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let j=y;if(y===n.RED&&(z===n.FLOAT&&(j=n.R32F),z===n.HALF_FLOAT&&(j=n.R16F),z===n.UNSIGNED_BYTE&&(j=n.R8),z===n.UNSIGNED_SHORT&&ue&&(j=ue.R16_EXT),z===n.SHORT&&ue&&(j=ue.R16_SNORM_EXT)),y===n.RED_INTEGER&&(z===n.UNSIGNED_BYTE&&(j=n.R8UI),z===n.UNSIGNED_SHORT&&(j=n.R16UI),z===n.UNSIGNED_INT&&(j=n.R32UI),z===n.BYTE&&(j=n.R8I),z===n.SHORT&&(j=n.R16I),z===n.INT&&(j=n.R32I)),y===n.RG&&(z===n.FLOAT&&(j=n.RG32F),z===n.HALF_FLOAT&&(j=n.RG16F),z===n.UNSIGNED_BYTE&&(j=n.RG8),z===n.UNSIGNED_SHORT&&ue&&(j=ue.RG16_EXT),z===n.SHORT&&ue&&(j=ue.RG16_SNORM_EXT)),y===n.RG_INTEGER&&(z===n.UNSIGNED_BYTE&&(j=n.RG8UI),z===n.UNSIGNED_SHORT&&(j=n.RG16UI),z===n.UNSIGNED_INT&&(j=n.RG32UI),z===n.BYTE&&(j=n.RG8I),z===n.SHORT&&(j=n.RG16I),z===n.INT&&(j=n.RG32I)),y===n.RGB_INTEGER&&(z===n.UNSIGNED_BYTE&&(j=n.RGB8UI),z===n.UNSIGNED_SHORT&&(j=n.RGB16UI),z===n.UNSIGNED_INT&&(j=n.RGB32UI),z===n.BYTE&&(j=n.RGB8I),z===n.SHORT&&(j=n.RGB16I),z===n.INT&&(j=n.RGB32I)),y===n.RGBA_INTEGER&&(z===n.UNSIGNED_BYTE&&(j=n.RGBA8UI),z===n.UNSIGNED_SHORT&&(j=n.RGBA16UI),z===n.UNSIGNED_INT&&(j=n.RGBA32UI),z===n.BYTE&&(j=n.RGBA8I),z===n.SHORT&&(j=n.RGBA16I),z===n.INT&&(j=n.RGBA32I)),y===n.RGB&&(z===n.UNSIGNED_SHORT&&ue&&(j=ue.RGB16_EXT),z===n.SHORT&&ue&&(j=ue.RGB16_SNORM_EXT),z===n.UNSIGNED_INT_5_9_9_9_REV&&(j=n.RGB9_E5),z===n.UNSIGNED_INT_10F_11F_11F_REV&&(j=n.R11F_G11F_B10F)),y===n.RGBA){let ee=ce?ts:st.getTransfer(Z);z===n.FLOAT&&(j=n.RGBA32F),z===n.HALF_FLOAT&&(j=n.RGBA16F),z===n.UNSIGNED_BYTE&&(j=ee===ct?n.SRGB8_ALPHA8:n.RGBA8),z===n.UNSIGNED_SHORT&&ue&&(j=ue.RGBA16_EXT),z===n.SHORT&&ue&&(j=ue.RGBA16_SNORM_EXT),z===n.UNSIGNED_SHORT_4_4_4_4&&(j=n.RGBA4),z===n.UNSIGNED_SHORT_5_5_5_1&&(j=n.RGB5_A1)}return(j===n.R16F||j===n.R32F||j===n.RG16F||j===n.RG32F||j===n.RGBA16F||j===n.RGBA32F)&&e.get("EXT_color_buffer_float"),j}function C(P,y){let z;return P?y===null||y===En||y===Cr?z=n.DEPTH24_STENCIL8:y===pn?z=n.DEPTH32F_STENCIL8:y===Rr&&(z=n.DEPTH24_STENCIL8,ke("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):y===null||y===En||y===Cr?z=n.DEPTH_COMPONENT24:y===pn?z=n.DEPTH_COMPONENT32F:y===Rr&&(z=n.DEPTH_COMPONENT16),z}function S(P,y){return m(P)===!0||P.isFramebufferTexture&&P.minFilter!==kt&&P.minFilter!==Lt?Math.log2(Math.max(y.width,y.height))+1:P.mipmaps!==void 0&&P.mipmaps.length>0?P.mipmaps.length:P.isCompressedTexture&&Array.isArray(P.image)?y.mipmaps.length:1}function _(P){let y=P.target;y.removeEventListener("dispose",_),A(y),y.isVideoTexture&&d.delete(y),y.isHTMLTexture&&u.delete(y)}function x(P){let y=P.target;y.removeEventListener("dispose",x),R(y)}function A(P){let y=i.get(P);if(y.__webglInit===void 0)return;let z=P.source,H=p.get(z);if(H){let Z=H[y.__cacheKey];Z.usedTimes--,Z.usedTimes===0&&T(P),Object.keys(H).length===0&&p.delete(z)}i.remove(P)}function T(P){let y=i.get(P);n.deleteTexture(y.__webglTexture);let z=P.source,H=p.get(z);delete H[y.__cacheKey],a.memory.textures--}function R(P){let y=i.get(P);if(P.depthTexture&&(P.depthTexture.dispose(),i.remove(P.depthTexture)),P.isWebGLCubeRenderTarget)for(let H=0;H<6;H++){if(Array.isArray(y.__webglFramebuffer[H]))for(let Z=0;Z<y.__webglFramebuffer[H].length;Z++)n.deleteFramebuffer(y.__webglFramebuffer[H][Z]);else n.deleteFramebuffer(y.__webglFramebuffer[H]);y.__webglDepthbuffer&&n.deleteRenderbuffer(y.__webglDepthbuffer[H])}else{if(Array.isArray(y.__webglFramebuffer))for(let H=0;H<y.__webglFramebuffer.length;H++)n.deleteFramebuffer(y.__webglFramebuffer[H]);else n.deleteFramebuffer(y.__webglFramebuffer);if(y.__webglDepthbuffer&&n.deleteRenderbuffer(y.__webglDepthbuffer),y.__webglMultisampledFramebuffer&&n.deleteFramebuffer(y.__webglMultisampledFramebuffer),y.__webglColorRenderbuffer)for(let H=0;H<y.__webglColorRenderbuffer.length;H++)y.__webglColorRenderbuffer[H]&&n.deleteRenderbuffer(y.__webglColorRenderbuffer[H]);y.__webglDepthRenderbuffer&&n.deleteRenderbuffer(y.__webglDepthRenderbuffer)}let z=P.textures;for(let H=0,Z=z.length;H<Z;H++){let ce=i.get(z[H]);ce.__webglTexture&&(n.deleteTexture(ce.__webglTexture),a.memory.textures--),i.remove(z[H])}i.remove(P)}let I=0;function N(){I=0}function U(){return I}function F(P){I=P}function O(){let P=I;return P>=r.maxTextures&&ke("WebGLTextures: Trying to use "+P+" texture units while this GPU supports only "+r.maxTextures),I+=1,P}function D(P){let y=[];return y.push(P.wrapS),y.push(P.wrapT),y.push(P.wrapR||0),y.push(P.magFilter),y.push(P.minFilter),y.push(P.anisotropy),y.push(P.internalFormat),y.push(P.format),y.push(P.type),y.push(P.generateMipmaps),y.push(P.premultiplyAlpha),y.push(P.flipY),y.push(P.unpackAlignment),y.push(P.colorSpace),y.join()}function G(P,y){let z=i.get(P);if(P.isVideoTexture&&L(P),P.isRenderTargetTexture===!1&&P.isExternalTexture!==!0&&P.version>0&&z.__version!==P.version){let H=P.image;if(H===null)ke("WebGLRenderer: Texture marked for update but no image data found.");else if(H.complete===!1)ke("WebGLRenderer: Texture marked for update but image is incomplete");else{pe(z,P,y);return}}else P.isExternalTexture&&(z.__webglTexture=P.sourceTexture?P.sourceTexture:null);t.bindTexture(n.TEXTURE_2D,z.__webglTexture,n.TEXTURE0+y)}function K(P,y){let z=i.get(P);if(P.isRenderTargetTexture===!1&&P.version>0&&z.__version!==P.version){pe(z,P,y);return}else P.isExternalTexture&&(z.__webglTexture=P.sourceTexture?P.sourceTexture:null);t.bindTexture(n.TEXTURE_2D_ARRAY,z.__webglTexture,n.TEXTURE0+y)}function Q(P,y){let z=i.get(P);if(P.isRenderTargetTexture===!1&&P.version>0&&z.__version!==P.version){pe(z,P,y);return}t.bindTexture(n.TEXTURE_3D,z.__webglTexture,n.TEXTURE0+y)}function ne(P,y){let z=i.get(P);if(P.isCubeDepthTexture!==!0&&P.version>0&&z.__version!==P.version){we(z,P,y);return}t.bindTexture(n.TEXTURE_CUBE_MAP,z.__webglTexture,n.TEXTURE0+y)}let le={[La]:n.REPEAT,[Fn]:n.CLAMP_TO_EDGE,[Fa]:n.MIRRORED_REPEAT},Ue={[kt]:n.NEAREST,[Ch]:n.NEAREST_MIPMAP_NEAREST,[Cs]:n.NEAREST_MIPMAP_LINEAR,[Lt]:n.LINEAR,[ao]:n.LINEAR_MIPMAP_NEAREST,[xi]:n.LINEAR_MIPMAP_LINEAR},He={[Dh]:n.NEVER,[Oh]:n.ALWAYS,[Lh]:n.LESS,[Xo]:n.LEQUAL,[Fh]:n.EQUAL,[qo]:n.GEQUAL,[Nh]:n.GREATER,[Uh]:n.NOTEQUAL};function Re(P,y){if(y.type===pn&&e.has("OES_texture_float_linear")===!1&&(y.magFilter===Lt||y.magFilter===ao||y.magFilter===Cs||y.magFilter===xi||y.minFilter===Lt||y.minFilter===ao||y.minFilter===Cs||y.minFilter===xi)&&ke("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(P,n.TEXTURE_WRAP_S,le[y.wrapS]),n.texParameteri(P,n.TEXTURE_WRAP_T,le[y.wrapT]),(P===n.TEXTURE_3D||P===n.TEXTURE_2D_ARRAY)&&n.texParameteri(P,n.TEXTURE_WRAP_R,le[y.wrapR]),n.texParameteri(P,n.TEXTURE_MAG_FILTER,Ue[y.magFilter]),n.texParameteri(P,n.TEXTURE_MIN_FILTER,Ue[y.minFilter]),y.compareFunction&&(n.texParameteri(P,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(P,n.TEXTURE_COMPARE_FUNC,He[y.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(y.magFilter===kt||y.minFilter!==Cs&&y.minFilter!==xi||y.type===pn&&e.has("OES_texture_float_linear")===!1)return;if(y.anisotropy>1||i.get(y).__currentAnisotropy){let z=e.get("EXT_texture_filter_anisotropic");n.texParameterf(P,z.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(y.anisotropy,r.getMaxAnisotropy())),i.get(y).__currentAnisotropy=y.anisotropy}}}function Y(P,y){let z=!1;P.__webglInit===void 0&&(P.__webglInit=!0,y.addEventListener("dispose",_));let H=y.source,Z=p.get(H);Z===void 0&&(Z={},p.set(H,Z));let ce=D(y);if(ce!==P.__cacheKey){Z[ce]===void 0&&(Z[ce]={texture:n.createTexture(),usedTimes:0},a.memory.textures++,z=!0),Z[ce].usedTimes++;let ue=Z[P.__cacheKey];ue!==void 0&&(Z[P.__cacheKey].usedTimes--,ue.usedTimes===0&&T(y)),P.__cacheKey=ce,P.__webglTexture=Z[ce].texture}return z}function W(P,y,z){return Math.floor(Math.floor(P/z)/y)}function J(P,y,z,H){let ce=P.updateRanges;if(ce.length===0)t.texSubImage2D(n.TEXTURE_2D,0,0,0,y.width,y.height,z,H,y.data);else{ce.sort((Fe,xe)=>Fe.start-xe.start);let ue=0;for(let Fe=1;Fe<ce.length;Fe++){let xe=ce[ue],ge=ce[Fe],Be=xe.start+xe.count,Ve=W(ge.start,y.width,4),je=W(xe.start,y.width,4);ge.start<=Be+1&&Ve===je&&W(ge.start+ge.count-1,y.width,4)===Ve?xe.count=Math.max(xe.count,ge.start+ge.count-xe.start):(++ue,ce[ue]=ge)}ce.length=ue+1;let j=t.getParameter(n.UNPACK_ROW_LENGTH),ee=t.getParameter(n.UNPACK_SKIP_PIXELS),me=t.getParameter(n.UNPACK_SKIP_ROWS);t.pixelStorei(n.UNPACK_ROW_LENGTH,y.width);for(let Fe=0,xe=ce.length;Fe<xe;Fe++){let ge=ce[Fe],Be=Math.floor(ge.start/4),Ve=Math.ceil(ge.count/4),je=Be%y.width,B=Math.floor(Be/y.width),fe=Ve,te=1;t.pixelStorei(n.UNPACK_SKIP_PIXELS,je),t.pixelStorei(n.UNPACK_SKIP_ROWS,B),t.texSubImage2D(n.TEXTURE_2D,0,je,B,fe,te,z,H,y.data)}P.clearUpdateRanges(),t.pixelStorei(n.UNPACK_ROW_LENGTH,j),t.pixelStorei(n.UNPACK_SKIP_PIXELS,ee),t.pixelStorei(n.UNPACK_SKIP_ROWS,me)}}function pe(P,y,z){let H=n.TEXTURE_2D;(y.isDataArrayTexture||y.isCompressedArrayTexture)&&(H=n.TEXTURE_2D_ARRAY),y.isData3DTexture&&(H=n.TEXTURE_3D);let Z=Y(P,y),ce=y.source;t.bindTexture(H,P.__webglTexture,n.TEXTURE0+z);let ue=i.get(ce);if(ce.version!==ue.__version||Z===!0){if(t.activeTexture(n.TEXTURE0+z),(typeof ImageBitmap<"u"&&y.image instanceof ImageBitmap)===!1){let te=st.getPrimaries(st.workingColorSpace),_e=y.colorSpace===Qn?null:st.getPrimaries(y.colorSpace),Me=y.colorSpace===Qn||te===_e?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,y.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,y.premultiplyAlpha),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,Me)}t.pixelStorei(n.UNPACK_ALIGNMENT,y.unpackAlignment);let ee=g(y.image,!1,r.maxTextureSize);ee=bt(y,ee);let me=s.convert(y.format,y.colorSpace),Fe=s.convert(y.type),xe=v(y.internalFormat,me,Fe,y.normalized,y.colorSpace,y.isVideoTexture);Re(H,y);let ge,Be=y.mipmaps,Ve=y.isVideoTexture!==!0,je=ue.__version===void 0||Z===!0,B=ce.dataReady,fe=S(y,ee);if(y.isDepthTexture)xe=C(y.format===yi,y.type),je&&(Ve?t.texStorage2D(n.TEXTURE_2D,1,xe,ee.width,ee.height):t.texImage2D(n.TEXTURE_2D,0,xe,ee.width,ee.height,0,me,Fe,null));else if(y.isDataTexture)if(Be.length>0){Ve&&je&&t.texStorage2D(n.TEXTURE_2D,fe,xe,Be[0].width,Be[0].height);for(let te=0,_e=Be.length;te<_e;te++)ge=Be[te],Ve?B&&t.texSubImage2D(n.TEXTURE_2D,te,0,0,ge.width,ge.height,me,Fe,ge.data):t.texImage2D(n.TEXTURE_2D,te,xe,ge.width,ge.height,0,me,Fe,ge.data);y.generateMipmaps=!1}else Ve?(je&&t.texStorage2D(n.TEXTURE_2D,fe,xe,ee.width,ee.height),B&&J(y,ee,me,Fe)):t.texImage2D(n.TEXTURE_2D,0,xe,ee.width,ee.height,0,me,Fe,ee.data);else if(y.isCompressedTexture)if(y.isCompressedArrayTexture){Ve&&je&&t.texStorage3D(n.TEXTURE_2D_ARRAY,fe,xe,Be[0].width,Be[0].height,ee.depth);for(let te=0,_e=Be.length;te<_e;te++)if(ge=Be[te],y.format!==mn)if(me!==null)if(Ve){if(B)if(y.layerUpdates.size>0){let Me=Cc(ge.width,ge.height,y.format,y.type);for(let re of y.layerUpdates){let De=ge.data.subarray(re*Me/ge.data.BYTES_PER_ELEMENT,(re+1)*Me/ge.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,te,0,0,re,ge.width,ge.height,1,me,De)}y.clearLayerUpdates()}else t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,te,0,0,0,ge.width,ge.height,ee.depth,me,ge.data)}else t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,te,xe,ge.width,ge.height,ee.depth,0,ge.data,0,0);else ke("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ve?B&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,te,0,0,0,ge.width,ge.height,ee.depth,me,Fe,ge.data):t.texImage3D(n.TEXTURE_2D_ARRAY,te,xe,ge.width,ge.height,ee.depth,0,me,Fe,ge.data)}else{Ve&&je&&t.texStorage2D(n.TEXTURE_2D,fe,xe,Be[0].width,Be[0].height);for(let te=0,_e=Be.length;te<_e;te++)ge=Be[te],y.format!==mn?me!==null?Ve?B&&t.compressedTexSubImage2D(n.TEXTURE_2D,te,0,0,ge.width,ge.height,me,ge.data):t.compressedTexImage2D(n.TEXTURE_2D,te,xe,ge.width,ge.height,0,ge.data):ke("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ve?B&&t.texSubImage2D(n.TEXTURE_2D,te,0,0,ge.width,ge.height,me,Fe,ge.data):t.texImage2D(n.TEXTURE_2D,te,xe,ge.width,ge.height,0,me,Fe,ge.data)}else if(y.isDataArrayTexture)if(Ve){if(je&&t.texStorage3D(n.TEXTURE_2D_ARRAY,fe,xe,ee.width,ee.height,ee.depth),B)if(y.layerUpdates.size>0){let te=Cc(ee.width,ee.height,y.format,y.type);for(let _e of y.layerUpdates){let Me=ee.data.subarray(_e*te/ee.data.BYTES_PER_ELEMENT,(_e+1)*te/ee.data.BYTES_PER_ELEMENT);t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,_e,ee.width,ee.height,1,me,Fe,Me)}y.clearLayerUpdates()}else t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,ee.width,ee.height,ee.depth,me,Fe,ee.data)}else t.texImage3D(n.TEXTURE_2D_ARRAY,0,xe,ee.width,ee.height,ee.depth,0,me,Fe,ee.data);else if(y.isData3DTexture)Ve?(je&&t.texStorage3D(n.TEXTURE_3D,fe,xe,ee.width,ee.height,ee.depth),B&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,ee.width,ee.height,ee.depth,me,Fe,ee.data)):t.texImage3D(n.TEXTURE_3D,0,xe,ee.width,ee.height,ee.depth,0,me,Fe,ee.data);else if(y.isFramebufferTexture){if(je)if(Ve)t.texStorage2D(n.TEXTURE_2D,fe,xe,ee.width,ee.height);else{let te=ee.width,_e=ee.height;for(let Me=0;Me<fe;Me++)t.texImage2D(n.TEXTURE_2D,Me,xe,te,_e,0,me,Fe,null),te>>=1,_e>>=1}}else if(y.isHTMLTexture){if("texElementImage2D"in n){let te=n.canvas;if(te.hasAttribute("layoutsubtree")||te.setAttribute("layoutsubtree","true"),ee.parentNode!==te){te.appendChild(ee),u.add(y),te.onpaint=_e=>{let Me=_e.changedElements;for(let re of u)Me.includes(re.image)&&(re.needsUpdate=!0)},te.requestPaint();return}if(n.texElementImage2D.length===3)n.texElementImage2D(n.TEXTURE_2D,n.RGBA8,ee);else{let Me=n.RGBA,re=n.RGBA,De=n.UNSIGNED_BYTE;n.texElementImage2D(n.TEXTURE_2D,0,Me,re,De,ee)}n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE)}}else if(Be.length>0){if(Ve&&je){let te=Je(Be[0]);t.texStorage2D(n.TEXTURE_2D,fe,xe,te.width,te.height)}for(let te=0,_e=Be.length;te<_e;te++)ge=Be[te],Ve?B&&t.texSubImage2D(n.TEXTURE_2D,te,0,0,me,Fe,ge):t.texImage2D(n.TEXTURE_2D,te,xe,me,Fe,ge);y.generateMipmaps=!1}else if(Ve){if(je){let te=Je(ee);t.texStorage2D(n.TEXTURE_2D,fe,xe,te.width,te.height)}B&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,me,Fe,ee)}else t.texImage2D(n.TEXTURE_2D,0,xe,me,Fe,ee);m(y)&&M(H),ue.__version=ce.version,y.onUpdate&&y.onUpdate(y)}P.__version=y.version}function we(P,y,z){if(y.image.length!==6)return;let H=Y(P,y),Z=y.source;t.bindTexture(n.TEXTURE_CUBE_MAP,P.__webglTexture,n.TEXTURE0+z);let ce=i.get(Z);if(Z.version!==ce.__version||H===!0){t.activeTexture(n.TEXTURE0+z);let ue=st.getPrimaries(st.workingColorSpace),j=y.colorSpace===Qn?null:st.getPrimaries(y.colorSpace),ee=y.colorSpace===Qn||ue===j?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,y.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,y.premultiplyAlpha),t.pixelStorei(n.UNPACK_ALIGNMENT,y.unpackAlignment),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,ee);let me=y.isCompressedTexture||y.image[0].isCompressedTexture,Fe=y.image[0]&&y.image[0].isDataTexture,xe=[];for(let re=0;re<6;re++)!me&&!Fe?xe[re]=g(y.image[re],!0,r.maxCubemapSize):xe[re]=Fe?y.image[re].image:y.image[re],xe[re]=bt(y,xe[re]);let ge=xe[0],Be=s.convert(y.format,y.colorSpace),Ve=s.convert(y.type),je=v(y.internalFormat,Be,Ve,y.normalized,y.colorSpace),B=y.isVideoTexture!==!0,fe=ce.__version===void 0||H===!0,te=Z.dataReady,_e=S(y,ge);Re(n.TEXTURE_CUBE_MAP,y);let Me;if(me){B&&fe&&t.texStorage2D(n.TEXTURE_CUBE_MAP,_e,je,ge.width,ge.height);for(let re=0;re<6;re++){Me=xe[re].mipmaps;for(let De=0;De<Me.length;De++){let Pe=Me[De];y.format!==mn?Be!==null?B?te&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,De,0,0,Pe.width,Pe.height,Be,Pe.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,De,je,Pe.width,Pe.height,0,Pe.data):ke("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):B?te&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,De,0,0,Pe.width,Pe.height,Be,Ve,Pe.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,De,je,Pe.width,Pe.height,0,Be,Ve,Pe.data)}}}else{if(Me=y.mipmaps,B&&fe){Me.length>0&&_e++;let re=Je(xe[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,_e,je,re.width,re.height)}for(let re=0;re<6;re++)if(Fe){B?te&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,0,0,xe[re].width,xe[re].height,Be,Ve,xe[re].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,je,xe[re].width,xe[re].height,0,Be,Ve,xe[re].data);for(let De=0;De<Me.length;De++){let St=Me[De].image[re].image;B?te&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,De+1,0,0,St.width,St.height,Be,Ve,St.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,De+1,je,St.width,St.height,0,Be,Ve,St.data)}}else{B?te&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,0,0,Be,Ve,xe[re]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,je,Be,Ve,xe[re]);for(let De=0;De<Me.length;De++){let Pe=Me[De];B?te&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,De+1,0,0,Be,Ve,Pe.image[re]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+re,De+1,je,Be,Ve,Pe.image[re])}}}m(y)&&M(n.TEXTURE_CUBE_MAP),ce.__version=Z.version,y.onUpdate&&y.onUpdate(y)}P.__version=y.version}function Te(P,y,z,H,Z,ce){let ue=s.convert(z.format,z.colorSpace),j=s.convert(z.type),ee=v(z.internalFormat,ue,j,z.normalized,z.colorSpace),me=i.get(y),Fe=i.get(z);if(Fe.__renderTarget=y,!me.__hasExternalTextures){let xe=Math.max(1,y.width>>ce),ge=Math.max(1,y.height>>ce);Z===n.TEXTURE_3D||Z===n.TEXTURE_2D_ARRAY?t.texImage3D(Z,ce,ee,xe,ge,y.depth,0,ue,j,null):t.texImage2D(Z,ce,ee,xe,ge,0,ue,j,null)}t.bindFramebuffer(n.FRAMEBUFFER,P),Ye(y)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,H,Z,Fe.__webglTexture,0,ze(y)):(Z===n.TEXTURE_2D||Z>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&Z<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,H,Z,Fe.__webglTexture,ce),t.bindFramebuffer(n.FRAMEBUFFER,null)}function Ce(P,y,z){if(n.bindRenderbuffer(n.RENDERBUFFER,P),y.depthBuffer){let H=y.depthTexture,Z=H&&H.isDepthTexture?H.type:null,ce=C(y.stencilBuffer,Z),ue=y.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;Ye(y)?o.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,ze(y),ce,y.width,y.height):z?n.renderbufferStorageMultisample(n.RENDERBUFFER,ze(y),ce,y.width,y.height):n.renderbufferStorage(n.RENDERBUFFER,ce,y.width,y.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,ue,n.RENDERBUFFER,P)}else{let H=y.textures;for(let Z=0;Z<H.length;Z++){let ce=H[Z],ue=s.convert(ce.format,ce.colorSpace),j=s.convert(ce.type),ee=v(ce.internalFormat,ue,j,ce.normalized,ce.colorSpace);Ye(y)?o.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,ze(y),ee,y.width,y.height):z?n.renderbufferStorageMultisample(n.RENDERBUFFER,ze(y),ee,y.width,y.height):n.renderbufferStorage(n.RENDERBUFFER,ee,y.width,y.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function ie(P,y,z){let H=y.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(n.FRAMEBUFFER,P),!(y.depthTexture&&y.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let Z=i.get(y.depthTexture);if(Z.__renderTarget=y,(!Z.__webglTexture||y.depthTexture.image.width!==y.width||y.depthTexture.image.height!==y.height)&&(y.depthTexture.image.width=y.width,y.depthTexture.image.height=y.height,y.depthTexture.needsUpdate=!0),H){if(Z.__webglInit===void 0&&(Z.__webglInit=!0,y.depthTexture.addEventListener("dispose",_)),Z.__webglTexture===void 0){Z.__webglTexture=n.createTexture(),t.bindTexture(n.TEXTURE_CUBE_MAP,Z.__webglTexture),Re(n.TEXTURE_CUBE_MAP,y.depthTexture);let me=s.convert(y.depthTexture.format),Fe=s.convert(y.depthTexture.type),xe;y.depthTexture.format===Nn?xe=n.DEPTH_COMPONENT24:y.depthTexture.format===yi&&(xe=n.DEPTH24_STENCIL8);for(let ge=0;ge<6;ge++)n.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ge,0,xe,y.width,y.height,0,me,Fe,null)}}else G(y.depthTexture,0);let ce=Z.__webglTexture,ue=ze(y),j=H?n.TEXTURE_CUBE_MAP_POSITIVE_X+z:n.TEXTURE_2D,ee=y.depthTexture.format===yi?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;if(y.depthTexture.format===Nn)Ye(y)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,ee,j,ce,0,ue):n.framebufferTexture2D(n.FRAMEBUFFER,ee,j,ce,0);else if(y.depthTexture.format===yi)Ye(y)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,ee,j,ce,0,ue):n.framebufferTexture2D(n.FRAMEBUFFER,ee,j,ce,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function he(P){let y=i.get(P),z=P.isWebGLCubeRenderTarget===!0;if(y.__boundDepthTexture!==P.depthTexture){let H=P.depthTexture;if(y.__depthDisposeCallback&&y.__depthDisposeCallback(),H){let Z=()=>{delete y.__boundDepthTexture,delete y.__depthDisposeCallback,H.removeEventListener("dispose",Z)};H.addEventListener("dispose",Z),y.__depthDisposeCallback=Z}y.__boundDepthTexture=H}if(P.depthTexture&&!y.__autoAllocateDepthBuffer)if(z)for(let H=0;H<6;H++)ie(y.__webglFramebuffer[H],P,H);else{let H=P.texture.mipmaps;H&&H.length>0?ie(y.__webglFramebuffer[0],P,0):ie(y.__webglFramebuffer,P,0)}else if(z){y.__webglDepthbuffer=[];for(let H=0;H<6;H++)if(t.bindFramebuffer(n.FRAMEBUFFER,y.__webglFramebuffer[H]),y.__webglDepthbuffer[H]===void 0)y.__webglDepthbuffer[H]=n.createRenderbuffer(),Ce(y.__webglDepthbuffer[H],P,!1);else{let Z=P.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ce=y.__webglDepthbuffer[H];n.bindRenderbuffer(n.RENDERBUFFER,ce),n.framebufferRenderbuffer(n.FRAMEBUFFER,Z,n.RENDERBUFFER,ce)}}else{let H=P.texture.mipmaps;if(H&&H.length>0?t.bindFramebuffer(n.FRAMEBUFFER,y.__webglFramebuffer[0]):t.bindFramebuffer(n.FRAMEBUFFER,y.__webglFramebuffer),y.__webglDepthbuffer===void 0)y.__webglDepthbuffer=n.createRenderbuffer(),Ce(y.__webglDepthbuffer,P,!1);else{let Z=P.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ce=y.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,ce),n.framebufferRenderbuffer(n.FRAMEBUFFER,Z,n.RENDERBUFFER,ce)}}t.bindFramebuffer(n.FRAMEBUFFER,null)}function de(P,y,z){let H=i.get(P);y!==void 0&&Te(H.__webglFramebuffer,P,P.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),z!==void 0&&he(P)}function Se(P){let y=P.texture,z=i.get(P),H=i.get(y);P.addEventListener("dispose",x);let Z=P.textures,ce=P.isWebGLCubeRenderTarget===!0,ue=Z.length>1;if(ue||(H.__webglTexture===void 0&&(H.__webglTexture=n.createTexture()),H.__version=y.version,a.memory.textures++),ce){z.__webglFramebuffer=[];for(let j=0;j<6;j++)if(y.mipmaps&&y.mipmaps.length>0){z.__webglFramebuffer[j]=[];for(let ee=0;ee<y.mipmaps.length;ee++)z.__webglFramebuffer[j][ee]=n.createFramebuffer()}else z.__webglFramebuffer[j]=n.createFramebuffer()}else{if(y.mipmaps&&y.mipmaps.length>0){z.__webglFramebuffer=[];for(let j=0;j<y.mipmaps.length;j++)z.__webglFramebuffer[j]=n.createFramebuffer()}else z.__webglFramebuffer=n.createFramebuffer();if(ue)for(let j=0,ee=Z.length;j<ee;j++){let me=i.get(Z[j]);me.__webglTexture===void 0&&(me.__webglTexture=n.createTexture(),a.memory.textures++)}if(P.samples>0&&Ye(P)===!1){z.__webglMultisampledFramebuffer=n.createFramebuffer(),z.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,z.__webglMultisampledFramebuffer);for(let j=0;j<Z.length;j++){let ee=Z[j];z.__webglColorRenderbuffer[j]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,z.__webglColorRenderbuffer[j]);let me=s.convert(ee.format,ee.colorSpace),Fe=s.convert(ee.type),xe=v(ee.internalFormat,me,Fe,ee.normalized,ee.colorSpace,P.isXRRenderTarget===!0),ge=ze(P);n.renderbufferStorageMultisample(n.RENDERBUFFER,ge,xe,P.width,P.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+j,n.RENDERBUFFER,z.__webglColorRenderbuffer[j])}n.bindRenderbuffer(n.RENDERBUFFER,null),P.depthBuffer&&(z.__webglDepthRenderbuffer=n.createRenderbuffer(),Ce(z.__webglDepthRenderbuffer,P,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(ce){t.bindTexture(n.TEXTURE_CUBE_MAP,H.__webglTexture),Re(n.TEXTURE_CUBE_MAP,y);for(let j=0;j<6;j++)if(y.mipmaps&&y.mipmaps.length>0)for(let ee=0;ee<y.mipmaps.length;ee++)Te(z.__webglFramebuffer[j][ee],P,y,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ee);else Te(z.__webglFramebuffer[j],P,y,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+j,0);m(y)&&M(n.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(ue){for(let j=0,ee=Z.length;j<ee;j++){let me=Z[j],Fe=i.get(me),xe=n.TEXTURE_2D;(P.isWebGL3DRenderTarget||P.isWebGLArrayRenderTarget)&&(xe=P.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(xe,Fe.__webglTexture),Re(xe,me),Te(z.__webglFramebuffer,P,me,n.COLOR_ATTACHMENT0+j,xe,0),m(me)&&M(xe)}t.unbindTexture()}else{let j=n.TEXTURE_2D;if((P.isWebGL3DRenderTarget||P.isWebGLArrayRenderTarget)&&(j=P.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(j,H.__webglTexture),Re(j,y),y.mipmaps&&y.mipmaps.length>0)for(let ee=0;ee<y.mipmaps.length;ee++)Te(z.__webglFramebuffer[ee],P,y,n.COLOR_ATTACHMENT0,j,ee);else Te(z.__webglFramebuffer,P,y,n.COLOR_ATTACHMENT0,j,0);m(y)&&M(j),t.unbindTexture()}P.depthBuffer&&he(P)}function qe(P){let y=P.textures;for(let z=0,H=y.length;z<H;z++){let Z=y[z];if(m(Z)){let ce=E(P),ue=i.get(Z).__webglTexture;t.bindTexture(ce,ue),M(ce),t.unbindTexture()}}}let tt=[],et=[];function We(P){if(P.samples>0){if(Ye(P)===!1){let y=P.textures,z=P.width,H=P.height,Z=n.COLOR_BUFFER_BIT,ce=P.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ue=i.get(P),j=y.length>1;if(j)for(let me=0;me<y.length;me++)t.bindFramebuffer(n.FRAMEBUFFER,ue.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+me,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,ue.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+me,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,ue.__webglMultisampledFramebuffer);let ee=P.texture.mipmaps;ee&&ee.length>0?t.bindFramebuffer(n.DRAW_FRAMEBUFFER,ue.__webglFramebuffer[0]):t.bindFramebuffer(n.DRAW_FRAMEBUFFER,ue.__webglFramebuffer);for(let me=0;me<y.length;me++){if(P.resolveDepthBuffer&&(P.depthBuffer&&(Z|=n.DEPTH_BUFFER_BIT),P.stencilBuffer&&P.resolveStencilBuffer&&(Z|=n.STENCIL_BUFFER_BIT)),j){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,ue.__webglColorRenderbuffer[me]);let Fe=i.get(y[me]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,Fe,0)}n.blitFramebuffer(0,0,z,H,0,0,z,H,Z,n.NEAREST),l===!0&&(tt.length=0,et.length=0,tt.push(n.COLOR_ATTACHMENT0+me),P.depthBuffer&&P.resolveDepthBuffer===!1&&(tt.push(ce),et.push(ce),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,et)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,tt))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),j)for(let me=0;me<y.length;me++){t.bindFramebuffer(n.FRAMEBUFFER,ue.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+me,n.RENDERBUFFER,ue.__webglColorRenderbuffer[me]);let Fe=i.get(y[me]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,ue.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+me,n.TEXTURE_2D,Fe,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,ue.__webglMultisampledFramebuffer)}else if(P.depthBuffer&&P.resolveDepthBuffer===!1&&l){let y=P.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[y])}}}function ze(P){return Math.min(r.maxSamples,P.samples)}function Ye(P){let y=i.get(P);return P.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&y.__useRenderToTexture!==!1}function L(P){let y=a.render.frame;d.get(P)!==y&&(d.set(P,y),P.update())}function bt(P,y){let z=P.colorSpace,H=P.format,Z=P.type;return P.isCompressedTexture===!0||P.isVideoTexture===!0||z!==es&&z!==Qn&&(st.getTransfer(z)===ct?(H!==mn||Z!==en)&&ke("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ge("WebGLTextures: Unsupported texture color space:",z)),y}function Je(P){return typeof HTMLImageElement<"u"&&P instanceof HTMLImageElement?(c.width=P.naturalWidth||P.width,c.height=P.naturalHeight||P.height):typeof VideoFrame<"u"&&P instanceof VideoFrame?(c.width=P.displayWidth,c.height=P.displayHeight):(c.width=P.width,c.height=P.height),c}this.allocateTextureUnit=O,this.resetTextureUnits=N,this.getTextureUnits=U,this.setTextureUnits=F,this.setTexture2D=G,this.setTexture2DArray=K,this.setTexture3D=Q,this.setTextureCube=ne,this.rebindTextures=de,this.setupRenderTarget=Se,this.updateRenderTargetMipmap=qe,this.updateMultisampleRenderTarget=We,this.setupDepthRenderbuffer=he,this.setupFrameBufferTexture=Te,this.useMultisampledRTT=Ye,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function Gx(n,e){function t(i,r=Qn){let s,a=st.getTransfer(r);if(i===en)return n.UNSIGNED_BYTE;if(i===lo)return n.UNSIGNED_SHORT_4_4_4_4;if(i===co)return n.UNSIGNED_SHORT_5_5_5_1;if(i===xc)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===yc)return n.UNSIGNED_INT_10F_11F_11F_REV;if(i===gc)return n.BYTE;if(i===_c)return n.SHORT;if(i===Rr)return n.UNSIGNED_SHORT;if(i===oo)return n.INT;if(i===En)return n.UNSIGNED_INT;if(i===pn)return n.FLOAT;if(i===kn)return n.HALF_FLOAT;if(i===vc)return n.ALPHA;if(i===bc)return n.RGB;if(i===mn)return n.RGBA;if(i===Nn)return n.DEPTH_COMPONENT;if(i===yi)return n.DEPTH_STENCIL;if(i===uo)return n.RED;if(i===ho)return n.RED_INTEGER;if(i===vi)return n.RG;if(i===fo)return n.RG_INTEGER;if(i===po)return n.RGBA_INTEGER;if(i===Ps||i===Is||i===Ds||i===Ls)if(a===ct)if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(i===Ps)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===Is)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===Ds)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===Ls)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=e.get("WEBGL_compressed_texture_s3tc"),s!==null){if(i===Ps)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===Is)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===Ds)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===Ls)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===mo||i===go||i===_o||i===xo)if(s=e.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(i===mo)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===go)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===_o)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===xo)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===yo||i===vo||i===bo||i===Mo||i===So||i===Fs||i===wo)if(s=e.get("WEBGL_compressed_texture_etc"),s!==null){if(i===yo||i===vo)return a===ct?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(i===bo)return a===ct?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC;if(i===Mo)return s.COMPRESSED_R11_EAC;if(i===So)return s.COMPRESSED_SIGNED_R11_EAC;if(i===Fs)return s.COMPRESSED_RG11_EAC;if(i===wo)return s.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===To||i===Eo||i===Ao||i===Ro||i===Co||i===Po||i===Io||i===Do||i===Lo||i===Fo||i===No||i===Uo||i===Oo||i===Bo)if(s=e.get("WEBGL_compressed_texture_astc"),s!==null){if(i===To)return a===ct?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Eo)return a===ct?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===Ao)return a===ct?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Ro)return a===ct?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Co)return a===ct?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Po)return a===ct?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Io)return a===ct?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Do)return a===ct?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Lo)return a===ct?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Fo)return a===ct?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===No)return a===ct?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===Uo)return a===ct?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Oo)return a===ct?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Bo)return a===ct?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===ko||i===zo||i===Vo)if(s=e.get("EXT_texture_compression_bptc"),s!==null){if(i===ko)return a===ct?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===zo)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===Vo)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===Go||i===Ho||i===Ns||i===Wo)if(s=e.get("EXT_texture_compression_rgtc"),s!==null){if(i===Go)return s.COMPRESSED_RED_RGTC1_EXT;if(i===Ho)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===Ns)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===Wo)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Cr?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:t}}var Hx=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Wx=`
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

}`,Hc=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let i=new hs(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=i}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,i=new un({vertexShader:Hx,fragmentShader:Wx,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new gt(new Hi(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Wc=class extends Sn{constructor(e,t){super();let i=this,r=null,s=1,a=null,o="local-floor",l=1,c=null,d=null,u=null,h=null,p=null,f=null,b=typeof XRWebGLBinding<"u",g=new Hc,m={},M=t.getContextAttributes(),E=null,v=null,C=[],S=[],_=new Le,x=null,A=new Xt;A.viewport=new vt;let T=new Xt;T.viewport=new vt;let R=[A,T],I=new to,N=null,U=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let W=C[Y];return W===void 0&&(W=new yr,C[Y]=W),W.getTargetRaySpace()},this.getControllerGrip=function(Y){let W=C[Y];return W===void 0&&(W=new yr,C[Y]=W),W.getGripSpace()},this.getHand=function(Y){let W=C[Y];return W===void 0&&(W=new yr,C[Y]=W),W.getHandSpace()};function F(Y){let W=S.indexOf(Y.inputSource);if(W===-1)return;let J=C[W];J!==void 0&&(J.update(Y.inputSource,Y.frame,c||a),J.dispatchEvent({type:Y.type,data:Y.inputSource}))}function O(){r.removeEventListener("select",F),r.removeEventListener("selectstart",F),r.removeEventListener("selectend",F),r.removeEventListener("squeeze",F),r.removeEventListener("squeezestart",F),r.removeEventListener("squeezeend",F),r.removeEventListener("end",O),r.removeEventListener("inputsourceschange",D);for(let Y=0;Y<C.length;Y++){let W=S[Y];W!==null&&(S[Y]=null,C[Y].disconnect(W))}N=null,U=null,g.reset();for(let Y in m)delete m[Y];e.setRenderTarget(E),p=null,h=null,u=null,r=null,v=null,Re.stop(),i.isPresenting=!1,e.setPixelRatio(x),e.setSize(_.width,_.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){s=Y,i.isPresenting===!0&&ke("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){o=Y,i.isPresenting===!0&&ke("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(Y){c=Y},this.getBaseLayer=function(){return h!==null?h:p},this.getBinding=function(){return u===null&&b&&(u=new XRWebGLBinding(r,t)),u},this.getFrame=function(){return f},this.getSession=function(){return r},this.setSession=async function(Y){if(r=Y,r!==null){if(E=e.getRenderTarget(),r.addEventListener("select",F),r.addEventListener("selectstart",F),r.addEventListener("selectend",F),r.addEventListener("squeeze",F),r.addEventListener("squeezestart",F),r.addEventListener("squeezeend",F),r.addEventListener("end",O),r.addEventListener("inputsourceschange",D),M.xrCompatible!==!0&&await t.makeXRCompatible(),x=e.getPixelRatio(),e.getSize(_),b&&"createProjectionLayer"in XRWebGLBinding.prototype){let J=null,pe=null,we=null;M.depth&&(we=M.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,J=M.stencil?yi:Nn,pe=M.stencil?Cr:En);let Te={colorFormat:t.RGBA8,depthFormat:we,scaleFactor:s};u=this.getBinding(),h=u.createProjectionLayer(Te),r.updateRenderState({layers:[h]}),e.setPixelRatio(1),e.setSize(h.textureWidth,h.textureHeight,!1),v=new cn(h.textureWidth,h.textureHeight,{format:mn,type:en,depthTexture:new jn(h.textureWidth,h.textureHeight,pe,void 0,void 0,void 0,void 0,void 0,void 0,J),stencilBuffer:M.stencil,colorSpace:e.outputColorSpace,samples:M.antialias?4:0,resolveDepthBuffer:h.ignoreDepthValues===!1,resolveStencilBuffer:h.ignoreDepthValues===!1})}else{let J={antialias:M.antialias,alpha:!0,depth:M.depth,stencil:M.stencil,framebufferScaleFactor:s};p=new XRWebGLLayer(r,t,J),r.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),v=new cn(p.framebufferWidth,p.framebufferHeight,{format:mn,type:en,colorSpace:e.outputColorSpace,stencilBuffer:M.stencil,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1})}v.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await r.requestReferenceSpace(o),Re.setContext(r),Re.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return g.getDepthTexture()};function D(Y){for(let W=0;W<Y.removed.length;W++){let J=Y.removed[W],pe=S.indexOf(J);pe>=0&&(S[pe]=null,C[pe].disconnect(J))}for(let W=0;W<Y.added.length;W++){let J=Y.added[W],pe=S.indexOf(J);if(pe===-1){for(let Te=0;Te<C.length;Te++)if(Te>=S.length){S.push(J),pe=Te;break}else if(S[Te]===null){S[Te]=J,pe=Te;break}if(pe===-1)break}let we=C[pe];we&&we.connect(J)}}let G=new k,K=new k;function Q(Y,W,J){G.setFromMatrixPosition(W.matrixWorld),K.setFromMatrixPosition(J.matrixWorld);let pe=G.distanceTo(K),we=W.projectionMatrix.elements,Te=J.projectionMatrix.elements,Ce=we[14]/(we[10]-1),ie=we[14]/(we[10]+1),he=(we[9]+1)/we[5],de=(we[9]-1)/we[5],Se=(we[8]-1)/we[0],qe=(Te[8]+1)/Te[0],tt=Ce*Se,et=Ce*qe,We=pe/(-Se+qe),ze=We*-Se;if(W.matrixWorld.decompose(Y.position,Y.quaternion,Y.scale),Y.translateX(ze),Y.translateZ(We),Y.matrixWorld.compose(Y.position,Y.quaternion,Y.scale),Y.matrixWorldInverse.copy(Y.matrixWorld).invert(),we[10]===-1)Y.projectionMatrix.copy(W.projectionMatrix),Y.projectionMatrixInverse.copy(W.projectionMatrixInverse);else{let Ye=Ce+We,L=ie+We,bt=tt-ze,Je=et+(pe-ze),P=he*ie/L*Ye,y=de*ie/L*Ye;Y.projectionMatrix.makePerspective(bt,Je,P,y,Ye,L),Y.projectionMatrixInverse.copy(Y.projectionMatrix).invert()}}function ne(Y,W){W===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(W.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(r===null)return;let W=Y.near,J=Y.far;g.texture!==null&&(g.depthNear>0&&(W=g.depthNear),g.depthFar>0&&(J=g.depthFar)),I.near=T.near=A.near=W,I.far=T.far=A.far=J,(N!==I.near||U!==I.far)&&(r.updateRenderState({depthNear:I.near,depthFar:I.far}),N=I.near,U=I.far),I.layers.mask=Y.layers.mask|6,A.layers.mask=I.layers.mask&-5,T.layers.mask=I.layers.mask&-3;let pe=Y.parent,we=I.cameras;ne(I,pe);for(let Te=0;Te<we.length;Te++)ne(we[Te],pe);we.length===2?Q(I,A,T):I.projectionMatrix.copy(A.projectionMatrix),le(Y,I,pe)};function le(Y,W,J){J===null?Y.matrix.copy(W.matrixWorld):(Y.matrix.copy(J.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(W.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(W.projectionMatrix),Y.projectionMatrixInverse.copy(W.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=gr*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return I},this.getFoveation=function(){if(!(h===null&&p===null))return l},this.setFoveation=function(Y){l=Y,h!==null&&(h.fixedFoveation=Y),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=Y)},this.hasDepthSensing=function(){return g.texture!==null},this.getDepthSensingMesh=function(){return g.getMesh(I)},this.getCameraTexture=function(Y){return m[Y]};let Ue=null;function He(Y,W){if(d=W.getViewerPose(c||a),f=W,d!==null){let J=d.views;p!==null&&(e.setRenderTargetFramebuffer(v,p.framebuffer),e.setRenderTarget(v));let pe=!1;J.length!==I.cameras.length&&(I.cameras.length=0,pe=!0);for(let ie=0;ie<J.length;ie++){let he=J[ie],de=null;if(p!==null)de=p.getViewport(he);else{let qe=u.getViewSubImage(h,he);de=qe.viewport,ie===0&&(e.setRenderTargetTextures(v,qe.colorTexture,qe.depthStencilTexture),e.setRenderTarget(v))}let Se=R[ie];Se===void 0&&(Se=new Xt,Se.layers.enable(ie),Se.viewport=new vt,R[ie]=Se),Se.matrix.fromArray(he.transform.matrix),Se.matrix.decompose(Se.position,Se.quaternion,Se.scale),Se.projectionMatrix.fromArray(he.projectionMatrix),Se.projectionMatrixInverse.copy(Se.projectionMatrix).invert(),Se.viewport.set(de.x,de.y,de.width,de.height),ie===0&&(I.matrix.copy(Se.matrix),I.matrix.decompose(I.position,I.quaternion,I.scale)),pe===!0&&I.cameras.push(Se)}let we=r.enabledFeatures;if(we&&we.includes("depth-sensing")&&r.depthUsage=="gpu-optimized"&&b){u=i.getBinding();let ie=u.getDepthInformation(J[0]);ie&&ie.isValid&&ie.texture&&g.init(ie,r.renderState)}if(we&&we.includes("camera-access")&&b){e.state.unbindTexture(),u=i.getBinding();for(let ie=0;ie<J.length;ie++){let he=J[ie].camera;if(he){let de=m[he];de||(de=new hs,m[he]=de);let Se=u.getCameraImage(he);de.sourceTexture=Se}}}}for(let J=0;J<C.length;J++){let pe=S[J],we=C[J];pe!==null&&we!==void 0&&we.update(pe,W,c||a)}Ue&&Ue(Y,W),W.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:W}),f=null}let Re=new _d;Re.setAnimationLoop(He),this.setAnimationLoop=function(Y){Ue=Y},this.dispose=function(){}}},Xx=new mt,Sd=new Ze;Sd.set(-1,0,0,0,1,0,0,0,1);function qx(n,e){function t(g,m){g.matrixAutoUpdate===!0&&g.updateMatrix(),m.value.copy(g.matrix)}function i(g,m){m.color.getRGB(g.fogColor.value,Ec(n)),m.isFog?(g.fogNear.value=m.near,g.fogFar.value=m.far):m.isFogExp2&&(g.fogDensity.value=m.density)}function r(g,m,M,E,v){m.isNodeMaterial?m.uniformsNeedUpdate=!1:m.isMeshBasicMaterial?s(g,m):m.isMeshLambertMaterial?(s(g,m),m.envMap&&(g.envMapIntensity.value=m.envMapIntensity)):m.isMeshToonMaterial?(s(g,m),u(g,m)):m.isMeshPhongMaterial?(s(g,m),d(g,m),m.envMap&&(g.envMapIntensity.value=m.envMapIntensity)):m.isMeshStandardMaterial?(s(g,m),h(g,m),m.isMeshPhysicalMaterial&&p(g,m,v)):m.isMeshMatcapMaterial?(s(g,m),f(g,m)):m.isMeshDepthMaterial?s(g,m):m.isMeshDistanceMaterial?(s(g,m),b(g,m)):m.isMeshNormalMaterial?s(g,m):m.isLineBasicMaterial?(a(g,m),m.isLineDashedMaterial&&o(g,m)):m.isPointsMaterial?l(g,m,M,E):m.isSpriteMaterial?c(g,m):m.isShadowMaterial?(g.color.value.copy(m.color),g.opacity.value=m.opacity):m.isShaderMaterial&&(m.uniformsNeedUpdate=!1)}function s(g,m){g.opacity.value=m.opacity,m.color&&g.diffuse.value.copy(m.color),m.emissive&&g.emissive.value.copy(m.emissive).multiplyScalar(m.emissiveIntensity),m.map&&(g.map.value=m.map,t(m.map,g.mapTransform)),m.alphaMap&&(g.alphaMap.value=m.alphaMap,t(m.alphaMap,g.alphaMapTransform)),m.bumpMap&&(g.bumpMap.value=m.bumpMap,t(m.bumpMap,g.bumpMapTransform),g.bumpScale.value=m.bumpScale,m.side===jt&&(g.bumpScale.value*=-1)),m.normalMap&&(g.normalMap.value=m.normalMap,t(m.normalMap,g.normalMapTransform),g.normalScale.value.copy(m.normalScale),m.side===jt&&g.normalScale.value.negate()),m.displacementMap&&(g.displacementMap.value=m.displacementMap,t(m.displacementMap,g.displacementMapTransform),g.displacementScale.value=m.displacementScale,g.displacementBias.value=m.displacementBias),m.emissiveMap&&(g.emissiveMap.value=m.emissiveMap,t(m.emissiveMap,g.emissiveMapTransform)),m.specularMap&&(g.specularMap.value=m.specularMap,t(m.specularMap,g.specularMapTransform)),m.alphaTest>0&&(g.alphaTest.value=m.alphaTest);let M=e.get(m),E=M.envMap,v=M.envMapRotation;E&&(g.envMap.value=E,g.envMapRotation.value.setFromMatrix4(Xx.makeRotationFromEuler(v)).transpose(),E.isCubeTexture&&E.isRenderTargetTexture===!1&&g.envMapRotation.value.premultiply(Sd),g.reflectivity.value=m.reflectivity,g.ior.value=m.ior,g.refractionRatio.value=m.refractionRatio),m.lightMap&&(g.lightMap.value=m.lightMap,g.lightMapIntensity.value=m.lightMapIntensity,t(m.lightMap,g.lightMapTransform)),m.aoMap&&(g.aoMap.value=m.aoMap,g.aoMapIntensity.value=m.aoMapIntensity,t(m.aoMap,g.aoMapTransform))}function a(g,m){g.diffuse.value.copy(m.color),g.opacity.value=m.opacity,m.map&&(g.map.value=m.map,t(m.map,g.mapTransform))}function o(g,m){g.dashSize.value=m.dashSize,g.totalSize.value=m.dashSize+m.gapSize,g.scale.value=m.scale}function l(g,m,M,E){g.diffuse.value.copy(m.color),g.opacity.value=m.opacity,g.size.value=m.size*M,g.scale.value=E*.5,m.map&&(g.map.value=m.map,t(m.map,g.uvTransform)),m.alphaMap&&(g.alphaMap.value=m.alphaMap,t(m.alphaMap,g.alphaMapTransform)),m.alphaTest>0&&(g.alphaTest.value=m.alphaTest)}function c(g,m){g.diffuse.value.copy(m.color),g.opacity.value=m.opacity,g.rotation.value=m.rotation,m.map&&(g.map.value=m.map,t(m.map,g.mapTransform)),m.alphaMap&&(g.alphaMap.value=m.alphaMap,t(m.alphaMap,g.alphaMapTransform)),m.alphaTest>0&&(g.alphaTest.value=m.alphaTest)}function d(g,m){g.specular.value.copy(m.specular),g.shininess.value=Math.max(m.shininess,1e-4)}function u(g,m){m.gradientMap&&(g.gradientMap.value=m.gradientMap)}function h(g,m){g.metalness.value=m.metalness,m.metalnessMap&&(g.metalnessMap.value=m.metalnessMap,t(m.metalnessMap,g.metalnessMapTransform)),g.roughness.value=m.roughness,m.roughnessMap&&(g.roughnessMap.value=m.roughnessMap,t(m.roughnessMap,g.roughnessMapTransform)),m.envMap&&(g.envMapIntensity.value=m.envMapIntensity)}function p(g,m,M){g.ior.value=m.ior,m.sheen>0&&(g.sheenColor.value.copy(m.sheenColor).multiplyScalar(m.sheen),g.sheenRoughness.value=m.sheenRoughness,m.sheenColorMap&&(g.sheenColorMap.value=m.sheenColorMap,t(m.sheenColorMap,g.sheenColorMapTransform)),m.sheenRoughnessMap&&(g.sheenRoughnessMap.value=m.sheenRoughnessMap,t(m.sheenRoughnessMap,g.sheenRoughnessMapTransform))),m.clearcoat>0&&(g.clearcoat.value=m.clearcoat,g.clearcoatRoughness.value=m.clearcoatRoughness,m.clearcoatMap&&(g.clearcoatMap.value=m.clearcoatMap,t(m.clearcoatMap,g.clearcoatMapTransform)),m.clearcoatRoughnessMap&&(g.clearcoatRoughnessMap.value=m.clearcoatRoughnessMap,t(m.clearcoatRoughnessMap,g.clearcoatRoughnessMapTransform)),m.clearcoatNormalMap&&(g.clearcoatNormalMap.value=m.clearcoatNormalMap,t(m.clearcoatNormalMap,g.clearcoatNormalMapTransform),g.clearcoatNormalScale.value.copy(m.clearcoatNormalScale),m.side===jt&&g.clearcoatNormalScale.value.negate())),m.dispersion>0&&(g.dispersion.value=m.dispersion),m.iridescence>0&&(g.iridescence.value=m.iridescence,g.iridescenceIOR.value=m.iridescenceIOR,g.iridescenceThicknessMinimum.value=m.iridescenceThicknessRange[0],g.iridescenceThicknessMaximum.value=m.iridescenceThicknessRange[1],m.iridescenceMap&&(g.iridescenceMap.value=m.iridescenceMap,t(m.iridescenceMap,g.iridescenceMapTransform)),m.iridescenceThicknessMap&&(g.iridescenceThicknessMap.value=m.iridescenceThicknessMap,t(m.iridescenceThicknessMap,g.iridescenceThicknessMapTransform))),m.transmission>0&&(g.transmission.value=m.transmission,g.transmissionSamplerMap.value=M.texture,g.transmissionSamplerSize.value.set(M.width,M.height),m.transmissionMap&&(g.transmissionMap.value=m.transmissionMap,t(m.transmissionMap,g.transmissionMapTransform)),g.thickness.value=m.thickness,m.thicknessMap&&(g.thicknessMap.value=m.thicknessMap,t(m.thicknessMap,g.thicknessMapTransform)),g.attenuationDistance.value=m.attenuationDistance,g.attenuationColor.value.copy(m.attenuationColor)),m.anisotropy>0&&(g.anisotropyVector.value.set(m.anisotropy*Math.cos(m.anisotropyRotation),m.anisotropy*Math.sin(m.anisotropyRotation)),m.anisotropyMap&&(g.anisotropyMap.value=m.anisotropyMap,t(m.anisotropyMap,g.anisotropyMapTransform))),g.specularIntensity.value=m.specularIntensity,g.specularColor.value.copy(m.specularColor),m.specularColorMap&&(g.specularColorMap.value=m.specularColorMap,t(m.specularColorMap,g.specularColorMapTransform)),m.specularIntensityMap&&(g.specularIntensityMap.value=m.specularIntensityMap,t(m.specularIntensityMap,g.specularIntensityMapTransform))}function f(g,m){m.matcap&&(g.matcap.value=m.matcap)}function b(g,m){let M=e.get(m).light;g.referencePosition.value.setFromMatrixPosition(M.matrixWorld),g.nearDistance.value=M.shadow.camera.near,g.farDistance.value=M.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function $x(n,e,t,i){let r={},s={},a=[],o=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function l(v,C){let S=C.program;i.uniformBlockBinding(v,S)}function c(v,C){let S=r[v.id];S===void 0&&(g(v),S=d(v),r[v.id]=S,v.addEventListener("dispose",M));let _=C.program;i.updateUBOMapping(v,_);let x=e.render.frame;s[v.id]!==x&&(h(v),s[v.id]=x)}function d(v){let C=u();v.__bindingPointIndex=C;let S=n.createBuffer(),_=v.__size,x=v.usage;return n.bindBuffer(n.UNIFORM_BUFFER,S),n.bufferData(n.UNIFORM_BUFFER,_,x),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,C,S),S}function u(){for(let v=0;v<o;v++)if(a.indexOf(v)===-1)return a.push(v),v;return Ge("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function h(v){let C=r[v.id],S=v.uniforms,_=v.__cache;n.bindBuffer(n.UNIFORM_BUFFER,C);for(let x=0,A=S.length;x<A;x++){let T=S[x];if(Array.isArray(T))for(let R=0,I=T.length;R<I;R++)p(T[R],x,R,_);else p(T,x,0,_)}n.bindBuffer(n.UNIFORM_BUFFER,null)}function p(v,C,S,_){if(b(v,C,S,_)===!0){let x=v.__offset,A=v.value;if(Array.isArray(A)){let T=0;for(let R=0;R<A.length;R++){let I=A[R],N=m(I);f(I,v.__data,T),typeof I!="number"&&typeof I!="boolean"&&!I.isMatrix3&&!ArrayBuffer.isView(I)&&(T+=N.storage/Float32Array.BYTES_PER_ELEMENT)}}else f(A,v.__data,0);n.bufferSubData(n.UNIFORM_BUFFER,x,v.__data)}}function f(v,C,S){typeof v=="number"||typeof v=="boolean"?C[0]=v:v.isMatrix3?(C[0]=v.elements[0],C[1]=v.elements[1],C[2]=v.elements[2],C[3]=0,C[4]=v.elements[3],C[5]=v.elements[4],C[6]=v.elements[5],C[7]=0,C[8]=v.elements[6],C[9]=v.elements[7],C[10]=v.elements[8],C[11]=0):ArrayBuffer.isView(v)?C.set(new v.constructor(v.buffer,v.byteOffset,C.length)):v.toArray(C,S)}function b(v,C,S,_){let x=v.value,A=C+"_"+S;if(_[A]===void 0)return typeof x=="number"||typeof x=="boolean"?_[A]=x:ArrayBuffer.isView(x)?_[A]=x.slice():_[A]=x.clone(),!0;{let T=_[A];if(typeof x=="number"||typeof x=="boolean"){if(T!==x)return _[A]=x,!0}else{if(ArrayBuffer.isView(x))return!0;if(T.equals(x)===!1)return T.copy(x),!0}}return!1}function g(v){let C=v.uniforms,S=0,_=16;for(let A=0,T=C.length;A<T;A++){let R=Array.isArray(C[A])?C[A]:[C[A]];for(let I=0,N=R.length;I<N;I++){let U=R[I],F=Array.isArray(U.value)?U.value:[U.value];for(let O=0,D=F.length;O<D;O++){let G=F[O],K=m(G),Q=S%_,ne=Q%K.boundary,le=Q+ne;S+=ne,le!==0&&_-le<K.storage&&(S+=_-le),U.__data=new Float32Array(K.storage/Float32Array.BYTES_PER_ELEMENT),U.__offset=S,S+=K.storage}}}let x=S%_;return x>0&&(S+=_-x),v.__size=S,v.__cache={},this}function m(v){let C={boundary:0,storage:0};return typeof v=="number"||typeof v=="boolean"?(C.boundary=4,C.storage=4):v.isVector2?(C.boundary=8,C.storage=8):v.isVector3||v.isColor?(C.boundary=16,C.storage=12):v.isVector4?(C.boundary=16,C.storage=16):v.isMatrix3?(C.boundary=48,C.storage=48):v.isMatrix4?(C.boundary=64,C.storage=64):v.isTexture?ke("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(v)?(C.boundary=16,C.storage=v.byteLength):ke("WebGLRenderer: Unsupported uniform value type.",v),C}function M(v){let C=v.target;C.removeEventListener("dispose",M);let S=a.indexOf(C.__bindingPointIndex);a.splice(S,1),n.deleteBuffer(r[C.id]),delete r[C.id],delete s[C.id]}function E(){for(let v in r)n.deleteBuffer(r[v]);a=[],r={},s={}}return{bind:l,update:c,dispose:E}}var Yx=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),zn=null;function Zx(){return zn===null&&(zn=new ls(Yx,16,16,vi,kn),zn.name="DFG_LUT",zn.minFilter=Lt,zn.magFilter=Lt,zn.wrapS=Fn,zn.wrapT=Fn,zn.generateMipmaps=!1,zn.needsUpdate=!0),zn}var Jo=class{constructor(e={}){let{canvas:t=Bh(),context:i=null,depth:r=!0,stencil:s=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:d="default",failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:h=!1,outputBufferType:p=en}=e;this.isWebGLRenderer=!0;let f;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");f=i.getContextAttributes().alpha}else f=a;let b=p,g=new Set([po,fo,ho]),m=new Set([en,En,Rr,Cr,lo,co]),M=new Uint32Array(4),E=new Int32Array(4),v=new k,C=null,S=null,_=[],x=[],A=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Tn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let T=this,R=!1,I=null,N=null,U=null,F=null;this._outputColorSpace=Bt;let O=0,D=0,G=null,K=-1,Q=null,ne=new vt,le=new vt,Ue=null,He=new $e(0),Re=0,Y=t.width,W=t.height,J=1,pe=null,we=null,Te=new vt(0,0,Y,W),Ce=new vt(0,0,Y,W),ie=!1,he=new br,de=!1,Se=!1,qe=new mt,tt=new k,et=new vt,We={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},ze=!1;function Ye(){return G===null?J:1}let L=i;function bt(w,V){return t.getContext(w,V)}try{let w={alpha:!0,depth:r,stencil:s,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:d,failIfMajorPerformanceCaveat:u};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"185"}`),t.addEventListener("webglcontextlost",St,!1),t.addEventListener("webglcontextrestored",_t,!1),t.addEventListener("webglcontextcreationerror",Pn,!1),L===null){let V="webgl2";if(L=bt(V,w),L===null)throw bt(V)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(w){throw Ge("WebGLRenderer: "+w.message),w}let Je,P,y,z,H,Z,ce,ue,j,ee,me,Fe,xe,ge,Be,Ve,je,B,fe,te,_e,Me,re;function De(){Je=new n_(L),Je.init(),_e=new Gx(L,Je),P=new Y0(L,Je,e,_e),y=new zx(L,Je),P.reversedDepthBuffer&&h&&y.buffers.depth.setReversed(!0),N=L.createFramebuffer(),U=L.createFramebuffer(),F=L.createFramebuffer(),z=new s_(L),H=new Ex,Z=new Vx(L,Je,y,H,P,_e,z),ce=new t_(T),ue=new cm(L),Me=new q0(L,ue),j=new i_(L,ue,z,Me),ee=new o_(L,j,ue,Me,z),B=new a_(L,P,Z),Be=new Z0(H),me=new Tx(T,ce,Je,P,Me,Be),Fe=new qx(T,H),xe=new Rx,ge=new Fx(Je),je=new X0(T,ce,y,ee,f,l),Ve=new kx(T,ee,P),re=new $x(L,z,P,y),fe=new $0(L,Je,z),te=new r_(L,Je,z),z.programs=me.programs,T.capabilities=P,T.extensions=Je,T.properties=H,T.renderLists=xe,T.shadowMap=Ve,T.state=y,T.info=z}De(),b!==en&&(A=new c_(b,t.width,t.height,o,r,s));let Pe=new Wc(T,L);this.xr=Pe,this.getContext=function(){return L},this.getContextAttributes=function(){return L.getContextAttributes()},this.forceContextLoss=function(){let w=Je.get("WEBGL_lose_context");w&&w.loseContext()},this.forceContextRestore=function(){let w=Je.get("WEBGL_lose_context");w&&w.restoreContext()},this.getPixelRatio=function(){return J},this.setPixelRatio=function(w){w!==void 0&&(J=w,this.setSize(Y,W,!1))},this.getSize=function(w){return w.set(Y,W)},this.setSize=function(w,V,$=!0){if(Pe.isPresenting){ke("WebGLRenderer: Can't change size while VR device is presenting.");return}Y=w,W=V,t.width=Math.floor(w*J),t.height=Math.floor(V*J),$===!0&&(t.style.width=w+"px",t.style.height=V+"px"),A!==null&&A.setSize(t.width,t.height),this.setViewport(0,0,w,V)},this.getDrawingBufferSize=function(w){return w.set(Y*J,W*J).floor()},this.setDrawingBufferSize=function(w,V,$){Y=w,W=V,J=$,t.width=Math.floor(w*$),t.height=Math.floor(V*$),this.setViewport(0,0,w,V)},this.setEffects=function(w){if(b===en){Ge("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(w){for(let V=0;V<w.length;V++)if(w[V].isOutputPass===!0){ke("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}A.setEffects(w||[])},this.getCurrentViewport=function(w){return w.copy(ne)},this.getViewport=function(w){return w.copy(Te)},this.setViewport=function(w,V,$,X){w.isVector4?Te.set(w.x,w.y,w.z,w.w):Te.set(w,V,$,X),y.viewport(ne.copy(Te).multiplyScalar(J).round())},this.getScissor=function(w){return w.copy(Ce)},this.setScissor=function(w,V,$,X){w.isVector4?Ce.set(w.x,w.y,w.z,w.w):Ce.set(w,V,$,X),y.scissor(le.copy(Ce).multiplyScalar(J).round())},this.getScissorTest=function(){return ie},this.setScissorTest=function(w){y.setScissorTest(ie=w)},this.setOpaqueSort=function(w){pe=w},this.setTransparentSort=function(w){we=w},this.getClearColor=function(w){return w.copy(je.getClearColor())},this.setClearColor=function(){je.setClearColor(...arguments)},this.getClearAlpha=function(){return je.getClearAlpha()},this.setClearAlpha=function(){je.setClearAlpha(...arguments)},this.clear=function(w=!0,V=!0,$=!0){let X=0;if(w){let q=!1;if(G!==null){let be=G.texture.format;q=g.has(be)}if(q){let be=G.texture.type,Ae=m.has(be),ve=je.getClearColor(),Ie=je.getClearAlpha(),Ne=ve.r,Qe=ve.g,it=ve.b;Ae?(M[0]=Ne,M[1]=Qe,M[2]=it,M[3]=Ie,L.clearBufferuiv(L.COLOR,0,M)):(E[0]=Ne,E[1]=Qe,E[2]=it,E[3]=Ie,L.clearBufferiv(L.COLOR,0,E))}else X|=L.COLOR_BUFFER_BIT}V&&(X|=L.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),$&&(X|=L.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),X!==0&&L.clear(X)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(w){w.setRenderer(this),I=w},this.dispose=function(){t.removeEventListener("webglcontextlost",St,!1),t.removeEventListener("webglcontextrestored",_t,!1),t.removeEventListener("webglcontextcreationerror",Pn,!1),je.dispose(),xe.dispose(),ge.dispose(),H.dispose(),ce.dispose(),ee.dispose(),Me.dispose(),re.dispose(),me.dispose(),Pe.dispose(),Pe.removeEventListener("sessionstart",Tu),Pe.removeEventListener("sessionend",Eu),Pi.stop()};function St(w){w.preventDefault(),Sc("WebGLRenderer: Context Lost."),R=!0}function _t(){Sc("WebGLRenderer: Context Restored."),R=!1;let w=z.autoReset,V=Ve.enabled,$=Ve.autoUpdate,X=Ve.needsUpdate,q=Ve.type;De(),z.autoReset=w,Ve.enabled=V,Ve.autoUpdate=$,Ve.needsUpdate=X,Ve.type=q}function Pn(w){Ge("WebGLRenderer: A WebGL context could not be created. Reason: ",w.statusMessage)}function In(w){let V=w.target;V.removeEventListener("dispose",In),Hf(V)}function Hf(w){Wf(w),H.remove(w)}function Wf(w){let V=H.get(w).programs;V!==void 0&&(V.forEach(function($){me.releaseProgram($)}),w.isShaderMaterial&&me.releaseShaderCache(w))}this.renderBufferDirect=function(w,V,$,X,q,be){V===null&&(V=We);let Ae=q.isMesh&&q.matrixWorld.determinantAffine()<0,ve=$f(w,V,$,X,q);y.setMaterial(X,Ae);let Ie=$.index,Ne=1;if(X.wireframe===!0){if(Ie=j.getWireframeAttribute($),Ie===void 0)return;Ne=2}let Qe=$.drawRange,it=$.attributes.position,Oe=Qe.start*Ne,ht=(Qe.start+Qe.count)*Ne;be!==null&&(Oe=Math.max(Oe,be.start*Ne),ht=Math.min(ht,(be.start+be.count)*Ne)),Ie!==null?(Oe=Math.max(Oe,0),ht=Math.min(ht,Ie.count)):it!=null&&(Oe=Math.max(Oe,0),ht=Math.min(ht,it.count));let At=ht-Oe;if(At<0||At===1/0)return;Me.setup(q,X,ve,$,Ie);let wt,ft=fe;if(Ie!==null&&(wt=ue.get(Ie),ft=te,ft.setIndex(wt)),q.isMesh)X.wireframe===!0?(y.setLineWidth(X.wireframeLinewidth*Ye()),ft.setMode(L.LINES)):ft.setMode(L.TRIANGLES);else if(q.isLine){let Gt=X.linewidth;Gt===void 0&&(Gt=1),y.setLineWidth(Gt*Ye()),q.isLineSegments?ft.setMode(L.LINES):q.isLineLoop?ft.setMode(L.LINE_LOOP):ft.setMode(L.LINE_STRIP)}else q.isPoints?ft.setMode(L.POINTS):q.isSprite&&ft.setMode(L.TRIANGLES);if(q.isBatchedMesh)if(Je.get("WEBGL_multi_draw"))ft.renderMultiDraw(q._multiDrawStarts,q._multiDrawCounts,q._multiDrawCount);else{let Gt=q._multiDrawStarts,Ee=q._multiDrawCounts,sn=q._multiDrawCount,at=Ie?ue.get(Ie).bytesPerElement:1,dn=H.get(X).currentProgram.getUniforms();for(let Dn=0;Dn<sn;Dn++)dn.setValue(L,"_gl_DrawID",Dn),ft.render(Gt[Dn]/at,Ee[Dn])}else if(q.isInstancedMesh)ft.renderInstances(Oe,At,q.count);else if($.isInstancedBufferGeometry){let Gt=$._maxInstanceCount!==void 0?$._maxInstanceCount:1/0,Ee=Math.min($.instanceCount,Gt);ft.renderInstances(Oe,At,Ee)}else ft.render(Oe,At)};function wu(w,V,$){w.transparent===!0&&w.side===Pt&&w.forceSinglePass===!1?(w.side=jt,w.needsUpdate=!0,Qs(w,V,$),w.side=Mn,w.needsUpdate=!0,Qs(w,V,$),w.side=Pt):Qs(w,V,$)}this.compile=function(w,V,$=null){$===null&&($=w),S=ge.get($),S.init(V),x.push(S),$.traverseVisible(function(q){q.isLight&&q.layers.test(V.layers)&&(S.pushLight(q),q.castShadow&&S.pushShadow(q))}),w!==$&&w.traverseVisible(function(q){q.isLight&&q.layers.test(V.layers)&&(S.pushLight(q),q.castShadow&&S.pushShadow(q))}),S.setupLights();let X=new Set;return w.traverse(function(q){if(!(q.isMesh||q.isPoints||q.isLine||q.isSprite))return;let be=q.material;if(be)if(Array.isArray(be))for(let Ae=0;Ae<be.length;Ae++){let ve=be[Ae];wu(ve,$,q),X.add(ve)}else wu(be,$,q),X.add(be)}),S=x.pop(),X},this.compileAsync=function(w,V,$=null){let X=this.compile(w,V,$);return new Promise(q=>{function be(){if(X.forEach(function(Ae){H.get(Ae).currentProgram.isReady()&&X.delete(Ae)}),X.size===0){q(w);return}setTimeout(be,10)}Je.get("KHR_parallel_shader_compile")!==null?be():setTimeout(be,10)})};let bl=null;function Xf(w){bl&&bl(w)}function Tu(){Pi.stop()}function Eu(){Pi.start()}let Pi=new _d;Pi.setAnimationLoop(Xf),typeof self<"u"&&Pi.setContext(self),this.setAnimationLoop=function(w){bl=w,Pe.setAnimationLoop(w),w===null?Pi.stop():Pi.start()},Pe.addEventListener("sessionstart",Tu),Pe.addEventListener("sessionend",Eu),this.render=function(w,V){if(V!==void 0&&V.isCamera!==!0){Ge("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(R===!0)return;I!==null&&I.renderStart(w,V);let $=Pe.enabled===!0&&Pe.isPresenting===!0,X=A!==null&&(G===null||$)&&A.begin(T,G);if(w.matrixWorldAutoUpdate===!0&&w.updateMatrixWorld(),V.parent===null&&V.matrixWorldAutoUpdate===!0&&V.updateMatrixWorld(),Pe.enabled===!0&&Pe.isPresenting===!0&&(A===null||A.isCompositing()===!1)&&(Pe.cameraAutoUpdate===!0&&Pe.updateCamera(V),V=Pe.getCamera()),w.isScene===!0&&w.onBeforeRender(T,w,V,G),S=ge.get(w,x.length),S.init(V),S.state.textureUnits=Z.getTextureUnits(),x.push(S),qe.multiplyMatrices(V.projectionMatrix,V.matrixWorldInverse),he.setFromProjectionMatrix(qe,bn,V.reversedDepth),Se=this.localClippingEnabled,de=Be.init(this.clippingPlanes,Se),C=xe.get(w,_.length),C.init(),_.push(C),Pe.enabled===!0&&Pe.isPresenting===!0){let Ae=T.xr.getDepthSensingMesh();Ae!==null&&Ml(Ae,V,-1/0,T.sortObjects)}Ml(w,V,0,T.sortObjects),C.finish(),T.sortObjects===!0&&C.sort(pe,we,V.reversedDepth),ze=Pe.enabled===!1||Pe.isPresenting===!1||Pe.hasDepthSensing()===!1,ze&&je.addToRenderList(C,w),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),de===!0&&Be.beginShadows();let q=S.state.shadowsArray;if(Ve.render(q,w,V),de===!0&&Be.endShadows(),(X&&A.hasRenderPass())===!1){let Ae=C.opaque,ve=C.transmissive;if(S.setupLights(),V.isArrayCamera){let Ie=V.cameras;if(ve.length>0)for(let Ne=0,Qe=Ie.length;Ne<Qe;Ne++){let it=Ie[Ne];Ru(Ae,ve,w,it)}ze&&je.render(w);for(let Ne=0,Qe=Ie.length;Ne<Qe;Ne++){let it=Ie[Ne];Au(C,w,it,it.viewport)}}else ve.length>0&&Ru(Ae,ve,w,V),ze&&je.render(w),Au(C,w,V)}G!==null&&D===0&&(Z.updateMultisampleRenderTarget(G),Z.updateRenderTargetMipmap(G)),X&&A.end(T),w.isScene===!0&&w.onAfterRender(T,w,V),Me.resetDefaultState(),K=-1,Q=null,x.pop(),x.length>0?(S=x[x.length-1],Z.setTextureUnits(S.state.textureUnits),de===!0&&Be.setGlobalState(T.clippingPlanes,S.state.camera)):S=null,_.pop(),_.length>0?C=_[_.length-1]:C=null,I!==null&&I.renderEnd()};function Ml(w,V,$,X){if(w.visible===!1)return;if(w.layers.test(V.layers)){if(w.isGroup)$=w.renderOrder;else if(w.isLOD)w.autoUpdate===!0&&w.update(V);else if(w.isLightProbeGrid)S.pushLightProbeGrid(w);else if(w.isLight)S.pushLight(w),w.castShadow&&S.pushShadow(w);else if(w.isSprite){if(!w.frustumCulled||he.intersectsSprite(w)){X&&et.setFromMatrixPosition(w.matrixWorld).applyMatrix4(qe);let Ae=ee.update(w),ve=w.material;ve.visible&&C.push(w,Ae,ve,$,et.z,null)}}else if((w.isMesh||w.isLine||w.isPoints)&&(!w.frustumCulled||he.intersectsObject(w))){let Ae=ee.update(w),ve=w.material;if(X&&(w.boundingSphere!==void 0?(w.boundingSphere===null&&w.computeBoundingSphere(),et.copy(w.boundingSphere.center)):(Ae.boundingSphere===null&&Ae.computeBoundingSphere(),et.copy(Ae.boundingSphere.center)),et.applyMatrix4(w.matrixWorld).applyMatrix4(qe)),Array.isArray(ve)){let Ie=Ae.groups;for(let Ne=0,Qe=Ie.length;Ne<Qe;Ne++){let it=Ie[Ne],Oe=ve[it.materialIndex];Oe&&Oe.visible&&C.push(w,Ae,Oe,$,et.z,it)}}else ve.visible&&C.push(w,Ae,ve,$,et.z,null)}}let be=w.children;for(let Ae=0,ve=be.length;Ae<ve;Ae++)Ml(be[Ae],V,$,X)}function Au(w,V,$,X){let{opaque:q,transmissive:be,transparent:Ae}=w;S.setupLightsView($),de===!0&&Be.setGlobalState(T.clippingPlanes,$),X&&y.viewport(ne.copy(X)),q.length>0&&js(q,V,$),be.length>0&&js(be,V,$),Ae.length>0&&js(Ae,V,$),y.buffers.depth.setTest(!0),y.buffers.depth.setMask(!0),y.buffers.color.setMask(!0),y.setPolygonOffset(!1)}function Ru(w,V,$,X){if(($.isScene===!0?$.overrideMaterial:null)!==null)return;if(S.state.transmissionRenderTarget[X.id]===void 0){let Oe=Je.has("EXT_color_buffer_half_float")||Je.has("EXT_color_buffer_float");S.state.transmissionRenderTarget[X.id]=new cn(1,1,{generateMipmaps:!0,type:Oe?kn:en,minFilter:xi,samples:Math.max(4,P.samples),stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:st.workingColorSpace})}let be=S.state.transmissionRenderTarget[X.id],Ae=X.viewport||ne;be.setSize(Ae.z*T.transmissionResolutionScale,Ae.w*T.transmissionResolutionScale);let ve=T.getRenderTarget(),Ie=T.getActiveCubeFace(),Ne=T.getActiveMipmapLevel();T.setRenderTarget(be),T.getClearColor(He),Re=T.getClearAlpha(),Re<1&&T.setClearColor(16777215,.5),T.clear(),ze&&je.render($);let Qe=T.toneMapping;T.toneMapping=Tn;let it=X.viewport;if(X.viewport!==void 0&&(X.viewport=void 0),S.setupLightsView(X),de===!0&&Be.setGlobalState(T.clippingPlanes,X),js(w,$,X),Z.updateMultisampleRenderTarget(be),Z.updateRenderTargetMipmap(be),Je.has("WEBGL_multisampled_render_to_texture")===!1){let Oe=!1;for(let ht=0,At=V.length;ht<At;ht++){let wt=V[ht],{object:ft,geometry:Gt,material:Ee,group:sn}=wt;if(Ee.side===Pt&&ft.layers.test(X.layers)){let at=Ee.side;Ee.side=jt,Ee.needsUpdate=!0,Cu(ft,$,X,Gt,Ee,sn),Ee.side=at,Ee.needsUpdate=!0,Oe=!0}}Oe===!0&&(Z.updateMultisampleRenderTarget(be),Z.updateRenderTargetMipmap(be))}T.setRenderTarget(ve,Ie,Ne),T.setClearColor(He,Re),it!==void 0&&(X.viewport=it),T.toneMapping=Qe}function js(w,V,$){let X=V.isScene===!0?V.overrideMaterial:null;for(let q=0,be=w.length;q<be;q++){let Ae=w[q],{object:ve,geometry:Ie,group:Ne}=Ae,Qe=Ae.material;Qe.allowOverride===!0&&X!==null&&(Qe=X),ve.layers.test($.layers)&&Cu(ve,V,$,Ie,Qe,Ne)}}function Cu(w,V,$,X,q,be){w.onBeforeRender(T,V,$,X,q,be),w.modelViewMatrix.multiplyMatrices($.matrixWorldInverse,w.matrixWorld),w.normalMatrix.getNormalMatrix(w.modelViewMatrix),q.onBeforeRender(T,V,$,X,w,be),q.transparent===!0&&q.side===Pt&&q.forceSinglePass===!1?(q.side=jt,q.needsUpdate=!0,T.renderBufferDirect($,V,X,q,w,be),q.side=Mn,q.needsUpdate=!0,T.renderBufferDirect($,V,X,q,w,be),q.side=Pt):T.renderBufferDirect($,V,X,q,w,be),w.onAfterRender(T,V,$,X,q,be)}function Qs(w,V,$){V.isScene!==!0&&(V=We);let X=H.get(w),q=S.state.lights,be=S.state.shadowsArray,Ae=q.state.version,ve=me.getParameters(w,q.state,be,V,$,S.state.lightProbeGridArray),Ie=me.getProgramCacheKey(ve),Ne=X.programs;X.environment=w.isMeshStandardMaterial||w.isMeshLambertMaterial||w.isMeshPhongMaterial?V.environment:null,X.fog=V.fog;let Qe=w.isMeshStandardMaterial||w.isMeshLambertMaterial&&!w.envMap||w.isMeshPhongMaterial&&!w.envMap;X.envMap=ce.get(w.envMap||X.environment,Qe),X.envMapRotation=X.environment!==null&&w.envMap===null?V.environmentRotation:w.envMapRotation,Ne===void 0&&(w.addEventListener("dispose",In),Ne=new Map,X.programs=Ne);let it=Ne.get(Ie);if(it!==void 0){if(X.currentProgram===it&&X.lightsStateVersion===Ae)return Iu(w,ve),it}else ve.uniforms=me.getUniforms(w),I!==null&&w.isNodeMaterial&&I.build(w,$,ve),w.onBeforeCompile(ve,T),it=me.acquireProgram(ve,Ie),Ne.set(Ie,it),X.uniforms=ve.uniforms;let Oe=X.uniforms;return(!w.isShaderMaterial&&!w.isRawShaderMaterial||w.clipping===!0)&&(Oe.clippingPlanes=Be.uniform),Iu(w,ve),X.needsLights=Zf(w),X.lightsStateVersion=Ae,X.needsLights&&(Oe.ambientLightColor.value=q.state.ambient,Oe.lightProbe.value=q.state.probe,Oe.directionalLights.value=q.state.directional,Oe.directionalLightShadows.value=q.state.directionalShadow,Oe.spotLights.value=q.state.spot,Oe.spotLightShadows.value=q.state.spotShadow,Oe.rectAreaLights.value=q.state.rectArea,Oe.ltc_1.value=q.state.rectAreaLTC1,Oe.ltc_2.value=q.state.rectAreaLTC2,Oe.pointLights.value=q.state.point,Oe.pointLightShadows.value=q.state.pointShadow,Oe.hemisphereLights.value=q.state.hemi,Oe.directionalShadowMatrix.value=q.state.directionalShadowMatrix,Oe.spotLightMatrix.value=q.state.spotLightMatrix,Oe.spotLightMap.value=q.state.spotLightMap,Oe.pointShadowMatrix.value=q.state.pointShadowMatrix),X.lightProbeGrid=S.state.lightProbeGridArray.length>0,X.currentProgram=it,X.uniformsList=null,it}function Pu(w){if(w.uniformsList===null){let V=w.currentProgram.getUniforms();w.uniformsList=Dr.seqWithValue(V.seq,w.uniforms)}return w.uniformsList}function Iu(w,V){let $=H.get(w);$.outputColorSpace=V.outputColorSpace,$.batching=V.batching,$.batchingColor=V.batchingColor,$.instancing=V.instancing,$.instancingColor=V.instancingColor,$.instancingMorph=V.instancingMorph,$.skinning=V.skinning,$.morphTargets=V.morphTargets,$.morphNormals=V.morphNormals,$.morphColors=V.morphColors,$.morphTargetsCount=V.morphTargetsCount,$.numClippingPlanes=V.numClippingPlanes,$.numIntersection=V.numClipIntersection,$.vertexAlphas=V.vertexAlphas,$.vertexTangents=V.vertexTangents,$.toneMapping=V.toneMapping}function qf(w,V){if(w.length===0)return null;if(w.length===1)return w[0].texture!==null?w[0]:null;v.setFromMatrixPosition(V.matrixWorld);for(let $=0,X=w.length;$<X;$++){let q=w[$];if(q.texture!==null&&q.boundingBox.containsPoint(v))return q}return null}function $f(w,V,$,X,q){V.isScene!==!0&&(V=We),Z.resetTextureUnits();let be=V.fog,Ae=X.isMeshStandardMaterial||X.isMeshLambertMaterial||X.isMeshPhongMaterial?V.environment:null,ve=G===null?T.outputColorSpace:G.isXRRenderTarget===!0?G.texture.colorSpace:st.workingColorSpace,Ie=X.isMeshStandardMaterial||X.isMeshLambertMaterial&&!X.envMap||X.isMeshPhongMaterial&&!X.envMap,Ne=ce.get(X.envMap||Ae,Ie),Qe=X.vertexColors===!0&&!!$.attributes.color&&$.attributes.color.itemSize===4,it=!!$.attributes.tangent&&(!!X.normalMap||X.anisotropy>0),Oe=!!$.morphAttributes.position,ht=!!$.morphAttributes.normal,At=!!$.morphAttributes.color,wt=Tn;X.toneMapped&&(G===null||G.isXRRenderTarget===!0)&&(wt=T.toneMapping);let ft=$.morphAttributes.position||$.morphAttributes.normal||$.morphAttributes.color,Gt=ft!==void 0?ft.length:0,Ee=H.get(X),sn=S.state.lights;if(de===!0&&(Se===!0||w!==Q)){let xt=w===Q&&X.id===K;Be.setState(X,w,xt)}let at=!1;X.version===Ee.__version?(Ee.needsLights&&Ee.lightsStateVersion!==sn.state.version||Ee.outputColorSpace!==ve||q.isBatchedMesh&&Ee.batching===!1||!q.isBatchedMesh&&Ee.batching===!0||q.isBatchedMesh&&Ee.batchingColor===!0&&q.colorTexture===null||q.isBatchedMesh&&Ee.batchingColor===!1&&q.colorTexture!==null||q.isInstancedMesh&&Ee.instancing===!1||!q.isInstancedMesh&&Ee.instancing===!0||q.isSkinnedMesh&&Ee.skinning===!1||!q.isSkinnedMesh&&Ee.skinning===!0||q.isInstancedMesh&&Ee.instancingColor===!0&&q.instanceColor===null||q.isInstancedMesh&&Ee.instancingColor===!1&&q.instanceColor!==null||q.isInstancedMesh&&Ee.instancingMorph===!0&&q.morphTexture===null||q.isInstancedMesh&&Ee.instancingMorph===!1&&q.morphTexture!==null||Ee.envMap!==Ne||X.fog===!0&&Ee.fog!==be||Ee.numClippingPlanes!==void 0&&(Ee.numClippingPlanes!==Be.numPlanes||Ee.numIntersection!==Be.numIntersection)||Ee.vertexAlphas!==Qe||Ee.vertexTangents!==it||Ee.morphTargets!==Oe||Ee.morphNormals!==ht||Ee.morphColors!==At||Ee.toneMapping!==wt||Ee.morphTargetsCount!==Gt||!!Ee.lightProbeGrid!=S.state.lightProbeGridArray.length>0)&&(at=!0):(at=!0,Ee.__version=X.version);let dn=Ee.currentProgram;at===!0&&(dn=Qs(X,V,q),I&&X.isNodeMaterial&&I.onUpdateProgram(X,dn,Ee));let Dn=!1,ei=!1,Ji=!1,pt=dn.getUniforms(),Rt=Ee.uniforms;if(y.useProgram(dn.program)&&(Dn=!0,ei=!0,Ji=!0),X.id!==K&&(K=X.id,ei=!0),Ee.needsLights){let xt=qf(S.state.lightProbeGridArray,q);Ee.lightProbeGrid!==xt&&(Ee.lightProbeGrid=xt,ei=!0)}if(Dn||Q!==w){y.buffers.depth.getReversed()&&w.reversedDepth!==!0&&(w._reversedDepth=!0,w.updateProjectionMatrix()),pt.setValue(L,"projectionMatrix",w.projectionMatrix),pt.setValue(L,"viewMatrix",w.matrixWorldInverse);let ni=pt.map.cameraPosition;ni!==void 0&&ni.setValue(L,tt.setFromMatrixPosition(w.matrixWorld)),P.logarithmicDepthBuffer&&pt.setValue(L,"logDepthBufFC",2/(Math.log(w.far+1)/Math.LN2)),(X.isMeshPhongMaterial||X.isMeshToonMaterial||X.isMeshLambertMaterial||X.isMeshBasicMaterial||X.isMeshStandardMaterial||X.isShaderMaterial)&&pt.setValue(L,"isOrthographic",w.isOrthographicCamera===!0),Q!==w&&(Q=w,ei=!0,Ji=!0)}if(Ee.needsLights&&(sn.state.directionalShadowMap.length>0&&pt.setValue(L,"directionalShadowMap",sn.state.directionalShadowMap,Z),sn.state.spotShadowMap.length>0&&pt.setValue(L,"spotShadowMap",sn.state.spotShadowMap,Z),sn.state.pointShadowMap.length>0&&pt.setValue(L,"pointShadowMap",sn.state.pointShadowMap,Z)),q.isSkinnedMesh){pt.setOptional(L,q,"bindMatrix"),pt.setOptional(L,q,"bindMatrixInverse");let xt=q.skeleton;xt&&(xt.boneTexture===null&&xt.computeBoneTexture(),pt.setValue(L,"boneTexture",xt.boneTexture,Z))}q.isBatchedMesh&&(pt.setOptional(L,q,"batchingTexture"),pt.setValue(L,"batchingTexture",q._matricesTexture,Z),pt.setOptional(L,q,"batchingIdTexture"),pt.setValue(L,"batchingIdTexture",q._indirectTexture,Z),pt.setOptional(L,q,"batchingColorTexture"),q._colorsTexture!==null&&pt.setValue(L,"batchingColorTexture",q._colorsTexture,Z));let ti=$.morphAttributes;if((ti.position!==void 0||ti.normal!==void 0||ti.color!==void 0)&&B.update(q,$,dn),(ei||Ee.receiveShadow!==q.receiveShadow)&&(Ee.receiveShadow=q.receiveShadow,pt.setValue(L,"receiveShadow",q.receiveShadow)),(X.isMeshStandardMaterial||X.isMeshLambertMaterial||X.isMeshPhongMaterial)&&X.envMap===null&&V.environment!==null&&(Rt.envMapIntensity.value=V.environmentIntensity),Rt.dfgLUT!==void 0&&(Rt.dfgLUT.value=Zx()),ei){if(pt.setValue(L,"toneMappingExposure",T.toneMappingExposure),Ee.needsLights&&Yf(Rt,Ji),be&&X.fog===!0&&Fe.refreshFogUniforms(Rt,be),Fe.refreshMaterialUniforms(Rt,X,J,W,S.state.transmissionRenderTarget[w.id]),Ee.needsLights&&Ee.lightProbeGrid){let xt=Ee.lightProbeGrid;Rt.probesSH.value=xt.texture,Rt.probesMin.value.copy(xt.boundingBox.min),Rt.probesMax.value.copy(xt.boundingBox.max),Rt.probesResolution.value.copy(xt.resolution)}Dr.upload(L,Pu(Ee),Rt,Z)}if(X.isShaderMaterial&&X.uniformsNeedUpdate===!0&&(Dr.upload(L,Pu(Ee),Rt,Z),X.uniformsNeedUpdate=!1),X.isSpriteMaterial&&pt.setValue(L,"center",q.center),pt.setValue(L,"modelViewMatrix",q.modelViewMatrix),pt.setValue(L,"normalMatrix",q.normalMatrix),pt.setValue(L,"modelMatrix",q.matrixWorld),X.uniformsGroups!==void 0){let xt=X.uniformsGroups;for(let ni=0,ji=xt.length;ni<ji;ni++){let Du=xt[ni];re.update(Du,dn),re.bind(Du,dn)}}return dn}function Yf(w,V){w.ambientLightColor.needsUpdate=V,w.lightProbe.needsUpdate=V,w.directionalLights.needsUpdate=V,w.directionalLightShadows.needsUpdate=V,w.pointLights.needsUpdate=V,w.pointLightShadows.needsUpdate=V,w.spotLights.needsUpdate=V,w.spotLightShadows.needsUpdate=V,w.rectAreaLights.needsUpdate=V,w.hemisphereLights.needsUpdate=V}function Zf(w){return w.isMeshLambertMaterial||w.isMeshToonMaterial||w.isMeshPhongMaterial||w.isMeshStandardMaterial||w.isShadowMaterial||w.isShaderMaterial&&w.lights===!0}this.getActiveCubeFace=function(){return O},this.getActiveMipmapLevel=function(){return D},this.getRenderTarget=function(){return G},this.setRenderTargetTextures=function(w,V,$){let X=H.get(w);X.__autoAllocateDepthBuffer=w.resolveDepthBuffer===!1,X.__autoAllocateDepthBuffer===!1&&(X.__useRenderToTexture=!1),H.get(w.texture).__webglTexture=V,H.get(w.depthTexture).__webglTexture=X.__autoAllocateDepthBuffer?void 0:$,X.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(w,V){let $=H.get(w);$.__webglFramebuffer=V,$.__useDefaultFramebuffer=V===void 0},this.setRenderTarget=function(w,V=0,$=0){G=w,O=V,D=$;let X=null,q=!1,be=!1;if(w){let ve=H.get(w);if(ve.__useDefaultFramebuffer!==void 0){y.bindFramebuffer(L.FRAMEBUFFER,ve.__webglFramebuffer),ne.copy(w.viewport),le.copy(w.scissor),Ue=w.scissorTest,y.viewport(ne),y.scissor(le),y.setScissorTest(Ue),K=-1;return}else if(ve.__webglFramebuffer===void 0)Z.setupRenderTarget(w);else if(ve.__hasExternalTextures)Z.rebindTextures(w,H.get(w.texture).__webglTexture,H.get(w.depthTexture).__webglTexture);else if(w.depthBuffer){let Qe=w.depthTexture;if(ve.__boundDepthTexture!==Qe){if(Qe!==null&&H.has(Qe)&&(w.width!==Qe.image.width||w.height!==Qe.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");Z.setupDepthRenderbuffer(w)}}let Ie=w.texture;(Ie.isData3DTexture||Ie.isDataArrayTexture||Ie.isCompressedArrayTexture)&&(be=!0);let Ne=H.get(w).__webglFramebuffer;w.isWebGLCubeRenderTarget?(Array.isArray(Ne[V])?X=Ne[V][$]:X=Ne[V],q=!0):w.samples>0&&Z.useMultisampledRTT(w)===!1?X=H.get(w).__webglMultisampledFramebuffer:Array.isArray(Ne)?X=Ne[$]:X=Ne,ne.copy(w.viewport),le.copy(w.scissor),Ue=w.scissorTest}else ne.copy(Te).multiplyScalar(J).floor(),le.copy(Ce).multiplyScalar(J).floor(),Ue=ie;if($!==0&&(X=N),y.bindFramebuffer(L.FRAMEBUFFER,X)&&y.drawBuffers(w,X),y.viewport(ne),y.scissor(le),y.setScissorTest(Ue),q){let ve=H.get(w.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_CUBE_MAP_POSITIVE_X+V,ve.__webglTexture,$)}else if(be){let ve=V;for(let Ie=0;Ie<w.textures.length;Ie++){let Ne=H.get(w.textures[Ie]);L.framebufferTextureLayer(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0+Ie,Ne.__webglTexture,$,ve)}}else if(w!==null&&$!==0){let ve=H.get(w.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,ve.__webglTexture,$)}K=-1},this.readRenderTargetPixels=function(w,V,$,X,q,be,Ae,ve=0){if(!(w&&w.isWebGLRenderTarget)){Ge("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Ie=H.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&Ae!==void 0&&(Ie=Ie[Ae]),Ie){y.bindFramebuffer(L.FRAMEBUFFER,Ie);try{let Ne=w.textures[ve],Qe=Ne.format,it=Ne.type;if(w.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+ve),!P.textureFormatReadable(Qe)){Ge("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!P.textureTypeReadable(it)){Ge("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}V>=0&&V<=w.width-X&&$>=0&&$<=w.height-q&&L.readPixels(V,$,X,q,_e.convert(Qe),_e.convert(it),be)}finally{let Ne=G!==null?H.get(G).__webglFramebuffer:null;y.bindFramebuffer(L.FRAMEBUFFER,Ne)}}},this.readRenderTargetPixelsAsync=async function(w,V,$,X,q,be,Ae,ve=0){if(!(w&&w.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Ie=H.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&Ae!==void 0&&(Ie=Ie[Ae]),Ie)if(V>=0&&V<=w.width-X&&$>=0&&$<=w.height-q){y.bindFramebuffer(L.FRAMEBUFFER,Ie);let Ne=w.textures[ve],Qe=Ne.format,it=Ne.type;if(w.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+ve),!P.textureFormatReadable(Qe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!P.textureTypeReadable(it))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Oe=L.createBuffer();L.bindBuffer(L.PIXEL_PACK_BUFFER,Oe),L.bufferData(L.PIXEL_PACK_BUFFER,be.byteLength,L.STREAM_READ),L.readPixels(V,$,X,q,_e.convert(Qe),_e.convert(it),0);let ht=G!==null?H.get(G).__webglFramebuffer:null;y.bindFramebuffer(L.FRAMEBUFFER,ht);let At=L.fenceSync(L.SYNC_GPU_COMMANDS_COMPLETE,0);return L.flush(),await zh(L,At,4),L.bindBuffer(L.PIXEL_PACK_BUFFER,Oe),L.getBufferSubData(L.PIXEL_PACK_BUFFER,0,be),L.deleteBuffer(Oe),L.deleteSync(At),be}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(w,V=null,$=0){let X=Math.pow(2,-$),q=Math.floor(w.image.width*X),be=Math.floor(w.image.height*X),Ae=V!==null?V.x:0,ve=V!==null?V.y:0;Z.setTexture2D(w,0),L.copyTexSubImage2D(L.TEXTURE_2D,$,0,0,Ae,ve,q,be),y.unbindTexture()},this.copyTextureToTexture=function(w,V,$=null,X=null,q=0,be=0){let Ae,ve,Ie,Ne,Qe,it,Oe,ht,At,wt=w.isCompressedTexture?w.mipmaps[be]:w.image;if($!==null)Ae=$.max.x-$.min.x,ve=$.max.y-$.min.y,Ie=$.isBox3?$.max.z-$.min.z:1,Ne=$.min.x,Qe=$.min.y,it=$.isBox3?$.min.z:0;else{let Rt=Math.pow(2,-q);Ae=Math.floor(wt.width*Rt),ve=Math.floor(wt.height*Rt),w.isDataArrayTexture?Ie=wt.depth:w.isData3DTexture?Ie=Math.floor(wt.depth*Rt):Ie=1,Ne=0,Qe=0,it=0}X!==null?(Oe=X.x,ht=X.y,At=X.z):(Oe=0,ht=0,At=0);let ft=_e.convert(V.format),Gt=_e.convert(V.type),Ee;V.isData3DTexture?(Z.setTexture3D(V,0),Ee=L.TEXTURE_3D):V.isDataArrayTexture||V.isCompressedArrayTexture?(Z.setTexture2DArray(V,0),Ee=L.TEXTURE_2D_ARRAY):(Z.setTexture2D(V,0),Ee=L.TEXTURE_2D),y.activeTexture(L.TEXTURE0),y.pixelStorei(L.UNPACK_FLIP_Y_WEBGL,V.flipY),y.pixelStorei(L.UNPACK_PREMULTIPLY_ALPHA_WEBGL,V.premultiplyAlpha),y.pixelStorei(L.UNPACK_ALIGNMENT,V.unpackAlignment);let sn=y.getParameter(L.UNPACK_ROW_LENGTH),at=y.getParameter(L.UNPACK_IMAGE_HEIGHT),dn=y.getParameter(L.UNPACK_SKIP_PIXELS),Dn=y.getParameter(L.UNPACK_SKIP_ROWS),ei=y.getParameter(L.UNPACK_SKIP_IMAGES);y.pixelStorei(L.UNPACK_ROW_LENGTH,wt.width),y.pixelStorei(L.UNPACK_IMAGE_HEIGHT,wt.height),y.pixelStorei(L.UNPACK_SKIP_PIXELS,Ne),y.pixelStorei(L.UNPACK_SKIP_ROWS,Qe),y.pixelStorei(L.UNPACK_SKIP_IMAGES,it);let Ji=w.isDataArrayTexture||w.isData3DTexture,pt=V.isDataArrayTexture||V.isData3DTexture;if(w.isDepthTexture){let Rt=H.get(w),ti=H.get(V),xt=H.get(Rt.__renderTarget),ni=H.get(ti.__renderTarget);y.bindFramebuffer(L.READ_FRAMEBUFFER,xt.__webglFramebuffer),y.bindFramebuffer(L.DRAW_FRAMEBUFFER,ni.__webglFramebuffer);for(let ji=0;ji<Ie;ji++)Ji&&(L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,H.get(w).__webglTexture,q,it+ji),L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,H.get(V).__webglTexture,be,At+ji)),L.blitFramebuffer(Ne,Qe,Ae,ve,Oe,ht,Ae,ve,L.DEPTH_BUFFER_BIT,L.NEAREST);y.bindFramebuffer(L.READ_FRAMEBUFFER,null),y.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else if(q!==0||w.isRenderTargetTexture||H.has(w)){let Rt=H.get(w),ti=H.get(V);y.bindFramebuffer(L.READ_FRAMEBUFFER,U),y.bindFramebuffer(L.DRAW_FRAMEBUFFER,F);for(let xt=0;xt<Ie;xt++)Ji?L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,Rt.__webglTexture,q,it+xt):L.framebufferTexture2D(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,Rt.__webglTexture,q),pt?L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,ti.__webglTexture,be,At+xt):L.framebufferTexture2D(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,ti.__webglTexture,be),q!==0?L.blitFramebuffer(Ne,Qe,Ae,ve,Oe,ht,Ae,ve,L.COLOR_BUFFER_BIT,L.NEAREST):pt?L.copyTexSubImage3D(Ee,be,Oe,ht,At+xt,Ne,Qe,Ae,ve):L.copyTexSubImage2D(Ee,be,Oe,ht,Ne,Qe,Ae,ve);y.bindFramebuffer(L.READ_FRAMEBUFFER,null),y.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else pt?w.isDataTexture||w.isData3DTexture?L.texSubImage3D(Ee,be,Oe,ht,At,Ae,ve,Ie,ft,Gt,wt.data):V.isCompressedArrayTexture?L.compressedTexSubImage3D(Ee,be,Oe,ht,At,Ae,ve,Ie,ft,wt.data):L.texSubImage3D(Ee,be,Oe,ht,At,Ae,ve,Ie,ft,Gt,wt):w.isDataTexture?L.texSubImage2D(L.TEXTURE_2D,be,Oe,ht,Ae,ve,ft,Gt,wt.data):w.isCompressedTexture?L.compressedTexSubImage2D(L.TEXTURE_2D,be,Oe,ht,wt.width,wt.height,ft,wt.data):L.texSubImage2D(L.TEXTURE_2D,be,Oe,ht,Ae,ve,ft,Gt,wt);y.pixelStorei(L.UNPACK_ROW_LENGTH,sn),y.pixelStorei(L.UNPACK_IMAGE_HEIGHT,at),y.pixelStorei(L.UNPACK_SKIP_PIXELS,dn),y.pixelStorei(L.UNPACK_SKIP_ROWS,Dn),y.pixelStorei(L.UNPACK_SKIP_IMAGES,ei),be===0&&V.generateMipmaps&&L.generateMipmap(Ee),y.unbindTexture()},this.initRenderTarget=function(w){H.get(w).__webglFramebuffer===void 0&&Z.setupRenderTarget(w)},this.initTexture=function(w){w.isCubeTexture?Z.setTextureCube(w,0):w.isData3DTexture?Z.setTexture3D(w,0):w.isDataArrayTexture||w.isCompressedArrayTexture?Z.setTexture2DArray(w,0):Z.setTexture2D(w,0),y.unbindTexture()},this.resetState=function(){O=0,D=0,G=null,y.reset(),Me.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return bn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=st._getDrawingBufferColorSpace(e),t.unpackColorSpace=st._getUnpackColorSpace()}};var wd={type:"change"},$c={type:"start"},Ed={type:"end"},el=new zi,Td=new Vt,Kx=Math.cos(70*Tc.DEG2RAD),Ut=new k,tn=2*Math.PI,dt={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},qc=1e-6,tl=class extends Ts{constructor(e,t=null){super(e,t),this.state=dt.NONE,this.target=new k,this.cursor=new k,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:mi.ROTATE,MIDDLE:mi.DOLLY,RIGHT:mi.PAN},this.touches={ONE:gi.ROTATE,TWO:gi.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new k,this._lastQuaternion=new ln,this._lastTargetPosition=new k,this._quat=new ln().setFromUnitVectors(e.up,new k(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new Er,this._sphericalDelta=new Er,this._scale=1,this._panOffset=new k,this._rotateStart=new Le,this._rotateEnd=new Le,this._rotateDelta=new Le,this._panStart=new Le,this._panEnd=new Le,this._panDelta=new Le,this._dollyStart=new Le,this._dollyEnd=new Le,this._dollyDelta=new Le,this._dollyDirection=new k,this._mouse=new Le,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=jx.bind(this),this._onPointerDown=Jx.bind(this),this._onPointerUp=Qx.bind(this),this._onContextMenu=ay.bind(this),this._onMouseWheel=ny.bind(this),this._onKeyDown=iy.bind(this),this._onTouchStart=ry.bind(this),this._onTouchMove=sy.bind(this),this._onMouseDown=ey.bind(this),this._onMouseMove=ty.bind(this),this._interceptControlDown=oy.bind(this),this._interceptControlUp=ly.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e==="grab"?this.domElement.style.cursor="grab":this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction=""}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(wd),this.update(),this.state=dt.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;Ut.copy(t).sub(this.target),Ut.applyQuaternion(this._quat),this._spherical.setFromVector3(Ut),this.autoRotate&&this.state===dt.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let i=this.minAzimuthAngle,r=this.maxAzimuthAngle;isFinite(i)&&isFinite(r)&&(i<-Math.PI?i+=tn:i>Math.PI&&(i-=tn),r<-Math.PI?r+=tn:r>Math.PI&&(r-=tn),i<=r?this._spherical.theta=Math.max(i,Math.min(r,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(i+r)/2?Math.max(i,this._spherical.theta):Math.min(r,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let s=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let a=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),s=a!=this._spherical.radius}if(Ut.setFromSpherical(this._spherical),Ut.applyQuaternion(this._quatInverse),t.copy(this.target).add(Ut),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let a=null;if(this.object.isPerspectiveCamera){let o=Ut.length();a=this._clampDistance(o*this._scale);let l=o-a;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),s=!!l}else if(this.object.isOrthographicCamera){let o=new k(this._mouse.x,this._mouse.y,0);o.unproject(this.object);let l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),s=l!==this.object.zoom;let c=new k(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(o),this.object.updateMatrixWorld(),a=Ut.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;a!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(a).add(this.object.position):(el.origin.copy(this.object.position),el.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(el.direction))<Kx?this.object.lookAt(this.target):(Td.setFromNormalAndCoplanarPoint(this.object.up,this.target),el.intersectPlane(Td,this.target))))}else if(this.object.isOrthographicCamera){let a=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),a!==this.object.zoom&&(this.object.updateProjectionMatrix(),s=!0)}return this._scale=1,this._performCursorZoom=!1,s||this._lastPosition.distanceToSquared(this.object.position)>qc||8*(1-this._lastQuaternion.dot(this.object.quaternion))>qc||this._lastTargetPosition.distanceToSquared(this.target)>qc?(this.dispatchEvent(wd),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?tn/60*this.autoRotateSpeed*e:tn/60/60*this.autoRotateSpeed}_getZoomScale(e){let t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Ut.setFromMatrixColumn(t,0),Ut.multiplyScalar(-e),this._panOffset.add(Ut)}_panUp(e,t){this.screenSpacePanning===!0?Ut.setFromMatrixColumn(t,1):(Ut.setFromMatrixColumn(t,0),Ut.crossVectors(this.object.up,Ut)),Ut.multiplyScalar(e),this._panOffset.add(Ut)}_pan(e,t){let i=this.domElement;if(this.object.isPerspectiveCamera){let r=this.object.position;Ut.copy(r).sub(this.target);let s=Ut.length();s*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*s/i.clientHeight,this.object.matrix),this._panUp(2*t*s/i.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/i.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/i.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let i=this.domElement.getBoundingClientRect(),r=e-i.left,s=t-i.top,a=i.width,o=i.height;this._mouse.x=r/a*2-1,this._mouse.y=-(s/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(tn*this._rotateDelta.x/t.clientHeight),this._rotateUp(tn*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(tn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-tn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(tn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-tn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._rotateStart.set(i,r)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panStart.set(i,r)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),i=e.pageX-t.x,r=e.pageY-t.y,s=Math.sqrt(i*i+r*r);this._dollyStart.set(0,s)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let i=this._getSecondPointerPosition(e),r=.5*(e.pageX+i.x),s=.5*(e.pageY+i.y);this._rotateEnd.set(r,s)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(tn*this._rotateDelta.x/t.clientHeight),this._rotateUp(tn*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panEnd.set(i,r)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),i=e.pageX-t.x,r=e.pageY-t.y,s=Math.sqrt(i*i+r*r);this._dollyEnd.set(0,s),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let a=(e.pageX+t.x)*.5,o=(e.pageY+t.y)*.5;this._updateZoomParameters(a,o)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new Le,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,i={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:i.deltaY*=16;break;case 2:i.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(i.deltaY*=10),i}};function Jx(n){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(n.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(n)&&(this._addPointer(n),n.pointerType==="touch"?this._onTouchStart(n):this._onMouseDown(n),this._cursorStyle==="grab"&&(this.domElement.style.cursor="grabbing")))}function jx(n){this.enabled!==!1&&(n.pointerType==="touch"?this._onTouchMove(n):this._onMouseMove(n))}function Qx(n){switch(this._removePointer(n),this._pointers.length){case 0:this.domElement.releasePointerCapture(n.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(Ed),this.state=dt.NONE,this._cursorStyle==="grab"&&(this.domElement.style.cursor="grab");break;case 1:let e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function ey(n){let e;switch(n.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case mi.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(n),this.state=dt.DOLLY;break;case mi.ROTATE:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=dt.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=dt.ROTATE}break;case mi.PAN:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=dt.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=dt.PAN}break;default:this.state=dt.NONE}this.state!==dt.NONE&&this.dispatchEvent($c)}function ty(n){switch(this.state){case dt.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(n);break;case dt.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(n);break;case dt.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(n);break}}function ny(n){this.enabled===!1||this.enableZoom===!1||this.state!==dt.NONE||(n.preventDefault(),this.dispatchEvent($c),this._handleMouseWheel(this._customWheelEvent(n)),this.dispatchEvent(Ed))}function iy(n){this.enabled!==!1&&this._handleKeyDown(n)}function ry(n){switch(this._trackPointer(n),this._pointers.length){case 1:switch(this.touches.ONE){case gi.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(n),this.state=dt.TOUCH_ROTATE;break;case gi.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(n),this.state=dt.TOUCH_PAN;break;default:this.state=dt.NONE}break;case 2:switch(this.touches.TWO){case gi.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(n),this.state=dt.TOUCH_DOLLY_PAN;break;case gi.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(n),this.state=dt.TOUCH_DOLLY_ROTATE;break;default:this.state=dt.NONE}break;default:this.state=dt.NONE}this.state!==dt.NONE&&this.dispatchEvent($c)}function sy(n){switch(this._trackPointer(n),this.state){case dt.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(n),this.update();break;case dt.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(n),this.update();break;case dt.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(n),this.update();break;case dt.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(n),this.update();break;default:this.state=dt.NONE}}function ay(n){this.enabled!==!1&&n.preventDefault()}function oy(n){n.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function ly(n){n.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}var cy=n=>Math.max(-85.0511,Math.min(85.0511,n));function nl(n,e,t){let i=2**t,r=cy(e)*Math.PI/180,s=Math.floor((n+180)/360*i),a=Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*i);return{z:t,x:Math.min(i-1,Math.max(0,s)),y:Math.min(i-1,Math.max(0,a))}}var Mi=({z:n,x:e,y:t})=>`${n}/${e}/${t}`;function Fr(n,e,t=0){let i=nl(n.west,n.north,e),r=nl(n.east,n.south,e),s=2**e,a=[];for(let o=i.x-t;o<=r.x+t;o++)for(let l=i.y-t;l<=r.y+t;l++)o<0||l<0||o>=s||l>=s||a.push({z:e,x:o,y:l});return a}var Zc=14,uy=1,hy=24,dy=n=>[(n.west+n.east)/2,(n.south+n.north)/2];function Yc(n,e){return(n.x-e.x)**2+(n.y-e.y)**2}function Kc(n,e,t={}){let i=t.zoom??Zc,r=t.margin??uy,s=t.budget??hy,a=Fr(n,i,r),o=a.map(Mi),l=new Set(o),c=new Set(e),[d,u]=dy(n),h=Fr({west:d,south:u,east:d,north:u},i)[0],p=a.filter(m=>!c.has(Mi(m))).sort((m,M)=>Yc(m,h)-Yc(M,h)),f=[...c].filter(m=>!l.has(m)).map(m=>{let[,M,E]=m.split("/").map(Number);return{key:m,distance:Yc({z:i,x:M,y:E},h)}}).sort((m,M)=>M.distance-m.distance),b=c.size+p.length-s,g=b>0?f.slice(0,Math.min(b,f.length)).map(m=>m.key):[];return{load:p,evict:g,wanted:o}}function il(n){if(n.length===0)return[0,0];let[e,t]=n[0],i=0,r=0,s=0;for(let a=0,o=n.length-1;a<n.length;o=a++){let l=n[a][0]-e,c=n[a][1]-t,d=n[o][0]-e,u=n[o][1]-t,h=d*c-l*u;i+=h,r+=(d+l)*h,s+=(u+c)*h}return Math.abs(i)<1e-18?[n.reduce((a,o)=>a+o[0],0)/n.length,n.reduce((a,o)=>a+o[1],0)/n.length]:[e+r/(3*i),t+s/(3*i)]}function rl(n){return n.type==="Polygon"?[n.coordinates]:n.coordinates}function Ad(n,e=Zc){let t=rl(n.footprint),i=t[0]?.[0];if(!i||i.length<4)throw new Error(`Missing closed footprint: ${n.id}`);for(let r of t)for(let s of r){if(s.length<4||s[0][0]!==s[s.length-1][0]||s[0][1]!==s[s.length-1][1])throw new Error(`Unclosed footprint: ${n.id}`);for(let[a,o]of s)if(!Number.isFinite(a)||!Number.isFinite(o)||Math.abs(a)>180||Math.abs(o)>85.0511)throw new Error(`Non-geographic footprint: ${n.id}`)}return Mi(nl(...il(i),e))}function Rd(n,e){if(!Number.isFinite(n)||n<0)throw new Error("Invalid camera distance");return e==="detail"&&n<=95?"detail":e==="massing"&&n>=235?"massing":n<(e==="facade"?65:80)?"detail":n>(e==="facade"?265:250)?"massing":"facade"}var sl=class{constructor(e,t){this.budget=e;this.release=t;if(!Number.isInteger(e)||e<1)throw new Error("Invalid resource budget")}entries=new Map;get keys(){return[...this.entries.keys()]}get size(){return this.entries.size}get(e){return this.entries.get(e)}touch(e){if(!this.entries.has(e))return;let t=this.entries.get(e);this.entries.delete(e),this.entries.set(e,t)}canAdopt(e,t=new Set){return this.entries.has(e)||this.entries.size<this.budget||this.keys.some(i=>!t.has(i))}adopt(e,t,i=new Set){return this.entries.get(e)===t&&this.entries.has(e)?(this.touch(e),!0):this.canAdopt(e,i)?(this.entries.has(e)?this.drop(e):this.entries.size>=this.budget&&this.drop(this.keys.find(r=>!i.has(r))),this.entries.set(e,t),!0):!1}drop(e){if(!this.entries.has(e))return;let t=this.entries.get(e);this.entries.delete(e),this.release(t,e)}clear(){for(let e of this.keys)this.drop(e)}};var zs=class{constructor(e){this.options=e;if(e.index.version!==1||!Number.isInteger(e.index.zoom)||e.index.zoom<0||e.index.zoom>22||!Array.isArray(e.index.tileList))throw new Error("Unsupported appearance index");if(this.published=new Set(e.index.tileList),this.published.size!==e.index.tileList.length||[...this.published].some(t=>!new RegExp(`^${e.index.zoom}/\\d+/\\d+$`).test(t)))throw new Error("Invalid appearance index keys");if(this.concurrency=e.concurrency??2,!Number.isInteger(this.concurrency)||this.concurrency<1||this.concurrency>8)throw new Error("Invalid appearance concurrency");if(!Number.isFinite(e.lodDistanceMultiplier??1)||(e.lodDistanceMultiplier??1)<.25||(e.lodDistanceMultiplier??1)>4)throw new Error("Invalid LOD distance multiplier");this.cache=new sl(e.budget??24,t=>t.resource?.dispose())}cache;published;controllers=new Map;failed=new Set;visibleDependencies=new Map;waiters=[];camera=null;wanted=new Set;queue=[];inFlight=0;disposed=!1;constrained=!1;concurrency;get status(){return{resident:this.cache.size,residentKeys:this.cache.keys,inFlight:this.inFlight,queued:this.queue.length,failed:[...this.failed],budgetConstrained:this.constrained,disposed:this.disposed}}update(e){if(this.disposed)return;let{bounds:t,longitude:i,latitude:r}=e;if(![i,r,t.west,t.south,t.east,t.north].every(Number.isFinite)||t.east<t.west||t.north<t.south||Math.abs(i)>180||Math.abs(r)>85.0511||t.west<-180||t.east>180||t.south<-85.0511||t.north>85.0511)throw new Error("Invalid appearance camera");if(t.east-t.west>1||t.north-t.south>1)throw new Error("Appearance viewport needs massing-only overview");this.camera=structuredClone(e),this.replan(),this.refreshLods(),this.pump()}retryFailed(){this.failed.clear(),this.camera&&!this.disposed&&(this.replan(),this.pump())}replan(){if(!this.camera)return;let{bounds:e}=this.camera,t=Kc(e,[],{zoom:this.options.index.zoom,margin:1,budget:this.cache.budget}).load.map(Mi).filter(o=>this.published.has(o)),i=Fr(e,this.options.index.zoom).map(Mi);for(let o of this.visibleDependencies.keys())i.includes(o)||this.visibleDependencies.delete(o);for(let o of i){let l=this.cache.get(o);l&&this.visibleDependencies.set(o,l.tile.halo.map(c=>c.ownerTile))}let r=i.flatMap(o=>this.visibleDependencies.get(o)??[]).filter(o=>this.published.has(o)),s=(this.options.priorityTiles??[]).filter(o=>this.published.has(o)),a=[...new Set([...s,...r,...t])];this.constrained=a.length>this.cache.budget,this.wanted=new Set(a.slice(0,this.cache.budget));for(let[o,l]of this.controllers)this.wanted.has(o)||l.abort();for(let o of this.wanted)this.cache.touch(o);this.queue=[...this.wanted].filter(o=>!this.cache.get(o)&&!this.controllers.has(o)&&!this.failed.has(o))}pump(){for(;!this.disposed&&this.inFlight<this.concurrency&&this.queue.length;){let e=this.queue.shift();this.cache.canAdopt(e,this.wanted)&&this.fetch(e)}this.settle()}validate(e,t){if(e.version!==1||e.key!==t||!Array.isArray(e.owners)||!Array.isArray(e.halo))throw new Error("Mismatched appearance tile");let i=new Set,r=new Set;for(let a of e.owners){if(!a.id||!a.geometryRevision||i.has(a.id)||Ad(a,this.options.index.zoom)!==t)throw new Error(`Invalid appearance owner: ${a.id}`);i.add(a.id);for(let o of a.observations){if(!o.id||r.has(o.id)||o.buildingId!==a.id||o.geometryRevision!==a.geometryRevision||!o.evidenceKey)throw new Error(`Unbound appearance observation: ${o.id}`);r.add(o.id)}}let s=new Set;for(let a of e.halo){if(!a.buildingId||!a.geometryRevision||a.ownerTile===t||!this.published.has(a.ownerTile)||i.has(a.buildingId)||s.has(a.buildingId))throw new Error(`Invalid appearance halo: ${a.buildingId}`);s.add(a.buildingId);let o=this.cache.get(a.ownerTile)?.tile;if(o&&!o.owners.some(l=>l.id===a.buildingId&&l.geometryRevision===a.geometryRevision))throw new Error(`Stale appearance halo: ${a.buildingId}`)}for(let a of this.cache.keys)for(let o of this.cache.get(a).tile.halo)if(o.ownerTile===t&&!e.owners.some(l=>l.id===o.buildingId&&l.geometryRevision===o.geometryRevision))throw new Error(`Stale appearance owner: ${o.buildingId}`)}async fetch(e){let t=new AbortController;this.controllers.set(e,t),this.inFlight++;try{let i=await this.options.loadTile(e,t.signal);if(this.disposed||t.signal.aborted||!this.wanted.has(e)||(this.validate(i,e),!this.cache.canAdopt(e,this.wanted)))return;let r={tile:i,resource:i.owners.length?this.options.createResource(i.owners):null,lods:new Map};if(!this.cache.adopt(e,r,this.wanted)){r.resource?.dispose();return}this.replan(),this.refreshLods()}catch(i){!t.signal.aborted&&!this.disposed&&(this.failed.add(e),this.options.onError?.(e,i))}finally{this.controllers.get(e)===t&&this.controllers.delete(e),this.inFlight--,this.disposed||this.replan(),this.pump()}}refreshLods(){if(!this.camera)return;let{longitude:e,latitude:t}=this.camera,i=111320*Math.cos(t*Math.PI/180);for(let r of this.cache.keys){let s=this.cache.get(r);for(let a of s.tile.owners){let[o,l]=il(rl(a.footprint)[0][0]),c=Math.hypot((o-e)*i,(l-t)*111320),d=Rd(c*(this.options.lodDistanceMultiplier??1),s.lods.get(a.id));s.lods.get(a.id)!==d&&(s.resource?.setLod(a.id,d),s.lods.set(a.id,d))}}}whenIdle(){return this.inFlight===0&&this.queue.length===0?Promise.resolve():new Promise(e=>this.waiters.push(e))}settle(){if(this.inFlight===0&&this.queue.length===0)for(let e of this.waiters.splice(0))e()}dispose(){if(!this.disposed){this.disposed=!0,this.queue=[];for(let e of this.controllers.values())e.abort();this.cache.clear(),this.settle()}}};function Cd(n,e,t="y"){let i=new n.MeshStandardMaterial({color:e,roughness:.94,side:n.DoubleSide});return i.customProgramCacheKey=()=>`appearance-brick-v1-${t}`,i.onBeforeCompile=r=>{r.vertexShader=`varying vec3 facadeMetricPosition;
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
    `)},i}var fy="legacy-block-NAP-minus-0.65m";function Pd(n){if(n===fy)return .65;if(n==="NAP")return 0;throw new Error(`Unsupported appearance height datum: ${n}`)}function al(n,e,t=0){return n+Pd(e)-t}function Si(n,e){return n-Pd(e)}function jc(n){let e=n.rings?.[0]||[],t,i=0;for(let a of e)for(let o of e){let l=Math.hypot(o[0]-a[0],o[2]-a[2]);l>i&&(t=[a,o],i=l)}if(!t||i<1e-8)return null;t.sort((a,o)=>a[0]-o[0]||a[2]-o[2]);let[r,s]=t;return{origin:[r[0],r[2]],u:[(s[0]-r[0])/i,(s[2]-r[2])/i],length:i}}var Jc=(n,e)=>(e[0]-n.origin[0])*n.u[0]+(e[2]-n.origin[1])*n.u[1];function wi(n,e,t,i=[]){let r=jc(n);if(!r)return{axis:null,sourceSurfaceIndex:e,intervals:[]};let s=[];for(let l of i){if(l.renderBuildingId!==t||!l.renderSurfaceIndices?.includes(e)||["rejected","uncertain","crop-repair"].includes(l.review?.placement)||!l.effectiveProposal||l.effectiveProposal.wholeUsable==="no")continue;let c=l.review?.placement==="accepted"&&l.review.targetId&&l.review.targetId!==l.id?i.find(f=>f.id===l.review.targetId):l;if(!c||c.buildingId&&c.buildingId!==t)continue;let d=[c.localStart,c.localEnd];if(d.some(f=>!Array.isArray(f)||f.length!==2||!f.every(Number.isFinite))||d.some(f=>Math.abs((f[0]-r.origin[0])*r.u[1]-(f[1]-r.origin[1])*r.u[0])>=.8))continue;let u=d.map(f=>Jc(r,[f[0],0,f[1]])),h=Math.max(0,Math.min(...u)),p=Math.min(r.length,Math.max(...u));p-h>1e-8&&s.push({record:l,startM:h,endM:p})}let a=[...new Set([0,r.length,...s.flatMap(l=>[l.startM,l.endM])])].sort((l,c)=>l-c),o=[];for(let l=0;l<a.length-1;l++){let c=a[l],d=a[l+1];if(d-c<1e-8)continue;let u=(c+d)/2,h=s.filter(g=>g.startM<=u&&g.endM>=u),p=h.filter(g=>g.record.review?.placement==="accepted"),f=p.length?p:h,b=f.length===1?f[0].record:null;o.push({startM:c,endM:d,observation:b,candidateIds:h.map(g=>g.record.id).sort(),status:b?p.length?"human":"machine":f.length?"conflict":"uncovered"})}return{axis:r,sourceSurfaceIndex:e,intervals:o}}function Id(n,e,t,i){function r(a,o,l){let c=[];for(let d=0;d<a.length;d++){let u=a[d],h=a[(d+1)%a.length],p=l*(Jc(e,u)-o),f=l*(Jc(e,h)-o);if(p>=0&&c.push(u),p>=0!=f>=0){let b=p/(p-f);c.push(u.map((g,m)=>g+(h[m]-g)*b))}}return c}let s=[];for(let a=0;a<n.length;a+=9){let o=[n.slice(a,a+3),n.slice(a+3,a+6),n.slice(a+6,a+9)];o=r(r(o,t,1),i,-1);for(let l=1;l<o.length-1;l++){let[c,d,u]=[o[0],o[l],o[l+1]],h=d.map((f,b)=>f-c[b]),p=u.map((f,b)=>f-c[b]);Math.hypot(h[1]*p[2]-h[2]*p[1],h[2]*p[0]-h[0]*p[2],h[0]*p[1]-h[1]*p[0])>1e-10&&s.push(...c,...d,...u)}}return s}function Vs(n,e,t){if(!n)return null;let i=c=>[e.origin[0]+e.u[0]*c,e.origin[1]+e.u[1]*c],r=[t.startM,t.endM].map(i).map(c=>(c[0]-n.a[0])*n.u[0]+(c[1]-n.a[1])*n.u[1]),s=Math.max(0,Math.min(...r)),a=Math.min(n.width,Math.max(...r));if(a-s<1e-8)return null;let o=[n.a[0]+n.u[0]*s,n.a[1]+n.u[1]*s],l=a-s;return{...n,a:o,width:l,mid:[o[0]+n.u[0]*l/2,o[1]+n.u[1]*l/2],polygon:n.polygon.map(c=>[c[0]-s,c[1]]),holes:(n.holes||[]).map(c=>c.map(d=>[d[0]-s,d[1]])),intervalBounded:!0,observation:t.observation,intervalStatus:t.status}}function py(n,e,t){let i=t[0]-e[0],r=t[1]-e[1],s=Math.hypot(i,r);return s<1e-7?Math.hypot(n[0]-e[0],n[1]-e[1])<=1e-7:Math.abs((n[0]-e[0])*r-(n[1]-e[1])*i)<=1e-7*s&&(n[0]-e[0])*i+(n[1]-e[1])*r>=-1e-7*s&&(n[0]-t[0])*i+(n[1]-t[1])*r<=1e-7*s}function Dd(n,e){let t=!1;for(let i=0,r=e.length-1;i<e.length;r=i++){let s=e[r],a=e[i];if(py(n,s,a))return{inside:!1,boundary:!0};s[1]>n[1]!=a[1]>n[1]&&n[0]<(a[0]-s[0])*(n[1]-s[1])/(a[1]-s[1])+s[0]&&(t=!t)}return{inside:t,boundary:!1}}function my(n,e,t){let i=0,r=1;for(let s=0;s<2;s++){let a=t[s]+1e-7,o=t[s+2]-1e-7,l=e[s]-n[s];if(a>=o)return!1;if(Math.abs(l)<1e-7){if(n[s]<=a||n[s]>=o)return!1;continue}let c=(a-n[s])/l,d=(o-n[s])/l;if(i=Math.max(i,Math.min(c,d)),r=Math.min(r,Math.max(c,d)),i>r)return!1}return i<=r}function nn(n,e,t,i,r){if(![e,t,i,r].every(Number.isFinite)||i<=0||r<=0)return!1;let s=[e-i/2,t-r/2,e+i/2,t+r/2];if(n.intervalBounded&&(s[0]<-1e-7||s[2]>n.width+1e-7))return!1;let a=[n.polygon,...n.holes||[]];if(a.some(l=>!Array.isArray(l)||l.length<3||l.some(c=>!Array.isArray(c)||c.length<2||!c.slice(0,2).every(Number.isFinite))))return!1;let o=[[s[0],s[1]],[s[0],s[3]],[s[2],s[1]],[s[2],s[3]]];return o.some(l=>{let c=Dd(l,a[0]);return!c.inside&&!c.boundary})||a.slice(1).some(l=>o.some(c=>Dd(c,l).inside))?!1:!a.some(l=>l.some((c,d)=>my(c,l[(d+1)%l.length],s)))}function gy(n){let e=n.awningEvidence;if(!e||e.origin!=="agent-visual-review"||e.derivationKey!==n.derivationKey||e.buildingMatch!=="yes"||e.appearanceEligible!==!0)return null;let t=Object.values(n.images||{});return!Array.isArray(e.images)||!e.images.length||!e.images.every(i=>t.some(r=>i.file===r.file&&i.sha256===r.sha256&&(!i.panoramaSha256||i.panoramaSha256===r.panoramaSha256)))?null:e.awningObservation||null}function Ld(n){let e=n.review;if(e?.placement!=="accepted"||e.targetId!==n.id||n.effectiveProposal?.awning!=="yes"||n.effectiveProposal?.wholeUsable==="no")return!1;if(e.awningKind!==void 0||e.awningDeployment!==void 0)return e.awningKind==="fabric"&&e.awningDeployment==="deployed";let t=gy(n);return t?.presence==="yes"&&t.fabricAwningPresence==="yes"&&t.kind==="fabric"&&t.observedDeployment==="deployed"}var Ti={minimumWidthM:.65,minimumPairedWidthM:1.1,minimumHeightM:1.8,maximumGroundGapM:.3,maximumWidthGrowthM:.2,maximumHeightGrowthM:.25};function Fd(n,e){let t={feature:n,adjustments:[]};if(n.kind!=="door"||!Number.isFinite(e)||n.thresholdHeightM!==void 0||n.disposition==="human-reviewed")return t;let i=n.y-n.height/2,r=n.y+n.height/2,s=i-e;if(s<-1e-6||s>Ti.maximumGroundGapM+1e-6)return t;let a=n.paired?Ti.minimumPairedWidthM:Ti.minimumWidthM;if(n.width<a-Ti.maximumWidthGrowthM||n.height<Ti.minimumHeightM-Ti.maximumHeightGrowthM-s)return t;let o=[],l=i,c=r,d=n.width;if(s>1e-6&&(l=e,o.push("door-ground-extension")),d<a&&(d=a,o.push("door-minimum-width")),c-l<Ti.minimumHeightM&&(c=l+Ti.minimumHeightM,o.push("door-minimum-height")),!o.length)return t;let u=c-l,h={...n,width:d,height:u,y:(c+l)/2};for(let p of["archRise","lintelRise","transom"])n[p]!==void 0&&(h[p]=n[p]*n.height/u);return n.topCornerRadius!==void 0&&(h.topCornerRadius=n.topCornerRadius*Math.min(n.width,n.height)/Math.min(d,u)),{feature:h,adjustments:o}}var Nd=(n,e)=>JSON.stringify(n)===JSON.stringify(e);function $i(n,e,t,i){let r=n.facadeDescription;if(!r||r.version!==1||!r.extractionVersion||r.buildingId!==e.id||r.geometryRevision!==e.geometryRevision||r.evidenceKey!==n.evidenceKey||!r.surfaceIndices?.includes(t)||!Nd(r.frontage,[n.localStart,n.localEnd])||n.machineRevocation?.revoked||["rejected","uncertain","crop-repair"].includes(n.review?.placement))return null;let s=r.sources?.[i],a=n.images?.[i];if(!s||!/^[a-f0-9]{64}$/i.test(s.cropSha256)||s.cropSha256!==a?.sha256||!s.captureDate||s.captureDate!==(a.date??a.capturedAt)||!Number.isInteger(s.imageDimensions?.width)||!Number.isInteger(s.imageDimensions?.height)||s.imageDimensions.width<=0||s.imageDimensions.height<=0||s.imageDimensions.width!==a?.width||s.imageDimensions.height!==a?.height||!Array.isArray(s.features)||s.features.length>256||new Set(s.features.map(d=>d.id)).size!==s.features.length)return null;let o=Object.values(r.sources).flatMap(d=>Array.isArray(d?.features)?d.features.map(u=>u.id):[]);if(new Set(o).size!==o.length)return null;let l=s.registration,c=l?.status==="correspondence-verified"&&Number.isFinite(l.residualM?.median)&&l.residualM.median<=.25&&Number.isFinite(l.residualM?.p95)&&l.residualM.p95<=.5&&Number.isInteger(l.independentAnchors)&&l.independentAnchors>=3;return!l||l.status!=="registered"&&!c||l.surfaceIndex!==t||!Number.isFinite(l.uncertaintyM)||l.uncertaintyM<0||l.imageToWall?.length!==9||!l.imageToWall.every(Number.isFinite)||l.status==="registered"&&l.uncertaintyM>.15||l.sourceDatum&&l.sourceDatum!=="NAP"||l.canonicalDatum&&l.canonicalDatum!=="surface-base"||l.pixelConvention&&l.pixelConvention!=="pixel-edge"||l.wallDirection&&(!Array.isArray(l.wallDirection)||l.wallDirection.length!==2||!l.wallDirection.every(Number.isFinite)||Math.abs(Math.hypot(...l.wallDirection)-1)>.001)||l.status==="registered"&&(!l.alignment||l.alignment.wallIdentity!=="verified"||l.alignment.boundaryEvidence!==!0||l.alignment.rooflineEvidence!==!0||l.alignment.cameraHeightResolved!==!0||l.alignment.orientationVerified!==!0)?null:c?{...s,registration:{...l,uncertaintyM:l.residualM.median}}:s}function Gs(n,e,t,i){let r=n.facadeDescription;if(!r||r.version!==1||!r.extractionVersion||r.buildingId!==e.id||r.geometryRevision!==e.geometryRevision||r.evidenceKey!==n.evidenceKey||!r.surfaceIndices?.includes(t)||!Nd(r.frontage,[n.localStart,n.localEnd])||n.machineRevocation?.revoked||["rejected","uncertain","crop-repair"].includes(n.review?.placement))return null;let s=r.sources?.[i],a=n.images?.[i],o=s?.registration,l=o?.preview;return!s||!a||!/^[a-f0-9]{64}$/i.test(s.cropSha256)||s.cropSha256!==a.sha256||s.captureDate!==(a.date??a.capturedAt)||!Number.isInteger(s.imageDimensions?.width)||!Number.isInteger(s.imageDimensions?.height)||s.imageDimensions.width<=0||s.imageDimensions.height<=0||s.imageDimensions.width!==a.width||s.imageDimensions.height!==a.height||!Array.isArray(s.features)||s.features.length>256||new Set(s.features.map(c=>c.id)).size!==s.features.length||o?.status!=="ambiguous"||o.surfaceIndex!==t||o.sourceDatum!=="NAP"||o.canonicalDatum!=="surface-base"||o.pixelConvention!=="pixel-edge"||!l||l.kind!=="native-crop-plane"||l.cropSha256!==s.cropSha256||l.imageDimensions?.width!==s.imageDimensions.width||l.imageDimensions?.height!==s.imageDimensions.height||!Array.isArray(l.imageToWall)||l.imageToWall.length!==9||!l.imageToWall.every(Number.isFinite)||!l.note?.trim()?null:{...s,registration:{...o,imageToWall:l.imageToWall,uncertaintyM:.15}}}function Nr(n,e,t){let i=t.review?.facadeFeatures?.[n.id];if(n.disposition==="revoked"||i?.disposition==="revoked"||t.featureRevocations?.[n.id]||t.visualReview?.fieldEligibility?.[n.id]===!1&&i?.disposition!=="human-reviewed")return null;let r=i?.disposition==="human-reviewed"?{...n,...i}:n;if(!["machine-observed-unreviewed","agent-inspected","human-reviewed"].includes(r.disposition)||r.signMount!==void 0&&(!["wall","glazing"].includes(r.signMount)||r.kind!=="fascia")||r.doorStyle!==void 0&&(!["panelled","glazed","plain"].includes(r.doorStyle)||r.kind!=="door")||r.doorFurniture!==void 0&&(!["knob","pull","none"].includes(r.doorFurniture)||r.kind!=="door")||r.doorGlazingRatio!==void 0&&(r.kind!=="door"||r.doorStyle!=="glazed"||!Number.isFinite(r.doorGlazingRatio)||r.doorGlazingRatio<.35||r.doorGlazingRatio>.95)||!r.id||!Array.isArray(r.bounds)||r.bounds.length!==4||!r.bounds.every(Number.isFinite)||r.archRise!==void 0&&(!Number.isFinite(r.archRise)||r.archRise<=0||r.archRise>.5||!["rounded","segmental"].includes(r.head??""))||r.lintelRise!==void 0&&(!Number.isFinite(r.lintelRise)||r.lintelRise<=0||r.lintelRise>.5||!["rounded","segmental"].includes(r.lintelHead??""))||r.topCornerRadius!==void 0&&(!Number.isFinite(r.topCornerRadius)||r.topCornerRadius<=0||r.topCornerRadius>.25||r.head!=="rectangular"))return null;let[s,a,o,l]=r.bounds;if(s<0||a<0||o<=s||l<=a)return null;let c=Object.values(t.images??{}).find(v=>v.sha256===e.cropSha256);if(o>e.imageDimensions.width||l>e.imageDimensions.height)return null;let d=e.registration.imageToWall,u=[[s,a],[o,a],[o,l],[s,l]],h=u.map(([v,C])=>d[6]*v+d[7]*C+d[8]);if(h.some(v=>Math.abs(v)<1e-8)||h.some(v=>Math.sign(v)!==Math.sign(h[0])))return null;let p=u.map(([v,C],S)=>[(d[0]*v+d[1]*C+d[2])/h[S],(d[3]*v+d[4]*C+d[5])/h[S]]),f=Math.max(.03,e.registration.uncertaintyM);if(Math.max(Math.abs(p[0][1]-p[1][1]),Math.abs(p[2][1]-p[3][1]),Math.abs(p[0][0]-p[3][0]),Math.abs(p[1][0]-p[2][0]))>f)return null;let b=p.map(v=>v[0]),g=p.map(v=>v[1]),m=Math.max(...b)-Math.min(...b),M=Math.max(...g)-Math.min(...g);if(![m,M,...b,...g].every(Number.isFinite)||m<=.02||M<=.02)return null;let E=p[0][0]>p[1][0]&&Array.isArray(r.mullions)?r.mullions.map(v=>1-v).sort((v,C)=>v-C):r.mullions;return{...r,...E?{mullions:E}:{},t:(Math.min(...b)+Math.max(...b))/2,y:(Math.min(...g)+Math.max(...g))/2,width:m,height:M,uncertaintyM:e.registration.uncertaintyM}}function Hs(n,e,t="rectangular",i,r){let s=n/2,a=-e/2,o=e/2;if(t==="rectangular"&&Number.isFinite(r)&&r>0){let h=Math.min(n,e)*r,p=Array.from({length:5},(b,g)=>{let m=g*Math.PI/8;return[s-h+Math.cos(m)*h,o-h+Math.sin(m)*h]}),f=Array.from({length:5},(b,g)=>{let m=Math.PI/2+g*Math.PI/8;return[-s+h+Math.cos(m)*h,o-h+Math.sin(m)*h]});return[[-s,a],[s,a],[s,o-h],...p.slice(1),...f.slice(1),[-s,o-h]]}if(!["rounded","segmental"].includes(t))return[[-s,a],[s,a],[s,o],[-s,o]];let l=Number.isFinite(i)&&i>0&&i<=.5?e*i:void 0,c=Math.min(l??(t==="rounded"?s:n*.2),e*.5),d=o-c,u=Array.from({length:13},(h,p)=>{let f=p*Math.PI/12;return[Math.cos(f)*s,d+Math.sin(f)*c]});return[[-s,a],[s,a],...u]}function Ud(n,e){let t=[];for(let r=0;r<n.length;r++){let s=n[r],a=n[(r+1)%n.length];(s[1]<=e&&e<a[1]||a[1]<=e&&e<s[1])&&t.push(s[0]+(a[0]-s[0])*(e-s[1])/(a[1]-s[1]))}t.sort((r,s)=>r-s);let i=[];for(let r=0;r+1<t.length;r+=2)t[r+1]-t[r]>.001&&i.push([t[r],t[r+1]]);return i}function Od(n,e){let t=[];for(let i=0;i<n.length;i++){let r=n[i],s=n[(i+1)%n.length];(r[0]<=e&&e<s[0]||s[0]<=e&&e<r[0])&&t.push(r[1]+(s[1]-r[1])*(e-r[0])/(s[0]-r[0]))}return t.length<2?null:(t.sort((i,r)=>i-r),[t[0],t[t.length-1]])}var ol={windowGlass:"#526a6b",windowGlassBlue:"#4b6268",windowGlassWarm:"#62685d",windowFrame:"#ddd8c7",windowFrameDark:"#676963",doorWood:"#3f342d",shopGlass:"#354a4b",awningFabric:"#807765",facadeTrimLight:"#b9ad96",facadeTrimDark:"#61584e"};function eu(n,e){let t=!1;for(let i=0,r=e.length-1;i<e.length;r=i++){let s=e[i],a=e[r];s[1]>n[1]!=a[1]>n[1]&&n[0]<(a[0]-s[0])*(n[1]-s[1])/(a[1]-s[1])+s[0]&&(t=!t)}return t}function tu(n,e){return(e.type==="Polygon"?[e.coordinates]:e.coordinates).some(i=>eu(n,i[0])&&!i.slice(1).some(r=>eu(n,r)))}var Bd=new WeakMap;function _y(n,e,t){let i=Bd.get(t);if(!i){i=new Map;for(let s of t){let a=s.geometry.building.footprint,o=a.type==="Polygon"?[a.coordinates]:a.coordinates,l=o.flat(2),c=s.geometry.frame.originRD,d=l.map(h=>h[0]+c.x),u=l.map(h=>c.y-h[1]);for(let h=Math.floor(Math.min(...d)/32);h<=Math.floor(Math.max(...d)/32);h++)for(let p=Math.floor(Math.min(...u)/32);p<=Math.floor(Math.max(...u)/32);p++){let f=`${h},${p}`,b=i.get(f)??[];b.push(s),i.set(f,b)}}Bd.set(t,i)}let r=e.geometry.frame.originRD;return i.get(`${Math.floor((n[0]+r.x)/32)},${Math.floor((r.y-n[1])/32)}`)??[]}function Xd(n,e,t){let i=e.geometry.frame.originRD;return _y(n,e,t).some(r=>{if(r.id===e.id)return!1;let s=r.geometry.frame.originRD;return tu([n[0]+i.x-s.x,n[1]+s.y-i.y],r.geometry.building.footprint)})}function Ei(n,e,t,i,r){return[-.5,0,.5].every(s=>{let a=e+t*s;return!Xd([n.a[0]+n.u[0]*a+n.n[0]*.08,n.a[1]+n.u[1]*a+n.n[1]*.08],i,r)})}function Or(n,e,t){let i=jc(n);if(!i||i.length<1.5||n.rings.flat().some(u=>Math.abs((u[0]-i.origin[0])*i.u[1]-(u[2]-i.origin[1])*i.u[0])>.1))return null;let r=i.origin,s=i.u,a=[r[0]+s[0]*i.length/2,r[1]+s[1]*i.length/2],o=[-s[1],s[0]],l=(u,h)=>[a[0]+u[0]*h,a[1]+u[1]*h];if(tu(l(o,.25),e.geometry.building.footprint)&&(o=o.map(u=>-u)),tu(l(o,.25),e.geometry.building.footprint)||Xd(l(o,.25),e,t))return null;let c=u=>[(u[0]-r[0])*s[0]+(u[2]-r[1])*s[1],u[1]],d=n.rings.map(u=>u.map(c));return{a:r,u:s,n:o,width:i.length,bottom:Math.min(...d[0].map(u=>u[1])),top:Math.max(...d[0].map(u=>u[1])),polygon:d[0],holes:d.slice(1)}}var kd=new WeakMap;function xy(n,e){let t=kd.get(n);if(t!==void 0)return t;let i=-1,r=0;return n.geometry.building.surfaces.forEach((s,a)=>{if(s.type!=="wall")return;let o=Or(s,n,e);o&&o.width>r&&(r=o.width,i=a)}),kd.set(n,i),i}var qd=(n,e)=>{let t=n.images?.[e];return!!t&&/^[a-f0-9]{64}$/i.test(t.sha256??"")&&/^[a-f0-9]{64}$/i.test(t.panoramaSha256??"")},yy=n=>!["rejected","uncertain","crop-repair"].includes(n.review?.placement);function ll(n){return n.flatMap(e=>e.observations.filter(t=>{let i=t.payload;return t.buildingId===e.id&&t.geometryRevision===e.geometryRevision&&t.evidenceKey&&i?.evidenceKey===t.evidenceKey&&i?.derivationKey&&i.renderBuildingId===e.id&&!i.machineRevocation?.revoked&&yy(i)}).map(t=>t.payload))}function zd(n){return!qd(n,"ground")||!["yes","no"].includes(n.effectiveProposal?.shopfront)?!1:n.review?.placement==="accepted"&&n.proposalSources?.shopfront==="human-review"?!0:n.visualReview?.fieldEligibility?.shopfront===!1?!1:n.visualReview?.fieldEligibility?.shopfront===!0||n.effectiveProposal?.groundUsable==="yes"}function vy(n){return qd(n,"full")&&n.effectiveProposal?.wholeUsable==="yes"&&n.visualReview?.appearanceEligible!==!1}var Tt=(n,e,t,i)=>[n.a[0]+n.u[0]*e+n.n[0]*i,t,n.a[1]+n.u[1]*e+n.n[1]*i];function ot(n,e,t,i,r,s){let a=[[e-i/2,t-r/2],[e+i/2,t-r/2],[e+i/2,t+r/2],[e-i/2,t+r/2]].map(([l,c])=>Tt(n,l,c,s));return(-n.u[1]*n.n[0]+n.u[0]*n.n[1]>=0?[0,1,2,0,2,3]:[0,2,1,0,3,2]).flatMap(l=>a[l])}var Xs=n=>n.reduce((e,t,i)=>{let r=n[(i+1)%n.length];return e+t[0]*r[1]-r[0]*t[1]},0);function $d(n){let e=0;for(let t=0;t<n.length;t++){let i=n[t],r=n[(t+1)%n.length],s=n[(t+2)%n.length],a=(r[0]-i[0])*(s[1]-r[1])-(r[1]-i[1])*(s[0]-r[0]);if(Math.abs(a)<1e-9)continue;let o=Math.sign(a);if(e&&o!==e)return!1;e=o}return e!==0}function Vd(n,e){if(e.length<3||Math.abs(Xs(e))<1e-8)return[];let t=Math.sign(Xs(e)),i=n;for(let r=0;r<e.length;r++){let s=e[r],a=e[(r+1)%e.length],o=i;i=[];let l=c=>(a[0]-s[0])*(c[1]-s[1])-(a[1]-s[1])*(c[0]-s[0]);for(let c=0;c<o.length;c++){let d=o[c],u=o[(c+1)%o.length],h=l(d),p=l(u),f=t*h>=-1e-8,b=t*p>=-1e-8;if(f&&i.push(d),f!==b){let g=h/(h-p);i.push([d[0]+(u[0]-d[0])*g,d[1]+(u[1]-d[1])*g])}}}return i}var Ur=(n,e,t)=>(e[0]-n[0])*(t[1]-n[1])-(e[1]-n[1])*(t[0]-n[0]),by=(n,e)=>e.some((t,i)=>{let r=e[(i+1)%e.length];return Math.abs(Ur(t,r,n))<1e-8&&n[0]>=Math.min(t[0],r[0])-1e-8&&n[0]<=Math.max(t[0],r[0])+1e-8&&n[1]>=Math.min(t[1],r[1])-1e-8&&n[1]<=Math.max(t[1],r[1])+1e-8}),qs=(n,e)=>by(n,e)||eu(n,e),My=(n,e,t,i)=>{let r=Math.sign(Ur(e,t,i));return r*Ur(e,t,n)>=-1e-8&&r*Ur(t,i,n)>=-1e-8&&r*Ur(i,e,n)>=-1e-8};function Sy(n,e,t){let i=[e[0]-n[0],e[1]-n[1]],r=i[0]*i[0]+i[1]*i[1];if(r<1e-16)return qs(n,t);let s=[0,1];for(let a=0;a<t.length;a++){let o=t[a],l=t[(a+1)%t.length],c=[l[0]-o[0],l[1]-o[1]],d=[o[0]-n[0],o[1]-n[1]],u=i[0]*c[1]-i[1]*c[0];if(Math.abs(u)<1e-12){if(Math.abs(d[0]*i[1]-d[1]*i[0])<1e-10)for(let f of[o,l])s.push(Math.max(0,Math.min(1,((f[0]-n[0])*i[0]+(f[1]-n[1])*i[1])/r)));continue}let h=(d[0]*c[1]-d[1]*c[0])/u,p=(d[0]*i[1]-d[1]*i[0])/u;h>=-1e-10&&h<=1+1e-10&&p>=-1e-10&&p<=1+1e-10&&s.push(Math.max(0,Math.min(1,h)))}return s.sort((a,o)=>a-o),s.every((a,o)=>o===s.length-1||qs([n[0]+i[0]*(a+s[o+1])/2,n[1]+i[1]*(a+s[o+1])/2],t))}var wy=(n,e)=>n.every((t,i)=>qs(t,e)&&Sy(t,n[(i+1)%3],e));function Ty(n){let e=n.filter((s,a)=>a===0||Math.abs(s[0]-n[a-1][0])>1e-10||Math.abs(s[1]-n[a-1][1])>1e-10);e.length>2&&Math.abs(e[0][0]-e.at(-1)[0])<1e-10&&Math.abs(e[0][1]-e.at(-1)[1])<1e-10&&e.pop();let t=Math.sign(Xs(e));if(e.length<3||!t)return[];let i=e.map((s,a)=>a),r=[];for(;i.length>3;){let s=-1;for(let a=0;a<i.length;a++){let o=i[(a+i.length-1)%i.length],l=i[a],c=i[(a+1)%i.length],d=e[o],u=e[l],h=e[c];if(!(t*Ur(d,u,h)<=1e-10)&&!i.some(p=>p!==o&&p!==l&&p!==c&&My(e[p],d,u,h))){s=a,r.push([d,u,h]);break}}if(s<0)return[];i.splice(s,1)}return r.push(i.map(s=>e[s])),r}var Gd=new WeakMap;function Yd(n,e){if($d(e)){let i=Vd(n,e);return i.length>=3&&Math.abs(Xs(i))>1e-10?[i]:[]}let t=Gd.get(e);return t||(t=Ty(e),Gd.set(e,t)),t.map(i=>Vd(n,i)).filter(i=>i.length>=3&&Math.abs(Xs(i))>1e-10)}function Ey(n,e,t,i,r,s){let a=[];for(let o of Yd([[e-i/2,t-r/2],[e+i/2,t-r/2],[e+i/2,t+r/2],[e-i/2,t+r/2]],n.polygon))for(let l=1;l<o.length-1;l++){let c=[o[0],o[l],o[l+1]],d=[c.reduce((u,h)=>u+h[0],0)/3,c.reduce((u,h)=>u+h[1],0)/3];n.holes.some(u=>qs(d,u))||a.push(...c.flatMap(([u,h])=>Tt(n,u,h,s)))}return a}function Qc(n,e,t){return n.flatMap((i,r)=>{if(r%3!==0)return[];let s=(n[r]-e.a[0])*e.u[0]+(n[r+2]-e.a[1])*e.u[1],a=n[r+1],o=(s-t.left)/(t.right-t.left);return t.sourceXForward||(o=1-o),[Math.max(0,Math.min(1,o)),Math.max(0,Math.min(1,(a-t.bottom)/(t.top-t.bottom)))]})}function Ay(n,e){let t=[];for(let i=0;i<n.length;i+=9){let r=[0,1,2].map(c=>n.slice(i+c*3,i+c*3+3)),s=r.map(c=>[(c[0]-e.a[0])*e.u[0]+(c[2]-e.a[1])*e.u[1],c[1]]);if(!e.holes.length&&wy(s,e.polygon)){t.push(...r.flat());continue}let a=r.map(c=>(c[0]-e.a[0])*e.n[0]+(c[2]-e.a[1])*e.n[1]),o=(s[1][1]-s[2][1])*(s[0][0]-s[2][0])+(s[2][0]-s[1][0])*(s[0][1]-s[2][1]),l=(c,d)=>{if(Math.abs(o)<1e-12)return a[0];let u=((s[1][1]-s[2][1])*(c-s[2][0])+(s[2][0]-s[1][0])*(d-s[2][1]))/o,h=((s[2][1]-s[0][1])*(c-s[2][0])+(s[0][0]-s[2][0])*(d-s[2][1]))/o;return u*a[0]+h*a[1]+(1-u-h)*a[2]};for(let c of Yd(s,e.polygon))for(let d=1;d<c.length-1;d++){let u=[c[0],c[d],c[d+1]],h=[u.reduce((p,f)=>p+f[0],0)/3,u.reduce((p,f)=>p+f[1],0)/3];e.holes.some(p=>qs(h,p))||t.push(...u.flatMap(([p,f])=>Tt(e,p,f,l(p,f))))}}return t}function Ws(n,e,t,i,r,s,a){return[...ot(n,e,t-r/2-s/2,i+2*s,s,a),...ot(n,e,t+r/2+s/2,i+2*s,s,a),...ot(n,e-i/2-s/2,t,s,r,a),...ot(n,e+i/2+s/2,t,s,r,a)]}function Ry(n,e){let t=e?.bounds;if(!Array.isArray(t)||t.length!==4)return 1/0;let[i,r,s,a]=t,o=1/0;for(let l of n??[]){if(l===e||!["window","door"].includes(l.kind))continue;let c=l.bounds;if(!Array.isArray(c)||c.length!==4)continue;let d=Math.min(a,c[3])-Math.max(r,c[1]);if(d<=0||d<.5*Math.min(a-r,c[3]-c[1]))continue;let u;if(c[2]<=i)u=i-c[2];else if(s<=c[0])u=c[0]-s;else continue;u<o&&(o=u)}return o}function Cy(n,e,t,i,r,s,a=l=>!0,o=!1){let l=[],c=n.geometryRevision==="source-space-unregistered",d=o&&i.facadeDescription?.extractionVersion==="source-facade-owner-candidate/v1",u=o&&["case24-source-facade-candidate/v4-doors-and-display","source-facade-owner-candidate/v1"].includes(i.facadeDescription?.extractionVersion)&&r.registration?.status==="ambiguous"&&r.registration?.preview?.kind==="native-crop-plane",h=new Set,p=new Set,f=Number.isFinite(n.geometry.building.groundNAP)&&["NAP","legacy-block-NAP-minus-0.65m"].includes(n.geometry.frame.heightDatum)?Si(n.geometry.building.groundNAP,n.geometry.frame.heightDatum)-e.bottom:void 0,b=(M,E)=>/^#[a-f0-9]{6}$/i.test(M??"")?M:E,g=(M,E)=>{if(M.kind==="window"){let v=/^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(M.colour??"");if(v&&[1,2,3].every(C=>parseInt(v[C],16)>=235))return E}return b(M.colour,E)},m=(t.a[0]-e.a[0])*e.u[0]+(t.a[1]-e.a[1])*e.u[1];for(let M of r.features??[]){if(!a(M))continue;if(M.kind==="material"&&M.region&&["accent","band","surround","plinth"].includes(M.region)&&Array.isArray(M.bounds)&&M.bounds.length===4&&M.bounds.every(Number.isFinite)){let W=r.imageDimensions,J=Math.max(0,M.bounds[2]-M.bounds[0])*Math.max(0,M.bounds[3]-M.bounds[1]);if(W&&J/(W.width*W.height)>=.6)continue}let E=i.facadeDescription?.concaveMaterialPreview,v=E?.sourceCropSha256===r.cropSha256&&E?.featureIds?.includes(M.id);if(d&&M.kind==="material"&&!$d(t.polygon)&&!v)continue;let C=Nr(M,r,i);if(!C)continue;let S=Fd(C,f);if(S.adjustments.length){let W=S.feature,J=W.lintelHead||W.surroundColour?.length?.14:.07;(!nn(t,W.t-m,W.y+e.bottom+J/2,W.width+J*2,W.height+J)||!Ei(t,W.t-m,W.width+J*2,n,s))&&(S={feature:C,adjustments:[]})}let _=S.feature,x=u&&Array.isArray(_.bounds)?(()=>{let W=r.registration.imageToWall,[J,pe,we,Te]=_.bounds,Ce=(J+we)/2,ie=(pe+Te)/2,he=(ze,Ye)=>{let L=W[6]*ze+W[7]*Ye+W[8];return Math.abs(L)>1e-8?[(W[0]*ze+W[1]*Ye+W[2])/L,(W[3]*ze+W[4]*Ye+W[5])/L]:null},de=he(Ce,ie),Se=he(Ce+1,ie),qe=he(Ce,ie+1);if(!de||!Se||!qe)return;let tt=Math.hypot(Se[0]-de[0],Se[1]-de[1]),et=Math.hypot(qe[0]-de[0],qe[1]-de[1]),We=(tt+et)/2;return Number.isFinite(We)&&We>0&&We<.1?We:void 0})():void 0,A=c?.01:x,T=A&&Number.isFinite(_.sourceFrameWidthPx)&&_.sourceFrameWidthPx>0&&_.sourceFrameWidthPx<=12?_.sourceFrameWidthPx*A:void 0,R=A&&Number.isFinite(_.sourceJoineryWidthPx)&&_.sourceJoineryWidthPx>0&&_.sourceJoineryWidthPx<=12?_.sourceJoineryWidthPx*A:void 0,I=A??(()=>{let W=r.registration?.imageToWall;if(!Array.isArray(W)||W.length!==9)return;let[J,pe,we,Te]=_.bounds,Ce=(J+we)/2,ie=(pe+Te)/2,he=(tt,et)=>{let We=W[6]*tt+W[7]*et+W[8];return Math.abs(We)>1e-8?[(W[0]*tt+W[1]*et+W[2])/We,(W[3]*tt+W[4]*et+W[5])/We]:null},de=he(Ce,ie),Se=he(Ce+1,ie);if(!de||!Se)return;let qe=Math.hypot(Se[0]-de[0],Se[1]-de[1]);return Number.isFinite(qe)&&qe>0&&qe<.5?qe:void 0})(),N=T??.14;if(I&&Number.isFinite(_.frameClearancePx)&&_.frameClearancePx>0){let W=Ry(r.features??[],M),J=Number.isFinite(W)?Math.min(_.frameClearancePx,W):_.frameClearancePx;N=Math.min(N,Math.max(0,J*I))}let U=R??.065,F=R?.008:.08,O=_.t-m,D=_.y+e.bottom,G=_.kind==="window"||_.kind==="door",K=G?_.lintelHead||_.surroundColour?.length?.14:.07:0,Q=S.adjustments.length>0,ne=nn(t,O,D+(Q?K/2:0),_.width+K*2,_.height+K*(Q?1:2))&&Ei(t,O,_.width+K*2,n,s),le=G&&!ne&&o;if((G||_.kind==="awning")&&!ne&&!le)continue;let Ue=_.kind==="door"?"observed-door":_.kind==="window"?"observed-window":_.kind==="awning"?"observed-awning":_.kind==="fascia"?"observed-fascia":"observed-material",He=`${n.id}:${i.id}:${_.id}`;le&&h.add(He),Q&&p.add(He);let Re=(W,J)=>l.push({triangles:W,colour:J,observationId:i.id,featureId:He,featureKind:Ue,styleSource:_.disposition,...Q?{heuristics:S.adjustments}:{},..._.kind==="material"&&_.material==="brick"?{material:"brick"}:{}}),Y=(W,J,pe,we)=>[W,J,pe].flatMap(([Te,Ce])=>Tt(t,O+Te,D+Ce,we));if(G){if(!_.head||_.head==="unknown")continue;let W=Hs(_.width,_.height,_.head,_.archRise,_.topCornerRadius),J=Hs(_.width+N,_.height+N,_.head,_.archRise,_.topCornerRadius);for(let ie=1;ie<W.length-1;ie++)Re(Y(W[0],W[ie],W[ie+1],.032),g(_,_.kind==="door"?"doorWood":"windowGlass"));for(let ie=0;ie<W.length;ie++){let he=(ie+1)%W.length;Re([...Y(W[ie],J[ie],J[he],.072),...Y(W[ie],J[he],W[he],.072)],b(_.frameColour,"windowFrame"))}for(let ie=0;ie<W.length;ie++){let he=(ie+1)%W.length,de=Tt(t,O+W[ie][0],D+W[ie][1],.032),Se=Tt(t,O+W[he][0],D+W[he][1],.032),qe=Tt(t,O+W[he][0],D+W[he][1],.072),tt=Tt(t,O+W[ie][0],D+W[ie][1],.072);Re([...de,...Se,...qe,...de,...qe,...tt],b(_.frameColour,"windowFrame"))}if(_.kind==="window"&&Re(ot(t,O,D-_.height/2-N/4,_.width+N,N/2,.095),b(_.frameColour,"windowFrame")),_.kind==="door"&&_.transom&&_.transom>0&&_.transom<.6){let ie=_.height*(.5-_.transom),he=[];for(let de=0;de<W.length;de++){let Se=W[de],qe=W[(de+1)%W.length];Se[1]>=ie&&he.push(Se),Se[1]>=ie!=qe[1]>=ie&&he.push([Se[0]+(qe[0]-Se[0])*(ie-Se[1])/(qe[1]-Se[1]),ie])}for(let de=1;de<he.length-1;de++)Re(Y(he[0],he[de],he[de+1],.04),"windowGlass")}let pe=_.transom&&_.transom>0&&_.transom<.6?_.height*(.5-_.transom):void 0,we=_.opaqueHeadAboveTransom;if(u&&we===!0&&_.kind==="window"&&_.head==="rectangular"&&pe!==void 0){let ie=_.height/2-pe;ie>0&&Re(ot(t,O,D+pe+ie/2,_.width,ie,.04),"windowFrameDark")}let Te=ie=>{let he=Od(W,ie);if(!he)return;let de=(c||u)&&_.mullionScope==="below-transom"&&_.kind==="window"&&pe!==void 0?Math.min(he[1],pe):he[1],Se=R?de-he[0]-F:Math.max(.02,de-he[0]-.08);Se>0&&Re(ot(t,O+ie,D+(he[0]+de)/2,U,Se,.078),b(_.frameColour,"windowFrame"))},Ce=ie=>{for(let[he,de]of Ud(W,ie))Re(ot(t,O+(he+de)/2,D+ie,de-he,U,.078),b(_.frameColour,"windowFrame"))};_.paired&&Te(0),pe!==void 0&&Ce(pe);for(let ie of _.mullions??[])ie>0&&ie<1&&Te(_.width*(ie-.5));if(_.kind==="door"){let ie=_.doorStyle??"panelled",he=_.doorFurniture??"knob",de=ie==="glazed"&&_.doorGlazingRatio!==void 0,Se=-_.height/2,qe=de&&!_.transom?_.height*.5-(_.archRise??0)*_.height-.05:Math.min(_.height*(.5-(_.transom??.12)),_.height*.5-(_.archRise??0)*_.height)-.1,tt=_.paired?2:1,et=_.width/tt,We=qe-Se,ze=(Ye,L,bt)=>{Re(Ye,L);let Je=l[l.length-1];Je.styleSource="procedural-prior-not-measured",Je.heuristics=[...Je.heuristics??[],bt]};if(de&&We>.65){let Ye=We*_.doorGlazingRatio,L=Math.max(.08,_.width-Math.min(.04,_.width*.1));Re(ot(t,O,D+qe-Ye/2,L,Ye,.04),"windowGlass")}else if(We>.65&&et>.36)for(let Ye=0;Ye<tt;Ye++){let L=-_.width/2+et*(Ye+.5),bt=et*.68,Je=(z,H,Z=!1)=>{ze(Ws(t,O+L,D+z,bt,H,.025,.083),"#655e50","door-panel-grammar"),ze(ot(t,O+L,D+z,bt,H,.081),Z?"windowGlass":b(_.colour,"doorWood"),"door-panel-grammar")};ie==="glazed"?(Je(Se+We*.63,We*.53,!0),Je(Se+We*.19,We*.19)):ie==="panelled"&&(Je(Se+We*.27,We*.32),Je(Se+We*.7,We*.36));let P=L+(tt===2?Ye===0?1:-1:1)*et*.34,y=Se+Math.min(1.02,We*.55);if(he==="knob"){let z=Math.min(.035,et*.05),H=[];for(let ce=0;ce<10;ce++){let ue=ce*Math.PI/5;H.push(Tt(t,O+P+Math.cos(ue)*z,D+y+Math.sin(ue)*z,.115))}let Z=Tt(t,O+P,D+y,.135);ze(H.flatMap((ce,ue)=>[...Z,...ce,...H[(ue+1)%H.length]]),"#b4a17a","door-furniture-grammar")}else he==="pull"&&ze(ot(t,O+P,D+y,.026,Math.min(.28,We*.2),.12),"#b8b9b4","door-furniture-grammar");ie==="panelled"&&Ye===0&&ze(ot(t,O+L,D+Se+We*.49,Math.min(.24,bt*.65),.035,.11),"#aaa18a","door-furniture-grammar")}}if(_.lintelHead||_.surroundColour){let ie=Hs(_.width+.14,_.height+.14,_.lintelHead??_.head,_.lintelRise),he=Hs(_.width+.28,_.height+.28,_.lintelHead??_.head,_.lintelRise);for(let de=2;de<he.length-1;de++)Re([...Y(ie[de],he[de],he[de+1],.06),...Y(ie[de],he[de+1],ie[de+1],.06)],b(_.surroundColour,"facadeTrimLight"))}}else if(_.kind==="awning"){let W=(J,pe,we,Te,Ce)=>{if(!_.text?.trim()||!_.physicalSignId?.trim())return;let ie=r.registration.imageToWall,he=_.bounds[0],de=_.bounds[2],Se=(_.bounds[1]+_.bounds[3])/2,qe=ze=>ie[6]*ze+ie[7]*Se+ie[8],tt=ze=>(ie[0]*ze+ie[1]*Se+ie[2])/qe(ze),et={left:O-_.width/2,right:O+_.width/2,bottom:we,top:Te,sourceXForward:tt(de)>tt(he)};Re(J,pe);let We=l[l.length-1];We.sign={text:_.text.trim(),background:ol[pe]??pe,colour:/^#[a-f0-9]{6}$/i.test(_.textColour??"")?_.textColour:"#f4f1e8",..._.signFont?.trim()?{font:_.signFont.trim()}:{},physicalSignId:_.physicalSignId.trim(),aspectRatio:_.width/(Te-we),uv:Qc(J,t,et)},We.signMapping=et};if(_.state==="retracted"){let J=Math.min(.18,_.height),pe=b(_.frameColour,b(_.colour,"awningFabric"));Re(ot(t,O,D,_.width,J,.1),b(_.colour,"awningFabric")),W(ot(t,O,D,_.width,J,.104),pe,D-J/2,D+J/2,.104)}if(_.state==="extended"){let J=D+_.height/2,pe=D-_.height/2,we=Math.min(.26,_.height*.22),Te=_.height-we,Ce=Math.min(1.5,Math.max(.45,_.width*.22)),ie=_.stripeColour?Math.max(2,Math.min(48,Math.round(_.stripeCount??20))):1,he=_.awningProfile==="curved"?8:1,de=ze=>[J-Te*(_.awningProfile==="curved"?1-Math.cos(ze*Math.PI/2):ze),.08+Ce*(_.awningProfile==="curved"?Math.sin(ze*Math.PI/2):ze)],Se=(ze,Ye)=>Re([0,1,2,0,2,3].flatMap(L=>ze[L]),Ye);for(let ze=0;ze<ie;ze++){let Ye=O-_.width/2+_.width*ze/ie,L=O-_.width/2+_.width*(ze+1)/ie,bt=b(ze%2?_.stripeColour:_.colour,"awningFabric");for(let P=0;P<he;P++){let y=de(P/he),z=de((P+1)/he);Se([Tt(t,Ye,y[0],y[1]),Tt(t,L,y[0],y[1]),Tt(t,L,z[0],z[1]),Tt(t,Ye,z[0],z[1])],bt)}let Je=_.valance==="scalloped"?Math.max(1,Math.round((L-Ye)/.16)):1;for(let P=0;P<Je;P++)for(let y=0;y<(_.valance==="scalloped"?6:1);y++){let z=_.valance==="scalloped"?6:1,H=y/z,Z=(y+1)/z,ce=Ye+(L-Ye)*(P+H)/Je,ue=Ye+(L-Ye)*(P+Z)/Je,j=ee=>pe+(_.valance==="scalloped"?Math.min(.06,we*.3)*(1-Math.sin(ee*Math.PI)):0);Se([Tt(t,ce,pe+we,.08+Ce),Tt(t,ue,pe+we,.08+Ce),Tt(t,ue,j(Z),.08+Ce),Tt(t,ce,j(H),.08+Ce)],bt)}}let qe=b(_.frameColour,b(_.colour,"awningFabric")),tt=_.valance==="scalloped"?Math.min(.06,we*.3):0,et=pe+tt,We=we-tt;W(ot(t,O,et+We/2,_.width,We,.08+Ce+.004),qe,et,pe+we,.08+Ce+.004)}}else if(/^#[a-f0-9]{6}$/i.test(_.colour??"")){let W=d&&["cornice","masonry-band","sill"].includes(_.region),J=Ey(t,O,D,_.width,_.height,_.kind==="fascia"?_.signMount==="glazing"?.05:.025:_.region==="upper-wall"?.008:_.region==="ground-floor"?.014:_.region==="plinth"?.018:W?.026:.022);if(J.length){let pe=b(_.colour,"facadeTrimLight");if(Re(J,pe),_.kind==="fascia"&&_.text?.trim()&&_.physicalSignId?.trim()){let we=r.registration.imageToWall,Te=_.bounds[0],Ce=_.bounds[2],ie=(_.bounds[1]+_.bounds[3])/2,he=et=>we[6]*et+we[7]*ie+we[8],de=et=>(we[0]*et+we[1]*ie+we[2])/he(et),Se=de(Ce)>de(Te),qe={left:O-_.width/2,right:O+_.width/2,bottom:D-_.height/2,top:D+_.height/2,sourceXForward:Se},tt=l[l.length-1];tt.sign={text:_.text.trim(),background:ol[pe]??pe,colour:/^#[a-f0-9]{6}$/i.test(_.textColour??"")?_.textColour:"#f4f1e8",..._.signFont?.trim()?{font:_.signFont.trim()}:{},physicalSignId:_.physicalSignId.trim(),aspectRatio:_.width/_.height,uv:Qc(J,t,qe)},tt.signMapping=qe}}}}return o||p.size?l.map(M=>{if(!o&&!p.has(M.featureId))return M;let E=Ay(M.triangles,t);return E.length?{...M,triangles:E,...M.sign&&M.signMapping?{sign:{...M.sign,uv:Qc(E,t,M.signMapping)}}:{},signMapping:void 0,...h.has(M.featureId)?{partialAtFace:!0}:{}}:null}).filter(M=>M!==null).map(M=>{let{signMapping:E,...v}=M;return v}):l.map(M=>{let{signMapping:E,...v}=M;return v})}function Hd(n,e,t,i){if(e.type!=="wall")return[];let r=Or(e,n,i);if(!r||r.width<2.2||r.top-r.bottom<5)return[];let s=Number.isFinite(n.geometry.building.groundNAP)?Si(n.geometry.building.groundNAP,n.geometry.frame.heightDatum):r.bottom,a=Math.min(r.top,s+42),o=a-s;if(o<5)return[];let l=Number(n.geometry.building.year),c=Number.isFinite(l)&&l<1940?3.45:3.15,d=Math.max(1,Math.min(10,Math.floor(o/c))),u=Number.isFinite(l)&&l<1940?2.45:3.05,h=Math.max(1,Math.min(14,Math.round(r.width/u))),p=r.width/h,f=Math.min(Number.isFinite(l)&&l<1940?1.18:1.48,p*.55),b=Math.min(Number.isFinite(l)&&l<1940?1.85:1.55,c*.58),g=[],m=[...n.id].reduce((R,I)=>R*31+I.charCodeAt(0),0)>>>0,M=Number.isFinite(l)&&l>=1970||m%11===0?"windowFrameDark":"windowFrame",E=m%3===0?"windowGlassBlue":m%3===1?"windowGlassWarm":"windowGlass",v=xy(n,i),C=[...n.id].reduce((R,I)=>R+I.charCodeAt(0),0)%h,S=t===v&&r.bottom<=s+.7,_=Number.isFinite(l)&&l<1965;for(let R=0;R<d;R++)for(let I=0;I<h;I++){if(S&&R===0&&I===C)continue;let N=(I+.5)*p,U=s+.55+(R+.5)*c;if(!nn(r,N,U,f+.16,b+.16)||!Ei(r,N,f+.16,n,i))continue;let F=`${n.id}:${t}:context-window:${R}:${I}`;g.push({triangles:Ws(r,N,U,f,b,.1,.05),colour:M,observationId:null,featureId:F,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"},{triangles:ot(r,N,U,f,b,.038),colour:E,observationId:null,featureId:F,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"},{triangles:ot(r,N,U+b*.12,f,.065,.058),colour:M,observationId:null,featureId:F,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"}),_&&g.push({triangles:ot(r,N,U,.055,b-.14,.058),colour:M,observationId:null,featureId:F,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"}),g.push({triangles:ot(r,N,U-b/2-.045,f+.28,.09,.07),colour:M,observationId:null,featureId:F,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"})}if(S){let R=(C+.5)*p,I=Math.min(1.15,p*.48),N=Math.min(2.45,c*.76),U=s+.12+N/2;if(nn(r,R,U,I+.2,N+.16)&&Ei(r,R,I+.2,n,i)){let F=`${n.id}:${t}:context-door`,O=(D,G)=>g.push({triangles:D,colour:G,observationId:null,featureId:F,featureKind:"contextual-door-prior",styleSource:"procedural-prior-not-measured"});if(O(ot(r,R,U,I+.2,N+.16,.036),M),O(ot(r,R,U,I,N,.05),"doorWood"),_){let D=Math.min(.42,N*.18),G=U+N/2-D/2-.1;O(ot(r,R,G,I-.18,D,.062),E),O(ot(r,R,G-D/2-.045,I,.09,.068),M)}O(ot(r,R,s+.1,I+.28,.1,.075),M)}}let x=r.width-.32,A=Number.isFinite(l)&&l>=1965?"facadeTrimDark":"facadeTrimLight",T=(R,I,N)=>{x<1.8||!nn(r,r.width/2,I,x,N)||!Ei(r,r.width/2,x,n,i)||g.push({triangles:ot(r,r.width/2,I,x,N,.072),colour:A,observationId:null,featureId:`${n.id}:${t}:context-trim:${R}`,featureKind:"contextual-trim-prior",styleSource:"procedural-prior-not-measured"})};return d>1&&T("street-datum",s+c,.12),Number.isFinite(l)&&l<1965&&T("facade-top",a-.18,.24),g}function Py(n,e,t,i,r,s=!1,a=!1){if(e.type!=="wall")return[];let o=Or(e,n,r);if(!o||o.top-o.bottom<2.5)return[];let l=new Map(i.map(p=>[p.id,p])),c=[],d=n.geometry.building.surfaces.filter(p=>p.type==="wall").flatMap(p=>p.rings[0].map(f=>f[1])),u=Number.isFinite(n.geometry.building.groundNAP)?Si(n.geometry.building.groundNAP,n.geometry.frame.heightDatum):Math.min(...d),h=["upper","ground"].flatMap(p=>{let f=p==="upper"?"full":"ground",b=i.map(m=>{let M=m.facadeDescription?.sources?.[f],E=$i(m,n,t,f),v=!E&&a?Gs(m,n,t,f):null,C=p==="upper"&&(!!$i(m,n,t,"ground")||a&&!!Gs(m,n,t,"ground")),S=!!E||!!v||!M&&(p==="upper"?vy(m)||C:zd(m));return{...m,effectiveProposal:S?{wholeUsable:"unknown"}:null}}),g=wi(e,t,n.id,b);return g.intervals.map(m=>({field:p,interval:m,axis:g.axis}))});for(let{field:p,interval:f,axis:b}of h){if(!f.observation||f.status==="conflict")continue;let g=l.get(f.observation.id),m=Vs(o,b,f);if(!g||!m||m.width<1.5)continue;let M=(ne,le,Ue,He)=>c.push({triangles:ne,colour:le,observationId:g.id,featureId:Ue,featureKind:He,styleSource:"procedural-prior-not-measured"}),E=(ne,le,Ue,He,Re)=>{!nn(m,ne,le,Ue+.18,He+.18)||!Ei(m,ne,Ue+.18,n,r)||(M(Ws(m,ne,le,Ue,He,.09,.05),"windowFrame",Re,"window-prior"),M(ot(m,ne,le,Ue,He,.038),"windowGlass",Re,"window-prior"),M(ot(m,ne,le+He*.12,Ue,.065,.058),"windowFrame",Re,"window-prior"),M(ot(m,ne,le,.055,He-.14,.058),"windowFrame",Re,"window-prior"))},v=p==="upper"?"full":"ground",C=$i(g,n,t,v),S=!C&&a?Gs(g,n,t,v):null,_=C??S;if(_){let ne=g.facadeDescription?.extractionVersion==="source-facade-owner-candidate/v1",le=g.facadeDescription?.sources?.full,Ue=g.facadeDescription?.sources?.ground,He=ne&&Number.isFinite(Date.parse(le?.captureDate))&&Number.isFinite(Date.parse(Ue?.captureDate))&&Date.parse(Ue.captureDate)<Date.parse(le.captureDate),Re=Ce=>He&&Ce.kind==="window"&&Array.isArray(Ce.bounds)&&Ce.bounds[1]<=0,Y=p==="upper"&&$i(g,n,t,"ground"),W=p==="upper"&&!Y&&a?Gs(g,n,t,"ground"):null,J=Y??W,pe=J?(J.features??[]).filter(Ce=>!Re(Ce)&&(!ne||Ce.kind==="window"||Ce.kind==="door")).map(Ce=>Nr(Ce,J,g)).filter(Boolean):[],Te=Cy(n,o,m,g,_,r,Ce=>{if(p==="ground"&&Re(Ce))return!1;if(!J||Ce.region==="upper-wall"||g.facadeDescription?.extractionVersion==="source-facade-owner-candidate/v1"&&Ce.kind==="material"&&["cornice","masonry-band","sill"].includes(Ce.region))return!0;let ie=Nr(Ce,_,g);return ie?!pe.some(he=>Math.abs(ie.t-he.t)<(ie.width+he.width)/2&&Math.abs(ie.y-he.y)<(ie.height+he.height)/2):!1},a&&!!S);c.push(...S?Te.map(Ce=>({...Ce,previewOnly:!0})):Te);continue}let x=3.5,A=Math.max(1,Math.min(12,Math.ceil((m.top-u)/x))),T=Math.max(1,Math.min(16,Math.round(m.width/2.7))),R=m.width/T,I=Math.min(1.25,R*.53),N=Math.min(1.9,x*.56),U=`${n.id}:${t}:${g.id}`;if(p==="upper"){for(let ne=1;ne<A;ne++)for(let le=0;le<T;le++)E((le+.5)*R,u+(ne+.48)*x,I,N,`${U}:window:${ne}:${le}`);continue}if(!zd(g)||m.bottom>u+1.5)continue;let F=Math.min(2.35,x*.66),O=u+.55+F/2;if(g.effectiveProposal.shopfront==="no"){let ne=R/2,le=Math.min(1.1,R*.48),Ue=2.35,He=u+.12+Ue/2,Re=nn(m,ne,He,le+.18,Ue+.18)&&Ei(m,ne,le+.18,n,r);if(Re){let Y=`${U}:entrance-prior`;M(Ws(m,ne,He,le,Ue,.09,.065),"windowFrame",Y,"contextual-door-prior"),M(ot(m,ne,He,le,Ue,.038),"doorWood",Y,"contextual-door-prior"),M(ot(m,ne,He+Ue/2-.25,le-.12,.36,.052),"windowGlass",Y,"contextual-door-prior")}for(let Y=Re?1:0;Y<T;Y++)E((Y+.5)*R,O,I,Math.min(1.8,F),`${U}:window:0:${Y}`);continue}let D=Math.min(m.width-.5,12),G=m.width/2;if(!nn(m,G,O,D+.16,F+.16)||!Ei(m,G,D+.16,n,r))continue;let K=`${U}:shop`;M(Ws(m,G,O,D,F,.08,.05),"windowFrame",K,"shopfront-prior"),M(ot(m,G,O,D,F,.038),"shopGlass",K,"shopfront-prior");let Q=Math.max(2,Math.ceil(D/1.7));for(let ne=1;ne<Q;ne++)M(ot(m,G-D/2+D*ne/Q,O,.065,F,.058),"windowFrame",K,"shopfront-prior");if(s&&Ld(g)){let ne=O+F/2+.3;if(!nn(m,G,ne,D,.2))continue;let le=[Tt(m,G-D/2,ne,.07),Tt(m,G+D/2,ne,.07),Tt(m,G+D/2,ne-.24,.8),Tt(m,G-D/2,ne-.24,.8)];M([0,1,2,0,2,3].flatMap(Ue=>le[Ue]),"awningFabric",`${U}:awning`,"reviewed-awning-prior")}}return c}function Iy(n,e,t,i){let r=i.filter(a=>a.renderBuildingId===n.id&&a.renderSurfaceIndices?.includes(t));return r.length?wi(e,t,n.id,r.map(a=>({...a,effectiveProposal:{wholeUsable:"unknown"}}))).intervals.filter(a=>a.observation||a.status==="conflict").map(a=>[Math.min(a.startM,a.endM),Math.max(a.startM,a.endM)]).filter(([a,o])=>Number.isFinite(a)&&Number.isFinite(o)&&o>a):[]}function Wd(n,e,t,i){let r=a=>(a[0]-e.a[0])*e.u[0]+(a[2]-e.a[1])*e.u[1],s=[];for(let a=0;a<n.length;a++){let o=n[a],l=n[(a+1)%n.length],c=r(o),d=r(l),u=i?c>=t:c<=t,h=i?d>=t:d<=t;if(u&&s.push(o),u!==h){let p=(t-c)/(d-c);s.push(o.map((f,b)=>f+(l[b]-f)*p))}}return s}function Dy(n,e,t){if(!t.length)return n;let i=t.slice().sort((a,o)=>a[0]-o[0]),r=[],s=0;for(let[a,o]of i)a>s&&r.push([s,Math.min(e.width,a)]),s=Math.max(s,o);return s<e.width&&r.push([s,e.width]),n.flatMap(a=>{let o=[];for(let l=0;l<a.triangles.length;l+=9){let c=[0,1,2].map(d=>a.triangles.slice(l+d*3,l+d*3+3));for(let[d,u]of r){let h=Wd(Wd(c,e,d,!0),e,u,!1);for(let p=1;p<h.length-1;p++)o.push(...h[0],...h[p],...h[p+1])}}return o.length?[{...a,triangles:o}]:[]})}function Zd(n,e,t,i,r,s={}){let a=i.filter(p=>p.renderBuildingId===n.id&&p.renderSurfaceIndices?.includes(t)&&p.facadeDescription),o=s.procedural?i:a,l=Py(n,e,t,s.observed===!1?o.filter(p=>!p.facadeDescription):o,r,s.reviewedAwnings,s.candidateRegistrationPreview===!0);if(!s.contextual)return l;let c=Or(e,n,r),d=new Set(l.map(p=>p.observationId).filter(p=>typeof p=="string")),u=i.filter(p=>a.includes(p)||d.has(p.id));if(!u.length)return l.length?l:Hd(n,e,t,r);let h=c?Dy(Hd(n,e,t,r),c,Iy(n,e,t,u)):[];return[...l,...h]}var Ly=128,Kd="Shop names are machine-read from dated panoramas \u2014 unreviewed",Fy=7.4,Ny=n=>!["rejected","uncertain","crop-repair"].includes(n?.review?.placement),Jd=(n,e)=>{let t=n?.images?.[e];return!!t&&/^[a-f0-9]{64}$/i.test(t.sha256??"")&&/^[a-f0-9]{64}$/i.test(t.panoramaSha256??"")},jd=n=>!Jd(n,"ground")||!["yes","no"].includes(n.effectiveProposal?.shopfront)?!1:n.review?.placement==="accepted"&&n.proposalSources?.shopfront==="human-review"?!0:n.visualReview?.fieldEligibility?.shopfront===!1?!1:n.visualReview?.fieldEligibility?.shopfront===!0||n.effectiveProposal?.groundUsable==="yes";function Uy(n){if(!n)return"missing-record";if(n.machineRevocation?.revoked)return"revoked-observation";if(!Ny(n))return"revoked-placement";if(!n.evidenceKey||!n.derivationKey)return"missing-source-identity";if(!Jd(n,"ground"))return"missing-current-ground-source";if(!n.images?.ground?.date&&!n.images?.ground?.capturedAt)return"missing-capture-date";if(n.effectiveProposal?.shopfront!=="yes")return"shopfront-not-positive";if(n.visualReview?.fieldEligibility?.shopfront===!1||n.visualReview?.fieldEligibility?.signText===!1)return"field-withheld";if(!jd(n))return"ground-source-not-supported";let e=n.machineRoutingProposal;if(!e)return"missing-machine-proposal";if(e.signTextEligible!=="yes")return"sign-text-not-eligible";let t=String(e.signText??"").trim();return t?/[\u0000-\u001f\u007f]/.test(t)?"control-character-sign-text":null:"empty-sign-text"}function Qd(n,e=28){let t=String(n??"").trim();return t.length<=e?t:`${t.slice(0,e-1)}\u2026`}function ef(n){return Uy(n)===null}function Oy(n,e){return Math.min(e-.3,Fy,Math.max(1.4,n.length*.24+.5))}var tf=(n,e,t,i)=>[n.a[0]+n.u[0]*e+n.n[0]*i,t,n.a[1]+n.u[1]*e+n.n[1]*i];function nf(n,e,t=1024,i="#25372e"){let r=n.canvas?.height||Ly;n.fillStyle=/^#[a-f0-9]{6}$/i.test(i)?i:"#25372e",n.fillRect(0,0,t,r),n.fillStyle="#e7e5d9",n.textAlign="center",n.textBaseline="middle";let s=r*.75;for(n.font=`700 ${s}px Arial`;n.measureText(e).width>t*.84&&s>r*.1875;)s-=1,n.font=`700 ${s}px Arial`;n.fillText(e,t/2,r*.53)}function By(n,e,t,i,r){if(!ef(n)||t.status==="conflict"||t.observation?.id!==n.id)return null;let s=Vs(e,i,t);if(!s||s.width<1.5||s.bottom>r+1.5)return null;let a=Math.min(2.35,3.5*.66),o=r+.55+a/2,l=o+a/2+.55/2+.05,c=Qd(String(n.machineRoutingProposal.signText).trim()),d=Oy(c,s.width),u=s.width/2;return nn(s,u,l,d,.55)?{observationId:n.id,text:c,displayText:c,localPosition:tf(s,u,l,.06),rotationY:Math.atan2(s.n[0],s.n[1]),width:d,height:.55,intervalWidth:s.width}:null}function rf(n,e,t,i,r){if(e.type!=="wall")return[];let s=Or(e,n,r);if(!s||s.top-s.bottom<2.5)return[];let a=i.filter(h=>h.renderBuildingId===n.id&&h.renderSurfaceIndices?.includes(t)&&h.facadeDescription);if(a.length){let h=[];for(let p of a){let f=$i(p,n,t,"ground");if(!f)continue;let b=wi(e,t,n.id,a.map(g=>({...g,effectiveProposal:{wholeUsable:"unknown"}})));for(let g of b.intervals){if(g.observation?.id!==p.id||g.status==="conflict")continue;let m=Vs(s,b.axis,g);if(!m)continue;let M=(m.a[0]-s.a[0])*s.u[0]+(m.a[1]-s.a[1])*s.u[1];for(let E of f.features){let v=Nr(E,f,p);!v||v.kind!=="fascia"||!v.text?.trim()||/[\u0000-\u001f\u007f]/.test(v.text)||!nn(m,v.t-M,v.y,v.width,v.height)||h.push({observationId:p.id,text:v.text.trim(),displayText:Qd(v.text),localPosition:tf(s,v.t,v.y,.09),rotationY:Math.atan2(s.n[0],s.n[1]),width:v.width,height:v.height,intervalWidth:m.width,physicalSignId:v.physicalSignId,colour:v.colour})}}}return h}let o=i.filter(h=>h.renderBuildingId===n.id&&ef(h)&&Array.isArray(h.renderSurfaceIndices)&&h.renderSurfaceIndices.includes(t));if(!o.length)return[];let l=n.geometry.building.surfaces.filter(h=>h.type==="wall").flatMap(h=>h.rings[0].map(p=>p[1])),c=Number.isFinite(n.geometry.building.groundNAP)?Si(n.geometry.building.groundNAP,n.geometry.frame.heightDatum):Math.min(...l),d=i.map(h=>({...h,effectiveProposal:jd(h)?{wholeUsable:"unknown"}:null})),u=wi(e,t,n.id,d);return u.axis?o.flatMap(h=>u.intervals.map(p=>By(h,s,p,u.axis,c)).filter(Boolean)):[]}function sf(n,e){let t=new Map;for(let i of n){let r=e.find(l=>l.id===i.observationId);if(!r)continue;let s=String(i.text??r.machineRoutingProposal?.signText??"").trim().toLocaleLowerCase("en"),a=JSON.stringify([r.images?.ground?.panoramaSha256??r.renderBuildingId,s,r.images?.ground?.date??r.images?.ground?.capturedAt,i.physicalSignId??null]),o=t.get(a);(!o||i.width>o.width||i.width===o.width&&i.observationId<o.observationId)&&t.set(a,i)}return[...t.values()]}function af(n,e={}){if(!e.text?.trim())throw new Error("Source sign text is required");if(typeof document>"u")throw new Error("Facade sign material requires a browser canvas");let t=Math.min(e.width??512,512),i=Number.isFinite(e.aspectRatio)&&(e.aspectRatio??0)>0?e.aspectRatio:null,r=i?Math.max(8,Math.min(128,Math.round(t/i))):Math.min(e.height??128,128),s=document.createElement("canvas");s.width=t,s.height=r;let a=s.getContext("2d");if(!a)throw new Error("Unable to create sign canvas");a.fillStyle=e.background??"#242628",a.fillRect(0,0,t,r),a.fillStyle=e.colour??"#f3eee4";let o=e.font??`italic 700 ${Math.round(r*.45)}px Georgia, serif`,l=o.match(/(\d+(?:\.\d+)?)px/),c=Math.min(l?Number(l[1]):r*.45,r*.8),d=p=>l?o.replace(/\d+(?:\.\d+)?px/,`${Math.max(1,Math.round(p))}px`):`italic 700 ${Math.max(1,Math.round(p))}px Georgia, serif`;for(a.font=d(c);c>1&&a.measureText(e.text.trim()).width>t*.9;)c*=.9,a.font=d(c);a.textAlign="center",a.textBaseline="middle",a.fillText(e.text.trim(),t/2,r/2);let u=new n.CanvasTexture(s);return u.colorSpace=n.SRGBColorSpace??u.colorSpace,u.needsUpdate=!0,{material:new n.MeshBasicMaterial({map:u,transparent:!0,side:n.DoubleSide}),texture:u,canvas:s}}var $s={priorBrickRed:"#a4523b",priorBrickBrown:"#84503a",priorBrickDark:"#6a3b2e",priorBrickBuff:"#c49a5c",priorPlaster:"#d3c3a0",priorModernLight:"#c2bdb2",priorModernGrey:"#7a8a94",priorCanalGreen:"#557260",roof:"#7c8080",priorRoofWarm:"#9a5e48",priorRoofDark:"#56606a",priorRoofGravel:"#a59e8f"};function cl(n,e){let t=2166136261;for(let i of n)t^=i.charCodeAt(0),t=Math.imul(t,16777619);return e[(t>>>0)%e.length]}function of(n,e){let t=Number(e),i=Number.isFinite(t)&&t<1925?cl(n,["priorBrickRed","priorBrickBrown","priorBrickDark","priorBrickBuff","priorPlaster","priorCanalGreen"]):Number.isFinite(t)&&t<1965?cl(n,["priorBrickRed","priorBrickBrown","priorBrickBuff","priorModernGrey"]):cl(n,["priorBrickBuff","priorModernLight","priorModernGrey","priorPlaster"]),r=cl(n,["roof","priorRoofWarm","priorRoofDark","priorRoofGravel"]),s=i;return{wallKey:i,roofKey:r,groundKey:s,wall:$s[i],roof:$s[r],ground:$s[s]}}var ky={wall:"#c4c1b5",...$s,brown:"#876650",red:"#945c48",buff:"#bba681",grey:"#96938a",white:"#d8d4c3",black:"#57544e",auditedUsable:"#638774",auditedPartial:"#bd875b",...ol};function zy(n,e,t){let i=e.previewAppearance;return!t||!n.geometryRevision.startsWith("candidate:")||i?.disposition!=="inferred-preview"||!/^#[a-f0-9]{6}$/i.test(i.colour)||!/^[a-f0-9]{64}$/.test(i.sourceCropSha256)?null:n.observations.some(s=>Object.values(s.payload?.facadeDescription?.sources??{}).some(a=>a.cropSha256===i.sourceCropSha256))?i.colour:null}function Vy(n){if(!Number.isFinite(n))throw new Error("Invalid vertex normal");let e=Math.max(-1,Math.min(1,n));return e<=-1?-128:Math.round(e*127)}function Gy(n){let e=n.getAttribute?.("normal");if(!e)return;let t=new Int8Array(e.count*e.itemSize);for(let i=0;i<t.length;i++)t[i]=Vy(e.array[i]);n.setAttribute("normal",new ss(t,e.itemSize,!0))}function kr(n){let e=n.map(c=>{if(!c.every(d=>d.length===3&&d.every(Number.isFinite)))throw new Error("Invalid source surface coordinate");return c.length>2&&c[0].every((d,u)=>Math.abs(d-c[c.length-1][u])<1e-8)?c.slice(0,-1):c.slice()});if(!e[0]||e[0].length<3)return[];if(e.slice(1).some(c=>c.length<3))throw new Error("Degenerate source hole");let t=e[0],i=new k;for(let c=0;c<t.length;c++){let d=t[c],u=t[(c+1)%t.length];i.x+=(d[1]-u[1])*(d[2]+u[2]),i.y+=(d[2]-u[2])*(d[0]+u[0]),i.z+=(d[0]-u[0])*(d[1]+u[1])}if(i.lengthSq()<1e-16)return[];let r=[Math.abs(i.x),Math.abs(i.y),Math.abs(i.z)],s=r.indexOf(Math.max(...r)),a=c=>new Le(...c.filter((d,u)=>u!==s)),o=e.flat();return Gi.triangulateShape(e[0].map(a),e.slice(1).map(c=>c.map(a))).flatMap(c=>{let[d,u,h]=c.map(f=>new k(...o[f]));return(u.sub(d).cross(h.sub(d)).dot(i)>=0?c:[c[0],c[2],c[1]]).flatMap(f=>o[f])})}function lf(n){let e=n.geometry.building,t=e.surfaces.flatMap(o=>o.rings.flatMap(l=>l.map(c=>c[1]))),i=t.length?Math.min(...t):Si(e.groundNAP??.65,n.geometry.frame.heightDatum),r=t.length?Math.max(...t):i+(e.height??5),s=e.footprint.type==="Polygon"?[e.footprint.coordinates]:e.footprint.coordinates,a=[];for(let o of s){let l=o.map((c,d)=>{let u=c.slice(0,-1).reduce((h,p,f)=>h+p[0]*c[f+1][1]-c[f+1][0]*p[1],0);return(d===0?u>0:u<0)?[...c].reverse():c});a.push({type:"roof",rings:l.map(c=>c.map(([d,u])=>[d,r,u]))});for(let c of l)for(let d=0;d<c.length-1;d++){let u=c[d],h=c[d+1];a.push({type:"wall",rings:[[[u[0],i,u[1]],[h[0],i,h[1]],[h[0],r,h[1]],[u[0],r,u[1]]]]})}}return a}function Br(n,e,t){let i=e.geometry.frame.originRD,r=t.targetOriginRD,s=al(0,e.geometry.frame.heightDatum,t.targetOffsetNAP??0);return n.map((a,o)=>o%3===0?a+i.x-r.x:o%3===1?a+s:a+r.y-i.y)}function Hy(n,e,t){let i=e.geometry.frame.originRD,r=t.targetOriginRD,s=al(0,e.geometry.frame.heightDatum,t.targetOffsetNAP??0);return[n[0]+i.x-r.x,n[1]+s,n[2]+r.y-i.y]}var Wy=new Hi(1,1);function Xy(n,e,t){let i=document.createElement("canvas");i.width=Math.min(512,Math.ceil(64*n.width/n.height)),i.height=64,nf(i.getContext("2d"),n.displayText,i.width,n.colour);let r=new Mr(i);r.colorSpace=Bt,r.generateMipmaps=!1,r.minFilter=Lt;let s=new Jn({map:r,side:Mn}),a=new gt(Wy,s);return a.scale.set(n.width,n.height,1),a.position.set(...Hy(n.localPosition,e,t)),a.rotation.y=n.rotationY,a.userData.machineSign=!0,a.userData.observationId=n.observationId,a.userData.featureKind="machine-sign-unreviewed",a.name="city-appearance-machine-sign",a}function cf(n){n.material?.map?.dispose?.(),n.material?.dispose?.()}function qy(n){return n.flatMap(e=>e.observations.filter(t=>t.buildingId===e.id&&t.geometryRevision===e.geometryRevision&&t.evidenceKey&&t.payload?.evidenceKey===t.evidenceKey&&t.payload?.renderBuildingId===e.id&&t.payload?.effectiveProposal?.wholeUsable==="yes"&&t.payload?.visualReview?.fieldEligibility?.wallColour!==!1).map(t=>t.payload))}function $y(n){return n.flatMap(e=>e.observations.filter(t=>t.buildingId===e.id&&t.geometryRevision===e.geometryRevision&&t.evidenceKey&&t.payload?.evidenceKey===t.evidenceKey&&t.payload?.renderBuildingId===e.id&&["usable","partial"].includes(t.payload?.agentSourceAudit?.disposition)).map(t=>t.payload))}function uf(n,e){let t=of(n.id,n.geometry.building.year);return e==="roof"?t.roofKey:t.wallKey}function hf(n){if(![n.targetOriginRD.x,n.targetOriginRD.y,n.targetOffsetNAP??0].every(Number.isFinite))throw new Error("Invalid target RD/NAP origin");return e=>{let t=new Set;for(let T of e){let R=T.geometry?.frame;if(t.has(T.id)||T.geometry?.building?.id!==T.id||!R||R.axes!=="x=east,y=up,z=south"||!["legacy-block-NAP-minus-0.65m","NAP"].includes(R.heightDatum)||![R.originRD.x,R.originRD.y].every(Number.isFinite))throw new Error(`Unsupported or duplicate source frame: ${T.id}`);t.add(T.id)}let i=new Zt;i.name="city-appearance-owned-tile",i.userData.buildingIds=[...t],i.userData.experimentalWallColours=n.experimentalWallColours===!0,i.userData.proceduralFacades=n.proceduralFacades===!0,i.userData.facadeStyleSource="Registered source features retain per-feature evidence disposition; legacy and contextual rhythms remain explicit procedural priors.";let r=new Map,s=new Map(e.map(T=>[T.id,"facade"])),a=new Map,o=new Map,l=n.experimentalWallColours?qy(e):n.auditCoverage?$y(e):[],c=n.proceduralFacades||n.observedFacades!==!1?ll(e):[],d=n.machineSigns===!0?ll(e):[],u=new Zt;u.name="city-appearance-machine-signs";let h=[],p=n.machineSigns===!0,f=!1,b=!1,g=(T,R,I=!1,N=null)=>({buildingId:T.id,geometryRevision:T.geometryRevision,sourceSurfaceIndex:R,observationId:N,approximateMassing:I});for(let T of e){let R=!T.geometry.building.surfaces.length,I=R?lf(T):T.geometry.building.surfaces,N=[],U=[];I.forEach((D,G)=>{let K=kr(D.rings),Q=zy(T,D,n.candidateRegistrationPreview===!0),ne=Q??(n.contextualPalette?uf(T,D.type):D.type==="roof"?"roof":"wall"),le={triangles:Br(K,T,n),colour:ne,identity:{...g(T,R?null:G,R),...Q?{previewOnly:!0,styleSource:"inferred-source-component-preview"}:{}}};N.push(le);let Ue=!R&&D.type==="wall"&&(n.experimentalWallColours||n.auditCoverage)?wi(D,G,T.id,l):null;if(!Ue?.axis){U.push(le);return}for(let He of Ue.intervals){let Re=He.observation?.effectiveProposal?.wallColour,Y=He.observation?.agentSourceAudit?.disposition,W=n.auditCoverage&&Y==="usable"?"auditedUsable":n.auditCoverage&&Y==="partial"?"auditedPartial":["brown","red","buff","grey","white","black"].includes(Re)?Re:null;U.push({triangles:Br(Id(K,Ue.axis,He.startM,He.endM),T,n),colour:W??ne,identity:g(T,G,!1,W?He.observation.id:null)})}});let F=n.experimentalWallColours||n.auditCoverage?U.slice():N.slice();o.set(T.id,N.flatMap(D=>D.triangles)),(n.proceduralFacades||n.contextualFacades||n.observedFacades!==!1)&&!R&&I.forEach((D,G)=>{let K=Zd(T,D,G,c,e,{procedural:n.proceduralFacades,contextual:n.contextualFacades,reviewedAwnings:n.reviewedAwnings,observed:n.observedFacades,candidateRegistrationPreview:n.candidateRegistrationPreview===!0});for(let Q of K){let ne=Q.sign,le=ne&&ne.text&&ne.physicalSignId&&Array.isArray(ne.uv)?{sign:ne}:{};Q.featureKind.startsWith("observed-")&&(Q.featureKind==="observed-material"||Q.featureKind==="observed-awning"&&!ne||Q.colour==="doorWood"||Q.colour==="windowGlass")&&F.push({triangles:Br(Q.triangles,T,n),colour:Q.colour,identity:{...g(T,G,!1,Q.observationId),featureId:Q.featureId,featureKind:Q.featureKind,styleSource:Q.styleSource}}),U.push({triangles:Br(Q.triangles,T,n),colour:Q.colour,material:Q.material,...le,identity:{...g(T,G,!1,Q.observationId),featureId:Q.featureId,featureKind:Q.featureKind,styleSource:Q.styleSource,...Q.previewOnly?{previewOnly:!0}:{}}}),le.sign&&F.push({triangles:Br(Q.triangles,T,n),colour:Q.colour,sign:le.sign,identity:{...g(T,G,!1,Q.observationId),featureId:Q.featureId,featureKind:Q.featureKind,styleSource:Q.styleSource}})}}),d.length&&!R&&I.forEach((D,G)=>{for(let K of rf(T,D,G,d,e))h.push({owner:T,placement:K})});let O=lf(T).map(D=>({triangles:Br(kr(D.rings),T,n),colour:n.contextualPalette?uf(T,D.type):D.type==="roof"?"roof":"wall",identity:g(T,null,!0)}));a.set(T.id,{facade:F,detail:U,massing:O})}let m=sf(h.map(T=>({...T.placement,item:T})),d);h.splice(0,h.length,...m.map(T=>T.item));let M=new Jn({color:"#f2c14e",transparent:!0,opacity:.24,depthWrite:!1,side:Pt,polygonOffset:!0,polygonOffsetFactor:-2}),E=new Map,v=null,C=null;function S(){let T=new Map(h.map((R,I)=>[String(I),R]).filter(([,R])=>p&&!f&&s.get(R.owner.id)==="detail"));for(let R of[...u.children]){let I=R.userData.placementKey;if(T.has(I)){T.delete(I);continue}u.remove(R),cf(R)}for(let[R,{owner:I,placement:N}]of T){let U=Xy(N,I,n);U.userData.placementKey=R,u.add(U)}}n.machineSigns===!0&&(i.add(u),u.visible=p,S());function _(){C&&(i.remove(C),C.geometry.dispose(),C=null);let T=v?o.get(v):null;if(!T?.length||f)return;let R=new Ct;R.setAttribute("position",new ut(T,3)),R.computeBoundingBox(),R.computeBoundingSphere(),C=new gt(R,M),C.name="city-appearance-selection",C.renderOrder=6,C.userData.runtimeSelection=!0,C.raycast=()=>{},i.add(C)}function x(){if(b=!1,f)return;let T=new Map,R=new Map;for(let N of e)for(let U of a.get(N.id)[s.get(N.id)]){if(!U.triangles.length)continue;if(U.sign){let D=`${U.sign.physicalSignId}:${U.sign.text}:${U.sign.background}:${U.sign.colour}:${U.sign.font??""}`,G=R.get(D)??{descriptor:U.sign,positions:[],uvs:[],identities:[]};G.positions.push(...U.triangles),G.uvs.push(...U.sign.uv);for(let K=0;K<U.triangles.length/9;K++)G.identities.push(U.identity);R.set(D,G);continue}let F=`${U.material??"flat"}:${U.colour}`,O=T.get(F)??{colour:U.colour,material:U.material,positions:[],identities:[]};for(let D of U.triangles)O.positions.push(D);for(let D=0;D<U.triangles.length/9;D++)O.identities.push(U.identity);T.set(F,O)}let I=[];for(let[N,U]of T){let F=U.colour;if(!r.has(N)){let G=F.startsWith("#")?F:ky[F];r.set(N,U.material==="brick"?Cd({MeshStandardMaterial:wn,DoubleSide:Pt},G):new wn({color:G,roughness:.9,side:Pt}))}let O=new Ct;O.setAttribute("position",new ut(U.positions,3)),O.computeVertexNormals(),Gy(O),O.computeBoundingBox(),O.computeBoundingSphere();let D=new gt(O,r.get(N));D.name=`city-appearance-${F}`,D.userData.triangleIdentities=U.identities,D.castShadow=n.castShadows!==!1,D.receiveShadow=!1,I.push(D)}for(let[N,U]of R){let F=E.get(N);F||(F=af({CanvasTexture:Mr,MeshBasicMaterial:Jn,DoubleSide:Pt,SRGBColorSpace:Bt},U.descriptor),E.set(N,F));let O=new Ct;O.setAttribute("position",new ut(U.positions,3)),O.setAttribute("uv",new ut(U.uvs,2));let D=new gt(O,F.material);D.name=`city-appearance-source-sign-${U.descriptor.physicalSignId}`,D.userData.triangleIdentities=U.identities,D.userData.sourceSign=!0,I.push(D)}for(let N of[...i.children])N!==C&&N!==u&&N instanceof gt&&(i.remove(N),N.geometry.dispose(),N.userData.sourceSign);for(let N of I)i.add(N);for(let[N,U]of E)R.has(N)||(U.material.dispose(),U.texture.dispose(),E.delete(N));_(),S()}let A={group:i,flush:x,setSelected(T){if(!f){if(T!==null&&!t.has(T)){v=null,_();return}v!==T&&(v=T,_())}},setLod(T,R){if(!f){if(!t.has(T)||!["massing","facade","detail"].includes(R))throw new Error(`Unknown building or LOD: ${T}`);s.get(T)!==R&&(s.set(T,R),b||(b=!0,queueMicrotask(()=>{b&&x()})))}},setMachineSignsVisible(T){f||p===T||(p=T,T&&!u.parent&&(i.add(u),S()),u.visible=T,S())},pick(T,R){return f||!i.children.includes(T)||!Number.isInteger(R)||R<0?null:T.userData.triangleIdentities?.[R]??null},get stats(){let T=new Map,R=new Set;for(let G of i.children)for(let K of G.userData.triangleIdentities??[])K.featureId&&K.featureKind&&T.set(K.featureId,K.featureKind),K.featureKind==="shopfront-prior"&&K.observationId&&R.add(K.observationId);let I=G=>[...T.values()].filter(K=>K===G).length,N=i.children.flatMap(G=>G===u&&u.parent?G.children:[G]).filter(G=>G.isMesh&&!G.userData.runtimeSelection),U=new Set,F=new Set;for(let G of N){for(let K of Object.values(G.geometry.attributes)){let Q=K.array??K.data?.array;Q?.buffer&&U.add(Q.buffer)}G.geometry.index?.array?.buffer&&U.add(G.geometry.index.array.buffer);for(let K of Array.isArray(G.material)?G.material:[G.material])for(let Q of Object.values(K??{}))Q?.isTexture&&F.add(Q)}let O=[...U].reduce((G,K)=>G+K.byteLength,0),D=[...F].reduce((G,K)=>{let Q=K.image;return G+Math.ceil((Q?.width??0)*(Q?.height??0)*4*(K.generateMipmaps?4/3:1))},0);return{geometryBufferBytes:O,textureBytes:D,buildings:t.size,meshes:N.length,triangles:N.reduce((G,K)=>G+K.geometry.getAttribute("position").count/3,0),windows:I("window-prior")+I("contextual-window-prior")+I("observed-window"),doors:I("contextual-door-prior")+I("observed-door"),storefronts:R.size,storefrontPatches:I("shopfront-prior"),awnings:I("reviewed-awning-prior")+I("observed-awning"),signs:I("observed-sign"),machineSigns:u.children.length,disposed:f}},dispose(){if(!f){f=!0,n.parent.remove(i);for(let T of[...u.children])u.remove(T),cf(T);for(let T of[...i.children])i.remove(T),T!==u&&T instanceof gt&&T.geometry.dispose();for(let T of r.values())T.dispose();for(let{material:T,texture:R}of E.values())R.dispose(),T.dispose();C=null,M.dispose(),r.clear(),a.clear(),o.clear(),s.clear()}}};return x(),n.parent.add(i),A}}var Yy="inventory-crown-priors/v2",Zy={"prunus cerasifera 'nigra'":{colour:"#694653",reference:"https://www.vdberk.com/trees/prunus-cerasifera-nigra/"},"fagus sylvatica 'atropunicea'":{colour:"#765247",reference:"https://www.vdberk.com/trees/fagus-sylvatica-atropunicea/"}},se=n=>"https://www.vdberk.com/trees/"+n+"/",Ky=[[/^salix alba 'liempde'$/,"pyramidal","cultivar-prior",se("salix-alba-liempde")],[/^alnus glutinosa 'laciniata'$/,"pyramidal","cultivar-prior",se("alnus-glutinosa-laciniata")],[/^amelanchier lamarckii$/,"vase","species-prior",se("amelanchier-lamarckii")],[/^gleditsia triacanthos 'sunburst'$/,"pyramidal","cultivar-prior",se("gleditsia-triacanthos-sunburst")],[/^ulmus 'sapporo autumn gold'$/,"vase","cultivar-prior",se("ulmus-sapporo-autumn-gold")],[/^fraxinus angustifolia 'raywood'$/,"airy-oval","cultivar-prior",se("fraxinus-angustifolia-raywood")],[/^tilia europaea 'koningslinde'$/,"pyramidal","cultivar-prior","https://www.udenhout-trees.nl/en/assortment/tilia-europaea-pallida/"],[/^ulmus hollandica 'belgica'$/,"upright-oval","cultivar-prior","https://www.ebben.nl/en/treeebb/ulhbelgi-ulmus-x-hollandica-belgica/"],[/^ulmus laevis$/,"airy-oval","species-prior",se("ulmus-laevis")],[/^fraxinus excelsior 'atlas'$/,"pyramidal","cultivar-prior",se("fraxinus-excelsior-atlas")],[/^fraxinus angustifolia$/,"airy-oval","species-prior",se("fraxinus-angustifolia")],[/^betula nigra$/,"irregular-spreading","species-prior",se("betula-nigra")],[/^acer saccharinum$/,"irregular-spreading","species-prior",se("acer-saccharinum")],[/^ailanthus altissima$/,"irregular-spreading","species-prior","https://mdc.mo.gov/discover-nature/field-guide/tree-heaven"],[/^liriodendron tulipifera$/,"upright-oval","species-prior",se("liriodendron-tulipifera")],[/^alnus spaethii$/,"pyramidal","species-prior","https://www.rhs.org.uk/plants/91790/alnus-%C3%97-spaethii/details"],[/^gleditsia triacanthos$/,"airy-oval","species-prior",se("gleditsia-triacanthos")],[/^gleditsia triacanthos 'inermis'$/,"airy-oval","species-prior",se("gleditsia-triacanthos-f-inermis")],[/^gleditsia triacanthos 'skyline'$/,"pyramidal","cultivar-prior",se("gleditsia-triacanthos-skyline")],[/^ilex aquifolium$/,"upright-oval","species-prior",se("ilex-aquifolium")],[/^tilia cordata 'greenspire'$/,"upright-oval","cultivar-prior",se("tilia-cordata-greenspire")],[/^prunus 'umineko'$/,"columnar","cultivar-prior",se("prunus-umineko")],[/^prunus subhirtella 'autumnalis'$/,"vase","cultivar-prior",se("prunus-subhirtella-autumnalis")],[/^prunus yedoensis$/,"vase","species-prior",se("prunus-yedoensis")],[/^acer freemanii 'elegant'$/,"vase","cultivar-prior",se("acer-freemanii-elegant")],[/^populus canescens 'de moffart'$/,"pyramidal","cultivar-prior",se("populus-canescens-de-moffart")],[/^liquidambar styraciflua 'worplesdon'$/,"pyramidal","cultivar-prior",se("liquidambar-styraciflua-worplesdon")],[/^alnus spaethii 'spaeth'$/,"pyramidal","cultivar-prior",se("alnus-spaethii-spaeth")],[/^quercus robur 'fastigiate koster'$/,"columnar","cultivar-prior",se("quercus-robur-fastigiate-koster")],[/^prunus serrulata 'amanogawa'$/,"columnar","cultivar-prior",se("prunus-serrulata-amanogawa")],[/^betula utilis 'doorenbos'$/,"upright-oval","cultivar-prior",se("betula-utilis-doorenbos")],[/^alnus incana$/,"upright-oval","species-prior",se("alnus-incana")],[/^ilex aquifolium 'j.c. van tol'$/,"upright-oval","cultivar-prior",se("ilex-aquifolium-j-c-van-tol")],[/^sequoiadendron giganteum$/,"conical-evergreen","species-prior",se("sequoiadendron-giganteum")],[/^sequoia sempervirens$/,"conical-evergreen","species-prior",se("sequoia-sempervirens")],[/^abies grandis$/,"conical-evergreen","species-prior",se("abies-grandis")],[/^abies nordmanniana$/,"conical-evergreen","species-prior",se("abies-nordmanniana")],[/^picea orientalis$/,"conical-evergreen","species-prior",se("picea-orientalis")],[/^trachycarpus fortunei$/,"fan-palm","species-prior","https://plants.ces.ncsu.edu/plants/trachycarpus-fortunei/"],[/^acer platanoides 'globosum'$/,"globose","cultivar-prior",se("acer-platanoides-globosum")],[/^robinia pseudoacacia 'umbraculifera'$/,"globose","cultivar-prior",se("robinia-pseudoacacia-umbraculifera")],[/^catalpa bignonioides 'nana'$/,"globose","cultivar-prior",se("catalpa-bignonioides-nana")],[/^ulmus hollandica 'commelin'$/,"upright-oval","cultivar-prior","https://www.ebben.nl/en/treeebb/ulhcomme-ulmus-x-hollandica-commelin/"],[/^quercus cerris$/,"rounded","species-prior",se("quercus-cerris")],[/^ulmus 'plantijn'$/,"vase","cultivar-prior","https://www.vdberk.co.uk/trees/ulmus-plantijn/"],[/^styphnolobium japonicum$/,"domed","species-prior","https://plants.ces.ncsu.edu/plants/styphnolobium-japonicum/"],[/^taxus baccata$/,"irregular-spreading","species-prior",se("taxus-baccata")],[/^pinus nigra$/,"domed","species-prior","https://plants.ces.ncsu.edu/plants/pinus-nigra/"],[/^prunus avium 'plena'$/,"rounded","cultivar-prior",se("prunus-avium-plena")],[/^acer platanoides$/,"domed","species-prior",se("acer-platanoides")],[/^tilia europaea 'zwarte linde'$/,"domed","cultivar-prior",se("tilia-europaea-zwarte-linde")],[/^ulmus 'rebona'$/,"upright-oval","cultivar-prior","https://resista-ulmen.com/en/varieties/rebona/"],[/^ulmus minor 'sarniensis'$/,"pyramidal","cultivar-prior",se("ulmus-minor-sarniensis")],[/^prunus avium$/,"domed","species-prior",se("prunus-avium")],[/^acer pseudoplatanus 'negenia'$/,"pyramidal","cultivar-prior",se("acer-pseudoplatanus-negenia")],[/^tilia tomentosa$/,"domed","species-prior",se("tilia-tomentosa")],[/^corylus colurna$/,"pyramidal","species-prior",se("corylus-colurna")],[/^acer campestre 'elsrijk'$/,"upright-oval","cultivar-prior",se("acer-campestre-elsrijk")],[/^taxodium distichum$/,"conical-deciduous","species-prior",se("taxodium-distichum")],[/^larix decidua$/,"conical-deciduous","species-prior",se("larix-decidua")],[/^larix kaempferi$/,"conical-deciduous","species-prior",se("larix-kaempferi")],[/^thuja plicata$/,"conical-evergreen","species-prior",se("thuja-plicata")],[/^thuja occidentalis$/,"conical-evergreen","species-prior",se("thuja-occidentalis")],[/^chamaecyparis lawsoniana$/,"conical-evergreen","species-prior",se("chamaecyparis-lawsoniana")],[/^picea omorika$/,"conical-evergreen","species-prior",se("picea-omorika")],[/^salix babylonica$/,"weeping","species-prior",se("salix-babylonica")],[/^taxus baccata 'fastigiata'$/,"columnar","cultivar-prior",se("taxus-baccata-fastigiata")],[/^betula pubescens$/,"upright-oval","species-prior",se("betula-pubescens")],[/^alnus cordata$/,"pyramidal","species-prior",se("alnus-cordata")],[/^quercus palustris$/,"pyramidal","species-prior",se("quercus-palustris")],[/^populus canescens$/,"irregular-spreading","species-prior",se("populus-canescens")],[/^populus canadensis 'robusta'$/,"pyramidal","cultivar-prior",se("populus-canadensis-robusta")],[/^fraxinus excelsior 'westhof's glorie'$/,"airy-oval","cultivar-prior",se("fraxinus-excelsior-westhof-s-glorie")],[/^tilia europaea 'pallida'$/,"pyramidal","cultivar-prior",se("tilia-europaea-pallida")],[/^tilia europaea 'euchlora'$/,"domed","cultivar-prior",se("tilia-europaea-euchlora")],[/^tilia tomentosa 'brabant'$/,"pyramidal","cultivar-prior",se("tilia-tomentosa-brabant")],[/^carpinus betulus 'fastigiata'$/,"pyramidal","cultivar-prior",se("carpinus-betulus-fastigiata")],[/^carpinus betulus 'frans fontaine'$/,"columnar","cultivar-prior",se("carpinus-betulus-frans-fontaine")],[/^ulmus 'lobel'$/,"pyramidal","cultivar-prior",se("ulmus-lobel")],[/^liquidambar styraciflua$/,"pyramidal","species-prior",se("liquidambar-styraciflua")],[/^pinus sylvestris$/,"irregular-spreading","species-prior",se("pinus-sylvestris")],[/^quercus robur$/,"irregular-spreading","species-prior",se("quercus-robur")],[/^fraxinus excelsior$/,"airy-oval","species-prior",se("fraxinus-excelsior")],[/^salix alba$/,"upright-oval","species-prior",se("salix-alba")],[/^acer campestre$/,"rounded","species-prior",se("acer-campestre")],[/^alnus glutinosa$/,"pyramidal","species-prior",se("alnus-glutinosa")],[/^ulmus minor$/,"upright-oval","species-prior",se("ulmus-minor")],[/^tilia europaea$/,"domed","species-prior",se("tilia-europaea")],[/^tilia cordata$/,"domed","species-prior",se("tilia-cordata")],[/^tilia americana$/,"domed","species-prior",se("tilia-americana")],[/^tilia platyphyllos$/,"domed","species-prior",se("tilia-platyphyllos")],[/^acer pseudoplatanus$/,"domed","species-prior",se("acer-pseudoplatanus")],[/^carpinus betulus$/,"domed","species-prior",se("carpinus-betulus")],[/^crataegus monogyna$/,"rounded","species-prior",se("crataegus-monogyna")],[/^fagus sylvatica$/,"domed","species-prior",se("fagus-sylvatica")],[/^metasequoia glyptostroboides$/,"conical-deciduous","species-prior",se("metasequoia-glyptostroboides")],[/^pterocarya fraxinifolia$/,"irregular-spreading","species-prior",se("pterocarya-fraxinifolia")],[/^aesculus hippocastanum$/,"domed","species-prior",se("aesculus-hippocastanum")],[/^aesculus hippocastanum 'baumannii'$/,"domed","cultivar-prior",se("aesculus-hippocastanum-baumannii")],[/^ulmus 'columella'$/,"columnar","cultivar-prior",se("ulmus-columella")],[/^pyrus calleryana 'chanticleer'$/,"pyramidal","cultivar-prior",se("pyrus-calleryana-chanticleer")],[/^robinia pseudoacacia 'bessoniana'$/,"airy-oval","cultivar-prior",se("robinia-pseudoacacia-bessoniana")],[/^robinia pseudoacacia$/,"airy-oval","species-prior",se("robinia-pseudoacacia")],[/^platanus (?:hispanica|acerifolia) 'tremonia'$/,"pyramidal","cultivar-prior",se("platanus-hispanica-tremonia")],[/^platanus (?:hispanica|acerifolia)$/,"rounded","species-prior",se("platanus-hispanica")],[/^ulmus 'new horizon'$/,"pyramidal","cultivar-prior",se("ulmus-new-horizon")],[/^ulmus 'dodoens'$/,"pyramidal","cultivar-prior","https://www.vdberk.nl/bomen/Ulmus-Dodoens/"],[/^ulmus hollandica 'vegeta'$/,"pyramidal","cultivar-prior",se("ulmus-hollandica-vegeta")],[/^ulmus 'clusius'$/,"upright-oval","cultivar-prior",se("ulmus-clusius")],[/^ulmus glabra$/,"upright-oval","species-prior",se("ulmus-glabra")],[/^ginkgo biloba$/,"upright-oval","species-prior","https://www.rhs.org.uk/plants/7990/ginkgo-biloba/details"],[/^(?:cupressocyparis|cuprocyparis|cupressus) leylandii$/,"conical-evergreen","species-prior","https://www.rhs.org.uk/plants/321515/cupressus-%C3%97-leylandii/details"],[/^prunus serrulata 'kanzan'$/,"vase","cultivar-prior",se("prunus-serrulata-kanzan")],[/^betula pendula$/,"upright-oval","species-prior",se("betula-pendula")],[/^populus nigra 'italica'$/,"columnar","cultivar-prior",se("populus-nigra-italica")],[/^picea abies$/,"conical-evergreen","species-prior",se("picea-abies")],[/^salix sepulcralis 'chrysocoma'$/,"weeping","cultivar-prior",se("salix-sepulcralis-chrysocoma")]];function Jy(n){return String(n||"").toLowerCase().replace(/[’‘`]/g,"'").replace(/×/g," ").replace(/\bx\s+/g,"").replace(/\s+/g," ").trim()}function df(n){let e=2166136261;for(let t of String(n??""))e=Math.imul(e^t.charCodeAt(0),16777619);return(e>>>0)/4294967296}function ff(n){let e=String(n.type||"").trim().toLowerCase();if(e==="stobbe")return null;let t=Jy(n.species),i=Ky.find(([v])=>v.test(t)),r={"gekandelaberde boom":"candelabra-pruned",knotboom:"pollarded",leiboom:"trained-flat"}[e],s=!!r,a=r||i?.[1]||"rounded",o=Number.isFinite(n.height)&&n.height>0&&n.height<=60,l=o?n.height:9,c=/\d/.test(String(n.heightClass||"")),d=o&&n.source==="osm"?"osm-recorded-height":o&&c?"inventory-height-class-proxy":"authored-height-fallback",u=l,h=Math.max(1.3,u*.22),p=.96+df(n.id)*.04,f=h*p,b=(v,C,S,_,x,A,T)=>({offset:[v,C,S],scale:[_,x,A],tone:T}),g;if(a==="fan-palm"){let v=Math.min(f,1.2);g=Array.from({length:7},(C,S)=>{let _=S*Math.PI*2/7;return{...b(Math.cos(_)*v*.65,u*.95,Math.sin(_)*v*.65,v*.8,u*.05,v*.3,S%3),rotation:_}})}else a==="globose"?g=[b(0,u*.85,0,f*1.6,u*.15,f*1.5,0),b(-f*.65,u*.82,f*.1,f*1.05,u*.12,f*1.05,1),b(f*.65,u*.82,-f*.1,f*1.05,u*.12,f*1.05,2)]:a==="pyramidal"?g=[b(0,u*.65,0,f*.84,u*.19,f*.78,2),b(0,u*.8,0,f*.62,u*.16,f*.59,0),b(0,u*.9,0,f*.34,u*.1,f*.34,1)]:a==="upright-oval"?g=[b(0,u*.73,0,f*.8,u*.27,f*.72,0),b(-f*.28,u*.68,f*.14,f*.51,u*.22,f*.48,1),b(f*.25,u*.65,-f*.12,f*.5,u*.23,f*.48,2)]:a==="conical-evergreen"||a==="conical-deciduous"?g=[b(0,u*.55,0,f*.7,u*.24,f*.7,2),b(0,u*.74,0,f*.49,u*.19,f*.49,0),b(0,u*.9,0,f*.25,u*.1,f*.25,1)]:a==="vase"?g=[b(0,u*.65,0,f*.6,u*.19,f*.58,2),b(-f*.4,u*.84,0,f*.7,u*.16,f*.75,0),b(f*.4,u*.84,0,f*.7,u*.16,f*.75,1)]:a==="candelabra-pruned"?g=[b(0,u*.85,0,f*.43,u*.15,f*.5,0),b(-f*.5,u*.82,0,f*.36,u*.14,f*.4,1),b(f*.5,u*.82,0,f*.36,u*.14,f*.4,2)]:a==="pollarded"?g=[b(0,u*.83,0,f*.62,u*.17,f*.6,0),b(-f*.35,u*.79,0,f*.44,u*.17,f*.44,1),b(f*.35,u*.79,0,f*.44,u*.17,f*.44,2)]:a==="trained-flat"?g=[b(0,u*.8,0,f*.55,u*.2,f*.18,0),b(-f*.52,u*.76,0,f*.4,u*.18,f*.18,1),b(f*.52,u*.76,0,f*.4,u*.18,f*.18,2)]:a==="columnar"?g=[b(0,u*.59,0,f*.39,u*.3,f*.36,2),b(0,u*.77,0,f*.32,u*.23,f*.31,0),b(0,u*.91,0,f*.18,u*.09,f*.18,1)]:a==="weeping"?g=[b(0,u*.75,0,f*.7,u*.25,f*.7,0),b(-f*.36,u*.57,0,f*.62,u*.35,f*.63,1),b(f*.36,u*.57,0,f*.62,u*.35,f*.63,2)]:a==="domed"?g=[b(0,u*.75,0,f*.9,u*.25,f*.88,0),b(-f*.42,u*.66,f*.12,f*.64,u*.22,f*.64,1),b(f*.42,u*.66,-f*.14,f*.64,u*.22,f*.64,2)]:a==="irregular-spreading"?g=[b(-f*.2,u*.76,0,f*.78,u*.24,f*.85,0),b(-f*.43,u*.61,f*.21,f*.64,u*.2,f*.7,1),b(f*.43,u*.67,-f*.18,f*.64,u*.23,f*.64,2)]:a==="airy-oval"?g=[b(0,u*.79,0,f*.66,u*.21,f*.64,0),b(-f*.48,u*.61,f*.2,f*.52,u*.19,f*.48,1),b(f*.47,u*.64,-f*.23,f*.53,u*.2,f*.5,2)]:g=[b(0,u*.76,0,f,u*.24,f*.88,0),b(-f*.48,u*.72,f*.25,f*.65,u*.18,f*.67,1),b(f*.44,u*.7,-f*.23,f*.66,u*.22,f*.65,2)];let m=s?null:Zy[t],M=m?.colour||(a==="conical-evergreen"||/^(?:pinus|taxus)\b/.test(t)?"#496955":t.startsWith("salix")?"#88a06c":t.startsWith("betula")?"#91ad6e":t.startsWith("fagus")?"#587b51":t.startsWith("quercus")?"#648357":t.startsWith("robinia")?"#94a965":t.startsWith("tilia")?"#789655":"#78945a"),E=t==="betula nigra"&&!s?"#805b46":t.startsWith("betula")?"#d8d9c5":t.startsWith("platanus")?"#aaa68a":t==="prunus avium"?"#8a5544":t==="corylus colurna"||t.startsWith("fagus")?"#8a8b80":t.startsWith("metasequoia")?"#935d47":"#665741";return{version:Yy,id:n.id,position:[...n.position],height:l,archetype:a,lobes:g,trunkHeight:u*(s?.78:a==="fan-palm"?.9:.6),trunkWidth:Math.min(.52,Math.max(.14,u*.023)),foliage:M,bark:E,crownGeometry:a.startsWith("conical-")?"cone":"faceted",rotation:df(n.id)*Math.PI*2,provenance:{position:n.source==="osm"?"explicit OSM tree node":"municipal inventory",height:d,heightClass:n.heightClass??null,...m?{foliageReference:m.reference}:{},crownBasis:s?"explicit-inventory-management":i?.[2]||"authored-fallback",reference:s?null:i?.[3]||null,species:n.species??null,type:n.type??null,measuredCrown:!1,note:"Shape, width, clearance and summer foliage are authored priors. Not freely growing does not imply pollarding; age, pruning and actual crown extent are unverified."}}}function nu(n,e={}){if(!Array.isArray(n.bounds)||n.bounds.length!==4||!n.bounds.every(Number.isFinite))throw Error("Missing area display bounds");let t=new Zt,i=new Map,r=new Map,s=S=>(i.has(S)||i.set(S,S==="#709d98"?new _s({color:S,roughness:.24,metalness:.04,clearcoat:.72,clearcoatRoughness:.2,side:Pt}):new wn({color:S,roughness:.95,side:Pt})),i.get(S)),a=(S,_)=>{let x=r.get(S)||[];for(let A of _)x.push(A);r.set(S,x)},o=(S,_,x)=>{let A=S.geometry;if(!(!A||!["MultiPolygon","Polygon"].includes(A.type)))for(let T of A.type==="Polygon"?[A.coordinates]:A.coordinates)a(x,kr(T.map(R=>R.map(I=>[I[0],_,I[1]]))))},l=0,c=0,d=S=>{let _=S.geometry;if(!_||!["LineString","MultiLineString"].includes(_.type))return;c++;let x=_.type==="LineString"?[_.coordinates]:_.coordinates;for(let A of x)for(let T=1;T<A.length;T++){let R=A[T-1],I=A[T];a("#817a6b",[R[0],.02,R[1],I[0],.02,I[1],I[0],.55,I[1],R[0],.02,R[1],I[0],.55,I[1],R[0],.55,R[1]])}},u=S=>{let _=S.geometry;if(!(!_||!["MultiPolygon","Polygon"].includes(_.type))){l++;for(let x of _.type==="Polygon"?[_.coordinates]:_.coordinates){a("#bcbdb0",kr(x.map(A=>A.map(T=>[T[0],.12,T[1]]))));for(let A of x)for(let T=1;T<A.length;T++){let R=A[T-1],I=A[T];a("#8f9188",[R[0],.12,R[1],I[0],.12,I[1],I[0],-.18,I[1],R[0],.12,R[1],I[0],-.18,I[1],R[0],-.18,R[1]])}}}},[h,p,f,b]=n.bounds;e.includeBase!==!1&&a("#d5d4c6",kr([[[h,-.6,p],[h,-.6,b],[f,-.6,b],[f,-.6,p]]]));for(let S of n.layers?.onbegroeidterreindeel||[])o(S,-.35,S.kind==="erf"?"#c4c7b1":"#d5d3c2");for(let S of n.layers?.begroeidterreindeel||[])o(S,-.25,"#a5b68d");for(let S of n.layers?.waterdeel||[])o(S,-.2,"#709d98");for(let S of n.layers?.overbruggingsdeel||[])u(S);for(let S of n.layers?.scheiding_lijn||[])["kademuur","walbescherming"].includes(S.kind)&&d(S);for(let S of[...n.layers?.ondersteunendwegdeel||[],...n.layers?.wegdeel||[]]){let _=/voet/.test(S.kind),x=S.kind==="fietspad";o(S,_?.14:.06,_?"#d1cbbb":x?"#aa7c66":S.surface==="open verharding"?"#ab9780":"#9a9f95")}for(let[S,_]of r){if(!_.length)continue;let x=new Ct;x.setAttribute("position",new ut(_,3)),x.computeVertexNormals();let A=new gt(x,s(S));A.receiveShadow=!0,t.add(A)}let g=[],m=[[],[],[]],M=new zt,E=0;for(let S of n.trees||[]){let _=ff(S);if(_){E++,g.push({position:[_.position[0],_.trunkHeight/2+.1,_.position[1]],scale:[_.trunkWidth,_.trunkHeight,_.trunkWidth]});for(let x of _.lobes)m[x.tone].push({position:[_.position[0]+x.offset[0],x.offset[1]+.1,_.position[1]+x.offset[2]],scale:x.scale})}}function v(S,_,x){if(!S.length){_.dispose();return}let A=new vr(_,s(x),S.length);S.forEach((T,R)=>{M.position.set(T.position[0],T.position[1],T.position[2]),M.scale.set(T.scale[0],T.scale[1],T.scale[2]),M.updateMatrix(),A.setMatrixAt(R,M.matrix)}),A.instanceMatrix.needsUpdate=!0,A.castShadow=!0,t.add(A)}v(g,new ds(.5,.5,1,6),"#827c61");for(let S=0;S<3;S++)v(m[S],new gs(1,1),["#9dab78","#acb989","#899b68"][S]);let C=!1;return{group:t,stats:{trees:E,bridges:l,boundaries:c,meshes:t.children.length},dispose(){if(!C){C=!0,t.removeFromParent();for(let S of[...t.children])S instanceof vr&&S.dispose(),S instanceof gt&&S.geometry.dispose(),t.remove(S);for(let S of i.values())S.dispose();i.clear()}}}}var ul={x:155e3,y:463e3},pf=52.1551744,mf=5.38720621,jy=[[0,1,3235.65389],[2,0,-32.58297],[0,2,-.2475],[2,1,-.84978],[0,3,-.0655],[2,2,-.01709],[1,0,-.00738],[4,0,.0053],[2,3,-39e-5],[4,1,33e-5],[1,1,-12e-5]],Qy=[[1,0,5260.52916],[1,1,105.94684],[1,2,2.45656],[3,0,-.81885],[1,3,.05594],[3,1,-.05607],[0,1,.01199],[3,2,-.00256],[1,4,.00128],[0,2,22e-5],[2,0,-22e-5],[3,4,26e-5]],ev=[[0,1,190094.945],[1,1,-11832.228],[2,1,-114.221],[0,3,-32.391],[1,0,-.705],[3,1,-2.34],[1,3,-.608],[0,2,-.008],[2,3,.148]],tv=[[1,0,309056.544],[0,2,3638.893],[2,0,73.077],[1,2,-157.984],[3,0,59.788],[0,1,.433],[2,2,-6.439],[1,1,-.032],[0,4,.092],[1,4,-.054]],hl={east:.183,north:.234},iu=111320,gf=n=>iu*Math.cos(n*Math.PI/180),dl=(n,e,t)=>n.reduce((i,[r,s,a])=>i+a*e**r*t**s,0);function Ys({x:n,y:e}){let t=(n-ul.x)*1e-5,i=(e-ul.y)*1e-5,r=pf+dl(jy,t,i)/3600-hl.north/iu;return[mf+dl(Qy,t,i)/3600-hl.east/gf(r),r]}function ru([n,e]){let t=e+hl.north/iu,i=n+hl.east/gf(t),r=.36*(t-pf),s=.36*(i-mf);return{x:ul.x+dl(ev,r,s),y:ul.y+dl(tv,r,s)}}var su=(n,e)=>n[0]*e[1]-n[1]*e[0],_f=(n,e)=>[n[0]-e[0],n[1]-e[1]],yf=n=>n?.type==="MultiPolygon"?n.coordinates:n?.type==="Polygon"?[n.coordinates]:[];function xf(n,e){let t=!1;for(let i=0,r=e.length-1;i<e.length;r=i++){let s=e[i],a=e[r];s[1]>n[1]!=a[1]>n[1]&&n[0]<(a[0]-s[0])*(n[1]-s[1])/(a[1]-s[1])+s[0]&&(t=!t)}return t}function nv(n,e){return yf(e.footprint).some(t=>xf(n,t[0])&&!t.slice(1).some(i=>xf(n,i)))}function iv(n,e,t,i,{sourceBuildingId:r,sourceBoundaryToleranceM:s=0}={}){let a=null;for(let o of t){let l=[0,i];for(let c of yf(o.footprint).flat())for(let d=0;d<c.length;d++){let u=c[d],h=c[(d+1)%c.length],p=_f(h,u),f=_f(u,n),b=su(e,p);if(Math.abs(b)<1e-9)continue;let g=su(f,p)/b,m=su(f,e)/b;g>0&&g<i&&m>=-1e-8&&m<=1+1e-8&&l.push(g)}l.sort((c,d)=>c-d);for(let c=1;c<l.length;c++){if(l[c]-l[c-1]<1e-7||o.id===r&&l[c-1]<1e-7&&l[c]<=s)continue;let d=(l[c]+l[c-1])/2,u=[n[0]+e[0]*d,n[1]+e[1]*d];if(nv(u,o)&&(!a||l[c-1]<a.distanceM)){a={buildingId:o.id,distanceM:l[c-1]};break}}}return a}function fl(n,e,t,i=95){if(!Number.isFinite(e)||e<=0||!Number.isFinite(t)||t<=0)throw Error("Positive camera aspect and radius required");let r=2*Math.atan(Math.max(n.height*.65,n.wallWidthM*.65/e)/t)*180/Math.PI;return{fov:Math.min(i,Math.max(38,r)),wholeFacadeFits:r<=i}}function vf(n,e,t,{desiredRadius:i=21,clearanceM:r=1.5,maxFov:s=95}={}){if(!Number.isFinite(t)||t<=0)throw Error("Positive camera aspect required");let a=Math.hypot(...n.normal);if(!a)throw Error("Nonzero frontage normal required");let o=n.normal.map(b=>b/a),l=1.4,c=[n.mid[0],Math.min(12,n.height*.5),n.mid[1]],d=i*Math.sin(l),u=iv(n.mid,o,e,d+r,{sourceBuildingId:n.buildingId,sourceBoundaryToleranceM:.25}),h=u?Math.min(d,Math.max(0,u.distanceM-r)):d;if(h<.8)return{version:1,usable:!1,reason:"No clear outward camera position on this wall normal",obstruction:u,target:c};let p=h/Math.sin(l),f=fl(n,t,p,s);return{version:1,usable:!0,target:c,radius:p,theta:Math.atan2(o[0],o[1]),phi:l,...f,position:[c[0]+o[0]*h,c[1]+p*Math.cos(l),c[2]+o[1]*h],constrained:p<i-1e-6,obstruction:u,clearanceM:r,scope:"Initial source-wall framing; conservative footprint geometry only. Trees, overhangs and manual orbit are not collision-tested."}}function bf(n,e,{marginM:t=2,maxExtensionM:i=10}={}){let r=[...n],s=o=>Array.isArray(o)&&o.length===2&&o.every(Number.isFinite);for(let o of e)for(let l of[o.localStart,o.localEnd])s(l)&&(r[0]=Math.min(r[0],Math.floor(l[0]-t)),r[1]=Math.min(r[1],Math.floor(l[1]-t)),r[2]=Math.max(r[2],Math.ceil(l[0]+t)),r[3]=Math.max(r[3],Math.ceil(l[1]+t)));r[0]=Math.max(r[0],n[0]-i),r[1]=Math.max(r[1],n[1]-i),r[2]=Math.min(r[2],n[2]+i),r[3]=Math.min(r[3],n[3]+i);let a=e.filter(o=>[o.localStart,o.localEnd].some(l=>!s(l)||l[0]<r[0]||l[0]>r[2]||l[1]<r[1]||l[1]>r[3])).map(o=>o.id);return{sourceBounds:[...n],bounds:r,marginM:t,maxExtensionM:i,clippedFrontageIds:a,source:"display-only existing-frontage coverage; no new data acquisition"}}var oe=n=>document.getElementById(n),Gn=new URLSearchParams(location.search),Et=Gn.get("area")==="expansion",Zs=Gn.get("release");if(Zs&&!/^[a-f0-9]{64}$/.test(Zs))throw Error("Invalid immutable release ID");var rv=Zs?`/data/${Et?"city-expansion":"city-appearance"}/releases/${Zs}/manifest.json`:Et?"/data/city-expansion/current.json":"/data/city-appearance/current.json",Qt=n=>oe(n).checked,Ks=oe("scene"),Js=oe("stage"),rn=new rs;rn.background=new $e("#e9e9df");rn.fog=new ki("#e9e9df",260,850);var Dt=new Jo({canvas:Ks,antialias:!0,powerPreference:"high-performance"}),sv=Math.min(devicePixelRatio,1.5),zr=sv,hu=0,au=[],ou=0;Dt.setPixelRatio(zr);Dt.outputColorSpace=Bt;Dt.shadowMap.enabled=!0;Dt.shadowMap.type=no;Dt.toneMapping=As;Dt.toneMappingExposure=1.05;rn.add(new bs("#fbfff5","#87948b",1.75));var Cn=new Ss("#fff0d8",3);Cn.position.set(-130,240,90);Cn.castShadow=!0;Cn.shadow.mapSize.set(2048,2048);Cn.shadow.camera.left=-340;Cn.shadow.camera.right=340;Cn.shadow.camera.top=340;Cn.shadow.camera.bottom=-340;Cn.shadow.camera.near=40;Cn.shadow.camera.far=650;Cn.shadow.bias=-15e-5;rn.add(Cn);var Xe=new Xt(38,1,.2,9e3),Ke=new tl(Xe,Ks);Ke.enableDamping=!0;Ke.dampingFactor=.09;Ke.minDistance=.8;Ke.maxDistance=6e3;Ke.maxPolarAngle=Math.PI*.49;Ke.target.set(0,5,-8);Xe.position.set(160,210,230);Ke.update();function Vr(n){Gr=n,oe("navigation-orbit")?.setAttribute("aria-pressed",String(n==="orbit")),oe("navigation-explore")?.setAttribute("aria-pressed",String(n==="explore")),Ke.enableRotate=n==="orbit"||n==="explore",Ke.enablePan=n==="explore"}function Ef(n,e){document.querySelectorAll(`button[data-${n}]`).forEach(t=>t.setAttribute("aria-pressed",String(t.dataset[n]===e)))}var mu="ground",yl="ground";function Af(n){mu=n,Ef("source-tier",n)}function gu(n){yl=n,Ef("camera-preset",n);let e=An?Zi().find(t=>t.id===An):null;if(n==="ground"?Xe.fov=38:n==="front"?Xe.fov=34:Xe.fov=48,e&&Hn){let t=fl(e,Xe.aspect,Math.max(16,Xe.position.distanceTo(Ke.target)));Number.isFinite(t.fov)&&(Xe.fov=t.fov)}Xe.updateProjectionMatrix(),Ke.update(),$t=!0}function av(){return`cam=${Xe.position.x.toFixed(2)},${Xe.position.y.toFixed(2)},${Xe.position.z.toFixed(2)}|${Ke.target.x.toFixed(2)},${Ke.target.y.toFixed(2)},${Ke.target.z.toFixed(2)}|${Xe.fov.toFixed(2)}`}function _u(){if(!ae?.context?.origin)return;let[n,e]=Ys({x:ae.context.origin.x+Xe.position.x,y:ae.context.origin.y-Xe.position.z}),t=oe("location-label");t&&(t.textContent=`${e.toFixed(6)}, ${n.toFixed(6)}`);let i=oe("location-map-link");i instanceof HTMLAnchorElement&&ae?.context?.origin&&(i.href=`https://www.openstreetmap.org/?mlat=${e}&mlon=${n}#map=19/${e}/${n}`)}function Rf(n){let e=n??new URLSearchParams(location.search).get("camera");if(!e||!ae||!e.includes("|"))return;let[t,i,r]=e.split("|"),s=c=>c?.split(",").map(Number),a=s(t),o=s(i),l=parseFloat(r||"");a&&a.length===3&&a.every(c=>Number.isFinite(c))&&Xe.position.set(a[0],a[1],a[2]),o&&o.length===3&&o.every(c=>Number.isFinite(c))&&Ke.target.set(o[0],o[1],o[2]),Number.isFinite(l)&&l>1&&l<120&&(Xe.fov=l),$t=!0}function ov(){return new URLSearchParams({...Object.fromEntries(Gn),camera:av(),sourceTier:mu,cameraPreset:yl}).toString()}var ae=null,An=null,Yi=null,Rn="overview",pl=!1,xu=!1,Hn=null,Ri=null,lv=0,_n=!1,gn=0,du=0,fu=0,pu=null,Mf=0,$t=!0,Sf=0,gl=null,lu=!1,Gr="orbit",lt={forward:!1,backward:!1,left:!1,right:!1,turnLeft:!1,turnRight:!1,fast:!1},Ai=0,cv=()=>2*Math.atan(Math.tan(38*Math.PI/360)/Math.min(1,Xe.aspect))*180/Math.PI,_l=(n,e=!1)=>{oe("release-status").textContent=n,oe("release-status").classList.toggle("error",e)},uv=async n=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",n))].map(e=>e.toString(16).padStart(2,"0")).join("");async function cu(n,e,t){let i=Array.isArray(e)?e:[e];if(!i.length||i.some(l=>!/^[a-f0-9]{64}$/.test(l)))throw Error("Missing source hash");let r=new URL(n,location.href);if(r.origin!==location.origin)throw Error("Release data must be same-origin");let s=await fetch(r,{signal:t});if(!s.ok)throw Error(`Source HTTP ${s.status}`);let a=await s.arrayBuffer();if(!i.includes(await uv(a)))throw Error("Source hash mismatch; previous release retained");let o=new Uint8Array(a);if(o[0]===31&&o[1]===139){let l=new Blob([o]).stream().pipeThrough(new DecompressionStream("gzip"));return JSON.parse(await new Response(l).text())}return JSON.parse(new TextDecoder().decode(o))}function hv(n){let e=[],t=[];for(let s of n){if(!s.footprint)continue;let a=new $e(s.colour),o=Math.max(.1,s.height),l=s.footprint.type==="Polygon"?[s.footprint.coordinates]:s.footprint.coordinates,c=(d,u,h)=>{e.push(...d,...u,...h);for(let p=0;p<3;p++)t.push(a.r,a.g,a.b)};for(let d of l){let u=d.map(p=>p.slice(0,-1).map(f=>new Le(f[0],f[1]))),h=u.flat();for(let[p,f,b]of Gi.triangulateShape(u[0],u.slice(1)))c([h[p].x,o,h[p].y],[h[b].x,o,h[b].y],[h[f].x,o,h[f].y]);for(let p of u)for(let f=0;f<p.length;f++){let b=p[f],g=p[(f+1)%p.length];c([b.x,0,b.y],[g.x,o,g.y],[g.x,0,g.y]),c([b.x,0,b.y],[b.x,o,b.y],[g.x,o,g.y])}}}let i=new Ct;i.setAttribute("position",new ut(e,3)),i.setAttribute("color",new ut(t,3)),i.computeVertexNormals();let r=new gt(i,new xs({vertexColors:!0,side:Pt}));return r.name="complete-source-footprint-overview",r}function yu(n){let[e,t]=Ys({x:n.origin.x+Xe.position.x,y:n.origin.y-Xe.position.z}),i=Math.min(900,Math.max(110,Xe.position.distanceTo(Ke.target)*1.1)),[r,s]=Ys({x:n.origin.x+Ke.target.x-i,y:n.origin.y-Ke.target.z-i}),[a,o]=Ys({x:n.origin.x+Ke.target.x+i,y:n.origin.y-Ke.target.z+i});return{longitude:e,latitude:t,bounds:{west:r,south:s,east:a,north:o}}}function Zi(){return ae?[...ae.owners.values()].flatMap(n=>n.observations.map(e=>e.payload)).sort((n,e)=>String(n.street??"").localeCompare(String(e.street??""))||n.mid[1]-e.mid[1]||n.id.localeCompare(e.id)):[]}function Cf(){return ae?[...ae.owners.values()].map(n=>n.geometry.building):[]}function dv(){let n=oe("street-labels");if(n.replaceChildren(),!Et||!ae)return;let e=new Map;for(let i of Cf()){if(!i.street||!Array.isArray(i.center))continue;let r=e.get(i.street)??{x:0,z:0,n:0};r.x+=i.center[0],r.z+=i.center[1],r.n++,e.set(i.street,r)}let t=[...e].sort((i,r)=>r[1].n-i[1].n||i[0].localeCompare(r[0])).slice(0,14);ae.streetNames=t.map(([i])=>i),ae.streetLabels=t.map(([i,r])=>{let s=document.createElement("span");return s.className="street-label",s.textContent=i,n.append(s),{name:i,element:s,position:new k(r.x/r.n,2,r.z/r.n)}})}function fv(){if(!ae)return;let n=oe("building-options");n.replaceChildren();for(let e of ae.owners.values()){let t=e.geometry.building,i=document.createElement("option");i.value=e.id,i.label=[t.id,t.street,t.addresses?.[0]].filter(Boolean).join(" \xB7 "),n.append(i)}}function Pf(n){let e=n.trim();if(!e)return;let t=ae?.owners.get(e);if(t){Ci(t.id);let s=wf(t);s&&(Ke.target.set(s[0],s[1],s[2]),Xe.position.set(s[0]-10,s[1]+8,s[2]+10),$t=!0,Hn=null,Rn="manual",Ki(ae),xl());return}let i=e.toLowerCase(),r=[...ae?.owners.values()??[]].find(s=>{let a=s.geometry.building;return String(a.street||"").toLowerCase().includes(i)||String(a.id||"").toLowerCase().includes(i)||a.addresses?.some(o=>o.toLowerCase().includes(i))});if(r){Ci(r.id);let s=wf(r);s&&(Ke.target.set(s[0],s[1],s[2]),Xe.position.set(s[0]-10,s[1]+8,s[2]+10),$t=!0,Hn=null,Rn="manual",Ki(ae),xl());return}oe("view-label").textContent=`No building matched ${e}.`}function wf(n){let e=n.geometry?.building?.center;return Array.isArray(e)&&e.length>=2?[e[0],1.5,e[1]]:null}function If(){if(!ae?.streetLabels)return;let n=Xe.position.distanceTo(Ke.target),e=[];for(let t of ae.streetLabels){let i=t.position.clone().project(Xe),r=(i.x*.5+.5)*Js.clientWidth,s=(-i.y*.5+.5)*Js.clientHeight,a=Math.min(150,32+t.element.textContent.length*5.5),o={left:r-a/2,right:r+a/2,top:s-9,bottom:s+9},l=Qt("labels")&&t.name!==Ri&&i.z>-1&&i.z<1&&Math.abs(i.x)<1.02&&Math.abs(i.y)<1.02&&!e.some(c=>o.left<c.right+5&&o.right>c.left-5&&o.top<c.bottom+3&&o.bottom>c.top-3);t.element.hidden=!l,l&&(e.push(o),t.element.style.left=`${r}px`,t.element.style.top=`${s}px`,t.element.classList.toggle("far",n>300))}}function Df(){ae?.streetNames?.length&&(Ri=ae.streetNames[lv++%ae.streetNames.length],oe("view-label").textContent=`Find ${Ri} \xB7 click one of its buildings`,oe("street-quiz").textContent="Skip to another street")}function Lf(n){if(!Ri)return null;let e=Ri,t=ae?.owners.get(n)?.geometry.building.street,i=t===e;return i?(oe("view-label").textContent=`Correct \xB7 ${e}`,Ri=null,oe("street-quiz").textContent="Another street"):oe("view-label").textContent=`That is ${t||"an unnamed building"} \xB7 find ${e}`,{correct:i,street:t||null,target:e}}function Ki(n){n?.group?.traverse?.(e=>{e.isInstancedMesh&&(e.visible=Qt("trees")&&Rn!=="frontage")})}function pv(){let n=0;return ae?.group?.traverse?.(e=>{e.isInstancedMesh&&e.visible&&n++}),n}function Ff(){return[...ae?.resources||[]].reduce((n,e)=>n+e.stats.machineSigns,0)}function Nf(){let n=oe("machine-sign-badge");if(!Et){n.hidden=!0;return}let e=Ff(),t=Qt("machine-signs");n.hidden=!t||e<1,n.textContent=Kd}function vu(n){for(let e of ae?.resources||[])e.setMachineSignsVisible(n);Nf()}function mv(n){if(!n)return"geometry-only";if(n.sourceTier||n.tier)return n.sourceTier||n.tier;let e=n.images?.full,t=n.images?.ground;return e&&t?"full + ground":t?"ground":e?"full":"source metadata only"}function gv(n){return n?.images?.ground?.date||n?.images?.full?.date||n?.captureDate||n?.capturedAt||"date unknown"}function _v(n){if(!n)return["facade evidence"];let e=n.machineRoutingProposal||{},t=[];return String(e.signText||"").trim()||t.push("literal sign text"),e.signTextEligible==="unknown"&&t.push("sign text uncertain"),(n.effectiveProposal?.shopfront==="unknown"||n.effectiveProposal?.shopfront==null)&&t.push("shopfront"),n.visualReview?.fieldEligibility?.signText===!1&&t.push("sign text withheld"),[...new Set(t)]}function xv(n){if(!n)return"No source observation is bound to this building; generated facade details remain omitted.";let e=n.images?.ground,t=n.images?.full,i=[n.id,n.evidenceKey,n.derivationKey].filter(Boolean).join(" \xB7 ")||"identity unavailable",r=e?.panoramaId||t?.panoramaId||"panorama unavailable",s=_v(n),a=String(gv(n));return`Source ${i} \xB7 panorama ${r} \xB7 captured ${a.slice(0,10)} \xB7 tier ${mv(n)}. Render omissions: ${s.length?s.join(", "):"none recorded"}. Machine text stays unreviewed and is revoked when this source binding changes.`}function yv(n){let e=new Zt,t=[];for(let a=1;a<n.points.length;a++){let[o,l]=n.points[a-1],[c,d]=n.points[a],u=c-o,h=d-l,p=Math.hypot(u,h);if(!p)continue;let f=-h/p*.4,b=u/p*.4,g=[[o+f,.2,l+b],[c+f,.2,d+b],[c-f,.2,d-b],[o-f,.2,l-b]];for(let m of[0,1,2,0,2,3])t.push(...g[m])}let i=new Ct;i.setAttribute("position",new ut(t,3)),i.computeVertexNormals();let r=new wn({color:"#d7a82f",emissive:"#60440a",emissiveIntensity:.16,roughness:.78,polygonOffset:!0,polygonOffsetFactor:-2,side:Pt}),s=new gt(i,r);return s.name="map-recall-guided-route",s.renderOrder=3,e.add(s),{group:e,dispose(){e.removeFromParent(),i.dispose(),r.dispose()}}}function uu(n){let e=ae?.context.guidedRoute?.points;if(!e?.length)return null;let t=n;for(let i=1;i<e.length;i++){let r=e[i-1],s=e[i],a=Math.hypot(s[0]-r[0],s[1]-r[1]);if(t<=a){let o=a?t/a:0;return{point:[r[0]+(s[0]-r[0])*o,r[1]+(s[1]-r[1])*o],ahead:s}}t-=a}return{point:e.at(-1),ahead:e.at(-1)}}function vv(n){return ae?.context.guidedRoute?.legs?.find((e,t,i)=>n>=e.fromM&&(n<e.toM||t===i.length-1))?.streetName??null}function Uf(){ae?.context.guidedRoute&&(_n=!_n,Ke.enabled=!_n,oe("follow-route").textContent=_n?"Pause street tour":"Resume street tour",_n&&(vu(Qt("machine-signs")),Ri=null,gn=gn>=ae.context.guidedRoute.distanceM?0:gn,du=performance.now()))}function Of(n){ae?.priorityTiles&&(ae.priorityTiles.length=0),Rn="route",rn.fog instanceof ki&&(rn.fog.near=260,rn.fog.far=850);let e=ae?.context.guidedRoute;if(!e)return;gn=Math.max(0,Math.min(e.distanceM,n));let t=uu(gn),i=uu(Math.min(e.distanceM,gn+12));if(!t||!i)return;let[r,s]=t.point,a=i.point[0]-r,o=i.point[1]-s;if(Math.hypot(a,o)<.1){let d=uu(Math.max(0,gn-12));a=r-(d?.point[0]??r-1),o=s-(d?.point[1]??s)}let l=Math.hypot(a,o)||1;Xe.position.set(r-a/l*4,2.35,s-o/l*4),Ke.target.set(r+a/l*12,1.75,s+o/l*12),Xe.fov=58,Xe.updateProjectionMatrix(),Ke.update();let c=vv(gn);oe("view-label").textContent=`Street tour \xB7 ${c?`${c} \xB7 `:""}${Math.round(gn)} / ${Math.round(e.distanceM)} m \xB7 ${Math.round(gn/e.distanceM*100)}%`,$t=!0}function bv(n){if(!_n)return;let e=ae?.context.guidedRoute;if(!e){_n=!1;return}let t=gn+Math.min(.1,(n-du)/1e3)*9;du=n,t>=e.distanceM&&(_n=!1,Ke.enabled=!0,oe("follow-route").textContent="Replay street tour"),Of(t)}async function Bf(){let n=++fu;pu?.abort();let e=new AbortController;pu=e;let t=await fetch(rv,{signal:e.signal,cache:"no-store"});if(!t.ok)throw Error("No published scene yet. Run the matching city demo publisher.");let i=await t.json();if(i.version!==1||!i.releaseId||!Array.isArray(i.tiles)||!i.context?.url)throw Error("Unsupported scene release");let r=!!Zs&&i.developmentCandidate===!0;if(r){let M=oe("machine-preview").closest("label")?.querySelector("span");M&&(M.textContent="Photo-derived wall colours (unreviewed)"),oe("appearance-copy").textContent="Photo-derived fa\xE7ade details are shown where available. Other buildings retain illustrative patterns. Placement is under review; source roofs are preserved.";let E=document.getElementById("candidate-preview-badge");E||(E=document.createElement("div"),E.id="candidate-preview-badge",E.style.cssText="position:fixed;bottom:12px;left:12px;z-index:20;padding:8px 12px;background:#fff3ce;color:#493c20;font:13px sans-serif;pointer-events:none",document.body.append(E)),E.textContent="Neighbourhood preview \xB7 fa\xE7ade placement under review"}let s=await cu(i.context.url,i.context.sha256,e.signal),a=new Zt,o=null,l=null,c=new Map,d=new Set,u=new Set,h=[],p=new Map(i.tiles.map(M=>[M.key,M])),f=hf({parent:a,targetOriginRD:s.origin,targetOffsetNAP:.65,experimentalWallColours:Qt(Et?"machine-preview":"appearance"),observedFacades:r,candidateRegistrationPreview:r,proceduralFacades:Qt("patterns"),reviewedAwnings:!Et&&Qt("appearance"),auditCoverage:Et&&Qt("appearance"),contextualPalette:Et,contextualFacades:Et,machineSigns:Et&&Qt("machine-signs"),castShadows:!Et}),b=i.observationIndex?.find(M=>M.id===(Gn.get("frontage")||Gn.get("inspect"))),g=b?.tile?[b.tile]:[],m=new zs({index:i,priorityTiles:g,budget:12,concurrency:2,lodDistanceMultiplier:1,loadTile:async(M,E)=>{let v=p.get(M);if(!v?.url)throw Error("Missing tile in release");return cu(v.url,[v.sha256,v.contentSha256??v.sha256],E)},createResource:M=>{for(let v of M)c.set(v.id,v);let E=f(M);return E.setSelected(Yi),d.add(E),{setLod:(v,C)=>E.setLod(v,C),dispose(){for(let v of M)c.delete(v.id);d.delete(E),E.dispose()}}},onError:(M,E)=>h.push(String(E))});try{if(i.contextTiles){let I=new Map(i.contextTiles.tiles.map(N=>[N.key,N]));l=new zs({index:i.contextTiles,budget:16,concurrency:2,loadTile:async(N,U)=>{let F=I.get(N);if(!F?.url)throw Error("Missing context tile in release");return cu(F.url,[F.sha256,F.contentSha256??F.sha256],U)},createResource:N=>{let U={},F=[];for(let D of N){let G=D.geometry;G.kind==="tree"?F.push(G.tree):G.kind==="feature"&&(U[G.layer]??=[]).push(G.feature)}let O=nu({...s,layers:U,trees:F},{includeBase:!1});return u.add(O),a.add(O.group),{setLod(){},dispose(){u.delete(O),O.dispose()}}},onError:(N,U)=>h.push(String(U))})}b?.mid&&(Ke.target.set(b.mid[0],5,b.mid[1]),Xe.position.set(b.mid[0],45,b.mid[1]+45),Ke.update());let M=yu(s);m.update(M),l?.update(M),await Promise.all([m.whenIdle(),l?.whenIdle()]);for(let I of d)I.flush();if(xu||n!==fu||e.signal.aborted)throw new DOMException("Superseded","AbortError");if(h.length)throw Error(h[0]);if(!c.size)throw Error("No building tiles loaded for this view");let E=bf(s.bounds,[...c.values()].flatMap(I=>I.observations.map(N=>N.payload)));o=nu({...s,bounds:E.bounds}),a.add(o.group),Ki(o);let v=s.overviewMassing?.buildings?.length?hv(s.overviewMassing.buildings):null;v&&a.add(v);let C=s.guidedRoute?yv(s.guidedRoute):null;C&&(a.add(C.group),C.group.visible=Qt("route"));let S=ae;ae={manifest:i,context:s,displayExtent:E,group:a,terrain:o,overviewMassing:v,priorityTiles:g,routeOverlay:C,owners:c,stream:m,contextStream:l,resources:d,contextResources:u},rn.add(a),S&&(S.stream.dispose(),S.contextStream?.dispose(),S.routeOverlay?.dispose(),S.terrain.dispose(),S.overviewMassing?.geometry.dispose(),S.overviewMassing?.material.dispose(),rn.remove(S.group));let[_,x,A,T]=E.bounds;Dt.clippingPlanes=[new Vt(new k(1,0,0),-_),new Vt(new k(-1,0,0),A),new Vt(new k(0,0,1),-x),new Vt(new k(0,0,-1),T)],oe("coverage").textContent=`${i.buildings} buildings \xB7 ${i.observations} photographed frontages \xB7 ${i.reviewed??0} reviewed`;let R=oe("provenance-ladder");if(Et&&i.appearanceCoverage){let I=i.appearanceCoverage;R.hidden=!1,R.innerHTML=`<strong>Coverage ladder</strong><br>Geometry ${I.geometryBuildings}/${i.buildings}<br>Contextual display prior ${I.contextualPriorBuildings}/${i.buildings}<br>Audited street evidence ${I.auditedFrontages}/${i.buildings}<br>Machine-observed (unreviewed) ${I.machinePreviewFrontages}/${i.buildings}<br>Human-confirmed appearance ${I.humanConfirmedFrontages}/${i.buildings}${r?`<br>Candidate fa\xE7ade buildings ${I.candidatePreviewBuildings??0}/${i.buildings}`:""}`}Nf(),s.guidedRoute&&(oe("follow-route").textContent=`Play ${Math.round(s.guidedRoute.distanceM)} m street tour`),dv(),fv(),Af(Gn.get("sourceTier")==="full"?"full":"ground"),gu(Gn.get("cameraPreset")==="front"?"front":Gn.get("cameraPreset")==="oblique"?"oblique":"ground"),Rf(),_u(),oe("loading").hidden=!0,_l(`Release ${i.releaseId.slice(0,8)} \xB7 ${i.reviewed??0} reviewed${i.followupCount?` \xB7 ${i.followupCount} follow-up notes`:""}`),Yi&&Ci(Yi,An||void 0),$t=!0}catch(M){throw m.dispose(),l?.dispose(),o?.dispose(),ae?.group!==a&&rn.remove(a),M}}function vl(n){if(ae?.priorityTiles&&(ae.priorityTiles.length=0),Hn=null,_n=!1,Ke.enabled=!0,oe("follow-route").textContent="Play street tour",Rn=n,vu(Et&&Qt("machine-signs")),Vr(Gr),n==="canal"){let e=Et&&ae?ru([4.8728,52.372]):null,t=e?e.x-ae.context.origin.x:-5,i=e?ae.context.origin.y-e.y:-30;Ke.target.set(t,7,i),Xe.position.set(t-70,58,i+55)}else if(n==="shops"){let e=Et&&ae?ru([4.873,52.37155]):null,t=e?e.x-ae.context.origin.x:-22,i=e?ae.context.origin.y-e.y:70;Ke.target.set(t,8,i),Xe.position.set(t-26,23,i+38)}else{let e=ae?.displayExtent.bounds||[-130,-147,130,131],t=(e[0]+e[2])/2,i=(e[1]+e[3])/2,r=Math.max(e[2]-e[0],e[3]-e[1]);Ke.target.set(t,5,i),Xe.position.set(t+r*.5,r*.74,i+r*.7)}rn.fog instanceof ki&&(rn.fog.near=n==="overview"?1800:260,rn.fog.far=n==="overview"?6e3:850),gu(yl),Ki(ae),document.querySelectorAll("[data-view]").forEach(e=>e.setAttribute("aria-pressed",String(e.dataset.view===n))),$t=!0}function Ci(n,e){let t=ae?.owners.get(n);if(!t)return;Yi=n;for(let h of ae?.resources||[])h.setSelected(n);let i=t.observations.map(h=>h.payload),r=i.find(h=>h.id===e)||i[0];An=r?.id||null;let s=t.geometry.building;oe("inspector").hidden=!1,oe("selection-title").textContent=r?.address||s.addresses?.[0]||"Building without a photographed frontage";let a={accepted:"Human-confirmed wall",uncertain:"Human: placement uncertain",rejected:"Human: wrong or unusable","crop-repair":"Human: right building, bad crop"},o=r?.agentSourceAudit?r.agentSourceAudit.disposition==="preflight-passed"?"Automated crop preflight \xB7 identity unreviewed":`Agent source audit: ${r.agentSourceAudit.disposition}`:a[r?.review?.placement]||"Not human-reviewed";oe("selection-tags").replaceChildren();for(let h of[o,t.geometryRevision.slice(0,8)]){let p=document.createElement("span");p.className="tag",p.textContent=h,oe("selection-tags").append(p)}let l=oe("frontage-choice");l.replaceChildren(...i.map((h,p)=>new Option(`${p+1}. ${h.wallWidthM.toFixed(1)} m wall${["accepted","uncertain","rejected","crop-repair"].includes(h.review?.placement)?" \xB7 reviewed":""}`,h.id))),l.hidden=i.length<2,r&&(l.value=r.id);let c=r?.effectiveProposal,d={flat:"flat","flat-with-front-pitch":"mostly flat with a sloped front","pitched-gable":"two slopes meeting at a ridge",hipped:"sloped on all sides",mansard:"steep lower slopes and gentler upper slopes",complex:"several connected roof shapes"};oe("selection-summary").textContent=r?`${r.machineRoutingProposal?`Machine-observed: ${r.machineRoutingProposal.wallColour} ${r.machineRoutingProposal.wallMaterial}, ${r.machineRoutingProposal.family}; ${r.machineRoutingProposal.groundType} ground floor. `:""}Storefront: ${c?.shopfront==="yes"?r.review?.shopfront==="yes"?"human-confirmed":"machine-observed, unreviewed":c?.shopfront==="no"?"no storefront observed":"not established"}. Roof: ${d[c?.roofShape]||"not established"}. The source roof geometry is unchanged.`:"Source geometry only. No facade evidence has been assigned to this building.",oe("source-comparison").textContent=xv(r),oe("inspector-warning").textContent=r?.agentSourceAudit?.note||r?.review?.notes?`${r?.agentSourceAudit?"Source audit":"Your note"}: ${r?.agentSourceAudit?.note||r.review.notes}`:r?.review?.placement==="crop-repair"?"The building is right, but the crop needs repair. Appearance is withheld.":r?.facadeDescription?"Photo-derived fa\xE7ade details; placement is still under review.":"Window patterns are illustrative, not extracted window counts.";let u=oe("evidence-image");u.hidden=!0,u.removeAttribute("src"),u.onload=()=>{u.hidden=!1},u.onerror=()=>{u.hidden=!0,oe("evidence-caption").textContent="Evidence image unavailable; use the review link."},r?.images.full?.file?(u.src=r.images.full.publicUrl||(Et?"/panorama-audit/evidence/":"/evidence/")+encodeURIComponent(r.images.full.file),oe("evidence-caption").textContent=`Street evidence \xB7 ${r.images.full.date?.slice(0,10)||"date unknown"} \xB7 approximate wall crop`):oe("evidence-caption").textContent="";for(let h of["review-link","frame-frontage","detail-link"])oe(h).hidden=!r;if(r&&(oe("review-link").href=Et?"./panorama-audit.html#"+encodeURIComponent(r.id):"./neighbourhood-review.html#"+encodeURIComponent(r.id),oe("review-link").textContent=Et?"See audit evidence \u2197":"Review this wall \u2197",oe("detail-link").href="./da-costa-block.html?neighbourhood=1&frontage="+encodeURIComponent(r.id)),r){let h=oe("review-link"),p=Et?"./panorama-audit.html":"./neighbourhood-review.html",f=new URL(p+"#"+encodeURIComponent(r.id),location.href);f.searchParams.set("sourceTier",mu),f.searchParams.set("cameraPreset",yl),h.href=f.href}}function Hr(n){let e=Zi().find(r=>r.id===n);if(!e)return;let t=e.review?.placement==="accepted"&&Zi().find(r=>r.id===e.review.targetId)||e,i=vf(t,Cf(),Xe.aspect);if(Ci(e.renderBuildingId||e.buildingId,e.id),!i.usable){oe("inspector-warning").textContent="This wall has no clear initial camera position. Use the photographs to review it.";return}Ke.target.set(i.target[0],i.target[1],i.target[2]),Xe.position.set(i.position[0],i.position[1],i.position[2]),Xe.fov=i.fov,Xe.updateProjectionMatrix(),Ke.update(),Hn=t,Rn="frontage",Ki(ae),oe("view-label").textContent=e.address,document.querySelectorAll("[data-view]").forEach(r=>r.setAttribute("aria-pressed","false")),$t=!0}function kf(n){let e=Zi();if(!e.length)return;let t=e.findIndex(i=>i.id===An);Hr(e[(t+n+e.length)%e.length].id)}async function bu(){if(!Et)try{let n=await fetch("/api/city-appearance/status",{cache:"no-store"});n.ok&&(gl=await n.json(),gl.stale&&_l("New saved reviews are available. Load them into this scene."))}catch{}}async function Mu(n=!0){if(pl){n||(lu=!0);return}pl=!0,oe("refresh").disabled=!0;try{if(_l(n?"Checking saved reviews\u2026":"Updating appearance view\u2026"),n&&(await bu(),gl?.token)){let e=await fetch("/api/city-appearance/refresh",{method:"POST",headers:{"content-type":"application/json","x-review-token":gl.token},body:"{}"});if(!e.ok)throw Error((await e.json()).error||"Could not rebuild the scene")}do lu=!1,await Bf(),Hn&&Hr(Hn.id);while(lu)}catch(e){e.name!=="AbortError"&&_l(`${String(e)}. The previous scene is retained.`,!0)}finally{pl=!1,oe("refresh").disabled=!1}}function Su(){let n=Js.clientWidth,e=Js.clientHeight;Dt.setSize(n,e,!1),Xe.aspect=n/e,Hn?Xe.fov=fl(Hn,Xe.aspect,Xe.position.distanceTo(Ke.target)).fov:Rn==="overview"&&(Xe.fov=cv()),Xe.updateProjectionMatrix(),$t=!0}function Mv(n){if(ou){let i=n-ou;i>0&&i<500&&au.push(i)}if(ou=n,au.length<30)return;let e=au.splice(0).sort((i,r)=>i-r),t=e[Math.floor(e.length*.75)];t>35&&zr>.76?(zr=Math.max(.75,zr*.8),Dt.setPixelRatio(zr),Su(),hu++):t>45&&Dt.shadowMap.enabled&&(Dt.shadowMap.enabled=!1,hu++)}new ResizeObserver(Su).observe(Js);Su();Ke.addEventListener("change",()=>{$t=!0});document.querySelectorAll("[data-view]").forEach(n=>n.onclick=()=>vl(n.dataset.view));oe("camera-reset").onclick=()=>vl("overview");oe("previous-frontage").onclick=()=>kf(-1);oe("next-frontage").onclick=()=>kf(1);oe("street-quiz").onclick=Df;oe("labels").onchange=()=>If();oe("follow-route").onclick=Uf;oe("route").onchange=()=>{ae?.routeOverlay&&(ae.routeOverlay.group.visible=Qt("route"))};oe("inspector-close").onclick=()=>{oe("inspector").hidden=!0,Yi=null,An=null;for(let n of ae?.resources||[])n.setSelected(null)};oe("frame-frontage").onclick=()=>An&&Hr(An);oe("frontage-choice").onchange=()=>Yi&&Ci(Yi,oe("frontage-choice").value);for(let n of["navigation-orbit","navigation-explore"]){let e=n==="navigation-orbit"?"orbit":"explore",t=oe(n);t&&(t.onclick=()=>Vr(e))}oe("building-search-go").onclick=()=>{Pf(oe("building-search").value)};oe("building-search").addEventListener("keydown",n=>{n.key==="Enter"&&(n.preventDefault(),Pf(oe("building-search").value))});oe("search-clear").onclick=()=>{oe("building-search").value="",oe("view-label").textContent="Search cleared"};document.querySelectorAll("button[data-source-tier]").forEach(n=>{n.onclick=()=>Af(n.dataset.sourceTier)});document.querySelectorAll("button[data-camera-preset]").forEach(n=>{n.onclick=()=>gu(n.dataset.cameraPreset)});oe("camera-copy").onclick=async()=>{let n=ov(),e=new URL(location.href);e.search=n.toString();try{await navigator.clipboard?.writeText(e.toString())}catch{let t=document.createElement("a");t.href=e.toString(),t.download="",t.click()}oe("view-label").textContent="Camera link copied"};oe("camera-share").onclick=()=>{Rf(),$t=!0,_u(),oe("view-label").textContent="Camera restored from URL"};oe("refresh").onclick=()=>void Mu();for(let n of["appearance","patterns","machine-preview"])oe(n).onchange=()=>{if(Et&&n!=="patterns"&&Qt(n)){let e=n==="appearance"?"machine-preview":"appearance";oe(e).checked=!1}Mu(!1)};oe("machine-signs").onchange=()=>vu(Qt("machine-signs"));oe("trees").onchange=()=>{ae&&Ki({group:ae.group})};var ml=null,Tf=new ws;function zf(){return["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName||"")}Ks.addEventListener("pointerdown",n=>{ml={x:n.clientX,y:n.clientY}});Ks.addEventListener("pointerup",n=>{if(!ml||Math.hypot(n.clientX-ml.x,n.clientY-ml.y)>5)return;let e=Ks.getBoundingClientRect();Tf.setFromCamera(new Le((n.clientX-e.left)/e.width*2-1,-(n.clientY-e.top)/e.height*2+1),Xe);let t=Tf.intersectObjects(ae?[...ae.resources].flatMap(i=>i.group.children):[],!1);if(t.length)for(let i of ae.resources){let r=i.pick(t[0].object,t[0].faceIndex);if(r){Lf(r.buildingId),Ci(r.buildingId,r.observationId||void 0);break}}});function xl(){_n&&(_n=!1,Ke.enabled=!0,oe("follow-route").textContent="Play street tour")}function Sv(n){if(Gr==="orbit"||!ae||(Ai||(Ai=n),!Object.values(lt).some(Boolean)))return;xl(),Hn=null,Rn="manual",Ki(ae);let e=new k;Xe.getWorldDirection(e),e.y=0,e.normalize();let t=new k(-e.z,0,e.x),i=.015*(lt.fast?1.5:1)*Math.min(1,(n-Ai)/16.7);lt.turnLeft&&Ke.rotateLeft(i),lt.turnRight&&Ke.rotateLeft(-i);let r=new k;if(lt.forward&&r.add(e),lt.backward&&r.sub(e),lt.left&&r.sub(t),lt.right&&r.add(t),r.lengthSq()>1e-4){let s=lt.fast?1.8:.75,a=(n-Ai)/16.7;r.normalize().multiplyScalar(s*a*2.4),Xe.position.add(r),Ke.target.add(r)}Ke.update(),$t=!0,Ai=n,_u()}function Vf(n,e){switch(n){case"ArrowUp":case"KeyW":return lt.forward=e,!0;case"ArrowDown":case"KeyS":return lt.backward=e,!0;case"ArrowLeft":case"KeyA":return lt.left=e,!0;case"ArrowRight":case"KeyD":return lt.right=e,!0;case"KeyQ":return lt.turnLeft=e,!0;case"KeyE":return lt.turnRight=e,!0;case"ShiftLeft":case"ShiftRight":return lt.fast=e,!0}return!1}window.addEventListener("keydown",n=>{if(zf())return;let e=Gr,t=n.key.toLowerCase();if(Vf(n.code,!0)){n.preventDefault(),e!=="explore"&&Vr("explore"),Ai=performance.now();return}t==="f"&&(n.preventDefault(),An&&Hr(An)),t==="o"&&(n.preventDefault(),Vr("orbit")),t==="x"&&(n.preventDefault(),Vr("explore"))});window.addEventListener("keyup",n=>{zf()||(Vf(n.code,!1),Object.values(lt).some(Boolean)||(Ai=0))});document.querySelectorAll("#touch-controls button").forEach(n=>{let e=n.id,t=i=>{e==="move-forward"&&(lt.forward=i),e==="move-backward"&&(lt.backward=i),e==="move-left"&&(lt.left=i),e==="move-right"&&(lt.right=i),e==="turn-left"&&(lt.turnLeft=i),e==="turn-right"&&(lt.turnRight=i),e==="speed-toggle"&&(lt.fast=i),i&&xl()};n.addEventListener("pointerdown",i=>{i.preventDefault(),Gr!=="explore"&&Vr("explore"),t(!0)}),n.addEventListener("pointerup",()=>{t(!1)}),n.addEventListener("pointerleave",()=>{t(!1)})});window.addEventListener("pointerup",()=>{Gr==="explore"&&(lt.forward=!1,lt.backward=!1,lt.left=!1,lt.right=!1,lt.turnLeft=!1,lt.turnRight=!1,lt.fast=!1)});function Gf(n){if(ae?.overviewMassing){ae.overviewMassing.visible=Rn==="overview";for(let e of ae.resources)e.group.visible=Rn!=="overview"}if(!xu){if(requestAnimationFrame(Gf),Mv(n),Sv(n),bv(n),Ke.update(),ae&&$t&&n-Mf>120){let e=yu(ae.context);ae.stream.update(e),ae.contextStream?.update(e),Ai=n,Mf=n,$t=!1}if(Dt.render(rn,Xe),If(),ae&&n-Sf>900){let e=ae.stream.status,t=ae.contextStream?.status;oe("metrics").textContent=`${e.resident}/12 building tiles${t?` \xB7 ${t.resident}/16 context tiles`:""} \xB7 ${Dt.info.render.calls} draws \xB7 ${Dt.info.render.triangles.toLocaleString()} triangles${e.failed.length||t?.failed.length?" \xB7 tile load failed":""}${e.budgetConstrained||t?.budgetConstrained?" \xB7 detailed extent limited":""}`,Sf=n}}}requestAnimationFrame(Gf);var wv=setInterval(()=>void bu(),15e3);window.addEventListener("pagehide",()=>{xu=!0,fu++,pu?.abort(),clearInterval(wv),ae?.stream.dispose(),ae?.contextStream?.dispose(),ae?.routeOverlay?.dispose(),ae?.terrain.dispose(),Ke.dispose(),Dt.dispose()});function Tv(){let n=new Set;for(let e of ae?.resources||[])for(let t of e.group.children)for(let i of t.userData.triangleIdentities||[])i.observationId&&n.add(`${i.buildingId}:${i.sourceSurfaceIndex}:${i.observationId}`);return n.size}window.cityAppearanceDemo={status:()=>({ready:!!ae,developmentCandidate:ae?.manifest.developmentCandidate===!0,releaseId:ae?.manifest.releaseId,reviewed:ae?.manifest.reviewed,buildings:ae?.manifest.buildings,residentBuildings:ae?.owners.size,observations:ae?.manifest.observations,residentObservations:Zi().length,stream:ae?.stream.status,contextStream:ae?.contextStream?.status,displayExtent:ae?.displayExtent,facadeWindows:[...ae?.resources||[]].reduce((n,e)=>n+e.stats.windows,0),facadeDoors:[...ae?.resources||[]].reduce((n,e)=>n+e.stats.doors,0),facadeStorefronts:[...ae?.resources||[]].reduce((n,e)=>n+e.stats.storefronts,0),machineSigns:Ff(),intervalPaintedWalls:Tv(),selectionMeshes:[...ae?.resources||[]].reduce((n,e)=>n+e.group.children.filter(t=>t.userData.runtimeSelection).length,0),contextBridges:[...ae?.contextResources||[]].reduce((n,e)=>n+e.stats.bridges,0),visibleTreeMeshes:pv(),residentBuildingGeometryBufferBytes:[...ae?.resources||[]].reduce((n,e)=>n+e.stats.geometryBufferBytes,0),residentBuildingTextureBytes:[...ae?.resources||[]].reduce((n,e)=>n+e.stats.textureBytes,0),drawCalls:Dt.info.render.calls,triangles:Dt.info.render.triangles,gpuGeometries:Dt.info.memory.geometries,gpuTextures:Dt.info.memory.textures,pixelRatio:zr,shadows:Dt.shadowMap.enabled,adaptiveChanges:hu,selectedId:An,view:Rn,refreshing:pl,quizStreet:Ri,routePlaying:_n,routeDistance:gn,cameraPosition:Xe.position.toArray(),cameraTarget:Ke.target.toArray()}),view:vl,frontage:Hr,select:Ci,refresh:Mu,quiz:Df,answerQuiz:Lf,buildingStreets:()=>ae?[...ae.owners].map(([n,e])=>({id:n,street:e.geometry.building.street})):[],route:Uf,routeAt:Of,whenIdle:async()=>{if(ae&&$t){let n=yu(ae.context);ae.stream.update(n),ae.contextStream?.update(n),$t=!1}await Promise.all([ae?.stream.whenIdle(),ae?.contextStream?.whenIdle()]);for(let n of ae?.resources||[])n.flush();await new Promise(n=>requestAnimationFrame(()=>requestAnimationFrame(()=>n())))},records:Zi,context:()=>ae?.context};if(Et){document.title="Da Costa \xB7 expansion geometry",document.querySelector("h1").innerHTML="A larger piece<br>of Amsterdam.",document.querySelector(".eyebrow").textContent="Amsterdam \xB7 source geometry at neighbourhood scale",document.querySelector("h1 + .muted").textContent="Two Amsterdam districts with source buildings, streets, canals and inventory trees.",oe("patterns").closest("label").hidden=!0,oe("street-quiz").hidden=!1,oe("follow-route").hidden=!1,oe("machine-preview").checked=!1,oe("appearance").checked=!1,oe("machine-signs").checked=!0,oe("machine-signs-label").hidden=!1,oe("appearance").nextElementSibling.textContent="Audited source-wall coverage",oe("appearance-copy").textContent="Machine-observed storefronts and shop names are unreviewed. Machine wall colours are optional. The city-wide palette is a deterministic construction-era visualization prior. Switch to audited coverage: green means usable evidence, ochre means partial.";for(let t of["previous-frontage","next-frontage","refresh","review-heading","review-copy"])oe(t).hidden=!0;let n=oe("evidence-link");n.href="./panorama-audit.html",n.textContent="See the new street evidence \u2197";let e=oe("pipeline-link");e.href="./EXPANSION_DEMO_2026-09-10.md",e.textContent="What this demo proves",oe("release-status").textContent="Loading immutable expansion geometry\u2026",oe("view-label").textContent="Da Costa expansion \xB7 source geometry"}else oe("machine-preview").closest("label").hidden=!0,oe("labels").closest("label").hidden=!0,oe("route").closest("label").hidden=!0;Bf().then(()=>{let n=Gn.get("frontage"),e=Gn.get("inspect");if(n)Hr(n);else if(vl("overview"),e){let t=Zi().find(i=>i.id===e);t&&Ci(t.renderBuildingId||t.buildingId,t.id)}bu()}).catch(n=>{oe("loading").textContent=String(n),oe("loading").classList.add("error")});
/*! Bundled license information:

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/

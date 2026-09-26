var ni={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},ii={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},Oc=0,sl=1,Bc=2;var Ks=1,zc=2,is=3,fn=0,Gt=1,Ht=2,wn=0,vi=1,rl=2,al=3,ol=4,kc=5;var $n=100,Vc=101,Gc=102,Hc=103,Wc=104,Xc=200,qc=201,Yc=202,Zc=203,Vr=204,Gr=205,$c=206,Kc=207,Jc=208,jc=209,Qc=210,eh=211,th=212,nh=213,ih=214,Hr=0,Wr=1,Xr=2,bi=3,qr=4,Yr=5,Zr=6,$r=7,ll=0,sh=1,rh=2,mn=0,cl=1,hl=2,ul=3,dl=4,fl=5,pl=6,ml=7;var gl=300,si=301,Si=302,ya=303,va=304,Js=306,Kr=1e3,Mn=1001,Jr=1002,It=1003,ah=1004;var js=1005;var wt=1006,ba=1007;var ri=1008;var qt=1009,_l=1010,xl=1011,ss=1012,Ma=1013,gn=1014,_n=1015,Tn=1016,Sa=1017,wa=1018,rs=1020,yl=35902,vl=35899,bl=1021,Ml=1022,on=1023,Sn=1026,ai=1027,Sl=1028,Ta=1029,oi=1030,Ea=1031;var Aa=1033,Qs=33776,er=33777,tr=33778,nr=33779,Ra=35840,Ca=35841,Pa=35842,Ia=35843,Da=36196,La=37492,Fa=37496,Na=37488,Ua=37489,ir=37490,Oa=37491,Ba=37808,za=37809,ka=37810,Va=37811,Ga=37812,Ha=37813,Wa=37814,Xa=37815,qa=37816,Ya=37817,Za=37818,$a=37819,Ka=37820,Ja=37821,ja=36492,Qa=36494,eo=36495,to=36283,no=36284,sr=36285,io=36286;var As=2300,jr=2301,kr=2302,Xo=2303,qo=2400,Yo=2401,Zo=2402;var oh=3200;var so=0,lh=1,Bn="",Pt="srgb",Rs="srgb-linear",Cs="linear",nt="srgb";var xi=7680;var $o=519,ch=512,hh=513,uh=514,ro=515,dh=516,fh=517,ao=518,ph=519,Ko=35044;var wl="300 es",dn=2e3,Wi=2001;function id(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function sd(n){return ArrayBuffer.isView(n)&&!(n instanceof DataView)}function Ps(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function mh(){let n=Ps("canvas");return n.style.display="block",n}var fc={},Xi=null;function Tl(...n){let e="THREE."+n.shift();Xi?Xi("log",e,...n):console.log(e,...n)}function gh(n){let e=n[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=n[1];t&&t.isStackTrace?n[0]+=" "+t.getLocation():n[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return n}function Fe(...n){n=gh(n);let e="THREE."+n.shift();if(Xi)Xi("warn",e,...n);else{let t=n[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...n)}}function Be(...n){n=gh(n);let e="THREE."+n.shift();if(Xi)Xi("error",e,...n);else{let t=n[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...n)}}function yi(...n){let e=n.join(" ");e in fc||(fc[e]=!0,Fe(...n))}function _h(n,e,t){return new Promise(function(i,s){function r(){switch(n.clientWaitSync(e,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:s();break;case n.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:i()}}setTimeout(r,t)})}var xh={[Hr]:Wr,[Xr]:Zr,[qr]:$r,[bi]:Yr,[Wr]:Hr,[Zr]:Xr,[$r]:qr,[Yr]:bi},pn=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){let i=this._listeners;return i===void 0?!1:i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){let i=this._listeners;if(i===void 0)return;let s=i[e];if(s!==void 0){let r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let i=t[e.type];if(i!==void 0){e.target=this;let s=i.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,e);e.target=null}}},Nt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],pc=1234567,Ts=Math.PI/180,qi=180/Math.PI;function as(){let n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Nt[n&255]+Nt[n>>8&255]+Nt[n>>16&255]+Nt[n>>24&255]+"-"+Nt[e&255]+Nt[e>>8&255]+"-"+Nt[e>>16&15|64]+Nt[e>>24&255]+"-"+Nt[t&63|128]+Nt[t>>8&255]+"-"+Nt[t>>16&255]+Nt[t>>24&255]+Nt[i&255]+Nt[i>>8&255]+Nt[i>>16&255]+Nt[i>>24&255]).toLowerCase()}function je(n,e,t){return Math.max(e,Math.min(t,n))}function El(n,e){return(n%e+e)%e}function rd(n,e,t,i,s){return i+(n-e)*(s-i)/(t-e)}function ad(n,e,t){return n!==e?(t-n)/(e-n):0}function Es(n,e,t){return(1-t)*n+t*e}function od(n,e,t,i){return Es(n,e,1-Math.exp(-t*i))}function ld(n,e=1){return e-Math.abs(El(n,e*2)-e)}function cd(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*(3-2*n))}function hd(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*n*(n*(n*6-15)+10))}function ud(n,e){return n+Math.floor(Math.random()*(e-n+1))}function dd(n,e){return n+Math.random()*(e-n)}function fd(n){return n*(.5-Math.random())}function pd(n){n!==void 0&&(pc=n);let e=pc+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function md(n){return n*Ts}function gd(n){return n*qi}function _d(n){return(n&n-1)===0&&n!==0}function xd(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))}function yd(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))}function vd(n,e,t,i,s){let r=Math.cos,a=Math.sin,o=r(t/2),l=a(t/2),c=r((e+i)/2),u=a((e+i)/2),d=r((e-i)/2),h=a((e-i)/2),f=r((i-e)/2),g=a((i-e)/2);switch(s){case"XYX":n.set(o*u,l*d,l*h,o*c);break;case"YZY":n.set(l*h,o*u,l*d,o*c);break;case"ZXZ":n.set(l*d,l*h,o*u,o*c);break;case"XZX":n.set(o*u,l*g,l*f,o*c);break;case"YXY":n.set(l*f,o*u,l*g,o*c);break;case"ZYZ":n.set(l*g,l*f,o*u,o*c);break;default:Fe("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function Gi(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function kt(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Al={DEG2RAD:Ts,RAD2DEG:qi,generateUUID:as,clamp:je,euclideanModulo:El,mapLinear:rd,inverseLerp:ad,lerp:Es,damp:od,pingpong:ld,smoothstep:cd,smootherstep:hd,randInt:ud,randFloat:dd,randFloatSpread:fd,seededRandom:pd,degToRad:md,radToDeg:gd,isPowerOfTwo:_d,ceilPowerOfTwo:xd,floorPowerOfTwo:yd,setQuaternionFromProperEuler:vd,normalize:kt,denormalize:Gi},ze=class n{static{n.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,i=this.y,s=e.elements;return this.x=s[0]*t+s[3]*i+s[6],this.y=s[1]*t+s[4]*i+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=je(this.x,e.x,t.x),this.y=je(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=je(this.x,e,t),this.y=je(this.y,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(je(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(je(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let i=Math.cos(t),s=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*i-a*s+e.x,this.y=r*s+a*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},jt=class{constructor(e=0,t=0,i=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=s}static slerpFlat(e,t,i,s,r,a,o){let l=i[s+0],c=i[s+1],u=i[s+2],d=i[s+3],h=r[a+0],f=r[a+1],g=r[a+2],M=r[a+3];if(d!==M||l!==h||c!==f||u!==g){let m=l*h+c*f+u*g+d*M;m<0&&(h=-h,f=-f,g=-g,M=-M,m=-m);let p=1-o;if(m<.9995){let R=Math.acos(m),A=Math.sin(R);p=Math.sin(p*R)/A,o=Math.sin(o*R)/A,l=l*p+h*o,c=c*p+f*o,u=u*p+g*o,d=d*p+M*o}else{l=l*p+h*o,c=c*p+f*o,u=u*p+g*o,d=d*p+M*o;let R=1/Math.sqrt(l*l+c*c+u*u+d*d);l*=R,c*=R,u*=R,d*=R}}e[t]=l,e[t+1]=c,e[t+2]=u,e[t+3]=d}static multiplyQuaternionsFlat(e,t,i,s,r,a){let o=i[s],l=i[s+1],c=i[s+2],u=i[s+3],d=r[a],h=r[a+1],f=r[a+2],g=r[a+3];return e[t]=o*g+u*d+l*f-c*h,e[t+1]=l*g+u*h+c*d-o*f,e[t+2]=c*g+u*f+o*h-l*d,e[t+3]=u*g-o*d-l*h-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,s){return this._x=e,this._y=t,this._z=i,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let i=e._x,s=e._y,r=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(i/2),u=o(s/2),d=o(r/2),h=l(i/2),f=l(s/2),g=l(r/2);switch(a){case"XYZ":this._x=h*u*d+c*f*g,this._y=c*f*d-h*u*g,this._z=c*u*g+h*f*d,this._w=c*u*d-h*f*g;break;case"YXZ":this._x=h*u*d+c*f*g,this._y=c*f*d-h*u*g,this._z=c*u*g-h*f*d,this._w=c*u*d+h*f*g;break;case"ZXY":this._x=h*u*d-c*f*g,this._y=c*f*d+h*u*g,this._z=c*u*g+h*f*d,this._w=c*u*d-h*f*g;break;case"ZYX":this._x=h*u*d-c*f*g,this._y=c*f*d+h*u*g,this._z=c*u*g-h*f*d,this._w=c*u*d+h*f*g;break;case"YZX":this._x=h*u*d+c*f*g,this._y=c*f*d+h*u*g,this._z=c*u*g-h*f*d,this._w=c*u*d-h*f*g;break;case"XZY":this._x=h*u*d-c*f*g,this._y=c*f*d-h*u*g,this._z=c*u*g+h*f*d,this._w=c*u*d+h*f*g;break;default:Fe("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let i=t/2,s=Math.sin(i);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,i=t[0],s=t[4],r=t[8],a=t[1],o=t[5],l=t[9],c=t[2],u=t[6],d=t[10],h=i+o+d;if(h>0){let f=.5/Math.sqrt(h+1);this._w=.25/f,this._x=(u-l)*f,this._y=(r-c)*f,this._z=(a-s)*f}else if(i>o&&i>d){let f=2*Math.sqrt(1+i-o-d);this._w=(u-l)/f,this._x=.25*f,this._y=(s+a)/f,this._z=(r+c)/f}else if(o>d){let f=2*Math.sqrt(1+o-i-d);this._w=(r-c)/f,this._x=(s+a)/f,this._y=.25*f,this._z=(l+u)/f}else{let f=2*Math.sqrt(1+d-i-o);this._w=(a-s)/f,this._x=(r+c)/f,this._y=(l+u)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<1e-8?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(je(this.dot(e),-1,1)))}rotateTowards(e,t){let i=this.angleTo(e);if(i===0)return this;let s=Math.min(1,t/i);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let i=e._x,s=e._y,r=e._z,a=e._w,o=t._x,l=t._y,c=t._z,u=t._w;return this._x=i*u+a*o+s*c-r*l,this._y=s*u+a*l+r*o-i*c,this._z=r*u+a*c+i*l-s*o,this._w=a*u-i*o-s*l-r*c,this._onChangeCallback(),this}slerp(e,t){let i=e._x,s=e._y,r=e._z,a=e._w,o=this.dot(e);o<0&&(i=-i,s=-s,r=-r,a=-a,o=-o);let l=1-t;if(o<.9995){let c=Math.acos(o),u=Math.sin(c);l=Math.sin(l*c)/u,t=Math.sin(t*c)/u,this._x=this._x*l+i*t,this._y=this._y*l+s*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this._onChangeCallback()}else this._x=this._x*l+i*t,this._y=this._y*l+s*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this.normalize();return this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),s=Math.sqrt(1-i),r=Math.sqrt(i);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},V=class n{static{n.prototype.isVector3=!0}constructor(e=0,t=0,i=0){this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(mc.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(mc.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,i=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6]*s,this.y=r[1]*t+r[4]*i+r[7]*s,this.z=r[2]*t+r[5]*i+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,i=this.y,s=this.z,r=e.elements,a=1/(r[3]*t+r[7]*i+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*i+r[8]*s+r[12])*a,this.y=(r[1]*t+r[5]*i+r[9]*s+r[13])*a,this.z=(r[2]*t+r[6]*i+r[10]*s+r[14])*a,this}applyQuaternion(e){let t=this.x,i=this.y,s=this.z,r=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*s-o*i),u=2*(o*t-r*s),d=2*(r*i-a*t);return this.x=t+l*c+a*d-o*u,this.y=i+l*u+o*c-r*d,this.z=s+l*d+r*u-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,i=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*i+r[8]*s,this.y=r[1]*t+r[5]*i+r[9]*s,this.z=r[2]*t+r[6]*i+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=je(this.x,e.x,t.x),this.y=je(this.y,e.y,t.y),this.z=je(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=je(this.x,e,t),this.y=je(this.y,e,t),this.z=je(this.z,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(je(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let i=e.x,s=e.y,r=e.z,a=t.x,o=t.y,l=t.z;return this.x=s*l-r*o,this.y=r*a-i*l,this.z=i*o-s*a,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return So.copy(this).projectOnVector(e),this.sub(So)}reflect(e){return this.sub(So.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(je(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y,s=this.z-e.z;return t*t+i*i+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){let s=Math.sin(t)*e;return this.x=s*Math.sin(i),this.y=Math.cos(t)*e,this.z=s*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},So=new V,mc=new jt,Ge=class n{static{n.prototype.isMatrix3=!0}constructor(e,t,i,s,r,a,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,s,r,a,o,l,c)}set(e,t,i,s,r,a,o,l,c){let u=this.elements;return u[0]=e,u[1]=s,u[2]=o,u[3]=t,u[4]=r,u[5]=l,u[6]=i,u[7]=a,u[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,s=t.elements,r=this.elements,a=i[0],o=i[3],l=i[6],c=i[1],u=i[4],d=i[7],h=i[2],f=i[5],g=i[8],M=s[0],m=s[3],p=s[6],R=s[1],A=s[4],v=s[7],E=s[2],_=s[5],P=s[8];return r[0]=a*M+o*R+l*E,r[3]=a*m+o*A+l*_,r[6]=a*p+o*v+l*P,r[1]=c*M+u*R+d*E,r[4]=c*m+u*A+d*_,r[7]=c*p+u*v+d*P,r[2]=h*M+f*R+g*E,r[5]=h*m+f*A+g*_,r[8]=h*p+f*v+g*P,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8];return t*a*u-t*o*c-i*r*u+i*o*l+s*r*c-s*a*l}invert(){let e=this.elements,t=e[0],i=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8],d=u*a-o*c,h=o*l-u*r,f=c*r-a*l,g=t*d+i*h+s*f;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let M=1/g;return e[0]=d*M,e[1]=(s*c-u*i)*M,e[2]=(o*i-s*a)*M,e[3]=h*M,e[4]=(u*t-s*l)*M,e[5]=(s*r-o*t)*M,e[6]=f*M,e[7]=(i*l-c*t)*M,e[8]=(a*t-i*r)*M,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,s,r,a,o){let l=Math.cos(r),c=Math.sin(r);return this.set(i*l,i*c,-i*(l*a+c*o)+a+e,-s*c,s*l,-s*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return yi("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(wo.makeScale(e,t)),this}rotate(e){return yi("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(wo.makeRotation(-e)),this}translate(e,t){return yi("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(wo.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,i=e.elements;for(let s=0;s<9;s++)if(t[s]!==i[s])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}},wo=new Ge,gc=new Ge().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),_c=new Ge().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function bd(){let n={enabled:!0,workingColorSpace:Rs,spaces:{},convert:function(s,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===nt&&(s.r=Ln(s.r),s.g=Ln(s.g),s.b=Ln(s.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===nt&&(s.r=Hi(s.r),s.g=Hi(s.g),s.b=Hi(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Bn?Cs:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,a){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return yi("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),n.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return yi("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),n.colorSpaceToWorking(s,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],i=[.3127,.329];return n.define({[Rs]:{primaries:e,whitePoint:i,transfer:Cs,toXYZ:gc,fromXYZ:_c,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Pt},outputColorSpaceConfig:{drawingBufferColorSpace:Pt}},[Pt]:{primaries:e,whitePoint:i,transfer:nt,toXYZ:gc,fromXYZ:_c,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Pt}}}),n}var Qe=bd();function Ln(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function Hi(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}var Pi,Qr=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let i;if(e instanceof HTMLCanvasElement)i=e;else{Pi===void 0&&(Pi=Ps("canvas")),Pi.width=e.width,Pi.height=e.height;let s=Pi.getContext("2d");e instanceof ImageData?s.putImageData(e,0,0):s.drawImage(e,0,0,e.width,e.height),i=Pi}return i.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=Ps("canvas");t.width=e.width,t.height=e.height;let i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);let s=i.getImageData(0,0,e.width,e.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=Ln(r[a]/255)*255;return i.putImageData(s,0,0),t}else if(e.data){let t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor(Ln(t[i]/255)*255):t[i]=Ln(t[i]);return{data:t,width:e.width,height:e.height}}else return Fe("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},Md=0,Yi=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Md++}),this.uuid=as(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let i={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(To(s[a].image)):r.push(To(s[a]))}else r=To(s);i.url=r}return t||(e.images[this.uuid]=i),i}};function To(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?Qr.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(Fe("Texture: Unable to serialize Texture."),{})}var Sd=0,Eo=new V,Vt=class n extends pn{constructor(e=n.DEFAULT_IMAGE,t=n.DEFAULT_MAPPING,i=Mn,s=Mn,r=wt,a=ri,o=on,l=qt,c=n.DEFAULT_ANISOTROPY,u=Bn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Sd++}),this.uuid=as(),this.name="",this.source=new Yi(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new ze(0,0),this.repeat=new ze(1,1),this.center=new ze(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ge,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Eo).x}get height(){return this.source.getSize(Eo).y}get depth(){return this.source.getSize(Eo).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let i=e[t];if(i===void 0){Fe(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let s=this[t];if(s===void 0){Fe(`Texture.setValues(): property '${t}' does not exist.`);continue}s&&i&&s.isVector2&&i.isVector2||s&&i&&s.isVector3&&i.isVector3||s&&i&&s.isMatrix3&&i.isMatrix3?s.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==gl)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Kr:e.x=e.x-Math.floor(e.x);break;case Mn:e.x=e.x<0?0:1;break;case Jr:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Kr:e.y=e.y-Math.floor(e.y);break;case Mn:e.y=e.y<0?0:1;break;case Jr:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Vt.DEFAULT_IMAGE=null;Vt.DEFAULT_MAPPING=gl;Vt.DEFAULT_ANISOTROPY=1;var mt=class n{static{n.prototype.isVector4=!0}constructor(e=0,t=0,i=0,s=1){this.x=e,this.y=t,this.z=i,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,s){return this.x=e,this.y=t,this.z=i,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,i=this.y,s=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*i+a[8]*s+a[12]*r,this.y=a[1]*t+a[5]*i+a[9]*s+a[13]*r,this.z=a[2]*t+a[6]*i+a[10]*s+a[14]*r,this.w=a[3]*t+a[7]*i+a[11]*s+a[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,s,r,l=e.elements,c=l[0],u=l[4],d=l[8],h=l[1],f=l[5],g=l[9],M=l[2],m=l[6],p=l[10];if(Math.abs(u-h)<.01&&Math.abs(d-M)<.01&&Math.abs(g-m)<.01){if(Math.abs(u+h)<.1&&Math.abs(d+M)<.1&&Math.abs(g+m)<.1&&Math.abs(c+f+p-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let A=(c+1)/2,v=(f+1)/2,E=(p+1)/2,_=(u+h)/4,P=(d+M)/4,y=(g+m)/4;return A>v&&A>E?A<.01?(i=0,s=.707106781,r=.707106781):(i=Math.sqrt(A),s=_/i,r=P/i):v>E?v<.01?(i=.707106781,s=0,r=.707106781):(s=Math.sqrt(v),i=_/s,r=y/s):E<.01?(i=.707106781,s=.707106781,r=0):(r=Math.sqrt(E),i=P/r,s=y/r),this.set(i,s,r,t),this}let R=Math.sqrt((m-g)*(m-g)+(d-M)*(d-M)+(h-u)*(h-u));return Math.abs(R)<.001&&(R=1),this.x=(m-g)/R,this.y=(d-M)/R,this.z=(h-u)/R,this.w=Math.acos((c+f+p-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=je(this.x,e.x,t.x),this.y=je(this.y,e.y,t.y),this.z=je(this.z,e.z,t.z),this.w=je(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=je(this.x,e,t),this.y=je(this.y,e,t),this.z=je(this.z,e,t),this.w=je(this.w,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(je(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},ea=class extends pn{constructor(e=1,t=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:wt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=i.depth,this.scissor=new mt(0,0,e,t),this.scissorTest=!1,this.viewport=new mt(0,0,e,t),this.textures=[];let s={width:e,height:t,depth:i.depth},r=new Vt(s),a=i.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:wt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=i,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,i=e.textures.length;t<i;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let s=Object.assign({},e.textures[t].image);this.textures[t].source=new Yi(s)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},Qt=class extends ea{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}},Is=class extends Vt{constructor(e=null,t=1,i=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:s},this.magFilter=It,this.minFilter=It,this.wrapR=Mn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var ta=class extends Vt{constructor(e=null,t=1,i=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:s},this.magFilter=It,this.minFilter=It,this.wrapR=Mn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var pt=class n{static{n.prototype.isMatrix4=!0}constructor(e,t,i,s,r,a,o,l,c,u,d,h,f,g,M,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,s,r,a,o,l,c,u,d,h,f,g,M,m)}set(e,t,i,s,r,a,o,l,c,u,d,h,f,g,M,m){let p=this.elements;return p[0]=e,p[4]=t,p[8]=i,p[12]=s,p[1]=r,p[5]=a,p[9]=o,p[13]=l,p[2]=c,p[6]=u,p[10]=d,p[14]=h,p[3]=f,p[7]=g,p[11]=M,p[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new n().fromArray(this.elements)}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){let t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),i.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,i=e.elements,s=1/Ii.setFromMatrixColumn(e,0).length(),r=1/Ii.setFromMatrixColumn(e,1).length(),a=1/Ii.setFromMatrixColumn(e,2).length();return t[0]=i[0]*s,t[1]=i[1]*s,t[2]=i[2]*s,t[3]=0,t[4]=i[4]*r,t[5]=i[5]*r,t[6]=i[6]*r,t[7]=0,t[8]=i[8]*a,t[9]=i[9]*a,t[10]=i[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,i=e.x,s=e.y,r=e.z,a=Math.cos(i),o=Math.sin(i),l=Math.cos(s),c=Math.sin(s),u=Math.cos(r),d=Math.sin(r);if(e.order==="XYZ"){let h=a*u,f=a*d,g=o*u,M=o*d;t[0]=l*u,t[4]=-l*d,t[8]=c,t[1]=f+g*c,t[5]=h-M*c,t[9]=-o*l,t[2]=M-h*c,t[6]=g+f*c,t[10]=a*l}else if(e.order==="YXZ"){let h=l*u,f=l*d,g=c*u,M=c*d;t[0]=h+M*o,t[4]=g*o-f,t[8]=a*c,t[1]=a*d,t[5]=a*u,t[9]=-o,t[2]=f*o-g,t[6]=M+h*o,t[10]=a*l}else if(e.order==="ZXY"){let h=l*u,f=l*d,g=c*u,M=c*d;t[0]=h-M*o,t[4]=-a*d,t[8]=g+f*o,t[1]=f+g*o,t[5]=a*u,t[9]=M-h*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){let h=a*u,f=a*d,g=o*u,M=o*d;t[0]=l*u,t[4]=g*c-f,t[8]=h*c+M,t[1]=l*d,t[5]=M*c+h,t[9]=f*c-g,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){let h=a*l,f=a*c,g=o*l,M=o*c;t[0]=l*u,t[4]=M-h*d,t[8]=g*d+f,t[1]=d,t[5]=a*u,t[9]=-o*u,t[2]=-c*u,t[6]=f*d+g,t[10]=h-M*d}else if(e.order==="XZY"){let h=a*l,f=a*c,g=o*l,M=o*c;t[0]=l*u,t[4]=-d,t[8]=c*u,t[1]=h*d+M,t[5]=a*u,t[9]=f*d-g,t[2]=g*d-f,t[6]=o*u,t[10]=M*d+h}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(wd,e,Td)}lookAt(e,t,i){let s=this.elements;return Kt.subVectors(e,t),Kt.lengthSq()===0&&(Kt.z=1),Kt.normalize(),Gn.crossVectors(i,Kt),Gn.lengthSq()===0&&(Math.abs(i.z)===1?Kt.x+=1e-4:Kt.z+=1e-4,Kt.normalize(),Gn.crossVectors(i,Kt)),Gn.normalize(),xr.crossVectors(Kt,Gn),s[0]=Gn.x,s[4]=xr.x,s[8]=Kt.x,s[1]=Gn.y,s[5]=xr.y,s[9]=Kt.y,s[2]=Gn.z,s[6]=xr.z,s[10]=Kt.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,s=t.elements,r=this.elements,a=i[0],o=i[4],l=i[8],c=i[12],u=i[1],d=i[5],h=i[9],f=i[13],g=i[2],M=i[6],m=i[10],p=i[14],R=i[3],A=i[7],v=i[11],E=i[15],_=s[0],P=s[4],y=s[8],C=s[12],w=s[1],T=s[5],D=s[9],B=s[13],L=s[2],I=s[6],G=s[10],N=s[14],k=s[3],$=s[7],j=s[11],ne=s[15];return r[0]=a*_+o*w+l*L+c*k,r[4]=a*P+o*T+l*I+c*$,r[8]=a*y+o*D+l*G+c*j,r[12]=a*C+o*B+l*N+c*ne,r[1]=u*_+d*w+h*L+f*k,r[5]=u*P+d*T+h*I+f*$,r[9]=u*y+d*D+h*G+f*j,r[13]=u*C+d*B+h*N+f*ne,r[2]=g*_+M*w+m*L+p*k,r[6]=g*P+M*T+m*I+p*$,r[10]=g*y+M*D+m*G+p*j,r[14]=g*C+M*B+m*N+p*ne,r[3]=R*_+A*w+v*L+E*k,r[7]=R*P+A*T+v*I+E*$,r[11]=R*y+A*D+v*G+E*j,r[15]=R*C+A*B+v*N+E*ne,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[4],s=e[8],r=e[12],a=e[1],o=e[5],l=e[9],c=e[13],u=e[2],d=e[6],h=e[10],f=e[14],g=e[3],M=e[7],m=e[11],p=e[15],R=l*f-c*h,A=o*f-c*d,v=o*h-l*d,E=a*f-c*u,_=a*h-l*u,P=a*d-o*u;return t*(M*R-m*A+p*v)-i*(g*R-m*E+p*_)+s*(g*A-M*E+p*P)-r*(g*v-M*_+m*P)}determinantAffine(){let e=this.elements,t=e[0],i=e[4],s=e[8],r=e[1],a=e[5],o=e[9],l=e[2],c=e[6],u=e[10];return t*(a*u-o*c)-i*(r*u-o*l)+s*(r*c-a*l)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){let s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=i),this}invert(){let e=this.elements,t=e[0],i=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8],d=e[9],h=e[10],f=e[11],g=e[12],M=e[13],m=e[14],p=e[15],R=t*o-i*a,A=t*l-s*a,v=t*c-r*a,E=i*l-s*o,_=i*c-r*o,P=s*c-r*l,y=u*M-d*g,C=u*m-h*g,w=u*p-f*g,T=d*m-h*M,D=d*p-f*M,B=h*p-f*m,L=R*B-A*D+v*T+E*w-_*C+P*y;if(L===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let I=1/L;return e[0]=(o*B-l*D+c*T)*I,e[1]=(s*D-i*B-r*T)*I,e[2]=(M*P-m*_+p*E)*I,e[3]=(h*_-d*P-f*E)*I,e[4]=(l*w-a*B-c*C)*I,e[5]=(t*B-s*w+r*C)*I,e[6]=(m*v-g*P-p*A)*I,e[7]=(u*P-h*v+f*A)*I,e[8]=(a*D-o*w+c*y)*I,e[9]=(i*w-t*D-r*y)*I,e[10]=(g*_-M*v+p*R)*I,e[11]=(d*v-u*_-f*R)*I,e[12]=(o*C-a*T-l*y)*I,e[13]=(t*T-i*C+s*y)*I,e[14]=(M*A-g*E-m*R)*I,e[15]=(u*E-d*A+h*R)*I,this}scale(e){let t=this.elements,i=e.x,s=e.y,r=e.z;return t[0]*=i,t[4]*=s,t[8]*=r,t[1]*=i,t[5]*=s,t[9]*=r,t[2]*=i,t[6]*=s,t[10]*=r,t[3]*=i,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,s))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let i=Math.cos(t),s=Math.sin(t),r=1-i,a=e.x,o=e.y,l=e.z,c=r*a,u=r*o;return this.set(c*a+i,c*o-s*l,c*l+s*o,0,c*o+s*l,u*o+i,u*l-s*a,0,c*l-s*o,u*l+s*a,r*l*l+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,s,r,a){return this.set(1,i,r,0,e,1,a,0,t,s,1,0,0,0,0,1),this}compose(e,t,i){let s=this.elements,r=t._x,a=t._y,o=t._z,l=t._w,c=r+r,u=a+a,d=o+o,h=r*c,f=r*u,g=r*d,M=a*u,m=a*d,p=o*d,R=l*c,A=l*u,v=l*d,E=i.x,_=i.y,P=i.z;return s[0]=(1-(M+p))*E,s[1]=(f+v)*E,s[2]=(g-A)*E,s[3]=0,s[4]=(f-v)*_,s[5]=(1-(h+p))*_,s[6]=(m+R)*_,s[7]=0,s[8]=(g+A)*P,s[9]=(m-R)*P,s[10]=(1-(h+M))*P,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,i){let s=this.elements;e.x=s[12],e.y=s[13],e.z=s[14];let r=this.determinantAffine();if(r===0)return i.set(1,1,1),t.identity(),this;let a=Ii.set(s[0],s[1],s[2]).length(),o=Ii.set(s[4],s[5],s[6]).length(),l=Ii.set(s[8],s[9],s[10]).length();r<0&&(a=-a),cn.copy(this);let c=1/a,u=1/o,d=1/l;return cn.elements[0]*=c,cn.elements[1]*=c,cn.elements[2]*=c,cn.elements[4]*=u,cn.elements[5]*=u,cn.elements[6]*=u,cn.elements[8]*=d,cn.elements[9]*=d,cn.elements[10]*=d,t.setFromRotationMatrix(cn),i.x=a,i.y=o,i.z=l,this}makePerspective(e,t,i,s,r,a,o=dn,l=!1){let c=this.elements,u=2*r/(t-e),d=2*r/(i-s),h=(t+e)/(t-e),f=(i+s)/(i-s),g,M;if(l)g=r/(a-r),M=a*r/(a-r);else if(o===dn)g=-(a+r)/(a-r),M=-2*a*r/(a-r);else if(o===Wi)g=-a/(a-r),M=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=u,c[4]=0,c[8]=h,c[12]=0,c[1]=0,c[5]=d,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=M,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,i,s,r,a,o=dn,l=!1){let c=this.elements,u=2/(t-e),d=2/(i-s),h=-(t+e)/(t-e),f=-(i+s)/(i-s),g,M;if(l)g=1/(a-r),M=a/(a-r);else if(o===dn)g=-2/(a-r),M=-(a+r)/(a-r);else if(o===Wi)g=-1/(a-r),M=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=u,c[4]=0,c[8]=0,c[12]=h,c[1]=0,c[5]=d,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=g,c[14]=M,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,i=e.elements;for(let s=0;s<16;s++)if(t[s]!==i[s])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}},Ii=new V,cn=new pt,wd=new V(0,0,0),Td=new V(1,1,1),Gn=new V,xr=new V,Kt=new V,xc=new pt,yc=new jt,Fn=class n{constructor(e=0,t=0,i=0,s=n.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,s=this._order){return this._x=e,this._y=t,this._z=i,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){let s=e.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],u=s[9],d=s[2],h=s[6],f=s[10];switch(t){case"XYZ":this._y=Math.asin(je(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-u,f),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(h,c),this._z=0);break;case"YXZ":this._x=Math.asin(-je(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-d,r),this._z=0);break;case"ZXY":this._x=Math.asin(je(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(-d,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-je(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(h,f),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(je(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-u,c),this._y=Math.atan2(-d,r)):(this._x=0,this._y=Math.atan2(o,f));break;case"XZY":this._z=Math.asin(-je(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(h,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-u,f),this._y=0);break;default:Fe("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return xc.makeRotationFromQuaternion(e),this.setFromRotationMatrix(xc,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return yc.setFromEuler(this),this.setFromQuaternion(yc,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Fn.DEFAULT_ORDER="XYZ";var Ds=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},Ed=0,vc=new V,Di=new jt,Rn=new pt,yr=new V,vs=new V,Ad=new V,Rd=new jt,bc=new V(1,0,0),Mc=new V(0,1,0),Sc=new V(0,0,1),wc={type:"added"},Cd={type:"removed"},Li={type:"childadded",child:null},Ao={type:"childremoved",child:null},Bt=class n extends pn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Ed++}),this.uuid=as(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=n.DEFAULT_UP.clone();let e=new V,t=new Fn,i=new jt,s=new V(1,1,1);function r(){i.setFromEuler(t,!1)}function a(){t.setFromQuaternion(i,void 0,!1)}t._onChange(r),i._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new pt},normalMatrix:{value:new Ge}}),this.matrix=new pt,this.matrixWorld=new pt,this.matrixAutoUpdate=n.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=n.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Ds,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Di.setFromAxisAngle(e,t),this.quaternion.multiply(Di),this}rotateOnWorldAxis(e,t){return Di.setFromAxisAngle(e,t),this.quaternion.premultiply(Di),this}rotateX(e){return this.rotateOnAxis(bc,e)}rotateY(e){return this.rotateOnAxis(Mc,e)}rotateZ(e){return this.rotateOnAxis(Sc,e)}translateOnAxis(e,t){return vc.copy(e).applyQuaternion(this.quaternion),this.position.add(vc.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(bc,e)}translateY(e){return this.translateOnAxis(Mc,e)}translateZ(e){return this.translateOnAxis(Sc,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Rn.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?yr.copy(e):yr.set(e,t,i);let s=this.parent;this.updateWorldMatrix(!0,!1),vs.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Rn.lookAt(vs,yr,this.up):Rn.lookAt(yr,vs,this.up),this.quaternion.setFromRotationMatrix(Rn),s&&(Rn.extractRotation(s.matrixWorld),Di.setFromRotationMatrix(Rn),this.quaternion.premultiply(Di.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Be("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(wc),Li.child=e,this.dispatchEvent(Li),Li.child=null):Be("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Cd),Ao.child=e,this.dispatchEvent(Ao),Ao.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Rn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Rn.multiply(e.parent.matrixWorld)),e.applyMatrix4(Rn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(wc),Li.child=e,this.dispatchEvent(Li),Li.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,s=this.children.length;i<s;i++){let a=this.children[i].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);let s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(vs,e,Ad),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(vs,Rd,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let i=0,s=t.length;i<s;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let i=0,s=t.length;i<s;i++)t[i].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,i=e.y,s=e.z,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*i-r[8]*s,r[13]+=i-r[1]*t-r[5]*i-r[9]*s,r[14]+=s-r[2]*t-r[6]*i-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let i=0,s=t.length;i<s;i++)t[i].updateMatrixWorld(e)}updateWorldMatrix(e,t,i=!1){let s=this.parent;if(e===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),t===!0){let r=this.children;for(let a=0,o=r.length;a<o;a++)r[a].updateWorldMatrix(!1,!0,i)}}toJSON(e){let t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),this.static!==!1&&(s.static=this.static),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(e),s.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let l=o.shapes;if(Array.isArray(l))for(let c=0,u=l.length;c<u;c++){let d=l[c];r(e.shapes,d)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(e.materials,this.material[l]));s.material=o}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){let l=this.animations[o];s.animations.push(r(e.animations,l))}}if(t){let o=a(e.geometries),l=a(e.materials),c=a(e.textures),u=a(e.images),d=a(e.shapes),h=a(e.skeletons),f=a(e.animations),g=a(e.nodes);o.length>0&&(i.geometries=o),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),u.length>0&&(i.images=u),d.length>0&&(i.shapes=d),h.length>0&&(i.skeletons=h),f.length>0&&(i.animations=f),g.length>0&&(i.nodes=g)}return i.object=s,i;function a(o){let l=[];for(let c in o){let u=o[c];delete u.metadata,l.push(u)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){let s=e.children[i];this.add(s.clone())}return this}};Bt.DEFAULT_UP=new V(0,1,0);Bt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Bt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var an=class extends Bt{constructor(){super(),this.isGroup=!0,this.type="Group"}},Pd={type:"move"},Zi=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new an,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new an,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new V,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new V),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new an,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new V,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new V,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let s=null,r=null,a=null,o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(let M of e.hand.values()){let m=t.getJointPose(M,i),p=this._getHandJoint(c,M);m!==null&&(p.matrix.fromArray(m.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=m.radius),p.visible=m!==null}let u=c.joints["index-finger-tip"],d=c.joints["thumb-tip"],h=u.position.distanceTo(d.position),f=.02,g=.005;c.inputState.pinching&&h>f+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&h<=f-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,i),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));o!==null&&(s=t.getPose(e.targetRaySpace,i),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Pd)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let i=new an;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}},yh={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Hn={h:0,s:0,l:0},vr={h:0,s:0,l:0};function Ro(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}var Ze=class{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){let s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Pt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Qe.colorSpaceToWorking(this,t),this}setRGB(e,t,i,s=Qe.workingColorSpace){return this.r=e,this.g=t,this.b=i,Qe.colorSpaceToWorking(this,s),this}setHSL(e,t,i,s=Qe.workingColorSpace){if(e=El(e,1),t=je(t,0,1),i=je(i,0,1),t===0)this.r=this.g=this.b=i;else{let r=i<=.5?i*(1+t):i+t-i*t,a=2*i-r;this.r=Ro(a,r,e+1/3),this.g=Ro(a,r,e),this.b=Ro(a,r,e-1/3)}return Qe.colorSpaceToWorking(this,s),this}setStyle(e,t=Pt){function i(r){r!==void 0&&parseFloat(r)<1&&Fe("Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r,a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:Fe("Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){let r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(r,16),t);Fe("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Pt){let i=yh[e.toLowerCase()];return i!==void 0?this.setHex(i,t):Fe("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Ln(e.r),this.g=Ln(e.g),this.b=Ln(e.b),this}copyLinearToSRGB(e){return this.r=Hi(e.r),this.g=Hi(e.g),this.b=Hi(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Pt){return Qe.workingToColorSpace(Ut.copy(this),e),Math.round(je(Ut.r*255,0,255))*65536+Math.round(je(Ut.g*255,0,255))*256+Math.round(je(Ut.b*255,0,255))}getHexString(e=Pt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Qe.workingColorSpace){Qe.workingToColorSpace(Ut.copy(this),t);let i=Ut.r,s=Ut.g,r=Ut.b,a=Math.max(i,s,r),o=Math.min(i,s,r),l,c,u=(o+a)/2;if(o===a)l=0,c=0;else{let d=a-o;switch(c=u<=.5?d/(a+o):d/(2-a-o),a){case i:l=(s-r)/d+(s<r?6:0);break;case s:l=(r-i)/d+2;break;case r:l=(i-s)/d+4;break}l/=6}return e.h=l,e.s=c,e.l=u,e}getRGB(e,t=Qe.workingColorSpace){return Qe.workingToColorSpace(Ut.copy(this),t),e.r=Ut.r,e.g=Ut.g,e.b=Ut.b,e}getStyle(e=Pt){Qe.workingToColorSpace(Ut.copy(this),e);let t=Ut.r,i=Ut.g,s=Ut.b;return e!==Pt?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(s*255)})`}offsetHSL(e,t,i){return this.getHSL(Hn),this.setHSL(Hn.h+e,Hn.s+t,Hn.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(Hn),e.getHSL(vr);let i=Es(Hn.h,vr.h,t),s=Es(Hn.s,vr.s,t),r=Es(Hn.l,vr.l,t);return this.setHSL(i,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,i=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*i+r[6]*s,this.g=r[1]*t+r[4]*i+r[7]*s,this.b=r[2]*t+r[5]*i+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Ut=new Ze;Ze.NAMES=yh;var Ls=class n{constructor(e,t=1,i=1e3){this.isFog=!0,this.name="",this.color=new Ze(e),this.near=t,this.far=i}clone(){return new n(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}},Fs=class extends Bt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Fn,this.environmentIntensity=1,this.environmentRotation=new Fn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}},hn=new V,Cn=new V,Co=new V,Pn=new V,Fi=new V,Ni=new V,Tc=new V,Po=new V,Io=new V,Do=new V,Lo=new mt,Fo=new mt,No=new mt,Zn=class n{constructor(e=new V,t=new V,i=new V){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,s){s.subVectors(i,t),hn.subVectors(e,t),s.cross(hn);let r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,i,s,r){hn.subVectors(s,t),Cn.subVectors(i,t),Co.subVectors(e,t);let a=hn.dot(hn),o=hn.dot(Cn),l=hn.dot(Co),c=Cn.dot(Cn),u=Cn.dot(Co),d=a*c-o*o;if(d===0)return r.set(0,0,0),null;let h=1/d,f=(c*l-o*u)*h,g=(a*u-o*l)*h;return r.set(1-f-g,g,f)}static containsPoint(e,t,i,s){return this.getBarycoord(e,t,i,s,Pn)===null?!1:Pn.x>=0&&Pn.y>=0&&Pn.x+Pn.y<=1}static getInterpolation(e,t,i,s,r,a,o,l){return this.getBarycoord(e,t,i,s,Pn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Pn.x),l.addScaledVector(a,Pn.y),l.addScaledVector(o,Pn.z),l)}static getInterpolatedAttribute(e,t,i,s,r,a){return Lo.setScalar(0),Fo.setScalar(0),No.setScalar(0),Lo.fromBufferAttribute(e,t),Fo.fromBufferAttribute(e,i),No.fromBufferAttribute(e,s),a.setScalar(0),a.addScaledVector(Lo,r.x),a.addScaledVector(Fo,r.y),a.addScaledVector(No,r.z),a}static isFrontFacing(e,t,i,s){return hn.subVectors(i,t),Cn.subVectors(e,t),hn.cross(Cn).dot(s)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,s){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,i,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return hn.subVectors(this.c,this.b),Cn.subVectors(this.a,this.b),hn.cross(Cn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return n.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return n.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,s,r){return n.getInterpolation(e,this.a,this.b,this.c,t,i,s,r)}containsPoint(e){return n.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return n.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let i=this.a,s=this.b,r=this.c,a,o;Fi.subVectors(s,i),Ni.subVectors(r,i),Po.subVectors(e,i);let l=Fi.dot(Po),c=Ni.dot(Po);if(l<=0&&c<=0)return t.copy(i);Io.subVectors(e,s);let u=Fi.dot(Io),d=Ni.dot(Io);if(u>=0&&d<=u)return t.copy(s);let h=l*d-u*c;if(h<=0&&l>=0&&u<=0)return a=l/(l-u),t.copy(i).addScaledVector(Fi,a);Do.subVectors(e,r);let f=Fi.dot(Do),g=Ni.dot(Do);if(g>=0&&f<=g)return t.copy(r);let M=f*c-l*g;if(M<=0&&c>=0&&g<=0)return o=c/(c-g),t.copy(i).addScaledVector(Ni,o);let m=u*g-f*d;if(m<=0&&d-u>=0&&f-g>=0)return Tc.subVectors(r,s),o=(d-u)/(d-u+(f-g)),t.copy(s).addScaledVector(Tc,o);let p=1/(m+M+h);return a=M*p,o=h*p,t.copy(i).addScaledVector(Fi,a).addScaledVector(Ni,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},Kn=class{constructor(e=new V(1/0,1/0,1/0),t=new V(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(un.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(un.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let i=un.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let i=e.geometry;if(i!==void 0){let r=i.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,un):un.fromBufferAttribute(r,a),un.applyMatrix4(e.matrixWorld),this.expandByPoint(un);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),br.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),br.copy(i.boundingBox)),br.applyMatrix4(e.matrixWorld),this.union(br)}let s=e.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,un),un.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(bs),Mr.subVectors(this.max,bs),Ui.subVectors(e.a,bs),Oi.subVectors(e.b,bs),Bi.subVectors(e.c,bs),Wn.subVectors(Oi,Ui),Xn.subVectors(Bi,Oi),pi.subVectors(Ui,Bi);let t=[0,-Wn.z,Wn.y,0,-Xn.z,Xn.y,0,-pi.z,pi.y,Wn.z,0,-Wn.x,Xn.z,0,-Xn.x,pi.z,0,-pi.x,-Wn.y,Wn.x,0,-Xn.y,Xn.x,0,-pi.y,pi.x,0];return!Uo(t,Ui,Oi,Bi,Mr)||(t=[1,0,0,0,1,0,0,0,1],!Uo(t,Ui,Oi,Bi,Mr))?!1:(Sr.crossVectors(Wn,Xn),t=[Sr.x,Sr.y,Sr.z],Uo(t,Ui,Oi,Bi,Mr))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,un).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(un).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(In[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),In[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),In[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),In[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),In[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),In[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),In[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),In[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(In),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},In=[new V,new V,new V,new V,new V,new V,new V,new V],un=new V,br=new Kn,Ui=new V,Oi=new V,Bi=new V,Wn=new V,Xn=new V,pi=new V,bs=new V,Mr=new V,Sr=new V,mi=new V;function Uo(n,e,t,i,s){for(let r=0,a=n.length-3;r<=a;r+=3){mi.fromArray(n,r);let o=s.x*Math.abs(mi.x)+s.y*Math.abs(mi.y)+s.z*Math.abs(mi.z),l=e.dot(mi),c=t.dot(mi),u=i.dot(mi);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>o)return!1}return!0}var Mt=new V,wr=new ze,Id=0,Wt=class extends pn{constructor(e,t,i=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Id++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=Ko,this.updateRanges=[],this.gpuType=_n,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[i+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)wr.fromBufferAttribute(this,t),wr.applyMatrix3(e),this.setXY(t,wr.x,wr.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)Mt.fromBufferAttribute(this,t),Mt.applyMatrix3(e),this.setXYZ(t,Mt.x,Mt.y,Mt.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)Mt.fromBufferAttribute(this,t),Mt.applyMatrix4(e),this.setXYZ(t,Mt.x,Mt.y,Mt.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)Mt.fromBufferAttribute(this,t),Mt.applyNormalMatrix(e),this.setXYZ(t,Mt.x,Mt.y,Mt.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)Mt.fromBufferAttribute(this,t),Mt.transformDirection(e),this.setXYZ(t,Mt.x,Mt.y,Mt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=Gi(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=kt(i,this.array)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Gi(t,this.array)),t}setX(e,t){return this.normalized&&(t=kt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Gi(t,this.array)),t}setY(e,t){return this.normalized&&(t=kt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Gi(t,this.array)),t}setZ(e,t){return this.normalized&&(t=kt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Gi(t,this.array)),t}setW(e,t){return this.normalized&&(t=kt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=kt(t,this.array),i=kt(i,this.array)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,s){return e*=this.itemSize,this.normalized&&(t=kt(t,this.array),i=kt(i,this.array),s=kt(s,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=s,this}setXYZW(e,t,i,s,r){return e*=this.itemSize,this.normalized&&(t=kt(t,this.array),i=kt(i,this.array),s=kt(s,this.array),r=kt(r,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Ko&&(e.usage=this.usage),e}dispose(){this.dispatchEvent({type:"dispose"})}},Ns=class extends Wt{constructor(e,t,i){super(new Int8Array(e),t,i)}};var Us=class extends Wt{constructor(e,t,i){super(new Uint16Array(e),t,i)}};var Os=class extends Wt{constructor(e,t,i){super(new Uint32Array(e),t,i)}};var Dt=class extends Wt{constructor(e,t,i){super(new Float32Array(e),t,i)}},Dd=new Kn,Ms=new V,Oo=new V,$i=class{constructor(e=new V,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let i=this.center;t!==void 0?i.copy(t):Dd.setFromPoints(e).getCenter(i);let s=0;for(let r=0,a=e.length;r<a;r++)s=Math.max(s,i.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Ms.subVectors(e,this.center);let t=Ms.lengthSq();if(t>this.radius*this.radius){let i=Math.sqrt(t),s=(i-this.radius)*.5;this.center.addScaledVector(Ms,s/i),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Oo.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Ms.copy(e.center).add(Oo)),this.expandByPoint(Ms.copy(e.center).sub(Oo))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},Ld=0,sn=new pt,Bo=new Bt,zi=new V,Jt=new Kn,Ss=new Kn,Ct=new V,Xt=class n extends pn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Ld++}),this.uuid=as(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(id(e)?Os:Us)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let r=new Ge().getNormalMatrix(e);i.applyNormalMatrix(r),i.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return sn.makeRotationFromQuaternion(e),this.applyMatrix4(sn),this}rotateX(e){return sn.makeRotationX(e),this.applyMatrix4(sn),this}rotateY(e){return sn.makeRotationY(e),this.applyMatrix4(sn),this}rotateZ(e){return sn.makeRotationZ(e),this.applyMatrix4(sn),this}translate(e,t,i){return sn.makeTranslation(e,t,i),this.applyMatrix4(sn),this}scale(e,t,i){return sn.makeScale(e,t,i),this.applyMatrix4(sn),this}lookAt(e){return Bo.lookAt(e),Bo.updateMatrix(),this.applyMatrix4(Bo.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(zi).negate(),this.translate(zi.x,zi.y,zi.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let i=[];for(let s=0,r=e.length;s<r;s++){let a=e[s];i.push(a.x,a.y,a.z||0)}this.setAttribute("position",new Dt(i,3))}else{let i=Math.min(e.length,t.count);for(let s=0;s<i;s++){let r=e[s];t.setXYZ(s,r.x,r.y,r.z||0)}e.length>t.count&&Fe("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Kn);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Be("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new V(-1/0,-1/0,-1/0),new V(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,s=t.length;i<s;i++){let r=t[i];Jt.setFromBufferAttribute(r),this.morphTargetsRelative?(Ct.addVectors(this.boundingBox.min,Jt.min),this.boundingBox.expandByPoint(Ct),Ct.addVectors(this.boundingBox.max,Jt.max),this.boundingBox.expandByPoint(Ct)):(this.boundingBox.expandByPoint(Jt.min),this.boundingBox.expandByPoint(Jt.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Be('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new $i);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Be("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new V,1/0);return}if(e){let i=this.boundingSphere.center;if(Jt.setFromBufferAttribute(e),t)for(let r=0,a=t.length;r<a;r++){let o=t[r];Ss.setFromBufferAttribute(o),this.morphTargetsRelative?(Ct.addVectors(Jt.min,Ss.min),Jt.expandByPoint(Ct),Ct.addVectors(Jt.max,Ss.max),Jt.expandByPoint(Ct)):(Jt.expandByPoint(Ss.min),Jt.expandByPoint(Ss.max))}Jt.getCenter(i);let s=0;for(let r=0,a=e.count;r<a;r++)Ct.fromBufferAttribute(e,r),s=Math.max(s,i.distanceToSquared(Ct));if(t)for(let r=0,a=t.length;r<a;r++){let o=t[r],l=this.morphTargetsRelative;for(let c=0,u=o.count;c<u;c++)Ct.fromBufferAttribute(o,c),l&&(zi.fromBufferAttribute(e,c),Ct.add(zi)),s=Math.max(s,i.distanceToSquared(Ct))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&Be('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Be("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=t.position,s=t.normal,r=t.uv,a=this.getAttribute("tangent");(a===void 0||a.count!==i.count)&&(a=new Wt(new Float32Array(4*i.count),4),this.setAttribute("tangent",a));let o=[],l=[];for(let y=0;y<i.count;y++)o[y]=new V,l[y]=new V;let c=new V,u=new V,d=new V,h=new ze,f=new ze,g=new ze,M=new V,m=new V;function p(y,C,w){c.fromBufferAttribute(i,y),u.fromBufferAttribute(i,C),d.fromBufferAttribute(i,w),h.fromBufferAttribute(r,y),f.fromBufferAttribute(r,C),g.fromBufferAttribute(r,w),u.sub(c),d.sub(c),f.sub(h),g.sub(h);let T=1/(f.x*g.y-g.x*f.y);isFinite(T)&&(M.copy(u).multiplyScalar(g.y).addScaledVector(d,-f.y).multiplyScalar(T),m.copy(d).multiplyScalar(f.x).addScaledVector(u,-g.x).multiplyScalar(T),o[y].add(M),o[C].add(M),o[w].add(M),l[y].add(m),l[C].add(m),l[w].add(m))}let R=this.groups;R.length===0&&(R=[{start:0,count:e.count}]);for(let y=0,C=R.length;y<C;++y){let w=R[y],T=w.start,D=w.count;for(let B=T,L=T+D;B<L;B+=3)p(e.getX(B+0),e.getX(B+1),e.getX(B+2))}let A=new V,v=new V,E=new V,_=new V;function P(y){E.fromBufferAttribute(s,y),_.copy(E);let C=o[y];A.copy(C),A.sub(E.multiplyScalar(E.dot(C))).normalize(),v.crossVectors(_,C);let T=v.dot(l[y])<0?-1:1;a.setXYZW(y,A.x,A.y,A.z,T)}for(let y=0,C=R.length;y<C;++y){let w=R[y],T=w.start,D=w.count;for(let B=T,L=T+D;B<L;B+=3)P(e.getX(B+0)),P(e.getX(B+1)),P(e.getX(B+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==t.count)i=new Wt(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let h=0,f=i.count;h<f;h++)i.setXYZ(h,0,0,0);let s=new V,r=new V,a=new V,o=new V,l=new V,c=new V,u=new V,d=new V;if(e)for(let h=0,f=e.count;h<f;h+=3){let g=e.getX(h+0),M=e.getX(h+1),m=e.getX(h+2);s.fromBufferAttribute(t,g),r.fromBufferAttribute(t,M),a.fromBufferAttribute(t,m),u.subVectors(a,r),d.subVectors(s,r),u.cross(d),o.fromBufferAttribute(i,g),l.fromBufferAttribute(i,M),c.fromBufferAttribute(i,m),o.add(u),l.add(u),c.add(u),i.setXYZ(g,o.x,o.y,o.z),i.setXYZ(M,l.x,l.y,l.z),i.setXYZ(m,c.x,c.y,c.z)}else for(let h=0,f=t.count;h<f;h+=3)s.fromBufferAttribute(t,h+0),r.fromBufferAttribute(t,h+1),a.fromBufferAttribute(t,h+2),u.subVectors(a,r),d.subVectors(s,r),u.cross(d),i.setXYZ(h+0,u.x,u.y,u.z),i.setXYZ(h+1,u.x,u.y,u.z),i.setXYZ(h+2,u.x,u.y,u.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)Ct.fromBufferAttribute(e,t),Ct.normalize(),e.setXYZ(t,Ct.x,Ct.y,Ct.z)}toNonIndexed(){function e(o,l){let c=o.array,u=o.itemSize,d=o.normalized,h=new c.constructor(l.length*u),f=0,g=0;for(let M=0,m=l.length;M<m;M++){o.isInterleavedBufferAttribute?f=l[M]*o.data.stride+o.offset:f=l[M]*u;for(let p=0;p<u;p++)h[g++]=c[f++]}return new Wt(h,u,d)}if(this.index===null)return Fe("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new n,i=this.index.array,s=this.attributes;for(let o in s){let l=s[o],c=e(l,i);t.setAttribute(o,c)}let r=this.morphAttributes;for(let o in r){let l=[],c=r[o];for(let u=0,d=c.length;u<d;u++){let h=c[u],f=e(h,i);l.push(f)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;let a=this.groups;for(let o=0,l=a.length;o<l;o++){let c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let i=this.attributes;for(let l in i){let c=i[l];e.data.attributes[l]=c.toJSON(e.data)}let s={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],u=[];for(let d=0,h=c.length;d<h;d++){let f=c[d];u.push(f.toJSON(e.data))}u.length>0&&(s[l]=u,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let i=e.index;i!==null&&this.setIndex(i.clone());let s=e.attributes;for(let c in s){let u=s[c];this.setAttribute(c,u.clone(t))}let r=e.morphAttributes;for(let c in r){let u=[],d=r[c];for(let h=0,f=d.length;h<f;h++)u.push(d[h].clone(t));this.morphAttributes[c]=u}this.morphTargetsRelative=e.morphTargetsRelative;let a=e.groups;for(let c=0,u=a.length;c<u;c++){let d=a[c];this.addGroup(d.start,d.count,d.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Fd=0,Jn=class extends pn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Fd++}),this.uuid=as(),this.name="",this.type="Material",this.blending=vi,this.side=fn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Vr,this.blendDst=Gr,this.blendEquation=$n,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ze(0,0,0),this.blendAlpha=0,this.depthFunc=bi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=$o,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=xi,this.stencilZFail=xi,this.stencilZPass=xi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let i=e[t];if(i===void 0){Fe(`Material: parameter '${t}' has value of undefined.`);continue}let s=this[t];if(s===void 0){Fe(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(i):s&&s.isVector2&&i&&i.isVector2||s&&s.isEuler&&i&&i.isEuler||s&&s.isVector3&&i&&i.isVector3?s.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==vi&&(i.blending=this.blending),this.side!==fn&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==Vr&&(i.blendSrc=this.blendSrc),this.blendDst!==Gr&&(i.blendDst=this.blendDst),this.blendEquation!==$n&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==bi&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==$o&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==xi&&(i.stencilFail=this.stencilFail),this.stencilZFail!==xi&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==xi&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.allowOverride===!1&&(i.allowOverride=!1),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function s(r){let a=[];for(let o in r){let l=r[o];delete l.metadata,a.push(l)}return a}if(t){let r=s(e.textures),a=s(e.images);r.length>0&&(i.textures=r),a.length>0&&(i.images=a)}return i}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Ze().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let i=e.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new ze().fromArray(i)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new ze().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,i=null;if(t!==null){let s=t.length;i=new Array(s);for(let r=0;r!==s;++r)i[r]=t[r].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}};var Dn=new V,zo=new V,Tr=new V,qn=new V,ko=new V,Er=new V,Vo=new V,Ki=class{constructor(e=new V,t=new V(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Dn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Dn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Dn.copy(this.origin).addScaledVector(this.direction,t),Dn.distanceToSquared(e))}distanceSqToSegment(e,t,i,s){zo.copy(e).add(t).multiplyScalar(.5),Tr.copy(t).sub(e).normalize(),qn.copy(this.origin).sub(zo);let r=e.distanceTo(t)*.5,a=-this.direction.dot(Tr),o=qn.dot(this.direction),l=-qn.dot(Tr),c=qn.lengthSq(),u=Math.abs(1-a*a),d,h,f,g;if(u>0)if(d=a*l-o,h=a*o-l,g=r*u,d>=0)if(h>=-g)if(h<=g){let M=1/u;d*=M,h*=M,f=d*(d+a*h+2*o)+h*(a*d+h+2*l)+c}else h=r,d=Math.max(0,-(a*h+o)),f=-d*d+h*(h+2*l)+c;else h=-r,d=Math.max(0,-(a*h+o)),f=-d*d+h*(h+2*l)+c;else h<=-g?(d=Math.max(0,-(-a*r+o)),h=d>0?-r:Math.min(Math.max(-r,-l),r),f=-d*d+h*(h+2*l)+c):h<=g?(d=0,h=Math.min(Math.max(-r,-l),r),f=h*(h+2*l)+c):(d=Math.max(0,-(a*r+o)),h=d>0?r:Math.min(Math.max(-r,-l),r),f=-d*d+h*(h+2*l)+c);else h=a>0?-r:r,d=Math.max(0,-(a*h+o)),f=-d*d+h*(h+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,d),s&&s.copy(zo).addScaledVector(Tr,h),f}intersectSphere(e,t){Dn.subVectors(e.center,this.origin);let i=Dn.dot(this.direction),s=Dn.dot(Dn)-i*i,r=e.radius*e.radius;if(s>r)return null;let a=Math.sqrt(r-s),o=i-a,l=i+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){let i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,s,r,a,o,l,c=1/this.direction.x,u=1/this.direction.y,d=1/this.direction.z,h=this.origin;return c>=0?(i=(e.min.x-h.x)*c,s=(e.max.x-h.x)*c):(i=(e.max.x-h.x)*c,s=(e.min.x-h.x)*c),u>=0?(r=(e.min.y-h.y)*u,a=(e.max.y-h.y)*u):(r=(e.max.y-h.y)*u,a=(e.min.y-h.y)*u),i>a||r>s||((r>i||isNaN(i))&&(i=r),(a<s||isNaN(s))&&(s=a),d>=0?(o=(e.min.z-h.z)*d,l=(e.max.z-h.z)*d):(o=(e.max.z-h.z)*d,l=(e.min.z-h.z)*d),i>l||o>s)||((o>i||i!==i)&&(i=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(i>=0?i:s,t)}intersectsBox(e){return this.intersectBox(e,Dn)!==null}intersectTriangle(e,t,i,s,r){ko.subVectors(t,e),Er.subVectors(i,e),Vo.crossVectors(ko,Er);let a=this.direction.dot(Vo),o;if(a>0){if(s)return null;o=1}else if(a<0)o=-1,a=-a;else return null;qn.subVectors(this.origin,e);let l=o*this.direction.dot(Er.crossVectors(qn,Er));if(l<0)return null;let c=o*this.direction.dot(ko.cross(qn));if(c<0||l+c>a)return null;let u=-o*qn.dot(Vo);return u<0?null:this.at(u/a,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Nn=class extends Jn{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Ze(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Fn,this.combine=ll,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},Ec=new pt,gi=new Ki,Ar=new $i,Ac=new V,Rr=new V,Cr=new V,Pr=new V,Go=new V,Ir=new V,Rc=new V,Dr=new V,Tt=class extends Bt{constructor(e=new Xt,t=new Nn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let s=t[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){let i=this.geometry,s=i.attributes.position,r=i.morphAttributes.position,a=i.morphTargetsRelative;t.fromBufferAttribute(s,e);let o=this.morphTargetInfluences;if(r&&o){Ir.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let u=o[l],d=r[l];u!==0&&(Go.fromBufferAttribute(d,e),a?Ir.addScaledVector(Go,u):Ir.addScaledVector(Go.sub(t),u))}t.add(Ir)}return t}raycast(e,t){let i=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),Ar.copy(i.boundingSphere),Ar.applyMatrix4(r),gi.copy(e.ray).recast(e.near),!(Ar.containsPoint(gi.origin)===!1&&(gi.intersectSphere(Ar,Ac)===null||gi.origin.distanceToSquared(Ac)>(e.far-e.near)**2))&&(Ec.copy(r).invert(),gi.copy(e.ray).applyMatrix4(Ec),!(i.boundingBox!==null&&gi.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,gi)))}_computeIntersections(e,t,i){let s,r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,u=r.attributes.uv1,d=r.attributes.normal,h=r.groups,f=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,M=h.length;g<M;g++){let m=h[g],p=a[m.materialIndex],R=Math.max(m.start,f.start),A=Math.min(o.count,Math.min(m.start+m.count,f.start+f.count));for(let v=R,E=A;v<E;v+=3){let _=o.getX(v),P=o.getX(v+1),y=o.getX(v+2);s=Lr(this,p,e,i,c,u,d,_,P,y),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{let g=Math.max(0,f.start),M=Math.min(o.count,f.start+f.count);for(let m=g,p=M;m<p;m+=3){let R=o.getX(m),A=o.getX(m+1),v=o.getX(m+2);s=Lr(this,a,e,i,c,u,d,R,A,v),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,M=h.length;g<M;g++){let m=h[g],p=a[m.materialIndex],R=Math.max(m.start,f.start),A=Math.min(l.count,Math.min(m.start+m.count,f.start+f.count));for(let v=R,E=A;v<E;v+=3){let _=v,P=v+1,y=v+2;s=Lr(this,p,e,i,c,u,d,_,P,y),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{let g=Math.max(0,f.start),M=Math.min(l.count,f.start+f.count);for(let m=g,p=M;m<p;m+=3){let R=m,A=m+1,v=m+2;s=Lr(this,a,e,i,c,u,d,R,A,v),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}}};function Nd(n,e,t,i,s,r,a,o){let l;if(e.side===Gt?l=i.intersectTriangle(a,r,s,!0,o):l=i.intersectTriangle(s,r,a,e.side===fn,o),l===null)return null;Dr.copy(o),Dr.applyMatrix4(n.matrixWorld);let c=t.ray.origin.distanceTo(Dr);return c<t.near||c>t.far?null:{distance:c,point:Dr.clone(),object:n}}function Lr(n,e,t,i,s,r,a,o,l,c){n.getVertexPosition(o,Rr),n.getVertexPosition(l,Cr),n.getVertexPosition(c,Pr);let u=Nd(n,e,t,i,Rr,Cr,Pr,Rc);if(u){let d=new V;Zn.getBarycoord(Rc,Rr,Cr,Pr,d),s&&(u.uv=Zn.getInterpolatedAttribute(s,o,l,c,d,new ze)),r&&(u.uv1=Zn.getInterpolatedAttribute(r,o,l,c,d,new ze)),a&&(u.normal=Zn.getInterpolatedAttribute(a,o,l,c,d,new V),u.normal.dot(i.direction)>0&&u.normal.multiplyScalar(-1));let h={a:o,b:l,c,normal:new V,materialIndex:0};Zn.getNormal(Rr,Cr,Pr,h.normal),u.face=h,u.barycoord=d}return u}var na=class extends Vt{constructor(e=null,t=1,i=1,s,r,a,o,l,c=It,u=It,d,h){super(null,a,o,l,c,u,s,r,d,h),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Ho=new V,Ud=new V,Od=new Ge,rn=class{constructor(e=new V(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,s){return this.normal.set(e,t,i),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){let s=Ho.subVectors(i,t).cross(Ud.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,i=!0){let s=e.delta(Ho),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/r;return i===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(s,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let i=t||Od.getNormalMatrix(e),s=this.coplanarPoint(Ho).applyMatrix4(e),r=this.normal.applyMatrix3(i).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},_i=new $i,Bd=new ze(.5,.5),Fr=new V,Ji=class{constructor(e=new rn,t=new rn,i=new rn,s=new rn,r=new rn,a=new rn){this.planes=[e,t,i,s,r,a]}set(e,t,i,s,r,a){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(i),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(e){let t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=dn,i=!1){let s=this.planes,r=e.elements,a=r[0],o=r[1],l=r[2],c=r[3],u=r[4],d=r[5],h=r[6],f=r[7],g=r[8],M=r[9],m=r[10],p=r[11],R=r[12],A=r[13],v=r[14],E=r[15];if(s[0].setComponents(c-a,f-u,p-g,E-R).normalize(),s[1].setComponents(c+a,f+u,p+g,E+R).normalize(),s[2].setComponents(c+o,f+d,p+M,E+A).normalize(),s[3].setComponents(c-o,f-d,p-M,E-A).normalize(),i)s[4].setComponents(l,h,m,v).normalize(),s[5].setComponents(c-l,f-h,p-m,E-v).normalize();else if(s[4].setComponents(c-l,f-h,p-m,E-v).normalize(),t===dn)s[5].setComponents(c+l,f+h,p+m,E+v).normalize();else if(t===Wi)s[5].setComponents(l,h,m,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),_i.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),_i.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(_i)}intersectsSprite(e){_i.center.set(0,0,0);let t=Bd.distanceTo(e.center);return _i.radius=.7071067811865476+t,_i.applyMatrix4(e.matrixWorld),this.intersectsSphere(_i)}intersectsSphere(e){let t=this.planes,i=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(i)<s)return!1;return!0}intersectsBox(e){let t=this.planes;for(let i=0;i<6;i++){let s=t[i];if(Fr.x=s.normal.x>0?e.max.x:e.min.x,Fr.y=s.normal.y>0?e.max.y:e.min.y,Fr.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(Fr)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var Bs=class extends Vt{constructor(e=[],t=si,i,s,r,a,o,l,c,u){super(e,t,i,s,r,a,o,l,c,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},ji=class extends Vt{constructor(e,t,i,s,r,a,o,l,c){super(e,t,i,s,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}};var Un=class extends Vt{constructor(e,t,i=gn,s,r,a,o=It,l=It,c,u=Sn,d=1){if(u!==Sn&&u!==ai)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let h={width:e,height:t,depth:d};super(h,s,r,a,o,l,u,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Yi(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},ia=class extends Un{constructor(e,t=gn,i=si,s,r,a=It,o=It,l,c=Sn){let u={width:e,height:e,depth:1},d=[u,u,u,u,u,u];super(e,e,t,i,s,r,a,o,l,c),this.image=d,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},zs=class extends Vt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},Qi=class n extends Xt{constructor(e=1,t=1,i=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:s,heightSegments:r,depthSegments:a};let o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);let l=[],c=[],u=[],d=[],h=0,f=0;g("z","y","x",-1,-1,i,t,e,a,r,0),g("z","y","x",1,-1,i,t,-e,a,r,1),g("x","z","y",1,1,e,i,t,s,a,2),g("x","z","y",1,-1,e,i,-t,s,a,3),g("x","y","z",1,-1,e,t,i,s,r,4),g("x","y","z",-1,-1,e,t,-i,s,r,5),this.setIndex(l),this.setAttribute("position",new Dt(c,3)),this.setAttribute("normal",new Dt(u,3)),this.setAttribute("uv",new Dt(d,2));function g(M,m,p,R,A,v,E,_,P,y,C){let w=v/P,T=E/y,D=v/2,B=E/2,L=_/2,I=P+1,G=y+1,N=0,k=0,$=new V;for(let j=0;j<G;j++){let ne=j*T-B;for(let ae=0;ae<I;ae++){let ve=ae*w-D;$[M]=ve*R,$[m]=ne*A,$[p]=L,c.push($.x,$.y,$.z),$[M]=0,$[m]=0,$[p]=_>0?1:-1,u.push($.x,$.y,$.z),d.push(ae/P),d.push(1-j/y),N+=1}}for(let j=0;j<y;j++)for(let ne=0;ne<P;ne++){let ae=h+ne+I*j,ve=h+ne+I*(j+1),Ne=h+(ne+1)+I*(j+1),re=h+(ne+1)+I*j;l.push(ae,ve,re),l.push(ve,Ne,re),k+=6}o.addGroup(f,k,C),f+=k,h+=N}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};function zd(n,e,t=2){let i=e&&e.length,s=i?e[0]*t:n.length,r=vh(n,0,s,t,!0),a=[];if(!r||r.next===r.prev)return a;let o,l,c;if(i&&(r=Wd(n,e,r,t)),n.length>80*t){o=n[0],l=n[1];let u=o,d=l;for(let h=t;h<s;h+=t){let f=n[h],g=n[h+1];f<o&&(o=f),g<l&&(l=g),f>u&&(u=f),g>d&&(d=g)}c=Math.max(u-o,d-l),c=c!==0?32767/c:0}return ks(r,a,t,o,l,c,0),a}function vh(n,e,t,i,s){let r;if(s===tf(n,e,t,i)>0)for(let a=e;a<t;a+=i)r=Cc(a/i|0,n[a],n[a+1],r);else for(let a=t-i;a>=e;a-=i)r=Cc(a/i|0,n[a],n[a+1],r);return r&&es(r,r.next)&&(Gs(r),r=r.next),r}function Mi(n,e){if(!n)return n;e||(e=n);let t=n,i;do if(i=!1,!t.steiner&&(es(t,t.next)||gt(t.prev,t,t.next)===0)){if(Gs(t),t=e=t.prev,t===t.next)break;i=!0}else t=t.next;while(i||t!==e);return e}function ks(n,e,t,i,s,r,a){if(!n)return;!a&&r&&$d(n,i,s,r);let o=n;for(;n.prev!==n.next;){let l=n.prev,c=n.next;if(r?Vd(n,i,s,r):kd(n)){e.push(l.i,n.i,c.i),Gs(n),n=c.next,o=c.next;continue}if(n=c,n===o){a?a===1?(n=Gd(Mi(n),e),ks(n,e,t,i,s,r,2)):a===2&&Hd(n,e,t,i,s,r):ks(Mi(n),e,t,i,s,r,1);break}}}function kd(n){let e=n.prev,t=n,i=n.next;if(gt(e,t,i)>=0)return!1;let s=e.x,r=t.x,a=i.x,o=e.y,l=t.y,c=i.y,u=Math.min(s,r,a),d=Math.min(o,l,c),h=Math.max(s,r,a),f=Math.max(o,l,c),g=i.next;for(;g!==e;){if(g.x>=u&&g.x<=h&&g.y>=d&&g.y<=f&&ws(s,o,r,l,a,c,g.x,g.y)&&gt(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function Vd(n,e,t,i){let s=n.prev,r=n,a=n.next;if(gt(s,r,a)>=0)return!1;let o=s.x,l=r.x,c=a.x,u=s.y,d=r.y,h=a.y,f=Math.min(o,l,c),g=Math.min(u,d,h),M=Math.max(o,l,c),m=Math.max(u,d,h),p=Jo(f,g,e,t,i),R=Jo(M,m,e,t,i),A=n.prevZ,v=n.nextZ;for(;A&&A.z>=p&&v&&v.z<=R;){if(A.x>=f&&A.x<=M&&A.y>=g&&A.y<=m&&A!==s&&A!==a&&ws(o,u,l,d,c,h,A.x,A.y)&&gt(A.prev,A,A.next)>=0||(A=A.prevZ,v.x>=f&&v.x<=M&&v.y>=g&&v.y<=m&&v!==s&&v!==a&&ws(o,u,l,d,c,h,v.x,v.y)&&gt(v.prev,v,v.next)>=0))return!1;v=v.nextZ}for(;A&&A.z>=p;){if(A.x>=f&&A.x<=M&&A.y>=g&&A.y<=m&&A!==s&&A!==a&&ws(o,u,l,d,c,h,A.x,A.y)&&gt(A.prev,A,A.next)>=0)return!1;A=A.prevZ}for(;v&&v.z<=R;){if(v.x>=f&&v.x<=M&&v.y>=g&&v.y<=m&&v!==s&&v!==a&&ws(o,u,l,d,c,h,v.x,v.y)&&gt(v.prev,v,v.next)>=0)return!1;v=v.nextZ}return!0}function Gd(n,e){let t=n;do{let i=t.prev,s=t.next.next;!es(i,s)&&Mh(i,t,t.next,s)&&Vs(i,s)&&Vs(s,i)&&(e.push(i.i,t.i,s.i),Gs(t),Gs(t.next),t=n=s),t=t.next}while(t!==n);return Mi(t)}function Hd(n,e,t,i,s,r){let a=n;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&jd(a,o)){let l=Sh(a,o);a=Mi(a,a.next),l=Mi(l,l.next),ks(a,e,t,i,s,r,0),ks(l,e,t,i,s,r,0);return}o=o.next}a=a.next}while(a!==n)}function Wd(n,e,t,i){let s=[];for(let r=0,a=e.length;r<a;r++){let o=e[r]*i,l=r<a-1?e[r+1]*i:n.length,c=vh(n,o,l,i,!1);c===c.next&&(c.steiner=!0),s.push(Jd(c))}s.sort(Xd);for(let r=0;r<s.length;r++)t=qd(s[r],t);return t}function Xd(n,e){let t=n.x-e.x;if(t===0&&(t=n.y-e.y,t===0)){let i=(n.next.y-n.y)/(n.next.x-n.x),s=(e.next.y-e.y)/(e.next.x-e.x);t=i-s}return t}function qd(n,e){let t=Yd(n,e);if(!t)return e;let i=Sh(t,n);return Mi(i,i.next),Mi(t,t.next)}function Yd(n,e){let t=e,i=n.x,s=n.y,r=-1/0,a;if(es(n,t))return t;do{if(es(n,t.next))return t.next;if(s<=t.y&&s>=t.next.y&&t.next.y!==t.y){let d=t.x+(s-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(d<=i&&d>r&&(r=d,a=t.x<t.next.x?t:t.next,d===i))return a}t=t.next}while(t!==e);if(!a)return null;let o=a,l=a.x,c=a.y,u=1/0;t=a;do{if(i>=t.x&&t.x>=l&&i!==t.x&&bh(s<c?i:r,s,l,c,s<c?r:i,s,t.x,t.y)){let d=Math.abs(s-t.y)/(i-t.x);Vs(t,n)&&(d<u||d===u&&(t.x>a.x||t.x===a.x&&Zd(a,t)))&&(a=t,u=d)}t=t.next}while(t!==o);return a}function Zd(n,e){return gt(n.prev,n,e.prev)<0&&gt(e.next,n,n.next)<0}function $d(n,e,t,i){let s=n;do s.z===0&&(s.z=Jo(s.x,s.y,e,t,i)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==n);s.prevZ.nextZ=null,s.prevZ=null,Kd(s)}function Kd(n){let e,t=1;do{let i=n,s;n=null;let r=null;for(e=0;i;){e++;let a=i,o=0;for(let c=0;c<t&&(o++,a=a.nextZ,!!a);c++);let l=t;for(;o>0||l>0&&a;)o!==0&&(l===0||!a||i.z<=a.z)?(s=i,i=i.nextZ,o--):(s=a,a=a.nextZ,l--),r?r.nextZ=s:n=s,s.prevZ=r,r=s;i=a}r.nextZ=null,t*=2}while(e>1);return n}function Jo(n,e,t,i,s){return n=(n-t)*s|0,e=(e-i)*s|0,n=(n|n<<8)&16711935,n=(n|n<<4)&252645135,n=(n|n<<2)&858993459,n=(n|n<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,n|e<<1}function Jd(n){let e=n,t=n;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==n);return t}function bh(n,e,t,i,s,r,a,o){return(s-a)*(e-o)>=(n-a)*(r-o)&&(n-a)*(i-o)>=(t-a)*(e-o)&&(t-a)*(r-o)>=(s-a)*(i-o)}function ws(n,e,t,i,s,r,a,o){return!(n===a&&e===o)&&bh(n,e,t,i,s,r,a,o)}function jd(n,e){return n.next.i!==e.i&&n.prev.i!==e.i&&!Qd(n,e)&&(Vs(n,e)&&Vs(e,n)&&ef(n,e)&&(gt(n.prev,n,e.prev)||gt(n,e.prev,e))||es(n,e)&&gt(n.prev,n,n.next)>0&&gt(e.prev,e,e.next)>0)}function gt(n,e,t){return(e.y-n.y)*(t.x-e.x)-(e.x-n.x)*(t.y-e.y)}function es(n,e){return n.x===e.x&&n.y===e.y}function Mh(n,e,t,i){let s=Ur(gt(n,e,t)),r=Ur(gt(n,e,i)),a=Ur(gt(t,i,n)),o=Ur(gt(t,i,e));return!!(s!==r&&a!==o||s===0&&Nr(n,t,e)||r===0&&Nr(n,i,e)||a===0&&Nr(t,n,i)||o===0&&Nr(t,e,i))}function Nr(n,e,t){return e.x<=Math.max(n.x,t.x)&&e.x>=Math.min(n.x,t.x)&&e.y<=Math.max(n.y,t.y)&&e.y>=Math.min(n.y,t.y)}function Ur(n){return n>0?1:n<0?-1:0}function Qd(n,e){let t=n;do{if(t.i!==n.i&&t.next.i!==n.i&&t.i!==e.i&&t.next.i!==e.i&&Mh(t,t.next,n,e))return!0;t=t.next}while(t!==n);return!1}function Vs(n,e){return gt(n.prev,n,n.next)<0?gt(n,e,n.next)>=0&&gt(n,n.prev,e)>=0:gt(n,e,n.prev)<0||gt(n,n.next,e)<0}function ef(n,e){let t=n,i=!1,s=(n.x+e.x)/2,r=(n.y+e.y)/2;do t.y>r!=t.next.y>r&&t.next.y!==t.y&&s<(t.next.x-t.x)*(r-t.y)/(t.next.y-t.y)+t.x&&(i=!i),t=t.next;while(t!==n);return i}function Sh(n,e){let t=jo(n.i,n.x,n.y),i=jo(e.i,e.x,e.y),s=n.next,r=e.prev;return n.next=e,e.prev=n,t.next=s,s.prev=t,i.next=t,t.prev=i,r.next=i,i.prev=r,i}function Cc(n,e,t,i){let s=jo(n,e,t);return i?(s.next=i.next,s.prev=i,i.next.prev=s,i.next=s):(s.prev=s,s.next=s),s}function Gs(n){n.next.prev=n.prev,n.prev.next=n.next,n.prevZ&&(n.prevZ.nextZ=n.nextZ),n.nextZ&&(n.nextZ.prevZ=n.prevZ)}function jo(n,e,t){return{i:n,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function tf(n,e,t,i){let s=0;for(let r=e,a=t-i;r<t;r+=i)s+=(n[a]-n[r])*(n[r+1]+n[a+1]),a=r;return s}var Qo=class{static triangulate(e,t,i=2){return zd(e,t,i)}},Hs=class n{static area(e){let t=e.length,i=0;for(let s=t-1,r=0;r<t;s=r++)i+=e[s].x*e[r].y-e[r].x*e[s].y;return i*.5}static isClockWise(e){return n.area(e)<0}static triangulateShape(e,t){let i=[],s=[],r=[];Pc(e),Ic(i,e);let a=e.length;t.forEach(Pc);for(let l=0;l<t.length;l++)s.push(a),a+=t[l].length,Ic(i,t[l]);let o=Qo.triangulate(i,s);for(let l=0;l<o.length;l+=3)r.push(o.slice(l,l+3));return r}};function Pc(n){let e=n.length;e>2&&n[e-1].equals(n[0])&&n.pop()}function Ic(n,e){for(let t=0;t<e.length;t++)n.push(e[t].x),n.push(e[t].y)}var On=class n extends Xt{constructor(e=1,t=1,i=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:s};let r=e/2,a=t/2,o=Math.floor(i),l=Math.floor(s),c=o+1,u=l+1,d=e/o,h=t/l,f=[],g=[],M=[],m=[];for(let p=0;p<u;p++){let R=p*h-a;for(let A=0;A<c;A++){let v=A*d-r;g.push(v,-R,0),M.push(0,0,1),m.push(A/o),m.push(1-p/l)}}for(let p=0;p<l;p++)for(let R=0;R<o;R++){let A=R+c*p,v=R+c*(p+1),E=R+1+c*(p+1),_=R+1+c*p;f.push(A,v,_),f.push(v,E,_)}this.setIndex(f),this.setAttribute("position",new Dt(g,3)),this.setAttribute("normal",new Dt(M,3)),this.setAttribute("uv",new Dt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.widthSegments,e.heightSegments)}};function wi(n){let e={};for(let t in n){e[t]={};for(let i in n[t]){let s=n[t][i];if(Dc(s))s.isRenderTargetTexture?(Fe("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=s.clone();else if(Array.isArray(s))if(Dc(s[0])){let r=[];for(let a=0,o=s.length;a<o;a++)r[a]=s[a].clone();e[t][i]=r}else e[t][i]=s.slice();else e[t][i]=s}}return e}function zt(n){let e={};for(let t=0;t<n.length;t++){let i=wi(n[t]);for(let s in i)e[s]=i[s]}return e}function Dc(n){return n&&(n.isColor||n.isMatrix3||n.isMatrix4||n.isVector2||n.isVector3||n.isVector4||n.isTexture||n.isQuaternion)}function nf(n){let e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function Rl(n){let e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Qe.workingColorSpace}var wh={clone:wi,merge:zt},sf=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,rf=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,en=class extends Jn{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=sf,this.fragmentShader=rf,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=wi(e.uniforms),this.uniformsGroups=nf(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let s in this.uniforms){let a=this.uniforms[s].value;a&&a.isTexture?t.uniforms[s]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[s]={type:"m4",value:a.toArray()}:t.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let i={};for(let s in this.extensions)this.extensions[s]===!0&&(i[s]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let i in e.uniforms){let s=e.uniforms[i];switch(this.uniforms[i]={},s.type){case"t":this.uniforms[i].value=t[s.value]||null;break;case"c":this.uniforms[i].value=new Ze().setHex(s.value);break;case"v2":this.uniforms[i].value=new ze().fromArray(s.value);break;case"v3":this.uniforms[i].value=new V().fromArray(s.value);break;case"v4":this.uniforms[i].value=new mt().fromArray(s.value);break;case"m3":this.uniforms[i].value=new Ge().fromArray(s.value);break;case"m4":this.uniforms[i].value=new pt().fromArray(s.value);break;default:this.uniforms[i].value=s.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let i in e.extensions)this.extensions[i]=e.extensions[i];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},sa=class extends en{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},jn=class extends Jn{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Ze(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ze(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=so,this.normalScale=new ze(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Fn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}};var ra=class extends Jn{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=oh,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},aa=class extends Jn{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function Or(n,e){return!n||n.constructor===e?n:typeof e.BYTES_PER_ELEMENT=="number"?new e(n):Array.prototype.slice.call(n)}var Qn=class{constructor(e,t,i,s){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new t.constructor(i),this.sampleValues=t,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,i=this._cachedIndex,s=t[i],r=t[i-1];n:{e:{let a;t:{i:if(!(e<s)){for(let o=i+2;;){if(s===void 0){if(e<r)break i;return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===o)break;if(r=s,s=t[++i],e<s)break e}a=t.length;break t}if(!(e>=r)){let o=t[1];e<o&&(i=2,r=o);for(let l=i-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(s=r,r=t[--i-1],e>=r)break e}a=i,i=0;break t}break n}for(;i<a;){let o=i+a>>>1;e<t[o]?a=o:i=o+1}if(s=t[i],r=t[i-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,r,s)}return this.interpolate_(i,r,e,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,i=this.sampleValues,s=this.valueSize,r=e*s;for(let a=0;a!==s;++a)t[a]=i[r+a];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},oa=class extends Qn{constructor(e,t,i,s){super(e,t,i,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:qo,endingEnd:qo}}intervalChanged_(e,t,i){let s=this.parameterPositions,r=e-2,a=e+1,o=s[r],l=s[a];if(o===void 0)switch(this.getSettings_().endingStart){case Yo:r=e,o=2*t-i;break;case Zo:r=s.length-2,o=t+s[r]-s[r+1];break;default:r=e,o=i}if(l===void 0)switch(this.getSettings_().endingEnd){case Yo:a=e,l=2*i-t;break;case Zo:a=1,l=i+s[1]-s[0];break;default:a=e-1,l=t}let c=(i-t)*.5,u=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(l-i),this._offsetPrev=r*u,this._offsetNext=a*u}interpolate_(e,t,i,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,u=this._offsetPrev,d=this._offsetNext,h=this._weightPrev,f=this._weightNext,g=(i-t)/(s-t),M=g*g,m=M*g,p=-h*m+2*h*M-h*g,R=(1+h)*m+(-1.5-2*h)*M+(-.5+h)*g+1,A=(-1-f)*m+(1.5+f)*M+.5*g,v=f*m-f*M;for(let E=0;E!==o;++E)r[E]=p*a[u+E]+R*a[c+E]+A*a[l+E]+v*a[d+E];return r}},la=class extends Qn{constructor(e,t,i,s){super(e,t,i,s)}interpolate_(e,t,i,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,u=(i-t)/(s-t),d=1-u;for(let h=0;h!==o;++h)r[h]=a[c+h]*d+a[l+h]*u;return r}},ca=class extends Qn{constructor(e,t,i,s){super(e,t,i,s)}interpolate_(e){return this.copySampleValue_(e-1)}},ha=class extends Qn{interpolate_(e,t,i,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,u=this.inTangents,d=this.outTangents;if(!u||!d){let g=(i-t)/(s-t),M=1-g;for(let m=0;m!==o;++m)r[m]=a[c+m]*M+a[l+m]*g;return r}let h=o*2,f=e-1;for(let g=0;g!==o;++g){let M=a[c+g],m=a[l+g],p=f*h+g*2,R=d[p],A=d[p+1],v=e*h+g*2,E=u[v],_=u[v+1],P=(i-t)/(s-t),y,C,w,T,D;for(let B=0;B<8;B++){y=P*P,C=y*P,w=1-P,T=w*w,D=T*w;let I=D*t+3*T*P*R+3*w*y*E+C*s-i;if(Math.abs(I)<1e-10)break;let G=3*T*(R-t)+6*w*P*(E-R)+3*y*(s-E);if(Math.abs(G)<1e-10)break;P=P-I/G,P=Math.max(0,Math.min(1,P))}r[g]=D*M+3*T*P*A+3*w*y*_+C*m}return r}},tn=class{constructor(e,t,i,s){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Or(t,this.TimeBufferType),this.values=Or(i,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,i;if(t.toJSON!==this.toJSON)i=t.toJSON(e);else{i={name:e.name,times:Or(e.times,Array),values:Or(e.values,Array)};let s=e.getInterpolation();s!==e.DefaultInterpolation&&(i.interpolation=s)}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new ca(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new la(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new oa(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new ha(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case As:t=this.InterpolantFactoryMethodDiscrete;break;case jr:t=this.InterpolantFactoryMethodLinear;break;case kr:t=this.InterpolantFactoryMethodSmooth;break;case Xo:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return Fe("KeyframeTrack:",i),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return As;case this.InterpolantFactoryMethodLinear:return jr;case this.InterpolantFactoryMethodSmooth:return kr;case this.InterpolantFactoryMethodBezier:return Xo}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let i=0,s=t.length;i!==s;++i)t[i]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let i=0,s=t.length;i!==s;++i)t[i]*=e}return this}trim(e,t){let i=this.times,s=i.length,r=0,a=s-1;for(;r!==s&&i[r]<e;)++r;for(;a!==-1&&i[a]>t;)--a;if(++a,r!==0||a!==s){r>=a&&(a=Math.max(a,1),r=a-1);let o=this.getValueSize();this.times=i.slice(r,a),this.values=this.values.slice(r*o,a*o)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(Be("KeyframeTrack: Invalid value size in track.",this),e=!1);let i=this.times,s=this.values,r=i.length;r===0&&(Be("KeyframeTrack: Track is empty.",this),e=!1);let a=null;for(let o=0;o!==r;o++){let l=i[o];if(typeof l=="number"&&isNaN(l)){Be("KeyframeTrack: Time is not a valid number.",this,o,l),e=!1;break}if(a!==null&&a>l){Be("KeyframeTrack: Out of order keys.",this,o,l,a),e=!1;break}a=l}if(s!==void 0&&sd(s))for(let o=0,l=s.length;o!==l;++o){let c=s[o];if(isNaN(c)){Be("KeyframeTrack: Value is not a valid number.",this,o,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),i=this.getValueSize(),s=this.getInterpolation()===kr,r=e.length-1,a=1;for(let o=1;o<r;++o){let l=!1,c=e[o],u=e[o+1];if(c!==u&&(o!==1||c!==e[0]))if(s)l=!0;else{let d=o*i,h=d-i,f=d+i;for(let g=0;g!==i;++g){let M=t[d+g];if(M!==t[h+g]||M!==t[f+g]){l=!0;break}}}if(l){if(o!==a){e[a]=e[o];let d=o*i,h=a*i;for(let f=0;f!==i;++f)t[h+f]=t[d+f]}++a}}if(r>0){e[a]=e[r];for(let o=r*i,l=a*i,c=0;c!==i;++c)t[l+c]=t[o+c];++a}return a!==e.length?(this.times=e.slice(0,a),this.values=t.slice(0,a*i)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),i=this.constructor,s=new i(this.name,e,t);return s.createInterpolant=this.createInterpolant,s}};tn.prototype.ValueTypeName="";tn.prototype.TimeBufferType=Float32Array;tn.prototype.ValueBufferType=Float32Array;tn.prototype.DefaultInterpolation=jr;var ei=class extends tn{constructor(e,t,i){super(e,t,i)}};ei.prototype.ValueTypeName="bool";ei.prototype.ValueBufferType=Array;ei.prototype.DefaultInterpolation=As;ei.prototype.InterpolantFactoryMethodLinear=void 0;ei.prototype.InterpolantFactoryMethodSmooth=void 0;var ua=class extends tn{constructor(e,t,i,s){super(e,t,i,s)}};ua.prototype.ValueTypeName="color";var da=class extends tn{constructor(e,t,i,s){super(e,t,i,s)}};da.prototype.ValueTypeName="number";var fa=class extends Qn{constructor(e,t,i,s){super(e,t,i,s)}interpolate_(e,t,i,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(i-t)/(s-t),c=e*o;for(let u=c+o;c!==u;c+=4)jt.slerpFlat(r,0,a,c-o,a,c,l);return r}},Ws=class extends tn{constructor(e,t,i,s){super(e,t,i,s)}InterpolantFactoryMethodLinear(e){return new fa(this.times,this.values,this.getValueSize(),e)}};Ws.prototype.ValueTypeName="quaternion";Ws.prototype.InterpolantFactoryMethodSmooth=void 0;var ti=class extends tn{constructor(e,t,i){super(e,t,i)}};ti.prototype.ValueTypeName="string";ti.prototype.ValueBufferType=Array;ti.prototype.DefaultInterpolation=As;ti.prototype.InterpolantFactoryMethodLinear=void 0;ti.prototype.InterpolantFactoryMethodSmooth=void 0;var pa=class extends tn{constructor(e,t,i,s){super(e,t,i,s)}};pa.prototype.ValueTypeName="vector";var ma=class{constructor(e,t,i){let s=this,r=!1,a=0,o=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=i,this._abortController=null,this.itemStart=function(u){o++,r===!1&&s.onStart!==void 0&&s.onStart(u,a,o),r=!0},this.itemEnd=function(u){a++,s.onProgress!==void 0&&s.onProgress(u,a,o),a===o&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(u){s.onError!==void 0&&s.onError(u)},this.resolveURL=function(u){return u=u.normalize("NFC"),l?l(u):u},this.setURLModifier=function(u){return l=u,this},this.addHandler=function(u,d){return c.push(u,d),this},this.removeHandler=function(u){let d=c.indexOf(u);return d!==-1&&c.splice(d,2),this},this.getHandler=function(u){for(let d=0,h=c.length;d<h;d+=2){let f=c[d],g=c[d+1];if(f.global&&(f.lastIndex=0),f.test(u))return g}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Th=new ma,ga=class{constructor(e){this.manager=e!==void 0?e:Th,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let i=this;return new Promise(function(s,r){i.load(e,s,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};ga.DEFAULT_MATERIAL_NAME="__DEFAULT";var Xs=class extends Bt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Ze(e),this.intensity=t}dispose(){this.dispatchEvent({type:"dispose"})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},qs=class extends Xs{constructor(e,t,i){super(e,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Bt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Ze(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},Wo=new pt,Lc=new V,Fc=new V,el=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ze(512,512),this.mapType=qt,this.map=null,this.mapPass=null,this.matrix=new pt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Ji,this._frameExtents=new ze(1,1),this._viewportCount=1,this._viewports=[new mt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,i=this.matrix;Lc.setFromMatrixPosition(e.matrixWorld),t.position.copy(Lc),Fc.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Fc),t.updateMatrixWorld(),Wo.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Wo,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===Wi||t.reversedDepth?i.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(Wo)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},Br=new V,zr=new jt,bn=new V,Ys=class extends Bt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new pt,this.projectionMatrix=new pt,this.projectionMatrixInverse=new pt,this.coordinateSystem=dn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(Br,zr,bn),bn.x===1&&bn.y===1&&bn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Br,zr,bn.set(1,1,1)).invert()}updateWorldMatrix(e,t,i=!1){super.updateWorldMatrix(e,t,i),this.matrixWorld.decompose(Br,zr,bn),bn.x===1&&bn.y===1&&bn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Br,zr,bn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},Yn=new V,Nc=new ze,Uc=new ze,Ot=class extends Ys{constructor(e=50,t=1,i=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=qi*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Ts*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return qi*2*Math.atan(Math.tan(Ts*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){Yn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Yn.x,Yn.y).multiplyScalar(-e/Yn.z),Yn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(Yn.x,Yn.y).multiplyScalar(-e/Yn.z)}getViewSize(e,t){return this.getViewBounds(e,Nc,Uc),t.subVectors(Uc,Nc)}setViewOffset(e,t,i,s,r,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Ts*.5*this.fov)/this.zoom,i=2*t,s=this.aspect*i,r=-.5*s,a=this.view;if(this.view!==null&&this.view.enabled){let l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,t-=a.offsetY*i/c,s*=a.width/l,i*=a.height/c}let o=this.filmOffset;o!==0&&(r+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-i,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}};var ts=class extends Ys{constructor(e=-1,t=1,i=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,s=(this.top+this.bottom)/2,r=i-e,a=i+e,o=s+t,l=s-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=u*this.view.offsetY,l=o-u*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},tl=class extends el{constructor(){super(new ts(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Zs=class extends Xs{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Bt.DEFAULT_UP),this.updateMatrix(),this.target=new Bt,this.shadow=new tl}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}};var ki=-90,Vi=1,_a=class extends Bt{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new Ot(ki,Vi,e,t);s.layers=this.layers,this.add(s);let r=new Ot(ki,Vi,e,t);r.layers=this.layers,this.add(r);let a=new Ot(ki,Vi,e,t);a.layers=this.layers,this.add(a);let o=new Ot(ki,Vi,e,t);o.layers=this.layers,this.add(o);let l=new Ot(ki,Vi,e,t);l.layers=this.layers,this.add(l);let c=new Ot(ki,Vi,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[i,s,r,a,o,l]=t;for(let c of t)this.remove(c);if(e===dn)i.up.set(0,1,0),i.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Wi)i.up.set(0,-1,0),i.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[r,a,o,l,c,u]=this.children,d=e.getRenderTarget(),h=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;let M=i.texture.generateMipmaps;i.texture.generateMipmaps=!1;let m=!1;e.isWebGLRenderer===!0?m=e.state.buffers.depth.getReversed():m=e.reversedDepthBuffer,e.setRenderTarget(i,0,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(i,1,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(i,2,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(i,3,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(i,4,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),i.texture.generateMipmaps=M,e.setRenderTarget(i,5,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,u),e.setRenderTarget(d,h,f),e.xr.enabled=g,i.texture.needsPMREMUpdate=!0}},xa=class extends Ot{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}};var Cl="\\[\\]\\.:\\/",af=new RegExp("["+Cl+"]","g"),Pl="[^"+Cl+"]",of="[^"+Cl.replace("\\.","")+"]",lf=/((?:WC+[\/:])*)/.source.replace("WC",Pl),cf=/(WCOD+)?/.source.replace("WCOD",of),hf=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Pl),uf=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Pl),df=new RegExp("^"+lf+cf+hf+uf+"$"),ff=["material","materials","bones","map"],nl=class{constructor(e,t,i){let s=i||ft.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,s)}getValue(e,t){this.bind();let i=this._targetGroup.nCachedObjects_,s=this._bindings[i];s!==void 0&&s.getValue(e,t)}setValue(e,t){let i=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=i.length;s!==r;++s)i[s].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].unbind()}},ft=class n{constructor(e,t,i){this.path=t,this.parsedPath=i||n.parseTrackName(t),this.node=n.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,i){return e&&e.isAnimationObjectGroup?new n.Composite(e,t,i):new n(e,t,i)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(af,"")}static parseTrackName(e){let t=df.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let i={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},s=i.nodeName&&i.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let r=i.nodeName.substring(s+1);ff.indexOf(r)!==-1&&(i.nodeName=i.nodeName.substring(0,s),i.objectName=r)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return i}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let i=e.skeleton.getBoneByName(t);if(i!==void 0)return i}if(e.children){let i=function(r){for(let a=0;a<r.length;a++){let o=r[a];if(o.name===t||o.uuid===t)return o;let l=i(o.children);if(l)return l}return null},s=i(e.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)e[t++]=i[s]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)i[s]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)i[s]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)i[s]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,i=t.objectName,s=t.propertyName,r=t.propertyIndex;if(e||(e=n.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){Fe("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=t.objectIndex;switch(i){case"materials":if(!e.material){Be("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Be("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Be("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let u=0;u<e.length;u++)if(e[u].name===c){c=u;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Be("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Be("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[i]===void 0){Be("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[i]}if(c!==void 0){if(e[c]===void 0){Be("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let a=e[s];if(a===void 0){let c=t.nodeName;Be("PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",e);return}let o=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?o=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!e.geometry){Be("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Be("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[r]!==void 0&&(r=e.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=r}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};ft.Composite=nl;ft.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};ft.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};ft.prototype.GetterByBindingType=[ft.prototype._getValue_direct,ft.prototype._getValue_array,ft.prototype._getValue_arrayElement,ft.prototype._getValue_toArray];ft.prototype.SetterByBindingTypeAndVersioning=[[ft.prototype._setValue_direct,ft.prototype._setValue_direct_setNeedsUpdate,ft.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[ft.prototype._setValue_array,ft.prototype._setValue_array_setNeedsUpdate,ft.prototype._setValue_array_setMatrixWorldNeedsUpdate],[ft.prototype._setValue_arrayElement,ft.prototype._setValue_arrayElement_setNeedsUpdate,ft.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[ft.prototype._setValue_fromArray,ft.prototype._setValue_fromArray_setNeedsUpdate,ft.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var J_=new Float32Array(1);var ns=class{constructor(e=1,t=0,i=0){this.radius=e,this.phi=t,this.theta=i}set(e,t,i){return this.radius=e,this.phi=t,this.theta=i,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=je(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,i){return this.radius=Math.sqrt(e*e+t*t+i*i),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,i),this.phi=Math.acos(je(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var il=class n{static{n.prototype.isMatrix2=!0}constructor(e,t,i,s){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,i,s)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let i=0;i<4;i++)this.elements[i]=e[i+t];return this}set(e,t,i,s){let r=this.elements;return r[0]=e,r[2]=t,r[1]=i,r[3]=s,this}};var $s=class extends pn{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){if(e===void 0){Fe("Controls: connect() now requires an element.");return}this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}};function Il(n,e,t,i){let s=pf(i);switch(t){case bl:return n*e;case Sl:return n*e/s.components*s.byteLength;case Ta:return n*e/s.components*s.byteLength;case oi:return n*e*2/s.components*s.byteLength;case Ea:return n*e*2/s.components*s.byteLength;case Ml:return n*e*3/s.components*s.byteLength;case on:return n*e*4/s.components*s.byteLength;case Aa:return n*e*4/s.components*s.byteLength;case Qs:case er:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case tr:case nr:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Ca:case Ia:return Math.max(n,16)*Math.max(e,8)/4;case Ra:case Pa:return Math.max(n,8)*Math.max(e,8)/2;case Da:case La:case Na:case Ua:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case Fa:case ir:case Oa:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Ba:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case za:return Math.floor((n+4)/5)*Math.floor((e+3)/4)*16;case ka:return Math.floor((n+4)/5)*Math.floor((e+4)/5)*16;case Va:return Math.floor((n+5)/6)*Math.floor((e+4)/5)*16;case Ga:return Math.floor((n+5)/6)*Math.floor((e+5)/6)*16;case Ha:return Math.floor((n+7)/8)*Math.floor((e+4)/5)*16;case Wa:return Math.floor((n+7)/8)*Math.floor((e+5)/6)*16;case Xa:return Math.floor((n+7)/8)*Math.floor((e+7)/8)*16;case qa:return Math.floor((n+9)/10)*Math.floor((e+4)/5)*16;case Ya:return Math.floor((n+9)/10)*Math.floor((e+5)/6)*16;case Za:return Math.floor((n+9)/10)*Math.floor((e+7)/8)*16;case $a:return Math.floor((n+9)/10)*Math.floor((e+9)/10)*16;case Ka:return Math.floor((n+11)/12)*Math.floor((e+9)/10)*16;case Ja:return Math.floor((n+11)/12)*Math.floor((e+11)/12)*16;case ja:case Qa:case eo:return Math.ceil(n/4)*Math.ceil(e/4)*16;case to:case no:return Math.ceil(n/4)*Math.ceil(e/4)*8;case sr:case io:return Math.ceil(n/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function pf(n){switch(n){case qt:case _l:return{byteLength:1,components:1};case ss:case xl:case Tn:return{byteLength:2,components:1};case Sa:case wa:return{byteLength:2,components:4};case gn:case Ma:case _n:return{byteLength:4,components:1};case yl:case vl:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${n}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"185"}}));typeof window<"u"&&(window.__THREE__?Fe("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="185");function Zh(){let n=null,e=!1,t=null,i=null;function s(r,a){t(r,a),i=n.requestAnimationFrame(s)}return{start:function(){e!==!0&&t!==null&&n!==null&&(i=n.requestAnimationFrame(s),e=!0)},stop:function(){n!==null&&n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){n=r}}}function gf(n){let e=new WeakMap;function t(o,l){let c=o.array,u=o.usage,d=c.byteLength,h=n.createBuffer();n.bindBuffer(l,h),n.bufferData(l,c,u),o.onUploadCallback();let f;if(c instanceof Float32Array)f=n.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)f=n.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?f=n.HALF_FLOAT:f=n.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=n.SHORT;else if(c instanceof Uint32Array)f=n.UNSIGNED_INT;else if(c instanceof Int32Array)f=n.INT;else if(c instanceof Int8Array)f=n.BYTE;else if(c instanceof Uint8Array)f=n.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:h,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:d}}function i(o,l,c){let u=l.array,d=l.updateRanges;if(n.bindBuffer(c,o),d.length===0)n.bufferSubData(c,0,u);else{d.sort((f,g)=>f.start-g.start);let h=0;for(let f=1;f<d.length;f++){let g=d[h],M=d[f];M.start<=g.start+g.count+1?g.count=Math.max(g.count,M.start+M.count-g.start):(++h,d[h]=M)}d.length=h+1;for(let f=0,g=d.length;f<g;f++){let M=d[f];n.bufferSubData(c,M.start*u.BYTES_PER_ELEMENT,u,M.start,M.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);let l=e.get(o);l&&(n.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let u=e.get(o);(!u||u.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}var _f=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,xf=`#ifdef USE_ALPHAHASH
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
#endif`,yf=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,vf=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,bf=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Mf=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Sf=`#ifdef USE_AOMAP
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
#endif`,wf=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Tf=`#ifdef USE_BATCHING
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
#endif`,Ef=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Af=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Rf=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Cf=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,Pf=`#ifdef USE_IRIDESCENCE
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
#endif`,If=`#ifdef USE_BUMPMAP
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
#endif`,Df=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,Lf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Ff=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Nf=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Uf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Of=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Bf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,zf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,kf=`#define PI 3.141592653589793
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
} // validated`,Vf=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,Gf=`vec3 transformedNormal = objectNormal;
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
#endif`,Hf=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Wf=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Xf=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,qf=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Yf="gl_FragColor = linearToOutputTexel( gl_FragColor );",Zf=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,$f=`#ifdef USE_ENVMAP
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
#endif`,Kf=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Jf=`#ifdef USE_ENVMAP
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
#endif`,jf=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Qf=`#ifdef USE_ENVMAP
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
#endif`,ep=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,tp=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,np=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,ip=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,sp=`#ifdef USE_GRADIENTMAP
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
}`,rp=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,ap=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,op=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,lp=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,cp=`#ifdef USE_ENVMAP
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
#endif`,hp=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,up=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,dp=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,fp=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,pp=`PhysicalMaterial material;
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
#endif`,mp=`uniform sampler2D dfgLUT;
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
}`,gp=`
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
#endif`,_p=`#if defined( RE_IndirectDiffuse )
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
#endif`,xp=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,yp=`#ifdef USE_LIGHT_PROBES_GRID
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
#endif`,vp=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,bp=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Mp=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Sp=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,wp=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Tp=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Ep=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,Ap=`#if defined( USE_POINTS_UV )
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
#endif`,Rp=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Cp=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Pp=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Ip=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Dp=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Lp=`#ifdef USE_MORPHTARGETS
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
#endif`,Fp=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Np=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,Up=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,Op=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Bp=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,zp=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,kp=`#ifdef USE_NORMALMAP
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
#endif`,Vp=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Gp=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Hp=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Wp=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Xp=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,qp=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,Yp=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Zp=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,$p=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Kp=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Jp=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,jp=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Qp=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,em=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,tm=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,nm=`float getShadowMask() {
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
}`,im=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,sm=`#ifdef USE_SKINNING
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
#endif`,rm=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,am=`#ifdef USE_SKINNING
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
#endif`,om=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,lm=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,cm=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,hm=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,um=`#ifdef USE_TRANSMISSION
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
#endif`,dm=`#ifdef USE_TRANSMISSION
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
#endif`,fm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,pm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,mm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,gm=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,_m=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,xm=`uniform sampler2D t2D;
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
}`,ym=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,vm=`#ifdef ENVMAP_TYPE_CUBE
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
}`,bm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Mm=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Sm=`#include <common>
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
}`,wm=`#if DEPTH_PACKING == 3200
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
}`,Tm=`#define DISTANCE
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
}`,Em=`#define DISTANCE
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
}`,Am=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Rm=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Cm=`uniform float scale;
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
}`,Pm=`uniform vec3 diffuse;
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
}`,Im=`#include <common>
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
}`,Dm=`uniform vec3 diffuse;
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
}`,Lm=`#define LAMBERT
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
}`,Fm=`#define LAMBERT
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
}`,Nm=`#define MATCAP
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
}`,Um=`#define MATCAP
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
}`,Om=`#define NORMAL
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
}`,Bm=`#define NORMAL
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
}`,zm=`#define PHONG
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
}`,km=`#define PHONG
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
}`,Vm=`#define STANDARD
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
}`,Gm=`#define STANDARD
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
}`,Hm=`#define TOON
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
}`,Wm=`#define TOON
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
}`,Xm=`uniform float size;
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
}`,qm=`uniform vec3 diffuse;
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
}`,Ym=`#include <common>
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
}`,Zm=`uniform vec3 color;
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
}`,$m=`uniform float rotation;
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
}`,Km=`uniform vec3 diffuse;
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
}`,$e={alphahash_fragment:_f,alphahash_pars_fragment:xf,alphamap_fragment:yf,alphamap_pars_fragment:vf,alphatest_fragment:bf,alphatest_pars_fragment:Mf,aomap_fragment:Sf,aomap_pars_fragment:wf,batching_pars_vertex:Tf,batching_vertex:Ef,begin_vertex:Af,beginnormal_vertex:Rf,bsdfs:Cf,iridescence_fragment:Pf,bumpmap_pars_fragment:If,clipping_planes_fragment:Df,clipping_planes_pars_fragment:Lf,clipping_planes_pars_vertex:Ff,clipping_planes_vertex:Nf,color_fragment:Uf,color_pars_fragment:Of,color_pars_vertex:Bf,color_vertex:zf,common:kf,cube_uv_reflection_fragment:Vf,defaultnormal_vertex:Gf,displacementmap_pars_vertex:Hf,displacementmap_vertex:Wf,emissivemap_fragment:Xf,emissivemap_pars_fragment:qf,colorspace_fragment:Yf,colorspace_pars_fragment:Zf,envmap_fragment:$f,envmap_common_pars_fragment:Kf,envmap_pars_fragment:Jf,envmap_pars_vertex:jf,envmap_physical_pars_fragment:cp,envmap_vertex:Qf,fog_vertex:ep,fog_pars_vertex:tp,fog_fragment:np,fog_pars_fragment:ip,gradientmap_pars_fragment:sp,lightmap_pars_fragment:rp,lights_lambert_fragment:ap,lights_lambert_pars_fragment:op,lights_pars_begin:lp,lights_toon_fragment:hp,lights_toon_pars_fragment:up,lights_phong_fragment:dp,lights_phong_pars_fragment:fp,lights_physical_fragment:pp,lights_physical_pars_fragment:mp,lights_fragment_begin:gp,lights_fragment_maps:_p,lights_fragment_end:xp,lightprobes_pars_fragment:yp,logdepthbuf_fragment:vp,logdepthbuf_pars_fragment:bp,logdepthbuf_pars_vertex:Mp,logdepthbuf_vertex:Sp,map_fragment:wp,map_pars_fragment:Tp,map_particle_fragment:Ep,map_particle_pars_fragment:Ap,metalnessmap_fragment:Rp,metalnessmap_pars_fragment:Cp,morphinstance_vertex:Pp,morphcolor_vertex:Ip,morphnormal_vertex:Dp,morphtarget_pars_vertex:Lp,morphtarget_vertex:Fp,normal_fragment_begin:Np,normal_fragment_maps:Up,normal_pars_fragment:Op,normal_pars_vertex:Bp,normal_vertex:zp,normalmap_pars_fragment:kp,clearcoat_normal_fragment_begin:Vp,clearcoat_normal_fragment_maps:Gp,clearcoat_pars_fragment:Hp,iridescence_pars_fragment:Wp,opaque_fragment:Xp,packing:qp,premultiplied_alpha_fragment:Yp,project_vertex:Zp,dithering_fragment:$p,dithering_pars_fragment:Kp,roughnessmap_fragment:Jp,roughnessmap_pars_fragment:jp,shadowmap_pars_fragment:Qp,shadowmap_pars_vertex:em,shadowmap_vertex:tm,shadowmask_pars_fragment:nm,skinbase_vertex:im,skinning_pars_vertex:sm,skinning_vertex:rm,skinnormal_vertex:am,specularmap_fragment:om,specularmap_pars_fragment:lm,tonemapping_fragment:cm,tonemapping_pars_fragment:hm,transmission_fragment:um,transmission_pars_fragment:dm,uv_pars_fragment:fm,uv_pars_vertex:pm,uv_vertex:mm,worldpos_vertex:gm,background_vert:_m,background_frag:xm,backgroundCube_vert:ym,backgroundCube_frag:vm,cube_vert:bm,cube_frag:Mm,depth_vert:Sm,depth_frag:wm,distance_vert:Tm,distance_frag:Em,equirect_vert:Am,equirect_frag:Rm,linedashed_vert:Cm,linedashed_frag:Pm,meshbasic_vert:Im,meshbasic_frag:Dm,meshlambert_vert:Lm,meshlambert_frag:Fm,meshmatcap_vert:Nm,meshmatcap_frag:Um,meshnormal_vert:Om,meshnormal_frag:Bm,meshphong_vert:zm,meshphong_frag:km,meshphysical_vert:Vm,meshphysical_frag:Gm,meshtoon_vert:Hm,meshtoon_frag:Wm,points_vert:Xm,points_frag:qm,shadow_vert:Ym,shadow_frag:Zm,sprite_vert:$m,sprite_frag:Km},ge={common:{diffuse:{value:new Ze(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ge},alphaMap:{value:null},alphaMapTransform:{value:new Ge},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ge}},envmap:{envMap:{value:null},envMapRotation:{value:new Ge},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ge}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ge}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ge},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ge},normalScale:{value:new ze(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ge},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ge}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ge}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ge}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ze(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new V},probesMax:{value:new V},probesResolution:{value:new V}},points:{diffuse:{value:new Ze(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ge},alphaTest:{value:0},uvTransform:{value:new Ge}},sprite:{diffuse:{value:new Ze(16777215)},opacity:{value:1},center:{value:new ze(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ge},alphaMap:{value:null},alphaMapTransform:{value:new Ge},alphaTest:{value:0}}},An={basic:{uniforms:zt([ge.common,ge.specularmap,ge.envmap,ge.aomap,ge.lightmap,ge.fog]),vertexShader:$e.meshbasic_vert,fragmentShader:$e.meshbasic_frag},lambert:{uniforms:zt([ge.common,ge.specularmap,ge.envmap,ge.aomap,ge.lightmap,ge.emissivemap,ge.bumpmap,ge.normalmap,ge.displacementmap,ge.fog,ge.lights,{emissive:{value:new Ze(0)},envMapIntensity:{value:1}}]),vertexShader:$e.meshlambert_vert,fragmentShader:$e.meshlambert_frag},phong:{uniforms:zt([ge.common,ge.specularmap,ge.envmap,ge.aomap,ge.lightmap,ge.emissivemap,ge.bumpmap,ge.normalmap,ge.displacementmap,ge.fog,ge.lights,{emissive:{value:new Ze(0)},specular:{value:new Ze(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:$e.meshphong_vert,fragmentShader:$e.meshphong_frag},standard:{uniforms:zt([ge.common,ge.envmap,ge.aomap,ge.lightmap,ge.emissivemap,ge.bumpmap,ge.normalmap,ge.displacementmap,ge.roughnessmap,ge.metalnessmap,ge.fog,ge.lights,{emissive:{value:new Ze(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:$e.meshphysical_vert,fragmentShader:$e.meshphysical_frag},toon:{uniforms:zt([ge.common,ge.aomap,ge.lightmap,ge.emissivemap,ge.bumpmap,ge.normalmap,ge.displacementmap,ge.gradientmap,ge.fog,ge.lights,{emissive:{value:new Ze(0)}}]),vertexShader:$e.meshtoon_vert,fragmentShader:$e.meshtoon_frag},matcap:{uniforms:zt([ge.common,ge.bumpmap,ge.normalmap,ge.displacementmap,ge.fog,{matcap:{value:null}}]),vertexShader:$e.meshmatcap_vert,fragmentShader:$e.meshmatcap_frag},points:{uniforms:zt([ge.points,ge.fog]),vertexShader:$e.points_vert,fragmentShader:$e.points_frag},dashed:{uniforms:zt([ge.common,ge.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:$e.linedashed_vert,fragmentShader:$e.linedashed_frag},depth:{uniforms:zt([ge.common,ge.displacementmap]),vertexShader:$e.depth_vert,fragmentShader:$e.depth_frag},normal:{uniforms:zt([ge.common,ge.bumpmap,ge.normalmap,ge.displacementmap,{opacity:{value:1}}]),vertexShader:$e.meshnormal_vert,fragmentShader:$e.meshnormal_frag},sprite:{uniforms:zt([ge.sprite,ge.fog]),vertexShader:$e.sprite_vert,fragmentShader:$e.sprite_frag},background:{uniforms:{uvTransform:{value:new Ge},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:$e.background_vert,fragmentShader:$e.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ge}},vertexShader:$e.backgroundCube_vert,fragmentShader:$e.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:$e.cube_vert,fragmentShader:$e.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:$e.equirect_vert,fragmentShader:$e.equirect_frag},distance:{uniforms:zt([ge.common,ge.displacementmap,{referencePosition:{value:new V},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:$e.distance_vert,fragmentShader:$e.distance_frag},shadow:{uniforms:zt([ge.lights,ge.fog,{color:{value:new Ze(0)},opacity:{value:1}}]),vertexShader:$e.shadow_vert,fragmentShader:$e.shadow_frag}};An.physical={uniforms:zt([An.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ge},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ge},clearcoatNormalScale:{value:new ze(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ge},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ge},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ge},sheen:{value:0},sheenColor:{value:new Ze(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ge},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ge},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ge},transmissionSamplerSize:{value:new ze},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ge},attenuationDistance:{value:0},attenuationColor:{value:new Ze(0)},specularColor:{value:new Ze(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ge},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ge},anisotropyVector:{value:new ze},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ge}}]),vertexShader:$e.meshphysical_vert,fragmentShader:$e.meshphysical_frag};var oo={r:0,b:0,g:0},Jm=new pt,$h=new Ge;$h.set(-1,0,0,0,1,0,0,0,1);function jm(n,e,t,i,s,r){let a=new Ze(0),o=s===!0?0:1,l,c,u=null,d=0,h=null;function f(R){let A=R.isScene===!0?R.background:null;if(A&&A.isTexture){let v=R.backgroundBlurriness>0;A=e.get(A,v)}return A}function g(R){let A=!1,v=f(R);v===null?m(a,o):v&&v.isColor&&(m(v,1),A=!0);let E=n.xr.getEnvironmentBlendMode();E==="additive"?t.buffers.color.setClear(0,0,0,1,r):E==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,r),(n.autoClear||A)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function M(R,A){let v=f(A);v&&(v.isCubeTexture||v.mapping===Js)?(c===void 0&&(c=new Tt(new Qi(1,1,1),new en({name:"BackgroundCubeMaterial",uniforms:wi(An.backgroundCube.uniforms),vertexShader:An.backgroundCube.vertexShader,fragmentShader:An.backgroundCube.fragmentShader,side:Gt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(E,_,P){this.matrixWorld.copyPosition(P.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),c.material.uniforms.envMap.value=v,c.material.uniforms.backgroundBlurriness.value=A.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=A.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(Jm.makeRotationFromEuler(A.backgroundRotation)).transpose(),v.isCubeTexture&&v.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply($h),c.material.toneMapped=Qe.getTransfer(v.colorSpace)!==nt,(u!==v||d!==v.version||h!==n.toneMapping)&&(c.material.needsUpdate=!0,u=v,d=v.version,h=n.toneMapping),c.layers.enableAll(),R.unshift(c,c.geometry,c.material,0,0,null)):v&&v.isTexture&&(l===void 0&&(l=new Tt(new On(2,2),new en({name:"BackgroundMaterial",uniforms:wi(An.background.uniforms),vertexShader:An.background.vertexShader,fragmentShader:An.background.fragmentShader,side:fn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=v,l.material.uniforms.backgroundIntensity.value=A.backgroundIntensity,l.material.toneMapped=Qe.getTransfer(v.colorSpace)!==nt,v.matrixAutoUpdate===!0&&v.updateMatrix(),l.material.uniforms.uvTransform.value.copy(v.matrix),(u!==v||d!==v.version||h!==n.toneMapping)&&(l.material.needsUpdate=!0,u=v,d=v.version,h=n.toneMapping),l.layers.enableAll(),R.unshift(l,l.geometry,l.material,0,0,null))}function m(R,A){R.getRGB(oo,Rl(n)),t.buffers.color.setClear(oo.r,oo.g,oo.b,A,r)}function p(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return a},setClearColor:function(R,A=1){a.set(R),o=A,m(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(R){o=R,m(a,o)},render:g,addToRenderList:M,dispose:p}}function Qm(n,e){let t=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},s=h(null),r=s,a=!1;function o(T,D,B,L,I){let G=!1,N=d(T,L,B,D);r!==N&&(r=N,c(r.object)),G=f(T,L,B,I),G&&g(T,L,B,I),I!==null&&e.update(I,n.ELEMENT_ARRAY_BUFFER),(G||a)&&(a=!1,v(T,D,B,L),I!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get(I).buffer))}function l(){return n.createVertexArray()}function c(T){return n.bindVertexArray(T)}function u(T){return n.deleteVertexArray(T)}function d(T,D,B,L){let I=L.wireframe===!0,G=i[D.id];G===void 0&&(G={},i[D.id]=G);let N=T.isInstancedMesh===!0?T.id:0,k=G[N];k===void 0&&(k={},G[N]=k);let $=k[B.id];$===void 0&&($={},k[B.id]=$);let j=$[I];return j===void 0&&(j=h(l()),$[I]=j),j}function h(T){let D=[],B=[],L=[];for(let I=0;I<t;I++)D[I]=0,B[I]=0,L[I]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:D,enabledAttributes:B,attributeDivisors:L,object:T,attributes:{},index:null}}function f(T,D,B,L){let I=r.attributes,G=D.attributes,N=0,k=B.getAttributes();for(let $ in k)if(k[$].location>=0){let ne=I[$],ae=G[$];if(ae===void 0&&($==="instanceMatrix"&&T.instanceMatrix&&(ae=T.instanceMatrix),$==="instanceColor"&&T.instanceColor&&(ae=T.instanceColor)),ne===void 0||ne.attribute!==ae||ae&&ne.data!==ae.data)return!0;N++}return r.attributesNum!==N||r.index!==L}function g(T,D,B,L){let I={},G=D.attributes,N=0,k=B.getAttributes();for(let $ in k)if(k[$].location>=0){let ne=G[$];ne===void 0&&($==="instanceMatrix"&&T.instanceMatrix&&(ne=T.instanceMatrix),$==="instanceColor"&&T.instanceColor&&(ne=T.instanceColor));let ae={};ae.attribute=ne,ne&&ne.data&&(ae.data=ne.data),I[$]=ae,N++}r.attributes=I,r.attributesNum=N,r.index=L}function M(){let T=r.newAttributes;for(let D=0,B=T.length;D<B;D++)T[D]=0}function m(T){p(T,0)}function p(T,D){let B=r.newAttributes,L=r.enabledAttributes,I=r.attributeDivisors;B[T]=1,L[T]===0&&(n.enableVertexAttribArray(T),L[T]=1),I[T]!==D&&(n.vertexAttribDivisor(T,D),I[T]=D)}function R(){let T=r.newAttributes,D=r.enabledAttributes;for(let B=0,L=D.length;B<L;B++)D[B]!==T[B]&&(n.disableVertexAttribArray(B),D[B]=0)}function A(T,D,B,L,I,G,N){N===!0?n.vertexAttribIPointer(T,D,B,I,G):n.vertexAttribPointer(T,D,B,L,I,G)}function v(T,D,B,L){M();let I=L.attributes,G=B.getAttributes(),N=D.defaultAttributeValues;for(let k in G){let $=G[k];if($.location>=0){let j=I[k];if(j===void 0&&(k==="instanceMatrix"&&T.instanceMatrix&&(j=T.instanceMatrix),k==="instanceColor"&&T.instanceColor&&(j=T.instanceColor)),j!==void 0){let ne=j.normalized,ae=j.itemSize,ve=e.get(j);if(ve===void 0)continue;let Ne=ve.buffer,re=ve.type,H=ve.bytesPerElement,ie=re===n.INT||re===n.UNSIGNED_INT||j.gpuType===Ma;if(j.isInterleavedBufferAttribute){let Q=j.data,we=Q.stride,Te=j.offset;if(Q.isInstancedInterleavedBuffer){for(let J=0;J<$.locationSize;J++)p($.location+J,Q.meshPerAttribute);T.isInstancedMesh!==!0&&L._maxInstanceCount===void 0&&(L._maxInstanceCount=Q.meshPerAttribute*Q.count)}else for(let J=0;J<$.locationSize;J++)m($.location+J);n.bindBuffer(n.ARRAY_BUFFER,Ne);for(let J=0;J<$.locationSize;J++)A($.location+J,ae/$.locationSize,re,ne,we*H,(Te+ae/$.locationSize*J)*H,ie)}else{if(j.isInstancedBufferAttribute){for(let Q=0;Q<$.locationSize;Q++)p($.location+Q,j.meshPerAttribute);T.isInstancedMesh!==!0&&L._maxInstanceCount===void 0&&(L._maxInstanceCount=j.meshPerAttribute*j.count)}else for(let Q=0;Q<$.locationSize;Q++)m($.location+Q);n.bindBuffer(n.ARRAY_BUFFER,Ne);for(let Q=0;Q<$.locationSize;Q++)A($.location+Q,ae/$.locationSize,re,ne,ae*H,ae/$.locationSize*Q*H,ie)}}else if(N!==void 0){let ne=N[k];if(ne!==void 0)switch(ne.length){case 2:n.vertexAttrib2fv($.location,ne);break;case 3:n.vertexAttrib3fv($.location,ne);break;case 4:n.vertexAttrib4fv($.location,ne);break;default:n.vertexAttrib1fv($.location,ne)}}}}R()}function E(){C();for(let T in i){let D=i[T];for(let B in D){let L=D[B];for(let I in L){let G=L[I];for(let N in G)u(G[N].object),delete G[N];delete L[I]}}delete i[T]}}function _(T){if(i[T.id]===void 0)return;let D=i[T.id];for(let B in D){let L=D[B];for(let I in L){let G=L[I];for(let N in G)u(G[N].object),delete G[N];delete L[I]}}delete i[T.id]}function P(T){for(let D in i){let B=i[D];for(let L in B){let I=B[L];if(I[T.id]===void 0)continue;let G=I[T.id];for(let N in G)u(G[N].object),delete G[N];delete I[T.id]}}}function y(T){for(let D in i){let B=i[D],L=T.isInstancedMesh===!0?T.id:0,I=B[L];if(I!==void 0){for(let G in I){let N=I[G];for(let k in N)u(N[k].object),delete N[k];delete I[G]}delete B[L],Object.keys(B).length===0&&delete i[D]}}}function C(){w(),a=!0,r!==s&&(r=s,c(r.object))}function w(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:C,resetDefaultState:w,dispose:E,releaseStatesOfGeometry:_,releaseStatesOfObject:y,releaseStatesOfProgram:P,initAttributes:M,enableAttribute:m,disableUnusedAttributes:R}}function eg(n,e,t){let i;function s(l){i=l}function r(l,c){n.drawArrays(i,l,c),t.update(c,i,1)}function a(l,c,u){u!==0&&(n.drawArraysInstanced(i,l,c,u),t.update(c,i,u))}function o(l,c,u){if(u===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,u);let h=0;for(let f=0;f<u;f++)h+=c[f];t.update(h,i,1)}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o}function tg(n,e,t,i){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){let P=e.get("EXT_texture_filter_anisotropic");s=n.getParameter(P.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(P){return!(P!==on&&i.convert(P)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(P){let y=P===Tn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(P!==qt&&i.convert(P)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE)&&P!==_n&&!y)}function l(P){if(P==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";P="mediump"}return P==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp",u=l(c);u!==c&&(Fe("WebGLRenderer:",c,"not supported, using",u,"instead."),c=u);let d=t.logarithmicDepthBuffer===!0,h=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&h===!1&&Fe("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let f=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),g=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),M=n.getParameter(n.MAX_TEXTURE_SIZE),m=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),p=n.getParameter(n.MAX_VERTEX_ATTRIBS),R=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),A=n.getParameter(n.MAX_VARYING_VECTORS),v=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),E=n.getParameter(n.MAX_SAMPLES),_=n.getParameter(n.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:d,reversedDepthBuffer:h,maxTextures:f,maxVertexTextures:g,maxTextureSize:M,maxCubemapSize:m,maxAttributes:p,maxVertexUniforms:R,maxVaryings:A,maxFragmentUniforms:v,maxSamples:E,samples:_}}function ng(n){let e=this,t=null,i=0,s=!1,r=!1,a=new rn,o=new Ge,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(d,h){let f=d.length!==0||h||i!==0||s;return s=h,i=d.length,f},this.beginShadows=function(){r=!0,u(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(d,h){t=u(d,h,0)},this.setState=function(d,h,f){let g=d.clippingPlanes,M=d.clipIntersection,m=d.clipShadows,p=n.get(d);if(!s||g===null||g.length===0||r&&!m)r?u(null):c();else{let R=r?0:i,A=R*4,v=p.clippingState||null;l.value=v,v=u(g,h,A,f);for(let E=0;E!==A;++E)v[E]=t[E];p.clippingState=v,this.numIntersection=M?this.numPlanes:0,this.numPlanes+=R}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function u(d,h,f,g){let M=d!==null?d.length:0,m=null;if(M!==0){if(m=l.value,g!==!0||m===null){let p=f+M*4,R=h.matrixWorldInverse;o.getNormalMatrix(R),(m===null||m.length<p)&&(m=new Float32Array(p));for(let A=0,v=f;A!==M;++A,v+=4)a.copy(d[A]).applyMatrix4(R,o),a.normal.toArray(m,v),m[v+3]=a.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=M,e.numIntersection=0,m}}var li=4,Eh=[.125,.215,.35,.446,.526,.582],Ti=20,ig=256,rr=new ts,Ah=new Ze,Dl=null,Ll=0,Fl=0,Nl=!1,sg=new V,co=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,i=.1,s=100,r={}){let{size:a=256,position:o=sg}=r;Dl=this._renderer.getRenderTarget(),Ll=this._renderer.getActiveCubeFace(),Fl=this._renderer.getActiveMipmapLevel(),Nl=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,i,s,l,o),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Ph(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Ch(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Dl,Ll,Fl),this._renderer.xr.enabled=Nl,e.scissorTest=!1,os(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===si||e.mapping===Si?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Dl=this._renderer.getRenderTarget(),Ll=this._renderer.getActiveCubeFace(),Fl=this._renderer.getActiveMipmapLevel(),Nl=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let i=t||this._allocateTargets();return this._textureToCubeUV(e,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:wt,minFilter:wt,generateMipmaps:!1,type:Tn,format:on,colorSpace:Rs,depthBuffer:!1},s=Rh(e,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Rh(e,t,i);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=rg(r)),this._blurMaterial=og(r,e,t),this._ggxMaterial=ag(r,e,t)}return s}_compileMaterial(e){let t=new Tt(new Xt,e);this._renderer.compile(t,rr)}_sceneToCubeUV(e,t,i,s,r){let l=new Ot(90,1,t,i),c=[1,-1,1,1,1,1],u=[1,1,1,-1,-1,-1],d=this._renderer,h=d.autoClear,f=d.toneMapping;d.getClearColor(Ah),d.toneMapping=mn,d.autoClear=!1,d.state.buffers.depth.getReversed()&&(d.setRenderTarget(s),d.clearDepth(),d.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Tt(new Qi,new Nn({name:"PMREM.Background",side:Gt,depthWrite:!1,depthTest:!1})));let M=this._backgroundBox,m=M.material,p=!1,R=e.background;R?R.isColor&&(m.color.copy(R),e.background=null,p=!0):(m.color.copy(Ah),p=!0);for(let A=0;A<6;A++){let v=A%3;v===0?(l.up.set(0,c[A],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+u[A],r.y,r.z)):v===1?(l.up.set(0,0,c[A]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+u[A],r.z)):(l.up.set(0,c[A],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+u[A]));let E=this._cubeSize;os(s,v*E,A>2?E:0,E,E),d.setRenderTarget(s),p&&d.render(M,l),d.render(e,l)}d.toneMapping=f,d.autoClear=h,e.background=R}_textureToCubeUV(e,t){let i=this._renderer,s=e.mapping===si||e.mapping===Si;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Ph()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Ch());let r=s?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=r;let o=r.uniforms;o.envMap.value=e;let l=this._cubeSize;os(t,0,0,3*l,2*l),i.setRenderTarget(t),i.render(a,rr)}_applyPMREM(e){let t=this._renderer,i=t.autoClear;t.autoClear=!1;let s=this._lodMeshes.length;for(let r=1;r<s;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=i}_applyGGXFilter(e,t,i){let s=this._renderer,r=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[i];o.material=a;let l=a.uniforms,c=i/(this._lodMeshes.length-1),u=t/(this._lodMeshes.length-1),d=Math.sqrt(c*c-u*u),h=0+c*1.25,f=d*h,{_lodMax:g}=this,M=this._sizeLods[i],m=3*M*(i>g-li?i-g+li:0),p=4*(this._cubeSize-M);l.envMap.value=e.texture,l.roughness.value=f,l.mipInt.value=g-t,os(r,m,p,3*M,2*M),s.setRenderTarget(r),s.render(o,rr),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=g-i,os(e,m,p,3*M,2*M),s.setRenderTarget(e),s.render(o,rr)}_blur(e,t,i,s,r){let a=this._pingPongRenderTarget;this._halfBlur(e,a,t,i,s,"latitudinal",r),this._halfBlur(a,e,i,i,s,"longitudinal",r)}_halfBlur(e,t,i,s,r,a,o){let l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&Be("blur direction must be either latitudinal or longitudinal!");let u=3,d=this._lodMeshes[s];d.material=c;let h=c.uniforms,f=this._sizeLods[i]-1,g=isFinite(r)?Math.PI/(2*f):2*Math.PI/(2*Ti-1),M=r/g,m=isFinite(r)?1+Math.floor(u*M):Ti;m>Ti&&Fe(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${Ti}`);let p=[],R=0;for(let P=0;P<Ti;++P){let y=P/M,C=Math.exp(-y*y/2);p.push(C),P===0?R+=C:P<m&&(R+=2*C)}for(let P=0;P<p.length;P++)p[P]=p[P]/R;h.envMap.value=e.texture,h.samples.value=m,h.weights.value=p,h.latitudinal.value=a==="latitudinal",o&&(h.poleAxis.value=o);let{_lodMax:A}=this;h.dTheta.value=g,h.mipInt.value=A-i;let v=this._sizeLods[s],E=3*v*(s>A-li?s-A+li:0),_=4*(this._cubeSize-v);os(t,E,_,3*v,2*v),l.setRenderTarget(t),l.render(d,rr)}};function rg(n){let e=[],t=[],i=[],s=n,r=n-li+1+Eh.length;for(let a=0;a<r;a++){let o=Math.pow(2,s);e.push(o);let l=1/o;a>n-li?l=Eh[a-n+li-1]:a===0&&(l=0),t.push(l);let c=1/(o-2),u=-c,d=1+c,h=[u,u,d,u,d,d,u,u,d,d,u,d],f=6,g=6,M=3,m=2,p=1,R=new Float32Array(M*g*f),A=new Float32Array(m*g*f),v=new Float32Array(p*g*f);for(let _=0;_<f;_++){let P=_%3*2/3-1,y=_>2?0:-1,C=[P,y,0,P+2/3,y,0,P+2/3,y+1,0,P,y,0,P+2/3,y+1,0,P,y+1,0];R.set(C,M*g*_),A.set(h,m*g*_);let w=[_,_,_,_,_,_];v.set(w,p*g*_)}let E=new Xt;E.setAttribute("position",new Wt(R,M)),E.setAttribute("uv",new Wt(A,m)),E.setAttribute("faceIndex",new Wt(v,p)),i.push(new Tt(E,null)),s>li&&s--}return{lodMeshes:i,sizeLods:e,sigmas:t}}function Rh(n,e,t){let i=new Qt(n,e,t);return i.texture.mapping=Js,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function os(n,e,t,i,s){n.viewport.set(e,t,i,s),n.scissor.set(e,t,i,s)}function ag(n,e,t){return new en({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:ig,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:fo(),fragmentShader:`

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
		`,blending:wn,depthTest:!1,depthWrite:!1})}function og(n,e,t){let i=new Float32Array(Ti),s=new V(0,1,0);return new en({name:"SphericalGaussianBlur",defines:{n:Ti,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:fo(),fragmentShader:`

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
		`,blending:wn,depthTest:!1,depthWrite:!1})}function Ch(){return new en({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:fo(),fragmentShader:`

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
		`,blending:wn,depthTest:!1,depthWrite:!1})}function Ph(){return new en({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:fo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:wn,depthTest:!1,depthWrite:!1})}function fo(){return`

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
	`}var ho=class extends Qt{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let i={width:e,height:e,depth:1},s=[i,i,i,i,i,i];this.texture=new Bs(s),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},s=new Qi(5,5,5),r=new en({name:"CubemapFromEquirect",uniforms:wi(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:Gt,blending:wn});r.uniforms.tEquirect.value=t;let a=new Tt(s,r),o=t.minFilter;return t.minFilter===ri&&(t.minFilter=wt),new _a(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,i=!0,s=!0){let r=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,i,s);e.setRenderTarget(r)}};function lg(n){let e=new WeakMap,t=new WeakMap,i=null;function s(h,f=!1){return h==null?null:f?a(h):r(h)}function r(h){if(h&&h.isTexture){let f=h.mapping;if(f===ya||f===va)if(e.has(h)){let g=e.get(h).texture;return o(g,h.mapping)}else{let g=h.image;if(g&&g.height>0){let M=new ho(g.height);return M.fromEquirectangularTexture(n,h),e.set(h,M),h.addEventListener("dispose",c),o(M.texture,h.mapping)}else return null}}return h}function a(h){if(h&&h.isTexture){let f=h.mapping,g=f===ya||f===va,M=f===si||f===Si;if(g||M){let m=t.get(h),p=m!==void 0?m.texture.pmremVersion:0;if(h.isRenderTargetTexture&&h.pmremVersion!==p)return i===null&&(i=new co(n)),m=g?i.fromEquirectangular(h,m):i.fromCubemap(h,m),m.texture.pmremVersion=h.pmremVersion,t.set(h,m),m.texture;if(m!==void 0)return m.texture;{let R=h.image;return g&&R&&R.height>0||M&&R&&l(R)?(i===null&&(i=new co(n)),m=g?i.fromEquirectangular(h):i.fromCubemap(h),m.texture.pmremVersion=h.pmremVersion,t.set(h,m),h.addEventListener("dispose",u),m.texture):null}}}return h}function o(h,f){return f===ya?h.mapping=si:f===va&&(h.mapping=Si),h}function l(h){let f=0,g=6;for(let M=0;M<g;M++)h[M]!==void 0&&f++;return f===g}function c(h){let f=h.target;f.removeEventListener("dispose",c);let g=e.get(f);g!==void 0&&(e.delete(f),g.dispose())}function u(h){let f=h.target;f.removeEventListener("dispose",u);let g=t.get(f);g!==void 0&&(t.delete(f),g.dispose())}function d(){e=new WeakMap,t=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:s,dispose:d}}function cg(n){let e={};function t(i){if(e[i]!==void 0)return e[i];let s=n.getExtension(i);return e[i]=s,s}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){let s=t(i);return s===null&&yi("WebGLRenderer: "+i+" extension not supported."),s}}}function hg(n,e,t,i){let s={},r=new WeakMap;function a(d){let h=d.target;h.index!==null&&e.remove(h.index);for(let g in h.attributes)e.remove(h.attributes[g]);h.removeEventListener("dispose",a),delete s[h.id];let f=r.get(h);f&&(e.remove(f),r.delete(h)),i.releaseStatesOfGeometry(h),h.isInstancedBufferGeometry===!0&&delete h._maxInstanceCount,t.memory.geometries--}function o(d,h){return s[h.id]===!0||(h.addEventListener("dispose",a),s[h.id]=!0,t.memory.geometries++),h}function l(d){let h=d.attributes;for(let f in h)e.update(h[f],n.ARRAY_BUFFER)}function c(d){let h=[],f=d.index,g=d.attributes.position,M=0;if(g===void 0)return;if(f!==null){let R=f.array;M=f.version;for(let A=0,v=R.length;A<v;A+=3){let E=R[A+0],_=R[A+1],P=R[A+2];h.push(E,_,_,P,P,E)}}else{let R=g.array;M=g.version;for(let A=0,v=R.length/3-1;A<v;A+=3){let E=A+0,_=A+1,P=A+2;h.push(E,_,_,P,P,E)}}let m=new(g.count>=65535?Os:Us)(h,1);m.version=M;let p=r.get(d);p&&e.remove(p),r.set(d,m)}function u(d){let h=r.get(d);if(h){let f=d.index;f!==null&&h.version<f.version&&c(d)}else c(d);return r.get(d)}return{get:o,update:l,getWireframeAttribute:u}}function ug(n,e,t){let i;function s(d){i=d}let r,a;function o(d){r=d.type,a=d.bytesPerElement}function l(d,h){n.drawElements(i,h,r,d*a),t.update(h,i,1)}function c(d,h,f){f!==0&&(n.drawElementsInstanced(i,h,r,d*a,f),t.update(h,i,f))}function u(d,h,f){if(f===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,h,0,r,d,0,f);let M=0;for(let m=0;m<f;m++)M+=h[m];t.update(M,i,1)}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=u}function dg(n){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(r,a,o){switch(t.calls++,a){case n.TRIANGLES:t.triangles+=o*(r/3);break;case n.LINES:t.lines+=o*(r/2);break;case n.LINE_STRIP:t.lines+=o*(r-1);break;case n.LINE_LOOP:t.lines+=o*r;break;case n.POINTS:t.points+=o*r;break;default:Be("WebGLInfo: Unknown draw mode:",a);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:i}}function fg(n,e,t){let i=new WeakMap,s=new mt;function r(a,o,l){let c=a.morphTargetInfluences,u=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,d=u!==void 0?u.length:0,h=i.get(o);if(h===void 0||h.count!==d){let C=function(){P.dispose(),i.delete(o),o.removeEventListener("dispose",C)};h!==void 0&&h.texture.dispose();let f=o.morphAttributes.position!==void 0,g=o.morphAttributes.normal!==void 0,M=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],p=o.morphAttributes.normal||[],R=o.morphAttributes.color||[],A=0;f===!0&&(A=1),g===!0&&(A=2),M===!0&&(A=3);let v=o.attributes.position.count*A,E=1;v>e.maxTextureSize&&(E=Math.ceil(v/e.maxTextureSize),v=e.maxTextureSize);let _=new Float32Array(v*E*4*d),P=new Is(_,v,E,d);P.type=_n,P.needsUpdate=!0;let y=A*4;for(let w=0;w<d;w++){let T=m[w],D=p[w],B=R[w],L=v*E*4*w;for(let I=0;I<T.count;I++){let G=I*y;f===!0&&(s.fromBufferAttribute(T,I),_[L+G+0]=s.x,_[L+G+1]=s.y,_[L+G+2]=s.z,_[L+G+3]=0),g===!0&&(s.fromBufferAttribute(D,I),_[L+G+4]=s.x,_[L+G+5]=s.y,_[L+G+6]=s.z,_[L+G+7]=0),M===!0&&(s.fromBufferAttribute(B,I),_[L+G+8]=s.x,_[L+G+9]=s.y,_[L+G+10]=s.z,_[L+G+11]=B.itemSize===4?s.w:1)}}h={count:d,texture:P,size:new ze(v,E)},i.set(o,h),o.addEventListener("dispose",C)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(n,"morphTexture",a.morphTexture,t);else{let f=0;for(let M=0;M<c.length;M++)f+=c[M];let g=o.morphTargetsRelative?1:1-f;l.getUniforms().setValue(n,"morphTargetBaseInfluence",g),l.getUniforms().setValue(n,"morphTargetInfluences",c)}l.getUniforms().setValue(n,"morphTargetsTexture",h.texture,t),l.getUniforms().setValue(n,"morphTargetsTextureSize",h.size)}return{update:r}}function pg(n,e,t,i,s){let r=new WeakMap;function a(c){let u=s.render.frame,d=c.geometry,h=e.get(c,d);if(r.get(h)!==u&&(e.update(h),r.set(h,u)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==u&&(t.update(c.instanceMatrix,n.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,n.ARRAY_BUFFER),r.set(c,u))),c.isSkinnedMesh){let f=c.skeleton;r.get(f)!==u&&(f.update(),r.set(f,u))}return h}function o(){r=new WeakMap}function l(c){let u=c.target;u.removeEventListener("dispose",l),i.releaseStatesOfObject(u),t.remove(u.instanceMatrix),u.instanceColor!==null&&t.remove(u.instanceColor)}return{update:a,dispose:o}}var mg={[cl]:"LINEAR_TONE_MAPPING",[hl]:"REINHARD_TONE_MAPPING",[ul]:"CINEON_TONE_MAPPING",[dl]:"ACES_FILMIC_TONE_MAPPING",[pl]:"AGX_TONE_MAPPING",[ml]:"NEUTRAL_TONE_MAPPING",[fl]:"CUSTOM_TONE_MAPPING"};function gg(n,e,t,i,s,r){let a=new Qt(e,t,{type:n,depthBuffer:s,stencilBuffer:r,samples:i?4:0,depthTexture:s?new Un(e,t):void 0}),o=new Qt(e,t,{type:Tn,depthBuffer:!1,stencilBuffer:!1}),l=new Xt;l.setAttribute("position",new Dt([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new Dt([0,2,0,0,2,0],2));let c=new sa({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),u=new Tt(l,c),d=new ts(-1,1,1,-1,0,1),h=null,f=null,g=!1,M,m=null,p=[],R=!1;this.setSize=function(A,v){a.setSize(A,v),o.setSize(A,v);for(let E=0;E<p.length;E++){let _=p[E];_.setSize&&_.setSize(A,v)}},this.setEffects=function(A){p=A,R=p.length>0&&p[0].isRenderPass===!0;let v=a.width,E=a.height;for(let _=0;_<p.length;_++){let P=p[_];P.setSize&&P.setSize(v,E)}},this.begin=function(A,v){if(g||A.toneMapping===mn&&p.length===0)return!1;if(m=v,v!==null){let E=v.width,_=v.height;(a.width!==E||a.height!==_)&&this.setSize(E,_)}return R===!1&&A.setRenderTarget(a),M=A.toneMapping,A.toneMapping=mn,!0},this.hasRenderPass=function(){return R},this.end=function(A,v){A.toneMapping=M,g=!0;let E=a,_=o;for(let P=0;P<p.length;P++){let y=p[P];if(y.enabled!==!1&&(y.render(A,_,E,v),y.needsSwap!==!1)){let C=E;E=_,_=C}}if(h!==A.outputColorSpace||f!==A.toneMapping){h=A.outputColorSpace,f=A.toneMapping,c.defines={},Qe.getTransfer(h)===nt&&(c.defines.SRGB_TRANSFER="");let P=mg[f];P&&(c.defines[P]=""),c.needsUpdate=!0}c.uniforms.tDiffuse.value=E.texture,A.setRenderTarget(m),A.render(u,d),m=null,g=!1},this.isCompositing=function(){return g},this.dispose=function(){a.depthTexture&&a.depthTexture.dispose(),a.dispose(),o.dispose(),l.dispose(),c.dispose()}}var Kh=new Vt,Bl=new Un(1,1),Jh=new Is,jh=new ta,Qh=new Bs,Ih=[],Dh=[],Lh=new Float32Array(16),Fh=new Float32Array(9),Nh=new Float32Array(4);function cs(n,e,t){let i=n[0];if(i<=0||i>0)return n;let s=e*t,r=Ih[s];if(r===void 0&&(r=new Float32Array(s),Ih[s]=r),e!==0){i.toArray(r,0);for(let a=1,o=0;a!==e;++a)o+=t,n[a].toArray(r,o)}return r}function Et(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function At(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function po(n,e){let t=Dh[e];t===void 0&&(t=new Int32Array(e),Dh[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function _g(n,e){let t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function xg(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Et(t,e))return;n.uniform2fv(this.addr,e),At(t,e)}}function yg(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Et(t,e))return;n.uniform3fv(this.addr,e),At(t,e)}}function vg(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Et(t,e))return;n.uniform4fv(this.addr,e),At(t,e)}}function bg(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(Et(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),At(t,e)}else{if(Et(t,i))return;Nh.set(i),n.uniformMatrix2fv(this.addr,!1,Nh),At(t,i)}}function Mg(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(Et(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),At(t,e)}else{if(Et(t,i))return;Fh.set(i),n.uniformMatrix3fv(this.addr,!1,Fh),At(t,i)}}function Sg(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(Et(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),At(t,e)}else{if(Et(t,i))return;Lh.set(i),n.uniformMatrix4fv(this.addr,!1,Lh),At(t,i)}}function wg(n,e){let t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function Tg(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Et(t,e))return;n.uniform2iv(this.addr,e),At(t,e)}}function Eg(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Et(t,e))return;n.uniform3iv(this.addr,e),At(t,e)}}function Ag(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Et(t,e))return;n.uniform4iv(this.addr,e),At(t,e)}}function Rg(n,e){let t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function Cg(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Et(t,e))return;n.uniform2uiv(this.addr,e),At(t,e)}}function Pg(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Et(t,e))return;n.uniform3uiv(this.addr,e),At(t,e)}}function Ig(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Et(t,e))return;n.uniform4uiv(this.addr,e),At(t,e)}}function Dg(n,e,t){let i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s);let r;this.type===n.SAMPLER_2D_SHADOW?(Bl.compareFunction=t.isReversedDepthBuffer()?ao:ro,r=Bl):r=Kh,t.setTexture2D(e||r,s)}function Lg(n,e,t){let i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s),t.setTexture3D(e||jh,s)}function Fg(n,e,t){let i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s),t.setTextureCube(e||Qh,s)}function Ng(n,e,t){let i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s),t.setTexture2DArray(e||Jh,s)}function Ug(n){switch(n){case 5126:return _g;case 35664:return xg;case 35665:return yg;case 35666:return vg;case 35674:return bg;case 35675:return Mg;case 35676:return Sg;case 5124:case 35670:return wg;case 35667:case 35671:return Tg;case 35668:case 35672:return Eg;case 35669:case 35673:return Ag;case 5125:return Rg;case 36294:return Cg;case 36295:return Pg;case 36296:return Ig;case 35678:case 36198:case 36298:case 36306:case 35682:return Dg;case 35679:case 36299:case 36307:return Lg;case 35680:case 36300:case 36308:case 36293:return Fg;case 36289:case 36303:case 36311:case 36292:return Ng}}function Og(n,e){n.uniform1fv(this.addr,e)}function Bg(n,e){let t=cs(e,this.size,2);n.uniform2fv(this.addr,t)}function zg(n,e){let t=cs(e,this.size,3);n.uniform3fv(this.addr,t)}function kg(n,e){let t=cs(e,this.size,4);n.uniform4fv(this.addr,t)}function Vg(n,e){let t=cs(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function Gg(n,e){let t=cs(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function Hg(n,e){let t=cs(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function Wg(n,e){n.uniform1iv(this.addr,e)}function Xg(n,e){n.uniform2iv(this.addr,e)}function qg(n,e){n.uniform3iv(this.addr,e)}function Yg(n,e){n.uniform4iv(this.addr,e)}function Zg(n,e){n.uniform1uiv(this.addr,e)}function $g(n,e){n.uniform2uiv(this.addr,e)}function Kg(n,e){n.uniform3uiv(this.addr,e)}function Jg(n,e){n.uniform4uiv(this.addr,e)}function jg(n,e,t){let i=this.cache,s=e.length,r=po(t,s);Et(i,r)||(n.uniform1iv(this.addr,r),At(i,r));let a;this.type===n.SAMPLER_2D_SHADOW?a=Bl:a=Kh;for(let o=0;o!==s;++o)t.setTexture2D(e[o]||a,r[o])}function Qg(n,e,t){let i=this.cache,s=e.length,r=po(t,s);Et(i,r)||(n.uniform1iv(this.addr,r),At(i,r));for(let a=0;a!==s;++a)t.setTexture3D(e[a]||jh,r[a])}function e0(n,e,t){let i=this.cache,s=e.length,r=po(t,s);Et(i,r)||(n.uniform1iv(this.addr,r),At(i,r));for(let a=0;a!==s;++a)t.setTextureCube(e[a]||Qh,r[a])}function t0(n,e,t){let i=this.cache,s=e.length,r=po(t,s);Et(i,r)||(n.uniform1iv(this.addr,r),At(i,r));for(let a=0;a!==s;++a)t.setTexture2DArray(e[a]||Jh,r[a])}function n0(n){switch(n){case 5126:return Og;case 35664:return Bg;case 35665:return zg;case 35666:return kg;case 35674:return Vg;case 35675:return Gg;case 35676:return Hg;case 5124:case 35670:return Wg;case 35667:case 35671:return Xg;case 35668:case 35672:return qg;case 35669:case 35673:return Yg;case 5125:return Zg;case 36294:return $g;case 36295:return Kg;case 36296:return Jg;case 35678:case 36198:case 36298:case 36306:case 35682:return jg;case 35679:case 36299:case 36307:return Qg;case 35680:case 36300:case 36308:case 36293:return e0;case 36289:case 36303:case 36311:case 36292:return t0}}var zl=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=Ug(t.type)}},kl=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=n0(t.type)}},Vl=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){let s=this.seq;for(let r=0,a=s.length;r!==a;++r){let o=s[r];o.setValue(e,t[o.id],i)}}},Ul=/(\w+)(\])?(\[|\.)?/g;function Uh(n,e){n.seq.push(e),n.map[e.id]=e}function i0(n,e,t){let i=n.name,s=i.length;for(Ul.lastIndex=0;;){let r=Ul.exec(i),a=Ul.lastIndex,o=r[1],l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){Uh(t,c===void 0?new zl(o,n,e):new kl(o,n,e));break}else{let d=t.map[o];d===void 0&&(d=new Vl(o),Uh(t,d)),t=d}}}var ls=class{constructor(e,t){this.seq=[],this.map={};let i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let a=0;a<i;++a){let o=e.getActiveUniform(t,a),l=e.getUniformLocation(t,o.name);i0(o,l,this)}let s=[],r=[];for(let a of this.seq)a.type===e.SAMPLER_2D_SHADOW||a.type===e.SAMPLER_CUBE_SHADOW||a.type===e.SAMPLER_2D_ARRAY_SHADOW?s.push(a):r.push(a);s.length>0&&(this.seq=s.concat(r))}setValue(e,t,i,s){let r=this.map[t];r!==void 0&&r.setValue(e,i,s)}setOptional(e,t,i){let s=t[i];s!==void 0&&this.setValue(e,i,s)}static upload(e,t,i,s){for(let r=0,a=t.length;r!==a;++r){let o=t[r],l=i[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,s)}}static seqWithValue(e,t){let i=[];for(let s=0,r=e.length;s!==r;++s){let a=e[s];a.id in t&&i.push(a)}return i}};function Oh(n,e,t){let i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}var s0=37297,r0=0;function a0(n,e){let t=n.split(`
`),i=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let a=s;a<r;a++){let o=a+1;i.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return i.join(`
`)}var Bh=new Ge;function o0(n){Qe._getMatrix(Bh,Qe.workingColorSpace,n);let e=`mat3( ${Bh.elements.map(t=>t.toFixed(4))} )`;switch(Qe.getTransfer(n)){case Cs:return[e,"LinearTransferOETF"];case nt:return[e,"sRGBTransferOETF"];default:return Fe("WebGLProgram: Unsupported color space: ",n),[e,"LinearTransferOETF"]}}function zh(n,e,t){let i=n.getShaderParameter(e,n.COMPILE_STATUS),r=(n.getShaderInfoLog(e)||"").trim();if(i&&r==="")return"";let a=/ERROR: 0:(\d+)/.exec(r);if(a){let o=parseInt(a[1]);return t.toUpperCase()+`

`+r+`

`+a0(n.getShaderSource(e),o)}else return r}function l0(n,e){let t=o0(e);return[`vec4 ${n}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}var c0={[cl]:"Linear",[hl]:"Reinhard",[ul]:"Cineon",[dl]:"ACESFilmic",[pl]:"AgX",[ml]:"Neutral",[fl]:"Custom"};function h0(n,e){let t=c0[e];return t===void 0?(Fe("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+n+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var lo=new V;function u0(){Qe.getLuminanceCoefficients(lo);let n=lo.x.toFixed(4),e=lo.y.toFixed(4),t=lo.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function d0(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(or).join(`
`)}function f0(n){let e=[];for(let t in n){let i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function p0(n,e){let t={},i=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let s=0;s<i;s++){let r=n.getActiveAttrib(e,s),a=r.name,o=1;r.type===n.FLOAT_MAT2&&(o=2),r.type===n.FLOAT_MAT3&&(o=3),r.type===n.FLOAT_MAT4&&(o=4),t[a]={type:r.type,location:n.getAttribLocation(e,a),locationSize:o}}return t}function or(n){return n!==""}function kh(n,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Vh(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var m0=/^[ \t]*#include +<([\w\d./]+)>/gm;function Gl(n){return n.replace(m0,_0)}var g0=new Map;function _0(n,e){let t=$e[e];if(t===void 0){let i=g0.get(e);if(i!==void 0)t=$e[i],Fe('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return Gl(t)}var x0=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Gh(n){return n.replace(x0,y0)}function y0(n,e,t,i){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=i.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function Hh(n){let e=`precision ${n.precision} float;
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
#define LOW_PRECISION`),e}var v0={[Ks]:"SHADOWMAP_TYPE_PCF",[is]:"SHADOWMAP_TYPE_VSM"};function b0(n){return v0[n.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var M0={[si]:"ENVMAP_TYPE_CUBE",[Si]:"ENVMAP_TYPE_CUBE",[Js]:"ENVMAP_TYPE_CUBE_UV"};function S0(n){return n.envMap===!1?"ENVMAP_TYPE_CUBE":M0[n.envMapMode]||"ENVMAP_TYPE_CUBE"}var w0={[Si]:"ENVMAP_MODE_REFRACTION"};function T0(n){return n.envMap===!1?"ENVMAP_MODE_REFLECTION":w0[n.envMapMode]||"ENVMAP_MODE_REFLECTION"}var E0={[ll]:"ENVMAP_BLENDING_MULTIPLY",[sh]:"ENVMAP_BLENDING_MIX",[rh]:"ENVMAP_BLENDING_ADD"};function A0(n){return n.envMap===!1?"ENVMAP_BLENDING_NONE":E0[n.combine]||"ENVMAP_BLENDING_NONE"}function R0(n){let e=n.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,i=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:i,maxMip:t}}function C0(n,e,t,i){let s=n.getContext(),r=t.defines,a=t.vertexShader,o=t.fragmentShader,l=b0(t),c=S0(t),u=T0(t),d=A0(t),h=R0(t),f=d0(t),g=f0(r),M=s.createProgram(),m,p,R=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(or).join(`
`),m.length>0&&(m+=`
`),p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(or).join(`
`),p.length>0&&(p+=`
`)):(m=[Hh(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(or).join(`
`),p=[Hh(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+u:"",t.envMap?"#define "+d:"",h?"#define CUBEUV_TEXEL_WIDTH "+h.texelWidth:"",h?"#define CUBEUV_TEXEL_HEIGHT "+h.texelHeight:"",h?"#define CUBEUV_MAX_MIP "+h.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==mn?"#define TONE_MAPPING":"",t.toneMapping!==mn?$e.tonemapping_pars_fragment:"",t.toneMapping!==mn?h0("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",$e.colorspace_pars_fragment,l0("linearToOutputTexel",t.outputColorSpace),u0(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(or).join(`
`)),a=Gl(a),a=kh(a,t),a=Vh(a,t),o=Gl(o),o=kh(o,t),o=Vh(o,t),a=Gh(a),o=Gh(o),t.isRawShaderMaterial!==!0&&(R=`#version 300 es
`,m=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,p=["#define varying in",t.glslVersion===wl?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===wl?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);let A=R+m+a,v=R+p+o,E=Oh(s,s.VERTEX_SHADER,A),_=Oh(s,s.FRAGMENT_SHADER,v);s.attachShader(M,E),s.attachShader(M,_),t.index0AttributeName!==void 0?s.bindAttribLocation(M,0,t.index0AttributeName):t.hasPositionAttribute===!0&&s.bindAttribLocation(M,0,"position"),s.linkProgram(M);function P(T){if(n.debug.checkShaderErrors){let D=s.getProgramInfoLog(M)||"",B=s.getShaderInfoLog(E)||"",L=s.getShaderInfoLog(_)||"",I=D.trim(),G=B.trim(),N=L.trim(),k=!0,$=!0;if(s.getProgramParameter(M,s.LINK_STATUS)===!1)if(k=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(s,M,E,_);else{let j=zh(s,E,"vertex"),ne=zh(s,_,"fragment");Be("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(M,s.VALIDATE_STATUS)+`

Material Name: `+T.name+`
Material Type: `+T.type+`

Program Info Log: `+I+`
`+j+`
`+ne)}else I!==""?Fe("WebGLProgram: Program Info Log:",I):(G===""||N==="")&&($=!1);$&&(T.diagnostics={runnable:k,programLog:I,vertexShader:{log:G,prefix:m},fragmentShader:{log:N,prefix:p}})}s.deleteShader(E),s.deleteShader(_),y=new ls(s,M),C=p0(s,M)}let y;this.getUniforms=function(){return y===void 0&&P(this),y};let C;this.getAttributes=function(){return C===void 0&&P(this),C};let w=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return w===!1&&(w=s.getProgramParameter(M,s0)),w},this.destroy=function(){i.releaseStatesOfProgram(this),s.deleteProgram(M),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=r0++,this.cacheKey=e,this.usedTimes=1,this.program=M,this.vertexShader=E,this.fragmentShader=_,this}var P0=0,Hl=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,i){let s=this._getShaderCacheForMaterial(e);return s.has(t)===!1&&(s.add(t),t.usedTimes++),s.has(i)===!1&&(s.add(i),i.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){let t=this.shaderCache,i=t.get(e);return i===void 0&&(i=new Wl(e),t.set(e,i)),i}},Wl=class{constructor(e){this.id=P0++,this.code=e,this.usedTimes=0}};function I0(n){return n===oi||n===ir||n===sr}function D0(n,e,t,i,s,r){let a=new Ds,o=new Hl,l=new Set,c=[],u=new Map,d=i.logarithmicDepthBuffer,h=i.precision,f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(y){return l.add(y),y===0?"uv":`uv${y}`}function M(y,C,w,T,D,B){let L=T.fog,I=D.geometry,G=y.isMeshStandardMaterial||y.isMeshLambertMaterial||y.isMeshPhongMaterial?T.environment:null,N=y.isMeshStandardMaterial||y.isMeshLambertMaterial&&!y.envMap||y.isMeshPhongMaterial&&!y.envMap,k=e.get(y.envMap||G,N),$=k&&k.mapping===Js?k.image.height:null,j=f[y.type];y.precision!==null&&(h=i.getMaxPrecision(y.precision),h!==y.precision&&Fe("WebGLProgram.getParameters:",y.precision,"not supported, using",h,"instead."));let ne=I.morphAttributes.position||I.morphAttributes.normal||I.morphAttributes.color,ae=ne!==void 0?ne.length:0,ve=0;I.morphAttributes.position!==void 0&&(ve=1),I.morphAttributes.normal!==void 0&&(ve=2),I.morphAttributes.color!==void 0&&(ve=3);let Ne,re,H,ie;if(j){let Ee=An[j];Ne=Ee.vertexShader,re=Ee.fragmentShader}else{Ne=y.vertexShader,re=y.fragmentShader;let Ee=o.getVertexShaderStage(y),_t=o.getFragmentShaderStage(y);o.update(y,Ee,_t),H=Ee.id,ie=_t.id}let Q=n.getRenderTarget(),we=n.state.buffers.depth.getReversed(),Te=D.isInstancedMesh===!0,J=D.isBatchedMesh===!0,ce=!!y.map,oe=!!y.matcap,Se=!!k,Le=!!y.aoMap,Ue=!!y.lightMap,Ke=!!y.bumpMap&&y.wireframe===!1,Ve=!!y.normalMap,ke=!!y.displacementMap,Xe=!!y.emissiveMap,He=!!y.metalnessMap,rt=!!y.roughnessMap,F=y.anisotropy>0,at=y.clearcoat>0,We=y.dispersion>0,S=y.iridescence>0,x=y.sheen>0,z=y.transmission>0,W=F&&!!y.anisotropyMap,Z=at&&!!y.clearcoatMap,le=at&&!!y.clearcoatNormalMap,he=at&&!!y.clearcoatRoughnessMap,K=S&&!!y.iridescenceMap,te=S&&!!y.iridescenceThicknessMap,de=x&&!!y.sheenColorMap,Ce=x&&!!y.sheenRoughnessMap,me=!!y.specularMap,fe=!!y.specularColorMap,De=!!y.specularIntensityMap,Oe=z&&!!y.transmissionMap,qe=z&&!!y.thicknessMap,U=!!y.gradientMap,ue=!!y.alphaMap,ee=y.alphaTest>0,pe=!!y.alphaHash,ye=!!y.extensions,se=mn;y.toneMapped&&(Q===null||Q.isXRRenderTarget===!0)&&(se=n.toneMapping);let Re={shaderID:j,shaderType:y.type,shaderName:y.name,vertexShader:Ne,fragmentShader:re,defines:y.defines,customVertexShaderID:H,customFragmentShaderID:ie,isRawShaderMaterial:y.isRawShaderMaterial===!0,glslVersion:y.glslVersion,precision:h,batching:J,batchingColor:J&&D._colorsTexture!==null,instancing:Te,instancingColor:Te&&D.instanceColor!==null,instancingMorph:Te&&D.morphTexture!==null,outputColorSpace:Q===null?n.outputColorSpace:Q.isXRRenderTarget===!0?Q.texture.colorSpace:Qe.workingColorSpace,alphaToCoverage:!!y.alphaToCoverage,map:ce,matcap:oe,envMap:Se,envMapMode:Se&&k.mapping,envMapCubeUVHeight:$,aoMap:Le,lightMap:Ue,bumpMap:Ke,normalMap:Ve,displacementMap:ke,emissiveMap:Xe,normalMapObjectSpace:Ve&&y.normalMapType===lh,normalMapTangentSpace:Ve&&y.normalMapType===so,packedNormalMap:Ve&&y.normalMapType===so&&I0(y.normalMap.format),metalnessMap:He,roughnessMap:rt,anisotropy:F,anisotropyMap:W,clearcoat:at,clearcoatMap:Z,clearcoatNormalMap:le,clearcoatRoughnessMap:he,dispersion:We,iridescence:S,iridescenceMap:K,iridescenceThicknessMap:te,sheen:x,sheenColorMap:de,sheenRoughnessMap:Ce,specularMap:me,specularColorMap:fe,specularIntensityMap:De,transmission:z,transmissionMap:Oe,thicknessMap:qe,gradientMap:U,opaque:y.transparent===!1&&y.blending===vi&&y.alphaToCoverage===!1,alphaMap:ue,alphaTest:ee,alphaHash:pe,combine:y.combine,mapUv:ce&&g(y.map.channel),aoMapUv:Le&&g(y.aoMap.channel),lightMapUv:Ue&&g(y.lightMap.channel),bumpMapUv:Ke&&g(y.bumpMap.channel),normalMapUv:Ve&&g(y.normalMap.channel),displacementMapUv:ke&&g(y.displacementMap.channel),emissiveMapUv:Xe&&g(y.emissiveMap.channel),metalnessMapUv:He&&g(y.metalnessMap.channel),roughnessMapUv:rt&&g(y.roughnessMap.channel),anisotropyMapUv:W&&g(y.anisotropyMap.channel),clearcoatMapUv:Z&&g(y.clearcoatMap.channel),clearcoatNormalMapUv:le&&g(y.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:he&&g(y.clearcoatRoughnessMap.channel),iridescenceMapUv:K&&g(y.iridescenceMap.channel),iridescenceThicknessMapUv:te&&g(y.iridescenceThicknessMap.channel),sheenColorMapUv:de&&g(y.sheenColorMap.channel),sheenRoughnessMapUv:Ce&&g(y.sheenRoughnessMap.channel),specularMapUv:me&&g(y.specularMap.channel),specularColorMapUv:fe&&g(y.specularColorMap.channel),specularIntensityMapUv:De&&g(y.specularIntensityMap.channel),transmissionMapUv:Oe&&g(y.transmissionMap.channel),thicknessMapUv:qe&&g(y.thicknessMap.channel),alphaMapUv:ue&&g(y.alphaMap.channel),vertexTangents:!!I.attributes.tangent&&(Ve||F),vertexNormals:!!I.attributes.normal,vertexColors:y.vertexColors,vertexAlphas:y.vertexColors===!0&&!!I.attributes.color&&I.attributes.color.itemSize===4,pointsUvs:D.isPoints===!0&&!!I.attributes.uv&&(ce||ue),fog:!!L,useFog:y.fog===!0,fogExp2:!!L&&L.isFogExp2,flatShading:y.wireframe===!1&&(y.flatShading===!0||I.attributes.normal===void 0&&Ve===!1&&(y.isMeshLambertMaterial||y.isMeshPhongMaterial||y.isMeshStandardMaterial||y.isMeshPhysicalMaterial)),sizeAttenuation:y.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:we,skinning:D.isSkinnedMesh===!0,hasPositionAttribute:I.attributes.position!==void 0,morphTargets:I.morphAttributes.position!==void 0,morphNormals:I.morphAttributes.normal!==void 0,morphColors:I.morphAttributes.color!==void 0,morphTargetsCount:ae,morphTextureStride:ve,numDirLights:C.directional.length,numPointLights:C.point.length,numSpotLights:C.spot.length,numSpotLightMaps:C.spotLightMap.length,numRectAreaLights:C.rectArea.length,numHemiLights:C.hemi.length,numDirLightShadows:C.directionalShadowMap.length,numPointLightShadows:C.pointShadowMap.length,numSpotLightShadows:C.spotShadowMap.length,numSpotLightShadowsWithMaps:C.numSpotLightShadowsWithMaps,numLightProbes:C.numLightProbes,numLightProbeGrids:B.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:y.dithering,shadowMapEnabled:n.shadowMap.enabled&&w.length>0,shadowMapType:n.shadowMap.type,toneMapping:se,decodeVideoTexture:ce&&y.map.isVideoTexture===!0&&Qe.getTransfer(y.map.colorSpace)===nt,decodeVideoTextureEmissive:Xe&&y.emissiveMap.isVideoTexture===!0&&Qe.getTransfer(y.emissiveMap.colorSpace)===nt,premultipliedAlpha:y.premultipliedAlpha,doubleSided:y.side===Ht,flipSided:y.side===Gt,useDepthPacking:y.depthPacking>=0,depthPacking:y.depthPacking||0,index0AttributeName:y.index0AttributeName,extensionClipCullDistance:ye&&y.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ye&&y.extensions.multiDraw===!0||J)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:y.customProgramCacheKey()};return Re.vertexUv1s=l.has(1),Re.vertexUv2s=l.has(2),Re.vertexUv3s=l.has(3),l.clear(),Re}function m(y){let C=[];if(y.shaderID?C.push(y.shaderID):(C.push(y.customVertexShaderID),C.push(y.customFragmentShaderID)),y.defines!==void 0)for(let w in y.defines)C.push(w),C.push(y.defines[w]);return y.isRawShaderMaterial===!1&&(p(C,y),R(C,y),C.push(n.outputColorSpace)),C.push(y.customProgramCacheKey),C.join()}function p(y,C){y.push(C.precision),y.push(C.outputColorSpace),y.push(C.envMapMode),y.push(C.envMapCubeUVHeight),y.push(C.mapUv),y.push(C.alphaMapUv),y.push(C.lightMapUv),y.push(C.aoMapUv),y.push(C.bumpMapUv),y.push(C.normalMapUv),y.push(C.displacementMapUv),y.push(C.emissiveMapUv),y.push(C.metalnessMapUv),y.push(C.roughnessMapUv),y.push(C.anisotropyMapUv),y.push(C.clearcoatMapUv),y.push(C.clearcoatNormalMapUv),y.push(C.clearcoatRoughnessMapUv),y.push(C.iridescenceMapUv),y.push(C.iridescenceThicknessMapUv),y.push(C.sheenColorMapUv),y.push(C.sheenRoughnessMapUv),y.push(C.specularMapUv),y.push(C.specularColorMapUv),y.push(C.specularIntensityMapUv),y.push(C.transmissionMapUv),y.push(C.thicknessMapUv),y.push(C.combine),y.push(C.fogExp2),y.push(C.sizeAttenuation),y.push(C.morphTargetsCount),y.push(C.morphAttributeCount),y.push(C.numDirLights),y.push(C.numPointLights),y.push(C.numSpotLights),y.push(C.numSpotLightMaps),y.push(C.numHemiLights),y.push(C.numRectAreaLights),y.push(C.numDirLightShadows),y.push(C.numPointLightShadows),y.push(C.numSpotLightShadows),y.push(C.numSpotLightShadowsWithMaps),y.push(C.numLightProbes),y.push(C.shadowMapType),y.push(C.toneMapping),y.push(C.numClippingPlanes),y.push(C.numClipIntersection),y.push(C.depthPacking)}function R(y,C){a.disableAll(),C.instancing&&a.enable(0),C.instancingColor&&a.enable(1),C.instancingMorph&&a.enable(2),C.matcap&&a.enable(3),C.envMap&&a.enable(4),C.normalMapObjectSpace&&a.enable(5),C.normalMapTangentSpace&&a.enable(6),C.clearcoat&&a.enable(7),C.iridescence&&a.enable(8),C.alphaTest&&a.enable(9),C.vertexColors&&a.enable(10),C.vertexAlphas&&a.enable(11),C.vertexUv1s&&a.enable(12),C.vertexUv2s&&a.enable(13),C.vertexUv3s&&a.enable(14),C.vertexTangents&&a.enable(15),C.anisotropy&&a.enable(16),C.alphaHash&&a.enable(17),C.batching&&a.enable(18),C.dispersion&&a.enable(19),C.batchingColor&&a.enable(20),C.gradientMap&&a.enable(21),C.packedNormalMap&&a.enable(22),C.vertexNormals&&a.enable(23),y.push(a.mask),a.disableAll(),C.fog&&a.enable(0),C.useFog&&a.enable(1),C.flatShading&&a.enable(2),C.logarithmicDepthBuffer&&a.enable(3),C.reversedDepthBuffer&&a.enable(4),C.skinning&&a.enable(5),C.morphTargets&&a.enable(6),C.morphNormals&&a.enable(7),C.morphColors&&a.enable(8),C.premultipliedAlpha&&a.enable(9),C.shadowMapEnabled&&a.enable(10),C.doubleSided&&a.enable(11),C.flipSided&&a.enable(12),C.useDepthPacking&&a.enable(13),C.dithering&&a.enable(14),C.transmission&&a.enable(15),C.sheen&&a.enable(16),C.opaque&&a.enable(17),C.pointsUvs&&a.enable(18),C.decodeVideoTexture&&a.enable(19),C.decodeVideoTextureEmissive&&a.enable(20),C.alphaToCoverage&&a.enable(21),C.numLightProbeGrids>0&&a.enable(22),C.hasPositionAttribute&&a.enable(23),y.push(a.mask)}function A(y){let C=f[y.type],w;if(C){let T=An[C];w=wh.clone(T.uniforms)}else w=y.uniforms;return w}function v(y,C){let w=u.get(C);return w!==void 0?++w.usedTimes:(w=new C0(n,C,y,s),c.push(w),u.set(C,w)),w}function E(y){if(--y.usedTimes===0){let C=c.indexOf(y);c[C]=c[c.length-1],c.pop(),u.delete(y.cacheKey),y.destroy()}}function _(y){o.remove(y)}function P(){o.dispose()}return{getParameters:M,getProgramCacheKey:m,getUniforms:A,acquireProgram:v,releaseProgram:E,releaseShaderCache:_,programs:c,dispose:P}}function L0(){let n=new WeakMap;function e(a){return n.has(a)}function t(a){let o=n.get(a);return o===void 0&&(o={},n.set(a,o)),o}function i(a){n.delete(a)}function s(a,o,l){n.get(a)[o]=l}function r(){n=new WeakMap}return{has:e,get:t,remove:i,update:s,dispose:r}}function F0(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.materialVariant!==e.materialVariant?n.materialVariant-e.materialVariant:n.z!==e.z?n.z-e.z:n.id-e.id}function Wh(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function Xh(){let n=[],e=0,t=[],i=[],s=[];function r(){e=0,t.length=0,i.length=0,s.length=0}function a(h){let f=0;return h.isInstancedMesh&&(f+=2),h.isSkinnedMesh&&(f+=1),f}function o(h,f,g,M,m,p){let R=n[e];return R===void 0?(R={id:h.id,object:h,geometry:f,material:g,materialVariant:a(h),groupOrder:M,renderOrder:h.renderOrder,z:m,group:p},n[e]=R):(R.id=h.id,R.object=h,R.geometry=f,R.material=g,R.materialVariant=a(h),R.groupOrder=M,R.renderOrder=h.renderOrder,R.z=m,R.group=p),e++,R}function l(h,f,g,M,m,p){let R=o(h,f,g,M,m,p);g.transmission>0?i.push(R):g.transparent===!0?s.push(R):t.push(R)}function c(h,f,g,M,m,p){let R=o(h,f,g,M,m,p);g.transmission>0?i.unshift(R):g.transparent===!0?s.unshift(R):t.unshift(R)}function u(h,f,g){t.length>1&&t.sort(h||F0),i.length>1&&i.sort(f||Wh),s.length>1&&s.sort(f||Wh),g&&(t.reverse(),i.reverse(),s.reverse())}function d(){for(let h=e,f=n.length;h<f;h++){let g=n[h];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:t,transmissive:i,transparent:s,init:r,push:l,unshift:c,finish:d,sort:u}}function N0(){let n=new WeakMap;function e(i,s){let r=n.get(i),a;return r===void 0?(a=new Xh,n.set(i,[a])):s>=r.length?(a=new Xh,r.push(a)):a=r[s],a}function t(){n=new WeakMap}return{get:e,dispose:t}}function U0(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new V,color:new Ze};break;case"SpotLight":t={position:new V,direction:new V,color:new Ze,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new V,color:new Ze,distance:0,decay:0};break;case"HemisphereLight":t={direction:new V,skyColor:new Ze,groundColor:new Ze};break;case"RectAreaLight":t={color:new Ze,position:new V,halfWidth:new V,halfHeight:new V};break}return n[e.id]=t,t}}}function O0(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ze};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ze};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ze,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}var B0=0;function z0(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function k0(n){let e=new U0,t=O0(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new V);let s=new V,r=new pt,a=new pt;function o(c){let u=0,d=0,h=0;for(let C=0;C<9;C++)i.probe[C].set(0,0,0);let f=0,g=0,M=0,m=0,p=0,R=0,A=0,v=0,E=0,_=0,P=0;c.sort(z0);for(let C=0,w=c.length;C<w;C++){let T=c[C],D=T.color,B=T.intensity,L=T.distance,I=null;if(T.shadow&&T.shadow.map&&(T.shadow.map.texture.format===oi?I=T.shadow.map.texture:I=T.shadow.map.depthTexture||T.shadow.map.texture),T.isAmbientLight)u+=D.r*B,d+=D.g*B,h+=D.b*B;else if(T.isLightProbe){for(let G=0;G<9;G++)i.probe[G].addScaledVector(T.sh.coefficients[G],B);P++}else if(T.isDirectionalLight){let G=e.get(T);if(G.color.copy(T.color).multiplyScalar(T.intensity),T.castShadow){let N=T.shadow,k=t.get(T);k.shadowIntensity=N.intensity,k.shadowBias=N.bias,k.shadowNormalBias=N.normalBias,k.shadowRadius=N.radius,k.shadowMapSize=N.mapSize,i.directionalShadow[f]=k,i.directionalShadowMap[f]=I,i.directionalShadowMatrix[f]=T.shadow.matrix,R++}i.directional[f]=G,f++}else if(T.isSpotLight){let G=e.get(T);G.position.setFromMatrixPosition(T.matrixWorld),G.color.copy(D).multiplyScalar(B),G.distance=L,G.coneCos=Math.cos(T.angle),G.penumbraCos=Math.cos(T.angle*(1-T.penumbra)),G.decay=T.decay,i.spot[M]=G;let N=T.shadow;if(T.map&&(i.spotLightMap[E]=T.map,E++,N.updateMatrices(T),T.castShadow&&_++),i.spotLightMatrix[M]=N.matrix,T.castShadow){let k=t.get(T);k.shadowIntensity=N.intensity,k.shadowBias=N.bias,k.shadowNormalBias=N.normalBias,k.shadowRadius=N.radius,k.shadowMapSize=N.mapSize,i.spotShadow[M]=k,i.spotShadowMap[M]=I,v++}M++}else if(T.isRectAreaLight){let G=e.get(T);G.color.copy(D).multiplyScalar(B),G.halfWidth.set(T.width*.5,0,0),G.halfHeight.set(0,T.height*.5,0),i.rectArea[m]=G,m++}else if(T.isPointLight){let G=e.get(T);if(G.color.copy(T.color).multiplyScalar(T.intensity),G.distance=T.distance,G.decay=T.decay,T.castShadow){let N=T.shadow,k=t.get(T);k.shadowIntensity=N.intensity,k.shadowBias=N.bias,k.shadowNormalBias=N.normalBias,k.shadowRadius=N.radius,k.shadowMapSize=N.mapSize,k.shadowCameraNear=N.camera.near,k.shadowCameraFar=N.camera.far,i.pointShadow[g]=k,i.pointShadowMap[g]=I,i.pointShadowMatrix[g]=T.shadow.matrix,A++}i.point[g]=G,g++}else if(T.isHemisphereLight){let G=e.get(T);G.skyColor.copy(T.color).multiplyScalar(B),G.groundColor.copy(T.groundColor).multiplyScalar(B),i.hemi[p]=G,p++}}m>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=ge.LTC_FLOAT_1,i.rectAreaLTC2=ge.LTC_FLOAT_2):(i.rectAreaLTC1=ge.LTC_HALF_1,i.rectAreaLTC2=ge.LTC_HALF_2)),i.ambient[0]=u,i.ambient[1]=d,i.ambient[2]=h;let y=i.hash;(y.directionalLength!==f||y.pointLength!==g||y.spotLength!==M||y.rectAreaLength!==m||y.hemiLength!==p||y.numDirectionalShadows!==R||y.numPointShadows!==A||y.numSpotShadows!==v||y.numSpotMaps!==E||y.numLightProbes!==P)&&(i.directional.length=f,i.spot.length=M,i.rectArea.length=m,i.point.length=g,i.hemi.length=p,i.directionalShadow.length=R,i.directionalShadowMap.length=R,i.pointShadow.length=A,i.pointShadowMap.length=A,i.spotShadow.length=v,i.spotShadowMap.length=v,i.directionalShadowMatrix.length=R,i.pointShadowMatrix.length=A,i.spotLightMatrix.length=v+E-_,i.spotLightMap.length=E,i.numSpotLightShadowsWithMaps=_,i.numLightProbes=P,y.directionalLength=f,y.pointLength=g,y.spotLength=M,y.rectAreaLength=m,y.hemiLength=p,y.numDirectionalShadows=R,y.numPointShadows=A,y.numSpotShadows=v,y.numSpotMaps=E,y.numLightProbes=P,i.version=B0++)}function l(c,u){let d=0,h=0,f=0,g=0,M=0,m=u.matrixWorldInverse;for(let p=0,R=c.length;p<R;p++){let A=c[p];if(A.isDirectionalLight){let v=i.directional[d];v.direction.setFromMatrixPosition(A.matrixWorld),s.setFromMatrixPosition(A.target.matrixWorld),v.direction.sub(s),v.direction.transformDirection(m),d++}else if(A.isSpotLight){let v=i.spot[f];v.position.setFromMatrixPosition(A.matrixWorld),v.position.applyMatrix4(m),v.direction.setFromMatrixPosition(A.matrixWorld),s.setFromMatrixPosition(A.target.matrixWorld),v.direction.sub(s),v.direction.transformDirection(m),f++}else if(A.isRectAreaLight){let v=i.rectArea[g];v.position.setFromMatrixPosition(A.matrixWorld),v.position.applyMatrix4(m),a.identity(),r.copy(A.matrixWorld),r.premultiply(m),a.extractRotation(r),v.halfWidth.set(A.width*.5,0,0),v.halfHeight.set(0,A.height*.5,0),v.halfWidth.applyMatrix4(a),v.halfHeight.applyMatrix4(a),g++}else if(A.isPointLight){let v=i.point[h];v.position.setFromMatrixPosition(A.matrixWorld),v.position.applyMatrix4(m),h++}else if(A.isHemisphereLight){let v=i.hemi[M];v.direction.setFromMatrixPosition(A.matrixWorld),v.direction.transformDirection(m),M++}}}return{setup:o,setupView:l,state:i}}function qh(n){let e=new k0(n),t=[],i=[],s=[];function r(h){d.camera=h,t.length=0,i.length=0,s.length=0}function a(h){t.push(h)}function o(h){i.push(h)}function l(h){s.push(h)}function c(){e.setup(t)}function u(h){e.setupView(t,h)}let d={lightsArray:t,shadowsArray:i,lightProbeGridArray:s,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:d,setupLights:c,setupLightsView:u,pushLight:a,pushShadow:o,pushLightProbeGrid:l}}function V0(n){let e=new WeakMap;function t(s,r=0){let a=e.get(s),o;return a===void 0?(o=new qh(n),e.set(s,[o])):r>=a.length?(o=new qh(n),a.push(o)):o=a[r],o}function i(){e=new WeakMap}return{get:t,dispose:i}}var G0=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,H0=`uniform sampler2D shadow_pass;
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
}`,W0=[new V(1,0,0),new V(-1,0,0),new V(0,1,0),new V(0,-1,0),new V(0,0,1),new V(0,0,-1)],X0=[new V(0,-1,0),new V(0,-1,0),new V(0,0,1),new V(0,0,-1),new V(0,-1,0),new V(0,-1,0)],Yh=new pt,ar=new V,Ol=new V;function q0(n,e,t){let i=new Ji,s=new ze,r=new ze,a=new mt,o=new ra,l=new aa,c={},u=t.maxTextureSize,d={[fn]:Gt,[Gt]:fn,[Ht]:Ht},h=new en({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ze},radius:{value:4}},vertexShader:G0,fragmentShader:H0}),f=h.clone();f.defines.HORIZONTAL_PASS=1;let g=new Xt;g.setAttribute("position",new Wt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let M=new Tt(g,h),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Ks;let p=this.type;this.render=function(_,P,y){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||_.length===0)return;this.type===zc&&(Fe("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=Ks);let C=n.getRenderTarget(),w=n.getActiveCubeFace(),T=n.getActiveMipmapLevel(),D=n.state;D.setBlending(wn),D.buffers.depth.getReversed()===!0?D.buffers.color.setClear(0,0,0,0):D.buffers.color.setClear(1,1,1,1),D.buffers.depth.setTest(!0),D.setScissorTest(!1);let B=p!==this.type;B&&P.traverse(function(L){L.material&&(Array.isArray(L.material)?L.material.forEach(I=>I.needsUpdate=!0):L.material.needsUpdate=!0)});for(let L=0,I=_.length;L<I;L++){let G=_[L],N=G.shadow;if(N===void 0){Fe("WebGLShadowMap:",G,"has no shadow.");continue}if(N.autoUpdate===!1&&N.needsUpdate===!1)continue;s.copy(N.mapSize);let k=N.getFrameExtents();s.multiply(k),r.copy(N.mapSize),(s.x>u||s.y>u)&&(s.x>u&&(r.x=Math.floor(u/k.x),s.x=r.x*k.x,N.mapSize.x=r.x),s.y>u&&(r.y=Math.floor(u/k.y),s.y=r.y*k.y,N.mapSize.y=r.y));let $=n.state.buffers.depth.getReversed();if(N.camera._reversedDepth=$,N.map===null||B===!0){if(N.map!==null&&(N.map.depthTexture!==null&&(N.map.depthTexture.dispose(),N.map.depthTexture=null),N.map.dispose()),this.type===is){if(G.isPointLight){Fe("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}N.map=new Qt(s.x,s.y,{format:oi,type:Tn,minFilter:wt,magFilter:wt,generateMipmaps:!1}),N.map.texture.name=G.name+".shadowMap",N.map.depthTexture=new Un(s.x,s.y,_n),N.map.depthTexture.name=G.name+".shadowMapDepth",N.map.depthTexture.format=Sn,N.map.depthTexture.compareFunction=null,N.map.depthTexture.minFilter=It,N.map.depthTexture.magFilter=It}else G.isPointLight?(N.map=new ho(s.x),N.map.depthTexture=new ia(s.x,gn)):(N.map=new Qt(s.x,s.y),N.map.depthTexture=new Un(s.x,s.y,gn)),N.map.depthTexture.name=G.name+".shadowMap",N.map.depthTexture.format=Sn,this.type===Ks?(N.map.depthTexture.compareFunction=$?ao:ro,N.map.depthTexture.minFilter=wt,N.map.depthTexture.magFilter=wt):(N.map.depthTexture.compareFunction=null,N.map.depthTexture.minFilter=It,N.map.depthTexture.magFilter=It);N.camera.updateProjectionMatrix()}let j=N.map.isWebGLCubeRenderTarget?6:1;for(let ne=0;ne<j;ne++){if(N.map.isWebGLCubeRenderTarget)n.setRenderTarget(N.map,ne),n.clear();else{ne===0&&(n.setRenderTarget(N.map),n.clear());let ae=N.getViewport(ne);a.set(r.x*ae.x,r.y*ae.y,r.x*ae.z,r.y*ae.w),D.viewport(a)}if(G.isPointLight){let ae=N.camera,ve=N.matrix,Ne=G.distance||ae.far;Ne!==ae.far&&(ae.far=Ne,ae.updateProjectionMatrix()),ar.setFromMatrixPosition(G.matrixWorld),ae.position.copy(ar),Ol.copy(ae.position),Ol.add(W0[ne]),ae.up.copy(X0[ne]),ae.lookAt(Ol),ae.updateMatrixWorld(),ve.makeTranslation(-ar.x,-ar.y,-ar.z),Yh.multiplyMatrices(ae.projectionMatrix,ae.matrixWorldInverse),N._frustum.setFromProjectionMatrix(Yh,ae.coordinateSystem,ae.reversedDepth)}else N.updateMatrices(G);i=N.getFrustum(),v(P,y,N.camera,G,this.type)}N.isPointLightShadow!==!0&&this.type===is&&R(N,y),N.needsUpdate=!1}p=this.type,m.needsUpdate=!1,n.setRenderTarget(C,w,T)};function R(_,P){let y=e.update(M);h.defines.VSM_SAMPLES!==_.blurSamples&&(h.defines.VSM_SAMPLES=_.blurSamples,f.defines.VSM_SAMPLES=_.blurSamples,h.needsUpdate=!0,f.needsUpdate=!0),_.mapPass===null&&(_.mapPass=new Qt(s.x,s.y,{format:oi,type:Tn})),h.uniforms.shadow_pass.value=_.map.depthTexture,h.uniforms.resolution.value=_.mapSize,h.uniforms.radius.value=_.radius,n.setRenderTarget(_.mapPass),n.clear(),n.renderBufferDirect(P,null,y,h,M,null),f.uniforms.shadow_pass.value=_.mapPass.texture,f.uniforms.resolution.value=_.mapSize,f.uniforms.radius.value=_.radius,n.setRenderTarget(_.map),n.clear(),n.renderBufferDirect(P,null,y,f,M,null)}function A(_,P,y,C){let w=null,T=y.isPointLight===!0?_.customDistanceMaterial:_.customDepthMaterial;if(T!==void 0)w=T;else if(w=y.isPointLight===!0?l:o,n.localClippingEnabled&&P.clipShadows===!0&&Array.isArray(P.clippingPlanes)&&P.clippingPlanes.length!==0||P.displacementMap&&P.displacementScale!==0||P.alphaMap&&P.alphaTest>0||P.map&&P.alphaTest>0||P.alphaToCoverage===!0){let D=w.uuid,B=P.uuid,L=c[D];L===void 0&&(L={},c[D]=L);let I=L[B];I===void 0&&(I=w.clone(),L[B]=I,P.addEventListener("dispose",E)),w=I}if(w.visible=P.visible,w.wireframe=P.wireframe,C===is?w.side=P.shadowSide!==null?P.shadowSide:P.side:w.side=P.shadowSide!==null?P.shadowSide:d[P.side],w.alphaMap=P.alphaMap,w.alphaTest=P.alphaToCoverage===!0?.5:P.alphaTest,w.map=P.map,w.clipShadows=P.clipShadows,w.clippingPlanes=P.clippingPlanes,w.clipIntersection=P.clipIntersection,w.displacementMap=P.displacementMap,w.displacementScale=P.displacementScale,w.displacementBias=P.displacementBias,w.wireframeLinewidth=P.wireframeLinewidth,w.linewidth=P.linewidth,y.isPointLight===!0&&w.isMeshDistanceMaterial===!0){let D=n.properties.get(w);D.light=y}return w}function v(_,P,y,C,w){if(_.visible===!1)return;if(_.layers.test(P.layers)&&(_.isMesh||_.isLine||_.isPoints)&&(_.castShadow||_.receiveShadow&&w===is)&&(!_.frustumCulled||i.intersectsObject(_))){_.modelViewMatrix.multiplyMatrices(y.matrixWorldInverse,_.matrixWorld);let B=e.update(_),L=_.material;if(Array.isArray(L)){let I=B.groups;for(let G=0,N=I.length;G<N;G++){let k=I[G],$=L[k.materialIndex];if($&&$.visible){let j=A(_,$,C,w);_.onBeforeShadow(n,_,P,y,B,j,k),n.renderBufferDirect(y,null,B,j,_,k),_.onAfterShadow(n,_,P,y,B,j,k)}}}else if(L.visible){let I=A(_,L,C,w);_.onBeforeShadow(n,_,P,y,B,I,null),n.renderBufferDirect(y,null,B,I,_,null),_.onAfterShadow(n,_,P,y,B,I,null)}}let D=_.children;for(let B=0,L=D.length;B<L;B++)v(D[B],P,y,C,w)}function E(_){_.target.removeEventListener("dispose",E);for(let y in c){let C=c[y],w=_.target.uuid;w in C&&(C[w].dispose(),delete C[w])}}}function Y0(n,e){function t(){let U=!1,ue=new mt,ee=null,pe=new mt(0,0,0,0);return{setMask:function(ye){ee!==ye&&!U&&(n.colorMask(ye,ye,ye,ye),ee=ye)},setLocked:function(ye){U=ye},setClear:function(ye,se,Re,Ee,_t){_t===!0&&(ye*=Ee,se*=Ee,Re*=Ee),ue.set(ye,se,Re,Ee),pe.equals(ue)===!1&&(n.clearColor(ye,se,Re,Ee),pe.copy(ue))},reset:function(){U=!1,ee=null,pe.set(-1,0,0,0)}}}function i(){let U=!1,ue=!1,ee=null,pe=null,ye=null;return{setReversed:function(se){if(ue!==se){let Re=e.get("EXT_clip_control");se?Re.clipControlEXT(Re.LOWER_LEFT_EXT,Re.ZERO_TO_ONE_EXT):Re.clipControlEXT(Re.LOWER_LEFT_EXT,Re.NEGATIVE_ONE_TO_ONE_EXT),ue=se;let Ee=ye;ye=null,this.setClear(Ee)}},getReversed:function(){return ue},setTest:function(se){se?Q(n.DEPTH_TEST):we(n.DEPTH_TEST)},setMask:function(se){ee!==se&&!U&&(n.depthMask(se),ee=se)},setFunc:function(se){if(ue&&(se=xh[se]),pe!==se){switch(se){case Hr:n.depthFunc(n.NEVER);break;case Wr:n.depthFunc(n.ALWAYS);break;case Xr:n.depthFunc(n.LESS);break;case bi:n.depthFunc(n.LEQUAL);break;case qr:n.depthFunc(n.EQUAL);break;case Yr:n.depthFunc(n.GEQUAL);break;case Zr:n.depthFunc(n.GREATER);break;case $r:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}pe=se}},setLocked:function(se){U=se},setClear:function(se){ye!==se&&(ye=se,ue&&(se=1-se),n.clearDepth(se))},reset:function(){U=!1,ee=null,pe=null,ye=null,ue=!1}}}function s(){let U=!1,ue=null,ee=null,pe=null,ye=null,se=null,Re=null,Ee=null,_t=null;return{setTest:function(ut){U||(ut?Q(n.STENCIL_TEST):we(n.STENCIL_TEST))},setMask:function(ut){ue!==ut&&!U&&(n.stencilMask(ut),ue=ut)},setFunc:function(ut,xn,yn){(ee!==ut||pe!==xn||ye!==yn)&&(n.stencilFunc(ut,xn,yn),ee=ut,pe=xn,ye=yn)},setOp:function(ut,xn,yn){(se!==ut||Re!==xn||Ee!==yn)&&(n.stencilOp(ut,xn,yn),se=ut,Re=xn,Ee=yn)},setLocked:function(ut){U=ut},setClear:function(ut){_t!==ut&&(n.clearStencil(ut),_t=ut)},reset:function(){U=!1,ue=null,ee=null,pe=null,ye=null,se=null,Re=null,Ee=null,_t=null}}}let r=new t,a=new i,o=new s,l=new WeakMap,c=new WeakMap,u={},d={},h={},f=new WeakMap,g=[],M=null,m=!1,p=null,R=null,A=null,v=null,E=null,_=null,P=null,y=new Ze(0,0,0),C=0,w=!1,T=null,D=null,B=null,L=null,I=null,G=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS),N=!1,k=0,$=n.getParameter(n.VERSION);$.indexOf("WebGL")!==-1?(k=parseFloat(/^WebGL (\d)/.exec($)[1]),N=k>=1):$.indexOf("OpenGL ES")!==-1&&(k=parseFloat(/^OpenGL ES (\d)/.exec($)[1]),N=k>=2);let j=null,ne={},ae=n.getParameter(n.SCISSOR_BOX),ve=n.getParameter(n.VIEWPORT),Ne=new mt().fromArray(ae),re=new mt().fromArray(ve);function H(U,ue,ee,pe){let ye=new Uint8Array(4),se=n.createTexture();n.bindTexture(U,se),n.texParameteri(U,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(U,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let Re=0;Re<ee;Re++)U===n.TEXTURE_3D||U===n.TEXTURE_2D_ARRAY?n.texImage3D(ue,0,n.RGBA,1,1,pe,0,n.RGBA,n.UNSIGNED_BYTE,ye):n.texImage2D(ue+Re,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,ye);return se}let ie={};ie[n.TEXTURE_2D]=H(n.TEXTURE_2D,n.TEXTURE_2D,1),ie[n.TEXTURE_CUBE_MAP]=H(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),ie[n.TEXTURE_2D_ARRAY]=H(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),ie[n.TEXTURE_3D]=H(n.TEXTURE_3D,n.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),Q(n.DEPTH_TEST),a.setFunc(bi),Ke(!1),Ve(sl),Q(n.CULL_FACE),Le(wn);function Q(U){u[U]!==!0&&(n.enable(U),u[U]=!0)}function we(U){u[U]!==!1&&(n.disable(U),u[U]=!1)}function Te(U,ue){return h[U]!==ue?(n.bindFramebuffer(U,ue),h[U]=ue,U===n.DRAW_FRAMEBUFFER&&(h[n.FRAMEBUFFER]=ue),U===n.FRAMEBUFFER&&(h[n.DRAW_FRAMEBUFFER]=ue),!0):!1}function J(U,ue){let ee=g,pe=!1;if(U){ee=f.get(ue),ee===void 0&&(ee=[],f.set(ue,ee));let ye=U.textures;if(ee.length!==ye.length||ee[0]!==n.COLOR_ATTACHMENT0){for(let se=0,Re=ye.length;se<Re;se++)ee[se]=n.COLOR_ATTACHMENT0+se;ee.length=ye.length,pe=!0}}else ee[0]!==n.BACK&&(ee[0]=n.BACK,pe=!0);pe&&n.drawBuffers(ee)}function ce(U){return M!==U?(n.useProgram(U),M=U,!0):!1}let oe={[$n]:n.FUNC_ADD,[Vc]:n.FUNC_SUBTRACT,[Gc]:n.FUNC_REVERSE_SUBTRACT};oe[Hc]=n.MIN,oe[Wc]=n.MAX;let Se={[Xc]:n.ZERO,[qc]:n.ONE,[Yc]:n.SRC_COLOR,[Vr]:n.SRC_ALPHA,[Qc]:n.SRC_ALPHA_SATURATE,[Jc]:n.DST_COLOR,[$c]:n.DST_ALPHA,[Zc]:n.ONE_MINUS_SRC_COLOR,[Gr]:n.ONE_MINUS_SRC_ALPHA,[jc]:n.ONE_MINUS_DST_COLOR,[Kc]:n.ONE_MINUS_DST_ALPHA,[eh]:n.CONSTANT_COLOR,[th]:n.ONE_MINUS_CONSTANT_COLOR,[nh]:n.CONSTANT_ALPHA,[ih]:n.ONE_MINUS_CONSTANT_ALPHA};function Le(U,ue,ee,pe,ye,se,Re,Ee,_t,ut){if(U===wn){m===!0&&(we(n.BLEND),m=!1);return}if(m===!1&&(Q(n.BLEND),m=!0),U!==kc){if(U!==p||ut!==w){if((R!==$n||E!==$n)&&(n.blendEquation(n.FUNC_ADD),R=$n,E=$n),ut)switch(U){case vi:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case rl:n.blendFunc(n.ONE,n.ONE);break;case al:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case ol:n.blendFuncSeparate(n.DST_COLOR,n.ONE_MINUS_SRC_ALPHA,n.ZERO,n.ONE);break;default:Be("WebGLState: Invalid blending: ",U);break}else switch(U){case vi:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case rl:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE,n.ONE,n.ONE);break;case al:Be("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case ol:Be("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Be("WebGLState: Invalid blending: ",U);break}A=null,v=null,_=null,P=null,y.set(0,0,0),C=0,p=U,w=ut}return}ye=ye||ue,se=se||ee,Re=Re||pe,(ue!==R||ye!==E)&&(n.blendEquationSeparate(oe[ue],oe[ye]),R=ue,E=ye),(ee!==A||pe!==v||se!==_||Re!==P)&&(n.blendFuncSeparate(Se[ee],Se[pe],Se[se],Se[Re]),A=ee,v=pe,_=se,P=Re),(Ee.equals(y)===!1||_t!==C)&&(n.blendColor(Ee.r,Ee.g,Ee.b,_t),y.copy(Ee),C=_t),p=U,w=!1}function Ue(U,ue){U.side===Ht?we(n.CULL_FACE):Q(n.CULL_FACE);let ee=U.side===Gt;ue&&(ee=!ee),Ke(ee),U.blending===vi&&U.transparent===!1?Le(wn):Le(U.blending,U.blendEquation,U.blendSrc,U.blendDst,U.blendEquationAlpha,U.blendSrcAlpha,U.blendDstAlpha,U.blendColor,U.blendAlpha,U.premultipliedAlpha),a.setFunc(U.depthFunc),a.setTest(U.depthTest),a.setMask(U.depthWrite),r.setMask(U.colorWrite);let pe=U.stencilWrite;o.setTest(pe),pe&&(o.setMask(U.stencilWriteMask),o.setFunc(U.stencilFunc,U.stencilRef,U.stencilFuncMask),o.setOp(U.stencilFail,U.stencilZFail,U.stencilZPass)),Xe(U.polygonOffset,U.polygonOffsetFactor,U.polygonOffsetUnits),U.alphaToCoverage===!0?Q(n.SAMPLE_ALPHA_TO_COVERAGE):we(n.SAMPLE_ALPHA_TO_COVERAGE)}function Ke(U){T!==U&&(U?n.frontFace(n.CW):n.frontFace(n.CCW),T=U)}function Ve(U){U!==Oc?(Q(n.CULL_FACE),U!==D&&(U===sl?n.cullFace(n.BACK):U===Bc?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):we(n.CULL_FACE),D=U}function ke(U){U!==B&&(N&&n.lineWidth(U),B=U)}function Xe(U,ue,ee){U?(Q(n.POLYGON_OFFSET_FILL),(L!==ue||I!==ee)&&(L=ue,I=ee,a.getReversed()&&(ue=-ue),n.polygonOffset(ue,ee))):we(n.POLYGON_OFFSET_FILL)}function He(U){U?Q(n.SCISSOR_TEST):we(n.SCISSOR_TEST)}function rt(U){U===void 0&&(U=n.TEXTURE0+G-1),j!==U&&(n.activeTexture(U),j=U)}function F(U,ue,ee){ee===void 0&&(j===null?ee=n.TEXTURE0+G-1:ee=j);let pe=ne[ee];pe===void 0&&(pe={type:void 0,texture:void 0},ne[ee]=pe),(pe.type!==U||pe.texture!==ue)&&(j!==ee&&(n.activeTexture(ee),j=ee),n.bindTexture(U,ue||ie[U]),pe.type=U,pe.texture=ue)}function at(){let U=ne[j];U!==void 0&&U.type!==void 0&&(n.bindTexture(U.type,null),U.type=void 0,U.texture=void 0)}function We(){try{n.compressedTexImage2D(...arguments)}catch(U){Be("WebGLState:",U)}}function S(){try{n.compressedTexImage3D(...arguments)}catch(U){Be("WebGLState:",U)}}function x(){try{n.texSubImage2D(...arguments)}catch(U){Be("WebGLState:",U)}}function z(){try{n.texSubImage3D(...arguments)}catch(U){Be("WebGLState:",U)}}function W(){try{n.compressedTexSubImage2D(...arguments)}catch(U){Be("WebGLState:",U)}}function Z(){try{n.compressedTexSubImage3D(...arguments)}catch(U){Be("WebGLState:",U)}}function le(){try{n.texStorage2D(...arguments)}catch(U){Be("WebGLState:",U)}}function he(){try{n.texStorage3D(...arguments)}catch(U){Be("WebGLState:",U)}}function K(){try{n.texImage2D(...arguments)}catch(U){Be("WebGLState:",U)}}function te(){try{n.texImage3D(...arguments)}catch(U){Be("WebGLState:",U)}}function de(U){return d[U]!==void 0?d[U]:n.getParameter(U)}function Ce(U,ue){d[U]!==ue&&(n.pixelStorei(U,ue),d[U]=ue)}function me(U){Ne.equals(U)===!1&&(n.scissor(U.x,U.y,U.z,U.w),Ne.copy(U))}function fe(U){re.equals(U)===!1&&(n.viewport(U.x,U.y,U.z,U.w),re.copy(U))}function De(U,ue){let ee=c.get(ue);ee===void 0&&(ee=new WeakMap,c.set(ue,ee));let pe=ee.get(U);pe===void 0&&(pe=n.getUniformBlockIndex(ue,U.name),ee.set(U,pe))}function Oe(U,ue){let pe=c.get(ue).get(U);l.get(ue)!==pe&&(n.uniformBlockBinding(ue,pe,U.__bindingPointIndex),l.set(ue,pe))}function qe(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),a.setReversed(!1),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),n.pixelStorei(n.PACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,n.BROWSER_DEFAULT_WEBGL),n.pixelStorei(n.PACK_ROW_LENGTH,0),n.pixelStorei(n.PACK_SKIP_PIXELS,0),n.pixelStorei(n.PACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_ROW_LENGTH,0),n.pixelStorei(n.UNPACK_IMAGE_HEIGHT,0),n.pixelStorei(n.UNPACK_SKIP_PIXELS,0),n.pixelStorei(n.UNPACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_SKIP_IMAGES,0),u={},d={},j=null,ne={},h={},f=new WeakMap,g=[],M=null,m=!1,p=null,R=null,A=null,v=null,E=null,_=null,P=null,y=new Ze(0,0,0),C=0,w=!1,T=null,D=null,B=null,L=null,I=null,Ne.set(0,0,n.canvas.width,n.canvas.height),re.set(0,0,n.canvas.width,n.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:Q,disable:we,bindFramebuffer:Te,drawBuffers:J,useProgram:ce,setBlending:Le,setMaterial:Ue,setFlipSided:Ke,setCullFace:Ve,setLineWidth:ke,setPolygonOffset:Xe,setScissorTest:He,activeTexture:rt,bindTexture:F,unbindTexture:at,compressedTexImage2D:We,compressedTexImage3D:S,texImage2D:K,texImage3D:te,pixelStorei:Ce,getParameter:de,updateUBOMapping:De,uniformBlockBinding:Oe,texStorage2D:le,texStorage3D:he,texSubImage2D:x,texSubImage3D:z,compressedTexSubImage2D:W,compressedTexSubImage3D:Z,scissor:me,viewport:fe,reset:qe}}function Z0(n,e,t,i,s,r,a){let o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new ze,u=new WeakMap,d=new Set,h,f=new WeakMap,g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function M(S,x){return g?new OffscreenCanvas(S,x):Ps("canvas")}function m(S,x,z){let W=1,Z=We(S);if((Z.width>z||Z.height>z)&&(W=z/Math.max(Z.width,Z.height)),W<1)if(typeof HTMLImageElement<"u"&&S instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&S instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&S instanceof ImageBitmap||typeof VideoFrame<"u"&&S instanceof VideoFrame){let le=Math.floor(W*Z.width),he=Math.floor(W*Z.height);h===void 0&&(h=M(le,he));let K=x?M(le,he):h;return K.width=le,K.height=he,K.getContext("2d").drawImage(S,0,0,le,he),Fe("WebGLRenderer: Texture has been resized from ("+Z.width+"x"+Z.height+") to ("+le+"x"+he+")."),K}else return"data"in S&&Fe("WebGLRenderer: Image in DataTexture is too big ("+Z.width+"x"+Z.height+")."),S;return S}function p(S){return S.generateMipmaps}function R(S){n.generateMipmap(S)}function A(S){return S.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:S.isWebGL3DRenderTarget?n.TEXTURE_3D:S.isWebGLArrayRenderTarget||S.isCompressedArrayTexture?n.TEXTURE_2D_ARRAY:n.TEXTURE_2D}function v(S,x,z,W,Z,le=!1){if(S!==null){if(n[S]!==void 0)return n[S];Fe("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+S+"'")}let he;W&&(he=e.get("EXT_texture_norm16"),he||Fe("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let K=x;if(x===n.RED&&(z===n.FLOAT&&(K=n.R32F),z===n.HALF_FLOAT&&(K=n.R16F),z===n.UNSIGNED_BYTE&&(K=n.R8),z===n.UNSIGNED_SHORT&&he&&(K=he.R16_EXT),z===n.SHORT&&he&&(K=he.R16_SNORM_EXT)),x===n.RED_INTEGER&&(z===n.UNSIGNED_BYTE&&(K=n.R8UI),z===n.UNSIGNED_SHORT&&(K=n.R16UI),z===n.UNSIGNED_INT&&(K=n.R32UI),z===n.BYTE&&(K=n.R8I),z===n.SHORT&&(K=n.R16I),z===n.INT&&(K=n.R32I)),x===n.RG&&(z===n.FLOAT&&(K=n.RG32F),z===n.HALF_FLOAT&&(K=n.RG16F),z===n.UNSIGNED_BYTE&&(K=n.RG8),z===n.UNSIGNED_SHORT&&he&&(K=he.RG16_EXT),z===n.SHORT&&he&&(K=he.RG16_SNORM_EXT)),x===n.RG_INTEGER&&(z===n.UNSIGNED_BYTE&&(K=n.RG8UI),z===n.UNSIGNED_SHORT&&(K=n.RG16UI),z===n.UNSIGNED_INT&&(K=n.RG32UI),z===n.BYTE&&(K=n.RG8I),z===n.SHORT&&(K=n.RG16I),z===n.INT&&(K=n.RG32I)),x===n.RGB_INTEGER&&(z===n.UNSIGNED_BYTE&&(K=n.RGB8UI),z===n.UNSIGNED_SHORT&&(K=n.RGB16UI),z===n.UNSIGNED_INT&&(K=n.RGB32UI),z===n.BYTE&&(K=n.RGB8I),z===n.SHORT&&(K=n.RGB16I),z===n.INT&&(K=n.RGB32I)),x===n.RGBA_INTEGER&&(z===n.UNSIGNED_BYTE&&(K=n.RGBA8UI),z===n.UNSIGNED_SHORT&&(K=n.RGBA16UI),z===n.UNSIGNED_INT&&(K=n.RGBA32UI),z===n.BYTE&&(K=n.RGBA8I),z===n.SHORT&&(K=n.RGBA16I),z===n.INT&&(K=n.RGBA32I)),x===n.RGB&&(z===n.UNSIGNED_SHORT&&he&&(K=he.RGB16_EXT),z===n.SHORT&&he&&(K=he.RGB16_SNORM_EXT),z===n.UNSIGNED_INT_5_9_9_9_REV&&(K=n.RGB9_E5),z===n.UNSIGNED_INT_10F_11F_11F_REV&&(K=n.R11F_G11F_B10F)),x===n.RGBA){let te=le?Cs:Qe.getTransfer(Z);z===n.FLOAT&&(K=n.RGBA32F),z===n.HALF_FLOAT&&(K=n.RGBA16F),z===n.UNSIGNED_BYTE&&(K=te===nt?n.SRGB8_ALPHA8:n.RGBA8),z===n.UNSIGNED_SHORT&&he&&(K=he.RGBA16_EXT),z===n.SHORT&&he&&(K=he.RGBA16_SNORM_EXT),z===n.UNSIGNED_SHORT_4_4_4_4&&(K=n.RGBA4),z===n.UNSIGNED_SHORT_5_5_5_1&&(K=n.RGB5_A1)}return(K===n.R16F||K===n.R32F||K===n.RG16F||K===n.RG32F||K===n.RGBA16F||K===n.RGBA32F)&&e.get("EXT_color_buffer_float"),K}function E(S,x){let z;return S?x===null||x===gn||x===rs?z=n.DEPTH24_STENCIL8:x===_n?z=n.DEPTH32F_STENCIL8:x===ss&&(z=n.DEPTH24_STENCIL8,Fe("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):x===null||x===gn||x===rs?z=n.DEPTH_COMPONENT24:x===_n?z=n.DEPTH_COMPONENT32F:x===ss&&(z=n.DEPTH_COMPONENT16),z}function _(S,x){return p(S)===!0||S.isFramebufferTexture&&S.minFilter!==It&&S.minFilter!==wt?Math.log2(Math.max(x.width,x.height))+1:S.mipmaps!==void 0&&S.mipmaps.length>0?S.mipmaps.length:S.isCompressedTexture&&Array.isArray(S.image)?x.mipmaps.length:1}function P(S){let x=S.target;x.removeEventListener("dispose",P),C(x),x.isVideoTexture&&u.delete(x),x.isHTMLTexture&&d.delete(x)}function y(S){let x=S.target;x.removeEventListener("dispose",y),T(x)}function C(S){let x=i.get(S);if(x.__webglInit===void 0)return;let z=S.source,W=f.get(z);if(W){let Z=W[x.__cacheKey];Z.usedTimes--,Z.usedTimes===0&&w(S),Object.keys(W).length===0&&f.delete(z)}i.remove(S)}function w(S){let x=i.get(S);n.deleteTexture(x.__webglTexture);let z=S.source,W=f.get(z);delete W[x.__cacheKey],a.memory.textures--}function T(S){let x=i.get(S);if(S.depthTexture&&(S.depthTexture.dispose(),i.remove(S.depthTexture)),S.isWebGLCubeRenderTarget)for(let W=0;W<6;W++){if(Array.isArray(x.__webglFramebuffer[W]))for(let Z=0;Z<x.__webglFramebuffer[W].length;Z++)n.deleteFramebuffer(x.__webglFramebuffer[W][Z]);else n.deleteFramebuffer(x.__webglFramebuffer[W]);x.__webglDepthbuffer&&n.deleteRenderbuffer(x.__webglDepthbuffer[W])}else{if(Array.isArray(x.__webglFramebuffer))for(let W=0;W<x.__webglFramebuffer.length;W++)n.deleteFramebuffer(x.__webglFramebuffer[W]);else n.deleteFramebuffer(x.__webglFramebuffer);if(x.__webglDepthbuffer&&n.deleteRenderbuffer(x.__webglDepthbuffer),x.__webglMultisampledFramebuffer&&n.deleteFramebuffer(x.__webglMultisampledFramebuffer),x.__webglColorRenderbuffer)for(let W=0;W<x.__webglColorRenderbuffer.length;W++)x.__webglColorRenderbuffer[W]&&n.deleteRenderbuffer(x.__webglColorRenderbuffer[W]);x.__webglDepthRenderbuffer&&n.deleteRenderbuffer(x.__webglDepthRenderbuffer)}let z=S.textures;for(let W=0,Z=z.length;W<Z;W++){let le=i.get(z[W]);le.__webglTexture&&(n.deleteTexture(le.__webglTexture),a.memory.textures--),i.remove(z[W])}i.remove(S)}let D=0;function B(){D=0}function L(){return D}function I(S){D=S}function G(){let S=D;return S>=s.maxTextures&&Fe("WebGLTextures: Trying to use "+S+" texture units while this GPU supports only "+s.maxTextures),D+=1,S}function N(S){let x=[];return x.push(S.wrapS),x.push(S.wrapT),x.push(S.wrapR||0),x.push(S.magFilter),x.push(S.minFilter),x.push(S.anisotropy),x.push(S.internalFormat),x.push(S.format),x.push(S.type),x.push(S.generateMipmaps),x.push(S.premultiplyAlpha),x.push(S.flipY),x.push(S.unpackAlignment),x.push(S.colorSpace),x.join()}function k(S,x){let z=i.get(S);if(S.isVideoTexture&&F(S),S.isRenderTargetTexture===!1&&S.isExternalTexture!==!0&&S.version>0&&z.__version!==S.version){let W=S.image;if(W===null)Fe("WebGLRenderer: Texture marked for update but no image data found.");else if(W.complete===!1)Fe("WebGLRenderer: Texture marked for update but image is incomplete");else{we(z,S,x);return}}else S.isExternalTexture&&(z.__webglTexture=S.sourceTexture?S.sourceTexture:null);t.bindTexture(n.TEXTURE_2D,z.__webglTexture,n.TEXTURE0+x)}function $(S,x){let z=i.get(S);if(S.isRenderTargetTexture===!1&&S.version>0&&z.__version!==S.version){we(z,S,x);return}else S.isExternalTexture&&(z.__webglTexture=S.sourceTexture?S.sourceTexture:null);t.bindTexture(n.TEXTURE_2D_ARRAY,z.__webglTexture,n.TEXTURE0+x)}function j(S,x){let z=i.get(S);if(S.isRenderTargetTexture===!1&&S.version>0&&z.__version!==S.version){we(z,S,x);return}t.bindTexture(n.TEXTURE_3D,z.__webglTexture,n.TEXTURE0+x)}function ne(S,x){let z=i.get(S);if(S.isCubeDepthTexture!==!0&&S.version>0&&z.__version!==S.version){Te(z,S,x);return}t.bindTexture(n.TEXTURE_CUBE_MAP,z.__webglTexture,n.TEXTURE0+x)}let ae={[Kr]:n.REPEAT,[Mn]:n.CLAMP_TO_EDGE,[Jr]:n.MIRRORED_REPEAT},ve={[It]:n.NEAREST,[ah]:n.NEAREST_MIPMAP_NEAREST,[js]:n.NEAREST_MIPMAP_LINEAR,[wt]:n.LINEAR,[ba]:n.LINEAR_MIPMAP_NEAREST,[ri]:n.LINEAR_MIPMAP_LINEAR},Ne={[ch]:n.NEVER,[ph]:n.ALWAYS,[hh]:n.LESS,[ro]:n.LEQUAL,[uh]:n.EQUAL,[ao]:n.GEQUAL,[dh]:n.GREATER,[fh]:n.NOTEQUAL};function re(S,x){if(x.type===_n&&e.has("OES_texture_float_linear")===!1&&(x.magFilter===wt||x.magFilter===ba||x.magFilter===js||x.magFilter===ri||x.minFilter===wt||x.minFilter===ba||x.minFilter===js||x.minFilter===ri)&&Fe("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(S,n.TEXTURE_WRAP_S,ae[x.wrapS]),n.texParameteri(S,n.TEXTURE_WRAP_T,ae[x.wrapT]),(S===n.TEXTURE_3D||S===n.TEXTURE_2D_ARRAY)&&n.texParameteri(S,n.TEXTURE_WRAP_R,ae[x.wrapR]),n.texParameteri(S,n.TEXTURE_MAG_FILTER,ve[x.magFilter]),n.texParameteri(S,n.TEXTURE_MIN_FILTER,ve[x.minFilter]),x.compareFunction&&(n.texParameteri(S,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(S,n.TEXTURE_COMPARE_FUNC,Ne[x.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(x.magFilter===It||x.minFilter!==js&&x.minFilter!==ri||x.type===_n&&e.has("OES_texture_float_linear")===!1)return;if(x.anisotropy>1||i.get(x).__currentAnisotropy){let z=e.get("EXT_texture_filter_anisotropic");n.texParameterf(S,z.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(x.anisotropy,s.getMaxAnisotropy())),i.get(x).__currentAnisotropy=x.anisotropy}}}function H(S,x){let z=!1;S.__webglInit===void 0&&(S.__webglInit=!0,x.addEventListener("dispose",P));let W=x.source,Z=f.get(W);Z===void 0&&(Z={},f.set(W,Z));let le=N(x);if(le!==S.__cacheKey){Z[le]===void 0&&(Z[le]={texture:n.createTexture(),usedTimes:0},a.memory.textures++,z=!0),Z[le].usedTimes++;let he=Z[S.__cacheKey];he!==void 0&&(Z[S.__cacheKey].usedTimes--,he.usedTimes===0&&w(x)),S.__cacheKey=le,S.__webglTexture=Z[le].texture}return z}function ie(S,x,z){return Math.floor(Math.floor(S/z)/x)}function Q(S,x,z,W){let le=S.updateRanges;if(le.length===0)t.texSubImage2D(n.TEXTURE_2D,0,0,0,x.width,x.height,z,W,x.data);else{le.sort((Ce,me)=>Ce.start-me.start);let he=0;for(let Ce=1;Ce<le.length;Ce++){let me=le[he],fe=le[Ce],De=me.start+me.count,Oe=ie(fe.start,x.width,4),qe=ie(me.start,x.width,4);fe.start<=De+1&&Oe===qe&&ie(fe.start+fe.count-1,x.width,4)===Oe?me.count=Math.max(me.count,fe.start+fe.count-me.start):(++he,le[he]=fe)}le.length=he+1;let K=t.getParameter(n.UNPACK_ROW_LENGTH),te=t.getParameter(n.UNPACK_SKIP_PIXELS),de=t.getParameter(n.UNPACK_SKIP_ROWS);t.pixelStorei(n.UNPACK_ROW_LENGTH,x.width);for(let Ce=0,me=le.length;Ce<me;Ce++){let fe=le[Ce],De=Math.floor(fe.start/4),Oe=Math.ceil(fe.count/4),qe=De%x.width,U=Math.floor(De/x.width),ue=Oe,ee=1;t.pixelStorei(n.UNPACK_SKIP_PIXELS,qe),t.pixelStorei(n.UNPACK_SKIP_ROWS,U),t.texSubImage2D(n.TEXTURE_2D,0,qe,U,ue,ee,z,W,x.data)}S.clearUpdateRanges(),t.pixelStorei(n.UNPACK_ROW_LENGTH,K),t.pixelStorei(n.UNPACK_SKIP_PIXELS,te),t.pixelStorei(n.UNPACK_SKIP_ROWS,de)}}function we(S,x,z){let W=n.TEXTURE_2D;(x.isDataArrayTexture||x.isCompressedArrayTexture)&&(W=n.TEXTURE_2D_ARRAY),x.isData3DTexture&&(W=n.TEXTURE_3D);let Z=H(S,x),le=x.source;t.bindTexture(W,S.__webglTexture,n.TEXTURE0+z);let he=i.get(le);if(le.version!==he.__version||Z===!0){if(t.activeTexture(n.TEXTURE0+z),(typeof ImageBitmap<"u"&&x.image instanceof ImageBitmap)===!1){let ee=Qe.getPrimaries(Qe.workingColorSpace),pe=x.colorSpace===Bn?null:Qe.getPrimaries(x.colorSpace),ye=x.colorSpace===Bn||ee===pe?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,x.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,ye)}t.pixelStorei(n.UNPACK_ALIGNMENT,x.unpackAlignment);let te=m(x.image,!1,s.maxTextureSize);te=at(x,te);let de=r.convert(x.format,x.colorSpace),Ce=r.convert(x.type),me=v(x.internalFormat,de,Ce,x.normalized,x.colorSpace,x.isVideoTexture);re(W,x);let fe,De=x.mipmaps,Oe=x.isVideoTexture!==!0,qe=he.__version===void 0||Z===!0,U=le.dataReady,ue=_(x,te);if(x.isDepthTexture)me=E(x.format===ai,x.type),qe&&(Oe?t.texStorage2D(n.TEXTURE_2D,1,me,te.width,te.height):t.texImage2D(n.TEXTURE_2D,0,me,te.width,te.height,0,de,Ce,null));else if(x.isDataTexture)if(De.length>0){Oe&&qe&&t.texStorage2D(n.TEXTURE_2D,ue,me,De[0].width,De[0].height);for(let ee=0,pe=De.length;ee<pe;ee++)fe=De[ee],Oe?U&&t.texSubImage2D(n.TEXTURE_2D,ee,0,0,fe.width,fe.height,de,Ce,fe.data):t.texImage2D(n.TEXTURE_2D,ee,me,fe.width,fe.height,0,de,Ce,fe.data);x.generateMipmaps=!1}else Oe?(qe&&t.texStorage2D(n.TEXTURE_2D,ue,me,te.width,te.height),U&&Q(x,te,de,Ce)):t.texImage2D(n.TEXTURE_2D,0,me,te.width,te.height,0,de,Ce,te.data);else if(x.isCompressedTexture)if(x.isCompressedArrayTexture){Oe&&qe&&t.texStorage3D(n.TEXTURE_2D_ARRAY,ue,me,De[0].width,De[0].height,te.depth);for(let ee=0,pe=De.length;ee<pe;ee++)if(fe=De[ee],x.format!==on)if(de!==null)if(Oe){if(U)if(x.layerUpdates.size>0){let ye=Il(fe.width,fe.height,x.format,x.type);for(let se of x.layerUpdates){let Re=fe.data.subarray(se*ye/fe.data.BYTES_PER_ELEMENT,(se+1)*ye/fe.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,ee,0,0,se,fe.width,fe.height,1,de,Re)}x.clearLayerUpdates()}else t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,ee,0,0,0,fe.width,fe.height,te.depth,de,fe.data)}else t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,ee,me,fe.width,fe.height,te.depth,0,fe.data,0,0);else Fe("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Oe?U&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,ee,0,0,0,fe.width,fe.height,te.depth,de,Ce,fe.data):t.texImage3D(n.TEXTURE_2D_ARRAY,ee,me,fe.width,fe.height,te.depth,0,de,Ce,fe.data)}else{Oe&&qe&&t.texStorage2D(n.TEXTURE_2D,ue,me,De[0].width,De[0].height);for(let ee=0,pe=De.length;ee<pe;ee++)fe=De[ee],x.format!==on?de!==null?Oe?U&&t.compressedTexSubImage2D(n.TEXTURE_2D,ee,0,0,fe.width,fe.height,de,fe.data):t.compressedTexImage2D(n.TEXTURE_2D,ee,me,fe.width,fe.height,0,fe.data):Fe("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Oe?U&&t.texSubImage2D(n.TEXTURE_2D,ee,0,0,fe.width,fe.height,de,Ce,fe.data):t.texImage2D(n.TEXTURE_2D,ee,me,fe.width,fe.height,0,de,Ce,fe.data)}else if(x.isDataArrayTexture)if(Oe){if(qe&&t.texStorage3D(n.TEXTURE_2D_ARRAY,ue,me,te.width,te.height,te.depth),U)if(x.layerUpdates.size>0){let ee=Il(te.width,te.height,x.format,x.type);for(let pe of x.layerUpdates){let ye=te.data.subarray(pe*ee/te.data.BYTES_PER_ELEMENT,(pe+1)*ee/te.data.BYTES_PER_ELEMENT);t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,pe,te.width,te.height,1,de,Ce,ye)}x.clearLayerUpdates()}else t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,te.width,te.height,te.depth,de,Ce,te.data)}else t.texImage3D(n.TEXTURE_2D_ARRAY,0,me,te.width,te.height,te.depth,0,de,Ce,te.data);else if(x.isData3DTexture)Oe?(qe&&t.texStorage3D(n.TEXTURE_3D,ue,me,te.width,te.height,te.depth),U&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,te.width,te.height,te.depth,de,Ce,te.data)):t.texImage3D(n.TEXTURE_3D,0,me,te.width,te.height,te.depth,0,de,Ce,te.data);else if(x.isFramebufferTexture){if(qe)if(Oe)t.texStorage2D(n.TEXTURE_2D,ue,me,te.width,te.height);else{let ee=te.width,pe=te.height;for(let ye=0;ye<ue;ye++)t.texImage2D(n.TEXTURE_2D,ye,me,ee,pe,0,de,Ce,null),ee>>=1,pe>>=1}}else if(x.isHTMLTexture){if("texElementImage2D"in n){let ee=n.canvas;if(ee.hasAttribute("layoutsubtree")||ee.setAttribute("layoutsubtree","true"),te.parentNode!==ee){ee.appendChild(te),d.add(x),ee.onpaint=pe=>{let ye=pe.changedElements;for(let se of d)ye.includes(se.image)&&(se.needsUpdate=!0)},ee.requestPaint();return}if(n.texElementImage2D.length===3)n.texElementImage2D(n.TEXTURE_2D,n.RGBA8,te);else{let ye=n.RGBA,se=n.RGBA,Re=n.UNSIGNED_BYTE;n.texElementImage2D(n.TEXTURE_2D,0,ye,se,Re,te)}n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE)}}else if(De.length>0){if(Oe&&qe){let ee=We(De[0]);t.texStorage2D(n.TEXTURE_2D,ue,me,ee.width,ee.height)}for(let ee=0,pe=De.length;ee<pe;ee++)fe=De[ee],Oe?U&&t.texSubImage2D(n.TEXTURE_2D,ee,0,0,de,Ce,fe):t.texImage2D(n.TEXTURE_2D,ee,me,de,Ce,fe);x.generateMipmaps=!1}else if(Oe){if(qe){let ee=We(te);t.texStorage2D(n.TEXTURE_2D,ue,me,ee.width,ee.height)}U&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,de,Ce,te)}else t.texImage2D(n.TEXTURE_2D,0,me,de,Ce,te);p(x)&&R(W),he.__version=le.version,x.onUpdate&&x.onUpdate(x)}S.__version=x.version}function Te(S,x,z){if(x.image.length!==6)return;let W=H(S,x),Z=x.source;t.bindTexture(n.TEXTURE_CUBE_MAP,S.__webglTexture,n.TEXTURE0+z);let le=i.get(Z);if(Z.version!==le.__version||W===!0){t.activeTexture(n.TEXTURE0+z);let he=Qe.getPrimaries(Qe.workingColorSpace),K=x.colorSpace===Bn?null:Qe.getPrimaries(x.colorSpace),te=x.colorSpace===Bn||he===K?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,x.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),t.pixelStorei(n.UNPACK_ALIGNMENT,x.unpackAlignment),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,te);let de=x.isCompressedTexture||x.image[0].isCompressedTexture,Ce=x.image[0]&&x.image[0].isDataTexture,me=[];for(let se=0;se<6;se++)!de&&!Ce?me[se]=m(x.image[se],!0,s.maxCubemapSize):me[se]=Ce?x.image[se].image:x.image[se],me[se]=at(x,me[se]);let fe=me[0],De=r.convert(x.format,x.colorSpace),Oe=r.convert(x.type),qe=v(x.internalFormat,De,Oe,x.normalized,x.colorSpace),U=x.isVideoTexture!==!0,ue=le.__version===void 0||W===!0,ee=Z.dataReady,pe=_(x,fe);re(n.TEXTURE_CUBE_MAP,x);let ye;if(de){U&&ue&&t.texStorage2D(n.TEXTURE_CUBE_MAP,pe,qe,fe.width,fe.height);for(let se=0;se<6;se++){ye=me[se].mipmaps;for(let Re=0;Re<ye.length;Re++){let Ee=ye[Re];x.format!==on?De!==null?U?ee&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+se,Re,0,0,Ee.width,Ee.height,De,Ee.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+se,Re,qe,Ee.width,Ee.height,0,Ee.data):Fe("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):U?ee&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+se,Re,0,0,Ee.width,Ee.height,De,Oe,Ee.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+se,Re,qe,Ee.width,Ee.height,0,De,Oe,Ee.data)}}}else{if(ye=x.mipmaps,U&&ue){ye.length>0&&pe++;let se=We(me[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,pe,qe,se.width,se.height)}for(let se=0;se<6;se++)if(Ce){U?ee&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,0,0,me[se].width,me[se].height,De,Oe,me[se].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,qe,me[se].width,me[se].height,0,De,Oe,me[se].data);for(let Re=0;Re<ye.length;Re++){let _t=ye[Re].image[se].image;U?ee&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+se,Re+1,0,0,_t.width,_t.height,De,Oe,_t.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+se,Re+1,qe,_t.width,_t.height,0,De,Oe,_t.data)}}else{U?ee&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,0,0,De,Oe,me[se]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,qe,De,Oe,me[se]);for(let Re=0;Re<ye.length;Re++){let Ee=ye[Re];U?ee&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+se,Re+1,0,0,De,Oe,Ee.image[se]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+se,Re+1,qe,De,Oe,Ee.image[se])}}}p(x)&&R(n.TEXTURE_CUBE_MAP),le.__version=Z.version,x.onUpdate&&x.onUpdate(x)}S.__version=x.version}function J(S,x,z,W,Z,le){let he=r.convert(z.format,z.colorSpace),K=r.convert(z.type),te=v(z.internalFormat,he,K,z.normalized,z.colorSpace),de=i.get(x),Ce=i.get(z);if(Ce.__renderTarget=x,!de.__hasExternalTextures){let me=Math.max(1,x.width>>le),fe=Math.max(1,x.height>>le);Z===n.TEXTURE_3D||Z===n.TEXTURE_2D_ARRAY?t.texImage3D(Z,le,te,me,fe,x.depth,0,he,K,null):t.texImage2D(Z,le,te,me,fe,0,he,K,null)}t.bindFramebuffer(n.FRAMEBUFFER,S),rt(x)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,W,Z,Ce.__webglTexture,0,He(x)):(Z===n.TEXTURE_2D||Z>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&Z<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,W,Z,Ce.__webglTexture,le),t.bindFramebuffer(n.FRAMEBUFFER,null)}function ce(S,x,z){if(n.bindRenderbuffer(n.RENDERBUFFER,S),x.depthBuffer){let W=x.depthTexture,Z=W&&W.isDepthTexture?W.type:null,le=E(x.stencilBuffer,Z),he=x.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;rt(x)?o.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,He(x),le,x.width,x.height):z?n.renderbufferStorageMultisample(n.RENDERBUFFER,He(x),le,x.width,x.height):n.renderbufferStorage(n.RENDERBUFFER,le,x.width,x.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,he,n.RENDERBUFFER,S)}else{let W=x.textures;for(let Z=0;Z<W.length;Z++){let le=W[Z],he=r.convert(le.format,le.colorSpace),K=r.convert(le.type),te=v(le.internalFormat,he,K,le.normalized,le.colorSpace);rt(x)?o.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,He(x),te,x.width,x.height):z?n.renderbufferStorageMultisample(n.RENDERBUFFER,He(x),te,x.width,x.height):n.renderbufferStorage(n.RENDERBUFFER,te,x.width,x.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function oe(S,x,z){let W=x.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(n.FRAMEBUFFER,S),!(x.depthTexture&&x.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let Z=i.get(x.depthTexture);if(Z.__renderTarget=x,(!Z.__webglTexture||x.depthTexture.image.width!==x.width||x.depthTexture.image.height!==x.height)&&(x.depthTexture.image.width=x.width,x.depthTexture.image.height=x.height,x.depthTexture.needsUpdate=!0),W){if(Z.__webglInit===void 0&&(Z.__webglInit=!0,x.depthTexture.addEventListener("dispose",P)),Z.__webglTexture===void 0){Z.__webglTexture=n.createTexture(),t.bindTexture(n.TEXTURE_CUBE_MAP,Z.__webglTexture),re(n.TEXTURE_CUBE_MAP,x.depthTexture);let de=r.convert(x.depthTexture.format),Ce=r.convert(x.depthTexture.type),me;x.depthTexture.format===Sn?me=n.DEPTH_COMPONENT24:x.depthTexture.format===ai&&(me=n.DEPTH24_STENCIL8);for(let fe=0;fe<6;fe++)n.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+fe,0,me,x.width,x.height,0,de,Ce,null)}}else k(x.depthTexture,0);let le=Z.__webglTexture,he=He(x),K=W?n.TEXTURE_CUBE_MAP_POSITIVE_X+z:n.TEXTURE_2D,te=x.depthTexture.format===ai?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;if(x.depthTexture.format===Sn)rt(x)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,te,K,le,0,he):n.framebufferTexture2D(n.FRAMEBUFFER,te,K,le,0);else if(x.depthTexture.format===ai)rt(x)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,te,K,le,0,he):n.framebufferTexture2D(n.FRAMEBUFFER,te,K,le,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function Se(S){let x=i.get(S),z=S.isWebGLCubeRenderTarget===!0;if(x.__boundDepthTexture!==S.depthTexture){let W=S.depthTexture;if(x.__depthDisposeCallback&&x.__depthDisposeCallback(),W){let Z=()=>{delete x.__boundDepthTexture,delete x.__depthDisposeCallback,W.removeEventListener("dispose",Z)};W.addEventListener("dispose",Z),x.__depthDisposeCallback=Z}x.__boundDepthTexture=W}if(S.depthTexture&&!x.__autoAllocateDepthBuffer)if(z)for(let W=0;W<6;W++)oe(x.__webglFramebuffer[W],S,W);else{let W=S.texture.mipmaps;W&&W.length>0?oe(x.__webglFramebuffer[0],S,0):oe(x.__webglFramebuffer,S,0)}else if(z){x.__webglDepthbuffer=[];for(let W=0;W<6;W++)if(t.bindFramebuffer(n.FRAMEBUFFER,x.__webglFramebuffer[W]),x.__webglDepthbuffer[W]===void 0)x.__webglDepthbuffer[W]=n.createRenderbuffer(),ce(x.__webglDepthbuffer[W],S,!1);else{let Z=S.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,le=x.__webglDepthbuffer[W];n.bindRenderbuffer(n.RENDERBUFFER,le),n.framebufferRenderbuffer(n.FRAMEBUFFER,Z,n.RENDERBUFFER,le)}}else{let W=S.texture.mipmaps;if(W&&W.length>0?t.bindFramebuffer(n.FRAMEBUFFER,x.__webglFramebuffer[0]):t.bindFramebuffer(n.FRAMEBUFFER,x.__webglFramebuffer),x.__webglDepthbuffer===void 0)x.__webglDepthbuffer=n.createRenderbuffer(),ce(x.__webglDepthbuffer,S,!1);else{let Z=S.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,le=x.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,le),n.framebufferRenderbuffer(n.FRAMEBUFFER,Z,n.RENDERBUFFER,le)}}t.bindFramebuffer(n.FRAMEBUFFER,null)}function Le(S,x,z){let W=i.get(S);x!==void 0&&J(W.__webglFramebuffer,S,S.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),z!==void 0&&Se(S)}function Ue(S){let x=S.texture,z=i.get(S),W=i.get(x);S.addEventListener("dispose",y);let Z=S.textures,le=S.isWebGLCubeRenderTarget===!0,he=Z.length>1;if(he||(W.__webglTexture===void 0&&(W.__webglTexture=n.createTexture()),W.__version=x.version,a.memory.textures++),le){z.__webglFramebuffer=[];for(let K=0;K<6;K++)if(x.mipmaps&&x.mipmaps.length>0){z.__webglFramebuffer[K]=[];for(let te=0;te<x.mipmaps.length;te++)z.__webglFramebuffer[K][te]=n.createFramebuffer()}else z.__webglFramebuffer[K]=n.createFramebuffer()}else{if(x.mipmaps&&x.mipmaps.length>0){z.__webglFramebuffer=[];for(let K=0;K<x.mipmaps.length;K++)z.__webglFramebuffer[K]=n.createFramebuffer()}else z.__webglFramebuffer=n.createFramebuffer();if(he)for(let K=0,te=Z.length;K<te;K++){let de=i.get(Z[K]);de.__webglTexture===void 0&&(de.__webglTexture=n.createTexture(),a.memory.textures++)}if(S.samples>0&&rt(S)===!1){z.__webglMultisampledFramebuffer=n.createFramebuffer(),z.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,z.__webglMultisampledFramebuffer);for(let K=0;K<Z.length;K++){let te=Z[K];z.__webglColorRenderbuffer[K]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,z.__webglColorRenderbuffer[K]);let de=r.convert(te.format,te.colorSpace),Ce=r.convert(te.type),me=v(te.internalFormat,de,Ce,te.normalized,te.colorSpace,S.isXRRenderTarget===!0),fe=He(S);n.renderbufferStorageMultisample(n.RENDERBUFFER,fe,me,S.width,S.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+K,n.RENDERBUFFER,z.__webglColorRenderbuffer[K])}n.bindRenderbuffer(n.RENDERBUFFER,null),S.depthBuffer&&(z.__webglDepthRenderbuffer=n.createRenderbuffer(),ce(z.__webglDepthRenderbuffer,S,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(le){t.bindTexture(n.TEXTURE_CUBE_MAP,W.__webglTexture),re(n.TEXTURE_CUBE_MAP,x);for(let K=0;K<6;K++)if(x.mipmaps&&x.mipmaps.length>0)for(let te=0;te<x.mipmaps.length;te++)J(z.__webglFramebuffer[K][te],S,x,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+K,te);else J(z.__webglFramebuffer[K],S,x,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+K,0);p(x)&&R(n.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(he){for(let K=0,te=Z.length;K<te;K++){let de=Z[K],Ce=i.get(de),me=n.TEXTURE_2D;(S.isWebGL3DRenderTarget||S.isWebGLArrayRenderTarget)&&(me=S.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(me,Ce.__webglTexture),re(me,de),J(z.__webglFramebuffer,S,de,n.COLOR_ATTACHMENT0+K,me,0),p(de)&&R(me)}t.unbindTexture()}else{let K=n.TEXTURE_2D;if((S.isWebGL3DRenderTarget||S.isWebGLArrayRenderTarget)&&(K=S.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(K,W.__webglTexture),re(K,x),x.mipmaps&&x.mipmaps.length>0)for(let te=0;te<x.mipmaps.length;te++)J(z.__webglFramebuffer[te],S,x,n.COLOR_ATTACHMENT0,K,te);else J(z.__webglFramebuffer,S,x,n.COLOR_ATTACHMENT0,K,0);p(x)&&R(K),t.unbindTexture()}S.depthBuffer&&Se(S)}function Ke(S){let x=S.textures;for(let z=0,W=x.length;z<W;z++){let Z=x[z];if(p(Z)){let le=A(S),he=i.get(Z).__webglTexture;t.bindTexture(le,he),R(le),t.unbindTexture()}}}let Ve=[],ke=[];function Xe(S){if(S.samples>0){if(rt(S)===!1){let x=S.textures,z=S.width,W=S.height,Z=n.COLOR_BUFFER_BIT,le=S.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,he=i.get(S),K=x.length>1;if(K)for(let de=0;de<x.length;de++)t.bindFramebuffer(n.FRAMEBUFFER,he.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+de,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,he.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+de,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,he.__webglMultisampledFramebuffer);let te=S.texture.mipmaps;te&&te.length>0?t.bindFramebuffer(n.DRAW_FRAMEBUFFER,he.__webglFramebuffer[0]):t.bindFramebuffer(n.DRAW_FRAMEBUFFER,he.__webglFramebuffer);for(let de=0;de<x.length;de++){if(S.resolveDepthBuffer&&(S.depthBuffer&&(Z|=n.DEPTH_BUFFER_BIT),S.stencilBuffer&&S.resolveStencilBuffer&&(Z|=n.STENCIL_BUFFER_BIT)),K){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,he.__webglColorRenderbuffer[de]);let Ce=i.get(x[de]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,Ce,0)}n.blitFramebuffer(0,0,z,W,0,0,z,W,Z,n.NEAREST),l===!0&&(Ve.length=0,ke.length=0,Ve.push(n.COLOR_ATTACHMENT0+de),S.depthBuffer&&S.resolveDepthBuffer===!1&&(Ve.push(le),ke.push(le),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,ke)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,Ve))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),K)for(let de=0;de<x.length;de++){t.bindFramebuffer(n.FRAMEBUFFER,he.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+de,n.RENDERBUFFER,he.__webglColorRenderbuffer[de]);let Ce=i.get(x[de]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,he.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+de,n.TEXTURE_2D,Ce,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,he.__webglMultisampledFramebuffer)}else if(S.depthBuffer&&S.resolveDepthBuffer===!1&&l){let x=S.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[x])}}}function He(S){return Math.min(s.maxSamples,S.samples)}function rt(S){let x=i.get(S);return S.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&x.__useRenderToTexture!==!1}function F(S){let x=a.render.frame;u.get(S)!==x&&(u.set(S,x),S.update())}function at(S,x){let z=S.colorSpace,W=S.format,Z=S.type;return S.isCompressedTexture===!0||S.isVideoTexture===!0||z!==Rs&&z!==Bn&&(Qe.getTransfer(z)===nt?(W!==on||Z!==qt)&&Fe("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Be("WebGLTextures: Unsupported texture color space:",z)),x}function We(S){return typeof HTMLImageElement<"u"&&S instanceof HTMLImageElement?(c.width=S.naturalWidth||S.width,c.height=S.naturalHeight||S.height):typeof VideoFrame<"u"&&S instanceof VideoFrame?(c.width=S.displayWidth,c.height=S.displayHeight):(c.width=S.width,c.height=S.height),c}this.allocateTextureUnit=G,this.resetTextureUnits=B,this.getTextureUnits=L,this.setTextureUnits=I,this.setTexture2D=k,this.setTexture2DArray=$,this.setTexture3D=j,this.setTextureCube=ne,this.rebindTextures=Le,this.setupRenderTarget=Ue,this.updateRenderTargetMipmap=Ke,this.updateMultisampleRenderTarget=Xe,this.setupDepthRenderbuffer=Se,this.setupFrameBufferTexture=J,this.useMultisampledRTT=rt,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function $0(n,e){function t(i,s=Bn){let r,a=Qe.getTransfer(s);if(i===qt)return n.UNSIGNED_BYTE;if(i===Sa)return n.UNSIGNED_SHORT_4_4_4_4;if(i===wa)return n.UNSIGNED_SHORT_5_5_5_1;if(i===yl)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===vl)return n.UNSIGNED_INT_10F_11F_11F_REV;if(i===_l)return n.BYTE;if(i===xl)return n.SHORT;if(i===ss)return n.UNSIGNED_SHORT;if(i===Ma)return n.INT;if(i===gn)return n.UNSIGNED_INT;if(i===_n)return n.FLOAT;if(i===Tn)return n.HALF_FLOAT;if(i===bl)return n.ALPHA;if(i===Ml)return n.RGB;if(i===on)return n.RGBA;if(i===Sn)return n.DEPTH_COMPONENT;if(i===ai)return n.DEPTH_STENCIL;if(i===Sl)return n.RED;if(i===Ta)return n.RED_INTEGER;if(i===oi)return n.RG;if(i===Ea)return n.RG_INTEGER;if(i===Aa)return n.RGBA_INTEGER;if(i===Qs||i===er||i===tr||i===nr)if(a===nt)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(i===Qs)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===er)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===tr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===nr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(i===Qs)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===er)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===tr)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===nr)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Ra||i===Ca||i===Pa||i===Ia)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(i===Ra)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Ca)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===Pa)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===Ia)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===Da||i===La||i===Fa||i===Na||i===Ua||i===ir||i===Oa)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(i===Da||i===La)return a===nt?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(i===Fa)return a===nt?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(i===Na)return r.COMPRESSED_R11_EAC;if(i===Ua)return r.COMPRESSED_SIGNED_R11_EAC;if(i===ir)return r.COMPRESSED_RG11_EAC;if(i===Oa)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===Ba||i===za||i===ka||i===Va||i===Ga||i===Ha||i===Wa||i===Xa||i===qa||i===Ya||i===Za||i===$a||i===Ka||i===Ja)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(i===Ba)return a===nt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===za)return a===nt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===ka)return a===nt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Va)return a===nt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Ga)return a===nt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Ha)return a===nt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Wa)return a===nt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Xa)return a===nt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===qa)return a===nt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Ya)return a===nt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Za)return a===nt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===$a)return a===nt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Ka)return a===nt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Ja)return a===nt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===ja||i===Qa||i===eo)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(i===ja)return a===nt?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===Qa)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===eo)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===to||i===no||i===sr||i===io)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(i===to)return r.COMPRESSED_RED_RGTC1_EXT;if(i===no)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===sr)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===io)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===rs?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:t}}var K0=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,J0=`
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

}`,Xl=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let i=new zs(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=i}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,i=new en({vertexShader:K0,fragmentShader:J0,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Tt(new On(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},ql=class extends pn{constructor(e,t){super();let i=this,s=null,r=1,a=null,o="local-floor",l=1,c=null,u=null,d=null,h=null,f=null,g=null,M=typeof XRWebGLBinding<"u",m=new Xl,p={},R=t.getContextAttributes(),A=null,v=null,E=[],_=[],P=new ze,y=null,C=new Ot;C.viewport=new mt;let w=new Ot;w.viewport=new mt;let T=[C,w],D=new xa,B=null,L=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(H){let ie=E[H];return ie===void 0&&(ie=new Zi,E[H]=ie),ie.getTargetRaySpace()},this.getControllerGrip=function(H){let ie=E[H];return ie===void 0&&(ie=new Zi,E[H]=ie),ie.getGripSpace()},this.getHand=function(H){let ie=E[H];return ie===void 0&&(ie=new Zi,E[H]=ie),ie.getHandSpace()};function I(H){let ie=_.indexOf(H.inputSource);if(ie===-1)return;let Q=E[ie];Q!==void 0&&(Q.update(H.inputSource,H.frame,c||a),Q.dispatchEvent({type:H.type,data:H.inputSource}))}function G(){s.removeEventListener("select",I),s.removeEventListener("selectstart",I),s.removeEventListener("selectend",I),s.removeEventListener("squeeze",I),s.removeEventListener("squeezestart",I),s.removeEventListener("squeezeend",I),s.removeEventListener("end",G),s.removeEventListener("inputsourceschange",N);for(let H=0;H<E.length;H++){let ie=_[H];ie!==null&&(_[H]=null,E[H].disconnect(ie))}B=null,L=null,m.reset();for(let H in p)delete p[H];e.setRenderTarget(A),f=null,h=null,d=null,s=null,v=null,re.stop(),i.isPresenting=!1,e.setPixelRatio(y),e.setSize(P.width,P.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(H){r=H,i.isPresenting===!0&&Fe("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(H){o=H,i.isPresenting===!0&&Fe("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(H){c=H},this.getBaseLayer=function(){return h!==null?h:f},this.getBinding=function(){return d===null&&M&&(d=new XRWebGLBinding(s,t)),d},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function(H){if(s=H,s!==null){if(A=e.getRenderTarget(),s.addEventListener("select",I),s.addEventListener("selectstart",I),s.addEventListener("selectend",I),s.addEventListener("squeeze",I),s.addEventListener("squeezestart",I),s.addEventListener("squeezeend",I),s.addEventListener("end",G),s.addEventListener("inputsourceschange",N),R.xrCompatible!==!0&&await t.makeXRCompatible(),y=e.getPixelRatio(),e.getSize(P),M&&"createProjectionLayer"in XRWebGLBinding.prototype){let Q=null,we=null,Te=null;R.depth&&(Te=R.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,Q=R.stencil?ai:Sn,we=R.stencil?rs:gn);let J={colorFormat:t.RGBA8,depthFormat:Te,scaleFactor:r};d=this.getBinding(),h=d.createProjectionLayer(J),s.updateRenderState({layers:[h]}),e.setPixelRatio(1),e.setSize(h.textureWidth,h.textureHeight,!1),v=new Qt(h.textureWidth,h.textureHeight,{format:on,type:qt,depthTexture:new Un(h.textureWidth,h.textureHeight,we,void 0,void 0,void 0,void 0,void 0,void 0,Q),stencilBuffer:R.stencil,colorSpace:e.outputColorSpace,samples:R.antialias?4:0,resolveDepthBuffer:h.ignoreDepthValues===!1,resolveStencilBuffer:h.ignoreDepthValues===!1})}else{let Q={antialias:R.antialias,alpha:!0,depth:R.depth,stencil:R.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(s,t,Q),s.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),v=new Qt(f.framebufferWidth,f.framebufferHeight,{format:on,type:qt,colorSpace:e.outputColorSpace,stencilBuffer:R.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}v.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),re.setContext(s),re.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function N(H){for(let ie=0;ie<H.removed.length;ie++){let Q=H.removed[ie],we=_.indexOf(Q);we>=0&&(_[we]=null,E[we].disconnect(Q))}for(let ie=0;ie<H.added.length;ie++){let Q=H.added[ie],we=_.indexOf(Q);if(we===-1){for(let J=0;J<E.length;J++)if(J>=_.length){_.push(Q),we=J;break}else if(_[J]===null){_[J]=Q,we=J;break}if(we===-1)break}let Te=E[we];Te&&Te.connect(Q)}}let k=new V,$=new V;function j(H,ie,Q){k.setFromMatrixPosition(ie.matrixWorld),$.setFromMatrixPosition(Q.matrixWorld);let we=k.distanceTo($),Te=ie.projectionMatrix.elements,J=Q.projectionMatrix.elements,ce=Te[14]/(Te[10]-1),oe=Te[14]/(Te[10]+1),Se=(Te[9]+1)/Te[5],Le=(Te[9]-1)/Te[5],Ue=(Te[8]-1)/Te[0],Ke=(J[8]+1)/J[0],Ve=ce*Ue,ke=ce*Ke,Xe=we/(-Ue+Ke),He=Xe*-Ue;if(ie.matrixWorld.decompose(H.position,H.quaternion,H.scale),H.translateX(He),H.translateZ(Xe),H.matrixWorld.compose(H.position,H.quaternion,H.scale),H.matrixWorldInverse.copy(H.matrixWorld).invert(),Te[10]===-1)H.projectionMatrix.copy(ie.projectionMatrix),H.projectionMatrixInverse.copy(ie.projectionMatrixInverse);else{let rt=ce+Xe,F=oe+Xe,at=Ve-He,We=ke+(we-He),S=Se*oe/F*rt,x=Le*oe/F*rt;H.projectionMatrix.makePerspective(at,We,S,x,rt,F),H.projectionMatrixInverse.copy(H.projectionMatrix).invert()}}function ne(H,ie){ie===null?H.matrixWorld.copy(H.matrix):H.matrixWorld.multiplyMatrices(ie.matrixWorld,H.matrix),H.matrixWorldInverse.copy(H.matrixWorld).invert()}this.updateCamera=function(H){if(s===null)return;let ie=H.near,Q=H.far;m.texture!==null&&(m.depthNear>0&&(ie=m.depthNear),m.depthFar>0&&(Q=m.depthFar)),D.near=w.near=C.near=ie,D.far=w.far=C.far=Q,(B!==D.near||L!==D.far)&&(s.updateRenderState({depthNear:D.near,depthFar:D.far}),B=D.near,L=D.far),D.layers.mask=H.layers.mask|6,C.layers.mask=D.layers.mask&-5,w.layers.mask=D.layers.mask&-3;let we=H.parent,Te=D.cameras;ne(D,we);for(let J=0;J<Te.length;J++)ne(Te[J],we);Te.length===2?j(D,C,w):D.projectionMatrix.copy(C.projectionMatrix),ae(H,D,we)};function ae(H,ie,Q){Q===null?H.matrix.copy(ie.matrixWorld):(H.matrix.copy(Q.matrixWorld),H.matrix.invert(),H.matrix.multiply(ie.matrixWorld)),H.matrix.decompose(H.position,H.quaternion,H.scale),H.updateMatrixWorld(!0),H.projectionMatrix.copy(ie.projectionMatrix),H.projectionMatrixInverse.copy(ie.projectionMatrixInverse),H.isPerspectiveCamera&&(H.fov=qi*2*Math.atan(1/H.projectionMatrix.elements[5]),H.zoom=1)}this.getCamera=function(){return D},this.getFoveation=function(){if(!(h===null&&f===null))return l},this.setFoveation=function(H){l=H,h!==null&&(h.fixedFoveation=H),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=H)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(D)},this.getCameraTexture=function(H){return p[H]};let ve=null;function Ne(H,ie){if(u=ie.getViewerPose(c||a),g=ie,u!==null){let Q=u.views;f!==null&&(e.setRenderTargetFramebuffer(v,f.framebuffer),e.setRenderTarget(v));let we=!1;Q.length!==D.cameras.length&&(D.cameras.length=0,we=!0);for(let oe=0;oe<Q.length;oe++){let Se=Q[oe],Le=null;if(f!==null)Le=f.getViewport(Se);else{let Ke=d.getViewSubImage(h,Se);Le=Ke.viewport,oe===0&&(e.setRenderTargetTextures(v,Ke.colorTexture,Ke.depthStencilTexture),e.setRenderTarget(v))}let Ue=T[oe];Ue===void 0&&(Ue=new Ot,Ue.layers.enable(oe),Ue.viewport=new mt,T[oe]=Ue),Ue.matrix.fromArray(Se.transform.matrix),Ue.matrix.decompose(Ue.position,Ue.quaternion,Ue.scale),Ue.projectionMatrix.fromArray(Se.projectionMatrix),Ue.projectionMatrixInverse.copy(Ue.projectionMatrix).invert(),Ue.viewport.set(Le.x,Le.y,Le.width,Le.height),oe===0&&(D.matrix.copy(Ue.matrix),D.matrix.decompose(D.position,D.quaternion,D.scale)),we===!0&&D.cameras.push(Ue)}let Te=s.enabledFeatures;if(Te&&Te.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&M){d=i.getBinding();let oe=d.getDepthInformation(Q[0]);oe&&oe.isValid&&oe.texture&&m.init(oe,s.renderState)}if(Te&&Te.includes("camera-access")&&M){e.state.unbindTexture(),d=i.getBinding();for(let oe=0;oe<Q.length;oe++){let Se=Q[oe].camera;if(Se){let Le=p[Se];Le||(Le=new zs,p[Se]=Le);let Ue=d.getCameraImage(Se);Le.sourceTexture=Ue}}}}for(let Q=0;Q<E.length;Q++){let we=_[Q],Te=E[Q];we!==null&&Te!==void 0&&Te.update(we,ie,c||a)}ve&&ve(H,ie),ie.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:ie}),g=null}let re=new Zh;re.setAnimationLoop(Ne),this.setAnimationLoop=function(H){ve=H},this.dispose=function(){}}},j0=new pt,eu=new Ge;eu.set(-1,0,0,0,1,0,0,0,1);function Q0(n,e){function t(m,p){m.matrixAutoUpdate===!0&&m.updateMatrix(),p.value.copy(m.matrix)}function i(m,p){p.color.getRGB(m.fogColor.value,Rl(n)),p.isFog?(m.fogNear.value=p.near,m.fogFar.value=p.far):p.isFogExp2&&(m.fogDensity.value=p.density)}function s(m,p,R,A,v){p.isNodeMaterial?p.uniformsNeedUpdate=!1:p.isMeshBasicMaterial?r(m,p):p.isMeshLambertMaterial?(r(m,p),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)):p.isMeshToonMaterial?(r(m,p),d(m,p)):p.isMeshPhongMaterial?(r(m,p),u(m,p),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)):p.isMeshStandardMaterial?(r(m,p),h(m,p),p.isMeshPhysicalMaterial&&f(m,p,v)):p.isMeshMatcapMaterial?(r(m,p),g(m,p)):p.isMeshDepthMaterial?r(m,p):p.isMeshDistanceMaterial?(r(m,p),M(m,p)):p.isMeshNormalMaterial?r(m,p):p.isLineBasicMaterial?(a(m,p),p.isLineDashedMaterial&&o(m,p)):p.isPointsMaterial?l(m,p,R,A):p.isSpriteMaterial?c(m,p):p.isShadowMaterial?(m.color.value.copy(p.color),m.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function r(m,p){m.opacity.value=p.opacity,p.color&&m.diffuse.value.copy(p.color),p.emissive&&m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(m.map.value=p.map,t(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.bumpMap&&(m.bumpMap.value=p.bumpMap,t(p.bumpMap,m.bumpMapTransform),m.bumpScale.value=p.bumpScale,p.side===Gt&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,t(p.normalMap,m.normalMapTransform),m.normalScale.value.copy(p.normalScale),p.side===Gt&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,t(p.displacementMap,m.displacementMapTransform),m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap,t(p.emissiveMap,m.emissiveMapTransform)),p.specularMap&&(m.specularMap.value=p.specularMap,t(p.specularMap,m.specularMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest);let R=e.get(p),A=R.envMap,v=R.envMapRotation;A&&(m.envMap.value=A,m.envMapRotation.value.setFromMatrix4(j0.makeRotationFromEuler(v)).transpose(),A.isCubeTexture&&A.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(eu),m.reflectivity.value=p.reflectivity,m.ior.value=p.ior,m.refractionRatio.value=p.refractionRatio),p.lightMap&&(m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity,t(p.lightMap,m.lightMapTransform)),p.aoMap&&(m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity,t(p.aoMap,m.aoMapTransform))}function a(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,p.map&&(m.map.value=p.map,t(p.map,m.mapTransform))}function o(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function l(m,p,R,A){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*R,m.scale.value=A*.5,p.map&&(m.map.value=p.map,t(p.map,m.uvTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function c(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map&&(m.map.value=p.map,t(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function u(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,1e-4)}function d(m,p){p.gradientMap&&(m.gradientMap.value=p.gradientMap)}function h(m,p){m.metalness.value=p.metalness,p.metalnessMap&&(m.metalnessMap.value=p.metalnessMap,t(p.metalnessMap,m.metalnessMapTransform)),m.roughness.value=p.roughness,p.roughnessMap&&(m.roughnessMap.value=p.roughnessMap,t(p.roughnessMap,m.roughnessMapTransform)),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)}function f(m,p,R){m.ior.value=p.ior,p.sheen>0&&(m.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),m.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(m.sheenColorMap.value=p.sheenColorMap,t(p.sheenColorMap,m.sheenColorMapTransform)),p.sheenRoughnessMap&&(m.sheenRoughnessMap.value=p.sheenRoughnessMap,t(p.sheenRoughnessMap,m.sheenRoughnessMapTransform))),p.clearcoat>0&&(m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(m.clearcoatMap.value=p.clearcoatMap,t(p.clearcoatMap,m.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,t(p.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(m.clearcoatNormalMap.value=p.clearcoatNormalMap,t(p.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===Gt&&m.clearcoatNormalScale.value.negate())),p.dispersion>0&&(m.dispersion.value=p.dispersion),p.iridescence>0&&(m.iridescence.value=p.iridescence,m.iridescenceIOR.value=p.iridescenceIOR,m.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(m.iridescenceMap.value=p.iridescenceMap,t(p.iridescenceMap,m.iridescenceMapTransform)),p.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=p.iridescenceThicknessMap,t(p.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),p.transmission>0&&(m.transmission.value=p.transmission,m.transmissionSamplerMap.value=R.texture,m.transmissionSamplerSize.value.set(R.width,R.height),p.transmissionMap&&(m.transmissionMap.value=p.transmissionMap,t(p.transmissionMap,m.transmissionMapTransform)),m.thickness.value=p.thickness,p.thicknessMap&&(m.thicknessMap.value=p.thicknessMap,t(p.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=p.attenuationDistance,m.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(m.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(m.anisotropyMap.value=p.anisotropyMap,t(p.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=p.specularIntensity,m.specularColor.value.copy(p.specularColor),p.specularColorMap&&(m.specularColorMap.value=p.specularColorMap,t(p.specularColorMap,m.specularColorMapTransform)),p.specularIntensityMap&&(m.specularIntensityMap.value=p.specularIntensityMap,t(p.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,p){p.matcap&&(m.matcap.value=p.matcap)}function M(m,p){let R=e.get(p).light;m.referencePosition.value.setFromMatrixPosition(R.matrixWorld),m.nearDistance.value=R.shadow.camera.near,m.farDistance.value=R.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:s}}function e_(n,e,t,i){let s={},r={},a=[],o=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function l(v,E){let _=E.program;i.uniformBlockBinding(v,_)}function c(v,E){let _=s[v.id];_===void 0&&(m(v),_=u(v),s[v.id]=_,v.addEventListener("dispose",R));let P=E.program;i.updateUBOMapping(v,P);let y=e.render.frame;r[v.id]!==y&&(h(v),r[v.id]=y)}function u(v){let E=d();v.__bindingPointIndex=E;let _=n.createBuffer(),P=v.__size,y=v.usage;return n.bindBuffer(n.UNIFORM_BUFFER,_),n.bufferData(n.UNIFORM_BUFFER,P,y),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,E,_),_}function d(){for(let v=0;v<o;v++)if(a.indexOf(v)===-1)return a.push(v),v;return Be("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function h(v){let E=s[v.id],_=v.uniforms,P=v.__cache;n.bindBuffer(n.UNIFORM_BUFFER,E);for(let y=0,C=_.length;y<C;y++){let w=_[y];if(Array.isArray(w))for(let T=0,D=w.length;T<D;T++)f(w[T],y,T,P);else f(w,y,0,P)}n.bindBuffer(n.UNIFORM_BUFFER,null)}function f(v,E,_,P){if(M(v,E,_,P)===!0){let y=v.__offset,C=v.value;if(Array.isArray(C)){let w=0;for(let T=0;T<C.length;T++){let D=C[T],B=p(D);g(D,v.__data,w),typeof D!="number"&&typeof D!="boolean"&&!D.isMatrix3&&!ArrayBuffer.isView(D)&&(w+=B.storage/Float32Array.BYTES_PER_ELEMENT)}}else g(C,v.__data,0);n.bufferSubData(n.UNIFORM_BUFFER,y,v.__data)}}function g(v,E,_){typeof v=="number"||typeof v=="boolean"?E[0]=v:v.isMatrix3?(E[0]=v.elements[0],E[1]=v.elements[1],E[2]=v.elements[2],E[3]=0,E[4]=v.elements[3],E[5]=v.elements[4],E[6]=v.elements[5],E[7]=0,E[8]=v.elements[6],E[9]=v.elements[7],E[10]=v.elements[8],E[11]=0):ArrayBuffer.isView(v)?E.set(new v.constructor(v.buffer,v.byteOffset,E.length)):v.toArray(E,_)}function M(v,E,_,P){let y=v.value,C=E+"_"+_;if(P[C]===void 0)return typeof y=="number"||typeof y=="boolean"?P[C]=y:ArrayBuffer.isView(y)?P[C]=y.slice():P[C]=y.clone(),!0;{let w=P[C];if(typeof y=="number"||typeof y=="boolean"){if(w!==y)return P[C]=y,!0}else{if(ArrayBuffer.isView(y))return!0;if(w.equals(y)===!1)return w.copy(y),!0}}return!1}function m(v){let E=v.uniforms,_=0,P=16;for(let C=0,w=E.length;C<w;C++){let T=Array.isArray(E[C])?E[C]:[E[C]];for(let D=0,B=T.length;D<B;D++){let L=T[D],I=Array.isArray(L.value)?L.value:[L.value];for(let G=0,N=I.length;G<N;G++){let k=I[G],$=p(k),j=_%P,ne=j%$.boundary,ae=j+ne;_+=ne,ae!==0&&P-ae<$.storage&&(_+=P-ae),L.__data=new Float32Array($.storage/Float32Array.BYTES_PER_ELEMENT),L.__offset=_,_+=$.storage}}}let y=_%P;return y>0&&(_+=P-y),v.__size=_,v.__cache={},this}function p(v){let E={boundary:0,storage:0};return typeof v=="number"||typeof v=="boolean"?(E.boundary=4,E.storage=4):v.isVector2?(E.boundary=8,E.storage=8):v.isVector3||v.isColor?(E.boundary=16,E.storage=12):v.isVector4?(E.boundary=16,E.storage=16):v.isMatrix3?(E.boundary=48,E.storage=48):v.isMatrix4?(E.boundary=64,E.storage=64):v.isTexture?Fe("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(v)?(E.boundary=16,E.storage=v.byteLength):Fe("WebGLRenderer: Unsupported uniform value type.",v),E}function R(v){let E=v.target;E.removeEventListener("dispose",R);let _=a.indexOf(E.__bindingPointIndex);a.splice(_,1),n.deleteBuffer(s[E.id]),delete s[E.id],delete r[E.id]}function A(){for(let v in s)n.deleteBuffer(s[v]);a=[],s={},r={}}return{bind:l,update:c,dispose:A}}var t_=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),En=null;function n_(){return En===null&&(En=new na(t_,16,16,oi,Tn),En.name="DFG_LUT",En.minFilter=wt,En.magFilter=wt,En.wrapS=Mn,En.wrapT=Mn,En.generateMipmaps=!1,En.needsUpdate=!0),En}var uo=class{constructor(e={}){let{canvas:t=mh(),context:i=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:d=!1,reversedDepthBuffer:h=!1,outputBufferType:f=qt}=e;this.isWebGLRenderer=!0;let g;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=i.getContextAttributes().alpha}else g=a;let M=f,m=new Set([Aa,Ea,Ta]),p=new Set([qt,gn,ss,rs,Sa,wa]),R=new Uint32Array(4),A=new Int32Array(4),v=new V,E=null,_=null,P=[],y=[],C=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=mn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let w=this,T=!1,D=null,B=null,L=null,I=null;this._outputColorSpace=Pt;let G=0,N=0,k=null,$=-1,j=null,ne=new mt,ae=new mt,ve=null,Ne=new Ze(0),re=0,H=t.width,ie=t.height,Q=1,we=null,Te=null,J=new mt(0,0,H,ie),ce=new mt(0,0,H,ie),oe=!1,Se=new Ji,Le=!1,Ue=!1,Ke=new pt,Ve=new V,ke=new mt,Xe={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},He=!1;function rt(){return k===null?Q:1}let F=i;function at(b,O){return t.getContext(b,O)}try{let b={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:u,failIfMajorPerformanceCaveat:d};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"185"}`),t.addEventListener("webglcontextlost",_t,!1),t.addEventListener("webglcontextrestored",ut,!1),t.addEventListener("webglcontextcreationerror",xn,!1),F===null){let O="webgl2";if(F=at(O,b),F===null)throw at(O)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(b){throw Be("WebGLRenderer: "+b.message),b}let We,S,x,z,W,Z,le,he,K,te,de,Ce,me,fe,De,Oe,qe,U,ue,ee,pe,ye,se;function Re(){We=new cg(F),We.init(),pe=new $0(F,We),S=new tg(F,We,e,pe),x=new Y0(F,We),S.reversedDepthBuffer&&h&&x.buffers.depth.setReversed(!0),B=F.createFramebuffer(),L=F.createFramebuffer(),I=F.createFramebuffer(),z=new dg(F),W=new L0,Z=new Z0(F,We,x,W,S,pe,z),le=new lg(w),he=new gf(F),ye=new Qm(F,he),K=new hg(F,he,z,ye),te=new pg(F,K,he,ye,z),U=new fg(F,S,Z),De=new ng(W),de=new D0(w,le,We,S,ye,De),Ce=new Q0(w,W),me=new N0,fe=new V0(We),qe=new jm(w,le,x,te,g,l),Oe=new q0(w,te,S),se=new e_(F,z,S,x),ue=new eg(F,We,z),ee=new ug(F,We,z),z.programs=de.programs,w.capabilities=S,w.extensions=We,w.properties=W,w.renderLists=me,w.shadowMap=Oe,w.state=x,w.info=z}Re(),M!==qt&&(C=new gg(M,t.width,t.height,o,s,r));let Ee=new ql(w,F);this.xr=Ee,this.getContext=function(){return F},this.getContextAttributes=function(){return F.getContextAttributes()},this.forceContextLoss=function(){let b=We.get("WEBGL_lose_context");b&&b.loseContext()},this.forceContextRestore=function(){let b=We.get("WEBGL_lose_context");b&&b.restoreContext()},this.getPixelRatio=function(){return Q},this.setPixelRatio=function(b){b!==void 0&&(Q=b,this.setSize(H,ie,!1))},this.getSize=function(b){return b.set(H,ie)},this.setSize=function(b,O,Y=!0){if(Ee.isPresenting){Fe("WebGLRenderer: Can't change size while VR device is presenting.");return}H=b,ie=O,t.width=Math.floor(b*Q),t.height=Math.floor(O*Q),Y===!0&&(t.style.width=b+"px",t.style.height=O+"px"),C!==null&&C.setSize(t.width,t.height),this.setViewport(0,0,b,O)},this.getDrawingBufferSize=function(b){return b.set(H*Q,ie*Q).floor()},this.setDrawingBufferSize=function(b,O,Y){H=b,ie=O,Q=Y,t.width=Math.floor(b*Y),t.height=Math.floor(O*Y),this.setViewport(0,0,b,O)},this.setEffects=function(b){if(M===qt){Be("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(b){for(let O=0;O<b.length;O++)if(b[O].isOutputPass===!0){Fe("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}C.setEffects(b||[])},this.getCurrentViewport=function(b){return b.copy(ne)},this.getViewport=function(b){return b.copy(J)},this.setViewport=function(b,O,Y,X){b.isVector4?J.set(b.x,b.y,b.z,b.w):J.set(b,O,Y,X),x.viewport(ne.copy(J).multiplyScalar(Q).round())},this.getScissor=function(b){return b.copy(ce)},this.setScissor=function(b,O,Y,X){b.isVector4?ce.set(b.x,b.y,b.z,b.w):ce.set(b,O,Y,X),x.scissor(ae.copy(ce).multiplyScalar(Q).round())},this.getScissorTest=function(){return oe},this.setScissorTest=function(b){x.setScissorTest(oe=b)},this.setOpaqueSort=function(b){we=b},this.setTransparentSort=function(b){Te=b},this.getClearColor=function(b){return b.copy(qe.getClearColor())},this.setClearColor=function(){qe.setClearColor(...arguments)},this.getClearAlpha=function(){return qe.getClearAlpha()},this.setClearAlpha=function(){qe.setClearAlpha(...arguments)},this.clear=function(b=!0,O=!0,Y=!0){let X=0;if(b){let q=!1;if(k!==null){let xe=k.texture.format;q=m.has(xe)}if(q){let xe=k.texture.type,Me=p.has(xe),_e=qe.getClearColor(),Ae=qe.getClearAlpha(),Pe=_e.r,Ye=_e.g,Je=_e.b;Me?(R[0]=Pe,R[1]=Ye,R[2]=Je,R[3]=Ae,F.clearBufferuiv(F.COLOR,0,R)):(A[0]=Pe,A[1]=Ye,A[2]=Je,A[3]=Ae,F.clearBufferiv(F.COLOR,0,A))}else X|=F.COLOR_BUFFER_BIT}O&&(X|=F.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),Y&&(X|=F.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),X!==0&&F.clear(X)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(b){b.setRenderer(this),D=b},this.dispose=function(){t.removeEventListener("webglcontextlost",_t,!1),t.removeEventListener("webglcontextrestored",ut,!1),t.removeEventListener("webglcontextcreationerror",xn,!1),qe.dispose(),me.dispose(),fe.dispose(),W.dispose(),le.dispose(),te.dispose(),ye.dispose(),se.dispose(),de.dispose(),Ee.dispose(),Ee.removeEventListener("sessionstart",rc),Ee.removeEventListener("sessionend",ac),fi.stop()};function _t(b){b.preventDefault(),Tl("WebGLRenderer: Context Lost."),T=!0}function ut(){Tl("WebGLRenderer: Context Restored."),T=!1;let b=z.autoReset,O=Oe.enabled,Y=Oe.autoUpdate,X=Oe.needsUpdate,q=Oe.type;Re(),z.autoReset=b,Oe.enabled=O,Oe.autoUpdate=Y,Oe.needsUpdate=X,Oe.type=q}function xn(b){Be("WebGLRenderer: A WebGL context could not be created. Reason: ",b.statusMessage)}function yn(b){let O=b.target;O.removeEventListener("dispose",yn),Ku(O)}function Ku(b){Ju(b),W.remove(b)}function Ju(b){let O=W.get(b).programs;O!==void 0&&(O.forEach(function(Y){de.releaseProgram(Y)}),b.isShaderMaterial&&de.releaseShaderCache(b))}this.renderBufferDirect=function(b,O,Y,X,q,xe){O===null&&(O=Xe);let Me=q.isMesh&&q.matrixWorld.determinantAffine()<0,_e=ed(b,O,Y,X,q);x.setMaterial(X,Me);let Ae=Y.index,Pe=1;if(X.wireframe===!0){if(Ae=K.getWireframeAttribute(Y),Ae===void 0)return;Pe=2}let Ye=Y.drawRange,Je=Y.attributes.position,Ie=Ye.start*Pe,ot=(Ye.start+Ye.count)*Pe;xe!==null&&(Ie=Math.max(Ie,xe.start*Pe),ot=Math.min(ot,(xe.start+xe.count)*Pe)),Ae!==null?(Ie=Math.max(Ie,0),ot=Math.min(ot,Ae.count)):Je!=null&&(Ie=Math.max(Ie,0),ot=Math.min(ot,Je.count));let vt=ot-Ie;if(vt<0||vt===1/0)return;ye.setup(q,X,_e,Y,Ae);let xt,ct=ue;if(Ae!==null&&(xt=he.get(Ae),ct=ee,ct.setIndex(xt)),q.isMesh)X.wireframe===!0?(x.setLineWidth(X.wireframeLinewidth*rt()),ct.setMode(F.LINES)):ct.setMode(F.TRIANGLES);else if(q.isLine){let Ft=X.linewidth;Ft===void 0&&(Ft=1),x.setLineWidth(Ft*rt()),q.isLineSegments?ct.setMode(F.LINES):q.isLineLoop?ct.setMode(F.LINE_LOOP):ct.setMode(F.LINE_STRIP)}else q.isPoints?ct.setMode(F.POINTS):q.isSprite&&ct.setMode(F.TRIANGLES);if(q.isBatchedMesh)if(We.get("WEBGL_multi_draw"))ct.renderMultiDraw(q._multiDrawStarts,q._multiDrawCounts,q._multiDrawCount);else{let Ft=q._multiDrawStarts,be=q._multiDrawCounts,$t=q._multiDrawCount,et=Ae?he.get(Ae).bytesPerElement:1,nn=W.get(X).currentProgram.getUniforms();for(let vn=0;vn<$t;vn++)nn.setValue(F,"_gl_DrawID",vn),ct.render(Ft[vn]/et,be[vn])}else if(q.isInstancedMesh)ct.renderInstances(Ie,vt,q.count);else if(Y.isInstancedBufferGeometry){let Ft=Y._maxInstanceCount!==void 0?Y._maxInstanceCount:1/0,be=Math.min(Y.instanceCount,Ft);ct.renderInstances(Ie,vt,be)}else ct.render(Ie,vt)};function sc(b,O,Y){b.transparent===!0&&b.side===Ht&&b.forceSinglePass===!1?(b.side=Gt,b.needsUpdate=!0,_r(b,O,Y),b.side=fn,b.needsUpdate=!0,_r(b,O,Y),b.side=Ht):_r(b,O,Y)}this.compile=function(b,O,Y=null){Y===null&&(Y=b),_=fe.get(Y),_.init(O),y.push(_),Y.traverseVisible(function(q){q.isLight&&q.layers.test(O.layers)&&(_.pushLight(q),q.castShadow&&_.pushShadow(q))}),b!==Y&&b.traverseVisible(function(q){q.isLight&&q.layers.test(O.layers)&&(_.pushLight(q),q.castShadow&&_.pushShadow(q))}),_.setupLights();let X=new Set;return b.traverse(function(q){if(!(q.isMesh||q.isPoints||q.isLine||q.isSprite))return;let xe=q.material;if(xe)if(Array.isArray(xe))for(let Me=0;Me<xe.length;Me++){let _e=xe[Me];sc(_e,Y,q),X.add(_e)}else sc(xe,Y,q),X.add(xe)}),_=y.pop(),X},this.compileAsync=function(b,O,Y=null){let X=this.compile(b,O,Y);return new Promise(q=>{function xe(){if(X.forEach(function(Me){W.get(Me).currentProgram.isReady()&&X.delete(Me)}),X.size===0){q(b);return}setTimeout(xe,10)}We.get("KHR_parallel_shader_compile")!==null?xe():setTimeout(xe,10)})};let bo=null;function ju(b){bo&&bo(b)}function rc(){fi.stop()}function ac(){fi.start()}let fi=new Zh;fi.setAnimationLoop(ju),typeof self<"u"&&fi.setContext(self),this.setAnimationLoop=function(b){bo=b,Ee.setAnimationLoop(b),b===null?fi.stop():fi.start()},Ee.addEventListener("sessionstart",rc),Ee.addEventListener("sessionend",ac),this.render=function(b,O){if(O!==void 0&&O.isCamera!==!0){Be("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(T===!0)return;D!==null&&D.renderStart(b,O);let Y=Ee.enabled===!0&&Ee.isPresenting===!0,X=C!==null&&(k===null||Y)&&C.begin(w,k);if(b.matrixWorldAutoUpdate===!0&&b.updateMatrixWorld(),O.parent===null&&O.matrixWorldAutoUpdate===!0&&O.updateMatrixWorld(),Ee.enabled===!0&&Ee.isPresenting===!0&&(C===null||C.isCompositing()===!1)&&(Ee.cameraAutoUpdate===!0&&Ee.updateCamera(O),O=Ee.getCamera()),b.isScene===!0&&b.onBeforeRender(w,b,O,k),_=fe.get(b,y.length),_.init(O),_.state.textureUnits=Z.getTextureUnits(),y.push(_),Ke.multiplyMatrices(O.projectionMatrix,O.matrixWorldInverse),Se.setFromProjectionMatrix(Ke,dn,O.reversedDepth),Ue=this.localClippingEnabled,Le=De.init(this.clippingPlanes,Ue),E=me.get(b,P.length),E.init(),P.push(E),Ee.enabled===!0&&Ee.isPresenting===!0){let Me=w.xr.getDepthSensingMesh();Me!==null&&Mo(Me,O,-1/0,w.sortObjects)}Mo(b,O,0,w.sortObjects),E.finish(),w.sortObjects===!0&&E.sort(we,Te,O.reversedDepth),He=Ee.enabled===!1||Ee.isPresenting===!1||Ee.hasDepthSensing()===!1,He&&qe.addToRenderList(E,b),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),Le===!0&&De.beginShadows();let q=_.state.shadowsArray;if(Oe.render(q,b,O),Le===!0&&De.endShadows(),(X&&C.hasRenderPass())===!1){let Me=E.opaque,_e=E.transmissive;if(_.setupLights(),O.isArrayCamera){let Ae=O.cameras;if(_e.length>0)for(let Pe=0,Ye=Ae.length;Pe<Ye;Pe++){let Je=Ae[Pe];lc(Me,_e,b,Je)}He&&qe.render(b);for(let Pe=0,Ye=Ae.length;Pe<Ye;Pe++){let Je=Ae[Pe];oc(E,b,Je,Je.viewport)}}else _e.length>0&&lc(Me,_e,b,O),He&&qe.render(b),oc(E,b,O)}k!==null&&N===0&&(Z.updateMultisampleRenderTarget(k),Z.updateRenderTargetMipmap(k)),X&&C.end(w),b.isScene===!0&&b.onAfterRender(w,b,O),ye.resetDefaultState(),$=-1,j=null,y.pop(),y.length>0?(_=y[y.length-1],Z.setTextureUnits(_.state.textureUnits),Le===!0&&De.setGlobalState(w.clippingPlanes,_.state.camera)):_=null,P.pop(),P.length>0?E=P[P.length-1]:E=null,D!==null&&D.renderEnd()};function Mo(b,O,Y,X){if(b.visible===!1)return;if(b.layers.test(O.layers)){if(b.isGroup)Y=b.renderOrder;else if(b.isLOD)b.autoUpdate===!0&&b.update(O);else if(b.isLightProbeGrid)_.pushLightProbeGrid(b);else if(b.isLight)_.pushLight(b),b.castShadow&&_.pushShadow(b);else if(b.isSprite){if(!b.frustumCulled||Se.intersectsSprite(b)){X&&ke.setFromMatrixPosition(b.matrixWorld).applyMatrix4(Ke);let Me=te.update(b),_e=b.material;_e.visible&&E.push(b,Me,_e,Y,ke.z,null)}}else if((b.isMesh||b.isLine||b.isPoints)&&(!b.frustumCulled||Se.intersectsObject(b))){let Me=te.update(b),_e=b.material;if(X&&(b.boundingSphere!==void 0?(b.boundingSphere===null&&b.computeBoundingSphere(),ke.copy(b.boundingSphere.center)):(Me.boundingSphere===null&&Me.computeBoundingSphere(),ke.copy(Me.boundingSphere.center)),ke.applyMatrix4(b.matrixWorld).applyMatrix4(Ke)),Array.isArray(_e)){let Ae=Me.groups;for(let Pe=0,Ye=Ae.length;Pe<Ye;Pe++){let Je=Ae[Pe],Ie=_e[Je.materialIndex];Ie&&Ie.visible&&E.push(b,Me,Ie,Y,ke.z,Je)}}else _e.visible&&E.push(b,Me,_e,Y,ke.z,null)}}let xe=b.children;for(let Me=0,_e=xe.length;Me<_e;Me++)Mo(xe[Me],O,Y,X)}function oc(b,O,Y,X){let{opaque:q,transmissive:xe,transparent:Me}=b;_.setupLightsView(Y),Le===!0&&De.setGlobalState(w.clippingPlanes,Y),X&&x.viewport(ne.copy(X)),q.length>0&&gr(q,O,Y),xe.length>0&&gr(xe,O,Y),Me.length>0&&gr(Me,O,Y),x.buffers.depth.setTest(!0),x.buffers.depth.setMask(!0),x.buffers.color.setMask(!0),x.setPolygonOffset(!1)}function lc(b,O,Y,X){if((Y.isScene===!0?Y.overrideMaterial:null)!==null)return;if(_.state.transmissionRenderTarget[X.id]===void 0){let Ie=We.has("EXT_color_buffer_half_float")||We.has("EXT_color_buffer_float");_.state.transmissionRenderTarget[X.id]=new Qt(1,1,{generateMipmaps:!0,type:Ie?Tn:qt,minFilter:ri,samples:Math.max(4,S.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Qe.workingColorSpace})}let xe=_.state.transmissionRenderTarget[X.id],Me=X.viewport||ne;xe.setSize(Me.z*w.transmissionResolutionScale,Me.w*w.transmissionResolutionScale);let _e=w.getRenderTarget(),Ae=w.getActiveCubeFace(),Pe=w.getActiveMipmapLevel();w.setRenderTarget(xe),w.getClearColor(Ne),re=w.getClearAlpha(),re<1&&w.setClearColor(16777215,.5),w.clear(),He&&qe.render(Y);let Ye=w.toneMapping;w.toneMapping=mn;let Je=X.viewport;if(X.viewport!==void 0&&(X.viewport=void 0),_.setupLightsView(X),Le===!0&&De.setGlobalState(w.clippingPlanes,X),gr(b,Y,X),Z.updateMultisampleRenderTarget(xe),Z.updateRenderTargetMipmap(xe),We.has("WEBGL_multisampled_render_to_texture")===!1){let Ie=!1;for(let ot=0,vt=O.length;ot<vt;ot++){let xt=O[ot],{object:ct,geometry:Ft,material:be,group:$t}=xt;if(be.side===Ht&&ct.layers.test(X.layers)){let et=be.side;be.side=Gt,be.needsUpdate=!0,cc(ct,Y,X,Ft,be,$t),be.side=et,be.needsUpdate=!0,Ie=!0}}Ie===!0&&(Z.updateMultisampleRenderTarget(xe),Z.updateRenderTargetMipmap(xe))}w.setRenderTarget(_e,Ae,Pe),w.setClearColor(Ne,re),Je!==void 0&&(X.viewport=Je),w.toneMapping=Ye}function gr(b,O,Y){let X=O.isScene===!0?O.overrideMaterial:null;for(let q=0,xe=b.length;q<xe;q++){let Me=b[q],{object:_e,geometry:Ae,group:Pe}=Me,Ye=Me.material;Ye.allowOverride===!0&&X!==null&&(Ye=X),_e.layers.test(Y.layers)&&cc(_e,O,Y,Ae,Ye,Pe)}}function cc(b,O,Y,X,q,xe){b.onBeforeRender(w,O,Y,X,q,xe),b.modelViewMatrix.multiplyMatrices(Y.matrixWorldInverse,b.matrixWorld),b.normalMatrix.getNormalMatrix(b.modelViewMatrix),q.onBeforeRender(w,O,Y,X,b,xe),q.transparent===!0&&q.side===Ht&&q.forceSinglePass===!1?(q.side=Gt,q.needsUpdate=!0,w.renderBufferDirect(Y,O,X,q,b,xe),q.side=fn,q.needsUpdate=!0,w.renderBufferDirect(Y,O,X,q,b,xe),q.side=Ht):w.renderBufferDirect(Y,O,X,q,b,xe),b.onAfterRender(w,O,Y,X,q,xe)}function _r(b,O,Y){O.isScene!==!0&&(O=Xe);let X=W.get(b),q=_.state.lights,xe=_.state.shadowsArray,Me=q.state.version,_e=de.getParameters(b,q.state,xe,O,Y,_.state.lightProbeGridArray),Ae=de.getProgramCacheKey(_e),Pe=X.programs;X.environment=b.isMeshStandardMaterial||b.isMeshLambertMaterial||b.isMeshPhongMaterial?O.environment:null,X.fog=O.fog;let Ye=b.isMeshStandardMaterial||b.isMeshLambertMaterial&&!b.envMap||b.isMeshPhongMaterial&&!b.envMap;X.envMap=le.get(b.envMap||X.environment,Ye),X.envMapRotation=X.environment!==null&&b.envMap===null?O.environmentRotation:b.envMapRotation,Pe===void 0&&(b.addEventListener("dispose",yn),Pe=new Map,X.programs=Pe);let Je=Pe.get(Ae);if(Je!==void 0){if(X.currentProgram===Je&&X.lightsStateVersion===Me)return uc(b,_e),Je}else _e.uniforms=de.getUniforms(b),D!==null&&b.isNodeMaterial&&D.build(b,Y,_e),b.onBeforeCompile(_e,w),Je=de.acquireProgram(_e,Ae),Pe.set(Ae,Je),X.uniforms=_e.uniforms;let Ie=X.uniforms;return(!b.isShaderMaterial&&!b.isRawShaderMaterial||b.clipping===!0)&&(Ie.clippingPlanes=De.uniform),uc(b,_e),X.needsLights=nd(b),X.lightsStateVersion=Me,X.needsLights&&(Ie.ambientLightColor.value=q.state.ambient,Ie.lightProbe.value=q.state.probe,Ie.directionalLights.value=q.state.directional,Ie.directionalLightShadows.value=q.state.directionalShadow,Ie.spotLights.value=q.state.spot,Ie.spotLightShadows.value=q.state.spotShadow,Ie.rectAreaLights.value=q.state.rectArea,Ie.ltc_1.value=q.state.rectAreaLTC1,Ie.ltc_2.value=q.state.rectAreaLTC2,Ie.pointLights.value=q.state.point,Ie.pointLightShadows.value=q.state.pointShadow,Ie.hemisphereLights.value=q.state.hemi,Ie.directionalShadowMatrix.value=q.state.directionalShadowMatrix,Ie.spotLightMatrix.value=q.state.spotLightMatrix,Ie.spotLightMap.value=q.state.spotLightMap,Ie.pointShadowMatrix.value=q.state.pointShadowMatrix),X.lightProbeGrid=_.state.lightProbeGridArray.length>0,X.currentProgram=Je,X.uniformsList=null,Je}function hc(b){if(b.uniformsList===null){let O=b.currentProgram.getUniforms();b.uniformsList=ls.seqWithValue(O.seq,b.uniforms)}return b.uniformsList}function uc(b,O){let Y=W.get(b);Y.outputColorSpace=O.outputColorSpace,Y.batching=O.batching,Y.batchingColor=O.batchingColor,Y.instancing=O.instancing,Y.instancingColor=O.instancingColor,Y.instancingMorph=O.instancingMorph,Y.skinning=O.skinning,Y.morphTargets=O.morphTargets,Y.morphNormals=O.morphNormals,Y.morphColors=O.morphColors,Y.morphTargetsCount=O.morphTargetsCount,Y.numClippingPlanes=O.numClippingPlanes,Y.numIntersection=O.numClipIntersection,Y.vertexAlphas=O.vertexAlphas,Y.vertexTangents=O.vertexTangents,Y.toneMapping=O.toneMapping}function Qu(b,O){if(b.length===0)return null;if(b.length===1)return b[0].texture!==null?b[0]:null;v.setFromMatrixPosition(O.matrixWorld);for(let Y=0,X=b.length;Y<X;Y++){let q=b[Y];if(q.texture!==null&&q.boundingBox.containsPoint(v))return q}return null}function ed(b,O,Y,X,q){O.isScene!==!0&&(O=Xe),Z.resetTextureUnits();let xe=O.fog,Me=X.isMeshStandardMaterial||X.isMeshLambertMaterial||X.isMeshPhongMaterial?O.environment:null,_e=k===null?w.outputColorSpace:k.isXRRenderTarget===!0?k.texture.colorSpace:Qe.workingColorSpace,Ae=X.isMeshStandardMaterial||X.isMeshLambertMaterial&&!X.envMap||X.isMeshPhongMaterial&&!X.envMap,Pe=le.get(X.envMap||Me,Ae),Ye=X.vertexColors===!0&&!!Y.attributes.color&&Y.attributes.color.itemSize===4,Je=!!Y.attributes.tangent&&(!!X.normalMap||X.anisotropy>0),Ie=!!Y.morphAttributes.position,ot=!!Y.morphAttributes.normal,vt=!!Y.morphAttributes.color,xt=mn;X.toneMapped&&(k===null||k.isXRRenderTarget===!0)&&(xt=w.toneMapping);let ct=Y.morphAttributes.position||Y.morphAttributes.normal||Y.morphAttributes.color,Ft=ct!==void 0?ct.length:0,be=W.get(X),$t=_.state.lights;if(Le===!0&&(Ue===!0||b!==j)){let dt=b===j&&X.id===$;De.setState(X,b,dt)}let et=!1;X.version===be.__version?(be.needsLights&&be.lightsStateVersion!==$t.state.version||be.outputColorSpace!==_e||q.isBatchedMesh&&be.batching===!1||!q.isBatchedMesh&&be.batching===!0||q.isBatchedMesh&&be.batchingColor===!0&&q.colorTexture===null||q.isBatchedMesh&&be.batchingColor===!1&&q.colorTexture!==null||q.isInstancedMesh&&be.instancing===!1||!q.isInstancedMesh&&be.instancing===!0||q.isSkinnedMesh&&be.skinning===!1||!q.isSkinnedMesh&&be.skinning===!0||q.isInstancedMesh&&be.instancingColor===!0&&q.instanceColor===null||q.isInstancedMesh&&be.instancingColor===!1&&q.instanceColor!==null||q.isInstancedMesh&&be.instancingMorph===!0&&q.morphTexture===null||q.isInstancedMesh&&be.instancingMorph===!1&&q.morphTexture!==null||be.envMap!==Pe||X.fog===!0&&be.fog!==xe||be.numClippingPlanes!==void 0&&(be.numClippingPlanes!==De.numPlanes||be.numIntersection!==De.numIntersection)||be.vertexAlphas!==Ye||be.vertexTangents!==Je||be.morphTargets!==Ie||be.morphNormals!==ot||be.morphColors!==vt||be.toneMapping!==xt||be.morphTargetsCount!==Ft||!!be.lightProbeGrid!=_.state.lightProbeGridArray.length>0)&&(et=!0):(et=!0,be.__version=X.version);let nn=be.currentProgram;et===!0&&(nn=_r(X,O,q),D&&X.isNodeMaterial&&D.onUpdateProgram(X,nn,be));let vn=!1,zn=!1,Ri=!1,ht=nn.getUniforms(),bt=be.uniforms;if(x.useProgram(nn.program)&&(vn=!0,zn=!0,Ri=!0),X.id!==$&&($=X.id,zn=!0),be.needsLights){let dt=Qu(_.state.lightProbeGridArray,q);be.lightProbeGrid!==dt&&(be.lightProbeGrid=dt,zn=!0)}if(vn||j!==b){x.buffers.depth.getReversed()&&b.reversedDepth!==!0&&(b._reversedDepth=!0,b.updateProjectionMatrix()),ht.setValue(F,"projectionMatrix",b.projectionMatrix),ht.setValue(F,"viewMatrix",b.matrixWorldInverse);let Vn=ht.map.cameraPosition;Vn!==void 0&&Vn.setValue(F,Ve.setFromMatrixPosition(b.matrixWorld)),S.logarithmicDepthBuffer&&ht.setValue(F,"logDepthBufFC",2/(Math.log(b.far+1)/Math.LN2)),(X.isMeshPhongMaterial||X.isMeshToonMaterial||X.isMeshLambertMaterial||X.isMeshBasicMaterial||X.isMeshStandardMaterial||X.isShaderMaterial)&&ht.setValue(F,"isOrthographic",b.isOrthographicCamera===!0),j!==b&&(j=b,zn=!0,Ri=!0)}if(be.needsLights&&($t.state.directionalShadowMap.length>0&&ht.setValue(F,"directionalShadowMap",$t.state.directionalShadowMap,Z),$t.state.spotShadowMap.length>0&&ht.setValue(F,"spotShadowMap",$t.state.spotShadowMap,Z),$t.state.pointShadowMap.length>0&&ht.setValue(F,"pointShadowMap",$t.state.pointShadowMap,Z)),q.isSkinnedMesh){ht.setOptional(F,q,"bindMatrix"),ht.setOptional(F,q,"bindMatrixInverse");let dt=q.skeleton;dt&&(dt.boneTexture===null&&dt.computeBoneTexture(),ht.setValue(F,"boneTexture",dt.boneTexture,Z))}q.isBatchedMesh&&(ht.setOptional(F,q,"batchingTexture"),ht.setValue(F,"batchingTexture",q._matricesTexture,Z),ht.setOptional(F,q,"batchingIdTexture"),ht.setValue(F,"batchingIdTexture",q._indirectTexture,Z),ht.setOptional(F,q,"batchingColorTexture"),q._colorsTexture!==null&&ht.setValue(F,"batchingColorTexture",q._colorsTexture,Z));let kn=Y.morphAttributes;if((kn.position!==void 0||kn.normal!==void 0||kn.color!==void 0)&&U.update(q,Y,nn),(zn||be.receiveShadow!==q.receiveShadow)&&(be.receiveShadow=q.receiveShadow,ht.setValue(F,"receiveShadow",q.receiveShadow)),(X.isMeshStandardMaterial||X.isMeshLambertMaterial||X.isMeshPhongMaterial)&&X.envMap===null&&O.environment!==null&&(bt.envMapIntensity.value=O.environmentIntensity),bt.dfgLUT!==void 0&&(bt.dfgLUT.value=n_()),zn){if(ht.setValue(F,"toneMappingExposure",w.toneMappingExposure),be.needsLights&&td(bt,Ri),xe&&X.fog===!0&&Ce.refreshFogUniforms(bt,xe),Ce.refreshMaterialUniforms(bt,X,Q,ie,_.state.transmissionRenderTarget[b.id]),be.needsLights&&be.lightProbeGrid){let dt=be.lightProbeGrid;bt.probesSH.value=dt.texture,bt.probesMin.value.copy(dt.boundingBox.min),bt.probesMax.value.copy(dt.boundingBox.max),bt.probesResolution.value.copy(dt.resolution)}ls.upload(F,hc(be),bt,Z)}if(X.isShaderMaterial&&X.uniformsNeedUpdate===!0&&(ls.upload(F,hc(be),bt,Z),X.uniformsNeedUpdate=!1),X.isSpriteMaterial&&ht.setValue(F,"center",q.center),ht.setValue(F,"modelViewMatrix",q.modelViewMatrix),ht.setValue(F,"normalMatrix",q.normalMatrix),ht.setValue(F,"modelMatrix",q.matrixWorld),X.uniformsGroups!==void 0){let dt=X.uniformsGroups;for(let Vn=0,Ci=dt.length;Vn<Ci;Vn++){let dc=dt[Vn];se.update(dc,nn),se.bind(dc,nn)}}return nn}function td(b,O){b.ambientLightColor.needsUpdate=O,b.lightProbe.needsUpdate=O,b.directionalLights.needsUpdate=O,b.directionalLightShadows.needsUpdate=O,b.pointLights.needsUpdate=O,b.pointLightShadows.needsUpdate=O,b.spotLights.needsUpdate=O,b.spotLightShadows.needsUpdate=O,b.rectAreaLights.needsUpdate=O,b.hemisphereLights.needsUpdate=O}function nd(b){return b.isMeshLambertMaterial||b.isMeshToonMaterial||b.isMeshPhongMaterial||b.isMeshStandardMaterial||b.isShadowMaterial||b.isShaderMaterial&&b.lights===!0}this.getActiveCubeFace=function(){return G},this.getActiveMipmapLevel=function(){return N},this.getRenderTarget=function(){return k},this.setRenderTargetTextures=function(b,O,Y){let X=W.get(b);X.__autoAllocateDepthBuffer=b.resolveDepthBuffer===!1,X.__autoAllocateDepthBuffer===!1&&(X.__useRenderToTexture=!1),W.get(b.texture).__webglTexture=O,W.get(b.depthTexture).__webglTexture=X.__autoAllocateDepthBuffer?void 0:Y,X.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(b,O){let Y=W.get(b);Y.__webglFramebuffer=O,Y.__useDefaultFramebuffer=O===void 0},this.setRenderTarget=function(b,O=0,Y=0){k=b,G=O,N=Y;let X=null,q=!1,xe=!1;if(b){let _e=W.get(b);if(_e.__useDefaultFramebuffer!==void 0){x.bindFramebuffer(F.FRAMEBUFFER,_e.__webglFramebuffer),ne.copy(b.viewport),ae.copy(b.scissor),ve=b.scissorTest,x.viewport(ne),x.scissor(ae),x.setScissorTest(ve),$=-1;return}else if(_e.__webglFramebuffer===void 0)Z.setupRenderTarget(b);else if(_e.__hasExternalTextures)Z.rebindTextures(b,W.get(b.texture).__webglTexture,W.get(b.depthTexture).__webglTexture);else if(b.depthBuffer){let Ye=b.depthTexture;if(_e.__boundDepthTexture!==Ye){if(Ye!==null&&W.has(Ye)&&(b.width!==Ye.image.width||b.height!==Ye.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");Z.setupDepthRenderbuffer(b)}}let Ae=b.texture;(Ae.isData3DTexture||Ae.isDataArrayTexture||Ae.isCompressedArrayTexture)&&(xe=!0);let Pe=W.get(b).__webglFramebuffer;b.isWebGLCubeRenderTarget?(Array.isArray(Pe[O])?X=Pe[O][Y]:X=Pe[O],q=!0):b.samples>0&&Z.useMultisampledRTT(b)===!1?X=W.get(b).__webglMultisampledFramebuffer:Array.isArray(Pe)?X=Pe[Y]:X=Pe,ne.copy(b.viewport),ae.copy(b.scissor),ve=b.scissorTest}else ne.copy(J).multiplyScalar(Q).floor(),ae.copy(ce).multiplyScalar(Q).floor(),ve=oe;if(Y!==0&&(X=B),x.bindFramebuffer(F.FRAMEBUFFER,X)&&x.drawBuffers(b,X),x.viewport(ne),x.scissor(ae),x.setScissorTest(ve),q){let _e=W.get(b.texture);F.framebufferTexture2D(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_CUBE_MAP_POSITIVE_X+O,_e.__webglTexture,Y)}else if(xe){let _e=O;for(let Ae=0;Ae<b.textures.length;Ae++){let Pe=W.get(b.textures[Ae]);F.framebufferTextureLayer(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0+Ae,Pe.__webglTexture,Y,_e)}}else if(b!==null&&Y!==0){let _e=W.get(b.texture);F.framebufferTexture2D(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_2D,_e.__webglTexture,Y)}$=-1},this.readRenderTargetPixels=function(b,O,Y,X,q,xe,Me,_e=0){if(!(b&&b.isWebGLRenderTarget)){Be("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Ae=W.get(b).__webglFramebuffer;if(b.isWebGLCubeRenderTarget&&Me!==void 0&&(Ae=Ae[Me]),Ae){x.bindFramebuffer(F.FRAMEBUFFER,Ae);try{let Pe=b.textures[_e],Ye=Pe.format,Je=Pe.type;if(b.textures.length>1&&F.readBuffer(F.COLOR_ATTACHMENT0+_e),!S.textureFormatReadable(Ye)){Be("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!S.textureTypeReadable(Je)){Be("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}O>=0&&O<=b.width-X&&Y>=0&&Y<=b.height-q&&F.readPixels(O,Y,X,q,pe.convert(Ye),pe.convert(Je),xe)}finally{let Pe=k!==null?W.get(k).__webglFramebuffer:null;x.bindFramebuffer(F.FRAMEBUFFER,Pe)}}},this.readRenderTargetPixelsAsync=async function(b,O,Y,X,q,xe,Me,_e=0){if(!(b&&b.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Ae=W.get(b).__webglFramebuffer;if(b.isWebGLCubeRenderTarget&&Me!==void 0&&(Ae=Ae[Me]),Ae)if(O>=0&&O<=b.width-X&&Y>=0&&Y<=b.height-q){x.bindFramebuffer(F.FRAMEBUFFER,Ae);let Pe=b.textures[_e],Ye=Pe.format,Je=Pe.type;if(b.textures.length>1&&F.readBuffer(F.COLOR_ATTACHMENT0+_e),!S.textureFormatReadable(Ye))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!S.textureTypeReadable(Je))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Ie=F.createBuffer();F.bindBuffer(F.PIXEL_PACK_BUFFER,Ie),F.bufferData(F.PIXEL_PACK_BUFFER,xe.byteLength,F.STREAM_READ),F.readPixels(O,Y,X,q,pe.convert(Ye),pe.convert(Je),0);let ot=k!==null?W.get(k).__webglFramebuffer:null;x.bindFramebuffer(F.FRAMEBUFFER,ot);let vt=F.fenceSync(F.SYNC_GPU_COMMANDS_COMPLETE,0);return F.flush(),await _h(F,vt,4),F.bindBuffer(F.PIXEL_PACK_BUFFER,Ie),F.getBufferSubData(F.PIXEL_PACK_BUFFER,0,xe),F.deleteBuffer(Ie),F.deleteSync(vt),xe}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(b,O=null,Y=0){let X=Math.pow(2,-Y),q=Math.floor(b.image.width*X),xe=Math.floor(b.image.height*X),Me=O!==null?O.x:0,_e=O!==null?O.y:0;Z.setTexture2D(b,0),F.copyTexSubImage2D(F.TEXTURE_2D,Y,0,0,Me,_e,q,xe),x.unbindTexture()},this.copyTextureToTexture=function(b,O,Y=null,X=null,q=0,xe=0){let Me,_e,Ae,Pe,Ye,Je,Ie,ot,vt,xt=b.isCompressedTexture?b.mipmaps[xe]:b.image;if(Y!==null)Me=Y.max.x-Y.min.x,_e=Y.max.y-Y.min.y,Ae=Y.isBox3?Y.max.z-Y.min.z:1,Pe=Y.min.x,Ye=Y.min.y,Je=Y.isBox3?Y.min.z:0;else{let bt=Math.pow(2,-q);Me=Math.floor(xt.width*bt),_e=Math.floor(xt.height*bt),b.isDataArrayTexture?Ae=xt.depth:b.isData3DTexture?Ae=Math.floor(xt.depth*bt):Ae=1,Pe=0,Ye=0,Je=0}X!==null?(Ie=X.x,ot=X.y,vt=X.z):(Ie=0,ot=0,vt=0);let ct=pe.convert(O.format),Ft=pe.convert(O.type),be;O.isData3DTexture?(Z.setTexture3D(O,0),be=F.TEXTURE_3D):O.isDataArrayTexture||O.isCompressedArrayTexture?(Z.setTexture2DArray(O,0),be=F.TEXTURE_2D_ARRAY):(Z.setTexture2D(O,0),be=F.TEXTURE_2D),x.activeTexture(F.TEXTURE0),x.pixelStorei(F.UNPACK_FLIP_Y_WEBGL,O.flipY),x.pixelStorei(F.UNPACK_PREMULTIPLY_ALPHA_WEBGL,O.premultiplyAlpha),x.pixelStorei(F.UNPACK_ALIGNMENT,O.unpackAlignment);let $t=x.getParameter(F.UNPACK_ROW_LENGTH),et=x.getParameter(F.UNPACK_IMAGE_HEIGHT),nn=x.getParameter(F.UNPACK_SKIP_PIXELS),vn=x.getParameter(F.UNPACK_SKIP_ROWS),zn=x.getParameter(F.UNPACK_SKIP_IMAGES);x.pixelStorei(F.UNPACK_ROW_LENGTH,xt.width),x.pixelStorei(F.UNPACK_IMAGE_HEIGHT,xt.height),x.pixelStorei(F.UNPACK_SKIP_PIXELS,Pe),x.pixelStorei(F.UNPACK_SKIP_ROWS,Ye),x.pixelStorei(F.UNPACK_SKIP_IMAGES,Je);let Ri=b.isDataArrayTexture||b.isData3DTexture,ht=O.isDataArrayTexture||O.isData3DTexture;if(b.isDepthTexture){let bt=W.get(b),kn=W.get(O),dt=W.get(bt.__renderTarget),Vn=W.get(kn.__renderTarget);x.bindFramebuffer(F.READ_FRAMEBUFFER,dt.__webglFramebuffer),x.bindFramebuffer(F.DRAW_FRAMEBUFFER,Vn.__webglFramebuffer);for(let Ci=0;Ci<Ae;Ci++)Ri&&(F.framebufferTextureLayer(F.READ_FRAMEBUFFER,F.COLOR_ATTACHMENT0,W.get(b).__webglTexture,q,Je+Ci),F.framebufferTextureLayer(F.DRAW_FRAMEBUFFER,F.COLOR_ATTACHMENT0,W.get(O).__webglTexture,xe,vt+Ci)),F.blitFramebuffer(Pe,Ye,Me,_e,Ie,ot,Me,_e,F.DEPTH_BUFFER_BIT,F.NEAREST);x.bindFramebuffer(F.READ_FRAMEBUFFER,null),x.bindFramebuffer(F.DRAW_FRAMEBUFFER,null)}else if(q!==0||b.isRenderTargetTexture||W.has(b)){let bt=W.get(b),kn=W.get(O);x.bindFramebuffer(F.READ_FRAMEBUFFER,L),x.bindFramebuffer(F.DRAW_FRAMEBUFFER,I);for(let dt=0;dt<Ae;dt++)Ri?F.framebufferTextureLayer(F.READ_FRAMEBUFFER,F.COLOR_ATTACHMENT0,bt.__webglTexture,q,Je+dt):F.framebufferTexture2D(F.READ_FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_2D,bt.__webglTexture,q),ht?F.framebufferTextureLayer(F.DRAW_FRAMEBUFFER,F.COLOR_ATTACHMENT0,kn.__webglTexture,xe,vt+dt):F.framebufferTexture2D(F.DRAW_FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_2D,kn.__webglTexture,xe),q!==0?F.blitFramebuffer(Pe,Ye,Me,_e,Ie,ot,Me,_e,F.COLOR_BUFFER_BIT,F.NEAREST):ht?F.copyTexSubImage3D(be,xe,Ie,ot,vt+dt,Pe,Ye,Me,_e):F.copyTexSubImage2D(be,xe,Ie,ot,Pe,Ye,Me,_e);x.bindFramebuffer(F.READ_FRAMEBUFFER,null),x.bindFramebuffer(F.DRAW_FRAMEBUFFER,null)}else ht?b.isDataTexture||b.isData3DTexture?F.texSubImage3D(be,xe,Ie,ot,vt,Me,_e,Ae,ct,Ft,xt.data):O.isCompressedArrayTexture?F.compressedTexSubImage3D(be,xe,Ie,ot,vt,Me,_e,Ae,ct,xt.data):F.texSubImage3D(be,xe,Ie,ot,vt,Me,_e,Ae,ct,Ft,xt):b.isDataTexture?F.texSubImage2D(F.TEXTURE_2D,xe,Ie,ot,Me,_e,ct,Ft,xt.data):b.isCompressedTexture?F.compressedTexSubImage2D(F.TEXTURE_2D,xe,Ie,ot,xt.width,xt.height,ct,xt.data):F.texSubImage2D(F.TEXTURE_2D,xe,Ie,ot,Me,_e,ct,Ft,xt);x.pixelStorei(F.UNPACK_ROW_LENGTH,$t),x.pixelStorei(F.UNPACK_IMAGE_HEIGHT,et),x.pixelStorei(F.UNPACK_SKIP_PIXELS,nn),x.pixelStorei(F.UNPACK_SKIP_ROWS,vn),x.pixelStorei(F.UNPACK_SKIP_IMAGES,zn),xe===0&&O.generateMipmaps&&F.generateMipmap(be),x.unbindTexture()},this.initRenderTarget=function(b){W.get(b).__webglFramebuffer===void 0&&Z.setupRenderTarget(b)},this.initTexture=function(b){b.isCubeTexture?Z.setTextureCube(b,0):b.isData3DTexture?Z.setTexture3D(b,0):b.isDataArrayTexture||b.isCompressedArrayTexture?Z.setTexture2DArray(b,0):Z.setTexture2D(b,0),x.unbindTexture()},this.resetState=function(){G=0,N=0,k=null,x.reset(),ye.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return dn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=Qe._getDrawingBufferColorSpace(e),t.unpackColorSpace=Qe._getUnpackColorSpace()}};var nu={type:"change"},Zl={type:"start"},su={type:"end"},mo=new Ki,iu=new rn,i_=Math.cos(70*Al.DEG2RAD),Rt=new V,Yt=2*Math.PI,lt={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Yl=1e-6,go=class extends $s{constructor(e,t=null){super(e,t),this.state=lt.NONE,this.target=new V,this.cursor=new V,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:ni.ROTATE,MIDDLE:ni.DOLLY,RIGHT:ni.PAN},this.touches={ONE:ii.ROTATE,TWO:ii.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new V,this._lastQuaternion=new jt,this._lastTargetPosition=new V,this._quat=new jt().setFromUnitVectors(e.up,new V(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new ns,this._sphericalDelta=new ns,this._scale=1,this._panOffset=new V,this._rotateStart=new ze,this._rotateEnd=new ze,this._rotateDelta=new ze,this._panStart=new ze,this._panEnd=new ze,this._panDelta=new ze,this._dollyStart=new ze,this._dollyEnd=new ze,this._dollyDelta=new ze,this._dollyDirection=new V,this._mouse=new ze,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=r_.bind(this),this._onPointerDown=s_.bind(this),this._onPointerUp=a_.bind(this),this._onContextMenu=f_.bind(this),this._onMouseWheel=c_.bind(this),this._onKeyDown=h_.bind(this),this._onTouchStart=u_.bind(this),this._onTouchMove=d_.bind(this),this._onMouseDown=o_.bind(this),this._onMouseMove=l_.bind(this),this._interceptControlDown=p_.bind(this),this._interceptControlUp=m_.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e==="grab"?this.domElement.style.cursor="grab":this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction=""}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(nu),this.update(),this.state=lt.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;Rt.copy(t).sub(this.target),Rt.applyQuaternion(this._quat),this._spherical.setFromVector3(Rt),this.autoRotate&&this.state===lt.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let i=this.minAzimuthAngle,s=this.maxAzimuthAngle;isFinite(i)&&isFinite(s)&&(i<-Math.PI?i+=Yt:i>Math.PI&&(i-=Yt),s<-Math.PI?s+=Yt:s>Math.PI&&(s-=Yt),i<=s?this._spherical.theta=Math.max(i,Math.min(s,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(i+s)/2?Math.max(i,this._spherical.theta):Math.min(s,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let a=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=a!=this._spherical.radius}if(Rt.setFromSpherical(this._spherical),Rt.applyQuaternion(this._quatInverse),t.copy(this.target).add(Rt),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let a=null;if(this.object.isPerspectiveCamera){let o=Rt.length();a=this._clampDistance(o*this._scale);let l=o-a;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),r=!!l}else if(this.object.isOrthographicCamera){let o=new V(this._mouse.x,this._mouse.y,0);o.unproject(this.object);let l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=l!==this.object.zoom;let c=new V(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(o),this.object.updateMatrixWorld(),a=Rt.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;a!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(a).add(this.object.position):(mo.origin.copy(this.object.position),mo.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(mo.direction))<i_?this.object.lookAt(this.target):(iu.setFromNormalAndCoplanarPoint(this.object.up,this.target),mo.intersectPlane(iu,this.target))))}else if(this.object.isOrthographicCamera){let a=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),a!==this.object.zoom&&(this.object.updateProjectionMatrix(),r=!0)}return this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>Yl||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Yl||this._lastTargetPosition.distanceToSquared(this.target)>Yl?(this.dispatchEvent(nu),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?Yt/60*this.autoRotateSpeed*e:Yt/60/60*this.autoRotateSpeed}_getZoomScale(e){let t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Rt.setFromMatrixColumn(t,0),Rt.multiplyScalar(-e),this._panOffset.add(Rt)}_panUp(e,t){this.screenSpacePanning===!0?Rt.setFromMatrixColumn(t,1):(Rt.setFromMatrixColumn(t,0),Rt.crossVectors(this.object.up,Rt)),Rt.multiplyScalar(e),this._panOffset.add(Rt)}_pan(e,t){let i=this.domElement;if(this.object.isPerspectiveCamera){let s=this.object.position;Rt.copy(s).sub(this.target);let r=Rt.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*r/i.clientHeight,this.object.matrix),this._panUp(2*t*r/i.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/i.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/i.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let i=this.domElement.getBoundingClientRect(),s=e-i.left,r=t-i.top,a=i.width,o=i.height;this._mouse.x=s/a*2-1,this._mouse.y=-(r/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(Yt*this._rotateDelta.x/t.clientHeight),this._rotateUp(Yt*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(Yt*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-Yt*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(Yt*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-Yt*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._rotateStart.set(i,s)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panStart.set(i,s)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),i=e.pageX-t.x,s=e.pageY-t.y,r=Math.sqrt(i*i+s*s);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let i=this._getSecondPointerPosition(e),s=.5*(e.pageX+i.x),r=.5*(e.pageY+i.y);this._rotateEnd.set(s,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(Yt*this._rotateDelta.x/t.clientHeight),this._rotateUp(Yt*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panEnd.set(i,s)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),i=e.pageX-t.x,s=e.pageY-t.y,r=Math.sqrt(i*i+s*s);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let a=(e.pageX+t.x)*.5,o=(e.pageY+t.y)*.5;this._updateZoomParameters(a,o)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new ze,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,i={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:i.deltaY*=16;break;case 2:i.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(i.deltaY*=10),i}};function s_(n){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(n.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(n)&&(this._addPointer(n),n.pointerType==="touch"?this._onTouchStart(n):this._onMouseDown(n),this._cursorStyle==="grab"&&(this.domElement.style.cursor="grabbing")))}function r_(n){this.enabled!==!1&&(n.pointerType==="touch"?this._onTouchMove(n):this._onMouseMove(n))}function a_(n){switch(this._removePointer(n),this._pointers.length){case 0:this.domElement.releasePointerCapture(n.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(su),this.state=lt.NONE,this._cursorStyle==="grab"&&(this.domElement.style.cursor="grab");break;case 1:let e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function o_(n){let e;switch(n.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case ni.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(n),this.state=lt.DOLLY;break;case ni.ROTATE:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=lt.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=lt.ROTATE}break;case ni.PAN:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=lt.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=lt.PAN}break;default:this.state=lt.NONE}this.state!==lt.NONE&&this.dispatchEvent(Zl)}function l_(n){switch(this.state){case lt.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(n);break;case lt.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(n);break;case lt.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(n);break}}function c_(n){this.enabled===!1||this.enableZoom===!1||this.state!==lt.NONE||(n.preventDefault(),this.dispatchEvent(Zl),this._handleMouseWheel(this._customWheelEvent(n)),this.dispatchEvent(su))}function h_(n){this.enabled!==!1&&this._handleKeyDown(n)}function u_(n){switch(this._trackPointer(n),this._pointers.length){case 1:switch(this.touches.ONE){case ii.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(n),this.state=lt.TOUCH_ROTATE;break;case ii.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(n),this.state=lt.TOUCH_PAN;break;default:this.state=lt.NONE}break;case 2:switch(this.touches.TWO){case ii.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(n),this.state=lt.TOUCH_DOLLY_PAN;break;case ii.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(n),this.state=lt.TOUCH_DOLLY_ROTATE;break;default:this.state=lt.NONE}break;default:this.state=lt.NONE}this.state!==lt.NONE&&this.dispatchEvent(Zl)}function d_(n){switch(this._trackPointer(n),this.state){case lt.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(n),this.update();break;case lt.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(n),this.update();break;case lt.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(n),this.update();break;case lt.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(n),this.update();break;default:this.state=lt.NONE}}function f_(n){this.enabled!==!1&&n.preventDefault()}function p_(n){n.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function m_(n){n.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function ru(n,e,t="y"){let i=new n.MeshStandardMaterial({color:e,roughness:.94,side:n.DoubleSide});return i.customProgramCacheKey=()=>`appearance-brick-v1-${t}`,i.onBeforeCompile=s=>{s.vertexShader=`varying vec3 facadeMetricPosition;
`+s.vertexShader,s.vertexShader=s.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
facadeMetricPosition = position;`),s.fragmentShader=`varying vec3 facadeMetricPosition;
`+s.fragmentShader,s.fragmentShader=s.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
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
    `)},i}var g_="legacy-block-NAP-minus-0.65m";function au(n){if(n===g_)return .65;if(n==="NAP")return 0;throw new Error(`Unsupported appearance height datum: ${n}`)}function _o(n,e,t=0){return n+au(e)-t}function ci(n,e){return n-au(e)}function Kl(n){let e=n.rings?.[0]||[],t,i=0;for(let a of e)for(let o of e){let l=Math.hypot(o[0]-a[0],o[2]-a[2]);l>i&&(t=[a,o],i=l)}if(!t||i<1e-8)return null;t.sort((a,o)=>a[0]-o[0]||a[2]-o[2]);let[s,r]=t;return{origin:[s[0],s[2]],u:[(r[0]-s[0])/i,(r[2]-s[2])/i],length:i}}var $l=(n,e)=>(e[0]-n.origin[0])*n.u[0]+(e[2]-n.origin[1])*n.u[1];function hi(n,e,t,i=[]){let s=Kl(n);if(!s)return{axis:null,sourceSurfaceIndex:e,intervals:[]};let r=[];for(let l of i){if(l.renderBuildingId!==t||!l.renderSurfaceIndices?.includes(e)||["rejected","uncertain","crop-repair"].includes(l.review?.placement)||!l.effectiveProposal||l.effectiveProposal.wholeUsable==="no")continue;let c=l.review?.placement==="accepted"&&l.review.targetId&&l.review.targetId!==l.id?i.find(g=>g.id===l.review.targetId):l;if(!c||c.buildingId&&c.buildingId!==t)continue;let u=[c.localStart,c.localEnd];if(u.some(g=>!Array.isArray(g)||g.length!==2||!g.every(Number.isFinite))||u.some(g=>Math.abs((g[0]-s.origin[0])*s.u[1]-(g[1]-s.origin[1])*s.u[0])>=.8))continue;let d=u.map(g=>$l(s,[g[0],0,g[1]])),h=Math.max(0,Math.min(...d)),f=Math.min(s.length,Math.max(...d));f-h>1e-8&&r.push({record:l,startM:h,endM:f})}let a=[...new Set([0,s.length,...r.flatMap(l=>[l.startM,l.endM])])].sort((l,c)=>l-c),o=[];for(let l=0;l<a.length-1;l++){let c=a[l],u=a[l+1];if(u-c<1e-8)continue;let d=(c+u)/2,h=r.filter(m=>m.startM<=d&&m.endM>=d),f=h.filter(m=>m.record.review?.placement==="accepted"),g=f.length?f:h,M=g.length===1?g[0].record:null;o.push({startM:c,endM:u,observation:M,candidateIds:h.map(m=>m.record.id).sort(),status:M?f.length?"human":"machine":g.length?"conflict":"uncovered"})}return{axis:s,sourceSurfaceIndex:e,intervals:o}}function ou(n,e,t,i){function s(a,o,l){let c=[];for(let u=0;u<a.length;u++){let d=a[u],h=a[(u+1)%a.length],f=l*($l(e,d)-o),g=l*($l(e,h)-o);if(f>=0&&c.push(d),f>=0!=g>=0){let M=f/(f-g);c.push(d.map((m,p)=>m+(h[p]-m)*M))}}return c}let r=[];for(let a=0;a<n.length;a+=9){let o=[n.slice(a,a+3),n.slice(a+3,a+6),n.slice(a+6,a+9)];o=s(s(o,t,1),i,-1);for(let l=1;l<o.length-1;l++){let[c,u,d]=[o[0],o[l],o[l+1]],h=u.map((g,M)=>g-c[M]),f=d.map((g,M)=>g-c[M]);Math.hypot(h[1]*f[2]-h[2]*f[1],h[2]*f[0]-h[0]*f[2],h[0]*f[1]-h[1]*f[0])>1e-10&&r.push(...c,...u,...d)}}return r}function lr(n,e,t){if(!n)return null;let i=c=>[e.origin[0]+e.u[0]*c,e.origin[1]+e.u[1]*c],s=[t.startM,t.endM].map(i).map(c=>(c[0]-n.a[0])*n.u[0]+(c[1]-n.a[1])*n.u[1]),r=Math.max(0,Math.min(...s)),a=Math.min(n.width,Math.max(...s));if(a-r<1e-8)return null;let o=[n.a[0]+n.u[0]*r,n.a[1]+n.u[1]*r],l=a-r;return{...n,a:o,width:l,mid:[o[0]+n.u[0]*l/2,o[1]+n.u[1]*l/2],polygon:n.polygon.map(c=>[c[0]-r,c[1]]),holes:(n.holes||[]).map(c=>c.map(u=>[u[0]-r,u[1]])),intervalBounded:!0,observation:t.observation,intervalStatus:t.status}}function __(n,e,t){let i=t[0]-e[0],s=t[1]-e[1],r=Math.hypot(i,s);return r<1e-7?Math.hypot(n[0]-e[0],n[1]-e[1])<=1e-7:Math.abs((n[0]-e[0])*s-(n[1]-e[1])*i)<=1e-7*r&&(n[0]-e[0])*i+(n[1]-e[1])*s>=-1e-7*r&&(n[0]-t[0])*i+(n[1]-t[1])*s<=1e-7*r}function lu(n,e){let t=!1;for(let i=0,s=e.length-1;i<e.length;s=i++){let r=e[s],a=e[i];if(__(n,r,a))return{inside:!1,boundary:!0};r[1]>n[1]!=a[1]>n[1]&&n[0]<(a[0]-r[0])*(n[1]-r[1])/(a[1]-r[1])+r[0]&&(t=!t)}return{inside:t,boundary:!1}}function x_(n,e,t){let i=0,s=1;for(let r=0;r<2;r++){let a=t[r]+1e-7,o=t[r+2]-1e-7,l=e[r]-n[r];if(a>=o)return!1;if(Math.abs(l)<1e-7){if(n[r]<=a||n[r]>=o)return!1;continue}let c=(a-n[r])/l,u=(o-n[r])/l;if(i=Math.max(i,Math.min(c,u)),s=Math.min(s,Math.max(c,u)),i>s)return!1}return i<=s}function Zt(n,e,t,i,s){if(![e,t,i,s].every(Number.isFinite)||i<=0||s<=0)return!1;let r=[e-i/2,t-s/2,e+i/2,t+s/2];if(n.intervalBounded&&(r[0]<-1e-7||r[2]>n.width+1e-7))return!1;let a=[n.polygon,...n.holes||[]];if(a.some(l=>!Array.isArray(l)||l.length<3||l.some(c=>!Array.isArray(c)||c.length<2||!c.slice(0,2).every(Number.isFinite))))return!1;let o=[[r[0],r[1]],[r[0],r[3]],[r[2],r[1]],[r[2],r[3]]];return o.some(l=>{let c=lu(l,a[0]);return!c.inside&&!c.boundary})||a.slice(1).some(l=>o.some(c=>lu(c,l).inside))?!1:!a.some(l=>l.some((c,u)=>x_(c,l[(u+1)%l.length],r)))}function y_(n){let e=n.awningEvidence;if(!e||e.origin!=="agent-visual-review"||e.derivationKey!==n.derivationKey||e.buildingMatch!=="yes"||e.appearanceEligible!==!0)return null;let t=Object.values(n.images||{});return!Array.isArray(e.images)||!e.images.length||!e.images.every(i=>t.some(s=>i.file===s.file&&i.sha256===s.sha256&&(!i.panoramaSha256||i.panoramaSha256===s.panoramaSha256)))?null:e.awningObservation||null}function cu(n){let e=n.review;if(e?.placement!=="accepted"||e.targetId!==n.id||n.effectiveProposal?.awning!=="yes"||n.effectiveProposal?.wholeUsable==="no")return!1;if(e.awningKind!==void 0||e.awningDeployment!==void 0)return e.awningKind==="fabric"&&e.awningDeployment==="deployed";let t=y_(n);return t?.presence==="yes"&&t.fabricAwningPresence==="yes"&&t.kind==="fabric"&&t.observedDeployment==="deployed"}var ui={minimumWidthM:.65,minimumPairedWidthM:1.1,minimumHeightM:1.8,maximumGroundGapM:.3,maximumWidthGrowthM:.2,maximumHeightGrowthM:.25};function hu(n,e){let t={feature:n,adjustments:[]};if(n.kind!=="door"||!Number.isFinite(e)||n.thresholdHeightM!==void 0||n.disposition==="human-reviewed")return t;let i=n.y-n.height/2,s=n.y+n.height/2,r=i-e;if(r<-1e-6||r>ui.maximumGroundGapM+1e-6)return t;let a=n.paired?ui.minimumPairedWidthM:ui.minimumWidthM;if(n.width<a-ui.maximumWidthGrowthM||n.height<ui.minimumHeightM-ui.maximumHeightGrowthM-r)return t;let o=[],l=i,c=s,u=n.width;if(r>1e-6&&(l=e,o.push("door-ground-extension")),u<a&&(u=a,o.push("door-minimum-width")),c-l<ui.minimumHeightM&&(c=l+ui.minimumHeightM,o.push("door-minimum-height")),!o.length)return t;let d=c-l,h={...n,width:u,height:d,y:(c+l)/2};for(let f of["archRise","lintelRise","transom"])n[f]!==void 0&&(h[f]=n[f]*n.height/d);return n.topCornerRadius!==void 0&&(h.topCornerRadius=n.topCornerRadius*Math.min(n.width,n.height)/Math.min(u,d)),{feature:h,adjustments:o}}var uu=(n,e)=>JSON.stringify(n)===JSON.stringify(e);function Ei(n,e,t,i){let s=n.facadeDescription;if(!s||s.version!==1||!s.extractionVersion||s.buildingId!==e.id||s.geometryRevision!==e.geometryRevision||s.evidenceKey!==n.evidenceKey||!s.surfaceIndices?.includes(t)||!uu(s.frontage,[n.localStart,n.localEnd])||n.machineRevocation?.revoked||["rejected","uncertain","crop-repair"].includes(n.review?.placement))return null;let r=s.sources?.[i],a=n.images?.[i];if(!r||!/^[a-f0-9]{64}$/i.test(r.cropSha256)||r.cropSha256!==a?.sha256||!r.captureDate||r.captureDate!==(a.date??a.capturedAt)||!Number.isInteger(r.imageDimensions?.width)||!Number.isInteger(r.imageDimensions?.height)||r.imageDimensions.width<=0||r.imageDimensions.height<=0||r.imageDimensions.width!==a?.width||r.imageDimensions.height!==a?.height||!Array.isArray(r.features)||r.features.length>256||new Set(r.features.map(c=>c.id)).size!==r.features.length)return null;let o=Object.values(s.sources).flatMap(c=>Array.isArray(c?.features)?c.features.map(u=>u.id):[]);if(new Set(o).size!==o.length)return null;let l=r.registration;return!l||l.status!=="registered"||l.surfaceIndex!==t||!Number.isFinite(l.uncertaintyM)||l.uncertaintyM<0||l.uncertaintyM>.15||l.imageToWall?.length!==9||!l.imageToWall.every(Number.isFinite)||l.sourceDatum&&l.sourceDatum!=="NAP"||l.canonicalDatum&&l.canonicalDatum!=="surface-base"||l.pixelConvention&&l.pixelConvention!=="pixel-edge"||l.wallDirection&&(!Array.isArray(l.wallDirection)||l.wallDirection.length!==2||!l.wallDirection.every(Number.isFinite)||Math.abs(Math.hypot(...l.wallDirection)-1)>.001)||!l.alignment||l.alignment.wallIdentity!=="verified"||l.alignment.boundaryEvidence!==!0||l.alignment.rooflineEvidence!==!0||l.alignment.cameraHeightResolved!==!0||l.alignment.orientationVerified!==!0?null:r}function cr(n,e,t,i){let s=n.facadeDescription;if(!s||s.version!==1||!s.extractionVersion||s.buildingId!==e.id||s.geometryRevision!==e.geometryRevision||s.evidenceKey!==n.evidenceKey||!s.surfaceIndices?.includes(t)||!uu(s.frontage,[n.localStart,n.localEnd])||n.machineRevocation?.revoked||["rejected","uncertain","crop-repair"].includes(n.review?.placement))return null;let r=s.sources?.[i],a=n.images?.[i],o=r?.registration,l=o?.preview;return!r||!a||!/^[a-f0-9]{64}$/i.test(r.cropSha256)||r.cropSha256!==a.sha256||r.captureDate!==(a.date??a.capturedAt)||!Number.isInteger(r.imageDimensions?.width)||!Number.isInteger(r.imageDimensions?.height)||r.imageDimensions.width<=0||r.imageDimensions.height<=0||r.imageDimensions.width!==a.width||r.imageDimensions.height!==a.height||!Array.isArray(r.features)||r.features.length>256||new Set(r.features.map(c=>c.id)).size!==r.features.length||o?.status!=="ambiguous"||o.surfaceIndex!==t||o.sourceDatum!=="NAP"||o.canonicalDatum!=="surface-base"||o.pixelConvention!=="pixel-edge"||!l||l.kind!=="native-crop-plane"||l.cropSha256!==r.cropSha256||l.imageDimensions?.width!==r.imageDimensions.width||l.imageDimensions?.height!==r.imageDimensions.height||!Array.isArray(l.imageToWall)||l.imageToWall.length!==9||!l.imageToWall.every(Number.isFinite)||!l.note?.trim()?null:{...r,registration:{...o,imageToWall:l.imageToWall,uncertaintyM:.15}}}function hs(n,e,t){let i=t.review?.facadeFeatures?.[n.id];if(n.disposition==="revoked"||i?.disposition==="revoked"||t.featureRevocations?.[n.id]||t.visualReview?.fieldEligibility?.[n.id]===!1&&i?.disposition!=="human-reviewed")return null;let s=i?.disposition==="human-reviewed"?{...n,...i}:n;if(!["machine-observed-unreviewed","agent-inspected","human-reviewed"].includes(s.disposition)||s.signMount!==void 0&&(!["wall","glazing"].includes(s.signMount)||s.kind!=="fascia")||s.doorStyle!==void 0&&(!["panelled","glazed","plain"].includes(s.doorStyle)||s.kind!=="door")||s.doorFurniture!==void 0&&(!["knob","pull","none"].includes(s.doorFurniture)||s.kind!=="door")||s.doorGlazingRatio!==void 0&&(s.kind!=="door"||s.doorStyle!=="glazed"||!Number.isFinite(s.doorGlazingRatio)||s.doorGlazingRatio<.35||s.doorGlazingRatio>.95)||!s.id||!Array.isArray(s.bounds)||s.bounds.length!==4||!s.bounds.every(Number.isFinite)||s.archRise!==void 0&&(!Number.isFinite(s.archRise)||s.archRise<=0||s.archRise>.5||!["rounded","segmental"].includes(s.head??""))||s.lintelRise!==void 0&&(!Number.isFinite(s.lintelRise)||s.lintelRise<=0||s.lintelRise>.5||!["rounded","segmental"].includes(s.lintelHead??""))||s.topCornerRadius!==void 0&&(!Number.isFinite(s.topCornerRadius)||s.topCornerRadius<=0||s.topCornerRadius>.25||s.head!=="rectangular"))return null;let[r,a,o,l]=s.bounds;if(r<0||a<0||o<=r||l<=a)return null;let c=Object.values(t.images??{}).find(v=>v.sha256===e.cropSha256);if(o>e.imageDimensions.width||l>e.imageDimensions.height)return null;let u=e.registration.imageToWall,d=[[r,a],[o,a],[o,l],[r,l]],h=d.map(([v,E])=>u[6]*v+u[7]*E+u[8]);if(h.some(v=>Math.abs(v)<1e-8)||h.some(v=>Math.sign(v)!==Math.sign(h[0])))return null;let f=d.map(([v,E],_)=>[(u[0]*v+u[1]*E+u[2])/h[_],(u[3]*v+u[4]*E+u[5])/h[_]]),g=Math.max(.03,e.registration.uncertaintyM);if(Math.max(Math.abs(f[0][1]-f[1][1]),Math.abs(f[2][1]-f[3][1]),Math.abs(f[0][0]-f[3][0]),Math.abs(f[1][0]-f[2][0]))>g)return null;let M=f.map(v=>v[0]),m=f.map(v=>v[1]),p=Math.max(...M)-Math.min(...M),R=Math.max(...m)-Math.min(...m);if(![p,R,...M,...m].every(Number.isFinite)||p<=.02||R<=.02)return null;let A=f[0][0]>f[1][0]&&Array.isArray(s.mullions)?s.mullions.map(v=>1-v).sort((v,E)=>v-E):s.mullions;return{...s,...A?{mullions:A}:{},t:(Math.min(...M)+Math.max(...M))/2,y:(Math.min(...m)+Math.max(...m))/2,width:p,height:R,uncertaintyM:e.registration.uncertaintyM}}function hr(n,e,t="rectangular",i,s){let r=n/2,a=-e/2,o=e/2;if(t==="rectangular"&&Number.isFinite(s)&&s>0){let h=Math.min(n,e)*s,f=Array.from({length:5},(M,m)=>{let p=m*Math.PI/8;return[r-h+Math.cos(p)*h,o-h+Math.sin(p)*h]}),g=Array.from({length:5},(M,m)=>{let p=Math.PI/2+m*Math.PI/8;return[-r+h+Math.cos(p)*h,o-h+Math.sin(p)*h]});return[[-r,a],[r,a],[r,o-h],...f.slice(1),...g.slice(1),[-r,o-h]]}if(!["rounded","segmental"].includes(t))return[[-r,a],[r,a],[r,o],[-r,o]];let l=Number.isFinite(i)&&i>0&&i<=.5?e*i:void 0,c=Math.min(l??(t==="rounded"?r:n*.2),e*.5),u=o-c,d=Array.from({length:13},(h,f)=>{let g=f*Math.PI/12;return[Math.cos(g)*r,u+Math.sin(g)*c]});return[[-r,a],[r,a],...d]}function du(n,e){let t=[];for(let s=0;s<n.length;s++){let r=n[s],a=n[(s+1)%n.length];(r[1]<=e&&e<a[1]||a[1]<=e&&e<r[1])&&t.push(r[0]+(a[0]-r[0])*(e-r[1])/(a[1]-r[1]))}t.sort((s,r)=>s-r);let i=[];for(let s=0;s+1<t.length;s+=2)t[s+1]-t[s]>.001&&i.push([t[s],t[s+1]]);return i}function fu(n,e){let t=[];for(let i=0;i<n.length;i++){let s=n[i],r=n[(i+1)%n.length];(s[0]<=e&&e<r[0]||r[0]<=e&&e<s[0])&&t.push(s[1]+(r[1]-s[1])*(e-s[0])/(r[0]-s[0]))}return t.length<2?null:(t.sort((i,s)=>i-s),[t[0],t[t.length-1]])}var xo={windowGlass:"#526a6b",windowGlassBlue:"#4b6268",windowGlassWarm:"#62685d",windowFrame:"#ddd8c7",windowFrameDark:"#676963",doorWood:"#3f342d",shopGlass:"#354a4b",awningFabric:"#807765",facadeTrimLight:"#b9ad96",facadeTrimDark:"#61584e"};function jl(n,e){let t=!1;for(let i=0,s=e.length-1;i<e.length;s=i++){let r=e[i],a=e[s];r[1]>n[1]!=a[1]>n[1]&&n[0]<(a[0]-r[0])*(n[1]-r[1])/(a[1]-r[1])+r[0]&&(t=!t)}return t}function Ql(n,e){return(e.type==="Polygon"?[e.coordinates]:e.coordinates).some(i=>jl(n,i[0])&&!i.slice(1).some(s=>jl(n,s)))}var pu=new WeakMap;function v_(n,e,t){let i=pu.get(t);if(!i){i=new Map;for(let r of t){let a=r.geometry.building.footprint,o=a.type==="Polygon"?[a.coordinates]:a.coordinates,l=o.flat(2),c=r.geometry.frame.originRD,u=l.map(h=>h[0]+c.x),d=l.map(h=>c.y-h[1]);for(let h=Math.floor(Math.min(...u)/32);h<=Math.floor(Math.max(...u)/32);h++)for(let f=Math.floor(Math.min(...d)/32);f<=Math.floor(Math.max(...d)/32);f++){let g=`${h},${f}`,M=i.get(g)??[];M.push(r),i.set(g,M)}}pu.set(t,i)}let s=e.geometry.frame.originRD;return i.get(`${Math.floor((n[0]+s.x)/32)},${Math.floor((s.y-n[1])/32)}`)??[]}function bu(n,e,t){let i=e.geometry.frame.originRD;return v_(n,e,t).some(s=>{if(s.id===e.id)return!1;let r=s.geometry.frame.originRD;return Ql([n[0]+i.x-r.x,n[1]+r.y-i.y],s.geometry.building.footprint)})}function di(n,e,t,i,s){return[-.5,0,.5].every(r=>{let a=e+t*r;return!bu([n.a[0]+n.u[0]*a+n.n[0]*.08,n.a[1]+n.u[1]*a+n.n[1]*.08],i,s)})}function ds(n,e,t){let i=Kl(n);if(!i||i.length<1.5||n.rings.flat().some(d=>Math.abs((d[0]-i.origin[0])*i.u[1]-(d[2]-i.origin[1])*i.u[0])>.1))return null;let s=i.origin,r=i.u,a=[s[0]+r[0]*i.length/2,s[1]+r[1]*i.length/2],o=[-r[1],r[0]],l=(d,h)=>[a[0]+d[0]*h,a[1]+d[1]*h];if(Ql(l(o,.25),e.geometry.building.footprint)&&(o=o.map(d=>-d)),Ql(l(o,.25),e.geometry.building.footprint)||bu(l(o,.25),e,t))return null;let c=d=>[(d[0]-s[0])*r[0]+(d[2]-s[1])*r[1],d[1]],u=n.rings.map(d=>d.map(c));return{a:s,u:r,n:o,width:i.length,bottom:Math.min(...u[0].map(d=>d[1])),top:Math.max(...u[0].map(d=>d[1])),polygon:u[0],holes:u.slice(1)}}var mu=new WeakMap;function b_(n,e){let t=mu.get(n);if(t!==void 0)return t;let i=-1,s=0;return n.geometry.building.surfaces.forEach((r,a)=>{if(r.type!=="wall")return;let o=ds(r,n,e);o&&o.width>s&&(s=o.width,i=a)}),mu.set(n,i),i}var Mu=(n,e)=>{let t=n.images?.[e];return!!t&&/^[a-f0-9]{64}$/i.test(t.sha256??"")&&/^[a-f0-9]{64}$/i.test(t.panoramaSha256??"")},M_=n=>!["rejected","uncertain","crop-repair"].includes(n.review?.placement);function yo(n){return n.flatMap(e=>e.observations.filter(t=>{let i=t.payload;return t.buildingId===e.id&&t.geometryRevision===e.geometryRevision&&t.evidenceKey&&i?.evidenceKey===t.evidenceKey&&i?.derivationKey&&i.renderBuildingId===e.id&&!i.machineRevocation?.revoked&&M_(i)}).map(t=>t.payload))}function gu(n){return!Mu(n,"ground")||!["yes","no"].includes(n.effectiveProposal?.shopfront)?!1:n.review?.placement==="accepted"&&n.proposalSources?.shopfront==="human-review"?!0:n.visualReview?.fieldEligibility?.shopfront===!1?!1:n.visualReview?.fieldEligibility?.shopfront===!0||n.effectiveProposal?.groundUsable==="yes"}function S_(n){return Mu(n,"full")&&n.effectiveProposal?.wholeUsable==="yes"&&n.visualReview?.appearanceEligible!==!1}var yt=(n,e,t,i)=>[n.a[0]+n.u[0]*e+n.n[0]*i,t,n.a[1]+n.u[1]*e+n.n[1]*i];function tt(n,e,t,i,s,r){let a=[[e-i/2,t-s/2],[e+i/2,t-s/2],[e+i/2,t+s/2],[e-i/2,t+s/2]].map(([l,c])=>yt(n,l,c,r));return(-n.u[1]*n.n[0]+n.u[0]*n.n[1]>=0?[0,1,2,0,2,3]:[0,2,1,0,3,2]).flatMap(l=>a[l])}var dr=n=>n.reduce((e,t,i)=>{let s=n[(i+1)%n.length];return e+t[0]*s[1]-s[0]*t[1]},0);function Su(n){let e=0;for(let t=0;t<n.length;t++){let i=n[t],s=n[(t+1)%n.length],r=n[(t+2)%n.length],a=(s[0]-i[0])*(r[1]-s[1])-(s[1]-i[1])*(r[0]-s[0]);if(Math.abs(a)<1e-9)continue;let o=Math.sign(a);if(e&&o!==e)return!1;e=o}return e!==0}function _u(n,e){if(e.length<3||Math.abs(dr(e))<1e-8)return[];let t=Math.sign(dr(e)),i=n;for(let s=0;s<e.length;s++){let r=e[s],a=e[(s+1)%e.length],o=i;i=[];let l=c=>(a[0]-r[0])*(c[1]-r[1])-(a[1]-r[1])*(c[0]-r[0]);for(let c=0;c<o.length;c++){let u=o[c],d=o[(c+1)%o.length],h=l(u),f=l(d),g=t*h>=-1e-8,M=t*f>=-1e-8;if(g&&i.push(u),g!==M){let m=h/(h-f);i.push([u[0]+(d[0]-u[0])*m,u[1]+(d[1]-u[1])*m])}}}return i}var us=(n,e,t)=>(e[0]-n[0])*(t[1]-n[1])-(e[1]-n[1])*(t[0]-n[0]),w_=(n,e)=>e.some((t,i)=>{let s=e[(i+1)%e.length];return Math.abs(us(t,s,n))<1e-8&&n[0]>=Math.min(t[0],s[0])-1e-8&&n[0]<=Math.max(t[0],s[0])+1e-8&&n[1]>=Math.min(t[1],s[1])-1e-8&&n[1]<=Math.max(t[1],s[1])+1e-8}),fr=(n,e)=>w_(n,e)||jl(n,e),T_=(n,e,t,i)=>{let s=Math.sign(us(e,t,i));return s*us(e,t,n)>=-1e-8&&s*us(t,i,n)>=-1e-8&&s*us(i,e,n)>=-1e-8};function E_(n,e,t){let i=[e[0]-n[0],e[1]-n[1]],s=i[0]*i[0]+i[1]*i[1];if(s<1e-16)return fr(n,t);let r=[0,1];for(let a=0;a<t.length;a++){let o=t[a],l=t[(a+1)%t.length],c=[l[0]-o[0],l[1]-o[1]],u=[o[0]-n[0],o[1]-n[1]],d=i[0]*c[1]-i[1]*c[0];if(Math.abs(d)<1e-12){if(Math.abs(u[0]*i[1]-u[1]*i[0])<1e-10)for(let g of[o,l])r.push(Math.max(0,Math.min(1,((g[0]-n[0])*i[0]+(g[1]-n[1])*i[1])/s)));continue}let h=(u[0]*c[1]-u[1]*c[0])/d,f=(u[0]*i[1]-u[1]*i[0])/d;h>=-1e-10&&h<=1+1e-10&&f>=-1e-10&&f<=1+1e-10&&r.push(Math.max(0,Math.min(1,h)))}return r.sort((a,o)=>a-o),r.every((a,o)=>o===r.length-1||fr([n[0]+i[0]*(a+r[o+1])/2,n[1]+i[1]*(a+r[o+1])/2],t))}var A_=(n,e)=>n.every((t,i)=>fr(t,e)&&E_(t,n[(i+1)%3],e));function R_(n){let e=n.filter((r,a)=>a===0||Math.abs(r[0]-n[a-1][0])>1e-10||Math.abs(r[1]-n[a-1][1])>1e-10);e.length>2&&Math.abs(e[0][0]-e.at(-1)[0])<1e-10&&Math.abs(e[0][1]-e.at(-1)[1])<1e-10&&e.pop();let t=Math.sign(dr(e));if(e.length<3||!t)return[];let i=e.map((r,a)=>a),s=[];for(;i.length>3;){let r=-1;for(let a=0;a<i.length;a++){let o=i[(a+i.length-1)%i.length],l=i[a],c=i[(a+1)%i.length],u=e[o],d=e[l],h=e[c];if(!(t*us(u,d,h)<=1e-10)&&!i.some(f=>f!==o&&f!==l&&f!==c&&T_(e[f],u,d,h))){r=a,s.push([u,d,h]);break}}if(r<0)return[];i.splice(r,1)}return s.push(i.map(r=>e[r])),s}var xu=new WeakMap;function wu(n,e){if(Su(e)){let i=_u(n,e);return i.length>=3&&Math.abs(dr(i))>1e-10?[i]:[]}let t=xu.get(e);return t||(t=R_(e),xu.set(e,t)),t.map(i=>_u(n,i)).filter(i=>i.length>=3&&Math.abs(dr(i))>1e-10)}function C_(n,e,t,i,s,r){let a=[];for(let o of wu([[e-i/2,t-s/2],[e+i/2,t-s/2],[e+i/2,t+s/2],[e-i/2,t+s/2]],n.polygon))for(let l=1;l<o.length-1;l++){let c=[o[0],o[l],o[l+1]],u=[c.reduce((d,h)=>d+h[0],0)/3,c.reduce((d,h)=>d+h[1],0)/3];n.holes.some(d=>fr(u,d))||a.push(...c.flatMap(([d,h])=>yt(n,d,h,r)))}return a}function Jl(n,e,t){return n.flatMap((i,s)=>{if(s%3!==0)return[];let r=(n[s]-e.a[0])*e.u[0]+(n[s+2]-e.a[1])*e.u[1],a=n[s+1],o=(r-t.left)/(t.right-t.left);return t.sourceXForward||(o=1-o),[Math.max(0,Math.min(1,o)),Math.max(0,Math.min(1,(a-t.bottom)/(t.top-t.bottom)))]})}function P_(n,e){let t=[];for(let i=0;i<n.length;i+=9){let s=[0,1,2].map(c=>n.slice(i+c*3,i+c*3+3)),r=s.map(c=>[(c[0]-e.a[0])*e.u[0]+(c[2]-e.a[1])*e.u[1],c[1]]);if(!e.holes.length&&A_(r,e.polygon)){t.push(...s.flat());continue}let a=s.map(c=>(c[0]-e.a[0])*e.n[0]+(c[2]-e.a[1])*e.n[1]),o=(r[1][1]-r[2][1])*(r[0][0]-r[2][0])+(r[2][0]-r[1][0])*(r[0][1]-r[2][1]),l=(c,u)=>{if(Math.abs(o)<1e-12)return a[0];let d=((r[1][1]-r[2][1])*(c-r[2][0])+(r[2][0]-r[1][0])*(u-r[2][1]))/o,h=((r[2][1]-r[0][1])*(c-r[2][0])+(r[0][0]-r[2][0])*(u-r[2][1]))/o;return d*a[0]+h*a[1]+(1-d-h)*a[2]};for(let c of wu(r,e.polygon))for(let u=1;u<c.length-1;u++){let d=[c[0],c[u],c[u+1]],h=[d.reduce((f,g)=>f+g[0],0)/3,d.reduce((f,g)=>f+g[1],0)/3];e.holes.some(f=>fr(h,f))||t.push(...d.flatMap(([f,g])=>yt(e,f,g,l(f,g))))}}return t}function ur(n,e,t,i,s,r,a){return[...tt(n,e,t-s/2-r/2,i+2*r,r,a),...tt(n,e,t+s/2+r/2,i+2*r,r,a),...tt(n,e-i/2-r/2,t,r,s,a),...tt(n,e+i/2+r/2,t,r,s,a)]}function I_(n,e,t,i,s,r,a=l=>!0,o=!1){let l=[],c=n.geometryRevision==="source-space-unregistered",u=o&&i.facadeDescription?.extractionVersion==="source-facade-owner-candidate/v1",d=o&&["case24-source-facade-candidate/v4-doors-and-display","source-facade-owner-candidate/v1"].includes(i.facadeDescription?.extractionVersion)&&s.registration?.status==="ambiguous"&&s.registration?.preview?.kind==="native-crop-plane",h=new Set,f=new Set,g=Number.isFinite(n.geometry.building.groundNAP)&&["NAP","legacy-block-NAP-minus-0.65m"].includes(n.geometry.frame.heightDatum)?ci(n.geometry.building.groundNAP,n.geometry.frame.heightDatum)-e.bottom:void 0,M=(p,R)=>/^#[a-f0-9]{6}$/i.test(p??"")?p:R,m=(t.a[0]-e.a[0])*e.u[0]+(t.a[1]-e.a[1])*e.u[1];for(let p of s.features??[]){if(!a(p))continue;let R=i.facadeDescription?.concaveMaterialPreview,A=R?.sourceCropSha256===s.cropSha256&&R?.featureIds?.includes(p.id);if(u&&p.kind==="material"&&!Su(t.polygon)&&!A)continue;let v=hs(p,s,i);if(!v)continue;let E=hu(v,g);if(E.adjustments.length){let re=E.feature,H=re.lintelHead||re.surroundColour?.length?.14:.07;(!Zt(t,re.t-m,re.y+e.bottom+H/2,re.width+H*2,re.height+H)||!di(t,re.t-m,re.width+H*2,n,r))&&(E={feature:v,adjustments:[]})}let _=E.feature,P=d&&Array.isArray(_.bounds)?(()=>{let re=s.registration.imageToWall,[H,ie,Q,we]=_.bounds,Te=(H+Q)/2,J=(ie+we)/2,ce=(ke,Xe)=>{let He=re[6]*ke+re[7]*Xe+re[8];return Math.abs(He)>1e-8?[(re[0]*ke+re[1]*Xe+re[2])/He,(re[3]*ke+re[4]*Xe+re[5])/He]:null},oe=ce(Te,J),Se=ce(Te+1,J),Le=ce(Te,J+1);if(!oe||!Se||!Le)return;let Ue=Math.hypot(Se[0]-oe[0],Se[1]-oe[1]),Ke=Math.hypot(Le[0]-oe[0],Le[1]-oe[1]),Ve=(Ue+Ke)/2;return Number.isFinite(Ve)&&Ve>0&&Ve<.1?Ve:void 0})():void 0,y=c?.01:P,C=y&&Number.isFinite(_.sourceFrameWidthPx)&&_.sourceFrameWidthPx>0&&_.sourceFrameWidthPx<=12?_.sourceFrameWidthPx*y:void 0,w=y&&Number.isFinite(_.sourceJoineryWidthPx)&&_.sourceJoineryWidthPx>0&&_.sourceJoineryWidthPx<=12?_.sourceJoineryWidthPx*y:void 0,T=C??.14,D=w??.065,B=w?.008:.08,L=_.t-m,I=_.y+e.bottom,G=_.kind==="window"||_.kind==="door",N=G?_.lintelHead||_.surroundColour?.length?.14:.07:0,k=E.adjustments.length>0,$=Zt(t,L,I+(k?N/2:0),_.width+N*2,_.height+N*(k?1:2))&&di(t,L,_.width+N*2,n,r),j=G&&!$&&o;if((G||_.kind==="awning")&&!$&&!j)continue;let ne=_.kind==="door"?"observed-door":_.kind==="window"?"observed-window":_.kind==="awning"?"observed-awning":_.kind==="fascia"?"observed-fascia":"observed-material",ae=`${n.id}:${i.id}:${_.id}`;j&&h.add(ae),k&&f.add(ae);let ve=(re,H)=>l.push({triangles:re,colour:H,observationId:i.id,featureId:ae,featureKind:ne,styleSource:_.disposition,...k?{heuristics:E.adjustments}:{},..._.kind==="material"&&_.material==="brick"?{material:"brick"}:{}}),Ne=(re,H,ie,Q)=>[re,H,ie].flatMap(([we,Te])=>yt(t,L+we,I+Te,Q));if(G){if(!_.head||_.head==="unknown")continue;let re=hr(_.width,_.height,_.head,_.archRise,_.topCornerRadius),H=hr(_.width+T,_.height+T,_.head,_.archRise,_.topCornerRadius);for(let J=1;J<re.length-1;J++)ve(Ne(re[0],re[J],re[J+1],.032),M(_.colour,_.kind==="door"?"doorWood":"windowGlass"));for(let J=0;J<re.length;J++){let ce=(J+1)%re.length;ve([...Ne(re[J],H[J],H[ce],.072),...Ne(re[J],H[ce],re[ce],.072)],M(_.frameColour,"windowFrame"))}for(let J=0;J<re.length;J++){let ce=(J+1)%re.length,oe=yt(t,L+re[J][0],I+re[J][1],.032),Se=yt(t,L+re[ce][0],I+re[ce][1],.032),Le=yt(t,L+re[ce][0],I+re[ce][1],.072),Ue=yt(t,L+re[J][0],I+re[J][1],.072);ve([...oe,...Se,...Le,...oe,...Le,...Ue],M(_.frameColour,"windowFrame"))}if(_.kind==="window"&&ve(tt(t,L,I-_.height/2-T/4,_.width+T,T/2,.095),M(_.frameColour,"windowFrame")),_.kind==="door"&&_.transom&&_.transom>0&&_.transom<.6){let J=_.height*(.5-_.transom),ce=[];for(let oe=0;oe<re.length;oe++){let Se=re[oe],Le=re[(oe+1)%re.length];Se[1]>=J&&ce.push(Se),Se[1]>=J!=Le[1]>=J&&ce.push([Se[0]+(Le[0]-Se[0])*(J-Se[1])/(Le[1]-Se[1]),J])}for(let oe=1;oe<ce.length-1;oe++)ve(Ne(ce[0],ce[oe],ce[oe+1],.04),"windowGlass")}let ie=_.transom&&_.transom>0&&_.transom<.6?_.height*(.5-_.transom):void 0,Q=_.opaqueHeadAboveTransom;if(d&&Q===!0&&_.kind==="window"&&_.head==="rectangular"&&ie!==void 0){let J=_.height/2-ie;J>0&&ve(tt(t,L,I+ie+J/2,_.width,J,.04),"windowFrameDark")}let we=J=>{let ce=fu(re,J);if(!ce)return;let oe=(c||d)&&_.mullionScope==="below-transom"&&_.kind==="window"&&ie!==void 0?Math.min(ce[1],ie):ce[1],Se=w?oe-ce[0]-B:Math.max(.02,oe-ce[0]-.08);Se>0&&ve(tt(t,L+J,I+(ce[0]+oe)/2,D,Se,.078),M(_.frameColour,"windowFrame"))},Te=J=>{for(let[ce,oe]of du(re,J))ve(tt(t,L+(ce+oe)/2,I+J,oe-ce,D,.078),M(_.frameColour,"windowFrame"))};_.paired&&we(0),ie!==void 0&&Te(ie);for(let J of _.mullions??[])J>0&&J<1&&we(_.width*(J-.5));if(_.kind==="door"){let J=_.doorStyle??"panelled",ce=_.doorFurniture??"knob",oe=J==="glazed"&&_.doorGlazingRatio!==void 0,Se=-_.height/2,Le=oe&&!_.transom?_.height*.5-(_.archRise??0)*_.height-.05:Math.min(_.height*(.5-(_.transom??.12)),_.height*.5-(_.archRise??0)*_.height)-.1,Ue=_.paired?2:1,Ke=_.width/Ue,Ve=Le-Se,ke=(Xe,He,rt)=>{ve(Xe,He);let F=l[l.length-1];F.styleSource="procedural-prior-not-measured",F.heuristics=[...F.heuristics??[],rt]};if(oe&&Ve>.65){let Xe=Ve*_.doorGlazingRatio,He=Math.max(.08,_.width-Math.min(.04,_.width*.1));ve(tt(t,L,I+Le-Xe/2,He,Xe,.04),"windowGlass")}else if(Ve>.65&&Ke>.36)for(let Xe=0;Xe<Ue;Xe++){let He=-_.width/2+Ke*(Xe+.5),rt=Ke*.68,F=(S,x,z=!1)=>{ke(ur(t,L+He,I+S,rt,x,.025,.083),"#655e50","door-panel-grammar"),ke(tt(t,L+He,I+S,rt,x,.081),z?"windowGlass":M(_.colour,"doorWood"),"door-panel-grammar")};J==="glazed"?(F(Se+Ve*.63,Ve*.53,!0),F(Se+Ve*.19,Ve*.19)):J==="panelled"&&(F(Se+Ve*.27,Ve*.32),F(Se+Ve*.7,Ve*.36));let at=He+(Ue===2?Xe===0?1:-1:1)*Ke*.34,We=Se+Math.min(1.02,Ve*.55);if(ce==="knob"){let S=Math.min(.035,Ke*.05),x=[];for(let W=0;W<10;W++){let Z=W*Math.PI/5;x.push(yt(t,L+at+Math.cos(Z)*S,I+We+Math.sin(Z)*S,.115))}let z=yt(t,L+at,I+We,.135);ke(x.flatMap((W,Z)=>[...z,...W,...x[(Z+1)%x.length]]),"#b4a17a","door-furniture-grammar")}else ce==="pull"&&ke(tt(t,L+at,I+We,.026,Math.min(.28,Ve*.2),.12),"#b8b9b4","door-furniture-grammar");J==="panelled"&&Xe===0&&ke(tt(t,L+He,I+Se+Ve*.49,Math.min(.24,rt*.65),.035,.11),"#aaa18a","door-furniture-grammar")}}if(_.lintelHead||_.surroundColour){let J=hr(_.width+.14,_.height+.14,_.lintelHead??_.head,_.lintelRise),ce=hr(_.width+.28,_.height+.28,_.lintelHead??_.head,_.lintelRise);for(let oe=2;oe<ce.length-1;oe++)ve([...Ne(J[oe],ce[oe],ce[oe+1],.06),...Ne(J[oe],ce[oe+1],J[oe+1],.06)],M(_.surroundColour,"facadeTrimLight"))}}else if(_.kind==="awning"){let re=(H,ie,Q,we,Te)=>{if(!_.text?.trim()||!_.physicalSignId?.trim())return;let J=s.registration.imageToWall,ce=_.bounds[0],oe=_.bounds[2],Se=(_.bounds[1]+_.bounds[3])/2,Le=ke=>J[6]*ke+J[7]*Se+J[8],Ue=ke=>(J[0]*ke+J[1]*Se+J[2])/Le(ke),Ke={left:L-_.width/2,right:L+_.width/2,bottom:Q,top:we,sourceXForward:Ue(oe)>Ue(ce)};ve(H,ie);let Ve=l[l.length-1];Ve.sign={text:_.text.trim(),background:xo[ie]??ie,colour:/^#[a-f0-9]{6}$/i.test(_.textColour??"")?_.textColour:"#f4f1e8",..._.signFont?.trim()?{font:_.signFont.trim()}:{},physicalSignId:_.physicalSignId.trim(),aspectRatio:_.width/(we-Q),uv:Jl(H,t,Ke)},Ve.signMapping=Ke};if(_.state==="retracted"){let H=Math.min(.18,_.height),ie=M(_.frameColour,M(_.colour,"awningFabric"));ve(tt(t,L,I,_.width,H,.1),M(_.colour,"awningFabric")),re(tt(t,L,I,_.width,H,.104),ie,I-H/2,I+H/2,.104)}if(_.state==="extended"){let H=I+_.height/2,ie=I-_.height/2,Q=Math.min(.26,_.height*.22),we=_.height-Q,Te=Math.min(1.5,Math.max(.45,_.width*.22)),J=_.stripeColour?Math.max(2,Math.min(48,Math.round(_.stripeCount??20))):1,ce=_.awningProfile==="curved"?8:1,oe=ke=>[H-we*(_.awningProfile==="curved"?1-Math.cos(ke*Math.PI/2):ke),.08+Te*(_.awningProfile==="curved"?Math.sin(ke*Math.PI/2):ke)],Se=(ke,Xe)=>ve([0,1,2,0,2,3].flatMap(He=>ke[He]),Xe);for(let ke=0;ke<J;ke++){let Xe=L-_.width/2+_.width*ke/J,He=L-_.width/2+_.width*(ke+1)/J,rt=M(ke%2?_.stripeColour:_.colour,"awningFabric");for(let at=0;at<ce;at++){let We=oe(at/ce),S=oe((at+1)/ce);Se([yt(t,Xe,We[0],We[1]),yt(t,He,We[0],We[1]),yt(t,He,S[0],S[1]),yt(t,Xe,S[0],S[1])],rt)}let F=_.valance==="scalloped"?Math.max(1,Math.round((He-Xe)/.16)):1;for(let at=0;at<F;at++)for(let We=0;We<(_.valance==="scalloped"?6:1);We++){let S=_.valance==="scalloped"?6:1,x=We/S,z=(We+1)/S,W=Xe+(He-Xe)*(at+x)/F,Z=Xe+(He-Xe)*(at+z)/F,le=he=>ie+(_.valance==="scalloped"?Math.min(.06,Q*.3)*(1-Math.sin(he*Math.PI)):0);Se([yt(t,W,ie+Q,.08+Te),yt(t,Z,ie+Q,.08+Te),yt(t,Z,le(z),.08+Te),yt(t,W,le(x),.08+Te)],rt)}}let Le=M(_.frameColour,M(_.colour,"awningFabric")),Ue=_.valance==="scalloped"?Math.min(.06,Q*.3):0,Ke=ie+Ue,Ve=Q-Ue;re(tt(t,L,Ke+Ve/2,_.width,Ve,.08+Te+.004),Le,Ke,ie+Q,.08+Te+.004)}}else if(/^#[a-f0-9]{6}$/i.test(_.colour??"")){let re=u&&["cornice","masonry-band","sill"].includes(_.region),H=C_(t,L,I,_.width,_.height,_.kind==="fascia"?_.signMount==="glazing"?.05:.025:_.region==="upper-wall"?.008:_.region==="ground-floor"?.014:_.region==="plinth"?.018:re?.026:.022);if(H.length){let ie=M(_.colour,"facadeTrimLight");if(ve(H,ie),_.kind==="fascia"&&_.text?.trim()&&_.physicalSignId?.trim()){let Q=s.registration.imageToWall,we=_.bounds[0],Te=_.bounds[2],J=(_.bounds[1]+_.bounds[3])/2,ce=Ke=>Q[6]*Ke+Q[7]*J+Q[8],oe=Ke=>(Q[0]*Ke+Q[1]*J+Q[2])/ce(Ke),Se=oe(Te)>oe(we),Le={left:L-_.width/2,right:L+_.width/2,bottom:I-_.height/2,top:I+_.height/2,sourceXForward:Se},Ue=l[l.length-1];Ue.sign={text:_.text.trim(),background:xo[ie]??ie,colour:/^#[a-f0-9]{6}$/i.test(_.textColour??"")?_.textColour:"#f4f1e8",..._.signFont?.trim()?{font:_.signFont.trim()}:{},physicalSignId:_.physicalSignId.trim(),aspectRatio:_.width/_.height,uv:Jl(H,t,Le)},Ue.signMapping=Le}}}}return o||f.size?l.map(p=>{if(!o&&!f.has(p.featureId))return p;let R=P_(p.triangles,t);return R.length?{...p,triangles:R,...p.sign&&p.signMapping?{sign:{...p.sign,uv:Jl(R,t,p.signMapping)}}:{},signMapping:void 0,...h.has(p.featureId)?{partialAtFace:!0}:{}}:null}).filter(p=>p!==null).map(p=>{let{signMapping:R,...A}=p;return A}):l.map(p=>{let{signMapping:R,...A}=p;return A})}function yu(n,e,t,i){if(e.type!=="wall")return[];let s=ds(e,n,i);if(!s||s.width<2.2||s.top-s.bottom<5)return[];let r=Number.isFinite(n.geometry.building.groundNAP)?ci(n.geometry.building.groundNAP,n.geometry.frame.heightDatum):s.bottom,a=Math.min(s.top,r+42),o=a-r;if(o<5)return[];let l=Number(n.geometry.building.year),c=Number.isFinite(l)&&l<1940?3.45:3.15,u=Math.max(1,Math.min(10,Math.floor(o/c))),d=Number.isFinite(l)&&l<1940?2.45:3.05,h=Math.max(1,Math.min(14,Math.round(s.width/d))),f=s.width/h,g=Math.min(Number.isFinite(l)&&l<1940?1.18:1.48,f*.55),M=Math.min(Number.isFinite(l)&&l<1940?1.85:1.55,c*.58),m=[],p=[...n.id].reduce((T,D)=>T*31+D.charCodeAt(0),0)>>>0,R=Number.isFinite(l)&&l>=1970||p%11===0?"windowFrameDark":"windowFrame",A=p%3===0?"windowGlassBlue":p%3===1?"windowGlassWarm":"windowGlass",v=b_(n,i),E=[...n.id].reduce((T,D)=>T+D.charCodeAt(0),0)%h,_=t===v&&s.bottom<=r+.7,P=Number.isFinite(l)&&l<1965;for(let T=0;T<u;T++)for(let D=0;D<h;D++){if(_&&T===0&&D===E)continue;let B=(D+.5)*f,L=r+.55+(T+.5)*c;if(!Zt(s,B,L,g+.16,M+.16)||!di(s,B,g+.16,n,i))continue;let I=`${n.id}:${t}:context-window:${T}:${D}`;m.push({triangles:ur(s,B,L,g,M,.1,.05),colour:R,observationId:null,featureId:I,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"},{triangles:tt(s,B,L,g,M,.038),colour:A,observationId:null,featureId:I,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"},{triangles:tt(s,B,L+M*.12,g,.065,.058),colour:R,observationId:null,featureId:I,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"}),P&&m.push({triangles:tt(s,B,L,.055,M-.14,.058),colour:R,observationId:null,featureId:I,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"}),m.push({triangles:tt(s,B,L-M/2-.045,g+.28,.09,.07),colour:R,observationId:null,featureId:I,featureKind:"contextual-window-prior",styleSource:"procedural-prior-not-measured"})}if(_){let T=(E+.5)*f,D=Math.min(1.15,f*.48),B=Math.min(2.45,c*.76),L=r+.12+B/2;if(Zt(s,T,L,D+.2,B+.16)&&di(s,T,D+.2,n,i)){let I=`${n.id}:${t}:context-door`,G=(N,k)=>m.push({triangles:N,colour:k,observationId:null,featureId:I,featureKind:"contextual-door-prior",styleSource:"procedural-prior-not-measured"});if(G(tt(s,T,L,D+.2,B+.16,.036),R),G(tt(s,T,L,D,B,.05),"doorWood"),P){let N=Math.min(.42,B*.18),k=L+B/2-N/2-.1;G(tt(s,T,k,D-.18,N,.062),A),G(tt(s,T,k-N/2-.045,D,.09,.068),R)}G(tt(s,T,r+.1,D+.28,.1,.075),R)}}let y=s.width-.32,C=Number.isFinite(l)&&l>=1965?"facadeTrimDark":"facadeTrimLight",w=(T,D,B)=>{y<1.8||!Zt(s,s.width/2,D,y,B)||!di(s,s.width/2,y,n,i)||m.push({triangles:tt(s,s.width/2,D,y,B,.072),colour:C,observationId:null,featureId:`${n.id}:${t}:context-trim:${T}`,featureKind:"contextual-trim-prior",styleSource:"procedural-prior-not-measured"})};return u>1&&w("street-datum",r+c,.12),Number.isFinite(l)&&l<1965&&w("facade-top",a-.18,.24),m}function D_(n,e,t,i,s,r=!1,a=!1){if(e.type!=="wall")return[];let o=ds(e,n,s);if(!o||o.top-o.bottom<2.5)return[];let l=new Map(i.map(f=>[f.id,f])),c=[],u=n.geometry.building.surfaces.filter(f=>f.type==="wall").flatMap(f=>f.rings[0].map(g=>g[1])),d=Number.isFinite(n.geometry.building.groundNAP)?ci(n.geometry.building.groundNAP,n.geometry.frame.heightDatum):Math.min(...u),h=["upper","ground"].flatMap(f=>{let g=f==="upper"?"full":"ground",M=i.map(p=>{let R=p.facadeDescription?.sources?.[g],A=Ei(p,n,t,g),v=!A&&a?cr(p,n,t,g):null,E=f==="upper"&&(!!Ei(p,n,t,"ground")||a&&!!cr(p,n,t,"ground")),_=!!A||!!v||!R&&(f==="upper"?S_(p)||E:gu(p));return{...p,effectiveProposal:_?{wholeUsable:"unknown"}:null}}),m=hi(e,t,n.id,M);return m.intervals.map(p=>({field:f,interval:p,axis:m.axis}))});for(let{field:f,interval:g,axis:M}of h){if(!g.observation||g.status==="conflict")continue;let m=l.get(g.observation.id),p=lr(o,M,g);if(!m||!p||p.width<1.5)continue;let R=(ne,ae,ve,Ne)=>c.push({triangles:ne,colour:ae,observationId:m.id,featureId:ve,featureKind:Ne,styleSource:"procedural-prior-not-measured"}),A=(ne,ae,ve,Ne,re)=>{!Zt(p,ne,ae,ve+.18,Ne+.18)||!di(p,ne,ve+.18,n,s)||(R(ur(p,ne,ae,ve,Ne,.09,.05),"windowFrame",re,"window-prior"),R(tt(p,ne,ae,ve,Ne,.038),"windowGlass",re,"window-prior"),R(tt(p,ne,ae+Ne*.12,ve,.065,.058),"windowFrame",re,"window-prior"),R(tt(p,ne,ae,.055,Ne-.14,.058),"windowFrame",re,"window-prior"))},v=f==="upper"?"full":"ground",E=Ei(m,n,t,v),_=!E&&a?cr(m,n,t,v):null,P=E??_;if(P){let ne=m.facadeDescription?.extractionVersion==="source-facade-owner-candidate/v1",ae=m.facadeDescription?.sources?.full,ve=m.facadeDescription?.sources?.ground,Ne=ne&&Number.isFinite(Date.parse(ae?.captureDate))&&Number.isFinite(Date.parse(ve?.captureDate))&&Date.parse(ve.captureDate)<Date.parse(ae.captureDate),re=ce=>Ne&&ce.kind==="window"&&Array.isArray(ce.bounds)&&ce.bounds[1]<=0,H=f==="upper"&&Ei(m,n,t,"ground"),ie=f==="upper"&&!H&&a?cr(m,n,t,"ground"):null,Q=H??ie,we=Q?(Q.features??[]).filter(ce=>!re(ce)&&(!ne||ce.kind==="window"||ce.kind==="door")).map(ce=>hs(ce,Q,m)).filter(Boolean):[],J=I_(n,o,p,m,P,s,ce=>{if(f==="ground"&&re(ce))return!1;if(!Q||ce.region==="upper-wall"||m.facadeDescription?.extractionVersion==="source-facade-owner-candidate/v1"&&ce.kind==="material"&&["cornice","masonry-band","sill"].includes(ce.region))return!0;let oe=hs(ce,P,m);return oe?!we.some(Se=>Math.abs(oe.t-Se.t)<(oe.width+Se.width)/2&&Math.abs(oe.y-Se.y)<(oe.height+Se.height)/2):!1},a&&!!_);c.push(..._?J.map(ce=>({...ce,previewOnly:!0})):J);continue}let y=3.5,C=Math.max(1,Math.min(12,Math.ceil((p.top-d)/y))),w=Math.max(1,Math.min(16,Math.round(p.width/2.7))),T=p.width/w,D=Math.min(1.25,T*.53),B=Math.min(1.9,y*.56),L=`${n.id}:${t}:${m.id}`;if(f==="upper"){for(let ne=1;ne<C;ne++)for(let ae=0;ae<w;ae++)A((ae+.5)*T,d+(ne+.48)*y,D,B,`${L}:window:${ne}:${ae}`);continue}if(!gu(m)||p.bottom>d+1.5)continue;let I=Math.min(2.35,y*.66),G=d+.55+I/2;if(m.effectiveProposal.shopfront==="no"){let ne=T/2,ae=Math.min(1.1,T*.48),ve=2.35,Ne=d+.12+ve/2,re=Zt(p,ne,Ne,ae+.18,ve+.18)&&di(p,ne,ae+.18,n,s);if(re){let H=`${L}:entrance-prior`;R(ur(p,ne,Ne,ae,ve,.09,.065),"windowFrame",H,"contextual-door-prior"),R(tt(p,ne,Ne,ae,ve,.038),"doorWood",H,"contextual-door-prior"),R(tt(p,ne,Ne+ve/2-.25,ae-.12,.36,.052),"windowGlass",H,"contextual-door-prior")}for(let H=re?1:0;H<w;H++)A((H+.5)*T,G,D,Math.min(1.8,I),`${L}:window:0:${H}`);continue}let N=Math.min(p.width-.5,12),k=p.width/2;if(!Zt(p,k,G,N+.16,I+.16)||!di(p,k,N+.16,n,s))continue;let $=`${L}:shop`;R(ur(p,k,G,N,I,.08,.05),"windowFrame",$,"shopfront-prior"),R(tt(p,k,G,N,I,.038),"shopGlass",$,"shopfront-prior");let j=Math.max(2,Math.ceil(N/1.7));for(let ne=1;ne<j;ne++)R(tt(p,k-N/2+N*ne/j,G,.065,I,.058),"windowFrame",$,"shopfront-prior");if(r&&cu(m)){let ne=G+I/2+.3;if(!Zt(p,k,ne,N,.2))continue;let ae=[yt(p,k-N/2,ne,.07),yt(p,k+N/2,ne,.07),yt(p,k+N/2,ne-.24,.8),yt(p,k-N/2,ne-.24,.8)];R([0,1,2,0,2,3].flatMap(ve=>ae[ve]),"awningFabric",`${L}:awning`,"reviewed-awning-prior")}}return c}function L_(n,e,t,i){let s=i.filter(a=>a.renderBuildingId===n.id&&a.renderSurfaceIndices?.includes(t));return s.length?hi(e,t,n.id,s.map(a=>({...a,effectiveProposal:{wholeUsable:"unknown"}}))).intervals.filter(a=>a.observation||a.status==="conflict").map(a=>[Math.min(a.startM,a.endM),Math.max(a.startM,a.endM)]).filter(([a,o])=>Number.isFinite(a)&&Number.isFinite(o)&&o>a):[]}function vu(n,e,t,i){let s=a=>(a[0]-e.a[0])*e.u[0]+(a[2]-e.a[1])*e.u[1],r=[];for(let a=0;a<n.length;a++){let o=n[a],l=n[(a+1)%n.length],c=s(o),u=s(l),d=i?c>=t:c<=t,h=i?u>=t:u<=t;if(d&&r.push(o),d!==h){let f=(t-c)/(u-c);r.push(o.map((g,M)=>g+(l[M]-g)*f))}}return r}function F_(n,e,t){if(!t.length)return n;let i=t.slice().sort((a,o)=>a[0]-o[0]),s=[],r=0;for(let[a,o]of i)a>r&&s.push([r,Math.min(e.width,a)]),r=Math.max(r,o);return r<e.width&&s.push([r,e.width]),n.flatMap(a=>{let o=[];for(let l=0;l<a.triangles.length;l+=9){let c=[0,1,2].map(u=>a.triangles.slice(l+u*3,l+u*3+3));for(let[u,d]of s){let h=vu(vu(c,e,u,!0),e,d,!1);for(let f=1;f<h.length-1;f++)o.push(...h[0],...h[f],...h[f+1])}}return o.length?[{...a,triangles:o}]:[]})}function Tu(n,e,t,i,s,r={}){let a=i.filter(f=>f.renderBuildingId===n.id&&f.renderSurfaceIndices?.includes(t)&&f.facadeDescription),o=r.procedural?i:a,l=D_(n,e,t,r.observed===!1?o.filter(f=>!f.facadeDescription):o,s,r.reviewedAwnings,r.candidateRegistrationPreview===!0);if(!r.contextual)return l;let c=ds(e,n,s),u=new Set(l.map(f=>f.observationId).filter(f=>typeof f=="string")),d=i.filter(f=>a.includes(f)||u.has(f.id));if(!d.length)return l.length?l:yu(n,e,t,s);let h=c?F_(yu(n,e,t,s),c,L_(n,e,t,d)):[];return[...l,...h]}var N_=128;var U_=7.4,O_=n=>!["rejected","uncertain","crop-repair"].includes(n?.review?.placement),Eu=(n,e)=>{let t=n?.images?.[e];return!!t&&/^[a-f0-9]{64}$/i.test(t.sha256??"")&&/^[a-f0-9]{64}$/i.test(t.panoramaSha256??"")},Au=n=>!Eu(n,"ground")||!["yes","no"].includes(n.effectiveProposal?.shopfront)?!1:n.review?.placement==="accepted"&&n.proposalSources?.shopfront==="human-review"?!0:n.visualReview?.fieldEligibility?.shopfront===!1?!1:n.visualReview?.fieldEligibility?.shopfront===!0||n.effectiveProposal?.groundUsable==="yes";function B_(n){if(!n)return"missing-record";if(n.machineRevocation?.revoked)return"revoked-observation";if(!O_(n))return"revoked-placement";if(!n.evidenceKey||!n.derivationKey)return"missing-source-identity";if(!Eu(n,"ground"))return"missing-current-ground-source";if(!n.images?.ground?.date&&!n.images?.ground?.capturedAt)return"missing-capture-date";if(n.effectiveProposal?.shopfront!=="yes")return"shopfront-not-positive";if(n.visualReview?.fieldEligibility?.shopfront===!1||n.visualReview?.fieldEligibility?.signText===!1)return"field-withheld";if(!Au(n))return"ground-source-not-supported";let e=n.machineRoutingProposal;if(!e)return"missing-machine-proposal";if(e.signTextEligible!=="yes")return"sign-text-not-eligible";let t=String(e.signText??"").trim();return t?/[\u0000-\u001f\u007f]/.test(t)?"control-character-sign-text":null:"empty-sign-text"}function Ru(n,e=28){let t=String(n??"").trim();return t.length<=e?t:`${t.slice(0,e-1)}\u2026`}function Cu(n){return B_(n)===null}function z_(n,e){return Math.min(e-.3,U_,Math.max(1.4,n.length*.24+.5))}var Pu=(n,e,t,i)=>[n.a[0]+n.u[0]*e+n.n[0]*i,t,n.a[1]+n.u[1]*e+n.n[1]*i];function Iu(n,e,t=1024,i="#25372e"){let s=n.canvas?.height||N_;n.fillStyle=/^#[a-f0-9]{6}$/i.test(i)?i:"#25372e",n.fillRect(0,0,t,s),n.fillStyle="#e7e5d9",n.textAlign="center",n.textBaseline="middle";let r=s*.75;for(n.font=`700 ${r}px Arial`;n.measureText(e).width>t*.84&&r>s*.1875;)r-=1,n.font=`700 ${r}px Arial`;n.fillText(e,t/2,s*.53)}function k_(n,e,t,i,s){if(!Cu(n)||t.status==="conflict"||t.observation?.id!==n.id)return null;let r=lr(e,i,t);if(!r||r.width<1.5||r.bottom>s+1.5)return null;let a=Math.min(2.35,3.5*.66),o=s+.55+a/2,l=o+a/2+.55/2+.05,c=Ru(String(n.machineRoutingProposal.signText).trim()),u=z_(c,r.width),d=r.width/2;return Zt(r,d,l,u,.55)?{observationId:n.id,text:c,displayText:c,localPosition:Pu(r,d,l,.06),rotationY:Math.atan2(r.n[0],r.n[1]),width:u,height:.55,intervalWidth:r.width}:null}function Du(n,e,t,i,s){if(e.type!=="wall")return[];let r=ds(e,n,s);if(!r||r.top-r.bottom<2.5)return[];let a=i.filter(h=>h.renderBuildingId===n.id&&h.renderSurfaceIndices?.includes(t)&&h.facadeDescription);if(a.length){let h=[];for(let f of a){let g=Ei(f,n,t,"ground");if(!g)continue;let M=hi(e,t,n.id,a.map(m=>({...m,effectiveProposal:{wholeUsable:"unknown"}})));for(let m of M.intervals){if(m.observation?.id!==f.id||m.status==="conflict")continue;let p=lr(r,M.axis,m);if(!p)continue;let R=(p.a[0]-r.a[0])*r.u[0]+(p.a[1]-r.a[1])*r.u[1];for(let A of g.features){let v=hs(A,g,f);!v||v.kind!=="fascia"||!v.text?.trim()||/[\u0000-\u001f\u007f]/.test(v.text)||!Zt(p,v.t-R,v.y,v.width,v.height)||h.push({observationId:f.id,text:v.text.trim(),displayText:Ru(v.text),localPosition:Pu(r,v.t,v.y,.09),rotationY:Math.atan2(r.n[0],r.n[1]),width:v.width,height:v.height,intervalWidth:p.width,physicalSignId:v.physicalSignId,colour:v.colour})}}}return h}let o=i.filter(h=>h.renderBuildingId===n.id&&Cu(h)&&Array.isArray(h.renderSurfaceIndices)&&h.renderSurfaceIndices.includes(t));if(!o.length)return[];let l=n.geometry.building.surfaces.filter(h=>h.type==="wall").flatMap(h=>h.rings[0].map(f=>f[1])),c=Number.isFinite(n.geometry.building.groundNAP)?ci(n.geometry.building.groundNAP,n.geometry.frame.heightDatum):Math.min(...l),u=i.map(h=>({...h,effectiveProposal:Au(h)?{wholeUsable:"unknown"}:null})),d=hi(e,t,n.id,u);return d.axis?o.flatMap(h=>d.intervals.map(f=>k_(h,r,f,d.axis,c)).filter(Boolean)):[]}function Lu(n,e){let t=new Map;for(let i of n){let s=e.find(l=>l.id===i.observationId);if(!s)continue;let r=String(i.text??s.machineRoutingProposal?.signText??"").trim().toLocaleLowerCase("en"),a=JSON.stringify([s.images?.ground?.panoramaSha256??s.renderBuildingId,r,s.images?.ground?.date??s.images?.ground?.capturedAt,i.physicalSignId??null]),o=t.get(a);(!o||i.width>o.width||i.width===o.width&&i.observationId<o.observationId)&&t.set(a,i)}return[...t.values()]}function Fu(n,e={}){if(!e.text?.trim())throw new Error("Source sign text is required");if(typeof document>"u")throw new Error("Facade sign material requires a browser canvas");let t=Math.min(e.width??512,512),i=Number.isFinite(e.aspectRatio)&&(e.aspectRatio??0)>0?e.aspectRatio:null,s=i?Math.max(8,Math.min(128,Math.round(t/i))):Math.min(e.height??128,128),r=document.createElement("canvas");r.width=t,r.height=s;let a=r.getContext("2d");if(!a)throw new Error("Unable to create sign canvas");a.fillStyle=e.background??"#242628",a.fillRect(0,0,t,s),a.fillStyle=e.colour??"#f3eee4";let o=e.font??`italic 700 ${Math.round(s*.45)}px Georgia, serif`,l=o.match(/(\d+(?:\.\d+)?)px/),c=Math.min(l?Number(l[1]):s*.45,s*.8),u=f=>l?o.replace(/\d+(?:\.\d+)?px/,`${Math.max(1,Math.round(f))}px`):`italic 700 ${Math.max(1,Math.round(f))}px Georgia, serif`;for(a.font=u(c);c>1&&a.measureText(e.text.trim()).width>t*.9;)c*=.9,a.font=u(c);a.textAlign="center",a.textBaseline="middle",a.fillText(e.text.trim(),t/2,s/2);let d=new n.CanvasTexture(r);return d.colorSpace=n.SRGBColorSpace??d.colorSpace,d.needsUpdate=!0,{material:new n.MeshBasicMaterial({map:d,transparent:!0,side:n.DoubleSide}),texture:d,canvas:r}}var pr={priorBrickRed:"#94553f",priorBrickBrown:"#73513f",priorBrickBuff:"#aa8d62",priorPlaster:"#c3b99e",priorModernLight:"#b6b8b0",priorModernGrey:"#858b87",roof:"#777b7b",priorRoofWarm:"#756b66",priorRoofDark:"#5f6565"};function fs(n,e){let t=2166136261;for(let i of n)t^=i.charCodeAt(0),t=Math.imul(t,16777619);return e[(t>>>0)%e.length]}function Nu(n,e){let t=Number(e),i=Number.isFinite(t)&&t<1925?fs(n,["priorBrickRed","priorBrickBrown","priorBrickBrown","priorBrickBuff","priorPlaster"]):Number.isFinite(t)&&t<1965?fs(n,["priorBrickRed","priorBrickBrown","priorBrickBuff","priorModernGrey"]):fs(n,["priorBrickBuff","priorModernLight","priorModernGrey","priorPlaster"]),s=fs(n,["roof","priorRoofWarm","priorRoofDark"]),r=Number.isFinite(t)&&t<1925?fs(`${n}:ground`,["priorBrickBrown","priorBrickRed","priorRoofWarm"]):fs(`${n}:ground`,["priorModernGrey","priorBrickBuff","priorRoofWarm"]);return{wallKey:i,roofKey:s,groundKey:r,wall:pr[i],roof:pr[s],ground:pr[r]}}var V_={wall:"#c4c1b5",...pr,brown:"#876650",red:"#945c48",buff:"#bba681",grey:"#96938a",white:"#d8d4c3",black:"#57544e",auditedUsable:"#638774",auditedPartial:"#bd875b",...xo};function G_(n,e,t){let i=e.previewAppearance;return!t||!n.geometryRevision.startsWith("candidate:")||i?.disposition!=="inferred-preview"||!/^#[a-f0-9]{6}$/i.test(i.colour)||!/^[a-f0-9]{64}$/.test(i.sourceCropSha256)?null:n.observations.some(r=>Object.values(r.payload?.facadeDescription?.sources??{}).some(a=>a.cropSha256===i.sourceCropSha256))?i.colour:null}function H_(n){if(!Number.isFinite(n))throw new Error("Invalid vertex normal");let e=Math.max(-1,Math.min(1,n));return e<=-1?-128:Math.round(e*127)}function W_(n){let e=n.getAttribute?.("normal");if(!e)return;let t=new Int8Array(e.count*e.itemSize);for(let i=0;i<t.length;i++)t[i]=H_(e.array[i]);n.setAttribute("normal",new Ns(t,e.itemSize,!0))}function Uu(n){let e=n.map(c=>{if(!c.every(u=>u.length===3&&u.every(Number.isFinite)))throw new Error("Invalid source surface coordinate");return c.length>2&&c[0].every((u,d)=>Math.abs(u-c[c.length-1][d])<1e-8)?c.slice(0,-1):c.slice()});if(!e[0]||e[0].length<3)return[];if(e.slice(1).some(c=>c.length<3))throw new Error("Degenerate source hole");let t=e[0],i=new V;for(let c=0;c<t.length;c++){let u=t[c],d=t[(c+1)%t.length];i.x+=(u[1]-d[1])*(u[2]+d[2]),i.y+=(u[2]-d[2])*(u[0]+d[0]),i.z+=(u[0]-d[0])*(u[1]+d[1])}if(i.lengthSq()<1e-16)return[];let s=[Math.abs(i.x),Math.abs(i.y),Math.abs(i.z)],r=s.indexOf(Math.max(...s)),a=c=>new ze(...c.filter((u,d)=>d!==r)),o=e.flat();return Hs.triangulateShape(e[0].map(a),e.slice(1).map(c=>c.map(a))).flatMap(c=>{let[u,d,h]=c.map(g=>new V(...o[g]));return(d.sub(u).cross(h.sub(u)).dot(i)>=0?c:[c[0],c[2],c[1]]).flatMap(g=>o[g])})}function Ou(n){let e=n.geometry.building,t=e.surfaces.flatMap(o=>o.rings.flatMap(l=>l.map(c=>c[1]))),i=t.length?Math.min(...t):ci(e.groundNAP??.65,n.geometry.frame.heightDatum),s=t.length?Math.max(...t):i+(e.height??5),r=e.footprint.type==="Polygon"?[e.footprint.coordinates]:e.footprint.coordinates,a=[];for(let o of r){let l=o.map((c,u)=>{let d=c.slice(0,-1).reduce((h,f,g)=>h+f[0]*c[g+1][1]-c[g+1][0]*f[1],0);return(u===0?d>0:d<0)?[...c].reverse():c});a.push({type:"roof",rings:l.map(c=>c.map(([u,d])=>[u,s,d]))});for(let c of l)for(let u=0;u<c.length-1;u++){let d=c[u],h=c[u+1];a.push({type:"wall",rings:[[[d[0],i,d[1]],[h[0],i,h[1]],[h[0],s,h[1]],[d[0],s,d[1]]]]})}}return a}function ps(n,e,t){let i=e.geometry.frame.originRD,s=t.targetOriginRD,r=_o(0,e.geometry.frame.heightDatum,t.targetOffsetNAP??0);return n.map((a,o)=>o%3===0?a+i.x-s.x:o%3===1?a+r:a+s.y-i.y)}function X_(n,e,t){let i=e.geometry.frame.originRD,s=t.targetOriginRD,r=_o(0,e.geometry.frame.heightDatum,t.targetOffsetNAP??0);return[n[0]+i.x-s.x,n[1]+r,n[2]+s.y-i.y]}var q_=new On(1,1);function Y_(n,e,t){let i=document.createElement("canvas");i.width=Math.min(512,Math.ceil(64*n.width/n.height)),i.height=64,Iu(i.getContext("2d"),n.displayText,i.width,n.colour);let s=new ji(i);s.colorSpace=Pt,s.generateMipmaps=!1,s.minFilter=wt;let r=new Nn({map:s,side:fn}),a=new Tt(q_,r);return a.scale.set(n.width,n.height,1),a.position.set(...X_(n.localPosition,e,t)),a.rotation.y=n.rotationY,a.userData.machineSign=!0,a.userData.observationId=n.observationId,a.userData.featureKind="machine-sign-unreviewed",a.name="city-appearance-machine-sign",a}function Bu(n){n.material?.map?.dispose?.(),n.material?.dispose?.()}function Z_(n){return n.flatMap(e=>e.observations.filter(t=>t.buildingId===e.id&&t.geometryRevision===e.geometryRevision&&t.evidenceKey&&t.payload?.evidenceKey===t.evidenceKey&&t.payload?.renderBuildingId===e.id&&t.payload?.effectiveProposal?.wholeUsable==="yes"&&t.payload?.visualReview?.fieldEligibility?.wallColour!==!1).map(t=>t.payload))}function $_(n){return n.flatMap(e=>e.observations.filter(t=>t.buildingId===e.id&&t.geometryRevision===e.geometryRevision&&t.evidenceKey&&t.payload?.evidenceKey===t.evidenceKey&&t.payload?.renderBuildingId===e.id&&["usable","partial"].includes(t.payload?.agentSourceAudit?.disposition)).map(t=>t.payload))}function zu(n,e){let t=Nu(n.id,n.geometry.building.year);return e==="roof"?t.roofKey:t.wallKey}function ec(n){if(![n.targetOriginRD.x,n.targetOriginRD.y,n.targetOffsetNAP??0].every(Number.isFinite))throw new Error("Invalid target RD/NAP origin");return e=>{let t=new Set;for(let w of e){let T=w.geometry?.frame;if(t.has(w.id)||w.geometry?.building?.id!==w.id||!T||T.axes!=="x=east,y=up,z=south"||!["legacy-block-NAP-minus-0.65m","NAP"].includes(T.heightDatum)||![T.originRD.x,T.originRD.y].every(Number.isFinite))throw new Error(`Unsupported or duplicate source frame: ${w.id}`);t.add(w.id)}let i=new an;i.name="city-appearance-owned-tile",i.userData.buildingIds=[...t],i.userData.experimentalWallColours=n.experimentalWallColours===!0,i.userData.proceduralFacades=n.proceduralFacades===!0,i.userData.facadeStyleSource="Registered source features retain per-feature evidence disposition; legacy and contextual rhythms remain explicit procedural priors.";let s=new Map,r=new Map(e.map(w=>[w.id,"facade"])),a=new Map,o=new Map,l=n.experimentalWallColours?Z_(e):n.auditCoverage?$_(e):[],c=n.proceduralFacades||n.observedFacades!==!1?yo(e):[],u=n.machineSigns===!0?yo(e):[],d=new an;d.name="city-appearance-machine-signs";let h=[],f=n.machineSigns===!0,g=!1,M=!1,m=(w,T,D=!1,B=null)=>({buildingId:w.id,geometryRevision:w.geometryRevision,sourceSurfaceIndex:T,observationId:B,approximateMassing:D});for(let w of e){let T=!w.geometry.building.surfaces.length,D=T?Ou(w):w.geometry.building.surfaces,B=[],L=[];D.forEach((N,k)=>{let $=Uu(N.rings),j=G_(w,N,n.candidateRegistrationPreview===!0),ne=j??(n.contextualPalette?zu(w,N.type):N.type==="roof"?"roof":"wall"),ae={triangles:ps($,w,n),colour:ne,identity:{...m(w,T?null:k,T),...j?{previewOnly:!0,styleSource:"inferred-source-component-preview"}:{}}};B.push(ae);let ve=!T&&N.type==="wall"&&(n.experimentalWallColours||n.auditCoverage)?hi(N,k,w.id,l):null;if(!ve?.axis){L.push(ae);return}for(let Ne of ve.intervals){let re=Ne.observation?.effectiveProposal?.wallColour,H=Ne.observation?.agentSourceAudit?.disposition,ie=n.auditCoverage&&H==="usable"?"auditedUsable":n.auditCoverage&&H==="partial"?"auditedPartial":["brown","red","buff","grey","white","black"].includes(re)?re:null;L.push({triangles:ps(ou($,ve.axis,Ne.startM,Ne.endM),w,n),colour:ie??ne,identity:m(w,k,!1,ie?Ne.observation.id:null)})}});let I=n.experimentalWallColours||n.auditCoverage?L.slice():B.slice();o.set(w.id,B.flatMap(N=>N.triangles)),(n.proceduralFacades||n.contextualFacades||n.observedFacades!==!1)&&!T&&D.forEach((N,k)=>{let $=Tu(w,N,k,c,e,{procedural:n.proceduralFacades,contextual:n.contextualFacades,reviewedAwnings:n.reviewedAwnings,observed:n.observedFacades,candidateRegistrationPreview:n.candidateRegistrationPreview===!0});for(let j of $){let ne=j.sign,ae=ne&&ne.text&&ne.physicalSignId&&Array.isArray(ne.uv)?{sign:ne}:{};j.featureKind.startsWith("observed-")&&(j.featureKind==="observed-material"||j.featureKind==="observed-awning"&&!ne||j.colour==="doorWood"||j.colour==="windowGlass")&&I.push({triangles:ps(j.triangles,w,n),colour:j.colour,identity:{...m(w,k,!1,j.observationId),featureId:j.featureId,featureKind:j.featureKind,styleSource:j.styleSource}}),L.push({triangles:ps(j.triangles,w,n),colour:j.colour,material:j.material,...ae,identity:{...m(w,k,!1,j.observationId),featureId:j.featureId,featureKind:j.featureKind,styleSource:j.styleSource,...j.previewOnly?{previewOnly:!0}:{}}}),ae.sign&&I.push({triangles:ps(j.triangles,w,n),colour:j.colour,sign:ae.sign,identity:{...m(w,k,!1,j.observationId),featureId:j.featureId,featureKind:j.featureKind,styleSource:j.styleSource}})}}),u.length&&!T&&D.forEach((N,k)=>{for(let $ of Du(w,N,k,u,e))h.push({owner:w,placement:$})});let G=Ou(w).map(N=>({triangles:ps(Uu(N.rings),w,n),colour:n.contextualPalette?zu(w,N.type):N.type==="roof"?"roof":"wall",identity:m(w,null,!0)}));a.set(w.id,{facade:I,detail:L,massing:G})}let p=Lu(h.map(w=>({...w.placement,item:w})),u);h.splice(0,h.length,...p.map(w=>w.item));let R=new Nn({color:"#f2c14e",transparent:!0,opacity:.24,depthWrite:!1,side:Ht,polygonOffset:!0,polygonOffsetFactor:-2}),A=new Map,v=null,E=null;function _(){let w=new Map(h.map((T,D)=>[String(D),T]).filter(([,T])=>f&&!g&&r.get(T.owner.id)==="detail"));for(let T of[...d.children]){let D=T.userData.placementKey;if(w.has(D)){w.delete(D);continue}d.remove(T),Bu(T)}for(let[T,{owner:D,placement:B}]of w){let L=Y_(B,D,n);L.userData.placementKey=T,d.add(L)}}n.machineSigns===!0&&(i.add(d),d.visible=f,_());function P(){E&&(i.remove(E),E.geometry.dispose(),E=null);let w=v?o.get(v):null;if(!w?.length||g)return;let T=new Xt;T.setAttribute("position",new Dt(w,3)),T.computeBoundingBox(),T.computeBoundingSphere(),E=new Tt(T,R),E.name="city-appearance-selection",E.renderOrder=6,E.userData.runtimeSelection=!0,E.raycast=()=>{},i.add(E)}function y(){if(M=!1,g)return;let w=new Map,T=new Map;for(let B of e)for(let L of a.get(B.id)[r.get(B.id)]){if(!L.triangles.length)continue;if(L.sign){let N=`${L.sign.physicalSignId}:${L.sign.text}:${L.sign.background}:${L.sign.colour}:${L.sign.font??""}`,k=T.get(N)??{descriptor:L.sign,positions:[],uvs:[],identities:[]};k.positions.push(...L.triangles),k.uvs.push(...L.sign.uv);for(let $=0;$<L.triangles.length/9;$++)k.identities.push(L.identity);T.set(N,k);continue}let I=`${L.material??"flat"}:${L.colour}`,G=w.get(I)??{colour:L.colour,material:L.material,positions:[],identities:[]};for(let N of L.triangles)G.positions.push(N);for(let N=0;N<L.triangles.length/9;N++)G.identities.push(L.identity);w.set(I,G)}let D=[];for(let[B,L]of w){let I=L.colour;if(!s.has(B)){let k=I.startsWith("#")?I:V_[I];s.set(B,L.material==="brick"?ru({MeshStandardMaterial:jn,DoubleSide:Ht},k):new jn({color:k,roughness:.9,side:Ht}))}let G=new Xt;G.setAttribute("position",new Dt(L.positions,3)),G.computeVertexNormals(),W_(G),G.computeBoundingBox(),G.computeBoundingSphere();let N=new Tt(G,s.get(B));N.name=`city-appearance-${I}`,N.userData.triangleIdentities=L.identities,N.castShadow=n.castShadows!==!1,N.receiveShadow=!1,D.push(N)}for(let[B,L]of T){let I=A.get(B);I||(I=Fu({CanvasTexture:ji,MeshBasicMaterial:Nn,DoubleSide:Ht,SRGBColorSpace:Pt},L.descriptor),A.set(B,I));let G=new Xt;G.setAttribute("position",new Dt(L.positions,3)),G.setAttribute("uv",new Dt(L.uvs,2));let N=new Tt(G,I.material);N.name=`city-appearance-source-sign-${L.descriptor.physicalSignId}`,N.userData.triangleIdentities=L.identities,N.userData.sourceSign=!0,D.push(N)}for(let B of[...i.children])B!==E&&B!==d&&B.geometry&&(i.remove(B),B.geometry.dispose(),B.userData.sourceSign);for(let B of D)i.add(B);for(let[B,L]of A)T.has(B)||(L.material.dispose(),L.texture.dispose(),A.delete(B));P(),_()}let C={group:i,flush:y,setSelected(w){if(!g){if(w!==null&&!t.has(w)){v=null,P();return}v!==w&&(v=w,P())}},setLod(w,T){if(!g){if(!t.has(w)||!["massing","facade","detail"].includes(T))throw new Error(`Unknown building or LOD: ${w}`);r.get(w)!==T&&(r.set(w,T),M||(M=!0,queueMicrotask(()=>{M&&y()})))}},setMachineSignsVisible(w){g||f===w||(f=w,w&&!d.parent&&(i.add(d),_()),d.visible=w,_())},pick(w,T){return g||!i.children.includes(w)||!Number.isInteger(T)||T<0?null:w.userData.triangleIdentities?.[T]??null},get stats(){let w=new Map,T=new Set;for(let k of i.children)for(let $ of k.userData.triangleIdentities??[])$.featureId&&$.featureKind&&w.set($.featureId,$.featureKind),$.featureKind==="shopfront-prior"&&$.observationId&&T.add($.observationId);let D=k=>[...w.values()].filter($=>$===k).length,B=i.children.flatMap(k=>k===d&&d.parent?k.children:[k]).filter(k=>k.isMesh&&!k.userData.runtimeSelection),L=new Set,I=new Set;for(let k of B){for(let $ of Object.values(k.geometry.attributes)){let j=$.array??$.data?.array;j?.buffer&&L.add(j.buffer)}k.geometry.index?.array?.buffer&&L.add(k.geometry.index.array.buffer);for(let $ of Array.isArray(k.material)?k.material:[k.material])for(let j of Object.values($??{}))j?.isTexture&&I.add(j)}let G=[...L].reduce((k,$)=>k+$.byteLength,0),N=[...I].reduce((k,$)=>{let j=$.image;return k+Math.ceil((j?.width??0)*(j?.height??0)*4*($.generateMipmaps?4/3:1))},0);return{geometryBufferBytes:G,textureBytes:N,buildings:t.size,meshes:B.length,triangles:B.reduce((k,$)=>k+$.geometry.getAttribute("position").count/3,0),windows:D("window-prior")+D("contextual-window-prior")+D("observed-window"),doors:D("contextual-door-prior")+D("observed-door"),storefronts:T.size,storefrontPatches:D("shopfront-prior"),awnings:D("reviewed-awning-prior")+D("observed-awning"),signs:D("observed-sign"),machineSigns:d.children.length,disposed:g}},dispose(){if(!g){g=!0,n.parent.remove(i);for(let w of[...d.children])d.remove(w),Bu(w);for(let w of[...i.children])i.remove(w),w!==d&&w.geometry&&w.geometry.dispose();for(let w of s.values())w.dispose();for(let{material:w,texture:T}of A.values())T.dispose(),w.dispose();E=null,R.dispose(),s.clear(),a.clear(),o.clear(),r.clear()}}};return y(),n.parent.add(i),C}}var Lt=n=>document.getElementById(n),Gu=Lt("scene"),St=Lt("stage"),mr=Lt("source-overlay"),ku=document.documentElement.dataset.previewPacket??"./data/case24-gable-city-preview.json",Vu=new URLSearchParams(location.search).get("packet"),K_=(()=>{if(!Vu)return ku;let n=new URL(Vu,location.href),e=new URL("./data/",location.href);return n.origin===location.origin&&n.pathname.startsWith(e.pathname)&&n.pathname.endsWith(".json")?`${n.pathname}${n.search}`:ku})(),Hu=document.createElement("style");Hu.textContent="#source-overlay{position:absolute!important;inset:0;opacity:0;pointer-events:none}.source-frame #source-overlay.active{opacity:var(--source-opacity)!important}.hud{position:fixed!important;top:12px!important;left:12px!important;z-index:20}";document.head.append(Hu);var Ai=new Fs;Ai.background=new Ze("#e9e9df");Ai.fog=new Ls("#e9e9df",38,118);var ms=new uo({canvas:Gu,antialias:!0,powerPreference:"high-performance"});ms.setPixelRatio(Math.min(devicePixelRatio,1.5));ms.outputColorSpace=Pt;var st=new Ot(39,1,.1,300),ln=new go(st,Gu);ln.enableDamping=!0;ln.target.set(0,7,0);st.position.set(-11,9,20);ln.update();Ai.add(new qs("#fff9ed","#66766d",2.25));var Wu=new Zs("#fff0d5",2.7);Wu.position.set(-24,42,18);Ai.add(Wu);var tc=new Tt(new On(220,220),new jn({color:"#d8ddd1",roughness:1}));tc.rotation.x=-Math.PI/2;tc.position.y=-.02;Ai.add(tc);var it=null,gs=!1,_s=!1,xs="free";function Xu(n){let e=n.geometry.building.surfaces.flatMap(l=>l.rings.flat()),t=Math.min(...e.map(l=>l[0])),i=Math.max(...e.map(l=>l[0])),s=Math.min(...e.map(l=>l[1])),r=Math.max(...e.map(l=>l[1])),a=Math.min(...e.map(l=>l[2])),o=Math.max(...e.map(l=>l[2]));return{x:(t+i)/2,y:(s+r)/2,z:(a+o)/2}}function nc(n,e){xs="free",document.body.classList.remove("wide-street-frame"),document.body.classList.remove("source-frame");let t=it?.packet?.provenance?.source,i=it?.packet?.provenance?.streetContextFraming,s=Xu(n),r=t?.samplingPlane?(t.samplingPlane.baseZ+t.samplingPlane.topZ)/2-t.localToNAPOffsetM:s.y,a=i?.frontWallTargetLocal,o=a?{x:a.x,y:r,z:a.z}:s,l=a?e==="front"?36:42:e==="front"?24:27,c=it?.packet?.provenance?.sourceCameraLocal,u=(c?.x??o.x-1)-o.x,d=(c?.z??o.z+1)-o.z,h=l/Math.max(.001,Math.hypot(u,d));ln.target.set(o.x,o.y,o.z),st.position.set(o.x+u*h+(e==="oblique"?-7:0),o.y+(e==="front"?1.2:5),o.z+d*h+(e==="oblique"?5:0)),ln.update()}function qu(n){let e=it?.packet?.provenance?.sourceCameraLocal,t=it?.packet?.provenance?.source?.samplingPlane,i=n?.geometry?.frame?.originRD,s=it?.packet?.provenance?.source?.samplingPlaneLocal??(t&&i?{start:{x:t.start.x-i.x,y:t.baseZ-it.packet.provenance.source.localToNAPOffsetM,z:i.y-t.start.y},end:{x:t.end.x-i.x,y:t.baseZ-it.packet.provenance.source.localToNAPOffsetM,z:i.y-t.end.y},topY:t.topZ-it.packet.provenance.source.localToNAPOffsetM}:null);if(!e||!s||![e.x,e.y,e.z,s.start.x,s.start.y,s.start.z,s.end.x,s.end.y,s.end.z,s.topY].every(Number.isFinite))return;let r=new V(e.x,e.y,e.z),a=new V(s.start.x,s.start.y,s.start.z),o=new V(s.end.x,s.end.y,s.end.z),l=o.clone().sub(a).normalize(),c=new V(0,1,0),u=l.clone().cross(c).normalize();r.clone().sub(a).dot(u)<0&&u.negate();let d=r.clone().sub(a).dot(u),h=.1;if(!(d>h))return;let f=h/d,g=a.clone().sub(r).dot(l)*f,M=o.clone().sub(r).dot(l)*f,m=(s.start.y-r.y)*f,p=(s.topY-r.y)*f;st.position.copy(r),st.quaternion.setFromRotationMatrix(new pt().makeBasis(l,c,u)),st.projectionMatrix.makePerspective(g,M,p,m,h,300),st.projectionMatrixInverse.copy(st.projectionMatrix).invert(),ln.enabled=!1,_s=!0,xs="source",document.body.classList.remove("wide-street-frame"),document.body.classList.add("source-frame"),St.dataset.cameraState=JSON.stringify({kind:"source-camera-side",position:st.position.toArray(),quaternion:st.quaternion.toArray(),projectionMatrix:st.projectionMatrix.elements,viewport:{width:St.clientWidth,height:St.clientHeight}}),ys()}function Yu(){let n=it?.packet?.provenance?.streetContextFraming?.inferredInspectionEyeLocal,e=it?.packet?.provenance?.streetContextFraming,t=it?.packet?.target?.baseline;if(!n||!t||!Number.isFinite(e?.assumedVerticalFovDeg))return;let i=Xu(t),s=e.frontWallTargetLocal,r={x:s?.x??i.x,y:e.targetY,z:s?.z??i.z};_s=!1,xs="wide-street",document.body.classList.remove("source-frame"),document.body.classList.add("wide-street-frame"),ys(),ln.enabled=!1,st.fov=e.assumedVerticalFovDeg,st.aspect=St.clientWidth/St.clientHeight,st.position.set(n.x,n.y,n.z),st.lookAt(r.x,r.y,r.z),st.updateProjectionMatrix(),Zu(),Lt("mode").textContent=`Wide inspection context \xB7 inferred ${e.inferredHorizontalDistanceM.toFixed(1)} m source-side eye at y ${n.y.toFixed(3)} m \xB7 assumed ${e.assumedVerticalFovDeg}\xB0 vertical FOV`}function Zu(){St.dataset.cameraState=JSON.stringify({kind:"wide-street-eye",position:st.position.toArray(),quaternion:st.quaternion.toArray(),projectionMatrix:st.projectionMatrix.elements,verticalFovDeg:st.fov,aspect:st.aspect,viewport:{width:St.clientWidth,height:St.clientHeight}})}function vo(n){let e=it?.packet?.provenance?.source;e&&(mr.src=e.publicCropUrl,mr.style.setProperty("--source-opacity",String(n/100)),mr.classList.toggle("active",n>0),document.querySelectorAll("[data-overlay]").forEach(t=>t.setAttribute("aria-pressed",String(Number(t.dataset.overlay)===n))),Lt("mode").textContent=n===0?"Model only \xB7 source 0%":n===100?"Dated source only \xB7 source 100%":`Shared source viewport \xB7 source ${n}% overlay`)}function ic(n){if(!it)return;let e=xs;it.group?.removeFromParent(),it.resource?.dispose();let t=n==="candidate"?it.packet.target.candidate:it.packet.target.baseline,i=new an;Ai.add(i);let s=ec({parent:i,targetOriginRD:t.geometry.frame.originRD,targetOffsetNAP:.65,observedFacades:n==="candidate",candidateRegistrationPreview:n==="candidate",proceduralFacades:!1,contextualFacades:!1,contextualPalette:!0})([t]);s.setLod(t.id,"detail"),s.flush();let r=gs?ec({parent:i,targetOriginRD:t.geometry.frame.originRD,targetOffsetNAP:.65,observedFacades:!1,candidateRegistrationPreview:!1,proceduralFacades:!1,contextualFacades:!1,contextualPalette:!0})(it.packet.contextOwners):null;r?.flush(),it.group=i,it.resource={dispose:()=>{s.dispose(),r?.dispose()}},St.dataset.runtimeStats=JSON.stringify({kind:"source-to-owner-preview",view:n,contextVisible:gs,target:s.stats,context:r?.stats??null,viewport:{width:St.clientWidth,height:St.clientHeight}}),_s=!1,document.body.classList.remove("source-frame"),ln.enabled=!0,st.fov=39,st.updateProjectionMatrix(),nc(t,"oblique"),document.querySelectorAll("[data-view]").forEach(a=>a.setAttribute("aria-pressed",String(a.dataset.view===n))),Lt("context").setAttribute("aria-pressed",String(gs)),Lt("mode").textContent=n==="candidate"?it.packet.target.candidateLabel??"Approximate source-to-owner candidate":"Baseline LoD2.2 building",e==="wide-street"&&Yu(),e==="source"&&qu(t)}function ys(){_s||(st.aspect=St.clientWidth/St.clientHeight,st.updateProjectionMatrix(),xs==="wide-street"&&Zu()),ms.setSize(St.clientWidth,St.clientHeight,!1)}new ResizeObserver(ys).observe(St);ys();document.querySelectorAll("[data-view]").forEach(n=>n.onclick=()=>ic(n.dataset.view));Lt("context").onclick=()=>{gs=!gs,ic(document.querySelector("[data-view][aria-pressed=true]")?.dataset.view)};Lt("street").onclick=()=>it&&qu(it.packet.target[document.querySelector("[data-view][aria-pressed=true]")?.dataset.view]);Lt("wide-street").onclick=()=>it&&Yu();Lt("front").onclick=()=>{it&&(_s=!1,ln.enabled=!0,st.fov=39,st.updateProjectionMatrix(),vo(0),ys(),nc(it.packet.target[document.querySelector("[data-view][aria-pressed=true]")?.dataset.view],"front"))};Lt("oblique").onclick=()=>{it&&(_s=!1,ln.enabled=!0,st.fov=39,st.updateProjectionMatrix(),vo(0),ys(),nc(it.packet.target[document.querySelector("[data-view][aria-pressed=true]")?.dataset.view],"oblique"))};document.querySelectorAll("[data-overlay]").forEach(n=>n.onclick=()=>vo(Number(n.dataset.overlay)));fetch(K_,{cache:"no-store"}).then(n=>{if(!n.ok)throw Error(`Preview packet unavailable (${n.status})`);return n.json()}).then(n=>{it={packet:n},mr.src=n.provenance.source.publicCropUrl,document.title=`${n.target.caseId} \xB7 source-to-owner city preview`,document.documentElement.style.setProperty("--source-width",String(n.provenance.source.dimensions.width)),document.documentElement.style.setProperty("--source-height",String(n.provenance.source.dimensions.height)),Lt("preview-address").textContent=n.target.address,Lt("candidate-label").textContent=n.target.candidateLabel??"Candidate";let e=document.getElementById("candidate-scope");e&&n.target.scopeNote&&(e.textContent=n.target.scopeNote),mr.alt=`Dated ${n.target.caseId} full-facade source, shown only as an unregistered review overlay`,Lt("status").textContent=`${n.contextOwners.length} active-release neighbours \xB7 target remains a separate preview`,Lt("details").textContent=JSON.stringify({provenance:n.provenance,baselineGeometryRevision:n.target.baseline.geometryRevision,candidateGeometryRevision:n.target.candidate.geometryRevision},null,2),ic("candidate"),vo(0)}).catch(n=>{Lt("status").textContent=String(n)});function $u(){requestAnimationFrame($u),ln.enabled&&ln.update(),ms.render(Ai,st);let n=JSON.parse(St.dataset.runtimeStats??"{}");St.dataset.runtimeStats=JSON.stringify({...n,renderer:{calls:ms.info.render.calls,triangles:ms.info.render.triangles},cameraMode:xs,contextVisible:gs,viewport:{width:St.clientWidth,height:St.clientHeight}})}$u();
/*! Bundled license information:

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/

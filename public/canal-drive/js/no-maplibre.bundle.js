var Zu=0,Wl=1,$u=2;var is=1,Ju=2,_r=3,Xn=0,qt=1,Pn=2,In=0,Fi=1,Xl=2,ql=3,Yl=4,Ku=5;var fi=100,ju=101,Qu=102,eh=103,th=104,nh=200,ih=201,rh=202,sh=203,ao=204,lo=205,oh=206,ah=207,lh=208,ch=209,uh=210,hh=211,dh=212,fh=213,ph=214,co=0,uo=1,ho=2,Ui=3,fo=4,po=5,mo=6,go=7,Go=0,mh=1,gh=2,xn=0,Zl=1,$l=2,Jl=3,Kl=4,jl=5,Ql=6,ec=7;var tc=300,_i=301,zi=302,Ho=303,Wo=304,rs=306,xo=1e3,Tn=1001,yo=1002,Ct=1003,xh=1004;var ss=1005;var Nt=1006,Xo=1007;var Ln=1008;var Jt=1009,nc=1010,ic=1011,vr=1012,qo=1013,yn=1014,_n=1015,Dn=1016,Yo=1017,Zo=1018,br=1020,rc=35902,sc=35899,oc=1021,ac=1022,cn=1023,An=1026,vi=1027,lc=1028,$o=1029,bi=1030,Jo=1031;var Ko=1033,os=33776,as=33777,ls=33778,cs=33779,jo=35840,Qo=35841,ea=35842,ta=35843,na=36196,ia=37492,ra=37496,sa=37488,oa=37489,us=37490,aa=37491,la=37808,ca=37809,ua=37810,ha=37811,da=37812,fa=37813,pa=37814,ma=37815,ga=37816,xa=37817,ya=37818,_a=37819,va=37820,ba=37821,Ma=36492,Sa=36494,wa=36495,Ea=36283,Ta=36284,hs=36285,Aa=36286;var Gr=2300,_o=2301,oo=2302,Nl=2303,Fl=2400,Ul=2401,Ol=2402;var yh=3200;var Ra=0,_h=1,Jn="",Xt="srgb",qn="srgb-linear",Hr="linear",Ye="srgb";var Di=7680;var Bl=519,vh=512,bh=513,Mh=514,Ca=515,Sh=516,wh=517,Pa=518,Eh=519,kl=35044;var cc="300 es",gn=2e3,hr=2001;function dp(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function fp(n){return ArrayBuffer.isView(n)&&!(n instanceof DataView)}function Wr(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function Th(){let n=Wr("canvas");return n.style.display="block",n}var Ru={},dr=null;function uc(...n){let e="THREE."+n.shift();dr?dr("log",e,...n):console.log(e,...n)}function Ah(n){let e=n[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=n[1];t&&t.isStackTrace?n[0]+=" "+t.getLocation():n[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return n}function Ae(...n){n=Ah(n);let e="THREE."+n.shift();if(dr)dr("warn",e,...n);else{let t=n[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...n)}}function Re(...n){n=Ah(n);let e="THREE."+n.shift();if(dr)dr("error",e,...n);else{let t=n[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...n)}}function Ni(...n){let e=n.join(" ");e in Ru||(Ru[e]=!0,Ae(...n))}function Rh(n,e,t){return new Promise(function(i,r){function s(){switch(n.clientWaitSync(e,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:r();break;case n.TIMEOUT_EXPIRED:setTimeout(s,t);break;default:i()}}setTimeout(s,t)})}var Ch={[co]:uo,[ho]:mo,[fo]:go,[Ui]:po,[uo]:co,[mo]:ho,[go]:fo,[po]:Ui},Rn=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){let i=this._listeners;return i===void 0?!1:i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){let i=this._listeners;if(i===void 0)return;let r=i[e];if(r!==void 0){let s=r.indexOf(t);s!==-1&&r.splice(s,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let i=t[e.type];if(i!==void 0){e.target=this;let r=i.slice(0);for(let s=0,o=r.length;s<o;s++)r[s].call(this,e);e.target=null}}},kt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var ul=Math.PI/180,vo=180/Math.PI;function ds(){let n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(kt[n&255]+kt[n>>8&255]+kt[n>>16&255]+kt[n>>24&255]+"-"+kt[e&255]+kt[e>>8&255]+"-"+kt[e>>16&15|64]+kt[e>>24&255]+"-"+kt[t&63|128]+kt[t>>8&255]+"-"+kt[t>>16&255]+kt[t>>24&255]+kt[i&255]+kt[i>>8&255]+kt[i>>16&255]+kt[i>>24&255]).toLowerCase()}function Ve(n,e,t){return Math.max(e,Math.min(t,n))}function pp(n,e){return(n%e+e)%e}function hl(n,e,t){return(1-t)*n+t*e}function Or(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function $t(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Be=class n{static{n.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,i=this.y,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6],this.y=r[1]*t+r[4]*i+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Ve(this.x,e.x,t.x),this.y=Ve(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=Ve(this.x,e,t),this.y=Ve(this.y,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Ve(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(Ve(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let i=Math.cos(t),r=Math.sin(t),s=this.x-e.x,o=this.y-e.y;return this.x=s*i-o*r+e.x,this.y=s*r+o*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Cn=class{constructor(e=0,t=0,i=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=r}static slerpFlat(e,t,i,r,s,o,a){let c=i[r+0],l=i[r+1],u=i[r+2],f=i[r+3],h=s[o+0],m=s[o+1],g=s[o+2],x=s[o+3];if(f!==x||c!==h||l!==m||u!==g){let d=c*h+l*m+u*g+f*x;d<0&&(h=-h,m=-m,g=-g,x=-x,d=-d);let p=1-a;if(d<.9995){let M=Math.acos(d),S=Math.sin(M);p=Math.sin(p*M)/S,a=Math.sin(a*M)/S,c=c*p+h*a,l=l*p+m*a,u=u*p+g*a,f=f*p+x*a}else{c=c*p+h*a,l=l*p+m*a,u=u*p+g*a,f=f*p+x*a;let M=1/Math.sqrt(c*c+l*l+u*u+f*f);c*=M,l*=M,u*=M,f*=M}}e[t]=c,e[t+1]=l,e[t+2]=u,e[t+3]=f}static multiplyQuaternionsFlat(e,t,i,r,s,o){let a=i[r],c=i[r+1],l=i[r+2],u=i[r+3],f=s[o],h=s[o+1],m=s[o+2],g=s[o+3];return e[t]=a*g+u*f+c*m-l*h,e[t+1]=c*g+u*h+l*f-a*m,e[t+2]=l*g+u*m+a*h-c*f,e[t+3]=u*g-a*f-c*h-l*m,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,r){return this._x=e,this._y=t,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let i=e._x,r=e._y,s=e._z,o=e._order,a=Math.cos,c=Math.sin,l=a(i/2),u=a(r/2),f=a(s/2),h=c(i/2),m=c(r/2),g=c(s/2);switch(o){case"XYZ":this._x=h*u*f+l*m*g,this._y=l*m*f-h*u*g,this._z=l*u*g+h*m*f,this._w=l*u*f-h*m*g;break;case"YXZ":this._x=h*u*f+l*m*g,this._y=l*m*f-h*u*g,this._z=l*u*g-h*m*f,this._w=l*u*f+h*m*g;break;case"ZXY":this._x=h*u*f-l*m*g,this._y=l*m*f+h*u*g,this._z=l*u*g+h*m*f,this._w=l*u*f-h*m*g;break;case"ZYX":this._x=h*u*f-l*m*g,this._y=l*m*f+h*u*g,this._z=l*u*g-h*m*f,this._w=l*u*f+h*m*g;break;case"YZX":this._x=h*u*f+l*m*g,this._y=l*m*f+h*u*g,this._z=l*u*g-h*m*f,this._w=l*u*f-h*m*g;break;case"XZY":this._x=h*u*f-l*m*g,this._y=l*m*f-h*u*g,this._z=l*u*g+h*m*f,this._w=l*u*f+h*m*g;break;default:Ae("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let i=t/2,r=Math.sin(i);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,i=t[0],r=t[4],s=t[8],o=t[1],a=t[5],c=t[9],l=t[2],u=t[6],f=t[10],h=i+a+f;if(h>0){let m=.5/Math.sqrt(h+1);this._w=.25/m,this._x=(u-c)*m,this._y=(s-l)*m,this._z=(o-r)*m}else if(i>a&&i>f){let m=2*Math.sqrt(1+i-a-f);this._w=(u-c)/m,this._x=.25*m,this._y=(r+o)/m,this._z=(s+l)/m}else if(a>f){let m=2*Math.sqrt(1+a-i-f);this._w=(s-l)/m,this._x=(r+o)/m,this._y=.25*m,this._z=(c+u)/m}else{let m=2*Math.sqrt(1+f-i-a);this._w=(o-r)/m,this._x=(s+l)/m,this._y=(c+u)/m,this._z=.25*m}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<1e-8?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Ve(this.dot(e),-1,1)))}rotateTowards(e,t){let i=this.angleTo(e);if(i===0)return this;let r=Math.min(1,t/i);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let i=e._x,r=e._y,s=e._z,o=e._w,a=t._x,c=t._y,l=t._z,u=t._w;return this._x=i*u+o*a+r*l-s*c,this._y=r*u+o*c+s*a-i*l,this._z=s*u+o*l+i*c-r*a,this._w=o*u-i*a-r*c-s*l,this._onChangeCallback(),this}slerp(e,t){let i=e._x,r=e._y,s=e._z,o=e._w,a=this.dot(e);a<0&&(i=-i,r=-r,s=-s,o=-o,a=-a);let c=1-t;if(a<.9995){let l=Math.acos(a),u=Math.sin(l);c=Math.sin(c*l)/u,t=Math.sin(t*l)/u,this._x=this._x*c+i*t,this._y=this._y*c+r*t,this._z=this._z*c+s*t,this._w=this._w*c+o*t,this._onChangeCallback()}else this._x=this._x*c+i*t,this._y=this._y*c+r*t,this._z=this._z*c+s*t,this._w=this._w*c+o*t,this.normalize();return this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),r=Math.sqrt(1-i),s=Math.sqrt(i);return this.set(r*Math.sin(e),r*Math.cos(e),s*Math.sin(t),s*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},k=class n{static{n.prototype.isVector3=!0}constructor(e=0,t=0,i=0){this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Cu.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Cu.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[3]*i+s[6]*r,this.y=s[1]*t+s[4]*i+s[7]*r,this.z=s[2]*t+s[5]*i+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,i=this.y,r=this.z,s=e.elements,o=1/(s[3]*t+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*t+s[4]*i+s[8]*r+s[12])*o,this.y=(s[1]*t+s[5]*i+s[9]*r+s[13])*o,this.z=(s[2]*t+s[6]*i+s[10]*r+s[14])*o,this}applyQuaternion(e){let t=this.x,i=this.y,r=this.z,s=e.x,o=e.y,a=e.z,c=e.w,l=2*(o*r-a*i),u=2*(a*t-s*r),f=2*(s*i-o*t);return this.x=t+c*l+o*f-a*u,this.y=i+c*u+a*l-s*f,this.z=r+c*f+s*u-o*l,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[4]*i+s[8]*r,this.y=s[1]*t+s[5]*i+s[9]*r,this.z=s[2]*t+s[6]*i+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Ve(this.x,e.x,t.x),this.y=Ve(this.y,e.y,t.y),this.z=Ve(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=Ve(this.x,e,t),this.y=Ve(this.y,e,t),this.z=Ve(this.z,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Ve(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let i=e.x,r=e.y,s=e.z,o=t.x,a=t.y,c=t.z;return this.x=r*c-s*a,this.y=s*o-i*c,this.z=i*a-r*o,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return dl.copy(this).projectOnVector(e),this.sub(dl)}reflect(e){return this.sub(dl.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(Ve(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y,r=this.z-e.z;return t*t+i*i+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){let r=Math.sin(t)*e;return this.x=r*Math.sin(i),this.y=Math.cos(t)*e,this.z=r*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},dl=new k,Cu=new Cn,Ie=class n{static{n.prototype.isMatrix3=!0}constructor(e,t,i,r,s,o,a,c,l){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,o,a,c,l)}set(e,t,i,r,s,o,a,c,l){let u=this.elements;return u[0]=e,u[1]=r,u[2]=a,u[3]=t,u[4]=s,u[5]=c,u[6]=i,u[7]=o,u[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,r=t.elements,s=this.elements,o=i[0],a=i[3],c=i[6],l=i[1],u=i[4],f=i[7],h=i[2],m=i[5],g=i[8],x=r[0],d=r[3],p=r[6],M=r[1],S=r[4],v=r[7],w=r[2],E=r[5],R=r[8];return s[0]=o*x+a*M+c*w,s[3]=o*d+a*S+c*E,s[6]=o*p+a*v+c*R,s[1]=l*x+u*M+f*w,s[4]=l*d+u*S+f*E,s[7]=l*p+u*v+f*R,s[2]=h*x+m*M+g*w,s[5]=h*d+m*S+g*E,s[8]=h*p+m*v+g*R,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],c=e[6],l=e[7],u=e[8];return t*o*u-t*a*l-i*s*u+i*a*c+r*s*l-r*o*c}invert(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],c=e[6],l=e[7],u=e[8],f=u*o-a*l,h=a*c-u*s,m=l*s-o*c,g=t*f+i*h+r*m;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let x=1/g;return e[0]=f*x,e[1]=(r*l-u*i)*x,e[2]=(a*i-r*o)*x,e[3]=h*x,e[4]=(u*t-r*c)*x,e[5]=(r*s-a*t)*x,e[6]=m*x,e[7]=(i*c-l*t)*x,e[8]=(o*t-i*s)*x,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,r,s,o,a){let c=Math.cos(s),l=Math.sin(s);return this.set(i*c,i*l,-i*(c*o+l*a)+o+e,-r*l,r*c,-r*(-l*o+c*a)+a+t,0,0,1),this}scale(e,t){return Ni("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(fl.makeScale(e,t)),this}rotate(e){return Ni("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(fl.makeRotation(-e)),this}translate(e,t){return Ni("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(fl.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,i=e.elements;for(let r=0;r<9;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}},fl=new Ie,Pu=new Ie().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Iu=new Ie().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function mp(){let n={enabled:!0,workingColorSpace:qn,spaces:{},convert:function(r,s,o){return this.enabled===!1||s===o||!s||!o||(this.spaces[s].transfer===Ye&&(r.r=Wn(r.r),r.g=Wn(r.g),r.b=Wn(r.b)),this.spaces[s].primaries!==this.spaces[o].primaries&&(r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===Ye&&(r.r=ur(r.r),r.g=ur(r.g),r.b=ur(r.b))),r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){return r===Jn?Hr:this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,o){return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,s){return Ni("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),n.workingToColorSpace(r,s)},toWorkingColorSpace:function(r,s){return Ni("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),n.colorSpaceToWorking(r,s)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],i=[.3127,.329];return n.define({[qn]:{primaries:e,whitePoint:i,transfer:Hr,toXYZ:Pu,fromXYZ:Iu,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Xt},outputColorSpaceConfig:{drawingBufferColorSpace:Xt}},[Xt]:{primaries:e,whitePoint:i,transfer:Ye,toXYZ:Pu,fromXYZ:Iu,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Xt}}}),n}var ze=mp();function Wn(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function ur(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}var ji,bo=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let i;if(e instanceof HTMLCanvasElement)i=e;else{ji===void 0&&(ji=Wr("canvas")),ji.width=e.width,ji.height=e.height;let r=ji.getContext("2d");e instanceof ImageData?r.putImageData(e,0,0):r.drawImage(e,0,0,e.width,e.height),i=ji}return i.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=Wr("canvas");t.width=e.width,t.height=e.height;let i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);let r=i.getImageData(0,0,e.width,e.height),s=r.data;for(let o=0;o<s.length;o++)s[o]=Wn(s[o]/255)*255;return i.putImageData(r,0,0),t}else if(e.data){let t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor(Wn(t[i]/255)*255):t[i]=Wn(t[i]);return{data:t,width:e.width,height:e.height}}else return Ae("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},gp=0,fr=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:gp++}),this.uuid=ds(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let i={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let o=0,a=r.length;o<a;o++)r[o].isDataTexture?s.push(pl(r[o].image)):s.push(pl(r[o]))}else s=pl(r);i.url=s}return t||(e.images[this.uuid]=i),i}};function pl(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?bo.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(Ae("Texture: Unable to serialize Texture."),{})}var xp=0,ml=new k,Ft=class n extends Rn{constructor(e=n.DEFAULT_IMAGE,t=n.DEFAULT_MAPPING,i=Tn,r=Tn,s=Nt,o=Ln,a=cn,c=Jt,l=n.DEFAULT_ANISOTROPY,u=Jn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:xp++}),this.uuid=ds(),this.name="",this.source=new fr(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=o,this.anisotropy=l,this.format=a,this.internalFormat=null,this.type=c,this.offset=new Be(0,0),this.repeat=new Be(1,1),this.center=new Be(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ie,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(ml).x}get height(){return this.source.getSize(ml).y}get depth(){return this.source.getSize(ml).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let i=e[t];if(i===void 0){Ae(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){Ae(`Texture.setValues(): property '${t}' does not exist.`);continue}r&&i&&r.isVector2&&i.isVector2||r&&i&&r.isVector3&&i.isVector3||r&&i&&r.isMatrix3&&i.isMatrix3?r.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==tc)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case xo:e.x=e.x-Math.floor(e.x);break;case Tn:e.x=e.x<0?0:1;break;case yo:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case xo:e.y=e.y-Math.floor(e.y);break;case Tn:e.y=e.y<0?0:1;break;case yo:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Ft.DEFAULT_IMAGE=null;Ft.DEFAULT_MAPPING=tc;Ft.DEFAULT_ANISOTROPY=1;var rt=class n{static{n.prototype.isVector4=!0}constructor(e=0,t=0,i=0,r=1){this.x=e,this.y=t,this.z=i,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,r){return this.x=e,this.y=t,this.z=i,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,i=this.y,r=this.z,s=this.w,o=e.elements;return this.x=o[0]*t+o[4]*i+o[8]*r+o[12]*s,this.y=o[1]*t+o[5]*i+o[9]*r+o[13]*s,this.z=o[2]*t+o[6]*i+o[10]*r+o[14]*s,this.w=o[3]*t+o[7]*i+o[11]*r+o[15]*s,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,r,s,c=e.elements,l=c[0],u=c[4],f=c[8],h=c[1],m=c[5],g=c[9],x=c[2],d=c[6],p=c[10];if(Math.abs(u-h)<.01&&Math.abs(f-x)<.01&&Math.abs(g-d)<.01){if(Math.abs(u+h)<.1&&Math.abs(f+x)<.1&&Math.abs(g+d)<.1&&Math.abs(l+m+p-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let S=(l+1)/2,v=(m+1)/2,w=(p+1)/2,E=(u+h)/4,R=(f+x)/4,_=(g+d)/4;return S>v&&S>w?S<.01?(i=0,r=.707106781,s=.707106781):(i=Math.sqrt(S),r=E/i,s=R/i):v>w?v<.01?(i=.707106781,r=0,s=.707106781):(r=Math.sqrt(v),i=E/r,s=_/r):w<.01?(i=.707106781,r=.707106781,s=0):(s=Math.sqrt(w),i=R/s,r=_/s),this.set(i,r,s,t),this}let M=Math.sqrt((d-g)*(d-g)+(f-x)*(f-x)+(h-u)*(h-u));return Math.abs(M)<.001&&(M=1),this.x=(d-g)/M,this.y=(f-x)/M,this.z=(h-u)/M,this.w=Math.acos((l+m+p-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Ve(this.x,e.x,t.x),this.y=Ve(this.y,e.y,t.y),this.z=Ve(this.z,e.z,t.z),this.w=Ve(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=Ve(this.x,e,t),this.y=Ve(this.y,e,t),this.z=Ve(this.z,e,t),this.w=Ve(this.w,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Ve(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Mo=class extends Rn{constructor(e=1,t=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Nt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=i.depth,this.scissor=new rt(0,0,e,t),this.scissorTest=!1,this.viewport=new rt(0,0,e,t),this.textures=[];let r={width:e,height:t,depth:i.depth},s=new Ft(r),o=i.count;for(let a=0;a<o;a++)this.textures[a]=s.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:Nt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let r=0,s=this.textures.length;r<s;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=i,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,i=e.textures.length;t<i;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let r=Object.assign({},e.textures[t].image);this.textures[t].source=new fr(r)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},nn=class extends Mo{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}},Xr=class extends Ft{constructor(e=null,t=1,i=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=Ct,this.minFilter=Ct,this.wrapR=Tn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var So=class extends Ft{constructor(e=null,t=1,i=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=Ct,this.minFilter=Ct,this.wrapR=Tn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var st=class n{static{n.prototype.isMatrix4=!0}constructor(e,t,i,r,s,o,a,c,l,u,f,h,m,g,x,d){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,o,a,c,l,u,f,h,m,g,x,d)}set(e,t,i,r,s,o,a,c,l,u,f,h,m,g,x,d){let p=this.elements;return p[0]=e,p[4]=t,p[8]=i,p[12]=r,p[1]=s,p[5]=o,p[9]=a,p[13]=c,p[2]=l,p[6]=u,p[10]=f,p[14]=h,p[3]=m,p[7]=g,p[11]=x,p[15]=d,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new n().fromArray(this.elements)}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){let t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),i.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,i=e.elements,r=1/Qi.setFromMatrixColumn(e,0).length(),s=1/Qi.setFromMatrixColumn(e,1).length(),o=1/Qi.setFromMatrixColumn(e,2).length();return t[0]=i[0]*r,t[1]=i[1]*r,t[2]=i[2]*r,t[3]=0,t[4]=i[4]*s,t[5]=i[5]*s,t[6]=i[6]*s,t[7]=0,t[8]=i[8]*o,t[9]=i[9]*o,t[10]=i[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,i=e.x,r=e.y,s=e.z,o=Math.cos(i),a=Math.sin(i),c=Math.cos(r),l=Math.sin(r),u=Math.cos(s),f=Math.sin(s);if(e.order==="XYZ"){let h=o*u,m=o*f,g=a*u,x=a*f;t[0]=c*u,t[4]=-c*f,t[8]=l,t[1]=m+g*l,t[5]=h-x*l,t[9]=-a*c,t[2]=x-h*l,t[6]=g+m*l,t[10]=o*c}else if(e.order==="YXZ"){let h=c*u,m=c*f,g=l*u,x=l*f;t[0]=h+x*a,t[4]=g*a-m,t[8]=o*l,t[1]=o*f,t[5]=o*u,t[9]=-a,t[2]=m*a-g,t[6]=x+h*a,t[10]=o*c}else if(e.order==="ZXY"){let h=c*u,m=c*f,g=l*u,x=l*f;t[0]=h-x*a,t[4]=-o*f,t[8]=g+m*a,t[1]=m+g*a,t[5]=o*u,t[9]=x-h*a,t[2]=-o*l,t[6]=a,t[10]=o*c}else if(e.order==="ZYX"){let h=o*u,m=o*f,g=a*u,x=a*f;t[0]=c*u,t[4]=g*l-m,t[8]=h*l+x,t[1]=c*f,t[5]=x*l+h,t[9]=m*l-g,t[2]=-l,t[6]=a*c,t[10]=o*c}else if(e.order==="YZX"){let h=o*c,m=o*l,g=a*c,x=a*l;t[0]=c*u,t[4]=x-h*f,t[8]=g*f+m,t[1]=f,t[5]=o*u,t[9]=-a*u,t[2]=-l*u,t[6]=m*f+g,t[10]=h-x*f}else if(e.order==="XZY"){let h=o*c,m=o*l,g=a*c,x=a*l;t[0]=c*u,t[4]=-f,t[8]=l*u,t[1]=h*f+x,t[5]=o*u,t[9]=m*f-g,t[2]=g*f-m,t[6]=a*u,t[10]=x*f+h}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(yp,e,_p)}lookAt(e,t,i){let r=this.elements;return Qt.subVectors(e,t),Qt.lengthSq()===0&&(Qt.z=1),Qt.normalize(),oi.crossVectors(i,Qt),oi.lengthSq()===0&&(Math.abs(i.z)===1?Qt.x+=1e-4:Qt.z+=1e-4,Qt.normalize(),oi.crossVectors(i,Qt)),oi.normalize(),zs.crossVectors(Qt,oi),r[0]=oi.x,r[4]=zs.x,r[8]=Qt.x,r[1]=oi.y,r[5]=zs.y,r[9]=Qt.y,r[2]=oi.z,r[6]=zs.z,r[10]=Qt.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,r=t.elements,s=this.elements,o=i[0],a=i[4],c=i[8],l=i[12],u=i[1],f=i[5],h=i[9],m=i[13],g=i[2],x=i[6],d=i[10],p=i[14],M=i[3],S=i[7],v=i[11],w=i[15],E=r[0],R=r[4],_=r[8],A=r[12],I=r[1],C=r[5],U=r[9],X=r[13],Y=r[2],N=r[6],G=r[10],H=r[14],K=r[3],Q=r[7],ee=r[11],ce=r[15];return s[0]=o*E+a*I+c*Y+l*K,s[4]=o*R+a*C+c*N+l*Q,s[8]=o*_+a*U+c*G+l*ee,s[12]=o*A+a*X+c*H+l*ce,s[1]=u*E+f*I+h*Y+m*K,s[5]=u*R+f*C+h*N+m*Q,s[9]=u*_+f*U+h*G+m*ee,s[13]=u*A+f*X+h*H+m*ce,s[2]=g*E+x*I+d*Y+p*K,s[6]=g*R+x*C+d*N+p*Q,s[10]=g*_+x*U+d*G+p*ee,s[14]=g*A+x*X+d*H+p*ce,s[3]=M*E+S*I+v*Y+w*K,s[7]=M*R+S*C+v*N+w*Q,s[11]=M*_+S*U+v*G+w*ee,s[15]=M*A+S*X+v*H+w*ce,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[4],r=e[8],s=e[12],o=e[1],a=e[5],c=e[9],l=e[13],u=e[2],f=e[6],h=e[10],m=e[14],g=e[3],x=e[7],d=e[11],p=e[15],M=c*m-l*h,S=a*m-l*f,v=a*h-c*f,w=o*m-l*u,E=o*h-c*u,R=o*f-a*u;return t*(x*M-d*S+p*v)-i*(g*M-d*w+p*E)+r*(g*S-x*w+p*R)-s*(g*v-x*E+d*R)}determinantAffine(){let e=this.elements,t=e[0],i=e[4],r=e[8],s=e[1],o=e[5],a=e[9],c=e[2],l=e[6],u=e[10];return t*(o*u-a*l)-i*(s*u-a*c)+r*(s*l-o*c)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=i),this}invert(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],c=e[6],l=e[7],u=e[8],f=e[9],h=e[10],m=e[11],g=e[12],x=e[13],d=e[14],p=e[15],M=t*a-i*o,S=t*c-r*o,v=t*l-s*o,w=i*c-r*a,E=i*l-s*a,R=r*l-s*c,_=u*x-f*g,A=u*d-h*g,I=u*p-m*g,C=f*d-h*x,U=f*p-m*x,X=h*p-m*d,Y=M*X-S*U+v*C+w*I-E*A+R*_;if(Y===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let N=1/Y;return e[0]=(a*X-c*U+l*C)*N,e[1]=(r*U-i*X-s*C)*N,e[2]=(x*R-d*E+p*w)*N,e[3]=(h*E-f*R-m*w)*N,e[4]=(c*I-o*X-l*A)*N,e[5]=(t*X-r*I+s*A)*N,e[6]=(d*v-g*R-p*S)*N,e[7]=(u*R-h*v+m*S)*N,e[8]=(o*U-a*I+l*_)*N,e[9]=(i*I-t*U-s*_)*N,e[10]=(g*E-x*v+p*M)*N,e[11]=(f*v-u*E-m*M)*N,e[12]=(a*A-o*C-c*_)*N,e[13]=(t*C-i*A+r*_)*N,e[14]=(x*S-g*w-d*M)*N,e[15]=(u*w-f*S+h*M)*N,this}scale(e){let t=this.elements,i=e.x,r=e.y,s=e.z;return t[0]*=i,t[4]*=r,t[8]*=s,t[1]*=i,t[5]*=r,t[9]*=s,t[2]*=i,t[6]*=r,t[10]*=s,t[3]*=i,t[7]*=r,t[11]*=s,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,r))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let i=Math.cos(t),r=Math.sin(t),s=1-i,o=e.x,a=e.y,c=e.z,l=s*o,u=s*a;return this.set(l*o+i,l*a-r*c,l*c+r*a,0,l*a+r*c,u*a+i,u*c-r*o,0,l*c-r*a,u*c+r*o,s*c*c+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,r,s,o){return this.set(1,i,s,0,e,1,o,0,t,r,1,0,0,0,0,1),this}compose(e,t,i){let r=this.elements,s=t._x,o=t._y,a=t._z,c=t._w,l=s+s,u=o+o,f=a+a,h=s*l,m=s*u,g=s*f,x=o*u,d=o*f,p=a*f,M=c*l,S=c*u,v=c*f,w=i.x,E=i.y,R=i.z;return r[0]=(1-(x+p))*w,r[1]=(m+v)*w,r[2]=(g-S)*w,r[3]=0,r[4]=(m-v)*E,r[5]=(1-(h+p))*E,r[6]=(d+M)*E,r[7]=0,r[8]=(g+S)*R,r[9]=(d-M)*R,r[10]=(1-(h+x))*R,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,i){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let s=this.determinantAffine();if(s===0)return i.set(1,1,1),t.identity(),this;let o=Qi.set(r[0],r[1],r[2]).length(),a=Qi.set(r[4],r[5],r[6]).length(),c=Qi.set(r[8],r[9],r[10]).length();s<0&&(o=-o),fn.copy(this);let l=1/o,u=1/a,f=1/c;return fn.elements[0]*=l,fn.elements[1]*=l,fn.elements[2]*=l,fn.elements[4]*=u,fn.elements[5]*=u,fn.elements[6]*=u,fn.elements[8]*=f,fn.elements[9]*=f,fn.elements[10]*=f,t.setFromRotationMatrix(fn),i.x=o,i.y=a,i.z=c,this}makePerspective(e,t,i,r,s,o,a=gn,c=!1){let l=this.elements,u=2*s/(t-e),f=2*s/(i-r),h=(t+e)/(t-e),m=(i+r)/(i-r),g,x;if(c)g=s/(o-s),x=o*s/(o-s);else if(a===gn)g=-(o+s)/(o-s),x=-2*o*s/(o-s);else if(a===hr)g=-o/(o-s),x=-o*s/(o-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return l[0]=u,l[4]=0,l[8]=h,l[12]=0,l[1]=0,l[5]=f,l[9]=m,l[13]=0,l[2]=0,l[6]=0,l[10]=g,l[14]=x,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,i,r,s,o,a=gn,c=!1){let l=this.elements,u=2/(t-e),f=2/(i-r),h=-(t+e)/(t-e),m=-(i+r)/(i-r),g,x;if(c)g=1/(o-s),x=o/(o-s);else if(a===gn)g=-2/(o-s),x=-(o+s)/(o-s);else if(a===hr)g=-1/(o-s),x=-s/(o-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return l[0]=u,l[4]=0,l[8]=0,l[12]=h,l[1]=0,l[5]=f,l[9]=0,l[13]=m,l[2]=0,l[6]=0,l[10]=g,l[14]=x,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){let t=this.elements,i=e.elements;for(let r=0;r<16;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}},Qi=new k,fn=new st,yp=new k(0,0,0),_p=new k(1,1,1),oi=new k,zs=new k,Qt=new k,Lu=new st,Du=new Cn,Yn=class n{constructor(e=0,t=0,i=0,r=n.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,r=this._order){return this._x=e,this._y=t,this._z=i,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){let r=e.elements,s=r[0],o=r[4],a=r[8],c=r[1],l=r[5],u=r[9],f=r[2],h=r[6],m=r[10];switch(t){case"XYZ":this._y=Math.asin(Ve(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-u,m),this._z=Math.atan2(-o,s)):(this._x=Math.atan2(h,l),this._z=0);break;case"YXZ":this._x=Math.asin(-Ve(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(a,m),this._z=Math.atan2(c,l)):(this._y=Math.atan2(-f,s),this._z=0);break;case"ZXY":this._x=Math.asin(Ve(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(-f,m),this._z=Math.atan2(-o,l)):(this._y=0,this._z=Math.atan2(c,s));break;case"ZYX":this._y=Math.asin(-Ve(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(h,m),this._z=Math.atan2(c,s)):(this._x=0,this._z=Math.atan2(-o,l));break;case"YZX":this._z=Math.asin(Ve(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-u,l),this._y=Math.atan2(-f,s)):(this._x=0,this._y=Math.atan2(a,m));break;case"XZY":this._z=Math.asin(-Ve(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(h,l),this._y=Math.atan2(a,s)):(this._x=Math.atan2(-u,m),this._y=0);break;default:Ae("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return Lu.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Lu,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Du.setFromEuler(this),this.setFromQuaternion(Du,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Yn.DEFAULT_ORDER="XYZ";var qr=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},vp=0,Nu=new k,er=new Cn,kn=new st,Vs=new k,Br=new k,bp=new k,Mp=new Cn,Fu=new k(1,0,0),Uu=new k(0,1,0),Ou=new k(0,0,1),Bu={type:"added"},Sp={type:"removed"},tr={type:"childadded",child:null},gl={type:"childremoved",child:null},Pt=class n extends Rn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:vp++}),this.uuid=ds(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=n.DEFAULT_UP.clone();let e=new k,t=new Yn,i=new Cn,r=new k(1,1,1);function s(){i.setFromEuler(t,!1)}function o(){t.setFromQuaternion(i,void 0,!1)}t._onChange(s),i._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new st},normalMatrix:{value:new Ie}}),this.matrix=new st,this.matrixWorld=new st,this.matrixAutoUpdate=n.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=n.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new qr,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return er.setFromAxisAngle(e,t),this.quaternion.multiply(er),this}rotateOnWorldAxis(e,t){return er.setFromAxisAngle(e,t),this.quaternion.premultiply(er),this}rotateX(e){return this.rotateOnAxis(Fu,e)}rotateY(e){return this.rotateOnAxis(Uu,e)}rotateZ(e){return this.rotateOnAxis(Ou,e)}translateOnAxis(e,t){return Nu.copy(e).applyQuaternion(this.quaternion),this.position.add(Nu.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Fu,e)}translateY(e){return this.translateOnAxis(Uu,e)}translateZ(e){return this.translateOnAxis(Ou,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(kn.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?Vs.copy(e):Vs.set(e,t,i);let r=this.parent;this.updateWorldMatrix(!0,!1),Br.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?kn.lookAt(Br,Vs,this.up):kn.lookAt(Vs,Br,this.up),this.quaternion.setFromRotationMatrix(kn),r&&(kn.extractRotation(r.matrixWorld),er.setFromRotationMatrix(kn),this.quaternion.premultiply(er.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Re("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Bu),tr.child=e,this.dispatchEvent(tr),tr.child=null):Re("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Sp),gl.child=e,this.dispatchEvent(gl),gl.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),kn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),kn.multiply(e.parent.matrixWorld)),e.applyMatrix4(kn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Bu),tr.child=e,this.dispatchEvent(tr),tr.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,r=this.children.length;i<r;i++){let o=this.children[i].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);let r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Br,e,bp),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Br,Mp,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,i=e.y,r=e.z,s=this.matrix.elements;s[12]+=t-s[0]*t-s[4]*i-s[8]*r,s[13]+=i-s[1]*t-s[5]*i-s[9]*r,s[14]+=r-s[2]*t-s[6]*i-s[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].updateMatrixWorld(e)}updateWorldMatrix(e,t,i=!1){let r=this.parent;if(e===!0&&r!==null&&r.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),t===!0){let s=this.children;for(let o=0,a=s.length;o<a;o++)s[o].updateWorldMatrix(!1,!0,i)}}toJSON(e){let t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),this.static!==!1&&(r.static=this.static),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(a=>({...a})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function s(a,c){return a[c.uuid]===void 0&&(a[c.uuid]=c.toJSON(e)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let c=a.shapes;if(Array.isArray(c))for(let l=0,u=c.length;l<u;l++){let f=c[l];s(e.shapes,f)}else s(e.shapes,c)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let c=0,l=this.material.length;c<l;c++)a.push(s(e.materials,this.material[c]));r.material=a}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let a=0;a<this.children.length;a++)r.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let a=0;a<this.animations.length;a++){let c=this.animations[a];r.animations.push(s(e.animations,c))}}if(t){let a=o(e.geometries),c=o(e.materials),l=o(e.textures),u=o(e.images),f=o(e.shapes),h=o(e.skeletons),m=o(e.animations),g=o(e.nodes);a.length>0&&(i.geometries=a),c.length>0&&(i.materials=c),l.length>0&&(i.textures=l),u.length>0&&(i.images=u),f.length>0&&(i.shapes=f),h.length>0&&(i.skeletons=h),m.length>0&&(i.animations=m),g.length>0&&(i.nodes=g)}return i.object=r,i;function o(a){let c=[];for(let l in a){let u=a[l];delete u.metadata,c.push(u)}return c}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){let r=e.children[i];this.add(r.clone())}return this}};Pt.DEFAULT_UP=new k(0,1,0);Pt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Pt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var tn=class extends Pt{constructor(){super(),this.isGroup=!0,this.type="Group"}},wp={type:"move"},pr=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new tn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new tn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new k,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new k),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new tn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new k,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new k,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let r=null,s=null,o=null,a=this._targetRay,c=this._grip,l=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(l&&e.hand){o=!0;for(let x of e.hand.values()){let d=t.getJointPose(x,i),p=this._getHandJoint(l,x);d!==null&&(p.matrix.fromArray(d.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=d.radius),p.visible=d!==null}let u=l.joints["index-finger-tip"],f=l.joints["thumb-tip"],h=u.position.distanceTo(f.position),m=.02,g=.005;l.inputState.pinching&&h>m+g?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!l.inputState.pinching&&h<=m-g&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else c!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,i),s!==null&&(c.matrix.fromArray(s.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,s.linearVelocity?(c.hasLinearVelocity=!0,c.linearVelocity.copy(s.linearVelocity)):c.hasLinearVelocity=!1,s.angularVelocity?(c.hasAngularVelocity=!0,c.angularVelocity.copy(s.angularVelocity)):c.hasAngularVelocity=!1,c.eventsEnabled&&c.dispatchEvent({type:"gripUpdated",data:e,target:this})));a!==null&&(r=t.getPose(e.targetRaySpace,i),r===null&&s!==null&&(r=s),r!==null&&(a.matrix.fromArray(r.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,r.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(r.linearVelocity)):a.hasLinearVelocity=!1,r.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(r.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(wp)))}return a!==null&&(a.visible=r!==null),c!==null&&(c.visible=s!==null),l!==null&&(l.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let i=new tn;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}},Ph={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},ai={h:0,s:0,l:0},Gs={h:0,s:0,l:0};function xl(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}var Fe=class{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){let r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Xt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,ze.colorSpaceToWorking(this,t),this}setRGB(e,t,i,r=ze.workingColorSpace){return this.r=e,this.g=t,this.b=i,ze.colorSpaceToWorking(this,r),this}setHSL(e,t,i,r=ze.workingColorSpace){if(e=pp(e,1),t=Ve(t,0,1),i=Ve(i,0,1),t===0)this.r=this.g=this.b=i;else{let s=i<=.5?i*(1+t):i+t-i*t,o=2*i-s;this.r=xl(o,s,e+1/3),this.g=xl(o,s,e),this.b=xl(o,s,e-1/3)}return ze.colorSpaceToWorking(this,r),this}setStyle(e,t=Xt){function i(s){s!==void 0&&parseFloat(s)<1&&Ae("Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s,o=r[1],a=r[2];switch(o){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:Ae("Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let s=r[1],o=s.length;if(o===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(s,16),t);Ae("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Xt){let i=Ph[e.toLowerCase()];return i!==void 0?this.setHex(i,t):Ae("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Wn(e.r),this.g=Wn(e.g),this.b=Wn(e.b),this}copyLinearToSRGB(e){return this.r=ur(e.r),this.g=ur(e.g),this.b=ur(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Xt){return ze.workingToColorSpace(zt.copy(this),e),Math.round(Ve(zt.r*255,0,255))*65536+Math.round(Ve(zt.g*255,0,255))*256+Math.round(Ve(zt.b*255,0,255))}getHexString(e=Xt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=ze.workingColorSpace){ze.workingToColorSpace(zt.copy(this),t);let i=zt.r,r=zt.g,s=zt.b,o=Math.max(i,r,s),a=Math.min(i,r,s),c,l,u=(a+o)/2;if(a===o)c=0,l=0;else{let f=o-a;switch(l=u<=.5?f/(o+a):f/(2-o-a),o){case i:c=(r-s)/f+(r<s?6:0);break;case r:c=(s-i)/f+2;break;case s:c=(i-r)/f+4;break}c/=6}return e.h=c,e.s=l,e.l=u,e}getRGB(e,t=ze.workingColorSpace){return ze.workingToColorSpace(zt.copy(this),t),e.r=zt.r,e.g=zt.g,e.b=zt.b,e}getStyle(e=Xt){ze.workingToColorSpace(zt.copy(this),e);let t=zt.r,i=zt.g,r=zt.b;return e!==Xt?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(r*255)})`}offsetHSL(e,t,i){return this.getHSL(ai),this.setHSL(ai.h+e,ai.s+t,ai.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(ai),e.getHSL(Gs);let i=hl(ai.h,Gs.h,t),r=hl(ai.s,Gs.s,t),s=hl(ai.l,Gs.l,t);return this.setHSL(i,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,i=this.g,r=this.b,s=e.elements;return this.r=s[0]*t+s[3]*i+s[6]*r,this.g=s[1]*t+s[4]*i+s[7]*r,this.b=s[2]*t+s[5]*i+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},zt=new Fe;Fe.NAMES=Ph;var Yr=class extends Pt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Yn,this.environmentIntensity=1,this.environmentRotation=new Yn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}},pn=new k,zn=new k,yl=new k,Vn=new k,nr=new k,ir=new k,ku=new k,_l=new k,vl=new k,bl=new k,Ml=new rt,Sl=new rt,wl=new rt,di=class n{constructor(e=new k,t=new k,i=new k){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,r){r.subVectors(i,t),pn.subVectors(e,t),r.cross(pn);let s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(e,t,i,r,s){pn.subVectors(r,t),zn.subVectors(i,t),yl.subVectors(e,t);let o=pn.dot(pn),a=pn.dot(zn),c=pn.dot(yl),l=zn.dot(zn),u=zn.dot(yl),f=o*l-a*a;if(f===0)return s.set(0,0,0),null;let h=1/f,m=(l*c-a*u)*h,g=(o*u-a*c)*h;return s.set(1-m-g,g,m)}static containsPoint(e,t,i,r){return this.getBarycoord(e,t,i,r,Vn)===null?!1:Vn.x>=0&&Vn.y>=0&&Vn.x+Vn.y<=1}static getInterpolation(e,t,i,r,s,o,a,c){return this.getBarycoord(e,t,i,r,Vn)===null?(c.x=0,c.y=0,"z"in c&&(c.z=0),"w"in c&&(c.w=0),null):(c.setScalar(0),c.addScaledVector(s,Vn.x),c.addScaledVector(o,Vn.y),c.addScaledVector(a,Vn.z),c)}static getInterpolatedAttribute(e,t,i,r,s,o){return Ml.setScalar(0),Sl.setScalar(0),wl.setScalar(0),Ml.fromBufferAttribute(e,t),Sl.fromBufferAttribute(e,i),wl.fromBufferAttribute(e,r),o.setScalar(0),o.addScaledVector(Ml,s.x),o.addScaledVector(Sl,s.y),o.addScaledVector(wl,s.z),o}static isFrontFacing(e,t,i,r){return pn.subVectors(i,t),zn.subVectors(e,t),pn.cross(zn).dot(r)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,r){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,i,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return pn.subVectors(this.c,this.b),zn.subVectors(this.a,this.b),pn.cross(zn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return n.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return n.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,r,s){return n.getInterpolation(e,this.a,this.b,this.c,t,i,r,s)}containsPoint(e){return n.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return n.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let i=this.a,r=this.b,s=this.c,o,a;nr.subVectors(r,i),ir.subVectors(s,i),_l.subVectors(e,i);let c=nr.dot(_l),l=ir.dot(_l);if(c<=0&&l<=0)return t.copy(i);vl.subVectors(e,r);let u=nr.dot(vl),f=ir.dot(vl);if(u>=0&&f<=u)return t.copy(r);let h=c*f-u*l;if(h<=0&&c>=0&&u<=0)return o=c/(c-u),t.copy(i).addScaledVector(nr,o);bl.subVectors(e,s);let m=nr.dot(bl),g=ir.dot(bl);if(g>=0&&m<=g)return t.copy(s);let x=m*l-c*g;if(x<=0&&l>=0&&g<=0)return a=l/(l-g),t.copy(i).addScaledVector(ir,a);let d=u*g-m*f;if(d<=0&&f-u>=0&&m-g>=0)return ku.subVectors(s,r),a=(f-u)/(f-u+(m-g)),t.copy(r).addScaledVector(ku,a);let p=1/(d+x+h);return o=x*p,a=h*p,t.copy(i).addScaledVector(nr,o).addScaledVector(ir,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},pi=class{constructor(e=new k(1/0,1/0,1/0),t=new k(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(mn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(mn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let i=mn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let i=e.geometry;if(i!==void 0){let s=i.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=s.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,mn):mn.fromBufferAttribute(s,o),mn.applyMatrix4(e.matrixWorld),this.expandByPoint(mn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Hs.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),Hs.copy(i.boundingBox)),Hs.applyMatrix4(e.matrixWorld),this.union(Hs)}let r=e.children;for(let s=0,o=r.length;s<o;s++)this.expandByObject(r[s],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,mn),mn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(kr),Ws.subVectors(this.max,kr),rr.subVectors(e.a,kr),sr.subVectors(e.b,kr),or.subVectors(e.c,kr),li.subVectors(sr,rr),ci.subVectors(or,sr),Ci.subVectors(rr,or);let t=[0,-li.z,li.y,0,-ci.z,ci.y,0,-Ci.z,Ci.y,li.z,0,-li.x,ci.z,0,-ci.x,Ci.z,0,-Ci.x,-li.y,li.x,0,-ci.y,ci.x,0,-Ci.y,Ci.x,0];return!El(t,rr,sr,or,Ws)||(t=[1,0,0,0,1,0,0,0,1],!El(t,rr,sr,or,Ws))?!1:(Xs.crossVectors(li,ci),t=[Xs.x,Xs.y,Xs.z],El(t,rr,sr,or,Ws))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,mn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(mn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Gn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Gn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Gn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Gn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Gn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Gn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Gn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Gn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Gn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},Gn=[new k,new k,new k,new k,new k,new k,new k,new k],mn=new k,Hs=new pi,rr=new k,sr=new k,or=new k,li=new k,ci=new k,Ci=new k,kr=new k,Ws=new k,Xs=new k,Pi=new k;function El(n,e,t,i,r){for(let s=0,o=n.length-3;s<=o;s+=3){Pi.fromArray(n,s);let a=r.x*Math.abs(Pi.x)+r.y*Math.abs(Pi.y)+r.z*Math.abs(Pi.z),c=e.dot(Pi),l=t.dot(Pi),u=i.dot(Pi);if(Math.max(-Math.max(c,l,u),Math.min(c,l,u))>a)return!1}return!0}var yt=new k,qs=new Be,Ep=0,Ke=class extends Rn{constructor(e,t,i=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Ep++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=kl,this.updateRanges=[],this.gpuType=_n,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let r=0,s=this.itemSize;r<s;r++)this.array[e+r]=t.array[i+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)qs.fromBufferAttribute(this,t),qs.applyMatrix3(e),this.setXY(t,qs.x,qs.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)yt.fromBufferAttribute(this,t),yt.applyMatrix3(e),this.setXYZ(t,yt.x,yt.y,yt.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)yt.fromBufferAttribute(this,t),yt.applyMatrix4(e),this.setXYZ(t,yt.x,yt.y,yt.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)yt.fromBufferAttribute(this,t),yt.applyNormalMatrix(e),this.setXYZ(t,yt.x,yt.y,yt.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)yt.fromBufferAttribute(this,t),yt.transformDirection(e),this.setXYZ(t,yt.x,yt.y,yt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=Or(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=$t(i,this.array)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Or(t,this.array)),t}setX(e,t){return this.normalized&&(t=$t(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Or(t,this.array)),t}setY(e,t){return this.normalized&&(t=$t(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Or(t,this.array)),t}setZ(e,t){return this.normalized&&(t=$t(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Or(t,this.array)),t}setW(e,t){return this.normalized&&(t=$t(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=$t(t,this.array),i=$t(i,this.array)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,r){return e*=this.itemSize,this.normalized&&(t=$t(t,this.array),i=$t(i,this.array),r=$t(r,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this}setXYZW(e,t,i,r,s){return e*=this.itemSize,this.normalized&&(t=$t(t,this.array),i=$t(i,this.array),r=$t(r,this.array),s=$t(s,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==kl&&(e.usage=this.usage),e}dispose(){this.dispatchEvent({type:"dispose"})}};var Oi=class extends Ke{constructor(e,t,i){super(new Uint16Array(e),t,i)}};var Bi=class extends Ke{constructor(e,t,i){super(new Uint32Array(e),t,i)}};var Dt=class extends Ke{constructor(e,t,i){super(new Float32Array(e),t,i)}},Tp=new pi,zr=new k,Tl=new k,mr=class{constructor(e=new k,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let i=this.center;t!==void 0?i.copy(t):Tp.setFromPoints(e).getCenter(i);let r=0;for(let s=0,o=e.length;s<o;s++)r=Math.max(r,i.distanceToSquared(e[s]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;zr.subVectors(e,this.center);let t=zr.lengthSq();if(t>this.radius*this.radius){let i=Math.sqrt(t),r=(i-this.radius)*.5;this.center.addScaledVector(zr,r/i),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Tl.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(zr.copy(e.center).add(Tl)),this.expandByPoint(zr.copy(e.center).sub(Tl))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},Ap=0,ln=new st,Al=new Pt,ar=new k,en=new pi,Vr=new pi,Rt=new k,St=class n extends Rn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Ap++}),this.uuid=ds(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(dp(e)?Bi:Oi)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let s=new Ie().getNormalMatrix(e);i.applyNormalMatrix(s),i.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return ln.makeRotationFromQuaternion(e),this.applyMatrix4(ln),this}rotateX(e){return ln.makeRotationX(e),this.applyMatrix4(ln),this}rotateY(e){return ln.makeRotationY(e),this.applyMatrix4(ln),this}rotateZ(e){return ln.makeRotationZ(e),this.applyMatrix4(ln),this}translate(e,t,i){return ln.makeTranslation(e,t,i),this.applyMatrix4(ln),this}scale(e,t,i){return ln.makeScale(e,t,i),this.applyMatrix4(ln),this}lookAt(e){return Al.lookAt(e),Al.updateMatrix(),this.applyMatrix4(Al.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ar).negate(),this.translate(ar.x,ar.y,ar.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let i=[];for(let r=0,s=e.length;r<s;r++){let o=e[r];i.push(o.x,o.y,o.z||0)}this.setAttribute("position",new Dt(i,3))}else{let i=Math.min(e.length,t.count);for(let r=0;r<i;r++){let s=e[r];t.setXYZ(r,s.x,s.y,s.z||0)}e.length>t.count&&Ae("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new pi);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Re("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new k(-1/0,-1/0,-1/0),new k(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,r=t.length;i<r;i++){let s=t[i];en.setFromBufferAttribute(s),this.morphTargetsRelative?(Rt.addVectors(this.boundingBox.min,en.min),this.boundingBox.expandByPoint(Rt),Rt.addVectors(this.boundingBox.max,en.max),this.boundingBox.expandByPoint(Rt)):(this.boundingBox.expandByPoint(en.min),this.boundingBox.expandByPoint(en.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Re('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new mr);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Re("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new k,1/0);return}if(e){let i=this.boundingSphere.center;if(en.setFromBufferAttribute(e),t)for(let s=0,o=t.length;s<o;s++){let a=t[s];Vr.setFromBufferAttribute(a),this.morphTargetsRelative?(Rt.addVectors(en.min,Vr.min),en.expandByPoint(Rt),Rt.addVectors(en.max,Vr.max),en.expandByPoint(Rt)):(en.expandByPoint(Vr.min),en.expandByPoint(Vr.max))}en.getCenter(i);let r=0;for(let s=0,o=e.count;s<o;s++)Rt.fromBufferAttribute(e,s),r=Math.max(r,i.distanceToSquared(Rt));if(t)for(let s=0,o=t.length;s<o;s++){let a=t[s],c=this.morphTargetsRelative;for(let l=0,u=a.count;l<u;l++)Rt.fromBufferAttribute(a,l),c&&(ar.fromBufferAttribute(e,l),Rt.add(ar)),r=Math.max(r,i.distanceToSquared(Rt))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&Re('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Re("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=t.position,r=t.normal,s=t.uv,o=this.getAttribute("tangent");(o===void 0||o.count!==i.count)&&(o=new Ke(new Float32Array(4*i.count),4),this.setAttribute("tangent",o));let a=[],c=[];for(let _=0;_<i.count;_++)a[_]=new k,c[_]=new k;let l=new k,u=new k,f=new k,h=new Be,m=new Be,g=new Be,x=new k,d=new k;function p(_,A,I){l.fromBufferAttribute(i,_),u.fromBufferAttribute(i,A),f.fromBufferAttribute(i,I),h.fromBufferAttribute(s,_),m.fromBufferAttribute(s,A),g.fromBufferAttribute(s,I),u.sub(l),f.sub(l),m.sub(h),g.sub(h);let C=1/(m.x*g.y-g.x*m.y);isFinite(C)&&(x.copy(u).multiplyScalar(g.y).addScaledVector(f,-m.y).multiplyScalar(C),d.copy(f).multiplyScalar(m.x).addScaledVector(u,-g.x).multiplyScalar(C),a[_].add(x),a[A].add(x),a[I].add(x),c[_].add(d),c[A].add(d),c[I].add(d))}let M=this.groups;M.length===0&&(M=[{start:0,count:e.count}]);for(let _=0,A=M.length;_<A;++_){let I=M[_],C=I.start,U=I.count;for(let X=C,Y=C+U;X<Y;X+=3)p(e.getX(X+0),e.getX(X+1),e.getX(X+2))}let S=new k,v=new k,w=new k,E=new k;function R(_){w.fromBufferAttribute(r,_),E.copy(w);let A=a[_];S.copy(A),S.sub(w.multiplyScalar(w.dot(A))).normalize(),v.crossVectors(E,A);let C=v.dot(c[_])<0?-1:1;o.setXYZW(_,S.x,S.y,S.z,C)}for(let _=0,A=M.length;_<A;++_){let I=M[_],C=I.start,U=I.count;for(let X=C,Y=C+U;X<Y;X+=3)R(e.getX(X+0)),R(e.getX(X+1)),R(e.getX(X+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==t.count)i=new Ke(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let h=0,m=i.count;h<m;h++)i.setXYZ(h,0,0,0);let r=new k,s=new k,o=new k,a=new k,c=new k,l=new k,u=new k,f=new k;if(e)for(let h=0,m=e.count;h<m;h+=3){let g=e.getX(h+0),x=e.getX(h+1),d=e.getX(h+2);r.fromBufferAttribute(t,g),s.fromBufferAttribute(t,x),o.fromBufferAttribute(t,d),u.subVectors(o,s),f.subVectors(r,s),u.cross(f),a.fromBufferAttribute(i,g),c.fromBufferAttribute(i,x),l.fromBufferAttribute(i,d),a.add(u),c.add(u),l.add(u),i.setXYZ(g,a.x,a.y,a.z),i.setXYZ(x,c.x,c.y,c.z),i.setXYZ(d,l.x,l.y,l.z)}else for(let h=0,m=t.count;h<m;h+=3)r.fromBufferAttribute(t,h+0),s.fromBufferAttribute(t,h+1),o.fromBufferAttribute(t,h+2),u.subVectors(o,s),f.subVectors(r,s),u.cross(f),i.setXYZ(h+0,u.x,u.y,u.z),i.setXYZ(h+1,u.x,u.y,u.z),i.setXYZ(h+2,u.x,u.y,u.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)Rt.fromBufferAttribute(e,t),Rt.normalize(),e.setXYZ(t,Rt.x,Rt.y,Rt.z)}toNonIndexed(){function e(a,c){let l=a.array,u=a.itemSize,f=a.normalized,h=new l.constructor(c.length*u),m=0,g=0;for(let x=0,d=c.length;x<d;x++){a.isInterleavedBufferAttribute?m=c[x]*a.data.stride+a.offset:m=c[x]*u;for(let p=0;p<u;p++)h[g++]=l[m++]}return new Ke(h,u,f)}if(this.index===null)return Ae("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new n,i=this.index.array,r=this.attributes;for(let a in r){let c=r[a],l=e(c,i);t.setAttribute(a,l)}let s=this.morphAttributes;for(let a in s){let c=[],l=s[a];for(let u=0,f=l.length;u<f;u++){let h=l[u],m=e(h,i);c.push(m)}t.morphAttributes[a]=c}t.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,c=o.length;a<c;a++){let l=o[a];t.addGroup(l.start,l.count,l.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let c=this.parameters;for(let l in c)c[l]!==void 0&&(e[l]=c[l]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let i=this.attributes;for(let c in i){let l=i[c];e.data.attributes[c]=l.toJSON(e.data)}let r={},s=!1;for(let c in this.morphAttributes){let l=this.morphAttributes[c],u=[];for(let f=0,h=l.length;f<h;f++){let m=l[f];u.push(m.toJSON(e.data))}u.length>0&&(r[c]=u,s=!0)}s&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(e.data.boundingSphere=a.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let i=e.index;i!==null&&this.setIndex(i.clone());let r=e.attributes;for(let l in r){let u=r[l];this.setAttribute(l,u.clone(t))}let s=e.morphAttributes;for(let l in s){let u=[],f=s[l];for(let h=0,m=f.length;h<m;h++)u.push(f[h].clone(t));this.morphAttributes[l]=u}this.morphTargetsRelative=e.morphTargetsRelative;let o=e.groups;for(let l=0,u=o.length;l<u;l++){let f=o[l];this.addGroup(f.start,f.count,f.materialIndex)}let a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());let c=e.boundingSphere;return c!==null&&(this.boundingSphere=c.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Rp=0,mi=class extends Rn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Rp++}),this.uuid=ds(),this.name="",this.type="Material",this.blending=Fi,this.side=Xn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=ao,this.blendDst=lo,this.blendEquation=fi,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Fe(0,0,0),this.blendAlpha=0,this.depthFunc=Ui,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Bl,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Di,this.stencilZFail=Di,this.stencilZPass=Di,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let i=e[t];if(i===void 0){Ae(`Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){Ae(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(i):r&&r.isVector2&&i&&i.isVector2||r&&r.isEuler&&i&&i.isEuler||r&&r.isVector3&&i&&i.isVector3?r.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Fi&&(i.blending=this.blending),this.side!==Xn&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==ao&&(i.blendSrc=this.blendSrc),this.blendDst!==lo&&(i.blendDst=this.blendDst),this.blendEquation!==fi&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==Ui&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Bl&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Di&&(i.stencilFail=this.stencilFail),this.stencilZFail!==Di&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==Di&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.allowOverride===!1&&(i.allowOverride=!1),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function r(s){let o=[];for(let a in s){let c=s[a];delete c.metadata,o.push(c)}return o}if(t){let s=r(e.textures),o=r(e.images);s.length>0&&(i.textures=s),o.length>0&&(i.images=o)}return i}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Fe().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let i=e.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new Be().fromArray(i)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Be().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,i=null;if(t!==null){let r=t.length;i=new Array(r);for(let s=0;s!==r;++s)i[s]=t[s].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}};var Hn=new k,Rl=new k,Ys=new k,ui=new k,Cl=new k,Zs=new k,Pl=new k,wo=class{constructor(e=new k,t=new k(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Hn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Hn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Hn.copy(this.origin).addScaledVector(this.direction,t),Hn.distanceToSquared(e))}distanceSqToSegment(e,t,i,r){Rl.copy(e).add(t).multiplyScalar(.5),Ys.copy(t).sub(e).normalize(),ui.copy(this.origin).sub(Rl);let s=e.distanceTo(t)*.5,o=-this.direction.dot(Ys),a=ui.dot(this.direction),c=-ui.dot(Ys),l=ui.lengthSq(),u=Math.abs(1-o*o),f,h,m,g;if(u>0)if(f=o*c-a,h=o*a-c,g=s*u,f>=0)if(h>=-g)if(h<=g){let x=1/u;f*=x,h*=x,m=f*(f+o*h+2*a)+h*(o*f+h+2*c)+l}else h=s,f=Math.max(0,-(o*h+a)),m=-f*f+h*(h+2*c)+l;else h=-s,f=Math.max(0,-(o*h+a)),m=-f*f+h*(h+2*c)+l;else h<=-g?(f=Math.max(0,-(-o*s+a)),h=f>0?-s:Math.min(Math.max(-s,-c),s),m=-f*f+h*(h+2*c)+l):h<=g?(f=0,h=Math.min(Math.max(-s,-c),s),m=h*(h+2*c)+l):(f=Math.max(0,-(o*s+a)),h=f>0?s:Math.min(Math.max(-s,-c),s),m=-f*f+h*(h+2*c)+l);else h=o>0?-s:s,f=Math.max(0,-(o*h+a)),m=-f*f+h*(h+2*c)+l;return i&&i.copy(this.origin).addScaledVector(this.direction,f),r&&r.copy(Rl).addScaledVector(Ys,h),m}intersectSphere(e,t){Hn.subVectors(e.center,this.origin);let i=Hn.dot(this.direction),r=Hn.dot(Hn)-i*i,s=e.radius*e.radius;if(r>s)return null;let o=Math.sqrt(s-r),a=i-o,c=i+o;return c<0?null:a<0?this.at(c,t):this.at(a,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){let i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,r,s,o,a,c,l=1/this.direction.x,u=1/this.direction.y,f=1/this.direction.z,h=this.origin;return l>=0?(i=(e.min.x-h.x)*l,r=(e.max.x-h.x)*l):(i=(e.max.x-h.x)*l,r=(e.min.x-h.x)*l),u>=0?(s=(e.min.y-h.y)*u,o=(e.max.y-h.y)*u):(s=(e.max.y-h.y)*u,o=(e.min.y-h.y)*u),i>o||s>r||((s>i||isNaN(i))&&(i=s),(o<r||isNaN(r))&&(r=o),f>=0?(a=(e.min.z-h.z)*f,c=(e.max.z-h.z)*f):(a=(e.max.z-h.z)*f,c=(e.min.z-h.z)*f),i>c||a>r)||((a>i||i!==i)&&(i=a),(c<r||r!==r)&&(r=c),r<0)?null:this.at(i>=0?i:r,t)}intersectsBox(e){return this.intersectBox(e,Hn)!==null}intersectTriangle(e,t,i,r,s){Cl.subVectors(t,e),Zs.subVectors(i,e),Pl.crossVectors(Cl,Zs);let o=this.direction.dot(Pl),a;if(o>0){if(r)return null;a=1}else if(o<0)a=-1,o=-o;else return null;ui.subVectors(this.origin,e);let c=a*this.direction.dot(Zs.crossVectors(ui,Zs));if(c<0)return null;let l=a*this.direction.dot(Cl.cross(ui));if(l<0||c+l>o)return null;let u=-a*ui.dot(Pl);return u<0?null:this.at(u/o,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Zn=class extends mi{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Fe(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Yn,this.combine=Go,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},zu=new st,Ii=new wo,$s=new mr,Vu=new k,Js=new k,Ks=new k,js=new k,Il=new k,Qs=new k,Gu=new k,eo=new k,ut=class extends Pt{constructor(e=new St,t=new Zn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){let a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}getVertexPosition(e,t){let i=this.geometry,r=i.attributes.position,s=i.morphAttributes.position,o=i.morphTargetsRelative;t.fromBufferAttribute(r,e);let a=this.morphTargetInfluences;if(s&&a){Qs.set(0,0,0);for(let c=0,l=s.length;c<l;c++){let u=a[c],f=s[c];u!==0&&(Il.fromBufferAttribute(f,e),o?Qs.addScaledVector(Il,u):Qs.addScaledVector(Il.sub(t),u))}t.add(Qs)}return t}raycast(e,t){let i=this.geometry,r=this.material,s=this.matrixWorld;r!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),$s.copy(i.boundingSphere),$s.applyMatrix4(s),Ii.copy(e.ray).recast(e.near),!($s.containsPoint(Ii.origin)===!1&&(Ii.intersectSphere($s,Vu)===null||Ii.origin.distanceToSquared(Vu)>(e.far-e.near)**2))&&(zu.copy(s).invert(),Ii.copy(e.ray).applyMatrix4(zu),!(i.boundingBox!==null&&Ii.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,Ii)))}_computeIntersections(e,t,i){let r,s=this.geometry,o=this.material,a=s.index,c=s.attributes.position,l=s.attributes.uv,u=s.attributes.uv1,f=s.attributes.normal,h=s.groups,m=s.drawRange;if(a!==null)if(Array.isArray(o))for(let g=0,x=h.length;g<x;g++){let d=h[g],p=o[d.materialIndex],M=Math.max(d.start,m.start),S=Math.min(a.count,Math.min(d.start+d.count,m.start+m.count));for(let v=M,w=S;v<w;v+=3){let E=a.getX(v),R=a.getX(v+1),_=a.getX(v+2);r=to(this,p,e,i,l,u,f,E,R,_),r&&(r.faceIndex=Math.floor(v/3),r.face.materialIndex=d.materialIndex,t.push(r))}}else{let g=Math.max(0,m.start),x=Math.min(a.count,m.start+m.count);for(let d=g,p=x;d<p;d+=3){let M=a.getX(d),S=a.getX(d+1),v=a.getX(d+2);r=to(this,o,e,i,l,u,f,M,S,v),r&&(r.faceIndex=Math.floor(d/3),t.push(r))}}else if(c!==void 0)if(Array.isArray(o))for(let g=0,x=h.length;g<x;g++){let d=h[g],p=o[d.materialIndex],M=Math.max(d.start,m.start),S=Math.min(c.count,Math.min(d.start+d.count,m.start+m.count));for(let v=M,w=S;v<w;v+=3){let E=v,R=v+1,_=v+2;r=to(this,p,e,i,l,u,f,E,R,_),r&&(r.faceIndex=Math.floor(v/3),r.face.materialIndex=d.materialIndex,t.push(r))}}else{let g=Math.max(0,m.start),x=Math.min(c.count,m.start+m.count);for(let d=g,p=x;d<p;d+=3){let M=d,S=d+1,v=d+2;r=to(this,o,e,i,l,u,f,M,S,v),r&&(r.faceIndex=Math.floor(d/3),t.push(r))}}}};function Cp(n,e,t,i,r,s,o,a){let c;if(e.side===qt?c=i.intersectTriangle(o,s,r,!0,a):c=i.intersectTriangle(r,s,o,e.side===Xn,a),c===null)return null;eo.copy(a),eo.applyMatrix4(n.matrixWorld);let l=t.ray.origin.distanceTo(eo);return l<t.near||l>t.far?null:{distance:l,point:eo.clone(),object:n}}function to(n,e,t,i,r,s,o,a,c,l){n.getVertexPosition(a,Js),n.getVertexPosition(c,Ks),n.getVertexPosition(l,js);let u=Cp(n,e,t,i,Js,Ks,js,Gu);if(u){let f=new k;di.getBarycoord(Gu,Js,Ks,js,f),r&&(u.uv=di.getInterpolatedAttribute(r,a,c,l,f,new Be)),s&&(u.uv1=di.getInterpolatedAttribute(s,a,c,l,f,new Be)),o&&(u.normal=di.getInterpolatedAttribute(o,a,c,l,f,new k),u.normal.dot(i.direction)>0&&u.normal.multiplyScalar(-1));let h={a,b:c,c:l,normal:new k,materialIndex:0};di.getNormal(Js,Ks,js,h.normal),u.face=h,u.barycoord=f}return u}var Eo=class extends Ft{constructor(e=null,t=1,i=1,r,s,o,a,c,l=Ct,u=Ct,f,h){super(null,o,a,c,l,u,r,s,f,h),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Ll=new k,Pp=new k,Ip=new Ie,En=class{constructor(e=new k(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,r){return this.normal.set(e,t,i),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){let r=Ll.subVectors(i,t).cross(Pp.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,i=!0){let r=e.delta(Ll),s=this.normal.dot(r);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let o=-(e.start.dot(this.normal)+this.constant)/s;return i===!0&&(o<0||o>1)?null:t.copy(e.start).addScaledVector(r,o)}intersectsLine(e){let t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let i=t||Ip.getNormalMatrix(e),r=this.coplanarPoint(Ll).applyMatrix4(e),s=this.normal.applyMatrix3(i).normalize();return this.constant=-r.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},Li=new mr,Lp=new Be(.5,.5),no=new k,gr=class{constructor(e=new En,t=new En,i=new En,r=new En,s=new En,o=new En){this.planes=[e,t,i,r,s,o]}set(e,t,i,r,s,o){let a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(i),a[3].copy(r),a[4].copy(s),a[5].copy(o),this}copy(e){let t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=gn,i=!1){let r=this.planes,s=e.elements,o=s[0],a=s[1],c=s[2],l=s[3],u=s[4],f=s[5],h=s[6],m=s[7],g=s[8],x=s[9],d=s[10],p=s[11],M=s[12],S=s[13],v=s[14],w=s[15];if(r[0].setComponents(l-o,m-u,p-g,w-M).normalize(),r[1].setComponents(l+o,m+u,p+g,w+M).normalize(),r[2].setComponents(l+a,m+f,p+x,w+S).normalize(),r[3].setComponents(l-a,m-f,p-x,w-S).normalize(),i)r[4].setComponents(c,h,d,v).normalize(),r[5].setComponents(l-c,m-h,p-d,w-v).normalize();else if(r[4].setComponents(l-c,m-h,p-d,w-v).normalize(),t===gn)r[5].setComponents(l+c,m+h,p+d,w+v).normalize();else if(t===hr)r[5].setComponents(c,h,d,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Li.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Li.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Li)}intersectsSprite(e){Li.center.set(0,0,0);let t=Lp.distanceTo(e.center);return Li.radius=.7071067811865476+t,Li.applyMatrix4(e.matrixWorld),this.intersectsSphere(Li)}intersectsSphere(e){let t=this.planes,i=e.center,r=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(i)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let i=0;i<6;i++){let r=t[i];if(no.x=r.normal.x>0?e.max.x:e.min.x,no.y=r.normal.y>0?e.max.y:e.min.y,no.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(no)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var Zr=class extends Ft{constructor(e=[],t=_i,i,r,s,o,a,c,l,u){super(e,t,i,r,s,o,a,c,l,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},$r=class extends Ft{constructor(e,t,i,r,s,o,a,c,l){super(e,t,i,r,s,o,a,c,l),this.isCanvasTexture=!0,this.needsUpdate=!0}};var $n=class extends Ft{constructor(e,t,i=yn,r,s,o,a=Ct,c=Ct,l,u=An,f=1){if(u!==An&&u!==vi)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let h={width:e,height:t,depth:f};super(h,r,s,o,a,c,u,i,l),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new fr(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},To=class extends $n{constructor(e,t=yn,i=_i,r,s,o=Ct,a=Ct,c,l=An){let u={width:e,height:e,depth:1},f=[u,u,u,u,u,u];super(e,e,t,i,r,s,o,a,c,l),this.image=f,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},Jr=class extends Ft{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},xr=class n extends St{constructor(e=1,t=1,i=1,r=1,s=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:r,heightSegments:s,depthSegments:o};let a=this;r=Math.floor(r),s=Math.floor(s),o=Math.floor(o);let c=[],l=[],u=[],f=[],h=0,m=0;g("z","y","x",-1,-1,i,t,e,o,s,0),g("z","y","x",1,-1,i,t,-e,o,s,1),g("x","z","y",1,1,e,i,t,r,o,2),g("x","z","y",1,-1,e,i,-t,r,o,3),g("x","y","z",1,-1,e,t,i,r,s,4),g("x","y","z",-1,-1,e,t,-i,r,s,5),this.setIndex(c),this.setAttribute("position",new Dt(l,3)),this.setAttribute("normal",new Dt(u,3)),this.setAttribute("uv",new Dt(f,2));function g(x,d,p,M,S,v,w,E,R,_,A){let I=v/R,C=w/_,U=v/2,X=w/2,Y=E/2,N=R+1,G=_+1,H=0,K=0,Q=new k;for(let ee=0;ee<G;ee++){let ce=ee*C-X;for(let xe=0;xe<N;xe++){let We=xe*I-U;Q[x]=We*M,Q[d]=ce*S,Q[p]=Y,l.push(Q.x,Q.y,Q.z),Q[x]=0,Q[d]=0,Q[p]=E>0?1:-1,u.push(Q.x,Q.y,Q.z),f.push(xe/R),f.push(1-ee/_),H+=1}}for(let ee=0;ee<_;ee++)for(let ce=0;ce<R;ce++){let xe=h+ce+N*ee,We=h+ce+N*(ee+1),ot=h+(ce+1)+N*(ee+1),Xe=h+(ce+1)+N*ee;c.push(xe,We,Xe),c.push(We,ot,Xe),K+=6}a.addGroup(m,K,A),m+=K,h+=H}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};var ki=class n extends St{constructor(e=1,t=1,i=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:r};let s=e/2,o=t/2,a=Math.floor(i),c=Math.floor(r),l=a+1,u=c+1,f=e/a,h=t/c,m=[],g=[],x=[],d=[];for(let p=0;p<u;p++){let M=p*h-o;for(let S=0;S<l;S++){let v=S*f-s;g.push(v,-M,0),x.push(0,0,1),d.push(S/a),d.push(1-p/c)}}for(let p=0;p<c;p++)for(let M=0;M<a;M++){let S=M+l*p,v=M+l*(p+1),w=M+1+l*(p+1),E=M+1+l*p;m.push(S,v,E),m.push(v,w,E)}this.setIndex(m),this.setAttribute("position",new Dt(g,3)),this.setAttribute("normal",new Dt(x,3)),this.setAttribute("uv",new Dt(d,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.widthSegments,e.heightSegments)}};function Vi(n){let e={};for(let t in n){e[t]={};for(let i in n[t]){let r=n[t][i];if(Hu(r))r.isRenderTargetTexture?(Ae("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=r.clone();else if(Array.isArray(r))if(Hu(r[0])){let s=[];for(let o=0,a=r.length;o<a;o++)s[o]=r[o].clone();e[t][i]=s}else e[t][i]=r.slice();else e[t][i]=r}}return e}function Gt(n){let e={};for(let t=0;t<n.length;t++){let i=Vi(n[t]);for(let r in i)e[r]=i[r]}return e}function Hu(n){return n&&(n.isColor||n.isMatrix3||n.isMatrix4||n.isVector2||n.isVector3||n.isVector4||n.isTexture||n.isQuaternion)}function Dp(n){let e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function hc(n){let e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:ze.workingColorSpace}var Ih={clone:Vi,merge:Gt},Np=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Fp=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Ut=class extends mi{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Np,this.fragmentShader=Fp,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Vi(e.uniforms),this.uniformsGroups=Dp(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let r in this.uniforms){let o=this.uniforms[r].value;o&&o.isTexture?t.uniforms[r]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[r]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[r]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[r]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[r]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[r]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[r]={type:"m4",value:o.toArray()}:t.uniforms[r]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let i={};for(let r in this.extensions)this.extensions[r]===!0&&(i[r]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let i in e.uniforms){let r=e.uniforms[i];switch(this.uniforms[i]={},r.type){case"t":this.uniforms[i].value=t[r.value]||null;break;case"c":this.uniforms[i].value=new Fe().setHex(r.value);break;case"v2":this.uniforms[i].value=new Be().fromArray(r.value);break;case"v3":this.uniforms[i].value=new k().fromArray(r.value);break;case"v4":this.uniforms[i].value=new rt().fromArray(r.value);break;case"m3":this.uniforms[i].value=new Ie().fromArray(r.value);break;case"m4":this.uniforms[i].value=new st().fromArray(r.value);break;default:this.uniforms[i].value=r.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let i in e.extensions)this.extensions[i]=e.extensions[i];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},Ao=class extends Ut{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}};var Kr=class extends mi{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new Fe(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Fe(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Ra,this.normalScale=new Be(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Yn,this.combine=Go,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},Ro=class extends mi{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=yh,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},Co=class extends mi{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function io(n,e){return!n||n.constructor===e?n:typeof e.BYTES_PER_ELEMENT=="number"?new e(n):Array.prototype.slice.call(n)}var gi=class{constructor(e,t,i,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r!==void 0?r:new t.constructor(i),this.sampleValues=t,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,i=this._cachedIndex,r=t[i],s=t[i-1];n:{e:{let o;t:{i:if(!(e<r)){for(let a=i+2;;){if(r===void 0){if(e<s)break i;return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===a)break;if(s=r,r=t[++i],e<r)break e}o=t.length;break t}if(!(e>=s)){let a=t[1];e<a&&(i=2,s=a);for(let c=i-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===c)break;if(r=s,s=t[--i-1],e>=s)break e}o=i,i=0;break t}break n}for(;i<o;){let a=i+o>>>1;e<t[a]?o=a:i=a+1}if(r=t[i],s=t[i-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,s,r)}return this.interpolate_(i,s,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,i=this.sampleValues,r=this.valueSize,s=e*r;for(let o=0;o!==r;++o)t[o]=i[s+o];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},Po=class extends gi{constructor(e,t,i,r){super(e,t,i,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Fl,endingEnd:Fl}}intervalChanged_(e,t,i){let r=this.parameterPositions,s=e-2,o=e+1,a=r[s],c=r[o];if(a===void 0)switch(this.getSettings_().endingStart){case Ul:s=e,a=2*t-i;break;case Ol:s=r.length-2,a=t+r[s]-r[s+1];break;default:s=e,a=i}if(c===void 0)switch(this.getSettings_().endingEnd){case Ul:o=e,c=2*i-t;break;case Ol:o=1,c=i+r[1]-r[0];break;default:o=e-1,c=t}let l=(i-t)*.5,u=this.valueSize;this._weightPrev=l/(t-a),this._weightNext=l/(c-i),this._offsetPrev=s*u,this._offsetNext=o*u}interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=e*a,l=c-a,u=this._offsetPrev,f=this._offsetNext,h=this._weightPrev,m=this._weightNext,g=(i-t)/(r-t),x=g*g,d=x*g,p=-h*d+2*h*x-h*g,M=(1+h)*d+(-1.5-2*h)*x+(-.5+h)*g+1,S=(-1-m)*d+(1.5+m)*x+.5*g,v=m*d-m*x;for(let w=0;w!==a;++w)s[w]=p*o[u+w]+M*o[l+w]+S*o[c+w]+v*o[f+w];return s}},Io=class extends gi{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=e*a,l=c-a,u=(i-t)/(r-t),f=1-u;for(let h=0;h!==a;++h)s[h]=o[l+h]*f+o[c+h]*u;return s}},Lo=class extends gi{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e){return this.copySampleValue_(e-1)}},Do=class extends gi{interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=e*a,l=c-a,u=this.inTangents,f=this.outTangents;if(!u||!f){let g=(i-t)/(r-t),x=1-g;for(let d=0;d!==a;++d)s[d]=o[l+d]*x+o[c+d]*g;return s}let h=a*2,m=e-1;for(let g=0;g!==a;++g){let x=o[l+g],d=o[c+g],p=m*h+g*2,M=f[p],S=f[p+1],v=e*h+g*2,w=u[v],E=u[v+1],R=(i-t)/(r-t),_,A,I,C,U;for(let X=0;X<8;X++){_=R*R,A=_*R,I=1-R,C=I*I,U=C*I;let N=U*t+3*C*R*M+3*I*_*w+A*r-i;if(Math.abs(N)<1e-10)break;let G=3*C*(M-t)+6*I*R*(w-M)+3*_*(r-w);if(Math.abs(G)<1e-10)break;R=R-N/G,R=Math.max(0,Math.min(1,R))}s[g]=U*x+3*C*R*S+3*I*_*E+A*d}return s}},rn=class{constructor(e,t,i,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=io(t,this.TimeBufferType),this.values=io(i,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,i;if(t.toJSON!==this.toJSON)i=t.toJSON(e);else{i={name:e.name,times:io(e.times,Array),values:io(e.values,Array)};let r=e.getInterpolation();r!==e.DefaultInterpolation&&(i.interpolation=r)}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new Lo(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Io(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Po(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new Do(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case Gr:t=this.InterpolantFactoryMethodDiscrete;break;case _o:t=this.InterpolantFactoryMethodLinear;break;case oo:t=this.InterpolantFactoryMethodSmooth;break;case Nl:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return Ae("KeyframeTrack:",i),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Gr;case this.InterpolantFactoryMethodLinear:return _o;case this.InterpolantFactoryMethodSmooth:return oo;case this.InterpolantFactoryMethodBezier:return Nl}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]*=e}return this}trim(e,t){let i=this.times,r=i.length,s=0,o=r-1;for(;s!==r&&i[s]<e;)++s;for(;o!==-1&&i[o]>t;)--o;if(++o,s!==0||o!==r){s>=o&&(o=Math.max(o,1),s=o-1);let a=this.getValueSize();this.times=i.slice(s,o),this.values=this.values.slice(s*a,o*a)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(Re("KeyframeTrack: Invalid value size in track.",this),e=!1);let i=this.times,r=this.values,s=i.length;s===0&&(Re("KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==s;a++){let c=i[a];if(typeof c=="number"&&isNaN(c)){Re("KeyframeTrack: Time is not a valid number.",this,a,c),e=!1;break}if(o!==null&&o>c){Re("KeyframeTrack: Out of order keys.",this,a,c,o),e=!1;break}o=c}if(r!==void 0&&fp(r))for(let a=0,c=r.length;a!==c;++a){let l=r[a];if(isNaN(l)){Re("KeyframeTrack: Value is not a valid number.",this,a,l),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),i=this.getValueSize(),r=this.getInterpolation()===oo,s=e.length-1,o=1;for(let a=1;a<s;++a){let c=!1,l=e[a],u=e[a+1];if(l!==u&&(a!==1||l!==e[0]))if(r)c=!0;else{let f=a*i,h=f-i,m=f+i;for(let g=0;g!==i;++g){let x=t[f+g];if(x!==t[h+g]||x!==t[m+g]){c=!0;break}}}if(c){if(a!==o){e[o]=e[a];let f=a*i,h=o*i;for(let m=0;m!==i;++m)t[h+m]=t[f+m]}++o}}if(s>0){e[o]=e[s];for(let a=s*i,c=o*i,l=0;l!==i;++l)t[c+l]=t[a+l];++o}return o!==e.length?(this.times=e.slice(0,o),this.values=t.slice(0,o*i)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),i=this.constructor,r=new i(this.name,e,t);return r.createInterpolant=this.createInterpolant,r}};rn.prototype.ValueTypeName="";rn.prototype.TimeBufferType=Float32Array;rn.prototype.ValueBufferType=Float32Array;rn.prototype.DefaultInterpolation=_o;var xi=class extends rn{constructor(e,t,i){super(e,t,i)}};xi.prototype.ValueTypeName="bool";xi.prototype.ValueBufferType=Array;xi.prototype.DefaultInterpolation=Gr;xi.prototype.InterpolantFactoryMethodLinear=void 0;xi.prototype.InterpolantFactoryMethodSmooth=void 0;var No=class extends rn{constructor(e,t,i,r){super(e,t,i,r)}};No.prototype.ValueTypeName="color";var Fo=class extends rn{constructor(e,t,i,r){super(e,t,i,r)}};Fo.prototype.ValueTypeName="number";var Uo=class extends gi{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=(i-t)/(r-t),l=e*a;for(let u=l+a;l!==u;l+=4)Cn.slerpFlat(s,0,o,l-a,o,l,c);return s}},jr=class extends rn{constructor(e,t,i,r){super(e,t,i,r)}InterpolantFactoryMethodLinear(e){return new Uo(this.times,this.values,this.getValueSize(),e)}};jr.prototype.ValueTypeName="quaternion";jr.prototype.InterpolantFactoryMethodSmooth=void 0;var yi=class extends rn{constructor(e,t,i){super(e,t,i)}};yi.prototype.ValueTypeName="string";yi.prototype.ValueBufferType=Array;yi.prototype.DefaultInterpolation=Gr;yi.prototype.InterpolantFactoryMethodLinear=void 0;yi.prototype.InterpolantFactoryMethodSmooth=void 0;var Oo=class extends rn{constructor(e,t,i,r){super(e,t,i,r)}};Oo.prototype.ValueTypeName="vector";var Bo=class{constructor(e,t,i){let r=this,s=!1,o=0,a=0,c,l=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=i,this._abortController=null,this.itemStart=function(u){a++,s===!1&&r.onStart!==void 0&&r.onStart(u,o,a),s=!0},this.itemEnd=function(u){o++,r.onProgress!==void 0&&r.onProgress(u,o,a),o===a&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(u){r.onError!==void 0&&r.onError(u)},this.resolveURL=function(u){return u=u.normalize("NFC"),c?c(u):u},this.setURLModifier=function(u){return c=u,this},this.addHandler=function(u,f){return l.push(u,f),this},this.removeHandler=function(u){let f=l.indexOf(u);return f!==-1&&l.splice(f,2),this},this.getHandler=function(u){for(let f=0,h=l.length;f<h;f+=2){let m=l[f],g=l[f+1];if(m.global&&(m.lastIndex=0),m.test(u))return g}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Lh=new Bo,ko=class{constructor(e){this.manager=e!==void 0?e:Lh,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let i=this;return new Promise(function(r,s){i.load(e,r,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};ko.DEFAULT_MATERIAL_NAME="__DEFAULT";var Qr=class extends Pt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Fe(e),this.intensity=t}dispose(){this.dispatchEvent({type:"dispose"})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},es=class extends Qr{constructor(e,t,i){super(e,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Pt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Fe(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},Dl=new st,Wu=new k,Xu=new k,zl=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Be(512,512),this.mapType=Jt,this.map=null,this.mapPass=null,this.matrix=new st,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new gr,this._frameExtents=new Be(1,1),this._viewportCount=1,this._viewports=[new rt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,i=this.matrix;Wu.setFromMatrixPosition(e.matrixWorld),t.position.copy(Wu),Xu.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Xu),t.updateMatrixWorld(),Dl.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Dl,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===hr||t.reversedDepth?i.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(Dl)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},ro=new k,so=new Cn,wn=new k,ts=class extends Pt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new st,this.projectionMatrix=new st,this.projectionMatrixInverse=new st,this.coordinateSystem=gn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(ro,so,wn),wn.x===1&&wn.y===1&&wn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(ro,so,wn.set(1,1,1)).invert()}updateWorldMatrix(e,t,i=!1){super.updateWorldMatrix(e,t,i),this.matrixWorld.decompose(ro,so,wn),wn.x===1&&wn.y===1&&wn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(ro,so,wn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},hi=new k,qu=new Be,Yu=new Be,Vt=class extends ts{constructor(e=50,t=1,i=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=vo*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(ul*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return vo*2*Math.atan(Math.tan(ul*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){hi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(hi.x,hi.y).multiplyScalar(-e/hi.z),hi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(hi.x,hi.y).multiplyScalar(-e/hi.z)}getViewSize(e,t){return this.getViewBounds(e,qu,Yu),t.subVectors(Yu,qu)}setViewOffset(e,t,i,r,s,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(ul*.5*this.fov)/this.zoom,i=2*t,r=this.aspect*i,s=-.5*r,o=this.view;if(this.view!==null&&this.view.enabled){let c=o.fullWidth,l=o.fullHeight;s+=o.offsetX*r/c,t-=o.offsetY*i/l,r*=o.width/c,i*=o.height/l}let a=this.filmOffset;a!==0&&(s+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+r,t,t-i,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}};var yr=class extends ts{constructor(e=-1,t=1,i=1,r=-1,s=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=r,this.near=s,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,r,s,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,r=(this.top+this.bottom)/2,s=i-e,o=i+e,a=r+t,c=r-t;if(this.view!==null&&this.view.enabled){let l=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=l*this.view.offsetX,o=s+l*this.view.width,a-=u*this.view.offsetY,c=a-u*this.view.height}this.projectionMatrix.makeOrthographic(s,o,a,c,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},Vl=class extends zl{constructor(){super(new yr(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},ns=class extends Qr{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Pt.DEFAULT_UP),this.updateMatrix(),this.target=new Pt,this.shadow=new Vl}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}};var lr=-90,cr=1,zo=class extends Pt{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new Vt(lr,cr,e,t);r.layers=this.layers,this.add(r);let s=new Vt(lr,cr,e,t);s.layers=this.layers,this.add(s);let o=new Vt(lr,cr,e,t);o.layers=this.layers,this.add(o);let a=new Vt(lr,cr,e,t);a.layers=this.layers,this.add(a);let c=new Vt(lr,cr,e,t);c.layers=this.layers,this.add(c);let l=new Vt(lr,cr,e,t);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[i,r,s,o,a,c]=t;for(let l of t)this.remove(l);if(e===gn)i.up.set(0,1,0),i.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),c.up.set(0,1,0),c.lookAt(0,0,-1);else if(e===hr)i.up.set(0,-1,0),i.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),c.up.set(0,-1,0),c.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let l of t)this.add(l),l.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[s,o,a,c,l,u]=this.children,f=e.getRenderTarget(),h=e.getActiveCubeFace(),m=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;let x=i.texture.generateMipmaps;i.texture.generateMipmaps=!1;let d=!1;e.isWebGLRenderer===!0?d=e.state.buffers.depth.getReversed():d=e.reversedDepthBuffer,e.setRenderTarget(i,0,r),d&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(i,1,r),d&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(i,2,r),d&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(i,3,r),d&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),e.setRenderTarget(i,4,r),d&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),i.texture.generateMipmaps=x,e.setRenderTarget(i,5,r),d&&e.autoClear===!1&&e.clearDepth(),e.render(t,u),e.setRenderTarget(f,h,m),e.xr.enabled=g,i.texture.needsPMREMUpdate=!0}},Vo=class extends Vt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}};var dc="\\[\\]\\.:\\/",Up=new RegExp("["+dc+"]","g"),fc="[^"+dc+"]",Op="[^"+dc.replace("\\.","")+"]",Bp=/((?:WC+[\/:])*)/.source.replace("WC",fc),kp=/(WCOD+)?/.source.replace("WCOD",Op),zp=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",fc),Vp=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",fc),Gp=new RegExp("^"+Bp+kp+zp+Vp+"$"),Hp=["material","materials","bones","map"],Gl=class{constructor(e,t,i){let r=i||it.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let i=this._targetGroup.nCachedObjects_,r=this._bindings[i];r!==void 0&&r.getValue(e,t)}setValue(e,t){let i=this._bindings;for(let r=this._targetGroup.nCachedObjects_,s=i.length;r!==s;++r)i[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].unbind()}},it=class n{constructor(e,t,i){this.path=t,this.parsedPath=i||n.parseTrackName(t),this.node=n.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,i){return e&&e.isAnimationObjectGroup?new n.Composite(e,t,i):new n(e,t,i)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(Up,"")}static parseTrackName(e){let t=Gp.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let i={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=i.nodeName&&i.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){let s=i.nodeName.substring(r+1);Hp.indexOf(s)!==-1&&(i.nodeName=i.nodeName.substring(0,r),i.objectName=s)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return i}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let i=e.skeleton.getBoneByName(t);if(i!==void 0)return i}if(e.children){let i=function(s){for(let o=0;o<s.length;o++){let a=s[o];if(a.name===t||a.uuid===t)return a;let c=i(a.children);if(c)return c}return null},r=i(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)e[t++]=i[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,i=t.objectName,r=t.propertyName,s=t.propertyIndex;if(e||(e=n.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){Ae("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let l=t.objectIndex;switch(i){case"materials":if(!e.material){Re("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Re("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Re("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let u=0;u<e.length;u++)if(e[u].name===l){l=u;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Re("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Re("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[i]===void 0){Re("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[i]}if(l!==void 0){if(e[l]===void 0){Re("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[l]}}let o=e[r];if(o===void 0){let l=t.nodeName;Re("PropertyBinding: Trying to update property for track: "+l+"."+r+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?a=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(s!==void 0){if(r==="morphTargetInfluences"){if(!e.geometry){Re("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Re("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}c=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=s}else o.fromArray!==void 0&&o.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(c=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=r;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};it.Composite=Gl;it.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};it.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};it.prototype.GetterByBindingType=[it.prototype._getValue_direct,it.prototype._getValue_array,it.prototype._getValue_arrayElement,it.prototype._getValue_toArray];it.prototype.SetterByBindingTypeAndVersioning=[[it.prototype._setValue_direct,it.prototype._setValue_direct_setNeedsUpdate,it.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[it.prototype._setValue_array,it.prototype._setValue_array_setNeedsUpdate,it.prototype._setValue_array_setMatrixWorldNeedsUpdate],[it.prototype._setValue_arrayElement,it.prototype._setValue_arrayElement_setNeedsUpdate,it.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[it.prototype._setValue_fromArray,it.prototype._setValue_fromArray_setNeedsUpdate,it.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var j_=new Float32Array(1);var Hl=class n{static{n.prototype.isMatrix2=!0}constructor(e,t,i,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,i,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let i=0;i<4;i++)this.elements[i]=e[i+t];return this}set(e,t,i,r){let s=this.elements;return s[0]=e,s[2]=t,s[1]=i,s[3]=r,this}};function pc(n,e,t,i){let r=Wp(i);switch(t){case oc:return n*e;case lc:return n*e/r.components*r.byteLength;case $o:return n*e/r.components*r.byteLength;case bi:return n*e*2/r.components*r.byteLength;case Jo:return n*e*2/r.components*r.byteLength;case ac:return n*e*3/r.components*r.byteLength;case cn:return n*e*4/r.components*r.byteLength;case Ko:return n*e*4/r.components*r.byteLength;case os:case as:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case ls:case cs:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Qo:case ta:return Math.max(n,16)*Math.max(e,8)/4;case jo:case ea:return Math.max(n,8)*Math.max(e,8)/2;case na:case ia:case sa:case oa:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case ra:case us:case aa:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case la:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case ca:return Math.floor((n+4)/5)*Math.floor((e+3)/4)*16;case ua:return Math.floor((n+4)/5)*Math.floor((e+4)/5)*16;case ha:return Math.floor((n+5)/6)*Math.floor((e+4)/5)*16;case da:return Math.floor((n+5)/6)*Math.floor((e+5)/6)*16;case fa:return Math.floor((n+7)/8)*Math.floor((e+4)/5)*16;case pa:return Math.floor((n+7)/8)*Math.floor((e+5)/6)*16;case ma:return Math.floor((n+7)/8)*Math.floor((e+7)/8)*16;case ga:return Math.floor((n+9)/10)*Math.floor((e+4)/5)*16;case xa:return Math.floor((n+9)/10)*Math.floor((e+5)/6)*16;case ya:return Math.floor((n+9)/10)*Math.floor((e+7)/8)*16;case _a:return Math.floor((n+9)/10)*Math.floor((e+9)/10)*16;case va:return Math.floor((n+11)/12)*Math.floor((e+9)/10)*16;case ba:return Math.floor((n+11)/12)*Math.floor((e+11)/12)*16;case Ma:case Sa:case wa:return Math.ceil(n/4)*Math.ceil(e/4)*16;case Ea:case Ta:return Math.ceil(n/4)*Math.ceil(e/4)*8;case hs:case Aa:return Math.ceil(n/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function Wp(n){switch(n){case Jt:case nc:return{byteLength:1,components:1};case vr:case ic:case Dn:return{byteLength:2,components:1};case Yo:case Zo:return{byteLength:2,components:4};case yn:case qo:case _n:return{byteLength:4,components:1};case rc:case sc:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${n}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"185"}}));typeof window<"u"&&(window.__THREE__?Ae("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="185");function td(){let n=null,e=!1,t=null,i=null;function r(s,o){t(s,o),i=n.requestAnimationFrame(r)}return{start:function(){e!==!0&&t!==null&&n!==null&&(i=n.requestAnimationFrame(r),e=!0)},stop:function(){n!==null&&n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){n=s}}}function qp(n){let e=new WeakMap;function t(a,c){let l=a.array,u=a.usage,f=l.byteLength,h=n.createBuffer();n.bindBuffer(c,h),n.bufferData(c,l,u),a.onUploadCallback();let m;if(l instanceof Float32Array)m=n.FLOAT;else if(typeof Float16Array<"u"&&l instanceof Float16Array)m=n.HALF_FLOAT;else if(l instanceof Uint16Array)a.isFloat16BufferAttribute?m=n.HALF_FLOAT:m=n.UNSIGNED_SHORT;else if(l instanceof Int16Array)m=n.SHORT;else if(l instanceof Uint32Array)m=n.UNSIGNED_INT;else if(l instanceof Int32Array)m=n.INT;else if(l instanceof Int8Array)m=n.BYTE;else if(l instanceof Uint8Array)m=n.UNSIGNED_BYTE;else if(l instanceof Uint8ClampedArray)m=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+l);return{buffer:h,type:m,bytesPerElement:l.BYTES_PER_ELEMENT,version:a.version,size:f}}function i(a,c,l){let u=c.array,f=c.updateRanges;if(n.bindBuffer(l,a),f.length===0)n.bufferSubData(l,0,u);else{f.sort((m,g)=>m.start-g.start);let h=0;for(let m=1;m<f.length;m++){let g=f[h],x=f[m];x.start<=g.start+g.count+1?g.count=Math.max(g.count,x.start+x.count-g.start):(++h,f[h]=x)}f.length=h+1;for(let m=0,g=f.length;m<g;m++){let x=f[m];n.bufferSubData(l,x.start*u.BYTES_PER_ELEMENT,u,x.start,x.count)}c.clearUpdateRanges()}c.onUploadCallback()}function r(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function s(a){a.isInterleavedBufferAttribute&&(a=a.data);let c=e.get(a);c&&(n.deleteBuffer(c.buffer),e.delete(a))}function o(a,c){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let u=e.get(a);(!u||u.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let l=e.get(a);if(l===void 0)e.set(a,t(a,c));else if(l.version<a.version){if(l.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(l.buffer,a,c),l.version=a.version}}return{get:r,remove:s,update:o}}var Yp=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Zp=`#ifdef USE_ALPHAHASH
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
#endif`,$p=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Jp=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Kp=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,jp=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Qp=`#ifdef USE_AOMAP
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
#endif`,em=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,tm=`#ifdef USE_BATCHING
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
#endif`,nm=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,im=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,rm=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,sm=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,om=`#ifdef USE_IRIDESCENCE
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
#endif`,am=`#ifdef USE_BUMPMAP
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
#endif`,lm=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,cm=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,um=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,hm=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,dm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,fm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,pm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,mm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,gm=`#define PI 3.141592653589793
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
} // validated`,xm=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,ym=`vec3 transformedNormal = objectNormal;
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
#endif`,_m=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,vm=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,bm=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Mm=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Sm="gl_FragColor = linearToOutputTexel( gl_FragColor );",wm=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Em=`#ifdef USE_ENVMAP
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
#endif`,Tm=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Am=`#ifdef USE_ENVMAP
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
#endif`,Rm=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Cm=`#ifdef USE_ENVMAP
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
#endif`,Pm=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Im=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Lm=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Dm=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Nm=`#ifdef USE_GRADIENTMAP
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
}`,Fm=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Um=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Om=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Bm=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,km=`#ifdef USE_ENVMAP
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
#endif`,zm=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Vm=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Gm=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Hm=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Wm=`PhysicalMaterial material;
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
#endif`,Xm=`uniform sampler2D dfgLUT;
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
}`,qm=`
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
#endif`,Ym=`#if defined( RE_IndirectDiffuse )
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
#endif`,Zm=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,$m=`#ifdef USE_LIGHT_PROBES_GRID
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
#endif`,Jm=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Km=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,jm=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Qm=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,eg=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,tg=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,ng=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,ig=`#if defined( USE_POINTS_UV )
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
#endif`,rg=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,sg=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,og=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,ag=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,lg=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,cg=`#ifdef USE_MORPHTARGETS
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
#endif`,ug=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,hg=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,dg=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,fg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,pg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,mg=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,gg=`#ifdef USE_NORMALMAP
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
#endif`,xg=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,yg=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,_g=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,vg=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,bg=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Mg=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,Sg=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,wg=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Eg=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Tg=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Ag=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Rg=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Cg=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,Pg=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,Ig=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,Lg=`float getShadowMask() {
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
}`,Dg=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Ng=`#ifdef USE_SKINNING
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
#endif`,Fg=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Ug=`#ifdef USE_SKINNING
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
#endif`,Og=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Bg=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,kg=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,zg=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,Vg=`#ifdef USE_TRANSMISSION
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
#endif`,Gg=`#ifdef USE_TRANSMISSION
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
#endif`,Hg=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,Wg=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,Xg=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,qg=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,Yg=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Zg=`uniform sampler2D t2D;
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
}`,$g=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Jg=`#ifdef ENVMAP_TYPE_CUBE
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
}`,Kg=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,jg=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Qg=`#include <common>
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
}`,e0=`#if DEPTH_PACKING == 3200
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
}`,t0=`#define DISTANCE
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
}`,n0=`#define DISTANCE
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
}`,i0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,r0=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,s0=`uniform float scale;
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
}`,o0=`uniform vec3 diffuse;
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
}`,a0=`#include <common>
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
}`,l0=`uniform vec3 diffuse;
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
}`,c0=`#define LAMBERT
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
}`,u0=`#define LAMBERT
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
}`,h0=`#define MATCAP
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
}`,d0=`#define MATCAP
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
}`,f0=`#define NORMAL
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
}`,p0=`#define NORMAL
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
}`,m0=`#define PHONG
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
}`,g0=`#define PHONG
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
}`,x0=`#define STANDARD
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
}`,y0=`#define STANDARD
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
}`,_0=`#define TOON
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
}`,v0=`#define TOON
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
}`,b0=`uniform float size;
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
}`,M0=`uniform vec3 diffuse;
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
}`,S0=`#include <common>
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
}`,w0=`uniform vec3 color;
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
}`,E0=`uniform float rotation;
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
}`,T0=`uniform vec3 diffuse;
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
}`,Ue={alphahash_fragment:Yp,alphahash_pars_fragment:Zp,alphamap_fragment:$p,alphamap_pars_fragment:Jp,alphatest_fragment:Kp,alphatest_pars_fragment:jp,aomap_fragment:Qp,aomap_pars_fragment:em,batching_pars_vertex:tm,batching_vertex:nm,begin_vertex:im,beginnormal_vertex:rm,bsdfs:sm,iridescence_fragment:om,bumpmap_pars_fragment:am,clipping_planes_fragment:lm,clipping_planes_pars_fragment:cm,clipping_planes_pars_vertex:um,clipping_planes_vertex:hm,color_fragment:dm,color_pars_fragment:fm,color_pars_vertex:pm,color_vertex:mm,common:gm,cube_uv_reflection_fragment:xm,defaultnormal_vertex:ym,displacementmap_pars_vertex:_m,displacementmap_vertex:vm,emissivemap_fragment:bm,emissivemap_pars_fragment:Mm,colorspace_fragment:Sm,colorspace_pars_fragment:wm,envmap_fragment:Em,envmap_common_pars_fragment:Tm,envmap_pars_fragment:Am,envmap_pars_vertex:Rm,envmap_physical_pars_fragment:km,envmap_vertex:Cm,fog_vertex:Pm,fog_pars_vertex:Im,fog_fragment:Lm,fog_pars_fragment:Dm,gradientmap_pars_fragment:Nm,lightmap_pars_fragment:Fm,lights_lambert_fragment:Um,lights_lambert_pars_fragment:Om,lights_pars_begin:Bm,lights_toon_fragment:zm,lights_toon_pars_fragment:Vm,lights_phong_fragment:Gm,lights_phong_pars_fragment:Hm,lights_physical_fragment:Wm,lights_physical_pars_fragment:Xm,lights_fragment_begin:qm,lights_fragment_maps:Ym,lights_fragment_end:Zm,lightprobes_pars_fragment:$m,logdepthbuf_fragment:Jm,logdepthbuf_pars_fragment:Km,logdepthbuf_pars_vertex:jm,logdepthbuf_vertex:Qm,map_fragment:eg,map_pars_fragment:tg,map_particle_fragment:ng,map_particle_pars_fragment:ig,metalnessmap_fragment:rg,metalnessmap_pars_fragment:sg,morphinstance_vertex:og,morphcolor_vertex:ag,morphnormal_vertex:lg,morphtarget_pars_vertex:cg,morphtarget_vertex:ug,normal_fragment_begin:hg,normal_fragment_maps:dg,normal_pars_fragment:fg,normal_pars_vertex:pg,normal_vertex:mg,normalmap_pars_fragment:gg,clearcoat_normal_fragment_begin:xg,clearcoat_normal_fragment_maps:yg,clearcoat_pars_fragment:_g,iridescence_pars_fragment:vg,opaque_fragment:bg,packing:Mg,premultiplied_alpha_fragment:Sg,project_vertex:wg,dithering_fragment:Eg,dithering_pars_fragment:Tg,roughnessmap_fragment:Ag,roughnessmap_pars_fragment:Rg,shadowmap_pars_fragment:Cg,shadowmap_pars_vertex:Pg,shadowmap_vertex:Ig,shadowmask_pars_fragment:Lg,skinbase_vertex:Dg,skinning_pars_vertex:Ng,skinning_vertex:Fg,skinnormal_vertex:Ug,specularmap_fragment:Og,specularmap_pars_fragment:Bg,tonemapping_fragment:kg,tonemapping_pars_fragment:zg,transmission_fragment:Vg,transmission_pars_fragment:Gg,uv_pars_fragment:Hg,uv_pars_vertex:Wg,uv_vertex:Xg,worldpos_vertex:qg,background_vert:Yg,background_frag:Zg,backgroundCube_vert:$g,backgroundCube_frag:Jg,cube_vert:Kg,cube_frag:jg,depth_vert:Qg,depth_frag:e0,distance_vert:t0,distance_frag:n0,equirect_vert:i0,equirect_frag:r0,linedashed_vert:s0,linedashed_frag:o0,meshbasic_vert:a0,meshbasic_frag:l0,meshlambert_vert:c0,meshlambert_frag:u0,meshmatcap_vert:h0,meshmatcap_frag:d0,meshnormal_vert:f0,meshnormal_frag:p0,meshphong_vert:m0,meshphong_frag:g0,meshphysical_vert:x0,meshphysical_frag:y0,meshtoon_vert:_0,meshtoon_frag:v0,points_vert:b0,points_frag:M0,shadow_vert:S0,shadow_frag:w0,sprite_vert:E0,sprite_frag:T0},he={common:{diffuse:{value:new Fe(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ie},alphaMap:{value:null},alphaMapTransform:{value:new Ie},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ie}},envmap:{envMap:{value:null},envMapRotation:{value:new Ie},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ie}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ie}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ie},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ie},normalScale:{value:new Be(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ie},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ie}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ie}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ie}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Fe(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new k},probesMax:{value:new k},probesResolution:{value:new k}},points:{diffuse:{value:new Fe(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ie},alphaTest:{value:0},uvTransform:{value:new Ie}},sprite:{diffuse:{value:new Fe(16777215)},opacity:{value:1},center:{value:new Be(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ie},alphaMap:{value:null},alphaMapTransform:{value:new Ie},alphaTest:{value:0}}},Fn={basic:{uniforms:Gt([he.common,he.specularmap,he.envmap,he.aomap,he.lightmap,he.fog]),vertexShader:Ue.meshbasic_vert,fragmentShader:Ue.meshbasic_frag},lambert:{uniforms:Gt([he.common,he.specularmap,he.envmap,he.aomap,he.lightmap,he.emissivemap,he.bumpmap,he.normalmap,he.displacementmap,he.fog,he.lights,{emissive:{value:new Fe(0)},envMapIntensity:{value:1}}]),vertexShader:Ue.meshlambert_vert,fragmentShader:Ue.meshlambert_frag},phong:{uniforms:Gt([he.common,he.specularmap,he.envmap,he.aomap,he.lightmap,he.emissivemap,he.bumpmap,he.normalmap,he.displacementmap,he.fog,he.lights,{emissive:{value:new Fe(0)},specular:{value:new Fe(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Ue.meshphong_vert,fragmentShader:Ue.meshphong_frag},standard:{uniforms:Gt([he.common,he.envmap,he.aomap,he.lightmap,he.emissivemap,he.bumpmap,he.normalmap,he.displacementmap,he.roughnessmap,he.metalnessmap,he.fog,he.lights,{emissive:{value:new Fe(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ue.meshphysical_vert,fragmentShader:Ue.meshphysical_frag},toon:{uniforms:Gt([he.common,he.aomap,he.lightmap,he.emissivemap,he.bumpmap,he.normalmap,he.displacementmap,he.gradientmap,he.fog,he.lights,{emissive:{value:new Fe(0)}}]),vertexShader:Ue.meshtoon_vert,fragmentShader:Ue.meshtoon_frag},matcap:{uniforms:Gt([he.common,he.bumpmap,he.normalmap,he.displacementmap,he.fog,{matcap:{value:null}}]),vertexShader:Ue.meshmatcap_vert,fragmentShader:Ue.meshmatcap_frag},points:{uniforms:Gt([he.points,he.fog]),vertexShader:Ue.points_vert,fragmentShader:Ue.points_frag},dashed:{uniforms:Gt([he.common,he.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ue.linedashed_vert,fragmentShader:Ue.linedashed_frag},depth:{uniforms:Gt([he.common,he.displacementmap]),vertexShader:Ue.depth_vert,fragmentShader:Ue.depth_frag},normal:{uniforms:Gt([he.common,he.bumpmap,he.normalmap,he.displacementmap,{opacity:{value:1}}]),vertexShader:Ue.meshnormal_vert,fragmentShader:Ue.meshnormal_frag},sprite:{uniforms:Gt([he.sprite,he.fog]),vertexShader:Ue.sprite_vert,fragmentShader:Ue.sprite_frag},background:{uniforms:{uvTransform:{value:new Ie},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ue.background_vert,fragmentShader:Ue.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ie}},vertexShader:Ue.backgroundCube_vert,fragmentShader:Ue.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ue.cube_vert,fragmentShader:Ue.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ue.equirect_vert,fragmentShader:Ue.equirect_frag},distance:{uniforms:Gt([he.common,he.displacementmap,{referencePosition:{value:new k},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ue.distance_vert,fragmentShader:Ue.distance_frag},shadow:{uniforms:Gt([he.lights,he.fog,{color:{value:new Fe(0)},opacity:{value:1}}]),vertexShader:Ue.shadow_vert,fragmentShader:Ue.shadow_frag}};Fn.physical={uniforms:Gt([Fn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ie},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ie},clearcoatNormalScale:{value:new Be(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ie},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ie},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ie},sheen:{value:0},sheenColor:{value:new Fe(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ie},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ie},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ie},transmissionSamplerSize:{value:new Be},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ie},attenuationDistance:{value:0},attenuationColor:{value:new Fe(0)},specularColor:{value:new Fe(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ie},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ie},anisotropyVector:{value:new Be},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ie}}]),vertexShader:Ue.meshphysical_vert,fragmentShader:Ue.meshphysical_frag};var Ia={r:0,b:0,g:0},A0=new st,nd=new Ie;nd.set(-1,0,0,0,1,0,0,0,1);function R0(n,e,t,i,r,s){let o=new Fe(0),a=r===!0?0:1,c,l,u=null,f=0,h=null;function m(M){let S=M.isScene===!0?M.background:null;if(S&&S.isTexture){let v=M.backgroundBlurriness>0;S=e.get(S,v)}return S}function g(M){let S=!1,v=m(M);v===null?d(o,a):v&&v.isColor&&(d(v,1),S=!0);let w=n.xr.getEnvironmentBlendMode();w==="additive"?t.buffers.color.setClear(0,0,0,1,s):w==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,s),(n.autoClear||S)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function x(M,S){let v=m(S);v&&(v.isCubeTexture||v.mapping===rs)?(l===void 0&&(l=new ut(new xr(1,1,1),new Ut({name:"BackgroundCubeMaterial",uniforms:Vi(Fn.backgroundCube.uniforms),vertexShader:Fn.backgroundCube.vertexShader,fragmentShader:Fn.backgroundCube.fragmentShader,side:qt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),l.geometry.deleteAttribute("uv"),l.onBeforeRender=function(w,E,R){this.matrixWorld.copyPosition(R.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(l)),l.material.uniforms.envMap.value=v,l.material.uniforms.backgroundBlurriness.value=S.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(A0.makeRotationFromEuler(S.backgroundRotation)).transpose(),v.isCubeTexture&&v.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(nd),l.material.toneMapped=ze.getTransfer(v.colorSpace)!==Ye,(u!==v||f!==v.version||h!==n.toneMapping)&&(l.material.needsUpdate=!0,u=v,f=v.version,h=n.toneMapping),l.layers.enableAll(),M.unshift(l,l.geometry,l.material,0,0,null)):v&&v.isTexture&&(c===void 0&&(c=new ut(new ki(2,2),new Ut({name:"BackgroundMaterial",uniforms:Vi(Fn.background.uniforms),vertexShader:Fn.background.vertexShader,fragmentShader:Fn.background.fragmentShader,side:Xn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(c)),c.material.uniforms.t2D.value=v,c.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,c.material.toneMapped=ze.getTransfer(v.colorSpace)!==Ye,v.matrixAutoUpdate===!0&&v.updateMatrix(),c.material.uniforms.uvTransform.value.copy(v.matrix),(u!==v||f!==v.version||h!==n.toneMapping)&&(c.material.needsUpdate=!0,u=v,f=v.version,h=n.toneMapping),c.layers.enableAll(),M.unshift(c,c.geometry,c.material,0,0,null))}function d(M,S){M.getRGB(Ia,hc(n)),t.buffers.color.setClear(Ia.r,Ia.g,Ia.b,S,s)}function p(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(M,S=1){o.set(M),a=S,d(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(M){a=M,d(o,a)},render:g,addToRenderList:x,dispose:p}}function C0(n,e){let t=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},r=h(null),s=r,o=!1;function a(C,U,X,Y,N){let G=!1,H=f(C,Y,X,U);s!==H&&(s=H,l(s.object)),G=m(C,Y,X,N),G&&g(C,Y,X,N),N!==null&&e.update(N,n.ELEMENT_ARRAY_BUFFER),(G||o)&&(o=!1,v(C,U,X,Y),N!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get(N).buffer))}function c(){return n.createVertexArray()}function l(C){return n.bindVertexArray(C)}function u(C){return n.deleteVertexArray(C)}function f(C,U,X,Y){let N=Y.wireframe===!0,G=i[U.id];G===void 0&&(G={},i[U.id]=G);let H=C.isInstancedMesh===!0?C.id:0,K=G[H];K===void 0&&(K={},G[H]=K);let Q=K[X.id];Q===void 0&&(Q={},K[X.id]=Q);let ee=Q[N];return ee===void 0&&(ee=h(c()),Q[N]=ee),ee}function h(C){let U=[],X=[],Y=[];for(let N=0;N<t;N++)U[N]=0,X[N]=0,Y[N]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:U,enabledAttributes:X,attributeDivisors:Y,object:C,attributes:{},index:null}}function m(C,U,X,Y){let N=s.attributes,G=U.attributes,H=0,K=X.getAttributes();for(let Q in K)if(K[Q].location>=0){let ce=N[Q],xe=G[Q];if(xe===void 0&&(Q==="instanceMatrix"&&C.instanceMatrix&&(xe=C.instanceMatrix),Q==="instanceColor"&&C.instanceColor&&(xe=C.instanceColor)),ce===void 0||ce.attribute!==xe||xe&&ce.data!==xe.data)return!0;H++}return s.attributesNum!==H||s.index!==Y}function g(C,U,X,Y){let N={},G=U.attributes,H=0,K=X.getAttributes();for(let Q in K)if(K[Q].location>=0){let ce=G[Q];ce===void 0&&(Q==="instanceMatrix"&&C.instanceMatrix&&(ce=C.instanceMatrix),Q==="instanceColor"&&C.instanceColor&&(ce=C.instanceColor));let xe={};xe.attribute=ce,ce&&ce.data&&(xe.data=ce.data),N[Q]=xe,H++}s.attributes=N,s.attributesNum=H,s.index=Y}function x(){let C=s.newAttributes;for(let U=0,X=C.length;U<X;U++)C[U]=0}function d(C){p(C,0)}function p(C,U){let X=s.newAttributes,Y=s.enabledAttributes,N=s.attributeDivisors;X[C]=1,Y[C]===0&&(n.enableVertexAttribArray(C),Y[C]=1),N[C]!==U&&(n.vertexAttribDivisor(C,U),N[C]=U)}function M(){let C=s.newAttributes,U=s.enabledAttributes;for(let X=0,Y=U.length;X<Y;X++)U[X]!==C[X]&&(n.disableVertexAttribArray(X),U[X]=0)}function S(C,U,X,Y,N,G,H){H===!0?n.vertexAttribIPointer(C,U,X,N,G):n.vertexAttribPointer(C,U,X,Y,N,G)}function v(C,U,X,Y){x();let N=Y.attributes,G=X.getAttributes(),H=U.defaultAttributeValues;for(let K in G){let Q=G[K];if(Q.location>=0){let ee=N[K];if(ee===void 0&&(K==="instanceMatrix"&&C.instanceMatrix&&(ee=C.instanceMatrix),K==="instanceColor"&&C.instanceColor&&(ee=C.instanceColor)),ee!==void 0){let ce=ee.normalized,xe=ee.itemSize,We=e.get(ee);if(We===void 0)continue;let ot=We.buffer,Xe=We.type,J=We.bytesPerElement,re=Xe===n.INT||Xe===n.UNSIGNED_INT||ee.gpuType===qo;if(ee.isInterleavedBufferAttribute){let te=ee.data,Pe=te.stride,Le=ee.offset;if(te.isInstancedInterleavedBuffer){for(let Ee=0;Ee<Q.locationSize;Ee++)p(Q.location+Ee,te.meshPerAttribute);C.isInstancedMesh!==!0&&Y._maxInstanceCount===void 0&&(Y._maxInstanceCount=te.meshPerAttribute*te.count)}else for(let Ee=0;Ee<Q.locationSize;Ee++)d(Q.location+Ee);n.bindBuffer(n.ARRAY_BUFFER,ot);for(let Ee=0;Ee<Q.locationSize;Ee++)S(Q.location+Ee,xe/Q.locationSize,Xe,ce,Pe*J,(Le+xe/Q.locationSize*Ee)*J,re)}else{if(ee.isInstancedBufferAttribute){for(let te=0;te<Q.locationSize;te++)p(Q.location+te,ee.meshPerAttribute);C.isInstancedMesh!==!0&&Y._maxInstanceCount===void 0&&(Y._maxInstanceCount=ee.meshPerAttribute*ee.count)}else for(let te=0;te<Q.locationSize;te++)d(Q.location+te);n.bindBuffer(n.ARRAY_BUFFER,ot);for(let te=0;te<Q.locationSize;te++)S(Q.location+te,xe/Q.locationSize,Xe,ce,xe*J,xe/Q.locationSize*te*J,re)}}else if(H!==void 0){let ce=H[K];if(ce!==void 0)switch(ce.length){case 2:n.vertexAttrib2fv(Q.location,ce);break;case 3:n.vertexAttrib3fv(Q.location,ce);break;case 4:n.vertexAttrib4fv(Q.location,ce);break;default:n.vertexAttrib1fv(Q.location,ce)}}}}M()}function w(){A();for(let C in i){let U=i[C];for(let X in U){let Y=U[X];for(let N in Y){let G=Y[N];for(let H in G)u(G[H].object),delete G[H];delete Y[N]}}delete i[C]}}function E(C){if(i[C.id]===void 0)return;let U=i[C.id];for(let X in U){let Y=U[X];for(let N in Y){let G=Y[N];for(let H in G)u(G[H].object),delete G[H];delete Y[N]}}delete i[C.id]}function R(C){for(let U in i){let X=i[U];for(let Y in X){let N=X[Y];if(N[C.id]===void 0)continue;let G=N[C.id];for(let H in G)u(G[H].object),delete G[H];delete N[C.id]}}}function _(C){for(let U in i){let X=i[U],Y=C.isInstancedMesh===!0?C.id:0,N=X[Y];if(N!==void 0){for(let G in N){let H=N[G];for(let K in H)u(H[K].object),delete H[K];delete N[G]}delete X[Y],Object.keys(X).length===0&&delete i[U]}}}function A(){I(),o=!0,s!==r&&(s=r,l(s.object))}function I(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:a,reset:A,resetDefaultState:I,dispose:w,releaseStatesOfGeometry:E,releaseStatesOfObject:_,releaseStatesOfProgram:R,initAttributes:x,enableAttribute:d,disableUnusedAttributes:M}}function P0(n,e,t){let i;function r(c){i=c}function s(c,l){n.drawArrays(i,c,l),t.update(l,i,1)}function o(c,l,u){u!==0&&(n.drawArraysInstanced(i,c,l,u),t.update(l,i,u))}function a(c,l,u){if(u===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,c,0,l,0,u);let h=0;for(let m=0;m<u;m++)h+=l[m];t.update(h,i,1)}this.setMode=r,this.render=s,this.renderInstances=o,this.renderMultiDraw=a}function I0(n,e,t,i){let r;function s(){if(r!==void 0)return r;if(e.has("EXT_texture_filter_anisotropic")===!0){let R=e.get("EXT_texture_filter_anisotropic");r=n.getParameter(R.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function o(R){return!(R!==cn&&i.convert(R)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(R){let _=R===Dn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(R!==Jt&&i.convert(R)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE)&&R!==_n&&!_)}function c(R){if(R==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";R="mediump"}return R==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let l=t.precision!==void 0?t.precision:"highp",u=c(l);u!==l&&(Ae("WebGLRenderer:",l,"not supported, using",u,"instead."),l=u);let f=t.logarithmicDepthBuffer===!0,h=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&h===!1&&Ae("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let m=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),g=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),x=n.getParameter(n.MAX_TEXTURE_SIZE),d=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),p=n.getParameter(n.MAX_VERTEX_ATTRIBS),M=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),S=n.getParameter(n.MAX_VARYING_VECTORS),v=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),w=n.getParameter(n.MAX_SAMPLES),E=n.getParameter(n.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:a,precision:l,logarithmicDepthBuffer:f,reversedDepthBuffer:h,maxTextures:m,maxVertexTextures:g,maxTextureSize:x,maxCubemapSize:d,maxAttributes:p,maxVertexUniforms:M,maxVaryings:S,maxFragmentUniforms:v,maxSamples:w,samples:E}}function L0(n){let e=this,t=null,i=0,r=!1,s=!1,o=new En,a=new Ie,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(f,h){let m=f.length!==0||h||i!==0||r;return r=h,i=f.length,m},this.beginShadows=function(){s=!0,u(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(f,h){t=u(f,h,0)},this.setState=function(f,h,m){let g=f.clippingPlanes,x=f.clipIntersection,d=f.clipShadows,p=n.get(f);if(!r||g===null||g.length===0||s&&!d)s?u(null):l();else{let M=s?0:i,S=M*4,v=p.clippingState||null;c.value=v,v=u(g,h,S,m);for(let w=0;w!==S;++w)v[w]=t[w];p.clippingState=v,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=M}};function l(){c.value!==t&&(c.value=t,c.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function u(f,h,m,g){let x=f!==null?f.length:0,d=null;if(x!==0){if(d=c.value,g!==!0||d===null){let p=m+x*4,M=h.matrixWorldInverse;a.getNormalMatrix(M),(d===null||d.length<p)&&(d=new Float32Array(p));for(let S=0,v=m;S!==x;++S,v+=4)o.copy(f[S]).applyMatrix4(M,a),o.normal.toArray(d,v),d[v+3]=o.constant}c.value=d,c.needsUpdate=!0}return e.numPlanes=x,e.numIntersection=0,d}}var Mi=4,Dh=[.125,.215,.35,.446,.526,.582],Gi=20,D0=256,fs=new yr,Nh=new Fe,mc=null,gc=0,xc=0,yc=!1,N0=new k,Da=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,i=.1,r=100,s={}){let{size:o=256,position:a=N0}=s;mc=this._renderer.getRenderTarget(),gc=this._renderer.getActiveCubeFace(),xc=this._renderer.getActiveMipmapLevel(),yc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);let c=this._allocateTargets();return c.depthBuffer=!0,this._sceneToCubeUV(e,i,r,c,a),t>0&&this._blur(c,0,0,t),this._applyPMREM(c),this._cleanup(c),c}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Oh(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Uh(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(mc,gc,xc),this._renderer.xr.enabled=yc,e.scissorTest=!1,Mr(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===_i||e.mapping===zi?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),mc=this._renderer.getRenderTarget(),gc=this._renderer.getActiveCubeFace(),xc=this._renderer.getActiveMipmapLevel(),yc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let i=t||this._allocateTargets();return this._textureToCubeUV(e,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:Nt,minFilter:Nt,generateMipmaps:!1,type:Dn,format:cn,colorSpace:qn,depthBuffer:!1},r=Fh(e,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Fh(e,t,i);let{_lodMax:s}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=F0(s)),this._blurMaterial=O0(s,e,t),this._ggxMaterial=U0(s,e,t)}return r}_compileMaterial(e){let t=new ut(new St,e);this._renderer.compile(t,fs)}_sceneToCubeUV(e,t,i,r,s){let c=new Vt(90,1,t,i),l=[1,-1,1,1,1,1],u=[1,1,1,-1,-1,-1],f=this._renderer,h=f.autoClear,m=f.toneMapping;f.getClearColor(Nh),f.toneMapping=xn,f.autoClear=!1,f.state.buffers.depth.getReversed()&&(f.setRenderTarget(r),f.clearDepth(),f.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new ut(new xr,new Zn({name:"PMREM.Background",side:qt,depthWrite:!1,depthTest:!1})));let x=this._backgroundBox,d=x.material,p=!1,M=e.background;M?M.isColor&&(d.color.copy(M),e.background=null,p=!0):(d.color.copy(Nh),p=!0);for(let S=0;S<6;S++){let v=S%3;v===0?(c.up.set(0,l[S],0),c.position.set(s.x,s.y,s.z),c.lookAt(s.x+u[S],s.y,s.z)):v===1?(c.up.set(0,0,l[S]),c.position.set(s.x,s.y,s.z),c.lookAt(s.x,s.y+u[S],s.z)):(c.up.set(0,l[S],0),c.position.set(s.x,s.y,s.z),c.lookAt(s.x,s.y,s.z+u[S]));let w=this._cubeSize;Mr(r,v*w,S>2?w:0,w,w),f.setRenderTarget(r),p&&f.render(x,c),f.render(e,c)}f.toneMapping=m,f.autoClear=h,e.background=M}_textureToCubeUV(e,t){let i=this._renderer,r=e.mapping===_i||e.mapping===zi;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Oh()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Uh());let s=r?this._cubemapMaterial:this._equirectMaterial,o=this._lodMeshes[0];o.material=s;let a=s.uniforms;a.envMap.value=e;let c=this._cubeSize;Mr(t,0,0,3*c,2*c),i.setRenderTarget(t),i.render(o,fs)}_applyPMREM(e){let t=this._renderer,i=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let s=1;s<r;s++)this._applyGGXFilter(e,s-1,s);t.autoClear=i}_applyGGXFilter(e,t,i){let r=this._renderer,s=this._pingPongRenderTarget,o=this._ggxMaterial,a=this._lodMeshes[i];a.material=o;let c=o.uniforms,l=i/(this._lodMeshes.length-1),u=t/(this._lodMeshes.length-1),f=Math.sqrt(l*l-u*u),h=0+l*1.25,m=f*h,{_lodMax:g}=this,x=this._sizeLods[i],d=3*x*(i>g-Mi?i-g+Mi:0),p=4*(this._cubeSize-x);c.envMap.value=e.texture,c.roughness.value=m,c.mipInt.value=g-t,Mr(s,d,p,3*x,2*x),r.setRenderTarget(s),r.render(a,fs),c.envMap.value=s.texture,c.roughness.value=0,c.mipInt.value=g-i,Mr(e,d,p,3*x,2*x),r.setRenderTarget(e),r.render(a,fs)}_blur(e,t,i,r,s){let o=this._pingPongRenderTarget;this._halfBlur(e,o,t,i,r,"latitudinal",s),this._halfBlur(o,e,i,i,r,"longitudinal",s)}_halfBlur(e,t,i,r,s,o,a){let c=this._renderer,l=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&Re("blur direction must be either latitudinal or longitudinal!");let u=3,f=this._lodMeshes[r];f.material=l;let h=l.uniforms,m=this._sizeLods[i]-1,g=isFinite(s)?Math.PI/(2*m):2*Math.PI/(2*Gi-1),x=s/g,d=isFinite(s)?1+Math.floor(u*x):Gi;d>Gi&&Ae(`sigmaRadians, ${s}, is too large and will clip, as it requested ${d} samples when the maximum is set to ${Gi}`);let p=[],M=0;for(let R=0;R<Gi;++R){let _=R/x,A=Math.exp(-_*_/2);p.push(A),R===0?M+=A:R<d&&(M+=2*A)}for(let R=0;R<p.length;R++)p[R]=p[R]/M;h.envMap.value=e.texture,h.samples.value=d,h.weights.value=p,h.latitudinal.value=o==="latitudinal",a&&(h.poleAxis.value=a);let{_lodMax:S}=this;h.dTheta.value=g,h.mipInt.value=S-i;let v=this._sizeLods[r],w=3*v*(r>S-Mi?r-S+Mi:0),E=4*(this._cubeSize-v);Mr(t,w,E,3*v,2*v),c.setRenderTarget(t),c.render(f,fs)}};function F0(n){let e=[],t=[],i=[],r=n,s=n-Mi+1+Dh.length;for(let o=0;o<s;o++){let a=Math.pow(2,r);e.push(a);let c=1/a;o>n-Mi?c=Dh[o-n+Mi-1]:o===0&&(c=0),t.push(c);let l=1/(a-2),u=-l,f=1+l,h=[u,u,f,u,f,f,u,u,f,f,u,f],m=6,g=6,x=3,d=2,p=1,M=new Float32Array(x*g*m),S=new Float32Array(d*g*m),v=new Float32Array(p*g*m);for(let E=0;E<m;E++){let R=E%3*2/3-1,_=E>2?0:-1,A=[R,_,0,R+2/3,_,0,R+2/3,_+1,0,R,_,0,R+2/3,_+1,0,R,_+1,0];M.set(A,x*g*E),S.set(h,d*g*E);let I=[E,E,E,E,E,E];v.set(I,p*g*E)}let w=new St;w.setAttribute("position",new Ke(M,x)),w.setAttribute("uv",new Ke(S,d)),w.setAttribute("faceIndex",new Ke(v,p)),i.push(new ut(w,null)),r>Mi&&r--}return{lodMeshes:i,sizeLods:e,sigmas:t}}function Fh(n,e,t){let i=new nn(n,e,t);return i.texture.mapping=rs,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function Mr(n,e,t,i,r){n.viewport.set(e,t,i,r),n.scissor.set(e,t,i,r)}function U0(n,e,t){return new Ut({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:D0,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Ua(),fragmentShader:`

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
		`,blending:In,depthTest:!1,depthWrite:!1})}function O0(n,e,t){let i=new Float32Array(Gi),r=new k(0,1,0);return new Ut({name:"SphericalGaussianBlur",defines:{n:Gi,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:r}},vertexShader:Ua(),fragmentShader:`

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
		`,blending:In,depthTest:!1,depthWrite:!1})}function Uh(){return new Ut({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Ua(),fragmentShader:`

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
		`,blending:In,depthTest:!1,depthWrite:!1})}function Oh(){return new Ut({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Ua(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:In,depthTest:!1,depthWrite:!1})}function Ua(){return`

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
	`}var Na=class extends nn{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let i={width:e,height:e,depth:1},r=[i,i,i,i,i,i];this.texture=new Zr(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},r=new xr(5,5,5),s=new Ut({name:"CubemapFromEquirect",uniforms:Vi(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:qt,blending:In});s.uniforms.tEquirect.value=t;let o=new ut(r,s),a=t.minFilter;return t.minFilter===Ln&&(t.minFilter=Nt),new zo(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t=!0,i=!0,r=!0){let s=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,i,r);e.setRenderTarget(s)}};function B0(n){let e=new WeakMap,t=new WeakMap,i=null;function r(h,m=!1){return h==null?null:m?o(h):s(h)}function s(h){if(h&&h.isTexture){let m=h.mapping;if(m===Ho||m===Wo)if(e.has(h)){let g=e.get(h).texture;return a(g,h.mapping)}else{let g=h.image;if(g&&g.height>0){let x=new Na(g.height);return x.fromEquirectangularTexture(n,h),e.set(h,x),h.addEventListener("dispose",l),a(x.texture,h.mapping)}else return null}}return h}function o(h){if(h&&h.isTexture){let m=h.mapping,g=m===Ho||m===Wo,x=m===_i||m===zi;if(g||x){let d=t.get(h),p=d!==void 0?d.texture.pmremVersion:0;if(h.isRenderTargetTexture&&h.pmremVersion!==p)return i===null&&(i=new Da(n)),d=g?i.fromEquirectangular(h,d):i.fromCubemap(h,d),d.texture.pmremVersion=h.pmremVersion,t.set(h,d),d.texture;if(d!==void 0)return d.texture;{let M=h.image;return g&&M&&M.height>0||x&&M&&c(M)?(i===null&&(i=new Da(n)),d=g?i.fromEquirectangular(h):i.fromCubemap(h),d.texture.pmremVersion=h.pmremVersion,t.set(h,d),h.addEventListener("dispose",u),d.texture):null}}}return h}function a(h,m){return m===Ho?h.mapping=_i:m===Wo&&(h.mapping=zi),h}function c(h){let m=0,g=6;for(let x=0;x<g;x++)h[x]!==void 0&&m++;return m===g}function l(h){let m=h.target;m.removeEventListener("dispose",l);let g=e.get(m);g!==void 0&&(e.delete(m),g.dispose())}function u(h){let m=h.target;m.removeEventListener("dispose",u);let g=t.get(m);g!==void 0&&(t.delete(m),g.dispose())}function f(){e=new WeakMap,t=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:r,dispose:f}}function k0(n){let e={};function t(i){if(e[i]!==void 0)return e[i];let r=n.getExtension(i);return e[i]=r,r}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){let r=t(i);return r===null&&Ni("WebGLRenderer: "+i+" extension not supported."),r}}}function z0(n,e,t,i){let r={},s=new WeakMap;function o(f){let h=f.target;h.index!==null&&e.remove(h.index);for(let g in h.attributes)e.remove(h.attributes[g]);h.removeEventListener("dispose",o),delete r[h.id];let m=s.get(h);m&&(e.remove(m),s.delete(h)),i.releaseStatesOfGeometry(h),h.isInstancedBufferGeometry===!0&&delete h._maxInstanceCount,t.memory.geometries--}function a(f,h){return r[h.id]===!0||(h.addEventListener("dispose",o),r[h.id]=!0,t.memory.geometries++),h}function c(f){let h=f.attributes;for(let m in h)e.update(h[m],n.ARRAY_BUFFER)}function l(f){let h=[],m=f.index,g=f.attributes.position,x=0;if(g===void 0)return;if(m!==null){let M=m.array;x=m.version;for(let S=0,v=M.length;S<v;S+=3){let w=M[S+0],E=M[S+1],R=M[S+2];h.push(w,E,E,R,R,w)}}else{let M=g.array;x=g.version;for(let S=0,v=M.length/3-1;S<v;S+=3){let w=S+0,E=S+1,R=S+2;h.push(w,E,E,R,R,w)}}let d=new(g.count>=65535?Bi:Oi)(h,1);d.version=x;let p=s.get(f);p&&e.remove(p),s.set(f,d)}function u(f){let h=s.get(f);if(h){let m=f.index;m!==null&&h.version<m.version&&l(f)}else l(f);return s.get(f)}return{get:a,update:c,getWireframeAttribute:u}}function V0(n,e,t){let i;function r(f){i=f}let s,o;function a(f){s=f.type,o=f.bytesPerElement}function c(f,h){n.drawElements(i,h,s,f*o),t.update(h,i,1)}function l(f,h,m){m!==0&&(n.drawElementsInstanced(i,h,s,f*o,m),t.update(h,i,m))}function u(f,h,m){if(m===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,h,0,s,f,0,m);let x=0;for(let d=0;d<m;d++)x+=h[d];t.update(x,i,1)}this.setMode=r,this.setIndex=a,this.render=c,this.renderInstances=l,this.renderMultiDraw=u}function G0(n){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,o,a){switch(t.calls++,o){case n.TRIANGLES:t.triangles+=a*(s/3);break;case n.LINES:t.lines+=a*(s/2);break;case n.LINE_STRIP:t.lines+=a*(s-1);break;case n.LINE_LOOP:t.lines+=a*s;break;case n.POINTS:t.points+=a*s;break;default:Re("WebGLInfo: Unknown draw mode:",o);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:r,update:i}}function H0(n,e,t){let i=new WeakMap,r=new rt;function s(o,a,c){let l=o.morphTargetInfluences,u=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,f=u!==void 0?u.length:0,h=i.get(a);if(h===void 0||h.count!==f){let A=function(){R.dispose(),i.delete(a),a.removeEventListener("dispose",A)};h!==void 0&&h.texture.dispose();let m=a.morphAttributes.position!==void 0,g=a.morphAttributes.normal!==void 0,x=a.morphAttributes.color!==void 0,d=a.morphAttributes.position||[],p=a.morphAttributes.normal||[],M=a.morphAttributes.color||[],S=0;m===!0&&(S=1),g===!0&&(S=2),x===!0&&(S=3);let v=a.attributes.position.count*S,w=1;v>e.maxTextureSize&&(w=Math.ceil(v/e.maxTextureSize),v=e.maxTextureSize);let E=new Float32Array(v*w*4*f),R=new Xr(E,v,w,f);R.type=_n,R.needsUpdate=!0;let _=S*4;for(let I=0;I<f;I++){let C=d[I],U=p[I],X=M[I],Y=v*w*4*I;for(let N=0;N<C.count;N++){let G=N*_;m===!0&&(r.fromBufferAttribute(C,N),E[Y+G+0]=r.x,E[Y+G+1]=r.y,E[Y+G+2]=r.z,E[Y+G+3]=0),g===!0&&(r.fromBufferAttribute(U,N),E[Y+G+4]=r.x,E[Y+G+5]=r.y,E[Y+G+6]=r.z,E[Y+G+7]=0),x===!0&&(r.fromBufferAttribute(X,N),E[Y+G+8]=r.x,E[Y+G+9]=r.y,E[Y+G+10]=r.z,E[Y+G+11]=X.itemSize===4?r.w:1)}}h={count:f,texture:R,size:new Be(v,w)},i.set(a,h),a.addEventListener("dispose",A)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)c.getUniforms().setValue(n,"morphTexture",o.morphTexture,t);else{let m=0;for(let x=0;x<l.length;x++)m+=l[x];let g=a.morphTargetsRelative?1:1-m;c.getUniforms().setValue(n,"morphTargetBaseInfluence",g),c.getUniforms().setValue(n,"morphTargetInfluences",l)}c.getUniforms().setValue(n,"morphTargetsTexture",h.texture,t),c.getUniforms().setValue(n,"morphTargetsTextureSize",h.size)}return{update:s}}function W0(n,e,t,i,r){let s=new WeakMap;function o(l){let u=r.render.frame,f=l.geometry,h=e.get(l,f);if(s.get(h)!==u&&(e.update(h),s.set(h,u)),l.isInstancedMesh&&(l.hasEventListener("dispose",c)===!1&&l.addEventListener("dispose",c),s.get(l)!==u&&(t.update(l.instanceMatrix,n.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,n.ARRAY_BUFFER),s.set(l,u))),l.isSkinnedMesh){let m=l.skeleton;s.get(m)!==u&&(m.update(),s.set(m,u))}return h}function a(){s=new WeakMap}function c(l){let u=l.target;u.removeEventListener("dispose",c),i.releaseStatesOfObject(u),t.remove(u.instanceMatrix),u.instanceColor!==null&&t.remove(u.instanceColor)}return{update:o,dispose:a}}var X0={[Zl]:"LINEAR_TONE_MAPPING",[$l]:"REINHARD_TONE_MAPPING",[Jl]:"CINEON_TONE_MAPPING",[Kl]:"ACES_FILMIC_TONE_MAPPING",[Ql]:"AGX_TONE_MAPPING",[ec]:"NEUTRAL_TONE_MAPPING",[jl]:"CUSTOM_TONE_MAPPING"};function q0(n,e,t,i,r,s){let o=new nn(e,t,{type:n,depthBuffer:r,stencilBuffer:s,samples:i?4:0,depthTexture:r?new $n(e,t):void 0}),a=new nn(e,t,{type:Dn,depthBuffer:!1,stencilBuffer:!1}),c=new St;c.setAttribute("position",new Dt([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new Dt([0,2,0,0,2,0],2));let l=new Ao({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),u=new ut(c,l),f=new yr(-1,1,1,-1,0,1),h=null,m=null,g=!1,x,d=null,p=[],M=!1;this.setSize=function(S,v){o.setSize(S,v),a.setSize(S,v);for(let w=0;w<p.length;w++){let E=p[w];E.setSize&&E.setSize(S,v)}},this.setEffects=function(S){p=S,M=p.length>0&&p[0].isRenderPass===!0;let v=o.width,w=o.height;for(let E=0;E<p.length;E++){let R=p[E];R.setSize&&R.setSize(v,w)}},this.begin=function(S,v){if(g||S.toneMapping===xn&&p.length===0)return!1;if(d=v,v!==null){let w=v.width,E=v.height;(o.width!==w||o.height!==E)&&this.setSize(w,E)}return M===!1&&S.setRenderTarget(o),x=S.toneMapping,S.toneMapping=xn,!0},this.hasRenderPass=function(){return M},this.end=function(S,v){S.toneMapping=x,g=!0;let w=o,E=a;for(let R=0;R<p.length;R++){let _=p[R];if(_.enabled!==!1&&(_.render(S,E,w,v),_.needsSwap!==!1)){let A=w;w=E,E=A}}if(h!==S.outputColorSpace||m!==S.toneMapping){h=S.outputColorSpace,m=S.toneMapping,l.defines={},ze.getTransfer(h)===Ye&&(l.defines.SRGB_TRANSFER="");let R=X0[m];R&&(l.defines[R]=""),l.needsUpdate=!0}l.uniforms.tDiffuse.value=w.texture,S.setRenderTarget(d),S.render(u,f),d=null,g=!1},this.isCompositing=function(){return g},this.dispose=function(){o.depthTexture&&o.depthTexture.dispose(),o.dispose(),a.dispose(),c.dispose(),l.dispose()}}var id=new Ft,bc=new $n(1,1),rd=new Xr,sd=new So,od=new Zr,Bh=[],kh=[],zh=new Float32Array(16),Vh=new Float32Array(9),Gh=new Float32Array(4);function wr(n,e,t){let i=n[0];if(i<=0||i>0)return n;let r=e*t,s=Bh[r];if(s===void 0&&(s=new Float32Array(r),Bh[r]=s),e!==0){i.toArray(s,0);for(let o=1,a=0;o!==e;++o)a+=t,n[o].toArray(s,a)}return s}function wt(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function Et(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function Oa(n,e){let t=kh[e];t===void 0&&(t=new Int32Array(e),kh[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function Y0(n,e){let t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function Z0(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(wt(t,e))return;n.uniform2fv(this.addr,e),Et(t,e)}}function $0(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(wt(t,e))return;n.uniform3fv(this.addr,e),Et(t,e)}}function J0(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(wt(t,e))return;n.uniform4fv(this.addr,e),Et(t,e)}}function K0(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(wt(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),Et(t,e)}else{if(wt(t,i))return;Gh.set(i),n.uniformMatrix2fv(this.addr,!1,Gh),Et(t,i)}}function j0(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(wt(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),Et(t,e)}else{if(wt(t,i))return;Vh.set(i),n.uniformMatrix3fv(this.addr,!1,Vh),Et(t,i)}}function Q0(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(wt(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),Et(t,e)}else{if(wt(t,i))return;zh.set(i),n.uniformMatrix4fv(this.addr,!1,zh),Et(t,i)}}function ex(n,e){let t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function tx(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(wt(t,e))return;n.uniform2iv(this.addr,e),Et(t,e)}}function nx(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(wt(t,e))return;n.uniform3iv(this.addr,e),Et(t,e)}}function ix(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(wt(t,e))return;n.uniform4iv(this.addr,e),Et(t,e)}}function rx(n,e){let t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function sx(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(wt(t,e))return;n.uniform2uiv(this.addr,e),Et(t,e)}}function ox(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(wt(t,e))return;n.uniform3uiv(this.addr,e),Et(t,e)}}function ax(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(wt(t,e))return;n.uniform4uiv(this.addr,e),Et(t,e)}}function lx(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r);let s;this.type===n.SAMPLER_2D_SHADOW?(bc.compareFunction=t.isReversedDepthBuffer()?Pa:Ca,s=bc):s=id,t.setTexture2D(e||s,r)}function cx(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture3D(e||sd,r)}function ux(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTextureCube(e||od,r)}function hx(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture2DArray(e||rd,r)}function dx(n){switch(n){case 5126:return Y0;case 35664:return Z0;case 35665:return $0;case 35666:return J0;case 35674:return K0;case 35675:return j0;case 35676:return Q0;case 5124:case 35670:return ex;case 35667:case 35671:return tx;case 35668:case 35672:return nx;case 35669:case 35673:return ix;case 5125:return rx;case 36294:return sx;case 36295:return ox;case 36296:return ax;case 35678:case 36198:case 36298:case 36306:case 35682:return lx;case 35679:case 36299:case 36307:return cx;case 35680:case 36300:case 36308:case 36293:return ux;case 36289:case 36303:case 36311:case 36292:return hx}}function fx(n,e){n.uniform1fv(this.addr,e)}function px(n,e){let t=wr(e,this.size,2);n.uniform2fv(this.addr,t)}function mx(n,e){let t=wr(e,this.size,3);n.uniform3fv(this.addr,t)}function gx(n,e){let t=wr(e,this.size,4);n.uniform4fv(this.addr,t)}function xx(n,e){let t=wr(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function yx(n,e){let t=wr(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function _x(n,e){let t=wr(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function vx(n,e){n.uniform1iv(this.addr,e)}function bx(n,e){n.uniform2iv(this.addr,e)}function Mx(n,e){n.uniform3iv(this.addr,e)}function Sx(n,e){n.uniform4iv(this.addr,e)}function wx(n,e){n.uniform1uiv(this.addr,e)}function Ex(n,e){n.uniform2uiv(this.addr,e)}function Tx(n,e){n.uniform3uiv(this.addr,e)}function Ax(n,e){n.uniform4uiv(this.addr,e)}function Rx(n,e,t){let i=this.cache,r=e.length,s=Oa(t,r);wt(i,s)||(n.uniform1iv(this.addr,s),Et(i,s));let o;this.type===n.SAMPLER_2D_SHADOW?o=bc:o=id;for(let a=0;a!==r;++a)t.setTexture2D(e[a]||o,s[a])}function Cx(n,e,t){let i=this.cache,r=e.length,s=Oa(t,r);wt(i,s)||(n.uniform1iv(this.addr,s),Et(i,s));for(let o=0;o!==r;++o)t.setTexture3D(e[o]||sd,s[o])}function Px(n,e,t){let i=this.cache,r=e.length,s=Oa(t,r);wt(i,s)||(n.uniform1iv(this.addr,s),Et(i,s));for(let o=0;o!==r;++o)t.setTextureCube(e[o]||od,s[o])}function Ix(n,e,t){let i=this.cache,r=e.length,s=Oa(t,r);wt(i,s)||(n.uniform1iv(this.addr,s),Et(i,s));for(let o=0;o!==r;++o)t.setTexture2DArray(e[o]||rd,s[o])}function Lx(n){switch(n){case 5126:return fx;case 35664:return px;case 35665:return mx;case 35666:return gx;case 35674:return xx;case 35675:return yx;case 35676:return _x;case 5124:case 35670:return vx;case 35667:case 35671:return bx;case 35668:case 35672:return Mx;case 35669:case 35673:return Sx;case 5125:return wx;case 36294:return Ex;case 36295:return Tx;case 36296:return Ax;case 35678:case 36198:case 36298:case 36306:case 35682:return Rx;case 35679:case 36299:case 36307:return Cx;case 35680:case 36300:case 36308:case 36293:return Px;case 36289:case 36303:case 36311:case 36292:return Ix}}var Mc=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=dx(t.type)}},Sc=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Lx(t.type)}},wc=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){let r=this.seq;for(let s=0,o=r.length;s!==o;++s){let a=r[s];a.setValue(e,t[a.id],i)}}},_c=/(\w+)(\])?(\[|\.)?/g;function Hh(n,e){n.seq.push(e),n.map[e.id]=e}function Dx(n,e,t){let i=n.name,r=i.length;for(_c.lastIndex=0;;){let s=_c.exec(i),o=_c.lastIndex,a=s[1],c=s[2]==="]",l=s[3];if(c&&(a=a|0),l===void 0||l==="["&&o+2===r){Hh(t,l===void 0?new Mc(a,n,e):new Sc(a,n,e));break}else{let f=t.map[a];f===void 0&&(f=new wc(a),Hh(t,f)),t=f}}}var Sr=class{constructor(e,t){this.seq=[],this.map={};let i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let o=0;o<i;++o){let a=e.getActiveUniform(t,o),c=e.getUniformLocation(t,a.name);Dx(a,c,this)}let r=[],s=[];for(let o of this.seq)o.type===e.SAMPLER_2D_SHADOW||o.type===e.SAMPLER_CUBE_SHADOW||o.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(o):s.push(o);r.length>0&&(this.seq=r.concat(s))}setValue(e,t,i,r){let s=this.map[t];s!==void 0&&s.setValue(e,i,r)}setOptional(e,t,i){let r=t[i];r!==void 0&&this.setValue(e,i,r)}static upload(e,t,i,r){for(let s=0,o=t.length;s!==o;++s){let a=t[s],c=i[a.id];c.needsUpdate!==!1&&a.setValue(e,c.value,r)}}static seqWithValue(e,t){let i=[];for(let r=0,s=e.length;r!==s;++r){let o=e[r];o.id in t&&i.push(o)}return i}};function Wh(n,e,t){let i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}var Nx=37297,Fx=0;function Ux(n,e){let t=n.split(`
`),i=[],r=Math.max(e-6,0),s=Math.min(e+6,t.length);for(let o=r;o<s;o++){let a=o+1;i.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return i.join(`
`)}var Xh=new Ie;function Ox(n){ze._getMatrix(Xh,ze.workingColorSpace,n);let e=`mat3( ${Xh.elements.map(t=>t.toFixed(4))} )`;switch(ze.getTransfer(n)){case Hr:return[e,"LinearTransferOETF"];case Ye:return[e,"sRGBTransferOETF"];default:return Ae("WebGLProgram: Unsupported color space: ",n),[e,"LinearTransferOETF"]}}function qh(n,e,t){let i=n.getShaderParameter(e,n.COMPILE_STATUS),s=(n.getShaderInfoLog(e)||"").trim();if(i&&s==="")return"";let o=/ERROR: 0:(\d+)/.exec(s);if(o){let a=parseInt(o[1]);return t.toUpperCase()+`

`+s+`

`+Ux(n.getShaderSource(e),a)}else return s}function Bx(n,e){let t=Ox(e);return[`vec4 ${n}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}var kx={[Zl]:"Linear",[$l]:"Reinhard",[Jl]:"Cineon",[Kl]:"ACESFilmic",[Ql]:"AgX",[ec]:"Neutral",[jl]:"Custom"};function zx(n,e){let t=kx[e];return t===void 0?(Ae("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+n+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var La=new k;function Vx(){ze.getLuminanceCoefficients(La);let n=La.x.toFixed(4),e=La.y.toFixed(4),t=La.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Gx(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ms).join(`
`)}function Hx(n){let e=[];for(let t in n){let i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function Wx(n,e){let t={},i=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){let s=n.getActiveAttrib(e,r),o=s.name,a=1;s.type===n.FLOAT_MAT2&&(a=2),s.type===n.FLOAT_MAT3&&(a=3),s.type===n.FLOAT_MAT4&&(a=4),t[o]={type:s.type,location:n.getAttribLocation(e,o),locationSize:a}}return t}function ms(n){return n!==""}function Yh(n,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Zh(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var Xx=/^[ \t]*#include +<([\w\d./]+)>/gm;function Ec(n){return n.replace(Xx,Yx)}var qx=new Map;function Yx(n,e){let t=Ue[e];if(t===void 0){let i=qx.get(e);if(i!==void 0)t=Ue[i],Ae('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return Ec(t)}var Zx=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function $h(n){return n.replace(Zx,$x)}function $x(n,e,t,i){let r="";for(let s=parseInt(e);s<parseInt(t);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function Jh(n){let e=`precision ${n.precision} float;
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
#define LOW_PRECISION`),e}var Jx={[is]:"SHADOWMAP_TYPE_PCF",[_r]:"SHADOWMAP_TYPE_VSM"};function Kx(n){return Jx[n.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var jx={[_i]:"ENVMAP_TYPE_CUBE",[zi]:"ENVMAP_TYPE_CUBE",[rs]:"ENVMAP_TYPE_CUBE_UV"};function Qx(n){return n.envMap===!1?"ENVMAP_TYPE_CUBE":jx[n.envMapMode]||"ENVMAP_TYPE_CUBE"}var ey={[zi]:"ENVMAP_MODE_REFRACTION"};function ty(n){return n.envMap===!1?"ENVMAP_MODE_REFLECTION":ey[n.envMapMode]||"ENVMAP_MODE_REFLECTION"}var ny={[Go]:"ENVMAP_BLENDING_MULTIPLY",[mh]:"ENVMAP_BLENDING_MIX",[gh]:"ENVMAP_BLENDING_ADD"};function iy(n){return n.envMap===!1?"ENVMAP_BLENDING_NONE":ny[n.combine]||"ENVMAP_BLENDING_NONE"}function ry(n){let e=n.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,i=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:i,maxMip:t}}function sy(n,e,t,i){let r=n.getContext(),s=t.defines,o=t.vertexShader,a=t.fragmentShader,c=Kx(t),l=Qx(t),u=ty(t),f=iy(t),h=ry(t),m=Gx(t),g=Hx(s),x=r.createProgram(),d,p,M=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(d=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(ms).join(`
`),d.length>0&&(d+=`
`),p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(ms).join(`
`),p.length>0&&(p+=`
`)):(d=[Jh(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ms).join(`
`),p=[Jh(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+l:"",t.envMap?"#define "+u:"",t.envMap?"#define "+f:"",h?"#define CUBEUV_TEXEL_WIDTH "+h.texelWidth:"",h?"#define CUBEUV_TEXEL_HEIGHT "+h.texelHeight:"",h?"#define CUBEUV_MAX_MIP "+h.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==xn?"#define TONE_MAPPING":"",t.toneMapping!==xn?Ue.tonemapping_pars_fragment:"",t.toneMapping!==xn?zx("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Ue.colorspace_pars_fragment,Bx("linearToOutputTexel",t.outputColorSpace),Vx(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(ms).join(`
`)),o=Ec(o),o=Yh(o,t),o=Zh(o,t),a=Ec(a),a=Yh(a,t),a=Zh(a,t),o=$h(o),a=$h(a),t.isRawShaderMaterial!==!0&&(M=`#version 300 es
`,d=[m,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+d,p=["#define varying in",t.glslVersion===cc?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===cc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);let S=M+d+o,v=M+p+a,w=Wh(r,r.VERTEX_SHADER,S),E=Wh(r,r.FRAGMENT_SHADER,v);r.attachShader(x,w),r.attachShader(x,E),t.index0AttributeName!==void 0?r.bindAttribLocation(x,0,t.index0AttributeName):t.hasPositionAttribute===!0&&r.bindAttribLocation(x,0,"position"),r.linkProgram(x);function R(C){if(n.debug.checkShaderErrors){let U=r.getProgramInfoLog(x)||"",X=r.getShaderInfoLog(w)||"",Y=r.getShaderInfoLog(E)||"",N=U.trim(),G=X.trim(),H=Y.trim(),K=!0,Q=!0;if(r.getProgramParameter(x,r.LINK_STATUS)===!1)if(K=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(r,x,w,E);else{let ee=qh(r,w,"vertex"),ce=qh(r,E,"fragment");Re("WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(x,r.VALIDATE_STATUS)+`

Material Name: `+C.name+`
Material Type: `+C.type+`

Program Info Log: `+N+`
`+ee+`
`+ce)}else N!==""?Ae("WebGLProgram: Program Info Log:",N):(G===""||H==="")&&(Q=!1);Q&&(C.diagnostics={runnable:K,programLog:N,vertexShader:{log:G,prefix:d},fragmentShader:{log:H,prefix:p}})}r.deleteShader(w),r.deleteShader(E),_=new Sr(r,x),A=Wx(r,x)}let _;this.getUniforms=function(){return _===void 0&&R(this),_};let A;this.getAttributes=function(){return A===void 0&&R(this),A};let I=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return I===!1&&(I=r.getProgramParameter(x,Nx)),I},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(x),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Fx++,this.cacheKey=e,this.usedTimes=1,this.program=x,this.vertexShader=w,this.fragmentShader=E,this}var oy=0,Tc=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,i){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(i)===!1&&(r.add(i),i.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){let t=this.shaderCache,i=t.get(e);return i===void 0&&(i=new Ac(e),t.set(e,i)),i}},Ac=class{constructor(e){this.id=oy++,this.code=e,this.usedTimes=0}};function ay(n){return n===bi||n===us||n===hs}function ly(n,e,t,i,r,s){let o=new qr,a=new Tc,c=new Set,l=[],u=new Map,f=i.logarithmicDepthBuffer,h=i.precision,m={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(_){return c.add(_),_===0?"uv":`uv${_}`}function x(_,A,I,C,U,X){let Y=C.fog,N=U.geometry,G=_.isMeshStandardMaterial||_.isMeshLambertMaterial||_.isMeshPhongMaterial?C.environment:null,H=_.isMeshStandardMaterial||_.isMeshLambertMaterial&&!_.envMap||_.isMeshPhongMaterial&&!_.envMap,K=e.get(_.envMap||G,H),Q=K&&K.mapping===rs?K.image.height:null,ee=m[_.type];_.precision!==null&&(h=i.getMaxPrecision(_.precision),h!==_.precision&&Ae("WebGLProgram.getParameters:",_.precision,"not supported, using",h,"instead."));let ce=N.morphAttributes.position||N.morphAttributes.normal||N.morphAttributes.color,xe=ce!==void 0?ce.length:0,We=0;N.morphAttributes.position!==void 0&&(We=1),N.morphAttributes.normal!==void 0&&(We=2),N.morphAttributes.color!==void 0&&(We=3);let ot,Xe,J,re;if(ee){let ye=Fn[ee];ot=ye.vertexShader,Xe=ye.fragmentShader}else{ot=_.vertexShader,Xe=_.fragmentShader;let ye=a.getVertexShaderStage(_),lt=a.getFragmentShaderStage(_);a.update(_,ye,lt),J=ye.id,re=lt.id}let te=n.getRenderTarget(),Pe=n.state.buffers.depth.getReversed(),Le=U.isInstancedMesh===!0,Ee=U.isBatchedMesh===!0,ft=!!_.map,ke=!!_.matcap,je=!!K,qe=!!_.aoMap,Ge=!!_.lightMap,gt=!!_.bumpMap&&_.wireframe===!1,Mt=!!_.normalMap,At=!!_.displacementMap,Lt=!!_.emissiveMap,at=!!_.metalnessMap,xt=!!_.roughnessMap,L=_.anisotropy>0,Zt=_.clearcoat>0,$e=_.dispersion>0,T=_.iridescence>0,y=_.sheen>0,F=_.transmission>0,z=L&&!!_.anisotropyMap,W=Zt&&!!_.clearcoatMap,ne=Zt&&!!_.clearcoatNormalMap,se=Zt&&!!_.clearcoatRoughnessMap,q=T&&!!_.iridescenceMap,$=T&&!!_.iridescenceThicknessMap,oe=y&&!!_.sheenColorMap,be=y&&!!_.sheenRoughnessMap,ue=!!_.specularMap,ae=!!_.specularColorMap,we=!!_.specularIntensityMap,Te=F&&!!_.transmissionMap,De=F&&!!_.thicknessMap,P=!!_.gradientMap,ie=!!_.alphaMap,Z=_.alphaTest>0,le=!!_.alphaHash,pe=!!_.extensions,j=xn;_.toneMapped&&(te===null||te.isXRRenderTarget===!0)&&(j=n.toneMapping);let ve={shaderID:ee,shaderType:_.type,shaderName:_.name,vertexShader:ot,fragmentShader:Xe,defines:_.defines,customVertexShaderID:J,customFragmentShaderID:re,isRawShaderMaterial:_.isRawShaderMaterial===!0,glslVersion:_.glslVersion,precision:h,batching:Ee,batchingColor:Ee&&U._colorsTexture!==null,instancing:Le,instancingColor:Le&&U.instanceColor!==null,instancingMorph:Le&&U.morphTexture!==null,outputColorSpace:te===null?n.outputColorSpace:te.isXRRenderTarget===!0?te.texture.colorSpace:ze.workingColorSpace,alphaToCoverage:!!_.alphaToCoverage,map:ft,matcap:ke,envMap:je,envMapMode:je&&K.mapping,envMapCubeUVHeight:Q,aoMap:qe,lightMap:Ge,bumpMap:gt,normalMap:Mt,displacementMap:At,emissiveMap:Lt,normalMapObjectSpace:Mt&&_.normalMapType===_h,normalMapTangentSpace:Mt&&_.normalMapType===Ra,packedNormalMap:Mt&&_.normalMapType===Ra&&ay(_.normalMap.format),metalnessMap:at,roughnessMap:xt,anisotropy:L,anisotropyMap:z,clearcoat:Zt,clearcoatMap:W,clearcoatNormalMap:ne,clearcoatRoughnessMap:se,dispersion:$e,iridescence:T,iridescenceMap:q,iridescenceThicknessMap:$,sheen:y,sheenColorMap:oe,sheenRoughnessMap:be,specularMap:ue,specularColorMap:ae,specularIntensityMap:we,transmission:F,transmissionMap:Te,thicknessMap:De,gradientMap:P,opaque:_.transparent===!1&&_.blending===Fi&&_.alphaToCoverage===!1,alphaMap:ie,alphaTest:Z,alphaHash:le,combine:_.combine,mapUv:ft&&g(_.map.channel),aoMapUv:qe&&g(_.aoMap.channel),lightMapUv:Ge&&g(_.lightMap.channel),bumpMapUv:gt&&g(_.bumpMap.channel),normalMapUv:Mt&&g(_.normalMap.channel),displacementMapUv:At&&g(_.displacementMap.channel),emissiveMapUv:Lt&&g(_.emissiveMap.channel),metalnessMapUv:at&&g(_.metalnessMap.channel),roughnessMapUv:xt&&g(_.roughnessMap.channel),anisotropyMapUv:z&&g(_.anisotropyMap.channel),clearcoatMapUv:W&&g(_.clearcoatMap.channel),clearcoatNormalMapUv:ne&&g(_.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:se&&g(_.clearcoatRoughnessMap.channel),iridescenceMapUv:q&&g(_.iridescenceMap.channel),iridescenceThicknessMapUv:$&&g(_.iridescenceThicknessMap.channel),sheenColorMapUv:oe&&g(_.sheenColorMap.channel),sheenRoughnessMapUv:be&&g(_.sheenRoughnessMap.channel),specularMapUv:ue&&g(_.specularMap.channel),specularColorMapUv:ae&&g(_.specularColorMap.channel),specularIntensityMapUv:we&&g(_.specularIntensityMap.channel),transmissionMapUv:Te&&g(_.transmissionMap.channel),thicknessMapUv:De&&g(_.thicknessMap.channel),alphaMapUv:ie&&g(_.alphaMap.channel),vertexTangents:!!N.attributes.tangent&&(Mt||L),vertexNormals:!!N.attributes.normal,vertexColors:_.vertexColors,vertexAlphas:_.vertexColors===!0&&!!N.attributes.color&&N.attributes.color.itemSize===4,pointsUvs:U.isPoints===!0&&!!N.attributes.uv&&(ft||ie),fog:!!Y,useFog:_.fog===!0,fogExp2:!!Y&&Y.isFogExp2,flatShading:_.wireframe===!1&&(_.flatShading===!0||N.attributes.normal===void 0&&Mt===!1&&(_.isMeshLambertMaterial||_.isMeshPhongMaterial||_.isMeshStandardMaterial||_.isMeshPhysicalMaterial)),sizeAttenuation:_.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:Pe,skinning:U.isSkinnedMesh===!0,hasPositionAttribute:N.attributes.position!==void 0,morphTargets:N.morphAttributes.position!==void 0,morphNormals:N.morphAttributes.normal!==void 0,morphColors:N.morphAttributes.color!==void 0,morphTargetsCount:xe,morphTextureStride:We,numDirLights:A.directional.length,numPointLights:A.point.length,numSpotLights:A.spot.length,numSpotLightMaps:A.spotLightMap.length,numRectAreaLights:A.rectArea.length,numHemiLights:A.hemi.length,numDirLightShadows:A.directionalShadowMap.length,numPointLightShadows:A.pointShadowMap.length,numSpotLightShadows:A.spotShadowMap.length,numSpotLightShadowsWithMaps:A.numSpotLightShadowsWithMaps,numLightProbes:A.numLightProbes,numLightProbeGrids:X.length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:_.dithering,shadowMapEnabled:n.shadowMap.enabled&&I.length>0,shadowMapType:n.shadowMap.type,toneMapping:j,decodeVideoTexture:ft&&_.map.isVideoTexture===!0&&ze.getTransfer(_.map.colorSpace)===Ye,decodeVideoTextureEmissive:Lt&&_.emissiveMap.isVideoTexture===!0&&ze.getTransfer(_.emissiveMap.colorSpace)===Ye,premultipliedAlpha:_.premultipliedAlpha,doubleSided:_.side===Pn,flipSided:_.side===qt,useDepthPacking:_.depthPacking>=0,depthPacking:_.depthPacking||0,index0AttributeName:_.index0AttributeName,extensionClipCullDistance:pe&&_.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(pe&&_.extensions.multiDraw===!0||Ee)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:_.customProgramCacheKey()};return ve.vertexUv1s=c.has(1),ve.vertexUv2s=c.has(2),ve.vertexUv3s=c.has(3),c.clear(),ve}function d(_){let A=[];if(_.shaderID?A.push(_.shaderID):(A.push(_.customVertexShaderID),A.push(_.customFragmentShaderID)),_.defines!==void 0)for(let I in _.defines)A.push(I),A.push(_.defines[I]);return _.isRawShaderMaterial===!1&&(p(A,_),M(A,_),A.push(n.outputColorSpace)),A.push(_.customProgramCacheKey),A.join()}function p(_,A){_.push(A.precision),_.push(A.outputColorSpace),_.push(A.envMapMode),_.push(A.envMapCubeUVHeight),_.push(A.mapUv),_.push(A.alphaMapUv),_.push(A.lightMapUv),_.push(A.aoMapUv),_.push(A.bumpMapUv),_.push(A.normalMapUv),_.push(A.displacementMapUv),_.push(A.emissiveMapUv),_.push(A.metalnessMapUv),_.push(A.roughnessMapUv),_.push(A.anisotropyMapUv),_.push(A.clearcoatMapUv),_.push(A.clearcoatNormalMapUv),_.push(A.clearcoatRoughnessMapUv),_.push(A.iridescenceMapUv),_.push(A.iridescenceThicknessMapUv),_.push(A.sheenColorMapUv),_.push(A.sheenRoughnessMapUv),_.push(A.specularMapUv),_.push(A.specularColorMapUv),_.push(A.specularIntensityMapUv),_.push(A.transmissionMapUv),_.push(A.thicknessMapUv),_.push(A.combine),_.push(A.fogExp2),_.push(A.sizeAttenuation),_.push(A.morphTargetsCount),_.push(A.morphAttributeCount),_.push(A.numDirLights),_.push(A.numPointLights),_.push(A.numSpotLights),_.push(A.numSpotLightMaps),_.push(A.numHemiLights),_.push(A.numRectAreaLights),_.push(A.numDirLightShadows),_.push(A.numPointLightShadows),_.push(A.numSpotLightShadows),_.push(A.numSpotLightShadowsWithMaps),_.push(A.numLightProbes),_.push(A.shadowMapType),_.push(A.toneMapping),_.push(A.numClippingPlanes),_.push(A.numClipIntersection),_.push(A.depthPacking)}function M(_,A){o.disableAll(),A.instancing&&o.enable(0),A.instancingColor&&o.enable(1),A.instancingMorph&&o.enable(2),A.matcap&&o.enable(3),A.envMap&&o.enable(4),A.normalMapObjectSpace&&o.enable(5),A.normalMapTangentSpace&&o.enable(6),A.clearcoat&&o.enable(7),A.iridescence&&o.enable(8),A.alphaTest&&o.enable(9),A.vertexColors&&o.enable(10),A.vertexAlphas&&o.enable(11),A.vertexUv1s&&o.enable(12),A.vertexUv2s&&o.enable(13),A.vertexUv3s&&o.enable(14),A.vertexTangents&&o.enable(15),A.anisotropy&&o.enable(16),A.alphaHash&&o.enable(17),A.batching&&o.enable(18),A.dispersion&&o.enable(19),A.batchingColor&&o.enable(20),A.gradientMap&&o.enable(21),A.packedNormalMap&&o.enable(22),A.vertexNormals&&o.enable(23),_.push(o.mask),o.disableAll(),A.fog&&o.enable(0),A.useFog&&o.enable(1),A.flatShading&&o.enable(2),A.logarithmicDepthBuffer&&o.enable(3),A.reversedDepthBuffer&&o.enable(4),A.skinning&&o.enable(5),A.morphTargets&&o.enable(6),A.morphNormals&&o.enable(7),A.morphColors&&o.enable(8),A.premultipliedAlpha&&o.enable(9),A.shadowMapEnabled&&o.enable(10),A.doubleSided&&o.enable(11),A.flipSided&&o.enable(12),A.useDepthPacking&&o.enable(13),A.dithering&&o.enable(14),A.transmission&&o.enable(15),A.sheen&&o.enable(16),A.opaque&&o.enable(17),A.pointsUvs&&o.enable(18),A.decodeVideoTexture&&o.enable(19),A.decodeVideoTextureEmissive&&o.enable(20),A.alphaToCoverage&&o.enable(21),A.numLightProbeGrids>0&&o.enable(22),A.hasPositionAttribute&&o.enable(23),_.push(o.mask)}function S(_){let A=m[_.type],I;if(A){let C=Fn[A];I=Ih.clone(C.uniforms)}else I=_.uniforms;return I}function v(_,A){let I=u.get(A);return I!==void 0?++I.usedTimes:(I=new sy(n,A,_,r),l.push(I),u.set(A,I)),I}function w(_){if(--_.usedTimes===0){let A=l.indexOf(_);l[A]=l[l.length-1],l.pop(),u.delete(_.cacheKey),_.destroy()}}function E(_){a.remove(_)}function R(){a.dispose()}return{getParameters:x,getProgramCacheKey:d,getUniforms:S,acquireProgram:v,releaseProgram:w,releaseShaderCache:E,programs:l,dispose:R}}function cy(){let n=new WeakMap;function e(o){return n.has(o)}function t(o){let a=n.get(o);return a===void 0&&(a={},n.set(o,a)),a}function i(o){n.delete(o)}function r(o,a,c){n.get(o)[a]=c}function s(){n=new WeakMap}return{has:e,get:t,remove:i,update:r,dispose:s}}function uy(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.materialVariant!==e.materialVariant?n.materialVariant-e.materialVariant:n.z!==e.z?n.z-e.z:n.id-e.id}function Kh(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function jh(){let n=[],e=0,t=[],i=[],r=[];function s(){e=0,t.length=0,i.length=0,r.length=0}function o(h){let m=0;return h.isInstancedMesh&&(m+=2),h.isSkinnedMesh&&(m+=1),m}function a(h,m,g,x,d,p){let M=n[e];return M===void 0?(M={id:h.id,object:h,geometry:m,material:g,materialVariant:o(h),groupOrder:x,renderOrder:h.renderOrder,z:d,group:p},n[e]=M):(M.id=h.id,M.object=h,M.geometry=m,M.material=g,M.materialVariant=o(h),M.groupOrder=x,M.renderOrder=h.renderOrder,M.z=d,M.group=p),e++,M}function c(h,m,g,x,d,p){let M=a(h,m,g,x,d,p);g.transmission>0?i.push(M):g.transparent===!0?r.push(M):t.push(M)}function l(h,m,g,x,d,p){let M=a(h,m,g,x,d,p);g.transmission>0?i.unshift(M):g.transparent===!0?r.unshift(M):t.unshift(M)}function u(h,m,g){t.length>1&&t.sort(h||uy),i.length>1&&i.sort(m||Kh),r.length>1&&r.sort(m||Kh),g&&(t.reverse(),i.reverse(),r.reverse())}function f(){for(let h=e,m=n.length;h<m;h++){let g=n[h];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:t,transmissive:i,transparent:r,init:s,push:c,unshift:l,finish:f,sort:u}}function hy(){let n=new WeakMap;function e(i,r){let s=n.get(i),o;return s===void 0?(o=new jh,n.set(i,[o])):r>=s.length?(o=new jh,s.push(o)):o=s[r],o}function t(){n=new WeakMap}return{get:e,dispose:t}}function dy(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new k,color:new Fe};break;case"SpotLight":t={position:new k,direction:new k,color:new Fe,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new k,color:new Fe,distance:0,decay:0};break;case"HemisphereLight":t={direction:new k,skyColor:new Fe,groundColor:new Fe};break;case"RectAreaLight":t={color:new Fe,position:new k,halfWidth:new k,halfHeight:new k};break}return n[e.id]=t,t}}}function fy(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Be};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Be};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Be,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}var py=0;function my(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function gy(n){let e=new dy,t=fy(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let l=0;l<9;l++)i.probe.push(new k);let r=new k,s=new st,o=new st;function a(l){let u=0,f=0,h=0;for(let A=0;A<9;A++)i.probe[A].set(0,0,0);let m=0,g=0,x=0,d=0,p=0,M=0,S=0,v=0,w=0,E=0,R=0;l.sort(my);for(let A=0,I=l.length;A<I;A++){let C=l[A],U=C.color,X=C.intensity,Y=C.distance,N=null;if(C.shadow&&C.shadow.map&&(C.shadow.map.texture.format===bi?N=C.shadow.map.texture:N=C.shadow.map.depthTexture||C.shadow.map.texture),C.isAmbientLight)u+=U.r*X,f+=U.g*X,h+=U.b*X;else if(C.isLightProbe){for(let G=0;G<9;G++)i.probe[G].addScaledVector(C.sh.coefficients[G],X);R++}else if(C.isDirectionalLight){let G=e.get(C);if(G.color.copy(C.color).multiplyScalar(C.intensity),C.castShadow){let H=C.shadow,K=t.get(C);K.shadowIntensity=H.intensity,K.shadowBias=H.bias,K.shadowNormalBias=H.normalBias,K.shadowRadius=H.radius,K.shadowMapSize=H.mapSize,i.directionalShadow[m]=K,i.directionalShadowMap[m]=N,i.directionalShadowMatrix[m]=C.shadow.matrix,M++}i.directional[m]=G,m++}else if(C.isSpotLight){let G=e.get(C);G.position.setFromMatrixPosition(C.matrixWorld),G.color.copy(U).multiplyScalar(X),G.distance=Y,G.coneCos=Math.cos(C.angle),G.penumbraCos=Math.cos(C.angle*(1-C.penumbra)),G.decay=C.decay,i.spot[x]=G;let H=C.shadow;if(C.map&&(i.spotLightMap[w]=C.map,w++,H.updateMatrices(C),C.castShadow&&E++),i.spotLightMatrix[x]=H.matrix,C.castShadow){let K=t.get(C);K.shadowIntensity=H.intensity,K.shadowBias=H.bias,K.shadowNormalBias=H.normalBias,K.shadowRadius=H.radius,K.shadowMapSize=H.mapSize,i.spotShadow[x]=K,i.spotShadowMap[x]=N,v++}x++}else if(C.isRectAreaLight){let G=e.get(C);G.color.copy(U).multiplyScalar(X),G.halfWidth.set(C.width*.5,0,0),G.halfHeight.set(0,C.height*.5,0),i.rectArea[d]=G,d++}else if(C.isPointLight){let G=e.get(C);if(G.color.copy(C.color).multiplyScalar(C.intensity),G.distance=C.distance,G.decay=C.decay,C.castShadow){let H=C.shadow,K=t.get(C);K.shadowIntensity=H.intensity,K.shadowBias=H.bias,K.shadowNormalBias=H.normalBias,K.shadowRadius=H.radius,K.shadowMapSize=H.mapSize,K.shadowCameraNear=H.camera.near,K.shadowCameraFar=H.camera.far,i.pointShadow[g]=K,i.pointShadowMap[g]=N,i.pointShadowMatrix[g]=C.shadow.matrix,S++}i.point[g]=G,g++}else if(C.isHemisphereLight){let G=e.get(C);G.skyColor.copy(C.color).multiplyScalar(X),G.groundColor.copy(C.groundColor).multiplyScalar(X),i.hemi[p]=G,p++}}d>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=he.LTC_FLOAT_1,i.rectAreaLTC2=he.LTC_FLOAT_2):(i.rectAreaLTC1=he.LTC_HALF_1,i.rectAreaLTC2=he.LTC_HALF_2)),i.ambient[0]=u,i.ambient[1]=f,i.ambient[2]=h;let _=i.hash;(_.directionalLength!==m||_.pointLength!==g||_.spotLength!==x||_.rectAreaLength!==d||_.hemiLength!==p||_.numDirectionalShadows!==M||_.numPointShadows!==S||_.numSpotShadows!==v||_.numSpotMaps!==w||_.numLightProbes!==R)&&(i.directional.length=m,i.spot.length=x,i.rectArea.length=d,i.point.length=g,i.hemi.length=p,i.directionalShadow.length=M,i.directionalShadowMap.length=M,i.pointShadow.length=S,i.pointShadowMap.length=S,i.spotShadow.length=v,i.spotShadowMap.length=v,i.directionalShadowMatrix.length=M,i.pointShadowMatrix.length=S,i.spotLightMatrix.length=v+w-E,i.spotLightMap.length=w,i.numSpotLightShadowsWithMaps=E,i.numLightProbes=R,_.directionalLength=m,_.pointLength=g,_.spotLength=x,_.rectAreaLength=d,_.hemiLength=p,_.numDirectionalShadows=M,_.numPointShadows=S,_.numSpotShadows=v,_.numSpotMaps=w,_.numLightProbes=R,i.version=py++)}function c(l,u){let f=0,h=0,m=0,g=0,x=0,d=u.matrixWorldInverse;for(let p=0,M=l.length;p<M;p++){let S=l[p];if(S.isDirectionalLight){let v=i.directional[f];v.direction.setFromMatrixPosition(S.matrixWorld),r.setFromMatrixPosition(S.target.matrixWorld),v.direction.sub(r),v.direction.transformDirection(d),f++}else if(S.isSpotLight){let v=i.spot[m];v.position.setFromMatrixPosition(S.matrixWorld),v.position.applyMatrix4(d),v.direction.setFromMatrixPosition(S.matrixWorld),r.setFromMatrixPosition(S.target.matrixWorld),v.direction.sub(r),v.direction.transformDirection(d),m++}else if(S.isRectAreaLight){let v=i.rectArea[g];v.position.setFromMatrixPosition(S.matrixWorld),v.position.applyMatrix4(d),o.identity(),s.copy(S.matrixWorld),s.premultiply(d),o.extractRotation(s),v.halfWidth.set(S.width*.5,0,0),v.halfHeight.set(0,S.height*.5,0),v.halfWidth.applyMatrix4(o),v.halfHeight.applyMatrix4(o),g++}else if(S.isPointLight){let v=i.point[h];v.position.setFromMatrixPosition(S.matrixWorld),v.position.applyMatrix4(d),h++}else if(S.isHemisphereLight){let v=i.hemi[x];v.direction.setFromMatrixPosition(S.matrixWorld),v.direction.transformDirection(d),x++}}}return{setup:a,setupView:c,state:i}}function Qh(n){let e=new gy(n),t=[],i=[],r=[];function s(h){f.camera=h,t.length=0,i.length=0,r.length=0}function o(h){t.push(h)}function a(h){i.push(h)}function c(h){r.push(h)}function l(){e.setup(t)}function u(h){e.setupView(t,h)}let f={lightsArray:t,shadowsArray:i,lightProbeGridArray:r,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:s,state:f,setupLights:l,setupLightsView:u,pushLight:o,pushShadow:a,pushLightProbeGrid:c}}function xy(n){let e=new WeakMap;function t(r,s=0){let o=e.get(r),a;return o===void 0?(a=new Qh(n),e.set(r,[a])):s>=o.length?(a=new Qh(n),o.push(a)):a=o[s],a}function i(){e=new WeakMap}return{get:t,dispose:i}}var yy=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,_y=`uniform sampler2D shadow_pass;
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
}`,vy=[new k(1,0,0),new k(-1,0,0),new k(0,1,0),new k(0,-1,0),new k(0,0,1),new k(0,0,-1)],by=[new k(0,-1,0),new k(0,-1,0),new k(0,0,1),new k(0,0,-1),new k(0,-1,0),new k(0,-1,0)],ed=new st,ps=new k,vc=new k;function My(n,e,t){let i=new gr,r=new Be,s=new Be,o=new rt,a=new Ro,c=new Co,l={},u=t.maxTextureSize,f={[Xn]:qt,[qt]:Xn,[Pn]:Pn},h=new Ut({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Be},radius:{value:4}},vertexShader:yy,fragmentShader:_y}),m=h.clone();m.defines.HORIZONTAL_PASS=1;let g=new St;g.setAttribute("position",new Ke(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let x=new ut(g,h),d=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=is;let p=this.type;this.render=function(E,R,_){if(d.enabled===!1||d.autoUpdate===!1&&d.needsUpdate===!1||E.length===0)return;this.type===Ju&&(Ae("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=is);let A=n.getRenderTarget(),I=n.getActiveCubeFace(),C=n.getActiveMipmapLevel(),U=n.state;U.setBlending(In),U.buffers.depth.getReversed()===!0?U.buffers.color.setClear(0,0,0,0):U.buffers.color.setClear(1,1,1,1),U.buffers.depth.setTest(!0),U.setScissorTest(!1);let X=p!==this.type;X&&R.traverse(function(Y){Y.material&&(Array.isArray(Y.material)?Y.material.forEach(N=>N.needsUpdate=!0):Y.material.needsUpdate=!0)});for(let Y=0,N=E.length;Y<N;Y++){let G=E[Y],H=G.shadow;if(H===void 0){Ae("WebGLShadowMap:",G,"has no shadow.");continue}if(H.autoUpdate===!1&&H.needsUpdate===!1)continue;r.copy(H.mapSize);let K=H.getFrameExtents();r.multiply(K),s.copy(H.mapSize),(r.x>u||r.y>u)&&(r.x>u&&(s.x=Math.floor(u/K.x),r.x=s.x*K.x,H.mapSize.x=s.x),r.y>u&&(s.y=Math.floor(u/K.y),r.y=s.y*K.y,H.mapSize.y=s.y));let Q=n.state.buffers.depth.getReversed();if(H.camera._reversedDepth=Q,H.map===null||X===!0){if(H.map!==null&&(H.map.depthTexture!==null&&(H.map.depthTexture.dispose(),H.map.depthTexture=null),H.map.dispose()),this.type===_r){if(G.isPointLight){Ae("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}H.map=new nn(r.x,r.y,{format:bi,type:Dn,minFilter:Nt,magFilter:Nt,generateMipmaps:!1}),H.map.texture.name=G.name+".shadowMap",H.map.depthTexture=new $n(r.x,r.y,_n),H.map.depthTexture.name=G.name+".shadowMapDepth",H.map.depthTexture.format=An,H.map.depthTexture.compareFunction=null,H.map.depthTexture.minFilter=Ct,H.map.depthTexture.magFilter=Ct}else G.isPointLight?(H.map=new Na(r.x),H.map.depthTexture=new To(r.x,yn)):(H.map=new nn(r.x,r.y),H.map.depthTexture=new $n(r.x,r.y,yn)),H.map.depthTexture.name=G.name+".shadowMap",H.map.depthTexture.format=An,this.type===is?(H.map.depthTexture.compareFunction=Q?Pa:Ca,H.map.depthTexture.minFilter=Nt,H.map.depthTexture.magFilter=Nt):(H.map.depthTexture.compareFunction=null,H.map.depthTexture.minFilter=Ct,H.map.depthTexture.magFilter=Ct);H.camera.updateProjectionMatrix()}let ee=H.map.isWebGLCubeRenderTarget?6:1;for(let ce=0;ce<ee;ce++){if(H.map.isWebGLCubeRenderTarget)n.setRenderTarget(H.map,ce),n.clear();else{ce===0&&(n.setRenderTarget(H.map),n.clear());let xe=H.getViewport(ce);o.set(s.x*xe.x,s.y*xe.y,s.x*xe.z,s.y*xe.w),U.viewport(o)}if(G.isPointLight){let xe=H.camera,We=H.matrix,ot=G.distance||xe.far;ot!==xe.far&&(xe.far=ot,xe.updateProjectionMatrix()),ps.setFromMatrixPosition(G.matrixWorld),xe.position.copy(ps),vc.copy(xe.position),vc.add(vy[ce]),xe.up.copy(by[ce]),xe.lookAt(vc),xe.updateMatrixWorld(),We.makeTranslation(-ps.x,-ps.y,-ps.z),ed.multiplyMatrices(xe.projectionMatrix,xe.matrixWorldInverse),H._frustum.setFromProjectionMatrix(ed,xe.coordinateSystem,xe.reversedDepth)}else H.updateMatrices(G);i=H.getFrustum(),v(R,_,H.camera,G,this.type)}H.isPointLightShadow!==!0&&this.type===_r&&M(H,_),H.needsUpdate=!1}p=this.type,d.needsUpdate=!1,n.setRenderTarget(A,I,C)};function M(E,R){let _=e.update(x);h.defines.VSM_SAMPLES!==E.blurSamples&&(h.defines.VSM_SAMPLES=E.blurSamples,m.defines.VSM_SAMPLES=E.blurSamples,h.needsUpdate=!0,m.needsUpdate=!0),E.mapPass===null&&(E.mapPass=new nn(r.x,r.y,{format:bi,type:Dn})),h.uniforms.shadow_pass.value=E.map.depthTexture,h.uniforms.resolution.value=E.mapSize,h.uniforms.radius.value=E.radius,n.setRenderTarget(E.mapPass),n.clear(),n.renderBufferDirect(R,null,_,h,x,null),m.uniforms.shadow_pass.value=E.mapPass.texture,m.uniforms.resolution.value=E.mapSize,m.uniforms.radius.value=E.radius,n.setRenderTarget(E.map),n.clear(),n.renderBufferDirect(R,null,_,m,x,null)}function S(E,R,_,A){let I=null,C=_.isPointLight===!0?E.customDistanceMaterial:E.customDepthMaterial;if(C!==void 0)I=C;else if(I=_.isPointLight===!0?c:a,n.localClippingEnabled&&R.clipShadows===!0&&Array.isArray(R.clippingPlanes)&&R.clippingPlanes.length!==0||R.displacementMap&&R.displacementScale!==0||R.alphaMap&&R.alphaTest>0||R.map&&R.alphaTest>0||R.alphaToCoverage===!0){let U=I.uuid,X=R.uuid,Y=l[U];Y===void 0&&(Y={},l[U]=Y);let N=Y[X];N===void 0&&(N=I.clone(),Y[X]=N,R.addEventListener("dispose",w)),I=N}if(I.visible=R.visible,I.wireframe=R.wireframe,A===_r?I.side=R.shadowSide!==null?R.shadowSide:R.side:I.side=R.shadowSide!==null?R.shadowSide:f[R.side],I.alphaMap=R.alphaMap,I.alphaTest=R.alphaToCoverage===!0?.5:R.alphaTest,I.map=R.map,I.clipShadows=R.clipShadows,I.clippingPlanes=R.clippingPlanes,I.clipIntersection=R.clipIntersection,I.displacementMap=R.displacementMap,I.displacementScale=R.displacementScale,I.displacementBias=R.displacementBias,I.wireframeLinewidth=R.wireframeLinewidth,I.linewidth=R.linewidth,_.isPointLight===!0&&I.isMeshDistanceMaterial===!0){let U=n.properties.get(I);U.light=_}return I}function v(E,R,_,A,I){if(E.visible===!1)return;if(E.layers.test(R.layers)&&(E.isMesh||E.isLine||E.isPoints)&&(E.castShadow||E.receiveShadow&&I===_r)&&(!E.frustumCulled||i.intersectsObject(E))){E.modelViewMatrix.multiplyMatrices(_.matrixWorldInverse,E.matrixWorld);let X=e.update(E),Y=E.material;if(Array.isArray(Y)){let N=X.groups;for(let G=0,H=N.length;G<H;G++){let K=N[G],Q=Y[K.materialIndex];if(Q&&Q.visible){let ee=S(E,Q,A,I);E.onBeforeShadow(n,E,R,_,X,ee,K),n.renderBufferDirect(_,null,X,ee,E,K),E.onAfterShadow(n,E,R,_,X,ee,K)}}}else if(Y.visible){let N=S(E,Y,A,I);E.onBeforeShadow(n,E,R,_,X,N,null),n.renderBufferDirect(_,null,X,N,E,null),E.onAfterShadow(n,E,R,_,X,N,null)}}let U=E.children;for(let X=0,Y=U.length;X<Y;X++)v(U[X],R,_,A,I)}function w(E){E.target.removeEventListener("dispose",w);for(let _ in l){let A=l[_],I=E.target.uuid;I in A&&(A[I].dispose(),delete A[I])}}}function Sy(n,e){function t(){let P=!1,ie=new rt,Z=null,le=new rt(0,0,0,0);return{setMask:function(pe){Z!==pe&&!P&&(n.colorMask(pe,pe,pe,pe),Z=pe)},setLocked:function(pe){P=pe},setClear:function(pe,j,ve,ye,lt){lt===!0&&(pe*=ye,j*=ye,ve*=ye),ie.set(pe,j,ve,ye),le.equals(ie)===!1&&(n.clearColor(pe,j,ve,ye),le.copy(ie))},reset:function(){P=!1,Z=null,le.set(-1,0,0,0)}}}function i(){let P=!1,ie=!1,Z=null,le=null,pe=null;return{setReversed:function(j){if(ie!==j){let ve=e.get("EXT_clip_control");j?ve.clipControlEXT(ve.LOWER_LEFT_EXT,ve.ZERO_TO_ONE_EXT):ve.clipControlEXT(ve.LOWER_LEFT_EXT,ve.NEGATIVE_ONE_TO_ONE_EXT),ie=j;let ye=pe;pe=null,this.setClear(ye)}},getReversed:function(){return ie},setTest:function(j){j?te(n.DEPTH_TEST):Pe(n.DEPTH_TEST)},setMask:function(j){Z!==j&&!P&&(n.depthMask(j),Z=j)},setFunc:function(j){if(ie&&(j=Ch[j]),le!==j){switch(j){case co:n.depthFunc(n.NEVER);break;case uo:n.depthFunc(n.ALWAYS);break;case ho:n.depthFunc(n.LESS);break;case Ui:n.depthFunc(n.LEQUAL);break;case fo:n.depthFunc(n.EQUAL);break;case po:n.depthFunc(n.GEQUAL);break;case mo:n.depthFunc(n.GREATER);break;case go:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}le=j}},setLocked:function(j){P=j},setClear:function(j){pe!==j&&(pe=j,ie&&(j=1-j),n.clearDepth(j))},reset:function(){P=!1,Z=null,le=null,pe=null,ie=!1}}}function r(){let P=!1,ie=null,Z=null,le=null,pe=null,j=null,ve=null,ye=null,lt=null;return{setTest:function(tt){P||(tt?te(n.STENCIL_TEST):Pe(n.STENCIL_TEST))},setMask:function(tt){ie!==tt&&!P&&(n.stencilMask(tt),ie=tt)},setFunc:function(tt,bn,Mn){(Z!==tt||le!==bn||pe!==Mn)&&(n.stencilFunc(tt,bn,Mn),Z=tt,le=bn,pe=Mn)},setOp:function(tt,bn,Mn){(j!==tt||ve!==bn||ye!==Mn)&&(n.stencilOp(tt,bn,Mn),j=tt,ve=bn,ye=Mn)},setLocked:function(tt){P=tt},setClear:function(tt){lt!==tt&&(n.clearStencil(tt),lt=tt)},reset:function(){P=!1,ie=null,Z=null,le=null,pe=null,j=null,ve=null,ye=null,lt=null}}}let s=new t,o=new i,a=new r,c=new WeakMap,l=new WeakMap,u={},f={},h={},m=new WeakMap,g=[],x=null,d=!1,p=null,M=null,S=null,v=null,w=null,E=null,R=null,_=new Fe(0,0,0),A=0,I=!1,C=null,U=null,X=null,Y=null,N=null,G=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS),H=!1,K=0,Q=n.getParameter(n.VERSION);Q.indexOf("WebGL")!==-1?(K=parseFloat(/^WebGL (\d)/.exec(Q)[1]),H=K>=1):Q.indexOf("OpenGL ES")!==-1&&(K=parseFloat(/^OpenGL ES (\d)/.exec(Q)[1]),H=K>=2);let ee=null,ce={},xe=n.getParameter(n.SCISSOR_BOX),We=n.getParameter(n.VIEWPORT),ot=new rt().fromArray(xe),Xe=new rt().fromArray(We);function J(P,ie,Z,le){let pe=new Uint8Array(4),j=n.createTexture();n.bindTexture(P,j),n.texParameteri(P,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(P,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let ve=0;ve<Z;ve++)P===n.TEXTURE_3D||P===n.TEXTURE_2D_ARRAY?n.texImage3D(ie,0,n.RGBA,1,1,le,0,n.RGBA,n.UNSIGNED_BYTE,pe):n.texImage2D(ie+ve,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,pe);return j}let re={};re[n.TEXTURE_2D]=J(n.TEXTURE_2D,n.TEXTURE_2D,1),re[n.TEXTURE_CUBE_MAP]=J(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),re[n.TEXTURE_2D_ARRAY]=J(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),re[n.TEXTURE_3D]=J(n.TEXTURE_3D,n.TEXTURE_3D,1,1),s.setClear(0,0,0,1),o.setClear(1),a.setClear(0),te(n.DEPTH_TEST),o.setFunc(Ui),gt(!1),Mt(Wl),te(n.CULL_FACE),qe(In);function te(P){u[P]!==!0&&(n.enable(P),u[P]=!0)}function Pe(P){u[P]!==!1&&(n.disable(P),u[P]=!1)}function Le(P,ie){return h[P]!==ie?(n.bindFramebuffer(P,ie),h[P]=ie,P===n.DRAW_FRAMEBUFFER&&(h[n.FRAMEBUFFER]=ie),P===n.FRAMEBUFFER&&(h[n.DRAW_FRAMEBUFFER]=ie),!0):!1}function Ee(P,ie){let Z=g,le=!1;if(P){Z=m.get(ie),Z===void 0&&(Z=[],m.set(ie,Z));let pe=P.textures;if(Z.length!==pe.length||Z[0]!==n.COLOR_ATTACHMENT0){for(let j=0,ve=pe.length;j<ve;j++)Z[j]=n.COLOR_ATTACHMENT0+j;Z.length=pe.length,le=!0}}else Z[0]!==n.BACK&&(Z[0]=n.BACK,le=!0);le&&n.drawBuffers(Z)}function ft(P){return x!==P?(n.useProgram(P),x=P,!0):!1}let ke={[fi]:n.FUNC_ADD,[ju]:n.FUNC_SUBTRACT,[Qu]:n.FUNC_REVERSE_SUBTRACT};ke[eh]=n.MIN,ke[th]=n.MAX;let je={[nh]:n.ZERO,[ih]:n.ONE,[rh]:n.SRC_COLOR,[ao]:n.SRC_ALPHA,[uh]:n.SRC_ALPHA_SATURATE,[lh]:n.DST_COLOR,[oh]:n.DST_ALPHA,[sh]:n.ONE_MINUS_SRC_COLOR,[lo]:n.ONE_MINUS_SRC_ALPHA,[ch]:n.ONE_MINUS_DST_COLOR,[ah]:n.ONE_MINUS_DST_ALPHA,[hh]:n.CONSTANT_COLOR,[dh]:n.ONE_MINUS_CONSTANT_COLOR,[fh]:n.CONSTANT_ALPHA,[ph]:n.ONE_MINUS_CONSTANT_ALPHA};function qe(P,ie,Z,le,pe,j,ve,ye,lt,tt){if(P===In){d===!0&&(Pe(n.BLEND),d=!1);return}if(d===!1&&(te(n.BLEND),d=!0),P!==Ku){if(P!==p||tt!==I){if((M!==fi||w!==fi)&&(n.blendEquation(n.FUNC_ADD),M=fi,w=fi),tt)switch(P){case Fi:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Xl:n.blendFunc(n.ONE,n.ONE);break;case ql:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case Yl:n.blendFuncSeparate(n.DST_COLOR,n.ONE_MINUS_SRC_ALPHA,n.ZERO,n.ONE);break;default:Re("WebGLState: Invalid blending: ",P);break}else switch(P){case Fi:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Xl:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE,n.ONE,n.ONE);break;case ql:Re("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Yl:Re("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Re("WebGLState: Invalid blending: ",P);break}S=null,v=null,E=null,R=null,_.set(0,0,0),A=0,p=P,I=tt}return}pe=pe||ie,j=j||Z,ve=ve||le,(ie!==M||pe!==w)&&(n.blendEquationSeparate(ke[ie],ke[pe]),M=ie,w=pe),(Z!==S||le!==v||j!==E||ve!==R)&&(n.blendFuncSeparate(je[Z],je[le],je[j],je[ve]),S=Z,v=le,E=j,R=ve),(ye.equals(_)===!1||lt!==A)&&(n.blendColor(ye.r,ye.g,ye.b,lt),_.copy(ye),A=lt),p=P,I=!1}function Ge(P,ie){P.side===Pn?Pe(n.CULL_FACE):te(n.CULL_FACE);let Z=P.side===qt;ie&&(Z=!Z),gt(Z),P.blending===Fi&&P.transparent===!1?qe(In):qe(P.blending,P.blendEquation,P.blendSrc,P.blendDst,P.blendEquationAlpha,P.blendSrcAlpha,P.blendDstAlpha,P.blendColor,P.blendAlpha,P.premultipliedAlpha),o.setFunc(P.depthFunc),o.setTest(P.depthTest),o.setMask(P.depthWrite),s.setMask(P.colorWrite);let le=P.stencilWrite;a.setTest(le),le&&(a.setMask(P.stencilWriteMask),a.setFunc(P.stencilFunc,P.stencilRef,P.stencilFuncMask),a.setOp(P.stencilFail,P.stencilZFail,P.stencilZPass)),Lt(P.polygonOffset,P.polygonOffsetFactor,P.polygonOffsetUnits),P.alphaToCoverage===!0?te(n.SAMPLE_ALPHA_TO_COVERAGE):Pe(n.SAMPLE_ALPHA_TO_COVERAGE)}function gt(P){C!==P&&(P?n.frontFace(n.CW):n.frontFace(n.CCW),C=P)}function Mt(P){P!==Zu?(te(n.CULL_FACE),P!==U&&(P===Wl?n.cullFace(n.BACK):P===$u?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):Pe(n.CULL_FACE),U=P}function At(P){P!==X&&(H&&n.lineWidth(P),X=P)}function Lt(P,ie,Z){P?(te(n.POLYGON_OFFSET_FILL),(Y!==ie||N!==Z)&&(Y=ie,N=Z,o.getReversed()&&(ie=-ie),n.polygonOffset(ie,Z))):Pe(n.POLYGON_OFFSET_FILL)}function at(P){P?te(n.SCISSOR_TEST):Pe(n.SCISSOR_TEST)}function xt(P){P===void 0&&(P=n.TEXTURE0+G-1),ee!==P&&(n.activeTexture(P),ee=P)}function L(P,ie,Z){Z===void 0&&(ee===null?Z=n.TEXTURE0+G-1:Z=ee);let le=ce[Z];le===void 0&&(le={type:void 0,texture:void 0},ce[Z]=le),(le.type!==P||le.texture!==ie)&&(ee!==Z&&(n.activeTexture(Z),ee=Z),n.bindTexture(P,ie||re[P]),le.type=P,le.texture=ie)}function Zt(){let P=ce[ee];P!==void 0&&P.type!==void 0&&(n.bindTexture(P.type,null),P.type=void 0,P.texture=void 0)}function $e(){try{n.compressedTexImage2D(...arguments)}catch(P){Re("WebGLState:",P)}}function T(){try{n.compressedTexImage3D(...arguments)}catch(P){Re("WebGLState:",P)}}function y(){try{n.texSubImage2D(...arguments)}catch(P){Re("WebGLState:",P)}}function F(){try{n.texSubImage3D(...arguments)}catch(P){Re("WebGLState:",P)}}function z(){try{n.compressedTexSubImage2D(...arguments)}catch(P){Re("WebGLState:",P)}}function W(){try{n.compressedTexSubImage3D(...arguments)}catch(P){Re("WebGLState:",P)}}function ne(){try{n.texStorage2D(...arguments)}catch(P){Re("WebGLState:",P)}}function se(){try{n.texStorage3D(...arguments)}catch(P){Re("WebGLState:",P)}}function q(){try{n.texImage2D(...arguments)}catch(P){Re("WebGLState:",P)}}function $(){try{n.texImage3D(...arguments)}catch(P){Re("WebGLState:",P)}}function oe(P){return f[P]!==void 0?f[P]:n.getParameter(P)}function be(P,ie){f[P]!==ie&&(n.pixelStorei(P,ie),f[P]=ie)}function ue(P){ot.equals(P)===!1&&(n.scissor(P.x,P.y,P.z,P.w),ot.copy(P))}function ae(P){Xe.equals(P)===!1&&(n.viewport(P.x,P.y,P.z,P.w),Xe.copy(P))}function we(P,ie){let Z=l.get(ie);Z===void 0&&(Z=new WeakMap,l.set(ie,Z));let le=Z.get(P);le===void 0&&(le=n.getUniformBlockIndex(ie,P.name),Z.set(P,le))}function Te(P,ie){let le=l.get(ie).get(P);c.get(ie)!==le&&(n.uniformBlockBinding(ie,le,P.__bindingPointIndex),c.set(ie,le))}function De(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),o.setReversed(!1),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),n.pixelStorei(n.PACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,n.BROWSER_DEFAULT_WEBGL),n.pixelStorei(n.PACK_ROW_LENGTH,0),n.pixelStorei(n.PACK_SKIP_PIXELS,0),n.pixelStorei(n.PACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_ROW_LENGTH,0),n.pixelStorei(n.UNPACK_IMAGE_HEIGHT,0),n.pixelStorei(n.UNPACK_SKIP_PIXELS,0),n.pixelStorei(n.UNPACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_SKIP_IMAGES,0),u={},f={},ee=null,ce={},h={},m=new WeakMap,g=[],x=null,d=!1,p=null,M=null,S=null,v=null,w=null,E=null,R=null,_=new Fe(0,0,0),A=0,I=!1,C=null,U=null,X=null,Y=null,N=null,ot.set(0,0,n.canvas.width,n.canvas.height),Xe.set(0,0,n.canvas.width,n.canvas.height),s.reset(),o.reset(),a.reset()}return{buffers:{color:s,depth:o,stencil:a},enable:te,disable:Pe,bindFramebuffer:Le,drawBuffers:Ee,useProgram:ft,setBlending:qe,setMaterial:Ge,setFlipSided:gt,setCullFace:Mt,setLineWidth:At,setPolygonOffset:Lt,setScissorTest:at,activeTexture:xt,bindTexture:L,unbindTexture:Zt,compressedTexImage2D:$e,compressedTexImage3D:T,texImage2D:q,texImage3D:$,pixelStorei:be,getParameter:oe,updateUBOMapping:we,uniformBlockBinding:Te,texStorage2D:ne,texStorage3D:se,texSubImage2D:y,texSubImage3D:F,compressedTexSubImage2D:z,compressedTexSubImage3D:W,scissor:ue,viewport:ae,reset:De}}function wy(n,e,t,i,r,s,o){let a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),l=new Be,u=new WeakMap,f=new Set,h,m=new WeakMap,g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function x(T,y){return g?new OffscreenCanvas(T,y):Wr("canvas")}function d(T,y,F){let z=1,W=$e(T);if((W.width>F||W.height>F)&&(z=F/Math.max(W.width,W.height)),z<1)if(typeof HTMLImageElement<"u"&&T instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&T instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&T instanceof ImageBitmap||typeof VideoFrame<"u"&&T instanceof VideoFrame){let ne=Math.floor(z*W.width),se=Math.floor(z*W.height);h===void 0&&(h=x(ne,se));let q=y?x(ne,se):h;return q.width=ne,q.height=se,q.getContext("2d").drawImage(T,0,0,ne,se),Ae("WebGLRenderer: Texture has been resized from ("+W.width+"x"+W.height+") to ("+ne+"x"+se+")."),q}else return"data"in T&&Ae("WebGLRenderer: Image in DataTexture is too big ("+W.width+"x"+W.height+")."),T;return T}function p(T){return T.generateMipmaps}function M(T){n.generateMipmap(T)}function S(T){return T.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:T.isWebGL3DRenderTarget?n.TEXTURE_3D:T.isWebGLArrayRenderTarget||T.isCompressedArrayTexture?n.TEXTURE_2D_ARRAY:n.TEXTURE_2D}function v(T,y,F,z,W,ne=!1){if(T!==null){if(n[T]!==void 0)return n[T];Ae("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+T+"'")}let se;z&&(se=e.get("EXT_texture_norm16"),se||Ae("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let q=y;if(y===n.RED&&(F===n.FLOAT&&(q=n.R32F),F===n.HALF_FLOAT&&(q=n.R16F),F===n.UNSIGNED_BYTE&&(q=n.R8),F===n.UNSIGNED_SHORT&&se&&(q=se.R16_EXT),F===n.SHORT&&se&&(q=se.R16_SNORM_EXT)),y===n.RED_INTEGER&&(F===n.UNSIGNED_BYTE&&(q=n.R8UI),F===n.UNSIGNED_SHORT&&(q=n.R16UI),F===n.UNSIGNED_INT&&(q=n.R32UI),F===n.BYTE&&(q=n.R8I),F===n.SHORT&&(q=n.R16I),F===n.INT&&(q=n.R32I)),y===n.RG&&(F===n.FLOAT&&(q=n.RG32F),F===n.HALF_FLOAT&&(q=n.RG16F),F===n.UNSIGNED_BYTE&&(q=n.RG8),F===n.UNSIGNED_SHORT&&se&&(q=se.RG16_EXT),F===n.SHORT&&se&&(q=se.RG16_SNORM_EXT)),y===n.RG_INTEGER&&(F===n.UNSIGNED_BYTE&&(q=n.RG8UI),F===n.UNSIGNED_SHORT&&(q=n.RG16UI),F===n.UNSIGNED_INT&&(q=n.RG32UI),F===n.BYTE&&(q=n.RG8I),F===n.SHORT&&(q=n.RG16I),F===n.INT&&(q=n.RG32I)),y===n.RGB_INTEGER&&(F===n.UNSIGNED_BYTE&&(q=n.RGB8UI),F===n.UNSIGNED_SHORT&&(q=n.RGB16UI),F===n.UNSIGNED_INT&&(q=n.RGB32UI),F===n.BYTE&&(q=n.RGB8I),F===n.SHORT&&(q=n.RGB16I),F===n.INT&&(q=n.RGB32I)),y===n.RGBA_INTEGER&&(F===n.UNSIGNED_BYTE&&(q=n.RGBA8UI),F===n.UNSIGNED_SHORT&&(q=n.RGBA16UI),F===n.UNSIGNED_INT&&(q=n.RGBA32UI),F===n.BYTE&&(q=n.RGBA8I),F===n.SHORT&&(q=n.RGBA16I),F===n.INT&&(q=n.RGBA32I)),y===n.RGB&&(F===n.UNSIGNED_SHORT&&se&&(q=se.RGB16_EXT),F===n.SHORT&&se&&(q=se.RGB16_SNORM_EXT),F===n.UNSIGNED_INT_5_9_9_9_REV&&(q=n.RGB9_E5),F===n.UNSIGNED_INT_10F_11F_11F_REV&&(q=n.R11F_G11F_B10F)),y===n.RGBA){let $=ne?Hr:ze.getTransfer(W);F===n.FLOAT&&(q=n.RGBA32F),F===n.HALF_FLOAT&&(q=n.RGBA16F),F===n.UNSIGNED_BYTE&&(q=$===Ye?n.SRGB8_ALPHA8:n.RGBA8),F===n.UNSIGNED_SHORT&&se&&(q=se.RGBA16_EXT),F===n.SHORT&&se&&(q=se.RGBA16_SNORM_EXT),F===n.UNSIGNED_SHORT_4_4_4_4&&(q=n.RGBA4),F===n.UNSIGNED_SHORT_5_5_5_1&&(q=n.RGB5_A1)}return(q===n.R16F||q===n.R32F||q===n.RG16F||q===n.RG32F||q===n.RGBA16F||q===n.RGBA32F)&&e.get("EXT_color_buffer_float"),q}function w(T,y){let F;return T?y===null||y===yn||y===br?F=n.DEPTH24_STENCIL8:y===_n?F=n.DEPTH32F_STENCIL8:y===vr&&(F=n.DEPTH24_STENCIL8,Ae("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):y===null||y===yn||y===br?F=n.DEPTH_COMPONENT24:y===_n?F=n.DEPTH_COMPONENT32F:y===vr&&(F=n.DEPTH_COMPONENT16),F}function E(T,y){return p(T)===!0||T.isFramebufferTexture&&T.minFilter!==Ct&&T.minFilter!==Nt?Math.log2(Math.max(y.width,y.height))+1:T.mipmaps!==void 0&&T.mipmaps.length>0?T.mipmaps.length:T.isCompressedTexture&&Array.isArray(T.image)?y.mipmaps.length:1}function R(T){let y=T.target;y.removeEventListener("dispose",R),A(y),y.isVideoTexture&&u.delete(y),y.isHTMLTexture&&f.delete(y)}function _(T){let y=T.target;y.removeEventListener("dispose",_),C(y)}function A(T){let y=i.get(T);if(y.__webglInit===void 0)return;let F=T.source,z=m.get(F);if(z){let W=z[y.__cacheKey];W.usedTimes--,W.usedTimes===0&&I(T),Object.keys(z).length===0&&m.delete(F)}i.remove(T)}function I(T){let y=i.get(T);n.deleteTexture(y.__webglTexture);let F=T.source,z=m.get(F);delete z[y.__cacheKey],o.memory.textures--}function C(T){let y=i.get(T);if(T.depthTexture&&(T.depthTexture.dispose(),i.remove(T.depthTexture)),T.isWebGLCubeRenderTarget)for(let z=0;z<6;z++){if(Array.isArray(y.__webglFramebuffer[z]))for(let W=0;W<y.__webglFramebuffer[z].length;W++)n.deleteFramebuffer(y.__webglFramebuffer[z][W]);else n.deleteFramebuffer(y.__webglFramebuffer[z]);y.__webglDepthbuffer&&n.deleteRenderbuffer(y.__webglDepthbuffer[z])}else{if(Array.isArray(y.__webglFramebuffer))for(let z=0;z<y.__webglFramebuffer.length;z++)n.deleteFramebuffer(y.__webglFramebuffer[z]);else n.deleteFramebuffer(y.__webglFramebuffer);if(y.__webglDepthbuffer&&n.deleteRenderbuffer(y.__webglDepthbuffer),y.__webglMultisampledFramebuffer&&n.deleteFramebuffer(y.__webglMultisampledFramebuffer),y.__webglColorRenderbuffer)for(let z=0;z<y.__webglColorRenderbuffer.length;z++)y.__webglColorRenderbuffer[z]&&n.deleteRenderbuffer(y.__webglColorRenderbuffer[z]);y.__webglDepthRenderbuffer&&n.deleteRenderbuffer(y.__webglDepthRenderbuffer)}let F=T.textures;for(let z=0,W=F.length;z<W;z++){let ne=i.get(F[z]);ne.__webglTexture&&(n.deleteTexture(ne.__webglTexture),o.memory.textures--),i.remove(F[z])}i.remove(T)}let U=0;function X(){U=0}function Y(){return U}function N(T){U=T}function G(){let T=U;return T>=r.maxTextures&&Ae("WebGLTextures: Trying to use "+T+" texture units while this GPU supports only "+r.maxTextures),U+=1,T}function H(T){let y=[];return y.push(T.wrapS),y.push(T.wrapT),y.push(T.wrapR||0),y.push(T.magFilter),y.push(T.minFilter),y.push(T.anisotropy),y.push(T.internalFormat),y.push(T.format),y.push(T.type),y.push(T.generateMipmaps),y.push(T.premultiplyAlpha),y.push(T.flipY),y.push(T.unpackAlignment),y.push(T.colorSpace),y.join()}function K(T,y){let F=i.get(T);if(T.isVideoTexture&&L(T),T.isRenderTargetTexture===!1&&T.isExternalTexture!==!0&&T.version>0&&F.__version!==T.version){let z=T.image;if(z===null)Ae("WebGLRenderer: Texture marked for update but no image data found.");else if(z.complete===!1)Ae("WebGLRenderer: Texture marked for update but image is incomplete");else{Pe(F,T,y);return}}else T.isExternalTexture&&(F.__webglTexture=T.sourceTexture?T.sourceTexture:null);t.bindTexture(n.TEXTURE_2D,F.__webglTexture,n.TEXTURE0+y)}function Q(T,y){let F=i.get(T);if(T.isRenderTargetTexture===!1&&T.version>0&&F.__version!==T.version){Pe(F,T,y);return}else T.isExternalTexture&&(F.__webglTexture=T.sourceTexture?T.sourceTexture:null);t.bindTexture(n.TEXTURE_2D_ARRAY,F.__webglTexture,n.TEXTURE0+y)}function ee(T,y){let F=i.get(T);if(T.isRenderTargetTexture===!1&&T.version>0&&F.__version!==T.version){Pe(F,T,y);return}t.bindTexture(n.TEXTURE_3D,F.__webglTexture,n.TEXTURE0+y)}function ce(T,y){let F=i.get(T);if(T.isCubeDepthTexture!==!0&&T.version>0&&F.__version!==T.version){Le(F,T,y);return}t.bindTexture(n.TEXTURE_CUBE_MAP,F.__webglTexture,n.TEXTURE0+y)}let xe={[xo]:n.REPEAT,[Tn]:n.CLAMP_TO_EDGE,[yo]:n.MIRRORED_REPEAT},We={[Ct]:n.NEAREST,[xh]:n.NEAREST_MIPMAP_NEAREST,[ss]:n.NEAREST_MIPMAP_LINEAR,[Nt]:n.LINEAR,[Xo]:n.LINEAR_MIPMAP_NEAREST,[Ln]:n.LINEAR_MIPMAP_LINEAR},ot={[vh]:n.NEVER,[Eh]:n.ALWAYS,[bh]:n.LESS,[Ca]:n.LEQUAL,[Mh]:n.EQUAL,[Pa]:n.GEQUAL,[Sh]:n.GREATER,[wh]:n.NOTEQUAL};function Xe(T,y){if(y.type===_n&&e.has("OES_texture_float_linear")===!1&&(y.magFilter===Nt||y.magFilter===Xo||y.magFilter===ss||y.magFilter===Ln||y.minFilter===Nt||y.minFilter===Xo||y.minFilter===ss||y.minFilter===Ln)&&Ae("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(T,n.TEXTURE_WRAP_S,xe[y.wrapS]),n.texParameteri(T,n.TEXTURE_WRAP_T,xe[y.wrapT]),(T===n.TEXTURE_3D||T===n.TEXTURE_2D_ARRAY)&&n.texParameteri(T,n.TEXTURE_WRAP_R,xe[y.wrapR]),n.texParameteri(T,n.TEXTURE_MAG_FILTER,We[y.magFilter]),n.texParameteri(T,n.TEXTURE_MIN_FILTER,We[y.minFilter]),y.compareFunction&&(n.texParameteri(T,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(T,n.TEXTURE_COMPARE_FUNC,ot[y.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(y.magFilter===Ct||y.minFilter!==ss&&y.minFilter!==Ln||y.type===_n&&e.has("OES_texture_float_linear")===!1)return;if(y.anisotropy>1||i.get(y).__currentAnisotropy){let F=e.get("EXT_texture_filter_anisotropic");n.texParameterf(T,F.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(y.anisotropy,r.getMaxAnisotropy())),i.get(y).__currentAnisotropy=y.anisotropy}}}function J(T,y){let F=!1;T.__webglInit===void 0&&(T.__webglInit=!0,y.addEventListener("dispose",R));let z=y.source,W=m.get(z);W===void 0&&(W={},m.set(z,W));let ne=H(y);if(ne!==T.__cacheKey){W[ne]===void 0&&(W[ne]={texture:n.createTexture(),usedTimes:0},o.memory.textures++,F=!0),W[ne].usedTimes++;let se=W[T.__cacheKey];se!==void 0&&(W[T.__cacheKey].usedTimes--,se.usedTimes===0&&I(y)),T.__cacheKey=ne,T.__webglTexture=W[ne].texture}return F}function re(T,y,F){return Math.floor(Math.floor(T/F)/y)}function te(T,y,F,z){let ne=T.updateRanges;if(ne.length===0)t.texSubImage2D(n.TEXTURE_2D,0,0,0,y.width,y.height,F,z,y.data);else{ne.sort((be,ue)=>be.start-ue.start);let se=0;for(let be=1;be<ne.length;be++){let ue=ne[se],ae=ne[be],we=ue.start+ue.count,Te=re(ae.start,y.width,4),De=re(ue.start,y.width,4);ae.start<=we+1&&Te===De&&re(ae.start+ae.count-1,y.width,4)===Te?ue.count=Math.max(ue.count,ae.start+ae.count-ue.start):(++se,ne[se]=ae)}ne.length=se+1;let q=t.getParameter(n.UNPACK_ROW_LENGTH),$=t.getParameter(n.UNPACK_SKIP_PIXELS),oe=t.getParameter(n.UNPACK_SKIP_ROWS);t.pixelStorei(n.UNPACK_ROW_LENGTH,y.width);for(let be=0,ue=ne.length;be<ue;be++){let ae=ne[be],we=Math.floor(ae.start/4),Te=Math.ceil(ae.count/4),De=we%y.width,P=Math.floor(we/y.width),ie=Te,Z=1;t.pixelStorei(n.UNPACK_SKIP_PIXELS,De),t.pixelStorei(n.UNPACK_SKIP_ROWS,P),t.texSubImage2D(n.TEXTURE_2D,0,De,P,ie,Z,F,z,y.data)}T.clearUpdateRanges(),t.pixelStorei(n.UNPACK_ROW_LENGTH,q),t.pixelStorei(n.UNPACK_SKIP_PIXELS,$),t.pixelStorei(n.UNPACK_SKIP_ROWS,oe)}}function Pe(T,y,F){let z=n.TEXTURE_2D;(y.isDataArrayTexture||y.isCompressedArrayTexture)&&(z=n.TEXTURE_2D_ARRAY),y.isData3DTexture&&(z=n.TEXTURE_3D);let W=J(T,y),ne=y.source;t.bindTexture(z,T.__webglTexture,n.TEXTURE0+F);let se=i.get(ne);if(ne.version!==se.__version||W===!0){if(t.activeTexture(n.TEXTURE0+F),(typeof ImageBitmap<"u"&&y.image instanceof ImageBitmap)===!1){let Z=ze.getPrimaries(ze.workingColorSpace),le=y.colorSpace===Jn?null:ze.getPrimaries(y.colorSpace),pe=y.colorSpace===Jn||Z===le?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,y.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,y.premultiplyAlpha),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,pe)}t.pixelStorei(n.UNPACK_ALIGNMENT,y.unpackAlignment);let $=d(y.image,!1,r.maxTextureSize);$=Zt(y,$);let oe=s.convert(y.format,y.colorSpace),be=s.convert(y.type),ue=v(y.internalFormat,oe,be,y.normalized,y.colorSpace,y.isVideoTexture);Xe(z,y);let ae,we=y.mipmaps,Te=y.isVideoTexture!==!0,De=se.__version===void 0||W===!0,P=ne.dataReady,ie=E(y,$);if(y.isDepthTexture)ue=w(y.format===vi,y.type),De&&(Te?t.texStorage2D(n.TEXTURE_2D,1,ue,$.width,$.height):t.texImage2D(n.TEXTURE_2D,0,ue,$.width,$.height,0,oe,be,null));else if(y.isDataTexture)if(we.length>0){Te&&De&&t.texStorage2D(n.TEXTURE_2D,ie,ue,we[0].width,we[0].height);for(let Z=0,le=we.length;Z<le;Z++)ae=we[Z],Te?P&&t.texSubImage2D(n.TEXTURE_2D,Z,0,0,ae.width,ae.height,oe,be,ae.data):t.texImage2D(n.TEXTURE_2D,Z,ue,ae.width,ae.height,0,oe,be,ae.data);y.generateMipmaps=!1}else Te?(De&&t.texStorage2D(n.TEXTURE_2D,ie,ue,$.width,$.height),P&&te(y,$,oe,be)):t.texImage2D(n.TEXTURE_2D,0,ue,$.width,$.height,0,oe,be,$.data);else if(y.isCompressedTexture)if(y.isCompressedArrayTexture){Te&&De&&t.texStorage3D(n.TEXTURE_2D_ARRAY,ie,ue,we[0].width,we[0].height,$.depth);for(let Z=0,le=we.length;Z<le;Z++)if(ae=we[Z],y.format!==cn)if(oe!==null)if(Te){if(P)if(y.layerUpdates.size>0){let pe=pc(ae.width,ae.height,y.format,y.type);for(let j of y.layerUpdates){let ve=ae.data.subarray(j*pe/ae.data.BYTES_PER_ELEMENT,(j+1)*pe/ae.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,Z,0,0,j,ae.width,ae.height,1,oe,ve)}y.clearLayerUpdates()}else t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,Z,0,0,0,ae.width,ae.height,$.depth,oe,ae.data)}else t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,Z,ue,ae.width,ae.height,$.depth,0,ae.data,0,0);else Ae("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Te?P&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,Z,0,0,0,ae.width,ae.height,$.depth,oe,be,ae.data):t.texImage3D(n.TEXTURE_2D_ARRAY,Z,ue,ae.width,ae.height,$.depth,0,oe,be,ae.data)}else{Te&&De&&t.texStorage2D(n.TEXTURE_2D,ie,ue,we[0].width,we[0].height);for(let Z=0,le=we.length;Z<le;Z++)ae=we[Z],y.format!==cn?oe!==null?Te?P&&t.compressedTexSubImage2D(n.TEXTURE_2D,Z,0,0,ae.width,ae.height,oe,ae.data):t.compressedTexImage2D(n.TEXTURE_2D,Z,ue,ae.width,ae.height,0,ae.data):Ae("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Te?P&&t.texSubImage2D(n.TEXTURE_2D,Z,0,0,ae.width,ae.height,oe,be,ae.data):t.texImage2D(n.TEXTURE_2D,Z,ue,ae.width,ae.height,0,oe,be,ae.data)}else if(y.isDataArrayTexture)if(Te){if(De&&t.texStorage3D(n.TEXTURE_2D_ARRAY,ie,ue,$.width,$.height,$.depth),P)if(y.layerUpdates.size>0){let Z=pc($.width,$.height,y.format,y.type);for(let le of y.layerUpdates){let pe=$.data.subarray(le*Z/$.data.BYTES_PER_ELEMENT,(le+1)*Z/$.data.BYTES_PER_ELEMENT);t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,le,$.width,$.height,1,oe,be,pe)}y.clearLayerUpdates()}else t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,$.width,$.height,$.depth,oe,be,$.data)}else t.texImage3D(n.TEXTURE_2D_ARRAY,0,ue,$.width,$.height,$.depth,0,oe,be,$.data);else if(y.isData3DTexture)Te?(De&&t.texStorage3D(n.TEXTURE_3D,ie,ue,$.width,$.height,$.depth),P&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,$.width,$.height,$.depth,oe,be,$.data)):t.texImage3D(n.TEXTURE_3D,0,ue,$.width,$.height,$.depth,0,oe,be,$.data);else if(y.isFramebufferTexture){if(De)if(Te)t.texStorage2D(n.TEXTURE_2D,ie,ue,$.width,$.height);else{let Z=$.width,le=$.height;for(let pe=0;pe<ie;pe++)t.texImage2D(n.TEXTURE_2D,pe,ue,Z,le,0,oe,be,null),Z>>=1,le>>=1}}else if(y.isHTMLTexture){if("texElementImage2D"in n){let Z=n.canvas;if(Z.hasAttribute("layoutsubtree")||Z.setAttribute("layoutsubtree","true"),$.parentNode!==Z){Z.appendChild($),f.add(y),Z.onpaint=le=>{let pe=le.changedElements;for(let j of f)pe.includes(j.image)&&(j.needsUpdate=!0)},Z.requestPaint();return}if(n.texElementImage2D.length===3)n.texElementImage2D(n.TEXTURE_2D,n.RGBA8,$);else{let pe=n.RGBA,j=n.RGBA,ve=n.UNSIGNED_BYTE;n.texElementImage2D(n.TEXTURE_2D,0,pe,j,ve,$)}n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE)}}else if(we.length>0){if(Te&&De){let Z=$e(we[0]);t.texStorage2D(n.TEXTURE_2D,ie,ue,Z.width,Z.height)}for(let Z=0,le=we.length;Z<le;Z++)ae=we[Z],Te?P&&t.texSubImage2D(n.TEXTURE_2D,Z,0,0,oe,be,ae):t.texImage2D(n.TEXTURE_2D,Z,ue,oe,be,ae);y.generateMipmaps=!1}else if(Te){if(De){let Z=$e($);t.texStorage2D(n.TEXTURE_2D,ie,ue,Z.width,Z.height)}P&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,oe,be,$)}else t.texImage2D(n.TEXTURE_2D,0,ue,oe,be,$);p(y)&&M(z),se.__version=ne.version,y.onUpdate&&y.onUpdate(y)}T.__version=y.version}function Le(T,y,F){if(y.image.length!==6)return;let z=J(T,y),W=y.source;t.bindTexture(n.TEXTURE_CUBE_MAP,T.__webglTexture,n.TEXTURE0+F);let ne=i.get(W);if(W.version!==ne.__version||z===!0){t.activeTexture(n.TEXTURE0+F);let se=ze.getPrimaries(ze.workingColorSpace),q=y.colorSpace===Jn?null:ze.getPrimaries(y.colorSpace),$=y.colorSpace===Jn||se===q?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,y.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,y.premultiplyAlpha),t.pixelStorei(n.UNPACK_ALIGNMENT,y.unpackAlignment),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,$);let oe=y.isCompressedTexture||y.image[0].isCompressedTexture,be=y.image[0]&&y.image[0].isDataTexture,ue=[];for(let j=0;j<6;j++)!oe&&!be?ue[j]=d(y.image[j],!0,r.maxCubemapSize):ue[j]=be?y.image[j].image:y.image[j],ue[j]=Zt(y,ue[j]);let ae=ue[0],we=s.convert(y.format,y.colorSpace),Te=s.convert(y.type),De=v(y.internalFormat,we,Te,y.normalized,y.colorSpace),P=y.isVideoTexture!==!0,ie=ne.__version===void 0||z===!0,Z=W.dataReady,le=E(y,ae);Xe(n.TEXTURE_CUBE_MAP,y);let pe;if(oe){P&&ie&&t.texStorage2D(n.TEXTURE_CUBE_MAP,le,De,ae.width,ae.height);for(let j=0;j<6;j++){pe=ue[j].mipmaps;for(let ve=0;ve<pe.length;ve++){let ye=pe[ve];y.format!==cn?we!==null?P?Z&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ve,0,0,ye.width,ye.height,we,ye.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ve,De,ye.width,ye.height,0,ye.data):Ae("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):P?Z&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ve,0,0,ye.width,ye.height,we,Te,ye.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ve,De,ye.width,ye.height,0,we,Te,ye.data)}}}else{if(pe=y.mipmaps,P&&ie){pe.length>0&&le++;let j=$e(ue[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,le,De,j.width,j.height)}for(let j=0;j<6;j++)if(be){P?Z&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,ue[j].width,ue[j].height,we,Te,ue[j].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,De,ue[j].width,ue[j].height,0,we,Te,ue[j].data);for(let ve=0;ve<pe.length;ve++){let lt=pe[ve].image[j].image;P?Z&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ve+1,0,0,lt.width,lt.height,we,Te,lt.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ve+1,De,lt.width,lt.height,0,we,Te,lt.data)}}else{P?Z&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,we,Te,ue[j]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,De,we,Te,ue[j]);for(let ve=0;ve<pe.length;ve++){let ye=pe[ve];P?Z&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ve+1,0,0,we,Te,ye.image[j]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ve+1,De,we,Te,ye.image[j])}}}p(y)&&M(n.TEXTURE_CUBE_MAP),ne.__version=W.version,y.onUpdate&&y.onUpdate(y)}T.__version=y.version}function Ee(T,y,F,z,W,ne){let se=s.convert(F.format,F.colorSpace),q=s.convert(F.type),$=v(F.internalFormat,se,q,F.normalized,F.colorSpace),oe=i.get(y),be=i.get(F);if(be.__renderTarget=y,!oe.__hasExternalTextures){let ue=Math.max(1,y.width>>ne),ae=Math.max(1,y.height>>ne);W===n.TEXTURE_3D||W===n.TEXTURE_2D_ARRAY?t.texImage3D(W,ne,$,ue,ae,y.depth,0,se,q,null):t.texImage2D(W,ne,$,ue,ae,0,se,q,null)}t.bindFramebuffer(n.FRAMEBUFFER,T),xt(y)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,z,W,be.__webglTexture,0,at(y)):(W===n.TEXTURE_2D||W>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&W<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,z,W,be.__webglTexture,ne),t.bindFramebuffer(n.FRAMEBUFFER,null)}function ft(T,y,F){if(n.bindRenderbuffer(n.RENDERBUFFER,T),y.depthBuffer){let z=y.depthTexture,W=z&&z.isDepthTexture?z.type:null,ne=w(y.stencilBuffer,W),se=y.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;xt(y)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,at(y),ne,y.width,y.height):F?n.renderbufferStorageMultisample(n.RENDERBUFFER,at(y),ne,y.width,y.height):n.renderbufferStorage(n.RENDERBUFFER,ne,y.width,y.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,se,n.RENDERBUFFER,T)}else{let z=y.textures;for(let W=0;W<z.length;W++){let ne=z[W],se=s.convert(ne.format,ne.colorSpace),q=s.convert(ne.type),$=v(ne.internalFormat,se,q,ne.normalized,ne.colorSpace);xt(y)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,at(y),$,y.width,y.height):F?n.renderbufferStorageMultisample(n.RENDERBUFFER,at(y),$,y.width,y.height):n.renderbufferStorage(n.RENDERBUFFER,$,y.width,y.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function ke(T,y,F){let z=y.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(n.FRAMEBUFFER,T),!(y.depthTexture&&y.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let W=i.get(y.depthTexture);if(W.__renderTarget=y,(!W.__webglTexture||y.depthTexture.image.width!==y.width||y.depthTexture.image.height!==y.height)&&(y.depthTexture.image.width=y.width,y.depthTexture.image.height=y.height,y.depthTexture.needsUpdate=!0),z){if(W.__webglInit===void 0&&(W.__webglInit=!0,y.depthTexture.addEventListener("dispose",R)),W.__webglTexture===void 0){W.__webglTexture=n.createTexture(),t.bindTexture(n.TEXTURE_CUBE_MAP,W.__webglTexture),Xe(n.TEXTURE_CUBE_MAP,y.depthTexture);let oe=s.convert(y.depthTexture.format),be=s.convert(y.depthTexture.type),ue;y.depthTexture.format===An?ue=n.DEPTH_COMPONENT24:y.depthTexture.format===vi&&(ue=n.DEPTH24_STENCIL8);for(let ae=0;ae<6;ae++)n.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ae,0,ue,y.width,y.height,0,oe,be,null)}}else K(y.depthTexture,0);let ne=W.__webglTexture,se=at(y),q=z?n.TEXTURE_CUBE_MAP_POSITIVE_X+F:n.TEXTURE_2D,$=y.depthTexture.format===vi?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;if(y.depthTexture.format===An)xt(y)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,$,q,ne,0,se):n.framebufferTexture2D(n.FRAMEBUFFER,$,q,ne,0);else if(y.depthTexture.format===vi)xt(y)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,$,q,ne,0,se):n.framebufferTexture2D(n.FRAMEBUFFER,$,q,ne,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function je(T){let y=i.get(T),F=T.isWebGLCubeRenderTarget===!0;if(y.__boundDepthTexture!==T.depthTexture){let z=T.depthTexture;if(y.__depthDisposeCallback&&y.__depthDisposeCallback(),z){let W=()=>{delete y.__boundDepthTexture,delete y.__depthDisposeCallback,z.removeEventListener("dispose",W)};z.addEventListener("dispose",W),y.__depthDisposeCallback=W}y.__boundDepthTexture=z}if(T.depthTexture&&!y.__autoAllocateDepthBuffer)if(F)for(let z=0;z<6;z++)ke(y.__webglFramebuffer[z],T,z);else{let z=T.texture.mipmaps;z&&z.length>0?ke(y.__webglFramebuffer[0],T,0):ke(y.__webglFramebuffer,T,0)}else if(F){y.__webglDepthbuffer=[];for(let z=0;z<6;z++)if(t.bindFramebuffer(n.FRAMEBUFFER,y.__webglFramebuffer[z]),y.__webglDepthbuffer[z]===void 0)y.__webglDepthbuffer[z]=n.createRenderbuffer(),ft(y.__webglDepthbuffer[z],T,!1);else{let W=T.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ne=y.__webglDepthbuffer[z];n.bindRenderbuffer(n.RENDERBUFFER,ne),n.framebufferRenderbuffer(n.FRAMEBUFFER,W,n.RENDERBUFFER,ne)}}else{let z=T.texture.mipmaps;if(z&&z.length>0?t.bindFramebuffer(n.FRAMEBUFFER,y.__webglFramebuffer[0]):t.bindFramebuffer(n.FRAMEBUFFER,y.__webglFramebuffer),y.__webglDepthbuffer===void 0)y.__webglDepthbuffer=n.createRenderbuffer(),ft(y.__webglDepthbuffer,T,!1);else{let W=T.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ne=y.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,ne),n.framebufferRenderbuffer(n.FRAMEBUFFER,W,n.RENDERBUFFER,ne)}}t.bindFramebuffer(n.FRAMEBUFFER,null)}function qe(T,y,F){let z=i.get(T);y!==void 0&&Ee(z.__webglFramebuffer,T,T.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),F!==void 0&&je(T)}function Ge(T){let y=T.texture,F=i.get(T),z=i.get(y);T.addEventListener("dispose",_);let W=T.textures,ne=T.isWebGLCubeRenderTarget===!0,se=W.length>1;if(se||(z.__webglTexture===void 0&&(z.__webglTexture=n.createTexture()),z.__version=y.version,o.memory.textures++),ne){F.__webglFramebuffer=[];for(let q=0;q<6;q++)if(y.mipmaps&&y.mipmaps.length>0){F.__webglFramebuffer[q]=[];for(let $=0;$<y.mipmaps.length;$++)F.__webglFramebuffer[q][$]=n.createFramebuffer()}else F.__webglFramebuffer[q]=n.createFramebuffer()}else{if(y.mipmaps&&y.mipmaps.length>0){F.__webglFramebuffer=[];for(let q=0;q<y.mipmaps.length;q++)F.__webglFramebuffer[q]=n.createFramebuffer()}else F.__webglFramebuffer=n.createFramebuffer();if(se)for(let q=0,$=W.length;q<$;q++){let oe=i.get(W[q]);oe.__webglTexture===void 0&&(oe.__webglTexture=n.createTexture(),o.memory.textures++)}if(T.samples>0&&xt(T)===!1){F.__webglMultisampledFramebuffer=n.createFramebuffer(),F.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,F.__webglMultisampledFramebuffer);for(let q=0;q<W.length;q++){let $=W[q];F.__webglColorRenderbuffer[q]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,F.__webglColorRenderbuffer[q]);let oe=s.convert($.format,$.colorSpace),be=s.convert($.type),ue=v($.internalFormat,oe,be,$.normalized,$.colorSpace,T.isXRRenderTarget===!0),ae=at(T);n.renderbufferStorageMultisample(n.RENDERBUFFER,ae,ue,T.width,T.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+q,n.RENDERBUFFER,F.__webglColorRenderbuffer[q])}n.bindRenderbuffer(n.RENDERBUFFER,null),T.depthBuffer&&(F.__webglDepthRenderbuffer=n.createRenderbuffer(),ft(F.__webglDepthRenderbuffer,T,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(ne){t.bindTexture(n.TEXTURE_CUBE_MAP,z.__webglTexture),Xe(n.TEXTURE_CUBE_MAP,y);for(let q=0;q<6;q++)if(y.mipmaps&&y.mipmaps.length>0)for(let $=0;$<y.mipmaps.length;$++)Ee(F.__webglFramebuffer[q][$],T,y,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+q,$);else Ee(F.__webglFramebuffer[q],T,y,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+q,0);p(y)&&M(n.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(se){for(let q=0,$=W.length;q<$;q++){let oe=W[q],be=i.get(oe),ue=n.TEXTURE_2D;(T.isWebGL3DRenderTarget||T.isWebGLArrayRenderTarget)&&(ue=T.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(ue,be.__webglTexture),Xe(ue,oe),Ee(F.__webglFramebuffer,T,oe,n.COLOR_ATTACHMENT0+q,ue,0),p(oe)&&M(ue)}t.unbindTexture()}else{let q=n.TEXTURE_2D;if((T.isWebGL3DRenderTarget||T.isWebGLArrayRenderTarget)&&(q=T.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(q,z.__webglTexture),Xe(q,y),y.mipmaps&&y.mipmaps.length>0)for(let $=0;$<y.mipmaps.length;$++)Ee(F.__webglFramebuffer[$],T,y,n.COLOR_ATTACHMENT0,q,$);else Ee(F.__webglFramebuffer,T,y,n.COLOR_ATTACHMENT0,q,0);p(y)&&M(q),t.unbindTexture()}T.depthBuffer&&je(T)}function gt(T){let y=T.textures;for(let F=0,z=y.length;F<z;F++){let W=y[F];if(p(W)){let ne=S(T),se=i.get(W).__webglTexture;t.bindTexture(ne,se),M(ne),t.unbindTexture()}}}let Mt=[],At=[];function Lt(T){if(T.samples>0){if(xt(T)===!1){let y=T.textures,F=T.width,z=T.height,W=n.COLOR_BUFFER_BIT,ne=T.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,se=i.get(T),q=y.length>1;if(q)for(let oe=0;oe<y.length;oe++)t.bindFramebuffer(n.FRAMEBUFFER,se.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+oe,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,se.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+oe,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,se.__webglMultisampledFramebuffer);let $=T.texture.mipmaps;$&&$.length>0?t.bindFramebuffer(n.DRAW_FRAMEBUFFER,se.__webglFramebuffer[0]):t.bindFramebuffer(n.DRAW_FRAMEBUFFER,se.__webglFramebuffer);for(let oe=0;oe<y.length;oe++){if(T.resolveDepthBuffer&&(T.depthBuffer&&(W|=n.DEPTH_BUFFER_BIT),T.stencilBuffer&&T.resolveStencilBuffer&&(W|=n.STENCIL_BUFFER_BIT)),q){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,se.__webglColorRenderbuffer[oe]);let be=i.get(y[oe]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,be,0)}n.blitFramebuffer(0,0,F,z,0,0,F,z,W,n.NEAREST),c===!0&&(Mt.length=0,At.length=0,Mt.push(n.COLOR_ATTACHMENT0+oe),T.depthBuffer&&T.resolveDepthBuffer===!1&&(Mt.push(ne),At.push(ne),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,At)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,Mt))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),q)for(let oe=0;oe<y.length;oe++){t.bindFramebuffer(n.FRAMEBUFFER,se.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+oe,n.RENDERBUFFER,se.__webglColorRenderbuffer[oe]);let be=i.get(y[oe]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,se.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+oe,n.TEXTURE_2D,be,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,se.__webglMultisampledFramebuffer)}else if(T.depthBuffer&&T.resolveDepthBuffer===!1&&c){let y=T.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[y])}}}function at(T){return Math.min(r.maxSamples,T.samples)}function xt(T){let y=i.get(T);return T.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&y.__useRenderToTexture!==!1}function L(T){let y=o.render.frame;u.get(T)!==y&&(u.set(T,y),T.update())}function Zt(T,y){let F=T.colorSpace,z=T.format,W=T.type;return T.isCompressedTexture===!0||T.isVideoTexture===!0||F!==qn&&F!==Jn&&(ze.getTransfer(F)===Ye?(z!==cn||W!==Jt)&&Ae("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Re("WebGLTextures: Unsupported texture color space:",F)),y}function $e(T){return typeof HTMLImageElement<"u"&&T instanceof HTMLImageElement?(l.width=T.naturalWidth||T.width,l.height=T.naturalHeight||T.height):typeof VideoFrame<"u"&&T instanceof VideoFrame?(l.width=T.displayWidth,l.height=T.displayHeight):(l.width=T.width,l.height=T.height),l}this.allocateTextureUnit=G,this.resetTextureUnits=X,this.getTextureUnits=Y,this.setTextureUnits=N,this.setTexture2D=K,this.setTexture2DArray=Q,this.setTexture3D=ee,this.setTextureCube=ce,this.rebindTextures=qe,this.setupRenderTarget=Ge,this.updateRenderTargetMipmap=gt,this.updateMultisampleRenderTarget=Lt,this.setupDepthRenderbuffer=je,this.setupFrameBufferTexture=Ee,this.useMultisampledRTT=xt,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function Ey(n,e){function t(i,r=Jn){let s,o=ze.getTransfer(r);if(i===Jt)return n.UNSIGNED_BYTE;if(i===Yo)return n.UNSIGNED_SHORT_4_4_4_4;if(i===Zo)return n.UNSIGNED_SHORT_5_5_5_1;if(i===rc)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===sc)return n.UNSIGNED_INT_10F_11F_11F_REV;if(i===nc)return n.BYTE;if(i===ic)return n.SHORT;if(i===vr)return n.UNSIGNED_SHORT;if(i===qo)return n.INT;if(i===yn)return n.UNSIGNED_INT;if(i===_n)return n.FLOAT;if(i===Dn)return n.HALF_FLOAT;if(i===oc)return n.ALPHA;if(i===ac)return n.RGB;if(i===cn)return n.RGBA;if(i===An)return n.DEPTH_COMPONENT;if(i===vi)return n.DEPTH_STENCIL;if(i===lc)return n.RED;if(i===$o)return n.RED_INTEGER;if(i===bi)return n.RG;if(i===Jo)return n.RG_INTEGER;if(i===Ko)return n.RGBA_INTEGER;if(i===os||i===as||i===ls||i===cs)if(o===Ye)if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(i===os)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===as)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===ls)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===cs)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=e.get("WEBGL_compressed_texture_s3tc"),s!==null){if(i===os)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===as)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===ls)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===cs)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===jo||i===Qo||i===ea||i===ta)if(s=e.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(i===jo)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Qo)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===ea)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===ta)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===na||i===ia||i===ra||i===sa||i===oa||i===us||i===aa)if(s=e.get("WEBGL_compressed_texture_etc"),s!==null){if(i===na||i===ia)return o===Ye?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(i===ra)return o===Ye?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC;if(i===sa)return s.COMPRESSED_R11_EAC;if(i===oa)return s.COMPRESSED_SIGNED_R11_EAC;if(i===us)return s.COMPRESSED_RG11_EAC;if(i===aa)return s.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===la||i===ca||i===ua||i===ha||i===da||i===fa||i===pa||i===ma||i===ga||i===xa||i===ya||i===_a||i===va||i===ba)if(s=e.get("WEBGL_compressed_texture_astc"),s!==null){if(i===la)return o===Ye?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===ca)return o===Ye?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===ua)return o===Ye?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===ha)return o===Ye?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===da)return o===Ye?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===fa)return o===Ye?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===pa)return o===Ye?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===ma)return o===Ye?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===ga)return o===Ye?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===xa)return o===Ye?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===ya)return o===Ye?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===_a)return o===Ye?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===va)return o===Ye?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===ba)return o===Ye?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===Ma||i===Sa||i===wa)if(s=e.get("EXT_texture_compression_bptc"),s!==null){if(i===Ma)return o===Ye?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===Sa)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===wa)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===Ea||i===Ta||i===hs||i===Aa)if(s=e.get("EXT_texture_compression_rgtc"),s!==null){if(i===Ea)return s.COMPRESSED_RED_RGTC1_EXT;if(i===Ta)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===hs)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===Aa)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===br?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:t}}var Ty=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Ay=`
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

}`,Rc=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let i=new Jr(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=i}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,i=new Ut({vertexShader:Ty,fragmentShader:Ay,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new ut(new ki(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Cc=class extends Rn{constructor(e,t){super();let i=this,r=null,s=1,o=null,a="local-floor",c=1,l=null,u=null,f=null,h=null,m=null,g=null,x=typeof XRWebGLBinding<"u",d=new Rc,p={},M=t.getContextAttributes(),S=null,v=null,w=[],E=[],R=new Be,_=null,A=new Vt;A.viewport=new rt;let I=new Vt;I.viewport=new rt;let C=[A,I],U=new Vo,X=null,Y=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(J){let re=w[J];return re===void 0&&(re=new pr,w[J]=re),re.getTargetRaySpace()},this.getControllerGrip=function(J){let re=w[J];return re===void 0&&(re=new pr,w[J]=re),re.getGripSpace()},this.getHand=function(J){let re=w[J];return re===void 0&&(re=new pr,w[J]=re),re.getHandSpace()};function N(J){let re=E.indexOf(J.inputSource);if(re===-1)return;let te=w[re];te!==void 0&&(te.update(J.inputSource,J.frame,l||o),te.dispatchEvent({type:J.type,data:J.inputSource}))}function G(){r.removeEventListener("select",N),r.removeEventListener("selectstart",N),r.removeEventListener("selectend",N),r.removeEventListener("squeeze",N),r.removeEventListener("squeezestart",N),r.removeEventListener("squeezeend",N),r.removeEventListener("end",G),r.removeEventListener("inputsourceschange",H);for(let J=0;J<w.length;J++){let re=E[J];re!==null&&(E[J]=null,w[J].disconnect(re))}X=null,Y=null,d.reset();for(let J in p)delete p[J];e.setRenderTarget(S),m=null,h=null,f=null,r=null,v=null,Xe.stop(),i.isPresenting=!1,e.setPixelRatio(_),e.setSize(R.width,R.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(J){s=J,i.isPresenting===!0&&Ae("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(J){a=J,i.isPresenting===!0&&Ae("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||o},this.setReferenceSpace=function(J){l=J},this.getBaseLayer=function(){return h!==null?h:m},this.getBinding=function(){return f===null&&x&&(f=new XRWebGLBinding(r,t)),f},this.getFrame=function(){return g},this.getSession=function(){return r},this.setSession=async function(J){if(r=J,r!==null){if(S=e.getRenderTarget(),r.addEventListener("select",N),r.addEventListener("selectstart",N),r.addEventListener("selectend",N),r.addEventListener("squeeze",N),r.addEventListener("squeezestart",N),r.addEventListener("squeezeend",N),r.addEventListener("end",G),r.addEventListener("inputsourceschange",H),M.xrCompatible!==!0&&await t.makeXRCompatible(),_=e.getPixelRatio(),e.getSize(R),x&&"createProjectionLayer"in XRWebGLBinding.prototype){let te=null,Pe=null,Le=null;M.depth&&(Le=M.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,te=M.stencil?vi:An,Pe=M.stencil?br:yn);let Ee={colorFormat:t.RGBA8,depthFormat:Le,scaleFactor:s};f=this.getBinding(),h=f.createProjectionLayer(Ee),r.updateRenderState({layers:[h]}),e.setPixelRatio(1),e.setSize(h.textureWidth,h.textureHeight,!1),v=new nn(h.textureWidth,h.textureHeight,{format:cn,type:Jt,depthTexture:new $n(h.textureWidth,h.textureHeight,Pe,void 0,void 0,void 0,void 0,void 0,void 0,te),stencilBuffer:M.stencil,colorSpace:e.outputColorSpace,samples:M.antialias?4:0,resolveDepthBuffer:h.ignoreDepthValues===!1,resolveStencilBuffer:h.ignoreDepthValues===!1})}else{let te={antialias:M.antialias,alpha:!0,depth:M.depth,stencil:M.stencil,framebufferScaleFactor:s};m=new XRWebGLLayer(r,t,te),r.updateRenderState({baseLayer:m}),e.setPixelRatio(1),e.setSize(m.framebufferWidth,m.framebufferHeight,!1),v=new nn(m.framebufferWidth,m.framebufferHeight,{format:cn,type:Jt,colorSpace:e.outputColorSpace,stencilBuffer:M.stencil,resolveDepthBuffer:m.ignoreDepthValues===!1,resolveStencilBuffer:m.ignoreDepthValues===!1})}v.isXRRenderTarget=!0,this.setFoveation(c),l=null,o=await r.requestReferenceSpace(a),Xe.setContext(r),Xe.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return d.getDepthTexture()};function H(J){for(let re=0;re<J.removed.length;re++){let te=J.removed[re],Pe=E.indexOf(te);Pe>=0&&(E[Pe]=null,w[Pe].disconnect(te))}for(let re=0;re<J.added.length;re++){let te=J.added[re],Pe=E.indexOf(te);if(Pe===-1){for(let Ee=0;Ee<w.length;Ee++)if(Ee>=E.length){E.push(te),Pe=Ee;break}else if(E[Ee]===null){E[Ee]=te,Pe=Ee;break}if(Pe===-1)break}let Le=w[Pe];Le&&Le.connect(te)}}let K=new k,Q=new k;function ee(J,re,te){K.setFromMatrixPosition(re.matrixWorld),Q.setFromMatrixPosition(te.matrixWorld);let Pe=K.distanceTo(Q),Le=re.projectionMatrix.elements,Ee=te.projectionMatrix.elements,ft=Le[14]/(Le[10]-1),ke=Le[14]/(Le[10]+1),je=(Le[9]+1)/Le[5],qe=(Le[9]-1)/Le[5],Ge=(Le[8]-1)/Le[0],gt=(Ee[8]+1)/Ee[0],Mt=ft*Ge,At=ft*gt,Lt=Pe/(-Ge+gt),at=Lt*-Ge;if(re.matrixWorld.decompose(J.position,J.quaternion,J.scale),J.translateX(at),J.translateZ(Lt),J.matrixWorld.compose(J.position,J.quaternion,J.scale),J.matrixWorldInverse.copy(J.matrixWorld).invert(),Le[10]===-1)J.projectionMatrix.copy(re.projectionMatrix),J.projectionMatrixInverse.copy(re.projectionMatrixInverse);else{let xt=ft+Lt,L=ke+Lt,Zt=Mt-at,$e=At+(Pe-at),T=je*ke/L*xt,y=qe*ke/L*xt;J.projectionMatrix.makePerspective(Zt,$e,T,y,xt,L),J.projectionMatrixInverse.copy(J.projectionMatrix).invert()}}function ce(J,re){re===null?J.matrixWorld.copy(J.matrix):J.matrixWorld.multiplyMatrices(re.matrixWorld,J.matrix),J.matrixWorldInverse.copy(J.matrixWorld).invert()}this.updateCamera=function(J){if(r===null)return;let re=J.near,te=J.far;d.texture!==null&&(d.depthNear>0&&(re=d.depthNear),d.depthFar>0&&(te=d.depthFar)),U.near=I.near=A.near=re,U.far=I.far=A.far=te,(X!==U.near||Y!==U.far)&&(r.updateRenderState({depthNear:U.near,depthFar:U.far}),X=U.near,Y=U.far),U.layers.mask=J.layers.mask|6,A.layers.mask=U.layers.mask&-5,I.layers.mask=U.layers.mask&-3;let Pe=J.parent,Le=U.cameras;ce(U,Pe);for(let Ee=0;Ee<Le.length;Ee++)ce(Le[Ee],Pe);Le.length===2?ee(U,A,I):U.projectionMatrix.copy(A.projectionMatrix),xe(J,U,Pe)};function xe(J,re,te){te===null?J.matrix.copy(re.matrixWorld):(J.matrix.copy(te.matrixWorld),J.matrix.invert(),J.matrix.multiply(re.matrixWorld)),J.matrix.decompose(J.position,J.quaternion,J.scale),J.updateMatrixWorld(!0),J.projectionMatrix.copy(re.projectionMatrix),J.projectionMatrixInverse.copy(re.projectionMatrixInverse),J.isPerspectiveCamera&&(J.fov=vo*2*Math.atan(1/J.projectionMatrix.elements[5]),J.zoom=1)}this.getCamera=function(){return U},this.getFoveation=function(){if(!(h===null&&m===null))return c},this.setFoveation=function(J){c=J,h!==null&&(h.fixedFoveation=J),m!==null&&m.fixedFoveation!==void 0&&(m.fixedFoveation=J)},this.hasDepthSensing=function(){return d.texture!==null},this.getDepthSensingMesh=function(){return d.getMesh(U)},this.getCameraTexture=function(J){return p[J]};let We=null;function ot(J,re){if(u=re.getViewerPose(l||o),g=re,u!==null){let te=u.views;m!==null&&(e.setRenderTargetFramebuffer(v,m.framebuffer),e.setRenderTarget(v));let Pe=!1;te.length!==U.cameras.length&&(U.cameras.length=0,Pe=!0);for(let ke=0;ke<te.length;ke++){let je=te[ke],qe=null;if(m!==null)qe=m.getViewport(je);else{let gt=f.getViewSubImage(h,je);qe=gt.viewport,ke===0&&(e.setRenderTargetTextures(v,gt.colorTexture,gt.depthStencilTexture),e.setRenderTarget(v))}let Ge=C[ke];Ge===void 0&&(Ge=new Vt,Ge.layers.enable(ke),Ge.viewport=new rt,C[ke]=Ge),Ge.matrix.fromArray(je.transform.matrix),Ge.matrix.decompose(Ge.position,Ge.quaternion,Ge.scale),Ge.projectionMatrix.fromArray(je.projectionMatrix),Ge.projectionMatrixInverse.copy(Ge.projectionMatrix).invert(),Ge.viewport.set(qe.x,qe.y,qe.width,qe.height),ke===0&&(U.matrix.copy(Ge.matrix),U.matrix.decompose(U.position,U.quaternion,U.scale)),Pe===!0&&U.cameras.push(Ge)}let Le=r.enabledFeatures;if(Le&&Le.includes("depth-sensing")&&r.depthUsage=="gpu-optimized"&&x){f=i.getBinding();let ke=f.getDepthInformation(te[0]);ke&&ke.isValid&&ke.texture&&d.init(ke,r.renderState)}if(Le&&Le.includes("camera-access")&&x){e.state.unbindTexture(),f=i.getBinding();for(let ke=0;ke<te.length;ke++){let je=te[ke].camera;if(je){let qe=p[je];qe||(qe=new Jr,p[je]=qe);let Ge=f.getCameraImage(je);qe.sourceTexture=Ge}}}}for(let te=0;te<w.length;te++){let Pe=E[te],Le=w[te];Pe!==null&&Le!==void 0&&Le.update(Pe,re,l||o)}We&&We(J,re),re.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:re}),g=null}let Xe=new td;Xe.setAnimationLoop(ot),this.setAnimationLoop=function(J){We=J},this.dispose=function(){}}},Ry=new st,ad=new Ie;ad.set(-1,0,0,0,1,0,0,0,1);function Cy(n,e){function t(d,p){d.matrixAutoUpdate===!0&&d.updateMatrix(),p.value.copy(d.matrix)}function i(d,p){p.color.getRGB(d.fogColor.value,hc(n)),p.isFog?(d.fogNear.value=p.near,d.fogFar.value=p.far):p.isFogExp2&&(d.fogDensity.value=p.density)}function r(d,p,M,S,v){p.isNodeMaterial?p.uniformsNeedUpdate=!1:p.isMeshBasicMaterial?s(d,p):p.isMeshLambertMaterial?(s(d,p),p.envMap&&(d.envMapIntensity.value=p.envMapIntensity)):p.isMeshToonMaterial?(s(d,p),f(d,p)):p.isMeshPhongMaterial?(s(d,p),u(d,p),p.envMap&&(d.envMapIntensity.value=p.envMapIntensity)):p.isMeshStandardMaterial?(s(d,p),h(d,p),p.isMeshPhysicalMaterial&&m(d,p,v)):p.isMeshMatcapMaterial?(s(d,p),g(d,p)):p.isMeshDepthMaterial?s(d,p):p.isMeshDistanceMaterial?(s(d,p),x(d,p)):p.isMeshNormalMaterial?s(d,p):p.isLineBasicMaterial?(o(d,p),p.isLineDashedMaterial&&a(d,p)):p.isPointsMaterial?c(d,p,M,S):p.isSpriteMaterial?l(d,p):p.isShadowMaterial?(d.color.value.copy(p.color),d.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function s(d,p){d.opacity.value=p.opacity,p.color&&d.diffuse.value.copy(p.color),p.emissive&&d.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(d.map.value=p.map,t(p.map,d.mapTransform)),p.alphaMap&&(d.alphaMap.value=p.alphaMap,t(p.alphaMap,d.alphaMapTransform)),p.bumpMap&&(d.bumpMap.value=p.bumpMap,t(p.bumpMap,d.bumpMapTransform),d.bumpScale.value=p.bumpScale,p.side===qt&&(d.bumpScale.value*=-1)),p.normalMap&&(d.normalMap.value=p.normalMap,t(p.normalMap,d.normalMapTransform),d.normalScale.value.copy(p.normalScale),p.side===qt&&d.normalScale.value.negate()),p.displacementMap&&(d.displacementMap.value=p.displacementMap,t(p.displacementMap,d.displacementMapTransform),d.displacementScale.value=p.displacementScale,d.displacementBias.value=p.displacementBias),p.emissiveMap&&(d.emissiveMap.value=p.emissiveMap,t(p.emissiveMap,d.emissiveMapTransform)),p.specularMap&&(d.specularMap.value=p.specularMap,t(p.specularMap,d.specularMapTransform)),p.alphaTest>0&&(d.alphaTest.value=p.alphaTest);let M=e.get(p),S=M.envMap,v=M.envMapRotation;S&&(d.envMap.value=S,d.envMapRotation.value.setFromMatrix4(Ry.makeRotationFromEuler(v)).transpose(),S.isCubeTexture&&S.isRenderTargetTexture===!1&&d.envMapRotation.value.premultiply(ad),d.reflectivity.value=p.reflectivity,d.ior.value=p.ior,d.refractionRatio.value=p.refractionRatio),p.lightMap&&(d.lightMap.value=p.lightMap,d.lightMapIntensity.value=p.lightMapIntensity,t(p.lightMap,d.lightMapTransform)),p.aoMap&&(d.aoMap.value=p.aoMap,d.aoMapIntensity.value=p.aoMapIntensity,t(p.aoMap,d.aoMapTransform))}function o(d,p){d.diffuse.value.copy(p.color),d.opacity.value=p.opacity,p.map&&(d.map.value=p.map,t(p.map,d.mapTransform))}function a(d,p){d.dashSize.value=p.dashSize,d.totalSize.value=p.dashSize+p.gapSize,d.scale.value=p.scale}function c(d,p,M,S){d.diffuse.value.copy(p.color),d.opacity.value=p.opacity,d.size.value=p.size*M,d.scale.value=S*.5,p.map&&(d.map.value=p.map,t(p.map,d.uvTransform)),p.alphaMap&&(d.alphaMap.value=p.alphaMap,t(p.alphaMap,d.alphaMapTransform)),p.alphaTest>0&&(d.alphaTest.value=p.alphaTest)}function l(d,p){d.diffuse.value.copy(p.color),d.opacity.value=p.opacity,d.rotation.value=p.rotation,p.map&&(d.map.value=p.map,t(p.map,d.mapTransform)),p.alphaMap&&(d.alphaMap.value=p.alphaMap,t(p.alphaMap,d.alphaMapTransform)),p.alphaTest>0&&(d.alphaTest.value=p.alphaTest)}function u(d,p){d.specular.value.copy(p.specular),d.shininess.value=Math.max(p.shininess,1e-4)}function f(d,p){p.gradientMap&&(d.gradientMap.value=p.gradientMap)}function h(d,p){d.metalness.value=p.metalness,p.metalnessMap&&(d.metalnessMap.value=p.metalnessMap,t(p.metalnessMap,d.metalnessMapTransform)),d.roughness.value=p.roughness,p.roughnessMap&&(d.roughnessMap.value=p.roughnessMap,t(p.roughnessMap,d.roughnessMapTransform)),p.envMap&&(d.envMapIntensity.value=p.envMapIntensity)}function m(d,p,M){d.ior.value=p.ior,p.sheen>0&&(d.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),d.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(d.sheenColorMap.value=p.sheenColorMap,t(p.sheenColorMap,d.sheenColorMapTransform)),p.sheenRoughnessMap&&(d.sheenRoughnessMap.value=p.sheenRoughnessMap,t(p.sheenRoughnessMap,d.sheenRoughnessMapTransform))),p.clearcoat>0&&(d.clearcoat.value=p.clearcoat,d.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(d.clearcoatMap.value=p.clearcoatMap,t(p.clearcoatMap,d.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(d.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,t(p.clearcoatRoughnessMap,d.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(d.clearcoatNormalMap.value=p.clearcoatNormalMap,t(p.clearcoatNormalMap,d.clearcoatNormalMapTransform),d.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===qt&&d.clearcoatNormalScale.value.negate())),p.dispersion>0&&(d.dispersion.value=p.dispersion),p.iridescence>0&&(d.iridescence.value=p.iridescence,d.iridescenceIOR.value=p.iridescenceIOR,d.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],d.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(d.iridescenceMap.value=p.iridescenceMap,t(p.iridescenceMap,d.iridescenceMapTransform)),p.iridescenceThicknessMap&&(d.iridescenceThicknessMap.value=p.iridescenceThicknessMap,t(p.iridescenceThicknessMap,d.iridescenceThicknessMapTransform))),p.transmission>0&&(d.transmission.value=p.transmission,d.transmissionSamplerMap.value=M.texture,d.transmissionSamplerSize.value.set(M.width,M.height),p.transmissionMap&&(d.transmissionMap.value=p.transmissionMap,t(p.transmissionMap,d.transmissionMapTransform)),d.thickness.value=p.thickness,p.thicknessMap&&(d.thicknessMap.value=p.thicknessMap,t(p.thicknessMap,d.thicknessMapTransform)),d.attenuationDistance.value=p.attenuationDistance,d.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(d.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(d.anisotropyMap.value=p.anisotropyMap,t(p.anisotropyMap,d.anisotropyMapTransform))),d.specularIntensity.value=p.specularIntensity,d.specularColor.value.copy(p.specularColor),p.specularColorMap&&(d.specularColorMap.value=p.specularColorMap,t(p.specularColorMap,d.specularColorMapTransform)),p.specularIntensityMap&&(d.specularIntensityMap.value=p.specularIntensityMap,t(p.specularIntensityMap,d.specularIntensityMapTransform))}function g(d,p){p.matcap&&(d.matcap.value=p.matcap)}function x(d,p){let M=e.get(p).light;d.referencePosition.value.setFromMatrixPosition(M.matrixWorld),d.nearDistance.value=M.shadow.camera.near,d.farDistance.value=M.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function Py(n,e,t,i){let r={},s={},o=[],a=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function c(v,w){let E=w.program;i.uniformBlockBinding(v,E)}function l(v,w){let E=r[v.id];E===void 0&&(d(v),E=u(v),r[v.id]=E,v.addEventListener("dispose",M));let R=w.program;i.updateUBOMapping(v,R);let _=e.render.frame;s[v.id]!==_&&(h(v),s[v.id]=_)}function u(v){let w=f();v.__bindingPointIndex=w;let E=n.createBuffer(),R=v.__size,_=v.usage;return n.bindBuffer(n.UNIFORM_BUFFER,E),n.bufferData(n.UNIFORM_BUFFER,R,_),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,w,E),E}function f(){for(let v=0;v<a;v++)if(o.indexOf(v)===-1)return o.push(v),v;return Re("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function h(v){let w=r[v.id],E=v.uniforms,R=v.__cache;n.bindBuffer(n.UNIFORM_BUFFER,w);for(let _=0,A=E.length;_<A;_++){let I=E[_];if(Array.isArray(I))for(let C=0,U=I.length;C<U;C++)m(I[C],_,C,R);else m(I,_,0,R)}n.bindBuffer(n.UNIFORM_BUFFER,null)}function m(v,w,E,R){if(x(v,w,E,R)===!0){let _=v.__offset,A=v.value;if(Array.isArray(A)){let I=0;for(let C=0;C<A.length;C++){let U=A[C],X=p(U);g(U,v.__data,I),typeof U!="number"&&typeof U!="boolean"&&!U.isMatrix3&&!ArrayBuffer.isView(U)&&(I+=X.storage/Float32Array.BYTES_PER_ELEMENT)}}else g(A,v.__data,0);n.bufferSubData(n.UNIFORM_BUFFER,_,v.__data)}}function g(v,w,E){typeof v=="number"||typeof v=="boolean"?w[0]=v:v.isMatrix3?(w[0]=v.elements[0],w[1]=v.elements[1],w[2]=v.elements[2],w[3]=0,w[4]=v.elements[3],w[5]=v.elements[4],w[6]=v.elements[5],w[7]=0,w[8]=v.elements[6],w[9]=v.elements[7],w[10]=v.elements[8],w[11]=0):ArrayBuffer.isView(v)?w.set(new v.constructor(v.buffer,v.byteOffset,w.length)):v.toArray(w,E)}function x(v,w,E,R){let _=v.value,A=w+"_"+E;if(R[A]===void 0)return typeof _=="number"||typeof _=="boolean"?R[A]=_:ArrayBuffer.isView(_)?R[A]=_.slice():R[A]=_.clone(),!0;{let I=R[A];if(typeof _=="number"||typeof _=="boolean"){if(I!==_)return R[A]=_,!0}else{if(ArrayBuffer.isView(_))return!0;if(I.equals(_)===!1)return I.copy(_),!0}}return!1}function d(v){let w=v.uniforms,E=0,R=16;for(let A=0,I=w.length;A<I;A++){let C=Array.isArray(w[A])?w[A]:[w[A]];for(let U=0,X=C.length;U<X;U++){let Y=C[U],N=Array.isArray(Y.value)?Y.value:[Y.value];for(let G=0,H=N.length;G<H;G++){let K=N[G],Q=p(K),ee=E%R,ce=ee%Q.boundary,xe=ee+ce;E+=ce,xe!==0&&R-xe<Q.storage&&(E+=R-xe),Y.__data=new Float32Array(Q.storage/Float32Array.BYTES_PER_ELEMENT),Y.__offset=E,E+=Q.storage}}}let _=E%R;return _>0&&(E+=R-_),v.__size=E,v.__cache={},this}function p(v){let w={boundary:0,storage:0};return typeof v=="number"||typeof v=="boolean"?(w.boundary=4,w.storage=4):v.isVector2?(w.boundary=8,w.storage=8):v.isVector3||v.isColor?(w.boundary=16,w.storage=12):v.isVector4?(w.boundary=16,w.storage=16):v.isMatrix3?(w.boundary=48,w.storage=48):v.isMatrix4?(w.boundary=64,w.storage=64):v.isTexture?Ae("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(v)?(w.boundary=16,w.storage=v.byteLength):Ae("WebGLRenderer: Unsupported uniform value type.",v),w}function M(v){let w=v.target;w.removeEventListener("dispose",M);let E=o.indexOf(w.__bindingPointIndex);o.splice(E,1),n.deleteBuffer(r[w.id]),delete r[w.id],delete s[w.id]}function S(){for(let v in r)n.deleteBuffer(r[v]);o=[],r={},s={}}return{bind:c,update:l,dispose:S}}var Iy=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Nn=null;function Ly(){return Nn===null&&(Nn=new Eo(Iy,16,16,bi,Dn),Nn.name="DFG_LUT",Nn.minFilter=Nt,Nn.magFilter=Nt,Nn.wrapS=Tn,Nn.wrapT=Tn,Nn.generateMipmaps=!1,Nn.needsUpdate=!0),Nn}var Fa=class{constructor(e={}){let{canvas:t=Th(),context:i=null,depth:r=!0,stencil:s=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:l=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:f=!1,reversedDepthBuffer:h=!1,outputBufferType:m=Jt}=e;this.isWebGLRenderer=!0;let g;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=i.getContextAttributes().alpha}else g=o;let x=m,d=new Set([Ko,Jo,$o]),p=new Set([Jt,yn,vr,br,Yo,Zo]),M=new Uint32Array(4),S=new Int32Array(4),v=new k,w=null,E=null,R=[],_=[],A=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=xn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let I=this,C=!1,U=null,X=null,Y=null,N=null;this._outputColorSpace=Xt;let G=0,H=0,K=null,Q=-1,ee=null,ce=new rt,xe=new rt,We=null,ot=new Fe(0),Xe=0,J=t.width,re=t.height,te=1,Pe=null,Le=null,Ee=new rt(0,0,J,re),ft=new rt(0,0,J,re),ke=!1,je=new gr,qe=!1,Ge=!1,gt=new st,Mt=new k,At=new rt,Lt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},at=!1;function xt(){return K===null?te:1}let L=i;function Zt(b,D){return t.getContext(b,D)}try{let b={alpha:!0,depth:r,stencil:s,antialias:a,premultipliedAlpha:c,preserveDrawingBuffer:l,powerPreference:u,failIfMajorPerformanceCaveat:f};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"185"}`),t.addEventListener("webglcontextlost",lt,!1),t.addEventListener("webglcontextrestored",tt,!1),t.addEventListener("webglcontextcreationerror",bn,!1),L===null){let D="webgl2";if(L=Zt(D,b),L===null)throw Zt(D)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(b){throw Re("WebGLRenderer: "+b.message),b}let $e,T,y,F,z,W,ne,se,q,$,oe,be,ue,ae,we,Te,De,P,ie,Z,le,pe,j;function ve(){$e=new k0(L),$e.init(),le=new Ey(L,$e),T=new I0(L,$e,e,le),y=new Sy(L,$e),T.reversedDepthBuffer&&h&&y.buffers.depth.setReversed(!0),X=L.createFramebuffer(),Y=L.createFramebuffer(),N=L.createFramebuffer(),F=new G0(L),z=new cy,W=new wy(L,$e,y,z,T,le,F),ne=new B0(I),se=new qp(L),pe=new C0(L,se),q=new z0(L,se,F,pe),$=new W0(L,q,se,pe,F),P=new H0(L,T,W),we=new L0(z),oe=new ly(I,ne,$e,T,pe,we),be=new Cy(I,z),ue=new hy,ae=new xy($e),De=new R0(I,ne,y,$,g,c),Te=new My(I,$,T),j=new Py(L,F,T,y),ie=new P0(L,$e,F),Z=new V0(L,$e,F),F.programs=oe.programs,I.capabilities=T,I.extensions=$e,I.properties=z,I.renderLists=ue,I.shadowMap=Te,I.state=y,I.info=F}ve(),x!==Jt&&(A=new q0(x,t.width,t.height,a,r,s));let ye=new Cc(I,L);this.xr=ye,this.getContext=function(){return L},this.getContextAttributes=function(){return L.getContextAttributes()},this.forceContextLoss=function(){let b=$e.get("WEBGL_lose_context");b&&b.loseContext()},this.forceContextRestore=function(){let b=$e.get("WEBGL_lose_context");b&&b.restoreContext()},this.getPixelRatio=function(){return te},this.setPixelRatio=function(b){b!==void 0&&(te=b,this.setSize(J,re,!1))},this.getSize=function(b){return b.set(J,re)},this.setSize=function(b,D,V=!0){if(ye.isPresenting){Ae("WebGLRenderer: Can't change size while VR device is presenting.");return}J=b,re=D,t.width=Math.floor(b*te),t.height=Math.floor(D*te),V===!0&&(t.style.width=b+"px",t.style.height=D+"px"),A!==null&&A.setSize(t.width,t.height),this.setViewport(0,0,b,D)},this.getDrawingBufferSize=function(b){return b.set(J*te,re*te).floor()},this.setDrawingBufferSize=function(b,D,V){J=b,re=D,te=V,t.width=Math.floor(b*V),t.height=Math.floor(D*V),this.setViewport(0,0,b,D)},this.setEffects=function(b){if(x===Jt){Re("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(b){for(let D=0;D<b.length;D++)if(b[D].isOutputPass===!0){Ae("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}A.setEffects(b||[])},this.getCurrentViewport=function(b){return b.copy(ce)},this.getViewport=function(b){return b.copy(Ee)},this.setViewport=function(b,D,V,O){b.isVector4?Ee.set(b.x,b.y,b.z,b.w):Ee.set(b,D,V,O),y.viewport(ce.copy(Ee).multiplyScalar(te).round())},this.getScissor=function(b){return b.copy(ft)},this.setScissor=function(b,D,V,O){b.isVector4?ft.set(b.x,b.y,b.z,b.w):ft.set(b,D,V,O),y.scissor(xe.copy(ft).multiplyScalar(te).round())},this.getScissorTest=function(){return ke},this.setScissorTest=function(b){y.setScissorTest(ke=b)},this.setOpaqueSort=function(b){Pe=b},this.setTransparentSort=function(b){Le=b},this.getClearColor=function(b){return b.copy(De.getClearColor())},this.setClearColor=function(){De.setClearColor(...arguments)},this.getClearAlpha=function(){return De.getClearAlpha()},this.setClearAlpha=function(){De.setClearAlpha(...arguments)},this.clear=function(b=!0,D=!0,V=!0){let O=0;if(b){let B=!1;if(K!==null){let fe=K.texture.format;B=d.has(fe)}if(B){let fe=K.texture.type,ge=p.has(fe),de=De.getClearColor(),_e=De.getClearAlpha(),Me=de.r,Ne=de.g,Oe=de.b;ge?(M[0]=Me,M[1]=Ne,M[2]=Oe,M[3]=_e,L.clearBufferuiv(L.COLOR,0,M)):(S[0]=Me,S[1]=Ne,S[2]=Oe,S[3]=_e,L.clearBufferiv(L.COLOR,0,S))}else O|=L.COLOR_BUFFER_BIT}D&&(O|=L.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),V&&(O|=L.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),O!==0&&L.clear(O)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(b){b.setRenderer(this),U=b},this.dispose=function(){t.removeEventListener("webglcontextlost",lt,!1),t.removeEventListener("webglcontextrestored",tt,!1),t.removeEventListener("webglcontextcreationerror",bn,!1),De.dispose(),ue.dispose(),ae.dispose(),z.dispose(),ne.dispose(),$.dispose(),pe.dispose(),j.dispose(),oe.dispose(),ye.dispose(),ye.removeEventListener("sessionstart",vu),ye.removeEventListener("sessionend",bu),Ri.stop()};function lt(b){b.preventDefault(),uc("WebGLRenderer: Context Lost."),C=!0}function tt(){uc("WebGLRenderer: Context Restored."),C=!1;let b=F.autoReset,D=Te.enabled,V=Te.autoUpdate,O=Te.needsUpdate,B=Te.type;ve(),F.autoReset=b,Te.enabled=D,Te.autoUpdate=V,Te.needsUpdate=O,Te.type=B}function bn(b){Re("WebGLRenderer: A WebGL context could not be created. Reason: ",b.statusMessage)}function Mn(b){let D=b.target;D.removeEventListener("dispose",Mn),sp(D)}function sp(b){op(b),z.remove(b)}function op(b){let D=z.get(b).programs;D!==void 0&&(D.forEach(function(V){oe.releaseProgram(V)}),b.isShaderMaterial&&oe.releaseShaderCache(b))}this.renderBufferDirect=function(b,D,V,O,B,fe){D===null&&(D=Lt);let ge=B.isMesh&&B.matrixWorld.determinantAffine()<0,de=cp(b,D,V,O,B);y.setMaterial(O,ge);let _e=V.index,Me=1;if(O.wireframe===!0){if(_e=q.getWireframeAttribute(V),_e===void 0)return;Me=2}let Ne=V.drawRange,Oe=V.attributes.position,Se=Ne.start*Me,Je=(Ne.start+Ne.count)*Me;fe!==null&&(Se=Math.max(Se,fe.start*Me),Je=Math.min(Je,(fe.start+fe.count)*Me)),_e!==null?(Se=Math.max(Se,0),Je=Math.min(Je,_e.count)):Oe!=null&&(Se=Math.max(Se,0),Je=Math.min(Je,Oe.count));let pt=Je-Se;if(pt<0||pt===1/0)return;pe.setup(B,O,de,V,_e);let ct,Qe=ie;if(_e!==null&&(ct=se.get(_e),Qe=Z,Qe.setIndex(ct)),B.isMesh)O.wireframe===!0?(y.setLineWidth(O.wireframeLinewidth*xt()),Qe.setMode(L.LINES)):Qe.setMode(L.TRIANGLES);else if(B.isLine){let Bt=O.linewidth;Bt===void 0&&(Bt=1),y.setLineWidth(Bt*xt()),B.isLineSegments?Qe.setMode(L.LINES):B.isLineLoop?Qe.setMode(L.LINE_LOOP):Qe.setMode(L.LINE_STRIP)}else B.isPoints?Qe.setMode(L.POINTS):B.isSprite&&Qe.setMode(L.TRIANGLES);if(B.isBatchedMesh)if($e.get("WEBGL_multi_draw"))Qe.renderMultiDraw(B._multiDrawStarts,B._multiDrawCounts,B._multiDrawCount);else{let Bt=B._multiDrawStarts,me=B._multiDrawCounts,jt=B._multiDrawCount,He=_e?se.get(_e).bytesPerElement:1,an=z.get(O).currentProgram.getUniforms();for(let Sn=0;Sn<jt;Sn++)an.setValue(L,"_gl_DrawID",Sn),Qe.render(Bt[Sn]/He,me[Sn])}else if(B.isInstancedMesh)Qe.renderInstances(Se,pt,B.count);else if(V.isInstancedBufferGeometry){let Bt=V._maxInstanceCount!==void 0?V._maxInstanceCount:1/0,me=Math.min(V.instanceCount,Bt);Qe.renderInstances(Se,pt,me)}else Qe.render(Se,pt)};function _u(b,D,V){b.transparent===!0&&b.side===Pn&&b.forceSinglePass===!1?(b.side=qt,b.needsUpdate=!0,ks(b,D,V),b.side=Xn,b.needsUpdate=!0,ks(b,D,V),b.side=Pn):ks(b,D,V)}this.compile=function(b,D,V=null){V===null&&(V=b),E=ae.get(V),E.init(D),_.push(E),V.traverseVisible(function(B){B.isLight&&B.layers.test(D.layers)&&(E.pushLight(B),B.castShadow&&E.pushShadow(B))}),b!==V&&b.traverseVisible(function(B){B.isLight&&B.layers.test(D.layers)&&(E.pushLight(B),B.castShadow&&E.pushShadow(B))}),E.setupLights();let O=new Set;return b.traverse(function(B){if(!(B.isMesh||B.isPoints||B.isLine||B.isSprite))return;let fe=B.material;if(fe)if(Array.isArray(fe))for(let ge=0;ge<fe.length;ge++){let de=fe[ge];_u(de,V,B),O.add(de)}else _u(fe,V,B),O.add(fe)}),E=_.pop(),O},this.compileAsync=function(b,D,V=null){let O=this.compile(b,D,V);return new Promise(B=>{function fe(){if(O.forEach(function(ge){z.get(ge).currentProgram.isReady()&&O.delete(ge)}),O.size===0){B(b);return}setTimeout(fe,10)}$e.get("KHR_parallel_shader_compile")!==null?fe():setTimeout(fe,10)})};let ll=null;function ap(b){ll&&ll(b)}function vu(){Ri.stop()}function bu(){Ri.start()}let Ri=new td;Ri.setAnimationLoop(ap),typeof self<"u"&&Ri.setContext(self),this.setAnimationLoop=function(b){ll=b,ye.setAnimationLoop(b),b===null?Ri.stop():Ri.start()},ye.addEventListener("sessionstart",vu),ye.addEventListener("sessionend",bu),this.render=function(b,D){if(D!==void 0&&D.isCamera!==!0){Re("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(C===!0)return;U!==null&&U.renderStart(b,D);let V=ye.enabled===!0&&ye.isPresenting===!0,O=A!==null&&(K===null||V)&&A.begin(I,K);if(b.matrixWorldAutoUpdate===!0&&b.updateMatrixWorld(),D.parent===null&&D.matrixWorldAutoUpdate===!0&&D.updateMatrixWorld(),ye.enabled===!0&&ye.isPresenting===!0&&(A===null||A.isCompositing()===!1)&&(ye.cameraAutoUpdate===!0&&ye.updateCamera(D),D=ye.getCamera()),b.isScene===!0&&b.onBeforeRender(I,b,D,K),E=ae.get(b,_.length),E.init(D),E.state.textureUnits=W.getTextureUnits(),_.push(E),gt.multiplyMatrices(D.projectionMatrix,D.matrixWorldInverse),je.setFromProjectionMatrix(gt,gn,D.reversedDepth),Ge=this.localClippingEnabled,qe=we.init(this.clippingPlanes,Ge),w=ue.get(b,R.length),w.init(),R.push(w),ye.enabled===!0&&ye.isPresenting===!0){let ge=I.xr.getDepthSensingMesh();ge!==null&&cl(ge,D,-1/0,I.sortObjects)}cl(b,D,0,I.sortObjects),w.finish(),I.sortObjects===!0&&w.sort(Pe,Le,D.reversedDepth),at=ye.enabled===!1||ye.isPresenting===!1||ye.hasDepthSensing()===!1,at&&De.addToRenderList(w,b),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),qe===!0&&we.beginShadows();let B=E.state.shadowsArray;if(Te.render(B,b,D),qe===!0&&we.endShadows(),(O&&A.hasRenderPass())===!1){let ge=w.opaque,de=w.transmissive;if(E.setupLights(),D.isArrayCamera){let _e=D.cameras;if(de.length>0)for(let Me=0,Ne=_e.length;Me<Ne;Me++){let Oe=_e[Me];Su(ge,de,b,Oe)}at&&De.render(b);for(let Me=0,Ne=_e.length;Me<Ne;Me++){let Oe=_e[Me];Mu(w,b,Oe,Oe.viewport)}}else de.length>0&&Su(ge,de,b,D),at&&De.render(b),Mu(w,b,D)}K!==null&&H===0&&(W.updateMultisampleRenderTarget(K),W.updateRenderTargetMipmap(K)),O&&A.end(I),b.isScene===!0&&b.onAfterRender(I,b,D),pe.resetDefaultState(),Q=-1,ee=null,_.pop(),_.length>0?(E=_[_.length-1],W.setTextureUnits(E.state.textureUnits),qe===!0&&we.setGlobalState(I.clippingPlanes,E.state.camera)):E=null,R.pop(),R.length>0?w=R[R.length-1]:w=null,U!==null&&U.renderEnd()};function cl(b,D,V,O){if(b.visible===!1)return;if(b.layers.test(D.layers)){if(b.isGroup)V=b.renderOrder;else if(b.isLOD)b.autoUpdate===!0&&b.update(D);else if(b.isLightProbeGrid)E.pushLightProbeGrid(b);else if(b.isLight)E.pushLight(b),b.castShadow&&E.pushShadow(b);else if(b.isSprite){if(!b.frustumCulled||je.intersectsSprite(b)){O&&At.setFromMatrixPosition(b.matrixWorld).applyMatrix4(gt);let ge=$.update(b),de=b.material;de.visible&&w.push(b,ge,de,V,At.z,null)}}else if((b.isMesh||b.isLine||b.isPoints)&&(!b.frustumCulled||je.intersectsObject(b))){let ge=$.update(b),de=b.material;if(O&&(b.boundingSphere!==void 0?(b.boundingSphere===null&&b.computeBoundingSphere(),At.copy(b.boundingSphere.center)):(ge.boundingSphere===null&&ge.computeBoundingSphere(),At.copy(ge.boundingSphere.center)),At.applyMatrix4(b.matrixWorld).applyMatrix4(gt)),Array.isArray(de)){let _e=ge.groups;for(let Me=0,Ne=_e.length;Me<Ne;Me++){let Oe=_e[Me],Se=de[Oe.materialIndex];Se&&Se.visible&&w.push(b,ge,Se,V,At.z,Oe)}}else de.visible&&w.push(b,ge,de,V,At.z,null)}}let fe=b.children;for(let ge=0,de=fe.length;ge<de;ge++)cl(fe[ge],D,V,O)}function Mu(b,D,V,O){let{opaque:B,transmissive:fe,transparent:ge}=b;E.setupLightsView(V),qe===!0&&we.setGlobalState(I.clippingPlanes,V),O&&y.viewport(ce.copy(O)),B.length>0&&Bs(B,D,V),fe.length>0&&Bs(fe,D,V),ge.length>0&&Bs(ge,D,V),y.buffers.depth.setTest(!0),y.buffers.depth.setMask(!0),y.buffers.color.setMask(!0),y.setPolygonOffset(!1)}function Su(b,D,V,O){if((V.isScene===!0?V.overrideMaterial:null)!==null)return;if(E.state.transmissionRenderTarget[O.id]===void 0){let Se=$e.has("EXT_color_buffer_half_float")||$e.has("EXT_color_buffer_float");E.state.transmissionRenderTarget[O.id]=new nn(1,1,{generateMipmaps:!0,type:Se?Dn:Jt,minFilter:Ln,samples:Math.max(4,T.samples),stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:ze.workingColorSpace})}let fe=E.state.transmissionRenderTarget[O.id],ge=O.viewport||ce;fe.setSize(ge.z*I.transmissionResolutionScale,ge.w*I.transmissionResolutionScale);let de=I.getRenderTarget(),_e=I.getActiveCubeFace(),Me=I.getActiveMipmapLevel();I.setRenderTarget(fe),I.getClearColor(ot),Xe=I.getClearAlpha(),Xe<1&&I.setClearColor(16777215,.5),I.clear(),at&&De.render(V);let Ne=I.toneMapping;I.toneMapping=xn;let Oe=O.viewport;if(O.viewport!==void 0&&(O.viewport=void 0),E.setupLightsView(O),qe===!0&&we.setGlobalState(I.clippingPlanes,O),Bs(b,V,O),W.updateMultisampleRenderTarget(fe),W.updateRenderTargetMipmap(fe),$e.has("WEBGL_multisampled_render_to_texture")===!1){let Se=!1;for(let Je=0,pt=D.length;Je<pt;Je++){let ct=D[Je],{object:Qe,geometry:Bt,material:me,group:jt}=ct;if(me.side===Pn&&Qe.layers.test(O.layers)){let He=me.side;me.side=qt,me.needsUpdate=!0,wu(Qe,V,O,Bt,me,jt),me.side=He,me.needsUpdate=!0,Se=!0}}Se===!0&&(W.updateMultisampleRenderTarget(fe),W.updateRenderTargetMipmap(fe))}I.setRenderTarget(de,_e,Me),I.setClearColor(ot,Xe),Oe!==void 0&&(O.viewport=Oe),I.toneMapping=Ne}function Bs(b,D,V){let O=D.isScene===!0?D.overrideMaterial:null;for(let B=0,fe=b.length;B<fe;B++){let ge=b[B],{object:de,geometry:_e,group:Me}=ge,Ne=ge.material;Ne.allowOverride===!0&&O!==null&&(Ne=O),de.layers.test(V.layers)&&wu(de,D,V,_e,Ne,Me)}}function wu(b,D,V,O,B,fe){b.onBeforeRender(I,D,V,O,B,fe),b.modelViewMatrix.multiplyMatrices(V.matrixWorldInverse,b.matrixWorld),b.normalMatrix.getNormalMatrix(b.modelViewMatrix),B.onBeforeRender(I,D,V,O,b,fe),B.transparent===!0&&B.side===Pn&&B.forceSinglePass===!1?(B.side=qt,B.needsUpdate=!0,I.renderBufferDirect(V,D,O,B,b,fe),B.side=Xn,B.needsUpdate=!0,I.renderBufferDirect(V,D,O,B,b,fe),B.side=Pn):I.renderBufferDirect(V,D,O,B,b,fe),b.onAfterRender(I,D,V,O,B,fe)}function ks(b,D,V){D.isScene!==!0&&(D=Lt);let O=z.get(b),B=E.state.lights,fe=E.state.shadowsArray,ge=B.state.version,de=oe.getParameters(b,B.state,fe,D,V,E.state.lightProbeGridArray),_e=oe.getProgramCacheKey(de),Me=O.programs;O.environment=b.isMeshStandardMaterial||b.isMeshLambertMaterial||b.isMeshPhongMaterial?D.environment:null,O.fog=D.fog;let Ne=b.isMeshStandardMaterial||b.isMeshLambertMaterial&&!b.envMap||b.isMeshPhongMaterial&&!b.envMap;O.envMap=ne.get(b.envMap||O.environment,Ne),O.envMapRotation=O.environment!==null&&b.envMap===null?D.environmentRotation:b.envMapRotation,Me===void 0&&(b.addEventListener("dispose",Mn),Me=new Map,O.programs=Me);let Oe=Me.get(_e);if(Oe!==void 0){if(O.currentProgram===Oe&&O.lightsStateVersion===ge)return Tu(b,de),Oe}else de.uniforms=oe.getUniforms(b),U!==null&&b.isNodeMaterial&&U.build(b,V,de),b.onBeforeCompile(de,I),Oe=oe.acquireProgram(de,_e),Me.set(_e,Oe),O.uniforms=de.uniforms;let Se=O.uniforms;return(!b.isShaderMaterial&&!b.isRawShaderMaterial||b.clipping===!0)&&(Se.clippingPlanes=we.uniform),Tu(b,de),O.needsLights=hp(b),O.lightsStateVersion=ge,O.needsLights&&(Se.ambientLightColor.value=B.state.ambient,Se.lightProbe.value=B.state.probe,Se.directionalLights.value=B.state.directional,Se.directionalLightShadows.value=B.state.directionalShadow,Se.spotLights.value=B.state.spot,Se.spotLightShadows.value=B.state.spotShadow,Se.rectAreaLights.value=B.state.rectArea,Se.ltc_1.value=B.state.rectAreaLTC1,Se.ltc_2.value=B.state.rectAreaLTC2,Se.pointLights.value=B.state.point,Se.pointLightShadows.value=B.state.pointShadow,Se.hemisphereLights.value=B.state.hemi,Se.directionalShadowMatrix.value=B.state.directionalShadowMatrix,Se.spotLightMatrix.value=B.state.spotLightMatrix,Se.spotLightMap.value=B.state.spotLightMap,Se.pointShadowMatrix.value=B.state.pointShadowMatrix),O.lightProbeGrid=E.state.lightProbeGridArray.length>0,O.currentProgram=Oe,O.uniformsList=null,Oe}function Eu(b){if(b.uniformsList===null){let D=b.currentProgram.getUniforms();b.uniformsList=Sr.seqWithValue(D.seq,b.uniforms)}return b.uniformsList}function Tu(b,D){let V=z.get(b);V.outputColorSpace=D.outputColorSpace,V.batching=D.batching,V.batchingColor=D.batchingColor,V.instancing=D.instancing,V.instancingColor=D.instancingColor,V.instancingMorph=D.instancingMorph,V.skinning=D.skinning,V.morphTargets=D.morphTargets,V.morphNormals=D.morphNormals,V.morphColors=D.morphColors,V.morphTargetsCount=D.morphTargetsCount,V.numClippingPlanes=D.numClippingPlanes,V.numIntersection=D.numClipIntersection,V.vertexAlphas=D.vertexAlphas,V.vertexTangents=D.vertexTangents,V.toneMapping=D.toneMapping}function lp(b,D){if(b.length===0)return null;if(b.length===1)return b[0].texture!==null?b[0]:null;v.setFromMatrixPosition(D.matrixWorld);for(let V=0,O=b.length;V<O;V++){let B=b[V];if(B.texture!==null&&B.boundingBox.containsPoint(v))return B}return null}function cp(b,D,V,O,B){D.isScene!==!0&&(D=Lt),W.resetTextureUnits();let fe=D.fog,ge=O.isMeshStandardMaterial||O.isMeshLambertMaterial||O.isMeshPhongMaterial?D.environment:null,de=K===null?I.outputColorSpace:K.isXRRenderTarget===!0?K.texture.colorSpace:ze.workingColorSpace,_e=O.isMeshStandardMaterial||O.isMeshLambertMaterial&&!O.envMap||O.isMeshPhongMaterial&&!O.envMap,Me=ne.get(O.envMap||ge,_e),Ne=O.vertexColors===!0&&!!V.attributes.color&&V.attributes.color.itemSize===4,Oe=!!V.attributes.tangent&&(!!O.normalMap||O.anisotropy>0),Se=!!V.morphAttributes.position,Je=!!V.morphAttributes.normal,pt=!!V.morphAttributes.color,ct=xn;O.toneMapped&&(K===null||K.isXRRenderTarget===!0)&&(ct=I.toneMapping);let Qe=V.morphAttributes.position||V.morphAttributes.normal||V.morphAttributes.color,Bt=Qe!==void 0?Qe.length:0,me=z.get(O),jt=E.state.lights;if(qe===!0&&(Ge===!0||b!==ee)){let nt=b===ee&&O.id===Q;we.setState(O,b,nt)}let He=!1;O.version===me.__version?(me.needsLights&&me.lightsStateVersion!==jt.state.version||me.outputColorSpace!==de||B.isBatchedMesh&&me.batching===!1||!B.isBatchedMesh&&me.batching===!0||B.isBatchedMesh&&me.batchingColor===!0&&B.colorTexture===null||B.isBatchedMesh&&me.batchingColor===!1&&B.colorTexture!==null||B.isInstancedMesh&&me.instancing===!1||!B.isInstancedMesh&&me.instancing===!0||B.isSkinnedMesh&&me.skinning===!1||!B.isSkinnedMesh&&me.skinning===!0||B.isInstancedMesh&&me.instancingColor===!0&&B.instanceColor===null||B.isInstancedMesh&&me.instancingColor===!1&&B.instanceColor!==null||B.isInstancedMesh&&me.instancingMorph===!0&&B.morphTexture===null||B.isInstancedMesh&&me.instancingMorph===!1&&B.morphTexture!==null||me.envMap!==Me||O.fog===!0&&me.fog!==fe||me.numClippingPlanes!==void 0&&(me.numClippingPlanes!==we.numPlanes||me.numIntersection!==we.numIntersection)||me.vertexAlphas!==Ne||me.vertexTangents!==Oe||me.morphTargets!==Se||me.morphNormals!==Je||me.morphColors!==pt||me.toneMapping!==ct||me.morphTargetsCount!==Bt||!!me.lightProbeGrid!=E.state.lightProbeGridArray.length>0)&&(He=!0):(He=!0,me.__version=O.version);let an=me.currentProgram;He===!0&&(an=ks(O,D,B),U&&O.isNodeMaterial&&U.onUpdateProgram(O,an,me));let Sn=!1,ii=!1,Ji=!1,et=an.getUniforms(),mt=me.uniforms;if(y.useProgram(an.program)&&(Sn=!0,ii=!0,Ji=!0),O.id!==Q&&(Q=O.id,ii=!0),me.needsLights){let nt=lp(E.state.lightProbeGridArray,B);me.lightProbeGrid!==nt&&(me.lightProbeGrid=nt,ii=!0)}if(Sn||ee!==b){y.buffers.depth.getReversed()&&b.reversedDepth!==!0&&(b._reversedDepth=!0,b.updateProjectionMatrix()),et.setValue(L,"projectionMatrix",b.projectionMatrix),et.setValue(L,"viewMatrix",b.matrixWorldInverse);let si=et.map.cameraPosition;si!==void 0&&si.setValue(L,Mt.setFromMatrixPosition(b.matrixWorld)),T.logarithmicDepthBuffer&&et.setValue(L,"logDepthBufFC",2/(Math.log(b.far+1)/Math.LN2)),(O.isMeshPhongMaterial||O.isMeshToonMaterial||O.isMeshLambertMaterial||O.isMeshBasicMaterial||O.isMeshStandardMaterial||O.isShaderMaterial)&&et.setValue(L,"isOrthographic",b.isOrthographicCamera===!0),ee!==b&&(ee=b,ii=!0,Ji=!0)}if(me.needsLights&&(jt.state.directionalShadowMap.length>0&&et.setValue(L,"directionalShadowMap",jt.state.directionalShadowMap,W),jt.state.spotShadowMap.length>0&&et.setValue(L,"spotShadowMap",jt.state.spotShadowMap,W),jt.state.pointShadowMap.length>0&&et.setValue(L,"pointShadowMap",jt.state.pointShadowMap,W)),B.isSkinnedMesh){et.setOptional(L,B,"bindMatrix"),et.setOptional(L,B,"bindMatrixInverse");let nt=B.skeleton;nt&&(nt.boneTexture===null&&nt.computeBoneTexture(),et.setValue(L,"boneTexture",nt.boneTexture,W))}B.isBatchedMesh&&(et.setOptional(L,B,"batchingTexture"),et.setValue(L,"batchingTexture",B._matricesTexture,W),et.setOptional(L,B,"batchingIdTexture"),et.setValue(L,"batchingIdTexture",B._indirectTexture,W),et.setOptional(L,B,"batchingColorTexture"),B._colorsTexture!==null&&et.setValue(L,"batchingColorTexture",B._colorsTexture,W));let ri=V.morphAttributes;if((ri.position!==void 0||ri.normal!==void 0||ri.color!==void 0)&&P.update(B,V,an),(ii||me.receiveShadow!==B.receiveShadow)&&(me.receiveShadow=B.receiveShadow,et.setValue(L,"receiveShadow",B.receiveShadow)),(O.isMeshStandardMaterial||O.isMeshLambertMaterial||O.isMeshPhongMaterial)&&O.envMap===null&&D.environment!==null&&(mt.envMapIntensity.value=D.environmentIntensity),mt.dfgLUT!==void 0&&(mt.dfgLUT.value=Ly()),ii){if(et.setValue(L,"toneMappingExposure",I.toneMappingExposure),me.needsLights&&up(mt,Ji),fe&&O.fog===!0&&be.refreshFogUniforms(mt,fe),be.refreshMaterialUniforms(mt,O,te,re,E.state.transmissionRenderTarget[b.id]),me.needsLights&&me.lightProbeGrid){let nt=me.lightProbeGrid;mt.probesSH.value=nt.texture,mt.probesMin.value.copy(nt.boundingBox.min),mt.probesMax.value.copy(nt.boundingBox.max),mt.probesResolution.value.copy(nt.resolution)}Sr.upload(L,Eu(me),mt,W)}if(O.isShaderMaterial&&O.uniformsNeedUpdate===!0&&(Sr.upload(L,Eu(me),mt,W),O.uniformsNeedUpdate=!1),O.isSpriteMaterial&&et.setValue(L,"center",B.center),et.setValue(L,"modelViewMatrix",B.modelViewMatrix),et.setValue(L,"normalMatrix",B.normalMatrix),et.setValue(L,"modelMatrix",B.matrixWorld),O.uniformsGroups!==void 0){let nt=O.uniformsGroups;for(let si=0,Ki=nt.length;si<Ki;si++){let Au=nt[si];j.update(Au,an),j.bind(Au,an)}}return an}function up(b,D){b.ambientLightColor.needsUpdate=D,b.lightProbe.needsUpdate=D,b.directionalLights.needsUpdate=D,b.directionalLightShadows.needsUpdate=D,b.pointLights.needsUpdate=D,b.pointLightShadows.needsUpdate=D,b.spotLights.needsUpdate=D,b.spotLightShadows.needsUpdate=D,b.rectAreaLights.needsUpdate=D,b.hemisphereLights.needsUpdate=D}function hp(b){return b.isMeshLambertMaterial||b.isMeshToonMaterial||b.isMeshPhongMaterial||b.isMeshStandardMaterial||b.isShadowMaterial||b.isShaderMaterial&&b.lights===!0}this.getActiveCubeFace=function(){return G},this.getActiveMipmapLevel=function(){return H},this.getRenderTarget=function(){return K},this.setRenderTargetTextures=function(b,D,V){let O=z.get(b);O.__autoAllocateDepthBuffer=b.resolveDepthBuffer===!1,O.__autoAllocateDepthBuffer===!1&&(O.__useRenderToTexture=!1),z.get(b.texture).__webglTexture=D,z.get(b.depthTexture).__webglTexture=O.__autoAllocateDepthBuffer?void 0:V,O.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(b,D){let V=z.get(b);V.__webglFramebuffer=D,V.__useDefaultFramebuffer=D===void 0},this.setRenderTarget=function(b,D=0,V=0){K=b,G=D,H=V;let O=null,B=!1,fe=!1;if(b){let de=z.get(b);if(de.__useDefaultFramebuffer!==void 0){y.bindFramebuffer(L.FRAMEBUFFER,de.__webglFramebuffer),ce.copy(b.viewport),xe.copy(b.scissor),We=b.scissorTest,y.viewport(ce),y.scissor(xe),y.setScissorTest(We),Q=-1;return}else if(de.__webglFramebuffer===void 0)W.setupRenderTarget(b);else if(de.__hasExternalTextures)W.rebindTextures(b,z.get(b.texture).__webglTexture,z.get(b.depthTexture).__webglTexture);else if(b.depthBuffer){let Ne=b.depthTexture;if(de.__boundDepthTexture!==Ne){if(Ne!==null&&z.has(Ne)&&(b.width!==Ne.image.width||b.height!==Ne.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");W.setupDepthRenderbuffer(b)}}let _e=b.texture;(_e.isData3DTexture||_e.isDataArrayTexture||_e.isCompressedArrayTexture)&&(fe=!0);let Me=z.get(b).__webglFramebuffer;b.isWebGLCubeRenderTarget?(Array.isArray(Me[D])?O=Me[D][V]:O=Me[D],B=!0):b.samples>0&&W.useMultisampledRTT(b)===!1?O=z.get(b).__webglMultisampledFramebuffer:Array.isArray(Me)?O=Me[V]:O=Me,ce.copy(b.viewport),xe.copy(b.scissor),We=b.scissorTest}else ce.copy(Ee).multiplyScalar(te).floor(),xe.copy(ft).multiplyScalar(te).floor(),We=ke;if(V!==0&&(O=X),y.bindFramebuffer(L.FRAMEBUFFER,O)&&y.drawBuffers(b,O),y.viewport(ce),y.scissor(xe),y.setScissorTest(We),B){let de=z.get(b.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_CUBE_MAP_POSITIVE_X+D,de.__webglTexture,V)}else if(fe){let de=D;for(let _e=0;_e<b.textures.length;_e++){let Me=z.get(b.textures[_e]);L.framebufferTextureLayer(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0+_e,Me.__webglTexture,V,de)}}else if(b!==null&&V!==0){let de=z.get(b.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,de.__webglTexture,V)}Q=-1},this.readRenderTargetPixels=function(b,D,V,O,B,fe,ge,de=0){if(!(b&&b.isWebGLRenderTarget)){Re("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let _e=z.get(b).__webglFramebuffer;if(b.isWebGLCubeRenderTarget&&ge!==void 0&&(_e=_e[ge]),_e){y.bindFramebuffer(L.FRAMEBUFFER,_e);try{let Me=b.textures[de],Ne=Me.format,Oe=Me.type;if(b.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+de),!T.textureFormatReadable(Ne)){Re("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!T.textureTypeReadable(Oe)){Re("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}D>=0&&D<=b.width-O&&V>=0&&V<=b.height-B&&L.readPixels(D,V,O,B,le.convert(Ne),le.convert(Oe),fe)}finally{let Me=K!==null?z.get(K).__webglFramebuffer:null;y.bindFramebuffer(L.FRAMEBUFFER,Me)}}},this.readRenderTargetPixelsAsync=async function(b,D,V,O,B,fe,ge,de=0){if(!(b&&b.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let _e=z.get(b).__webglFramebuffer;if(b.isWebGLCubeRenderTarget&&ge!==void 0&&(_e=_e[ge]),_e)if(D>=0&&D<=b.width-O&&V>=0&&V<=b.height-B){y.bindFramebuffer(L.FRAMEBUFFER,_e);let Me=b.textures[de],Ne=Me.format,Oe=Me.type;if(b.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+de),!T.textureFormatReadable(Ne))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!T.textureTypeReadable(Oe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Se=L.createBuffer();L.bindBuffer(L.PIXEL_PACK_BUFFER,Se),L.bufferData(L.PIXEL_PACK_BUFFER,fe.byteLength,L.STREAM_READ),L.readPixels(D,V,O,B,le.convert(Ne),le.convert(Oe),0);let Je=K!==null?z.get(K).__webglFramebuffer:null;y.bindFramebuffer(L.FRAMEBUFFER,Je);let pt=L.fenceSync(L.SYNC_GPU_COMMANDS_COMPLETE,0);return L.flush(),await Rh(L,pt,4),L.bindBuffer(L.PIXEL_PACK_BUFFER,Se),L.getBufferSubData(L.PIXEL_PACK_BUFFER,0,fe),L.deleteBuffer(Se),L.deleteSync(pt),fe}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(b,D=null,V=0){let O=Math.pow(2,-V),B=Math.floor(b.image.width*O),fe=Math.floor(b.image.height*O),ge=D!==null?D.x:0,de=D!==null?D.y:0;W.setTexture2D(b,0),L.copyTexSubImage2D(L.TEXTURE_2D,V,0,0,ge,de,B,fe),y.unbindTexture()},this.copyTextureToTexture=function(b,D,V=null,O=null,B=0,fe=0){let ge,de,_e,Me,Ne,Oe,Se,Je,pt,ct=b.isCompressedTexture?b.mipmaps[fe]:b.image;if(V!==null)ge=V.max.x-V.min.x,de=V.max.y-V.min.y,_e=V.isBox3?V.max.z-V.min.z:1,Me=V.min.x,Ne=V.min.y,Oe=V.isBox3?V.min.z:0;else{let mt=Math.pow(2,-B);ge=Math.floor(ct.width*mt),de=Math.floor(ct.height*mt),b.isDataArrayTexture?_e=ct.depth:b.isData3DTexture?_e=Math.floor(ct.depth*mt):_e=1,Me=0,Ne=0,Oe=0}O!==null?(Se=O.x,Je=O.y,pt=O.z):(Se=0,Je=0,pt=0);let Qe=le.convert(D.format),Bt=le.convert(D.type),me;D.isData3DTexture?(W.setTexture3D(D,0),me=L.TEXTURE_3D):D.isDataArrayTexture||D.isCompressedArrayTexture?(W.setTexture2DArray(D,0),me=L.TEXTURE_2D_ARRAY):(W.setTexture2D(D,0),me=L.TEXTURE_2D),y.activeTexture(L.TEXTURE0),y.pixelStorei(L.UNPACK_FLIP_Y_WEBGL,D.flipY),y.pixelStorei(L.UNPACK_PREMULTIPLY_ALPHA_WEBGL,D.premultiplyAlpha),y.pixelStorei(L.UNPACK_ALIGNMENT,D.unpackAlignment);let jt=y.getParameter(L.UNPACK_ROW_LENGTH),He=y.getParameter(L.UNPACK_IMAGE_HEIGHT),an=y.getParameter(L.UNPACK_SKIP_PIXELS),Sn=y.getParameter(L.UNPACK_SKIP_ROWS),ii=y.getParameter(L.UNPACK_SKIP_IMAGES);y.pixelStorei(L.UNPACK_ROW_LENGTH,ct.width),y.pixelStorei(L.UNPACK_IMAGE_HEIGHT,ct.height),y.pixelStorei(L.UNPACK_SKIP_PIXELS,Me),y.pixelStorei(L.UNPACK_SKIP_ROWS,Ne),y.pixelStorei(L.UNPACK_SKIP_IMAGES,Oe);let Ji=b.isDataArrayTexture||b.isData3DTexture,et=D.isDataArrayTexture||D.isData3DTexture;if(b.isDepthTexture){let mt=z.get(b),ri=z.get(D),nt=z.get(mt.__renderTarget),si=z.get(ri.__renderTarget);y.bindFramebuffer(L.READ_FRAMEBUFFER,nt.__webglFramebuffer),y.bindFramebuffer(L.DRAW_FRAMEBUFFER,si.__webglFramebuffer);for(let Ki=0;Ki<_e;Ki++)Ji&&(L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,z.get(b).__webglTexture,B,Oe+Ki),L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,z.get(D).__webglTexture,fe,pt+Ki)),L.blitFramebuffer(Me,Ne,ge,de,Se,Je,ge,de,L.DEPTH_BUFFER_BIT,L.NEAREST);y.bindFramebuffer(L.READ_FRAMEBUFFER,null),y.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else if(B!==0||b.isRenderTargetTexture||z.has(b)){let mt=z.get(b),ri=z.get(D);y.bindFramebuffer(L.READ_FRAMEBUFFER,Y),y.bindFramebuffer(L.DRAW_FRAMEBUFFER,N);for(let nt=0;nt<_e;nt++)Ji?L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,mt.__webglTexture,B,Oe+nt):L.framebufferTexture2D(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,mt.__webglTexture,B),et?L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,ri.__webglTexture,fe,pt+nt):L.framebufferTexture2D(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,ri.__webglTexture,fe),B!==0?L.blitFramebuffer(Me,Ne,ge,de,Se,Je,ge,de,L.COLOR_BUFFER_BIT,L.NEAREST):et?L.copyTexSubImage3D(me,fe,Se,Je,pt+nt,Me,Ne,ge,de):L.copyTexSubImage2D(me,fe,Se,Je,Me,Ne,ge,de);y.bindFramebuffer(L.READ_FRAMEBUFFER,null),y.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else et?b.isDataTexture||b.isData3DTexture?L.texSubImage3D(me,fe,Se,Je,pt,ge,de,_e,Qe,Bt,ct.data):D.isCompressedArrayTexture?L.compressedTexSubImage3D(me,fe,Se,Je,pt,ge,de,_e,Qe,ct.data):L.texSubImage3D(me,fe,Se,Je,pt,ge,de,_e,Qe,Bt,ct):b.isDataTexture?L.texSubImage2D(L.TEXTURE_2D,fe,Se,Je,ge,de,Qe,Bt,ct.data):b.isCompressedTexture?L.compressedTexSubImage2D(L.TEXTURE_2D,fe,Se,Je,ct.width,ct.height,Qe,ct.data):L.texSubImage2D(L.TEXTURE_2D,fe,Se,Je,ge,de,Qe,Bt,ct);y.pixelStorei(L.UNPACK_ROW_LENGTH,jt),y.pixelStorei(L.UNPACK_IMAGE_HEIGHT,He),y.pixelStorei(L.UNPACK_SKIP_PIXELS,an),y.pixelStorei(L.UNPACK_SKIP_ROWS,Sn),y.pixelStorei(L.UNPACK_SKIP_IMAGES,ii),fe===0&&D.generateMipmaps&&L.generateMipmap(me),y.unbindTexture()},this.initRenderTarget=function(b){z.get(b).__webglFramebuffer===void 0&&W.setupRenderTarget(b)},this.initTexture=function(b){b.isCubeTexture?W.setTextureCube(b,0):b.isData3DTexture?W.setTexture3D(b,0):b.isDataArrayTexture||b.isCompressedArrayTexture?W.setTexture2DArray(b,0):W.setTexture2D(b,0),y.unbindTexture()},this.resetState=function(){G=0,H=0,K=null,y.reset(),pe.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return gn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=ze._getDrawingBufferColorSpace(e),t.unpackColorSpace=ze._getUnpackColorSpace()}};var gs={lng:4.9,lat:52.37},ld=111320*Math.cos(gs.lat*Math.PI/180),cd=110540,_t=(n,e)=>[(n-gs.lng)*ld,(e-gs.lat)*cd],Un=(n,e)=>[gs.lng+n/ld,gs.lat+e/cd];var Pc=["major","secondary","tertiary","minor","service","cycle","path"];var Dy=["green","wood","wetland","sport","cemetery","allotments","farmland","industrial","construction","sand"];var Ny=["rail","light_rail","subway","tram","narrow_gauge","monorail","funicular"],Fy=1,Uy=2,Oy=4;function Kn(n,e,t=0){let i=[],r=0,s=0;for(let o=t;o+1<n.length;o+=2)r+=n[o],s+=n[o+1],i.push([r*e,s*e]);return i}function ud(n){if(n.version!==1&&n.version!==2)throw new Error(`own-map overview: unsupported version ${n.version}`);let e=n.unit,t=i=>i>=0?n.names[i]??"":"";return{bounds:n.bounds,water:n.water.map(i=>i.map(r=>Kn(r,e))),parks:n.parks.map(([i,...r])=>({name:t(i),rings:r.map(s=>Kn(s,e))})),streets:n.streets.map(i=>({cls:Pc[i[0]],name:t(i[1]),points:Kn(i,e,2)})),waterLines:n.waterLines.map(i=>({name:t(i[0]),points:Kn(i,e,1)})),hoods:n.hoods.map(([i,r,s])=>({name:t(i),at:[r*e,s*e]})),landuse:(n.landuse??[]).map(([[i],...r])=>({cls:Dy[i],rings:r.map(s=>Kn(s,e))})),rail:(n.rail??[]).map(i=>({kind:Ny[i[0]],tunnel:!!(i[1]&Fy),bridge:!!(i[1]&Uy),service:!!(i[1]&Oy),points:Kn(i,e,2)})),piers:(n.piers??[]).map(i=>Kn(i,e)),pierLines:(n.pierLines??[]).map(i=>Kn(i,e)),hoodRings:(n.hoodRings??[]).map(i=>Kn(i,e))}}var By=63710088e-1,ky=36.86989764584402,Dc=85;function zy(n,e){return 2*Math.PI*By*Math.cos(e*Math.PI/180)/(512*2**n)}var dd=(n,e)=>[n[0]-e[0],n[1]-e[1],n[2]-e[2]],Ic=(n,e)=>n[0]*e[0]+n[1]*e[1]+n[2]*e[2],hd=(n,e)=>[n[1]*e[2]-n[2]*e[1],n[2]*e[0]-n[0]*e[2],n[0]*e[1]-n[1]*e[0]],Lc=n=>{let e=Math.hypot(n[0],n[1],n[2])||1;return[n[0]/e,n[1]/e,n[2]/e]};function un(n,e){let t=(n.fovDeg??ky)*Math.PI/180,i=Un(n.center[0],n.center[1])[1],r=zy(n.zoom,i),s=.5*e.height/Math.tan(t/2),o=s*r,a=Math.min(Dc,Math.max(0,n.pitch))*Math.PI/180,c=n.bearing*Math.PI/180,l=[Math.sin(c),Math.cos(c),0],u=[n.center[0],n.center[1],0],f=[u[0]-l[0]*o*Math.sin(a),u[1]-l[1]*o*Math.sin(a),o*Math.cos(a)],h=Lc(dd(u,f)),m=Lc(hd(l,[0,0,1])),g=Lc(hd(m,h));return{eye:f,target:u,forward:h,right:m,up:g,focal:s,distance:o,mpp:r,viewport:e}}function jn(n,e){let t=dd([e[0],e[1],e[2]??0],n.eye),i=Ic(t,n.forward),r=n.focal/(i||1e-9);return{x:n.viewport.width/2+Ic(t,n.right)*r,y:n.viewport.height/2-Ic(t,n.up)*r,depth:i}}function sn(n,e,t,i=0){let r=(e-n.viewport.width/2)/n.focal,s=-(t-n.viewport.height/2)/n.focal,o=[n.forward[0]+n.right[0]*r+n.up[0]*s,n.forward[1]+n.right[1]*r+n.up[1]*s,n.forward[2]+n.right[2]*r+n.up[2]*s];if(o[2]>=-1e-9)return null;let a=(i-n.eye[2])/o[2];return a<=0?null:[n.eye[0]+o[0]*a,n.eye[1]+o[1]*a]}function Nc(n,e=2e4){let{width:t,height:i}=n.viewport,r=[];for(let[f,h]of[[0,0],[t,0],[0,i],[t,i],[t/2,0],[0,i/2],[t,i/2]]){let m=sn(n,f,h);for(let g=h;!m&&g<i;g+=i/16)m=sn(n,f,g);m&&r.push(m)}let s=n.target[0],o=n.target[1],a=s,c=o,l=s,u=o;for(let[f,h]of r){let m=Math.max(-e,Math.min(e,f-s)),g=Math.max(-e,Math.min(e,h-o));a=Math.min(a,s+m),l=Math.max(l,s+m),c=Math.min(c,o+g),u=Math.max(u,o+g)}return[a,c,l,u]}function Fc(n,e,t={}){let i={top:0,right:0,bottom:0,left:0,...t.padding},r=t.bearing??0,s=t.pitch??0,o=1/0,a=1/0,c=-1/0,l=-1/0;for(let[x,d]of n)o=Math.min(o,x),c=Math.max(c,x),a=Math.min(a,d),l=Math.max(l,d);let u=[(o+c)/2,(a+l)/2],f=x=>{let d=un({center:u,zoom:x,bearing:r,pitch:s,fovDeg:t.fovDeg},e);return n.every(p=>{let M=jn(d,p);return M.depth>0&&M.x>=i.left&&M.x<=e.width-i.right&&M.y>=i.top&&M.y<=e.height-i.bottom})},h=x=>{let d=un({center:u,zoom:x,bearing:r,pitch:s,fovDeg:t.fovDeg},e),p={x:(i.left+e.width-i.right)/2,y:(i.top+e.height-i.bottom)/2},M=sn(d,e.width/2,e.height/2),S=sn(d,p.x,p.y);M&&S&&(u=[u[0]-(S[0]-M[0]),u[1]-(S[1]-M[1])])},m=0,g=t.maxZoom??22;for(let x=0;x<2;x++){m=0,g=t.maxZoom??22;for(let d=0;d<40;d++){let p=(m+g)/2;f(p)?m=p:g=p}x===0&&h(m)}return{center:u,zoom:m,bearing:r,pitch:s,fovDeg:t.fovDeg}}var Vy=n=>n*n*(3-2*n),ka=(n,e,t)=>n+(e-n)*t,Gy=(n,e,t)=>n+(((e-n)%360+540)%360-180)*t;function Uc(n,e,t){let i=Vy(Math.max(0,Math.min(1,t))),r=ka(n.zoom,e.zoom,i),s=e.zoom-n.zoom,o=Math.abs(s)<1e-6?i:(1-2**-(r-n.zoom))/(1-2**-s);return{center:[ka(n.center[0],e.center[0],o),ka(n.center[1],e.center[1],o)],zoom:r,bearing:Gy(n.bearing,e.bearing,i),pitch:ka(n.pitch,e.pitch,i),fovDeg:e.fovDeg??n.fovDeg}}var xs={minZoom:9,maxZoom:20,maxPitch:70};function Hi(n,e=xs){let[t,i]=n.center;return e.bounds&&(t=Math.max(e.bounds[0],Math.min(e.bounds[2],t)),i=Math.max(e.bounds[1],Math.min(e.bounds[3],i))),{...n,center:[t,i],zoom:Math.max(e.minZoom,Math.min(e.maxZoom,n.zoom)),pitch:Math.max(0,Math.min(Math.min(e.maxPitch,Dc),n.pitch)),bearing:(n.bearing%360+540)%360-180}}function fd(n,e,t,i){let r=un(n,e),s=sn(r,t.x,t.y),o=sn(r,i.x,i.y);return!s||!o?n:{...n,center:[n.center[0]-(o[0]-s[0]),n.center[1]-(o[1]-s[1])]}}function pd(n,e,t,i,r=xs){let s=sn(un(n,e),i.x,i.y),o=Hi({...n,zoom:n.zoom+t},r),a=sn(un(o,e),i.x,i.y);return!s||!a?o:{...o,center:[o.center[0]+s[0]-a[0],o.center[1]+s[1]-a[1]]}}function md(n,e,t,i){let r=i??{x:e.width/2,y:e.height/2},s=sn(un(n,e),r.x,r.y),o={...n,bearing:n.bearing+t},a=sn(un(o,e),r.x,r.y);return!s||!a?o:{...o,center:[o.center[0]+s[0]-a[0],o.center[1]+s[1]-a[1]]}}function gd(n,e,t=xs){return Hi({...n,pitch:n.pitch+e},t)}function Hy(n,e,t,i,r=xs){let s=g=>({x:(g[0][0]+g[1][0])/2,y:(g[0][1]+g[1][1])/2}),o=g=>Math.hypot(g[1][0]-g[0][0],g[1][1]-g[0][1])||1,a=g=>Math.atan2(g[1][1]-g[0][1],g[1][0]-g[0][0]),c=s(t),l=s(i),u=i[0][1]-t[0][1],f=i[1][1]-t[1][1];if(Math.sign(u)===Math.sign(f)&&Math.abs(u)>2&&Math.abs(f)>2&&Math.abs(o(i)-o(t))<4&&Math.abs(i[0][0]-t[0][0])<Math.abs(u)*.5)return gd(n,-(u+f)/2*.4,r);let h=fd(n,e,c,l);h=pd(h,e,Math.log2(o(i)/o(t)),l,r);let m=(a(i)-a(t))*180/Math.PI;return m=(m+540)%360-180,Math.abs(m)>.3&&(h=md(h,e,-m,l)),h}var Wy=(n,e=0)=>-(e===1?n*40:n)/450;function xd(n,e,t,i=xs){let r=new Map,s=null,o=()=>({width:n.clientWidth,height:n.clientHeight}),a=m=>{let g=n.getBoundingClientRect();return[m.clientX-g.left,m.clientY-g.top]},c=m=>{n.setPointerCapture(m.pointerId),r.set(m.pointerId,a(m)),s=m.button===2||m.ctrlKey||m.metaKey?"rotate":"pan"},l=m=>{let g=r.get(m.pointerId);if(!g)return;let x=a(m);if(r.size>=2){let d=[...r.keys()].slice(0,2),p=[r.get(d[0]),r.get(d[1])];r.set(m.pointerId,x);let M=[r.get(d[0]),r.get(d[1])];t(Hi(Hy(e(),o(),p,M,i),i));return}if(r.set(m.pointerId,x),s==="rotate"){let d=md(e(),o(),(x[0]-g[0])*.4);d=gd(d,-(x[1]-g[1])*.3,i),t(Hi(d,i))}else t(Hi(fd(e(),o(),{x:g[0],y:g[1]},{x:x[0],y:x[1]}),i))},u=m=>{r.delete(m.pointerId),r.size||(s=null)},f=m=>{m.preventDefault();let[g,x]=a(m);t(pd(e(),o(),Wy(m.deltaY,m.deltaMode),{x:g,y:x},i))},h=m=>m.preventDefault();return n.addEventListener("pointerdown",c),n.addEventListener("pointermove",l),n.addEventListener("pointerup",u),n.addEventListener("pointercancel",u),n.addEventListener("wheel",f,{passive:!1}),n.addEventListener("contextmenu",h),n.style.touchAction="none",()=>{n.removeEventListener("pointerdown",c),n.removeEventListener("pointermove",l),n.removeEventListener("pointerup",u),n.removeEventListener("pointercancel",u),n.removeEventListener("wheel",f),n.removeEventListener("contextmenu",h)}}var bs=new Set,Oc=!1;function Qn(n,e,t=2){let i=e&&e.length,r=i?e[0]*t:n.length;bs.size&&bs.clear();let s=bd(n,0,r,t,!0),o=[];if(!s||s.next===s.prev)return o;let a=0,c=0,l=0;if(i&&(s=$y(n,e,s,t)),n.length>80*t){a=n[0],c=n[1];let u=a,f=c;for(let h=t;h<r;h+=t){let m=n[h],g=n[h+1];m<a&&(a=m),g<c&&(c=g),m>u&&(u=m),g>f&&(f=g)}l=Math.max(u-a,f-c),l=l!==0?32767/l:0}return Bc(s,o,a,c,l),o}function bd(n,e,t,i,r){let s=null;if(r===l_(n,e,t,i)>0)for(let o=e;o<t;o+=i)s=vd(o/i|0,n[o],n[o+1],s);else for(let o=t-i;o>=e;o-=i)s=vd(o/i|0,n[o],n[o+1],s);return s&&Ms(s,s.next)&&(ws(s),s=s.next),s}function Xi(n,e=n){let t=e===n,i=n,r;do r=!1,i!==i.next&&(bs.size===0||!bs.has(i))&&(Ms(i,i.next)||vt(i.prev,i,i.next)===0)?((t||i===e)&&(e=i.prev),Oc=!0,ws(i),i=i.prev,r=!0):(t||i!==e)&&(i=i.next,r=!t);while(r||i!==e);return e}function Bc(n,e,t,i,r){r&&n_(n,t,i,r);let s=n,o=!1;for(;n.prev!==n.next;){let a=n.prev,c=n.next;if(vt(a,n,c)<0&&(r?qy(n,t,i,r):Xy(n))){e.push(a.i,n.i,c.i),ws(n),n=c,s=c;continue}if(n=c,n===s){if(Oc=!1,n=Xi(n),Oc){s=n;continue}if(!o){n=Yy(n,e),s=n,o=!0;continue}Zy(n,e,t,i,r);break}}}function Xy(n){let e=n.prev,t=n,i=n.next,r=e.x,s=t.x,o=i.x,a=e.y,c=t.y,l=i.y,u=Math.min(r,s,o),f=Math.min(a,c,l),h=Math.max(r,s,o),m=Math.max(a,c,l),g=i.next;for(;g!==e;){if(g.x>=u&&g.x<=h&&g.y>=f&&g.y<=m&&!(r===g.x&&a===g.y)&&Ha(r,a,s,c,o,l,g.x,g.y)&&vt(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function qy(n,e,t,i){let r=n.prev,s=n,o=n.next,a=r.x,c=s.x,l=o.x,u=r.y,f=s.y,h=o.y,m=Math.min(a,c,l),g=Math.min(u,f,h),x=Math.max(a,c,l),d=Math.max(u,f,h),p=Gc(m,g,e,t,i),M=Gc(x,d,e,t,i),S=n.prevZ;for(;S&&S.z>=p;){if(S.x>=m&&S.x<=x&&S.y>=g&&S.y<=d&&S!==o&&!(a===S.x&&u===S.y)&&Ha(a,u,c,f,l,h,S.x,S.y)&&vt(S.prev,S,S.next)>=0)return!1;S=S.prevZ}let v=n.nextZ;for(;v&&v.z<=M;){if(v.x>=m&&v.x<=x&&v.y>=g&&v.y<=d&&v!==o&&!(a===v.x&&u===v.y)&&Ha(a,u,c,f,l,h,v.x,v.y)&&vt(v.prev,v,v.next)>=0)return!1;v=v.nextZ}return!0}function Yy(n,e){let t=n,i=!1;do{let r=t.prev,s=t.next.next;wd(r,t,t.next,s,!1)&&Ss(r,s)&&Ss(s,r)&&(e.push(r.i,t.i,s.i),ws(t),ws(t.next),t=n=s,i=!0),t=t.next}while(t!==n);return i?Xi(t):t}function Zy(n,e,t,i,r){let s=n;do{let o=s.next.next;for(;o!==s.prev;){if(s.i!==o.i&&s_(s,o)){let a=Ed(s,o);s=Xi(s,s.next),a=Xi(a,a.next),Bc(s,e,t,i,r),Bc(a,e,t,i,r);return}o=o.next}s=s.next}while(s!==n)}var kc=!1;function $y(n,e,t,i){let r=[];for(let s=0,o=e.length;s<o;s++){let a=e[s]*i,c=s<o-1?e[s+1]*i:n.length,l=bd(n,a,c,i,!1);l===l.next&&bs.add(l),r.push(r_(l))}r.sort(Jy),jy(n.length/i,e.length),Sd(t,t),kc=!0;for(let s=0;s<r.length;s++)t=Ky(r[s],t);return kc=!1,Xi(t)}function Jy(n,e){return n.x-e.x||n.y-e.y||(n.next.y-n.y)/(n.next.x-n.x)-(e.next.y-e.y)/(e.next.x-e.x)}function Ky(n,e){let t=e_(n,e);if(!t)return e;let i=Ed(t,n),r=i.next;return Sd(t,r.next),Xi(i,i.next),Xi(t,t.next)}var Md=16,ht=new Float64Array(0),Ga=0,zc=[],Vc=[];function jy(n,e){let t=Math.ceil((n+2*e)/Md)+e+2;ht.length<t*4&&(ht=new Float64Array(t*4)),Ga=0}function Sd(n,e){let t=n;do{let i=Ga++;zc[i]=t;let r=1/0,s=1/0,o=-1/0,a=-1/0,c=0;do{let u=t.next;t.z=i,t.x<r&&(r=t.x),t.x>o&&(o=t.x),t.y<s&&(s=t.y),t.y>a&&(a=t.y),u.x<r&&(r=u.x),u.x>o&&(o=u.x),u.y<s&&(s=u.y),u.y>a&&(a=u.y),t=u}while(++c<Md&&t!==e);Vc[i]=t;let l=i*4;ht[l]=r,ht[l+1]=s,ht[l+2]=o,ht[l+3]=a}while(t!==e)}function Qy(n,e){let t=n.z*4;e.x<ht[t]&&(ht[t]=e.x),e.y<ht[t+1]&&(ht[t+1]=e.y),e.x>ht[t+2]&&(ht[t+2]=e.x),e.y>ht[t+3]&&(ht[t+3]=e.y)}function yd(n){let e=Vc[n];for(;e.prev.next!==e;)e=e.next;return Vc[n]=e,e}function _d(n){let e=zc[n];for(;e.prev.next!==e;)e=e.next;return zc[n]=e,e}function e_(n,e){let t=e,i=n.x,r=n.y,s=-1/0,o;if(Ms(n,t))return t;for(let h=0,m=0;h<Ga;h++,m+=4){if(r<ht[m+1]||r>ht[m+3]||ht[m]>i||ht[m+2]<=s)continue;let g=yd(h);t=_d(h);do{if(t.prev.next===t){if(Ms(n,t.next))return t.next;if(r<=t.y&&r>=t.next.y&&t.next.y!==t.y){let x=t.x+(r-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(x<=i&&x>s&&(s=x,o=t.x<t.next.x?t:t.next,x===i))return o}}t=t.next}while(t!==g)}if(!o)return null;let a=o.x,c=o.y,l=Math.min(r,c),u=Math.max(r,c),f=1/0;for(let h=0,m=0;h<Ga;h++,m+=4){if(ht[m+2]<a||ht[m]>i||ht[m+3]<l||ht[m+1]>u)continue;let g=yd(h);t=_d(h);do{if(t.prev.next===t&&i>=t.x&&t.x>=a&&i!==t.x&&Ha(r<c?i:s,r,a,c,r<c?s:i,r,t.x,t.y)){let x=Math.abs(r-t.y)/(i-t.x);(Ss(t,n)||t.y===r&&t.next.y===r&&t.next.x>i)&&(x<f||x===f&&(t.x>o.x||t.x===o.x&&t_(o,t)))&&(o=t,f=x)}t=t.next}while(t!==g)}return o}function t_(n,e){return vt(n.prev,n,e.prev)<0&&vt(e.next,n,n.next)<0}var hn=[],ys=[],Wi=new Uint32Array(0),_s=new Uint32Array(0),vs=new Uint32Array(256);function n_(n,e,t,i){let r=n,s=0;do r.z=Gc(r.x,r.y,e,t,i),hn[s++]=r,r=r.next;while(r!==n);i_(s);let o=null;for(let a=0;a<s;a++){let c=hn[a];c.prevZ=o,o&&(o.nextZ=c),o=c}o.nextZ=null}function i_(n){if(n<=32){for(let e=1;e<n;e++){let t=hn[e],i=t.z,r=e-1;for(;r>=0&&hn[r].z>i;)hn[r+1]=hn[r],r--;hn[r+1]=t}return}Wi.length<n&&(Wi=new Uint32Array(n),_s=new Uint32Array(n),ys=new Array(n));for(let e=0;e<n;e++)Wi[e]=hn[e].z;za(n,hn,Wi,ys,_s,0),za(n,ys,_s,hn,Wi,8),za(n,hn,Wi,ys,_s,16),za(n,ys,_s,hn,Wi,24)}function za(n,e,t,i,r,s){vs.fill(0);for(let a=0;a<n;a++)vs[t[a]>>>s&255]++;let o=0;for(let a=0;a<256;a++){let c=vs[a];vs[a]=o,o+=c}for(let a=0;a<n;a++){let c=t[a],l=vs[c>>>s&255]++;i[l]=e[a],r[l]=c}}function Gc(n,e,t,i,r){return n=(n-t)*r|0,e=(e-i)*r|0,n=(n|n<<8)&16711935,n=(n|n<<4)&252645135,n=(n|n<<2)&858993459,n=(n|n<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,n|e<<1}function r_(n){let e=n,t=n;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==n);return t}function Ha(n,e,t,i,r,s,o,a){return(r-o)*(e-a)>=(n-o)*(s-a)&&(n-o)*(i-a)>=(t-o)*(e-a)&&(t-o)*(s-a)>=(r-o)*(i-a)}function s_(n,e){let t=Ms(n,e)&&vt(n.prev,n,n.next)>0&&vt(e.prev,e,e.next)>0;return n.next.i!==e.i&&(t||Ss(n,e)&&Ss(e,n)&&(vt(n.prev,n,e.prev)!==0||vt(n,e.prev,e)!==0))&&!o_(n,e)&&(t||a_(n,e))}function vt(n,e,t){return(e.y-n.y)*(t.x-e.x)-(e.x-n.x)*(t.y-e.y)}function Ms(n,e){return n.x===e.x&&n.y===e.y}function wd(n,e,t,i,r=!0){let s=vt(n,e,t),o=vt(n,e,i),a=vt(t,i,n),c=vt(t,i,e);return(s>0&&o<0||s<0&&o>0)&&(a>0&&c<0||a<0&&c>0)?!0:r?!!(s===0&&Va(n,t,e)||o===0&&Va(n,i,e)||a===0&&Va(t,n,i)||c===0&&Va(t,e,i)):!1}function Va(n,e,t){return e.x<=Math.max(n.x,t.x)&&e.x>=Math.min(n.x,t.x)&&e.y<=Math.max(n.y,t.y)&&e.y>=Math.min(n.y,t.y)}function o_(n,e){let t=Math.min(n.x,e.x),i=Math.max(n.x,e.x),r=Math.min(n.y,e.y),s=Math.max(n.y,e.y),o=n;do{let a=o.next;if(o.x>i&&a.x>i||o.x<t&&a.x<t||o.y>s&&a.y>s||o.y<r&&a.y<r){o=a;continue}if(o.i!==n.i&&a.i!==n.i&&o.i!==e.i&&a.i!==e.i&&wd(o,a,n,e))return!0;o=a}while(o!==n);return!1}function Ss(n,e){return vt(n.prev,n,n.next)<0?vt(n,e,n.next)>=0&&vt(n,n.prev,e)>=0:vt(n,e,n.prev)<0||vt(n,n.next,e)<0}function a_(n,e){let t=n,i=!1,r=(n.x+e.x)/2,s=(n.y+e.y)/2;do{let o=t.next;t.y>s!=o.y>s&&r<(o.x-t.x)*(s-t.y)/(o.y-t.y)+t.x&&(i=!i),t=o}while(t!==n);return i}function Ed(n,e){let t=Hc(n.i,n.x,n.y),i=Hc(e.i,e.x,e.y),r=n.next,s=e.prev;return n.next=e,e.prev=n,t.next=r,r.prev=t,i.next=t,t.prev=i,s.next=i,i.prev=s,i}function vd(n,e,t,i){let r=Hc(n,e,t);return i?(r.next=i.next,r.prev=i,i.next.prev=r,i.next=r):(r.prev=r,r.next=r),r}function ws(n){n.next.prev=n.prev,n.prev.next=n.next,n.prevZ&&(n.prevZ.nextZ=n.nextZ),n.nextZ&&(n.nextZ.prevZ=n.prevZ),kc&&Qy(n.prev,n.next)}function Hc(n,e,t){return{i:n,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null}}function l_(n,e,t,i){let r=0;for(let s=e,o=t-i;s<t;s+=i)r+=(n[o]-n[s])*(n[s+1]+n[o+1]),o=s;return r}function Td(n){let e=parseInt(n.replace("#",""),16),t=i=>(i/=255,i<=.04045?i/12.92:((i+.055)/1.055)**2.4);return[t(e>>16&255),t(e>>8&255),t(e&255)]}function Ad(n,e,t,i){let r=[],s=[],o=[],a=Td(t),c=Td(i),l=-.6,u=.8;for(let f of n){let h=f.geometry,m=h.type==="Polygon"?[h.coordinates]:h.type==="MultiPolygon"?h.coordinates:[],g=Math.max(3,Number(f.properties.height)||9);for(let x of m){let d=[],p=[],M=x.map(v=>v.map(([w,E])=>e(w,E)));M.forEach((v,w)=>{w&&p.push(d.length/2);for(let[E,R]of v)d.push(E,R)});let S=r.length/3;for(let v=0;v<d.length;v+=2)r.push(d[v],d[v+1],g),s.push(a[0],a[1],a[2]);for(let v of Qn(d,p,2))o.push(S+v);for(let v of M)for(let w=1;w<v.length;w++){let[E,R]=v[w-1],[_,A]=v[w],I=Math.hypot(_-E,A-R)||1,C=.72+.22*Math.max(0,((A-R)*l-(_-E)*u)/I);S=r.length/3,r.push(E,R,0,_,A,0,_,A,g,E,R,g);for(let U=0;U<4;U++)s.push(c[0]*C,c[1]*C,c[2]*C);o.push(S,S+1,S+2,S,S+2,S+3)}}}return{position:new Float32Array(r),color:new Float32Array(s),index:r.length/3>65535?new Uint32Array(o):new Uint16Array(o)}}var Wa=`
float bayer4(vec2 p){ int x=int(mod(p.x,4.)), y=int(mod(p.y,4.)); int i=x+y*4;
  float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
  for(int k=0;k<16;k++){ if(k==i) return (m[k]+.5)/16.; } return .5; }
uniform vec2 uRider; uniform float uNearR; uniform float uNear;
float nearKeep(vec2 w){ if(uNear<=0.) return 1.; float d=distance(w,uRider); return mix(1., smoothstep(uNearR*0.8, uNearR, d), uNear); }
`,Es={uRider:{value:new Be},uNearR:{value:600},uNear:{value:0}},c_=n=>new Fe().setStyle(n,qn);function Xc(n,e){return{uColor:{value:c_(n)},uOpacity:{value:1},uZ:{value:e},uHalf:{value:1},...Es}}var YS=`
uniform vec3 uColor; uniform float uOpacity; varying vec2 vWorld;
${Wa}
void main(){ float a=uOpacity*nearKeep(vWorld); if(a<bayer4(gl_FragCoord.xy)) discard; gl_FragColor=vec4(uColor,1.); }`;function Pd(n,e,t={}){return new Ut({defines:t.vertexColor?{VCOLOR:""}:{},uniforms:Xc(n,e),vertexShader:`uniform float uZ; varying vec2 vWorld;
      #ifdef VCOLOR
      attribute vec3 aColor; varying vec3 vColor;
      #endif
      void main(){ vWorld=position.xy;
        #ifdef VCOLOR
        vColor=aColor;
        #endif
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position.xy,uZ,1.); }`,fragmentShader:`
      uniform vec3 uColor; uniform float uOpacity; varying vec2 vWorld;
      #ifdef VCOLOR
      varying vec3 vColor;
      #endif
      ${Wa}
      void main(){ float a=uOpacity*nearKeep(vWorld); if(a<bayer4(gl_FragCoord.xy)) discard;
        #ifdef VCOLOR
        gl_FragColor=vec4(vColor,1.);
        #else
        gl_FragColor=vec4(uColor,1.);
        #endif
      }`,transparent:!0,depthWrite:!1})}function Id(n,e,t={}){let i={};return t.dash&&(i.DASH=""),t.vertexColor&&(i.VCOLOR=""),t.blend&&(i.BLEND=""),t.scale&&(i.SCALE=""),new Ut({defines:i,uniforms:{...Xc(n,e),uDash:{value:new Be(0,0)}},vertexShader:`
      uniform float uZ; uniform float uHalf; attribute vec2 aDir; attribute vec2 aCorner; attribute float aDist; varying vec2 vWorld; varying float vDist;
      #ifdef VCOLOR
      attribute vec3 aColor; varying vec3 vColor;
      #endif
      #ifdef SCALE
      attribute float aScale;
      #endif
      void main(){ float h=uHalf;
        #ifdef SCALE
        h*=aScale;
        #endif
        vec2 n=vec2(-aDir.y,aDir.x); vec2 p=position.xy+(n*aCorner.x+aDir*aCorner.y)*h; vWorld=p; vDist=aDist+aCorner.y*h;
        #ifdef VCOLOR
        vColor=aColor;
        #endif
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,uZ,1.); }`,fragmentShader:`
      uniform vec3 uColor; uniform float uOpacity; uniform vec2 uDash; varying vec2 vWorld; varying float vDist;
      #ifdef VCOLOR
      varying vec3 vColor;
      #endif
      ${Wa}
      void main(){
        #ifdef DASH
        if(uDash.x>0. && mod(vDist, uDash.x+uDash.y) > uDash.x) discard;
        #endif
        float a=uOpacity*nearKeep(vWorld);
        #ifdef BLEND
        if(a<0.004) discard;
        #else
        if(a<bayer4(gl_FragCoord.xy)) discard; a=1.;
        #endif
        #ifdef VCOLOR
        gl_FragColor=vec4(vColor,a);
        #else
        gl_FragColor=vec4(uColor,a);
        #endif
      }`,transparent:!0,depthWrite:!1})}function Ts(n,e){let t=[],i=[],r=[],s=new Fe;n.forEach((a,c)=>{e&&s.setStyle(e[c]??"#ffffff",qn);let l=[],u=[];a.forEach((h,m)=>{m&&u.push(l.length/2);for(let[g,x]of h)l.push(g,x)});let f=t.length/3;for(let h=0;h<l.length;h+=2)t.push(l[h],l[h+1],0),e&&r.push(s.r,s.g,s.b);for(let h of Qn(l,u,2))i.push(f+h)});let o=new St;return o.setAttribute("position",new Dt(t,3)),e&&o.setAttribute("aColor",new Dt(r,3)),o.setIndex(t.length/3>65535?new Bi(i,1):new Oi(i,1)),o.computeBoundingSphere(),o}function As(n,e,t){let i=0;for(let g of n)i+=Math.max(0,g.length-1);let r=new Float32Array(i*12),s=new Float32Array(i*8),o=new Float32Array(i*8),a=new Float32Array(i*4),c=e?new Float32Array(i*12):null,l=t?new Float32Array(i*4):null,u=new Uint32Array(i*6),f=new Fe,h=0;n.forEach((g,x)=>{c&&f.setStyle(e[x]??"#ffffff",qn);let d=0;for(let p=1;p<g.length;p++){let[M,S]=g[p-1],[v,w]=g[p],E=Math.hypot(v-M,w-S)||1,R=(v-M)/E,_=(w-S)/E,A=h*4,I=(C,U,X,Y,N,G)=>{r.set([U,X,0],(A+C)*3),s.set([R,_],(A+C)*2),o.set([Y,N],(A+C)*2),a[A+C]=G,c&&c.set([f.r,f.g,f.b],(A+C)*3),l&&(l[A+C]=t[x]??1)};I(0,M,S,1,-1,d),I(1,M,S,-1,-1,d),I(2,v,w,1,1,d+E),I(3,v,w,-1,1,d+E),u.set([A,A+1,A+2,A+1,A+3,A+2],h*6),d+=E,h++}});let m=new St;return m.setAttribute("position",new Ke(r,3)),m.setAttribute("aDir",new Ke(s,2)),m.setAttribute("aCorner",new Ke(o,2)),m.setAttribute("aDist",new Ke(a,1)),c&&m.setAttribute("aColor",new Ke(c,3)),l&&m.setAttribute("aScale",new Ke(l,1)),m.setIndex(new Ke(u,1)),m.computeBoundingSphere(),m}function Ld(n,e){let r=document.createElement("canvas"),s=r.getContext("2d"),o='700 96px "Helvetica Neue", Arial, sans-serif';s.font=o;let a=(e.letterSpacingEm??0)*96,c=[...n],l=c.map(M=>s.measureText(M).width),u=Math.ceil(l.reduce((M,S)=>M+S,0)+a*(c.length-1)+24);r.width=u,r.height=Math.ceil(96*1.25+24),s.font=o,s.textBaseline="middle",s.lineJoin="round";let f=12;for(let M of[0,1])f=12,c.forEach((S,v)=>{M===0?(s.strokeStyle=e.halo,s.lineWidth=(e.haloPx??1.4)*(96/24)*2,s.strokeText(S,f,r.height/2)):(s.fillStyle=e.fill,s.fillText(S,f,r.height/2)),f+=l[v]+a});let h=new $r(r);h.colorSpace=Xt,h.anisotropy=8;let m=e.heightM*r.height/96,g=m*r.width/r.height,x=new ki(g,m),d=new Zn({map:h,transparent:!0,opacity:e.opacity??1,depthWrite:!1}),p=new ut(x,d);return p.position.set(e.at[0],e.at[1],e.z??.4),p.rotation.z=-e.bearing*Math.PI/180,p.renderOrder=45,p}var Wc=n=>Math.log(Math.tan(Math.PI/4+n*Math.PI/360)),Rd=(n,e)=>{let t=Math.PI-2*Math.PI*n/2**e;return 180/Math.PI*Math.atan(Math.sinh(t))},Cd=(n,e)=>n/2**e*360-180;function Dd(n,e,t,i,r=16){let s=Cd(e,n),o=Cd(e+1,n),a=Rd(t,n),c=Rd(t+1,n),l=[],u=[],f=[],h=Wc(a),m=Wc(c);for(let x=0;x<=r;x++){let d=x/r,p=(2*Math.atan(Math.exp(h+(m-h)*d))-Math.PI/2)*180/Math.PI;for(let[M,S]of[[0,s],[1,o]]){let[v,w]=i(S,p);l.push(v,w,0),u.push(M,1-d)}if(x){let M=(x-1)*2;f.push(M,M+2,M+1,M+1,M+2,M+3)}}let g=new St;return g.setAttribute("position",new Dt(l,3)),g.setAttribute("uv",new Dt(u,2)),g.setIndex(f),g}function Nd(n,e,t){return new Ut({uniforms:{map:{value:n},...Xc(e,t)},vertexShader:"uniform float uZ; varying vec2 vUv; varying vec2 vWorld; void main(){ vUv=uv; vWorld=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position.xy,uZ,1.); }",fragmentShader:`uniform sampler2D map; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; varying vec2 vWorld; ${Wa}
      void main(){ vec4 t=texture2D(map,vUv); float a=t.a*uOpacity*nearKeep(vWorld); if(a<0.01) discard; gl_FragColor=vec4(uColor*0.9,a); }`,transparent:!0,depthWrite:!1})}function qc(n){let e=new St;return e.setAttribute("position",new Ke(n.position,3)),e.setAttribute("color",new Ke(n.color,3)),e.setIndex(new Ke(n.index,1)),e.computeBoundingSphere(),e}function Fd(n,e,t,i){return qc(Ad(n,e,t,i))}function Ud(n){let[e,t]=Un(n[0],n[1]),[i,r]=Un(n[2],n[3]),s=c=>Math.floor((c+180)/360*2**14),o=c=>Math.floor((1-Wc(c)/Math.PI)/2*2**14),a=[];for(let c=s(e);c<=s(i);c++)for(let l=o(r);l<=o(t);l++)a.push(`${c}/${l}`);return a}function Xa(n,e){if(e<=n[0][0])return n[0][1];for(let t=1;t<n.length;t++){let[i,r]=n[t];if(e<=i){let[s,o]=n[t-1],a=(e-s)/(i-s);return o>0&&r>0?o*(r/o)**a:o+(r-o)*a}}return n[n.length-1][1]}var on={land:"#f4f0e8",water:"#a3c6e3",park:"#d2e6b5",building:"#d9d0c6",buildingOutline:"#c4b8ab",route:"#38BDF8",routeCasing:"rgba(3,18,28,0.75)"},On={major:{fill:"#fcd68f",casing:"#d9a861",width:[[9,.6],[11,1.1],[12,1.6],[14,4.5],[16,7],[18,11],[20,24]],casingExtra:2,order:6},secondary:{fill:"#fdeaae",casing:"#d8c17d",width:[[10,.4],[12,1.1],[14,3.5],[16,5.5],[18,8],[20,16]],casingExtra:2,order:5},tertiary:{fill:"#ffffff",casing:"#cfc5b6",width:[[11,.4],[13,1.2],[14,2.6],[16,4.8],[18,7.5],[20,15]],casingExtra:1.6,order:4},minor:{fill:"#ffffff",casing:"#d6cec2",width:[[12,.25],[14,1.3],[16,3.6],[18,6.5],[20,12]],casingExtra:1.4,order:3},service:{fill:"#ffffff",casing:"#ddd6cb",width:[[13,.2],[15,.9],[16,2],[18,4.5],[20,10]],casingExtra:1.2,order:2},cycle:{fill:"#e7a59b",casing:null,width:[[13,.25],[15,.8],[16,1.3],[18,2.6],[20,5]],casingExtra:0,order:1},path:{fill:"#c8bba9",casing:null,width:[[14,.3],[16,.9],[18,1.8],[20,3.5]],casingExtra:0,order:0}},Od=.35,Yc=[[10,3],[13,4],[16,6],[18,9],[20,18]],Bd=[13.4,14.1],kd=13.5,zd=[16,16.8],Zc=(n,[e,t])=>Math.max(0,Math.min(1,(n-e)/(t-e))),qa={farmland:{fill:"#eef0da",order:0},industrial:{fill:"#ebe5e1",order:1},construction:{fill:"#e9e3d8",order:2},allotments:{fill:"#e1ebcc",order:3},cemetery:{fill:"#d6e2cb",order:4},green:{fill:"#dfecca",order:5},wetland:{fill:"#d8e7d7",order:6},wood:{fill:"#c9dfb2",order:7},sport:{fill:"#cfe7c0",order:8},sand:{fill:"#f3e8c6",order:9}},Ya={rail:{fill:"#a9a6a2",width:[[10,.5],[13,1],[16,1.8],[18,3],[20,6]]},light_rail:{fill:"#a9a6a2",width:[[11,.4],[14,1],[18,2.4]]},subway:{fill:"#a9a6a2",width:[[11,.4],[14,1],[18,2.4]]},tram:{fill:"#b3aca6",width:[[13,.3],[15,.8],[18,1.6],[20,3]]},narrow_gauge:{fill:"#b3aca6",width:[[13,.3],[16,1],[18,1.8]]},monorail:{fill:"#b3aca6",width:[[13,.3],[16,1],[18,1.8]]},funicular:{fill:"#b3aca6",width:[[13,.3],[16,1],[18,1.8]]}},$c={opacity:.45,dash:[3,2]},Za={fill:"#f4f0e8",width:[[14,1],[16,2.5],[18,6],[20,18]]},Er={color:"#8B5CF6",width:[[13,1],[18,2.5]],opacity:.48,dash:[3,3],minZoom:13};var Jc={ground:0,low:7,mid:13,high:22};var Vd={culture:"#8e5bb5",worship:"#8a7560",education:"#4a7bb7",health:"#c4504a",civic:"#5b6b7a",lodging:"#3b8f8a",shop:"#c08a2c",bike:"#d46b2c",leisure:"#4f9a52",market:"#b3702f",food:"#c2553b"};var u_=70;function Gd(n,e){if(!n||!Array.isArray(n.pois))return{type:"FeatureCollection",features:[]};let t=n.pois.filter(r=>r[0]&&!e(r[0])).map((r,s)=>({id:String(s).padStart(6,"0"),name:r[0],kind:"own",center:[r[2],r[1]],orientationScore:r[4],category:n.categories[r[3]],band:n.bands[r[5]]??"ground"}));return{type:"FeatureCollection",features:$a(t,{kinds:["own"],cellMetres:u_}).filter(r=>r.category).map(r=>({type:"Feature",properties:{name:r.name,category:r.category,colour:Vd[r.category]??"#5b6b7a",rank:r.orientationScore??0,band:r.band},geometry:{type:"Point",coordinates:[r.center[1],r.center[0]]}}))}}var h_=260,Hd=111320;function $a(n,e={}){let t=new Set(e.kinds??["local-food"]),i=e.cellMetres??h_;if(!(i>0))return n.slice();let r=[],s=[];for(let l of n)l&&t.has(l.kind)&&Array.isArray(l.center)?s.push(l):l&&r.push(l);if(!s.length)return r;let o=s.reduce((l,u)=>l+u.center[0],0)/s.length,a=Hd*Math.cos(o*Math.PI/180),c=new Map;for(let l of s){let u=Math.floor(l.center[0]*Hd/i),f=Math.floor(l.center[1]*a/i),h=`${u},${f}`,m=c.get(h);if(!m){c.set(h,l);continue}let g=m.orientationScore??0,x=l.orientationScore??0;(x>g||x===g&&l.id<m.id)&&c.set(h,l)}return r.concat([...c.values()])}var Kc=5,d_=5,f_=["dwarsstraat","burgwal","gracht","straat","kanaal","sloot","steeg","plein","kade","brug","laan","dijk","weg","pad","hof"];function Rs(n){return n.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}function Tr(n){let e=new Set,t=new Set;for(let i of n){if(!i)continue;let r=Rs(i);if(r.length>=Kc&&t.add(i.trim().toLowerCase()),!(r.length<Kc)){e.add(r);for(let s of f_){if(!r.endsWith(s))continue;let o=r.slice(0,-s.length).trim();o.length>=Kc&&e.add(o);break}}}return{names:e,lowerRaw:t}}function Ar(n,e){if(!n||!e||e.names.size===0)return!1;let t=Rs(n).split(" ").filter(Boolean);for(let i=1;i<=Math.min(d_,t.length);i++)for(let r=0;r+i<=t.length;r++)if(e.names.has(t.slice(r,r+i).join(" ")))return!0;return!1}var Wd=12;var r1=Math.PI/4;var s1=Math.PI/6;function Rr(n,e,t,i){return!e||n.hiddenName&&(e===n.hiddenName||Rs(e)===Rs(n.hiddenName))?!1:n.isLabelled(e,t,i)}function Xd(n,e){return!(!e||n.quizQuiet||n.spoilerIndex&&Ar(e,n.spoilerIndex)||n.hiddenName&&Ar(e,Tr([n.hiddenName])))}function qd(n,e){return!(n.spoilerIndex&&Ar(e,n.spoilerIndex)||n.hiddenName&&Ar(e,Tr([n.hiddenName])))}function Yd(n,e){return e?!(n.hiddenName&&Ar(e,Tr([n.hiddenName]))):!1}function Zd(n){return!n.quizQuiet}var Si=250;function jc(n,e){let t=new Map;for(let i of n){let[r,s,o,a]=e(i);for(let c=Math.floor(r/Si);c<=Math.floor(o/Si);c++)for(let l=Math.floor(s/Si);l<=Math.floor(a/Si);l++){let u=`${c},${l}`,f=t.get(u);f?f.push(i):t.set(u,[i])}}return t}var Qc=n=>{let e=1/0,t=1/0,i=-1/0,r=-1/0;for(let[s,o]of n)s<e&&(e=s),s>i&&(i=s),o<t&&(t=o),o>r&&(r=o);return[e,t,i,r]},p_={major:3.2,secondary:2.6,tertiary:2,minor:1.4,service:.8,cycle:.8,path:.6},Ja=class{constructor(e,t=450){this.radiusM=t;this.streets=jc(e.streets,i=>Qc(i.points)),this.water=jc(e.water,i=>Qc(i[0])),this.parks=jc(e.parks.flatMap(i=>i.rings.map(r=>[r])),i=>Qc(i[0]))}streets;water;parks;gather(e,t,i,r){let s=new Set;for(let o=Math.floor((t-r)/Si);o<=Math.floor((t+r)/Si);o++)for(let a=Math.floor((i-r)/Si);a<=Math.floor((i+r)/Si);a++)for(let c of e.get(`${o},${a}`)??[])s.add(c);return s}draw(e,t,i,r,s){let o=t/2/this.radiusM,a=this.radiusM*1.45;e.save(),e.beginPath(),e.arc(t/2,t/2,t/2,0,Math.PI*2),e.clip(),e.fillStyle=on.land,e.fillRect(0,0,t,t),e.translate(t/2,t/2),e.rotate(-r*Math.PI/180),e.scale(o,-o),e.translate(-i[0],-i[1]);let c=0,l=(f,h)=>{e.fillStyle=h,e.beginPath();for(let m of f){for(let g of m)g.forEach(([x,d],p)=>p?e.lineTo(x,d):e.moveTo(x,d)),e.closePath();c++}e.fill("evenodd")};l(this.gather(this.parks,i[0],i[1],a),on.park),l(this.gather(this.water,i[0],i[1],a),on.water);let u=[...this.gather(this.streets,i[0],i[1],a)].sort((f,h)=>On[f.cls].order-On[h.cls].order);e.lineCap="round",e.lineJoin="round";for(let f of["casing","fill"]){let h="";for(let m of u){let g=On[m.cls],x=f==="casing"?g.casing:g.fill;if(!x)continue;let d=`${x}|${m.cls}`;d!==h&&(h&&e.stroke(),h=d,e.strokeStyle=x,e.lineWidth=(p_[m.cls]+(f==="casing"?1.2:0))/o,e.beginPath()),m.points.forEach(([p,M],S)=>S?e.lineTo(p,M):e.moveTo(p,M)),c++}h&&e.stroke()}return s&&s.length>1&&(e.strokeStyle=on.routeCasing,e.lineWidth=5/o,e.beginPath(),s.forEach(([f,h],m)=>m?e.lineTo(f,h):e.moveTo(f,h)),e.stroke(),e.strokeStyle=on.route,e.lineWidth=3/o,e.stroke()),e.restore(),e.save(),e.translate(t/2,t/2),e.fillStyle="#0f172a",e.strokeStyle="#fff",e.lineWidth=2,e.beginPath(),e.moveTo(0,-9),e.lineTo(6.5,7),e.lineTo(0,3.5),e.lineTo(-6.5,7),e.closePath(),e.fill(),e.stroke(),e.restore(),e.strokeStyle="rgba(15,23,42,.55)",e.lineWidth=1.5,e.beginPath(),e.arc(t/2,t/2,t/2-.75,0,Math.PI*2),e.stroke(),c}};var $d=[{id:"nassaukade",label:"Nassaukade / Kostverlorenvaart / Bilderdijkstraat",lng:4.869,lat:52.37,halfM:750},{id:"leidsegracht",label:"Herengracht / Leidsegracht",lng:4.8875,lat:52.3665,halfM:750}];var Jd=.11,m_=1.8,eu=2.1,tu=1.6,nu={motorway:{width:11,oneway:7.5,laneM:3.5,surface:"asphalt",sidewalks:!1,centre:!0},trunk:{width:10,oneway:7,laneM:3.3,surface:"asphalt",sidewalks:!1,centre:!0},primary:{width:7,oneway:6.5,laneM:3.2,surface:"asphalt",sidewalks:!1,centre:!0},secondary:{width:6.5,oneway:6,laneM:3.1,surface:"asphalt",sidewalks:!1,centre:!0},tertiary:{width:6,oneway:3.6,laneM:3,surface:"asphalt",sidewalks:!0,centre:!0},unclassified:{width:5.5,oneway:3.6,laneM:2.8,surface:"klinker",sidewalks:!0,centre:!1},residential:{width:5.2,oneway:4,laneM:2.75,surface:"klinker",sidewalks:!0,centre:!1},living_street:{width:4.6,oneway:4,laneM:2.6,surface:"klinker",sidewalks:!1,centre:!1},service:{width:3.6,oneway:3.2,laneM:3,surface:"klinker",sidewalks:!1,centre:!1},busway:{width:6,oneway:3.5,laneM:3.2,surface:"asphalt",sidewalks:!1,centre:!1},road:{width:5,oneway:3.6,laneM:3,surface:"asphalt",sidewalks:!1,centre:!1}};for(let n of["motorway","trunk","primary","secondary","tertiary"])nu[`${n}_link`]=nu[n];var g_={cycleway:{width:2.5,kind:"cycleway",surface:"cycle"},footway:{width:2,kind:"footway",surface:"paving"},pedestrian:{width:6,kind:"footway",surface:"paving"},path:{width:2,kind:"path",surface:"paving"},steps:{width:2,kind:"footway",surface:"paving"},track:{width:3,kind:"path",surface:"gravel"},bridleway:{width:2,kind:"path",surface:"gravel"}},x_=new Set(["proposed","construction","platform","corridor","elevator","bus_stop","raceway","abandoned","disused","razed"]);function Cs(n){if(!n)return null;let e=/^\s*([0-9]+(?:[.,][0-9]+)?)\s*(m|meter|metres?)?\s*$/i.exec(n);if(!e)return null;let t=Number(e[1].replace(",","."));return Number.isFinite(t)&&t>.3&&t<60?t:null}function Kd(n,e,t){return n?n==="asphalt"?e==="cycle"?"cycle":"asphalt":["paving_stones","sett","bricks","brick","cobblestone","unhewn_cobblestone","paving_stones:30"].includes(n)?e==="cycle"?"cycle":t||e==="paving"?"paving":"klinker":n==="concrete"||n.startsWith("concrete:")?e==="cycle"?"cycle":"paving":["unpaved","gravel","fine_gravel","compacted","dirt","ground","sand","earth","woodchips","pebblestone"].includes(n)?"gravel":e:e}var y_=n=>n===void 0?null:n==="both"?["left","right"]:n==="left"||n==="right"?[n]:[];function __(n,e){let t=y_(n.sidewalk);if(t)return{sides:t,source:"tag"};let i=n["sidewalk:both"];if(i!==void 0)return{sides:i==="yes"?["left","right"]:[],source:"tag"};let r=n["sidewalk:left"],s=n["sidewalk:right"];return r!==void 0||s!==void 0?{sides:[...r==="yes"?["left"]:[],...s==="yes"?["right"]:[]],source:"tag"}:{sides:e?["left","right"]:[],source:"prior"}}function v_(n){let e=s=>s==="lane"||s==="opposite_lane"?"lane":s==="track"||s==="opposite_track"?"track":null,t=n.cycleway??n["cycleway:both"];if(t!==void 0){let s=e(t);return{left:n.oneway==="yes"&&n["cycleway:both"]===void 0&&t!=="opposite_lane"?null:s,right:s,source:"tag"}}let i=n["cycleway:left"],r=n["cycleway:right"];return i!==void 0||r!==void 0?{left:e(i),right:e(r),source:"tag"}:{left:null,right:null,source:"prior"}}function jd(n){let e=n.highway;if(!e||x_.has(e)||n.area==="yes"||n.tunnel&&n.tunnel!=="no"&&n.tunnel!=="building_passage"||Number(n.layer)<0&&!n.bridge||n.level&&Number(n.level)!==0&&!n.bridge)return null;let t=Cs(n.width)??Cs(n.est_width),i=g_[e];if(i){let d=i.kind,p=i.surface;e==="path"&&n.bicycle==="designated"&&(d="cycleway",p="cycle");let M=e==="footway"&&n.footway==="sidewalk",S=n.footway==="crossing"||n.cycleway==="crossing";p=Kd(n.surface,p,M),d==="cycleway"&&n.surface&&n.surface!=="asphalt"&&p!=="gravel"&&(p="cycle");let v=t??(e==="cycleway"&&n.oneway==="yes"?2.1:i.width),w={kind:M?"sidewalk":d,surface:p,offset:0,width:v,raised:M?Jd:0,kerb:M?"both":"none"},E=["zebra","marked","uncontrolled"].includes(n.crossing)||!!n["crossing:markings"]&&n["crossing:markings"]!=="no",R=S&&E&&!M&&d==="footway"?[{offset:0,width:Math.min(v,3),dash:[.5,.5]}]:[];return{bands:[w],paint:R,coreHalfWidth:v/2,halfWidth:v/2,source:{width:t?"tag":"prior",sidewalk:"prior",cycleway:"prior"}}}let r=nu[e];if(!r)return null;let s=n.oneway==="yes"||n.junction==="roundabout",o=Number(n.lanes),a=t?"tag":o>0?"lanes":"prior",c=t??(o>0?o*r.laneM:s?r.oneway:r.width);(n.service==="alley"||n.service==="driveway")&&(c=Math.min(c,3)),c=Math.max(2.4,Math.min(30,c));let l=[{kind:"carriageway",surface:Kd(n.surface,r.surface,!1),offset:0,width:c,raised:0,kerb:"none"}],u=[],f=c/2,h={left:f,right:f},m=v_(n);for(let d of["left","right"]){let p=d==="left"?1:-1,M=m[d];M==="lane"?(l.push({kind:"cycle_lane",surface:"cycle",offset:p*(h[d]+tu/2),width:tu,raised:0,kerb:"none"}),u.push({offset:p*h[d],width:.1,dash:[1,1]}),h[d]+=tu):M==="track"&&(l.push({kind:"cycle_track",surface:"cycle",offset:p*(h[d]+.4+eu/2),width:eu+.8,raised:.04,kerb:d}),h[d]+=eu+.8)}let g=__(n,r.sidewalks);for(let d of g.sides){let p=d==="left"?1:-1,M=Cs(n[`sidewalk:${d}:width`])??Cs(n["sidewalk:both:width"])??Cs(n["sidewalk:width"])??m_;l.push({kind:"sidewalk",surface:"paving",offset:p*(h[d]+M/2),width:M,raised:Jd,kerb:d}),h[d]+=M}return(o>=2&&!s||r.centre&&!s&&!o)&&u.push({offset:0,width:.12,dash:[3,5]}),(e.startsWith("primary")||e.startsWith("secondary")||e.startsWith("trunk"))&&u.push({offset:f-.3,width:.12,dash:null},{offset:-(f-.3),width:.12,dash:null}),{bands:l,paint:u,coreHalfWidth:f,halfWidth:Math.max(h.left,h.right),source:{width:a,sidewalk:g.source,cycleway:m.source}}}var Ot=(n=!1)=>({positions:[],uvs:[],indices:[],...n?{colors:[]}:{}});function Ht(n,e,t,i,r){return n.positions.push(e,t,i),n.uvs.push(e,t),n.colors&&n.colors.push(...r??[1,1,1]),n.positions.length/3-1}var Cr=n=>n.indices.length/3;function Ps(n){let e=[0];for(let t=1;t<n.length;t++)e.push(e[t-1]+Math.hypot(n[t][0]-n[t-1][0],n[t][1]-n[t-1][1]));return e}function Qd(n,e,t){if(t<=0)return n[0];if(t>=e[e.length-1])return n[n.length-1];let i=1;for(;e[i]<t;)i++;let r=(t-e[i-1])/(e[i]-e[i-1]||1);return[n[i-1][0]+(n[i][0]-n[i-1][0])*r,n[i-1][1]+(n[i][1]-n[i-1][1])*r]}function Ka(n,e){let t=Ps(n),i=t[t.length-1],r=[];for(let a of[...e].sort((c,l)=>c[0]-l[0])){let c=r[r.length-1];c&&a[0]<=c[1]?c[1]=Math.max(c[1],a[1]):r.push([a[0],a[1]])}let s=[],o=0;for(let[a,c]of r)a>o&&s.push([o,Math.min(a,i)]),o=Math.max(o,c);return o<i&&s.push([o,i]),s.filter(([a,c])=>c-a>.05).map(([a,c])=>{let l=[Qd(n,t,a)];for(let u=0;u<n.length;u++)t[u]>a&&t[u]<c&&l.push(n[u]);return l.push(Qd(n,t,c)),l})}function ja(n,e){let t=[];for(let i=0;i+1<n.length;i++){let r=n[i],s=n[i+1],o=Math.max(1,Math.ceil(Math.hypot(s[0]-r[0],s[1]-r[1])/e));for(let a=0;a<o;a++)t.push([r[0]+(s[0]-r[0])*a/o,r[1]+(s[1]-r[1])*a/o])}return n.length&&t.push(n[n.length-1]),t}function ef(n,e=2.5){let t=n.length,i=[],r=s=>{let o=n[s+1][0]-n[s][0],a=n[s+1][1]-n[s][1],c=Math.hypot(o,a)||1;return[-a/c,o/c]};for(let s=0;s<t;s++){let o=s>0?r(s-1):null,a=s<t-1?r(s):null;if(!o||!a){let h=o??a;i.push([h[0],h[1],1]);continue}let c=o[0]+a[0],l=o[1]+a[1],u=Math.hypot(c,l);if(u<1e-6){i.push([a[0],a[1],1]);continue}c/=u,l/=u;let f=c*a[0]+l*a[1];i.push([c,l,Math.min(e,1/Math.max(f,.001))])}return i}function Is(n,e,t,i,r,s,o={}){if(e.length<2||i<=0)return;let a=ja(e,o.step??3),c=ef(a),l=Math.max(1,o.across??(i>7?2:1)),u=null;for(let f=0;f<a.length;f++){let[h,m,g]=c[f],x=[];for(let d=0;d<=l;d++){let p=(t+i/2-i*d/l)*g,M=a[f][0]+h*p,S=a[f][1]+m*p;x.push(Ht(n,M,S,r(M,S)+s,o.colour))}if(u)for(let d=0;d<l;d++){let p=u[d],M=u[d+1],S=x[d+1],v=x[d];n.indices.push(M,S,v,M,v,p)}u=x}}function Qa(n,e,t,i,r,s,o,a={}){if(e.length<2)return;let c=ja(e,a.step??3),l=ef(c),u=null;for(let f=0;f<c.length;f++){let[h,m,g]=l[f],x=c[f][0]+h*t*g,d=c[f][1]+m*t*g,p=i(x,d),M=Ht(n,x,d,p+r,a.colour),S=Ht(n,x,d,p+s,a.colour);u&&(o===1?n.indices.push(u[0],S,u[1],u[0],M,S):n.indices.push(u[0],u[1],S,u[0],S,M)),u=[M,S]}}function iu(n,e,t,i,r,s,o,a,c,l){let u=-t[1],f=t[0],h=i+r/2,m=i-r/2,g=[e[0]+u*h,e[1]+f*h],x=[e[0]+u*m,e[1]+f*m],d=s(g[0],g[1]),p=s(x[0],x[1]),M=Ht(n,g[0],g[1],d+o,l),S=Ht(n,g[0],g[1],d+a,l),v=Ht(n,x[0],x[1],p+o,l),w=Ht(n,x[0],x[1],p+a,l);c?n.indices.push(M,w,S,M,v,w):n.indices.push(M,S,w,M,w,v)}function tf(n,e,t,i,r,s=12,o){let a=Ht(n,e[0],e[1],i(e[0],e[1])+r,o),c=n.positions.length/3;for(let l=0;l<s;l++){let u=l/s*Math.PI*2,f=e[0]+Math.cos(u)*t,h=e[1]+Math.sin(u)*t;Ht(n,f,h,i(f,h)+r,o)}for(let l=0;l<s;l++)n.indices.push(a,c+l,c+(l+1)%s)}function nf(n,e,t,i,r,s=4,o){for(let a=0;a<t.length;a+=3){let c=e[t[a]*2],l=e[t[a]*2+1],u=e[t[a+1]*2],f=e[t[a+1]*2+1],h=e[t[a+2]*2],m=e[t[a+2]*2+1],g=Math.max(Math.hypot(u-c,f-l),Math.hypot(h-u,m-f),Math.hypot(c-h,l-m)),x=Math.max(1,Math.min(64,Math.ceil(g/s))),d=(u-c)*(m-l)-(f-l)*(h-c)>0,p=[];for(let M=0;M<=x;M++){p.push([]);for(let S=0;S<=x-M;S++){let v=M/x,w=S/x,E=1-v-w,R=c*E+u*v+h*w,_=l*E+f*v+m*w;p[M].push(Ht(n,R,_,i(R,_)+r,o))}}for(let M=0;M<x;M++)for(let S=0;S<x-M;S++){let v=p[M][S],w=p[M+1][S],E=p[M][S+1];if(d?n.indices.push(v,w,E):n.indices.push(v,E,w),S<x-M-1){let R=p[M+1][S+1];d?n.indices.push(w,R,E):n.indices.push(w,E,R)}}}}function rf(n){let e=Ot(n.some(t=>t.colors));for(let t of n){let i=e.positions.length/3;for(let r of t.positions)e.positions.push(r);for(let r of t.uvs)e.uvs.push(r);if(e.colors)if(t.colors)for(let r of t.colors)e.colors.push(r);else for(let r=0;r<t.positions.length;r++)e.colors.push(1);for(let r of t.indices)e.indices.push(r+i)}return e}var wi={area:.015,crossing:.025,carriageway:.03,cycleLane:.036,path:.04,paint:.046,raisedBase:.03,route:.07},el=n=>`${Math.round(n[0]*10)}:${Math.round(n[1]*10)}`,b_=n=>n.section.bands[0]?.kind==="carriageway";function af(n,e){let t=[];for(let i of n){let r=jd(i.tags);!r||i.g.length<2||t.push({id:i.id,tags:i.tags,points:i.g.map(e),section:r})}return t}function M_(n){let e=new Map;for(let t of n)t.points.forEach((i,r)=>{let s=el(i),o=e.get(s)??e.set(s,{ways:new Set,branches:[]}).get(s);if(o.ways.add(t.id),!!b_(t))for(let a of[r-1,r+1]){if(a<0||a>=t.points.length)continue;let c=t.points[a][0]-i[0],l=t.points[a][1]-i[1],u=Math.hypot(c,l);u>.001&&o.branches.push({dir:[c/u,l/u],half:t.section.coreHalfWidth,way:t.id})}});return e}function sf(n,e,t,i){let r=Ps(n.points),s=[];return n.points.forEach((o,a)=>{let c=t.get(el(o));if(!c)return;let l=n.points[Math.max(0,a-1)],u=n.points[Math.min(n.points.length-1,a+1)],f=u[0]-l[0],h=u[1]-l[1],m=Math.hypot(f,h)||1,g=0;for(let x of c.branches){if(x.way===n.id)continue;let d=(f*x.dir[1]-h*x.dir[0])/m;Math.abs(d)<.5||i!==0&&Math.sign(d)!==i||(g=Math.max(g,x.half+.4))}if(g>0){let x=g+(i===0?e.width/2:0);s.push([r[a]-x,r[a]+x])}}),s}function lf(n,e,t={}){let i=t.step??3,r={asphalt:Ot(),klinker:Ot(),cycle:Ot(),paving:Ot(),gravel:Ot(),paint:Ot(),kerb:Ot(),stats:{ways:0,bands:0,metres:0,widthFromTags:0,sidewalkFromTags:0,trims:0}},s=M_(n),o=new Set;for(let a of n){if(t.only&&!t.only(a))continue;r.stats.ways++,a.section.source.width!=="prior"&&r.stats.widthFromTags++,a.section.source.sidewalk==="tag"&&r.stats.sidewalkFromTags++;let c=Ps(a.points);r.stats.metres+=c[c.length-1];let l=a.tags.footway==="crossing";for(let u of a.section.bands){if(l)break;r.stats.bands++;let f=r[u.surface];if(u.raised>0){let m=u.kerb==="both"?0:u.offset>0?1:-1,g=sf(a,u,s,m);r.stats.trims+=g.length;let x=wi.raisedBase+u.raised;for(let d of Ka(a.points,g)){Is(f,d,u.offset,u.width,e,x,{step:i});let p=u.offset-Math.sign(u.offset||1)*u.width/2;u.kerb==="both"?(Qa(r.kerb,d,u.width/2,e,x,0,1,{step:i}),Qa(r.kerb,d,-u.width/2,e,x,0,-1,{step:i})):Qa(r.kerb,d,p,e,x,0,u.offset>0?-1:1,{step:i});let M=d.length,S=of(d[0],d[1]),v=of(d[M-2],d[M-1]);iu(r.kerb,d[0],S,u.offset,u.width,e,x,0,!1),iu(r.kerb,d[M-1],v,u.offset,u.width,e,x,0,!0)}continue}let h=u.kind==="carriageway"?wi.carriageway:u.kind==="cycle_lane"?wi.cycleLane:l?wi.crossing:wi.path;if(Is(f,a.points,u.offset,u.width,e,h,{step:i}),u.kind==="carriageway"||u.offset===0)for(let m of[a.points[0],a.points[a.points.length-1],...a.points.filter(g=>(s.get(el(g))?.ways.size??0)>1)]){let g=`${el(m)}:${u.surface}:${u.width.toFixed(1)}`;o.has(g)||(o.add(g),tf(f,m,u.width/2,e,h-.001,14))}}for(let u of a.section.paint){let f=l?[]:sf(a,{kind:"carriageway",surface:"asphalt",offset:u.offset,width:0,raised:0,kerb:"none"},s,0);for(let h of Ka(a.points,f))S_(r.paint,h,u.offset,u.width,u.dash,e,wi.paint)}}return r}var of=(n,e)=>{let t=e[0]-n[0],i=e[1]-n[1],r=Math.hypot(t,i)||1;return[t/r,i/r]};function S_(n,e,t,i,r,s,o){if(!r){Is(n,e,t,i,s,o,{step:3});return}let a=Ps(e),c=a[a.length-1],[l,u]=r,f=[];for(let h=l;h<c;h+=l+u)f.push([h,h+u]);for(let h of Ka(e,f))Is(n,h,t,i,s,o,{step:3})}function cf(n,e){let t=Ot();for(let i of n.polygons){let r=[],s=[];i.forEach((c,l)=>{l&&s.push(r.length/2);for(let u of c)r.push(u[0],u[1])});let o=t.positions.length/3;for(let c=0;c<r.length;c+=2)Ht(t,r[c],r[c+1],e);let a=Qn(r,s,2);for(let c=0;c<a.length;c+=3){let l=a[c],u=a[c+1],f=a[c+2],h=(r[u*2]-r[l*2])*(r[f*2+1]-r[l*2+1])-(r[u*2+1]-r[l*2+1])*(r[f*2]-r[l*2])>0;t.indices.push(o+l,o+(h?u:f),o+(h?f:u))}}return t}var ru={coping:[.64,.61,.56],brick:[.48,.35,.29],algae:[.24,.29,.25]};function uf(n,e,t,i=2){let r=Ot(!0);for(let s of n.shores){let o=ja(s,i);for(let a=0;a+1<o.length;a++){let c=o[a],l=o[a+1],u=l[0]-c[0],f=l[1]-c[1],h=Math.hypot(u,f);if(h<.001)continue;let m=f/h,g=-u/h,x=Math.max(e(c[0]+m*.5,c[1]+g*.5),e(c[0],c[1])),d=Math.max(e(l[0]+m*.5,l[1]+g*.5),e(l[0],l[1]));if(Math.max(x,d)<t+.15)continue;let p=w=>{let E=Math.max(w-.25,t+.36),R=t+.35;return[w,Math.min(w,E),Math.min(w,R),t-.25]},M=p(x),S=p(d),v=[ru.coping,ru.brick,ru.algae];for(let w=0;w<3;w++){if(M[w]-M[w+1]<.001&&S[w]-S[w+1]<.001)continue;let E=Ht(r,c[0],c[1],M[w],v[w]),R=Ht(r,l[0],l[1],S[w],v[w]),_=Ht(r,l[0],l[1],S[w+1],v[w]),A=Ht(r,c[0],c[1],M[w+1],v[w]);r.indices.push(E,_,A,E,R,_)}}}return r}function hf(n,e,t){return[n.origin[0]+e/n.metresPerDegree[0],n.origin[1]+t/n.metresPerDegree[1]]}function df(n,e,t){return[(e-n.origin[0])*n.metresPerDegree[0],(t-n.origin[1])*n.metresPerDegree[1]]}function w_(n,e){return`${n}_${e}`}function ff(n,e,t,i){let r=n.cellSizeM,s=[];for(let[o,a]of n.cells){let c=Math.max(o*r,Math.min(e,(o+1)*r)),l=Math.max(a*r,Math.min(t,(a+1)*r));Math.hypot(c-e,l-t)<=i&&s.push(w_(o,a))}return s}function pf(n){let e=n;if(!e||e.version!==1||!Array.isArray(e.cells)||!Array.isArray(e.origin)||!Array.isArray(e.metresPerDegree)||!(e.cellSizeM>0)||!(e.quayFreeboardM>0&&e.quayFreeboardM<6))throw new Error("Invalid canal elevation index");return e}var mf=-1.77,su=()=>0;function gf(n){for(let e of $d){let[t,i]=_t(e.lng,e.lat);if(Math.abs(n[0]-t)<=e.halfM&&Math.abs(n[1]-i)<=e.halfM)return e}return null}var tl={asphalt:"#5f6266",klinker:"#8e6b5c",cycle:"#a5544b",paving:"#b9b0a2",gravel:"#ab9f88",paint:"#f1efe6",kerb:"#9c978e",park:"#9cbf78",wood:"#7fa262",square:"#c7beb0",parking:"#8f9094",water:"#3f6b78",quay:"#7a5a49"};function nl(n,e,t){if(!n.indices.length)return null;let i=new St;i.setAttribute("position",new Ke(Float32Array.from(n.positions),3)),i.setIndex(new Ke(Uint32Array.from(n.indices),1)),n.colors&&i.setAttribute("color",new Ke(Float32Array.from(n.colors,s=>s**2.2),3)),i.computeVertexNormals();let r=new ut(i,new Kr({color:n.colors?"#ffffff":e,vertexColors:!!n.colors}));return r.renderOrder=t,r}function xf(n,e){let t=(s,o)=>{let[a,c]=hf(n,s,o);return _t(a,c)},i=n.quantization.xy,r={polygons:[],shores:[]};for(let s of e){let o=s.cell[0]*n.cellSizeM,a=s.cell[1]*n.cellSizeM,c=l=>{let u=[];for(let f=0;f<l.length;f+=2)u.push(t(o+l[f]*i,a+l[f+1]*i));return u};for(let l of s.water)r.polygons.push(l.map(c));for(let l of s.shore)r.shores.push(c(l))}return r}function yf(n,e,t,i){let r=performance.now(),s=d=>Math.hypot(d[0]-t[0],d[1]-t[1])<i,o=d=>_t(d[0],d[1]),a=new tn,c=d=>{d&&a.add(d)},l=0,u={park:Ot(),wood:Ot(),square:Ot(),parking:Ot()};for(let d of n.areas){let p=d.kind==="grass"?u.park:d.kind==="paved"?u.square:u[d.kind];if(p)for(let M of d.rings){let S=M.slice(0,-1).map(o);if(S.length<3||!S.some(s))continue;let v=S.flatMap(w=>[w[0],w[1]]);nf(p,v,Qn(v),su,wi.area,8)}}for(let[d,p]of Object.entries(u))l+=Cr(p),c(nl(p,tl[d],20));let f=af(n.ways,o).filter(d=>d.points.some(s)),h=lf(f,su,{step:6});for(let d of["paving","klinker","asphalt","cycle","gravel","kerb","paint"])l+=Cr(h[d]),c(nl(h[d],tl[d],21));let m={polygons:e.polygons.filter(d=>d[0].some(s)),shores:e.shores.flatMap(d=>{let p=[[]];for(let M of d)s(M)?p[p.length-1].push(M):p[p.length-1].length&&p.push([]);return p.filter(M=>M.length>1)})},g=cf(m,mf),x=uf({polygons:[],shores:m.shores},su,mf,4);return l+=Cr(g)+Cr(x),c(nl(g,tl.water,19)),c(nl(rf([x]),tl.quay,19)),{group:a,stats:{box:n.box,ways:f.length,triangles:l,buildMs:Math.round(performance.now()-r)}}}function Pr(n){let e=0;for(let t=1;t<n.length;t++)e+=Math.hypot(n[t][0]-n[t-1][0],n[t][1]-n[t-1][1]);return e}var E_=["2"];var T_={tram:"Tram",metro:"Metro",ferry:"Ferry"};function _f(n){return n.replace(/^Amsterdam,\s*/i,"").trim()||n}function A_(n,e){return`${T_[n]} ${e}`}function R_(n,e){if(n&&n.length>0){let s=n[Math.floor(n.length/2)];return[s[0],s[1]]}let t=e.filter(s=>s.center);if(t.length===0)return[52.37,4.89];let i=t.reduce((s,o)=>s+o.center[0],0)/t.length,r=t.reduce((s,o)=>s+o.center[1],0)/t.length;return[i,r]}function vf(n,e={}){let t=e.cityId||n.cityId||"amsterdam",i=e.playableRefs===void 0?new Set(E_):e.playableRefs.length===0?null:new Set(e.playableRefs),r=e.playableModes?.length?new Set(e.playableModes):null,s=[],o=[],a=new Map,c=new Map,l=new Map;for(let x of n.lines){let d=A_(x.mode,x.ref),p=x.stopIds.map(w=>n.stops[w]).filter(w=>!!w),M=R_(x.path,p);s.push({routeId:x.routeId,ref:x.ref,name:d,mode:x.mode,headsign:x.headsign,color:x.color,stopIds:[...x.stopIds],center:M});for(let w of x.stopIds)c.has(w)||c.set(w,new Set),c.get(w).add(x.ref),l.has(w)||l.set(w,new Set),l.get(w).add(x.mode);let S=!i||i.has(x.ref),v=!r||r.has(x.mode);!S||!v||!x.path||x.path.length<2||(a.set(d,{name:d,type:"line",cityId:t,center:M,ref:x.ref,mode:x.mode,color:x.color}),o.push({id:`transit:${x.routeId}`,nodes:x.path.map(([w,E])=>({lat:w,lon:E})),tags:{name:d,highway:x.mode},highway:x.mode}))}let u=new Set;for(let x of n.lines){let d=!i||i.has(x.ref),p=!r||r.has(x.mode);if(!(!d||!p))for(let M of x.stopIds)u.add(M)}let f=[];for(let[x,d]of Object.entries(n.stops))d.center&&((i||r)&&!u.has(x)||f.push({stopId:x,name:_f(d.name),rawName:d.name,center:d.center,lineRefs:[...c.get(x)||[]],modes:[...l.get(x)||[]]}));let h=[...new Set(s.map(x=>x.name))],m=[...new Set(Object.values(n.stops).filter(x=>x.center).map(x=>_f(x.name)))],g=s.filter(x=>{let d=!i||i.has(x.ref),p=!r||r.has(x.mode);return d&&p});return{ways:o,featureMeta:a,stops:f,lines:g,lineDistractors:h,stopDistractors:m}}var Ls="transit-network";function Ds(n,e){return["interpolate",["linear"],["zoom"],13,n,18,e]}function bf(n){return{type:"FeatureCollection",features:n.filter(e=>e.coordinates.length>=2).map(e=>{let t=e.mode==="metro"?"underground":"surface";return{type:"Feature",properties:{name:e.name,mode:e.mode,grade:t,color:e.color||(t==="underground"?"#F59E0B":"#E11D48")},geometry:{type:"LineString",coordinates:e.coordinates}}})}}function Mf(){return[{id:"transit-network-surface-casing",type:"line",source:Ls,filter:["==",["get","grade"],"surface"],layout:{"line-cap":"round","line-join":"round",visibility:"none"},paint:{"line-color":"#3F0D1C","line-width":Ds(7,18),"line-opacity":.88}},{id:"transit-network-surface",type:"line",source:Ls,filter:["==",["get","grade"],"surface"],layout:{"line-cap":"round","line-join":"round",visibility:"none"},paint:{"line-color":["coalesce",["get","color"],"#E11D48"],"line-width":Ds(3.5,11),"line-opacity":.95}},{id:"transit-network-tunnel-under",type:"line",source:Ls,filter:["==",["get","grade"],"underground"],layout:{"line-cap":"round","line-join":"round",visibility:"none"},paint:{"line-color":"#92400E","line-width":Ds(4,12),"line-opacity":.35,"line-dasharray":[1,1.4]}}]}function Sf(){return[{id:"transit-network-tunnel-casing",type:"line",source:Ls,filter:["==",["get","grade"],"underground"],layout:{"line-cap":"round","line-join":"round",visibility:"none"},paint:{"line-color":"rgba(15, 23, 42, 0.72)","line-width":Ds(6,16),"line-opacity":.85,"line-dasharray":[1.2,1.6]}},{id:"transit-network-tunnel",type:"line",source:Ls,filter:["==",["get","grade"],"underground"],layout:{"line-cap":"round","line-join":"round",visibility:"none"},paint:{"line-color":["coalesce",["get","color"],"#F59E0B"],"line-width":Ds(2.8,9),"line-opacity":.92,"line-dasharray":[1.2,1.6]}}]}var N1=Math.cos(25*Math.PI/180);var C_="answered-street";function ou(){return{id:"answered-street-name",type:"symbol",source:C_,layout:{"text-field":["upcase",["get","name"]],"text-font":["Noto Sans Bold"],"text-size":["interpolate",["exponential",2],["zoom"],15,6,18,48,20,192],"text-letter-spacing":.1,"text-rotate":["get","bearing"],"text-pitch-alignment":"map","text-rotation-alignment":"map","text-keep-upright":!1,"text-allow-overlap":!0,"text-ignore-placement":!0},paint:{"text-color":"#FBF7EC","text-opacity":.92,"text-halo-color":["case",["get","correct"],"#15803D","#B91C1C"],"text-halo-width":1.4}}}var au=[120];function wf(n,e,t=au){let i=null;for(let d of n)for(let p=0;p<d.length-1;p++){let M=d[p],S=d[p+1],v=S.x-M.x,w=S.y-M.y,E=v*v+w*w||1,R=Math.max(0,Math.min(1,((e.x-M.x)*v+(e.y-M.y)*w)/E)),_=Math.hypot(M.x+v*R-e.x,M.y+w*R-e.y);(!i||_<i.dist)&&(i={chain:d,index:p,t:R,dist:_})}if(!i)return[];let{chain:r,index:s,t:o}=i,a=r[s],c=r[s+1],l=(c.x-a.x)*Math.cos(e.angle)+(c.y-a.y)*Math.sin(e.angle)>=0,f=[{x:a.x+(c.x-a.x)*o,y:a.y+(c.y-a.y)*o}];if(l)for(let d=s+1;d<r.length;d++)f.push(r[d]);else for(let d=s;d>=0;d--)f.push(r[d]);let h=[],m=[...t].sort((d,p)=>d-p),g=0,x=0;for(let d=1;d<f.length&&x<m.length;d++){let p=f[d-1],M=f[d],S=Math.hypot(M.x-p.x,M.y-p.y);for(;x<m.length&&g+S>=m[x];){let v=S?(m[x]-g)/S:0;h.push({x:p.x+(M.x-p.x)*v,y:p.y+(M.y-p.y)*v,angle:Math.atan2(M.y-p.y,M.x-p.x)}),x++}g+=S}return h}var P_=3;function Tf(n){if(typeof n=="number")return{stops:[[0,n]],linear:!0};if(!Array.isArray(n)||n[0]!=="interpolate")return null;let e=n[1],t=[];for(let i=3;i+1<n.length;i+=2)t.push([Number(n[i]),Number(n[i+1])]);return{stops:t,linear:e?.[0]==="linear"}}function qi(n,e){if(e<=n[0][0])return n[0][1];for(let t=1;t<n.length;t++){let[i,r]=n[t];if(e<=i){let[s,o]=n[t-1];return o+(r-o)*(e-s)/(i-s)}}return n[n.length-1][1]}var I_=n=>typeof n=="string"&&/^(#([0-9a-f]{3}|[0-9a-f]{6})|rgba?\(.*\))$/i.test(n);function Ef(n,e){let t=n.paint,i=n.filter,r=Tf(t["line-width"]),s=t["line-color"];return{fallback:Array.isArray(s)?String(s[2]):null,grade:String(i?.[2]??""),spec:{id:String(n.id),above:e,color:typeof s=="string"?s.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]*\)/,"rgb($1,$2,$3)"):null,width:r.stops,linear:r.linear,opacity:Number(t["line-opacity"]??1)*(typeof s=="string"?Number(/rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(s)?.[1]??1):1),dash:Array.isArray(t["line-dasharray"])?[Number(t["line-dasharray"][0]),Number(t["line-dasharray"][1])]:null}}}function Af(n,e={}){let t=vf(n,{playableRefs:e.playableRefs??[],playableModes:e.modes??["tram","metro"]}),i=t.ways.map(o=>{let a=o.tags?.name?t.featureMeta.get(o.tags.name):void 0;return{name:o.tags?.name||o.id,mode:o.highway||a?.mode||"tram",color:a?.color,coordinates:o.nodes.map(c=>[c.lon,c.lat])}}),r=bf(i).features;return[...Mf().map(o=>Ef(o,!1)),...Sf().map(o=>Ef(o,!0))].map(({spec:o,grade:a,fallback:c})=>({spec:o,lines:r.filter(l=>l.properties.grade===a).map(l=>({color:o.color??(I_(l.properties.color)?l.properties.color:c??"#E11D48"),points:l.geometry.coordinates.map(([u,f])=>_t(u,f))}))}))}var Ns={id:"ferry-lines",color:"#5b8fbf",width:[[11,.8],[14,1.4],[18,2.4]],linear:!0,opacity:.85,dash:[2.5,2],above:!1};function Rf(n){let e=[],t=new Map;for(let i of n.lines)if(i.mode==="ferry"){i.path&&i.path.length>1&&e.push(i.path.map(([r,s])=>_t(s,r)));for(let r of i.stopIds){let s=n.stops[r];if(!s?.center)continue;let o=s.name.replace(/^Amsterdam,\s*/i,"").trim()||s.name;[...t.values()].some(a=>a.name===o)||t.set(r,{id:r,name:o,at:_t(s.center[1],s.center[0])})}}return{lines:e,terminals:[...t.values()]}}var Cf=n=>`${n} \u26F4`;function Pf(n,e){let t=n.filter(i=>!e(i.name));return $a(t).map(i=>({...i,at:_t(i.center[1],i.center[0])}))}var If={"albert-heijn":"brand-icons/albert-heijn.svg"};function Lf(n=52.37){let e=ou(),t=Tf(e.layout["text-size"]).stops,[i,r]=t[1],s=2*Math.PI*63710088e-1*Math.cos(n*Math.PI/180)/(512*2**i);return r*s}var Ir=(()=>{let n=ou().paint,e=n["text-halo-color"];return{fill:String(n["text-color"]),opacity:Number(n["text-opacity"]),correct:String(e[2]),wrong:String(e[3]),letterSpacingEm:.1}})();function Df(n,e,t=au[0]/P_){let i=a=>({x:a[0],y:-a[1]}),r=e.bearing*Math.PI/180,s=Math.atan2(-Math.cos(r),Math.sin(r));return wf(n.map(a=>a.map(i)),{x:e.at[0],y:-e.at[1],angle:s},[t]).map(a=>({at:[a.x,-a.y],bearing:(Math.atan2(Math.cos(a.angle),-Math.sin(a.angle))*180/Math.PI+360)%360}))}var Nf=n=>n.material.uniforms,Yt={landuse:0,park:10,water:12,pier:13,hood:14,casing:20,fill:30,rail:40,ferry:42,transit:44,answered:48,route:50,above:60},il=class{constructor(e){this.data=e;this.group.name="own-map-flat";let t=[...e.landuse].sort((o,a)=>qa[o.cls].order-qa[a.cls].order);t.length&&this.fill(Ts(t.map(o=>o.rings),t.map(o=>qa[o.cls].fill)),"#ffffff",Yt.landuse,!0),this.fill(Ts(e.parks.flatMap(o=>o.rings.map(a=>[a]))),on.park,Yt.park),this.fill(Ts(e.water),on.water,Yt.water),e.piers.length&&this.fill(Ts(e.piers.map(o=>[o])),Za.fill,Yt.pier),e.pierLines.length&&this.lines("piers",e.pierLines,Za.fill,Yt.pier,{width:Za.width,opacity:1,dash:null,minZoom:13}),e.hoodRings.length&&this.lines("hood-boundaries",e.hoodRings,Er.color,Yt.hood,{width:Er.width,linear:!0,opacity:Er.opacity,dash:Er.dash,minZoom:Er.minZoom,blend:!0});let i=[...Pc].sort((o,a)=>On[o].order-On[a].order);for(let o of i){let a=On[o],c=e.streets.filter(f=>f.cls===o).map(f=>f.points);this.stats[`street:${o}`]=c.length;let l=As(c),u=this.lines(`street-${o}`,l,a.fill,Yt.fill+a.order,{width:a.width,opacity:1,dash:null,minZoom:0});a.casing&&this.lines(`street-${o}-casing`,l,a.casing,Yt.casing+a.order,{width:a.width,extra:a.casingExtra,opacity:1,dash:null,minZoom:0,casingOf:u})}let r=(o,a)=>(Ya[o].width.find(([c])=>c===18)?.[1]??3)/3*(a?.6:1),s=[{id:"rail",pick:o=>!o.tunnel&&o.kind!=="tram",style:"rail",tunnel:!1},{id:"rail-tram",pick:o=>!o.tunnel&&o.kind==="tram",style:"tram",tunnel:!1},{id:"rail-tunnel",pick:o=>o.tunnel,style:"rail",tunnel:!0}];for(let o of s){let a=e.rail.filter(o.pick);if(!a.length)continue;let c=a.map(l=>o.style==="tram"?l.service?.6:1:r(l.kind,l.service));this.lines(o.id,As(a.map(l=>l.points),void 0,c),Ya[o.style].fill,Yt.rail+(o.tunnel?0:1),{width:Ya[o.style].width,opacity:o.tunnel?$c.opacity:1,dash:o.tunnel?$c.dash:null,minZoom:0,blend:o.tunnel,perLineScale:!0});for(let l of a)this.stats[`rail:${l.kind}`]=(this.stats[`rail:${l.kind}`]??0)+1}}group=new tn;stats={};layers=[];transit=[];route=[];answered=null;fill(e,t,i,r=!1){let s=new ut(e,Pd(t,0,{vertexColor:r}));return s.renderOrder=i,s.frustumCulled=!1,this.group.add(s),s}lines(e,t,i,r,s,o=this.layers){let a=t instanceof St?t:As(t,s.colors),c=new ut(a,Id(i,s.z??0,{dash:!!s.dash,vertexColor:!!s.colors,blend:s.blend,scale:s.perLineScale}));c.renderOrder=r,c.frustumCulled=!1,s.above&&(c.material.depthTest=!1),this.group.add(c);let l={id:e,mesh:c,width:s.width,linear:s.linear,scale:s.scale,extra:s.extra,opacity:s.opacity,dash:s.dash,minZoom:s.minZoom,casingOf:s.casingOf};return o.push(l),l}drop(e){for(let t of e)this.group.remove(t.mesh),t.mesh.geometry.dispose(),t.mesh.material.dispose();e.length=0}setFerryLines(e){this.lines("ferry-lines",e,Ns.color,Yt.ferry,{width:Ns.width,linear:!0,opacity:Ns.opacity,dash:Ns.dash,minZoom:10,blend:!0}),this.stats.ferryLines=e.length}setTransit(e){this.drop(this.transit),e&&(e.forEach((t,i)=>{t.lines.length&&this.lines(t.spec.id,t.lines.map(r=>r.points),t.spec.color??"#E11D48",(t.spec.above?Yt.above:Yt.transit)+i*.1,{width:t.spec.width,linear:t.spec.linear,opacity:t.spec.opacity,dash:t.spec.dash,minZoom:0,above:t.spec.above,blend:!0,colors:t.lines.map(r=>r.color)},this.transit)}),this.stats.transitLines=e.reduce((t,i)=>t+i.lines.length,0))}setRoute(e){if(this.drop(this.route),!e||e.length<2)return;let t=As([e]);this.lines("route-casing",t,"#03121c",Yt.route,{width:Yc,extra:4,opacity:.75,dash:null,minZoom:0,z:.3},this.route),this.lines("route-line",t,on.route,Yt.route+1,{width:Yc,opacity:1,dash:null,minZoom:0,z:.32},this.route);for(let i of this.route)Nf(i.mesh).uNear={value:0}}setAnswered(e,t,i,r=52.37){this.answered&&(this.group.remove(this.answered),this.answered.geometry.dispose(),this.answered.material.map?.dispose(),this.answered=null);let s=t[0];!e||!s||(this.answered=Ld(e.toUpperCase(),{heightM:Lf(r),bearing:s.bearing,at:s.at,fill:Ir.fill,halo:i?Ir.correct:Ir.wrong,opacity:Ir.opacity,letterSpacingEm:Ir.letterSpacingEm}),this.answered.renderOrder=Yt.answered,this.group.add(this.answered))}update(e,t){for(let i of[this.layers,this.transit,this.route])for(let r of i){let o=(r.linear?qi(r.width,e):Xa(r.width,e))*(r.scale??1),a=e>=r.minZoom&&o>=Od&&(!r.casingOf||o>1.2);if(r.mesh.visible=a,!a)continue;let c=Nf(r.mesh),l=o+(r.extra??0);c.uHalf.value=l/2*t,c.uOpacity.value=r.opacity*Math.min(1,o/.9),r.dash&&c.uDash.value.set(r.dash[0]*Math.max(1,l)*t,r.dash[1]*Math.max(1,l)*t)}}};var lu=class{constructor(e=48){this.cell=e}cells=new Map;keys(e){let t=[];for(let i=Math.floor(e[0]/this.cell);i<=Math.floor(e[2]/this.cell);i++)for(let r=Math.floor(e[1]/this.cell);r<=Math.floor(e[3]/this.cell);r++)t.push(i*65536+r);return t}hits(e){for(let t of this.keys(e))for(let i of this.cells.get(t)??[])if(e[0]<i[2]&&e[2]>i[0]&&e[1]<i[3]&&e[3]>i[1])return!0;return!1}insert(e){for(let t of this.keys(e)){let i=this.cells.get(t);i?i.push(e):this.cells.set(t,[e])}}},Ff=(n,e,t)=>n[0]>=0&&n[1]>=0&&n[2]<=e&&n[3]<=t;function L_(n,e,t,i,r){let s=i.reduce((l,u)=>l+u,0),o=t-s/2;if(o<0||t+s/2>e[e.length-1])return null;let a=[],c=0;for(let l=0;l<r.length;l++){let u=o+i[l]/2;for(;c<e.length-2&&e[c+1]<u;)c++;let f=n[c],h=n[c+1],m=e[c+1]-e[c]||1,g=(u-e[c])/m;a.push({ch:r[l],x:f.x+(h.x-f.x)*g,y:f.y+(h.y-f.y)*g,angle:Math.atan2(h.y-f.y,h.x-f.x)}),o+=i[l]}return a}function Uf(n,e){let{width:t,height:i,zoom:r}=e,s=e.padding??2,o=e.repeatDistance??280,a=(e.maxGlyphTurn??35)*Math.PI/180,c=new lu;for(let x of e.blocked??[])c.insert([x[0],x[1],x[2],x[3]]);let l=new Map,u=[],f=n.filter(x=>(x.minZoom??0)<=r&&r<(x.maxZoom??99)).slice().sort((x,d)=>d.priority-x.priority||(x.id<d.id?-1:1)),h=(x,d,p)=>(l.get(x)??[]).some(M=>Math.hypot(M.x-d,M.y-p)<o),m=(x,d,p)=>{let M=l.get(x);M?M.push({x:d,y:p}):l.set(x,[{x:d,y:p}])},g=x=>{let d=[...x.text],p=d.map(M=>e.advance(M,x.kind));return{chars:d,advances:p,textW:p.reduce((M,S)=>M+S,0)}};for(let x of f){let d=e.fontSize(x.kind,r);if(x.at){let S=e.project(x.at);if(S.depth<=0||e.maxDepth&&S.depth>e.maxDepth||S.x<-50||S.x>t+50||S.y<0||S.y>i||x.text&&h(x.text,S.x,S.y))continue;let v=[],w=S.x,E=S.y;if(x.text){let{textW:R}=g(x),_=(x.offsetEm??0)*d+(x.anchor==="top"?d/2:x.anchor==="bottom"?-d/2:0);E=S.y+_,v.push([w-R/2-s,E-d/2-s,w+R/2+s,E+d/2+s])}if(x.icon){let R=x.icon.size/2;v.push([S.x-R,S.y-R,S.x+R,S.y+R])}if(!v.length||!x.overlap&&v.some(R=>!Ff(R,t,i)||c.hits(R)))continue;if(!x.overlap)for(let R of v)c.insert(R);x.text&&m(x.text,w,E),u.push({id:x.id,text:x.text,kind:x.kind,size:d,x:w,y:E,...x.icon?{icon:x.icon,ix:S.x,iy:S.y}:{}});continue}if(!x.path||x.path.length<2)continue;let p=[[]];for(let S of x.path){let v=e.project(S);v.depth>0&&(!e.maxDepth||v.depth<e.maxDepth)?p[p.length-1].push({x:v.x,y:v.y}):p[p.length-1].length&&p.push([])}let M=null;for(let S of p){if(S.length<2)continue;let v=1/0,w=1/0,E=-1/0,R=-1/0;for(let N of S)v=Math.min(v,N.x),E=Math.max(E,N.x),w=Math.min(w,N.y),R=Math.max(R,N.y);if(E<0||R<0||v>t||w>i||Math.hypot(E-v,R-w)<x.text.length*d*.45)continue;M??=g(x);let{chars:_,advances:A,textW:I}=M,C=S[S.length-1].x<S[0].x?S.slice().reverse():S,U=[0];for(let N=1;N<C.length;N++)U.push(U[N-1]+Math.hypot(C[N].x-C[N-1].x,C[N].y-C[N-1].y));let X=U[U.length-1];if(X<I*1.15)continue;let Y=[X/2];for(let N=I;N<X/2;N+=I)Y.push(X/2-N,X/2+N);for(let N of Y){let G=L_(C,U,N,A,_);if(!G)continue;let H=!1;for(let ee=1;ee<G.length&&!H;ee++){let ce=G[ee].angle-G[ee-1].angle;ce=Math.atan2(Math.sin(ce),Math.cos(ce)),Math.abs(ce)>a&&(H=!0)}if(H||G.some(ee=>Math.cos(ee.angle)<-.2))continue;let K=G.map(ee=>[ee.x-d*.55-s,ee.y-d*.55-s,ee.x+d*.55+s,ee.y+d*.55+s]),Q=G[G.length>>1];if(!(K.some(ee=>!Ff(ee,t,i)||c.hits(ee))||h(x.text,Q.x,Q.y))){for(let ee of K)c.insert(ee);m(x.text,Q.x,Q.y),u.push({id:x.id,text:x.text,kind:x.kind,size:d,glyphs:G});break}}}}return u}function Of(n,e,t){n.textAlign="center",n.textBaseline="middle",n.lineJoin="round";for(let i of e){let r=t[i.kind];if(n.font=r.font(i.size),n.strokeStyle=r.halo,n.lineWidth=r.haloWidth*2,n.fillStyle=r.fill,i.glyphs)for(let s of[0,1])for(let o of i.glyphs)n.save(),n.translate(o.x,o.y),n.rotate(o.angle),s===0?n.strokeText(o.ch,0,0):n.fillText(o.ch,0,0),n.restore();else i.icon&&n.drawImage(i.icon.image,i.ix-i.icon.size/2,i.iy-i.icon.size/2,i.icon.size,i.icon.size),i.text&&(n.strokeText(i.text,i.x,i.y),n.fillText(i.text,i.x,i.y))}}var Yi='"Helvetica Neue", Arial, sans-serif',Bf={street:{font:n=>`600 ${n}px ${Yi}`,fill:"#34424d",halo:"rgba(255,255,255,.92)",haloWidth:1.8},water:{font:n=>`italic 500 ${n}px ${Yi}`,fill:"#2f5f86",halo:"rgba(236,244,250,.9)",haloWidth:1.6},poi:{font:n=>`400 ${n}px ${Yi}`,fill:"#34424d",halo:"rgba(255,255,255,.92)",haloWidth:1.6},hood:{font:n=>`700 ${n}px ${Yi}`,fill:"#6D28D9",halo:"rgba(255,255,255,.9)",haloWidth:2},brand:{font:n=>`700 ${n}px ${Yi}`,fill:"#E0F2FE",halo:"#071E2B",haloWidth:2},food:{font:n=>`400 ${n}px ${Yi}`,fill:"#C9DDE5",halo:"#071E2B",haloWidth:2},ferry:{font:n=>`600 ${n}px ${Yi}`,fill:"#153c54",halo:"#f2f0e7",haloWidth:2}};function kf(n,e){switch(n){case"hood":return Math.round(qi([[13,11],[17,16]],e));case"poi":return Math.round(qi([[16.5,10],[18,12]],e));case"food":return Math.round(qi([[16,10],[18,12]],e));case"brand":return 10;case"ferry":return 12;default:return Math.round(Xa([[13,10.5],[16,12],[18,14.5]],e))}}var D_={major:12.5,secondary:13.5,tertiary:14.5,minor:15.3,service:16.8,cycle:16.3,path:17},Lr=500,rl=class{constructor(e,t,i){this.data=e;this.ctx=t;this.measure=i;this.rebuild()}buckets=new Map;advanceCache=new Map;zoom=0;stats={street:0,water:0,poi:0,hood:0,brand:0,food:0,ferry:0,withheld:0,withheldOverlay:0};extra={};setContext(e){this.ctx=e,this.rebuild()}setPois(e){this.extra.pois=e,this.rebuild()}setBranded(e,t){this.extra.branded={pois:e,icons:t},this.rebuild()}setFerryTerminals(e,t){this.extra.ferry={terminals:e,pin:t},this.rebuild()}add(e){let t=e.path??[e.at],i=new Set(t.map(([r,s])=>`${Math.floor(r/Lr)},${Math.floor(s/Lr)}`));for(let r of i){let s=this.buckets.get(r);s?s.push(e):this.buckets.set(r,[e])}}rebuild(){let{ctx:e,data:t}=this;this.buckets.clear();let i={street:0,water:0,poi:0,hood:0,brand:0,food:0,ferry:0,withheld:0,withheldOverlay:0},r=s=>!!e.hiddenName&&!Rr({...e,isLabelled:()=>!0},s,0,0);if(t.streets.forEach((s,o)=>{if(!s.name)return;let a=s.points[s.points.length>>1];if(!Rr(e,s.name,a[0],a[1])){r(s.name)&&i.withheld++;return}i.street++,this.add({id:`s${o}`,text:s.name,kind:"street",priority:(On[s.cls].order+1)*1e3+Math.min(999,Pr(s.points)/10),path:s.points,minZoom:D_[s.cls]})}),t.waterLines.forEach((s,o)=>{let a=s.points[s.points.length>>1];if(!Rr(e,s.name,a[0],a[1])){r(s.name)&&i.withheld++;return}i.water++,this.add({id:`w${o}`,text:s.name,kind:"water",priority:8e3+Math.min(999,Pr(s.points)/10),path:s.points,minZoom:Pr(s.points)>1500?12.5:14.5})}),Zd(e)&&t.hoods.forEach((s,o)=>{i.hood++,this.add({id:`h${o}`,text:s.name.toUpperCase(),kind:"hood",priority:9e3,at:s.at,minZoom:13,maxZoom:18.5})}),this.extra.pois&&Gd(this.extra.pois,o=>!Xd(e,o)).features.forEach((o,a)=>{i.poi++;let[c,l]=_t(o.geometry.coordinates[0],o.geometry.coordinates[1]);this.add({id:`p${a}`,text:o.properties.name,kind:"poi",priority:o.properties.rank,at:[c,l,Jc[o.properties.band]??0],minZoom:16.5,anchor:"top",offsetEm:.45})}),this.extra.branded){let{pois:s,icons:o}=this.extra.branded,a=l=>!qd(e,l),c=s.filter(l=>!a(l.name)).length;i.withheldOverlay+=s.length-c;for(let l of Pf(s,a)){let u=[l.at[0],l.at[1],Wd];if(l.kind==="albert-heijn"){let f=o[l.kind];f&&(i.brand++,this.add({id:`bi${l.id}`,text:"",kind:"brand",priority:50,at:u,minZoom:15.5,icon:{image:f,size:0}})),e.quizQuiet||this.add({id:`bl${l.id}`,text:l.name,kind:"brand",priority:40,at:u,minZoom:17,anchor:"bottom",offsetEm:-1.7})}else l.kind==="local-food"&&!e.quizQuiet&&(i.food++,this.add({id:`f${l.id}`,text:l.name,kind:"food",priority:20+(l.orientationScore??0),at:u,minZoom:16}))}}if(this.extra.ferry)for(let s of this.extra.ferry.terminals){if(!Yd(e,s.name)){i.withheldOverlay++;continue}i.ferry++,this.add({id:`ft${s.id}`,text:Cf(s.name),kind:"ferry",priority:9500,at:s.at,minZoom:11,offsetEm:1.4,icon:{image:this.extra.ferry.pin,size:16}})}this.stats=i}advance=(e,t)=>{let i=kf(t,this.zoom),r=`${t}|${i}|${e}`,s=this.advanceCache.get(r);return s===void 0&&(this.measure.font=Bf[t].font(i),s=this.measure.measureText(e).width+(t==="hood"?i*.12:0),this.advanceCache.set(r,s)),s};place(e,t,i,r,s,o,a=[]){this.zoom=r;let c=new Set;for(let f=Math.floor(s[0]/Lr);f<=Math.floor(s[2]/Lr);f++)for(let h=Math.floor(s[1]/Lr);h<=Math.floor(s[3]/Lr);h++)for(let m of this.buckets.get(`${f},${h}`)??[])(m.minZoom??0)<=r&&r<(m.maxZoom??99)&&c.add(m);let l=24*qi([[15.5,.62],[18,.9]],r),u=[...c].map(f=>f.kind==="brand"&&f.icon?{...f,icon:{...f.icon,size:l}}:f);return Uf(u,{project:e,width:t,height:i,zoom:r,advance:this.advance,fontSize:kf,maxDepth:o,repeatDistance:260,blocked:a})}draw(e,t){Of(e,t,Bf)}};function zf(n){let e=document.createElement("canvas");e.width=e.height=48;let t=e.getContext("2d");return t.fillStyle="#FFFFFF",t.beginPath(),t.arc(24,24,22,0,Math.PI*2),t.fill(),t.strokeStyle="#0F3040",t.lineWidth=2,t.stroke(),t.drawImage(n,9,9,30,30),e}function Vf(n=2){let e=document.createElement("canvas");e.width=e.height=16*n;let t=e.getContext("2d");return t.scale(n,n),t.fillStyle="#008bce",t.strokeStyle="#f2f0e7",t.lineWidth=2,t.beginPath(),t.arc(8,8,6,0,Math.PI*2),t.fill(),t.stroke(),e}Pt.DEFAULT_UP.set(0,0,1);var Bn="../data/extracts/amsterdam",dn=new URLSearchParams(location.search),Ei=(n,e)=>dn.get(n)===null?e:dn.get(n)!=="0",N_=matchMedia("(pointer: coarse)").matches,dt={view:dn.get("view")??"city",route:dn.get("route")??"game-desktop",path:Ei("path",!1),near:Ei("near",!0),mini:Ei("mini",!0),hud:Ei("hud",!0),worker:Ei("worker",!0),dpr:Number(dn.get("dpr"))||Math.min(devicePixelRatio||1,N_?1.5:2),labelsAll:dn.get("labels")==="all",quiet:Ei("quiet",!1),transit:Ei("transit",!1),ask:dn.get("ask")??"Kinkerstraat",answered:dn.get("answered")??"",answeredOk:Ei("answeredOk",!0)},F_=["Nassaukade","Bilderdijkstraat","Kinkerstraat","Singelgracht","Prinsengracht","Herengracht","Keizersgracht","Singel","Leidsestraat","Overtoom","Marnixstraat","Rozengracht","Raadhuisstraat","Damrak","Rokin","Stadhouderskade","Amstel","Kostverlorenvaart","Da Costakade","Jan Pieter Heijestraat","Bilderdijkkade","Hugo de Grootkade","Leidsegracht","Vijzelstraat","Weteringschans","Wibautstraat"],Gf=new Set((dn.get("learned")??F_.join(",")).split(",").map(n=>n.trim()).filter(Boolean)),It={bytes:{},ms:{}},sl=It.bytes,vn=It.ms,bt={ready:!1,status:It,frames:[],renderMs:[],labelMs:[],labelCounts:[],info:{calls:0,triangles:0},labelWorst:null,labelCount:0,everPlaced:new Set,everPlacedKinds:{},placed:[],cam:null,setCamera:n=>{Ze=n},setView:n=>xu(n),project:(n,e)=>jn(un(Ze,Ur()),_t(n,e)),unproject:(n,e)=>{let t=sn(un(Ze,Ur()),n,e);return t?Un(t[0],t[1]):null},opts:dt};window.__ownMap=bt;var al=document.getElementById("gl"),Fs=document.getElementById("overlay"),Dr=document.getElementById("minimap"),U_=document.getElementById("hud"),Ce=Fs.getContext("2d"),cu=Dr.getContext("2d");dt.hud||(U_.hidden=!0);dt.mini||(Dr.hidden=!0);var Ur=()=>({width:al.clientWidth||innerWidth,height:al.clientHeight||innerHeight}),Ti=new Fa({canvas:al,antialias:!0});Ti.setPixelRatio(dt.dpr);Ti.setClearColor(on.land);Ti.info.autoReset=!1;var $i=new Yr,ei=new Vt(36.87,1,1,1e5);$i.add(new es("#ffffff","#b8b0a4",1.4));var $f=new ns("#ffffff",1.6);$f.position.set(-300,-400,700);$i.add($f);var Ze={center:_t(4.8936,52.3702),zoom:11.5,bearing:0,pitch:0},du={minZoom:9.5,maxZoom:20,maxPitch:70};async function Ai(n,e,t){let i=await fetch(n);if(!i.ok||t&&!t.test(i.headers.get("content-type")??""))throw new Error(`${n}: ${i.status} ${i.headers.get("content-type")}`);let r=new Uint8Array(await i.arrayBuffer());return Jf(n,e,r.length),r}function Jf(n,e,t,i){let r=i===void 0?performance.getEntriesByName(new URL(n,location.href).href).pop():void 0;sl[e]=(sl[e]??0)+(i??(r&&r.transferSize>0?r.transferSize:t)),sl[`${e}Decoded`]=(sl[`${e}Decoded`]??0)+t}async function Zi(n){let e=n[0]===31&&n[1]===139?await new Response(new Blob([n]).stream().pipeThrough(new DecompressionStream("gzip"))).text():new TextDecoder().decode(n);return JSON.parse(e)}var Us=async(n,e)=>{let t=performance.now(),i=await e();return vn[n]=Math.round(performance.now()-t),i},O_=n=>new Promise((e,t)=>{let i=new Image;i.onload=()=>e(i),i.onerror=()=>t(new Error(n)),i.src=n}),Kt,ti,ni,Wt=[],Tt={at:_t(4.8745,52.3729),bearing:40},fu=[],pu=null;async function B_(){let n=performance.now(),e=await Us("fetchOverview",()=>Ai(`${Bn}/own-map-v1/overview.json.gz`,"overview")),t=await Us("inflateParse",()=>Zi(e));Kt=await Us("decode",()=>ud(t)),await Us("buildMeshes",()=>{ti=new il(Kt),$i.add(ti.group)}),vn.overviewTotal=Math.round(performance.now()-n),It.overview={version:t.version,water:Kt.water.length,parks:Kt.parks.length,streets:Kt.streets.length,landuse:Kt.landuse.length,rail:Kt.rail.length,piers:Kt.piers.length+Kt.pierLines.length,hoodRings:Kt.hoodRings.length}}async function k_(){let n=performance.now(),e=await(await fetch(`${Bn}/building-overview/index.json`)).json(),t=e.zoom,i=u=>Math.floor((u+180)/360*2**t),r=u=>Math.floor((1-Math.log(Math.tan(Math.PI/4+u*Math.PI/360))/Math.PI)/2*2**t),[s,o,a,c]=e.bounds,l=[];for(let u=i(s);u<=i(a-1e-9);u++)for(let f=r(c);f<=r(o+1e-9);f++)l.push((async()=>{let h;try{let x=await Ai(`${Bn}/building-overview/${t}/${u}/${f}.png`,"buildingRaster",/image/);h=await createImageBitmap(new Blob([x],{type:"image/png"}),{imageOrientation:"flipY"})}catch{return}let m=new Ft(h);m.flipY=!1,m.generateMipmaps=!0,m.minFilter=Ln,m.anisotropy=4,m.needsUpdate=!0;let g=new ut(Dd(t,u,f,_t),Nd(m,on.building,0));g.renderOrder=5,g.frustumCulled=!1,fu.push(g),$i.add(g)})());await Promise.all(l),vn.buildingRaster=Math.round(performance.now()-n),It.buildingRasterTiles=fu.length}async function z_(){let n=null;try{let i=await fetch(`own-map-fixtures/route-${dt.route}.json`);i.ok&&(n=await i.json())}catch{}Wt=(n?.path??[[4.8837,52.3747],[4.8833,52.3693],[4.8826,52.3641]]).map(([i,r])=>_t(i,r));let t=dn.get("rider")?.split(",").map(Number);if(t&&t.length>=2)Tt={at:_t(t[0],t[1]),bearing:t[2]??0};else{let[i,r]=Wt;Tt={at:i,bearing:r?(Math.atan2(r[0]-i[0],r[1]-i[1])*180/Math.PI+360)%360:0}}It.route={points:Wt.length,lengthM:Math.round(Pr(Wt)),fixture:!!n}}async function V_(){let n=await Zi(await Ai(`${Bn}/transit-network.json`,"transit")),e=Rf(n);ti.setFerryLines(e.lines),ni.setFerryTerminals(e.terminals,Vf()),dt.transit&&ti.setTransit(Af(n)),It.overlays={...It.overlays,ferryLines:e.lines.length,ferryTerminals:e.terminals.length,transitLines:ti.stats.transitLines??0}}function G_(){let n=dt.answered;if(!n)return;if(!Rr({...jf,isLabelled:()=>!0},n,0,0)){ti.setAnswered(null,[],!0),It.answered={name:n,placed:0,withheld:!0};return}let t=Kt.streets.filter(r=>r.name===n).map(r=>r.points),i=Df(t,Tt);ti.setAnswered(n,i,dt.answeredOk,Un(Tt.at[0],Tt.at[1])[1]),It.answered={name:n,placed:i.length,at:i[0]&&Un(...i[0].at),bearing:i[0]?.bearing}}var uu=new Map,ol=new tn;$i.add(ol);var Hf="#e3dcd2",Wf="#cbbfb2",Nr=null,mu=new Map,H_=1;if(dt.worker)try{Nr=new Worker(new URL("js/own-map-footprints.worker.js",location.href)),Nr.onmessage=n=>{mu.get(n.data.id)?.(n.data),mu.delete(n.data.id)}}catch{Nr=null}It.footprintWorker=!!Nr;async function W_(n){let e=new URL(`${Bn}/building-tiles/14/${n}.geojson.gz`,location.href).href;if(Nr){let s=H_++,o=await new Promise(l=>{mu.set(s,l),Nr.postMessage({id:s,url:e,top:Hf,wall:Wf})});if(!o.ok)throw new Error(o.error);Jf(e,"buildingTiles",o.decoded,o.bytes),vn.footprintWorkerBuild=(vn.footprintWorkerBuild??0)+Math.round(o.buildMs);let a=performance.now(),c=qc(o);return vn.footprintBuild=(vn.footprintBuild??0)+Math.round(performance.now()-a),c}let t=await Zi(await Ai(e,"buildingTiles")),i=performance.now(),r=Fd(t.features,_t,Hf,Wf);return vn.footprintBuild=(vn.footprintBuild??0)+Math.round(performance.now()-i),r}function X_(n){if(Ze.zoom<kd){ol.visible=!1;return}ol.visible=!0;for(let e of Ud(n).slice(0,16))uu.has(e)||(uu.set(e,null),W_(e).then(t=>{let i=new ut(t,new Zn({vertexColors:!0}));i.renderOrder=50,uu.set(e,i),ol.add(i)},()=>{}))}var gu=550,Fr=null,hu=!1;async function Kf(){if(Fr||hu||!dt.near)return;let n=gf(Tt.at);if(!n){It.nearField="no own-ground extract here";return}hu=!0;let e=performance.now(),t=await Zi(await Ai(`${Bn}/own-ground-osm-v1/${n.id}.json`,"nearField")),i=pf(await(await fetch(`${Bn}/elevation-v1/index.json`)).json()),[r,s]=Un(Tt.at[0],Tt.at[1]),[o,a]=df(i,r,s),c=(await Promise.all(ff(i,o,a,gu+200).map(async u=>{try{return await Zi(await Ai(`${Bn}/elevation-v1/cells/${u}.json`,"nearField"))}catch{return null}}))).filter(Boolean),l=yf(t,xf(i,c),Tt.at,gu);Fr=l.group,$i.add(Fr),It.nearField={...l.stats,loadMs:Math.round(performance.now()-e)},hu=!1}var jf={isLabelled:dt.labelsAll?()=>!0:n=>Gf.has(n),hiddenName:dt.ask,spoilerIndex:Tr([...Gf,dt.ask]),quizQuiet:dt.quiet},Xf=!1;async function Qf(){if(Xf)return;Xf=!0;let[n,e,t]=await Promise.all([Ai(`${Bn}/orientation-pois.json`,"pois").then(i=>Zi(i)),Ai(`${Bn}/branded-pois.json`,"pois").then(i=>Zi(i)).catch(()=>[]),O_(If["albert-heijn"]).then(zf).catch(()=>null)]);ni.setPois(n),ni.setBranded(e,t?{"albert-heijn":t}:{}),It.labels=ni.stats}function q_(n,e){let t=performance.now(),i=n.viewport,r=[],s=(l,u)=>{let f=jn(n,l);f.depth>0&&r.push([f.x-u/2,f.y-50,f.x+u/2,f.y])};Wt.length>1&&(s(Wt[Wt.length-1],84),Ze.zoom<16&&s(Wt[0],44));let o=jn(n,Tt.at);o.depth>0&&r.push([o.x-11,o.y-11,o.x+11,o.y+11]);let a=ni.place(l=>jn(n,l),i.width,i.height,Ze.zoom,e,n.distance*4,r);ni.draw(Ce,a);let c=performance.now()-t;c>(bt.labelWorst?.ms??0)&&(bt.labelWorst={ms:Math.round(c),candidates:a.length,zoom:+Ze.zoom.toFixed(2),pitch:Math.round(Ze.pitch)}),bt.labelCount=a.length,bt.placed=a.map(l=>({text:l.text,kind:l.kind,...l.icon?{icon:!0}:{}}));for(let l of a)l.text&&(bt.everPlaced.has(l.text)||(bt.everPlacedKinds[l.kind]??=[]).push(l.text),bt.everPlaced.add(l.text));bt.labelMs.push(performance.now()-t),bt.labelCounts.push(a.length)}var ep='"Helvetica Neue", Arial, sans-serif';function qf(n,e,t,i){Ce.save(),Ce.translate(n,e),Ce.fillStyle=t,Ce.strokeStyle="#fff",Ce.lineWidth=2.5,Ce.beginPath(),Ce.moveTo(0,0),Ce.bezierCurveTo(-12,-16,-12,-32,0,-32),Ce.bezierCurveTo(12,-32,12,-16,0,0),Ce.fill(),Ce.stroke(),Ce.fillStyle="#fff",Ce.beginPath(),Ce.arc(0,-21,4.5,0,Math.PI*2),Ce.fill(),Ce.font=`700 11px ${ep}`,Ce.textAlign="center",Ce.textBaseline="bottom",Ce.lineWidth=3,Ce.strokeStyle="rgba(7,30,43,.85)",Ce.strokeText(i,0,-36),Ce.fillStyle="#fff",Ce.fillText(i,0,-36),Ce.restore()}function Y_(n){if(Wt.length>1){let t=jn(n,Wt[0]),i=jn(n,Wt[Wt.length-1]);i.depth>0&&qf(i.x,i.y,"#E11D48","DESTINATION"),t.depth>0&&Ze.zoom<16&&qf(t.x,t.y,"#16A34A","START")}let e=jn(n,Tt.at);e.depth>0&&(Ce.save(),Ce.translate(e.x,e.y),Ce.rotate((Tt.bearing-Ze.bearing)*Math.PI/180),Ce.fillStyle="#0f172a",Ce.strokeStyle="#fff",Ce.lineWidth=2,Ce.beginPath(),Ce.moveTo(0,-10),Ce.lineTo(7,8),Ce.lineTo(0,4),Ce.lineTo(-7,8),Ce.closePath(),Ce.fill(),Ce.stroke(),Ce.restore()),Ce.font=`400 10px ${ep}`,Ce.textAlign="right",Ce.textBaseline="bottom",Ce.fillStyle="rgba(30,41,59,.7)",Ce.fillText("\xA9 OpenStreetMap contributors \xB7 BAG \xB7 GVB \xB7 own renderer",n.viewport.width-6,n.viewport.height-4)}function tp(){let[n,e,t,i]=Kt?.bounds??[-15e3,-12e3,12e3,9e3],r=[[Math.max(n,-9e3),Math.max(e,-8e3)],[Math.min(t,9500),Math.min(i,6500)]];return Fc(r,Ur(),{padding:{top:30,bottom:30,left:20,right:20}})}function yu(){let n=Ur(),e=Wt.length>1?Wt:[Tt.at];return Fc(e,n,{padding:{top:Math.min(140,n.height*.18),bottom:Math.min(120,n.height*.15),left:56,right:56},maxZoom:16})}function Z_(){let n=yu();return{...n,zoom:Math.max(13.6,Math.min(14.6,n.zoom+1))}}function np(){return{center:Tt.at,zoom:17.6,bearing:Tt.bearing,pitch:55}}function xu(n){let e=dn.get("cam")?.split(",").map(Number);if(n==="cam"&&e&&e.length>=3){Ze={center:_t(e[0],e[1]),zoom:e[2],pitch:e[3]??0,bearing:e[4]??0,fovDeg:e[5]};return}Ze=n==="route"?yu():n==="district"?Z_():n==="street"?np():tp(),Os=null}var Os=null;function $_(n){let e=tp(),t=yu(),i=np();return n<2?e:n<7?Uc(e,t,(n-2)/5):n<9?t:n<15?Uc(t,i,(n-9)/6):{...i,bearing:i.bearing+(n-15)*8}}var Yf=performance.now(),Zf="";function ip(n){if(requestAnimationFrame(ip),bt.frames.push(n-Yf),Yf=n,!bt.ready)return;let e=performance.now();dt.path&&(Os??=n,Ze=$_((n-Os)/1e3)),Ze=Hi(Ze,{...du,maxPitch:Math.max(du.maxPitch,Ze.pitch)}),bt.cam=Ze;let t=Ur(),i=un(Ze,t);ei.fov=Ze.fovDeg??36.86989764584402,ei.aspect=t.width/t.height,ei.near=Math.max(.5,i.distance*.02),ei.far=i.distance*40,ei.position.set(...i.eye),ei.up.set(...i.up),ei.lookAt(...i.target),ei.updateProjectionMatrix(),ti.update(Ze.zoom,i.mpp);let r=1-Zc(Ze.zoom,Bd);for(let u of fu)u.visible=r>.01,u.material.uniforms.uOpacity.value=r;let s=Nc(i,6e3),o=s.map(u=>Math.round(u/200)).join(",")+Math.floor(Ze.zoom*2);o!==Zf&&(Zf=o,X_(s));let a=Zc(Ze.zoom,zd);a>0&&Kf(),Ze.zoom>=15.5&&Qf(),Es.uRider.value.set(Tt.at[0],Tt.at[1]),Es.uNearR.value=gu,Es.uNear.value=Fr?a:0,Fr&&(Fr.visible=a>0),Ti.info.reset(),Ti.render($i,ei),bt.info={calls:Ti.info.render.calls,triangles:Ti.info.render.triangles};let c=dt.dpr;(Fs.width!==Math.round(t.width*c)||Fs.height!==Math.round(t.height*c))&&(Fs.width=Math.round(t.width*c),Fs.height=Math.round(t.height*c)),Ce.setTransform(c,0,0,c,0,0),Ce.clearRect(0,0,t.width,t.height),q_(i,Nc(i,Math.min(6e3,i.distance*4))),Y_(i);let l=Dr.clientWidth;dt.mini&&pu&&l>=16&&(Dr.width!==Math.round(l*c)&&(Dr.width=Dr.height=Math.round(l*c)),cu.setTransform(c,0,0,c,0,0),cu.clearRect(0,0,l,l),pu.draw(cu,l,Tt.at,Tt.bearing,Wt)),bt.renderMs.push(performance.now()-e),dt.hud&&J_()}function J_(){let n=document.getElementById("stats");if(!n||bt.frames.length%15)return;let e=bt.renderMs.slice(-60).sort((t,i)=>t-i);n.textContent=`z ${Ze.zoom.toFixed(2)} \xB7 pitch ${Ze.pitch.toFixed(0)}\xB0 \xB7 ${bt.labelCount} labels \xB7 ${bt.info.calls} calls \xB7 cpu ${(e[e.length>>1]??0).toFixed(1)} ms`}function rp(){let n=Ur();Ti.setSize(n.width,n.height,!1)}addEventListener("resize",rp);async function K_(){let n=performance.now();rp(),requestAnimationFrame(ip);try{await Promise.all([B_(),z_()]),ti.setRoute(Wt),ni=await Us("labelCandidates",()=>new rl(Kt,jf,Ce)),It.labels=ni.stats,G_(),pu=new Ja(Kt),xu(dn.get("cam")?"cam":dt.view),bt.ready=!0,vn.firstFrameReady=Math.round(performance.now()-n),await Promise.all([k_(),V_()]),It.labels=ni.stats,vn.allLoaded=Math.round(performance.now()-n),Ze.zoom>=15.5&&await Qf(),Ze.zoom>=16&&await Kf(),It.loaded=!0}catch(e){It.error=String(e?.stack??e),console.error(e)}xd(al,()=>Ze,e=>{Ze=e,Os=null,dt.path=!1},du);for(let e of document.querySelectorAll("[data-view]"))e.onclick=()=>{dt.path=e.dataset.view==="path",Os=null,dt.path||xu(e.dataset.view)}}K_();
/*! Bundled license information:

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/

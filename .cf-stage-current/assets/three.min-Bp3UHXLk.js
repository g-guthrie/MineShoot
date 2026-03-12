var rp=(y,jt)=>()=>(jt||y((jt={exports:{}}).exports,jt),jt.exports);var sp=rp((lo,mh)=>{console.warn('Scripts "build/three.js" and "build/three.min.js" are deprecated with r150+, and will be removed with r160. Please use ES Modules or alternatives: https://threejs.org/docs/index.html#manual/en/introduction/Installation'),(function(y,jt){typeof lo=="object"&&typeof mh<"u"?jt(lo):typeof define=="function"&&define.amd?define(["exports"],jt):jt((y=typeof globalThis<"u"?globalThis:y||self).THREE={})})(void 0,(function(y){const Ns="attached",co="detached",$e="srgb",Ht="srgb-linear",lr="display-p3",Si="display-p3-linear",bi="linear",ke="srgb",Ti="rec709",Os="300 es";class qt{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){if(this._listeners===void 0)return!1;const n=this._listeners;return n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){if(this._listeners===void 0)return;const n=this._listeners[e];if(n!==void 0){const i=n.indexOf(t);i!==-1&&n.splice(i,1)}}dispatchEvent(e){if(this._listeners===void 0)return;const t=this._listeners[e.type];if(t!==void 0){e.target=this;const n=t.slice(0);for(let i=0,s=n.length;i<s;i++)n[i].call(this,e);e.target=null}}}const at=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let ho=1234567;const _n=Math.PI/180,Vn=180/Math.PI;function bt(){const r=4294967295*Math.random()|0,e=4294967295*Math.random()|0,t=4294967295*Math.random()|0,n=4294967295*Math.random()|0;return(at[255&r]+at[r>>8&255]+at[r>>16&255]+at[r>>24&255]+"-"+at[255&e]+at[e>>8&255]+"-"+at[e>>16&15|64]+at[e>>24&255]+"-"+at[63&t|128]+at[t>>8&255]+"-"+at[t>>16&255]+at[t>>24&255]+at[255&n]+at[n>>8&255]+at[n>>16&255]+at[n>>24&255]).toLowerCase()}function qe(r,e,t){return Math.max(e,Math.min(t,r))}function Fs(r,e){return(r%e+e)%e}function Ei(r,e,t){return(1-t)*r+t*e}function Bs(r){return(r&r-1)==0&&r!==0}function cr(r){return Math.pow(2,Math.floor(Math.log(r)/Math.LN2))}function _t(r,e){switch(e.constructor){case Float32Array:return r;case Uint32Array:return r/4294967295;case Uint16Array:return r/65535;case Uint8Array:return r/255;case Int32Array:return Math.max(r/2147483647,-1);case Int16Array:return Math.max(r/32767,-1);case Int8Array:return Math.max(r/127,-1);default:throw new Error("Invalid component type.")}}function Te(r,e){switch(e.constructor){case Float32Array:return r;case Uint32Array:return Math.round(4294967295*r);case Uint16Array:return Math.round(65535*r);case Uint8Array:return Math.round(255*r);case Int32Array:return Math.round(2147483647*r);case Int16Array:return Math.round(32767*r);case Int8Array:return Math.round(127*r);default:throw new Error("Invalid component type.")}}const gh={DEG2RAD:_n,RAD2DEG:Vn,generateUUID:bt,clamp:qe,euclideanModulo:Fs,mapLinear:function(r,e,t,n,i){return n+(r-e)*(i-n)/(t-e)},inverseLerp:function(r,e,t){return r!==e?(t-r)/(e-r):0},lerp:Ei,damp:function(r,e,t,n){return Ei(r,e,1-Math.exp(-t*n))},pingpong:function(r,e=1){return e-Math.abs(Fs(r,2*e)-e)},smoothstep:function(r,e,t){return r<=e?0:r>=t?1:(r=(r-e)/(t-e))*r*(3-2*r)},smootherstep:function(r,e,t){return r<=e?0:r>=t?1:(r=(r-e)/(t-e))*r*r*(r*(6*r-15)+10)},randInt:function(r,e){return r+Math.floor(Math.random()*(e-r+1))},randFloat:function(r,e){return r+Math.random()*(e-r)},randFloatSpread:function(r){return r*(.5-Math.random())},seededRandom:function(r){r!==void 0&&(ho=r);let e=ho+=1831565813;return e=Math.imul(e^e>>>15,1|e),e^=e+Math.imul(e^e>>>7,61|e),((e^e>>>14)>>>0)/4294967296},degToRad:function(r){return r*_n},radToDeg:function(r){return r*Vn},isPowerOfTwo:Bs,ceilPowerOfTwo:function(r){return Math.pow(2,Math.ceil(Math.log(r)/Math.LN2))},floorPowerOfTwo:cr,setQuaternionFromProperEuler:function(r,e,t,n,i){const s=Math.cos,a=Math.sin,o=s(t/2),l=a(t/2),c=s((e+n)/2),h=a((e+n)/2),u=s((e-n)/2),d=a((e-n)/2),p=s((n-e)/2),m=a((n-e)/2);switch(i){case"XYX":r.set(o*h,l*u,l*d,o*c);break;case"YZY":r.set(l*d,o*h,l*u,o*c);break;case"ZXZ":r.set(l*u,l*d,o*h,o*c);break;case"XZX":r.set(o*h,l*m,l*p,o*c);break;case"YXY":r.set(l*p,o*h,l*m,o*c);break;case"ZYZ":r.set(l*m,l*p,o*h,o*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+i)}},normalize:Te,denormalize:_t};class ie{constructor(e=0,t=0){ie.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,n=this.y,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6],this.y=i[1]*t+i[4]*n+i[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(qe(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const n=Math.cos(t),i=Math.sin(t),s=this.x-e.x,a=this.y-e.y;return this.x=s*n-a*i+e.x,this.y=s*i+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class we{constructor(e,t,n,i,s,a,o,l,c){we.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,i,s,a,o,l,c)}set(e,t,n,i,s,a,o,l,c){const h=this.elements;return h[0]=e,h[1]=i,h[2]=o,h[3]=t,h[4]=s,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,i=t.elements,s=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],u=n[7],d=n[2],p=n[5],m=n[8],g=i[0],f=i[3],x=i[6],v=i[1],_=i[4],M=i[7],C=i[2],b=i[5],A=i[8];return s[0]=a*g+o*v+l*C,s[3]=a*f+o*_+l*b,s[6]=a*x+o*M+l*A,s[1]=c*g+h*v+u*C,s[4]=c*f+h*_+u*b,s[7]=c*x+h*M+u*A,s[2]=d*g+p*v+m*C,s[5]=d*f+p*_+m*b,s[8]=d*x+p*M+m*A,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8];return t*a*h-t*o*c-n*s*h+n*o*l+i*s*c-i*a*l}invert(){const e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],u=h*a-o*c,d=o*l-h*s,p=c*s-a*l,m=t*u+n*d+i*p;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);const g=1/m;return e[0]=u*g,e[1]=(i*c-h*n)*g,e[2]=(o*n-i*a)*g,e[3]=d*g,e[4]=(h*t-i*l)*g,e[5]=(i*s-o*t)*g,e[6]=p*g,e[7]=(n*l-c*t)*g,e[8]=(a*t-n*s)*g,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,i,s,a,o){const l=Math.cos(s),c=Math.sin(s);return this.set(n*l,n*c,-n*(l*a+c*o)+a+e,-i*c,i*l,-i*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return this.premultiply(zs.makeScale(e,t)),this}rotate(e){return this.premultiply(zs.makeRotation(-e)),this}translate(e,t){return this.premultiply(zs.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,n=e.elements;for(let i=0;i<9;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const zs=new we;function uo(r){for(let e=r.length-1;e>=0;--e)if(r[e]>=65535)return!0;return!1}const _h={Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array};function kn(r,e){return new _h[r](e)}function wi(r){return document.createElementNS("http://www.w3.org/1999/xhtml",r)}function po(){const r=wi("canvas");return r.style.display="block",r}const fo={};function Ai(r){r in fo||(fo[r]=!0,console.warn(r))}const mo=new we().set(.8224621,.177538,0,.0331941,.9668058,0,.0170827,.0723974,.9105199),go=new we().set(1.2249401,-.2249404,0,-.0420569,1.0420571,0,-.0196376,-.0786361,1.0982735),hr={[Ht]:{transfer:bi,primaries:Ti,toReference:r=>r,fromReference:r=>r},[$e]:{transfer:ke,primaries:Ti,toReference:r=>r.convertSRGBToLinear(),fromReference:r=>r.convertLinearToSRGB()},[Si]:{transfer:bi,primaries:"p3",toReference:r=>r.applyMatrix3(go),fromReference:r=>r.applyMatrix3(mo)},[lr]:{transfer:ke,primaries:"p3",toReference:r=>r.convertSRGBToLinear().applyMatrix3(go),fromReference:r=>r.applyMatrix3(mo).convertLinearToSRGB()}},vh=new Set([Ht,Si]),Ge={enabled:!0,_workingColorSpace:Ht,get workingColorSpace(){return this._workingColorSpace},set workingColorSpace(r){if(!vh.has(r))throw new Error(`Unsupported working color space, "${r}".`);this._workingColorSpace=r},convert:function(r,e,t){if(this.enabled===!1||e===t||!e||!t)return r;const n=hr[e].toReference;return(0,hr[t].fromReference)(n(r))},fromWorkingColorSpace:function(r,e){return this.convert(r,this._workingColorSpace,e)},toWorkingColorSpace:function(r,e){return this.convert(r,e,this._workingColorSpace)},getPrimaries:function(r){return hr[r].primaries},getTransfer:function(r){return r===""?bi:hr[r].transfer}};function Wn(r){return r<.04045?.0773993808*r:Math.pow(.9478672986*r+.0521327014,2.4)}function Gs(r){return r<.0031308?12.92*r:1.055*Math.pow(r,.41666)-.055}let Xn;class Hs{static getDataURL(e){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let t;if(e instanceof HTMLCanvasElement)t=e;else{Xn===void 0&&(Xn=wi("canvas")),Xn.width=e.width,Xn.height=e.height;const n=Xn.getContext("2d");e instanceof ImageData?n.putImageData(e,0,0):n.drawImage(e,0,0,e.width,e.height),t=Xn}return t.width>2048||t.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",e),t.toDataURL("image/jpeg",.6)):t.toDataURL("image/png")}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=wi("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const i=n.getImageData(0,0,e.width,e.height),s=i.data;for(let a=0;a<s.length;a++)s[a]=255*Wn(s[a]/255);return n.putImageData(i,0,0),t}if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(255*Wn(t[n]/255)):t[n]=Wn(t[n]);return{data:t,width:e.width,height:e.height}}return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let xh=0;class vn{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:xh++}),this.uuid=bt(),this.data=e,this.version=0}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let s;if(Array.isArray(i)){s=[];for(let a=0,o=i.length;a<o;a++)i[a].isDataTexture?s.push(Vs(i[a].image)):s.push(Vs(i[a]))}else s=Vs(i);n.url=s}return t||(e.images[this.uuid]=n),n}}function Vs(r){return typeof HTMLImageElement<"u"&&r instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&r instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&r instanceof ImageBitmap?Hs.getDataURL(r):r.data?{data:Array.from(r.data),width:r.width,height:r.height,type:r.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let yh=0;class Ze extends qt{constructor(e=Ze.DEFAULT_IMAGE,t=Ze.DEFAULT_MAPPING,n=1001,i=1001,s=1006,a=1008,o=1023,l=1009,c=Ze.DEFAULT_ANISOTROPY,h=""){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:yh++}),this.uuid=bt(),this.name="",this.source=new vn(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=s,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new ie(0,0),this.repeat=new ie(1,1),this.center=new ie(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new we,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,typeof h=="string"?this.colorSpace=h:(Ai("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=h===3001?$e:""),this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.needsPMREMUpdate=!1}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==300)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case 1e3:e.x=e.x-Math.floor(e.x);break;case 1001:e.x=e.x<0?0:1;break;case 1002:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x)}if(e.y<0||e.y>1)switch(this.wrapT){case 1e3:e.y=e.y-Math.floor(e.y);break;case 1001:e.y=e.y<0?0:1;break;case 1002:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y)}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}get encoding(){return Ai("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace===$e?3001:3e3}set encoding(e){Ai("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=e===3001?$e:""}}Ze.DEFAULT_IMAGE=null,Ze.DEFAULT_MAPPING=300,Ze.DEFAULT_ANISOTROPY=1;class He{constructor(e=0,t=0,n=0,i=1){He.prototype.isVector4=!0,this.x=e,this.y=t,this.z=n,this.w=i}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,i){return this.x=e,this.y=t,this.z=n,this.w=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,n=this.y,i=this.z,s=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*i+a[12]*s,this.y=a[1]*t+a[5]*n+a[9]*i+a[13]*s,this.z=a[2]*t+a[6]*n+a[10]*i+a[14]*s,this.w=a[3]*t+a[7]*n+a[11]*i+a[15]*s,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,i,s;const l=e.elements,c=l[0],h=l[4],u=l[8],d=l[1],p=l[5],m=l[9],g=l[2],f=l[6],x=l[10];if(Math.abs(h-d)<.01&&Math.abs(u-g)<.01&&Math.abs(m-f)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+g)<.1&&Math.abs(m+f)<.1&&Math.abs(c+p+x-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const _=(c+1)/2,M=(p+1)/2,C=(x+1)/2,b=(h+d)/4,A=(u+g)/4,N=(m+f)/4;return _>M&&_>C?_<.01?(n=0,i=.707106781,s=.707106781):(n=Math.sqrt(_),i=b/n,s=A/n):M>C?M<.01?(n=.707106781,i=0,s=.707106781):(i=Math.sqrt(M),n=b/i,s=N/i):C<.01?(n=.707106781,i=.707106781,s=0):(s=Math.sqrt(C),n=A/s,i=N/s),this.set(n,i,s,t),this}let v=Math.sqrt((f-m)*(f-m)+(u-g)*(u-g)+(d-h)*(d-h));return Math.abs(v)<.001&&(v=1),this.x=(f-m)/v,this.y=(u-g)/v,this.z=(d-h)/v,this.w=Math.acos((c+p+x-1)/2),this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this.w=Math.max(e,Math.min(t,this.w)),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class _o extends qt{constructor(e=1,t=1,n={}){super(),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=1,this.scissor=new He(0,0,e,t),this.scissorTest=!1,this.viewport=new He(0,0,e,t);const i={width:e,height:t,depth:1};n.encoding!==void 0&&(Ai("THREE.WebGLRenderTarget: option.encoding has been replaced by option.colorSpace."),n.colorSpace=n.encoding===3001?$e:""),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:1006,depthBuffer:!0,stencilBuffer:!1,depthTexture:null,samples:0},n),this.texture=new Ze(i,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.flipY=!1,this.texture.generateMipmaps=n.generateMipmaps,this.texture.internalFormat=n.internalFormat,this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}setSize(e,t,n=1){this.width===e&&this.height===t&&this.depth===n||(this.width=e,this.height=t,this.depth=n,this.texture.image.width=e,this.texture.image.height=t,this.texture.image.depth=n,this.dispose()),this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.texture=e.texture.clone(),this.texture.isRenderTargetTexture=!0;const t=Object.assign({},e.texture.image);return this.texture.source=new vn(t),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Pt extends _o{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}}class ur extends Ze{constructor(e=null,t=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class ks extends Ze{constructor(e=null,t=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class vt{constructor(e=0,t=0,n=0,i=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=i}static slerpFlat(e,t,n,i,s,a,o){let l=n[i+0],c=n[i+1],h=n[i+2],u=n[i+3];const d=s[a+0],p=s[a+1],m=s[a+2],g=s[a+3];if(o===0)return e[t+0]=l,e[t+1]=c,e[t+2]=h,void(e[t+3]=u);if(o===1)return e[t+0]=d,e[t+1]=p,e[t+2]=m,void(e[t+3]=g);if(u!==g||l!==d||c!==p||h!==m){let f=1-o;const x=l*d+c*p+h*m+u*g,v=x>=0?1:-1,_=1-x*x;if(_>Number.EPSILON){const C=Math.sqrt(_),b=Math.atan2(C,x*v);f=Math.sin(f*b)/C,o=Math.sin(o*b)/C}const M=o*v;if(l=l*f+d*M,c=c*f+p*M,h=h*f+m*M,u=u*f+g*M,f===1-o){const C=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=C,c*=C,h*=C,u*=C}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,i,s,a){const o=n[i],l=n[i+1],c=n[i+2],h=n[i+3],u=s[a],d=s[a+1],p=s[a+2],m=s[a+3];return e[t]=o*m+h*u+l*p-c*d,e[t+1]=l*m+h*d+c*u-o*p,e[t+2]=c*m+h*p+o*d-l*u,e[t+3]=h*m-o*u-l*d-c*p,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,i=e._y,s=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(i/2),u=o(s/2),d=l(n/2),p=l(i/2),m=l(s/2);switch(a){case"XYZ":this._x=d*h*u+c*p*m,this._y=c*p*u-d*h*m,this._z=c*h*m+d*p*u,this._w=c*h*u-d*p*m;break;case"YXZ":this._x=d*h*u+c*p*m,this._y=c*p*u-d*h*m,this._z=c*h*m-d*p*u,this._w=c*h*u+d*p*m;break;case"ZXY":this._x=d*h*u-c*p*m,this._y=c*p*u+d*h*m,this._z=c*h*m+d*p*u,this._w=c*h*u-d*p*m;break;case"ZYX":this._x=d*h*u-c*p*m,this._y=c*p*u+d*h*m,this._z=c*h*m-d*p*u,this._w=c*h*u+d*p*m;break;case"YZX":this._x=d*h*u+c*p*m,this._y=c*p*u+d*h*m,this._z=c*h*m-d*p*u,this._w=c*h*u-d*p*m;break;case"XZY":this._x=d*h*u-c*p*m,this._y=c*p*u-d*h*m,this._z=c*h*m+d*p*u,this._w=c*h*u+d*p*m;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,i=Math.sin(n);return this._x=e.x*i,this._y=e.y*i,this._z=e.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],i=t[4],s=t[8],a=t[1],o=t[5],l=t[9],c=t[2],h=t[6],u=t[10],d=n+o+u;if(d>0){const p=.5/Math.sqrt(d+1);this._w=.25/p,this._x=(h-l)*p,this._y=(s-c)*p,this._z=(a-i)*p}else if(n>o&&n>u){const p=2*Math.sqrt(1+n-o-u);this._w=(h-l)/p,this._x=.25*p,this._y=(i+a)/p,this._z=(s+c)/p}else if(o>u){const p=2*Math.sqrt(1+o-n-u);this._w=(s-c)/p,this._x=(i+a)/p,this._y=.25*p,this._z=(l+h)/p}else{const p=2*Math.sqrt(1+u-n-o);this._w=(a-i)/p,this._x=(s+c)/p,this._y=(l+h)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<Number.EPSILON?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(qe(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const i=Math.min(1,t/n);return this.slerp(e,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,i=e._y,s=e._z,a=e._w,o=t._x,l=t._y,c=t._z,h=t._w;return this._x=n*h+a*o+i*c-s*l,this._y=i*h+a*l+s*o-n*c,this._z=s*h+a*c+n*l-i*o,this._w=a*h-n*o-i*l-s*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);const n=this._x,i=this._y,s=this._z,a=this._w;let o=a*e._w+n*e._x+i*e._y+s*e._z;if(o<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,o=-o):this.copy(e),o>=1)return this._w=a,this._x=n,this._y=i,this._z=s,this;const l=1-o*o;if(l<=Number.EPSILON){const p=1-t;return this._w=p*a+t*this._w,this._x=p*n+t*this._x,this._y=p*i+t*this._y,this._z=p*s+t*this._z,this.normalize(),this}const c=Math.sqrt(l),h=Math.atan2(c,o),u=Math.sin((1-t)*h)/c,d=Math.sin(t*h)/c;return this._w=a*u+this._w*d,this._x=n*u+this._x*d,this._y=i*u+this._y*d,this._z=s*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=Math.random(),t=Math.sqrt(1-e),n=Math.sqrt(e),i=2*Math.PI*Math.random(),s=2*Math.PI*Math.random();return this.set(t*Math.cos(i),n*Math.sin(s),n*Math.cos(s),t*Math.sin(i))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class w{constructor(e=0,t=0,n=0){w.prototype.isVector3=!0,this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(vo.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(vo.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,n=this.y,i=this.z,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6]*i,this.y=s[1]*t+s[4]*n+s[7]*i,this.z=s[2]*t+s[5]*n+s[8]*i,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,n=this.y,i=this.z,s=e.elements,a=1/(s[3]*t+s[7]*n+s[11]*i+s[15]);return this.x=(s[0]*t+s[4]*n+s[8]*i+s[12])*a,this.y=(s[1]*t+s[5]*n+s[9]*i+s[13])*a,this.z=(s[2]*t+s[6]*n+s[10]*i+s[14])*a,this}applyQuaternion(e){const t=this.x,n=this.y,i=this.z,s=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*i-o*n),h=2*(o*t-s*i),u=2*(s*n-a*t);return this.x=t+l*c+a*u-o*h,this.y=n+l*h+o*c-s*u,this.z=i+l*u+s*h-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,n=this.y,i=this.z,s=e.elements;return this.x=s[0]*t+s[4]*n+s[8]*i,this.y=s[1]*t+s[5]*n+s[9]*i,this.z=s[2]*t+s[6]*n+s[10]*i,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const n=e.x,i=e.y,s=e.z,a=t.x,o=t.y,l=t.z;return this.x=i*l-s*o,this.y=s*a-n*l,this.z=n*o-i*a,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Ws.copy(this).projectOnVector(e),this.sub(Ws)}reflect(e){return this.sub(Ws.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(qe(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y,i=this.z-e.z;return t*t+n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){const i=Math.sin(t)*e;return this.x=i*Math.sin(n),this.y=Math.cos(t)*e,this.z=i*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),i=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=i,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,4*t)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,3*t)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=2*(Math.random()-.5),t=Math.random()*Math.PI*2,n=Math.sqrt(1-e**2);return this.x=n*Math.cos(t),this.y=n*Math.sin(t),this.z=e,this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Ws=new w,vo=new vt;class pt{constructor(e=new w(1/0,1/0,1/0),t=new w(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(It.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(It.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=It.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const s=n.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=s.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,It):It.fromBufferAttribute(s,a),It.applyMatrix4(e.matrixWorld),this.expandByPoint(It);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),dr.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),dr.copy(n.boundingBox)),dr.applyMatrix4(e.matrixWorld),this.union(dr)}const i=e.children;for(let s=0,a=i.length;s<a;s++)this.expandByObject(i[s],t);return this}containsPoint(e){return!(e.x<this.min.x||e.x>this.max.x||e.y<this.min.y||e.y>this.max.y||e.z<this.min.z||e.z>this.max.z)}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return!(e.max.x<this.min.x||e.min.x>this.max.x||e.max.y<this.min.y||e.min.y>this.max.y||e.max.z<this.min.z||e.min.z>this.max.z)}intersectsSphere(e){return this.clampPoint(e.center,It),It.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Ri),pr.subVectors(this.max,Ri),jn.subVectors(e.a,Ri),qn.subVectors(e.b,Ri),Yn.subVectors(e.c,Ri),sn.subVectors(qn,jn),an.subVectors(Yn,qn),xn.subVectors(jn,Yn);let t=[0,-sn.z,sn.y,0,-an.z,an.y,0,-xn.z,xn.y,sn.z,0,-sn.x,an.z,0,-an.x,xn.z,0,-xn.x,-sn.y,sn.x,0,-an.y,an.x,0,-xn.y,xn.x,0];return!!Xs(t,jn,qn,Yn,pr)&&(t=[1,0,0,0,1,0,0,0,1],!!Xs(t,jn,qn,Yn,pr)&&(fr.crossVectors(sn,an),t=[fr.x,fr.y,fr.z],Xs(t,jn,qn,Yn,pr)))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,It).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=.5*this.getSize(It).length()),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()||(Yt[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Yt[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Yt[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Yt[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Yt[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Yt[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Yt[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Yt[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Yt)),this}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}}const Yt=[new w,new w,new w,new w,new w,new w,new w,new w],It=new w,dr=new pt,jn=new w,qn=new w,Yn=new w,sn=new w,an=new w,xn=new w,Ri=new w,pr=new w,fr=new w,yn=new w;function Xs(r,e,t,n,i){for(let s=0,a=r.length-3;s<=a;s+=3){yn.fromArray(r,s);const o=i.x*Math.abs(yn.x)+i.y*Math.abs(yn.y)+i.z*Math.abs(yn.z),l=e.dot(yn),c=t.dot(yn),h=n.dot(yn);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}const Mh=new pt,Ci=new w,js=new w;class ot{constructor(e=new w,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):Mh.setFromPoints(e).getCenter(n);let i=0;for(let s=0,a=e.length;s<a;s++)i=Math.max(i,n.distanceToSquared(e[s]));return this.radius=Math.sqrt(i),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Ci.subVectors(e,this.center);const t=Ci.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),i=.5*(n-this.radius);this.center.addScaledVector(Ci,i/n),this.radius+=i}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(js.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Ci.copy(e.center).add(js)),this.expandByPoint(Ci.copy(e.center).sub(js))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}}const Zt=new w,qs=new w,mr=new w,on=new w,Ys=new w,gr=new w,Zs=new w;class Zn{constructor(e=new w,t=new w(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Zt)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=Zt.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Zt.copy(this.origin).addScaledVector(this.direction,t),Zt.distanceToSquared(e))}distanceSqToSegment(e,t,n,i){qs.copy(e).add(t).multiplyScalar(.5),mr.copy(t).sub(e).normalize(),on.copy(this.origin).sub(qs);const s=.5*e.distanceTo(t),a=-this.direction.dot(mr),o=on.dot(this.direction),l=-on.dot(mr),c=on.lengthSq(),h=Math.abs(1-a*a);let u,d,p,m;if(h>0)if(u=a*l-o,d=a*o-l,m=s*h,u>=0)if(d>=-m)if(d<=m){const g=1/h;u*=g,d*=g,p=u*(u+a*d+2*o)+d*(a*u+d+2*l)+c}else d=s,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;else d=-s,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;else d<=-m?(u=Math.max(0,-(-a*s+o)),d=u>0?-s:Math.min(Math.max(-s,-l),s),p=-u*u+d*(d+2*l)+c):d<=m?(u=0,d=Math.min(Math.max(-s,-l),s),p=d*(d+2*l)+c):(u=Math.max(0,-(a*s+o)),d=u>0?s:Math.min(Math.max(-s,-l),s),p=-u*u+d*(d+2*l)+c);else d=a>0?-s:s,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),i&&i.copy(qs).addScaledVector(mr,d),p}intersectSphere(e,t){Zt.subVectors(e.center,this.origin);const n=Zt.dot(this.direction),i=Zt.dot(Zt)-n*n,s=e.radius*e.radius;if(i>s)return null;const a=Math.sqrt(s-i),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0?!0:e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,i,s,a,o,l;const c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,i=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,i=(e.min.x-d.x)*c),h>=0?(s=(e.min.y-d.y)*h,a=(e.max.y-d.y)*h):(s=(e.max.y-d.y)*h,a=(e.min.y-d.y)*h),n>a||s>i?null:((s>n||isNaN(n))&&(n=s),(a<i||isNaN(i))&&(i=a),u>=0?(o=(e.min.z-d.z)*u,l=(e.max.z-d.z)*u):(o=(e.max.z-d.z)*u,l=(e.min.z-d.z)*u),n>l||o>i?null:((o>n||n!=n)&&(n=o),(l<i||i!=i)&&(i=l),i<0?null:this.at(n>=0?n:i,t)))}intersectsBox(e){return this.intersectBox(e,Zt)!==null}intersectTriangle(e,t,n,i,s){Ys.subVectors(t,e),gr.subVectors(n,e),Zs.crossVectors(Ys,gr);let a,o=this.direction.dot(Zs);if(o>0){if(i)return null;a=1}else{if(!(o<0))return null;a=-1,o=-o}on.subVectors(this.origin,e);const l=a*this.direction.dot(gr.crossVectors(on,gr));if(l<0)return null;const c=a*this.direction.dot(Ys.cross(on));if(c<0||l+c>o)return null;const h=-a*on.dot(Zs);return h<0?null:this.at(h/o,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Me{constructor(e,t,n,i,s,a,o,l,c,h,u,d,p,m,g,f){Me.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,i,s,a,o,l,c,h,u,d,p,m,g,f)}set(e,t,n,i,s,a,o,l,c,h,u,d,p,m,g,f){const x=this.elements;return x[0]=e,x[4]=t,x[8]=n,x[12]=i,x[1]=s,x[5]=a,x[9]=o,x[13]=l,x[2]=c,x[6]=h,x[10]=u,x[14]=d,x[3]=p,x[7]=m,x[11]=g,x[15]=f,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Me().fromArray(this.elements)}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){const t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){const t=this.elements,n=e.elements,i=1/Jn.setFromMatrixColumn(e,0).length(),s=1/Jn.setFromMatrixColumn(e,1).length(),a=1/Jn.setFromMatrixColumn(e,2).length();return t[0]=n[0]*i,t[1]=n[1]*i,t[2]=n[2]*i,t[3]=0,t[4]=n[4]*s,t[5]=n[5]*s,t[6]=n[6]*s,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,n=e.x,i=e.y,s=e.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(i),c=Math.sin(i),h=Math.cos(s),u=Math.sin(s);if(e.order==="XYZ"){const d=a*h,p=a*u,m=o*h,g=o*u;t[0]=l*h,t[4]=-l*u,t[8]=c,t[1]=p+m*c,t[5]=d-g*c,t[9]=-o*l,t[2]=g-d*c,t[6]=m+p*c,t[10]=a*l}else if(e.order==="YXZ"){const d=l*h,p=l*u,m=c*h,g=c*u;t[0]=d+g*o,t[4]=m*o-p,t[8]=a*c,t[1]=a*u,t[5]=a*h,t[9]=-o,t[2]=p*o-m,t[6]=g+d*o,t[10]=a*l}else if(e.order==="ZXY"){const d=l*h,p=l*u,m=c*h,g=c*u;t[0]=d-g*o,t[4]=-a*u,t[8]=m+p*o,t[1]=p+m*o,t[5]=a*h,t[9]=g-d*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){const d=a*h,p=a*u,m=o*h,g=o*u;t[0]=l*h,t[4]=m*c-p,t[8]=d*c+g,t[1]=l*u,t[5]=g*c+d,t[9]=p*c-m,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){const d=a*l,p=a*c,m=o*l,g=o*c;t[0]=l*h,t[4]=g-d*u,t[8]=m*u+p,t[1]=u,t[5]=a*h,t[9]=-o*h,t[2]=-c*h,t[6]=p*u+m,t[10]=d-g*u}else if(e.order==="XZY"){const d=a*l,p=a*c,m=o*l,g=o*c;t[0]=l*h,t[4]=-u,t[8]=c*h,t[1]=d*u+g,t[5]=a*h,t[9]=p*u-m,t[2]=m*u-p,t[6]=o*h,t[10]=g*u+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Sh,e,bh)}lookAt(e,t,n){const i=this.elements;return Tt.subVectors(e,t),Tt.lengthSq()===0&&(Tt.z=1),Tt.normalize(),ln.crossVectors(n,Tt),ln.lengthSq()===0&&(Math.abs(n.z)===1?Tt.x+=1e-4:Tt.z+=1e-4,Tt.normalize(),ln.crossVectors(n,Tt)),ln.normalize(),_r.crossVectors(Tt,ln),i[0]=ln.x,i[4]=_r.x,i[8]=Tt.x,i[1]=ln.y,i[5]=_r.y,i[9]=Tt.y,i[2]=ln.z,i[6]=_r.z,i[10]=Tt.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,i=t.elements,s=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],u=n[5],d=n[9],p=n[13],m=n[2],g=n[6],f=n[10],x=n[14],v=n[3],_=n[7],M=n[11],C=n[15],b=i[0],A=i[4],N=i[8],I=i[12],F=i[1],Y=i[5],L=i[9],W=i[13],X=i[2],oe=i[6],pe=i[10],ne=i[14],ee=i[3],K=i[7],H=i[11],k=i[15];return s[0]=a*b+o*F+l*X+c*ee,s[4]=a*A+o*Y+l*oe+c*K,s[8]=a*N+o*L+l*pe+c*H,s[12]=a*I+o*W+l*ne+c*k,s[1]=h*b+u*F+d*X+p*ee,s[5]=h*A+u*Y+d*oe+p*K,s[9]=h*N+u*L+d*pe+p*H,s[13]=h*I+u*W+d*ne+p*k,s[2]=m*b+g*F+f*X+x*ee,s[6]=m*A+g*Y+f*oe+x*K,s[10]=m*N+g*L+f*pe+x*H,s[14]=m*I+g*W+f*ne+x*k,s[3]=v*b+_*F+M*X+C*ee,s[7]=v*A+_*Y+M*oe+C*K,s[11]=v*N+_*L+M*pe+C*H,s[15]=v*I+_*W+M*ne+C*k,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[4],i=e[8],s=e[12],a=e[1],o=e[5],l=e[9],c=e[13],h=e[2],u=e[6],d=e[10],p=e[14];return e[3]*(+s*l*u-i*c*u-s*o*d+n*c*d+i*o*p-n*l*p)+e[7]*(+t*l*p-t*c*d+s*a*d-i*a*p+i*c*h-s*l*h)+e[11]*(+t*c*u-t*o*p-s*a*u+n*a*p+s*o*h-n*c*h)+e[15]*(-i*o*h-t*l*u+t*o*d+i*a*u-n*a*d+n*l*h)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){const i=this.elements;return e.isVector3?(i[12]=e.x,i[13]=e.y,i[14]=e.z):(i[12]=e,i[13]=t,i[14]=n),this}invert(){const e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],u=e[9],d=e[10],p=e[11],m=e[12],g=e[13],f=e[14],x=e[15],v=u*f*c-g*d*c+g*l*p-o*f*p-u*l*x+o*d*x,_=m*d*c-h*f*c-m*l*p+a*f*p+h*l*x-a*d*x,M=h*g*c-m*u*c+m*o*p-a*g*p-h*o*x+a*u*x,C=m*u*l-h*g*l-m*o*d+a*g*d+h*o*f-a*u*f,b=t*v+n*_+i*M+s*C;if(b===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const A=1/b;return e[0]=v*A,e[1]=(g*d*s-u*f*s-g*i*p+n*f*p+u*i*x-n*d*x)*A,e[2]=(o*f*s-g*l*s+g*i*c-n*f*c-o*i*x+n*l*x)*A,e[3]=(u*l*s-o*d*s-u*i*c+n*d*c+o*i*p-n*l*p)*A,e[4]=_*A,e[5]=(h*f*s-m*d*s+m*i*p-t*f*p-h*i*x+t*d*x)*A,e[6]=(m*l*s-a*f*s-m*i*c+t*f*c+a*i*x-t*l*x)*A,e[7]=(a*d*s-h*l*s+h*i*c-t*d*c-a*i*p+t*l*p)*A,e[8]=M*A,e[9]=(m*u*s-h*g*s-m*n*p+t*g*p+h*n*x-t*u*x)*A,e[10]=(a*g*s-m*o*s+m*n*c-t*g*c-a*n*x+t*o*x)*A,e[11]=(h*o*s-a*u*s-h*n*c+t*u*c+a*n*p-t*o*p)*A,e[12]=C*A,e[13]=(h*g*i-m*u*i+m*n*d-t*g*d-h*n*f+t*u*f)*A,e[14]=(m*o*i-a*g*i-m*n*l+t*g*l+a*n*f-t*o*f)*A,e[15]=(a*u*i-h*o*i+h*n*l-t*u*l-a*n*d+t*o*d)*A,this}scale(e){const t=this.elements,n=e.x,i=e.y,s=e.z;return t[0]*=n,t[4]*=i,t[8]*=s,t[1]*=n,t[5]*=i,t[9]*=s,t[2]*=n,t[6]*=i,t[10]*=s,t[3]*=n,t[7]*=i,t[11]*=s,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],i=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,i))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const n=Math.cos(t),i=Math.sin(t),s=1-n,a=e.x,o=e.y,l=e.z,c=s*a,h=s*o;return this.set(c*a+n,c*o-i*l,c*l+i*o,0,c*o+i*l,h*o+n,h*l-i*a,0,c*l-i*o,h*l+i*a,s*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,i,s,a){return this.set(1,n,s,0,e,1,a,0,t,i,1,0,0,0,0,1),this}compose(e,t,n){const i=this.elements,s=t._x,a=t._y,o=t._z,l=t._w,c=s+s,h=a+a,u=o+o,d=s*c,p=s*h,m=s*u,g=a*h,f=a*u,x=o*u,v=l*c,_=l*h,M=l*u,C=n.x,b=n.y,A=n.z;return i[0]=(1-(g+x))*C,i[1]=(p+M)*C,i[2]=(m-_)*C,i[3]=0,i[4]=(p-M)*b,i[5]=(1-(d+x))*b,i[6]=(f+v)*b,i[7]=0,i[8]=(m+_)*A,i[9]=(f-v)*A,i[10]=(1-(d+g))*A,i[11]=0,i[12]=e.x,i[13]=e.y,i[14]=e.z,i[15]=1,this}decompose(e,t,n){const i=this.elements;let s=Jn.set(i[0],i[1],i[2]).length();const a=Jn.set(i[4],i[5],i[6]).length(),o=Jn.set(i[8],i[9],i[10]).length();this.determinant()<0&&(s=-s),e.x=i[12],e.y=i[13],e.z=i[14],Ut.copy(this);const l=1/s,c=1/a,h=1/o;return Ut.elements[0]*=l,Ut.elements[1]*=l,Ut.elements[2]*=l,Ut.elements[4]*=c,Ut.elements[5]*=c,Ut.elements[6]*=c,Ut.elements[8]*=h,Ut.elements[9]*=h,Ut.elements[10]*=h,t.setFromRotationMatrix(Ut),n.x=s,n.y=a,n.z=o,this}makePerspective(e,t,n,i,s,a,o=2e3){const l=this.elements,c=2*s/(t-e),h=2*s/(n-i),u=(t+e)/(t-e),d=(n+i)/(n-i);let p,m;if(o===2e3)p=-(a+s)/(a-s),m=-2*a*s/(a-s);else{if(o!==2001)throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);p=-a/(a-s),m=-a*s/(a-s)}return l[0]=c,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=h,l[9]=d,l[13]=0,l[2]=0,l[6]=0,l[10]=p,l[14]=m,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,n,i,s,a,o=2e3){const l=this.elements,c=1/(t-e),h=1/(n-i),u=1/(a-s),d=(t+e)*c,p=(n+i)*h;let m,g;if(o===2e3)m=(a+s)*u,g=-2*u;else{if(o!==2001)throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);m=s*u,g=-1*u}return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-d,l[1]=0,l[5]=2*h,l[9]=0,l[13]=-p,l[2]=0,l[6]=0,l[10]=g,l[14]=-m,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){const t=this.elements,n=e.elements;for(let i=0;i<16;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}const Jn=new w,Ut=new Me,Sh=new w(0,0,0),bh=new w(1,1,1),ln=new w,_r=new w,Tt=new w,xo=new Me,yo=new vt;class Li{constructor(e=0,t=0,n=0,i=Li.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,i=this._order){return this._x=e,this._y=t,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){const i=e.elements,s=i[0],a=i[4],o=i[8],l=i[1],c=i[5],h=i[9],u=i[2],d=i[6],p=i[10];switch(t){case"XYZ":this._y=Math.asin(qe(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-a,s)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-qe(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,s),this._z=0);break;case"ZXY":this._x=Math.asin(qe(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,p),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-qe(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,p),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(qe(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,s)):(this._x=0,this._y=Math.atan2(o,p));break;case"XZY":this._z=Math.asin(-qe(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,s)):(this._x=Math.atan2(-h,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return xo.makeRotationFromQuaternion(e),this.setFromRotationMatrix(xo,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return yo.setFromEuler(this),this.setFromQuaternion(yo,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Li.DEFAULT_ORDER="XYZ";class vr{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!=0}isEnabled(e){return(this.mask&(1<<e|0))!=0}}let Th=0;const Mo=new w,Kn=new vt,Jt=new Me,xr=new w,Pi=new w,Eh=new w,wh=new vt,So=new w(1,0,0),bo=new w(0,1,0),To=new w(0,0,1),Ah={type:"added"},Rh={type:"removed"};class Be extends qt{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Th++}),this.uuid=bt(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Be.DEFAULT_UP.clone();const e=new w,t=new Li,n=new vt,i=new w(1,1,1);t._onChange((function(){n.setFromEuler(t,!1)})),n._onChange((function(){t.setFromQuaternion(n,void 0,!1)})),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Me},normalMatrix:{value:new we}}),this.matrix=new Me,this.matrixWorld=new Me,this.matrixAutoUpdate=Be.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Be.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new vr,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Kn.setFromAxisAngle(e,t),this.quaternion.multiply(Kn),this}rotateOnWorldAxis(e,t){return Kn.setFromAxisAngle(e,t),this.quaternion.premultiply(Kn),this}rotateX(e){return this.rotateOnAxis(So,e)}rotateY(e){return this.rotateOnAxis(bo,e)}rotateZ(e){return this.rotateOnAxis(To,e)}translateOnAxis(e,t){return Mo.copy(e).applyQuaternion(this.quaternion),this.position.add(Mo.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(So,e)}translateY(e){return this.translateOnAxis(bo,e)}translateZ(e){return this.translateOnAxis(To,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Jt.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?xr.copy(e):xr.set(e,t,n);const i=this.parent;this.updateWorldMatrix(!0,!1),Pi.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Jt.lookAt(Pi,xr,this.up):Jt.lookAt(xr,Pi,this.up),this.quaternion.setFromRotationMatrix(Jt),i&&(Jt.extractRotation(i.matrixWorld),Kn.setFromRotationMatrix(Jt),this.quaternion.premultiply(Kn.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.parent!==null&&e.parent.remove(e),e.parent=this,this.children.push(e),e.dispatchEvent(Ah)):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Rh)),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Jt.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Jt.multiply(e.parent.matrixWorld)),e.applyMatrix4(Jt),this.add(e),e.updateWorldMatrix(!1,!0),this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,i=this.children.length;n<i;n++){const s=this.children[n].getObjectByProperty(e,t);if(s!==void 0)return s}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);const i=this.children;for(let s=0,a=i.length;s<a;s++)i[s].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Pi,e,Eh),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Pi,wh,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let n=0,i=t.length;n<i;n++){const s=t[n];s.matrixWorldAutoUpdate!==!0&&e!==!0||s.updateMatrixWorld(e)}}updateWorldMatrix(e,t){const n=this.parent;if(e===!0&&n!==null&&n.matrixWorldAutoUpdate===!0&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),t===!0){const i=this.children;for(let s=0,a=i.length;s<a;s++){const o=i[s];o.matrixWorldAutoUpdate===!0&&o.updateWorldMatrix(!1,!0)}}}toJSON(e){const t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const i={};function s(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.visibility=this._visibility,i.active=this._active,i.bounds=this._bounds.map((o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()}))),i.maxGeometryCount=this._maxGeometryCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.geometryCount=this._geometryCount,i.matricesTexture=this._matricesTexture.toJSON(e),this.boundingSphere!==null&&(i.boundingSphere={center:i.boundingSphere.center.toArray(),radius:i.boundingSphere.radius}),this.boundingBox!==null&&(i.boundingBox={min:i.boundingBox.min.toArray(),max:i.boundingBox.max.toArray()})),this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=s(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const u=l[c];s(e.shapes,u)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(s(e.materials,this.material[l]));i.material=o}else i.material=s(e.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];i.animations.push(s(e.animations,l))}}if(t){const o=a(e.geometries),l=a(e.materials),c=a(e.textures),h=a(e.images),u=a(e.shapes),d=a(e.skeletons),p=a(e.animations),m=a(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),p.length>0&&(n.animations=p),m.length>0&&(n.nodes=m)}return n.object=i,n;function a(o){const l=[];for(const c in o){const h=o[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){const i=e.children[n];this.add(i.clone())}return this}}Be.DEFAULT_UP=new w(0,1,0),Be.DEFAULT_MATRIX_AUTO_UPDATE=!0,Be.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const Dt=new w,Kt=new w,Js=new w,$t=new w,$n=new w,Qn=new w,Eo=new w,Ks=new w,$s=new w,Qs=new w;let yr=!1;class xt{constructor(e=new w,t=new w,n=new w){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,i){i.subVectors(n,t),Dt.subVectors(e,t),i.cross(Dt);const s=i.lengthSq();return s>0?i.multiplyScalar(1/Math.sqrt(s)):i.set(0,0,0)}static getBarycoord(e,t,n,i,s){Dt.subVectors(i,t),Kt.subVectors(n,t),Js.subVectors(e,t);const a=Dt.dot(Dt),o=Dt.dot(Kt),l=Dt.dot(Js),c=Kt.dot(Kt),h=Kt.dot(Js),u=a*c-o*o;if(u===0)return s.set(0,0,0),null;const d=1/u,p=(c*l-o*h)*d,m=(a*h-o*l)*d;return s.set(1-p-m,m,p)}static containsPoint(e,t,n,i){return this.getBarycoord(e,t,n,i,$t)!==null&&$t.x>=0&&$t.y>=0&&$t.x+$t.y<=1}static getUV(e,t,n,i,s,a,o,l){return yr===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),yr=!0),this.getInterpolation(e,t,n,i,s,a,o,l)}static getInterpolation(e,t,n,i,s,a,o,l){return this.getBarycoord(e,t,n,i,$t)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,$t.x),l.addScaledVector(a,$t.y),l.addScaledVector(o,$t.z),l)}static isFrontFacing(e,t,n,i){return Dt.subVectors(n,t),Kt.subVectors(e,t),Dt.cross(Kt).dot(i)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,i){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[i]),this}setFromAttributeAndIndices(e,t,n,i){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,i),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Dt.subVectors(this.c,this.b),Kt.subVectors(this.a,this.b),.5*Dt.cross(Kt).length()}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return xt.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return xt.getBarycoord(e,this.a,this.b,this.c,t)}getUV(e,t,n,i,s){return yr===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),yr=!0),xt.getInterpolation(e,this.a,this.b,this.c,t,n,i,s)}getInterpolation(e,t,n,i,s){return xt.getInterpolation(e,this.a,this.b,this.c,t,n,i,s)}containsPoint(e){return xt.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return xt.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const n=this.a,i=this.b,s=this.c;let a,o;$n.subVectors(i,n),Qn.subVectors(s,n),Ks.subVectors(e,n);const l=$n.dot(Ks),c=Qn.dot(Ks);if(l<=0&&c<=0)return t.copy(n);$s.subVectors(e,i);const h=$n.dot($s),u=Qn.dot($s);if(h>=0&&u<=h)return t.copy(i);const d=l*u-h*c;if(d<=0&&l>=0&&h<=0)return a=l/(l-h),t.copy(n).addScaledVector($n,a);Qs.subVectors(e,s);const p=$n.dot(Qs),m=Qn.dot(Qs);if(m>=0&&p<=m)return t.copy(s);const g=p*c-l*m;if(g<=0&&c>=0&&m<=0)return o=c/(c-m),t.copy(n).addScaledVector(Qn,o);const f=h*m-p*u;if(f<=0&&u-h>=0&&p-m>=0)return Eo.subVectors(s,i),o=(u-h)/(u-h+(p-m)),t.copy(i).addScaledVector(Eo,o);const x=1/(f+g+d);return a=g*x,o=d*x,t.copy(n).addScaledVector($n,a).addScaledVector(Qn,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}const wo={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},cn={h:0,s:0,l:0},Mr={h:0,s:0,l:0};function ea(r,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?r+6*(e-r)*t:t<.5?e:t<2/3?r+6*(e-r)*(2/3-t):r}class de{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const i=e;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=$e){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(255&e)/255,Ge.toWorkingColorSpace(this,t),this}setRGB(e,t,n,i=Ge.workingColorSpace){return this.r=e,this.g=t,this.b=n,Ge.toWorkingColorSpace(this,i),this}setHSL(e,t,n,i=Ge.workingColorSpace){if(e=Fs(e,1),t=qe(t,0,1),n=qe(n,0,1),t===0)this.r=this.g=this.b=n;else{const s=n<=.5?n*(1+t):n+t-n*t,a=2*n-s;this.r=ea(a,s,e+1/3),this.g=ea(a,s,e),this.b=ea(a,s,e-1/3)}return Ge.toWorkingColorSpace(this,i),this}setStyle(e,t=$e){function n(s){s!==void 0&&parseFloat(s)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(e)){let s;const a=i[1],o=i[2];switch(a){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(e)){const s=i[1],a=s.length;if(a===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(s,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=$e){const n=wo[e.toLowerCase()];return n!==void 0?this.setHex(n,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Wn(e.r),this.g=Wn(e.g),this.b=Wn(e.b),this}copyLinearToSRGB(e){return this.r=Gs(e.r),this.g=Gs(e.g),this.b=Gs(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=$e){return Ge.fromWorkingColorSpace(lt.copy(this),e),65536*Math.round(qe(255*lt.r,0,255))+256*Math.round(qe(255*lt.g,0,255))+Math.round(qe(255*lt.b,0,255))}getHexString(e=$e){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Ge.workingColorSpace){Ge.fromWorkingColorSpace(lt.copy(this),t);const n=lt.r,i=lt.g,s=lt.b,a=Math.max(n,i,s),o=Math.min(n,i,s);let l,c;const h=(o+a)/2;if(o===a)l=0,c=0;else{const u=a-o;switch(c=h<=.5?u/(a+o):u/(2-a-o),a){case n:l=(i-s)/u+(i<s?6:0);break;case i:l=(s-n)/u+2;break;case s:l=(n-i)/u+4}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=Ge.workingColorSpace){return Ge.fromWorkingColorSpace(lt.copy(this),t),e.r=lt.r,e.g=lt.g,e.b=lt.b,e}getStyle(e=$e){Ge.fromWorkingColorSpace(lt.copy(this),e);const t=lt.r,n=lt.g,i=lt.b;return e!==$e?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(255*t)},${Math.round(255*n)},${Math.round(255*i)})`}offsetHSL(e,t,n){return this.getHSL(cn),this.setHSL(cn.h+e,cn.s+t,cn.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(cn),e.getHSL(Mr);const n=Ei(cn.h,Mr.h,t),i=Ei(cn.s,Mr.s,t),s=Ei(cn.l,Mr.l,t);return this.setHSL(n,i,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,i=this.b,s=e.elements;return this.r=s[0]*t+s[3]*n+s[6]*i,this.g=s[1]*t+s[4]*n+s[7]*i,this.b=s[2]*t+s[5]*n+s[8]*i,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const lt=new de;de.NAMES=wo;let Ch=0;class ct extends qt{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Ch++}),this.uuid=bt(),this.name="",this.type="Material",this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new de(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=7680,this.stencilZFail=7680,this.stencilZPass=7680,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBuild(){}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}const i=this[t];i!==void 0?i&&i.isColor?i.set(n):i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[t]=n:console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`)}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};function i(s){const a=[];for(const o in s){const l=s[o];delete l.metadata,a.push(l)}return a}if(n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==1&&(n.blending=this.blending),this.side!==0&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==204&&(n.blendSrc=this.blendSrc),this.blendDst!==205&&(n.blendDst=this.blendDst),this.blendEquation!==100&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==3&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==519&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==7680&&(n.stencilFail=this.stencilFail),this.stencilZFail!==7680&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==7680&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData),t){const s=i(e.textures),a=i(e.images);s.length>0&&(n.textures=s),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const i=t.length;n=new Array(i);for(let s=0;s!==i;++s)n[s]=t[s].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}class hn extends ct{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new de(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=0,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const Qt=Lh();function Lh(){const r=new ArrayBuffer(4),e=new Float32Array(r),t=new Uint32Array(r),n=new Uint32Array(512),i=new Uint32Array(512);for(let l=0;l<256;++l){const c=l-127;c<-27?(n[l]=0,n[256|l]=32768,i[l]=24,i[256|l]=24):c<-14?(n[l]=1024>>-c-14,n[256|l]=1024>>-c-14|32768,i[l]=-c-1,i[256|l]=-c-1):c<=15?(n[l]=c+15<<10,n[256|l]=c+15<<10|32768,i[l]=13,i[256|l]=13):c<128?(n[l]=31744,n[256|l]=64512,i[l]=24,i[256|l]=24):(n[l]=31744,n[256|l]=64512,i[l]=13,i[256|l]=13)}const s=new Uint32Array(2048),a=new Uint32Array(64),o=new Uint32Array(64);for(let l=1;l<1024;++l){let c=l<<13,h=0;for(;(8388608&c)==0;)c<<=1,h-=8388608;c&=-8388609,h+=947912704,s[l]=c|h}for(let l=1024;l<2048;++l)s[l]=939524096+(l-1024<<13);for(let l=1;l<31;++l)a[l]=l<<23;a[31]=1199570944,a[32]=2147483648;for(let l=33;l<63;++l)a[l]=2147483648+(l-32<<23);a[63]=3347054592;for(let l=1;l<64;++l)l!==32&&(o[l]=1024);return{floatView:e,uint32View:t,baseTable:n,shiftTable:i,mantissaTable:s,exponentTable:a,offsetTable:o}}function yt(r){Math.abs(r)>65504&&console.warn("THREE.DataUtils.toHalfFloat(): Value out of range."),r=qe(r,-65504,65504),Qt.floatView[0]=r;const e=Qt.uint32View[0],t=e>>23&511;return Qt.baseTable[t]+((8388607&e)>>Qt.shiftTable[t])}function Ii(r){const e=r>>10;return Qt.uint32View[0]=Qt.mantissaTable[Qt.offsetTable[e]+(1023&r)]+Qt.exponentTable[e],Qt.floatView[0]}const Ph={toHalfFloat:yt,fromHalfFloat:Ii},Ke=new w,Sr=new ie;class Ve{constructor(e,t,n=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=35044,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.gpuType=1015,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}get updateRange(){return console.warn("THREE.BufferAttribute: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let i=0,s=this.itemSize;i<s;i++)this.array[e+i]=t.array[n+i];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Sr.fromBufferAttribute(this,t),Sr.applyMatrix3(e),this.setXY(t,Sr.x,Sr.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Ke.fromBufferAttribute(this,t),Ke.applyMatrix3(e),this.setXYZ(t,Ke.x,Ke.y,Ke.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Ke.fromBufferAttribute(this,t),Ke.applyMatrix4(e),this.setXYZ(t,Ke.x,Ke.y,Ke.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Ke.fromBufferAttribute(this,t),Ke.applyNormalMatrix(e),this.setXYZ(t,Ke.x,Ke.y,Ke.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Ke.fromBufferAttribute(this,t),Ke.transformDirection(e),this.setXYZ(t,Ke.x,Ke.y,Ke.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=_t(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Te(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=_t(t,this.array)),t}setX(e,t){return this.normalized&&(t=Te(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=_t(t,this.array)),t}setY(e,t){return this.normalized&&(t=Te(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=_t(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Te(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=_t(t,this.array)),t}setW(e,t){return this.normalized&&(t=Te(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=Te(t,this.array),n=Te(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,i){return e*=this.itemSize,this.normalized&&(t=Te(t,this.array),n=Te(n,this.array),i=Te(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this}setXYZW(e,t,n,i,s){return e*=this.itemSize,this.normalized&&(t=Te(t,this.array),n=Te(n,this.array),i=Te(i,this.array),s=Te(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==35044&&(e.usage=this.usage),e}}class ta extends Ve{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class na extends Ve{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class me extends Ve{constructor(e,t,n){super(new Float32Array(e),t,n)}}let Ih=0;const At=new Me,ia=new Be,ei=new w,Et=new pt,Ui=new pt,it=new w;class Ae extends qt{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Ih++}),this.uuid=bt(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(uo(e)?na:ta)(e,1):this.index=e,this}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const s=new we().getNormalMatrix(e);n.applyNormalMatrix(s),n.needsUpdate=!0}const i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(e),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return At.makeRotationFromQuaternion(e),this.applyMatrix4(At),this}rotateX(e){return At.makeRotationX(e),this.applyMatrix4(At),this}rotateY(e){return At.makeRotationY(e),this.applyMatrix4(At),this}rotateZ(e){return At.makeRotationZ(e),this.applyMatrix4(At),this}translate(e,t,n){return At.makeTranslation(e,t,n),this.applyMatrix4(At),this}scale(e,t,n){return At.makeScale(e,t,n),this.applyMatrix4(At),this}lookAt(e){return ia.lookAt(e),ia.updateMatrix(),this.applyMatrix4(ia.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ei).negate(),this.translate(ei.x,ei.y,ei.z),this}setFromPoints(e){const t=[];for(let n=0,i=e.length;n<i;n++){const s=e[n];t.push(s.x,s.y,s.z||0)}return this.setAttribute("position",new me(t,3)),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new pt);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute)return console.error('THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box. Alternatively set "mesh.frustumCulled" to "false".',this),void this.boundingBox.set(new w(-1/0,-1/0,-1/0),new w(1/0,1/0,1/0));if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,i=t.length;n<i;n++){const s=t[n];Et.setFromBufferAttribute(s),this.morphTargetsRelative?(it.addVectors(this.boundingBox.min,Et.min),this.boundingBox.expandByPoint(it),it.addVectors(this.boundingBox.max,Et.max),this.boundingBox.expandByPoint(it)):(this.boundingBox.expandByPoint(Et.min),this.boundingBox.expandByPoint(Et.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ot);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute)return console.error('THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere. Alternatively set "mesh.frustumCulled" to "false".',this),void this.boundingSphere.set(new w,1/0);if(e){const n=this.boundingSphere.center;if(Et.setFromBufferAttribute(e),t)for(let s=0,a=t.length;s<a;s++){const o=t[s];Ui.setFromBufferAttribute(o),this.morphTargetsRelative?(it.addVectors(Et.min,Ui.min),Et.expandByPoint(it),it.addVectors(Et.max,Ui.max),Et.expandByPoint(it)):(Et.expandByPoint(Ui.min),Et.expandByPoint(Ui.max))}Et.getCenter(n);let i=0;for(let s=0,a=e.count;s<a;s++)it.fromBufferAttribute(e,s),i=Math.max(i,n.distanceToSquared(it));if(t)for(let s=0,a=t.length;s<a;s++){const o=t[s],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)it.fromBufferAttribute(o,c),l&&(ei.fromBufferAttribute(e,c),it.add(ei)),i=Math.max(i,n.distanceToSquared(it))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0)return void console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");const n=e.array,i=t.position.array,s=t.normal.array,a=t.uv.array,o=i.length/3;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Ve(new Float32Array(4*o),4));const l=this.getAttribute("tangent").array,c=[],h=[];for(let F=0;F<o;F++)c[F]=new w,h[F]=new w;const u=new w,d=new w,p=new w,m=new ie,g=new ie,f=new ie,x=new w,v=new w;function _(F,Y,L){u.fromArray(i,3*F),d.fromArray(i,3*Y),p.fromArray(i,3*L),m.fromArray(a,2*F),g.fromArray(a,2*Y),f.fromArray(a,2*L),d.sub(u),p.sub(u),g.sub(m),f.sub(m);const W=1/(g.x*f.y-f.x*g.y);isFinite(W)&&(x.copy(d).multiplyScalar(f.y).addScaledVector(p,-g.y).multiplyScalar(W),v.copy(p).multiplyScalar(g.x).addScaledVector(d,-f.x).multiplyScalar(W),c[F].add(x),c[Y].add(x),c[L].add(x),h[F].add(v),h[Y].add(v),h[L].add(v))}let M=this.groups;M.length===0&&(M=[{start:0,count:n.length}]);for(let F=0,Y=M.length;F<Y;++F){const L=M[F],W=L.start;for(let X=W,oe=W+L.count;X<oe;X+=3)_(n[X+0],n[X+1],n[X+2])}const C=new w,b=new w,A=new w,N=new w;function I(F){A.fromArray(s,3*F),N.copy(A);const Y=c[F];C.copy(Y),C.sub(A.multiplyScalar(A.dot(Y))).normalize(),b.crossVectors(N,Y);const L=b.dot(h[F])<0?-1:1;l[4*F]=C.x,l[4*F+1]=C.y,l[4*F+2]=C.z,l[4*F+3]=L}for(let F=0,Y=M.length;F<Y;++F){const L=M[F],W=L.start;for(let X=W,oe=W+L.count;X<oe;X+=3)I(n[X+0]),I(n[X+1]),I(n[X+2])}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new Ve(new Float32Array(3*t.count),3),this.setAttribute("normal",n);else for(let d=0,p=n.count;d<p;d++)n.setXYZ(d,0,0,0);const i=new w,s=new w,a=new w,o=new w,l=new w,c=new w,h=new w,u=new w;if(e)for(let d=0,p=e.count;d<p;d+=3){const m=e.getX(d+0),g=e.getX(d+1),f=e.getX(d+2);i.fromBufferAttribute(t,m),s.fromBufferAttribute(t,g),a.fromBufferAttribute(t,f),h.subVectors(a,s),u.subVectors(i,s),h.cross(u),o.fromBufferAttribute(n,m),l.fromBufferAttribute(n,g),c.fromBufferAttribute(n,f),o.add(h),l.add(h),c.add(h),n.setXYZ(m,o.x,o.y,o.z),n.setXYZ(g,l.x,l.y,l.z),n.setXYZ(f,c.x,c.y,c.z)}else for(let d=0,p=t.count;d<p;d+=3)i.fromBufferAttribute(t,d+0),s.fromBufferAttribute(t,d+1),a.fromBufferAttribute(t,d+2),h.subVectors(a,s),u.subVectors(i,s),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)it.fromBufferAttribute(e,t),it.normalize(),e.setXYZ(t,it.x,it.y,it.z)}toNonIndexed(){function e(o,l){const c=o.array,h=o.itemSize,u=o.normalized,d=new c.constructor(l.length*h);let p=0,m=0;for(let g=0,f=l.length;g<f;g++){p=o.isInterleavedBufferAttribute?l[g]*o.data.stride+o.offset:l[g]*h;for(let x=0;x<h;x++)d[m++]=c[p++]}return new Ve(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new Ae,n=this.index.array,i=this.attributes;for(const o in i){const l=e(i[o],n);t.setAttribute(o,l)}const s=this.morphAttributes;for(const o in s){const l=[],c=s[o];for(let h=0,u=c.length;h<u;h++){const d=e(c[h],n);l.push(d)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const n=this.attributes;for(const l in n){const c=n[l];e.data.attributes[l]=c.toJSON(e.data)}const i={};let s=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let u=0,d=c.length;u<d;u++){const p=c[u];h.push(p.toJSON(e.data))}h.length>0&&(i[l]=h,s=!0)}s&&(e.data.morphAttributes=i,e.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const n=e.index;n!==null&&this.setIndex(n.clone(t));const i=e.attributes;for(const c in i){const h=i[c];this.setAttribute(c,h.clone(t))}const s=e.morphAttributes;for(const c in s){const h=[],u=s[c];for(let d=0,p=u.length;d<p;d++)h.push(u[d].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;const a=e.groups;for(let c=0,h=a.length;c<h;c++){const u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const Ao=new Me,Mn=new Zn,br=new ot,Ro=new w,ti=new w,ni=new w,ii=new w,ra=new w,Tr=new w,Er=new ie,wr=new ie,Ar=new ie,Co=new w,Lo=new w,Po=new w,Rr=new w,Cr=new w;class Qe extends Be{constructor(e=new Ae,t=new hn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){const n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let i=0,s=n.length;i<s;i++){const a=n[i].name||String(i);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=i}}}}getVertexPosition(e,t){const n=this.geometry,i=n.attributes.position,s=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(i,e);const o=this.morphTargetInfluences;if(s&&o){Tr.set(0,0,0);for(let l=0,c=s.length;l<c;l++){const h=o[l],u=s[l];h!==0&&(ra.fromBufferAttribute(u,e),a?Tr.addScaledVector(ra,h):Tr.addScaledVector(ra.sub(t),h))}t.add(Tr)}return t}raycast(e,t){const n=this.geometry,i=this.material,s=this.matrixWorld;if(i!==void 0){if(n.boundingSphere===null&&n.computeBoundingSphere(),br.copy(n.boundingSphere),br.applyMatrix4(s),Mn.copy(e.ray).recast(e.near),br.containsPoint(Mn.origin)===!1&&(Mn.intersectSphere(br,Ro)===null||Mn.origin.distanceToSquared(Ro)>(e.far-e.near)**2))return;Ao.copy(s).invert(),Mn.copy(e.ray).applyMatrix4(Ao),n.boundingBox!==null&&Mn.intersectsBox(n.boundingBox)===!1||this._computeIntersections(e,t,Mn)}}_computeIntersections(e,t,n){let i;const s=this.geometry,a=this.material,o=s.index,l=s.attributes.position,c=s.attributes.uv,h=s.attributes.uv1,u=s.attributes.normal,d=s.groups,p=s.drawRange;if(o!==null)if(Array.isArray(a))for(let m=0,g=d.length;m<g;m++){const f=d[m],x=a[f.materialIndex];for(let v=Math.max(f.start,p.start),_=Math.min(o.count,Math.min(f.start+f.count,p.start+p.count));v<_;v+=3)i=Lr(this,x,e,n,c,h,u,o.getX(v),o.getX(v+1),o.getX(v+2)),i&&(i.faceIndex=Math.floor(v/3),i.face.materialIndex=f.materialIndex,t.push(i))}else for(let m=Math.max(0,p.start),g=Math.min(o.count,p.start+p.count);m<g;m+=3)i=Lr(this,a,e,n,c,h,u,o.getX(m),o.getX(m+1),o.getX(m+2)),i&&(i.faceIndex=Math.floor(m/3),t.push(i));else if(l!==void 0)if(Array.isArray(a))for(let m=0,g=d.length;m<g;m++){const f=d[m],x=a[f.materialIndex];for(let v=Math.max(f.start,p.start),_=Math.min(l.count,Math.min(f.start+f.count,p.start+p.count));v<_;v+=3)i=Lr(this,x,e,n,c,h,u,v,v+1,v+2),i&&(i.faceIndex=Math.floor(v/3),i.face.materialIndex=f.materialIndex,t.push(i))}else for(let m=Math.max(0,p.start),g=Math.min(l.count,p.start+p.count);m<g;m+=3)i=Lr(this,a,e,n,c,h,u,m,m+1,m+2),i&&(i.faceIndex=Math.floor(m/3),t.push(i))}}function Lr(r,e,t,n,i,s,a,o,l,c){r.getVertexPosition(o,ti),r.getVertexPosition(l,ni),r.getVertexPosition(c,ii);const h=(function(u,d,p,m,g,f,x,v){let _;if(_=d.side===1?m.intersectTriangle(x,f,g,!0,v):m.intersectTriangle(g,f,x,d.side===0,v),_===null)return null;Cr.copy(v),Cr.applyMatrix4(u.matrixWorld);const M=p.ray.origin.distanceTo(Cr);return M<p.near||M>p.far?null:{distance:M,point:Cr.clone(),object:u}})(r,e,t,n,ti,ni,ii,Rr);if(h){i&&(Er.fromBufferAttribute(i,o),wr.fromBufferAttribute(i,l),Ar.fromBufferAttribute(i,c),h.uv=xt.getInterpolation(Rr,ti,ni,ii,Er,wr,Ar,new ie)),s&&(Er.fromBufferAttribute(s,o),wr.fromBufferAttribute(s,l),Ar.fromBufferAttribute(s,c),h.uv1=xt.getInterpolation(Rr,ti,ni,ii,Er,wr,Ar,new ie),h.uv2=h.uv1),a&&(Co.fromBufferAttribute(a,o),Lo.fromBufferAttribute(a,l),Po.fromBufferAttribute(a,c),h.normal=xt.getInterpolation(Rr,ti,ni,ii,Co,Lo,Po,new w),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const u={a:o,b:l,c,normal:new w,materialIndex:0};xt.getNormal(ti,ni,ii,u.normal),h.face=u}return h}class Sn extends Ae{constructor(e=1,t=1,n=1,i=1,s=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:i,heightSegments:s,depthSegments:a};const o=this;i=Math.floor(i),s=Math.floor(s),a=Math.floor(a);const l=[],c=[],h=[],u=[];let d=0,p=0;function m(g,f,x,v,_,M,C,b,A,N,I){const F=M/A,Y=C/N,L=M/2,W=C/2,X=b/2,oe=A+1,pe=N+1;let ne=0,ee=0;const K=new w;for(let H=0;H<pe;H++){const k=H*Y-W;for(let ce=0;ce<oe;ce++){const E=ce*F-L;K[g]=E*v,K[f]=k*_,K[x]=X,c.push(K.x,K.y,K.z),K[g]=0,K[f]=0,K[x]=b>0?1:-1,h.push(K.x,K.y,K.z),u.push(ce/A),u.push(1-H/N),ne+=1}}for(let H=0;H<N;H++)for(let k=0;k<A;k++){const ce=d+k+oe*H,E=d+k+oe*(H+1),T=d+(k+1)+oe*(H+1),O=d+(k+1)+oe*H;l.push(ce,E,O),l.push(E,T,O),ee+=6}o.addGroup(p,ee,I),p+=ee,d+=ne}m("z","y","x",-1,-1,n,t,e,a,s,0),m("z","y","x",1,-1,n,t,-e,a,s,1),m("x","z","y",1,1,e,n,t,i,a,2),m("x","z","y",1,-1,e,n,-t,i,a,3),m("x","y","z",1,-1,e,t,n,i,s,4),m("x","y","z",-1,-1,e,t,-n,i,s,5),this.setIndex(l),this.setAttribute("position",new me(c,3)),this.setAttribute("normal",new me(h,3)),this.setAttribute("uv",new me(u,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Sn(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}function ri(r){const e={};for(const t in r){e[t]={};for(const n in r[t]){const i=r[t][n];i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)?i.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=i.clone():Array.isArray(i)?e[t][n]=i.slice():e[t][n]=i}}return e}function ft(r){const e={};for(let t=0;t<r.length;t++){const n=ri(r[t]);for(const i in n)e[i]=n[i]}return e}function Io(r){return r.getRenderTarget()===null?r.outputColorSpace:Ge.workingColorSpace}const Uo={clone:ri,merge:ft};class Vt extends ct{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,this.fragmentShader=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={derivatives:!1,fragDepth:!1,drawBuffers:!1,shaderTextureLOD:!1,clipCullDistance:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=ri(e.uniforms),this.uniformsGroups=(function(t){const n=[];for(let i=0;i<t.length;i++)n.push(t[i].clone());return n})(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const i in this.uniforms){const s=this.uniforms[i].value;s&&s.isTexture?t.uniforms[i]={type:"t",value:s.toJSON(e).uuid}:s&&s.isColor?t.uniforms[i]={type:"c",value:s.getHex()}:s&&s.isVector2?t.uniforms[i]={type:"v2",value:s.toArray()}:s&&s.isVector3?t.uniforms[i]={type:"v3",value:s.toArray()}:s&&s.isVector4?t.uniforms[i]={type:"v4",value:s.toArray()}:s&&s.isMatrix3?t.uniforms[i]={type:"m3",value:s.toArray()}:s&&s.isMatrix4?t.uniforms[i]={type:"m4",value:s.toArray()}:t.uniforms[i]={value:s}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}}class Pr extends Be{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Me,this.projectionMatrix=new Me,this.projectionMatrixInverse=new Me,this.coordinateSystem=2e3}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}class st extends Pr{constructor(e=50,t=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=2*Vn*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(.5*_n*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return 2*Vn*Math.atan(Math.tan(.5*_n*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}setViewOffset(e,t,n,i,s,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(.5*_n*this.fov)/this.zoom,n=2*t,i=this.aspect*n,s=-.5*i;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;s+=a.offsetX*i/l,t-=a.offsetY*n/c,i*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(s+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+i,t,t-n,e,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}const si=-90;class Do extends Be{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const i=new st(si,1,e,t);i.layers=this.layers,this.add(i);const s=new st(si,1,e,t);s.layers=this.layers,this.add(s);const a=new st(si,1,e,t);a.layers=this.layers,this.add(a);const o=new st(si,1,e,t);o.layers=this.layers,this.add(o);const l=new st(si,1,e,t);l.layers=this.layers,this.add(l);const c=new st(si,1,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,i,s,a,o,l]=t;for(const c of t)this.remove(c);if(e===2e3)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else{if(e!==2001)throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1)}for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[s,a,o,l,c,h]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),m=e.xr.enabled;e.xr.enabled=!1;const g=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,e.setRenderTarget(n,0,i),e.render(t,s),e.setRenderTarget(n,1,i),e.render(t,a),e.setRenderTarget(n,2,i),e.render(t,o),e.setRenderTarget(n,3,i),e.render(t,l),e.setRenderTarget(n,4,i),e.render(t,c),n.texture.generateMipmaps=g,e.setRenderTarget(n,5,i),e.render(t,h),e.setRenderTarget(u,d,p),e.xr.enabled=m,n.texture.needsPMREMUpdate=!0}}class Di extends Ze{constructor(e,t,n,i,s,a,o,l,c,h){super(e=e!==void 0?e:[],t=t!==void 0?t:301,n,i,s,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class No extends Pt{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1},i=[n,n,n,n,n,n];t.encoding!==void 0&&(Ai("THREE.WebGLCubeRenderTarget: option.encoding has been replaced by option.colorSpace."),t.colorSpace=t.encoding===3001?$e:""),this.texture=new Di(i,t.mapping,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.format,t.type,t.anisotropy,t.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=t.generateMipmaps!==void 0&&t.generateMipmaps,this.texture.minFilter=t.minFilter!==void 0?t.minFilter:1006}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},i=new Sn(5,5,5),s=new Vt({name:"CubemapFromEquirect",uniforms:ri(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:1,blending:0});s.uniforms.tEquirect.value=t;const a=new Qe(i,s),o=t.minFilter;return t.minFilter===1008&&(t.minFilter=1006),new Do(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t,n,i){const s=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,n,i);e.setRenderTarget(s)}}const sa=new w,Uh=new w,Dh=new we;class un{constructor(e=new w(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,i){return this.normal.set(e,t,n),this.constant=i,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const i=sa.subVectors(n,t).cross(Uh.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(i,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const n=e.delta(sa),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const s=-(e.start.dot(this.normal)+this.constant)/i;return s<0||s>1?null:t.copy(e.start).addScaledVector(n,s)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||Dh.getNormalMatrix(e),i=this.coplanarPoint(sa).applyMatrix4(e),s=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const bn=new ot,Ir=new w;class Ni{constructor(e=new un,t=new un,n=new un,i=new un,s=new un,a=new un){this.planes=[e,t,n,i,s,a]}set(e,t,n,i,s,a){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(i),o[4].copy(s),o[5].copy(a),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=2e3){const n=this.planes,i=e.elements,s=i[0],a=i[1],o=i[2],l=i[3],c=i[4],h=i[5],u=i[6],d=i[7],p=i[8],m=i[9],g=i[10],f=i[11],x=i[12],v=i[13],_=i[14],M=i[15];if(n[0].setComponents(l-s,d-c,f-p,M-x).normalize(),n[1].setComponents(l+s,d+c,f+p,M+x).normalize(),n[2].setComponents(l+a,d+h,f+m,M+v).normalize(),n[3].setComponents(l-a,d-h,f-m,M-v).normalize(),n[4].setComponents(l-o,d-u,f-g,M-_).normalize(),t===2e3)n[5].setComponents(l+o,d+u,f+g,M+_).normalize();else{if(t!==2001)throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);n[5].setComponents(o,u,g,_).normalize()}return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),bn.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),bn.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(bn)}intersectsSprite(e){return bn.center.set(0,0,0),bn.radius=.7071067811865476,bn.applyMatrix4(e.matrixWorld),this.intersectsSphere(bn)}intersectsSphere(e){const t=this.planes,n=e.center,i=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(n)<i)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const i=t[n];if(Ir.x=i.normal.x>0?e.max.x:e.min.x,Ir.y=i.normal.y>0?e.max.y:e.min.y,Ir.z=i.normal.z>0?e.max.z:e.min.z,i.distanceToPoint(Ir)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function Oo(){let r=null,e=!1,t=null,n=null;function i(s,a){t(s,a),n=r.requestAnimationFrame(i)}return{start:function(){e!==!0&&t!==null&&(n=r.requestAnimationFrame(i),e=!0)},stop:function(){r.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){r=s}}}function Nh(r,e){const t=e.isWebGL2,n=new WeakMap;return{get:function(i){return i.isInterleavedBufferAttribute&&(i=i.data),n.get(i)},remove:function(i){i.isInterleavedBufferAttribute&&(i=i.data);const s=n.get(i);s&&(r.deleteBuffer(s.buffer),n.delete(i))},update:function(i,s){if(i.isGLBufferAttribute){const o=n.get(i);return void((!o||o.version<i.version)&&n.set(i,{buffer:i.buffer,type:i.type,bytesPerElement:i.elementSize,version:i.version}))}i.isInterleavedBufferAttribute&&(i=i.data);const a=n.get(i);if(a===void 0)n.set(i,(function(o,l){const c=o.array,h=o.usage,u=c.byteLength,d=r.createBuffer();let p;if(r.bindBuffer(l,d),r.bufferData(l,c,h),o.onUploadCallback(),c instanceof Float32Array)p=r.FLOAT;else if(c instanceof Uint16Array)if(o.isFloat16BufferAttribute){if(!t)throw new Error("THREE.WebGLAttributes: Usage of Float16BufferAttribute requires WebGL2.");p=r.HALF_FLOAT}else p=r.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=r.SHORT;else if(c instanceof Uint32Array)p=r.UNSIGNED_INT;else if(c instanceof Int32Array)p=r.INT;else if(c instanceof Int8Array)p=r.BYTE;else if(c instanceof Uint8Array)p=r.UNSIGNED_BYTE;else{if(!(c instanceof Uint8ClampedArray))throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);p=r.UNSIGNED_BYTE}return{buffer:d,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:u}})(i,s));else if(a.version<i.version){if(a.size!==i.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");(function(o,l,c){const h=l.array,u=l._updateRange,d=l.updateRanges;if(r.bindBuffer(c,o),u.count===-1&&d.length===0&&r.bufferSubData(c,0,h),d.length!==0){for(let p=0,m=d.length;p<m;p++){const g=d[p];t?r.bufferSubData(c,g.start*h.BYTES_PER_ELEMENT,h,g.start,g.count):r.bufferSubData(c,g.start*h.BYTES_PER_ELEMENT,h.subarray(g.start,g.start+g.count))}l.clearUpdateRanges()}u.count!==-1&&(t?r.bufferSubData(c,u.offset*h.BYTES_PER_ELEMENT,h,u.offset,u.count):r.bufferSubData(c,u.offset*h.BYTES_PER_ELEMENT,h.subarray(u.offset,u.offset+u.count)),u.count=-1),l.onUploadCallback()})(a.buffer,i,s),a.version=i.version}}}}class Oi extends Ae{constructor(e=1,t=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:i};const s=e/2,a=t/2,o=Math.floor(n),l=Math.floor(i),c=o+1,h=l+1,u=e/o,d=t/l,p=[],m=[],g=[],f=[];for(let x=0;x<h;x++){const v=x*d-a;for(let _=0;_<c;_++){const M=_*u-s;m.push(M,-v,0),g.push(0,0,1),f.push(_/o),f.push(1-x/l)}}for(let x=0;x<l;x++)for(let v=0;v<o;v++){const _=v+c*x,M=v+c*(x+1),C=v+1+c*(x+1),b=v+1+c*x;p.push(_,M,b),p.push(M,C,b)}this.setIndex(p),this.setAttribute("position",new me(m,3)),this.setAttribute("normal",new me(g,3)),this.setAttribute("uv",new me(f,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Oi(e.width,e.height,e.widthSegments,e.heightSegments)}}const Ee={alphahash_fragment:`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,alphahash_pars_fragment:`#ifdef USE_ALPHAHASH
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
#endif`,alphamap_fragment:`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,alphamap_pars_fragment:`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,alphatest_fragment:`#ifdef USE_ALPHATEST
	if ( diffuseColor.a < alphaTest ) discard;
#endif`,alphatest_pars_fragment:`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,aomap_fragment:`#ifdef USE_AOMAP
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
#endif`,aomap_pars_fragment:`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,batching_pars_vertex:`#ifdef USE_BATCHING
	attribute float batchId;
	uniform highp sampler2D batchingTexture;
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
#endif`,batching_vertex:`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( batchId );
#endif`,begin_vertex:`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,beginnormal_vertex:`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bsdfs:`float G_BlinnPhong_Implicit( ) {
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
} // validated`,iridescence_fragment:`#ifdef USE_IRIDESCENCE
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
#endif`,bumpmap_pars_fragment:`#ifdef USE_BUMPMAP
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
#endif`,clipping_planes_fragment:`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
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
#endif`,clipping_planes_pars_fragment:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,clipping_planes_pars_vertex:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,clipping_planes_vertex:`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,color_fragment:`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,color_pars_fragment:`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,color_pars_vertex:`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	varying vec3 vColor;
#endif`,color_vertex:`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif`,common:`#define PI 3.141592653589793
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
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
float luminance( const in vec3 rgb ) {
	const vec3 weights = vec3( 0.2126729, 0.7151522, 0.0721750 );
	return dot( weights, rgb );
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
} // validated`,cube_uv_reflection_fragment:`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,defaultnormal_vertex:`vec3 transformedNormal = objectNormal;
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
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,displacementmap_pars_vertex:`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,displacementmap_vertex:`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,emissivemap_fragment:`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,emissivemap_pars_fragment:`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,colorspace_fragment:"gl_FragColor = linearToOutputTexel( gl_FragColor );",colorspace_pars_fragment:`
const mat3 LINEAR_SRGB_TO_LINEAR_DISPLAY_P3 = mat3(
	vec3( 0.8224621, 0.177538, 0.0 ),
	vec3( 0.0331941, 0.9668058, 0.0 ),
	vec3( 0.0170827, 0.0723974, 0.9105199 )
);
const mat3 LINEAR_DISPLAY_P3_TO_LINEAR_SRGB = mat3(
	vec3( 1.2249401, - 0.2249404, 0.0 ),
	vec3( - 0.0420569, 1.0420571, 0.0 ),
	vec3( - 0.0196376, - 0.0786361, 1.0982735 )
);
vec4 LinearSRGBToLinearDisplayP3( in vec4 value ) {
	return vec4( value.rgb * LINEAR_SRGB_TO_LINEAR_DISPLAY_P3, value.a );
}
vec4 LinearDisplayP3ToLinearSRGB( in vec4 value ) {
	return vec4( value.rgb * LINEAR_DISPLAY_P3_TO_LINEAR_SRGB, value.a );
}
vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 LinearToLinear( in vec4 value ) {
	return value;
}
vec4 LinearTosRGB( in vec4 value ) {
	return sRGBTransferOETF( value );
}`,envmap_fragment:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,envmap_common_pars_fragment:`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,envmap_pars_fragment:`#ifdef USE_ENVMAP
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
#endif`,envmap_pars_vertex:`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,envmap_physical_pars_fragment:`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );
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
#endif`,envmap_vertex:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fog_vertex:`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,fog_pars_vertex:`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fog_fragment:`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fog_pars_fragment:`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gradientmap_pars_fragment:`#ifdef USE_GRADIENTMAP
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
}`,lightmap_fragment:`#ifdef USE_LIGHTMAP
	vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
	vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
	reflectedLight.indirectDiffuse += lightMapIrradiance;
#endif`,lightmap_pars_fragment:`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lights_lambert_fragment:`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,lights_lambert_pars_fragment:`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,lights_pars_begin:`uniform bool receiveShadow;
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
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	#if defined ( LEGACY_LIGHTS )
		if ( cutoffDistance > 0.0 && decayExponent > 0.0 ) {
			return pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent );
		}
		return 1.0;
	#else
		float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
		if ( cutoffDistance > 0.0 ) {
			distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
		}
		return distanceFalloff;
	#endif
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
#endif`,lights_toon_fragment:`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lights_toon_pars_fragment:`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,lights_phong_fragment:`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lights_phong_pars_fragment:`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,lights_physical_fragment:`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
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
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
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
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
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
#endif`,lights_physical_pars_fragment:`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
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
		float v = 0.5 / ( gv + gl );
		return saturate(v);
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
	vec3 f0 = material.specularColor;
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
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
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
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
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
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
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
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,lights_fragment_begin:`
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
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
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
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
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
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
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
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
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
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,lights_fragment_maps:`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
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
#endif`,lights_fragment_end:`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,logdepthbuf_fragment:`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,logdepthbuf_pars_fragment:`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_pars_vertex:`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		varying float vFragDepth;
		varying float vIsPerspective;
	#else
		uniform float logDepthBufFC;
	#endif
#endif`,logdepthbuf_vertex:`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		vFragDepth = 1.0 + gl_Position.w;
		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
	#else
		if ( isPerspectiveMatrix( projectionMatrix ) ) {
			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
			gl_Position.z *= gl_Position.w;
		}
	#endif
#endif`,map_fragment:`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
	
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,map_pars_fragment:`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,map_particle_fragment:`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,map_particle_pars_fragment:`#if defined( USE_POINTS_UV )
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
#endif`,metalnessmap_fragment:`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,metalnessmap_pars_fragment:`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,morphcolor_vertex:`#if defined( USE_MORPHCOLORS ) && defined( MORPHTARGETS_TEXTURE )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,morphnormal_vertex:`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
			if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
		}
	#else
		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];
		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];
		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];
		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];
	#endif
#endif`,morphtarget_pars_vertex:`#ifdef USE_MORPHTARGETS
	uniform float morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
		uniform sampler2DArray morphTargetsTexture;
		uniform ivec2 morphTargetsTextureSize;
		vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
			int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
			int y = texelIndex / morphTargetsTextureSize.x;
			int x = texelIndex - y * morphTargetsTextureSize.x;
			ivec3 morphUV = ivec3( x, y, morphTargetIndex );
			return texelFetch( morphTargetsTexture, morphUV, 0 );
		}
	#else
		#ifndef USE_MORPHNORMALS
			uniform float morphTargetInfluences[ 8 ];
		#else
			uniform float morphTargetInfluences[ 4 ];
		#endif
	#endif
#endif`,morphtarget_vertex:`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
			if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
		}
	#else
		transformed += morphTarget0 * morphTargetInfluences[ 0 ];
		transformed += morphTarget1 * morphTargetInfluences[ 1 ];
		transformed += morphTarget2 * morphTargetInfluences[ 2 ];
		transformed += morphTarget3 * morphTargetInfluences[ 3 ];
		#ifndef USE_MORPHNORMALS
			transformed += morphTarget4 * morphTargetInfluences[ 4 ];
			transformed += morphTarget5 * morphTargetInfluences[ 5 ];
			transformed += morphTarget6 * morphTargetInfluences[ 6 ];
			transformed += morphTarget7 * morphTargetInfluences[ 7 ];
		#endif
	#endif
#endif`,normal_fragment_begin:`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
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
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,normal_fragment_maps:`#ifdef USE_NORMALMAP_OBJECTSPACE
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
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,normal_pars_fragment:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_pars_vertex:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_vertex:`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,normalmap_pars_fragment:`#ifdef USE_NORMALMAP
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
#endif`,clearcoat_normal_fragment_begin:`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,clearcoat_normal_fragment_maps:`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,clearcoat_pars_fragment:`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,iridescence_pars_fragment:`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,opaque_fragment:`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,packing:`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;
const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256., 256. );
const vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );
const float ShiftRight8 = 1. / 256.;
vec4 packDepthToRGBA( const in float v ) {
	vec4 r = vec4( fract( v * PackFactors ), v );
	r.yzw -= r.xyz * ShiftRight8;	return r * PackUpscale;
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors );
}
vec2 packDepthToRG( in highp float v ) {
	return packDepthToRGBA( v ).yx;
}
float unpackRGToDepth( const in highp vec2 v ) {
	return unpackRGBAToDepth( vec4( v.xy, 0.0, 0.0 ) );
}
vec4 pack2HalfToRGBA( vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,premultiplied_alpha_fragment:`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,project_vertex:`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,dithering_fragment:`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dithering_pars_fragment:`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,roughnessmap_fragment:`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,roughnessmap_pars_fragment:`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,shadowmap_pars_fragment:`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return shadow;
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
		vec3 lightToPosition = shadowCoord.xyz;
		float dp = ( length( lightToPosition ) - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );		dp += shadowBias;
		vec3 bd3D = normalize( lightToPosition );
		#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
			vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
			return (
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
			) * ( 1.0 / 9.0 );
		#else
			return texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
		#endif
	}
#endif`,shadowmap_pars_vertex:`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
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
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,shadowmap_vertex:`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
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
#endif`,shadowmask_pars_fragment:`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,skinbase_vertex:`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,skinning_pars_vertex:`#ifdef USE_SKINNING
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
#endif`,skinning_vertex:`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,skinnormal_vertex:`#ifdef USE_SKINNING
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
#endif`,specularmap_fragment:`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,specularmap_pars_fragment:`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,tonemapping_fragment:`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tonemapping_pars_fragment:`#ifndef saturate
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
vec3 OptimizedCineonToneMapping( vec3 color ) {
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
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color *= toneMappingExposure;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	return color;
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,transmission_fragment:`#ifdef USE_TRANSMISSION
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
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,transmission_pars_fragment:`#ifdef USE_TRANSMISSION
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
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
		vec3 refractedRayExit = position + transmissionRay;
		vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
		vec2 refractionCoords = ndcPos.xy / ndcPos.w;
		refractionCoords += 1.0;
		refractionCoords /= 2.0;
		vec4 transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
		vec3 transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,uv_pars_fragment:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,uv_pars_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,uv_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,worldpos_vertex:`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,background_vert:`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,background_frag:`uniform sampler2D t2D;
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
}`,backgroundCube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,backgroundCube_frag:`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cube_frag:`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,depth_vert:`#include <common>
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
}`,depth_frag:`#if DEPTH_PACKING == 3200
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
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#endif
}`,distanceRGBA_vert:`#define DISTANCE
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
}`,distanceRGBA_frag:`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,equirect_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,equirect_frag:`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,linedashed_vert:`uniform float scale;
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
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,linedashed_frag:`uniform vec3 diffuse;
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
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,meshbasic_vert:`#include <common>
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
}`,meshbasic_frag:`uniform vec3 diffuse;
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
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
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
}`,meshlambert_vert:`#define LAMBERT
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
}`,meshlambert_frag:`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
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
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
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
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
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
}`,meshmatcap_vert:`#define MATCAP
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
}`,meshmatcap_frag:`#define MATCAP
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
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
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
}`,meshnormal_vert:`#define NORMAL
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
}`,meshnormal_frag:`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), opacity );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,meshphong_vert:`#define PHONG
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
}`,meshphong_frag:`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
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
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
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
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
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
}`,meshphysical_vert:`#define STANDARD
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
}`,meshphysical_frag:`#define STANDARD
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
#include <packing>
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
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
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
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
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
}`,meshtoon_vert:`#define TOON
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
}`,meshtoon_frag:`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
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
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
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
}`,points_vert:`uniform float size;
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
}`,points_frag:`uniform vec3 diffuse;
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
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
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
}`,shadow_vert:`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
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
}`,shadow_frag:`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
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
}`,sprite_vert:`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec2 scale;
	scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
	scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );
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
}`,sprite_frag:`uniform vec3 diffuse;
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
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
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
}`},le={common:{diffuse:{value:new de(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new we},alphaMap:{value:null},alphaMapTransform:{value:new we},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new we}},envmap:{envMap:{value:null},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new we}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new we}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new we},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new we},normalScale:{value:new ie(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new we},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new we}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new we}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new we}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new de(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new de(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new we},alphaTest:{value:0},uvTransform:{value:new we}},sprite:{diffuse:{value:new de(16777215)},opacity:{value:1},center:{value:new ie(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new we},alphaMap:{value:null},alphaMapTransform:{value:new we},alphaTest:{value:0}}},Nt={basic:{uniforms:ft([le.common,le.specularmap,le.envmap,le.aomap,le.lightmap,le.fog]),vertexShader:Ee.meshbasic_vert,fragmentShader:Ee.meshbasic_frag},lambert:{uniforms:ft([le.common,le.specularmap,le.envmap,le.aomap,le.lightmap,le.emissivemap,le.bumpmap,le.normalmap,le.displacementmap,le.fog,le.lights,{emissive:{value:new de(0)}}]),vertexShader:Ee.meshlambert_vert,fragmentShader:Ee.meshlambert_frag},phong:{uniforms:ft([le.common,le.specularmap,le.envmap,le.aomap,le.lightmap,le.emissivemap,le.bumpmap,le.normalmap,le.displacementmap,le.fog,le.lights,{emissive:{value:new de(0)},specular:{value:new de(1118481)},shininess:{value:30}}]),vertexShader:Ee.meshphong_vert,fragmentShader:Ee.meshphong_frag},standard:{uniforms:ft([le.common,le.envmap,le.aomap,le.lightmap,le.emissivemap,le.bumpmap,le.normalmap,le.displacementmap,le.roughnessmap,le.metalnessmap,le.fog,le.lights,{emissive:{value:new de(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ee.meshphysical_vert,fragmentShader:Ee.meshphysical_frag},toon:{uniforms:ft([le.common,le.aomap,le.lightmap,le.emissivemap,le.bumpmap,le.normalmap,le.displacementmap,le.gradientmap,le.fog,le.lights,{emissive:{value:new de(0)}}]),vertexShader:Ee.meshtoon_vert,fragmentShader:Ee.meshtoon_frag},matcap:{uniforms:ft([le.common,le.bumpmap,le.normalmap,le.displacementmap,le.fog,{matcap:{value:null}}]),vertexShader:Ee.meshmatcap_vert,fragmentShader:Ee.meshmatcap_frag},points:{uniforms:ft([le.points,le.fog]),vertexShader:Ee.points_vert,fragmentShader:Ee.points_frag},dashed:{uniforms:ft([le.common,le.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ee.linedashed_vert,fragmentShader:Ee.linedashed_frag},depth:{uniforms:ft([le.common,le.displacementmap]),vertexShader:Ee.depth_vert,fragmentShader:Ee.depth_frag},normal:{uniforms:ft([le.common,le.bumpmap,le.normalmap,le.displacementmap,{opacity:{value:1}}]),vertexShader:Ee.meshnormal_vert,fragmentShader:Ee.meshnormal_frag},sprite:{uniforms:ft([le.sprite,le.fog]),vertexShader:Ee.sprite_vert,fragmentShader:Ee.sprite_frag},background:{uniforms:{uvTransform:{value:new we},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ee.background_vert,fragmentShader:Ee.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1}},vertexShader:Ee.backgroundCube_vert,fragmentShader:Ee.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ee.cube_vert,fragmentShader:Ee.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ee.equirect_vert,fragmentShader:Ee.equirect_frag},distanceRGBA:{uniforms:ft([le.common,le.displacementmap,{referencePosition:{value:new w},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ee.distanceRGBA_vert,fragmentShader:Ee.distanceRGBA_frag},shadow:{uniforms:ft([le.lights,le.fog,{color:{value:new de(0)},opacity:{value:1}}]),vertexShader:Ee.shadow_vert,fragmentShader:Ee.shadow_frag}};Nt.physical={uniforms:ft([Nt.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new we},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new we},clearcoatNormalScale:{value:new ie(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new we},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new we},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new we},sheen:{value:0},sheenColor:{value:new de(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new we},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new we},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new we},transmissionSamplerSize:{value:new ie},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new we},attenuationDistance:{value:0},attenuationColor:{value:new de(0)},specularColor:{value:new de(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new we},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new we},anisotropyVector:{value:new ie},anisotropyMap:{value:null},anisotropyMapTransform:{value:new we}}]),vertexShader:Ee.meshphysical_vert,fragmentShader:Ee.meshphysical_frag};const Ur={r:0,b:0,g:0};function Oh(r,e,t,n,i,s,a){const o=new de(0);let l,c,h=s===!0?0:1,u=null,d=0,p=null;function m(g,f){g.getRGB(Ur,Io(r)),n.buffers.color.setClear(Ur.r,Ur.g,Ur.b,f,a)}return{getClearColor:function(){return o},setClearColor:function(g,f=1){o.set(g),h=f,m(o,h)},getClearAlpha:function(){return h},setClearAlpha:function(g){h=g,m(o,h)},render:function(g,f){let x=!1,v=f.isScene===!0?f.background:null;v&&v.isTexture&&(v=(f.backgroundBlurriness>0?t:e).get(v)),v===null?m(o,h):v&&v.isColor&&(m(v,1),x=!0);const _=r.xr.getEnvironmentBlendMode();_==="additive"?n.buffers.color.setClear(0,0,0,1,a):_==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(r.autoClear||x)&&r.clear(r.autoClearColor,r.autoClearDepth,r.autoClearStencil),v&&(v.isCubeTexture||v.mapping===306)?(c===void 0&&(c=new Qe(new Sn(1,1,1),new Vt({name:"BackgroundCubeMaterial",uniforms:ri(Nt.backgroundCube.uniforms),vertexShader:Nt.backgroundCube.vertexShader,fragmentShader:Nt.backgroundCube.fragmentShader,side:1,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(M,C,b){this.matrixWorld.copyPosition(b.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),c.material.uniforms.envMap.value=v,c.material.uniforms.flipEnvMap.value=v.isCubeTexture&&v.isRenderTargetTexture===!1?-1:1,c.material.uniforms.backgroundBlurriness.value=f.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=f.backgroundIntensity,c.material.toneMapped=Ge.getTransfer(v.colorSpace)!==ke,u===v&&d===v.version&&p===r.toneMapping||(c.material.needsUpdate=!0,u=v,d=v.version,p=r.toneMapping),c.layers.enableAll(),g.unshift(c,c.geometry,c.material,0,0,null)):v&&v.isTexture&&(l===void 0&&(l=new Qe(new Oi(2,2),new Vt({name:"BackgroundMaterial",uniforms:ri(Nt.background.uniforms),vertexShader:Nt.background.vertexShader,fragmentShader:Nt.background.fragmentShader,side:0,depthTest:!1,depthWrite:!1,fog:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=v,l.material.uniforms.backgroundIntensity.value=f.backgroundIntensity,l.material.toneMapped=Ge.getTransfer(v.colorSpace)!==ke,v.matrixAutoUpdate===!0&&v.updateMatrix(),l.material.uniforms.uvTransform.value.copy(v.matrix),u===v&&d===v.version&&p===r.toneMapping||(l.material.needsUpdate=!0,u=v,d=v.version,p=r.toneMapping),l.layers.enableAll(),g.unshift(l,l.geometry,l.material,0,0,null))}}}function Fh(r,e,t,n){const i=r.getParameter(r.MAX_VERTEX_ATTRIBS),s=n.isWebGL2?null:e.get("OES_vertex_array_object"),a=n.isWebGL2||s!==null,o={},l=p(null);let c=l,h=!1;function u(C){return n.isWebGL2?r.bindVertexArray(C):s.bindVertexArrayOES(C)}function d(C){return n.isWebGL2?r.deleteVertexArray(C):s.deleteVertexArrayOES(C)}function p(C){const b=[],A=[],N=[];for(let I=0;I<i;I++)b[I]=0,A[I]=0,N[I]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:b,enabledAttributes:A,attributeDivisors:N,object:C,attributes:{},index:null}}function m(){const C=c.newAttributes;for(let b=0,A=C.length;b<A;b++)C[b]=0}function g(C){f(C,0)}function f(C,b){const A=c.newAttributes,N=c.enabledAttributes,I=c.attributeDivisors;A[C]=1,N[C]===0&&(r.enableVertexAttribArray(C),N[C]=1),I[C]!==b&&((n.isWebGL2?r:e.get("ANGLE_instanced_arrays"))[n.isWebGL2?"vertexAttribDivisor":"vertexAttribDivisorANGLE"](C,b),I[C]=b)}function x(){const C=c.newAttributes,b=c.enabledAttributes;for(let A=0,N=b.length;A<N;A++)b[A]!==C[A]&&(r.disableVertexAttribArray(A),b[A]=0)}function v(C,b,A,N,I,F,Y){Y===!0?r.vertexAttribIPointer(C,b,A,I,F):r.vertexAttribPointer(C,b,A,N,I,F)}function _(){M(),h=!0,c!==l&&(c=l,u(c.object))}function M(){l.geometry=null,l.program=null,l.wireframe=!1}return{setup:function(C,b,A,N,I){let F=!1;if(a){const Y=(function(L,W,X){const oe=X.wireframe===!0;let pe=o[L.id];pe===void 0&&(pe={},o[L.id]=pe);let ne=pe[W.id];ne===void 0&&(ne={},pe[W.id]=ne);let ee=ne[oe];return ee===void 0&&(ee=p(n.isWebGL2?r.createVertexArray():s.createVertexArrayOES()),ne[oe]=ee),ee})(N,A,b);c!==Y&&(c=Y,u(c.object)),F=(function(L,W,X,oe){const pe=c.attributes,ne=W.attributes;let ee=0;const K=X.getAttributes();for(const H in K)if(K[H].location>=0){const k=pe[H];let ce=ne[H];if(ce===void 0&&(H==="instanceMatrix"&&L.instanceMatrix&&(ce=L.instanceMatrix),H==="instanceColor"&&L.instanceColor&&(ce=L.instanceColor)),k===void 0||k.attribute!==ce||ce&&k.data!==ce.data)return!0;ee++}return c.attributesNum!==ee||c.index!==oe})(C,N,A,I),F&&(function(L,W,X,oe){const pe={},ne=W.attributes;let ee=0;const K=X.getAttributes();for(const H in K)if(K[H].location>=0){let k=ne[H];k===void 0&&(H==="instanceMatrix"&&L.instanceMatrix&&(k=L.instanceMatrix),H==="instanceColor"&&L.instanceColor&&(k=L.instanceColor));const ce={};ce.attribute=k,k&&k.data&&(ce.data=k.data),pe[H]=ce,ee++}c.attributes=pe,c.attributesNum=ee,c.index=oe})(C,N,A,I)}else{const Y=b.wireframe===!0;c.geometry===N.id&&c.program===A.id&&c.wireframe===Y||(c.geometry=N.id,c.program=A.id,c.wireframe=Y,F=!0)}I!==null&&t.update(I,r.ELEMENT_ARRAY_BUFFER),(F||h)&&(h=!1,(function(Y,L,W,X){if(n.isWebGL2===!1&&(Y.isInstancedMesh||X.isInstancedBufferGeometry)&&e.get("ANGLE_instanced_arrays")===null)return;m();const oe=X.attributes,pe=W.getAttributes(),ne=L.defaultAttributeValues;for(const ee in pe){const K=pe[ee];if(K.location>=0){let H=oe[ee];if(H===void 0&&(ee==="instanceMatrix"&&Y.instanceMatrix&&(H=Y.instanceMatrix),ee==="instanceColor"&&Y.instanceColor&&(H=Y.instanceColor)),H!==void 0){const k=H.normalized,ce=H.itemSize,E=t.get(H);if(E===void 0)continue;const T=E.buffer,O=E.type,Z=E.bytesPerElement,P=n.isWebGL2===!0&&(O===r.INT||O===r.UNSIGNED_INT||H.gpuType===1013);if(H.isInterleavedBufferAttribute){const q=H.data,U=q.stride,D=H.offset;if(q.isInstancedInterleavedBuffer){for(let B=0;B<K.locationSize;B++)f(K.location+B,q.meshPerAttribute);Y.isInstancedMesh!==!0&&X._maxInstanceCount===void 0&&(X._maxInstanceCount=q.meshPerAttribute*q.count)}else for(let B=0;B<K.locationSize;B++)g(K.location+B);r.bindBuffer(r.ARRAY_BUFFER,T);for(let B=0;B<K.locationSize;B++)v(K.location+B,ce/K.locationSize,O,k,U*Z,(D+ce/K.locationSize*B)*Z,P)}else{if(H.isInstancedBufferAttribute){for(let q=0;q<K.locationSize;q++)f(K.location+q,H.meshPerAttribute);Y.isInstancedMesh!==!0&&X._maxInstanceCount===void 0&&(X._maxInstanceCount=H.meshPerAttribute*H.count)}else for(let q=0;q<K.locationSize;q++)g(K.location+q);r.bindBuffer(r.ARRAY_BUFFER,T);for(let q=0;q<K.locationSize;q++)v(K.location+q,ce/K.locationSize,O,k,ce*Z,ce/K.locationSize*q*Z,P)}}else if(ne!==void 0){const k=ne[ee];if(k!==void 0)switch(k.length){case 2:r.vertexAttrib2fv(K.location,k);break;case 3:r.vertexAttrib3fv(K.location,k);break;case 4:r.vertexAttrib4fv(K.location,k);break;default:r.vertexAttrib1fv(K.location,k)}}}}x()})(C,b,A,N),I!==null&&r.bindBuffer(r.ELEMENT_ARRAY_BUFFER,t.get(I).buffer))},reset:_,resetDefaultState:M,dispose:function(){_();for(const C in o){const b=o[C];for(const A in b){const N=b[A];for(const I in N)d(N[I].object),delete N[I];delete b[A]}delete o[C]}},releaseStatesOfGeometry:function(C){if(o[C.id]===void 0)return;const b=o[C.id];for(const A in b){const N=b[A];for(const I in N)d(N[I].object),delete N[I];delete b[A]}delete o[C.id]},releaseStatesOfProgram:function(C){for(const b in o){const A=o[b];if(A[C.id]===void 0)continue;const N=A[C.id];for(const I in N)d(N[I].object),delete N[I];delete A[C.id]}},initAttributes:m,enableAttribute:g,disableUnusedAttributes:x}}function Bh(r,e,t,n){const i=n.isWebGL2;let s;this.setMode=function(a){s=a},this.render=function(a,o){r.drawArrays(s,a,o),t.update(o,s,1)},this.renderInstances=function(a,o,l){if(l===0)return;let c,h;if(i)c=r,h="drawArraysInstanced";else if(c=e.get("ANGLE_instanced_arrays"),h="drawArraysInstancedANGLE",c===null)return void console.error("THREE.WebGLBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");c[h](s,a,o,l),t.update(o,s,l)},this.renderMultiDraw=function(a,o,l){if(l===0)return;const c=e.get("WEBGL_multi_draw");if(c===null)for(let h=0;h<l;h++)this.render(a[h],o[h]);else{c.multiDrawArraysWEBGL(s,a,0,o,0,l);let h=0;for(let u=0;u<l;u++)h+=o[u];t.update(h,s,1)}}}function zh(r,e,t){let n;function i(M){if(M==="highp"){if(r.getShaderPrecisionFormat(r.VERTEX_SHADER,r.HIGH_FLOAT).precision>0&&r.getShaderPrecisionFormat(r.FRAGMENT_SHADER,r.HIGH_FLOAT).precision>0)return"highp";M="mediump"}return M==="mediump"&&r.getShaderPrecisionFormat(r.VERTEX_SHADER,r.MEDIUM_FLOAT).precision>0&&r.getShaderPrecisionFormat(r.FRAGMENT_SHADER,r.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}const s=typeof WebGL2RenderingContext<"u"&&r.constructor.name==="WebGL2RenderingContext";let a=t.precision!==void 0?t.precision:"highp";const o=i(a);o!==a&&(console.warn("THREE.WebGLRenderer:",a,"not supported, using",o,"instead."),a=o);const l=s||e.has("WEBGL_draw_buffers"),c=t.logarithmicDepthBuffer===!0,h=r.getParameter(r.MAX_TEXTURE_IMAGE_UNITS),u=r.getParameter(r.MAX_VERTEX_TEXTURE_IMAGE_UNITS),d=r.getParameter(r.MAX_TEXTURE_SIZE),p=r.getParameter(r.MAX_CUBE_MAP_TEXTURE_SIZE),m=r.getParameter(r.MAX_VERTEX_ATTRIBS),g=r.getParameter(r.MAX_VERTEX_UNIFORM_VECTORS),f=r.getParameter(r.MAX_VARYING_VECTORS),x=r.getParameter(r.MAX_FRAGMENT_UNIFORM_VECTORS),v=u>0,_=s||e.has("OES_texture_float");return{isWebGL2:s,drawBuffers:l,getMaxAnisotropy:function(){if(n!==void 0)return n;if(e.has("EXT_texture_filter_anisotropic")===!0){const M=e.get("EXT_texture_filter_anisotropic");n=r.getParameter(M.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else n=0;return n},getMaxPrecision:i,precision:a,logarithmicDepthBuffer:c,maxTextures:h,maxVertexTextures:u,maxTextureSize:d,maxCubemapSize:p,maxAttributes:m,maxVertexUniforms:g,maxVaryings:f,maxFragmentUniforms:x,vertexTextures:v,floatFragmentTextures:_,floatVertexTextures:v&&_,maxSamples:s?r.getParameter(r.MAX_SAMPLES):0}}function Gh(r){const e=this;let t=null,n=0,i=!1,s=!1;const a=new un,o=new we,l={value:null,needsUpdate:!1};function c(h,u,d,p){const m=h!==null?h.length:0;let g=null;if(m!==0){if(g=l.value,p!==!0||g===null){const f=d+4*m,x=u.matrixWorldInverse;o.getNormalMatrix(x),(g===null||g.length<f)&&(g=new Float32Array(f));for(let v=0,_=d;v!==m;++v,_+=4)a.copy(h[v]).applyMatrix4(x,o),a.normal.toArray(g,_),g[_+3]=a.constant}l.value=g,l.needsUpdate=!0}return e.numPlanes=m,e.numIntersection=0,g}this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,u){const d=h.length!==0||u||n!==0||i;return i=u,n=h.length,d},this.beginShadows=function(){s=!0,c(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(h,u){t=c(h,u,0)},this.setState=function(h,u,d){const p=h.clippingPlanes,m=h.clipIntersection,g=h.clipShadows,f=r.get(h);if(!i||p===null||p.length===0||s&&!g)s?c(null):(function(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0})();else{const x=s?0:n,v=4*x;let _=f.clippingState||null;l.value=_,_=c(p,u,v,d);for(let M=0;M!==v;++M)_[M]=t[M];f.clippingState=_,this.numIntersection=m?this.numPlanes:0,this.numPlanes+=x}}}function Hh(r){let e=new WeakMap;function t(i,s){return s===303?i.mapping=301:s===304&&(i.mapping=302),i}function n(i){const s=i.target;s.removeEventListener("dispose",n);const a=e.get(s);a!==void 0&&(e.delete(s),a.dispose())}return{get:function(i){if(i&&i.isTexture){const s=i.mapping;if(s===303||s===304){if(e.has(i))return t(e.get(i).texture,i.mapping);{const a=i.image;if(a&&a.height>0){const o=new No(a.height/2);return o.fromEquirectangularTexture(r,i),e.set(i,o),i.addEventListener("dispose",n),t(o.texture,i.mapping)}return null}}}return i},dispose:function(){e=new WeakMap}}}class Dr extends Pr{constructor(e=-1,t=1,n=1,i=-1,s=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=i,this.near=s,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,i,s,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2;let s=n-e,a=n+e,o=i+t,l=i-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,a=s+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(s,a,o,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}const Fo=[.125,.215,.35,.446,.526,.582],Fi=20,aa=new Dr,Bo=new de;let oa=null,la=0,ca=0;const Tn=(1+Math.sqrt(5))/2,ai=1/Tn,zo=[new w(1,1,1),new w(-1,1,1),new w(1,1,-1),new w(-1,1,-1),new w(0,Tn,ai),new w(0,Tn,-ai),new w(ai,0,Tn),new w(-ai,0,Tn),new w(Tn,ai,0),new w(-Tn,ai,0)];class ha{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,n=.1,i=100){oa=this._renderer.getRenderTarget(),la=this._renderer.getActiveCubeFace(),ca=this._renderer.getActiveMipmapLevel(),this._setSize(256);const s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(e,n,i,s),t>0&&this._blur(s,0,0,t),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Vo(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Ho(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(oa,la,ca),e.scissorTest=!1,Nr(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===301||e.mapping===302?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),oa=this._renderer.getRenderTarget(),la=this._renderer.getActiveCubeFace(),ca=this._renderer.getActiveMipmapLevel();const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:1006,minFilter:1006,generateMipmaps:!1,type:1016,format:1023,colorSpace:Ht,depthBuffer:!1},i=Go(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Go(e,t,n);const{_lodMax:s}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=(function(a){const o=[],l=[],c=[];let h=a;const u=a-4+1+Fo.length;for(let d=0;d<u;d++){const p=Math.pow(2,h);l.push(p);let m=1/p;d>a-4?m=Fo[d-a+4-1]:d===0&&(m=0),c.push(m);const g=1/(p-2),f=-g,x=1+g,v=[f,f,x,f,x,x,f,f,x,x,f,x],_=6,M=6,C=3,b=2,A=1,N=new Float32Array(C*M*_),I=new Float32Array(b*M*_),F=new Float32Array(A*M*_);for(let L=0;L<_;L++){const W=L%3*2/3-1,X=L>2?0:-1,oe=[W,X,0,W+2/3,X,0,W+2/3,X+1,0,W,X,0,W+2/3,X+1,0,W,X+1,0];N.set(oe,C*M*L),I.set(v,b*M*L);const pe=[L,L,L,L,L,L];F.set(pe,A*M*L)}const Y=new Ae;Y.setAttribute("position",new Ve(N,C)),Y.setAttribute("uv",new Ve(I,b)),Y.setAttribute("faceIndex",new Ve(F,A)),o.push(Y),h>4&&h--}return{lodPlanes:o,sizeLods:l,sigmas:c}})(s)),this._blurMaterial=(function(a,o,l){const c=new Float32Array(Fi),h=new w(0,1,0);return new Vt({name:"SphericalGaussianBlur",defines:{n:Fi,CUBEUV_TEXEL_WIDTH:1/o,CUBEUV_TEXEL_HEIGHT:1/l,CUBEUV_MAX_MIP:`${a}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:c},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:h}},vertexShader:ua(),fragmentShader:`

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
		`,blending:0,depthTest:!1,depthWrite:!1})})(s,e,t)}return i}_compileMaterial(e){const t=new Qe(this._lodPlanes[0],e);this._renderer.compile(t,aa)}_sceneToCubeUV(e,t,n,i){const s=new st(90,1,t,n),a=[1,-1,1,1,1,1],o=[1,1,1,-1,-1,-1],l=this._renderer,c=l.autoClear,h=l.toneMapping;l.getClearColor(Bo),l.toneMapping=0,l.autoClear=!1;const u=new hn({name:"PMREM.Background",side:1,depthWrite:!1,depthTest:!1}),d=new Qe(new Sn,u);let p=!1;const m=e.background;m?m.isColor&&(u.color.copy(m),e.background=null,p=!0):(u.color.copy(Bo),p=!0);for(let g=0;g<6;g++){const f=g%3;f===0?(s.up.set(0,a[g],0),s.lookAt(o[g],0,0)):f===1?(s.up.set(0,0,a[g]),s.lookAt(0,o[g],0)):(s.up.set(0,a[g],0),s.lookAt(0,0,o[g]));const x=this._cubeSize;Nr(i,f*x,g>2?x:0,x,x),l.setRenderTarget(i),p&&l.render(d,s),l.render(e,s)}d.geometry.dispose(),d.material.dispose(),l.toneMapping=h,l.autoClear=c,e.background=m}_textureToCubeUV(e,t){const n=this._renderer,i=e.mapping===301||e.mapping===302;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=Vo()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Ho());const s=i?this._cubemapMaterial:this._equirectMaterial,a=new Qe(this._lodPlanes[0],s);s.uniforms.envMap.value=e;const o=this._cubeSize;Nr(t,0,0,3*o,2*o),n.setRenderTarget(t),n.render(a,aa)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;for(let i=1;i<this._lodPlanes.length;i++){const s=Math.sqrt(this._sigmas[i]*this._sigmas[i]-this._sigmas[i-1]*this._sigmas[i-1]),a=zo[(i-1)%zo.length];this._blur(e,i-1,i,s,a)}t.autoClear=n}_blur(e,t,n,i,s){const a=this._pingPongRenderTarget;this._halfBlur(e,a,t,n,i,"latitudinal",s),this._halfBlur(a,e,n,n,i,"longitudinal",s)}_halfBlur(e,t,n,i,s,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=new Qe(this._lodPlanes[i],c),u=c.uniforms,d=this._sizeLods[n]-1,p=isFinite(s)?Math.PI/(2*d):2*Math.PI/39,m=s/p,g=isFinite(s)?1+Math.floor(3*m):Fi;g>Fi&&console.warn(`sigmaRadians, ${s}, is too large and will clip, as it requested ${g} samples when the maximum is set to 20`);const f=[];let x=0;for(let M=0;M<Fi;++M){const C=M/m,b=Math.exp(-C*C/2);f.push(b),M===0?x+=b:M<g&&(x+=2*b)}for(let M=0;M<f.length;M++)f[M]=f[M]/x;u.envMap.value=e.texture,u.samples.value=g,u.weights.value=f,u.latitudinal.value=a==="latitudinal",o&&(u.poleAxis.value=o);const{_lodMax:v}=this;u.dTheta.value=p,u.mipInt.value=v-n;const _=this._sizeLods[i];Nr(t,3*_*(i>v-4?i-v+4:0),4*(this._cubeSize-_),3*_,2*_),l.setRenderTarget(t),l.render(h,aa)}}function Go(r,e,t){const n=new Pt(r,e,t);return n.texture.mapping=306,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Nr(r,e,t,n,i){r.viewport.set(e,t,n,i),r.scissor.set(e,t,n,i)}function Ho(){return new Vt({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:ua(),fragmentShader:`

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
		`,blending:0,depthTest:!1,depthWrite:!1})}function Vo(){return new Vt({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:ua(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function ua(){return`

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
	`}function Vh(r){let e=new WeakMap,t=null;function n(i){const s=i.target;s.removeEventListener("dispose",n);const a=e.get(s);a!==void 0&&(e.delete(s),a.dispose())}return{get:function(i){if(i&&i.isTexture){const s=i.mapping,a=s===303||s===304,o=s===301||s===302;if(a||o){if(i.isRenderTargetTexture&&i.needsPMREMUpdate===!0){i.needsPMREMUpdate=!1;let l=e.get(i);return t===null&&(t=new ha(r)),l=a?t.fromEquirectangular(i,l):t.fromCubemap(i,l),e.set(i,l),l.texture}if(e.has(i))return e.get(i).texture;{const l=i.image;if(a&&l&&l.height>0||o&&l&&(function(c){let h=0;const u=6;for(let d=0;d<u;d++)c[d]!==void 0&&h++;return h===u})(l)){t===null&&(t=new ha(r));const c=a?t.fromEquirectangular(i):t.fromCubemap(i);return e.set(i,c),i.addEventListener("dispose",n),c.texture}return null}}}return i},dispose:function(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}}}function kh(r){const e={};function t(n){if(e[n]!==void 0)return e[n];let i;switch(n){case"WEBGL_depth_texture":i=r.getExtension("WEBGL_depth_texture")||r.getExtension("MOZ_WEBGL_depth_texture")||r.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":i=r.getExtension("EXT_texture_filter_anisotropic")||r.getExtension("MOZ_EXT_texture_filter_anisotropic")||r.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":i=r.getExtension("WEBGL_compressed_texture_s3tc")||r.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||r.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":i=r.getExtension("WEBGL_compressed_texture_pvrtc")||r.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:i=r.getExtension(n)}return e[n]=i,i}return{has:function(n){return t(n)!==null},init:function(n){n.isWebGL2?(t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance")):(t("WEBGL_depth_texture"),t("OES_texture_float"),t("OES_texture_half_float"),t("OES_texture_half_float_linear"),t("OES_standard_derivatives"),t("OES_element_index_uint"),t("OES_vertex_array_object"),t("ANGLE_instanced_arrays")),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture")},get:function(n){const i=t(n);return i===null&&console.warn("THREE.WebGLRenderer: "+n+" extension not supported."),i}}}function Wh(r,e,t,n){const i={},s=new WeakMap;function a(l){const c=l.target;c.index!==null&&e.remove(c.index);for(const u in c.attributes)e.remove(c.attributes[u]);for(const u in c.morphAttributes){const d=c.morphAttributes[u];for(let p=0,m=d.length;p<m;p++)e.remove(d[p])}c.removeEventListener("dispose",a),delete i[c.id];const h=s.get(c);h&&(e.remove(h),s.delete(c)),n.releaseStatesOfGeometry(c),c.isInstancedBufferGeometry===!0&&delete c._maxInstanceCount,t.memory.geometries--}function o(l){const c=[],h=l.index,u=l.attributes.position;let d=0;if(h!==null){const g=h.array;d=h.version;for(let f=0,x=g.length;f<x;f+=3){const v=g[f+0],_=g[f+1],M=g[f+2];c.push(v,_,_,M,M,v)}}else{if(u===void 0)return;{const g=u.array;d=u.version;for(let f=0,x=g.length/3-1;f<x;f+=3){const v=f+0,_=f+1,M=f+2;c.push(v,_,_,M,M,v)}}}const p=new(uo(c)?na:ta)(c,1);p.version=d;const m=s.get(l);m&&e.remove(m),s.set(l,p)}return{get:function(l,c){return i[c.id]===!0||(c.addEventListener("dispose",a),i[c.id]=!0,t.memory.geometries++),c},update:function(l){const c=l.attributes;for(const u in c)e.update(c[u],r.ARRAY_BUFFER);const h=l.morphAttributes;for(const u in h){const d=h[u];for(let p=0,m=d.length;p<m;p++)e.update(d[p],r.ARRAY_BUFFER)}},getWireframeAttribute:function(l){const c=s.get(l);if(c){const h=l.index;h!==null&&c.version<h.version&&o(l)}else o(l);return s.get(l)}}}function Xh(r,e,t,n){const i=n.isWebGL2;let s,a,o;this.setMode=function(l){s=l},this.setIndex=function(l){a=l.type,o=l.bytesPerElement},this.render=function(l,c){r.drawElements(s,c,a,l*o),t.update(c,s,1)},this.renderInstances=function(l,c,h){if(h===0)return;let u,d;if(i)u=r,d="drawElementsInstanced";else if(u=e.get("ANGLE_instanced_arrays"),d="drawElementsInstancedANGLE",u===null)return void console.error("THREE.WebGLIndexedBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");u[d](s,c,a,l*o,h),t.update(c,s,h)},this.renderMultiDraw=function(l,c,h){if(h===0)return;const u=e.get("WEBGL_multi_draw");if(u===null)for(let d=0;d<h;d++)this.render(l[d]/o,c[d]);else{u.multiDrawElementsWEBGL(s,c,0,a,l,0,h);let d=0;for(let p=0;p<h;p++)d+=c[p];t.update(d,s,1)}}}function jh(r){const e={frame:0,calls:0,triangles:0,points:0,lines:0};return{memory:{geometries:0,textures:0},render:e,programs:null,autoReset:!0,reset:function(){e.calls=0,e.triangles=0,e.points=0,e.lines=0},update:function(t,n,i){switch(e.calls++,n){case r.TRIANGLES:e.triangles+=i*(t/3);break;case r.LINES:e.lines+=i*(t/2);break;case r.LINE_STRIP:e.lines+=i*(t-1);break;case r.LINE_LOOP:e.lines+=i*t;break;case r.POINTS:e.points+=i*t;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",n)}}}}function qh(r,e){return r[0]-e[0]}function Yh(r,e){return Math.abs(e[1])-Math.abs(r[1])}function Zh(r,e,t){const n={},i=new Float32Array(8),s=new WeakMap,a=new He,o=[];for(let l=0;l<8;l++)o[l]=[l,0];return{update:function(l,c,h){const u=l.morphTargetInfluences;if(e.isWebGL2===!0){const p=c.morphAttributes.position||c.morphAttributes.normal||c.morphAttributes.color,m=p!==void 0?p.length:0;let g=s.get(c);if(g===void 0||g.count!==m){let X=function(){L.dispose(),s.delete(c),c.removeEventListener("dispose",X)};var d=X;g!==void 0&&g.texture.dispose();const v=c.morphAttributes.position!==void 0,_=c.morphAttributes.normal!==void 0,M=c.morphAttributes.color!==void 0,C=c.morphAttributes.position||[],b=c.morphAttributes.normal||[],A=c.morphAttributes.color||[];let N=0;v===!0&&(N=1),_===!0&&(N=2),M===!0&&(N=3);let I=c.attributes.position.count*N,F=1;I>e.maxTextureSize&&(F=Math.ceil(I/e.maxTextureSize),I=e.maxTextureSize);const Y=new Float32Array(I*F*4*m),L=new ur(Y,I,F,m);L.type=1015,L.needsUpdate=!0;const W=4*N;for(let oe=0;oe<m;oe++){const pe=C[oe],ne=b[oe],ee=A[oe],K=I*F*4*oe;for(let H=0;H<pe.count;H++){const k=H*W;v===!0&&(a.fromBufferAttribute(pe,H),Y[K+k+0]=a.x,Y[K+k+1]=a.y,Y[K+k+2]=a.z,Y[K+k+3]=0),_===!0&&(a.fromBufferAttribute(ne,H),Y[K+k+4]=a.x,Y[K+k+5]=a.y,Y[K+k+6]=a.z,Y[K+k+7]=0),M===!0&&(a.fromBufferAttribute(ee,H),Y[K+k+8]=a.x,Y[K+k+9]=a.y,Y[K+k+10]=a.z,Y[K+k+11]=ee.itemSize===4?a.w:1)}}g={count:m,texture:L,size:new ie(I,F)},s.set(c,g),c.addEventListener("dispose",X)}let f=0;for(let v=0;v<u.length;v++)f+=u[v];const x=c.morphTargetsRelative?1:1-f;h.getUniforms().setValue(r,"morphTargetBaseInfluence",x),h.getUniforms().setValue(r,"morphTargetInfluences",u),h.getUniforms().setValue(r,"morphTargetsTexture",g.texture,t),h.getUniforms().setValue(r,"morphTargetsTextureSize",g.size)}else{const p=u===void 0?0:u.length;let m=n[c.id];if(m===void 0||m.length!==p){m=[];for(let _=0;_<p;_++)m[_]=[_,0];n[c.id]=m}for(let _=0;_<p;_++){const M=m[_];M[0]=_,M[1]=u[_]}m.sort(Yh);for(let _=0;_<8;_++)_<p&&m[_][1]?(o[_][0]=m[_][0],o[_][1]=m[_][1]):(o[_][0]=Number.MAX_SAFE_INTEGER,o[_][1]=0);o.sort(qh);const g=c.morphAttributes.position,f=c.morphAttributes.normal;let x=0;for(let _=0;_<8;_++){const M=o[_],C=M[0],b=M[1];C!==Number.MAX_SAFE_INTEGER&&b?(g&&c.getAttribute("morphTarget"+_)!==g[C]&&c.setAttribute("morphTarget"+_,g[C]),f&&c.getAttribute("morphNormal"+_)!==f[C]&&c.setAttribute("morphNormal"+_,f[C]),i[_]=b,x+=b):(g&&c.hasAttribute("morphTarget"+_)===!0&&c.deleteAttribute("morphTarget"+_),f&&c.hasAttribute("morphNormal"+_)===!0&&c.deleteAttribute("morphNormal"+_),i[_]=0)}const v=c.morphTargetsRelative?1:1-x;h.getUniforms().setValue(r,"morphTargetBaseInfluence",v),h.getUniforms().setValue(r,"morphTargetInfluences",i)}}}}function Jh(r,e,t,n){let i=new WeakMap;function s(a){const o=a.target;o.removeEventListener("dispose",s),t.remove(o.instanceMatrix),o.instanceColor!==null&&t.remove(o.instanceColor)}return{update:function(a){const o=n.render.frame,l=a.geometry,c=e.get(a,l);if(i.get(c)!==o&&(e.update(c),i.set(c,o)),a.isInstancedMesh&&(a.hasEventListener("dispose",s)===!1&&a.addEventListener("dispose",s),i.get(a)!==o&&(t.update(a.instanceMatrix,r.ARRAY_BUFFER),a.instanceColor!==null&&t.update(a.instanceColor,r.ARRAY_BUFFER),i.set(a,o))),a.isSkinnedMesh){const h=a.skeleton;i.get(h)!==o&&(h.update(),i.set(h,o))}return c},dispose:function(){i=new WeakMap}}}class da extends Ze{constructor(e,t,n,i,s,a,o,l,c,h){if((h=h!==void 0?h:1026)!==1026&&h!==1027)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===1026&&(n=1014),n===void 0&&h===1027&&(n=1020),super(null,i,s,a,o,l,h,n,c),this.isDepthTexture=!0,this.image={width:e,height:t},this.magFilter=o!==void 0?o:1003,this.minFilter=l!==void 0?l:1003,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}const ko=new Ze,Wo=new da(1,1);Wo.compareFunction=515;const Xo=new ur,jo=new ks,qo=new Di,Yo=[],Zo=[],Jo=new Float32Array(16),Ko=new Float32Array(9),$o=new Float32Array(4);function oi(r,e,t){const n=r[0];if(n<=0||n>0)return r;const i=e*t;let s=Yo[i];if(s===void 0&&(s=new Float32Array(i),Yo[i]=s),e!==0){n.toArray(s,0);for(let a=1,o=0;a!==e;++a)o+=t,r[a].toArray(s,o)}return s}function et(r,e){if(r.length!==e.length)return!1;for(let t=0,n=r.length;t<n;t++)if(r[t]!==e[t])return!1;return!0}function tt(r,e){for(let t=0,n=e.length;t<n;t++)r[t]=e[t]}function Or(r,e){let t=Zo[e];t===void 0&&(t=new Int32Array(e),Zo[e]=t);for(let n=0;n!==e;++n)t[n]=r.allocateTextureUnit();return t}function Kh(r,e){const t=this.cache;t[0]!==e&&(r.uniform1f(this.addr,e),t[0]=e)}function $h(r,e){const t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y||(r.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(et(t,e))return;r.uniform2fv(this.addr,e),tt(t,e)}}function Qh(r,e){const t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z||(r.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)t[0]===e.r&&t[1]===e.g&&t[2]===e.b||(r.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(et(t,e))return;r.uniform3fv(this.addr,e),tt(t,e)}}function eu(r,e){const t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z&&t[3]===e.w||(r.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(et(t,e))return;r.uniform4fv(this.addr,e),tt(t,e)}}function tu(r,e){const t=this.cache,n=e.elements;if(n===void 0){if(et(t,e))return;r.uniformMatrix2fv(this.addr,!1,e),tt(t,e)}else{if(et(t,n))return;$o.set(n),r.uniformMatrix2fv(this.addr,!1,$o),tt(t,n)}}function nu(r,e){const t=this.cache,n=e.elements;if(n===void 0){if(et(t,e))return;r.uniformMatrix3fv(this.addr,!1,e),tt(t,e)}else{if(et(t,n))return;Ko.set(n),r.uniformMatrix3fv(this.addr,!1,Ko),tt(t,n)}}function iu(r,e){const t=this.cache,n=e.elements;if(n===void 0){if(et(t,e))return;r.uniformMatrix4fv(this.addr,!1,e),tt(t,e)}else{if(et(t,n))return;Jo.set(n),r.uniformMatrix4fv(this.addr,!1,Jo),tt(t,n)}}function ru(r,e){const t=this.cache;t[0]!==e&&(r.uniform1i(this.addr,e),t[0]=e)}function su(r,e){const t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y||(r.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(et(t,e))return;r.uniform2iv(this.addr,e),tt(t,e)}}function au(r,e){const t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z||(r.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(et(t,e))return;r.uniform3iv(this.addr,e),tt(t,e)}}function ou(r,e){const t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z&&t[3]===e.w||(r.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(et(t,e))return;r.uniform4iv(this.addr,e),tt(t,e)}}function lu(r,e){const t=this.cache;t[0]!==e&&(r.uniform1ui(this.addr,e),t[0]=e)}function cu(r,e){const t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y||(r.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(et(t,e))return;r.uniform2uiv(this.addr,e),tt(t,e)}}function hu(r,e){const t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z||(r.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(et(t,e))return;r.uniform3uiv(this.addr,e),tt(t,e)}}function uu(r,e){const t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z&&t[3]===e.w||(r.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(et(t,e))return;r.uniform4uiv(this.addr,e),tt(t,e)}}function du(r,e,t){const n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i);const s=this.type===r.SAMPLER_2D_SHADOW?Wo:ko;t.setTexture2D(e||s,i)}function pu(r,e,t){const n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),t.setTexture3D(e||jo,i)}function fu(r,e,t){const n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),t.setTextureCube(e||qo,i)}function mu(r,e,t){const n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),t.setTexture2DArray(e||Xo,i)}function gu(r,e){r.uniform1fv(this.addr,e)}function _u(r,e){const t=oi(e,this.size,2);r.uniform2fv(this.addr,t)}function vu(r,e){const t=oi(e,this.size,3);r.uniform3fv(this.addr,t)}function xu(r,e){const t=oi(e,this.size,4);r.uniform4fv(this.addr,t)}function yu(r,e){const t=oi(e,this.size,4);r.uniformMatrix2fv(this.addr,!1,t)}function Mu(r,e){const t=oi(e,this.size,9);r.uniformMatrix3fv(this.addr,!1,t)}function Su(r,e){const t=oi(e,this.size,16);r.uniformMatrix4fv(this.addr,!1,t)}function bu(r,e){r.uniform1iv(this.addr,e)}function Tu(r,e){r.uniform2iv(this.addr,e)}function Eu(r,e){r.uniform3iv(this.addr,e)}function wu(r,e){r.uniform4iv(this.addr,e)}function Au(r,e){r.uniform1uiv(this.addr,e)}function Ru(r,e){r.uniform2uiv(this.addr,e)}function Cu(r,e){r.uniform3uiv(this.addr,e)}function Lu(r,e){r.uniform4uiv(this.addr,e)}function Pu(r,e,t){const n=this.cache,i=e.length,s=Or(t,i);et(n,s)||(r.uniform1iv(this.addr,s),tt(n,s));for(let a=0;a!==i;++a)t.setTexture2D(e[a]||ko,s[a])}function Iu(r,e,t){const n=this.cache,i=e.length,s=Or(t,i);et(n,s)||(r.uniform1iv(this.addr,s),tt(n,s));for(let a=0;a!==i;++a)t.setTexture3D(e[a]||jo,s[a])}function Uu(r,e,t){const n=this.cache,i=e.length,s=Or(t,i);et(n,s)||(r.uniform1iv(this.addr,s),tt(n,s));for(let a=0;a!==i;++a)t.setTextureCube(e[a]||qo,s[a])}function Du(r,e,t){const n=this.cache,i=e.length,s=Or(t,i);et(n,s)||(r.uniform1iv(this.addr,s),tt(n,s));for(let a=0;a!==i;++a)t.setTexture2DArray(e[a]||Xo,s[a])}class Nu{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=(function(i){switch(i){case 5126:return Kh;case 35664:return $h;case 35665:return Qh;case 35666:return eu;case 35674:return tu;case 35675:return nu;case 35676:return iu;case 5124:case 35670:return ru;case 35667:case 35671:return su;case 35668:case 35672:return au;case 35669:case 35673:return ou;case 5125:return lu;case 36294:return cu;case 36295:return hu;case 36296:return uu;case 35678:case 36198:case 36298:case 36306:case 35682:return du;case 35679:case 36299:case 36307:return pu;case 35680:case 36300:case 36308:case 36293:return fu;case 36289:case 36303:case 36311:case 36292:return mu}})(t.type)}}class Ou{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=(function(i){switch(i){case 5126:return gu;case 35664:return _u;case 35665:return vu;case 35666:return xu;case 35674:return yu;case 35675:return Mu;case 35676:return Su;case 5124:case 35670:return bu;case 35667:case 35671:return Tu;case 35668:case 35672:return Eu;case 35669:case 35673:return wu;case 5125:return Au;case 36294:return Ru;case 36295:return Cu;case 36296:return Lu;case 35678:case 36198:case 36298:case 36306:case 35682:return Pu;case 35679:case 36299:case 36307:return Iu;case 35680:case 36300:case 36308:case 36293:return Uu;case 36289:case 36303:case 36311:case 36292:return Du}})(t.type)}}class Fu{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const i=this.seq;for(let s=0,a=i.length;s!==a;++s){const o=i[s];o.setValue(e,t[o.id],n)}}}const pa=/(\w+)(\])?(\[|\.)?/g;function Qo(r,e){r.seq.push(e),r.map[e.id]=e}function Bu(r,e,t){const n=r.name,i=n.length;for(pa.lastIndex=0;;){const s=pa.exec(n),a=pa.lastIndex;let o=s[1];const l=s[2]==="]",c=s[3];if(l&&(o|=0),c===void 0||c==="["&&a+2===i){Qo(t,c===void 0?new Nu(o,r,e):new Ou(o,r,e));break}{let h=t.map[o];h===void 0&&(h=new Fu(o),Qo(t,h)),t=h}}}class Fr{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let i=0;i<n;++i){const s=e.getActiveUniform(t,i);Bu(s,e.getUniformLocation(t,s.name),this)}}setValue(e,t,n,i){const s=this.map[t];s!==void 0&&s.setValue(e,n,i)}setOptional(e,t,n){const i=t[n];i!==void 0&&this.setValue(e,n,i)}static upload(e,t,n,i){for(let s=0,a=t.length;s!==a;++s){const o=t[s],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,i)}}static seqWithValue(e,t){const n=[];for(let i=0,s=e.length;i!==s;++i){const a=e[i];a.id in t&&n.push(a)}return n}}function el(r,e,t){const n=r.createShader(e);return r.shaderSource(n,t),r.compileShader(n),n}const zu=37297;let Gu=0;function tl(r,e,t){const n=r.getShaderParameter(e,r.COMPILE_STATUS),i=r.getShaderInfoLog(e).trim();if(n&&i==="")return"";const s=/ERROR: 0:(\d+)/.exec(i);if(s){const a=parseInt(s[1]);return t.toUpperCase()+`

`+i+`

`+(function(o,l){const c=o.split(`
`),h=[],u=Math.max(l-6,0),d=Math.min(l+6,c.length);for(let p=u;p<d;p++){const m=p+1;h.push(`${m===l?">":" "} ${m}: ${c[p]}`)}return h.join(`
`)})(r.getShaderSource(e),a)}return i}function Hu(r,e){const t=(function(n){const i=Ge.getPrimaries(Ge.workingColorSpace),s=Ge.getPrimaries(n);let a;switch(i===s?a="":i==="p3"&&s===Ti?a="LinearDisplayP3ToLinearSRGB":i===Ti&&s==="p3"&&(a="LinearSRGBToLinearDisplayP3"),n){case Ht:case Si:return[a,"LinearTransferOETF"];case $e:case lr:return[a,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space:",n),[a,"LinearTransferOETF"]}})(e);return`vec4 ${r}( vec4 value ) { return ${t[0]}( ${t[1]}( value ) ); }`}function Vu(r,e){let t;switch(e){case 1:t="Linear";break;case 2:t="Reinhard";break;case 3:t="OptimizedCineon";break;case 4:t="ACESFilmic";break;case 6:t="AgX";break;case 5:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+r+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}function li(r){return r!==""}function nl(r,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return r.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function il(r,e){return r.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const ku=/^[ \t]*#include +<([\w\d./]+)>/gm;function fa(r){return r.replace(ku,Xu)}const Wu=new Map([["encodings_fragment","colorspace_fragment"],["encodings_pars_fragment","colorspace_pars_fragment"],["output_fragment","opaque_fragment"]]);function Xu(r,e){let t=Ee[e];if(t===void 0){const n=Wu.get(e);if(n===void 0)throw new Error("Can not resolve #include <"+e+">");t=Ee[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n)}return fa(t)}const ju=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function rl(r){return r.replace(ju,qu)}function qu(r,e,t,n){let i="";for(let s=parseInt(e);s<parseInt(t);s++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return i}function sl(r){let e="precision "+r.precision+` float;
precision `+r.precision+" int;";return r.precision==="highp"?e+=`
#define HIGH_PRECISION`:r.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:r.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function Yu(r,e,t,n){const i=r.getContext(),s=t.defines;let a=t.vertexShader,o=t.fragmentShader;const l=(function(L){let W="SHADOWMAP_TYPE_BASIC";return L.shadowMapType===1?W="SHADOWMAP_TYPE_PCF":L.shadowMapType===2?W="SHADOWMAP_TYPE_PCF_SOFT":L.shadowMapType===3&&(W="SHADOWMAP_TYPE_VSM"),W})(t),c=(function(L){let W="ENVMAP_TYPE_CUBE";if(L.envMap)switch(L.envMapMode){case 301:case 302:W="ENVMAP_TYPE_CUBE";break;case 306:W="ENVMAP_TYPE_CUBE_UV"}return W})(t),h=(function(L){let W="ENVMAP_MODE_REFLECTION";return L.envMap&&L.envMapMode===302&&(W="ENVMAP_MODE_REFRACTION"),W})(t),u=(function(L){let W="ENVMAP_BLENDING_NONE";if(L.envMap)switch(L.combine){case 0:W="ENVMAP_BLENDING_MULTIPLY";break;case 1:W="ENVMAP_BLENDING_MIX";break;case 2:W="ENVMAP_BLENDING_ADD"}return W})(t),d=(function(L){const W=L.envMapCubeUVHeight;if(W===null)return null;const X=Math.log2(W)-2,oe=1/W;return{texelWidth:1/(3*Math.max(Math.pow(2,X),112)),texelHeight:oe,maxMip:X}})(t),p=t.isWebGL2?"":(function(L){return[L.extensionDerivatives||L.envMapCubeUVHeight||L.bumpMap||L.normalMapTangentSpace||L.clearcoatNormalMap||L.flatShading||L.shaderID==="physical"?"#extension GL_OES_standard_derivatives : enable":"",(L.extensionFragDepth||L.logarithmicDepthBuffer)&&L.rendererExtensionFragDepth?"#extension GL_EXT_frag_depth : enable":"",L.extensionDrawBuffers&&L.rendererExtensionDrawBuffers?"#extension GL_EXT_draw_buffers : require":"",(L.extensionShaderTextureLOD||L.envMap||L.transmission)&&L.rendererExtensionShaderTextureLod?"#extension GL_EXT_shader_texture_lod : enable":""].filter(li).join(`
`)})(t),m=(function(L){return[L.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":""].filter(li).join(`
`)})(t),g=(function(L){const W=[];for(const X in L){const oe=L[X];oe!==!1&&W.push("#define "+X+" "+oe)}return W.join(`
`)})(s),f=i.createProgram();let x,v,_=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(x=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(li).join(`
`),x.length>0&&(x+=`
`),v=[p,"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(li).join(`
`),v.length>0&&(v+=`
`)):(x=[sl(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors&&t.isWebGL2?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0&&t.isWebGL2?"#define MORPHTARGETS_TEXTURE":"",t.morphTargetsCount>0&&t.isWebGL2?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0&&t.isWebGL2?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.useLegacyLights?"#define LEGACY_LIGHTS":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.logarithmicDepthBuffer&&t.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#if ( defined( USE_MORPHTARGETS ) && ! defined( MORPHTARGETS_TEXTURE ) )","	attribute vec3 morphTarget0;","	attribute vec3 morphTarget1;","	attribute vec3 morphTarget2;","	attribute vec3 morphTarget3;","	#ifdef USE_MORPHNORMALS","		attribute vec3 morphNormal0;","		attribute vec3 morphNormal1;","		attribute vec3 morphNormal2;","		attribute vec3 morphNormal3;","	#else","		attribute vec3 morphTarget4;","		attribute vec3 morphTarget5;","		attribute vec3 morphTarget6;","		attribute vec3 morphTarget7;","	#endif","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(li).join(`
`),v=[p,sl(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.useLegacyLights?"#define LEGACY_LIGHTS":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.logarithmicDepthBuffer&&t.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==0?"#define TONE_MAPPING":"",t.toneMapping!==0?Ee.tonemapping_pars_fragment:"",t.toneMapping!==0?Vu("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Ee.colorspace_pars_fragment,Hu("linearToOutputTexel",t.outputColorSpace),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(li).join(`
`)),a=fa(a),a=nl(a,t),a=il(a,t),o=fa(o),o=nl(o,t),o=il(o,t),a=rl(a),o=rl(o),t.isWebGL2&&t.isRawShaderMaterial!==!0&&(_=`#version 300 es
`,x=[m,"precision mediump sampler2DArray;","#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+x,v=["precision mediump sampler2DArray;","#define varying in",t.glslVersion===Os?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Os?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+v);const M=_+x+a,C=_+v+o,b=el(i,i.VERTEX_SHADER,M),A=el(i,i.FRAGMENT_SHADER,C);function N(L){if(r.debug.checkShaderErrors){const W=i.getProgramInfoLog(f).trim(),X=i.getShaderInfoLog(b).trim(),oe=i.getShaderInfoLog(A).trim();let pe=!0,ne=!0;if(i.getProgramParameter(f,i.LINK_STATUS)===!1)if(pe=!1,typeof r.debug.onShaderError=="function")r.debug.onShaderError(i,f,b,A);else{const ee=tl(i,b,"vertex"),K=tl(i,A,"fragment");console.error("THREE.WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(f,i.VALIDATE_STATUS)+`

Program Info Log: `+W+`
`+ee+`
`+K)}else W!==""?console.warn("THREE.WebGLProgram: Program Info Log:",W):X!==""&&oe!==""||(ne=!1);ne&&(L.diagnostics={runnable:pe,programLog:W,vertexShader:{log:X,prefix:x},fragmentShader:{log:oe,prefix:v}})}i.deleteShader(b),i.deleteShader(A),I=new Fr(i,f),F=(function(W,X){const oe={},pe=W.getProgramParameter(X,W.ACTIVE_ATTRIBUTES);for(let ne=0;ne<pe;ne++){const ee=W.getActiveAttrib(X,ne),K=ee.name;let H=1;ee.type===W.FLOAT_MAT2&&(H=2),ee.type===W.FLOAT_MAT3&&(H=3),ee.type===W.FLOAT_MAT4&&(H=4),oe[K]={type:ee.type,location:W.getAttribLocation(X,K),locationSize:H}}return oe})(i,f)}let I,F;i.attachShader(f,b),i.attachShader(f,A),t.index0AttributeName!==void 0?i.bindAttribLocation(f,0,t.index0AttributeName):t.morphTargets===!0&&i.bindAttribLocation(f,0,"position"),i.linkProgram(f),this.getUniforms=function(){return I===void 0&&N(this),I},this.getAttributes=function(){return F===void 0&&N(this),F};let Y=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return Y===!1&&(Y=i.getProgramParameter(f,zu)),Y},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(f),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Gu++,this.cacheKey=e,this.usedTimes=1,this.program=f,this.vertexShader=b,this.fragmentShader=A,this}let Zu=0;class Ju{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,n=e.fragmentShader,i=this._getShaderStage(t),s=this._getShaderStage(n),a=this._getShaderCacheForMaterial(e);return a.has(i)===!1&&(a.add(i),i.usedTimes++),a.has(s)===!1&&(a.add(s),s.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new Ku(e),t.set(e,n)),n}}class Ku{constructor(e){this.id=Zu++,this.code=e,this.usedTimes=0}}function $u(r,e,t,n,i,s,a){const o=new vr,l=new Ju,c=[],h=i.isWebGL2,u=i.logarithmicDepthBuffer,d=i.vertexTextures;let p=i.precision;const m={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(f){return f===0?"uv":`uv${f}`}return{getParameters:function(f,x,v,_,M){const C=_.fog,b=M.geometry,A=f.isMeshStandardMaterial?_.environment:null,N=(f.isMeshStandardMaterial?t:e).get(f.envMap||A),I=N&&N.mapping===306?N.image.height:null,F=m[f.type];f.precision!==null&&(p=i.getMaxPrecision(f.precision),p!==f.precision&&console.warn("THREE.WebGLProgram.getParameters:",f.precision,"not supported, using",p,"instead."));const Y=b.morphAttributes.position||b.morphAttributes.normal||b.morphAttributes.color,L=Y!==void 0?Y.length:0;let W,X,oe,pe,ne=0;if(b.morphAttributes.position!==void 0&&(ne=1),b.morphAttributes.normal!==void 0&&(ne=2),b.morphAttributes.color!==void 0&&(ne=3),F){const ut=Nt[F];W=ut.vertexShader,X=ut.fragmentShader}else W=f.vertexShader,X=f.fragmentShader,l.update(f),oe=l.getVertexShaderID(f),pe=l.getFragmentShaderID(f);const ee=r.getRenderTarget(),K=M.isInstancedMesh===!0,H=M.isBatchedMesh===!0,k=!!f.map,ce=!!f.matcap,E=!!N,T=!!f.aoMap,O=!!f.lightMap,Z=!!f.bumpMap,P=!!f.normalMap,q=!!f.displacementMap,U=!!f.emissiveMap,D=!!f.metalnessMap,B=!!f.roughnessMap,te=f.anisotropy>0,$=f.clearcoat>0,S=f.iridescence>0,re=f.sheen>0,z=f.transmission>0,G=te&&!!f.anisotropyMap,se=$&&!!f.clearcoatMap,he=$&&!!f.clearcoatNormalMap,fe=$&&!!f.clearcoatRoughnessMap,ge=S&&!!f.iridescenceMap,be=S&&!!f.iridescenceThicknessMap,_e=re&&!!f.sheenColorMap,ve=re&&!!f.sheenRoughnessMap,Re=!!f.specularMap,rt=!!f.specularColorMap,xe=!!f.specularIntensityMap,Ne=z&&!!f.transmissionMap,Pe=z&&!!f.thicknessMap,Cs=!!f.gradientMap,yi=!!f.alphaMap,Ls=f.alphaTest>0,Rt=!!f.alphaHash,wt=!!f.extensions,Mi=!!b.attributes.uv1,j=!!b.attributes.uv2,Ps=!!b.attributes.uv3;let sr=0;return f.toneMapped&&(ee!==null&&ee.isXRRenderTarget!==!0||(sr=r.toneMapping)),{isWebGL2:h,shaderID:F,shaderType:f.type,shaderName:f.name,vertexShader:W,fragmentShader:X,defines:f.defines,customVertexShaderID:oe,customFragmentShaderID:pe,isRawShaderMaterial:f.isRawShaderMaterial===!0,glslVersion:f.glslVersion,precision:p,batching:H,instancing:K,instancingColor:K&&M.instanceColor!==null,supportsVertexTextures:d,outputColorSpace:ee===null?r.outputColorSpace:ee.isXRRenderTarget===!0?ee.texture.colorSpace:Ht,map:k,matcap:ce,envMap:E,envMapMode:E&&N.mapping,envMapCubeUVHeight:I,aoMap:T,lightMap:O,bumpMap:Z,normalMap:P,displacementMap:d&&q,emissiveMap:U,normalMapObjectSpace:P&&f.normalMapType===1,normalMapTangentSpace:P&&f.normalMapType===0,metalnessMap:D,roughnessMap:B,anisotropy:te,anisotropyMap:G,clearcoat:$,clearcoatMap:se,clearcoatNormalMap:he,clearcoatRoughnessMap:fe,iridescence:S,iridescenceMap:ge,iridescenceThicknessMap:be,sheen:re,sheenColorMap:_e,sheenRoughnessMap:ve,specularMap:Re,specularColorMap:rt,specularIntensityMap:xe,transmission:z,transmissionMap:Ne,thicknessMap:Pe,gradientMap:Cs,opaque:f.transparent===!1&&f.blending===1,alphaMap:yi,alphaTest:Ls,alphaHash:Rt,combine:f.combine,mapUv:k&&g(f.map.channel),aoMapUv:T&&g(f.aoMap.channel),lightMapUv:O&&g(f.lightMap.channel),bumpMapUv:Z&&g(f.bumpMap.channel),normalMapUv:P&&g(f.normalMap.channel),displacementMapUv:q&&g(f.displacementMap.channel),emissiveMapUv:U&&g(f.emissiveMap.channel),metalnessMapUv:D&&g(f.metalnessMap.channel),roughnessMapUv:B&&g(f.roughnessMap.channel),anisotropyMapUv:G&&g(f.anisotropyMap.channel),clearcoatMapUv:se&&g(f.clearcoatMap.channel),clearcoatNormalMapUv:he&&g(f.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:fe&&g(f.clearcoatRoughnessMap.channel),iridescenceMapUv:ge&&g(f.iridescenceMap.channel),iridescenceThicknessMapUv:be&&g(f.iridescenceThicknessMap.channel),sheenColorMapUv:_e&&g(f.sheenColorMap.channel),sheenRoughnessMapUv:ve&&g(f.sheenRoughnessMap.channel),specularMapUv:Re&&g(f.specularMap.channel),specularColorMapUv:rt&&g(f.specularColorMap.channel),specularIntensityMapUv:xe&&g(f.specularIntensityMap.channel),transmissionMapUv:Ne&&g(f.transmissionMap.channel),thicknessMapUv:Pe&&g(f.thicknessMap.channel),alphaMapUv:yi&&g(f.alphaMap.channel),vertexTangents:!!b.attributes.tangent&&(P||te),vertexColors:f.vertexColors,vertexAlphas:f.vertexColors===!0&&!!b.attributes.color&&b.attributes.color.itemSize===4,vertexUv1s:Mi,vertexUv2s:j,vertexUv3s:Ps,pointsUvs:M.isPoints===!0&&!!b.attributes.uv&&(k||yi),fog:!!C,useFog:f.fog===!0,fogExp2:C&&C.isFogExp2,flatShading:f.flatShading===!0,sizeAttenuation:f.sizeAttenuation===!0,logarithmicDepthBuffer:u,skinning:M.isSkinnedMesh===!0,morphTargets:b.morphAttributes.position!==void 0,morphNormals:b.morphAttributes.normal!==void 0,morphColors:b.morphAttributes.color!==void 0,morphTargetsCount:L,morphTextureStride:ne,numDirLights:x.directional.length,numPointLights:x.point.length,numSpotLights:x.spot.length,numSpotLightMaps:x.spotLightMap.length,numRectAreaLights:x.rectArea.length,numHemiLights:x.hemi.length,numDirLightShadows:x.directionalShadowMap.length,numPointLightShadows:x.pointShadowMap.length,numSpotLightShadows:x.spotShadowMap.length,numSpotLightShadowsWithMaps:x.numSpotLightShadowsWithMaps,numLightProbes:x.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:f.dithering,shadowMapEnabled:r.shadowMap.enabled&&v.length>0,shadowMapType:r.shadowMap.type,toneMapping:sr,useLegacyLights:r._useLegacyLights,decodeVideoTexture:k&&f.map.isVideoTexture===!0&&Ge.getTransfer(f.map.colorSpace)===ke,premultipliedAlpha:f.premultipliedAlpha,doubleSided:f.side===2,flipSided:f.side===1,useDepthPacking:f.depthPacking>=0,depthPacking:f.depthPacking||0,index0AttributeName:f.index0AttributeName,extensionDerivatives:wt&&f.extensions.derivatives===!0,extensionFragDepth:wt&&f.extensions.fragDepth===!0,extensionDrawBuffers:wt&&f.extensions.drawBuffers===!0,extensionShaderTextureLOD:wt&&f.extensions.shaderTextureLOD===!0,extensionClipCullDistance:wt&&f.extensions.clipCullDistance&&n.has("WEBGL_clip_cull_distance"),rendererExtensionFragDepth:h||n.has("EXT_frag_depth"),rendererExtensionDrawBuffers:h||n.has("WEBGL_draw_buffers"),rendererExtensionShaderTextureLod:h||n.has("EXT_shader_texture_lod"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:f.customProgramCacheKey()}},getProgramCacheKey:function(f){const x=[];if(f.shaderID?x.push(f.shaderID):(x.push(f.customVertexShaderID),x.push(f.customFragmentShaderID)),f.defines!==void 0)for(const v in f.defines)x.push(v),x.push(f.defines[v]);return f.isRawShaderMaterial===!1&&((function(v,_){v.push(_.precision),v.push(_.outputColorSpace),v.push(_.envMapMode),v.push(_.envMapCubeUVHeight),v.push(_.mapUv),v.push(_.alphaMapUv),v.push(_.lightMapUv),v.push(_.aoMapUv),v.push(_.bumpMapUv),v.push(_.normalMapUv),v.push(_.displacementMapUv),v.push(_.emissiveMapUv),v.push(_.metalnessMapUv),v.push(_.roughnessMapUv),v.push(_.anisotropyMapUv),v.push(_.clearcoatMapUv),v.push(_.clearcoatNormalMapUv),v.push(_.clearcoatRoughnessMapUv),v.push(_.iridescenceMapUv),v.push(_.iridescenceThicknessMapUv),v.push(_.sheenColorMapUv),v.push(_.sheenRoughnessMapUv),v.push(_.specularMapUv),v.push(_.specularColorMapUv),v.push(_.specularIntensityMapUv),v.push(_.transmissionMapUv),v.push(_.thicknessMapUv),v.push(_.combine),v.push(_.fogExp2),v.push(_.sizeAttenuation),v.push(_.morphTargetsCount),v.push(_.morphAttributeCount),v.push(_.numDirLights),v.push(_.numPointLights),v.push(_.numSpotLights),v.push(_.numSpotLightMaps),v.push(_.numHemiLights),v.push(_.numRectAreaLights),v.push(_.numDirLightShadows),v.push(_.numPointLightShadows),v.push(_.numSpotLightShadows),v.push(_.numSpotLightShadowsWithMaps),v.push(_.numLightProbes),v.push(_.shadowMapType),v.push(_.toneMapping),v.push(_.numClippingPlanes),v.push(_.numClipIntersection),v.push(_.depthPacking)})(x,f),(function(v,_){o.disableAll(),_.isWebGL2&&o.enable(0),_.supportsVertexTextures&&o.enable(1),_.instancing&&o.enable(2),_.instancingColor&&o.enable(3),_.matcap&&o.enable(4),_.envMap&&o.enable(5),_.normalMapObjectSpace&&o.enable(6),_.normalMapTangentSpace&&o.enable(7),_.clearcoat&&o.enable(8),_.iridescence&&o.enable(9),_.alphaTest&&o.enable(10),_.vertexColors&&o.enable(11),_.vertexAlphas&&o.enable(12),_.vertexUv1s&&o.enable(13),_.vertexUv2s&&o.enable(14),_.vertexUv3s&&o.enable(15),_.vertexTangents&&o.enable(16),_.anisotropy&&o.enable(17),_.alphaHash&&o.enable(18),_.batching&&o.enable(19),v.push(o.mask),o.disableAll(),_.fog&&o.enable(0),_.useFog&&o.enable(1),_.flatShading&&o.enable(2),_.logarithmicDepthBuffer&&o.enable(3),_.skinning&&o.enable(4),_.morphTargets&&o.enable(5),_.morphNormals&&o.enable(6),_.morphColors&&o.enable(7),_.premultipliedAlpha&&o.enable(8),_.shadowMapEnabled&&o.enable(9),_.useLegacyLights&&o.enable(10),_.doubleSided&&o.enable(11),_.flipSided&&o.enable(12),_.useDepthPacking&&o.enable(13),_.dithering&&o.enable(14),_.transmission&&o.enable(15),_.sheen&&o.enable(16),_.opaque&&o.enable(17),_.pointsUvs&&o.enable(18),_.decodeVideoTexture&&o.enable(19),v.push(o.mask)})(x,f),x.push(r.outputColorSpace)),x.push(f.customProgramCacheKey),x.join()},getUniforms:function(f){const x=m[f.type];let v;if(x){const _=Nt[x];v=Uo.clone(_.uniforms)}else v=f.uniforms;return v},acquireProgram:function(f,x){let v;for(let _=0,M=c.length;_<M;_++){const C=c[_];if(C.cacheKey===x){v=C,++v.usedTimes;break}}return v===void 0&&(v=new Yu(r,x,f,s),c.push(v)),v},releaseProgram:function(f){if(--f.usedTimes==0){const x=c.indexOf(f);c[x]=c[c.length-1],c.pop(),f.destroy()}},releaseShaderCache:function(f){l.remove(f)},programs:c,dispose:function(){l.dispose()}}}function Qu(){let r=new WeakMap;return{get:function(e){let t=r.get(e);return t===void 0&&(t={},r.set(e,t)),t},remove:function(e){r.delete(e)},update:function(e,t,n){r.get(e)[t]=n},dispose:function(){r=new WeakMap}}}function ed(r,e){return r.groupOrder!==e.groupOrder?r.groupOrder-e.groupOrder:r.renderOrder!==e.renderOrder?r.renderOrder-e.renderOrder:r.material.id!==e.material.id?r.material.id-e.material.id:r.z!==e.z?r.z-e.z:r.id-e.id}function al(r,e){return r.groupOrder!==e.groupOrder?r.groupOrder-e.groupOrder:r.renderOrder!==e.renderOrder?r.renderOrder-e.renderOrder:r.z!==e.z?e.z-r.z:r.id-e.id}function ol(){const r=[];let e=0;const t=[],n=[],i=[];function s(a,o,l,c,h,u){let d=r[e];return d===void 0?(d={id:a.id,object:a,geometry:o,material:l,groupOrder:c,renderOrder:a.renderOrder,z:h,group:u},r[e]=d):(d.id=a.id,d.object=a,d.geometry=o,d.material=l,d.groupOrder=c,d.renderOrder=a.renderOrder,d.z=h,d.group=u),e++,d}return{opaque:t,transmissive:n,transparent:i,init:function(){e=0,t.length=0,n.length=0,i.length=0},push:function(a,o,l,c,h,u){const d=s(a,o,l,c,h,u);l.transmission>0?n.push(d):l.transparent===!0?i.push(d):t.push(d)},unshift:function(a,o,l,c,h,u){const d=s(a,o,l,c,h,u);l.transmission>0?n.unshift(d):l.transparent===!0?i.unshift(d):t.unshift(d)},finish:function(){for(let a=e,o=r.length;a<o;a++){const l=r[a];if(l.id===null)break;l.id=null,l.object=null,l.geometry=null,l.material=null,l.group=null}},sort:function(a,o){t.length>1&&t.sort(a||ed),n.length>1&&n.sort(o||al),i.length>1&&i.sort(o||al)}}}function td(){let r=new WeakMap;return{get:function(e,t){const n=r.get(e);let i;return n===void 0?(i=new ol,r.set(e,[i])):t>=n.length?(i=new ol,n.push(i)):i=n[t],i},dispose:function(){r=new WeakMap}}}function nd(){const r={};return{get:function(e){if(r[e.id]!==void 0)return r[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new w,color:new de};break;case"SpotLight":t={position:new w,direction:new w,color:new de,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new w,color:new de,distance:0,decay:0};break;case"HemisphereLight":t={direction:new w,skyColor:new de,groundColor:new de};break;case"RectAreaLight":t={color:new de,position:new w,halfWidth:new w,halfHeight:new w}}return r[e.id]=t,t}}}let id=0;function rd(r,e){return(e.castShadow?2:0)-(r.castShadow?2:0)+(e.map?1:0)-(r.map?1:0)}function sd(r,e){const t=new nd,n=(function(){const l={};return{get:function(c){if(l[c.id]!==void 0)return l[c.id];let h;switch(c.type){case"DirectionalLight":case"SpotLight":h={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ie};break;case"PointLight":h={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ie,shadowCameraNear:1,shadowCameraFar:1e3}}return l[c.id]=h,h}}})(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let l=0;l<9;l++)i.probe.push(new w);const s=new w,a=new Me,o=new Me;return{setup:function(l,c){let h=0,u=0,d=0;for(let F=0;F<9;F++)i.probe[F].set(0,0,0);let p=0,m=0,g=0,f=0,x=0,v=0,_=0,M=0,C=0,b=0,A=0;l.sort(rd);const N=c===!0?Math.PI:1;for(let F=0,Y=l.length;F<Y;F++){const L=l[F],W=L.color,X=L.intensity,oe=L.distance,pe=L.shadow&&L.shadow.map?L.shadow.map.texture:null;if(L.isAmbientLight)h+=W.r*X*N,u+=W.g*X*N,d+=W.b*X*N;else if(L.isLightProbe){for(let ne=0;ne<9;ne++)i.probe[ne].addScaledVector(L.sh.coefficients[ne],X);A++}else if(L.isDirectionalLight){const ne=t.get(L);if(ne.color.copy(L.color).multiplyScalar(L.intensity*N),L.castShadow){const ee=L.shadow,K=n.get(L);K.shadowBias=ee.bias,K.shadowNormalBias=ee.normalBias,K.shadowRadius=ee.radius,K.shadowMapSize=ee.mapSize,i.directionalShadow[p]=K,i.directionalShadowMap[p]=pe,i.directionalShadowMatrix[p]=L.shadow.matrix,v++}i.directional[p]=ne,p++}else if(L.isSpotLight){const ne=t.get(L);ne.position.setFromMatrixPosition(L.matrixWorld),ne.color.copy(W).multiplyScalar(X*N),ne.distance=oe,ne.coneCos=Math.cos(L.angle),ne.penumbraCos=Math.cos(L.angle*(1-L.penumbra)),ne.decay=L.decay,i.spot[g]=ne;const ee=L.shadow;if(L.map&&(i.spotLightMap[C]=L.map,C++,ee.updateMatrices(L),L.castShadow&&b++),i.spotLightMatrix[g]=ee.matrix,L.castShadow){const K=n.get(L);K.shadowBias=ee.bias,K.shadowNormalBias=ee.normalBias,K.shadowRadius=ee.radius,K.shadowMapSize=ee.mapSize,i.spotShadow[g]=K,i.spotShadowMap[g]=pe,M++}g++}else if(L.isRectAreaLight){const ne=t.get(L);ne.color.copy(W).multiplyScalar(X),ne.halfWidth.set(.5*L.width,0,0),ne.halfHeight.set(0,.5*L.height,0),i.rectArea[f]=ne,f++}else if(L.isPointLight){const ne=t.get(L);if(ne.color.copy(L.color).multiplyScalar(L.intensity*N),ne.distance=L.distance,ne.decay=L.decay,L.castShadow){const ee=L.shadow,K=n.get(L);K.shadowBias=ee.bias,K.shadowNormalBias=ee.normalBias,K.shadowRadius=ee.radius,K.shadowMapSize=ee.mapSize,K.shadowCameraNear=ee.camera.near,K.shadowCameraFar=ee.camera.far,i.pointShadow[m]=K,i.pointShadowMap[m]=pe,i.pointShadowMatrix[m]=L.shadow.matrix,_++}i.point[m]=ne,m++}else if(L.isHemisphereLight){const ne=t.get(L);ne.skyColor.copy(L.color).multiplyScalar(X*N),ne.groundColor.copy(L.groundColor).multiplyScalar(X*N),i.hemi[x]=ne,x++}}f>0&&(e.isWebGL2?r.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=le.LTC_FLOAT_1,i.rectAreaLTC2=le.LTC_FLOAT_2):(i.rectAreaLTC1=le.LTC_HALF_1,i.rectAreaLTC2=le.LTC_HALF_2):r.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=le.LTC_FLOAT_1,i.rectAreaLTC2=le.LTC_FLOAT_2):r.has("OES_texture_half_float_linear")===!0?(i.rectAreaLTC1=le.LTC_HALF_1,i.rectAreaLTC2=le.LTC_HALF_2):console.error("THREE.WebGLRenderer: Unable to use RectAreaLight. Missing WebGL extensions.")),i.ambient[0]=h,i.ambient[1]=u,i.ambient[2]=d;const I=i.hash;I.directionalLength===p&&I.pointLength===m&&I.spotLength===g&&I.rectAreaLength===f&&I.hemiLength===x&&I.numDirectionalShadows===v&&I.numPointShadows===_&&I.numSpotShadows===M&&I.numSpotMaps===C&&I.numLightProbes===A||(i.directional.length=p,i.spot.length=g,i.rectArea.length=f,i.point.length=m,i.hemi.length=x,i.directionalShadow.length=v,i.directionalShadowMap.length=v,i.pointShadow.length=_,i.pointShadowMap.length=_,i.spotShadow.length=M,i.spotShadowMap.length=M,i.directionalShadowMatrix.length=v,i.pointShadowMatrix.length=_,i.spotLightMatrix.length=M+C-b,i.spotLightMap.length=C,i.numSpotLightShadowsWithMaps=b,i.numLightProbes=A,I.directionalLength=p,I.pointLength=m,I.spotLength=g,I.rectAreaLength=f,I.hemiLength=x,I.numDirectionalShadows=v,I.numPointShadows=_,I.numSpotShadows=M,I.numSpotMaps=C,I.numLightProbes=A,i.version=id++)},setupView:function(l,c){let h=0,u=0,d=0,p=0,m=0;const g=c.matrixWorldInverse;for(let f=0,x=l.length;f<x;f++){const v=l[f];if(v.isDirectionalLight){const _=i.directional[h];_.direction.setFromMatrixPosition(v.matrixWorld),s.setFromMatrixPosition(v.target.matrixWorld),_.direction.sub(s),_.direction.transformDirection(g),h++}else if(v.isSpotLight){const _=i.spot[d];_.position.setFromMatrixPosition(v.matrixWorld),_.position.applyMatrix4(g),_.direction.setFromMatrixPosition(v.matrixWorld),s.setFromMatrixPosition(v.target.matrixWorld),_.direction.sub(s),_.direction.transformDirection(g),d++}else if(v.isRectAreaLight){const _=i.rectArea[p];_.position.setFromMatrixPosition(v.matrixWorld),_.position.applyMatrix4(g),o.identity(),a.copy(v.matrixWorld),a.premultiply(g),o.extractRotation(a),_.halfWidth.set(.5*v.width,0,0),_.halfHeight.set(0,.5*v.height,0),_.halfWidth.applyMatrix4(o),_.halfHeight.applyMatrix4(o),p++}else if(v.isPointLight){const _=i.point[u];_.position.setFromMatrixPosition(v.matrixWorld),_.position.applyMatrix4(g),u++}else if(v.isHemisphereLight){const _=i.hemi[m];_.direction.setFromMatrixPosition(v.matrixWorld),_.direction.transformDirection(g),m++}}},state:i}}function ll(r,e){const t=new sd(r,e),n=[],i=[];return{init:function(){n.length=0,i.length=0},state:{lightsArray:n,shadowsArray:i,lights:t},setupLights:function(s){t.setup(n,s)},setupLightsView:function(s){t.setupView(n,s)},pushLight:function(s){n.push(s)},pushShadow:function(s){i.push(s)}}}function ad(r,e){let t=new WeakMap;return{get:function(n,i=0){const s=t.get(n);let a;return s===void 0?(a=new ll(r,e),t.set(n,[a])):i>=s.length?(a=new ll(r,e),s.push(a)):a=s[i],a},dispose:function(){t=new WeakMap}}}class ma extends ct{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=3200,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class ga extends ct{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}function od(r,e,t){let n=new Ni;const i=new ie,s=new ie,a=new He,o=new ma({depthPacking:3201}),l=new ga,c={},h=t.maxTextureSize,u={0:1,1:0,2:2},d=new Vt({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ie},radius:{value:4}},vertexShader:`void main() {
	gl_Position = vec4( position, 1.0 );
}`,fragmentShader:`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`}),p=d.clone();p.defines.HORIZONTAL_PASS=1;const m=new Ae;m.setAttribute("position",new Ve(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const g=new Qe(m,d),f=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=1;let x=this.type;function v(b,A){const N=e.update(g);d.defines.VSM_SAMPLES!==b.blurSamples&&(d.defines.VSM_SAMPLES=b.blurSamples,p.defines.VSM_SAMPLES=b.blurSamples,d.needsUpdate=!0,p.needsUpdate=!0),b.mapPass===null&&(b.mapPass=new Pt(i.x,i.y)),d.uniforms.shadow_pass.value=b.map.texture,d.uniforms.resolution.value=b.mapSize,d.uniforms.radius.value=b.radius,r.setRenderTarget(b.mapPass),r.clear(),r.renderBufferDirect(A,null,N,d,g,null),p.uniforms.shadow_pass.value=b.mapPass.texture,p.uniforms.resolution.value=b.mapSize,p.uniforms.radius.value=b.radius,r.setRenderTarget(b.map),r.clear(),r.renderBufferDirect(A,null,N,p,g,null)}function _(b,A,N,I){let F=null;const Y=N.isPointLight===!0?b.customDistanceMaterial:b.customDepthMaterial;if(Y!==void 0)F=Y;else if(F=N.isPointLight===!0?l:o,r.localClippingEnabled&&A.clipShadows===!0&&Array.isArray(A.clippingPlanes)&&A.clippingPlanes.length!==0||A.displacementMap&&A.displacementScale!==0||A.alphaMap&&A.alphaTest>0||A.map&&A.alphaTest>0){const L=F.uuid,W=A.uuid;let X=c[L];X===void 0&&(X={},c[L]=X);let oe=X[W];oe===void 0&&(oe=F.clone(),X[W]=oe,A.addEventListener("dispose",C)),F=oe}return F.visible=A.visible,F.wireframe=A.wireframe,F.side=I===3?A.shadowSide!==null?A.shadowSide:A.side:A.shadowSide!==null?A.shadowSide:u[A.side],F.alphaMap=A.alphaMap,F.alphaTest=A.alphaTest,F.map=A.map,F.clipShadows=A.clipShadows,F.clippingPlanes=A.clippingPlanes,F.clipIntersection=A.clipIntersection,F.displacementMap=A.displacementMap,F.displacementScale=A.displacementScale,F.displacementBias=A.displacementBias,F.wireframeLinewidth=A.wireframeLinewidth,F.linewidth=A.linewidth,N.isPointLight===!0&&F.isMeshDistanceMaterial===!0&&(r.properties.get(F).light=N),F}function M(b,A,N,I,F){if(b.visible===!1)return;if(b.layers.test(A.layers)&&(b.isMesh||b.isLine||b.isPoints)&&(b.castShadow||b.receiveShadow&&F===3)&&(!b.frustumCulled||n.intersectsObject(b))){b.modelViewMatrix.multiplyMatrices(N.matrixWorldInverse,b.matrixWorld);const L=e.update(b),W=b.material;if(Array.isArray(W)){const X=L.groups;for(let oe=0,pe=X.length;oe<pe;oe++){const ne=X[oe],ee=W[ne.materialIndex];if(ee&&ee.visible){const K=_(b,ee,I,F);b.onBeforeShadow(r,b,A,N,L,K,ne),r.renderBufferDirect(N,null,L,K,b,ne),b.onAfterShadow(r,b,A,N,L,K,ne)}}}else if(W.visible){const X=_(b,W,I,F);b.onBeforeShadow(r,b,A,N,L,X,null),r.renderBufferDirect(N,null,L,X,b,null),b.onAfterShadow(r,b,A,N,L,X,null)}}const Y=b.children;for(let L=0,W=Y.length;L<W;L++)M(Y[L],A,N,I,F)}function C(b){b.target.removeEventListener("dispose",C);for(const A in c){const N=c[A],I=b.target.uuid;I in N&&(N[I].dispose(),delete N[I])}}this.render=function(b,A,N){if(f.enabled===!1||f.autoUpdate===!1&&f.needsUpdate===!1||b.length===0)return;const I=r.getRenderTarget(),F=r.getActiveCubeFace(),Y=r.getActiveMipmapLevel(),L=r.state;L.setBlending(0),L.buffers.color.setClear(1,1,1,1),L.buffers.depth.setTest(!0),L.setScissorTest(!1);const W=x!==3&&this.type===3,X=x===3&&this.type!==3;for(let oe=0,pe=b.length;oe<pe;oe++){const ne=b[oe],ee=ne.shadow;if(ee===void 0){console.warn("THREE.WebGLShadowMap:",ne,"has no shadow.");continue}if(ee.autoUpdate===!1&&ee.needsUpdate===!1)continue;i.copy(ee.mapSize);const K=ee.getFrameExtents();if(i.multiply(K),s.copy(ee.mapSize),(i.x>h||i.y>h)&&(i.x>h&&(s.x=Math.floor(h/K.x),i.x=s.x*K.x,ee.mapSize.x=s.x),i.y>h&&(s.y=Math.floor(h/K.y),i.y=s.y*K.y,ee.mapSize.y=s.y)),ee.map===null||W===!0||X===!0){const k=this.type!==3?{minFilter:1003,magFilter:1003}:{};ee.map!==null&&ee.map.dispose(),ee.map=new Pt(i.x,i.y,k),ee.map.texture.name=ne.name+".shadowMap",ee.camera.updateProjectionMatrix()}r.setRenderTarget(ee.map),r.clear();const H=ee.getViewportCount();for(let k=0;k<H;k++){const ce=ee.getViewport(k);a.set(s.x*ce.x,s.y*ce.y,s.x*ce.z,s.y*ce.w),L.viewport(a),ee.updateMatrices(ne,k),n=ee.getFrustum(),M(A,N,ee.camera,ne,this.type)}ee.isPointLightShadow!==!0&&this.type===3&&v(ee,N),ee.needsUpdate=!1}x=this.type,f.needsUpdate=!1,r.setRenderTarget(I,F,Y)}}function ld(r,e,t){const n=t.isWebGL2,i=new function(){let S=!1;const re=new He;let z=null;const G=new He(0,0,0,0);return{setMask:function(se){z===se||S||(r.colorMask(se,se,se,se),z=se)},setLocked:function(se){S=se},setClear:function(se,he,fe,ge,be){be===!0&&(se*=ge,he*=ge,fe*=ge),re.set(se,he,fe,ge),G.equals(re)===!1&&(r.clearColor(se,he,fe,ge),G.copy(re))},reset:function(){S=!1,z=null,G.set(-1,0,0,0)}}},s=new function(){let S=!1,re=null,z=null,G=null;return{setTest:function(se){se?Z(r.DEPTH_TEST):P(r.DEPTH_TEST)},setMask:function(se){re===se||S||(r.depthMask(se),re=se)},setFunc:function(se){if(z!==se){switch(se){case 0:r.depthFunc(r.NEVER);break;case 1:r.depthFunc(r.ALWAYS);break;case 2:r.depthFunc(r.LESS);break;case 3:default:r.depthFunc(r.LEQUAL);break;case 4:r.depthFunc(r.EQUAL);break;case 5:r.depthFunc(r.GEQUAL);break;case 6:r.depthFunc(r.GREATER);break;case 7:r.depthFunc(r.NOTEQUAL)}z=se}},setLocked:function(se){S=se},setClear:function(se){G!==se&&(r.clearDepth(se),G=se)},reset:function(){S=!1,re=null,z=null,G=null}}},a=new function(){let S=!1,re=null,z=null,G=null,se=null,he=null,fe=null,ge=null,be=null;return{setTest:function(_e){S||(_e?Z(r.STENCIL_TEST):P(r.STENCIL_TEST))},setMask:function(_e){re===_e||S||(r.stencilMask(_e),re=_e)},setFunc:function(_e,ve,Re){z===_e&&G===ve&&se===Re||(r.stencilFunc(_e,ve,Re),z=_e,G=ve,se=Re)},setOp:function(_e,ve,Re){he===_e&&fe===ve&&ge===Re||(r.stencilOp(_e,ve,Re),he=_e,fe=ve,ge=Re)},setLocked:function(_e){S=_e},setClear:function(_e){be!==_e&&(r.clearStencil(_e),be=_e)},reset:function(){S=!1,re=null,z=null,G=null,se=null,he=null,fe=null,ge=null,be=null}}},o=new WeakMap,l=new WeakMap;let c={},h={},u=new WeakMap,d=[],p=null,m=!1,g=null,f=null,x=null,v=null,_=null,M=null,C=null,b=new de(0,0,0),A=0,N=!1,I=null,F=null,Y=null,L=null,W=null;const X=r.getParameter(r.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let oe=!1,pe=0;const ne=r.getParameter(r.VERSION);ne.indexOf("WebGL")!==-1?(pe=parseFloat(/^WebGL (\d)/.exec(ne)[1]),oe=pe>=1):ne.indexOf("OpenGL ES")!==-1&&(pe=parseFloat(/^OpenGL ES (\d)/.exec(ne)[1]),oe=pe>=2);let ee=null,K={};const H=r.getParameter(r.SCISSOR_BOX),k=r.getParameter(r.VIEWPORT),ce=new He().fromArray(H),E=new He().fromArray(k);function T(S,re,z,G){const se=new Uint8Array(4),he=r.createTexture();r.bindTexture(S,he),r.texParameteri(S,r.TEXTURE_MIN_FILTER,r.NEAREST),r.texParameteri(S,r.TEXTURE_MAG_FILTER,r.NEAREST);for(let fe=0;fe<z;fe++)!n||S!==r.TEXTURE_3D&&S!==r.TEXTURE_2D_ARRAY?r.texImage2D(re+fe,0,r.RGBA,1,1,0,r.RGBA,r.UNSIGNED_BYTE,se):r.texImage3D(re,0,r.RGBA,1,1,G,0,r.RGBA,r.UNSIGNED_BYTE,se);return he}const O={};function Z(S){c[S]!==!0&&(r.enable(S),c[S]=!0)}function P(S){c[S]!==!1&&(r.disable(S),c[S]=!1)}O[r.TEXTURE_2D]=T(r.TEXTURE_2D,r.TEXTURE_2D,1),O[r.TEXTURE_CUBE_MAP]=T(r.TEXTURE_CUBE_MAP,r.TEXTURE_CUBE_MAP_POSITIVE_X,6),n&&(O[r.TEXTURE_2D_ARRAY]=T(r.TEXTURE_2D_ARRAY,r.TEXTURE_2D_ARRAY,1,1),O[r.TEXTURE_3D]=T(r.TEXTURE_3D,r.TEXTURE_3D,1,1)),i.setClear(0,0,0,1),s.setClear(1),a.setClear(0),Z(r.DEPTH_TEST),s.setFunc(3),B(!1),te(1),Z(r.CULL_FACE),D(0);const q={100:r.FUNC_ADD,101:r.FUNC_SUBTRACT,102:r.FUNC_REVERSE_SUBTRACT};if(n)q[103]=r.MIN,q[104]=r.MAX;else{const S=e.get("EXT_blend_minmax");S!==null&&(q[103]=S.MIN_EXT,q[104]=S.MAX_EXT)}const U={200:r.ZERO,201:r.ONE,202:r.SRC_COLOR,204:r.SRC_ALPHA,210:r.SRC_ALPHA_SATURATE,208:r.DST_COLOR,206:r.DST_ALPHA,203:r.ONE_MINUS_SRC_COLOR,205:r.ONE_MINUS_SRC_ALPHA,209:r.ONE_MINUS_DST_COLOR,207:r.ONE_MINUS_DST_ALPHA,211:r.CONSTANT_COLOR,212:r.ONE_MINUS_CONSTANT_COLOR,213:r.CONSTANT_ALPHA,214:r.ONE_MINUS_CONSTANT_ALPHA};function D(S,re,z,G,se,he,fe,ge,be,_e){if(S!==0){if(m===!1&&(Z(r.BLEND),m=!0),S===5)se=se||re,he=he||z,fe=fe||G,re===f&&se===_||(r.blendEquationSeparate(q[re],q[se]),f=re,_=se),z===x&&G===v&&he===M&&fe===C||(r.blendFuncSeparate(U[z],U[G],U[he],U[fe]),x=z,v=G,M=he,C=fe),ge.equals(b)!==!1&&be===A||(r.blendColor(ge.r,ge.g,ge.b,be),b.copy(ge),A=be),g=S,N=!1;else if(S!==g||_e!==N){if(f===100&&_===100||(r.blendEquation(r.FUNC_ADD),f=100,_=100),_e)switch(S){case 1:r.blendFuncSeparate(r.ONE,r.ONE_MINUS_SRC_ALPHA,r.ONE,r.ONE_MINUS_SRC_ALPHA);break;case 2:r.blendFunc(r.ONE,r.ONE);break;case 3:r.blendFuncSeparate(r.ZERO,r.ONE_MINUS_SRC_COLOR,r.ZERO,r.ONE);break;case 4:r.blendFuncSeparate(r.ZERO,r.SRC_COLOR,r.ZERO,r.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",S)}else switch(S){case 1:r.blendFuncSeparate(r.SRC_ALPHA,r.ONE_MINUS_SRC_ALPHA,r.ONE,r.ONE_MINUS_SRC_ALPHA);break;case 2:r.blendFunc(r.SRC_ALPHA,r.ONE);break;case 3:r.blendFuncSeparate(r.ZERO,r.ONE_MINUS_SRC_COLOR,r.ZERO,r.ONE);break;case 4:r.blendFunc(r.ZERO,r.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",S)}x=null,v=null,M=null,C=null,b.set(0,0,0),A=0,g=S,N=_e}}else m===!0&&(P(r.BLEND),m=!1)}function B(S){I!==S&&(S?r.frontFace(r.CW):r.frontFace(r.CCW),I=S)}function te(S){S!==0?(Z(r.CULL_FACE),S!==F&&(S===1?r.cullFace(r.BACK):S===2?r.cullFace(r.FRONT):r.cullFace(r.FRONT_AND_BACK))):P(r.CULL_FACE),F=S}function $(S,re,z){S?(Z(r.POLYGON_OFFSET_FILL),L===re&&W===z||(r.polygonOffset(re,z),L=re,W=z)):P(r.POLYGON_OFFSET_FILL)}return{buffers:{color:i,depth:s,stencil:a},enable:Z,disable:P,bindFramebuffer:function(S,re){return h[S]!==re&&(r.bindFramebuffer(S,re),h[S]=re,n&&(S===r.DRAW_FRAMEBUFFER&&(h[r.FRAMEBUFFER]=re),S===r.FRAMEBUFFER&&(h[r.DRAW_FRAMEBUFFER]=re)),!0)},drawBuffers:function(S,re){let z=d,G=!1;if(S)if(z=u.get(re),z===void 0&&(z=[],u.set(re,z)),S.isWebGLMultipleRenderTargets){const se=S.texture;if(z.length!==se.length||z[0]!==r.COLOR_ATTACHMENT0){for(let he=0,fe=se.length;he<fe;he++)z[he]=r.COLOR_ATTACHMENT0+he;z.length=se.length,G=!0}}else z[0]!==r.COLOR_ATTACHMENT0&&(z[0]=r.COLOR_ATTACHMENT0,G=!0);else z[0]!==r.BACK&&(z[0]=r.BACK,G=!0);G&&(t.isWebGL2?r.drawBuffers(z):e.get("WEBGL_draw_buffers").drawBuffersWEBGL(z))},useProgram:function(S){return p!==S&&(r.useProgram(S),p=S,!0)},setBlending:D,setMaterial:function(S,re){S.side===2?P(r.CULL_FACE):Z(r.CULL_FACE);let z=S.side===1;re&&(z=!z),B(z),S.blending===1&&S.transparent===!1?D(0):D(S.blending,S.blendEquation,S.blendSrc,S.blendDst,S.blendEquationAlpha,S.blendSrcAlpha,S.blendDstAlpha,S.blendColor,S.blendAlpha,S.premultipliedAlpha),s.setFunc(S.depthFunc),s.setTest(S.depthTest),s.setMask(S.depthWrite),i.setMask(S.colorWrite);const G=S.stencilWrite;a.setTest(G),G&&(a.setMask(S.stencilWriteMask),a.setFunc(S.stencilFunc,S.stencilRef,S.stencilFuncMask),a.setOp(S.stencilFail,S.stencilZFail,S.stencilZPass)),$(S.polygonOffset,S.polygonOffsetFactor,S.polygonOffsetUnits),S.alphaToCoverage===!0?Z(r.SAMPLE_ALPHA_TO_COVERAGE):P(r.SAMPLE_ALPHA_TO_COVERAGE)},setFlipSided:B,setCullFace:te,setLineWidth:function(S){S!==Y&&(oe&&r.lineWidth(S),Y=S)},setPolygonOffset:$,setScissorTest:function(S){S?Z(r.SCISSOR_TEST):P(r.SCISSOR_TEST)},activeTexture:function(S){S===void 0&&(S=r.TEXTURE0+X-1),ee!==S&&(r.activeTexture(S),ee=S)},bindTexture:function(S,re,z){z===void 0&&(z=ee===null?r.TEXTURE0+X-1:ee);let G=K[z];G===void 0&&(G={type:void 0,texture:void 0},K[z]=G),G.type===S&&G.texture===re||(ee!==z&&(r.activeTexture(z),ee=z),r.bindTexture(S,re||O[S]),G.type=S,G.texture=re)},unbindTexture:function(){const S=K[ee];S!==void 0&&S.type!==void 0&&(r.bindTexture(S.type,null),S.type=void 0,S.texture=void 0)},compressedTexImage2D:function(){try{r.compressedTexImage2D.apply(r,arguments)}catch(S){console.error("THREE.WebGLState:",S)}},compressedTexImage3D:function(){try{r.compressedTexImage3D.apply(r,arguments)}catch(S){console.error("THREE.WebGLState:",S)}},texImage2D:function(){try{r.texImage2D.apply(r,arguments)}catch(S){console.error("THREE.WebGLState:",S)}},texImage3D:function(){try{r.texImage3D.apply(r,arguments)}catch(S){console.error("THREE.WebGLState:",S)}},updateUBOMapping:function(S,re){let z=l.get(re);z===void 0&&(z=new WeakMap,l.set(re,z));let G=z.get(S);G===void 0&&(G=r.getUniformBlockIndex(re,S.name),z.set(S,G))},uniformBlockBinding:function(S,re){const z=l.get(re).get(S);o.get(re)!==z&&(r.uniformBlockBinding(re,z,S.__bindingPointIndex),o.set(re,z))},texStorage2D:function(){try{r.texStorage2D.apply(r,arguments)}catch(S){console.error("THREE.WebGLState:",S)}},texStorage3D:function(){try{r.texStorage3D.apply(r,arguments)}catch(S){console.error("THREE.WebGLState:",S)}},texSubImage2D:function(){try{r.texSubImage2D.apply(r,arguments)}catch(S){console.error("THREE.WebGLState:",S)}},texSubImage3D:function(){try{r.texSubImage3D.apply(r,arguments)}catch(S){console.error("THREE.WebGLState:",S)}},compressedTexSubImage2D:function(){try{r.compressedTexSubImage2D.apply(r,arguments)}catch(S){console.error("THREE.WebGLState:",S)}},compressedTexSubImage3D:function(){try{r.compressedTexSubImage3D.apply(r,arguments)}catch(S){console.error("THREE.WebGLState:",S)}},scissor:function(S){ce.equals(S)===!1&&(r.scissor(S.x,S.y,S.z,S.w),ce.copy(S))},viewport:function(S){E.equals(S)===!1&&(r.viewport(S.x,S.y,S.z,S.w),E.copy(S))},reset:function(){r.disable(r.BLEND),r.disable(r.CULL_FACE),r.disable(r.DEPTH_TEST),r.disable(r.POLYGON_OFFSET_FILL),r.disable(r.SCISSOR_TEST),r.disable(r.STENCIL_TEST),r.disable(r.SAMPLE_ALPHA_TO_COVERAGE),r.blendEquation(r.FUNC_ADD),r.blendFunc(r.ONE,r.ZERO),r.blendFuncSeparate(r.ONE,r.ZERO,r.ONE,r.ZERO),r.blendColor(0,0,0,0),r.colorMask(!0,!0,!0,!0),r.clearColor(0,0,0,0),r.depthMask(!0),r.depthFunc(r.LESS),r.clearDepth(1),r.stencilMask(4294967295),r.stencilFunc(r.ALWAYS,0,4294967295),r.stencilOp(r.KEEP,r.KEEP,r.KEEP),r.clearStencil(0),r.cullFace(r.BACK),r.frontFace(r.CCW),r.polygonOffset(0,0),r.activeTexture(r.TEXTURE0),r.bindFramebuffer(r.FRAMEBUFFER,null),n===!0&&(r.bindFramebuffer(r.DRAW_FRAMEBUFFER,null),r.bindFramebuffer(r.READ_FRAMEBUFFER,null)),r.useProgram(null),r.lineWidth(1),r.scissor(0,0,r.canvas.width,r.canvas.height),r.viewport(0,0,r.canvas.width,r.canvas.height),c={},ee=null,K={},h={},u=new WeakMap,d=[],p=null,m=!1,g=null,f=null,x=null,v=null,_=null,M=null,C=null,b=new de(0,0,0),A=0,N=!1,I=null,F=null,Y=null,L=null,W=null,ce.set(0,0,r.canvas.width,r.canvas.height),E.set(0,0,r.canvas.width,r.canvas.height),i.reset(),s.reset(),a.reset()}}}function cd(r,e,t,n,i,s,a){const o=i.isWebGL2,l=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator<"u"&&/OculusBrowser/g.test(navigator.userAgent),h=new WeakMap;let u;const d=new WeakMap;let p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function m(E,T){return p?new OffscreenCanvas(E,T):wi("canvas")}function g(E,T,O,Z){let P=1;if((E.width>Z||E.height>Z)&&(P=Z/Math.max(E.width,E.height)),P<1||T===!0){if(typeof HTMLImageElement<"u"&&E instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&E instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&E instanceof ImageBitmap){const q=T?cr:Math.floor,U=q(P*E.width),D=q(P*E.height);u===void 0&&(u=m(U,D));const B=O?m(U,D):u;return B.width=U,B.height=D,B.getContext("2d").drawImage(E,0,0,U,D),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+E.width+"x"+E.height+") to ("+U+"x"+D+")."),B}return"data"in E&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+E.width+"x"+E.height+")."),E}return E}function f(E){return Bs(E.width)&&Bs(E.height)}function x(E,T){return E.generateMipmaps&&T&&E.minFilter!==1003&&E.minFilter!==1006}function v(E){r.generateMipmap(E)}function _(E,T,O,Z,P=!1){if(o===!1)return T;if(E!==null){if(r[E]!==void 0)return r[E];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+E+"'")}let q=T;if(T===r.RED&&(O===r.FLOAT&&(q=r.R32F),O===r.HALF_FLOAT&&(q=r.R16F),O===r.UNSIGNED_BYTE&&(q=r.R8)),T===r.RED_INTEGER&&(O===r.UNSIGNED_BYTE&&(q=r.R8UI),O===r.UNSIGNED_SHORT&&(q=r.R16UI),O===r.UNSIGNED_INT&&(q=r.R32UI),O===r.BYTE&&(q=r.R8I),O===r.SHORT&&(q=r.R16I),O===r.INT&&(q=r.R32I)),T===r.RG&&(O===r.FLOAT&&(q=r.RG32F),O===r.HALF_FLOAT&&(q=r.RG16F),O===r.UNSIGNED_BYTE&&(q=r.RG8)),T===r.RGBA){const U=P?bi:Ge.getTransfer(Z);O===r.FLOAT&&(q=r.RGBA32F),O===r.HALF_FLOAT&&(q=r.RGBA16F),O===r.UNSIGNED_BYTE&&(q=U===ke?r.SRGB8_ALPHA8:r.RGBA8),O===r.UNSIGNED_SHORT_4_4_4_4&&(q=r.RGBA4),O===r.UNSIGNED_SHORT_5_5_5_1&&(q=r.RGB5_A1)}return q!==r.R16F&&q!==r.R32F&&q!==r.RG16F&&q!==r.RG32F&&q!==r.RGBA16F&&q!==r.RGBA32F||e.get("EXT_color_buffer_float"),q}function M(E,T,O){return x(E,O)===!0||E.isFramebufferTexture&&E.minFilter!==1003&&E.minFilter!==1006?Math.log2(Math.max(T.width,T.height))+1:E.mipmaps!==void 0&&E.mipmaps.length>0?E.mipmaps.length:E.isCompressedTexture&&Array.isArray(E.image)?T.mipmaps.length:1}function C(E){return E===1003||E===1004||E===1005?r.NEAREST:r.LINEAR}function b(E){const T=E.target;T.removeEventListener("dispose",b),(function(O){const Z=n.get(O);if(Z.__webglInit===void 0)return;const P=O.source,q=d.get(P);if(q){const U=q[Z.__cacheKey];U.usedTimes--,U.usedTimes===0&&N(O),Object.keys(q).length===0&&d.delete(P)}n.remove(O)})(T),T.isVideoTexture&&h.delete(T)}function A(E){const T=E.target;T.removeEventListener("dispose",A),(function(O){const Z=O.texture,P=n.get(O),q=n.get(Z);if(q.__webglTexture!==void 0&&(r.deleteTexture(q.__webglTexture),a.memory.textures--),O.depthTexture&&O.depthTexture.dispose(),O.isWebGLCubeRenderTarget)for(let U=0;U<6;U++){if(Array.isArray(P.__webglFramebuffer[U]))for(let D=0;D<P.__webglFramebuffer[U].length;D++)r.deleteFramebuffer(P.__webglFramebuffer[U][D]);else r.deleteFramebuffer(P.__webglFramebuffer[U]);P.__webglDepthbuffer&&r.deleteRenderbuffer(P.__webglDepthbuffer[U])}else{if(Array.isArray(P.__webglFramebuffer))for(let U=0;U<P.__webglFramebuffer.length;U++)r.deleteFramebuffer(P.__webglFramebuffer[U]);else r.deleteFramebuffer(P.__webglFramebuffer);if(P.__webglDepthbuffer&&r.deleteRenderbuffer(P.__webglDepthbuffer),P.__webglMultisampledFramebuffer&&r.deleteFramebuffer(P.__webglMultisampledFramebuffer),P.__webglColorRenderbuffer)for(let U=0;U<P.__webglColorRenderbuffer.length;U++)P.__webglColorRenderbuffer[U]&&r.deleteRenderbuffer(P.__webglColorRenderbuffer[U]);P.__webglDepthRenderbuffer&&r.deleteRenderbuffer(P.__webglDepthRenderbuffer)}if(O.isWebGLMultipleRenderTargets)for(let U=0,D=Z.length;U<D;U++){const B=n.get(Z[U]);B.__webglTexture&&(r.deleteTexture(B.__webglTexture),a.memory.textures--),n.remove(Z[U])}n.remove(Z),n.remove(O)})(T)}function N(E){const T=n.get(E);r.deleteTexture(T.__webglTexture);const O=E.source;delete d.get(O)[T.__cacheKey],a.memory.textures--}let I=0;function F(E,T){const O=n.get(E);if(E.isVideoTexture&&(function(Z){const P=a.render.frame;h.get(Z)!==P&&(h.set(Z,P),Z.update())})(E),E.isRenderTargetTexture===!1&&E.version>0&&O.__version!==E.version){const Z=E.image;if(Z===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else{if(Z.complete!==!1)return void pe(O,E,T);console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete")}}t.bindTexture(r.TEXTURE_2D,O.__webglTexture,r.TEXTURE0+T)}const Y={1e3:r.REPEAT,1001:r.CLAMP_TO_EDGE,1002:r.MIRRORED_REPEAT},L={1003:r.NEAREST,1004:r.NEAREST_MIPMAP_NEAREST,1005:r.NEAREST_MIPMAP_LINEAR,1006:r.LINEAR,1007:r.LINEAR_MIPMAP_NEAREST,1008:r.LINEAR_MIPMAP_LINEAR},W={512:r.NEVER,519:r.ALWAYS,513:r.LESS,515:r.LEQUAL,514:r.EQUAL,518:r.GEQUAL,516:r.GREATER,517:r.NOTEQUAL};function X(E,T,O){if(O?(r.texParameteri(E,r.TEXTURE_WRAP_S,Y[T.wrapS]),r.texParameteri(E,r.TEXTURE_WRAP_T,Y[T.wrapT]),E!==r.TEXTURE_3D&&E!==r.TEXTURE_2D_ARRAY||r.texParameteri(E,r.TEXTURE_WRAP_R,Y[T.wrapR]),r.texParameteri(E,r.TEXTURE_MAG_FILTER,L[T.magFilter]),r.texParameteri(E,r.TEXTURE_MIN_FILTER,L[T.minFilter])):(r.texParameteri(E,r.TEXTURE_WRAP_S,r.CLAMP_TO_EDGE),r.texParameteri(E,r.TEXTURE_WRAP_T,r.CLAMP_TO_EDGE),E!==r.TEXTURE_3D&&E!==r.TEXTURE_2D_ARRAY||r.texParameteri(E,r.TEXTURE_WRAP_R,r.CLAMP_TO_EDGE),T.wrapS===1001&&T.wrapT===1001||console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.wrapS and Texture.wrapT should be set to THREE.ClampToEdgeWrapping."),r.texParameteri(E,r.TEXTURE_MAG_FILTER,C(T.magFilter)),r.texParameteri(E,r.TEXTURE_MIN_FILTER,C(T.minFilter)),T.minFilter!==1003&&T.minFilter!==1006&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.minFilter should be set to THREE.NearestFilter or THREE.LinearFilter.")),T.compareFunction&&(r.texParameteri(E,r.TEXTURE_COMPARE_MODE,r.COMPARE_REF_TO_TEXTURE),r.texParameteri(E,r.TEXTURE_COMPARE_FUNC,W[T.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){const Z=e.get("EXT_texture_filter_anisotropic");if(T.magFilter===1003||T.minFilter!==1005&&T.minFilter!==1008||T.type===1015&&e.has("OES_texture_float_linear")===!1||o===!1&&T.type===1016&&e.has("OES_texture_half_float_linear")===!1)return;(T.anisotropy>1||n.get(T).__currentAnisotropy)&&(r.texParameterf(E,Z.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(T.anisotropy,i.getMaxAnisotropy())),n.get(T).__currentAnisotropy=T.anisotropy)}}function oe(E,T){let O=!1;E.__webglInit===void 0&&(E.__webglInit=!0,T.addEventListener("dispose",b));const Z=T.source;let P=d.get(Z);P===void 0&&(P={},d.set(Z,P));const q=(function(U){const D=[];return D.push(U.wrapS),D.push(U.wrapT),D.push(U.wrapR||0),D.push(U.magFilter),D.push(U.minFilter),D.push(U.anisotropy),D.push(U.internalFormat),D.push(U.format),D.push(U.type),D.push(U.generateMipmaps),D.push(U.premultiplyAlpha),D.push(U.flipY),D.push(U.unpackAlignment),D.push(U.colorSpace),D.join()})(T);if(q!==E.__cacheKey){P[q]===void 0&&(P[q]={texture:r.createTexture(),usedTimes:0},a.memory.textures++,O=!0),P[q].usedTimes++;const U=P[E.__cacheKey];U!==void 0&&(P[E.__cacheKey].usedTimes--,U.usedTimes===0&&N(T)),E.__cacheKey=q,E.__webglTexture=P[q].texture}return O}function pe(E,T,O){let Z=r.TEXTURE_2D;(T.isDataArrayTexture||T.isCompressedArrayTexture)&&(Z=r.TEXTURE_2D_ARRAY),T.isData3DTexture&&(Z=r.TEXTURE_3D);const P=oe(E,T),q=T.source;t.bindTexture(Z,E.__webglTexture,r.TEXTURE0+O);const U=n.get(q);if(q.version!==U.__version||P===!0){t.activeTexture(r.TEXTURE0+O);const D=Ge.getPrimaries(Ge.workingColorSpace),B=T.colorSpace===""?null:Ge.getPrimaries(T.colorSpace),te=T.colorSpace===""||D===B?r.NONE:r.BROWSER_DEFAULT_WEBGL;r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,T.flipY),r.pixelStorei(r.UNPACK_PREMULTIPLY_ALPHA_WEBGL,T.premultiplyAlpha),r.pixelStorei(r.UNPACK_ALIGNMENT,T.unpackAlignment),r.pixelStorei(r.UNPACK_COLORSPACE_CONVERSION_WEBGL,te);const $=(function(ve){return!o&&(ve.wrapS!==1001||ve.wrapT!==1001||ve.minFilter!==1003&&ve.minFilter!==1006)})(T)&&f(T.image)===!1;let S=g(T.image,$,!1,i.maxTextureSize);S=ce(T,S);const re=f(S)||o,z=s.convert(T.format,T.colorSpace);let G,se=s.convert(T.type),he=_(T.internalFormat,z,se,T.colorSpace,T.isVideoTexture);X(Z,T,re);const fe=T.mipmaps,ge=o&&T.isVideoTexture!==!0&&he!==36196,be=U.__version===void 0||P===!0,_e=M(T,S,re);if(T.isDepthTexture)he=r.DEPTH_COMPONENT,o?he=T.type===1015?r.DEPTH_COMPONENT32F:T.type===1014?r.DEPTH_COMPONENT24:T.type===1020?r.DEPTH24_STENCIL8:r.DEPTH_COMPONENT16:T.type===1015&&console.error("WebGLRenderer: Floating point depth texture requires WebGL2."),T.format===1026&&he===r.DEPTH_COMPONENT&&T.type!==1012&&T.type!==1014&&(console.warn("THREE.WebGLRenderer: Use UnsignedShortType or UnsignedIntType for DepthFormat DepthTexture."),T.type=1014,se=s.convert(T.type)),T.format===1027&&he===r.DEPTH_COMPONENT&&(he=r.DEPTH_STENCIL,T.type!==1020&&(console.warn("THREE.WebGLRenderer: Use UnsignedInt248Type for DepthStencilFormat DepthTexture."),T.type=1020,se=s.convert(T.type))),be&&(ge?t.texStorage2D(r.TEXTURE_2D,1,he,S.width,S.height):t.texImage2D(r.TEXTURE_2D,0,he,S.width,S.height,0,z,se,null));else if(T.isDataTexture)if(fe.length>0&&re){ge&&be&&t.texStorage2D(r.TEXTURE_2D,_e,he,fe[0].width,fe[0].height);for(let ve=0,Re=fe.length;ve<Re;ve++)G=fe[ve],ge?t.texSubImage2D(r.TEXTURE_2D,ve,0,0,G.width,G.height,z,se,G.data):t.texImage2D(r.TEXTURE_2D,ve,he,G.width,G.height,0,z,se,G.data);T.generateMipmaps=!1}else ge?(be&&t.texStorage2D(r.TEXTURE_2D,_e,he,S.width,S.height),t.texSubImage2D(r.TEXTURE_2D,0,0,0,S.width,S.height,z,se,S.data)):t.texImage2D(r.TEXTURE_2D,0,he,S.width,S.height,0,z,se,S.data);else if(T.isCompressedTexture)if(T.isCompressedArrayTexture){ge&&be&&t.texStorage3D(r.TEXTURE_2D_ARRAY,_e,he,fe[0].width,fe[0].height,S.depth);for(let ve=0,Re=fe.length;ve<Re;ve++)G=fe[ve],T.format!==1023?z!==null?ge?t.compressedTexSubImage3D(r.TEXTURE_2D_ARRAY,ve,0,0,0,G.width,G.height,S.depth,z,G.data,0,0):t.compressedTexImage3D(r.TEXTURE_2D_ARRAY,ve,he,G.width,G.height,S.depth,0,G.data,0,0):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):ge?t.texSubImage3D(r.TEXTURE_2D_ARRAY,ve,0,0,0,G.width,G.height,S.depth,z,se,G.data):t.texImage3D(r.TEXTURE_2D_ARRAY,ve,he,G.width,G.height,S.depth,0,z,se,G.data)}else{ge&&be&&t.texStorage2D(r.TEXTURE_2D,_e,he,fe[0].width,fe[0].height);for(let ve=0,Re=fe.length;ve<Re;ve++)G=fe[ve],T.format!==1023?z!==null?ge?t.compressedTexSubImage2D(r.TEXTURE_2D,ve,0,0,G.width,G.height,z,G.data):t.compressedTexImage2D(r.TEXTURE_2D,ve,he,G.width,G.height,0,G.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):ge?t.texSubImage2D(r.TEXTURE_2D,ve,0,0,G.width,G.height,z,se,G.data):t.texImage2D(r.TEXTURE_2D,ve,he,G.width,G.height,0,z,se,G.data)}else if(T.isDataArrayTexture)ge?(be&&t.texStorage3D(r.TEXTURE_2D_ARRAY,_e,he,S.width,S.height,S.depth),t.texSubImage3D(r.TEXTURE_2D_ARRAY,0,0,0,0,S.width,S.height,S.depth,z,se,S.data)):t.texImage3D(r.TEXTURE_2D_ARRAY,0,he,S.width,S.height,S.depth,0,z,se,S.data);else if(T.isData3DTexture)ge?(be&&t.texStorage3D(r.TEXTURE_3D,_e,he,S.width,S.height,S.depth),t.texSubImage3D(r.TEXTURE_3D,0,0,0,0,S.width,S.height,S.depth,z,se,S.data)):t.texImage3D(r.TEXTURE_3D,0,he,S.width,S.height,S.depth,0,z,se,S.data);else if(T.isFramebufferTexture){if(be)if(ge)t.texStorage2D(r.TEXTURE_2D,_e,he,S.width,S.height);else{let ve=S.width,Re=S.height;for(let rt=0;rt<_e;rt++)t.texImage2D(r.TEXTURE_2D,rt,he,ve,Re,0,z,se,null),ve>>=1,Re>>=1}}else if(fe.length>0&&re){ge&&be&&t.texStorage2D(r.TEXTURE_2D,_e,he,fe[0].width,fe[0].height);for(let ve=0,Re=fe.length;ve<Re;ve++)G=fe[ve],ge?t.texSubImage2D(r.TEXTURE_2D,ve,0,0,z,se,G):t.texImage2D(r.TEXTURE_2D,ve,he,z,se,G);T.generateMipmaps=!1}else ge?(be&&t.texStorage2D(r.TEXTURE_2D,_e,he,S.width,S.height),t.texSubImage2D(r.TEXTURE_2D,0,0,0,z,se,S)):t.texImage2D(r.TEXTURE_2D,0,he,z,se,S);x(T,re)&&v(Z),U.__version=q.version,T.onUpdate&&T.onUpdate(T)}E.__version=T.version}function ne(E,T,O,Z,P,q){const U=s.convert(O.format,O.colorSpace),D=s.convert(O.type),B=_(O.internalFormat,U,D,O.colorSpace);if(!n.get(T).__hasExternalTextures){const te=Math.max(1,T.width>>q),$=Math.max(1,T.height>>q);P===r.TEXTURE_3D||P===r.TEXTURE_2D_ARRAY?t.texImage3D(P,q,B,te,$,T.depth,0,U,D,null):t.texImage2D(P,q,B,te,$,0,U,D,null)}t.bindFramebuffer(r.FRAMEBUFFER,E),k(T)?l.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,Z,P,n.get(O).__webglTexture,0,H(T)):(P===r.TEXTURE_2D||P>=r.TEXTURE_CUBE_MAP_POSITIVE_X&&P<=r.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&r.framebufferTexture2D(r.FRAMEBUFFER,Z,P,n.get(O).__webglTexture,q),t.bindFramebuffer(r.FRAMEBUFFER,null)}function ee(E,T,O){if(r.bindRenderbuffer(r.RENDERBUFFER,E),T.depthBuffer&&!T.stencilBuffer){let Z=o===!0?r.DEPTH_COMPONENT24:r.DEPTH_COMPONENT16;if(O||k(T)){const P=T.depthTexture;P&&P.isDepthTexture&&(P.type===1015?Z=r.DEPTH_COMPONENT32F:P.type===1014&&(Z=r.DEPTH_COMPONENT24));const q=H(T);k(T)?l.renderbufferStorageMultisampleEXT(r.RENDERBUFFER,q,Z,T.width,T.height):r.renderbufferStorageMultisample(r.RENDERBUFFER,q,Z,T.width,T.height)}else r.renderbufferStorage(r.RENDERBUFFER,Z,T.width,T.height);r.framebufferRenderbuffer(r.FRAMEBUFFER,r.DEPTH_ATTACHMENT,r.RENDERBUFFER,E)}else if(T.depthBuffer&&T.stencilBuffer){const Z=H(T);O&&k(T)===!1?r.renderbufferStorageMultisample(r.RENDERBUFFER,Z,r.DEPTH24_STENCIL8,T.width,T.height):k(T)?l.renderbufferStorageMultisampleEXT(r.RENDERBUFFER,Z,r.DEPTH24_STENCIL8,T.width,T.height):r.renderbufferStorage(r.RENDERBUFFER,r.DEPTH_STENCIL,T.width,T.height),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.DEPTH_STENCIL_ATTACHMENT,r.RENDERBUFFER,E)}else{const Z=T.isWebGLMultipleRenderTargets===!0?T.texture:[T.texture];for(let P=0;P<Z.length;P++){const q=Z[P],U=s.convert(q.format,q.colorSpace),D=s.convert(q.type),B=_(q.internalFormat,U,D,q.colorSpace),te=H(T);O&&k(T)===!1?r.renderbufferStorageMultisample(r.RENDERBUFFER,te,B,T.width,T.height):k(T)?l.renderbufferStorageMultisampleEXT(r.RENDERBUFFER,te,B,T.width,T.height):r.renderbufferStorage(r.RENDERBUFFER,B,T.width,T.height)}}r.bindRenderbuffer(r.RENDERBUFFER,null)}function K(E){const T=n.get(E),O=E.isWebGLCubeRenderTarget===!0;if(E.depthTexture&&!T.__autoAllocateDepthBuffer){if(O)throw new Error("target.depthTexture not supported in Cube render targets");(function(Z,P){if(P&&P.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(r.FRAMEBUFFER,Z),!P.depthTexture||!P.depthTexture.isDepthTexture)throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");n.get(P.depthTexture).__webglTexture&&P.depthTexture.image.width===P.width&&P.depthTexture.image.height===P.height||(P.depthTexture.image.width=P.width,P.depthTexture.image.height=P.height,P.depthTexture.needsUpdate=!0),F(P.depthTexture,0);const q=n.get(P.depthTexture).__webglTexture,U=H(P);if(P.depthTexture.format===1026)k(P)?l.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,r.DEPTH_ATTACHMENT,r.TEXTURE_2D,q,0,U):r.framebufferTexture2D(r.FRAMEBUFFER,r.DEPTH_ATTACHMENT,r.TEXTURE_2D,q,0);else{if(P.depthTexture.format!==1027)throw new Error("Unknown depthTexture format");k(P)?l.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,r.DEPTH_STENCIL_ATTACHMENT,r.TEXTURE_2D,q,0,U):r.framebufferTexture2D(r.FRAMEBUFFER,r.DEPTH_STENCIL_ATTACHMENT,r.TEXTURE_2D,q,0)}})(T.__webglFramebuffer,E)}else if(O){T.__webglDepthbuffer=[];for(let Z=0;Z<6;Z++)t.bindFramebuffer(r.FRAMEBUFFER,T.__webglFramebuffer[Z]),T.__webglDepthbuffer[Z]=r.createRenderbuffer(),ee(T.__webglDepthbuffer[Z],E,!1)}else t.bindFramebuffer(r.FRAMEBUFFER,T.__webglFramebuffer),T.__webglDepthbuffer=r.createRenderbuffer(),ee(T.__webglDepthbuffer,E,!1);t.bindFramebuffer(r.FRAMEBUFFER,null)}function H(E){return Math.min(i.maxSamples,E.samples)}function k(E){const T=n.get(E);return o&&E.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&T.__useRenderToTexture!==!1}function ce(E,T){const O=E.colorSpace,Z=E.format,P=E.type;return E.isCompressedTexture===!0||E.isVideoTexture===!0||E.format===1035||O!==Ht&&O!==""&&(Ge.getTransfer(O)===ke?o===!1?e.has("EXT_sRGB")===!0&&Z===1023?(E.format=1035,E.minFilter=1006,E.generateMipmaps=!1):T=Hs.sRGBToLinear(T):Z===1023&&P===1009||console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",O)),T}this.allocateTextureUnit=function(){const E=I;return E>=i.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+E+" texture units while this GPU supports only "+i.maxTextures),I+=1,E},this.resetTextureUnits=function(){I=0},this.setTexture2D=F,this.setTexture2DArray=function(E,T){const O=n.get(E);E.version>0&&O.__version!==E.version?pe(O,E,T):t.bindTexture(r.TEXTURE_2D_ARRAY,O.__webglTexture,r.TEXTURE0+T)},this.setTexture3D=function(E,T){const O=n.get(E);E.version>0&&O.__version!==E.version?pe(O,E,T):t.bindTexture(r.TEXTURE_3D,O.__webglTexture,r.TEXTURE0+T)},this.setTextureCube=function(E,T){const O=n.get(E);E.version>0&&O.__version!==E.version?(function(Z,P,q){if(P.image.length!==6)return;const U=oe(Z,P),D=P.source;t.bindTexture(r.TEXTURE_CUBE_MAP,Z.__webglTexture,r.TEXTURE0+q);const B=n.get(D);if(D.version!==B.__version||U===!0){t.activeTexture(r.TEXTURE0+q);const te=Ge.getPrimaries(Ge.workingColorSpace),$=P.colorSpace===""?null:Ge.getPrimaries(P.colorSpace),S=P.colorSpace===""||te===$?r.NONE:r.BROWSER_DEFAULT_WEBGL;r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,P.flipY),r.pixelStorei(r.UNPACK_PREMULTIPLY_ALPHA_WEBGL,P.premultiplyAlpha),r.pixelStorei(r.UNPACK_ALIGNMENT,P.unpackAlignment),r.pixelStorei(r.UNPACK_COLORSPACE_CONVERSION_WEBGL,S);const re=P.isCompressedTexture||P.image[0].isCompressedTexture,z=P.image[0]&&P.image[0].isDataTexture,G=[];for(let xe=0;xe<6;xe++)G[xe]=re||z?z?P.image[xe].image:P.image[xe]:g(P.image[xe],!1,!0,i.maxCubemapSize),G[xe]=ce(P,G[xe]);const se=G[0],he=f(se)||o,fe=s.convert(P.format,P.colorSpace),ge=s.convert(P.type),be=_(P.internalFormat,fe,ge,P.colorSpace),_e=o&&P.isVideoTexture!==!0,ve=B.__version===void 0||U===!0;let Re,rt=M(P,se,he);if(X(r.TEXTURE_CUBE_MAP,P,he),re){_e&&ve&&t.texStorage2D(r.TEXTURE_CUBE_MAP,rt,be,se.width,se.height);for(let xe=0;xe<6;xe++){Re=G[xe].mipmaps;for(let Ne=0;Ne<Re.length;Ne++){const Pe=Re[Ne];P.format!==1023?fe!==null?_e?t.compressedTexSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+xe,Ne,0,0,Pe.width,Pe.height,fe,Pe.data):t.compressedTexImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+xe,Ne,be,Pe.width,Pe.height,0,Pe.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):_e?t.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+xe,Ne,0,0,Pe.width,Pe.height,fe,ge,Pe.data):t.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+xe,Ne,be,Pe.width,Pe.height,0,fe,ge,Pe.data)}}}else{Re=P.mipmaps,_e&&ve&&(Re.length>0&&rt++,t.texStorage2D(r.TEXTURE_CUBE_MAP,rt,be,G[0].width,G[0].height));for(let xe=0;xe<6;xe++)if(z){_e?t.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+xe,0,0,0,G[xe].width,G[xe].height,fe,ge,G[xe].data):t.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+xe,0,be,G[xe].width,G[xe].height,0,fe,ge,G[xe].data);for(let Ne=0;Ne<Re.length;Ne++){const Pe=Re[Ne].image[xe].image;_e?t.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+xe,Ne+1,0,0,Pe.width,Pe.height,fe,ge,Pe.data):t.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+xe,Ne+1,be,Pe.width,Pe.height,0,fe,ge,Pe.data)}}else{_e?t.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+xe,0,0,0,fe,ge,G[xe]):t.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+xe,0,be,fe,ge,G[xe]);for(let Ne=0;Ne<Re.length;Ne++){const Pe=Re[Ne];_e?t.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+xe,Ne+1,0,0,fe,ge,Pe.image[xe]):t.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+xe,Ne+1,be,fe,ge,Pe.image[xe])}}}x(P,he)&&v(r.TEXTURE_CUBE_MAP),B.__version=D.version,P.onUpdate&&P.onUpdate(P)}Z.__version=P.version})(O,E,T):t.bindTexture(r.TEXTURE_CUBE_MAP,O.__webglTexture,r.TEXTURE0+T)},this.rebindTextures=function(E,T,O){const Z=n.get(E);T!==void 0&&ne(Z.__webglFramebuffer,E,E.texture,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,0),O!==void 0&&K(E)},this.setupRenderTarget=function(E){const T=E.texture,O=n.get(E),Z=n.get(T);E.addEventListener("dispose",A),E.isWebGLMultipleRenderTargets!==!0&&(Z.__webglTexture===void 0&&(Z.__webglTexture=r.createTexture()),Z.__version=T.version,a.memory.textures++);const P=E.isWebGLCubeRenderTarget===!0,q=E.isWebGLMultipleRenderTargets===!0,U=f(E)||o;if(P){O.__webglFramebuffer=[];for(let D=0;D<6;D++)if(o&&T.mipmaps&&T.mipmaps.length>0){O.__webglFramebuffer[D]=[];for(let B=0;B<T.mipmaps.length;B++)O.__webglFramebuffer[D][B]=r.createFramebuffer()}else O.__webglFramebuffer[D]=r.createFramebuffer()}else{if(o&&T.mipmaps&&T.mipmaps.length>0){O.__webglFramebuffer=[];for(let D=0;D<T.mipmaps.length;D++)O.__webglFramebuffer[D]=r.createFramebuffer()}else O.__webglFramebuffer=r.createFramebuffer();if(q)if(i.drawBuffers){const D=E.texture;for(let B=0,te=D.length;B<te;B++){const $=n.get(D[B]);$.__webglTexture===void 0&&($.__webglTexture=r.createTexture(),a.memory.textures++)}}else console.warn("THREE.WebGLRenderer: WebGLMultipleRenderTargets can only be used with WebGL2 or WEBGL_draw_buffers extension.");if(o&&E.samples>0&&k(E)===!1){const D=q?T:[T];O.__webglMultisampledFramebuffer=r.createFramebuffer(),O.__webglColorRenderbuffer=[],t.bindFramebuffer(r.FRAMEBUFFER,O.__webglMultisampledFramebuffer);for(let B=0;B<D.length;B++){const te=D[B];O.__webglColorRenderbuffer[B]=r.createRenderbuffer(),r.bindRenderbuffer(r.RENDERBUFFER,O.__webglColorRenderbuffer[B]);const $=s.convert(te.format,te.colorSpace),S=s.convert(te.type),re=_(te.internalFormat,$,S,te.colorSpace,E.isXRRenderTarget===!0),z=H(E);r.renderbufferStorageMultisample(r.RENDERBUFFER,z,re,E.width,E.height),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+B,r.RENDERBUFFER,O.__webglColorRenderbuffer[B])}r.bindRenderbuffer(r.RENDERBUFFER,null),E.depthBuffer&&(O.__webglDepthRenderbuffer=r.createRenderbuffer(),ee(O.__webglDepthRenderbuffer,E,!0)),t.bindFramebuffer(r.FRAMEBUFFER,null)}}if(P){t.bindTexture(r.TEXTURE_CUBE_MAP,Z.__webglTexture),X(r.TEXTURE_CUBE_MAP,T,U);for(let D=0;D<6;D++)if(o&&T.mipmaps&&T.mipmaps.length>0)for(let B=0;B<T.mipmaps.length;B++)ne(O.__webglFramebuffer[D][B],E,T,r.COLOR_ATTACHMENT0,r.TEXTURE_CUBE_MAP_POSITIVE_X+D,B);else ne(O.__webglFramebuffer[D],E,T,r.COLOR_ATTACHMENT0,r.TEXTURE_CUBE_MAP_POSITIVE_X+D,0);x(T,U)&&v(r.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(q){const D=E.texture;for(let B=0,te=D.length;B<te;B++){const $=D[B],S=n.get($);t.bindTexture(r.TEXTURE_2D,S.__webglTexture),X(r.TEXTURE_2D,$,U),ne(O.__webglFramebuffer,E,$,r.COLOR_ATTACHMENT0+B,r.TEXTURE_2D,0),x($,U)&&v(r.TEXTURE_2D)}t.unbindTexture()}else{let D=r.TEXTURE_2D;if((E.isWebGL3DRenderTarget||E.isWebGLArrayRenderTarget)&&(o?D=E.isWebGL3DRenderTarget?r.TEXTURE_3D:r.TEXTURE_2D_ARRAY:console.error("THREE.WebGLTextures: THREE.Data3DTexture and THREE.DataArrayTexture only supported with WebGL2.")),t.bindTexture(D,Z.__webglTexture),X(D,T,U),o&&T.mipmaps&&T.mipmaps.length>0)for(let B=0;B<T.mipmaps.length;B++)ne(O.__webglFramebuffer[B],E,T,r.COLOR_ATTACHMENT0,D,B);else ne(O.__webglFramebuffer,E,T,r.COLOR_ATTACHMENT0,D,0);x(T,U)&&v(D),t.unbindTexture()}E.depthBuffer&&K(E)},this.updateRenderTargetMipmap=function(E){const T=f(E)||o,O=E.isWebGLMultipleRenderTargets===!0?E.texture:[E.texture];for(let Z=0,P=O.length;Z<P;Z++){const q=O[Z];if(x(q,T)){const U=E.isWebGLCubeRenderTarget?r.TEXTURE_CUBE_MAP:r.TEXTURE_2D,D=n.get(q).__webglTexture;t.bindTexture(U,D),v(U),t.unbindTexture()}}},this.updateMultisampleRenderTarget=function(E){if(o&&E.samples>0&&k(E)===!1){const T=E.isWebGLMultipleRenderTargets?E.texture:[E.texture],O=E.width,Z=E.height;let P=r.COLOR_BUFFER_BIT;const q=[],U=E.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,D=n.get(E),B=E.isWebGLMultipleRenderTargets===!0;if(B)for(let te=0;te<T.length;te++)t.bindFramebuffer(r.FRAMEBUFFER,D.__webglMultisampledFramebuffer),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+te,r.RENDERBUFFER,null),t.bindFramebuffer(r.FRAMEBUFFER,D.__webglFramebuffer),r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0+te,r.TEXTURE_2D,null,0);t.bindFramebuffer(r.READ_FRAMEBUFFER,D.__webglMultisampledFramebuffer),t.bindFramebuffer(r.DRAW_FRAMEBUFFER,D.__webglFramebuffer);for(let te=0;te<T.length;te++){q.push(r.COLOR_ATTACHMENT0+te),E.depthBuffer&&q.push(U);const $=D.__ignoreDepthValues!==void 0&&D.__ignoreDepthValues;if($===!1&&(E.depthBuffer&&(P|=r.DEPTH_BUFFER_BIT),E.stencilBuffer&&(P|=r.STENCIL_BUFFER_BIT)),B&&r.framebufferRenderbuffer(r.READ_FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.RENDERBUFFER,D.__webglColorRenderbuffer[te]),$===!0&&(r.invalidateFramebuffer(r.READ_FRAMEBUFFER,[U]),r.invalidateFramebuffer(r.DRAW_FRAMEBUFFER,[U])),B){const S=n.get(T[te]).__webglTexture;r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,S,0)}r.blitFramebuffer(0,0,O,Z,0,0,O,Z,P,r.NEAREST),c&&r.invalidateFramebuffer(r.READ_FRAMEBUFFER,q)}if(t.bindFramebuffer(r.READ_FRAMEBUFFER,null),t.bindFramebuffer(r.DRAW_FRAMEBUFFER,null),B)for(let te=0;te<T.length;te++){t.bindFramebuffer(r.FRAMEBUFFER,D.__webglMultisampledFramebuffer),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+te,r.RENDERBUFFER,D.__webglColorRenderbuffer[te]);const $=n.get(T[te]).__webglTexture;t.bindFramebuffer(r.FRAMEBUFFER,D.__webglFramebuffer),r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0+te,r.TEXTURE_2D,$,0)}t.bindFramebuffer(r.DRAW_FRAMEBUFFER,D.__webglMultisampledFramebuffer)}},this.setupDepthRenderbuffer=K,this.setupFrameBufferTexture=ne,this.useMultisampledRTT=k}function cl(r,e,t){const n=t.isWebGL2;return{convert:function(i,s=""){let a;const o=Ge.getTransfer(s);if(i===1009)return r.UNSIGNED_BYTE;if(i===1017)return r.UNSIGNED_SHORT_4_4_4_4;if(i===1018)return r.UNSIGNED_SHORT_5_5_5_1;if(i===1010)return r.BYTE;if(i===1011)return r.SHORT;if(i===1012)return r.UNSIGNED_SHORT;if(i===1013)return r.INT;if(i===1014)return r.UNSIGNED_INT;if(i===1015)return r.FLOAT;if(i===1016)return n?r.HALF_FLOAT:(a=e.get("OES_texture_half_float"),a!==null?a.HALF_FLOAT_OES:null);if(i===1021)return r.ALPHA;if(i===1023)return r.RGBA;if(i===1024)return r.LUMINANCE;if(i===1025)return r.LUMINANCE_ALPHA;if(i===1026)return r.DEPTH_COMPONENT;if(i===1027)return r.DEPTH_STENCIL;if(i===1035)return a=e.get("EXT_sRGB"),a!==null?a.SRGB_ALPHA_EXT:null;if(i===1028)return r.RED;if(i===1029)return r.RED_INTEGER;if(i===1030)return r.RG;if(i===1031)return r.RG_INTEGER;if(i===1033)return r.RGBA_INTEGER;if(i===33776||i===33777||i===33778||i===33779)if(o===ke){if(a=e.get("WEBGL_compressed_texture_s3tc_srgb"),a===null)return null;if(i===33776)return a.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===33777)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===33778)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===33779)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else{if(a=e.get("WEBGL_compressed_texture_s3tc"),a===null)return null;if(i===33776)return a.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===33777)return a.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===33778)return a.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===33779)return a.COMPRESSED_RGBA_S3TC_DXT5_EXT}if(i===35840||i===35841||i===35842||i===35843){if(a=e.get("WEBGL_compressed_texture_pvrtc"),a===null)return null;if(i===35840)return a.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===35841)return a.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===35842)return a.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===35843)return a.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}if(i===36196)return a=e.get("WEBGL_compressed_texture_etc1"),a!==null?a.COMPRESSED_RGB_ETC1_WEBGL:null;if(i===37492||i===37496){if(a=e.get("WEBGL_compressed_texture_etc"),a===null)return null;if(i===37492)return o===ke?a.COMPRESSED_SRGB8_ETC2:a.COMPRESSED_RGB8_ETC2;if(i===37496)return o===ke?a.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:a.COMPRESSED_RGBA8_ETC2_EAC}if(i===37808||i===37809||i===37810||i===37811||i===37812||i===37813||i===37814||i===37815||i===37816||i===37817||i===37818||i===37819||i===37820||i===37821){if(a=e.get("WEBGL_compressed_texture_astc"),a===null)return null;if(i===37808)return o===ke?a.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:a.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===37809)return o===ke?a.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:a.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===37810)return o===ke?a.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:a.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===37811)return o===ke?a.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:a.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===37812)return o===ke?a.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:a.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===37813)return o===ke?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:a.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===37814)return o===ke?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:a.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===37815)return o===ke?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:a.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===37816)return o===ke?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:a.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===37817)return o===ke?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:a.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===37818)return o===ke?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:a.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===37819)return o===ke?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:a.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===37820)return o===ke?a.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:a.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===37821)return o===ke?a.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:a.COMPRESSED_RGBA_ASTC_12x12_KHR}if(i===36492||i===36494||i===36495){if(a=e.get("EXT_texture_compression_bptc"),a===null)return null;if(i===36492)return o===ke?a.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:a.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===36494)return a.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===36495)return a.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}if(i===36283||i===36284||i===36285||i===36286){if(a=e.get("EXT_texture_compression_rgtc"),a===null)return null;if(i===36492)return a.COMPRESSED_RED_RGTC1_EXT;if(i===36284)return a.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===36285)return a.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===36286)return a.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}return i===1020?n?r.UNSIGNED_INT_24_8:(a=e.get("WEBGL_depth_texture"),a!==null?a.UNSIGNED_INT_24_8_WEBGL:null):r[i]!==void 0?r[i]:null}}}class hl extends st{constructor(e=[]){super(),this.isArrayCamera=!0,this.cameras=e}}class ci extends Be{constructor(){super(),this.isGroup=!0,this.type="Group"}}const hd={type:"move"};class _a{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new ci,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new ci,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new w,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new w),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new ci,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new w,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new w),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let i=null,s=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(const g of e.hand.values()){const f=t.getJointPose(g,n),x=this._getHandJoint(c,g);f!==null&&(x.matrix.fromArray(f.transform.matrix),x.matrix.decompose(x.position,x.rotation,x.scale),x.matrixWorldNeedsUpdate=!0,x.jointRadius=f.radius),x.visible=f!==null}const h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],d=h.position.distanceTo(u.position),p=.02,m=.005;c.inputState.pinching&&d>p+m?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=p-m&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,n),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(i=t.getPose(e.targetRaySpace,n),i===null&&s!==null&&(i=s),i!==null&&(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,i.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(i.linearVelocity)):o.hasLinearVelocity=!1,i.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(i.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(hd)))}return o!==null&&(o.visible=i!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new ci;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}class ud extends qt{constructor(e,t){super();const n=this;let i=null,s=1,a=null,o="local-floor",l=1,c=null,h=null,u=null,d=null,p=null,m=null;const g=t.getContextAttributes();let f=null,x=null;const v=[],_=[],M=new ie;let C=null;const b=new st;b.layers.enable(1),b.viewport=new He;const A=new st;A.layers.enable(2),A.viewport=new He;const N=[b,A],I=new hl;I.layers.enable(1),I.layers.enable(2);let F=null,Y=null;function L(H){const k=_.indexOf(H.inputSource);if(k===-1)return;const ce=v[k];ce!==void 0&&(ce.update(H.inputSource,H.frame,c||a),ce.dispatchEvent({type:H.type,data:H.inputSource}))}function W(){i.removeEventListener("select",L),i.removeEventListener("selectstart",L),i.removeEventListener("selectend",L),i.removeEventListener("squeeze",L),i.removeEventListener("squeezestart",L),i.removeEventListener("squeezeend",L),i.removeEventListener("end",W),i.removeEventListener("inputsourceschange",X);for(let H=0;H<v.length;H++){const k=_[H];k!==null&&(_[H]=null,v[H].disconnect(k))}F=null,Y=null,e.setRenderTarget(f),p=null,d=null,u=null,i=null,x=null,K.stop(),n.isPresenting=!1,e.setPixelRatio(C),e.setSize(M.width,M.height,!1),n.dispatchEvent({type:"sessionend"})}function X(H){for(let k=0;k<H.removed.length;k++){const ce=H.removed[k],E=_.indexOf(ce);E>=0&&(_[E]=null,v[E].disconnect(ce))}for(let k=0;k<H.added.length;k++){const ce=H.added[k];let E=_.indexOf(ce);if(E===-1){for(let O=0;O<v.length;O++){if(O>=_.length){_.push(ce),E=O;break}if(_[O]===null){_[O]=ce,E=O;break}}if(E===-1)break}const T=v[E];T&&T.connect(ce)}}this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(H){let k=v[H];return k===void 0&&(k=new _a,v[H]=k),k.getTargetRaySpace()},this.getControllerGrip=function(H){let k=v[H];return k===void 0&&(k=new _a,v[H]=k),k.getGripSpace()},this.getHand=function(H){let k=v[H];return k===void 0&&(k=new _a,v[H]=k),k.getHandSpace()},this.setFramebufferScaleFactor=function(H){s=H,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(H){o=H,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(H){c=H},this.getBaseLayer=function(){return d!==null?d:p},this.getBinding=function(){return u},this.getFrame=function(){return m},this.getSession=function(){return i},this.setSession=async function(H){if(i=H,i!==null){if(f=e.getRenderTarget(),i.addEventListener("select",L),i.addEventListener("selectstart",L),i.addEventListener("selectend",L),i.addEventListener("squeeze",L),i.addEventListener("squeezestart",L),i.addEventListener("squeezeend",L),i.addEventListener("end",W),i.addEventListener("inputsourceschange",X),g.xrCompatible!==!0&&await t.makeXRCompatible(),C=e.getPixelRatio(),e.getSize(M),i.renderState.layers===void 0||e.capabilities.isWebGL2===!1){const k={antialias:i.renderState.layers!==void 0||g.antialias,alpha:!0,depth:g.depth,stencil:g.stencil,framebufferScaleFactor:s};p=new XRWebGLLayer(i,t,k),i.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),x=new Pt(p.framebufferWidth,p.framebufferHeight,{format:1023,type:1009,colorSpace:e.outputColorSpace,stencilBuffer:g.stencil})}else{let k=null,ce=null,E=null;g.depth&&(E=g.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,k=g.stencil?1027:1026,ce=g.stencil?1020:1014);const T={colorFormat:t.RGBA8,depthFormat:E,scaleFactor:s};u=new XRWebGLBinding(i,t),d=u.createProjectionLayer(T),i.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),x=new Pt(d.textureWidth,d.textureHeight,{format:1023,type:1009,depthTexture:new da(d.textureWidth,d.textureHeight,ce,void 0,void 0,void 0,void 0,void 0,void 0,k),stencilBuffer:g.stencil,colorSpace:e.outputColorSpace,samples:g.antialias?4:0}),e.properties.get(x).__ignoreDepthValues=d.ignoreDepthValues}x.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await i.requestReferenceSpace(o),K.setContext(i),K.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode};const oe=new w,pe=new w;function ne(H,k){k===null?H.matrixWorld.copy(H.matrix):H.matrixWorld.multiplyMatrices(k.matrixWorld,H.matrix),H.matrixWorldInverse.copy(H.matrixWorld).invert()}this.updateCamera=function(H){if(i===null)return;I.near=A.near=b.near=H.near,I.far=A.far=b.far=H.far,F===I.near&&Y===I.far||(i.updateRenderState({depthNear:I.near,depthFar:I.far}),F=I.near,Y=I.far);const k=H.parent,ce=I.cameras;ne(I,k);for(let E=0;E<ce.length;E++)ne(ce[E],k);ce.length===2?(function(E,T,O){oe.setFromMatrixPosition(T.matrixWorld),pe.setFromMatrixPosition(O.matrixWorld);const Z=oe.distanceTo(pe),P=T.projectionMatrix.elements,q=O.projectionMatrix.elements,U=P[14]/(P[10]-1),D=P[14]/(P[10]+1),B=(P[9]+1)/P[5],te=(P[9]-1)/P[5],$=(P[8]-1)/P[0],S=(q[8]+1)/q[0],re=U*$,z=U*S,G=Z/(-$+S),se=G*-$;T.matrixWorld.decompose(E.position,E.quaternion,E.scale),E.translateX(se),E.translateZ(G),E.matrixWorld.compose(E.position,E.quaternion,E.scale),E.matrixWorldInverse.copy(E.matrixWorld).invert();const he=U+G,fe=D+G,ge=re-se,be=z+(Z-se),_e=B*D/fe*he,ve=te*D/fe*he;E.projectionMatrix.makePerspective(ge,be,_e,ve,he,fe),E.projectionMatrixInverse.copy(E.projectionMatrix).invert()})(I,b,A):I.projectionMatrix.copy(b.projectionMatrix),(function(E,T,O){O===null?E.matrix.copy(T.matrixWorld):(E.matrix.copy(O.matrixWorld),E.matrix.invert(),E.matrix.multiply(T.matrixWorld)),E.matrix.decompose(E.position,E.quaternion,E.scale),E.updateMatrixWorld(!0),E.projectionMatrix.copy(T.projectionMatrix),E.projectionMatrixInverse.copy(T.projectionMatrixInverse),E.isPerspectiveCamera&&(E.fov=2*Vn*Math.atan(1/E.projectionMatrix.elements[5]),E.zoom=1)})(H,I,k)},this.getCamera=function(){return I},this.getFoveation=function(){if(d!==null||p!==null)return l},this.setFoveation=function(H){l=H,d!==null&&(d.fixedFoveation=H),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=H)};let ee=null;const K=new Oo;K.setAnimationLoop((function(H,k){if(h=k.getViewerPose(c||a),m=k,h!==null){const ce=h.views;p!==null&&(e.setRenderTargetFramebuffer(x,p.framebuffer),e.setRenderTarget(x));let E=!1;ce.length!==I.cameras.length&&(I.cameras.length=0,E=!0);for(let T=0;T<ce.length;T++){const O=ce[T];let Z=null;if(p!==null)Z=p.getViewport(O);else{const q=u.getViewSubImage(d,O);Z=q.viewport,T===0&&(e.setRenderTargetTextures(x,q.colorTexture,d.ignoreDepthValues?void 0:q.depthStencilTexture),e.setRenderTarget(x))}let P=N[T];P===void 0&&(P=new st,P.layers.enable(T),P.viewport=new He,N[T]=P),P.matrix.fromArray(O.transform.matrix),P.matrix.decompose(P.position,P.quaternion,P.scale),P.projectionMatrix.fromArray(O.projectionMatrix),P.projectionMatrixInverse.copy(P.projectionMatrix).invert(),P.viewport.set(Z.x,Z.y,Z.width,Z.height),T===0&&(I.matrix.copy(P.matrix),I.matrix.decompose(I.position,I.quaternion,I.scale)),E===!0&&I.cameras.push(P)}}for(let ce=0;ce<v.length;ce++){const E=_[ce],T=v[ce];E!==null&&T!==void 0&&T.update(E,k,c||a)}ee&&ee(H,k),k.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:k}),m=null})),this.setAnimationLoop=function(H){ee=H},this.dispose=function(){}}}function dd(r,e){function t(i,s){i.matrixAutoUpdate===!0&&i.updateMatrix(),s.value.copy(i.matrix)}function n(i,s){i.opacity.value=s.opacity,s.color&&i.diffuse.value.copy(s.color),s.emissive&&i.emissive.value.copy(s.emissive).multiplyScalar(s.emissiveIntensity),s.map&&(i.map.value=s.map,t(s.map,i.mapTransform)),s.alphaMap&&(i.alphaMap.value=s.alphaMap,t(s.alphaMap,i.alphaMapTransform)),s.bumpMap&&(i.bumpMap.value=s.bumpMap,t(s.bumpMap,i.bumpMapTransform),i.bumpScale.value=s.bumpScale,s.side===1&&(i.bumpScale.value*=-1)),s.normalMap&&(i.normalMap.value=s.normalMap,t(s.normalMap,i.normalMapTransform),i.normalScale.value.copy(s.normalScale),s.side===1&&i.normalScale.value.negate()),s.displacementMap&&(i.displacementMap.value=s.displacementMap,t(s.displacementMap,i.displacementMapTransform),i.displacementScale.value=s.displacementScale,i.displacementBias.value=s.displacementBias),s.emissiveMap&&(i.emissiveMap.value=s.emissiveMap,t(s.emissiveMap,i.emissiveMapTransform)),s.specularMap&&(i.specularMap.value=s.specularMap,t(s.specularMap,i.specularMapTransform)),s.alphaTest>0&&(i.alphaTest.value=s.alphaTest);const a=e.get(s).envMap;if(a&&(i.envMap.value=a,i.flipEnvMap.value=a.isCubeTexture&&a.isRenderTargetTexture===!1?-1:1,i.reflectivity.value=s.reflectivity,i.ior.value=s.ior,i.refractionRatio.value=s.refractionRatio),s.lightMap){i.lightMap.value=s.lightMap;const o=r._useLegacyLights===!0?Math.PI:1;i.lightMapIntensity.value=s.lightMapIntensity*o,t(s.lightMap,i.lightMapTransform)}s.aoMap&&(i.aoMap.value=s.aoMap,i.aoMapIntensity.value=s.aoMapIntensity,t(s.aoMap,i.aoMapTransform))}return{refreshFogUniforms:function(i,s){s.color.getRGB(i.fogColor.value,Io(r)),s.isFog?(i.fogNear.value=s.near,i.fogFar.value=s.far):s.isFogExp2&&(i.fogDensity.value=s.density)},refreshMaterialUniforms:function(i,s,a,o,l){s.isMeshBasicMaterial||s.isMeshLambertMaterial?n(i,s):s.isMeshToonMaterial?(n(i,s),(function(c,h){h.gradientMap&&(c.gradientMap.value=h.gradientMap)})(i,s)):s.isMeshPhongMaterial?(n(i,s),(function(c,h){c.specular.value.copy(h.specular),c.shininess.value=Math.max(h.shininess,1e-4)})(i,s)):s.isMeshStandardMaterial?(n(i,s),(function(c,h){c.metalness.value=h.metalness,h.metalnessMap&&(c.metalnessMap.value=h.metalnessMap,t(h.metalnessMap,c.metalnessMapTransform)),c.roughness.value=h.roughness,h.roughnessMap&&(c.roughnessMap.value=h.roughnessMap,t(h.roughnessMap,c.roughnessMapTransform)),e.get(h).envMap&&(c.envMapIntensity.value=h.envMapIntensity)})(i,s),s.isMeshPhysicalMaterial&&(function(c,h,u){c.ior.value=h.ior,h.sheen>0&&(c.sheenColor.value.copy(h.sheenColor).multiplyScalar(h.sheen),c.sheenRoughness.value=h.sheenRoughness,h.sheenColorMap&&(c.sheenColorMap.value=h.sheenColorMap,t(h.sheenColorMap,c.sheenColorMapTransform)),h.sheenRoughnessMap&&(c.sheenRoughnessMap.value=h.sheenRoughnessMap,t(h.sheenRoughnessMap,c.sheenRoughnessMapTransform))),h.clearcoat>0&&(c.clearcoat.value=h.clearcoat,c.clearcoatRoughness.value=h.clearcoatRoughness,h.clearcoatMap&&(c.clearcoatMap.value=h.clearcoatMap,t(h.clearcoatMap,c.clearcoatMapTransform)),h.clearcoatRoughnessMap&&(c.clearcoatRoughnessMap.value=h.clearcoatRoughnessMap,t(h.clearcoatRoughnessMap,c.clearcoatRoughnessMapTransform)),h.clearcoatNormalMap&&(c.clearcoatNormalMap.value=h.clearcoatNormalMap,t(h.clearcoatNormalMap,c.clearcoatNormalMapTransform),c.clearcoatNormalScale.value.copy(h.clearcoatNormalScale),h.side===1&&c.clearcoatNormalScale.value.negate())),h.iridescence>0&&(c.iridescence.value=h.iridescence,c.iridescenceIOR.value=h.iridescenceIOR,c.iridescenceThicknessMinimum.value=h.iridescenceThicknessRange[0],c.iridescenceThicknessMaximum.value=h.iridescenceThicknessRange[1],h.iridescenceMap&&(c.iridescenceMap.value=h.iridescenceMap,t(h.iridescenceMap,c.iridescenceMapTransform)),h.iridescenceThicknessMap&&(c.iridescenceThicknessMap.value=h.iridescenceThicknessMap,t(h.iridescenceThicknessMap,c.iridescenceThicknessMapTransform))),h.transmission>0&&(c.transmission.value=h.transmission,c.transmissionSamplerMap.value=u.texture,c.transmissionSamplerSize.value.set(u.width,u.height),h.transmissionMap&&(c.transmissionMap.value=h.transmissionMap,t(h.transmissionMap,c.transmissionMapTransform)),c.thickness.value=h.thickness,h.thicknessMap&&(c.thicknessMap.value=h.thicknessMap,t(h.thicknessMap,c.thicknessMapTransform)),c.attenuationDistance.value=h.attenuationDistance,c.attenuationColor.value.copy(h.attenuationColor)),h.anisotropy>0&&(c.anisotropyVector.value.set(h.anisotropy*Math.cos(h.anisotropyRotation),h.anisotropy*Math.sin(h.anisotropyRotation)),h.anisotropyMap&&(c.anisotropyMap.value=h.anisotropyMap,t(h.anisotropyMap,c.anisotropyMapTransform))),c.specularIntensity.value=h.specularIntensity,c.specularColor.value.copy(h.specularColor),h.specularColorMap&&(c.specularColorMap.value=h.specularColorMap,t(h.specularColorMap,c.specularColorMapTransform)),h.specularIntensityMap&&(c.specularIntensityMap.value=h.specularIntensityMap,t(h.specularIntensityMap,c.specularIntensityMapTransform))})(i,s,l)):s.isMeshMatcapMaterial?(n(i,s),(function(c,h){h.matcap&&(c.matcap.value=h.matcap)})(i,s)):s.isMeshDepthMaterial?n(i,s):s.isMeshDistanceMaterial?(n(i,s),(function(c,h){const u=e.get(h).light;c.referencePosition.value.setFromMatrixPosition(u.matrixWorld),c.nearDistance.value=u.shadow.camera.near,c.farDistance.value=u.shadow.camera.far})(i,s)):s.isMeshNormalMaterial?n(i,s):s.isLineBasicMaterial?((function(c,h){c.diffuse.value.copy(h.color),c.opacity.value=h.opacity,h.map&&(c.map.value=h.map,t(h.map,c.mapTransform))})(i,s),s.isLineDashedMaterial&&(function(c,h){c.dashSize.value=h.dashSize,c.totalSize.value=h.dashSize+h.gapSize,c.scale.value=h.scale})(i,s)):s.isPointsMaterial?(function(c,h,u,d){c.diffuse.value.copy(h.color),c.opacity.value=h.opacity,c.size.value=h.size*u,c.scale.value=.5*d,h.map&&(c.map.value=h.map,t(h.map,c.uvTransform)),h.alphaMap&&(c.alphaMap.value=h.alphaMap,t(h.alphaMap,c.alphaMapTransform)),h.alphaTest>0&&(c.alphaTest.value=h.alphaTest)})(i,s,a,o):s.isSpriteMaterial?(function(c,h){c.diffuse.value.copy(h.color),c.opacity.value=h.opacity,c.rotation.value=h.rotation,h.map&&(c.map.value=h.map,t(h.map,c.mapTransform)),h.alphaMap&&(c.alphaMap.value=h.alphaMap,t(h.alphaMap,c.alphaMapTransform)),h.alphaTest>0&&(c.alphaTest.value=h.alphaTest)})(i,s):s.isShadowMaterial?(i.color.value.copy(s.color),i.opacity.value=s.opacity):s.isShaderMaterial&&(s.uniformsNeedUpdate=!1)}}}function pd(r,e,t,n){let i={},s={},a=[];const o=t.isWebGL2?r.getParameter(r.MAX_UNIFORM_BUFFER_BINDINGS):0;function l(u,d,p,m){const g=u.value,f=d+"_"+p;if(m[f]===void 0)return m[f]=typeof g=="number"||typeof g=="boolean"?g:g.clone(),!0;{const x=m[f];if(typeof g=="number"||typeof g=="boolean"){if(x!==g)return m[f]=g,!0}else if(x.equals(g)===!1)return x.copy(g),!0}return!1}function c(u){const d={boundary:0,storage:0};return typeof u=="number"||typeof u=="boolean"?(d.boundary=4,d.storage=4):u.isVector2?(d.boundary=8,d.storage=8):u.isVector3||u.isColor?(d.boundary=16,d.storage=12):u.isVector4?(d.boundary=16,d.storage=16):u.isMatrix3?(d.boundary=48,d.storage=48):u.isMatrix4?(d.boundary=64,d.storage=64):u.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",u),d}function h(u){const d=u.target;d.removeEventListener("dispose",h);const p=a.indexOf(d.__bindingPointIndex);a.splice(p,1),r.deleteBuffer(i[d.id]),delete i[d.id],delete s[d.id]}return{bind:function(u,d){const p=d.program;n.uniformBlockBinding(u,p)},update:function(u,d){let p=i[u.id];p===void 0&&((function(f){const x=f.uniforms;let v=0;const _=16;for(let C=0,b=x.length;C<b;C++){const A=Array.isArray(x[C])?x[C]:[x[C]];for(let N=0,I=A.length;N<I;N++){const F=A[N],Y=Array.isArray(F.value)?F.value:[F.value];for(let L=0,W=Y.length;L<W;L++){const X=c(Y[L]),oe=v%_;oe!==0&&_-oe<X.boundary&&(v+=_-oe),F.__data=new Float32Array(X.storage/Float32Array.BYTES_PER_ELEMENT),F.__offset=v,v+=X.storage}}}const M=v%_;M>0&&(v+=_-M),f.__size=v,f.__cache={}})(u),p=(function(f){const x=(function(){for(let C=0;C<o;C++)if(a.indexOf(C)===-1)return a.push(C),C;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0})();f.__bindingPointIndex=x;const v=r.createBuffer(),_=f.__size,M=f.usage;return r.bindBuffer(r.UNIFORM_BUFFER,v),r.bufferData(r.UNIFORM_BUFFER,_,M),r.bindBuffer(r.UNIFORM_BUFFER,null),r.bindBufferBase(r.UNIFORM_BUFFER,x,v),v})(u),i[u.id]=p,u.addEventListener("dispose",h));const m=d.program;n.updateUBOMapping(u,m);const g=e.render.frame;s[u.id]!==g&&((function(f){const x=i[f.id],v=f.uniforms,_=f.__cache;r.bindBuffer(r.UNIFORM_BUFFER,x);for(let M=0,C=v.length;M<C;M++){const b=Array.isArray(v[M])?v[M]:[v[M]];for(let A=0,N=b.length;A<N;A++){const I=b[A];if(l(I,M,A,_)===!0){const F=I.__offset,Y=Array.isArray(I.value)?I.value:[I.value];let L=0;for(let W=0;W<Y.length;W++){const X=Y[W],oe=c(X);typeof X=="number"||typeof X=="boolean"?(I.__data[0]=X,r.bufferSubData(r.UNIFORM_BUFFER,F+L,I.__data)):X.isMatrix3?(I.__data[0]=X.elements[0],I.__data[1]=X.elements[1],I.__data[2]=X.elements[2],I.__data[3]=0,I.__data[4]=X.elements[3],I.__data[5]=X.elements[4],I.__data[6]=X.elements[5],I.__data[7]=0,I.__data[8]=X.elements[6],I.__data[9]=X.elements[7],I.__data[10]=X.elements[8],I.__data[11]=0):(X.toArray(I.__data,L),L+=oe.storage/Float32Array.BYTES_PER_ELEMENT)}r.bufferSubData(r.UNIFORM_BUFFER,F,I.__data)}}}r.bindBuffer(r.UNIFORM_BUFFER,null)})(u),s[u.id]=g)},dispose:function(){for(const u in i)r.deleteBuffer(i[u]);a=[],i={},s={}}}}class ul{constructor(e={}){const{canvas:t=po(),context:n=null,depth:i=!0,stencil:s=!0,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1}=e;let d;this.isWebGLRenderer=!0,d=n!==null?n.getContextAttributes().alpha:a;const p=new Uint32Array(4),m=new Int32Array(4);let g=null,f=null;const x=[],v=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=$e,this._useLegacyLights=!1,this.toneMapping=0,this.toneMappingExposure=1;const _=this;let M=!1,C=0,b=0,A=null,N=-1,I=null;const F=new He,Y=new He;let L=null;const W=new de(0);let X=0,oe=t.width,pe=t.height,ne=1,ee=null,K=null;const H=new He(0,0,oe,pe),k=new He(0,0,oe,pe);let ce=!1;const E=new Ni;let T=!1,O=!1,Z=null;const P=new Me,q=new ie,U=new w,D={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};function B(){return A===null?ne:1}let te,$,S,re,z,G,se,he,fe,ge,be,_e,ve,Re,rt,xe,Ne,Pe,Cs,yi,Ls,Rt,wt,Mi,j=n;function Ps(R,V){for(let J=0;J<R.length;J++){const ae=R[J],Q=t.getContext(ae,V);if(Q!==null)return Q}return null}try{const R={alpha:!0,depth:i,stencil:s,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in t&&t.setAttribute("data-engine","three.js r160"),t.addEventListener("webglcontextlost",Qc,!1),t.addEventListener("webglcontextrestored",eh,!1),t.addEventListener("webglcontextcreationerror",th,!1),j===null){const V=["webgl2","webgl","experimental-webgl"];if(_.isWebGL1Renderer===!0&&V.shift(),j=Ps(V,R),j===null)throw Ps(V)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}typeof WebGLRenderingContext<"u"&&j instanceof WebGLRenderingContext&&console.warn("THREE.WebGLRenderer: WebGL 1 support was deprecated in r153 and will be removed in r163."),j.getShaderPrecisionFormat===void 0&&(j.getShaderPrecisionFormat=function(){return{rangeMin:1,rangeMax:1,precision:1}})}catch(R){throw console.error("THREE.WebGLRenderer: "+R.message),R}function sr(){te=new kh(j),$=new zh(j,te,e),te.init($),Rt=new cl(j,te,$),S=new ld(j,te,$),re=new jh(j),z=new Qu,G=new cd(j,te,S,z,$,Rt,re),se=new Hh(_),he=new Vh(_),fe=new Nh(j,$),wt=new Fh(j,te,fe,$),ge=new Wh(j,fe,re,wt),be=new Jh(j,ge,fe,re),Cs=new Zh(j,$,G),xe=new Gh(z),_e=new $u(_,se,he,te,$,wt,xe),ve=new dd(_,z),Re=new td,rt=new ad(te,$),Pe=new Oh(_,se,he,S,be,d,l),Ne=new od(_,be,$),Mi=new pd(j,re,$,S),yi=new Bh(j,te,re,$),Ls=new Xh(j,te,re,$),re.programs=_e.programs,_.capabilities=$,_.extensions=te,_.properties=z,_.renderLists=Re,_.shadowMap=Ne,_.state=S,_.info=re}sr();const ut=new ud(_,j);function Qc(R){R.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),M=!0}function eh(){console.log("THREE.WebGLRenderer: Context Restored."),M=!1;const R=re.autoReset,V=Ne.enabled,J=Ne.autoUpdate,ae=Ne.needsUpdate,Q=Ne.type;sr(),re.autoReset=R,Ne.enabled=V,Ne.autoUpdate=J,Ne.needsUpdate=ae,Ne.type=Q}function th(R){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",R.statusMessage)}function nh(R){const V=R.target;V.removeEventListener("dispose",nh),(function(J){(function(ae){const Q=z.get(ae).programs;Q!==void 0&&(Q.forEach((function(ue){_e.releaseProgram(ue)})),ae.isShaderMaterial&&_e.releaseShaderCache(ae))})(J),z.remove(J)})(V)}function ih(R,V,J){R.transparent===!0&&R.side===2&&R.forceSinglePass===!1?(R.side=1,R.needsUpdate=!0,Us(R,V,J),R.side=0,R.needsUpdate=!0,Us(R,V,J),R.side=2):Us(R,V,J)}this.xr=ut,this.getContext=function(){return j},this.getContextAttributes=function(){return j.getContextAttributes()},this.forceContextLoss=function(){const R=te.get("WEBGL_lose_context");R&&R.loseContext()},this.forceContextRestore=function(){const R=te.get("WEBGL_lose_context");R&&R.restoreContext()},this.getPixelRatio=function(){return ne},this.setPixelRatio=function(R){R!==void 0&&(ne=R,this.setSize(oe,pe,!1))},this.getSize=function(R){return R.set(oe,pe)},this.setSize=function(R,V,J=!0){ut.isPresenting?console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting."):(oe=R,pe=V,t.width=Math.floor(R*ne),t.height=Math.floor(V*ne),J===!0&&(t.style.width=R+"px",t.style.height=V+"px"),this.setViewport(0,0,R,V))},this.getDrawingBufferSize=function(R){return R.set(oe*ne,pe*ne).floor()},this.setDrawingBufferSize=function(R,V,J){oe=R,pe=V,ne=J,t.width=Math.floor(R*J),t.height=Math.floor(V*J),this.setViewport(0,0,R,V)},this.getCurrentViewport=function(R){return R.copy(F)},this.getViewport=function(R){return R.copy(H)},this.setViewport=function(R,V,J,ae){R.isVector4?H.set(R.x,R.y,R.z,R.w):H.set(R,V,J,ae),S.viewport(F.copy(H).multiplyScalar(ne).floor())},this.getScissor=function(R){return R.copy(k)},this.setScissor=function(R,V,J,ae){R.isVector4?k.set(R.x,R.y,R.z,R.w):k.set(R,V,J,ae),S.scissor(Y.copy(k).multiplyScalar(ne).floor())},this.getScissorTest=function(){return ce},this.setScissorTest=function(R){S.setScissorTest(ce=R)},this.setOpaqueSort=function(R){ee=R},this.setTransparentSort=function(R){K=R},this.getClearColor=function(R){return R.copy(Pe.getClearColor())},this.setClearColor=function(){Pe.setClearColor.apply(Pe,arguments)},this.getClearAlpha=function(){return Pe.getClearAlpha()},this.setClearAlpha=function(){Pe.setClearAlpha.apply(Pe,arguments)},this.clear=function(R=!0,V=!0,J=!0){let ae=0;if(R){let Q=!1;if(A!==null){const ue=A.texture.format;Q=ue===1033||ue===1031||ue===1029}if(Q){const ue=A.texture.type,ye=ue===1009||ue===1014||ue===1012||ue===1020||ue===1017||ue===1018,Se=Pe.getClearColor(),Ce=Pe.getClearAlpha(),Le=Se.r,Ie=Se.g,Ue=Se.b;ye?(p[0]=Le,p[1]=Ie,p[2]=Ue,p[3]=Ce,j.clearBufferuiv(j.COLOR,0,p)):(m[0]=Le,m[1]=Ie,m[2]=Ue,m[3]=Ce,j.clearBufferiv(j.COLOR,0,m))}else ae|=j.COLOR_BUFFER_BIT}V&&(ae|=j.DEPTH_BUFFER_BIT),J&&(ae|=j.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),j.clear(ae)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",Qc,!1),t.removeEventListener("webglcontextrestored",eh,!1),t.removeEventListener("webglcontextcreationerror",th,!1),Re.dispose(),rt.dispose(),z.dispose(),se.dispose(),he.dispose(),be.dispose(),wt.dispose(),Mi.dispose(),_e.dispose(),ut.dispose(),ut.removeEventListener("sessionstart",rh),ut.removeEventListener("sessionend",sh),Z&&(Z.dispose(),Z=null),Bn.stop()},this.renderBufferDirect=function(R,V,J,ae,Q,ue){V===null&&(V=D);const ye=Q.isMesh&&Q.matrixWorld.determinant()<0,Se=(function(nt,Ct,St,De,Oe){Ct.isScene!==!0&&(Ct=D),G.resetTextureUnits();const ar=Ct.fog,ro=De.isMeshStandardMaterial?Ct.environment:null,Zd=A===null?_.outputColorSpace:A.isXRRenderTarget===!0?A.texture.colorSpace:Ht,Ds=(De.isMeshStandardMaterial?he:se).get(De.envMap||ro),Jd=De.vertexColors===!0&&!!St.attributes.color&&St.attributes.color.itemSize===4,Kd=!!St.attributes.tangent&&(!!De.normalMap||De.anisotropy>0),$d=!!St.morphAttributes.position,Qd=!!St.morphAttributes.normal,ep=!!St.morphAttributes.color;let uh=0;De.toneMapped&&(A!==null&&A.isXRRenderTarget!==!0||(uh=_.toneMapping));const dh=St.morphAttributes.position||St.morphAttributes.normal||St.morphAttributes.color,tp=dh!==void 0?dh.length:0,ze=z.get(De),np=f.state.lights;if(T===!0&&(O===!0||nt!==I)){const Lt=nt===I&&De.id===N;xe.setState(De,nt,Lt)}let zt=!1;De.version===ze.__version?ze.needsLights&&ze.lightsStateVersion!==np.state.version||ze.outputColorSpace!==Zd||Oe.isBatchedMesh&&ze.batching===!1?zt=!0:Oe.isBatchedMesh||ze.batching!==!0?Oe.isInstancedMesh&&ze.instancing===!1?zt=!0:Oe.isInstancedMesh||ze.instancing!==!0?Oe.isSkinnedMesh&&ze.skinning===!1?zt=!0:Oe.isSkinnedMesh||ze.skinning!==!0?Oe.isInstancedMesh&&ze.instancingColor===!0&&Oe.instanceColor===null||Oe.isInstancedMesh&&ze.instancingColor===!1&&Oe.instanceColor!==null||ze.envMap!==Ds||De.fog===!0&&ze.fog!==ar?zt=!0:ze.numClippingPlanes===void 0||ze.numClippingPlanes===xe.numPlanes&&ze.numIntersection===xe.numIntersection?(ze.vertexAlphas!==Jd||ze.vertexTangents!==Kd||ze.morphTargets!==$d||ze.morphNormals!==Qd||ze.morphColors!==ep||ze.toneMapping!==uh||$.isWebGL2===!0&&ze.morphTargetsCount!==tp)&&(zt=!0):zt=!0:zt=!0:zt=!0:zt=!0:(zt=!0,ze.__version=De.version);let Gn=ze.currentProgram;zt===!0&&(Gn=Us(De,Ct,Oe));let ph=!1,or=!1,so=!1;const dt=Gn.getUniforms(),Hn=ze.uniforms;if(S.useProgram(Gn.program)&&(ph=!0,or=!0,so=!0),De.id!==N&&(N=De.id,or=!0),ph||I!==nt){dt.setValue(j,"projectionMatrix",nt.projectionMatrix),dt.setValue(j,"viewMatrix",nt.matrixWorldInverse);const Lt=dt.map.cameraPosition;Lt!==void 0&&Lt.setValue(j,U.setFromMatrixPosition(nt.matrixWorld)),$.logarithmicDepthBuffer&&dt.setValue(j,"logDepthBufFC",2/(Math.log(nt.far+1)/Math.LN2)),(De.isMeshPhongMaterial||De.isMeshToonMaterial||De.isMeshLambertMaterial||De.isMeshBasicMaterial||De.isMeshStandardMaterial||De.isShaderMaterial)&&dt.setValue(j,"isOrthographic",nt.isOrthographicCamera===!0),I!==nt&&(I=nt,or=!0,so=!0)}if(Oe.isSkinnedMesh){dt.setOptional(j,Oe,"bindMatrix"),dt.setOptional(j,Oe,"bindMatrixInverse");const Lt=Oe.skeleton;Lt&&($.floatVertexTextures?(Lt.boneTexture===null&&Lt.computeBoneTexture(),dt.setValue(j,"boneTexture",Lt.boneTexture,G)):console.warn("THREE.WebGLRenderer: SkinnedMesh can only be used with WebGL 2. With WebGL 1 OES_texture_float and vertex textures support is required."))}Oe.isBatchedMesh&&(dt.setOptional(j,Oe,"batchingTexture"),dt.setValue(j,"batchingTexture",Oe._matricesTexture,G));const ao=St.morphAttributes;(ao.position!==void 0||ao.normal!==void 0||ao.color!==void 0&&$.isWebGL2===!0)&&Cs.update(Oe,St,Gn),(or||ze.receiveShadow!==Oe.receiveShadow)&&(ze.receiveShadow=Oe.receiveShadow,dt.setValue(j,"receiveShadow",Oe.receiveShadow)),De.isMeshGouraudMaterial&&De.envMap!==null&&(Hn.envMap.value=Ds,Hn.flipEnvMap.value=Ds.isCubeTexture&&Ds.isRenderTargetTexture===!1?-1:1),or&&(dt.setValue(j,"toneMappingExposure",_.toneMappingExposure),ze.needsLights&&(Gt=so,(Xt=Hn).ambientLightColor.needsUpdate=Gt,Xt.lightProbe.needsUpdate=Gt,Xt.directionalLights.needsUpdate=Gt,Xt.directionalLightShadows.needsUpdate=Gt,Xt.pointLights.needsUpdate=Gt,Xt.pointLightShadows.needsUpdate=Gt,Xt.spotLights.needsUpdate=Gt,Xt.spotLightShadows.needsUpdate=Gt,Xt.rectAreaLights.needsUpdate=Gt,Xt.hemisphereLights.needsUpdate=Gt),ar&&De.fog===!0&&ve.refreshFogUniforms(Hn,ar),ve.refreshMaterialUniforms(Hn,De,ne,pe,Z),Fr.upload(j,ch(ze),Hn,G));var Xt,Gt;if(De.isShaderMaterial&&De.uniformsNeedUpdate===!0&&(Fr.upload(j,ch(ze),Hn,G),De.uniformsNeedUpdate=!1),De.isSpriteMaterial&&dt.setValue(j,"center",Oe.center),dt.setValue(j,"modelViewMatrix",Oe.modelViewMatrix),dt.setValue(j,"normalMatrix",Oe.normalMatrix),dt.setValue(j,"modelMatrix",Oe.matrixWorld),De.isShaderMaterial||De.isRawShaderMaterial){const Lt=De.uniformsGroups;for(let oo=0,ip=Lt.length;oo<ip;oo++)if($.isWebGL2){const fh=Lt[oo];Mi.update(fh,Gn),Mi.bind(fh,Gn)}else console.warn("THREE.WebGLRenderer: Uniform Buffer Objects can only be used with WebGL 2.")}return Gn})(R,V,J,ae,Q);S.setMaterial(ae,ye);let Ce=J.index,Le=1;if(ae.wireframe===!0){if(Ce=ge.getWireframeAttribute(J),Ce===void 0)return;Le=2}const Ie=J.drawRange,Ue=J.attributes.position;let Xe=Ie.start*Le,Bt=(Ie.start+Ie.count)*Le;ue!==null&&(Xe=Math.max(Xe,ue.start*Le),Bt=Math.min(Bt,(ue.start+ue.count)*Le)),Ce!==null?(Xe=Math.max(Xe,0),Bt=Math.min(Bt,Ce.count)):Ue!=null&&(Xe=Math.max(Xe,0),Bt=Math.min(Bt,Ue.count));const rn=Bt-Xe;if(rn<0||rn===1/0)return;let zn;wt.setup(Q,ae,Se,J,Ce);let je=yi;if(Ce!==null&&(zn=fe.get(Ce),je=Ls,je.setIndex(zn)),Q.isMesh)ae.wireframe===!0?(S.setLineWidth(ae.wireframeLinewidth*B()),je.setMode(j.LINES)):je.setMode(j.TRIANGLES);else if(Q.isLine){let nt=ae.linewidth;nt===void 0&&(nt=1),S.setLineWidth(nt*B()),Q.isLineSegments?je.setMode(j.LINES):Q.isLineLoop?je.setMode(j.LINE_LOOP):je.setMode(j.LINE_STRIP)}else Q.isPoints?je.setMode(j.POINTS):Q.isSprite&&je.setMode(j.TRIANGLES);if(Q.isBatchedMesh)je.renderMultiDraw(Q._multiDrawStarts,Q._multiDrawCounts,Q._multiDrawCount);else if(Q.isInstancedMesh)je.renderInstances(Xe,rn,Q.count);else if(J.isInstancedBufferGeometry){const nt=J._maxInstanceCount!==void 0?J._maxInstanceCount:1/0,Ct=Math.min(J.instanceCount,nt);je.renderInstances(Xe,rn,Ct)}else je.render(Xe,rn)},this.compile=function(R,V,J=null){J===null&&(J=R),f=rt.get(J),f.init(),v.push(f),J.traverseVisible((function(Q){Q.isLight&&Q.layers.test(V.layers)&&(f.pushLight(Q),Q.castShadow&&f.pushShadow(Q))})),R!==J&&R.traverseVisible((function(Q){Q.isLight&&Q.layers.test(V.layers)&&(f.pushLight(Q),Q.castShadow&&f.pushShadow(Q))})),f.setupLights(_._useLegacyLights);const ae=new Set;return R.traverse((function(Q){const ue=Q.material;if(ue)if(Array.isArray(ue))for(let ye=0;ye<ue.length;ye++){const Se=ue[ye];ih(Se,J,Q),ae.add(Se)}else ih(ue,J,Q),ae.add(ue)})),v.pop(),f=null,ae},this.compileAsync=function(R,V,J=null){const ae=this.compile(R,V,J);return new Promise((Q=>{function ue(){ae.forEach((function(ye){z.get(ye).currentProgram.isReady()&&ae.delete(ye)})),ae.size!==0?setTimeout(ue,10):Q(R)}te.get("KHR_parallel_shader_compile")!==null?ue():setTimeout(ue,10)}))};let io=null;function rh(){Bn.stop()}function sh(){Bn.start()}const Bn=new Oo;function ah(R,V,J,ae){if(R.visible===!1)return;if(R.layers.test(V.layers)){if(R.isGroup)J=R.renderOrder;else if(R.isLOD)R.autoUpdate===!0&&R.update(V);else if(R.isLight)f.pushLight(R),R.castShadow&&f.pushShadow(R);else if(R.isSprite){if(!R.frustumCulled||E.intersectsSprite(R)){ae&&U.setFromMatrixPosition(R.matrixWorld).applyMatrix4(P);const ue=be.update(R),ye=R.material;ye.visible&&g.push(R,ue,ye,J,U.z,null)}}else if((R.isMesh||R.isLine||R.isPoints)&&(!R.frustumCulled||E.intersectsObject(R))){const ue=be.update(R),ye=R.material;if(ae&&(R.boundingSphere!==void 0?(R.boundingSphere===null&&R.computeBoundingSphere(),U.copy(R.boundingSphere.center)):(ue.boundingSphere===null&&ue.computeBoundingSphere(),U.copy(ue.boundingSphere.center)),U.applyMatrix4(R.matrixWorld).applyMatrix4(P)),Array.isArray(ye)){const Se=ue.groups;for(let Ce=0,Le=Se.length;Ce<Le;Ce++){const Ie=Se[Ce],Ue=ye[Ie.materialIndex];Ue&&Ue.visible&&g.push(R,ue,Ue,J,U.z,Ie)}}else ye.visible&&g.push(R,ue,ye,J,U.z,null)}}const Q=R.children;for(let ue=0,ye=Q.length;ue<ye;ue++)ah(Q[ue],V,J,ae)}function oh(R,V,J,ae){const Q=R.opaque,ue=R.transmissive,ye=R.transparent;f.setupLightsView(J),T===!0&&xe.setGlobalState(_.clippingPlanes,J),ue.length>0&&(function(Se,Ce,Le,Ie){if((Le.isScene===!0?Le.overrideMaterial:null)!==null)return;const Xe=$.isWebGL2;Z===null&&(Z=new Pt(1,1,{generateMipmaps:!0,type:te.has("EXT_color_buffer_half_float")?1016:1009,minFilter:1008,samples:Xe?4:0})),_.getDrawingBufferSize(q),Xe?Z.setSize(q.x,q.y):Z.setSize(cr(q.x),cr(q.y));const Bt=_.getRenderTarget();_.setRenderTarget(Z),_.getClearColor(W),X=_.getClearAlpha(),X<1&&_.setClearColor(16777215,.5),_.clear();const rn=_.toneMapping;_.toneMapping=0,Is(Se,Le,Ie),G.updateMultisampleRenderTarget(Z),G.updateRenderTargetMipmap(Z);let zn=!1;for(let je=0,nt=Ce.length;je<nt;je++){const Ct=Ce[je],St=Ct.object,De=Ct.geometry,Oe=Ct.material,ar=Ct.group;if(Oe.side===2&&St.layers.test(Ie.layers)){const ro=Oe.side;Oe.side=1,Oe.needsUpdate=!0,lh(St,Le,Ie,De,Oe,ar),Oe.side=ro,Oe.needsUpdate=!0,zn=!0}}zn===!0&&(G.updateMultisampleRenderTarget(Z),G.updateRenderTargetMipmap(Z)),_.setRenderTarget(Bt),_.setClearColor(W,X),_.toneMapping=rn})(Q,ue,V,J),ae&&S.viewport(F.copy(ae)),Q.length>0&&Is(Q,V,J),ue.length>0&&Is(ue,V,J),ye.length>0&&Is(ye,V,J),S.buffers.depth.setTest(!0),S.buffers.depth.setMask(!0),S.buffers.color.setMask(!0),S.setPolygonOffset(!1)}function Is(R,V,J){const ae=V.isScene===!0?V.overrideMaterial:null;for(let Q=0,ue=R.length;Q<ue;Q++){const ye=R[Q],Se=ye.object,Ce=ye.geometry,Le=ae===null?ye.material:ae,Ie=ye.group;Se.layers.test(J.layers)&&lh(Se,V,J,Ce,Le,Ie)}}function lh(R,V,J,ae,Q,ue){R.onBeforeRender(_,V,J,ae,Q,ue),R.modelViewMatrix.multiplyMatrices(J.matrixWorldInverse,R.matrixWorld),R.normalMatrix.getNormalMatrix(R.modelViewMatrix),Q.onBeforeRender(_,V,J,ae,R,ue),Q.transparent===!0&&Q.side===2&&Q.forceSinglePass===!1?(Q.side=1,Q.needsUpdate=!0,_.renderBufferDirect(J,V,ae,Q,R,ue),Q.side=0,Q.needsUpdate=!0,_.renderBufferDirect(J,V,ae,Q,R,ue),Q.side=2):_.renderBufferDirect(J,V,ae,Q,R,ue),R.onAfterRender(_,V,J,ae,Q,ue)}function Us(R,V,J){V.isScene!==!0&&(V=D);const ae=z.get(R),Q=f.state.lights,ue=f.state.shadowsArray,ye=Q.state.version,Se=_e.getParameters(R,Q.state,ue,V,J),Ce=_e.getProgramCacheKey(Se);let Le=ae.programs;ae.environment=R.isMeshStandardMaterial?V.environment:null,ae.fog=V.fog,ae.envMap=(R.isMeshStandardMaterial?he:se).get(R.envMap||ae.environment),Le===void 0&&(R.addEventListener("dispose",nh),Le=new Map,ae.programs=Le);let Ie=Le.get(Ce);if(Ie!==void 0){if(ae.currentProgram===Ie&&ae.lightsStateVersion===ye)return hh(R,Se),Ie}else Se.uniforms=_e.getUniforms(R),R.onBuild(J,Se,_),R.onBeforeCompile(Se,_),Ie=_e.acquireProgram(Se,Ce),Le.set(Ce,Ie),ae.uniforms=Se.uniforms;const Ue=ae.uniforms;return(R.isShaderMaterial||R.isRawShaderMaterial)&&R.clipping!==!0||(Ue.clippingPlanes=xe.uniform),hh(R,Se),ae.needsLights=(function(Xe){return Xe.isMeshLambertMaterial||Xe.isMeshToonMaterial||Xe.isMeshPhongMaterial||Xe.isMeshStandardMaterial||Xe.isShadowMaterial||Xe.isShaderMaterial&&Xe.lights===!0})(R),ae.lightsStateVersion=ye,ae.needsLights&&(Ue.ambientLightColor.value=Q.state.ambient,Ue.lightProbe.value=Q.state.probe,Ue.directionalLights.value=Q.state.directional,Ue.directionalLightShadows.value=Q.state.directionalShadow,Ue.spotLights.value=Q.state.spot,Ue.spotLightShadows.value=Q.state.spotShadow,Ue.rectAreaLights.value=Q.state.rectArea,Ue.ltc_1.value=Q.state.rectAreaLTC1,Ue.ltc_2.value=Q.state.rectAreaLTC2,Ue.pointLights.value=Q.state.point,Ue.pointLightShadows.value=Q.state.pointShadow,Ue.hemisphereLights.value=Q.state.hemi,Ue.directionalShadowMap.value=Q.state.directionalShadowMap,Ue.directionalShadowMatrix.value=Q.state.directionalShadowMatrix,Ue.spotShadowMap.value=Q.state.spotShadowMap,Ue.spotLightMatrix.value=Q.state.spotLightMatrix,Ue.spotLightMap.value=Q.state.spotLightMap,Ue.pointShadowMap.value=Q.state.pointShadowMap,Ue.pointShadowMatrix.value=Q.state.pointShadowMatrix),ae.currentProgram=Ie,ae.uniformsList=null,Ie}function ch(R){if(R.uniformsList===null){const V=R.currentProgram.getUniforms();R.uniformsList=Fr.seqWithValue(V.seq,R.uniforms)}return R.uniformsList}function hh(R,V){const J=z.get(R);J.outputColorSpace=V.outputColorSpace,J.batching=V.batching,J.instancing=V.instancing,J.instancingColor=V.instancingColor,J.skinning=V.skinning,J.morphTargets=V.morphTargets,J.morphNormals=V.morphNormals,J.morphColors=V.morphColors,J.morphTargetsCount=V.morphTargetsCount,J.numClippingPlanes=V.numClippingPlanes,J.numIntersection=V.numClipIntersection,J.vertexAlphas=V.vertexAlphas,J.vertexTangents=V.vertexTangents,J.toneMapping=V.toneMapping}Bn.setAnimationLoop((function(R){io&&io(R)})),typeof self<"u"&&Bn.setContext(self),this.setAnimationLoop=function(R){io=R,ut.setAnimationLoop(R),R===null?Bn.stop():Bn.start()},ut.addEventListener("sessionstart",rh),ut.addEventListener("sessionend",sh),this.render=function(R,V){if(V!==void 0&&V.isCamera!==!0)return void console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");if(M===!0)return;R.matrixWorldAutoUpdate===!0&&R.updateMatrixWorld(),V.parent===null&&V.matrixWorldAutoUpdate===!0&&V.updateMatrixWorld(),ut.enabled===!0&&ut.isPresenting===!0&&(ut.cameraAutoUpdate===!0&&ut.updateCamera(V),V=ut.getCamera()),R.isScene===!0&&R.onBeforeRender(_,R,V,A),f=rt.get(R,v.length),f.init(),v.push(f),P.multiplyMatrices(V.projectionMatrix,V.matrixWorldInverse),E.setFromProjectionMatrix(P),O=this.localClippingEnabled,T=xe.init(this.clippingPlanes,O),g=Re.get(R,x.length),g.init(),x.push(g),ah(R,V,0,_.sortObjects),g.finish(),_.sortObjects===!0&&g.sort(ee,K),this.info.render.frame++,T===!0&&xe.beginShadows();const J=f.state.shadowsArray;if(Ne.render(J,R,V),T===!0&&xe.endShadows(),this.info.autoReset===!0&&this.info.reset(),Pe.render(g,R),f.setupLights(_._useLegacyLights),V.isArrayCamera){const ae=V.cameras;for(let Q=0,ue=ae.length;Q<ue;Q++){const ye=ae[Q];oh(g,R,ye,ye.viewport)}}else oh(g,R,V);A!==null&&(G.updateMultisampleRenderTarget(A),G.updateRenderTargetMipmap(A)),R.isScene===!0&&R.onAfterRender(_,R,V),wt.resetDefaultState(),N=-1,I=null,v.pop(),f=v.length>0?v[v.length-1]:null,x.pop(),g=x.length>0?x[x.length-1]:null},this.getActiveCubeFace=function(){return C},this.getActiveMipmapLevel=function(){return b},this.getRenderTarget=function(){return A},this.setRenderTargetTextures=function(R,V,J){z.get(R.texture).__webglTexture=V,z.get(R.depthTexture).__webglTexture=J;const ae=z.get(R);ae.__hasExternalTextures=!0,ae.__hasExternalTextures&&(ae.__autoAllocateDepthBuffer=J===void 0,ae.__autoAllocateDepthBuffer||te.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),ae.__useRenderToTexture=!1))},this.setRenderTargetFramebuffer=function(R,V){const J=z.get(R);J.__webglFramebuffer=V,J.__useDefaultFramebuffer=V===void 0},this.setRenderTarget=function(R,V=0,J=0){A=R,C=V,b=J;let ae=!0,Q=null,ue=!1,ye=!1;if(R){const Se=z.get(R);Se.__useDefaultFramebuffer!==void 0?(S.bindFramebuffer(j.FRAMEBUFFER,null),ae=!1):Se.__webglFramebuffer===void 0?G.setupRenderTarget(R):Se.__hasExternalTextures&&G.rebindTextures(R,z.get(R.texture).__webglTexture,z.get(R.depthTexture).__webglTexture);const Ce=R.texture;(Ce.isData3DTexture||Ce.isDataArrayTexture||Ce.isCompressedArrayTexture)&&(ye=!0);const Le=z.get(R).__webglFramebuffer;R.isWebGLCubeRenderTarget?(Q=Array.isArray(Le[V])?Le[V][J]:Le[V],ue=!0):Q=$.isWebGL2&&R.samples>0&&G.useMultisampledRTT(R)===!1?z.get(R).__webglMultisampledFramebuffer:Array.isArray(Le)?Le[J]:Le,F.copy(R.viewport),Y.copy(R.scissor),L=R.scissorTest}else F.copy(H).multiplyScalar(ne).floor(),Y.copy(k).multiplyScalar(ne).floor(),L=ce;if(S.bindFramebuffer(j.FRAMEBUFFER,Q)&&$.drawBuffers&&ae&&S.drawBuffers(R,Q),S.viewport(F),S.scissor(Y),S.setScissorTest(L),ue){const Se=z.get(R.texture);j.framebufferTexture2D(j.FRAMEBUFFER,j.COLOR_ATTACHMENT0,j.TEXTURE_CUBE_MAP_POSITIVE_X+V,Se.__webglTexture,J)}else if(ye){const Se=z.get(R.texture),Ce=V||0;j.framebufferTextureLayer(j.FRAMEBUFFER,j.COLOR_ATTACHMENT0,Se.__webglTexture,J||0,Ce)}N=-1},this.readRenderTargetPixels=function(R,V,J,ae,Q,ue,ye){if(!R||!R.isWebGLRenderTarget)return void console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Se=z.get(R).__webglFramebuffer;if(R.isWebGLCubeRenderTarget&&ye!==void 0&&(Se=Se[ye]),Se){S.bindFramebuffer(j.FRAMEBUFFER,Se);try{const Ce=R.texture,Le=Ce.format,Ie=Ce.type;if(Le!==1023&&Rt.convert(Le)!==j.getParameter(j.IMPLEMENTATION_COLOR_READ_FORMAT))return void console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");const Ue=Ie===1016&&(te.has("EXT_color_buffer_half_float")||$.isWebGL2&&te.has("EXT_color_buffer_float"));if(!(Ie===1009||Rt.convert(Ie)===j.getParameter(j.IMPLEMENTATION_COLOR_READ_TYPE)||Ie===1015&&($.isWebGL2||te.has("OES_texture_float")||te.has("WEBGL_color_buffer_float"))||Ue))return void console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");V>=0&&V<=R.width-ae&&J>=0&&J<=R.height-Q&&j.readPixels(V,J,ae,Q,Rt.convert(Le),Rt.convert(Ie),ue)}finally{const Ce=A!==null?z.get(A).__webglFramebuffer:null;S.bindFramebuffer(j.FRAMEBUFFER,Ce)}}},this.copyFramebufferToTexture=function(R,V,J=0){const ae=Math.pow(2,-J),Q=Math.floor(V.image.width*ae),ue=Math.floor(V.image.height*ae);G.setTexture2D(V,0),j.copyTexSubImage2D(j.TEXTURE_2D,J,0,0,R.x,R.y,Q,ue),S.unbindTexture()},this.copyTextureToTexture=function(R,V,J,ae=0){const Q=V.image.width,ue=V.image.height,ye=Rt.convert(J.format),Se=Rt.convert(J.type);G.setTexture2D(J,0),j.pixelStorei(j.UNPACK_FLIP_Y_WEBGL,J.flipY),j.pixelStorei(j.UNPACK_PREMULTIPLY_ALPHA_WEBGL,J.premultiplyAlpha),j.pixelStorei(j.UNPACK_ALIGNMENT,J.unpackAlignment),V.isDataTexture?j.texSubImage2D(j.TEXTURE_2D,ae,R.x,R.y,Q,ue,ye,Se,V.image.data):V.isCompressedTexture?j.compressedTexSubImage2D(j.TEXTURE_2D,ae,R.x,R.y,V.mipmaps[0].width,V.mipmaps[0].height,ye,V.mipmaps[0].data):j.texSubImage2D(j.TEXTURE_2D,ae,R.x,R.y,ye,Se,V.image),ae===0&&J.generateMipmaps&&j.generateMipmap(j.TEXTURE_2D),S.unbindTexture()},this.copyTextureToTexture3D=function(R,V,J,ae,Q=0){if(_.isWebGL1Renderer)return void console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: can only be used with WebGL2.");const ue=R.max.x-R.min.x+1,ye=R.max.y-R.min.y+1,Se=R.max.z-R.min.z+1,Ce=Rt.convert(ae.format),Le=Rt.convert(ae.type);let Ie;if(ae.isData3DTexture)G.setTexture3D(ae,0),Ie=j.TEXTURE_3D;else{if(!ae.isDataArrayTexture&&!ae.isCompressedArrayTexture)return void console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");G.setTexture2DArray(ae,0),Ie=j.TEXTURE_2D_ARRAY}j.pixelStorei(j.UNPACK_FLIP_Y_WEBGL,ae.flipY),j.pixelStorei(j.UNPACK_PREMULTIPLY_ALPHA_WEBGL,ae.premultiplyAlpha),j.pixelStorei(j.UNPACK_ALIGNMENT,ae.unpackAlignment);const Ue=j.getParameter(j.UNPACK_ROW_LENGTH),Xe=j.getParameter(j.UNPACK_IMAGE_HEIGHT),Bt=j.getParameter(j.UNPACK_SKIP_PIXELS),rn=j.getParameter(j.UNPACK_SKIP_ROWS),zn=j.getParameter(j.UNPACK_SKIP_IMAGES),je=J.isCompressedTexture?J.mipmaps[Q]:J.image;j.pixelStorei(j.UNPACK_ROW_LENGTH,je.width),j.pixelStorei(j.UNPACK_IMAGE_HEIGHT,je.height),j.pixelStorei(j.UNPACK_SKIP_PIXELS,R.min.x),j.pixelStorei(j.UNPACK_SKIP_ROWS,R.min.y),j.pixelStorei(j.UNPACK_SKIP_IMAGES,R.min.z),J.isDataTexture||J.isData3DTexture?j.texSubImage3D(Ie,Q,V.x,V.y,V.z,ue,ye,Se,Ce,Le,je.data):J.isCompressedArrayTexture?(console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: untested support for compressed srcTexture."),j.compressedTexSubImage3D(Ie,Q,V.x,V.y,V.z,ue,ye,Se,Ce,je.data)):j.texSubImage3D(Ie,Q,V.x,V.y,V.z,ue,ye,Se,Ce,Le,je),j.pixelStorei(j.UNPACK_ROW_LENGTH,Ue),j.pixelStorei(j.UNPACK_IMAGE_HEIGHT,Xe),j.pixelStorei(j.UNPACK_SKIP_PIXELS,Bt),j.pixelStorei(j.UNPACK_SKIP_ROWS,rn),j.pixelStorei(j.UNPACK_SKIP_IMAGES,zn),Q===0&&ae.generateMipmaps&&j.generateMipmap(Ie),S.unbindTexture()},this.initTexture=function(R){R.isCubeTexture?G.setTextureCube(R,0):R.isData3DTexture?G.setTexture3D(R,0):R.isDataArrayTexture||R.isCompressedArrayTexture?G.setTexture2DArray(R,0):G.setTexture2D(R,0),S.unbindTexture()},this.resetState=function(){C=0,b=0,A=null,S.reset(),wt.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return 2e3}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=e===lr?"display-p3":"srgb",t.unpackColorSpace=Ge.workingColorSpace===Si?"display-p3":"srgb"}get outputEncoding(){return console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace===$e?3001:3e3}set outputEncoding(e){console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace=e===3001?$e:Ht}get useLegacyLights(){return console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights}set useLegacyLights(e){console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights=e}}class dl extends ul{}dl.prototype.isWebGL1Renderer=!0;class Br{constructor(e,t=25e-5){this.isFogExp2=!0,this.name="",this.color=new de(e),this.density=t}clone(){return new Br(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}}class zr{constructor(e,t=1,n=1e3){this.isFog=!0,this.name="",this.color=new de(e),this.near=t,this.far=n}clone(){return new zr(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class pl extends Be{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t}}class Gr{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=35044,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.version=0,this.uuid=bt()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}get updateRange(){return console.warn("THREE.InterleavedBuffer: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let i=0,s=this.stride;i<s;i++)this.array[e+i]=t.array[n+i];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=bt()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=bt()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const mt=new w;class En{constructor(e,t,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)mt.fromBufferAttribute(this,t),mt.applyMatrix4(e),this.setXYZ(t,mt.x,mt.y,mt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)mt.fromBufferAttribute(this,t),mt.applyNormalMatrix(e),this.setXYZ(t,mt.x,mt.y,mt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)mt.fromBufferAttribute(this,t),mt.transformDirection(e),this.setXYZ(t,mt.x,mt.y,mt.z);return this}setX(e,t){return this.normalized&&(t=Te(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=Te(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=Te(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=Te(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=_t(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=_t(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=_t(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=_t(t,this.array)),t}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=Te(t,this.array),n=Te(n,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=Te(t,this.array),n=Te(n,this.array),i=Te(i,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this}setXYZW(e,t,n,i,s){return e=e*this.data.stride+this.offset,this.normalized&&(t=Te(t,this.array),n=Te(n,this.array),i=Te(i,this.array),s=Te(s,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this.data.array[e+3]=s,this}clone(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[i+s])}return new Ve(new this.array.constructor(t),this.itemSize,this.normalized)}return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new En(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[i+s])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class va extends ct{constructor(e){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new de(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}let hi;const Bi=new w,ui=new w,di=new w,pi=new ie,zi=new ie,fl=new Me,Hr=new w,Gi=new w,Vr=new w,ml=new ie,xa=new ie,gl=new ie;class _l extends Be{constructor(e=new va){if(super(),this.isSprite=!0,this.type="Sprite",hi===void 0){hi=new Ae;const t=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new Gr(t,5);hi.setIndex([0,1,2,0,2,3]),hi.setAttribute("position",new En(n,3,0,!1)),hi.setAttribute("uv",new En(n,2,3,!1))}this.geometry=hi,this.material=e,this.center=new ie(.5,.5)}raycast(e,t){e.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),ui.setFromMatrixScale(this.matrixWorld),fl.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),di.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&ui.multiplyScalar(-di.z);const n=this.material.rotation;let i,s;n!==0&&(s=Math.cos(n),i=Math.sin(n));const a=this.center;kr(Hr.set(-.5,-.5,0),di,a,ui,i,s),kr(Gi.set(.5,-.5,0),di,a,ui,i,s),kr(Vr.set(.5,.5,0),di,a,ui,i,s),ml.set(0,0),xa.set(1,0),gl.set(1,1);let o=e.ray.intersectTriangle(Hr,Gi,Vr,!1,Bi);if(o===null&&(kr(Gi.set(-.5,.5,0),di,a,ui,i,s),xa.set(0,1),o=e.ray.intersectTriangle(Hr,Vr,Gi,!1,Bi),o===null))return;const l=e.ray.origin.distanceTo(Bi);l<e.near||l>e.far||t.push({distance:l,point:Bi.clone(),uv:xt.getInterpolation(Bi,Hr,Gi,Vr,ml,xa,gl,new ie),face:null,object:this})}copy(e,t){return super.copy(e,t),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}}function kr(r,e,t,n,i,s){pi.subVectors(r,t).addScalar(.5).multiply(n),i!==void 0?(zi.x=s*pi.x-i*pi.y,zi.y=i*pi.x+s*pi.y):zi.copy(pi),r.copy(e),r.x+=zi.x,r.y+=zi.y,r.applyMatrix4(fl)}const Wr=new w,vl=new w;class xl extends Be{constructor(){super(),this._currentLevel=0,this.type="LOD",Object.defineProperties(this,{levels:{enumerable:!0,value:[]},isLOD:{value:!0}}),this.autoUpdate=!0}copy(e){super.copy(e,!1);const t=e.levels;for(let n=0,i=t.length;n<i;n++){const s=t[n];this.addLevel(s.object.clone(),s.distance,s.hysteresis)}return this.autoUpdate=e.autoUpdate,this}addLevel(e,t=0,n=0){t=Math.abs(t);const i=this.levels;let s;for(s=0;s<i.length&&!(t<i[s].distance);s++);return i.splice(s,0,{distance:t,hysteresis:n,object:e}),this.add(e),this}getCurrentLevel(){return this._currentLevel}getObjectForDistance(e){const t=this.levels;if(t.length>0){let n,i;for(n=1,i=t.length;n<i;n++){let s=t[n].distance;if(t[n].object.visible&&(s-=s*t[n].hysteresis),e<s)break}return t[n-1].object}return null}raycast(e,t){if(this.levels.length>0){Wr.setFromMatrixPosition(this.matrixWorld);const n=e.ray.origin.distanceTo(Wr);this.getObjectForDistance(n).raycast(e,t)}}update(e){const t=this.levels;if(t.length>1){Wr.setFromMatrixPosition(e.matrixWorld),vl.setFromMatrixPosition(this.matrixWorld);const n=Wr.distanceTo(vl)/e.zoom;let i,s;for(t[0].object.visible=!0,i=1,s=t.length;i<s;i++){let a=t[i].distance;if(t[i].object.visible&&(a-=a*t[i].hysteresis),!(n>=a))break;t[i-1].object.visible=!1,t[i].object.visible=!0}for(this._currentLevel=i-1;i<s;i++)t[i].object.visible=!1}}toJSON(e){const t=super.toJSON(e);this.autoUpdate===!1&&(t.object.autoUpdate=!1),t.object.levels=[];const n=this.levels;for(let i=0,s=n.length;i<s;i++){const a=n[i];t.object.levels.push({object:a.object.uuid,distance:a.distance,hysteresis:a.hysteresis})}return t}}const yl=new w,Ml=new He,Sl=new He,fd=new w,bl=new Me,Xr=new w,ya=new ot,Tl=new Me,Ma=new Zn;class El extends Qe{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=Ns,this.bindMatrix=new Me,this.bindMatrixInverse=new Me,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){const e=this.geometry;this.boundingBox===null&&(this.boundingBox=new pt),this.boundingBox.makeEmpty();const t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,Xr),this.boundingBox.expandByPoint(Xr)}computeBoundingSphere(){const e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new ot),this.boundingSphere.makeEmpty();const t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,Xr),this.boundingSphere.expandByPoint(Xr)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){const n=this.material,i=this.matrixWorld;n!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),ya.copy(this.boundingSphere),ya.applyMatrix4(i),e.ray.intersectsSphere(ya)!==!1&&(Tl.copy(i).invert(),Ma.copy(e.ray).applyMatrix4(Tl),this.boundingBox!==null&&Ma.intersectsBox(this.boundingBox)===!1||this._computeIntersections(e,t,Ma)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){const e=new He,t=this.geometry.attributes.skinWeight;for(let n=0,i=t.count;n<i;n++){e.fromBufferAttribute(t,n);const s=1/e.manhattanLength();s!==1/0?e.multiplyScalar(s):e.set(1,0,0,0),t.setXYZW(n,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===Ns?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===co?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){const n=this.skeleton,i=this.geometry;Ml.fromBufferAttribute(i.attributes.skinIndex,e),Sl.fromBufferAttribute(i.attributes.skinWeight,e),yl.copy(t).applyMatrix4(this.bindMatrix),t.set(0,0,0);for(let s=0;s<4;s++){const a=Sl.getComponent(s);if(a!==0){const o=Ml.getComponent(s);bl.multiplyMatrices(n.bones[o].matrixWorld,n.boneInverses[o]),t.addScaledVector(fd.copy(yl).applyMatrix4(bl),a)}}return t.applyMatrix4(this.bindMatrixInverse)}boneTransform(e,t){return console.warn("THREE.SkinnedMesh: .boneTransform() was renamed to .applyBoneTransform() in r151."),this.applyBoneTransform(e,t)}}class Sa extends Be{constructor(){super(),this.isBone=!0,this.type="Bone"}}class wn extends Ze{constructor(e=null,t=1,n=1,i,s,a,o,l,c=1003,h=1003,u,d){super(null,a,o,l,c,h,i,s,u,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const wl=new Me,md=new Me;class jr{constructor(e=[],t=[]){this.uuid=bt(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){const e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(16*e.length),t.length===0)this.calculateInverses();else if(e.length!==t.length){console.warn("THREE.Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let n=0,i=this.bones.length;n<i;n++)this.boneInverses.push(new Me)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){const n=new Me;this.bones[e]&&n.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(n)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){const n=this.bones[e];n&&n.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){const n=this.bones[e];n&&(n.parent&&n.parent.isBone?(n.matrix.copy(n.parent.matrixWorld).invert(),n.matrix.multiply(n.matrixWorld)):n.matrix.copy(n.matrixWorld),n.matrix.decompose(n.position,n.quaternion,n.scale))}}update(){const e=this.bones,t=this.boneInverses,n=this.boneMatrices,i=this.boneTexture;for(let s=0,a=e.length;s<a;s++){const o=e[s]?e[s].matrixWorld:md;wl.multiplyMatrices(o,t[s]),wl.toArray(n,16*s)}i!==null&&(i.needsUpdate=!0)}clone(){return new jr(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(4*this.bones.length);e=4*Math.ceil(e/4),e=Math.max(e,4);const t=new Float32Array(e*e*4);t.set(this.boneMatrices);const n=new wn(t,e,e,1023,1015);return n.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=n,this}getBoneByName(e){for(let t=0,n=this.bones.length;t<n;t++){const i=this.bones[t];if(i.name===e)return i}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let n=0,i=e.bones.length;n<i;n++){const s=e.bones[n];let a=t[s];a===void 0&&(console.warn("THREE.Skeleton: No bone found with UUID:",s),a=new Sa),this.bones.push(a),this.boneInverses.push(new Me().fromArray(e.boneInverses[n]))}return this.init(),this}toJSON(){const e={metadata:{version:4.6,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;const t=this.bones,n=this.boneInverses;for(let i=0,s=t.length;i<s;i++){const a=t[i];e.bones.push(a.uuid);const o=n[i];e.boneInverses.push(o.toArray())}return e}}class fi extends Ve{constructor(e,t,n,i=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){const e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}}const mi=new Me,Al=new Me,qr=[],Rl=new pt,gd=new Me,Hi=new Qe,Vi=new ot;class Cl extends Qe{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new fi(new Float32Array(16*n),16),this.instanceColor=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,gd)}computeBoundingBox(){const e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new pt),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,mi),Rl.copy(e.boundingBox).applyMatrix4(mi),this.boundingBox.union(Rl)}computeBoundingSphere(){const e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new ot),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,mi),Vi.copy(e.boundingSphere).applyMatrix4(mi),this.boundingSphere.union(Vi)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,3*e)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,16*e)}raycast(e,t){const n=this.matrixWorld,i=this.count;if(Hi.geometry=this.geometry,Hi.material=this.material,Hi.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Vi.copy(this.boundingSphere),Vi.applyMatrix4(n),e.ray.intersectsSphere(Vi)!==!1))for(let s=0;s<i;s++){this.getMatrixAt(s,mi),Al.multiplyMatrices(n,mi),Hi.matrixWorld=Al,Hi.raycast(e,qr);for(let a=0,o=qr.length;a<o;a++){const l=qr[a];l.instanceId=s,l.object=this,t.push(l)}qr.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new fi(new Float32Array(3*this.instanceMatrix.count),3)),t.toArray(this.instanceColor.array,3*e)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,16*e)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"})}}function _d(r,e){return r.z-e.z}function vd(r,e){return e.z-r.z}class xd{constructor(){this.index=0,this.pool=[],this.list=[]}push(e,t){const n=this.pool,i=this.list;this.index>=n.length&&n.push({start:-1,count:-1,z:-1});const s=n[this.index];i.push(s),this.index++,s.start=e.start,s.count=e.count,s.z=t}reset(){this.list.length=0,this.index=0}}const gi="batchId",dn=new Me,Ll=new Me,yd=new Me,Pl=new Me,ba=new Ni,Yr=new pt,An=new ot,ki=new w,Ta=new xd,ht=new Qe,Zr=[];function Md(r,e,t=0){const n=e.itemSize;if(r.isInterleavedBufferAttribute||r.array.constructor!==e.array.constructor){const i=r.count;for(let s=0;s<i;s++)for(let a=0;a<n;a++)e.setComponent(s+t,a,r.getComponent(s,a))}else e.array.set(r.array,t*n);e.needsUpdate=!0}class Il extends Qe{get maxGeometryCount(){return this._maxGeometryCount}constructor(e,t,n=2*t,i){super(new Ae,i),this.isBatchedMesh=!0,this.perObjectFrustumCulled=!0,this.sortObjects=!0,this.boundingBox=null,this.boundingSphere=null,this.customSort=null,this._drawRanges=[],this._reservedRanges=[],this._visibility=[],this._active=[],this._bounds=[],this._maxGeometryCount=e,this._maxVertexCount=t,this._maxIndexCount=n,this._geometryInitialized=!1,this._geometryCount=0,this._multiDrawCounts=new Int32Array(e),this._multiDrawStarts=new Int32Array(e),this._multiDrawCount=0,this._visibilityChanged=!0,this._matricesTexture=null,this._initMatricesTexture()}_initMatricesTexture(){let e=Math.sqrt(4*this._maxGeometryCount);e=4*Math.ceil(e/4),e=Math.max(e,4);const t=new Float32Array(e*e*4),n=new wn(t,e,e,1023,1015);this._matricesTexture=n}_initializeGeometry(e){const t=this.geometry,n=this._maxVertexCount,i=this._maxGeometryCount,s=this._maxIndexCount;if(this._geometryInitialized===!1){for(const o in e.attributes){const l=e.getAttribute(o),{array:c,itemSize:h,normalized:u}=l,d=new c.constructor(n*h),p=new l.constructor(d,h,u);p.setUsage(l.usage),t.setAttribute(o,p)}if(e.getIndex()!==null){const o=n>65536?new Uint32Array(s):new Uint16Array(s);t.setIndex(new Ve(o,1))}const a=i>65536?new Uint32Array(n):new Uint16Array(n);t.setAttribute(gi,new Ve(a,1)),this._geometryInitialized=!0}}_validateGeometry(e){if(e.getAttribute(gi))throw new Error(`BatchedMesh: Geometry cannot use attribute "${gi}"`);const t=this.geometry;if(!!e.getIndex()!=!!t.getIndex())throw new Error('BatchedMesh: All geometries must consistently have "index".');for(const n in t.attributes){if(n===gi)continue;if(!e.hasAttribute(n))throw new Error(`BatchedMesh: Added geometry missing "${n}". All geometries must have consistent attributes.`);const i=e.getAttribute(n),s=t.getAttribute(n);if(i.itemSize!==s.itemSize||i.normalized!==s.normalized)throw new Error("BatchedMesh: All attributes must have a consistent itemSize and normalized value.")}}setCustomSort(e){return this.customSort=e,this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new pt);const e=this._geometryCount,t=this.boundingBox,n=this._active;t.makeEmpty();for(let i=0;i<e;i++)n[i]!==!1&&(this.getMatrixAt(i,dn),this.getBoundingBoxAt(i,Yr).applyMatrix4(dn),t.union(Yr))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ot);const e=this._geometryCount,t=this.boundingSphere,n=this._active;t.makeEmpty();for(let i=0;i<e;i++)n[i]!==!1&&(this.getMatrixAt(i,dn),this.getBoundingSphereAt(i,An).applyMatrix4(dn),t.union(An))}addGeometry(e,t=-1,n=-1){if(this._initializeGeometry(e),this._validateGeometry(e),this._geometryCount>=this._maxGeometryCount)throw new Error("BatchedMesh: Maximum geometry count reached.");const i={vertexStart:-1,vertexCount:-1,indexStart:-1,indexCount:-1};let s=null;const a=this._reservedRanges,o=this._drawRanges,l=this._bounds;this._geometryCount!==0&&(s=a[a.length-1]),i.vertexCount=t===-1?e.getAttribute("position").count:t,i.vertexStart=s===null?0:s.vertexStart+s.vertexCount;const c=e.getIndex(),h=c!==null;if(h&&(i.indexCount=n===-1?c.count:n,i.indexStart=s===null?0:s.indexStart+s.indexCount),i.indexStart!==-1&&i.indexStart+i.indexCount>this._maxIndexCount||i.vertexStart+i.vertexCount>this._maxVertexCount)throw new Error("BatchedMesh: Reserved space request exceeds the maximum buffer size.");const u=this._visibility,d=this._active,p=this._matricesTexture,m=this._matricesTexture.image.data;u.push(!0),d.push(!0);const g=this._geometryCount;this._geometryCount++,yd.toArray(m,16*g),p.needsUpdate=!0,a.push(i),o.push({start:h?i.indexStart:i.vertexStart,count:-1}),l.push({boxInitialized:!1,box:new pt,sphereInitialized:!1,sphere:new ot});const f=this.geometry.getAttribute(gi);for(let x=0;x<i.vertexCount;x++)f.setX(i.vertexStart+x,g);return f.needsUpdate=!0,this.setGeometryAt(g,e),g}setGeometryAt(e,t){if(e>=this._geometryCount)throw new Error("BatchedMesh: Maximum geometry count reached.");this._validateGeometry(t);const n=this.geometry,i=n.getIndex()!==null,s=n.getIndex(),a=t.getIndex(),o=this._reservedRanges[e];if(i&&a.count>o.indexCount||t.attributes.position.count>o.vertexCount)throw new Error("BatchedMesh: Reserved space not large enough for provided geometry.");const l=o.vertexStart,c=o.vertexCount;for(const p in n.attributes){if(p===gi)continue;const m=t.getAttribute(p),g=n.getAttribute(p);Md(m,g,l);const f=m.itemSize;for(let x=m.count,v=c;x<v;x++){const _=l+x;for(let M=0;M<f;M++)g.setComponent(_,M,0)}g.needsUpdate=!0}if(i){const p=o.indexStart;for(let m=0;m<a.count;m++)s.setX(p+m,l+a.getX(m));for(let m=a.count,g=o.indexCount;m<g;m++)s.setX(p+m,l);s.needsUpdate=!0}const h=this._bounds[e];t.boundingBox!==null?(h.box.copy(t.boundingBox),h.boxInitialized=!0):h.boxInitialized=!1,t.boundingSphere!==null?(h.sphere.copy(t.boundingSphere),h.sphereInitialized=!0):h.sphereInitialized=!1;const u=this._drawRanges[e],d=t.getAttribute("position");return u.count=i?a.count:d.count,this._visibilityChanged=!0,e}deleteGeometry(e){const t=this._active;return e>=t.length||t[e]===!1||(t[e]=!1,this._visibilityChanged=!0),this}getBoundingBoxAt(e,t){if(this._active[e]===!1)return this;const n=this._bounds[e],i=n.box,s=this.geometry;if(n.boxInitialized===!1){i.makeEmpty();const a=s.index,o=s.attributes.position,l=this._drawRanges[e];for(let c=l.start,h=l.start+l.count;c<h;c++){let u=c;a&&(u=a.getX(u)),i.expandByPoint(ki.fromBufferAttribute(o,u))}n.boxInitialized=!0}return t.copy(i),t}getBoundingSphereAt(e,t){if(this._active[e]===!1)return this;const n=this._bounds[e],i=n.sphere,s=this.geometry;if(n.sphereInitialized===!1){i.makeEmpty(),this.getBoundingBoxAt(e,Yr),Yr.getCenter(i.center);const a=s.index,o=s.attributes.position,l=this._drawRanges[e];let c=0;for(let h=l.start,u=l.start+l.count;h<u;h++){let d=h;a&&(d=a.getX(d)),ki.fromBufferAttribute(o,d),c=Math.max(c,i.center.distanceToSquared(ki))}i.radius=Math.sqrt(c),n.sphereInitialized=!0}return t.copy(i),t}setMatrixAt(e,t){const n=this._active,i=this._matricesTexture,s=this._matricesTexture.image.data;return e>=this._geometryCount||n[e]===!1||(t.toArray(s,16*e),i.needsUpdate=!0),this}getMatrixAt(e,t){const n=this._active,i=this._matricesTexture.image.data;return e>=this._geometryCount||n[e]===!1?null:t.fromArray(i,16*e)}setVisibleAt(e,t){const n=this._visibility,i=this._active;return e>=this._geometryCount||i[e]===!1||n[e]===t||(n[e]=t,this._visibilityChanged=!0),this}getVisibleAt(e){const t=this._visibility,n=this._active;return!(e>=this._geometryCount||n[e]===!1)&&t[e]}raycast(e,t){const n=this._visibility,i=this._active,s=this._drawRanges,a=this._geometryCount,o=this.matrixWorld,l=this.geometry;ht.material=this.material,ht.geometry.index=l.index,ht.geometry.attributes=l.attributes,ht.geometry.boundingBox===null&&(ht.geometry.boundingBox=new pt),ht.geometry.boundingSphere===null&&(ht.geometry.boundingSphere=new ot);for(let c=0;c<a;c++){if(!n[c]||!i[c])continue;const h=s[c];ht.geometry.setDrawRange(h.start,h.count),this.getMatrixAt(c,ht.matrixWorld).premultiply(o),this.getBoundingBoxAt(c,ht.geometry.boundingBox),this.getBoundingSphereAt(c,ht.geometry.boundingSphere),ht.raycast(e,Zr);for(let u=0,d=Zr.length;u<d;u++){const p=Zr[u];p.object=this,p.batchId=c,t.push(p)}Zr.length=0}ht.material=null,ht.geometry.index=null,ht.geometry.attributes={},ht.geometry.setDrawRange(0,1/0)}copy(e){return super.copy(e),this.geometry=e.geometry.clone(),this.perObjectFrustumCulled=e.perObjectFrustumCulled,this.sortObjects=e.sortObjects,this.boundingBox=e.boundingBox!==null?e.boundingBox.clone():null,this.boundingSphere=e.boundingSphere!==null?e.boundingSphere.clone():null,this._drawRanges=e._drawRanges.map((t=>({...t}))),this._reservedRanges=e._reservedRanges.map((t=>({...t}))),this._visibility=e._visibility.slice(),this._active=e._active.slice(),this._bounds=e._bounds.map((t=>({boxInitialized:t.boxInitialized,box:t.box.clone(),sphereInitialized:t.sphereInitialized,sphere:t.sphere.clone()}))),this._maxGeometryCount=e._maxGeometryCount,this._maxVertexCount=e._maxVertexCount,this._maxIndexCount=e._maxIndexCount,this._geometryInitialized=e._geometryInitialized,this._geometryCount=e._geometryCount,this._multiDrawCounts=e._multiDrawCounts.slice(),this._multiDrawStarts=e._multiDrawStarts.slice(),this._matricesTexture=e._matricesTexture.clone(),this._matricesTexture.image.data=this._matricesTexture.image.slice(),this}dispose(){return this.geometry.dispose(),this._matricesTexture.dispose(),this._matricesTexture=null,this}onBeforeRender(e,t,n,i,s){if(!this._visibilityChanged&&!this.perObjectFrustumCulled&&!this.sortObjects)return;const a=i.getIndex(),o=a===null?1:a.array.BYTES_PER_ELEMENT,l=this._visibility,c=this._multiDrawStarts,h=this._multiDrawCounts,u=this._drawRanges,d=this.perObjectFrustumCulled;d&&(Pl.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse).multiply(this.matrixWorld),ba.setFromProjectionMatrix(Pl,e.isWebGPURenderer?2001:2e3));let p=0;if(this.sortObjects){Ll.copy(this.matrixWorld).invert(),ki.setFromMatrixPosition(n.matrixWorld).applyMatrix4(Ll);for(let f=0,x=l.length;f<x;f++)if(l[f]){this.getMatrixAt(f,dn),this.getBoundingSphereAt(f,An).applyMatrix4(dn);let v=!1;if(d&&(v=!ba.intersectsSphere(An)),!v){const _=ki.distanceTo(An.center);Ta.push(u[f],_)}}const m=Ta.list,g=this.customSort;g===null?m.sort(s.transparent?vd:_d):g.call(this,m,n);for(let f=0,x=m.length;f<x;f++){const v=m[f];c[p]=v.start*o,h[p]=v.count,p++}Ta.reset()}else for(let m=0,g=l.length;m<g;m++)if(l[m]){let f=!1;if(d&&(this.getMatrixAt(m,dn),this.getBoundingSphereAt(m,An).applyMatrix4(dn),f=!ba.intersectsSphere(An)),!f){const x=u[m];c[p]=x.start*o,h[p]=x.count,p++}}this._multiDrawCount=p,this._visibilityChanged=!1}onBeforeShadow(e,t,n,i,s,a){this.onBeforeRender(e,null,i,s,a)}}class gt extends ct{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new de(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}const Ul=new w,Dl=new w,Nl=new Me,Ea=new Zn,Jr=new ot;class pn extends Be{constructor(e=new Ae,t=new gt){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[0];for(let i=1,s=t.count;i<s;i++)Ul.fromBufferAttribute(t,i-1),Dl.fromBufferAttribute(t,i),n[i]=n[i-1],n[i]+=Ul.distanceTo(Dl);e.setAttribute("lineDistance",new me(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){const n=this.geometry,i=this.matrixWorld,s=e.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Jr.copy(n.boundingSphere),Jr.applyMatrix4(i),Jr.radius+=s,e.ray.intersectsSphere(Jr)===!1)return;Nl.copy(i).invert(),Ea.copy(e.ray).applyMatrix4(Nl);const o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=new w,h=new w,u=new w,d=new w,p=this.isLineSegments?2:1,m=n.index,g=n.attributes.position;if(m!==null)for(let f=Math.max(0,a.start),x=Math.min(m.count,a.start+a.count)-1;f<x;f+=p){const v=m.getX(f),_=m.getX(f+1);if(c.fromBufferAttribute(g,v),h.fromBufferAttribute(g,_),Ea.distanceSqToSegment(c,h,d,u)>l)continue;d.applyMatrix4(this.matrixWorld);const M=e.ray.origin.distanceTo(d);M<e.near||M>e.far||t.push({distance:M,point:u.clone().applyMatrix4(this.matrixWorld),index:f,face:null,faceIndex:null,object:this})}else for(let f=Math.max(0,a.start),x=Math.min(g.count,a.start+a.count)-1;f<x;f+=p){if(c.fromBufferAttribute(g,f),h.fromBufferAttribute(g,f+1),Ea.distanceSqToSegment(c,h,d,u)>l)continue;d.applyMatrix4(this.matrixWorld);const v=e.ray.origin.distanceTo(d);v<e.near||v>e.far||t.push({distance:v,point:u.clone().applyMatrix4(this.matrixWorld),index:f,face:null,faceIndex:null,object:this})}}updateMorphTargets(){const e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){const n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let i=0,s=n.length;i<s;i++){const a=n[i].name||String(i);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=i}}}}}const Ol=new w,Fl=new w;class kt extends pn{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[];for(let i=0,s=t.count;i<s;i+=2)Ol.fromBufferAttribute(t,i),Fl.fromBufferAttribute(t,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+Ol.distanceTo(Fl);e.setAttribute("lineDistance",new me(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class Bl extends pn{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}}class wa extends ct{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new de(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const zl=new Me,Aa=new Zn,Kr=new ot,$r=new w;class Gl extends Be{constructor(e=new Ae,t=new wa){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){const n=this.geometry,i=this.matrixWorld,s=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Kr.copy(n.boundingSphere),Kr.applyMatrix4(i),Kr.radius+=s,e.ray.intersectsSphere(Kr)===!1)return;zl.copy(i).invert(),Aa.copy(e.ray).applyMatrix4(zl);const o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,h=n.attributes.position;if(c!==null)for(let u=Math.max(0,a.start),d=Math.min(c.count,a.start+a.count);u<d;u++){const p=c.getX(u);$r.fromBufferAttribute(h,p),Hl($r,p,l,i,e,t,this)}else for(let u=Math.max(0,a.start),d=Math.min(h.count,a.start+a.count);u<d;u++)$r.fromBufferAttribute(h,u),Hl($r,u,l,i,e,t,this)}updateMorphTargets(){const e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){const n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let i=0,s=n.length;i<s;i++){const a=n[i].name||String(i);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=i}}}}}function Hl(r,e,t,n,i,s,a){const o=Aa.distanceSqToPoint(r);if(o<t){const l=new w;Aa.closestPointToPoint(r,l),l.applyMatrix4(n);const c=i.ray.origin.distanceTo(l);if(c<i.near||c>i.far)return;s.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,object:a})}}class Qr extends Ze{constructor(e,t,n,i,s,a,o,l,c,h,u,d){super(null,a,o,l,c,h,i,s,u,d),this.isCompressedTexture=!0,this.image={width:t,height:n},this.mipmaps=e,this.flipY=!1,this.generateMipmaps=!1}}class Ot{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(e,t){const n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){const t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){const t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){const e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const t=[];let n,i=this.getPoint(0),s=0;t.push(0);for(let a=1;a<=e;a++)n=this.getPoint(a/e),s+=n.distanceTo(i),t.push(s),i=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t){const n=this.getLengths();let i=0;const s=n.length;let a;a=t||e*n[s-1];let o,l=0,c=s-1;for(;l<=c;)if(i=Math.floor(l+(c-l)/2),o=n[i]-a,o<0)l=i+1;else{if(!(o>0)){c=i;break}c=i-1}if(i=c,n[i]===a)return i/(s-1);const h=n[i];return(i+(a-h)/(n[i+1]-h))/(s-1)}getTangent(e,t){let i=e-1e-4,s=e+1e-4;i<0&&(i=0),s>1&&(s=1);const a=this.getPoint(i),o=this.getPoint(s),l=t||(a.isVector2?new ie:new w);return l.copy(o).sub(a).normalize(),l}getTangentAt(e,t){const n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t){const n=new w,i=[],s=[],a=[],o=new w,l=new Me;for(let p=0;p<=e;p++){const m=p/e;i[p]=this.getTangentAt(m,new w)}s[0]=new w,a[0]=new w;let c=Number.MAX_VALUE;const h=Math.abs(i[0].x),u=Math.abs(i[0].y),d=Math.abs(i[0].z);h<=c&&(c=h,n.set(1,0,0)),u<=c&&(c=u,n.set(0,1,0)),d<=c&&n.set(0,0,1),o.crossVectors(i[0],n).normalize(),s[0].crossVectors(i[0],o),a[0].crossVectors(i[0],s[0]);for(let p=1;p<=e;p++){if(s[p]=s[p-1].clone(),a[p]=a[p-1].clone(),o.crossVectors(i[p-1],i[p]),o.length()>Number.EPSILON){o.normalize();const m=Math.acos(qe(i[p-1].dot(i[p]),-1,1));s[p].applyMatrix4(l.makeRotationAxis(o,m))}a[p].crossVectors(i[p],s[p])}if(t===!0){let p=Math.acos(qe(s[0].dot(s[e]),-1,1));p/=e,i[0].dot(o.crossVectors(s[0],s[e]))>0&&(p=-p);for(let m=1;m<=e;m++)s[m].applyMatrix4(l.makeRotationAxis(i[m],p*m)),a[m].crossVectors(i[m],s[m])}return{tangents:i,normals:s,binormals:a}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){const e={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}}class es extends Ot{constructor(e=0,t=0,n=1,i=1,s=0,a=2*Math.PI,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=i,this.aStartAngle=s,this.aEndAngle=a,this.aClockwise=o,this.aRotation=l}getPoint(e,t){const n=t||new ie,i=2*Math.PI;let s=this.aEndAngle-this.aStartAngle;const a=Math.abs(s)<Number.EPSILON;for(;s<0;)s+=i;for(;s>i;)s-=i;s<Number.EPSILON&&(s=a?0:i),this.aClockwise!==!0||a||(s===i?s=-i:s-=i);const o=this.aStartAngle+e*s;let l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){const h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=l-this.aX,p=c-this.aY;l=d*h-p*u+this.aX,c=d*u+p*h+this.aY}return n.set(l,c)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){const e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}}class Vl extends es{constructor(e,t,n,i,s,a){super(e,t,n,n,i,s,a),this.isArcCurve=!0,this.type="ArcCurve"}}function Ra(){let r=0,e=0,t=0,n=0;function i(s,a,o,l){r=s,e=o,t=-3*s+3*a-2*o-l,n=2*s-2*a+o+l}return{initCatmullRom:function(s,a,o,l,c){i(a,o,c*(o-s),c*(l-a))},initNonuniformCatmullRom:function(s,a,o,l,c,h,u){let d=(a-s)/c-(o-s)/(c+h)+(o-a)/h,p=(o-a)/h-(l-a)/(h+u)+(l-o)/u;d*=h,p*=h,i(a,o,d,p)},calc:function(s){const a=s*s;return r+e*s+t*a+n*(a*s)}}}const ts=new w,Ca=new Ra,La=new Ra,Pa=new Ra;class kl extends Ot{constructor(e=[],t=!1,n="centripetal",i=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=i}getPoint(e,t=new w){const n=t,i=this.points,s=i.length,a=(s-(this.closed?0:1))*e;let o,l,c=Math.floor(a),h=a-c;this.closed?c+=c>0?0:(Math.floor(Math.abs(c)/s)+1)*s:h===0&&c===s-1&&(c=s-2,h=1),this.closed||c>0?o=i[(c-1)%s]:(ts.subVectors(i[0],i[1]).add(i[0]),o=ts);const u=i[c%s],d=i[(c+1)%s];if(this.closed||c+2<s?l=i[(c+2)%s]:(ts.subVectors(i[s-1],i[s-2]).add(i[s-1]),l=ts),this.curveType==="centripetal"||this.curveType==="chordal"){const p=this.curveType==="chordal"?.5:.25;let m=Math.pow(o.distanceToSquared(u),p),g=Math.pow(u.distanceToSquared(d),p),f=Math.pow(d.distanceToSquared(l),p);g<1e-4&&(g=1),m<1e-4&&(m=g),f<1e-4&&(f=g),Ca.initNonuniformCatmullRom(o.x,u.x,d.x,l.x,m,g,f),La.initNonuniformCatmullRom(o.y,u.y,d.y,l.y,m,g,f),Pa.initNonuniformCatmullRom(o.z,u.z,d.z,l.z,m,g,f)}else this.curveType==="catmullrom"&&(Ca.initCatmullRom(o.x,u.x,d.x,l.x,this.tension),La.initCatmullRom(o.y,u.y,d.y,l.y,this.tension),Pa.initCatmullRom(o.z,u.z,d.z,l.z,this.tension));return n.set(Ca.calc(h),La.calc(h),Pa.calc(h)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const i=e.points[t];this.points.push(i.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){const e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){const i=this.points[t];e.points.push(i.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const i=e.points[t];this.points.push(new w().fromArray(i))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}}function Wl(r,e,t,n,i){const s=.5*(n-e),a=.5*(i-t),o=r*r;return(2*t-2*n+s+a)*(r*o)+(-3*t+3*n-2*s-a)*o+s*r+t}function Wi(r,e,t,n){return(function(i,s){const a=1-i;return a*a*s})(r,e)+(function(i,s){return 2*(1-i)*i*s})(r,t)+(function(i,s){return i*i*s})(r,n)}function Xi(r,e,t,n,i){return(function(s,a){const o=1-s;return o*o*o*a})(r,e)+(function(s,a){const o=1-s;return 3*o*o*s*a})(r,t)+(function(s,a){return 3*(1-s)*s*s*a})(r,n)+(function(s,a){return s*s*s*a})(r,i)}class Ia extends Ot{constructor(e=new ie,t=new ie,n=new ie,i=new ie){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new ie){const n=t,i=this.v0,s=this.v1,a=this.v2,o=this.v3;return n.set(Xi(e,i.x,s.x,a.x,o.x),Xi(e,i.y,s.y,a.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class Xl extends Ot{constructor(e=new w,t=new w,n=new w,i=new w){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new w){const n=t,i=this.v0,s=this.v1,a=this.v2,o=this.v3;return n.set(Xi(e,i.x,s.x,a.x,o.x),Xi(e,i.y,s.y,a.y,o.y),Xi(e,i.z,s.z,a.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class Ua extends Ot{constructor(e=new ie,t=new ie){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new ie){const n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new ie){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class jl extends Ot{constructor(e=new w,t=new w){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new w){const n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new w){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class Da extends Ot{constructor(e=new ie,t=new ie,n=new ie){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new ie){const n=t,i=this.v0,s=this.v1,a=this.v2;return n.set(Wi(e,i.x,s.x,a.x),Wi(e,i.y,s.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class Na extends Ot{constructor(e=new w,t=new w,n=new w){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new w){const n=t,i=this.v0,s=this.v1,a=this.v2;return n.set(Wi(e,i.x,s.x,a.x),Wi(e,i.y,s.y,a.y),Wi(e,i.z,s.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class Oa extends Ot{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new ie){const n=t,i=this.points,s=(i.length-1)*e,a=Math.floor(s),o=s-a,l=i[a===0?a:a-1],c=i[a],h=i[a>i.length-2?i.length-1:a+1],u=i[a>i.length-3?i.length-1:a+2];return n.set(Wl(o,l.x,c.x,h.x,u.x),Wl(o,l.y,c.y,h.y,u.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const i=e.points[t];this.points.push(i.clone())}return this}toJSON(){const e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){const i=this.points[t];e.points.push(i.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const i=e.points[t];this.points.push(new ie().fromArray(i))}return this}}var ns=Object.freeze({__proto__:null,ArcCurve:Vl,CatmullRomCurve3:kl,CubicBezierCurve:Ia,CubicBezierCurve3:Xl,EllipseCurve:es,LineCurve:Ua,LineCurve3:jl,QuadraticBezierCurve:Da,QuadraticBezierCurve3:Na,SplineCurve:Oa});class ql extends Ot{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){const e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);if(!e.equals(t)){const n=e.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new ns[n](t,e))}return this}getPoint(e,t){const n=e*this.getLength(),i=this.getCurveLengths();let s=0;for(;s<i.length;){if(i[s]>=n){const a=i[s]-n,o=this.curves[s],l=o.getLength(),c=l===0?0:1-a/l;return o.getPointAt(c,t)}s++}return null}getLength(){const e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const e=[];let t=0;for(let n=0,i=this.curves.length;n<i;n++)t+=this.curves[n].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){const t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){const t=[];let n;for(let i=0,s=this.curves;i<s.length;i++){const a=s[i],o=a.isEllipseCurve?2*e:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?e*a.points.length:e,l=a.getPoints(o);for(let c=0;c<l.length;c++){const h=l[c];n&&n.equals(h)||(t.push(h),n=h)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){const i=e.curves[t];this.curves.push(i.clone())}return this.autoClose=e.autoClose,this}toJSON(){const e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,n=this.curves.length;t<n;t++){const i=this.curves[t];e.curves.push(i.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){const i=e.curves[t];this.curves.push(new ns[i.type]().fromJSON(i))}return this}}class ji extends ql{constructor(e){super(),this.type="Path",this.currentPoint=new ie,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,n=e.length;t<n;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){const n=new Ua(this.currentPoint.clone(),new ie(e,t));return this.curves.push(n),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,n,i){const s=new Da(this.currentPoint.clone(),new ie(e,t),new ie(n,i));return this.curves.push(s),this.currentPoint.set(n,i),this}bezierCurveTo(e,t,n,i,s,a){const o=new Ia(this.currentPoint.clone(),new ie(e,t),new ie(n,i),new ie(s,a));return this.curves.push(o),this.currentPoint.set(s,a),this}splineThru(e){const t=[this.currentPoint.clone()].concat(e),n=new Oa(t);return this.curves.push(n),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,n,i,s,a){const o=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(e+o,t+l,n,i,s,a),this}absarc(e,t,n,i,s,a){return this.absellipse(e,t,n,n,i,s,a),this}ellipse(e,t,n,i,s,a,o,l){const c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(e+c,t+h,n,i,s,a,o,l),this}absellipse(e,t,n,i,s,a,o,l){const c=new es(e,t,n,i,s,a,o,l);if(this.curves.length>0){const u=c.getPoint(0);u.equals(this.currentPoint)||this.lineTo(u.x,u.y)}this.curves.push(c);const h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){const e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}}class qi extends Ae{constructor(e=[new ie(0,-.5),new ie(.5,0),new ie(0,.5)],t=12,n=0,i=2*Math.PI){super(),this.type="LatheGeometry",this.parameters={points:e,segments:t,phiStart:n,phiLength:i},t=Math.floor(t),i=qe(i,0,2*Math.PI);const s=[],a=[],o=[],l=[],c=[],h=1/t,u=new w,d=new ie,p=new w,m=new w,g=new w;let f=0,x=0;for(let v=0;v<=e.length-1;v++)switch(v){case 0:f=e[v+1].x-e[v].x,x=e[v+1].y-e[v].y,p.x=1*x,p.y=-f,p.z=0*x,g.copy(p),p.normalize(),l.push(p.x,p.y,p.z);break;case e.length-1:l.push(g.x,g.y,g.z);break;default:f=e[v+1].x-e[v].x,x=e[v+1].y-e[v].y,p.x=1*x,p.y=-f,p.z=0*x,m.copy(p),p.x+=g.x,p.y+=g.y,p.z+=g.z,p.normalize(),l.push(p.x,p.y,p.z),g.copy(m)}for(let v=0;v<=t;v++){const _=n+v*h*i,M=Math.sin(_),C=Math.cos(_);for(let b=0;b<=e.length-1;b++){u.x=e[b].x*M,u.y=e[b].y,u.z=e[b].x*C,a.push(u.x,u.y,u.z),d.x=v/t,d.y=b/(e.length-1),o.push(d.x,d.y);const A=l[3*b+0]*M,N=l[3*b+1],I=l[3*b+0]*C;c.push(A,N,I)}}for(let v=0;v<t;v++)for(let _=0;_<e.length-1;_++){const M=_+v*e.length,C=M,b=M+e.length,A=M+e.length+1,N=M+1;s.push(C,b,N),s.push(A,N,b)}this.setIndex(s),this.setAttribute("position",new me(a,3)),this.setAttribute("uv",new me(o,2)),this.setAttribute("normal",new me(c,3))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new qi(e.points,e.segments,e.phiStart,e.phiLength)}}class is extends qi{constructor(e=1,t=1,n=4,i=8){const s=new ji;s.absarc(0,-t/2,e,1.5*Math.PI,0),s.absarc(0,t/2,e,0,.5*Math.PI),super(s.getPoints(n),i),this.type="CapsuleGeometry",this.parameters={radius:e,length:t,capSegments:n,radialSegments:i}}static fromJSON(e){return new is(e.radius,e.length,e.capSegments,e.radialSegments)}}class rs extends Ae{constructor(e=1,t=32,n=0,i=2*Math.PI){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:i},t=Math.max(3,t);const s=[],a=[],o=[],l=[],c=new w,h=new ie;a.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let u=0,d=3;u<=t;u++,d+=3){const p=n+u/t*i;c.x=e*Math.cos(p),c.y=e*Math.sin(p),a.push(c.x,c.y,c.z),o.push(0,0,1),h.x=(a[d]/e+1)/2,h.y=(a[d+1]/e+1)/2,l.push(h.x,h.y)}for(let u=1;u<=t;u++)s.push(u,u+1,0);this.setIndex(s),this.setAttribute("position",new me(a,3)),this.setAttribute("normal",new me(o,3)),this.setAttribute("uv",new me(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new rs(e.radius,e.segments,e.thetaStart,e.thetaLength)}}class _i extends Ae{constructor(e=1,t=1,n=1,i=32,s=1,a=!1,o=0,l=2*Math.PI){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:i,heightSegments:s,openEnded:a,thetaStart:o,thetaLength:l};const c=this;i=Math.floor(i),s=Math.floor(s);const h=[],u=[],d=[],p=[];let m=0;const g=[],f=n/2;let x=0;function v(_){const M=m,C=new ie,b=new w;let A=0;const N=_===!0?e:t,I=_===!0?1:-1;for(let Y=1;Y<=i;Y++)u.push(0,f*I,0),d.push(0,I,0),p.push(.5,.5),m++;const F=m;for(let Y=0;Y<=i;Y++){const L=Y/i*l+o,W=Math.cos(L),X=Math.sin(L);b.x=N*X,b.y=f*I,b.z=N*W,u.push(b.x,b.y,b.z),d.push(0,I,0),C.x=.5*W+.5,C.y=.5*X*I+.5,p.push(C.x,C.y),m++}for(let Y=0;Y<i;Y++){const L=M+Y,W=F+Y;_===!0?h.push(W,W+1,L):h.push(W+1,W,L),A+=3}c.addGroup(x,A,_===!0?1:2),x+=A}(function(){const _=new w,M=new w;let C=0;const b=(t-e)/n;for(let A=0;A<=s;A++){const N=[],I=A/s,F=I*(t-e)+e;for(let Y=0;Y<=i;Y++){const L=Y/i,W=L*l+o,X=Math.sin(W),oe=Math.cos(W);M.x=F*X,M.y=-I*n+f,M.z=F*oe,u.push(M.x,M.y,M.z),_.set(X,b,oe).normalize(),d.push(_.x,_.y,_.z),p.push(L,1-I),N.push(m++)}g.push(N)}for(let A=0;A<i;A++)for(let N=0;N<s;N++){const I=g[N][A],F=g[N+1][A],Y=g[N+1][A+1],L=g[N][A+1];h.push(I,F,L),h.push(F,Y,L),C+=6}c.addGroup(x,C,0),x+=C})(),a===!1&&(e>0&&v(!0),t>0&&v(!1)),this.setIndex(h),this.setAttribute("position",new me(u,3)),this.setAttribute("normal",new me(d,3)),this.setAttribute("uv",new me(p,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new _i(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class ss extends _i{constructor(e=1,t=1,n=32,i=1,s=!1,a=0,o=2*Math.PI){super(0,e,t,n,i,s,a,o),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:n,heightSegments:i,openEnded:s,thetaStart:a,thetaLength:o}}static fromJSON(e){return new ss(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class fn extends Ae{constructor(e=[],t=[],n=1,i=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:n,detail:i};const s=[],a=[];function o(d,p,m,g){const f=g+1,x=[];for(let v=0;v<=f;v++){x[v]=[];const _=d.clone().lerp(m,v/f),M=p.clone().lerp(m,v/f),C=f-v;for(let b=0;b<=C;b++)x[v][b]=b===0&&v===f?_:_.clone().lerp(M,b/C)}for(let v=0;v<f;v++)for(let _=0;_<2*(f-v)-1;_++){const M=Math.floor(_/2);_%2==0?(l(x[v][M+1]),l(x[v+1][M]),l(x[v][M])):(l(x[v][M+1]),l(x[v+1][M+1]),l(x[v+1][M]))}}function l(d){s.push(d.x,d.y,d.z)}function c(d,p){const m=3*d;p.x=e[m+0],p.y=e[m+1],p.z=e[m+2]}function h(d,p,m,g){g<0&&d.x===1&&(a[p]=d.x-1),m.x===0&&m.z===0&&(a[p]=g/2/Math.PI+.5)}function u(d){return Math.atan2(d.z,-d.x)}(function(d){const p=new w,m=new w,g=new w;for(let f=0;f<t.length;f+=3)c(t[f+0],p),c(t[f+1],m),c(t[f+2],g),o(p,m,g,d)})(i),(function(d){const p=new w;for(let m=0;m<s.length;m+=3)p.x=s[m+0],p.y=s[m+1],p.z=s[m+2],p.normalize().multiplyScalar(d),s[m+0]=p.x,s[m+1]=p.y,s[m+2]=p.z})(n),(function(){const d=new w;for(let m=0;m<s.length;m+=3){d.x=s[m+0],d.y=s[m+1],d.z=s[m+2];const g=u(d)/2/Math.PI+.5,f=(p=d,Math.atan2(-p.y,Math.sqrt(p.x*p.x+p.z*p.z))/Math.PI+.5);a.push(g,1-f)}var p;(function(){const m=new w,g=new w,f=new w,x=new w,v=new ie,_=new ie,M=new ie;for(let C=0,b=0;C<s.length;C+=9,b+=6){m.set(s[C+0],s[C+1],s[C+2]),g.set(s[C+3],s[C+4],s[C+5]),f.set(s[C+6],s[C+7],s[C+8]),v.set(a[b+0],a[b+1]),_.set(a[b+2],a[b+3]),M.set(a[b+4],a[b+5]),x.copy(m).add(g).add(f).divideScalar(3);const A=u(x);h(v,b+0,m,A),h(_,b+2,g,A),h(M,b+4,f,A)}})(),(function(){for(let m=0;m<a.length;m+=6){const g=a[m+0],f=a[m+2],x=a[m+4],v=Math.max(g,f,x),_=Math.min(g,f,x);v>.9&&_<.1&&(g<.2&&(a[m+0]+=1),f<.2&&(a[m+2]+=1),x<.2&&(a[m+4]+=1))}})()})(),this.setAttribute("position",new me(s,3)),this.setAttribute("normal",new me(s.slice(),3)),this.setAttribute("uv",new me(a,2)),i===0?this.computeVertexNormals():this.normalizeNormals()}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new fn(e.vertices,e.indices,e.radius,e.details)}}class as extends fn{constructor(e=1,t=0){const n=(1+Math.sqrt(5))/2,i=1/n;super([-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-i,-n,0,-i,n,0,i,-n,0,i,n,-i,-n,0,-i,n,0,i,-n,0,i,n,0,-n,0,-i,n,0,-i,-n,0,i,n,0,i],[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9],e,t),this.type="DodecahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new as(e.radius,e.detail)}}const os=new w,ls=new w,Fa=new w,cs=new xt;class Yl extends Ae{constructor(e=null,t=1){if(super(),this.type="EdgesGeometry",this.parameters={geometry:e,thresholdAngle:t},e!==null){const i=Math.pow(10,4),s=Math.cos(_n*t),a=e.getIndex(),o=e.getAttribute("position"),l=a?a.count:o.count,c=[0,0,0],h=["a","b","c"],u=new Array(3),d={},p=[];for(let m=0;m<l;m+=3){a?(c[0]=a.getX(m),c[1]=a.getX(m+1),c[2]=a.getX(m+2)):(c[0]=m,c[1]=m+1,c[2]=m+2);const{a:g,b:f,c:x}=cs;if(g.fromBufferAttribute(o,c[0]),f.fromBufferAttribute(o,c[1]),x.fromBufferAttribute(o,c[2]),cs.getNormal(Fa),u[0]=`${Math.round(g.x*i)},${Math.round(g.y*i)},${Math.round(g.z*i)}`,u[1]=`${Math.round(f.x*i)},${Math.round(f.y*i)},${Math.round(f.z*i)}`,u[2]=`${Math.round(x.x*i)},${Math.round(x.y*i)},${Math.round(x.z*i)}`,u[0]!==u[1]&&u[1]!==u[2]&&u[2]!==u[0])for(let v=0;v<3;v++){const _=(v+1)%3,M=u[v],C=u[_],b=cs[h[v]],A=cs[h[_]],N=`${M}_${C}`,I=`${C}_${M}`;I in d&&d[I]?(Fa.dot(d[I].normal)<=s&&(p.push(b.x,b.y,b.z),p.push(A.x,A.y,A.z)),d[I]=null):N in d||(d[N]={index0:c[v],index1:c[_],normal:Fa.clone()})}}for(const m in d)if(d[m]){const{index0:g,index1:f}=d[m];os.fromBufferAttribute(o,g),ls.fromBufferAttribute(o,f),p.push(os.x,os.y,os.z),p.push(ls.x,ls.y,ls.z)}this.setAttribute("position",new me(p,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}}class Rn extends ji{constructor(e){super(e),this.uuid=bt(),this.type="Shape",this.holes=[]}getPointsHoles(e){const t=[];for(let n=0,i=this.holes.length;n<i;n++)t[n]=this.holes[n].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){const i=e.holes[t];this.holes.push(i.clone())}return this}toJSON(){const e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,n=this.holes.length;t<n;t++){const i=this.holes[t];e.holes.push(i.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){const i=e.holes[t];this.holes.push(new ji().fromJSON(i))}return this}}const Sd=function(r,e,t=2){const n=e&&e.length,i=n?e[0]*t:r.length;let s=Zl(r,0,i,t,!0);const a=[];if(!s||s.next===s.prev)return a;let o,l,c,h,u,d,p;if(n&&(s=(function(m,g,f,x){const v=[];let _,M,C,b,A;for(_=0,M=g.length;_<M;_++)C=g[_]*x,b=_<M-1?g[_+1]*x:m.length,A=Zl(m,C,b,x,!1),A===A.next&&(A.steiner=!0),v.push(Ld(A));for(v.sort(Ad),_=0;_<v.length;_++)f=Rd(v[_],f);return f})(r,e,s,t)),r.length>80*t){o=c=r[0],l=h=r[1];for(let m=t;m<i;m+=t)u=r[m],d=r[m+1],u<o&&(o=u),d<l&&(l=d),u>c&&(c=u),d>h&&(h=d);p=Math.max(c-o,h-l),p=p!==0?32767/p:0}return Yi(s,a,t,o,l,p,0),a};function Zl(r,e,t,n,i){let s,a;if(i===(function(o,l,c,h){let u=0;for(let d=l,p=c-h;d<c;d+=h)u+=(o[p]-o[d])*(o[d+1]+o[p+1]),p=d;return u})(r,e,t,n)>0)for(s=e;s<t;s+=n)a=$l(s,r[s],r[s+1],a);else for(s=t-n;s>=e;s-=n)a=$l(s,r[s],r[s+1],a);return a&&hs(a,a.next)&&(Ji(a),a=a.next),a}function Cn(r,e){if(!r)return r;e||(e=r);let t,n=r;do if(t=!1,n.steiner||!hs(n,n.next)&&We(n.prev,n,n.next)!==0)n=n.next;else{if(Ji(n),n=e=n.prev,n===n.next)break;t=!0}while(t||n!==e);return e}function Yi(r,e,t,n,i,s,a){if(!r)return;!a&&s&&(function(h,u,d,p){let m=h;do m.z===0&&(m.z=Ba(m.x,m.y,u,d,p)),m.prevZ=m.prev,m.nextZ=m.next,m=m.next;while(m!==h);m.prevZ.nextZ=null,m.prevZ=null,(function(g){let f,x,v,_,M,C,b,A,N=1;do{for(x=g,g=null,M=null,C=0;x;){for(C++,v=x,b=0,f=0;f<N&&(b++,v=v.nextZ,v);f++);for(A=N;b>0||A>0&&v;)b!==0&&(A===0||!v||x.z<=v.z)?(_=x,x=x.nextZ,b--):(_=v,v=v.nextZ,A--),M?M.nextZ=_:g=_,_.prevZ=M,M=_;x=v}M.nextZ=null,N*=2}while(C>1)})(m)})(r,n,i,s);let o,l,c=r;for(;r.prev!==r.next;)if(o=r.prev,l=r.next,s?Td(r,n,i,s):bd(r))e.push(o.i/t|0),e.push(r.i/t|0),e.push(l.i/t|0),Ji(r),r=l.next,c=l.next;else if((r=l)===c){a?a===1?Yi(r=Ed(Cn(r),e,t),e,t,n,i,s,2):a===2&&wd(r,e,t,n,i,s):Yi(Cn(r),e,t,n,i,s,1);break}}function bd(r){const e=r.prev,t=r,n=r.next;if(We(e,t,n)>=0)return!1;const i=e.x,s=t.x,a=n.x,o=e.y,l=t.y,c=n.y,h=i<s?i<a?i:a:s<a?s:a,u=o<l?o<c?o:c:l<c?l:c,d=i>s?i>a?i:a:s>a?s:a,p=o>l?o>c?o:c:l>c?l:c;let m=n.next;for(;m!==e;){if(m.x>=h&&m.x<=d&&m.y>=u&&m.y<=p&&vi(i,o,s,l,a,c,m.x,m.y)&&We(m.prev,m,m.next)>=0)return!1;m=m.next}return!0}function Td(r,e,t,n){const i=r.prev,s=r,a=r.next;if(We(i,s,a)>=0)return!1;const o=i.x,l=s.x,c=a.x,h=i.y,u=s.y,d=a.y,p=o<l?o<c?o:c:l<c?l:c,m=h<u?h<d?h:d:u<d?u:d,g=o>l?o>c?o:c:l>c?l:c,f=h>u?h>d?h:d:u>d?u:d,x=Ba(p,m,e,t,n),v=Ba(g,f,e,t,n);let _=r.prevZ,M=r.nextZ;for(;_&&_.z>=x&&M&&M.z<=v;){if(_.x>=p&&_.x<=g&&_.y>=m&&_.y<=f&&_!==i&&_!==a&&vi(o,h,l,u,c,d,_.x,_.y)&&We(_.prev,_,_.next)>=0||(_=_.prevZ,M.x>=p&&M.x<=g&&M.y>=m&&M.y<=f&&M!==i&&M!==a&&vi(o,h,l,u,c,d,M.x,M.y)&&We(M.prev,M,M.next)>=0))return!1;M=M.nextZ}for(;_&&_.z>=x;){if(_.x>=p&&_.x<=g&&_.y>=m&&_.y<=f&&_!==i&&_!==a&&vi(o,h,l,u,c,d,_.x,_.y)&&We(_.prev,_,_.next)>=0)return!1;_=_.prevZ}for(;M&&M.z<=v;){if(M.x>=p&&M.x<=g&&M.y>=m&&M.y<=f&&M!==i&&M!==a&&vi(o,h,l,u,c,d,M.x,M.y)&&We(M.prev,M,M.next)>=0)return!1;M=M.nextZ}return!0}function Ed(r,e,t){let n=r;do{const i=n.prev,s=n.next.next;!hs(i,s)&&Jl(i,n,n.next,s)&&Zi(i,s)&&Zi(s,i)&&(e.push(i.i/t|0),e.push(n.i/t|0),e.push(s.i/t|0),Ji(n),Ji(n.next),n=r=s),n=n.next}while(n!==r);return Cn(n)}function wd(r,e,t,n,i,s){let a=r;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&Pd(a,o)){let l=Kl(a,o);return a=Cn(a,a.next),l=Cn(l,l.next),Yi(a,e,t,n,i,s,0),void Yi(l,e,t,n,i,s,0)}o=o.next}a=a.next}while(a!==r)}function Ad(r,e){return r.x-e.x}function Rd(r,e){const t=(function(i,s){let a,o=s,l=-1/0;const c=i.x,h=i.y;do{if(h<=o.y&&h>=o.next.y&&o.next.y!==o.y){const f=o.x+(h-o.y)*(o.next.x-o.x)/(o.next.y-o.y);if(f<=c&&f>l&&(l=f,a=o.x<o.next.x?o:o.next,f===c))return a}o=o.next}while(o!==s);if(!a)return null;const u=a,d=a.x,p=a.y;let m,g=1/0;o=a;do c>=o.x&&o.x>=d&&c!==o.x&&vi(h<p?c:l,h,d,p,h<p?l:c,h,o.x,o.y)&&(m=Math.abs(h-o.y)/(c-o.x),Zi(o,i)&&(m<g||m===g&&(o.x>a.x||o.x===a.x&&Cd(a,o)))&&(a=o,g=m)),o=o.next;while(o!==u);return a})(r,e);if(!t)return e;const n=Kl(t,r);return Cn(n,n.next),Cn(t,t.next)}function Cd(r,e){return We(r.prev,r,e.prev)<0&&We(e.next,r,r.next)<0}function Ba(r,e,t,n,i){return(r=1431655765&((r=858993459&((r=252645135&((r=16711935&((r=(r-t)*i|0)|r<<8))|r<<4))|r<<2))|r<<1))|(e=1431655765&((e=858993459&((e=252645135&((e=16711935&((e=(e-n)*i|0)|e<<8))|e<<4))|e<<2))|e<<1))<<1}function Ld(r){let e=r,t=r;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==r);return t}function vi(r,e,t,n,i,s,a,o){return(i-a)*(e-o)>=(r-a)*(s-o)&&(r-a)*(n-o)>=(t-a)*(e-o)&&(t-a)*(s-o)>=(i-a)*(n-o)}function Pd(r,e){return r.next.i!==e.i&&r.prev.i!==e.i&&!(function(t,n){let i=t;do{if(i.i!==t.i&&i.next.i!==t.i&&i.i!==n.i&&i.next.i!==n.i&&Jl(i,i.next,t,n))return!0;i=i.next}while(i!==t);return!1})(r,e)&&(Zi(r,e)&&Zi(e,r)&&(function(t,n){let i=t,s=!1;const a=(t.x+n.x)/2,o=(t.y+n.y)/2;do i.y>o!=i.next.y>o&&i.next.y!==i.y&&a<(i.next.x-i.x)*(o-i.y)/(i.next.y-i.y)+i.x&&(s=!s),i=i.next;while(i!==t);return s})(r,e)&&(We(r.prev,r,e.prev)||We(r,e.prev,e))||hs(r,e)&&We(r.prev,r,r.next)>0&&We(e.prev,e,e.next)>0)}function We(r,e,t){return(e.y-r.y)*(t.x-e.x)-(e.x-r.x)*(t.y-e.y)}function hs(r,e){return r.x===e.x&&r.y===e.y}function Jl(r,e,t,n){const i=ds(We(r,e,t)),s=ds(We(r,e,n)),a=ds(We(t,n,r)),o=ds(We(t,n,e));return i!==s&&a!==o||!(i!==0||!us(r,t,e))||!(s!==0||!us(r,n,e))||!(a!==0||!us(t,r,n))||!(o!==0||!us(t,e,n))}function us(r,e,t){return e.x<=Math.max(r.x,t.x)&&e.x>=Math.min(r.x,t.x)&&e.y<=Math.max(r.y,t.y)&&e.y>=Math.min(r.y,t.y)}function ds(r){return r>0?1:r<0?-1:0}function Zi(r,e){return We(r.prev,r,r.next)<0?We(r,e,r.next)>=0&&We(r,r.prev,e)>=0:We(r,e,r.prev)<0||We(r,r.next,e)<0}function Kl(r,e){const t=new za(r.i,r.x,r.y),n=new za(e.i,e.x,e.y),i=r.next,s=e.prev;return r.next=e,e.prev=r,t.next=i,i.prev=t,n.next=t,t.prev=n,s.next=n,n.prev=s,n}function $l(r,e,t,n){const i=new za(r,e,t);return n?(i.next=n.next,i.prev=n,n.next.prev=i,n.next=i):(i.prev=i,i.next=i),i}function Ji(r){r.next.prev=r.prev,r.prev.next=r.next,r.prevZ&&(r.prevZ.nextZ=r.nextZ),r.nextZ&&(r.nextZ.prevZ=r.prevZ)}function za(r,e,t){this.i=r,this.x=e,this.y=t,this.prev=null,this.next=null,this.z=0,this.prevZ=null,this.nextZ=null,this.steiner=!1}class Wt{static area(e){const t=e.length;let n=0;for(let i=t-1,s=0;s<t;i=s++)n+=e[i].x*e[s].y-e[s].x*e[i].y;return .5*n}static isClockWise(e){return Wt.area(e)<0}static triangulateShape(e,t){const n=[],i=[],s=[];Ql(e),ec(n,e);let a=e.length;t.forEach(Ql);for(let l=0;l<t.length;l++)i.push(a),a+=t[l].length,ec(n,t[l]);const o=Sd(n,i);for(let l=0;l<o.length;l+=3)s.push(o.slice(l,l+3));return s}}function Ql(r){const e=r.length;e>2&&r[e-1].equals(r[0])&&r.pop()}function ec(r,e){for(let t=0;t<e.length;t++)r.push(e[t].x),r.push(e[t].y)}class ps extends Ae{constructor(e=new Rn([new ie(.5,.5),new ie(-.5,.5),new ie(-.5,-.5),new ie(.5,-.5)]),t={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];const n=this,i=[],s=[];for(let o=0,l=e.length;o<l;o++)a(e[o]);function a(o){const l=[],c=t.curveSegments!==void 0?t.curveSegments:12,h=t.steps!==void 0?t.steps:1,u=t.depth!==void 0?t.depth:1;let d=t.bevelEnabled===void 0||t.bevelEnabled,p=t.bevelThickness!==void 0?t.bevelThickness:.2,m=t.bevelSize!==void 0?t.bevelSize:p-.1,g=t.bevelOffset!==void 0?t.bevelOffset:0,f=t.bevelSegments!==void 0?t.bevelSegments:3;const x=t.extrudePath,v=t.UVGenerator!==void 0?t.UVGenerator:Id;let _,M,C,b,A,N=!1;x&&(_=x.getSpacedPoints(h),N=!0,d=!1,M=x.computeFrenetFrames(h,!1),C=new w,b=new w,A=new w),d||(f=0,p=0,m=0,g=0);const I=o.extractPoints(c);let F=I.shape;const Y=I.holes;if(!Wt.isClockWise(F)){F=F.reverse();for(let U=0,D=Y.length;U<D;U++){const B=Y[U];Wt.isClockWise(B)&&(Y[U]=B.reverse())}}const L=Wt.triangulateShape(F,Y),W=F;for(let U=0,D=Y.length;U<D;U++){const B=Y[U];F=F.concat(B)}function X(U,D,B){return D||console.error("THREE.ExtrudeGeometry: vec does not exist"),U.clone().addScaledVector(D,B)}const oe=F.length,pe=L.length;function ne(U,D,B){let te,$,S;const re=U.x-D.x,z=U.y-D.y,G=B.x-U.x,se=B.y-U.y,he=re*re+z*z,fe=re*se-z*G;if(Math.abs(fe)>Number.EPSILON){const ge=Math.sqrt(he),be=Math.sqrt(G*G+se*se),_e=D.x-z/ge,ve=D.y+re/ge,Re=((B.x-se/be-_e)*se-(B.y+G/be-ve)*G)/(re*se-z*G);te=_e+re*Re-U.x,$=ve+z*Re-U.y;const rt=te*te+$*$;if(rt<=2)return new ie(te,$);S=Math.sqrt(rt/2)}else{let ge=!1;re>Number.EPSILON?G>Number.EPSILON&&(ge=!0):re<-Number.EPSILON?G<-Number.EPSILON&&(ge=!0):Math.sign(z)===Math.sign(se)&&(ge=!0),ge?(te=-z,$=re,S=Math.sqrt(he)):(te=re,$=z,S=Math.sqrt(he/2))}return new ie(te/S,$/S)}const ee=[];for(let U=0,D=W.length,B=D-1,te=U+1;U<D;U++,B++,te++)B===D&&(B=0),te===D&&(te=0),ee[U]=ne(W[U],W[B],W[te]);const K=[];let H,k=ee.concat();for(let U=0,D=Y.length;U<D;U++){const B=Y[U];H=[];for(let te=0,$=B.length,S=$-1,re=te+1;te<$;te++,S++,re++)S===$&&(S=0),re===$&&(re=0),H[te]=ne(B[te],B[S],B[re]);K.push(H),k=k.concat(H)}for(let U=0;U<f;U++){const D=U/f,B=p*Math.cos(D*Math.PI/2),te=m*Math.sin(D*Math.PI/2)+g;for(let $=0,S=W.length;$<S;$++){const re=X(W[$],ee[$],te);T(re.x,re.y,-B)}for(let $=0,S=Y.length;$<S;$++){const re=Y[$];H=K[$];for(let z=0,G=re.length;z<G;z++){const se=X(re[z],H[z],te);T(se.x,se.y,-B)}}}const ce=m+g;for(let U=0;U<oe;U++){const D=d?X(F[U],k[U],ce):F[U];N?(b.copy(M.normals[0]).multiplyScalar(D.x),C.copy(M.binormals[0]).multiplyScalar(D.y),A.copy(_[0]).add(b).add(C),T(A.x,A.y,A.z)):T(D.x,D.y,0)}for(let U=1;U<=h;U++)for(let D=0;D<oe;D++){const B=d?X(F[D],k[D],ce):F[D];N?(b.copy(M.normals[U]).multiplyScalar(B.x),C.copy(M.binormals[U]).multiplyScalar(B.y),A.copy(_[U]).add(b).add(C),T(A.x,A.y,A.z)):T(B.x,B.y,u/h*U)}for(let U=f-1;U>=0;U--){const D=U/f,B=p*Math.cos(D*Math.PI/2),te=m*Math.sin(D*Math.PI/2)+g;for(let $=0,S=W.length;$<S;$++){const re=X(W[$],ee[$],te);T(re.x,re.y,u+B)}for(let $=0,S=Y.length;$<S;$++){const re=Y[$];H=K[$];for(let z=0,G=re.length;z<G;z++){const se=X(re[z],H[z],te);N?T(se.x,se.y+_[h-1].y,_[h-1].x+B):T(se.x,se.y,u+B)}}}function E(U,D){let B=U.length;for(;--B>=0;){const te=B;let $=B-1;$<0&&($=U.length-1);for(let S=0,re=h+2*f;S<re;S++){const z=oe*S,G=oe*(S+1);Z(D+te+z,D+$+z,D+$+G,D+te+G)}}}function T(U,D,B){l.push(U),l.push(D),l.push(B)}function O(U,D,B){P(U),P(D),P(B);const te=i.length/3,$=v.generateTopUV(n,i,te-3,te-2,te-1);q($[0]),q($[1]),q($[2])}function Z(U,D,B,te){P(U),P(D),P(te),P(D),P(B),P(te);const $=i.length/3,S=v.generateSideWallUV(n,i,$-6,$-3,$-2,$-1);q(S[0]),q(S[1]),q(S[3]),q(S[1]),q(S[2]),q(S[3])}function P(U){i.push(l[3*U+0]),i.push(l[3*U+1]),i.push(l[3*U+2])}function q(U){s.push(U.x),s.push(U.y)}(function(){const U=i.length/3;if(d){let D=0,B=oe*D;for(let te=0;te<pe;te++){const $=L[te];O($[2]+B,$[1]+B,$[0]+B)}D=h+2*f,B=oe*D;for(let te=0;te<pe;te++){const $=L[te];O($[0]+B,$[1]+B,$[2]+B)}}else{for(let D=0;D<pe;D++){const B=L[D];O(B[2],B[1],B[0])}for(let D=0;D<pe;D++){const B=L[D];O(B[0]+oe*h,B[1]+oe*h,B[2]+oe*h)}}n.addGroup(U,i.length/3-U,0)})(),(function(){const U=i.length/3;let D=0;E(W,D),D+=W.length;for(let B=0,te=Y.length;B<te;B++){const $=Y[B];E($,D),D+=$.length}n.addGroup(U,i.length/3-U,1)})()}this.setAttribute("position",new me(i,3)),this.setAttribute("uv",new me(s,2)),this.computeVertexNormals()}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){const e=super.toJSON();return(function(t,n,i){if(i.shapes=[],Array.isArray(t))for(let s=0,a=t.length;s<a;s++){const o=t[s];i.shapes.push(o.uuid)}else i.shapes.push(t.uuid);return i.options=Object.assign({},n),n.extrudePath!==void 0&&(i.options.extrudePath=n.extrudePath.toJSON()),i})(this.parameters.shapes,this.parameters.options,e)}static fromJSON(e,t){const n=[];for(let s=0,a=e.shapes.length;s<a;s++){const o=t[e.shapes[s]];n.push(o)}const i=e.options.extrudePath;return i!==void 0&&(e.options.extrudePath=new ns[i.type]().fromJSON(i)),new ps(n,e.options)}}const Id={generateTopUV:function(r,e,t,n,i){const s=e[3*t],a=e[3*t+1],o=e[3*n],l=e[3*n+1],c=e[3*i],h=e[3*i+1];return[new ie(s,a),new ie(o,l),new ie(c,h)]},generateSideWallUV:function(r,e,t,n,i,s){const a=e[3*t],o=e[3*t+1],l=e[3*t+2],c=e[3*n],h=e[3*n+1],u=e[3*n+2],d=e[3*i],p=e[3*i+1],m=e[3*i+2],g=e[3*s],f=e[3*s+1],x=e[3*s+2];return Math.abs(o-h)<Math.abs(a-c)?[new ie(a,1-l),new ie(c,1-u),new ie(d,1-m),new ie(g,1-x)]:[new ie(o,1-l),new ie(h,1-u),new ie(p,1-m),new ie(f,1-x)]}};class fs extends fn{constructor(e=1,t=0){const n=(1+Math.sqrt(5))/2;super([-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1],e,t),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new fs(e.radius,e.detail)}}class Ki extends fn{constructor(e=1,t=0){super([1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2],e,t),this.type="OctahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new Ki(e.radius,e.detail)}}class ms extends Ae{constructor(e=.5,t=1,n=32,i=1,s=0,a=2*Math.PI){super(),this.type="RingGeometry",this.parameters={innerRadius:e,outerRadius:t,thetaSegments:n,phiSegments:i,thetaStart:s,thetaLength:a},n=Math.max(3,n);const o=[],l=[],c=[],h=[];let u=e;const d=(t-e)/(i=Math.max(1,i)),p=new w,m=new ie;for(let g=0;g<=i;g++){for(let f=0;f<=n;f++){const x=s+f/n*a;p.x=u*Math.cos(x),p.y=u*Math.sin(x),l.push(p.x,p.y,p.z),c.push(0,0,1),m.x=(p.x/t+1)/2,m.y=(p.y/t+1)/2,h.push(m.x,m.y)}u+=d}for(let g=0;g<i;g++){const f=g*(n+1);for(let x=0;x<n;x++){const v=x+f,_=v,M=v+n+1,C=v+n+2,b=v+1;o.push(_,M,b),o.push(M,C,b)}}this.setIndex(o),this.setAttribute("position",new me(l,3)),this.setAttribute("normal",new me(c,3)),this.setAttribute("uv",new me(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new ms(e.innerRadius,e.outerRadius,e.thetaSegments,e.phiSegments,e.thetaStart,e.thetaLength)}}class gs extends Ae{constructor(e=new Rn([new ie(0,.5),new ie(-.5,-.5),new ie(.5,-.5)]),t=12){super(),this.type="ShapeGeometry",this.parameters={shapes:e,curveSegments:t};const n=[],i=[],s=[],a=[];let o=0,l=0;if(Array.isArray(e)===!1)c(e);else for(let h=0;h<e.length;h++)c(e[h]),this.addGroup(o,l,h),o+=l,l=0;function c(h){const u=i.length/3,d=h.extractPoints(t);let p=d.shape;const m=d.holes;Wt.isClockWise(p)===!1&&(p=p.reverse());for(let f=0,x=m.length;f<x;f++){const v=m[f];Wt.isClockWise(v)===!0&&(m[f]=v.reverse())}const g=Wt.triangulateShape(p,m);for(let f=0,x=m.length;f<x;f++){const v=m[f];p=p.concat(v)}for(let f=0,x=p.length;f<x;f++){const v=p[f];i.push(v.x,v.y,0),s.push(0,0,1),a.push(v.x,v.y)}for(let f=0,x=g.length;f<x;f++){const v=g[f],_=v[0]+u,M=v[1]+u,C=v[2]+u;n.push(_,M,C),l+=3}}this.setIndex(n),this.setAttribute("position",new me(i,3)),this.setAttribute("normal",new me(s,3)),this.setAttribute("uv",new me(a,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){const e=super.toJSON();return(function(t,n){if(n.shapes=[],Array.isArray(t))for(let i=0,s=t.length;i<s;i++){const a=t[i];n.shapes.push(a.uuid)}else n.shapes.push(t.uuid);return n})(this.parameters.shapes,e)}static fromJSON(e,t){const n=[];for(let i=0,s=e.shapes.length;i<s;i++){const a=t[e.shapes[i]];n.push(a)}return new gs(n,e.curveSegments)}}class $i extends Ae{constructor(e=1,t=32,n=16,i=0,s=2*Math.PI,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:i,phiLength:s,thetaStart:a,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));const l=Math.min(a+o,Math.PI);let c=0;const h=[],u=new w,d=new w,p=[],m=[],g=[],f=[];for(let x=0;x<=n;x++){const v=[],_=x/n;let M=0;x===0&&a===0?M=.5/t:x===n&&l===Math.PI&&(M=-.5/t);for(let C=0;C<=t;C++){const b=C/t;u.x=-e*Math.cos(i+b*s)*Math.sin(a+_*o),u.y=e*Math.cos(a+_*o),u.z=e*Math.sin(i+b*s)*Math.sin(a+_*o),m.push(u.x,u.y,u.z),d.copy(u).normalize(),g.push(d.x,d.y,d.z),f.push(b+M,1-_),v.push(c++)}h.push(v)}for(let x=0;x<n;x++)for(let v=0;v<t;v++){const _=h[x][v+1],M=h[x][v],C=h[x+1][v],b=h[x+1][v+1];(x!==0||a>0)&&p.push(_,M,b),(x!==n-1||l<Math.PI)&&p.push(M,C,b)}this.setIndex(p),this.setAttribute("position",new me(m,3)),this.setAttribute("normal",new me(g,3)),this.setAttribute("uv",new me(f,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new $i(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}class _s extends fn{constructor(e=1,t=0){super([1,1,1,-1,-1,1,-1,1,-1,1,-1,-1],[2,1,0,0,3,2,1,3,0,2,3,1],e,t),this.type="TetrahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new _s(e.radius,e.detail)}}class vs extends Ae{constructor(e=1,t=.4,n=12,i=48,s=2*Math.PI){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:i,arc:s},n=Math.floor(n),i=Math.floor(i);const a=[],o=[],l=[],c=[],h=new w,u=new w,d=new w;for(let p=0;p<=n;p++)for(let m=0;m<=i;m++){const g=m/i*s,f=p/n*Math.PI*2;u.x=(e+t*Math.cos(f))*Math.cos(g),u.y=(e+t*Math.cos(f))*Math.sin(g),u.z=t*Math.sin(f),o.push(u.x,u.y,u.z),h.x=e*Math.cos(g),h.y=e*Math.sin(g),d.subVectors(u,h).normalize(),l.push(d.x,d.y,d.z),c.push(m/i),c.push(p/n)}for(let p=1;p<=n;p++)for(let m=1;m<=i;m++){const g=(i+1)*p+m-1,f=(i+1)*(p-1)+m-1,x=(i+1)*(p-1)+m,v=(i+1)*p+m;a.push(g,f,v),a.push(f,x,v)}this.setIndex(a),this.setAttribute("position",new me(o,3)),this.setAttribute("normal",new me(l,3)),this.setAttribute("uv",new me(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new vs(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}}class xs extends Ae{constructor(e=1,t=.4,n=64,i=8,s=2,a=3){super(),this.type="TorusKnotGeometry",this.parameters={radius:e,tube:t,tubularSegments:n,radialSegments:i,p:s,q:a},n=Math.floor(n),i=Math.floor(i);const o=[],l=[],c=[],h=[],u=new w,d=new w,p=new w,m=new w,g=new w,f=new w,x=new w;for(let _=0;_<=n;++_){const M=_/n*s*Math.PI*2;v(M,s,a,e,p),v(M+.01,s,a,e,m),f.subVectors(m,p),x.addVectors(m,p),g.crossVectors(f,x),x.crossVectors(g,f),g.normalize(),x.normalize();for(let C=0;C<=i;++C){const b=C/i*Math.PI*2,A=-t*Math.cos(b),N=t*Math.sin(b);u.x=p.x+(A*x.x+N*g.x),u.y=p.y+(A*x.y+N*g.y),u.z=p.z+(A*x.z+N*g.z),l.push(u.x,u.y,u.z),d.subVectors(u,p).normalize(),c.push(d.x,d.y,d.z),h.push(_/n),h.push(C/i)}}for(let _=1;_<=n;_++)for(let M=1;M<=i;M++){const C=(i+1)*(_-1)+(M-1),b=(i+1)*_+(M-1),A=(i+1)*_+M,N=(i+1)*(_-1)+M;o.push(C,b,N),o.push(b,A,N)}function v(_,M,C,b,A){const N=Math.cos(_),I=Math.sin(_),F=C/M*_,Y=Math.cos(F);A.x=b*(2+Y)*.5*N,A.y=b*(2+Y)*I*.5,A.z=b*Math.sin(F)*.5}this.setIndex(o),this.setAttribute("position",new me(l,3)),this.setAttribute("normal",new me(c,3)),this.setAttribute("uv",new me(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new xs(e.radius,e.tube,e.tubularSegments,e.radialSegments,e.p,e.q)}}class ys extends Ae{constructor(e=new Na(new w(-1,-1,0),new w(-1,1,0),new w(1,1,0)),t=64,n=1,i=8,s=!1){super(),this.type="TubeGeometry",this.parameters={path:e,tubularSegments:t,radius:n,radialSegments:i,closed:s};const a=e.computeFrenetFrames(t,s);this.tangents=a.tangents,this.normals=a.normals,this.binormals=a.binormals;const o=new w,l=new w,c=new ie;let h=new w;const u=[],d=[],p=[],m=[];function g(f){h=e.getPointAt(f/t,h);const x=a.normals[f],v=a.binormals[f];for(let _=0;_<=i;_++){const M=_/i*Math.PI*2,C=Math.sin(M),b=-Math.cos(M);l.x=b*x.x+C*v.x,l.y=b*x.y+C*v.y,l.z=b*x.z+C*v.z,l.normalize(),d.push(l.x,l.y,l.z),o.x=h.x+n*l.x,o.y=h.y+n*l.y,o.z=h.z+n*l.z,u.push(o.x,o.y,o.z)}}(function(){for(let f=0;f<t;f++)g(f);g(s===!1?t:0),(function(){for(let f=0;f<=t;f++)for(let x=0;x<=i;x++)c.x=f/t,c.y=x/i,p.push(c.x,c.y)})(),(function(){for(let f=1;f<=t;f++)for(let x=1;x<=i;x++){const v=(i+1)*(f-1)+(x-1),_=(i+1)*f+(x-1),M=(i+1)*f+x,C=(i+1)*(f-1)+x;m.push(v,_,C),m.push(_,M,C)}})()})(),this.setIndex(m),this.setAttribute("position",new me(u,3)),this.setAttribute("normal",new me(d,3)),this.setAttribute("uv",new me(p,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){const e=super.toJSON();return e.path=this.parameters.path.toJSON(),e}static fromJSON(e){return new ys(new ns[e.path.type]().fromJSON(e.path),e.tubularSegments,e.radius,e.radialSegments,e.closed)}}class tc extends Ae{constructor(e=null){if(super(),this.type="WireframeGeometry",this.parameters={geometry:e},e!==null){const t=[],n=new Set,i=new w,s=new w;if(e.index!==null){const a=e.attributes.position,o=e.index;let l=e.groups;l.length===0&&(l=[{start:0,count:o.count,materialIndex:0}]);for(let c=0,h=l.length;c<h;++c){const u=l[c],d=u.start;for(let p=d,m=d+u.count;p<m;p+=3)for(let g=0;g<3;g++){const f=o.getX(p+g),x=o.getX(p+(g+1)%3);i.fromBufferAttribute(a,f),s.fromBufferAttribute(a,x),nc(i,s,n)===!0&&(t.push(i.x,i.y,i.z),t.push(s.x,s.y,s.z))}}}else{const a=e.attributes.position;for(let o=0,l=a.count/3;o<l;o++)for(let c=0;c<3;c++){const h=3*o+c,u=3*o+(c+1)%3;i.fromBufferAttribute(a,h),s.fromBufferAttribute(a,u),nc(i,s,n)===!0&&(t.push(i.x,i.y,i.z),t.push(s.x,s.y,s.z))}}this.setAttribute("position",new me(t,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}}function nc(r,e,t){const n=`${r.x},${r.y},${r.z}-${e.x},${e.y},${e.z}`,i=`${e.x},${e.y},${e.z}-${r.x},${r.y},${r.z}`;return t.has(n)!==!0&&t.has(i)!==!0&&(t.add(n),t.add(i),!0)}var ic=Object.freeze({__proto__:null,BoxGeometry:Sn,CapsuleGeometry:is,CircleGeometry:rs,ConeGeometry:ss,CylinderGeometry:_i,DodecahedronGeometry:as,EdgesGeometry:Yl,ExtrudeGeometry:ps,IcosahedronGeometry:fs,LatheGeometry:qi,OctahedronGeometry:Ki,PlaneGeometry:Oi,PolyhedronGeometry:fn,RingGeometry:ms,ShapeGeometry:gs,SphereGeometry:$i,TetrahedronGeometry:_s,TorusGeometry:vs,TorusKnotGeometry:xs,TubeGeometry:ys,WireframeGeometry:tc});class rc extends ct{constructor(e){super(),this.isShadowMaterial=!0,this.type="ShadowMaterial",this.color=new de(0),this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.fog=e.fog,this}}class sc extends Vt{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class Ga extends ct{constructor(e){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new de(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new de(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new ie(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class ac extends Ga{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new ie(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return qe(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new de(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new de(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new de(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}}class oc extends ct{constructor(e){super(),this.isMeshPhongMaterial=!0,this.type="MeshPhongMaterial",this.color=new de(16777215),this.specular=new de(1118481),this.shininess=30,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new de(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new ie(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=0,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.specular.copy(e.specular),this.shininess=e.shininess,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class lc extends ct{constructor(e){super(),this.isMeshToonMaterial=!0,this.defines={TOON:""},this.type="MeshToonMaterial",this.color=new de(16777215),this.map=null,this.gradientMap=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new de(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new ie(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.gradientMap=e.gradientMap,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.alphaMap=e.alphaMap,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}class cc extends ct{constructor(e){super(),this.isMeshNormalMaterial=!0,this.type="MeshNormalMaterial",this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new ie(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.flatShading=!1,this.setValues(e)}copy(e){return super.copy(e),this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.flatShading=e.flatShading,this}}class hc extends ct{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new de(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new de(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new ie(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=0,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class uc extends ct{constructor(e){super(),this.isMeshMatcapMaterial=!0,this.defines={MATCAP:""},this.type="MeshMatcapMaterial",this.color=new de(16777215),this.matcap=null,this.map=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new ie(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={MATCAP:""},this.color.copy(e.color),this.matcap=e.matcap,this.map=e.map,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.alphaMap=e.alphaMap,this.flatShading=e.flatShading,this.fog=e.fog,this}}class dc extends gt{constructor(e){super(),this.isLineDashedMaterial=!0,this.type="LineDashedMaterial",this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(e)}copy(e){return super.copy(e),this.scale=e.scale,this.dashSize=e.dashSize,this.gapSize=e.gapSize,this}}function Ln(r,e,t){return!r||!t&&r.constructor===e?r:typeof e.BYTES_PER_ELEMENT=="number"?new e(r):Array.prototype.slice.call(r)}function pc(r){return ArrayBuffer.isView(r)&&!(r instanceof DataView)}function fc(r){const e=r.length,t=new Array(e);for(let n=0;n!==e;++n)t[n]=n;return t.sort((function(n,i){return r[n]-r[i]})),t}function Ha(r,e,t){const n=r.length,i=new r.constructor(n);for(let s=0,a=0;a!==n;++s){const o=t[s]*e;for(let l=0;l!==e;++l)i[a++]=r[o+l]}return i}function Va(r,e,t,n){let i=1,s=r[0];for(;s!==void 0&&s[n]===void 0;)s=r[i++];if(s===void 0)return;let a=s[n];if(a!==void 0)if(Array.isArray(a))do a=s[n],a!==void 0&&(e.push(s.time),t.push.apply(t,a)),s=r[i++];while(s!==void 0);else if(a.toArray!==void 0)do a=s[n],a!==void 0&&(e.push(s.time),a.toArray(t,t.length)),s=r[i++];while(s!==void 0);else do a=s[n],a!==void 0&&(e.push(s.time),t.push(a)),s=r[i++];while(s!==void 0)}const Ud={convertArray:Ln,isTypedArray:pc,getKeyframeOrder:fc,sortedArray:Ha,flattenJSON:Va,subclip:function(r,e,t,n,i=30){const s=r.clone();s.name=e;const a=[];for(let l=0;l<s.tracks.length;++l){const c=s.tracks[l],h=c.getValueSize(),u=[],d=[];for(let p=0;p<c.times.length;++p){const m=c.times[p]*i;if(!(m<t||m>=n)){u.push(c.times[p]);for(let g=0;g<h;++g)d.push(c.values[p*h+g])}}u.length!==0&&(c.times=Ln(u,c.times.constructor),c.values=Ln(d,c.values.constructor),a.push(c))}s.tracks=a;let o=1/0;for(let l=0;l<s.tracks.length;++l)o>s.tracks[l].times[0]&&(o=s.tracks[l].times[0]);for(let l=0;l<s.tracks.length;++l)s.tracks[l].shift(-1*o);return s.resetDuration(),s},makeClipAdditive:function(r,e=0,t=r,n=30){n<=0&&(n=30);const i=t.tracks.length,s=e/n;for(let a=0;a<i;++a){const o=t.tracks[a],l=o.ValueTypeName;if(l==="bool"||l==="string")continue;const c=r.tracks.find((function(x){return x.name===o.name&&x.ValueTypeName===l}));if(c===void 0)continue;let h=0;const u=o.getValueSize();o.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline&&(h=u/3);let d=0;const p=c.getValueSize();c.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline&&(d=p/3);const m=o.times.length-1;let g;if(s<=o.times[0]){const x=h,v=u-h;g=o.values.slice(x,v)}else if(s>=o.times[m]){const x=m*u+h,v=x+u-h;g=o.values.slice(x,v)}else{const x=o.createInterpolant(),v=h,_=u-h;x.evaluate(s),g=x.resultBuffer.slice(v,_)}l==="quaternion"&&new vt().fromArray(g).normalize().conjugate().toArray(g);const f=c.times.length;for(let x=0;x<f;++x){const v=x*p+d;if(l==="quaternion")vt.multiplyQuaternionsFlat(c.values,v,g,0,c.values,v);else{const _=p-2*d;for(let M=0;M<_;++M)c.values[v+M]-=g[M]}}}return r.blendMode=2501,r}};class Qi{constructor(e,t,n,i){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){const t=this.parameterPositions;let n=this._cachedIndex,i=t[n],s=t[n-1];e:{t:{let a;n:{i:if(!(e<i)){for(let o=n+2;;){if(i===void 0){if(e<s)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(s=i,i=t[++n],e<i)break t}a=t.length;break n}if(e>=s)break e;{const o=t[1];e<o&&(n=2,s=o);for(let l=n-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(i=s,s=t[--n-1],e>=s)break t}a=n,n=0}}for(;n<a;){const o=n+a>>>1;e<t[o]?a=o:n=o+1}if(i=t[n],s=t[n-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,s,i)}return this.interpolate_(n,s,e,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){const t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,s=e*i;for(let a=0;a!==i;++a)t[a]=n[s+a];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}}class mc extends Qi{constructor(e,t,n,i){super(e,t,n,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:2400,endingEnd:2400}}intervalChanged_(e,t,n){const i=this.parameterPositions;let s=e-2,a=e+1,o=i[s],l=i[a];if(o===void 0)switch(this.getSettings_().endingStart){case 2401:s=e,o=2*t-n;break;case 2402:s=i.length-2,o=t+i[s]-i[s+1];break;default:s=e,o=n}if(l===void 0)switch(this.getSettings_().endingEnd){case 2401:a=e,l=2*n-t;break;case 2402:a=1,l=n+i[1]-i[0];break;default:a=e-1,l=t}const c=.5*(n-t),h=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(l-n),this._offsetPrev=s*h,this._offsetNext=a*h}interpolate_(e,t,n,i){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,p=this._weightNext,m=(n-t)/(i-t),g=m*m,f=g*m,x=-d*f+2*d*g-d*m,v=(1+d)*f+(-1.5-2*d)*g+(-.5+d)*m+1,_=(-1-p)*f+(1.5+p)*g+.5*m,M=p*f-p*g;for(let C=0;C!==o;++C)s[C]=x*a[h+C]+v*a[c+C]+_*a[l+C]+M*a[u+C];return s}}class ka extends Qi{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=(n-t)/(i-t),u=1-h;for(let d=0;d!==o;++d)s[d]=a[c+d]*u+a[l+d]*h;return s}}class gc extends Qi{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e){return this.copySampleValue_(e-1)}}class Ft{constructor(e,t,n,i){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Ln(t,this.TimeBufferType),this.values=Ln(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(e){const t=e.constructor;let n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:Ln(e.times,Array),values:Ln(e.values,Array)};const i=e.getInterpolation();i!==e.DefaultInterpolation&&(n.interpolation=i)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new gc(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new ka(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new mc(this.times,this.values,this.getValueSize(),e)}setInterpolation(e){let t;switch(e){case 2300:t=this.InterpolantFactoryMethodDiscrete;break;case 2301:t=this.InterpolantFactoryMethodLinear;break;case 2302:t=this.InterpolantFactoryMethodSmooth}if(t===void 0){const n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0){if(e===this.DefaultInterpolation)throw new Error(n);this.setInterpolation(this.DefaultInterpolation)}return console.warn("THREE.KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return 2300;case this.InterpolantFactoryMethodLinear:return 2301;case this.InterpolantFactoryMethodSmooth:return 2302}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){const t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]+=e}return this}scale(e){if(e!==1){const t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]*=e}return this}trim(e,t){const n=this.times,i=n.length;let s=0,a=i-1;for(;s!==i&&n[s]<e;)++s;for(;a!==-1&&n[a]>t;)--a;if(++a,s!==0||a!==i){s>=a&&(a=Math.max(a,1),s=a-1);const o=this.getValueSize();this.times=n.slice(s,a),this.values=this.values.slice(s*o,a*o)}return this}validate(){let e=!0;const t=this.getValueSize();t-Math.floor(t)!=0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),e=!1);const n=this.times,i=this.values,s=n.length;s===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),e=!1);let a=null;for(let o=0;o!==s;o++){const l=n[o];if(typeof l=="number"&&isNaN(l)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,o,l),e=!1;break}if(a!==null&&a>l){console.error("THREE.KeyframeTrack: Out of order keys.",this,o,l,a),e=!1;break}a=l}if(i!==void 0&&pc(i))for(let o=0,l=i.length;o!==l;++o){const c=i[o];if(isNaN(c)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,o,c),e=!1;break}}return e}optimize(){const e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===2302,s=e.length-1;let a=1;for(let o=1;o<s;++o){let l=!1;const c=e[o];if(c!==e[o+1]&&(o!==1||c!==e[0]))if(i)l=!0;else{const h=o*n,u=h-n,d=h+n;for(let p=0;p!==n;++p){const m=t[h+p];if(m!==t[u+p]||m!==t[d+p]){l=!0;break}}}if(l){if(o!==a){e[a]=e[o];const h=o*n,u=a*n;for(let d=0;d!==n;++d)t[u+d]=t[h+d]}++a}}if(s>0){e[a]=e[s];for(let o=s*n,l=a*n,c=0;c!==n;++c)t[l+c]=t[o+c];++a}return a!==e.length?(this.times=e.slice(0,a),this.values=t.slice(0,a*n)):(this.times=e,this.values=t),this}clone(){const e=this.times.slice(),t=this.values.slice(),n=new this.constructor(this.name,e,t);return n.createInterpolant=this.createInterpolant,n}}Ft.prototype.TimeBufferType=Float32Array,Ft.prototype.ValueBufferType=Float32Array,Ft.prototype.DefaultInterpolation=2301;class Pn extends Ft{}Pn.prototype.ValueTypeName="bool",Pn.prototype.ValueBufferType=Array,Pn.prototype.DefaultInterpolation=2300,Pn.prototype.InterpolantFactoryMethodLinear=void 0,Pn.prototype.InterpolantFactoryMethodSmooth=void 0;class Wa extends Ft{}Wa.prototype.ValueTypeName="color";class er extends Ft{}er.prototype.ValueTypeName="number";class _c extends Qi{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(n-t)/(i-t);let c=e*o;for(let h=c+o;c!==h;c+=4)vt.slerpFlat(s,0,a,c-o,a,c,l);return s}}class xi extends Ft{InterpolantFactoryMethodLinear(e){return new _c(this.times,this.values,this.getValueSize(),e)}}xi.prototype.ValueTypeName="quaternion",xi.prototype.DefaultInterpolation=2301,xi.prototype.InterpolantFactoryMethodSmooth=void 0;class In extends Ft{}In.prototype.ValueTypeName="string",In.prototype.ValueBufferType=Array,In.prototype.DefaultInterpolation=2300,In.prototype.InterpolantFactoryMethodLinear=void 0,In.prototype.InterpolantFactoryMethodSmooth=void 0;class tr extends Ft{}tr.prototype.ValueTypeName="vector";class nr{constructor(e,t=-1,n,i=2500){this.name=e,this.tracks=n,this.duration=t,this.blendMode=i,this.uuid=bt(),this.duration<0&&this.resetDuration()}static parse(e){const t=[],n=e.tracks,i=1/(e.fps||1);for(let a=0,o=n.length;a!==o;++a)t.push(Dd(n[a]).scale(i));const s=new this(e.name,e.duration,t,e.blendMode);return s.uuid=e.uuid,s}static toJSON(e){const t=[],n=e.tracks,i={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode};for(let s=0,a=n.length;s!==a;++s)t.push(Ft.toJSON(n[s]));return i}static CreateFromMorphTargetSequence(e,t,n,i){const s=t.length,a=[];for(let o=0;o<s;o++){let l=[],c=[];l.push((o+s-1)%s,o,(o+1)%s),c.push(0,1,0);const h=fc(l);l=Ha(l,1,h),c=Ha(c,1,h),i||l[0]!==0||(l.push(s),c.push(c[0])),a.push(new er(".morphTargetInfluences["+t[o].name+"]",l,c).scale(1/n))}return new this(e,-1,a)}static findByName(e,t){let n=e;if(!Array.isArray(e)){const i=e;n=i.geometry&&i.geometry.animations||i.animations}for(let i=0;i<n.length;i++)if(n[i].name===t)return n[i];return null}static CreateClipsFromMorphTargetSequences(e,t,n){const i={},s=/^([\w-]*?)([\d]+)$/;for(let o=0,l=e.length;o<l;o++){const c=e[o],h=c.name.match(s);if(h&&h.length>1){const u=h[1];let d=i[u];d||(i[u]=d=[]),d.push(c)}}const a=[];for(const o in i)a.push(this.CreateFromMorphTargetSequence(o,i[o],t,n));return a}static parseAnimation(e,t){if(!e)return console.error("THREE.AnimationClip: No animation in JSONLoader data."),null;const n=function(h,u,d,p,m){if(d.length!==0){const g=[],f=[];Va(d,g,f,p),g.length!==0&&m.push(new h(u,g,f))}},i=[],s=e.name||"default",a=e.fps||30,o=e.blendMode;let l=e.length||-1;const c=e.hierarchy||[];for(let h=0;h<c.length;h++){const u=c[h].keys;if(u&&u.length!==0)if(u[0].morphTargets){const d={};let p;for(p=0;p<u.length;p++)if(u[p].morphTargets)for(let m=0;m<u[p].morphTargets.length;m++)d[u[p].morphTargets[m]]=-1;for(const m in d){const g=[],f=[];for(let x=0;x!==u[p].morphTargets.length;++x){const v=u[p];g.push(v.time),f.push(v.morphTarget===m?1:0)}i.push(new er(".morphTargetInfluence["+m+"]",g,f))}l=d.length*a}else{const d=".bones["+t[h].name+"]";n(tr,d+".position",u,"pos",i),n(xi,d+".quaternion",u,"rot",i),n(tr,d+".scale",u,"scl",i)}}return i.length===0?null:new this(s,l,i,o)}resetDuration(){let e=0;for(let t=0,n=this.tracks.length;t!==n;++t){const i=this.tracks[t];e=Math.max(e,i.times[i.times.length-1])}return this.duration=e,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){const e=[];for(let t=0;t<this.tracks.length;t++)e.push(this.tracks[t].clone());return new this.constructor(this.name,this.duration,e,this.blendMode)}toJSON(){return this.constructor.toJSON(this)}}function Dd(r){if(r.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");const e=(function(t){switch(t.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return er;case"vector":case"vector2":case"vector3":case"vector4":return tr;case"color":return Wa;case"quaternion":return xi;case"bool":case"boolean":return Pn;case"string":return In}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+t)})(r.type);if(r.times===void 0){const t=[],n=[];Va(r.keys,t,n,"value"),r.times=t,r.values=n}return e.parse!==void 0?e.parse(r):new e(r.name,r.times,r.values,r.interpolation)}const en={enabled:!1,files:{},add:function(r,e){this.enabled!==!1&&(this.files[r]=e)},get:function(r){if(this.enabled!==!1)return this.files[r]},remove:function(r){delete this.files[r]},clear:function(){this.files={}}};class Xa{constructor(e,t,n){const i=this;let s,a=!1,o=0,l=0;const c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this.itemStart=function(h){l++,a===!1&&i.onStart!==void 0&&i.onStart(h,o,l),a=!0},this.itemEnd=function(h){o++,i.onProgress!==void 0&&i.onProgress(h,o,l),o===l&&(a=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(h){i.onError!==void 0&&i.onError(h)},this.resolveURL=function(h){return s?s(h):h},this.setURLModifier=function(h){return s=h,this},this.addHandler=function(h,u){return c.push(h,u),this},this.removeHandler=function(h){const u=c.indexOf(h);return u!==-1&&c.splice(u,2),this},this.getHandler=function(h){for(let u=0,d=c.length;u<d;u+=2){const p=c[u],m=c[u+1];if(p.global&&(p.lastIndex=0),p.test(h))return m}return null}}}const vc=new Xa;class Mt{constructor(e){this.manager=e!==void 0?e:vc,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){const n=this;return new Promise((function(i,s){n.load(e,i,t,s)}))}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}}Mt.DEFAULT_MATERIAL_NAME="__DEFAULT";const tn={};class Nd extends Error{constructor(e,t){super(e),this.response=t}}class nn extends Mt{constructor(e){super(e)}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const s=en.get(e);if(s!==void 0)return this.manager.itemStart(e),setTimeout((()=>{t&&t(s),this.manager.itemEnd(e)}),0),s;if(tn[e]!==void 0)return void tn[e].push({onLoad:t,onProgress:n,onError:i});tn[e]=[],tn[e].push({onLoad:t,onProgress:n,onError:i});const a=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin"}),o=this.mimeType,l=this.responseType;fetch(a).then((c=>{if(c.status===200||c.status===0){if(c.status===0&&console.warn("THREE.FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;const h=tn[e],u=c.body.getReader(),d=c.headers.get("Content-Length")||c.headers.get("X-File-Size"),p=d?parseInt(d):0,m=p!==0;let g=0;const f=new ReadableStream({start(x){(function v(){u.read().then((({done:_,value:M})=>{if(_)x.close();else{g+=M.byteLength;const C=new ProgressEvent("progress",{lengthComputable:m,loaded:g,total:p});for(let b=0,A=h.length;b<A;b++){const N=h[b];N.onProgress&&N.onProgress(C)}x.enqueue(M),v()}}))})()}});return new Response(f)}throw new Nd(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)})).then((c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then((h=>new DOMParser().parseFromString(h,o)));case"json":return c.json();default:if(o===void 0)return c.text();{const h=/charset="?([^;"\s]*)"?/i.exec(o),u=h&&h[1]?h[1].toLowerCase():void 0,d=new TextDecoder(u);return c.arrayBuffer().then((p=>d.decode(p)))}}})).then((c=>{en.add(e,c);const h=tn[e];delete tn[e];for(let u=0,d=h.length;u<d;u++){const p=h[u];p.onLoad&&p.onLoad(c)}})).catch((c=>{const h=tn[e];if(h===void 0)throw this.manager.itemError(e),c;delete tn[e];for(let u=0,d=h.length;u<d;u++){const p=h[u];p.onError&&p.onError(c)}this.manager.itemError(e)})).finally((()=>{this.manager.itemEnd(e)})),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}}class ir extends Mt{constructor(e){super(e)}load(e,t,n,i){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const s=this,a=en.get(e);if(a!==void 0)return s.manager.itemStart(e),setTimeout((function(){t&&t(a),s.manager.itemEnd(e)}),0),a;const o=wi("img");function l(){h(),en.add(e,this),t&&t(this),s.manager.itemEnd(e)}function c(u){h(),i&&i(u),s.manager.itemError(e),s.manager.itemEnd(e)}function h(){o.removeEventListener("load",l,!1),o.removeEventListener("error",c,!1)}return o.addEventListener("load",l,!1),o.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(o.crossOrigin=this.crossOrigin),s.manager.itemStart(e),o.src=e,o}}class mn extends Be{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new de(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),t}}class xc extends mn{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Be.DEFAULT_UP),this.updateMatrix(),this.groundColor=new de(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}}const ja=new Me,yc=new w,Mc=new w;class qa{constructor(e){this.camera=e,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ie(512,512),this.map=null,this.mapPass=null,this.matrix=new Me,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Ni,this._frameExtents=new ie(1,1),this._viewportCount=1,this._viewports=[new He(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,n=this.matrix;yc.setFromMatrixPosition(e.matrixWorld),t.position.copy(yc),Mc.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Mc),t.updateMatrixWorld(),ja.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(ja),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(ja)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.bias=e.bias,this.radius=e.radius,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),this.mapSize.x===512&&this.mapSize.y===512||(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}class Od extends qa{constructor(){super(new st(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1}updateMatrices(e){const t=this.camera,n=2*Vn*e.angle*this.focus,i=this.mapSize.width/this.mapSize.height,s=e.distance||t.far;n===t.fov&&i===t.aspect&&s===t.far||(t.fov=n,t.aspect=i,t.far=s,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}}class Sc extends mn{constructor(e,t,n=0,i=Math.PI/3,s=0,a=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(Be.DEFAULT_UP),this.updateMatrix(),this.target=new Be,this.distance=n,this.angle=i,this.penumbra=s,this.decay=a,this.map=null,this.shadow=new Od}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}const bc=new Me,rr=new w,Ya=new w;class Fd extends qa{constructor(){super(new st(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new ie(4,2),this._viewportCount=6,this._viewports=[new He(2,1,1,1),new He(0,1,1,1),new He(3,1,1,1),new He(1,1,1,1),new He(3,0,1,1),new He(1,0,1,1)],this._cubeDirections=[new w(1,0,0),new w(-1,0,0),new w(0,0,1),new w(0,0,-1),new w(0,1,0),new w(0,-1,0)],this._cubeUps=[new w(0,1,0),new w(0,1,0),new w(0,1,0),new w(0,1,0),new w(0,0,1),new w(0,0,-1)]}updateMatrices(e,t=0){const n=this.camera,i=this.matrix,s=e.distance||n.far;s!==n.far&&(n.far=s,n.updateProjectionMatrix()),rr.setFromMatrixPosition(e.matrixWorld),n.position.copy(rr),Ya.copy(n.position),Ya.add(this._cubeDirections[t]),n.up.copy(this._cubeUps[t]),n.lookAt(Ya),n.updateMatrixWorld(),i.makeTranslation(-rr.x,-rr.y,-rr.z),bc.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix(bc)}}class Tc extends mn{constructor(e,t,n=0,i=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=i,this.shadow=new Fd}get power(){return 4*this.intensity*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}}class Bd extends qa{constructor(){super(new Dr(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class Ec extends mn{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Be.DEFAULT_UP),this.updateMatrix(),this.target=new Be,this.shadow=new Bd}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}class wc extends mn{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type="AmbientLight"}}class Ac extends mn{constructor(e,t,n=10,i=10){super(e,t),this.isRectAreaLight=!0,this.type="RectAreaLight",this.width=n,this.height=i}get power(){return this.intensity*this.width*this.height*Math.PI}set power(e){this.intensity=e/(this.width*this.height*Math.PI)}copy(e){return super.copy(e),this.width=e.width,this.height=e.height,this}toJSON(e){const t=super.toJSON(e);return t.object.width=this.width,t.object.height=this.height,t}}class Rc{constructor(){this.isSphericalHarmonics3=!0,this.coefficients=[];for(let e=0;e<9;e++)this.coefficients.push(new w)}set(e){for(let t=0;t<9;t++)this.coefficients[t].copy(e[t]);return this}zero(){for(let e=0;e<9;e++)this.coefficients[e].set(0,0,0);return this}getAt(e,t){const n=e.x,i=e.y,s=e.z,a=this.coefficients;return t.copy(a[0]).multiplyScalar(.282095),t.addScaledVector(a[1],.488603*i),t.addScaledVector(a[2],.488603*s),t.addScaledVector(a[3],.488603*n),t.addScaledVector(a[4],n*i*1.092548),t.addScaledVector(a[5],i*s*1.092548),t.addScaledVector(a[6],.315392*(3*s*s-1)),t.addScaledVector(a[7],n*s*1.092548),t.addScaledVector(a[8],.546274*(n*n-i*i)),t}getIrradianceAt(e,t){const n=e.x,i=e.y,s=e.z,a=this.coefficients;return t.copy(a[0]).multiplyScalar(.886227),t.addScaledVector(a[1],1.023328*i),t.addScaledVector(a[2],1.023328*s),t.addScaledVector(a[3],1.023328*n),t.addScaledVector(a[4],.858086*n*i),t.addScaledVector(a[5],.858086*i*s),t.addScaledVector(a[6],.743125*s*s-.247708),t.addScaledVector(a[7],.858086*n*s),t.addScaledVector(a[8],.429043*(n*n-i*i)),t}add(e){for(let t=0;t<9;t++)this.coefficients[t].add(e.coefficients[t]);return this}addScaledSH(e,t){for(let n=0;n<9;n++)this.coefficients[n].addScaledVector(e.coefficients[n],t);return this}scale(e){for(let t=0;t<9;t++)this.coefficients[t].multiplyScalar(e);return this}lerp(e,t){for(let n=0;n<9;n++)this.coefficients[n].lerp(e.coefficients[n],t);return this}equals(e){for(let t=0;t<9;t++)if(!this.coefficients[t].equals(e.coefficients[t]))return!1;return!0}copy(e){return this.set(e.coefficients)}clone(){return new this.constructor().copy(this)}fromArray(e,t=0){const n=this.coefficients;for(let i=0;i<9;i++)n[i].fromArray(e,t+3*i);return this}toArray(e=[],t=0){const n=this.coefficients;for(let i=0;i<9;i++)n[i].toArray(e,t+3*i);return e}static getBasisAt(e,t){const n=e.x,i=e.y,s=e.z;t[0]=.282095,t[1]=.488603*i,t[2]=.488603*s,t[3]=.488603*n,t[4]=1.092548*n*i,t[5]=1.092548*i*s,t[6]=.315392*(3*s*s-1),t[7]=1.092548*n*s,t[8]=.546274*(n*n-i*i)}}class Cc extends mn{constructor(e=new Rc,t=1){super(void 0,t),this.isLightProbe=!0,this.sh=e}copy(e){return super.copy(e),this.sh.copy(e.sh),this}fromJSON(e){return this.intensity=e.intensity,this.sh.fromArray(e.sh),this}toJSON(e){const t=super.toJSON(e);return t.object.sh=this.sh.toArray(),t}}class Ms extends Mt{constructor(e){super(e),this.textures={}}load(e,t,n,i){const s=this,a=new nn(s.manager);a.setPath(s.path),a.setRequestHeader(s.requestHeader),a.setWithCredentials(s.withCredentials),a.load(e,(function(o){try{t(s.parse(JSON.parse(o)))}catch(l){i?i(l):console.error(l),s.manager.itemError(e)}}),n,i)}parse(e){const t=this.textures;function n(s){return t[s]===void 0&&console.warn("THREE.MaterialLoader: Undefined texture",s),t[s]}const i=Ms.createMaterialFromType(e.type);if(e.uuid!==void 0&&(i.uuid=e.uuid),e.name!==void 0&&(i.name=e.name),e.color!==void 0&&i.color!==void 0&&i.color.setHex(e.color),e.roughness!==void 0&&(i.roughness=e.roughness),e.metalness!==void 0&&(i.metalness=e.metalness),e.sheen!==void 0&&(i.sheen=e.sheen),e.sheenColor!==void 0&&(i.sheenColor=new de().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(i.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&i.emissive!==void 0&&i.emissive.setHex(e.emissive),e.specular!==void 0&&i.specular!==void 0&&i.specular.setHex(e.specular),e.specularIntensity!==void 0&&(i.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&i.specularColor!==void 0&&i.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(i.shininess=e.shininess),e.clearcoat!==void 0&&(i.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=e.clearcoatRoughness),e.iridescence!==void 0&&(i.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(i.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(i.transmission=e.transmission),e.thickness!==void 0&&(i.thickness=e.thickness),e.attenuationDistance!==void 0&&(i.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&i.attenuationColor!==void 0&&i.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(i.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(i.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(i.fog=e.fog),e.flatShading!==void 0&&(i.flatShading=e.flatShading),e.blending!==void 0&&(i.blending=e.blending),e.combine!==void 0&&(i.combine=e.combine),e.side!==void 0&&(i.side=e.side),e.shadowSide!==void 0&&(i.shadowSide=e.shadowSide),e.opacity!==void 0&&(i.opacity=e.opacity),e.transparent!==void 0&&(i.transparent=e.transparent),e.alphaTest!==void 0&&(i.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(i.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(i.depthFunc=e.depthFunc),e.depthTest!==void 0&&(i.depthTest=e.depthTest),e.depthWrite!==void 0&&(i.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(i.colorWrite=e.colorWrite),e.blendSrc!==void 0&&(i.blendSrc=e.blendSrc),e.blendDst!==void 0&&(i.blendDst=e.blendDst),e.blendEquation!==void 0&&(i.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(i.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(i.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(i.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&i.blendColor!==void 0&&i.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(i.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(i.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(i.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(i.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(i.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(i.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(i.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(i.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(i.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(i.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(i.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(i.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(i.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(i.rotation=e.rotation),e.linewidth!==void 0&&(i.linewidth=e.linewidth),e.dashSize!==void 0&&(i.dashSize=e.dashSize),e.gapSize!==void 0&&(i.gapSize=e.gapSize),e.scale!==void 0&&(i.scale=e.scale),e.polygonOffset!==void 0&&(i.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(i.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(i.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(i.dithering=e.dithering),e.alphaToCoverage!==void 0&&(i.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(i.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(i.forceSinglePass=e.forceSinglePass),e.visible!==void 0&&(i.visible=e.visible),e.toneMapped!==void 0&&(i.toneMapped=e.toneMapped),e.userData!==void 0&&(i.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?i.vertexColors=e.vertexColors>0:i.vertexColors=e.vertexColors),e.uniforms!==void 0)for(const s in e.uniforms){const a=e.uniforms[s];switch(i.uniforms[s]={},a.type){case"t":i.uniforms[s].value=n(a.value);break;case"c":i.uniforms[s].value=new de().setHex(a.value);break;case"v2":i.uniforms[s].value=new ie().fromArray(a.value);break;case"v3":i.uniforms[s].value=new w().fromArray(a.value);break;case"v4":i.uniforms[s].value=new He().fromArray(a.value);break;case"m3":i.uniforms[s].value=new we().fromArray(a.value);break;case"m4":i.uniforms[s].value=new Me().fromArray(a.value);break;default:i.uniforms[s].value=a.value}}if(e.defines!==void 0&&(i.defines=e.defines),e.vertexShader!==void 0&&(i.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(i.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(i.glslVersion=e.glslVersion),e.extensions!==void 0)for(const s in e.extensions)i.extensions[s]=e.extensions[s];if(e.lights!==void 0&&(i.lights=e.lights),e.clipping!==void 0&&(i.clipping=e.clipping),e.size!==void 0&&(i.size=e.size),e.sizeAttenuation!==void 0&&(i.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(i.map=n(e.map)),e.matcap!==void 0&&(i.matcap=n(e.matcap)),e.alphaMap!==void 0&&(i.alphaMap=n(e.alphaMap)),e.bumpMap!==void 0&&(i.bumpMap=n(e.bumpMap)),e.bumpScale!==void 0&&(i.bumpScale=e.bumpScale),e.normalMap!==void 0&&(i.normalMap=n(e.normalMap)),e.normalMapType!==void 0&&(i.normalMapType=e.normalMapType),e.normalScale!==void 0){let s=e.normalScale;Array.isArray(s)===!1&&(s=[s,s]),i.normalScale=new ie().fromArray(s)}return e.displacementMap!==void 0&&(i.displacementMap=n(e.displacementMap)),e.displacementScale!==void 0&&(i.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(i.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(i.roughnessMap=n(e.roughnessMap)),e.metalnessMap!==void 0&&(i.metalnessMap=n(e.metalnessMap)),e.emissiveMap!==void 0&&(i.emissiveMap=n(e.emissiveMap)),e.emissiveIntensity!==void 0&&(i.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(i.specularMap=n(e.specularMap)),e.specularIntensityMap!==void 0&&(i.specularIntensityMap=n(e.specularIntensityMap)),e.specularColorMap!==void 0&&(i.specularColorMap=n(e.specularColorMap)),e.envMap!==void 0&&(i.envMap=n(e.envMap)),e.envMapIntensity!==void 0&&(i.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(i.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(i.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(i.lightMap=n(e.lightMap)),e.lightMapIntensity!==void 0&&(i.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(i.aoMap=n(e.aoMap)),e.aoMapIntensity!==void 0&&(i.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(i.gradientMap=n(e.gradientMap)),e.clearcoatMap!==void 0&&(i.clearcoatMap=n(e.clearcoatMap)),e.clearcoatRoughnessMap!==void 0&&(i.clearcoatRoughnessMap=n(e.clearcoatRoughnessMap)),e.clearcoatNormalMap!==void 0&&(i.clearcoatNormalMap=n(e.clearcoatNormalMap)),e.clearcoatNormalScale!==void 0&&(i.clearcoatNormalScale=new ie().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(i.iridescenceMap=n(e.iridescenceMap)),e.iridescenceThicknessMap!==void 0&&(i.iridescenceThicknessMap=n(e.iridescenceThicknessMap)),e.transmissionMap!==void 0&&(i.transmissionMap=n(e.transmissionMap)),e.thicknessMap!==void 0&&(i.thicknessMap=n(e.thicknessMap)),e.anisotropyMap!==void 0&&(i.anisotropyMap=n(e.anisotropyMap)),e.sheenColorMap!==void 0&&(i.sheenColorMap=n(e.sheenColorMap)),e.sheenRoughnessMap!==void 0&&(i.sheenRoughnessMap=n(e.sheenRoughnessMap)),i}setTextures(e){return this.textures=e,this}static createMaterialFromType(e){return new{ShadowMaterial:rc,SpriteMaterial:va,RawShaderMaterial:sc,ShaderMaterial:Vt,PointsMaterial:wa,MeshPhysicalMaterial:ac,MeshStandardMaterial:Ga,MeshPhongMaterial:oc,MeshToonMaterial:lc,MeshNormalMaterial:cc,MeshLambertMaterial:hc,MeshDepthMaterial:ma,MeshDistanceMaterial:ga,MeshBasicMaterial:hn,MeshMatcapMaterial:uc,LineDashedMaterial:dc,LineBasicMaterial:gt,Material:ct}[e]}}class Za{static decodeText(e){if(typeof TextDecoder<"u")return new TextDecoder().decode(e);let t="";for(let n=0,i=e.length;n<i;n++)t+=String.fromCharCode(e[n]);try{return decodeURIComponent(escape(t))}catch{return t}}static extractUrlBase(e){const t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}}class Lc extends Ae{constructor(){super(),this.isInstancedBufferGeometry=!0,this.type="InstancedBufferGeometry",this.instanceCount=1/0}copy(e){return super.copy(e),this.instanceCount=e.instanceCount,this}toJSON(){const e=super.toJSON();return e.instanceCount=this.instanceCount,e.isInstancedBufferGeometry=!0,e}}class Pc extends Mt{constructor(e){super(e)}load(e,t,n,i){const s=this,a=new nn(s.manager);a.setPath(s.path),a.setRequestHeader(s.requestHeader),a.setWithCredentials(s.withCredentials),a.load(e,(function(o){try{t(s.parse(JSON.parse(o)))}catch(l){i?i(l):console.error(l),s.manager.itemError(e)}}),n,i)}parse(e){const t={},n={};function i(u,d){if(t[d]!==void 0)return t[d];const p=u.interleavedBuffers[d],m=(function(x,v){if(n[v]!==void 0)return n[v];const _=x.arrayBuffers,M=_[v],C=new Uint32Array(M).buffer;return n[v]=C,C})(u,p.buffer),g=kn(p.type,m),f=new Gr(g,p.stride);return f.uuid=p.uuid,t[d]=f,f}const s=e.isInstancedBufferGeometry?new Lc:new Ae,a=e.data.index;if(a!==void 0){const u=kn(a.type,a.array);s.setIndex(new Ve(u,1))}const o=e.data.attributes;for(const u in o){const d=o[u];let p;if(d.isInterleavedBufferAttribute){const m=i(e.data,d.data);p=new En(m,d.itemSize,d.offset,d.normalized)}else{const m=kn(d.type,d.array);p=new(d.isInstancedBufferAttribute?fi:Ve)(m,d.itemSize,d.normalized)}d.name!==void 0&&(p.name=d.name),d.usage!==void 0&&p.setUsage(d.usage),s.setAttribute(u,p)}const l=e.data.morphAttributes;if(l)for(const u in l){const d=l[u],p=[];for(let m=0,g=d.length;m<g;m++){const f=d[m];let x;if(f.isInterleavedBufferAttribute){const v=i(e.data,f.data);x=new En(v,f.itemSize,f.offset,f.normalized)}else{const v=kn(f.type,f.array);x=new Ve(v,f.itemSize,f.normalized)}f.name!==void 0&&(x.name=f.name),p.push(x)}s.morphAttributes[u]=p}e.data.morphTargetsRelative&&(s.morphTargetsRelative=!0);const c=e.data.groups||e.data.drawcalls||e.data.offsets;if(c!==void 0)for(let u=0,d=c.length;u!==d;++u){const p=c[u];s.addGroup(p.start,p.count,p.materialIndex)}const h=e.data.boundingSphere;if(h!==void 0){const u=new w;h.center!==void 0&&u.fromArray(h.center),s.boundingSphere=new ot(u,h.radius)}return e.name&&(s.name=e.name),e.userData&&(s.userData=e.userData),s}}const zd={UVMapping:300,CubeReflectionMapping:301,CubeRefractionMapping:302,EquirectangularReflectionMapping:303,EquirectangularRefractionMapping:304,CubeUVReflectionMapping:306},Ic={RepeatWrapping:1e3,ClampToEdgeWrapping:1001,MirroredRepeatWrapping:1002},Uc={NearestFilter:1003,NearestMipmapNearestFilter:1004,NearestMipmapLinearFilter:1005,LinearFilter:1006,LinearMipmapNearestFilter:1007,LinearMipmapLinearFilter:1008};let Ss;class Ja{static getContext(){return Ss===void 0&&(Ss=new(window.AudioContext||window.webkitAudioContext)),Ss}static setContext(e){Ss=e}}const Dc=new Me,Nc=new Me,Un=new Me;class Oc{constructor(e=!0){this.autoStart=e,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1}start(){this.startTime=Fc(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let e=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){const t=Fc();e=(t-this.oldTime)/1e3,this.oldTime=t,this.elapsedTime+=e}return e}}function Fc(){return(typeof performance>"u"?Date:performance).now()}const Dn=new w,Bc=new vt,Gd=new w,Nn=new w;class zc extends Be{constructor(e){super(),this.type="Audio",this.listener=e,this.context=e.context,this.gain=this.context.createGain(),this.gain.connect(e.getInput()),this.autoplay=!1,this.buffer=null,this.detune=0,this.loop=!1,this.loopStart=0,this.loopEnd=0,this.offset=0,this.duration=void 0,this.playbackRate=1,this.isPlaying=!1,this.hasPlaybackControl=!0,this.source=null,this.sourceType="empty",this._startedAt=0,this._progress=0,this._connected=!1,this.filters=[]}getOutput(){return this.gain}setNodeSource(e){return this.hasPlaybackControl=!1,this.sourceType="audioNode",this.source=e,this.connect(),this}setMediaElementSource(e){return this.hasPlaybackControl=!1,this.sourceType="mediaNode",this.source=this.context.createMediaElementSource(e),this.connect(),this}setMediaStreamSource(e){return this.hasPlaybackControl=!1,this.sourceType="mediaStreamNode",this.source=this.context.createMediaStreamSource(e),this.connect(),this}setBuffer(e){return this.buffer=e,this.sourceType="buffer",this.autoplay&&this.play(),this}play(e=0){if(this.isPlaying===!0)return void console.warn("THREE.Audio: Audio is already playing.");if(this.hasPlaybackControl===!1)return void console.warn("THREE.Audio: this Audio has no playback control.");this._startedAt=this.context.currentTime+e;const t=this.context.createBufferSource();return t.buffer=this.buffer,t.loop=this.loop,t.loopStart=this.loopStart,t.loopEnd=this.loopEnd,t.onended=this.onEnded.bind(this),t.start(this._startedAt,this._progress+this.offset,this.duration),this.isPlaying=!0,this.source=t,this.setDetune(this.detune),this.setPlaybackRate(this.playbackRate),this.connect()}pause(){if(this.hasPlaybackControl!==!1)return this.isPlaying===!0&&(this._progress+=Math.max(this.context.currentTime-this._startedAt,0)*this.playbackRate,this.loop===!0&&(this._progress=this._progress%(this.duration||this.buffer.duration)),this.source.stop(),this.source.onended=null,this.isPlaying=!1),this;console.warn("THREE.Audio: this Audio has no playback control.")}stop(){if(this.hasPlaybackControl!==!1)return this._progress=0,this.source!==null&&(this.source.stop(),this.source.onended=null),this.isPlaying=!1,this;console.warn("THREE.Audio: this Audio has no playback control.")}connect(){if(this.filters.length>0){this.source.connect(this.filters[0]);for(let e=1,t=this.filters.length;e<t;e++)this.filters[e-1].connect(this.filters[e]);this.filters[this.filters.length-1].connect(this.getOutput())}else this.source.connect(this.getOutput());return this._connected=!0,this}disconnect(){if(this._connected!==!1){if(this.filters.length>0){this.source.disconnect(this.filters[0]);for(let e=1,t=this.filters.length;e<t;e++)this.filters[e-1].disconnect(this.filters[e]);this.filters[this.filters.length-1].disconnect(this.getOutput())}else this.source.disconnect(this.getOutput());return this._connected=!1,this}}getFilters(){return this.filters}setFilters(e){return e||(e=[]),this._connected===!0?(this.disconnect(),this.filters=e.slice(),this.connect()):this.filters=e.slice(),this}setDetune(e){if(this.detune=e,this.source.detune!==void 0)return this.isPlaying===!0&&this.source.detune.setTargetAtTime(this.detune,this.context.currentTime,.01),this}getDetune(){return this.detune}getFilter(){return this.getFilters()[0]}setFilter(e){return this.setFilters(e?[e]:[])}setPlaybackRate(e){if(this.hasPlaybackControl!==!1)return this.playbackRate=e,this.isPlaying===!0&&this.source.playbackRate.setTargetAtTime(this.playbackRate,this.context.currentTime,.01),this;console.warn("THREE.Audio: this Audio has no playback control.")}getPlaybackRate(){return this.playbackRate}onEnded(){this.isPlaying=!1}getLoop(){return this.hasPlaybackControl===!1?(console.warn("THREE.Audio: this Audio has no playback control."),!1):this.loop}setLoop(e){if(this.hasPlaybackControl!==!1)return this.loop=e,this.isPlaying===!0&&(this.source.loop=this.loop),this;console.warn("THREE.Audio: this Audio has no playback control.")}setLoopStart(e){return this.loopStart=e,this}setLoopEnd(e){return this.loopEnd=e,this}getVolume(){return this.gain.gain.value}setVolume(e){return this.gain.gain.setTargetAtTime(e,this.context.currentTime,.01),this}}const On=new w,Gc=new vt,Hd=new w,Fn=new w;class Hc{constructor(e,t,n){let i,s,a;switch(this.binding=e,this.valueSize=n,t){case"quaternion":i=this._slerp,s=this._slerpAdditive,a=this._setAdditiveIdentityQuaternion,this.buffer=new Float64Array(6*n),this._workIndex=5;break;case"string":case"bool":i=this._select,s=this._select,a=this._setAdditiveIdentityOther,this.buffer=new Array(5*n);break;default:i=this._lerp,s=this._lerpAdditive,a=this._setAdditiveIdentityNumeric,this.buffer=new Float64Array(5*n)}this._mixBufferRegion=i,this._mixBufferRegionAdditive=s,this._setIdentity=a,this._origIndex=3,this._addIndex=4,this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,this.useCount=0,this.referenceCount=0}accumulate(e,t){const n=this.buffer,i=this.valueSize,s=e*i+i;let a=this.cumulativeWeight;if(a===0){for(let o=0;o!==i;++o)n[s+o]=n[o];a=t}else{a+=t;const o=t/a;this._mixBufferRegion(n,s,0,o,i)}this.cumulativeWeight=a}accumulateAdditive(e){const t=this.buffer,n=this.valueSize,i=n*this._addIndex;this.cumulativeWeightAdditive===0&&this._setIdentity(),this._mixBufferRegionAdditive(t,i,0,e,n),this.cumulativeWeightAdditive+=e}apply(e){const t=this.valueSize,n=this.buffer,i=e*t+t,s=this.cumulativeWeight,a=this.cumulativeWeightAdditive,o=this.binding;if(this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,s<1){const l=t*this._origIndex;this._mixBufferRegion(n,i,l,1-s,t)}a>0&&this._mixBufferRegionAdditive(n,i,this._addIndex*t,1,t);for(let l=t,c=t+t;l!==c;++l)if(n[l]!==n[l+t]){o.setValue(n,i);break}}saveOriginalState(){const e=this.binding,t=this.buffer,n=this.valueSize,i=n*this._origIndex;e.getValue(t,i);for(let s=n,a=i;s!==a;++s)t[s]=t[i+s%n];this._setIdentity(),this.cumulativeWeight=0,this.cumulativeWeightAdditive=0}restoreOriginalState(){const e=3*this.valueSize;this.binding.setValue(this.buffer,e)}_setAdditiveIdentityNumeric(){const e=this._addIndex*this.valueSize,t=e+this.valueSize;for(let n=e;n<t;n++)this.buffer[n]=0}_setAdditiveIdentityQuaternion(){this._setAdditiveIdentityNumeric(),this.buffer[this._addIndex*this.valueSize+3]=1}_setAdditiveIdentityOther(){const e=this._origIndex*this.valueSize,t=this._addIndex*this.valueSize;for(let n=0;n<this.valueSize;n++)this.buffer[t+n]=this.buffer[e+n]}_select(e,t,n,i,s){if(i>=.5)for(let a=0;a!==s;++a)e[t+a]=e[n+a]}_slerp(e,t,n,i){vt.slerpFlat(e,t,e,t,e,n,i)}_slerpAdditive(e,t,n,i,s){const a=this._workIndex*s;vt.multiplyQuaternionsFlat(e,a,e,t,e,n),vt.slerpFlat(e,t,e,t,e,a,i)}_lerp(e,t,n,i,s){const a=1-i;for(let o=0;o!==s;++o){const l=t+o;e[l]=e[l]*a+e[n+o]*i}}_lerpAdditive(e,t,n,i,s){for(let a=0;a!==s;++a){const o=t+a;e[o]=e[o]+e[n+a]*i}}}const Ka="\\[\\]\\.:\\/",Vd=new RegExp("["+Ka+"]","g"),$a="[^"+Ka+"]",kd="[^"+Ka.replace("\\.","")+"]",Wd=new RegExp("^"+/((?:WC+[\/:])*)/.source.replace("WC",$a)+/(WCOD+)?/.source.replace("WCOD",kd)+/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",$a)+/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",$a)+"$"),Xd=["material","materials","bones","map"];class Fe{constructor(e,t,n){this.path=t,this.parsedPath=n||Fe.parseTrackName(t),this.node=Fe.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new Fe.Composite(e,t,n):new Fe(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(Vd,"")}static parseTrackName(e){const t=Wd.exec(e);if(t===null)throw new Error("PropertyBinding: Cannot parse trackName: "+e);const n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){const s=n.nodeName.substring(i+1);Xd.indexOf(s)!==-1&&(n.nodeName=n.nodeName.substring(0,i),n.objectName=s)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){const n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){const n=function(s){for(let a=0;a<s.length;a++){const o=s[a];if(o.name===t||o.uuid===t)return o;const l=n(o.children);if(l)return l}return null},i=n(e.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){const n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)e[t++]=n[i]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){const n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++]}_setValue_array_setNeedsUpdate(e,t){const n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){const n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node;const t=this.parsedPath,n=t.objectName,i=t.propertyName;let s=t.propertyIndex;if(e||(e=Fe.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e)return void console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");if(n){let c=t.objectIndex;switch(n){case"materials":if(!e.material)return void console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);if(!e.material.materials)return void console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);e=e.material.materials;break;case"bones":if(!e.skeleton)return void console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===c){c=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material)return void console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);if(!e.material.map)return void console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);e=e.material.map;break;default:if(e[n]===void 0)return void console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);e=e[n]}if(c!==void 0){if(e[c]===void 0)return void console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);e=e[c]}}const a=e[i];if(a===void 0){const c=t.nodeName;return void console.error("THREE.PropertyBinding: Trying to update property for track: "+c+"."+i+" but it wasn't found.",e)}let o=this.Versioning.None;this.targetObject=e,e.needsUpdate!==void 0?o=this.Versioning.NeedsUpdate:e.matrixWorldNeedsUpdate!==void 0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(i==="morphTargetInfluences"){if(!e.geometry)return void console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);if(!e.geometry.morphAttributes)return void console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=s}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=i;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}Fe.Composite=class{constructor(r,e,t){const n=t||Fe.parseTrackName(e);this._targetGroup=r,this._bindings=r.subscribe_(e,n)}getValue(r,e){this.bind();const t=this._targetGroup.nCachedObjects_,n=this._bindings[t];n!==void 0&&n.getValue(r,e)}setValue(r,e){const t=this._bindings;for(let n=this._targetGroup.nCachedObjects_,i=t.length;n!==i;++n)t[n].setValue(r,e)}bind(){const r=this._bindings;for(let e=this._targetGroup.nCachedObjects_,t=r.length;e!==t;++e)r[e].bind()}unbind(){const r=this._bindings;for(let e=this._targetGroup.nCachedObjects_,t=r.length;e!==t;++e)r[e].unbind()}},Fe.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3},Fe.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2},Fe.prototype.GetterByBindingType=[Fe.prototype._getValue_direct,Fe.prototype._getValue_array,Fe.prototype._getValue_arrayElement,Fe.prototype._getValue_toArray],Fe.prototype.SetterByBindingTypeAndVersioning=[[Fe.prototype._setValue_direct,Fe.prototype._setValue_direct_setNeedsUpdate,Fe.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Fe.prototype._setValue_array,Fe.prototype._setValue_array_setNeedsUpdate,Fe.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Fe.prototype._setValue_arrayElement,Fe.prototype._setValue_arrayElement_setNeedsUpdate,Fe.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Fe.prototype._setValue_fromArray,Fe.prototype._setValue_fromArray_setNeedsUpdate,Fe.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];class Vc{constructor(e,t,n=null,i=t.blendMode){this._mixer=e,this._clip=t,this._localRoot=n,this.blendMode=i;const s=t.tracks,a=s.length,o=new Array(a),l={endingStart:2400,endingEnd:2400};for(let c=0;c!==a;++c){const h=s[c].createInterpolant(null);o[c]=h,h.settings=l}this._interpolantSettings=l,this._interpolants=o,this._propertyBindings=new Array(a),this._cacheIndex=null,this._byClipCacheIndex=null,this._timeScaleInterpolant=null,this._weightInterpolant=null,this.loop=2201,this._loopCount=-1,this._startTime=null,this.time=0,this.timeScale=1,this._effectiveTimeScale=1,this.weight=1,this._effectiveWeight=1,this.repetitions=1/0,this.paused=!1,this.enabled=!0,this.clampWhenFinished=!1,this.zeroSlopeAtStart=!0,this.zeroSlopeAtEnd=!0}play(){return this._mixer._activateAction(this),this}stop(){return this._mixer._deactivateAction(this),this.reset()}reset(){return this.paused=!1,this.enabled=!0,this.time=0,this._loopCount=-1,this._startTime=null,this.stopFading().stopWarping()}isRunning(){return this.enabled&&!this.paused&&this.timeScale!==0&&this._startTime===null&&this._mixer._isActiveAction(this)}isScheduled(){return this._mixer._isActiveAction(this)}startAt(e){return this._startTime=e,this}setLoop(e,t){return this.loop=e,this.repetitions=t,this}setEffectiveWeight(e){return this.weight=e,this._effectiveWeight=this.enabled?e:0,this.stopFading()}getEffectiveWeight(){return this._effectiveWeight}fadeIn(e){return this._scheduleFading(e,0,1)}fadeOut(e){return this._scheduleFading(e,1,0)}crossFadeFrom(e,t,n){if(e.fadeOut(t),this.fadeIn(t),n){const i=this._clip.duration,s=e._clip.duration,a=s/i,o=i/s;e.warp(1,a,t),this.warp(o,1,t)}return this}crossFadeTo(e,t,n){return e.crossFadeFrom(this,t,n)}stopFading(){const e=this._weightInterpolant;return e!==null&&(this._weightInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}setEffectiveTimeScale(e){return this.timeScale=e,this._effectiveTimeScale=this.paused?0:e,this.stopWarping()}getEffectiveTimeScale(){return this._effectiveTimeScale}setDuration(e){return this.timeScale=this._clip.duration/e,this.stopWarping()}syncWith(e){return this.time=e.time,this.timeScale=e.timeScale,this.stopWarping()}halt(e){return this.warp(this._effectiveTimeScale,0,e)}warp(e,t,n){const i=this._mixer,s=i.time,a=this.timeScale;let o=this._timeScaleInterpolant;o===null&&(o=i._lendControlInterpolant(),this._timeScaleInterpolant=o);const l=o.parameterPositions,c=o.sampleValues;return l[0]=s,l[1]=s+n,c[0]=e/a,c[1]=t/a,this}stopWarping(){const e=this._timeScaleInterpolant;return e!==null&&(this._timeScaleInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}getMixer(){return this._mixer}getClip(){return this._clip}getRoot(){return this._localRoot||this._mixer._root}_update(e,t,n,i){if(!this.enabled)return void this._updateWeight(e);const s=this._startTime;if(s!==null){const l=(e-s)*n;l<0||n===0?t=0:(this._startTime=null,t=n*l)}t*=this._updateTimeScale(e);const a=this._updateTime(t),o=this._updateWeight(e);if(o>0){const l=this._interpolants,c=this._propertyBindings;if(this.blendMode===2501)for(let h=0,u=l.length;h!==u;++h)l[h].evaluate(a),c[h].accumulateAdditive(o);else for(let h=0,u=l.length;h!==u;++h)l[h].evaluate(a),c[h].accumulate(i,o)}}_updateWeight(e){let t=0;if(this.enabled){t=this.weight;const n=this._weightInterpolant;if(n!==null){const i=n.evaluate(e)[0];t*=i,e>n.parameterPositions[1]&&(this.stopFading(),i===0&&(this.enabled=!1))}}return this._effectiveWeight=t,t}_updateTimeScale(e){let t=0;if(!this.paused){t=this.timeScale;const n=this._timeScaleInterpolant;n!==null&&(t*=n.evaluate(e)[0],e>n.parameterPositions[1]&&(this.stopWarping(),t===0?this.paused=!0:this.timeScale=t))}return this._effectiveTimeScale=t,t}_updateTime(e){const t=this._clip.duration,n=this.loop;let i=this.time+e,s=this._loopCount;const a=n===2202;if(e===0)return s===-1?i:a&&(1&s)==1?t-i:i;if(n===2200){s===-1&&(this._loopCount=0,this._setEndings(!0,!0,!1));e:{if(i>=t)i=t;else{if(!(i<0)){this.time=i;break e}i=0}this.clampWhenFinished?this.paused=!0:this.enabled=!1,this.time=i,this._mixer.dispatchEvent({type:"finished",action:this,direction:e<0?-1:1})}}else{if(s===-1&&(e>=0?(s=0,this._setEndings(!0,this.repetitions===0,a)):this._setEndings(this.repetitions===0,!0,a)),i>=t||i<0){const o=Math.floor(i/t);i-=t*o,s+=Math.abs(o);const l=this.repetitions-s;if(l<=0)this.clampWhenFinished?this.paused=!0:this.enabled=!1,i=e>0?t:0,this.time=i,this._mixer.dispatchEvent({type:"finished",action:this,direction:e>0?1:-1});else{if(l===1){const c=e<0;this._setEndings(c,!c,a)}else this._setEndings(!1,!1,a);this._loopCount=s,this.time=i,this._mixer.dispatchEvent({type:"loop",action:this,loopDelta:o})}}else this.time=i;if(a&&(1&s)==1)return t-i}return i}_setEndings(e,t,n){const i=this._interpolantSettings;n?(i.endingStart=2401,i.endingEnd=2401):(i.endingStart=e?this.zeroSlopeAtStart?2401:2400:2402,i.endingEnd=t?this.zeroSlopeAtEnd?2401:2400:2402)}_scheduleFading(e,t,n){const i=this._mixer,s=i.time;let a=this._weightInterpolant;a===null&&(a=i._lendControlInterpolant(),this._weightInterpolant=a);const o=a.parameterPositions,l=a.sampleValues;return o[0]=s,l[0]=t,o[1]=s+e,l[1]=n,this}}const jd=new Float32Array(1);class Qa{constructor(e){this.value=e}clone(){return new Qa(this.value.clone===void 0?this.value:this.value.clone())}}let qd=0;function kc(r,e){return r.distance-e.distance}function eo(r,e,t,n){if(r.layers.test(e.layers)&&r.raycast(e,t),n===!0){const i=r.children;for(let s=0,a=i.length;s<a;s++)eo(i[s],e,t,!0)}}const Wc=new ie,Xc=new w,bs=new w,jc=new w,gn=new w,Ts=new Me,to=new Me;function qc(r){const e=[];r.isBone===!0&&e.push(r);for(let t=0;t<r.children.length;t++)e.push.apply(e,qc(r.children[t]));return e}const Yd=new w,Yc=new de,Zc=new de,Jc=new w,Es=new w,Kc=new w,ws=new w,Ye=new Pr;function Je(r,e,t,n,i,s,a){ws.set(i,s,a).unproject(n);const o=e[r];if(o!==void 0){const l=t.getAttribute("position");for(let c=0,h=o.length;c<h;c++)l.setXYZ(o[c],ws.x,ws.y,ws.z)}}const As=new pt,$c=new w;let Rs,no;typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"160"}})),typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="160"),y.ACESFilmicToneMapping=4,y.AddEquation=100,y.AddOperation=2,y.AdditiveAnimationBlendMode=2501,y.AdditiveBlending=2,y.AgXToneMapping=6,y.AlphaFormat=1021,y.AlwaysCompare=519,y.AlwaysDepth=1,y.AlwaysStencilFunc=519,y.AmbientLight=wc,y.AnimationAction=Vc,y.AnimationClip=nr,y.AnimationLoader=class extends Mt{constructor(r){super(r)}load(r,e,t,n){const i=this,s=new nn(this.manager);s.setPath(this.path),s.setRequestHeader(this.requestHeader),s.setWithCredentials(this.withCredentials),s.load(r,(function(a){try{e(i.parse(JSON.parse(a)))}catch(o){n?n(o):console.error(o),i.manager.itemError(r)}}),t,n)}parse(r){const e=[];for(let t=0;t<r.length;t++){const n=nr.parse(r[t]);e.push(n)}return e}},y.AnimationMixer=class extends qt{constructor(r){super(),this._root=r,this._initMemoryManager(),this._accuIndex=0,this.time=0,this.timeScale=1}_bindAction(r,e){const t=r._localRoot||this._root,n=r._clip.tracks,i=n.length,s=r._propertyBindings,a=r._interpolants,o=t.uuid,l=this._bindingsByRootAndName;let c=l[o];c===void 0&&(c={},l[o]=c);for(let h=0;h!==i;++h){const u=n[h],d=u.name;let p=c[d];if(p!==void 0)++p.referenceCount,s[h]=p;else{if(p=s[h],p!==void 0){p._cacheIndex===null&&(++p.referenceCount,this._addInactiveBinding(p,o,d));continue}const m=e&&e._propertyBindings[h].binding.parsedPath;p=new Hc(Fe.create(t,d,m),u.ValueTypeName,u.getValueSize()),++p.referenceCount,this._addInactiveBinding(p,o,d),s[h]=p}a[h].resultBuffer=p.buffer}}_activateAction(r){if(!this._isActiveAction(r)){if(r._cacheIndex===null){const t=(r._localRoot||this._root).uuid,n=r._clip.uuid,i=this._actionsByClip[n];this._bindAction(r,i&&i.knownActions[0]),this._addInactiveAction(r,n,t)}const e=r._propertyBindings;for(let t=0,n=e.length;t!==n;++t){const i=e[t];i.useCount++==0&&(this._lendBinding(i),i.saveOriginalState())}this._lendAction(r)}}_deactivateAction(r){if(this._isActiveAction(r)){const e=r._propertyBindings;for(let t=0,n=e.length;t!==n;++t){const i=e[t];--i.useCount==0&&(i.restoreOriginalState(),this._takeBackBinding(i))}this._takeBackAction(r)}}_initMemoryManager(){this._actions=[],this._nActiveActions=0,this._actionsByClip={},this._bindings=[],this._nActiveBindings=0,this._bindingsByRootAndName={},this._controlInterpolants=[],this._nActiveControlInterpolants=0;const r=this;this.stats={actions:{get total(){return r._actions.length},get inUse(){return r._nActiveActions}},bindings:{get total(){return r._bindings.length},get inUse(){return r._nActiveBindings}},controlInterpolants:{get total(){return r._controlInterpolants.length},get inUse(){return r._nActiveControlInterpolants}}}}_isActiveAction(r){const e=r._cacheIndex;return e!==null&&e<this._nActiveActions}_addInactiveAction(r,e,t){const n=this._actions,i=this._actionsByClip;let s=i[e];if(s===void 0)s={knownActions:[r],actionByRoot:{}},r._byClipCacheIndex=0,i[e]=s;else{const a=s.knownActions;r._byClipCacheIndex=a.length,a.push(r)}r._cacheIndex=n.length,n.push(r),s.actionByRoot[t]=r}_removeInactiveAction(r){const e=this._actions,t=e[e.length-1],n=r._cacheIndex;t._cacheIndex=n,e[n]=t,e.pop(),r._cacheIndex=null;const i=r._clip.uuid,s=this._actionsByClip,a=s[i],o=a.knownActions,l=o[o.length-1],c=r._byClipCacheIndex;l._byClipCacheIndex=c,o[c]=l,o.pop(),r._byClipCacheIndex=null,delete a.actionByRoot[(r._localRoot||this._root).uuid],o.length===0&&delete s[i],this._removeInactiveBindingsForAction(r)}_removeInactiveBindingsForAction(r){const e=r._propertyBindings;for(let t=0,n=e.length;t!==n;++t){const i=e[t];--i.referenceCount==0&&this._removeInactiveBinding(i)}}_lendAction(r){const e=this._actions,t=r._cacheIndex,n=this._nActiveActions++,i=e[n];r._cacheIndex=n,e[n]=r,i._cacheIndex=t,e[t]=i}_takeBackAction(r){const e=this._actions,t=r._cacheIndex,n=--this._nActiveActions,i=e[n];r._cacheIndex=n,e[n]=r,i._cacheIndex=t,e[t]=i}_addInactiveBinding(r,e,t){const n=this._bindingsByRootAndName,i=this._bindings;let s=n[e];s===void 0&&(s={},n[e]=s),s[t]=r,r._cacheIndex=i.length,i.push(r)}_removeInactiveBinding(r){const e=this._bindings,t=r.binding,n=t.rootNode.uuid,i=t.path,s=this._bindingsByRootAndName,a=s[n],o=e[e.length-1],l=r._cacheIndex;o._cacheIndex=l,e[l]=o,e.pop(),delete a[i],Object.keys(a).length===0&&delete s[n]}_lendBinding(r){const e=this._bindings,t=r._cacheIndex,n=this._nActiveBindings++,i=e[n];r._cacheIndex=n,e[n]=r,i._cacheIndex=t,e[t]=i}_takeBackBinding(r){const e=this._bindings,t=r._cacheIndex,n=--this._nActiveBindings,i=e[n];r._cacheIndex=n,e[n]=r,i._cacheIndex=t,e[t]=i}_lendControlInterpolant(){const r=this._controlInterpolants,e=this._nActiveControlInterpolants++;let t=r[e];return t===void 0&&(t=new ka(new Float32Array(2),new Float32Array(2),1,jd),t.__cacheIndex=e,r[e]=t),t}_takeBackControlInterpolant(r){const e=this._controlInterpolants,t=r.__cacheIndex,n=--this._nActiveControlInterpolants,i=e[n];r.__cacheIndex=n,e[n]=r,i.__cacheIndex=t,e[t]=i}clipAction(r,e,t){const n=e||this._root,i=n.uuid;let s=typeof r=="string"?nr.findByName(n,r):r;const a=s!==null?s.uuid:r,o=this._actionsByClip[a];let l=null;if(t===void 0&&(t=s!==null?s.blendMode:2500),o!==void 0){const h=o.actionByRoot[i];if(h!==void 0&&h.blendMode===t)return h;l=o.knownActions[0],s===null&&(s=l._clip)}if(s===null)return null;const c=new Vc(this,s,e,t);return this._bindAction(c,l),this._addInactiveAction(c,a,i),c}existingAction(r,e){const t=e||this._root,n=t.uuid,i=typeof r=="string"?nr.findByName(t,r):r,s=i?i.uuid:r,a=this._actionsByClip[s];return a!==void 0&&a.actionByRoot[n]||null}stopAllAction(){const r=this._actions;for(let e=this._nActiveActions-1;e>=0;--e)r[e].stop();return this}update(r){r*=this.timeScale;const e=this._actions,t=this._nActiveActions,n=this.time+=r,i=Math.sign(r),s=this._accuIndex^=1;for(let l=0;l!==t;++l)e[l]._update(n,r,i,s);const a=this._bindings,o=this._nActiveBindings;for(let l=0;l!==o;++l)a[l].apply(s);return this}setTime(r){this.time=0;for(let e=0;e<this._actions.length;e++)this._actions[e].time=0;return this.update(r)}getRoot(){return this._root}uncacheClip(r){const e=this._actions,t=r.uuid,n=this._actionsByClip,i=n[t];if(i!==void 0){const s=i.knownActions;for(let a=0,o=s.length;a!==o;++a){const l=s[a];this._deactivateAction(l);const c=l._cacheIndex,h=e[e.length-1];l._cacheIndex=null,l._byClipCacheIndex=null,h._cacheIndex=c,e[c]=h,e.pop(),this._removeInactiveBindingsForAction(l)}delete n[t]}}uncacheRoot(r){const e=r.uuid,t=this._actionsByClip;for(const i in t){const s=t[i].actionByRoot[e];s!==void 0&&(this._deactivateAction(s),this._removeInactiveAction(s))}const n=this._bindingsByRootAndName[e];if(n!==void 0)for(const i in n){const s=n[i];s.restoreOriginalState(),this._removeInactiveBinding(s)}}uncacheAction(r,e){const t=this.existingAction(r,e);t!==null&&(this._deactivateAction(t),this._removeInactiveAction(t))}},y.AnimationObjectGroup=class{constructor(){this.isAnimationObjectGroup=!0,this.uuid=bt(),this._objects=Array.prototype.slice.call(arguments),this.nCachedObjects_=0;const r={};this._indicesByUUID=r;for(let t=0,n=arguments.length;t!==n;++t)r[arguments[t].uuid]=t;this._paths=[],this._parsedPaths=[],this._bindings=[],this._bindingsIndicesByPath={};const e=this;this.stats={objects:{get total(){return e._objects.length},get inUse(){return this.total-e.nCachedObjects_}},get bindingsPerObject(){return e._bindings.length}}}add(){const r=this._objects,e=this._indicesByUUID,t=this._paths,n=this._parsedPaths,i=this._bindings,s=i.length;let a,o=r.length,l=this.nCachedObjects_;for(let c=0,h=arguments.length;c!==h;++c){const u=arguments[c],d=u.uuid;let p=e[d];if(p===void 0){p=o++,e[d]=p,r.push(u);for(let m=0,g=s;m!==g;++m)i[m].push(new Fe(u,t[m],n[m]))}else if(p<l){a=r[p];const m=--l,g=r[m];e[g.uuid]=p,r[p]=g,e[d]=m,r[m]=u;for(let f=0,x=s;f!==x;++f){const v=i[f],_=v[m];let M=v[p];v[p]=_,M===void 0&&(M=new Fe(u,t[f],n[f])),v[m]=M}}else r[p]!==a&&console.error("THREE.AnimationObjectGroup: Different objects with the same UUID detected. Clean the caches or recreate your infrastructure when reloading scenes.")}this.nCachedObjects_=l}remove(){const r=this._objects,e=this._indicesByUUID,t=this._bindings,n=t.length;let i=this.nCachedObjects_;for(let s=0,a=arguments.length;s!==a;++s){const o=arguments[s],l=o.uuid,c=e[l];if(c!==void 0&&c>=i){const h=i++,u=r[h];e[u.uuid]=c,r[c]=u,e[l]=h,r[h]=o;for(let d=0,p=n;d!==p;++d){const m=t[d],g=m[h],f=m[c];m[c]=g,m[h]=f}}}this.nCachedObjects_=i}uncache(){const r=this._objects,e=this._indicesByUUID,t=this._bindings,n=t.length;let i=this.nCachedObjects_,s=r.length;for(let a=0,o=arguments.length;a!==o;++a){const l=arguments[a].uuid,c=e[l];if(c!==void 0)if(delete e[l],c<i){const h=--i,u=r[h],d=--s,p=r[d];e[u.uuid]=c,r[c]=u,e[p.uuid]=h,r[h]=p,r.pop();for(let m=0,g=n;m!==g;++m){const f=t[m],x=f[h],v=f[d];f[c]=x,f[h]=v,f.pop()}}else{const h=--s,u=r[h];h>0&&(e[u.uuid]=c),r[c]=u,r.pop();for(let d=0,p=n;d!==p;++d){const m=t[d];m[c]=m[h],m.pop()}}}this.nCachedObjects_=i}subscribe_(r,e){const t=this._bindingsIndicesByPath;let n=t[r];const i=this._bindings;if(n!==void 0)return i[n];const s=this._paths,a=this._parsedPaths,o=this._objects,l=o.length,c=this.nCachedObjects_,h=new Array(l);n=i.length,t[r]=n,s.push(r),a.push(e),i.push(h);for(let u=c,d=o.length;u!==d;++u){const p=o[u];h[u]=new Fe(p,r,e)}return h}unsubscribe_(r){const e=this._bindingsIndicesByPath,t=e[r];if(t!==void 0){const n=this._paths,i=this._parsedPaths,s=this._bindings,a=s.length-1,o=s[a];e[r[a]]=t,s[t]=o,s.pop(),i[t]=i[a],i.pop(),n[t]=n[a],n.pop()}}},y.AnimationUtils=Ud,y.ArcCurve=Vl,y.ArrayCamera=hl,y.ArrowHelper=class extends Be{constructor(r=new w(0,0,1),e=new w(0,0,0),t=1,n=16776960,i=.2*t,s=.2*i){super(),this.type="ArrowHelper",Rs===void 0&&(Rs=new Ae,Rs.setAttribute("position",new me([0,0,0,0,1,0],3)),no=new _i(0,.5,1,5,1),no.translate(0,-.5,0)),this.position.copy(e),this.line=new pn(Rs,new gt({color:n,toneMapped:!1})),this.line.matrixAutoUpdate=!1,this.add(this.line),this.cone=new Qe(no,new hn({color:n,toneMapped:!1})),this.cone.matrixAutoUpdate=!1,this.add(this.cone),this.setDirection(r),this.setLength(t,i,s)}setDirection(r){if(r.y>.99999)this.quaternion.set(0,0,0,1);else if(r.y<-.99999)this.quaternion.set(1,0,0,0);else{$c.set(r.z,0,-r.x).normalize();const e=Math.acos(r.y);this.quaternion.setFromAxisAngle($c,e)}}setLength(r,e=.2*r,t=.2*e){this.line.scale.set(1,Math.max(1e-4,r-e),1),this.line.updateMatrix(),this.cone.scale.set(t,e,t),this.cone.position.y=r,this.cone.updateMatrix()}setColor(r){this.line.material.color.set(r),this.cone.material.color.set(r)}copy(r){return super.copy(r,!1),this.line.copy(r.line),this.cone.copy(r.cone),this}dispose(){this.line.geometry.dispose(),this.line.material.dispose(),this.cone.geometry.dispose(),this.cone.material.dispose()}},y.AttachedBindMode=Ns,y.Audio=zc,y.AudioAnalyser=class{constructor(r,e=2048){this.analyser=r.context.createAnalyser(),this.analyser.fftSize=e,this.data=new Uint8Array(this.analyser.frequencyBinCount),r.getOutput().connect(this.analyser)}getFrequencyData(){return this.analyser.getByteFrequencyData(this.data),this.data}getAverageFrequency(){let r=0;const e=this.getFrequencyData();for(let t=0;t<e.length;t++)r+=e[t];return r/e.length}},y.AudioContext=Ja,y.AudioListener=class extends Be{constructor(){super(),this.type="AudioListener",this.context=Ja.getContext(),this.gain=this.context.createGain(),this.gain.connect(this.context.destination),this.filter=null,this.timeDelta=0,this._clock=new Oc}getInput(){return this.gain}removeFilter(){return this.filter!==null&&(this.gain.disconnect(this.filter),this.filter.disconnect(this.context.destination),this.gain.connect(this.context.destination),this.filter=null),this}getFilter(){return this.filter}setFilter(r){return this.filter!==null?(this.gain.disconnect(this.filter),this.filter.disconnect(this.context.destination)):this.gain.disconnect(this.context.destination),this.filter=r,this.gain.connect(this.filter),this.filter.connect(this.context.destination),this}getMasterVolume(){return this.gain.gain.value}setMasterVolume(r){return this.gain.gain.setTargetAtTime(r,this.context.currentTime,.01),this}updateMatrixWorld(r){super.updateMatrixWorld(r);const e=this.context.listener,t=this.up;if(this.timeDelta=this._clock.getDelta(),this.matrixWorld.decompose(Dn,Bc,Gd),Nn.set(0,0,-1).applyQuaternion(Bc),e.positionX){const n=this.context.currentTime+this.timeDelta;e.positionX.linearRampToValueAtTime(Dn.x,n),e.positionY.linearRampToValueAtTime(Dn.y,n),e.positionZ.linearRampToValueAtTime(Dn.z,n),e.forwardX.linearRampToValueAtTime(Nn.x,n),e.forwardY.linearRampToValueAtTime(Nn.y,n),e.forwardZ.linearRampToValueAtTime(Nn.z,n),e.upX.linearRampToValueAtTime(t.x,n),e.upY.linearRampToValueAtTime(t.y,n),e.upZ.linearRampToValueAtTime(t.z,n)}else e.setPosition(Dn.x,Dn.y,Dn.z),e.setOrientation(Nn.x,Nn.y,Nn.z,t.x,t.y,t.z)}},y.AudioLoader=class extends Mt{constructor(r){super(r)}load(r,e,t,n){const i=this,s=new nn(this.manager);function a(o){n?n(o):console.error(o),i.manager.itemError(r)}s.setResponseType("arraybuffer"),s.setPath(this.path),s.setRequestHeader(this.requestHeader),s.setWithCredentials(this.withCredentials),s.load(r,(function(o){try{const l=o.slice(0);Ja.getContext().decodeAudioData(l,(function(c){e(c)})).catch(a)}catch(l){a(l)}}),t,n)}},y.AxesHelper=class extends kt{constructor(r=1){const e=[0,0,0,r,0,0,0,0,0,0,r,0,0,0,0,0,0,r],t=new Ae;t.setAttribute("position",new me(e,3)),t.setAttribute("color",new me([1,0,0,1,.6,0,0,1,0,.6,1,0,0,0,1,0,.6,1],3)),super(t,new gt({vertexColors:!0,toneMapped:!1})),this.type="AxesHelper"}setColors(r,e,t){const n=new de,i=this.geometry.attributes.color.array;return n.set(r),n.toArray(i,0),n.toArray(i,3),n.set(e),n.toArray(i,6),n.toArray(i,9),n.set(t),n.toArray(i,12),n.toArray(i,15),this.geometry.attributes.color.needsUpdate=!0,this}dispose(){this.geometry.dispose(),this.material.dispose()}},y.BackSide=1,y.BasicDepthPacking=3200,y.BasicShadowMap=0,y.BatchedMesh=Il,y.Bone=Sa,y.BooleanKeyframeTrack=Pn,y.Box2=class{constructor(r=new ie(1/0,1/0),e=new ie(-1/0,-1/0)){this.isBox2=!0,this.min=r,this.max=e}set(r,e){return this.min.copy(r),this.max.copy(e),this}setFromPoints(r){this.makeEmpty();for(let e=0,t=r.length;e<t;e++)this.expandByPoint(r[e]);return this}setFromCenterAndSize(r,e){const t=Wc.copy(e).multiplyScalar(.5);return this.min.copy(r).sub(t),this.max.copy(r).add(t),this}clone(){return new this.constructor().copy(this)}copy(r){return this.min.copy(r.min),this.max.copy(r.max),this}makeEmpty(){return this.min.x=this.min.y=1/0,this.max.x=this.max.y=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y}getCenter(r){return this.isEmpty()?r.set(0,0):r.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(r){return this.isEmpty()?r.set(0,0):r.subVectors(this.max,this.min)}expandByPoint(r){return this.min.min(r),this.max.max(r),this}expandByVector(r){return this.min.sub(r),this.max.add(r),this}expandByScalar(r){return this.min.addScalar(-r),this.max.addScalar(r),this}containsPoint(r){return!(r.x<this.min.x||r.x>this.max.x||r.y<this.min.y||r.y>this.max.y)}containsBox(r){return this.min.x<=r.min.x&&r.max.x<=this.max.x&&this.min.y<=r.min.y&&r.max.y<=this.max.y}getParameter(r,e){return e.set((r.x-this.min.x)/(this.max.x-this.min.x),(r.y-this.min.y)/(this.max.y-this.min.y))}intersectsBox(r){return!(r.max.x<this.min.x||r.min.x>this.max.x||r.max.y<this.min.y||r.min.y>this.max.y)}clampPoint(r,e){return e.copy(r).clamp(this.min,this.max)}distanceToPoint(r){return this.clampPoint(r,Wc).distanceTo(r)}intersect(r){return this.min.max(r.min),this.max.min(r.max),this.isEmpty()&&this.makeEmpty(),this}union(r){return this.min.min(r.min),this.max.max(r.max),this}translate(r){return this.min.add(r),this.max.add(r),this}equals(r){return r.min.equals(this.min)&&r.max.equals(this.max)}},y.Box3=pt,y.Box3Helper=class extends kt{constructor(r,e=16776960){const t=new Uint16Array([0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7]),n=new Ae;n.setIndex(new Ve(t,1)),n.setAttribute("position",new me([1,1,1,-1,1,1,-1,-1,1,1,-1,1,1,1,-1,-1,1,-1,-1,-1,-1,1,-1,-1],3)),super(n,new gt({color:e,toneMapped:!1})),this.box=r,this.type="Box3Helper",this.geometry.computeBoundingSphere()}updateMatrixWorld(r){const e=this.box;e.isEmpty()||(e.getCenter(this.position),e.getSize(this.scale),this.scale.multiplyScalar(.5),super.updateMatrixWorld(r))}dispose(){this.geometry.dispose(),this.material.dispose()}},y.BoxGeometry=Sn,y.BoxHelper=class extends kt{constructor(r,e=16776960){const t=new Uint16Array([0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7]),n=new Float32Array(24),i=new Ae;i.setIndex(new Ve(t,1)),i.setAttribute("position",new Ve(n,3)),super(i,new gt({color:e,toneMapped:!1})),this.object=r,this.type="BoxHelper",this.matrixAutoUpdate=!1,this.update()}update(r){if(r!==void 0&&console.warn("THREE.BoxHelper: .update() has no longer arguments."),this.object!==void 0&&As.setFromObject(this.object),As.isEmpty())return;const e=As.min,t=As.max,n=this.geometry.attributes.position,i=n.array;i[0]=t.x,i[1]=t.y,i[2]=t.z,i[3]=e.x,i[4]=t.y,i[5]=t.z,i[6]=e.x,i[7]=e.y,i[8]=t.z,i[9]=t.x,i[10]=e.y,i[11]=t.z,i[12]=t.x,i[13]=t.y,i[14]=e.z,i[15]=e.x,i[16]=t.y,i[17]=e.z,i[18]=e.x,i[19]=e.y,i[20]=e.z,i[21]=t.x,i[22]=e.y,i[23]=e.z,n.needsUpdate=!0,this.geometry.computeBoundingSphere()}setFromObject(r){return this.object=r,this.update(),this}copy(r,e){return super.copy(r,e),this.object=r.object,this}dispose(){this.geometry.dispose(),this.material.dispose()}},y.BufferAttribute=Ve,y.BufferGeometry=Ae,y.BufferGeometryLoader=Pc,y.ByteType=1010,y.Cache=en,y.Camera=Pr,y.CameraHelper=class extends kt{constructor(r){const e=new Ae,t=new gt({color:16777215,vertexColors:!0,toneMapped:!1}),n=[],i=[],s={};function a(p,m){o(p),o(m)}function o(p){n.push(0,0,0),i.push(0,0,0),s[p]===void 0&&(s[p]=[]),s[p].push(n.length/3-1)}a("n1","n2"),a("n2","n4"),a("n4","n3"),a("n3","n1"),a("f1","f2"),a("f2","f4"),a("f4","f3"),a("f3","f1"),a("n1","f1"),a("n2","f2"),a("n3","f3"),a("n4","f4"),a("p","n1"),a("p","n2"),a("p","n3"),a("p","n4"),a("u1","u2"),a("u2","u3"),a("u3","u1"),a("c","t"),a("p","c"),a("cn1","cn2"),a("cn3","cn4"),a("cf1","cf2"),a("cf3","cf4"),e.setAttribute("position",new me(n,3)),e.setAttribute("color",new me(i,3)),super(e,t),this.type="CameraHelper",this.camera=r,this.camera.updateProjectionMatrix&&this.camera.updateProjectionMatrix(),this.matrix=r.matrixWorld,this.matrixAutoUpdate=!1,this.pointMap=s,this.update();const l=new de(16755200),c=new de(16711680),h=new de(43775),u=new de(16777215),d=new de(3355443);this.setColors(l,c,h,u,d)}setColors(r,e,t,n,i){const s=this.geometry.getAttribute("color");s.setXYZ(0,r.r,r.g,r.b),s.setXYZ(1,r.r,r.g,r.b),s.setXYZ(2,r.r,r.g,r.b),s.setXYZ(3,r.r,r.g,r.b),s.setXYZ(4,r.r,r.g,r.b),s.setXYZ(5,r.r,r.g,r.b),s.setXYZ(6,r.r,r.g,r.b),s.setXYZ(7,r.r,r.g,r.b),s.setXYZ(8,r.r,r.g,r.b),s.setXYZ(9,r.r,r.g,r.b),s.setXYZ(10,r.r,r.g,r.b),s.setXYZ(11,r.r,r.g,r.b),s.setXYZ(12,r.r,r.g,r.b),s.setXYZ(13,r.r,r.g,r.b),s.setXYZ(14,r.r,r.g,r.b),s.setXYZ(15,r.r,r.g,r.b),s.setXYZ(16,r.r,r.g,r.b),s.setXYZ(17,r.r,r.g,r.b),s.setXYZ(18,r.r,r.g,r.b),s.setXYZ(19,r.r,r.g,r.b),s.setXYZ(20,r.r,r.g,r.b),s.setXYZ(21,r.r,r.g,r.b),s.setXYZ(22,r.r,r.g,r.b),s.setXYZ(23,r.r,r.g,r.b),s.setXYZ(24,e.r,e.g,e.b),s.setXYZ(25,e.r,e.g,e.b),s.setXYZ(26,e.r,e.g,e.b),s.setXYZ(27,e.r,e.g,e.b),s.setXYZ(28,e.r,e.g,e.b),s.setXYZ(29,e.r,e.g,e.b),s.setXYZ(30,e.r,e.g,e.b),s.setXYZ(31,e.r,e.g,e.b),s.setXYZ(32,t.r,t.g,t.b),s.setXYZ(33,t.r,t.g,t.b),s.setXYZ(34,t.r,t.g,t.b),s.setXYZ(35,t.r,t.g,t.b),s.setXYZ(36,t.r,t.g,t.b),s.setXYZ(37,t.r,t.g,t.b),s.setXYZ(38,n.r,n.g,n.b),s.setXYZ(39,n.r,n.g,n.b),s.setXYZ(40,i.r,i.g,i.b),s.setXYZ(41,i.r,i.g,i.b),s.setXYZ(42,i.r,i.g,i.b),s.setXYZ(43,i.r,i.g,i.b),s.setXYZ(44,i.r,i.g,i.b),s.setXYZ(45,i.r,i.g,i.b),s.setXYZ(46,i.r,i.g,i.b),s.setXYZ(47,i.r,i.g,i.b),s.setXYZ(48,i.r,i.g,i.b),s.setXYZ(49,i.r,i.g,i.b),s.needsUpdate=!0}update(){const r=this.geometry,e=this.pointMap;Ye.projectionMatrixInverse.copy(this.camera.projectionMatrixInverse),Je("c",e,r,Ye,0,0,-1),Je("t",e,r,Ye,0,0,1),Je("n1",e,r,Ye,-1,-1,-1),Je("n2",e,r,Ye,1,-1,-1),Je("n3",e,r,Ye,-1,1,-1),Je("n4",e,r,Ye,1,1,-1),Je("f1",e,r,Ye,-1,-1,1),Je("f2",e,r,Ye,1,-1,1),Je("f3",e,r,Ye,-1,1,1),Je("f4",e,r,Ye,1,1,1),Je("u1",e,r,Ye,.7,1.1,-1),Je("u2",e,r,Ye,-.7,1.1,-1),Je("u3",e,r,Ye,0,2,-1),Je("cf1",e,r,Ye,-1,0,1),Je("cf2",e,r,Ye,1,0,1),Je("cf3",e,r,Ye,0,-1,1),Je("cf4",e,r,Ye,0,1,1),Je("cn1",e,r,Ye,-1,0,-1),Je("cn2",e,r,Ye,1,0,-1),Je("cn3",e,r,Ye,0,-1,-1),Je("cn4",e,r,Ye,0,1,-1),r.getAttribute("position").needsUpdate=!0}dispose(){this.geometry.dispose(),this.material.dispose()}},y.CanvasTexture=class extends Ze{constructor(r,e,t,n,i,s,a,o,l){super(r,e,t,n,i,s,a,o,l),this.isCanvasTexture=!0,this.needsUpdate=!0}},y.CapsuleGeometry=is,y.CatmullRomCurve3=kl,y.CineonToneMapping=3,y.CircleGeometry=rs,y.ClampToEdgeWrapping=1001,y.Clock=Oc,y.Color=de,y.ColorKeyframeTrack=Wa,y.ColorManagement=Ge,y.CompressedArrayTexture=class extends Qr{constructor(r,e,t,n,i,s){super(r,e,t,i,s),this.isCompressedArrayTexture=!0,this.image.depth=n,this.wrapR=1001}},y.CompressedCubeTexture=class extends Qr{constructor(r,e,t){super(void 0,r[0].width,r[0].height,e,t,301),this.isCompressedCubeTexture=!0,this.isCubeTexture=!0,this.image=r}},y.CompressedTexture=Qr,y.CompressedTextureLoader=class extends Mt{constructor(r){super(r)}load(r,e,t,n){const i=this,s=[],a=new Qr,o=new nn(this.manager);o.setPath(this.path),o.setResponseType("arraybuffer"),o.setRequestHeader(this.requestHeader),o.setWithCredentials(i.withCredentials);let l=0;function c(h){o.load(r[h],(function(u){const d=i.parse(u,!0);s[h]={width:d.width,height:d.height,format:d.format,mipmaps:d.mipmaps},l+=1,l===6&&(d.mipmapCount===1&&(a.minFilter=1006),a.image=s,a.format=d.format,a.needsUpdate=!0,e&&e(a))}),t,n)}if(Array.isArray(r))for(let h=0,u=r.length;h<u;++h)c(h);else o.load(r,(function(h){const u=i.parse(h,!0);if(u.isCubemap){const d=u.mipmaps.length/u.mipmapCount;for(let p=0;p<d;p++){s[p]={mipmaps:[]};for(let m=0;m<u.mipmapCount;m++)s[p].mipmaps.push(u.mipmaps[p*u.mipmapCount+m]),s[p].format=u.format,s[p].width=u.width,s[p].height=u.height}a.image=s}else a.image.width=u.width,a.image.height=u.height,a.mipmaps=u.mipmaps;u.mipmapCount===1&&(a.minFilter=1006),a.format=u.format,a.needsUpdate=!0,e&&e(a)}),t,n);return a}},y.ConeGeometry=ss,y.ConstantAlphaFactor=213,y.ConstantColorFactor=211,y.CubeCamera=Do,y.CubeReflectionMapping=301,y.CubeRefractionMapping=302,y.CubeTexture=Di,y.CubeTextureLoader=class extends Mt{constructor(r){super(r)}load(r,e,t,n){const i=new Di;i.colorSpace=$e;const s=new ir(this.manager);s.setCrossOrigin(this.crossOrigin),s.setPath(this.path);let a=0;function o(l){s.load(r[l],(function(c){i.images[l]=c,a++,a===6&&(i.needsUpdate=!0,e&&e(i))}),void 0,n)}for(let l=0;l<r.length;++l)o(l);return i}},y.CubeUVReflectionMapping=306,y.CubicBezierCurve=Ia,y.CubicBezierCurve3=Xl,y.CubicInterpolant=mc,y.CullFaceBack=1,y.CullFaceFront=2,y.CullFaceFrontBack=3,y.CullFaceNone=0,y.Curve=Ot,y.CurvePath=ql,y.CustomBlending=5,y.CustomToneMapping=5,y.CylinderGeometry=_i,y.Cylindrical=class{constructor(r=1,e=0,t=0){return this.radius=r,this.theta=e,this.y=t,this}set(r,e,t){return this.radius=r,this.theta=e,this.y=t,this}copy(r){return this.radius=r.radius,this.theta=r.theta,this.y=r.y,this}setFromVector3(r){return this.setFromCartesianCoords(r.x,r.y,r.z)}setFromCartesianCoords(r,e,t){return this.radius=Math.sqrt(r*r+t*t),this.theta=Math.atan2(r,t),this.y=e,this}clone(){return new this.constructor().copy(this)}},y.Data3DTexture=ks,y.DataArrayTexture=ur,y.DataTexture=wn,y.DataTextureLoader=class extends Mt{constructor(r){super(r)}load(r,e,t,n){const i=this,s=new wn,a=new nn(this.manager);return a.setResponseType("arraybuffer"),a.setRequestHeader(this.requestHeader),a.setPath(this.path),a.setWithCredentials(i.withCredentials),a.load(r,(function(o){let l;try{l=i.parse(o)}catch(c){if(n===void 0)return void console.error(c);n(c)}l.image!==void 0?s.image=l.image:l.data!==void 0&&(s.image.width=l.width,s.image.height=l.height,s.image.data=l.data),s.wrapS=l.wrapS!==void 0?l.wrapS:1001,s.wrapT=l.wrapT!==void 0?l.wrapT:1001,s.magFilter=l.magFilter!==void 0?l.magFilter:1006,s.minFilter=l.minFilter!==void 0?l.minFilter:1006,s.anisotropy=l.anisotropy!==void 0?l.anisotropy:1,l.colorSpace!==void 0?s.colorSpace=l.colorSpace:l.encoding!==void 0&&(s.encoding=l.encoding),l.flipY!==void 0&&(s.flipY=l.flipY),l.format!==void 0&&(s.format=l.format),l.type!==void 0&&(s.type=l.type),l.mipmaps!==void 0&&(s.mipmaps=l.mipmaps,s.minFilter=1008),l.mipmapCount===1&&(s.minFilter=1006),l.generateMipmaps!==void 0&&(s.generateMipmaps=l.generateMipmaps),s.needsUpdate=!0,e&&e(s,l)}),t,n),s}},y.DataUtils=Ph,y.DecrementStencilOp=7683,y.DecrementWrapStencilOp=34056,y.DefaultLoadingManager=vc,y.DepthFormat=1026,y.DepthStencilFormat=1027,y.DepthTexture=da,y.DetachedBindMode=co,y.DirectionalLight=Ec,y.DirectionalLightHelper=class extends Be{constructor(r,e,t){super(),this.light=r,this.matrix=r.matrixWorld,this.matrixAutoUpdate=!1,this.color=t,this.type="DirectionalLightHelper",e===void 0&&(e=1);let n=new Ae;n.setAttribute("position",new me([-e,e,0,e,e,0,e,-e,0,-e,-e,0,-e,e,0],3));const i=new gt({fog:!1,toneMapped:!1});this.lightPlane=new pn(n,i),this.add(this.lightPlane),n=new Ae,n.setAttribute("position",new me([0,0,0,0,0,1],3)),this.targetLine=new pn(n,i),this.add(this.targetLine),this.update()}dispose(){this.lightPlane.geometry.dispose(),this.lightPlane.material.dispose(),this.targetLine.geometry.dispose(),this.targetLine.material.dispose()}update(){this.light.updateWorldMatrix(!0,!1),this.light.target.updateWorldMatrix(!0,!1),Jc.setFromMatrixPosition(this.light.matrixWorld),Es.setFromMatrixPosition(this.light.target.matrixWorld),Kc.subVectors(Es,Jc),this.lightPlane.lookAt(Es),this.color!==void 0?(this.lightPlane.material.color.set(this.color),this.targetLine.material.color.set(this.color)):(this.lightPlane.material.color.copy(this.light.color),this.targetLine.material.color.copy(this.light.color)),this.targetLine.lookAt(Es),this.targetLine.scale.z=Kc.length()}},y.DiscreteInterpolant=gc,y.DisplayP3ColorSpace=lr,y.DodecahedronGeometry=as,y.DoubleSide=2,y.DstAlphaFactor=206,y.DstColorFactor=208,y.DynamicCopyUsage=35050,y.DynamicDrawUsage=35048,y.DynamicReadUsage=35049,y.EdgesGeometry=Yl,y.EllipseCurve=es,y.EqualCompare=514,y.EqualDepth=4,y.EqualStencilFunc=514,y.EquirectangularReflectionMapping=303,y.EquirectangularRefractionMapping=304,y.Euler=Li,y.EventDispatcher=qt,y.ExtrudeGeometry=ps,y.FileLoader=nn,y.Float16BufferAttribute=class extends Ve{constructor(r,e,t){super(new Uint16Array(r),e,t),this.isFloat16BufferAttribute=!0}getX(r){let e=Ii(this.array[r*this.itemSize]);return this.normalized&&(e=_t(e,this.array)),e}setX(r,e){return this.normalized&&(e=Te(e,this.array)),this.array[r*this.itemSize]=yt(e),this}getY(r){let e=Ii(this.array[r*this.itemSize+1]);return this.normalized&&(e=_t(e,this.array)),e}setY(r,e){return this.normalized&&(e=Te(e,this.array)),this.array[r*this.itemSize+1]=yt(e),this}getZ(r){let e=Ii(this.array[r*this.itemSize+2]);return this.normalized&&(e=_t(e,this.array)),e}setZ(r,e){return this.normalized&&(e=Te(e,this.array)),this.array[r*this.itemSize+2]=yt(e),this}getW(r){let e=Ii(this.array[r*this.itemSize+3]);return this.normalized&&(e=_t(e,this.array)),e}setW(r,e){return this.normalized&&(e=Te(e,this.array)),this.array[r*this.itemSize+3]=yt(e),this}setXY(r,e,t){return r*=this.itemSize,this.normalized&&(e=Te(e,this.array),t=Te(t,this.array)),this.array[r+0]=yt(e),this.array[r+1]=yt(t),this}setXYZ(r,e,t,n){return r*=this.itemSize,this.normalized&&(e=Te(e,this.array),t=Te(t,this.array),n=Te(n,this.array)),this.array[r+0]=yt(e),this.array[r+1]=yt(t),this.array[r+2]=yt(n),this}setXYZW(r,e,t,n,i){return r*=this.itemSize,this.normalized&&(e=Te(e,this.array),t=Te(t,this.array),n=Te(n,this.array),i=Te(i,this.array)),this.array[r+0]=yt(e),this.array[r+1]=yt(t),this.array[r+2]=yt(n),this.array[r+3]=yt(i),this}},y.Float32BufferAttribute=me,y.Float64BufferAttribute=class extends Ve{constructor(r,e,t){super(new Float64Array(r),e,t)}},y.FloatType=1015,y.Fog=zr,y.FogExp2=Br,y.FramebufferTexture=class extends Ze{constructor(r,e){super({width:r,height:e}),this.isFramebufferTexture=!0,this.magFilter=1003,this.minFilter=1003,this.generateMipmaps=!1,this.needsUpdate=!0}},y.FrontSide=0,y.Frustum=Ni,y.GLBufferAttribute=class{constructor(r,e,t,n,i){this.isGLBufferAttribute=!0,this.name="",this.buffer=r,this.type=e,this.itemSize=t,this.elementSize=n,this.count=i,this.version=0}set needsUpdate(r){r===!0&&this.version++}setBuffer(r){return this.buffer=r,this}setType(r,e){return this.type=r,this.elementSize=e,this}setItemSize(r){return this.itemSize=r,this}setCount(r){return this.count=r,this}},y.GLSL1="100",y.GLSL3=Os,y.GreaterCompare=516,y.GreaterDepth=6,y.GreaterEqualCompare=518,y.GreaterEqualDepth=5,y.GreaterEqualStencilFunc=518,y.GreaterStencilFunc=516,y.GridHelper=class extends kt{constructor(r=10,e=10,t=4473924,n=8947848){t=new de(t),n=new de(n);const i=e/2,s=r/e,a=r/2,o=[],l=[];for(let h=0,u=0,d=-a;h<=e;h++,d+=s){o.push(-a,0,d,a,0,d),o.push(d,0,-a,d,0,a);const p=h===i?t:n;p.toArray(l,u),u+=3,p.toArray(l,u),u+=3,p.toArray(l,u),u+=3,p.toArray(l,u),u+=3}const c=new Ae;c.setAttribute("position",new me(o,3)),c.setAttribute("color",new me(l,3)),super(c,new gt({vertexColors:!0,toneMapped:!1})),this.type="GridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}},y.Group=ci,y.HalfFloatType=1016,y.HemisphereLight=xc,y.HemisphereLightHelper=class extends Be{constructor(r,e,t){super(),this.light=r,this.matrix=r.matrixWorld,this.matrixAutoUpdate=!1,this.color=t,this.type="HemisphereLightHelper";const n=new Ki(e);n.rotateY(.5*Math.PI),this.material=new hn({wireframe:!0,fog:!1,toneMapped:!1}),this.color===void 0&&(this.material.vertexColors=!0);const i=n.getAttribute("position"),s=new Float32Array(3*i.count);n.setAttribute("color",new Ve(s,3)),this.add(new Qe(n,this.material)),this.update()}dispose(){this.children[0].geometry.dispose(),this.children[0].material.dispose()}update(){const r=this.children[0];if(this.color!==void 0)this.material.color.set(this.color);else{const e=r.geometry.getAttribute("color");Yc.copy(this.light.color),Zc.copy(this.light.groundColor);for(let t=0,n=e.count;t<n;t++){const i=t<n/2?Yc:Zc;e.setXYZ(t,i.r,i.g,i.b)}e.needsUpdate=!0}this.light.updateWorldMatrix(!0,!1),r.lookAt(Yd.setFromMatrixPosition(this.light.matrixWorld).negate())}},y.IcosahedronGeometry=fs,y.ImageBitmapLoader=class extends Mt{constructor(r){super(r),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&console.warn("THREE.ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&console.warn("THREE.ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"}}setOptions(r){return this.options=r,this}load(r,e,t,n){r===void 0&&(r=""),this.path!==void 0&&(r=this.path+r),r=this.manager.resolveURL(r);const i=this,s=en.get(r);if(s!==void 0)return i.manager.itemStart(r),s.then?void s.then((l=>{e&&e(l),i.manager.itemEnd(r)})).catch((l=>{n&&n(l)})):(setTimeout((function(){e&&e(s),i.manager.itemEnd(r)}),0),s);const a={};a.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",a.headers=this.requestHeader;const o=fetch(r,a).then((function(l){return l.blob()})).then((function(l){return createImageBitmap(l,Object.assign(i.options,{colorSpaceConversion:"none"}))})).then((function(l){return en.add(r,l),e&&e(l),i.manager.itemEnd(r),l})).catch((function(l){n&&n(l),en.remove(r),i.manager.itemError(r),i.manager.itemEnd(r)}));en.add(r,o),i.manager.itemStart(r)}},y.ImageLoader=ir,y.ImageUtils=Hs,y.IncrementStencilOp=7682,y.IncrementWrapStencilOp=34055,y.InstancedBufferAttribute=fi,y.InstancedBufferGeometry=Lc,y.InstancedInterleavedBuffer=class extends Gr{constructor(r,e,t=1){super(r,e),this.isInstancedInterleavedBuffer=!0,this.meshPerAttribute=t}copy(r){return super.copy(r),this.meshPerAttribute=r.meshPerAttribute,this}clone(r){const e=super.clone(r);return e.meshPerAttribute=this.meshPerAttribute,e}toJSON(r){const e=super.toJSON(r);return e.isInstancedInterleavedBuffer=!0,e.meshPerAttribute=this.meshPerAttribute,e}},y.InstancedMesh=Cl,y.Int16BufferAttribute=class extends Ve{constructor(r,e,t){super(new Int16Array(r),e,t)}},y.Int32BufferAttribute=class extends Ve{constructor(r,e,t){super(new Int32Array(r),e,t)}},y.Int8BufferAttribute=class extends Ve{constructor(r,e,t){super(new Int8Array(r),e,t)}},y.IntType=1013,y.InterleavedBuffer=Gr,y.InterleavedBufferAttribute=En,y.Interpolant=Qi,y.InterpolateDiscrete=2300,y.InterpolateLinear=2301,y.InterpolateSmooth=2302,y.InvertStencilOp=5386,y.KeepStencilOp=7680,y.KeyframeTrack=Ft,y.LOD=xl,y.LatheGeometry=qi,y.Layers=vr,y.LessCompare=513,y.LessDepth=2,y.LessEqualCompare=515,y.LessEqualDepth=3,y.LessEqualStencilFunc=515,y.LessStencilFunc=513,y.Light=mn,y.LightProbe=Cc,y.Line=pn,y.Line3=class{constructor(r=new w,e=new w){this.start=r,this.end=e}set(r,e){return this.start.copy(r),this.end.copy(e),this}copy(r){return this.start.copy(r.start),this.end.copy(r.end),this}getCenter(r){return r.addVectors(this.start,this.end).multiplyScalar(.5)}delta(r){return r.subVectors(this.end,this.start)}distanceSq(){return this.start.distanceToSquared(this.end)}distance(){return this.start.distanceTo(this.end)}at(r,e){return this.delta(e).multiplyScalar(r).add(this.start)}closestPointToPointParameter(r,e){Xc.subVectors(r,this.start),bs.subVectors(this.end,this.start);const t=bs.dot(bs);let n=bs.dot(Xc)/t;return e&&(n=qe(n,0,1)),n}closestPointToPoint(r,e,t){const n=this.closestPointToPointParameter(r,e);return this.delta(t).multiplyScalar(n).add(this.start)}applyMatrix4(r){return this.start.applyMatrix4(r),this.end.applyMatrix4(r),this}equals(r){return r.start.equals(this.start)&&r.end.equals(this.end)}clone(){return new this.constructor().copy(this)}},y.LineBasicMaterial=gt,y.LineCurve=Ua,y.LineCurve3=jl,y.LineDashedMaterial=dc,y.LineLoop=Bl,y.LineSegments=kt,y.LinearDisplayP3ColorSpace=Si,y.LinearEncoding=3e3,y.LinearFilter=1006,y.LinearInterpolant=ka,y.LinearMipMapLinearFilter=1008,y.LinearMipMapNearestFilter=1007,y.LinearMipmapLinearFilter=1008,y.LinearMipmapNearestFilter=1007,y.LinearSRGBColorSpace=Ht,y.LinearToneMapping=1,y.LinearTransfer=bi,y.Loader=Mt,y.LoaderUtils=Za,y.LoadingManager=Xa,y.LoopOnce=2200,y.LoopPingPong=2202,y.LoopRepeat=2201,y.LuminanceAlphaFormat=1025,y.LuminanceFormat=1024,y.MOUSE={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},y.Material=ct,y.MaterialLoader=Ms,y.MathUtils=gh,y.Matrix3=we,y.Matrix4=Me,y.MaxEquation=104,y.Mesh=Qe,y.MeshBasicMaterial=hn,y.MeshDepthMaterial=ma,y.MeshDistanceMaterial=ga,y.MeshLambertMaterial=hc,y.MeshMatcapMaterial=uc,y.MeshNormalMaterial=cc,y.MeshPhongMaterial=oc,y.MeshPhysicalMaterial=ac,y.MeshStandardMaterial=Ga,y.MeshToonMaterial=lc,y.MinEquation=103,y.MirroredRepeatWrapping=1002,y.MixOperation=1,y.MultiplyBlending=4,y.MultiplyOperation=0,y.NearestFilter=1003,y.NearestMipMapLinearFilter=1005,y.NearestMipMapNearestFilter=1004,y.NearestMipmapLinearFilter=1005,y.NearestMipmapNearestFilter=1004,y.NeverCompare=512,y.NeverDepth=0,y.NeverStencilFunc=512,y.NoBlending=0,y.NoColorSpace="",y.NoToneMapping=0,y.NormalAnimationBlendMode=2500,y.NormalBlending=1,y.NotEqualCompare=517,y.NotEqualDepth=7,y.NotEqualStencilFunc=517,y.NumberKeyframeTrack=er,y.Object3D=Be,y.ObjectLoader=class extends Mt{constructor(r){super(r)}load(r,e,t,n){const i=this,s=this.path===""?Za.extractUrlBase(r):this.path;this.resourcePath=this.resourcePath||s;const a=new nn(this.manager);a.setPath(this.path),a.setRequestHeader(this.requestHeader),a.setWithCredentials(this.withCredentials),a.load(r,(function(o){let l=null;try{l=JSON.parse(o)}catch(h){return n!==void 0&&n(h),void console.error("THREE:ObjectLoader: Can't parse "+r+".",h.message)}const c=l.metadata;if(c===void 0||c.type===void 0||c.type.toLowerCase()==="geometry")return n!==void 0&&n(new Error("THREE.ObjectLoader: Can't load "+r)),void console.error("THREE.ObjectLoader: Can't load "+r);i.parse(l,e)}),t,n)}async loadAsync(r,e){const t=this.path===""?Za.extractUrlBase(r):this.path;this.resourcePath=this.resourcePath||t;const n=new nn(this.manager);n.setPath(this.path),n.setRequestHeader(this.requestHeader),n.setWithCredentials(this.withCredentials);const i=await n.loadAsync(r,e),s=JSON.parse(i),a=s.metadata;if(a===void 0||a.type===void 0||a.type.toLowerCase()==="geometry")throw new Error("THREE.ObjectLoader: Can't load "+r);return await this.parseAsync(s)}parse(r,e){const t=this.parseAnimations(r.animations),n=this.parseShapes(r.shapes),i=this.parseGeometries(r.geometries,n),s=this.parseImages(r.images,(function(){e!==void 0&&e(l)})),a=this.parseTextures(r.textures,s),o=this.parseMaterials(r.materials,a),l=this.parseObject(r.object,i,o,a,t),c=this.parseSkeletons(r.skeletons,l);if(this.bindSkeletons(l,c),e!==void 0){let h=!1;for(const u in s)if(s[u].data instanceof HTMLImageElement){h=!0;break}h===!1&&e(l)}return l}async parseAsync(r){const e=this.parseAnimations(r.animations),t=this.parseShapes(r.shapes),n=this.parseGeometries(r.geometries,t),i=await this.parseImagesAsync(r.images),s=this.parseTextures(r.textures,i),a=this.parseMaterials(r.materials,s),o=this.parseObject(r.object,n,a,s,e),l=this.parseSkeletons(r.skeletons,o);return this.bindSkeletons(o,l),o}parseShapes(r){const e={};if(r!==void 0)for(let t=0,n=r.length;t<n;t++){const i=new Rn().fromJSON(r[t]);e[i.uuid]=i}return e}parseSkeletons(r,e){const t={},n={};if(e.traverse((function(i){i.isBone&&(n[i.uuid]=i)})),r!==void 0)for(let i=0,s=r.length;i<s;i++){const a=new jr().fromJSON(r[i],n);t[a.uuid]=a}return t}parseGeometries(r,e){const t={};if(r!==void 0){const n=new Pc;for(let i=0,s=r.length;i<s;i++){let a;const o=r[i];switch(o.type){case"BufferGeometry":case"InstancedBufferGeometry":a=n.parse(o);break;default:o.type in ic?a=ic[o.type].fromJSON(o,e):console.warn(`THREE.ObjectLoader: Unsupported geometry type "${o.type}"`)}a.uuid=o.uuid,o.name!==void 0&&(a.name=o.name),o.userData!==void 0&&(a.userData=o.userData),t[o.uuid]=a}}return t}parseMaterials(r,e){const t={},n={};if(r!==void 0){const i=new Ms;i.setTextures(e);for(let s=0,a=r.length;s<a;s++){const o=r[s];t[o.uuid]===void 0&&(t[o.uuid]=i.parse(o)),n[o.uuid]=t[o.uuid]}}return n}parseAnimations(r){const e={};if(r!==void 0)for(let t=0;t<r.length;t++){const n=r[t],i=nr.parse(n);e[i.uuid]=i}return e}parseImages(r,e){const t=this,n={};let i;function s(a){if(typeof a=="string"){const o=a;return(function(l){return t.manager.itemStart(l),i.load(l,(function(){t.manager.itemEnd(l)}),void 0,(function(){t.manager.itemError(l),t.manager.itemEnd(l)}))})(/^(\/\/)|([a-z]+:(\/\/)?)/i.test(o)?o:t.resourcePath+o)}return a.data?{data:kn(a.type,a.data),width:a.width,height:a.height}:null}if(r!==void 0&&r.length>0){const a=new Xa(e);i=new ir(a),i.setCrossOrigin(this.crossOrigin);for(let o=0,l=r.length;o<l;o++){const c=r[o],h=c.url;if(Array.isArray(h)){const u=[];for(let d=0,p=h.length;d<p;d++){const m=s(h[d]);m!==null&&(m instanceof HTMLImageElement?u.push(m):u.push(new wn(m.data,m.width,m.height)))}n[c.uuid]=new vn(u)}else{const u=s(c.url);n[c.uuid]=new vn(u)}}}return n}async parseImagesAsync(r){const e=this,t={};let n;async function i(s){if(typeof s=="string"){const a=s,o=/^(\/\/)|([a-z]+:(\/\/)?)/i.test(a)?a:e.resourcePath+a;return await n.loadAsync(o)}return s.data?{data:kn(s.type,s.data),width:s.width,height:s.height}:null}if(r!==void 0&&r.length>0){n=new ir(this.manager),n.setCrossOrigin(this.crossOrigin);for(let s=0,a=r.length;s<a;s++){const o=r[s],l=o.url;if(Array.isArray(l)){const c=[];for(let h=0,u=l.length;h<u;h++){const d=l[h],p=await i(d);p!==null&&(p instanceof HTMLImageElement?c.push(p):c.push(new wn(p.data,p.width,p.height)))}t[o.uuid]=new vn(c)}else{const c=await i(o.url);t[o.uuid]=new vn(c)}}}return t}parseTextures(r,e){function t(i,s){return typeof i=="number"?i:(console.warn("THREE.ObjectLoader.parseTexture: Constant should be in numeric form.",i),s[i])}const n={};if(r!==void 0)for(let i=0,s=r.length;i<s;i++){const a=r[i];a.image===void 0&&console.warn('THREE.ObjectLoader: No "image" specified for',a.uuid),e[a.image]===void 0&&console.warn("THREE.ObjectLoader: Undefined image",a.image);const o=e[a.image],l=o.data;let c;Array.isArray(l)?(c=new Di,l.length===6&&(c.needsUpdate=!0)):(c=l&&l.data?new wn:new Ze,l&&(c.needsUpdate=!0)),c.source=o,c.uuid=a.uuid,a.name!==void 0&&(c.name=a.name),a.mapping!==void 0&&(c.mapping=t(a.mapping,zd)),a.channel!==void 0&&(c.channel=a.channel),a.offset!==void 0&&c.offset.fromArray(a.offset),a.repeat!==void 0&&c.repeat.fromArray(a.repeat),a.center!==void 0&&c.center.fromArray(a.center),a.rotation!==void 0&&(c.rotation=a.rotation),a.wrap!==void 0&&(c.wrapS=t(a.wrap[0],Ic),c.wrapT=t(a.wrap[1],Ic)),a.format!==void 0&&(c.format=a.format),a.internalFormat!==void 0&&(c.internalFormat=a.internalFormat),a.type!==void 0&&(c.type=a.type),a.colorSpace!==void 0&&(c.colorSpace=a.colorSpace),a.encoding!==void 0&&(c.encoding=a.encoding),a.minFilter!==void 0&&(c.minFilter=t(a.minFilter,Uc)),a.magFilter!==void 0&&(c.magFilter=t(a.magFilter,Uc)),a.anisotropy!==void 0&&(c.anisotropy=a.anisotropy),a.flipY!==void 0&&(c.flipY=a.flipY),a.generateMipmaps!==void 0&&(c.generateMipmaps=a.generateMipmaps),a.premultiplyAlpha!==void 0&&(c.premultiplyAlpha=a.premultiplyAlpha),a.unpackAlignment!==void 0&&(c.unpackAlignment=a.unpackAlignment),a.compareFunction!==void 0&&(c.compareFunction=a.compareFunction),a.userData!==void 0&&(c.userData=a.userData),n[a.uuid]=c}return n}parseObject(r,e,t,n,i){let s,a,o;function l(u){return e[u]===void 0&&console.warn("THREE.ObjectLoader: Undefined geometry",u),e[u]}function c(u){if(u!==void 0){if(Array.isArray(u)){const d=[];for(let p=0,m=u.length;p<m;p++){const g=u[p];t[g]===void 0&&console.warn("THREE.ObjectLoader: Undefined material",g),d.push(t[g])}return d}return t[u]===void 0&&console.warn("THREE.ObjectLoader: Undefined material",u),t[u]}}function h(u){return n[u]===void 0&&console.warn("THREE.ObjectLoader: Undefined texture",u),n[u]}switch(r.type){case"Scene":s=new pl,r.background!==void 0&&(Number.isInteger(r.background)?s.background=new de(r.background):s.background=h(r.background)),r.environment!==void 0&&(s.environment=h(r.environment)),r.fog!==void 0&&(r.fog.type==="Fog"?s.fog=new zr(r.fog.color,r.fog.near,r.fog.far):r.fog.type==="FogExp2"&&(s.fog=new Br(r.fog.color,r.fog.density)),r.fog.name!==""&&(s.fog.name=r.fog.name)),r.backgroundBlurriness!==void 0&&(s.backgroundBlurriness=r.backgroundBlurriness),r.backgroundIntensity!==void 0&&(s.backgroundIntensity=r.backgroundIntensity);break;case"PerspectiveCamera":s=new st(r.fov,r.aspect,r.near,r.far),r.focus!==void 0&&(s.focus=r.focus),r.zoom!==void 0&&(s.zoom=r.zoom),r.filmGauge!==void 0&&(s.filmGauge=r.filmGauge),r.filmOffset!==void 0&&(s.filmOffset=r.filmOffset),r.view!==void 0&&(s.view=Object.assign({},r.view));break;case"OrthographicCamera":s=new Dr(r.left,r.right,r.top,r.bottom,r.near,r.far),r.zoom!==void 0&&(s.zoom=r.zoom),r.view!==void 0&&(s.view=Object.assign({},r.view));break;case"AmbientLight":s=new wc(r.color,r.intensity);break;case"DirectionalLight":s=new Ec(r.color,r.intensity);break;case"PointLight":s=new Tc(r.color,r.intensity,r.distance,r.decay);break;case"RectAreaLight":s=new Ac(r.color,r.intensity,r.width,r.height);break;case"SpotLight":s=new Sc(r.color,r.intensity,r.distance,r.angle,r.penumbra,r.decay);break;case"HemisphereLight":s=new xc(r.color,r.groundColor,r.intensity);break;case"LightProbe":s=new Cc().fromJSON(r);break;case"SkinnedMesh":a=l(r.geometry),o=c(r.material),s=new El(a,o),r.bindMode!==void 0&&(s.bindMode=r.bindMode),r.bindMatrix!==void 0&&s.bindMatrix.fromArray(r.bindMatrix),r.skeleton!==void 0&&(s.skeleton=r.skeleton);break;case"Mesh":a=l(r.geometry),o=c(r.material),s=new Qe(a,o);break;case"InstancedMesh":a=l(r.geometry),o=c(r.material);const u=r.count,d=r.instanceMatrix,p=r.instanceColor;s=new Cl(a,o,u),s.instanceMatrix=new fi(new Float32Array(d.array),16),p!==void 0&&(s.instanceColor=new fi(new Float32Array(p.array),p.itemSize));break;case"BatchedMesh":a=l(r.geometry),o=c(r.material),s=new Il(r.maxGeometryCount,r.maxVertexCount,r.maxIndexCount,o),s.geometry=a,s.perObjectFrustumCulled=r.perObjectFrustumCulled,s.sortObjects=r.sortObjects,s._drawRanges=r.drawRanges,s._reservedRanges=r.reservedRanges,s._visibility=r.visibility,s._active=r.active,s._bounds=r.bounds.map((m=>{const g=new pt;g.min.fromArray(m.boxMin),g.max.fromArray(m.boxMax);const f=new ot;return f.radius=m.sphereRadius,f.center.fromArray(m.sphereCenter),{boxInitialized:m.boxInitialized,box:g,sphereInitialized:m.sphereInitialized,sphere:f}})),s._maxGeometryCount=r.maxGeometryCount,s._maxVertexCount=r.maxVertexCount,s._maxIndexCount=r.maxIndexCount,s._geometryInitialized=r.geometryInitialized,s._geometryCount=r.geometryCount,s._matricesTexture=h(r.matricesTexture.uuid);break;case"LOD":s=new xl;break;case"Line":s=new pn(l(r.geometry),c(r.material));break;case"LineLoop":s=new Bl(l(r.geometry),c(r.material));break;case"LineSegments":s=new kt(l(r.geometry),c(r.material));break;case"PointCloud":case"Points":s=new Gl(l(r.geometry),c(r.material));break;case"Sprite":s=new _l(c(r.material));break;case"Group":s=new ci;break;case"Bone":s=new Sa;break;default:s=new Be}if(s.uuid=r.uuid,r.name!==void 0&&(s.name=r.name),r.matrix!==void 0?(s.matrix.fromArray(r.matrix),r.matrixAutoUpdate!==void 0&&(s.matrixAutoUpdate=r.matrixAutoUpdate),s.matrixAutoUpdate&&s.matrix.decompose(s.position,s.quaternion,s.scale)):(r.position!==void 0&&s.position.fromArray(r.position),r.rotation!==void 0&&s.rotation.fromArray(r.rotation),r.quaternion!==void 0&&s.quaternion.fromArray(r.quaternion),r.scale!==void 0&&s.scale.fromArray(r.scale)),r.up!==void 0&&s.up.fromArray(r.up),r.castShadow!==void 0&&(s.castShadow=r.castShadow),r.receiveShadow!==void 0&&(s.receiveShadow=r.receiveShadow),r.shadow&&(r.shadow.bias!==void 0&&(s.shadow.bias=r.shadow.bias),r.shadow.normalBias!==void 0&&(s.shadow.normalBias=r.shadow.normalBias),r.shadow.radius!==void 0&&(s.shadow.radius=r.shadow.radius),r.shadow.mapSize!==void 0&&s.shadow.mapSize.fromArray(r.shadow.mapSize),r.shadow.camera!==void 0&&(s.shadow.camera=this.parseObject(r.shadow.camera))),r.visible!==void 0&&(s.visible=r.visible),r.frustumCulled!==void 0&&(s.frustumCulled=r.frustumCulled),r.renderOrder!==void 0&&(s.renderOrder=r.renderOrder),r.userData!==void 0&&(s.userData=r.userData),r.layers!==void 0&&(s.layers.mask=r.layers),r.children!==void 0){const u=r.children;for(let d=0;d<u.length;d++)s.add(this.parseObject(u[d],e,t,n,i))}if(r.animations!==void 0){const u=r.animations;for(let d=0;d<u.length;d++){const p=u[d];s.animations.push(i[p])}}if(r.type==="LOD"){r.autoUpdate!==void 0&&(s.autoUpdate=r.autoUpdate);const u=r.levels;for(let d=0;d<u.length;d++){const p=u[d],m=s.getObjectByProperty("uuid",p.object);m!==void 0&&s.addLevel(m,p.distance,p.hysteresis)}}return s}bindSkeletons(r,e){Object.keys(e).length!==0&&r.traverse((function(t){if(t.isSkinnedMesh===!0&&t.skeleton!==void 0){const n=e[t.skeleton];n===void 0?console.warn("THREE.ObjectLoader: No skeleton found with UUID:",t.skeleton):t.bind(n,t.bindMatrix)}}))}},y.ObjectSpaceNormalMap=1,y.OctahedronGeometry=Ki,y.OneFactor=201,y.OneMinusConstantAlphaFactor=214,y.OneMinusConstantColorFactor=212,y.OneMinusDstAlphaFactor=207,y.OneMinusDstColorFactor=209,y.OneMinusSrcAlphaFactor=205,y.OneMinusSrcColorFactor=203,y.OrthographicCamera=Dr,y.P3Primaries="p3",y.PCFShadowMap=1,y.PCFSoftShadowMap=2,y.PMREMGenerator=ha,y.Path=ji,y.PerspectiveCamera=st,y.Plane=un,y.PlaneGeometry=Oi,y.PlaneHelper=class extends pn{constructor(r,e=1,t=16776960){const n=t,i=new Ae;i.setAttribute("position",new me([1,-1,0,-1,1,0,-1,-1,0,1,1,0,-1,1,0,-1,-1,0,1,-1,0,1,1,0],3)),i.computeBoundingSphere(),super(i,new gt({color:n,toneMapped:!1})),this.type="PlaneHelper",this.plane=r,this.size=e;const s=new Ae;s.setAttribute("position",new me([1,1,0,-1,1,0,-1,-1,0,1,1,0,-1,-1,0,1,-1,0],3)),s.computeBoundingSphere(),this.add(new Qe(s,new hn({color:n,opacity:.2,transparent:!0,depthWrite:!1,toneMapped:!1})))}updateMatrixWorld(r){this.position.set(0,0,0),this.scale.set(.5*this.size,.5*this.size,1),this.lookAt(this.plane.normal),this.translateZ(-this.plane.constant),super.updateMatrixWorld(r)}dispose(){this.geometry.dispose(),this.material.dispose(),this.children[0].geometry.dispose(),this.children[0].material.dispose()}},y.PointLight=Tc,y.PointLightHelper=class extends Qe{constructor(r,e,t){super(new $i(e,4,2),new hn({wireframe:!0,fog:!1,toneMapped:!1})),this.light=r,this.color=t,this.type="PointLightHelper",this.matrix=this.light.matrixWorld,this.matrixAutoUpdate=!1,this.update()}dispose(){this.geometry.dispose(),this.material.dispose()}update(){this.light.updateWorldMatrix(!0,!1),this.color!==void 0?this.material.color.set(this.color):this.material.color.copy(this.light.color)}},y.Points=Gl,y.PointsMaterial=wa,y.PolarGridHelper=class extends kt{constructor(r=10,e=16,t=8,n=64,i=4473924,s=8947848){i=new de(i),s=new de(s);const a=[],o=[];if(e>1)for(let c=0;c<e;c++){const h=c/e*(2*Math.PI),u=Math.sin(h)*r,d=Math.cos(h)*r;a.push(0,0,0),a.push(u,0,d);const p=1&c?i:s;o.push(p.r,p.g,p.b),o.push(p.r,p.g,p.b)}for(let c=0;c<t;c++){const h=1&c?i:s,u=r-r/t*c;for(let d=0;d<n;d++){let p=d/n*(2*Math.PI),m=Math.sin(p)*u,g=Math.cos(p)*u;a.push(m,0,g),o.push(h.r,h.g,h.b),p=(d+1)/n*(2*Math.PI),m=Math.sin(p)*u,g=Math.cos(p)*u,a.push(m,0,g),o.push(h.r,h.g,h.b)}}const l=new Ae;l.setAttribute("position",new me(a,3)),l.setAttribute("color",new me(o,3)),super(l,new gt({vertexColors:!0,toneMapped:!1})),this.type="PolarGridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}},y.PolyhedronGeometry=fn,y.PositionalAudio=class extends zc{constructor(r){super(r),this.panner=this.context.createPanner(),this.panner.panningModel="HRTF",this.panner.connect(this.gain)}connect(){super.connect(),this.panner.connect(this.gain)}disconnect(){super.disconnect(),this.panner.disconnect(this.gain)}getOutput(){return this.panner}getRefDistance(){return this.panner.refDistance}setRefDistance(r){return this.panner.refDistance=r,this}getRolloffFactor(){return this.panner.rolloffFactor}setRolloffFactor(r){return this.panner.rolloffFactor=r,this}getDistanceModel(){return this.panner.distanceModel}setDistanceModel(r){return this.panner.distanceModel=r,this}getMaxDistance(){return this.panner.maxDistance}setMaxDistance(r){return this.panner.maxDistance=r,this}setDirectionalCone(r,e,t){return this.panner.coneInnerAngle=r,this.panner.coneOuterAngle=e,this.panner.coneOuterGain=t,this}updateMatrixWorld(r){if(super.updateMatrixWorld(r),this.hasPlaybackControl===!0&&this.isPlaying===!1)return;this.matrixWorld.decompose(On,Gc,Hd),Fn.set(0,0,1).applyQuaternion(Gc);const e=this.panner;if(e.positionX){const t=this.context.currentTime+this.listener.timeDelta;e.positionX.linearRampToValueAtTime(On.x,t),e.positionY.linearRampToValueAtTime(On.y,t),e.positionZ.linearRampToValueAtTime(On.z,t),e.orientationX.linearRampToValueAtTime(Fn.x,t),e.orientationY.linearRampToValueAtTime(Fn.y,t),e.orientationZ.linearRampToValueAtTime(Fn.z,t)}else e.setPosition(On.x,On.y,On.z),e.setOrientation(Fn.x,Fn.y,Fn.z)}},y.PropertyBinding=Fe,y.PropertyMixer=Hc,y.QuadraticBezierCurve=Da,y.QuadraticBezierCurve3=Na,y.Quaternion=vt,y.QuaternionKeyframeTrack=xi,y.QuaternionLinearInterpolant=_c,y.RED_GREEN_RGTC2_Format=36285,y.RED_RGTC1_Format=36283,y.REVISION="160",y.RGBADepthPacking=3201,y.RGBAFormat=1023,y.RGBAIntegerFormat=1033,y.RGBA_ASTC_10x10_Format=37819,y.RGBA_ASTC_10x5_Format=37816,y.RGBA_ASTC_10x6_Format=37817,y.RGBA_ASTC_10x8_Format=37818,y.RGBA_ASTC_12x10_Format=37820,y.RGBA_ASTC_12x12_Format=37821,y.RGBA_ASTC_4x4_Format=37808,y.RGBA_ASTC_5x4_Format=37809,y.RGBA_ASTC_5x5_Format=37810,y.RGBA_ASTC_6x5_Format=37811,y.RGBA_ASTC_6x6_Format=37812,y.RGBA_ASTC_8x5_Format=37813,y.RGBA_ASTC_8x6_Format=37814,y.RGBA_ASTC_8x8_Format=37815,y.RGBA_BPTC_Format=36492,y.RGBA_ETC2_EAC_Format=37496,y.RGBA_PVRTC_2BPPV1_Format=35843,y.RGBA_PVRTC_4BPPV1_Format=35842,y.RGBA_S3TC_DXT1_Format=33777,y.RGBA_S3TC_DXT3_Format=33778,y.RGBA_S3TC_DXT5_Format=33779,y.RGB_BPTC_SIGNED_Format=36494,y.RGB_BPTC_UNSIGNED_Format=36495,y.RGB_ETC1_Format=36196,y.RGB_ETC2_Format=37492,y.RGB_PVRTC_2BPPV1_Format=35841,y.RGB_PVRTC_4BPPV1_Format=35840,y.RGB_S3TC_DXT1_Format=33776,y.RGFormat=1030,y.RGIntegerFormat=1031,y.RawShaderMaterial=sc,y.Ray=Zn,y.Raycaster=class{constructor(r,e,t=0,n=1/0){this.ray=new Zn(r,e),this.near=t,this.far=n,this.camera=null,this.layers=new vr,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(r,e){this.ray.set(r,e)}setFromCamera(r,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(r.x,r.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(r.x,r.y,(e.near+e.far)/(e.near-e.far)).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):console.error("THREE.Raycaster: Unsupported camera type: "+e.type)}intersectObject(r,e=!0,t=[]){return eo(r,this,t,e),t.sort(kc),t}intersectObjects(r,e=!0,t=[]){for(let n=0,i=r.length;n<i;n++)eo(r[n],this,t,e);return t.sort(kc),t}},y.Rec709Primaries=Ti,y.RectAreaLight=Ac,y.RedFormat=1028,y.RedIntegerFormat=1029,y.ReinhardToneMapping=2,y.RenderTarget=_o,y.RepeatWrapping=1e3,y.ReplaceStencilOp=7681,y.ReverseSubtractEquation=102,y.RingGeometry=ms,y.SIGNED_RED_GREEN_RGTC2_Format=36286,y.SIGNED_RED_RGTC1_Format=36284,y.SRGBColorSpace=$e,y.SRGBTransfer=ke,y.Scene=pl,y.ShaderChunk=Ee,y.ShaderLib=Nt,y.ShaderMaterial=Vt,y.ShadowMaterial=rc,y.Shape=Rn,y.ShapeGeometry=gs,y.ShapePath=class{constructor(){this.type="ShapePath",this.color=new de,this.subPaths=[],this.currentPath=null}moveTo(r,e){return this.currentPath=new ji,this.subPaths.push(this.currentPath),this.currentPath.moveTo(r,e),this}lineTo(r,e){return this.currentPath.lineTo(r,e),this}quadraticCurveTo(r,e,t,n){return this.currentPath.quadraticCurveTo(r,e,t,n),this}bezierCurveTo(r,e,t,n,i,s){return this.currentPath.bezierCurveTo(r,e,t,n,i,s),this}splineThru(r){return this.currentPath.splineThru(r),this}toShapes(r){function e(g,f){const x=f.length;let v=!1;for(let _=x-1,M=0;M<x;_=M++){let C=f[_],b=f[M],A=b.x-C.x,N=b.y-C.y;if(Math.abs(N)>Number.EPSILON){if(N<0&&(C=f[M],A=-A,b=f[_],N=-N),g.y<C.y||g.y>b.y)continue;if(g.y===C.y){if(g.x===C.x)return!0}else{const I=N*(g.x-C.x)-A*(g.y-C.y);if(I===0)return!0;if(I<0)continue;v=!v}}else{if(g.y!==C.y)continue;if(b.x<=g.x&&g.x<=C.x||C.x<=g.x&&g.x<=b.x)return!0}}return v}const t=Wt.isClockWise,n=this.subPaths;if(n.length===0)return[];let i,s,a;const o=[];if(n.length===1)return s=n[0],a=new Rn,a.curves=s.curves,o.push(a),o;let l=!t(n[0].getPoints());l=r?!l:l;const c=[],h=[];let u,d,p=[],m=0;h[m]=void 0,p[m]=[];for(let g=0,f=n.length;g<f;g++)s=n[g],u=s.getPoints(),i=t(u),i=r?!i:i,i?(!l&&h[m]&&m++,h[m]={s:new Rn,p:u},h[m].s.curves=s.curves,l&&m++,p[m]=[]):p[m].push({h:s,p:u[0]});if(!h[0])return(function(g){const f=[];for(let x=0,v=g.length;x<v;x++){const _=g[x],M=new Rn;M.curves=_.curves,f.push(M)}return f})(n);if(h.length>1){let g=!1,f=0;for(let x=0,v=h.length;x<v;x++)c[x]=[];for(let x=0,v=h.length;x<v;x++){const _=p[x];for(let M=0;M<_.length;M++){const C=_[M];let b=!0;for(let A=0;A<h.length;A++)e(C.p,h[A].p)&&(x!==A&&f++,b?(b=!1,c[A].push(C)):g=!0);b&&c[x].push(C)}}f>0&&g===!1&&(p=c)}for(let g=0,f=h.length;g<f;g++){a=h[g].s,o.push(a),d=p[g];for(let x=0,v=d.length;x<v;x++)a.holes.push(d[x].h)}return o}},y.ShapeUtils=Wt,y.ShortType=1011,y.Skeleton=jr,y.SkeletonHelper=class extends kt{constructor(r){const e=qc(r),t=new Ae,n=[],i=[],s=new de(0,0,1),a=new de(0,1,0);for(let o=0;o<e.length;o++){const l=e[o];l.parent&&l.parent.isBone&&(n.push(0,0,0),n.push(0,0,0),i.push(s.r,s.g,s.b),i.push(a.r,a.g,a.b))}t.setAttribute("position",new me(n,3)),t.setAttribute("color",new me(i,3)),super(t,new gt({vertexColors:!0,depthTest:!1,depthWrite:!1,toneMapped:!1,transparent:!0})),this.isSkeletonHelper=!0,this.type="SkeletonHelper",this.root=r,this.bones=e,this.matrix=r.matrixWorld,this.matrixAutoUpdate=!1}updateMatrixWorld(r){const e=this.bones,t=this.geometry,n=t.getAttribute("position");to.copy(this.root.matrixWorld).invert();for(let i=0,s=0;i<e.length;i++){const a=e[i];a.parent&&a.parent.isBone&&(Ts.multiplyMatrices(to,a.matrixWorld),gn.setFromMatrixPosition(Ts),n.setXYZ(s,gn.x,gn.y,gn.z),Ts.multiplyMatrices(to,a.parent.matrixWorld),gn.setFromMatrixPosition(Ts),n.setXYZ(s+1,gn.x,gn.y,gn.z),s+=2)}t.getAttribute("position").needsUpdate=!0,super.updateMatrixWorld(r)}dispose(){this.geometry.dispose(),this.material.dispose()}},y.SkinnedMesh=El,y.Source=vn,y.Sphere=ot,y.SphereGeometry=$i,y.Spherical=class{constructor(r=1,e=0,t=0){return this.radius=r,this.phi=e,this.theta=t,this}set(r,e,t){return this.radius=r,this.phi=e,this.theta=t,this}copy(r){return this.radius=r.radius,this.phi=r.phi,this.theta=r.theta,this}makeSafe(){return this.phi=Math.max(1e-6,Math.min(Math.PI-1e-6,this.phi)),this}setFromVector3(r){return this.setFromCartesianCoords(r.x,r.y,r.z)}setFromCartesianCoords(r,e,t){return this.radius=Math.sqrt(r*r+e*e+t*t),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(r,t),this.phi=Math.acos(qe(e/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}},y.SphericalHarmonics3=Rc,y.SplineCurve=Oa,y.SpotLight=Sc,y.SpotLightHelper=class extends Be{constructor(r,e){super(),this.light=r,this.matrix=r.matrixWorld,this.matrixAutoUpdate=!1,this.color=e,this.type="SpotLightHelper";const t=new Ae,n=[0,0,0,0,0,1,0,0,0,1,0,1,0,0,0,-1,0,1,0,0,0,0,1,1,0,0,0,0,-1,1];for(let s=0,a=1,o=32;s<o;s++,a++){const l=s/o*Math.PI*2,c=a/o*Math.PI*2;n.push(Math.cos(l),Math.sin(l),1,Math.cos(c),Math.sin(c),1)}t.setAttribute("position",new me(n,3));const i=new gt({fog:!1,toneMapped:!1});this.cone=new kt(t,i),this.add(this.cone),this.update()}dispose(){this.cone.geometry.dispose(),this.cone.material.dispose()}update(){this.light.updateWorldMatrix(!0,!1),this.light.target.updateWorldMatrix(!0,!1);const r=this.light.distance?this.light.distance:1e3,e=r*Math.tan(this.light.angle);this.cone.scale.set(e,e,r),jc.setFromMatrixPosition(this.light.target.matrixWorld),this.cone.lookAt(jc),this.color!==void 0?this.cone.material.color.set(this.color):this.cone.material.color.copy(this.light.color)}},y.Sprite=_l,y.SpriteMaterial=va,y.SrcAlphaFactor=204,y.SrcAlphaSaturateFactor=210,y.SrcColorFactor=202,y.StaticCopyUsage=35046,y.StaticDrawUsage=35044,y.StaticReadUsage=35045,y.StereoCamera=class{constructor(){this.type="StereoCamera",this.aspect=1,this.eyeSep=.064,this.cameraL=new st,this.cameraL.layers.enable(1),this.cameraL.matrixAutoUpdate=!1,this.cameraR=new st,this.cameraR.layers.enable(2),this.cameraR.matrixAutoUpdate=!1,this._cache={focus:null,fov:null,aspect:null,near:null,far:null,zoom:null,eyeSep:null}}update(r){const e=this._cache;if(e.focus!==r.focus||e.fov!==r.fov||e.aspect!==r.aspect*this.aspect||e.near!==r.near||e.far!==r.far||e.zoom!==r.zoom||e.eyeSep!==this.eyeSep){e.focus=r.focus,e.fov=r.fov,e.aspect=r.aspect*this.aspect,e.near=r.near,e.far=r.far,e.zoom=r.zoom,e.eyeSep=this.eyeSep,Un.copy(r.projectionMatrix);const t=e.eyeSep/2,n=t*e.near/e.focus,i=e.near*Math.tan(_n*e.fov*.5)/e.zoom;let s,a;Nc.elements[12]=-t,Dc.elements[12]=t,s=-i*e.aspect+n,a=i*e.aspect+n,Un.elements[0]=2*e.near/(a-s),Un.elements[8]=(a+s)/(a-s),this.cameraL.projectionMatrix.copy(Un),s=-i*e.aspect-n,a=i*e.aspect-n,Un.elements[0]=2*e.near/(a-s),Un.elements[8]=(a+s)/(a-s),this.cameraR.projectionMatrix.copy(Un)}this.cameraL.matrixWorld.copy(r.matrixWorld).multiply(Nc),this.cameraR.matrixWorld.copy(r.matrixWorld).multiply(Dc)}},y.StreamCopyUsage=35042,y.StreamDrawUsage=35040,y.StreamReadUsage=35041,y.StringKeyframeTrack=In,y.SubtractEquation=101,y.SubtractiveBlending=3,y.TOUCH={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},y.TangentSpaceNormalMap=0,y.TetrahedronGeometry=_s,y.Texture=Ze,y.TextureLoader=class extends Mt{constructor(r){super(r)}load(r,e,t,n){const i=new Ze,s=new ir(this.manager);return s.setCrossOrigin(this.crossOrigin),s.setPath(this.path),s.load(r,(function(a){i.image=a,i.needsUpdate=!0,e!==void 0&&e(i)}),t,n),i}},y.TorusGeometry=vs,y.TorusKnotGeometry=xs,y.Triangle=xt,y.TriangleFanDrawMode=2,y.TriangleStripDrawMode=1,y.TrianglesDrawMode=0,y.TubeGeometry=ys,y.TwoPassDoubleSide=2,y.UVMapping=300,y.Uint16BufferAttribute=ta,y.Uint32BufferAttribute=na,y.Uint8BufferAttribute=class extends Ve{constructor(r,e,t){super(new Uint8Array(r),e,t)}},y.Uint8ClampedBufferAttribute=class extends Ve{constructor(r,e,t){super(new Uint8ClampedArray(r),e,t)}},y.Uniform=Qa,y.UniformsGroup=class extends qt{constructor(){super(),this.isUniformsGroup=!0,Object.defineProperty(this,"id",{value:qd++}),this.name="",this.usage=35044,this.uniforms=[]}add(r){return this.uniforms.push(r),this}remove(r){const e=this.uniforms.indexOf(r);return e!==-1&&this.uniforms.splice(e,1),this}setName(r){return this.name=r,this}setUsage(r){return this.usage=r,this}dispose(){return this.dispatchEvent({type:"dispose"}),this}copy(r){this.name=r.name,this.usage=r.usage;const e=r.uniforms;this.uniforms.length=0;for(let t=0,n=e.length;t<n;t++){const i=Array.isArray(e[t])?e[t]:[e[t]];for(let s=0;s<i.length;s++)this.uniforms.push(i[s].clone())}return this}clone(){return new this.constructor().copy(this)}},y.UniformsLib=le,y.UniformsUtils=Uo,y.UnsignedByteType=1009,y.UnsignedInt248Type=1020,y.UnsignedIntType=1014,y.UnsignedShort4444Type=1017,y.UnsignedShort5551Type=1018,y.UnsignedShortType=1012,y.VSMShadowMap=3,y.Vector2=ie,y.Vector3=w,y.Vector4=He,y.VectorKeyframeTrack=tr,y.VideoTexture=class extends Ze{constructor(r,e,t,n,i,s,a,o,l){super(r,e,t,n,i,s,a,o,l),this.isVideoTexture=!0,this.minFilter=s!==void 0?s:1006,this.magFilter=i!==void 0?i:1006,this.generateMipmaps=!1;const c=this;"requestVideoFrameCallback"in r&&r.requestVideoFrameCallback((function h(){c.needsUpdate=!0,r.requestVideoFrameCallback(h)}))}clone(){return new this.constructor(this.image).copy(this)}update(){const r=this.image;!("requestVideoFrameCallback"in r)&&r.readyState>=r.HAVE_CURRENT_DATA&&(this.needsUpdate=!0)}},y.WebGL1Renderer=dl,y.WebGL3DRenderTarget=class extends Pt{constructor(r=1,e=1,t=1,n={}){super(r,e,n),this.isWebGL3DRenderTarget=!0,this.depth=t,this.texture=new ks(null,r,e,t),this.texture.isRenderTargetTexture=!0}},y.WebGLArrayRenderTarget=class extends Pt{constructor(r=1,e=1,t=1,n={}){super(r,e,n),this.isWebGLArrayRenderTarget=!0,this.depth=t,this.texture=new ur(null,r,e,t),this.texture.isRenderTargetTexture=!0}},y.WebGLCoordinateSystem=2e3,y.WebGLCubeRenderTarget=No,y.WebGLMultipleRenderTargets=class extends Pt{constructor(r=1,e=1,t=1,n={}){super(r,e,n),this.isWebGLMultipleRenderTargets=!0;const i=this.texture;this.texture=[];for(let s=0;s<t;s++)this.texture[s]=i.clone(),this.texture[s].isRenderTargetTexture=!0}setSize(r,e,t=1){if(this.width!==r||this.height!==e||this.depth!==t){this.width=r,this.height=e,this.depth=t;for(let n=0,i=this.texture.length;n<i;n++)this.texture[n].image.width=r,this.texture[n].image.height=e,this.texture[n].image.depth=t;this.dispose()}this.viewport.set(0,0,r,e),this.scissor.set(0,0,r,e)}copy(r){this.dispose(),this.width=r.width,this.height=r.height,this.depth=r.depth,this.scissor.copy(r.scissor),this.scissorTest=r.scissorTest,this.viewport.copy(r.viewport),this.depthBuffer=r.depthBuffer,this.stencilBuffer=r.stencilBuffer,r.depthTexture!==null&&(this.depthTexture=r.depthTexture.clone()),this.texture.length=0;for(let e=0,t=r.texture.length;e<t;e++)this.texture[e]=r.texture[e].clone(),this.texture[e].isRenderTargetTexture=!0;return this}},y.WebGLRenderTarget=Pt,y.WebGLRenderer=ul,y.WebGLUtils=cl,y.WebGPUCoordinateSystem=2001,y.WireframeGeometry=tc,y.WrapAroundEnding=2402,y.ZeroCurvatureEnding=2400,y.ZeroFactor=200,y.ZeroSlopeEnding=2401,y.ZeroStencilOp=0,y._SRGBAFormat=1035,y.createCanvasElement=po,y.sRGBEncoding=3001}))});export default sp();

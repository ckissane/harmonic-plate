import getusermedia from 'getusermedia';
import reglCreate from 'regl';
import { GPU } from 'gpu.js';
import * as dat from 'dat.gui';
class HarmonicPlate {
  constructor() {
    this.message = 'dat.gui';
    this.detail = 125;
    // this.play=()=>(document.getElementById('sound') as HTMLAudioElement).play();
  }
}
var harmonicPlate = new HarmonicPlate();

// console.log(GPU);
window.vScale = 1.0;
window.gen = false;
window.vol = [];
window.vout = [];
window.voutT = [];
var vDelay = 100;
var lastVoutSample = 0.0;
const regl = reglCreate({ extensions: ['webgl_draw_buffers', 'oes_texture_float', 'oes_texture_float_linear'] });
const gpu = new GPU();
const gui = new dat.GUI();
var detailController = gui.add(harmonicPlate, 'detail', 10, 1080, 5);
detailController.onFinishChange(function (value) {
  window.resizeG(value);
});
// const regl = require('regl')({extensions:["OES_texture_float"]})
const mouse = {x:0,y:0};
var subsamp = 1024;//2048 * 4;
var fund = 261.625565;//speedOfSound/roomSizeM;//261.625565;
var mc = fund;
window.mul = 1;//17 ** 0.5;
var mpp = 1.0;//125/2048;///500;//1.0;//0.5;
var lastVolSample = 0.0;
function simF(mp) {
  return mc * harmonicPlate.detail / mp;
}
window.count = 0;
window.fastMode = false;
window.simF = simF;
var VS = 100;
var samN = 0;
var stepsT = 0;
var startT = 0;
var stepsQ = 0;
var lastSTm = new Date().getTime();
var lastFm = new Date().getTime();
const BUFFER_SIZE = subsamp;

var PitchAnalyser = function (context, source) {
  this.isReady = false;
  this.frequency = 1;
  this.amplitude = 0;
  this.waveOffset = 0;
  this.context = context;

  // Prevent ScriptProcessorNode from being collected by GC
  window._processor = this.processor = this.context.createScriptProcessor(BUFFER_SIZE + 0, 1, 1);
  this.processor.onaudioprocess = function (e) {
    var q = e.inputBuffer.getChannelData(0);
    var q2 = [];
    for (var sample = 0; sample < q.length; sample++) {
      q2[sample] = q[Math.floor(sample) % q.length];
    }

    var nnv = window.vol.concat(q2);
    var pl = nnv.length;
    var SL = Math.max(0, nnv.length - BUFFER_SIZE * 16);
    nnv = nnv.slice(SL, Math.min(SL + BUFFER_SIZE * 16, nnv.length));
    //console.log(pl,nnv.length);
    window.vol = nnv;

    //   if (stepsT * context.sampleRate < window.vol.length && window.fastMode) {
    //   window.vol = window.vol.concat(nv);//vol.concat(vu);
    // } else {
    //   if (window.fastMode) {
    //     stepsT = stepsT - window.vol.length / context.sampleRate;
    //     window.vol = nv;
    //   } else {
    startT += (SL / context.sampleRate || 0);
    // stepsT = (stepsT - SL / context.sampleRate);
    // window.vol = nv;//vol.concat(vu);//ave*1024;//(ave>0?vu.reduce((a,b)=>Math.max(a,b),0):vu.reduce((a,b)=>Math.min(a,b),0))/2+ave/2;///vu.length*128.0;
    //   }
    // }
    // var outputBuffer = e.outputBuffer;
    // var partPerFrame = context.sampleRate / simF(mpp);
    // var fPart = 1000 / context.sampleRate;
    // lastVoutSample = lastVoutSample % BUFFER_SIZE;
    // var nn = window.vout.length > 0 ? window.vout[0] : 0;
    // var tmO = new Date().getTime() - vDelay-fPart*outputBuffer.length;
    // // Loop through the output channels (in this case there is only one)
    // for (var channel = 0; channel < outputBuffer.numberOfChannels; channel++) {

    //   var outputData = outputBuffer.getChannelData(channel);

    //   // Loop through the 4096 samples
    //   for (var sample = 0; sample < outputBuffer.length; sample++) {
    //     // make output equal to the same as the input
    //     if (window.vout.length>0 && (tmO>window.voutT[0])) {


    //       while (window.vout.length>0 && (tmO>window.voutT[0])) {
    //         nn = window.vout.shift();
    //         window.voutT.shift();
    //       }
    //     } else {
    //       nn = nn;
    //     }
    //     outputData[sample] = 0;//nn;
    //     tmO += fPart;     
    //   }
    // }
    if (this.isReady) {




      var vu = q;

      window.vScale = 1.0;
    }
  }.bind(this);

  // Generate sine wave with custom frequency
  this.source = source;
  //this.source.start(0)

  this.source.connect(this.processor).connect(this.context.destination);
  this.isReady = true;
  //this.source.start(0);
};


getusermedia({ audio: true }, function (err, stream) {
  // var stream = (document.getElementById('sound') as HTMLAudioElement).captureStream();
  // (document.getElementById('sound') as HTMLAudioElement).play();
  window.vol = [0];
  for (var i = 0; i < BUFFER_SIZE; i++) {
    window.vol.push(0);
  }
  if (err) {
    return
  }

  // Next we create an analyser node to intercept data from the mic
  const context = new AudioContext()

  // And then we connect them together
  var source = context.createMediaStreamSource(stream);
  var analyser = new PitchAnalyser(context, source);
  console.log(source);
  mpp = (mc * harmonicPlate.detail) / context.sampleRate;
  // window.mr=0;
  function getVolS() {
    //var ln=lastVolSample* context.sampleRate;
    let idxs = stepsT - startT;
    var rn = idxs * context.sampleRate;
    var ler = rn % 1;
    // window.mr=ler;
    // if(window.vol.length<rn){
    //   console.log("OOPS",window.vol.length,rn)
    // }
    var r = 1 * ((window.vol[Math.floor(rn) % window.vol.length] || 0) * (1 - ler) + (window.vol[Math.floor((rn + 1)) % window.vol.length] || 0) * ler);
    // stepsT = stepsT % 1;//(1 / (fund * window.mul));
    // return Math.sin(stepsT * fund * Math.PI * 2);//*harmonicPlate.detail;
    // window.mr=Math.min(r,window.mr);
    return r;//*harmonicPlate.detail;
  }
  // source.start();


  const pixels = regl.texture({ wrapS: "clamp", wrapT: "clamp", mag: 'linear', min: 'linear' });
  const fboA = doubleFbo("linear");
  window.fboA = fboA;


  function doubleFbo(filter) {
    let fbos = [createFbo(filter), createFbo(filter)];
    return {
      read() {
        return fbos[0].buf;
      },
      write() {
        return fbos[1].buf;
      },
      swap() {
        fbos.reverse();
      },
      resize(width, height) {
        fbos.forEach(x => { x.tex.resize(width, height); x.buf.resize(width, height); });
      }
    };
  }

  function createFbo(filter) {
    let tex = regl.texture({ type: 'float', width: harmonicPlate.detail, height: harmonicPlate.detail, mag: filter, min: filter });
    // window.addEventListener("resize", () => {
    // 	tex.resize(
    // 		window.innerWidth >> config.TEXTURE_DOWNSAMPLE,
    // 		window.innerHeight >> config.TEXTURE_DOWNSAMPLE
    // 	);
    // });
    return {
      tex: tex, buf: regl.framebuffer({
        color: tex,
        depthStencil: false
      })
    };
  }
  var fr = `
 precision mediump float;
 uniform sampler2D texture;
 uniform vec2 mouse;
 uniform vec2 res;
 uniform float t;
 uniform float vol;
 varying vec2 uv;
 uniform float mp;
 
 void main () {
   vec2 uvc=(uv-vec2(0.5,0.5))*2.0;
   if(max(abs(uvc.x),abs(uvc.y))>1.0){
     gl_FragColor = vec4(vec3(0.0),1.0);
       
     return;
   }
   float fadeIn=20.0;
   float easeIn=1.0;
   if(t<fadeIn){
     easeIn=t/fadeIn;
   }
     float mpt=mp;///2.0;
     
     vec2 cVa=texture2D(texture,uv).xy;
     //vec2 cVa0=texture2D(texture,uv).xy;
     float sX=cVa.x+0.0;
     float gn=texture2D(texture,uv).z;
     cVa.y=cVa.y*2.0-1.0;
     //cVa0.y=cVa0.y*2.0-1.0;
     
     float q=0.0;
     float qC=0.0;
    
       float s=1.0;
       if(mpt>1.0){
         s=mpt+0.0;
         mpt=1.0;
       }
       float c=1.0/(s);
     vec2 up=uv+vec2(0.0,-1.0)/res.xy*s;
     vec2 left=uv+vec2(-1.0,0.0)/res.xy*s;
     vec2 right=uv+vec2(1.0,0.0)/res.xy*s;
     vec2 down=uv+vec2(0.0,1.0)/res.xy*s;
     
     vec2 uVa=texture2D(texture,up).xy;
     uVa.y=uVa.y*2.0-1.0;
     vec2 lVa=texture2D(texture,left).xy;
     lVa.y=lVa.y*2.0-1.0;
     vec2 rVa=texture2D(texture,right).xy;
     rVa.y=rVa.y*2.0-1.0;
     vec2 dVa=texture2D(texture,down).xy;
     dVa.y=dVa.y*2.0-1.0;
     float oS=0.0;
     q+=(dVa.x+dVa.y*oS-cVa.y*oS)*c;
     q+=(uVa.x+uVa.y*oS-cVa.y*oS)*c;
     q+=(lVa.x+lVa.y*oS-cVa.y*oS)*c;
     q+=(rVa.x+rVa.y*oS-cVa.y*oS)*c;
     qC+=c*4.0;
     float pos=cVa.x-0.5;
     
     float accel=(q/qC-cVa.x)*mpt;
     float vel=(cVa.y+0.0);//+accel/2.0;
     cVa.y+=accel;
     
     
     
     float gnt=0.0;
    
     if(t<fadeIn){
         
         cVa=(vec2(0.5,0.0)*(1.0-easeIn)+cVa*(easeIn));
         pos=0.0*(1.0-easeIn)+pos*(easeIn);
         //gn=0.0;
     }
     gnt=gn;//1.0;//abs(abs(rVa.x-0.5)+abs(lVa.x-0.5)+abs(uVa.x-0.5)+abs(dVa.x-0.5)-abs((rVa.x-0.5)+(lVa.x-0.5)+(uVa.x-0.5)+(dVa.x-0.5))*2.0)+abs(cVa.x-0.5);
     float apRat=pow(abs(-accel/mpt/mpt/pos),0.5);
     gnt=pow(pow(pos,2.0)+pow(vel/mpt/mpt,2.0)/abs(-accel/mpt/mpt/pos),0.5);
    float H=gnt;
     
     //cVa.y=(vec2(0.5,0.0)*0.001+cVa*0.999).y;
     float j=1.0-length((((uv-vec2(0.5))*res.xy)))*1.3;//pow(2.0,-pow(length(abs(uv-vec2(0.5))*res.xy)/10.0,2.0));
     cVa.x+=cVa.y*mpt;
     
     if( j>0.0 ){
    j=1.0;
     float dp=vol/2.0+0.5;
    
       cVa=(cVa*(1.0-j)+vec2(dp,0.0)*j);//cos(t*0.1*2.0*atan(0.0,-1.0))/4.0+0.5;
        }
     
   
    
    
         gnt=H;
         if(abs(gnt)<=1.0){//} && abs(pos)>gnt/2.0){//&& dot(pos,vel)>=0.0 && dot(vel+accel,vel)<=0.0 ){//} && abs(vel+pos-accel/2.0)>=abs(pos))){
     
       float le=max(gn/1000.0,0.00001);//max(min((1.0-pow(0.5,1.0*apRat/100.0)),0.01),0.00001);//min(abs(vel*2.0+pos-0.5)/abs(pos-0.5)*0.001+0.00001,1.0);
       gnt=gnt;
       //gn=gnt*le+gn*(1.0-le);//+min(max(gnt-gn,-le),le);
       gn=gn+min(max(gnt-gn,-le),le);
     }
     
   
    
     
     if(true||mod(float(t),1024.0*128.0)<1.0||abs(vel)>=abs(pos+abs(vel)*sign(pos))){
      
       float d=0.001;//abs(pos+abs(vel)*s
     cVa=(vec2(0.5,0.0)*d+cVa*(1.0-d));
 
     }
    
     vec2 outp=vec2(cVa.x,cVa.y*0.5+0.5);
 
     gn=max(min(1.0,gn),0.0);
     outp.x=max(min(1.0,outp.x),0.0);
     outp.y=max(min(1.0,outp.y),0.0);
     gl_FragColor = vec4(vec3(outp,gn),1.0);
 }`;
  var vr = `
 
   precision mediump float;
   attribute vec2 position;
   varying vec2 uv;
   void main () {
     uv = position/2.0+vec2(0.5,0.5);
     gl_Position = vec4(position, 0, 1);
   }
   `;
  const drawFeedback = regl({
    frag: fr,

    vert: vr,

    attributes: {
      position: [

        -1, -1,
        3, -1,
        -1, 3,



      ]
    },
    framebuffer: () => fboA.write(),
    uniforms: {
      texture: () => fboA.read(),
      mouse: ({ pixelRatio, viewportHeight, viewportWidth }) => [
        mouse.x * pixelRatio,
        viewportHeight - mouse.y * pixelRatio
      ],
      res: ({ viewportHeight, viewportWidth }) => {
        return [
          harmonicPlate.detail, harmonicPlate.detail
        ]
      },
      t: ({ tick }) => tick,
      vol: () => {
        return getVolS();

      },
      mp: () => mpp
    },
    blend: {
      enable: false,
      func: {
        srcRGB: 'src color',
        srcAlpha: 1,
        dstRGB: 'src color',
        dstAlpha: 1
      },
      equation: {
        rgb: 'add',
        alpha: 'add'
      },
      color: [0, 0, 0, 0]
    },

    count: 3
  });

  const drawNi = regl({
    frag: `
     precision mediump float;
     uniform sampler2D texture;
     uniform sampler2D p;
     uniform sampler2D textureB;
     uniform sampler2D textureC;
     uniform vec2 mouse;
     uniform vec2 res;
     uniform vec2 resp;
     uniform float t;
     varying vec2 uv;
     // IQ's simplex noise:
 
 // The MIT License
 // Copyright © 2013 Inigo Quilez
 // Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 
 vec2 hash( vec2 p ) // replace this by something better
 {
   p = vec2( dot(p,vec2(127.1,311.7)),
         dot(p,vec2(269.5,183.3)) );
 
   return -1.0 + 2.0*fract(sin(p)*43758.5453123);
 }
 
 float noise( in vec2 p )
 {
     const float K1 = 0.366025404; // (sqrt(3)-1)/2;
     const float K2 = 0.211324865; // (3-sqrt(3))/6;
 
   vec2 i = floor( p + (p.x+p.y)*K1 );
   
     vec2 a = p - i + (i.x+i.y)*K2;
     vec2 o = step(a.yx,a.xy);    
     vec2 b = a - o + K2;
   vec2 c = a - 1.0 + 2.0*K2;
 
     vec3 h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
 
   vec3 n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));
 
     return dot( n, vec3(70.0) );
   
 }
 
 
 // GGX from Noby's Goo shader https://www.shadertoy.com/view/lllBDM
 
 // MIT License: https://opensource.org/licenses/MIT
 float G1V(float dnv, float k){
     return 1.0/(dnv*(1.0-k)+k);
 }
 
 float ggx(vec3 n, vec3 v, vec3 l, float rough, float f0){
     float alpha = rough*rough;
     vec3 h = normalize(v+l);
     float dnl = clamp(dot(n,l), 0.0, 1.0);
     float dnv = clamp(dot(n,v), 0.0, 1.0);
     float dnh = clamp(dot(n,h), 0.0, 1.0);
     float dlh = clamp(dot(l,h), 0.0, 1.0);
     float f, d, vis;
     float asqr = alpha*alpha;
     const float pi = 3.14159;
     float den = dnh*dnh*(asqr-1.0)+1.0;
     d = asqr/(pi * den * den);
     dlh = pow(1.0-dlh, 5.0);
     f = f0 + (1.0-f0)*dlh;
     float k = alpha/1.0;
     vis = G1V(dnl, k)*G1V(dnv, k);
     float spec = dnl * d * f * vis;
     return spec;
 }
     #define BUMP 10.0
 
 vec3 normz(vec3 x) {
   return x == vec3(0) ? vec3(0) : normalize(x);
 }
 vec3 hsv2rgb(vec3 c)
         {
             vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
             vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
             return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
         }
 
 void main( ){
   float time=t/1000.0;
   vec2 rc=vec2(min(res.x,res.y));
         vec2 uv2=(uv-vec2(0.5,0.5)-vec2(0.5,0.5)/res.xy*0.0)*res.xy/rc.xy+vec2(0.5,0.5);
         vec2 uvc=(uv2-vec2(0.5,0.5))*2.0;
         if(max(abs(uvc.x),abs(uvc.y))>1.0){
           gl_FragColor = vec4(vec3(0.0),1.0);
             
           return;
         }
         float gn=texture2D(texture,uv2).x;
      
         //gl_FragColor = vec4(vec3( gn),1.0);
      //return;
     vec2 texel = 1. / vec2(128.0).xy;//resp.xy;
 
     vec2 n  = vec2(0.0, texel.y);
     vec2 e  = vec2(texel.x, 0.0);
     vec2 s  = vec2(0.0, -texel.y);
     vec2 w  = vec2(-texel.x, 0.0);
     float hsc=-1.0/0.02;
     float d   = (texture2D(texture, uv2).z-0.5)*hsc;
     //#define SIMPLE
     #ifdef SIMPLE
     gl_FragColor = vec4(vec3(d),1.0);
     #else
     float d_n  = (texture2D(texture, fract(uv2+n)  ).z-0.5)*hsc;
     float d_e  = (texture2D(texture, fract(uv2+e)  ).z-0.5)*hsc;
     float d_s  = (texture2D(texture, fract(uv2+s)  ).z-0.5)*hsc;
     float d_w  = (texture2D(texture, fract(uv2+w)  ).z-0.5)*hsc; 
     float d_ne = (texture2D(texture, fract(uv2+n+e)).z-0.5)*hsc;
     float d_se = (texture2D(texture, fract(uv2+s+e)).z-0.5)*hsc;
     float d_sw = (texture2D(texture, fract(uv2+s+w)).z-0.5)*hsc;
     float d_nw = (texture2D(texture, fract(uv2+n+w)).z-0.5)*hsc; 
 
     float dxn[3];
     float dyn[3];
     float dcn[3];
     
     dcn[0] = 0.5;
     dcn[1] = 1.0; 
     dcn[2] = 0.5;
 
     dyn[0] = d_nw - d_sw;
     dyn[1] = d_n  - d_s; 
     dyn[2] = d_ne - d_se;
 
     dxn[0] = d_ne - d_nw; 
     dxn[1] = d_e  - d_w; 
     dxn[2] = d_se - d_sw; 
 
     // The section below is an antialiased version of 
     // Shane's Bumped Sinusoidal Warp shadertoy here:
     // https://www.shadertoy.com/view/4l2XWK
   #define SRC_DIST 8.0
     vec3 sp = vec3(uv2-0.5, 0);
     vec3 light = vec3(cos(time/2.0)*0.5, sin(time/2.0)*0.5, -SRC_DIST);
     vec3 ld = light - sp;
     float lDist = max(length(ld), 0.001);
     ld /= lDist;
     float aDist = max(distance(vec3(light.xy,0),sp) , 0.001);
     float atten = min(0.07/(0.25 + aDist*0.5 + aDist*aDist*0.05), 1.);
     vec3 rd = normalize(vec3(uv2 - 0.5, 1.));
 
     float spec = 0.0;
   float den = 0.0;
     
     // apply some antialiasing to the normals
     vec3 avd = vec3(0);
     for(int i = 0; i < 3; i++) {
         for(int j = 0; j < 3; j++) {
             vec2 dxy = vec2(dxn[i], dyn[j]);
             float w = dcn[i] * dcn[j];
             vec3 bn = reflect(normalize(vec3(BUMP*dxy, -1.0)), vec3(0,1,0));
             avd += w * bn;
             den += w;
         }
     }
 
     avd /= den;
     spec += ggx(avd, vec3(0,1,0), ld, 0.7, 0.3);
     
     // end bumpmapping section
     
     // cheap occlusion with mipmaps
     float occ = 0.0;
     for (float m = 1.0; m <= 10.0; m +=1.0) {
         float dm = (texture2D(texture, uv2, m).z-0.5)*hsc;
       occ += smoothstep(-8.0, 2.0, (d - dm))/(m*m);
     }
     vec2 dir=vec2(0.0,0.0);
     dir+=(n)*d_n;
     dir+=(e)*d_e;
     dir+=(s)*d_s;
     dir+=(w)*d_w;
     
     occ = pow(occ / 1.5, 2.0);
     //float q=atan(dir.y,dir.x)/atan(1.0,0.0)/4.;
     vec4 wow =   occ* vec4(0.05,0.05,0.05,0) + 2.5*vec4(0.9, 0.85, 0.8, 1)*spec;
     wow.w=1.0;
     gl_FragColor=wow;
     #endif
 
 
     }`,

    vert: `
     precision mediump float;
     attribute vec2 position;
     varying vec2 uv;
     void main () {
       uv = position/2.0+vec2(0.5,0.5);
       gl_Position = vec4(position, 0, 1);
     }`,

    attributes: {
      position: [

        -1, -1,
        3, -1,
        -1, 3,



      ]
    },
    uniforms: {
      texture: fboA.read(),
      p: pixels,
      // textureB: fboB,
      // textureC: fboC,
      mouse: ({ pixelRatio, viewportHeight, viewportWidth }) => [
        mouse.x * pixelRatio,
        viewportHeight - mouse.y * pixelRatio
      ],
      res: ({ viewportHeight, viewportWidth }) => [
        viewportWidth,
        viewportHeight
      ],
      resp: ({ viewportHeight, viewportWidth }) => {
        return [
          harmonicPlate.detail, harmonicPlate.detail
        ]
      },
      t: ({ tick }) => tick,
    },

    count: 3
  })
  function resizeG(width, height) {
    harmonicPlate.detail = width;
    fboA.resize(harmonicPlate.detail, harmonicPlate.detail);
  }
  window.resizeG = resizeG;
  var flips = 0;
  let ss = Math.pow(0.5, 10);
  window.lq = performance.now() + 0;
  window.tdown = 0;
  let mxxx = 100;
  let mxxx2 = 100;
  window.ggg = 0;

  lastSTm = performance.now();
  var magic = (function () {
    requestAnimationFrame(magic);
    var tm = performance.now();

    var tO = 0;
    while (lastSTm < tm) {
      lastSTm += 1000 / simF(mpp);
      tO += 1;
      stepsQ += 1;
      if ((stepsT - startT) * context.sampleRate < window.vol.length) {
        drawFeedback();
        fboA.swap();
        stepsT += 1 / simF(mpp);
      }

      if (performance.now() - tm > 1000 / 60) {
        // console.log(tO/(performance.now() - tm )*1000)
        break;
      }
    }


  })
  magic();
  var qz = 0;
  regl.frame(function () {

    drawNi();
    // if (qz % 1 == 0) {
    //   pixels({
    //     copy: true, min: 'linear',
    //     mag: 'linear'
    //   })
    // }
    qz++;
    window.qz = qz;
    // window.lq=performance.now();
    // requestCallback(magic);
  });
});

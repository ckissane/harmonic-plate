/*
  tags: basic

 <p> This example shows how to use copyTexImage2D to implement feedback effects </p>
 */
import reglCreate from 'regl';
import GPU from 'gpu.js';
// console.log(GPU);
const gpu = new GPU();
window.vScale=1.0;
const regl = reglCreate({ extensions: ['webgl_draw_buffers', 'oes_texture_float', 'oes_texture_float_linear'] });
// const regl = require('regl')({extensions:["OES_texture_float"]})
const mouse = require('mouse-change')()
var subsamp = 4096 * 2;
var fund = 261.625565;
var mc = fund*2.0;
window.mul=1.0;
const gSize = 128;//128*4 ;
var mpp = 1.0;//0.5;
function simF(mp) {
  return mc * gSize / mp;
}
window.fastMode = false;
window.simF = simF;
var samN = 0;
var stepsT = 0;
var stepsQ = 0;
var lastSTm = new Date().getTime();
var lastFm = new Date().getTime();
var vuu = [];
for (var i = 0; i < gSize; i++) {
  vuu[i] = [];
  for (var j = 0; j < gSize; j++) {
    vuu[i][j] = [0.0, 0.0];
  }
}
const kernel = gpu.createKernel(function (array) {
  const [first, second] = array;
  return first + second;
}, {
    output: [2],
    argumentTypes: { array: 'Array(2)' }
  });
console.log("K", kernel([1, 2]));
const iterateBounce = gpu.createKernel(function (a, v: number) {
  let sum: number = 0.5;
  let sumv: number = 0.5 + v;
  let me: number = a[this.thread.x][this.thread.y][0] + a[this.thread.x][this.thread.y][0];
  sum += me;

  if (this.thread.x < 64.5) {

    if (this.thread.x > 62.5) {
      if (this.thread.y < 64.5) {

        if (this.thread.y > 62.5) {
          sum = sumv;
        }
      }
    }
  }
  return [sum - 0.5, a[this.thread.x][this.thread.y][1]];
}, {
    argumentTypes: { a: 'Array3D(2)', v: 'Float' }
  }).setOutput([2, gSize, gSize]);

// const iteratePull = gpu.createKernel(function(a: number[][][]) {
//   let sum:number = 0.5;
//   if(this.thread.z==1){
//     sum+=a[this.thread.x][this.thread.y][1];
//     sum+=-a[this.thread.x][this.thread.y][0];
//     sum+=a[this.thread.x+1][this.thread.y][0]/4.0;
//     sum+=a[this.thread.x-1][this.thread.y][0]/4.0;
//     sum+=a[this.thread.x][this.thread.y+1][0]/4.0;
//     sum+=a[this.thread.x][this.thread.y-1][0]/4.0;
//   }else{
//     sum+=a[this.thread.x][this.thread.y][0];
//   }
//   return sum-0.5;
// }).setOutput([2,gSize,gSize]).setOutputToTexture(true);
window.iterateBounce = iterateBounce;
// window.iteratePull=iteratePull;
require('getusermedia')({ audio: true }, function (err, stream) {
  window.vol = [0.0];
  if (err) {
    return
  }

  // Next we create an analyser node to intercept data from the mic
  const context = new AudioContext()
  //const analyser = context.createAnalyser()

  // And then we connect them together
  var source = context.createMediaStreamSource(stream);
  //source.connect(analyser)

  const demoCode = (context) => {
    context.audioWorklet.addModule(('./bypass-processor.js')).then(() => {
      // const oscillator = new OscillatorNode(context);
      const bypasser = new AudioWorkletNode(context, 'bypass-processor');
      source.connect(bypasser).connect(context.destination);
      // oscillator.start();
    });
  };
  //context.audioWorklet.addModule('bypass-processor.js');
  // demoCode(context);
  // registerProcessor('bypass-processor', BypassProcessor);
  const captureNode = context.createScriptProcessor(subsamp, 1, 1);
  console.log(context.sampleRate);
  captureNode.onaudioprocess = function (e) {
    // console.log("HI")
    var vu = e.inputBuffer.getChannelData(0);
    var ave = vu.map(Math.abs).reduce((a, b) => a + b, 0) / vu.length;
    window.vScale=window.vScale*0.1+1/Math.max(ave,0.01)*0.9;
    var nv = [];
    for (var i = 0; i < vu.length; i++) {

      nv[i] = true?vu[i]*window.vScale:Math.sin(Math.PI*2*samN/context.sampleRate*fund*window.mul)*0.5;//Math.abs(vu[i])<0.0?0:vu[i];
      samN += 1;
    }
    if (stepsT * context.sampleRate < window.vol.length && window.fastMode) {
      window.vol = window.vol.concat(nv);//vol.concat(vu);
    } else {
      if (window.fastMode) {
        stepsT = stepsT - window.vol.length / context.sampleRate;
        window.vol = nv;
      } else {
        stepsT = (((stepsT - vu.length / context.sampleRate) % (1 / mc) + (1 / mc)) % (1 / mc));
        window.vol = nv;//vol.concat(vu);//ave*1024;//(ave>0?vu.reduce((a,b)=>Math.max(a,b),0):vu.reduce((a,b)=>Math.min(a,b),0))/2+ave/2;///vu.length*128.0;
      }
    }

    //console.log(vu)
    // rawLeftChannelData is now a typed array with floating point samples
  };
  console.log(source);
  source.connect(captureNode).connect(context.destination);
  var getVol = () => {
    var rn = new Date().getTime() / 1000 * context.sampleRate;
    return window.vol[Math.floor(rn % subsamp)]

  }
  function getVolS() {
    var rn = stepsT * context.sampleRate;
    var ler = rn % 1;
    return (window.vol[Math.floor(rn % subsamp)] || 0) * (1 - ler) + (window.vol[Math.floor((rn + 1) % subsamp)] || 0) * ler;
  }
  // source.start();

  // Here we preallocate buffers for streaming audio data
  // const fftSize = analyser.frequencyBinCount
  // const frequencies = new Uint8Array(fftSize)
  // const fftBuffer = regl.buffer({
  //   length: fftSize,
  //   type: 'uint8',
  //   usage: 'dynamic'
  // })


  // const pixels = regl.texture({wrapS:"clamp",wrapT:"clamp",type:"float",width:100,height:100});
  const fbo = regl.framebuffer({
    color:
      regl.texture({ type: 'float', width: gSize, height: gSize, mag: 'linear' }),
    depthStencil: false
  })
  const fbo2 = regl.framebuffer({
    color:
      regl.texture({ type: 'float', width: gSize, height: gSize, mag: 'linear' }),
    depthStencil: false
  })
  const fboB = regl.framebuffer({
    color:
      regl.texture({ type: 'float', width: gSize, height: gSize, mag: 'linear' }),
    depthStencil: false
  })
  const fboB2 = regl.framebuffer({
    color:
      regl.texture({ type: 'float', width: gSize, height: gSize, mag: 'linear' }),
    depthStencil: false
  })
  const fboC = regl.framebuffer({
    color:
      regl.texture({ type: 'float', width: gSize, height: gSize, mag: 'linear' }),
    depthStencil: false
  })
  const fboC2 = regl.framebuffer({
    color:
      regl.texture({ type: 'float', width: gSize, height: gSize, mag: 'linear' }),
    depthStencil: false
  })


  // function doubleFbo(filter) {
  // 	let fbos = [createFbo(filter), createFbo(filter)];
  // 	return {
  // 		get read() {
  // 			return fbos[0];
  // 		},
  // 		get write() {
  // 			return fbos[1];
  // 		},
  // 		swap() {
  // 			fbos.reverse();
  // 		}
  // 	};
  // }

  // function createFbo(filter) {
  // 	let tex = regl.texture({
  // 		width: window.innerWidth >> config.TEXTURE_DOWNSAMPLE,
  // 		height: window.innerHeight >> config.TEXTURE_DOWNSAMPLE,
  // 		min: filter,
  // 		mag: filter,
  // 		type: "half float"
  // 	});
  // 	window.addEventListener("resize", () => {
  // 		tex.resize(
  // 			window.innerWidth >> config.TEXTURE_DOWNSAMPLE,
  // 			window.innerHeight >> config.TEXTURE_DOWNSAMPLE
  // 		);
  // 	});
  // 	return regl.framebuffer({
  // 		color: tex,
  // 		depthStencil: false
  // 	});
  // }
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
    //float mp=0.5;///2.0;
    
    vec2 cVa=texture2D(texture,uv).xy;
    vec2 cVa0=texture2D(texture,uv).xy;
    float sX=cVa.x+0.0;
    float gn=texture2D(texture,uv).z;
    cVa.y=cVa.y*2.0-1.0;
    cVa0.y=cVa0.y*2.0-1.0;
    
    float q=0.0;
    float qC=0.0;
    int i=1;
   // for(int i=1;i<2;i++){
      float s=float(i);
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
    q+=(dVa.x)*c;
    q+=(uVa.x)*c;
    q+=(lVa.x)*c;
    q+=(rVa.x)*c;
    qC+=c*4.0;
    //}
    float pos=cVa.x-0.5;
    
    float accel=(q/qC-cVa.x)*mp*mp;
    float vel=(cVa.y+0.0)+accel/2.0;
    cVa.y+=accel;
    
    //cVa.y+=accel/2.0;
    //cVa.x+=cVa.y*mp;
    //uVa.x+=uVa.y*mp;
    //lVa.x+=lVa.y*mp;
    //rVa.x+=rVa.y*mp;
    //dVa.x+=dVa.y*mp;
    
    float gnt=0.0;
   
    if(t<20.0){
        cVa=vec2(0.5,0.0);
        pos=0.0;
        //gn=0.0;
    }
    gnt=gn;//1.0;//abs(abs(rVa.x-0.5)+abs(lVa.x-0.5)+abs(uVa.x-0.5)+abs(dVa.x-0.5)-abs((rVa.x-0.5)+(lVa.x-0.5)+(uVa.x-0.5)+(dVa.x-0.5))*2.0)+abs(cVa.x-0.5);
    float apRat=pow(abs(-accel/mp/mp/pos),0.5);
    gnt=pow(pow(pos,2.0)+pow(vel/mp/mp,2.0)/abs(-accel/mp/mp/pos),0.5);
   
    
    //cVa.y=(vec2(0.5,0.0)*0.001+cVa*0.999).y;
    float j=1.0-length(floor(abs(uv-vec2(0.5))*res.xy))*100.0;//pow(2.0,-pow(length(abs(uv-vec2(0.5))*res.xy)/10.0,2.0));
    //j=1.0-length(floor(abs(uv-vec2(0.0,1.0))*res.xy));//pow(2.0,-pow(length(abs(uv-vec2(0.5))*res.xy)/10.0,2.0));
    cVa.x+=cVa.y;
    if( j>0.0 ){
    j=1.0;
    // cVa.y+=vol/2.0+0.5-cVa.x;
      cVa.x=cVa.x*(1.0-j)+vec2(vol/2.0+0.5,0.0).x*j;//cos(t*0.1*2.0*atan(0.0,-1.0))/4.0+0.5;
      //cVa.y=0.0;//-2.0*atan(0.0,-1.0)*0.01*sin(t*0.01*2.0*atan(0.0,-1.0))/2.0+0.5;
    }
    
    if(t<20.0){
      gn=abs(pos)*8.0;
    }
    if(gnt<1.0){//} && (abs(vel+pos)<=abs(pos) && abs(vel+pos-accel/2.0)>=abs(pos))){
    
      gnt=(abs(pos)*2.0+gnt)/2.0;//(abs(pos)+abs(uVa.x-0.5)+abs(lVa.x-0.5)+abs(dVa.x-0.5)+abs(rVa.x-0.5))/5.0;//gnt*8.0;//abs(pos);
      float le=max(0.001,0.0);//max(min((1.0-pow(0.5,1.0*apRat/100.0)),0.01),0.00001);//min(abs(vel*2.0+pos-0.5)/abs(pos-0.5)*0.001+0.00001,1.0);
      gnt=gnt;
      gn=abs(gnt*le+gn*(1.0-le));
    }
    if(length(floor(abs(uv-vec2(0.0,0.0))*res.xy))<1.0){
      //gn=0.05;
    }
    
    if(t<20.0){
      gn=0.0;
    }
    if(pos*vel>0.0){
    cVa=(vec2(0.5,0.0)*0.001+cVa*0.999);
    }
  gl_FragColor = vec4(vec3(cVa.x,cVa.y*0.5+0.5,gn),1.0);
}`;
var vr=`

  precision mediump float;
  attribute vec2 position;
  varying vec2 uv;
  void main () {
    uv = position/2.0+vec2(0.5,0.5);
    gl_Position = vec4(position, 0, 1);
  }
  `;
  const drawFeedback = [regl({
    frag: fr,

    vert: vr,

    attributes: {
      position: [

        -1, -1,
        3, -1,
        -1, 3,



      ]
    },
    framebuffer: fbo,
    uniforms: {
      texture: fbo2,
      mouse: ({ pixelRatio, viewportHeight, viewportWidth }) => [
        mouse.x * pixelRatio,
        viewportHeight - mouse.y * pixelRatio
      ],
      res: ({ viewportHeight, viewportWidth }) => [
        gSize, gSize
        // viewportWidth,
        // viewportHeight
      ],
      t: ({ tick }) => tick,
      vol: () => {
        return getVolS();

      },
      mp: () => mpp
    },

    count: 3
  }),regl({
    frag: fr,

    vert: vr,

    attributes: {
      position: [

        -1, -1,
        3, -1,
        -1, 3,



      ]
    },
    framebuffer: fbo2,
    uniforms: {
      texture: fbo,
      mouse: ({ pixelRatio, viewportHeight, viewportWidth }) => [
        mouse.x * pixelRatio,
        viewportHeight - mouse.y * pixelRatio
      ],
      res: ({ viewportHeight, viewportWidth }) => [
        gSize, gSize
        // viewportWidth,
        // viewportHeight
      ],
      t: ({ tick }) => tick,
      vol: () => {
        return getVolS();
      }, mp: () => mpp
    },

    count: 3
  })];
  const drawFeedbackB = [regl({
    frag: fr,

    vert: vr,

    attributes: {
      position: [

        -1, -1,
        3, -1,
        -1, 3,



      ]
    },
    framebuffer: fboB,
    uniforms: {
      texture: fboB2,
      mouse: ({ pixelRatio, viewportHeight, viewportWidth }) => [
        mouse.x * pixelRatio,
        viewportHeight - mouse.y * pixelRatio
      ],
      res: ({ viewportHeight, viewportWidth }) => [
        gSize, gSize
        // viewportWidth,
        // viewportHeight
      ],
      t: ({ tick }) => tick,
      vol: () => {
        return getVolS();

      },
      mp: () => mpp/2
    },

    count: 3
  }),regl({
    frag: fr,

    vert: vr,

    attributes: {
      position: [

        -1, -1,
        3, -1,
        -1, 3,



      ]
    },
    framebuffer: fboB2,
    uniforms: {
      texture: fboB,
      mouse: ({ pixelRatio, viewportHeight, viewportWidth }) => [
        mouse.x * pixelRatio,
        viewportHeight - mouse.y * pixelRatio
      ],
      res: ({ viewportHeight, viewportWidth }) => [
        gSize, gSize
        // viewportWidth,
        // viewportHeight
      ],
      t: ({ tick }) => tick,
      vol: () => {
        return getVolS();
      }, mp: () => mpp/2
    },

    count: 3
  })];


  const drawFeedbackC = [regl({
    frag: fr,

    vert: vr,

    attributes: {
      position: [

        -1, -1,
        3, -1,
        -1, 3,



      ]
    },
    framebuffer: fboC,
    uniforms: {
      texture: fboC2,
      mouse: ({ pixelRatio, viewportHeight, viewportWidth }) => [
        mouse.x * pixelRatio,
        viewportHeight - mouse.y * pixelRatio
      ],
      res: ({ viewportHeight, viewportWidth }) => [
        gSize, gSize
        // viewportWidth,
        // viewportHeight
      ],
      t: ({ tick }) => tick,
      vol: () => {
        return getVolS();

      },
      mp: () => mpp/4
    },

    count: 3
  }),regl({
    frag: fr,

    vert: vr,

    attributes: {
      position: [

        -1, -1,
        3, -1,
        -1, 3,



      ]
    },
    framebuffer: fboC2,
    uniforms: {
      texture: fboC,
      mouse: ({ pixelRatio, viewportHeight, viewportWidth }) => [
        mouse.x * pixelRatio,
        viewportHeight - mouse.y * pixelRatio
      ],
      res: ({ viewportHeight, viewportWidth }) => [
        gSize, gSize
        // viewportWidth,
        // viewportHeight
      ],
      t: ({ tick }) => tick,
      vol: () => {
        return getVolS();
      }, mp: () => mpp/4
    },

    count: 3
  })];
  const drawNi = regl({
    frag: `
    precision mediump float;
    uniform sampler2D texture;
    uniform sampler2D textureB;
    uniform sampler2D textureC;
    uniform vec2 mouse;
    uniform vec2 res;
    uniform vec2 resp;
    uniform float t;
    varying vec2 uv;
    float hue2rgb(float f1, float f2, float hue) {
      if (hue < 0.0)
          hue += 1.0;
      else if (hue > 1.0)
          hue -= 1.0;
      float res;
      if ((6.0 * hue) < 1.0)
          res = f1 + (f2 - f1) * 6.0 * hue;
      else if ((2.0 * hue) < 1.0)
          res = f2;
      else if ((3.0 * hue) < 2.0)
          res = f1 + (f2 - f1) * ((2.0 / 3.0) - hue) * 6.0;
      else
          res = f1;
      return res;
  }
  
  vec3 hsl2rgb(vec3 hsl) {
      vec3 rgb;
      
      if (hsl.y == 0.0) {
          rgb = vec3(hsl.z); // Luminance
      } else {
          float f2;
          
          if (hsl.z < 0.5)
              f2 = hsl.z * (1.0 + hsl.y);
          else
              f2 = hsl.z + hsl.y - hsl.y * hsl.z;
              
          float f1 = 2.0 * hsl.z - f2;
          
          rgb.r = hue2rgb(f1, f2, hsl.x + (1.0/3.0));
          rgb.g = hue2rgb(f1, f2, hsl.x);
          rgb.b = hue2rgb(f1, f2, hsl.x - (1.0/3.0));
      }   
      return rgb;
  }
  
  vec3 normAt(vec2 p){
    float mp=1.0;
        float qb=2.0;
        vec2 rc=vec2(min(res.x,res.y));
        vec2 uv2=p;
        vec2 up=uv2+vec2(0.0,-1.0)/resp.xy*qb;
        vec2 left=uv2+vec2(-1.0,0.0)/resp.xy*qb;
        vec2 right=uv2+vec2(1.0,0.0)/resp.xy*qb;
        vec2 down=uv2+vec2(0.0,1.0)/resp.xy*qb;
        vec2 cVa=texture2D(texture,uv2).xy;
        float gn=texture2D(texture,uv2).z;
        float gnB=texture2D(texture,vec2(0.0,0.0)).z;
        cVa.y=cVa.y*2.0-1.0;
        vec2 uVa=texture2D(texture,up).xy;
        uVa.y=uVa.y*2.0-1.0;
        vec2 lVa=texture2D(texture,left).xy;
        lVa.y=lVa.y*2.0-1.0;
        vec2 rVa=texture2D(texture,right).xy;
        rVa.y=rVa.y*2.0-1.0;
        vec2 dVa=texture2D(texture,down).xy;
        dVa.y=dVa.y*2.0-1.0;
        vec2 aa=(cVa+uVa+dVa+lVa+rVa)/5.0;
        
        //cVa.x+=cVa.y*mp;
        //uVa.x+=uVa.y*mp;
        //lVa.x+=lVa.y*mp;
        //rVa.x+=rVa.y*mp;
        //dVa.x+=dVa.y*mp;
        vec3 normal=vec3(0.0,0.0,0.0);
        float h=100.0;
       
        
        
        
        
        normal+=normalize(vec3(gn-texture2D(texture,right).z,0.0,1.0/h));
        normal+=normalize(-vec3(gn-texture2D(texture,left).z,0.0,-1.0/h));
        normal+=normalize(vec3(0.0,gn-texture2D(texture,down).z,1.0/h));
        normal+=normalize(-vec3(0.0,gn-texture2D(texture,up).z,-1.0/h));
        normal=normalize(normal);
        return normal;
  }
    void main () {
        float mp=1.0;
        float qb=1.0;
        vec2 rc=vec2(min(res.x,res.y));
        vec2 uv2=(uv-vec2(0.5,0.5)-vec2(0.5,0.5)/res.xy*0.0)*res.xy/rc.xy+vec2(0.5,0.5);
        vec2 up=uv2+vec2(0.0,-1.0)/resp.xy*qb;
        vec2 left=uv2+vec2(-1.0,0.0)/resp.xy*qb;
        vec2 right=uv2+vec2(1.0,0.0)/resp.xy*qb;
        vec2 down=uv2+vec2(0.0,1.0)/resp.xy*qb;
        vec2 cVa=texture2D(texture,uv2).xy;
        float gn=texture2D(texture,uv2).z;
        float gnB=texture2D(texture,vec2(0.0,0.0)).z;
        cVa.y=cVa.y*2.0-1.0;
        vec2 uVa=texture2D(texture,up).xy;
        uVa.y=uVa.y*2.0-1.0;
        vec2 lVa=texture2D(texture,left).xy;
        lVa.y=lVa.y*2.0-1.0;
        vec2 rVa=texture2D(texture,right).xy;
        rVa.y=rVa.y*2.0-1.0;
        vec2 dVa=texture2D(texture,down).xy;
        dVa.y=dVa.y*2.0-1.0;
        vec2 aa=(cVa+uVa+dVa+lVa+rVa)/5.0;
        
        //cVa.x+=cVa.y*mp;
        //uVa.x+=uVa.y*mp;
        //lVa.x+=lVa.y*mp;
        //rVa.x+=rVa.y*mp;
        //dVa.x+=dVa.y*mp;
        vec3 normal=vec3(0.0);
        vec3 mep=vec3(uv2,texture2D(texture,uv2).z/gnB);
        float hb=0.0;
        float tt=0.0;
        for(int i=-1;i<=1;i++){
          for(int j=-1;j<=1;j++){
            if((i*i>0 || j*j>0 )){
              
            vec2 op=uv2+vec2(float(i),float(j))/resp.xy*qb;
            vec2 op2=uv2+vec2(float(j),-float(i))/resp.xy*qb;
            float pV=1.0/pow(length(op),2.0);
            tt+=pV;
            if(texture2D(texture,op).z>gn){// && texture2D(texture,uv2-op*2.0).z>gn){
              hb+=pV;
            }
            
            //hb=hb+texture2D(texture,op).z/gnB;
              vec3 opp=vec3(op,texture2D(texture,op).z/gnB)-mep;
              vec3 opp2=vec3(op2,texture2D(texture,op2).z/gnB)-mep;
              normal+=normalize(cross(opp,opp2));
            }
          }
        }
        normal=normalize(normal);
        //normalize(normAt(uv2)+normAt(up)+normAt(left)+normAt(down)+normAt(right));
        float colA=atan(normal.y,normal.x)/atan(0.0,-1.0)/2.0;
        if(cVa.y<0.0){
          //colA+=0.5;
          colA=mod(colA,1.0);
        }
        if(gnB*0.5<gn){
          normal=-normal;
        }
       
        gn=hb/tt*2.0-1.0;
        vec3 col=hsl2rgb(vec3(mod(colA,1.0),1.0,min(max(gn,0.0),1.0)));//max(1.0-10.0*pow(pow((cVa.x-0.5)*4.0,2.0)+pow(cVa.y*8.0,2.0),0.5),0.0)));
      gl_FragColor = vec4(vec3(dot(normal,normalize(vec3(-1.0,2.0,1.0)))*0.5)*col*0.0+col,1.0);
      gl_FragColor=vec4(vec3(1.0-texture2D(texture,uv2).z/texture2D(texture,vec2(0.0)).z,1.0-texture2D(textureB,uv2).z/texture2D(textureB,vec2(0.0)).z,1.0-texture2D(textureC,uv2).z/texture2D(textureC,vec2(0.0)).z),1.0);
      gl_FragColor=vec4(vec3(texture2D(texture,uv2).z,texture2D(textureB,uv2).z,texture2D(textureC,uv2).z),1.0);
     
      vec2 uvc=(uv2-vec2(0.5,0.5))*2.0;
      if(max(abs(uvc.x),abs(uvc.y))>1.0){
        gl_FragColor = vec4(vec3(0.0),1.0);
      }
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
      texture: fbo,
      textureB: fboB,
      textureC: fboC,
      mouse: ({ pixelRatio, viewportHeight, viewportWidth }) => [
        mouse.x * pixelRatio,
        viewportHeight - mouse.y * pixelRatio
      ],
      res: ({ viewportHeight, viewportWidth }) => [
        viewportWidth,
        viewportHeight
      ],
      resp: ({ viewportHeight, viewportWidth }) => [
        gSize, gSize
      ],
      t: ({ tick }) => tick
    },

    count: 3
  })

  var flips = 0;
  regl.frame(function () {
    //   regl.clear({
    //     color: [0.5, 0.5, 0.5, 1]
    //   })
    var tm = new Date().getTime();//*2-lastSTm;
    // while(lastSTm<tm){
    //   lastSTm+=1000/simF(mpp);

    //   stepsQ+=1;
    //   // if(tm-lastSTm>1000){
    //   //  console.log("sps",stepsQ,"need",mc*gSize,context.sampleRate/(mc*gSize))
    //   //   lastSTm=tm;
    //   //   stepsQ=0;
    //   // }
    //   if(stepsT*context.sampleRate<window.vol.length){
    //   drawFeedbackB[flips % 2]();
    //   drawFeedbackC[flips % 2]();
    //   drawFeedback[(flips++) % 2]();
    //   stepsT+=1/simF(mpp);
    //   }
    //   if(new Date().getTime()-tm>1000/60){
    //     break;
    //   }
    // }
    // drawNi();
    // while(new Date().getTime()-tm<1000/60){
    //   lastSTm+=1000/simF(mpp);

    //   stepsQ+=1;
    //   // if(tm-lastSTm>1000){
    //   //  console.log("sps",stepsQ,"need",mc*gSize,context.sampleRate/(mc*gSize))
    //   //   lastSTm=tm;
    //   //   stepsQ=0;
    //   // }
    //   if(stepsT*context.sampleRate<window.vol.length){
    //   drawFeedbackB[flips % 2]();
    //   drawFeedbackC[flips % 2]();
    //   drawFeedback[(flips++) % 2]();
    //   stepsT+=1/simF(mpp);
    //   }
      
    // }

    for (var i = 0; i < 4096; i++) {
      stepsQ += 1;
      if (stepsT * context.sampleRate < window.vol.length) {

        // var tm=new Date().getTime();
        // if(tm-lastSTm>1000){
        //  console.log("sps2",stepsQ,"need",mc*gSize,context.sampleRate/(mc*gSize))
        //   lastSTm=tm;
        //   stepsQ=0;
        // }
        
        drawFeedbackB[flips % 2]();
        drawFeedbackC[flips % 2]();
        drawFeedback[(flips++) % 2]();
        
        stepsT += 1 / simF(mpp);
      }
      window.gd = [stepsT * context.sampleRate, window.vol.length]
      if (new Date().getTime() - tm > 1000 / 60) {
        break;
      }
    }
    drawNi();
    var tm = new Date().getTime();
    if (tm - lastFm > 1000) {
      console.log("sps", stepsQ, "need", mc * gSize, context.sampleRate / (mc * gSize))
      lastFm = tm;
      var sr = 0;//Math.log(stepsQ/context.sampleRate)/Math.log(2);
      sr = Math.min(Math.floor(sr), 0);
      var subSuper = Math.floor(context.sampleRate);
      if (stepsQ >= subSuper) {
        mpp = Math.max(mc * gSize / subSuper, 1);//0.125);
        console.log("subSuper", subSuper, "stepsQ", stepsQ)
        window.fastMode = true;
        if (mpp > 1) {
          mpp = 1;
          window.fastMode = false;
        }
      } else {
        mpp = 1;
        window.fastMode = false;
      }
      stepsQ = 0;
    }
    window.mpp = mpp;
    lastSTm = tm;

    
    //   pixels({
    //     copy: true
    //   })
  })
});
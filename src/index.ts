/*
  tags: basic

 <p> This example shows how to use copyTexImage2D to implement feedback effects </p>
 */
import reglCreate from 'regl';
// import { GPU } from 'gpu.js';
// const gpu = new GPU();

const regl=reglCreate({extensions:['webgl_draw_buffers', 'oes_texture_float','oes_texture_float_linear']});
// const regl = require('regl')({extensions:["OES_texture_float"]})
const mouse = require('mouse-change')()
var subsamp=4096*2;
var mc=261.625565;
const gSize=128;
var simF=mc*gSize;
var samN=0;
var stepsT=0;
var stepsQ=0;
var lastSTm=new Date().getTime();
var lastFm=new Date().getTime();
// const iterateBounce = gpu.createKernel(function(a: number[][][]) {
//   let sum = 0;
//   if(this.thread.z==0){
//     sum+=a[this.thread.x][this.thread.y][0]+a[this.thread.x][this.thread.y][1];
//   }else{
//     sum+=a[this.thread.x][this.thread.y][1];
//   }
//   return sum;
// }).setOutput([gSize,gSize,2]);

// const iteratePull = gpu.createKernel(function(a: number[][][]) {
//   let sum = 0;
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
//   return sum;
// }).setOutput([gSize,gSize,2]);
// window.iterateBounce=iterateBounce;
// window.iteratePull=iteratePull;
require('getusermedia')({audio: true}, function (err, stream) {
  window.vol=[0.0];
  if (err) {
    return
  }

  // Next we create an analyser node to intercept data from the mic
  const context = new AudioContext()
  //const analyser = context.createAnalyser()

  // And then we connect them together
  var source=context.createMediaStreamSource(stream);
  //source.connect(analyser)
  
  const demoCode =  (context) => {
    context.audioWorklet.addModule(('./bypass-processor.js')).then(()=>{
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
  captureNode.onaudioprocess= function(e) {
   // console.log("HI")
    var vu=e.inputBuffer.getChannelData(0);
    var ave=vu.reduce((a,b)=>a+b,0)/vu.length;
    var nv=[];
    for(var i=0;i<vu.length;i++){
      
nv[i]=vu[i];//Math.sin(Math.PI*2*samN/context.sampleRate*mc)*0.5;//Math.abs(vu[i])<0.0?0:vu[i];
samN+=1;    
}
    stepsT=(((stepsT-vu.length/context.sampleRate)%(1/mc)+(1/mc))%(1/mc));
    window.vol=nv;//vol.concat(vu);//ave*1024;//(ave>0?vu.reduce((a,b)=>Math.max(a,b),0):vu.reduce((a,b)=>Math.min(a,b),0))/2+ave/2;///vu.length*128.0;
    
    //console.log(vu)
    // rawLeftChannelData is now a typed array with floating point samples
  };
  console.log(source);
  source.connect(captureNode).connect(context.destination);
  var getVol=()=>{
    var rn=new Date().getTime()/1000*context.sampleRate;
    return window.vol[Math.floor(rn%subsamp)]
    
  }
  function getVolS(){
    var rn=stepsT*context.sampleRate;
    var ler=rn%1;
      return (window.vol[Math.floor(rn%subsamp)]||0)*(1-ler)+(window.vol[Math.floor((rn+1)%subsamp)]||0)*ler;
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
      regl.texture({type: 'float', width: gSize, height: gSize,mag:'linear'}),
    depthStencil:false
  })
  const fbo2 = regl.framebuffer({
    color: 
      regl.texture({type: 'float', width: gSize, height: gSize,mag:'linear'}),
      depthStencil:false
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
var fr=`
precision mediump float;
uniform sampler2D texture;
uniform vec2 mouse;
uniform vec2 res;
uniform float t;
uniform float vol;
varying vec2 uv;
void main () {
    float mp=1.0;///2.0;
    
    vec2 cVa=texture2D(texture,uv).xy;
    float sX=cVa.x+0.0;
    float gn=texture2D(texture,uv).z;
    cVa.y=cVa.y*2.0-1.0;
    
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
    
    float accel=q/qC-cVa.x;
    cVa.y+=accel/2.0;
    float vel=cVa.y+0.0;
    cVa.y+=accel/2.0;
    //cVa.x+=cVa.y*mp;
    //uVa.x+=uVa.y*mp;
    //lVa.x+=lVa.y*mp;
    //rVa.x+=rVa.y*mp;
    //dVa.x+=dVa.y*mp;
    
    float gnt=0.0;
   
    if(t<20.0){
        cVa=vec2(0.5,0.0);
        //gn=0.0;
    }
    gnt=gn;//1.0;//abs(abs(rVa.x-0.5)+abs(lVa.x-0.5)+abs(uVa.x-0.5)+abs(dVa.x-0.5)-abs((rVa.x-0.5)+(lVa.x-0.5)+(uVa.x-0.5)+(dVa.x-0.5))*2.0)+abs(cVa.x-0.5);
    float apRat=pow(abs(-accel/pos),0.5);
    gnt=pow(pow(pos,2.0)+pow(vel,2.0)/abs(-accel/pos),0.5);
   
    cVa.x+=cVa.y*mp;
    //cVa.y=(vec2(0.5,0.0)*0.001+cVa*0.999).y;
    float j=1.0-length(floor(abs(uv-vec2(0.5))*res.xy-vec2(0.5)));//pow(2.0,-pow(length(abs(uv-vec2(0.5))*res.xy)/10.0,2.0));
    //j=1.0-length(floor(abs(uv)*res.xy));//pow(2.0,-pow(length(abs(uv-vec2(0.5))*res.xy)/10.0,2.0));
    
    if( j>0.0 ){
    
      cVa.x=cVa.x*(1.0-j)+vec2(vol/2.0+0.5,0.0).x*j;//cos(t*0.1*2.0*atan(0.0,-1.0))/4.0+0.5;
      //cVa.y=0.0;//-2.0*atan(0.0,-1.0)*0.01*sin(t*0.01*2.0*atan(0.0,-1.0))/2.0+0.5;
    }
    if(t<20.0){
      gn=0.5;
    }
    if(gnt<1.0){
      gn=abs(gnt*0.001+gn*0.999);
    }
    
    
    if(t<20.0){
      gn=0.5;
    }
    cVa=(vec2(0.5,0.0)*0.001+cVa*0.999);
  gl_FragColor = vec4(vec3(cVa.x,cVa.y*0.5+0.5,gn),1.0);
}`;
const drawFeedback = regl({
  frag: fr,

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
  framebuffer: fbo,
  uniforms: {
    texture: fbo2,
    mouse: ({pixelRatio, viewportHeight,viewportWidth}) => [
      mouse.x * pixelRatio,
      viewportHeight - mouse.y * pixelRatio
    ],
    res: ({viewportHeight,viewportWidth}) => [
        gSize,gSize
        // viewportWidth,
        // viewportHeight
      ],
    t: ({tick}) => tick,
    vol: ()=>{
      return getVolS();
      
    }
  },

  count: 3
})

const drawFeedback2 = regl({
    frag: fr,
  
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
    framebuffer: fbo2,
    uniforms: {
      texture: fbo,
      mouse: ({pixelRatio, viewportHeight,viewportWidth}) => [
        mouse.x * pixelRatio,
        viewportHeight - mouse.y * pixelRatio
      ],
      res: ({viewportHeight,viewportWidth}) => [
          gSize,gSize
          // viewportWidth,
          // viewportHeight
        ],
      t: ({tick}) => tick,
      vol: ()=>{
        return getVolS();
      }
    },
  
    count: 3
  })

const drawNi = regl({
    frag: `
    precision mediump float;
    uniform sampler2D texture;
    uniform vec2 mouse;
    uniform vec2 res;
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
  
  
    void main () {
        float mp=1.0;
        float qb=1.5;
        vec2 rc=vec2(min(res.x,res.y));
        vec2 uv2=(uv-vec2(0.5,0.5)-vec2(0.5,0.5)/res.xy)*res.xy/rc.xy+vec2(0.5,0.5);
        vec2 up=uv2+vec2(0.0,-1.0)/res.xy*qb;
        vec2 left=uv2+vec2(-1.0,0.0)/res.xy*qb;
        vec2 right=uv2+vec2(1.0,0.0)/res.xy*qb;
        vec2 down=uv2+vec2(0.0,1.0)/res.xy*qb;
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
        // gn=1.0;
        // if(abs(cVa.y)+abs(cVa.x-0.5)<abs(dVa.x-0.5)+abs(dVa.y)){
        //   gn+=-0.25;
        // }
        // if(abs(cVa.y)+abs(cVa.x-0.5)<abs(uVa.x-0.5)+abs(uVa.y)){
        //   gn+=-0.25;
        // }
        // if(abs(cVa.y)+abs(cVa.x-0.5)<abs(lVa.x-0.5)+abs(lVa.y)){
        //   gn+=-0.25;
        // }
        // if(abs(cVa.y)+abs(cVa.x-0.5)<abs(rVa.y)+abs(rVa.x-0.5)){
        //   gn+=-0.25;
        // }
        
        
        
        
        normal+=normalize(vec3(cVa.x-rVa.x,0.0,1.0/h));
        normal+=normalize(-vec3(cVa.x-lVa.x,0.0,-1.0/h));
        normal+=normalize(vec3(0.0,cVa.x-dVa.x,1.0/h));
        normal+=normalize(-vec3(0.0,cVa.x-uVa.x,-1.0/h));
        normal=normalize(normal);
        float colA=atan(normal.y,normal.x)/atan(0.0,-1.0)/2.0;
        if(cVa.y<0.0){
          //colA+=0.5;
          colA=mod(colA,1.0);
        }
        vec3 col=hsl2rgb(vec3(mod(colA*2.0,1.0),1.0,min(max(0.5-gn/gnB,0.0)*2.0,1.0)));//max(1.0-10.0*pow(pow((cVa.x-0.5)*4.0,2.0)+pow(cVa.y*8.0,2.0),0.5),0.0)));
      gl_FragColor = vec4(vec3(dot(normal,normalize(vec3(-1.0,2.0,1.0)))*0.5)*col*0.0+col,1.0);
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
      mouse: ({pixelRatio, viewportHeight,viewportWidth}) => [
        mouse.x * pixelRatio,
        viewportHeight - mouse.y * pixelRatio
      ],
      res: ({viewportHeight,viewportWidth}) => [
         viewportWidth,
          viewportHeight
        ],
      t: ({tick}) => tick
    },
  
    count: 3
  })

  var flips=0;
regl.frame(function () {
//   regl.clear({
//     color: [0.5, 0.5, 0.5, 1]
//   })
var tm=new Date().getTime();
while(lastSTm<tm){
  lastSTm+=1000/simF;
  stepsT+=1/mc/gSize;
  stepsQ+=1;
  // if(tm-lastSTm>1000){
  //  console.log("sps",stepsQ,"need",mc*gSize,context.sampleRate/(mc*gSize))
  //   lastSTm=tm;
  //   stepsQ=0;
  // }
  (flips++)%2===0?drawFeedback():drawFeedback2();
  if(new Date().getTime()-tm>1000/60){
    break;
  }
}
var tm=new Date().getTime();
//   if(tm-lastFm>1000){
//    console.log("sps",stepsQ,"need",mc*gSize,context.sampleRate/(mc*gSize))
//     lastFm=tm;
//     stepsQ=0;
//   }
lastSTm=tm;
// for(var i=0;i<128;i++){
//   stepsT+=1/mc/gSize;
//   stepsQ+=1;
//   var tm=new Date().getTime();
//   if(tm-lastSTm>1000){
//    console.log("sps",stepsQ,"need",mc*gSize,context.sampleRate/(mc*gSize))
//     lastSTm=tm;
//     stepsQ=0;
//   }
//   (flips++)%2===0?drawFeedback():drawFeedback2();
// }
drawNi();
//   pixels({
//     copy: true
//   })
})
});
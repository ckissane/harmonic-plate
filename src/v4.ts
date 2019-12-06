/*
  tags: basic

 <p> This example shows how to use copyTexImage2D to implement feedback effects </p>
 */
import reglCreate from 'regl';
import GPU from 'gpu.js';
import * as dat from 'dat.gui';
var HarmonicPlate = function() {
  this.message = 'dat.gui';
  this.detail=125;
  // Define render logic ...
};
var harmonicPlate = new HarmonicPlate();

// console.log(GPU);
// const gpu = new GPU();
window.vScale=1.0;
window.gen=true;
const regl = reglCreate({ extensions: ['webgl_draw_buffers', 'oes_texture_float', 'oes_texture_float_linear'] });
const gui = new dat.GUI();
var detailController=gui.add(harmonicPlate, 'detail', 10, 1080,5);
detailController.onFinishChange(function(value) {
  window.resizeG(value);
});
// const regl = require('regl')({extensions:["OES_texture_float"]})
const mouse = require('mouse-change')()
var subsamp = 4096 * 2;
var fund =261.625565;
var mc = fund;
window.mul=17**0.5;
var mpp = 1.0;//0.5;
var lastVolSample=0.0;
function simF(mp) {
  return mc * harmonicPlate.detail / mp;
}
window.fastMode = false;
window.simF = simF;
var samN = 0;
var stepsT = 0;
var stepsQ = 0;
var lastSTm = new Date().getTime();
var lastFm = new Date().getTime();
require('getusermedia')({ audio: true }, function (err, stream) {
  // var stream = (document.getElementById('sound') as HTMLAudioElement).captureStream();
  // (document.getElementById('sound') as HTMLAudioElement).play();
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
    window.vScale=1.0;//window.vScale*0.1+1/Math.max(ave,0.01)*0.9;
    var nv = [];
    for (var i = 0; i < vu.length; i++) {

      nv[i] = window.gen?vu[i]*window.vScale:Math.sin(Math.PI*2*samN/context.sampleRate*fund*window.mul)*0.5;//Math.abs(vu[i])<0.0?0:vu[i];
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
    //var ln=lastVolSample* context.sampleRate;
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


  const pixels = regl.texture({wrapS:"clamp",wrapT:"clamp"});
  const fboA = doubleFbo("linear");
  window.fboA=fboA;
  

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
        fbos.forEach(x=>{x.tex.resize(width,height);x.buf.resize(width,height);});
      }
  	};
  }

  function createFbo(filter) {
  	let tex = regl.texture({ type: 'float', width: harmonicPlate.detail, height: harmonicPlate.detail, mag: 'linear' });
  	// window.addEventListener("resize", () => {
  	// 	tex.resize(
  	// 		window.innerWidth >> config.TEXTURE_DOWNSAMPLE,
  	// 		window.innerHeight >> config.TEXTURE_DOWNSAMPLE
  	// 	);
  	// });
  	return {tex:tex,buf:regl.framebuffer({
  		color: tex,
  		depthStencil: false
  	})};
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
var vr=`

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
    framebuffer: ()=>fboA.write(),
    uniforms: {
      texture: ()=>fboA.read(),
      mouse: ({ pixelRatio, viewportHeight, viewportWidth }) => [
        mouse.x * pixelRatio,
        viewportHeight - mouse.y * pixelRatio
      ],
      res: ({ viewportHeight, viewportWidth }) => {return [
        harmonicPlate.detail, harmonicPlate.detail
      ]},
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
      vec2 rc=vec2(min(res.x,res.y));
        vec2 uv2=(uv-vec2(0.5,0.5)-vec2(0.5,0.5)/res.xy*0.0)*res.xy/rc.xy+vec2(0.5,0.5);
        vec2 uvc=(uv2-vec2(0.5,0.5))*2.0;
        if(max(abs(uvc.x),abs(uvc.y))>1.0){
          gl_FragColor = vec4(vec3(0.0),1.0);
            
          return;
        }
        float gn=texture2D(texture,uv2).z;
     
      gl_FragColor = vec4(vec3( min(max(1.0-gn/texture2D(texture,vec2(0.0)).z,0.0),1.0)),1.0);
        float mp=1.0;
        float qb=0.5;
        vec2 up=uv2+vec2(0.0,-1.0)/resp.xy*qb;
        vec2 left=uv2+vec2(-1.0,0.0)/resp.xy*qb;
        vec2 right=uv2+vec2(1.0,0.0)/resp.xy*qb;
        vec2 down=uv2+vec2(0.0,1.0)/resp.xy*qb;
        vec2 cVa=texture2D(texture,uv2).xy;
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
        vec2 jDir=vec2(0.0);
        vec3 mep=vec3(uv2,texture2D(texture,uv2).z);
        float hb=0.0;
        float tt=0.0;
        for(int i=-2;i<=2;i++){
          for(int j=-2;j<=2;j++){
            if((i*i>0 || j*j>0 )&& length(vec2(i,j))<=10.0){//} && abs(float(i*j))<1.0){
              
            vec2 op=uv2+vec2(float(i),float(j))/resp.xy*qb;
            vec2 op2=uv2+vec2(float(j),-float(i))/resp.xy*qb;
            float pV=pow(length(vec2(i,j)),0.0);
            tt+=pV;
            if(texture2D(texture,op).z>texture2D(texture,uv2).z){//abs(texture2D(texture,op).y-0.5)>abs(texture2D(texture,uv2).y-0.5)){// && texture2D(texture,uv2-op*2.0).z>gn){
              hb+=pV;
              }
              float mmm=1.0;
                if(vec2(float(i),float(j)).y<0.0 ||(vec2(float(i),float(j)).y<=0.0 &&vec2(float(i),float(j)).x<=0.0)){
                  mmm=-1.0;
                }
                if(length(vec2(i,j))<=10.0){
                jDir+=vec2(float(i),float(j))*mmm*(texture2D(texture,op).z-texture2D(texture,op2).z);
                }
            //hb=hb+texture2D(texture,op).z/gnB;
              vec3 opp=vec3(op,texture2D(texture,op).z)-mep;
              vec3 opp2=vec3(op2,texture2D(texture,op2).z)-mep;
              normal+=normalize(cross(opp,opp2));
            }
          }
        }
        normal=normalize(normal);
        normal.xy=normalize(jDir);
        
        //normalize(normAt(uv2)+normAt(up)+normAt(left)+normAt(down)+normAt(right));
        float colA=atan(normal.y,normal.x)/atan(0.0,-1.0)/2.0;
        //if(cVa.y<0.0){
          //colA+=0.5;
          //colA=mod(colA,1.0);
        //}
        //if(uvc.x<0.0){
          colA=mod(colA,1.0);
          colA=colA*2.0;
          colA=mod(colA,1.0);
          //colA+=0.5;
        //}
        // if(gnB*0.5<gn){
        //   normal=-normal;
        // }
       
        gn=((hb/tt*2.0-1.0)*2.0)/2.0;
//         if(1.0-texture2D(texture,uv2).z/texture2D(texture,vec2(0.0)).z<0.5){
// gn=0.0;
//         }
        //gn=gn*gn;
        // if(gn<0.5){
        //   gn=0.0;
        // }
        vec3 col=hsl2rgb(vec3(mod(colA,1.0),1.0,min(max(gn,0.0),1.0)));//max(1.0-10.0*pow(pow((cVa.x-0.5)*4.0,2.0)+pow(cVa.y*8.0,2.0),0.5),0.0)));
      vec4 cooo = vec4(col,1.0);
      //gl_FragColor=vec4(vec3(1.0-texture2D(texture,uv2).z/texture2D(texture,vec2(0.0)).z,1.0-texture2D(textureB,uv2).z/texture2D(textureB,vec2(0.0)).z,1.0-texture2D(textureC,uv2).z/texture2D(textureC,vec2(0.0)).z),1.0);
    //gl_FragColor=vec4(vec3(texture2D(texture,uv2).z,texture2D(textureB,uv2).z,texture2D(textureC,uv2).z),1.0);
     
      
      gl_FragColor=cooo+texture2D(p,uv)*0.0;
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
      p:pixels,
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
      resp: ({ viewportHeight, viewportWidth }) => {return [
        harmonicPlate.detail, harmonicPlate.detail
      ]},
      t: ({ tick }) => tick,
    },

    count: 3
  })
function resizeG(width,height){
  harmonicPlate.detail =width;
  fboA.resize(harmonicPlate.detail,harmonicPlate.detail);
}
window.resizeG=resizeG;
  var flips = 0;
var magic=(function () {
  
    //   regl.clear({
    //     color: [0.5, 0.5, 0.5, 1]
    //   })
    var tm = new Date().getTime();//*2-lastSTm;
    // while(lastSTm<tm){
    //   lastSTm+=1000/simF(mpp);

    //   stepsQ+=1;
    //   // if(tm-lastSTm>1000){
    //   //  console.log("sps",stepsQ,"need",mc*harmonicPlate.detail,context.sampleRate/(mc*harmonicPlate.detail))
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
    //   //  console.log("sps",stepsQ,"need",mc*harmonicPlate.detail,context.sampleRate/(mc*harmonicPlate.detail))
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
        //  console.log("sps2",stepsQ,"need",mc*harmonicPlate.detail,context.sampleRate/(mc*harmonicPlate.detail))
        //   lastSTm=tm;
        //   stepsQ=0;
        // }
        
        // drawFeedbackB[flips % 2]();
        // drawFeedbackC[flips % 2]();
        drawFeedback();
        fboA.swap();
        
        stepsT += 1 / simF(mpp);
      }else{
        stepsQ += (4096-i);
        break;
        
      }
      window.gd = [stepsT * context.sampleRate, window.vol.length]
      // if (new Date().getTime() - tm > 1000 / 10) {
      //   break;
      // }
    }
    
//pixels({copy:true})
    var tm = new Date().getTime();
    var mkMN=1;//5.9;
    if (tm - lastFm > 1000) {
      console.log("sps", stepsQ, "need", mc * harmonicPlate.detail, context.sampleRate / (mc * harmonicPlate.detail),harmonicPlate.detail)
      lastFm = tm;
      var sr = 0;//Math.log(stepsQ/context.sampleRate)/Math.log(2);
      sr = Math.min(Math.floor(sr), 0);
      var subSuper = Math.floor(context.sampleRate);
      if (stepsQ >= subSuper/mkMN) {
        mpp = 1;//Math.max(  subSuper/stepsQ, 0.125);
        console.log("subSuper", subSuper, "stepsQ", stepsQ)
        window.fastMode = true;
        if (mpp > mkMN) {
          mpp = mkMN;
          window.fastMode = false;
        }
      } else {
        mpp = mkMN;
        window.fastMode = false;
      }
      stepsQ = 0;
    }
    window.mpp = mpp;
    lastSTm = tm;

    window.setTimeout(magic,0);
      
  })
  magic();
  regl.frame(function () {
    drawNi();
  });
});

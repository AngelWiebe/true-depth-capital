import { loadImage, underwaterSource, watchUnderwater } from './artwork.js';
import { isMotionPaused, motionChange } from './motion.js';

(() => {
  'use strict';
  let canvas = document.getElementById('scene');
  const stage = document.getElementById('stage'), section = document.getElementById('experience');
  const root = document.documentElement;
  const clamp = (x, a=0, b=1) => Math.max(a, Math.min(b, x));
  const mix = (a,b,t) => a+(b-a)*t;
  const smooth = (a,b,x) => { const t=clamp((x-a)/(b-a)); return t*t*(3-2*t); };
  const events = new AbortController(), uniforms = {};
  const chapters = [...document.querySelectorAll('.chapter')];
  let gl, program, overlay, ink, logo, background, underwater, wildlife;
  let W=1,H=1,ratio=1,travel=1,target=0,progress=0,phase=-1,ready=false,raf=0;
  let lastTime=0,clock=0,lastUI=-1,stopped=false,quality=1,slowFrames=0;
  let pointer=[0,0],pointerTarget=[0,0];
  const seed=n=>{const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a);};
  const motes=Array.from({length:48},(_,i)=>({x:seed(i),y:seed(i+100),z:seed(i+200),v:.003+seed(i+300)*.006}));
  const bubbles=Array.from({length:12},(_,i)=>({x:seed(i+400),y:seed(i+500),r:seed(i+600)}));

  const vertex=`
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main(){v_uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}
  `;
  const fragment=`
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_backdrop,u_underwater,u_logo,u_wildlife;
    uniform vec2 u_size,u_pointer;
    uniform vec4 u_backRect,u_underRect,u_logoRect;
    uniform float u_time,u_dive,u_line,u_contact,u_logoOpacity,u_depth;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
    }
    vec2 swell(vec2 p,float t){
      return vec2(sin(p.x*.83+p.y*1.71+t*.43)+.47*sin(p.x*2.91-p.y*1.13-t*.61),
                  sin(p.x*1.47-p.y*.79+t*.37)+.43*sin(p.y*2.37+p.x*1.07-t*.49));
    }
    float caustic(vec2 p){
      vec2 q=p+swell(p*.37,u_time*.7)*.55;
      float c=abs(sin(q.x*2.7+u_time*.18)+sin(q.y*2.3-u_time*.23));
      return pow(max(0.,1.-c*.65),12.);
    }
    float surfaceY(float x){
      float a=mix(.55,5.3,smoothstep(.035,.46,u_dive));
      return u_line+a*(sin(x*7.7+u_time*.47)*.56+sin(x*19.3-u_time*.66)*.29+sin(x*38.1+u_time*.31)*.12);
    }
    vec4 mark(vec2 p,float below,float depth){
      if(u_logoOpacity<.001)return vec4(0.);
      vec2 flow=swell(p/u_size*vec2(5.2,4.3),u_time);
      vec2 q=p+flow*(1.+depth*2.2)*below;
      q.y=mix(q.y,u_line+(q.y-u_line)*.986,below);
      vec2 uv=(q-u_logoRect.xy)/u_logoRect.zw;
      uv.x+=(uv.y-.5)*sin(u_dive*3.14159)*.012;
      if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)return vec4(0.);
      vec4 logo=texture2D(u_logo,uv);
      logo.a=smoothstep(.035,.96,logo.a);
      float neutral=1.-smoothstep(.12,.38,max(max(logo.r,logo.g),logo.b)-min(min(logo.r,logo.g),logo.b));
      float sweepPos=mod(u_time*.041+.35,1.75)-.3;
      float sweep=exp(-pow((uv.x-uv.y*.28-sweepPos)/.037,2.))*.09;
      logo.rgb+=vec3(.75,.88,1.)*sweep*neutral*smoothstep(.12,.7,logo.r);
      float light=caustic(p/u_size*vec2(11.,8.))*.045;
      vec3 immersed=logo.rgb*vec3(.81,.93,1.)+vec3(.49,.78,.85)*light*neutral;
      logo.rgb=mix(logo.rgb,immersed,below*.86);
      logo.a*=mix(1.,.88,below*smoothstep(.12,1.,u_dive))*u_logoOpacity;
      return logo;
    }
    void main(){
      vec2 uv=vec2(v_uv.x,1.-v_uv.y),p=uv*u_size;
      float line=surfaceY(uv.x),delta=p.y-line;
      float below=smoothstep(-1.5,1.5,delta),depth=max(0.,delta/u_size.y);
      float immerse=smoothstep(.015,.67,u_dive);
      vec2 skyUV=(p-u_backRect.xy)/u_backRect.zw;
      vec3 sky=texture2D(u_backdrop,clamp(skyUV,.001,.999)).rgb;
      // The mountain mirror ripples and contracts toward its shoreline.
      float retreat=mix(1.,.075,smoothstep(0.,.58,u_dive));
      vec2 reflection=vec2((p.x-u_backRect.x)/u_backRect.z,.633+max(0.,delta)/(u_backRect.w*retreat));
      float reflectionEdge=1.-smoothstep(.86,1.035,reflection.y);
      vec2 ripple=swell(vec2(uv.x*5.5,log(1.+depth*42.)*1.5),u_time);
      reflection+=ripple*vec2(.0015,.0025)*smoothstep(0.,.12,depth);
      float radius=length(vec2((uv.x-.5)*u_size.x/u_size.y,depth*3.8));
      float rings=sin(radius*96.-u_time*2.1)*exp(-radius*4.5)*u_contact;
      reflection.x+=rings*.0018;
      vec3 mirror=texture2D(u_backdrop,clamp(reflection,.001,.999)).rgb;
      vec3 base=mix(vec3(.024,.060,.077),vec3(.019,.075,.112),clamp(depth,0.,1.));
      vec3 surface=mix(base,mirror,reflectionEdge*(1.-smoothstep(.08,.65,u_dive)));
      float sparkle=pow(max(0.,ripple.x*.36+ripple.y*.28),14.)*.026;
      surface+=vec3(.7,.67,.57)*sparkle*exp(-pow((uv.x-.82)/.27,2.))*(1.-immerse);
      surface+=vec3(.13,.22,.24)*max(0.,rings)*.045;
      // Continuous optics replace horizontal slices and hard geometric rays.
      vec2 underPoint=vec2(p.x,max(0.,delta)/max(1.,u_size.y-line)*u_size.y);
      underPoint+=swell(uv*vec2(3.4,3.),u_time*.65)*vec2(1.4,1.1)*immerse+u_pointer*vec2(5.,3.)*immerse;
      vec2 underUV=(underPoint-u_underRect.xy)/u_underRect.zw;
      vec3 submerged=texture2D(u_underwater,clamp(underUV,.001,.999)).rgb;
      float beamX=uv.x+uv.y*.32+sin(u_time*.065)*.025;
      float beams=exp(-pow((beamX-.88)/.15,2.))*.56+exp(-pow((beamX-.63)/.065,2.))*.19;
      float haze=(noise(uv*vec2(3.2,2.1)+u_time*.025)-.5)*.014;
      submerged+=vec3(.028,.051,.06)*beams*(1.-uv.y*.68)+vec3(haze*.4,haze,haze);
      submerged+=vec3(.026,.061,.066)*caustic(uv*vec2(14.,10.))*smoothstep(.64,1.,uv.y)*.3;
      submerged*=1.-smoothstep(.5,1.,u_dive)*.08-u_depth*.07;
      float reveal=immerse*(.56+.44*smoothstep(0.,.36,depth));
      vec3 water=mix(surface,submerged,reveal);
      vec3 color=mix(sky,water,below);
      // A curved meniscus has a dark underside and scattered silver highlights.
      float gate=smoothstep(.025,.18,u_dive)*(1.-smoothstep(.83,1.,u_dive));
      float rim=exp(-pow((delta+.9)/1.55,2.)),body=exp(-pow((delta-3.4)/5.5,2.));
      color*=1.-body*gate*.27;
      float glimmer=.45+.55*noise(vec2(uv.x*33.+u_time*.22,u_time*.12));
      color+=vec3(.44,.63,.67)*rim*gate*glimmer*.26;
      // Fish are behind the metal and inherit the surrounding water's colour.
      vec4 fish=texture2D(u_wildlife,uv);
      vec3 fishColor=mix(water,fish.rgb*vec3(.58,.78,.85),.75);
      color=mix(color,fishColor,fish.a*below*smoothstep(.18,.65,u_dive));
      vec4 logo=mark(p,below,depth);
      color=mix(color,logo.rgb,logo.a);
      color+=vec3(.11,.28,.34)*rim*logo.a*gate*.18;
      float vignette=smoothstep(.28,.85,length((uv-.5)*vec2(.9,.75)));
      color*=1.-vignette*mix(.06,.15,immerse);
      float grain=(hash(floor(p)+mod(floor(u_time*12.),97.))-.5)/370.;
      gl_FragColor=vec4(clamp(color+grain,0.,1.),1.);
    }
  `;
  function crop(im){
    const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
    const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);
    const data=x.getImageData(0,0,c.width,c.height).data;
    let left=c.width,top=c.height,right=0,bottom=0;
    for(let y=0;y<c.height;y+=2)for(let k=0;k<c.width;k+=2)if(data[(y*c.width+k)*4+3]>40){left=Math.min(left,k);top=Math.min(top,y);right=Math.max(right,k);bottom=Math.max(bottom,y);}
    if(right<=left||bottom<=top)return c;
    const out=document.createElement('canvas');out.width=right-left+8;out.height=bottom-top+8;
    out.getContext('2d').drawImage(c,left-4,top-4,out.width,out.height,0,0,out.width,out.height);return out;
  }
  function shader(type,source){
    const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(message);}return s;
  }
  let fishTexture, underwaterTexture;
  function texture(im,unit,name){
    gl.activeTexture(gl.TEXTURE0+unit);const tx=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tx);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);gl.uniform1i(gl.getUniformLocation(program,name),unit);return tx;
  }
  function initializeGL(){
    const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);
    program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);
    const vertices=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertices);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const p=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
    ['size','pointer','backRect','underRect','logoRect','time','dive','line','contact','logoOpacity','depth'].forEach(n=>uniforms[n]=gl.getUniformLocation(program,'u_'+n));
    texture(background,0,'u_backdrop');underwaterTexture=texture(underwater,1,'u_underwater');texture(logo,2,'u_logo');fishTexture=texture(wildlife.canvas,3,'u_wildlife');
  }
  function schedule(){
    if(ready&&!raf&&!stopped&&!document.hidden&&(!isMotionPaused()||document.body.classList.contains('at-surface')))raf=requestAnimationFrame(render);
  }
  function updateTarget(){travel=Math.max(1,section.offsetHeight-stage.offsetHeight);target=window.TDCJourney?TDCJourney.target():clamp((scrollY-section.offsetTop)/travel);schedule();}
  function resize(){
    W=stage.clientWidth;H=stage.clientHeight;
    const budget=W<650?1550000:2300000;
    ratio=Math.max(.8,Math.min(devicePixelRatio||1,2,Math.sqrt(budget/(W*H)))*quality);
    const width=Math.round(W*ratio),height=Math.round(H*ratio);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}
    if(overlay){overlay.width=Math.round(W*Math.min(ratio,1.5));overlay.height=Math.round(H*Math.min(ratio,1.5));}
    wildlife.resize(W,H);updateTarget();schedule();
  }
  function moveTo(p){window.scrollTo({top:section.offsetTop+clamp(p)*travel,behavior:isMotionPaused()?'instant':'smooth'});}
  function cover(im,zoom){const s=Math.max(W/im.naturalWidth,H/im.naturalHeight)*zoom,w=im.naturalWidth*s,h=im.naturalHeight*s;return[(W-w)/2,(H-h)/2,w,h];}
  function logoRect(d){
    const drift=!isMotionPaused()&&window.TDCJourney?TDCJourney.state.drift:0;
    const scale=Math.min(W*.82/logo.width,H*.455/logo.height)*mix(1,.84,d)*mix(1,.72,drift),w=logo.width*scale,h=logo.height*scale;
    return[W*(.5+drift*.23)+pointer[0]*2*(1-d)-w/2,H*(.355+d*.345)-h/2,w,h];
  }
  function sprite(bubble){
    const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
    const g=x.createRadialGradient(32,32,bubble?16:0,32,32,30);
    g.addColorStop(0,bubble?'#8cc9d400':'#d4f1f4');g.addColorStop(bubble?.72:.16,bubble?'#8cc9d411':'#bfe8ec99');g.addColorStop(bubble?.95:1,bubble?'#ceeff14a':'#bfe8ec00');
    if(bubble)g.addColorStop(1,'#ceeff100');x.fillStyle=g;x.beginPath();x.arc(32,32,30,0,Math.PI*2);x.fill();
    if(bubble){x.strokeStyle='#e8f8f3a0';x.lineWidth=1.6;x.beginPath();x.arc(31,32,26,3.7,4.6);x.stroke();}return c;
  }
  const dust=sprite(false),bubble=sprite(true);
  function particles(d,time,line,rect,energy){
    const scale=overlay.width/W;ink.setTransform(scale,0,0,scale,0,0);ink.clearRect(0,0,W,H);
    const amount=smooth(.05,.6,d);if(!amount)return;
    ink.save();ink.beginPath();ink.rect(0,Math.max(0,line+8),W,H);ink.clip();
    const count=W<650?32:motes.length;
    for(let i=0;i<count;i++){
      const b=motes[i],z=.3+b.z*1.4,f=(b.y+time*b.v+d*.17*z)%1;
      const y=(1.12-f*1.3)*H,x=b.x*W+Math.sin(time*.13+i*2)*7*z+pointer[0]*z*4,r=(.6+b.z*1.7)*Math.min(W/800+.5,1.5);
      ink.globalAlpha=amount*(.08+b.z*.1)*smooth(0,.12,f)*(1-smooth(.85,1,f));ink.drawImage(dust,x-r*2,y-r*2,r*4,r*4);
    }
    const trail=smooth(.1,.3,d)*(1-smooth(.72,.99,d));
    bubbles.forEach((b,i)=>{
      const cycle=(b.y+time*(.025+b.r*.025))%1,y=rect[1]+rect[3]*.72-cycle*H*.65;
      const x=W*.5+(b.x-.5)*rect[2]*.67+Math.sin(time*.75+i)*(3+b.r*4),r=.85+b.r*2.4;
      ink.globalAlpha=trail*(.22+energy*.12)*Math.sin(cycle*Math.PI);ink.drawImage(bubble,x-r,y-r,r*2,r*2);
    });ink.restore();ink.globalAlpha=1;
  }
  function updateUI(){
    if(Math.abs(progress-lastUI)>.0001){if(window.TDCJourney)TDCJourney.render(progress);lastUI=progress;}
  }
  function render(now){
    raf=0;
    const paused=isMotionPaused();
    if(!ready||stopped||document.hidden||(paused&&!document.body.classList.contains('at-surface')))return;
    const elapsed=lastTime?now-lastTime:16.667;lastTime=now;const dt=paused?0:Math.min(elapsed,48)/16.667;
    if(!paused)clock+=Math.min(elapsed,48)*.001;
    const before=progress;progress=paused?0:mix(progress,target,1-Math.pow(.83,dt));if(Math.abs(progress-target)<.000025)progress=target;
    pointer[0]=mix(pointer[0],pointerTarget[0],.065*dt);pointer[1]=mix(pointer[1],pointerTarget[1],.065*dt);
    const d=smooth(.02,.98,progress),time=clock,line=H*(.65-d*.85),rect=logoRect(d),energy=clamp(Math.abs(progress-before)*50);
    const s=Math.max(W/background.naturalWidth,H/background.naturalHeight,H*.65/(background.naturalHeight*.633))*(1+Math.sin(d*Math.PI)*.025);
    const bw=background.naturalWidth*s,bh=background.naturalHeight*s;
    wildlife.update(paused?0:Math.min(elapsed,48)*.001,d,time);
    gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,fishTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,wildlife.canvas);
    gl.uniform2f(uniforms.size,W,H);gl.uniform2f(uniforms.pointer,pointer[0],pointer[1]);
    gl.uniform4f(uniforms.backRect,(W-bw)/2+pointer[0]*2,line-bh*.633,bw,bh);
    const depth=!isMotionPaused()&&window.TDCJourney?TDCJourney.state.depth:0,opacity=!isMotionPaused()&&window.TDCJourney?TDCJourney.state.logoOpacity:1;
    gl.uniform4fv(uniforms.underRect,cover(underwater,1.015+d*.025+depth*.035));gl.uniform4fv(uniforms.logoRect,rect);
    gl.uniform1f(uniforms.time,time);gl.uniform1f(uniforms.dive,d);gl.uniform1f(uniforms.line,line);
    gl.uniform1f(uniforms.logoOpacity,opacity);gl.uniform1f(uniforms.depth,depth);
    const contact=smooth(-H*.05,H*.04,rect[1]+rect[3]-line)*(1-smooth(H*.02,H*.18,rect[1]-line));gl.uniform1f(uniforms.contact,contact);
    gl.drawArrays(gl.TRIANGLES,0,6);particles(d,time,line,rect,energy);updateUI();
    if(!paused&&elapsed>30&&elapsed<80)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);
    if(slowFrames>75&&quality>.68){quality*=.87;slowFrames=0;resize();}
    if(canvas.dataset.renderer!=='webgl'){
      canvas.dataset.renderer='webgl';
      document.body.dataset.ready='true';
    }
    if(!paused)schedule();
  }
  function fallback(reason){
    if(stopped)return;stopped=true;if(raf)cancelAnimationFrame(raf);events.abort();if(overlay)overlay.remove();
    delete document.body.dataset.ready;
    const replacement=canvas.cloneNode(false);delete replacement.dataset.renderer;canvas.replaceWith(replacement);canvas=replacement;
    console.info('Using the compatible lake renderer.',reason||'');
    import('./fallback.js').catch(console.error);
  }
  async function init(){
    try{
      gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'high-performance',premultipliedAlpha:false});
      if(!gl){fallback();return;}
      [background,underwater,logo]=await Promise.all([loadImage('assets/lake-dusk.png'),loadImage(underwaterSource()),loadImage('assets/logo.png')]);
      logo=crop(logo);wildlife=new TDCWildlife();await wildlife.ready;initializeGL();
      overlay=document.createElement('canvas');overlay.className='atmosphere';overlay.setAttribute('aria-hidden','true');canvas.after(overlay);ink=overlay.getContext('2d');
      const options={passive:true,signal:events.signal};
      window.addEventListener('scroll',updateTarget,options);window.addEventListener('resize',resize,options);
      window.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')pointerTarget=[(e.clientX/W-.5)*2,(e.clientY/H-.5)*2];},options);
      window.addEventListener('pointerleave',()=>{pointerTarget=[0,0];},options);
      motionChange.addEventListener('change',()=>{lastTime=0;progress=target;schedule();},{signal:events.signal});
      document.addEventListener('visibilitychange',()=>{if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;}else{lastTime=0;schedule();}},{signal:events.signal});
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback('Graphics context lost');},{signal:events.signal});
      watchUnderwater(underwater, image => {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, underwaterTexture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        underwater=image;
        schedule();
      }, events.signal);
      ready=true;resize();schedule();
    }catch(error){fallback(error.message);}
  }
  init();
})();

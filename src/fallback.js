import { retryableLoad, waterBackdrop } from './loading.js';
import { loadImage, underwaterSource, watchUnderwater } from './artwork.js';
import { isMotionPaused, motionChange } from './motion.js';

(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', {alpha:false});
  const stage = document.getElementById('stage');
  const section = document.getElementById('experience');
  let W=1, H=1, dpr=1, travel=1, target=0, progress=0, ready=false;
  let background, reflection, underwater, wildlife, logo, box, lastTime=0, clock=0;
  const wetLogo=document.createElement('canvas'),wet=wetLogo.getContext('2d');
  const waterLayer=document.createElement('canvas'),water=waterLayer.getContext('2d');
  let frame=0, visible=true;
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
  const mix=(a,b,t)=>a+(b-a)*t;
  const particles=Array.from({length:24},(_,i)=>({x:Math.sin(i*43.13)*.5+.5,speed:.025+(i%7)*.005,phase:(i*.61803398875)%1,size:.8+(i%4)*.55}));
  function bounds(im){
    const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
    const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);
    const data=x.getImageData(0,0,c.width,c.height).data;
    let minX=c.width,minY=c.height,maxX=0,maxY=0;
    for(let y=0;y<c.height;y+=2){for(let k=0;k<c.width;k+=2){if(data[(y*c.width+k)*4+3]>20){minX=Math.min(minX,k);minY=Math.min(minY,y);maxX=Math.max(maxX,k);maxY=Math.max(maxY,y);}}}
    if(maxX<=minX||maxY<=minY)return {x:0,y:0,w:c.width,h:c.height};
    return {x:Math.max(0,minX-4),y:Math.max(0,minY-4),w:Math.min(c.width-minX+4,maxX-minX+8),h:Math.min(c.height-minY+4,maxY-minY+8)};
  }
  const loadUnderwater=retryableLoad(
    ()=>loadImage(underwaterSource()),
    image=>{
      underwater=image;
      watchUnderwater(image,image=>{underwater=image;schedule();});
      schedule();
    },
  );
  const loadWildlife=retryableLoad(()=>wildlife.load(),()=>schedule());
  function prepareUnderwater(){
    if(isMotionPaused())return;
    loadUnderwater();
    loadWildlife();
  }
  function schedule(){
    if(ready&&!frame&&visible&&(!isMotionPaused()||document.body.classList.contains('at-surface')))frame=requestAnimationFrame(render);
  }
  function updateTarget(){travel=Math.max(1,section.offsetHeight-stage.offsetHeight);target=window.TDCJourney?TDCJourney.target():clamp((window.scrollY-section.offsetTop)/travel);schedule();}
  function resize(){
    W=stage.clientWidth;H=stage.clientHeight;dpr=Math.min(window.devicePixelRatio||1,1.75,Math.sqrt(2200000/(W*H)));
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);updateTarget();
    wetLogo.width=canvas.width;wetLogo.height=canvas.height;waterLayer.width=canvas.width;waterLayer.height=canvas.height;
    if(wildlife)wildlife.resize(W,H);
  }
  window.addEventListener('scroll',updateTarget,{passive:true});
  window.addEventListener('resize',resize,{passive:true});
  motionChange.addEventListener('change',()=>{lastTime=0;progress=target;schedule();});
  document.addEventListener('visibilitychange',()=>{visible=!document.hidden;if(visible){lastTime=0;schedule();}});
  function waveY(x,line,t,descent){const a=mix(.55,5.3,smooth(.035,.46,descent));return line+a*(Math.sin(x/W*7.7+t*.47)*.56+Math.sin(x/W*19.3-t*.66)*.29+Math.sin(x/W*38.1+t*.31)*.12);}
  function waterClip(line,t,d,below){
    ctx.beginPath();ctx.moveTo(0,below?H:0);ctx.lineTo(0,waveY(0,line,t,d));
    for(let x=0;x<=W+16;x+=16)ctx.lineTo(x,waveY(x,line,t,d));
    ctx.lineTo(W,below?H:0);ctx.closePath();ctx.clip();
  }
  function prepareReflection(im){
    const shore=Math.round(im.naturalHeight*.633);
    const image=document.createElement('canvas');image.width=im.naturalWidth;image.height=im.naturalHeight-shore;
    const x=image.getContext('2d');
    x.drawImage(im,0,shore,image.width,image.height,0,0,image.width,image.height);
    const fade=x.createLinearGradient(0,0,0,image.height);
    fade.addColorStop(0,'#fff');fade.addColorStop(.72,'#fff');fade.addColorStop(1,'rgba(255,255,255,0)');
    x.globalCompositeOperation='destination-in';x.fillStyle=fade;x.fillRect(0,0,image.width,image.height);
    return {image,shore};
  }
  function drawBackdrop(line,t,d){
    const lake=ctx.createLinearGradient(0,Math.max(0,line),0,H);
    lake.addColorStop(0,'#07141c');lake.addColorStop(1,'#071e2e');
    ctx.fillStyle=lake;ctx.fillRect(0,0,W,H);
    const scale=Math.max(W/background.naturalWidth,H/background.naturalHeight,H*.65/reflection.shore);
    const dw=background.naturalWidth*scale,dh=background.naturalHeight*scale;
    const x=(W-dw)/2,y=line-reflection.shore*scale;
    ctx.save();waterClip(line,t,d,false);ctx.drawImage(background,x,y,dw,dh);ctx.restore();
    // Pull the reflected peaks toward the shoreline before the camera submerges.
    const retreat=mix(1,.08,smooth(0,.5,d));
    const opacity=1-smooth(.06,.62,d);
    if(opacity>0&&line<H){
      const height=reflection.image.height*scale*retreat;
      water.setTransform(dpr,0,0,dpr,0,0);water.globalCompositeOperation='source-over';water.clearRect(0,0,W,H);
      for(let y=0;y<height;y+=2){
        const h=Math.min(2,height-y),sy=y/height*reflection.image.height,sh=h/height*reflection.image.height;
        const depth=y/height,bend=(Math.sin(depth*22+t*.7)+Math.sin(depth*43-t*.4)*.35)*depth*1.6;
        water.drawImage(reflection.image,0,sy,reflection.image.width,sh,x+bend,line+y,dw,h+.15/dpr);
      }
      ctx.save();waterClip(line,t,d,true);ctx.globalAlpha=opacity;
      ctx.drawImage(waterLayer,0,0,W,H);
      ctx.restore();
    }
  }
  function drawWater(line,t,d){
    ctx.save();waterClip(line,t,d,true);
    const amount=smooth(.015,.67,d);
    if(amount>0){
      const depth=!isMotionPaused()&&window.TDCJourney?TDCJourney.state.depth:0;
      const s=Math.max(W/(underwater.naturalWidth||underwater.width),H/(underwater.naturalHeight||underwater.height))*(1.015+d*.025+depth*.035);
      const w=(underwater.naturalWidth||underwater.width)*s,h=(underwater.naturalHeight||underwater.height)*s,compression=(H-line)/H;
      water.setTransform(dpr,0,0,dpr,0,0);water.globalCompositeOperation='source-over';water.clearRect(0,0,W,H);
      water.drawImage(underwater,(W-w)/2+Math.sin(t*.17)*1.2,line+(H-h)/2*compression,w,h*compression);
      const mask=water.createLinearGradient(0,line,0,H);mask.addColorStop(0,'rgba(255,255,255,.56)');mask.addColorStop(.36,'#fff');mask.addColorStop(1,'#fff');
      water.globalCompositeOperation='destination-in';water.fillStyle=mask;water.fillRect(0,Math.min(0,line),W,H+Math.abs(line));
      ctx.globalAlpha=amount;ctx.drawImage(waterLayer,0,0,W,H);ctx.globalAlpha=1;
    }
    ctx.restore();
  }
  function drawWildlife(line,t,d,dt){
    wildlife.update(dt,d,t);
    ctx.save();waterClip(line,t,d,true);ctx.globalAlpha=smooth(.18,.65,d)*.84;ctx.drawImage(wildlife.canvas,0,0,W,H);ctx.restore();
  }
  function logoRect(d){
    const drift=!isMotionPaused()&&window.TDCJourney?TDCJourney.state.drift:0;
    const scale=Math.min(W*.82/box.w,H*.455/box.h)*mix(1,.72,drift);
    const w=box.w*scale*mix(1,.84,d),h=box.h*scale*mix(1,.84,d);
    const cy=H*(.355+d*.345),cx=W*(.5+drift*.23)+Math.sin(d*Math.PI)*W*.008;
    return {x:cx-w/2,y:cy-h/2,w,h};
  }
  function drawLogo(r,line,t,d){
    const opacity=!isMotionPaused()&&window.TDCJourney?TDCJourney.state.logoOpacity:1;if(opacity<.001)return;
    ctx.save();waterClip(line,t,d,false);
    ctx.globalAlpha=opacity;
    ctx.drawImage(logo,box.x,box.y,box.w,box.h,r.x,r.y,r.w,r.h);ctx.restore();
    ctx.save();waterClip(line,t,d,true);
    wet.setTransform(dpr,0,0,dpr,0,0);wet.globalCompositeOperation='source-over';wet.clearRect(0,0,W,H);
    const strip=1/dpr;
    for(let y=0;y<r.h;y+=strip){
      if(r.y+y+strip<line-5)continue;
      const h=Math.min(strip,r.h-y),sy=box.y+(y/r.h)*box.h,sh=(h/r.h)*box.h;
      const depth=clamp((r.y+y-line)/H);
      const bend=Math.sin((r.y+y)*.026+t*.73)*(.8+depth*4)+Math.sin((r.y+y)*.061-t*.4)*.65;
      wet.drawImage(logo,box.x,sy,box.w,sh,r.x+bend,r.y+y,r.w,h+.2/dpr);
    }
    wet.globalCompositeOperation='source-atop';wet.fillStyle='rgba(12,96,145,.12)';wet.fillRect(0,0,W,H);
    ctx.globalAlpha=mix(.99,.9,d)*opacity;ctx.drawImage(wetLogo,0,0,W,H);
    ctx.restore();
  }
  function drawSurface(line,t,d,r){
    if(line<-15||line>H+15)return;
    const intensity=smooth(.03,.16,d)*(1-smooth(.66,.94,d));
    ctx.save();ctx.globalCompositeOperation='screen';
    ctx.lineWidth=1.1;ctx.strokeStyle=`rgba(195,229,233,${.04+intensity*.19})`;ctx.beginPath();
    for(let x=0;x<=W+8;x+=8){const y=waveY(x,line,t,d);if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
    const center=W*.5;
    for(let j=0;j<3;j++){
      ctx.strokeStyle=`rgba(243,244,220,${intensity*(.09-j*.02)})`;ctx.lineWidth=.7;
      ctx.beginPath();ctx.ellipse(center,line+3+j*4,Math.min(W*.36,r.w*.6)+j*28,3+j*1.9,0,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
  }
  function drawBubbles(line,t,d,r){
    const amount=smooth(.08,.35,d)*(1-smooth(.91,1.1,d));if(amount<.005)return;
    ctx.save();waterClip(line,t,d,true);
    particles.forEach((b,i)=>{
      const cycle=(b.phase+t*b.speed)%1;
      const y=r.y+r.h*.67-cycle*H*.56;
      if(y<line+8)return;
      const x=W*.5+(b.x-.5)*Math.min(r.w*.8,W*.54)+Math.sin(t*.7+i*2)*9;
      const a=amount*.3*Math.sin(cycle*Math.PI);
      ctx.strokeStyle=`rgba(205,246,255,${a})`;ctx.lineWidth=.65;ctx.beginPath();ctx.arc(x,y,b.size*(1+cycle*.6),0,Math.PI*2);ctx.stroke();
      ctx.fillStyle=`rgba(238,254,255,${a*.8})`;ctx.beginPath();ctx.arc(x-b.size*.25,y-b.size*.3,.5,0,Math.PI*2);ctx.fill();
    });ctx.restore();
  }
  function updateUI(){
    if(window.TDCJourney)TDCJourney.render(progress);
  }
  function render(now){
    frame=0;
    const paused=isMotionPaused();
    if(!visible||!ready||(paused&&!document.body.classList.contains('at-surface')))return;
    const elapsed=lastTime?Math.min(now-lastTime,48):16.667;lastTime=now;const dt=paused?0:elapsed/16.667;
    if(!paused)clock+=elapsed*.001;
    progress=paused?0:mix(progress,target,1-Math.pow(.83,dt));
    if(Math.abs(progress-target)<.00003)progress=target;
    const d=smooth(.02,.98,progress),t=clock;
    const line=H*(.65-d*.85),r=logoRect(d);
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    drawBackdrop(line,t,d);drawWater(line,t,d);drawWildlife(line,t,d,paused?0:elapsed*.001);drawLogo(r,line,t,d);drawSurface(line,t,d,r);drawBubbles(line,t,d,r);updateUI();
    if(canvas.dataset.renderer!=='canvas'){
      canvas.dataset.renderer='canvas';
      document.body.dataset.ready='true';
    }
    prepareUnderwater();
    if(!paused)schedule();
  }
  async function init(){
    try{
      if(!ctx)throw new Error('Canvas 2D is unavailable');
      resize();
      [background,logo]=await Promise.all([loadImage('assets/lake-dusk.webp'),loadImage('assets/logo.webp')]);
      underwater=waterBackdrop();
      wildlife=new TDCWildlife({defer:true});wildlife.resize(W,H);
      reflection=prepareReflection(background);box=bounds(logo);
      ready=true;schedule();
    }catch(error){console.error(error);}
  }
  init();
})();

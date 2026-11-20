import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { loadPage, mediaQuery } from './browser.js';

const artwork=vi.hoisted(()=>({loadImage:vi.fn(),underwaterSource:vi.fn(),watchUnderwater:vi.fn()}));
vi.mock('../src/artwork.js',()=>artwork);

let frames, gl, ctx, images, listeners, wildlife;
const image={naturalWidth:100,naturalHeight:60,width:100,height:60};
function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
async function frame(timestamp=16){
  const callbacks=[...frames.values()];
  frames.clear();
  callbacks.forEach(callback=>callback(timestamp));
  await new Promise(resolve=>setTimeout(resolve,0));
}
beforeEach(()=>{
  vi.resetModules();
  loadPage();
  mediaQuery();
  document.body.classList.add('at-surface');
  listeners=new AbortController();
  for(const target of [window,document]){
    const add=target.addEventListener.bind(target);
    vi.spyOn(target,'addEventListener').mockImplementation((type,listener,options={})=>{
      add(type,listener,{...options,signal:listeners.signal});
    });
  }
  Object.defineProperty(document,'hidden',{configurable:true,value:false});
  Object.defineProperty(document.querySelector('#stage'),'clientWidth',{configurable:true,value:1440});
  Object.defineProperty(document.querySelector('#stage'),'clientHeight',{configurable:true,value:900});
  frames=new Map();
  let frameId=0;
  vi.stubGlobal('requestAnimationFrame',vi.fn(callback=>{frames.set(++frameId,callback);return frameId;}));
  vi.stubGlobal('cancelAnimationFrame',vi.fn(id=>frames.delete(id)));
  const gradient={addColorStop:vi.fn()};
  ctx=new Proxy({
    getImageData:()=>({data:new Uint8ClampedArray(100*60*4)}),
    createRadialGradient:()=>gradient,createLinearGradient:()=>gradient,
  },{get:(target,key)=>target[key]??(target[key]=vi.fn())});
  gl=new Proxy({
    getShaderParameter:()=>true,getProgramParameter:()=>true,
    createShader:()=>({}),createProgram:()=>({}),createTexture:()=>({}),
    getAttribLocation:()=>0,getUniformLocation:()=>({}),
  },{get:(target,key)=>target[key]??(target[key]=vi.fn())});
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(type=>type==='webgl'?gl:ctx);
  images={lake:deferred(),logo:deferred(),underwater:deferred()};
  artwork.loadImage.mockReset().mockImplementation(path=>{
    if(path.includes('lake'))return images.lake.promise;
    if(path.includes('logo'))return images.logo.promise;
    return images.underwater.promise;
  });
  artwork.underwaterSource.mockReturnValue('assets/underwater-reef.webp');
  artwork.watchUnderwater.mockReset();
  const fishReady=deferred();
  wildlife={
    canvas:document.createElement('canvas'),swimmers:[],
    resize:vi.fn(),update:vi.fn(),load:vi.fn(()=>fishReady.promise),
  };
  vi.stubGlobal('TDCWildlife',class {constructor(){return wildlife;}});
  vi.spyOn(console,'warn').mockImplementation(()=>{});
  vi.spyOn(console,'error').mockImplementation(()=>{});
  vi.spyOn(console,'info').mockImplementation(()=>{});
});
afterEach(()=>{listeners.abort();delete window.TDCJourney;});

test.each(['webgl','canvas'])('%s renders the opening before optional artwork finishes',async renderer=>{
  await import(renderer==='webgl'?'../src/app.js':'../src/fallback.js');
  expect(artwork.loadImage).toHaveBeenCalledTimes(2);
  images.lake.resolve(image);
  images.logo.resolve(image);
  await vi.waitFor(()=>expect(frames.size).toBeGreaterThan(0));
  await frame();
  expect(document.body.dataset.ready).toBe('true');
  expect(document.querySelector('#scene').dataset.renderer).toBe(renderer);
  if(renderer==='webgl'){
    const uploaded=gl.texImage2D.mock.calls.map(call=>call.at(-1));
    expect(uploaded[1]).toBeInstanceOf(HTMLCanvasElement);
    expect(uploaded[1].width).toBe(2);
    expect(uploaded[1].height).toBe(2);
    expect(uploaded[1]).not.toBe(image);
  }
  expect(wildlife.load).toHaveBeenCalledOnce();
  expect(artwork.loadImage).toHaveBeenCalledWith('assets/underwater-reef.webp');
  images.underwater.reject(new Error('Optional artwork failed'));
  await vi.waitFor(()=>expect(console.warn).toHaveBeenCalled());
  expect(document.body.dataset.ready).toBe('true');
});

test('the opening skips per-frame wildlife texture uploads',async()=>{
  await import('../src/app.js');
  images.lake.resolve(image);images.logo.resolve(image);
  await vi.waitFor(()=>expect(frames.size).toBeGreaterThan(0));
  await frame();
  gl.texImage2D.mockClear();
  await frame();
  expect(gl.texImage2D).not.toHaveBeenCalled();
  expect(gl.texSubImage2D).not.toHaveBeenCalled();
  expect(wildlife.update).not.toHaveBeenCalled();
});

test('unavailable WebGL switches to Canvas without blocking content',async()=>{
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(type=>type==='webgl'?null:ctx);
  await import('../src/app.js');
  await vi.waitFor(()=>expect(artwork.loadImage).toHaveBeenCalledWith('assets/lake-dusk.webp'));
  images.lake.resolve(image);images.logo.resolve(image);
  await vi.waitFor(()=>expect(frames.size).toBeGreaterThan(0));
  await frame();
  expect(document.querySelector('#scene').dataset.renderer).toBe('canvas');
  expect(document.body.dataset.ready).toBe('true');
});

test('failure of both rendering contexts leaves the static page usable',async()=>{
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(type=>type==='webgl'||type==='2d'?null:ctx);
  await import('../src/app.js');
  await vi.waitFor(()=>expect(console.error).toHaveBeenCalled());
  expect(document.body.dataset.ready).toBeUndefined();
  expect(document.querySelector('.loading')).toBeNull();
  expect(document.querySelector('#enquiry-form')).not.toBeNull();
});


test.each([40, 90, 150])('sustained %i ms frames reduce rendering resolution', async elapsed => {
  await import('../src/app.js');
  images.lake.resolve(image);
  images.logo.resolve(image);
  await vi.waitFor(() => expect(frames.size).toBeGreaterThan(0));
  await frame(16);
  const canvas = document.querySelector('#scene');
  const originalWidth = canvas.width;
  for (let i = 1; i <= 78; i++) await frame(16 + i * elapsed);
  expect(canvas.width).toBeLessThan(originalWidth);
  expect(document.body.dataset.ready).toBe('true');
});

test('an isolated long frame does not reduce quality', async () => {
  await import('../src/app.js');
  images.lake.resolve(image);
  images.logo.resolve(image);
  await vi.waitFor(() => expect(frames.size).toBeGreaterThan(0));
  await frame(16);
  const canvas = document.querySelector('#scene');
  const originalWidth = canvas.width;
  await frame(2000);
  await frame(2016);
  expect(canvas.width).toBe(originalWidth);
});

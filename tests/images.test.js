import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { loadImage } from '../src/images.js';

let image;
beforeEach(()=>{
  vi.useFakeTimers();
  vi.stubGlobal('Image', class {
    constructor(){image=this;}
    set src(value){this.source=value;}
    removeAttribute=vi.fn();
  });
});
afterEach(()=>vi.useRealTimers());

test('stalled requests time out, release handlers and stop the image request', async ()=>{
  const result=loadImage('reef.webp');
  const failed=expect(result).rejects.toThrow('timed out: reef.webp');
  await vi.advanceTimersByTimeAsync(15000);
  await failed;
  expect(image.removeAttribute).toHaveBeenCalledWith('src');
  expect(image.onload).toBeNull();
  expect(image.onerror).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

test('successful loads cancel the timeout and resolve only once', async ()=>{
  const result=loadImage('reef.webp');
  const lateError=image.onerror;
  const loaded=image;
  image.onload();
  lateError();
  await expect(result).resolves.toBe(loaded);
  expect(vi.getTimerCount()).toBe(0);
  expect(loaded.removeAttribute).not.toHaveBeenCalled();
});

test('failed requests reject with their path and cancel the timeout', async ()=>{
  const result=loadImage('reef.webp');
  image.onerror();
  await expect(result).rejects.toThrow('Unable to load reef.webp');
  expect(vi.getTimerCount()).toBe(0);
});

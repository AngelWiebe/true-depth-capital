import { afterEach, expect, test, vi } from 'vitest';
import { retryableLoad } from '../src/loading.js';

afterEach(()=>vi.useRealTimers());
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};

test('failed loads retry after a delay, preserve success, and avoid duplicate requests',async()=>{
  vi.useFakeTimers();
  vi.spyOn(console,'warn').mockImplementation(()=>{});
  const load=vi.fn().mockRejectedValueOnce(Error('Offline')).mockResolvedValue('reef');
  const apply=vi.fn();
  const start=retryableLoad(load,apply);
  start();start();
  await flush();
  expect(load).toHaveBeenCalledTimes(1);
  expect(apply).not.toHaveBeenCalled();
  start();
  expect(load).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(5000);
  start();start();
  await flush();
  expect(load).toHaveBeenCalledTimes(2);
  expect(apply).toHaveBeenCalledExactlyOnceWith('reef');
  start();
  expect(load).toHaveBeenCalledTimes(2);
});

test('replaced renderers cannot apply a late response or retry',async()=>{
  let finish;
  const load=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
  const apply=vi.fn();
  const controller=new AbortController();
  const start=retryableLoad(load,apply,controller.signal);
  start();await flush();
  controller.abort();
  finish('reef');
  await flush();
  start();
  expect(apply).not.toHaveBeenCalled();
  expect(load).toHaveBeenCalledTimes(1);
});

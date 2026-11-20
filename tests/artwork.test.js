import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mediaQuery } from './browser.js';

const portrait = 'assets/underwater-portrait.webp';
const reef = 'assets/underwater-reef.webp';
let media, requests, artwork, lifecycle;

beforeEach(async () => {
  vi.resetModules();
  lifecycle = new AbortController();
  media = mediaQuery(true);
  requests = [];
  vi.stubGlobal('Image', class {
    set src(value) { this.source = value; requests.push(this); }
    getAttribute() { return this.source; }
  });
  artwork = await import('../src/artwork.js');
});

afterEach(() => { lifecycle.abort(); vi.useRealTimers(); });

const initial = () => ({ getAttribute: () => portrait });

test('selects the artwork for the current viewport', () => {
  expect(artwork.underwaterSource()).toBe(portrait);
  media.change(false);
  expect(artwork.underwaterSource()).toBe(reef);
});

test('ignores a stale load after rapid rotation and reuses cached images', async () => {
  const changed = vi.fn();
  artwork.watchUnderwater(initial(), changed, lifecycle.signal);
  media.change(false);
  media.change(true);
  requests[0].onload();
  await vi.waitFor(() => expect(requests).toHaveLength(1));
  expect(changed).not.toHaveBeenCalled();
  media.change(false);
  await vi.waitFor(() => expect(changed).toHaveBeenCalledWith(requests[0]));
  media.change(true);
  await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(2));
  expect(requests).toHaveLength(1);
});

test('keeps the current crop after failure and retries on a later rotation', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const changed = vi.fn();
  artwork.watchUnderwater(initial(), changed, lifecycle.signal);
  media.change(false);
  requests[0].onerror();
  await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
  expect(changed).not.toHaveBeenCalled();
  media.change(true);
  media.change(false);
  expect(requests).toHaveLength(2);
  requests[1].onload();
  await vi.waitFor(() => expect(changed).toHaveBeenCalledWith(requests[1]));
});

test('a replaced renderer cannot receive an outstanding image load', async () => {
  const controller = new AbortController();
  const changed = vi.fn();
  artwork.watchUnderwater(initial(), changed, controller.signal);
  media.change(false);
  controller.abort();
  requests[0].onload();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(changed).not.toHaveBeenCalled();
});

test('image loading rejects with the asset path', async () => {
  const loading = artwork.loadImage(reef);
  requests[0].onerror();
  await expect(loading).rejects.toThrow(reef);
});


test('a failed rotation retries automatically without another viewport change', async () => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const changed = vi.fn();
  artwork.watchUnderwater(initial(), changed, lifecycle.signal);
  media.change(false);
  requests[0].onerror();
  await vi.advanceTimersByTimeAsync(0);
  expect(changed).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(4999);
  expect(requests).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(requests).toHaveLength(2);
  requests[1].onload();
  await vi.advanceTimersByTimeAsync(0);
  expect(changed).toHaveBeenCalledExactlyOnceWith(requests[1]);
});

test('returning online retries immediately and cancels the scheduled retry', async () => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const changed = vi.fn();
  artwork.watchUnderwater(initial(), changed, lifecycle.signal);
  media.change(false);
  requests[0].onerror();
  await vi.advanceTimersByTimeAsync(0);
  window.dispatchEvent(new Event('online'));
  expect(requests).toHaveLength(2);
  requests[1].onload();
  await vi.advanceTimersByTimeAsync(6000);
  expect(requests).toHaveLength(2);
  expect(changed).toHaveBeenCalledExactlyOnceWith(requests[1]);
});

test('aborting a renderer cancels pending rotation retries', async () => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  artwork.watchUnderwater(initial(), vi.fn(), lifecycle.signal);
  media.change(false);
  requests[0].onerror();
  await vi.advanceTimersByTimeAsync(0);
  lifecycle.abort();
  await vi.advanceTimersByTimeAsync(6000);
  window.dispatchEvent(new Event('online'));
  expect(requests).toHaveLength(1);
});

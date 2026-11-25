import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { loadPage, mediaQuery } from './browser.js';

let touch, viewport, listeners;
beforeEach(async () => {
  vi.resetModules();
  loadPage();
  touch = mediaQuery(true);
  viewport = Object.assign(new EventTarget(), {offsetTop:0,height:400,scale:1});
  vi.stubGlobal('visualViewport',viewport);
  vi.spyOn(window,'scrollBy').mockImplementation(()=>{});
  listeners = new AbortController();
  for (const target of [document,window]) {
    const add=target.addEventListener.bind(target);
    vi.spyOn(target,'addEventListener').mockImplementation((type,listener,options={})=>add(type,listener,{...options,signal:listeners.signal}));
  }
  vi.spyOn(document.querySelector('.masthead'),'getBoundingClientRect').mockReturnValue({bottom:80});
  await import('../src/keyboard.js');
});
afterEach(()=>listeners.abort());

test('touch form editing hides the dock and leaving the field restores it', async () => {
  document.querySelector('[name="name"]').focus();
  expect(document.body.classList.contains('touch-editing')).toBe(true);
  document.querySelector('.motion-toggle').focus();
  await Promise.resolve();
  expect(document.body.classList.contains('touch-editing')).toBe(false);
});

test('desktop keyboard focus does not hide the dock', () => {
  touch.change(false);
  document.querySelector('[name="name"]').focus();
  expect(document.body.classList.contains('touch-editing')).toBe(false);
});

test('a shrinking visible viewport reveals a field above the keyboard', () => {
  const input=document.querySelector('[name="name"]');
  vi.spyOn(input,'getBoundingClientRect').mockReturnValue({top:350,bottom:395,height:45});
  input.focus();
  viewport.dispatchEvent(new Event('resize'));
  expect(window.scrollBy).toHaveBeenCalledWith({top:11,behavior:'instant'});
});

test('viewport changes do not scroll fields already visible', () => {
  const input=document.querySelector('[name="name"]');
  vi.spyOn(input,'getBoundingClientRect').mockReturnValue({top:200,bottom:245,height:45});
  input.focus();
  viewport.dispatchEvent(new Event('resize'));
  expect(window.scrollBy).not.toHaveBeenCalled();
});

test('keyboard adjustment respects pinch zoom and oversized textareas', () => {
  const input=document.querySelector('textarea');
  const rect=vi.spyOn(input,'getBoundingClientRect').mockReturnValue({top:350,bottom:395,height:45});
  input.focus();
  viewport.scale=2;
  viewport.dispatchEvent(new Event('resize'));
  expect(window.scrollBy).not.toHaveBeenCalled();
  viewport.scale=1;
  rect.mockReturnValue({top:100,bottom:700,height:600});
  viewport.dispatchEvent(new Event('resize'));
  expect(window.scrollBy).not.toHaveBeenCalled();
});

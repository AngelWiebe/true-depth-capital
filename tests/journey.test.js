import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { loadPage, mediaQuery } from './browser.js';

let listeners;
beforeEach(async () => {
  vi.resetModules();
  loadPage();
  mediaQuery();
  // Keep module listeners scoped to each test, as a fresh browser page would.
  listeners=new AbortController();
  for(const target of [document,window]){
    const add=target.addEventListener.bind(target);
    vi.spyOn(target,'addEventListener').mockImplementation((type,listener,options={})=>{
      add(type,listener,{...options,signal:listeners.signal});
    });
  }
  vi.stubGlobal('requestAnimationFrame',vi.fn(() => 1));
  vi.spyOn(window,'scrollTo').mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype,'getClientRects').mockImplementation(function(){
    return this.hidden?[]:[{width:100,height:30}];
  });
  await import('../src/journey.js');
});
afterEach(() => listeners.abort());

test('opening the menu isolates content and Escape restores focus', () => {
  const toggle=document.querySelector('.menu-toggle');
  toggle.click();
  expect(document.querySelector('main').inert).toBe(true);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(document.activeElement).toBe(document.querySelector('.mobile-menu a'));
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  expect(document.querySelector('.mobile-menu').hidden).toBe(true);
  expect(document.querySelector('main').inert).toBe(false);
  expect(document.activeElement).toBe(toggle);
});

test('Tab wraps within the open menu and header controls', () => {
  document.querySelector('.menu-toggle').click();
  const last=document.querySelector('.mobile-menu a:last-child');
  const brand=document.querySelector('.brand');
  last.focus();
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',cancelable:true}));
  expect(document.activeElement).toBe(brand);
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,cancelable:true}));
  expect(document.activeElement).toBe(last);
});

test('choosing a section releases the menu and focuses the destination', () => {
  document.querySelector('.menu-toggle').click();
  document.querySelector('.mobile-menu a[href="#contact"]').click();
  expect(document.querySelector('.mobile-menu').hidden).toBe(true);
  expect(document.querySelector('main').inert).toBe(false);
  expect(document.activeElement.id).toBe('contact');
  expect(window.scrollTo).toHaveBeenCalled();
});

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
afterEach(() => {
  listeners.abort();
  history.replaceState(null,'',location.pathname);
});

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

function placePricing() {
  vi.spyOn(document.querySelector('.masthead'),'getBoundingClientRect').mockReturnValue({bottom:104});
  vi.spyOn(document.querySelector('#pricing'),'getBoundingClientRect').mockReturnValue({top:1200});
}

test('Pricing navigation clears the fixed header and focuses the section without extra scrolling', () => {
  placePricing();
  const pricing=document.querySelector('#pricing');
  const focus=vi.spyOn(pricing,'focus');
  document.querySelector('.header-nav a[href="#pricing"]').click();
  expect(window.scrollTo).toHaveBeenLastCalledWith({top:1068,behavior:'smooth'});
  expect(location.hash).toBe('#pricing');
  expect(focus).toHaveBeenCalledWith({preventScroll:true});
  expect(document.activeElement).toBe(pricing);
});

test('paused motion navigates without smooth scrolling', () => {
  placePricing();
  document.querySelector('.motion-toggle').click();
  document.querySelector('.header-nav a[href="#pricing"]').click();
  expect(window.scrollTo).toHaveBeenLastCalledWith({top:1068,behavior:'instant'});
});

test('direct Pricing links are aligned after page load', () => {
  placePricing();
  history.replaceState(null,'','#pricing');
  window.dispatchEvent(new Event('load'));
  const callbacks=requestAnimationFrame.mock.calls.map(([callback])=>callback);
  callbacks.forEach(callback=>callback());
  expect(window.scrollTo).toHaveBeenLastCalledWith({top:1068,behavior:'instant'});
});

test('hash changes to Pricing clear the header without moving unrelated destinations', () => {
  placePricing();
  history.replaceState(null,'','#pricing');
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  expect(window.scrollTo).toHaveBeenLastCalledWith({top:1068,behavior:'instant'});
  window.scrollTo.mockClear();
  history.replaceState(null,'','#story');
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  expect(window.scrollTo).not.toHaveBeenCalled();
});

test('reaching the surface never scrolls above the page', () => {
  document.querySelector('.brand').click();
  expect(window.scrollTo).toHaveBeenLastCalledWith({top:0,behavior:'smooth'});
});

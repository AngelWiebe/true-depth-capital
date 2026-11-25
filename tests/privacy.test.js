import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { loadPage } from './browser.js';

beforeEach(() => {
  vi.resetModules(); loadPage();
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
});
afterEach(() => document.querySelector('.privacy-dialog').dispatchEvent(new Event('close')));

test('opens the privacy dialog at its heading and closes through the native dialog form', async () => {
  const dialog=document.querySelector('.privacy-dialog');
  dialog.showModal=vi.fn(() => { dialog.open=true; });
  await import('../src/privacy.js');
  const trigger=document.querySelector('.privacy-trigger');
  expect(trigger.hidden).toBe(false);
  trigger.click();
  expect(dialog.showModal).toHaveBeenCalledOnce();
  expect(document.activeElement.id).toBe('privacy-title');
  expect(dialog.querySelector('form').method).toBe('dialog');
  expect(dialog.querySelector('button').type).toBe('submit');
  expect(document.querySelector('.privacy-inline')).toBeNull();
});

test('browsers without modal dialogs retain the inline policy', async () => {
  document.querySelector('.privacy-dialog').showModal=undefined;
  await import('../src/privacy.js');
  expect(document.querySelector('.privacy-inline .privacy-copy')).not.toBeNull();
  expect(document.querySelector('.privacy-trigger').hidden).toBe(true);
});


test('modal scroll lock restores prior styles, scroll position and trigger focus', async () => {
  const dialog=document.querySelector('.privacy-dialog');
  dialog.showModal=vi.fn(()=>{dialog.open=true;});
  document.body.style.position='relative';
  vi.stubGlobal('scrollY',640);
  await import('../src/privacy.js');
  const trigger=document.querySelector('.privacy-trigger');
  trigger.click();
  expect(document.body.style.position).toBe('fixed');
  expect(document.body.style.top).toBe('-640px');
  expect(document.documentElement.style.overflow).toBe('hidden');
  dialog.open=false;
  dialog.dispatchEvent(new Event('close'));
  expect(document.body.style.position).toBe('relative');
  expect(document.body.style.top).toBe('');
  expect(document.documentElement.style.overflow).toBe('');
  expect(window.scrollTo).toHaveBeenCalledWith({left:0,top:640,behavior:'instant'});
  expect(document.activeElement).toBe(trigger);
});

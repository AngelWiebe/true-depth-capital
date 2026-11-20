import { beforeEach, expect, test, vi } from 'vitest';
import { loadPage } from './browser.js';

beforeEach(() => { vi.resetModules(); loadPage(); });

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

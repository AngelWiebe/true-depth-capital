import { beforeEach, expect, test, vi } from 'vitest';
import { loadPage, mediaQuery } from './browser.js';

beforeEach(() => {
  vi.resetModules();
  loadPage();
});

test('uses the system preference and exposes the current state accessibly', async () => {
  const media = mediaQuery(true);
  const motion = await import('../src/motion.js');
  const toggle = document.querySelector('.motion-toggle');
  expect(motion.isMotionPaused()).toBe(true);
  expect(toggle.hidden).toBe(false);
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
  expect(toggle.textContent).toContain('Off');
  media.change(false);
  expect(document.body.dataset.motion).toBe('playing');
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
});

test('a manual choice persists through system changes and notifies renderers', async () => {
  const media = mediaQuery(false);
  const motion = await import('../src/motion.js');
  const changed = vi.fn();
  motion.motionChange.addEventListener('change', changed);
  document.querySelector('.motion-toggle').click();
  media.change(true);
  media.change(false);
  expect(motion.isMotionPaused()).toBe(true);
  expect(document.body.dataset.motion).toBe('paused');
  expect(changed).toHaveBeenCalledTimes(3);
  document.querySelector('.motion-toggle').click();
  expect(motion.isMotionPaused()).toBe(false);
});

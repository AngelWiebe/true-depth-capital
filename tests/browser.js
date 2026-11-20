import html from '../index.html?raw';
import { vi } from 'vitest';

export function loadPage() {
  for (const attribute of [...document.body.attributes]) document.body.removeAttribute(attribute.name);
  document.body.innerHTML = html
    .match(/<body>([\s\S]*)<\/body>/)[1];
  HTMLElement.prototype.scrollIntoView = vi.fn();
}

export function mediaQuery(matches = false) {
  const media = new EventTarget();
  media.matches = matches;
  media.change = value => {
    media.matches = value;
    media.dispatchEvent(new Event('change'));
  };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  return media;
}

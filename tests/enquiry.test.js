import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { loadPage, mediaQuery } from './browser.js';

let form, submit, error, success;
const endpoint = 'https://formspree.io/f/testform';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

async function start(url = endpoint) {
  vi.stubEnv('VITE_ENQUIRY_ENDPOINT', url);
  await import('../src/enquiry.js');
  form = document.getElementById('enquiry-form');
  submit = form.querySelector('[type="submit"]');
  error = document.getElementById('enquiry-error');
  success = document.getElementById('enquiry-success');
  Object.entries({
    name: 'Jane Seller', phone: '403-555-0100', year: '2021',
    make: 'Ford', model: 'F-150', mileage: '85000', location: 'Calgary',
  }).forEach(([key, value]) => { form.elements[key].value = value; });
}

function send() {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  vi.resetModules();
  loadPage();
  mediaQuery();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
});

afterEach(() => vi.useRealTimers());

test('vehicle submissions include active fields and show a confirmation', async () => {
  await start();
  send();
  await tick();
  const [url, request] = fetch.mock.calls[0];
  expect(url).toBe(endpoint);
  expect(request.method).toBe('POST');
  expect(request.headers.Accept).toBe('application/json');
  expect(Object.fromEntries(request.body)).toMatchObject({
    kind: 'vehicle', name: 'Jane Seller', make: 'Ford', phone: '403-555-0100',
  });
  expect(request.body.has('company')).toBe(false);
  expect(request.body.has('website')).toBe(false);
  expect(form.hidden).toBe(true);
  expect(success.hidden).toBe(false);
  expect(document.activeElement).toBe(success);
  expect(document.getElementById('enquiry-photo-note').hidden).toBe(false);
});

test('switching to dealers changes required fields and excludes vehicle details', async () => {
  await start();
  form.querySelector('[value="dealer"]').click();
  form.elements.company.value = 'Example Motors';
  form.elements.dealerLocation.value = 'Seattle';
  form.elements.message.value = 'Looking for trucks';
  expect(form.elements.make.disabled).toBe(true);
  expect(form.elements.company.required).toBe(true);
  expect(form.elements.message.required).toBe(true);
  send();
  await tick();
  const data = fetch.mock.calls[0][1].body;
  expect(data.get('kind')).toBe('dealer');
  expect(data.get('company')).toBe('Example Motors');
  expect(data.has('year')).toBe(false);
  expect(document.getElementById('enquiry-photo-note').hidden).toBe(true);
});

test('requires a reply method and rejects honeypot submissions', async () => {
  await start();
  form.elements.phone.value = '';
  send();
  expect(form.elements.email.validationMessage).toContain('email address or phone number');
  expect(fetch).not.toHaveBeenCalled();
  form.elements.phone.value = '403-555-0100';
  form.elements.website.value = 'spam';
  send();
  expect(fetch).not.toHaveBeenCalled();
});

test('locks the form while pending and suppresses duplicate submissions', async () => {
  let finish;
  fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await start();
  send();
  expect(submit.disabled).toBe(true);
  expect(form.getAttribute('aria-busy')).toBe('true');
  send();
  expect(fetch).toHaveBeenCalledTimes(1);
  finish({ ok: true });
  await tick();
  expect(submit.disabled).toBe(false);
  expect(form.hasAttribute('aria-busy')).toBe(false);
  expect(form.elements.company.disabled).toBe(true);
});

test.each(['server', 'network'])('%s failures preserve details and allow retry', async kind => {
  if (kind === 'server') fetch.mockResolvedValueOnce({ ok: false });
  else fetch.mockRejectedValueOnce(new TypeError('Offline'));
  await start();
  send();
  await tick();
  expect(error.hidden).toBe(false);
  expect(form.hidden).toBe(false);
  expect(form.elements.model.value).toBe('F-150');
  expect(document.activeElement).toBe(submit);
  expect(submit.disabled).toBe(false);
  send();
  await tick();
  expect(success.hidden).toBe(false);
});

test('a timeout aborts the request and restores the form for retry', async () => {
  await start();
  vi.useFakeTimers();
  fetch.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  send();
  await vi.advanceTimersByTimeAsync(15000);
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(error.hidden).toBe(false);
  expect(submit.disabled).toBe(false);
  expect(form.elements.name.value).toBe('Jane Seller');
});

test('starting another enquiry resets the form and restores vehicle mode', async () => {
  await start();
  send();
  await tick();
  document.getElementById('enquiry-another').click();
  expect(form.hidden).toBe(false);
  expect(success.hidden).toBe(true);
  expect(form.elements.name.value).toBe('');
  expect(form.elements.kind.value).toBe('vehicle');
  expect(form.elements.make.required).toBe(true);
  expect(document.activeElement).toBe(form.elements.name);
});

test.each(['', 'https://example.com/f/invalid'])('missing or invalid endpoints keep email fallback copy', async url => {
  await start(url);
  expect(submit.textContent).toContain('Email vehicle enquiry');
  expect(document.getElementById('enquiry-intro').textContent).toContain('email app');
  expect(fetch).not.toHaveBeenCalled();
});

test.each(['Harbour', 'Bluewater', 'Deep Dive'])('%s CTA selects sourcing and sends the chosen package', async name => {
  await start();
  document.querySelector(`[data-package="${name}"]`).click();
  expect(form.elements.kind.value).toBe('sourcing');
  expect(form.elements.package.value).toBe(name);
  expect(form.elements.package.disabled).toBe(false);
  expect(form.elements.year.disabled).toBe(true);
  expect(form.elements.company.disabled).toBe(true);
  expect(form.elements.message.required).toBe(true);
  form.elements.message.value = 'Looking for a late-model SUV.';
  send();
  await tick();
  const data=fetch.mock.calls[0][1].body;
  expect(data.get('kind')).toBe('sourcing');
  expect(data.get('package')).toBe(name);
  expect(data.get('subject')).toBe('True Depth Capital sourcing enquiry');
  expect(data.has('year')).toBe(false);
  expect(data.has('company')).toBe(false);
  expect(success.hidden).toBe(false);
});

test('sourcing can be chosen without a package and does not leak into seller enquiries', async () => {
  await start();
  form.querySelector('[value="sourcing"]').click();
  expect(form.elements.package.value).toBe('');
  expect(form.elements.package.required).toBe(false);
  form.elements.package.value='Deep Dive';
  form.querySelector('[value="vehicle"]').click();
  expect(form.elements.package.disabled).toBe(true);
  send();
  await tick();
  expect(fetch.mock.calls[0][1].body.has('package')).toBe(false);
});

test('switching package CTAs after a completed enquiry resets the form to the new selection', async () => {
  await start();
  send();
  await tick();
  document.querySelector('[data-package="Bluewater"]').click();
  expect(form.hidden).toBe(false);
  expect(success.hidden).toBe(true);
  expect(form.elements.kind.value).toBe('sourcing');
  expect(form.elements.package.value).toBe('Bluewater');
});

test('sourcing email fallback includes the selected package', async () => {
  await start('');
  document.querySelector('[data-package="Harbour"]').click();
  expect(submit.textContent).toContain('Email sourcing enquiry');
  expect(form.elements.kind.value).toBe('sourcing');
  expect(form.elements.package.value).toBe('Harbour');
});

test('a failed sourcing enquiry retains the package and message for retry', async () => {
  fetch.mockResolvedValueOnce({ok:false});
  await start();
  document.querySelector('[data-package="Deep Dive"]').click();
  form.elements.message.value='Please source a hybrid SUV.';
  send();
  await tick();
  expect(error.hidden).toBe(false);
  expect(error.getAttribute('role')).toBe('alert');
  expect(form.elements.package.value).toBe('Deep Dive');
  expect(form.elements.package.disabled).toBe(false);
  expect(form.elements.company.disabled).toBe(true);
  expect(form.elements.year.disabled).toBe(true);
  expect(form.elements.message.value).toBe('Please source a hybrid SUV.');
  send();
  await tick();
  expect(fetch.mock.calls[1][1].body.get('package')).toBe('Deep Dive');
  expect(success.hidden).toBe(false);
});

test('package CTAs cannot change a sourcing enquiry while it is being sent', async () => {
  let finish;
  fetch.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  await start();
  document.querySelector('[data-package="Harbour"]').click();
  form.elements.message.value='Looking for a pickup.';
  send();
  document.querySelector('[data-package="Deep Dive"]').click();
  expect(form.elements.package.value).toBe('Harbour');
  expect(fetch.mock.calls[0][1].body.get('package')).toBe('Harbour');
  finish({ok:true});
  await tick();
  expect(success.hidden).toBe(false);
});

test.each(['email','phone'])('adding a %s clears the missing-reply-method error', async field => {
  await start();
  form.elements.phone.value='';
  send();
  expect(form.elements.email.validity.customError).toBe(true);
  form.elements[field].value=field==='email'?'jane@example.com':'403-555-0100';
  form.elements[field].dispatchEvent(new Event('input',{bubbles:true}));
  expect(form.elements.email.validity.customError).toBe(false);
  send();
  await tick();
  expect(fetch).toHaveBeenCalledOnce();
  expect(success.hidden).toBe(false);
});

test('sourcing requires a description before sending', async () => {
  await start();
  document.querySelector('[data-package="Bluewater"]').click();
  send();
  expect(fetch).not.toHaveBeenCalled();
  expect(form.elements.message.validity.valueMissing).toBe(true);
  expect(form.hidden).toBe(false);
});

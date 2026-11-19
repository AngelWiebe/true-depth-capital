import { isMotionPaused } from './motion.js';

const CONTACT_EMAIL = 'lance@dlrconsulting.ca';
const configuredEndpoint = import.meta.env.VITE_ENQUIRY_ENDPOINT?.trim() ?? '';
const endpoint = /^https:\/\/formspree\.io\/f\/[a-z\d]+$/i.test(configuredEndpoint)
  ? configuredEndpoint
  : '';

const form = document.getElementById('enquiry-form');
const radios = [...form.querySelectorAll('[name="kind"]')];
const vehicleFields = document.getElementById('vehicle-fields');
const dealerFields = document.getElementById('dealer-fields');
const error = document.getElementById('enquiry-error');
const success = document.getElementById('enquiry-success');
const submit = form.querySelector('[type="submit"]');
const submitLabel = submit.querySelector('span');
const intro = document.getElementById('enquiry-intro');
const submitNote = document.getElementById('enquiry-submit-note');
const email = form.elements.email, phone = form.elements.phone;
const message = form.elements.message;

if (endpoint) {
  document.getElementById('enquiry-privacy-copy').textContent =
    'When you submit an enquiry online, Formspree processes the details you enter and sends them to True Depth Capital. Those details may include your name, contact information, vehicle or dealership details, and your message.';
}

function setKind(kind) {
  const dealer = kind === 'dealer';
  radios.forEach(radio => { radio.checked = radio.value === kind; });
  vehicleFields.hidden = dealer;
  dealerFields.hidden = !dealer;
  vehicleFields.querySelectorAll('input').forEach(input => { input.disabled = dealer; input.required = !dealer && input.hasAttribute('data-vehicle-required'); });
  dealerFields.querySelectorAll('input').forEach(input => { input.disabled = !dealer; input.required = dealer; });
  message.required = dealer;
  document.getElementById('enquiry-title').textContent = dealer ? 'Let’s talk U.S. wholesale.' : 'Tell us about your vehicle.';
  const instructions = dealer
    ? 'Tell us about your licensed U.S. dealership and the vehicles you’re looking for.'
    : 'Share the basics about the vehicle you’d like to sell.';
  intro.textContent = endpoint ? instructions : `${instructions} The button opens a draft in your email app.`;
  document.getElementById('message-label').textContent = dealer ? 'What vehicles are you looking for? *' : 'Condition and anything else we should know (optional)';
  message.placeholder = dealer ? 'Vehicle types, preferred specifications or a wholesale enquiry' : 'Trim, condition, history, asking price or other useful details';
  const verb = endpoint ? 'Send' : 'Email';
  submitLabel.textContent = dealer ? `${verb} dealer enquiry` : `${verb} vehicle enquiry`;
  const deliveryNote = endpoint
    ? 'Your enquiry goes directly to True Depth Capital.'
    : 'Review and send the draft from your email app.';
  const photoNote = endpoint
    ? 'You can email photos separately after submitting. Include the name you used on the enquiry.'
    : 'You can attach photos to the draft before sending it.';
  submitNote.textContent = dealer
    ? deliveryNote
    : `${deliveryNote} ${photoNote} Submitting a vehicle does not commit either party to a purchase.`;
  error.hidden = true;
}
radios.forEach(radio => radio.addEventListener('change', () => setKind(radio.value)));
document.querySelectorAll('[data-enquiry]').forEach(link => link.addEventListener('click', () => {
  if (submit.disabled) return;
  if (!success.hidden) resetForm();
  setKind(link.dataset.enquiry);
}, { capture: true }));
function validateContact() {
  email.setCustomValidity(email.value.trim() || phone.value.trim() ? '' : 'Please include an email address or phone number so we can reply.');
}
email.addEventListener('input', validateContact);
phone.addEventListener('input', validateContact);

function value(name) {
  return String(form.elements[name]?.value || '').trim();
}

function composeMail() {
  const kind = radios.find(radio => radio.checked).value;
  const dealer = kind === 'dealer';
  const subject = dealer
    ? `U.S. dealer enquiry from ${value('name')}`
    : `Vehicle enquiry: ${value('year')} ${value('make')} ${value('model')}`.replace(/\s+/g, ' ').trim();
  const lines = [
    dealer ? 'U.S. dealer enquiry' : 'Vehicle enquiry',
    '',
    `Name: ${value('name')}`,
    value('email') && `Email: ${value('email')}`,
    value('phone') && `Phone: ${value('phone')}`,
    dealer && `Dealership: ${value('company')}`,
    dealer && `Dealership location: ${value('dealerLocation')}`,
    !dealer && `Vehicle: ${value('year')} ${value('make')} ${value('model')}`,
    !dealer && `Mileage: ${value('mileage')} km`,
    !dealer && `Location: ${value('location')}`,
    !dealer && value('vin') && `VIN: ${value('vin')}`,
    value('message') && '',
    value('message') && value('message'),
  ].filter(Boolean);
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

function resetForm() {
  form.reset();
  success.hidden = true; form.hidden = false;
  intro.hidden = false;
  setKind('vehicle');
}
document.getElementById('enquiry-another').addEventListener('click', () => { resetForm(); form.elements.name.focus(); });

function showConfirmation(sentDirectly) {
  const heading = success.querySelector('h4');
  heading.textContent = sentDirectly ? 'Enquiry sent.' : 'Draft ready in your email app.';
  document.getElementById('enquiry-confirmation').textContent = sentDirectly
    ? 'Thanks for getting in touch. We’ll use the details you provided to respond.'
    : `If your email app did not open, send the same details to ${CONTACT_EMAIL}.`;
  document.getElementById('enquiry-photo-note').hidden = !sentDirectly || form.elements.kind.value !== 'vehicle';
  document.getElementById('enquiry-draft-note').hidden = sentDirectly;
  form.hidden = true;
  success.hidden = false;
  intro.hidden = true;
  success.focus({ preventScroll: true });
  success.scrollIntoView({ behavior: isMotionPaused() ? 'instant' : 'smooth', block: 'center' });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submit.disabled) return;
  validateContact();
  if (!form.reportValidity() || value('website')) return;
  error.hidden = true;

  if (!endpoint) {
    window.location.assign(composeMail());
    showConfirmation(false);
    return;
  }

  const data = new FormData(form);
  data.delete('website');
  data.set('subject', data.get('kind') === 'dealer' ? 'True Depth Capital dealer enquiry' : 'True Depth Capital vehicle enquiry');

  const availableControls = [...form.elements].filter(control => !control.disabled);
  const originalLabel = submitLabel.textContent;
  availableControls.forEach(control => { control.disabled = true; });
  submitLabel.textContent = 'Sending…';
  form.setAttribute('aria-busy', 'true');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let sent = false;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    sent = response.ok;
  } catch {
    // A dropped connection can leave delivery uncertain.
  } finally {
    clearTimeout(timeout);
    availableControls.forEach(control => { control.disabled = false; });
    submitLabel.textContent = originalLabel;
    form.removeAttribute('aria-busy');
  }

  if (sent) {
    showConfirmation(true);
  } else {
    error.textContent = `We couldn’t confirm that your enquiry was sent. Your details are still here. Try again or email ${CONTACT_EMAIL}.`;
    error.hidden = false;
    submit.focus();
  }
});
setKind('vehicle');

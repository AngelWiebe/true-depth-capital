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
const sourcingFields = document.getElementById('sourcing-fields');
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

const enquiryTypes = {
  vehicle: {
    title: 'Tell us about your vehicle.',
    intro: 'Share the basics about the vehicle you’d like to sell.',
    messageLabel: 'Condition and anything else we should know (optional)',
    placeholder: 'Trim, condition, history, asking price or other useful details',
    label: 'vehicle enquiry',
  },
  dealer: {
    title: 'Let’s talk U.S. wholesale.',
    intro: 'Tell us about your licensed U.S. dealership and the vehicles you’re looking for.',
    messageLabel: 'What vehicles are you looking for? *',
    placeholder: 'Vehicle types, preferred specifications or a wholesale enquiry',
    label: 'dealer enquiry',
  },
  sourcing: {
    title: 'Let’s source your next vehicle.',
    intro: 'Choose a package and tell us about the vehicle you’re looking for. We’ll follow up to discuss your request.',
    messageLabel: 'What vehicle are you looking for? *',
    placeholder: 'Make, model, budget, preferred specifications and timing',
    label: 'sourcing enquiry',
  },
};

function setKind(kind) {
  const config = enquiryTypes[kind];
  const seller = kind === 'vehicle';
  const dealer = kind === 'dealer';
  const sourcing = kind === 'sourcing';
  radios.forEach(radio => { radio.checked = radio.value === kind; });
  vehicleFields.hidden = !seller;
  dealerFields.hidden = !dealer;
  sourcingFields.hidden = !sourcing;
  vehicleFields.querySelectorAll('input').forEach(input => {
    input.disabled = !seller;
    input.required = seller && input.hasAttribute('data-vehicle-required');
  });
  dealerFields.querySelectorAll('input').forEach(input => { input.disabled = !dealer; input.required = dealer; });
  form.elements.package.disabled = !sourcing;
  message.required = !seller;
  document.getElementById('enquiry-title').textContent = config.title;
  intro.textContent = endpoint ? config.intro : `${config.intro} The button opens a draft in your email app.`;
  document.getElementById('message-label').textContent = config.messageLabel;
  message.placeholder = config.placeholder;
  const verb = endpoint ? 'Send' : 'Email';
  submitLabel.textContent = `${verb} ${config.label}`;
  const deliveryNote = endpoint
    ? 'Your enquiry goes directly to True Depth Capital.'
    : 'Review and send the draft from your email app.';
  const photoNote = endpoint
    ? 'You can email photos separately after submitting. Include the name you used on the enquiry.'
    : 'You can attach photos to the draft before sending it.';
  submitNote.textContent = seller
    ? `${deliveryNote} ${photoNote} Submitting a vehicle does not commit either party to a purchase.`
    : deliveryNote;
  error.hidden = true;
}
radios.forEach(radio => radio.addEventListener('change', () => setKind(radio.value)));
document.querySelectorAll('[data-enquiry]').forEach(link => link.addEventListener('click', () => {
  if (submit.disabled) return;
  if (!success.hidden) resetForm();
  setKind(link.dataset.enquiry);
  if (link.dataset.package) form.elements.package.value = link.dataset.package;
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
  const seller = kind === 'vehicle';
  const sourcing = kind === 'sourcing';
  const subject = sourcing
    ? `Vehicle sourcing enquiry: ${value('package') || 'Help me choose'}`
    : dealer
    ? `U.S. dealer enquiry from ${value('name')}`
    : `Vehicle enquiry: ${value('year')} ${value('make')} ${value('model')}`.replace(/\s+/g, ' ').trim();
  const lines = [
    sourcing ? 'Vehicle sourcing enquiry' : dealer ? 'U.S. dealer enquiry' : 'Vehicle enquiry',
    sourcing && `Package: ${value('package') || 'Help me choose'}`,
    '',
    `Name: ${value('name')}`,
    value('email') && `Email: ${value('email')}`,
    value('phone') && `Phone: ${value('phone')}`,
    dealer && `Dealership: ${value('company')}`,
    dealer && `Dealership location: ${value('dealerLocation')}`,
    seller && `Vehicle: ${value('year')} ${value('make')} ${value('model')}`,
    seller && `Mileage: ${value('mileage')} km`,
    seller && `Location: ${value('location')}`,
    seller && value('vin') && `VIN: ${value('vin')}`,
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
  data.set('subject', `True Depth Capital ${enquiryTypes[data.get('kind')].label}`);

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

const preference = matchMedia('(prefers-reduced-motion: reduce)');
const toggle = document.querySelector('.motion-toggle');
let override;

export const motionChange = new EventTarget();
export const isMotionPaused = () => override ?? preference.matches;

function updateMotion() {
  const paused = isMotionPaused();
  document.body.dataset.motion = paused ? 'paused' : 'playing';
  toggle.setAttribute('aria-pressed', String(!paused));
  toggle.querySelector('span').textContent = paused ? 'Off' : 'On';
  motionChange.dispatchEvent(new Event('change'));
}

toggle.addEventListener('click', () => {
  override = !isMotionPaused();
  updateMotion();
});
preference.addEventListener('change', updateMotion);
updateMotion();
toggle.hidden = false;

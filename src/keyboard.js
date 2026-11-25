// Keep fixed navigation away from touch form editing, including landscape/tablets.
const touch = matchMedia('(any-pointer: coarse)');
const viewport = window.visualViewport;
const masthead = document.querySelector('.masthead');
function activeFormField() {
  const element = document.activeElement;
  return element?.matches('.form-field input:not([type="radio"]), .form-field textarea, .form-field select')
    ? element : null;
}
function updateEditing() {
  document.body.classList.toggle('touch-editing', touch.matches && !!activeFormField());
}
function keepFieldVisible() {
  updateEditing();
  const element = activeFormField();
  // Pinch zoom/panning is user-controlled and must not be undone.
  if (!touch.matches || !element || !viewport || viewport.scale > 1.05) return;
  const rect = element.getBoundingClientRect();
  const top = Math.max(viewport.offsetTop, masthead.getBoundingClientRect().bottom) + 12;
  const bottom = viewport.offsetTop + viewport.height - 16;
  if (bottom <= top || rect.height > bottom - top) return;
  const delta = rect.bottom > bottom ? Math.min(rect.bottom - bottom, rect.top - top)
    : rect.top < top ? rect.top - top : 0;
  if (delta) window.scrollBy({ top: delta, behavior: 'instant' });
}
document.addEventListener('focusin', updateEditing);
document.addEventListener('focusout', () => queueMicrotask(updateEditing));
touch.addEventListener('change', updateEditing);
viewport?.addEventListener('resize', keepFieldVisible);
window.addEventListener('resize', keepFieldVisible);

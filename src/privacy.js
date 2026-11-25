const dialog = document.querySelector('.privacy-dialog');

function lockPageScroll() {
  const body = document.body;
  const root = document.documentElement;
  const position = { left: window.scrollX, top: window.scrollY };
  const properties = ['position', 'top', 'left', 'width', 'padding-right'];
  const saved = properties.map(name => ({
    name,
    value: body.style.getPropertyValue(name),
    priority: body.style.getPropertyPriority(name),
  }));
  const overflow = root.style.overflow;
  const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth);

  body.style.position = 'fixed';
  body.style.top = `-${position.top}px`;
  body.style.left = `-${position.left}px`;
  body.style.width = '100%';
  if (scrollbarWidth) {
    body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + scrollbarWidth}px`;
  }
  root.style.overflow = 'hidden';

  return () => {
    for (const { name, value, priority } of saved) {
      if (value) body.style.setProperty(name, value, priority);
      else body.style.removeProperty(name);
    }
    root.style.overflow = overflow;
    window.scrollTo({ ...position, behavior: 'instant' });
  };
}

if (typeof dialog.showModal === 'function') {
  const trigger = document.querySelector('.privacy-trigger');
  const inline = document.querySelector('.privacy-inline');
  const heading = inline.querySelector('#privacy-title');
  let unlock;

  dialog.prepend(inline.querySelector('.privacy-copy'));
  inline.remove();
  trigger.hidden = false;

  dialog.addEventListener('close', () => {
    if (!unlock) return;
    unlock();
    unlock = undefined;
    trigger.focus({ preventScroll: true });
  });
  trigger.addEventListener('click', () => {
    dialog.showModal();
    unlock = lockPageScroll();
    heading.focus({ preventScroll: true });
    dialog.scrollTop = 0;
  });
}

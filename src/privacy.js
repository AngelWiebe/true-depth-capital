const dialog = document.querySelector('.privacy-dialog');

if (typeof dialog.showModal === 'function') {
  const trigger = document.querySelector('.privacy-trigger');
  const inline = document.querySelector('.privacy-inline');

  dialog.prepend(inline.querySelector('.privacy-copy'));
  inline.remove();
  trigger.hidden = false;
  trigger.addEventListener('click', () => {
    dialog.showModal();
    dialog.querySelector('#privacy-title').focus({ preventScroll: true });
    dialog.scrollTop = 0;
  });
}

// PATH: src/lib/scrollLock.js
let _locked = false;
let _scrollY = 0;

export function lockBodyScroll() {
  if (_locked) return;
  _locked = true;

  _scrollY = window.scrollY || window.pageYOffset || 0;

  // fijamos el body sin perder el scroll actual
  document.body.style.position = "fixed";
  document.body.style.top = `-${_scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

export function unlockBodyScroll() {
  if (!_locked) return;
  _locked = false;

  const y = _scrollY;

  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";

  window.scrollTo(0, y);
}

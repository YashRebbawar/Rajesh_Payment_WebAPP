(function () {
  const dot = document.getElementById('pfCursorDot');
  const ring = document.getElementById('pfCursorRing');
  const root = document.documentElement;

  if (!dot || !ring) return;

  const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isTouch || reducedMotion) return;

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;
  let rafId = null;
  let started = false;

  function tick() {
    ringX += (mouseX - ringX) * 0.2;
    ringY += (mouseY - ringY) * 0.2;

    dot.style.transform = `translate3d(${mouseX - 4}px, ${mouseY - 4}px, 0)`;
    ring.style.transform = `translate3d(${ringX - 15}px, ${ringY - 15}px, 0)`;

    if (started) rafId = window.requestAnimationFrame(tick);
  }

  function start() {
    if (started) return;
    started = true;
    root.classList.add('pf-cursor-active');
    tick();
  }

  function stop() {
    started = false;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    start();
  }, { passive: true });

  document.addEventListener('mouseover', function (e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const interactive = target.closest('a, button, input, select, textarea, label, [role="button"], .account-card, .trust-pill, .faq-item');
    if (interactive) root.classList.add('pf-cursor-hover');
  });

  document.addEventListener('mouseout', function (e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const interactive = target.closest('a, button, input, select, textarea, label, [role="button"], .account-card, .trust-pill, .faq-item');
    if (interactive) root.classList.remove('pf-cursor-hover');
  });

  document.addEventListener('mouseleave', function () {
    root.classList.remove('pf-cursor-active');
    root.classList.remove('pf-cursor-hover');
    stop();
  });

  window.addEventListener('blur', function () {
    root.classList.remove('pf-cursor-active');
    root.classList.remove('pf-cursor-hover');
    stop();
  });

  window.addEventListener('beforeunload', stop);
})();

// ─── Cursor (desktop only) ────────────────────────────────────
const dot  = document.getElementById('cursorDot');
const ring = document.getElementById('cursorRing');
const isTouchDevice = () => window.matchMedia('(hover: none)').matches;
if (!isTouchDevice()) {
  let mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  (function animCursor() {
    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;
    dot.style.transform  = `translate(${mx - 4}px, ${my - 4}px)`;
    ring.style.transform = `translate(${rx - 16}px, ${ry - 16}px)`;
    requestAnimationFrame(animCursor);
  })();
  document.querySelectorAll('button, a, .feat-card, .testi-card, .faq-item').forEach(el => {
    el.addEventListener('mouseenter', () => { ring.style.width = '48px'; ring.style.height = '48px'; ring.style.opacity = '0.8'; });
    el.addEventListener('mouseleave', () => { ring.style.width = '32px'; ring.style.height = '32px'; ring.style.opacity = '0.5'; });
  });
} else {
  dot.style.display = 'none';
  ring.style.display = 'none';
}

// ─── Hamburger menu ──────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const hamburgerMobile = document.getElementById('hamburger-mobile');
const mobileNav = document.getElementById('mobileNav');

function closeMobileNav() {
  if (hamburger) hamburger.classList.remove('open');
  if (hamburgerMobile) hamburgerMobile.classList.remove('open');
  mobileNav.classList.remove('open');
  document.body.style.overflow = '';
}

if (hamburger) {
  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.classList.toggle('open');
    mobileNav.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
}

if (hamburgerMobile) {
  hamburgerMobile.addEventListener('click', () => {
    const isOpen = hamburgerMobile.classList.toggle('open');
    mobileNav.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
}

// Close on Escape key
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileNav(); });

// ─── Navbar scroll ───────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 60);
});

// ─── Scroll reveal ───────────────────────────────────────────
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ─── Count up ────────────────────────────────────────────────
function countUp(el, target, duration, formatter) {
  let start = 0;
  const step = target / (duration / 16);
  const formatValue = formatter || (value => Math.floor(value).toLocaleString());
  const timer = setInterval(() => {
    start += step;
    if (start >= target) { start = target; clearInterval(timer); }
    el.textContent = formatValue(start);
  }, 16);
}
const tradersObs = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          countUp(document.getElementById('countTraders'), data.total_users, 1500);
          countUp(
            document.getElementById('countDeposits'),
            data.total_deposited,
            1500,
            value => Math.floor(value).toLocaleString('en-IN')
          );
        }
      })
      .catch(() => {
        countUp(document.getElementById('countTraders'), 0, 1500);
        countUp(document.getElementById('countDeposits'), 0, 1500);
      });
    tradersObs.disconnect();
  }
}, { threshold: 0.3 });
tradersObs.observe(document.querySelector('.stats-band'));

// ─── FAQ ─────────────────────────────────────────────────────
function toggleFaq(el) {
  const isOpen = el.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(f => f.classList.remove('open'));
  if (!isOpen) el.classList.add('open');
}

// ─── Demo modal ──────────────────────────────────────────────
const modal     = document.getElementById('demoModal');
const demoBtn   = document.getElementById('demoBtn');
const demoClose = document.getElementById('demoClose');
demoBtn.addEventListener('click',  () => modal.classList.add('active'));
demoClose.addEventListener('click', () => modal.classList.remove('active'));
modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });

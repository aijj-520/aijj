// Scroll reveal for aijj.net pages. No tracking, no network requests.
// Content stays visible if this script fails or IntersectionObserver is missing.
(function () {
  var root = document.documentElement;
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.classList.add('js');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  document.querySelectorAll('.reveal, .reveal-stagger').forEach(function (el) { io.observe(el); });
})();

// ===== All project images for background slideshow =====
(function() {
  const allImages = [
    'eng-allstar.webp', 'eng-mvp.webp', 'eng-photo1.jpg', 'eng-phtot2.jpg',
    'eng-arm.webp', 'hero-bot.webp', 'hero-chassis-adaptive.webp', 'hero-launcher-2024.png',
    'launcher-dual-4.png', 'launcher-dual-6.png', 'exo-suit.webp'
  ];

  const container = document.getElementById('bgSlideshow');
  allImages.forEach(function(src, i) {
    var div = document.createElement('div');
    div.className = 'bg-img';
    div.style.backgroundImage = 'url(' + src + ')';
    if (i === 0) div.classList.add('show');
    container.appendChild(div);
  });

  var bgIdx = 0;
  var bgDivs = container.querySelectorAll('.bg-img');
  setInterval(function() {
    bgDivs[bgIdx].classList.remove('show');
    bgIdx = (bgIdx + 1) % bgDivs.length;
    bgDivs[bgIdx].classList.add('show');
  }, 10000);
})();

// ===== Gallery auto-rotate =====
var galleryTimers = {};
var mainEl = document.getElementById('main');

function galleryJump(thumb, index) {
  var gallery = thumb.parentElement.parentElement;
  var mainImgs = gallery.querySelectorAll('.gallery-main img');
  var thumbs = gallery.querySelectorAll('.gallery-thumbs img');

  mainImgs.forEach(function(img, i) { img.classList.toggle('show', i === index); });
  thumbs.forEach(function(t, i) { t.classList.toggle('active', i === index); });

  restartGalleryTimer(gallery, index);
}

function currentGalleryImg(gallery) {
  var imgs = gallery.querySelectorAll('.gallery-main img');
  for (var i = 0; i < imgs.length; i++) {
    if (imgs[i].classList.contains('show')) return imgs[i].src;
  }
  return imgs[0].src;
}

function autoAdvanceGallery(gallery) {
  var mainImgs = gallery.querySelectorAll('.gallery-main img');
  var thumbs = gallery.querySelectorAll('.gallery-thumbs img');
  if (mainImgs.length <= 1) return;

  var current = 0;
  mainImgs.forEach(function(img, i) { if (img.classList.contains('show')) current = i; });
  var next = (current + 1) % mainImgs.length;

  mainImgs.forEach(function(img, i) { img.classList.toggle('show', i === next); });
  thumbs.forEach(function(t, i) { t.classList.toggle('active', i === next); });

  restartGalleryTimer(gallery, next);
}

function restartGalleryTimer(gallery, fromIndex) {
  var id = gallery.getAttribute('data-gallery');
  if (galleryTimers[id]) clearInterval(galleryTimers[id]);

  var imgs = gallery.querySelectorAll('.gallery-main img');
  if (imgs.length <= 1) return;

  galleryTimers[id] = setInterval(function() { autoAdvanceGallery(gallery); }, 3500);
}

// Init all galleries (project + subsystem)
document.querySelectorAll('.project-gallery, .subsystem-gallery').forEach(function(g) {
  var imgs = g.querySelectorAll('.gallery-main img');
  if (imgs.length > 1) restartGalleryTimer(g, 0);
});

// ===== Modal =====
function openModal(src) {
  var modalImg = document.getElementById('modal-img');
  modalImg.style.opacity = '0';
  modalImg.onload = function() { modalImg.style.opacity = '1'; };
  modalImg.src = src;
  document.getElementById('modal').classList.add('show');
}

function closeModal() {
  document.getElementById('modal').classList.remove('show');
  document.getElementById('modal-img').style.opacity = '0';
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeModal();
});

// ===== Fade-in on scroll (viewport-based: works for desktop .main scroll AND mobile window scroll) =====
var observer = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.08 });

document.querySelectorAll('.section').forEach(function(s) { observer.observe(s); });

function revealVisibleSections() {
  var vh = window.innerHeight;
  document.querySelectorAll('.section').forEach(function(section) {
    var rect = section.getBoundingClientRect();
    if (rect.top < vh + 160 && rect.bottom > -160) section.classList.add('visible');
  });
}

requestAnimationFrame(revealVisibleSections);
window.addEventListener('load', revealVisibleSections);
window.addEventListener('resize', revealVisibleSections);

// ===== Adaptive scroll container =====
// Desktop: .main is the fixed scroll container. Mobile (<=800px): .main is static, window scrolls.
function isMobileLayout() { return window.innerWidth <= 800; }
function getScroller() { return isMobileLayout() ? window : mainEl; }
function getScrollTop() { return isMobileLayout() ? window.scrollY : mainEl.scrollTop; }

// ===== Scroll spy =====
var sectionIds = [
  'about', 'projects',
  'proj-engineering', 'proj-controller', 'proj-hero', 'proj-exo',
  'research', 'awards'
];
var navLinks = document.querySelectorAll('.nav-list a');

function onScroll() {
  revealVisibleSections();
  var current = 'about';

  for (var i = 0; i < sectionIds.length; i++) {
    var el = document.getElementById(sectionIds[i]);
    if (el && el.getBoundingClientRect().top <= 140) current = sectionIds[i];
  }

  navLinks.forEach(function(a) {
    a.classList.toggle('active', a.getAttribute('href') === '#' + current);
  });
}

mainEl.addEventListener('scroll', onScroll);
window.addEventListener('scroll', onScroll);

// ===== Smooth scroll for nav clicks =====
document.querySelectorAll('.nav-list a').forEach(function(a) {
  a.addEventListener('click', function(e) {
    e.preventDefault();
    var id = this.getAttribute('href').substring(1);
    var target = document.getElementById(id);
    if (!target) return;

    if (isMobileLayout()) {
      var top = target.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top: top, behavior: 'smooth' });
      closeMenu();
    } else {
      var mainRect = mainEl.getBoundingClientRect();
      var scrollTo = target.getBoundingClientRect().top - mainRect.top + mainEl.scrollTop - 20;
      mainEl.scrollTo({ top: scrollTo, behavior: 'smooth' });
    }
  });
});

// ===== Mobile hamburger menu =====
var sidebar = document.querySelector('.sidebar');
var menuToggle = document.getElementById('menuToggle');

function closeMenu() { if (sidebar) sidebar.classList.remove('nav-open'); }

if (menuToggle) {
  menuToggle.addEventListener('click', function() {
    sidebar.classList.toggle('nav-open');
  });
}

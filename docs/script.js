// ===== All project images for background slideshow =====
(function() {
  const allImages = [
    'eng-allstar.webp', 'eng-mvp.webp', 'eng-arm.webp', 'hero-bot.webp', 'exo-suit.webp'
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

// Init all galleries
document.querySelectorAll('.project-gallery').forEach(function(g) {
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

// ===== Fade-in on scroll =====
var observer = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.08, root: mainEl });

document.querySelectorAll('.section').forEach(function(s) { observer.observe(s); });

// ===== Scroll spy =====
var sectionIds = [
  'about','projects','proj-engineering','proj-controller','proj-hero','proj-exo',
  'research','rd-arm','rd-pump','rd-wheel','rd-feeder'
];
var navLinks = document.querySelectorAll('.nav-list a');

mainEl.addEventListener('scroll', function() {
  var scrollTop = mainEl.scrollTop + 80;
  var current = 'about';

  for (var i = 0; i < sectionIds.length; i++) {
    var el = document.getElementById(sectionIds[i]);
    if (el) {
      // Get element position relative to the scroll container
      var rect = el.getBoundingClientRect();
      var mainRect = mainEl.getBoundingClientRect();
      var elTop = rect.top - mainRect.top + mainEl.scrollTop;
      if (elTop <= scrollTop + 60) current = sectionIds[i];
    }
  }

  navLinks.forEach(function(a) {
    a.classList.remove('active');
    if (a.getAttribute('href') === '#' + current) a.classList.add('active');
  });
});

// ===== Smooth scroll for nav clicks =====
document.querySelectorAll('.nav-list a').forEach(function(a) {
  a.addEventListener('click', function(e) {
    e.preventDefault();
    var id = this.getAttribute('href').substring(1);
    var target = document.getElementById(id);
    if (!target) return;

    // Calculate position relative to main scroll container
    var targetRect = target.getBoundingClientRect();
    var mainRect = mainEl.getBoundingClientRect();
    var scrollTo = targetRect.top - mainRect.top + mainEl.scrollTop - 20;

    mainEl.scrollTo({ top: scrollTo, behavior: 'smooth' });
  });
});

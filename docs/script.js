(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav a"));
  var sections = links
    .map(function (link) {
      return document.querySelector(link.getAttribute("href"));
    })
    .filter(Boolean);

  function setActive() {
    var current = sections[0];
    sections.forEach(function (section) {
      if (section.getBoundingClientRect().top <= 120) current = section;
    });
    links.forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("href") === "#" + current.id);
    });
  }

  window.addEventListener("scroll", setActive, { passive: true });
  window.addEventListener("resize", setActive);
  setActive();

  var modal = document.getElementById("imageModal");
  var modalImg = modal.querySelector("img");
  var closeBtn = modal.querySelector(".modal-close");
  var clickTargets = document.querySelectorAll("figure img, .three-col img, .two-col img");

  clickTargets.forEach(function (img) {
    img.addEventListener("click", function () {
      modalImg.src = img.currentSrc || img.src;
      modalImg.alt = img.alt || "";
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
    });
  });

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    modalImg.src = "";
  }

  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", function (event) {
    if (event.target === modal) closeModal();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modal.classList.contains("open")) closeModal();
  });
})();

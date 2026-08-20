/**
 * SomaStrong Fitness — shared site behaviour.
 * Plain script, no framework/runtime dependency (classic, not a module, so it
 * still runs when the site is previewed over file:// instead of a server).
 * Everything here is progressive enhancement: nav, gallery and form all work
 * (degraded) with this script absent, since they are plain links/anchors/native
 * form posts.
 */

// Flags the page as JS-enabled so CSS can gate animation-only styles
// (keeps content visible-by-default for no-JS / crawler visits).
document.documentElement.classList.add("js");

initHeader();
initMobileNav();
initScrollReveal();
initGalleries();
initContactForm();

/** Adds a stronger shadow/background once the page has scrolled a little, using a sentinel for cheap detection. */
function initHeader() {
  const header = document.querySelector("[data-header]");
  if (!header) return;

  const sentinel = document.createElement("div");
  sentinel.style.cssText = "position:absolute;top:0;left:0;height:1px;width:1px;";
  document.body.prepend(sentinel);

  const observer = new IntersectionObserver(([entry]) => {
    header.classList.toggle("is-scrolled", !entry.isIntersecting);
  });
  observer.observe(sentinel);
}

/** Accessible mobile menu: toggle button, Escape to close, click-outside to close. */
function initMobileNav() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const menu = document.querySelector("[data-nav-menu]");
  if (!toggle || !menu) return;

  const closeMenu = () => {
    toggle.setAttribute("aria-expanded", "false");
    menu.setAttribute("data-open", "false");
  };

  const openMenu = () => {
    toggle.setAttribute("aria-expanded", "true");
    menu.setAttribute("data-open", "true");
  };

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    isOpen ? closeMenu() : openMenu();
  });

  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      closeMenu();
      toggle.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    if (!menu.contains(event.target) && !toggle.contains(event.target)) closeMenu();
  });
}

/** Fades sections/cards in as they enter the viewport. No-op when reduced motion is requested. */
function initScrollReveal() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const items = document.querySelectorAll(".reveal");
  if (!items.length || prefersReducedMotion) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0, rootMargin: "0px 0px -10% 0px" }
  );

  items.forEach((item) => observer.observe(item));

  // Safety net: a fast anchor-jump or an IntersectionObserver edge case should never leave
  // content permanently invisible. Force-reveal anything still hidden shortly after load.
  setTimeout(() => {
    items.forEach((item) => item.classList.add("is-visible"));
    observer.disconnect();
  }, 2500);
}

/** Native scroll-snap galleries with prev/next controls and a live position counter. */
function initGalleries() {
  document.querySelectorAll("[data-gallery]").forEach((gallery) => {
    const track = gallery.querySelector("[data-gallery-track]");
    const prevBtn = gallery.querySelector("[data-gallery-prev]");
    const nextBtn = gallery.querySelector("[data-gallery-next]");
    const status = gallery.querySelector("[data-gallery-status]");
    const slides = track ? Array.from(track.children) : [];
    if (!track || !slides.length) return;

    const scrollToIndex = (index) => {
      const clamped = Math.max(0, Math.min(index, slides.length - 1));
      slides[clamped].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    };

    const currentIndex = () => {
      const trackRect = track.getBoundingClientRect();
      const center = trackRect.left + trackRect.width / 2;
      let closest = 0;
      let closestDistance = Infinity;
      slides.forEach((slide, index) => {
        const rect = slide.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - center);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = index;
        }
      });
      return closest;
    };

    const updateStatus = () => {
      const index = currentIndex();
      if (status) status.textContent = `${index + 1} / ${slides.length}`;
      if (prevBtn) prevBtn.disabled = index === 0;
      if (nextBtn) nextBtn.disabled = index === slides.length - 1;
    };

    prevBtn?.addEventListener("click", () => scrollToIndex(currentIndex() - 1));
    nextBtn?.addEventListener("click", () => scrollToIndex(currentIndex() + 1));

    let scrollTimeout;
    track.addEventListener(
      "scroll",
      () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(updateStatus, 100);
      },
      { passive: true }
    );

    updateStatus();
  });
}

/** Progressive-enhancement Netlify form submit: fetch in the background, show inline feedback. */
function initContactForm() {
  const form = document.querySelector("[data-contact-form]");
  if (!form) return;

  const feedback = form.querySelector("[data-form-feedback]");
  const submitBtn = form.querySelector("[data-form-submit]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Honeypot: Netlify's spam trap field. A filled value means a bot — silently succeed.
    const honeypot = form.querySelector('input[name="bot-field"]');
    if (honeypot && honeypot.value) {
      showFeedback("success");
      form.reset();
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    submitBtn?.setAttribute("disabled", "true");
    submitBtn && (submitBtn.textContent = "Sending…");

    try {
      const formData = new FormData(form);
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData).toString(),
      });
      if (!response.ok) throw new Error(`Form submission failed: ${response.status}`);
      showFeedback("success");
      form.reset();
    } catch (error) {
      console.error(error);
      showFeedback("error");
    } finally {
      submitBtn?.removeAttribute("disabled");
      submitBtn && (submitBtn.textContent = "Send message");
    }
  });

  function showFeedback(state) {
    if (!feedback) return;
    feedback.hidden = false;
    feedback.dataset.state = state;
    feedback.textContent =
      state === "success"
        ? "Thanks — your message is in! I'll get back to you within a couple of days."
        : "Something went wrong sending your message. Please try emailing somastrong29@gmail.com directly.";
    feedback.focus();
  }
}

(() => {
  const body = document.body;
  const header = document.querySelector(".site-header");
  const nav = document.querySelector("[data-nav]");
  const navToggle = document.querySelector("[data-nav-toggle]");
  const navLinks = Array.from(document.querySelectorAll("[data-nav-link]"));
  const revealNodes = Array.from(document.querySelectorAll(".reveal"));
  const sections = Array.from(document.querySelectorAll("main section[id]"));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setNavOpen = (isOpen) => {
    body.classList.toggle("nav-open", isOpen);
    if (navToggle) {
      navToggle.setAttribute("aria-expanded", String(isOpen));
    }
  };

  const updateHeader = () => {
    if (!header) {
      return;
    }

    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
      setNavOpen(!body.classList.contains("nav-open"));
    });

    document.addEventListener("click", (event) => {
      if (!body.classList.contains("nav-open")) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (nav.contains(target) || navToggle.contains(target)) {
        return;
      }

      setNavOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setNavOpen(false);
      }
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || !href.startsWith("#")) {
        return;
      }

      const target = document.querySelector(href);
      if (!target) {
        return;
      }

      event.preventDefault();
      target.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });

      history.replaceState(null, "", href);
      setNavOpen(false);
    });
  });

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -10% 0px",
      }
    );

    revealNodes.forEach((node) => revealObserver.observe(node));

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (!visible) {
          return;
        }

        navLinks.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`);
        });
      },
      {
        threshold: [0.2, 0.5, 0.8],
        rootMargin: "-35% 0px -45% 0px",
      }
    );

    sections.forEach((section) => sectionObserver.observe(section));
  } else {
    revealNodes.forEach((node) => node.classList.add("is-visible"));
  }

  const yearNode = document.querySelector("[data-year]");
  if (yearNode) {
    yearNode.textContent = String(new Date().getFullYear());
  }

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
})();

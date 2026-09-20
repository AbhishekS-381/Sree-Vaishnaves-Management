function initMain() {
  "use strict";
  const preloader = document.querySelector("#preloader");
  if (preloader) {
      preloader.remove();
  }

  // Wait for vendor scripts to load completely if they haven't yet, up to 3 seconds max
  window._initMainLoops = (window._initMainLoops || 0) + 1;
  if (window._initMainLoops < 30 && (typeof AOS === "undefined" || typeof GLightbox === "undefined" || typeof Swiper === "undefined")) {
      setTimeout(initMain, 100);
      return;
  }

  const selectHeader = document.querySelector("#header");
  if (selectHeader) {
    document.addEventListener("scroll", () => {
      window.scrollY > 100 ? selectHeader.classList.add("sticked") : selectHeader.classList.remove("sticked");
    });
  }

  let navbarlinks = document.querySelectorAll("#navbar a");

  function navbarlinksActive() {
    navbarlinks.forEach(navbarlink => {
      if (!navbarlink.hash) return;
      let section = document.querySelector(navbarlink.hash);
      if (!section) return;
      let position = window.scrollY + 200;
      if (position >= section.offsetTop && position <= (section.offsetTop + section.offsetHeight)) {
        navbarlink.classList.add("active");
      } else {
        navbarlink.classList.remove("active");
      }
    })
  }
  
  navbarlinksActive();
  document.addEventListener("scroll", navbarlinksActive);

  const mobileNavShow = document.querySelector(".mobile-nav-show");
  const mobileNavHide = document.querySelector(".mobile-nav-hide");

  document.querySelectorAll(".mobile-nav-toggle").forEach(el => {
    el.addEventListener("click", function(event) {
      event.preventDefault();
      mobileNavToogle();
    })
  });

  function mobileNavToogle() {
    document.querySelector("body").classList.toggle("mobile-nav-active");
    if(mobileNavShow) mobileNavShow.classList.toggle("d-none");
    if(mobileNavHide) mobileNavHide.classList.toggle("d-none");
  }

  document.querySelectorAll("#navbar a").forEach(navbarlink => {
    if (!navbarlink.hash) return;
    let section = document.querySelector(navbarlink.hash);
    if (!section) return;
    navbarlink.addEventListener("click", () => {
      if (document.querySelector(".mobile-nav-active")) {
        mobileNavToogle();
      }
    });
  });

  const navDropdowns = document.querySelectorAll(".navbar .dropdown > a");

  navDropdowns.forEach(el => {
    el.addEventListener("click", function(event) {
      if (document.querySelector(".mobile-nav-active")) {
        event.preventDefault();
        this.classList.toggle("active");
        if(this.nextElementSibling) this.nextElementSibling.classList.toggle("dropdown-active");
        let dropDownIndicator = this.querySelector(".dropdown-indicator");
        if(dropDownIndicator) {
            dropDownIndicator.classList.toggle("bi-chevron-up");
            dropDownIndicator.classList.toggle("bi-chevron-down");
        }
      }
    })
  });

  const scrollTop = document.querySelector(".scroll-top");
  if (scrollTop) {
    const togglescrollTop = function() {
      window.scrollY > 100 ? scrollTop.classList.add("active") : scrollTop.classList.remove("active");
    }
    togglescrollTop();
    document.addEventListener("scroll", togglescrollTop);
    scrollTop.addEventListener("click", () => window.scrollTo({
      top: 0,
      behavior: "smooth"
    }));
  }

  if (typeof GLightbox !== "undefined") {
      GLightbox({
        selector: ".glightbox"
      });
  }

  if (typeof PureCounter !== "undefined") {
      new PureCounter();
  }

  if (typeof Swiper !== "undefined") {
      new Swiper(".slides-1", {
        speed: 600,
        loop: true,
        autoplay: {
          delay: 5000,
          disableOnInteraction: false
        },
        slidesPerView: "auto",
        pagination: {
          el: ".swiper-pagination",
          type: "bullets",
          clickable: true
        },
        navigation: {
          nextEl: ".swiper-button-next",
          prevEl: ".swiper-button-prev",
        }
      });

      new Swiper(".slides-3", {
        speed: 600,
        loop: true,
        autoplay: {
          delay: 5000,
          disableOnInteraction: false
        },
        slidesPerView: "auto",
        pagination: {
          el: ".swiper-pagination",
          type: "bullets",
          clickable: true
        },
        navigation: {
          nextEl: ".swiper-button-next",
          prevEl: ".swiper-button-prev",
        },
        breakpoints: {
          320: { slidesPerView: 1, spaceBetween: 40 },
          1200: { slidesPerView: 3 }
        }
      });

      new Swiper(".gallery-slider", {
        speed: 400,
        loop: true,
        centeredSlides: true,
        autoplay: { delay: 5000, disableOnInteraction: false },
        slidesPerView: "auto",
        pagination: { el: ".swiper-pagination", type: "bullets", clickable: true },
        breakpoints: {
          320: { slidesPerView: 1, spaceBetween: 20 },
          640: { slidesPerView: 3, spaceBetween: 20 },
          992: { slidesPerView: 5, spaceBetween: 20 }
        }
      });
  }

  if (typeof AOS !== "undefined") {
      AOS.init({
        duration: 1000,
        easing: "ease-in-out",
        once: true,
        mirror: false
      });
  }
}

if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(initMain, 1);
} else {
    document.addEventListener("DOMContentLoaded", initMain);
}


/* ============================================
   EMBERSOME — Interactions & Animations
   ============================================ */

(function () {
  'use strict';

  // ---- DOM References ----
  var header = document.getElementById('header');
  var burger = document.getElementById('burger');
  var mobileNav = document.getElementById('mobileNav');
  var navLinks = document.querySelectorAll('.nav-link');
  var sections = document.querySelectorAll('section[id]');
  var reveals = document.querySelectorAll('.reveal');
  var offerCards = document.querySelectorAll('.offer-card__head');
  var faqItems = document.querySelectorAll('.faq-item__question');

  // ---- Header Scroll State ----
  function updateHeaderScroll() {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  // ---- Scroll Spy ----
  function updateScrollSpy() {
    var scrollPos = window.scrollY + header.offsetHeight + 100;
    var currentSection = '';
    sections.forEach(function (section) {
      var sectionTop = section.offsetTop;
      var sectionHeight = section.offsetHeight;
      if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
        currentSection = section.getAttribute('id');
      }
    });
    navLinks.forEach(function (link) {
      link.classList.remove('active');
      if (link.getAttribute('data-section') === currentSection) {
        link.classList.add('active');
      }
    });
  }

  // ---- Scroll Handler (throttled) ----
  var scrollTicking = false;
  window.addEventListener('scroll', function () {
    if (!scrollTicking) {
      window.requestAnimationFrame(function () {
        updateHeaderScroll();
        updateScrollSpy();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }, { passive: true });

  updateHeaderScroll();
  updateScrollSpy();

  // ---- Mobile Navigation ----
  function openMobileNav() {
    burger.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
    mobileNav.classList.add('open');
    mobileNav.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileNav() {
    burger.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    mobileNav.classList.remove('open');
    mobileNav.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  burger.addEventListener('click', function () {
    if (burger.classList.contains('open')) {
      closeMobileNav();
    } else {
      openMobileNav();
    }
  });

  // ---- Smooth Scroll for Anchor Links ----
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      // Skip if this link opens a modal — let the modal handler deal with it
      if (this.hasAttribute('data-open-modal')) return;

      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();
      closeMobileNav();

      var headerHeight = header.offsetHeight;
      var targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight;
      window.scrollTo({ top: targetPosition, behavior: 'smooth' });
    });
  });

  // ---- Reveal on Scroll (Intersection Observer) ----
  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(function (el) { revealObserver.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('visible'); });
  }

  // ---- Accordion: What We Offer ----
  offerCards.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.closest('.offer-card');
      var body = card.querySelector('.offer-card__body');
      var isOpen = btn.getAttribute('aria-expanded') === 'true';

      offerCards.forEach(function (otherBtn) {
        if (otherBtn !== btn) {
          otherBtn.setAttribute('aria-expanded', 'false');
          otherBtn.closest('.offer-card').querySelector('.offer-card__body').style.maxHeight = null;
        }
      });

      if (isOpen) {
        btn.setAttribute('aria-expanded', 'false');
        body.style.maxHeight = null;
      } else {
        btn.setAttribute('aria-expanded', 'true');
        body.style.maxHeight = body.scrollHeight + 'px';
      }
    });
  });

  // ---- Accordion: FAQ ----
  faqItems.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var answer = item.querySelector('.faq-item__answer');
      var isOpen = btn.getAttribute('aria-expanded') === 'true';

      faqItems.forEach(function (otherBtn) {
        if (otherBtn !== btn) {
          otherBtn.setAttribute('aria-expanded', 'false');
          otherBtn.closest('.faq-item').querySelector('.faq-item__answer').style.maxHeight = null;
        }
      });

      if (isOpen) {
        btn.setAttribute('aria-expanded', 'false');
        answer.style.maxHeight = null;
      } else {
        btn.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  // ============================================
  //  MODALS
  // ============================================

  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var firstInput = modal.querySelector('input, textarea');
    if (firstInput) setTimeout(function () { firstInput.focus(); }, 120);
  }

  function closeModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function closeAllModals() {
    document.querySelectorAll('.modal.open').forEach(function (m) {
      m.classList.remove('open');
      m.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = '';
  }

  // Open modal triggers
  document.querySelectorAll('[data-open-modal]').forEach(function (trigger) {
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      closeMobileNav();
      openModal(trigger.getAttribute('data-open-modal'));
    });
  });

  // Close modal triggers (backdrop + close button)
  document.querySelectorAll('[data-close-modal]').forEach(function (el) {
    el.addEventListener('click', function () {
      var modal = el.closest('.modal');
      if (modal) closeModal(modal.id);
    });
  });

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeAllModals();
      if (mobileNav.classList.contains('open')) closeMobileNav();
    }
  });

  // ============================================
  //  FORM SUBMISSIONS
  // ============================================

  function setFeedback(el, message, type) {
    el.textContent = message;
    el.className = 'form-feedback ' + type;
  }

  function clearFormErrors(form) {
    form.querySelectorAll('.error').forEach(function (el) {
      el.classList.remove('error');
    });
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ---- Apply Form ----
  var applyForm = document.getElementById('applyForm');
  var applyFeedback = document.getElementById('applyFeedback');

  if (applyForm) {
    applyForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearFormErrors(applyForm);
      setFeedback(applyFeedback, '', '');

      var submitBtn = applyForm.querySelector('button[type="submit"]');
      var data = {
        name: applyForm.querySelector('[name="name"]').value,
        email: applyForm.querySelector('[name="email"]').value,
        platforms: applyForm.querySelector('[name="platforms"]').value,
        audience: applyForm.querySelector('[name="audience"]').value,
        message: applyForm.querySelector('[name="message"]').value,
      };

      var valid = true;
      if (!data.name.trim()) {
        applyForm.querySelector('[name="name"]').classList.add('error');
        valid = false;
      }
      if (!data.email.trim() || !isValidEmail(data.email)) {
        applyForm.querySelector('[name="email"]').classList.add('error');
        valid = false;
      }
      if (!valid) {
        setFeedback(applyFeedback, 'Please fill in all required fields.', 'error');
        return;
      }

      submitBtn.classList.add('loading');
      submitBtn.disabled = true;

      fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(function (res) { return res.json(); })
        .then(function (result) {
          submitBtn.classList.remove('loading');
          submitBtn.disabled = false;
          if (result.success) {
            setFeedback(applyFeedback, result.message, 'success');
            applyForm.reset();
          } else {
            setFeedback(applyFeedback, (result.errors || ['Something went wrong.']).join(' '), 'error');
          }
        })
        .catch(function () {
          submitBtn.classList.remove('loading');
          submitBtn.disabled = false;
          setFeedback(applyFeedback, 'Network error. Please try again.', 'error');
        });
    });
  }

  // ---- Book a Call Form ----
  var bookForm = document.getElementById('bookForm');
  var bookFeedback = document.getElementById('bookFeedback');

  if (bookForm) {
    bookForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearFormErrors(bookForm);
      setFeedback(bookFeedback, '', '');

      var submitBtn = bookForm.querySelector('button[type="submit"]');
      var data = {
        name: bookForm.querySelector('[name="name"]').value,
        email: bookForm.querySelector('[name="email"]').value,
        preferredTime: bookForm.querySelector('[name="preferredTime"]').value,
        topic: bookForm.querySelector('[name="topic"]').value,
      };

      var valid = true;
      if (!data.name.trim()) {
        bookForm.querySelector('[name="name"]').classList.add('error');
        valid = false;
      }
      if (!data.email.trim() || !isValidEmail(data.email)) {
        bookForm.querySelector('[name="email"]').classList.add('error');
        valid = false;
      }
      if (!valid) {
        setFeedback(bookFeedback, 'Please fill in all required fields.', 'error');
        return;
      }

      submitBtn.classList.add('loading');
      submitBtn.disabled = true;

      fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(function (res) { return res.json(); })
        .then(function (result) {
          submitBtn.classList.remove('loading');
          submitBtn.disabled = false;
          if (result.success) {
            setFeedback(bookFeedback, result.message, 'success');
            bookForm.reset();
          } else {
            setFeedback(bookFeedback, (result.errors || ['Something went wrong.']).join(' '), 'error');
          }
        })
        .catch(function () {
          submitBtn.classList.remove('loading');
          submitBtn.disabled = false;
          setFeedback(bookFeedback, 'Network error. Please try again.', 'error');
        });
    });
  }

})();

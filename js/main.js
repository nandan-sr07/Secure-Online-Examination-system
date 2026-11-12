/**
 * main.js — General-purpose JavaScript for the Secure Online Examination System
 * Landing page utilities, navigation, animations, session management.
 *
 * SECURITY NOTES:
 *  - Passwords and authentication tokens are NEVER stored in localStorage or sessionStorage.
 *  - Only non-sensitive session state (e.g. UI preferences, exam progress) is stored client-side.
 *  - Sensitive auth tokens must be handled via HttpOnly cookies set by the server.
 *
 * Exported namespace: window.AppUtils
 */

(function (global) {
  'use strict';

  /* =========================================================
   * 0. CONSTANTS & CONFIG
   * ========================================================= */
  const SESSION_TIMEOUT_WARN_MS = 25 * 60 * 1000; // 25 minutes
  const SESSION_TIMEOUT_HARD_MS = 30 * 60 * 1000; // 30 minutes
  const SESSION_WARN_MODAL_ID   = 'session-timeout-modal';
  const SCROLL_TOP_THRESHOLD    = 300; // px before scroll-to-top button appears
  const LOGIN_PAGE              = '/frontend/pages/login.html';

  /* =========================================================
   * 1. DOM READY INITIALIZATION
   * ========================================================= */
  document.addEventListener('DOMContentLoaded', function () {
    initSmoothScroll();
    initHamburgerMenu();
    initNavbarScrollEffect();
    initScrollAnimations();
    initActiveNavLink();
    initScrollToTopButton();
    initPageTransitions();
    initSessionTimeoutWatcher();
    initModalCloseListeners();
  });

  /* =========================================================
   * 2. SMOOTH SCROLL FOR NAV LINKS
   * ========================================================= */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (!targetId || targetId === '#') return;
        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /* =========================================================
   * 3. MOBILE HAMBURGER MENU TOGGLE
   * ========================================================= */
  function initHamburgerMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu   = document.querySelector('.nav-menu');
    if (!hamburger || !navMenu) return;

    hamburger.addEventListener('click', function () {
      const isOpen = navMenu.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(isOpen));
      hamburger.classList.toggle('active', isOpen);
    });

    // Close menu when a link inside it is clicked
    navMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navMenu.classList.remove('open');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* =========================================================
   * 4. NAVBAR SCROLL EFFECT
   * ========================================================= */
  function initNavbarScrollEffect() {
    const navbar = document.querySelector('.navbar') || document.querySelector('nav');
    if (!navbar) return;

    function onScroll() {
      if (window.scrollY > 10) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // apply immediately in case page loaded scrolled
  }

  /* =========================================================
   * 5. INTERSECTION OBSERVER — SCROLL ANIMATIONS
   * ========================================================= */
  function initScrollAnimations() {
    const animatedEls = document.querySelectorAll('.fadeIn, .slideUp, .animate-on-scroll');
    if (!animatedEls.length || !('IntersectionObserver' in window)) {
      // Fallback: make all visible immediately
      animatedEls.forEach(function (el) { el.classList.add('visible'); });
      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    animatedEls.forEach(function (el) { observer.observe(el); });
  }

  /* =========================================================
   * 6. TOAST NOTIFICATION SYSTEM
   * ========================================================= */

  /**
   * showToast - displays a non-blocking toast notification.
   * @param {string} message  - The text to display (set via textContent, not innerHTML).
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} [duration=3500] - Auto-dismiss after this many ms.
   */
  function showToast(message, type, duration) {
    duration = duration || 3500;
    type     = type || 'info';

    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'false');
      document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'toast toast--' + type;
    toast.setAttribute('role', 'alert');

    var iconMap = { success: '✔', error: '✖', warning: '⚠', info: 'ℹ' };
    var icon = document.createElement('span');
    icon.className = 'toast__icon';
    icon.textContent = iconMap[type] || 'ℹ';

    var text = document.createElement('span');
    text.className = 'toast__message';
    text.textContent = message; // SAFE: textContent only

    var closeBtn = document.createElement('button');
    closeBtn.className = 'toast__close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.addEventListener('click', function () { dismissToast(toast); });

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { toast.classList.add('toast--show'); });
    });

    var timer = setTimeout(function () { dismissToast(toast); }, duration);
    toast._dismissTimer = timer;
  }

  function dismissToast(toast) {
    if (!toast || toast._dismissed) return;
    toast._dismissed = true;
    clearTimeout(toast._dismissTimer);
    toast.classList.remove('toast--show');
    toast.classList.add('toast--hide');
    toast.addEventListener('transitionend', function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, { once: true });
  }

  /* =========================================================
   * 7. MODAL SYSTEM
   * ========================================================= */

  /**
   * openModal - opens a modal by its DOM id.
   * @param {string} id
   */
  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('modal--open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    // Focus first focusable element
    var focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) setTimeout(function () { focusable.focus(); }, 50);
  }

  /**
   * closeModal - closes a modal by its DOM id.
   * @param {string} id
   */
  function closeModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('modal--open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function initModalCloseListeners() {
    // Close modal when clicking the backdrop
    document.addEventListener('click', function (e) {
      if (e.target && e.target.classList.contains('modal__backdrop')) {
        var modal = e.target.closest('.modal');
        if (modal && modal.id) closeModal(modal.id);
      }
    });

    // Close modal with close-button data attribute
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-modal-close]');
      if (!btn) return;
      var targetId = btn.getAttribute('data-modal-close');
      var modal    = targetId ? document.getElementById(targetId) : btn.closest('.modal');
      if (modal && modal.id) closeModal(modal.id);
    });

    // Close with Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var openModals = document.querySelectorAll('.modal.modal--open');
        openModals.forEach(function (m) { closeModal(m.id); });
      }
    });
  }

  /* =========================================================
   * 8. LOADING SPINNER
   * ========================================================= */
  var _loaderEl = null;

  function _ensureLoader() {
    if (!_loaderEl) {
      _loaderEl = document.getElementById('global-loader');
    }
    if (!_loaderEl) {
      _loaderEl = document.createElement('div');
      _loaderEl.id = 'global-loader';
      _loaderEl.setAttribute('role', 'status');
      _loaderEl.setAttribute('aria-label', 'Loading');
      _loaderEl.innerHTML = '<div class="loader__spinner"></div>';
      document.body.appendChild(_loaderEl);
    }
    return _loaderEl;
  }

  /** showLoader - displays the global full-page loading spinner. */
  function showLoader() {
    var loader = _ensureLoader();
    loader.classList.add('loader--visible');
    document.body.classList.add('loader-active');
  }

  /** hideLoader - hides the global loading spinner. */
  function hideLoader() {
    var loader = _ensureLoader();
    loader.classList.remove('loader--visible');
    document.body.classList.remove('loader-active');
  }

  /* =========================================================
   * 9. SESSION TIMEOUT WARNING
   * ========================================================= */
  var _sessionWarnTimer  = null;
  var _sessionHardTimer  = null;
  var _countdownInterval = null;
  var _lastActivity      = Date.now();

  function resetActivityTimers() {
    _lastActivity = Date.now();
    clearTimeout(_sessionWarnTimer);
    clearTimeout(_sessionHardTimer);

    _sessionWarnTimer = setTimeout(function () {
      showSessionTimeoutWarning();
    }, SESSION_TIMEOUT_WARN_MS);

    _sessionHardTimer = setTimeout(function () {
      clearInterval(_countdownInterval);
      global.location.href = LOGIN_PAGE;
    }, SESSION_TIMEOUT_HARD_MS);
  }

  function showSessionTimeoutWarning() {
    var remainingSecs = 5 * 60; // 5-minute countdown

    // Build or fetch the modal
    var modal = document.getElementById(SESSION_WARN_MODAL_ID);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = SESSION_WARN_MODAL_ID;
      modal.className = 'modal';
      modal.setAttribute('aria-hidden', 'true');
      modal.setAttribute('role', 'alertdialog');
      modal.setAttribute('aria-labelledby', 'session-timeout-title');

      var backdrop = document.createElement('div');
      backdrop.className = 'modal__backdrop';

      var box = document.createElement('div');
      box.className = 'modal__box';

      var title = document.createElement('h2');
      title.id = 'session-timeout-title';
      title.textContent = 'Session Timeout Warning';

      var body = document.createElement('p');
      body.id = 'session-timeout-body';

      var stayBtn = document.createElement('button');
      stayBtn.className = 'btn btn--primary';
      stayBtn.textContent = 'Stay Logged In';
      stayBtn.addEventListener('click', function () {
        clearInterval(_countdownInterval);
        closeModal(SESSION_WARN_MODAL_ID);
        resetActivityTimers();
      });

      var logoutBtn = document.createElement('button');
      logoutBtn.className = 'btn btn--secondary';
      logoutBtn.textContent = 'Logout Now';
      logoutBtn.addEventListener('click', function () {
        global.location.href = LOGIN_PAGE;
      });

      box.appendChild(title);
      box.appendChild(body);
      box.appendChild(stayBtn);
      box.appendChild(logoutBtn);
      modal.appendChild(backdrop);
      modal.appendChild(box);
      document.body.appendChild(modal);
    }

    openModal(SESSION_WARN_MODAL_ID);

    var bodyEl = document.getElementById('session-timeout-body');

    clearInterval(_countdownInterval);
    _countdownInterval = setInterval(function () {
      remainingSecs--;
      if (bodyEl) {
        bodyEl.textContent =
          'You will be automatically logged out in ' +
          formatTime(remainingSecs) +
          ' due to inactivity.';
      }
      if (remainingSecs <= 0) {
        clearInterval(_countdownInterval);
        global.location.href = LOGIN_PAGE;
      }
    }, 1000);

    if (bodyEl) {
      bodyEl.textContent =
        'You will be automatically logged out in ' +
        formatTime(remainingSecs) +
        ' due to inactivity.';
    }
  }

  function initSessionTimeoutWatcher() {
    var activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(function (evt) {
      document.addEventListener(evt, resetActivityTimers, { passive: true });
    });
    resetActivityTimers(); // start the initial timers
  }

  /* =========================================================
   * 10. UTILITY FUNCTIONS
   * ========================================================= */

  /**
   * sanitizeText - strips HTML tags; safe for setting via textContent.
   * NOTE: Always assign output to el.textContent, never el.innerHTML.
   * @param {string} str
   * @returns {string}
   */
  function sanitizeText(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.textContent;
  }

  /**
   * formatDate - formats an ISO date string to a human-readable date.
   * @param {string} dateStr - ISO date string, e.g. "2025-06-15T10:00:00Z"
   * @returns {string} e.g. "Jun 15, 2025"
   */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return sanitizeText(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch (e) {
      return sanitizeText(dateStr);
    }
  }

  /**
   * formatTime - converts seconds to MM:SS string.
   * @param {number} seconds
   * @returns {string} e.g. "04:35"
   */
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* =========================================================
   * 11. ACTIVE NAV LINK HIGHLIGHTING
   * ========================================================= */
  function initActiveNavLink() {
    var currentPath = global.location.pathname;
    var navLinks = document.querySelectorAll('.nav-menu a, .navbar a, nav a');
    navLinks.forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href) return;
      // Normalize: strip query/hash
      var linkPath = href.split('?')[0].split('#')[0];
      if (linkPath && currentPath.endsWith(linkPath)) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  /* =========================================================
   * 12. SCROLL TO TOP BUTTON
   * ========================================================= */
  function initScrollToTopButton() {
    var btn = document.getElementById('scroll-to-top');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'scroll-to-top';
      btn.className = 'scroll-top-btn';
      btn.setAttribute('aria-label', 'Scroll to top');
      btn.textContent = '↑';
      document.body.appendChild(btn);
    }

    function updateVisibility() {
      if (window.scrollY > SCROLL_TOP_THRESHOLD) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    }

    window.addEventListener('scroll', updateVisibility, { passive: true });

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    updateVisibility();
  }

  /* =========================================================
   * 13. PAGE TRANSITION EFFECT
   * ========================================================= */
  function initPageTransitions() {
    // Add fade-out class to body before navigating away
    document.querySelectorAll('a').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript') ||
          link.getAttribute('target') === '_blank') return;

      link.addEventListener('click', function (e) {
        // Only apply for same-origin navigation
        try {
          var url = new URL(href, global.location.origin);
          if (url.origin !== global.location.origin) return;
        } catch (_) { return; }

        e.preventDefault();
        var destination = href;
        document.body.classList.add('page-leaving');
        setTimeout(function () {
          global.location.href = destination;
        }, 250);
      });
    });

    // Fade-in on page load
    document.body.classList.add('page-entering');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.body.classList.remove('page-entering');
      });
    });
  }

  /* =========================================================
   * 14. COUNTDOWN TIMER FACTORY
   * Persists remaining time in sessionStorage (NOT localStorage),
   * keyed by examId, so page refresh restores remaining time.
   * ========================================================= */

  /**
   * createCountdownTimer - creates and starts a countdown timer.
   *
   * @param {number}   durationSeconds - Total duration of the timer.
   * @param {function} onTick          - Called every second with (remainingSeconds).
   * @param {function} onExpire        - Called when timer reaches 0.
   * @param {string}   examId          - Unique key; remaining time is saved in sessionStorage.
   * @returns {{ stop: function, getRemaining: function }}
   */
  function createCountdownTimer(durationSeconds, onTick, onExpire, examId) {
    var storageKey = examId ? 'exam_timer_' + examId : null;
    var remaining;

    // Restore from sessionStorage if resuming
    if (storageKey) {
      var stored = sessionStorage.getItem(storageKey);
      if (stored !== null) {
        var parsed = parseInt(stored, 10);
        remaining = (!isNaN(parsed) && parsed >= 0) ? parsed : durationSeconds;
      } else {
        remaining = durationSeconds;
      }
    } else {
      remaining = durationSeconds;
    }

    var intervalId = null;
    var stopped    = false;

    function tick() {
      if (stopped) return;
      remaining = Math.max(0, remaining - 1);

      if (storageKey) {
        sessionStorage.setItem(storageKey, String(remaining));
      }

      if (typeof onTick === 'function') onTick(remaining);

      if (remaining <= 0) {
        stop();
        if (typeof onExpire === 'function') onExpire();
      }
    }

    function stop() {
      stopped = true;
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (storageKey) {
        sessionStorage.removeItem(storageKey);
      }
    }

    function getRemaining() {
      return remaining;
    }

    // Immediately fire onTick so UI shows correct value before first second elapses
    if (typeof onTick === 'function') onTick(remaining);

    if (remaining > 0) {
      intervalId = setInterval(tick, 1000);
    } else {
      if (typeof onExpire === 'function') setTimeout(onExpire, 0);
    }

    return { stop: stop, getRemaining: getRemaining };
  }

  /* =========================================================
   * 15. BEFORE UNLOAD WARNING (for exam pages)
   * ========================================================= */
  var _beforeUnloadEnabled = false;

  function _beforeUnloadHandler(e) {
    e.preventDefault();
    e.returnValue = 'You are in an active exam. Leaving this page may result in your exam being submitted. Are you sure you want to leave?';
    return e.returnValue;
  }

  /**
   * beforeUnloadWarning - enables/disables the browser "leave page?" warning.
   * Call with true at exam start and false just before programmatic submit redirect.
   * @param {boolean} enable
   */
  function beforeUnloadWarning(enable) {
    if (enable && !_beforeUnloadEnabled) {
      global.addEventListener('beforeunload', _beforeUnloadHandler);
      _beforeUnloadEnabled = true;
    } else if (!enable && _beforeUnloadEnabled) {
      global.removeEventListener('beforeunload', _beforeUnloadHandler);
      _beforeUnloadEnabled = false;
    }
  }

  /* =========================================================
   * 16. EXPORT — window.AppUtils NAMESPACE
   * ========================================================= */
  global.AppUtils = {
    // Toast
    showToast: showToast,

    // Modal
    openModal:  openModal,
    closeModal: closeModal,

    // Loader
    showLoader: showLoader,
    hideLoader: hideLoader,

    // Utilities
    sanitizeText: sanitizeText,
    formatDate:   formatDate,
    formatTime:   formatTime,

    // Timer
    createCountdownTimer: createCountdownTimer,

    // Exam guards
    beforeUnloadWarning: beforeUnloadWarning,

    // Session
    resetActivityTimers: resetActivityTimers
  };

}(window));

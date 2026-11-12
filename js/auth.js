/**
 * auth.js — Authentication UI logic for the Secure Online Examination System.
 *
 * SECURITY NOTES (READ CAREFULLY):
 *  ─────────────────────────────────────────────────────────────────────────
 *  1. JWT / auth tokens MUST be handled via HttpOnly, Secure, SameSite cookies
 *     set exclusively by the Flask REST API server.
 *     NEVER store tokens in localStorage, sessionStorage, or JS variables that
 *     persist across page loads.
 *
 *  2. sessionStorage is used ONLY for non-sensitive, display-only user info
 *     (name, role, studentId). It is cleared on tab close.
 *     - Password is NEVER stored.
 *     - Token is NEVER stored on the client side outside an HttpOnly cookie.
 *
 *  3. The demo credential check in this file is a FRONTEND-ONLY STUB for UI
 *     development. In production, ALL credential verification happens on the
 *     server. Remove or gate the demo block before deploying to production.
 *  ─────────────────────────────────────────────────────────────────────────
 *
 * Dependencies: window.AppUtils (main.js), window.Validation (validation.js)
 * Exported namespace: window.Auth
 */

(function (global) {
  'use strict';

  /* =========================================================
   * CONSTANTS
   * ========================================================= */
  var SESSION_KEY        = 'exam_user';
  var ADMIN_DASHBOARD    = '/frontend/pages/admin-dashboard.html';
  var STUDENT_DASHBOARD  = '/frontend/pages/student-dashboard.html';
  var LOGIN_PAGE         = '/frontend/pages/login.html';
  var DEMO_MODE          = true; // Set to false when real backend is connected

  /* ─── Demo credentials (NEVER ship real credentials here) ── */
  var DEMO_ADMIN = {
    email:    'admin@exam.com',
    password: 'Admin@123',       // DEMO ONLY — backend validates in production
    user:     { name: 'Demo Admin', role: 'admin', studentId: null, email: 'admin@exam.com' }
  };
  var DEMO_STUDENT = {
    studentId: 'demo',
    password:  'Demo@123',       // DEMO ONLY
    user:      { name: 'Demo Student', role: 'student', studentId: 'demo', email: 'student@demo.com' }
  };

  /* =========================================================
   * 1. SESSION HELPERS
   *    Store/retrieve non-sensitive user info from sessionStorage.
   * ========================================================= */

  /**
   * getCurrentUser - returns non-sensitive user info from sessionStorage.
   * Returns null if no active session.
   * @returns {{name: string, role: string, studentId: string|null, email: string}|null}
   */
  function getCurrentUser() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      // Guard against accidentally stored tokens
      if (data && (data.token || data.password)) {
        clearCurrentUser();
        return null;
      }
      return data || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * setCurrentUser - stores only non-sensitive display info in sessionStorage.
   * Explicitly strips password and token before storing.
   * @param {{name, role, studentId, email}} userInfo
   */
  function setCurrentUser(userInfo) {
    if (!userInfo) return;
    // SECURITY: strip any accidentally passed sensitive fields
    var safe = {
      name:      userInfo.name      || '',
      role:      userInfo.role      || 'student',
      studentId: userInfo.studentId || null,
      email:     userInfo.email     || ''
      // password: explicitly omitted
      // token:    explicitly omitted
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(safe));
  }

  /**
   * clearCurrentUser - removes all user session info from sessionStorage.
   */
  function clearCurrentUser() {
    sessionStorage.removeItem(SESSION_KEY);
    // Also clear any exam state on logout
    Object.keys(sessionStorage).forEach(function (key) {
      if (key.startsWith('exam_')) {
        sessionStorage.removeItem(key);
      }
    });
  }

  /**
   * isLoggedIn - returns true if a non-sensitive user session exists.
   * @returns {boolean}
   */
  function isLoggedIn() {
    return getCurrentUser() !== null;
  }

  /* =========================================================
   * 2. ROUTE GUARD
   * ========================================================= */

  /**
   * requireAuth - redirects to login if user is not authenticated or
   * does not have the expected role. Call at the top of every protected page.
   * @param {'admin'|'student'|null} [expectedRole] - pass null to allow any role.
   */
  function requireAuth(expectedRole) {
    var user = getCurrentUser();
    if (!user) {
      var redirect = encodeURIComponent(global.location.pathname + global.location.search);
      global.location.href = LOGIN_PAGE + '?redirect=' + redirect;
      return;
    }
    if (expectedRole && user.role !== expectedRole) {
      // Wrong role — send to their own dashboard
      global.location.href = user.role === 'admin' ? ADMIN_DASHBOARD : STUDENT_DASHBOARD;
    }
  }

  /* =========================================================
   * 3. LOGOUT
   * ========================================================= */

  /**
   * logout - clears session, shows confirmation, redirects to login.
   */
  function logout() {
    var AppUtils = global.AppUtils || {};

    if (typeof AppUtils.beforeUnloadWarning === 'function') {
      AppUtils.beforeUnloadWarning(false); // disable exam guard if active
    }

    clearCurrentUser();

    if (typeof AppUtils.showToast === 'function') {
      AppUtils.showToast('You have been logged out successfully.', 'success');
    }

    setTimeout(function () {
      global.location.href = LOGIN_PAGE;
    }, 800);
  }

  /* =========================================================
   * 4. ERROR DISPLAY
   * ========================================================= */

  /**
   * showAuthError - displays an error message in the auth error container.
   * Uses textContent (never innerHTML) to prevent XSS.
   * @param {string} message
   */
  function showAuthError(message) {
    var errorDiv = document.getElementById('auth-error') ||
                   document.querySelector('.auth-error');
    if (!errorDiv) {
      // Create one if it doesn't exist
      errorDiv = document.createElement('div');
      errorDiv.id = 'auth-error';
      errorDiv.className = 'auth-error alert alert--error';
      errorDiv.setAttribute('role', 'alert');
      var form = document.querySelector('form');
      if (form) form.insertAdjacentElement('beforebegin', errorDiv);
      else document.body.prepend(errorDiv);
    }
    errorDiv.textContent = message; // SAFE: textContent only
    errorDiv.style.display = 'block';
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function _hideAuthError() {
    var errorDiv = document.getElementById('auth-error') ||
                   document.querySelector('.auth-error');
    if (errorDiv) {
      errorDiv.textContent = '';
      errorDiv.style.display = 'none';
    }
  }

  /* =========================================================
   * 5. DEMO MODE BANNER
   * ========================================================= */
  function _injectDemoBanner() {
    if (!DEMO_MODE) return;
    if (document.getElementById('demo-mode-banner')) return;

    var banner = document.createElement('div');
    banner.id = 'demo-mode-banner';
    banner.className = 'demo-banner';
    banner.setAttribute('role', 'note');

    var strong = document.createElement('strong');
    strong.textContent = 'Demo Mode: ';

    var text = document.createTextNode(
      'This is a UI demo. No real authentication is performed. ' +
      'Real auth requires a connected Flask backend with HttpOnly cookie sessions.'
    );

    banner.appendChild(strong);
    banner.appendChild(text);
    document.body.insertBefore(banner, document.body.firstChild);
  }

  /* =========================================================
   * 6. ROLE-BASED REDIRECT
   * ========================================================= */
  function _redirectByRole(role) {
    var url = role === 'admin' ? ADMIN_DASHBOARD : STUDENT_DASHBOARD;
    // Check for a ?redirect= param (set by requireAuth)
    var params = new URLSearchParams(global.location.search);
    var redirect = params.get('redirect');
    if (redirect) {
      // Validate redirect is same-origin to prevent open-redirect attacks
      try {
        var parsed = new URL(decodeURIComponent(redirect), global.location.origin);
        if (parsed.origin === global.location.origin) {
          url = parsed.pathname + parsed.search;
        }
      } catch (e) { /* ignore invalid redirect */ }
    }
    global.location.href = url;
  }

  /* =========================================================
   * 7. DEMO CREDENTIAL CHECK  (frontend stub only)
   *    TODO: Replace with real API call in production.
   * ========================================================= */

  /**
   * submitLoginRequest - demo stub for login API call.
   *
   * TODO (Backend integration):
   *   POST /api/auth/login
   *   Body: { email, password, role }  (over HTTPS only)
   *   Server response sets an HttpOnly session cookie.
   *   Server response body should include only non-sensitive user info.
   *   DO NOT send token in JSON body to be stored client-side.
   *
   * @param {{email, password, studentId, role}} formData
   */
  function submitLoginRequest(formData, role) {
    var AppUtils   = global.AppUtils   || {};
    var hideLoader = AppUtils.hideLoader || function () {};
    var showToast  = AppUtils.showToast  || function () {};

    var matchedUser = null;

    if (DEMO_MODE) {
      // ── DEMO credential check ── remove/gate before production ──
      if (role === 'admin') {
        if (
          formData.email    === DEMO_ADMIN.email &&
          formData.password === DEMO_ADMIN.password
        ) {
          matchedUser = DEMO_ADMIN.user;
        }
      } else {
        var inputId = formData.studentId || formData.email;
        if (
          inputId               === DEMO_STUDENT.studentId &&
          formData.password     === DEMO_STUDENT.password
        ) {
          matchedUser = DEMO_STUDENT.user;
        }
      }
      // ── END DEMO ────────────────────────────────────────────────

      hideLoader();

      if (matchedUser) {
        setCurrentUser(matchedUser);
        showToast('Login successful! Welcome, ' + matchedUser.name + '.', 'success');
        setTimeout(function () { _redirectByRole(matchedUser.role); }, 600);
      } else {
        showAuthError('Invalid credentials. Please check your ' +
          (role === 'admin' ? 'email' : 'Student ID') + ' and password.');
        showToast('Login failed. Please try again.', 'error');
      }
    } else {
      // TODO: POST /api/auth/login
      // fetch('/api/auth/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   credentials: 'include',   // <-- sends/receives HttpOnly cookies
      //   body: JSON.stringify({ email: formData.email, password: formData.password, role: role })
      // })
      // .then(function(res) { return res.json(); })
      // .then(function(data) {
      //   if (data.success) {
      //     setCurrentUser(data.user);  // data.user has NO token or password
      //     _redirectByRole(data.user.role);
      //   } else {
      //     showAuthError(data.message || 'Login failed.');
      //   }
      // })
      // .catch(function() {
      //   showAuthError('A network error occurred. Please try again.');
      // })
      // .finally(function() { hideLoader(); });

      hideLoader();
      showAuthError('Backend not connected. Enable demo mode or configure the API.');
    }
  }

  /* =========================================================
   * 8. FORM SUBMIT HANDLERS
   * ========================================================= */

  /**
   * handleLoginFormSubmit - event handler for login form submission.
   * @param {Event}          event
   * @param {HTMLFormElement} formEl
   * @param {'admin'|'student'} role
   */
  function handleLoginFormSubmit(event, formEl, role) {
    event.preventDefault();
    _hideAuthError();

    var Validation = global.Validation || {};
    var AppUtils   = global.AppUtils   || {};
    var showLoader = AppUtils.showLoader || function () {};

    if (typeof Validation.clearErrors === 'function') {
      Validation.clearErrors(formEl);
    }

    var formData = {};
    if (role === 'admin') {
      formData.email    = (formEl.querySelector('[name="email"]')    || {}).value || '';
      formData.password = (formEl.querySelector('[name="password"]') || {}).value || '';
      formData.role     = 'admin';
    } else {
      formData.studentId = (formEl.querySelector('[name="studentId"]') || formEl.querySelector('[name="email"]') || {}).value || '';
      formData.password  = (formEl.querySelector('[name="password"]')  || {}).value || '';
      formData.role      = 'student';
    }

    var validation = typeof Validation.validateLoginForm === 'function'
      ? Validation.validateLoginForm(formData)
      : { valid: true, errors: {} };

    if (!validation.valid) {
      if (typeof Validation.displayErrors === 'function') {
        Validation.displayErrors(validation.errors);
      }
      return;
    }

    var reenable = typeof Validation.preventDoubleSubmit === 'function'
      ? Validation.preventDoubleSubmit(formEl)
      : function () {};

    showLoader();
    submitLoginRequest(formData, role);

    // Re-enable on next tick if submitLoginRequest is synchronous (demo)
    setTimeout(reenable, 1200);
  }

  /**
   * handleRegisterFormSubmit - event handler for registration form submission.
   * @param {Event}           event
   * @param {HTMLFormElement}  formEl
   */
  function handleRegisterFormSubmit(event, formEl) {
    event.preventDefault();
    _hideAuthError();

    var Validation = global.Validation || {};
    var AppUtils   = global.AppUtils   || {};
    var showLoader = AppUtils.showLoader || function () {};
    var hideLoader = AppUtils.hideLoader || function () {};
    var showToast  = AppUtils.showToast  || function () {};

    if (typeof Validation.clearErrors === 'function') {
      Validation.clearErrors(formEl);
    }

    var formData = {
      name:            (formEl.querySelector('[name="name"]')            || {}).value || '',
      email:           (formEl.querySelector('[name="email"]')           || {}).value || '',
      studentId:       (formEl.querySelector('[name="studentId"]')       || {}).value || '',
      password:        (formEl.querySelector('[name="password"]')        || {}).value || '',
      confirmPassword: (formEl.querySelector('[name="confirmPassword"]') || {}).value || ''
    };

    var validation = typeof Validation.validateRegistrationForm === 'function'
      ? Validation.validateRegistrationForm(formData)
      : { valid: true, errors: {} };

    if (!validation.valid) {
      if (typeof Validation.displayErrors === 'function') {
        Validation.displayErrors(validation.errors);
      }
      return;
    }

    var reenable = typeof Validation.preventDoubleSubmit === 'function'
      ? Validation.preventDoubleSubmit(formEl)
      : function () {};

    showLoader();

    // TODO: POST /api/auth/register
    // fetch('/api/auth/register', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   credentials: 'include',
    //   body: JSON.stringify({ name: formData.name, email: formData.email,
    //                          studentId: formData.studentId, password: formData.password })
    // }) ...

    // DEMO: simulate a short network delay
    setTimeout(function () {
      hideLoader();
      reenable();
      if (DEMO_MODE) {
        showToast('Registration successful (demo)! Please log in.', 'success');
        setTimeout(function () { global.location.href = LOGIN_PAGE; }, 1200);
      } else {
        showAuthError('Backend not connected. Registration requires the Flask API.');
      }
    }, 900);
  }

  /* =========================================================
   * DOM READY — inject demo banner if on auth pages
   * ========================================================= */
  document.addEventListener('DOMContentLoaded', function () {
    _injectDemoBanner();
  });

  /* =========================================================
   * EXPORT — window.Auth NAMESPACE
   * ========================================================= */
  global.Auth = {
    getCurrentUser:             getCurrentUser,
    setCurrentUser:             setCurrentUser,
    clearCurrentUser:           clearCurrentUser,
    isLoggedIn:                 isLoggedIn,
    requireAuth:                requireAuth,
    logout:                     logout,
    showAuthError:              showAuthError,
    handleLoginFormSubmit:      handleLoginFormSubmit,
    handleRegisterFormSubmit:   handleRegisterFormSubmit,
    submitLoginRequest:         submitLoginRequest
  };

}(window));

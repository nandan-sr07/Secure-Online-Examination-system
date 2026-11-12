/**
 * validation.js — Client-side form validation for the Secure Online Examination System.
 *
 * SECURITY NOTES:
 *  - All validation here is for UX only. Server-side validation is mandatory.
 *  - Error messages are always set via textContent (never innerHTML) to prevent XSS.
 *  - This module does NOT handle passwords in localStorage or cookies.
 *
 * Exported namespace: window.Validation
 */

(function (global) {
  'use strict';

  /* =========================================================
   * CONSTANTS
   * ========================================================= */
  // Password must be 8+ chars, with uppercase, lowercase, digit, special char
  var PASSWORD_REGEX   = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
  var EMAIL_REGEX      = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var NAME_REGEX       = /^[A-Za-z\s\-']{2,60}$/;
  var STUDENT_ID_REGEX = /^[A-Za-z0-9\-_]{4,20}$/;

  /* =========================================================
   * 1. FIELD VALIDATORS (each returns {valid, message})
   * ========================================================= */

  /**
   * validateEmail - validates an email address.
   * @param {string} email
   * @returns {{valid: boolean, message: string}}
   */
  function validateEmail(email) {
    if (!email || !email.trim()) {
      return { valid: false, message: 'Email address is required.' };
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      return { valid: false, message: 'Please enter a valid email address.' };
    }
    return { valid: true, message: '' };
  }

  /**
   * validatePassword - validates a password for strength and rules.
   * @param {string} password
   * @returns {{valid: boolean, message: string, strength: 'weak'|'medium'|'strong'}}
   */
  function validatePassword(password) {
    if (!password) {
      return { valid: false, message: 'Password is required.', strength: 'weak' };
    }
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters.', strength: 'weak' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter.', strength: 'weak' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter.', strength: 'weak' };
    }
    if (!/\d/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number.', strength: 'medium' };
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one special character.', strength: 'medium' };
    }

    var info = getPasswordStrength(password);
    var strength = info.score >= 3 ? 'strong' : (info.score >= 2 ? 'medium' : 'weak');
    return { valid: true, message: '', strength: strength };
  }

  /**
   * validateName - validates a display name.
   * @param {string} name
   * @returns {{valid: boolean, message: string}}
   */
  function validateName(name) {
    if (!name || !name.trim()) {
      return { valid: false, message: 'Full name is required.' };
    }
    if (!NAME_REGEX.test(name.trim())) {
      return { valid: false, message: 'Name must be 2–60 characters and contain only letters, spaces, hyphens, or apostrophes.' };
    }
    return { valid: true, message: '' };
  }

  /**
   * validateStudentId - validates a student ID.
   * @param {string} id
   * @returns {{valid: boolean, message: string}}
   */
  function validateStudentId(id) {
    if (!id || !id.trim()) {
      return { valid: false, message: 'Student ID is required.' };
    }
    if (!STUDENT_ID_REGEX.test(id.trim())) {
      return { valid: false, message: 'Student ID must be 4–20 alphanumeric characters (hyphens and underscores allowed).' };
    }
    return { valid: true, message: '' };
  }

  /**
   * validateRequired - checks that a field is not empty.
   * @param {string} value
   * @param {string} fieldName - Human-readable field name for the error message.
   * @returns {{valid: boolean, message: string}}
   */
  function validateRequired(value, fieldName) {
    var label = fieldName || 'This field';
    if (value === null || value === undefined || String(value).trim() === '') {
      return { valid: false, message: label + ' is required.' };
    }
    return { valid: true, message: '' };
  }

  /**
   * validatePasswordMatch - checks that two passwords are identical.
   * @param {string} p1
   * @param {string} p2
   * @returns {{valid: boolean, message: string}}
   */
  function validatePasswordMatch(p1, p2) {
    if (!p1 || !p2) {
      return { valid: false, message: 'Please fill in both password fields.' };
    }
    if (p1 !== p2) {
      return { valid: false, message: 'Passwords do not match.' };
    }
    return { valid: true, message: '' };
  }

  /* =========================================================
   * 2. PASSWORD STRENGTH
   * ========================================================= */

  /**
   * getPasswordStrength - returns a detailed strength analysis.
   * @param {string} password
   * @returns {{strength: string, score: number, label: string, color: string}}
   *          score: 0–4; label: 'Weak'|'Fair'|'Good'|'Strong'; color: CSS color
   */
  function getPasswordStrength(password) {
    if (!password) return { strength: 'weak', score: 0, label: 'Weak', color: '#e53e3e' };

    var score = 0;
    if (password.length >= 8)  score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password))   score++;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score++;

    // Cap at 4
    score = Math.min(score, 4);

    var map = [
      { strength: 'weak',   label: 'Weak',   color: '#e53e3e' },
      { strength: 'weak',   label: 'Weak',   color: '#e53e3e' },
      { strength: 'medium', label: 'Fair',   color: '#dd6b20' },
      { strength: 'medium', label: 'Good',   color: '#d69e2e' },
      { strength: 'strong', label: 'Strong', color: '#38a169' }
    ];

    return Object.assign({ score: score }, map[score]);
  }

  /* =========================================================
   * 3. FORM-LEVEL VALIDATORS
   * ========================================================= */

  /**
   * validateRegistrationForm - validates the full registration form.
   * @param {{name, email, studentId, password, confirmPassword}} formData
   * @returns {{valid: boolean, errors: Object.<string, string>}}
   */
  function validateRegistrationForm(formData) {
    var errors = {};

    var nameResult = validateName(formData.name);
    if (!nameResult.valid) errors.name = nameResult.message;

    var emailResult = validateEmail(formData.email);
    if (!emailResult.valid) errors.email = emailResult.message;

    var idResult = validateStudentId(formData.studentId);
    if (!idResult.valid) errors.studentId = idResult.message;

    var passResult = validatePassword(formData.password);
    if (!passResult.valid) errors.password = passResult.message;

    var matchResult = validatePasswordMatch(formData.password, formData.confirmPassword);
    if (!matchResult.valid) errors.confirmPassword = matchResult.message;

    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /**
   * validateLoginForm - validates the login form.
   * @param {{email, password, role}} formData  (email may be studentId for student role)
   * @returns {{valid: boolean, errors: Object.<string, string>}}
   */
  function validateLoginForm(formData) {
    var errors = {};

    if (formData.role === 'student') {
      var idResult = validateStudentId(formData.studentId || formData.email);
      if (!idResult.valid) errors.email = 'Please enter a valid Student ID.';
    } else {
      var emailResult = validateEmail(formData.email);
      if (!emailResult.valid) errors.email = emailResult.message;
    }

    var reqPass = validateRequired(formData.password, 'Password');
    if (!reqPass.valid) errors.password = reqPass.message;

    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /**
   * validateExamForm - validates the admin exam creation form.
   * @param {{title, subject, duration, date, totalQuestions}} formData
   * @returns {{valid: boolean, errors: Object.<string, string>}}
   */
  function validateExamForm(formData) {
    var errors = {};

    var titleReq = validateRequired(formData.title, 'Exam title');
    if (!titleReq.valid) errors.title = titleReq.message;
    else if (String(formData.title).trim().length < 3)
      errors.title = 'Exam title must be at least 3 characters.';

    var subjectReq = validateRequired(formData.subject, 'Subject');
    if (!subjectReq.valid) errors.subject = subjectReq.message;

    var duration = parseInt(formData.duration, 10);
    if (!formData.duration || isNaN(duration) || duration < 5 || duration > 360) {
      errors.duration = 'Duration must be between 5 and 360 minutes.';
    }

    var dateReq = validateRequired(formData.date, 'Exam date');
    if (!dateReq.valid) {
      errors.date = dateReq.message;
    } else {
      var examDate = new Date(formData.date);
      if (isNaN(examDate.getTime())) {
        errors.date = 'Please enter a valid date.';
      }
    }

    var totalQ = parseInt(formData.totalQuestions, 10);
    if (formData.totalQuestions !== undefined && (isNaN(totalQ) || totalQ < 1 || totalQ > 200)) {
      errors.totalQuestions = 'Number of questions must be between 1 and 200.';
    }

    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /* =========================================================
   * 4. FORM SUBMISSION GUARD
   * ========================================================= */

  /**
   * preventDoubleSubmit - disables submit button after first click.
   * @param {HTMLFormElement} formElement
   * @returns {function} - call to re-enable (on error)
   */
  function preventDoubleSubmit(formElement) {
    if (!formElement) return function () {};

    var submitBtn = formElement.querySelector('[type="submit"]');
    if (!submitBtn) return function () {};

    var originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');

    // Show a subtle spinner in button text (text-only, safe)
    submitBtn.textContent = 'Processing...';

    function reenable() {
      submitBtn.disabled = false;
      submitBtn.removeAttribute('aria-busy');
      submitBtn.textContent = originalText;
    }

    return reenable;
  }

  /* =========================================================
   * 5. REAL-TIME VALIDATION
   * ========================================================= */

  /**
   * attachRealtimeValidation - shows inline error on blur/input.
   * @param {HTMLInputElement} inputEl
   * @param {function} validatorFn - function(value) => {valid, message}
   */
  function attachRealtimeValidation(inputEl, validatorFn) {
    if (!inputEl || typeof validatorFn !== 'function') return;

    // Find or create an error element associated with this input
    var errorId  = inputEl.id ? inputEl.id + '-error' : null;
    var errorEl  = errorId ? document.getElementById(errorId) : null;

    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.className = 'field-error';
      errorEl.setAttribute('role', 'alert');
      if (errorId) errorEl.id = errorId;
      if (inputEl.parentNode) inputEl.parentNode.appendChild(errorEl);
    }

    if (errorId) {
      inputEl.setAttribute('aria-describedby', errorId);
    }

    function runValidation() {
      var result = validatorFn(inputEl.value);
      if (!result.valid) {
        errorEl.textContent = result.message; // SAFE: textContent only
        inputEl.classList.add('input--error');
        inputEl.classList.remove('input--valid');
      } else {
        errorEl.textContent = '';
        inputEl.classList.remove('input--error');
        inputEl.classList.add('input--valid');
      }
    }

    inputEl.addEventListener('blur', runValidation);
    // Also validate on input after the user has already triggered a blur
    inputEl.addEventListener('input', function () {
      if (inputEl.classList.contains('input--error') ||
          inputEl.classList.contains('input--valid')) {
        runValidation();
      }
    });
  }

  /* =========================================================
   * 6. PASSWORD STRENGTH INDICATOR
   * ========================================================= */

  /**
   * updateStrengthIndicator - updates a strength bar and label element.
   * @param {string}      password
   * @param {HTMLElement} barElement   - the colored bar (width will be set via style)
   * @param {HTMLElement} labelElement - the text label
   */
  function updateStrengthIndicator(password, barElement, labelElement) {
    var info = getPasswordStrength(password || '');
    var pct  = (info.score / 4) * 100;

    if (barElement) {
      barElement.style.width = pct + '%';
      barElement.style.backgroundColor = info.color;
      barElement.setAttribute('aria-valuenow', String(info.score));
    }

    if (labelElement) {
      labelElement.textContent = password ? info.label : ''; // SAFE: textContent
      labelElement.style.color = info.color;
    }
  }

  /* =========================================================
   * 7. PASSWORD VISIBILITY TOGGLE
   * ========================================================= */

  /**
   * attachPasswordToggle - wires a show/hide toggle button to a password input.
   * @param {HTMLInputElement} inputEl
   * @param {HTMLButtonElement} toggleBtn
   */
  function attachPasswordToggle(inputEl, toggleBtn) {
    if (!inputEl || !toggleBtn) return;

    toggleBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var isPassword = inputEl.type === 'password';
      inputEl.type = isPassword ? 'text' : 'password';
      toggleBtn.textContent = isPassword ? 'Hide' : 'Show';
      toggleBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  }

  /* =========================================================
   * 8. HELPER — display validation errors from an errors map
   * ========================================================= */

  /**
   * displayErrors - utility to show errors from a validateXxxForm call.
   * @param {Object.<string, string>} errors - {fieldName: errorMessage}
   * @param {string} [prefix=''] - prefix for error element IDs (e.g. 'reg-')
   */
  function displayErrors(errors, prefix) {
    prefix = prefix || '';
    Object.keys(errors).forEach(function (field) {
      var errorEl = document.getElementById(prefix + field + '-error');
      if (errorEl) {
        errorEl.textContent = errors[field]; // SAFE: textContent
      }
      var inputEl = document.getElementById(prefix + field) ||
                    document.querySelector('[name="' + field + '"]');
      if (inputEl) {
        inputEl.classList.add('input--error');
      }
    });
  }

  /**
   * clearErrors - clears all displayed validation errors in a form.
   * @param {HTMLFormElement} formEl
   */
  function clearErrors(formEl) {
    if (!formEl) return;
    formEl.querySelectorAll('.field-error').forEach(function (el) {
      el.textContent = '';
    });
    formEl.querySelectorAll('.input--error').forEach(function (el) {
      el.classList.remove('input--error');
    });
  }

  /* =========================================================
   * EXPORT — window.Validation NAMESPACE
   * ========================================================= */
  global.Validation = {
    // Field validators
    validateEmail:         validateEmail,
    validatePassword:      validatePassword,
    validateName:          validateName,
    validateStudentId:     validateStudentId,
    validateRequired:      validateRequired,
    validatePasswordMatch: validatePasswordMatch,

    // Strength
    getPasswordStrength:       getPasswordStrength,
    updateStrengthIndicator:   updateStrengthIndicator,

    // Form-level validators
    validateRegistrationForm: validateRegistrationForm,
    validateLoginForm:        validateLoginForm,
    validateExamForm:         validateExamForm,

    // UX helpers
    preventDoubleSubmit:      preventDoubleSubmit,
    attachRealtimeValidation: attachRealtimeValidation,
    attachPasswordToggle:     attachPasswordToggle,
    displayErrors:            displayErrors,
    clearErrors:              clearErrors
  };

}(window));

/**
 * exam.js — Exam page logic for the Secure Online Examination System.
 *
 * SECURITY NOTES:
 *  ─────────────────────────────────────────────────────────────────────────
 *  1. Answer VERIFICATION must happen server-side. The correct answers
 *     included in SAMPLE_EXAM_DATA are present here for demo scoring only.
 *     In production, correct answers MUST NOT be sent to the client; the
 *     client should only submit answers and the server calculates the score.
 *
 *  2. Exam state is stored in sessionStorage (NOT localStorage), so it is
 *     cleared when the browser tab closes.
 *
 *  3. The beforeunload warning is enabled during the exam to warn students
 *     before navigating away, and disabled just before programmatic redirect
 *     so the submit flow is seamless.
 *  ─────────────────────────────────────────────────────────────────────────
 *
 * Dependencies: window.AppUtils (main.js)
 * Exported namespace: window.Exam
 */

(function (global) {
  'use strict';

  /* =========================================================
   * SAMPLE EXAM DATA
   * 15 MCQ questions across 3 subjects.
   * NOTE: In a real application, correctAnswer should NEVER be sent to the
   * client. It is included here only for demo score calculation.
   * ========================================================= */
  var SAMPLE_EXAM_DATA = {
    EX_DEMO: {
      id:       'EX_DEMO',
      title:    'General Knowledge Assessment',
      duration: 30 * 60, // 30 minutes in seconds
      questions: [
        // ── Computer Science (5 questions) ──────────────────────────
        {
          subject: 'Computer Science',
          text: 'Which data structure operates on a Last-In, First-Out (LIFO) principle?',
          options: ['Queue', 'Stack', 'Linked List', 'Tree'],
          correctAnswer: 1
        },
        {
          subject: 'Computer Science',
          text: 'What is the time complexity of binary search on a sorted array of n elements?',
          options: ['O(n)', 'O(n²)', 'O(log n)', 'O(1)'],
          correctAnswer: 2
        },
        {
          subject: 'Computer Science',
          text: 'Which of the following is NOT an object-oriented programming language?',
          options: ['Java', 'Python', 'C', 'C++'],
          correctAnswer: 2
        },
        {
          subject: 'Computer Science',
          text: 'In networking, what does HTTP stand for?',
          options: [
            'HyperText Transfer Protocol',
            'High Transfer Text Protocol',
            'HyperText Transmission Process',
            'Host Transfer Text Protocol'
          ],
          correctAnswer: 0
        },
        {
          subject: 'Computer Science',
          text: 'Which sorting algorithm has the best average-case time complexity?',
          options: ['Bubble Sort', 'Selection Sort', 'Merge Sort', 'Insertion Sort'],
          correctAnswer: 2
        },
        // ── Mathematics (5 questions) ────────────────────────────────
        {
          subject: 'Mathematics',
          text: 'What is the derivative of sin(x)?',
          options: ['cos(x)', '-cos(x)', '-sin(x)', 'tan(x)'],
          correctAnswer: 0
        },
        {
          subject: 'Mathematics',
          text: 'What is the value of log₁₀(1000)?',
          options: ['2', '3', '4', '10'],
          correctAnswer: 1
        },
        {
          subject: 'Mathematics',
          text: 'Which of the following is a prime number?',
          options: ['1', '51', '57', '67'],
          correctAnswer: 3
        },
        {
          subject: 'Mathematics',
          text: 'The sum of angles in a triangle is always:',
          options: ['90°', '180°', '270°', '360°'],
          correctAnswer: 1
        },
        {
          subject: 'Mathematics',
          text: 'If f(x) = x² + 3x, what is f(2)?',
          options: ['8', '10', '7', '12'],
          correctAnswer: 1
        },
        // ── English (5 questions) ────────────────────────────────────
        {
          subject: 'English',
          text: 'Which sentence uses the correct form of "there/their/they\'re"?',
          options: [
            'Their going to the park.',
            'The books are over there.',
            'There books are on the shelf.',
            'They\'re dog is friendly.'
          ],
          correctAnswer: 1
        },
        {
          subject: 'English',
          text: 'What is the synonym of "eloquent"?',
          options: ['Inarticulate', 'Articulate', 'Verbose', 'Taciturn'],
          correctAnswer: 1
        },
        {
          subject: 'English',
          text: 'Which literary device involves giving human qualities to non-human things?',
          options: ['Metaphor', 'Simile', 'Personification', 'Alliteration'],
          correctAnswer: 2
        },
        {
          subject: 'English',
          text: 'Identify the correct passive voice: "The report was written ___."',
          options: ['by her', 'from her', 'with her', 'through her'],
          correctAnswer: 0
        },
        {
          subject: 'English',
          text: 'What is the plural of "criterion"?',
          options: ['Criterions', 'Criterias', 'Criteria', 'Criterium'],
          correctAnswer: 2
        }
      ]
    }
  };

  /* =========================================================
   * STATE
   * ========================================================= */
  var _examData  = null; // active exam definition
  var _state     = null; // exam state object (persisted to sessionStorage)
  var _timer     = null; // timer handle returned by createCountdownTimer

  /* =========================================================
   * 1. STATE PERSISTENCE (sessionStorage)
   * ========================================================= */
  function _stateKey(examId) {
    return 'exam_state_' + examId;
  }

  function _saveState() {
    if (!_state) return;
    sessionStorage.setItem(_stateKey(_state.examId), JSON.stringify(_state));
  }

  function _loadState(examId) {
    try {
      var raw = sessionStorage.getItem(_stateKey(examId));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function _clearState(examId) {
    sessionStorage.removeItem(_stateKey(examId));
  }

  /* =========================================================
   * 2. INIT EXAM
   * ========================================================= */

  /**
   * initExam - initializes the exam from saved state (resume) or fresh start.
   * @param {string} examId - matches a key in SAMPLE_EXAM_DATA (or API data)
   */
  function initExam(examId) {
    examId = examId || 'EX_DEMO';
    _examData = SAMPLE_EXAM_DATA[examId];

    if (!_examData) {
      _showExamError('Exam not found. Please contact your administrator.');
      return;
    }

    var savedState = _loadState(examId);
    if (savedState && savedState.examId === examId) {
      // Resume
      _state = savedState;
    } else {
      // Fresh start
      _state = {
        examId:          examId,
        totalQuestions:  _examData.questions.length,
        currentQuestion: 0,
        answers:         {},         // questionIndex → selectedOptionIndex
        markedForReview: [],         // array of question indices
        startTime:       Date.now(),
        remainingSeconds: _examData.duration
      };
      _saveState();
    }

    // Enable the before-unload guard
    var AppUtils = global.AppUtils || {};
    if (typeof AppUtils.beforeUnloadWarning === 'function') {
      AppUtils.beforeUnloadWarning(true);
    }

    // Render
    _buildQuestionPalette();
    renderQuestion(_state.currentQuestion);
    _startTimer();
    _updateProgressBar();
  }

  /* =========================================================
   * 3. RENDER QUESTION
   * ========================================================= */

  /**
   * renderQuestion - renders a question and its options.
   * Uses textContent for ALL content — never innerHTML for question data.
   * @param {number} index
   */
  function renderQuestion(index) {
    if (!_examData) return;
    var questions = _examData.questions;
    if (index < 0 || index >= questions.length) return;

    _state.currentQuestion = index;
    _saveState();

    var q = questions[index];

    // Question number & subject
    var numEl = document.getElementById('question-number');
    if (numEl) numEl.textContent = 'Question ' + (index + 1) + ' of ' + questions.length;

    var subjectEl = document.getElementById('question-subject');
    if (subjectEl) subjectEl.textContent = q.subject;

    // Question text
    var textEl = document.getElementById('question-text');
    if (textEl) textEl.textContent = q.text; // SAFE: textContent

    // Options
    var optionsContainer = document.getElementById('options-container');
    if (!optionsContainer) return;
    optionsContainer.innerHTML = '';

    q.options.forEach(function (optionText, optIdx) {
      var label = document.createElement('label');
      label.className = 'option-label';
      if (_state.answers[index] === optIdx) label.classList.add('option-label--selected');

      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'question-option';
      radio.value = String(optIdx);
      radio.checked = _state.answers[index] === optIdx;
      radio.setAttribute('aria-label', 'Option ' + (optIdx + 1));

      radio.addEventListener('change', function () {
        selectOption(index, optIdx);
      });

      var optText = document.createElement('span');
      optText.className = 'option-text';
      optText.textContent = optionText; // SAFE: textContent

      var optLetter = document.createElement('span');
      optLetter.className = 'option-letter';
      optLetter.textContent = String.fromCharCode(65 + optIdx); // A, B, C, D

      label.appendChild(radio);
      label.appendChild(optLetter);
      label.appendChild(optText);
      optionsContainer.appendChild(label);
    });

    // Mark-for-review button state
    var reviewBtn = document.getElementById('btn-mark-review');
    if (reviewBtn) {
      var marked = _state.markedForReview.indexOf(index) !== -1;
      reviewBtn.textContent = marked ? 'Unmark Review' : 'Mark for Review';
      reviewBtn.classList.toggle('btn--review-active', marked);
    }

    // Nav button states
    var prevBtn = document.getElementById('btn-prev');
    if (prevBtn) prevBtn.disabled = index === 0;

    var nextBtn = document.getElementById('btn-next');
    if (nextBtn) nextBtn.disabled = index === questions.length - 1;

    updateQuestionPalette();
    _updateProgressBar();
  }

  /* =========================================================
   * 4. ANSWER SELECTION
   * ========================================================= */

  /**
   * selectOption - records the student's answer for a question.
   * @param {number} questionIndex
   * @param {number} optionIndex
   */
  function selectOption(questionIndex, optionIndex) {
    if (!_state) return;
    _state.answers[questionIndex] = optionIndex;
    _saveState();
    updateQuestionPalette();

    // Update selected styles in the current view
    var labels = document.querySelectorAll('#options-container .option-label');
    labels.forEach(function (label, idx) {
      label.classList.toggle('option-label--selected', idx === optionIndex);
    });
  }

  /* =========================================================
   * 5. MARK FOR REVIEW
   * ========================================================= */

  /**
   * markForReview - toggles the mark-for-review flag for a question.
   * @param {number} questionIndex
   */
  function markForReview(questionIndex) {
    if (!_state) return;
    var idx = _state.markedForReview.indexOf(questionIndex);
    if (idx === -1) {
      _state.markedForReview.push(questionIndex);
    } else {
      _state.markedForReview.splice(idx, 1);
    }
    _saveState();

    // Re-render review button label
    var reviewBtn = document.getElementById('btn-mark-review');
    if (reviewBtn) {
      var marked = _state.markedForReview.indexOf(questionIndex) !== -1;
      reviewBtn.textContent = marked ? 'Unmark Review' : 'Mark for Review';
      reviewBtn.classList.toggle('btn--review-active', marked);
    }

    updateQuestionPalette();
  }

  /* =========================================================
   * 6. NAVIGATION
   * ========================================================= */

  /**
   * navigateTo - navigates to a specific question by index.
   * @param {number} index
   */
  function navigateTo(index) {
    if (!_examData) return;
    if (index < 0 || index >= _examData.questions.length) return;
    renderQuestion(index);
  }

  /** nextQuestion - goes to the next question. */
  function nextQuestion() {
    if (!_state || !_examData) return;
    var next = _state.currentQuestion + 1;
    if (next < _examData.questions.length) navigateTo(next);
  }

  /** prevQuestion - goes to the previous question. */
  function prevQuestion() {
    if (!_state) return;
    var prev = _state.currentQuestion - 1;
    if (prev >= 0) navigateTo(prev);
  }

  /**
   * saveAndNext - saves current answer (already saved on selection) and advances.
   */
  function saveAndNext() {
    _saveState();
    nextQuestion();
  }

  /* =========================================================
   * 7. QUESTION PALETTE
   * ========================================================= */

  /**
   * updateQuestionPalette - refreshes all palette button CSS classes.
   * Classes: answered | marked | not-visited | current
   */
  function updateQuestionPalette() {
    if (!_state || !_examData) return;

    var palette = document.getElementById('question-palette');
    if (!palette) return;

    var btns = palette.querySelectorAll('.palette-btn');
    btns.forEach(function (btn) {
      var qIdx = parseInt(btn.getAttribute('data-q-index'), 10);
      btn.className = 'palette-btn ' + _getQuestionStatus(qIdx);
      if (qIdx === _state.currentQuestion) btn.classList.add('palette-btn--current');
    });
  }

  function _getQuestionStatus(qIdx) {
    if (!_state) return 'palette-btn--not-visited';
    var answered = _state.answers[qIdx] !== undefined;
    var marked   = _state.markedForReview.indexOf(qIdx) !== -1;

    if (marked && answered)  return 'palette-btn--marked-answered';
    if (marked)              return 'palette-btn--marked';
    if (answered)            return 'palette-btn--answered';
    return 'palette-btn--not-visited';
  }

  function _buildQuestionPalette() {
    var palette = document.getElementById('question-palette');
    if (!palette || !_examData) return;

    palette.innerHTML = '';

    _examData.questions.forEach(function (_, qIdx) {
      var btn = document.createElement('button');
      btn.className = 'palette-btn palette-btn--not-visited';
      btn.setAttribute('data-q-index', String(qIdx));
      btn.setAttribute('aria-label', 'Question ' + (qIdx + 1));
      btn.textContent = String(qIdx + 1);

      btn.addEventListener('click', function () {
        navigateTo(qIdx);
      });

      palette.appendChild(btn);
    });
  }

  /* =========================================================
   * 8. TIMER
   * ========================================================= */

  function _startTimer() {
    if (!_state || !_examData) return;
    var AppUtils = global.AppUtils || {};
    if (typeof AppUtils.createCountdownTimer !== 'function') return;

    _timer = AppUtils.createCountdownTimer(
      _state.remainingSeconds,
      onTimerTick,
      onTimerExpire,
      _state.examId
    );
  }

  /**
   * onTimerTick - called every second with remaining seconds.
   * Triggers warning styles when < 5 minutes remain.
   * @param {number} remaining
   */
  function onTimerTick(remaining) {
    _state.remainingSeconds = remaining;
    _saveState();

    var AppUtils   = global.AppUtils || {};
    var timerEl    = document.getElementById('timer-display');
    var timerLabel = document.getElementById('timer-label');

    var formatted = typeof AppUtils.formatTime === 'function'
      ? AppUtils.formatTime(remaining)
      : String(Math.floor(remaining / 60)) + ':' + String(remaining % 60).padStart(2, '0');

    if (timerEl) timerEl.textContent = formatted;

    // Warning state: < 5 minutes
    var warnEl = document.getElementById('timer-container') || timerEl;
    if (warnEl) {
      warnEl.classList.toggle('timer--warning', remaining <= 300 && remaining > 60);
      warnEl.classList.toggle('timer--critical', remaining <= 60);
    }

    if (timerLabel) {
      timerLabel.textContent = remaining <= 300 ? 'Time remaining (low)' : 'Time remaining';
    }
  }

  /**
   * onTimerExpire - called when the exam timer reaches zero.
   * Auto-submits the exam.
   */
  function onTimerExpire() {
    var AppUtils = global.AppUtils || {};
    if (typeof AppUtils.showToast === 'function') {
      AppUtils.showToast('Time is up! Your exam has been submitted automatically.', 'warning', 5000);
    }
    submitExam(true /* autoSubmit */);
  }

  /* =========================================================
   * 9. SUBMISSION
   * ========================================================= */

  /**
   * confirmSubmit - shows a modal with a summary before submitting.
   */
  function confirmSubmit() {
    if (!_state || !_examData) return;
    var AppUtils = global.AppUtils || {};

    var answered      = Object.keys(_state.answers).length;
    var total         = _examData.questions.length;
    var marked        = _state.markedForReview.length;
    var notAnswered   = total - answered;

    // Populate modal summary elements (textContent only)
    var el = function (id) { return document.getElementById(id); };
    var safely = function (id, val) { if (el(id)) el(id).textContent = String(val); };

    safely('confirm-total',       total);
    safely('confirm-answered',    answered);
    safely('confirm-not-answered', notAnswered);
    safely('confirm-marked',      marked);

    if (typeof AppUtils.openModal === 'function') {
      AppUtils.openModal('submit-confirm-modal');
    }
  }

  /**
   * submitExam - calculates demo score, saves result to sessionStorage,
   * cleans up state, disables beforeUnload guard, redirects.
   * @param {boolean} [autoSubmit=false] - true when called by timer expiry
   *
   * NOTE: In production, send only the answers array to the server via POST.
   *       The server should verify and score — never trust client score.
   */
  function submitExam(autoSubmit) {
    if (!_state || !_examData) return;

    // Stop the timer
    if (_timer && typeof _timer.stop === 'function') _timer.stop();

    var AppUtils = global.AppUtils || {};

    // Disable beforeUnload so the redirect is seamless
    if (typeof AppUtils.beforeUnloadWarning === 'function') {
      AppUtils.beforeUnloadWarning(false);
    }

    // Close confirm modal if open
    if (typeof AppUtils.closeModal === 'function') {
      AppUtils.closeModal('submit-confirm-modal');
    }

    // ── DEMO score calculation ──────────────────────────────────────
    // WARNING: In production, send answers to server; server calculates score.
    var correct = 0;
    var total   = _examData.questions.length;
    _examData.questions.forEach(function (q, idx) {
      if (_state.answers[idx] === q.correctAnswer) correct++;
    });
    var score   = Math.round((correct / total) * 100);
    var passed  = score >= 50;
    // ── END DEMO calculation ────────────────────────────────────────

    // Save result
    var result = {
      examId:        _state.examId,
      examTitle:     _examData.title,
      totalQuestions: total,
      correct:       correct,
      score:         score,
      passed:        passed,
      autoSubmitted: !!autoSubmit,
      submittedAt:   new Date().toISOString(),
      answers:       _state.answers    // the student's submitted answers
    };

    sessionStorage.setItem('exam_last_result', JSON.stringify(result));

    // Remove exam state from sessionStorage
    _clearState(_state.examId);
    _state = null;

    // Redirect to results page
    if (typeof AppUtils.showLoader === 'function') AppUtils.showLoader();

    setTimeout(function () {
      global.location.href = '/frontend/pages/result.html?examId=' + encodeURIComponent(result.examId);
    }, 400);
  }

  /* =========================================================
   * 10. PROGRESS BAR
   * ========================================================= */
  function _updateProgressBar() {
    if (!_state || !_examData) return;
    var answered = Object.keys(_state.answers).length;
    var pct      = Math.round((answered / _examData.questions.length) * 100);

    var bar  = document.getElementById('exam-progress-bar');
    var text = document.getElementById('exam-progress-text');
    if (bar) {
      bar.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', String(pct));
    }
    if (text) {
      text.textContent = answered + ' of ' + _examData.questions.length + ' answered';
    }
  }

  /* =========================================================
   * 11. ERROR DISPLAY
   * ========================================================= */
  function _showExamError(message) {
    var container = document.getElementById('exam-container') || document.body;
    var errDiv = document.createElement('div');
    errDiv.className = 'exam-error alert alert--error';
    errDiv.setAttribute('role', 'alert');
    errDiv.textContent = message; // SAFE: textContent
    container.prepend(errDiv);
  }

  /* =========================================================
   * 12. QUESTION STATUS LEGEND
   * Maps CSS class names to human-readable descriptions (for legend UI)
   * ========================================================= */
  var QUESTION_STATUS_LEGEND = [
    { cssClass: 'palette-btn--answered',        label: 'Answered',              color: '#38a169' },
    { cssClass: 'palette-btn--not-visited',     label: 'Not Answered / Skipped', color: '#e2e8f0' },
    { cssClass: 'palette-btn--marked',          label: 'Marked for Review',     color: '#d69e2e' },
    { cssClass: 'palette-btn--marked-answered', label: 'Answered & Marked',      color: '#3182ce' },
    { cssClass: 'palette-btn--current',         label: 'Current Question',       color: '#183D32' }
  ];

  /**
   * renderLegend - renders the question palette legend into a container.
   * @param {string} containerId
   */
  function renderLegend(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    QUESTION_STATUS_LEGEND.forEach(function (item) {
      var entry = document.createElement('div');
      entry.className = 'legend-entry';

      var swatch = document.createElement('span');
      swatch.className = 'legend-swatch ' + item.cssClass;
      swatch.setAttribute('aria-hidden', 'true');

      var label = document.createElement('span');
      label.className = 'legend-label';
      label.textContent = item.label; // SAFE

      entry.appendChild(swatch);
      entry.appendChild(label);
      container.appendChild(entry);
    });
  }

  /* =========================================================
   * DOM READY — wire up buttons on the exam page
   * ========================================================= */
  document.addEventListener('DOMContentLoaded', function () {
    // Read examId from URL query string
    var params = new URLSearchParams(global.location.search);
    var examId = params.get('examId') || 'EX_DEMO';

    // Only initialize if we're on an exam page
    var examContainer = document.getElementById('exam-container');
    if (!examContainer) return;

    initExam(examId);

    // Render legend
    renderLegend('palette-legend');

    // Wire navigation buttons
    var _btn = function (id) { return document.getElementById(id); };

    var btnPrev = _btn('btn-prev');
    if (btnPrev) btnPrev.addEventListener('click', prevQuestion);

    var btnNext = _btn('btn-next');
    if (btnNext) btnNext.addEventListener('click', nextQuestion);

    var btnSaveNext = _btn('btn-save-next');
    if (btnSaveNext) btnSaveNext.addEventListener('click', saveAndNext);

    var btnMarkReview = _btn('btn-mark-review');
    if (btnMarkReview) btnMarkReview.addEventListener('click', function () {
      if (_state) markForReview(_state.currentQuestion);
    });

    var btnSubmit = _btn('btn-submit');
    if (btnSubmit) btnSubmit.addEventListener('click', confirmSubmit);

    // Confirm submit modal buttons
    var btnConfirmSubmit = _btn('btn-confirm-submit');
    if (btnConfirmSubmit) btnConfirmSubmit.addEventListener('click', function () {
      submitExam(false);
    });

    var btnCancelSubmit = _btn('btn-cancel-submit');
    if (btnCancelSubmit) {
      var AppUtils = global.AppUtils || {};
      btnCancelSubmit.addEventListener('click', function () {
        if (typeof AppUtils.closeModal === 'function') {
          AppUtils.closeModal('submit-confirm-modal');
        }
      });
    }
  });

  /* =========================================================
   * EXPORT — window.Exam NAMESPACE
   * ========================================================= */
  global.Exam = {
    initExam:              initExam,
    renderQuestion:        renderQuestion,
    selectOption:          selectOption,
    markForReview:         markForReview,
    navigateTo:            navigateTo,
    nextQuestion:          nextQuestion,
    prevQuestion:          prevQuestion,
    saveAndNext:           saveAndNext,
    updateQuestionPalette: updateQuestionPalette,
    confirmSubmit:         confirmSubmit,
    submitExam:            submitExam,
    onTimerTick:           onTimerTick,
    onTimerExpire:         onTimerExpire,
    renderLegend:          renderLegend,
    QUESTION_STATUS_LEGEND: QUESTION_STATUS_LEGEND,
    sampleData:            SAMPLE_EXAM_DATA
  };

}(window));

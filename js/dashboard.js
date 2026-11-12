/**
 * dashboard.js — Dashboard interactivity for the Secure Online Examination System.
 *
 * Handles sidebar, data tables, stats, tabs, exam/student management UI,
 * and result rendering for both admin and student dashboards.
 *
 * Dependencies: window.AppUtils (main.js), window.Auth (auth.js)
 * Exported namespace: window.Dashboard
 */

(function (global) {
  'use strict';

  /* =========================================================
   * SAMPLE DATA
   * In production, replace these with API responses.
   * ========================================================= */

  var SAMPLE_STUDENTS = [
    { id: 'STU001', name: 'Alice Johnson',   email: 'alice@example.com',   status: 'Active',    examsTaken: 4 },
    { id: 'STU002', name: 'Bob Williams',    email: 'bob@example.com',     status: 'Active',    examsTaken: 3 },
    { id: 'STU003', name: 'Carol Martinez',  email: 'carol@example.com',   status: 'Inactive',  examsTaken: 5 },
    { id: 'STU004', name: 'David Lee',       email: 'david@example.com',   status: 'Active',    examsTaken: 2 },
    { id: 'STU005', name: 'Eva Chen',        email: 'eva@example.com',     status: 'Suspended', examsTaken: 1 }
  ];

  var SAMPLE_EXAMS = [
    { id: 'EX001', title: 'Introduction to Computer Science', subject: 'CS',      date: '2025-07-10', duration: 60,  questions: 15, status: 'scheduled'  },
    { id: 'EX002', title: 'Advanced Mathematics',             subject: 'Math',    date: '2025-07-12', duration: 90,  questions: 20, status: 'active'     },
    { id: 'EX003', title: 'English Literature Mid-Term',      subject: 'English', date: '2025-06-28', duration: 45,  questions: 10, status: 'completed'  },
    { id: 'EX004', title: 'Physics Fundamentals',             subject: 'Physics', date: '2025-07-15', duration: 75,  questions: 18, status: 'scheduled'  },
    { id: 'EX005', title: 'Data Structures & Algorithms',     subject: 'CS',      date: '2025-06-20', duration: 120, questions: 25, status: 'completed'  }
  ];

  var SAMPLE_RESULTS = [
    { examName: 'Introduction to Computer Science', score: 82, grade: 'B',  date: '2025-06-01', passed: true  },
    { examName: 'English Literature Mid-Term',      score: 91, grade: 'A',  date: '2025-06-05', passed: true  },
    { examName: 'Data Structures & Algorithms',     score: 55, grade: 'D',  date: '2025-06-10', passed: false },
    { examName: 'Advanced Mathematics',             score: 74, grade: 'C',  date: '2025-06-15', passed: true  },
    { examName: 'Physics Fundamentals',             score: 88, grade: 'B+', date: '2025-06-20', passed: true  }
  ];

  /* =========================================================
   * 1. DATA LOADER
   * ========================================================= */

  /**
   * loadDashboardData - returns appropriate sample data for the given role.
   * @param {'admin'|'student'} role
   * @returns {{students?, exams, results?}}
   */
  function loadDashboardData(role) {
    if (role === 'admin') {
      return { students: SAMPLE_STUDENTS, exams: SAMPLE_EXAMS };
    }
    return { exams: SAMPLE_EXAMS, results: SAMPLE_RESULTS };
  }

  /* =========================================================
   * 2. SIDEBAR TOGGLE
   * ========================================================= */
  var SIDEBAR_STATE_KEY = 'sidebar_collapsed';

  function initSidebar() {
    var sidebar    = document.getElementById('sidebar') || document.querySelector('.sidebar');
    var toggleBtn  = document.getElementById('sidebar-toggle') || document.querySelector('.sidebar-toggle');
    if (!sidebar) return;

    // Restore persisted state
    var collapsed = sessionStorage.getItem(SIDEBAR_STATE_KEY) === 'true';
    if (collapsed) sidebar.classList.add('sidebar--collapsed');

    function toggle() {
      collapsed = !collapsed;
      sidebar.classList.toggle('sidebar--collapsed', collapsed);
      sessionStorage.setItem(SIDEBAR_STATE_KEY, String(collapsed));
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', String(!collapsed));
        toggleBtn.textContent = collapsed ? '☰' : '✕';
      }
    }

    if (toggleBtn) toggleBtn.addEventListener('click', toggle);

    // Highlight active link
    _highlightActiveSidebarLink();
  }

  function _highlightActiveSidebarLink() {
    var hash    = global.location.hash || '';
    var path    = global.location.pathname;
    var links   = document.querySelectorAll('.sidebar a, .sidebar-nav a');
    links.forEach(function (link) {
      var href = link.getAttribute('href') || '';
      var active = (href && (path.endsWith(href.split('?')[0]) || (hash && href === hash)));
      link.classList.toggle('sidebar__link--active', active);
      link.setAttribute('aria-current', active ? 'page' : 'false');
    });
  }

  /* =========================================================
   * 3. STATS COUNTER ANIMATION
   * ========================================================= */

  /**
   * animateCounter - counts up a numeric display from 0 to target.
   * @param {HTMLElement} el
   * @param {number}      target
   * @param {number}      duration - ms
   */
  function animateCounter(el, target, duration) {
    if (!el || isNaN(target)) return;
    duration = duration || 1000;
    var start     = 0;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease-out
      var current = Math.floor(progress * (1 - Math.pow(1 - progress, 3)) * target + progress * target * Math.pow(1 - progress, 3));
      current = Math.round(start + (target - start) * _easeOut(progress));
      el.textContent = current.toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString();
    }

    requestAnimationFrame(step);
  }

  function _easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function initStatCounters() {
    var counters = document.querySelectorAll('[data-counter]');
    counters.forEach(function (el) {
      var target = parseInt(el.getAttribute('data-counter'), 10);
      if (!isNaN(target)) animateCounter(el, target, 1200);
    });
  }

  /* =========================================================
   * 4. DATA TABLE (Sort, Filter, Paginate, Render)
   * ========================================================= */
  var PAGE_SIZE = 10;

  /**
   * renderTable - renders a sortable, filterable, paginated table.
   * @param {string}   tableId - DOM id of the <table> element
   * @param {Array}    data    - array of row objects
   * @param {Array}    columns - [{key, label, render?}]
   */
  function renderTable(tableId, data, columns) {
    var table = document.getElementById(tableId);
    if (!table) return;

    var state = {
      data:       data.slice(),
      filtered:   data.slice(),
      sortKey:    null,
      sortDir:    'asc',
      page:       1,
      pageSize:   PAGE_SIZE,
      columns:    columns
    };

    _buildTableHeader(table, state);
    _buildTableSearch(table, state);
    _buildTablePagination(table, state);
    _renderTableBody(table, state);
  }

  function _buildTableHeader(table, state) {
    var thead = table.querySelector('thead') || table.createTHead();
    thead.innerHTML = '';
    var tr = thead.insertRow();

    state.columns.forEach(function (col) {
      var th = document.createElement('th');
      th.textContent = col.label;         // SAFE: textContent
      th.setAttribute('scope', 'col');
      th.style.cursor = 'pointer';
      th.setAttribute('aria-sort', 'none');

      th.addEventListener('click', function () {
        if (state.sortKey === col.key) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = col.key;
          state.sortDir = 'asc';
        }
        // Update aria-sort on all headers
        thead.querySelectorAll('th').forEach(function (h) { h.setAttribute('aria-sort', 'none'); });
        th.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');
        th.textContent = col.label + (state.sortDir === 'asc' ? ' ▲' : ' ▼');

        state.filtered = _sortData(state.filtered, col.key, state.sortDir);
        state.page = 1;
        _renderTableBody(table, state);
        _renderPagination(table, state);
      });

      tr.appendChild(th);
    });

    // Actions column header
    var actionTh = document.createElement('th');
    actionTh.textContent = 'Actions';
    actionTh.setAttribute('scope', 'col');
    tr.appendChild(actionTh);
  }

  function _buildTableSearch(table, state) {
    var wrapper = document.createElement('div');
    wrapper.className = 'table-search-wrapper';

    var input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Search...';
    input.className = 'table-search';
    input.setAttribute('aria-label', 'Search table');

    input.addEventListener('input', function () {
      var query = input.value.toLowerCase().trim();
      state.filtered = state.data.filter(function (row) {
        return state.columns.some(function (col) {
          var val = String(row[col.key] || '').toLowerCase();
          return val.includes(query);
        });
      });
      if (state.sortKey) {
        state.filtered = _sortData(state.filtered, state.sortKey, state.sortDir);
      }
      state.page = 1;
      _renderTableBody(table, state);
      _renderPagination(table, state);
    });

    wrapper.appendChild(input);
    table.parentNode.insertBefore(wrapper, table);
  }

  function _buildTablePagination(table, state) {
    var paginationEl = document.createElement('div');
    paginationEl.className = 'table-pagination';
    paginationEl.id = table.id + '-pagination';
    table.parentNode.insertBefore(paginationEl, table.nextSibling);
  }

  function _renderPagination(table, state) {
    var el = document.getElementById(table.id + '-pagination');
    if (!el) return;
    el.innerHTML = '';

    var totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));

    function makePgBtn(label, page, disabled) {
      var btn = document.createElement('button');
      btn.textContent = label;       // SAFE
      btn.className = 'page-btn' + (page === state.page ? ' page-btn--active' : '');
      btn.disabled = disabled;
      btn.setAttribute('aria-label', 'Page ' + label);
      btn.addEventListener('click', function () {
        state.page = page;
        _renderTableBody(table, state);
        _renderPagination(table, state);
      });
      return btn;
    }

    el.appendChild(makePgBtn('«', 1, state.page === 1));
    el.appendChild(makePgBtn('‹', Math.max(1, state.page - 1), state.page === 1));

    for (var p = Math.max(1, state.page - 2); p <= Math.min(totalPages, state.page + 2); p++) {
      el.appendChild(makePgBtn(String(p), p, false));
    }

    el.appendChild(makePgBtn('›', Math.min(totalPages, state.page + 1), state.page === totalPages));
    el.appendChild(makePgBtn('»', totalPages, state.page === totalPages));

    var info = document.createElement('span');
    info.className = 'page-info';
    var start = (state.page - 1) * state.pageSize + 1;
    var end   = Math.min(state.page * state.pageSize, state.filtered.length);
    info.textContent = 'Showing ' + start + '–' + end + ' of ' + state.filtered.length;
    el.appendChild(info);
  }

  function _renderTableBody(table, state) {
    var tbody = table.querySelector('tbody') || table.createTBody();
    tbody.innerHTML = '';

    var start = (state.page - 1) * state.pageSize;
    var pageRows = state.filtered.slice(start, start + state.pageSize);

    if (pageRows.length === 0) {
      var emptyRow = tbody.insertRow();
      var emptyCell = emptyRow.insertCell();
      emptyCell.colSpan = state.columns.length + 1;
      emptyCell.textContent = 'No records found.';
      emptyCell.className = 'table-empty';
      return;
    }

    pageRows.forEach(function (row) {
      var tr = tbody.insertRow();

      state.columns.forEach(function (col) {
        var td = tr.insertCell();
        if (typeof col.render === 'function') {
          // render() must return a DOM element for safety
          var node = col.render(row[col.key], row);
          if (node instanceof Node) td.appendChild(node);
          else td.textContent = String(node);  // fallback safe
        } else {
          td.textContent = row[col.key] !== undefined ? String(row[col.key]) : ''; // SAFE
        }
      });

      // Actions cell
      var actionTd = tr.insertCell();
      actionTd.appendChild(_makeActionButtons(row, state));
    });
  }

  function _makeActionButtons(row, state) {
    var frag = document.createDocumentFragment();

    var editBtn = document.createElement('button');
    editBtn.className = 'btn btn--sm btn--secondary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', function () { _handleEdit(row, state); });

    var delBtn = document.createElement('button');
    delBtn.className = 'btn btn--sm btn--danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', function () { _handleDelete(row, state); });

    frag.appendChild(editBtn);
    frag.appendChild(delBtn);
    return frag;
  }

  function _handleEdit(row, state) {
    var AppUtils = global.AppUtils || {};
    if (typeof AppUtils.showToast === 'function') {
      AppUtils.showToast('Edit action for record: ' + (row.id || row.name || JSON.stringify(row)), 'info');
    }
    // TODO: open edit modal and populate fields
  }

  function _handleDelete(row, state) {
    if (!confirm('Are you sure you want to delete this record?')) return;
    state.data     = state.data.filter(function (r) { return r !== row; });
    state.filtered = state.filtered.filter(function (r) { return r !== row; });
    var AppUtils = global.AppUtils || {};
    if (typeof AppUtils.showToast === 'function') {
      AppUtils.showToast('Record deleted.', 'success');
    }
    // TODO: DELETE /api/... on backend
  }

  function _sortData(data, key, dir) {
    return data.slice().sort(function (a, b) {
      var va = a[key]; var vb = b[key];
      if (va === vb) return 0;
      var cmp = va < vb ? -1 : 1;
      return dir === 'asc' ? cmp : -cmp;
    });
  }

  /* =========================================================
   * 5. TAB SWITCHING
   * ========================================================= */

  /**
   * initTabs - wires up tab buttons and panels inside a container.
   * Expects: [data-tab="id"] buttons and [data-panel="id"] panels.
   * @param {HTMLElement} containerEl
   */
  function initTabs(containerEl) {
    if (!containerEl) return;

    var tabBtns  = containerEl.querySelectorAll('[data-tab]');
    var panels   = containerEl.querySelectorAll('[data-panel]');

    function activateTab(targetId) {
      tabBtns.forEach(function (btn) {
        var active = btn.getAttribute('data-tab') === targetId;
        btn.classList.toggle('tab--active', active);
        btn.setAttribute('aria-selected', String(active));
        btn.tabIndex = active ? 0 : -1;
      });
      panels.forEach(function (panel) {
        var show = panel.getAttribute('data-panel') === targetId;
        panel.classList.toggle('panel--active', show);
        panel.hidden = !show;
      });
    }

    tabBtns.forEach(function (btn) {
      btn.setAttribute('role', 'tab');
      btn.addEventListener('click', function () {
        activateTab(btn.getAttribute('data-tab'));
      });
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activateTab(btn.getAttribute('data-tab'));
        }
      });
    });

    // Activate first tab by default
    if (tabBtns.length > 0) {
      activateTab(tabBtns[0].getAttribute('data-tab'));
    }
  }

  /* =========================================================
   * 6. ADMIN — EXAM MANAGEMENT
   * ========================================================= */

  function initAdminExamManagement() {
    var exams = SAMPLE_EXAMS.slice();

    function statusBadge(status) {
      var badge = document.createElement('span');
      badge.className = 'badge badge--' + (status || 'scheduled');
      badge.textContent = status ? (status.charAt(0).toUpperCase() + status.slice(1)) : '';
      return badge;
    }

    var columns = [
      { key: 'title',     label: 'Exam Title' },
      { key: 'subject',   label: 'Subject' },
      { key: 'date',      label: 'Date',      render: function (val) {
          var s = document.createElement('span');
          s.textContent = global.AppUtils ? global.AppUtils.formatDate(val) : val;
          return s;
        }
      },
      { key: 'duration',  label: 'Duration (min)' },
      { key: 'questions', label: 'Questions' },
      { key: 'status',    label: 'Status',    render: function (val) { return statusBadge(val); } }
    ];

    renderTable('exam-table', exams, columns);

    // Add Exam form
    var addForm = document.getElementById('add-exam-form');
    if (addForm) {
      addForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var Validation = global.Validation || {};
        var formData = {
          title:     (addForm.querySelector('[name="title"]')     || {}).value || '',
          subject:   (addForm.querySelector('[name="subject"]')   || {}).value || '',
          duration:  (addForm.querySelector('[name="duration"]')  || {}).value || '',
          date:      (addForm.querySelector('[name="date"]')      || {}).value || '',
          totalQuestions: (addForm.querySelector('[name="questions"]') || {}).value
        };

        var result = typeof Validation.validateExamForm === 'function'
          ? Validation.validateExamForm(formData)
          : { valid: true, errors: {} };

        if (!result.valid) {
          if (typeof Validation.displayErrors === 'function') {
            Validation.displayErrors(result.errors, 'exam-');
          }
          return;
        }

        var newExam = {
          id:        'EX' + Date.now(),
          title:     formData.title,
          subject:   formData.subject,
          date:      formData.date,
          duration:  parseInt(formData.duration, 10),
          questions: parseInt(formData.totalQuestions, 10) || 0,
          status:    'scheduled'
        };
        exams.push(newExam);
        renderTable('exam-table', exams, columns);

        var AppUtils = global.AppUtils || {};
        if (typeof AppUtils.showToast === 'function') AppUtils.showToast('Exam added successfully.', 'success');
        if (typeof AppUtils.closeModal === 'function') AppUtils.closeModal('add-exam-modal');
        addForm.reset();
      });
    }
  }

  /* =========================================================
   * 7. ADMIN — STUDENT MANAGEMENT
   * ========================================================= */

  function initAdminStudentManagement() {
    var students = SAMPLE_STUDENTS.slice();

    function statusBadge(status) {
      var badge = document.createElement('span');
      var cls = { Active: 'success', Inactive: 'warning', Suspended: 'danger' }[status] || 'default';
      badge.className = 'badge badge--' + cls;
      badge.textContent = status || '';
      return badge;
    }

    var columns = [
      { key: 'id',        label: 'Student ID' },
      { key: 'name',      label: 'Name' },
      { key: 'email',     label: 'Email' },
      { key: 'examsTaken', label: 'Exams Taken' },
      { key: 'status',   label: 'Status', render: function (val) { return statusBadge(val); } }
    ];

    renderTable('student-table', students, columns);
  }

  /* =========================================================
   * 8. STUDENT — EXAM LIST
   * ========================================================= */

  function initStudentExamList() {
    var container = document.getElementById('student-exam-list');
    if (!container) return;

    var AppUtils = global.AppUtils || {};

    SAMPLE_EXAMS.forEach(function (exam) {
      var card = document.createElement('div');
      card.className = 'exam-card';

      var title = document.createElement('h3');
      title.className = 'exam-card__title';
      title.textContent = exam.title; // SAFE

      var meta = document.createElement('p');
      meta.className = 'exam-card__meta';
      meta.textContent =
        exam.subject + ' | ' +
        (typeof AppUtils.formatDate === 'function' ? AppUtils.formatDate(exam.date) : exam.date) +
        ' | ' + exam.duration + ' min | ' + exam.questions + ' questions';

      var badge = document.createElement('span');
      badge.className = 'badge badge--' + exam.status;
      badge.textContent = exam.status.charAt(0).toUpperCase() + exam.status.slice(1);

      var actions = document.createElement('div');
      actions.className = 'exam-card__actions';

      if (exam.status === 'active' || exam.status === 'scheduled') {
        var startBtn = document.createElement('a');
        startBtn.className = 'btn btn--primary btn--sm';
        startBtn.textContent = exam.status === 'active' ? 'Take Exam' : 'View Details';
        startBtn.href = '/frontend/pages/exam.html?examId=' + encodeURIComponent(exam.id);
        actions.appendChild(startBtn);
      }

      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(badge);
      card.appendChild(actions);
      container.appendChild(card);
    });
  }

  /* =========================================================
   * 9. STUDENT — RESULT HISTORY
   * ========================================================= */

  function initStudentResultHistory() {
    var container = document.getElementById('result-history');
    if (!container) return;

    SAMPLE_RESULTS.forEach(function (result) {
      var row = document.createElement('div');
      row.className = 'result-row result-row--' + (result.passed ? 'pass' : 'fail');

      var name = document.createElement('span');
      name.className = 'result-row__name';
      name.textContent = result.examName; // SAFE

      var score = document.createElement('span');
      score.className = 'result-row__score';
      score.textContent = result.score + '%';

      var grade = document.createElement('span');
      grade.className = 'result-row__grade';
      grade.textContent = result.grade;

      var date = document.createElement('span');
      date.className = 'result-row__date';
      var AppUtils = global.AppUtils || {};
      date.textContent = typeof AppUtils.formatDate === 'function'
        ? AppUtils.formatDate(result.date)
        : result.date;

      var status = document.createElement('span');
      status.className = 'badge badge--' + (result.passed ? 'success' : 'danger');
      status.textContent = result.passed ? 'Pass' : 'Fail';

      row.appendChild(name);
      row.appendChild(score);
      row.appendChild(grade);
      row.appendChild(date);
      row.appendChild(status);
      container.appendChild(row);
    });
  }

  /* =========================================================
   * 10. NOTIFICATION DROPDOWN
   * ========================================================= */

  function initNotificationDropdown() {
    var bell     = document.getElementById('notification-bell') || document.querySelector('.notification-bell');
    var dropdown = document.getElementById('notification-dropdown') || document.querySelector('.notification-dropdown');
    if (!bell || !dropdown) return;

    bell.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.toggle('dropdown--open');
      bell.setAttribute('aria-expanded', String(isOpen));
      dropdown.setAttribute('aria-hidden', String(!isOpen));
    });

    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target) && e.target !== bell) {
        dropdown.classList.remove('dropdown--open');
        bell.setAttribute('aria-expanded', 'false');
        dropdown.setAttribute('aria-hidden', 'true');
      }
    });
  }

  /* =========================================================
   * DOM READY
   * ========================================================= */
  document.addEventListener('DOMContentLoaded', function () {
    initSidebar();
    initStatCounters();
    initNotificationDropdown();

    var Auth = global.Auth || {};
    var user = typeof Auth.getCurrentUser === 'function' ? Auth.getCurrentUser() : null;
    var role = user ? user.role : 'student';

    // Greet user
    var greetEl = document.getElementById('dashboard-greeting') || document.querySelector('.dashboard-greeting');
    if (greetEl && user) {
      greetEl.textContent = 'Welcome back, ' + user.name + '!'; // SAFE
    }

    if (role === 'admin') {
      initAdminExamManagement();
      initAdminStudentManagement();
    } else {
      initStudentExamList();
      initStudentResultHistory();
    }

    // Init tabs (if any tab containers present)
    document.querySelectorAll('[data-tabs-container]').forEach(function (el) {
      initTabs(el);
    });
  });

  /* =========================================================
   * EXPORT — window.Dashboard NAMESPACE
   * ========================================================= */
  global.Dashboard = {
    loadDashboardData:   loadDashboardData,
    renderTable:         renderTable,
    animateCounter:      animateCounter,
    initTabs:            initTabs,
    initSidebar:         initSidebar,
    sampleData: {
      students: SAMPLE_STUDENTS,
      exams:    SAMPLE_EXAMS,
      results:  SAMPLE_RESULTS
    }
  };

}(window));

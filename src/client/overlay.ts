import { OVERLAY_CSS, HOST_PAGE_CSS } from "./overlay-css.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tag configuration
// ─────────────────────────────────────────────────────────────────────────────
export function getOverlayScript(port: number): string {
  return `
(function () {
  'use strict';

  // Skip if Chrome extension already injected the overlay
  if (document.getElementById('proto-studio-root')) return;

  var WS_URL     = 'ws://localhost:${port}';
  var API_URL    = 'http://localhost:${port}/api/tasks';
  var PAGES_URL  = 'http://localhost:${port}/api/pages';

  // ── Shadow DOM host ───────────────────────────────────────────────────
  var host = document.createElement('div');
  host.id = 'proto-studio-root';
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });

  var styleEl = document.createElement('style');
  styleEl.textContent = ${JSON.stringify(OVERLAY_CSS)};
  root.appendChild(styleEl);

  var hostStyle = document.createElement('style');
  hostStyle.textContent = ${JSON.stringify(HOST_PAGE_CSS)};
  document.head.appendChild(hostStyle);

  // ── State ─────────────────────────────────────────────────────────────
  var annotationMode = false;
  var sidebar  = null;
  var popover  = null;
  var contextMenu = null;
  var tasks = [];
  var sidebarPinned = false;
  var activeTooltip = null;
  var indicatorRafId = null;
  var indicatorsVisible = true;
  var sidebarShowDone = true;
  var tooltipPinned = false;
  var PREFS_KEY = 'proto-studio-prefs';

  // Load preferences from localStorage
  (function () {
    try {
      var p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      indicatorsVisible = p.indicatorsVisible !== false;
      sidebarShowDone = p.sidebarShowDone !== false;
    } catch (_) {}
  })();

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ indicatorsVisible: indicatorsVisible, sidebarShowDone: sidebarShowDone }));
    } catch (_) {}
  }

  // ── Stable WebSocket (exponential backoff + ping/pong) ────────────────
  var ws = null;
  var reconnectAttempt = 0;
  var reconnectTimer = null;
  var pingInterval = null;
  var RECONNECT_BASE = 1000;
  var RECONNECT_MAX = 30000;
  var PING_INTERVAL = 25000;

  function connectWS() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    try { ws = new WebSocket(WS_URL); } catch (e) { scheduleReconnect(); return; }

    ws.onopen = function () {
      reconnectAttempt = 0;
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(function () {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = function (e) {
      var msg;
      try { msg = JSON.parse(e.data); } catch (_) { return; }
      if (msg.type === 'pong') return;
      if (msg.type === 'reload') location.reload();
      if (msg.type === 'tasks-updated') fetchTasks();
    };

    ws.onclose = function () {
      if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
      scheduleReconnect();
    };

    ws.onerror = function () { if (ws) ws.close(); };
  }

  function scheduleReconnect() {
    var delay = Math.min(RECONNECT_BASE * Math.pow(2, reconnectAttempt), RECONNECT_MAX);
    reconnectAttempt++;
    reconnectTimer = setTimeout(connectWS, delay);
  }

  // Reconnect when tab regains focus (handles laptop sleep / tab switch)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && (!ws || ws.readyState !== WebSocket.OPEN)) {
      reconnectAttempt = 0;
      connectWS();
    }
  });

  connectWS();

  // ── Element selector helper ───────────────────────────────────────────
  // Builds the best available CSS selector for any DOM element.
  // Priority: data-proto-id > data-testid > id > CSS path.
  // For CSS path (last resort), traverses ancestors and anchors to the nearest
  // ancestor with a data-testid or id attribute for stability.
  function buildElementSelector(element) {
    var protoId = element.getAttribute('data-proto-id');
    if (protoId) return { selector: '[data-proto-id="' + protoId + '"]', display: protoId };

    var testId = element.getAttribute('data-testid');
    if (testId) return { selector: '[data-testid="' + testId + '"]', display: 'testid: ' + testId };

    var elemId = element.id;
    if (elemId && /^[a-zA-Z_-]/.test(elemId)) return { selector: '#' + elemId, display: '#' + elemId };

    // Build a short CSS path (max 4 levels), anchoring to the nearest ancestor
    // that has data-testid or id for a more stable selector (css selector as last resort)
    var parts = [];
    var cur = element;
    while (cur && cur !== document.body && parts.length < 4) {
      // For ancestors (not the element itself), check for stable anchors
      if (cur !== element) {
        var ancTestId = cur.getAttribute('data-testid');
        if (ancTestId) {
          parts.unshift('[data-testid="' + ancTestId + '"]');
          break;
        }
        var ancId = cur.id;
        if (ancId && /^[a-zA-Z_-]/.test(ancId)) {
          parts.unshift('#' + ancId);
          break;
        }
      }
      var tag = cur.tagName.toLowerCase();
      var parent = cur.parentElement;
      if (parent) {
        var sameTags = [];
        for (var ci = 0; ci < parent.children.length; ci++) {
          if (parent.children[ci].tagName === cur.tagName) sameTags.push(parent.children[ci]);
        }
        if (sameTags.length > 1) tag += ':nth-of-type(' + (sameTags.indexOf(cur) + 1) + ')';
      }
      // Append first non-proto class for readability
      for (var cj = 0; cj < cur.classList.length; cj++) {
        if (!cur.classList[cj].startsWith('proto-')) { tag += '.' + cur.classList[cj]; break; }
      }
      parts.unshift(tag);
      cur = cur.parentElement;
    }
    var sel = parts.join(' > ');
    return { selector: sel, display: sel };
  }

  // ── Annotation-mode hover highlight ───────────────────────────────────
  // Track the element directly under the cursor and apply a CSS class for
  // the blue outline, so only the top-most element is highlighted (not all
  // ancestors which :hover would affect).
  var HOVER_CLASS = 'proto-hover-highlight';
  var hoverTarget = null;

  function onAnnotateMouseOver(e) {
    var t = e.target;
    if (!t || t === document.documentElement || t === document.body) return;
    if (e.composedPath().indexOf(host) !== -1) return;
    if (hoverTarget === t) return;
    if (hoverTarget) { try { hoverTarget.classList.remove(HOVER_CLASS); } catch(_) {} }
    hoverTarget = t;
    try { t.classList.add(HOVER_CLASS); } catch(_) {}
  }

  function onAnnotateMouseOut(e) {
    var t = e.target;
    if (t === hoverTarget) {
      try { t.classList.remove(HOVER_CLASS); } catch(_) {}
      hoverTarget = null;
    }
  }

  function startAnnotationHover() {
    document.addEventListener('mouseover', onAnnotateMouseOver, true);
    document.addEventListener('mouseout', onAnnotateMouseOut, true);
  }

  function stopAnnotationHover() {
    document.removeEventListener('mouseover', onAnnotateMouseOver, true);
    document.removeEventListener('mouseout', onAnnotateMouseOut, true);
    if (hoverTarget) {
      try { hoverTarget.classList.remove(HOVER_CLASS); } catch(_) {}
      hoverTarget = null;
    }
  }

  // ── DOM helper ────────────────────────────────────────────────────────
  function el(tag, props) {
    var node = document.createElement(tag);
    if (props) {
      for (var key of Object.keys(props)) {
        if (key === 'className') node.className = props[key];
        else if (key === 'placeholder') node.placeholder = props[key];
        else if (key === 'type') node.type = props[key];
        else if (key === 'value') node.value = props[key];
        else node.setAttribute(key, props[key]);
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child == null) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }

  function kbd(text)       { return el('kbd', null, text); }
  function span(cls, text) { return el('span', { className: cls }, text); }

  // ── Fetch tasks from API ──────────────────────────────────────────────
  function fetchTasks() {
    fetch(API_URL)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        tasks = d.tasks || [];
        if (sidebar && sidebar.classList.contains('open')) refreshSidebar();
        renderIndicators();
      })
      .catch(function () { /* server down */ });
  }

  fetchTasks();

  // ── Pages (variant switcher) ──────────────────────────────────────────
  var pages = [];
  var pageSwitcher = null;

  function renderPageSwitcher() {
    if (pageSwitcher) { pageSwitcher.remove(); pageSwitcher = null; }
    if (pages.length < 2) return;

    var currentPath = location.pathname;
    pageSwitcher = el('div', { className: 'proto-page-switcher' });

    var label = el('span', { className: 'page-switcher-label' }, 'Pages:');
    pageSwitcher.appendChild(label);

    for (var i = 0; i < pages.length; i++) {
      var page = pages[i];
      var isActive = page === currentPath || (currentPath === '/' && page === '/index.html');
      var cls = 'page-tab' + (isActive ? ' active' : '');
      var tab = el('a', { className: cls, href: page }, page.replace(/^[/]/, '').replace(/[.]html$/, ''));
      pageSwitcher.appendChild(tab);
    }

    root.appendChild(pageSwitcher);
  }

  function fetchPages() {
    fetch(PAGES_URL)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        pages = d.pages || [];
        renderPageSwitcher();
      })
      .catch(function () { /* pages endpoint not available */ });
  }

  fetchPages();

  // ── Status bar ────────────────────────────────────────────────────────
  var status = el('div', { className: 'proto-status' });
  root.appendChild(status);
  renderStatusIdle();

  function renderStatusIdle() {
    status.replaceChildren('Proto Studio \u00b7 ', kbd('Alt+A'), ' annotate \u00b7 ', kbd('Alt+S'), ' sidebar');
  }

  function renderStatusAnnotating() {
    status.replaceChildren(span('mode-active', '\u25cf Annotation Mode'), ' \u00b7 Click an element to annotate');
  }

  function renderStatusSaved() {
    status.replaceChildren(span('saved-ok', '\u2713 Annotation saved'));
    setTimeout(function () {
      annotationMode ? renderStatusAnnotating() : renderStatusIdle();
    }, 2000);
  }

  // ── Annotation mode toggle ────────────────────────────────────────────
  function toggleAnnotationMode() {
    annotationMode = !annotationMode;
    document.body.classList.toggle('proto-overlay-active', annotationMode);
    annotationMode ? renderStatusAnnotating() : renderStatusIdle();
    if (annotationMode) {
      startAnnotationHover();
    } else {
      stopAnnotationHover();
      if (popover) { popover.remove(); popover = null; }
    }
  }

  // ── Task indicators ───────────────────────────────────────────────────
  var indicatorContainer = el('div', { className: 'proto-indicators' });
  root.appendChild(indicatorContainer);

  function hideIndicatorTooltip() {
    if (tooltipPinned) return;
    if (activeTooltip) { activeTooltip.remove(); activeTooltip = null; }
  }

  function forceHideTooltip() {
    tooltipPinned = false;
    if (activeTooltip) { activeTooltip.remove(); activeTooltip = null; }
  }

  function showIndicatorTooltip(indicator, group) {
    hideIndicatorTooltip();

    var tooltip = el('div', { className: 'proto-task-tooltip' });

    for (var i = 0; i < group.length; i++) {
      var task = group[i];

      var statusCls = 'status-badge status-' + task.status.replace(' ', '-');
      var statusBadge = el('span', { className: statusCls }, task.status);

      var header = el('div', { className: 'task-card-header' }, statusBadge);
      var titleEl = el('div', { className: 'task-title' }, task.title || 'Untitled');

      var editBtn = el('button', { className: 'edit-btn' }, '\u270f Edit');
      (function (t) {
        editBtn.addEventListener('click', function () {
          hideIndicatorTooltip();
          showEditModal(t);
        });
      })(task);

      var itemActions = el('div', { className: 'task-actions' }, editBtn);
      var card = el('div', { className: 'task-card' }, header, titleEl, itemActions);
      tooltip.appendChild(card);
    }

    var iRect = indicator.getBoundingClientRect();
    tooltip.style.left = Math.min(iRect.right + 6, window.innerWidth - 330) + 'px';
    tooltip.style.top = Math.max(4, Math.min(iRect.top - 8, window.innerHeight - 420)) + 'px';

    var closeBtn = el('button', { className: 'tooltip-close-btn' }, '\u2715');
    closeBtn.addEventListener('click', function (e) { e.stopPropagation(); forceHideTooltip(); });
    tooltip.insertBefore(closeBtn, tooltip.firstChild);

    tooltip.addEventListener('mouseleave', function () { hideIndicatorTooltip(); });
    root.appendChild(tooltip);
    activeTooltip = tooltip;
  }

  function renderIndicators() {
    indicatorContainer.replaceChildren();
    forceHideTooltip();
    if (!indicatorsVisible || tasks.length === 0) return;

    // Show only tasks for the current page (url matches pathname) or tasks without a url
    var currentPath = location.pathname;
    var pageTasks = tasks.filter(function (t) {
      return !t.url || t.url === currentPath;
    });
    if (pageTasks.length === 0) return;

    // Group tasks by selector
    var bySelector = {};
    for (var i = 0; i < pageTasks.length; i++) {
      var s = pageTasks[i].selector;
      if (!bySelector[s]) bySelector[s] = [];
      bySelector[s].push(pageTasks[i]);
    }

    for (var sel in bySelector) {
      var group = bySelector[sel];
      var targetEl;
      try { targetEl = document.querySelector(sel); } catch (e) { continue; }
      if (!targetEl) continue;

      var rect = targetEl.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;

      var activeTasks = group.filter(function (t) { return t.status !== 'done'; });
      var allDone = activeTasks.length === 0;
      if (allDone && !sidebarShowDone) continue;
      var count = activeTasks.length;

      (function (grp, allDoneFlag, countNum, elRect) {
        var indicator = el('div', { className: 'proto-task-indicator' + (allDoneFlag ? ' all-done' : '') });
        indicator.textContent = allDoneFlag ? '\u2713' : String(countNum);
        indicator.style.left = (elRect.right - 10) + 'px';
        indicator.style.top = (elRect.top - 10) + 'px';

        indicator.addEventListener('mouseenter', function () {
          if (!tooltipPinned) showIndicatorTooltip(indicator, grp);
        });
        indicator.addEventListener('mouseleave', function (e) {
          if (tooltipPinned) return;
          var rel = e.relatedTarget;
          if (activeTooltip && rel && (rel === activeTooltip || activeTooltip.contains(rel))) return;
          hideIndicatorTooltip();
        });
        indicator.addEventListener('click', function (e) {
          e.stopPropagation();
          forceHideTooltip();
          showIndicatorTooltip(indicator, grp);
          tooltipPinned = true;
        });

        indicatorContainer.appendChild(indicator);
      })(group, allDone, count, rect);
    }
  }

  function scheduleRenderIndicators() {
    if (indicatorRafId) return;
    indicatorRafId = requestAnimationFrame(function () {
      indicatorRafId = null;
      renderIndicators();
    });
  }

  window.addEventListener('scroll', scheduleRenderIndicators, true);
  window.addEventListener('resize', scheduleRenderIndicators);

  // ── Lightweight markdown renderer (no external deps) ────────────────
  function renderMarkdown(md) {
    if (!md) return '<span class="modal-preview-empty">No description yet</span>';
    var escaped = md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var html = escaped
      // Headings
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold then italic (avoid double-processing)
      .replace(/[*][*](.+?)[*][*]/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/[*](.+?)[*]/g, '<em>$1</em>')
      .replace(/_([^_]+?)_/g, '<em>$1</em>')
      // Inline code (single backtick) — written as char-code to avoid template interpolation
      .replace(new RegExp(String.fromCharCode(96) + '(.+?)' + String.fromCharCode(96), 'g'), '<code>$1</code>')
      // Unordered list items
      .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
      // HR
      .replace(/^---$/gm, '<hr>')
      // Wrap consecutive <li> in <ul>
      .replace(/(<li>[\\s\\S]*?<[/]li>\\n?)+/g, function (m) { return '<ul>' + m + '</ul>'; })
      // Remaining non-empty lines not already in a block element become paragraphs
      .replace(/^(?!<[a-z]|$).+$/gm, function (line) {
        return '<p>' + line + '</p>';
      });
    return html;
  }

  // ── Full-screen edit modal ────────────────────────────────────────────
  var editModal = null;

  function showEditModal(task) {
    if (editModal) { editModal.remove(); editModal = null; }

    // ── Header: title input + status select ──────────────────────────
    var titleInput = el('input', { type: 'text', placeholder: 'Task title...' });
    titleInput.value = task.title || '';

    var statusSelect = el('select', null);
    var statuses = ['todo', 'in-progress', 'done'];
    for (var j = 0; j < statuses.length; j++) {
      var opt = el('option', { value: statuses[j] }, statuses[j]);
      if (statuses[j] === task.status) opt.selected = true;
      statusSelect.appendChild(opt);
    }

    var header = el('div', { className: 'modal-header' }, titleInput, statusSelect);

    // ── Tabs ─────────────────────────────────────────────────────────
    var tabEdit    = el('div', { className: 'modal-tab active' }, 'Edit');
    var tabPreview = el('div', { className: 'modal-tab' }, 'Preview');
    var tabs = el('div', { className: 'modal-tabs' }, tabEdit, tabPreview);

    // ── Editor pane ───────────────────────────────────────────────────
    var textarea = el('textarea', { placeholder: 'Description (markdown supported)...' });
    textarea.value = task.description || '';
    var editorPane = el('div', { className: 'modal-editor-pane' }, textarea);

    // ── Preview pane ──────────────────────────────────────────────────
    var previewPane = el('div', { className: 'modal-preview-pane' });
    previewPane.style.display = 'none';

    function refreshPreview() {
      previewPane.innerHTML = renderMarkdown(textarea.value);
    }

    var body = el('div', { className: 'modal-body' }, editorPane, previewPane);

    // Tab switching
    tabEdit.addEventListener('click', function () {
      tabEdit.classList.add('active');
      tabPreview.classList.remove('active');
      editorPane.style.display = '';
      previewPane.style.display = 'none';
    });

    tabPreview.addEventListener('click', function () {
      tabPreview.classList.add('active');
      tabEdit.classList.remove('active');
      editorPane.style.display = 'none';
      previewPane.style.display = '';
      refreshPreview();
    });

    // ── Screenshot section ────────────────────────────────────────────
    var editCaptureBase64 = null;
    var screenshotSection = el('div', { className: 'screenshot-preview' });
    if (task.screenshot) {
      var screenshotImg = el('img', { src: '/screenshots/' + task.screenshot });
      screenshotImg.style.cssText = 'max-height:60px;border-radius:4px;border:1px solid #334155;';
      screenshotSection.appendChild(screenshotImg);
      var removeScreenshotBtn = el('button', null, '\u2715 Remove Screenshot');
      (function (t) {
        removeScreenshotBtn.addEventListener('click', function () {
          fetch(API_URL + '/' + t.id + '/screenshot', { method: 'DELETE' })
            .then(function (r) { return r.json(); })
            .then(function (d) { if (d.success) { fetchTasks(); } })
            .catch(function (err) { console.error('[Proto Studio]', err); });
          if (editModal) { editModal.remove(); editModal = null; }
        });
      })(task);
      screenshotSection.appendChild(removeScreenshotBtn);
    }

    // ── Footer: save / cancel / screenshot ───────────────────────────
    var btnSave   = el('button', { className: 'btn-primary' }, 'Save');
    var btnCancel = el('button', null, 'Cancel');
    var btnShot   = el('button', null, '\ud83d\udcf7 ' + (task.screenshot ? 'Replace Screenshot' : 'Add Screenshot'));
    var footer = el('div', { className: 'modal-footer' }, btnSave, btnCancel, screenshotSection, btnShot);

    var modal = el('div', { className: 'proto-modal' }, header, tabs, body, footer);
    var backdrop = el('div', { className: 'proto-modal-backdrop' }, modal);

    editModal = backdrop;
    root.appendChild(editModal);
    titleInput.focus();

    // Close on backdrop click (but not modal content)
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) { backdrop.remove(); editModal = null; }
    });

    // Screenshot capture
    btnShot.addEventListener('click', function () {
      backdrop.style.display = 'none';
      startAreaCapture(function (b64) {
        backdrop.style.display = '';
        if (!b64) return;
        editCaptureBase64 = b64;
        screenshotSection.innerHTML = '<img src="data:image/png;base64,' + b64 + '" style="max-height:60px;border-radius:4px;border:1px solid #334155;" />';
        btnShot.textContent = '\ud83d\udcf7 Replace Screenshot';
      });
    });

    // Save
    btnSave.addEventListener('click', function () {
      var newTitle = titleInput.value.trim();
      if (!newTitle) return;

      fetch(API_URL + '/' + task.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          status: statusSelect.value,
          description: textarea.value.trim(),
        }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.success) return;
          if (!editCaptureBase64) { fetchTasks(); return; }
          return fetch(API_URL + '/' + task.id + '/screenshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ screenshot: editCaptureBase64 }),
          }).then(function () { fetchTasks(); });
        })
        .catch(function (err) { console.error('[Proto Studio]', err); });

      backdrop.remove(); editModal = null;
    });

    btnCancel.addEventListener('click', function () { backdrop.remove(); editModal = null; });

    // Keyboard: Escape closes, Ctrl+Enter saves
    document.addEventListener('keydown', function onModalKey(e) {
      if (!editModal) { document.removeEventListener('keydown', onModalKey); return; }
      if (e.key === 'Escape') { backdrop.remove(); editModal = null; document.removeEventListener('keydown', onModalKey); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { btnSave.click(); document.removeEventListener('keydown', onModalKey); }
    });
  }

  // ── Annotation popover (create new task) ─────────────────────────────
  function showPopover(element, x, y) {
    if (popover) { popover.remove(); popover = null; }
    var info = buildElementSelector(element);
    var selector    = info.selector;
    var displayName = info.display;

    var label    = el('div', { className: 'popover-label' }, 'Annotating: ', el('strong', null, displayName.slice(0, 60)));
    var titleInput = el('input', { type: 'text', placeholder: 'Task title...' });
    var textarea  = el('textarea', { placeholder: 'Describe your feedback...' });
    var btnSave   = el('button', { className: 'btn-primary' }, 'Save');
    var btnCancel = el('button', null, 'Cancel');
    var btnCapture = el('button', null, '\ud83d\udcf7 Capture Area');
    var screenshotPreview = el('div', { className: 'screenshot-preview' });
    var actions = el('div', { className: 'popover-actions' }, btnSave, btnCancel, btnCapture);

    popover = el('div', { className: 'proto-popover' }, label, titleInput, textarea, screenshotPreview, actions);

    var posX = x !== undefined ? x : element.getBoundingClientRect().left;
    var posY = y !== undefined ? y : element.getBoundingClientRect().bottom + 8;
    popover.style.left = Math.min(posX, window.innerWidth - 420) + 'px';
    popover.style.top  = Math.min(posY, window.innerHeight - 300) + 'px';

    root.appendChild(popover);
    titleInput.focus();
    captureBase64 = null;

    btnCapture.addEventListener('click', function () {
      if (popover) popover.style.visibility = 'hidden';
      startAreaCapture(function (b64) {
        captureBase64 = b64;
        if (popover) {
          popover.style.visibility = '';
          screenshotPreview.innerHTML = b64
            ? '<img src="data:image/png;base64,' + b64 + '" style="max-width:100%;border-radius:4px;margin-top:6px;border:1px solid #334155;" />'
            : '';
        }
      });
    });

    btnSave.addEventListener('click', function () {
      var text = textarea.value.trim();
      var title = titleInput.value.trim() || text.slice(0, 80) || 'Untitled';
      if (!text && !title) return;
      submitTask(selector, title, text || title, captureBase64);
      captureBase64 = null;
      popover.remove(); popover = null;
    });

    btnCancel.addEventListener('click', function () {
      popover.remove(); popover = null;
    });
  }

  function submitTask(selector, title, description, screenshotBase64) {
    var url = location.pathname;
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        description: description,
        selector: selector,
        url: url,
        screenshot: screenshotBase64 || null,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.success) { renderStatusSaved(); fetchTasks(); } })
      .catch(function (err) { console.error('[Proto Studio]', err); });
  }

  // ── Area screenshot capture ───────────────────────────────────────────
  var captureBase64 = null;

  function startAreaCapture(onDone) {
    var selBox = document.createElement('div');
    selBox.style.cssText = 'position:fixed;border:2px dashed #3b82f6;background:rgba(59,130,246,0.08);pointer-events:none;z-index:2147483646;';
    var curtain = document.createElement('div');
    curtain.style.cssText = 'position:fixed;inset:0;z-index:2147483645;cursor:crosshair;';
    document.body.appendChild(curtain);
    document.body.appendChild(selBox);

    var startX = 0, startY = 0, dragging = false;

    curtain.addEventListener('mousedown', function (e) {
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      selBox.style.left = startX + 'px'; selBox.style.top = startY + 'px';
      selBox.style.width = '0'; selBox.style.height = '0';
    });

    curtain.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var x = Math.min(e.clientX, startX), y = Math.min(e.clientY, startY);
      var w = Math.abs(e.clientX - startX), h = Math.abs(e.clientY - startY);
      selBox.style.left = x + 'px'; selBox.style.top = y + 'px';
      selBox.style.width = w + 'px'; selBox.style.height = h + 'px';
    });

    curtain.addEventListener('mouseup', function (e) {
      dragging = false;
      curtain.remove(); selBox.remove();
      var x = Math.min(e.clientX, startX), y = Math.min(e.clientY, startY);
      var w = Math.abs(e.clientX - startX), h = Math.abs(e.clientY - startY);
      if (w < 10 || h < 10) { onDone(null); return; }
      captureArea(x, y, w, h, onDone);
    });

    document.addEventListener('keydown', function onEsc(e) {
      if (e.key !== 'Escape') return;
      document.removeEventListener('keydown', onEsc);
      curtain.remove(); selBox.remove();
      onDone(null);
    }, { once: false, capture: true });
  }

  function captureArea(x, y, w, h, onDone) {
    var done = false;
    var timer = null;

    function onExtResponse(e) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      document.removeEventListener('proto-capture-response', onExtResponse);
      cropFromFullScreenshot(e.detail.dataUrl, x, y, w, h, onDone);
    }

    document.addEventListener('proto-capture-response', onExtResponse);
    document.dispatchEvent(new CustomEvent('proto-capture-request', {
      detail: { x: x, y: y, width: w, height: h, devicePixelRatio: window.devicePixelRatio || 1 }
    }));

    timer = setTimeout(function () {
      if (done) return;
      done = true;
      document.removeEventListener('proto-capture-response', onExtResponse);
      captureAreaWithCanvas(x, y, w, h, onDone);
    }, 1500);
  }

  function cropFromFullScreenshot(fullDataUrl, x, y, w, h, onDone) {
    var img = new Image();
    img.onload = function () {
      var dpr = window.devicePixelRatio || 1;
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img,
        (x + window.scrollX) * dpr, (y + window.scrollY) * dpr,
        w * dpr, h * dpr,
        0, 0, w, h
      );
      onDone(canvas.toDataURL('image/png').replace('data:image/png;base64,', ''));
    };
    img.onerror = function () { onDone(null); };
    img.src = fullDataUrl;
  }

  function captureAreaWithCanvas(x, y, w, h, onDone) {
    function doCapture() {
      window.html2canvas(document.documentElement, {
        x: x + window.scrollX, y: y + window.scrollY,
        width: w, height: h, scale: 1, useCORS: true, logging: false,
      }).then(function (canvas) {
        onDone(canvas.toDataURL('image/png').replace('data:image/png;base64,', ''));
      }).catch(function () { onDone(null); });
    }
    if (window.html2canvas) { doCapture(); return; }
    var s = document.createElement('script');
    s.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
    s.onload = doCapture;
    s.onerror = function () { onDone(null); };
    document.head.appendChild(s);
  }

  // ── Task actions ──────────────────────────────────────────────────────
  function markTaskDone(taskId) {
    fetch(API_URL + '/' + taskId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    })
      .then(function () { fetchTasks(); })
      .catch(function (err) { console.error('[Proto Studio]', err); });
  }

  function removeTask(taskId) {
    fetch(API_URL + '/' + taskId, { method: 'DELETE' })
      .then(function () { fetchTasks(); })
      .catch(function (err) { console.error('[Proto Studio]', err); });
  }

  // ── Edge-hover sidebar trigger ────────────────────────────────────────
  var edgeTrigger = el('div', { className: 'proto-edge-trigger' });
  root.appendChild(edgeTrigger);

  edgeTrigger.addEventListener('mouseenter', function () {
    if (!sidebar) createSidebar();
    if (!sidebar.classList.contains('open')) {
      sidebar.classList.add('open');
      fetchTasks();
      refreshSidebar();
    }
  });

  // ── Sidebar ───────────────────────────────────────────────────────────
  function createSidebar() {
    sidebar = el('div', { className: 'proto-sidebar' });
    root.appendChild(sidebar);

    sidebar.addEventListener('mouseleave', function () {
      if (!sidebarPinned && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
    });
  }

  function toggleSidebar() {
    if (!sidebar) createSidebar();
    var isOpen = sidebar.classList.contains('open');
    if (isOpen) {
      sidebar.classList.remove('open');
      sidebarPinned = false;
    } else {
      sidebar.classList.add('open');
      sidebarPinned = true;
      fetchTasks();
      refreshSidebar();
    }
  }

  function refreshSidebar() {
    if (!sidebar) return;
    sidebar.replaceChildren();

    var closeBtn = el('span', { className: 'sidebar-close' }, '\u2715');
    closeBtn.addEventListener('click', function () { sidebar.classList.remove('open'); sidebarPinned = false; });

    var todoCount = tasks.filter(function (t) { return t.status !== 'done'; }).length;
    sidebar.appendChild(el('h3', null, 'Tasks (' + todoCount + '/' + tasks.length + ')', closeBtn));

    // Legend / filter toggles
    var legendSection = el('div', { className: 'sidebar-legend' });
    var indicBtn = el('button', { className: 'legend-toggle' + (indicatorsVisible ? ' active' : '') });
    indicBtn.textContent = (indicatorsVisible ? '\u25cf' : '\u25cb') + ' Overlay Badges';
    indicBtn.addEventListener('click', function () {
      indicatorsVisible = !indicatorsVisible;
      savePrefs();
      renderIndicators();
      refreshSidebar();
    });
    legendSection.appendChild(indicBtn);

    var doneToggleBtn = el('button', { className: 'legend-toggle' + (sidebarShowDone ? ' active' : '') });
    doneToggleBtn.textContent = '\u2713 Show Done Tasks';
    doneToggleBtn.addEventListener('click', function () {
      sidebarShowDone = !sidebarShowDone;
      savePrefs();
      renderIndicators();
      refreshSidebar();
    });
    legendSection.appendChild(doneToggleBtn);
    sidebar.appendChild(legendSection);

    var visibleTasks = sidebarShowDone ? tasks : tasks.filter(function (t) { return t.status !== 'done'; });
    if (visibleTasks.length === 0) {
      sidebar.appendChild(el('p', { className: 'empty-msg' }, tasks.length === 0 ? 'No tasks yet. Right-click or Alt+A to annotate.' : 'All done! Toggle "Show Done" to see completed tasks.'));
      return;
    }

    // Show active tasks first, then done
    var sorted = visibleTasks.slice().sort(function (a, b) {
      var order = { 'in-progress': 0, 'todo': 1, 'done': 2 };
      return (order[a.status] || 1) - (order[b.status] || 1);
    });

    for (var i = 0; i < sorted.length; i++) {
      var task = sorted[i];

      var statusCls = 'status-badge status-' + task.status.replace(' ', '-');
      var statusBadge = el('span', { className: statusCls }, task.status);

      var header = el('div', { className: 'task-card-header' }, statusBadge);
      var titleEl = el('div', { className: 'task-title' }, task.title);
      var selectorEl = el('div', { className: 'task-selector' }, task.selector);

      var card = el('div', { className: 'task-card' }, header, titleEl, selectorEl);

      if (task.description) {
        card.appendChild(el('div', { className: 'task-description' }, task.description.slice(0, 120)));
      }

      var editBtn = el('button', { className: 'edit-btn' }, '\u270f Edit');
      (function (t) {
        editBtn.addEventListener('click', function (e) { e.stopPropagation(); showEditModal(t); });
      })(task);

      if (task.status !== 'done') {
        var doneBtn = el('button', { className: 'done-btn' }, '\u2713 Done');
        (function (id) { doneBtn.addEventListener('click', function (e) { e.stopPropagation(); markTaskDone(id); }); })(task.id);
        var deleteBtn = el('button', { className: 'delete-btn' }, '\u2715');
        (function (id) { deleteBtn.addEventListener('click', function (e) { e.stopPropagation(); removeTask(id); }); })(task.id);
        card.appendChild(el('div', { className: 'task-actions' }, editBtn, doneBtn, deleteBtn));
      } else {
        var deleteBtn2 = el('button', { className: 'delete-btn' }, '\u2715');
        (function (id) { deleteBtn2.addEventListener('click', function (e) { e.stopPropagation(); removeTask(id); }); })(task.id);
        card.appendChild(el('div', { className: 'task-actions' }, editBtn, deleteBtn2));
      }

      sidebar.appendChild(card);
    }
  }

  // ── Context menu (right-click) ────────────────────────────────────────
  function showContextMenu(element, x, y) {
    hideContextMenu();
    var info = buildElementSelector(element);
    var displayName = info.display;

    contextMenu = el('div', { className: 'proto-context-menu' });
    contextMenu.style.left = Math.min(x, window.innerWidth - 220) + 'px';
    contextMenu.style.top  = Math.min(y, window.innerHeight - 200) + 'px';

    var annotateBtn = el('button', null,
      el('span', { className: 'menu-icon' }, '\u270f'),
      'Annotate "' + displayName.slice(0, 30) + '"'
    );
    annotateBtn.addEventListener('click', function () {
      hideContextMenu();
      showPopover(element, x, y);
    });
    contextMenu.appendChild(annotateBtn);

    root.appendChild(contextMenu);

    setTimeout(function () {
      document.addEventListener('click', hideContextMenu, { once: true });
    }, 0);
  }

  function hideContextMenu() {
    if (contextMenu) { contextMenu.remove(); contextMenu = null; }
  }

  // ── Close pinned tooltip on outside click ─────────────────────────────
  document.addEventListener('click', function (e) {
    if (!tooltipPinned || !activeTooltip) return;
    var path = e.composedPath ? e.composedPath() : [e.target];
    for (var k = 0; k < path.length; k++) {
      if (path[k] === host) return;
    }
    forceHideTooltip();
  }, true);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  // Use capture phase so Alt+A / Alt+S fire even if the host app has its
  // own keydown handlers in the bubble phase.
  document.addEventListener('keydown', function (e) {
    if (e.altKey && e.key === 'a') { e.preventDefault(); toggleAnnotationMode(); }
    if (e.altKey && e.key === 's') { e.preventDefault(); toggleSidebar(); }
    if (e.key === 'Escape') {
      if (contextMenu) { hideContextMenu(); }
      else if (popover)  { popover.remove(); popover = null; }
      else if (annotationMode) { toggleAnnotationMode(); }
      else if (sidebar && sidebar.classList.contains('open')) { sidebar.classList.remove('open'); sidebarPinned = false; }
    }
  }, true);

  // ── Right-click context menu ──────────────────────────────────────────
  document.addEventListener('contextmenu', function (e) {
    var target = e.target.closest('[data-proto-id]') || e.target.closest('[data-testid]') || e.target;
    if (!target || target === document.body || target === document.documentElement) return;
    if (e.composedPath().indexOf(host) !== -1) return;
    e.preventDefault();
    showContextMenu(target, e.clientX, e.clientY);
  }, true);

  // ── Click-to-annotate ─────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    if (!annotationMode) return;
    if (e.composedPath().indexOf(host) !== -1) return;
    var target = e.target.closest('[data-proto-id]') || e.target.closest('[data-testid]') || e.target;
    if (!target || target === document.body || target === document.documentElement) return;
    e.preventDefault();
    e.stopPropagation();
    showPopover(target, e.clientX, e.clientY);
  }, true);

}());
`;
}

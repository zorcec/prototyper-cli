import { OVERLAY_CSS, HOST_PAGE_CSS } from "./overlay-css.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tag configuration
// ─────────────────────────────────────────────────────────────────────────────
const TAG_COLORS: Record<string, string> = {
  TODO:     "#ef4444",
  FEATURE:  "#3b82f6",
  VARIANT:  "#8b5cf6",
  KEEP:     "#22c55e",
  QUESTION: "#f59e0b",
  CONTEXT:  "#6b7280",
};

const TAGS = Object.keys(TAG_COLORS);

export function getOverlayScript(port: number): string {
  return `
(function () {
  'use strict';

  // Skip if Chrome extension already injected the overlay
  if (document.getElementById('proto-studio-root')) return;

  var WS_URL     = 'ws://localhost:${port}';
  var API_URL    = 'http://localhost:${port}/api/tasks';
  var TAGS       = ${JSON.stringify(TAGS)};
  var TAG_COLORS = ${JSON.stringify(TAG_COLORS)};

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
    if (!annotationMode && popover) { popover.remove(); popover = null; }
  }

  // ── Task indicators ───────────────────────────────────────────────────
  var indicatorContainer = el('div', { className: 'proto-indicators' });
  root.appendChild(indicatorContainer);

  function hideIndicatorTooltip() {
    if (activeTooltip) { activeTooltip.remove(); activeTooltip = null; }
  }

  function showIndicatorTooltip(indicator, group) {
    hideIndicatorTooltip();

    var tooltip = el('div', { className: 'proto-task-tooltip' });

    for (var i = 0; i < group.length; i++) {
      var task = group[i];
      var color = TAG_COLORS[task.tag] || '#6b7280';

      var badge = el('span', { className: 'tag-badge' }, task.tag);
      badge.style.background = color;

      var statusCls = 'status-badge status-' + task.status.replace(' ', '-');
      var statusBadge = el('span', { className: statusCls }, task.status);

      var header = el('div', { className: 'task-card-header' }, badge, statusBadge);
      var titleEl = el('div', { className: 'task-title' }, task.title || 'Untitled');

      var editBtn = el('button', { className: 'edit-btn' }, '\u270f Edit');
      (function (t) {
        editBtn.addEventListener('click', function () {
          hideIndicatorTooltip();
          showEditPopover(t);
        });
      })(task);

      var itemActions = el('div', { className: 'task-actions' }, editBtn);
      var card = el('div', { className: 'task-card' }, header, titleEl, itemActions);
      tooltip.appendChild(card);
    }

    var iRect = indicator.getBoundingClientRect();
    tooltip.style.left = Math.min(iRect.right + 6, window.innerWidth - 330) + 'px';
    tooltip.style.top = Math.max(4, Math.min(iRect.top - 8, window.innerHeight - 420)) + 'px';

    tooltip.addEventListener('mouseleave', function () { hideIndicatorTooltip(); });
    root.appendChild(tooltip);
    activeTooltip = tooltip;
  }

  function renderIndicators() {
    indicatorContainer.replaceChildren();
    hideIndicatorTooltip();
    if (tasks.length === 0) return;

    // Group tasks by selector
    var bySelector = {};
    for (var i = 0; i < tasks.length; i++) {
      var s = tasks[i].selector;
      if (!bySelector[s]) bySelector[s] = [];
      bySelector[s].push(tasks[i]);
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
      var count = activeTasks.length;

      (function (grp, allDoneFlag, countNum, elRect) {
        var indicator = el('div', { className: 'proto-task-indicator' + (allDoneFlag ? ' all-done' : '') });
        indicator.textContent = allDoneFlag ? '\u2713' : String(countNum);
        indicator.style.left = (elRect.right - 10) + 'px';
        indicator.style.top = (elRect.top - 10) + 'px';

        indicator.addEventListener('mouseenter', function () {
          showIndicatorTooltip(indicator, grp);
        });
        indicator.addEventListener('mouseleave', function (e) {
          var rel = e.relatedTarget;
          if (activeTooltip && rel && (rel === activeTooltip || activeTooltip.contains(rel))) return;
          hideIndicatorTooltip();
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

  // ── Edit task popover ─────────────────────────────────────────────────
  function showEditPopover(task) {
    if (popover) { popover.remove(); popover = null; }

    var label = el('div', { className: 'popover-label' }, 'Edit: ', el('strong', null, (task.title || 'Untitled').slice(0, 60)));

    var titleInput = el('input', { type: 'text', placeholder: 'Task title...' });
    titleInput.value = task.title || '';

    var tagSelect = el('select', null);
    for (var i = 0; i < TAGS.length; i++) {
      tagSelect.appendChild(el('option', { value: TAGS[i] }, TAGS[i]));
    }
    tagSelect.value = task.tag;

    var statusSelect = el('select', null);
    var statuses = ['todo', 'in-progress', 'done'];
    for (var j = 0; j < statuses.length; j++) {
      statusSelect.appendChild(el('option', { value: statuses[j] }, statuses[j]));
    }
    statusSelect.value = task.status;

    var textarea = el('textarea', { placeholder: 'Description...' });
    textarea.value = task.description || '';

    var btnUpdate = el('button', { className: 'btn-primary' }, 'Update');
    var btnCancel = el('button', null, 'Cancel');
    var actions = el('div', { className: 'popover-actions' }, btnUpdate, btnCancel);

    popover = el('div', { className: 'proto-popover' }, label, titleInput, tagSelect, statusSelect, textarea, actions);
    popover.style.left = Math.max(10, window.innerWidth / 2 - 200) + 'px';
    popover.style.top = Math.max(10, window.innerHeight / 2 - 200) + 'px';

    root.appendChild(popover);
    titleInput.focus();

    btnUpdate.addEventListener('click', function () {
      var newTitle = titleInput.value.trim();
      if (!newTitle) return;

      fetch(API_URL + '/' + task.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          tag: tagSelect.value,
          status: statusSelect.value,
          description: textarea.value.trim(),
        }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d.success) { fetchTasks(); } })
        .catch(function (err) { console.error('[Proto Studio]', err); });

      popover.remove(); popover = null;
    });

    btnCancel.addEventListener('click', function () { popover.remove(); popover = null; });
  }

  // ── Annotation popover (create new task) ─────────────────────────────
  function showPopover(element, x, y) {
    if (popover) { popover.remove(); popover = null; }
    var protoId = element.getAttribute('data-proto-id');
    if (!protoId) return;

    var label    = el('div', { className: 'popover-label' }, 'Annotating: ', el('strong', null, protoId));
    var titleInput = el('input', { type: 'text', placeholder: 'Task title...' });
    var select   = el('select', null);
    for (var i = 0; i < TAGS.length; i++) {
      select.appendChild(el('option', { value: TAGS[i] }, TAGS[i]));
    }
    var textarea  = el('textarea', { placeholder: 'Describe your feedback...' });
    var btnSave   = el('button', { className: 'btn-primary' }, 'Save');
    var btnCancel = el('button', null, 'Cancel');
    var btnCapture = el('button', null, '\ud83d\udcf7 Capture Area');
    var screenshotPreview = el('div', { className: 'screenshot-preview' });
    var actions = el('div', { className: 'popover-actions' }, btnSave, btnCancel, btnCapture);

    popover = el('div', { className: 'proto-popover' }, label, titleInput, select, textarea, screenshotPreview, actions);

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
      submitTask(protoId, select.value, title, text || title, captureBase64);
      captureBase64 = null;
      popover.remove(); popover = null;
    });

    btnCancel.addEventListener('click', function () {
      popover.remove(); popover = null;
    });
  }

  function submitTask(protoId, tag, title, description, screenshotBase64) {
    var url = location.pathname;
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        description: description,
        tag: tag,
        selector: '[data-proto-id="' + protoId + '"]',
        url: url,
        priority: 'medium',
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
      captureAreaWithCanvas(x, y, w, h, onDone);
    });

    document.addEventListener('keydown', function onEsc(e) {
      if (e.key !== 'Escape') return;
      document.removeEventListener('keydown', onEsc);
      curtain.remove(); selBox.remove();
      onDone(null);
    }, { once: false, capture: true });
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

    if (tasks.length === 0) {
      sidebar.appendChild(el('p', { className: 'empty-msg' }, 'No tasks yet. Right-click or Alt+A to annotate.'));
      return;
    }

    // Show active tasks first, then done
    var sorted = tasks.slice().sort(function (a, b) {
      var order = { 'in-progress': 0, 'todo': 1, 'done': 2 };
      return (order[a.status] || 1) - (order[b.status] || 1);
    });

    for (var i = 0; i < sorted.length; i++) {
      var task = sorted[i];
      var color = TAG_COLORS[task.tag] || '#6b7280';

      var badge = el('span', { className: 'tag-badge' }, task.tag);
      badge.style.background = color;

      var statusCls = 'status-badge status-' + task.status.replace(' ', '-');
      var statusBadge = el('span', { className: statusCls }, task.status);

      var header = el('div', { className: 'task-card-header' }, badge, statusBadge);
      var titleEl = el('div', { className: 'task-title' }, task.title);
      var selectorEl = el('div', { className: 'task-selector' }, task.selector);

      var card = el('div', { className: 'task-card' }, header, titleEl, selectorEl);

      if (task.description) {
        card.appendChild(el('div', { className: 'task-description' }, task.description.slice(0, 120)));
      }

      var editBtn = el('button', { className: 'edit-btn' }, '\u270f Edit');
      (function (t) {
        editBtn.addEventListener('click', function (e) { e.stopPropagation(); showEditPopover(t); });
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
    var protoId = element.getAttribute('data-proto-id');
    if (!protoId) return;

    contextMenu = el('div', { className: 'proto-context-menu' });
    contextMenu.style.left = Math.min(x, window.innerWidth - 220) + 'px';
    contextMenu.style.top  = Math.min(y, window.innerHeight - 200) + 'px';

    var menuItems = [
      { icon: '\u270f', label: 'Add TODO', tag: 'TODO' },
      { icon: '\u2728', label: 'Add FEATURE', tag: 'FEATURE' },
      { icon: '\ud83d\udd04', label: 'Add VARIANT', tag: 'VARIANT' },
      { icon: '\u2753', label: 'Add QUESTION', tag: 'QUESTION' },
    ];

    for (var i = 0; i < menuItems.length; i++) {
      var item = menuItems[i];
      var btn = el('button', null,
        el('span', { className: 'menu-icon' }, item.icon),
        item.label + ' for "' + protoId + '"'
      );
      (function (tag) {
        btn.addEventListener('click', function () {
          hideContextMenu();
          showPopover(element, x, y);
          setTimeout(function () {
            if (popover) {
              var sel = popover.querySelector('select');
              if (sel) sel.value = tag;
            }
          }, 0);
        });
      })(item.tag);
      contextMenu.appendChild(btn);
    }

    root.appendChild(contextMenu);

    setTimeout(function () {
      document.addEventListener('click', hideContextMenu, { once: true });
    }, 0);
  }

  function hideContextMenu() {
    if (contextMenu) { contextMenu.remove(); contextMenu = null; }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.altKey && e.key === 'a') { e.preventDefault(); toggleAnnotationMode(); }
    if (e.altKey && e.key === 's') { e.preventDefault(); toggleSidebar(); }
    if (e.key === 'Escape') {
      if (contextMenu) { hideContextMenu(); }
      else if (popover)  { popover.remove(); popover = null; }
      else if (annotationMode) { toggleAnnotationMode(); }
      else if (sidebar && sidebar.classList.contains('open')) { sidebar.classList.remove('open'); sidebarPinned = false; }
    }
  });

  // ── Right-click context menu ──────────────────────────────────────────
  document.addEventListener('contextmenu', function (e) {
    var target = e.target.closest('[data-proto-id]');
    if (!target) return;
    if (e.composedPath().indexOf(host) !== -1) return;
    e.preventDefault();
    showContextMenu(target, e.clientX, e.clientY);
  }, true);

  // ── Click-to-annotate ─────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    if (!annotationMode) return;
    if (e.composedPath().indexOf(host) !== -1) return;
    var target = e.target.closest('[data-proto-id]');
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    showPopover(target, e.clientX, e.clientY);
  }, true);

}());
`;
}

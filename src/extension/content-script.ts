// Proto Studio Chrome Extension — Content Script
// Injects the overlay into the current page, connecting to the CLI server.
// Skips injection if the server-injected overlay is already present.

const DEFAULT_PORT = 3700;
const STORAGE_KEY = "proto-studio-config";

interface ProtoExtConfig {
  port: number;
  enabled: boolean;
}

function getConfig(): Promise<ProtoExtConfig> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "get-config" }, (response) => {
      resolve(response || { port: DEFAULT_PORT, enabled: true });
    });
  });
}

async function init() {
  const config = await getConfig();
  if (!config.enabled) return;

  // Don't inject if server overlay already present
  if (document.getElementById("proto-studio-root")) return;

  injectOverlay(config.port);
}

function injectOverlay(port: number) {
  // Dynamically inject the overlay script using the same logic as the server
  const script = document.createElement("script");
  script.setAttribute("data-proto-overlay", "extension");
  script.textContent = buildOverlayScript(port);
  document.body.appendChild(script);
}

function buildOverlayScript(port: number): string {
  // This generates the same overlay as getOverlayScript() in overlay.ts
  // but configured for extension mode (no reload on file change, just task management)
  const TAG_COLORS: Record<string, string> = {
    TODO: "#ef4444",
    FEATURE: "#3b82f6",
    VARIANT: "#8b5cf6",
    KEEP: "#22c55e",
    QUESTION: "#f59e0b",
    CONTEXT: "#6b7280",
  };
  const TAGS = Object.keys(TAG_COLORS);

  const OVERLAY_CSS = `
  :host {
    all: initial;
    display: block;
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 2147483647;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #e2e8f0;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  .proto-status { position: fixed; bottom: 16px; right: 16px; background: #0f172a; color: #e2e8f0; padding: 8px 14px; border-radius: 8px; font-size: 13px; pointer-events: auto; user-select: none; box-shadow: 0 4px 16px rgba(0,0,0,0.5); border: 1px solid #1e293b; }
  .proto-status kbd { display: inline-block; padding: 1px 5px; background: #1e293b; border: 1px solid #334155; border-radius: 3px; font-size: 11px; color: #94a3b8; }
  .proto-status .mode-active { color: #60a5fa; font-weight: 600; }
  .proto-status .saved-ok { color: #4ade80; }
  .proto-popover { position: fixed; background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,0.4); padding: 16px; min-width: 320px; max-width: 400px; pointer-events: auto; }
  .popover-label { font-size: 12px; color: #94a3b8; margin-bottom: 10px; }
  .popover-label strong { color: #e2e8f0; font-weight: 600; }
  .proto-popover input[type="text"] { display: block; width: 100%; padding: 6px 10px; margin-bottom: 8px; border: 1px solid #334155; border-radius: 6px; background: #0f172a; color: #e2e8f0; font-size: 14px; font-family: system-ui, sans-serif; }
  .proto-popover input[type="text"]:focus { outline: 2px solid #3b82f6; outline-offset: 1px; border-color: #3b82f6; }
  .proto-popover input[type="text"]::placeholder { color: #64748b; }
  .proto-popover select { display: block; width: 100%; padding: 6px 8px; margin-bottom: 8px; border: 1px solid #334155; border-radius: 6px; background: #0f172a; color: #e2e8f0; font-size: 14px; cursor: pointer; appearance: auto; }
  .proto-popover select:focus { outline: 2px solid #3b82f6; outline-offset: 1px; }
  .proto-popover textarea { display: block; width: 100%; min-height: 80px; padding: 8px; margin-bottom: 10px; border: 1px solid #334155; border-radius: 6px; background: #0f172a; color: #e2e8f0; font-size: 14px; line-height: 1.5; resize: vertical; }
  .proto-popover textarea:focus { outline: 2px solid #3b82f6; outline-offset: 1px; }
  .proto-popover textarea::placeholder { color: #64748b; }
  .popover-actions { display: flex; gap: 8px; margin-top: 4px; }
  .proto-popover button { padding: 6px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid #334155; background: #334155; color: #e2e8f0; transition: background 0.1s; }
  .proto-popover button:hover { background: #475569; }
  .proto-popover button.btn-primary { background: #3b82f6; color: #fff; border-color: #2563eb; }
  .proto-popover button.btn-primary:hover { background: #2563eb; }
  .proto-edge-trigger { position: fixed; right: 0; top: 0; width: 8px; height: 100vh; pointer-events: auto; z-index: 1; }
  .proto-sidebar { position: fixed; right: 0; top: 0; width: 360px; height: 100vh; background: #0f172a; color: #e2e8f0; border-left: 1px solid #1e293b; overflow-y: auto; padding: 16px; box-shadow: -4px 0 20px rgba(0,0,0,0.4); pointer-events: auto; transform: translateX(100%); transition: transform 0.2s ease; }
  .proto-sidebar.open { transform: translateX(0); }
  .proto-sidebar h3 { margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #f1f5f9; display: flex; align-items: center; justify-content: space-between; }
  .sidebar-close { background: none; border: none; color: #94a3b8; font-size: 18px; cursor: pointer; padding: 2px 6px; border-radius: 4px; }
  .sidebar-close:hover { background: #1e293b; color: #e2e8f0; }
  .empty-msg { color: #64748b; font-size: 14px; padding: 8px 0; }
  .task-card { margin: 8px 0; padding: 12px; border: 1px solid #1e293b; border-radius: 8px; background: #1e293b; }
  .task-card:hover { border-color: #334155; }
  .task-card-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .tag-badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; }
  .status-badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; text-transform: uppercase; border: 1px solid; }
  .status-todo { color: #f59e0b; border-color: #f59e0b; background: rgba(245,158,11,0.1); }
  .status-in-progress { color: #3b82f6; border-color: #3b82f6; background: rgba(59,130,246,0.1); }
  .status-done { color: #22c55e; border-color: #22c55e; background: rgba(34,197,94,0.1); }
  .task-title { font-size: 13px; font-weight: 500; color: #f1f5f9; margin: 4px 0 2px; }
  .task-selector { font-size: 11px; color: #64748b; font-family: monospace; }
  .task-description { margin: 6px 0 0; font-size: 12px; color: #94a3b8; line-height: 1.4; }
  .task-card .task-actions { display: flex; gap: 4px; margin-top: 8px; }
  .task-card .task-actions button { padding: 2px 8px; font-size: 11px; border-radius: 4px; background: #334155; border: 1px solid #475569; color: #cbd5e1; cursor: pointer; }
  .task-card .task-actions button:hover { background: #475569; }
  .task-card .task-actions button.done-btn { color: #4ade80; border-color: #4ade80; }
  .task-card .task-actions button.delete-btn { color: #f87171; border-color: #f87171; }
  .proto-context-menu { position: fixed; background: #1e293b; border: 1px solid #334155; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); min-width: 200px; pointer-events: auto; padding: 4px; }
  .proto-context-menu button { display: block; width: 100%; text-align: left; padding: 8px 12px; border: none; background: none; color: #e2e8f0; font-size: 13px; cursor: pointer; border-radius: 4px; }
  .proto-context-menu button:hover { background: #334155; }
  .proto-context-menu .menu-icon { display: inline-block; width: 18px; text-align: center; margin-right: 8px; }
  `;

  const HOST_PAGE_CSS = `.proto-overlay-active [data-proto-id]:hover { outline: 2px solid #3b82f6 !important; outline-offset: 2px !important; cursor: crosshair !important; }`;

  return `
(function () {
  'use strict';
  if (document.getElementById('proto-studio-root')) return;

  var WS_URL     = 'ws://localhost:${port}';
  var API_URL    = 'http://localhost:${port}/api/tasks';
  var TAGS       = ${JSON.stringify(TAGS)};
  var TAG_COLORS = ${JSON.stringify(TAG_COLORS)};

  var host = document.createElement('div');
  host.id = 'proto-studio-root';
  host.setAttribute('data-proto-source', 'extension');
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });

  var styleEl = document.createElement('style');
  styleEl.textContent = ${JSON.stringify(OVERLAY_CSS)};
  root.appendChild(styleEl);

  var hostStyle = document.createElement('style');
  hostStyle.textContent = ${JSON.stringify(HOST_PAGE_CSS)};
  document.head.appendChild(hostStyle);

  var annotationMode = false;
  var sidebar = null, popover = null, contextMenu = null;
  var tasks = [];
  var sidebarPinned = false;

  // Stable WebSocket with exponential backoff + ping/pong
  var ws = null, reconnectAttempt = 0, reconnectTimer = null, pingInterval = null;

  function connectWS() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    try { ws = new WebSocket(WS_URL); } catch (e) { scheduleReconnect(); return; }

    ws.onopen = function () {
      reconnectAttempt = 0;
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(function () {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      }, 25000);
    };

    ws.onmessage = function (e) {
      var msg; try { msg = JSON.parse(e.data); } catch (_) { return; }
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
    var delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
    reconnectAttempt++;
    reconnectTimer = setTimeout(connectWS, delay);
  }

  // Reconnect when tab becomes visible (handles sleep / tab switch)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && (!ws || ws.readyState !== WebSocket.OPEN)) {
      reconnectAttempt = 0;
      connectWS();
    }
  });

  connectWS();

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
  function kbd(t) { return el('kbd', null, t); }
  function span(c, t) { return el('span', { className: c }, t); }

  function fetchTasks() {
    fetch(API_URL).then(function(r){return r.json();}).then(function(d){tasks=d.tasks||[];if(sidebar&&sidebar.classList.contains('open'))refreshSidebar();}).catch(function(){});
  }
  fetchTasks();

  var status = el('div', { className: 'proto-status' });
  root.appendChild(status);
  renderStatusIdle();

  function renderStatusIdle() { status.replaceChildren('Proto Studio \\u00b7 ', kbd('Alt+A'), ' annotate \\u00b7 ', kbd('Alt+S'), ' sidebar'); }
  function renderStatusAnnotating() { status.replaceChildren(span('mode-active', '\\u25cf Annotation Mode'), ' \\u00b7 Click an element to annotate'); }
  function renderStatusSaved() { status.replaceChildren(span('saved-ok', '\\u2713 Annotation saved')); setTimeout(function(){annotationMode?renderStatusAnnotating():renderStatusIdle();},2000); }

  function toggleAnnotationMode() { annotationMode=!annotationMode; document.body.classList.toggle('proto-overlay-active',annotationMode); annotationMode?renderStatusAnnotating():renderStatusIdle(); if(!annotationMode&&popover){popover.remove();popover=null;} }

  function showPopover(element, x, y) {
    if (popover) { popover.remove(); popover = null; }
    var protoId = element.getAttribute('data-proto-id');
    if (!protoId) return;
    var label = el('div', { className: 'popover-label' }, 'Annotating: ', el('strong', null, protoId));
    var titleInput = el('input', { type: 'text', placeholder: 'Task title...' });
    var select = el('select', null);
    for (var i=0;i<TAGS.length;i++) select.appendChild(el('option', { value: TAGS[i] }, TAGS[i]));
    var textarea = el('textarea', { placeholder: 'Describe your feedback...' });
    var btnSave = el('button', { className: 'btn-primary' }, 'Save');
    var btnCancel = el('button', null, 'Cancel');
    var btnCapture = el('button', null, '\\ud83d\\udcf7 Capture Area');
    var screenshotPreview = el('div', { className: 'screenshot-preview' });
    popover = el('div', { className: 'proto-popover' }, label, titleInput, select, textarea, screenshotPreview, el('div', { className: 'popover-actions' }, btnSave, btnCancel, btnCapture));
    popover.style.left = Math.min(x||0, window.innerWidth - 420) + 'px';
    popover.style.top = Math.min(y||0, window.innerHeight - 300) + 'px';
    root.appendChild(popover);
    titleInput.focus();
    captureBase64 = null;

    btnCapture.addEventListener('click', function () {
      if (popover) popover.style.visibility = 'hidden';
      startAreaCapture(function(b64) {
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
    btnCancel.addEventListener('click', function () { captureBase64 = null; popover.remove(); popover = null; });
  }

  function submitTask(protoId, tag, title, description, screenshotBase64) {
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title, description: description, tag: tag, selector: '[data-proto-id="' + protoId + '"]', url: location.href, priority: 'medium', screenshot: screenshotBase64 || null }),
    }).then(function(r){return r.json();}).then(function(d){if(d.success){renderStatusSaved();fetchTasks();}}).catch(function(err){console.error('[Proto Studio]',err);});
  }

  function markTaskDone(taskId) { fetch(API_URL+'/'+taskId,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'done'})}).then(function(){fetchTasks();}).catch(function(){}); }

  // ── Area screenshot capture (uses background captureVisibleTab) ───────
  var captureBase64 = null;

  function startAreaCapture(onDone) {
    var selBox = document.createElement('div');
    selBox.style.cssText = 'position:fixed;border:2px dashed #3b82f6;background:rgba(59,130,246,0.08);pointer-events:none;z-index:2147483646;';
    var curtain = document.createElement('div');
    curtain.style.cssText = 'position:fixed;inset:0;z-index:2147483645;cursor:crosshair;';
    document.body.appendChild(curtain);
    document.body.appendChild(selBox);
    var startX = 0, startY = 0, dragging = false;
    curtain.addEventListener('mousedown', function(e){dragging=true;startX=e.clientX;startY=e.clientY;selBox.style.left=startX+'px';selBox.style.top=startY+'px';selBox.style.width='0';selBox.style.height='0';});
    curtain.addEventListener('mousemove', function(e){if(!dragging)return;var x=Math.min(e.clientX,startX),y=Math.min(e.clientY,startY),w=Math.abs(e.clientX-startX),h=Math.abs(e.clientY-startY);selBox.style.left=x+'px';selBox.style.top=y+'px';selBox.style.width=w+'px';selBox.style.height=h+'px';});
    curtain.addEventListener('mouseup', function(e){dragging=false;curtain.remove();selBox.remove();var x=Math.min(e.clientX,startX),y=Math.min(e.clientY,startY),w=Math.abs(e.clientX-startX),h=Math.abs(e.clientY-startY);if(w<10||h<10){onDone(null);return;}captureAreaViaBackground(x,y,w,h,onDone);});
    document.addEventListener('keydown', function onEsc(e){if(e.key!=='Escape')return;document.removeEventListener('keydown',onEsc,true);curtain.remove();selBox.remove();onDone(null);},{capture:true});
  }

  function captureAreaViaBackground(x, y, w, h, onDone) {
    if (typeof chrome === 'undefined' || !chrome.runtime) { onDone(null); return; }
    chrome.runtime.sendMessage({ type: 'capture-screenshot' }, function(resp) {
      if (!resp || !resp.dataUrl) { onDone(null); return; }
      var img = new Image();
      img.onload = function() {
        var dpr = window.devicePixelRatio || 1;
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, w, h);
        onDone(canvas.toDataURL('image/png').replace('data:image/png;base64,', ''));
      };
      img.src = resp.dataUrl;
    });
  }

  function removeTask(taskId) { fetch(API_URL+'/'+taskId,{method:'DELETE'}).then(function(){fetchTasks();}).catch(function(){}); }

  var edgeTrigger = el('div', { className: 'proto-edge-trigger' });
  root.appendChild(edgeTrigger);
  edgeTrigger.addEventListener('mouseenter', function () {
    if (!sidebar) createSidebar();
    if (!sidebar.classList.contains('open')) { sidebar.classList.add('open'); fetchTasks(); refreshSidebar(); }
  });

  function createSidebar() {
    sidebar = el('div', { className: 'proto-sidebar' });
    root.appendChild(sidebar);
    sidebar.addEventListener('mouseleave', function () { if (!sidebarPinned && sidebar.classList.contains('open')) sidebar.classList.remove('open'); });
  }

  function toggleSidebar() {
    if (!sidebar) createSidebar();
    var isOpen = sidebar.classList.contains('open');
    if (isOpen) { sidebar.classList.remove('open'); sidebarPinned = false; }
    else { sidebar.classList.add('open'); sidebarPinned = true; fetchTasks(); refreshSidebar(); }
  }

  function refreshSidebar() {
    if (!sidebar) return;
    sidebar.replaceChildren();
    var closeBtn = el('span', { className: 'sidebar-close' }, '\\u2715');
    closeBtn.addEventListener('click', function () { sidebar.classList.remove('open'); sidebarPinned = false; });
    var todoCount = tasks.filter(function(t){return t.status!=='done';}).length;
    sidebar.appendChild(el('h3', null, 'Tasks (' + todoCount + '/' + tasks.length + ')', closeBtn));
    if (tasks.length === 0) { sidebar.appendChild(el('p', { className: 'empty-msg' }, 'No tasks yet.')); return; }
    var sorted = tasks.slice().sort(function(a,b){ var o={'in-progress':0,'todo':1,'done':2}; return (o[a.status]||1)-(o[b.status]||1); });
    for (var i=0;i<sorted.length;i++) {
      var task = sorted[i];
      var badge = el('span', { className: 'tag-badge' }, task.tag); badge.style.background = TAG_COLORS[task.tag] || '#6b7280';
      var statusBadge = el('span', { className: 'status-badge status-' + task.status.replace(' ', '-') }, task.status);
      var header = el('div', { className: 'task-card-header' }, badge, statusBadge);
      var card = el('div', { className: 'task-card' }, header, el('div', { className: 'task-title' }, task.title), el('div', { className: 'task-selector' }, task.selector));
      if (task.description) card.appendChild(el('div', { className: 'task-description' }, task.description.slice(0, 120)));
      if (task.status !== 'done') {
        var doneBtn = el('button', { className: 'done-btn' }, '\\u2713 Done');
        (function(id){doneBtn.addEventListener('click',function(e){e.stopPropagation();markTaskDone(id);});})(task.id);
        var deleteBtn = el('button', { className: 'delete-btn' }, '\\u2715');
        (function(id){deleteBtn.addEventListener('click',function(e){e.stopPropagation();removeTask(id);});})(task.id);
        card.appendChild(el('div', { className: 'task-actions' }, doneBtn, deleteBtn));
      }
      sidebar.appendChild(card);
    }
  }

  function showContextMenu(element, x, y) {
    hideContextMenu();
    var protoId = element.getAttribute('data-proto-id'); if (!protoId) return;
    contextMenu = el('div', { className: 'proto-context-menu' });
    contextMenu.style.left = Math.min(x, window.innerWidth - 220) + 'px';
    contextMenu.style.top = Math.min(y, window.innerHeight - 200) + 'px';
    var items = [{icon:'\\u270f',label:'Add TODO',tag:'TODO'},{icon:'\\u2728',label:'Add FEATURE',tag:'FEATURE'},{icon:'\\ud83d\\udd04',label:'Add VARIANT',tag:'VARIANT'},{icon:'\\u2753',label:'Add QUESTION',tag:'QUESTION'}];
    for (var i=0;i<items.length;i++) {
      var item = items[i];
      var btn = el('button', null, el('span', { className: 'menu-icon' }, item.icon), item.label + ' for "' + protoId + '"');
      (function(tag){btn.addEventListener('click',function(){hideContextMenu();showPopover(element,x,y);setTimeout(function(){if(popover){var sel=popover.querySelector('select');if(sel)sel.value=tag;}},0);});})(item.tag);
      contextMenu.appendChild(btn);
    }
    root.appendChild(contextMenu);
    setTimeout(function(){document.addEventListener('click',hideContextMenu,{once:true});},0);
  }
  function hideContextMenu() { if (contextMenu) { contextMenu.remove(); contextMenu = null; } }

  document.addEventListener('keydown', function (e) {
    if (e.altKey && e.key === 'a') { e.preventDefault(); toggleAnnotationMode(); }
    if (e.altKey && e.key === 's') { e.preventDefault(); toggleSidebar(); }
    if (e.key === 'Escape') {
      if (contextMenu) hideContextMenu();
      else if (popover) { popover.remove(); popover = null; }
      else if (annotationMode) toggleAnnotationMode();
      else if (sidebar && sidebar.classList.contains('open')) { sidebar.classList.remove('open'); sidebarPinned = false; }
    }
  });

  document.addEventListener('contextmenu', function (e) {
    var target = e.target.closest('[data-proto-id]');
    if (!target) return;
    if (e.composedPath().indexOf(host) !== -1) return;
    e.preventDefault();
    showContextMenu(target, e.clientX, e.clientY);
  }, true);

  document.addEventListener('click', function (e) {
    if (!annotationMode) return;
    if (e.composedPath().indexOf(host) !== -1) return;
    var target = e.target.closest('[data-proto-id]');
    if (!target) return;
    e.preventDefault(); e.stopPropagation();
    showPopover(target, e.clientX, e.clientY);
  }, true);

  // Listen for context menu trigger from extension background
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg.type === 'proto-context-menu') {
        // Find element under cursor or show generic UI
        toggleAnnotationMode();
      }
      if (msg.type === 'proto-config-updated' && msg.config) {
        // Config changed — could update port, but needs page reload for WS URL change
      }
    });
  }

}());
  `;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "proto-config-updated") {
    // Reload to pick up new config
    window.location.reload();
  }
});

init();

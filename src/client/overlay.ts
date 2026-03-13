// ─────────────────────────────────────────────────────────────────────────────
// Overlay CSS — lives inside a Shadow DOM, fully isolated from the host page.
// No !important needed; the shadow boundary beats any Tailwind/page styles.
// ─────────────────────────────────────────────────────────────────────────────
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
    color: #111827;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  /* ── Status bar ─────────────────────────────────────────────────── */
  .proto-status {
    position: fixed;
    bottom: 16px;
    right: 16px;
    background: #1e293b;
    color: #f1f5f9;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    pointer-events: auto;
    user-select: none;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
  }

  .proto-status kbd {
    display: inline-block;
    padding: 1px 5px;
    background: #334155;
    border: 1px solid #475569;
    border-radius: 3px;
    font-size: 11px;
    font-family: system-ui, sans-serif;
    color: #cbd5e1;
  }

  .proto-status .mode-active { color: #60a5fa; font-weight: 600; }
  .proto-status .saved-ok    { color: #4ade80; }

  /* ── Annotation popover ─────────────────────────────────────────── */
  .proto-popover {
    position: fixed;
    background: #ffffff;
    color: #111827;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
    padding: 16px;
    min-width: 300px;
    pointer-events: auto;
  }

  .popover-label {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 10px;
  }

  .popover-label strong {
    color: #374151;
    font-weight: 600;
  }

  .proto-popover select {
    display: block;
    width: 100%;
    padding: 6px 8px;
    margin-bottom: 8px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #f9fafb;
    color: #111827;
    font-size: 14px;
    font-family: system-ui, sans-serif;
    cursor: pointer;
    appearance: auto;
    -webkit-appearance: auto;
  }

  .proto-popover select:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 1px;
    border-color: #3b82f6;
  }

  .proto-popover textarea {
    display: block;
    width: 100%;
    min-height: 80px;
    padding: 8px;
    margin-bottom: 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #f9fafb;
    color: #111827;
    font-size: 14px;
    font-family: system-ui, sans-serif;
    line-height: 1.5;
    resize: vertical;
  }

  .proto-popover textarea:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 1px;
    border-color: #3b82f6;
  }

  .proto-popover textarea::placeholder { color: #9ca3af; }

  .popover-actions { display: flex; gap: 8px; }

  .proto-popover button {
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-family: system-ui, sans-serif;
    font-weight: 500;
    line-height: 1.4;
    cursor: pointer;
    border: 1px solid #d1d5db;
    background: #f9fafb;
    color: #374151;
    transition: background 0.1s;
  }

  .proto-popover button:hover        { background: #e5e7eb; }
  .proto-popover button.btn-primary  { background: #3b82f6; color: #ffffff; border-color: #2563eb; }
  .proto-popover button.btn-primary:hover { background: #2563eb; }

  /* ── Sidebar ────────────────────────────────────────────────────── */
  .proto-sidebar {
    position: fixed;
    right: 0;
    top: 0;
    width: 320px;
    height: 100vh;
    background: #ffffff;
    color: #111827;
    border-left: 1px solid #e5e7eb;
    overflow-y: auto;
    padding: 16px;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.12);
    pointer-events: auto;
    transform: translateX(100%);
    transition: transform 0.2s ease;
  }

  .proto-sidebar.open { transform: translateX(0); }

  .proto-sidebar h3 {
    margin: 0 0 16px;
    font-size: 15px;
    font-weight: 600;
    color: #111827;
  }

  .empty-msg { color: #6b7280; font-size: 14px; }

  .annotation-card {
    margin: 8px 0;
    padding: 10px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #f9fafb;
  }

  .tag-badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #ffffff;
    margin-right: 4px;
  }

  .target-id       { font-size: 11px; color: #9ca3af; }
  .annotation-text { margin: 6px 0 0; font-size: 13px; color: #374151; line-height: 1.4; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Tag configuration — embedded into the injected script via JSON.stringify
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

// Minimal host-page CSS — only the hover outline for annotation mode.
// Must stay in the light DOM so it can reach [data-proto-id] elements.
const HOST_PAGE_CSS = `
  .proto-overlay-active [data-proto-id]:hover {
    outline: 2px solid #3b82f6 !important;
    outline-offset: 2px !important;
    cursor: crosshair !important;
  }
`;

export function getOverlayScript(port: number): string {
  return `
(function () {
  'use strict';

  const WS_URL     = 'ws://localhost:${port}';
  const API_URL    = 'http://localhost:${port}/api/annotate';
  const TAGS       = ${JSON.stringify(TAGS)};
  const TAG_COLORS = ${JSON.stringify(TAG_COLORS)};

  // ── Shadow DOM host ──────────────────────────────────────────────────────
  // All overlay UI lives here — 100% isolated from the host page's CSS.
  const host = document.createElement('div');
  host.id = 'proto-studio-root';
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = ${JSON.stringify(OVERLAY_CSS)};
  root.appendChild(styleEl);

  // Hover outline in the light DOM so it can target [data-proto-id] on the page
  const hostStyle = document.createElement('style');
  hostStyle.textContent = ${JSON.stringify(HOST_PAGE_CSS)};
  document.head.appendChild(hostStyle);

  // ── State ────────────────────────────────────────────────────────────────
  let annotationMode = false;
  let sidebar  = null;
  let popover  = null;

  // ── WebSocket for live reload ────────────────────────────────────────────
  function connectWS() {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = function (e) {
      if (JSON.parse(e.data).type === 'reload') location.reload();
    };
    ws.onclose = function () { setTimeout(connectWS, 2000); };
    ws.onerror = function () { ws.close(); };
  }
  connectWS();

  // ── DOM helper ───────────────────────────────────────────────────────────
  // Creates an element with optional props dict and child nodes/strings.
  function el(tag, props) {
    const node = document.createElement(tag);
    if (props) {
      for (const key of Object.keys(props)) {
        if (key === 'className') node.className = props[key];
        else if (key === 'placeholder') node.placeholder = props[key];
        else node.setAttribute(key, props[key]);
      }
    }
    for (let i = 2; i < arguments.length; i++) {
      const child = arguments[i];
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }

  function kbd(text)       { return el('kbd', null, text); }
  function span(cls, text) { return el('span', { className: cls }, text); }

  // ── Status bar ───────────────────────────────────────────────────────────
  const status = el('div', { className: 'proto-status' });
  root.appendChild(status);
  renderStatusIdle();

  function renderStatusIdle() {
    status.replaceChildren('Proto Studio · ', kbd('Alt+A'), ' annotate · ', kbd('Alt+S'), ' sidebar');
  }

  function renderStatusAnnotating() {
    status.replaceChildren(span('mode-active', '\\u25cf Annotation Mode'), ' \\u00b7 Click an element to annotate');
  }

  function renderStatusSaved() {
    status.replaceChildren(span('saved-ok', '\\u2713 Annotation saved'));
    setTimeout(function () {
      annotationMode ? renderStatusAnnotating() : renderStatusIdle();
    }, 2000);
  }

  // ── Annotation mode toggle ───────────────────────────────────────────────
  function toggleAnnotationMode() {
    annotationMode = !annotationMode;
    document.body.classList.toggle('proto-overlay-active', annotationMode);
    annotationMode ? renderStatusAnnotating() : renderStatusIdle();
    if (!annotationMode && popover) { popover.remove(); popover = null; }
  }

  // ── Annotation popover ───────────────────────────────────────────────────
  function showPopover(element) {
    if (popover) { popover.remove(); popover = null; }
    const protoId = element.getAttribute('data-proto-id');
    if (!protoId) return;

    const rect     = element.getBoundingClientRect();
    const label    = el('div', { className: 'popover-label' }, 'Annotating: ', el('strong', null, protoId));
    const select   = el('select', null);
    for (const tag of TAGS) {
      select.appendChild(el('option', { value: tag }, tag));
    }
    const textarea  = el('textarea', { placeholder: 'Describe your feedback...' });
    const btnSave   = el('button', { className: 'btn-primary' }, 'Save');
    const btnCancel = el('button', null, 'Cancel');
    const actions   = el('div', { className: 'popover-actions' }, btnSave, btnCancel);

    popover = el('div', { className: 'proto-popover' }, label, select, textarea, actions);
    popover.style.left = Math.min(rect.left, window.innerWidth - 340) + 'px';
    popover.style.top  = Math.min(rect.bottom + 8, window.innerHeight - 260) + 'px';

    root.appendChild(popover);
    textarea.focus();

    btnSave.addEventListener('click', function () {
      const text = textarea.value.trim();
      if (!text) return;
      submitAnnotation(protoId, select.value, text);
      popover.remove(); popover = null;
    });

    btnCancel.addEventListener('click', function () {
      popover.remove(); popover = null;
    });
  }

  function submitAnnotation(protoId, tag, text) {
    const file = location.pathname.split('/').pop() || 'index.html';
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file, targetSelector: 'data-proto-id="' + protoId + '"', tag, text }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.success) renderStatusSaved(); })
      .catch(function (err) { console.error('[Proto Studio]', err); });
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────
  function toggleSidebar() {
    if (!sidebar) {
      sidebar = el('div', { className: 'proto-sidebar' });
      root.appendChild(sidebar);
    }
    sidebar.classList.toggle('open');
    if (sidebar.classList.contains('open')) refreshSidebar();
  }

  function refreshSidebar() {
    if (!sidebar) return;
    const matches = document.documentElement.innerHTML.match(
      /<!--\\s*@(TODO|FEATURE|VARIANT|KEEP|QUESTION|CONTEXT)\\[([^\\]]+)\\]\\s*([\\s\\S]*?)\\s*-->/g
    ) || [];

    sidebar.replaceChildren(el('h3', null, 'Annotations (' + matches.length + ')'));

    if (matches.length === 0) {
      sidebar.appendChild(el('p', { className: 'empty-msg' }, 'No annotations yet.'));
      return;
    }

    for (const c of matches) {
      const m = c.match(/<!--\\s*@(\\w+)\\[([^\\]]+)\\]\\s*([\\s\\S]*?)\\s*-->/);
      if (!m) continue;
      const tagName  = m[1];
      const targetId = m[2];
      const text     = m[3].trim();
      const color    = TAG_COLORS[tagName] || '#6b7280';

      const badge = el('span', { className: 'tag-badge' }, tagName);
      badge.style.background = color;

      const card = el('div', { className: 'annotation-card' },
        badge,
        el('span', { className: 'target-id' }, targetId),
        el('p',    { className: 'annotation-text' }, text),
      );
      sidebar.appendChild(card);
    }
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.altKey && e.key === 'a') { e.preventDefault(); toggleAnnotationMode(); }
    if (e.altKey && e.key === 's') { e.preventDefault(); toggleSidebar(); }
    if (e.key === 'Escape') {
      if (popover)                                             { popover.remove(); popover = null; }
      else if (annotationMode)                                 { toggleAnnotationMode(); }
      else if (sidebar && sidebar.classList.contains('open')) { sidebar.classList.remove('open'); }
    }
  });

  // ── Click-to-annotate ────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    if (!annotationMode) return;
    // Ignore clicks inside our own shadow host (popover, sidebar, status bar)
    if (e.composedPath().indexOf(host) !== -1) return;
    const target = e.target.closest('[data-proto-id]');
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    showPopover(target);
  }, true);

}());
`;
}

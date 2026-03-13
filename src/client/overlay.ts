export function getOverlayScript(port: number): string {
  return `
(function() {
  'use strict';
  const WS_URL = 'ws://localhost:${port}';
  const API_URL = 'http://localhost:${port}/api/annotate';

  let annotationMode = false;
  let currentHighlight = null;
  let overlay = null;
  let sidebar = null;
  let popover = null;

  const TAGS = ['TODO', 'FEATURE', 'VARIANT', 'KEEP', 'QUESTION', 'CONTEXT'];
  const TAG_COLORS = {
    TODO: '#ef4444', FEATURE: '#3b82f6', VARIANT: '#8b5cf6',
    KEEP: '#22c55e', QUESTION: '#f59e0b', CONTEXT: '#6b7280'
  };

  // WebSocket for live reload
  function connectWS() {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = function(event) {
      const data = JSON.parse(event.data);
      if (data.type === 'reload') location.reload();
    };
    ws.onclose = function() { setTimeout(connectWS, 2000); };
    ws.onerror = function() { ws.close(); };
  }
  connectWS();

  // Styles
  const style = document.createElement('style');
  style.textContent = \`
    .proto-overlay-active [data-proto-id]:hover {
      outline: 2px solid #3b82f6 !important;
      outline-offset: 2px;
      cursor: crosshair !important;
    }
    .proto-badge {
      position: absolute; font-size: 10px; padding: 2px 6px;
      border-radius: 4px; color: white; font-family: system-ui;
      pointer-events: none; z-index: 99998; white-space: nowrap;
    }
    .proto-popover {
      position: fixed; z-index: 99999; background: white;
      border: 1px solid #e5e7eb; border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.15); padding: 16px;
      font-family: system-ui; min-width: 300px;
    }
    .proto-popover select, .proto-popover textarea, .proto-popover button {
      font-family: system-ui; font-size: 14px;
    }
    .proto-popover textarea {
      width: 100%; min-height: 80px; margin: 8px 0; padding: 8px;
      border: 1px solid #d1d5db; border-radius: 4px; resize: vertical;
      box-sizing: border-box;
    }
    .proto-popover select {
      width: 100%; padding: 6px 8px; border: 1px solid #d1d5db;
      border-radius: 4px;
    }
    .proto-popover button {
      padding: 6px 16px; border-radius: 4px; cursor: pointer;
      border: 1px solid #d1d5db; margin-right: 8px;
    }
    .proto-popover .proto-submit {
      background: #3b82f6; color: white; border-color: #3b82f6;
    }
    .proto-sidebar {
      position: fixed; right: 0; top: 0; width: 320px; height: 100vh;
      background: white; border-left: 1px solid #e5e7eb; z-index: 99997;
      overflow-y: auto; font-family: system-ui; padding: 16px;
      box-shadow: -4px 0 15px rgba(0,0,0,0.1);
      transform: translateX(100%); transition: transform 0.2s;
    }
    .proto-sidebar.open { transform: translateX(0); }
    .proto-status {
      position: fixed; bottom: 16px; right: 16px; z-index: 99996;
      background: #1e293b; color: white; padding: 8px 16px;
      border-radius: 8px; font-family: system-ui; font-size: 13px;
      opacity: 0.9;
    }
  \`;
  document.head.appendChild(style);

  // Status indicator
  const status = document.createElement('div');
  status.className = 'proto-status';
  status.innerHTML = 'Proto Studio · <kbd>Alt+A</kbd> annotate · <kbd>Alt+S</kbd> sidebar';
  document.body.appendChild(status);

  // Toggle annotation mode
  function toggleAnnotationMode() {
    annotationMode = !annotationMode;
    document.body.classList.toggle('proto-overlay-active', annotationMode);
    status.innerHTML = annotationMode
      ? '<span style="color:#3b82f6">● Annotation Mode</span> · Click an element to annotate'
      : 'Proto Studio · <kbd>Alt+A</kbd> annotate · <kbd>Alt+S</kbd> sidebar';
    if (!annotationMode && popover) popover.remove();
  }

  // Show annotation popover
  function showPopover(element) {
    if (popover) popover.remove();
    const protoId = element.getAttribute('data-proto-id');
    if (!protoId) return;
    const rect = element.getBoundingClientRect();

    popover = document.createElement('div');
    popover.className = 'proto-popover';
    popover.style.left = Math.min(rect.left, window.innerWidth - 340) + 'px';
    popover.style.top = Math.min(rect.bottom + 8, window.innerHeight - 250) + 'px';
    popover.innerHTML = \`
      <div style="font-size:12px;color:#6b7280;margin-bottom:8px">
        Annotating: <strong>\${protoId}</strong>
      </div>
      <select id="proto-tag">\${TAGS.map(t =>
        '<option value="' + t + '">' + t + '</option>').join('')}</select>
      <textarea id="proto-text" placeholder="Describe your feedback..."></textarea>
      <div>
        <button class="proto-submit" id="proto-save">Save</button>
        <button id="proto-cancel">Cancel</button>
      </div>
    \`;
    document.body.appendChild(popover);

    document.getElementById('proto-text').focus();
    document.getElementById('proto-save').onclick = function() {
      const tag = document.getElementById('proto-tag').value;
      const text = document.getElementById('proto-text').value.trim();
      if (!text) return;
      submitAnnotation(protoId, tag, text);
      popover.remove();
      popover = null;
    };
    document.getElementById('proto-cancel').onclick = function() {
      popover.remove();
      popover = null;
    };
  }

  function submitAnnotation(protoId, tag, text) {
    const file = location.pathname.split('/').pop() || 'index.html';
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: file,
        targetSelector: 'data-proto-id="' + protoId + '"',
        tag: tag,
        text: text,
      }),
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) {
        status.innerHTML = '<span style="color:#22c55e">✓ Annotation saved</span>';
        setTimeout(function() {
          status.innerHTML = annotationMode
            ? '<span style="color:#3b82f6">● Annotation Mode</span> · Click to annotate'
            : 'Proto Studio · <kbd>Alt+A</kbd> annotate';
        }, 2000);
      }
    })
    .catch(function(err) { console.error('Proto Studio:', err); });
  }

  // Sidebar
  function toggleSidebar() {
    if (!sidebar) {
      sidebar = document.createElement('div');
      sidebar.className = 'proto-sidebar';
      document.body.appendChild(sidebar);
    }
    sidebar.classList.toggle('open');
    if (sidebar.classList.contains('open')) refreshSidebar();
  }

  function refreshSidebar() {
    if (!sidebar) return;
    const comments = document.documentElement.innerHTML.match(
      /<!--\\s*@(TODO|FEATURE|VARIANT|KEEP|QUESTION|CONTEXT)\\[([^\\]]+)\\]\\s*([\\s\\S]*?)\\s*-->/g
    ) || [];
    let html = '<h3 style="margin:0 0 16px">Annotations (' + comments.length + ')</h3>';
    if (comments.length === 0) {
      html += '<p style="color:#6b7280;font-size:14px">No annotations yet.</p>';
    }
    for (const c of comments) {
      const m = c.match(/<!--\\s*@(\\w+)\\[([^\\]]+)\\]\\s*([\\s\\S]*?)\\s*-->/);
      if (m) {
        const color = TAG_COLORS[m[1]] || '#6b7280';
        html += '<div style="margin:8px 0;padding:8px;border:1px solid #e5e7eb;border-radius:6px">' +
          '<span style="background:' + color + ';color:white;padding:2px 6px;border-radius:3px;font-size:11px">' +
          m[1] + '</span> ' +
          '<span style="font-size:12px;color:#6b7280">' + m[2] + '</span>' +
          '<p style="margin:4px 0 0;font-size:13px">' + m[3] + '</p></div>';
      }
    }
    sidebar.innerHTML = html;
  }

  // Event listeners
  document.addEventListener('keydown', function(e) {
    if (e.altKey && e.key === 'a') { e.preventDefault(); toggleAnnotationMode(); }
    if (e.altKey && e.key === 's') { e.preventDefault(); toggleSidebar(); }
    if (e.key === 'Escape') {
      if (popover) { popover.remove(); popover = null; }
      if (annotationMode) toggleAnnotationMode();
      if (sidebar && sidebar.classList.contains('open')) sidebar.classList.remove('open');
    }
  });

  document.addEventListener('click', function(e) {
    if (!annotationMode) return;
    const target = e.target.closest('[data-proto-id]');
    if (!target) return;
    if (e.target.closest('.proto-popover, .proto-sidebar, .proto-status')) return;
    e.preventDefault();
    e.stopPropagation();
    showPopover(target);
  }, true);

})();
`;
}

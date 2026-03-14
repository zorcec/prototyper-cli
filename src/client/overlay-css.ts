// ─────────────────────────────────────────────────────────────────────────────
// Overlay CSS — lives inside a Shadow DOM, fully isolated from the host page.
// DARK THEMED — all UI uses slate/gray dark palette for readability.
// ─────────────────────────────────────────────────────────────────────────────
export const OVERLAY_CSS = `
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

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* ── Status bar ─────────────────────────────────────────────────── */
  .proto-status {
    position: fixed;
    bottom: 16px;
    right: 16px;
    background: #0f172a;
    color: #e2e8f0;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    pointer-events: auto;
    user-select: none;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    border: 1px solid #1e293b;
  }

  .proto-status kbd {
    display: inline-block;
    padding: 1px 5px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 3px;
    font-size: 11px;
    font-family: system-ui, sans-serif;
    color: #94a3b8;
  }

  .proto-status .mode-active { color: #60a5fa; font-weight: 600; }
  .proto-status .saved-ok    { color: #4ade80; }

  /* ── Annotation popover ─────────────────────────────────────────── */
  .proto-popover {
    position: fixed;
    background: #1e293b;
    color: #e2e8f0;
    border: 1px solid #334155;
    border-radius: 10px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
    padding: 16px;
    min-width: 320px;
    max-width: 400px;
    pointer-events: auto;
  }

  .popover-label {
    font-size: 12px;
    color: #94a3b8;
    margin-bottom: 10px;
  }

  .popover-label strong {
    color: #e2e8f0;
    font-weight: 600;
  }

  .proto-popover input[type="text"] {
    display: block;
    width: 100%;
    padding: 6px 10px;
    margin-bottom: 8px;
    border: 1px solid #334155;
    border-radius: 6px;
    background: #0f172a;
    color: #e2e8f0;
    font-size: 14px;
    font-family: system-ui, sans-serif;
  }

  .proto-popover input[type="text"]:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 1px;
    border-color: #3b82f6;
  }

  .proto-popover input[type="text"]::placeholder { color: #64748b; }

  .proto-popover select {
    display: block;
    width: 100%;
    padding: 6px 8px;
    margin-bottom: 8px;
    border: 1px solid #334155;
    border-radius: 6px;
    background: #0f172a;
    color: #e2e8f0;
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
    border: 1px solid #334155;
    border-radius: 6px;
    background: #0f172a;
    color: #e2e8f0;
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

  .proto-popover textarea::placeholder { color: #64748b; }

  .popover-actions { display: flex; gap: 8px; margin-top: 4px; }

  .proto-popover button {
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-family: system-ui, sans-serif;
    font-weight: 500;
    line-height: 1.4;
    cursor: pointer;
    border: 1px solid #334155;
    background: #334155;
    color: #e2e8f0;
    transition: background 0.1s;
  }

  .proto-popover button:hover        { background: #475569; }
  .proto-popover button.btn-primary  { background: #3b82f6; color: #ffffff; border-color: #2563eb; }
  .proto-popover button.btn-primary:hover { background: #2563eb; }

  /* ── Edge trigger zone ──────────────────────────────────────────── */
  .proto-edge-trigger {
    position: fixed;
    right: 0;
    top: 0;
    width: 8px;
    height: 100vh;
    pointer-events: auto;
    z-index: 1;
  }

  /* ── Sidebar ────────────────────────────────────────────────────── */
  .proto-sidebar {
    position: fixed;
    right: 0;
    top: 0;
    width: 360px;
    height: 100vh;
    background: #0f172a;
    color: #e2e8f0;
    border-left: 1px solid #1e293b;
    overflow-y: auto;
    padding: 16px;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.4);
    pointer-events: auto;
    transform: translateX(100%);
    transition: transform 0.2s ease;
  }

  .proto-sidebar.open { transform: translateX(0); }

  .proto-sidebar h3 {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 600;
    color: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sidebar-close {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 18px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .sidebar-close:hover { background: #1e293b; color: #e2e8f0; }

  .empty-msg { color: #64748b; font-size: 14px; padding: 8px 0; }

  .task-card {
    margin: 8px 0;
    padding: 12px;
    border: 1px solid #1e293b;
    border-radius: 8px;
    background: #1e293b;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .task-card:hover { border-color: #334155; }

  .task-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .tag-badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #ffffff;
  }

  .status-badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    border: 1px solid;
  }

  .status-todo        { color: #f59e0b; border-color: #f59e0b; background: rgba(245,158,11,0.1); }
  .status-in-progress { color: #3b82f6; border-color: #3b82f6; background: rgba(59,130,246,0.1); }
  .status-done        { color: #22c55e; border-color: #22c55e; background: rgba(34,197,94,0.1); }

  .task-title {
    font-size: 13px;
    font-weight: 500;
    color: #f1f5f9;
    margin: 4px 0 2px;
  }

  .task-selector {
    font-size: 11px;
    color: #64748b;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .task-description {
    margin: 6px 0 0;
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.4;
  }

  .task-card .task-actions {
    display: flex;
    gap: 4px;
    margin-top: 8px;
  }

  .task-card .task-actions button {
    padding: 2px 8px;
    font-size: 11px;
    border-radius: 4px;
    background: #334155;
    border: 1px solid #475569;
    color: #cbd5e1;
    cursor: pointer;
  }

  .task-card .task-actions button:hover { background: #475569; }
  .task-card .task-actions button.done-btn { color: #4ade80; border-color: #4ade80; }
  .task-card .task-actions button.delete-btn { color: #f87171; border-color: #f87171; }
  .task-card .task-actions button.edit-btn { color: #93c5fd; border-color: #93c5fd; }

  /* ── Context menu ────────────────────────────────────────────────────── */
  .proto-context-menu {
    position: fixed;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    min-width: 200px;
    pointer-events: auto;
    padding: 4px;
  }

  .proto-context-menu button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 8px 12px;
    border: none;
    background: none;
    color: #e2e8f0;
    font-size: 13px;
    font-family: system-ui, sans-serif;
    cursor: pointer;
    border-radius: 4px;
  }

  .proto-context-menu button:hover { background: #334155; }

  .proto-context-menu .menu-icon {
    display: inline-block;
    width: 18px;
    text-align: center;
    margin-right: 8px;
  }

  /* ── Screenshot preview in popover ─────────────────────────────── */
  .screenshot-preview img {
    display: block;
    max-width: 100%;
    border-radius: 4px;
    margin-top: 6px;
    margin-bottom: 6px;
    border: 1px solid #334155;
  }

  /* ── Task indicators (badges on annotated elements) ─────────────── */
  .proto-indicators {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 5;
  }

  .proto-task-indicator {
    position: fixed;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #ef4444;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    cursor: pointer;
    border: 2px solid #0f172a;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    transform-origin: center;
    transition: transform 0.15s;
    user-select: none;
    line-height: 1;
  }

  .proto-task-indicator.all-done {
    background: #22c55e;
    font-size: 12px;
  }

  .proto-task-indicator:hover { transform: scale(1.3); }

  /* ── Task indicator tooltip ─────────────────────────────────────── */
  .proto-task-tooltip {
    position: fixed;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    padding: 8px;
    min-width: 240px;
    max-width: 320px;
    max-height: 400px;
    overflow-y: auto;
    pointer-events: auto;
    z-index: 20;
  }

  .proto-task-tooltip .task-card {
    margin: 4px 0;
  }

  .proto-task-tooltip .task-card:first-child {
    margin-top: 0;
  }

  /* ── Tooltip close button (shown when tooltip is pinned) ─────────── */
  .tooltip-close-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    background: none;
    border: none;
    color: #64748b;
    font-size: 14px;
    cursor: pointer;
    padding: 2px 5px;
    border-radius: 3px;
    line-height: 1;
    pointer-events: auto;
  }

  .tooltip-close-btn:hover { background: #334155; color: #e2e8f0; }

  .proto-task-tooltip { position: relative; }

  /* ── Sidebar legend / filter toggles ─────────────────────────────── */
  .sidebar-legend {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid #1e293b;
  }

  .legend-toggle {
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid #334155;
    background: #0f172a;
    color: #64748b;
    transition: all 0.1s;
    pointer-events: auto;
  }

  .legend-toggle.active {
    background: #1e293b;
    color: #e2e8f0;
    border-color: #475569;
  }

  .legend-toggle:hover { background: #1e293b; color: #cbd5e1; }

  /* ── Remove screenshot button ────────────────────────────────────── */
  .remove-screenshot-btn {
    display: block;
    margin-top: 6px;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 11px;
    color: #f87171;
    border: 1px solid #f87171;
    background: rgba(248, 113, 113, 0.1);
    cursor: pointer;
    pointer-events: auto;
  }

  .remove-screenshot-btn:hover { background: rgba(248, 113, 113, 0.2); }
`;

// Host-page CSS for hover outline in annotation mode
export const HOST_PAGE_CSS = `
  .proto-overlay-active [data-proto-id]:hover {
    outline: 2px solid #3b82f6 !important;
    outline-offset: 2px !important;
    cursor: crosshair !important;
  }
`;

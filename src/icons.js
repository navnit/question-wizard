const ICON_PATHS = Object.freeze({
  archive: '<rect width="20" height="5" x="2" y="4" rx="1"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M10 13h4"/>',
  'arrow-down': '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  'arrow-left': '<path d="m12 19-7-7 7-7M19 12H5"/>',
  'arrow-right': '<path d="m12 5 7 7-7 7M5 12h14"/>',
  'arrow-up': '<path d="m5 12 7-7 7 7M12 19V5"/>',
  bold: '<path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z"/>',
  'check-circle': '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="m9 11 3 3L22 4"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  eraser: '<path d="m7 21-4-4a2.8 2.8 0 0 1 0-4l8.6-8.6a2 2 0 0 1 2.8 0l5.2 5.2a2 2 0 0 1 0 2.8L11 21H7zM6.5 9.5l8 8M11 21h10"/>',
  'file-down': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15l3 3 3-3"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8M8 9h2"/>',
  'hard-drive': '<line x1="22" x2="2" y1="12" y2="12"/><path d="m5.5 5-3.1 6.2a1.8 1.8 0 0 0-.2.8v6a2 2 0 0 0 2 2h15.6a2 2 0 0 0 2-2v-6a1.8 1.8 0 0 0-.2-.8L18.5 5a2 2 0 0 0-1.8-1H7.3a2 2 0 0 0-1.8 1z"/><circle cx="18" cy="16" r="1"/><circle cx="14" cy="16" r="1"/>',
  'image-off': '<path d="M3 3l18 18M10.4 6H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 1.9-1.3M21 15V8a2 2 0 0 0-2-2h-5M3 16l4-4 4 4 2-2 5 5"/><circle cx="17.5" cy="9.5" r="1.5"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  italic: '<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>',
  list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><circle cx="3.5" cy="6" r=".5" fill="currentColor"/><circle cx="3.5" cy="12" r=".5" fill="currentColor"/><circle cx="3.5" cy="18" r=".5" fill="currentColor"/>',
  'list-ordered': '<path d="M10 6h11M10 12h11M10 18h11M4 4h1v4M4 10h2l-2 3h2M4 16h1.5a1.5 1.5 0 0 1 0 3H4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h2"/>',
  refresh: '<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/>',
  subscript: '<path d="m4 5 8 8M12 5l-8 8M15 18h4.5a1.5 1.5 0 0 0 0-3H17a1.5 1.5 0 0 0 0-3h3"/>',
  superscript: '<path d="m4 19 8-8M12 19l-8-8M15 7h4.5a1.5 1.5 0 0 0 0-3H17a1.5 1.5 0 0 0 0-3h3"/>',
  'text-cursor-input': '<path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 8h6M12 8v8M9 16h6"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
  'triangle-alert': '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3zM12 9v4M12 17h.01"/>',
  underline: '<path d="M6 3v7a6 6 0 0 0 12 0V3M4 21h16"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
});

export const ICON_NAMES = Object.freeze([
  'archive', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-up',
  'bold', 'check-circle', 'chevron-left', 'chevron-right', 'copy',
  'eraser', 'file-down', 'file-text', 'hard-drive', 'image-off',
  'info', 'italic', 'list', 'list-ordered', 'plus', 'redo',
  'refresh', 'subscript', 'superscript', 'text-cursor-input',
  'trash', 'triangle-alert', 'underline', 'undo', 'x',
]);

const escapeAttribute = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

export function icon(name, { className = '', title = '' } = {}) {
  if (!Object.hasOwn(ICON_PATHS, name)) throw new Error(`Unknown icon: ${name}`);
  const children = ICON_PATHS[name];
  const accessibility = title
    ? `role="img" aria-label="${escapeAttribute(title)}"`
    : 'aria-hidden="true" focusable="false"';
  return `<svg class="icon${className ? ` ${escapeAttribute(className)}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${accessibility}>${children}</svg>`;
}

export function mountIcons(root = document) {
  for (const slot of root.querySelectorAll('[data-icon]')) {
    const name = slot.dataset.icon;
    if (Object.hasOwn(ICON_PATHS, name)) slot.innerHTML = icon(name);
  }
}

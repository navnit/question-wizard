export const columnWidths = table => table.proportions ? [...table.proportions] : table.rows[0].map(() => 1 / table.rows[0].length);
const round = value => Math.round(value * 1e12) / 1e12;
export function resizeColumns(table, index, width) {
  const widths = columnWidths(table), pair = widths[index] + widths[index + 1];
  widths[index] = round(Math.max(0.1, Math.min(pair - 0.1, width)));
  widths[index + 1] = round(pair - widths[index]);
  return widths;
}
const percent = width => Math.round(width * 1000) / 10;
export function columnControls(table) {
  const widths = columnWidths(table);
  if (widths.length < 2) return '';
  let offset = 0;
  return `<div class="table-widths" aria-label="Column widths">${widths.map(width => `<span class="column-width" style="width:${width * 100}%">${percent(width)}%</span>`).join('')}${widths.slice(0, -1).map((width, index) => {
    offset += width;
    return `<button type="button" class="column-divider" data-column="${index}" role="slider" aria-label="Width of column ${index + 1}" aria-orientation="horizontal" aria-valuemin="10" aria-valuemax="${percent(width + widths[index + 1] - 0.1)}" aria-valuenow="${percent(width)}" aria-valuetext="${percent(width)} percent" style="left:${offset * 100}%" title="Drag to resize. Use arrow keys for fine adjustment."><span aria-hidden="true"></span></button>`;
  }).join('')}</div>`;
}
function refreshColumns(block, table) {
  const widths = columnWidths(table);
  block.querySelectorAll('col').forEach((col, index) => col.style.width = `${widths[index] * 100}%`);
  block.querySelectorAll('.column-width').forEach((label, index) => { label.style.width = `${widths[index] * 100}%`; label.textContent = `${percent(widths[index])}%`; });
  let offset = 0;
  block.querySelectorAll('.column-divider').forEach((handle, index) => {
    offset += widths[index]; handle.style.left = `${offset * 100}%`;
    handle.setAttribute('aria-valuenow', percent(widths[index]));
    handle.setAttribute('aria-valuemax', percent(widths[index] + widths[index + 1] - 0.1));
    handle.setAttribute('aria-valuetext', `${percent(widths[index])} percent`);
  });
}
export function mountTableResizing(root, resolveTable, onChange, onFinish) {
  let drag;
  const apply = (block, table, index, width) => {
    const next = resizeColumns(table, index, width);
    if (next.every((value, i) => Math.abs(value - columnWidths(table)[i]) < 1e-10)) return;
    table.proportions = next; refreshColumns(block, table); onChange();
  };
  root.addEventListener('pointerdown', event => {
    const handle = event.target.closest('.column-divider');
    if (!handle || event.button !== 0) return;
    const block = handle.closest('[data-table]'), table = resolveTable(block);
    if (!table) return;
    const index = Number(handle.dataset.column);
    drag = { handle, block, table, index, pointer: event.pointerId, x: event.clientX, width: columnWidths(table)[index], total: block.querySelector('.table-widths').getBoundingClientRect().width };
    handle.setPointerCapture(event.pointerId); handle.focus(); event.preventDefault();
  });
  root.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointer || !drag.handle.isConnected) return;
    apply(drag.block, drag.table, drag.index, drag.width + (event.clientX - drag.x) / drag.total);
  });
  const finish = event => { if (drag && event.pointerId === drag.pointer) { drag = null; onFinish(); } };
  root.addEventListener('pointerup', finish); root.addEventListener('pointercancel', finish); root.addEventListener('lostpointercapture', finish);
  root.addEventListener('keydown', event => {
    const handle = event.target.closest('.column-divider');
    if (!handle || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const block = handle.closest('[data-table]'), table = resolveTable(block);
    if (!table) return;
    event.preventDefault();
    const index = Number(handle.dataset.column), widths = columnWidths(table), step = event.shiftKey ? 0.05 : 0.01;
    const width = event.key === 'Home' ? 0.1 : event.key === 'End' ? widths[index] + widths[index + 1] - 0.1 : widths[index] + (event.key === 'ArrowRight' ? step : -step);
    apply(block, table, index, width);
  });
}

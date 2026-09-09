export function cropPixels(width, height, crop) {
  const { left, top, right, bottom } = crop;
  if (![left, top, right, bottom].every(Number.isFinite) || left < 0 || top < 0 || right > 100 || bottom > 100 || right <= left || bottom <= top) throw new Error('Choose a crop with a positive width and height inside the image.');
  const x = Math.floor(width * left / 100), y = Math.floor(height * top / 100);
  return { x, y, width: Math.max(1, Math.ceil(width * right / 100) - x), height: Math.max(1, Math.ceil(height * bottom / 100) - y) };
}
export function printedSize(width, height, previousWidth) {
  const ratio = height / width;
  if (ratio > 25 || ratio < 1 / 30) throw new Error('This crop is too narrow. Select a wider area.');
  const w = Math.max(20, 10 / ratio, Math.min(previousWidth, 440, 600 / ratio));
  return { width: w, height: w * ratio };
}

export async function editImage(source, previousWidth) {
  const image = new Image();
  image.src = source;
  await image.decode();
  const dialog = document.createElement('dialog');
  dialog.className = 'image-editor';
  dialog.setAttribute('aria-labelledby', 'image-editor-title');
  dialog.innerHTML = `<h2 id="image-editor-title">Crop & rotate</h2><p>Drag across the image to select an area, or adjust the crop edges below. Changes are saved only when you apply them.</p><div class="image-edit-tools"><button type="button" data-edit="left" class="secondary">Rotate left ↶</button><button type="button" data-edit="right" class="secondary">Rotate right ↷</button><button type="button" data-edit="reset" class="secondary">Reset</button></div><div class="crop-stage"><canvas aria-label="Image crop preview. Drag to select a crop area." role="img"></canvas></div><div class="crop-fields">${['left', 'top', 'right', 'bottom'].map(key => `<label class="field">${key[0].toUpperCase() + key.slice(1)} edge (%)<input type="number" min="0" max="100" step="1" data-edge="${key}" /></label>`).join('')}</div><p class="crop-status" role="status" aria-live="polite"></p><div class="dialog-actions"><button type="button" data-edit="cancel" class="secondary">Cancel</button><button type="button" data-edit="apply" class="primary">Apply changes</button></div>`;
  document.body.append(dialog);
  const canvas = dialog.querySelector('canvas'), context = canvas.getContext('2d');
  const status = dialog.querySelector('.crop-status');
  const rotated = document.createElement('canvas');
  let turns = 0, crop, start = null;
  const fullCrop = () => ({ left: 0, top: 0, right: 100, bottom: 100 });
  const render = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(rotated, 0, 0, canvas.width, canvas.height);
    dialog.querySelectorAll('[data-edge]').forEach(input => { if (document.activeElement !== input) input.value = crop[input.dataset.edge]; });
    try {
      const pixels = cropPixels(rotated.width, rotated.height, crop);
      printedSize(pixels.width, pixels.height, previousWidth);
      const x = canvas.width * crop.left / 100, y = canvas.height * crop.top / 100;
      const w = canvas.width * (crop.right - crop.left) / 100, h = canvas.height * (crop.bottom - crop.top) / 100;
      context.fillStyle = '#102b3280';
      context.fillRect(0, 0, canvas.width, y); context.fillRect(0, y + h, canvas.width, canvas.height - y - h);
      context.fillRect(0, y, x, h); context.fillRect(x + w, y, canvas.width - x - w, h);
      context.strokeStyle = '#fff'; context.lineWidth = 2; context.strokeRect(x + 1, y + 1, w - 2, h - 2);
      status.textContent = `Selected area: ${pixels.width} × ${pixels.height} pixels. Rotation: ${turns * 90}°.`;
      dialog.querySelector('[data-edit="apply"]').disabled = false;
    } catch (error) {
      status.textContent = error.message;
      dialog.querySelector('[data-edit="apply"]').disabled = true;
    }
  };
  const rotate = () => {
    rotated.width = turns % 2 ? image.naturalHeight : image.naturalWidth;
    rotated.height = turns % 2 ? image.naturalWidth : image.naturalHeight;
    const ctx = rotated.getContext('2d');
    ctx.translate(rotated.width / 2, rotated.height / 2);
    ctx.rotate(turns * Math.PI / 2);
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    const scale = Math.min(1, 720 / rotated.width, 300 / rotated.height);
    canvas.width = Math.max(1, Math.round(rotated.width * scale));
    canvas.height = Math.max(1, Math.round(rotated.height * scale));
    crop = fullCrop(); render();
  };
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    return { x: Math.round(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))), y: Math.round(Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100))) };
  };
  canvas.addEventListener('pointerdown', event => { start = point(event); canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove', event => {
    if (!start) return;
    const end = point(event);
    if (end.x === start.x || end.y === start.y) return;
    crop = { left: Math.min(start.x, end.x), top: Math.min(start.y, end.y), right: Math.max(start.x, end.x), bottom: Math.max(start.y, end.y) }; render();
  });
  canvas.addEventListener('pointerup', () => { start = null; });
  canvas.addEventListener('pointercancel', () => { start = null; });
  dialog.addEventListener('input', event => {
    const key = event.target.dataset.edge;
    if (key) { crop[key] = event.target.value === '' ? NaN : Number(event.target.value); render(); }
  });
  rotate();
  return new Promise(resolve => {
    let result = null;
    dialog.addEventListener('close', () => { dialog.remove(); rotated.width = rotated.height = 0; resolve(result); }, { once: true });
    dialog.addEventListener('click', event => {
      const action = event.target.closest('[data-edit]')?.dataset.edit;
      if (!action) return;
      if (action === 'cancel') return dialog.close();
      if (action === 'reset') { turns = 0; rotate(); return; }
      if (action === 'left' || action === 'right') {
        // Rotate the selected rectangle with the image so an existing crop is retained.
        const prior = crop;
        turns = (turns + (action === 'right' ? 1 : 3)) % 4;
        rotate();
        crop = action === 'right' ? { left: 100 - prior.bottom, top: prior.left, right: 100 - prior.top, bottom: prior.right } : { left: prior.top, top: 100 - prior.right, right: prior.bottom, bottom: 100 - prior.left };
        render(); return;
      }
      if (action === 'apply') {
        try {
          const box = cropPixels(rotated.width, rotated.height, crop);
          const dimensions = printedSize(box.width, box.height, previousWidth);
          const output = document.createElement('canvas'); output.width = box.width; output.height = box.height;
          output.getContext('2d').drawImage(rotated, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
          const type = source.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png';
          const dataUrl = output.toDataURL(type, 0.95);
          output.width = output.height = 0;
          if (!dataUrl.startsWith(`data:${type};`) || dataUrl.length > 7 * 1024 * 1024) throw new Error('The edited image is too large to save. Crop a smaller area or use a smaller source image.');
          result = { dataUrl, type, ...dimensions }; dialog.close();
        } catch (error) { status.textContent = error.message; }
      }
    });
    dialog.showModal();
  });
}

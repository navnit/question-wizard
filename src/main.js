import { createHelp, shouldShowHelp } from './help.js';
import { editImage } from './image-editor.js';
import { instructionSettings } from './instructions.js';
import './styles.css';
import { createProject, duplicateProject, newQuestion, newPart, id, backupProject, parseProject, dataUrl, imageBytes, prepareDraft } from './project.js';
import { listProjects, saveProject, deleteProject, DraftWriter } from './storage.js';
import { validatePaper } from './paper.js';
import { loadAssets, projectAssets } from './assets.js';
import { exportPdf } from './pdf-export.js';
import { exportDocx } from './docx-export.js';
import { libraryView, outlineView, coverView, questionView, partSummary, imageDimensions } from './views.js';
import { modernizeProject } from './content.js';
import { LatestPreviewQueue } from './live-preview.js';
import { PaperPreview } from './preview.js';
import { mountRichEditors } from './rich-editor.js';
import { mountTableResizing } from './table-columns.js';
import { mountIcons } from './icons.js';

const $ = name => document.getElementById(name);
const help = createHelp({ getScreen: () => !current ? 'library' : selected ? 'question' : 'details' });
function status(element, message, iconName = '') {
  element.replaceChildren();
  if (iconName) {
    const slot = document.createElement('span'); slot.dataset.icon = iconName; slot.setAttribute('aria-hidden', 'true');
    element.append(slot); mountIcons(element);
  }
  element.append(document.createTextNode(message));
}
let projects = [], current = null, selected = null, revision = 0, result = null, generating = false, generation = 0, search = '', imageTarget;
let renderedPreview = null;
let destroyRichEditors = () => {};
const writer = new DraftWriter(saveProject, (state, error) => {
  status($('save-state'), state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved on this device' : 'Not saved', state === 'saving' ? 'refresh' : state === 'saved' ? 'check-circle' : 'triangle-alert');
  $('save-state').classList.toggle('error', state === 'error');
  if (error) notice('Draft saving failed. Download a project backup before closing this tab. ' + (error.message || ''), true);
});
const preview = new PaperPreview($('page-canvas'), (page, count) => {
  $('page-label').textContent = count ? `${page} / ${count}` : '—';
  $('previous').disabled = !count || page === 1 || generating;
  $('next').disabled = !count || page === count || generating;
  // An inline copy keeps the same actual paper visible below a slider on phones.
  for (const canvas of document.querySelectorAll('.inline-live-preview:not([hidden]) .diagram-live')) {
    canvas.width = $('page-canvas').width; canvas.height = $('page-canvas').height;
    if (count) canvas.getContext('2d').drawImage($('page-canvas'), 0, 0);
    canvas.hidden = !count;
  }
});
const liveQueue = new LatestPreviewQueue(generate);
function notice(message, error = false) { $('notice').textContent = message; $('notice').hidden = !message; $('notice').classList.toggle('error', error); }
function exportStatus(message, error = false) {
  $('export-status').textContent = message; $('export-status').classList.toggle('error', error);
  for (const label of document.querySelectorAll('.inline-live-preview p')) {
    label.textContent = error ? message : 'Live paper view · updates as you resize';
    label.classList.toggle('error', error);
  }
}
// Expansion belongs to this editing session, not the saved paper or exports.
const expandedParts = new Map();
function expansionFor(question) {
  const key = `${current.id}:${question.id}`;
  if (!expandedParts.has(key)) expandedParts.set(key, new Set(question.parts.slice(0, 1).map(part => part.id)));
  const expanded = expandedParts.get(key);
  for (const id of expanded) if (!question.parts.some(part => part.id === id)) expanded.delete(id);
  return expanded;
}
function refreshPartCards() {
  const question = current?.paper.questions.find(q => q.id === selected);
  if (!question) return;
  const expanded = expansionFor(question);
  for (const part of question.parts) {
    const card = [...$('editor').querySelectorAll('.part-card')].find(card => card.dataset.part === part.id);
    if (!card) continue;
    const summary = partSummary(part), toggle = card.querySelector('.part-toggle');
    toggle.setAttribute('aria-expanded', String(expanded.has(part.id)));
    card.querySelector('.part-body').hidden = !expanded.has(part.id);
    card.querySelector('.part-prompt').textContent = summary.prompt;
    card.querySelector('.part-prompt').title = summary.prompt;
    card.querySelector('.part-meta').textContent = summary.meta;
  }
}
function refreshOutline() { if (current) $('outline').innerHTML = outlineView(current, selected); }
function renderEditor() {
  destroyRichEditors(); destroyRichEditors = () => {};
  const question = current?.paper.questions.find(q => q.id === selected);
  if (!question) selected = null;
  if (current) $('editor').innerHTML = question ? questionView(current, question, expansionFor(question)) : coverView(current.paper);
  if (question) destroyRichEditors = mountRichEditors($('editor'), current, (path, value) => {
    const [kind, key, field] = path.split('.');
    const target = kind === 'q' ? current.paper.questions.find(q => q.id === key) : current.paper.questions.flatMap(q => q.parts).find(p => p.id === key);
    target[field] = value; changed(false, { typing: true });
  }, error => notice(error.message || error, true));
  refreshOutline();
}
function dirty() {
  revision++; result = null; renderedPreview = null;
  $('pdf-download').disabled = true; $('docx-download').disabled = true;
  $('preview-hint').textContent = 'Updating live preview…';
  $('page-canvas').classList.add('outdated');
  exportStatus('Updating the paper to include your latest changes…');
}
function changed(structural = false, { printable = true, typing = false } = {}) {
  try { current = prepareDraft(current); }
  catch (error) {
    current = modernizeProject(projects.find(p => p.id === current.id));
    renderEditor(); notice(`${error.message} That last change was not applied; your previous draft is intact.`, true);
    return false;
  }
  current.updatedAt = new Date().toISOString();
  const index = projects.findIndex(p => p.id === current.id);
  if (index >= 0) projects[index] = structuredClone(current); else projects.push(structuredClone(current));
  if (printable) dirty();
  writer.enqueue(current);
  if (structural) renderEditor(); else { refreshOutline(); refreshPartCards(); }
  if (printable) { if (typing) liveQueue.schedule(selected); else liveQueue.request(selected); }
  return true;
}
function rememberOpen(key) { try { if (key) sessionStorage.setItem('question-wizard-open', key); else sessionStorage.removeItem('question-wizard-open'); } catch {} }
async function openProject(project) {
  if (!(await writer.flush())) { notice('The current draft could not be saved. Download its backup before switching papers.', true); return; }
  const token = ++generation; liveQueue.cancel(); generating = false; result = null; renderedPreview = null; revision = 0;
  await preview.clear(); if (token !== generation) return;
  current = modernizeProject(project); selected = null;
  $('library').hidden = true; $('workspace').hidden = false;
  status($('save-state'), 'Saved on this device', 'check-circle');
  $('preview-empty').hidden = false; $('generate').disabled = false;
  $('pdf-download').disabled = true; $('docx-download').disabled = true;
  $('preview-hint').textContent = 'Generate your paper when you’re ready.';
  exportStatus(''); notice(''); renderEditor(); rememberOpen(project.id); window.scrollTo(0, 0);
  liveQueue.request(null);
}
async function showLibrary() {
  if (!(await writer.flush())) { notice('Saving failed. Download a project backup before leaving this paper.', true); return; }
  destroyRichEditors(); destroyRichEditors = () => {}; $('editor').replaceChildren();
  const token = ++generation; liveQueue.cancel(); generating = false; current = null; result = null; renderedPreview = null;
  await preview.clear(); if (token !== generation) return; rememberOpen(null);
  $('workspace').hidden = true; $('library').hidden = false; status($('save-state'), '');
  renderLibrary();
}
function renderLibrary() { $('library').innerHTML = libraryView([...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), search); }
async function addProject(project) {
  if (!(await writer.flush())) { notice('Save or back up your current draft first.', true); return; }
  project = prepareDraft(project);
  await saveProject(project); projects.push(project); await openProject(project);
}
function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
const filename = title => (title.replace(/[^a-zA-Z0-9 -]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'question-paper');
async function backup() {
  if (!current) return;
  const snapshot = structuredClone(current);
  const text = backupProject(snapshot, await loadAssets());
  download(new Blob([text], { type: 'application/json' }), `${filename(snapshot.paper.title)}.qw.json`);
  notice('Project backup downloaded, including your questions and diagrams.');
}
function pageForQuestion(plan, paper, questionId) {
  const questionIndex = paper.questions.findIndex(q => q.id === questionId);
  const pageIndex = questionIndex < 0 ? -1 : plan.pages.findIndex(page => page.rows.some(row => row.question === questionIndex + 1));
  return pageIndex < 0 ? 1 : pageIndex + plan.instructionPages.length + 2;
}
async function generate(followQuestion = null) {
  if (!current) return;
  // Selecting another editor only needs a page from the existing PDF, including
  // draft previews whose incomplete content currently prevents downloads.
  if (renderedPreview?.projectId === current.id && renderedPreview.revision === revision && preview.document) {
    const page = pageForQuestion(renderedPreview.plan, current.paper, followQuestion);
    if (page !== preview.page) await preview.show(page);
    return;
  }
  const { errors } = validatePaper(current.paper);
  const snapshot = structuredClone(current), version = revision, token = ++generation;
  generating = true; result = null;
  $('generate').disabled = true; $('pdf-download').disabled = true; $('docx-download').disabled = true;
  $('previous').disabled = true; $('next').disabled = true;
  exportStatus('Updating the paper to include your latest changes…');
  try {
    const assets = await projectAssets(snapshot);
    const pdf = await exportPdf(snapshot.paper, assets, { draft: true });
    if (token !== generation || current?.id !== snapshot.id) return;
    const committed = await preview.load(pdf.bytes, () => token === generation && current?.id === snapshot.id, pageForQuestion(pdf.plan, snapshot.paper, followQuestion));
    if (token !== generation || current?.id !== snapshot.id) return;
    if (!committed) { exportStatus('Preview refresh was interrupted. Update the preview before downloading.', true); return; }
    $('preview-empty').hidden = true; $('page-canvas').classList.remove('outdated');
    $('page-canvas').dataset.revision = String(version);
    if (version !== revision) { $('preview-hint').textContent = 'Updating live preview…'; return; }
    renderedPreview = { projectId: snapshot.id, revision: version, plan: pdf.plan };
    if (errors.length) {
      $('preview-hint').textContent = 'Draft preview — downloads need the items below completed.';
      exportStatus(`Draft preview. ${errors.join(' ')}`);
      return;
    }
    result = { pdf: new Blob([pdf.bytes], { type: 'application/pdf' }), docx: null, snapshot, plan: pdf.plan, assets, title: snapshot.paper.title, revision: version };
    $('preview-hint').textContent = 'The exact PDF you download.';
    exportStatus(`Ready. ${pdf.plan.pageCount} pages, ${snapshot.paper.targetMarks} marks. Created on this device.`);
    $('pdf-download').disabled = false; $('docx-download').disabled = false;
  } catch (error) { if (token === generation) exportStatus(error.message || 'Could not generate this paper.', true); }
  finally {
    if (token === generation) {
      generating = false; $('generate').disabled = false;
      $('previous').disabled = !preview.document || preview.page === 1;
      $('next').disabled = !preview.document || preview.page === preview.document.numPages;
    }
  }
}
function confirmDelete(title, message) {
  return new Promise(resolve => {
    const dialog = $('confirm-dialog');
    $('confirm-title').textContent = title; $('confirm-message').textContent = message;
    dialog.returnValue = 'cancel';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    dialog.showModal();
  });
}
function move(array, index, direction) {
  const next = index + direction;
  if (index >= 0 && next >= 0 && next < array.length) [array[index], array[next]] = [array[next], array[index]];
}
async function action(name, element) {
  if (name === 'help') return help.open();
  const q = current?.paper.questions.find(q => q.id === selected);
  const qi = current?.paper.questions.findIndex(q => q.id === selected);
  const part = q?.parts.find(p => p.id === element.dataset.id), pi = q?.parts.indexOf(part);
  const tableOwner = element.closest('[data-table-owner="question"]') ? q : part;
  const ti = Number(element.closest('[data-table]')?.dataset.table ?? 0), table = tableOwner?.tables?.[ti];
  const ii = Number(element.closest('[data-image]')?.dataset.image ?? 0);
  if (name === 'library') return showLibrary();
  if (name === 'new' || name === 'example') return addProject(createProject(name === 'example'));
  if (name === 'open') return openProject(projects.find(p => p.id === element.dataset.id));
  if (name === 'duplicate-project') return addProject(duplicateProject(projects.find(p => p.id === element.dataset.id)));
  if (name === 'delete-project') {
    const project = projects.find(p => p.id === element.dataset.id);
    if (await confirmDelete('Delete this paper?', `“${project.paper.title}” will be removed from this browser. Download a project backup first if you need to keep it.`)) {
      await deleteProject(project.id); projects = projects.filter(p => p.id !== project.id); renderLibrary(); notice('Paper deleted from this device.');
    }
    return;
  }
  if (name === 'import') { $('import-file').click(); return; }
  if (name === 'backup') return backup();
  if (name === 'generate') { renderedPreview = null; return liveQueue.request(selected); }
  if (name === 'pdf' || name === 'docx') {
    const ready = result;
    if (!ready || ready.revision !== revision) return;
    if (name === 'docx' && !ready.docx) {
      $('docx-download').disabled = true;
      try { ready.docx = await exportDocx(ready.snapshot.paper, ready.plan, ready.assets); }
      finally { if (result === ready) $('docx-download').disabled = false; }
    }
    if (result === ready && ready.revision === revision) download(ready[name], `${filename(ready.title)}.${name}`);
    return;
  }
  if (!current) return;
  if (name === 'part-warning') {
    const question = current.paper.questions.find(q => q.id === element.dataset.question);
    const target = question?.parts.find(p => p.id === element.dataset.id);
    if (!target) return;
    selected = question.id; expansionFor(question).add(target.id); renderEditor();
    const card = [...$('editor').querySelectorAll('.part-card')].find(card => card.dataset.part === target.id);
    const field = element.dataset.field === 'options' ? card.querySelector('.choice-editor input') : card.querySelector('.ProseMirror');
    (field || card.querySelector('.part-toggle')).focus();
    card.scrollIntoView({ block: 'nearest' }); liveQueue.request(selected); return;
  }
  if (name === 'cover') { selected = null; renderEditor(); liveQueue.request(null); return; }
  if (name === 'question') { selected = element.dataset.id; renderEditor(); liveQueue.request(selected); return; }
  if (name === 'first-question') {
    if (!current.paper.questions.length) return action('add-question', element);
    selected = current.paper.questions[0].id; renderEditor(); liveQueue.request(selected); return;
  }
  if (name === 'use-total') {
    const total = validatePaper(current.paper).total;
    if (total < 1 || total > 1000) return;
    current.paper.targetMarks = total; changed(true); return;
  }
  if (name === 'add-question') {
    if (current.paper.questions.length >= 100) return;
    const next = newQuestion(); next.images = []; current.paper.questions.push(next); selected = next.id; changed(true); return;
  }
  if (!q) return;
  if (name === 'toggle-part' || name === 'expand-parts' || name === 'collapse-parts') {
    const expanded = expansionFor(q);
    if (name === 'toggle-part' && part) {
      if (expanded.has(part.id)) expanded.delete(part.id); else expanded.add(part.id);
    } else if (name === 'expand-parts') q.parts.forEach(part => expanded.add(part.id));
    else if (name === 'collapse-parts') expanded.clear();
    refreshPartCards(); return;
  }
  if (name === 'q-up' || name === 'q-down') move(current.paper.questions, qi, name === 'q-up' ? -1 : 1);
  else if (name === 'duplicate-question') {
    if (current.paper.questions.length >= 100) return;
    const copy = structuredClone(q); copy.id = id(); copy.title = `${copy.title.slice(0, 90)} (copy)`; copy.parts.forEach(p => p.id = id());
    current.paper.questions.splice(qi + 1, 0, copy); selected = copy.id;
  } else if (name === 'delete-question') {
    if (!(await confirmDelete('Delete this question?', 'Its subquestions and answer areas will also be removed.'))) return;
    current.paper.questions.splice(qi, 1); selected = current.paper.questions[Math.max(0, qi - 1)]?.id || null;
  } else if (name === 'image') { imageTarget = { project: current.id, question: q.id, replace: element.dataset.replace === undefined ? null : Number(element.dataset.replace) }; $('image-file').click(); return; }
  else if (name === 'edit-image') {
    const targetProject = current.id, diagram = q.images[ii];
    const original = current.images[diagram.name];
    try {
      const edited = await editImage(original?.dataUrl || `${import.meta.env.BASE_URL}assets/skeleton.png`, diagram.width);
      if (!edited || current?.id !== targetProject || q.images[ii] !== diagram) return;
      const name = `img-${id()}`;
      current.images[name] = { name: original?.name || 'Edited diagram.png', type: edited.type, dataUrl: edited.dataUrl };
      q.images[ii] = { name, width: edited.width, height: edited.height };
      if (changed(true)) notice('Diagram updated. The preview and exports use your edited image.');
    } catch (error) { notice(error.message || 'This diagram could not be edited.', true); }
    return;
  }
  else if (name === 'remove-image') q.images.splice(ii, 1);
  else if (name === 'image-up' || name === 'image-down') move(q.images, ii, name === 'image-up' ? -1 : 1);
  else if (name === 'add-part') { if (q.parts.length >= 26) return; const next = newPart(); q.parts.push(next); expansionFor(q).add(next.id); }
  else if (name === 'add-table') { tableOwner.tables ||= []; if (tableOwner.tables.length >= 12) return; tableOwner.tables.push({ rows: [['', ''], ['', ''], ['', '']], header: true }); if (part === tableOwner) part.lines = 0; }
  else if (name === 'remove-table') { if (!(await confirmDelete('Remove this table?', 'Its cells and contents will be removed.'))) return; tableOwner.tables.splice(ti, 1); }
  else if (name === 'table-up' || name === 'table-down') move(tableOwner.tables, ti, name === 'table-up' ? -1 : 1);
  else if (name === 'table-equal') delete table.proportions;
  else if (name === 'table-row') { if (table.rows.length >= 12) return; table.rows.push(table.rows[0].map(() => '')); }
  else if (name === 'table-column') { if (table.rows[0].length >= 5) return; table.rows.forEach(row => row.push('')); delete table.proportions; }
  else if (name === 'table-remove-row') {
    if (table.rows.length <= 1 || !(await confirmDelete('Remove the last row?', 'Any text in that row will be removed.'))) return;
    table.rows.pop();
  } else if (name === 'table-remove-column') {
    if (table.rows[0].length <= 1 || !(await confirmDelete('Remove the last column?', 'Any text in that column will be removed.'))) return;
    table.rows.forEach(row => row.pop()); delete table.proportions;
  }
  else if (!part) return;
  else if (name === 'option-add') { part.options ||= []; if (part.options.length >= 6) return; part.options.push(''); }
  else if (name === 'option-remove') { if (part.options.length <= 2) return; part.options.splice(Number(element.dataset.option), 1); }
  else if (name === 'option-up' || name === 'option-down') move(part.options, Number(element.dataset.option), name === 'option-up' ? -1 : 1);
  else if (name === 'part-up' || name === 'part-down') move(q.parts, pi, name === 'part-up' ? -1 : 1);
  else if (name === 'delete-part') {
    if (q.parts.length <= 1 || !(await confirmDelete('Delete this subquestion?', 'Its prompt, marks, word bank and table will be removed.'))) return;
    q.parts.splice(pi, 1);
  } else if (name === 'add-bank') part.bank = [];
  else if (name === 'remove-bank') { if (!(await confirmDelete('Remove this word bank?', 'The words will be removed from this subquestion.'))) return; delete part.bank; }
  else return;
  if (changed(true) && name === 'add-part') {
    const card = $('editor').querySelector('.part-card:last-child');
    card.querySelector('.ProseMirror').focus(); card.scrollIntoView({ block: 'nearest' });
  }
}
document.addEventListener('click', event => {
  const element = event.target.closest('[data-action]');
  if (element && !element.disabled) action(element.dataset.action, element).catch(error => notice(error.message || 'The action could not be completed.', true));
});
mountTableResizing($('editor'), block => {
  const question = current?.paper.questions.find(q => q.id === selected);
  const owner = block.dataset.tableOwner === 'question' ? question : question?.parts.find(part => part.id === block.dataset.id);
  return owner?.tables?.[Number(block.dataset.table)];
}, () => changed(false, { typing: true }), () => liveQueue.request(selected));
document.addEventListener('input', event => {
  const element = event.target;
  if (element.id === 'search') { search = element.value; renderLibrary(); $('search').focus(); return; }
  if (!current || !element.dataset.path) return;
  const [kind, key, field, ri, ci, di] = element.dataset.path.split('.');
  let value = element.type === 'checkbox' ? element.checked : element.type === 'number' || element.type === 'range' ? Number(element.value) : element.value;
  if (element.type === 'number') {
    value = element.value === '' ? 0 : Math.max(Number(element.min || 0), Math.min(Number(element.max || 1000), Math.trunc(value || 0)));
    if (element.value !== '' && Number(element.value) !== value) element.value = String(value);
  }
  if (kind === 'instruction') {
    current.paper.instructions = { ...instructionSettings(current.paper), [key]: value };
    changed(false, { typing: element.matches('textarea, input:not([type=checkbox]):not([type=range])') });
    return;
  }
  if (kind === 'paper') {
    if (key === 'template') {
      current.paper.template = value;
      if (changed(true)) $('editor').querySelector(`[name="paper-template"][value="${value}"]`)?.focus();
      return;
    }
    if (key === 'paper') value = Number(value);
    current.paper[key] = value;
    if (key === 'kind' && /^Term \d+ (Assessment|Revision)$/.test(current.paper.title)) {
      current.paper.title = current.paper.title.replace(/Assessment|Revision/, value === 'RP' ? 'Revision' : 'Assessment');
      const title = $('editor').querySelector('[data-path="paper.title"]'); if (title) title.value = current.paper.title;
    }
  } else if (kind === 'q') {
    const question = current.paper.questions.find(q => q.id === key);
    if (field === 'images') {
      const image = question.images[Number(ri)], ratio = image.height / image.width;
      image.width = value; image.height = value * ratio;
      element.closest('.diagram-card').querySelector('output').textContent = imageDimensions(image, question, current.paper.template);
      document.querySelectorAll('.inline-live-preview').forEach(view => view.hidden = true);
      element.closest('.diagram-card').querySelector('.inline-live-preview').hidden = false;
    }
    else if (field === 'imageLayout') {
      question.imageLayout = value;
      if (changed(true)) {
        $('editor').querySelector('[data-path$=".imageLayout"]').focus();
        $('editor').querySelector('.arrangement-preview').hidden = false;
      }
      return;
    } else if (field === 'cell') question.tables[Number(ri)].rows[Number(ci)][Number(di)] = value;
    else if (field === 'table') question.tables[Number(ri)].header = value;
    else question[field] = value;
  } else if (kind === 'p') {
    const part = current.paper.questions.flatMap(q => q.parts).find(p => p.id === key);
    if (field === 'responseType') {
      part.responseType = value;
      if (value === 'multiple-choice' && part.options === undefined) part.options = ['', '', '', ''];
      if (changed(true)) $('editor').querySelector(`[data-path="p.${key}.responseType"]`).focus();
      return;
    }
    if (field === 'options') part.options[Number(ri)] = value;
    else if (field === 'bank') part.bank = value.split('\n').map(s => s.trim()).filter(Boolean);
    else if (field === 'cell') part.tables[Number(ri)].rows[Number(ci)][Number(di)] = value;
    else if (field === 'table') part.tables[Number(ri)].header = value;
    else part[field] = value;
  }
  changed(false, { printable: !(kind === 'q' && field === 'title'), typing: element.matches('textarea, input:not([type=checkbox]):not([type=range])') });
});
$('image-file').addEventListener('change', async event => {
  const file = event.target.files[0], target = imageTarget; event.target.value = '';
  if (!file) return;
  try {
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Choose a PNG or JPEG image of 5 MB or less.');
    const bitmap = await createImageBitmap(file);
    const ratio = bitmap.height / bitmap.width; bitmap.close();
    if (ratio > 25 || ratio < 1 / 30) throw new Error('This image is unusually tall or wide. Use a diagram with a less extreme shape.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (current?.id !== target.project) return;
    const question = current.paper.questions.find(q => q.id === target.question); if (!question) return;
    if (target.replace === null && question.images.length >= 12) throw new Error('A question can have up to 12 diagrams.');
    if (target.replace !== null && !question.images[target.replace]) return;
    const name = `img-${id()}`, width = Math.max(20, 10 / ratio, Math.min(160, 180 / ratio));
    current.images[name] = { name: file.name.slice(0, 200), type: file.type, dataUrl: dataUrl(bytes, file.type) };
    const diagram = { name, width, height: width * ratio };
    if (target.replace === null) question.images.push(diagram); else question.images[target.replace] = diagram;
    if (changed(true)) notice('Diagram attached and included in project backups.');
  } catch (error) { notice(error.message || 'The image could not be read.', true); }
});
$('import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  try {
    if (file.size > 40 * 1024 * 1024) throw new Error('This project is too large. The limit is 40 MB.');
    const project = parseProject(await file.text());
    for (const image of Object.values(project.images)) {
      const bitmap = await createImageBitmap(new Blob([imageBytes(image.dataUrl)], { type: image.type })); bitmap.close();
    }
    await addProject(project); notice('Backup opened as a separate draft. Your existing papers are unchanged.');
  } catch (error) { notice(error.message || 'The backup contains an unreadable image. Your current papers are unchanged.', true); }
});
$('previous').addEventListener('click', () => preview.show(preview.page - 1).catch(error => exportStatus(error.message, true)));
$('next').addEventListener('click', () => preview.show(preview.page + 1).catch(error => exportStatus(error.message, true)));
addEventListener('beforeunload', event => { if (writer.busy || writer.failed) { event.preventDefault(); event.returnValue = ''; } });

async function initialize() {
  mountIcons(document);
  $('library').textContent = 'Opening your papers…';
  try {
    projects = await listProjects();
    // First run includes an editable example. Never recreate it after deletion.
    let initialized = false;
    try { initialized = localStorage.getItem('question-wizard-initialized') === 'yes'; } catch {}
    if (!projects.length && !initialized) { const example = createProject(true); await saveProject(example); projects.push(example); }
    try { localStorage.setItem('question-wizard-initialized', 'yes'); } catch {}
    let last; try { last = sessionStorage.getItem('question-wizard-open'); } catch {}
    const project = projects.find(p => p.id === last);
    if (project) await openProject(project); else renderLibrary();
  } catch (error) { renderLibrary(); notice('Local draft storage is unavailable in this browser. Enable site storage and reload. ' + error.message, true); }
}
initialize().then(() => { if (shouldShowHelp()) help.open({ replay: true }); });
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).then(async () => {
    await navigator.serviceWorker.ready; status($('connection'), 'Saved for offline use', 'hard-drive');
  }).catch(() => { status($('connection'), 'Reconnect to finish offline setup', 'triangle-alert'); });
} else status($('connection'), 'Local development', 'hard-drive');

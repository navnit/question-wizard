import { instructionSettings, COMMON_RULES } from './instructions.js';
import { validatePaper } from './paper.js';
import { questionImages, partTables, responseType } from './content.js';
import { printedDiagram, diagramWidthLimit } from './layout.js';
import { icon } from './icons.js';
import { plainText } from './rich-text.js';
import { PAPER_TEMPLATES } from './templates.js';
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const button = (action, label, other = '', iconName = '') => `<button type="button" data-action="${action}" ${other}>${iconName ? icon(iconName) : ''}<span>${label}</span></button>`;
const iconButton = (action, iconName, ariaLabel, other = '') => `<button type="button" class="icon-button" data-action="${action}" aria-label="${escape(ariaLabel)}" title="${escape(ariaLabel)}" ${other}>${icon(iconName)}</button>`;
function field(label, value, path, { type = 'text', max = 100, hint = '', min = 0 } = {}) {
  return `<label class="field">${label}<input data-path="${path}" type="${type}" value="${escape(value)}" ${type === 'number' ? `min="${min}" max="${max}" step="1"` : `maxlength="${max}"`} />${hint ? `<small>${hint}</small>` : ''}</label>`;
}
function area(label, value, path, max = 8000, hint = '') {
  return `<label class="field">${label}<textarea data-path="${path}" maxlength="${max}" rows="3">${escape(value)}</textarea>${hint ? `<small>${hint}</small>` : ''}</label>`;
}
function richField(label, path, allowBlank = false, hint = '') {
  const errorId = `rich-error-${path.replaceAll('.', '-')}`;
  return `<div class="field rich-field" data-rich-path="${path}" data-label="${escape(label)}" data-allow-blank="${allowBlank}"><span>${label}</span><div class="rich-toolbar" role="group" aria-label="${escape(label)} formatting"></div><div class="rich-surface"></div>${hint ? `<small>${hint}</small>` : ''}<small class="rich-error error" id="${errorId}" role="status" aria-live="polite"></small></div>`;
}
function select(label, value, path, choices) {
  return `<label class="field">${label}<select data-path="${path}">${choices.map(([key, label]) => `<option value="${key}" ${String(value) === String(key) ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`;
}
function templatePicker(selected) {
  return `<fieldset class="template-picker"><legend>Choose a template</legend><p>You can switch at any time. Your content stays unchanged.</p><div class="template-options">${PAPER_TEMPLATES.map(template => `<label class="template-option"><input class="sr-only" type="radio" name="paper-template" data-path="paper.template" value="${template.id}" ${selected === template.id ? 'checked' : ''} /><span class="template-miniature ${template.mode}" aria-hidden="true"><i></i><b></b></span><span><strong>${template.label}</strong>${template.id === 'classic' ? '<small>Default</small>' : ''}</span></label>`).join('')}</div><small>The selected template is saved with this paper and its project backup.</small></fieldset>`;
}
export function libraryView(projects, query = '') {
  const visible = projects.filter(p => `${p.paper.title} ${p.paper.subject}`.toLowerCase().includes(query.toLowerCase()));
  return `<div class="library-heading"><div><p class="eyebrow">A LITTLE LESS FORMATTING. A LOT MORE TEACHING.</p><h1>Your question papers.</h1><p class="muted">Saved on this device. Ready whenever you are.</p></div><div class="library-actions">${button('import', 'Open project backup', 'class="secondary"')}${button('new', 'Create paper', 'class="primary"', 'plus')}</div></div>
    <div class="library-tools"><label class="search"><span class="sr-only">Find a paper</span><input id="search" type="search" placeholder="Find a paper…" value="${escape(query)}" /></label><span>${projects.length} ${projects.length === 1 ? 'paper' : 'papers'} on this device</span></div>
    <div class="paper-grid">${visible.map(project => {
      const p = project.paper, { total } = validatePaper(p);
      return `<article class="paper-card"><button class="card-open" data-action="open" data-id="${escape(project.id)}"><div class="paper-thumbnail" aria-hidden="true"><div class="thumb-logos"><span>RAKS</span><span>QUESTION PAPER</span></div><div class="thumb-title">${escape(p.title)}</div><div class="thumb-subject">${escape(p.subject)}</div><div class="thumb-rule"></div><div class="thumb-lines"></div><div class="thumb-table"></div></div><div class="card-meta"><span class="tag">${p.kind === 'RP' ? 'Revision' : 'Assessment'}${p.sample ? ' · Example' : ''}</span><h2>${escape(p.title || 'Untitled paper')}</h2><p>${escape(p.subject || 'No subject')} · ${escape(p.level)} · Paper ${p.paper}</p><div class="card-details"><span>${p.questions.length} questions · ${total} marks</span><span>${new Date(project.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span></div></div></button><div class="card-actions">${button('duplicate-project', 'Make a copy', `class="text-button" data-id="${escape(project.id)}"`, 'copy')}${button('delete-project', 'Delete', `class="text-button delete-text" data-id="${escape(project.id)}"`, 'trash')}</div></article>`;
    }).join('')}${!visible.length ? `<div class="empty-library"><h2>${query ? 'No papers found.' : 'A fresh start.'}</h2><p>${query ? 'Try a different title or subject.' : 'Create a paper, or open a project backup to continue.'}</p></div>` : ''}</div>
    <div class="library-footer">${icon('hard-drive')}<p>Your papers stay in this browser on this device. Download project backups to keep another copy or move them to a different computer.</p>${button('example', 'Add a sample paper', 'class="text-button"', 'plus')}</div>`;
}
export function outlineView(project, selected) {
  const { paper } = project; const { total, errors } = validatePaper(paper);
  return `<p class="eyebrow">PAPER OUTLINE</p><button class="outline-item cover-item ${selected === null ? 'selected' : ''}" data-action="cover"><span class="outline-number">${icon('file-text')}</span><span>Paper details<small>Cover & instructions</small></span></button><div class="outline-questions">${paper.questions.map((q, i) => `<button class="outline-item ${selected === q.id ? 'selected' : ''}" data-action="question" data-id="${q.id}"><span class="outline-number">${i + 1}</span><span>${escape(q.title || `Question ${i + 1}`)}<small>${q.parts.length} parts · ${q.parts.reduce((s, p) => s + p.marks, 0)} marks</small></span></button>`).join('')}</div>${button('add-question', 'Add question', `class="add-question" ${paper.questions.length >= 100 ? 'disabled' : ''}`, 'plus')}
    <div class="marks-summary"><span class="eyebrow">TOTAL MARKS</span><strong class="${total === paper.targetMarks ? 'balanced' : ''}">${total}<span> / ${paper.targetMarks}</span></strong><p>${total === paper.targetMarks ? 'Marks are balanced.' : `${Math.abs(paper.targetMarks - total)} marks ${total < paper.targetMarks ? 'to add' : 'over the target'}.`}</p>${total > 0 && total <= 1000 && total !== paper.targetMarks ? button('use-total', `Set maximum to ${total}`, 'class="text-button"') : ''}</div>
    <details class="validation"><summary>${errors.length ? `${errors.length} ${errors.length === 1 ? 'item' : 'items'} to finish` : 'Ready for preview'}</summary>${errors.length ? `<ul>${errors.map(e => {
      const match = /^Question (\d+)\(([a-z])\)/.exec(e), question = match && paper.questions[Number(match[1]) - 1], part = question?.parts[match[2].charCodeAt(0) - 97];
      return `<li>${part ? button('part-warning', escape(e), `class="text-button validation-link" data-question="${question.id}" data-id="${part.id}" data-field="${e.includes('options') ? 'options' : 'text'}"`) : escape(e)}</li>`;
    }).join('')}</ul>` : '<p>Your content and marks are ready.</p>'}</details>`;
}
function instructionsEditor(paper) {
  const settings = instructionSettings(paper);
  return `<div class="form-card"><h2>Exam instructions</h2><p class="muted">Choose the rules printed on the cover of this paper.</p>
    <div class="field-row">${select('Writing tools', settings.writing, 'instruction.writing', [['none', 'No instruction'], ['pencil', 'HB pencil'], ['pen', 'Blue or black pen'], ['blue', 'Blue pen'], ['black', 'Black pen']])}${select('Calculators', settings.calculator, 'instruction.calculator', [['none', 'No instruction'], ['allowed', 'Allowed'], ['prohibited', 'Not allowed'], ['scientific', 'Non-programmable scientific only']])}</div>
    ${Object.entries(COMMON_RULES).map(([key, text]) => `<label class="checkbox"><input type="checkbox" data-path="instruction.${key}" ${settings[key] ? 'checked' : ''} /> ${escape(text)}</label>`).join('')}
    ${area('Additional instructions', settings.custom, 'instruction.custom', 1200, 'Write one instruction per line. Longer lists continue on an additional page.')}</div>`;
}
export function coverView(p) {
  return `<div class="section-heading"><p class="eyebrow">START WITH THE BASICS</p><h1>Paper details.</h1><p class="muted">The school template takes care of the layout.</p></div><div class="form-card">
    ${field('Paper title', p.title, 'paper.title', { max: 45 })}
    <div class="field-row">${field('Subject', p.subject, 'paper.subject', { max: 30 })}${field('Class / CA', p.level, 'paper.level', { max: 12 })}</div>
    <div class="field-row">${select('Category', p.kind, 'paper.kind', [['QP', 'Assessment'], ['RP', 'Revision']])}${select('Paper number', p.paper, 'paper.paper', [[1, 'Paper 1'], [2, 'Paper 2']])}</div>
    <div class="field-row">${field('Academic year', p.year, 'paper.year', { max: 7, hint: 'June–May. Filled automatically for new papers; editable.' })}${field('Term code', p.term, 'paper.term', { max: 10, hint: 'For example, TA-1' })}</div>
    ${field('Year on date line', p.dateYear ?? p.year.slice(0, 4), 'paper.dateYear', { max: 4, hint: 'Four-digit year printed beside DATE. Independent of the academic year.' })}
    <div class="field-row">${field('Duration', p.duration, 'paper.duration', { max: 25 })}${field('Maximum marks', p.targetMarks, 'paper.targetMarks', { type: 'number', min: 1, max: 1000 })}</div>
    <label class="checkbox"><input type="checkbox" data-path="paper.sample" ${p.sample ? 'checked' : ''} /> Print a “Sample paper” label</label></div>
    ${instructionsEditor(p)}
    ${templatePicker(p.template)}
    ${button('first-question', 'Start writing questions', 'class="primary next-step"', 'arrow-right')}`;
}
export function questionView(project, question, expanded = new Set(question.parts.slice(0, 1).map(part => part.id))) {
  const index = project.paper.questions.findIndex(q => q.id === question.id);
  const prefix = `q.${question.id}`;
  return `<div class="question-heading"><div><p class="eyebrow">WRITE THE CONTENT. WE’LL SET THE PAGE.</p><h1>Question ${index + 1}.</h1></div><div class="question-actions">${iconButton('q-up', 'arrow-up', 'Move question up', index === 0 ? 'disabled' : '')}${iconButton('q-down', 'arrow-down', 'Move question down', index === project.paper.questions.length - 1 ? 'disabled' : '')}${button('duplicate-question', 'Copy', `aria-label="Duplicate question" ${project.paper.questions.length >= 100 ? 'disabled' : ''}`, 'copy')}${button('delete-question', 'Delete', 'class="delete-text"', 'trash')}</div></div>
    <div class="form-card">${field('Topic', question.title, `${prefix}.title`, { max: 100, hint: 'For your outline only; this name is not printed.' })}${richField('Question', `${prefix}.context`, false, 'Printed above the first subquestion.')}
      <div class="image-area">${questionImages(question).length >= 2 ? `${select('Image arrangement', question.imageLayout || 'vertical', `${prefix}.imageLayout`, [['vertical', 'Vertical — stacked'], ['horizontal', 'Horizontal — two per row']])}<p class="arrangement-hint">${question.imageLayout === 'horizontal' ? 'Read left to right, then down. Images are top-aligned and fitted to half the paper width without stretching.' : 'Images are centered, one below another.'}</p><div class="inline-live-preview arrangement-preview" hidden><p>Live paper view</p><canvas class="diagram-live" role="img" aria-label="Live paper image arrangement" hidden></canvas></div>` : ''}${questionImages(question).map((img, i) => diagramView(project, question, img, i, project.paper.template)).join('')}${button('image', 'Attach a diagram', `class="upload-area" ${questionImages(question).length >= 12 ? 'disabled' : ''}`, 'image')}<small>Up to 12 diagrams per question. PNG or JPEG, up to 5 MB each. Drag a size slider to see the printed layout.</small></div>
      ${(question.tables || []).map((table, i) => tableView(question, table, i, true)).join('')}
      ${button('add-table', 'Add table', `class="secondary" data-table-owner="question" ${(question.tables || []).length >= 12 ? 'disabled' : ''}`, 'plus')}<p class="response-hint">Data tables print after diagrams and before subquestions.</p></div>
    <div class="parts-heading"><h2>Subquestions <span>${question.parts.length}</span></h2><div>${button('expand-parts', 'Expand all', 'class="text-button"')}${button('collapse-parts', 'Collapse all', 'class="text-button"')}</div></div>
    <div class="parts">${question.parts.map((part, pi) => partView(question, part, pi, expanded.has(part.id))).join('')}</div>
    ${button('add-part', 'Add subquestion', `class="secondary add-part" ${question.parts.length >= 26 ? 'disabled' : ''}`, 'plus')}`;
}
export const imageDimensions = (image, question = {}, templateId) => {
  const printed = printedDiagram(image, question, templateId);
  return `${(printed.width * 2.54 / 72).toFixed(1)} × ${(printed.height * 2.54 / 72).toFixed(1)} cm on paper`;
};
function diagramView(project, question, img, index, templateId) {
  const source = project.images[img.name]?.dataUrl || `${import.meta.env.BASE_URL}assets/skeleton.png`;
  const ratio = img.height / img.width;
  const minimum = Math.ceil(Math.max(20, 10 / ratio));
  const maximum = Math.max(minimum, Math.floor(Math.min(diagramWidthLimit(question, templateId), 600 / ratio)));
  return `<section class="diagram-card" data-image="${index}" aria-label="Diagram ${index + 1}"><div class="image-heading"><strong>Diagram ${index + 1}</strong><div>${iconButton('image-up', 'arrow-up', `Move diagram ${index + 1} up`, index === 0 ? 'disabled' : '')}${iconButton('image-down', 'arrow-down', `Move diagram ${index + 1} down`, index === questionImages(question).length - 1 ? 'disabled' : '')}${button('remove-image', 'Remove', 'class="text-button"', 'image-off')}</div></div><img class="diagram-thumbnail" src="${escape(source)}" alt="Diagram ${index + 1} attached to question" /><div class="image-settings"><label class="field">Diagram ${index + 1} size<input type="range" data-path="q.${question.id}.images.${index}" min="${minimum}" max="${maximum}" value="${Math.min(maximum, Math.round(img.width))}" /></label>${button('edit-image', 'Crop & rotate', 'class="secondary"')}${button('image', 'Replace image', `class="secondary" data-replace="${index}"`)}</div><output class="diagram-dimensions">${imageDimensions(img, question, templateId)}</output><div class="inline-live-preview" hidden><p>Live paper view · updates as you resize</p><canvas class="diagram-live" role="img" aria-label="Live paper layout for diagram ${index + 1}" hidden></canvas></div></section>`;
}
export function partSummary(part) {
  return {
    prompt: plainText(part.text).replace(/\s+/g, ' ').trim() || 'Untitled subquestion',
    meta: `${{ written: 'Written response', 'multiple-choice': 'Multiple choice', 'true-false': 'True / False' }[responseType(part)]} · ${part.marks} ${part.marks === 1 ? 'mark' : 'marks'}`,
  };
}
function partView(question, part, pi, expanded) {
  const path = `p.${part.id}`, letter = String.fromCharCode(97 + pi), type = responseType(part);
  const summary = partSummary(part);
  return `<section class="part-card" data-part="${part.id}" aria-label="Subquestion ${letter}"><div class="part-heading"><h2><button type="button" class="part-toggle" data-action="toggle-part" data-id="${part.id}" aria-expanded="${expanded}" aria-controls="part-body-${part.id}" aria-label="Subquestion ${letter}" aria-describedby="part-summary-${part.id}">${icon('chevron-right')}<span class="part-number">(${letter})</span><span class="part-summary" id="part-summary-${part.id}"><span class="part-prompt" title="${escape(summary.prompt)}">${escape(summary.prompt)}</span><span class="part-meta">${escape(summary.meta)}</span></span></button></h2><div class="part-actions">${iconButton('part-up', 'arrow-up', `Move subquestion ${letter} up`, `data-id="${part.id}" ${pi === 0 ? 'disabled' : ''}`)}${iconButton('part-down', 'arrow-down', `Move subquestion ${letter} down`, `data-id="${part.id}" ${pi === question.parts.length - 1 ? 'disabled' : ''}`)}${button('delete-part', 'Delete', `class="delete-text" data-id="${part.id}" aria-label="Delete subquestion ${letter}" ${question.parts.length === 1 ? 'disabled' : ''}`, 'trash')}</div></div>
    <div class="part-body" id="part-body-${part.id}" ${expanded ? '' : 'hidden'}>
    ${richField('Question prompt', `${path}.text`, true)}<fieldset class="answer-settings"><legend>Answer settings</legend>${select('Response type', type, `${path}.responseType`, [['written', 'Written response'], ['multiple-choice', 'Multiple choice'], ['true-false', 'True / False']])}<div class="field-row small-fields">${field('Marks', part.marks, `${path}.marks`, { type: 'number', max: 1000 })}${type === 'written' ? field('Answer space (line units)', part.lines, `${path}.lines`, { type: 'number', max: 25, hint: 'Controls the amount of space, even when lines are hidden. Use 0 for no space.' }) : ''}</div>
    ${type === 'written' ? `<label class="checkbox"><input type="checkbox" data-path="${path}.showAnswerLines" ${part.showAnswerLines !== false ? 'checked' : ''} /> Show answer lines</label><p class="response-hint">Turn off for blank space for drawing, scribbling or maths working.</p>` : ''}
    ${type === 'multiple-choice' ? optionsView(part) : type === 'true-false' ? '<p class="response-hint">Students choose from □ True &nbsp; □ False on the paper.</p>' : ''}
    </fieldset>
    ${part.bank ? `<div class="content-block"><div class="block-heading"><strong>Word bank</strong>${button('remove-bank', 'Remove', `class="text-button delete-text" data-id="${part.id}"`)}</div>${area('Words or phrases', part.bank.join('\n'), `${path}.bank`, 3600, 'One word or phrase per line.')}</div>` : ''}
    ${partTables(part).map((table, i) => tableView(part, table, i)).join('')}
    <div class="part-extras">${!part.bank ? button('add-bank', 'Word bank', `class="text-button" data-id="${part.id}"`, 'plus') : ''}${button('add-table', 'Response table', `class="text-button" data-id="${part.id}" ${partTables(part).length >= 12 ? 'disabled' : ''}`, 'plus')}</div></div></section>`;
}
function optionsView(part) {
  const options = part.options || [];
  return `<div class="choice-editor">${options.map((value, index) => {
    const letter = String.fromCharCode(65 + index), attrs = `data-id="${part.id}" data-option="${index}"`;
    return `<div class="choice-row">${field(`Option ${letter}`, value, `p.${part.id}.options.${index}`, { max: 300 })}<div class="choice-actions">${iconButton('option-up', 'arrow-up', `Move option ${letter} up`, `${attrs} ${index === 0 ? 'disabled' : ''}`)}${iconButton('option-down', 'arrow-down', `Move option ${letter} down`, `${attrs} ${index === options.length - 1 ? 'disabled' : ''}`)}${button('option-remove', 'Remove', `class="delete-text" ${attrs} aria-label="Remove option ${letter}" ${options.length <= 2 ? 'disabled' : ''}`, 'trash')}</div></div>`;
  }).join('')}${button('option-add', 'Add option', `class="text-button" data-id="${part.id}" ${options.length >= 6 ? 'disabled' : ''}`, 'plus')}<small>Use 2–6 options. Complete each option before downloading.</small></div>`;
}
function tableView(part, table, index, primary = false) {
  const path = `${primary ? 'q' : 'p'}.${part.id}`, label = primary ? 'Data table' : 'Response table';
  const attrs = primary ? 'data-table-owner="question"' : `data-id="${part.id}"`;
  return `<section class="content-block" data-table="${index}" ${attrs} aria-label="${label} ${index + 1}"><div class="block-heading"><strong>${label} ${index + 1}</strong><div>${iconButton('table-up', 'arrow-up', `Move table ${index + 1} up`, `${attrs} ${index === 0 ? 'disabled' : ''}`)}${iconButton('table-down', 'arrow-down', `Move table ${index + 1} down`, `${attrs} ${index === (primary ? part.tables || [] : partTables(part)).length - 1 ? 'disabled' : ''}`)}${button('remove-table', 'Remove table', `class="text-button delete-text" ${attrs}`, 'trash')}</div></div>
    <label class="checkbox"><input type="checkbox" data-path="${path}.table.${index}" ${table.header ? 'checked' : ''} /> First row is a heading</label>
    <div class="table-editor"><table><tbody>${table.rows.map((row, ri) => `<tr>${row.map((text, ci) => `<td><input maxlength="300" aria-label="Row ${ri + 1}, column ${ci + 1}" data-path="${path}.cell.${index}.${ri}.${ci}" value="${escape(text)}" /></td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="table-buttons">${button('table-row', 'Row', `${attrs} ${table.rows.length >= 12 ? 'disabled' : ''}`, 'plus')}${button('table-column', 'Column', `${attrs} ${table.rows[0].length >= 5 ? 'disabled' : ''}`, 'plus')}${button('table-remove-row', 'Last row', `class="delete-text" ${attrs} ${table.rows.length <= 1 ? 'disabled' : ''}`, 'trash')}${button('table-remove-column', 'Last column', `class="delete-text" ${attrs} ${table.rows[0].length <= 1 ? 'disabled' : ''}`, 'trash')}</div><small>${primary ? 'Enter the data students will use.' : 'Leave cells empty for students to fill in.'} Up to 12 rows and 5 columns.</small></section>`;
}

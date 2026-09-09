export function helpStartStep(screen, replay = false) {
  if (replay) return 0;
  return screen === 'details' ? 1 : screen === 'question' ? 2 : 0;
}

const HELP_KEY = 'question-wizard-help-seen';

export function shouldShowHelp(storage) {
  try { return (storage ?? globalThis.localStorage).getItem(HELP_KEY) !== 'yes'; }
  catch { return true; }
}

export function dismissHelp(storage) {
  try { (storage ?? globalThis.localStorage).setItem(HELP_KEY, 'yes'); } catch {}
}

const steps = [
  {
    label: 'Start', title: 'A paper starts with one click.',
    description: 'From All papers, choose Create paper for a fresh draft. Or open the example paper to explore a finished one.',
    tip: 'Your papers are saved automatically in this browser on this device.',
    demo: '<div class="tour-demo-heading">Your question papers.</div><div class="tour-demo-button tour-target">＋ Create paper</div><div class="tour-demo-cards"><div class="tour-mini-paper"><b>Science</b><span>Example paper</span><i></i><i></i><i></i></div><div class="tour-mini-paper tour-reveal"><b>Untitled paper</b><span>Your new draft</span><i></i><i></i><i></i></div></div>'
  },
  {
    label: 'Details', title: 'Set the scene for your paper.',
    description: 'In Paper details, enter the title, subject, class, duration, and maximum marks. Choose your exam instructions and a paper template below.',
    tip: 'You can change the template later without losing your questions.',
    demo: '<div class="tour-demo-heading">Paper details</div><div class="tour-demo-field"><small>Paper title</small><b class="tour-type">Term 1 Assessment</b></div><div class="tour-demo-pair"><div class="tour-demo-field"><small>Subject</small><b>Science</b></div><div class="tour-demo-field tour-target"><small>Maximum marks</small><b>20</b></div></div><div class="tour-demo-note tour-reveal">✓ Choose a template and exam instructions</div>'
  },
  {
    label: 'Questions', title: 'Write it. Give it marks.',
    description: 'Choose Start writing questions or Add question. Write your prompt, add subquestions, and set the marks and Response type for each part.',
    tip: 'Use the formatting toolbar for bold text, lists, and other question formatting.',
    demo: '<div class="tour-demo-heading">Question 1</div><div class="tour-demo-toolbar">B &nbsp; <em>I</em> &nbsp; U &nbsp; • List</div><div class="tour-demo-field"><b class="tour-type">Name two parts of a plant.</b></div><div class="tour-demo-pair"><div class="tour-demo-field tour-target"><small>Marks</small><b>2</b></div><div class="tour-demo-field"><small>Response type</small><b>Written response</b></div></div><div class="tour-demo-note tour-reveal">________________ &nbsp; ________________</div>'
  },
  {
    label: 'Extras', title: 'Make room for more than words.',
    description: 'Attach a diagram to a question, then edit or resize it. In a subquestion, add a table or word bank when the activity needs one.',
    tip: 'The live preview shows how your diagrams and answer areas fit on the page.',
    demo: '<div class="tour-demo-heading">Build your activity</div><div class="tour-demo-pair"><div class="tour-demo-diagram tour-target"><svg viewBox="0 0 100 100"><path d="M50 86V28M50 63C17 65 15 37 15 37C44 36 50 63 50 63M50 46C79 49 85 20 85 20C55 20 50 46 50 46" fill="none" stroke="currentColor" stroke-width="3"/><path d="M31 88h38" stroke="currentColor" stroke-width="3"/></svg></div><div class="tour-demo-table tour-reveal"><b>Part</b><b>Function</b><span>Leaf</span><span></span><span>Root</span><span></span></div></div><div class="tour-demo-note">Drag the size slider to adjust a diagram</div>'
  },
  {
    label: 'Preview', title: 'Check every page before printing.',
    description: 'Watch Print preview update as you work. Use its page arrows to review the whole paper. Check Total marks and resolve any items to finish in the paper outline.',
    tip: 'Downloads become available when the required details and marks are complete.',
    demo: '<div class="tour-demo-heading">Print preview</div><div class="tour-preview-demo"><div class="tour-mini-paper"><b>Science</b><span>Term 1 Assessment</span><i></i><i></i><i></i><i></i></div><div><div class="tour-demo-score tour-target">20 <small>/ 20</small></div><div class="tour-demo-note tour-reveal">✓ Marks are balanced</div><div class="tour-demo-note">‹ &nbsp; 1 / 3 &nbsp; ›</div></div></div>'
  },
  {
    label: 'Save & share', title: 'Ready for the classroom.',
    description: 'Choose Download PDF for printing or Download Word for an editable document. Use Download project backup to keep a copy you can reopen in Question Wizard.',
    tip: 'Reopen a backup with Open project backup in All papers. Find this guide anytime in Help.',
    demo: '<div class="tour-demo-heading">Your paper is ready.</div><div class="tour-downloads"><div class="tour-demo-button tour-target">↓ Download PDF</div><div class="tour-demo-button tour-light">↓ Download Word</div></div><div class="tour-backup tour-reveal"><span>✓</span><div><b>Download project backup</b><small>Keep your questions and diagrams together</small></div></div>'
  }
];

const targets = [
  ['#library [data-action="new"]'],
  ['#editor [data-path="paper.title"]', '#outline [data-action="cover"]'],
  ['#editor .part-card .rich-surface', '#outline [data-action="add-question"]'],
  ['#editor .upload-area[data-action="image"]'],
  ['#workspace .preview-toolbar'],
  ['#workspace .exports']
];
const liveTips = [
  'Choose Create paper to start a draft. You can also open an existing paper below.',
  'Enter your paper details here. If you are editing a question, choose Paper details first.',
  'Write your question here. Use Add question in the outline to create another question.',
  'Choose Attach a diagram to add an image. Word bank and Response table are below each subquestion.',
  'Review the preview here, then use the page arrows below to check every page.',
  'Download PDF or Word here. If these buttons are unavailable, check the items to finish in the paper outline.'
];

export function createHelp({ getScreen = () => 'library' } = {}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'help-dialog';
  dialog.setAttribute('aria-labelledby', 'help-title');
  dialog.setAttribute('aria-describedby', 'help-description');
  dialog.innerHTML = `<div class="help-top"><span class="eyebrow">QUESTION WIZARD · QUICK GUIDE</span><button type="button" class="text-button" data-help="close" aria-label="Close help">Close ×</button></div>
    <nav class="help-progress" aria-label="Help topics"></nav>
    <div class="help-content"><div class="help-demo" aria-hidden="true"></div><div class="help-copy"><p class="eyebrow" id="help-step"></p><h2 id="help-title" tabindex="-1"></h2><p id="help-description"></p><p class="help-tip"></p><button type="button" class="secondary help-show" data-help="show">Show me in the app →</button><p class="help-unavailable" hidden></p></div></div>
    <button type="button" class="text-button help-replay" data-help="replay">Replay full guide</button><div class="help-footer"><button type="button" class="text-button" data-help="close">Skip guide</button><div><button type="button" class="secondary" data-help="back">Back</button><button type="button" class="primary" data-help="next">Next →</button></div></div>`;
  document.body.append(dialog);
  const find = selector => dialog.querySelector(selector);
  let index = 0, previousFocus, live = false, frame = 0, observedTarget = null;
  const ring = document.createElement('div');
  ring.className = 'help-spotlight'; ring.hidden = true; ring.setAttribute('aria-hidden', 'true');
  const coach = document.createElement('section');
  coach.className = 'help-coach'; coach.hidden = true;
  coach.setAttribute('role', 'region'); coach.setAttribute('aria-label', 'Help in the app');
  coach.innerHTML = '<p class="eyebrow">TRY IT IN THE APP</p><h2 tabindex="-1"></h2><p class="help-live-tip" id="help-live-tip" role="status"></p><div><button type="button" class="secondary" data-coach="guide">Back to guide</button><button type="button" class="primary" data-coach="done">Done</button></div>';
  document.body.append(ring, coach);
  const target = () => targets[index].flatMap(selector => [...document.querySelectorAll(selector)]).find(el => el.getClientRects().length > 0 && !el.closest('[hidden]'));
  const updateSpotlight = () => {
    frame = 0;
    if (!live) return;
    const element = target();
    ring.hidden = !element;
    if (observedTarget !== element) {
      resizeObserver.disconnect(); observedTarget = element;
      if (element) resizeObserver.observe(element);
    }
    const message = !element ? 'This screen has changed. Choose Back to guide for help with what you are working on now.'
      : element.matches('[data-action="add-question"]') ? 'Choose Add question to add a question. Then write its prompt, choose a response type, and set its marks.'
      : element.matches('[data-action="cover"]') ? 'Choose Paper details to edit the title, subject, marks, instructions, and template.'
      : element.disabled ? 'You have reached the limit for this item. Edit an existing item or remove one before adding another.' : liveTips[index];
    const tip = coach.querySelector('.help-live-tip');
    if (tip.textContent !== message) tip.textContent = message;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    Object.assign(ring.style, { left: `${rect.left - 5}px`, top: `${rect.top - 5}px`, width: `${rect.width + 10}px`, height: `${rect.height + 10}px` });
    // Keep the coach on the opposite side of the viewport from the highlighted control.
    coach.classList.toggle('help-coach-top', rect.top + rect.height / 2 > innerHeight / 2);
  };
  const scheduleSpotlight = () => { if (live && !frame) frame = requestAnimationFrame(updateSpotlight); };
  const observer = new MutationObserver(scheduleSpotlight);
  const resizeObserver = new ResizeObserver(scheduleSpotlight);
  const stopLive = () => {
    live = false; ring.hidden = true; coach.hidden = true;
    observer.disconnect(); resizeObserver.disconnect(); observedTarget = null;
    window.removeEventListener('scroll', scheduleSpotlight, true);
    window.removeEventListener('resize', scheduleSpotlight);
    window.visualViewport?.removeEventListener('resize', scheduleSpotlight);
    window.visualViewport?.removeEventListener('scroll', scheduleSpotlight);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
  const render = () => {
    const step = steps[index];
    find('.help-progress').innerHTML = steps.map((item, i) => `<button type="button" data-help="topic" data-step="${i}" class="${i === index ? 'reached' : ''}" aria-label="${i + 1}. ${item.label}" ${i === index ? 'aria-current="step"' : ''}><b aria-hidden="true">${i + 1}</b><span>${item.label}</span></button>`).join('');
    find('#help-step').textContent = `STEP ${index + 1} OF ${steps.length}`;
    find('#help-title').textContent = step.title;
    find('#help-description').textContent = step.description;
    find('.help-tip').textContent = step.tip;
    find('.help-demo').innerHTML = `<div class="tour-scene">${step.demo}<span class="tour-cursor">↖</span></div><span class="tour-demo-caption">ILLUSTRATED DEMO</span>`;
    const available = Boolean(target());
    find('[data-help="show"]').hidden = !available;
    find('.help-unavailable').hidden = available;
    find('.help-unavailable').textContent = index === 0 ? 'Return to All papers to try this step.' : index === 3 ? 'Open a question to try diagrams and tables.' : 'Open or create a paper to try this step.';
    find('[data-help="back"]').disabled = index === 0;
    find('[data-help="next"]').textContent = index === steps.length - 1 ? 'Done ✓' : 'Next →';
    dialog.scrollTop = 0;
    find('#help-title').focus({ preventScroll: true });
  };
  const close = () => {
    // Persist before closing: the native close event runs later, after a reload can begin.
    dismissHelp();
    stopLive();
    document.body.classList.remove('help-open');
    dialog.close();
    if (previousFocus?.isConnected && previousFocus !== document.body && !previousFocus.closest('[hidden]') && previousFocus.getClientRects().length) previousFocus.focus({ preventScroll: true });
    else document.querySelector('[data-action="help"]')?.focus({ preventScroll: true });
  };
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const buttons = [...dialog.querySelectorAll('button:not(:disabled)')].filter(button => !button.hidden);
    const position = buttons.indexOf(document.activeElement);
    if (event.shiftKey && position <= 0) {
      event.preventDefault(); buttons.at(-1).focus();
    } else if (!event.shiftKey && position === buttons.length - 1) {
      event.preventDefault(); buttons[0].focus();
    }
  });
  dialog.addEventListener('click', event => {
    const control = event.target.closest('[data-help]');
    if (!control || control.disabled) return;
    if (control.dataset.help === 'close') close();
    else if (control.dataset.help === 'topic') { index = Number(control.dataset.step); render(); }
    else if (control.dataset.help === 'replay') { index = 0; render(); }
    else if (control.dataset.help === 'show') {
      const element = target();
      if (!element) { render(); return; }
      dialog.close(); document.body.classList.remove('help-open');
      live = true; coach.hidden = false;
      coach.querySelector('h2').textContent = steps[index].title;
      element.scrollIntoView({ block: 'center', behavior: 'instant' });
      updateSpotlight();
      const input = element.matches('button, input, select, textarea') ? element : element.querySelector('[contenteditable="true"],button:not(:disabled)');
      (input && !input.disabled ? input : coach.querySelector('h2')).focus({ preventScroll: true });
      for (const area of document.querySelectorAll('#library, #workspace')) observer.observe(area, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
      window.addEventListener('scroll', scheduleSpotlight, true);
      window.addEventListener('resize', scheduleSpotlight);
      window.visualViewport?.addEventListener('resize', scheduleSpotlight);
      window.visualViewport?.addEventListener('scroll', scheduleSpotlight);
    }
    else if (control.dataset.help === 'back') { index = Math.max(0, index - 1); render(); }
    else if (index === steps.length - 1) close();
    else { index++; render(); }
  });
  coach.addEventListener('click', event => {
    const control = event.target.closest('[data-coach]');
    if (!control) return;
    if (control.dataset.coach === 'done') close();
    else {
      const screen = getScreen();
      if (!target()) index = helpStartStep(screen);
      stopLive(); dialog.showModal(); document.body.classList.add('help-open'); render();
    }
  });
  document.addEventListener('keydown', event => {
    if (live && event.key === 'Escape' && !document.querySelector('dialog[open]')) { event.preventDefault(); close(); }
  });
  return {
    open({ replay = false } = {}) {
      if (dialog.open) return;
      previousFocus = document.activeElement;
      stopLive();
      index = helpStartStep(getScreen(), replay);
      dialog.showModal();
      document.body.classList.add('help-open');
      render();
    }
  };
}

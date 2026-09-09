let opening;
function database() {
  opening ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('question-wizard', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects', { keyPath: 'id' });
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => { opening = null; reject(request.error); };
    request.onblocked = () => { opening = null; reject(new Error('Close other Question Wizard tabs and try again.')); };
  });
  return opening;
}
async function transaction(mode, operation) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', mode);
    const request = operation(tx.objectStore('projects'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error || request.error);
    tx.onabort = () => reject(tx.error || new Error('Draft saving was interrupted.'));
  });
}
export const listProjects = () => transaction('readonly', store => store.getAll());
export const saveProject = project => transaction('readwrite', store => store.put(project));
export const deleteProject = key => transaction('readwrite', store => store.delete(key));

// At most one write is active and one newest snapshot is pending. Old writes
// cannot finish after and replace newer edits from this editor.
export class DraftWriter {
  constructor(write, onState) { this.write = write; this.onState = onState; this.pending = null; this.running = null; this.failed = false; }
  enqueue(project) {
    this.pending = structuredClone(project); this.failed = false; this.onState('saving');
    if (!this.running) this.running = this.pump().finally(() => { this.running = null; });
  }
  async pump() {
    while (this.pending) {
      const snapshot = this.pending; this.pending = null;
      try { await this.write(snapshot); }
      catch (error) { this.failed = true; this.pending = null; this.onState('error', error); return; }
    }
    this.onState('saved');
  }
  async flush() { await this.running; return !this.failed; }
  get busy() { return Boolean(this.running || this.pending); }
}

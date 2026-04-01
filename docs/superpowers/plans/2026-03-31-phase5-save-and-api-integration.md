# Phase 5: Save Flow & API Integration — Implementation Plan

**Goal:** After a consolidation result is ready, the user can save it with a name, and the dashboard loads real records from the backend.

**Files changed:** `js/master-records.js`, `css/master-records.css` only.

**Tech stack:** Vanilla JS ES5 (`var`, no arrow functions, no `let`/`const`). No build step. Manual browser verification via `node serve.mjs`.

**Detection strategy:** MutationObserver on `.panel-center .panel-header-badge`. After `state.openFile()` runs, `excel-editor.js` sets `state.excelState` and then updates the badge. By the time the observer fires, `state.excelState.fileName` and `state.excelState.instance` are fully populated. A consolidation result is identified by `state.excelState.fileName.indexOf('Consolidated') === 0`.

---

## Data Contract

### POST /api/records — request body
```json
{
  "name":        "Q1 Subcontractors",
  "savedAt":     "2026-03-31T14:22:00.000Z",
  "sourceCount": 3,
  "rowCount":    142,
  "colCount":    8
}
```
- No `fileObj` — binary stays in memory only, never sent to backend.
- Backend generates and returns `id`.

### POST /api/records — response body (used to update record after save)
```json
{
  "id":          "abc123",
  "name":        "Q1 Subcontractors",
  "savedAt":     "2026-03-31T14:22:00.000Z",
  "sourceCount": 3,
  "rowCount":    142,
  "colCount":    8
}
```

### GET /api/records — response body (dashboard load)
```json
[
  {
    "id":          "abc123",
    "name":        "Q1 Subcontractors",
    "savedAt":     "2026-03-31T14:22:00.000Z",
    "sourceCount": 3,
    "rowCount":    142,
    "colCount":    8
  }
]
```
Records from the backend will not have `fileObj`. The existing `openRecord()` guard (`if (state.openFile && record.fileObj)`) already handles this — no change needed.

---

## Chunk 1: CSS

### Task 1: Save bar and modal styles

**Files:** `css/master-records.css`

- [ ] **Step 1: Add save bar styles**

Append to `css/master-records.css`:

```css
/* ── Save Bar ───────────────────────────────────────────── */
#save-record-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 900;
  background: #171c23;
  border-top: 1px solid #e29a35;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  gap: 12px;
}

.save-bar-message {
  font-size: 13px;
  color: #8c99ae;
}

.save-bar-message strong {
  color: #e8ecf2;
  font-weight: 600;
}

.save-bar-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.save-bar-btn {
  background: #e29a35;
  border: none;
  color: #0f1217;
  padding: 7px 18px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  transition: opacity 0.15s;
}

.save-bar-btn:hover {
  opacity: 0.85;
}

.save-bar-dismiss {
  background: none;
  border: none;
  color: #55627a;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  padding: 7px 8px;
  transition: color 0.15s;
}

.save-bar-dismiss:hover {
  color: #8c99ae;
}
```

- [ ] **Step 2: Add save modal styles**

```css
/* ── Save Modal ─────────────────────────────────────────── */
.save-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(15, 18, 23, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
}

.save-modal {
  background: #171c23;
  border: 1px solid #1d242e;
  border-radius: 6px;
  padding: 28px 28px 24px;
  width: 380px;
  max-width: calc(100vw - 48px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

.save-modal-title {
  font-family: Georgia, Cambria, serif;
  font-size: 16px;
  color: #e8ecf2;
  margin: 0 0 18px;
  font-weight: normal;
}

.save-modal-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8c99ae;
  margin-bottom: 6px;
}

.save-modal-input {
  width: 100%;
  background: #0f1217;
  border: 1px solid #1d242e;
  border-radius: 4px;
  color: #e8ecf2;
  font-size: 13px;
  padding: 8px 10px;
  box-sizing: border-box;
  outline: none;
  font-family: inherit;
}

.save-modal-input:focus {
  border-color: #55627a;
}

.save-modal-input.input-error {
  border-color: #e05252;
}

.save-modal-error {
  font-size: 12px;
  color: #e05252;
  margin-top: 5px;
  min-height: 16px;
}

.save-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.save-modal-cancel {
  background: none;
  border: 1px solid #55627a;
  color: #8c99ae;
  padding: 7px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.15s, color 0.15s;
}

.save-modal-cancel:hover {
  border-color: #e8ecf2;
  color: #e8ecf2;
}

.save-modal-save {
  background: #e29a35;
  border: none;
  color: #0f1217;
  padding: 7px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  transition: opacity 0.15s;
  min-width: 80px;
}

.save-modal-save:hover:not(:disabled) {
  opacity: 0.85;
}

.save-modal-save:disabled {
  opacity: 0.5;
  cursor: default;
}
```

- [ ] **Step 3: Commit**

```bash
git add css/master-records.css
git commit -m "feat(05-01): add save bar and save modal CSS"
```

---

## Chunk 2: Save Bar — Injection and Detection

### Task 2: Inject save bar and wire MutationObserver

**Files:** `js/master-records.js`

- [ ] **Step 1: Add helper to extract metadata from current excelState**

Insert after the `sortRecords` function:

```js
  // ── Consolidation Metadata ───────────────────────────────
  function getConsolidationMeta() {
    var fileName = state.excelState && state.excelState.fileName || '';
    var match = fileName.match(/(\d+) source/);
    var sourceCount = match ? parseInt(match[1], 10) : 0;

    var rowCount = 0;
    var colCount = 0;
    if (state.excelState && state.excelState.instance) {
      var data = state.excelState.instance.getData();
      var nonEmpty = data.filter(function (row) {
        return row.some(function (cell) { return cell !== '' && cell !== null && cell !== undefined; });
      });
      rowCount = nonEmpty.length > 0 ? nonEmpty.length - 1 : 0; // subtract header row
      colCount = nonEmpty.length > 0 ? nonEmpty[0].length : 0;
    }
    return { sourceCount: sourceCount, rowCount: rowCount, colCount: colCount };
  }
```

- [ ] **Step 2: Add buildSaveBar and showSaveBar / hideSaveBar**

Insert after `getConsolidationMeta`:

```js
  // ── Save Bar ─────────────────────────────────────────────
  var saveBar = null;

  function buildSaveBar() {
    var bar = document.createElement('div');
    bar.id = 'save-record-bar';

    var msg = document.createElement('span');
    msg.className = 'save-bar-message';
    msg.innerHTML = '<strong>Consolidation ready.</strong> Save this result to your records?';

    var actions = document.createElement('div');
    actions.className = 'save-bar-actions';

    var saveBtn = document.createElement('button');
    saveBtn.className = 'save-bar-btn';
    saveBtn.textContent = 'Save to Records';
    saveBtn.addEventListener('click', function () {
      showSaveModal();
    });

    var dismissBtn = document.createElement('button');
    dismissBtn.className = 'save-bar-dismiss';
    dismissBtn.textContent = 'Not now';
    dismissBtn.addEventListener('click', function () {
      hideSaveBar();
    });

    actions.appendChild(saveBtn);
    actions.appendChild(dismissBtn);
    bar.appendChild(msg);
    bar.appendChild(actions);
    return bar;
  }

  function showSaveBar() {
    if (!saveBar) {
      saveBar = buildSaveBar();
      document.body.appendChild(saveBar);
    }
    saveBar.style.display = 'flex';
  }

  function hideSaveBar() {
    if (saveBar) {
      saveBar.style.display = 'none';
    }
  }
```

- [ ] **Step 3: Wire MutationObserver at the bottom of initMasterRecords (before closing brace)**

```js
  // ── Consolidation Detection ──────────────────────────────
  (function () {
    var badge = document.querySelector('.panel-center .panel-header-badge');
    if (!badge) return;
    var observer = new MutationObserver(function () {
      var fileName = state.excelState && state.excelState.fileName || '';
      if (fileName.indexOf('Consolidated') === 0) {
        showSaveBar();
      } else {
        hideSaveBar();
      }
    });
    observer.observe(badge, { childList: true, characterData: true, subtree: true });
  }());
```

- [ ] **Step 4: Commit**

```bash
git add js/master-records.js
git commit -m "feat(05-02): inject save bar and detect consolidation via MutationObserver"
```

**Manual check at this point:** Open the app, add files, consolidate. Save bar should appear at bottom. Click "Not now" — it disappears. Open a non-consolidated file from sources panel — bar should not appear.

---

## Chunk 3: Save Modal

### Task 3: Build save modal with validation and save logic

**Files:** `js/master-records.js`

- [ ] **Step 1: Add buildSaveModal**

Insert after `hideSaveBar`:

```js
  // ── Save Modal ───────────────────────────────────────────
  function showSaveModal() {
    var meta = getConsolidationMeta();

    var overlay = document.createElement('div');
    overlay.className = 'save-modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'save-modal';

    var title = document.createElement('h3');
    title.className = 'save-modal-title';
    title.textContent = 'Save to Records';

    var label = document.createElement('label');
    label.className = 'save-modal-label';
    label.textContent = 'Record name';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'save-modal-input';
    input.value = generateName();
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('maxlength', '120');

    var errorMsg = document.createElement('p');
    errorMsg.className = 'save-modal-error';

    var footer = document.createElement('div');
    footer.className = 'save-modal-footer';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'save-modal-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.type = 'button';

    var saveBtn = document.createElement('button');
    saveBtn.className = 'save-modal-save';
    saveBtn.textContent = 'Save';
    saveBtn.type = 'button';

    function closeModal() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function setLoading(loading) {
      saveBtn.disabled = loading;
      cancelBtn.disabled = loading;
      saveBtn.textContent = loading ? 'Saving\u2026' : 'Save';
    }

    function setError(msg) {
      errorMsg.textContent = msg || '';
      if (msg) {
        input.classList.add('input-error');
      } else {
        input.classList.remove('input-error');
      }
    }

    cancelBtn.addEventListener('click', closeModal);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    saveBtn.addEventListener('click', function () {
      var name = (input.value || '').trim();
      if (!name) {
        setError('Name is required.');
        input.focus();
        return;
      }
      setError('');
      setLoading(true);

      var payload = {
        name:        name,
        savedAt:     new Date().toISOString(),
        sourceCount: meta.sourceCount,
        rowCount:    meta.rowCount,
        colCount:    meta.colCount
      };

      apiAdapter.post(payload).then(function (saved) {
        closeModal();
        hideSaveBar();
        if (state.addMessage) {
          state.addMessage('\u2713 Saved \u201c' + saved.name + '\u201d to records.', 'ai');
        }
      }).catch(function (err) {
        setLoading(false);
        setError('Save failed. Please try again.');
        console.error('Save error:', err);
      });
    });

    input.addEventListener('input', function () {
      if (input.value.trim()) setError('');
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    modal.appendChild(title);
    modal.appendChild(label);
    modal.appendChild(input);
    modal.appendChild(errorMsg);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Focus and select all so user can type immediately
    setTimeout(function () { input.select(); }, 0);
  }
```

- [ ] **Step 2: Commit**

```bash
git add js/master-records.js
git commit -m "feat(05-03): add save modal with validation and save logic"
```

**Manual check:** After consolidation, click "Save to Records". Modal appears with pre-filled name. Click Save with empty name → error shown. Type a name → error clears. Click Cancel → modal closes, bar still visible.

---

## Chunk 4: Real API Integration

### Task 4: Switch apiAdapter to real backend

**Files:** `js/master-records.js`

- [ ] **Step 1: Replace apiAdapter with real fetch calls**

Replace the existing `apiAdapter` object:

```js
  var apiAdapter = {
    getAll: function () {
      return fetch('/api/records').then(function (r) {
        if (!r.ok) throw new Error('GET /api/records failed: ' + r.status);
        return r.json();
      });
    },
    post: function (record) {
      return fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      }).then(function (r) {
        if (!r.ok) throw new Error('POST /api/records failed: ' + r.status);
        return r.json();
      });
    },
    remove: function (id) {
      return fetch('/api/records/' + id, { method: 'DELETE' }).then(function (r) {
        if (!r.ok) throw new Error('DELETE /api/records/' + id + ' failed: ' + r.status);
      });
    }
  };
```

- [ ] **Step 2: Commit**

```bash
git add js/master-records.js
git commit -m "feat(05-04): switch apiAdapter to real backend fetch calls"
```

---

## Chunk 5: Manual Verification

### Task 5: End-to-end verification

- [ ] **Step 1: Start server**

```bash
node serve.mjs
```

- [ ] **Step 2: Verify save flow**

1. Upload 2+ `.xlsx` files in the sources panel
2. Check files and click Consolidate
3. Consolidation completes → save bar appears at bottom: *"Consolidation ready. Save this result to your records?"*
4. Click **Save to Records** → modal opens with pre-filled name
5. Clear name field, click Save → error: *"Name is required."*
6. Type a name, click Save → modal closes, bar disappears, chat shows: *"✓ Saved 'Your Name' to records."*

- [ ] **Step 3: Verify dashboard shows real data**

7. Open the dashboard → record appears with correct name, date, source/row/col counts
8. Sort and search work on real data
9. Record count label shows correctly

- [ ] **Step 4: Verify dismiss behavior**

10. Consolidate again → save bar reappears
11. Click **Not now** → bar disappears
12. Do NOT save → open dashboard → only previously saved records shown

- [ ] **Step 5: Verify open record compatibility**

13. Click Open on a record saved from backend (no fileObj) → dashboard closes (no JS error). Full reopen requires backend fetch — deferred.

- [ ] **Step 6: Commit verification note**

```bash
git commit --allow-empty -m "chore(05-05): manual verification passed for Phase 5 save flow and API integration"
```

---

## Final State

New additions to `js/master-records.js`:
- `getConsolidationMeta()` — extracts sourceCount/rowCount/colCount from live excelState
- `buildSaveBar()` / `showSaveBar()` / `hideSaveBar()` — fixed bottom bar injected once into body
- MutationObserver on `.panel-center .panel-header-badge` — shows/hides bar based on filename
- `showSaveModal(meta)` — modal with name input, validation, loading/error states, POST on confirm
- `apiAdapter` — replaced with real `fetch` calls to `/api/records`

New additions to `css/master-records.css`:
- `.save-bar-*` — save bar layout and button styles
- `.save-modal-*` — modal overlay, card, input, error, footer styles

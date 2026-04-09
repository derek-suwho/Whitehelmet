// ── Master Records & Dashboard (Group 1 — inherited from Group 2) ──────
import { state } from './state.js';

export function initMasterRecords() {
  var root = document.getElementById('dashboard-root');
  if (!root) return;

  // ── Styles ──────────────────────────────────────────────────────────
  root.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:1000',
    'background:rgba(10,13,18,0.96)', 'display:none',
    'flex-direction:column', 'align-items:center', 'justify-content:flex-start',
    'padding:40px 24px', 'overflow-y:auto', 'font-family:inherit'
  ].join(';');

  // ── Render ───────────────────────────────────────────────────────────
  function render() {
    root.innerHTML = '';

    // Header row
    var header = document.createElement('div');
    header.style.cssText = 'width:100%;max-width:860px;display:flex;align-items:center;justify-content:space-between;margin-bottom:28px';

    var title = document.createElement('h2');
    title.textContent = 'Master Records';
    title.style.cssText = 'margin:0;font-size:20px;font-weight:600;color:#e8eaf0;letter-spacing:-0.3px';

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7 Close';
    closeBtn.style.cssText = [
      'background:#1d242e', 'border:1px solid #2a3340', 'color:#8a9ab0',
      'padding:6px 14px', 'border-radius:6px', 'cursor:pointer',
      'font-size:13px', 'transition:background 0.15s'
    ].join(';');
    closeBtn.addEventListener('mouseenter', function() { closeBtn.style.background = '#252d38'; });
    closeBtn.addEventListener('mouseleave', function() { closeBtn.style.background = '#1d242e'; });
    closeBtn.addEventListener('click', state.hideDashboard);

    header.appendChild(title);
    header.appendChild(closeBtn);
    root.appendChild(header);

    // Badge
    var badge = document.createElement('div');
    badge.textContent = state.masterRecords.length + ' saved record' + (state.masterRecords.length !== 1 ? 's' : '');
    badge.style.cssText = 'width:100%;max-width:860px;font-size:12px;color:#5a6a7e;margin-bottom:16px';
    root.appendChild(badge);

    // Empty state
    if (state.masterRecords.length === 0) {
      var empty = document.createElement('div');
      empty.style.cssText = 'width:100%;max-width:860px;padding:60px 0;text-align:center;color:#5a6a7e;font-size:14px';
      empty.textContent = 'No master records yet. Consolidate files to create one.';
      root.appendChild(empty);
      return;
    }

    // Record cards
    var list = document.createElement('div');
    list.style.cssText = 'width:100%;max-width:860px;display:flex;flex-direction:column;gap:10px';

    state.masterRecords.slice().reverse().forEach(function(rec) {
      var card = document.createElement('div');
      card.style.cssText = [
        'background:#141920', 'border:1px solid #1e2730', 'border-radius:8px',
        'padding:16px 20px', 'display:flex', 'align-items:center',
        'justify-content:space-between', 'gap:12px', 'transition:border-color 0.15s'
      ].join(';');
      card.addEventListener('mouseenter', function() { card.style.borderColor = '#2a3d55'; });
      card.addEventListener('mouseleave', function() { card.style.borderColor = '#1e2730'; });

      var info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0';

      var name = document.createElement('div');
      name.textContent = rec.name;
      name.style.cssText = 'font-size:14px;font-weight:500;color:#d4dae6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';

      var meta = document.createElement('div');
      meta.textContent = rec.rowCount + ' rows \u00b7 ' + rec.sourceCount + ' source' + (rec.sourceCount !== 1 ? 's' : '') + ' \u00b7 ' + rec.date;
      meta.style.cssText = 'font-size:12px;color:#5a6a7e;margin-top:3px';

      info.appendChild(name);
      info.appendChild(meta);

      var openBtn = document.createElement('button');
      openBtn.textContent = 'Open';
      openBtn.style.cssText = [
        'background:#1a2d45', 'border:1px solid #2a4060', 'color:#5b9bd5',
        'padding:5px 14px', 'border-radius:5px', 'cursor:pointer',
        'font-size:12px', 'white-space:nowrap', 'flex-shrink:0'
      ].join(';');
      openBtn.addEventListener('mouseenter', function() { openBtn.style.background = '#1e3550'; });
      openBtn.addEventListener('mouseleave', function() { openBtn.style.background = '#1a2d45'; });
      openBtn.addEventListener('click', function() {
        if (state.openFile) state.openFile(rec.fileObj);
        state.hideDashboard();
      });

      card.appendChild(info);
      card.appendChild(openBtn);
      list.appendChild(card);
    });

    root.appendChild(list);
  }

  // ── State registrations ──────────────────────────────────────────────

  state.showDashboard = function() {
    render();
    root.style.display = 'flex';
  };

  state.hideDashboard = function() {
    root.style.display = 'none';
  };

  state.saveMasterRecord = function(record) {
    // record: { name, date, sourceCount, rowCount, fileObj }
    state.masterRecords.push(record);
    if (state.addMessage) {
      state.addMessage('Master record saved: "' + record.name + '" (' + record.rowCount + ' rows from ' + record.sourceCount + ' source' + (record.sourceCount !== 1 ? 's' : '') + '). Type "show dashboard" to browse saved records.', 'ai');
    }
  };

  // Close on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && root.style.display !== 'none') state.hideDashboard();
  });
}

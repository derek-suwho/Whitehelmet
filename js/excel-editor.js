import { state } from './state.js';

export function initExcelEditor() {
  var panelCenter   = document.querySelector('.panel-center');
  var panelBody     = panelCenter.querySelector('.panel-body');
  var headerBadge   = panelCenter.querySelector('.panel-header-badge');
  var downloadBtn   = document.getElementById('download-xlsx-btn');
  var currentInstance = null;

  var EMPTY_CENTER_HTML = '<div class="center-empty">'
    + '<div class="center-empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>'
    + '<polyline points="14 2 14 8 20 8"/>'
    + '<line x1="16" y1="13" x2="8" y2="13"/>'
    + '<line x1="16" y1="17" x2="8" y2="17"/>'
    + '<polyline points="10 9 9 9 8 9"/>'
    + '</svg></div>'
    + '<div class="center-empty-heading">Select a source file to view</div>'
    + '<div class="center-empty-sub">Choose a file from the Sources panel to open it in the spreadsheet editor</div>'
    + '</div>';

  state.closeFile = function (fileName) {
    // Only close if the given file is the one currently open
    if (fileName && state.excelState.fileName !== fileName) return;
    if (currentInstance) {
      try { currentInstance.destroy(); } catch (ex) {}
      currentInstance = null;
    }
    state.excelState.instance = null;
    state.excelState.workbook = null;
    state.excelState.fileName = null;
    downloadBtn.style.display = 'none';
    headerBadge.textContent = '';
    panelBody.className = 'panel-body';
    panelBody.style.display = 'flex';
    panelBody.style.alignItems = 'center';
    panelBody.style.justifyContent = 'center';
    panelBody.innerHTML = EMPTY_CENTER_HTML;
  };

  // ── Download / export handler ──────────────────────────
  downloadBtn.addEventListener('click', function () {
    if (!state.excelState.instance) return;

    // Get current cell data from Jspreadsheet
    var data = state.excelState.instance.getData();

    // Build a new SheetJS workbook from current data
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

    // Write to binary array
    var wbArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    // Create Blob and trigger download
    var blob = new Blob([wbArray], { type: 'application/octet-stream' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = state.excelState.fileName || 'export.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  state.openFile = function (fileObj) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var data     = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });

      // Destroy previous instance
      if (currentInstance) {
        try { currentInstance.destroy(); } catch (ex) {}
        currentInstance = null;
      }

      // Clear panel body and set spreadsheet mode
      panelBody.innerHTML = '';
      panelBody.className = 'panel-body has-spreadsheet';
      panelBody.style.cssText = '';

      // Container element
      var container = document.createElement('div');
      container.id  = 'excel-container';
      panelBody.appendChild(container);

      // Build worksheet configs for all sheets
      var worksheets = workbook.SheetNames.map(function (sheetName) {
        var ws   = workbook.Sheets[sheetName];
        var rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!rows || rows.length === 0) rows = [[]];

        var maxCols = 0;
        rows.forEach(function (r) { if (r.length > maxCols) maxCols = r.length; });
        if (maxCols < 10) maxCols = 10;

        var columns = [];
        for (var c = 0; c < maxCols; c++) { columns.push({ width: 120 }); }

        var stringRows = rows.map(function (row) {
          return row.map(function (cell) {
            return (cell === null || cell === undefined) ? '' : String(cell);
          });
        });

        return {
          sheetName: sheetName,
          data: stringRows,
          columns: columns,
          minDimensions: [maxCols, Math.max(rows.length, 20)],
          allowInsertRow: true,
          allowInsertColumn: true,
        };
      });

      var instances = jspreadsheet(container, {
        worksheets: worksheets,
      });

      currentInstance = Array.isArray(instances) ? instances[0] : instances;

      // Move tab bar outside the scrollable container so it stays visible
      // when scrolling horizontally. Insert before container so tabs appear at top.
      var tabsHeaders = container.querySelector('.jtabs-headers');
      if (tabsHeaders) {
        panelBody.insertBefore(tabsHeaders, container);
        Array.prototype.forEach.call(tabsHeaders.children, function (el) {
          el.style.setProperty('color', '#000000', 'important');
          // Hide empty/nameless buttons (e.g. add-sheet button)
          if (!el.textContent.trim()) el.style.display = 'none';
        });
      }

      // Update global state
      state.excelState.instance = currentInstance;
      state.excelState.workbook = workbook;
      state.excelState.fileName = fileObj.name;

      // Show download button now that a file is open
      downloadBtn.style.display = 'flex';

      // Update header badge (truncate to 20 chars)
      var name = fileObj.name;
      headerBadge.textContent = name.length > 20 ? name.slice(0, 17) + '\u2026' : name;
    };

    reader.readAsArrayBuffer(fileObj);
  };
}

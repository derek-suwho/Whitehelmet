import { state } from './state.js';

// ── Module-level state (shared with custom renderer) ──────────
var _currentSheetIdx = 0;
var _allSheetFormats   = []; // _allSheetFormats[sheetIdx]["r,c"] = {bold,italic,...}
var _allSheetMerges    = []; // Handsontable merge configs per sheet
var _allSheetColWidths = []; // column pixel-widths per sheet

// ARGB hex (e.g. "FFRRGGBB") → CSS hex ("#RRGGBB")
function argbToCss(argb) {
  if (!argb) return null;
  var s = String(argb).replace('#', '');
  if (s.length === 8) return '#' + s.slice(2);
  if (s.length === 6) return '#' + s;
  return null;
}

function getFmt(sheetIdx, row, col) {
  var s = _allSheetFormats[sheetIdx];
  return (s && s[row + ',' + col]) || {};
}
function setFmt(sheetIdx, row, col, props) {
  if (!_allSheetFormats[sheetIdx]) _allSheetFormats[sheetIdx] = {};
  var key = row + ',' + col;
  _allSheetFormats[sheetIdx][key] = Object.assign(
    {}, _allSheetFormats[sheetIdx][key] || {}, props
  );
}

// ── Custom cell renderer ──────────────────────────────────────
Handsontable.renderers.registerRenderer('fmtRenderer',
  function(hot, TD, row, col, prop, value, cellProps) {
    Handsontable.renderers.getRenderer('text').apply(this, arguments);
    var fmt = getFmt(_currentSheetIdx, row, col);
    // header row defaults
    if (row === 0) {
      if (!fmt.bgColor) TD.style.backgroundColor = '#e9f0e9';
      if (!fmt.bold)    TD.style.fontWeight = '600';
    }
    if (fmt.bold)      TD.style.fontWeight = 'bold';
    if (fmt.italic)    TD.style.fontStyle  = 'italic';
    if (fmt.underline) TD.style.textDecoration = 'underline';
    if (fmt.color)     TD.style.color = fmt.color;
    if (fmt.bgColor)   TD.style.backgroundColor = fmt.bgColor;
    if (fmt.align)     TD.style.textAlign = fmt.align;
    if (fmt.wrapText)  { TD.style.whiteSpace = 'normal'; TD.style.wordBreak = 'break-word'; }
    if (fmt.numFormat && value !== '' && value !== null && value !== undefined) {
      var num = parseFloat(String(value));
      if (!isNaN(num)) {
        if      (fmt.numFormat === 'currency') TD.textContent = '$' + num.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2});
        else if (fmt.numFormat === 'percent')  TD.textContent = (num * 100).toFixed(1) + '%';
        else if (fmt.numFormat === 'number')   TD.textContent = num.toLocaleString('en-US');
        else if (fmt.numFormat === 'date') {
          // Try as Excel serial date if purely numeric, else leave as-is
          var d = new Date(Math.round((num - 25569) * 86400 * 1000));
          if (!isNaN(d)) TD.textContent = d.toLocaleDateString('en-US');
        }
      }
    }
  }
);

// ── Colour palette for picker ─────────────────────────────────
var COLORS = [
  '#000000','#434343','#666666','#999999','#b7b7b7','#cccccc','#d9d9d9','#ffffff',
  '#ff0000','#ff9900','#ffff00','#00ff00','#00ffff','#4a86e8','#0000ff','#9900ff',
  '#ff00ff','#ff6666','#ffd966','#93c47d','#76a5af','#6fa8dc','#8e7cc3','#c27ba0',
  '#cc0000','#e69138','#f1c232','#6aa84f','#45818e','#3c78d8','#1c4587','#20124d',
];

// ── Column index → Excel letter (A, B, …, Z, AA, …) ──────────
function colLetter(idx) {
  var s = '', n = idx + 1;
  while (n > 0) { var r = (n-1) % 26; s = String.fromCharCode(65+r) + s; n = Math.floor((n-1)/26); }
  return s;
}

// ─────────────────────────────────────────────────────────────
export function initExcelEditor() {
  var panelCenter   = document.querySelector('.panel-center');
  var panelBody     = panelCenter.querySelector('.panel-body');
  var headerBadge   = panelCenter.querySelector('.panel-header-badge');
  var downloadBtn   = document.getElementById('download-xlsx-btn');
  var currentInstance = null;
  var sheetsData      = [];
  var sheetNames      = [];
  var zoomLevel       = 1.0;

  function _applyZoom() {
    var el = document.getElementById('excel-container');
    if (!el) return;
    el.style.zoom = zoomLevel;
    var zBtn = document.querySelector('[data-action="zoom-reset"]');
    if (zBtn) zBtn.textContent = Math.round(zoomLevel * 100) + '%';
  }

  function _stepZoom(delta) {
    zoomLevel = Math.min(2.0, Math.max(0.5, Math.round((zoomLevel + delta) * 10) / 10));
    _applyZoom();
  }

  var EMPTY_CENTER_HTML =
    '<div class="center-empty">'
    + '<div class="center-empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>'
    + '<div class="center-empty-heading">Select a source file to view</div>'
    + '<div class="center-empty-sub">Choose a file from the Sources panel to open it in the spreadsheet editor</div>'
    + '</div>';

  // ── Close ────────────────────────────────────────────────────
  state.closeFile = function(fileName) {
    if (fileName && state.excelState.fileName !== fileName) return;
    if (currentInstance) { try { currentInstance.destroy(false); } catch(ex) {} currentInstance = null; }
    sheetsData = []; sheetNames = []; _currentSheetIdx = 0; _allSheetFormats = [];
    state.excelState.instance = null;
    state.excelState.workbook  = null;
    state.excelState.fileName  = null;
    downloadBtn.style.display  = 'none';
    headerBadge.textContent    = '';
    panelBody.className        = 'panel-body';
    panelBody.style.display    = 'flex';
    panelBody.style.alignItems = 'center';
    panelBody.style.justifyContent = 'center';
    panelBody.innerHTML        = EMPTY_CENTER_HTML;
  };

  // ── Download ─────────────────────────────────────────────────
  downloadBtn.addEventListener('click', function() {
    if (!currentInstance) return;
    // Use source data (preserves formulas) for current sheet
    sheetsData[_currentSheetIdx] = currentInstance.getSourceData
      ? currentInstance.getSourceData().map(function(r) { return r.slice(); })
      : currentInstance.getData();
    var wb = XLSX.utils.book_new();
    for (var i = 0; i < sheetsData.length; i++) {
      var ws = XLSX.utils.aoa_to_sheet(sheetsData[i]);
      XLSX.utils.book_append_sheet(wb, ws, sheetNames[i] || ('Sheet' + (i+1)));
    }
    var arr  = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    var blob = new Blob([arr], { type:'application/octet-stream' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = state.excelState.fileName || 'export.xlsx';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  });

  // ── Open file ────────────────────────────────────────────────
  state.openFile = function(fileObj) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var data     = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type:'array', cellStyles:true });

      if (currentInstance) { try { currentInstance.destroy(false); } catch(ex) {} currentInstance = null; }
      sheetsData = []; sheetNames = workbook.SheetNames.slice();
      _currentSheetIdx = 0; _allSheetFormats = []; _allSheetMerges = []; _allSheetColWidths = [];
      zoomLevel = 1.0;

      sheetNames.forEach(function(sheetName, sheetIdx) {
        var ws = workbook.Sheets[sheetName];
        if (!ws || !ws['!ref']) {
          sheetsData.push([new Array(10).fill('')]);
          _allSheetMerges.push([]);
          _allSheetColWidths.push(new Array(10).fill(100));
          return;
        }
        var range   = XLSX.utils.decode_range(ws['!ref']);
        var maxCols = Math.max(range.e.c + 1, 10);
        var maxRows = range.e.r + 1;

        // ── Data: use cell.w (Excel-formatted string) when available ──
        var processed = [];
        for (var R = 0; R < maxRows; R++) {
          var row = [];
          for (var C = 0; C < maxCols; C++) {
            var cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
            var cell = ws[cellAddr];
            if (!cell) { row.push(''); continue; }
            var val = (cell.w !== undefined && cell.w !== '')
              ? cell.w
              : (cell.v !== undefined && cell.v !== null ? cell.v : '');
            row.push(val);
          }
          processed.push(row);
        }
        while (processed.length < 50) {
          processed.push(new Array(maxCols).fill(''));
        }
        sheetsData.push(processed);

        // ── Cell styles ───────────────────────────────────────────────
        if (!_allSheetFormats[sheetIdx]) _allSheetFormats[sheetIdx] = {};
        for (var SR = 0; SR <= range.e.r; SR++) {
          for (var SC = 0; SC <= range.e.c; SC++) {
            var sAddr = XLSX.utils.encode_cell({ r: SR, c: SC });
            var scell = ws[sAddr];
            if (!scell || !scell.s) continue;
            var s = scell.s;
            var fmt = {};
            if (s.font) {
              if (s.font.bold)    fmt.bold    = true;
              if (s.font.italic)  fmt.italic  = true;
              if (s.font.underline) fmt.underline = true;
              if (s.font.color && s.font.color.rgb) {
                var fc = argbToCss(s.font.color.rgb);
                if (fc && fc.toUpperCase() !== '#000000') fmt.color = fc;
              }
            }
            if (s.fill && s.fill.fgColor && s.fill.fgColor.rgb) {
              var bgHex = argbToCss(s.fill.fgColor.rgb);
              // Skip white — it's the default background
              if (bgHex && bgHex.toUpperCase() !== '#FFFFFF') fmt.bgColor = bgHex;
            }
            if (s.alignment) {
              if (s.alignment.horizontal) fmt.align = s.alignment.horizontal;
              if (s.alignment.wrapText)   fmt.wrapText = true;
            }
            if (Object.keys(fmt).length > 0) setFmt(sheetIdx, SR, SC, fmt);
          }
        }

        // ── Merged cells ──────────────────────────────────────────────
        var merges = [];
        if (ws['!merges']) {
          ws['!merges'].forEach(function(m) {
            merges.push({ row: m.s.r, col: m.s.c,
              rowspan: m.e.r - m.s.r + 1, colspan: m.e.c - m.s.c + 1 });
          });
        }
        _allSheetMerges.push(merges);

        // ── Column widths ─────────────────────────────────────────────
        var colWidths = [];
        var cols = ws['!cols'] || [];
        for (var CW = 0; CW < maxCols; CW++) {
          var ci = cols[CW];
          if (ci && ci.wpx) colWidths.push(Math.max(40, ci.wpx));
          else if (ci && ci.wch) colWidths.push(Math.max(40, Math.round(ci.wch * 7)));
          else colWidths.push(100);
        }
        _allSheetColWidths.push(colWidths);
      });

      // Build panel
      panelBody.innerHTML = '';
      panelBody.className = 'panel-body has-spreadsheet';
      panelBody.style.cssText = '';

      var toolbar    = _buildToolbar();
      var formulaBar = _buildFormulaBar();
      var container  = document.createElement('div');
      container.id   = 'excel-container';
      var tabsEl     = _buildSheetTabs();

      panelBody.appendChild(toolbar);
      panelBody.appendChild(formulaBar);
      panelBody.appendChild(container);
      panelBody.appendChild(tabsEl);

      // Handsontable config
      var htConfig = {
        data:               sheetsData[0],
        rowHeaders:         true,
        colHeaders:         true,
        width:              '100%',
        height:             '100%',
        licenseKey:         'non-commercial-and-evaluation',
        colWidths:          _allSheetColWidths[0] || 100,
        manualColumnResize: true,
        manualRowResize:    true,
        contextMenu:        true,
        columnSorting:      true,
        hiddenRows:         { indicators: false },
        fixedRowsTop:       1,
        stretchH:           'none',
        fillHandle:         true,
        mergeCells:         _allSheetMerges[0] || [],
        search:             true,
        customBorders:      true,
        renderer:           'fmtRenderer',
        afterSelectionEnd: function(r, c) {
          _updateFormulaBar(r, c);
          _updateToolbarState(r, c);
        },
        afterChange: function(changes) {
          if (!changes) return;
          var sel = currentInstance.getSelectedLast();
          if (sel) _updateFormulaBar(sel[0], sel[1]);
        },
      };

      // HyperFormula formula engine (if available)
      if (typeof HyperFormula !== 'undefined') {
        htConfig.formulas = { engine: HyperFormula };
      }

      currentInstance = new Handsontable(container, htConfig);

      // Sync Handsontable height to actual container size after layout
      requestAnimationFrame(function() {
        if (currentInstance && container.offsetHeight > 0) {
          currentInstance.updateSettings({ height: container.offsetHeight });
        }
      });

      // Update on window resize
      var resizeTimer;
      var onResize = function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
          if (currentInstance && container.offsetHeight > 0) {
            currentInstance.updateSettings({ height: container.offsetHeight });
          }
        }, 100);
      };
      window.addEventListener('resize', onResize);

      state.excelState.instance  = currentInstance;
      state.excelState.workbook  = workbook;
      state.excelState.fileName  = fileObj.name;

      // Expose formatting API for ai-operations
      state.excelState.setFmt = function(row, col, props) {
        setFmt(_currentSheetIdx, row, col, props);
      };
      state.excelState.getFmt = function(row, col) {
        return getFmt(_currentSheetIdx, row, col);
      };
      state.excelState.renderFmt = function() {
        currentInstance && currentInstance.render();
      };

      downloadBtn.style.display = 'flex';
      var name = fileObj.name;
      headerBadge.textContent = name.length > 20 ? name.slice(0,17) + '\u2026' : name;

      // Trackpad pinch-to-zoom on the excel area only
      container.addEventListener('wheel', function(e) {
        if (!e.ctrlKey) return;
        e.preventDefault();
        _stepZoom(e.deltaY < 0 ? +0.1 : -0.1);
      }, { passive: false });

      _wireToolbar(toolbar, formulaBar);
      _wireKeyboardShortcuts();
    };
    reader.readAsArrayBuffer(fileObj);
  };

  // ── Build toolbar HTML ────────────────────────────────────────
  function _buildToolbar() {
    var t = document.createElement('div');
    t.className = 'xt-toolbar';
    t.innerHTML =
      // Undo / Redo
      '<button class="xt-toolbar-btn" data-action="undo" title="Undo (Ctrl+Z)">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>'
      + '</button>'
      + '<button class="xt-toolbar-btn" data-action="redo" title="Redo (Ctrl+Y)">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13"/></svg>'
      + '</button>'
      + '<div class="xt-toolbar-sep"></div>'
      // Bold / Italic / Underline
      + '<button class="xt-toolbar-btn" data-action="bold" data-fmt="bold" title="Bold (Ctrl+B)" style="font-weight:700;font-size:13px;">B</button>'
      + '<button class="xt-toolbar-btn" data-action="italic" data-fmt="italic" title="Italic (Ctrl+I)" style="font-style:italic;font-size:13px;">I</button>'
      + '<button class="xt-toolbar-btn" data-action="underline" data-fmt="underline" title="Underline (Ctrl+U)" style="text-decoration:underline;font-size:13px;">U</button>'
      + '<div class="xt-toolbar-sep"></div>'
      // Text / Fill color
      + '<button class="xt-toolbar-btn xt-btn-textcolor" data-action="color-text" title="Text Color" style="flex-direction:column;gap:1px;">'
        + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>'
        + '<div class="xt-color-bar" id="xt-bar-text" style="background:#111;"></div>'
      + '</button>'
      + '<button class="xt-toolbar-btn xt-btn-fillcolor" data-action="color-fill" title="Fill Color" style="flex-direction:column;gap:1px;">'
        + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 11L7.83 0l-1.41 1.41L8.83 4 3 9.83a2 2 0 000 2.83L8.83 18.5a2 2 0 002.83 0l7.34-7.5z"/><path d="M17 13s-2 2.5-2 4c0 1.1.9 2 2 2s2-.9 2-2c0-1.5-2-4-2-4z"/></svg>'
        + '<div class="xt-color-bar" id="xt-bar-fill" style="background:#ffff00;"></div>'
      + '</button>'
      + '<div class="xt-toolbar-sep"></div>'
      // Alignment
      + '<button class="xt-toolbar-btn" data-action="align-left" data-fmt="align-left" title="Align Left">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>'
      + '</button>'
      + '<button class="xt-toolbar-btn" data-action="align-center" data-fmt="align-center" title="Center">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>'
      + '</button>'
      + '<button class="xt-toolbar-btn" data-action="align-right" data-fmt="align-right" title="Align Right">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>'
      + '</button>'
      + '<div class="xt-toolbar-sep"></div>'
      // Merge / Wrap
      + '<button class="xt-toolbar-btn" data-action="merge" title="Merge Cells">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="12"/></svg>'
        + '<span style="font-size:9px;margin-left:1px;">Merge</span>'
      + '</button>'
      + '<button class="xt-toolbar-btn" data-action="wrap" data-fmt="wrap" title="Wrap Text">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><path d="M3 12h15a3 3 0 010 6h-4"/><polyline points="14 15 11 18 14 21"/></svg>'
      + '</button>'
      + '<div class="xt-toolbar-sep"></div>'
      // Number format
      + '<select class="xt-toolbar-select" data-action="num-format" title="Number Format">'
        + '<option value="">General</option>'
        + '<option value="number">Number</option>'
        + '<option value="currency">Currency ($)</option>'
        + '<option value="percent">Percent (%)</option>'
        + '<option value="date">Date</option>'
      + '</select>'
      + '<div class="xt-toolbar-sep"></div>'
      // Row/col insert/delete
      + '<button class="xt-toolbar-btn" data-action="insert-row" title="Insert Row Above">'
        + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
        + '<span style="font-size:9px;">Row</span>'
      + '</button>'
      + '<button class="xt-toolbar-btn" data-action="insert-col" title="Insert Column Left">'
        + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
        + '<span style="font-size:9px;">Col</span>'
      + '</button>'
      + '<button class="xt-toolbar-btn" data-action="delete-row" title="Delete Selected Row(s)" style="color:#c00;">'
        + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2"/></svg>'
        + '<span style="font-size:9px;">Del Row</span>'
      + '</button>'
      + '<div class="xt-toolbar-sep"></div>'
      // Freeze / Find
      + '<button class="xt-toolbar-btn" data-action="freeze" data-fmt="freeze" title="Toggle Freeze First Row">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="4" x2="21" y2="4"/><line x1="7" y1="8" x2="7" y2="20"/></svg>'
      + '</button>'
      + '<button class="xt-toolbar-btn" data-action="find" title="Find & Replace (Ctrl+F)">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      + '</button>'
      + '<div class="xt-toolbar-sep"></div>'
      // Zoom
      + '<button class="xt-toolbar-btn" data-action="zoom-out" title="Zoom Out">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      + '</button>'
      + '<button class="xt-toolbar-btn xt-zoom-level" data-action="zoom-reset" title="Reset Zoom">100%</button>'
      + '<button class="xt-toolbar-btn" data-action="zoom-in" title="Zoom In">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      + '</button>';
    return t;
  }

  // ── Formula bar ───────────────────────────────────────────────
  function _buildFormulaBar() {
    var fb = document.createElement('div');
    fb.className = 'xt-formula-bar';
    fb.innerHTML =
      '<div class="xt-cell-ref" id="xt-cell-ref">A1</div>'
      + '<div class="xt-formula-sep"></div>'
      + '<span style="font-size:11px;color:#999;padding:0 6px;font-family:Inter,sans-serif;flex-shrink:0;font-style:italic;">fx</span>'
      + '<input class="xt-formula-input" id="xt-formula-input" placeholder="Cell value or formula (=SUM, =IF, …)" />';
    return fb;
  }

  // ── Sheet tabs ────────────────────────────────────────────────
  function _buildSheetTabs() {
    var tabsEl = document.createElement('div');
    tabsEl.className = 'sheet-tabs';
    sheetNames.forEach(function(name, idx) {
      var btn = document.createElement('button');
      btn.className = 'sheet-tab-btn' + (idx === 0 ? ' active' : '');
      btn.textContent = name;
      btn.addEventListener('click', function() {
        if (idx === _currentSheetIdx) return;
        sheetsData[_currentSheetIdx] = currentInstance.getSourceData
          ? currentInstance.getSourceData().map(function(r) { return r.slice(); })
          : currentInstance.getData();
        _currentSheetIdx = idx;
        currentInstance.updateSettings({
          mergeCells: _allSheetMerges[idx] || [],
          colWidths:  _allSheetColWidths[idx] || 100,
        });
        currentInstance.loadData(sheetsData[idx]);
        tabsEl.querySelectorAll('.sheet-tab-btn').forEach(function(b, i) {
          b.classList.toggle('active', i === idx);
        });
        state.excelState.instance = currentInstance;
      });
      tabsEl.appendChild(btn);
    });
    return tabsEl;
  }

  // ── Formula bar update ────────────────────────────────────────
  function _updateFormulaBar(row, col) {
    var refEl = document.getElementById('xt-cell-ref');
    var inp   = document.getElementById('xt-formula-input');
    if (!refEl || !inp || !currentInstance) return;
    refEl.textContent = colLetter(col) + (row + 1);
    var raw = currentInstance.getSourceDataAtCell
      ? currentInstance.getSourceDataAtCell(row, col)
      : currentInstance.getDataAtCell(row, col);
    inp.value = (raw === null || raw === undefined) ? '' : String(raw);
  }

  // ── Toolbar active-state update ───────────────────────────────
  function _updateToolbarState(row, col) {
    var fmt = getFmt(_currentSheetIdx, row, col);
    document.querySelectorAll('.xt-toolbar-btn[data-fmt]').forEach(function(btn) {
      var k = btn.dataset.fmt;
      var on = false;
      if (k === 'bold')         on = !!fmt.bold;
      else if (k === 'italic')  on = !!fmt.italic;
      else if (k === 'underline') on = !!fmt.underline;
      else if (k === 'wrap')    on = !!fmt.wrapText;
      else if (k === 'align-left')   on = fmt.align === 'left';
      else if (k === 'align-center') on = fmt.align === 'center';
      else if (k === 'align-right')  on = fmt.align === 'right';
      else if (k === 'freeze')  on = currentInstance && currentInstance.getSettings().fixedRowsTop > 0;
      btn.classList.toggle('active', on);
    });
    var sel = document.querySelector('[data-action="num-format"]');
    if (sel) sel.value = fmt.numFormat || '';
  }

  // ── Selection helpers ─────────────────────────────────────────
  function _getRange() {
    if (!currentInstance) return null;
    var sel = currentInstance.getSelectedRange();
    return sel && sel.length ? sel[0] : null;
  }

  function _applyFmt(props) {
    var rng = _getRange();
    if (!rng) return;
    var r1 = Math.min(rng.from.row, rng.to.row),   r2 = Math.max(rng.from.row, rng.to.row);
    var c1 = Math.min(rng.from.col, rng.to.col),   c2 = Math.max(rng.from.col, rng.to.col);
    for (var r = r1; r <= r2; r++)
      for (var c = c1; c <= c2; c++)
        setFmt(_currentSheetIdx, r, c, props);
    currentInstance.render();
    _updateToolbarState(rng.from.row, rng.from.col);
  }

  function _toggleFmt(key) {
    var rng = _getRange();
    if (!rng) return;
    var current = getFmt(_currentSheetIdx, rng.from.row, rng.from.col)[key];
    var p = {}; p[key] = !current;
    _applyFmt(p);
  }

  // ── Colour picker ─────────────────────────────────────────────
  function _showColorPicker(anchorBtn, onPick) {
    document.querySelectorAll('.xt-color-dropdown,.xt-color-overlay').forEach(function(el) { el.remove(); });
    var dd = document.createElement('div');
    dd.className = 'xt-color-dropdown';
    COLORS.forEach(function(c) {
      var sw = document.createElement('div');
      sw.className = 'xt-color-swatch';
      sw.style.backgroundColor = c;
      sw.title = c;
      sw.addEventListener('mousedown', function(e) {
        e.preventDefault();
        onPick(c);
        dd.remove(); ov.remove();
      });
      dd.appendChild(sw);
    });
    var ov = document.createElement('div');
    ov.className = 'xt-color-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9998;';
    ov.addEventListener('mousedown', function() { dd.remove(); ov.remove(); });
    anchorBtn.appendChild(dd);
    document.body.appendChild(ov);
  }

  // ── Find & Replace modal ──────────────────────────────────────
  function _showFindModal() {
    if (document.querySelector('.xt-find-modal')) return;
    var ov  = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:99998;';
    var md  = document.createElement('div');
    md.className = 'xt-find-modal';
    md.innerHTML =
      '<h3>Find &amp; Replace</h3>'
      + '<label>Find</label><input id="xt-find-q" placeholder="Search…" />'
      + '<label>Replace with</label><input id="xt-find-r" placeholder="Replacement…" />'
      + '<div class="xt-find-modal-btns">'
        + '<button class="primary" id="xt-find-next">Find Next</button>'
        + '<button id="xt-replace-all">Replace All</button>'
        + '<button id="xt-find-close">Close</button>'
      + '</div>'
      + '<div class="xt-find-status" id="xt-find-status"></div>';
    document.body.appendChild(ov);
    document.body.appendChild(md);
    md.querySelector('#xt-find-q').focus();

    var lastIdx = -1;
    md.querySelector('#xt-find-next').addEventListener('click', function() {
      var q = md.querySelector('#xt-find-q').value;
      if (!q || !currentInstance) return;
      var plugin  = currentInstance.getPlugin('search');
      var results = plugin.query(q);
      if (!results || !results.length) {
        md.querySelector('#xt-find-status').textContent = 'Not found.'; return;
      }
      lastIdx = (lastIdx + 1) % results.length;
      currentInstance.selectCell(results[lastIdx].row, results[lastIdx].col);
      md.querySelector('#xt-find-status').textContent = (lastIdx+1) + ' of ' + results.length;
    });

    md.querySelector('#xt-replace-all').addEventListener('click', function() {
      var q = md.querySelector('#xt-find-q').value;
      var r = md.querySelector('#xt-find-r').value;
      if (!q || !currentInstance) return;
      var data = currentInstance.getData();
      var changes = [];
      for (var row = 0; row < data.length; row++)
        for (var col = 0; col < data[row].length; col++) {
          var v = String(data[row][col] || '');
          if (v.includes(q)) changes.push([row, col, v, v.split(q).join(r)]);
        }
      if (changes.length) currentInstance.setDataAtCell(changes.map(function(c) { return [c[0],c[1],c[3]]; }));
      md.querySelector('#xt-find-status').textContent = changes.length + ' replacement(s) made.';
    });

    var close = function() { ov.remove(); md.remove(); };
    md.querySelector('#xt-find-close').addEventListener('click', close);
    ov.addEventListener('click', close);
    function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } }
    document.addEventListener('keydown', esc);
  }

  // ── Wire toolbar events ───────────────────────────────────────
  function _wireToolbar(toolbar, formulaBar) {
    var fxInput = formulaBar.querySelector('#xt-formula-input');
    var lastTextColor = '#111111';
    var lastFillColor = '#ffff00';

    fxInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var rng = _getRange();
        if (!rng || !currentInstance) return;
        currentInstance.setDataAtCell(rng.from.row, rng.from.col, fxInput.value);
        currentInstance.selectCell(rng.from.row + 1, rng.from.col);
      }
      if (e.key === 'Escape') {
        var rng2 = _getRange();
        if (rng2) _updateFormulaBar(rng2.from.row, rng2.from.col);
        currentInstance && currentInstance.getActiveEditor() && currentInstance.getActiveEditor().focus();
      }
    });

    toolbar.addEventListener('click', function(e) {
      var btn = e.target.closest('.xt-toolbar-btn');
      if (!btn || !currentInstance) return;
      var action = btn.dataset.action;
      switch (action) {
        case 'undo':          currentInstance.undo();           break;
        case 'redo':          currentInstance.redo();           break;
        case 'bold':          _toggleFmt('bold');               break;
        case 'italic':        _toggleFmt('italic');             break;
        case 'underline':     _toggleFmt('underline');          break;
        case 'wrap':          _toggleFmt('wrapText');           break;
        case 'align-left':    _applyFmt({ align: 'left' });     break;
        case 'align-center':  _applyFmt({ align: 'center' });   break;
        case 'align-right':   _applyFmt({ align: 'right' });    break;
        case 'color-text':
          _showColorPicker(btn, function(c) {
            lastTextColor = c;
            document.getElementById('xt-bar-text').style.background = c;
            _applyFmt({ color: c });
          }); break;
        case 'color-fill':
          _showColorPicker(btn, function(c) {
            lastFillColor = c;
            document.getElementById('xt-bar-fill').style.background = c;
            _applyFmt({ bgColor: c });
          }); break;
        case 'merge': {
          var rng = _getRange();
          if (rng) {
            var merges = (currentInstance.getSettings().mergeCells || []).filter(Array.isArray ? function(x) { return true; } : function(x) { return true; });
            if (!Array.isArray(merges)) merges = [];
            merges.push({
              row:     Math.min(rng.from.row, rng.to.row),
              col:     Math.min(rng.from.col, rng.to.col),
              rowspan: Math.abs(rng.to.row - rng.from.row) + 1,
              colspan: Math.abs(rng.to.col - rng.from.col) + 1,
            });
            currentInstance.updateSettings({ mergeCells: merges });
          }
          break;
        }
        case 'insert-row': {
          var rng = _getRange();
          if (rng) currentInstance.alter('insert_row_above', rng.from.row, 1);
          break;
        }
        case 'insert-col': {
          var rng = _getRange();
          if (rng) currentInstance.alter('insert_col_start', rng.from.col, 1);
          break;
        }
        case 'delete-row': {
          var rng = _getRange();
          if (rng) currentInstance.alter('remove_row', rng.from.row, Math.abs(rng.to.row - rng.from.row) + 1);
          break;
        }
        case 'freeze': {
          var cur = currentInstance.getSettings().fixedRowsTop || 0;
          currentInstance.updateSettings({ fixedRowsTop: cur > 0 ? 0 : 1 });
          var rng3 = _getRange();
          if (rng3) _updateToolbarState(rng3.from.row, rng3.from.col);
          break;
        }
        case 'find':       _showFindModal();  break;
        case 'zoom-in':    _stepZoom(+0.1);   break;
        case 'zoom-out':   _stepZoom(-0.1);   break;
        case 'zoom-reset': zoomLevel = 1.0; _applyZoom(); break;
      }
    });

    // Number format select
    toolbar.querySelector('[data-action="num-format"]').addEventListener('change', function(e) {
      _applyFmt({ numFormat: e.target.value || null });
    });
  }

  // ── Keyboard shortcuts ────────────────────────────────────────
  var _shortcutsWired = false;
  function _wireKeyboardShortcuts() {
    if (_shortcutsWired) return;
    _shortcutsWired = true;
    document.addEventListener('keydown', function(e) {
      if (!currentInstance) return;
      var isMac = /Mac|iPhone|iPad/.test(navigator.platform);
      var ctrl  = isMac ? e.metaKey : e.ctrlKey;
      if (!ctrl) return;
      var focus = document.activeElement;
      var inSheet = focus && (focus.closest('#excel-container') || focus.id === 'xt-formula-input');
      if (!inSheet) return;
      var key = e.key.toLowerCase();
      if (key === 'b') { e.preventDefault(); _toggleFmt('bold'); }
      if (key === 'i') { e.preventDefault(); _toggleFmt('italic'); }
      if (key === 'u') { e.preventDefault(); _toggleFmt('underline'); }
      if (key === 'f') { e.preventDefault(); _showFindModal(); }
    });
  }
}

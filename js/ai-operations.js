// ── AI Spreadsheet Operations (Group 1) ─────────────────
// OWNERSHIP: Group 1 owns this file and chat.js.
//
// This module intercepts chat messages that are spreadsheet commands
// (add/remove columns, merge rows, filter, aggregate, fill, layout changes)
// and applies them to the active spreadsheet via state.excelState.instance.
//
// Interface contract:
//   - Register state.chatCommandHandler = async (userText) => boolean
//   - Return true if handled, false to fall through to normal chat
//   - Use state.excelState.instance (Jspreadsheet CE API) for mutations
//   - Use state.addMessage(text, 'ai') to post results to chat
//   - Use state.apiKey for Anthropic API calls if needed
//   - Use state.conversationHistory for context

import { state } from './state.js';

// ── System Prompt ─────────────────────

var SYSTEM_PROMPT = 'You are a spreadsheet command parser. Given a user message and a list of column headers, return ONLY a JSON object (no other text, no markdown fences).\n\nSupported operations:\n{"op":"add_column","name":"<header>","position":<0-based index or null for end>}\n{"op":"remove_column","name":"<header>"}\n{"op":"rename_column","from":"<old>","to":"<new>"}\n{"op":"apply_formula","column":"<header>","formula":"<e.g. =A{row}+B{row}>"}\n{"op":"sort_rows","column":"<header>","direction":"asc|desc"}\n{"op":"filter_rows","column":"<header>","operator":">|<|>=|<=|=|!=|contains","value":"<val>"}\n{"op":"remove_empty_rows"}\n{"op":"aggregate","column":"<header>","func":"sum|average|count|min|max"}\n{"op":"find_duplicates","column":"<header>"}\n{"op":"show_all_rows"}\n{"op":"export"}\n{"op":"save_record"}\n{"op":"show_dashboard"}\n{"op":"suggest_template"}\n{"op":"consolidate_to_template"}\n{"op":"dynamic_report"}\n{"op":"format_cells","column":"<header or null>","row":<1-based or null>,"props":{"bold":true,"italic":true,"underline":true,"color":"#hex","bgColor":"#hex","align":"left|center|right","numFormat":"number|currency|percent|date","wrapText":true}}\n{"op":"conditional_format","column":"<header>","operator":">|<|>=|<=|=|!=|contains","value":"<val>","props":{"bgColor":"#hex","color":"#hex","bold":true}}\n{"op":"add_row","count":<number>,"position":<0-based or null for end>}\n{"op":"highlight_column","column":"<header>","bgColor":"#hex"}\n{"op":"clear_format","column":"<header or null>"}\n\nNotes:\n- format_cells: bold/italic/color/bgColor/align/numFormat. column=null means whole-sheet context. row=null means all data rows of that column.\n- conditional_format: apply bgColor/color/bold to rows where column matches condition.\n- highlight_column: fill entire column header+data with bgColor.\n- clear_format: remove all custom formatting from a column or entire sheet.\n- aggregate supports min and max in addition to sum/average/count.\n- show_all_rows: "show all","clear filter","unfilter".\n- export: "download","save as xlsx".\n- save_record: "save this","save record".\n- show_dashboard: "open dashboard","my records".\n- suggest_template: "suggest template","what columns".\n- consolidate_to_template: "fill template", "populate template", "consolidate into template", "map sources to template", "fill in from sources", "fill it out".\n- dynamic_report: "create a report", "show me a summary of", "build a X report", "make a X tracker", "give me cost analysis", "generate a risk register", "analyze sources". Use for any open-ended build/create/analyze/generate request that is not a simple cell-level edit.\n\nIf NOT a spreadsheet command return: {"op":null}';

// ── Dynamic Report Plan Prompt ─────────────────────

var DYNAMIC_PLAN_PROMPT = 'You are an expert construction PM data analyst. Given source file data and a user request, design the optimal spreadsheet report structure.\n\nReturn ONLY a JSON object (no other text, no markdown fences) in this exact format:\n{"title":"Report Title","columns":[{"name":"Column Name","source_field":"exact source column name or null","type":"text|number|date|currency|percent"}]}\n\nRules:\n- Design columns specifically for the user\'s query — not generic PM defaults\n- Match source_field exactly to source column names when a clear match exists, otherwise null\n- Include 6-16 columns total\n- title should be concise and descriptive of the specific report requested\n- type should reflect how the data will be used (currency for money, percent for rates, date for dates, number for counts, text for everything else)';

// ── Handsontable helpers (row 0 = header row) ────────────

function getHeaders() {
  return state.excelState.instance.getDataAtRow(0);
}

function getDataRows() {
  return state.excelState.instance.getData().slice(1);
}

function dataRowToGridRow(i) { return i + 1; }

// ── Selected Sources Snapshot ─────────────────────

async function getSelectedSourcesSnapshot() {
  var checkboxes = document.querySelectorAll('.source-check:checked');
  if (!checkboxes.length) return null;

  var fileRefs = [];
  for (var i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i]._fileRef) fileRefs.push(checkboxes[i]._fileRef);
  }
  if (!fileRefs.length) return null;

  var infos = await Promise.all(fileRefs.map(function(file) {
    return file.arrayBuffer().then(function(buf) {
      try {
        var wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
        var headers = (aoa[0] || []).filter(function(h) { return h !== '' && h !== null && h !== undefined; });
        var dataRows = aoa.slice(1);
        return { name: file.name, headers: headers, dataRows: dataRows };
      } catch(e) {
        return { name: file.name, headers: [], dataRows: [] };
      }
    });
  }));

  var lines = ['Selected source files (' + infos.length + '):'];
  infos.forEach(function(info) {
    lines.push('\nFile: ' + info.name);
    if (!info.headers.length) { lines.push('  (no headers found)'); return; }
    lines.push('  Columns: ' + info.headers.join(', '));
    if (info.dataRows.length) {
      lines.push('  Sample data:');
      info.dataRows.forEach(function(row) {
        var cells = info.headers.map(function(h, i) {
          var v = row[i];
          return h + ': ' + (v !== null && v !== undefined ? String(v).slice(0, 60) : '');
        });
        lines.push('    { ' + cells.join(', ') + ' }');
      });
    }
  });
  return lines.join('\n');
}

// ── Spreadsheet Snapshot ─────────────────────

function getSpreadsheetSnapshot() {
  if (!state.excelState.instance) return null;
  var headers = getHeaders();
  var allData = getDataRows();
  var ROW_CAP = 150;
  var rows = allData.length > ROW_CAP ? allData.slice(0, ROW_CAP) : allData;
  var truncated = allData.length > ROW_CAP;

  var lines = [];
  lines.push('Current spreadsheet (' + allData.length + ' rows' + (truncated ? ', showing first ' + ROW_CAP : '') + '):');
  lines.push(headers.join('\t'));
  for (var i = 0; i < rows.length; i++) {
    lines.push(rows[i].map(function(cell) {
      return (cell === null || cell === undefined) ? '' : String(cell).slice(0, 80);
    }).join('\t'));
  }
  return lines.join('\n');
}

// ── Intent Parsing ─────────────────────

async function parseCommand(userText, headers) {
  var snapshot = getSpreadsheetSnapshot();
  var userContent = (snapshot ? snapshot + '\n\n' : 'Column headers: ' + JSON.stringify(headers) + '\n') + 'User command: ' + userText;

  var response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: state.abortSignal || undefined,
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4-5',
      max_tokens: 512,
      stream: false,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ]
    })
  });

  if (!response.ok) {
    throw new Error('API error ' + response.status);
  }

  var json = await response.json();
  var text = json.choices[0].message.content;

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Could not understand that command. Try something like "add a Total column" or "rename Status to Payment Status".');
  }
}

// ── Layout Detection ─────────────────────

async function detectFileLayout(aoa) {
  var sample = aoa.slice(0, 15).map(function(row) {
    return row.slice(0, 15).map(function(cell) {
      return (cell === null || cell === undefined) ? '' : String(cell);
    }).join('\t');
  }).join('\n');

  var response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4-5',
      max_tokens: 64,
      stream: false,
      messages: [
        { role: 'system', content: 'Return ONLY JSON describing the table layout.' },
        { role: 'user', content: 'Grid sample (TSV):\n' + sample + '\n\nReturn: {"orientation":"vertical","header_row":<0-based int>,"data_start_row":<0-based int>} for vertical, or {"orientation":"horizontal","header_col":<0-based int>,"data_start_col":<0-based int>} for horizontal.' }
      ]
    })
  });

  if (!response.ok) throw new Error('Layout detection API error ' + response.status);
  var json = await response.json();
  var text = json.choices[0].message.content.trim().replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(text);
}

// ── Consolidate Sources into Template ─────────────────────

async function executeConsolidateToTemplate(headers, thinkingBubble, userQuery) {
  var templateHeaders = headers.filter(function(h) { return h && String(h).trim(); });

  var checkboxes = document.querySelectorAll('.source-check:checked');
  if (!checkboxes.length) throw new Error('No source files selected. Check the boxes in the left panel.');

  var fileRefs = [];
  for (var i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i]._fileRef) fileRefs.push(checkboxes[i]._fileRef);
  }
  if (!fileRefs.length) throw new Error('No source files selected.');

  // If no template headers, auto-generate them from source files
  if (!templateHeaders.length) {
    thinkingBubble.textContent = 'Analyzing source files to generate template headers…';
    var sourceSnapshot = await getSelectedSourcesSnapshot();
    var hdrUserContent, hdrSystemContent;
    if (userQuery) {
      hdrSystemContent = 'You are a construction PM expert. Return ONLY a JSON array of column header strings — no other text, no markdown.';
      hdrUserContent = (sourceSnapshot || '') + '\n\nUser request: ' + userQuery + '\n\nDesign a master template column list tailored to this specific request. Use the available source fields where relevant and add any standard construction PM fields needed to fulfill the request. Return 8-14 columns.';
    } else {
      hdrSystemContent = 'You are a construction PM expert. Return ONLY a JSON array of column header strings — no other text, no markdown.';
      hdrUserContent = (sourceSnapshot || '') + '\n\nCreate a master template column list that captures the most important daily report metrics from these source files. Include standard construction PM fields (Date, Subcontractor, Trade, Workers On Site, Work Completed, Issues/Delays, Weather, etc.) merged with any relevant columns from the sources. Return 8-14 columns.';
    }
    var hdrResponse = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'anthropic/claude-opus-4-5',
        max_tokens: 256,
        stream: false,
        messages: [
          { role: 'system', content: hdrSystemContent },
          { role: 'user', content: hdrUserContent }
        ]
      })
    });
    if (!hdrResponse.ok) throw new Error('Header generation API error ' + hdrResponse.status);
    var hdrJson = await hdrResponse.json();
    var hdrText = hdrJson.choices[0].message.content.trim().replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
    templateHeaders = JSON.parse(hdrText);
    // Write headers into row 0
    var instance = state.excelState.instance;
    for (var hi = 0; hi < templateHeaders.length; hi++) {
      instance.setDataAtCell(0, hi, templateHeaders[hi]);
    }
    thinkingBubble.textContent = 'Template headers set. Consolidating sources…';
  }

  var n = fileRefs.length;
  var outputRows = [];

  for (var i = 0; i < n; i++) {
    var file = fileRefs[i];

    thinkingBubble.textContent = 'Analyzing file ' + (i + 1) + ' of ' + n + ': ' + file.name + '\u2026';

    var buf = await file.arrayBuffer();
    var wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    var ws = wb.Sheets[wb.SheetNames[0]];
    var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });

    var layout = await detectFileLayout(aoa);

    var sourceHeaders, sourceDataRows;
    if (layout.orientation === 'horizontal') {
      var hCol = layout.header_col !== undefined ? layout.header_col : 0;
      var dCol = layout.data_start_col !== undefined ? layout.data_start_col : 1;
      sourceHeaders = aoa.map(function(row) { return row[hCol] !== undefined ? String(row[hCol]) : ''; });
      var rawData = aoa.map(function(row) { return row.slice(dCol); });
      sourceDataRows = rawData.length && rawData[0].length
        ? rawData[0].map(function(_, ci) { return rawData.map(function(row) { return row[ci] !== undefined ? row[ci] : ''; }); })
        : [];
    } else {
      var hRow = layout.header_row !== undefined ? layout.header_row : 0;
      var dRow = layout.data_start_row !== undefined ? layout.data_start_row : 1;
      sourceHeaders = (aoa[hRow] || []).map(function(h) { return h !== null && h !== undefined ? String(h) : ''; });
      sourceDataRows = aoa.slice(dRow);
    }

    thinkingBubble.textContent = 'Mapping file ' + (i + 1) + ' of ' + n + ': ' + file.name + '\u2026';

    var mappingResponse = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'anthropic/claude-opus-4-5',
        max_tokens: 256,
        stream: false,
        messages: [
          { role: 'system', content: 'Return ONLY a JSON object. Keys are template column names, values are the best matching source column name or null if no match.' },
          { role: 'user', content: 'Template columns: ' + JSON.stringify(templateHeaders) + '\nSource columns: ' + JSON.stringify(sourceHeaders) }
        ]
      })
    });

    if (!mappingResponse.ok) throw new Error('Mapping API error ' + mappingResponse.status);
    var mappingJson = await mappingResponse.json();
    var mappingText = mappingJson.choices[0].message.content.trim().replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
    var mapping = JSON.parse(mappingText);

    for (var r = 0; r < sourceDataRows.length; r++) {
      var sourceRow = sourceDataRows[r];
      var isEmpty = sourceRow.every(function(cell) { return cell === '' || cell === null || cell === undefined; });
      if (isEmpty) continue;
      var mappedRow = templateHeaders.map(function(col) {
        var srcCol = mapping[col];
        if (!srcCol) return '';
        var srcIdx = sourceHeaders.indexOf(srcCol);
        return srcIdx >= 0 && sourceRow[srcIdx] !== undefined ? sourceRow[srcIdx] : '';
      });
      outputRows.push(mappedRow);
    }
  }

  var finalAOA = [templateHeaders].concat(outputRows);
  state.excelState.instance.loadData(finalAOA);
  return 'Filled template with ' + outputRows.length + ' row(s) from ' + n + ' file(s).';
}

// ── Dynamic Report ─────────────────────

async function executeDynamicReport(userText, thinkingBubble) {
  // Phase 1 — Plan: design columns for this specific query
  thinkingBubble.textContent = 'Planning report structure…';
  var sourceSnapshot = await getSelectedSourcesSnapshot();

  var planResponse = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4-5',
      max_tokens: 1024,
      stream: false,
      messages: [
        { role: 'system', content: DYNAMIC_PLAN_PROMPT },
        { role: 'user', content: (sourceSnapshot ? sourceSnapshot + '\n\n' : '') + 'User request: ' + userText }
      ]
    })
  });

  if (!planResponse.ok) throw new Error('Plan API error ' + planResponse.status);
  var planJson = await planResponse.json();
  var planText = planJson.choices[0].message.content.trim().replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
  var plan = JSON.parse(planText);
  var planColumns = plan.columns || [];
  var templateHeaders = planColumns.map(function(c) { return c.name; });

  if (!templateHeaders.length) throw new Error('Could not design report columns. Try a more specific request.');

  // Write headers into the spreadsheet
  var instance = state.excelState.instance;
  for (var hi = 0; hi < templateHeaders.length; hi++) {
    instance.setDataAtCell(0, hi, templateHeaders[hi]);
  }

  // If no sources selected, just set up headers and return
  var checkboxes = document.querySelectorAll('.source-check:checked');
  if (!checkboxes.length) {
    return '"' + (plan.title || 'Report') + '" headers set (' + templateHeaders.length + ' columns). Select source files and run again to fill data.';
  }

  var fileRefs = [];
  for (var i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i]._fileRef) fileRefs.push(checkboxes[i]._fileRef);
  }
  if (!fileRefs.length) {
    return '"' + (plan.title || 'Report') + '" headers set (' + templateHeaders.length + ' columns). Select source files and run again to fill data.';
  }

  // Phase 2 — Build: detect layout + map each source file
  var n = fileRefs.length;
  var outputRows = [];

  // Build column list with source_field hints for the mapping prompt
  var templateColsWithHints = planColumns.map(function(c) {
    return c.name + (c.source_field ? ' [hint: "' + c.source_field + '"]' : '');
  });

  for (var i = 0; i < n; i++) {
    var file = fileRefs[i];
    thinkingBubble.textContent = 'Analyzing file ' + (i + 1) + ' of ' + n + ': ' + file.name + '\u2026';

    var buf = await file.arrayBuffer();
    var wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    var ws = wb.Sheets[wb.SheetNames[0]];
    var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });

    var layout = await detectFileLayout(aoa);

    var sourceHeaders, sourceDataRows;
    if (layout.orientation === 'horizontal') {
      var hCol = layout.header_col !== undefined ? layout.header_col : 0;
      var dCol = layout.data_start_col !== undefined ? layout.data_start_col : 1;
      sourceHeaders = aoa.map(function(row) { return row[hCol] !== undefined ? String(row[hCol]) : ''; });
      var rawData = aoa.map(function(row) { return row.slice(dCol); });
      sourceDataRows = rawData.length && rawData[0].length
        ? rawData[0].map(function(_, ci) { return rawData.map(function(row) { return row[ci] !== undefined ? row[ci] : ''; }); })
        : [];
    } else {
      var hRow = layout.header_row !== undefined ? layout.header_row : 0;
      var dRow = layout.data_start_row !== undefined ? layout.data_start_row : 1;
      sourceHeaders = (aoa[hRow] || []).map(function(h) { return h !== null && h !== undefined ? String(h) : ''; });
      sourceDataRows = aoa.slice(dRow);
    }

    thinkingBubble.textContent = 'Mapping file ' + (i + 1) + ' of ' + n + ': ' + file.name + '\u2026';

    var mappingResponse = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'anthropic/claude-opus-4-5',
        max_tokens: 512,
        stream: false,
        messages: [
          { role: 'system', content: 'Return ONLY a JSON object. Keys are template column names, values are the best matching source column name or null if no match. Hints in brackets are suggestions — use them if the source column matches.' },
          { role: 'user', content: 'Template columns: ' + JSON.stringify(templateColsWithHints) + '\nSource columns: ' + JSON.stringify(sourceHeaders) }
        ]
      })
    });

    if (!mappingResponse.ok) throw new Error('Mapping API error ' + mappingResponse.status);
    var mappingJson = await mappingResponse.json();
    var mappingText = mappingJson.choices[0].message.content.trim().replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
    var mapping = JSON.parse(mappingText);

    for (var r = 0; r < sourceDataRows.length; r++) {
      var sourceRow = sourceDataRows[r];
      var isEmpty = sourceRow.every(function(cell) { return cell === '' || cell === null || cell === undefined; });
      if (isEmpty) continue;
      var mappedRow = templateHeaders.map(function(col) {
        var srcCol = mapping[col];
        if (!srcCol) return '';
        var srcIdx = sourceHeaders.indexOf(srcCol);
        return srcIdx >= 0 && sourceRow[srcIdx] !== undefined ? sourceRow[srcIdx] : '';
      });
      outputRows.push(mappedRow);
    }
  }

  var finalAOA = [templateHeaders].concat(outputRows);
  state.excelState.instance.loadData(finalAOA);
  return '"' + (plan.title || 'Report') + '" built with ' + outputRows.length + ' row(s) from ' + n + ' file(s).';
}

// ── Operation Dispatch ─────────────────────

function findColumn(headers, name) {
  var idx = headers.indexOf(name);
  if (idx === -1) {
    throw new Error('Column "' + name + '" not found. Available columns: ' + headers.join(', '));
  }
  return idx;
}

function evaluateCondition(cellVal, operator, value) {
  var numCell = parseFloat(cellVal);
  var numVal = parseFloat(value);
  var bothNumeric = !isNaN(numCell) && !isNaN(numVal);
  switch (operator) {
    case '>': return bothNumeric && numCell > numVal;
    case '<': return bothNumeric && numCell < numVal;
    case '>=': return bothNumeric && numCell >= numVal;
    case '<=': return bothNumeric && numCell <= numVal;
    case '=': return String(cellVal) === String(value);
    case '!=': return String(cellVal) !== String(value);
    case 'contains': return String(cellVal).toLowerCase().indexOf(String(value).toLowerCase()) !== -1;
    default: return false;
  }
}

function executeOp(op, headers, thinkingBubble, userText) {
  switch (op.op) {
    case 'add_column':
      var instance = state.excelState.instance;
      var pos = op.position;
      // Find last non-empty header to avoid inserting off-screen
      var lastNonEmpty = -1;
      for (var hi = 0; hi < headers.length; hi++) {
        if (headers[hi] && headers[hi].trim()) lastNonEmpty = hi;
      }
      if (lastNonEmpty === -1) lastNonEmpty = 0;
      if (pos === null || pos === undefined || pos >= headers.length) {
        // Append after last meaningful column
        instance.alter('insert_col_end', lastNonEmpty, 1);
        instance.setDataAtCell(0, lastNonEmpty + 1, op.name);
      } else {
        // Insert before the specified position
        instance.alter('insert_col_start', pos, 1);
        instance.setDataAtCell(0, pos, op.name);
      }
      return 'Added column "' + op.name + '".';
    case 'remove_column':
      var idx = findColumn(headers, op.name);
      state.excelState.instance.alter('remove_col', idx, 1);
      return 'Removed column "' + op.name + '".';
    case 'rename_column':
      var idx = findColumn(headers, op.from);
      state.excelState.instance.setDataAtCell(0, idx, op.to);
      return 'Renamed "' + op.from + '" to "' + op.to + '".';
    case 'apply_formula':
      var idx = findColumn(headers, op.column);
      var data = getDataRows();
      for (var r = 0; r < data.length; r++) {
        var formula = op.formula.replace(/\{row\}/g, String(r + 1));
        state.excelState.instance.setDataAtCell(dataRowToGridRow(r), idx, formula);
      }
      return 'Applied formula to column "' + op.column + '" (' + data.length + ' rows).';
    case 'sort_rows':
      var idx = findColumn(headers, op.column);
      var desc = op.direction === 'desc' ? 1 : 0;
      state.excelState.instance.getPlugin('columnSorting').sort({ column: idx, sortOrder: desc ? 'desc' : 'asc' });
      return 'Sorted by "' + op.column + '" (' + (desc ? 'descending' : 'ascending') + ').';
    case 'filter_rows':
      var data = getDataRows();
      var colIdx = findColumn(headers, op.column);
      var hidden = 0;
      for (var r = 0; r < data.length; r++) {
        var cellVal = data[r][colIdx];
        var keep = evaluateCondition(cellVal, op.operator, op.value);
        if (!keep) {
          state.excelState.instance.getPlugin('hiddenRows').hideRow(dataRowToGridRow(r));
          hidden++;
        }
      }
      return 'Filtered: hiding ' + hidden + ' rows that do not match "' + op.column + ' ' + op.operator + ' ' + op.value + '".';
    case 'remove_empty_rows':
      var data = getDataRows();
      var deleted = 0;
      for (var r = data.length - 1; r >= 0; r--) {
        var isEmpty = data[r].every(function(cell) {
          return cell === '' || cell === null || cell === undefined;
        });
        if (isEmpty) {
          state.excelState.instance.alter('remove_row', dataRowToGridRow(r), 1);
          deleted++;
        }
      }
      return 'Removed ' + deleted + ' empty row' + (deleted !== 1 ? 's' : '') + '.';
    case 'aggregate':
      var data = getDataRows();
      var colIdx = findColumn(headers, op.column);
      var values = [];
      for (var r = 0; r < data.length; r++) {
        var v = parseFloat(data[r][colIdx]);
        if (!isNaN(v)) values.push(v);
      }
      var result;
      if (op.func === 'sum') {
        result = values.reduce(function(a, b) { return a + b; }, 0);
        return 'Sum of "' + op.column + '": ' + result;
      } else if (op.func === 'average') {
        result = values.length ? values.reduce(function(a, b) { return a + b; }, 0) / values.length : 0;
        return 'Average of "' + op.column + '": ' + result.toFixed(2);
      } else if (op.func === 'count') {
        return 'Count of numeric values in "' + op.column + '": ' + values.length;
      } else if (op.func === 'min') {
        result = values.length ? Math.min.apply(null, values) : 0;
        return 'Min of "' + op.column + '": ' + result;
      } else if (op.func === 'max') {
        result = values.length ? Math.max.apply(null, values) : 0;
        return 'Max of "' + op.column + '": ' + result;
      }
      throw new Error('Unknown aggregate function: ' + op.func);
    case 'find_duplicates':
      var data = getDataRows();
      var colIdx = findColumn(headers, op.column);
      var seen = {};
      for (var r = 0; r < data.length; r++) {
        var val = String(data[r][colIdx]).trim();
        if (!val) continue;
        if (!seen[val]) seen[val] = [];
        seen[val].push(r + 1);
      }
      var dupes = [];
      for (var val in seen) {
        if (seen[val].length > 1) dupes.push('"' + val + '" (rows ' + seen[val].join(', ') + ')');
      }
      if (dupes.length === 0) return 'No duplicates found in "' + op.column + '".';
      return 'Duplicates in "' + op.column + '":\n' + dupes.join('\n');
    case 'save_record':
      if (!state.saveMasterRecord) throw new Error('Master records not initialized.');
      var recData    = getDataRows();
      var recHeaders = getHeaders();
      var recDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      var recName = (state.excelState.fileName || 'Master Record') + ' \u2014 ' + recDate;
      // Build a synthetic File from current spreadsheet data
      var recAoA = [recHeaders].concat(recData);
      var recWb = XLSX.utils.book_new();
      var recWs = XLSX.utils.aoa_to_sheet(recAoA);
      XLSX.utils.book_append_sheet(recWb, recWs, 'Master');
      var recArr = XLSX.write(recWb, { bookType: 'xlsx', type: 'array' });
      var recBlob = new Blob([recArr], { type: 'application/octet-stream' });
      var recFile = new File([recBlob], recName + '.xlsx', { type: 'application/octet-stream' });
      state.saveMasterRecord({ name: recName, date: recDate, sourceCount: 1, rowCount: recData.length, fileObj: recFile });
      return 'Saved "' + recName + '" to master records.';
    case 'show_dashboard':
      if (!state.showDashboard) throw new Error('Dashboard not initialized.');
      state.showDashboard();
      return 'Opening master records dashboard\u2026';
    case 'suggest_template':
      return (async function() {
        var snapHeaders = getHeaders();
        var snapData = getSpreadsheetSnapshot();
        var selectedSources = await getSelectedSourcesSnapshot();
        var userContent = '';
        if (selectedSources) userContent += selectedSources + '\n\n';
        userContent += 'Current spreadsheet columns: ' + JSON.stringify(snapHeaders);
        if (snapData) userContent += '\n\nSample data:\n' + snapData.split('\n').slice(0, 6).join('\n');
        userContent += '\n\nRecommend a standard column schema for a construction PM master record that can consolidate all selected source files. Format your response as:\n**Keep:** [columns to keep]\n**Rename:** [old name \u2192 new name]\n**Add:** [missing columns that construction PMs need]\n**Remove:** [columns that add no value]';
        var r = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'anthropic/claude-opus-4-5',
            max_tokens: 1024,
            stream: false,
            messages: [
              { role: 'system', content: 'You are a construction project management expert. Analyze spreadsheet columns and recommend a standardized master record schema for construction subcontractor report consolidation. Be concise and actionable.' },
              { role: 'user', content: userContent }
            ]
          })
        });
        var j = await r.json();
        return j.choices[0].message.content;
      })();
    case 'show_all_rows':
      var data = getDataRows();
      for (var r = 0; r < data.length; r++) {
        state.excelState.instance.getPlugin('hiddenRows').showRow(dataRowToGridRow(r));
      }
      return 'Showing all rows — filter cleared.';
    case 'export':
      var btn = document.getElementById('download-xlsx-btn');
      if (!btn) throw new Error('Download button not found.');
      btn.click();
      return 'Downloading spreadsheet as .xlsx\u2026';

    case 'format_cells': {
      var ex = state.excelState;
      if (!ex.setFmt) throw new Error('Formatting API not available.');
      var data = state.excelState.instance.getData();
      var colIdx = op.column ? findColumn(headers, op.column) : null;
      var targetRows = [];
      if (op.row !== null && op.row !== undefined) {
        // 1-based row number from user → 0-based grid row
        targetRows = [op.row]; // row 1 = header = index 0, row 2 = data = index 1
      } else if (colIdx !== null) {
        for (var ri = 1; ri < data.length; ri++) targetRows.push(ri);
      } else {
        for (var ri = 0; ri < data.length; ri++) targetRows.push(ri);
      }
      var cols = colIdx !== null ? [colIdx] : Array.from({length: headers.length}, function(_, i) { return i; });
      targetRows.forEach(function(r) {
        cols.forEach(function(c) { ex.setFmt(r, c, op.props || {}); });
      });
      ex.renderFmt();
      var desc = op.column ? '"' + op.column + '"' : 'selection';
      return 'Formatted ' + desc + '.';
    }

    case 'conditional_format': {
      var ex = state.excelState;
      if (!ex.setFmt) throw new Error('Formatting API not available.');
      var data = getDataRows();
      var colIdx = findColumn(headers, op.column);
      var matched = 0;
      for (var ri = 0; ri < data.length; ri++) {
        if (evaluateCondition(data[ri][colIdx], op.operator, op.value)) {
          for (var ci = 0; ci < headers.length; ci++) {
            ex.setFmt(dataRowToGridRow(ri), ci, op.props || {});
          }
          matched++;
        }
      }
      ex.renderFmt();
      return 'Conditional format applied to ' + matched + ' row(s) where "' + op.column + '" ' + op.operator + ' ' + op.value + '.';
    }

    case 'add_row': {
      var count = op.count || 1;
      var pos   = (op.position !== null && op.position !== undefined) ? op.position : state.excelState.instance.countRows();
      state.excelState.instance.alter('insert_row_above', pos, count);
      return 'Inserted ' + count + ' row(s).';
    }

    case 'highlight_column': {
      var ex = state.excelState;
      if (!ex.setFmt) throw new Error('Formatting API not available.');
      var colIdx = findColumn(headers, op.column);
      var data = state.excelState.instance.getData();
      for (var ri = 0; ri < data.length; ri++) {
        ex.setFmt(ri, colIdx, { bgColor: op.bgColor });
      }
      ex.renderFmt();
      return 'Highlighted column "' + op.column + '" with ' + op.bgColor + '.';
    }

    case 'clear_format': {
      var ex = state.excelState;
      if (!ex.setFmt) throw new Error('Formatting API not available.');
      var data = state.excelState.instance.getData();
      var cols = op.column ? [findColumn(headers, op.column)] : Array.from({length: headers.length}, function(_, i) { return i; });
      for (var ri = 0; ri < data.length; ri++) {
        cols.forEach(function(ci) { ex.setFmt(ri, ci, { bold:false, italic:false, underline:false, color:null, bgColor:null, align:null, numFormat:null, wrapText:false }); });
      }
      ex.renderFmt();
      return 'Cleared formatting from ' + (op.column ? '"' + op.column + '"' : 'entire sheet') + '.';
    }

    case 'consolidate_to_template':
      return executeConsolidateToTemplate(headers, thinkingBubble, userText);
    case 'dynamic_report':
      return executeDynamicReport(userText, thinkingBubble);

    default:
      throw new Error('Unknown operation: ' + op.op);
  }
}

// ── Infinite Scroll ─────────────────────

function attachInfiniteScroll(instance) {
  var THRESHOLD = 300; // px from bottom before expanding
  var BATCH     = 100; // rows to add per expansion
  var busy      = false;

  var container = document.getElementById('excel-container');
  if (!container) return;

  // Target Handsontable's main scrollable holder (not the fixed-row overlay)
  var holder = container.querySelector('.ht_master .wtHolder') || container.querySelector('.wtHolder');
  if (!holder) return;

  holder.addEventListener('scroll', function() {
    if (busy) return;
    var fromBottom = holder.scrollHeight - holder.scrollTop - holder.clientHeight;
    var fromRight  = holder.scrollWidth  - holder.scrollLeft - holder.clientWidth;
    if (fromBottom < THRESHOLD || fromRight < THRESHOLD) {
      busy = true;
      if (fromBottom < THRESHOLD) {
        instance.alter('insert_row_below', instance.countRows() - 1, BATCH);
      }
      if (fromRight < THRESHOLD) {
        instance.alter('insert_col_end', instance.countCols() - 1, BATCH);
      }
      busy = false;
    }
  });
}

// ── New Template ─────────────────────

function createBlankTemplate(name) {
  var wb = XLSX.utils.book_new();
  var headerRow = Array(26).fill('');
  var emptyRows = Array.from({ length: 100 }, function() { return Array(26).fill(''); });
  var ws = XLSX.utils.aoa_to_sheet([headerRow].concat(emptyRows));
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet 1');
  var arr = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  var blob = new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  var file = new File([blob], name + '.xlsx', { type: blob.type });
  state.openFile(file);
  state.addMessage('Blank template created. Tell me what columns you need (e.g. "add columns: Name, Company, Trade, Phone, Status") and I\'ll set them up.', 'ai');
}

function showNewTemplateModal() {
  // Inject animation styles once
  if (!document.getElementById('new-tpl-styles')) {
    var style = document.createElement('style');
    style.id = 'new-tpl-styles';
    style.textContent = '@keyframes tplSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(style);
  }

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9999;';

  var card = document.createElement('div');
  card.style.cssText = 'background:#1d242e;border:1px solid rgba(226,154,53,0.35);border-radius:8px;padding:24px 28px;width:320px;box-shadow:0 0 32px rgba(226,154,53,0.12);animation:tplSlideUp 0.2s ease;';

  var title = document.createElement('div');
  title.textContent = 'New Blank Template';
  title.style.cssText = 'font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#e29a35;margin-bottom:16px;';

  var input = document.createElement('input');
  input.type = 'text';
  input.value = 'New Template';
  input.style.cssText = 'width:100%;box-sizing:border-box;background:#141a22;border:1px solid rgba(226,154,53,0.3);border-radius:4px;color:#d0d8e4;font-size:13px;padding:8px 10px;outline:none;margin-bottom:16px;';
  input.addEventListener('focus', function() { input.style.borderColor = 'rgba(226,154,53,0.7)'; });
  input.addEventListener('blur', function() { input.style.borderColor = 'rgba(226,154,53,0.3)'; });

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

  function dismiss() { document.body.removeChild(overlay); }

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'background:transparent;border:1px solid rgba(208,216,228,0.2);border-radius:4px;color:#8090a4;font-size:12px;padding:6px 14px;cursor:pointer;';
  cancelBtn.addEventListener('click', dismiss);

  var createBtn = document.createElement('button');
  createBtn.textContent = 'Create';
  createBtn.style.cssText = 'background:transparent;border:1px solid rgba(226,154,53,0.5);border-radius:4px;color:#e29a35;font-size:12px;font-weight:600;padding:6px 14px;cursor:pointer;';
  createBtn.addEventListener('click', function() {
    var name = input.value.trim() || 'New Template';
    dismiss();
    createBlankTemplate(name);
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') createBtn.click();
    if (e.key === 'Escape') dismiss();
  });

  overlay.addEventListener('click', function(e) { if (e.target === overlay) dismiss(); });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { dismiss(); document.removeEventListener('keydown', escHandler); }
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(createBtn);
  card.appendChild(title);
  card.appendChild(input);
  card.appendChild(btnRow);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  setTimeout(function() { input.select(); }, 50);
}

// ── Initialization ─────────────────────

export function initAiOperations() {
  state.getSpreadsheetSnapshot = getSpreadsheetSnapshot;
  state.getSelectedSourcesSnapshot = getSelectedSourcesSnapshot;

  // Intercept instance assignment so infinite scroll attaches on every file open
  var _inst = state.excelState.instance;
  Object.defineProperty(state.excelState, 'instance', {
    configurable: true,
    enumerable: true,
    get: function() { return _inst; },
    set: function(v) {
      _inst = v;
      if (v) setTimeout(function() { attachInfiniteScroll(v); }, 50);
    }
  });

  // Inject "New" button before consolidate button
  var consolidateBtn = document.getElementById('consolidate-btn');
  if (consolidateBtn) {
    var newBtn = document.createElement('button');
    newBtn.className = 'panel-header-action';
    newBtn.id = 'new-template-btn';
    newBtn.title = 'Create a new blank template';
    newBtn.style.cssText = 'width:auto;padding:0 8px;font-size:11px;font-weight:600;letter-spacing:0.03em;color:#e29a35;border-color:rgba(226,154,53,0.4);margin-right:4px;';
    newBtn.textContent = 'New';
    newBtn.addEventListener('click', showNewTemplateModal);
    consolidateBtn.parentElement.insertBefore(newBtn, consolidateBtn);
  }

  state.chatCommandHandler = async function(userText) {
    // New template shortcut — works even without an active spreadsheet
    var NEW_TEMPLATE_RE = /new\s+template|create\s+(a\s+)?template|blank\s+sheet|start\s+(a\s+)?fresh/i;
    if (NEW_TEMPLATE_RE.test(userText)) {
      var nameMatch = /(?:called|named|for)\s+(.+)/i.exec(userText);
      var tplName = nameMatch ? nameMatch[1].trim() : 'New Template';
      state.addMessage('Creating "' + tplName + '"…', 'ai');
      createBlankTemplate(tplName);
      return true;
    }

    if (!state.excelState.instance) return false;

    // Post animated thinking bubble
    var historyEl = document.getElementById('chat-history');
    var thinkingWrapper = document.createElement('div');
    thinkingWrapper.className = 'msg msg-ai';
    var thinkingBubble = document.createElement('div');
    thinkingBubble.className = 'msg-bubble';
    if (!document.getElementById('thinking-styles')) {
      var _s = document.createElement('style');
      _s.id = 'thinking-styles';
      _s.textContent = '.thinking-dots{display:inline-flex;gap:5px;align-items:center;height:20px}.thinking-dots span{width:6px;height:6px;border-radius:50%;background:#8090a4;animation:thinkBounce 1.2s ease-in-out infinite}.thinking-dots span:nth-child(1){animation-delay:0s}.thinking-dots span:nth-child(2){animation-delay:0.2s}.thinking-dots span:nth-child(3){animation-delay:0.4s}@keyframes thinkBounce{0%,60%,100%{transform:translateY(0);opacity:0.35}30%{transform:translateY(-6px);opacity:1}}';
      document.head.appendChild(_s);
    }
    var _dots = document.createElement('span');
    _dots.className = 'thinking-dots';
    _dots.innerHTML = '<span></span><span></span><span></span>';
    thinkingBubble.appendChild(_dots);
    thinkingWrapper.appendChild(thinkingBubble);
    historyEl.appendChild(thinkingWrapper);
    historyEl.scrollTop = historyEl.scrollHeight;

    try {
      var headers = getHeaders();
      var op = await parseCommand(userText, headers);

      if (!op || op.op === null) {
        thinkingWrapper.remove();
        return false;
      }

      var msgOrPromise = executeOp(op, headers, thinkingBubble, userText);
      var msg = (msgOrPromise && typeof msgOrPromise.then === 'function') ? await msgOrPromise : msgOrPromise;
      thinkingBubble.innerHTML = '';
      thinkingBubble.textContent = msg;
      return true;
    } catch (err) {
      if (err.name === 'AbortError') {
        thinkingWrapper.remove();
      } else {
        thinkingBubble.innerHTML = '';
        thinkingBubble.textContent = 'Error: ' + err.message;
      }
      return true;
    }
  };
}

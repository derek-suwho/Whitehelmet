import { state } from './state.js';

export function initConsolidation() {
  var SYSTEM_PROMPT = [
    'You are a data consolidation assistant for construction project management.',
    'You will receive data from multiple Excel sub-reports (subcontractor submissions) as JSON.',
    'Merge them into a single unified master spreadsheet following these rules:',
    '',
    'COLUMN NORMALIZATION:',
    '- Treat these as the same column and merge under one standard name:',
    '  "Invoice Amt", "Invoice Amount", "Inv. Amount", "Amount" → "Invoice Amount"',
    '  "PO #", "PO Number", "Purchase Order", "PO No." → "PO Number"',
    '  "Sub", "Subcontractor", "Company", "Contractor Name", "Sub Name" → "Subcontractor"',
    '  "Pay Status", "Payment Status", "Status", "Paid?" → "Payment Status"',
    '  "Description", "Desc", "Scope", "Work Description" → "Description"',
    '  "Date", "Invoice Date", "Submission Date" → "Date"',
    '- For any other columns that appear in multiple files with slightly different names, merge them under the most descriptive name',
    '- Preserve all columns that appear in at least one file',
    '',
    'DATA RULES:',
    '- Include a "Source File" column as the first column showing which file each row came from',
    '- Do NOT drop duplicate rows — construction PMs need to see all submissions even if similar',
    '- Preserve all numeric values exactly as-is (do not round or reformat)',
    '- Empty cells are fine — do not fill them in',
    '',
    'OUTPUT FORMAT:',
    'Return ONLY a JSON array-of-arrays (rows x columns) — the first row must be column headers.',
    'Do not include any explanatory text, markdown code fences, or commentary. Return raw JSON only.',
    'After the JSON, on a new line beginning with "SUMMARY:", write a one-paragraph plain-text summary',
    'covering: how many files were merged, total row count, columns normalized, and any conflicts resolved.'
  ].join('\n');

  function getCheckedFiles() {
    var checked = document.querySelectorAll('.panel-left .source-check:checked');
    var files = [];
    checked.forEach(function (cb) { if (cb._fileRef) files.push(cb._fileRef); });
    return files;
  }

  function readFileAsAOA(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          var result = {};
          wb.SheetNames.forEach(function (name) {
            result[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 });
          });
          resolve(result);
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  async function consolidate() {
    var checkedFiles = getCheckedFiles();
    var consolidateBtn = document.getElementById('consolidate-btn');
    var chatInput = document.getElementById('chat-input');
    var chatSendBtn = document.getElementById('chat-send-btn');
    var chatBadge = document.getElementById('chat-badge');

    // Guard: nothing checked
    if (checkedFiles.length === 0) {
      state.addMessage('Please check at least one file to consolidate.', 'ai');
      return;
    }

    // Disable inputs during consolidation
    consolidateBtn.disabled = true;
    chatInput.disabled = true;
    chatSendBtn.disabled = true;
    chatBadge.textContent = 'Consolidating…';

    // Show typing indicator
    state.addMessage('Claude is consolidating…', 'ai');

    try {
      // Read all selected files into AoA format
      var fileDataArr = await Promise.all(checkedFiles.map(function (f) {
        return readFileAsAOA(f).then(function (sheets) {
          return { name: f.name, sheets: sheets };
        });
      }));

      var userContent = 'Consolidate the following Excel files:\n\n' + JSON.stringify(fileDataArr, null, 2);

      // Call backend proxy (non-streaming — structured JSON response required)
      var response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'anthropic/claude-opus-4-5',
          max_tokens: 8192,
          stream: false,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent }
          ]
        })
      });

      if (!response.ok) {
        var errText = await response.text();
        throw new Error('API error ' + response.status + ': ' + errText);
      }

      var json = await response.json();
      var rawText = json.choices[0].message.content;

      // Split response: JSON AoA + summary text
      var summaryIdx = rawText.indexOf('\nSUMMARY:');
      var aoaText = summaryIdx > -1 ? rawText.slice(0, summaryIdx).trim() : rawText.trim();
      var summaryText = summaryIdx > -1
        ? rawText.slice(summaryIdx + '\nSUMMARY:'.length).trim()
        : 'Consolidation complete.';

      var mergedAoA = JSON.parse(aoaText);

      // Build synthetic .xlsx File from merged AoA
      var wb2 = XLSX.utils.book_new();
      var ws2 = XLSX.utils.aoa_to_sheet(mergedAoA);
      XLSX.utils.book_append_sheet(wb2, ws2, 'Consolidated');
      var wbArray = XLSX.write(wb2, { bookType: 'xlsx', type: 'array' });
      var blob = new Blob([wbArray], { type: 'application/octet-stream' });
      var label = 'Consolidated — ' + checkedFiles.length + ' source' + (checkedFiles.length !== 1 ? 's' : '');
      var syntheticFile = new File([blob], label + '.xlsx', { type: 'application/octet-stream' });

      // Open merged result in Excel editor
      state.openFile(syntheticFile);

      // Auto-save to master records if available
      if (state.saveMasterRecord) {
        var recDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        state.saveMasterRecord({
          name: label,
          date: recDate,
          sourceCount: checkedFiles.length,
          rowCount: mergedAoA.length - 1,
          fileObj: syntheticFile
        });
      }

      // Post Claude summary to chat
      state.addMessage(summaryText, 'ai');

    } catch (err) {
      state.addMessage('Consolidation failed: ' + err.message + '. Please try again.', 'ai');
    } finally {
      consolidateBtn.disabled = false;
      chatInput.disabled = false;
      chatSendBtn.disabled = false;
      chatBadge.textContent = 'Ready';
    }
  }

  document.getElementById('consolidate-btn').addEventListener('click', consolidate);
}

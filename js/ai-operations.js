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

var SYSTEM_PROMPT = 'You are a spreadsheet command parser. Given a user message and a list of column headers, return ONLY a JSON object (no other text, no markdown fences).\n\nIf the message is a spreadsheet command, return one of:\n{"op":"add_column","name":"<header>","position":<0-based index or null for end>}\n{"op":"remove_column","name":"<header>"}\n{"op":"rename_column","from":"<old header>","to":"<new header>"}\n{"op":"apply_formula","column":"<header>","formula":"<formula string e.g. =A{row}+B{row}>"}\n\nIf the message is NOT a spreadsheet command, return:\n{"op":null}';

// ── Intent Parsing ─────────────────────

async function parseCommand(userText, headers) {
  var userContent = 'Column headers: ' + JSON.stringify(headers) + '\nUser command: ' + userText;

  var response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': state.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }]
    })
  });

  if (!response.ok) {
    throw new Error('API error ' + response.status);
  }

  var json = await response.json();
  var text = json.content[0].text;

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Could not understand that command. Try something like "add a Total column" or "rename Status to Payment Status".');
  }
}

// ── Operation Dispatch ─────────────────────

function findColumn(headers, name) {
  var idx = headers.indexOf(name);
  if (idx === -1) {
    throw new Error('Column "' + name + '" not found. Available columns: ' + headers.join(', '));
  }
  return idx;
}

function executeOp(op, headers) {
  switch (op.op) {
    case 'add_column':
      var instance = state.excelState.instance;
      var pos = op.position;
      if (pos === null || pos === undefined || pos >= headers.length) {
        // Append at end: insert after last column
        instance.insertColumn(1, headers.length - 1, false);
        instance.setHeader(headers.length, op.name);
      } else {
        // Insert before the specified position
        instance.insertColumn(1, pos, true);
        instance.setHeader(pos, op.name);
      }
      return 'Added column "' + op.name + '".';
    case 'remove_column':
      var idx = findColumn(headers, op.name);
      state.excelState.instance.deleteColumn(idx, 1);
      return 'Removed column "' + op.name + '".';
    case 'rename_column':
      var idx = findColumn(headers, op.from);
      state.excelState.instance.setHeader(idx, op.to);
      return 'Renamed "' + op.from + '" to "' + op.to + '".';
    case 'apply_formula':
      var idx = findColumn(headers, op.column);
      var data = state.excelState.instance.getData();
      for (var r = 0; r < data.length; r++) {
        var formula = op.formula.replace(/\{row\}/g, String(r + 1));
        state.excelState.instance.setValueFromCoords(idx, r, formula);
      }
      return 'Applied formula to column "' + op.column + '" (' + data.length + ' rows).';
    default:
      throw new Error('Unknown operation: ' + op.op);
  }
}

// ── Initialization ─────────────────────

export function initAiOperations() {
  state.chatCommandHandler = async function(userText) {
    if (!state.excelState.instance) return false;

    // Post thinking indicator
    state.addMessage('...', 'ai');
    var historyEl = document.getElementById('chat-history');
    var bubbles = historyEl.querySelectorAll('.msg-bubble');
    var thinkingBubble = bubbles[bubbles.length - 1];

    try {
      var headers = state.excelState.instance.getHeaders(true);
      var op = await parseCommand(userText, headers);

      if (!op || op.op === null) {
        thinkingBubble.parentElement.remove();
        return false;
      }

      var msg = executeOp(op, headers);
      thinkingBubble.textContent = msg;
      return true;
    } catch (err) {
      thinkingBubble.textContent = 'Error: ' + err.message;
      return true;
    }
  };
}

# Phase 1 Research: Command Routing, Intent Parsing, and Column Operations

**Researched:** 2026-03-31
**Status:** Complete

---

## 1. Jspreadsheet CE v5 API Surface

`state.excelState.instance` is the **first worksheet object** (not the workbook array). Set in `js/excel-editor.js` line 138 as `instances[0]`. All methods below are called directly on it.

### Column Header Methods

```js
// Get all headers as array (pass true)
var headers = instance.getHeaders(true);
// Returns: ["Column A", "Column B", "Column C"]

// Get single header (0-indexed)
var header = instance.getHeader(0);  // "Column A"

// Set/rename header (0-indexed column, new title)
instance.setHeader(0, 'New Name');
// Triggers onchangeheader dispatch and history tracking
```

### Column Structural Methods

```js
// Insert column
// mixed: number of columns OR array of data
// columnNumber: 0-based index of reference column
// insertBefore: true = insert before, false = insert after
// properties: column config object (optional)
instance.insertColumn(1, columnNumber, insertBefore, properties);

// Delete column
// columnNumber: 0-based index
// numOfColumns: how many to delete (default 1)
instance.deleteColumn(columnNumber, numOfColumns);

// Get/set entire column data
var colData = instance.getColumnData(columnNumber);
instance.setColumnData(columnNumber, dataArray, force);
```

### Cell Value Methods

```js
// By cell ref string (A1, B3, etc.)
var val = instance.getValue('A1');
instance.setValue('A1', 'new value');

// By 0-based coordinates
var val = instance.getValueFromCoords(x, y);
instance.setValueFromCoords(x, y, 'new value');
```

### Data Methods

```js
// Get all data as array-of-arrays
var data = instance.getData();

// Sort by column
// column: 0-based index
// order: true = descending, false/null = ascending (toggles if null)
instance.orderBy(columnIndex, order);
```

### Critical Gotchas

1. **Column indices are 0-based** throughout — headers[0] = first column
2. **`getHeaders(true)`** must pass `true` for array return; no argument returns delimited string
3. **insertColumn** uses the column number as a reference point, with `insertBefore` controlling direction
4. **Column name → index lookup** must be done manually: `headers.indexOf('Column Name')`
5. **No column-by-name API** — all structural methods (insert, delete) use numeric indices
6. **instance is first worksheet only** — multi-sheet workbooks need `instances[n]`; for v1 always use `state.excelState.instance`

### Formula Support in CE

- `setValue('A1', '=SUM(B1:B10)')` writes the formula string to the cell
- CE v5 has a built-in formula engine — simple formulas (SUM, AVG, basic arithmetic) compute
- Complex/unsupported formulas render as text (no error, just static string)
- No formula validation API — write and let CE handle it

---

## 2. Anthropic API Pattern (Non-Streaming)

From `js/consolidation.js` — the established pattern for non-streaming JSON responses:

```js
var response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': state.apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true'  // REQUIRED for direct browser calls
  },
  body: JSON.stringify({
    model: 'claude-opus-4-5',
    max_tokens: 512,  // small for structured JSON responses
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }]
  })
});

if (!response.ok) {
  var errText = await response.text();
  throw new Error('API error ' + response.status + ': ' + errText);
}

var json = await response.json();
var text = json.content[0].text;  // Claude's response text
var op = JSON.parse(text);        // parse as JSON operation object
```

**Key:** `json.content[0].text` is the response string. No streaming needed.

---

## 3. Prompt Engineering for Structured JSON Operations

### Recommended System Prompt Strategy

Claude should return **only a JSON object**, no prose. Use a tight system prompt:

```
You are a spreadsheet command parser. Given a user message and a list of column headers,
return ONLY a JSON object (no other text, no markdown fences).

If the message is a spreadsheet command, return:
{"op": "<operation>", ...params}

If not a spreadsheet command, return:
{"op": null}

Supported operations:
- add_column: {"op":"add_column","name":"<header>","position":<0-based-index or null for end>}
- remove_column: {"op":"remove_column","name":"<header>"}
- rename_column: {"op":"rename_column","from":"<old header>","to":"<new header>"}
- apply_formula: {"op":"apply_formula","column":"<header>","formula":"<formula string e.g. =A{row}+B{row}>"}
```

### User Message Format

Pass headers + command in the user message:

```
Column headers: ["Date", "Contractor", "Amount", "Status"]
User command: "add a Total column at the end"
```

### Reliability Tips

- Pass headers as a JSON array string so Claude knows exact column names (for remove/rename matching)
- Keep `max_tokens` low (256–512) for JSON-only responses
- The system prompt should say "return ONLY a JSON object" — prevents prose wrapping
- Parse with `JSON.parse()`, catch parse errors as "ambiguous command"

---

## 4. Thinking Indicator Pattern

`state.addMessage(text, 'ai')` appends a div `.msg.msg-ai > .msg-bubble` to `#chat-history`. To implement a replaceable thinking bubble:

**Pattern: post bubble, keep DOM reference, update text**

```js
// Post thinking bubble
state.addMessage('...', 'ai');
// Get the last bubble added
var history = document.getElementById('chat-history');
var bubbles = history.querySelectorAll('.msg-bubble');
var thinkingBubble = bubbles[bubbles.length - 1];

// ... await Claude call ...

// Replace text in-place
thinkingBubble.textContent = 'Added column "Total".';
```

This avoids adding a second message and keeps the chat clean. Works because `addMessage` always appends, so the last `.msg-bubble` is always the one just added.

---

## 5. Command Handler Structure

The complete handler lifecycle based on interface analysis:

```js
state.chatCommandHandler = async function(userText) {
  // Guard 1: no spreadsheet open
  if (!state.excelState.instance) return false;

  // 1. Post thinking indicator
  state.addMessage('...', 'ai');
  var bubble = /* get last bubble */;

  try {
    // 2. Get current headers
    var headers = state.excelState.instance.getHeaders(true);

    // 3. Call Claude (classify + parse in one call)
    var op = await parseCommand(userText, headers);

    // 4. op.op === null → not a command
    if (!op || op.op === null) {
      // Remove thinking bubble (replace with nothing visible, or remove element)
      bubble.parentElement.remove();  // remove the wrapper div
      return false;  // fall through to normal chat
    }

    // 5. Execute operation
    executeOp(op, headers);

    // 6. Confirm in thinking bubble
    bubble.textContent = 'Done: ' + successMessage(op);
    return true;

  } catch (err) {
    bubble.textContent = 'Error: ' + err.message;
    return true;
  }
};
```

**Key decision:** when `op.op === null` (not a command), remove the thinking bubble before returning `false` — otherwise a blank `...` message lingers in chat while normal chat also responds.

---

## 6. Requirement Coverage Map

| Req ID | Implementation approach |
|--------|------------------------|
| ROUTE-01 | `initAiOperations()` sets `state.chatCommandHandler` |
| ROUTE-02 | Return `true` after executing any op |
| ROUTE-03 | Return `false` when `op.op === null` |
| PARSE-01 | `fetch` to Anthropic API with `state.apiKey` |
| PARSE-02 | Claude returns `{op, ...params}` JSON |
| PARSE-03 | On parse error or ambiguous intent: post error, return `true` |
| TMPL-01 | `instance.insertColumn(1, position, insertBefore)` + `setHeader` |
| TMPL-02 | `instance.deleteColumn(index)` after header lookup |
| TMPL-03 | `instance.setHeader(index, newName)` after header lookup |
| TMPL-04 | `instance.setValueFromCoords(x, row, formula)` for each row |
| UX-01 | Update thinking bubble text to confirmation message |
| UX-02 | Update thinking bubble text to error message |
| UX-03 | Post `...` bubble before API call; update after |

---

## Validation Architecture

### Unit-testable surfaces
- `parseCommand(text, headers)` → returns op object (mockable fetch)
- `executeOp(op, instance)` → mutates spreadsheet (mockable instance)
- Header lookup: `headers.indexOf(name)` → -1 handling

### Integration test scenarios
1. Non-command message → handler returns false, no bubble left in DOM
2. Add column → column appears in spreadsheet grid, confirmation in chat
3. Remove nonexistent column → error message in chat, return true
4. Ambiguous command (JSON parse fails) → error message in chat, return true

### Manual acceptance tests (from success criteria)
1. Type "add a Total column" → column appears, chat confirms
2. Type "remove the Amount column" → column gone, chat confirms
3. Type "rename Status to Payment Status" → header updated
4. Type "what's the weather" → falls through to normal chat, no lingering bubble


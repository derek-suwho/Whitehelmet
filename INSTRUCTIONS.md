# Group 1 — AI Spreadsheet Operations

## What you're building
Natural language spreadsheet editing. When a user types a command like "add a Total column" or "remove empty rows" in the chat, your code intercepts it, calls Claude to understand the intent, and applies the change to the open spreadsheet.

## Your files
- `js/ai-operations.js` — **your main file, implement everything here**
- `js/chat.js` — you may modify this if needed for command routing

## Do not touch
Everything else. Especially `js/state.js`, `js/app.js`, and `index.html` — these are pre-wired for you.

## How it works
- Your code registers itself on `state.chatCommandHandler`
- When a user sends a chat message, `chat.js` calls your handler first
- Return `true` if you handled it (skips normal chat), `false` to pass through
- Use `state.excelState.instance` to mutate the spreadsheet (Jspreadsheet CE API)
- Use `state.addMessage(text, 'ai')` to post results back to chat
- Use `state.apiKey` for Anthropic API calls
- The backend proxy endpoint for AI calls will be at `/api/chat` (Group 3 builds this)

## Two roles
- **Person 1A (Command Parser):** Call Claude to classify the message and extract structured intent — what operation, what parameters
- **Person 1B (Spreadsheet Mutator):** Take that structured intent and apply it to the spreadsheet using the Jspreadsheet CE API

## Getting started
1. Run `node serve.mjs` to start the local server at http://localhost:3000
2. Run `/gsd:new-project` in Claude Code to set up your planning
3. Replace `YOUR_KEY_HERE` in `js/state.js` with a real Anthropic API key to test

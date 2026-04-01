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
//   - Use state.openrouterApiKey for OpenRouter API calls if needed
//   - Use state.conversationHistory for context

import { state } from './state.js';

export function initAiOperations() {
  // TODO: Group 1 implements here
  // Example skeleton:
  //
  // state.chatCommandHandler = async function (userText) {
  //   if (!state.excelState.instance) return false; // no spreadsheet open
  //   // Parse userText, determine if it's a spreadsheet command
  //   // If yes: call Anthropic API to get structured operation, apply it, return true
  //   // If no: return false (falls through to normal chat)
  //   return false;
  // };
}

import { state } from './state.js';

export function initChat() {
  var history   = document.getElementById('chat-history');
  var input     = document.getElementById('chat-input');
  var sendBtn   = document.getElementById('chat-send-btn');
  var emptyState = document.getElementById('chat-empty-state');
  var badge     = document.getElementById('chat-badge');

  function addMessage(text, sender, skipHistory) {
    // Remove empty state on first message
    if (emptyState && emptyState.parentNode) {
      emptyState.parentNode.removeChild(emptyState);
      emptyState = null;
    }

    var wrapper = document.createElement('div');
    wrapper.className = 'msg msg-' + sender;

    var bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;

    wrapper.appendChild(bubble);
    history.appendChild(wrapper);

    // Auto-scroll to bottom
    history.scrollTop = history.scrollHeight;

    // Push to conversation history for ai messages (so consolidation summaries are in context)
    if (sender === 'ai' && !skipHistory && state.conversationHistory) {
      state.conversationHistory.push({ role: 'assistant', content: text });
    }
  }

  // Register on shared state so other modules can post messages
  state.addMessage = addMessage;

  async function sendMessage() {
    var text = input.value.trim();
    if (!text) return;

    // Remove empty state
    if (emptyState && emptyState.parentNode) {
      emptyState.parentNode.removeChild(emptyState);
      emptyState = null;
    }

    // Render user bubble
    addMessage(text, 'user');
    input.value = '';
    input.focus();

    // Check if a command handler wants to intercept this message
    // (e.g. ai-operations.js for spreadsheet NL commands)
    if (state.chatCommandHandler) {
      try {
        var handled = await state.chatCommandHandler(text);
        if (handled) return;
      } catch (handlerErr) {
        addMessage('Command error: ' + handlerErr.message, 'ai');
        return;
      }
    }

    // Disable inputs while responding
    input.disabled = true;
    sendBtn.disabled = true;
    badge.textContent = 'Thinking\u2026';

    // Append user message to history
    state.conversationHistory.push({ role: 'user', content: text });

    // Create an empty AI bubble for streaming into
    var wrapper = document.createElement('div');
    wrapper.className = 'msg msg-ai';
    var bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = '';
    wrapper.appendChild(bubble);
    history.appendChild(wrapper);
    history.scrollTop = history.scrollHeight;

    var fullResponse = '';

    try {
      var response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'anthropic/claude-opus-4-5',
          max_tokens: 4096,
          stream: true,
          messages: [
            { role: 'system', content: 'You are an AI assistant for Whitehelmet, a tool that consolidates subcontractor Excel reports. Help users understand their consolidated data and answer questions about it.' + (state.getSpreadsheetSnapshot ? (function() { var snap = state.getSpreadsheetSnapshot(); return snap ? '\n\n' + snap : ''; })() : '') },
            ...state.conversationHistory
          ]
        })
      });

      if (!response.ok) {
        var errText = await response.text();
        throw new Error('API error ' + response.status + ': ' + errText);
      }

      // Parse SSE stream
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;

        buffer += decoder.decode(chunk.value, { stream: true });

        // Split on newline SSE boundaries
        var lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line in buffer

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line.startsWith('data: ')) continue;
          var dataStr = line.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            var evt = JSON.parse(dataStr);
            if (evt.choices && evt.choices[0] && evt.choices[0].delta && evt.choices[0].delta.content) {
              fullResponse += evt.choices[0].delta.content;
              bubble.textContent = fullResponse;
              history.scrollTop = history.scrollHeight;
            }
          } catch (parseErr) {
            // Ignore malformed SSE lines
          }
        }
      }

      // Push complete assistant message to history
      state.conversationHistory.push({ role: 'assistant', content: fullResponse });

    } catch (err) {
      bubble.textContent = 'Sorry, something went wrong: ' + err.message;
      // Don't push failed response to history (keep it clean)
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      badge.textContent = 'Ready';
      input.focus();
    }
  }

  // Send on button click
  sendBtn.addEventListener('click', sendMessage);

  // Send on Enter key (not Shift+Enter)
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

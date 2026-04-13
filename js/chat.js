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

  // ── Stop button ───────────────────────────────────────────────
  var stopBtn = document.createElement('button');
  stopBtn.id = 'chat-stop-btn';
  stopBtn.className = 'chat-send-btn';
  stopBtn.title = 'Stop';
  stopBtn.style.display = 'none';
  stopBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" rx="1.5" fill="currentColor"/></svg>';
  sendBtn.parentElement.insertBefore(stopBtn, sendBtn.nextSibling);

  function setProcessing(on) {
    sendBtn.style.display = on ? 'none' : '';
    stopBtn.style.display = on ? '' : 'none';
    input.disabled = on;
    badge.textContent = on ? 'Thinking\u2026' : 'Ready';
  }

  function injectThinkingDots(bubbleEl) {
    if (!document.getElementById('thinking-styles')) {
      var s = document.createElement('style');
      s.id = 'thinking-styles';
      s.textContent = '.thinking-dots{display:inline-flex;gap:5px;align-items:center;height:20px}.thinking-dots span{width:6px;height:6px;border-radius:50%;background:#8090a4;animation:thinkBounce 1.2s ease-in-out infinite}.thinking-dots span:nth-child(1){animation-delay:0s}.thinking-dots span:nth-child(2){animation-delay:0.2s}.thinking-dots span:nth-child(3){animation-delay:0.4s}@keyframes thinkBounce{0%,60%,100%{transform:translateY(0);opacity:0.35}30%{transform:translateY(-6px);opacity:1}}';
      document.head.appendChild(s);
    }
    var dots = document.createElement('span');
    dots.className = 'thinking-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';
    bubbleEl.appendChild(dots);
  }

  stopBtn.addEventListener('click', function() {
    if (state._abortController) state._abortController.abort();
  });

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

    // Create abort controller for this request (shared with command handler via state)
    var controller = new AbortController();
    state._abortController = controller;
    state.abortSignal = controller.signal;
    setProcessing(true);

    var thinkWrapper = null;
    var bubble = null;
    var fullResponse = '';

    function createThinkBubble() {
      thinkWrapper = document.createElement('div');
      thinkWrapper.className = 'msg msg-ai';
      bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      injectThinkingDots(bubble);
      thinkWrapper.appendChild(bubble);
      history.appendChild(thinkWrapper);
      history.scrollTop = history.scrollHeight;
    }

    // Show dots immediately
    createThinkBubble();

    try {
      // Check if a command handler wants to intercept this message
      if (state.chatCommandHandler) {
        // Remove our bubble first — the command handler creates its own
        thinkWrapper.remove();
        var handled = await state.chatCommandHandler(text);
        if (handled) return;
        // Not a spreadsheet command — create a fresh bubble for regular chat
        createThinkBubble();
      }

      // Regular chat path — use the thinking bubble
      state.conversationHistory.push({ role: 'user', content: text });

      var snapshot = state.getSpreadsheetSnapshot ? state.getSpreadsheetSnapshot() : null;
      var selectedSources = state.getSelectedSourcesSnapshot ? await state.getSelectedSourcesSnapshot() : null;
      var systemContent = 'You are a helpful assistant for Whitehelmet, a construction subcontractor report consolidation tool. Be conversational and concise — 1-3 sentences max unless the user asks for detail. Never dump raw data, file names, column lists, or JSON in your responses. Use the context below only to answer questions accurately, not to summarize it back. IMPORTANT: You have NO tools to read files. The only source data available to you is what is explicitly provided in this context (headers + up to 5 sample rows per file). If the context does not contain enough information to answer, say so plainly — do NOT output XML tags, tool calls, or pretend to access files.'
        + (selectedSources ? '\n\n' + selectedSources : '')
        + (snapshot ? '\n\n' + snapshot : '');

      var response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'anthropic/claude-opus-4-5',
          max_tokens: 4096,
          stream: true,
          messages: [
            { role: 'system', content: systemContent },
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
            var delta = evt.choices && evt.choices[0] && evt.choices[0].delta;
            if (delta && delta.content) {
              if (!fullResponse) bubble.innerHTML = ''; // clear thinking dots
              fullResponse += delta.content;
              bubble.textContent = fullResponse;
              history.scrollTop = history.scrollHeight;
            }
          } catch (parseErr) {
            // Ignore malformed SSE lines
          }
        }
      }

      // Push complete assistant message to history
      if (fullResponse) state.conversationHistory.push({ role: 'assistant', content: fullResponse });

    } catch (err) {
      if (err.name === 'AbortError') {
        if (thinkWrapper && !fullResponse) thinkWrapper.remove();
      } else {
        if (bubble) { bubble.innerHTML = ''; bubble.textContent = 'Sorry, something went wrong: ' + err.message; }
        else addMessage('Error: ' + err.message, 'ai');
      }
    } finally {
      state._abortController = null;
      state.abortSignal = null;
      setProcessing(false);
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

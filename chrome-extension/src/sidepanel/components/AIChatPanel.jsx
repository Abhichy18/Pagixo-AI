// AIChatPanel.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';
import { QuickPrompts } from './QuickPrompts';

/**
 * AIChatPanel — Main AI chatbot panel for Pagixo OCR extension.
 *
 * Props:
 *   text {string} — OCR-extracted text passed from ResultViewer (used as fallback
 *                   if chrome.storage.session has no pagixoContext yet)
 *
 * Context is primarily read from chrome.storage.session key: pagixoContext
 * which is saved by the background script after every scan and contains:
 *   { extractedText, screenshotBase64, pageUrl, pageTitle, scanType, timestamp }
 */
export function AIChatPanel({ text }) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [isOpen, setIsOpen]       = useState(false);
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext]     = useState(null);
  const [error, setError]         = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // ── Load context + history when panel opens ───────────────────────────────
  useEffect(() => {
    if (isOpen) {
      loadContextFromStorage();
      loadChatHistory();
      // Small delay so the panel animation finishes before focusing
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  async function loadContextFromStorage() {
    try {
      const result = await chrome.storage.session.get('pagixoContext');
      if (result.pagixoContext) {
        setContext(result.pagixoContext);
      } else if (text) {
        setContext({ extractedText: text, scanType: 'unknown' });
      }
    } catch {
      if (text) setContext({ extractedText: text, scanType: 'unknown' });
    }
  }

  async function loadChatHistory() {
    try {
      const result = await chrome.storage.session.get('pagixoChatHistory');
      if (result.pagixoChatHistory?.length > 0) {
        setMessages(result.pagixoChatHistory);
      } else {
        setMessages([{
          role: 'assistant',
          content: "👋 Hi! I'm Pagixo AI. I can see your scanned content and help you understand it, fill forms, solve equations, translate, and more.\n\nWhat would you like to know?"
        }]);
      }
    } catch {
      setMessages([{
        role: 'assistant',
        content: "👋 Hi! I'm Pagixo AI. Ask me anything about your scanned content."
      }]);
    }
  }

  async function saveChatHistory(msgs) {
    try {
      await chrome.storage.session.set({ pagixoChatHistory: msgs });
    } catch { /* non-fatal — session storage may not be available in dev */ }
  }

  // ── Auto-scroll to latest message ─────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // ── Send a message ────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (questionOverride) => {
    const rawQuestion = (questionOverride || input).trim();
    if (!rawQuestion || isLoading) return;

    setInput('');
    setError(null);

    // Smart intent detection: augment form-fill queries with extra context hint
    const FORM_KEYWORDS = ['fill', 'form', 'input', 'field', 'complete', 'submit'];
    const isFormQuery = FORM_KEYWORDS.some(k => rawQuestion.toLowerCase().includes(k));
    const question = (isFormQuery && context?.scanType === 'visible_page')
      ? `${rawQuestion}\n\n[Context: This appears to be a form page. Please list each form field with a clear instruction on what to enter.]`
      : rawQuestion;

    const userMsg = { role: 'user', content: rawQuestion }; // show raw in UI
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    setIsLoading(true);

    try {
      // Build history for API (exclude system/welcome messages, cap at 8 turns)
      const historyForApi = updatedMsgs
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-9, -1) // last 8 turns before the just-added user msg
        .map(m => ({ role: m.role, content: m.content }));

      const payload = {
        action: 'askAI',
        question, // augmented question sent to AI
        context: context?.extractedText || text || '',
        history: historyForApi,
        pageUrl: context?.pageUrl || '',
        scanType: context?.scanType || 'unknown',
        imageBase64: context?.screenshotBase64 || null,
      };

      const response = await chrome.runtime.sendMessage(payload);

      if (!response) {
        throw new Error('No response from background script. Is the extension service worker running?');
      }

      if (response.error && !response.answer) {
        throw new Error(response.error);
      }

      const aiMsg = { role: 'assistant', content: response.answer };
      const finalMsgs = [...updatedMsgs, aiMsg];
      setMessages(finalMsgs);
      await saveChatHistory(finalMsgs);

    } catch (err) {
      const errMsg = {
        role: 'assistant',
        content: `❌ **Error:** ${err.message || 'Could not reach Pagixo AI. Make sure the API server is running.'}`
      };
      const finalMsgs = [...updatedMsgs, errMsg];
      setMessages(finalMsgs);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, context, text, isLoading]);

  // ── Keyboard handler ──────────────────────────────────────────────────────
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    // Shift+Enter → natural textarea newline (do nothing)
  }

  // ── Clear chat ────────────────────────────────────────────────────────────
  async function clearChat() {
    const resetMsg = [{ role: 'assistant', content: '🔄 Chat cleared. How can I help you?' }];
    setMessages(resetMsg);
    setError(null);
    try { await chrome.storage.session.remove('pagixoChatHistory'); } catch {}
  }

  // ── Header badge: shows scan type + word count ────────────────────────────
  function getContextBadge() {
    if (!context?.extractedText) return { label: 'No scan yet', color: '#888' };
    const words = context.extractedText.trim().split(/\s+/).length;
    const typeLabel = {
      visible_page: '🌐 Full Page',
      capture:      '✂️ Region',
      upload:       '📄 Document',
      unknown:      '📋 Scanned',
    }[context.scanType] || '📋 Scanned';
    return { label: `${typeLabel} · ~${words} words`, color: '#22c55e' };
  }

  const badge = getContextBadge();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="px-ai-panel" data-open={isOpen}>

      {/* ── Collapsible Header ── */}
      <button
        className="px-ai-panel__header"
        onClick={() => setIsOpen(o => !o)}
        aria-expanded={isOpen}
        type="button"
      >
        <span className="px-ai-panel__header-left">
          <span className="px-ai-panel__icon">🧠</span>
          <span className="px-ai-panel__title">Pagixo AI</span>
          <span className="px-ai-panel__badge" style={{ color: badge.color }}>
            {badge.label}
          </span>
        </span>
        <span className="px-ai-panel__chevron">{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* ── Body (only rendered when open) ── */}
      {isOpen && (
        <div className="px-ai-panel__body">

          {/* Quick prompt chips */}
          <QuickPrompts
            onSelect={(prompt) => sendMessage(prompt)}
            disabled={isLoading}
          />

          {/* Message thread */}
          <div
            className="px-ai-panel__messages"
            role="log"
            aria-live="polite"
            aria-label="AI conversation"
          >
            {messages.map((msg, i) => (
              <ChatMessage key={i} role={msg.role} content={msg.content} />
            ))}
            {isLoading && <ChatMessage role="assistant" isLoading />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="px-ai-panel__input-row">
            <textarea
              ref={inputRef}
              className="px-ai-panel__input"
              placeholder="Ask about the scanned content..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading}
              aria-label="Chat input"
            />
            <button
              className="px-ai-panel__send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              type="button"
            >
              {isLoading ? '⏳' : '➤'}
            </button>
          </div>

          {/* Footer */}
          <div className="px-ai-panel__footer">
            <button
              className="px-ai-panel__clear-btn"
              onClick={clearChat}
              type="button"
            >
              🗑 Clear
            </button>
            {context?.screenshotBase64 && (
              <span className="px-ai-panel__vision-badge">👁 Vision enabled</span>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

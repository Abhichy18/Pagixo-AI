// ChatMessage.jsx
import React from 'react';

/**
 * Renders a single chat message bubble.
 * 
 * Props:
 *   role      {string}  — 'user' | 'assistant'
 *   content   {string}  — message text (supports **bold**, `code`, newlines)
 *   isLoading {boolean} — if true, shows animated typing indicator instead of content
 */
export function ChatMessage({ role, content, isLoading }) {
  const isUser = role === 'user';

  /**
   * Lightweight markdown renderer — no external dependencies.
   * Converts: **bold**, `code`, and \n → <br/>
   */
  function renderContent(text) {
    if (!text) return null;
    const parts = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>');
    return <span dangerouslySetInnerHTML={{ __html: parts }} />;
  }

  // Show animated typing indicator while AI is responding
  if (isLoading) {
    return (
      <div className="px-message px-message--ai">
        <div className="px-typing-indicator">
          <span /><span /><span />
        </div>
      </div>
    );
  }

  return (
    <div className={`px-message px-message--${isUser ? 'user' : 'ai'}`}>
      {!isUser && (
        <div className="px-message__avatar">🧠</div>
      )}
      <div className="px-message__bubble">
        {renderContent(content)}
      </div>
    </div>
  );
}

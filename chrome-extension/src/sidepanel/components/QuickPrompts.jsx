// QuickPrompts.jsx
import React from 'react';

/**
 * Quick prompt chip buttons shown above the chat thread.
 * Clicking a chip fires a pre-written prompt directly to the AI.
 *
 * Props:
 *   onSelect  {function(string)} — called with the full prompt string
 *   disabled  {boolean}         — disable all chips while AI is responding
 */

const QUICK_PROMPTS = [
  { emoji: '🔍', label: 'Explain',    prompt: 'Explain the extracted text in simple terms' },
  { emoji: '📐', label: 'Solve',      prompt: 'Solve this step by step and show all work' },
  { emoji: '📝', label: 'Summarize',  prompt: 'Summarize the key points from this text' },
  { emoji: '🌐', label: 'Translate',  prompt: 'Translate this text to English' },
  { emoji: '📋', label: 'Fill Form',  prompt: 'Help me fill in the form shown in the extracted text' },
];

export function QuickPrompts({ onSelect, disabled }) {
  return (
    <div className="px-quick-prompts">
      {QUICK_PROMPTS.map(({ emoji, label, prompt }) => (
        <button
          key={label}
          className="px-quick-prompt-chip"
          onClick={() => onSelect(prompt, { label })}
          disabled={disabled}
          title={prompt}
          type="button"
        >
          {emoji} {label}
        </button>
      ))}
    </div>
  );
}

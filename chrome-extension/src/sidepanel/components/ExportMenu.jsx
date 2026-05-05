import React from 'react';

/**
 * ExportMenu — Not used as standalone; export buttons are inline in ResultViewer.
 * Kept for potential future expansion (PDF export, etc).
 */
export default function ExportMenu({ text, filename }) {
  const download = (ext) => {
    const blob = new Blob([text || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename || 'pagixo-ocr'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-2">
      <button onClick={() => download('txt')} className="flex-1 py-2 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/[0.06] text-indigo-300/60 hover:bg-white/[0.07] hover:text-indigo-300/90 transition-all">
        📄 .txt
      </button>
      <button onClick={() => download('md')} className="flex-1 py-2 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/[0.06] text-indigo-300/60 hover:bg-white/[0.07] hover:text-indigo-300/90 transition-all">
        📝 .md
      </button>
    </div>
  );
}

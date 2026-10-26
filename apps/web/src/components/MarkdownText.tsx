import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface MarkdownTextProps {
  content: string;
  className?: string;
}

export const MarkdownText: React.FC<MarkdownTextProps> = ({ content, className = '' }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  // Helper to parse inline styles: bold, italic, strike, code, link
  const renderInline = (text: string) => {
    // Regex for inline elements
    const parts = [];
    let key = 0;

    // Pattern matching: inline code `code`, bold **text**, italic *text* or _text_, strike ~text~, url https://..., link [text](url)
    const inlineRegex =
      /(`[^`]+`|\*\*[^*]+\*\*|(?<!\*)\*[^*]+\*(?!\*)|~~?[^~]+~~?|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s)]+)/g;

    let lastIndex = 0;
    let match;

    while ((match = inlineRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`txt-${key++}`}>{text.substring(lastIndex, match.index)}</span>
        );
      }

      const token = match[0];

      if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={`code-${key++}`}
            className="px-1.5 py-0.5 rounded-md bg-black/40 border border-white/10 font-mono text-[12px] text-pink-300"
          >
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={`b-${key++}`} className="font-semibold text-white">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(
          <em key={`i-${key++}`} className="italic text-slate-200">
            {token.slice(1, -1)}
          </em>
        );
      } else if (token.startsWith('~') && token.endsWith('~')) {
        const clean = token.replace(/^~+|~+$/g, '');
        parts.push(
          <span key={`s-${key++}`} className="line-through opacity-70">
            {clean}
          </span>
        );
      } else if (token.startsWith('[') && match[2] && match[3]) {
        // [title](url)
        parts.push(
          <a
            key={`link-${key++}`}
            href={match[3]}
            target="_blank"
            rel="noreferrer"
            className="text-sky-400 hover:text-sky-300 underline underline-offset-2 inline-flex items-center gap-0.5"
          >
            <span>{match[2]}</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
        );
      } else if (token.startsWith('http')) {
        parts.push(
          <a
            key={`link-${key++}`}
            href={token}
            target="_blank"
            rel="noreferrer"
            className="text-sky-400 hover:text-sky-300 underline underline-offset-2 break-all inline-flex items-center gap-0.5"
          >
            <span>{token}</span>
            <ExternalLink className="w-3 h-3 opacity-70 shrink-0" />
          </a>
        );
      } else {
        parts.push(<span key={`other-${key++}`}>{token}</span>);
      }

      lastIndex = match.index + token.length;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={`end-${key++}`}>{text.substring(lastIndex)}</span>);
    }

    return parts.length > 0 ? parts : text;
  };

  // Split into lines or code blocks
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const elements = [];
  let lastPos = 0;
  let codeMatch;
  let blockIndex = 0;

  while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
    if (codeMatch.index > lastPos) {
      const textSection = content.substring(lastPos, codeMatch.index);
      elements.push(
        <div key={`sec-${blockIndex++}`} className="space-y-1">
          {renderTextLines(textSection)}
        </div>
      );
    }

    const lang = codeMatch[1] || '';
    const codeBody = codeMatch[2];
    const currentIndex = blockIndex++;

    elements.push(
      <div
        key={`codeblock-${currentIndex}`}
        className="my-2 rounded-xl bg-slate-950/80 border border-white/10 overflow-hidden font-mono text-xs shadow-inner"
      >
        <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5 text-[11px] text-slate-400">
          <span className="font-semibold uppercase tracking-wider">{lang || 'code'}</span>
          <button
            type="button"
            onClick={() => handleCopyCode(codeBody, currentIndex)}
            className="flex items-center gap-1 hover:text-white transition-colors p-1"
          >
            {copiedIndex === currentIndex ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 text-[10px]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="text-[10px]">Copy</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-3 overflow-x-auto text-slate-200 leading-relaxed whitespace-pre font-mono">
          <code>{codeBody}</code>
        </pre>
      </div>
    );

    lastPos = codeMatch.index + codeMatch[0].length;
  }

  if (lastPos < content.length) {
    const trailingText = content.substring(lastPos);
    elements.push(
      <div key={`sec-${blockIndex++}`} className="space-y-1">
        {renderTextLines(trailingText)}
      </div>
    );
  }

  function renderTextLines(text: string) {
    const lines = text.split('\n');
    return lines.map((line, lIdx) => {
      // Empty line
      if (!line.trim()) {
        return <div key={lIdx} className="h-2" />;
      }

      // Blockquote (> quote)
      if (line.startsWith('>')) {
        return (
          <blockquote
            key={lIdx}
            className="border-l-2 border-blue-400 pl-3 py-0.5 my-1 text-slate-300 italic text-[13px] bg-blue-500/5 rounded-r"
          >
            {renderInline(line.replace(/^>\s?/, ''))}
          </blockquote>
        );
      }

      // Unordered list (- or *)
      if (/^[-*]\s+/.test(line)) {
        return (
          <div key={lIdx} className="flex items-start gap-2 pl-2 my-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
            <div className="flex-1">{renderInline(line.replace(/^[-*]\s+/, ''))}</div>
          </div>
        );
      }

      // Ordered list (1. 2.)
      const numMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return (
          <div key={lIdx} className="flex items-start gap-2 pl-2 my-0.5">
            <span className="text-[11px] font-bold text-blue-400 shrink-0 font-mono mt-0.5">
              {numMatch[1]}.
            </span>
            <div className="flex-1">{renderInline(numMatch[2])}</div>
          </div>
        );
      }

      return <p key={lIdx} className="leading-relaxed break-words">{renderInline(line)}</p>;
    });
  }

  return <div className={`markdown-content select-text ${className}`}>{elements}</div>;
};

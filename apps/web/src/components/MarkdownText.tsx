import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Emoji } from './Emoji.js';
import { EMOJI_HEX_MAP } from '../constants/emojiSets.js';

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

  // Check if message is purely 1-3 emojis (e.g. someone sending just "❤️" or "👍 😂")
  const trimmed = content.trim();
  const emojiKeys = Object.keys(EMOJI_HEX_MAP).sort((a, b) => b.length - a.length);
  const regexGlobal = new RegExp(`(${emojiKeys.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const matchedEmojis = trimmed.match(regexGlobal);
  if (
    matchedEmojis &&
    matchedEmojis.join('').length === trimmed.replace(/\s+/g, '').length &&
    matchedEmojis.length <= 3
  ) {
    return (
      <div className={`flex items-center gap-2 py-1 select-text ${className}`}>
        {matchedEmojis.map((e, idx) => (
          <Emoji
            key={idx}
            emoji={e}
            size={40}
            className="w-10 h-10 inline-block pointer-events-none drop-shadow-md hover:scale-125 transition-transform"
          />
        ))}
      </div>
    );
  }

  // Helper to parse text with inline graphical emojis
  const renderTextWithEmojis = (rawText: string, baseKey: number) => {
    const regex = new RegExp(`(${emojiKeys.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
    const segments: React.ReactNode[] = [];
    let lIdx = 0;
    let m: RegExpExecArray | null;
    let subKey = 0;

    while ((m = regex.exec(rawText)) !== null) {
      if (m.index > lIdx) {
        segments.push(rawText.substring(lIdx, m.index));
      }
      segments.push(
        <Emoji
          key={`em-${baseKey}-${subKey++}`}
          emoji={m[0]}
          size={18}
          className="w-[1.25em] h-[1.25em] inline-block align-[-0.2em] mx-0.5 pointer-events-none drop-shadow-xs"
        />
      );
      lIdx = m.index + m[0].length;
    }

    if (lIdx < rawText.length) {
      segments.push(rawText.substring(lIdx));
    }

    return <React.Fragment key={`txt-${baseKey}`}>{segments}</React.Fragment>;
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
        parts.push(renderTextWithEmojis(text.substring(lastIndex, match.index), key++));
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
      } else if (token.startsWith('http://') || token.startsWith('https://')) {
        // Raw URL
        parts.push(
          <a
            key={`rawlink-${key++}`}
            href={token}
            target="_blank"
            rel="noreferrer"
            className="text-sky-400 hover:text-sky-300 underline underline-offset-2 break-all"
          >
            {token}
          </a>
        );
      }

      lastIndex = match.index + token.length;
    }

    if (lastIndex < text.length) {
      parts.push(renderTextWithEmojis(text.substring(lastIndex), key++));
    }

    return parts;
  };

  // Helper to split markdown into blocks (code blocks, headers, quotes, lists, paragraphs)
  const blocks: Array<{ type: 'code' | 'text'; lang?: string; content: string }> = [];
  const lines = content.split('\n');

  let inCodeBlock = false;
  let codeLang = '';
  let codeBuffer: string[] = [];
  let textBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        blocks.push({
          type: 'code',
          lang: codeLang,
          content: codeBuffer.join('\n'),
        });
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        // Flush preceding text buffer
        if (textBuffer.length > 0) {
          blocks.push({
            type: 'text',
            content: textBuffer.join('\n'),
          });
          textBuffer = [];
        }
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
    } else {
      textBuffer.push(line);
    }
  }

  // Flush remaining buffers
  if (inCodeBlock && codeBuffer.length > 0) {
    blocks.push({
      type: 'code',
      lang: codeLang,
      content: codeBuffer.join('\n'),
    });
  } else if (textBuffer.length > 0) {
    blocks.push({
      type: 'text',
      content: textBuffer.join('\n'),
    });
  }

  const elements: React.ReactNode[] = [];

  blocks.forEach((block, bIdx) => {
    if (block.type === 'code') {
      elements.push(
        <div
          key={`block-${bIdx}`}
          className="my-2 rounded-xl overflow-hidden border border-white/10 bg-black/60 shadow-inner group/code"
        >
          <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5 text-[11px] text-slate-400 font-mono">
            <span>{block.lang || 'code'}</span>
            <button
              type="button"
              onClick={() => handleCopyCode(block.content, bIdx)}
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              {copiedIndex === bIdx ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-3 overflow-x-auto text-xs font-mono text-emerald-300/90 leading-relaxed selection:bg-emerald-900/50">
            <code>{block.content}</code>
          </pre>
        </div>
      );
    } else {
      // Process text block line by line
      const textLines = block.content.split('\n');

      textLines.forEach((line, lIdx) => {
        // Headers (#, ##, ###)
        if (line.startsWith('# ')) {
          elements.push(
            <h1 key={`h1-${bIdx}-${lIdx}`} className="text-base font-bold text-white mt-2 mb-1">
              {renderInline(line.slice(2))}
            </h1>
          );
          return;
        }
        if (line.startsWith('## ')) {
          elements.push(
            <h2 key={`h2-${bIdx}-${lIdx}`} className="text-sm font-bold text-white mt-1.5 mb-1">
              {renderInline(line.slice(3))}
            </h2>
          );
          return;
        }
        if (line.startsWith('### ')) {
          elements.push(
            <h3 key={`h3-${bIdx}-${lIdx}`} className="text-xs font-semibold text-slate-200 mt-1 mb-0.5">
              {renderInline(line.slice(4))}
            </h3>
          );
          return;
        }

        // Empty lines
        if (!line.trim()) {
          elements.push(<div key={`empty-${bIdx}-${lIdx}`} className="h-2" />);
          return;
        }

        // Blockquote (> quote)
        if (line.startsWith('>')) {
          elements.push(
            <blockquote
              key={`quote-${bIdx}-${lIdx}`}
              className="border-l-2 border-blue-400 pl-3 py-0.5 my-1 text-slate-300 italic text-[13px] bg-blue-500/5 rounded-r"
            >
              {renderInline(line.replace(/^>\s?/, ''))}
            </blockquote>
          );
          return;
        }

        // Unordered list (- or *)
        if (/^[-*]\s+/.test(line)) {
          elements.push(
            <div key={`ul-${bIdx}-${lIdx}`} className="flex items-start gap-2 pl-2 my-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
              <div className="flex-1">{renderInline(line.replace(/^[-*]\s+/, ''))}</div>
            </div>
          );
          return;
        }

        // Ordered list (1. 2.)
        const numMatch = line.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          elements.push(
            <div key={`ol-${bIdx}-${lIdx}`} className="flex items-start gap-2 pl-2 my-0.5">
              <span className="text-[11px] font-bold text-blue-400 shrink-0 font-mono mt-0.5">
                {numMatch[1]}.
              </span>
              <div className="flex-1">{renderInline(numMatch[2])}</div>
            </div>
          );
          return;
        }

        elements.push(
          <p key={`p-${bIdx}-${lIdx}`} className="leading-relaxed break-words">
            {renderInline(line)}
          </p>
        );
      });
    }
  });

  return <div className={`markdown-content select-text ${className}`}>{elements}</div>;
};

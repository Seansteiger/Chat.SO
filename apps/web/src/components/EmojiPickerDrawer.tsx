import React, { useState, useRef, useEffect } from 'react';
import { EMOJI_PICKER_CATEGORIES, EMOJI_HEX_MAP } from '../constants/emojiSets.js';
import { Emoji } from './Emoji.js';
import { Search, X, Smile } from 'lucide-react';

interface EmojiPickerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  title?: string;
}

export const EmojiPickerDrawer: React.FC<EmojiPickerDrawerProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  title = 'Reactions & Emojis',
}) => {
  const [activeTab, setActiveTab] = useState('reactions');
  const [searchQuery, setSearchQuery] = useState('');
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const allAvailableEmojis = Object.keys(EMOJI_HEX_MAP);
  const filteredEmojis = searchQuery.trim()
    ? allAvailableEmojis
    : (EMOJI_PICKER_CATEGORIES.find((c) => c.id === activeTab)?.emojis || allAvailableEmojis);

  return (
    <div
      ref={drawerRef}
      className="absolute bottom-full mb-3 left-2 sm:left-4 z-50 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-slate-900/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10 p-3.5 animate-in fade-in zoom-in-95 duration-150 text-white select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <Smile className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold tracking-wide text-slate-200">{title}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Category Tabs */}
      {!searchQuery && (
        <div className="flex items-center gap-1 pb-2 mb-2 border-b border-white/10 overflow-x-auto no-scrollbar">
          {EMOJI_PICKER_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveTab(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap shrink-0 ${
                activeTab === cat.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative mb-2.5">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter emojis..."
          className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Emoji Grid */}
      <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
        {filteredEmojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onSelectEmoji(emoji);
            }}
            title={emoji}
            className="w-8 h-8 rounded-lg hover:bg-white/15 active:scale-90 hover:scale-125 transition-all duration-150 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Emoji emoji={emoji} size={22} className="w-5 h-5 pointer-events-none drop-shadow-sm" />
          </button>
        ))}
      </div>
    </div>
  );
};

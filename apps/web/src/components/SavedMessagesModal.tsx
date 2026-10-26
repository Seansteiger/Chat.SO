import React, { useState, useEffect } from 'react';
import { convex, api as convexApi } from '../convex.js';
import { useAuth } from '../hooks/useAuth.js';
import {
  X,
  Bookmark,
  Trash2,
  FileText,
  Download,
  Search,
} from 'lucide-react';
import { MarkdownText } from './MarkdownText.js';

interface SavedMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SavedMessagesModal: React.FC<SavedMessagesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user: currentUser } = useAuth();
  const [savedMessages, setSavedMessages] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen || !currentUser?.id) return;

    let unsub: (() => void) | null = null;
    try {
      const watch = (convex as any).watchQuery(convexApi.messages.listSavedMessages, {
        userId: currentUser.id as any,
      });

      unsub = watch.onUpdate(() => {
        const res = watch.localQueryResult();
        if (Array.isArray(res)) {
          setSavedMessages(res);
        }
      });
    } catch (err) {
      console.warn('Saved messages watch query error:', err);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [currentUser?.id, isOpen]);

  if (!isOpen) return null;

  const handleUnsave = async (messageId: string) => {
    if (!currentUser?.id) return;
    try {
      await (convex as any).mutation(convexApi.messages.unsaveMessage, {
        userId: currentUser.id as any,
        messageId: messageId as any,
      });
    } catch (err) {
      console.error('Failed to unsave message:', err);
    }
  };

  const filtered = savedMessages.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (m.content && m.content.toLowerCase().includes(q)) ||
      (m.senderName && m.senderName.toLowerCase().includes(q)) ||
      (m.attachmentName && m.attachmentName.toLowerCase().includes(q))
    );
  });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[85vh] bg-slate-950 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Bookmark className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Personal Vault & Bookmarks</h3>
              <p className="text-[11px] text-slate-400">Saved thoughts, notes and important messages</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-white/5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bookmarks..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
              <p className="font-medium text-slate-300">No saved messages</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                Hover any message in chat and click the bookmark icon to save it here quietly for future reference.
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item._id}
                className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 space-y-2 group"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{item.senderName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">
                      {new Date(item.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUnsave(item.messageId)}
                      title="Remove from vault"
                      className="text-slate-400 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {item.content && (
                  <MarkdownText content={item.content} className="text-xs text-slate-200" />
                )}

                {item.attachmentUrl && (
                  <a
                    href={item.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-white/5 text-xs text-slate-300 hover:text-white"
                  >
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span className="truncate flex-1">{item.attachmentName || 'Attachment'}</span>
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

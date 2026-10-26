import React, { useState, useEffect } from 'react';
import { convex, api as convexApi } from '../convex.js';
import {
  X,
  Image as ImageIcon,
  FileText,
  Mic,
  Link2,
  Pin,
  Download,
  ExternalLink,
} from 'lucide-react';
import { VoiceNotePlayer } from './VoiceNotePlayer.js';

interface ContextDrawerProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
  onJumpToMessage?: (messageId: string) => void;
}

export const ContextDrawer: React.FC<ContextDrawerProps> = ({
  conversationId,
  isOpen,
  onClose,
  onJumpToMessage,
}) => {
  const [activeTab, setActiveTab] = useState<'media' | 'files' | 'voice' | 'links' | 'pinned'>('media');
  const [contextData, setContextData] = useState<{
    media: any[];
    files: any[];
    voice: any[];
    links: any[];
    pinned: any[];
  }>({
    media: [],
    files: [],
    voice: [],
    links: [],
    pinned: [],
  });

  useEffect(() => {
    if (!isOpen || !conversationId) return;

    let unsub: (() => void) | null = null;
    try {
      const watch = (convex as any).watchQuery(convexApi.messages.getConversationContext, {
        conversationId: conversationId as any,
      });

      unsub = watch.onUpdate(() => {
        const res = watch.localQueryResult();
        if (res) {
          setContextData(res);
        }
      });
    } catch (err) {
      console.warn('Context drawer watch query error:', err);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [conversationId, isOpen]);

  if (!isOpen) return null;

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 md:w-96 bg-slate-950/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-40 flex flex-col transition-transform animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-16 px-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Conversation Context</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-white/5 bg-slate-900/50 overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('media')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
            activeTab === 'media'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Media ({contextData.media.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
            activeTab === 'files'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Files ({contextData.files.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('voice')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
            activeTab === 'voice'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Voice ({contextData.voice.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('links')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
            activeTab === 'links'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>Links ({contextData.links.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pinned')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
            activeTab === 'pinned'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Pin className="w-3.5 h-3.5" />
          <span>Pinned ({contextData.pinned.length})</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {activeTab === 'media' && (
          contextData.media.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No media shared in this conversation yet.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {contextData.media.map((m) => (
                <a
                  key={m._id}
                  href={m.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-blue-400/50 transition-all group relative bg-slate-900"
                >
                  <img
                    src={m.attachmentUrl}
                    alt={m.attachmentName || 'Media'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </a>
              ))}
            </div>
          )
        )}

        {activeTab === 'files' && (
          contextData.files.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No documents shared in this conversation yet.
            </div>
          ) : (
            <div className="space-y-2">
              {contextData.files.map((f) => (
                <a
                  key={f._id}
                  href={f.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={f.attachmentName || true}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-white/10 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {f.attachmentName || 'Shared File'}
                    </p>
                    <p className="text-[10px] text-slate-400 tabular-numbers">
                      {formatFileSize(f.attachmentSize)}
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 shrink-0" />
                </a>
              ))}
            </div>
          )
        )}

        {activeTab === 'voice' && (
          contextData.voice.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No voice notes recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {contextData.voice.map((v) => (
                <div key={v._id} className="p-2 rounded-xl bg-slate-900/60 border border-white/10">
                  <VoiceNotePlayer
                    audioUrl={v.attachmentUrl}
                    duration={v.voiceDuration}
                  />
                  <div className="text-[10px] text-slate-400 mt-1 pl-1">
                    {new Date(v.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'links' && (
          contextData.links.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No links detected in messages.
            </div>
          ) : (
            <div className="space-y-2">
              {contextData.links.map((l, idx) => (
                <a
                  key={idx}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-white/10 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-sky-400 truncate group-hover:underline">
                      {l.url}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(l.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
                </a>
              ))}
            </div>
          )
        )}

        {activeTab === 'pinned' && (
          contextData.pinned.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No messages pinned in this chat.
            </div>
          ) : (
            <div className="space-y-2">
              {contextData.pinned.map((p) => (
                <div
                  key={p._id}
                  onClick={() => onJumpToMessage?.(p._id)}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-white/10 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-400 mb-1">
                    <Pin className="w-3 h-3" />
                    <span>Pinned Message</span>
                  </div>
                  <p className="text-xs text-slate-200 line-clamp-3">{p.content}</p>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {new Date(p.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

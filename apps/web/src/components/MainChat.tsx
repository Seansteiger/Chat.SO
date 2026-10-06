import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, MessageDto, MAX_FILE_SIZE_BYTES } from '@chatso/shared';
import { useAuth } from '../hooks/useAuth.js';
import { uploadFileDirectly, DirectUploadResult } from '../services/uploader.js';
import {
  Phone,
  Video,
  Paperclip,
  Send,
  Check,
  CheckCheck,
  FileText,
  Download,
  X,
  AlertCircle,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';

interface MainChatProps {
  peer: UserProfile;
  messages: MessageDto[];
  isPeerTyping: boolean;
  onSendMessage: (params: {
    content: string;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentSize?: number;
    attachmentMime?: string;
  }) => void;
  onSendTyping: (isTyping: boolean) => void;
  onStartCall: (isVideo: boolean) => void;
  onBack?: () => void;
}

export const MainChat: React.FC<MainChatProps> = ({
  peer,
  messages,
  isPeerTyping,
  onSendMessage,
  onSendTyping,
  onStartCall,
  onBack,
}) => {
  const { user: currentUser } = useAuth();
  const [inputText, setInputText] = useState('');
  const [activeUpload, setActiveUpload] = useState<{
    fileName: string;
    progress: number;
    loadedBytes: number;
    totalBytes: number;
    controller?: AbortController;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping, activeUpload]);

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onSendTyping(true);

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      onSendTyping(false);
    }, 1500);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !activeUpload) return;

    if (inputText.trim()) {
      onSendMessage({ content: inputText.trim() });
      setInputText('');
      onSendTyping(false);
    }
  };

  // Direct-to-Cloud File Upload (Strict 50MB ceiling)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = '';
    setErrorMessage(null);

    // Strict 50MB Client-Side Check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 50MB hard ceiling.`
      );
      return;
    }

    const abortController = new AbortController();
    setActiveUpload({
      fileName: file.name,
      progress: 0,
      loadedBytes: 0,
      totalBytes: file.size,
      controller: abortController,
    });

    try {
      const uploadResult: DirectUploadResult = await uploadFileDirectly(
        file,
        (progress, loaded, total) => {
          setActiveUpload({
            fileName: file.name,
            progress,
            loadedBytes: loaded,
            totalBytes: total,
            controller: abortController,
          });
        },
        abortController.signal
      );

      // On successful direct upload, emit completed asset reference via chat:send
      onSendMessage({
        content: `Shared file: ${uploadResult.fileName}`,
        attachmentUrl: uploadResult.publicUrl,
        attachmentName: uploadResult.fileName,
        attachmentSize: uploadResult.fileSize,
        attachmentMime: uploadResult.mimeType,
      });

      setActiveUpload(null);
    } catch (err: any) {
      console.error('[Upload] Direct upload failed:', err);
      setErrorMessage(err.message || 'File upload failed');
      setActiveUpload(null);
    }
  };

  const cancelUpload = () => {
    if (activeUpload?.controller) {
      activeUpload.controller.abort();
    }
    setActiveUpload(null);
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#090d16] relative overflow-hidden">
      {/* Chat Top Bar */}
      <div className="h-16 px-3.5 md:px-6 border-b border-white/10 flex items-center justify-between bg-slate-950/60 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to chats"
              className="md:hidden p-2 -ml-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="relative shrink-0">
            {peer.avatarUrl ? (
              <img
                src={peer.avatarUrl}
                alt={peer.displayName}
                className="w-10 h-10 rounded-xl object-cover border border-white/10"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white text-sm">
                {peer.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
                peer.status === 'ONLINE'
                  ? 'bg-emerald-500'
                  : peer.status === 'BUSY'
                  ? 'bg-amber-500'
                  : 'bg-slate-500'
              }`}
            />
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">{peer.displayName}</h2>
            <p className="text-[11px] text-slate-400 truncate">
              @{peer.username} · <span className="capitalize">{peer.status.toLowerCase()}</span>
            </p>
          </div>
        </div>

        {/* WebRTC Audio & Video Calling Triggers */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onStartCall(false)}
            title="Start Voice Call"
            className="p-2.5 rounded-xl hover:bg-white/5 border border-white/5 text-slate-300 hover:text-white transition-all hover:border-emerald-500/30"
          >
            <Phone className="w-4 h-4 text-emerald-400" />
          </button>
          <button
            type="button"
            onClick={() => onStartCall(true)}
            title="Start Video Call"
            className="p-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 hover:text-white transition-all shadow-md shadow-blue-500/10"
          >
            <Video className="w-4 h-4 text-blue-400" />
          </button>
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
              <Paperclip className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-300">Start the conversation</p>
            <p className="text-xs text-slate-500 mt-1">Send a message or share a file (up to 50MB)</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser?.id;
            const isImage = msg.attachmentMime?.startsWith('image/');

            return (
              <div
                key={msg.id || msg.clientMessageId}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[75%] sm:max-w-[65%] rounded-2xl p-3.5 shadow-sm text-sm ${
                    isMe
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-xs'
                      : 'bg-slate-800/80 border border-white/5 text-slate-100 rounded-bl-xs'
                  }`}
                >
                  {/* File / Image Attachment */}
                  {msg.attachmentUrl && (
                    <div className="mb-2.5">
                      {isImage ? (
                        <div
                          onClick={() => setPreviewImageModal(msg.attachmentUrl || null)}
                          className="cursor-pointer group relative rounded-xl overflow-hidden border border-white/10 max-h-60"
                        >
                          <img
                            src={msg.attachmentUrl}
                            alt={msg.attachmentName || 'Attachment'}
                            className="w-full h-auto object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      ) : (
                        <a
                          href={msg.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          download={msg.attachmentName || true}
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-black/20 hover:bg-black/30 border border-white/10 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate text-white">
                              {msg.attachmentName || 'Download File'}
                            </p>
                            <p className="text-[10px] text-white/70 tabular-numbers">
                              {formatFileSize(msg.attachmentSize)}
                            </p>
                          </div>
                          <Download className="w-4 h-4 text-white/80 shrink-0" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Message Text */}
                  {msg.content && <p className="leading-relaxed break-words">{msg.content}</p>}

                  {/* Timestamp & Delivery Checkmarks */}
                  <div
                    className={`flex items-center justify-end gap-1 text-[10px] mt-1.5 ${
                      isMe ? 'text-blue-200/80' : 'text-slate-400'
                    }`}
                  >
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isMe && (
                      <span className="ml-0.5">
                        {msg.status === 'READ' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />
                        ) : msg.status === 'DELIVERED' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-white/80" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-white/60" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Live Typing Indicator */}
        {isPeerTyping && (
          <div className="flex items-center gap-2 text-xs text-slate-400 pl-2 animate-pulse">
            <span className="font-medium text-slate-300">{peer.displayName}</span>
            <span>is typing</span>
            <span className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" />
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="mx-4 mb-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="p-1 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Direct Cloud Upload Progress Card */}
      {activeUpload && (
        <div className="mx-4 mb-3 p-3 rounded-xl bg-slate-900 border border-blue-500/30 shadow-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-white truncate max-w-[200px]">
                {activeUpload.fileName}
              </span>
              <span className="text-blue-400 font-mono text-[11px] tabular-numbers">
                {activeUpload.progress}% ({formatFileSize(activeUpload.loadedBytes)} /{' '}
                {formatFileSize(activeUpload.totalBytes)})
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-150"
                style={{ width: `${activeUpload.progress}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={cancelUpload}
            title="Cancel Upload"
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Form */}
      <div className="p-3 md:p-4 border-t border-white/10 bg-slate-950/80 backdrop-blur-md pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          {/* File input trigger */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file (Max 50MB direct to cloud)"
            disabled={!!activeUpload}
            className="p-2.5 rounded-xl hover:bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-40"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder={`Message @${peer.username}...`}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900/70 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:hover:bg-blue-600 transition-all shadow-md shadow-blue-600/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Image Zoom Modal */}
      {previewImageModal && (
        <div
          onClick={() => setPreviewImageModal(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={previewImageModal}
              alt="Preview"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <a
              href={previewImageModal}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="absolute top-4 right-4 p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white border border-white/10 shadow-lg flex items-center gap-1.5 text-xs font-semibold"
            >
              <ExternalLink className="w-4 h-4" />
              Open Original
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

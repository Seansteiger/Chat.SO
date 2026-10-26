import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, MessageDto, MAX_FILE_SIZE_BYTES } from '@chatso/shared';
import { useAuth } from '../hooks/useAuth.js';
import { uploadFileDirectly, DirectUploadResult } from '../services/uploader.js';
import { api } from '../services/api.js';
import { convex, api as convexApi } from '../convex.js';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
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
  Reply,
  Edit2,
  Trash2,
  Bookmark,
  Pin,
  Search,
  Mic,
  Square,
  BellOff,
  Bell,
  BarChart3,
  PanelRight,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { MarkdownText } from './MarkdownText.js';
import { VoiceNotePlayer } from './VoiceNotePlayer.js';
import { PollCard } from './PollCard.js';
import { ContextDrawer } from './ContextDrawer.js';
import { CreatePollModal } from './CreatePollModal.js';

interface MainChatProps {
  peer: UserProfile;
  conversationId?: string;
  conversationStatus?: 'ACCEPTED' | 'PENDING' | 'DECLINED';
  initiatorId?: string;
  isSelfVault?: boolean;
  pinnedMessageId?: string;
  messages: MessageDto[];
  isPeerTyping: boolean;
  onSendMessage: (params: {
    content: string;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentSize?: number;
    attachmentMime?: string;
    replyToId?: string;
    isSilent?: boolean;
    voiceDuration?: number;
    pollId?: string;
  }) => void;
  onSendTyping: (isTyping: boolean) => void;
  onStartCall: (isVideo: boolean) => void;
  onBack?: () => void;
}

export const MainChat: React.FC<MainChatProps> = ({
  peer,
  conversationId,
  conversationStatus = 'ACCEPTED',
  initiatorId,
  isSelfVault = false,
  pinnedMessageId,
  messages,
  isPeerTyping,
  onSendMessage,
  onSendTyping,
  onStartCall,
  onBack,
}) => {
  const { user: currentUser } = useAuth();
  const [inputText, setInputText] = useState('');
  const [isSilent, setIsSilent] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageDto | null>(null);

  // In-chat search
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Context drawer
  const [isContextDrawerOpen, setIsContextDrawerOpen] = useState(false);

  // Poll modal
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);

  // Editing message
  const [editingMessage, setEditingMessage] = useState<MessageDto | null>(null);
  const [editText, setEditText] = useState('');

  // Voice recording
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // File upload state
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
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping, activeUpload]);

  // Handle typing debounce (respecting user privacy)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (currentUser?.sendTypingIndicators !== false) {
      onSendTyping(true);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        onSendTyping(false);
      }, 1500);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !activeUpload) return;

    if (inputText.trim()) {
      onSendMessage({
        content: inputText.trim(),
        replyToId: replyingTo?.id,
        isSilent,
      });
      setInputText('');
      setReplyingTo(null);
      if (currentUser?.sendTypingIndicators !== false) {
        onSendTyping(false);
      }
    }
  };

  // Editing message handlers
  const handleStartEdit = (msg: MessageDto) => {
    setEditingMessage(msg);
    setEditText(msg.content);
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !editText.trim()) return;
    try {
      await api.editMessage(editingMessage.id, editText.trim());
      setEditingMessage(null);
      setEditText('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to edit message');
    }
  };

  // Deleting message handler
  const handleDeleteMessage = async (msgId: string) => {
    try {
      await api.deleteMessage(msgId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete message');
    }
  };

  // Reaction handler
  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      await api.toggleReaction(messageId, emoji);
    } catch (err: any) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  // Bookmark / save message handler
  const handleSaveMessage = async (messageId: string) => {
    try {
      await api.saveMessage(messageId);
    } catch (err: any) {
      console.error('Failed to save message:', err);
    }
  };

  // Pin message handler
  const handleTogglePin = async (messageId: string) => {
    if (!conversationId) return;
    try {
      await api.togglePinMessage(conversationId, messageId);
    } catch (err: any) {
      console.error('Failed to toggle pin:', err);
    }
  };

  // Handshake response handler
  const handleHandshake = async (action: 'ACCEPT' | 'DECLINE') => {
    if (!conversationId) return;
    try {
      await api.respondToHandshake(conversationId, action);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to respond to request');
    }
  };

  // Jump to specific message
  const jumpToMessage = (messageId: string) => {
    const el = messageRefs.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-blue-400', 'bg-blue-500/10');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-blue-400', 'bg-blue-500/10');
      }, 2000);
    }
  };

  // Search match computation
  const matchingMessageIds = searchKeyword.trim()
    ? messages
        .filter(
          (m) =>
            !m.isDeleted &&
            ((m.content && m.content.toLowerCase().includes(searchKeyword.toLowerCase())) ||
              (m.attachmentName && m.attachmentName.toLowerCase().includes(searchKeyword.toLowerCase())))
        )
        .map((m) => m.id)
    : [];

  const handleNextSearchMatch = () => {
    if (matchingMessageIds.length === 0) return;
    const next = (currentMatchIndex + 1) % matchingMessageIds.length;
    setCurrentMatchIndex(next);
    jumpToMessage(matchingMessageIds[next]);
  };

  const handlePrevSearchMatch = () => {
    if (matchingMessageIds.length === 0) return;
    const prev = (currentMatchIndex - 1 + matchingMessageIds.length) % matchingMessageIds.length;
    setCurrentMatchIndex(prev);
    jumpToMessage(matchingMessageIds[prev]);
  };

  // Direct File Select
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setErrorMessage(null);

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

      onSendMessage({
        content: `Shared file: ${uploadResult.fileName}`,
        attachmentUrl: uploadResult.publicUrl,
        attachmentName: uploadResult.fileName,
        attachmentSize: uploadResult.fileSize,
        attachmentMime: uploadResult.mimeType,
        replyToId: replyingTo?.id,
        isSilent,
      });

      setActiveUpload(null);
      setReplyingTo(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'File upload failed');
      setActiveUpload(null);
    }
  };

  // Voice recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime =
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/ogg';

      const mediaRecorder = new MediaRecorder(
        stream,
        preferredMime ? { mimeType: preferredMime } : undefined
      );
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const mimeType = preferredMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach((t) => t.stop());

        if (audioBlob.size > 0 && conversationId && currentUser) {
          try {
            const uploadUrl = await (convex as any).mutation(convexApi.files.generateUploadUrl, {
              fileSize: audioBlob.size,
            });
            const response = await fetch(uploadUrl, {
              method: 'POST',
              headers: { 'Content-Type': mimeType },
              body: audioBlob,
            });
            const json = await response.json();
            const storageId = json.storageId;
            const publicUrl = `${uploadUrl.split('/api')[0]}/api/storage/${storageId}`;
            const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';

            onSendMessage({
              content: '🎤 Voice note',
              attachmentUrl: publicUrl,
              attachmentName: `voice_note.${ext}`,
              attachmentSize: audioBlob.size,
              attachmentMime: mimeType,
              voiceDuration: recordingSeconds,
              replyToId: replyingTo?.id,
              isSilent,
            });
          } catch (err) {
            console.error('Failed to send voice note:', err);
          }
        }
        setIsRecordingVoice(false);
        setRecordingSeconds(0);
        setReplyingTo(null);
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && isRecordingVoice) {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  };

  // Date divider calculation
  const getDateLabel = (ts: string | number | Date) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const y = new Date();
    y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const quietReactions = ['👍', '❤️', '🙏', '💡', '✅'];

  // Check social battery state
  const isPeerLowBattery = peer.status === 'LOW_BATTERY';
  const isPeerDeepFocus = peer.status === 'DEEP_FOCUS';
  const isPeerCallsMuted = isPeerLowBattery || isPeerDeepFocus || peer.allowCalls === false;

  const isPendingHandshake = conversationStatus === 'PENDING' && initiatorId !== currentUser?.id;
  const pinnedMessage = messages.find((m) => m.isPinned || (pinnedMessageId && m.id === pinnedMessageId));

  return (
    <div className="flex-1 h-full flex flex-col bg-[#090d16] relative overflow-hidden">
      {/* Top Bar */}
      <div className="h-16 px-3.5 md:px-6 border-b border-white/10 flex items-center justify-between bg-slate-950/70 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to chats"
              className="md:hidden p-2 -ml-1.5 rounded-xl text-slate-400 hover:text-white transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="relative shrink-0">
            {isSelfVault ? (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center font-bold text-white text-sm shadow-md">
                <Bookmark className="w-5 h-5 fill-current" />
              </div>
            ) : peer.avatarUrl ? (
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
            {!isSelfVault && (
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
                  peer.status === 'ONLINE'
                    ? 'bg-emerald-500'
                    : peer.status === 'LOW_BATTERY'
                    ? 'bg-amber-400'
                    : peer.status === 'DEEP_FOCUS'
                    ? 'bg-purple-500'
                    : peer.status === 'BUSY'
                    ? 'bg-rose-500'
                    : 'bg-slate-500'
                }`}
              />
            )}
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">
              {isSelfVault ? 'My Space (Personal Vault)' : peer.displayName}
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
              {isSelfVault ? (
                <span>Notes, ideas & cross-device file transfer</span>
              ) : (
                <>
                  <span>@{peer.username}</span>
                  <span>·</span>
                  <span
                    className={`font-medium ${
                      peer.status === 'LOW_BATTERY'
                        ? 'text-amber-400'
                        : peer.status === 'DEEP_FOCUS'
                        ? 'text-purple-400'
                        : peer.status === 'ONLINE'
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {peer.status === 'LOW_BATTERY'
                      ? 'Low Battery (Async Only)'
                      : peer.status === 'DEEP_FOCUS'
                      ? 'Deep Focus (Quiet Hours)'
                      : peer.status.toLowerCase()}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Search within chat toggle */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            title="Search messages in chat"
            className={`p-2 rounded-xl border transition-colors ${
              isSearchOpen
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                : 'hover:bg-white/5 border-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Context Drawer Toggle */}
          {conversationId && (
            <button
              type="button"
              onClick={() => setIsContextDrawerOpen(true)}
              title="Media, Files, Links & Context"
              className="p-2 rounded-xl hover:bg-white/5 border border-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <PanelRight className="w-4 h-4" />
            </button>
          )}

          {/* WebRTC Calling Buttons */}
          {!isSelfVault && (
            <>
              <button
                type="button"
                onClick={() => onStartCall(false)}
                disabled={isPeerCallsMuted}
                title={
                  isPeerCallsMuted
                    ? `${peer.displayName} is in quiet/focus mode (calls muted)`
                    : 'Start Voice Call'
                }
                className="p-2.5 rounded-xl hover:bg-white/5 border border-white/5 text-slate-300 hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Phone className="w-4 h-4 text-emerald-400" />
              </button>
              <button
                type="button"
                onClick={() => onStartCall(true)}
                disabled={isPeerCallsMuted}
                title={
                  isPeerCallsMuted
                    ? `${peer.displayName} is in quiet/focus mode (calls muted)`
                    : 'Start Video Call'
                }
                className="p-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 hover:text-white transition-all disabled:opacity-30"
              >
                <Video className="w-4 h-4 text-blue-400" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* In-Chat Search Bar */}
      {isSearchOpen && (
        <div className="px-4 py-2.5 bg-slate-900 border-b border-white/10 flex items-center justify-between gap-3 text-xs animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 flex-1">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setCurrentMatchIndex(0);
              }}
              placeholder="Search in conversation..."
              className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none"
            />
          </div>
          {searchKeyword.trim() && (
            <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px] shrink-0">
              <span>
                {matchingMessageIds.length > 0 ? currentMatchIndex + 1 : 0} of {matchingMessageIds.length}
              </span>
              <button
                type="button"
                onClick={handlePrevSearchMatch}
                disabled={matchingMessageIds.length === 0}
                className="px-1.5 py-0.5 rounded hover:bg-white/10 disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={handleNextSearchMatch}
                disabled={matchingMessageIds.length === 0}
                className="px-1.5 py-0.5 rounded hover:bg-white/10 disabled:opacity-30"
              >
                ▼
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen(false);
              setSearchKeyword('');
            }}
            className="p-1 hover:text-white text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pinned Message Sticky Banner */}
      {pinnedMessage && (
        <div
          onClick={() => jumpToMessage(pinnedMessage.id)}
          className="px-4 py-2 bg-amber-950/20 border-b border-amber-500/20 flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-amber-950/30 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold text-amber-300 shrink-0">Pinned Message:</span>
            <span className="text-slate-300 truncate">{pinnedMessage.content}</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTogglePin(pinnedMessage.id);
            }}
            title="Unpin message"
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Handshake Gatekeeper Request Banner */}
      {isPendingHandshake && (
        <div className="m-4 p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/80 to-slate-900 border border-blue-500/30 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-white">Quiet Handshake Gatekeeper</p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                {peer.displayName} wants to connect with you. Until you accept, they cannot call you or view your social battery presence.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => handleHandshake('DECLINE')}
              className="px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-semibold"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => handleHandshake('ACCEPT')}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Accept Handshake</span>
            </button>
          </div>
        </div>
      )}

      {/* Social Battery Notice for Caller */}
      {!isSelfVault && isPeerCallsMuted && (
        <div className="mx-4 mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-xs text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            {peer.displayName} has set their status to{' '}
            <strong>{peer.status === 'LOW_BATTERY' ? 'Low Battery' : 'Deep Focus'}</strong>. Audio and video calls are silenced to respect their focus.
          </span>
        </div>
      )}

      {/* Message Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
              <Paperclip className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-300">
              {isSelfVault ? 'Your Personal Vault' : 'Start the conversation'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs text-center">
              {isSelfVault
                ? 'Send notes, snippets, and files to yourself. Fully synced across all your devices.'
                : 'Send a quiet message, share a file, or send a voice note.'}
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === currentUser?.id;
            const isImage = msg.attachmentMime?.startsWith('image/');
            const isCallLog = msg.attachmentMime?.startsWith('call/');
            const isVideoCall = msg.attachmentMime === 'call/video';
            const isMissed = msg.content?.toLowerCase().includes('missed');
            const isDeclined = msg.content?.toLowerCase().includes('declined');

            // Date divider check
            const prevMsg = messages[index - 1];
            const showDateDivider =
              !prevMsg || getDateLabel(msg.createdAt) !== getDateLabel(prevMsg.createdAt);

            if (isCallLog) {
              return (
                <React.Fragment key={msg.id || msg.clientMessageId}>
                  {showDateDivider && (
                    <div className="flex items-center justify-center my-4">
                      <span className="px-3 py-1 rounded-full bg-slate-900 border border-white/10 text-[10px] font-semibold tracking-wider uppercase text-slate-400">
                        {getDateLabel(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  <div className={`flex flex-col my-1.5 ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg max-w-[85%] sm:max-w-[75%] transition-all hover:border-white/20">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isMissed
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : isDeclined
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {isVideoCall ? (
                          <Video className="w-5 h-5" />
                        ) : isMissed ? (
                          <PhoneMissed className="w-5 h-5" />
                        ) : isMe ? (
                          <PhoneOutgoing className="w-5 h-5" />
                        ) : (
                          <PhoneIncoming className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white">
                          {isVideoCall ? 'Video Call' : 'Voice Call'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {isMissed ? (
                            <span className="text-rose-400 font-medium">
                              {isMe ? 'Unanswered' : 'Missed call'}
                            </span>
                          ) : isDeclined ? (
                            <span className="text-slate-400">Declined</span>
                          ) : (
                            <span className="text-slate-300">
                              {isMe ? 'Outgoing' : 'Incoming'}
                            </span>
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onStartCall(isVideoCall)}
                        title="Call back"
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white border border-white/10 transition-all shrink-0 active:scale-95"
                      >
                        {isVideoCall ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                      </button>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 text-[10px] mt-1 text-slate-500 select-none ${
                        isMe ? 'mr-1 justify-end' : 'ml-1 justify-start'
                      }`}
                    >
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </React.Fragment>
              );
            }

            return (
              <React.Fragment key={msg.id || msg.clientMessageId}>
                {/* Date Divider Pill */}
                {showDateDivider && (
                  <div className="flex items-center justify-center my-4">
                    <span className="px-3 py-1 rounded-full bg-slate-900 border border-white/10 text-[10px] font-semibold tracking-wider uppercase text-slate-400">
                      {getDateLabel(msg.createdAt)}
                    </span>
                  </div>
                )}

                <div
                  ref={(el) => {
                    messageRefs.current[msg.id] = el;
                  }}
                  className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'} transition-colors duration-300`}
                >
                  {/* Message Bubble */}
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 sm:px-4 sm:py-3 shadow-md text-sm relative transition-all ${
                      isMe
                        ? 'bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 text-white rounded-br-xs border border-blue-400/20'
                        : 'bg-slate-800/90 border border-white/10 text-slate-100 rounded-bl-xs'
                    }`}
                  >
                    {/* Reply Quote Banner inside bubble */}
                    {msg.replySnippet && (
                      <div
                        onClick={() => msg.replyToId && jumpToMessage(msg.replyToId)}
                        className="mb-2 p-2 rounded-xl bg-black/25 border-l-2 border-white/60 text-xs cursor-pointer hover:bg-black/35 transition-colors"
                      >
                        <span className="font-semibold text-white/90 block text-[11px]">
                          {msg.replySnippet.senderName}
                        </span>
                        <p className="text-white/70 truncate text-[11px]">
                          {msg.replySnippet.content}
                        </p>
                      </div>
                    )}

                    {/* Inline Poll Card */}
                    {msg.pollId && (
                      <div className="my-1">
                        <PollCard pollId={msg.pollId} isMe={isMe} />
                      </div>
                    )}

                    {/* Inline Voice Note Player */}
                    {msg.voiceDuration !== undefined && msg.attachmentUrl && (
                      <div className="my-1">
                        <VoiceNotePlayer
                          audioUrl={msg.attachmentUrl}
                          duration={msg.voiceDuration}
                          isMe={isMe}
                        />
                      </div>
                    )}

                    {/* Image Attachment */}
                    {msg.attachmentUrl && isImage && (
                      <div className="mb-2">
                        <div
                          onClick={() => setPreviewImageModal(msg.attachmentUrl || null)}
                          className="cursor-pointer rounded-xl overflow-hidden border border-white/10 max-h-72"
                        >
                          <img
                            src={msg.attachmentUrl}
                            alt={msg.attachmentName || 'Attachment'}
                            className="w-full h-auto object-cover hover:scale-105 transition-transform"
                          />
                        </div>
                      </div>
                    )}

                    {/* Document / File Attachment */}
                    {msg.attachmentUrl && !isImage && !msg.voiceDuration && (
                      <div className="mb-2">
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
                              {(msg.attachmentSize || 0) < 1024 * 1024
                                ? `${((msg.attachmentSize || 0) / 1024).toFixed(1)} KB`
                                : `${((msg.attachmentSize || 0) / (1024 * 1024)).toFixed(1)} MB`}
                            </p>
                          </div>
                          <Download className="w-4 h-4 text-white/80 shrink-0" />
                        </a>
                      </div>
                    )}

                    {/* Text Content with Markdown */}
                    {msg.content && !msg.pollId && (
                      <MarkdownText content={msg.content} />
                    )}

                    {/* Hover Reaction & Quick Actions Bar */}
                    <div
                      className={`absolute -top-3.5 ${
                        isMe ? 'right-2' : 'left-2'
                      } hidden group-hover:flex items-center gap-1 bg-slate-900 border border-white/10 rounded-xl px-1.5 py-0.5 shadow-lg z-20`}
                    >
                      {/* Quiet Reactions */}
                      {quietReactions.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleReaction(msg.id, emoji)}
                          className="hover:scale-125 transition-transform text-xs p-1"
                        >
                          {emoji}
                        </button>
                      ))}

                      {/* Reply Button */}
                      <button
                        type="button"
                        onClick={() => setReplyingTo(msg)}
                        title="Reply to message"
                        className="p-1 hover:text-blue-400 text-slate-400 transition-colors"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>

                      {/* Bookmark / Vault Button */}
                      <button
                        type="button"
                        onClick={() => handleSaveMessage(msg.id)}
                        title="Save to Personal Vault"
                        className="p-1 hover:text-amber-400 text-slate-400 transition-colors"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>

                      {/* Pin Button */}
                      <button
                        type="button"
                        onClick={() => handleTogglePin(msg.id)}
                        title={msg.isPinned ? 'Unpin message' : 'Pin message'}
                        className="p-1 hover:text-amber-400 text-slate-400 transition-colors"
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit Button for own messages */}
                      {isMe && !msg.isDeleted && (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(msg)}
                          title="Edit message"
                          className="p-1 hover:text-blue-400 text-slate-400 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete Button for own messages */}
                      {isMe && !msg.isDeleted && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(msg.id)}
                          title="Delete message"
                          className="p-1 hover:text-rose-400 text-slate-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Reaction Badges Display */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 px-1">
                      {msg.reactions.map((r) => (
                        <button
                          key={r.emoji}
                          type="button"
                          onClick={() => handleReaction(msg.id, r.emoji)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-all ${
                            r.hasReacted
                              ? 'bg-blue-600/30 border-blue-500/50 text-white font-bold shadow-sm'
                              : 'bg-slate-900/80 border-white/10 text-slate-300 hover:border-white/20'
                          }`}
                        >
                          <span>{r.emoji}</span>
                          <span className="font-mono text-[10px]">{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Message Bottom Metadata */}
                  <div
                    className={`flex items-center gap-1.5 text-[10px] mt-1 text-slate-400 select-none px-1 ${
                      isMe ? 'mr-1 justify-end' : 'ml-1 justify-start'
                    }`}
                  >
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {msg.isSilent && (
                      <span className="flex items-center gap-0.5 text-slate-400" title="Sent silently">
                        <BellOff className="w-3 h-3" />
                      </span>
                    )}
                    {msg.isEdited && <span>(edited)</span>}
                    {msg.isPinned && (
                      <span className="text-amber-400 flex items-center gap-0.5">
                        <Pin className="w-3 h-3" />
                      </span>
                    )}
                    {isMe && (
                      <span className="flex items-center">
                        {msg.status === 'READ' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
                        ) : msg.status === 'DELIVERED' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </React.Fragment>
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

      {/* Editing Message Banner */}
      {editingMessage && (
        <div className="px-4 py-2.5 bg-slate-900 border-t border-blue-500/30 flex items-center gap-2 text-xs">
          <Edit2 className="w-4 h-4 text-blue-400 shrink-0" />
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleSaveEdit}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditingMessage(null)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* In-Chat Reply Quote Banner */}
      {replyingTo && (
        <div className="px-4 py-2 bg-slate-900/90 border-t border-blue-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-blue-300">
                Replying to {replyingTo.senderId === currentUser?.id ? 'yourself' : peer.displayName}:
              </span>{' '}
              <span className="text-slate-400 truncate">{replyingTo.content}</span>
            </div>
          </div>
          <button type="button" onClick={() => setReplyingTo(null)} className="p-1 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Message */}
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

      {/* Active Cloud Upload Progress Card */}
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
                {activeUpload.progress}%
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
            onClick={() => {
              activeUpload.controller?.abort();
              setActiveUpload(null);
            }}
            title="Cancel upload"
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Voice Recording Control Bar */}
      {isRecordingVoice ? (
        <div className="p-3 border-t border-white/10 bg-slate-950 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Recording voice note... ({recordingSeconds}s)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/30"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Send Voice</span>
            </button>
          </div>
        </div>
      ) : (
        /* Standard Input Bar */
        <div className="p-3 md:p-4 border-t border-white/10 bg-slate-950/80 backdrop-blur-md pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach file (Max 50MB)"
              disabled={!!activeUpload}
              className="p-2.5 rounded-xl hover:bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-40"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Voice Note Trigger */}
            <button
              type="button"
              onClick={startRecording}
              title="Record Voice Note"
              className="p-2.5 rounded-xl hover:bg-white/5 border border-white/10 text-slate-400 hover:text-blue-400 transition-colors"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Decision Poll Trigger */}
            <button
              type="button"
              onClick={() => setIsPollModalOpen(true)}
              title="Post Group Decision Poll"
              className="p-2.5 rounded-xl hover:bg-white/5 border border-white/10 text-slate-400 hover:text-blue-400 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
            </button>

            {/* Silent Send Toggle */}
            <button
              type="button"
              onClick={() => setIsSilent(!isSilent)}
              title={
                isSilent
                  ? 'Silent Send active (no sound/chime on recipient device)'
                  : 'Toggle Silent Send (send without sound)'
              }
              className={`p-2.5 rounded-xl border transition-colors ${
                isSilent
                  ? 'bg-blue-600/25 border-blue-500/40 text-blue-400'
                  : 'hover:bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              {isSilent ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder={
                isSelfVault
                  ? 'Write a personal thought, paste code, or note to self...'
                  : isSilent
                  ? `Silent message to @${peer.username}...`
                  : `Message @${peer.username}...`
              }
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900/70 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-all shadow-md shadow-blue-600/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Context Drawer Panel */}
      {conversationId && (
        <ContextDrawer
          conversationId={conversationId}
          isOpen={isContextDrawerOpen}
          onClose={() => setIsContextDrawerOpen(false)}
          onJumpToMessage={jumpToMessage}
        />
      )}

      {/* Create Poll Modal */}
      <CreatePollModal
        isOpen={isPollModalOpen}
        onClose={() => setIsPollModalOpen(false)}
        conversationId={conversationId}
      />

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

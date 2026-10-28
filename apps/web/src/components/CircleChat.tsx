import React, { useState, useRef, useEffect } from 'react';
import { convex, api as convexApi } from '../convex.js';
import { useAuth } from '../hooks/useAuth.js';
import { uploadFileDirectly, DirectUploadResult } from '../services/uploader.js';
import { MAX_FILE_SIZE_BYTES } from '@chatso/shared';
import {
  Users,
  Send,
  Paperclip,
  Mic,
  Square,
  BellOff,
  Bell,
  BarChart3,
  Pin,
  ArrowLeft,
  X,
  FileText,
  Download,
  Trash2,
  Reply,
  Search,
  UserPlus,
  Headphones,
  Smile,
  Plus,
} from 'lucide-react';
import { MarkdownText } from './MarkdownText.js';
import { VoiceNotePlayer } from './VoiceNotePlayer.js';
import { PollCard } from './PollCard.js';
import { CreatePollModal } from './CreatePollModal.js';
import { CircleMembersModal } from './CircleMembersModal.js';
import { Emoji } from './Emoji.js';
import { EmojiPickerDrawer } from './EmojiPickerDrawer.js';
import { useEmojiSet } from '../hooks/useEmojiSet.js';

interface CircleChatProps {
  circleId: string;
  onBack: () => void;
}

export const CircleChat: React.FC<CircleChatProps> = ({ circleId, onBack }) => {
  const { user: currentUser } = useAuth();
  const [circle, setCircle] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSilent, setIsSilent] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(null);

  // In-chat search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Topic edit
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [topicInput, setTopicInput] = useState('');

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // File upload state
  const [activeUpload, setActiveUpload] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reactive subscription for circle details
  useEffect(() => {
    if (!circleId || !currentUser?.id) return;

    let unsub: (() => void) | null = null;
    try {
      const watch = (convex as any).watchQuery(convexApi.circles.getCircleDetails, {
        circleId: circleId as any,
        currentUserId: currentUser.id as any,
      });

      unsub = watch.onUpdate(() => {
        const res = watch.localQueryResult();
        if (res) {
          setCircle(res);
          setTopicInput(res.pinnedTopic || '');
        }
      });
    } catch (err) {
      console.warn('Circle details watch error:', err);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [circleId, currentUser?.id]);

  // Reactive subscription for circle messages
  useEffect(() => {
    if (!circleId || !currentUser?.id) return;

    let unsub: (() => void) | null = null;
    try {
      const watch = (convex as any).watchQuery(convexApi.circles.listCircleMessages, {
        circleId: circleId as any,
        currentUserId: currentUser.id as any,
      });

      unsub = watch.onUpdate(() => {
        const res = watch.localQueryResult();
        if (Array.isArray(res)) {
          setMessages(res);
        }
      });
    } catch (err) {
      console.warn('Circle messages watch error:', err);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [circleId, currentUser?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeUpload]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !currentUser?.id) return;

    const content = inputText.trim();
    const replyId = replyingTo?._id;
    const silent = isSilent;

    setInputText('');
    setReplyingTo(null);

    try {
      await (convex as any).mutation(convexApi.circles.sendCircleMessage, {
        circleId: circleId as any,
        senderId: currentUser.id as any,
        clientMessageId: crypto.randomUUID(),
        content,
        replyToId: replyId,
        isSilent: silent,
      });
    } catch (err: any) {
      console.error('Failed to send circle message:', err);
      setErrorMessage(err.message || 'Failed to send message');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!currentUser?.id) return;
    try {
      await (convex as any).mutation(convexApi.circles.deleteCircleMessage, {
        messageId: messageId as any,
        userId: currentUser.id as any,
      });
    } catch (err) {
      console.error('Failed to delete circle message:', err);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser?.id) return;
    try {
      await (convex as any).mutation(convexApi.circles.toggleCircleReaction, {
        messageId: messageId as any,
        circleId: circleId as any,
        userId: currentUser.id as any,
        emoji,
      });
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  const handleSaveTopic = async () => {
    if (!currentUser?.id) return;
    try {
      await (convex as any).mutation(convexApi.circles.updateCircleTopic, {
        circleId: circleId as any,
        userId: currentUser.id as any,
        pinnedTopic: topicInput.trim(),
      });
      setIsEditingTopic(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update circle topic');
    }
  };

  // Jump to specific message
  const jumpToMessage = (messageId: string) => {
    const el = messageRefs.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-purple-400', 'bg-purple-500/10');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-purple-400', 'bg-purple-500/10');
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
        .map((m) => m._id)
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

  // Voice recording
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
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = preferredMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach((track) => track.stop());

        if (audioBlob.size > 0 && currentUser?.id) {
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

            await (convex as any).mutation(convexApi.circles.sendCircleMessage, {
              circleId: circleId as any,
              senderId: currentUser.id as any,
              clientMessageId: crypto.randomUUID(),
              content: '🎤 Voice note',
              attachmentUrl: publicUrl,
              attachmentName: `voice_note.${ext}`,
              attachmentSize: audioBlob.size,
              attachmentMime: mimeType,
              voiceDuration: recordingSeconds,
              isSilent,
            });
          } catch (err) {
            console.error('Failed to upload voice note:', err);
          }
        }
        setIsRecordingVoice(false);
        setRecordingSeconds(0);
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Audio recording failed:', err);
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

  // Direct file select
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.id) return;
    e.target.value = '';

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`File exceeds 50MB limit.`);
      return;
    }

    const abortController = new AbortController();
    setActiveUpload({
      fileName: file.name,
      progress: 0,
      controller: abortController,
    });

    try {
      const uploadResult: DirectUploadResult = await uploadFileDirectly(
        file,
        (progress) => {
          setActiveUpload((prev: any) => (prev ? { ...prev, progress } : null));
        },
        abortController.signal
      );

      await (convex as any).mutation(convexApi.circles.sendCircleMessage, {
        circleId: circleId as any,
        senderId: currentUser.id as any,
        clientMessageId: crypto.randomUUID(),
        content: `Shared file: ${uploadResult.fileName}`,
        attachmentUrl: uploadResult.publicUrl,
        attachmentName: uploadResult.fileName,
        attachmentSize: uploadResult.fileSize,
        attachmentMime: uploadResult.mimeType,
        isSilent,
      });

      setActiveUpload(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'File upload failed');
      setActiveUpload(null);
    }
  };

  // Date divider helper
  const getDateLabel = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const y = new Date();
    y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const { currentSet } = useEmojiSet();
  const activeReactions = currentSet.emojis;

  return (
    <div className="chatso-main-chat flex-1 h-full flex flex-col dark:bg-[#09090b] bg-[#fbfbfa] relative overflow-hidden transition-colors duration-200">
      {/* Top Bar */}
      <div className="chatso-header h-16 px-4 md:px-6 border-b dark:border-white/[0.08] border-slate-200/80 flex items-center justify-between dark:bg-[#121215]/80 bg-white/90 backdrop-blur-md shrink-0 z-10 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="md:hidden p-2 -ml-1.5 rounded-xl dark:text-slate-400 text-slate-500 dark:hover:text-white hover:text-slate-900 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-md ring-1 ring-white/10">
            <Users className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold dark:text-white text-slate-900 truncate">{circle?.name || 'Circle'}</h2>
              <button
                type="button"
                onClick={() => setIsMembersModalOpen(true)}
                title="View & manage members"
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-300 dark:border-purple-500/30 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 shrink-0 transition-colors cursor-pointer"
              >
                {circle?.memberCount || 1} / {circle?.maxMembers || 25} members
              </button>
            </div>
            <p className="text-[11px] dark:text-slate-400 text-slate-500 truncate">
              {circle?.description || 'Intimate quiet circle'}
            </p>
          </div>
        </div>

        {/* Actions: Live Huddle Indicator, Search, Members & Decision Poll */}
        <div className="flex items-center gap-1.5">
          {/* Live Audio Huddle Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full dark:bg-emerald-500/10 dark:border-emerald-500/20 bg-emerald-50 border border-emerald-200 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 presence-pulse" />
            <Headphones className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">Huddle Active</span>
          </div>

          <button
            type="button"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            title="Search messages in circle"
            className={`p-2 rounded-xl border transition-colors ${
              isSearchOpen
                ? 'dark:bg-purple-600/20 dark:border-purple-500/40 dark:text-purple-400 bg-purple-100 border-purple-300 text-purple-700'
                : 'dark:hover:bg-white/5 dark:border-white/5 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsMembersModalOpen(true)}
            title="Circle Members & Invite"
            className="p-2.5 rounded-xl dark:hover:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 transition-all text-xs flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4 text-purple-500" />
            <span className="hidden sm:inline">Members</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPollModalOpen(true)}
            title="Create Group Decision Poll"
            className="p-2.5 rounded-xl dark:hover:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 transition-all text-xs flex items-center gap-1.5"
          >
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <span className="hidden sm:inline">Poll</span>
          </button>
        </div>
      </div>

      {/* In-Chat Search Bar */}
      {isSearchOpen && (
        <div className="px-4 py-2.5 dark:bg-[#121215] bg-slate-50 border-b dark:border-white/10 border-slate-200 flex items-center justify-between gap-3 text-xs animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 flex-1">
            <Search className="w-4 h-4 dark:text-slate-400 text-slate-500 shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setCurrentMatchIndex(0);
              }}
              placeholder="Search in circle..."
              className="w-full bg-transparent dark:text-white text-slate-900 dark:placeholder-slate-500 placeholder-slate-400 focus:outline-none"
            />
          </div>
          {searchKeyword.trim() && (
            <div className="flex items-center gap-2 dark:text-slate-400 text-slate-600 font-mono text-[11px] shrink-0">
              <span>
                {matchingMessageIds.length > 0 ? currentMatchIndex + 1 : 0} of {matchingMessageIds.length}
              </span>
              <button
                type="button"
                onClick={handlePrevSearchMatch}
                disabled={matchingMessageIds.length === 0}
                className="px-1.5 py-0.5 rounded dark:hover:bg-white/10 hover:bg-slate-200 disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={handleNextSearchMatch}
                disabled={matchingMessageIds.length === 0}
                className="px-1.5 py-0.5 rounded dark:hover:bg-white/10 hover:bg-slate-200 disabled:opacity-30"
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
            className="p-1 dark:hover:text-white hover:text-slate-900 dark:text-slate-400 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Circle Pinned Topic Banner */}
      <div className="px-4 py-2 dark:bg-purple-950/20 bg-purple-50/70 border-b dark:border-purple-500/20 border-purple-200/80 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Pin className="w-3.5 h-3.5 text-purple-500 shrink-0" />
          {isEditingTopic ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="Set current focus topic for this circle..."
                className="flex-1 px-2.5 py-1 rounded-lg dark:bg-slate-900 bg-white border dark:border-purple-500/40 border-purple-300 text-xs dark:text-white text-slate-900"
              />
              <button
                type="button"
                onClick={handleSaveTopic}
                className="px-2.5 py-1 rounded-lg bg-purple-600 text-white font-semibold text-[11px]"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditingTopic(false)}
                className="dark:text-slate-400 text-slate-500 dark:hover:text-white hover:text-slate-900 text-[11px]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <p className="dark:text-slate-300 text-slate-700 truncate">
              <strong className="dark:text-purple-300 text-purple-700 mr-1.5 font-semibold">Circle Focus:</strong>
              {circle?.pinnedTopic || 'No topic pinned. Set one to keep discussion focused.'}
            </p>
          )}
        </div>
        {!isEditingTopic && (
          <button
            type="button"
            onClick={() => setIsEditingTopic(true)}
            className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-semibold shrink-0"
          >
            Edit Topic
          </button>
        )}
      </div>

      {/* Error notification banner */}
      {errorMessage && (
        <div className="mx-4 mt-2 p-2.5 rounded-xl dark:bg-rose-500/10 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="dark:text-slate-400 text-slate-500 dark:hover:text-white hover:text-slate-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <div className="w-12 h-12 rounded-2xl dark:bg-purple-600/10 bg-purple-50 border dark:border-purple-500/20 border-purple-200 flex items-center justify-center mb-3 text-purple-500">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold dark:text-slate-200 text-slate-800">Welcome to {circle?.name}</p>
            <p className="text-xs dark:text-slate-400 text-slate-500 mt-1 max-w-sm text-center">
              An intimate circle designed for thoughtful, asynchronous exchange without notification clutter.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === currentUser?.id;
            const prevMsg = messages[index - 1];
            const showDateDivider =
              !prevMsg || getDateLabel(msg.createdAt) !== getDateLabel(prevMsg.createdAt);

            return (
              <React.Fragment key={msg._id || msg.clientMessageId}>
                {/* Date Divider Pill */}
                {showDateDivider && (
                  <div className="flex items-center justify-center my-4">
                    <span className="px-3 py-1 rounded-full dark:bg-[#18181b] bg-slate-100 border dark:border-white/10 border-slate-200 text-[10px] font-semibold tracking-wider uppercase dark:text-slate-400 text-slate-500">
                      {getDateLabel(msg.createdAt)}
                    </span>
                  </div>
                )}

                <div
                  ref={(el) => {
                    messageRefs.current[msg._id] = el;
                  }}
                  className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'} transition-colors duration-300`}
                >
                  {/* Sender Display Name in Group Chat */}
                  {!isMe && (
                    <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 ml-1 mb-1">
                      {msg.senderDisplayName}
                    </span>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`chatso-bubble ${
                      isMe ? 'chatso-bubble-sent' : 'chatso-bubble-received'
                    } max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 shadow-sm text-sm relative transition-all ${
                      isMe
                        ? 'bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 text-white rounded-br-xs border border-purple-400/20 shadow-md'
                        : 'dark:bg-[#18181b] bg-white border dark:border-white/[0.08] border-slate-200/80 dark:text-slate-100 text-slate-800 rounded-bl-xs shadow-sm'
                    }`}
                  >
                    {/* Reply Quote Banner */}
                    {msg.replySnippet && (
                      <div className={`mb-2 p-2 rounded-xl text-xs border-l-2 ${
                        isMe 
                          ? 'bg-black/25 border-purple-300 text-white' 
                          : 'dark:bg-black/25 bg-purple-50/70 border-purple-500 dark:text-slate-300 text-slate-700'
                      }`}>
                        <span className={`font-semibold block text-[11px] ${isMe ? 'text-purple-200' : 'text-purple-600 dark:text-purple-300'}`}>
                          {msg.replySnippet.senderName}
                        </span>
                        <p className="truncate text-[11px] opacity-90">{msg.replySnippet.content}</p>
                      </div>
                    )}

                    {/* Inline Poll Card */}
                    {msg.pollId && (
                      <div className="my-1">
                        <PollCard pollId={msg.pollId} isMe={isMe} />
                      </div>
                    )}

                    {/* Voice Note Player */}
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
                    {msg.attachmentUrl && msg.attachmentMime?.startsWith('image/') && (
                      <div
                        onClick={() => setPreviewImageModal(msg.attachmentUrl)}
                        className="mb-2 rounded-xl overflow-hidden border border-white/10 cursor-pointer max-h-72"
                      >
                        <img src={msg.attachmentUrl} alt="attachment" className="w-full h-auto object-cover" />
                      </div>
                    )}

                    {/* File Attachment */}
                    {msg.attachmentUrl && !msg.attachmentMime?.startsWith('image/') && !msg.voiceDuration && (
                      <a
                        href={msg.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-3 p-2.5 rounded-xl text-xs mb-2 border transition-colors ${
                          isMe
                            ? 'bg-black/20 border-white/20 text-white hover:bg-black/30'
                            : 'dark:bg-black/20 bg-slate-50 border-slate-200 dark:border-white/10 dark:text-white text-slate-800 hover:bg-slate-100 dark:hover:bg-black/30'
                        }`}
                      >
                        <FileText className="w-5 h-5 text-purple-500 shrink-0" />
                        <span className="truncate flex-1 font-semibold">{msg.attachmentName || 'Download File'}</span>
                        <Download className="w-4 h-4 opacity-60" />
                      </a>
                    )}

                    {/* Message Text with Markdown */}
                    {msg.content && !msg.pollId && (
                      <MarkdownText content={msg.content} />
                    )}

                    {/* WhatsApp + Telegram Floating Glassy Reaction Capsule */}
                    <div
                      className={`absolute -top-6 ${
                        isMe ? 'right-0 sm:right-2' : 'left-0 sm:left-2'
                      } hidden group-hover:flex items-center gap-1 bg-slate-900/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl border border-white/20 rounded-full px-2.5 py-1.5 shadow-[0_10px_35px_rgba(0,0,0,0.6)] ring-1 ring-white/10 z-30 transition-all animate-in fade-in zoom-in-95 duration-150 whitespace-nowrap`}
                    >
                      {activeReactions.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleReaction(msg._id, emoji)}
                          title={`React with ${emoji}`}
                          className="w-7 h-7 rounded-full hover:bg-white/20 hover:scale-130 active:scale-95 transition-all duration-150 flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Emoji emoji={emoji} size={20} className="w-5 h-5 drop-shadow-sm pointer-events-none" />
                        </button>
                      ))}

                      {/* Plus Button for full reaction picker */}
                      <button
                        type="button"
                        onClick={() => setReactingMessageId(reactingMessageId === msg._id ? null : msg._id)}
                        title="More emojis & reactions"
                        className="w-6 h-6 rounded-full hover:bg-white/20 text-slate-300 hover:text-white transition-all flex items-center justify-center shrink-0 cursor-pointer text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      {/* Divider */}
                      <div className="h-4 w-px bg-white/20 mx-1 shrink-0" />

                      <button
                        type="button"
                        onClick={() => setReplyingTo(msg)}
                        title="Reply"
                        className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-purple-400 transition-colors shrink-0"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                      {isMe && !msg.isDeleted && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(msg._id)}
                          title="Delete message"
                          className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-rose-400 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Anchored Full Reactions Drawer for this circle message */}
                    {reactingMessageId === msg._id && (
                      <EmojiPickerDrawer
                        isOpen={true}
                        onClose={() => setReactingMessageId(null)}
                        onSelectEmoji={(emoji) => {
                          handleReaction(msg._id, emoji);
                          setReactingMessageId(null);
                        }}
                        title="React to message"
                      />
                    )}
                  </div>

                  {/* Reactions Pill Display underneath Bubble */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 px-1">
                      {msg.reactions.map((r: any) => (
                        <button
                          key={r.emoji}
                          type="button"
                          onClick={() => handleReaction(msg._id, r.emoji)}
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border transition-all duration-150 ${
                            r.hasReacted
                              ? 'dark:bg-purple-600/30 dark:border-purple-500/50 bg-purple-100 border-purple-300 text-purple-700 dark:text-white font-bold shadow-sm shadow-purple-500/20'
                              : 'dark:bg-[#18181b] bg-white dark:border-white/10 border-slate-200 dark:text-slate-300 text-slate-700 hover:border-slate-300 dark:hover:border-white/20'
                          }`}
                        >
                          <Emoji emoji={r.emoji} className="w-3.5 h-3.5" />
                          <span className="font-mono text-[10px] font-semibold">{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Metadata: Timestamp & Indicators */}
                  <div className="flex items-center gap-1.5 text-[10px] mt-1 dark:text-slate-400 text-slate-500 select-none px-1">
                    <span className="font-mono tabular-numbers tracking-tight">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.isSilent && (
                      <span className="flex items-center gap-0.5 text-slate-400" title="Sent silently">
                        <BellOff className="w-3 h-3" />
                      </span>
                    )}
                    {msg.isEdited && <span>(edited)</span>}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Banner */}
      {replyingTo && (
        <div className="px-4 py-2 dark:bg-[#121215] bg-purple-50/90 border-t border-purple-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="w-4 h-4 text-purple-500 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-purple-600 dark:text-purple-300">
                Replying to {replyingTo.senderDisplayName || 'message'}:
              </span>{' '}
              <span className="dark:text-slate-400 text-slate-600 truncate">{replyingTo.content}</span>
            </div>
          </div>
          <button type="button" onClick={() => setReplyingTo(null)} className="p-1 dark:text-slate-400 text-slate-500 dark:hover:text-white hover:text-slate-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Voice Recording Bar */}
      {isRecordingVoice ? (
        <div className="p-3 border-t dark:border-white/[0.08] border-slate-200/80 dark:bg-[#121215] bg-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-rose-500 text-xs font-semibold animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Recording voice note... ({recordingSeconds}s)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="px-3 py-1.5 rounded-xl text-xs dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-600/30"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Send Voice</span>
            </button>
          </div>
        </div>
      ) : (
        /* Input Bar (Suspended Stitch Dock) */
        <div className="chatso-input-dock p-3 md:p-4 border-t dark:border-white/[0.08] border-slate-200/80 dark:bg-[#121215]/85 bg-white/90 backdrop-blur-md pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach File (Max 50MB)"
              className="p-2.5 rounded-xl dark:hover:bg-white/5 hover:bg-slate-100 border dark:border-white/10 border-slate-200 dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 transition-colors"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={startRecording}
              title="Record Voice Note"
              className="p-2.5 rounded-xl dark:hover:bg-white/5 hover:bg-slate-100 border dark:border-white/10 border-slate-200 dark:text-slate-400 text-slate-600 dark:hover:text-purple-400 hover:text-purple-600 transition-colors"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Silent Send Toggle */}
            <button
              type="button"
              onClick={() => setIsSilent(!isSilent)}
              title={isSilent ? 'Silent Send enabled (no sound on recipient device)' : 'Toggle Silent Send'}
              className={`p-2.5 rounded-xl border transition-colors ${
                isSilent
                  ? 'dark:bg-purple-600/20 dark:border-purple-500/40 dark:text-purple-400 bg-purple-100 border-purple-300 text-purple-700'
                  : 'dark:hover:bg-white/5 hover:bg-slate-100 border dark:border-white/10 border-slate-200 dark:text-slate-400 text-slate-600'
              }`}
            >
              {isSilent ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </button>

            {/* WhatsApp / Telegram Emoji Picker Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                title="Emoji & Reactions Picker"
                className={`p-2.5 rounded-xl border transition-colors ${
                  isEmojiPickerOpen
                    ? 'bg-amber-500/20 border-amber-500/30 text-amber-500'
                    : 'dark:hover:bg-white/5 hover:bg-slate-100 border dark:border-white/10 border-slate-200 dark:text-slate-400 text-slate-600 hover:text-amber-500'
                }`}
              >
                <Smile className="w-4 h-4" />
              </button>

              <EmojiPickerDrawer
                isOpen={isEmojiPickerOpen}
                onClose={() => setIsEmojiPickerOpen(false)}
                onSelectEmoji={(emoji) => {
                  setInputText((prev) => prev + emoji);
                  setIsEmojiPickerOpen(false);
                }}
                title="Insert Emoji"
              />
            </div>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Message ${circle?.name || 'circle'}...`}
              className="flex-1 py-2.5 px-4 rounded-xl dark:bg-[#18181b] bg-slate-100/90 border dark:border-white/[0.08] border-slate-200/80 text-sm dark:text-white text-slate-900 dark:placeholder-slate-500 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition-all shadow-md shadow-purple-600/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Decision Poll Modal */}
      <CreatePollModal
        isOpen={isPollModalOpen}
        onClose={() => setIsPollModalOpen(false)}
        circleId={circleId}
      />

      {/* Circle Members & Invite Modal */}
      <CircleMembersModal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        circleId={circleId}
        circleName={circle?.name || 'Circle'}
        maxMembers={circle?.maxMembers || 25}
        members={circle?.members || []}
        isAdmin={circle?.isAdmin || false}
        onLeaveCircle={onBack}
      />

      {/* Image Lightbox Modal */}
      {previewImageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImageModal(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={previewImageModal} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" />
            <button
              type="button"
              onClick={() => setPreviewImageModal(null)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, MessageDto, SOCKET_EVENTS } from '@chatso/shared';
import { useAuth } from './hooks/useAuth.js';
import { useSocket } from './hooks/useSocket.js';
import { useWebRTC } from './hooks/useWebRTC.js';
import { api, formatConvexMessage } from './services/api.js';
import { AuthScreen } from './components/AuthScreen.js';
import { Sidebar } from './components/Sidebar.js';
import { NavigationRail } from './components/NavigationRail.js';
import { MainChat } from './components/MainChat.js';
import { CircleChat } from './components/CircleChat.js';
import { VideoCallOverlay } from './components/VideoCallOverlay.js';
import { IncomingCallDialog } from './components/IncomingCallDialog.js';
import { MessageSquare } from 'lucide-react';
import { convex, api as convexApi } from './convex.js';
import { NotificationService, sound } from './services/notifications.js';
import { NotificationsPanel } from './components/NotificationsPanel.js';
import { ThemeProvider } from './hooks/useTheme.js';

export const AppContent: React.FC = () => {
  const { user: currentUser, isAuthenticated, isLoading } = useAuth();
  const { socket } = useSocket();
  const webrtc = useWebRTC(socket);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);

  const [activeConvInfo, setActiveConvInfo] = useState<{
    conversationId?: string;
    status?: 'ACCEPTED' | 'PENDING' | 'DECLINED';
    initiatorId?: string;
    isSelfVault?: boolean;
    pinnedMessageId?: string;
  }>({});

  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [peerTypingMap, setPeerTypingMap] = useState<Record<string, boolean>>({});
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [lastMessageMap, setLastMessageMap] = useState<
    Record<string, { content?: string; attachmentName?: string; createdAt: number; senderId?: string; status?: any }>
  >({});
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'chats' | 'circles' | 'requests' | 'calls' | 'settings'>('chats');
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Watch pending handshake requests count for notification badge
  useEffect(() => {
    if (!currentUser?.id) return;
    let unsub: (() => void) | null = null;
    try {
      const watch = (convex as any).watchQuery(convexApi.messages.listPendingRequests, {
        currentUserId: currentUser.id as any,
      });
      unsub = watch.onUpdate(() => {
        const res = watch.localQueryResult();
        if (Array.isArray(res)) setPendingRequestsCount(res.length);
      });
    } catch (err) {
      console.warn('Pending requests count watch error:', err);
    }
    return () => {
      if (unsub) unsub();
    };
  }, [currentUser?.id]);

  const totalUnreadChats = Object.values(unreadMap).reduce((acc, curr) => acc + (curr || 0), 0);

  // Synchronize browser history and handle hardware/browser Back button
  const handleSelectUser = useCallback((u: UserProfile | null) => {
    setSelectedCircleId(null);
    setSelectedUser(u);
    if (u) {
      setUsers((prev) => {
        if (!prev.some((existing) => existing.id === u.id)) {
          return [u, ...prev];
        }
        return prev;
      });
      if (window.history.state?.chatUserId !== u.id) {
        window.history.pushState({ view: 'chat', chatUserId: u.id }, '', `#chat=${u.id}`);
      }
    } else {
      if (window.history.state?.chatUserId || window.location.hash.startsWith('#chat')) {
        window.history.back();
      }
    }
  }, []);

  const handleSelectCircle = useCallback((circleId: string | null) => {
    setSelectedUser(null);
    setSelectedCircleId(circleId);
    if (circleId) {
      if (window.history.state?.circleId !== circleId) {
        window.history.pushState({ view: 'circle', circleId }, '', `#circle=${circleId}`);
      }
    } else {
      if (window.history.state?.circleId || window.location.hash.startsWith('#circle')) {
        window.history.back();
      }
    }
  }, []);

  const handleBackFromChat = useCallback(() => {
    if (window.history.state?.chatUserId || window.location.hash.startsWith('#chat')) {
      window.history.back();
    } else {
      setSelectedUser(null);
    }
  }, []);

  const handleOpenNotificationsPanel = useCallback(() => {
    window.history.pushState({ view: 'modal', modal: 'notifications' }, '', '#notifications');
    setIsNotificationsPanelOpen(true);
  }, []);

  const handleCloseNotificationsPanel = useCallback(() => {
    setIsNotificationsPanelOpen(false);
    if (window.location.hash === '#notifications') {
      window.history.back();
    }
  }, []);

  // Listen to popstate
  useEffect(() => {
    if (!window.history.state) {
      window.history.replaceState({ view: 'root' }, '', window.location.pathname);
    }

    const handlePopState = (event: PopStateEvent) => {
      if (isNotificationsPanelOpen) {
        setIsNotificationsPanelOpen(false);
        return;
      }

      if (isNotificationsPanelOpen) {
        setIsNotificationsPanelOpen(false);
        return;
      }

      const state = event.state;
      if (state?.circleId) {
        setSelectedCircleId(state.circleId);
        setSelectedUser(null);
      } else if (state?.chatUserId) {
        setSelectedCircleId(null);
        const u = users.find((user) => user.id === state.chatUserId);
        if (u) setSelectedUser(u);
      } else {
        setSelectedUser(null);
        setSelectedCircleId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isNotificationsPanelOpen, users]);

  // Sync in-app notification center unread count
  useEffect(() => {
    const unsub = NotificationService.subscribe((list) => {
      setUnreadNotificationsCount(list.filter((n) => !n.read).length);
    });
    return () => unsub();
  }, []);

  // Watch conversation summaries
  useEffect(() => {
    if (!currentUser?.id) return;

    let unsub: (() => void) | null = null;
    try {
      const watch = (convex as any).watchQuery(
        convexApi.messages.getUserChatSummaries,
        { userId: currentUser.id }
      );

      unsub = watch.onUpdate(() => {
        const summaries = watch.localQueryResult();
        if (Array.isArray(summaries)) {
          const newUnreadMap: Record<string, number> = {};
          const newLastMsgMap: Record<string, any> = {};
          let totalUnread = 0;

          summaries.forEach((s: any) => {
            if (s.otherUserId) {
              const count = s.otherUserId === selectedUser?.id ? 0 : (s.unreadCount || 0);
              newUnreadMap[s.otherUserId] = count;
              totalUnread += count;
              if (s.lastMessage) {
                newLastMsgMap[s.otherUserId] = s.lastMessage;
              }
            }
          });

          setUnreadMap(newUnreadMap);
          setLastMessageMap(newLastMsgMap);
          NotificationService.updateBadge(totalUnread);

          // Deliveries acknowledgement: If any message sent by someone else is pending delivery ('SENT'), mark DELIVERED
          if (currentUser?.id) {
            const hasPendingSent = summaries.some(
              (s: any) => s.lastMessage && s.lastMessage.senderId !== currentUser.id && s.lastMessage.status === 'SENT'
            );
            if (hasPendingSent) {
              api.markMessagesDelivered(currentUser.id);
            }
          }
        }
      });
    } catch (err) {
      console.warn('Convex summaries subscription error:', err);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [currentUser?.id, selectedUser?.id]);

  // Watch contacted users list
  useEffect(() => {
    if (!currentUser?.id) return;

    let unsub: (() => void) | null = null;
    try {
      const watch = (convex as any).watchQuery(
        convexApi.users.listContactedUsers,
        { currentUserId: currentUser.id }
      );

      unsub = watch.onUpdate(() => {
        const contacted = watch.localQueryResult();
        if (Array.isArray(contacted)) {
          const formatted = contacted.map((u: any): UserProfile => ({
            id: u._id,
            username: u.username,
            email: u.email,
            phoneNumber: u.phoneNumber || undefined,
            displayName: u.displayName,
            avatarUrl: u.avatarUrl || undefined,
            status: u.status,
            bio: u.bio || undefined,
            sendReadReceipts: u.sendReadReceipts !== false,
            sendTypingIndicators: u.sendTypingIndicators !== false,
            allowCalls: u.allowCalls !== false,
            lastSeenAt: new Date(u.lastSeenAt || Date.now()).toISOString(),
            createdAt: new Date(u._creationTime || u.createdAt || Date.now()).toISOString(),
          }));

          setUsers(
            selectedUser && !formatted.some((u) => u.id === selectedUser.id)
              ? [selectedUser, ...formatted]
              : formatted
          );
        }
      });
    } catch (err) {
      console.warn('Convex contacted users watch error:', err);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [currentUser?.id, selectedUser]);

  // Fetch contacted users on login
  const loadUsers = useCallback(async () => {
    try {
      const res = await api.getContactedUsers();
      setUsers(res.users);
      if (!selectedUser && res.users.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
        setSelectedUser(res.users[0]);
      }
    } catch (err) {
      console.error('[App] Failed to load contacted users:', err);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (isAuthenticated) {
      loadUsers();
    }
  }, [isAuthenticated, loadUsers]);

  const currentUserIdRef = useRef<string | undefined>(currentUser?.id);
  const currentUserStatusRef = useRef<string | undefined>(currentUser?.status);

  useEffect(() => {
    currentUserIdRef.current = currentUser?.id;
    currentUserStatusRef.current = currentUser?.status;
  }, [currentUser?.id, currentUser?.status]);

  // Presence Lifecycle: Heartbeat while open + immediate OFFLINE on browser/tab close
  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId) return;

    // 1. Initial presence on mount: if user was marked OFFLINE, bring them to ONLINE
    if (currentUser?.status === 'OFFLINE') {
      api.setPresence('ONLINE', userId);
    } else {
      api.heartbeat(currentUser?.status as any, userId);
    }

    // 2. Regular heartbeat every 25 seconds to keep presence fresh
    const interval = setInterval(() => {
      const uid = currentUserIdRef.current;
      const st = currentUserStatusRef.current;
      if (uid) {
        api.heartbeat(st as any, uid);
        api.markMessagesDelivered(uid);
      }
    }, 25000);

    // 3. Mark OFFLINE immediately when user closes the app, tab, or navigates away
    const handleClose = () => {
      const uid = currentUserIdRef.current;
      if (uid) {
        try {
          (convex as any).mutation(convexApi.users.setPresence, {
            userId: uid,
            status: 'OFFLINE',
          }).catch(() => {});
        } catch {}
      }
    };

    const handleVisibility = () => {
      const uid = currentUserIdRef.current;
      const st = currentUserStatusRef.current;
      if (document.visibilityState === 'visible' && uid) {
        api.heartbeat(st as any, uid);
        api.markMessagesDelivered(uid);
      }
    };

    if (currentUser?.id) {
      api.markMessagesDelivered(currentUser.id);
    }

    window.addEventListener('beforeunload', handleClose);
    window.addEventListener('pagehide', handleClose);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleClose);
      window.removeEventListener('pagehide', handleClose);
      document.removeEventListener('visibilitychange', handleVisibility);
      // NOTE: Do not invoke handleClose() here during React re-renders or navigation!
      // handleClose is solely for window beforeunload / pagehide events.
    };
  }, [currentUser?.id]);

  // Listen for Service Worker notification clicks (background wakeups)
  useEffect(() => {
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK' && event.data.senderId) {
        const target = users.find((u) => u.id === event.data.senderId);
        if (target) {
          handleSelectUser(target);
        } else {
          api.getContactedUsers().then((res) => {
            const found = res.users.find((u) => u.id === event.data.senderId);
            if (found) handleSelectUser(found);
          });
        }
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, [users, handleSelectUser]);

  // Load message history and watch messages reactively when selectedUser changes
  useEffect(() => {
    if (!selectedUser) {
      setMessages([]);
      setActiveConvInfo({});
      return;
    }

    // Mark as read in Convex immediately (respecting privacy)
    if (currentUser?.id && selectedUser?.id && currentUser?.sendReadReceipts !== false) {
      (convex as any).mutation(convexApi.messages.markConversationAsRead, {
        currentUserId: currentUser.id,
        peerId: selectedUser.id,
      }).catch(() => {});
    }

    setUnreadMap((prev) => ({ ...prev, [selectedUser.id]: 0 }));

    let unsubWatch: (() => void) | null = null;

    const loadHistory = async () => {
      try {
        if (currentUser?.id) {
          api.markMessagesDelivered(currentUser.id);
        }
        const res = await api.getMessages(selectedUser.id);
        setActiveConvInfo({
          conversationId: res.conversationId,
          status: res.conversationStatus,
          initiatorId: res.initiatorId,
          isSelfVault: res.isSelfVault,
          pinnedMessageId: res.pinnedMessageId,
        });
        setMessages(res.messages);

        if (res.conversationId) {
          const watch = (convex as any).watchQuery(convexApi.messages.listMessages, {
            conversationId: res.conversationId,
            currentUserId: currentUser?.id,
          });
          unsubWatch = watch.onUpdate(() => {
            const currentMsgs = watch.localQueryResult();
            if (Array.isArray(currentMsgs)) {
              const formatted = currentMsgs.map(formatConvexMessage);
              setMessages((prev) => {
                const pendingOptimistic = prev.filter(
                  (m) =>
                    m.clientMessageId &&
                    !formatted.some(
                      (f) =>
                        (f.clientMessageId && f.clientMessageId === m.clientMessageId) ||
                        f.id === m.id
                    )
                );
                return [...formatted, ...pendingOptimistic];
              });

              // Acknowledge delivery if peer sent any messages currently marked as SENT
              if (res.conversationId && currentUser?.id) {
                const hasIncomingSent = currentMsgs.some(
                  (m: any) => m.senderId !== currentUser.id && m.status === 'SENT'
                );
                if (hasIncomingSent) {
                  api.markMessagesDelivered(currentUser.id, res.conversationId);
                }
              }

              if (currentUser?.sendReadReceipts !== false && currentUser?.id) {
                (convex as any).mutation(convexApi.messages.markAsRead, {
                  conversationId: res.conversationId,
                  currentUserId: currentUser.id,
                }).catch(() => {});
              }
            }
          });
        }

        if (res.conversationId && currentUser?.id && currentUser?.sendReadReceipts !== false) {
          (convex as any).mutation(convexApi.messages.markAsRead, {
            conversationId: res.conversationId,
            currentUserId: currentUser.id,
          }).catch(() => {});
        }
      } catch (err) {
        console.error('[App] Failed to load messages:', err);
      }
    };

    loadHistory();

    return () => {
      if (unsubWatch) unsubWatch();
    };
  }, [selectedUser, socket, currentUser?.id, currentUser?.sendReadReceipts]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handlePresence = (payload: { userId: string; status: any; lastSeenAt: any }) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === payload.userId
            ? { ...u, status: payload.status, lastSeenAt: payload.lastSeenAt }
            : u
        )
      );
      if (selectedUser?.id === payload.userId) {
        setSelectedUser((prev) => (prev ? { ...prev, status: payload.status } : null));
      }
    };

    const handleChatReceive = (msg: MessageDto) => {
      const sender = users.find((u) => u.id === msg.senderId);
      const senderName = sender?.displayName || 'Chat.SO Message';

      // Quiet social check: suppress chime if msg isSilent or if current user is in LOW_BATTERY or DEEP_FOCUS
      const isSilent = msg.isSilent || currentUser?.status === 'LOW_BATTERY' || currentUser?.status === 'DEEP_FOCUS';

      // Only suppress desktop pop-up if user is currently looking at this exact chat window
      const isActivelyChatting = typeof document !== 'undefined' && !document.hidden && selectedUser?.id === msg.senderId;

      if (!isActivelyChatting) {
        NotificationService.notify(senderName, {
          body: msg.content || (msg.attachmentName ? `Attachment: ${msg.attachmentName}` : 'Sent an attachment'),
          tag: `chat-${msg.senderId}`,
          senderId: msg.senderId,
          silent: isSilent,
          onClick: () => {
            if (sender) {
              handleSelectUser(sender);
            } else {
              api.getContactedUsers().then((res) => {
                const found = res.users.find((u) => u.id === msg.senderId);
                if (found) handleSelectUser(found);
              });
            }
          },
        });
      } else if (!isSilent) {
        sound.playMessageChime();
      }

      if (selectedUser?.id === msg.senderId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id || (m.clientMessageId && m.clientMessageId === msg.clientMessageId))) {
            return prev;
          }
          return [...prev, msg];
        });

        if (currentUser?.sendReadReceipts !== false) {
          socket.emit(SOCKET_EVENTS.CHAT_READ, {
            peerId: msg.senderId,
            lastReadMessageId: msg.id,
          });
        }
      }
    };

    const handleChatDelivered = (payload: { clientMessageId: string; messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === payload.clientMessageId ? { ...m, status: 'DELIVERED' } : m
        )
      );
    };

    const handleChatRead = (payload: { readerId: string; lastReadMessageId?: string }) => {
      if (selectedUser?.id === payload.readerId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === currentUser?.id ? { ...m, status: 'READ' } : m
          )
        );
      }
    };

    const handleChatTyping = (payload: { senderId: string; isTyping: boolean }) => {
      setPeerTypingMap((prev) => ({ ...prev, [payload.senderId]: payload.isTyping }));
    };

    socket.on(SOCKET_EVENTS.PRESENCE_CHANGED, handlePresence);
    socket.on(SOCKET_EVENTS.CHAT_RECEIVE, handleChatReceive);
    socket.on(SOCKET_EVENTS.CHAT_DELIVERED, handleChatDelivered);
    socket.on(SOCKET_EVENTS.CHAT_READ, handleChatRead);
    socket.on(SOCKET_EVENTS.CHAT_TYPING, handleChatTyping);

    return () => {
      socket.off(SOCKET_EVENTS.PRESENCE_CHANGED, handlePresence);
      socket.off(SOCKET_EVENTS.CHAT_RECEIVE, handleChatReceive);
      socket.off(SOCKET_EVENTS.CHAT_DELIVERED, handleChatDelivered);
      socket.off(SOCKET_EVENTS.CHAT_READ, handleChatRead);
      socket.off(SOCKET_EVENTS.CHAT_TYPING, handleChatTyping);
    };
  }, [socket, selectedUser, currentUser, users, handleSelectUser]);

  // Handle incoming call ringtone and OS notification
  useEffect(() => {
    if (webrtc.incomingCall) {
      if (currentUser?.status !== 'LOW_BATTERY' && currentUser?.status !== 'DEEP_FOCUS' && currentUser?.allowCalls !== false) {
        sound.startRingtone();
      }
      NotificationService.notifyCall({
        callId: webrtc.incomingCall.callerId,
        callerName: webrtc.incomingCall.callerName || 'Someone',
        callerId: webrtc.incomingCall.callerId,
        isVideo: webrtc.incomingCall.isVideo,
        onAnswer: () => webrtc.acceptCall(),
        onDecline: () => webrtc.rejectCall(),
      });
    } else {
      sound.stopRingtone();
      NotificationService.closeCallNotification();
    }
    return () => {
      sound.stopRingtone();
      NotificationService.closeCallNotification();
    };
  }, [webrtc.incomingCall, currentUser?.status, currentUser?.allowCalls, webrtc]);

  // Send message
  const handleSendMessage = async (params: {
    content: string;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentSize?: number;
    attachmentMime?: string;
    replyToId?: string;
    isSilent?: boolean;
    voiceDuration?: number;
    pollId?: string;
  }) => {
    if (!selectedUser || !currentUser) return;

    const clientMessageId = crypto.randomUUID();
    const optimisticMessage: MessageDto = {
      id: clientMessageId,
      conversationId: activeConvInfo.conversationId || '',
      senderId: currentUser.id,
      clientMessageId,
      content: params.content,
      attachmentUrl: params.attachmentUrl || null,
      attachmentName: params.attachmentName || null,
      attachmentSize: params.attachmentSize || null,
      attachmentMime: params.attachmentMime || null,
      replyToId: params.replyToId,
      isSilent: params.isSilent,
      voiceDuration: params.voiceDuration,
      pollId: params.pollId,
      status: 'SENT',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => {
      if (prev.some((m) => m.clientMessageId === clientMessageId || m.id === clientMessageId)) {
        return prev;
      }
      return [...prev, optimisticMessage];
    });

    // Send via Convex backend directly for instant multi-device sync
    let targetConvId = activeConvInfo.conversationId;
    if (!targetConvId && selectedUser && currentUser) {
      try {
        const conv = await api.getOrCreateConversation(currentUser.id, selectedUser.id);
        if (conv?._id) {
          targetConvId = conv._id;
          setActiveConvInfo({
            conversationId: conv._id,
            status: conv.status || 'PENDING',
            initiatorId: conv.initiatorId,
            isSelfVault: !!conv.isSelfVault,
            pinnedMessageId: conv.pinnedMessageId,
          });
        }
      } catch (err) {
        console.error('Failed to get or create conversation on send:', err);
      }
    }

    if (targetConvId) {
      try {
        const sent: any = await api.sendMessage({
          conversationId: targetConvId,
          senderId: currentUser.id,
          clientMessageId,
          content: params.content,
          attachmentUrl: params.attachmentUrl,
          attachmentName: params.attachmentName,
          attachmentSize: params.attachmentSize,
          attachmentMime: params.attachmentMime,
          replyToId: params.replyToId,
          isSilent: params.isSilent,
          voiceDuration: params.voiceDuration,
          pollId: params.pollId,
        });
        if (sent) {
          setMessages((prev) =>
            prev.map((m) =>
              m.clientMessageId === clientMessageId || m.id === clientMessageId
                ? { ...m, id: sent._id || m.id, status: sent.status || m.status }
                : m
            )
          );
        }
      } catch (err) {
        console.error('Failed to send via Convex:', err);
      }
    }
  };

  const handleSendTyping = (isTyping: boolean) => {
    if (!selectedUser || !socket || currentUser?.sendTypingIndicators === false) return;
    socket.emit(SOCKET_EVENTS.CHAT_TYPING, {
      recipientId: selectedUser.id,
      isTyping,
    });
  };

  const handleStartCall = (isVideo: boolean) => {
    if (!selectedUser) return;
    webrtc.startCall(selectedUser.id, selectedUser.displayName, isVideo);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center dark:bg-[#09090b] bg-[#fbfbfa]">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="h-[100dvh] w-screen flex dark:bg-[#09090b] bg-[#fbfbfa] dark:text-slate-100 text-slate-900 overflow-hidden font-sans transition-colors duration-200">
      {/* Desktop Navigation Rail (Stitch 64px Slim Bar) */}
      <NavigationRail
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'settings' || tab === 'calls' || tab === 'requests') {
            setSelectedUser(null);
            setSelectedCircleId(null);
          }
        }}
        unreadChatsCount={totalUnreadChats}
        pendingRequestsCount={pendingRequestsCount}
      />

      {/* Left Sidebar (Contacts, Circles, Vault, Calls, Settings) */}
      <div className={`h-full ${selectedUser || selectedCircleId ? 'hidden md:flex' : 'flex w-full'} md:w-80 shrink-0`}>
        <Sidebar
          users={users}
          selectedUser={selectedUser}
          onSelectUser={handleSelectUser}
          selectedCircleId={selectedCircleId}
          onSelectCircle={handleSelectCircle}
          unreadMap={unreadMap}
          lastMessageMap={lastMessageMap}
          onOpenNotificationsPanel={handleOpenNotificationsPanel}
          unreadNotificationsCount={unreadNotificationsCount}
          onStartCall={(user, isVideo) => webrtc.startCall(user.id, user.displayName, isVideo)}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab === 'settings' || tab === 'calls' || tab === 'requests') {
              setSelectedUser(null);
              setSelectedCircleId(null);
            }
          }}
        />
      </div>

      {/* Main Content Area */}
      {selectedCircleId ? (
        <div className="h-full flex-1 flex flex-col flex w-full">
          <CircleChat
            circleId={selectedCircleId}
            onBack={() => setSelectedCircleId(null)}
          />
        </div>
      ) : selectedUser ? (
        <div className={`h-full flex-1 flex flex-col ${selectedUser ? 'flex w-full' : 'hidden md:flex'}`}>
          <MainChat
            peer={selectedUser}
            conversationId={activeConvInfo.conversationId}
            conversationStatus={activeConvInfo.status}
            initiatorId={activeConvInfo.initiatorId}
            isSelfVault={activeConvInfo.isSelfVault || selectedUser.id === currentUser?.id}
            pinnedMessageId={activeConvInfo.pinnedMessageId}
            messages={messages}
            isPeerTyping={!!peerTypingMap[selectedUser.id]}
            onSendMessage={handleSendMessage}
            onSendTyping={handleSendTyping}
            onStartCall={handleStartCall}
            onBack={handleBackFromChat}
          />
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center dark:text-slate-500 text-slate-400 dark:bg-[#09090b] bg-[#fbfbfa] p-6 text-center select-none transition-colors duration-200">
          <div className="w-16 h-16 rounded-2xl dark:bg-blue-600/10 bg-blue-50 border dark:border-blue-500/20 border-blue-200/60 flex items-center justify-center mb-4 text-blue-500 shadow-sm">
            <MessageSquare className="w-8 h-8 opacity-75" />
          </div>
          <p className="text-base font-bold dark:text-slate-200 text-slate-800">Chat.SO Quiet Social</p>
          <p className="text-xs dark:text-slate-400 text-slate-500 mt-1 max-w-sm">
            Select a quiet conversation, visit your Personal Vault, or join an Intimate Circle.
          </p>
        </div>
      )}

      {/* In-App Notifications Panel */}
      <NotificationsPanel
        isOpen={isNotificationsPanelOpen}
        onClose={handleCloseNotificationsPanel}
        onSelectUser={(userId) => {
          const target = users.find((u) => u.id === userId);
          if (target) handleSelectUser(target);
        }}
        permission={NotificationService.getPermission()}
        onRequestPermission={async () => {
          await NotificationService.requestPermission();
        }}
      />

      {/* WebRTC Video Call Overlay */}
      <VideoCallOverlay
        callState={webrtc.callState}
        activePeer={webrtc.activePeer}
        localStream={webrtc.localStream}
        remoteStream={webrtc.remoteStream}
        isAudioMuted={webrtc.isAudioMuted}
        isVideoOff={webrtc.isVideoOff}
        onToggleAudio={webrtc.toggleAudio}
        onToggleVideo={webrtc.toggleVideo}
        onEndCall={webrtc.endCall}
      />

      {/* Incoming Call Dialog */}
      <IncomingCallDialog
        incomingCall={webrtc.incomingCall}
        onAccept={webrtc.acceptCall}
        onReject={webrtc.rejectCall}
      />
    </div>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;

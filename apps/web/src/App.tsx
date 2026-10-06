import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, MessageDto, SOCKET_EVENTS } from '@chatso/shared';
import { useAuth } from './hooks/useAuth.js';
import { useSocket } from './hooks/useSocket.js';
import { useWebRTC } from './hooks/useWebRTC.js';
import { api } from './services/api.js';
import { AuthScreen } from './components/AuthScreen.js';
import { Sidebar } from './components/Sidebar.js';
import { MainChat } from './components/MainChat.js';
import { VideoCallOverlay } from './components/VideoCallOverlay.js';
import { IncomingCallDialog } from './components/IncomingCallDialog.js';
import { ProfileModal } from './components/ProfileModal.js';
import { MessageSquare } from 'lucide-react';

export const AppContent: React.FC = () => {
  const { user: currentUser, isAuthenticated, isLoading } = useAuth();
  const { socket } = useSocket();
  const webrtc = useWebRTC(socket);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [peerTypingMap, setPeerTypingMap] = useState<Record<string, boolean>>({});
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Fetch users on login
  const loadUsers = useCallback(async () => {
    try {
      const res = await api.getUsers();
      setUsers(res.users);
      // Auto-select first user if none selected
      if (!selectedUser && res.users.length > 0) {
        setSelectedUser(res.users[0]);
      }
    } catch (err) {
      console.error('[App] Failed to load users:', err);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (isAuthenticated) {
      loadUsers();
    }
  }, [isAuthenticated, loadUsers]);

  // Load message history when selectedUser changes
  useEffect(() => {
    if (!selectedUser) {
      setMessages([]);
      return;
    }

    const loadHistory = async () => {
      try {
        const res = await api.getMessages(selectedUser.id);
        setMessages(res.messages);

        // Emit read receipt
        if (socket && res.messages.length > 0) {
          const lastMsg = res.messages[res.messages.length - 1];
          socket.emit(SOCKET_EVENTS.CHAT_READ, {
            peerId: selectedUser.id,
            lastReadMessageId: lastMsg.id,
          });
        }
      } catch (err) {
        console.error('[App] Failed to load messages:', err);
      }
    };

    loadHistory();
  }, [selectedUser, socket]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Presence update
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

    // Chat receive
    const handleChatReceive = (msg: MessageDto) => {
      if (selectedUser?.id === msg.senderId) {
        setMessages((prev) => [...prev, msg]);

        // Mark as read immediately if current chat is active
        socket.emit(SOCKET_EVENTS.CHAT_READ, {
          peerId: msg.senderId,
          lastReadMessageId: msg.id,
        });
      }
    };

    // Chat delivered
    const handleChatDelivered = (payload: { clientMessageId: string; messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === payload.clientMessageId ? { ...m, status: 'DELIVERED' } : m
        )
      );
    };

    // Chat read receipt
    const handleChatRead = (payload: { readerId: string; lastReadMessageId?: string }) => {
      if (selectedUser?.id === payload.readerId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === currentUser?.id ? { ...m, status: 'READ' } : m
          )
        );
      }
    };

    // Chat typing
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
  }, [socket, selectedUser, currentUser]);

  // Send message with optimistic update
  const handleSendMessage = (params: {
    content: string;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentSize?: number;
    attachmentMime?: string;
  }) => {
    if (!selectedUser || !socket || !currentUser) return;

    const clientMessageId = crypto.randomUUID();
    const optimisticMessage: MessageDto = {
      id: clientMessageId,
      conversationId: '',
      senderId: currentUser.id,
      clientMessageId,
      content: params.content,
      attachmentUrl: params.attachmentUrl || null,
      attachmentName: params.attachmentName || null,
      attachmentSize: params.attachmentSize || null,
      attachmentMime: params.attachmentMime || null,
      status: 'SENT',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    socket.emit(
      SOCKET_EVENTS.CHAT_SEND,
      {
        clientMessageId,
        recipientId: selectedUser.id,
        content: params.content,
        attachmentUrl: params.attachmentUrl,
        attachmentName: params.attachmentName,
        attachmentSize: params.attachmentSize,
        attachmentMime: params.attachmentMime,
      },
      (ack: { success: boolean; message?: MessageDto; error?: string }) => {
        if (ack?.success && ack.message) {
          setMessages((prev) =>
            prev.map((m) => (m.clientMessageId === clientMessageId ? ack.message! : m))
          );
        }
      }
    );
  };

  const handleSendTyping = (isTyping: boolean) => {
    if (!selectedUser || !socket) return;
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
      <div className="h-screen w-screen flex items-center justify-center bg-[#090d16]">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="h-screen w-screen flex bg-[#090d16] text-slate-100 overflow-hidden font-sans">
      {/* Left Sidebar */}
      <Sidebar
        users={users}
        selectedUser={selectedUser}
        onSelectUser={setSelectedUser}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Main Conversation Feed */}
      {selectedUser ? (
        <MainChat
          peer={selectedUser}
          messages={messages}
          isPeerTyping={!!peerTypingMap[selectedUser.id]}
          onSendMessage={handleSendMessage}
          onSendTyping={handleSendTyping}
          onStartCall={handleStartCall}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
          <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-semibold text-slate-300">No conversation selected</p>
          <p className="text-xs text-slate-500 mt-1">Select a contact from the sidebar to chat</p>
        </div>
      )}

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

      {/* Profile Settings Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

export function App() {
  return <AppContent />;
}

export default App;

import {
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
  SignUploadUrlInput,
  SignUploadUrlResponse,
  UserProfile,
  MessageDto,
} from '@chatso/shared';
import { convex, api as convexApi } from '../convex.js';

let currentToken = localStorage.getItem('chatso_token') || '';

export const setAuthToken = (token: string | null) => {
  if (token) {
    currentToken = token;
    localStorage.setItem('chatso_token', token);
  } else {
    currentToken = '';
    localStorage.removeItem('chatso_token');
  }
};

export const getAuthToken = () => currentToken;

export function formatConvexUser(user: any): UserProfile {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    phoneNumber: user.phoneNumber || undefined,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl || undefined,
    status: user.status,
    bio: user.bio || undefined,
    sendReadReceipts: user.sendReadReceipts !== false,
    sendTypingIndicators: user.sendTypingIndicators !== false,
    allowCalls: user.allowCalls !== false,
    lastSeenAt: new Date(user.lastSeenAt || Date.now()).toISOString(),
    createdAt: new Date(user._creationTime || user.createdAt || Date.now()).toISOString(),
  };
}

export function formatConvexMessage(m: any): MessageDto {
  return {
    id: m._id,
    conversationId: m.conversationId,
    circleId: m.circleId,
    senderId: m.senderId,
    clientMessageId: m.clientMessageId,
    content: m.content,
    attachmentUrl: m.attachmentUrl,
    attachmentName: m.attachmentName,
    attachmentSize: m.attachmentSize,
    attachmentMime: m.attachmentMime,
    status: m.status,
    replyToId: m.replyToId,
    replySnippet: m.replySnippet,
    isEdited: m.isEdited,
    editedAt: m.editedAt,
    isDeleted: m.isDeleted,
    deletedAt: m.deletedAt,
    isSilent: m.isSilent,
    isPinned: m.isPinned,
    voiceDuration: m.voiceDuration,
    pollId: m.pollId,
    reactions: m.reactions || [],
    createdAt: new Date(m.createdAt).toISOString(),
  };
}

export const api = {
  register: async (data: RegisterInput) => {
    const res = await convex.mutation(convexApi.users.register, {
      username: data.username,
      email: data.email,
      password: data.password,
      displayName: data.displayName || data.username,
      deviceName: typeof navigator !== 'undefined' ? (navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Browser') : 'Browser',
    });
    setAuthToken(res.sessionToken);
    return { token: res.sessionToken, user: formatConvexUser(res.user) };
  },

  login: async (data: LoginInput) => {
    const res = await convex.mutation(convexApi.users.login, {
      usernameOrEmail: data.usernameOrEmail,
      password: data.password,
      deviceName: typeof navigator !== 'undefined' ? (navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Browser') : 'Browser',
    });
    setAuthToken(res.sessionToken);
    return { token: res.sessionToken, user: formatConvexUser(res.user) };
  },

  requestSignupVerification: async (data: {
    username: string;
    email: string;
    displayName?: string;
    password?: string;
  }) => {
    return await convex.action(convexApi.auth_email.requestSignupVerification, {
      username: data.username,
      email: data.email,
      displayName: data.displayName,
      password: data.password,
    });
  },

  verifySignupByLink: async (data: { email: string; code: string }) => {
    const res = await convex.mutation(convexApi.auth_email.verifySignupByLink, {
      email: data.email,
      code: data.code,
    });
    setAuthToken(res.sessionToken);
    return { token: res.sessionToken, user: formatConvexUser(res.user) };
  },

  verifyAndRegister: async (data: RegisterInput & { code: string }) => {
    const res = await convex.mutation(convexApi.auth_email.verifyAndRegister, {
      username: data.username,
      email: data.email,
      password: data.password,
      displayName: data.displayName || data.username,
      code: data.code,
    });
    setAuthToken(res.sessionToken);
    return { token: res.sessionToken, user: formatConvexUser(res.user) };
  },

  requestPasswordReset: async (data: { email: string }) => {
    return await convex.action(convexApi.auth_email.requestPasswordReset, {
      email: data.email,
    });
  },

  resetPasswordWithCode: async (data: { email: string; code: string; newPassword: string }) => {
    const res = await convex.mutation(convexApi.auth_email.resetPasswordWithCode, {
      email: data.email,
      code: data.code,
      newPassword: data.newPassword,
    });
    setAuthToken(res.sessionToken);
    return { token: res.sessionToken, user: formatConvexUser(res.user) };
  },

  getMe: async () => {
    if (!currentToken) throw new Error('Not logged in');
    const user = await convex.query(convexApi.users.getMe, { sessionToken: currentToken });
    if (!user) throw new Error('User not found');
    return { user: formatConvexUser(user) };
  },

  logout: async () => {
    if (currentToken) {
      try {
        await convex.mutation(convexApi.users.logout, { sessionToken: currentToken });
      } catch {}
      setAuthToken(null);
    }
  },

  getUsers: async () => {
    try {
      const me = await api.getMe();
      const users = await convex.query(convexApi.users.listContactedUsers, {
        currentUserId: me.user.id as any,
      });
      return { users: users.map(formatConvexUser) };
    } catch {
      return { users: [] };
    }
  },

  getContactedUsers: async () => {
    const me = await api.getMe();
    const users = await convex.query(convexApi.users.listContactedUsers, {
      currentUserId: me.user.id as any,
    });
    return { users: users.map(formatConvexUser) };
  },

  searchUsers: async (queryStr: string) => {
    try {
      const me = await api.getMe();
      const users = await convex.query(convexApi.users.searchUsers, {
        query: queryStr,
        currentUserId: me.user.id as any,
      });
      return { users: users.map(formatConvexUser) };
    } catch {
      return { users: [] };
    }
  },

  updateProfile: async (data: UpdateProfileInput & { bio?: string; sendReadReceipts?: boolean; sendTypingIndicators?: boolean; allowCalls?: boolean }) => {
    const me = await api.getMe();
    const updated = await convex.mutation(convexApi.users.updateProfile, {
      userId: me.user.id as any,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl || undefined,
      status: data.status,
      phoneNumber: data.phoneNumber || undefined,
      bio: data.bio,
      sendReadReceipts: data.sendReadReceipts,
      sendTypingIndicators: data.sendTypingIndicators,
      allowCalls: data.allowCalls,
    });
    return { user: formatConvexUser(updated) };
  },

  getMessages: async (peerId: string) => {
    const me = await api.getMe();
    const conv = await convex.mutation(convexApi.messages.getOrCreateConversation, {
      userId1: me.user.id as any,
      userId2: peerId as any,
    });
    if (!conv) throw new Error('Failed to load conversation');

    const msgs = await convex.query(convexApi.messages.listMessages, {
      conversationId: conv._id,
      currentUserId: me.user.id as any,
    });
    return {
      conversationId: conv._id,
      conversationStatus: conv.status || 'ACCEPTED',
      initiatorId: conv.initiatorId,
      isSelfVault: !!conv.isSelfVault,
      pinnedMessageId: conv.pinnedMessageId,
      messages: msgs.map(formatConvexMessage),
      nextCursor: null,
    };
  },

  getOrCreateConversation: async (userId1: string, userId2: string) => {
    return await convex.mutation(convexApi.messages.getOrCreateConversation, {
      userId1: userId1 as any,
      userId2: userId2 as any,
    });
  },

  getOrCreatePersonalVault: async () => {
    const me = await api.getMe();
    const vault = await convex.mutation(convexApi.messages.getOrCreatePersonalVault, {
      userId: me.user.id as any,
    });
    return vault;
  },

  sendMessage: async (params: {
    conversationId: string;
    senderId: string;
    clientMessageId: string;
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
    return await convex.mutation(convexApi.messages.sendMessage, {
      conversationId: params.conversationId as any,
      senderId: params.senderId as any,
      clientMessageId: params.clientMessageId,
      content: params.content,
      attachmentUrl: params.attachmentUrl,
      attachmentName: params.attachmentName,
      attachmentSize: params.attachmentSize,
      attachmentMime: params.attachmentMime,
      replyToId: params.replyToId as any,
      isSilent: params.isSilent,
      voiceDuration: params.voiceDuration,
      pollId: params.pollId as any,
    });
  },

  editMessage: async (messageId: string, newContent: string) => {
    const me = await api.getMe();
    return await convex.mutation(convexApi.messages.editMessage, {
      messageId: messageId as any,
      userId: me.user.id as any,
      newContent,
    });
  },

  deleteMessage: async (messageId: string) => {
    const me = await api.getMe();
    return await convex.mutation(convexApi.messages.deleteMessage, {
      messageId: messageId as any,
      userId: me.user.id as any,
    });
  },

  toggleReaction: async (messageId: string, emoji: string) => {
    const me = await api.getMe();
    return await convex.mutation(convexApi.messages.toggleReaction, {
      messageId: messageId as any,
      userId: me.user.id as any,
      emoji,
    });
  },

  togglePinMessage: async (conversationId: string, messageId: string) => {
    const me = await api.getMe();
    return await convex.mutation(convexApi.messages.togglePinMessage, {
      conversationId: conversationId as any,
      messageId: messageId as any,
      userId: me.user.id as any,
    });
  },

  saveMessage: async (messageId: string) => {
    const me = await api.getMe();
    return await convex.mutation(convexApi.messages.saveMessage, {
      userId: me.user.id as any,
      messageId: messageId as any,
    });
  },

  unsaveMessage: async (messageId: string) => {
    const me = await api.getMe();
    return await convex.mutation(convexApi.messages.unsaveMessage, {
      userId: me.user.id as any,
      messageId: messageId as any,
    });
  },

  respondToHandshake: async (conversationId: string, action: 'ACCEPT' | 'DECLINE') => {
    const me = await api.getMe();
    return await convex.mutation(convexApi.messages.respondToHandshake, {
      conversationId: conversationId as any,
      currentUserId: me.user.id as any,
      action,
    });
  },

  signUploadUrl: async (data: SignUploadUrlInput): Promise<SignUploadUrlResponse> => {
    const uploadUrl = await convex.mutation(convexApi.files.generateUploadUrl, {
      fileSize: data.fileSize,
    });
    return {
      uploadUrl,
      publicUrl: uploadUrl,
      expiresInSeconds: 900,
      fileName: data.fileName,
      sanitizedKey: data.fileName,
    };
  },

  getIceServers: async () => ({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  }),
};

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

function formatConvexUser(user: any): UserProfile {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl || undefined,
    status: user.status,
    lastSeenAt: new Date(user.lastSeenAt || Date.now()).toISOString(),
    createdAt: new Date(user._creationTime || user.createdAt || Date.now()).toISOString(),
  };
}

export const api = {
  register: async (data: RegisterInput) => {
    const res = await convex.mutation(convexApi.users.register, {
      username: data.username,
      email: data.email,
      password: data.password,
      displayName: data.displayName || data.username,
    });
    setAuthToken(res.sessionToken);
    return { token: res.sessionToken, user: formatConvexUser(res.user) };
  },

  login: async (data: LoginInput) => {
    const res = await convex.mutation(convexApi.users.login, {
      usernameOrEmail: data.usernameOrEmail,
      password: data.password,
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

  getUsers: async () => {
    const users = await convex.query(convexApi.users.listUsers, {});
    return { users: users.map(formatConvexUser) };
  },

  updateProfile: async (data: UpdateProfileInput) => {
    const me = await api.getMe();
    const updated = await convex.mutation(convexApi.users.updateProfile, {
      userId: me.user.id as any,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl || undefined,
      status: data.status,
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
    });
    return {
      conversationId: conv._id,
      messages: msgs.map((m: any): MessageDto => ({
        id: m._id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        clientMessageId: m.clientMessageId,
        content: m.content,
        attachmentUrl: m.attachmentUrl,
        attachmentName: m.attachmentName,
        attachmentSize: m.attachmentSize,
        attachmentMime: m.attachmentMime,
        status: m.status,
        createdAt: new Date(m.createdAt).toISOString(),
      })),
      nextCursor: null,
    };
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

import {
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
  SignUploadUrlInput,
  SignUploadUrlResponse,
  UserProfile,
  MessageDto,
} from '@chatso/shared';

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

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  register: (data: RegisterInput) =>
    apiRequest<{ token: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: LoginInput) =>
    apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMe: () => apiRequest<{ user: UserProfile }>('/api/auth/me'),

  getUsers: () => apiRequest<{ users: UserProfile[] }>('/api/users'),

  updateProfile: (data: UpdateProfileInput) =>
    apiRequest<{ user: UserProfile }>('/api/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getMessages: (peerId: string, cursor?: string, limit: number = 50) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append('cursor', cursor);
    return apiRequest<{
      conversationId: string;
      messages: MessageDto[];
      nextCursor: string | null;
    }>(`/api/conversations/${peerId}/messages?${params.toString()}`);
  },

  signUploadUrl: (data: SignUploadUrlInput) =>
    apiRequest<SignUploadUrlResponse>('/api/files/sign', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getIceServers: () =>
    apiRequest<{ iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> }>(
      '/api/webrtc/ice-servers'
    ),
};

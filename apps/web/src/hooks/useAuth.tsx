import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, RegisterInput, LoginInput, UpdateProfileInput } from '@chatso/shared';
import { api, setAuthToken, getAuthToken } from '../services/api.js';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  requestSignupVerification: (data: {
    username: string;
    email: string;
    displayName?: string;
    password?: string;
  }) => Promise<void>;
  verifyAndRegister: (data: RegisterInput & { code: string }) => Promise<void>;
  verifySignupByLink: (data: { email: string; code: string }) => Promise<void>;
  requestPasswordReset: (data: { email: string }) => Promise<void>;
  resetPasswordWithCode: (data: { email: string; code: string; newPassword: string }) => Promise<void>;
  logout: () => void;
  updateProfile: (data: UpdateProfileInput) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setTokenState] = useState<string | null>(getAuthToken() || null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getAuthToken();
      if (storedToken) {
        try {
          const res = await api.getMe();
          setUser(res.user);
        } catch {
          setAuthToken(null);
          setTokenState(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (data: LoginInput) => {
    setIsLoading(true);
    try {
      const res = await api.login(data);
      setAuthToken(res.token);
      setTokenState(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterInput) => {
    setIsLoading(true);
    try {
      const res = await api.register(data);
      setAuthToken(res.token);
      setTokenState(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const requestSignupVerification = async (data: {
    username: string;
    email: string;
    displayName?: string;
    password?: string;
  }) => {
    await api.requestSignupVerification(data);
  };

  const verifySignupByLink = async (data: { email: string; code: string }) => {
    setIsLoading(true);
    try {
      const res = await api.verifySignupByLink(data);
      setAuthToken(res.token);
      setTokenState(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyAndRegister = async (data: RegisterInput & { code: string }) => {
    setIsLoading(true);
    try {
      const res = await api.verifyAndRegister(data);
      setAuthToken(res.token);
      setTokenState(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPasswordReset = async (data: { email: string }) => {
    await api.requestPasswordReset(data);
  };

  const resetPasswordWithCode = async (data: { email: string; code: string; newPassword: string }) => {
    setIsLoading(true);
    try {
      const res = await api.resetPasswordWithCode(data);
      setAuthToken(res.token);
      setTokenState(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
  };

  const updateProfile = async (data: UpdateProfileInput) => {
    const res = await api.updateProfile(data);
    setUser(res.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        requestSignupVerification,
        verifyAndRegister,
        verifySignupByLink,
        requestPasswordReset,
        resetPasswordWithCode,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

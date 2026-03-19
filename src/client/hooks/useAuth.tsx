/**
 * Authentication Hook and Context
 * Provides authentication state and methods for the frontend
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Spin } from '@arco-design/web-react';

// Types
interface User {
  id: string;
  email: string;
  username?: string;
  email_verified: boolean;
  role: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface LoginCredentials {
  identifier: string; // email or username
  password: string;
}

interface RegisterData {
  email: string;
  username?: string;
  password: string;
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logoutAll: () => Promise<void>;
}

// Storage keys
const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper functions for token storage
const tokenStorage = {
  getAccessToken: (): string | null => {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken: (): string | null => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  getUser: (): User | null => {
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  },
  setTokens: (accessToken: string, refreshToken: string, user: User): void => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clearTokens: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

// API helper
async function authFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: string; details?: string[] }> {
  const accessToken = tokenStorage.getAccessToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}/api/auth${endpoint}`, {
    ...options,
    headers,
  });

  const result = await response.json();
  
  if (!response.ok) {
    return { error: result.error, details: result.details };
  }

  return { data: result.data };
}

// Provider component
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Initialize auth state from storage
  useEffect(() => {
    const accessToken = tokenStorage.getAccessToken();
    const refreshToken = tokenStorage.getRefreshToken();
    const user = tokenStorage.getUser();

    if (accessToken && refreshToken && user) {
      setState({
        user,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });

      // Verify token is still valid by making a refresh request
      authFetch<{ accessToken: string }>('/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }).then(result => {
        if (result.data) {
          localStorage.setItem(ACCESS_TOKEN_KEY, result.data.accessToken);
          setState(prev => ({ ...prev, accessToken: result.data!.accessToken }));
        } else {
          // Token invalid, clear state
          tokenStorage.clearTokens();
          setState({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      }).catch(() => {
        // Token invalid, clear state
        tokenStorage.clearTokens();
        setState({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      });
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const result = await authFetch<{ user: User; accessToken: string; refreshToken: string }>('/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (result.error) {
      throw new Error(result.error);
    }

    const { user, accessToken, refreshToken } = result.data!;
    tokenStorage.setTokens(accessToken, refreshToken, user);

    setState({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const result = await authFetch<{ user: User; accessToken: string; refreshToken: string }>('/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (result.error) {
      const error = new Error(result.error);
      (error as any).details = result.details;
      throw error;
    }

    const { user, accessToken, refreshToken } = result.data!;
    tokenStorage.setTokens(accessToken, refreshToken, user);

    setState({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    
    // Call logout API
    if (refreshToken) {
      await authFetch('/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    }

    // Clear local state
    tokenStorage.clearTokens();
    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const refreshAuth = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const result = await authFetch<{ accessToken: string }>('/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (result.error) {
      throw new Error(result.error);
    }

    const { accessToken } = result.data!;
    const _user = tokenStorage.getUser()!;
    
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    setState(prev => ({ ...prev, accessToken }));
  }, []);

  const updatePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const result = await authFetch('/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (result.error) {
      const error = new Error(result.error);
      (error as any).details = result.details;
      throw error;
    }

    // Password changed, need to re-login
    tokenStorage.clearTokens();
    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const logoutAll = useCallback(async () => {
    await authFetch('/logout-all', {
      method: 'POST',
    });

    tokenStorage.clearTokens();
    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    refreshAuth,
    updatePassword,
    logoutAll,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Protected route component
interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size={40} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <>{fallback || <NavigateToLogin />}</>;
  }

  return <>{children}</>;
}

// Helper component to navigate to login
function NavigateToLogin() {
  const [navigated, setNavigated] = React.useState(false);

  React.useEffect(() => {
    if (!navigated) {
      setNavigated(true);
      window.location.href = '/login';
    }
  }, [navigated]);

  return null;
}

export default useAuth;

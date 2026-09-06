import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../api';

interface User {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  roles: string[];
  tenantId: number;
}

interface AuthContextType {
  user: User | null;
  tenantSlug: string | null;
  tenantName: string | null;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  login: (token: string, user: User, tenantSlug: string, tenantName: string) => void;
  logout: () => void;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenantSlug');
    localStorage.removeItem('tenantName');
    setUser(null);
    setTenantSlug(null);
    setTenantName(null);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const savedSlug = localStorage.getItem('tenantSlug');
    const savedName = localStorage.getItem('tenantName');

    if (token && savedUser && savedSlug) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setTenantSlug(savedSlug);
        setTenantName(savedName);

        // Xác thực lại với server qua /auth/me để cập nhật roles mới nhất và kiểm tra token còn hiệu lực
        authApi.me()
          .then((res: any) => {
            if (res.data?.user) {
              const freshUser: User = {
                id: res.data.user.id,
                fullName: res.data.user.full_name || res.data.user.fullName || parsed.fullName,
                email: res.data.user.email,
                phone: res.data.user.phone,
                roles: res.data.user.roles || [],
                tenantId: res.data.user.tenant_id || res.data.user.tenantId,
              };
              setUser(freshUser);
              localStorage.setItem('user', JSON.stringify(freshUser));
            }
          })
          .catch(() => {
            // Token hết hạn hoặc tài khoản bị khóa -> logout
            logout();
          })
          .finally(() => {
            setIsAuthReady(true);
          });
        return;
      } catch {
        logout();
      }
    }
    setIsAuthReady(true);
  }, []);

  const login = (token: string, user: User, tenantSlug: string, tenantName: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tenantSlug', tenantSlug);
    localStorage.setItem('tenantName', tenantName);
    setUser(user);
    setTenantSlug(tenantSlug);
    setTenantName(tenantName);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenantSlug');
    localStorage.removeItem('tenantName');
    setUser(null);
    setTenantSlug(null);
    setTenantName(null);
  };

  const hasRole = (role: string) => user?.roles?.includes(role) ?? false;

  return (
    <AuthContext.Provider value={{
      user, tenantSlug, tenantName,
      isAuthenticated: !!user,
      isAuthReady,
      login, logout, hasRole
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

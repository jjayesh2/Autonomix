import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { api } from '../lib/api.js';

export type UserRole = 'customer' | 'developer' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  walletAddress: string;
}

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password?: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; requiresSetup?: boolean; message?: string; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  requestDeveloperRole: (reason: string, organization?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  // Explicit demo accounts for evaluation on the Auth screen
  demoLogin: (role: UserRole) => void;
}

const DEMO_PRESET_USERS: Record<UserRole, UserProfile> = {
  customer: {
    id: 'c0000000-0000-0000-0000-000000000001',
    email: 'customer@autonomix.network',
    displayName: 'Enterprise Buyer',
    role: 'customer',
    walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  },
  developer: {
    id: 'd0000000-0000-0000-0000-000000000001',
    email: 'developer@autonomix.network',
    displayName: 'Dev Studio Core',
    role: 'developer',
    walletAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  },
  admin: {
    id: 'a0000000-0000-0000-0000-000000000000',
    email: 'admin@autonomix.network',
    displayName: 'Autonomix Admin',
    role: 'admin',
    walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('autonomix_session_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEMO_PRESET_USERS.customer;
      }
    }
    return DEMO_PRESET_USERS.customer;
  });

  const [loading, setLoading] = useState<boolean>(false);

  // Sync session with localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('autonomix_session_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('autonomix_session_user');
    }
  }, [user]);

  // Check Supabase session on mount
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || 'user@autonomix.network',
          displayName: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'User',
          role: (session.user.user_metadata?.role as UserRole) || 'customer',
          walletAddress: session.user.user_metadata?.wallet_address || '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || 'user@autonomix.network',
          displayName: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'User',
          role: (session.user.user_metadata?.role as UserRole) || 'customer',
          walletAddress: session.user.user_metadata?.wallet_address || '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        });
      } else if (_event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase && password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email!,
            displayName: data.user.user_metadata?.display_name || email.split('@')[0],
            role: (data.user.user_metadata?.role as UserRole) || 'customer',
            walletAddress: data.user.user_metadata?.wallet_address || '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
          });
          return { success: true };
        }
      }

      // Check if matches demo presets
      const lowerEmail = email.toLowerCase();
      if (lowerEmail.includes('admin')) {
        setUser(DEMO_PRESET_USERS.admin);
      } else if (lowerEmail.includes('developer') || lowerEmail.includes('dev')) {
        setUser(DEMO_PRESET_USERS.developer);
      } else {
        setUser({
          id: `usr_${Date.now()}`,
          email,
          displayName: email.split('@')[0],
          role: 'customer',
          walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        });
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    email: string,
    password?: string,
    displayName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      // Security rule: All public registrations are assigned 'customer' role strictly!
      const defaultRole: UserRole = 'customer';

      if (isSupabaseConfigured && supabase && password) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName || email.split('@')[0],
              role: defaultRole,
            },
          },
        });
        if (error) throw error;
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email!,
            displayName: displayName || email.split('@')[0],
            role: defaultRole,
            walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
          });
          return { success: true };
        }
      }

      setUser({
        id: `usr_${Date.now()}`,
        email,
        displayName: displayName || email.split('@')[0],
        role: defaultRole,
        walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed' };
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (): Promise<{
    success: boolean;
    requiresSetup?: boolean;
    message?: string;
    error?: string;
  }> => {
    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        requiresSetup: true,
        message: 'Supabase credentials are not configured in .env. Configure SUPABASE_URL and SUPABASE_ANON_KEY to enable Google OAuth.',
      };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        // Clear message if Google provider is not activated in Supabase dashboard
        if (error.message.includes('not enabled') || error.message.includes('provider')) {
          return {
            success: false,
            requiresSetup: true,
            message: 'Google OAuth provider is not yet enabled in your Supabase dashboard (Authentication -> Providers -> Google).',
          };
        }
        throw error;
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Google OAuth failed' };
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!email) return { success: false, error: 'Email is required' };
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Password reset request failed' };
    }
  };

  const requestDeveloperRole = async (
    reason: string,
    organization?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.requestDeveloperAccess({
        userId: user.id,
        organization,
        reason,
      });

      if (res.success) {
        // Upgrade current session role
        setUser({ ...user, role: 'developer' });
        return { success: true };
      }
      return { success: false, error: res.error || 'Failed to request developer access' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const demoLogin = (selectedRole: UserRole) => {
    setUser(DEMO_PRESET_USERS[selectedRole]);
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signout notice:', err);
      }
    }
    setUser(null);
    localStorage.removeItem('autonomix_session_user');
  };

  const role: UserRole = user?.role || 'customer';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: Boolean(user),
        loading,
        login,
        register,
        loginWithGoogle,
        resetPassword,
        requestDeveloperRole,
        logout,
        demoLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

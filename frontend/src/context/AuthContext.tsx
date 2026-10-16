import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

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
  switchRole: (role: UserRole) => void;
  login: (email: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const DEMO_USERS: Record<UserRole, UserProfile> = {
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
  const [role, setRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('autonomix_user_role') as UserRole;
    return saved && DEMO_USERS[saved] ? saved : 'customer';
  });

  const [user, setUser] = useState<UserProfile | null>(() => {
    return DEMO_USERS[role] || DEMO_USERS.customer;
  });

  useEffect(() => {
    localStorage.setItem('autonomix_user_role', role);
    setUser(DEMO_USERS[role]);
  }, [role]);

  // Sync with Supabase session if configured
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || 'user@autonomix.network',
          displayName: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'User',
          role: (session.user.user_metadata?.role as UserRole) || role,
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
          role: (session.user.user_metadata?.role as UserRole) || role,
          walletAddress: session.user.user_metadata?.wallet_address || '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [role]);

  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
    setUser(DEMO_USERS[newRole]);
  };

  const login = async (email: string, selectedRole: UserRole = 'customer') => {
    if (isSupabaseConfigured && supabase) {
      // Supabase magic link / password sign in can be invoked here
    }
    setRole(selectedRole);
    setUser({
      ...DEMO_USERS[selectedRole],
      email,
      displayName: email.split('@')[0],
    });
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    // Default back to customer guest
    setRole('customer');
    setUser(DEMO_USERS.customer);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: Boolean(user),
        switchRole,
        login,
        logout,
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

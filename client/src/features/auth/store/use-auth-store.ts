import { create } from 'zustand';
import { User, UserRole, ResourceActionPermission, BootstrapState } from '../../../types/auth.types';
import { AUTH_KEYS, AUTH_EVENTS } from '../../../lib/constants';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  bootstrapState: BootstrapState;
  status: string | null;
  nextStep: string | null;
  pendingVerificationEmail: string | null;
  
  // Actions
  setLoading: (isLoading: boolean) => void;
  setInitialized: (isInitialized: boolean) => void;
  setBootstrapState: (state: BootstrapState) => void;
  setPendingVerificationEmail: (email: string | null) => void;
  setAuthStatusAndNextStep: (status: string | null, nextStep: string | null) => void;
  login: (user: User) => void;
  logout: (broadcast?: boolean) => void;
  updateUser: (user: Partial<User>) => void;
  
  // Helper Getters (functions acting on current state)
  hasRole: (role: UserRole) => boolean;
  hasPermission: (permission: ResourceActionPermission) => boolean;
}

// Create a BroadcastChannel for multi-tab synchronization
let authChannel: BroadcastChannel | null = null;

if (typeof window !== 'undefined') {
  authChannel = new BroadcastChannel(AUTH_KEYS.BROADCAST_CHANNEL);
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Listen for auth events from other tabs
  if (authChannel) {
    authChannel.onmessage = (event) => {
      const { type, payload } = event.data;
      
      switch (type) {
        case AUTH_EVENTS.LOGOUT:
          // Silent local logout without rebroadcasting
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            isInitialized: true,
            bootstrapState: 'READY',
          });
          break;
          
        case AUTH_EVENTS.LOGIN:
          // Sync login user from other tab
          set({
            user: payload,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
            bootstrapState: 'READY',
          });
          break;
          
        case AUTH_EVENTS.SESSION_EXTEND:
          // Sync update or refresh across tabs if needed
          if (payload) {
            set({ user: payload });
          }
          break;
          
        default:
          break;
      }
    };
  }

  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isInitialized: false,
    bootstrapState: 'IDLE',
    status: null,
    nextStep: null,
    pendingVerificationEmail: null,

    setLoading: (isLoading) => set({ isLoading }),
    
    setInitialized: (isInitialized) => set({ isInitialized }),

    setBootstrapState: (bootstrapState) => set({ bootstrapState }),

    setPendingVerificationEmail: (email) => set({ pendingVerificationEmail: email }),

    setAuthStatusAndNextStep: (status, nextStep) => set({ status, nextStep }),

    login: (user) => {
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        bootstrapState: 'READY',
      });

      // Broadcast login to all other tabs
      if (authChannel) {
        authChannel.postMessage({
          type: AUTH_EVENTS.LOGIN,
          payload: user,
        });
      }
    },

    logout: (broadcast = true) => {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
        bootstrapState: 'READY',
        status: null,
        nextStep: null,
        pendingVerificationEmail: null,
      });

      // Broadcast logout to all other tabs to trigger immediate logout redirects
      if (broadcast && authChannel) {
        authChannel.postMessage({
          type: AUTH_EVENTS.LOGOUT,
        });
      }
    },

    updateUser: (updatedFields) => {
      const currentUser = get().user;
      if (!currentUser) return;

      const newUser = { ...currentUser, ...updatedFields };
      set({ user: newUser });

      if (authChannel) {
        authChannel.postMessage({
          type: AUTH_EVENTS.SESSION_EXTEND,
          payload: newUser,
        });
      }
    },

    hasRole: (role) => {
      const user = get().user;
      if (!user) return false;
      return user.role === role;
    },

    hasPermission: (permission) => {
      const user = get().user;
      if (!user) return false;
      
      // Admin bypass - Admin has all privileges
      if (user.role === 'ADMIN') return true;

      // Optimization: Exact match check
      if (user.permissions.includes(permission)) return true;

      // Super Admin check (*:*:* or *)
      const perms = user.permissions as string[];
      if (perms.includes('*:*:*') || perms.includes('*')) return true;

      const requiredParts = permission.split(':');

      return user.permissions.some((userPerm) => {
        if (userPerm === '*:*:*') return true;

        const userParts = userPerm.split(':');
        let isMatch = true;

        for (let i = 0; i < userParts.length; i++) {
          // If user segment is "*"
          if (userParts[i] === '*') {
            // If it is the last segment (trailing wildcard), it matches everything from here onwards
            if (i === userParts.length - 1) {
              if (requiredParts.length >= i) {
                return true;
              }
            }

            // If it's an intermediate wildcard, it matches exactly one segment
            if (i >= requiredParts.length) {
              isMatch = false;
              break;
            }

            // Match single segment and continue
            continue;
          }

          // If user segment is not a wildcard, it must match the required segment exactly
          if (i >= requiredParts.length || userParts[i] !== requiredParts[i]) {
            isMatch = false;
            break;
          }
        }

        // For non-trailing wildcards, they must match in total length
        return isMatch && userParts.length === requiredParts.length;
      });
    },
  };
});

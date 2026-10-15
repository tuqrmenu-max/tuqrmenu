import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: null,
  profile: null,
  rol: null,
  loading: true,
  
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setRol: (rol) => set({ rol }),
  setLoading: (loading) => set({ loading }),
  
  clearAuth: () => set({ user: null, profile: null, rol: null }),
}))

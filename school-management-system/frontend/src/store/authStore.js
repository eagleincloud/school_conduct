import { create } from "zustand";

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem("access_token"),
  role: localStorage.getItem("user_role"),

  setUser: (userData) =>
    set({ user: userData, isAuthenticated: true, role: userData.role }),

  logout: () => {
    localStorage.clear();
    set({ user: null, isAuthenticated: false, role: null });
  },
}));

export default useAuthStore;

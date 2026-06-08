import { create } from "zustand";
import schoolService from "../services/schoolService";

/**
 * Zustand store to manage the current school/tenant context globally.
 * This is used across the landing page, login page, and potentially internal dashboards
 * to display school-specific branding (name, logo, etc.).
 */
const useSchoolStore = create((set) => ({
  school: null,
  loading: false,
  error: null,

  /**
   * Fetches branding info for a specific school.
   * @param {string} schoolId - The unique school code (e.g., 'default').
   */
  fetchSchoolInfo: async (schoolId) => {
    set({ loading: true, error: null });
    try {
      const schoolData = await schoolService.getSchoolInfo(schoolId);
      set({ school: schoolData, loading: false });
    } catch (err) {
      const serverMessage = err.response?.data?.message || err.response?.data?.error || err.response?.data || err.message;
      set({
        error: serverMessage || "Failed to fetch school information.",
        loading: false,
        school: null,
      });
    }
  },

  /**
   * Resets the school context.
   */
  clearSchool: () => set({ school: null, error: null, loading: false }),

  /**
   * Manually sets the school info (useful after successful login).
   */
  setSchool: (schoolData) => set({ school: schoolData }),
}));

export default useSchoolStore;

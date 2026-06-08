import api, { BASE_URL } from "./api";

const schoolService = {
  /**
   * Fetches public branding and basic information for a school.
   * @param {string} schoolId - The unique identifier of the school.
   * @returns {Promise<Object>} The school details (name, logo, about, etc.)
   */
  getSchoolInfo: async (schoolId) => {
    if (!schoolId || schoolId === "undefined") {
      throw new Error("Invalid school ID");
    }
    try {
      // Use the centralized axios `api` instance so baseURL, headers and interceptors
      // are consistently applied (avoids subtle URL/headers mismatches).
      const encodedId = encodeURIComponent(String(schoolId));
      const res = await api.get(`/schools/${encodedId}/`);
      return res.data;
    } catch (error) {
      // Improve logging to include status and response body when available
      if (error.response) {
        console.error(`Error fetching school info for ${schoolId}:`, {
          status: error.response.status,
          data: error.response.data,
        });
      } else {
        console.error(`Error fetching school info for ${schoolId}:`, error.message || error);
      }
      throw error;
    }
  },

  /**
   * Fetches a list of all active schools (optional, for SaaS landing page).
   */
  getAllSchools: async () => {
    try {
      const response = await api.get("/schools/admin-schools/");
      return response.data;
    } catch (error) {
      console.error("Error fetching all schools:", error);
      throw error;
    }
  },
};

export default schoolService;

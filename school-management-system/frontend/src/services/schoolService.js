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
      const url = `${BASE_URL}schools/${schoolId}/`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch school information");
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching school info for ${schoolId}:`, error);
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

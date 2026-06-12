import api from "./api";

const authService = {
  login: async (username, password) => {
    const response = await api.post("auth/login/", { username, password });
    if (response.data.access) {
      localStorage.setItem("access_token", response.data.access);
      localStorage.setItem("refresh_token", response.data.refresh);

      // Use user data from login response directly
      const userData = response.data.user;
      localStorage.setItem("user_role", userData.role);
      localStorage.setItem("user_name", userData.name);
      // Always clear school fields first to prevent stale data from previous sessions
      localStorage.removeItem("school_id");
      localStorage.removeItem("school_name");
      localStorage.removeItem("school_logo");
      localStorage.removeItem("user_profile_photo");
      if (userData.school_id)
        localStorage.setItem("school_id", userData.school_id);
      if (userData.school_name)
        localStorage.setItem("school_name", userData.school_name);
      if (userData.school_logo)
        localStorage.setItem("school_logo", userData.school_logo);
      if (userData.profile_photo)
        localStorage.setItem("user_profile_photo", userData.profile_photo);

      return userData;
    }
    return null;
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_profile_photo");
    localStorage.removeItem("school_id");
    localStorage.removeItem("school_name");
    localStorage.removeItem("school_logo");
  },

  getCurrentUser: () => {
    return {
      role: localStorage.getItem("user_role"),
      name: localStorage.getItem("user_name"),
      profile_photo: localStorage.getItem("user_profile_photo"),
      school_id: localStorage.getItem("school_id"),
      school_name: localStorage.getItem("school_name"),
      school_logo: localStorage.getItem("school_logo"),
    };
  },
};

export default authService;

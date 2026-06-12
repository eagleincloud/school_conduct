import axios from "axios";

// Centralized API Configuration
// Supports both Vite (import.meta.env) and Vercel/CRA (process.env)
const getBaseURL = () => {
  // Check if a custom mobile API URL has been set in localStorage
  if (typeof window !== "undefined") {
    const savedMobileUrl = localStorage.getItem("mobile_api_url");
    if (savedMobileUrl) {
      return savedMobileUrl.replace(/\/?$/, "/");
    }
  }

  let url = import.meta.env.VITE_API_URL;
  if (!url || url.startsWith('/')) {
    const isNativeMobile = typeof window !== "undefined" && window.Capacitor && window.Capacitor.getPlatform() !== 'web';
    if (isNativeMobile) {
      url = "http://13.233.140.195/api/";
    } else if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      // Browser dev fallback uses the local backend server
      url = "http://127.0.0.1:8000/api/";
    } else if (typeof window !== "undefined") {
      // Production fallback uses the current hosted origin
      url = `${window.location.origin}/api/`;
    } else {
      url = "http://127.0.0.1:8000/api/";
    }
  }
  return url.replace(/\/?$/, "/");
};

export const BASE_URL = getBaseURL();

// Debugging: Log the API base URL to verify it's not undefined
console.log("🚀 API Base URL:", BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor to add JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Global Sibling Switching: Automatically append student_id from localStorage
    const selectedStudentId = localStorage.getItem("selectedStudentId");
    if (selectedStudentId) {
      if (!config.params) config.params = {};
      // Only append if not already explicitly provided in the request
      if (config.params.student_id === undefined) {
        config.params.student_id = selectedStudentId;
      }
    }
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check if request failed due to 401 Unauthorized and has not been retried yet
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      // Do not attempt token refresh for login or refresh requests themselves
      if (!originalRequest.url.includes("auth/login") && !originalRequest.url.includes("auth/refresh")) {
        originalRequest._retry = true;
        const refreshToken = localStorage.getItem("refresh_token");
        
        if (refreshToken) {
          try {
            // Request a new access token using the refresh token
            // Use axios directly instead of the 'api' instance to prevent recursive interceptor calls
            const response = await axios.post(`${BASE_URL}auth/refresh/`, {
              refresh: refreshToken,
            });
            
            if (response.data && response.data.access) {
              const newAccessToken = response.data.access;
              localStorage.setItem("access_token", newAccessToken);
              
              // Update authorization header and retry original request
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
              return axios(originalRequest);
            }
          } catch (refreshError) {
            console.error("Token refresh failed:", refreshError);
            // Refresh token is expired or invalid, fall through to logout
          }
        }
      }
      
      // Auto logout if refresh failed or no refresh token is present
      if (!originalRequest.url.includes("auth/login")) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user_role");
        localStorage.removeItem("user_name");
        localStorage.removeItem("school_id");
        localStorage.removeItem("school_name");
        localStorage.removeItem("school_logo");
        
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;

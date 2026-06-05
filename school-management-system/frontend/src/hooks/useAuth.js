import useAuthStore from "../store/authStore";

const useAuth = () => {
  const { user, isAuthenticated, role, logout } = useAuthStore();

  return {
    user,
    isAuthenticated,
    role,
    isAdmin: role === "admin",
    isTeacher: role === "teacher",
    isStudent: role === "student",
    logout,
  };
};

export default useAuth;

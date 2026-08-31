import React from "react";
import { Navigate } from "react-router-dom";
import authService from "../services/authService";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const user = authService.getCurrentUser();
  const token = localStorage.getItem("access_token");

  // Not logged in? Redirect to appropriate login page
  if (!token || !user.role) {
    if (window.location.pathname.startsWith("/superadmin")) {
      return <Navigate to="/superadmin/login" replace />;
    }
    if (window.location.pathname.startsWith("/dealer")) {
      return <Navigate to="/dealer-login" replace />;
    }
    return <Navigate to="/" replace />;
  }

  // Enforce password reset on first login for student and teacher
  if (user.is_first_login && (user.role === "student" || user.role === "teacher")) {
    return <Navigate to="/" replace />;
  }

  // Role not allowed? Redirect to their own dashboard or home
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role && ["admin", "teacher", "student", "superadmin", "dealer"].includes(user.role)) {
      return <Navigate to={`/${user.role}/dashboard`} replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;

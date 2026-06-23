import React from "react";
import { Navigate } from "react-router-dom";
import authService from "../services/authService";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const user = authService.getCurrentUser();

  // Not logged in? Redirect to login
  if (!user.role) {
    return <Navigate to="/login" replace />;
  }

  // Enforce password reset on first login for student and teacher
  if (user.is_first_login && (user.role === "student" || user.role === "teacher")) {
    return <Navigate to="/login" replace />;
  }

  // Role not allowed? Redirect to their own dashboard (or error page)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }

  return children;
};

export default ProtectedRoute;

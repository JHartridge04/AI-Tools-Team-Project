/**
 * ProtectedRoute — redirects unauthenticated users to /login.
 *
 * USAGE in your router (React Router v6):
 *   <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
 */

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Wraps a route so only authenticated users can access it.
 * Preserves the intended destination so the user is redirected back after login.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    // Pass the attempted URL as state so Login can redirect back after auth
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

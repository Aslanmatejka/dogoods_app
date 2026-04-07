import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthContext } from '../../utils/AuthContext';

/**
 * AdminRoute - Protected route component that redirects to login if:
 * 1. User is not authenticated
 * 2. User is not an admin
 */
function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, loading, initialized } = useAuthContext();

  // If localStorage says admin, show page immediately (even during init)
  if (isAuthenticated && isAdmin) {
    return children;
  }

  // Show loading state while checking authentication
  if (loading || !initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#2CABE3]"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login?redirect=/admin" replace />;
  }

  // Redirect to homepage if authenticated but not admin
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default AdminRoute;

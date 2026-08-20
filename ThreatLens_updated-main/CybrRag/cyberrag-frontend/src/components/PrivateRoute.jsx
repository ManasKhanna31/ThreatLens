import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function PrivateRoute({ children }) {
  const { isAuthenticated, token, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="auth-loading">Initializing ThreatLens workspace...</div>;
  }

  return (isAuthenticated || token) ? children : <Navigate to="/login" replace state={{ from: location }} />;
}

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './components/auth/Login';
import SignUp from './components/auth/SignUp';
import ForgotPassword from './components/auth/ForgotPassword';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import SessionHistory from './pages/SessionHistory';
import SessionDetail from './pages/SessionDetail';
import MoodTracker from './pages/MoodTracker';
import Settings from './pages/Settings';
import SharedReportView from './pages/SharedReportView';
import NotFound from './pages/NotFound';
import DreamVisualization from './pages/DreamVisualization';
import SessionRouter from './pages/SessionRouter';
import CulturalMirror from './pages/CulturalMirror';
import Home from './pages/Home';

/**
 * Renders at /. Logged-in users go straight to /dashboard;
 * logged-out users see the public landing page.
 */
const RootRoute: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) return null;
  if (currentUser) return <Navigate to="/dashboard" replace />;
  return <Home />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Root — Home page for logged-out, dashboard redirect for logged-in */}
        <Route path="/" element={<RootRoute />} />

        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/shared-report/:reportId" element={<SharedReportView />} />

        {/* Protected routes wrapped in AppLayout */}
        <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/sessions" element={<ProtectedRoute><AppLayout><SessionHistory /></AppLayout></ProtectedRoute>} />
        <Route path="/sessions/:sessionId" element={<ProtectedRoute><AppLayout><SessionDetail /></AppLayout></ProtectedRoute>} />
        <Route path="/mood" element={<ProtectedRoute><AppLayout><MoodTracker /></AppLayout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
        <Route path="/session/:sessionId" element={<ProtectedRoute><AppLayout><SessionRouter /></AppLayout></ProtectedRoute>} />
        <Route path="/dream/:sessionId" element={<ProtectedRoute><AppLayout><DreamVisualization /></AppLayout></ProtectedRoute>} />
        <Route path="/cultural-mirror" element={<ProtectedRoute><AppLayout><CulturalMirror /></AppLayout></ProtectedRoute>} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;

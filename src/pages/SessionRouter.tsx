import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getSessionById } from '../services/sessionService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

/**
 * SessionRouter — Resolves a session ID to the correct page.
 *
 * Links in the app (Dashboard, Session History) all point to /session/:sessionId.
 * This component fetches the session, reads its sessionType, and redirects:
 *   dream_visualization → /dream/:sessionId
 *   everything else      → /sessions/:sessionId
 *
 * This keeps navigation code simple: callers never need to know the session type
 * in advance — they just link to /session/:id.
 */
const SessionRouter: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  const [destination, setDestination] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid || !sessionId) return;

    getSessionById(uid, sessionId).then((result) => {
      if (!result.success) {
        setError(result.error);
        return;
      }
      const { sessionType } = result.data.data;
      if (sessionType === 'dream_visualization' || sessionType === 'meditation') {
        setDestination(`/dream/${sessionId}`);
      } else {
        setDestination(`/sessions/${sessionId}`);
      }
    });
  }, [uid, sessionId]);

  if (error) return <ErrorMessage error={error} />;
  if (destination) return <Navigate to={destination} replace />;
  return <LoadingSpinner />;
};

export default SessionRouter;

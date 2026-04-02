import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg, #f0f4f8)',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '4rem', color: 'var(--primary, #6c63ff)', marginBottom: '0.5rem' }}>
        404
      </h1>
      <h2 style={{ marginBottom: '0.75rem', color: 'var(--text, #2d3748)' }}>
        Page not found
      </h2>
      <p style={{ color: 'var(--text-muted, #718096)', marginBottom: '1.5rem' }}>
        The page you're looking for doesn't exist.
      </p>
      <button
        className="btn btn-primary"
        onClick={() => navigate('/')}
        style={{ padding: '0.75rem 2rem' }}
      >
        Go Home
      </button>
    </div>
  );
};

export default NotFound;

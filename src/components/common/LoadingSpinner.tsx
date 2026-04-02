import React from 'react';

const spinnerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '3rem',
  gap: '1rem',
};

const dotContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
};

const LoadingSpinner: React.FC = () => {
  return (
    <div style={spinnerStyle}>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        .spinner-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--primary, #6c63ff);
          animation: bounce 1.2s infinite ease-in-out;
        }
        .spinner-dot:nth-child(2) { animation-delay: 0.15s; }
        .spinner-dot:nth-child(3) { animation-delay: 0.3s; }
      `}</style>
      <div style={dotContainerStyle}>
        <div className="spinner-dot" />
        <div className="spinner-dot" />
        <div className="spinner-dot" />
      </div>
      <span style={{ color: 'var(--text-muted, #718096)', fontSize: '0.9rem' }}>
        Loading...
      </span>
    </div>
  );
};

export default LoadingSpinner;

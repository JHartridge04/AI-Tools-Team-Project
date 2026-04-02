import React from 'react';

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ message, actionLabel, onAction }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem 1.5rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.5 }}>
        &#x1F331;
      </div>
      <p style={{ color: 'var(--text-muted, #718096)', fontSize: '1rem', marginBottom: '1rem' }}>
        {message}
      </p>
      {actionLabel && onAction && (
        <button
          className="btn btn-primary"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;

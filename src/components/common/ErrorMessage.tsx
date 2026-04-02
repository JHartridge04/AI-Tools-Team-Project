import React from 'react';

interface ErrorMessageProps {
  error: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ error }) => {
  return (
    <div style={{
      background: 'var(--danger-bg, #fff5f5)',
      color: 'var(--danger, #e53e3e)',
      padding: '0.875rem 1rem',
      borderRadius: '8px',
      border: '1px solid var(--danger, #e53e3e)',
      fontSize: '0.9rem',
      lineHeight: '1.5',
    }}>
      {error}
    </div>
  );
};

export default ErrorMessage;

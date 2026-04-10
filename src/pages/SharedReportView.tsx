import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSharedReport } from '../services/reportService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import { SharedReport, WithId } from '../types';

const sessionTypeLabels: Record<string, string> = {
  therapy: 'Therapy',
  dream_visualization: 'Dream Visualization',
  journal: 'Journal',
  meditation: 'Meditation',
};

const SharedReportView: React.FC = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const [report, setReport] = useState<WithId<SharedReport> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reportId) return;

    const fetchReport = async () => {
      setLoading(true);
      const result = await getSharedReport(reportId);
      if (result.success) {
        setReport(result.data);
      } else {
        setError(result.error);
      }
      setLoading(false);
    };

    fetchReport();
  }, [reportId]);

  if (loading) {
    return (
      <div style={pageStyle}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Report Unavailable</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            This report may have expired, reached its access limit, or been revoked by the user.
          </p>
          <ErrorMessage error={error} />
        </div>
      </div>
    );
  }

  if (!report) return null;

  const { reportData } = report.data;
  const moodColor = (val: number) => {
    const hue = (val / 10) * 120;
    return `hsl(${hue}, 60%, 55%)`;
  };

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Privacy Notice */}
        <div style={{
          background: 'var(--primary-bg)',
          color: 'var(--primary)',
          padding: '0.75rem 1rem',
          borderRadius: 8,
          fontSize: '0.85rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
          fontWeight: 500,
        }}>
          This is a shared wellness report. No personal identifying information is included.
        </div>

        {/* Header */}
        <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <h1 style={{ marginBottom: '0.5rem' }}>Wellness Report</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {reportData.dateRange.start} to {reportData.dateRange.end}
          </p>
        </div>

        {/* Overview Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          <StatCard label="Total Sessions" value={String(reportData.totalSessions)} />
          <StatCard
            label="Avg Mood"
            value={reportData.averageMoodScore != null ? reportData.averageMoodScore.toFixed(1) : 'N/A'}
            color={reportData.averageMoodScore != null ? moodColor(reportData.averageMoodScore) : undefined}
          />
          {Object.entries(reportData.sessionBreakdown || {}).map(([type, count]) => (
            <StatCard
              key={type}
              label={sessionTypeLabels[type] || type}
              value={String(count)}
            />
          ))}
        </div>

        {/* Mood Trend */}
        {reportData.moodTrend && reportData.moodTrend.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Mood Trend</h3>
            <div style={{ overflowX: 'auto' }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '0.3rem',
                height: 140,
                minWidth: reportData.moodTrend.length * 24,
              }}>
                {reportData.moodTrend.map((point) => {
                  const heightPct = (point.averageScore / 10) * 100;
                  return (
                    <div
                      key={point.date}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.2rem',
                        minWidth: 20,
                      }}
                    >
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                        {point.averageScore.toFixed(1)}
                      </span>
                      <div
                        style={{
                          width: '100%',
                          maxWidth: 20,
                          height: `${heightPct}%`,
                          minHeight: 4,
                          borderRadius: '3px 3px 0 0',
                          background: moodColor(point.averageScore),
                        }}
                      />
                      <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {point.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Session Summaries */}
        {reportData.sessionSummaries && reportData.sessionSummaries.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Session Summaries</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {reportData.sessionSummaries.map((session, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                      {session.sessionType.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {session.date}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {session.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
          padding: '1rem 0 2rem',
        }}>
          Generated by Adaptive Wellness Companion
        </p>
      </div>
    </div>
  );
};

/* --- Sub-components --- */

const StatCard: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: color || 'var(--text)' }}>
      {value}
    </div>
    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
      {label}
    </div>
  </div>
);

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg)',
  padding: '2rem 1rem',
};

export default SharedReportView;

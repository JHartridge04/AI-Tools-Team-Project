import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { getUserProfile, updateUserProfile } from '../services/userService';
import { generateShareableReport } from '../services/reportService';
import { deleteAllUserData } from '../services/privacyService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import { UserProfile, TherapyMode } from '../types';

const therapyModes: { value: TherapyMode; label: string }[] = [
  { value: 'talk', label: 'Talk' },
  { value: 'guided_visualization', label: 'Guided Visualization' },
  { value: 'exploratory', label: 'Exploratory' },
];

const Settings: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const uid = currentUser?.uid;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [therapyMode, setTherapyMode] = useState<TherapyMode>('talk');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [reportUrl, setReportUrl] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!uid) return;

    const fetchProfile = async () => {
      setLoading(true);
      const result = await getUserProfile(uid);
      if (result.success) {
        setProfile(result.data);
        setDisplayName(result.data.displayName || '');
        setTherapyMode(result.data.preferredTherapyMode || 'talk');
      } else {
        setError(result.error);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [uid]);

  const handleSaveName = async () => {
    if (!uid) return;
    setSaving(true);
    setSaveMsg('');

    const result = await updateUserProfile(uid, { displayName });
    if (result.success) {
      setSaveMsg('Name updated!');
      setTimeout(() => setSaveMsg(''), 3000);
    } else {
      setSaveMsg('Failed to save: ' + result.error);
    }
    setSaving(false);
  };

  const handleTherapyModeChange = async (mode: TherapyMode) => {
    if (!uid) return;
    setTherapyMode(mode);
    await updateUserProfile(uid, { preferredTherapyMode: mode });
  };

  const handleGenerateReport = async () => {
    if (!uid) return;
    setGeneratingReport(true);
    setReportError('');
    setReportUrl('');

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    const result = await generateShareableReport(uid, { start, end });

    if (result.success) {
      const reportId = result.data;
      setReportUrl(`${window.location.origin}/shared-report/${reportId}`);
    } else {
      setReportError(result.error);
    }

    setGeneratingReport(false);
  };

  const [reAuthPassword, setReAuthPassword] = useState('');
  const [showReAuth, setShowReAuth] = useState(false);

  const handleDeleteAccount = async () => {
    if (!uid || !currentUser) return;
    setDeleting(true);
    setDeleteError('');

    // Re-authenticate first — Firebase requires recent login for account deletion
    if (currentUser.email && reAuthPassword) {
      try {
        const credential = EmailAuthProvider.credential(currentUser.email, reAuthPassword);
        await reauthenticateWithCredential(currentUser, credential);
      } catch {
        setDeleteError('Incorrect password. Please try again.');
        setDeleting(false);
        return;
      }
    }

    const result = await deleteAllUserData(uid);
    if (result.success) {
      try {
        await currentUser.delete();
      } catch (err: any) {
        if (err.code === 'auth/requires-recent-login') {
          setDeleteError('');
          setShowReAuth(true);
          setDeleting(false);
          return;
        }
      }
      await logout();
      navigate('/login');
    } else {
      setDeleteError(result.error);
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Settings</h1>

      {/* Profile Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Profile</h3>

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Email</label>
          <input
            className="input"
            value={currentUser?.email || ''}
            readOnly
            style={{ background: 'var(--bg)', cursor: 'not-allowed' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Display Name</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter a display name"
            />
            <button
              className="btn btn-primary"
              onClick={handleSaveName}
              disabled={saving}
            >
              {saving ? '...' : 'Save'}
            </button>
          </div>
          {saveMsg && (
            <p style={{
              fontSize: '0.85rem',
              marginTop: '0.4rem',
              color: saveMsg.startsWith('Failed') ? 'var(--danger)' : 'var(--success)',
            }}>
              {saveMsg}
            </p>
          )}
        </div>

        <div>
          <label style={labelStyle}>Therapy Mode Preference</label>
          <select
            className="input"
            value={therapyMode}
            onChange={(e) => handleTherapyModeChange(e.target.value as TherapyMode)}
          >
            {therapyModes.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Report Sharing */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Report Sharing</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Generate a shareable wellness report for your therapist. Reports contain only aggregated data — no personal information.
        </p>

        <button
          className="btn btn-primary"
          onClick={handleGenerateReport}
          disabled={generatingReport}
          style={{ marginBottom: '0.75rem' }}
        >
          {generatingReport ? 'Generating...' : 'Generate 30-Day Report'}
        </button>

        {reportError && <ErrorMessage error={reportError} />}

        {reportUrl && (
          <div style={{
            background: 'var(--success-bg)',
            padding: '0.75rem 1rem',
            borderRadius: 8,
            fontSize: '0.9rem',
          }}>
            <p style={{ marginBottom: '0.4rem', fontWeight: 500, color: 'var(--success)' }}>
              Report generated! Share this link:
            </p>
            <input
              className="input"
              value={reportUrl}
              readOnly
              onClick={(e) => (e.target as HTMLInputElement).select()}
              style={{ fontSize: '0.85rem' }}
            />
          </div>
        )}

        {/* TODO: List previously generated reports with revoke buttons */}
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          borderRadius: 8,
          border: '1px dashed var(--border)',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          textAlign: 'center',
        }}>
          Previously generated reports will be listed here (coming soon)
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card" style={{ border: '1px solid var(--danger)' }}>
        <h3 style={{ color: 'var(--danger)', marginBottom: '0.75rem' }}>Danger Zone</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button
          className="btn btn-danger"
          onClick={() => setShowDeleteModal(true)}
        >
          Delete My Account
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div className="card" style={{ maxWidth: 420, width: '100%' }}>
            <h3 style={{ color: 'var(--danger)', marginBottom: '0.75rem' }}>
              Are you absolutely sure?
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              This will permanently delete all your data including sessions, messages, mood logs, and reports. This action cannot be undone.
            </p>

            {(showReAuth || true) && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', fontWeight: 500 }}>
                  Enter your password to confirm
                </label>
                <input
                  type="password"
                  className="input"
                  value={reAuthPassword}
                  onChange={(e) => setReAuthPassword(e.target.value)}
                  placeholder="Your current password"
                  disabled={deleting}
                />
              </div>
            )}

            {deleteError && (
              <div style={{ marginBottom: '0.75rem' }}>
                <ErrorMessage error={deleteError} />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-outline"
                onClick={() => { setShowDeleteModal(false); setShowReAuth(false); setReAuthPassword(''); setDeleteError(''); }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteAccount}
                disabled={deleting || !reAuthPassword}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.4rem',
  fontSize: '0.9rem',
  color: 'var(--text-muted)',
  fontWeight: 500,
};

export default Settings;

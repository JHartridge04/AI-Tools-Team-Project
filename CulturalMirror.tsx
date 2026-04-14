/**
 * CulturalMirror.tsx
 *
 * Page component that demonstrates and exposes the Cultural Mirror feature.
 * Users (and teammates building other features) can use this as:
 *   1. A standalone demo/test page at /cultural-mirror
 *   2. A reference for how to call culturalMirrorService.ts from any other component
 *
 * The UI has two tabs:
 *   • Image Prompt Checker  — paste an image prompt, see bias audit + revised version
 *   • Therapist Response Checker — paste an AI response, see bias audit + revised version
 */

import React, { useState } from "react";
import { checkImagePrompt, checkTherapistResponse, BiasAudit } from "../services/culturalMirrorService";
import "../styles/culturalMirror.css";

// ─── Sub-components ───────────────────────────────────────────────────────────

const ConfidencePill: React.FC<{ level: BiasAudit["confidence"] }> = ({ level }) => (
  <span className={`cm-confidence cm-confidence--${level}`}>
    {level} confidence
  </span>
);

const BiasTag: React.FC<{ label: string }> = ({ label }) => (
  <span className="cm-bias-tag">{label}</span>
);

const AuditResult: React.FC<{ audit: BiasAudit; label: string }> = ({ audit, label }) => (
  <div className={`cm-result ${audit.biasDetected ? "cm-result--flagged" : "cm-result--clean"}`}>
    <div className="cm-result-header">
      <div className="cm-result-status">
        {audit.biasDetected ? (
          <span className="cm-status-icon cm-status-icon--warn">⚠</span>
        ) : (
          <span className="cm-status-icon cm-status-icon--ok">✓</span>
        )}
        <strong>{audit.biasDetected ? "Bias detected" : "No bias detected"}</strong>
        <ConfidencePill level={audit.confidence} />
      </div>
    </div>

    {audit.biasDetected && (
      <>
        <div className="cm-bias-types">
          {audit.biasTypes.map((t) => (
            <BiasTag key={t} label={t} />
          ))}
        </div>
        <p className="cm-explanation">{audit.explanation}</p>
      </>
    )}

    <div className="cm-comparison">
      <div className="cm-text-block">
        <span className="cm-text-label">Original {label}</span>
        <p className="cm-text-content cm-text-content--original">{audit.originalText}</p>
      </div>

      {audit.biasDetected && (
        <div className="cm-text-block">
          <span className="cm-text-label">Revised (bias-free)</span>
          <p className="cm-text-content cm-text-content--revised">{audit.revisedText}</p>
        </div>
      )}
    </div>
  </div>
);

// ─── Image Prompt Tab ─────────────────────────────────────────────────────────

const ImagePromptTab: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<BiasAudit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const EXAMPLES = [
    "A doctor examining a patient in a modern hospital",
    "A lawyer presenting a case in court",
    "A family having dinner together",
    "A diverse group of engineers working on a project",
  ];

  async function handleCheck() {
    if (!prompt.trim()) return;
    setLoading(true);
    setAudit(null);
    setError(null);

    const result = await checkImagePrompt(prompt);
    if (result.success && result.data) {
      setAudit(result.data);
    } else {
      setError(result.error ?? "Unknown error");
    }
    setLoading(false);
  }

  return (
    <div className="cm-tab-content">
      <p className="cm-tab-description">
        Paste an image prompt below. The Cultural Mirror will check it for implicit bias
        (racial, gender, age, cultural) and suggest an inclusive revision if needed — before
        it ever reaches an image-generation API.
      </p>

      <div className="cm-examples">
        <span className="cm-examples-label">Try an example:</span>
        {EXAMPLES.map((ex) => (
          <button key={ex} className="cm-example-btn" onClick={() => setPrompt(ex)}>
            {ex}
          </button>
        ))}
      </div>

      <div className="cm-input-group">
        <label className="cm-label" htmlFor="image-prompt">Image prompt</label>
        <textarea
          id="image-prompt"
          className="cm-textarea"
          rows={4}
          placeholder="e.g. A surgeon performing an operation…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      <button
        className="cm-btn"
        onClick={handleCheck}
        disabled={loading || !prompt.trim()}
      >
        {loading ? (
          <span className="cm-btn-loading">
            <span className="cm-spinner" /> Checking for bias…
          </span>
        ) : (
          "Run Cultural Mirror"
        )}
      </button>

      {error && <p className="cm-error">Error: {error}</p>}
      {audit && <AuditResult audit={audit} label="prompt" />}
    </div>
  );
};

// ─── Therapist Response Tab ───────────────────────────────────────────────────

const TherapistResponseTab: React.FC = () => {
  const [response, setResponse] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<BiasAudit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const EXAMPLES = [
    "It sounds like you're going through a lot. Try talking to your family about how you feel — leaning on loved ones is really important during tough times.",
    "Many people find that going to church or prayer helps during difficult moments. Have you tried connecting with your faith community?",
    "As a mother, you naturally want what's best for your children. This stress is completely normal for women in your position.",
    "I'd encourage you to reach out to your support network — whether that's friends, family, a community group, or anyone you trust.",
  ];

  async function handleCheck() {
    if (!response.trim()) return;
    setLoading(true);
    setAudit(null);
    setError(null);

    const result = await checkTherapistResponse(response, context || undefined);
    if (result.success && result.data) {
      setAudit(result.data);
    } else {
      setError(result.error ?? "Unknown error");
    }
    setLoading(false);
  }

  return (
    <div className="cm-tab-content">
      <p className="cm-tab-description">
        Paste an AI therapist response below. The Cultural Mirror audits it for cultural
        assumptions, stereotyping, or non-inclusive advice — and rewrites it if needed before
        it's shown to the user.
      </p>

      <div className="cm-examples">
        <span className="cm-examples-label">Try an example:</span>
        {EXAMPLES.map((ex) => (
          <button key={ex} className="cm-example-btn" onClick={() => setResponse(ex)}>
            {ex.length > 60 ? ex.slice(0, 60) + "…" : ex}
          </button>
        ))}
      </div>

      <div className="cm-input-group">
        <label className="cm-label" htmlFor="user-context">
          User context <span className="cm-label-optional">(optional)</span>
        </label>
        <input
          id="user-context"
          className="cm-input"
          type="text"
          placeholder="e.g. User mentioned they are Buddhist and live in South Korea"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </div>

      <div className="cm-input-group">
        <label className="cm-label" htmlFor="therapist-response">AI therapist response</label>
        <textarea
          id="therapist-response"
          className="cm-textarea"
          rows={5}
          placeholder="Paste the AI-generated therapist response here…"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
        />
      </div>

      <button
        className="cm-btn"
        onClick={handleCheck}
        disabled={loading || !response.trim()}
      >
        {loading ? (
          <span className="cm-btn-loading">
            <span className="cm-spinner" /> Auditing response…
          </span>
        ) : (
          "Run Cultural Mirror"
        )}
      </button>

      {error && <p className="cm-error">Error: {error}</p>}
      {audit && <AuditResult audit={audit} label="response" />}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "image" | "therapist";

const CulturalMirror: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("image");

  return (
    <div className="cm-page">
      <div className="cm-header">
        <div className="cm-header-icon">◈</div>
        <div>
          <h1 className="cm-title">Cultural Mirror</h1>
          <p className="cm-subtitle">
            Bias detection &amp; inclusive rewriting — for image prompts and therapist responses
          </p>
        </div>
      </div>

      <div className="cm-how-it-works">
        <h2 className="cm-section-title">How it works</h2>
        <div className="cm-steps">
          <div className="cm-step">
            <span className="cm-step-num">1</span>
            <p>Your text is sent to the Cultural Mirror, a specialized Claude prompt trained on bias patterns.</p>
          </div>
          <div className="cm-step">
            <span className="cm-step-num">2</span>
            <p>It detects implicit bias — racial, gender, cultural, religious, socioeconomic assumptions.</p>
          </div>
          <div className="cm-step">
            <span className="cm-step-num">3</span>
            <p>If bias is found, it rewrites the text to be inclusive while preserving the original intent.</p>
          </div>
          <div className="cm-step">
            <span className="cm-step-num">4</span>
            <p>Only the revised, audited version reaches the user or the image API.</p>
          </div>
        </div>
      </div>

      <div className="cm-tabs">
        <button
          className={`cm-tab-btn ${activeTab === "image" ? "cm-tab-btn--active" : ""}`}
          onClick={() => setActiveTab("image")}
        >
          🖼 Image Prompts
        </button>
        <button
          className={`cm-tab-btn ${activeTab === "therapist" ? "cm-tab-btn--active" : ""}`}
          onClick={() => setActiveTab("therapist")}
        >
          💬 Therapist Responses
        </button>
      </div>

      {activeTab === "image" ? <ImagePromptTab /> : <TherapistResponseTab />}
    </div>
  );
};

export default CulturalMirror;

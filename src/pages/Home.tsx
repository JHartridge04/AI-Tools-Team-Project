/**
 * Home.tsx — Public landing page for the Adaptive Wellness Companion.
 *
 * Shown to logged-out users at /. Never wrapped in AppLayout.
 * Logged-in users are redirected to /dashboard before this renders.
 */

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/home.css';

// ── Scroll-triggered fade-in ──────────────────────────────────────────────────

function useFadeIn() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.fade-in');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('fade-in--visible');
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// ── Page component ────────────────────────────────────────────────────────────

const Home: React.FC = () => {
  useFadeIn();

  return (
    <div className="home">
      <HeroSection />
      <FeaturesSection />
      <MissionSection />
      <HowItWorksSection />
      <PrivacySection />
      <FooterSection />
    </div>
  );
};

// ── Hero ──────────────────────────────────────────────────────────────────────

const HeroSection: React.FC = () => (
  <section className="home-hero">
    {/* Ambient animated orbs — CSS only */}
    <div className="home-hero__orb home-hero__orb--1" aria-hidden="true" />
    <div className="home-hero__orb home-hero__orb--2" aria-hidden="true" />
    <div className="home-hero__orb home-hero__orb--3" aria-hidden="true" />

    <div className="home-hero__content">
      <span className="home-hero__eyebrow">Adaptive Wellness Companion</span>

      <h1 className="home-hero__heading">
        Your mind deserves<br />gentle, consistent care.
      </h1>

      <p className="home-hero__tagline">
        Accessible mental wellness, guided by AI
      </p>

      <p className="home-hero__body">
        The Adaptive Wellness Companion offers evidence-based therapeutic conversations,
        guided dream visualizations, and mood tracking — available whenever you need them,
        on any device. Built for people who want real support without barriers.
      </p>

      <div className="home-hero__actions">
        <Link to="/signup" className="home-btn home-btn--primary">
          Get Started
        </Link>
        <Link to="/login" className="home-btn home-btn--outline">
          Log In
        </Link>
      </div>
    </div>
  </section>
);

// ── Features ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '💬',
    title: 'Adaptive AI Therapist',
    desc: 'Evidence-based therapeutic conversations available whenever you need them — no appointment, no waitlist.',
  },
  {
    icon: '🌙',
    title: 'Dream Visualization',
    desc: 'Turn your goals and calm places into immersive AI-generated imagery with a guided meditation narrative.',
  },
  {
    icon: '💜',
    title: 'Mood Tracking',
    desc: 'Understand your emotional patterns with gentle daily check-ins and a 7-day mood trend you can actually act on.',
  },
  {
    icon: '◈',
    title: 'Cultural Mirror',
    desc: 'Bias-aware AI that respects your identity and background — inclusive by design, not as an afterthought.',
  },
];

const FeaturesSection: React.FC = () => (
  <section className="home-section">
    <div className="home-section__inner">
      <h2 className="home-section__heading fade-in">Four ways we support you</h2>
      <p className="home-section__sub fade-in">
        Every tool is built around a single principle: your wellbeing matters, and you deserve
        access to it without jumping through hoops.
      </p>

      <div className="home-features__grid">
        {FEATURES.map((f) => (
          <div key={f.title} className="home-feature-card fade-in">
            <div className="home-feature-card__icon">{f.icon}</div>
            <h3 className="home-feature-card__title">{f.title}</h3>
            <p className="home-feature-card__desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ── Mission ───────────────────────────────────────────────────────────────────

const MissionSection: React.FC = () => (
  <section className="home-section home-section--deep">
    <div className="home-section__inner">
      <h2 className="home-section__heading fade-in">Mental wellness, for everyone</h2>
      <p className="home-mission__body fade-in">
        Traditional therapy is transformative — but it isn't always accessible. Long waitlists,
        high costs, and cultural barriers keep too many people from getting support they need.
        The Adaptive Wellness Companion isn't a replacement for professional care, but it is a
        companion that's available at 2am on a Tuesday, that won't judge your background or
        beliefs, and that costs nothing to try. We built it for the version of you that needed
        something — right now — and found nothing there.
      </p>
    </div>
  </section>
);

// ── How it works ──────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: '1',
    title: 'Create your account',
    desc: 'Quick, private, and free. No medical history, insurance, or identifying information required.',
  },
  {
    num: '2',
    title: 'Choose your experience',
    desc: "Start a therapy chat, begin a dream visualization session, or log your mood — you're in control.",
  },
  {
    num: '3',
    title: 'Check in anytime',
    desc: 'Your sessions and data are always private and yours. Return whenever you need support.',
  },
];

const HowItWorksSection: React.FC = () => (
  <section className="home-section home-section--tinted">
    <div className="home-section__inner">
      <h2 className="home-section__heading fade-in">Getting started is simple</h2>
      <p className="home-section__sub fade-in">
        No forms, no friction. You can be in your first session in under two minutes.
      </p>

      <div className="home-steps">
        {STEPS.map((step) => (
          <div key={step.num} className="home-step fade-in">
            <div className="home-step__num">{step.num}</div>
            <h3 className="home-step__title">{step.title}</h3>
            <p className="home-step__desc">{step.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ── Privacy ───────────────────────────────────────────────────────────────────

const PRIVACY_POINTS = [
  'Your account requires only an email address — no real name, phone number, or medical information.',
  'Session content is stored privately under your account. We do not sell or share your data.',
  'You can permanently delete all your data at any time from Settings.',
  'Shareable reports are generated only when you choose, contain only aggregated data, and can be revoked.',
  'This is a wellness companion, not a licensed mental health provider. Always seek professional care for serious concerns.',
];

const PrivacySection: React.FC = () => (
  <section className="home-section">
    <div className="home-section__inner">
      <div className="home-privacy fade-in">
        <div className="home-privacy__header">
          <span className="home-privacy__icon" aria-hidden="true">🛡</span>
          <h2 className="home-privacy__heading">Your privacy is foundational</h2>
        </div>

        <div className="home-privacy__points">
          {PRIVACY_POINTS.map((point) => (
            <div key={point} className="home-privacy__point">
              <span className="home-privacy__point-icon" aria-hidden="true">✓</span>
              <span>{point}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

// ── Footer ────────────────────────────────────────────────────────────────────

const FooterSection: React.FC = () => (
  <footer className="home-footer">
    <div className="home-footer__inner">
      <div className="home-footer__left">
        <p className="home-footer__copy">
          © {new Date().getFullYear()} Adaptive Wellness Companion
        </p>
        <p className="home-footer__disclaimer">
          This app is not a substitute for professional medical or mental health care.
          If you are in crisis, please contact emergency services or a crisis line.
        </p>
        <nav className="home-footer__links" aria-label="Footer navigation">
          <Link to="/login" className="home-footer__link">Log In</Link>
          <Link to="/signup" className="home-footer__link">Sign Up</Link>
        </nav>
      </div>

      <div className="home-footer__crisis" role="complementary" aria-label="Crisis resources">
        <p className="home-footer__crisis-heading">In crisis? Reach out now.</p>
        <p className="home-footer__crisis-line">
          <strong>988 Suicide &amp; Crisis Lifeline</strong>
          {' — '}
          <a href="tel:988" className="home-footer__crisis-link">call 988</a>
          {' or '}
          <a href="sms:988" className="home-footer__crisis-link">text 988</a>
        </p>
        <p className="home-footer__crisis-line">
          <strong>Crisis Text Line</strong>
          {' — '}
          <a href="sms:741741?body=HOME" className="home-footer__crisis-link">
            text HOME to 741741
          </a>
        </p>
      </div>
    </div>
  </footer>
);

export default Home;

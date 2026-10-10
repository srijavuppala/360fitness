import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Utensils,
  ChartNoAxesCombined,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import { Logo, FoodIllustration, Notice } from "../components/ui";
import { useStore, cloudConfigured } from "../lib/store";
export function Landing() {
  useEffect(() => {
    document.title = "360° Fitness — Nutrition for real life";
  }, []);
  return (
    <div className="public-site">
      <header className="public-nav">
        <Logo />
        <nav>
          <a href="#how-it-works">How it works</a>
          <a href="#your-routine">Made for you</a>
          <Link to="/login">Sign in</Link>
          <Link to="/app" className="button small">
            Open your workspace
            <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="landing-kicker">
              <span className="live-dot" />
              NUTRITION FOR REAL LIFE
            </span>
            <h1>
              Good habits.
              <br />
              Real food.
              <br />
              <em>Your pace.</em>
            </h1>
            <p>
              Understand what you eat, find your everyday rhythm, and leave a
              little room for life. Your nutrition journey starts with one meal.
            </p>
            <div className="hero-buttons">
              <Link to="/app" className="button">
                Start your routine
                <ArrowRight size={18} />
              </Link>
              <a href="#how-it-works" className="text-button">
                Take a closer look
                <ArrowUpRight size={17} />
              </a>
            </div>
            <span className="hero-footnote">
              <Check size={15} />
              Start locally. No account required.
            </span>
          </div>
          <div className="landing-visual">
            <span className="food-caption">
              A little balance.
              <br />A lot of possibility.
            </span>
            <FoodIllustration />
            <div className="floating-note">
              <span className="check-bubble">
                <Check size={20} />
              </span>
              <div>
                <strong>One meal. One small step.</strong>
                <small>You don’t need a perfect day.</small>
              </div>
            </div>
            <span className="visual-flower" aria-hidden="true">
              ✳
            </span>
          </div>
        </section>
        <div className="benefit-ribbon">
          <span>Built around your real routine</span>
          <i>✳</i>
          <span>Your data stays yours</span>
          <i>✳</i>
          <span>Progress without pressure</span>
          <i>✳</i>
          <span>A little, every day</span>
        </div>
        <section id="how-it-works" className="landing-section">
          <div className="section-top">
            <div>
              <span className="eyebrow">SIMPLER DAYS START HERE</span>
              <h2>
                Less overthinking.
                <br />
                More living.
              </h2>
            </div>
            <p>
              Make nutrition a small part of your day.
              <br />
              Not the thing your whole day revolves around.
            </p>
          </div>
          <div className="feature-grid">
            {[
              [
                Utensils,
                "01",
                "Know what’s on your plate.",
                "Log meals and adjust portions. Start with a food label, a saved meal, or an estimate you can review.",
              ],
              [
                BookOpen,
                "02",
                "Make your usual effortless.",
                "Save the meals you love, then bring them back with a quick check-in. A plan only counts when you log it.",
              ],
              [
                ChartNoAxesCombined,
                "03",
                "See the bigger picture.",
                "Explore your nutrition over time. Missing days stay missing, so the picture stays honest.",
              ],
            ].map(([Icon, n, title, body]) => {
              const Symbol = Icon as typeof Utensils;
              return (
                <article className="feature" key={String(n)}>
                  <div>
                    <Symbol size={25} />
                    <span>{String(n)}</span>
                  </div>
                  <h3>{String(title)}</h3>
                  <p>{String(body)}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section id="your-routine" className="landing-statement">
          <span className="eyebrow">MADE FOR YOUR EVERYDAY</span>
          <h2>
            Not every day looks the same.
            <br />
            <em>Your routine can make room.</em>
          </h2>
          <p>
            The quick breakfast. The late dinner. The meal you make on repeat.
            <br />
            There’s a place for all of it.
          </p>
          <Link to="/app" className="button">
            Find your rhythm
            <ArrowUpRight size={17} />
          </Link>
        </section>
      </main>
      <footer className="public-footer">
        <Logo />
        <span>A little awareness. A little consistency.</span>
        <Link to="/privacy">Privacy & data</Link>
        <Link to="/app">
          Open app
          <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
export function Login() {
  useEffect(() => {
    document.title = "Sign in · 360° Fitness";
  }, []);
  const { user, signIn, notice } = useStore();
  return (
    <div className="login-page">
      <Link to="/" className="login-back">
        ← Back home
      </Link>
      <div className="login-art">
        <Logo />
        <h1>
          Your everyday,
          <br />
          <em>a little lighter.</em>
        </h1>
        <FoodIllustration />
        <p>Good habits grow one small step at a time.</p>
      </div>
      <div className="login-form">
        <span className="eyebrow">WELCOME TO YOUR SPACE</span>
        <h1>
          Make yourself
          <br />
          at home.
        </h1>
        <p className="muted">Your meals, your routine, your pace.</p>
        {user ? (
          <Link className="button full" to="/app">
            Continue to your account
            <ArrowRight size={17} />
          </Link>
        ) : cloudConfigured ? (
          <button className="button full" onClick={signIn}>
            Continue with Google
            <ArrowRight size={17} />
          </button>
        ) : (
          <Notice>
            Account sign-in is not enabled on this preview. You can use the full
            local workspace below.
          </Notice>
        )}
        <Link to="/app" className="button secondary full">
          Continue on this browser
        </Link>
        <div className="login-privacy">
          <ShieldCheck size={19} />
          <p>
            Local data stays in this browser. Connecting an account opens a
            separate cloud workspace.{" "}
            <Link to="/privacy">Read about your data.</Link>
          </p>
        </div>
        {notice && <Notice>{notice}</Notice>}
      </div>
    </div>
  );
}
export function Privacy() {
  useEffect(() => {
    document.title = "Privacy & data · 360° Fitness";
  }, []);
  return (
    <div className="public-site">
      <header className="public-nav">
        <Logo />
        <Link className="button secondary small" to="/app">
          Back to workspace
        </Link>
      </header>
      <main className="privacy-page">
        <span className="eyebrow">YOUR DATA, EXPLAINED</span>
        <h1>Your space stays yours.</h1>
        <p className="large-copy">
          Here’s how this version of 360° Fitness handles your information.
        </p>
        <section>
          <h2>When you use a local workspace</h2>
          <p>
            Meal logs, meal plans, water entries and preferences are saved in
            this browser’s local storage. They are not automatically uploaded.
            Other people using the same browser profile may be able to access
            them. Clearing site data removes them. Export a backup from Settings
            to keep a copy.
          </p>
        </section>
        <section>
          <h2>When you connect an account</h2>
          <p>
            If account services are enabled, Google provides sign-in through
            Firebase Authentication. Account records are stored in Cloud
            Firestore under your user ID. Local records are not transferred
            automatically; you can explicitly restore a backup into your
            account.
          </p>
        </section>
        <section>
          <h2>When you request meal analysis</h2>
          <p>
            Automatic text analysis, when enabled, sends the meal description to
            our Firebase function, Google Gemini and a food-data lookup service.
            Estimates are returned for your review and are only logged when you
            confirm. The manual import flow does not send data: you decide
            whether to share a prompt with an assistant. This version does not
            upload meal photographs.
          </p>
        </section>
        <section>
          <h2>Export and deletion</h2>
          <p>
            You can export or restore a JSON backup in Settings. Local records
            can be removed by clearing this site’s browser storage. Connected
            accounts have a deletion control that requires renewed sign-in and
            permanently removes account data.
          </p>
        </section>
        <section>
          <h2>What the numbers mean</h2>
          <p>
            Food-library values and AI outputs are estimates. Check them against
            food labels and adjust portions. This product records information
            you choose; it is not a medical service.
          </p>
        </section>
        <section>
          <h2>Cookies and tracking</h2>
          <p>
            This build does not include advertising or behavioral analytics.
            When connected services are enabled, Firebase authentication and
            reCAPTCHA Enterprise may process technical information to maintain
            sessions and protect account access. Their policies apply to those
            services.
          </p>
        </section>
        <Notice>
          This page describes the implemented software. Operator identity,
          support contact, retention commitments and jurisdiction-specific legal
          terms must be finalized before a public launch.
        </Notice>
      </main>
    </div>
  );
}

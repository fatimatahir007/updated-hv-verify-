import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Eye, Fingerprint, Vote, CheckCircle, Lock, Users } from "lucide-react";

// ── Step data ────────────────────────────────────────────────
const STEPS = [
  {
    id: 1,
    icon: "📋",
    label: "Register",
    title: "Fill Your Details",
    desc: "Enter your CNIC, name, phone and constituency. Your data is validated and encrypted instantly.",
    color: "#0f766e",
    glow: "rgba(15,118,110,0.25)",
  },
  {
    id: 2,
    icon: "👁️",
    label: "Face Scan",
    title: "Identity Check",
    desc: "AI scans your face to make sure you haven't registered before. Zero duplicates allowed.",
    color: "#1d4ed8",
    glow: "rgba(29,78,216,0.25)",
  },
  {
    id: 3,
    icon: "😉",
    label: "Liveness",
    title: "Prove You're Real",
    desc: "Blink, turn left, turn right, raise your hand. AI confirms a live person — not a photo.",
    color: "#7c3aed",
    glow: "rgba(124,58,237,0.25)",
  },
  {
    id: 4,
    icon: "🗳️",
    label: "Vote",
    title: "Cast Your Ballot",
    desc: "Enter your Voter ID. Face verified again. Select your candidate. One person, one vote.",
    color: "#0369a1",
    glow: "rgba(3,105,161,0.25)",
  },
  {
    id: 5,
    icon: "🔗",
    label: "Ledger",
    title: "Immutable Record",
    desc: "Your vote is hashed onto a blockchain ledger. Tamper-proof, auditable, permanent.",
    color: "#b45309",
    glow: "rgba(180,83,9,0.25)",
  },
  {
    id: 6,
    icon: "✅",
    label: "Verified",
    title: "Receipt Issued",
    desc: "You receive a unique receipt code to verify your vote was counted. Total transparency.",
    color: "#16a34a",
    glow: "rgba(22,163,74,0.25)",
  },
];

// ── Animated counter ─────────────────────────────────────────
function Counter({ target, suffix = "" }) {
  const [val, setVal] = useState(0);
  const ref = useRef();
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        let start = 0;
        const step = Math.ceil(target / 60);
        const t = setInterval(() => {
          start += step;
          if (start >= target) { setVal(target); clearInterval(t); }
          else setVal(start);
        }, 16);
        obs.disconnect();
      }
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ── Step card ────────────────────────────────────────────────
function StepCard({ step, index, active, onClick }) {
  return (
    <div
      onClick={() => onClick(index)}
      style={{
        cursor: "pointer",
        borderRadius: 20,
        padding: "24px 20px",
        background: active
          ? `linear-gradient(135deg, ${step.color}18, ${step.color}08)`
          : "rgba(255,255,255,0.6)",
        border: `2px solid ${active ? step.color : "rgba(15,23,42,0.07)"}`,
        boxShadow: active ? `0 8px 32px ${step.glow}` : "none",
        transform: active ? "translateY(-4px)" : "none",
        transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Step number */}
      <div style={{
        position: "absolute", top: 12, right: 14,
        fontSize: 11, fontWeight: 700, color: step.color,
        opacity: 0.5, fontFamily: "monospace",
      }}>
        {String(step.id).padStart(2, "0")}
      </div>

      {/* Icon */}
      <div style={{
        fontSize: 32, marginBottom: 12,
        filter: active ? "none" : "grayscale(0.4)",
        transition: "filter 0.3s",
      }}>
        {step.icon}
      </div>

      {/* Label */}
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: step.color,
        marginBottom: 4,
      }}>
        {step.label}
      </div>

      {/* Title */}
      <div style={{
        fontSize: 15, fontWeight: 700, color: "#0f172a",
        marginBottom: 6, lineHeight: 1.3,
      }}>
        {step.title}
      </div>

      {/* Desc — only when active */}
      <div style={{
        fontSize: 13, color: "#556178", lineHeight: 1.55,
        maxHeight: active ? 80 : 0,
        overflow: "hidden",
        opacity: active ? 1 : 0,
        transition: "max-height 0.4s ease, opacity 0.3s ease",
      }}>
        {step.desc}
      </div>

      {/* Active bar */}
      {active && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: 3, background: step.color,
          borderRadius: "0 0 20px 20px",
        }} />
      )}
    </div>
  );
}

// ── Security badge ───────────────────────────────────────────
function Badge({ icon, label }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: "rgba(255,255,255,0.8)",
      border: "1px solid rgba(15,23,42,0.08)",
      borderRadius: 40, padding: "8px 16px",
      fontSize: 13, fontWeight: 600, color: "#0f172a",
      boxShadow: "0 2px 12px rgba(15,23,42,0.06)",
    }}>
      {icon}
      {label}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────
export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [autoPlay, setAutoPlay]     = useState(true);
  const timerRef = useRef();

  // Auto-cycle through steps
  useEffect(() => {
    if (!autoPlay) return;
    timerRef.current = setInterval(() => {
      setActiveStep((p) => (p + 1) % STEPS.length);
    }, 2800);
    return () => clearInterval(timerRef.current);
  }, [autoPlay]);

  const handleStepClick = (i) => {
    setAutoPlay(false);
    clearInterval(timerRef.current);
    setActiveStep(i);
  };

  return (
    <div style={{ fontFamily: "Manrope, sans-serif" }}>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{
        padding: "80px 24px 60px",
        maxWidth: 960, margin: "0 auto",
        textAlign: "center",
      }}>


        {/* Headline */}
        <h1 style={{
          fontSize: "clamp(2rem, 5vw, 3.4rem)",
          fontWeight: 800, lineHeight: 1.15,
          color: "#0f172a", marginBottom: 20,
          fontFamily: "Space Grotesk, sans-serif",
          animation: "fadeUp 0.6s 0.1s ease both",
        }}>
          Your vote. Verified.{" "}
          <span style={{
            background: "linear-gradient(90deg, #0f766e, #1d4ed8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            Immutable.
          </span>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: "clamp(1rem, 2vw, 1.15rem)",
          color: "#556178", maxWidth: 580, margin: "0 auto 36px",
          lineHeight: 1.65,
          animation: "fadeUp 0.6s 0.2s ease both",
        }}>
        </p>

        {/* CTA buttons */}
        <div style={{
          display: "flex", gap: 16, justifyContent: "center",
          flexWrap: "wrap", marginBottom: 60,
          animation: "fadeUp 0.6s 0.3s ease both",
        }}>
          <Link to="/vote" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "linear-gradient(135deg, #0f766e, #0ea5a5)",
            color: "#fff", padding: "16px 32px", borderRadius: 14,
            fontWeight: 700, fontSize: 16, textDecoration: "none",
            boxShadow: "0 8px 24px rgba(15,118,110,0.3)",
            transition: "all 0.25s ease",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(15,118,110,0.4)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(15,118,110,0.3)"; }}
          >
            Enter CNIC to Vote <ArrowRight size={18} />
          </Link>
          <Link to="/vote" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "#fff",
            border: "1.5px solid rgba(15,23,42,0.1)",
            color: "#0f172a", padding: "16px 32px", borderRadius: 14,
            fontWeight: 700, fontSize: 16, textDecoration: "none",
            boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
            transition: "all 0.25s ease",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 24px rgba(15,23,42,0.1)"; e.currentTarget.style.borderColor = "rgba(15,23,42,0.2)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(15,23,42,0.06)"; e.currentTarget.style.borderColor = "rgba(15,23,42,0.1)"; }}
          >
            Cast your vote
          </Link>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section style={{
        padding: "60px 24px 80px",
        maxWidth: 1100, margin: "0 auto",
      }}>

        {/* Section header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "#0f766e", marginBottom: 10,
          }}>
            How it works
          </div>
          <h2 style={{
            fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
            fontWeight: 800, color: "#0f172a",
            fontFamily: "Space Grotesk, sans-serif",
          }}>
            6 steps. Zero fraud.
          </h2>
          <p style={{ color: "#556178", marginTop: 8, fontSize: 15 }}>
            Click any step to explore. Watch the flow animate automatically.
          </p>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 4, background: "rgba(15,23,42,0.07)",
          borderRadius: 4, marginBottom: 32, overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${((activeStep + 1) / STEPS.length) * 100}%`,
            background: "linear-gradient(90deg, #0f766e, #1d4ed8)",
            borderRadius: 4,
            transition: "width 0.4s ease",
          }} />
        </div>

        {/* Step grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
        }}>
          {STEPS.map((step, i) => (
            <StepCard
              key={step.id}
              step={step}
              index={i}
              active={activeStep === i}
              onClick={handleStepClick}
            />
          ))}
        </div>

        {/* Connector arrows */}
        <div style={{
          display: "flex", justifyContent: "center",
          gap: 8, marginTop: 24, flexWrap: "wrap",
        }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                onClick={() => handleStepClick(i)}
                style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: activeStep === i ? s.color : "rgba(15,23,42,0.15)",
                  cursor: "pointer",
                  transform: activeStep === i ? "scale(1.5)" : "scale(1)",
                  transition: "all 0.3s ease",
                }}
              />
              {i < STEPS.length - 1 && (
                <div style={{
                  width: 20, height: 1,
                  background: "rgba(15,23,42,0.12)",
                }} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────── */}
      <section style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        padding: "64px 24px",
      }}>
        <div style={{
          maxWidth: 900, margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 32, textAlign: "center",
        }}>
          {[
            { value: 99, suffix: ".9%", label: "Uptime" },
            { value: 0, suffix: "", label: "Fraud Alerts" },
            { value: 128, suffix: "+", label: "Face Landmarks Tracked" },
            { value: 5, suffix: " layers", label: "Security Layers" },
          ].map((s) => (
            <div key={s.label}>
              <div style={{
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 800, color: "#fff",
                fontFamily: "Space Grotesk, sans-serif",
              }}>
                <Counter target={s.value} suffix={s.suffix} />
              </div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FOOTER ───────────────────────────────────────── */}
      <section style={{
        padding: "80px 24px",
        textAlign: "center",
        maxWidth: 600, margin: "0 auto",
      }}>
        <CheckCircle size={40} color="#16a34a" style={{ marginBottom: 16 }} />
        <h2 style={{
          fontSize: "clamp(1.4rem, 3vw, 2rem)",
          fontWeight: 800, color: "#0f172a",
          fontFamily: "Space Grotesk, sans-serif",
          marginBottom: 12,
        }}>
          Ready to participate?
        </h2>
        <p style={{ color: "#556178", marginBottom: 28, fontSize: 15 }}>
          Register in under 2 minutes. Your identity is protected by AI.
        </p>
        <Link to="/auth" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "linear-gradient(135deg, #0f766e, #0ea5a5)",
          color: "#fff", padding: "16px 36px", borderRadius: 16,
          fontWeight: 700, fontSize: 16, textDecoration: "none",
          boxShadow: "0 8px 24px rgba(15,118,110,0.3)",
        }}>
          Get started <ArrowRight size={16} />
        </Link>
      </section>

      {/* ── Keyframes ────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

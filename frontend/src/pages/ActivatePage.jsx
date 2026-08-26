import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, UserPlus, IdCard, KeyRound, Lock, CheckCircle2, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import API from "../api";
import { useLang } from "../context/LangContext";

export default function ActivatePage() {
  const navigate = useNavigate();
  const { t } = useLang();
  
  // Steps: 1 = CNIC check, 2 = OTP verify, 3 = Set password, 4 = Success screen
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [cnic, setCnic] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [serverOtp, setServerOtp] = useState("");
  const [voterInfo, setVoterInfo] = useState(null);

  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  const formatCnicInput = (value) => {
    const numbersOnly = value.replace(/\D/g, "");
    let formatted = numbersOnly;
    if (numbersOnly.length > 5 && numbersOnly.length <= 12) {
      formatted = numbersOnly.slice(0, 5) + "-" + numbersOnly.slice(5);
    } else if (numbersOnly.length > 12) {
      formatted =
        numbersOnly.slice(0, 5) +
        "-" +
        numbersOnly.slice(5, 12) +
        "-" +
        numbersOnly.slice(12, 13);
    }
    return formatted.slice(0, 15);
  };

  const handleCnicChange = (e) => {
    setCnic(formatCnicInput(e.target.value));
  };

  // Step 1: Check CNIC eligibility
  const checkCnicEligibility = async (e) => {
    if (e) e.preventDefault();
    const cleanCnic = cnic.replace(/-/g, "").replace(/\s/g, "");
    if (cleanCnic.length !== 13) {
      toast.error("CNIC must be exactly 13 digits.");
      return;
    }

    setLoading(true);
    try {
      const response = await API.post("/auth/check-cnic", { cnic: cleanCnic });
      if (response.data.eligible) {
        setMaskedEmail(response.data.email);
        setVoterInfo({
          full_name: response.data.full_name || "Verified Voter",
          constituency: response.data.constituency || "Default District"
        });
        
        if (response.data.otp) {
          setServerOtp(response.data.otp);
          setOtp(response.data.otp);
        }
        
        // Trigger first OTP send
        const sendRes = await API.post("/auth/send-otp", { cnic: cleanCnic });
        if (sendRes.data.otp) {
          setServerOtp(sendRes.data.otp);
          setOtp(sendRes.data.otp);
        }
        setResendTimer(30);
        toast.success("Verification code ready!");
        setStep(2);
      } else {
        if (response.data.status === "already_activated") {
          toast.success(response.data.message || "Account is already activated.");
          navigate("/auth", { state: { mode: "login" } });
        } else {
          toast.error("Voter check failed.");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Voter record not found or not eligible.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Trigger OTP Resend
  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    const cleanCnic = cnic.replace(/-/g, "").replace(/\s/g, "");
    
    setLoading(true);
    try {
      const res = await API.post("/auth/send-otp", { cnic: cleanCnic });
      if (res.data.otp) {
        setServerOtp(res.data.otp);
        setOtp(res.data.otp);
      }
      setResendTimer(45);
      toast.success("Verification code refreshed!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const verifyOtpCode = async (e) => {
    e.preventDefault();
    if (otp.length < 6) {
      toast.error("Please enter a valid 6-digit code.");
      return;
    }

    const cleanCnic = cnic.replace(/-/g, "").replace(/\s/g, "");

    setLoading(true);
    try {
      const response = await API.post("/auth/verify-otp", {
        cnic: cleanCnic,
        otp: otp.trim(),
      });
      if (response.data.success && response.data.token) {
        setSessionToken(response.data.token);
        toast.success("Identity verified successfully!");
        setStep(3);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Complete Activation / Set password
  const activateAccount = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    const cleanCnic = cnic.replace(/-/g, "").replace(/\s/g, "");

    setLoading(true);
    try {
      const response = await API.post("/auth/activate-account", {
        cnic: cleanCnic,
        token: sessionToken,
        password: password,
      });
      if (response.data.success) {
        toast.success("Account activated successfully!");
        setStep(4);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Activation failed. Session may have expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ minHeight: "80vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div className="page-header" style={{ textAlign: "center", marginBottom: 24 }}>
        <div className="eyebrow" style={{ justifyContent: "center" }}>
          <ShieldCheck size={16} />
          Secure Account Activation
        </div>
        <h1 className="section-title" style={{ marginTop: 8 }}>Activate Your Voter Account</h1>
        <p className="section-subtitle">
          Verify your credentials issued by NADRA to activate your digital ballot access.
        </p>
      </div>

      <div style={{ maxWidth: 460, width: "100%", margin: "0 auto" }}>
        
        {/* Step Indicator */}
        {step < 4 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, padding: "0 10px" }}>
            {[1, 2, 3].map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    background: step === s ? "#4f46e5" : step > s ? "#10b981" : "rgba(15, 23, 42, 0.05)",
                    color: step >= s ? "white" : "var(--muted)",
                    transition: "all 0.3s ease",
                  }}
                >
                  {step > s ? "✓" : s}
                </div>
                <span style={{ fontSize: 13, fontWeight: step === s ? 600 : 500, color: step === s ? "var(--foreground)" : "var(--muted)" }}>
                  {s === 1 ? "CNIC" : s === 2 ? "OTP" : "Password"}
                </span>
                {s < 3 && <div style={{ width: 30, height: 2, background: step > s ? "#10b981" : "rgba(15, 23, 42, 0.05)" }} />}
              </div>
            ))}
          </div>
        )}

        {/* Step 1: CNIC Check Form */}
        {step === 1 && (
          <div className="card form-card" style={{ boxShadow: "0 20px 40px rgba(15,23,42,0.08)" }}>
            <form onSubmit={checkCnicEligibility} className="form-grid">
              <div className="form-group">
                <label className="form-label">CNIC Number</label>
                <div className="input-wrap">
                  <IdCard size={16} />
                  <input
                    type="text"
                    className="input"
                    placeholder="00000-0000000-0"
                    value={cnic}
                    onChange={handleCnicChange}
                    required
                  />
                </div>
                <p className="form-helper" style={{ fontSize: 12, marginTop: 4 }}>
                  Enter your 13-digit National Identity Card number.
                </p>
              </div>

              {/* Sample CNIC quick fill chips for demo/testing */}
              <div style={{ background: "rgba(15,23,42,0.03)", padding: "10px 12px", borderRadius: 10, border: "1px dashed rgba(15,23,42,0.1)" }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                  Quick Test / Sample Imported CNICs:
                </span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["17301-100000-1", "17201-100000-2", "36302-100000-3"].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => {
                        setCnic(formatCnicInput(sample));
                      }}
                      style={{
                        background: "white",
                        border: "1px solid rgba(15,23,42,0.12)",
                        borderRadius: 6,
                        padding: "3px 8px",
                        fontSize: 11.5,
                        fontFamily: "monospace",
                        cursor: "pointer",
                        color: "#0f766e",
                        fontWeight: 600
                      }}
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              <button className={`button primary ${loading ? "is-loading" : ""}`} type="submit" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
                {loading ? "Checking record..." : "Verify Identity"}
                <ArrowRight size={16} style={{ marginLeft: 8 }} />
              </button>
            </form>
          </div>
        )}

        {/* Step 2: OTP Verification Form */}
        {step === 2 && (
          <div className="card form-card" style={{ boxShadow: "0 20px 40px rgba(15,23,42,0.08)" }}>
            <form onSubmit={verifyOtpCode} className="form-grid">
              {voterInfo && (
                <div style={{
                  background: "linear-gradient(135deg, rgba(79,70,229,0.08), rgba(79,70,229,0.03))",
                  border: "1px solid rgba(79,70,229,0.2)",
                  borderRadius: 12,
                  padding: "12px 16px",
                  marginBottom: 16,
                  textAlign: "left"
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#4f46e5", letterSpacing: "0.06em" }}>
                    ✓ NADRA Identity Verified
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
                    {voterInfo.full_name}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                    Constituency: <strong style={{ color: "#0f172a" }}>{voterInfo.constituency}</strong>
                  </div>
                </div>
              )}

              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)" }}>
                  Verification code dispatched to profile:
                </p>
                <strong style={{ display: "block", marginTop: 2, fontSize: 14, color: "#4f46e5" }}>
                  {maskedEmail}
                </strong>
              </div>

              {serverOtp && (
                <div style={{
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px dashed rgba(16, 185, 129, 0.4)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 13
                }}>
                  <div>
                    <span style={{ color: "#065f46", fontWeight: 600 }}>Demo / Test OTP: </span>
                    <strong style={{ fontFamily: "monospace", fontSize: 15, color: "#047857", letterSpacing: 2 }}>{serverOtp}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtp(serverOtp)}
                    style={{
                      background: "#047857",
                      color: "white",
                      border: "none",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Auto-Fill
                  </button>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Verification OTP</label>
                <div className="input-wrap">
                  <KeyRound size={16} />
                  <input
                    type="text"
                    className="input"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                  />
                </div>
              </div>

              <button className={`button primary ${loading ? "is-loading" : ""}`} type="submit" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
                {loading ? "Verifying..." : "Verify OTP"}
              </button>

              <div style={{ textAlign: "center", marginTop: 16 }}>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading || resendTimer > 0}
                  style={{
                    background: "none",
                    border: "none",
                    color: resendTimer > 0 ? "var(--muted)" : "#4f46e5",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: resendTimer > 0 ? "default" : "pointer",
                  }}
                >
                  {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend Verification Code"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Set Password Form */}
        {step === 3 && (
          <div className="card form-card" style={{ boxShadow: "0 20px 40px rgba(15,23,42,0.08)" }}>
            <form onSubmit={activateAccount} className="form-grid">
              <div className="form-group">
                <label className="form-label">Create Password</label>
                <div className="input-wrap">
                  <Lock size={16} />
                  <input
                    type="password"
                    className="input"
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div className="input-wrap">
                  <Lock size={16} />
                  <input
                    type="password"
                    className="input"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password checks */}
              <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4, padding: "8px 12px", background: "rgba(15,23,42,0.03)", borderRadius: 8 }}>
                <span style={{ color: password.length >= 8 ? "#10b981" : "var(--muted)", fontWeight: 500 }}>
                  {password.length >= 8 ? "✓" : "○"} Minimum 8 characters
                </span>
                <span style={{ color: password && password === confirmPassword ? "#10b981" : "var(--muted)", fontWeight: 500 }}>
                  {password && password === confirmPassword ? "✓" : "○"} Passwords match
                </span>
              </div>

              <button className={`button primary ${loading ? "is-loading" : ""}`} type="submit" disabled={loading || password.length < 8 || password !== confirmPassword} style={{ width: "100%", marginTop: 8 }}>
                {loading ? "Activating account..." : "Complete Activation"}
              </button>
            </form>
          </div>
        )}

        {/* Step 4: Success Screen */}
        {step === 4 && (
          <div className="card form-card" style={{ textAlign: "center", padding: "40px 24px", boxShadow: "0 20px 40px rgba(15,23,42,0.08)" }}>
            <div style={{ display: "inline-flex", padding: 12, borderRadius: "50%", background: "rgba(16,185,129,0.1)", color: "#10b981", marginBottom: 16 }}>
              <CheckCircle2 size={40} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>Activation Complete!</h2>
            <p style={{ margin: "12px 0 24px", fontSize: 14, color: "var(--muted)", lineHeight: 1.5 }}>
              Your voter account is now active. You can log in using your CNIC or registered email address to access the secure voting booth.
            </p>
            <button className="button primary" onClick={() => navigate("/auth", { state: { mode: "login" } })} style={{ width: "100%" }}>
              Proceed to Login
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

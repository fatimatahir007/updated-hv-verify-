import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  UserPlus,
  LogIn,
  User,
  Mail,
  KeyRound,
  MapPin,
  IdCard,
  ArrowLeft,
} from "lucide-react";
import toast from "react-hot-toast";

import API from "../api";

function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [loginCnic, setLoginCnic] = useState("");
  const [loginOtp, setLoginOtp] = useState("");
  const [server2FAOtp, setServer2FAOtp] = useState("");

  /*
    Registration mein email aur CNIC dono required hain.
  */
  const [registerForm, setRegisterForm] = useState({
    full_name: "",
    email: "",
    cnic: "",
    district: "",
    password: "",
    confirm_password: "",
  });

  /*
    Login email ya CNIC dono mein se kisi ek se ho sakta hai.
  */
  const [loginForm, setLoginForm] = useState({
    identifier: "",
    password: "",
  });

  /*
    Forgot password mein sirf registered email use hogi.
  */
  const [forgotForm, setForgotForm] = useState({
    email: "",
  });

  useEffect(() => {
    // If user explicitly visits the auth page, we clear the previous voter token
    // so they can register or login a new voter.
    localStorage.removeItem("voterToken");
    setMode("login");
    setShow2FA(false);

    if (location.state?.mode === "login") {
      setMode("login");
    }
  }, [location.state, navigate]);

  const normalizeCnic = (value) => {
    return value.replace(/\D/g, "").slice(0, 13);
  };

  const normalizeText = (value) => {
    return value.replace(/[^a-zA-Z\s'-]/g, "");
  };

  const isValidEmail = (value) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const isValidCnic = (value) => {
    return /^\d{13}$/.test(value);
  };

 const normalizeLoginIdentifier = (value) => {
  const trimmedValue = value.trim();

  // CNIC ke dashes aur spaces remove karein
  const possibleCnic = trimmedValue
    .replace(/-/g, "")
    .replace(/\s/g, "");

  // Agar input sirf numbers hai to CNIC ki tarah return karein
  if (/^\d+$/.test(possibleCnic)) {
    return possibleCnic.slice(0, 13);
  }

  // Warna email ko lowercase mein return karein
  return trimmedValue.toLowerCase();
};

  const getErrorMessage = (error, fallbackMessage) => {
    const detail = error.response?.data?.detail;

    if (Array.isArray(detail)) {
      return detail[0]?.msg || fallbackMessage;
    }

    if (typeof detail === "string") {
      return detail;
    }

    return fallbackMessage;
  };

  const handleRegisterChange = (event) => {
    const { name, value } = event.target;

    let updatedValue = value;

    if (name === "cnic") {
      updatedValue = normalizeCnic(value);
    }

    if (name === "email") {
      updatedValue = value.trimStart().toLowerCase();
    }

    if (name === "full_name" || name === "district") {
      updatedValue = normalizeText(value);
    }

    setRegisterForm((previousForm) => ({
      ...previousForm,
      [name]: updatedValue,
    }));
  };

const handleLoginChange = (event) => {
  const { name, value } = event.target;

  let updatedValue = value;

  if (name === "identifier") {
    // Agar user numbers type kar raha hai to CNIC treat karo
    const possibleCnic = value
      .replace(/-/g, "")
      .replace(/\s/g, "");

    if (/^\d*$/.test(possibleCnic)) {
      updatedValue = possibleCnic.slice(0, 13);
    } else {
      // Warna email ko lowercase mein rakho
      updatedValue = value.trimStart().toLowerCase();
    }
  }

  setLoginForm((previousForm) => ({
    ...previousForm,
    [name]: updatedValue,
  }));
};

  const handleForgotChange = (event) => {
    const { name, value } = event.target;

    setForgotForm((previousForm) => ({
      ...previousForm,
      [name]: value.trimStart().toLowerCase(),
    }));
  };

  const handleRegister = async (event) => {
    event.preventDefault();

    const fullName = registerForm.full_name.trim();
    const email = registerForm.email.trim().toLowerCase();
    const cnic = normalizeCnic(registerForm.cnic);
    const district = registerForm.district.trim();
    const password = registerForm.password;
    const confirmPassword = registerForm.confirm_password;

    if (fullName.length < 3) {
      toast.error("Please enter your complete name");
      return;
    }

    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!isValidCnic(cnic)) {
      toast.error("CNIC must contain exactly 13 digits");
      return;
    }

    if (district.length < 2) {
      toast.error("Please enter a valid district");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must contain at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Password and confirm password do not match");
      return;
    }

    /*
      confirm_password backend ko send nahi hoga.
      Existing email aur CNIC duplicate checks safe rahenge.
    */
    const registrationPayload = {
      full_name: fullName,
      email,
      cnic,
      district,
      password,
    };

    try {
      setLoading(true);

      const response = await API.post(
        "/auth/register",
        registrationPayload
      );

      toast.success(
        response.data?.message ||
          "Voter account created successfully"
      );

      setLoginForm({
        identifier: email,
        password: "",
      });

      setRegisterForm({
        full_name: "",
        email: "",
        cnic: "",
        district: "",
        password: "",
        confirm_password: "",
      });

      setMode("login");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Registration failed")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    const identifier = normalizeLoginIdentifier(
      loginForm.identifier
    );

    const password = loginForm.password;

    if (!identifier) {
      toast.error("Please enter your email or CNIC");
      return;
    }

    const identifierIsEmail = isValidEmail(identifier);
    const identifierIsCnic = isValidCnic(identifier);

    if (!identifierIsEmail && !identifierIsCnic) {
      toast.error(
        "Enter a valid email address or exactly 13 CNIC digits"
      );
      return;
    }

    if (!password) {
      toast.error("Please enter your password");
      return;
    }

    try {
      setLoading(true);

      const response = await API.post("/auth/login", {
        identifier,
        password,
      });

      if (response.data?.status === "pending_2fa") {
        setLoginCnic(response.data.cnic);
        if (response.data.otp) {
          setServer2FAOtp(response.data.otp);
          setLoginOtp(response.data.otp);
        }
        setShow2FA(true);
        toast.success(response.data.message || "2FA verification code ready.");
        return;
      }

      if (!response.data?.access_token) {
        toast.error("Login token was not received");
        return;
      }

      localStorage.setItem(
        "voterToken",
        response.data.access_token
      );

      toast.success(
        response.data?.message || "Login successful"
      );

      navigate("/vote");
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Invalid email, CNIC, or password"
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogin2FA = async (event) => {
    event.preventDefault();
    if (loginOtp.length < 6) {
      toast.error("Please enter a valid 6-digit OTP code.");
      return;
    }

    try {
      setLoading(true);
      const response = await API.post("/auth/login-verify-otp", {
        cnic: loginCnic,
        otp: loginOtp.trim(),
      });

      if (!response.data?.access_token) {
        toast.error("Login token was not received");
        return;
      }

      localStorage.setItem(
        "voterToken",
        response.data.access_token
      );

      toast.success(
        response.data?.message || "Login successful"
      );

      navigate("/vote");
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Invalid or expired OTP code"
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();

    const email = forgotForm.email.trim().toLowerCase();

    if (!email) {
      toast.error("Please enter your registered email");
      return;
    }

    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setLoading(true);

      /*
        Forgot password mein sirf email backend ko bheji jayegi.
      */
      await API.post("/auth/forgot-password", {
        email,
      });

      /*
        Security ke liye account exist aur non-exist
        dono cases mein same message show hona chahiye.
      */
      toast.success(
        "If this email is registered, password reset instructions have been sent"
      );

      setForgotForm({
        email: "",
      });

      setMode("login");
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error(
          "Forgot password backend endpoint is not available yet"
        );
      } else {
        toast.error(
          getErrorMessage(
            error,
            "Unable to process password reset request"
          )
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="eyebrow">
          <ShieldCheck size={16} />
          Voter account
        </div>

        <h1 className="section-title">
          {mode === "login" && "Voter login"}
          {mode === "forgot" && "Reset your password"}
        </h1>
      </div>

      <div
        className="card form-card"
        style={{ marginBottom: 16 }}
      >
        {mode !== "forgot" && !show2FA && (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <button
              className={`button${
                mode === "login" ? "" : " secondary"
              }`}
              type="button"
              disabled={loading}
              onClick={() => setMode("login")}
            >
              <LogIn size={14} />
              Login
            </button>

            <button
              className="button secondary"
              type="button"
              disabled={loading}
              onClick={() => navigate("/activate")}
              style={{ background: "rgba(16, 185, 129, 0.08)", color: "#065f46", borderColor: "rgba(16, 185, 129, 0.3)" }}
            >
              <ShieldCheck size={14} />
              Activate Account
            </button>
          </div>
        )}

        {!show2FA && mode === "login" && (
          <div>
            <form
              className="form-grid"
              onSubmit={handleLogin}
            >
              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="login-identifier"
                >
                  Email or CNIC
                </label>

                <div className="input-wrap">
                  <IdCard size={16} />

                  <input
                    id="login-identifier"
                    className="input"
                    type="text"
                    name="identifier"
                    placeholder="Enter registered email or CNIC"
                    value={loginForm.identifier}
                    onChange={handleLoginChange}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="login-password"
                >
                  Password
                </label>

                <div className="input-wrap">
                  <KeyRound size={16} />

                  <input
                    id="login-password"
                    className="input"
                    type="password"
                    name="password"
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={handleLoginChange}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    const enteredIdentifier =
                      loginForm.identifier.trim();

                    setForgotForm({
                      email: enteredIdentifier.includes("@")
                        ? enteredIdentifier.toLowerCase()
                        : "",
                    });

                    setMode("forgot");
                  }}
                  style={{
                    marginTop: 10,
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    font: "inherit",
                    textDecoration: "underline",
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <div className="form-actions">
                <button
                  className={`button${
                    loading ? " is-loading" : ""
                  }`}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Login"}
                </button>
              </div>
            </form>
          </div>
        )}

        {show2FA && (
          <form className="form-grid" onSubmit={handleLogin2FA}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                Enter the 6-digit verification code (OTP) for voter login.
              </p>
            </div>

            {server2FAOtp && (
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
                  <span style={{ color: "#065f46", fontWeight: 600 }}>Demo / Test 2FA Code: </span>
                  <strong style={{ fontFamily: "monospace", fontSize: 15, color: "#047857", letterSpacing: 2 }}>{server2FAOtp}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setLoginOtp(server2FAOtp)}
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
                  className="input"
                  type="text"
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  value={loginOtp}
                  onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                />
              </div>
            </div>

            <div className="form-actions" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                className={`button${loading ? " is-loading" : ""}`}
                type="submit"
                disabled={loading}
                style={{ flex: 1 }}
              >
                {loading ? "Verifying..." : "Verify & Login"}
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={loading}
                onClick={() => setShow2FA(false)}
                style={{ flex: 1 }}
              >
                Back to Login
              </button>
            </div>
          </form>
        )}

        {mode === "forgot" && (
          <form
            className="form-grid"
            onSubmit={handleForgotPassword}
          >
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="forgot-email"
              >
                Registered email
              </label>

              <div className="input-wrap">
                <Mail size={16} />

                <input
                  id="forgot-email"
                  className="input"
                  type="email"
                  name="email"
                  placeholder="Enter your registered email"
                  value={forgotForm.email}
                  onChange={handleForgotChange}
                  autoComplete="email"
                  required
                />
              </div>

              <span className="form-hint">
                Password reset instructions will be sent to your
                registered email address.
              </span>
            </div>

            <div className="form-actions">
              <button
                className={`button${
                  loading ? " is-loading" : ""
                }`}
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Sending..."
                  : "Send reset instructions"}
              </button>

              <button
                className="button secondary"
                type="button"
                disabled={loading}
                onClick={() => setMode("login")}
              >
                <ArrowLeft size={14} />
                Back to login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default AuthPage;
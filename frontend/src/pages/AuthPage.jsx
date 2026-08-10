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

  const [mode, setMode] = useState("register");
  const [loading, setLoading] = useState(false);

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

      navigate("/register");
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
          {mode === "register" && "Create voter account"}
          {mode === "login" && "Voter login"}
          {mode === "forgot" && "Reset your password"}
        </h1>

        <p className="section-subtitle">
          {mode === "register" &&
            "Create your account using your email, CNIC and secure password."}

          {mode === "login" &&
            "Sign in using your registered email or CNIC."}

          {mode === "forgot" &&
            "Enter your registered email to receive password reset instructions."}
        </p>
      </div>

      <div
        className="card form-card"
        style={{ marginBottom: 16 }}
      >
        {mode !== "forgot" && (
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
                mode === "register" ? "" : " secondary"
              }`}
              type="button"
              disabled={loading}
              onClick={() => setMode("register")}
            >
              <UserPlus size={14} />
              Register
            </button>

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
          </div>
        )}

        {mode === "register" && (
          <form
            className="form-grid"
            onSubmit={handleRegister}
          >
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="register-full-name"
              >
                Full name
              </label>

              <div className="input-wrap">
                <User size={16} />

                <input
                  id="register-full-name"
                  className="input"
                  type="text"
                  name="full_name"
                  placeholder="Enter your full name"
                  value={registerForm.full_name}
                  onChange={handleRegisterChange}
                  autoComplete="name"
                  minLength={3}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label
                className="form-label"
                htmlFor="register-email"
              >
                Email
              </label>

              <div className="input-wrap">
                <Mail size={16} />

                <input
                  id="register-email"
                  className="input"
                  type="email"
                  name="email"
                  placeholder="example@email.com"
                  value={registerForm.email}
                  onChange={handleRegisterChange}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label
                className="form-label"
                htmlFor="register-cnic"
              >
                CNIC
              </label>

              <div className="input-wrap">
                <IdCard size={16} />

                <input
                  id="register-cnic"
                  className="input"
                  type="text"
                  name="cnic"
                  placeholder="Enter 13-digit CNIC"
                  value={registerForm.cnic}
                  onChange={handleRegisterChange}
                  inputMode="numeric"
                  autoComplete="off"
                  minLength={13}
                  maxLength={13}
                  pattern="[0-9]{13}"
                  title="Enter exactly 13 CNIC digits"
                  required
                />
              </div>

              <span className="form-hint">
                Enter CNIC without dashes.
              </span>
            </div>

            <div className="form-group">
              <label
                className="form-label"
                htmlFor="register-district"
              >
                District
              </label>

              <div className="input-wrap">
                <MapPin size={16} />

                <input
                  id="register-district"
                  className="input"
                  type="text"
                  name="district"
                  placeholder="Enter your district"
                  value={registerForm.district}
                  onChange={handleRegisterChange}
                  autoComplete="address-level2"
                  minLength={2}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label
                className="form-label"
                htmlFor="register-password"
              >
                Password
              </label>

              <div className="input-wrap">
                <KeyRound size={16} />

                <input
                  id="register-password"
                  className="input"
                  type="password"
                  name="password"
                  placeholder="Minimum 8 characters"
                  value={registerForm.password}
                  onChange={handleRegisterChange}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label
                className="form-label"
                htmlFor="register-confirm-password"
              >
                Confirm password
              </label>

              <div className="input-wrap">
                <KeyRound size={16} />

                <input
                  id="register-confirm-password"
                  className="input"
                  type="password"
                  name="confirm_password"
                  placeholder="Enter password again"
                  value={registerForm.confirm_password}
                  onChange={handleRegisterChange}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
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
                  ? "Registering..."
                  : "Create voter account"}
              </button>

              <span className="form-hint">
                Each email and CNIC can only be registered once.
              </span>
            </div>
          </form>
        )}

        {mode === "login" && (
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

              <span className="form-hint">
                Use your registered email address or 13-digit CNIC.
              </span>
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
                  /*
                    Agar login field mein email likhi hui hai,
                    to forgot form mein automatically fill ho jayegi.

                    Agar CNIC likhi hai to forgot email blank rahegi.
                  */
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
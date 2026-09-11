import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck, KeyRound, User } from "lucide-react";
import toast from "react-hot-toast";

import API from "../api";

function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("Admin");
  const [password, setPassword] = useState("Admin");
  const [loading, setLoading] = useState(false);

  const handleQuickLogin = async (usr = "Admin", pwd = "Admin") => {
    try {
      setLoading(true);
      const response = await API.post("/admin/login", {
        username: usr,
        email: usr,
        password: pwd
      });

      localStorage.setItem("adminToken", response.data.access_token);
      const destination = location.state?.from || "/admin";
      navigate(destination, { replace: true });
      toast.success("Admin NADRA access granted");
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.detail || "Admin login failed");
    } finally {
      setLoading(false);
    }
  };

const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);

      const response = await API.post("/admin/login", {
        username: email,
        email: email,
        password
      });

      localStorage.setItem("adminToken", response.data.access_token);

      const decoded = decodeToken(response.data.access_token);
      const roleName = decoded?.role_name || "viewer";
      
      let baseRoute = "/admin";
      if (roleName === "district_admin") baseRoute = "/district-admin";
      else if (roleName === "polling_station_officer") baseRoute = "/polling";
      else if (roleName === "auditor") baseRoute = "/auditor";
      else if (roleName === "observer") baseRoute = "/observer";
      else if (roleName === "technical_support") baseRoute = "/support";
      else if (roleName === "voter") baseRoute = "/voter";
      else if (roleName === "nadra_officer") baseRoute = "/admin";

      const destination = location.state?.from || baseRoute;
      navigate(destination, { replace: true });

      toast.success("Admin access granted");

    } catch (error) {
      console.log(error);
      toast.error(
        error.response?.data?.detail || "Admin login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ padding: "40px 20px", minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div className="page-header" style={{ textAlign: "center", marginBottom: 24 }}>
        <div className="eyebrow">
          <ShieldCheck size={16} />
          Admin access
        </div>
        <h1 className="section-title">
          Admin login
        </h1>
        <p className="section-subtitle">
          Secure access for election supervisors only.
        </p>
      </div>

      <div className="card form-card">
        <div style={{
          background: "linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(67, 56, 202, 0.05))",
          border: "1px solid rgba(79, 70, 229, 0.3)",
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "0.85rem"
        }}>
          <div>
            <span style={{ color: "#818cf8", fontWeight: 700 }}>Default Admin Credentials: </span>
            <code style={{ fontFamily: "monospace", color: "#38bdf8", fontWeight: 800 }}>Admin / Admin</code>
          </div>
          <button
            type="button"
            onClick={() => handleQuickLogin("Admin", "Admin")}
            style={{
              background: "linear-gradient(135deg, #4f46e5, #4338ca)",
              color: "white",
              border: "none",
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.4)"
            }}
          >
            ⚡ Instant Admin Login
          </button>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username or Email Address</label>
            <div className="input-wrap">
              <User size={16} />
              <input
                type="text"
                className="input"
                placeholder="Admin username or email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrap">
              <KeyRound size={16} />
              <input
                type="password"
                className="input"
                placeholder="Admin password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              className={`button${loading ? " is-loading" : ""}`}
              type="submit"
            >
              {loading ? "Signing in..." : "Access admin dashboard"}
            </button>
            <span className="form-hint">
              Admin access is restricted to authorized supervisors.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;

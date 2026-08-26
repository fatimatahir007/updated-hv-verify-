import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck, KeyRound, User } from "lucide-react";
import toast from "react-hot-toast";

import API from "../api";

function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
          background: "rgba(79, 70, 229, 0.06)",
          border: "1px dashed rgba(79, 70, 229, 0.25)",
          borderRadius: 10,
          padding: "10px 14px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 12.5
        }}>
          <div>
            <span style={{ color: "#4338ca", fontWeight: 600 }}>Default Credentials: </span>
            <code style={{ fontFamily: "monospace", color: "#312e81", fontWeight: 700 }}>Admin / Admin</code>
          </div>
          <button
            type="button"
            onClick={() => {
              setEmail("Admin");
              setPassword("Admin");
            }}
            style={{
              background: "#4f46e5",
              color: "white",
              border: "none",
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Auto-Fill
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

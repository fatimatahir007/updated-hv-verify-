import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Home,
  Vote,
  BadgeCheck,
  BarChart3,
  Settings,
  IdCard
} from "lucide-react";
import { useLang } from "../context/LangContext";

function Navbar() {
  const isAdmin = Boolean(localStorage.getItem("adminToken"));
  const { t } = useLang();

  return (
    <nav className="navbar">
      <div className="nav-inner">
        <Link to="/" className="brand">
          <span className="brand-icon">
            <ShieldCheck size={18} />
          </span>
          <span className="brand-text">HVS-STE</span>
        </Link>

        <div className="nav-links">
          <Link className="nav-link" to="/">
            <Home size={16} />
            {t.home}
          </Link>

          <Link className="nav-link" to="/vote">
            <Vote size={16} />
            {t.vote}
          </Link>

          <Link className="nav-link" to="/verify">
            <BadgeCheck size={16} />
            {t.verify}
          </Link>

          <Link className="nav-link" to="/results">
            <BarChart3 size={16} />
            {t.results}
          </Link>

          {isAdmin ? (
            <Link className="nav-link" to="/admin">
              <Settings size={16} />
              {t.admin}
            </Link>
          ) : (
            <Link className="nav-link" to="/admin-login">
              <Settings size={16} />
              {t.adminLogin}
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
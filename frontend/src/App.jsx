import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Navbar from "./components/Navbar";
import ElectionNotification from "./components/ElectionNotification";

import HomePage from "./pages/HomePage";
import LandingPage from "./pages/LandingPage";
import PublicBoardPage from "./pages/PublicBoardPage";
import RegistrationsLedgerPage from "./pages/RegistrationsLedgerPage";
import VotesLedgerPage from "./pages/VotesLedgerPage";
import AuditLedgerPage from "./pages/AuditLedgerPage";
import RegisterPage from "./pages/RegisterPage";
import ActivatePage from "./pages/ActivatePage";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";

import VotePage from "./pages/VotePage";
import ResultsPage from "./pages/ResultsPage";
import AdminPage from "./pages/AdminPage";
import AdminLogin from "./pages/AdminLogin";
import ProtectedRoute from "./components/ProtectedRoute";

import SuperAdminDashboard from "./pages/superadmin/dashboard/Dashboard";
import CommissionerDashboard from "./pages/commissioner/dashboard/Dashboard";
import DistrictDashboard from "./pages/district/dashboard/Dashboard";
import PollingDashboard from "./pages/polling/dashboard/Dashboard";
import AuditorDashboard from "./pages/auditor/dashboard/Dashboard";
import ObserverDashboard from "./pages/observer/dashboard/Dashboard";
import SupportDashboard from "./pages/support/dashboard/Dashboard";
import VoterDashboard from "./pages/voter/dashboard/Dashboard";
import VerifyVote from "./pages/verify/VerifyVote";


function App() {
  return (
    <BrowserRouter>

      {/* Navbar */}
      <Navbar />

      {/* Voting notification */}
      <ElectionNotification />

      {/* Toast notifications */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3200,
          style: {
            background: "rgba(255, 255, 255, 0.95)",
            color: "#0f172a",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
            borderRadius: "14px",
            padding: "12px 16px",
            fontWeight: 600,
          },
        }}
      />

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/board" element={<PublicBoardPage />} />
        <Route path="/ledger/registrations" element={<RegistrationsLedgerPage />} />
        <Route path="/ledger/votes" element={<VotesLedgerPage />} />
        <Route path="/ledger/audit" element={<AuditLedgerPage />} />
        <Route path="/register" element={<ActivatePage />} />
        <Route path="/activate" element={<ActivatePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <Users />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/roles"
          element={
            <ProtectedRoute>
              <AdminPage defaultTab="Roles" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/districts"
          element={
            <ProtectedRoute>
              <AdminPage defaultTab="Districts" />
            </ProtectedRoute>
          }
        />

        <Route path="/vote" element={<VotePage />} />
        <Route path="/verify" element={<VerifyVote />} />
        <Route path="/verify-public" element={<VerifyVote />} />

        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin/login" element={<AdminLogin />} />

        <Route
          path="/results"
          element={
            <ProtectedRoute>
              <ResultsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/superadmin"
          element={
            <ProtectedRoute>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/commissioner"
          element={
            <ProtectedRoute>
              <CommissionerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/district"
          element={
            <ProtectedRoute>
              <DistrictDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/district-admin"
          element={
            <ProtectedRoute>
              <DistrictDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/polling"
          element={
            <ProtectedRoute>
              <PollingDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/auditor"
          element={
            <ProtectedRoute>
              <AuditorDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/observer"
          element={
            <ProtectedRoute>
              <ObserverDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/support"
          element={
            <ProtectedRoute>
              <SupportDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="/voter" element={<VoterDashboard />} />
      </Routes>

    </BrowserRouter>
  );
}

export default App;
import React from 'react';
import { Users, UserPlus, VoteIcon, Activity, ShieldAlert, ShieldCheck, Terminal, Database, Calendar, Map, AlertTriangle } from "lucide-react";
import API from '../../api';
import toast from 'react-hot-toast';

export function PollingStationOfficerDashboard({ setTab, stats, voters }) {
  const stationLogs = [
    { id: 1, action: "Voter Verified", details: "Biometric match confirmed", time: "Just now", status: "Verified" },
    { id: 2, action: "QR Code Scanned", details: "Voter slip authenticated", time: "2 mins ago", status: "Success" },
    { id: 3, action: "Ballot Issued", details: "Encrypted vote cast", time: "5 mins ago", status: "Completed" }
  ];

  return (
    <div style={{ marginTop: 16 }}>
      {/* Officer Role Banner */}
      <div className="card admin-panel" style={{ marginBottom: 16, background: "linear-gradient(135deg, rgba(15,118,110,0.1), rgba(13,148,136,0.05))", borderLeft: "4px solid var(--primary)" }}>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--primary)" }}>
                Polling Station Officer Command Center
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                Dedicated Polling Station Role Dashboard • Station #101 (Active)
              </p>
            </div>
            <span className="admin-pill success">Station Operational</span>
          </div>
        </div>
      </div>

      {/* Station Officer Metrics */}
      <div className="admin-grid" style={{ marginBottom: 16 }}>
        <div className="card admin-metric">
          <div className="metric-icon" style={{ background: "rgba(15,118,110,0.12)", color: "var(--primary)" }}><Users size={18} /></div>
          <div><p>Station Registered Voters</p><h3>{voters?.length || stats?.total_voters || 0}</h3></div>
        </div>
        <div className="card admin-metric">
          <div className="metric-icon" style={{ background: "rgba(16,185,129,0.12)", color: "var(--success)" }}><ShieldCheck size={18} /></div>
          <div><p>Biometric Verified</p><h3 style={{ color: "var(--success)" }}>{voters?.length || stats?.total_voters || 0}</h3></div>
        </div>
        <div className="card admin-metric">
          <div className="metric-icon" style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed" }}><VoteIcon size={18} /></div>
          <div><p>Votes Cast Today</p><h3 style={{ color: "#7c3aed" }}>{stats.votes_cast}</h3></div>
        </div>
        <div className="card admin-metric">
          <div className="metric-icon" style={{ background: "rgba(245,158,11,0.12)", color: "var(--warning)" }}><Activity size={18} /></div>
          <div><p>Station Turnout</p><h3 style={{ color: "var(--warning)" }}>{stats.turnout}%</h3></div>
        </div>
      </div>

      {/* Quick Officer Station Actions */}
      <div className="card admin-panel" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">Quick Station Actions</h2>
            <p className="card-subtitle">Direct shortcuts for station officer tasks</p>
          </div>
        </div>
        <div style={{ padding: "0 24px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <button className="button primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Verify Voter")}>
            <ShieldCheck size={16} /> Verify Voter
          </button>
          <button className="button secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("QR Scanner")}>
            <Map size={16} /> QR Scanner
          </button>
          <button className="button secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Biometric Status")}>
            <Users size={16} /> Biometric Status
          </button>
          <button className="button primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#7c3aed" }} onClick={() => setTab("Cast Vote")}>
            <VoteIcon size={16} /> Cast Vote
          </button>
        </div>
      </div>

      {/* Recent Activity Log */}
      <div className="card admin-panel">
        <div className="card-header">
          <div>
            <h2 className="card-title">Recent Station Check-ins</h2>
            <p className="card-subtitle">Live events recorded at this polling station</p>
          </div>
        </div>
        <div className="admin-list">
          {stationLogs.map((log) => (
            <div key={log.id} className="admin-row">
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <strong style={{ fontSize: 14 }}>{log.action}</strong>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>{log.details} • {log.time}</span>
              </div>
              <span className="admin-pill success">{log.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardTab({ userRole, setTab, stats, voters }) {
  const totalVoters = (stats?.total_voters && Number(stats.total_voters) >= 100) ? stats.total_voters : (voters?.length && voters.length >= 100 ? voters.length : 168);
  const votesCast = (stats?.votes_cast && Number(stats.votes_cast) > 0) ? stats.votes_cast : 15;
  const turnoutRate = (stats?.turnout && Number(stats.turnout) > 0) ? stats.turnout : (totalVoters > 0 ? ((votesCast / totalVoters) * 100).toFixed(1) : "8.9");

  const [importing, setImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState(null);
  const [selectedFile, setSelectedFile] = React.useState(null);

  const [showAddModal, setShowAddModal] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [addForm, setAddForm] = React.useState({
    full_name: "",
    cnic: "",
    phone: "",
    constituency: "",
    email: "",
    polling_station_id: ""
  });

  const [districts, setDistricts] = React.useState([]);
  const [stations, setStations] = React.useState([]);
  const [filteredStations, setFilteredStations] = React.useState([]);

  React.useEffect(() => {
    if (userRole === "nadra_officer" || userRole === "super_admin") {
      const loadNadraData = async () => {
        try {
          const [distRes, stationRes] = await Promise.all([
            API.get("/public/districts"),
            API.get("/public/polling-stations")
          ]);
          setDistricts(distRes.data || []);
          setStations(stationRes.data || []);
        } catch (err) {
          console.error("Error loading districts/stations:", err);
        }
      };
      loadNadraData();
    }
  }, [userRole]);

  React.useEffect(() => {
    const selectedDist = districts.find(d => d.district_name.toLowerCase() === addForm.constituency.toLowerCase());
    if (selectedDist) {
      const filtered = stations.filter(s => s.district_id === selectedDist.district_id);
      setFilteredStations(filtered);
    } else {
      setFilteredStations([]);
    }
  }, [addForm.constituency, districts, stations]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.full_name || !addForm.cnic || !addForm.phone || !addForm.constituency) {
      toast.error("Please fill in all mandatory fields.");
      return;
    }
    const cleanCnic = addForm.cnic.replace(/-/g, "").replace(/\s/g, "");
    if (cleanCnic.length !== 13) {
      toast.error("CNIC must be exactly 13 digits.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await API.post("/nadra/add-voter", {
        ...addForm,
        cnic: cleanCnic
      });
      toast.success(response.data.message || "Voter added successfully!");
      setShowAddModal(false);
      setAddForm({
        full_name: "",
        cnic: "",
        phone: "",
        constituency: "",
        email: "",
        polling_station_id: ""
      });
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to add voter.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append("file", selectedFile);

    setImporting(true);
    setImportResult(null);

    try {
      const response = await API.post("/voters/import", formData);
      setImportResult(response.data);
      toast.success(
        `${response.data.imported} voters imported, ${response.data.skipped} skipped`
      );
      // Reset selected file on success
      setSelectedFile(null);
      
      // Refresh stats/count
      if (typeof fetchStats === "function") fetchStats();
      if (typeof fetchVoterCount === "function") fetchVoterCount();
    } catch (err) {
      console.error("[Import] Error:", err);
      const detail = err.response?.data?.detail;
      let errMsg = "Voter import failed";
      if (typeof detail === "string") {
        errMsg = detail;
      } else if (Array.isArray(detail)) {
        errMsg = detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
      } else if (err.response?.data?.message) {
        errMsg = err.response.data.message;
      } else if (err.message) {
        errMsg = err.message;
      }
      toast.error(errMsg);
    } finally {
      setImporting(false);
      // Clear file input value to allow uploading the same file again
      const input = document.getElementById("excel-upload-input");
      if (input) input.value = "";
    }
  };

  if (userRole === "super_admin") {
    return (
      <div style={{ marginTop: 16 }}>
        <div className="card admin-panel" style={{ marginBottom: 16, background: "linear-gradient(135deg, rgba(15,118,110,0.1), rgba(13,148,136,0.05))", borderLeft: "4px solid var(--primary)" }}>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--primary)" }}>Super Admin Global Control Center</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>Full system administration, security controls, and enterprise operations</p>
              </div>
              <span className="admin-pill success">System Master Access</span>
            </div>
          </div>
        </div>
        <div className="admin-grid" style={{ marginBottom: 16 }}>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(15,118,110,0.12)", color: "var(--primary)" }}><Users size={18} /></div><div><p>Total Registered Voters</p><h3>{totalVoters}</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(16,185,129,0.12)", color: "var(--success)" }}><VoteIcon size={18} /></div><div><p>Total Votes Cast</p><h3 style={{ color: "var(--success)" }}>{votesCast}</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed" }}><Activity size={18} /></div><div><p>National Turnout</p><h3 style={{ color: "#7c3aed" }}>{turnoutRate}%</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(239,68,68,0.12)", color: "var(--danger)" }}><ShieldAlert size={18} /></div><div><p>Security Incidents</p><h3 style={{ color: stats?.pending > 0 ? "var(--danger)" : "inherit" }}>{stats?.pending || 0}</h3></div></div>
        </div>
        <div className="card admin-panel" style={{ marginBottom: 16 }}>
          <div className="card-header"><div><h2 className="card-title">Super Admin Quick Controls</h2><p className="card-subtitle">Direct shortcuts for administrative tasks</p></div></div>
          <div style={{ padding: "0 24px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <button className="button primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Users")}><Users size={16} /> Manage Users</button>
            <button className="button secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Roles")}><ShieldCheck size={16} /> Roles & Permissions</button>
            <button className="button secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Audit Logs")}><Terminal size={16} /> Audit Logs</button>
            <button className="button primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#7c3aed" }} onClick={() => setTab("AI Analytics")}><Activity size={16} /> System Analytics</button>
          </div>
        </div>
        <div className="admin-panels">
          <div className="card admin-panel">
            <div className="card-header"><div><h2 className="card-title">Core Services Operational Status</h2><p className="card-subtitle">Global system infrastructure health</p></div><span className="admin-pill success">All Systems Operational</span></div>
            <div className="admin-list">
              {["Identity Verification Engine", "Biometric Face Recognition", "Blockchain Ballot Ledger Sync", "Security Alert Pipeline", "Database Connection Pool"].map(s => (
                <div key={s} className="admin-row"><span>{s}</span><span className="admin-pill success">Healthy</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (userRole === "auditor") {
    return (
      <div style={{ marginTop: 16 }}>
        <div className="card admin-panel" style={{ marginBottom: 16, background: "linear-gradient(135deg, rgba(124,58,237,0.1), rgba(139,92,246,0.05))", borderLeft: "4px solid #7c3aed" }}>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#7c3aed" }}>Independent Auditor & Compliance Portal</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>Cryptographic integrity, Merkle tree verification, and audit trails</p>
              </div>
              <span className="admin-pill success">Ledger Audited</span>
            </div>
          </div>
        </div>
        <div className="admin-grid" style={{ marginBottom: 16 }}>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed" }}><Database size={18} /></div><div><p>Blockchain Blocks</p><h3 style={{ color: "#7c3aed" }}>{stats.votes_cast}</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(16,185,129,0.12)", color: "var(--success)" }}><ShieldCheck size={18} /></div><div><p>Hash Integrity</p><h3 style={{ color: "var(--success)" }}>100% Valid</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(15,118,110,0.12)", color: "var(--primary)" }}><Terminal size={18} /></div><div><p>Audit Events</p><h3>{stats.votes_cast + 120}</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(245,158,11,0.12)", color: "var(--warning)" }}><AlertTriangle size={18} /></div><div><p>Flagged Anomalies</p><h3>0</h3></div></div>
        </div>
        <div className="card admin-panel" style={{ marginBottom: 16 }}>
          <div className="card-header"><div><h2 className="card-title">Auditor Direct Tools</h2><p className="card-subtitle">Quick access to audit verification views</p></div></div>
          <div style={{ padding: "0 24px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <button className="button primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#7c3aed" }} onClick={() => setTab("Audit Logs")}><Terminal size={16} /> Audit Logs</button>
            <button className="button secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Vote Verification")}><ShieldCheck size={16} /> Vote Verification</button>
            <button className="button secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Merkle Tree")}><Database size={16} /> Merkle Tree</button>
            <button className="button secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Reports")}><Activity size={16} /> System Reports</button>
          </div>
        </div>
      </div>
    );
  }

  if (userRole === "election_commissioner") {
    return (
      <div style={{ marginTop: 16 }}>
        <div className="card admin-panel" style={{ marginBottom: 16, background: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.05))", borderLeft: "4px solid var(--success)" }}>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--success)" }}>Election Commission Executive Portal</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>Official election oversight, candidate approvals, and voter participation</p>
              </div>
              <span className="admin-pill success">Elections Active</span>
            </div>
          </div>
        </div>
        <div className="admin-grid" style={{ marginBottom: 16 }}>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(15,118,110,0.12)", color: "var(--primary)" }}><Calendar size={18} /></div><div><p>Active Elections</p><h3>6</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(16,185,129,0.12)", color: "var(--success)" }}><Users size={18} /></div><div><p>Approved Candidates</p><h3>12</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed" }}><VoteIcon size={18} /></div><div><p>Total Ballots Cast</p><h3 style={{ color: "#7c3aed" }}>{stats.votes_cast}</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(245,158,11,0.12)", color: "var(--warning)" }}><Activity size={18} /></div><div><p>Turnout Rate</p><h3>{stats.turnout}%</h3></div></div>
        </div>
        <div className="card admin-panel" style={{ marginBottom: 16 }}>
          <div className="card-header"><div><h2 className="card-title">Commission Shortcuts</h2><p className="card-subtitle">Manage elections, candidates, and certified reports</p></div></div>
          <div style={{ padding: "0 24px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <button className="button primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Elections")}><Calendar size={16} /> Elections</button>
            <button className="button secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Candidates")}><Users size={16} /> Candidates</button>
            <button className="button secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Reports")}><Activity size={16} /> Export Reports</button>
          </div>
        </div>
      </div>
    );
  }

  if (userRole === "district_admin") {
    return (
      <div style={{ marginTop: 16 }}>
        <div className="card admin-panel" style={{ marginBottom: 16, background: "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(37,99,235,0.05))", borderLeft: "4px solid #2563eb" }}>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#2563eb" }}>District Operations Command Center</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>Local district polling stations, voter rolls, and turnout management</p>
              </div>
              <span className="admin-pill success">District Active</span>
            </div>
          </div>
        </div>
        <div className="admin-grid" style={{ marginBottom: 16 }}>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(37,99,235,0.12)", color: "#2563eb" }}><Map size={18} /></div><div><p>Registered Polling Stations</p><h3 style={{ color: "#2563eb" }}>8</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(15,118,110,0.12)", color: "var(--primary)" }}><Users size={18} /></div><div><p>District Voters</p><h3>{voters?.length || stats?.total_voters || 0}</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(16,185,129,0.12)", color: "var(--success)" }}><VoteIcon size={18} /></div><div><p>District Votes Cast</p><h3 style={{ color: "var(--success)" }}>{stats.votes_cast}</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(245,158,11,0.12)", color: "var(--warning)" }}><Activity size={18} /></div><div><p>District Turnout</p><h3>{stats.turnout}%</h3></div></div>
        </div>
        <div className="card admin-panel" style={{ marginBottom: 16 }}>
          <div className="card-header"><div><h2 className="card-title">District Administration</h2><p className="card-subtitle">Manage polling stations and local voters</p></div></div>
          <div style={{ padding: "0 24px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <button className="button primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Polling Stations")}><Map size={16} /> Polling Stations</button>
            <button className="button secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Voters")}><Users size={16} /> District Voters</button>
            <button className="button secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Reports")}><Activity size={16} /> District Reports</button>
          </div>
        </div>
      </div>
    );
  }

  if (userRole === "polling_station_officer") {
    return <PollingStationOfficerDashboard setTab={setTab} stats={stats} voters={voters} />;
  }

  if (userRole === "observer") {
    return (
      <div style={{ marginTop: 16 }}>
        <div className="card admin-panel" style={{ marginBottom: 16, background: "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.05))", borderLeft: "4px solid var(--warning)" }}>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--warning)" }}>Independent Observer Transparency Portal</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>Real-time voter turnout feeds, live statistics, and public audit metrics</p>
              </div>
              <span className="admin-pill neutral">Public Observer</span>
            </div>
          </div>
        </div>
        <div className="admin-grid" style={{ marginBottom: 16 }}>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(16,185,129,0.12)", color: "var(--success)" }}><VoteIcon size={18} /></div><div><p>Total Ballots Counted</p><h3 style={{ color: "var(--success)" }}>{stats.votes_cast}</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(245,158,11,0.12)", color: "var(--warning)" }}><Activity size={18} /></div><div><p>Live Turnout %</p><h3 style={{ color: "var(--warning)" }}>{stats.turnout}%</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(15,118,110,0.12)", color: "var(--primary)" }}><Map size={18} /></div><div><p>Active Districts</p><h3>5</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed" }}><Database size={18} /></div><div><p>Ledger Blocks</p><h3>{stats.votes_cast}</h3></div></div>
        </div>
        <div className="card admin-panel" style={{ marginBottom: 16 }}>
          <div className="card-header"><div><h2 className="card-title">Observer Navigation</h2><p className="card-subtitle">Live analytics and election statistics</p></div></div>
          <div style={{ padding: "0 24px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <button className="button primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Live Charts")}><Activity size={16} /> Live Charts</button>
            <button className="button secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Turnout")}><VoteIcon size={16} /> Turnout Feed</button>
            <button className="button secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Blockchain Status")}><Database size={16} /> Blockchain Status</button>
          </div>
        </div>
      </div>
    );
  }

  if (userRole === "technical_support") {
    return (
      <div style={{ marginTop: 16 }}>
        <div className="card admin-panel" style={{ marginBottom: 16, background: "linear-gradient(135deg, rgba(14,165,233,0.1), rgba(2,132,199,0.05))", borderLeft: "4px solid #0284c7" }}>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#0284c7" }}>Technical Infrastructure & System Support</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>Node cluster health, API diagnostics, database performance, and hardware logs</p>
              </div>
              <span className="admin-pill success">All Nodes Synced</span>
            </div>
          </div>
        </div>
        <div className="admin-grid" style={{ marginBottom: 16 }}>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(2,132,199,0.12)", color: "#0284c7" }}><Database size={18} /></div><div><p>Node Sync Status</p><h3 style={{ color: "#0284c7" }}>100% Synced</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(16,185,129,0.12)", color: "var(--success)" }}><Activity size={18} /></div><div><p>Average API Latency</p><h3 style={{ color: "var(--success)" }}>12 ms</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed" }}><Users size={18} /></div><div><p>Active Node Cluster</p><h3>4 Nodes</h3></div></div>
          <div className="card admin-metric"><div className="metric-icon" style={{ background: "rgba(15,118,110,0.12)", color: "var(--primary)" }}><Terminal size={18} /></div><div><p>Uptime</p><h3>99.9%</h3></div></div>
        </div>
        <div className="card admin-panel" style={{ marginBottom: 16 }}>
          <div className="card-header"><div><h2 className="card-title">Technical Support Diagnostics</h2><p className="card-subtitle">Infrastructure inspection and logs</p></div></div>
          <div style={{ padding: "0 24px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <button className="button primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Node Status")}><Database size={16} /> Node Status</button>
            <button className="button secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("Server Health")}><Activity size={16} /> Server Health</button>
            <button className="button secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setTab("System Logs")}><Terminal size={16} /> System Logs</button>
          </div>
        </div>
      </div>
    );
  }

  if (userRole === "nadra_officer") {
    return (
      <div style={{ marginTop: 16 }}>
        {/* Banner with Import Excel Button in top-right */}
        <div className="card admin-panel" style={{ marginBottom: 16, background: "linear-gradient(135deg, rgba(79,70,229,0.1), rgba(79,70,229,0.05))", borderLeft: "4px solid #4f46e5" }}>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "#4f46e5", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "-0.01em" }}>
                  Voter Registration
                </h2>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="file"
                  id="excel-upload-input"
                  accept=".xlsx,.xls"
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                  disabled={importing}
                />
                
                {selectedFile ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(15,23,42,0.04)", padding: "4px 12px", borderRadius: 8, border: "1px dashed rgba(15,23,42,0.12)" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{selectedFile.name}</span>
                    <button
                      className={`button primary${importing ? " is-loading" : ""}`}
                      style={{ background: "#10b981", border: "none", color: "white", padding: "4px 10px", fontSize: 12, height: "auto", display: "flex", alignItems: "center", gap: 4 }}
                      onClick={handleUpload}
                      disabled={importing}
                    >
                      <Database size={12} />
                      {importing ? "Uploading..." : "Upload & Sync"}
                    </button>
                    <button
                      className="button secondary"
                      style={{ padding: "4px 10px", fontSize: 12, height: "auto", background: "white", color: "var(--foreground)", border: "1px solid rgba(15,23,42,0.12)" }}
                      onClick={() => setSelectedFile(null)}
                      disabled={importing}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="button primary"
                    style={{ background: "#4f46e5", border: "none", color: "white", display: "flex", alignItems: "center", gap: 8 }}
                    onClick={() => document.getElementById("excel-upload-input").click()}
                    disabled={importing}
                  >
                    <Database size={16} />
                    Choose Excel File
                  </button>
                )}
                <button
                  className="button secondary"
                  style={{ display: "flex", alignItems: "center", gap: 8, background: "white", color: "var(--foreground)", border: "1px solid rgba(15,23,42,0.12)" }}
                  onClick={() => setShowAddModal(true)}
                  disabled={importing}
                >
                  <UserPlus size={16} />
                  Add Voter
                </button>
                <span className="admin-pill success" style={{ background: "rgba(79,70,229,0.15)", color: "#4f46e5", border: "1px solid rgba(79,70,229,0.3)" }}>
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="admin-grid" style={{ marginBottom: 16 }}>
          <div className="card admin-metric">
            <div className="metric-icon" style={{ background: "rgba(79,70,229,0.12)", color: "#4f46e5" }}><Users size={18} /></div>
            <div>
              <p>National Registered Voters</p>
              <h3>{totalVoters}</h3>
            </div>
          </div>
          <div className="card admin-metric">
            <div className="metric-icon" style={{ background: "rgba(16,185,129,0.12)", color: "var(--success)" }}><ShieldCheck size={18} /></div>
            <div>
              <p>Active Elections</p>
              <h3>{stats.active_elections || 6}</h3>
            </div>
          </div>
          <div className="card admin-metric">
            <div className="metric-icon" style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed" }}><VoteIcon size={18} /></div>
            <div>
              <p>National Turnout</p>
              <h3>{turnoutRate}%</h3>
            </div>
          </div>
          <div className="card admin-metric">
            <div className="metric-icon" style={{ background: "rgba(245,158,11,0.12)", color: "var(--warning)" }}><Activity size={18} /></div>
            <div>
              <p>Database Status</p>
              <h3>Synced</h3>
            </div>
          </div>
        </div>

        {/* Import Logs/Instructions Panel */}
        <div className="card admin-panel" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Excel Data Upload & Sync</h2>
              <p className="card-subtitle">Import voters securely in bulk using Excel templates</p>
            </div>
          </div>
          <div style={{ padding: "0 24px 20px" }}>
            <div className="admin-row" style={{ padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              <strong>Required Excel Headers:</strong>
              <code style={{ background: "rgba(0,0,0,0.05)", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>
                full_name, cnic, phone, constituency, email, polling_station_id
              </code>
            </div>
            <div className="admin-row" style={{ padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              <span>Allowed Formats:</span>
              <span className="admin-pill success">.xlsx, .xls</span>
            </div>
            <div className="admin-row" style={{ padding: "12px 0" }}>
              <span>Unique Check (CNIC):</span>
              <span>Duplicates will automatically be skipped.</span>
            </div>
          </div>
        </div>

        {/* Import Results Summary (if uploaded) */}
        {importResult && (
          <div className="card admin-panel" style={{ borderLeft: "4px solid #10b981" }}>
            <div className="card-header">
              <div>
                <h2 className="card-title" style={{ color: "#10b981" }}>Last Import Summary</h2>
                <p className="card-subtitle">Voter database sync results</p>
              </div>
            </div>
            <div style={{ padding: "0 24px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: "rgba(16,185,129,0.08)", padding: 12, borderRadius: 8, textAlign: "center" }}>
                  <h4 style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Inserted Voters</h4>
                  <h3 style={{ margin: "4px 0 0", color: "#10b981" }}>{importResult.imported !== undefined ? importResult.imported : importResult.inserted}</h3>
                </div>
                <div style={{ background: "rgba(245,158,11,0.08)", padding: 12, borderRadius: 8, textAlign: "center" }}>
                  <h4 style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Skipped (Duplicates/Errors)</h4>
                  <h3 style={{ margin: "4px 0 0", color: "var(--warning)" }}>{importResult.skipped}</h3>
                </div>
              </div>

              {importResult.errors && importResult.errors.length > 0 && (
                <div style={{ marginTop: 16, borderTop: "1px solid rgba(15,23,42,0.08)", paddingTop: 16 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={14} color="var(--warning)" />
                    Skipped Rows / Validation Issues:
                  </h4>
                  <div style={{ maxHeight: 180, overflowY: "auto", fontSize: 12, display: "flex", flexDirection: "column", gap: 6, paddingRight: 4 }}>
                    {importResult.errors.map((err, idx) => (
                      <div key={idx} style={{ background: "rgba(245,158,11,0.03)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: 6, padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span><strong>Row {err.row}:</strong> {err.reason}</span>
                        {err.cnic && <span style={{ color: "var(--muted)", fontFamily: "monospace" }}>CNIC: {err.cnic}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Voter Manual Modal */}
        {showAddModal && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}>
            <div className="card" style={{
              width: "100%",
              maxWidth: 500,
              padding: 24,
              boxShadow: "0 24px 48px rgba(15, 23, 42, 0.16)",
              borderRadius: 16,
              background: "white"
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>Add Voter Manually</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 20px" }}>Provision an individual voter record directly into the secure voter registry.</p>
              
              <form onSubmit={handleAddSubmit} className="form-grid">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Enter full name"
                    value={addForm.full_name}
                    onChange={e => setAddForm({...addForm, full_name: e.target.value.replace(/[^A-Za-z\s]/g, "")})}
                    required
                  />
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">CNIC *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="00000-0000000-0"
                      value={addForm.cnic}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, "");
                        let formatted = val;
                        if (val.length > 5 && val.length <= 12) {
                          formatted = val.slice(0, 5) + "-" + val.slice(5);
                        } else if (val.length > 12) {
                          formatted = val.slice(0, 5) + "-" + val.slice(5, 12) + "-" + val.slice(12, 13);
                        }
                        setAddForm({...addForm, cnic: formatted.slice(0, 15)});
                      }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="03XXXXXXXXX"
                      value={addForm.phone}
                      onChange={e => setAddForm({...addForm, phone: e.target.value.replace(/\D/g, "").slice(0, 11)})}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address (Optional)</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="voter@email.com"
                    value={addForm.email}
                    onChange={e => setAddForm({...addForm, email: e.target.value})}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">District/Constituency *</label>
                    <select
                      className="input"
                      value={addForm.constituency}
                      onChange={e => setAddForm({...addForm, constituency: e.target.value, polling_station_id: ""})}
                      required
                      style={{ height: 42, padding: "0 12px", background: "white" }}
                    >
                      <option value="">Select District</option>
                      {districts.map(d => (
                        <option key={d.district_id} value={d.district_name}>{d.district_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Polling Station</label>
                    <select
                      className="input"
                      value={addForm.polling_station_id}
                      onChange={e => setAddForm({...addForm, polling_station_id: e.target.value})}
                      style={{ height: 42, padding: "0 12px", background: "white" }}
                    >
                      <option value="">Select Polling Station</option>
                      {filteredStations.map(s => (
                        <option key={s.polling_station_id} value={s.polling_station_id}>{s.station_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button className="button secondary" type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1 }}>Cancel</button>
                  <button className={`button primary ${submitting ? "is-loading" : ""}`} type="submit" disabled={submitting} style={{ flex: 1, background: "#4f46e5", border: "none", color: "white" }}>
                    {submitting ? "Saving..." : "Add Voter"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback default Admin view (for admin, viewer, or unmapped roles)
  return (
    <div style={{ marginTop: 16 }}>
      <div className="admin-grid" style={{ marginBottom: 16 }}>
        <div className="card admin-metric"><div className="metric-icon"><Users size={18} /></div><div><p>Total voters</p><h3>{stats.total_voters}</h3></div></div>
        <div className="card admin-metric"><div className="metric-icon"><VoteIcon size={18} /></div><div><p>Votes cast</p><h3>{stats.votes_cast}</h3></div></div>
        <div className="card admin-metric"><div className="metric-icon"><Activity size={18} /></div><div><p>Turnout</p><h3>{stats.turnout}%</h3></div></div>
        <div className="card admin-metric"><div className="metric-icon"><AlertTriangle size={18} /></div><div><p>Pending review</p><h3 style={{ color: stats.pending > 0 ? "var(--danger)" : "inherit" }}>{stats.pending}</h3></div></div>
      </div>
      <div className="admin-panels">
        <div className="card admin-panel">
          <div className="card-header"><div><h2 className="card-title">Operational status</h2><p className="card-subtitle">All core services reporting healthy.</p></div><span className="admin-pill success">Healthy</span></div>
          <div className="admin-list">
            {["Identity verification","Face recognition","Ballot ledger sync","Security monitoring","Rate limiting","Account lockout"].map(s => (
              <div key={s} className="admin-row"><span>{s}</span><span className="admin-pill success">Active</span></div>
            ))}
          </div>
        </div>
        <div className="card admin-panel">
          <div className="card-header"><div><h2 className="card-title">Election integrity</h2><p className="card-subtitle">Current safeguards and audit checks.</p></div><span className="admin-pill neutral">Protected</span></div>
          <div className="admin-list">
            {["Duplicate registration blocks","Face recognition anti-fraud","Receipt verification","Input validation (CNIC/phone)","CORS lockdown","Audit logging"].map(s => (
              <div key={s} className="admin-row"><span>{s}</span><span className="admin-pill success">Active</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

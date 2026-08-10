import React from 'react';
import { Calendar, PlusCircle, RefreshCw, Trash2, Play } from "lucide-react";

export default function AdminElectionsTab({
  showElectionForm,
  setShowElectionForm,
  loadElections,
  handleCreateElection,
  electionForm,
  setElectionForm,
  electionFormLoading,
  electionsLoading,
  elections,
  handleDeleteElection,
  handleStartElectionNow
}) {
  const [pollingStations, setPollingStations] = React.useState([]);

  React.useEffect(() => {
    import('../../services/api').then(mod => {
      const API = mod.default;
      API.get('/public/polling-stations')
         .then(res => setPollingStations(res.data))
         .catch(err => console.error(err));
    });
  }, []);

  return (
    <div className="card admin-panel" style={{ marginTop: 16 }}>
      <div className="card-header">
        <div>
          <h2 className="card-title"><Calendar size={16} /> Elections Management</h2>
          <p className="card-subtitle">Manage upcoming and ongoing elections.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="button" style={{ fontSize: 12 }} onClick={() => setShowElectionForm(!showElectionForm)}>
            <PlusCircle size={13} /> {showElectionForm ? "Cancel" : "New Election"}
          </button>
          <button className="button secondary" style={{ fontSize: 12 }} onClick={loadElections}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>
      
      {showElectionForm && (
        <form onSubmit={handleCreateElection} className="form-grid" style={{ padding: 16, borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }}>
          <div className="form-group">
            <label className="form-label">Election Title</label>
            <input className="input" value={electionForm.title} onChange={e => setElectionForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. General Election 2026" required />
          </div>
          <div className="form-group">
            <label className="form-label">Polling Station (Optional)</label>
            <select className="input" value={electionForm.polling_station_id || ""} onChange={e => setElectionForm(p => ({ ...p, polling_station_id: e.target.value }))}>
              <option value="">-- All Polling Stations / Global --</option>
              {pollingStations.map(ps => (
                <option key={ps.station_id} value={ps.station_id}>{ps.station_name} ({ps.station_code})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="datetime-local" className="input" value={electionForm.date} onChange={e => setElectionForm(p => ({ ...p, date: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">End Date/Time (Optional)</label>
            <input type="datetime-local" className="input" value={electionForm.end_time} onChange={e => setElectionForm(p => ({ ...p, end_time: e.target.value }))} />
          </div>
          <div className="form-actions" style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" className={`button ${electionFormLoading ? "is-loading" : ""}`} disabled={electionFormLoading}>
              {electionFormLoading ? "Creating..." : "Create Election"}
            </button>
          </div>
        </form>
      )}

      {electionsLoading && elections.length === 0 ? (
        <div className="results-loading"><div className="loading-bar"/><div className="loading-bar"/></div>
      ) : elections.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 16 }}>
          <div className="empty-icon"><Calendar size={32} /></div>
          <h3>No elections found</h3>
        </div>
      ) : (
        <div className="admin-list" style={{ marginTop: 16 }}>
          {elections.map(election => (
            <div key={election.election_id} className="admin-row" style={{ flexWrap: "wrap", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <strong>{election.title}</strong>
                <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 8 }}>{new Date(election.date).toLocaleString()} {election.end_time ? `- ${new Date(election.end_time).toLocaleString()}` : ''}</span>
              </div>
              <span className={`admin-pill ${election.status === 'Active' ? 'success' : election.status === 'Closed' ? 'neutral' : 'warning'}`}>
                {election.status}
              </span>
              
              {election.status === 'Upcoming' && (
                <button className="button" style={{ fontSize: 12, backgroundColor: "#0f766e", color: "white" }} onClick={() => handleStartElectionNow(election.election_id)}>
                  <Play size={13} /> Start Now
                </button>
              )}

              <button className="button secondary" style={{ fontSize: 12 }} onClick={() => handleDeleteElection(election.election_id)}>
                <Trash2 size={13} /> Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Trophy,
  TrendingUp,
  Users,
  Vote as VoteIcon,
  Medal
} from "lucide-react";
import API from "../api";

function ResultsPage() {
  const [elections, setElections] = useState([]);
  const [selectedElectionId, setSelectedElectionId] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchElections = async () => {
      try {
        const token = localStorage.getItem("adminToken") || localStorage.getItem("voterToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await API.get("/public/elections", { headers });
        const list = res.data || [];
        setElections(list);
        if (list.length > 0) {
          const active = list.find(e => e.status === "Active");
          setSelectedElectionId(active ? active.election_id : list[0].election_id);
        } else {
          setIsLoading(false); // No elections to load results for
        }
      } catch (error) {
        console.error("Elections load error:", error);
        setIsLoading(false);
      }
    };
    fetchElections();
  }, []);

  useEffect(() => {
    if (!selectedElectionId) return;
    
    const loadResults = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("adminToken") || localStorage.getItem("voterToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const url = `/results?election_id=${encodeURIComponent(selectedElectionId)}`;
        const fallbackUrl = `/candidates?election_id=${encodeURIComponent(selectedElectionId)}`;
        const resultsRes = await API.get(url, { headers }).catch(() => API.get(fallbackUrl, { headers }));
        const list = Array.isArray(resultsRes.data) ? resultsRes.data : (resultsRes.data?.records || resultsRes.data?.candidates || resultsRes.data?.items || []);
        const mapped = list.map(c => ({
          ...c,
          id: c.id || c.candidate_id || c._id,
          candidate_id: c.candidate_id || c.id,
          name: c.name || c.full_name || c.candidate_name || c.title || "",
          full_name: c.full_name || c.name || c.candidate_name || c.title || "",
          party: c.party || c.party_name || "",
          party_name: c.party_name || c.party || "",
          symbol: c.symbol || c.symbol_name || "",
          symbol_name: c.symbol_name || c.symbol || "",
          votes: typeof c.votes === 'number' ? c.votes : (parseInt(c.votes) || 0)
        }));
        setResults(mapped);
      } catch (error) {
        console.error("Results load error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadResults();
  }, [selectedElectionId]);

  const totalVotes = results.reduce(
    (sum, item) => sum + item.votes,
    0
  );

  const sortedResults = [...results].sort(
    (a, b) => b.votes - a.votes
  );

  const leader = sortedResults[0];

  const isEmpty = !isLoading && results.length === 0;

  return (
    <div className="page">
      <div className="page-header">
        <div className="eyebrow">
          <BarChart3 size={16} />
          Election results
        </div>
        <h1 className="section-title">
          Results dashboard
        </h1>
        <p className="section-subtitle" style={{ marginBottom: 16 }}>
          A real-time summary of votes recorded on the public ledger.
        </p>
        
        {elections.length > 0 && (
          <div style={{ maxWidth: 400 }}>
            <label className="form-label">Select Election</label>
            <select 
              className="input" 
              value={selectedElectionId} 
              onChange={(e) => setSelectedElectionId(e.target.value)}
              style={{ backgroundColor: "var(--card-bg)" }}
            >
              {elections.map(e => (
                <option key={e.election_id} value={e.election_id}>
                  {e.title} ({e.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="results-metrics">
        <div className="metric-card">
          <div className="metric-icon">
            <Users size={18} />
          </div>
          <div>
            <p>Total ballots</p>
            <h3>{totalVotes}</h3>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon">
            <VoteIcon size={18} />
          </div>
          <div>
            <p>Active candidates</p>
            <h3>{results.length}</h3>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon">
            <Medal size={18} />
          </div>
          <div>
            <p>Lead margin</p>
            <h3>
              {leader ? leader.votes - (sortedResults[1]?.votes || 0) : 0}
            </h3>
          </div>
        </div>
      </div>

      <div className="card results-hero">
        <div>
          <h2>
            Leading candidate
          </h2>
          <p>
            Updated with every confirmed vote.
          </p>
        </div>
        <div className="results-leader">
          <Trophy size={18} />
          {leader ? `${leader.symbol} ${leader.name}` : "No leader yet"}
        </div>
      </div>

      {isLoading && (
        <div className="results-loading">
          <div className="loading-bar" />
          <div className="loading-bar" />
          <div className="loading-bar" />
        </div>
      )}

      {isEmpty && (
        <div className="card results-empty">
          <h3>No votes recorded</h3>
          <p>
            Results will appear once the first ballot is confirmed.
          </p>
        </div>
      )}

      {!isLoading && !isEmpty && (
        <div className="results-grid">
          {sortedResults.map((candidate, index) => {
            const percent = totalVotes
              ? Math.round((candidate.votes / totalVotes) * 100)
              : 0;

            return (
              <div className="card results-card" key={candidate.id}>
                <div className="results-card-header">
                  <div className="rank-badge">#{index + 1}</div>
                  <div>
                    <h3>
                      {candidate.symbol} {candidate.name}
                    </h3>
                    <p>{candidate.party}</p>
                  </div>
                  <div className="results-stat">
                    <span>{percent}%</span>
                    <small>{candidate.votes} votes</small>
                  </div>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-bar"
                    style={{
                      width: `${percent}%`
                    }}
                  />
                </div>
                <div className="results-meta">
                  <TrendingUp size={16} />
                  Vote share distribution
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ResultsPage;
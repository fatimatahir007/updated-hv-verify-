import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  ShieldCheck,
  Vote as VoteIcon,
  ArrowRight,
  CheckCircle2,
  Calendar,
  KeyRound,
  IdCard,
  MapPin
} from "lucide-react";
import toast from "react-hot-toast";

import API from "../api";
import { useLang } from "../context/LangContext";
import { QRCodeSVG } from "qrcode.react";

function VotePage() {

  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLang();
  const speak = () => {};
  // Speak page intro on load
  useEffect(() => {
    setTimeout(() => speak(t.voteTitle + ". " + t.voteSubtitle), 500);
  }, [t]);

  const [voter, setVoter] = useState(null);

  const [authenticated, setAuthenticated] = useState(false);

  const [candidates, setCandidates] = useState([]);
  const [activeElection, setActiveElection] = useState(null);
  const [electionLoading, setElectionLoading] = useState(true);

  const [receipt, setReceipt] = useState(null);

  const [loading, setLoading] = useState(false);

  const [copyState, setCopyState] = useState({
    loading: false,
    error: "",
    success: false
  });

  const [directVoterId, setDirectVoterId] = useState(
    location.state?.voterId || ""
  );

  const [pollingStationsList, setPollingStationsList] = useState([]);
  const [districtsList, setDistrictsList] = useState([]);
  const [filteredPollingStations, setFilteredPollingStations] = useState([]);
  const [selectedStationId, setSelectedStationId] = useState("");

  useEffect(() => {
    const fetchStationsAndDistricts = async () => {
      try {
        const [stationRes, distRes] = await Promise.all([
          API.get("/public/polling-stations"),
          API.get("/public/districts")
        ]);
        setPollingStationsList(stationRes.data || []);
        setDistrictsList(distRes.data || []);
      } catch (err) {
        console.error("Error fetching stations/districts", err);
      }
    };
    fetchStationsAndDistricts();
  }, []);

  useEffect(() => {
    const userDistrictId = voter?.district_id;
    const userDistrictName = voter?.district || location.state?.voterDistrict;
    
    let matchedDistrictId = userDistrictId;
    if (!matchedDistrictId && userDistrictName) {
      const found = districtsList.find(d => d.district_name.toLowerCase() === userDistrictName.toLowerCase());
      if (found) matchedDistrictId = found.district_id;
    }
    
    if (matchedDistrictId) {
      const filtered = pollingStationsList.filter(ps => ps.district_id === matchedDistrictId);
      setFilteredPollingStations(filtered);
    } else {
      setFilteredPollingStations([]);
    }
  }, [voter, districtsList, pollingStationsList, location.state?.voterDistrict]);

  useEffect(() => {
    if (voter?.polling_station_id) {
      setSelectedStationId(voter.polling_station_id);
    }
  }, [voter]);

  const [districtModal, setDistrictModal] = useState({
    open: false,
    candidate: null,
    voterDistrict: "",
    candidateDistrict: ""
  });

  const [loginForm, setLoginForm] = useState({ identifier: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLogin2FA, setShowLogin2FA] = useState(false);
  const [login2FACnic, setLogin2FACnic] = useState("");
  const [login2FAOtp, setLogin2FAOtp] = useState("");

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const response = await API.post("/auth/login", {
        identifier: loginForm.identifier,
        password: loginForm.password
      });

      if (response.data?.status === "pending_2fa") {
        setLogin2FACnic(response.data.cnic);
        setShowLogin2FA(true);
        const serverOtp = response.data.otp || "123456";
        toast.success(`OTP sent to email! (Demo OTP: ${serverOtp})`, { duration: 8000 });
        return;
      }

      toast.success("Login successful!");
      localStorage.setItem("voterToken", response.data.access_token);
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid email, CNIC, or password");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogin2FASubmit = async (e) => {
    e.preventDefault();
    const otpToSubmit = login2FAOtp.trim() || "123456";
    setLoginLoading(true);
    try {
      const response = await API.post("/auth/login-verify-otp", {
        cnic: login2FACnic,
        otp: otpToSubmit
      });
      toast.success("Login successful!");
      localStorage.setItem("voterToken", response.data.access_token);
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid or expired OTP.");
    } finally {
      setLoginLoading(false);
    }
  };

  useEffect(() => {
    const fetchElections = async () => {
      try {
        const res = await API.get("/public/elections");
        const active = res.data.find(e => e.status === "Active");
        setActiveElection(active || null);
      } catch (err) {
        console.error("Error fetching elections", err);
      } finally {
        setElectionLoading(false);
      }
    };
    fetchElections();
    const interval = setInterval(fetchElections, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const passedVoterId = location.state?.voterId || "";
    if (passedVoterId) {
      setDirectVoterId(passedVoterId);
      setAuthenticated(true);
    }

    const token = localStorage.getItem("voterToken");
    if (token) {
      const loadSession = async () => {
        try {
          const response = await API.get("/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });

          setVoter(response.data);
          setAuthenticated(true);
          setDirectVoterId((prev) => prev || response.data.voter_id || "");
        } catch (error) {
          if (!passedVoterId) {
            localStorage.removeItem("voterToken");
            setAuthenticated(false);
            setVoter(null);
          }
        }
      };

      loadSession();
    }
  }, []);

  useEffect(() => {
    if (!electionLoading) {
      const userDist = voter?.district || location.state?.voterDistrict;
      loadCandidates(userDist, directVoterId, activeElection?.election_id);
    }
  }, [activeElection, electionLoading, voter, directVoterId, location.state?.voterDistrict]);


  // =====================================
  // AUTHENTICATE
  // =====================================

  const authenticate = () => {
    navigate("/auth");
  };




  // =====================================
  // LOAD CANDIDATES
  // =====================================

  const loadCandidates = async (userDistrict, paramVoterId, electionId) => {
    try {
      setLoading(true);
      let url = "/candidates";
      let queryParams = [];
      // if (userDistrict) {
      //   queryParams.push(`district=${encodeURIComponent(userDistrict)}`);
      // }
      const targetVoterId = paramVoterId || directVoterId;
      // if (targetVoterId) {
      //   queryParams.push(`voter_id=${encodeURIComponent(targetVoterId)}`);
      // }
      if (electionId) {
        queryParams.push(`election_id=${encodeURIComponent(electionId)}`);
      }
      if (queryParams.length > 0) {
        url += "?" + queryParams.join("&");
      }
      let response = await API.get(url);
      let list = Array.isArray(response.data) ? response.data : (response.data?.records || []);
      
      if (list.length === 0 && userDistrict) {
        // Fallback to fetch all candidates if district query returned empty
        const fallbackUrl = electionId ? `/candidates?election_id=${encodeURIComponent(electionId)}` : "/candidates";
        const fallbackRes = await API.get(fallbackUrl);
        list = Array.isArray(fallbackRes.data) ? fallbackRes.data : (fallbackRes.data?.records || []);
      }
      setCandidates(list);
    } catch (e) {
      console.error("Load Candidates error:", e);
    } finally {
      setLoading(false);
    }
  };


  // =====================================
  // CAST VOTE
  // =====================================

  const castVote = async (candidateId) => {
    if (loading) return;
    try {
      setLoading(true);

      const resolvedCandidateId = candidateId || "";
      if (!resolvedCandidateId) {
        toast.error("Invalid candidate selected. Please refresh and try again.");
        return;
      }

      const token = localStorage.getItem("voterToken");
      if (!token && !directVoterId) {
        toast.error("Please log in to vote.");
        navigate("/auth");
        return;
      }


      const votePayload = {
        candidate_id: resolvedCandidateId,
        voter_id: directVoterId || voter?.voter_id,
      };

      const response = await API.post(
        "/vote",
        votePayload,
        token
          ? {
              headers: { Authorization: `Bearer ${token}` },
            }
          : undefined
      );

      if (response.data && (response.data.success === false || !response.data.receipt_code)) {
        toast.error(response.data.message || response.data.detail || "Voting failed. Please try again.");
        return;
      }

      setReceipt(response.data);
      if (voter) {
        setVoter({ ...voter, has_voted: true });
      }
      setCopyState({
        loading: false,
        error: "",
        success: false
      });
      toast.success("Vote cast successfully");
    } catch (error) {
      console.error("Cast Vote Error:", error);
      const errMsg = error.response?.data?.detail || error.response?.data?.message || "Voting failed. Please try again.";
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };


  const handleCopyReceipt = async () => {
    if (!receipt?.receipt_code || copyState.loading) return;

    setCopyState({ loading: true, error: "", success: false });

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(receipt.receipt_code);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = receipt.receipt_code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopyState({ loading: false, error: "", success: true });
      toast.success("Receipt copied to clipboard");
      setTimeout(() => {
        navigate("/verify", { state: { receiptCode: receipt.receipt_code } });
      }, 1000);
    } catch (e) {
      console.error(e);
      setCopyState({ loading: false, error: "Failed to copy automatically", success: false });
    }
  };

  // =====================================
  // RECEIPT SCREEN
  // =====================================

  if (receipt && receipt.receipt_code) {
    return (
      <div className="page">
        <div className="card form-card">
          <div className="result-header">
            <CheckCircle2 size={20} />
            <h1 className="section-title">Vote confirmed</h1>
          </div>

          <p className="section-subtitle">
            Your ballot is encrypted, recorded, and notarized on the public ledger.
          </p>

          <div className="card result-card">
            <h2>Selected candidate</h2>
            <div className="candidate-picked">
              <span className="candidate-symbol">{receipt.candidate_symbol || "🗳️"}</span>
              <span>{receipt.candidate_name || "Selected Candidate"}</span>
            </div>
          </div>

          <div className="card result-card">
            <h3>Verification receipt</h3>
            <div className="receipt-box">{receipt.receipt_code}</div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
              <div style={{ background: 'white', padding: '12px', borderRadius: '8px' }}>
                <QRCodeSVG
                  value={`${window.location.origin}/verify-public?code=${receipt.receipt_code}`}
                  size={140}
                  bgColor={"#ffffff"}
                  fgColor={"#000000"}
                  level={"Q"}
                  includeMargin={false}
                />
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                className={`button${copyState.loading ? " is-loading" : ""}`}
                onClick={handleCopyReceipt}
                style={{ flex: 1 }}
              >
                {copyState.loading ? "Copying..." : copyState.success ? "Copied! Redirecting..." : "Copy verification code"}
              </button>
              
              <button
                className="button secondary"
                onClick={() => {
                  localStorage.removeItem("voterToken");
                  navigate("/auth");
                  window.location.reload();
                }}
                style={{ flex: 1 }}
              >
                Register/Login Next Voter
              </button>

              <span className="form-hint" style={{ width: "100%" }}>
                Copy your verification code to verify your vote on the public ledger.
              </span>
            </div>

            {copyState.error && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <p className="helper-text" style={{ color: 'var(--error)' }}>
                  {copyState.error}
                </p>
                <button
                  className="button"
                  style={{ marginTop: 8 }}
                  onClick={() => navigate("/verify", { state: { receiptCode: receipt.receipt_code } })}
                >
                  Continue to Verification
                </button>
              </div>
            )}

            <p className="helper-text">
              Keep this receipt to verify your vote later.
            </p>
          </div>

          <div className="notice">
            Verification confirms your vote exists but never reveals the candidate you selected.
          </div>
        </div>
      </div>
    );
  }

  // =====================================
  // ALREADY VOTED SCREEN
  // =====================================

  if (voter?.has_voted && !receipt) {
    return (
      <div className="page">
        <div className="card form-card" style={{ textAlign: "center", padding: "40px 24px" }}>
          <div style={{ display: "flex", justifyContent: "center", color: "var(--success)", marginBottom: 16 }}>
            <CheckCircle2 size={48} />
          </div>
          <h1 className="section-title">Ballot Already Submitted</h1>
          <p className="section-subtitle" style={{ maxWidth: 480, margin: "8px auto 24px" }}>
            Your vote has been cryptographically signed, encrypted, and recorded on the public ledger. Multiple ballots are prohibited by election rules.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="button" onClick={() => navigate("/verify")}>
              <BadgeCheck size={16} /> Verify Vote Receipt
            </button>
            <button className="button secondary" onClick={() => navigate("/results")}>
              View Election Results
            </button>
            <button className="button" style={{ backgroundColor: "#0f766e", color: "white" }} onClick={() => {
              localStorage.removeItem("voterToken");
              navigate("/auth");
              window.location.reload();
            }}>
              Register/Login Next Voter
            </button>
          </div>
        </div>
      </div>
    );
  }




  const handleVoteAttempt = (candidate) => {
    const voterDistrict = voter?.district || voter?.constituency || location.state?.voterDistrict || "";
    const candDistrict = candidate.district || candidate.constituency || "";

    if (
      voterDistrict &&
      candDistrict &&
      voterDistrict.trim().toLowerCase() !== candDistrict.trim().toLowerCase() &&
      voterDistrict.trim().toLowerCase() !== "general" &&
      candDistrict.trim().toLowerCase() !== "general"
    ) {
      setDistrictModal({
        open: true,
        candidate,
        voterDistrict: voterDistrict.trim(),
        candidateDistrict: candDistrict.trim()
      });
      return;
    }

    const candId = candidate.id || candidate.candidate_id || candidate._id;
    castVote(candId);
  };


  // =====================================
  // BALLOT SCREEN
  // =====================================

  if (authenticated) {

    return (

      <div className="page">

        <div className="page-header">
          <div className="eyebrow">
            <VoteIcon size={16} />
            {t.voteTitle}
          </div>
          <h1 className="section-title">
            Cast your vote
          </h1>
          <p className="section-subtitle">
            Each ballot is anonymous, verifiable, and protected by a
            cryptographic receipt.
          </p>
        </div>


        {electionLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div className="loading-bar" style={{ maxWidth: 300, margin: '0 auto 12px' }} />
            <p className="helper-text" style={{ marginTop: 16 }}>Checking election status...</p>
          </div>
        ) : !activeElection ? (
          <div className="card form-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <Calendar size={40} style={{ color: 'var(--muted)', marginBottom: 16 }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>Voting is Closed</h2>
            <p className="helper-text" style={{ marginBottom: 24 }}>
              There is currently no active election. Please wait until the election starts.
            </p>
          </div>
        ) : loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div className="loading-bar" style={{ maxWidth: 300, margin: '0 auto 12px' }} />
            <div className="loading-bar" style={{ maxWidth: 200, margin: '0 auto' }} />
            <p className="helper-text" style={{ marginTop: 16 }}>Loading official candidates for your district...</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="card form-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <VoteIcon size={40} style={{ color: 'var(--muted)', marginBottom: 16 }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>No Candidates Registered Yet</h2>
            <p className="helper-text" style={{ marginBottom: 24 }}>
              There are currently no active candidates registered for your district. Please check back shortly or select another district.
            </p>
            <button className="button" onClick={() => loadCandidates(voter?.district || location.state?.voterDistrict, directVoterId, activeElection?.election_id)}>
              Refresh Candidates
            </button>
          </div>
        ) : (
          <>            <div className="candidate-grid">
            {candidates.map((candidate) => (
              <div key={candidate.id || candidate.candidate_id} className="candidate-card">
                <div className="candidate-symbol">{candidate.symbol || candidate.symbol_name || "🗳️"}</div>
                <h2>{candidate.name || candidate.full_name}</h2>
                <p>{candidate.party || candidate.party_name || "Independent"}</p>
                {(candidate.district || candidate.constituency) && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '12px', display: 'block' }}>
                    District: {candidate.district || candidate.constituency}
                  </span>
                )}

                <button
                  className={`button${loading ? " is-loading" : ""}`}
                  disabled={loading}
                  onClick={() => handleVoteAttempt(candidate)}
                >
                  {loading ? (
                    <>
                      <span className="spinner" />
                      Submitting...
                    </>
                  ) : (
                    "Submit vote"
                  )}
                  <ArrowRight size={16} />
                </button>
              </div>
            ))}
          </div>
          </>
        )}

        {districtModal.open && districtModal.candidate && (
          <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}>
            <div className="card form-card" style={{ maxWidth: '480px', width: '100%', textAlign: 'center', border: '1px solid #f59e0b' }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: '#f59e0b', marginBottom: '12px' }}>
                <ShieldCheck size={48} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>
                District Mismatch Warning
              </h2>
              <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '20px' }}>
                You are registered in district <strong>"{districtModal.voterDistrict}"</strong>, but candidate <strong>"{districtModal.candidate.name}"</strong> belongs to district <strong>"{districtModal.candidateDistrict}"</strong>.
              </p>

              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                borderLeft: '4px solid #f59e0b',
                padding: '12px',
                borderRadius: '4px',
                fontSize: '0.875rem',
                textAlign: 'left',
                marginBottom: '24px'
              }}>
                ⚠️ Voting for a candidate outside your assigned district is not permitted by election rules.
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  className="button"
                  style={{ width: '100%', padding: '12px', backgroundColor: '#475569', borderColor: '#475569' }}
                  onClick={() => setDistrictModal({ open: false, candidate: null, voterDistrict: "", candidateDistrict: "" })}
                >
                  Cancel & Go Back
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }




  // =====================================
  // LOGIN SCREEN
  // =====================================

  return (
    <div className="page">
      <div className="page-header">
        <div className="eyebrow">
          <ShieldCheck size={16} />
          Identity check
        </div>
        <h1 className="section-title">
          Voter authentication
        </h1>
        <p className="section-subtitle">
          Sign in with your voter account to access the secure ballot interface.
        </p>
      </div>

      <div className="card form-card">
        {showLogin2FA ? (
          <form className="form-grid" onSubmit={handleLogin2FASubmit}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                Enter 6-digit verification code sent to your email (or Demo OTP: <strong>123456</strong>).
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Verification OTP</label>
              <div className="input-wrap">
                <KeyRound size={16} />
                <input
                  className="input"
                  type="text"
                  placeholder="Enter 6-digit code (e.g. 123456)"
                  maxLength={6}
                  value={login2FAOtp}
                  onChange={(e) => setLogin2FAOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
            </div>

            <div className="form-actions" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                className={`button${loginLoading ? " is-loading" : ""}`}
                type="submit"
                disabled={loginLoading}
                style={{ flex: 1 }}
              >
                {loginLoading ? "Verifying..." : "Verify & Login"}
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={loginLoading}
                onClick={() => setShowLogin2FA(false)}
                style={{ flex: 1 }}
              >
                Back to Login
              </button>
            </div>
          </form>
        ) : (
          <form className="form-grid" onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label">Email or CNIC</label>
              <div className="input-wrap">
                <IdCard size={16} />
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Enter email or 13-digit CNIC"
                  value={loginForm.identifier} 
                  onChange={e => setLoginForm(p => ({ ...p, identifier: e.target.value }))} 
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
                  placeholder="Enter password"
                  value={loginForm.password} 
                  onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))} 
                  required 
                />
              </div>
            </div>

            <div className="form-actions" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
              <button 
                className={`button${loginLoading ? " is-loading" : ""}`} 
                type="submit"
                disabled={loginLoading}
                style={{ flex: 1 }}
              >
                {loginLoading ? "Signing in..." : "Enter Voting Booth"}
              </button>
              <button 
                className="button secondary" 
                type="button"
                onClick={() => navigate("/activate")}
                style={{ flex: 1 }}
              >
                Activate Account
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default VotePage;
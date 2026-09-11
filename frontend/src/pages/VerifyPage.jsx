import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { BadgeCheck, ShieldCheck, Search, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";

import API from "../api";
import { useLang } from "../context/LangContext";


function VerifyPage() {
  const { t } = useLang();
  const speak = () => {};
  // Speak page intro on load
  useEffect(() => {
    setTimeout(() => speak(t.verifyTitle + ". " + t.verifySubtitle), 500);
  }, [t]);

  const location = useLocation();

  const [receipt, setReceipt] = useState("");

  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);

  const [autoVerify, setAutoVerify] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const codeFromUrl = params.get("code");
    const incomingReceipt = location.state?.receiptCode || codeFromUrl;

    if (incomingReceipt && !receipt) {
      setReceipt(incomingReceipt);
      if (codeFromUrl) {
        setAutoVerify(true);
      }
    }
  }, [location.search, location.state, receipt]);

  useEffect(() => {
    if (autoVerify && receipt) {
      verifyVote();
      setAutoVerify(false);
    }
  }, [autoVerify, receipt]);


  const verifyVote = async () => {
    try {
      setLoading(true);
      const response = await API.post("/verify-receipt", { receipt_code: receipt });
      setResult(response.data);
    } catch (error) {
      console.log(error);
      toast.error("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="section-title">{t.verifyTitle}</h1>
      </div>

      <div className="card form-card">
        <div className="form-group">
          <label className="form-label">{t.receiptCode}</label>
          <div className="input-wrap">
            <Search size={16} />
            <input
              type="text"
              className="input"
              placeholder="RCPT-XXXXXXXX"
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
            />
          </div>
        </div>

        <button
          className={"button" + (loading ? " is-loading" : "")}
          onClick={verifyVote}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Verifying...
            </>
          ) : (
            t.verifyBtn
          )}
        </button>

        {result && (
          <div className="card result-card" style={{ marginTop: '24px' }}>
            {result.verification_status === "VERIFIED" ? (
              <>
                <div className="result-header">
                  <ShieldCheck size={18} color="green" />
                  <h2>Vote Verified</h2>
                </div>

                <p>
                  Your vote has been successfully recorded and its cryptographic integrity has been fully verified across all systems.
                </p>

                <div className="receipt-box">{receipt}</div>

                <div className="result-meta" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {result.receipt_found ? <CheckCircle size={16} color="green" /> : <XCircle size={16} color="red" />}
                    <span>Paper Trail Receipt Verified</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {result.hash_valid ? <CheckCircle size={16} color="green" /> : <XCircle size={16} color="red" />}
                    <span>Cryptographic Hash Verified</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {result.blockchain_valid ? <CheckCircle size={16} color="green" /> : <XCircle size={16} color="red" />}
                    <span>Blockchain Ledger Verified</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {result.district_sync_valid ? <CheckCircle size={16} color="green" /> : <XCircle size={16} color="red" />}
                    <span>District Synchronization Verified</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="result-header error">
                  <ShieldCheck size={18} />
                  <h2>{result.verification_status || t.receiptNotFound}</h2>
                </div>

                <p>
                  We were unable to fully verify this receipt code across all security layers.
                </p>
                
                <div className="result-meta" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {result.receipt_found ? <CheckCircle size={16} color="green" /> : <XCircle size={16} color="red" />}
                    <span>Paper Trail Receipt Found</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {result.hash_valid ? <CheckCircle size={16} color="green" /> : <XCircle size={16} color="red" />}
                    <span>Cryptographic Hash Valid</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {result.blockchain_valid ? <CheckCircle size={16} color="green" /> : <XCircle size={16} color="red" />}
                    <span>Blockchain Ledger Valid</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {result.district_sync_valid ? <CheckCircle size={16} color="green" /> : <XCircle size={16} color="red" />}
                    <span>District Synchronization Valid</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default VerifyPage;
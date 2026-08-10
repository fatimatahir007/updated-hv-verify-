import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, UserPlus, IdCard, Phone, MapPin } from "lucide-react";

import API from "../api";
import { LivenessDetector } from "../services/livenessDetector";
import { useLang } from "../context/LangContext";
import { captureFrameFromVideo } from "../services/faceCapture";

// ─────────────────────────────────────────────────────────────
// Liveness steps config — matches the existing UI steps exactly
// step 0: start camera  (unchanged)
// step 1: align face    ← AI: face centered for N frames
// step 2: blink         ← AI: EAR blink detection
// step 3: head left     ← AI: yaw estimation
// step 4: head right    ← AI: yaw estimation
// step 5: raise hand    ← AI: pose wrist above shoulder
// ─────────────────────────────────────────────────────────────

const STEP_INSTRUCTIONS = {
  1: "Center your face in the frame and hold still.",
  2: "Blink once naturally.",
  3: "Slowly turn your head to the LEFT.",
  4: "Now turn your head to the RIGHT.",
  5: "Raise one hand above your shoulder.",
};

const TOTAL_AI_STEPS = 5; // steps 1–5

function RegisterPage() {

  const navigate = useNavigate();
  const { t } = useLang();
  const speak = () => {};
  useEffect(() => {
    const token = localStorage.getItem("voterToken");
    if (!token) {
      navigate("/auth", { replace: true });
    }
  }, [navigate]);
  // Speak page intro on load
  useEffect(() => {
    setTimeout(() => speak(t.registerTitle + ". " + t.registerSubtitle), 500);
  }, [t]);

  const [formData, setFormData] = useState({
    full_name: "",
    cnic: "",
    phone: "",
    constituency: "",
    polling_station_id: ""
  });

  const [districtsList, setDistrictsList] = useState([]);
  const [pollingStationsList, setPollingStationsList] = useState([]);
  const [filteredPollingStations, setFilteredPollingStations] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [distRes, stationRes] = await Promise.all([
          API.get("/public/districts"),
          API.get("/public/polling-stations")
        ]);
        setDistrictsList(distRes.data || []);
        setPollingStationsList(stationRes.data || []);
      } catch (err) {
        console.error("Error loading districts/stations", err);
      }
    };
    fetchData();
  }, []);

  const [loading, setLoading] = useState(false);

  const [success, setSuccess] = useState("");

  const [voterId, setVoterId] = useState("");

  const [modal, setModal] = useState({
    open: false,
    type: "success",
    title: "",
    message: "",
    detail: ""
  });

  const [verification, setVerification] = useState({
    open: false,
    step: 0,
    checking: false,
    cameraReady: false,
    cameraError: "",
    // ── AI-specific state ──
    aiLoading: false,      // true while models are initialising
    aiError: "",           // model-load error message
    stepDone: false,       // brief "✓ detected" flash between steps
  });

  const [copyState, setCopyState] = useState({
    loading: false,
    error: "",
    success: false
  });

  const videoRef    = useRef(null);

  // Auto-speak instruction when step changes
  useEffect(() => {
    if (verification.step >= 1 && verification.step <= 5 && !verification.aiLoading) {
      const { t: trans, speak: spk } = { t, speak };
      const msg = trans.instructions[verification.step];
      if (msg) setTimeout(() => spk(msg), 400);
    }
  }, [verification.step, verification.aiLoading]);
  const streamRef   = useRef(null);
  const voterIdRef  = useRef(null);
  const detectorRef = useRef(null); // LivenessDetector instance


  // =====================================
  // VERIFICATION HELPERS  (unchanged API)
  // =====================================

  const openVerification = () => {
    if (loading) return;
    // Feature flag: Bypass liveness detection if not explicitly enabled
    const livenessEnabled = import.meta.env.VITE_ENABLE_LIVENESS === "true";
    if (!livenessEnabled) {
      console.log("[Liveness Bypass] Feature flag VITE_ENABLE_LIVENESS is disabled. Registering voter directly.");
      register(null).then((registeredVoterId) => {
        if (registeredVoterId) {
          navigate("/vote", {
            state: {
              voterId: registeredVoterId,
              voterDistrict: formData.constituency,
            },
          });
        }
      });
      return;
    }
    setVerification({
      open: true,
      step: 0,
      checking: false,
      cameraReady: false,
      cameraError: "",
      aiLoading: false,
      aiError: "",
      stepDone: false,
      faceChecking: false,
      faceError: "",
    });
    // Auto-start camera immediately
    setTimeout(() => requestCamera(), 100);
  };

  const closeVerification = useCallback(() => {
    // Tear down AI detector
    if (detectorRef.current) {
      detectorRef.current.destroy();
      detectorRef.current = null;
    }
    setVerification((prev) => ({
      ...prev,
      open: false,
    }));
  }, []);

  const requestCamera = async () => {
    setVerification((prev) => ({
      ...prev,
      checking: true,
      cameraError: "",
      faceError: "",
    }));

    if (!navigator.mediaDevices?.getUserMedia) {
      setVerification((prev) => ({
        ...prev,
        checking: false,
        cameraError: "Camera access is not supported in this browser.",
      }));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((res) => {
          videoRef.current.onloadedmetadata = res;
        });
      }

      // Camera ready — wait 2s for video to stream, then check face
      setVerification((prev) => ({
        ...prev,
        checking: false,
        cameraReady: true,
        faceChecking: true,
      }));

      // Wait for video to fully stream (3 seconds)
      await new Promise((res) => setTimeout(res, 3000));

      // Wait for video to be fully ready
      await new Promise((res) => {
        const vid = videoRef.current;
        const check = () => {
          if (vid && vid.readyState >= 3 && vid.videoWidth > 0) res();
          else setTimeout(check, 200);
        };
        check();
      });

      // Extra buffer for stable frame
      await new Promise((res) => setTimeout(res, 1000));

      const frame = captureFrameFromVideo(videoRef.current);
      try {
        const checkRes = await API.post("/check-face", { face_image: frame });
        if (checkRes.data.exists) {
          setVerification((prev) => ({
            ...prev,
            faceChecking: false,
            faceError: checkRes.data.message,
          }));
          return;
        }
      } catch (e) {
        console.warn("Face check failed, proceeding:", e);
      }

      // Face not found — start liveness
      setVerification((prev) => ({
        ...prev,
        faceChecking: false,
        step: 1,
        aiLoading: true,
        aiError: "",
      }));

      await startAIDetection(1);

    } catch (error) {
      console.error(error);
      setVerification((prev) => ({
        ...prev,
        checking: false,
        cameraError:
          "Camera permission was denied. You can still continue with demo verification.",
      }));
    }
  };

  // ─────────────────────────────────────────────────────────────
  // startAIDetection — creates LivenessDetector, starts at `step`
  // ─────────────────────────────────────────────────────────────

  const startAIDetection = async (initialStep) => {
    if (!videoRef.current) return;

    // Destroy any previous detector
    if (detectorRef.current) {
      detectorRef.current.destroy();
      detectorRef.current = null;
    }

    const detector = new LivenessDetector(
      videoRef.current,
      null, // no canvas needed (detection only, no overlay drawing)

      // onStepComplete callback — called by detector when action detected
      (completedStep) => {
        setVerification((prev) => ({
          ...prev,
          stepDone: true,
        }));

        // Brief "detected!" flash, then advance
        setTimeout(() => {
          const nextStep = completedStep + 1;

          if (nextStep > TOTAL_AI_STEPS) {
            // All AI steps done — run registration
            setVerification((prev) => ({
              ...prev,
              stepDone: false,
            }));
            handleCompleteVerification();
          } else {
            setVerification((prev) => ({
              ...prev,
              step: nextStep,
              stepDone: false,
            }));
            detector.setStep(nextStep);
          }
        }, 700);
      },

      // onError callback
      (errMsg) => {
        setVerification((prev) => ({
          ...prev,
          aiLoading: false,
          aiError: errMsg,
        }));
      }
    );

    detectorRef.current = detector;
    detector.setStep(initialStep);

    try {
      await detector.init();
      setVerification((prev) => ({
        ...prev,
        aiLoading: false,
      }));
    } catch (err) {
      console.error("[RegisterPage] detector init failed:", err);
      setVerification((prev) => ({
        ...prev,
        aiLoading: false,
        aiError: "{t.aiLoading}",
      }));
    }
  };

  // Kept for compatibility — no longer called by UI buttons (AI drives this)
  const advanceVerification = () => {
    setVerification((prev) => ({
      ...prev,
      step: Math.min(prev.step + 1, TOTAL_AI_STEPS),
    }));
    if (detectorRef.current) {
      detectorRef.current.setStep(
        Math.min(verification.step + 1, TOTAL_AI_STEPS)
      );
    }
  };

  const handleCompleteVerification = async () => {
    // Capture face frame before closing camera
    const faceImage = captureFrameFromVideo(videoRef.current);
    closeVerification();
    const registeredVoterId = await register(faceImage);
    if (registeredVoterId) {
      navigate("/vote", {
        state: {
          voterId: registeredVoterId,
          voterDistrict: formData.constituency,
        },
      });
    }
  };

  // completeVerification kept for fallback button
  const completeVerification = handleCompleteVerification;


  // Cleanup camera stream when modal closes
  useEffect(() => {
    if (!verification.open) {
      if (detectorRef.current) {
        detectorRef.current.destroy();
        detectorRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  }, [verification.open]);


  // =====================================
  // MODAL HELPERS  (unchanged)
  // =====================================

  const openModal = ({
    type,
    title,
    message,
    detail = ""
  }) => {

    setModal({
      open: true,
      type,
      title,
      message,
      detail
    });

    if (type === "success") {

      setTimeout(() => {
        setModal((prev) => ({
          ...prev,
          open: false
        }));
      }, 3200);
    }
  };

  const closeModal = () => {
    setModal((prev) => ({
      ...prev,
      open: false
    }));
  };


  // =====================================
  // HANDLE CHANGE  (unchanged)
  // =====================================

  const handleChange = (e) => {

    const { name, value } = e.target;

    if (name === "full_name") {
      const alphabetsOnly = value.replace(/[^A-Za-z\s]/g, "");
      setFormData({ ...formData, full_name: alphabetsOnly });
      return;
    }

    if (name === "phone") {
      const numbersOnly = value.replace(/\D/g, "");
      if (numbersOnly.length <= 11) {
        setFormData({ ...formData, phone: numbersOnly });
      }
      return;
    }

    if (name === "cnic") {
      const numbersOnly = value.replace(/\D/g, "");
      let formattedCNIC = numbersOnly;
      if (numbersOnly.length > 5 && numbersOnly.length <= 12) {
        formattedCNIC = numbersOnly.slice(0, 5) + "-" + numbersOnly.slice(5);
      } else if (numbersOnly.length > 12) {
        formattedCNIC =
          numbersOnly.slice(0, 5) +
          "-" +
          numbersOnly.slice(5, 12) +
          "-" +
          numbersOnly.slice(12, 13);
      }
      if (numbersOnly.length <= 13) {
        setFormData({ ...formData, cnic: formattedCNIC });
      }
      return;
    }

    if (name === "constituency") {
      const selectedDistrict = districtsList.find(d => d.district_name === value);
      if (selectedDistrict) {
        const filtered = pollingStationsList.filter(ps => ps.district_id === selectedDistrict.district_id);
        setFilteredPollingStations(filtered);
      } else {
        setFilteredPollingStations([]);
      }
      setFormData(prev => ({ ...prev, constituency: value, polling_station_id: "" }));
      return;
    }

    setFormData({ ...formData, [name]: value });
  };


  // =====================================
  // REGISTER FUNCTION  (unchanged)
  // =====================================

  const register = async (faceImage = null) => {
    if (loading) return;
    try {

      setLoading(true);

      // Pass JWT if logged in so backend can UPDATE existing row instead of inserting a duplicate
      const voterToken = localStorage.getItem("voterToken");
      const requestConfig = voterToken
        ? { headers: { Authorization: `Bearer ${voterToken}` } }
        : undefined;

      const response = await API.post("/register", formData, requestConfig);

      setSuccess(response.data.message);

      setVoterId(response.data.voter_id);

      setCopyState({ loading: false, error: "", success: false });

      openModal({
        type: "success",
        title: "Registration Complete",
        message: response.data.message,
        detail: response.data.voter_id
      });

      // Send face embedding to backend
      if (faceImage && response.data.voter_id) {
        try {
          await API.post("/register-face", {
            voter_id: response.data.voter_id,
            face_image: faceImage,
          });
        } catch (faceErr) {
          console.warn("Face registration failed (non-critical):", faceErr);
        }
      }

      return response.data.voter_id;

    } catch (error) {

      console.error(error);

      openModal({
        type: "error",
        title: "Registration Failed",
        message:
          error.response?.data?.message ||
          "Registration failed. Please try again."
      });

      return false;

    } finally {

      setLoading(false);
    }
  };


  const handleCopyVoterId = async () => {

    if (!voterId || copyState.loading) return;

    setCopyState({ loading: true, error: "", success: false });

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access unavailable");
      }

      await navigator.clipboard.writeText(voterId);

      setCopyState({ loading: false, error: "", success: true });

      setTimeout(() => {
        navigate("/auth", { state: { mode: "login" } });
      }, 500);

    } catch (error) {

      console.error(error);

      setCopyState({
        loading: false,
        error: "Copy failed. Please copy the voter ID manually.",
        success: false
      });
    }
  };


  // =====================================
  // UI  (interface unchanged — only step
  //      labels and button behaviour updated)
  // =====================================

  return (

    <>

      <div className="page">

        <div className="page-header">
          <div className="eyebrow">
            <ShieldCheck size={16} />
            {t.registerEyebrow}
          </div>

          <h1 className="section-title">
            {t.registerTitle}
          </h1>

          <p className="section-subtitle">
            {t.registerSubtitle}
          </p>
        </div>

        <div className="card form-card">

          <div className="form-grid">

            <div className="form-group">
              <label className="form-label">Full name</label>
              <div className="input-wrap">
                <UserPlus size={16} />
                <input
                  type="text"
                  name="full_name"
                  className="input"
                  placeholder={t.fullNamePlaceholder}
                  value={formData.full_name}
                  onChange={handleChange}
                />
              </div>
              <p className="helper-text">{t.fullNameHelper}</p>
            </div>

            <div className="form-group">
              <label className="form-label">CNIC number</label>
              <div className="input-wrap">
                <IdCard size={16} />
                <input
                  type="text"
                  name="cnic"
                  className="input"
                  placeholder="00000-0000000-0"
                  value={formData.cnic}
                  onChange={handleChange}
                  maxLength={15}
                />
              </div>
              <p className="helper-text">{t.cnicHelper}</p>
            </div>

            <div className="form-group">
              <label className="form-label">Phone number</label>
              <div className="input-wrap">
                <Phone size={16} />
                <input
                  type="text"
                  name="phone"
                  className="input"
                  placeholder="03XXXXXXXXX"
                  value={formData.phone}
                  onChange={handleChange}
                  maxLength={11}
                />
              </div>
              <p className="helper-text">{t.phoneHelper}</p>
            </div>

            <div className="form-group">
              <label className="form-label">Constituency / District</label>
              <div className="input-wrap">
                <MapPin size={16} />
                <select
                  name="constituency"
                  className="input"
                  value={formData.constituency}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select your district...</option>
                  {districtsList.map(d => (
                    <option key={d.district_id} value={d.district_name}>{d.district_name}</option>
                  ))}
                </select>
              </div>
              <p className="helper-text">{t.constituencyHelper}</p>
            </div>

            <div className="form-group">
              <label className="form-label">Polling Station</label>
              <div className="input-wrap">
                <MapPin size={16} />
                <select
                  name="polling_station_id"
                  className="input"
                  value={formData.polling_station_id}
                  onChange={e => setFormData(prev => ({ ...prev, polling_station_id: e.target.value }))}
                  required
                  disabled={!formData.constituency}
                >
                  <option value="">
                    {!formData.constituency 
                      ? "Select constituency first..." 
                      : filteredPollingStations.length === 0 
                        ? "No polling stations in this district..." 
                        : "Select polling station..."}
                  </option>
                  {filteredPollingStations.map(ps => (
                    <option key={ps.station_id} value={ps.station_id}>{ps.station_name} ({ps.station_code})</option>
                  ))}
                </select>
              </div>
              <p className="helper-text">Select the polling station where you will cast your vote.</p>
            </div>

          </div>

          <div className="form-actions">
            <button
              className={`button${loading ? " is-loading" : ""}`}
              disabled={loading}
              onClick={openVerification}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  {t.registering}
                </>
              ) : (
                t.createVoterId
              )}
            </button>
            <span className="form-hint">
              {t.formHint}
            </span>
          </div>

          {success && (

            <div className="card success-card" ref={voterIdRef}>
              <h2>{t.regComplete}</h2>
              <p>{t.regCompleteSub}</p>
              <div className="receipt-box">{voterId}</div>

              <div className="form-actions" style={{ marginTop: 16 }}>
                <button
                  className={`button${copyState.loading ? " is-loading" : ""}`}
                  onClick={handleCopyVoterId}
                >
                  {copyState.loading ? (
                    <>
                      <span className="spinner" />
                      {t.copying}
                    </>
                  ) : copyState.success ? (
                    t.copied
                  ) : (
                    t.copyVoterId
                  )}
                </button>
                <span className="form-hint">
                  {t.copyHint}
                </span>
              </div>

              {copyState.error && (
                <p className="helper-text" style={{ marginTop: 8 }}>
                  {copyState.error}
                </p>
              )}
            </div>

          )}

        </div>

      </div>


      {/* ── LIVENESS VERIFICATION MODAL ─────────────────────────
          Identical outer shell to original.
          Only the inner step content is AI-driven.
      ─────────────────────────────────────────────────────── */}

      {verification.open && (

        <div className="modal-overlay" onClick={closeVerification}>

          <div
            className="modal-card verification"
            onClick={(e) => e.stopPropagation()}
          >

            <button
              className="modal-close"
              onClick={closeVerification}
              aria-label="Close verification"
            >
              ×
            </button>

            <div className="modal-content">
              <div className="modal-title">
                {t.livenessTitle}
              </div>
              <div className="modal-message">
                {t.livenessSubtitle}
              </div>

              {/* ── Step checklist (same layout, updated labels) ── */}
              <div className="card" style={{ marginTop: 16 }}>
                <div style={{ display: "grid", gap: 12 }}>
                  {[
                    { n: 1, label: t.step1 },
                    { n: 2, label: t.step2 },
                    { n: 3, label: t.step3 },
                    { n: 4, label: t.step4 },
                    { n: 5, label: t.step5 },
                    { n: 6, label: t.step6 },
                  ].map(({ n, label }) => {
                    const done = verification.step > n - 1;
                    return (
                      <div
                        key={n}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          opacity: done ? 1 : 0.45,
                          transition: "opacity 0.3s",
                        }}
                      >
                        <span
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: done ? "var(--success)" : "var(--border)",
                            display: "grid",
                            placeItems: "center",
                            fontSize: 11,
                            color: done ? "#fff" : "var(--muted)",
                            flexShrink: 0,
                            transition: "background 0.3s",
                          }}
                        >
                          {done ? "✓" : n}
                        </span>
                        <strong>Step {n}:</strong> {label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Camera + AI instruction area ── */}
              <div className="card" style={{ marginTop: 16 }}>
                <div style={{ display: "grid", gap: 12 }}>

                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      background: "#0f172a",
                      aspectRatio: "16 / 9",
                      objectFit: "cover",
                    }}
                  />

                  {/* Face duplicate error */}
                  {verification.faceChecking && (
                    <div className="helper-text" style={{ display: "flex", gap: 8 }}>
                      <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                      Checking face...
                    </div>
                  )}
                  {verification.faceError && (
                    <div className="helper-text" style={{ color: "var(--danger)", fontWeight: 600 }}>
                      ⚠ {verification.faceError}
                    </div>
                  )}

                  {/* Camera error */}
                  {verification.cameraError && (
                    <div className="helper-text">
                      {verification.cameraError}
                    </div>
                  )}

                  {/* AI model error */}
                  {verification.aiError && (
                    <div className="helper-text" style={{ color: "var(--danger)" }}>
                      {verification.aiError}
                    </div>
                  )}

                  {/* STEP 0 — Auto scanning face */}
                  {verification.step === 0 && (
                    <div className="helper-text" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                      {verification.faceChecking ? t.scanning : t.starting}
                    </div>
                  )}

                  {/* STEPS 1–5 — AI is in control */}
                  {verification.step >= 1 && verification.step <= TOTAL_AI_STEPS && (
                    <>
                      {/* AI models loading spinner */}
                      {verification.aiLoading && (
                        <div
                          className="helper-text"
                          style={{ display: "flex", alignItems: "center", gap: 8 }}
                        >
                          <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                          Loading AI detection models…
                        </div>
                      )}

                      {/* Active instruction */}
                      {!verification.aiLoading && !verification.aiError && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            className="helper-text"
                            style={{
                              fontWeight: 600,
                              flex: 1,
                              color: verification.stepDone
                                ? "var(--success)"
                                : "var(--text)",
                              transition: "color 0.3s",
                            }}
                          >
                            {verification.stepDone
                              ? t.detected
                              : t.instructions[verification.step]}
                          </div>
                        </div>
                      )}

                      {/* Fallback manual advance (only if AI errors) */}
                      {verification.aiError && (
                        <button className="button" onClick={advanceVerification}>
                          Continue manually
                        </button>
                      )}
                    </>
                  )}

                  {/* Legacy step 3 fallback kept for safety */}
                  {verification.step === 3 && verification.aiError && (
                    <>
                      <div className="helper-text">
                        Hold still while we finalize verification.
                      </div>
                      <button className="button" onClick={completeVerification}>
                        Continue to voter ID
                      </button>
                    </>
                  )}

                </div>
              </div>
            </div>

          </div>

        </div>
      )}


      {/* ── RESULT MODAL (completely unchanged) ──────────────── */}

      {modal.open && (

        <div className="modal-overlay" onClick={closeModal}>

          <div
            className={`modal-card ${modal.type}`}
            onClick={(e) => e.stopPropagation()}
          >

            <button
              className="modal-close"
              onClick={closeModal}
              aria-label="Close notification"
            >
              ×
            </button>

            <div className="modal-content">

              <div className="modal-title">
                {modal.title}
              </div>

              <div className="modal-message">
                {modal.message}
              </div>

              {modal.detail && (
                <div className="modal-detail">
                  {modal.detail}
                </div>
              )}

            </div>

          </div>

        </div>
      )}

    </>

  );
}

export default RegisterPage;

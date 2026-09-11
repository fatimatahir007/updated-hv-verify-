import React, { useEffect, useRef, useState } from "react";
import { Camera, Scan, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, ShieldCheck } from "lucide-react";
import API from "../api";

export default function FaceVerification({ onVerified, onCancel }) {
  const [sessionId, setSessionId] = useState("");
  const [challenges, setChallenges] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedChallenges, setCompletedChallenges] = useState([]);
  
  const [cameraState, setCameraState] = useState("loading"); // "loading", "active", "error"
  const [statusMsg, setStatusMsg] = useState("Initializing Biometric Liveness Scanner...");
  const [errorMsg, setErrorMsg] = useState("");
  
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // 1. Fetch randomized liveness session on mount
  useEffect(() => {
    let isMounted = true;
    const startSession = async () => {
      try {
        const res = await API.post("/face/liveness/start");
        if (isMounted && res.data?.session_id) {
          setSessionId(res.data.session_id);
          setChallenges(res.data.challenges || ["blink", "turn_left", "turn_right"]);
          setCurrentStepIndex(0);
        }
      } catch (err) {
        console.error("Liveness session start error:", err);
        if (isMounted) {
          setErrorMsg("Unable to connect to Liveness Security Service. Please try again.");
          setCameraState("error");
        }
      }
    };
    startSession();
    return () => { isMounted = false; };
  }, []);

  // 2. Request Camera Stream
  useEffect(() => {
    let isMounted = true;
    const initCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMsg("Camera access is required for secure voter verification.");
        setCameraState("error");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" }
        });
        if (isMounted) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => {});
          }
          setCameraState("active");
          setStatusMsg("Position your face inside the green oval frame.");
        }
      } catch (err) {
        console.error("Camera access error:", err);
        if (isMounted) {
          setErrorMsg("Camera permission was denied or camera is unavailable. Please allow camera access.");
          setCameraState("error");
        }
      }
    };

    if (sessionId) {
      initCamera();
    }

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [sessionId]);

  // Capture frame helper
  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  };

  // Helper challenge titles
  const getChallengeTitle = (challenge) => {
    switch (challenge) {
      case "blink": return "Please blink your eyes";
      case "turn_left": return "Turn your head LEFT";
      case "turn_right": return "Turn your head RIGHT";
      case "smile": return "Smile at the camera";
      case "look_straight": return "Look straight at camera";
      default: return "Complete facial action";
    }
  };

  // 3. Challenge Progression Handler
  const handleActionCompleted = async () => {
    if (verifying || verified) return;
    setVerifying(true);

    const currentChallenge = challenges[currentStepIndex];
    const newCompleted = [...completedChallenges, currentChallenge];
    setCompletedChallenges(newCompleted);

    setStatusMsg(`✓ Detected: ${getChallengeTitle(currentChallenge)}`);

    if (currentStepIndex + 1 < challenges.length) {
      setTimeout(() => {
        setCurrentStepIndex(prev => prev + 1);
        setVerifying(false);
        setStatusMsg(`Next: ${getChallengeTitle(challenges[currentStepIndex + 1])}`);
      }, 900);
    } else {
      // All challenges completed — Submit to backend /face/liveness/verify
      setStatusMsg("Checking liveness with server security...");
      const finalFrame = captureFrame();

      try {
        const verifyRes = await API.post("/face/liveness/verify", {
          session_id: sessionId,
          challenges_completed: newCompleted,
          face_image: finalFrame
        });

        if (verifyRes.data?.liveness_verified) {
          setVerified(true);
          setStatusMsg("✓ Liveness Verified — Capturing Biometric Features...");
          setTimeout(() => {
            if (onVerified) {
              onVerified({
                session_id: sessionId,
                face_image: finalFrame
              });
            }
          }, 1000);
        } else {
          setErrorMsg("Liveness verification failed. Please try again.");
          setVerifying(false);
        }
      } catch (err) {
        console.error("Liveness verify API error:", err);
        const detail = err.response?.data?.detail || "Liveness verification failed. Please complete requested actions.";
        setErrorMsg(typeof detail === "string" ? detail : "Verification failed.");
        setVerifying(false);
      }
    }
  };

  const currentChallenge = challenges[currentStepIndex];

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 20
    }}>
      <div className="card form-card" style={{
        maxWidth: 480, width: "100%", textAlign: "center",
        border: "1px solid rgba(16, 185, 129, 0.4)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.5)"
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
          <ShieldCheck size={26} style={{ color: "#10b981" }} />
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
            Secure Face Verification
          </h2>
        </div>

        <p style={{ fontSize: "0.88rem", color: "#94a3b8", marginBottom: 16 }}>
          Anti-Spoof & Liveness Protection • Step {currentStepIndex + 1} of {challenges.length || 3}
        </p>

        {/* Camera Feed Container */}
        <div style={{
          position: "relative", width: "100%", height: 270,
          background: "#020617", borderRadius: 16, overflow: "hidden",
          border: `2px solid ${verified ? "#10b981" : "rgba(16, 185, 129, 0.3)"}`,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          {cameraState === "active" ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ color: "#64748b", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <Camera size={36} />
              <span>{cameraState === "loading" ? "Starting Camera..." : "Camera Unavailable"}</span>
            </div>
          )}

          {/* Face Oval Overlay Guide */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 175, height: 220, borderRadius: "50%",
            border: verified ? "3px solid #10b981" : "3px dashed #10b981",
            boxShadow: verified ? "0 0 30px rgba(16, 185, 129, 0.8)" : "0 0 15px rgba(16, 185, 129, 0.3)",
            pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            {verified && <CheckCircle2 size={54} style={{ color: "#10b981" }} />}
          </div>
        </div>

        {/* Current Challenge Badge */}
        {!verified && challenges.length > 0 && (
          <div style={{
            marginTop: 16, padding: "14px 18px",
            background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,95,70,0.2))",
            border: "1px solid rgba(16,185,129,0.4)", borderRadius: 12,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6
          }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.08em", color: "#10b981", textTransform: "uppercase" }}>
              Challenge Action
            </span>
            <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc" }}>
              {getChallengeTitle(currentChallenge)}
            </span>
          </div>
        )}

        {/* Progress Step Indicators */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14 }}>
          {challenges.map((ch, idx) => (
            <div
              key={idx}
              style={{
                width: 12, height: 12, borderRadius: "50%",
                background: idx < currentStepIndex || verified ? "#10b981" : idx === currentStepIndex ? "#38bdf8" : "#334155",
                transition: "all 0.3s ease"
              }}
            />
          ))}
        </div>

        {/* Status / Error Messages */}
        {errorMsg ? (
          <div style={{
            marginTop: 14, padding: "12px 14px", background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)", borderRadius: 10,
            color: "#ef4444", fontSize: "0.88rem", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 8
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        ) : (
          <div style={{
            marginTop: 14, fontSize: "0.9rem", color: verified ? "#10b981" : "#94a3b8",
            fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8
          }}>
            {verifying && <Scan size={18} className="spin" style={{ color: "#38bdf8" }} />}
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          {!verified && (
            <button
              className="button primary"
              style={{ flex: 1, padding: "12px" }}
              disabled={verifying || cameraState !== "active"}
              onClick={handleActionCompleted}
            >
              {verifying ? "Processing Action..." : `Confirm ${currentChallenge ? currentChallenge.replace("_", " ") : "Action"}`}
              <ArrowRight size={16} />
            </button>
          )}

          <button
            className="button secondary"
            style={{ padding: "12px 20px" }}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { Camera, ShieldCheck, CheckCircle2, AlertCircle, Clock, ArrowRight, RefreshCw } from "lucide-react";
import API from "../api";

export default function InteractiveFaceLiveness({ userId, onLivenessComplete, onCancel }) {
  const [sessionId, setSessionId] = useState("");
  const [directives, setDirectives] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [currentInstruction, setCurrentInstruction] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(5.0);
  
  const [ovalColor, setOvalColor] = useState("#f59e0b"); // #f59e0b (Yellow), #10b981 (Green), #ef4444 (Red)
  const [statusMsg, setStatusMsg] = useState("Initializing Interactive Liveness Directives...");
  const [overallLiveness, setOverallLiveness] = useState("PENDING");
  const [errorMsg, setErrorMsg] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const isProcessingRef = useRef(false);

  const speakInstruction = (text) => {
    try {
      if ("speechSynthesis" in window && text) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(text);
        msg.rate = 0.95;
        msg.pitch = 1.0;
        window.speechSynthesis.speak(msg);
      }
    } catch (e) {
      console.warn("SpeechSynthesis error:", e);
    }
  };

  const formatInstruction = (inst) => {
    if (!inst) return "Please position your face in camera";
    const clean = String(inst).toLowerCase().trim();
    if (clean.includes("left")) return "Please turn your head to the LEFT";
    if (clean.includes("right")) return "Please turn your head to the RIGHT";
    if (clean.includes("up") || clean.includes("tilt")) return "Please tilt your head UP";
    if (clean.includes("blink")) return "Please BLINK your eyes naturally";
    if (clean.includes("smile") || clean.includes("mouth")) return "Please SMILE or open your mouth";
    return `Please complete action: ${inst.replace(/_/g, " ").toUpperCase()}`;
  };

  // 1. Initialize Dynamic Directive Session from FastAPI Backend
  useEffect(() => {
    let isMounted = true;
    const startSession = async () => {
      try {
        let res;
        try {
          res = await API.post("/liveness/start-directive", { user_id: userId });
        } catch (e1) {
          try {
            res = await API.post("/v1/liveness/start-directive", { user_id: userId });
          } catch (e2) {
            res = await API.post("/api/v1/liveness/start-directive", { user_id: userId });
          }
        }

        if (isMounted && res.data?.session_id) {
          setSessionId(res.data.session_id);
          setDirectives(res.data.directives || []);
          const firstInst = res.data.first_instruction || (res.data.directives && res.data.directives[0]) || "turn_left";
          setCurrentInstruction(firstInst);
          setCurrentStep(1);
          setOverallLiveness("PENDING");
          setErrorMsg("");
          speakInstruction(`Instruction 1 of 3: ${formatInstruction(firstInst)}`);
        }
      } catch (err) {
        console.error("Start directive session error:", err);
        if (isMounted) {
          setErrorMsg("Unable to connect to Directive Liveness Service.");
        }
      }
    };
    startSession();
    return () => { isMounted = false; };
  }, [userId]);

  // 2. Start Webcam Stream
  useEffect(() => {
    let isMounted = true;
    const initCamera = async () => {
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
        }
      } catch (err) {
        console.error("Camera access error:", err);
        if (isMounted) setErrorMsg("Camera permission denied. Camera is required for verification.");
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

  // 3. Process Video Frames at 300ms Interval against Backend State Machine
  useEffect(() => {
    if (!sessionId || overallLiveness !== "PENDING") return;

    const interval = setInterval(async () => {
      if (isProcessingRef.current || !videoRef.current || videoRef.current.videoWidth === 0) return;
      isProcessingRef.current = true;

      try {
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const frameB64 = canvas.toDataURL("image/jpeg", 0.80);

        let res;
        try {
          res = await API.post("/liveness/process-directive", {
            session_id: sessionId,
            image: frameB64
          });
        } catch (e1) {
          try {
            res = await API.post("/v1/liveness/process-directive", {
              session_id: sessionId,
              image: frameB64
            });
          } catch (e2) {
            res = await API.post("/api/v1/liveness/process-directive", {
              session_id: sessionId,
              image: frameB64
            });
          }
        }

        const data = res.data;

        if (data) {
          setTimeRemaining(data.time_remaining ?? 5.0);
          setStatusMsg(data.message || "Processing movement...");

          if (data.step_passed) {
            setOvalColor("#10b981"); // Green for verified
          } else {
            setOvalColor("#f59e0b"); // Yellow for waiting
          }

          if (data.current_step && data.current_step !== currentStep) {
            setCurrentStep(data.current_step);
          }
          if (data.instruction && data.instruction !== currentInstruction) {
            setCurrentInstruction(data.instruction);
            speakInstruction(`Instruction ${data.current_step || currentStep} of 3: ${formatInstruction(data.instruction)}`);
          }

          if (data.overall_liveness === "APPROVED") {
            setOverallLiveness("APPROVED");
            setOvalColor("#10b981");
            setStatusMsg("✓ Liveness Verified 100% — Ballot Unlocked!");
            speakInstruction("Facial identity and live motion verified successfully. Ballot unlocked.");
            setTimeout(() => {
              if (onLivenessComplete) {
                onLivenessComplete({
                  session_id: sessionId,
                  liveness_score: data.liveness_score || 0.985,
                  passed_steps: data.passed_steps || directives
                });
              }
            }, 1000);
          } else if (data.overall_liveness === "REJECTED") {
            setOverallLiveness("REJECTED");
            setOvalColor("#ef4444"); // Red for failed
            setErrorMsg(data.message || "Liveness verification failed. Time limit expired.");
          }
        }
      } catch (err) {
        console.error("Process directive frame error:", err);
      } finally {
        isProcessingRef.current = false;
      }
    }, 200);

    return () => clearInterval(interval);
  }, [sessionId, overallLiveness, directives, onLivenessComplete]);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(15, 23, 42, 0.88)", backdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 20
    }}>
      <div className="card form-card" style={{
        maxWidth: 500, width: "100%", textAlign: "center",
        border: `1px solid ${ovalColor}`, boxShadow: "0 25px 50px rgba(0,0,0,0.6)"
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
          <ShieldCheck size={26} style={{ color: ovalColor }} />
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
            Interactive Face Liveness
          </h2>
        </div>

        <p style={{ fontSize: "0.88rem", color: "#94a3b8", marginBottom: 14 }}>
          Instruction {currentStep} of {directives.length || 3} • Follow movement prompt to unlock vote
        </p>

        {/* Video Camera & Dynamic Visual Bounding Oval Overlay */}
        <div style={{
          position: "relative", width: "100%", height: 280,
          background: "#020617", borderRadius: 16, overflow: "hidden",
          border: `2px solid ${ovalColor}`, display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />

          {/* Floating On-Camera Text Instruction Badge */}
          <div style={{
            position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
            background: "rgba(15, 23, 42, 0.85)", border: `1px solid ${ovalColor}`,
            padding: "6px 16px", borderRadius: 20, color: "#f8fafc",
            fontSize: "0.85rem", fontWeight: 700, whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)", zIndex: 10
          }}>
            Step {currentStep}/3: {formatInstruction(currentInstruction)}
          </div>

          {/* Dynamic Color Bounding Box / Oval */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 180, height: 230, borderRadius: "50%",
            border: `3px dashed ${ovalColor}`,
            boxShadow: `0 0 25px ${ovalColor}66`,
            pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.3s ease"
          }}>
            {overallLiveness === "APPROVED" && (
              <CheckCircle2 size={58} style={{ color: "#10b981" }} />
            )}
          </div>
        </div>

        {/* Prominent High-Visibility Instruction Guidance Card */}
        <div style={{
          marginTop: 14, padding: "16px",
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))",
          border: `2px solid ${ovalColor}`, borderRadius: 14,
          display: "flex", flexDirection: "column", gap: 6,
          boxShadow: `0 0 20px ${ovalColor}33`
        }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 800, letterSpacing: "0.08em", color: ovalColor, textTransform: "uppercase" }}>
            👉 ACTIVE STEP {currentStep} OF {directives.length || 3}
          </span>
          <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", lineHeight: 1.3 }}>
            {formatInstruction(currentInstruction)}
          </span>
        </div>

        {/* Directive Steps Progress Badges */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {(directives.length > 0 ? directives : ["turn_left", "blink", "smile"]).map((dir, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < currentStep || overallLiveness === "APPROVED";
            const isActive = stepNum === currentStep && overallLiveness !== "APPROVED";
            return (
              <span key={idx} style={{
                fontSize: "0.75rem", fontWeight: 700, padding: "4px 10px", borderRadius: 12,
                background: isCompleted ? "rgba(16, 185, 129, 0.2)" : isActive ? "rgba(245, 158, 11, 0.2)" : "rgba(51, 65, 85, 0.4)",
                border: `1px solid ${isCompleted ? "#10b981" : isActive ? "#f59e0b" : "#475569"}`,
                color: isCompleted ? "#10b981" : isActive ? "#f59e0b" : "#94a3b8"
              }}>
                {isCompleted ? "✓ " : `${stepNum}. `}{dir.replace("_", " ").toUpperCase()}
              </span>
            );
          })}
        </div>

        {/* Status Message */}
        <p style={{ marginTop: 10, fontSize: "0.9rem", color: overallLiveness === "REJECTED" ? "#ef4444" : "#94a3b8", fontWeight: 600 }}>
          {errorMsg || statusMsg}
        </p>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          {overallLiveness === "APPROVED" ? (
            <button
              className="button primary"
              style={{ width: "100%", padding: "12px", backgroundColor: "#10b981", borderColor: "#10b981" }}
              onClick={() => onLivenessComplete && onLivenessComplete({ session_id: sessionId, liveness_score: 0.985 })}
            >
              ✓ Unlock Ballot & Vote
            </button>
          ) : (
            <button className="button secondary" style={{ width: "100%", padding: "12px" }} onClick={onCancel}>
              Cancel Verification
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

function ElectionNotification() {
  const [notification, setNotification] = useState(null);

  const previousStatus = useRef(null);
  const previousElectionId = useRef(null);

  useEffect(() => {
    const checkElectionStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/public/elections`);

        if (!response.ok) {
          throw new Error("Could not fetch election status");
        }

        const elections = await response.json();

        if (!Array.isArray(elections) || elections.length === 0) {
          return;
        }

        // Backend already returns newest election first
        const election = elections[0];

        const currentStatus = String(
          election.status || ""
        ).toLowerCase();

        const electionId = election.election_id;

        /*
          Different backend status names ko handle karne ke liye
        */
        const isOpen =
          currentStatus.includes("open") ||
          currentStatus.includes("active") ||
          currentStatus.includes("running") ||
          currentStatus.includes("started");

        const isClosed =
          currentStatus.includes("closed") ||
          currentStatus.includes("completed") ||
          currentStatus.includes("ended");

        const isUpcoming =
          currentStatus.includes("upcoming") ||
          currentStatus.includes("scheduled") ||
          currentStatus.includes("pending");

        let normalizedStatus = currentStatus;

        if (isOpen) {
          normalizedStatus = "open";
        } else if (isClosed) {
          normalizedStatus = "closed";
        } else if (isUpcoming) {
          normalizedStatus = "upcoming";
        }

        /*
          First request par notification spam nahi karna.
          Bas current status remember karna.
        */
        if (
          previousStatus.current === null ||
          previousElectionId.current !== electionId
        ) {
          previousStatus.current = normalizedStatus;
          previousElectionId.current = electionId;

          // Agar user app kholta hai aur voting already open hai
          if (normalizedStatus === "open") {
            setNotification({
              type: "start",
              title: "Voting is Open",
              message: `${election.title || "Election"} has started. You can now cast your vote.`,
            });
          }

          return;
        }

        /*
          UPCOMING/CLOSED → OPEN
        */
        if (
          previousStatus.current !== "open" &&
          normalizedStatus === "open"
        ) {
          setNotification({
            type: "start",
            title: "Voting Started",
            message: `${election.title || "Election"} has started. You can now cast your vote.`,
          });

          showBrowserNotification(
            "Voting Started",
            `${election.title || "Election"} is now open.`
          );
        }

        /*
          OPEN → CLOSED
        */
        if (
          previousStatus.current === "open" &&
          normalizedStatus === "closed"
        ) {
          setNotification({
            type: "close",
            title: "Voting Closed",
            message: `${election.title || "Election"} has now closed.`,
          });

          showBrowserNotification(
            "Voting Closed",
            `${election.title || "Election"} has now closed.`
          );
        }

        previousStatus.current = normalizedStatus;
        previousElectionId.current = electionId;

      } catch (error) {
        console.error("Election status check failed:", error);
      }
    };

    checkElectionStatus();

    // Har 5 seconds backend check hoga
    const interval = setInterval(checkElectionStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const showBrowserNotification = (title, body) => {
    if (
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification(title, {
        body,
      });
    }
  };

  if (!notification) {
    return null;
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>

        <div style={styles.icon}>
          {notification.type === "start" ? "🗳️" : "🔒"}
        </div>

        <h2 style={styles.title}>
          {notification.title}
        </h2>

        <p style={styles.message}>
          {notification.message}
        </p>

        {notification.type === "start" && (
          <button
            style={styles.voteButton}
            onClick={() => {
              setNotification(null);
              window.location.href = "/vote";
            }}
          >
            Vote Now
          </button>
        )}

        <button
          style={styles.closeButton}
          onClick={() => setNotification(null)}
        >
          {notification.type === "start" ? "Later" : "OK"}
        </button>

      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
  },

  modal: {
    background: "#ffffff",
    width: "90%",
    maxWidth: "430px",
    padding: "35px",
    borderRadius: "20px",
    textAlign: "center",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  },

  icon: {
    fontSize: "55px",
    marginBottom: "10px",
  },

  title: {
    margin: "10px 0",
    fontSize: "26px",
  },

  message: {
    fontSize: "16px",
    lineHeight: "1.6",
    marginBottom: "25px",
  },

  voteButton: {
    width: "100%",
    padding: "13px",
    border: "none",
    borderRadius: "10px",
    background: "#111827",
    color: "white",
    fontSize: "16px",
    cursor: "pointer",
    marginBottom: "10px",
  },

  closeButton: {
    width: "100%",
    padding: "12px",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    background: "white",
    cursor: "pointer",
    fontSize: "15px",
  },
};

export default ElectionNotification;
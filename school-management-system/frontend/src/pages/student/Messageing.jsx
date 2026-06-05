import React, { useEffect, useState } from "react";
import api from "../../services/api";

const cardStyle = {
  backgroundColor: "#fff",
  borderRadius: "16px",
  border: "1px solid #e5e7eb",
  boxShadow: "0 1px 6px rgba(16,24,40,0.06)",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
  backgroundColor: "#fff",
};

function fmtTime(v) {
  if (!v) return "";
  return new Date(v).toLocaleString();
}

function isImageAttachment(url) {
  const lower = (url || "").toLowerCase();
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".webp")
  );
}

const StudentMessaging = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [threads, setThreads] = useState([]);
  const [activeUserId, setActiveUserId] = useState(null);
  const [messages, setMessages] = useState([]);

  const [messageText, setMessageText] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get("communication/threads/")
      .then((res) => {
        const t = res.data || [];
        setThreads(t);
        if (t.length) setActiveUserId(t[0].user_id);
      })
      .catch(() => setError("Could not load teacher conversations"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeUserId) {
      setMessages([]);
      return;
    }
    api
      .get(`communication/conversation/${activeUserId}/`)
      .then((res) => setMessages(res.data || []))
      .catch(() => setError("Could not load conversation"));
  }, [activeUserId]);

  const activeThread = threads.find((t) => t.user_id === activeUserId) || null;

  const sendMessage = async () => {
    if (!activeUserId) return;
    if (!messageText.trim() && !attachment) return;
    setSending(true);

    try {
      const form = new FormData();
      form.append("content", messageText.trim());
      if (attachment) form.append("attachment", attachment);
      await api.post(`communication/conversation/${activeUserId}/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const [msgRes, threadRes] = await Promise.all([
        api.get(`communication/conversation/${activeUserId}/`),
        api.get("communication/threads/"),
      ]);
      setMessages(msgRes.data || []);
      setThreads(threadRes.data || []);
      setMessageText("");
      setAttachment(null);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "20px", color: "#6b7280", fontWeight: 900 }}>
        Loading messages...
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ ...cardStyle, padding: "16px" }}>
        <h1 style={{ margin: 0 }}>My Doubts / Messages</h1>
        <div
          style={{
            marginTop: 6,
            color: "#6b7280",
            fontWeight: 900,
            fontSize: 13,
          }}
        >
          Send doubts/questions to your assigned teacher.
        </div>
        {error ? (
          <div style={{ marginTop: 8, color: "#b91c1c", fontWeight: 900 }}>
            {error}
          </div>
        ) : null}
      </div>

      <div
        className="rg-sidebar" style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: 12,
        }}
      >
        <div style={{ ...cardStyle, minHeight: "70vh", padding: 10 }}>
          <div style={{ fontWeight: 1000, padding: 6 }}>Teachers</div>
          <div style={{ marginTop: 8 }}>
            {threads.map((t) => (
              <button
                key={t.user_id}
                type="button"
                onClick={() => setActiveUserId(t.user_id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: `1px solid ${t.user_id === activeUserId ? "#2563eb" : "#e5e7eb"}`,
                  backgroundColor:
                    t.user_id === activeUserId ? "#eff6ff" : "#fff",
                  borderRadius: 12,
                  padding: 10,
                  marginBottom: 8,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 6,
                  }}
                >
                  <div style={{ fontWeight: 1000 }}>{t.user_name}</div>
                  {t.unread_count > 0 ? (
                    <span
                      style={{
                        backgroundColor: "#dc2626",
                        color: "#fff",
                        borderRadius: 999,
                        padding: "2px 8px",
                        fontSize: 11,
                        fontWeight: 1000,
                      }}
                    >
                      {t.unread_count}
                    </span>
                  ) : null}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: "#6b7280",
                    fontWeight: 900,
                  }}
                >
                  {t.last_message_preview}
                </div>
              </button>
            ))}
            {threads.length === 0 ? (
              <div style={{ color: "#6b7280", fontWeight: 900, padding: 8 }}>
                No teacher conversation available.
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            ...cardStyle,
            minHeight: "70vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {activeThread ? (
            <>
              <div style={{ padding: 14, borderBottom: "1px solid #eef2f7" }}>
                <div style={{ fontWeight: 1000 }}>{activeThread.user_name}</div>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: 14,
                  overflowY: "auto",
                  backgroundColor: "#fafafa",
                }}
              >
                {messages.map((m) => {
                  const mine = m.sender_role === "student";
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        justifyContent: mine ? "flex-end" : "flex-start",
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "70%",
                          border: `1px solid ${mine ? "#93c5fd" : "#e5e7eb"}`,
                          backgroundColor: mine ? "#eff6ff" : "#fff",
                          borderRadius: 14,
                          padding: "10px 12px",
                        }}
                      >
                        {m.content ? (
                          <div
                            style={{
                              color: "#111827",
                              fontSize: 13,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {m.content}
                          </div>
                        ) : null}
                        {m.attachment_url ? (
                          <div style={{ marginTop: 8 }}>
                            {isImageAttachment(m.attachment_url) ? (
                              <a
                                href={m.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img
                                  src={m.attachment_url}
                                  alt="attachment"
                                  style={{
                                    maxWidth: "220px",
                                    borderRadius: 10,
                                    border: "1px solid #e5e7eb",
                                  }}
                                />
                              </a>
                            ) : (
                              <a
                                href={m.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  color: "#2563eb",
                                  fontWeight: 1000,
                                  textDecoration: "none",
                                }}
                              >
                                Open Attachment (PDF/File)
                              </a>
                            )}
                          </div>
                        ) : null}
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 11,
                            color: "#6b7280",
                            fontWeight: 900,
                          }}
                        >
                          {fmtTime(m.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  padding: 12,
                  borderTop: "1px solid #eef2f7",
                  display: "grid",
                  gap: 10,
                }}
              >
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your doubt..."
                  style={{ ...inputStyle, minHeight: 78, resize: "vertical" }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.gif,.webp,.pdf"
                      onChange={(e) =>
                        setAttachment(e.target.files?.[0] || null)
                      }
                    />
                    {attachment ? (
                      <div
                        style={{
                          marginTop: 4,
                          color: "#374151",
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        Selected: {attachment.name}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={sending || (!messageText.trim() && !attachment)}
                    style={{
                      border: "none",
                      borderRadius: 12,
                      backgroundColor: "#2563eb",
                      color: "#fff",
                      fontWeight: 1000,
                      padding: "10px 16px",
                      cursor: sending ? "not-allowed" : "pointer",
                      opacity: sending ? 0.75 : 1,
                    }}
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6b7280",
                fontWeight: 900,
              }}
            >
              No assigned teacher conversation found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentMessaging;

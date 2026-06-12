import React, { useEffect, useMemo, useState, useRef } from "react";
import api from "../../services/api";

const cardStyle = {
  backgroundColor: "#fff",
  borderRadius: "16px",
  border: "1px solid #e5e7eb",
  boxShadow: "0 1px 6px rgba(16,24,40,0.06)",
};

const inputStyle = {
  width: "100%",
  padding: "12px 16px",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  backgroundColor: "#f9fafb",
};

function fmtTime(v) {
  if (!v) return "";
  return new Date(v).toLocaleString([], {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
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

const AdminMessaging = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);

  const [search, setSearch] = useState("");
  const chatEndRef = useRef(null);

  const loadConversations = async (opts = {}) => {
    const params = {
      class_section_id: opts.classId ?? selectedClassId,
      status: opts.status ?? statusFilter,
    };
    try {
      const res = await api.get("communication/doubts/", { params });
      const data = res.data || [];
      setConversations(data);

      // If class or status changed, or list is empty, reset active selection
      if (data.length > 0 && window.innerWidth >= 768) {
        setActiveConvId(data[0].id);
      } else if (data.length === 0) {
        setActiveConvId(null);
        setActiveConv(null);
        setMessages([]);
      }
    } catch (e) {
      setError("Could not load doubts.");
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get("classes/sections/"), loadConversations()])
      .then(([classRes]) => {
        setClasses(classRes.data || []);
      })
      .catch(() => setError("Could not load data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeConvId) return;
    const fetchMessages = async () => {
      try {
        const res = await api.get(`communication/doubts/${activeConvId}/`);
        setActiveConv(res.data.conversation);
        setMessages(res.data.messages || []);
      } catch (e) {
        console.error("Could not load conversation");
      }
    };
    fetchMessages();
  }, [activeConvId]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.student_name.toLowerCase().includes(q) ||
        c.teacher_name.toLowerCase().includes(q) ||
        (c.subject || "").toLowerCase().includes(q),
    );
  }, [conversations, search]);

  if (loading)
    return (
      <div style={{ padding: 20, fontWeight: 900, color: "#6b7280" }}>
        Loading Monitoring System...
      </div>
    );

  return (
    <div style={{ padding: "20px", maxWidth: 1400, margin: "0 auto" }}>
      <div className={`messaging-header-container ${activeConvId ? 'messaging-mobile-hidden' : ''}`} style={{ ...cardStyle, padding: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 1000 }}>
              Monitor Doubts
            </h1>
            <p
              style={{
                margin: "4px 0 0",
                color: "#6b7280",
                fontSize: 14,
                fontWeight: 900,
              }}
            >
              Admin view of all student-teacher conversations.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                loadConversations({ classId: e.target.value });
              }}
              style={{ ...inputStyle, minWidth: 180 }}
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.class_name} - {c.section_name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                loadConversations({ status: e.target.value });
              }}
              style={{ ...inputStyle, minWidth: 150 }}
            >
              <option value="active">Active Doubts</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      <div
        className="messaging-layout-grid" style={{
          marginTop: 20,
          display: "grid",
          gridTemplateColumns: "350px 1fr",
          gap: 20,
          height: "calc(100vh - 200px)",
        }}
      >
        {/* Inbox */}
        <div
          className={`messaging-list-container ${activeConvId ? 'messaging-mobile-hidden' : ''}`}
          style={{
            ...cardStyle,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student, teacher or subject..."
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
            {filteredConversations.map((c) => (
              <div
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  cursor: "pointer",
                  marginBottom: 8,
                  border: `1px solid ${c.id === activeConvId ? "#2563eb" : "#e5e7eb"}`,
                  background: c.id === activeConvId ? "#eff6ff" : "#fff",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 1000, fontSize: 14 }}>
                    {c.student_name}
                  </span>
                  <span style={{ fontSize: 10, color: "#6b7280" }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#2563eb",
                    marginTop: 4,
                    fontWeight: 1000,
                  }}
                >
                  Teacher: {c.teacher_name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#10b981",
                    marginTop: 2,
                    fontWeight: 900,
                  }}
                >
                  Subject: {c.subject || "General"}
                </div>
              </div>
            ))}
            {filteredConversations.length === 0 && (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  color: "#6b7280",
                  fontWeight: 900,
                }}
              >
                🚫 No conversations found for this class/status.
              </div>
            )}
          </div>
        </div>

        {/* Chat */}
        <div
          className={`messaging-chat-container ${!activeConvId ? 'messaging-mobile-hidden' : ''}`}
          style={{
            ...cardStyle,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {activeConv ? (
            <>
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #e5e7eb",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  gap: 10
                }}
              >
                <button 
                  className="messaging-back-btn"
                  onClick={() => { setActiveConvId(null); setActiveConv(null); }}
                  style={{
                    border: 'none',
                    background: '#f3f4f6',
                    padding: '8px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 1000,
                    fontSize: 13,
                    color: '#374151'
                  }}
                >
                  ← Back
                </button>
                <div>
                  <div style={{ fontWeight: 1000, fontSize: 16 }}>
                    {activeConv.student_name} ↔ {activeConv.teacher_name}
                  </div>
                  <div
                    style={{ fontSize: 12, color: "#6b7280", fontWeight: 900 }}
                  >
                    Subject: {activeConv.subject || "General"} | Status:{" "}
                    {activeConv.is_active ? "Active" : "Resolved"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "20px",
                  background: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {messages.map((m) => {
                  const role = m.sender_role;
                  const isMe = false; // Admin is just observer
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf:
                          role === "student" ? "flex-start" : "flex-end",
                        maxWidth: "75%",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: "#6b7280",
                          marginBottom: 2,
                          textAlign: role === "student" ? "left" : "right",
                          fontWeight: 1000,
                        }}
                      >
                        {m.sender_name} ({role})
                      </div>
                      <div
                        style={{
                          padding: "12px 16px",
                          borderRadius:
                            role === "student"
                              ? "0 16px 16px 16px"
                              : "16px 0 16px 16px",
                          background: role === "student" ? "#fff" : "#e2e8f0",
                          color: "#1e293b",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                          border: "1px solid #cbd5e1",
                        }}
                      >
                        {m.content && (
                          <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>
                            {m.content}
                          </div>
                        )}
                        {m.attachment_url && (
                          <div style={{ marginTop: 8 }}>
                            {isImageAttachment(m.attachment_url) ? (
                              <a
                                href={m.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img
                                  src={m.attachment_url}
                                  alt="att"
                                  style={{
                                    maxWidth: "100%",
                                    borderRadius: 8,
                                    maxHeight: 300,
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
                                  fontSize: 12,
                                }}
                              >
                                📎 View Attachment
                              </a>
                            )}
                          </div>
                        )}
                        <div
                          style={{
                            textAlign: "right",
                            fontSize: 10,
                            marginTop: 4,
                            opacity: 0.8,
                          }}
                        >
                          {fmtTime(m.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
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
              Select a conversation to monitor.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMessaging;

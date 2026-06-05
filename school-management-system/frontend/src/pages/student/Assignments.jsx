import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { useStudent } from "../../context/StudentContext";

const colors = {
  bg: "#f9fafb",
  card: "#ffffff",
  border: "#e5e7eb",
  text: "#0f172a",
  muted: "#6b7280",
  primary: "#2563eb",
  present: "#16a34a",
  pending: "#f59e0b",
  rejected: "#ef4444",
  shadow: "0 1px 6px rgba(16,24,40,0.06)",
};

function parseDateOnly(value) {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  return new Date(y, mo - 1, d);
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isUrgent(dueDateStr) {
  const due = parseDateOnly(dueDateStr);
  if (!due) return false;
  const today = new Date();
  const todayKey = toDateKey(today);
  const dueKey = toDateKey(due);
  // Past or within next 3 days => urgent (red)
  const ms = due.getTime() - new Date(todayKey).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return dueKey <= todayKey || days <= 3;
}

function daysUntil(dueDateStr) {
  const due = parseDateOnly(dueDateStr);
  if (!due) return null;
  const today = new Date();
  const todayKey = toDateKey(today);
  const dueKey = toDateKey(due);
  const ms = due.getTime() - new Date(todayKey).getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
        zIndex: 50,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(920px, 100%)",
          backgroundColor: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: 18,
          boxShadow: colors.shadow,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 16,
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 1000, color: colors.text }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: "#fff",
              border: `1px solid ${colors.border}`,
              padding: "8px 12px",
              borderRadius: 12,
              cursor: "pointer",
              fontWeight: 1000,
            }}
          >
            Close
          </button>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

export default function StudentAssignments() {
  const { selectedStudentId } = useStudent();
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null); // assignment
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const submissionByAssignmentId = useMemo(() => {
    const map = new Map();
    (submissions || []).forEach((s) => {
      map.set(Number(s.assignment_id), s);
    });
    return map;
  }, [submissions]);

  const grouped = useMemo(() => {
    const map = new Map(); // subject -> []
    (assignments || []).forEach((a) => {
      const key = a.subject || "General";
      const arr = map.get(key) || [];
      arr.push(a);
      map.set(key, arr);
    });
    return Array.from(map.entries()).map(([subject, items]) => {
      const sorted = (items || [])
        .slice()
        .sort((a, b) =>
          String(a.due_date || "").localeCompare(String(b.due_date || "")),
        );
      return { subject, items: sorted };
    });
  }, [assignments]);

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get("assignments/"),
      api.get("assignments/my-submissions/"),
    ])
      .then(([aRes, sRes]) => {
        setAssignments(aRes.data || []);
        setSubmissions(sRes.data || []);
      })
      .catch((e) =>
        setError(e?.response?.data?.error || "Could not load assignments."),
      )
      .finally(() => setLoading(false));
  }, [selectedStudentId]);

  const openDetails = (a) => {
    setSelected(a);
    setSubmitUrl("");
    setSubmitError("");
    setSubmitSuccess("");
  };

  const selectedSubmission = selected
    ? submissionByAssignmentId.get(Number(selected.id))
    : null;
  const selectedIsSubmitted = !!selectedSubmission?.submitted;

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitError("");
    setSubmitSuccess("");

    if (selected.submission_type !== "online") {
      setSubmitError(
        "This assignment requires offline submission. Please follow teacher instructions.",
      );
      return;
    }

    if (!submitUrl.trim()) {
      setSubmitError("Please provide a file URL (link) for your submission.");
      return;
    }

    setSubmitBusy(true);
    try {
      await api.post("assignments/submit/", {
        assignment_id: selected.id,
        file_url: submitUrl.trim(),
      });
      const res = await api.get("assignments/my-submissions/");
      setSubmissions(res.data || []);
      setSubmitSuccess("Submission submitted successfully.");
    } catch (e) {
      setSubmitError(
        e?.response?.data?.error || "Could not submit assignment.",
      );
    } finally {
      setSubmitBusy(false);
    }
  };

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: colors.bg,
        minHeight: "calc(100vh - 80px)",
      }}
    >
      <style>
        {`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-up { animation: fadeIn 0.4s ease forwards; }
                .assignment-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px -10px rgba(0,0,0,0.1); }
                `}
      </style>

      {/* Premium Header Card */}
      <div
        className="animate-up"
        style={{
          backgroundColor: "#fff",
          padding: "28px",
          borderRadius: "24px",
          marginBottom: "20px",
          boxShadow: "0 1px 12px rgba(16,24,40,0.08)",
          border: "1px solid #e5e7eb",
          background: "linear-gradient(135deg, #fff 0%, #f8fafc 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -30,
            width: 200,
            height: 200,
            background: "rgba(37, 99, 235, 0.03)",
            borderRadius: "50%",
            zIndex: 0,
          }}
        ></div>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontWeight: 1000,
                fontSize: "32px",
                letterSpacing: "-0.02em",
                background: "linear-gradient(90deg, #1e293b 0%, #2563eb 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              My Assignments
            </h1>
            <p
              style={{
                margin: "8px 0 0",
                color: colors.muted,
                fontWeight: 900,
                fontSize: "15px",
              }}
            >
              View tasks, submit your work, and track deadlines for all your
              subjects.
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <div
              style={{
                background: "#f1f5f9",
                padding: "12px 20px",
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{ color: "#475569", fontWeight: 1000, fontSize: "18px" }}
              >
                {assignments.length}
              </div>
              <div
                style={{
                  color: "#64748b",
                  fontWeight: 900,
                  fontSize: "11px",
                  textTransform: "uppercase",
                }}
              >
                Total
              </div>
            </div>
            <div
              style={{
                background: "#ecfdf5",
                padding: "12px 20px",
                borderRadius: "16px",
                border: "1px solid #d1fae5",
              }}
            >
              <div
                style={{ color: "#059669", fontWeight: 1000, fontSize: "18px" }}
              >
                {submissions.length}
              </div>
              <div
                style={{
                  color: "#10b981",
                  fontWeight: 900,
                  fontSize: "11px",
                  textTransform: "uppercase",
                }}
              >
                Submitted
              </div>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div
          style={{
            border: `1px solid ${colors.rejected}`,
            backgroundColor: "#fff",
            padding: 12,
            borderRadius: 12,
            color: colors.rejected,
            fontWeight: 1000,
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ marginTop: 12, color: colors.muted, fontWeight: 900 }}>
          Loading assignments...
        </div>
      ) : assignments.length ? (
        <div
          className="rg-12" style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {grouped.map((g) => (
            <div
              key={g.subject}
              style={{
                gridColumn: "span 12",
                backgroundColor: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: 16,
                padding: 16,
                boxShadow: colors.shadow,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{ fontWeight: 1000, color: colors.text, fontSize: 18 }}
                >
                  {g.subject}
                </div>
                <div
                  style={{ color: colors.muted, fontWeight: 900, fontSize: 13 }}
                >
                  {g.items.length} assignments
                </div>
              </div>

              <div
                className="rg-autofit" style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 12,
                }}
              >
                {g.items.map((a) => {
                  const urgent = isUrgent(a.due_date);
                  const status = submissionByAssignmentId.get(Number(a.id));
                  const submitted = !!status?.submitted;
                  const dueIn = daysUntil(a.due_date);
                  const badgeBg = submitted
                    ? "#dcfce7"
                    : urgent
                      ? "#fef3c7"
                      : "#f3f4f6";
                  const badgeColor = submitted
                    ? colors.present
                    : urgent
                      ? colors.pending
                      : colors.text;
                  const attachmentHref = a.attachment_url || a.file_url || null;

                  return (
                    <div
                      key={a.id}
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 14,
                        padding: 14,
                        background: "#fafafa",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 1000,
                            color: colors.text,
                            fontSize: 14,
                          }}
                        >
                          {a.title}
                        </div>
                        <span
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            backgroundColor: badgeBg,
                            border: `1px solid ${colors.border}`,
                            color: badgeColor,
                            fontWeight: 1000,
                            fontSize: 12,
                          }}
                        >
                          {submitted ? "Submitted" : "Pending"}
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          color: colors.muted,
                          fontWeight: 900,
                          fontSize: 12,
                        }}
                      >
                        Teacher: {a.teacher_name || "—"}
                      </div>

                      {a.description ? (
                        <div
                          style={{
                            marginTop: 8,
                            color: colors.muted,
                            fontWeight: 900,
                            fontSize: 13,
                            lineHeight: 1.4,
                          }}
                        >
                          {a.description}
                        </div>
                      ) : null}

                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 1000,
                            color: urgent ? colors.rejected : colors.text,
                            fontSize: 13,
                          }}
                        >
                          Due: {a.due_date}
                          {dueIn !== null && !submitted ? (
                            <span
                              style={{
                                marginLeft: 8,
                                fontWeight: 1000,
                                color: urgent ? colors.rejected : colors.muted,
                              }}
                            >
                              {urgent ? `(Due in ${dueIn}d)` : ""}
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => openDetails(a)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 12,
                            border: `1px solid ${colors.border}`,
                            backgroundColor: "#fff",
                            cursor: "pointer",
                            fontWeight: 1000,
                          }}
                        >
                          View
                        </button>
                      </div>

                      {attachmentHref ? (
                        <div style={{ marginTop: 10 }}>
                          <a
                            href={attachmentHref}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: colors.primary,
                              fontWeight: 1000,
                              textDecoration: "none",
                              fontSize: 13,
                            }}
                          >
                            Download Attachment
                          </a>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 12, color: colors.muted, fontWeight: 900 }}>
          No assignments currently.
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Assignment Details: ${selected.title}` : ""}
      >
        {selected ? (
          <div
            className="rg-12" style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, minmax(0,1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                gridColumn: "span 12",
                backgroundColor: "#fafafa",
                border: `1px solid ${colors.border}`,
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 1000,
                      color: colors.text,
                      fontSize: 16,
                    }}
                  >
                    {selected.title}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      color: colors.muted,
                      fontWeight: 900,
                      fontSize: 13,
                    }}
                  >
                    Subject: {selected.subject} • Teacher:{" "}
                    {selected.teacher_name || "—"}
                  </div>
                </div>
                <div>
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      backgroundColor: selectedIsSubmitted
                        ? "#dcfce7"
                        : "#fef3c7",
                      border: `1px solid ${colors.border}`,
                      color: selectedIsSubmitted
                        ? colors.present
                        : colors.pending,
                      fontWeight: 1000,
                      fontSize: 12,
                    }}
                  >
                    {selectedIsSubmitted ? "Submitted" : "Pending"}
                  </span>
                </div>
              </div>

              {selected.description ? (
                <div
                  style={{
                    marginTop: 12,
                    color: colors.muted,
                    fontWeight: 900,
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {selected.description}
                </div>
              ) : null}

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontWeight: 1000,
                    color: isUrgent(selected.due_date)
                      ? colors.rejected
                      : colors.text,
                  }}
                >
                  Due Date: {selected.due_date}
                </div>
                <div
                  style={{ color: colors.muted, fontWeight: 900, fontSize: 13 }}
                >
                  Submission:{" "}
                  {selected.submission_type === "online" ? "Online" : "Offline"}
                </div>
              </div>

              {selected.instructions ? (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      fontWeight: 1000,
                      color: colors.text,
                      fontSize: 13,
                    }}
                  >
                    Instructions
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      color: colors.muted,
                      fontWeight: 900,
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    {selected.instructions}
                  </div>
                </div>
              ) : null}

              {selected.attachment_url || selected.file_url ? (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      fontWeight: 1000,
                      color: colors.text,
                      fontSize: 13,
                    }}
                  >
                    Attachment
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <a
                      href={selected.attachment_url || selected.file_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: colors.primary,
                        fontWeight: 1000,
                        textDecoration: "none",
                      }}
                    >
                      Download / Open file
                    </a>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Submission status + submit */}
            <div
              style={{
                gridColumn: "span 12",
                backgroundColor: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div
                style={{ fontWeight: 1000, color: colors.text, fontSize: 14 }}
              >
                Submission Status
              </div>
              <div
                style={{
                  marginTop: 6,
                  color: colors.muted,
                  fontWeight: 900,
                  fontSize: 13,
                }}
              >
                {selectedIsSubmitted
                  ? `Submitted on ${selectedSubmission?.submission_date ? new Date(selectedSubmission.submission_date).toLocaleString() : "—"}.`
                  : "Not submitted yet."}
              </div>
              {selectedIsSubmitted && selectedSubmission?.file_url ? (
                <div style={{ marginTop: 10 }}>
                  <a
                    href={selectedSubmission.file_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: colors.primary,
                      fontWeight: 1000,
                      textDecoration: "none",
                    }}
                  >
                    Download your submitted file
                  </a>
                </div>
              ) : null}

              {!selectedIsSubmitted ? (
                <div
                  style={{
                    marginTop: 14,
                    borderTop: `1px solid ${colors.border}`,
                    paddingTop: 14,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 1000,
                      color: colors.text,
                      fontSize: 14,
                    }}
                  >
                    Submit Assignment (Optional)
                  </div>
                  {selected.submission_type !== "online" ? (
                    <div
                      style={{
                        marginTop: 8,
                        color: colors.muted,
                        fontWeight: 900,
                        fontSize: 13,
                      }}
                    >
                      This assignment is marked as offline. Please follow the
                      teacher instructions.
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          marginTop: 8,
                          color: colors.muted,
                          fontWeight: 900,
                          fontSize: 13,
                        }}
                      >
                        Paste the URL (link) to your submission file.
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <input
                          value={submitUrl}
                          onChange={(e) => setSubmitUrl(e.target.value)}
                          placeholder="https://... (file URL)"
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            border: `1px solid ${colors.border}`,
                            borderRadius: 12,
                            outline: "none",
                            backgroundColor: "#fff",
                            fontWeight: 900,
                          }}
                        />
                      </div>
                      {submitError ? (
                        <div
                          style={{
                            marginTop: 10,
                            color: colors.rejected,
                            fontWeight: 1000,
                          }}
                        >
                          {submitError}
                        </div>
                      ) : null}
                      {submitSuccess ? (
                        <div
                          style={{
                            marginTop: 10,
                            color: colors.present,
                            fontWeight: 1000,
                          }}
                        >
                          {submitSuccess}
                        </div>
                      ) : null}
                      <div
                        style={{
                          marginTop: 12,
                          display: "flex",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={submitBusy}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 12,
                            border: "none",
                            backgroundColor: colors.primary,
                            color: "#fff",
                            cursor: submitBusy ? "not-allowed" : "pointer",
                            fontWeight: 1000,
                            opacity: submitBusy ? 0.75 : 1,
                          }}
                        >
                          {submitBusy ? "Submitting..." : "Submit"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

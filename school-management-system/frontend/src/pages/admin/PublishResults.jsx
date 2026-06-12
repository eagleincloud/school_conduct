import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import api from "../../services/api";

const colors = {
  primary: "#2563eb",
  success: "#10b981",
  danger: "#ef4444",
  border: "#e5e7eb",
  text: "#1e293b",
  textMuted: "#64748b",
  bg: "#f8fafc",
  white: "#ffffff",
};

const card = {
  backgroundColor: colors.white,
  borderRadius: "16px",
  padding: "20px",
  border: `1px solid ${colors.border}`,
  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
};

const label = {
  display: "block",
  fontSize: "13px",
  fontWeight: 800,
  color: colors.textMuted,
  marginBottom: "6px",
};
const input = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: `1px solid ${colors.border}`,
  outline: "none",
  fontSize: "14px",
  fontWeight: 700,
};

export default function PublishResults() {
  const [sections, setSections] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [detailedStatus, setDetailedStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.get("classes/sections/").then((res) => setSections(res.data || []));
    api.get("academics/exams/").then((res) => setExams(res.data || []));
  }, []);

  const filteredExams = exams.filter(
    (e) =>
      !selectedSectionId ||
      String(e.class_section) === String(selectedSectionId),
  );

  useEffect(() => {
    if (selectedExamId) {
      fetchDetailedStatus();
    } else {
      setDetailedStatus(null);
    }
  }, [selectedExamId]);

  const fetchDetailedStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(
        `academics/exams/${selectedExamId}/detailed-status/`,
      );
      setDetailedStatus(res.data);
    } catch (err) {
      setError("Failed to fetch detailed status");
    } finally {
      setLoading(false);
    }
  };

  const togglePublish = async (publish) => {
    setPublishing(true);
    setError("");
    setMessage("");
    try {
      await api.post(`academics/exams/${selectedExamId}/publish-results/`, {
        publish,
      });
      setMessage(
        publish
          ? "Results published successfully!"
          : "Results unpublished successfully!",
      );
      fetchDetailedStatus();
      // Refresh main exams list to stay in sync
      api.get("academics/exams/").then((res) => setExams(res.data || []));
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to update publish status");
    } finally {
      setPublishing(false);
    }
  };

  const isPublished = exams.find(
    (e) => String(e.id) === String(selectedExamId),
  )?.result_published;

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: 900,
            color: colors.text,
          }}
        >
          Publish Exam Results
        </h1>
        <p
          style={{ color: colors.textMuted, fontWeight: 700, marginTop: "4px" }}
        >
          Monitor student-wise marks completion and publish official results.
        </p>
      </div>

      {(message || error) && (
        <div
          style={{
            marginBottom: "20px",
            padding: "12px 16px",
            borderRadius: "12px",
            backgroundColor: error ? "#fef2f2" : "#f0fdf4",
            color: error ? colors.danger : colors.success,
            border: `1px solid ${error ? "#fee2e2" : "#dcfce7"}`,
            fontWeight: 800,
          }}
        >
          {error || message}
        </div>
      )}

      <div
        className="rg-2" style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "24px",
        }}
      >
        <div style={card}>
          <div style={label}>Filter by Class/Section</div>
          <select
            value={selectedSectionId}
            onChange={(e) => {
              setSelectedSectionId(e.target.value);
              setSelectedExamId("");
            }}
            style={input}
          >
            <option value="">All Classes/Sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.class_name} - {s.section_name}
              </option>
            ))}
          </select>
        </div>
        <div style={card}>
          <div style={label}>Select Exam to Manage</div>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            style={input}
          >
            <option value="">-- Choose Exam --</option>
            {filteredExams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.exam_type?.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            fontWeight: 700,
            color: colors.textMuted,
          }}
        >
          Loading detailed status...
        </div>
      ) : detailedStatus ? (
        <div style={{ display: "grid", gap: "24px" }}>
          <div
            style={{
              ...card,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <span style={label}>Current Status</span>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 900,
                  color: isPublished ? colors.success : colors.warning,
                }}
              >
                {isPublished ? "● Published" : "○ Unpublished"}
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => togglePublish(false)}
                disabled={publishing || !isPublished}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: `1px solid ${colors.border}`,
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Unpublish
              </button>
              <button
                onClick={() => togglePublish(true)}
                disabled={publishing || isPublished}
                style={{
                  padding: "10px 24px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: colors.primary,
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Publish Results
              </button>
            </div>
          </div>

          <div style={{ ...card, overflowX: "auto", padding: 0 }}>
            <div className="table-scroll"><table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "600px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f9fafb" }}>
                  <th
                    style={{
                      padding: "16px",
                      textAlign: "left",
                      borderBottom: `1px solid ${colors.border}`,
                      width: "200px",
                    }}
                  >
                    Student Name
                  </th>
                  <th
                    style={{
                      padding: "16px",
                      textAlign: "left",
                      borderBottom: `1px solid ${colors.border}`,
                      width: "100px",
                    }}
                  >
                    Roll No
                  </th>
                  {detailedStatus.subjects.map((s) => (
                    <th
                      key={s.id}
                      style={{
                        padding: "16px",
                        textAlign: "center",
                        borderBottom: `1px solid ${colors.border}`,
                        fontSize: "12px",
                      }}
                    >
                      {s.name}
                    </th>
                  ))}
                  <th
                    style={{
                      padding: "16px",
                      textAlign: "center",
                      borderBottom: `1px solid ${colors.border}`,
                      fontWeight: 900,
                    }}
                  >
                    Report Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {detailedStatus.matrix.map((row) => {
                  const isComplete = row.submissions.every(
                    (s) => s.is_submitted,
                  );
                  return (
                    <tr
                      key={row.student_id}
                      style={{ borderBottom: `1px solid #f1f5f9` }}
                    >
                      <td style={{ padding: "16px", fontWeight: 700 }}>
                        {row.student_name}
                      </td>
                      <td
                        style={{
                          padding: "16px",
                          fontWeight: 600,
                          color: colors.textMuted,
                        }}
                      >
                        {row.roll_number}
                      </td>
                      {row.submissions.map((sub, idx) => (
                        <td
                          key={idx}
                          style={{
                            padding: "16px",
                            textAlign: "center",
                            fontSize: "18px",
                          }}
                        >
                          {sub.is_submitted ? (
                            <CheckCircle size={18} color={colors.success} strokeWidth={2.5} />
                          ) : (
                            <XCircle size={18} color={colors.danger} strokeWidth={2.5} />
                          )}
                        </td>
                      ))}
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "8px",
                            fontSize: "11px",
                            fontWeight: 900,
                            backgroundColor: isComplete ? "#dcfce7" : "#fee2e2",
                            color: isComplete ? "#166534" : "#991b1b",
                          }}
                        >
                          {isComplete ? "READY" : "INCOMPLETE"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: "60px",
            textAlign: "center",
            ...card,
            backgroundColor: "transparent",
            borderStyle: "dashed",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "10px" }}>📉</div>
          <div style={{ fontWeight: 800, color: colors.textMuted }}>
            Select an exam to monitor completion status.
          </div>
        </div>
      )}
    </div>
  );
}

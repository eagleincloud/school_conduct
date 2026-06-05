import React, { useEffect, useState } from "react";
import api from "../../services/api";

const colors = {
  bg: "#f9fafb",
  card: "#ffffff",
  border: "#e5e7eb",
  text: "#0f172a",
  muted: "#6b7280",
  primary: "#2563eb",
  shadow: "0 1px 6px rgba(16,24,40,0.06)",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  backgroundColor: "#fff",
};

const labelStyle = {
  fontSize: 12,
  color: colors.muted,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  marginBottom: 6,
};

export default function TeacherSyllabus() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [syllabi, setSyllabi] = useState([]);

  const loadSyllabus = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      const res = await api.get("syllabus/", { params });
      setSyllabi(res.data || []);
    } catch (e) {
      setError("Could not load assigned syllabus.");
      setSyllabi([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSyllabus();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadSyllabus(), 350);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div
      className="dashboard-shell" style={{
        padding: 24,
        background: colors.bg,
        minHeight: "calc(100vh - 60px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontWeight: 1000,
              color: colors.text,
              fontSize: 28,
            }}
          >
            Assigned Syllabus
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              color: colors.muted,
              fontWeight: 900,
              fontSize: 13,
            }}
          >
            View syllabus for your assigned classes and subjects.
          </p>
        </div>
        <div style={{ minWidth: 300 }}>
          <div style={labelStyle}>Search Syllabus</div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or subject..."
            style={inputStyle}
          />
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            padding: "12px 16px",
            borderRadius: 12,
            fontWeight: 900,
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: 20,
          boxShadow: colors.shadow,
          padding: 20,
        }}
      >
        {loading ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: colors.muted,
              fontWeight: 900,
            }}
          >
            Loading syllabus records...
          </div>
        ) : (
          <div
            className="rg-autofit" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 20,
            }}
          >
            {syllabi.map((s) => (
              <div
                key={s.id}
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 16,
                  padding: 20,
                  background: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: "0 0 8px",
                      fontSize: 18,
                      color: colors.text,
                    }}
                  >
                    {s.title}
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 12,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 900,
                        background: "#e2e8f0",
                        color: "#475569",
                        padding: "4px 8px",
                        borderRadius: 6,
                        textTransform: "uppercase",
                      }}
                    >
                      {s.class_name}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 900,
                        background: "#dcfce7",
                        color: "#166534",
                        padding: "4px 8px",
                        borderRadius: 6,
                        textTransform: "uppercase",
                      }}
                    >
                      {s.subject_name}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#475569",
                      margin: "0 0 16px",
                      lineHeight: 1.5,
                    }}
                  >
                    {s.description || "No description provided."}
                  </p>
                </div>
                <div
                  style={{
                    borderTop: `1px solid ${colors.border}`,
                    paddingTop: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: colors.muted,
                      fontWeight: 800,
                    }}
                  >
                    Uploaded on {new Date(s.uploaded_at).toLocaleDateString()}
                  </span>
                  {s.file_url ? (
                    <a
                      href={s.file_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: colors.primary,
                        color: "#fff",
                        textDecoration: "none",
                        padding: "8px 16px",
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 1000,
                        boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                      }}
                    >
                      View File
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
            {syllabi.length === 0 && (
              <div
                style={{
                  gridColumn: "1/-1",
                  textAlign: "center",
                  padding: "60px 20px",
                  color: colors.muted,
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
                <h3 style={{ margin: 0 }}>No Syllabus Found</h3>
                <p style={{ fontSize: 14, fontWeight: 900 }}>
                  Check with your administrator if this is unexpected.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

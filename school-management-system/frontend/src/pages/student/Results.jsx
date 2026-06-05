import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../../services/api";
import { useStudent } from "../../context/StudentContext";

const colors = {
  primary: "#2563eb",
  primaryLight: "#eff6ff",
  secondary: "#0f172a",
  success: "#10b981",
  successLight: "#ecfdf5",
  warning: "#f59e0b",
  warningLight: "#fffbeb",
  danger: "#ef4444",
  dangerLight: "#fef2f2",
  border: "#e5e7eb",
  text: "#1e293b",
  textMuted: "#64748b",
  bg: "#f8fafc",
  white: "#ffffff",
};

function pctToOverallGrade(pct) {
  const p = Number(pct) || 0;
  if (p >= 90) return "A+";
  if (p >= 80) return "A";
  if (p >= 70) return "B";
  if (p >= 60) return "C";
  if (p >= 50) return "D";
  return "F";
}

const cardStyle = {
  backgroundColor: colors.white,
  borderRadius: "24px",
  padding: "24px",
  border: `1px solid ${colors.border}`,
  boxShadow:
    "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
};

const badgeStyle = (pass) => ({
  padding: "6px 16px",
  borderRadius: "12px",
  fontSize: "13px",
  fontWeight: 800,
  backgroundColor: pass ? colors.successLight : colors.dangerLight,
  color: pass ? colors.success : colors.danger,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
});

export default function Results() {
  const { selectedStudentId } = useStudent();
  const [profile, setProfile] = useState(null);
  const [marks, setMarks] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedExamType, setSelectedExamType] = useState("");
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  // Detect view based on URL
  const isMainExamView = location.pathname.includes("/results/exam");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("students/profile/"),
      api.get("academics/results/my/"),
      api.get("academics/exams/"),
    ])
      .then(([pRes, mRes, eRes]) => {
        setProfile(pRes.data || null);
        setMarks(mRes.data || []);
        setExams(eRes.data || []);
      })
      .catch((err) => console.error("Error fetching results:", err))
      .finally(() => setLoading(false));
  }, [selectedStudentId]);

  const marksByExamType = useMemo(() => {
    const map = new Map();
    (marks || []).forEach((m) => {
      // Filter by category
      if (isMainExamView) {
        if (m.exam_type !== "final") return;
      } else {
        if (m.exam_type === "final") return;
      }

      if (!map.has(m.exam_type)) map.set(m.exam_type, []);
      map.get(m.exam_type).push(m);
    });
    return map;
  }, [marks, isMainExamView]);

  const examOptions = useMemo(() => {
    const options = Array.from(marksByExamType.keys()).map((type) => {
      const meta = exams.find((e) => e.exam_type === type);
      const labelMap = {
        unit_test: "Unit Test",
        class_test: "Class Test",
        mst: "MST",
        final: "Final Exam",
      };
      return {
        id: type,
        label: labelMap[type] || type.replace("_", " ").toUpperCase(),
        exam_id: meta?.id,
        passing_marks: meta?.passing_marks || 0,
        total_marks: meta?.total_marks || 0,
        startDate: meta?.start_date || null,
      };
    });
    options.sort((a, b) =>
      String(b.startDate || "").localeCompare(String(a.startDate || "")),
    );
    return options;
  }, [marksByExamType, exams]);

  useEffect(() => {
    if (examOptions.length > 0 && !selectedExamType) {
      setSelectedExamType(examOptions[0].id);
    }
  }, [examOptions, selectedExamType]);

  const selectedOption = useMemo(
    () => examOptions.find((o) => o.id === selectedExamType) || null,
    [examOptions, selectedExamType],
  );
  const selectedRows = useMemo(
    () => marksByExamType.get(selectedExamType) || [],
    [marksByExamType, selectedExamType],
  );

  const computed = useMemo(() => {
    const totalMax = selectedRows.reduce(
      (s, m) => s + Number(m.max_marks || 0),
      0,
    );
    const totalObt = selectedRows.reduce((s, m) => s + Number(m.marks || 0), 0);
    const percentage = totalMax > 0 ? (totalObt / totalMax) * 100 : 0;
    const overallGrade = pctToOverallGrade(percentage);
    const passingThreshold = totalMax * 0.33;
    const finalResult = totalObt >= passingThreshold ? "Pass" : "Fail";

    return {
      totalMax,
      totalObt,
      percentage,
      overallGrade,
      finalResult,
      examType:
        selectedOption?.label ||
        selectedExamType.replace("_", " ").toUpperCase(),
    };
  }, [selectedRows, selectedOption, selectedExamType]);

  const downloadPdf = async () => {
    if (!selectedOption?.exam_id) {
      alert("Exam record not found for PDF generation.");
      return;
    }
    try {
      const res = await api.get(
        `academics/results/my/${selectedOption.exam_id}/pdf/`,
        { responseType: "blob" },
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `marksheet_${selectedOption.label.replace(" ", "_")}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Could not download marksheet PDF.");
    }
  };

  if (loading)
    return (
      <div
        style={{
          padding: "100px",
          textAlign: "center",
          backgroundColor: colors.bg,
          minHeight: "100vh",
        }}
      >
        <div
          style={{ fontSize: "20px", fontWeight: 800, color: colors.primary }}
        >
          Fetching your results...
        </div>
      </div>
    );

  if (examOptions.length === 0) {
    return (
      <div
        style={{
          padding: "100px 40px",
          textAlign: "center",
          backgroundColor: colors.bg,
          minHeight: "100vh",
        }}
      >
        <div style={{ ...cardStyle, maxWidth: "500px", margin: "0 auto" }}>
          <div style={{ fontSize: "64px", marginBottom: "20px" }}>📄</div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 900,
              color: colors.secondary,
            }}
          >
            No Published {isMainExamView ? "Final" : "Internal"} Result
          </h1>
          <p
            style={{
              color: colors.textMuted,
              marginTop: "12px",
              lineHeight: 1.6,
            }}
          >
            {isMainExamView
              ? "Your Final Exam marksheet will appear here once the administration publishes it."
              : "Your MST, Unit, and Class Test results will appear here once they are published."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "32px",
        backgroundColor: colors.bg,
        minHeight: "100vh",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "32px",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "36px",
                fontWeight: 1000,
                color: colors.secondary,
                margin: 0,
                letterSpacing: "-1px",
              }}
            >
              {isMainExamView ? "Final Exam Report" : "Assessment Report"}
            </h1>
            <p
              style={{
                color: colors.textMuted,
                marginTop: "6px",
                fontWeight: 700,
                fontSize: "15px",
              }}
            >
              {isMainExamView
                ? "Detailed analysis of your end-of-term marks."
                : "Track your MST and internal test performance."}
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <select
              value={selectedExamType}
              onChange={(e) => setSelectedExamType(e.target.value)}
              style={{
                padding: "12px 24px",
                borderRadius: "16px",
                border: `2px solid ${colors.border}`,
                fontWeight: 800,
                outline: "none",
                backgroundColor: colors.white,
                cursor: "pointer",
                transition: "all 0.2s",
                fontSize: "14px",
              }}
            >
              {examOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              onClick={downloadPdf}
              style={{
                padding: "12px 28px",
                borderRadius: "16px",
                border: "none",
                backgroundColor: colors.primary,
                color: colors.white,
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: `0 8px 20px -6px ${colors.primary}66`,
                fontSize: "14px",
              }}
            >
              Download Report
            </button>
          </div>
        </div>

        {/* Info Cards */}
        <div
          className="rg-split-asymmetric" style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: "24px",
            marginBottom: "32px",
          }}
        >
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "20px",
                  backgroundColor: colors.primaryLight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                }}
              >
                👨‍🎓
              </div>
              <div>
                <p
                  style={{
                    color: colors.textMuted,
                    fontSize: "13px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    marginBottom: "4px",
                    letterSpacing: "1px",
                  }}
                >
                  Student Identity
                </p>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "24px",
                    fontWeight: 900,
                    color: colors.secondary,
                  }}
                >
                  {profile?.user?.name}
                </h3>
                <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
                  <span
                    style={{
                      color: colors.text,
                      fontWeight: 700,
                      fontSize: "14px",
                    }}
                  >
                    Class:{" "}
                    <span style={{ color: colors.primary }}>
                      {profile?.class_section_display || "Not Assigned"}
                    </span>
                  </span>
                  <span
                    style={{
                      color: colors.text,
                      fontWeight: 700,
                      fontSize: "14px",
                    }}
                  >
                    Roll No:{" "}
                    <span style={{ color: colors.primary }}>
                      {profile?.roll_number || "N/A"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              ...cardStyle,
              backgroundColor: colors.primary,
              color: colors.white,
              border: "none",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <p
                  style={{
                    opacity: 0.8,
                    fontSize: "13px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    marginBottom: "8px",
                    letterSpacing: "1px",
                  }}
                >
                  Overall Result
                </p>
                <h3 style={{ margin: 0, fontSize: "42px", fontWeight: 1000 }}>
                  {computed.percentage.toFixed(1)}%
                </h3>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontWeight: 800,
                    fontSize: "16px",
                    opacity: 0.9,
                  }}
                >
                  Grade: {computed.overallGrade}
                </p>
              </div>
              <div
                style={{
                  backgroundColor:
                    computed.finalResult === "Pass"
                      ? "rgba(255,255,255,0.25)"
                      : "rgba(239, 68, 68, 0.4)",
                  padding: "10px 24px",
                  borderRadius: "14px",
                  fontWeight: 1000,
                  fontSize: "22px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              >
                {computed.finalResult}
              </div>
            </div>
          </div>
        </div>

        {/* Subject Wise Performance */}
        <div>
          <h2
            style={{
              fontSize: "22px",
              fontWeight: 900,
              color: colors.secondary,
              marginBottom: "20px",
              paddingLeft: "8px",
            }}
          >
            Subject Performance
          </h2>
          <div style={{ display: "grid", gap: "16px" }}>
            {selectedRows.map((r) => {
              const pct = (r.marks / r.max_marks) * 100;
              const isPass = r.marks >= r.max_marks * 0.33;
              return (
                <div
                  key={r.id}
                  style={{
                    ...cardStyle,
                    padding: "20px 24px",
                    transition: "transform 0.2s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "18px",
                          fontWeight: 900,
                          color: colors.secondary,
                        }}
                      >
                        {r.subject_name || r.subject}
                      </span>
                    </div>
                    <div style={badgeStyle(isPass)}>
                      {isPass ? "Pass" : "Fail"}
                    </div>
                  </div>

                  <div
                    className="rg-toolbar" style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 200px",
                      gap: "40px",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          height: "12px",
                          width: "100%",
                          backgroundColor: colors.bg,
                          borderRadius: "6px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            backgroundColor: isPass
                              ? colors.primary
                              : colors.danger,
                            borderRadius: "6px",
                            transition: "width 1s ease-out",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: "10px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 800,
                            color: colors.textMuted,
                          }}
                        >
                          Achievement
                        </span>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 800,
                            color: colors.secondary,
                          }}
                        >
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "32px",
                      }}
                    >
                      <div style={{ textAlign: "right" }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "12px",
                            fontWeight: 800,
                            color: colors.textMuted,
                            textTransform: "uppercase",
                          }}
                        >
                          Obtained
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "20px",
                            fontWeight: 900,
                            color: colors.primary,
                          }}
                        >
                          {r.marks}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "12px",
                            fontWeight: 800,
                            color: colors.textMuted,
                            textTransform: "uppercase",
                          }}
                        >
                          Max
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "20px",
                            fontWeight: 900,
                            color: colors.secondary,
                          }}
                        >
                          {r.max_marks}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Info */}
        <div
          style={{
            marginTop: "40px",
            padding: "24px",
            borderTop: `1px dashed ${colors.border}`,
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: colors.textMuted,
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            This is an automatically generated report. For any discrepancies,
            please contact the administration office.
          </p>
        </div>
      </div>
    </div>
  );
}

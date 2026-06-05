import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";

const palette = {
  bg: "#f8fafc",
  card: "#ffffff",
  border: "#e5e7eb",
  text: "#0f172a",
  muted: "#64748b",
  primary: "#2563eb",
  success: "#16a34a",
  danger: "#ef4444",
  warn: "#f59e0b",
  info: "#0ea5e9",
  shadow: "0 1px 12px rgba(16,24,40,0.08)",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  border: `1px solid ${palette.border}`,
  borderRadius: "14px",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  backgroundColor: "#fff",
  fontWeight: 900,
  transition: "all 0.2s",
};

const labelStyle = {
  fontSize: "11px",
  color: palette.muted,
  fontWeight: 1000,
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const Students = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [teacherProfile, setTeacherProfile] = useState(null);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");

  const [students, setStudents] = useState([]);
  const [studentCounts, setStudentCounts] = useState({});

  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("teachers/profile/"),
      api.get("classes/teaching-sections/"),
    ])
      .then(async ([teacherRes, sectionRes]) => {
        const profile = teacherRes.data || null;
        const mine = sectionRes.data || [];
        setTeacherProfile(profile);
        setAssignedClasses(mine);
        if (mine.length) setSelectedClassId(String(mine[0].id));

        const counts = {};
        await Promise.all(
          mine.map(async (c) => {
            try {
              const res = await api.get(`students/by-class/${c.id}/`);
              counts[c.id] = (res.data || []).length;
            } catch (_) {
              counts[c.id] = 0;
            }
          }),
        );
        setStudentCounts(counts);
      })
      .catch(() => setError("Could not load your classes"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }
    api
      .get(`students/by-class/${selectedClassId}/`)
      .then((res) => setStudents(res.data || []))
      .catch(() => setError("Could not load students for this class"));
  }, [selectedClassId]);

  const selectedClass = useMemo(
    () => assignedClasses.find((c) => String(c.id) === String(selectedClassId)),
    [assignedClasses, selectedClassId],
  );

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return (students || []).filter(
      (s) =>
        (s.admission_number || "").toLowerCase().includes(q) ||
        (s.name || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q),
    );
  }, [students, search]);

  if (loading) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          color: palette.muted,
          fontWeight: 1000,
          fontSize: "18px",
        }}
      >
        <div style={{ marginBottom: "16px", fontSize: "32px" }}>👨‍🎓</div>
        Loading student records...
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: palette.bg,
        minHeight: "calc(100vh - 64px)",
      }}
    >
      <style>
        {`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-up { animation: fadeIn 0.4s ease forwards; }
                .class-pill:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15); }
                .student-row:hover { background-color: #f8fafc !important; }
                `}
      </style>

      {/* Header */}
      <div
        style={{
          backgroundColor: palette.card,
          padding: "24px",
          borderRadius: "20px",
          marginBottom: "20px",
          boxShadow: palette.shadow,
          border: `1px solid ${palette.border}`,
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
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontWeight: 1000,
                fontSize: "30px",
                letterSpacing: "-0.02em",
                background: "linear-gradient(90deg, #1e293b 0%, #2563eb 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              My Students
            </h1>
            <p
              style={{
                margin: "8px 0 0",
                color: palette.muted,
                fontWeight: 900,
                fontSize: "15px",
              }}
            >
              View and manage students in your assigned classes.
            </p>
          </div>
          {teacherProfile && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 16px",
                backgroundColor: "#f1f5f9",
                borderRadius: "16px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  backgroundColor: palette.primary,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 1000,
                }}
              >
                {teacherProfile.user?.name?.charAt(0) || "T"}
              </div>
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    color: palette.muted,
                    fontWeight: 1000,
                    textTransform: "uppercase",
                  }}
                >
                  Teacher
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 1000,
                    color: palette.text,
                  }}
                >
                  {teacherProfile.user?.name}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Class Selector */}
      <div
        className="animate-up"
        style={{
          backgroundColor: palette.card,
          borderRadius: "20px",
          padding: "24px",
          marginBottom: "20px",
          boxShadow: palette.shadow,
          border: `1px solid ${palette.border}`,
        }}
      >
        <div style={labelStyle}>Assigned Classes</div>
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            marginTop: "12px",
          }}
        >
          {assignedClasses.map((c) => {
            const active = String(c.id) === String(selectedClassId);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedClassId(String(c.id))}
                className="class-pill"
                style={{
                  borderRadius: "14px",
                  border: `1px solid ${active ? palette.primary : palette.border}`,
                  backgroundColor: active ? "#eff6ff" : "#fff",
                  color: active ? palette.primary : palette.text,
                  cursor: "pointer",
                  fontWeight: 1000,
                  padding: "10px 18px",
                  fontSize: "14px",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {c.class_name}-{c.section_name}
                <span
                  style={{
                    backgroundColor: active ? palette.primary : "#f1f5f9",
                    color: active ? "#fff" : palette.muted,
                    padding: "2px 8px",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                >
                  {studentCounts[c.id] || 0}
                </span>
              </button>
            );
          })}
          {assignedClasses.length === 0 && (
            <div style={{ color: palette.muted, fontWeight: 900 }}>
              No classes assigned to you.
            </div>
          )}
        </div>
      </div>

      {/* Students List */}
      <div
        className="animate-up"
        style={{
          backgroundColor: palette.card,
          borderRadius: "20px",
          padding: "24px",
          boxShadow: palette.shadow,
          border: `1px solid ${palette.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 1000,
                color: palette.text,
                fontSize: "20px",
              }}
            >
              {selectedClass
                ? `Students in ${selectedClass.class_name}-${selectedClass.section_name}`
                : "Select a Class"}
            </div>
            <div
              style={{
                marginTop: "4px",
                color: palette.muted,
                fontWeight: 900,
                fontSize: "13px",
              }}
            >
              {filteredStudents.length} Students registered
            </div>
          </div>
          <div style={{ minWidth: "320px" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by admission no, name..."
              style={{
                ...inputStyle,
                border: `1px solid ${palette.border}`,
                backgroundColor: "#f8fafc",
              }}
            />
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <div className="table-scroll"><table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: "0 8px",
            }}
          >
            <thead>
              <tr>
                {[
                  "Admission No",
                  "Student Name",
                  "Email Address",
                  "Class/Section",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "0 12px 12px",
                      textAlign: "left",
                      color: palette.muted,
                      fontWeight: 1000,
                      fontSize: "11px",
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s.id} className="student-row">
                  <td
                    style={{
                      padding: "16px 12px",
                      backgroundColor: "#f8fafc",
                      borderTopLeftRadius: "14px",
                      borderBottomLeftRadius: "14px",
                      border: `1px solid ${palette.border}`,
                      borderRight: "none",
                      fontWeight: 1000,
                      color: palette.primary,
                    }}
                  >
                    {s.admission_number || "N/A"}
                  </td>
                  <td
                    style={{
                      padding: "16px 12px",
                      backgroundColor: "#f8fafc",
                      border: `1px solid ${palette.border}`,
                      borderLeft: "none",
                      borderRight: "none",
                      fontWeight: 1000,
                      color: palette.text,
                    }}
                  >
                    {s.name}
                  </td>
                  <td
                    style={{
                      padding: "16px 12px",
                      backgroundColor: "#f8fafc",
                      border: `1px solid ${palette.border}`,
                      borderLeft: "none",
                      borderRight: "none",
                      color: palette.muted,
                      fontWeight: 900,
                      fontSize: "13px",
                    }}
                  >
                    {s.email || "N/A"}
                  </td>
                  <td
                    style={{
                      padding: "16px 12px",
                      backgroundColor: "#f8fafc",
                      border: `1px solid ${palette.border}`,
                      borderLeft: "none",
                      borderRight: "none",
                    }}
                  >
                    <span
                      style={{
                        backgroundColor: "#fff",
                        border: `1px solid ${palette.border}`,
                        padding: "4px 8px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 1000,
                      }}
                    >
                      {s.class_name || selectedClass?.class_name}-
                      {s.section_name || selectedClass?.section_name}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "16px 12px",
                      backgroundColor: "#f8fafc",
                      border: `1px solid ${palette.border}`,
                      borderLeft: "none",
                      borderRight: "none",
                    }}
                  >
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "999px",
                        fontSize: "10px",
                        fontWeight: 1000,
                        backgroundColor: "#f0fdf4",
                        color: "#16a34a",
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      Active
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "16px 12px",
                      backgroundColor: "#f8fafc",
                      borderTopRightRadius: "14px",
                      borderBottomRightRadius: "14px",
                      border: `1px solid ${palette.border}`,
                      borderLeft: "none",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(s)}
                      style={{
                        border: "none",
                        borderRadius: "10px",
                        padding: "8px 16px",
                        backgroundColor: palette.primary,
                        color: "#fff",
                        cursor: "pointer",
                        fontWeight: 1000,
                        fontSize: "12px",
                        boxShadow: "0 4px 6px rgba(37, 99, 235, 0.15)",
                      }}
                    >
                      View Profile
                    </button>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "60px",
                      textAlign: "center",
                      color: palette.muted,
                      fontWeight: 1000,
                    }}
                  >
                    <div style={{ fontSize: "32px", marginBottom: "12px" }}>
                      🔍
                    </div>
                    No students found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table></div>
        </div>
      </div>

      {/* Profile Modal */}
      {selectedStudent && (
        <div
          onClick={() => setSelectedStudent(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: "24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-up"
            style={{
              width: "min(500px, 100%)",
              backgroundColor: "#fff",
              borderRadius: "24px",
              padding: "30px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              border: `1px solid ${palette.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontWeight: 1000, fontSize: "22px" }}>
                  Student Profile
                </h3>
                <div
                  style={{
                    color: palette.primary,
                    fontWeight: 1000,
                    fontSize: "14px",
                    marginTop: "4px",
                  }}
                >
                  Class Roll & Records
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "10px",
                  backgroundColor: "#f1f5f9",
                  border: "none",
                  cursor: "pointer",
                  color: palette.muted,
                  fontWeight: 1000,
                  fontSize: "20px",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gap: "16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  padding: "16px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "18px",
                  border: `1px solid ${palette.border}`,
                }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "16px",
                    backgroundColor: palette.primary,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    fontWeight: 1000,
                  }}
                >
                  {selectedStudent.name?.charAt(0)}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 1000,
                      color: palette.text,
                    }}
                  >
                    {selectedStudent.name}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: palette.muted,
                      fontWeight: 900,
                    }}
                  >
                    Admission ID: {selectedStudent.admission_number || "N/A"}
                  </div>
                </div>
              </div>

              <div
                className="rg-2" style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    border: `1px solid ${palette.border}`,
                    borderRadius: "14px",
                  }}
                >
                  <div style={labelStyle}>Email Address</div>
                  <div style={{ fontSize: "13px", fontWeight: 1000 }}>
                    {selectedStudent.email || "N/A"}
                  </div>
                </div>
                <div
                  style={{
                    padding: "12px",
                    border: `1px solid ${palette.border}`,
                    borderRadius: "14px",
                  }}
                >
                  <div style={labelStyle}>Current Class</div>
                  <div style={{ fontSize: "13px", fontWeight: 1000 }}>
                    {selectedStudent.class_name || selectedClass?.class_name} -{" "}
                    {selectedStudent.section_name ||
                      selectedClass?.section_name}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedStudent(null)}
              style={{
                width: "100%",
                marginTop: "24px",
                padding: "14px",
                borderRadius: "14px",
                border: "none",
                backgroundColor: palette.primary,
                color: "#fff",
                fontWeight: 1000,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
              }}
            >
              Close Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useStudent } from "../../context/StudentContext";

const card = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#fff",
  padding: 16,
};

const Profile = () => {
  const navigate = useNavigate();
  const { selectedStudentId } = useStudent();
  const [profile, setProfile] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [feeRecords, setFeeRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [idCardBusy, setIdCardBusy] = useState(false);
  const [fullPhotoOpen, setFullPhotoOpen] = useState(false);
  const fileInputRef = useRef(null);

  const [schoolInfo, setSchoolInfo] = useState(null);

  useEffect(() => {
    if (!fullPhotoOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setFullPhotoOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullPhotoOpen]);

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.allSettled([
      api.get("students/profile/"),
      api.get("assignments/"),
      api.get("assignments/my-submissions/"),
      api.get("attendance/my-attendance/"),
      api.get("fees/my/"),
      api.get("tenants/common/school-info/"),
    ])
      .then(
        ([
          profileRes,
          assignmentRes,
          submissionRes,
          attendanceRes,
          feesRes,
          schoolRes,
        ]) => {
          if (profileRes.status === "fulfilled") {
            setProfile(profileRes.value?.data || null);
          } else {
            setProfile(null);
          }

          if (assignmentRes.status === "fulfilled") {
            setAssignments(assignmentRes.value?.data || []);
          } else {
            setAssignments([]);
          }

          if (submissionRes.status === "fulfilled") {
            setSubmissions(submissionRes.value?.data || []);
          } else {
            setSubmissions([]);
          }

          if (attendanceRes.status === "fulfilled") {
            setAttendanceRows(attendanceRes.value?.data || []);
          } else {
            setAttendanceRows([]);
          }

          if (feesRes.status === "fulfilled") {
            setFeeRecords(feesRes.value?.data || []);
          } else {
            setFeeRecords([]);
          }

          if (schoolRes.status === "fulfilled") {
            setSchoolInfo(schoolRes.value?.data || null);
          }

          if (
            profileRes.status !== "fulfilled" &&
            assignmentRes.status !== "fulfilled" &&
            submissionRes.status !== "fulfilled" &&
            attendanceRes.status !== "fulfilled" &&
            feesRes.status !== "fulfilled" &&
            schoolRes.status !== "fulfilled"
          ) {
            setError("Could not load student profile data.");
          }
        },
      )
      .finally(() => setLoading(false));
  }, [selectedStudentId]);

  const submissionMap = useMemo(() => {
    const m = new Map();
    (submissions || []).forEach((s) =>
      m.set(Number(s.assignment_id), !!s.submitted),
    );
    return m;
  }, [submissions]);

  const sortedAssignments = useMemo(() => {
    return (assignments || [])
      .slice()
      .sort((a, b) =>
        String(a.due_date || "").localeCompare(String(b.due_date || "")),
      );
  }, [assignments]);

  const assignmentSummary = useMemo(() => {
    const total = sortedAssignments.length;
    const submitted = sortedAssignments.filter((a) =>
      submissionMap.get(Number(a.id)),
    ).length;
    const pending = total - submitted;
    return { total, submitted, pending };
  }, [sortedAssignments, submissionMap]);

  const attendanceSummary = useMemo(() => {
    const normalized = (attendanceRows || []).map((r) =>
      String(r.status || "").toLowerCase(),
    );
    const present = normalized.filter(
      (s) => s === "present" || s === "late",
    ).length;
    const absent = normalized.filter((s) => s === "absent").length;
    const marked = present + absent;
    const percentage = marked ? (present / marked) * 100 : 0;
    return { present, absent, percentage };
  }, [attendanceRows]);

  const feesSummary = useMemo(() => {
    const total = (feeRecords || []).reduce(
      (sum, r) => sum + Number(r.total_fees || 0),
      0,
    );
    const paid = (feeRecords || []).reduce(
      (sum, r) => sum + Number(r.amount_paid || 0),
      0,
    );
    const due = (feeRecords || []).reduce(
      (sum, r) => sum + Number(r.due_amount || 0),
      0,
    );
    return { total, paid, due };
  }, [feeRecords]);

  if (loading) return <p className="dashboard-shell" style={{ padding: 20 }}>Loading profile...</p>;
  if (!profile)
    return (
      <p style={{ padding: 20, color: "#b91c1c", fontWeight: 900 }}>
        Profile not found.
      </p>
    );

  const classDisplay = profile.class_name || profile.class_ref_name || "N/A";
  const fatherName = profile.father_name || "—";
  const motherName = profile.mother_name || "—";
  const photoInitial = (profile.name || "S").slice(0, 1).toUpperCase();

  const pickPhoto = () => {
    setPhotoError("");
    fileInputRef.current?.click();
  };

  const onPhotoSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const res = await api.post("students/profile/photo/", fd);
      setProfile((p) =>
        p
          ? {
              ...p,
              photo_url: res.data.photo_url,
              has_photo: !!res.data.has_photo,
            }
          : p,
      );
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        (typeof err?.response?.data === "string" ? err.response.data : null) ||
        "Could not upload photo.";
      setPhotoError(msg);
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    if (!profile?.has_photo && !profile?.photo_url) return;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      await api.delete("students/profile/photo/");
      setProfile((p) => (p ? { ...p, photo_url: null, has_photo: false } : p));
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        "Could not remove photo.";
      setPhotoError(msg);
    } finally {
      setPhotoBusy(false);
    }
  };

  const fetchStudentIdCardBlob = async (disposition) => {
    const res = await api.get("students/profile/id-card/", {
      responseType: "blob",
      params: { disposition },
    });
    return res.data;
  };

  const viewIdCardPdf = async () => {
    setIdCardBusy(true);
    setPhotoError("");
    try {
      const blob = await fetchStudentIdCardBlob("inline");
      const url = URL.createObjectURL(
        new Blob([blob], { type: "application/pdf" }),
      );
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (err) {
      let msg = err?.response?.data?.error || "Could not open ID card.";
      if (err?.response?.data instanceof Blob) {
        try {
          const t = await err.response.data.text();
          if (t) {
            try {
              const j = JSON.parse(t);
              msg = j.error || j.detail || msg;
            } catch {
              msg = t.length < 200 ? t : msg;
            }
          }
        } catch {
          /* ignore */
        }
      }
      setPhotoError(typeof msg === "string" ? msg : "Could not open ID card.");
    } finally {
      setIdCardBusy(false);
    }
  };

  return (
    <div
      style={{
        padding: "24px",
        background: "#f8fafc",
        minHeight: "calc(100vh - 60px)",
      }}
    >
      <style>
        {`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-up { animation: fadeIn 0.4s ease forwards; }
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
        <div style={{ position: "relative", zIndex: 1 }}>
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
            My Profile
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              color: "#64748b",
              fontWeight: 900,
              fontSize: "15px",
            }}
          >
            Manage your student identity, view academic history, and track your
            progress.
          </p>
        </div>
      </div>
      {error ? (
        <div style={{ color: "#b91c1c", fontWeight: 900, marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div
        className="rg-12" style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 14,
        }}
      >
        {/* Left: Profile Upload & Info */}
        <div style={{ ...card, gridColumn: "span 7" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            {profile.photo_url ? (
              <button
                type="button"
                onClick={() => setFullPhotoOpen(true)}
                title="Poora photo dekhen"
                aria-label="Poora profile photo dekhen"
                style={{
                  padding: 0,
                  border: "1px solid #e5e7eb",
                  borderRadius: "50%",
                  cursor: "pointer",
                  background: "none",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                <img
                  src={profile.photo_url}
                  alt=""
                  style={{
                    width: 72,
                    height: 72,
                    display: "block",
                    objectFit: "cover",
                  }}
                />
              </button>
            ) : (
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: "#dbeafe",
                  color: "#1d4ed8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 1000,
                  fontSize: 28,
                }}
              >
                {photoInitial}
              </div>
            )}
            <div style={{ flex: "1 1 200px" }}>
              <div style={{ fontWeight: 1000, fontSize: 20 }}>
                {profile.name || "Student"}
              </div>
              <div
                style={{
                  marginTop: 4,
                  color: "#6b7280",
                  fontWeight: 900,
                  fontSize: 13,
                }}
              >
                Admission: {profile.admission_number || "—"} | {classDisplay}
              </div>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
            style={{ display: "none" }}
            onChange={onPhotoSelected}
          />
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 12,
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={pickPhoto}
              disabled={photoBusy}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #2563eb",
                background: "#eff6ff",
                color: "#1d4ed8",
                fontWeight: 900,
                cursor: photoBusy ? "not-allowed" : "pointer",
                fontSize: 13,
              }}
            >
              {photoBusy ? "Please wait…" : "Upload photo"}
            </button>
            {(profile.has_photo || profile.photo_url) && (
              <>
                <button
                  type="button"
                  onClick={() => setFullPhotoOpen(true)}
                  disabled={photoBusy}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: "1px solid #0ea5e9",
                    background: "#f0f9ff",
                    color: "#0369a1",
                    fontWeight: 900,
                    cursor: photoBusy ? "not-allowed" : "pointer",
                    fontSize: 13,
                  }}
                >
                  View full photo
                </button>
                <button
                  type="button"
                  onClick={removePhoto}
                  disabled={photoBusy}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    color: "#64748b",
                    fontWeight: 900,
                    cursor: photoBusy ? "not-allowed" : "pointer",
                    fontSize: 13,
                  }}
                >
                  Remove photo
                </button>
              </>
            )}
          </div>
          {photoError ? (
            <div
              style={{
                marginTop: 8,
                color: "#b91c1c",
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              {photoError}
            </div>
          ) : null}
        </div>

        {/* Right: ID Card Display */}
        <div
          style={{
            gridColumn: "span 5",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              width: "100%",
              flex: 1,
              backgroundColor: "#fff",
              borderRadius: 20,
              border: "1px solid #e5e7eb",
              overflow: "hidden",
              boxShadow:
                "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
              fontFamily: "system-ui, -apple-system, sans-serif",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {/* Background Hero Image Watermark */}
            {schoolInfo?.hero_image && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${schoolInfo.hero_image})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  opacity: 0.1,
                  zIndex: 0,
                }}
              />
            )}

            <div
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                height: "100%",
              }}
            >
              {/* ID Card Header */}
              <div
                style={{
                  backgroundColor: "#ffcc00",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  borderBottom: "4px solid #0f172a",
                  position: "relative",
                }}
              >
                {schoolInfo?.logo && (
                  <img
                    src={schoolInfo.logo}
                    alt="Logo"
                    style={{ width: 28, height: 28, objectFit: "contain" }}
                  />
                )}
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#0f172a",
                    letterSpacing: "-0.02em",
                    textAlign: "center",
                  }}
                >
                  {schoolInfo?.name || "Standard Public School"}
                </h2>
              </div>

              <div
                style={{
                  padding: 14,
                  display: "flex",
                  gap: 14,
                  flex: 1,
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
                    {[
                      { label: "Name", value: profile.name },
                      { label: "Adm No", value: profile.admission_number },
                      { label: "Roll No", value: profile.roll_number || "—" },
                      {
                        label: "Class",
                        value: profile.class_section_display || classDisplay,
                      },
                      { label: "Father", value: fatherName },
                      {
                        label: "Blood Group",
                        value: profile.blood_group || "—",
                      },
                      {
                        label: "Phone",
                        value: profile.phone || profile.father_contact || "—",
                      },
                      { label: "Address", value: profile.address || "—" },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        style={{ display: "flex", gap: 6, fontSize: 10 }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            color: "#64748b",
                            minWidth: 80,
                          }}
                        >
                          {item.label}:
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: "#1e293b",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    width: 80,
                    height: 100,
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    backgroundColor: "#f8fafc",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  }}
                >
                  {profile.photo_url ? (
                    <img
                      src={profile.photo_url}
                      alt="Profile"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 900,
                        color: "#e2e8f0",
                      }}
                    >
                      {photoInitial}
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  height: 6,
                  background: "linear-gradient(90deg, #2563eb, #ffcc00)",
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {fullPhotoOpen && profile.photo_url ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full profile photo"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(15, 23, 42, 0.82)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setFullPhotoOpen(false)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "100%",
              maxHeight: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setFullPhotoOpen(false)}
              style={{
                position: "absolute",
                top: -8,
                right: -8,
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "none",
                background: "#fff",
                boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                fontSize: 20,
                lineHeight: 1,
                cursor: "pointer",
                fontWeight: 700,
                color: "#334155",
              }}
              aria-label="Close"
            >
              ×
            </button>
            <img
              src={profile.photo_url}
              alt="Profile — full size"
              style={{
                display: "block",
                maxWidth: "min(920px, 94vw)",
                maxHeight: "min(88vh, 920px)",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                borderRadius: 12,
                boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
              }}
            />
            <p
              style={{
                margin: "12px 0 0",
                textAlign: "center",
                color: "#e2e8f0",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Click the background or press Esc to close.
            </p>
          </div>
        </div>
      ) : null}

      <div
        className="rg-12" style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, minmax(0,1fr))",
          gap: 12,
        }}
      >
        <div style={{ ...card, gridColumn: "span 8" }}>
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>
            Basic Information
          </div>
          <div
            className="rg-autofit-sm" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            <div>
              <strong>Name:</strong> {profile.name || "—"}
            </div>
            <div>
              <strong>Admission Number:</strong>{" "}
              {profile.admission_number || "—"}
            </div>
            <div>
              <strong>Class & Section:</strong> {classDisplay}
            </div>
            <div>
              <strong>Gender:</strong> {profile.gender || "—"}
            </div>
            <div>
              <strong>Date of Birth:</strong> {profile.dob || "—"}
            </div>
            <div>
              <strong>Date of Admission:</strong>{" "}
              {profile.date_of_admission || "—"}
            </div>
            <div>
              <strong>Email:</strong> {profile.email || "—"}
            </div>
            <div>
              <strong>Phone Number:</strong>{" "}
              {profile.phone || profile.father_contact || "—"}
            </div>
            <div>
              <strong>Bus No.:</strong> {profile.bus_no || "N/A"}
            </div>
          </div>
        </div>

        <div style={{ ...card, gridColumn: "span 4" }}>
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>
            Quick Actions
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              type="button"
              onClick={() => navigate("/student/attendance")}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                background: "#e0f2fe",
                color: "#0369a1",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              View Attendance
            </button>
            <button
              type="button"
              onClick={() => navigate("/student/fees")}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                background: "#ecfccb",
                color: "#3f6212",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              View Fees
            </button>
            <button
              type="button"
              onClick={() => navigate("/student/results/exam")}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                background: "#ede9fe",
                color: "#5b21b6",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              View Results
            </button>
            <button
              type="button"
              onClick={viewIdCardPdf}
              disabled={idCardBusy}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                background: "#fef3c7",
                color: "#a16207",
                fontWeight: 900,
                cursor: idCardBusy ? "not-allowed" : "pointer",
                opacity: idCardBusy ? 0.75 : 1,
              }}
            >
              {idCardBusy ? "Preparing…" : "View ID Card (PDF)"}
            </button>
          </div>
        </div>

        <div style={{ ...card, gridColumn: "span 6" }}>
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>
            Parent Details
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div>
              <strong>Father's Name:</strong> {fatherName}
            </div>
            <div>
              <strong>Mother's Name:</strong> {motherName}
            </div>
            <div>
              <strong>Father's Contact:</strong> {profile.father_contact || "—"}
            </div>
            <div>
              <strong>Mother's Contact:</strong> {profile.mother_contact || "—"}
            </div>
            <div>
              <strong>Address:</strong> {profile.address || "—"}
            </div>
          </div>
        </div>

        <div style={{ ...card, gridColumn: "span 6" }}>
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>
            Academic Summary
          </div>
          <div
            className="rg-3" style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0,1fr))",
              gap: 10,
            }}
          >
            <div
              style={{ background: "#eff6ff", borderRadius: 10, padding: 10 }}
            >
              <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 900 }}>
                Attendance %
              </div>
              <div style={{ marginTop: 4, fontWeight: 1000, fontSize: 20 }}>
                {attendanceSummary.percentage.toFixed(1)}%
              </div>
            </div>
            <div
              style={{ background: "#f0fdf4", borderRadius: 10, padding: 10 }}
            >
              <div style={{ fontSize: 12, color: "#166534", fontWeight: 900 }}>
                Total Assignments
              </div>
              <div style={{ marginTop: 4, fontWeight: 1000, fontSize: 20 }}>
                {assignmentSummary.total}
              </div>
            </div>
            <div
              style={{ background: "#fff7ed", borderRadius: 10, padding: 10 }}
            >
              <div style={{ fontSize: 12, color: "#c2410c", fontWeight: 900 }}>
                Pending Assignments
              </div>
              <div style={{ marginTop: 4, fontWeight: 1000, fontSize: 20 }}>
                {assignmentSummary.pending}
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...card, gridColumn: "span 6" }}>
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>
            Attendance Summary
          </div>
          <div
            className="rg-3" style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,minmax(0,1fr))",
              gap: 10,
            }}
          >
            <div
              style={{ background: "#ecfdf5", borderRadius: 10, padding: 10 }}
            >
              <div style={{ fontSize: 12, color: "#166534", fontWeight: 900 }}>
                Present Days
              </div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 1000 }}>
                {attendanceSummary.present}
              </div>
            </div>
            <div
              style={{ background: "#fef2f2", borderRadius: 10, padding: 10 }}
            >
              <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 900 }}>
                Absent Days
              </div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 1000 }}>
                {attendanceSummary.absent}
              </div>
            </div>
            <div
              style={{ background: "#eff6ff", borderRadius: 10, padding: 10 }}
            >
              <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 900 }}>
                Attendance %
              </div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 1000 }}>
                {attendanceSummary.percentage.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...card, gridColumn: "span 6" }}>
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>Fees Summary</div>
          <div
            className="rg-3" style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,minmax(0,1fr))",
              gap: 10,
            }}
          >
            <div
              style={{ background: "#f8fafc", borderRadius: 10, padding: 10 }}
            >
              <div style={{ fontSize: 12, color: "#475569", fontWeight: 900 }}>
                Total Fees
              </div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 1000 }}>
                ₹{feesSummary.total.toFixed(2)}
              </div>
            </div>
            <div
              style={{ background: "#ecfdf5", borderRadius: 10, padding: 10 }}
            >
              <div style={{ fontSize: 12, color: "#166534", fontWeight: 900 }}>
                Paid Amount
              </div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 1000 }}>
                ₹{feesSummary.paid.toFixed(2)}
              </div>
            </div>
            <div
              style={{ background: "#fff7ed", borderRadius: 10, padding: 10 }}
            >
              <div style={{ fontSize: 12, color: "#c2410c", fontWeight: 900 }}>
                Remaining Amount
              </div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 1000 }}>
                ₹{feesSummary.due.toFixed(2)}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={() => navigate("/student/ledger")}
              style={{
                padding: "9px 12px",
                borderRadius: 10,
                border: "none",
                background: "#2563eb",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              View Ledger
            </button>
          </div>
        </div>

        <div style={{ ...card, gridColumn: "span 12" }}>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>Assignments</div>
          <div
            style={{
              marginTop: 4,
              color: "#6b7280",
              fontWeight: 900,
              fontSize: 13,
            }}
          >
            Total: {assignmentSummary.total} | Pending:{" "}
            {assignmentSummary.pending}
          </div>
          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 10,
                      fontSize: 12,
                      color: "#64748b",
                    }}
                  >
                    Title
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 10,
                      fontSize: 12,
                      color: "#64748b",
                    }}
                  >
                    Subject
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 10,
                      fontSize: 12,
                      color: "#64748b",
                    }}
                  >
                    Due Date
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 10,
                      fontSize: 12,
                      color: "#64748b",
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 10,
                      fontSize: 12,
                      color: "#64748b",
                    }}
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAssignments.length ? (
                  sortedAssignments.map((a) => (
                    <tr key={a.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 10, fontWeight: 900 }}>
                        {a.title}
                      </td>
                      <td style={{ padding: 10 }}>{a.subject || "—"}</td>
                      <td style={{ padding: 10 }}>{a.due_date || "—"}</td>
                      <td style={{ padding: 10 }}>
                        <span
                          style={{
                            padding: "5px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 900,
                            background: submissionMap.get(Number(a.id))
                              ? "#dcfce7"
                              : "#fef3c7",
                            color: submissionMap.get(Number(a.id))
                              ? "#166534"
                              : "#a16207",
                          }}
                        >
                          {submissionMap.get(Number(a.id))
                            ? "Submitted"
                            : "Pending"}
                        </span>
                      </td>
                      <td style={{ padding: 10 }}>
                        <button
                          type="button"
                          onClick={() => navigate("/student/assignments")}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            background: "#fff",
                            cursor: "pointer",
                            fontWeight: 900,
                          }}
                        >
                          {submissionMap.get(Number(a.id)) ? "View" : "Submit"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      style={{ padding: 12, color: "#6b7280", fontWeight: 900 }}
                    >
                      No assignments found for your class.
                    </td>
                  </tr>
                )}
              </tbody>
            </table></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

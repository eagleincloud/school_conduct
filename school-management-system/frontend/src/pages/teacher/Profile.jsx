import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";

const colors = {
  bg: "#f9fafb",
  card: "#ffffff",
  border: "#e5e7eb",
  text: "#0f172a",
  muted: "#6b7280",
  primary: "#2563eb",
  present: "#16a34a",
  danger: "#ef4444",
  warn: "#f59e0b",
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
  fontSize: "12px",
  color: colors.muted,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  marginBottom: 6,
};

function toImageSrc(base64) {
  if (!base64) return null;
  if (typeof base64 !== "string") return null;
  if (base64.startsWith("data:")) return base64;
  return `data:image/png;base64,${base64}`;
}

function IconBox({ children, bg = "#eef2ff" }) {
  return (
    <div
      className="dashboard-shell" style={{
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "baseline",
        }}
      >
        <div style={labelStyle}>
          {label}{" "}
          {required ? <span style={{ color: colors.danger }}> *</span> : null}
        </div>
        {error ? (
          <div style={{ color: colors.danger, fontSize: 12, fontWeight: 900 }}>
            {error}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

const TeacherProfile = () => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    gender: "",
    dob: "",
    employee_id: "",
    qualification: "",
    experience_years: "",
    subject_specialization: "",
    joining_date: "",
    status: "Active",
    profile_image_base64: "",
    // teacher fields
    phone_number: "",
  });

  const [formErrors, setFormErrors] = useState({});

  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [idCardBusy, setIdCardBusy] = useState(false);
  const [fullPhotoOpen, setFullPhotoOpen] = useState(false);
  const fileInputRef = useRef(null);

  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  const [docBusy, setDocBusy] = useState(false);
  const [docFile, setDocFile] = useState(null);
  const [docError, setDocError] = useState("");

  const [schoolInfo, setSchoolInfo] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("teachers/profile/"),
      api.get("teachers/profile/documents/"),
      api.get("tenants/common/school-info/").catch(() => ({ data: null })),
    ])
      .then(([pRes, dRes, sRes]) => {
        const p = pRes.data || null;
        setProfile(p);
        setDocuments(dRes.data || []);
        setSchoolInfo(sRes.data || null);

        if (p) {
          setForm({
            name: p.user?.name || "",
            email: p.user?.email || "",
            phone: p.user?.phone || "",
            gender: p.gender || "",
            dob: p.dob || "",
            employee_id: p.employee_id || "",
            qualification: p.qualification || "",
            experience_years: p.experience_years ?? "",
            subject_specialization: p.subject_specialization || "",
            joining_date: p.joining_date || "",
            status: p.status || "Active",
            profile_image_base64:
              p.has_photo || p.photo_url ? "" : p.profile_image_base64 || "",
            phone_number: p.phone_number || p.user?.phone || "",
          });
        }
      })
      .catch(() => setSaveError("Could not load teacher profile."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!fullPhotoOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setFullPhotoOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullPhotoOpen]);

  const previewImageSrc = useMemo(() => {
    if (profile?.photo_url) return profile.photo_url;
    return toImageSrc(form.profile_image_base64);
  }, [profile?.photo_url, form.profile_image_base64]);

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.email.trim()) next.email = "Email is required";
    if (!form.employee_id.trim()) next.employee_id = "Employee ID is required";
    if (!form.subject_specialization.trim())
      next.subject_specialization = "Specialization is required";
    if (!form.qualification.trim())
      next.qualification = "Qualification is required";
    if (!form.experience_years && form.experience_years !== 0)
      next.experience_years = "Experience is required";
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    setSaveError("");
    setSaveSuccess("");
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone || "",
        gender: form.gender || "",
        dob: form.dob || null,
        employee_id: form.employee_id.trim(),
        qualification: form.qualification.trim(),
        experience_years:
          form.experience_years === "" ? null : form.experience_years,
        subject_specialization: form.subject_specialization.trim(),
        joining_date: form.joining_date || null,
        status: form.status || "Active",
        phone_number: form.phone || null,
        profile_image_base64:
          profile?.has_photo || profile?.photo_url
            ? null
            : form.profile_image_base64 || null,
      };

      await api.patch("teachers/profile/", payload);
      const res = await api.get("teachers/profile/");
      setProfile(res.data || null);
      setSaveSuccess("Profile saved successfully.");
    } catch (e) {
      setSaveError(e?.response?.data?.error || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError("");
    setPwSuccess("");
    if (!pwOld || !pwNew || !pwConfirm) {
      setPwError("All password fields are required.");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError("New password and confirm password do not match.");
      return;
    }
    setPwBusy(true);
    try {
      await api.patch("accounts/change-password/", {
        old_password: pwOld,
        new_password: pwNew,
        confirm_password: pwConfirm,
      });
      setPwSuccess("Password updated successfully.");
      setPwOld("");
      setPwNew("");
      setPwConfirm("");
    } catch (e) {
      setPwError(e?.response?.data?.error || "Could not update password.");
    } finally {
      setPwBusy(false);
    }
  };

  const refreshProfile = async () => {
    const res = await api.get("teachers/profile/");
    const p = res.data || null;
    setProfile(p);
    if (p) {
      setForm((prev) => ({
        ...prev,
        profile_image_base64:
          p.has_photo || p.photo_url ? "" : p.profile_image_base64 || "",
      }));
    }
    return p;
  };

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
      await api.post("teachers/profile/photo/", fd);
      await refreshProfile();
    } catch (err) {
      setPhotoError(
        err?.response?.data?.error ||
          err?.response?.data?.detail ||
          "Could not upload photo.",
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const removeProfilePhoto = async () => {
    if (!profile?.has_photo && !profile?.photo_url) return;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      await api.delete("teachers/profile/photo/");
      await refreshProfile();
    } catch (err) {
      setPhotoError(err?.response?.data?.error || "Could not remove photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const fetchIdCardPdf = async (disposition) => {
    const res = await api.get("teachers/profile/id-card/", {
      responseType: "blob",
      params: { disposition },
    });
    return res.data;
  };

  const viewIdCard = async () => {
    setIdCardBusy(true);
    setPhotoError("");
    try {
      const blob = await fetchIdCardPdf("inline");
      const url = URL.createObjectURL(
        new Blob([blob], { type: "application/pdf" }),
      );
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
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

  const handleUploadDoc = async () => {
    setDocError("");
    if (!docFile) {
      setDocError("Please select a file first.");
      return;
    }
    setDocBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", docFile);
      const res = await api.post("teachers/profile/documents/", formData);
      setDocuments((prev) => [res.data, ...(prev || [])]);
      setDocFile(null);
    } catch (e) {
      setDocError(e?.response?.data?.error || "Failed to upload document.");
    } finally {
      setDocBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, color: colors.muted, fontWeight: 900 }}>
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: 20, color: colors.danger, fontWeight: 900 }}>
        Teacher profile not found.
      </div>
    );
  }

  return (
    <div
      className="teacher-page teacher-profile-page"
      style={{
        padding: "24px",
        backgroundColor: colors.bg,
        minHeight: "calc(100vh - 60px)",
      }}
    >
      <style>
        {`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-up { animation: fadeIn 0.4s ease forwards; }
                @media (max-width: 1024px) {
                  .profile-grid-row > div[style*="gridColumn"] {
                    grid-column: span 12 !important;
                  }
                  .profile-id-left { grid-column: span 12 !important; }
                  .profile-id-right { grid-column: span 12 !important; }
                }
                @media (max-width: 768px) {
                  .profile-grid { grid-template-columns: 1fr !important; }
                  .profile-grid-row { grid-template-columns: 1fr !important; }
                  .profile-id-left { grid-column: span 1 !important; }
                  .profile-id-right { grid-column: span 1 !important; }
                }
                `}
      </style>

      {/* Premium Header Card */}
      <div
        className="teacher-page-card animate-up"
        style={{
          backgroundColor: colors.card,
          padding: "28px",
          borderRadius: "24px",
          marginBottom: "20px",
          boxShadow: "0 1px 12px rgba(16,24,40,0.08)",
          border: `1px solid ${colors.border}`,
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
              Teacher Profile
            </h1>
            <p
              style={{
                margin: "8px 0 0",
                color: colors.muted,
                fontWeight: 900,
                fontSize: "15px",
              }}
            >
              Manage your personal identity, academic records, and account
              security.
            </p>
          </div>
          <div className="teacher-profile-actions" style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "12px 24px",
                borderRadius: "14px",
                border: "none",
                backgroundColor: colors.primary,
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 1000,
                fontSize: "15px",
                minWidth: 160,
                opacity: saving ? 0.75 : 1,
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {saveError ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: `1px solid ${colors.danger}`,
            color: colors.danger,
            fontWeight: 900,
            background: "#fff",
          }}
        >
          {saveError}
        </div>
      ) : null}
      {saveSuccess ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #bbf7d0",
            color: "#166534",
            fontWeight: 900,
            background: "#ecfdf5",
            marginBottom: 12,
          }}
        >
          {saveSuccess}
        </div>
      ) : null}

      {fullPhotoOpen && previewImageSrc ? (
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
              src={previewImageSrc}
              alt="Teacher profile full size"
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
          gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {/* Header photo & ID Card Row */}
        <div
          className="rg-12" style={{
            gridColumn: "span 12",
            display: "grid",
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {/* Left: Profile Upload & Info */}
          <div
            style={{
              gridColumn: "span 7",
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
                gap: 14,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: 22,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: "#f3f4f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {previewImageSrc ? (
                  <button
                    type="button"
                    onClick={() => setFullPhotoOpen(true)}
                    title="View full photo"
                    aria-label="View full profile photo"
                    style={{
                      border: "none",
                      padding: 0,
                      margin: 0,
                      width: "100%",
                      height: "100%",
                      cursor: "pointer",
                      background: "transparent",
                    }}
                  >
                    <img
                      src={previewImageSrc}
                      alt="Teacher profile"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </button>
                ) : (
                  <span
                    style={{
                      fontWeight: 1000,
                      color: colors.primary,
                      fontSize: 24,
                    }}
                  >
                    {(form.name || "T").slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div
                  style={{ fontWeight: 1000, fontSize: 18, color: colors.text }}
                >
                  {form.name || "—"}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    color: colors.muted,
                    fontWeight: 900,
                    fontSize: 13,
                  }}
                >
                  {profile.role_label || "Teacher"} • {form.employee_id || "—"}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  style={{ display: "none" }}
                  onChange={onPhotoSelected}
                />
                <div style={{ marginTop: 10 }}>
                  <div style={labelStyle}>Profile Photo</div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <button
                      type="button"
                      onClick={pickPhoto}
                      disabled={photoBusy || idCardBusy}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: `1px solid ${colors.primary}`,
                        background: "#eff6ff",
                        color: colors.primary,
                        fontWeight: 900,
                        cursor: photoBusy ? "not-allowed" : "pointer",
                        fontSize: 13,
                      }}
                    >
                      {photoBusy ? "…" : "Upload"}
                    </button>
                    {(profile?.has_photo || profile?.photo_url) && (
                      <button
                        type="button"
                        onClick={removeProfilePhoto}
                        disabled={photoBusy || idCardBusy}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 10,
                          border: `1px solid ${colors.border}`,
                          background: "#fff",
                          color: colors.muted,
                          fontWeight: 900,
                          cursor: photoBusy ? "not-allowed" : "pointer",
                          fontSize: 13,
                        }}
                      >
                        Remove
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={viewIdCard}
                      disabled={idCardBusy}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: "none",
                        background: "#ecfdf5",
                        color: "#166534",
                        fontWeight: 900,
                        cursor: idCardBusy ? "not-allowed" : "pointer",
                        fontSize: 13,
                      }}
                    >
                      {idCardBusy ? "…" : "View PDF"}
                    </button>
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: colors.muted,
                      fontWeight: 700,
                      lineHeight: 1.4,
                    }}
                  >
                    ID card shows your photo only if you upload one.
                  </div>
                </div>
              </div>
            </div>
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
                border: `1px solid ${colors.border}`,
                overflow: "hidden",
                boxShadow: colors.shadow,
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
                    padding: "14px 20px",
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
                      style={{ width: 32, height: 32, objectFit: "contain" }}
                    />
                  )}
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 20,
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
                    padding: 16,
                    display: "flex",
                    gap: 16,
                    flex: 1,
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "grid", gap: 5, marginTop: 4 }}>
                      {[
                        { label: "Name", value: form.name },
                        { label: "Emp ID", value: form.employee_id },
                        {
                          label: "Role",
                          value: profile.role_label || "Teacher",
                        },
                        { label: "Phone", value: form.phone || "—" },
                        {
                          label: "Subject",
                          value: form.subject_specialization || "—",
                        },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          style={{ display: "flex", gap: 6, fontSize: 12 }}
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
                      width: 90,
                      height: 110,
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      backgroundColor: "#f8fafc",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    }}
                  >
                    {previewImageSrc ? (
                      <img
                        src={previewImageSrc}
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
                          fontSize: 32,
                          fontWeight: 900,
                          color: "#e2e8f0",
                        }}
                      >
                        {(form.name || "T")[0].toUpperCase()}
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

        {/* Basic Info */}
        <div
          style={{
            gridColumn: "span 6",
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
              gap: 12,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <IconBox>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </IconBox>
              <div>
                <div style={labelStyle}>Basic Information</div>
                <div style={{ fontWeight: 1000, color: colors.text }}>
                  Personal Details
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            <Field label="Full Name" required error={formErrors.name}>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                style={{
                  ...inputStyle,
                  borderColor: formErrors.name ? "#fca5a5" : colors.border,
                }}
              />
            </Field>

            <Field label="Email" required error={formErrors.email}>
              <input
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                style={{
                  ...inputStyle,
                  borderColor: formErrors.email ? "#fca5a5" : colors.border,
                }}
              />
            </Field>

            <Field label="Phone Number" error={null}>
              <input
                value={form.phone || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                style={inputStyle}
              />
            </Field>

            <div
              className="rg-2" style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <Field label="Gender" error={null}>
                <input
                  value={form.gender || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, gender: e.target.value }))
                  }
                  style={inputStyle}
                  placeholder="Male/Female/Other"
                />
              </Field>
              <Field label="Date of Birth" error={null}>
                <input
                  type="date"
                  value={form.dob || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, dob: e.target.value }))
                  }
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Professional */}
        <div
          style={{
            gridColumn: "span 6",
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            padding: 16,
            boxShadow: colors.shadow,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <IconBox bg="#ecfdf5">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20" />
                <path d="M8 22V4h12v18" />
                <path d="M8 4l-4 2v16l4-2" />
              </svg>
            </IconBox>
            <div>
              <div style={labelStyle}>Professional Details</div>
              <div style={{ fontWeight: 1000, color: colors.text }}>
                Teaching Profile
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            <Field label="Employee ID" required error={formErrors.employee_id}>
              <input
                value={form.employee_id}
                onChange={(e) =>
                  setForm((p) => ({ ...p, employee_id: e.target.value }))
                }
                style={{
                  ...inputStyle,
                  borderColor: formErrors.employee_id
                    ? "#fca5a5"
                    : colors.border,
                }}
              />
            </Field>

            <Field
              label="Qualification"
              required
              error={formErrors.qualification}
            >
              <input
                value={form.qualification}
                onChange={(e) =>
                  setForm((p) => ({ ...p, qualification: e.target.value }))
                }
                style={{
                  ...inputStyle,
                  borderColor: formErrors.qualification
                    ? "#fca5a5"
                    : colors.border,
                }}
              />
            </Field>

            <Field
              label="Experience (Years)"
              required
              error={formErrors.experience_years}
            >
              <input
                type="number"
                min="0"
                value={form.experience_years}
                onChange={(e) =>
                  setForm((p) => ({ ...p, experience_years: e.target.value }))
                }
                style={{
                  ...inputStyle,
                  borderColor: formErrors.experience_years
                    ? "#fca5a5"
                    : colors.border,
                }}
              />
            </Field>

            <Field label="Subjects assigned" error={null}>
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: 12,
                  background: "#fafafa",
                }}
              >
                {(profile.subjects_assigned || []).length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {profile.subjects_assigned.map((s) => (
                      <span
                        key={s.id}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: "#eef2ff",
                          color: colors.primary,
                          fontWeight: 1000,
                          fontSize: 12,
                        }}
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: colors.muted, fontWeight: 900 }}>
                    No subjects assigned
                  </div>
                )}
              </div>
            </Field>
          </div>
        </div>

        {/* Academic */}
        <div
          style={{
            gridColumn: "span 6",
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            padding: 16,
            boxShadow: colors.shadow,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <IconBox bg="#eff6ff">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 7l9-4 9 4-9 4-9-4Z" />
                <path d="M21 10v6" />
                <path d="M3 10v6" />
                <path d="M12 14v6" />
              </svg>
            </IconBox>
            <div>
              <div style={labelStyle}>Academic Info</div>
              <div style={{ fontWeight: 1000, color: colors.text }}>
                Academic Metadata
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            <Field
              label="Specialization"
              required
              error={formErrors.subject_specialization}
            >
              <input
                value={form.subject_specialization}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    subject_specialization: e.target.value,
                  }))
                }
                style={{
                  ...inputStyle,
                  borderColor: formErrors.subject_specialization
                    ? "#fca5a5"
                    : colors.border,
                }}
              />
            </Field>

            <Field label="Joining Date" error={null}>
              <input
                type="date"
                value={form.joining_date || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, joining_date: e.target.value }))
                }
                style={inputStyle}
              />
            </Field>

            <Field label="Role" error={null}>
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: 12,
                  background: "#fafafa",
                  fontWeight: 1000,
                  color: colors.text,
                }}
              >
                {profile.role_label || "Teacher"}
              </div>
            </Field>
          </div>
        </div>

        {/* Classes assigned */}
        <div
          style={{
            gridColumn: "span 6",
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            padding: 16,
            boxShadow: colors.shadow,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <IconBox bg="#fefce8">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
                <path d="M7 8h10" />
                <path d="M7 12h6" />
              </svg>
            </IconBox>
            <div>
              <div style={labelStyle}>Classes Assigned</div>
              <div style={{ fontWeight: 1000, color: colors.text }}>
                Teaching Schedule
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {(profile.classes_assigned || []).length ? (
              profile.classes_assigned.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 14,
                    padding: 12,
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontWeight: 1000, color: colors.text }}>
                    {c.class_name} - {c.section_name}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      color: colors.muted,
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    Students: {c.student_count}{" "}
                    {c.room_number ? `• Room: ${c.room_number}` : ""}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: colors.muted, fontWeight: 900 }}>
                No classes assigned.
              </div>
            )}
          </div>
        </div>

        {/* Account settings */}
        <div
          style={{
            gridColumn: "span 7",
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            padding: 16,
            boxShadow: colors.shadow,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <IconBox bg="#f5f3ff">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 1v4" />
                <path d="M12 19v4" />
                <path d="M4.22 4.22l2.83 2.83" />
                <path d="M16.95 16.95l2.83 2.83" />
                <path d="M1 12h4" />
                <path d="M19 12h4" />
                <path d="M4.22 19.78l2.83-2.83" />
                <path d="M16.95 7.05l2.83-2.83" />
              </svg>
            </IconBox>
            <div>
              <div style={labelStyle}>Account Settings</div>
              <div style={{ fontWeight: 1000, color: colors.text }}>
                Password & Contact
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            <div
              className="rg-2" style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <Field label="New Contact Email" required={false} error={null}>
                <input
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="New Contact Phone" required={false} error={null}>
                <input
                  value={form.phone || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  style={inputStyle}
                />
              </Field>
            </div>

            <div
              style={{
                borderTop: `1px solid ${colors.border}`,
                paddingTop: 12,
              }}
            >
              <div
                style={{
                  fontWeight: 1000,
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                Change Password
              </div>
              <div
                className="rg-2" style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <Field label="Old Password" required={true} error={null}>
                  <input
                    type="password"
                    value={pwOld}
                    onChange={(e) => setPwOld(e.target.value)}
                    style={inputStyle}
                  />
                </Field>
                <Field label="New Password" required={true} error={null}>
                  <input
                    type="password"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </div>
              <div style={{ marginTop: 12 }}>
                <Field
                  label="Confirm New Password"
                  required={true}
                  error={null}
                >
                  <input
                    type="password"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </div>
              {pwError ? (
                <div
                  style={{
                    marginTop: 10,
                    color: colors.danger,
                    fontWeight: 900,
                  }}
                >
                  {pwError}
                </div>
              ) : null}
              {pwSuccess ? (
                <div
                  style={{
                    marginTop: 10,
                    color: "#166534",
                    fontWeight: 900,
                    background: "#ecfdf5",
                    border: "1px solid #bbf7d0",
                    padding: "10px 12px",
                    borderRadius: 12,
                  }}
                >
                  {pwSuccess}
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
                  onClick={handleChangePassword}
                  disabled={pwBusy}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "none",
                    backgroundColor: colors.primary,
                    color: "#fff",
                    cursor: pwBusy ? "not-allowed" : "pointer",
                    fontWeight: 1000,
                    opacity: pwBusy ? 0.75 : 1,
                  }}
                >
                  {pwBusy ? "Updating..." : "Update Password"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Activity stats */}
        <div
          style={{
            gridColumn: "span 5",
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            padding: 16,
            boxShadow: colors.shadow,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <IconBox bg="#ecfdf5">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
              </svg>
            </IconBox>
            <div>
              <div style={labelStyle}>Activity Stats</div>
              <div style={{ fontWeight: 1000, color: colors.text }}>
                Overview
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 14,
                padding: 12,
                background: "#fafafa",
              }}
            >
              <div
                style={{
                  color: colors.muted,
                  fontWeight: 900,
                  fontSize: 12,
                  textTransform: "uppercase",
                }}
              >
                Total classes handled
              </div>
              <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 22 }}>
                {profile.stats?.total_classes_handled ?? 0}
              </div>
            </div>
            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 14,
                padding: 12,
                background: "#fafafa",
              }}
            >
              <div
                style={{
                  color: colors.muted,
                  fontWeight: 900,
                  fontSize: 12,
                  textTransform: "uppercase",
                }}
              >
                Total students
              </div>
              <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 22 }}>
                {profile.stats?.total_students ?? 0}
              </div>
            </div>
            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 14,
                padding: 12,
                background: "#fafafa",
              }}
            >
              <div
                style={{
                  color: colors.muted,
                  fontWeight: 900,
                  fontSize: 12,
                  textTransform: "uppercase",
                }}
              >
                Assignments created
              </div>
              <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 22 }}>
                {profile.stats?.assignments_created ?? 0}
              </div>
            </div>
            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 14,
                padding: 12,
                background: "#fafafa",
              }}
            >
              <div
                style={{
                  color: colors.muted,
                  fontWeight: 900,
                  fontSize: 12,
                  textTransform: "uppercase",
                }}
              >
                Attendance records
              </div>
              <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 22 }}>
                {profile.stats?.attendance_records ?? 0}
              </div>
            </div>
          </div>
        </div>

        {/* Documents */}
        <div
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
              gap: 12,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={labelStyle}>Documents (Optional)</div>
              <div style={{ fontWeight: 1000, color: colors.text }}>
                Upload certificates / resume
              </div>
              <div
                style={{
                  marginTop: 6,
                  color: colors.muted,
                  fontWeight: 900,
                  fontSize: 13,
                }}
              >
                Supported: PDF/DOC/DOCX/Images.
              </div>
            </div>
            <div style={{ minWidth: 300 }}>
              <div style={labelStyle}>Upload</div>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp"
                onChange={(e) => {
                  setDocError("");
                  setDocFile(e.target.files?.[0] || null);
                }}
                style={inputStyle}
              />
              {docError ? (
                <div
                  style={{
                    marginTop: 6,
                    color: colors.danger,
                    fontWeight: 900,
                    fontSize: 12,
                  }}
                >
                  {docError}
                </div>
              ) : null}
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={handleUploadDoc}
                  disabled={docBusy}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "none",
                    backgroundColor: colors.primary,
                    color: "#fff",
                    cursor: docBusy ? "not-allowed" : "pointer",
                    fontWeight: 1000,
                    opacity: docBusy ? 0.75 : 1,
                  }}
                >
                  {docBusy ? "Uploading..." : "Upload Document"}
                </button>
              </div>
            </div>
          </div>

          <div
            className="rg-autofit" style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))",
              gap: 12,
            }}
          >
            {(documents || []).length ? (
              documents.map((d) => (
                <div
                  key={d.id}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 14,
                    padding: 12,
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontWeight: 1000, color: colors.text }}>
                    Document #{d.id}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    {d.file_url ? (
                      <a
                        href={d.file_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: colors.primary,
                          textDecoration: "none",
                          fontWeight: 1000,
                        }}
                      >
                        Open / Download
                      </a>
                    ) : (
                      <div style={{ color: colors.muted, fontWeight: 900 }}>
                        No file
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      color: colors.muted,
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    {new Date(d.uploaded_at).toLocaleString()}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: colors.muted, fontWeight: 900 }}>
                No documents uploaded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherProfile;

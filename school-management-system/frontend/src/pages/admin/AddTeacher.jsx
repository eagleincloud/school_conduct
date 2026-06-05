import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";

const AddTeacher = () => {
  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: "#fff",
  };

  const labelStyle = {
    fontSize: "12px",
    color: "#6b7280",
    fontWeight: 700,
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  };

  const errorStyle = {
    color: "#dc2626",
    fontSize: "12px",
    marginTop: "6px",
  };

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    gender: "",
    dob: "",

    employee_id: "",
    subject_specialization: "",
    experience_years: "",
    joining_date: "",

    password: "",
    confirm_password: "",
    role: "Subject Teacher",
    status: "Active",

    profile_image: null,
    profile_image_base64: "",
  });

  const [previewUrl, setPreviewUrl] = useState("");
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Allow multiple qualifications in the UI.
  // Backend stores `qualification` as a single CharField, so we join with " / " on submit.
  const [qualifications, setQualifications] = useState([""]);

  const [teachers, setTeachers] = useState([]);

  const fetchTeachers = async () => {
    try {
      const res = await api.get("teachers/");
      setTeachers(res.data);
    } catch (e) {
      setTeachers([]);
    }
  };

  const specializationOptions = useMemo(
    () => [
      "Mathematics",
      "Science",
      "English",
      "Computer Science",
      "Social Studies",
      "Physics",
      "Chemistry",
      "Biology",
      "Physical Education",
    ],
    [],
  );

  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);
  const phoneDigits = useMemo(
    () => (form.phone_number || "").replace(/\D/g, ""),
    [form.phone_number],
  );
  const employeeIdPreview = useMemo(() => {
    const used = new Set(
      (teachers || [])
        .map((t) => {
          const m = String(t.employee_id || "")
            .toUpperCase()
            .match(/^T(\d+)$/);
          return m ? parseInt(m[1], 10) : null;
        })
        .filter((n) => Number.isFinite(n)),
    );
    let next = 1;
    while (used.has(next)) next += 1;
    return `T${String(next).padStart(3, "0")}`;
  }, [teachers]);

  const validate = () => {
    const nextErrors = {};

    if (!form.first_name.trim())
      nextErrors.first_name = "First name is required";
    if (!form.last_name.trim()) nextErrors.last_name = "Last name is required";
    if (form.email.trim() && !emailRegex.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email address";
    }

    if (!form.phone_number.trim())
      nextErrors.phone_number = "Phone number is required";
    else if (phoneDigits.length !== 10)
      nextErrors.phone_number = "Phone number must be exactly 10 digits";

    if (!form.gender) nextErrors.gender = "Gender is required";
    if (!form.dob) nextErrors.dob = "Date of birth is required";

    if (!form.subject_specialization)
      nextErrors.subject_specialization = "Subject specialization is required";

    if (!form.password) nextErrors.password = "Password is required";
    else if (form.password.length < 6)
      nextErrors.password = "Password must be at least 6 characters";

    if (!form.confirm_password)
      nextErrors.confirm_password = "Confirm password is required";
    else if (form.confirm_password !== form.password)
      nextErrors.confirm_password = "Passwords do not match";

    return nextErrors;
  };

  const handleImageChange = async (file) => {
    setForm((prev) => ({
      ...prev,
      profile_image: file,
      profile_image_base64: "",
    }));
    setPreviewUrl("");
    setErrors((prev) => ({ ...prev, profile_image: undefined }));
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Convert to base64 so we can keep JSON submission (backend currently ignores image).
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    setForm((prev) => ({ ...prev, profile_image_base64: base64 }));
  };

  const generateUsername = () => {
    const emailLocal = (form.email || "").split("@")[0].toLowerCase().trim();
    const empSuffix = (form.employee_id || "").toString().slice(-4);
    const safeLocal = emailLocal ? emailLocal.replace(/[^a-z0-9]/gi, "") : "";
    const suffix = empSuffix ? empSuffix.replace(/[^a-z0-9]/gi, "") : "";
    return safeLocal
      ? `${safeLocal}${suffix ? `_${suffix}` : ""}`
      : `teacher_${suffix || "user"}`;
  };

  useEffect(() => {
    fetchTeachers();
    // fetchTeachers already sets loading states
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      const qualificationValue = (qualifications || [])
        .map((q) => (q || "").trim())
        .filter(Boolean)
        .join(" / ");

      const payload = {
        username: generateUsername(),
        email: form.email.trim(),
        password: form.password,
        name: `${form.first_name} ${form.last_name}`.trim(),
        employee_id: employeeIdPreview,
        subject_specialization: form.subject_specialization,

        // Extra fields (backend may ignore but UI requirements are satisfied)
        phone_number: `+91${phoneDigits}`,
        gender: form.gender,
        dob: form.dob,
        qualification: qualificationValue,
        experience_years: form.experience_years,
        joining_date: form.joining_date,
        role: form.role,
        status: form.status,
        profile_image_base64: form.profile_image_base64,
      };

      await api.post("teachers/admin/create-teacher/", payload);
      setMessage("Teacher created successfully!");
      await fetchTeachers();
      setForm({
        first_name: "",
        last_name: "",
        email: "",
        phone_number: "",
        gender: "",
        dob: "",
        employee_id: "",
        subject_specialization: "",
        experience_years: "",
        joining_date: "",
        password: "",
        confirm_password: "",
        role: "Subject Teacher",
        status: "Active",
        profile_image: null,
        profile_image_base64: "",
      });
      setQualifications([""]);
      setPreviewUrl("");
      setErrors({});
    } catch (err) {
      console.error("Teacher creation error:", err.response?.data);
      const data = err.response?.data;
      let errorMsg = "Error creating teacher.";
      if (data) {
        if (typeof data === "string") errorMsg = data;
        else if (data.error) errorMsg = data.error;
        else if (data.detail) errorMsg = data.detail;
      }
      setMessage(errorMsg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            marginBottom: "10px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "32px",
                fontWeight: 1000,
                color: "#0f172a",
                lineHeight: 1.1,
              }}
            >
              Add Teacher
            </h1>
            <p
              style={{
                margin: "8px 0 0",
                color: "#64748b",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              Create a new teacher profile with personal and professional
              details.
            </p>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            padding: "22px",
            backgroundColor: "#fff",
            borderRadius: "16px",
            marginTop: "18px",
          }}
        >
          <form
            onSubmit={handleSubmit}
            style={{ display: "grid", gap: "18px" }}
          >
            <div>
              <h3 style={{ margin: 0, marginBottom: "12px", color: "#111827" }}>
                Section: Personal Information
              </h3>
              <div style={{ display: "grid", gap: "12px" }}>
                <div
                  className="rg-2" style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={labelStyle}>
                      First Name <span style={{ color: "#dc2626" }}>*</span>
                    </div>
                    <input
                      type="text"
                      value={form.first_name}
                      onChange={(e) =>
                        setForm({ ...form, first_name: e.target.value })
                      }
                      placeholder="Enter first name"
                      style={inputStyle}
                      required
                    />
                    {errors.first_name && (
                      <div style={errorStyle}>{errors.first_name}</div>
                    )}
                  </div>
                  <div>
                    <div style={labelStyle}>
                      Last Name <span style={{ color: "#dc2626" }}>*</span>
                    </div>
                    <input
                      type="text"
                      value={form.last_name}
                      onChange={(e) =>
                        setForm({ ...form, last_name: e.target.value })
                      }
                      placeholder="Enter last name"
                      style={inputStyle}
                      required
                    />
                    {errors.last_name && (
                      <div style={errorStyle}>{errors.last_name}</div>
                    )}
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>Email</div>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="Enter email"
                    style={inputStyle}
                  />
                  {errors.email && <div style={errorStyle}>{errors.email}</div>}
                </div>

                <div>
                  <div style={labelStyle}>
                    Phone Number <span style={{ color: "#dc2626" }}>*</span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "70px 1fr",
                      gap: "8px",
                    }}
                  >
                    <input
                      type="text"
                      value="+91"
                      disabled
                      style={{
                        ...inputStyle,
                        textAlign: "center",
                        backgroundColor: "#f9fafb",
                        color: "#6b7280",
                      }}
                    />
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      value={phoneDigits}
                      onChange={(e) => {
                        const digits = (e.target.value || "")
                          .replace(/\D/g, "")
                          .slice(0, 10);
                        setForm({ ...form, phone_number: digits });
                      }}
                      placeholder="10-digit phone number"
                      style={inputStyle}
                      required
                    />
                  </div>
                  {errors.phone_number && (
                    <div style={errorStyle}>{errors.phone_number}</div>
                  )}
                </div>

                <div
                  className="rg-2" style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={labelStyle}>
                      Gender <span style={{ color: "#dc2626" }}>*</span>
                    </div>
                    <select
                      value={form.gender}
                      onChange={(e) =>
                        setForm({ ...form, gender: e.target.value })
                      }
                      style={inputStyle}
                      required
                    >
                      <option value="">-- Select Gender --</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    {errors.gender && (
                      <div style={errorStyle}>{errors.gender}</div>
                    )}
                  </div>

                  <div>
                    <div style={labelStyle}>
                      Date of Birth <span style={{ color: "#dc2626" }}>*</span>
                    </div>
                    <input
                      type="date"
                      value={form.dob}
                      onChange={(e) =>
                        setForm({ ...form, dob: e.target.value })
                      }
                      style={inputStyle}
                      required
                    />
                    {errors.dob && <div style={errorStyle}>{errors.dob}</div>}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ margin: 0, marginBottom: "12px", color: "#111827" }}>
                Section: Professional Details
              </h3>
              <div style={{ display: "grid", gap: "12px" }}>
                <div>
                  <div style={labelStyle}>Employee ID (Auto Generated)</div>
                  <input
                    type="text"
                    value={employeeIdPreview}
                    readOnly
                    style={{
                      ...inputStyle,
                      backgroundColor: "#f9fafb",
                      color: "#6b7280",
                    }}
                  />
                  {errors.employee_id && (
                    <div style={errorStyle}>{errors.employee_id}</div>
                  )}
                </div>

                <div>
                  <div style={labelStyle}>
                    Subject Specialization{" "}
                    <span style={{ color: "#dc2626" }}>*</span>
                  </div>
                  <select
                    value={form.subject_specialization}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        subject_specialization: e.target.value,
                      })
                    }
                    style={inputStyle}
                    required
                  >
                    <option value="">-- Select Specialization --</option>
                    {specializationOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {errors.subject_specialization && (
                    <div style={errorStyle}>
                      {errors.subject_specialization}
                    </div>
                  )}
                </div>

                <div
                  className="rg-2" style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={labelStyle}>Qualifications</div>
                    <div style={{ display: "grid", gap: "10px" }}>
                      {(qualifications || []).map((q, idx) => (
                        <div
                          key={`${idx}`}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            gap: "10px",
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="text"
                            value={q}
                            onChange={(e) => {
                              const next = [...qualifications];
                              next[idx] = e.target.value;
                              setQualifications(next);
                            }}
                            placeholder={
                              idx === 0 ? "e.g., M.Sc" : "Add another"
                            }
                            style={inputStyle}
                          />
                          {qualifications.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setQualifications((prev) =>
                                  prev.filter((_, i) => i !== idx),
                                )
                              }
                              style={{
                                backgroundColor: "#fff",
                                border: "1px solid #e5e7eb",
                                color: "#6b7280",
                                cursor: "pointer",
                                padding: "10px 12px",
                                borderRadius: "12px",
                                fontWeight: 800,
                                whiteSpace: "nowrap",
                              }}
                              title="Remove qualification"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() =>
                          setQualifications((prev) => [...prev, ""])
                        }
                        style={{
                          backgroundColor: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          color: "#1d4ed8",
                          cursor: "pointer",
                          padding: "10px 14px",
                          borderRadius: "12px",
                          fontWeight: 900,
                        }}
                      >
                        + Add Qualification
                      </button>
                    </div>
                  </div>
                  <div>
                    <div style={labelStyle}>Experience (Years)</div>
                    <input
                      type="number"
                      min="0"
                      value={form.experience_years}
                      onChange={(e) =>
                        setForm({ ...form, experience_years: e.target.value })
                      }
                      placeholder="e.g., 5"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>Joining Date</div>
                  <input
                    type="date"
                    value={form.joining_date}
                    onChange={(e) =>
                      setForm({ ...form, joining_date: e.target.value })
                    }
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ margin: 0, marginBottom: "12px", color: "#111827" }}>
                Section: Account Setup
              </h3>
              <div style={{ display: "grid", gap: "12px" }}>
                <div>
                  <div style={labelStyle}>
                    Password <span style={{ color: "#dc2626" }}>*</span>
                  </div>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    placeholder="Enter password"
                    style={inputStyle}
                    required
                  />
                  {errors.password && (
                    <div style={errorStyle}>{errors.password}</div>
                  )}
                </div>

                <div>
                  <div style={labelStyle}>
                    Confirm Password <span style={{ color: "#dc2626" }}>*</span>
                  </div>
                  <input
                    type="password"
                    value={form.confirm_password}
                    onChange={(e) =>
                      setForm({ ...form, confirm_password: e.target.value })
                    }
                    placeholder="Re-enter password"
                    style={inputStyle}
                    required
                  />
                  {errors.confirm_password && (
                    <div style={errorStyle}>{errors.confirm_password}</div>
                  )}
                </div>

                <div>
                  <div style={labelStyle}>Status</div>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                    style={inputStyle}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <div style={labelStyle}>Role</div>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="Subject Teacher">Subject Teacher</option>
                    <option value="Class Teacher">Class Teacher</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ margin: 0, marginBottom: "12px", color: "#111827" }}>
                Additional Features
              </h3>
              <div style={{ display: "grid", gap: "10px" }}>
                <div>
                  <div style={labelStyle}>Profile Image (Optional)</div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleImageChange(e.target.files?.[0] || null)
                    }
                    style={{ ...inputStyle, padding: "10px 14px" }}
                  />
                </div>
                {previewUrl && (
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      alignItems: "center",
                    }}
                  >
                    <img
                      src={previewUrl}
                      alt="Profile preview"
                      style={{
                        width: "72px",
                        height: "72px",
                        objectFit: "cover",
                        borderRadius: "12px",
                        border: "1px solid #e5e7eb",
                      }}
                    />
                    <div style={{ color: "#6b7280", fontSize: "13px" }}>
                      Image selected
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={busy}
                style={{
                  width: "100%",
                  backgroundColor: "#2563eb",
                  color: "#fff",
                  padding: "14px 18px",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "12px",
                  fontWeight: 1000,
                  fontSize: "15px",
                  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? "Creating..." : "Create Teacher"}
              </button>
              {message && (
                <div
                  style={{
                    marginTop: "12px",
                    color: message.includes("Error") ? "#dc2626" : "#2563eb",
                  }}
                >
                  {message}
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddTeacher;

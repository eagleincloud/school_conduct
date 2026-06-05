import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";

const inputStyle = {
  width: "100%",
  padding: "12px 12px",
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
  fontWeight: 900,
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const cardStyle = {
  backgroundColor: "#fff",
  borderRadius: "16px",
  border: "1px solid #e5e7eb",
  boxShadow: "0 1px 6px rgba(16,24,40,0.06)",
  padding: "18px",
};

const initialForm = {
  title: "",
  description: "",
  subject: "",
  class_id: "",
  section_id: "",
  class_section: "",
  start_date: "",
  due_date: "",
  total_marks: "100",
  submission_type: "online",
  instructions: "",
  file_url: "",
  attachment: null,
};

const Assignment = () => {
  const [classSections, setClassSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    Promise.allSettled([
      api.get("classes/sections/"),
      api.get("subjects/", { params: { status: "Active" } }),
    ])
      .then(([classRes, subjectRes]) => {
        if (classRes.status === "fulfilled") {
          setClassSections(classRes.value?.data || []);
        } else {
          setClassSections([]);
        }

        if (subjectRes.status === "fulfilled") {
          setSubjects(subjectRes.value?.data || []);
        } else {
          setSubjects([]);
        }

        if (
          classRes.status !== "fulfilled" &&
          subjectRes.status !== "fulfilled"
        ) {
          setLoadError("Could not load class/subject data");
        }
      })
      .catch(() => setLoadError("Could not load class/subject data"));
  }, []);

  const classOptions = useMemo(() => {
    const map = new Map();
    (classSections || []).forEach((cs) => {
      if (!map.has(cs.class_id)) map.set(cs.class_id, cs.class_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [classSections]);

  const sectionOptions = useMemo(() => {
    const allSections = classSections || [];
    if (!formData.class_id) return allSections;
    return allSections.filter(
      (cs) => String(cs.class_id) === String(formData.class_id),
    );
  }, [classSections, formData.class_id]);

  const subjectOptions = useMemo(() => {
    const allSubjects = subjects || [];
    if (!formData.class_id) return allSubjects;
    return allSubjects.filter(
      (s) => String(s.class_ref) === String(formData.class_id),
    );
  }, [subjects, formData.class_id]);

  const selectedFileName = formData.attachment ? formData.attachment.name : "";

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setSuccessMsg("");
  };

  const onClassChange = (classId) => {
    setFormData((prev) => ({
      ...prev,
      class_id: classId,
      section_id: "",
      class_section: "",
      subject: "",
    }));
    setErrors((prev) => ({
      ...prev,
      class_id: undefined,
      section_id: undefined,
      class_section: undefined,
      subject: undefined,
    }));
    setSuccessMsg("");
  };

  const onSectionChange = (classSectionId) => {
    const sec = sectionOptions.find(
      (s) => String(s.id) === String(classSectionId),
    );
    setFormData((prev) => ({
      ...prev,
      section_id: sec ? String(sec.section_id) : "",
      class_section: sec ? String(sec.id) : "",
    }));
    setErrors((prev) => ({
      ...prev,
      section_id: undefined,
      class_section: undefined,
    }));
    setSuccessMsg("");
  };

  const validate = () => {
    const next = {};
    if (!formData.title.trim()) next.title = "Title is required";
    if (!formData.subject) next.subject = "Subject is required";
    if (!formData.class_id) next.class_id = "Class is required";
    if (!formData.section_id) next.section_id = "Section is required";
    if (!formData.class_section)
      next.class_section = "Class section is required";
    if (!formData.start_date) next.start_date = "Start date is required";
    if (!formData.due_date) next.due_date = "Due date is required";
    if (
      formData.start_date &&
      formData.due_date &&
      formData.due_date < formData.start_date
    ) {
      next.due_date = "Due date cannot be before start date";
    }
    const total = Number(formData.total_marks);
    if (Number.isNaN(total) || total <= 0)
      next.total_marks = "Total marks must be greater than 0";
    if (formData.attachment) {
      const name = (formData.attachment.name || "").toLowerCase();
      if (
        !name.endsWith(".pdf") &&
        !name.endsWith(".doc") &&
        !name.endsWith(".docx")
      ) {
        next.attachment = "Only PDF, DOC, DOCX allowed";
      }
      if (formData.attachment.size > 10 * 1024 * 1024) {
        next.attachment = "File size must be <= 10 MB";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg("");
    if (!validate()) return;

    const payload = new FormData();
    payload.append("title", formData.title.trim());
    payload.append("description", formData.description || "");
    payload.append("subject", formData.subject);
    payload.append("class_section", formData.class_section);
    payload.append("start_date", formData.start_date);
    payload.append("due_date", formData.due_date);
    payload.append("total_marks", formData.total_marks);
    payload.append("submission_type", formData.submission_type);
    payload.append("instructions", formData.instructions || "");
    payload.append("file_url", formData.file_url || "");
    if (formData.attachment) payload.append("attachment", formData.attachment);

    setSubmitting(true);
    try {
      await api.post("assignments/create/", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccessMsg("Assignment created successfully. Students are notified.");
      setFormData(initialForm);
      setErrors({});
    } catch (err) {
      const data = err?.response?.data || {};
      const apiErrors = {};
      Object.keys(data).forEach((k) => {
        const v = data[k];
        apiErrors[k] = Array.isArray(v)
          ? v[0]
          : typeof v === "string"
            ? v
            : "Invalid value";
      });
      setErrors((prev) => ({
        ...prev,
        ...apiErrors,
        form: apiErrors.form || data.error || "Failed to create assignment",
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ ...cardStyle, maxWidth: "1000px", margin: "0 auto" }}>
        <h1 style={{ margin: 0 }}>Create Assignment</h1>
        <p
          style={{
            margin: "8px 0 0",
            color: "#6b7280",
            fontWeight: 900,
            fontSize: "13px",
          }}
        >
          Create and publish assignment quickly for selected class & subject.
        </p>

        {loadError ? (
          <div style={{ marginTop: "12px", color: "#b91c1c", fontWeight: 900 }}>
            {loadError}
          </div>
        ) : null}
        {errors.form ? (
          <div style={{ marginTop: "12px", color: "#b91c1c", fontWeight: 900 }}>
            {errors.form}
          </div>
        ) : null}
        {successMsg ? (
          <div style={{ marginTop: "12px", color: "#166534", fontWeight: 900 }}>
            {successMsg}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          style={{ marginTop: "16px", display: "grid", gap: "14px" }}
        >
          <div
            className="rg-autofit-sm" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "12px",
            }}
          >
            <div>
              <div style={labelStyle}>Title *</div>
              <input
                value={formData.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="e.g. Algebra Worksheet 3"
                style={{
                  ...inputStyle,
                  borderColor: errors.title ? "#fca5a5" : inputStyle.border,
                }}
              />
              {errors.title ? (
                <div
                  style={{
                    marginTop: 6,
                    color: "#b91c1c",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {errors.title}
                </div>
              ) : null}
            </div>

            <div>
              <div style={labelStyle}>Subject *</div>
              <select
                value={formData.subject}
                onChange={(e) => setField("subject", e.target.value)}
                style={{
                  ...inputStyle,
                  borderColor: errors.subject ? "#fca5a5" : inputStyle.border,
                }}
              >
                <option value="">-- Select Subject --</option>
                {subjectOptions.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name || s.subject_name || "Unnamed Subject"}
                  </option>
                ))}
              </select>
              {errors.subject ? (
                <div
                  style={{
                    marginTop: 6,
                    color: "#b91c1c",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {errors.subject}
                </div>
              ) : null}
            </div>

            <div>
              <div style={labelStyle}>Class *</div>
              <select
                value={formData.class_id}
                onChange={(e) => onClassChange(e.target.value)}
                style={{
                  ...inputStyle,
                  borderColor: errors.class_id ? "#fca5a5" : inputStyle.border,
                }}
              >
                <option value="">-- Select Class --</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.class_id ? (
                <div
                  style={{
                    marginTop: 6,
                    color: "#b91c1c",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {errors.class_id}
                </div>
              ) : null}
            </div>

            <div>
              <div style={labelStyle}>Section *</div>
              <select
                value={formData.class_section}
                onChange={(e) => onSectionChange(e.target.value)}
                style={{
                  ...inputStyle,
                  borderColor: errors.section_id
                    ? "#fca5a5"
                    : inputStyle.border,
                }}
              >
                <option value="">-- Select Section --</option>
                {sectionOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formData.class_id
                      ? s.section_name
                      : `${s.class_name} - ${s.section_name}`}
                  </option>
                ))}
              </select>
              {errors.section_id ? (
                <div
                  style={{
                    marginTop: 6,
                    color: "#b91c1c",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {errors.section_id}
                </div>
              ) : null}
            </div>

            <div>
              <div style={labelStyle}>Start Date * (Calendar)</div>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setField("start_date", e.target.value)}
                style={{
                  ...inputStyle,
                  borderColor: errors.start_date
                    ? "#fca5a5"
                    : inputStyle.border,
                }}
              />
              {errors.start_date ? (
                <div
                  style={{
                    marginTop: 6,
                    color: "#b91c1c",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {errors.start_date}
                </div>
              ) : null}
            </div>

            <div>
              <div style={labelStyle}>Due Date * (Calendar)</div>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setField("due_date", e.target.value)}
                style={{
                  ...inputStyle,
                  borderColor: errors.due_date ? "#fca5a5" : inputStyle.border,
                }}
              />
              {errors.due_date ? (
                <div
                  style={{
                    marginTop: 6,
                    color: "#b91c1c",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {errors.due_date}
                </div>
              ) : null}
            </div>

            <div>
              <div style={labelStyle}>Total Marks *</div>
              <input
                type="number"
                min="1"
                value={formData.total_marks}
                onChange={(e) => setField("total_marks", e.target.value)}
                style={{
                  ...inputStyle,
                  borderColor: errors.total_marks
                    ? "#fca5a5"
                    : inputStyle.border,
                }}
              />
              {errors.total_marks ? (
                <div
                  style={{
                    marginTop: 6,
                    color: "#b91c1c",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {errors.total_marks}
                </div>
              ) : null}
            </div>

            <div>
              <div style={labelStyle}>Submission Type *</div>
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  ...inputStyle,
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 900,
                    color: "#374151",
                  }}
                >
                  <input
                    type="radio"
                    name="submission_type"
                    value="online"
                    checked={formData.submission_type === "online"}
                    onChange={(e) =>
                      setField("submission_type", e.target.value)
                    }
                  />
                  Online
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 900,
                    color: "#374151",
                  }}
                >
                  <input
                    type="radio"
                    name="submission_type"
                    value="offline"
                    checked={formData.submission_type === "offline"}
                    onChange={(e) =>
                      setField("submission_type", e.target.value)
                    }
                  />
                  Offline
                </label>
              </div>
            </div>
          </div>

          <div>
            <div style={labelStyle}>Description</div>
            <textarea
              value={formData.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Short assignment overview"
              style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }}
            />
          </div>

          <div>
            <div style={labelStyle}>Instructions (Optional)</div>
            <textarea
              value={formData.instructions}
              onChange={(e) => setField("instructions", e.target.value)}
              placeholder="Any submission rules or marking scheme"
              style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }}
            />
          </div>

          <div
            className="rg-autofit" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "12px",
            }}
          >
            <div>
              <div style={labelStyle}>File Upload (PDF, DOC)</div>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) =>
                  setField("attachment", e.target.files?.[0] || null)
                }
                style={{ ...inputStyle, padding: "10px" }}
              />
              {errors.attachment ? (
                <div
                  style={{
                    marginTop: 6,
                    color: "#b91c1c",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {errors.attachment}
                </div>
              ) : null}
              {selectedFileName ? (
                <div
                  style={{
                    marginTop: 6,
                    color: "#374151",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  Selected: {selectedFileName}
                </div>
              ) : null}
            </div>

            <div>
              <div style={labelStyle}>Or External File URL</div>
              <input
                type="url"
                value={formData.file_url}
                onChange={(e) => setField("file_url", e.target.value)}
                placeholder="https://..."
                style={inputStyle}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setFormData(initialForm);
                setErrors({});
                setSuccessMsg("");
              }}
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                backgroundColor: "#fff",
                cursor: "pointer",
                fontWeight: 900,
              }}
              disabled={submitting}
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "12px 16px",
                borderRadius: "12px",
                border: "none",
                backgroundColor: "#2563eb",
                color: "#fff",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.75 : 1,
                fontWeight: 1000,
                minWidth: "170px",
              }}
            >
              {submitting ? "Creating..." : "Create Assignment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Assignment;

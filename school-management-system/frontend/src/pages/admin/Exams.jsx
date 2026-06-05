import React, { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';

const colors = {
    primary: '#2563eb',
    primaryLight: '#eff6ff',
    secondary: '#0f172a',
    success: '#10b981',
    successLight: '#ecfdf5',
    warning: '#f59e0b',
    warningLight: '#fffbeb',
    danger: '#ef4444',
    dangerLight: '#fef2f2',
    border: '#e2e8f0',
    text: '#1e293b',
    textMuted: '#64748b',
    bg: '#f8fafc',
    white: '#ffffff',
};

const card = {
    backgroundColor: colors.white,
    border: `1px solid ${colors.border}`,
    borderRadius: '24px',
    padding: '32px',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -4px rgba(0,0,0,0.05)',
    transition: 'all 0.3s ease',
};

const input = {
    width: '100%',
    padding: '14px 18px',
    border: `2px solid ${colors.border}`,
    borderRadius: '16px',
    fontSize: '14px',
    fontWeight: 500,
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
    transition: 'all 0.2s ease',
};

const label = {
    fontSize: '13px',
    color: colors.textMuted,
    fontWeight: 800,
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
};

const stepBadgeStyle = (active, done) => ({
    padding: '12px 24px',
    borderRadius: '20px',
    fontWeight: 900,
    fontSize: '14px',
    backgroundColor: done ? colors.successLight : active ? colors.primaryLight : colors.white,
    color: done ? colors.success : active ? colors.primary : colors.textMuted,
    border: `2px solid ${done ? colors.success : active ? colors.primary : colors.border}`,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
});

/** Backend may return { error } or DRF field errors { start_time: [...] } — surface both. */
function formatApiError(err, fallback) {
    const d = err?.response?.data;
    if (!d) return err?.message || fallback;
    if (typeof d.error === 'string') return d.error;
    if (typeof d.detail === 'string') return d.detail;
    if (Array.isArray(d)) return d.map(String).join(' | ');
    if (typeof d === 'object') {
        const parts = Object.entries(d).map(([k, v]) => {
            const val = Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
            return `${k}: ${val}`;
        });
        if (parts.length) return parts.join(' | ');
    }
    return fallback;
}

function normalizeTimeForApi(t) {
    if (!t || typeof t !== 'string') return t;
    const s = t.trim();
    if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
    if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
    return t;
}

function timeToMinutes(t) {
    const raw = normalizeTimeForApi(t);
    if (!raw) return null;
    const [h, m, sec] = raw.split(':').map((x) => parseInt(x, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const s = Number.isNaN(sec) ? 0 : sec;
    return h * 60 + m + s / 60;
}

const Exams = () => {
    const confirm = useConfirm();
    const [exams, setExams] = useState([]);
    const [sections, setSections] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [schedules, setSchedules] = useState([]);

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const [step, setStep] = useState(1); // 1 create, 2 schedule, 3 publish
    const [selectedExamId, setSelectedExamId] = useState('');
    const [scheduleForm, setScheduleForm] = useState({
        subject: '',
        exam_date: '',
        start_time: '',
        end_time: '',
    });
    const [editingScheduleId, setEditingScheduleId] = useState(null);
    const [editScheduleForm, setEditScheduleForm] = useState({
        subject: '',
        exam_date: '',
        start_time: '',
        end_time: '',
    });

    const [examForm, setExamForm] = useState({
        name: '',
        class_section: '',
        exam_type: 'unit_test',
        start_date: '',
        end_date: '',
        total_marks: '',
        passing_marks: '',
        status: 'Draft',
        description: '',
    });

    const [publishing, setPublishing] = useState(false);
    const [subjectStatus, setSubjectStatus] = useState(null);
    const [resultsClassFilter, setResultsClassFilter] = useState('all');
    const [overviewClassFilter, setOverviewClassFilter] = useState('all');
    const [overviewStatusFilter, setOverviewStatusFilter] = useState('all');
    const [overviewTypeFilter, setOverviewTypeFilter] = useState('all');
    const [editingExamId, setEditingExamId] = useState(null);
    const [deletingExamId, setDeletingExamId] = useState(null);
    const [editExamForm, setEditExamForm] = useState({
        name: '',
        class_section: '',
        exam_type: 'unit_test',
        start_date: '',
        end_date: '',
        total_marks: '',
        passing_marks: '',
        status: 'Draft',
        description: '',
    });

    const [viewingExam, setViewingExam] = useState(null);

    const selectedExam = useMemo(() => exams.find((e) => String(e.id) === String(selectedExamId)) || null, [exams, selectedExamId]);

    const refreshExams = async () => {
        const res = await api.get('academics/exams/');
        setExams(res.data || []);
    };

    const loadMeta = async () => {
        try {
            const sRes = await api.get('classes/admin-sections/');
            const raw = sRes.data || [];
            const sorted = [...raw].sort((a, b) => {
                const k1 = `${a.class_name || ''}-${a.section_name || ''}`;
                const k2 = `${b.class_name || ''}-${b.section_name || ''}`;
                return k1.localeCompare(k2, undefined, { numeric: true });
            });
            setSections(sorted);
        } catch {
            const sRes = await api.get('classes/sections/');
            setSections(sRes.data || []);
        }
    };

    useEffect(() => {
        setLoading(true);
        Promise.all([refreshExams(), loadMeta()])
            .catch(() => setError('Failed to load exam data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selectedExam) {
            setSchedules([]);
            setSubjects([]);
            setSubjectStatus(null);
            return;
        }
        const sec = sections.find((s) => String(s.id) === String(selectedExam.class_section));
        if (!sec) return;

        Promise.all([
            api.get(`academics/exams/${selectedExam.id}/schedule/`),
            api.get('subjects/', { params: { class_id: sec.class_id, status: 'Active' } }),
        ])
            .then(([schRes, subRes]) => {
                setSchedules(schRes.data || []);
                setSubjects(subRes.data || []);
            })
            .catch(() => {});
    }, [selectedExamId, sections, selectedExam]);

    useEffect(() => {
        if (!selectedExamId) {
            setSubjectStatus(null);
            return;
        }
        api.get(`academics/exams/${selectedExamId}/subject-status/`)
            .then((res) => setSubjectStatus(res.data))
            .catch(() => setSubjectStatus(null));
    }, [selectedExamId]);

    const onCreateExam = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        if (!examForm.name || !examForm.class_section || !examForm.start_date || !examForm.end_date || !examForm.total_marks || !examForm.passing_marks) {
            setError('Please fill all required fields.');
            return;
        }
        if (examForm.start_date > examForm.end_date) {
            setError('Start date must be before end date.');
            return;
        }
        try {
            const payload = {
                ...examForm,
                total_marks: examForm.total_marks || 0,
                passing_marks: examForm.passing_marks || 0,
                date: examForm.start_date || undefined,
            };
            const res = await api.post('academics/exams/', payload);
            setMessage('Exam created successfully');
            await refreshExams();
            setSelectedExamId(String(res.data.id));
            setStep(2);
            setExamForm({
                name: '',
                class_section: '',
                exam_type: 'unit_test',
                start_date: '',
                end_date: '',
                total_marks: '',
                passing_marks: '',
                status: 'Draft',
                description: '',
            });
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to create exam');
        }
    };

    const addSchedule = async (e) => {
        e.preventDefault();
        if (!selectedExamId) return;

        // Prevent duplicate subjects on frontend
        const isDuplicate = schedules.some(s => s.subject === scheduleForm.subject);
        if (isDuplicate) {
            setError(`"${scheduleForm.subject}" is already scheduled for this exam.`);
            return;
        }
        if (!scheduleForm.subject || !scheduleForm.exam_date || !scheduleForm.start_time || !scheduleForm.end_time) {
            setError('Please fill all schedule fields.');
            return;
        }
        const startM = timeToMinutes(scheduleForm.start_time);
        const endM = timeToMinutes(scheduleForm.end_time);
        if (startM != null && endM != null && startM >= endM) {
            setError('Start time must be before end time.');
            return;
        }
        setError('');
        try {
            await api.post(`academics/exams/${selectedExamId}/schedule/`, {
                subject: scheduleForm.subject,
                exam_date: scheduleForm.exam_date,
                start_time: normalizeTimeForApi(scheduleForm.start_time),
                end_time: normalizeTimeForApi(scheduleForm.end_time),
            });
            const res = await api.get(`academics/exams/${selectedExamId}/schedule/`);
            setSchedules(res.data || []);
            setScheduleForm({ subject: '', exam_date: '', start_time: '', end_time: '' });
            setMessage('Subject schedule added');
            setStep(3);
        } catch (err) {
            setError(formatApiError(err, 'Failed to add schedule'));
        }
    };

    const deleteSchedule = async (id) => {
        try {
            await api.delete(`academics/schedule/${id}/`);
            const res = await api.get(`academics/exams/${selectedExamId}/schedule/`);
            setSchedules(res.data || []);
        } catch (e) {
            setError('Failed to delete schedule row');
        }
    };

    const startEditSchedule = (row) => {
        setEditingScheduleId(row.id);
        setEditScheduleForm({
            subject: row.subject || '',
            exam_date: row.exam_date || '',
            start_time: row.start_time || '',
            end_time: row.end_time || '',
        });
    };

    const cancelEditSchedule = () => {
        setEditingScheduleId(null);
        setEditScheduleForm({
            subject: '',
            exam_date: '',
            start_time: '',
            end_time: '',
        });
    };

    const saveScheduleEdit = async () => {
        if (!editingScheduleId) return;
        setError('');
        if (editScheduleForm.start_time >= editScheduleForm.end_time) {
            setError('Start time must be before end time.');
            return;
        }
        try {
            await api.patch(`academics/schedule/${editingScheduleId}/`, editScheduleForm);
            const res = await api.get(`academics/exams/${selectedExamId}/schedule/`);
            setSchedules(res.data || []);
            setMessage('Schedule updated');
            cancelEditSchedule();
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to update schedule');
        }
    };

    const togglePublishResults = async (publish) => {
        if (!selectedExamId) return;
        setPublishing(true);
        setError('');
        try {
            await api.put(`academics/exams/${selectedExamId}/publish-results/`, { publish });
            await refreshExams();
            const statusRes = await api.get(`academics/exams/${selectedExamId}/subject-status/`);
            setSubjectStatus(statusRes.data);
            setMessage(publish ? 'Results published' : 'Results unpublished');
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to update publish status');
        } finally {
            setPublishing(false);
        }
    };

    const startEditExam = (exam) => {
        setEditingExamId(exam.id);
        setEditExamForm({
            name: exam.name || '',
            class_section: exam.class_section ? String(exam.class_section) : '',
            exam_type: exam.exam_type || 'Midterm',
            start_date: exam.start_date || '',
            end_date: exam.end_date || '',
            total_marks: exam.total_marks ?? '',
            passing_marks: exam.passing_marks ?? '',
            status: exam.status || 'Draft',
            description: exam.description || '',
        });
        setError('');
        setMessage('');
    };

    const cancelEditExam = () => {
        setEditingExamId(null);
        setEditExamForm({
            name: '',
            class_section: '',
            exam_type: 'unit_test',
            start_date: '',
            end_date: '',
            total_marks: '',
            passing_marks: '',
            status: 'Draft',
            description: '',
        });
    };

    const saveExamEdit = async () => {
        if (!editingExamId) return;
        setError('');
        setMessage('');
        if (!editExamForm.name || !editExamForm.class_section || !editExamForm.start_date || !editExamForm.end_date) {
            setError('Please fill required exam fields.');
            return;
        }
        if (editExamForm.start_date > editExamForm.end_date) {
            setError('Start date must be before end date.');
            return;
        }
        try {
            const payload = {
                ...editExamForm,
                total_marks: editExamForm.total_marks || 0,
                passing_marks: editExamForm.passing_marks || 0,
                date: editExamForm.start_date || undefined,
            };
            await api.patch(`academics/exams/${editingExamId}/`, payload);
            await refreshExams();
            setMessage('Exam updated successfully');
            cancelEditExam();
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to update exam');
        }
    };

    const deleteExam = async (examId, examName) => {
        const ok = await confirm(`Delete exam "${examName}"? This will also remove schedule and results linked to it.`);
        if (!ok) return;
        setDeletingExamId(examId);
        setError('');
        setMessage('');
        try {
            await api.delete(`academics/exams/${examId}/`);
            await refreshExams();
            if (String(selectedExamId) === String(examId)) {
                setSelectedExamId('');
                setStep(1);
                setSchedules([]);
                setSubjects([]);
            }
            setMessage('Exam deleted successfully');
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to delete exam');
        } finally {
            setDeletingExamId(null);
        }
    };

    const overviewExams = useMemo(() => {
        return (exams || []).filter((e) => {
            if (overviewClassFilter !== 'all' && String(e.class_section) !== String(overviewClassFilter)) return false;
            if (overviewStatusFilter !== 'all' && String(e.status) !== String(overviewStatusFilter)) return false;
            if (overviewTypeFilter !== 'all' && String(e.exam_type) !== String(overviewTypeFilter)) return false;
            return true;
        });
    }, [exams, overviewClassFilter, overviewStatusFilter, overviewTypeFilter]);

    const resultManagementExams = useMemo(() => {
        return (exams || []).filter((e) => {
            if (resultsClassFilter !== 'all' && String(e.class_section) !== String(resultsClassFilter)) return false;
            return true;
        });
    }, [exams, resultsClassFilter]);

    useEffect(() => {
        if (!selectedExamId) return;
        const exists = resultManagementExams.some((e) => String(e.id) === String(selectedExamId));
        if (!exists) {
            setSelectedExamId('');
            setSubjectStatus(null);
        }
    }, [resultManagementExams, selectedExamId]);

    const done1 = !!selectedExamId;
    const done2 = done1 && schedules.length > 0;

    return (
        <div style={{ padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', flexWrap: 'wrap', backgroundColor: colors.white, padding: '32px', borderRadius: '24px', marginBottom: '32px', border: `1px solid ${colors.border}` }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '40px', fontWeight: 1000, color: colors.secondary, letterSpacing: '-1.5px' }}>Exam Engine</h1>
                    <div style={{ marginTop: '8px', color: colors.textMuted, fontWeight: 700, fontSize: '15px' }}>
                        Architecting academic milestones with precision and clarity.
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', position: 'relative' }}>
                    <div style={stepBadgeStyle(step === 1, done1)}>
                        <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: done1 ? colors.success : (step === 1 ? colors.primary : colors.border), color: colors.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>{done1 ? '✓' : '1'}</span>
                        Define
                    </div>
                    <div style={stepBadgeStyle(step === 2, done2)}>
                       <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: done2 ? colors.success : (step === 2 ? colors.primary : colors.border), color: colors.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>{done2 ? '✓' : '2'}</span>
                        Schedule
                    </div>
                    <div style={stepBadgeStyle(step === 3, done2)}>
                        <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: (step === 3 ? colors.primary : colors.border), color: colors.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>3</span>
                        Review
                    </div>
                </div>
            </div>

            {(message || error) && (
                <div
                    style={{
                        marginBottom: '32px',
                        padding: '16px 24px',
                        borderRadius: '20px',
                        border: `2px solid ${error ? colors.danger : colors.primary}`,
                        backgroundColor: error ? colors.dangerLight : colors.primaryLight,
                        color: error ? colors.danger : colors.primary,
                        fontWeight: 800,
                        fontSize: '15px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        animation: 'slideDown 0.4s easeOut',
                    }}
                >
                    <span style={{ fontSize: '20px' }}>{error ? '⚠️' : '🎉'}</span>
                    {error || message}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.5fr 1.4fr', gap: '32px' }}>
                {/* Step 1 */}
                <div style={card}>
                    <div style={{ fontSize: '20px', fontWeight: 1000, color: colors.secondary, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ color: colors.primary }}>01</span> Create Definition
                    </div>
                    <form onSubmit={onCreateExam} style={{ display: 'grid', gap: '20px' }}>
                        <div>
                            <div style={label}>Exam Name</div>
                            <input value={examForm.name} onChange={(e) => setExamForm({ ...examForm, name: e.target.value })} style={input} placeholder="e.g., Mid-Term Assessment 2024" required />
                        </div>
                        <div>
                            <div style={label}>Class / Section</div>
                            <select value={examForm.class_section} onChange={(e) => setExamForm({ ...examForm, class_section: e.target.value })} style={input} required>
                                <option value="">-- Choose target classroom --</option>
                                {sections.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        Class {s.class_name} • {s.section_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <div style={label}>Assessment Category</div>
                            <select value={examForm.exam_type} onChange={(e) => setExamForm({ ...examForm, exam_type: e.target.value })} style={input}>
                                <option value="unit_test">Unit Test</option>
                                <option value="class_test">Class Test</option>
                                <option value="mst">MST</option>
                                <option value="final">Final Exam</option>
                            </select>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <div style={label}>Assessment Start</div>
                                <input type="date" value={examForm.start_date} onChange={(e) => setExamForm({ ...examForm, start_date: e.target.value })} style={input} required />
                            </div>
                            <div>
                                <div style={label}>Assessment End</div>
                                <input type="date" value={examForm.end_date} onChange={(e) => setExamForm({ ...examForm, end_date: e.target.value })} style={input} required />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <div style={label}>Weightage (Max)</div>
                                <input type="number" value={examForm.total_marks} onChange={(e) => setExamForm({ ...examForm, total_marks: e.target.value })} style={input} placeholder="100" required />
                            </div>
                            <div>
                                <div style={label}>Passing Threshold</div>
                                <input type="number" value={examForm.passing_marks} onChange={(e) => setExamForm({ ...examForm, passing_marks: e.target.value })} style={input} placeholder="33" required />
                            </div>
                        </div>
                        <div>
                            <div style={label}>Initial Status</div>
                            <select value={examForm.status} onChange={(e) => setExamForm({ ...examForm, status: e.target.value })} style={input}>
                                <option value="Draft">Private Draft</option>
                                <option value="Published">Publicly Visible</option>
                            </select>
                        </div>
                        <div>
                            <div style={label}>Internal Notes (optional)</div>
                            <textarea value={examForm.description} onChange={(e) => setExamForm({ ...examForm, description: e.target.value })} style={{ ...input, minHeight: '80px', resize: 'vertical' }} placeholder="Guidelines for teachers..." />
                        </div>
                        <button type="submit" style={{ padding: '18px', borderRadius: '18px', border: 'none', backgroundColor: colors.primary, color: '#fff', fontSize: '16px', fontWeight: 900, cursor: 'pointer', transition: 'all 0.3s', boxShadow: `0 8px 20px -6px ${colors.primary}66` }}>
                            Initialize Exam Record ➔
                        </button>
                    </form>
                </div>

                {/* Step 2 + 3 */}
                <div style={{ display: 'grid', gap: '16px' }}>
                    <div style={card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 900 }}>Step 2: Add Schedule</div>
                            <select value={selectedExamId} onChange={(e) => { setSelectedExamId(e.target.value); setStep(e.target.value ? 2 : 1); }} style={{ ...input, width: '280px' }}>
                                <option value="">-- Select Exam --</option>
                                {exams.map((e) => (
                                    <option key={e.id} value={e.id}>
                                        {e.name} ({e.class_section_display || `${e.class_name}-${e.section_name}`})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {!selectedExamId ? (
                            <div style={{ color: '#6b7280', fontWeight: 800, fontSize: '13px' }}>
                                Create exam first, then select it to add schedule.
                            </div>
                        ) : (
                            <form onSubmit={addSchedule}>
                                    <div style={{ display: 'grid', gap: '16px', backgroundColor: colors.bg, padding: '24px', borderRadius: '20px', marginBottom: '24px', border: `1px solid ${colors.border}` }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                                            <div>
                                                <div style={label}>Subject</div>
                                                <select value={scheduleForm.subject} onChange={(e) => setScheduleForm({ ...scheduleForm, subject: e.target.value })} style={input} required>
                                                    <option value="">-- Choose Subject --</option>
                                                    {subjects.map((s) => (
                                                        <option key={s.id} value={s.name}>
                                                            {s.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <div style={label}>Date of Exam</div>
                                                <input type="date" value={scheduleForm.exam_date} onChange={(e) => setScheduleForm({ ...scheduleForm, exam_date: e.target.value })} style={input} required />
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
                                            <div>
                                                <div style={label}>Start Time</div>
                                                <input type="time" value={scheduleForm.start_time} onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })} style={input} required />
                                            </div>
                                            <div>
                                                <div style={label}>End Time</div>
                                                <input type="time" value={scheduleForm.end_time} onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })} style={input} required />
                                            </div>
                                            <button type="submit" style={{ padding: '12px 18px', borderRadius: '16px', border: 'none', backgroundColor: colors.success, color: '#fff', fontWeight: '900', cursor: 'pointer', height: '52px', transition: 'all 0.3s', boxShadow: `0 8px 20px -6px ${colors.success}66`, minWidth: '130px', whiteSpace: 'nowrap', fontSize: '14px' }}>
                                                Create Time
                                            </button>
                                        </div>
                                    </div>

                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#f2f4f7' }}>
                                                <th style={{ padding: '10px', textAlign: 'left' }}>Subject</th>
                                                <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                                                <th style={{ padding: '10px', textAlign: 'left' }}>Start</th>
                                                <th style={{ padding: '10px', textAlign: 'left' }}>End</th>
                                                <th style={{ padding: '10px', textAlign: 'left' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {schedules.map((r) => (
                                                <tr key={r.id} style={{ borderTop: '1px solid #eef2f7' }}>
                                                    <td style={{ padding: '10px', fontWeight: 800 }}>
                                                        {editingScheduleId === r.id ? (
                                                            <input
                                                                value={editScheduleForm.subject}
                                                                onChange={(e) => setEditScheduleForm({ ...editScheduleForm, subject: e.target.value })}
                                                                style={input}
                                                            />
                                                        ) : (
                                                            r.subject
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '10px' }}>
                                                        {editingScheduleId === r.id ? (
                                                            <input
                                                                type="date"
                                                                value={editScheduleForm.exam_date}
                                                                onChange={(e) => setEditScheduleForm({ ...editScheduleForm, exam_date: e.target.value })}
                                                                style={input}
                                                            />
                                                        ) : (
                                                            r.exam_date
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '10px' }}>
                                                        {editingScheduleId === r.id ? (
                                                            <input
                                                                type="time"
                                                                value={editScheduleForm.start_time}
                                                                onChange={(e) => setEditScheduleForm({ ...editScheduleForm, start_time: e.target.value })}
                                                                style={input}
                                                            />
                                                        ) : (
                                                            r.start_time
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '10px' }}>
                                                        {editingScheduleId === r.id ? (
                                                            <input
                                                                type="time"
                                                                value={editScheduleForm.end_time}
                                                                onChange={(e) => setEditScheduleForm({ ...editScheduleForm, end_time: e.target.value })}
                                                                style={input}
                                                            />
                                                        ) : (
                                                            r.end_time
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '10px' }}>
                                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                            {editingScheduleId === r.id ? (
                                                                <>
                                                                    <button type="button" onClick={saveScheduleEdit} style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#ecfdf5', color: '#16a34a', fontWeight: 800, cursor: 'pointer' }}>
                                                                        Save
                                                                    </button>
                                                                    <button type="button" onClick={cancelEditSchedule} style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#fff', color: '#64748b', fontWeight: 800, cursor: 'pointer' }}>
                                                                        Cancel
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button type="button" onClick={() => startEditSchedule(r)} style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 800, cursor: 'pointer' }}>
                                                                        Edit
                                                                    </button>
                                                                    <button type="button" onClick={() => deleteSchedule(r.id)} style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#fef2f2', color: '#ef4444', fontWeight: 800, cursor: 'pointer' }}>
                                                                        Delete
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {schedules.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} style={{ padding: '12px', color: '#6b7280', fontWeight: 800 }}>
                                                        No schedule rows yet. Add subjects to continue.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

                {/* Overview widget */}
                <div style={card}>
                    <div style={{ fontSize: '20px', fontWeight: 1000, color: colors.secondary, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        📊 Global Overview
                    </div>
                    <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
                        <div>
                            <div style={label}>Class Filter</div>
                            <select value={overviewClassFilter} onChange={(e) => setOverviewClassFilter(e.target.value)} style={input}>
                                <option value="all">Display All Classrooms</option>
                                {sections.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        Class {s.class_name} • {s.section_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <div style={label}>Status</div>
                                <select value={overviewStatusFilter} onChange={(e) => setOverviewStatusFilter(e.target.value)} style={input}>
                                    <option value="all">Any</option>
                                    <option value="Draft">Draft</option>
                                    <option value="Published">Public</option>
                                </select>
                            </div>
                            <div>
                                <div style={label}>Type</div>
                                <select value={overviewTypeFilter} onChange={(e) => setOverviewTypeFilter(e.target.value)} style={input}>
                                    <option value="all">Any</option>
                                    <option value="unit_test">Unit</option>
                                    <option value="class_test">Class</option>
                                    <option value="mst">MST</option>
                                    <option value="final">Final</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 800, color: colors.text, borderLeft: `4px solid ${colors.primary}`, paddingLeft: '12px' }}>
                        Active Evaluations: {overviewExams.length}
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: colors.textMuted, fontWeight: 700 }}>Synthesizing records...</div>
                    ) : overviewExams.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', border: `2px dashed ${colors.border}`, borderRadius: '20px', color: colors.textMuted }}>
                            <div style={{ fontSize: '24px', marginBottom: '10px' }}>🔍</div>
                            <div style={{ fontWeight: 800 }}>No evaluations match your filters</div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '14px', maxHeight: '600px', overflowY: 'auto', paddingRight: '4px' }}>
                            {overviewExams.map((e) => (
                                <div key={e.id} style={{ 
                                    border: `1px solid ${colors.border}`, 
                                    borderRadius: '20px', 
                                    padding: '20px', 
                                    backgroundColor: selectedExamId === String(e.id) ? colors.primaryLight : '#fff',
                                    transition: 'all 0.2s ease',
                                    borderLeft: `6px solid ${e.status === 'Published' ? colors.success : colors.warning}`,
                                    position: 'relative'
                                }}>
                                    {editingExamId === e.id ? (
                                        <div style={{ display: 'grid', gap: '12px' }}>
                                            <input value={editExamForm.name} onChange={(ev) => setEditExamForm({ ...editExamForm, name: ev.target.value })} style={input} />
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                <input type="date" value={editExamForm.start_date} onChange={(ev) => setEditExamForm({ ...editExamForm, start_date: ev.target.value })} style={input} />
                                                <input type="date" value={editExamForm.end_date} onChange={(ev) => setEditExamForm({ ...editExamForm, end_date: ev.target.value })} style={input} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button type="button" onClick={saveExamEdit} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', backgroundColor: colors.success, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Save</button>
                                                <button type="button" onClick={cancelEditExam} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: `1px solid ${colors.border}`, backgroundColor: '#fff', color: colors.text, fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ fontWeight: 900, color: colors.secondary, fontSize: '15px' }}>{e.name}</div>
                                                <span style={{ fontSize: '10px', fontWeight: 1000, backgroundColor: e.status === 'Published' ? colors.successLight : colors.warningLight, color: e.status === 'Published' ? colors.success : colors.warning, padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>{e.status}</span>
                                            </div>
                                            <div style={{ marginTop: '6px', fontSize: '13px', color: colors.textMuted, fontWeight: 700 }}>
                                                {e.class_section_display || `${e.class_name}-${e.section_name}`}
                                            </div>
                                            <div style={{ marginTop: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>📅 {e.start_date}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>📊 {e.total_marks} Pts</div>
                                            </div>
                                            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                                                <button onClick={() => setViewingExam(e)} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: 'none', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '12px', fontWeight: 900, cursor: 'pointer' }}>View</button>
                                                <button onClick={() => startEditExam(e)} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: 'none', backgroundColor: '#eff6ff', color: '#2563eb', fontSize: '12px', fontWeight: 900, cursor: 'pointer' }}>Edit</button>
                                                <button onClick={() => deleteExam(e.id, e.name)} disabled={deletingExamId === e.id} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: 'none', backgroundColor: '#fef2f2', color: '#ef4444', fontSize: '12px', fontWeight: 900, cursor: 'pointer' }}>Delete</button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {viewingExam && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
                    <div style={{ ...card, width: 'min(900px, 100%)', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
                        <button onClick={() => setViewingExam(null)} style={{ position: 'absolute', top: '24px', right: '24px', background: colors.primaryLight, border: 'none', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer', fontSize: '20px', color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>×</button>
                        
                        <div style={{ marginBottom: '32px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 1000, color: colors.primary, backgroundColor: colors.primaryLight, padding: '6px 12px', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{viewingExam.exam_type}</span>
                            <h2 style={{ fontSize: '32px', fontWeight: 1000, color: colors.secondary, margin: '12px 0 8px 0' }}>{viewingExam.name}</h2>
                            <div style={{ color: colors.textMuted, fontWeight: 700, fontSize: '16px' }}>{viewingExam.class_section_display || `${viewingExam.class_name}-${viewingExam.section_name}`}</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                            <div style={{ padding: '20px', backgroundColor: colors.bg, borderRadius: '20px', border: `1px solid ${colors.border}` }}>
                                <div style={label}>Timeline</div>
                                <div style={{ fontWeight: 800, color: colors.text }}>{viewingExam.start_date} to {viewingExam.end_date}</div>
                            </div>
                            <div style={{ padding: '20px', backgroundColor: colors.bg, borderRadius: '20px', border: `1px solid ${colors.border}` }}>
                                <div style={label}>Grading</div>
                                <div style={{ fontWeight: 800, color: colors.text }}>Passing: {viewingExam.passing_marks} / {viewingExam.total_marks}</div>
                            </div>
                            <div style={{ padding: '20px', backgroundColor: colors.bg, borderRadius: '20px', border: `1px solid ${colors.border}` }}>
                                <div style={label}>Current Status</div>
                                <div style={{ fontWeight: 800, color: viewingExam.status === 'Published' ? colors.success : colors.warning }}>{viewingExam.status}</div>
                            </div>
                        </div>

                        <div style={{ fontSize: '18px', fontWeight: 1000, color: colors.secondary, marginBottom: '16px' }}>Examination Schedule</div>
                        <div style={{ overflowX: 'auto', borderRadius: '16px', border: `1px solid ${colors.border}` }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: colors.bg }}>
                                        <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '13px', color: colors.textMuted }}>Subject</th>
                                        <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '13px', color: colors.textMuted }}>Date</th>
                                        <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '13px', color: colors.textMuted }}>Start</th>
                                        <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '13px', color: colors.textMuted }}>End</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(exams.find(ex => ex.id === viewingExam.id)?.schedules || []).length > 0 ? (
                                        exams.find(ex => ex.id === viewingExam.id).schedules.map((s, idx) => (
                                            <tr key={idx} style={{ borderTop: `1px solid ${colors.border}` }}>
                                                <td style={{ padding: '14px 20px', fontWeight: 800, color: colors.text }}>{s.subject}</td>
                                                <td style={{ padding: '14px 20px', color: colors.text }}>{s.exam_date}</td>
                                                <td style={{ padding: '14px 20px', color: colors.text }}>{s.start_time}</td>
                                                <td style={{ padding: '14px 20px', color: colors.text }}>{s.end_time}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: colors.textMuted, fontWeight: 700 }}>No schedule defined for this exam yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {viewingExam.description && (
                            <div style={{ marginTop: '32px' }}>
                                <div style={label}>Internal Notes</div>
                                <div style={{ padding: '16px', backgroundColor: colors.primaryLight, borderRadius: '16px', color: colors.primary, fontSize: '14px', lineHeight: '1.6', fontWeight: 600 }}>
                                    {viewingExam.description}
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: '40px', display: 'flex', gap: '16px' }}>
                            <button onClick={() => setViewingExam(null)} style={{ flex: 1, padding: '16px', borderRadius: '16px', border: `2px solid ${colors.border}`, backgroundColor: 'transparent', color: colors.text, fontWeight: 900, cursor: 'pointer' }}>Close View</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Exams;

import React, { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import { useParams } from 'react-router-dom';
import api from '../../services/api';

const SubjectDetails = () => {
    const confirm = useConfirm();
    const { subjectId } = useParams();

    const [loading, setLoading] = useState(false);
    const [subject, setSubject] = useState(null);
    const [notes, setNotes] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [marks, setMarks] = useState([]);

    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);

    const [noteForm, setNoteForm] = useState({
        title: '',
        description: '',
        link_url: '',
        file_base64: '',
        file_name: '',
    });

    const [assignmentForm, setAssignmentForm] = useState({
        title: '',
        due_date: '',
        file_base64: '',
        file_name: '',
    });

    const inputStyle = {
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        fontSize: '13px',
        outline: 'none',
        boxSizing: 'border-box',
        backgroundColor: '#fff',
    };

    const labelStyle = {
        fontSize: '12px',
        color: '#6b7280',
        fontWeight: 700,
        marginBottom: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
    };

    const resetNoteForm = () =>
        setNoteForm({
            title: '',
            description: '',
            link_url: '',
            file_base64: '',
            file_name: '',
        });

    const resetAssignmentForm = () =>
        setAssignmentForm({
            title: '',
            due_date: '',
            file_base64: '',
            file_name: '',
        });

    const fetchSubjectDetails = async () => {
        setLoading(true);
        try {
            const res = await api.get(`subjects/${subjectId}/details/`);
            setSubject(res.data);
            setNotes(res.data?.notes || []);
            setAssignments(res.data?.assignments || []);
        } catch (e) {
            alert('Error loading subject details');
        } finally {
            setLoading(false);
        }
    };

    const fetchMarks = async () => {
        try {
            const res = await api.get(`subjects/${subjectId}/marks/`);
            setMarks(res.data || []);
        } catch (e) {
            alert('Error loading marks');
        }
    };

    useEffect(() => {
        fetchSubjectDetails();
        fetchMarks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subjectId]);

    const readFileAsBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const submitNote = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                title: noteForm.title,
                description: noteForm.description || null,
                link_url: noteForm.link_url || null,
                file_base64: noteForm.file_base64 || null,
                file_name: noteForm.file_name || null,
            };

            await api.post(`subjects/${subjectId}/notes/`, payload);
            setNoteModalOpen(false);
            resetNoteForm();
            await fetchSubjectDetails();
        } catch (err) {
            alert(err?.response?.data?.error || 'Error saving note');
        }
    };

    const submitAssignment = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                title: assignmentForm.title,
                due_date: assignmentForm.due_date,
                file_base64: assignmentForm.file_base64 || null,
                file_name: assignmentForm.file_name || null,
            };

            await api.post(`subjects/${subjectId}/assignments/`, payload);
            setAssignmentModalOpen(false);
            resetAssignmentForm();
            await fetchSubjectDetails();
        } catch (err) {
            alert(err?.response?.data?.error || 'Error saving assignment');
        }
    };

    const teacherBadges = useMemo(() => {
        const list = subject?.teachers || [];
        if (!list.length) return null;
        return (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                {list.map((t) => (
                    <span
                        key={t.id}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '7px 10px',
                            borderRadius: '999px',
                            backgroundColor: '#eef2ff',
                            color: '#3730a3',
                            fontWeight: 900,
                            fontSize: '12px',
                        }}
                    >
                        {t.name}
                    </span>
                ))}
            </div>
        );
    }, [subject]);

    const marksByStudent = useMemo(() => {
        const map = new Map();
        (marks || []).forEach((m) => {
            const key = m.student_id;
            if (!map.has(key)) map.set(key, { studentId: m.student_id, studentName: m.student_name, rows: [] });
            map.get(key).rows.push(m);
        });
        return Array.from(map.values());
    }, [marks]);

    const deleteNote = async (noteId) => {
        const ok = await confirm('Delete this note?');
        if (!ok) return;
        try {
            await api.delete(`subjects/notes/${noteId}/`);
            await fetchSubjectDetails();
        } catch (e) {
            alert('Error deleting note');
        }
    };

    const deleteAssignment = async (assignmentId) => {
        const ok = await confirm('Delete this assignment?');
        if (!ok) return;
        try {
            await api.delete(`subjects/assignments/${assignmentId}/`);
            await fetchSubjectDetails();
        } catch (e) {
            alert('Error deleting assignment');
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            {loading || !subject ? (
                <p style={{ color: '#6b7280' }}>Loading...</p>
            ) : (
                <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                        <div>
                            <h1 style={{ margin: 0 }}>{subject.name}</h1>
                            <div style={{ color: '#6b7280', fontSize: '13px', marginTop: '6px' }}>
                                Class: <b style={{ color: '#111827' }}>{subject.class_name}</b> {subject.code ? `• Code: ${subject.code}` : ''}
                            </div>
                            {teacherBadges}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span
                                style={{
                                    display: 'inline-block',
                                    padding: '8px 12px',
                                    borderRadius: '999px',
                                    backgroundColor: subject.status === 'Active' ? '#dcfce7' : '#fee2e2',
                                    color: subject.status === 'Active' ? '#166534' : '#991b1b',
                                    fontWeight: 900,
                                    fontSize: '12px',
                                    height: 'fit-content',
                                }}
                            >
                                {subject.status}
                            </span>
                        </div>
                    </div>

                    {subject.description && (
                        <div style={{ marginTop: '14px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '14px' }}>
                            <div style={{ fontWeight: 900, color: '#111827', marginBottom: '6px' }}>Description</div>
                            <div style={{ color: '#374151', fontSize: '13px' }}>{subject.description}</div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginTop: '16px' }}>
                        {/* Notes */}
                        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                                <h2 style={{ margin: 0, fontSize: '18px' }}>Notes / Study Materials</h2>
                                <button
                                    type="button"
                                    onClick={() => {
                                        resetNoteForm();
                                        setNoteModalOpen(true);
                                    }}
                                    style={{
                                        padding: '10px 24px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        backgroundColor: '#2563eb',
                                        color: '#fff',
                                        fontWeight: 1000,
                                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                                    }}
                                >
                                    + Add Note
                                </button>
                            </div>

                            <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
                                {notes.length === 0 ? (
                                    <p style={{ color: '#6b7280' }}>No notes added yet.</p>
                                ) : (
                                    notes.map((n) => (
                                        <div
                                            key={n.id}
                                            style={{
                                                border: '1px solid #eef2ff',
                                                borderRadius: '12px',
                                                padding: '12px',
                                                backgroundColor: '#fafafa',
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                                <div>
                                                    <div style={{ fontWeight: 900, color: '#111827' }}>{n.title}</div>
                                                    {n.description && <div style={{ color: '#374151', fontSize: '13px', marginTop: '6px' }}>{n.description}</div>}
                                                    <div style={{ marginTop: '8px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                        {n.file_url ? (
                                                            <a href={n.file_url} target="_blank" rel="noreferrer" style={{ fontWeight: 900, color: '#3730a3' }}>
                                                                Open File
                                                            </a>
                                                        ) : null}
                                                        {n.link_url ? (
                                                            <a href={n.link_url} target="_blank" rel="noreferrer" style={{ fontWeight: 900, color: '#3730a3' }}>
                                                                Open Link
                                                            </a>
                                                        ) : null}
                                                        {!n.file_url && !n.link_url ? <span style={{ color: '#6b7280', fontSize: '13px' }}>No file/link</span> : null}
                                                    </div>
                                                </div>
                                                <div>
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteNote(n.id)}
                                                        style={{
                                                            padding: '8px 16px',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            backgroundColor: '#fef2f2',
                                                            color: '#ef4444',
                                                            fontWeight: 800,
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Assignments */}
                        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                                <h2 style={{ margin: 0, fontSize: '18px' }}>Assignments</h2>
                                <button
                                    type="button"
                                    onClick={() => {
                                        resetAssignmentForm();
                                        setAssignmentModalOpen(true);
                                    }}
                                    style={{
                                        padding: '10px 24px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        backgroundColor: '#2563eb',
                                        color: '#fff',
                                        fontWeight: 1000,
                                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                                    }}
                                >
                                    + Add Assignment
                                </button>
                            </div>

                            <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
                                {assignments.length === 0 ? (
                                    <p style={{ color: '#6b7280' }}>No assignments added yet.</p>
                                ) : (
                                    assignments.map((a) => (
                                        <div
                                            key={a.id}
                                            style={{
                                                border: '1px solid #eef2ff',
                                                borderRadius: '12px',
                                                padding: '12px',
                                                backgroundColor: '#fafafa',
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ fontWeight: 900, color: '#111827' }}>{a.title}</div>
                                                    <div style={{ color: '#6b7280', fontSize: '13px', marginTop: '6px' }}>Due: {a.due_date}</div>
                                                    <div style={{ marginTop: '8px' }}>
                                                        {a.file_url ? (
                                                            <a href={a.file_url} target="_blank" rel="noreferrer" style={{ fontWeight: 900, color: '#3730a3' }}>
                                                                Open File
                                                            </a>
                                                        ) : (
                                                            <span style={{ color: '#6b7280', fontSize: '13px' }}>No file</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteAssignment(a.id)}
                                                        style={{
                                                            padding: '8px 16px',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            backgroundColor: '#fef2f2',
                                                            color: '#ef4444',
                                                            fontWeight: 800,
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Marks */}
                        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                                <h2 style={{ margin: 0, fontSize: '18px' }}>Marks</h2>
                                <button
                                    type="button"
                                    onClick={fetchMarks}
                                    style={{
                                        padding: '10px 18px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        backgroundColor: '#f5f3ff',
                                        color: '#6d28d9',
                                        fontWeight: 800,
                                    }}
                                >
                                    Refresh
                                </button>
                            </div>

                            <div style={{ marginTop: '14px', overflowX: 'auto' }}>
                                {marks.length === 0 ? (
                                    <p style={{ color: '#6b7280' }}>No marks found for this subject yet (from Exams Results).</p>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#f2f4f7' }}>
                                                <th style={{ padding: '12px 10px', textAlign: 'left' }}>Student</th>
                                                <th style={{ padding: '12px 10px', textAlign: 'left' }}>Exam</th>
                                                <th style={{ padding: '12px 10px', textAlign: 'left' }}>Marks</th>
                                                <th style={{ padding: '12px 10px', textAlign: 'left' }}>Max Marks</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {marksByStudent.map((s) =>
                                                s.rows.map((row, idx) => (
                                                    <tr key={`${s.studentId}-${row.id}-${idx}`} style={{ borderTop: '1px solid #eef2f7' }}>
                                                        <td style={{ padding: '12px 10px', fontWeight: 800 }}>{s.studentName}</td>
                                                        <td style={{ padding: '12px 10px' }}>{row.exam_name || 'N/A'}</td>
                                                        <td style={{ padding: '12px 10px' }}>{row.marks}</td>
                                                        <td style={{ padding: '12px 10px' }}>{row.max_marks}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Add Note Modal */}
            {noteModalOpen && (
                <div
                    onClick={() => setNoteModalOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '18px',
                        zIndex: 9999,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: 'min(760px, 100%)', backgroundColor: '#fff', borderRadius: '16px', padding: '18px', border: '1px solid #e5e7eb' }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                            <h3 style={{ margin: 0 }}>Add Note</h3>
                            <button type="button" onClick={() => setNoteModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
                                ×
                            </button>
                        </div>

                        <form onSubmit={submitNote} style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
                            <div>
                                <div style={labelStyle}>Title *</div>
                                <input type="text" value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })} style={inputStyle} required />
                            </div>

                            <div>
                                <div style={labelStyle}>Description (optional)</div>
                                <textarea value={noteForm.description} onChange={(e) => setNoteForm({ ...noteForm, description: e.target.value })} style={{ ...inputStyle, minHeight: '85px', resize: 'vertical' }} />
                            </div>

                            <div>
                                <div style={labelStyle}>Link URL (optional)</div>
                                <input type="url" value={noteForm.link_url} onChange={(e) => setNoteForm({ ...noteForm, link_url: e.target.value })} placeholder="https://..." style={inputStyle} />
                            </div>

                            <div>
                                <div style={labelStyle}>Upload PDF/DOC (optional)</div>
                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const base64 = await readFileAsBase64(file);
                                        setNoteForm((prev) => ({ ...prev, file_base64: base64, file_name: file.name }));
                                    }}
                                    style={inputStyle}
                                />
                                {noteForm.file_name ? <div style={{ marginTop: '6px', color: '#6b7280', fontSize: '13px' }}>Selected: {noteForm.file_name}</div> : null}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button type="button" onClick={() => setNoteModalOpen(false)} style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 900 }}>
                                    Cancel
                                </button>
                                <button type="submit" style={{ padding: '10px 14px', borderRadius: '12px', border: 'none', backgroundColor: '#2563eb', cursor: 'pointer', color: '#fff', fontWeight: 900 }}>
                                    Save Note
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Assignment Modal */}
            {assignmentModalOpen && (
                <div
                    onClick={() => setAssignmentModalOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '18px',
                        zIndex: 9999,
                    }}
                >
                    <div style={{ width: 'min(760px, 100%)', backgroundColor: '#fff', borderRadius: '16px', padding: '18px', border: '1px solid #e5e7eb' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                            <h3 style={{ margin: 0 }}>Add Assignment</h3>
                            <button type="button" onClick={() => setAssignmentModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
                                ×
                            </button>
                        </div>

                        <form onSubmit={submitAssignment} style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
                            <div>
                                <div style={labelStyle}>Title *</div>
                                <input type="text" value={assignmentForm.title} onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })} style={inputStyle} required />
                            </div>

                            <div>
                                <div style={labelStyle}>Due Date *</div>
                                <input type="date" value={assignmentForm.due_date} onChange={(e) => setAssignmentForm({ ...assignmentForm, due_date: e.target.value })} style={inputStyle} required />
                            </div>

                            <div>
                                <div style={labelStyle}>Upload File (optional)</div>
                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const base64 = await readFileAsBase64(file);
                                        setAssignmentForm((prev) => ({ ...prev, file_base64: base64, file_name: file.name }));
                                    }}
                                    style={inputStyle}
                                />
                                {assignmentForm.file_name ? <div style={{ marginTop: '6px', color: '#6b7280', fontSize: '13px' }}>Selected: {assignmentForm.file_name}</div> : null}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button type="button" onClick={() => setAssignmentModalOpen(false)} style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 900 }}>
                                    Cancel
                                </button>
                                <button type="submit" style={{ padding: '10px 14px', borderRadius: '12px', border: 'none', backgroundColor: '#2563eb', cursor: 'pointer', color: '#fff', fontWeight: 900 }}>
                                    Save Assignment
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubjectDetails;


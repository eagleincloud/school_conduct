import React, { useEffect, useState, useMemo } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';

const colors = {
    bg: '#f9fafb',
    card: '#ffffff',
    border: '#e5e7eb',
    text: '#0f172a',
    muted: '#6b7280',
    primary: '#2563eb',
    success: '#166534',
    danger: '#ef4444',
    shadow: '0 1px 6px rgba(16,24,40,0.06)',
};

const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
};

const labelStyle = {
    fontSize: 12,
    color: colors.muted,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    marginBottom: 6,
};

function Modal({ open, title, onClose, children }) {
    if (!open) return null;
    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15,23,42,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 18,
                zIndex: 50,
            }}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div style={{ width: 'min(860px, 100%)', background: '#fff', borderRadius: 16, border: `1px solid ${colors.border}`, boxShadow: colors.shadow, overflow: 'hidden' }}>
                <div style={{ padding: 16, borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontWeight: 1000, color: colors.text, fontSize: 16 }}>{title}</div>
                    <button type="button" onClick={onClose} style={{ background: '#fff', border: `1px solid ${colors.border}`, padding: '8px 12px', borderRadius: 12, cursor: 'pointer', fontWeight: 1000 }}>
                        Close
                    </button>
                </div>
                <div style={{ padding: 16 }}>{children}</div>
            </div>
        </div>
    );
}

export default function AdminSyllabus() {
    const confirm = useConfirm();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [syllabi, setSyllabi] = useState([]);
    
    const [classes, setClasses] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);

    const [createForm, setCreateForm] = useState({ class_id: '', subject_id: '', title: '', description: '', file: null });
    
    const [editOpen, setEditOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editFile, setEditFile] = useState(null);
    const [saving, setSaving] = useState(false);

    const filteredSubjects = useMemo(() => {
        if (!createForm.class_id) return [];
        return allSubjects.filter(s => String(s.class_ref) === String(createForm.class_id));
    }, [createForm.class_id, allSubjects]);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [sRes, cRes, subRes] = await Promise.all([
                api.get('syllabus/'),
                api.get('classes/main-classes/'),
                api.get('subjects/')
            ]);
            setSyllabi(sRes.data || []);
            setClasses(cRes.data || []);
            setAllSubjects(subRes.data || []);
        } catch (e) {
            setError('Could not load data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSearch = async () => {
        try {
            const res = await api.get('syllabus/', { params: { search } });
            setSyllabi(res.data || []);
        } catch (e) {}
    };

    useEffect(() => {
        const t = setTimeout(() => handleSearch(), 350);
        return () => clearTimeout(t);
    }, [search]);

    const onCreate = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('class_id', createForm.class_id);
            fd.append('subject_id', createForm.subject_id);
            fd.append('title', createForm.title);
            fd.append('description', createForm.description);
            fd.append('file', createForm.file);

            await api.post('syllabus/control/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setCreateForm({ class_id: '', subject_id: '', title: '', description: '', file: null });
            loadData();
        } catch (e) {
            setError(e?.response?.data?.error || 'Upload failed.');
        } finally {
            setSaving(false);
        }
    };

    const openEdit = (row) => {
        setEditId(row.id);
        setEditTitle(row.title || '');
        setEditDesc(row.description || '');
        setEditFile(null);
        setEditOpen(true);
    };

    const saveEdit = async () => {
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('title', editTitle);
            fd.append('description', editDesc);
            if (editFile) fd.append('file', editFile);

            await api.patch(`syllabus/control/${editId}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setEditOpen(false);
            loadData();
        } catch (e) {
            setError('Update failed.');
        } finally {
            setSaving(false);
        }
    };

    const deleteSyllabus = async (id) => {
        if (!(await confirm('Delete this syllabus?'))) return;
        try {
            await api.delete(`syllabus/control/${id}/`);
            loadData();
        } catch (e) {
            setError('Delete failed.');
        }
    };

    return (
        <div style={{ padding: 20, background: colors.bg, minHeight: 'calc(100vh - 60px)' }}>
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 1000, color: colors.text }}>Admin Syllabus Management</h1>
                <p style={{ margin: '4px 0 0', color: colors.muted, fontWeight: 900, fontSize: 13 }}>Full central control over school syllabus.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, alignItems: 'start' }}>
                {/* Upload Section */}
                <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 20, boxShadow: colors.shadow }}>
                    <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 1000 }}>Upload New Syllabus</h2>
                    <form onSubmit={onCreate} style={{ display: 'grid', gap: 12 }}>
                        <div>
                            <div style={labelStyle}>Class *</div>
                            <select 
                                style={inputStyle} 
                                value={createForm.class_id} 
                                onChange={e => setCreateForm({...createForm, class_id: e.target.value, subject_id: ''})}
                                required
                            >
                                <option value="">Select Class</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <div style={labelStyle}>Subject *</div>
                            <select 
                                style={inputStyle} 
                                value={createForm.subject_id} 
                                onChange={e => setCreateForm({...createForm, subject_id: e.target.value})}
                                required
                             >
                                <option value="">Select Subject</option>
                                {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <div style={labelStyle}>Title *</div>
                            <input 
                                style={inputStyle} 
                                value={createForm.title} 
                                onChange={e => setCreateForm({...createForm, title: e.target.value})}
                                placeholder="Quarterly Syllabus"
                                required 
                            />
                        </div>
                        <div>
                            <div style={labelStyle}>Description</div>
                            <textarea 
                                style={{...inputStyle, minHeight: 80}} 
                                value={createForm.description} 
                                onChange={e => setCreateForm({...createForm, description: e.target.value})}
                            />
                        </div>
                        <div>
                            <div style={labelStyle}>File (PDF, CSV, DOC) *</div>
                            <input 
                                type="file" 
                                style={inputStyle} 
                                onChange={e => setCreateForm({...createForm, file: e.target.files[0]})}
                                required 
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={saving} 
                            style={{ padding: 12, borderRadius: 12, border: 'none', backgroundColor: colors.primary, color: '#fff', fontWeight: 1000, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
                        >
                            {saving ? 'Uploading...' : 'Upload Syllabus'}
                        </button>
                    </form>
                </div>

                {/* List Section */}
                <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 20, boxShadow: colors.shadow }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 1000 }}>Syllabus List</h2>
                        <input 
                            placeholder="Search by title or subject..." 
                            style={{...inputStyle, width: 250}} 
                            value={search} 
                            onChange={e => setSearch(e.target.value)} 
                        />
                    </div>

                    {error && <div style={{ color: colors.danger, fontWeight: 900, marginBottom: 10 }}>{error}</div>}

                    <div style={{ display: 'grid', gap: 12 }}>
                        {syllabi.map(s => (
                            <div key={s.id} style={{ padding: 16, border: `1px solid ${colors.border}`, borderRadius: 14, background: '#f8fafc' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div>
                                        <div style={{ fontWeight: 1000, fontSize: 16 }}>{s.title}</div>
                                        <div style={{ fontSize: 12, color: colors.muted, fontWeight: 800 }}>
                                            {s.class_name} • {s.subject_name} • By {s.uploaded_by_name}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {s.file_url && (
                                            <a href={s.file_url} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', borderRadius: 8, backgroundColor: '#fff', border: `1px solid ${colors.border}`, color: colors.primary, textDecoration: 'none', fontSize: 12, fontWeight: 1000 }}>
                                                View
                                            </a>
                                        )}
                                        <button onClick={() => openEdit(s)} style={{ padding: '6px 10px', borderRadius: 8, backgroundColor: colors.success, border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 1000 }}>Edit</button>
                                        <button onClick={() => deleteSyllabus(s.id)} style={{ padding: '6px 10px', borderRadius: 8, backgroundColor: colors.danger, border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 1000 }}>Delete</button>
                                    </div>
                                </div>
                                {s.description && <p style={{ margin: '8px 0 0', fontSize: 13, color: '#475569' }}>{s.description}</p>}
                                <div style={{ marginTop: 8, fontSize: 11, color: colors.muted }}>Uploaded: {new Date(s.uploaded_at).toLocaleDateString()}</div>
                            </div>
                        ))}
                        {!loading && syllabi.length === 0 && <p style={{ color: colors.muted, textAlign: 'center' }}>No syllabus found.</p>}
                    </div>
                </div>
            </div>

            <Modal open={editOpen} title="Edit Syllabus" onClose={() => setEditOpen(false)}>
                <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                        <div style={labelStyle}>Title</div>
                        <input style={inputStyle} value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                    </div>
                    <div>
                        <div style={labelStyle}>Description</div>
                        <textarea style={{...inputStyle, minHeight: 80}} value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                    </div>
                    <div>
                        <div style={labelStyle}>Update File (Optional)</div>
                        <input type="file" style={inputStyle} onChange={e => setEditFile(e.target.files[0])} />
                    </div>
                    <button 
                        onClick={saveEdit} 
                        disabled={saving}
                        style={{ padding: 12, borderRadius: 12, border: 'none', backgroundColor: colors.primary, color: '#fff', fontWeight: 1000, cursor: 'pointer', marginTop: 10 }}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </Modal>
        </div>
    );
}

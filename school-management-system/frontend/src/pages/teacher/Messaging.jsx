import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';

const cardStyle = {
    backgroundColor: '#fff',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 6px rgba(16,24,40,0.06)',
};

const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#f9fafb',
    transition: 'all 0.2s',
};

function fmtTime(v) {
    if (!v) return '';
    return new Date(v).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
}

function isImageAttachment(url) {
    const lower = (url || '').toLowerCase();
    return lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp');
}

const Messaging = () => {
    const confirm = useConfirm();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');

    const [conversations, setConversations] = useState([]);
    const [activeConvId, setActiveConvId] = useState(null);
    const [activeConv, setActiveConv] = useState(null);
    const [messages, setMessages] = useState([]);

    const [messageText, setMessageText] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [sending, setSending] = useState(false);
    const [resolving, setResolving] = useState(false);

    const [search, setSearch] = useState('');
    const chatEndRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadConversations = async (opts = {}) => {
        const params = {
            class_section_id: opts.classId ?? selectedClassId,
            status: opts.status ?? statusFilter
        };
        try {
            const res = await api.get('communication/doubts/', { params });
            const data = res.data || [];
            setConversations(data);

            // Reset active selection if filters changed or list is empty
            if (data.length > 0) {
                setActiveConvId(data[0].id);
            } else {
                setActiveConvId(null);
                setActiveConv(null);
                setMessages([]);
            }
        } catch (e) {
            setError('Could not load doubts.');
        }
    };

    useEffect(() => {
        setLoading(true);
        Promise.all([api.get('classes/teaching-sections/'), loadConversations({ status: 'active' })])
            .then(([classRes]) => {
                setClasses(classRes.data || []);
            })
            .catch(() => setError('Could not load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!activeConvId) return;
        const fetchMessages = async () => {
            try {
                const res = await api.get(`communication/doubts/${activeConvId}/`);
                setActiveConv(res.data.conversation);
                setMessages(res.data.messages || []);
                setTimeout(scrollToBottom, 100);
            } catch (e) {
                console.error('Could not load conversation');
            }
        };
        fetchMessages();
        const interval = setInterval(fetchMessages, 15000);
        return () => clearInterval(interval);
    }, [activeConvId]);

    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState('');

    const handleEdit = async (msgId) => {
        if (!editContent.trim()) return;
        try {
            const res = await api.patch(`communication/doubts/message/${msgId}/`, { content: editContent.trim() });
            setMessages(messages.map(m => m.id === msgId ? res.data : m));
            setEditingId(null);
            setEditContent('');
        } catch (e) {
            alert('Failed to edit message');
        }
    };

    const handleDelete = async (msgId) => {
        if (!(await confirm('Delete this message?'))) return;
        try {
            await api.delete(`communication/doubts/message/${msgId}/`);
            setMessages(messages.filter(m => m.id !== msgId));
        } catch (e) {
            alert('Failed to delete message');
        }
    };

    const sendMessage = async () => {
        if (!activeConvId || (!messageText.trim() && !attachment)) return;
        setSending(true);
        try {
            const form = new FormData();
            form.append('content', messageText.trim());
            if (attachment) form.append('attachment', attachment);

            const res = await api.post(`communication/doubts/${activeConvId}/`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setMessages([...messages, res.data]);
            setMessageText('');
            setAttachment(null);
            setTimeout(scrollToBottom, 100);
            loadConversations();
        } catch (e) {
            setError('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const handleResolve = async () => {
        if (!activeConvId || !(await confirm('Mark this doubt as resolved?'))) return;
        setResolving(true);
        try {
            await api.post(`communication/doubts/${activeConvId}/resolve/`);
            setActiveConv({ ...activeConv, is_active: false });
            loadConversations();
        } catch (e) {
            alert('Failed to resolve');
        } finally {
            setResolving(false);
        }
    };

    const filteredConversations = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return conversations;
        return conversations.filter(c =>
            c.student_name.toLowerCase().includes(q) ||
            (c.subject || '').toLowerCase().includes(q)
        );
    }, [conversations, search]);

    if (loading) return <div style={{ padding: 20, fontWeight: 900, color: '#6b7280' }}>Loading Messaging System...</div>;

    return (
        <div style={{ padding: '20px', maxWidth: 1400, margin: '0 auto' }}>
            <div style={{ ...cardStyle, padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 1000 }}>Student Doubts</h1>
                        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14, fontWeight: 900 }}>Resolve student questions and doubts.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <select
                            value={selectedClassId}
                            onChange={e => {
                                setSelectedClassId(e.target.value);
                                loadConversations({ classId: e.target.value });
                            }}
                            style={{ ...inputStyle, minWidth: 180 }}
                        >
                            <option value="">All My Classes</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.class_name} - {c.section_name}</option>)}
                        </select>
                        <select
                            value={statusFilter}
                            onChange={e => {
                                setStatusFilter(e.target.value);
                                loadConversations({ status: e.target.value });
                            }}
                            style={{ ...inputStyle, minWidth: 150 }}
                        >
                            <option value="active">Active Doubts</option>
                            <option value="resolved">Resolved</option>
                        </select>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '350px 1fr', gap: 20, height: 'calc(100vh - 200px)' }}>
                {/* Inbox */}
                <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search student or subject..."
                            style={inputStyle}
                        />
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
                        {filteredConversations.map(c => (
                            <div
                                key={c.id}
                                onClick={() => setActiveConvId(c.id)}
                                style={{
                                    padding: 12,
                                    borderRadius: 12,
                                    cursor: 'pointer',
                                    marginBottom: 8,
                                    border: `1px solid ${c.id === activeConvId ? '#2563eb' : '#e5e7eb'}`,
                                    background: c.id === activeConvId ? '#eff6ff' : '#fff',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 1000, fontSize: 14 }}>{c.student_name}</span>
                                    {c.unread_count > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 999, padding: '2px 6px', fontSize: 10, fontWeight: 1000 }}>{c.unread_count}</span>}
                                </div>
                                <div style={{ fontSize: 12, color: '#2563eb', marginTop: 4, fontWeight: 1000 }}>{c.subject || 'General'}</div>
                                {c.last_message && (
                                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {c.last_message.content}
                                    </div>
                                )}
                            </div>
                        ))}
                        {filteredConversations.length === 0 && (
                            <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontWeight: 900 }}>
                                🚫 No student doubts found.
                            </div>
                        )}

                    </div>
                </div>

                {/* Chat */}
                <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {activeConv ? (
                        <>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 1000, fontSize: 16 }}>{activeConv.student_name}</div>
                                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 900 }}>Doubt: {activeConv.subject || 'General'}</div>
                                </div>
                                {activeConv.is_active ? (
                                    <button
                                        disabled={resolving}
                                        onClick={handleResolve}
                                        style={{ border: 'none', background: '#10b981', color: '#fff', padding: '8px 16px', borderRadius: 8, fontWeight: 1000, cursor: 'pointer' }}
                                    >
                                        {resolving ? '...' : 'Mark Resolved'}
                                    </button>
                                ) : (
                                    <span style={{ color: '#6b7280', fontWeight: 1000, fontSize: 14 }}>✅ Resolved</span>
                                )}
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {messages.map(m => {
                                    const isMe = m.sender_role === 'teacher';
                                    const isEditing = editingId === m.id;
                                    return (
                                        <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                                            <div style={{
                                                padding: '12px 16px',
                                                borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                                background: isMe ? '#2563eb' : '#fff',
                                                color: isMe ? '#fff' : '#1e293b',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                border: isMe ? 'none' : '1px solid #e2e8f0',
                                                position: 'relative'
                                            }}>
                                                {isEditing ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                        <textarea
                                                            value={editContent}
                                                            onChange={e => setEditContent(e.target.value)}
                                                            style={{ ...inputStyle, background: '#fff', color: '#000', minHeight: 60 }}
                                                        />
                                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                            <button onClick={() => setEditingId(null)} style={{ border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                                                            <button onClick={() => handleEdit(m.id)} style={{ border: 'none', background: '#fff', color: '#2563eb', padding: '4px 8px', borderRadius: 4, fontWeight: 1000, cursor: 'pointer' }}>Save</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {m.content && <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.content}</div>}
                                                        {m.attachment_url && (
                                                            <div style={{ marginTop: 8 }}>
                                                                {isImageAttachment(m.attachment_url) ? (
                                                                    <a href={m.attachment_url} target="_blank" rel="noreferrer">
                                                                        <img src={m.attachment_url} alt="att" style={{ maxWidth: '100%', borderRadius: 8, maxHeight: 300 }} />
                                                                    </a>
                                                                ) : (
                                                                    <a href={m.attachment_url} target="_blank" rel="noreferrer" style={{ color: isMe ? '#bfdbfe' : '#2563eb', fontWeight: 1000, fontSize: 12 }}>
                                                                        📎 Download Attachment
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, gap: 10 }}>
                                                            <div style={{ fontSize: 10, opacity: 0.8 }}>{fmtTime(m.created_at)}</div>
                                                            {isMe && (
                                                                <div style={{ display: 'flex', gap: 8 }}>
                                                                    <button
                                                                        onClick={() => { setEditingId(m.id); setEditContent(m.content); }}
                                                                        style={{ border: 'none', background: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', padding: 0, opacity: 0.7 }}
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(m.id)}
                                                                        style={{ border: 'none', background: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', padding: 0, opacity: 0.7 }}
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                <div ref={chatEndRef} />
                            </div>

                            {activeConv.is_active && (
                                <div style={{ padding: 20, borderTop: '1px solid #e5e7eb', background: '#fff' }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                                        <div style={{ flex: 1 }}>
                                            <textarea
                                                value={messageText}
                                                onChange={e => setMessageText(e.target.value)}
                                                placeholder="Type your explanation..."
                                                style={{ ...inputStyle, minHeight: 50, resize: 'none' }}
                                            />
                                            {attachment && <div style={{ fontSize: 12, color: '#2563eb', marginTop: 4, fontWeight: 900 }}>📎 {attachment.name} <button onClick={() => setAttachment(null)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>✖</button></div>}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input
                                                type="file"
                                                id="file-up"
                                                hidden
                                                onChange={e => setAttachment(e.target.files[0])}
                                            />
                                            <label htmlFor="file-up" style={{ padding: 12, background: '#f3f4f6', borderRadius: 12, cursor: 'pointer' }}>📎</label>
                                            <button
                                                disabled={sending || (!messageText.trim() && !attachment)}
                                                onClick={sendMessage}
                                                style={{ border: 'none', background: '#2563eb', color: '#fff', padding: '0 20px', borderRadius: 12, fontWeight: 1000, height: 46, cursor: 'pointer' }}
                                            >
                                                {sending ? '...' : 'Reply'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontWeight: 900 }}>
                            Select a doubt from the list to reply.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Messaging;

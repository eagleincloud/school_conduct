import React, { useEffect, useState, useRef } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';
import { useStudent } from '../../context/StudentContext';

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

const StudentMessaging = () => {
    const confirm = useConfirm();
    const { selectedStudentId } = useStudent();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [conversations, setConversations] = useState([]);
    const [activeConvId, setActiveConvId] = useState(null);
    const [activeConv, setActiveConv] = useState(null);
    const [messages, setMessages] = useState([]);
    
    const [messageText, setMessageText] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [sending, setSending] = useState(false);
    
    const [showNewDoubt, setShowNewDoubt] = useState(false);
    const [teachers, setTeachers] = useState([]);
    const [newDoubt, setNewDoubt] = useState({ teacher_id: '', subject: '', message: '' });
    
    const chatEndRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        loadConversations();
        loadTeachers();
    }, [selectedStudentId]);

    const loadConversations = async () => {
        setLoading(true);
        try {
            const res = await api.get('communication/doubts/');
            setConversations(res.data || []);
            if (res.data?.length && !activeConvId) {
                setActiveConvId(res.data[0].id);
            }
        } catch (e) {
            setError('Could not load doubts.');
        } finally {
            setLoading(false);
        }
    };

    const loadTeachers = async () => {
        try {
            const res = await api.get('teachers/list-all/');
            setTeachers(res.data || []);
        } catch (e) {
            console.error('Could not load teachers');
        }
    };

    useEffect(() => {
        if (!activeConvId) return;
        const fetchMessages = async () => {
            try {
                const res = await api.get(`communication/doubts/${activeConvId}/`);
                setActiveConv(res.data.conversation);
                setMessages(res.data.messages || []);
                setTimeout(scrollToBottom, 100);
            } catch (e) {
                setError('Could not load conversation');
            }
        };
        fetchMessages();
        const interval = setInterval(fetchMessages, 10000);
        return () => clearInterval(interval);
    }, [activeConvId]);

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
        } catch (e) {
            setError('Failed to send message');
        } finally {
            setSending(false);
        }
    };

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

    const handleCreateDoubt = async () => {
        if (!newDoubt.teacher_id || !newDoubt.message) return;
        setSending(true);
        try {
            const form = new FormData();
            form.append('teacher_id', newDoubt.teacher_id);
            form.append('subject', newDoubt.subject);
            form.append('message', newDoubt.message);
            if (attachment) form.append('attachment', attachment);

            const res = await api.post('communication/doubts/', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setConversations([res.data, ...conversations]);
            setActiveConvId(res.data.id);
            setShowNewDoubt(false);
            setNewDoubt({ teacher_id: '', subject: '', message: '' });
            setAttachment(null);
        } catch (e) {
            setError('Failed to create doubt');
        } finally {
            setSending(false);
        }
    };

    if (loading) return <div style={{ padding: 20, fontWeight: 900, color: '#6b7280' }}>Loading Messaging System...</div>;

    return (
        <div style={{ padding: '20px', maxWidth: 1400, margin: '0 auto' }}>
            <div style={{ ...cardStyle, padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 1000 }}>Doubt Solving System</h1>
                    <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14, fontWeight: 900 }}>Ask questions to your teachers and get solutions.</p>
                </div>
                <button 
                    onClick={() => setShowNewDoubt(true)}
                    style={{ border: 'none', background: '#2563eb', color: '#fff', padding: '12px 24px', borderRadius: 12, fontWeight: 1000, cursor: 'pointer' }}
                >
                    + Ask New Doubt
                </button>
            </div>

            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '350px 1fr', gap: 20, height: 'calc(100vh - 200px)' }}>
                {/* Conversations List */}
                <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', fontWeight: 1000, fontSize: 16 }}>My Doubts</div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
                        {conversations.map(c => (
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
                                    <span style={{ fontWeight: 1000, fontSize: 14 }}>{c.subject || 'General'}</span>
                                    <span style={{ 
                                        fontSize: 10, 
                                        padding: '2px 6px', 
                                        borderRadius: 999, 
                                        background: c.is_active ? '#ecfdf5' : '#f3f4f6',
                                        color: c.is_active ? '#059669' : '#6b7280',
                                        fontWeight: 1000
                                    }}>
                                        {c.is_active ? 'Active' : 'Resolved'}
                                    </span>
                                </div>
                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: 900 }}>Teacher: {c.teacher_name}</div>
                                {c.last_message && (
                                    <div style={{ fontSize: 12, color: '#374151', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {c.last_message.content}
                                    </div>
                                )}
                            </div>
                        ))}
                        {conversations.length === 0 && <div style={{ textAlign: 'center', color: '#6b7280', marginTop: 40, fontWeight: 900 }}>No doubts found.</div>}
                    </div>
                </div>

                {/* Chat Window */}
                <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {activeConv ? (
                        <>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 1000, fontSize: 16 }}>{activeConv.subject || 'General Doubt'}</div>
                                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 900 }}>With: {activeConv.teacher_name}</div>
                                </div>
                                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 900 }}>Started: {new Date(activeConv.created_at).toLocaleDateString()}</div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {messages.map(m => {
                                    const isMe = m.sender_role === 'student';
                                    const isEditing = editingId === m.id;
                                    return (
                                        <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%', position: 'relative', group: 'true' }} className="message-container">
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
                                                            {isMe && !activeConv.is_active === false && (
                                                                <div className="message-actions" style={{ display: 'flex', gap: 8 }}>
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

                            {activeConv.is_active ? (
                                <div style={{ padding: 20, borderTop: '1px solid #e5e7eb', background: '#fff' }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                                        <div style={{ flex: 1 }}>
                                            <textarea 
                                                value={messageText}
                                                onChange={e => setMessageText(e.target.value)}
                                                placeholder="Type your message..."
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
                                                {sending ? '...' : 'Send'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: 20, textAlign: 'center', background: '#f8fafc', color: '#6b7280', fontWeight: 900, fontSize: 14 }}>
                                    This conversation has been marked as resolved.
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontWeight: 900 }}>
                            Select a conversation or start a new doubt.
                        </div>
                    )}
                </div>
            </div>

            {/* New Doubt Modal */}
            {showNewDoubt && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', padding: 30, borderRadius: 20, width: '100%', maxWidth: 500, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <h2 style={{ marginTop: 0, fontWeight: 1000 }}>Ask a Doubt</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 1000 }}>Select Teacher</label>
                                <select 
                                    value={newDoubt.teacher_id}
                                    onChange={e => setNewDoubt({...newDoubt, teacher_id: e.target.value})}
                                    style={inputStyle}
                                >
                                    <option value="">Choose Teacher</option>
                                    {teachers.map(t => <option key={t.id} value={t.id}>{t.user_name} ({t.subjects?.[0]?.name || 'Teacher'})</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 1000 }}>Subject / Topic</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Math Question Page 42"
                                    value={newDoubt.subject}
                                    onChange={e => setNewDoubt({...newDoubt, subject: e.target.value})}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 1000 }}>Describe your doubt</label>
                                <textarea 
                                    placeholder="Write your question here..."
                                    value={newDoubt.message}
                                    onChange={e => setNewDoubt({...newDoubt, message: e.target.value})}
                                    style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 1000 }}>Attachment (Optional)</label>
                                <input type="file" onChange={e => setAttachment(e.target.files[0])} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 30 }}>
                            <button 
                                onClick={() => setShowNewDoubt(false)}
                                style={{ flex: 1, padding: 12, border: '1px solid #e5e7eb', background: '#fff', borderRadius: 12, fontWeight: 1000, cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button 
                                disabled={sending || !newDoubt.teacher_id || !newDoubt.message}
                                onClick={handleCreateDoubt}
                                style={{ flex: 1, padding: 12, border: 'none', background: '#2563eb', color: '#fff', borderRadius: 12, fontWeight: 1000, cursor: 'pointer', opacity: sending ? 0.7 : 1 }}
                            >
                                {sending ? 'Submitting...' : 'Submit Doubt'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentMessaging;



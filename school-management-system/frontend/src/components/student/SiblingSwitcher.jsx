import React, { useState } from 'react';

const colors = {
    primary: '#2563eb',
    text: '#111827',
    muted: '#6b7280',
    border: '#e5e7eb',
    card: '#ffffff',
    shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2-4px 4px -1px rgba(0, 0, 0, 0.06)',
};

export default function SiblingSwitcher({ siblings, selectedStudentId, onSwitch, theme }) {
    const [isOpen, setIsOpen] = useState(false);

    if (!siblings || siblings.length <= 1) return null;

    const themeStyles = theme === 'dark' ? {
        card: '#1e293b',
        text: '#e5e7eb',
        muted: '#9ca3af',
        border: '#334155',
        hover: '#334155',
    } : {
        card: '#ffffff',
        text: '#111827',
        muted: '#6b7280',
        border: '#e5e7eb',
        hover: '#f8fafc',
    };

    return (
        <div style={{ position: 'relative', zIndex: 50, flexShrink: 1, minWidth: 0 }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: `1px solid ${themeStyles.border}`,
                    backgroundColor: themeStyles.card,
                    color: themeStyles.text,
                    cursor: 'pointer',
                    fontWeight: '1000',
                    fontSize: '13px',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    outline: 'none',
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                    e.currentTarget.style.borderColor = colors.primary;
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                    e.currentTarget.style.borderColor = themeStyles.border;
                }}
            >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        backgroundColor: '#eff6ff',
                        color: colors.primary
                    }}>
                        <span style={{ fontSize: '14px' }}>👨‍👩‍👧‍👦</span>
                    </div>
                    <span style={{ display: 'inline-block', maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Siblings
                    </span>
                </span>
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '8px',
                        width: 'min(240px, calc(100vw - 24px))',
                        backgroundColor: themeStyles.card,
                        border: `1px solid ${themeStyles.border}`,
                        borderRadius: '16px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        overflow: 'hidden',
                        padding: '6px',
                    }}
                >
                    <div style={{ padding: '8px 12px', fontSize: '12px', fontWeight: '1000', color: themeStyles.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Switch Student
                    </div>
                    {siblings.map((sibling) => (
                        <button
                            key={sibling.id}
                            onClick={() => {
                                onSwitch(sibling.id);
                                setIsOpen(false);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                width: '100%',
                                padding: '10px 12px',
                                border: 'none',
                                borderRadius: '10px',
                                backgroundColor: sibling.id === selectedStudentId ? (theme === 'dark' ? '#2563eb33' : '#eff6ff') : 'transparent',
                                color: sibling.id === selectedStudentId ? colors.primary : themeStyles.text,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'background-color 0.2s',
                            }}
                            onMouseOver={(e) => {
                                if (sibling.id !== selectedStudentId) {
                                    e.currentTarget.style.backgroundColor = themeStyles.hover;
                                }
                            }}
                            onMouseOut={(e) => {
                                if (sibling.id !== selectedStudentId) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }
                            }}
                        >
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                backgroundColor: sibling.id === selectedStudentId ? colors.primary : (theme === 'dark' ? '#334155' : '#f1f5f9'),
                                color: sibling.id === selectedStudentId ? '#fff' : (theme === 'dark' ? '#9ca3af' : '#64748b'),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '1000',
                                fontSize: '14px',
                            }}>
                                {sibling.photo_url ? (
                                    <img src={sibling.photo_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '10px', objectFit: 'cover' }} />
                                ) : (
                                    <span style={{ fontSize: '14px', fontWeight: '1000' }}>
                                        {sibling.name.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ fontWeight: '1000', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {sibling.name}
                                </div>
                                <div style={{ fontSize: '12px', color: themeStyles.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {sibling.class_section_display || sibling.class_name}
                                </div>
                            </div>
                            {sibling.id === selectedStudentId && (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

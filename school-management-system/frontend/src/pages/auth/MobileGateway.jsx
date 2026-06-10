import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import schoolService from '../../services/schoolService';
import { toast } from 'react-hot-toast';
import { BASE_URL } from '../../services/api';

const MobileGateway = () => {
    const [schoolId, setSchoolId] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [customUrl, setCustomUrl] = useState(localStorage.getItem('mobile_api_url') || '');
    const [connectionFailed, setConnectionFailed] = useState(false);
    const navigate = useNavigate();

    // Check if the school ID was already verified on this device
    useEffect(() => {
        const savedSchoolId = localStorage.getItem('mobile_school_id');
        if (savedSchoolId) {
            navigate(`/school/${savedSchoolId}/login`);
        }
    }, [navigate]);

    const handleVerify = async (e) => {
        e.preventDefault();
        const idToVerify = schoolId.trim().toUpperCase();

        if (!idToVerify) {
            toast.error('Please enter a valid School ID.');
            return;
        }

        // 1. Offline Detection
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            toast.error('Offline Mode: Please check your internet connection and try again.');
            return;
        }

        setVerifying(true);
        setConnectionFailed(false);
        try {
            // Perform lookup using existing service client
            const schoolData = await schoolService.getSchoolInfo(idToVerify);
            
            if (schoolData) {
                toast.success('School verified successfully!');
                localStorage.setItem('mobile_school_id', idToVerify);
                navigate(`/school/${idToVerify}/login`);
            }
        } catch (err) {
            console.error('Mobile Gateway verification failed:', err);

            // 2. Timeout and Network Failures Handling
            if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
                toast.error('Request Timed Out: The server is taking too long to respond. Please try again.');
                setConnectionFailed(true);
            } else if (!err.response) {
                toast.error('Network Error: Unreachable host. Please check your backend connection.');
                setConnectionFailed(true);
            } else {
                const status = err.response.status;
                if (status === 404) {
                    // 3. Invalid School ID
                    toast.error(`Invalid School ID: "${idToVerify}" does not exist in our system.`);
                } else if (status >= 500) {
                    // 4. Server 500 Errors
                    toast.error('Server Error (500): The server encountered an internal issue. Please try again later.');
                } else {
                    toast.error(err.response.data?.message || err.response.data?.error || 'Verification failed. Please try again.');
                }
            }
        } finally {
            setVerifying(false);
        }
    };

    const handleSaveUrl = (e) => {
        e.preventDefault();
        const urlToSave = customUrl.trim();
        if (!urlToSave) {
            toast.error('Please enter a valid URL.');
            return;
        }

        try {
            // Basic validation: must start with http:// or https://
            new URL(urlToSave);
        } catch (e) {
            toast.error('Invalid URL format. Must start with http:// or https://');
            return;
        }

        // Standardize URL by adding trailing slash /api/ or / if missing
        let normalized = urlToSave.replace(/\/?$/, "/");
        if (!normalized.includes('/api/')) {
            normalized = normalized + 'api/';
        }

        localStorage.setItem('mobile_api_url', normalized);
        toast.success('Backend URL updated! Reloading app...');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    };

    const handleResetUrl = () => {
        localStorage.removeItem('mobile_api_url');
        toast.success('Reset to default URL! Reloading app...');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '24px',
            fontFamily: 'sans-serif',
            position: 'relative'
        }}>
            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '400px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(16px)',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '40px 32px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                textAlign: 'center',
                color: '#fff'
            }}>
                {/* Settings Gear Icon */}
                <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: '20px',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                    }}
                    title="Configure Server URL"
                >
                    ⚙️
                </button>

                <div style={{
                    fontSize: '48px',
                    marginBottom: '16px',
                    animation: 'pulse 2s infinite'
                }}>🛡️</div>
                
                <h1 style={{
                    margin: '0 0 8px',
                    fontSize: '28px',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(to right, #60a5fa, #3b82f6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    School Conduct
                </h1>
                
                <p style={{
                    margin: '0 0 32px',
                    color: '#94a3b8',
                    fontSize: '14px',
                    fontWeight: 500
                }}>
                    Enter your School ID to verify connection and log in.
                </p>

                <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ textAlign: 'left' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#94a3b8',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '8px',
                            paddingLeft: '4px'
                        }}>
                            School ID
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. DEFAULT, KVS01"
                            value={schoolId}
                            onChange={(e) => setSchoolId(e.target.value)}
                            disabled={verifying}
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                color: '#fff',
                                fontSize: '15px',
                                outline: 'none',
                                boxSizing: 'border-box',
                                transition: 'all 0.3s ease'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={verifying}
                        style={{
                            width: '100%',
                            padding: '14px',
                            backgroundColor: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '15px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                            transition: 'all 0.2s ease',
                            opacity: verifying ? 0.7 : 1
                        }}
                    >
                        {verifying ? 'Verifying School...' : 'Continue'}
                    </button>
                </form>

                {/* Connection Failed Helper Link */}
                {connectionFailed && (
                    <div style={{ marginTop: '20px', fontSize: '13px' }}>
                        <span style={{ color: '#f87171' }}>Connection failing? </span>
                        <button
                            type="button"
                            onClick={() => setShowSettings(true)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#60a5fa',
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                fontWeight: 600,
                                padding: 0
                            }}
                        >
                            Configure Server URL
                        </button>
                    </div>
                )}
            </div>

            {/* Server Settings Modal */}
            {showSettings && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(12px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '20px'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '440px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '24px',
                        padding: '32px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        color: '#fff',
                        textAlign: 'left'
                    }}>
                        <h2 style={{
                            margin: '0 0 16px',
                            fontSize: '22px',
                            fontWeight: 800,
                            color: '#60a5fa'
                        }}>
                            Server Configuration
                        </h2>
                        <p style={{
                            fontSize: '13px',
                            color: '#94a3b8',
                            lineHeight: '1.5',
                            margin: '0 0 20px'
                        }}>
                            Specify the API endpoint of your School Management backend. 
                            If testing locally on a physical phone, use your host PC's Wi-Fi IP address.
                        </p>
                        
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                                Current Active API URL
                            </div>
                            <code style={{
                                display: 'block',
                                padding: '10px 12px',
                                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: '#10b981',
                                wordBreak: 'break-all'
                            }}>
                                {localStorage.getItem('mobile_api_url') || 'DEFAULT (Emulator Loopback / Relative)'}
                                {localStorage.getItem('mobile_api_url') ? '' : ` [Resolving to: ${BASE_URL}]`}
                            </code>
                        </div>

                        <form onSubmit={handleSaveUrl}>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: '#94a3b8',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    marginBottom: '8px'
                                }}>
                                    Target Backend API URL
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. http://192.168.1.100:8000/api/"
                                    value={customUrl}
                                    onChange={(e) => setCustomUrl(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px 14px',
                                        backgroundColor: 'rgba(15, 23, 42, 0.6)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '10px',
                                        color: '#fff',
                                        fontSize: '14px',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                <span style={{ display: 'block', marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                                    Note: URL must start with http:// or https:// and typically ends with /api/
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button
                                    type="submit"
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        backgroundColor: '#2563eb',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '14px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                                    }}
                                >
                                    Save and Connect
                                </button>
                                
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={handleResetUrl}
                                        style={{
                                            flex: 1,
                                            padding: '10px',
                                            backgroundColor: '#334155',
                                            color: '#e2e8f0',
                                            border: 'none',
                                            borderRadius: '10px',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Reset Default
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowSettings(false)}
                                        style={{
                                            flex: 1,
                                            padding: '10px',
                                            backgroundColor: 'transparent',
                                            color: '#94a3b8',
                                            border: '1px solid #334155',
                                            borderRadius: '10px',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileGateway;

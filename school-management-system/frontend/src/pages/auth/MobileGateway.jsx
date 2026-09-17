import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import schoolService from '../../services/schoolService';
import { toast } from 'react-hot-toast';

const MobileGateway = () => {
    const [schoolId, setSchoolId] = useState('');
    const [verifying, setVerifying] = useState(false);
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
            toast.error('Please enter your School ID.');
            return;
        }

        // Offline Detection
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            toast.error('No Internet: Please check your connection and try again.');
            return;
        }

        setVerifying(true);
        try {
            const schoolData = await schoolService.getSchoolInfo(idToVerify);
            
            if (schoolData) {
                toast.success(`Welcome to ${schoolData.name || idToVerify}!`);
                localStorage.setItem('mobile_school_id', idToVerify);
                navigate(`/school/${idToVerify}/login`);
            }
        } catch (err) {
            console.error('Mobile Gateway verification failed:', err);

            if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
                toast.error('Connection timed out. Please check your internet connection.');
            } else if (!err.response) {
                toast.error('Unable to connect to server. Please check your internet connection.');
            } else {
                const status = err.response.status;
                if (status === 404) {
                    toast.error(`School ID "${idToVerify}" not found. Please check and try again.`);
                } else if (status >= 500) {
                    toast.error('School server is currently updating. Please try again in a few moments.');
                } else {
                    toast.error(err.response.data?.message || err.response.data?.error || 'Verification failed. Please try again.');
                }
            }
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            padding: '24px',
            fontFamily: 'sans-serif',
            position: 'relative'
        }}>
            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '400px',
                backgroundColor: '#ffffff',
                borderRadius: '24px',
                border: '1px solid #e2e8f0',
                padding: '40px 32px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.05)',
                textAlign: 'center',
                color: '#0f172a'
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <img
                        src="/SClogo.jpg"
                        alt="School Logo"
                        style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '16px',
                            objectFit: 'contain',
                            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.05)',
                            backgroundColor: '#fff',
                            padding: '4px'
                        }}
                    />
                </div>
                
                <h1 style={{
                    margin: '0 0 8px',
                    fontSize: '28px',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(to right, #1e3a8a, #2563eb)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    School Conduct
                </h1>
                
                <p style={{
                    margin: '0 0 32px',
                    color: '#64748b',
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
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '8px',
                            paddingLeft: '4px'
                        }}>
                            School ID
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. CWS, DEFAULT"
                            value={schoolId}
                            onChange={(e) => setSchoolId(e.target.value)}
                            disabled={verifying}
                            autoCapitalize="characters"
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '12px',
                                color: '#0f172a',
                                fontSize: '15px',
                                fontWeight: '600',
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
            </div>
        </div>
    );
};

export default MobileGateway;

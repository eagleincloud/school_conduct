import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, ExternalLink, MessageSquare, Award, FileText, Calendar, Info } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

// Web Audio API Synthesizer for high-fidelity notification chime sound
export const playNotificationSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // Resume context if suspended by browser autoplay policy
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    const playTone = (freq, startTime, duration, gainVal = 0.25) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Major Triad Arpeggio (C5 -> E5 -> G5)
    playTone(523.25, now, 0.22, 0.3);         // C5
    playTone(659.25, now + 0.1, 0.22, 0.3);    // E5
    playTone(783.99, now + 0.2, 0.4, 0.35);    // G5
  } catch (e) {
    console.warn("Notification sound playback blocked or unsupported:", e);
  }
};

const getNotificationIcon = (title = '') => {
  const t = title.toLowerCase();
  if (t.includes('assignment') || t.includes('homework')) return <FileText size={20} style={{ color: '#f59e0b' }} />;
  if (t.includes('exam') || t.includes('result') || t.includes('marks')) return <Award size={20} style={{ color: '#a855f7' }} />;
  if (t.includes('message') || t.includes('chat') || t.includes('reply')) return <MessageSquare size={20} style={{ color: '#3b82f6' }} />;
  if (t.includes('attendance') || t.includes('present') || t.includes('absent')) return <Calendar size={20} style={{ color: '#10b981' }} />;
  return <Bell size={20} style={{ color: '#6366f1' }} />;
};

const NotificationPopup = () => {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const [activePopup, setActivePopup] = useState(null);
  const seenIdsRef = useRef(new Set());
  const isInitialFetch = useRef(true);

  // Request browser notification permission once logged in
  useEffect(() => {
    if (isAuthenticated && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setActivePopup(null);
      seenIdsRef.current.clear();
      isInitialFetch.current = true;
      return;
    }

    // Load seen IDs from session storage
    try {
      const stored = sessionStorage.getItem('seen_notif_ids');
      if (stored) {
        seenIdsRef.current = new Set(JSON.parse(stored));
      }
    } catch (e) {}

    const checkNotifications = async () => {
      try {
        const res = await api.get('/communication/my/');
        const notifs = res.data || [];
        const unread = notifs.filter(n => !n.is_read);

        if (isInitialFetch.current) {
          // On first load, seed seenIds without triggering popups for past notifications
          unread.forEach(n => seenIdsRef.current.add(n.id));
          sessionStorage.setItem('seen_notif_ids', JSON.stringify(Array.from(seenIdsRef.current)));
          isInitialFetch.current = false;
          return;
        }

        // Find new unread notifications that haven't been alerted yet
        const newest = unread.find(n => !seenIdsRef.current.has(n.id));
        if (newest) {
          seenIdsRef.current.add(newest.id);
          sessionStorage.setItem('seen_notif_ids', JSON.stringify(Array.from(seenIdsRef.current)));

          // Play notification audio sound chime
          playNotificationSound();

          // Show floating popup toast
          setActivePopup(newest);

          // Raise Web Browser Native Notification if permitted
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(newest.title || 'New Notification', {
                body: newest.message || 'You have a new update in School Conduct.',
                icon: '/vite.svg'
              });
            } catch (err) {}
          }
        }
      } catch (err) {
        // Silent catch for network errors
      }
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 10000); // Poll every 10s

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Auto-dismiss popup after 8 seconds
  useEffect(() => {
    if (activePopup) {
      const timer = setTimeout(() => {
        setActivePopup(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [activePopup]);

  if (!activePopup) return null;

  const handlePopupClick = () => {
    setActivePopup(null);
    const role = user?.role || localStorage.getItem('user_role');
    if (role === 'student') {
      navigate('/student/notifications');
    } else if (role === 'teacher') {
      navigate('/teacher/messaging');
    } else {
      navigate('/admin/dashboard');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 99999,
        maxWidth: 380,
        width: 'calc(100vw - 40px)',
        animation: 'slideDownIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes slideDownIn {
          from { transform: translateY(-30px); opacity: 0; scale: 0.95; }
          to { transform: translateY(0); opacity: 1; scale: 1; }
        }
      `}</style>
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 18,
          padding: '16px 18px',
          boxShadow: '0 12px 36px rgba(15, 23, 42, 0.15), 0 2px 8px rgba(15, 23, 42, 0.08)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
          position: 'relative',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
        }}
        onClick={handlePopupClick}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            backgroundColor: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {getNotificationIcon(activePopup.title)}
        </div>

        <div style={{ flex: 1, paddingRight: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#2563eb',
                backgroundColor: '#eff6ff',
                padding: '2px 6px',
                borderRadius: 6,
              }}
            >
              New Alert
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
              Just now
            </span>
          </div>

          <h4
            style={{
              margin: '0 0 3px',
              fontSize: 14,
              fontWeight: 800,
              color: '#0f172a',
              lineHeight: 1.3,
            }}
          >
            {activePopup.title || 'Notification'}
          </h4>

          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              color: '#475569',
              lineHeight: 1.45,
              fontWeight: 500,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {activePopup.message}
          </p>

          <div
            style={{
              marginTop: 8,
              fontSize: 11.5,
              fontWeight: 700,
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Tap to open <ExternalLink size={12} />
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActivePopup(null);
          }}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default NotificationPopup;

import React, { useEffect } from 'react';
import { BrowserRouter as Router, useLocation, useNavigate } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import MainLayout from './layouts/MainLayout';
import useAuthStore from './store/authStore';
import { App as CapApp } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { BASE_URL } from './services/api';

import { Toaster, toast } from 'react-hot-toast';
import NotificationPopup from './components/common/NotificationPopup';

const AppContent = () => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return;

    try {
      const BackgroundNotification = registerPlugin('BackgroundNotification');
      if (isAuthenticated) {
        const token = localStorage.getItem("access_token");
        if (token) {
          BackgroundNotification.requestNotificationPermission()
            .then(() => {
              BackgroundNotification.startService({
                token: token,
                apiUrl: BASE_URL
              });
            })
            .catch((err) => console.error("Permission request failed", err));
        }
      } else {
        BackgroundNotification.stopService().catch((err) => console.error("Stop service failed", err));
      }
    } catch (e) {
      console.error("BackgroundNotification plugin failed to load", e);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const isAppPluginAvailable = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isPluginAvailable('App');
    if (!isAppPluginAvailable) return;

    const backButtonListener = CapApp.addListener('backButton', () => {
      const path = location.pathname;
      const isRootPage = 
        path === '/' || 
        path === '/login' ||
        path === '/student/dashboard' ||
        path === '/teacher/dashboard' ||
        path === '/admin/dashboard' ||
        path === '/superadmin/dashboard' ||
        path.match(/^\/school\/[^/]+\/login\/?$/);

      if (isRootPage) {
        CapApp.exitApp();
      } else {
        navigate(-1);
      }
    });

    return () => {
      backButtonListener.then((listener) => listener.remove());
    };
  }, [location, navigate]);
  
  // Define public routes that should never have the dashboard layout
  const isPublicRoute = 
    location.pathname === '/' || 
    location.pathname === '/login' ||
    location.pathname === '/superadmin/login' ||
    location.pathname === '/dealer-login' ||
    location.pathname.match(/^\/school\/[^/]+\/?$/) ||
    location.pathname.match(/^\/school\/[^/]+\/login\/?$/);

  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <NotificationPopup />
      {(isAuthenticated && !isPublicRoute) ? (
        <MainLayout>
          <AppRoutes />
        </MainLayout>
      ) : (
        <AppRoutes />
      )}
    </>
  );
};

import { StudentProvider } from './context/StudentContext';
import { ConfirmProvider } from './context/ConfirmContext';

function App() {
  useEffect(() => {
    const nativeAlert = window.alert;
    window.alert = (message) => toast(String(message || ''));

    return () => {
      window.alert = nativeAlert;
    };
  }, []);

  return (
    <Router>
      <ConfirmProvider>
        <StudentProvider>
          <AppContent />
        </StudentProvider>
      </ConfirmProvider>
    </Router>
  );
}

export default App;

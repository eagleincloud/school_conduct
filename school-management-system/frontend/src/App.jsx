import React, { useEffect } from 'react';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import MainLayout from './layouts/MainLayout';
import useAuthStore from './store/authStore';

import { Toaster, toast } from 'react-hot-toast';

const AppContent = () => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  
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

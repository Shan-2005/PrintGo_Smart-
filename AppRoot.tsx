import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import UserPage from './src/pages/UserPage';
import KioskPage from './src/pages/KioskPage';
import AndroidKioskPage from './src/pages/AndroidKioskPage';

// Detect if we are running in the Capacitor Android environment
const isAndroidApp = window.location.hostname === 'localhost' || window.location.protocol === 'file:';

const App: React.FC = () => {
  const Router = isAndroidApp ? HashRouter : BrowserRouter;

  return (
    <Router>
      <Routes>
        {/* Default route based on platform */}
        <Route path="/" element={
          isAndroidApp ? <Navigate to="/android-kiosk" replace /> : <Navigate to="/app" replace />
        } />

        <Route path="/app" element={<UserPage />} />
        <Route path="/kiosk" element={<KioskPage />} />
        <Route path="/android-kiosk" element={<AndroidKioskPage />} />
      </Routes>
    </Router>
  );
};

export default App;

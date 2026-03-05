
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import UserPage from './src/pages/UserPage';
import KioskPage from './src/pages/KioskPage';
import AndroidKioskPage from './src/pages/AndroidKioskPage';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/android-kiosk" replace />} />
        <Route path="/app" element={<UserPage />} />
        <Route path="/kiosk" element={<KioskPage />} />
        <Route path="/android-kiosk" element={<AndroidKioskPage />} />
      </Routes>
    </Router>
  );
};

export default App;

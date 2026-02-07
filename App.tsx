
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import UserPage from './src/pages/UserPage';
import KioskPage from './src/pages/KioskPage';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/app" element={<UserPage />} />
        <Route path="/kiosk" element={<KioskPage />} />
      </Routes>
    </Router>
  );
};

export default App;

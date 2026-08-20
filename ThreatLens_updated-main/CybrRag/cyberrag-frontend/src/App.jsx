// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AppShell from './components/AppShell';
import { ThemeProvider } from './contexts/ThemeContext';

// Public Pages
import Landing from './components/CyberRAGLanding';
import About from './components/About';
import Login from './components/Login';
import Signup from './components/Signup';

// Authenticated App Pages
import Dashboard from './components/Dashboard';
import LogAnalysis from './components/LogAnalysis';
import Campaigns from './components/Campaigns';
import Investigate from './components/Investigate';
import IncidentDetail from './components/IncidentDetail';
import SOAR from './components/SOAR';
import ThreatIntel from './components/ThreatIntel';
import Copilot from './components/Copilot';
import MitreExplorer from './components/MitreExplorer';
import Settings from './components/Settings';
import Reports from './components/Reports';
import Assets from './components/Assets';

import './styles/globals.css';

const AppLayout = ({ children }) => (
  <ThemeProvider>
    <PrivateRoute>
      <AppShell>{children}</AppShell>
    </PrivateRoute>
  </ThemeProvider>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected App */}
          <Route path="/dashboard"  element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/analyze"    element={<AppLayout><LogAnalysis /></AppLayout>} />
          <Route path="/campaigns"  element={<AppLayout><Campaigns /></AppLayout>} />
          <Route path="/investigate" element={<AppLayout><Investigate /></AppLayout>} />
          <Route path="/incidents/:incidentId" element={<AppLayout><IncidentDetail /></AppLayout>} />
          <Route path="/soar"       element={<AppLayout><SOAR /></AppLayout>} />
          <Route path="/intel"      element={<AppLayout><ThreatIntel /></AppLayout>} />
          <Route path="/copilot"    element={<AppLayout><Copilot /></AppLayout>} />
          <Route path="/mitre"      element={<AppLayout><MitreExplorer /></AppLayout>} />
          <Route path="/reports"    element={<AppLayout><Reports /></AppLayout>} />
          <Route path="/assets"     element={<AppLayout><Assets /></AppLayout>} />
          <Route path="/settings"   element={<AppLayout><Settings /></AppLayout>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

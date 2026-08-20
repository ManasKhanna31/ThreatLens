// src/constants/theme.js
export const colors = {
  primary: {
    main: '#6366f1',
    light: '#818cf8',
    dark: '#4f46e5',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  },
  secondary: {
    main: '#ec4899',
    light: '#f472b6',
    dark: '#db2777',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
  },
  success: {
    main: '#10b981',
    light: '#34d399',
    dark: '#059669',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  },
  warning: {
    main: '#f59e0b',
    light: '#fbbf24',
    dark: '#d97706',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
  },
  error: {
    main: '#ef4444',
    light: '#f87171',
    dark: '#dc2626',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  },
  info: {
    main: '#3b82f6',
    light: '#60a5fa',
    dark: '#2563eb',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  },
  purple: {
    main: '#8b5cf6',
    light: '#a78bfa',
    dark: '#7c3aed',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
  },
  teal: {
    main: '#14b8a6',
    light: '#2dd4bf',
    dark: '#0d9488',
    gradient: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)',
  },
  background: {
    default: '#0f172a',
    paper: '#1e293b',
    elevated: '#334155',
  },
  text: {
    primary: '#f8fafc',
    secondary: '#94a3b8',
    disabled: '#64748b',
  },
};

export const getRiskColor = (level) => {
  switch (level?.toUpperCase()) {
    case 'CRITICAL': return colors.error;
    case 'HIGH': return colors.warning;
    case 'MEDIUM': return colors.info;
    case 'LOW': return colors.success;
    default: return colors.primary;
  }
};
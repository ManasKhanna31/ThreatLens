// src/components/Sidebar.js
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  alpha,
  Divider,
  Avatar,
  Stack,
  Chip,
  Tooltip,
  Paper,
  IconButton,
  Collapse,
  Button,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  BugReport as BugReportIcon,
  LocalPolice as LocalPoliceIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Timeline as TimelineIcon,
  Circle as CircleIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';

const drawerWidth = 280;

// ThreatLens Gradient Theme Palette
const colors = {
  primary: '#4f46e5',
  secondary: '#8b5cf6',
  gradient: 'linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%)',
  primaryLight: '#f5f3ff',
  background: '#ffffff',
  surface: '#f8fafc',
  success: '#059669',
  warning: '#d97706',
  error: '#dc2626',
  info: '#2563eb',
  text: '#0f172a',
  textSecondary: '#64748b',
  border: '#e2e8f0',
};

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', badge: null },
  { text: 'Log Analysis', icon: <AnalyticsIcon />, path: '/analyze', badge: 3 },
  { text: 'MITRE Explorer', icon: <LocalPoliceIcon />, path: '/mitre', badge: null },
  { text: 'Threat Intelligence', icon: <TimelineIcon />, path: '/threats', badge: 12 },
  { text: 'Vulnerabilities', icon: <BugReportIcon />, path: '/cves', badge: 5 },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [threatsOpen, setThreatsOpen] = useState(false);
  const [vulnsOpen, setVulnsOpen] = useState(false);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          bgcolor: colors.background,
          borderRight: `1px solid ${colors.border}`,
          overflowX: 'hidden',
        },
      }}
    >
      {/* Header Branding with Gradient Icon */}
      <Box sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} onClick={() => navigate('/')} sx={{ cursor: 'pointer' }}>
          <Box sx={{
            width: 38,
            height: 38,
            background: colors.gradient,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'rotate(45deg)',
            boxShadow: `0 4px 12px ${alpha(colors.primary, 0.3)}`
          }}>
            <ShieldIcon sx={{ color: '#fff', fontSize: 22, transform: 'rotate(-45deg)' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{
              fontWeight: 900,
              lineHeight: 1.1,
              background: colors.gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              ThreatLens
            </Typography>
            <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 700, fontSize: '0.65rem', letterSpacing: 1 }}>
              ENTERPRISE SOC
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Divider sx={{ borderColor: colors.border, mx: 2, mb: 2 }} />

      {/* Gradient Status Card */}
      <Box sx={{ px: 2, mb: 3 }}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 4,
            border: `1px solid ${colors.border}`,
            bgcolor: colors.surface,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '4px',
              height: '100%',
              background: colors.gradient
            }
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 800 }}>SECURITY HEALTH</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                <CircleIcon sx={{ fontSize: 8, color: colors.success }} />
              </motion.div>
              <Typography variant="caption" sx={{ color: colors.success, fontWeight: 900 }}>OPTIMAL</Typography>
            </Box>
          </Stack>
          <Typography variant="h5" sx={{ fontWeight: 900, color: colors.text }}>98.2%</Typography>
          <Typography variant="caption" sx={{ color: colors.textSecondary }}>System Uptime</Typography>
        </Paper>
      </Box>

      {/* Navigation with Sliding Gradient Highlight */}
      <List sx={{ px: 2, flex: 1 }}>
        {menuItems.map((item) => {
          const isSelected = location.pathname === item.path;

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (item.text === 'Threat Intelligence') setThreatsOpen(!threatsOpen);
                  if (item.text === 'Vulnerabilities') setVulnsOpen(!vulnsOpen);
                }}
                selected={isSelected}
                sx={{
                  borderRadius: 3,
                  py: 1.2,
                  px: 2,
                  transition: 'all 0.2s ease',
                  '&.Mui-selected': {
                    background: alpha(colors.primary, 0.08),
                    '& .MuiListItemIcon-root': { color: colors.primary },
                    '& .MuiTypography-root': {
                      fontWeight: 800,
                      background: colors.gradient,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      right: 12,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: colors.gradient
                    }
                  },
                  '&:hover': { bgcolor: colors.primaryLight },
                }}
              >
                <ListItemIcon sx={{ minWidth: 38, color: isSelected ? colors.primary : colors.textSecondary }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: colors.text,
                  }}
                />
                {item.badge && (
                  <Box sx={{
                    px: 1,
                    py: 0.2,
                    borderRadius: 1,
                    background: colors.gradient,
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 900
                  }}>
                    {item.badge}
                  </Box>
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* User Section with Glassmorphism */}
      <Box sx={{
        p: 2,
        mt: 'auto',
        borderTop: `1px solid ${colors.border}`,
        background: `linear-gradient(to bottom, transparent, ${alpha(colors.surface, 0.5)})`
      }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <Avatar sx={{
            background: colors.gradient,
            width: 38,
            height: 38,
            fontWeight: 800,
            fontSize: '0.8rem',
            boxShadow: `0 4px 8px ${alpha(colors.primary, 0.2)}`
          }}>
            SA
          </Avatar>
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <Typography variant="body2" sx={{ color: colors.text, fontWeight: 800, noWrap: true }}>
              SOC Lead
            </Typography>
            <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.7rem' }}>
              analyst@threatlens.io
            </Typography>
          </Box>
          <IconButton size="small">
            <SettingsIcon fontSize="small" sx={{ color: colors.textSecondary }} />
          </IconButton>
        </Stack>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<LogoutIcon />}
          sx={{
            borderRadius: 2,
            borderColor: colors.border,
            color: colors.error,
            textTransform: 'none',
            fontWeight: 700,
            '&:hover': { borderColor: colors.error, bgcolor: alpha(colors.error, 0.05) }
          }}
        >
          Sign Out
        </Button>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
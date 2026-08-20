// src/components/ThreatLensDashboard.js
import React, { useState } from 'react';
import {
  Grid,
  Paper,
  Box,
  Typography,
  Avatar,
  IconButton,
  Stack,
  alpha,
  Chip,
  Button,
  LinearProgress,
  Divider,
  Card,
  CardContent,
  Badge,
  Fade,
  Zoom,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  Warning as WarningIcon,
  Timeline as TimelineIcon,
  Public as PublicIcon,
  BugReport as BugReportIcon,
  Speed as SpeedIcon,
  Download as DownloadIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Remove as RemoveIcon,
  Memory as MemoryIcon,
  Shield as ShieldIcon,
  NotificationsActive as NotificationsActiveIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts';

// ThreatLens Light Theme Palette
const colors = {
  primary: '#4f46e5',
  primaryLight: '#f5f3ff',
  secondary: '#8b5cf6',
  accent: '#fdf2f8',
  success: '#059669',
  warning: '#d97706',
  error: '#dc2626',
  info: '#2563eb',
  text: '#0f172a',
  textSecondary: '#64748b',
  background: '#ffffff',
  surface: '#f8fafc',
  surface2: '#f1f5f9',
  border: '#e2e8f0',
};

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const CyberRAGDashboard = () => {
  const [timeRange, setTimeRange] = useState('24h');

  // Static data mirrors the previous structure with updated naming
  const timelineData = [
    { time: '00:00', threats: 45, events: 1200, risk: 65 },
    { time: '04:00', threats: 42, events: 1100, risk: 62 },
    { time: '08:00', threats: 72, events: 2100, risk: 82 },
    { time: '12:00', threats: 78, events: 2300, risk: 79 },
    { time: '16:00', threats: 91, events: 2800, risk: 92 },
    { time: '20:00', threats: 76, events: 2200, risk: 77 },
    { time: 'Now', threats: 54, events: 1500, risk: 63 },
  ];

  const mitreData = [
    { technique: 'Initial Access', value: 45 },
    { technique: 'Execution', value: 38 },
    { technique: 'Persistence', value: 32 },
    { technique: 'Defense Evasion', value: 42 },
    { technique: 'Discovery', value: 25 },
  ];

  const recentThreats = [
    { id: 1, type: 'Prompt Injection', ip: '203.55.77.99', severity: 'CRITICAL', time: '2 min ago', confidence: 98 },
    { id: 2, type: 'Data Exfiltration', ip: '45.155.205.233', severity: 'HIGH', time: '5 min ago', confidence: 92 },
    { id: 3, type: 'Model Inversion', ip: '192.168.1.45', severity: 'MEDIUM', time: '15 min ago', confidence: 85 },
  ];

  const getTrendIcon = (trend) => {
    if (trend === 'up') return <ArrowUpwardIcon sx={{ fontSize: 14 }} />;
    return <ArrowDownwardIcon sx={{ fontSize: 14 }} />;
  };

  const StatCard = ({ title, value, icon: Icon, color, change, trend }) => (
    <motion.div variants={itemVariants} whileHover={{ y: -5 }}>
      <Card sx={{
        bgcolor: colors.background,
        border: `1px solid ${colors.border}`,
        borderRadius: 3,
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        transition: 'all 0.3s ease',
        '&:hover': {
          borderColor: colors.primary,
          boxShadow: `0 8px 24px ${alpha(colors.primary, 0.08)}`
        }
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Avatar sx={{ bgcolor: alpha(color, 0.1), color: color, width: 44, height: 44 }}>
              <Icon />
            </Avatar>
            <Chip
              icon={getTrendIcon(trend)}
              label={change}
              size="small"
              sx={{
                bgcolor: alpha(trend === 'up' ? colors.error : colors.success, 0.1),
                color: trend === 'up' ? colors.error : colors.success,
                fontWeight: 700
              }}
            />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: colors.text }}>{value}</Typography>
          <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 500 }}>{title}</Typography>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <Box sx={{ bgcolor: colors.surface, minHeight: '100vh', p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 5 }}>
        <Box>
          <Typography variant="h4" sx={{ color: colors.text, fontWeight: 900, fontFamily: 'Merriweather, serif' }}>
            Threat Intelligence
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            Real-time monitoring of AI infrastructure and autonomous agents
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" startIcon={<DownloadIcon />} sx={{ borderColor: colors.border, color: colors.text, textTransform: 'none' }}>
            Export Report
          </Button>
          <Button variant="contained" sx={{ bgcolor: colors.primaryLight, fontWeight: 700, textTransform: 'none', px: 3 }}>
            Acknowledge All
          </Button>
        </Stack>
      </Box>

      {/* Stats Grid */}
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="Active Threats" value="247" icon={WarningIcon} color={colors.error} change="+12%" trend="up" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="Risk Score" value="78.5" icon={SpeedIcon} color={colors.warning} change="-2%" trend="down" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="Detected CVEs" value="3,456" icon={BugReportIcon} color={colors.primary} change="+234" trend="up" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="Response Time" value="47ms" icon={MemoryIcon} color={colors.success} change="-12ms" trend="down" />
          </Grid>
        </Grid>

        {/* Charts Section */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} lg={8}>
            <Paper sx={{ p: 3, borderRadius: 4, border: `1px solid ${colors.border}`, bgcolor: colors.background }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>Threat Activity Timeline</Typography>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.border} />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: colors.textSecondary, fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: colors.textSecondary, fontSize: 12 }} />
                  <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="events" fill={alpha(colors.primary, 0.1)} barSize={30} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="threats" stroke={colors.error} strokeWidth={3} dot={{ r: 4, fill: colors.error }} />
                  <Line type="monotone" dataKey="risk" stroke={colors.primary} strokeWidth={3} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Paper sx={{ p: 3, borderRadius: 4, border: `1px solid ${colors.border}`, bgcolor: colors.background, height: '100%' }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>MITRE Coverage</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={mitreData}>
                  <PolarGrid stroke={colors.border} />
                  <PolarAngleAxis dataKey="technique" tick={{ fill: colors.textSecondary, fontSize: 11 }} />
                  <Radar name="Coverage" dataKey="value" stroke={colors.primary} fill={colors.primary} fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>

        {/* Detail Grid */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 4, border: `1px solid ${colors.border}`, bgcolor: colors.background }}>
              <Box sx={{ p: 2, borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Live Threat Feed</Typography>
                <NotificationsActiveIcon sx={{ color: colors.error }} />
              </Box>
              <Stack spacing={0}>
                {recentThreats.map((threat, idx) => (
                  <Box key={threat.id} sx={{ p: 2, borderBottom: idx < 2 ? `1px solid ${colors.border}` : 'none', '&:hover': { bgcolor: colors.surface } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{threat.type}</Typography>
                      <Chip label={threat.severity} size="small" sx={{ bgcolor: alpha(colors.error, 0.1), color: colors.error, fontSize: 10, fontWeight: 900 }} />
                    </Box>
                    <Typography variant="caption" sx={{ color: colors.textSecondary }}>{threat.ip} • {threat.time}</Typography>
                    <LinearProgress variant="determinate" value={threat.confidence} sx={{ mt: 1.5, height: 4, borderRadius: 2, bgcolor: colors.surface2, '& .MuiLinearProgress-bar': { bgcolor: colors.primary } }} />
                  </Box>
                ))}
              </Stack>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 4, border: `1px solid ${colors.border}`, bgcolor: colors.background, p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>Geographic IP Intelligence</Typography>
              {[
                { ip: '203.55.77.99', country: 'Australia', city: 'Perth', risk: 'High' },
                { ip: '45.155.205.233', country: 'France', city: 'Paris', risk: 'Medium' }
              ].map((ip) => (
                <Paper key={ip.ip} elevation={0} sx={{ p: 1.5, mb: 2, bgcolor: colors.surface, border: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{ip.ip}</Typography>
                    <Typography variant="caption" sx={{ color: colors.textSecondary }}>{ip.city}, {ip.country}</Typography>
                  </Box>
                  <Chip label={ip.risk} size="small" sx={{ bgcolor: alpha(ip.risk === 'High' ? colors.error : colors.warning, 0.1), color: ip.risk === 'High' ? colors.error : colors.warning, fontWeight: 700 }} />
                </Paper>
              ))}
              <Button fullWidth variant="text" sx={{ color: colors.primary, textTransform: 'none', fontWeight: 700 }}>View Global Intelligence</Button>
            </Card>
          </Grid>
        </Grid>
      </motion.div>
    </Box>
  );
};

export default CyberRAGDashboard;
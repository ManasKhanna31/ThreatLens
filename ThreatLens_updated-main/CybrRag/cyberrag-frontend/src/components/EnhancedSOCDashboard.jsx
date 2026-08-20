import React, { useState } from 'react';
import {
  Grid,
  Paper,
  Box,
  Typography,
  Avatar,
  IconButton,
  Tooltip,
  Stack,
  alpha,
  Alert,
  Button,
  TextField,
  Chip,
  LinearProgress,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  Security as SecurityIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Fullscreen as FullscreenIcon,
  Warning as WarningIcon,
  Timeline as TimelineIcon,
  LocalPolice as LocalPoliceIcon,
  Speed as SpeedIcon,
  CrisisAlert as CrisisAlertIcon,
  NetworkCheck as NetworkCheckIcon,
  BugReport as BugReportIcon,
  Biotech as BiotechIcon,
} from '@mui/icons-material';

// Fix these import paths - they should be relative to the current file
import StatCard from './soc/StatCard';
import RiskGauge from './soc/RiskGauge';
import IPIntelligence from './soc/IPIntelligence';
import ThreatTimeline from './soc/ThreatTimeline';
import { colors } from '../constants/theme';

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 }
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } }
};

const EnhancedSOCDashboard = () => {
  const [logInput, setLogInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const stats = [
    { title: 'Active Threats', value: '3', icon: WarningIcon, color: colors.error.main, trend: '+12%' },
    { title: 'Total Events', value: '1,247', icon: TimelineIcon, color: colors.info.main, trend: '+8%' },
    { title: 'MITRE Techniques', value: '12', icon: LocalPoliceIcon, color: colors.purple.main, trend: '+3' },
    { title: 'Risk Score', value: '78.5', icon: SpeedIcon, color: colors.warning.main, trend: 'HIGH' },
  ];

  const sampleLogs = [
    'EventID: 4688 User: admin Process: powershell.exe SourceIP: 203.55.77.99',
    'EventID: 4625 User: admin SourceIP: 203.55.77.99 Status: Failed',
  ];

  const mockData = {
    ip_intelligence: {
      ip: '203.55.77.99',
      geo: { country: 'Australia', city: 'Perth', isp: 'TPG Internet Pty Ltd' },
      reputation: { malicious: 0, suspicious: 1, harmless: 85 },
    },
  };

  return (
    <Box sx={{ maxWidth: 1600, margin: '0 auto', p: 2 }}>
      {/* Header */}
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            borderRadius: 3,
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Avatar sx={{ width: 56, height: 56, background: colors.primary.gradient }}>
                <SecurityIcon />
              </Avatar>
            </Grid>
            <Grid item xs>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>CyberRAG AI SOC</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Advanced Threat Detection Platform
              </Typography>
            </Grid>
            <Grid item>
              <Stack direction="row" spacing={1}>
                <IconButton size="small" sx={{ bgcolor: alpha(colors.primary.main, 0.1) }}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" sx={{ bgcolor: alpha(colors.primary.main, 0.1) }}>
                  <DownloadIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" sx={{ bgcolor: alpha(colors.primary.main, 0.1) }}>
                  <ShareIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Grid>
          </Grid>
        </Paper>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate">
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {stats.map((stat, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <motion.div variants={fadeInUp}>
                <StatCard {...stat} />
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </motion.div>

      {/* Main Content Grid */}
      <Grid container spacing={2}>
        {/* Left Column */}
        <Grid item xs={12} md={4}>
          <Stack spacing={2}>
            <RiskGauge score={78} level="HIGH" />
            <IPIntelligence ipData={mockData.ip_intelligence} />
          </Stack>
        </Grid>

        {/* Middle Column */}
        <Grid item xs={12} md={4}>
          <Stack spacing={2}>
            <Paper sx={{ p: 2, bgcolor: alpha(colors.error.main, 0.1), border: `1px solid ${alpha(colors.error.main, 0.2)}`, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CrisisAlertIcon sx={{ fontSize: 20, color: colors.error.main }} />
                Detection Result
              </Typography>
              <Alert severity="error" sx={{ mb: 2 }}>
                Suspicious PowerShell Execution
              </Alert>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Chip label="MITRE: T1095" size="small" sx={{ bgcolor: alpha(colors.purple.main, 0.1), color: colors.purple.main }} />
                </Grid>
                <Grid item xs={6}>
                  <Chip label="Confidence: 75%" size="small" sx={{ bgcolor: alpha(colors.warning.main, 0.1), color: colors.warning.main }} />
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ p: 2, bgcolor: alpha(colors.error.main, 0.1), border: `1px solid ${alpha(colors.error.main, 0.2)}`, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <NetworkCheckIcon sx={{ fontSize: 20, color: colors.error.main }} />
                Correlation Analysis
              </Typography>
              <Alert severity="error" sx={{ mb: 2 }}>
                Multi-Stage Attack Detected
              </Alert>
              <Typography variant="body2">Events From IP: 19</Typography>
              <Typography variant="body2">Cumulative Risk: 614.6</Typography>
            </Paper>
          </Stack>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={4}>
          <Stack spacing={2}>
            <Paper sx={{ p: 2, bgcolor: alpha(colors.info.main, 0.1), border: `1px solid ${alpha(colors.info.main, 0.2)}`, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>Parsed Log</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Event ID</Typography>
                  <Typography variant="body2">4688</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">User</Typography>
                  <Typography variant="body2">admin</Typography>
                </Grid>
              </Grid>
            </Paper>
            <ThreatTimeline />
          </Stack>
        </Grid>

        {/* Bottom Sections */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, bgcolor: alpha(colors.purple.main, 0.1), border: `1px solid ${alpha(colors.purple.main, 0.2)}`, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <BugReportIcon sx={{ color: colors.purple.main }} />
              Related CVEs
            </Typography>
            <Typography variant="body2" color="textSecondary">CVE-2021-43862 • CVSS: 3.7</Typography>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2, bgcolor: alpha(colors.primary.main, 0.1), border: `1px solid ${alpha(colors.primary.main, 0.2)}`, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <BiotechIcon sx={{ color: colors.primary.main }} />
              AI Summary
            </Typography>
            <Typography variant="body2">Suspicious PowerShell execution detected with medium confidence. Recommend immediate investigation.</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EnhancedSOCDashboard;
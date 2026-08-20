// src/components/LandingPage.js
import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Avatar,
  Stack,
  alpha,
  AppBar,
  Toolbar,
  IconButton,
  Chip,
  Paper,
  Divider,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Security as SecurityIcon,
  Shield as ShieldIcon,
  Timeline as TimelineIcon,
  BugReport as BugReportIcon,
  ArrowForward as ArrowForwardIcon,
  Menu as MenuIcon,
  Warning as WarningIcon,
  Analytics as AnalyticsIcon,
  GitHub as GitHubIcon,
  Twitter as TwitterIcon,
  LinkedIn as LinkedInIcon,
  Bolt as BoltIcon,
  SupportAgent as SupportAgentIcon,
  FormatQuote as FormatQuoteIcon,
  West as WestIcon,
  East as EastIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// Light Theme Color Palette
const colors = {
  primary: '#4f46e5',
  primaryLight: '#f5f3ff',
  secondary: '#8b5cf6',
  accent: '#fdf2f8',
  success: '#059669',
  warning: '#d97706',
  error: '#dc2626',
  info: '#2563eb',
  text: '#0f172a',        // Deep Slate for text
  textSecondary: '#64748b', // Muted Blue-Gray
  background: '#ffffff',    // Pure White background
  surface: '#f8fafc',       // Light Slate surface
  surface2: '#f1f5f9',      // Slightly darker surface
  border: '#e2e8f0',        // Subtle Border
  darkSurface: '#1e293b',   // Kept for contrast in specific cards
};

const headingFont = '"Merriweather", "Georgia", serif';
const bodyFont = '"Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif';

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
};

const getSeverityColor = (severity) => {
  switch (severity) {
    case 'CRITICAL': return colors.error;
    case 'HIGH': return colors.warning;
    case 'MEDIUM': return colors.info;
    case 'LOW': return colors.success;
    default: return colors.primary;
  }
};

const FloatingThreatCard = ({ threat, delay }) => (
  <motion.div
    initial={{ opacity: 0, x: 20, y: 20 }}
    animate={{ opacity: 1, x: 0, y: 0 }}
    transition={{ duration: 0.8, delay, type: 'spring' }}
    whileHover={{ scale: 1.03, zIndex: 10 }}
    style={{ position: 'relative', zIndex: 2, marginBottom: 16 }}
  >
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        bgcolor: '#ffffff',
        border: `1px solid ${colors.border}`,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        width: { xs: 280, md: 340 },
      }}
    >
      <Avatar sx={{ bgcolor: alpha(getSeverityColor(threat.severity), 0.1), color: getSeverityColor(threat.severity), width: 40, height: 40 }}>
        <WarningIcon fontSize="small" />
      </Avatar>
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.text, fontFamily: bodyFont }}>
          {threat.type}
        </Typography>
        <Typography variant="caption" sx={{ color: colors.textSecondary, fontFamily: bodyFont }}>
          {threat.ip} • {threat.time}
        </Typography>
      </Box>
      <Chip
        label={threat.severity}
        size="small"
        sx={{
          bgcolor: alpha(getSeverityColor(threat.severity), 0.1),
          color: getSeverityColor(threat.severity),
          fontWeight: 700,
          fontSize: '0.65rem',
          fontFamily: bodyFont
        }}
      />
    </Paper>
  </motion.div>
);

const FeatureCard = ({ icon, title, description }) => (
  <Grid item xs={12} sm={6} md={4}>
    <Paper
      elevation={0}
      sx={{
        p: 4,
        height: '100%',
        bgcolor: '#ffffff',
        border: `1px solid ${colors.border}`,
        borderRadius: 4,
        transition: 'all 0.3s ease',
        '&:hover': {
          borderColor: colors.primary,
          boxShadow: '0 10px 30px -10px rgba(79, 70, 229, 0.1)',
          transform: 'translateY(-4px)'
        }
      }}
    >
      <Avatar sx={{ bgcolor: colors.primaryLight, color: colors.primary, width: 48, height: 48, mb: 2 }}>
        {icon}
      </Avatar>
      <Typography variant="h6" sx={{ fontWeight: 700, color: colors.text, fontFamily: headingFont, mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: colors.textSecondary, fontFamily: bodyFont, lineHeight: 1.7 }}>
        {description}
      </Typography>
    </Paper>
  </Grid>
);

const FaqItem = ({ question, answer }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <Box sx={{ mb: 2 }}>
      <Button
        fullWidth
        onClick={() => setExpanded(!expanded)}
        sx={{
          bgcolor: '#ffffff',
          p: 2.5,
          borderRadius: 3,
          justifyContent: 'space-between',
          textTransform: 'none',
          color: colors.text,
          border: `1px solid ${expanded ? colors.primary : colors.border}`,
          '&:hover': {
            bgcolor: colors.surface,
            borderColor: colors.primary
          }
        }}
        endIcon={<motion.div animate={{ rotate: expanded ? 180 : 0 }}><TimelineIcon sx={{ fontSize: 20, color: colors.primary }} /></motion.div>}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600, fontFamily: bodyFont, textAlign: 'left' }}>
          {question}
        </Typography>
      </Button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Box sx={{ p: 2.5, pt: 1, color: colors.textSecondary, fontFamily: bodyFont, lineHeight: 1.7 }}>
              {answer}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

const TestimonialCard = ({ quote, name, title }) => (
  <Paper
    elevation={0}
    sx={{
      p: 4,
      m: 2,
      minWidth: { xs: '100%', md: 380 },
      bgcolor: '#ffffff',
      border: `1px solid ${colors.border}`,
      borderRadius: 4,
    }}
  >
    <FormatQuoteIcon sx={{ color: alpha(colors.primary, 0.2), fontSize: 40, mb: 2 }} />
    <Typography variant="body1" sx={{ color: colors.text, fontFamily: bodyFont, fontStyle: 'italic', mb: 3, lineHeight: 1.8 }}>
      "{quote}"
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Avatar sx={{ width: 44, height: 44, bgcolor: colors.primary, color: '#fff', fontWeight: 700 }}>
        {name.charAt(0)}
      </Avatar>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.text }}>{name}</Typography>
        <Typography variant="caption" sx={{ color: colors.textSecondary }}>{title}</Typography>
      </Box>
    </Box>
  </Paper>
);

const LandingPage = () => {
  const navigate = useNavigate();
  const [liveThreats] = useState([
    { id: 1, type: 'Prompt Injection', ip: '203.55.77.99', severity: 'HIGH', time: '2 min ago' },
    { id: 2, type: 'Data Exfiltration', ip: '45.155.205.233', severity: 'MEDIUM', time: '5 min ago' },
    { id: 3, type: 'Ransomware Detection', ip: '192.168.1.45', severity: 'CRITICAL', time: '15 min ago' },
  ]);

  const [faqItems] = useState([
    { question: 'When do security scans update?', answer: 'We scan your infrastructure and AI models in near real-time, providing continuous protection and almost immediate updates in the dashboard.' },
    { question: 'Does NOMA automatically neutralize threats?', answer: 'Yes, our adaptive defenses can automatically mitigate common attacks, such as quarantining malicious inputs or blocking suspicious traffic.' },
    { question: 'How can I integrate NOMA with my SecOps tools?', answer: 'We support seamless integrations with popular SecOps and CI/CD tools, allowing you to centralize AI security in your existing workflows.' },
    { question: 'What compliance frameworks does NOMA support?', answer: 'NOMA is designed to support various frameworks, including GDPR, HIPAA, and CCPA, and provides detailed reports and controls to aid your compliance efforts.' },
  ]);

  useEffect(() => {
    if (!document.getElementById('google-fonts-landing')) {
      const link = document.createElement('link');
      link.id = 'google-fonts-landing';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Merriweather:wght@700;900&family=Inter:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  return (
    <Box sx={{ bgcolor: colors.background, minHeight: '100vh', fontFamily: bodyFont }}>
      {/* Navigation */}
      <AppBar position="fixed" elevation={0} sx={{ bgcolor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${colors.border}` }}>
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between', height: 80 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }} onClick={() => navigate('/')}>
              <Box sx={{ width: 32, height: 32, bgcolor: colors.primary, borderRadius: 1, transform: 'rotate(45deg)' }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: colors.text, ml: 1 }}>NOMA</Typography>
            </Box>

            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 4 }}>
              {['Platform', 'Solutions', 'Pricing', 'Company'].map((item) => (
                <Typography key={item} sx={{ color: colors.textSecondary, fontWeight: 500, cursor: 'pointer', '&:hover': { color: colors.primary } }}>
                  {item}
                </Typography>
              ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="text" sx={{ color: colors.text, textTransform: 'none', fontWeight: 600 }} onClick={() => navigate('/dashboard')}>Log in</Button>
              <Button variant="contained" sx={{ bgcolor: colors.primary, px: 3, borderRadius: 2, textTransform: 'none', fontWeight: 600, boxShadow: 'none' }} onClick={() => navigate('/dashboard')}>
                Start for free
              </Button>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Hero */}
      <Box sx={{ pt: 20, pb: 15, overflow: 'hidden' }}>
        <Container maxWidth="xl">
          <Grid container spacing={8} alignItems="center">
            <Grid item xs={12} md={6}>
              <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
                <Typography variant="overline" sx={{ color: colors.primary, fontWeight: 800, letterSpacing: 2 }}>AI SECURITY PLATFORM</Typography>
                <Typography variant="h1" sx={{ fontFamily: headingFont, fontSize: { xs: '3rem', md: '4.5rem' }, fontWeight: 900, color: colors.text, lineHeight: 1.1, mt: 2, mb: 3 }}>
                  Secure your AI,<br /><span style={{ color: colors.primary }}>Everywhere.</span>
                </Typography>
                <Typography variant="h6" sx={{ color: colors.textSecondary, mb: 5, maxWidth: 520, lineHeight: 1.6 }}>
                  Unified governance and security for your LLMs and autonomous agents. Unlock the full potential of AI with enterprise-grade safety.
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Button variant="contained" size="large" sx={{ bgcolor: colors.primary, px: 4, py: 1.8, borderRadius: 2, textTransform: 'none', fontSize: '1.1rem', fontWeight: 700 }}>
                    Get Started Free
                  </Button>
                  <Button variant="outlined" size="large" sx={{ borderColor: colors.border, color: colors.text, px: 4, borderRadius: 2, textTransform: 'none', fontSize: '1.1rem', fontWeight: 700 }}>
                    Book a Demo
                  </Button>
                </Stack>
              </motion.div>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <Box sx={{ position: 'absolute', right: '0%', top: '0', width: 400, height: 400, bgcolor: colors.primaryLight, borderRadius: '50%', filter: 'blur(80px)', zIndex: 0 }} />
                <FloatingThreatCard threat={liveThreats[0]} delay={0.2} />
                <FloatingThreatCard threat={liveThreats[1]} delay={0.4} />
                <FloatingThreatCard threat={liveThreats[2]} delay={0.6} />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features */}
      <Box sx={{ py: 15, bgcolor: colors.surface }}>
        <Container maxWidth="xl">
          <Box sx={{ textAlign: 'center', mb: 10 }}>
            <Typography variant="h2" sx={{ fontFamily: headingFont, fontWeight: 800, mb: 2 }}>Unified Security Solutions</Typography>
            <Typography variant="body1" sx={{ color: colors.textSecondary, maxWidth: 600, mx: 'auto' }}>
              Comprehensive tools to protect your AI infrastructure from the ground up.
            </Typography>
          </Box>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}>
            <Grid container spacing={3}>
              <FeatureCard icon={<BoltIcon />} title="Real-time Protection" description="Continuous scanning of model inputs and outputs to prevent prompt injections." />
              <FeatureCard icon={<SecurityIcon />} title="Agent Governance" description="Set strict boundaries and permissions for autonomous AI agents." />
              <FeatureCard icon={<AnalyticsIcon />} title="Threat Intelligence" description="Stay ahead with automated detection of emerging AI-specific attack patterns." />
            </Grid>
          </motion.div>
        </Container>
      </Box>

      {/* Compliance / Contrast Section */}
      <Box sx={{ py: 15 }}>
        <Container maxWidth="xl">
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Box sx={{ bgcolor: colors.primary, p: 6, borderRadius: 6, color: '#fff', height: '100%' }}>
                <Typography variant="h4" sx={{ fontFamily: headingFont, fontWeight: 800, mb: 3 }}>Compliance Ready</Typography>
                <Typography variant="body1" sx={{ opacity: 0.9, mb: 4, lineHeight: 1.8 }}>
                  Automate your AI audit logs and maintain compliance with GDPR, HIPAA, and emerging AI regulations globally.
                </Typography>
                <Button variant="contained" sx={{ bgcolor: '#fff', color: colors.primary, fontWeight: 700, textTransform: 'none', px: 3, '&:hover': { bgcolor: '#f1f5f9' } }}>
                  View Compliance Docs
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ bgcolor: colors.darkSurface, p: 6, borderRadius: 6, color: '#fff', height: '100%' }}>
                <Typography variant="h4" sx={{ fontFamily: headingFont, fontWeight: 800, mb: 3 }}>Agent Visibility</Typography>
                <Typography variant="body1" sx={{ opacity: 0.8, mb: 4, lineHeight: 1.8 }}>
                  Eliminate shadow AI. Discover every model and agent running in your environment instantly.
                </Typography>
                <Stack direction="row" spacing={4}>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>99.9%</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.6 }}>Detection Rate</Typography>
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>24/7</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.6 }}>Monitoring</Typography>
                  </Box>
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* FAQ */}
      <Box sx={{ py: 15, bgcolor: colors.surface }}>
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ fontFamily: headingFont, fontWeight: 800, mb: 6, textAlign: 'center' }}>Questions?</Typography>
          {faqItems.map((item, i) => (
            <FaqItem key={i} question={item.question} answer={item.answer} />
          ))}
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ py: 10, borderTop: `1px solid ${colors.border}` }}>
        <Container maxWidth="xl">
          <Grid container spacing={4} justifyContent="space-between">
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Box sx={{ width: 24, height: 24, bgcolor: colors.primary, borderRadius: 0.5, transform: 'rotate(45deg)' }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>NOMA</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 3 }}>
                Securing the future of autonomous intelligence.
              </Typography>
              <Stack direction="row" spacing={1}>
                <IconButton size="small"><TwitterIcon /></IconButton>
                <IconButton size="small"><LinkedInIcon /></IconButton>
                <IconButton size="small"><GitHubIcon /></IconButton>
              </Stack>
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Product</Typography>
              {['Features', 'Security', 'Pricing'].map(link => (
                <Typography key={link} variant="body2" sx={{ color: colors.textSecondary, mb: 1, cursor: 'pointer' }}>{link}</Typography>
              ))}
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Company</Typography>
              {['About', 'Careers', 'Contact'].map(link => (
                <Typography key={link} variant="body2" sx={{ color: colors.textSecondary, mb: 1, cursor: 'pointer' }}>{link}</Typography>
              ))}
            </Grid>
          </Grid>
          <Divider sx={{ my: 6 }} />
          <Typography variant="caption" sx={{ color: colors.textSecondary }}>
            © 2026 NOMA Security Inc. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default LandingPage;
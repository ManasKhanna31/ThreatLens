// src/components/About.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Container, Grid, Typography, Button, Collapse } from '@mui/material';

const fontSans = '"Inter", "Helvetica Neue", Arial, sans-serif';
const fontMono = '"JetBrains Mono", "Fira Code", monospace';

const ImagePlaceholder = ({ label = 'IMAGE PLACEHOLDER', height = '100%', sx = {}, imageSrc = null }) => {
  if (imageSrc) {
    return (
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...sx
        }}
      >
        <Box
          component="img"
          src={imageSrc}
          alt={label}
          sx={{
            width: '100%',
            height: 'auto',
            maxHeight: '480px',
            objectFit: 'contain',
            mixBlendMode: 'screen',
            filter: 'contrast(1.35) brightness(1.08)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 65%, transparent 98%)',
            maskImage: 'radial-gradient(ellipse at center, black 65%, transparent 98%)',
            transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            '&:hover': {
              transform: 'scale(1.03)'
            }
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: height,
        bgcolor: '#161616',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.4s ease',
        '&:hover': {
          borderColor: 'rgba(255, 255, 255, 0.4)',
          bgcolor: '#1c1c1c'
        },
        ...sx
      }}
    >
      {/* Diagonal grid pattern overlay */}
      <Box
        sx={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.03) 75%, transparent 75%, transparent)',
          backgroundSize: '24px 24px',
          pointerEvents: 'none'
        }}
      />
      <Typography sx={{ fontFamily: fontMono, fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', zIndex: 1 }}>
        [ {label} ]
      </Typography>
    </Box>
  );
};

const InlineBrightRadarBadge = () => (
  <Box
    sx={{
      width: '100%',
      height: '100%',
      bgcolor: '#F8FAFC',
      borderRadius: '6px',
      border: '1px solid #E2E8F0',
      boxShadow: '0 12px 32px rgba(255, 255, 255, 0.18), inset 0 0 0 1px rgba(255, 255, 255, 0.8)',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      '&:hover': {
        transform: 'scale(1.04)',
        boxShadow: '0 16px 40px rgba(255, 255, 255, 0.32)'
      }
    }}
  >
    {/* Fine Blueprint Slate Grid */}
    <Box
      sx={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
        backgroundSize: '12px 12px',
        opacity: 0.85
      }}
    />

    {/* Concentric Radar Rings */}
    <Box sx={{ position: 'absolute', width: '90px', height: '90px', borderRadius: '50%', border: '1px dashed rgba(15, 23, 42, 0.15)' }} />
    <Box sx={{ position: 'absolute', width: '55px', height: '55px', borderRadius: '50%', border: '1px solid rgba(15, 23, 42, 0.2)' }} />
    <Box sx={{ position: 'absolute', width: '22px', height: '22px', borderRadius: '50%', border: '1px solid rgba(15, 23, 42, 0.3)', bgcolor: 'rgba(16, 185, 129, 0.12)' }} />

    {/* Sweeping Radar Arm Animation */}
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
      style={{
        position: 'absolute',
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'conic-gradient(from 0deg, rgba(16, 185, 129, 0.5) 0deg, transparent 90deg, transparent 360deg)',
        pointerEvents: 'none'
      }}
    />

    {/* Live Pulsating Anomaly Dots */}
    <motion.div
      animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      style={{
        position: 'absolute',
        top: '28%',
        left: '65%',
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: '#EF4444',
        boxShadow: '0 0 8px #EF4444'
      }}
    />
    <motion.div
      animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 2, repeat: Infinity, delay: 0.7 }}
      style={{
        position: 'absolute',
        bottom: '30%',
        left: '28%',
        width: 5,
        height: 5,
        borderRadius: '50%',
        backgroundColor: '#10B981',
        boxShadow: '0 0 6px #10B981'
      }}
    />

    {/* Sleek Bottom-Right Overlay Label */}
    <Box sx={{ position: 'absolute', bottom: 4, right: 6, display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'rgba(255, 255, 255, 0.9)', px: 0.7, py: 0.2, borderRadius: '4px', border: '1px solid #E2E8F0', zIndex: 2 }}>
      <Box sx={{ width: 4, height: 4, bgcolor: '#10B981', borderRadius: '50%', boxShadow: '0 0 4px #10B981' }} />
      <Typography sx={{ fontFamily: fontMono, fontSize: '0.52rem', fontWeight: 800, color: '#0F172A', letterSpacing: '0.08em' }}>
        RADAR // 360°
      </Typography>
    </Box>
  </Box>
);

const PanoramicThreatMapRibbon = () => (
  <Box
    sx={{
      width: '100%',
      height: '100%',
      bgcolor: '#111111',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.18)',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.35s ease',
      '&:hover': {
        borderColor: 'rgba(255, 255, 255, 0.35)',
        transform: 'scale(1.02)'
      }
    }}
  >
    {/* Global Latitude / Longitude Dotted Grid Background matched to #111111 */}
    <Box
      sx={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)',
        backgroundSize: '16px 16px',
        opacity: 0.8
      }}
    />

    {/* Subtle Monochrome Horizon Arcs */}
    <Box sx={{ position: 'absolute', top: '20%', left: '-10%', right: '-10%', height: '1px', background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.25) 0%, transparent 75%)' }} />
    <Box sx={{ position: 'absolute', bottom: '25%', left: '-10%', right: '-10%', height: '1px', background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.2) 0%, transparent 75%)' }} />

    {/* Global Intercontinental SVG Trajectory Beams in Monochrome Silver/White */}
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 500 160" preserveAspectRatio="none">
      <path d="M 90,80 Q 160,20 230,55" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.5" strokeDasharray="4 4" />
      <motion.circle
        r="3"
        fill="#FFFFFF"
        filter="drop-shadow(0 0 6px rgba(255,255,255,0.8))"
        animate={{
          cx: [90, 160, 230],
          cy: [80, 28, 55],
          opacity: [0, 1, 0]
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />

      <path d="M 230,55 Q 310,15 390,75" fill="none" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1.5" strokeDasharray="4 4" />
      <motion.circle
        r="3"
        fill="#E2E8F0"
        filter="drop-shadow(0 0 6px rgba(255,255,255,0.8))"
        animate={{
          cx: [230, 310, 390],
          cy: [55, 25, 75],
          opacity: [0, 1, 0]
        }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      />
    </svg>

    {/* Server Hub 1 */}
    <Box sx={{ position: 'absolute', left: '18%', top: '50%', transform: 'translate(-50%, -50%)' }}>
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#FFFFFF', boxShadow: '0 0 8px #FFFFFF' }} />
    </Box>

    {/* Server Hub 2 */}
    <Box sx={{ position: 'absolute', left: '46%', top: '34%', transform: 'translate(-50%, -50%)' }}>
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#E2E8F0', boxShadow: '0 0 8px #FFFFFF' }} />
    </Box>

    {/* Server Hub 3 */}
    <Box sx={{ position: 'absolute', left: '78%', top: '47%', transform: 'translate(-50%, -50%)' }}>
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#FFFFFF', boxShadow: '0 0 8px #FFFFFF' }} />
    </Box>
  </Box>
);

export default function About() {
  const navigate = useNavigate();
  const [openAccordion, setOpenAccordion] = useState(0);
  const [activeTab, setActiveTab] = useState('Platform');

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap';
    document.head.appendChild(link);
    window.scrollTo(0, 0);
  }, []);

  const principles = [
    {
      num: '( 1 )',
      title: 'Intelligence over rules',
      desc: 'Rules catch what you know. Intelligence catches what you don\'t. ThreatLens combines both — 11 parallel detection engines AND live neural threat feeds from CISA, Feodo Tracker, and URLhaus.',
      side: 'left'
    },
    {
      num: '( 2 )',
      title: 'Time is not a boundary',
      desc: 'Attackers plan in weeks. Most legacy tools think in 30-minute windows. Campaign tracking with zero session timeouts ensures a January recon and a March exfiltration are linked to the exact same adversary.',
      side: 'right'
    },
    {
      num: '( 3 )',
      title: 'Transparency by default',
      desc: 'Every risk score comes with a full breakdown. No analyst should ever wonder "why is this CRITICAL?" — ThreatLens always tells you exactly which factors contributed and by how many points.',
      side: 'left'
    },
    {
      num: '( 4 )',
      title: 'Automation without blindness',
      desc: 'SOAR automation is powerful but dangerous if unchecked. Every automated action — IP blocks, pod isolation, firewall rules — is logged, traceable, and reversible via our core API.',
      side: 'right'
    }
  ];

  const useCases = [
    { q: 'Alert Flood? We filter 99.4% of false positives.', a: 'Our neural classification layer processes raw events at kernel speed, dropping noise before it ever enters analyst triage queues.' },
    { q: 'Lateral Movement? Kernel eBPF isolates pods in < 12ms.', a: 'Automated micro-segmentation instantly severes compromised node connections without halting production cluster services.' },
    { q: 'Zero-Day Exploit? Swarm heuristics correlate on the fly.', a: 'Multi-agent AI swarms synthesize graph anomalies across your entire network topology to catch previously unknown attack vectors.' },
    { q: 'Custom Log Format? Zero-copy parser adapts instantly.', a: 'No schema rewrites or indexing downtime required. Ingest syslog, JSON, AWS CloudTrail, and custom application logs natively.' },
    { q: 'Compliance Audit? Complete API audit logs ready 24/7.', a: 'Export SOC-2, HIPAA, and ISO-compliant investigation timelines and automated incident reports with a single API call.' }
  ];

  return (
    <Box sx={{ bgcolor: '#111111', color: '#FFFFFF', fontFamily: fontSans, minHeight: '100vh', pb: 10, overflowX: 'hidden', selection: { bgcolor: '#4B21FF', color: '#FFFFFF' } }}>
      
      {/* 1. STICKY HEADER REPLICA (Exact 00:00 Recording Frame) */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 1000,
        bgcolor: '#111111',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
        px: { xs: 3, md: 6 }, py: 2.2,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        {/* Left: Underlined Stacked Title */}
        <Box sx={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }} onClick={() => navigate('/')}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', lineHeight: 1.1, letterSpacing: '-0.03em', borderBottom: '2px solid #fff', pb: 0.2 }}>
            ThreatLens®
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', lineHeight: 1.1, letterSpacing: '-0.03em', borderBottom: '2px solid #fff', pb: 0.2, mt: 0.3 }}>
            Cybersecurity
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', lineHeight: 1.1, letterSpacing: '-0.03em', borderBottom: '2px solid #fff', pb: 0.2, mt: 0.3 }}>
            Intelligence.
          </Typography>
        </Box>

        {/* Center: Tilted White Block Logo Replica */}
        <Box sx={{ display: { xs: 'none', md: 'block' }, transform: 'rotate(-12deg)', bgcolor: '#FFFFFF', color: '#111111', px: 2.5, py: 1, fontWeight: 900, fontSize: '1.35rem', letterSpacing: '-0.05em', lineHeight: 0.9, textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
          THREAT<br />LENS®
        </Box>

        {/* Right Navigation */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {[
            { label: 'OVERVIEW', path: '/' },
            { label: 'ABOUT', path: '/about' },
            { label: 'LOG IN', path: '/login' },
            { label: 'CREATE ACCESS', path: '/signup' }
          ].map((btn) => (
            <Button
              key={btn.label}
              onClick={() => navigate(btn.path)}
              sx={{
                background: btn.label === 'CREATE ACCESS' ? '#fff' : 'transparent',
                color: btn.label === 'CREATE ACCESS' ? '#000' : '#fff',
                borderRadius: '50px',
                px: 3, py: 0.6, fontFamily: fontSans, fontWeight: 700,
                fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                border: btn.label === 'CREATE ACCESS' ? '1px solid #fff' : '1px solid rgba(255,255,255,0.3)',
                '&:hover': { background: '#fff', color: '#000' }
              }}
            >
              {btn.label}
            </Button>
          ))}
        </Box>
      </Box>

      {/* 2. HERO SECTION REPLICA (Exact 00:00 Recording Frame) */}
      <Container id="section-platform" maxWidth="xl" sx={{ pt: { xs: 8, md: 10 }, pb: { xs: 12, md: 16 } }}>
        <Grid container spacing={6} alignItems="flex-start">
          
          {/* Left Column: Video Showreel Frame + Description Paragraph */}
          <Grid item xs={12} lg={6}>
            <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <Box
                sx={{
                  width: '100%',
                  height: '420px',
                  mb: 3,
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.18)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                  bgcolor: '#0a0a0c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  src="/assets/Second_Cinematic_Product_St.mp4"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </Box>
              <Typography sx={{ fontWeight: 400, fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.65, maxWidth: '520px', color: 'rgba(255,255,255,0.85)' }}>
                ThreatLens® is an autonomous cyber intelligence platform built for the fast, asymmetric world of adversarial defense. For over a decade of research and operational engineering, we’ve been trusted to trace and neutralize the threats behind enterprise infrastructure across North America and globally.
              </Typography>
            </motion.div>
          </Grid>

          {/* Right Column: Sub-nav Strip + Massive Block Typography with Inline Placeholder */}
          <Grid item xs={12} lg={6}>
            <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }}>
              {/* Top Sub-nav line */}
              <Box sx={{ display: 'flex', gap: 4, mb: 4, borderBottom: '1px solid rgba(255,255,255,0.25)', pb: 1.5 }}>
                {['Platform', 'Intelligence', 'Architecture'].map((tab) => (
                  <Typography
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      const targetId = tab === 'Platform' ? 'section-platform' : tab === 'Intelligence' ? 'section-intelligence' : 'section-architecture';
                      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    sx={{
                      fontWeight: activeTab === tab ? 700 : 500,
                      fontSize: '1.1rem',
                      borderBottom: activeTab === tab ? '3px solid #fff' : 'none',
                      pb: 1.5, mb: activeTab === tab ? -1.7 : 0,
                      opacity: activeTab === tab ? 1 : 0.5,
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      '&:hover': { opacity: 0.9 }
                    }}
                  >
                    {tab}
                  </Typography>
                ))}
              </Box>

              {/* Massive Stacked Uppercase Headline */}
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: '4.2rem', sm: '6.2rem', md: '8.2rem' }, lineHeight: 0.88, letterSpacing: '-0.05em' }}>
                  FULL
                </Typography>

                <Typography sx={{ fontWeight: 900, fontSize: { xs: '4.2rem', sm: '6.2rem', md: '8.2rem' }, lineHeight: 0.88, letterSpacing: '-0.05em' }}>
                  VISIBILITY,
                </Typography>

                {/* Line with inline placeholder box */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, md: 3 }, flexWrap: 'wrap', my: 0.5 }}>
                  <Typography sx={{ fontWeight: 900, fontSize: { xs: '4.2rem', sm: '6.2rem', md: '8.2rem' }, lineHeight: 0.88, letterSpacing: '-0.05em' }}>
                    NO
                  </Typography>
                  <Box sx={{ width: { xs: '140px', sm: '190px', md: '230px' }, height: { xs: '65px', sm: '85px', md: '105px' }, display: 'inline-block' }}>
                    <InlineBrightRadarBadge />
                  </Box>
                </Box>

                <Typography sx={{ fontWeight: 900, fontSize: { xs: '4.2rem', sm: '6.2rem', md: '8.2rem' }, lineHeight: 0.88, letterSpacing: '-0.05em' }}>
                  BLINDSPOTS.
                </Typography>
              </Box>
            </motion.div>
          </Grid>
        </Grid>
      </Container>

      {/* 3. EDITORIAL SPLIT REPLICA (Exact 00:00 - 00:01 Recording Frame) */}
      <Container id="section-intelligence" maxWidth="xl" sx={{ py: { xs: 10, md: 14 } }}>
        <Grid container spacing={8}>
          
          {/* Left Col: Giant Title + Image Placeholder with Purple Circle Button */}
          <Grid item xs={12} lg={5}>
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: '2.8rem', md: '3.8rem' }, lineHeight: 1.0, letterSpacing: '-0.04em', mb: 5 }}>
                The engine of every SOC.
              </Typography>
              
              <Box sx={{ position: 'relative', width: '100%' }}>
                <ImagePlaceholder label="SOC CORRELATION ENGINE" height="340px" imageSrc="/assets/images/ChatGPT Image May 5, 2026, 10_07_27 PM.png" />
              </Box>
            </motion.div>
          </Grid>

          {/* Right Col: What We Do + Massive Statement + 2 Columns of Text */}
          <Grid item xs={12} lg={7} sx={{ pt: { lg: 10 } }}>
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.15 }}>
              <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.35)', pt: 2, mb: 4 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  What We Do
                </Typography>
              </Box>

              <Typography sx={{ fontWeight: 700, fontSize: { xs: '2rem', md: '3.2rem' }, lineHeight: 1.1, letterSpacing: '-0.03em', mb: 6 }}>
                We don’t just alert on noise. We make sure every anomaly gets verified, traced, and neutralized, <Typography component="span" sx={{ fontWeight: 900 }}>when it matters most.</Typography>
              </Typography>

              <Grid container spacing={4}>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ fontSize: '1rem', lineHeight: 1.65, color: 'rgba(255,255,255,0.85)' }}>
                    We don't just deliver automated risk alerts. We make sure every threat sequence arrives with verified kernel context, eliminating false positives and manual cross-referencing.
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ fontSize: '1rem', lineHeight: 1.65, color: 'rgba(255,255,255,0.85)' }}>
                    Our team understands the realities of tier-1 SOC shifts and complex incident investigations. We continuously correlate multi-vector telemetry so your defense never runs late.
                  </Typography>
                </Grid>
              </Grid>
            </motion.div>
          </Grid>
        </Grid>
      </Container>

      {/* 4. MASSIVE STAGGERED SECTION (Exact 00:01 - 00:02 Recording Frame) */}
      <Container id="section-architecture" maxWidth="xl" sx={{ py: { xs: 12, md: 16 } }}>
        <motion.div initial={{ opacity: 0, y: 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
            
            {/* WE */}
            <Typography sx={{ fontWeight: 900, fontSize: { xs: '5.2rem', sm: '8.5rem', md: '12rem' }, lineHeight: 0.85, letterSpacing: '-0.06em' }}>
              WE
            </Typography>

            {/* CATCH + Wide Inline Placeholder */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, md: 4 }, flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: '5.2rem', sm: '8.5rem', md: '12rem' }, lineHeight: 0.85, letterSpacing: '-0.06em' }}>
                CATCH
              </Typography>
              <Box sx={{ width: { xs: '190px', sm: '360px', md: '500px' }, height: { xs: '65px', sm: '110px', md: '160px' } }}>
                <PanoramicThreatMapRibbon />
              </Box>
            </Box>

            {/* THREATS + Side Metadata */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: '5.2rem', sm: '8.5rem', md: '12rem' }, lineHeight: 0.85, letterSpacing: '-0.06em' }}>
                THREATS
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.5, textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
                ESTD. 2026<br />QC (CANADA)<br />©THREATLENS
              </Typography>
            </Box>

            {/* INSTANTLY + Overlapping Parallax Placeholder Box */}
            <Box sx={{ position: 'relative' }}>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: '5.2rem', sm: '8.5rem', md: '12rem' }, lineHeight: 0.85, letterSpacing: '-0.06em' }}>
                INSTANTLY.
              </Typography>
              <Box sx={{
                position: { xs: 'relative', md: 'absolute' },
                bottom: { md: '-30px' }, right: { md: '8%' },
                width: { xs: '100%', md: '360px' }, height: { xs: '200px', md: '230px' },
                mt: { xs: 3, md: 0 }, zIndex: 5
              }}>
                <ImagePlaceholder label="PARALLAX OVERLAP FRAME" height="100%" imageSrc="/assets/images/ChatGPT Image May 5, 2026, 10_08_31 PM.png" />
              </Box>
            </Box>
          </Box>

          {/* Bottom Caption Row */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mt: 8, pt: 3, borderTop: '1px solid rgba(255,255,255,0.25)', flexWrap: 'wrap', gap: 3 }}>
            <Typography sx={{ fontWeight: 600, fontSize: '1rem' }}>
              (Four core principles)
            </Typography>
            <Typography sx={{ fontSize: '1.05rem', maxWidth: '520px', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)' }}>
              We anticipate adversarial tactics and zero-day techniques before lateral movement begins. That's what makes the difference for enterprise resilience!
            </Typography>
          </Box>
        </motion.div>
      </Container>

      {/* 5. ALTERNATING/STAGGERED GRID LIST REPLICA (Exact 00:03 Frame: (1) Left, (2) Right, (3) Left, (4) Right) */}
      <Container maxWidth="xl" sx={{ py: { xs: 10, md: 14 } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {principles.map((item, i) => {
            const isRight = item.side === 'right';
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 35 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
              >
                <Grid
                  container
                  spacing={6}
                  justifyContent={isRight ? 'flex-end' : 'flex-start'}
                  sx={{ borderTop: '1px solid rgba(255,255,255,0.25)', pt: 6 }}
                >
                  <Grid item xs={12} md={7} lg={6}>
                    {/* Header line: ( 1 ) Title */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
                      <Typography sx={{ fontSize: '1.2rem', fontWeight: 600, color: '#fff' }}>
                        {item.num}
                      </Typography>
                      <Typography sx={{ fontWeight: 800, fontSize: { xs: '2.2rem', md: '2.8rem' }, lineHeight: 1.05, letterSpacing: '-0.03em' }}>
                        {item.title}
                      </Typography>
                    </Box>

                    {/* Description Paragraph */}
                    <Typography sx={{ fontSize: '1.05rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.85)', mb: 4, pl: { sm: 7 } }}>
                      {item.desc}
                    </Typography>

                    {/* Video Box right underneath */}
                    <Box sx={{ pl: { sm: 7 } }}>
                      <Box
                        sx={{
                          width: '100%',
                          height: '280px',
                          position: 'relative',
                          overflow: 'hidden',
                          borderRadius: '12px',
                          border: '1px solid rgba(255,255,255,0.18)',
                          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                          bgcolor: '#0a0a0c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <video
                          autoPlay
                          loop
                          muted
                          playsInline
                          src={
                            i === 0
                              ? "/assets/Aspect_Ratio__Create_an_u.mp4"
                              : i === 1
                              ? "/assets/Duration_seconds_Aspect_Ra.mp4"
                              : i === 2
                              ? "/assets/video_3.mp4"
                              : "/assets/video4.mp4"
                          }
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </motion.div>
            );
          })}
        </Box>
      </Container>

      {/* 6. FULL-WIDTH HERO PLACEHOLDER + ACCORDION (Exact 00:04 - 00:06 Recording Frame) */}
      <Container maxWidth="xl" sx={{ py: { xs: 10, md: 14 } }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
          {/* Massive Full-Width Placeholder Box */}
          <Box sx={{ width: '100%', mb: 8 }}>
            <ImagePlaceholder label="EVERY SOC IS DIFFERENT. WE ALWAYS STAY IN TUNE." height="460px" imageSrc="/assets/images/ChatGPT Image Jul 4, 2026, 11_43_48 AM.png" />
          </Box>

          {/* Split Row below image */}
          <Grid container spacing={8} alignItems="flex-start">
            {/* Left Col Paragraph */}
            <Grid item xs={12} md={5}>
              <Typography sx={{ fontSize: '1.1rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.9)', mb: 3 }}>
                We don't just show up when alerts trigger. We arrive prepared, committed, and thinking several steps ahead of adversarial campaigns.
              </Typography>
              <Typography sx={{ fontSize: '1rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.7)' }}>
                That's what makes the absolute difference when infrastructure and mission-critical data are on the line.
              </Typography>
            </Grid>

            {/* Right Col Accordion (Use Cases Replica) */}
            <Grid item xs={12} md={7}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, pb: 1, borderBottom: '1px solid rgba(255,255,255,0.3)' }}>
                <Typography sx={{ fontWeight: 700 }}>
                  ( Use Cases )
                </Typography>
                <Typography sx={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                  Trust our autonomous SOC engines and enjoy peace of mind!
                </Typography>
              </Box>

              {useCases.map((uc, idx) => {
                const isOpen = openAccordion === idx;
                return (
                  <Box key={idx} sx={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                    <Box
                      onClick={() => setOpenAccordion(isOpen ? -1 : idx)}
                      sx={{ py: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                    >
                      <Typography sx={{ fontWeight: 700, fontSize: '1.15rem' }}>
                        {uc.q}
                      </Typography>
                      <Typography sx={{ fontSize: '1.4rem', fontWeight: 300 }}>
                        {isOpen ? '—' : '+'}
                      </Typography>
                    </Box>
                    <Collapse in={isOpen}>
                      <Typography sx={{ pb: 3, pr: 4, fontSize: '0.98rem', lineHeight: 1.65, color: 'rgba(255,255,255,0.8)' }}>
                        {uc.a}
                      </Typography>
                    </Collapse>
                  </Box>
                );
              })}
            </Grid>
          </Grid>
        </motion.div>
      </Container>

      {/* 7. GIANT CENTERED TEXT + HORIZONTAL STATS TABLE (Exact 00:07 Recording Frame) */}
      <Container maxWidth="xl" sx={{ py: { xs: 12, md: 16 } }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
          {/* Centered Stacked Text */}
          <Box sx={{ textAlign: 'center', mb: 12 }}>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: '4rem', sm: '7rem', md: '10rem' }, lineHeight: 0.88, letterSpacing: '-0.05em', textTransform: 'uppercase' }}>
              A DEFENSE
            </Typography>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: '4rem', sm: '7rem', md: '10rem' }, lineHeight: 0.88, letterSpacing: '-0.05em', textTransform: 'uppercase' }}>
              THAT NEVER
            </Typography>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: '4rem', sm: '7rem', md: '10rem' }, lineHeight: 0.88, letterSpacing: '-0.05em', textTransform: 'uppercase' }}>
              SLEEPS
            </Typography>
          </Box>

          {/* Stats Horizontal Bordered Strip */}
          <Grid container spacing={6} alignItems="flex-start" sx={{ borderTop: '1px solid rgba(255,255,255,0.25)', pt: 4 }}>
            {/* Left Col */}
            <Grid item xs={12} md={4}>
              <Typography sx={{ fontWeight: 600, fontSize: '1.1rem', lineHeight: 1.6, maxWidth: '340px' }}>
                We engineer core telemetry, we run 24/7 continuous analysis, and our neural engines are always active.
              </Typography>
            </Grid>

            {/* Right Horizontal Rows */}
            <Grid item xs={12} md={8}>
              {[
                { stat: '11', desc: 'Parallel Detection Engines simultaneously active' },
                { stat: '12+', desc: 'Log Formats Parsed without schema transformations' },
                { stat: '100%', desc: 'Of risk scores include complete transparent explanation' },
                { stat: '24/7', desc: 'Real-time eBPF kernel telemetry & AI incident triage' }
              ].map((row, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    py: 3,
                    borderBottom: '1px solid rgba(255,255,255,0.2)',
                    flexWrap: 'wrap', gap: 2
                  }}
                >
                  <Typography sx={{ fontWeight: 900, fontSize: { xs: '2.5rem', md: '3.5rem' }, letterSpacing: '-0.04em', lineHeight: 1 }}>
                    {row.stat}
                  </Typography>
                  <Typography sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.85)', textAlign: 'right' }}>
                    {row.desc}
                  </Typography>
                </Box>
              ))}
            </Grid>
          </Grid>
        </motion.div>
      </Container>

      {/* 8. "Ready? Let's secure your network." SPLIT WITH VIBRANT PURPLE CARD (Exact 00:08 - 00:09 Recording Frame) */}
      <Container maxWidth="xl" sx={{ py: { xs: 10, md: 14 } }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
          <Grid container spacing={6}>
            {/* Left Col: Tall Placeholder + Subtext */}
            <Grid item xs={12} lg={6}>
              <ImagePlaceholder label="OPERATIONAL FLEET TELEMETRY" height="420px" imageSrc="/assets/images/ChatGPT Image May 5, 2026, 10_07_52 PM.png" sx={{ mb: 2 }} />
              <Typography sx={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                We run multi-tenant architecture, continuously optimized for zero latency.
              </Typography>
            </Grid>

            {/* Right Col: Headline + Purple Card (#4B21FF) */}
            <Grid item xs={12} lg={6} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: '3.5rem', md: '5.5rem' }, lineHeight: 0.9, letterSpacing: '-0.04em', mb: 2 }}>
                  Ready?
                </Typography>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: '3.5rem', md: '5.5rem' }, lineHeight: 0.9, letterSpacing: '-0.04em', mb: 6, textAlign: 'right' }}>
                  Let's hit<br />the defense.
                </Typography>
              </Box>

              {/* Purple CTA Card */}
              <Box sx={{
                bgcolor: '#4B21FF', p: { xs: 4, md: 6 }, borderRadius: 2,
                display: 'flex', flexDirection: 'column', gap: 4
              }}>
                <Typography sx={{ fontWeight: 700, fontSize: { xs: '1.3rem', md: '1.6rem' }, color: '#fff', lineHeight: 1.3 }}>
                  Let us talk about your SOC operations and how our autonomous AI agents can support it.
                </Typography>
                <Button
                  onClick={() => navigate('/signup')}
                  sx={{
                    alignSelf: 'flex-start',
                    bgcolor: 'transparent', border: '1.5px solid rgba(255,255,255,0.4)',
                    color: '#fff', borderRadius: '50px', px: 4, py: 1.5,
                    fontWeight: 700, fontSize: '0.95rem',
                    display: 'flex', alignItems: 'center', gap: 2,
                    '&:hover': { bgcolor: '#fff', color: '#4B21FF' },
                    transition: 'all 0.3s'
                  }}
                >
                  Plan your security architecture →
                </Button>
              </Box>
            </Grid>
          </Grid>
        </motion.div>
      </Container>

      {/* 9. DOT-MATRIX WATERMARK SECTION (Exact 00:10 - 00:12 Recording Frame) */}
      <Box sx={{ position: 'relative', py: { xs: 16, md: 24 }, mt: 10, overflow: 'hidden' }}>
        {/* Perforated Dot-Matrix Background Text */}
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '100%', textAlign: 'center', pointerEvents: 'none', opacity: 0.12
        }}>
          <Typography sx={{
            fontFamily: fontMono, fontWeight: 900,
            fontSize: { xs: '4rem', sm: '7rem', md: '11rem' },
            lineHeight: 0.82, letterSpacing: '-0.04em',
            color: '#fff'
          }}>
            ANALYSTS<br />DON'T<br />REMEMBER<br />ALERTS.<br />THEY<br />REMEMBER<br />WHO<br />STOPPED<br />THEM.
          </Typography>
        </Box>

        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <Typography sx={{ fontFamily: fontMono, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', mb: 2 }}>
            ( N°2 )
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.8rem', md: '2.5rem' }, lineHeight: 1.2, mb: 4 }}>
            Discover our autonomous world<br />and what makes up our core intelligence.
          </Typography>
          
          <Button
            onClick={() => navigate('/')}
            sx={{
              bgcolor: '#4B21FF', color: '#fff', borderRadius: '50px',
              px: 5, py: 1.8, fontWeight: 800, fontSize: '1rem',
              boxShadow: '0 10px 30px rgba(75, 33, 255, 0.4)',
              '&:hover': { bgcolor: '#3914cc', transform: 'scale(1.03)' },
              transition: 'all 0.2s'
            }}
          >
            Platform Overview →
          </Button>
        </Container>
      </Box>

      {/* Bottom Footer Line */}
      <Container maxWidth="xl">
        <Box sx={{ pt: 6, borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
            ThreatLens® Entertainment & Enterprise Cybersecurity Logistics
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
            2026 © ALL RIGHTS RESERVED
          </Typography>
        </Box>
      </Container>

    </Box>
  );
}

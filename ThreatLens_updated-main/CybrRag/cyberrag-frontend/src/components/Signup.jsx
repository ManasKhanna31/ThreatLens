// src/components/Signup.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiErrorMessage } from '../services/api';

const fontSans = '"Inter", "Helvetica Neue", Arial, sans-serif';
const fontMono = '"JetBrains Mono", monospace';

export default function Signup() {
  const [form, setForm] = useState({ username: '', full_name: '', email: '', organization: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState('');
  const { signup } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    if (!form.username || !form.email || !form.password) return 'Username, email and password are required.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (form.password !== form.confirm) return 'Passwords do not match.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Enter a valid email address.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true); setError('');
    try {
      await signup({ username: form.username, full_name: form.full_name || undefined, email: form.email, organization: form.organization || undefined, password: form.password });
      navigate('/dashboard');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to initialize node. Try a different username.'));
    } finally { setLoading(false); }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#F9F9F7', 
      color: '#111111', 
      display: 'flex', 
      flexDirection: 'column',
      fontFamily: fontSans 
    }}>
      <style>{`
        .ledger-input {
          width: 100%;
          background: transparent;
          border: none;
          color: #555555 !important;
          -webkit-text-fill-color: #555555 !important;
          font-family: ${fontSans};
          font-size: 1.1rem;
          font-weight: 500;
          padding: 14px 0;
          outline: none;
          box-sizing: border-box;
        }
        .ledger-input::placeholder {
          color: #A0A09C;
          font-weight: 400;
        }
        .ledger-row {
          border-bottom: 1px solid rgba(0,0,0,0.12);
          position: relative;
          transition: border-color 0.3s ease;
        }
        .ledger-row-focused {
          border-bottom: 2px solid #111111;
        }
      `}</style>

      {/* Top Architectural Bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '24px 48px', 
        borderBottom: '1px solid rgba(0,0,0,0.12)',
        background: '#F9F9F7'
      }}>
        <div 
          onClick={() => navigate('/')} 
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}
        >
          <span style={{ fontWeight: 900, fontSize: '1.3rem', letterSpacing: '-0.04em' }}>ThreatLens®</span>
          <span style={{ fontFamily: fontMono, fontSize: '0.7rem', opacity: 0.4, letterSpacing: '0.15em' }}>// NODE REGISTRATION SHEET</span>
        </div>
        <Link to="/" style={{ fontFamily: fontMono, fontSize: '0.75rem', color: '#111111', textDecoration: 'none', fontWeight: 700, letterSpacing: '0.05em' }}>
          ← RETURN TO OVERVIEW
        </Link>
      </div>

      {/* Main Architectural Ledger Split (ZERO CARDS!) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: window.innerWidth < 900 ? 'column' : 'row' }}>
        
        {/* Left Sidebar — Ledger Index */}
        <div style={{ 
          width: window.innerWidth < 900 ? '100%' : '360px', 
          borderRight: window.innerWidth < 900 ? 'none' : '1px solid rgba(0,0,0,0.12)', 
          borderBottom: window.innerWidth < 900 ? '1px solid rgba(0,0,0,0.12)' : 'none',
          padding: '48px 48px', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div>
            <div style={{ fontFamily: fontMono, fontSize: '0.7rem', fontWeight: 700, color: '#888', letterSpacing: '0.15em', marginBottom: '24px' }}>
              01 // DEPLOYMENT PROTOCOL
            </div>

            <h2 style={{ fontWeight: 900, fontSize: '2.2rem', letterSpacing: '-0.04em', margin: '0 0 32px', lineHeight: 1.1 }}>
              Node Access<br/>Specification.
            </h2>

            {['IDENTITY SPECIFICATION', 'CONTACT TELEMETRY', 'SECURITY CREDENTIALS', 'ADMINISTRATIVE PRIVILEGES'].map((item, idx) => (
              <div key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.12)', padding: '16px 0', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: fontMono, fontSize: '0.72rem', fontWeight: 700, color: '#111', letterSpacing: '0.08em' }}>
                  0{idx + 1} / {item}
                </span>
                <span style={{ fontFamily: fontMono, fontSize: '0.7rem', color: idx === 0 ? '#111' : '#888' }}>
                  {idx === 0 ? 'REQUIRED' : 'PENDING'}
                </span>
              </div>
            ))}
          </div>

          <div style={{ fontFamily: fontMono, fontSize: '0.7rem', color: '#666', lineHeight: 1.6, borderTop: '1px solid rgba(0,0,0,0.12)', paddingTop: '24px', marginTop: '32px' }}>
            <div style={{ fontWeight: 700, color: '#111', marginBottom: '4px' }}>→ Root Privilege Node</div>
            <div>The initial deployed account initializes root SOC policy override parameters.</div>
          </div>
        </div>

        {/* Right Form Area — Edge-to-Edge Ledger Form Sheet */}
        <div style={{ flex: 1, padding: '48px 64px', display: 'flex', flexDirection: 'column', justify: 'center', maxWidth: '780px' }}>
          
          <div style={{ marginBottom: '36px' }}>
            <div style={{ fontFamily: fontMono, fontSize: '0.75rem', fontWeight: 700, color: '#111', letterSpacing: '0.12em', marginBottom: '8px' }}>
              [ SECTION 02 : REGISTRATION PARAMETERS ]
            </div>
            <h1 style={{ fontSize: '2.8rem', fontWeight: 900, letterSpacing: '-0.04em', margin: 0, lineHeight: 1 }}>
              Create Access.
            </h1>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }}
                style={{ 
                  fontFamily: fontMono, 
                  fontSize: '0.8rem', 
                  color: '#D32F2F', 
                  borderTop: '1px solid #D32F2F',
                  borderBottom: '1px solid #D32F2F',
                  padding: '14px 0', 
                  marginBottom: '28px' 
                }}
              >
                ⚠️ REGISTRATION EXCEPTION: {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 600 ? '1fr' : '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
              {/* Field 1: Username */}
              <div className={`ledger-row ${focused === 'username' ? 'ledger-row-focused' : ''}`}>
                <label style={{ fontFamily: fontMono, fontSize: '0.65rem', fontWeight: 700, color: focused === 'username' ? '#111' : '#777', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  01 / USERNAME IDENTIFIER *
                </label>
                <input className="ledger-input" type="text" placeholder="analyst_01"
                  value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                  onFocus={() => setFocused('username')} onBlur={() => setFocused('')}
                  autoComplete="username" autoFocus />
              </div>

              {/* Field 2: Full Name */}
              <div className={`ledger-row ${focused === 'full_name' ? 'ledger-row-focused' : ''}`}>
                <label style={{ fontFamily: fontMono, fontSize: '0.65rem', fontWeight: 700, color: focused === 'full_name' ? '#111' : '#777', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  02 / OPERATOR FULL NAME
                </label>
                <input className="ledger-input" type="text" placeholder="Jane Smith"
                  value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                  onFocus={() => setFocused('full_name')} onBlur={() => setFocused('')}
                  autoComplete="name" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 600 ? '1fr' : '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
              {/* Field 3: Email */}
              <div className={`ledger-row ${focused === 'email' ? 'ledger-row-focused' : ''}`}>
                <label style={{ fontFamily: fontMono, fontSize: '0.65rem', fontWeight: 700, color: focused === 'email' ? '#111' : '#777', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  03 / ENTERPRISE EMAIL *
                </label>
                <input className="ledger-input" type="email" placeholder="analyst@company.com"
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  onFocus={() => setFocused('email')} onBlur={() => setFocused('')}
                  autoComplete="email" />
              </div>

              {/* Field 4: Organization */}
              <div className={`ledger-row ${focused === 'org' ? 'ledger-row-focused' : ''}`}>
                <label style={{ fontFamily: fontMono, fontSize: '0.65rem', fontWeight: 700, color: focused === 'org' ? '#111' : '#777', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  04 / ORGANIZATION UNIT
                </label>
                <input className="ledger-input" type="text" placeholder="Acme Security Corp"
                  value={form.organization} onChange={e => setForm({ ...form, organization: e.target.value })}
                  onFocus={() => setFocused('org')} onBlur={() => setFocused('')} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 600 ? '1fr' : '1fr 1fr', gap: '24px', marginBottom: '36px' }}>
              {/* Field 5: Password */}
              <div className={`ledger-row ${focused === 'pass' ? 'ledger-row-focused' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label style={{ fontFamily: fontMono, fontSize: '0.65rem', fontWeight: 700, color: focused === 'pass' ? '#111' : '#777', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    05 / PASSPHRASE *
                  </label>
                  <span onClick={() => setShowPassword(!showPassword)} style={{ fontFamily: fontMono, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', color: '#111', textDecoration: 'underline' }}>
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </span>
                </div>
                <input className="ledger-input" type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  onFocus={() => setFocused('pass')} onBlur={() => setFocused('')}
                  autoComplete="new-password" />
              </div>

              {/* Field 6: Confirm */}
              <div className={`ledger-row ${focused === 'confirm' ? 'ledger-row-focused' : ''}`}>
                <label style={{ fontFamily: fontMono, fontSize: '0.65rem', fontWeight: 700, color: focused === 'confirm' ? '#111' : '#777', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  06 / CONFIRM PASSPHRASE *
                </label>
                <input className="ledger-input" type={showPassword ? 'text' : 'password'} placeholder="Repeat passphrase"
                  value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })}
                  onFocus={() => setFocused('confirm')} onBlur={() => setFocused('')}
                  autoComplete="new-password" />
              </div>
            </div>

            {/* Full Width Architectural Bar */}
            <motion.button type="submit" disabled={loading}
              whileHover={{ bgcolor: '#222222' }} whileTap={{ scale: 0.995 }}
              style={{
                width: '100%', background: '#111111', color: '#FFFFFF', border: 'none', padding: '24px 32px',
                fontFamily: fontMono, fontWeight: 700, fontSize: '0.9rem', textTransform: 'uppercase',
                letterSpacing: '0.15em', cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
              <span>{loading ? '// DEPLOYING NODE PARAMETERS...' : 'INITIALIZE ANALYST NODE'}</span>
              <span>→</span>
            </motion.button>
          </form>

          <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(0,0,0,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: fontSans, fontSize: '0.9rem', color: '#666' }}>Already deployed an analyst node?</span>
            <Link to="/login" style={{ fontFamily: fontMono, fontSize: '0.8rem', fontWeight: 700, color: '#111111', textDecoration: 'none', borderBottom: '2px solid #111111', paddingBottom: '4px', letterSpacing: '0.05em' }}>
              ACCESS SESSION TERMINAL →
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}

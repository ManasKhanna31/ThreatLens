// src/components/Login.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiErrorMessage } from '../services/api';

const fontSans = '"Inter", "Helvetica Neue", Arial, sans-serif';
const fontMono = '"JetBrains Mono", monospace';

export default function Login() {
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.login || !form.password) { setError('All fields are required.'); return; }
    setLoading(true); setError('');
    try {
      await login(form.login, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid credentials. Please verify your login details.'));
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
          color: #111111;
          font-family: ${fontSans};
          font-size: 1.15rem;
          font-weight: 500;
          padding: 18px 0;
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
          <span style={{ fontFamily: fontMono, fontSize: '0.7rem', opacity: 0.4, letterSpacing: '0.15em' }}>// PROTOCOL 4.2</span>
        </div>
        <Link to="/" style={{ fontFamily: fontMono, fontSize: '0.75rem', color: '#111111', textDecoration: 'none', fontWeight: 700, letterSpacing: '0.05em' }}>
          ← RETURN TO OVERVIEW
        </Link>
      </div>

      {/* Main Architectural Ledger Split (NO CARDS!) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: window.innerWidth < 900 ? 'column' : 'row' }}>
        
        {/* Left Side: Editorial Typography & Manifesto */}
        <div style={{ 
          width: window.innerWidth < 900 ? '100%' : '45%', 
          borderRight: window.innerWidth < 900 ? 'none' : '1px solid rgba(0,0,0,0.12)', 
          borderBottom: window.innerWidth < 900 ? '1px solid rgba(0,0,0,0.12)' : 'none',
          padding: '64px 48px', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontFamily: fontMono, fontSize: '0.7rem', fontWeight: 700, color: '#888', letterSpacing: '0.15em', marginBottom: '24px' }}>
              01 // IDENTITY VERIFICATION LEDGER
            </div>
            
            {['Autonomous', 'Threat Defense', 'Command.'].map((line, idx) => (
              <div key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.12)', paddingBottom: '12px', marginBottom: '12px' }}>
                <span style={{ fontWeight: 900, fontSize: { xs: '2.5rem', lg: '3.5rem' }, letterSpacing: '-0.05em', lineHeight: 1 }}>{line}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '64px' }}>
            <p style={{ fontSize: '1.2rem', lineHeight: 1.6, fontWeight: 400, color: '#444', margin: '0 0 24px', maxWidth: '440px' }}>
              Establish secure identity credentials to initiate root telemetry streams and neural Copilot interfaces.
            </p>
            <div style={{ display: 'flex', gap: '32px', paddingTop: '24px', borderTop: '1px solid rgba(0,0,0,0.12)' }}>
              <div>
                <div style={{ fontFamily: fontMono, fontSize: '0.65rem', fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>SECURITY TIER</div>
                <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '4px' }}>ZERO-TRUST v2</div>
              </div>
              <div>
                <div style={{ fontFamily: fontMono, fontSize: '0.65rem', fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>ENCRYPTION</div>
                <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '4px' }}>AES-256-GCM</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Seamless Edge-to-Edge Architectural Form Sheet (ZERO CARD BOXES!) */}
        <div style={{ flex: 1, padding: '64px 64px', display: 'flex', flexDirection: 'column', justify: 'center', maxWidth: '680px' }}>
          
          <div style={{ marginBottom: '48px' }}>
            <div style={{ fontFamily: fontMono, fontSize: '0.75rem', fontWeight: 700, color: '#111', letterSpacing: '0.12em', marginBottom: '8px' }}>
              [ SECTION 02 : CREDENTIAL ENTRY ]
            </div>
            <h1 style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-0.04em', margin: 0, lineHeight: 1 }}>
              Sign In.
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
                  padding: '16px 0', 
                  marginBottom: '32px' 
                }}
              >
                ⚠️ AUDIT EXCEPTION: {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit}>
            {/* Field 1: Username Sheet Row */}
            <div className={`ledger-row ${focused === 'login' ? 'ledger-row-focused' : ''}`} style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label style={{ 
                  fontFamily: fontMono, 
                  fontSize: '0.68rem', 
                  fontWeight: 700, 
                  color: focused === 'login' ? '#111' : '#777', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.1em' 
                }}>
                  01 / ANALYST IDENTIFIER OR EMAIL
                </label>
                {focused === 'login' && <span style={{ fontFamily: fontMono, fontSize: '0.65rem', color: '#111' }}>● ACTIVE</span>}
              </div>
              <input 
                className="ledger-input" 
                type="text" 
                placeholder="analyst_root or user@enterprise.com"
                value={form.login} 
                onChange={e => setForm({ ...form, login: e.target.value })}
                onFocus={() => setFocused('login')} 
                onBlur={() => setFocused('')}
                autoComplete="username" 
                autoFocus 
              />
            </div>

            {/* Field 2: Password Sheet Row */}
            <div className={`ledger-row ${focused === 'pass' ? 'ledger-row-focused' : ''}`} style={{ marginBottom: '48px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label style={{ 
                  fontFamily: fontMono, 
                  fontSize: '0.68rem', 
                  fontWeight: 700, 
                  color: focused === 'pass' ? '#111' : '#777', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.1em' 
                }}>
                  02 / SECURITY PASSPHRASE
                </label>
                <span 
                  onClick={() => setShowPassword(!showPassword)} 
                  style={{ fontFamily: fontMono, fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', color: '#111', textDecoration: 'underline' }}
                >
                  {showPassword ? 'HIDE PASSPHRASE' : 'REVEAL PASSPHRASE'}
                </span>
              </div>
              <input 
                className="ledger-input" 
                type={showPassword ? 'text' : 'password'} 
                placeholder="••••••••••••••••"
                value={form.password} 
                onChange={e => setForm({ ...form, password: e.target.value })}
                onFocus={() => setFocused('pass')} 
                onBlur={() => setFocused('')}
                autoComplete="current-password" 
              />
            </div>

            {/* Architectural Full-Width Action Bar (ZERO ROUNDED CORNERS!) */}
            <motion.button 
              type="submit" 
              disabled={loading}
              whileHover={{ bgcolor: '#222222' }} 
              whileTap={{ scale: 0.995 }}
              style={{
                width: '100%',
                background: '#111111', 
                color: '#FFFFFF', 
                border: 'none', 
                padding: '24px 32px',
                fontFamily: fontMono, 
                fontWeight: 700, 
                fontSize: '0.9rem', 
                textTransform: 'uppercase',
                letterSpacing: '0.15em', 
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1, 
                transition: 'all 0.2s',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>{loading ? '// VERIFYING CREDENTIALS...' : 'AUTHENTICATE SESSION'}</span>
              <span>→</span>
            </motion.button>
          </form>

          {/* Ledger Footer */}
          <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid rgba(0,0,0,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: fontSans, fontSize: '0.9rem', color: '#666' }}>Unregistered operator node?</span>
            <Link 
              to="/signup" 
              style={{ 
                fontFamily: fontMono, 
                fontSize: '0.8rem', 
                fontWeight: 700, 
                color: '#111111', 
                textDecoration: 'none',
                borderBottom: '2px solid #111111',
                paddingBottom: '4px',
                letterSpacing: '0.05em'
              }}
            >
              INITIALIZE ACCESS PROTOCOL →
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}

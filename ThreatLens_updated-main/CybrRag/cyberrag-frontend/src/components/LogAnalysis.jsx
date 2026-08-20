// src/components/LogAnalysis.js — Threat Studio (no MUI)
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeLog, getApiErrorMessage } from '../services/api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';





delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const SAMPLE_LOGS = [
  { label: 'Windows Brute Force', value: '2024-01-15 10:23:45 FAILED_LOGIN user=admin src_ip=203.0.113.99 event_id=4625 dest_ip=192.168.1.10' },
  { label: 'PowerShell Obfuscation', value: 'Jan 15 11:45:23 server01 PowerShell[1234]: Invoke-Expression -EncodedCommand dABlAHMAdA== user=SYSTEM event_id=4104' },
  { label: 'Mimikatz/LSASS Dump', value: '2024-01-15 14:30:00 PROCESS_CREATE process=mimikatz.exe user=jdoe src_ip=10.0.0.5 event_id=4688' },
  { label: 'Successful Post-Breach Login', value: '2024-01-15 15:00:00 SUCCESS_LOGIN user=admin src_ip=203.0.113.99 event_id=4624 port=22' },
  { label: 'Data Exfiltration', value: 'Jan 15 16:22:11 firewall ALLOW src=10.0.0.25 dst=198.51.100.45 port=443 bytes=524288000 protocol=HTTPS' },
  { label: 'Cisco ASA Deny', value: 'Jan 15 09:12:00 %ASA-2-106001: Inbound TCP connection denied from 203.0.113.50/4444 to 192.168.1.1/80 flags SYN on interface outside' },
];

function RiskGauge({ score }) {
  const pct = Math.min(100, Math.max(0, score || 0));
  const color = pct >= 80 ? 'var(--danger)' : pct >= 55 ? 'var(--warning)' : pct >= 30 ? 'var(--info)' : 'var(--success)';
  const level = pct >= 80 ? 'CRITICAL' : pct >= 55 ? 'HIGH' : pct >= 30 ? 'MEDIUM' : 'LOW';
  return (
    <div className="risk-gauge">
      <div className="risk-gauge-ring" style={{ '--pct': pct, '--color': color }}>
        <div className="risk-gauge-inner">
          <span className="risk-gauge-score" style={{ color }}>{pct}</span>
          <span className="risk-gauge-label">/100</span>
        </div>
      </div>
      <div className="risk-gauge-level" style={{ color }}>{level}</div>
    </div>
  );
}

function ParsedField({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="parsed-field">
      <span className="parsed-label">{label}</span>
      <span className={`parsed-value ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function RiskFactors({ factors }) {
  if (!factors?.length) return null;
  return (
    <div className="risk-factors">
      {factors.map((f, i) => (
        <div key={i} className="risk-factor-item">
          <span className="rf-name">{f.factor || f}</span>
          {f.score !== undefined && <span className="rf-score">+{f.score}pts</span>}
        </div>
      ))}
    </div>
  );
}

export default function LogAnalysis() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();

  const analyze = async () => {
    if (!input.trim()) { setError('Please enter a log to analyze.'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await analyzeLog(input.trim());
      setResult({
        parsed_log: data.parsed_log,
        threat_type: String(data.detection_result?.threat_detected || 'Unknown Threat'),
        risk_score: data.risk_assessment?.risk_score || 0,
        summary: typeof data.soc_summary === 'object' ? String(data.soc_summary.executive_summary || '') : String(data.soc_summary || ''),
        full_analysis: typeof data.soc_summary === 'object' ? data.soc_summary : null,
        mitre_technique: String(data.detection_result?.mitre_candidate || ''),
        campaign_id: data.detection_result?.campaign?.campaign_id,
        is_multi_stage: !!data.detection_result?.multi_stage_correlation,
        confidence: data.detection_result?.confidence,
        status: data.incident_id ? 'Incident Created' : 'No Incident',
        source_ip: String(data.parsed_log?.source_ip || ''),
        mitre_tactic: String(data.mitre_details?.tactics?.[0] || 'Unknown'),
        cve_id: String(data.related_cves?.[0]?.id || 'None'),
        on_blocklist: data.blocklist_hit,
        ioc_match: data.ioc_matches?.length > 0,
        risk_factors: Array.isArray(data.risk_assessment?.risk_factors) ? data.risk_assessment.risk_factors.map(String) : [],
        confidence_reasons: [],
        soar_actions: [],
        ip_intelligence: data.ip_intelligence,
        raw_result: data
      });
      setActiveTab('overview');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Analysis failed. Check backend connection.'));
    } finally { setLoading(false); }
  };

  const loadSample = (log) => setInput(log.value);



  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Threat Studio</h1>
          <p className="page-header-sub">Submit any raw log — AI parses, detects, and scores threats in real time</p>
        </div>
      </div>

      <div className="page-body">
        <div className="studio-layout">
          {/* Input Panel */}
          <div className="studio-input-panel">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Log Input</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {SAMPLE_LOGS.map((s, i) => (
                    <button key={i} className="sample-btn" onClick={() => loadSample(s)} title={s.value}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card-body">
                <textarea
                  className="log-textarea"
                  placeholder={`Paste any raw log here and click Analyze.\n\nExamples:\n• Windows Event logs (Event ID 4625, 4624, 4688)\n• Syslog, Cisco ASA, Palo Alto firewall\n• AWS CloudTrail, Azure, GCP\n• IDS/IPS alerts, DNS logs`}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  rows={8}
                  autoFocus
                />

                {error && <div className="auth-error" style={{ marginTop: 8 }}><span>⚠️</span> {error}</div>}

                <div className="studio-actions">
                  <button className="btn-primary btn-large" onClick={analyze} disabled={loading || !input.trim()}>
                    {loading ? <><span className="btn-spinner" />Processing Telemetry…</> : 'Execute AI Analysis'}
                  </button>
                  <button className="btn-outline" onClick={() => navigate('/reports')}>
                    SOC Reports
                  </button>
                  {input && (
                    <button className="btn-ghost" onClick={() => { setInput(''); setResult(null); setError(null); }}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Parsed Fields Preview */}
            {result?.parsed_log && (
              <div className="card" style={{ marginTop: 12 }}>
                <div className="card-header">
                  <span className="card-title">Parsed Fields</span>
                  <span className="rule-chip">{result.parsed_log.log_type || 'unknown'} format</span>
                </div>
                <div className="card-body" style={{ padding: '12px 20px' }}>
                  <div className="parsed-grid">
                    <ParsedField label="Source IP" value={result.parsed_log.source_ip} mono />
                    <ParsedField label="Dest IP" value={result.parsed_log.dest_ip} mono />
                    <ParsedField label="Event ID" value={result.parsed_log.event_id} mono />
                    <ParsedField label="User" value={result.parsed_log.user} />
                    <ParsedField label="Status" value={result.parsed_log.status} />
                    <ParsedField label="Process" value={result.parsed_log.process} mono />
                    <ParsedField label="Port" value={result.parsed_log.port} mono />
                    <ParsedField label="Hostname" value={result.parsed_log.hostname} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results Panel */}
          {result && (
            <div className="studio-results-panel">
              {/* Risk Overview */}
              <div className="card risk-overview-card">
                <div className="risk-overview-left">
                  <RiskGauge score={result.risk_score} />
                </div>
                <div className="risk-overview-right">
                  <div className="risk-threat-type">{result.threat_type || 'Unknown Threat'}</div>
                  <div className="risk-summary">{result.summary || result.analysis_summary}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {result.mitre_technique && (
                      <span className="mitre-tag" title="Click to investigate in MITRE Explorer" style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/mitre?id=${result.mitre_technique}`)}>
                        {result.mitre_technique}
                      </span>
                    )}
                    {result.campaign_id && <span className="rule-chip" style={{ color: 'var(--warning)' }}>Campaign #{result.campaign_id}</span>}
                    {result.is_multi_stage && <span className="rule-chip" style={{ color: 'var(--danger)' }}>Multi-Stage</span>}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="filter-tabs" style={{ marginTop: 12, marginBottom: 12 }}>
                {['overview', 'intel', 'factors', 'soar', 'raw'].map(t => (
                  <button key={t} className={`filter-tab ${activeTab === t ? 'ft-active' : ''}`} onClick={() => setActiveTab(t)}>
                    {{ overview: 'Executive Summary', intel: 'Global Threat Intel', factors: 'Behavioral Heuristics', soar: 'Automated SOAR Actions', raw: 'Telemetry Object' }[t]}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="card">
                    <div className="card-header"><span className="card-title">Threat Details</span></div>
                    <div className="card-body" style={{ padding: '12px 20px' }}>
                      <ParsedField label="Threat Type" value={result.threat_type} />
                      <ParsedField label="Confidence" value={result.confidence ? `${(result.confidence * 100).toFixed(0)}%` : null} />
                      <ParsedField label="Status" value={result.status} />
                      <ParsedField label="Source IP" value={result.source_ip} mono />
                      <ParsedField label="MITRE Tactic" value={result.mitre_tactic} />
                      <ParsedField label="CVE" value={result.cve_id} mono />
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-header"><span className="card-title">Intelligence Checks</span></div>
                    <div className="card-body" style={{ padding: '12px 20px' }}>
                      <div className="intel-check">
                        <span className={`check-dot ${result.on_blocklist ? 'cd-bad' : 'cd-ok'}`} />
                        <span>{result.on_blocklist ? 'IP on BLOCKLIST' : 'IP not on blocklist'}</span>
                      </div>
                      <div className="intel-check">
                        <span className={`check-dot ${result.ioc_match ? 'cd-bad' : 'cd-ok'}`} />
                        <span>{result.ioc_match ? 'IOC match found in threat intel' : 'No IOC match'}</span>
                      </div>
                      <div className="intel-check">
                        <span className={`check-dot ${result.campaign_id ? 'cd-warn' : 'cd-ok'}`} />
                        <span>{result.campaign_id ? `Linked to campaign #${result.campaign_id}` : 'No active campaign'}</span>
                      </div>
                      <div className="intel-check">
                        <span className={`check-dot ${result.is_multi_stage ? 'cd-warn' : 'cd-ok'}`} />
                        <span>{result.is_multi_stage ? 'Multi-stage attack detected' : 'Single-stage event'}</span>
                      </div>
                    </div>
                  </div>

                  {result.full_analysis && (
                    <div className="card" style={{ gridColumn: 'span 2' }}>
                      <div className="card-header"><span className="card-title">AI SOC Analyst Report</span></div>
                      <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, padding: '24px' }}>
                        <div style={{ padding: '16px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: 8, borderLeft: '4px solid var(--accent-primary)' }}>
                          <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: 15 }}>Technical Analysis</h4>
                          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{result.full_analysis.technical_analysis}</p>
                        </div>
                        <div style={{ padding: '16px', background: 'rgba(244, 63, 94, 0.05)', borderRadius: 8, borderLeft: '4px solid var(--danger)' }}>
                          <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: 15 }}>Business Impact</h4>
                          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{result.full_analysis.business_impact}</p>
                        </div>
                        <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: 8, borderLeft: '4px solid var(--warning)' }}>
                          <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: 15 }}>Recommended Actions</h4>
                          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{result.full_analysis.recommended_actions}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'intel' && (
                <div className="card">
                  <div className="card-header"><span className="card-title">IP Geolocation & Reputation</span></div>
                  <div className="card-body" style={{ padding: '20px' }}>
                    {!result.ip_intelligence ? (
                      <div className="empty-state">
                        <span className="empty-title">No IP Intelligence Available</span>
                        <span className="empty-sub">This log may not contain a valid external source IP address.</span>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div style={{ padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)' }}>Geolocation Details</h4>
                            <div className="parsed-grid">
                              <ParsedField label="IP Address" value={result.ip_intelligence.ip} mono />
                              <ParsedField label="Country" value={`${result.ip_intelligence.geo?.country} ${result.ip_intelligence.geo?.flag || ''}`} />
                              <ParsedField label="City" value={result.ip_intelligence.geo?.city} />
                              <ParsedField label="ISP / Org" value={result.ip_intelligence.geo?.isp || result.ip_intelligence.geo?.org} />
                              <ParsedField label="Coordinates" value={`${result.ip_intelligence.geo?.lat}, ${result.ip_intelligence.geo?.lon}`} mono />
                              <ParsedField label="Source" value={result.ip_intelligence.geo?.source} />
                            </div>
                          </div>
                          <div style={{ padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)' }}>VirusTotal Reputation</h4>
                            <div style={{ display: 'flex', gap: 16 }}>
                              <div style={{ textAlign: 'center', padding: '12px 24px', background: 'rgba(244, 63, 94, 0.1)', borderRadius: 8, border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                                <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--danger)' }}>{result.ip_intelligence.reputation?.malicious || 0}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Malicious</div>
                              </div>
                              <div style={{ textAlign: 'center', padding: '12px 24px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--warning)' }}>{result.ip_intelligence.reputation?.suspicious || 0}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Suspicious</div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div style={{ height: 350, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                          {result.ip_intelligence.geo?.lat !== undefined ? (
                            <MapContainer 
                              key={`${result.ip_intelligence.geo.lat}-${result.ip_intelligence.geo.lon}-${result.source_ip}`}
                              center={[result.ip_intelligence.geo.lat, result.ip_intelligence.geo.lon]} 
                              zoom={result.ip_intelligence.geo.lat === 0 ? 2 : 5} 
                              style={{ height: '100%', width: '100%' }}
                            >
                              <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution="&copy; OpenStreetMap contributors"
                              />
                              <Marker position={[result.ip_intelligence.geo.lat, result.ip_intelligence.geo.lon]}>
                                <Popup>
                                  <strong>{result.ip_intelligence.ip}</strong><br />
                                  {result.ip_intelligence.geo.city}, {result.ip_intelligence.geo.country}
                                </Popup>
                              </Marker>
                            </MapContainer>
                          ) : (
                            <div className="empty-state" style={{ height: '100%' }}><span className="empty-title">Map Unavailable</span></div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'factors' && (
                <div className="card">
                  <div className="card-header"><span className="card-title">Risk Factor Breakdown</span></div>
                  <div className="card-body">
                    {result.risk_factors?.length ? (
                      <RiskFactors factors={result.risk_factors} />
                    ) : (
                      <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No detailed risk factor breakdown available.</p>
                    )}
                    {result.confidence_reasons?.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div className="detail-label" style={{ marginBottom: 8 }}>Detection Confidence Reasons</div>
                        {result.confidence_reasons.map((r, i) => (
                          <div key={i} className="intel-check"><span className="check-dot cd-warn" /><span>{r}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'soar' && (
                <div className="card">
                  <div className="card-header"><span className="card-title">Automated SOAR Response</span></div>
                  <div className="card-body">
                    {result.soar_actions?.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {result.soar_actions.map((a, i) => (
                          <div key={i} className="soar-action-item">
                            <span className="soar-action-type rule-chip rule-chip-action">{a.action}</span>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.detail || a.result || 'Executed'}</span>
                            <span className={`soar-action-status ${a.status === 'success' ? 'sas-ok' : 'sas-fail'}`}>{a.status}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state" style={{ padding: 32 }}>
                        <span className="empty-title">No SOAR rules fired</span>
                        <span className="empty-sub">Configure SOAR rules in the SOAR & Automation page.</span>
                        <button className="btn-outline" onClick={() => navigate('/soar')} style={{ marginTop: 12 }}>Go to SOAR →</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'raw' && (
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Raw API Response</span>
                    <button className="mitre-action-btn" onClick={() => navigator.clipboard.writeText(JSON.stringify(result.raw_result || result, null, 2))}>📋 Copy JSON</button>
                  </div>
                  <div className="card-body">
                    <pre className="raw-json">{JSON.stringify(result.raw_result || result, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

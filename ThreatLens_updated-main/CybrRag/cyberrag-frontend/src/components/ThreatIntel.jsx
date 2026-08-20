// src/components/ThreatIntel.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';




const FEED_INFO = {
  CISA: { label: 'CISA KEV', desc: 'Known Exploited Vulnerabilities — actively exploited CVEs per CISA guidance', color: 'var(--danger)', icon: '🐛' },
  FEODO: { label: 'Feodo Tracker', desc: 'Abuse.ch Feodo Tracker — Botnet Command & Control IPs', color: 'var(--warning)', icon: '🎣' },
  URLHAUS: { label: 'URLhaus', desc: 'Abuse.ch URLhaus — malicious URLs used to distribute malware', color: 'var(--info)', icon: '🔗' },
  MANUAL: { label: 'Manual Entry', desc: 'IOCs added manually by analysts', color: 'var(--success)', icon: '✍️' },
};

export default function ThreatIntel() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [iocs, setIocs] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);

  const loadStats = async () => {
    try {
      const res = await api.get('/dashboard/stats');
      setStats(res.data);
    } catch {}
  };
  const loadIocs = async () => {
    try {
      const res = await api.get('/alerts/intel/iocs');
      setIocs(res.data.iocs || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { loadStats(); loadIocs(); }, []);

  const ingest = async () => {
    setIngesting(true);
    try {
      await api.post('/alerts/intel/ingest');
      await loadIocs();
      alert('Threat feeds ingested successfully!');
    } catch { alert('Ingestion failed.'); }
    finally { setIngesting(false); }
  };

  const filtered = iocs.filter(ioc => {
    const matchSearch = !search || ioc.ioc_value?.toLowerCase().includes(search.toLowerCase()) || ioc.threat_name?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'All' || ioc.source === filterType;
    return matchSearch && matchType;
  });

  const bySource = iocs.reduce((acc, ioc) => { acc[ioc.source] = (acc[ioc.source] || 0) + 1; return acc; }, {});

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Threat Intelligence</h1>
          <p className="page-header-sub">Live feeds from CISA KEV, Feodo Tracker, URLhaus — {iocs.length} IOCs loaded</p>
        </div>
        <button className="btn-primary" onClick={ingest} disabled={ingesting}>
          {ingesting ? <><span className="btn-spinner" />Ingesting…</> : '↓ Ingest Latest Feeds'}
        </button>
      </div>

      <div className="page-body">
        <div className="filter-tabs">
          <button className={`filter-tab ${tab === 'overview' ? 'ft-active' : ''}`} onClick={() => setTab('overview')}>📊 Feed Overview</button>
          <button className={`filter-tab ${tab === 'iocs' ? 'ft-active' : ''}`} onClick={() => setTab('iocs')}>🔍 IOC Browser <span className="ft-count">{iocs.length}</span></button>
        </div>

        {tab === 'overview' && (
          <div>
            <div className="feed-cards">
              {Object.entries(FEED_INFO).map(([key, info]) => (
                <div key={key} className="feed-card" style={{ '--feed-color': info.color }}>
                  <div className="feed-card-top">
                    <span className="feed-icon">{info.icon}</span>
                    <span className="feed-count">{bySource[key] || 0}</span>
                  </div>
                  <div className="feed-label">{info.label}</div>
                  <div className="feed-desc">{info.desc}</div>
                  <div className="feed-bar">
                    <div className="feed-bar-fill" style={{ width: `${Math.min(100, ((bySource[key] || 0) / Math.max(1, iocs.length)) * 100)}%`, background: info.color }} />
                  </div>
                </div>
              ))}
            </div>

            {iocs.length === 0 && !loading && (
              <div className="empty-state" style={{ paddingTop: 40 }}>
                <span className="empty-icon">📡</span>
                <span className="empty-title">No IOCs loaded yet</span>
                <span className="empty-sub">Click "Ingest Latest Feeds" to pull from CISA KEV, Feodo Tracker, and URLhaus.</span>
                <button className="btn-primary" onClick={ingest} disabled={ingesting}>↓ Ingest Now</button>
              </div>
            )}

            {iocs.length > 0 && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header">
                  <span className="card-title">Recent IOCs</span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr><th>IOC</th><th>Threat</th><th>Severity</th><th>Source</th></tr>
                  </thead>
                  <tbody>
                    {iocs.slice(0, 10).map((ioc, i) => (
                      <tr key={i}>
                        <td><span className="ip-tag">{ioc.ioc_value}</span></td>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{ioc.threat_name || '—'}</td>
                        <td><span className={`severity-chip ${ioc.severity?.toLowerCase()}`}>{ioc.severity}</span></td>
                        <td>{FEED_INFO[ioc.source] ? <span className="rule-chip" style={{ color: FEED_INFO[ioc.source].color }}>{ioc.source}</span> : <span className="rule-chip">{ioc.source}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'iocs' && (
          <div>
            <div className="ioc-search-bar">
              <input className="ip-search-input" placeholder="Search IOCs by value or threat name…" value={search} onChange={e => setSearch(e.target.value)} />
              <div className="ioc-filters">
                {['All', ...Object.keys(FEED_INFO)].map(f => (
                  <button key={f} className={`filter-btn-sm ${filterType === f ? 'fbsm-active' : ''}`} onClick={() => setFilterType(f)}>{f}</button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="page-loading"><div className="loading-spinner" /><span>Loading IOCs…</span></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state"><span className="empty-title">No IOCs match your filter</span></div>
            ) : (
              <div className="card">
                <table className="data-table">
                  <thead>
                    <tr><th>IOC Value</th><th>Type</th><th>Threat</th><th>Severity</th><th>CVSS</th><th>Source</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map((ioc, i) => (
                      <tr key={i}>
                        <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{ioc.ioc_value}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ioc.ioc_type}</td>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{ioc.threat_name || '—'}</td>
                        <td><span className={`severity-chip ${ioc.severity?.toLowerCase()}`}>{ioc.severity || '—'}</span></td>
                        <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{ioc.cvss_score ?? '—'}</td>
                        <td>{FEED_INFO[ioc.source] ? <span className="rule-chip" style={{ color: FEED_INFO[ioc.source].color }}>{ioc.source}</span> : ioc.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

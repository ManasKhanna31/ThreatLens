// src/components/Campaigns.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';




const STATUS_COLORS = { Active: 'var(--danger)', Dormant: 'var(--warning)', Closed: 'var(--text-muted)' };

function StageChain({ stages }) {
  if (!stages?.length) return <span className="no-stages">No stages yet</span>;
  const unique = [...new Set(stages)];
  return (
    <div className="stage-chain">
      {unique.map((s, i) => (
        <React.Fragment key={i}>
          <span className="stage-pill">{s}</span>
          {i < unique.length - 1 && <span className="stage-arrow">→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function CampaignDetail({ campaign, onClose, onCloseCampaign }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="modal-title">{campaign.name}</span>
            <span className={`severity-chip ${campaign.risk_level?.toLowerCase()}`} style={{ marginLeft: 10 }}>
              {campaign.risk_level}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>✖</button>
        </div>
        <div className="modal-body">
          <div className="detail-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="detail-item"><span className="detail-label">Status</span>
              <span style={{ color: STATUS_COLORS[campaign.status], fontWeight: 700, fontSize: 14 }}>{campaign.status}</span>
            </div>
            <div className="detail-item"><span className="detail-label">Risk Score</span>
              <span className="detail-value">{campaign.risk_score ?? '—'}/100</span>
            </div>
            <div className="detail-item"><span className="detail-label">Duration</span>
              <span className="detail-value">{campaign.duration_hours}h</span>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <span className="detail-label">Attack Progression</span>
            <div style={{ marginTop: 8 }}>
              <StageChain stages={campaign.stages} />
            </div>
          </div>

          {campaign.source_ips?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <span className="detail-label">Source IPs</span>
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {campaign.source_ips.map((ip, i) => (
                  <span key={i} className="ip-tag">{ip}</span>
                ))}
              </div>
            </div>
          )}

          {campaign.mitre_techniques?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <span className="detail-label">MITRE Techniques</span>
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {campaign.mitre_techniques.map((t, i) => (
                  <span key={i} className="mitre-tag">{t}</span>
                ))}
              </div>
            </div>
          )}

          {campaign.status !== 'Closed' && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
              <button
                className="btn-outline"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger-dim)' }}
                onClick={() => onCloseCampaign(campaign.id)}
              >
                Close Campaign
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(null);

  const load = async () => {
    try {
      const res = await api.get('/dashboard/campaigns');
      setCampaigns(res.data.campaigns || []);
    } catch { setError('Failed to load campaigns.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleClose = async (id) => {
    try {
      await api.put(`/dashboard/campaigns/${id}/close`);
      setSelected(null);
      load();
    } catch { alert('Failed to close campaign.'); }
  };

  const triggerCorrelation = async () => {
    try {
      const res = await api.post('/dashboard/correlate');
      alert(`Correlation sweep done. ${res.data.total} findings.`);
      load();
    } catch { alert('Correlation sweep failed.'); }
  };

  const filtered = filter === 'All' ? campaigns : campaigns.filter(c => c.status === filter);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Campaign Manager</h1>
          <p className="page-header-sub">Multi-stage attack campaigns tracked across days and weeks</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline" onClick={triggerCorrelation} title="Run the background correlation engine manually">
            ⟲ Run Correlation
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Filter tabs */}
        <div className="filter-tabs">
          {['All', 'Active', 'Dormant', 'Closed'].map(f => (
            <button key={f} className={`filter-tab ${filter === f ? 'ft-active' : ''}`} onClick={() => setFilter(f)}>
              {f}
              <span className="ft-count">
                {f === 'All' ? campaigns.length : campaigns.filter(c => c.status === f).length}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="page-loading"><div className="loading-spinner" /><span>Loading campaigns…</span></div>
        ) : error ? (
          <div className="empty-state"><span className="empty-icon">⚠️</span><span className="empty-title">{error}</span></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: 60 }}>
            <span className="empty-icon">ðŸ•¸</span>
            <span className="empty-title">No {filter !== 'All' ? filter.toLowerCase() : ''} campaigns yet</span>
            <span className="empty-sub">Campaign tracking activates automatically when multi-stage attacks are detected. Run the correlation engine to check.</span>
            <button className="btn-primary" onClick={triggerCorrelation}>⟲ Run Correlation Now</button>
          </div>
        ) : (
          <div className="campaigns-list">
            {filtered.map(c => (
              <div key={c.id} className="campaign-row" onClick={() => setSelected(c)}>
                <div className="campaign-row-left">
                  <div className="campaign-status-dot" style={{ background: STATUS_COLORS[c.status] }} title={c.status} />
                  <div>
                    <div className="campaign-name">{c.name}</div>
                    <div className="campaign-meta">
                      {c.source_ips?.slice(0, 2).join(', ')}{c.source_ips?.length > 2 ? ` +${c.source_ips.length - 2}` : ''}
                    </div>
                  </div>
                </div>
                <div className="campaign-row-center">
                  <StageChain stages={c.stages} />
                </div>
                <div className="campaign-row-right">
                  <span className={`severity-chip ${c.risk_level?.toLowerCase()}`}>{c.risk_level}</span>
                  <span className="campaign-duration">{c.duration_hours}h</span>
                  <span className="campaign-status-label" style={{ color: STATUS_COLORS[c.status] }}>{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <CampaignDetail
          campaign={selected}
          onClose={() => setSelected(null)}
          onCloseCampaign={handleClose}
        />
      )}
    </div>
  );
}

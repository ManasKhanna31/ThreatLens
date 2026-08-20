import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getApiErrorMessage } from '../services/api';
import InfoHint from './soc/InfoHint';




function formatRelativeTime(value) {
  if (!value) return 'Not yet observed';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Unavailable';
  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function MetricTile({ label, value, note, tone = 'default' }) {
  return (
    <div className={`asset-metric-tile asset-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

function AssetCard({ asset, active, onSelect, onCheck, onSimulate, busy }) {
  const profile = asset.profile || {};

  return (
    <button type="button" className={`asset-card ${active ? 'asset-card-active' : ''}`} onClick={() => onSelect(asset)}>
      <div className="asset-card-top">
        <div className="asset-card-topline">
          <span className="asset-type-chip">{asset.asset_type_label}</span>
          <span className={`asset-health asset-health-${(asset.health_status || 'unknown').toLowerCase().replace(/\s+/g, '-')}`}>
            {asset.health_status || 'Unknown'}
          </span>
        </div>
        <span className="asset-card-age">{formatRelativeTime(asset.last_signal_at || asset.last_checked_at)}</span>
      </div>

      <div className="asset-card-body">
        <strong>{asset.name}</strong>
        <p>{asset.target}</p>
        <div className="asset-card-meta">
          <span>{asset.environment}</span>
          <span>{asset.priority} priority</span>
          <span>{asset.monitoring_mode}</span>
        </div>
      </div>

      <div className="asset-card-grid">
        <div><span>Risk</span><b>{asset.risk_score || 0}</b></div>
        <div><span>Open cases</span><b>{asset.open_incidents || 0}</b></div>
        <div><span>Signals</span><b>{asset.incident_count || 0}</b></div>
      </div>

      <div className="asset-coverage-line">
        <span>Coverage focus</span>
        <strong>{(profile.focus || []).slice(0, 2).join(' / ') || 'Signal source'}</strong>
      </div>

      <div className="asset-card-actions" onClick={(event) => event.stopPropagation()}>
        <button className="btn-outline" disabled={busy} onClick={() => onCheck(asset)}>Check</button>
        <button className="btn-primary" disabled={busy} onClick={() => onSimulate(asset)}>Generate Signals</button>
      </div>
    </button>
  );
}

function DetailStat({ label, value, note }) {
  return (
    <div className="asset-detail-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

export default function Assets() {
  const navigate = useNavigate();
  const [types, setTypes] = useState([]);
  const [assets, setAssets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    asset_type: 'website',
    target: '',
    name: '',
    environment: 'Demo',
    owner: 'SOC Analyst',
    priority: 'High',
    monitoring_mode: 'Simulation',
  });

  const selectedType = useMemo(
    () => types.find((item) => item.id === form.asset_type) || types[0] || {},
    [form.asset_type, types]
  );

  const loadTypes = async () => {
    const response = await api.get('/assets/types');
    setTypes(response.data.types || []);
  };

  const loadAssets = async (selectId) => {
    setLoading(true);
    try {
      const response = await api.get('/assets');
      const rows = response.data.assets || [];
      setAssets(rows);
      const next = rows.find((item) => item.id === selectId) || rows[0] || null;
      setSelected(next);
      setError(null);

      if (next) {
        const detailResponse = await api.get(`/assets/${next.id}`);
        setDetail(detailResponse.data);
      } else {
        setDetail(null);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load monitored assets.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await loadTypes();
        await loadAssets();
      } catch (err) {
        setError(getApiErrorMessage(err, 'Failed to initialize monitored assets.'));
        setLoading(false);
      }
    };
    init();
  }, []);

  const refreshSelected = async (assetId) => {
    await loadAssets(assetId);
  };

  const selectAsset = async (asset) => {
    setSelected(asset);
    try {
      const response = await api.get(`/assets/${asset.id}`);
      setDetail(response.data);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load asset detail.'));
    }
  };

  const createAsset = async (event) => {
    event.preventDefault();
    if (!form.target.trim()) {
      setError('Enter a monitored website, repository, API, cloud account, server, or SaaS target to monitor.');
      return;
    }
    setBusy(true);
    try {
      const response = await api.post('/assets', form);
      await refreshSelected(response.data.asset?.id);
      setForm((current) => ({ ...current, target: '', name: '' }));
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to onboard asset.'));
    } finally {
      setBusy(false);
    }
  };

  const checkAsset = async (asset) => {
    setBusy(true);
    try {
      await api.post(`/assets/${asset.id}/check`);
      await refreshSelected(asset.id);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Asset check failed.'));
    } finally {
      setBusy(false);
    }
  };

  const simulateAsset = async (asset) => {
    setBusy(true);
    try {
      await api.post(`/assets/${asset.id}/simulate?count=3`);
      await refreshSelected(asset.id);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to generate SOC signals.'));
    } finally {
      setBusy(false);
    }
  };

  const assetSummary = useMemo(() => ({
    total: assets.length,
    open: assets.reduce((sum, item) => sum + (item.open_incidents || 0), 0),
    highRisk: assets.filter((item) => (item.risk_score || 0) >= 70).length,
    active: assets.filter((item) => item.status === 'Active').length,
  }), [assets]);

  const detailData = detail?.detail || {};
  const incidents = detail?.incidents || [];
  const profile = detailData.profile || selectedType?.profile || {};
  const lastCheck = detailData.last_check || {};
  const lastSimulation = detailData.last_simulation || {};
  const breakdown = detailData.incident_breakdown || {};

  return (
    <div>
      <div className="page-header">
        <div className="asset-header">
          <div>
            <div className="soc-header-kicker">SOC Co-Analyst Inputs</div>
            <h1 className="page-header-title">Monitored Assets</h1>
            <p className="page-header-sub">Bring websites, repositories, APIs, cloud platforms, servers, and SaaS into one investigation workflow.</p>
          </div>
          <div className="asset-header-actions">
            <button className="btn-outline" onClick={() => navigate('/dashboard')}>Dashboard</button>
            <button className="btn-primary" onClick={() => navigate('/investigate')}>Case Center</button>
          </div>
        </div>
      </div>

      <div className="page-body asset-workspace">
        {error && <div className="auth-error">{error}</div>}

        <section className="asset-command-band">
          <div className="asset-command-copy">
            <span className="asset-command-kicker">Asset-centric signal intake</span>
            <h2>Turn monitored assets into investigation-ready security cases</h2>
            <p>{profile.headline || 'Monitor critical business assets and convert suspicious activity into SOC cases with context, risk, and response guidance.'}</p>
          </div>
          <div className="asset-command-metrics">
            <MetricTile label="Assets" value={assetSummary.total} note="monitored sources" />
            <MetricTile label="Open cases" value={assetSummary.open} note="linked investigations" />
            <MetricTile label="High risk" value={assetSummary.highRisk} note="risk score 70+" />
            <MetricTile label="Active" value={assetSummary.active} note="currently enabled" />
          </div>
        </section>

        <div className="assets-main-grid">
          <section className="asset-onboarding">
            <div className="assets-section-title">
              <div>
                <h2>Onboard an asset</h2>
                <p className="asset-section-copy">Add the digital surface you want the SOC co-analyst to watch and use for safe signal generation.</p>
              </div>
              <InfoHint text="Assets are signal sources for the SOC workflow. The product value remains triage, investigation, response guidance, and reporting." />
            </div>

            <form className="asset-form" onSubmit={createAsset}>
              <div className="asset-type-grid">
                {types.map((type) => (
                  <button
                    type="button"
                    key={type.id}
                    className={`asset-type-option ${form.asset_type === type.id ? 'asset-type-active' : ''}`}
                    onClick={() => setForm({ ...form, asset_type: type.id })}
                  >
                    <strong>{type.label}</strong>
                    <span>{type.profile?.focus?.join(' • ') || 'Signal source'}</span>
                  </button>
                ))}
              </div>

              <div className="asset-form-grid">
                <input className="field-input" placeholder={selectedType?.label === 'GitHub Repository' ? 'https://github.com/org/repo' : 'Asset target'} value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
                <input className="field-input" placeholder="Display name (optional)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <select className="field-input" value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}>
                  {['Demo', 'Production', 'Staging', 'Development'].map((value) => <option key={value}>{value}</option>)}
                </select>
                <select className="field-input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {['Critical', 'High', 'Medium', 'Low'].map((value) => <option key={value}>{value}</option>)}
                </select>
                <input className="field-input" placeholder="Owner" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
                <button className="btn-primary" disabled={busy}>{busy ? 'Working...' : 'Add Asset'}</button>
              </div>
            </form>

            <div className="asset-onboarding-footer" style={{ marginTop: '24px' }}>
              <div className="asset-guidance-card">
                <span>Safe checks</span>
                <strong>{(selectedType?.profile?.checks || []).join(' • ') || 'Basic posture review'}</strong>
              </div>
              <div className="asset-guidance-card">
                <span>Signal catalog</span>
                <strong>{(selectedType?.profile?.focus || []).join(' • ') || 'Controlled security signals'}</strong>
              </div>
            </div>
          </section>

          <section className="assets-grid-section">
            <div className="assets-section-title">
              <div>
                <h2>Asset queue</h2>
                <p className="asset-section-copy">Choose the asset you want to demo, monitor, or use to generate new analyst cases.</p>
              </div>
              <span>{assets.length} monitored</span>
            </div>

            {loading ? (
              <div className="page-loading"><div className="loading-spinner" /><span>Loading assets</span></div>
            ) : assets.length ? (
              <div className="asset-card-list">
                {assets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    active={selected?.id === asset.id}
                    onSelect={selectAsset}
                    onCheck={checkAsset}
                    onSimulate={simulateAsset}
                    busy={busy}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-title">No monitored assets yet</span>
                <span className="empty-sub">Add a website, GitHub repository, or API target to make this workflow feel like a real SOC product.</span>
              </div>
            )}
          </section>

          <aside className="asset-detail-panel">
            <div className="assets-section-title">
              <div>
                <h2>Asset workspace</h2>
                <p className="asset-section-copy">Posture, recent signals, and case outcomes for the selected asset.</p>
              </div>
              <InfoHint text="This is where the monitored asset becomes a SOC input surface. Safe checks and simulated signals both feed the same case workflow." />
            </div>

            {selected ? (
              <>
                <div className="asset-detail-hero">
                  <div className="asset-detail-kicker-row">
                    <span>{selected.asset_type_label}</span>
                    <span className={`asset-health asset-health-${(selected.health_status || 'unknown').toLowerCase().replace(/\s+/g, '-')}`}>
                      {selected.health_status || 'Unknown'}
                    </span>
                  </div>
                  <strong>{selected.name}</strong>
                  <p>{selected.target}</p>
                  <div className="asset-hero-actions">
                    <button className="btn-outline" disabled={busy} onClick={() => checkAsset(selected)}>Run Safe Check</button>
                    <button className="btn-primary" disabled={busy} onClick={() => simulateAsset(selected)}>Generate SOC Signals</button>
                  </div>
                </div>

                <div className="asset-context-grid">
                  <MetricTile label="Open cases" value={selected.open_incidents || 0} />
                  <MetricTile label="Total cases" value={selected.incident_count || 0} />
                  <MetricTile label="Risk" value={selected.risk_score || 0} />
                  <MetricTile label="Mode" value={selected.monitoring_mode} />
                </div>

                <div className="asset-context-block">
                  <div className="detail-label">Posture summary</div>
                  <div className="asset-summary-grid">
                    <div><span>Environment</span><strong>{selected.environment}</strong></div>
                    <div><span>Owner</span><strong>{selected.owner}</strong></div>
                    <div><span>Priority</span><strong>{selected.priority}</strong></div>
                    <div><span>Last checked</span><strong>{selected.last_checked_at ? new Date(selected.last_checked_at).toLocaleString() : 'Not yet run'}</strong></div>
                  </div>
                </div>

                <div className="asset-context-block">
                  <div className="detail-label">Last safe check</div>
                  {lastCheck.checked_at ? (
                    <div className="asset-observation-stack">
                      <div className="asset-observation-card">
                        <strong>{selected.asset_type === 'website' ? `HTTP ${lastCheck.http_status || 'n/a'} • ${lastCheck.latency_ms || 'n/a'} ms` : 'Simulation-backed posture review'}</strong>
                        <span>{lastCheck.tls_observed ? 'TLS observed' : 'No TLS signal recorded'}</span>
                      </div>
                      {(lastCheck.observations || []).length ? (lastCheck.observations || []).map((item, index) => (
                        <div key={index} className="asset-observation-line">{item}</div>
                      )) : (
                        <div className="asset-empty-note">No notable posture observations were recorded in the last check.</div>
                      )}
                    </div>
                  ) : (
                    <div className="asset-empty-note">Run a safe check to populate health and posture observations.</div>
                  )}
                </div>

                <div className="asset-context-block">
                  <div className="detail-label">Signal catalog</div>
                  <div className="asset-signal-list">
                    {(detailData.signal_catalog || []).map((signal, index) => (
                      <div key={`${signal.threat}-${index}`} className="asset-signal-row">
                        <span className={`severity-chip ${signal.risk.toLowerCase()}`}>{signal.risk}</span>
                        <strong>{signal.threat}</strong>
                        <em>{signal.mitre} • {signal.stage}</em>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="asset-context-block">
                  <div className="detail-label">Case outcomes</div>
                  <div className="asset-summary-grid">
                    <div><span>Open</span><strong>{breakdown.open || 0}</strong></div>
                    <div><span>Investigating</span><strong>{breakdown.investigating || 0}</strong></div>
                    <div><span>Critical</span><strong>{breakdown.critical || 0}</strong></div>
                    <div><span>High</span><strong>{breakdown.high || 0}</strong></div>
                  </div>
                </div>

                <div className="asset-context-block">
                  <div className="detail-label">Recent asset-linked cases</div>
                  <div className="asset-case-list">
                    {incidents.length ? incidents.map((incident) => (
                      <button key={incident.id} className="asset-case-row" onClick={() => navigate(`/incidents/${incident.id}`)}>
                        <span className={`severity-chip ${(incident.risk_level || 'LOW').toLowerCase()}`}>{incident.risk_level}</span>
                        <strong>{incident.threat_type}</strong>
                        <em>{incident.status} • {incident.workflow_state}</em>
                      </button>
                    )) : (
                      <div className="asset-empty-note">Generate SOC signals to create asset-linked investigations.</div>
                    )}
                  </div>
                </div>

                <div className="asset-context-block">
                  <div className="detail-label">Demo guidance</div>
                  <div className="asset-recommendation-list">
                    {(detailData.recommendations || []).map((item, index) => (
                      <div key={index} className="asset-recommendation-row">
                        <span>{index + 1}</span>
                        <p>{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="asset-context-block">
                  <div className="detail-label">Latest simulation</div>
                  {lastSimulation.ran_at ? (
                    <div className="asset-observation-stack">
                      <div className="asset-observation-card">
                        <strong>{new Date(lastSimulation.ran_at).toLocaleString()}</strong>
                        <span>{(lastSimulation.signals || []).length} signals generated</span>
                      </div>
                      {(lastSimulation.signals || []).map((signal, index) => (
                        <div key={index} className="asset-observation-line">{signal}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="asset-empty-note">No simulation has been run for this asset yet.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <span className="empty-title">Select an asset</span>
                <span className="empty-sub">Asset posture, signals, and case outcomes will appear here.</span>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

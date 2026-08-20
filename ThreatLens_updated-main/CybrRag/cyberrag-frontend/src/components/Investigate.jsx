import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { getApiErrorMessage } from '../services/api';
import InfoHint from './soc/InfoHint';




function useQuery() {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search), [location.search]);
}

export default function Investigate() {
  const query = useQuery();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    savedView: '',
    search: '',
    risk_level: '',
    source: '',
    status: '',
    workflow_state: '',
    hours: '72',
  });
  const [ipInput, setIpInput] = useState(query.get('ip') || '');
  const [ipDossier, setIpDossier] = useState(null);
  const [ipTimeline, setIpTimeline] = useState(null);

  const fetchIncidents = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      params.set('limit', '80');
      const [incRes, viewRes] = await Promise.all([
        api.get(`/dashboard/incidents?${params.toString()}`),
        api.get('/dashboard/incidents/views'),
      ]);
      setIncidents(incRes.data.incidents || []);
      setViews(viewRes.data.views || []);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load case center data.'));
    } finally {
      setLoading(false);
    }
  };

  const fetchIpContext = async (ip) => {
    if (!ip) {
      setIpDossier(null);
      setIpTimeline(null);
      return;
    }
    try {
      const [dossierRes, timelineRes] = await Promise.all([
        api.get(`/dashboard/investigate/${ip}`),
        api.get(`/dashboard/timeline/${ip}`),
      ]);
      setIpDossier(dossierRes.data);
      setIpTimeline(timelineRes.data);
    } catch (err) {
      setIpDossier(null);
      setIpTimeline(null);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  useEffect(() => {
    const ip = query.get('ip');
    if (ip) {
      setIpInput(ip);
      fetchIpContext(ip);
    }
  }, [query]);

  const applyFilters = () => {
    fetchIncidents(filters);
  };

  return (
    <div>
      <div className="page-header">
        <div className="investigate-header">
          <div>
            <div className="soc-header-kicker">Incident Operations</div>
            <h1 className="page-header-title">Case Center</h1>
            <p className="page-header-sub">Saved views, analyst filters, case routing, and quick IP context in one workspace.</p>
          </div>
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>Back to Command Center</button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

        <section className="card case-filter-card">
          <div className="card-header">
            <span className="card-title">Saved Views and Filters <InfoHint text="These controls make the prototype feel like a real analyst queue. Saved views are prebuilt operator slices like SLA watch, high-priority queue, and real telemetry only." /></span>
          </div>
          <div className="card-body">
            <div className="saved-view-row">
              {views.map((view) => (
                <button
                  key={view.id}
                  className={`saved-view-chip ${filters.savedView === view.id ? 'saved-view-active' : ''}`}
                  onClick={() => {
                    const next = { ...filters, savedView: view.id };
                    setFilters(next);
                    fetchIncidents(next);
                  }}
                >
                  <strong>{view.label}</strong>
                  <span>{view.description}</span>
                </button>
              ))}
            </div>

            <div className="case-filter-grid">
              <input className="field-input" placeholder="Search by threat, IP, owner" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value, savedView: '' })} />
              <select className="field-input" value={filters.risk_level} onChange={(e) => setFilters({ ...filters, risk_level: e.target.value, savedView: '' })}>
                <option value="">All Severities</option>
                {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((value) => <option key={value}>{value}</option>)}
              </select>
              <select className="field-input" value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value, savedView: '' })}>
                <option value="">All Sources</option>
                <option value="real_windows_event_log">Windows Event Log</option>
                <option value="manual_analysis">Manual Analysis</option>
                <option value="bulk_ingest">Bulk Ingest</option>
                <option value="webhook">Webhook</option>
                <option value="demo_seed">Demo Seed</option>
              </select>
              <select className="field-input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, savedView: '' })}>
                <option value="">All Statuses</option>
                {['Open', 'Investigating', 'Resolved', 'False Positive', 'Closed'].map((value) => <option key={value}>{value}</option>)}
              </select>
              <select className="field-input" value={filters.workflow_state} onChange={(e) => setFilters({ ...filters, workflow_state: e.target.value, savedView: '' })}>
                <option value="">All Workflow States</option>
                {['New', 'Triage', 'Investigate', 'Contain', 'Resolve'].map((value) => <option key={value}>{value}</option>)}
              </select>
              <select className="field-input" value={filters.hours} onChange={(e) => setFilters({ ...filters, hours: e.target.value, savedView: '' })}>
                <option value="24">Last 24 hours</option>
                <option value="72">Last 72 hours</option>
                <option value="168">Last 7 days</option>
                <option value="720">Last 30 days</option>
              </select>
              <button className="btn-primary" onClick={applyFilters}>Apply Filters</button>
            </div>
          </div>
        </section>

        <div className="case-center-grid">
          <section className="card">
            <div className="card-header">
              <span className="card-title">Analyst Queue <InfoHint text="Cases here are grouped incidents, not one row per alert. Repeated detections are rolled into the same case so the queue behaves more like a real SOC product." /></span>
            </div>
            <div className="card-body case-list-body">
              {loading ? (
                <div className="page-loading"><div className="loading-spinner" /><span>Loading cases</span></div>
              ) : incidents.length ? incidents.map((incident) => (
                <button key={incident.id} className="case-list-item" onClick={() => navigate(`/incidents/${incident.id}`)}>
                  <div className="case-list-top">
                    <span className={`severity-chip ${(incident.risk_level || 'LOW').toLowerCase()}`}>{incident.risk_level}</span>
                    <span className="case-list-status">{incident.workflow_state} · {incident.status}</span>
                  </div>
                  <strong>{incident.threat_type}</strong>
                  <div className="case-list-meta">
                    <span>{incident.source_ip || 'No source IP'}</span>
                    <span>{incident.source || 'other'}</span>
                    <span>{incident.alert_count} grouped alerts</span>
                  </div>
                </button>
              )) : (
                <div className="empty-state" style={{ padding: '32px 20px' }}>
                  <span className="empty-title">No cases match the current view</span>
                  <span className="empty-sub">Try a different saved view or loosen the time range and severity filters.</span>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <span className="card-title">Quick IP Context <InfoHint text="This side panel gives a fast operator pivot into IP history without leaving the case center. It uses the existing investigation and timeline endpoints." /></span>
            </div>
            <div className="card-body ip-context-body">
              <div className="ip-context-search">
                <input className="field-input" placeholder="Enter source IP" value={ipInput} onChange={(e) => setIpInput(e.target.value)} />
                <button className="btn-outline" onClick={() => {
                  navigate(`/investigate?ip=${ipInput}`, { replace: true });
                  fetchIpContext(ipInput);
                }}>Load IP</button>
              </div>

              {ipDossier ? (
                <>
                  <div className="ip-context-stats">
                    <div><span>Failed logins</span><strong>{ipDossier.state?.failed_logins || 0}</strong></div>
                    <div><span>Incidents</span><strong>{ipDossier.incident_count || 0}</strong></div>
                    <div><span>Campaigns</span><strong>{ipDossier.campaigns?.length || 0}</strong></div>
                  </div>
                  <div className="ip-context-summary">
                    <div className="detail-label">Recent Attack Stages</div>
                    <div className="ip-stage-row">
                      {(ipDossier.state?.attack_stages || []).length ? ipDossier.state.attack_stages.map((stage, index) => (
                        <span key={index} className="stage-pill">{stage}</span>
                      )) : <span className="empty-sub">No tracked stages for this IP.</span>}
                    </div>
                  </div>
                  <div className="ip-context-summary">
                    <div className="detail-label">Timeline Preview</div>
                    <div className="ip-timeline-preview">
                      {(ipTimeline?.timeline || []).slice(-5).reverse().map((event, index) => (
                        <div key={index} className="ip-preview-item">
                          <strong>{event.type === 'incident' ? event.threat_type : event.event_id || 'Log Event'}</strong>
                          <span>{event.timestamp ? new Date(event.timestamp).toLocaleString() : 'Unknown time'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state" style={{ padding: '30px 16px' }}>
                  <span className="empty-title">Load an IP to inspect</span>
                  <span className="empty-sub">Use a source IP from the case queue to preview the linked timeline and campaign context.</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

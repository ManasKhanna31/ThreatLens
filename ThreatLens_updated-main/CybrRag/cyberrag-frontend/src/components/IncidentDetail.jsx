import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { getApiErrorMessage } from '../services/api';
import InfoHint from './soc/InfoHint';




export default function IncidentDetail() {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ status: '', workflow_state: '', owner: '', analyst_notes: '' });

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/dashboard/incidents/${incidentId}/detail`);
      setDetail(response.data);
      setForm({
        status: response.data.status || 'Open',
        workflow_state: response.data.workflow_state || 'New',
        owner: response.data.owner || 'Unassigned',
        analyst_notes: response.data.analyst_notes || '',
      });
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load incident details.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [incidentId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/dashboard/incidents/${incidentId}`, form);
      await fetchDetail();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update the case.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-spinner" />
        <span>Loading incident detail</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-body">
        <div className="auth-error">{error}</div>
      </div>
    );
  }

  if (!detail || detail.error) {
    return (
      <div className="page-body">
        <div className="empty-state">
          <span className="empty-title">Incident not found</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="incident-detail-header">
          <div>
            <div className="soc-header-kicker">Case Detail</div>
            <h1 className="page-header-title">{detail.threat_type}</h1>
            <p className="page-header-sub">
              Incident #{detail.id} · {detail.source || 'other'} · last seen {detail.last_seen ? new Date(detail.last_seen).toLocaleString() : 'unknown'}
            </p>
          </div>
          <div className="incident-header-actions">
            <button className="btn-outline" onClick={() => navigate('/investigate')}>Back to Case Center</button>
            {detail.source_ip && (
              <button className="btn-primary" onClick={() => navigate(`/investigate?ip=${detail.source_ip}`)}>Open IP Context</button>
            )}
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="incident-detail-grid">
          <section className="card incident-hero-card">
            <div className="card-header">
              <span className="card-title">Case Overview <InfoHint text="This is the operator summary of why this case exists, how risky it is, and whether the SLA timer is healthy." /></span>
            </div>
            <div className="card-body">
              <div className="incident-hero-top">
                <span className={`severity-chip ${(detail.risk_level || 'LOW').toLowerCase()}`}>{detail.risk_level}</span>
                <div className={`incident-sla-pill ${detail.sla_breached ? 'incident-sla-breached' : ''}`}>
                  SLA {detail.sla_breached ? 'breached' : `${detail.sla_remaining_minutes ?? 0} min left`}
                </div>
              </div>
              <div className="incident-hero-metrics">
                <div><span>Workflow</span><strong>{detail.workflow_state}</strong></div>
                <div><span>Status</span><strong>{detail.status}</strong></div>
                <div><span>Owner</span><strong>{detail.owner}</strong></div>
                <div><span>Grouped alerts</span><strong>{detail.alert_count}</strong></div>
              </div>
              <div className="incident-summary-block">
                <div className="detail-label">Why this case exists <InfoHint text="The backend keeps the detection reason, confidence, IOC matches, ATT&CK mapping, and risk factors so this card explains the case instead of just listing a score." /></div>
                <p>{detail.soc_summary?.llm_summary || detail.soc_summary?.summary || detail.soc_summary?.threat || 'No summary available yet.'}</p>
              </div>
              <div className="incident-factors">
                {(detail.explanation?.risk_factors || []).map((factor, index) => (
                  <span key={index} className="incident-factor-chip">{factor}</span>
                ))}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <span className="card-title">Analyst Controls <InfoHint text="Use this panel to move the case through the SOC workflow, assign ownership, and keep analyst notes on the incident itself." /></span>
            </div>
            <div className="card-body incident-form-grid">
              <label>
                <span className="field-label">Status</span>
                <select className="field-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {['Open', 'Investigating', 'Resolved', 'False Positive', 'Closed'].map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label>
                <span className="field-label">Workflow</span>
                <select className="field-input" value={form.workflow_state} onChange={(e) => setForm({ ...form, workflow_state: e.target.value })}>
                  {['New', 'Triage', 'Investigate', 'Contain', 'Resolve'].map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label>
                <span className="field-label">Owner</span>
                <input className="field-input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
              </label>
              <label className="incident-notes-field">
                <span className="field-label">Analyst Notes</span>
                <textarea className="field-input incident-notes-input" rows="7" value={form.analyst_notes} onChange={(e) => setForm({ ...form, analyst_notes: e.target.value })} />
              </label>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Analyst Update'}
              </button>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <span className="card-title">Recommended Actions <InfoHint text="These actions are generated from the threat type, risk, and source context to make the prototype feel like an analyst assistant instead of a raw log viewer." /></span>
            </div>
            <div className="card-body">
              <div className="incident-action-list">
                {(detail.recommended_actions || []).map((action, index) => (
                  <div key={index} className="incident-action-item">{action}</div>
                ))}
              </div>
            </div>
          </section>

          <section className="card incident-span-two">
            <div className="card-header">
              <span className="card-title">Evidence Timeline <InfoHint text="Grouped alerts are stored as evidence entries on the same case. This timeline shows when the case fired, what was parsed, the mapped ATT&CK technique, and the confidence at each step." /></span>
            </div>
            <div className="card-body incident-evidence-list">
              {(detail.evidence || []).length ? detail.evidence.map((item, index) => (
                <div key={index} className="incident-evidence-item">
                  <div className="incident-evidence-head">
                    <strong>{item.threat || 'Detection event'}</strong>
                    <span>{item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Unknown time'}</span>
                  </div>
                  <div className="incident-evidence-meta">
                    <span>Confidence {Math.round((item.confidence || 0) * 100)}%</span>
                    <span>{item.mitre || 'No ATT&CK mapping'}</span>
                    <span>{item.risk_level} / {item.risk_score}</span>
                  </div>
                  <p>{item.raw_excerpt || 'No raw excerpt captured.'}</p>
                </div>
              )) : (
                <div className="empty-state" style={{ padding: '24px 20px' }}>
                  <span className="empty-title">No evidence entries yet</span>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <span className="card-title">Status History</span>
            </div>
            <div className="card-body incident-history-list">
              {(detail.status_history || []).map((item, index) => (
                <div key={index} className="incident-history-item">
                  <strong>{item.workflow_state || detail.workflow_state}</strong>
                  <span>{item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Unknown time'}</span>
                  <p>{item.note || 'Case state changed.'}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <span className="card-title">Related Incidents</span>
            </div>
            <div className="card-body incident-related-list">
              {(detail.related_incidents || []).length ? detail.related_incidents.map((item) => (
                <button key={item.id} className="incident-related-item" onClick={() => navigate(`/incidents/${item.id}`)}>
                  <div>
                    <strong>{item.threat_type}</strong>
                    <span>{item.last_seen ? new Date(item.last_seen).toLocaleString() : 'Unknown time'}</span>
                  </div>
                  <em>{item.alert_count} alerts</em>
                </button>
              )) : (
                <div className="empty-state" style={{ padding: '16px 8px' }}>
                  <span className="empty-sub">No grouped sister cases found.</span>
                </div>
              )}
            </div>
          </section>

          <section className="card incident-span-two">
            <div className="card-header">
              <span className="card-title">Related Logs <InfoHint text="This panel shows nearby logs for the same source IP so an analyst can pivot from the case into raw telemetry without leaving the investigation workspace." /></span>
            </div>
            <div className="card-body incident-log-list">
              {(detail.related_logs || []).map((log) => (
                <div key={log.id} className="incident-log-item">
                  <div className="incident-log-head">
                    <strong>{log.log_type || 'log event'}</strong>
                    <span>{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Unknown time'}</span>
                  </div>
                  <p>{log.raw_log}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

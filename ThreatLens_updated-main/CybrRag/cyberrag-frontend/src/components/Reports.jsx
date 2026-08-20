import React, { useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../services/api';
import InfoHint from './soc/InfoHint';




function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function Metric({ label, value }) {
  return (
    <div className="report-metric">
      <span>{label}</span>
      <strong>{value || 'Not available'}</strong>
    </div>
  );
}

export default function Reports() {
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState('');
  const [hours, setHours] = useState('168');
  const [riskLevel, setRiskLevel] = useState('');
  const [status, setStatus] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const loadIncidentChoices = async () => {
    setLoading(true);
    try {
      const response = await api.get('/dashboard/incidents?limit=100');
      const rows = response.data.incidents || [];
      setIncidents(rows);
      if (rows.length && !selectedIncident) {
        setSelectedIncident(String(rows[0].id));
      }
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load incidents for reporting.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidentChoices();
  }, []);

  const generateIncidentReport = async () => {
    if (!selectedIncident) return;
    setGenerating(true);
    try {
      const response = await api.get(`/reports/incident/${selectedIncident}`);
      setReport(response.data);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to generate incident report.'));
    } finally {
      setGenerating(false);
    }
  };

  const generateOperationsReport = async () => {
    setGenerating(true);
    try {
      const params = new URLSearchParams({ hours });
      if (riskLevel) params.set('risk_level', riskLevel);
      if (status) params.set('status', status);
      const response = await api.get(`/reports/operations?${params.toString()}`);
      setReport(response.data);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to generate operations report.'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="soc-header-kicker">Executive Reporting</div>
          <h1 className="page-header-title">SOC Reports</h1>
          <p className="page-header-sub">Generate human-readable SOC reports directly from live ThreatLens cases, evidence, and operational context.</p>
        </div>
      </div>

      <div className="page-body reports-layout">
        <section className="card">
          <div className="card-header">
            <span className="card-title">Generate Report <InfoHint text="Use Incident Report for a full analyst-style case narrative, or Operations Report for a queue-level SOC summary with severity, provenance, and priorities." /></span>
          </div>
          <div className="card-body reports-builder">
            {error && <div className="auth-error">{error}</div>}

            <div className="reports-builder-block">
              <div className="reports-block-head">
                <strong>Incident Report</strong>
                <span>Best for demonstrating case handling, detection rationale, evidence, timeline, impact, and next actions.</span>
              </div>
              <div className="reports-controls">
                <select className="field-input" value={selectedIncident} onChange={(e) => setSelectedIncident(e.target.value)} disabled={loading}>
                  {incidents.map((incident) => (
                    <option key={incident.id} value={incident.id}>
                      #{incident.id} · {incident.threat_type} · {incident.risk_level}
                    </option>
                  ))}
                </select>
                <button className="btn-primary" onClick={generateIncidentReport} disabled={generating || !selectedIncident}>
                  {generating ? 'Generating...' : 'Generate Incident Report'}
                </button>
              </div>
            </div>

            <div className="reports-builder-block">
              <div className="reports-block-head">
                <strong>Operations Report</strong>
                <span>Best for showing SOC posture, active workload, case severity, and operational priorities across a reporting window.</span>
              </div>
              <div className="reports-controls reports-controls-grid">
                <select className="field-input" value={hours} onChange={(e) => setHours(e.target.value)}>
                  <option value="24">Last 24 hours</option>
                  <option value="72">Last 72 hours</option>
                  <option value="168">Last 7 days</option>
                  <option value="720">Last 30 days</option>
                </select>
                <select className="field-input" value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
                  <option value="">All severities</option>
                  {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((value) => <option key={value}>{value}</option>)}
                </select>
                <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All statuses</option>
                  {['Open', 'Investigating', 'Resolved', 'False Positive', 'Closed'].map((value) => <option key={value}>{value}</option>)}
                </select>
                <button className="btn-outline" onClick={generateOperationsReport} disabled={generating}>
                  {generating ? 'Generating...' : 'Generate Operations Report'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <span className="card-title">Report Preview <InfoHint text="This preview is generated from backend report logic, so what you see here is the actual SOC report structure rather than mock text. Use markdown export if you want to save or share it." /></span>
            {report && (
              <div className="reports-actions">
                <button className="btn-outline" onClick={() => navigator.clipboard.writeText(report.markdown || '')}>Copy Markdown</button>
                <button className="btn-primary" onClick={() => downloadText(`${(report.report_title || 'soc-report').replace(/\s+/g, '-').toLowerCase()}.md`, report.markdown || '')}>Download</button>
              </div>
            )}
          </div>
          <div className="card-body">
            {!report ? (
              <div className="empty-state" style={{ padding: '40px 24px' }}>
                <span className="empty-title">No report generated yet</span>
                <span className="empty-sub">Generate an incident or operations report to preview the full SOC narrative here.</span>
              </div>
            ) : (
              <div className="report-preview">
                <div className="report-headline">
                  <div>
                    <h2>{report.report_title}</h2>
                    <p className="report-headline-copy">{report.executive_summary}</p>
                  </div>
                  <span>{report.generated_at ? new Date(report.generated_at).toLocaleString() : ''}</span>
                </div>

                {report.case_snapshot && (
                  <div className="report-metrics-grid">
                    <Metric label="Threat Type" value={report.case_snapshot.threat_type} />
                    <Metric label="Risk Posture" value={`${report.case_snapshot.risk_level || 'Unknown'} / ${report.case_snapshot.risk_score ?? 'N/A'}`} />
                    <Metric label="Owner" value={report.case_snapshot.owner} />
                    <Metric label="Workflow" value={report.case_snapshot.workflow_state} />
                    <Metric label="Source Provenance" value={report.case_snapshot.source_label} />
                    <Metric label="Grouped Alerts" value={report.case_snapshot.alert_count} />
                  </div>
                )}

                {report.severity_breakdown && (
                  <div className="report-metrics-grid">
                    {Object.entries(report.severity_breakdown).map(([key, value]) => (
                      <Metric key={key} label={`${key} Cases`} value={value} />
                    ))}
                  </div>
                )}

                {report.analyst_assessment && (
                  <div className="report-section report-section-highlight">
                    <h3>Analyst Assessment</h3>
                    <p>{report.analyst_assessment}</p>
                  </div>
                )}

                {(report.sections || []).map((section, index) => (
                  <div key={`${section.title}-${index}`} className="report-section">
                    <h3>{section.title}</h3>
                    <p>{section.text}</p>
                    {!!(section.bullets || []).length && (
                      <div className="report-bullets">
                        {section.bullets.map((bullet, bulletIndex) => (
                          <div key={`${section.title}-${bulletIndex}`} className="report-bullet">{bullet}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {!!(report.key_findings || []).length && (
                  <div className="report-section">
                    <h3>Key Findings</h3>
                    <div className="report-bullets">
                      {report.key_findings.map((item, index) => (
                        <div key={index} className="report-bullet">{item}</div>
                      ))}
                    </div>
                  </div>
                )}

                {report.detection_context && (
                  <div className="report-section">
                    <h3>Detection Context</h3>
                    <div className="report-grid">
                      <Metric label="Confidence" value={report.detection_context.confidence} />
                      <Metric label="Source" value={report.detection_context.source_label} />
                      <Metric label="Log Type" value={report.detection_context.log_type || 'Not available'} />
                      <Metric label="IOC Matches" value={report.detection_context.ioc_match_count} />
                      <Metric label="Blocklist Hit" value={report.detection_context.blocklist_hit ? 'Yes' : 'No'} />
                      <Metric label="MITRE References" value={(report.detection_context.mitre_mapping || []).length} />
                    </div>
                    {!!(report.detection_context.risk_factors || []).length && (
                      <div className="report-bullets">
                        {report.detection_context.risk_factors.map((factor, index) => (
                          <div key={index} className="report-bullet">{factor}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!!(report.evidence_highlights || []).length && (
                  <div className="report-section">
                    <h3>Evidence Highlights</h3>
                    <div className="report-rows">
                      {report.evidence_highlights.map((item) => (
                        <div key={item.id} className="report-evidence-card">
                          <div className="report-evidence-head">
                            <strong>{item.title}</strong>
                            <em>{formatDate(item.timestamp)}</em>
                          </div>
                          <p>{item.detail}</p>
                          <div className="report-evidence-meta">
                            <span>{item.source}</span>
                            <span>{item.risk_level} / {item.risk_score ?? 'N/A'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!!(report.timeline || []).length && (
                  <div className="report-section">
                    <h3>Investigation Timeline</h3>
                    <div className="report-timeline">
                      {report.timeline.map((item) => (
                        <div key={item.id} className={`report-timeline-item report-timeline-${item.kind || 'entry'}`}>
                          <div className="report-timeline-marker" />
                          <div className="report-timeline-body">
                            <div className="report-timeline-head">
                              <strong>{item.title}</strong>
                              <span>{formatDate(item.timestamp)}</span>
                            </div>
                            <p>{item.summary}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {report.notes && (
                  <div className="report-section">
                    <h3>Analyst Notes</h3>
                    <p>{report.notes}</p>
                  </div>
                )}

                {report.source_breakdown && (
                  <div className="report-section">
                    <h3>Source Provenance Breakdown</h3>
                    <div className="report-grid">
                      {Object.entries(report.source_breakdown).map(([label, value]) => (
                        <Metric key={label} label={label} value={value} />
                      ))}
                    </div>
                  </div>
                )}

                {!!(report.report_rows || []).length && (
                  <div className="report-section">
                    <h3>Included Cases</h3>
                    <div className="report-rows">
                      {report.report_rows.map((row) => (
                        <div key={row.incident_id} className="report-row">
                          <span>#{row.incident_id}</span>
                          <strong>{row.threat_type}</strong>
                          <em>{row.risk_level}</em>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="report-section">
                  <h3>Recommended Actions</h3>
                  <div className="report-bullets">
                    {(report.recommended_actions || []).map((action, index) => (
                      <div key={index} className="report-bullet">{action}</div>
                    ))}
                  </div>
                </div>

                <div className="report-section">
                  <h3>Markdown Output</h3>
                  <pre className="report-markdown">{report.markdown}</pre>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

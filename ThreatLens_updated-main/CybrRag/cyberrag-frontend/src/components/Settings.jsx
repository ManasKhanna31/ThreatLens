import React, { useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../services/api';
import InfoHint from './soc/InfoHint';




export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, healthRes] = await Promise.all([
        api.get('/dashboard/settings'),
        api.get('/dashboard/ingestion-health'),
      ]);
      setSettings(settingsRes.data);
      setHealth(healthRes.data);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load settings.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateNested = (section, key, value) => {
    setSettings((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value,
      },
    }));
  };

  const updateDeepNested = (section, group, key, value) => {
    setSettings((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [group]: {
          ...current[section][group],
          [key]: value,
        },
      },
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/dashboard/settings', settings);
      await fetchData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save settings.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-spinner" />
        <span>Loading settings workspace</span>
      </div>
    );
  }

  if (error) {
    return <div className="page-body"><div className="auth-error">{error}</div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="soc-header-kicker">Admin Workspace</div>
          <h1 className="page-header-title">Settings and Health</h1>
          <p className="page-header-sub">Control demo mode, collector behavior, retention, feeds, and detection thresholds from one operator-facing page.</p>
        </div>
      </div>

      <div className="page-body settings-grid">
        <section className="card settings-section">
          <div className="card-header">
            <span className="card-title">Collector Controls <InfoHint text="These settings govern the local Windows collector. They keep the prototype light while still feeling like a live telemetry source." /></span>
          </div>
          <div className="card-body settings-form-grid">
            <label><span className="field-label">Demo Mode</span><select className="field-input" value={String(settings.demo_mode)} onChange={(e) => setSettings({ ...settings, demo_mode: e.target.value === 'true' })}><option value="true">Enabled</option><option value="false">Disabled</option></select></label>
            <label><span className="field-label">Collector Enabled</span><select className="field-input" value={String(settings.collector.enabled)} onChange={(e) => updateNested('collector', 'enabled', e.target.value === 'true')}><option value="true">Enabled</option><option value="false">Disabled</option></select></label>
            <label><span className="field-label">Interval Seconds</span><input className="field-input" type="number" value={settings.collector.interval_seconds} onChange={(e) => updateNested('collector', 'interval_seconds', Number(e.target.value))} /></label>
            <label><span className="field-label">Max Events / Sweep</span><input className="field-input" type="number" value={settings.collector.max_events_per_sweep} onChange={(e) => updateNested('collector', 'max_events_per_sweep', Number(e.target.value))} /></label>
          </div>
        </section>

        <section className="card settings-section">
          <div className="card-header">
            <span className="card-title">Retention <InfoHint text="Retention protects disk space on your local machine. These values define how much telemetry and case history the prototype keeps." /></span>
          </div>
          <div className="card-body settings-form-grid">
            <label><span className="field-label">Max Logs</span><input className="field-input" type="number" value={settings.retention.max_logs} onChange={(e) => updateNested('retention', 'max_logs', Number(e.target.value))} /></label>
            <label><span className="field-label">Max Incidents</span><input className="field-input" type="number" value={settings.retention.max_incidents} onChange={(e) => updateNested('retention', 'max_incidents', Number(e.target.value))} /></label>
            <label><span className="field-label">Max Chats</span><input className="field-input" type="number" value={settings.retention.max_chats} onChange={(e) => updateNested('retention', 'max_chats', Number(e.target.value))} /></label>
          </div>
        </section>

        <section className="card settings-section">
          <div className="card-header">
            <span className="card-title">Detection Thresholds <InfoHint text="These controls affect dedup windows, grouping, reopen logic, SLAs, and risk classification so the incident pipeline feels more disciplined." /></span>
          </div>
          <div className="card-body settings-form-grid">
            <label><span className="field-label">Dedup Window Minutes</span><input className="field-input" type="number" value={settings.detection.dedup_window_minutes} onChange={(e) => updateNested('detection', 'dedup_window_minutes', Number(e.target.value))} /></label>
            <label><span className="field-label">Group Window Hours</span><input className="field-input" type="number" value={settings.detection.group_window_hours} onChange={(e) => updateNested('detection', 'group_window_hours', Number(e.target.value))} /></label>
            <label><span className="field-label">Reopen Window Hours</span><input className="field-input" type="number" value={settings.detection.reopen_window_hours} onChange={(e) => updateNested('detection', 'reopen_window_hours', Number(e.target.value))} /></label>
            <label><span className="field-label">Critical Threshold</span><input className="field-input" type="number" value={settings.detection.risk_thresholds.critical} onChange={(e) => updateDeepNested('detection', 'risk_thresholds', 'critical', Number(e.target.value))} /></label>
            <label><span className="field-label">High Threshold</span><input className="field-input" type="number" value={settings.detection.risk_thresholds.high} onChange={(e) => updateDeepNested('detection', 'risk_thresholds', 'high', Number(e.target.value))} /></label>
            <label><span className="field-label">Medium Threshold</span><input className="field-input" type="number" value={settings.detection.risk_thresholds.medium} onChange={(e) => updateDeepNested('detection', 'risk_thresholds', 'medium', Number(e.target.value))} /></label>
          </div>
        </section>

        <section className="card settings-section">
          <div className="card-header">
            <span className="card-title">SLA and Auto-Close <InfoHint text="These values tell the case lifecycle service when a case should be considered late and when low-priority inactive cases can be auto-resolved." /></span>
          </div>
          <div className="card-body settings-form-grid">
            <label><span className="field-label">Critical SLA Minutes</span><input className="field-input" type="number" value={settings.detection.sla_minutes.CRITICAL} onChange={(e) => updateDeepNested('detection', 'sla_minutes', 'CRITICAL', Number(e.target.value))} /></label>
            <label><span className="field-label">High SLA Minutes</span><input className="field-input" type="number" value={settings.detection.sla_minutes.HIGH} onChange={(e) => updateDeepNested('detection', 'sla_minutes', 'HIGH', Number(e.target.value))} /></label>
            <label><span className="field-label">Medium SLA Minutes</span><input className="field-input" type="number" value={settings.detection.sla_minutes.MEDIUM} onChange={(e) => updateDeepNested('detection', 'sla_minutes', 'MEDIUM', Number(e.target.value))} /></label>
            <label><span className="field-label">Low SLA Minutes</span><input className="field-input" type="number" value={settings.detection.sla_minutes.LOW} onChange={(e) => updateDeepNested('detection', 'sla_minutes', 'LOW', Number(e.target.value))} /></label>
            <label><span className="field-label">Low Auto-Close Hours</span><input className="field-input" type="number" value={settings.detection.auto_close_hours.LOW} onChange={(e) => updateDeepNested('detection', 'auto_close_hours', 'LOW', Number(e.target.value))} /></label>
            <label><span className="field-label">Medium Auto-Close Hours</span><input className="field-input" type="number" value={settings.detection.auto_close_hours.MEDIUM} onChange={(e) => updateDeepNested('detection', 'auto_close_hours', 'MEDIUM', Number(e.target.value))} /></label>
          </div>
        </section>

        <section className="card settings-section settings-span-two">
          <div className="card-header">
            <span className="card-title">Ingestion Health <InfoHint text="Per-source health shows whether data is arriving, whether parsing is failing, how many events are being dropped as low signal, and how many incidents are being created." /></span>
          </div>
          <div className="card-body ingestion-health-list">
            {(health?.sources || []).map((source) => (
              <div key={source.source_key} className="ingestion-health-item">
                <div>
                  <strong>{source.display_name}</strong>
                  <span>Last event: {source.last_event_at ? new Date(source.last_event_at).toLocaleString() : 'Never'}</span>
                </div>
                <div className="ingestion-health-metrics">
                  <span>{source.events_ingested} events</span>
                  <span>{source.incidents_created} incidents</span>
                  <span>{source.parse_failures} parse failures</span>
                  <span>{source.dropped_events} dropped</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card settings-section settings-span-two">
          <div className="card-header">
            <span className="card-title">Feeds and Notes <InfoHint text="This prototype currently refreshes a lightweight set of threat intel feeds. The list below is here to make the demo feel operational and explain what powers enrichment." /></span>
          </div>
          <div className="card-body feed-chip-row">
            {(settings.feeds.sources || []).map((feed) => <span key={feed} className="incident-factor-chip">{feed}</span>)}
          </div>
        </section>

        <div className="settings-save-row settings-span-two">
          <button className="btn-primary" onClick={saveSettings} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
        </div>
      </div>
    </div>
  );
}

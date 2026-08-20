// src/components/SOAR.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';




const CONDITION_HELP = {
  risk_level: 'Exact match on risk level: CRITICAL, HIGH, MEDIUM, LOW',
  risk_level_min: 'Minimum risk score (0-100). Fires if score >= this value',
  threat_type: 'Substring match on threat type name',
  multi_stage: 'Fires if the incident is linked to a multi-stage campaign',
};
const ACTION_HELP = {
  webhook: 'Send HTTP POST to a webhook URL (Slack, Teams, Jira, PagerDuty)',
  email: 'Send severity-colored HTML email via SMTP',
  block_ip: 'Automatically add the source IP to the blocklist',
  escalate: 'Change incident status to ESCALATED',
};

function RuleCard({ rule, onToggle, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rule-card ${rule.is_active ? '' : 'rule-inactive'}`}>
      <div className="rule-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="rule-card-left">
          <div className={`rule-active-dot ${rule.is_active ? 'rad-on' : 'rad-off'}`} title={rule.is_active ? 'Active' : 'Inactive'} />
          <div>
            <div className="rule-name">{rule.name}</div>
            <div className="rule-meta">
              <span className="rule-chip">{rule.condition_type}</span>
              <span className="rule-arrow-sm">→</span>
              <span className="rule-chip rule-chip-action">{rule.action_type}</span>
            </div>
          </div>
        </div>
        <div className="rule-card-actions" onClick={e => e.stopPropagation()}>
          <button
            className={`rule-toggle-btn ${rule.is_active ? '' : 'rtb-off'}`}
            onClick={() => onToggle(rule.id, rule.is_active)}
            title={rule.is_active ? 'Disable rule' : 'Enable rule'}
          >
            {rule.is_active ? 'Disable' : 'Enable'}
          </button>
          <button className="rule-delete-btn" onClick={() => onDelete(rule.id)} title="Delete rule">✖</button>
        </div>
      </div>
      {expanded && (
        <div className="rule-detail">
          <div className="rule-detail-grid">
            <div>
              <span className="detail-label">Condition</span>
              <div className="rule-detail-val">
                <span className="rule-chip">{rule.condition_type}</span> {rule.condition_value}
              </div>
              <p className="rule-help">{CONDITION_HELP[rule.condition_type]}</p>
            </div>
            <div>
              <span className="detail-label">Action</span>
              <div className="rule-detail-val">
                <span className="rule-chip rule-chip-action">{rule.action_type}</span>
                {rule.action_config?.webhook_url && <span className="rule-url">{rule.action_config.webhook_url}</span>}
                {rule.action_config?.email && <span className="rule-url">{rule.action_config.email}</span>}
              </div>
              <p className="rule-help">{ACTION_HELP[rule.action_type]}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddRuleModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: '', condition_type: 'risk_level', condition_value: 'CRITICAL',
    action_type: 'webhook', action_config: { webhook_url: '' },
  });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const setConfig = k => e => setForm(f => ({ ...f, action_config: { ...f.action_config, [k]: e.target.value } }));

  const handleSave = async () => {
    if (!form.name) { alert('Rule name is required.'); return; }
    try {
      await api.post('/alerts/rules', form);
      onSave();
    } catch { alert('Failed to create rule.'); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">New SOAR Rule</span>
          <button className="modal-close" onClick={onClose}>✖</button>
        </div>
        <div className="modal-body">
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field-label">Rule Name</label>
            <input className="field-input" placeholder="e.g. Auto-block CRITICAL threats" value={form.name} onChange={set('name')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="field">
              <label className="field-label">Condition Type</label>
              <select className="field-input" value={form.condition_type} onChange={set('condition_type')}>
                {Object.keys(CONDITION_HELP).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Condition Value</label>
              <input className="field-input" placeholder="CRITICAL or threshold" value={form.condition_value} onChange={set('condition_value')} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field-label">Action Type</label>
            <select className="field-input" value={form.action_type} onChange={set('action_type')}>
              {Object.keys(ACTION_HELP).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          {form.action_type === 'webhook' && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">Webhook URL</label>
              <input className="field-input" placeholder="https://hooks.slack.com/..." value={form.action_config.webhook_url || ''} onChange={setConfig('webhook_url')} />
            </div>
          )}
          {form.action_type === 'email' && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">Email Address</label>
              <input className="field-input" placeholder="analyst@company.com" value={form.action_config.email || ''} onChange={setConfig('email')} />
            </div>
          )}
          <p className="rule-help" style={{ marginBottom: 16 }}>{CONDITION_HELP[form.condition_type]} → {ACTION_HELP[form.action_type]}</p>
          <button className="btn-primary" onClick={handleSave}>Create Rule</button>
        </div>
      </div>
    </div>
  );
}

export default function SOAR() {
  const [tab, setTab] = useState('rules');
  const [rules, setRules] = useState([]);
  const [blocklist, setBlocklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddRule, setShowAddRule] = useState(false);
  const [blockIp, setBlockIp] = useState('');
  const [blockReason, setBlockReason] = useState('');

  const loadRules = async () => {
    try {
      const res = await api.get('/alerts/rules');
      const rulesData = res.data.rules || [];
      // Map 'enabled' to 'is_active' for the UI
      setRules(rulesData.map(r => ({ ...r, is_active: r.enabled })));
    } catch {}
  };
  const loadBlocklist = async () => {
    try {
      const res = await api.get('/alerts/blocklist');
      // The backend returns 'blocked_ips' not 'blocklist'
      setBlocklist(res.data.blocked_ips || []);
    } catch {}
  };

  useEffect(() => {
    Promise.all([loadRules(), loadBlocklist()]).finally(() => setLoading(false));
  }, []);

  const handleToggle = async (id, isActive) => {
    try {
      await api.put(`/alerts/rules/${id}/toggle`);
      loadRules();
    } catch { alert('Failed to toggle rule.'); }
  };
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    try { await api.delete(`/alerts/rules/${id}`); loadRules(); } catch { alert('Failed.'); }
  };
  const handleBlock = async () => {
    if (!blockIp.trim()) return;
    try {
      await api.post('/alerts/blocklist', { ip_address: blockIp.trim(), reason: blockReason || 'Manual block' });
      setBlockIp(''); setBlockReason('');
      loadBlocklist();
    } catch { alert('Failed to add IP to blocklist.'); }
  };
  const handleUnblock = async (block_id) => {
    try { await api.delete(`/alerts/blocklist/${block_id}`); loadBlocklist(); }
    catch { alert('Failed to unblock.'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">SOAR & Automation</h1>
          <p className="page-header-sub">Configurable rules, blocklist management, and automated responses</p>
        </div>
        {tab === 'rules' && (
          <button className="btn-primary" onClick={() => setShowAddRule(true)}>+ New Rule</button>
        )}
      </div>

      <div className="page-body">
        <div className="filter-tabs">
          {['rules', 'blocklist'].map(t => (
            <button key={t} className={`filter-tab ${tab === t ? 'ft-active' : ''}`} onClick={() => setTab(t)}>
              {t === 'rules' ? '⚙️ Alert Rules' : '🚫 IP Blocklist'}
              <span className="ft-count">{t === 'rules' ? rules.length : blocklist.length}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="page-loading"><div className="loading-spinner" /><span>Loading…</span></div>
        ) : tab === 'rules' ? (
          rules.length === 0 ? (
            <div className="empty-state" style={{ paddingTop: 60 }}>
              <span className="empty-icon">⚙️</span>
              <span className="empty-title">No SOAR rules configured</span>
              <span className="empty-sub">Create rules to automate threat response — webhook alerts, email, IP blocking, and escalation.</span>
              <button className="btn-primary" onClick={() => setShowAddRule(true)}>+ Create First Rule</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rules.map(r => (
                <RuleCard key={r.id} rule={r} onToggle={handleToggle} onDelete={handleDelete} />
              ))}
            </div>
          )
        ) : (
          <div>
            {/* Add to blocklist */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><span className="card-title">Add IP to Blocklist</span></div>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="field-input" style={{ flex: 1 }} placeholder="IP address (e.g. 192.168.1.100)" value={blockIp} onChange={e => setBlockIp(e.target.value)} />
                  <input className="field-input" style={{ flex: 2 }} placeholder="Reason (optional)" value={blockReason} onChange={e => setBlockReason(e.target.value)} />
                  <button className="btn-primary" onClick={handleBlock}>Block IP</button>
                </div>
              </div>
            </div>

            {/* Blocklist table */}
            {blocklist.length === 0 ? (
              <div className="empty-state"><span className="empty-title">No IPs blocked yet</span><span className="empty-sub">IPs can be blocked manually or automatically by SOAR rules.</span></div>
            ) : (
              <div className="card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>IP Address</th><th>Reason</th><th>Blocked At</th><th>Source</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocklist.map((b, i) => (
                      <tr key={i}>
                        <td><span className="ip-tag">{b.ip_address}</span></td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{b.reason || '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>{b.blocked_at ? new Date(b.blocked_at).toLocaleString() : '—'}</td>
                        <td><span className="rule-chip">{b.auto_blocked ? 'auto' : 'manual'}</span></td>
                        <td><button className="rule-delete-btn" onClick={() => handleUnblock(b.id)} title="Unblock">Unblock</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showAddRule && <AddRuleModal onClose={() => setShowAddRule(false)} onSave={() => { setShowAddRule(false); loadRules(); }} />}
    </div>
  );
}

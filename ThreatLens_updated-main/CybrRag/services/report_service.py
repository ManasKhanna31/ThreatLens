from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from models.db_models import Incident


SOURCE_LABELS = {
    "demo_seed": "Demo simulation telemetry",
    "manual_analysis": "Manual analyst submission",
    "bulk_ingest": "Bulk log ingestion",
    "real_windows_event_log": "Real Windows event logs",
    "webhook": "Webhook ingestion",
    "other": "Other platform source",
}


def _titleize(value: Optional[str], fallback: str = "Not available") -> str:
    if not value:
        return fallback
    cleaned = str(value).replace("_", " ").replace("-", " ").strip()
    return " ".join(part.capitalize() for part in cleaned.split())


def _format_datetime(value: Any, fallback: str = "Not recorded") -> str:
    if not value:
        return fallback
    if isinstance(value, datetime):
        return value.strftime("%d %b %Y, %I:%M %p UTC")
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed.strftime("%d %b %Y, %I:%M %p UTC")
        except ValueError:
            return value
    return str(value)


def _format_duration_minutes(minutes: Optional[int]) -> str:
    if minutes is None:
        return "No active SLA timer"
    if minutes < 0:
        return f"SLA breached by {abs(minutes)} minutes"
    if minutes < 60:
        return f"{minutes} minutes remaining"
    hours = round(minutes / 60, 1)
    return f"{hours} hours remaining"


def _confidence_text(value: Any) -> str:
    if isinstance(value, (int, float)):
        return f"{round(value * 100)}%"
    return "Not available"


def _ensure_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _source_label(value: Optional[str]) -> str:
    return SOURCE_LABELS.get(value or "other", _titleize(value, "Other platform source"))


def _incident_to_summary(incident: Incident) -> Dict[str, Any]:
    explanation = incident.explanation or {}
    return {
        "incident_id": incident.id,
        "threat_type": incident.threat_type,
        "risk_level": incident.risk_level,
        "risk_score": incident.risk_score,
        "source_ip": incident.source_ip,
        "mitre_technique": incident.mitre_technique,
        "status": incident.status,
        "workflow_state": incident.workflow_state,
        "owner": incident.owner,
        "source": incident.source,
        "source_label": _source_label(incident.source),
        "alert_count": incident.alert_count or 1,
        "first_seen": incident.first_seen.isoformat() if incident.first_seen else None,
        "last_seen": incident.last_seen.isoformat() if incident.last_seen else None,
        "opened_at": incident.opened_at.isoformat() if incident.opened_at else None,
        "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None,
        "sla_due_at": incident.sla_due_at.isoformat() if incident.sla_due_at else None,
        "recommended_actions": incident.recommended_actions or [],
        "risk_factors": explanation.get("risk_factors", []),
        "ioc_match_count": explanation.get("ioc_match_count", 0),
    }


def _normalize_timeline(incident: Incident) -> List[Dict[str, Any]]:
    evidence = _ensure_list(incident.evidence)
    history = _ensure_list(incident.status_history)
    timeline = []

    for index, item in enumerate(evidence):
        parsed = item.get("parsed") or {}
        timeline.append({
            "id": f"evidence-{index}",
            "kind": "evidence",
            "timestamp": item.get("timestamp"),
            "title": item.get("threat") or item.get("stage") or "Detection event",
            "summary": _build_evidence_summary(item),
            "source": item.get("source"),
            "risk_level": item.get("risk_level"),
            "risk_score": item.get("risk_score"),
            "log_type": parsed.get("log_type"),
        })

    for index, item in enumerate(history):
        timeline.append({
            "id": f"status-{index}",
            "kind": "status",
            "timestamp": item.get("timestamp"),
            "title": item.get("workflow_state") or item.get("status") or "Workflow update",
            "summary": item.get("note") or "Case state updated.",
            "owner": item.get("owner"),
            "status": item.get("status"),
        })

    timeline.sort(key=lambda item: item.get("timestamp") or "")
    return timeline


def _build_evidence_summary(item: Dict[str, Any]) -> str:
    parsed = item.get("parsed") or {}
    parts = []
    if item.get("stage"):
        parts.append(f"ATT&CK stage observed: {_titleize(item.get('stage'))}")
    if parsed.get("user"):
        parts.append(f"Targeted user or principal: {parsed['user']}")
    if parsed.get("event_id"):
        parts.append(f"Event ID: {parsed['event_id']}")
    if item.get("mitre"):
        parts.append(f"MITRE mapping candidate: {item['mitre']}")
    if item.get("ioc_matches"):
        parts.append(f"{len(item['ioc_matches'])} IOC match(es) were associated with this event")
    if item.get("raw_excerpt"):
        parts.append(f"Observed log excerpt: {item['raw_excerpt']}")
    return ". ".join(parts) if parts else "ThreatLens recorded this telemetry item as supporting case evidence."


def _build_key_findings(incident: Incident) -> List[str]:
    explanation = incident.explanation or {}
    findings = [
        f"The case is currently classified as {incident.risk_level or 'UNKNOWN'} with a risk score of {incident.risk_score or 0}.",
        f"The platform has grouped {incident.alert_count or 1} related alert(s) into this case, reducing duplicate queue noise.",
    ]
    if incident.source_ip:
        findings.append(f"The primary source IP under review is {incident.source_ip}.")
    if incident.mitre_technique:
        findings.append(f"Threat behavior is mapped to MITRE ATT&CK technique {incident.mitre_technique}.")
    if explanation.get("ioc_match_count"):
        findings.append(f"Threat intelligence enrichment found {explanation['ioc_match_count']} indicator match(es).")
    if explanation.get("blocklist_hit"):
        findings.append("The source is already present on the blocklist, which raises confidence that this is hostile or previously actioned activity.")
    if explanation.get("confidence") is not None:
        findings.append(f"Detection confidence is { _confidence_text(explanation.get('confidence')) }, based on parser output, rule matches, and correlation context.")
    return findings


def _build_incident_sections(
    incident: Incident,
    summary: Dict[str, Any],
    timeline: List[Dict[str, Any]],
    findings: List[str],
) -> List[Dict[str, Any]]:
    explanation = incident.explanation or {}
    risk_factors = _ensure_list(explanation.get("risk_factors"))
    mitre_mapping = _ensure_list(explanation.get("mitre_mapping"))
    recommended_actions = _ensure_list(incident.recommended_actions)

    overview_text = (
        f"Incident #{incident.id} tracks {_titleize(incident.threat_type, 'suspicious activity')} "
        f"originating from {incident.source_ip or 'an unidentified source'} and currently sits in the "
        f"{_titleize(incident.workflow_state, 'New')} workflow state under {_titleize(incident.status, 'Open')} status. "
        f"The case was opened on {_format_datetime(incident.opened_at)} and last updated on {_format_datetime(incident.last_seen)}."
    )

    detection_text = (
        summary.get("technical_analysis")
        or summary.get("description")
        or (
            "ThreatLens correlated parser output, detection rules, threat-intelligence context, and risk scoring to determine that this activity warranted escalation into an analyst case."
        )
    )

    impact_text = (
        summary.get("business_impact")
        or (
            f"Given the {incident.risk_level or 'UNKNOWN'} severity, this case should be treated as a potential security event until the observed behavior is validated, contained, or ruled benign. "
            f"If the activity is confirmed, the main business concern is unauthorized access, malicious execution, or repeated hostile probing against local infrastructure."
        )
    )

    findings_text = (
        f"The detection rationale is supported by {len(risk_factors)} recorded risk factor(s), "
        f"{len(mitre_mapping)} MITRE mapping reference(s), and {len([item for item in timeline if item.get('kind') == 'evidence'])} evidence item(s) retained in the case history."
    )

    workflow_text = (
        f"The case is owned by {incident.owner or 'Unassigned'}. "
        f"SLA status: {_format_duration_minutes(_sla_remaining_minutes(incident))}. "
        f"The current report captures both the operational state of the case and the technical basis for continued triage or containment."
    )

    return [
        {"title": "Incident Overview", "text": overview_text},
        {"title": "Detection Narrative", "text": detection_text},
        {"title": "Key Findings", "text": findings_text, "bullets": findings},
        {"title": "Business Impact Assessment", "text": impact_text},
        {"title": "Workflow and SLA Position", "text": workflow_text},
        {"title": "Containment and Next Actions", "text": "Recommended next steps are listed below to help an analyst move from validation to containment and resolution.", "bullets": recommended_actions},
    ]


def _sla_remaining_minutes(incident: Incident) -> Optional[int]:
    if not incident.sla_due_at or incident.status in ("Resolved", "Closed"):
        return None
    delta = incident.sla_due_at - datetime.utcnow()
    return int(delta.total_seconds() // 60)


def _build_detection_context(incident: Incident) -> Dict[str, Any]:
    explanation = incident.explanation or {}
    return {
        "confidence": _confidence_text(explanation.get("confidence")),
        "mitre_mapping": _ensure_list(explanation.get("mitre_mapping")),
        "risk_factors": _ensure_list(explanation.get("risk_factors")),
        "ioc_match_count": explanation.get("ioc_match_count", 0),
        "blocklist_hit": bool(explanation.get("blocklist_hit")),
        "log_type": explanation.get("log_type"),
        "source_label": _source_label(explanation.get("source") or incident.source),
    }


def _build_evidence_highlights(incident: Incident) -> List[Dict[str, Any]]:
    highlights = []
    for index, item in enumerate(_ensure_list(incident.evidence)[:8]):
        highlights.append({
            "id": f"highlight-{index}",
            "timestamp": item.get("timestamp"),
            "title": item.get("threat") or item.get("stage") or "Detection evidence",
            "detail": _build_evidence_summary(item),
            "risk_level": item.get("risk_level"),
            "risk_score": item.get("risk_score"),
            "source": _source_label(item.get("source")),
        })
    return highlights


def _build_analyst_assessment(incident: Incident) -> str:
    explanation = incident.explanation or {}
    severity = incident.risk_level or "UNKNOWN"
    confidence = _confidence_text(explanation.get("confidence"))
    factors = _ensure_list(explanation.get("risk_factors"))

    if severity in ("CRITICAL", "HIGH"):
        posture = "requires immediate analyst review and likely containment planning"
    elif severity == "MEDIUM":
        posture = "deserves triage to determine whether escalation is needed"
    else:
        posture = "should remain visible but can usually be validated after higher-severity queue items"

    driver = factors[0] if factors else "multiple correlated detection signals"
    return (
        f"Analyst assessment: this case {posture}. The current confidence level is {confidence}, and the leading risk driver is {driver}. "
        f"The case source is {_source_label(incident.source)}, which means the report should be interpreted as a {'real telemetry-backed' if incident.source == 'real_windows_event_log' else 'platform-generated'} detection workflow."
    )


def build_incident_report(incident: Incident) -> Dict[str, Any]:
    summary = incident.soc_summary or {}
    recommended_actions = _ensure_list(incident.recommended_actions)
    findings = _build_key_findings(incident)
    timeline = _normalize_timeline(incident)
    detection_context = _build_detection_context(incident)
    evidence_highlights = _build_evidence_highlights(incident)

    executive_summary = (
        summary.get("llm_summary")
        or summary.get("executive_summary")
        or (
            f"ThreatLens opened Incident #{incident.id} after identifying {_titleize(incident.threat_type, 'suspicious activity')} "
            f"from {incident.source_ip or 'an unidentified source'}. The case is currently rated {incident.risk_level or 'UNKNOWN'} "
            f"with a risk score of {incident.risk_score or 0}, grouped across {incident.alert_count or 1} related alert(s), "
            f"and is presently assigned to {incident.owner or 'Unassigned'} for analyst handling."
        )
    )

    technical_analysis = (
        summary.get("technical_analysis")
        or summary.get("description")
        or (
            f"Detection telemetry indicates {_titleize(incident.threat_type, 'security-relevant activity')} with MITRE ATT&CK mapping "
            f"{incident.mitre_technique or 'not specified'}. ThreatLens used parser output, correlation logic, risk scoring, and "
            f"threat-intelligence enrichment to determine the case confidence of {detection_context['confidence']}."
        )
    )

    business_impact = (
        summary.get("business_impact")
        or (
            f"If validated as malicious, this activity could lead to unauthorized access, execution, persistence, or repeat compromise attempts "
            f"against the affected environment. Because the case remains in {_titleize(incident.workflow_state, 'New')} workflow state, "
            f"the main operational priority is to confirm scope, validate intent, and decide whether containment is immediately required."
        )
    )

    report = {
        "report_type": "incident_report",
        "generated_at": datetime.utcnow().isoformat(),
        "report_title": f"SOC Incident Report #{incident.id}",
        "executive_summary": executive_summary,
        "technical_analysis": technical_analysis,
        "business_impact": business_impact,
        "analyst_assessment": _build_analyst_assessment(incident),
        "recommended_actions": recommended_actions,
        "key_findings": findings,
        "case_snapshot": _incident_to_summary(incident),
        "timeline": timeline,
        "evidence_highlights": evidence_highlights,
        "status_history": _ensure_list(incident.status_history),
        "detection_context": detection_context,
        "sections": _build_incident_sections(incident, summary, timeline, findings),
        "notes": incident.analyst_notes or "No analyst notes have been added to this case yet.",
    }
    report["markdown"] = render_report_markdown(report)
    return report


def _severity_breakdown(summaries: Iterable[Dict[str, Any]]) -> Dict[str, int]:
    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for item in summaries:
        level = (item.get("risk_level") or "").upper()
        if level in counts:
            counts[level] += 1
    return counts


def _operations_sections(
    summaries: List[Dict[str, Any]],
    open_cases: int,
    investigating: int,
    critical: int,
    high: int,
    source_breakdown: Dict[str, int],
) -> List[Dict[str, Any]]:
    total = len(summaries)
    source_lines = [f"{_source_label(source)}: {count} case(s)" for source, count in source_breakdown.items() if count]
    top_case_lines = [
        f"Case #{item['incident_id']} | {item.get('threat_type') or 'Unknown threat'} | {item.get('risk_level')} | owner: {item.get('owner') or 'Unassigned'} | alerts grouped: {item.get('alert_count') or 1}"
        for item in sorted(summaries, key=lambda row: row.get("risk_score") or 0, reverse=True)[:5]
    ]
    return [
        {
            "title": "Queue Overview",
            "text": (
                f"This reporting window contains {total} case(s). {open_cases} remain open and {investigating} are actively under investigation, "
                f"which gives a quick view of unresolved operational workload."
            ),
        },
        {
            "title": "Severity Posture",
            "text": (
                f"The queue includes {critical} CRITICAL case(s) and {high} HIGH case(s). These should be treated as the priority stack for analyst review, "
                "especially where SLA pressure or repeat alerts are also present."
            ),
        },
        {
            "title": "Source Provenance",
            "text": "Cases in this report are grouped by ingestion origin so operators and stakeholders can distinguish real collected telemetry from seeded or manually submitted flows.",
            "bullets": source_lines,
        },
        {
            "title": "Notable Cases",
            "text": "The highest-risk cases in the current window are listed below for quick review or demo walkthrough.",
            "bullets": top_case_lines,
        },
    ]


def build_operational_report(incidents: List[Incident], title: str = "SOC Operations Report") -> Dict[str, Any]:
    summaries = [_incident_to_summary(incident) for incident in incidents]
    critical = len([item for item in summaries if item["risk_level"] == "CRITICAL"])
    high = len([item for item in summaries if item["risk_level"] == "HIGH"])
    open_cases = len([item for item in summaries if item["status"] == "Open"])
    investigating = len([item for item in summaries if item["status"] == "Investigating"])
    severity_breakdown = _severity_breakdown(summaries)
    top_sources = sorted(summaries, key=lambda item: item["risk_score"] or 0, reverse=True)[:5]
    source_breakdown: Dict[str, int] = {}
    for row in summaries:
        source_breakdown[row.get("source") or "other"] = source_breakdown.get(row.get("source") or "other", 0) + 1

    executive_summary = (
        f"This operations report covers {len(summaries)} case(s). {critical} are rated CRITICAL, {high} are HIGH, "
        f"{open_cases} remain open, and {investigating} are in active investigation. The dataset is intended to give a concise SOC posture view with enough detail for demos, reviews, and operator handoffs."
    )

    technical_analysis = (
        "ThreatLens grouped incidents by case, normalized source provenance, tracked queue state, and summarized ATT&CK mapping, ownership, alert grouping, and response recommendations to produce this operational picture."
    )

    business_impact = (
        "Operationally, this report helps explain current analyst workload, case severity distribution, and which detections are most likely to require containment or executive attention. It is suitable for prototype demonstrations because it is generated from stored case data rather than static UI placeholders."
    )

    report = {
        "report_type": "operations_report",
        "generated_at": datetime.utcnow().isoformat(),
        "report_title": title,
        "executive_summary": executive_summary,
        "technical_analysis": technical_analysis,
        "business_impact": business_impact,
        "analyst_assessment": (
            f"The current queue posture is shaped by {critical + high} high-priority case(s). "
            "If this were an active SOC shift, those cases would be validated first, followed by cases nearing SLA and repeat grouped detections."
        ),
        "recommended_actions": [
            "Prioritize unresolved CRITICAL and HIGH severity cases for analyst validation or containment.",
            "Review grouped alerts with elevated alert_count to identify persistent or repeated attacker behavior.",
            "Use ATT&CK mappings, source provenance, and related evidence when presenting queue depth during demos or stakeholder walkthroughs.",
        ],
        "key_findings": [
            f"Queue severity distribution: {severity_breakdown['CRITICAL']} CRITICAL, {severity_breakdown['HIGH']} HIGH, {severity_breakdown['MEDIUM']} MEDIUM, {severity_breakdown['LOW']} LOW.",
            f"Open workload consists of {open_cases} open case(s) and {investigating} actively investigated case(s).",
            f"Source provenance in this report spans {len(source_breakdown)} distinct ingestion origin(s).",
        ],
        "report_rows": summaries,
        "top_cases": top_sources,
        "sections": _operations_sections(summaries, open_cases, investigating, critical, high, source_breakdown),
        "severity_breakdown": severity_breakdown,
        "source_breakdown": { _source_label(key): value for key, value in source_breakdown.items() },
    }
    report["markdown"] = render_report_markdown(report)
    return report


def render_report_markdown(report: Dict[str, Any]) -> str:
    lines = [
        f"# {report.get('report_title', 'SOC Report')}",
        "",
        f"Generated: {_format_datetime(report.get('generated_at'))}",
        "",
        "## Executive Summary",
        report.get("executive_summary", "Not available."),
        "",
        "## Analyst Assessment",
        report.get("analyst_assessment", "Not available."),
        "",
    ]

    for section in report.get("sections", []):
        lines.extend([
            f"## {section.get('title', 'Section')}",
            section.get("text", "Not available."),
        ])
        for bullet in section.get("bullets", []) or []:
            lines.append(f"- {bullet}")
        lines.append("")

    lines.extend([
        "## Technical Analysis",
        report.get("technical_analysis", "Not available."),
        "",
        "## Business Impact",
        report.get("business_impact", "Not available."),
        "",
    ])

    key_findings = report.get("key_findings") or []
    if key_findings:
        lines.append("## Key Findings")
        for item in key_findings:
            lines.append(f"- {item}")
        lines.append("")

    detection_context = report.get("detection_context")
    if detection_context:
        lines.extend([
            "## Detection Context",
            f"- Source provenance: {detection_context.get('source_label')}",
            f"- Detection confidence: {detection_context.get('confidence')}",
            f"- Log type: {detection_context.get('log_type') or 'Not available'}",
            f"- Threat-intelligence matches: {detection_context.get('ioc_match_count')}",
            f"- Blocklist hit: {'Yes' if detection_context.get('blocklist_hit') else 'No'}",
        ])
        for factor in detection_context.get("risk_factors", []):
            lines.append(f"- Risk factor: {factor}")
        for mitre in detection_context.get("mitre_mapping", []):
            lines.append(f"- MITRE reference: {mitre}")
        lines.append("")

    snapshot = report.get("case_snapshot")
    if snapshot:
        lines.extend([
            "## Case Snapshot",
            f"- Incident ID: {snapshot.get('incident_id')}",
            f"- Threat Type: {snapshot.get('threat_type')}",
            f"- Risk: {snapshot.get('risk_level')} ({snapshot.get('risk_score')})",
            f"- Status: {snapshot.get('status')}",
            f"- Workflow State: {snapshot.get('workflow_state')}",
            f"- Owner: {snapshot.get('owner')}",
            f"- Source IP: {snapshot.get('source_ip') or 'Not available'}",
            f"- Source Provenance: {snapshot.get('source_label')}",
            f"- Alert Count: {snapshot.get('alert_count')}",
            f"- Opened At: {_format_datetime(snapshot.get('opened_at'))}",
            f"- Last Seen: {_format_datetime(snapshot.get('last_seen'))}",
            "",
        ])

    if report.get("evidence_highlights"):
        lines.append("## Evidence Highlights")
        for item in report["evidence_highlights"]:
            lines.append(
                f"- {_format_datetime(item.get('timestamp'))}: {item.get('title')} | {item.get('risk_level')} ({item.get('risk_score')}) | {item.get('detail')}"
            )
        lines.append("")

    if report.get("timeline"):
        lines.append("## Investigation Timeline")
        for item in report["timeline"]:
            lines.append(
                f"- {_format_datetime(item.get('timestamp'))}: {item.get('title')} | {item.get('summary')}"
            )
        lines.append("")

    if report.get("report_rows"):
        lines.append("## Included Cases")
        for row in report["report_rows"]:
            lines.append(
                f"- #{row.get('incident_id')} | {row.get('threat_type')} | {row.get('risk_level')} | {row.get('status')} | {row.get('workflow_state')} | owner: {row.get('owner')} | alerts: {row.get('alert_count')}"
            )
        lines.append("")

    notes = report.get("notes")
    if notes:
        lines.extend([
            "## Analyst Notes",
            notes,
            "",
        ])

    lines.append("## Recommended Actions")
    for action in report.get("recommended_actions", []):
        lines.append(f"- {action}")

    return "\n".join(lines).strip()

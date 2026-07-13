export const EVIDENCE_STYLES = `
    body{margin:0;background:#f8fafc;color:#0f172a;font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.55}
    .wrap{max-width:1120px;margin:0 auto;padding:32px}
    .hero{background:#020617;color:white;border-radius:18px;padding:28px;box-shadow:0 24px 60px rgba(15,23,42,.18)}
    .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#94a3b8;font-weight:800}
    h1{margin:8px 0 4px;font-size:30px;line-height:1.1}
    h2{margin:28px 0 12px;font-size:17px}
    .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:18px}
    .box{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:14px}
    .box b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:4px}
    .status{display:inline-flex;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:800}
    .pass{background:#dcfce7;color:#166534}.fail{background:#fee2e2;color:#991b1b}.neutral{background:#e0f2fe;color:#075985}
    pre{white-space:pre-wrap;background:#0f172a;color:#dbeafe;border-radius:12px;padding:16px;overflow:auto}
    .evidence-section{width:min(96vw,1480px);margin-left:50%;transform:translateX(-50%)}
    .viewer{display:grid;grid-template-columns:minmax(0,1fr) 480px;height:min(860px,86vh);min-height:650px;background:#020617;border-radius:16px;overflow:hidden;border:1px solid #1e293b}
    .screen{display:flex;flex-direction:column;min-width:0;min-height:0;background:#000}
    .screen-head,.dev-head{display:flex;align-items:center;justify-content:space-between;gap:16px;height:64px;padding:0 16px;border-bottom:1px solid #1e293b;background:#020617;color:white}
    .screen-title,.dev-title{min-width:0}.screen-title b,.dev-title b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.screen-title small,.dev-title small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .screen-body{min-height:0;flex:1 1 auto;display:flex;align-items:center;justify-content:center;padding:18px;overflow:hidden}
    .screen-body img,.screen-body video{max-width:100%;max-height:100%;object-fit:contain;box-shadow:0 18px 50px rgba(0,0,0,.45)}
    .timeline{height:82px;flex:0 0 82px;border-top:1px solid #1e293b;background:#020617;padding:10px 12px}
    .timeline-label{display:flex;justify-content:space-between;color:#64748b;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px}
    .timeline-row{display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;padding-bottom:8px;scrollbar-color:#475569 #020617;scrollbar-width:thin}
    button{font:inherit;cursor:pointer}
    .time-btn,.tab-btn{border:1px solid #334155;background:#0f172a;color:#cbd5e1;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:800;white-space:nowrap}
    .time-btn.active,.tab-btn.active{background:#6366f1;border-color:#6366f1;color:white}
    .devtools{min-width:0;min-height:0;border-left:1px solid #1e293b;background:#020617;color:#dbeafe;display:flex;flex-direction:column}
    .tabs{display:flex;gap:6px;background:#0f172a;border-radius:8px;padding:4px}
    .filters{display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid #1e293b;background:#020617;padding:10px}
    .filters input,.filters select{min-width:0;border:1px solid #334155;background:#0f172a;color:#dbeafe;border-radius:8px;padding:7px 8px;font-size:12px;font-weight:700}
    .filters input{flex:1 1 140px}.filters select{flex:0 0 112px}
    .filter-btn{border:1px solid #334155;background:#0f172a;color:#94a3b8;border-radius:999px;padding:6px 9px;font-size:11px;font-weight:900}
    .filter-btn.active{border-color:#6366f1;background:#312e81;color:#e0e7ff}
    .hidden-count{width:100%;color:#64748b;font-size:11px;font-weight:800}
    .log-list{min-height:0;flex:1 1 auto;overflow:auto}
    .log-row{display:grid;grid-template-columns:58px 78px minmax(0,1fr) 52px;gap:8px;align-items:center;width:100%;border:0;border-bottom:1px solid #1e293b;background:transparent;color:#cbd5e1;text-align:left;padding:10px}
    .log-row:hover{background:#0f172a}.log-row.active{background:#172554}
    .time,.method{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.method{font-weight:900;color:#a5b4fc}.status-code{justify-self:center;border-radius:6px;background:#064e3b;color:#6ee7b7;padding:2px 6px;font-size:11px;font-weight:900}.status-code.err{background:#7f1d1d;color:#fecaca}
    .url{min-width:0}.url b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.url small{display:block;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .repeat{display:inline-flex;margin-left:6px;border-radius:999px;background:#312e81;color:#c7d2fe;padding:1px 6px;font-size:10px;font-weight:900}
    .detail-panel{height:240px;flex:0 0 240px;border-top:1px solid #1e293b;background:#0f172a;display:flex;flex-direction:column;min-height:0}
    .detail-tabs{display:flex;gap:6px;padding:8px;border-bottom:1px solid #1e293b}
    .detail-tab{border:1px solid #334155;background:#020617;color:#94a3b8;border-radius:8px;padding:6px 9px;font-size:11px;font-weight:900}
    .detail-tab.active{background:#0369a1;border-color:#0ea5e9;color:white}
    .log-detail{min-height:0;flex:1;overflow:auto;padding:12px;color:#bfdbfe;font-family:Consolas,monospace;font-size:11px;white-space:pre-wrap}
    .empty{padding:48px 18px;text-align:center;color:#64748b}
    .meta-row{display:grid;grid-template-columns:160px minmax(0,1fr);gap:10px;border-top:1px solid #e2e8f0;padding:10px 0}.meta-row:first-child{border-top:0}.meta-row b{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b}.meta-row span{min-width:0;overflow-wrap:anywhere}
    .muted{color:#64748b}.section{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-top:18px}
    @media(max-width:980px){.evidence-section{width:auto;margin-left:0;transform:none}.viewer{grid-template-columns:1fr;height:auto}.screen{min-height:520px}.devtools{border-left:0;border-top:1px solid #1e293b;min-height:620px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.meta-row{grid-template-columns:1fr}}
    @media print{body{background:white}.wrap{padding:0}.hero,.section,.box{box-shadow:none;break-inside:avoid}.viewer{display:block}.devtools{display:none}}
`;

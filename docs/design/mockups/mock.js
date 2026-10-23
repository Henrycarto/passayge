// Passayge design mockups. All people, organisations and records are synthetic.
// Query parameters: screen=chart|log, palette=a|b|c, theme=light|dark, help=1, access=granted|none

const q = new URLSearchParams(location.search);
const screen = q.get('screen') ?? 'chart';
const palette = q.get('palette') ?? 'c';
const theme = q.get('theme') ?? 'light';
const help = q.get('help') === '1';
const access = q.get('access') ?? 'granted';

document.documentElement.dataset.palette = palette;
document.documentElement.dataset.theme = theme;

const ic = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

const STATUS = {
  granted: { icon: 'lock-open', word: 'Granted' },
  denied: { icon: 'lock', word: 'Denied' },
  expired: { icon: 'clock-alert', word: 'Expired' },
  void: { icon: 'circle-slash', word: 'Entered in error' },
  recorded: { icon: 'check', word: 'Recorded' },
};
const status = (kind, word) => `<span class="status ${kind}">${ic(STATUS[kind].icon)}${word ?? STATUS[kind].word}</span>`;

const topbar = () => `
<header class="topbar">
  <div class="wordmark"><span class="mark" aria-hidden="true"></span>Passayge</div>
  <p class="sandbox">${ic('flask-conical')}<span><strong>Simulation with synthetic data.</strong> Not connected to ELGA, the e-card system or any real service.</span></p>
  <span class="spacer"></span>
  <div class="actor"><b>${access === 'none' ? 'Dr. Johannes Wimmer' : 'Dr. Lena Aigner'}</b><span>${access === 'none' ? 'Locum, GP practice, Graz' : 'GP practice, Graz'}</span></div>
  <div class="clock">
    <div><div class="lbl">Simulated time</div><time datetime="2026-10-23T14:05">Fri 23 Oct 2026, 14:05</time></div>
    <button class="btn sm" type="button">+1 day</button>
    <button class="btn sm" type="button">+28 days</button>
  </div>
  <button class="btn icon ghost" type="button" aria-label="Help and tour">${ic('circle-help', 'lg')}</button>
</header>`;

const side = (current) => `
<nav class="side" aria-label="Main">
  <div class="nav">
    <a href="#" ${current === 'chart' ? 'aria-current="page"' : ''}>${ic('users-round')}Patients <kbd class="k">G P</kbd></a>
    <a href="#" ${current === 'log' ? 'aria-current="page"' : ''}>${ic('scroll-text')}Audit and network log <kbd class="k">G L</kbd></a>
    <a href="#">${ic('info')}Glossary <kbd class="k">?</kbd></a>
  </div>
  <div class="search">${ic('search')}<span>Brandst</span><kbd>/</kbd></div>
  <h3>2 patients found by name</h3>
  <div class="result" aria-current="true"><b>BRANDSTÄTTER, Theresia</b><span class="st num">64 y</span><small class="num">Born 14 Mar 1962, Graz</small></div>
  <div class="result"><b>BRANDSTÄTTER, Ferdinand</b><span class="st num">37 y</span><small class="num">Born 2 Jul 1988, Leibnitz</small></div>
</nav>`;

const banner = () => `
<section class="banner" aria-label="Patient: BRANDSTÄTTER, Theresia">
  <div>
    <h1>BRANDSTÄTTER, Theresia <span class="tag">${ic('flask-conical')}Synthetic</span></h1>
    <dl class="facts">
      <div><dt>Born</dt><dd class="num">14 Mar 1962 (64 years)</dd></div>
      <div><dt>Gender (administrative)</dt><dd>Female</dd></div>
      <div><dt><span class="term">Social security number</span> (synthetic)</dt><dd class="id">0495 140362</dd></div>
      <div><dt>Address</dt><dd>Kastanienzeile 12, <span class="num">8010</span> Graz</dd></div>
    </dl>
  </div>
  ${access === 'none' ? `
  <div class="access denied" role="status">
    <span class="glyph">${ic('lock')}</span>
    <b>No access</b>
    <small>No contact confirmation from you for this patient.<br>Insert the e-card to request access.</small>
  </div>` : `
  <div class="access granted" role="status">
    <span class="glyph">${ic('lock-open')}</span>
    <b>Access granted, 2 of 3 functions</b>
    <small class="num">Documents and medication until 24 Dec 2026, 10:40.<br>Vaccinations expired today at 10:40.</small>
  </div>`}
</section>`;

// One 90-day scale for every function, so 28 and 90 days compare at a glance.
const SCALE = 90;
const NOW = 28.14; // days since the e-card was inserted on 25 Sep 2026, 10:40
function windowBar(days) {
  const end = (days / SCALE) * 100;
  const now = Math.min((NOW / SCALE) * 100, 100);
  const expired = NOW >= days;
  return `
  <div class="window ${expired ? 'expired' : ''}" role="img" aria-label="${days}-day window, ${expired ? 'ended' : `${Math.round(days - NOW)} days left`}">
    <span class="track" style="right:${100 - end}%"></span>
    <span class="used" style="width:${Math.min(now, end)}%"></span>
    ${expired ? '' : `<span class="left" style="left:${now}%;width:${end - now}%"></span>`}
    <span class="end" style="left:calc(${end}% - 2px)"></span>
    <span class="now" style="left:${now}%"></span>
  </div>`;
}

const contactPanel = () => access === 'none' ? `
<section class="panel" aria-labelledby="kb-h">
  <div class="h2"><h2 id="kb-h"><span class="term">Contact confirmation</span> <span class="de">(Kontaktbestätigung)</span></h2></div>
  <p style="margin:0 0 var(--s3)">You have no contact confirmation for this patient. Documents, medication and vaccinations stay locked until the patient's e-card is inserted in your practice.</p>
  <div class="kb-actions">
    <button class="btn primary" type="button">${ic('id-card')}Insert e-card</button>
    <span class="src">Simulated card</span>
  </div>
  <div class="simplified">${ic('info')}<span><b>Simplified.</b> In the real system the e-card system signs the contact and the practice software forwards it. Here a button stands in for the card reader.</span></div>
</section>` : `
<section class="panel relative" aria-labelledby="kb-h">
  <div class="h2"><h2 id="kb-h"><span class="term" id="term-kb">Contact confirmation</span> <span class="de">(Kontaktbestätigung)</span></h2></div>
  <div class="kb-cols">
  <div>
  <dl class="kb-meta">
    <dt>Created by</dt><dd>Inserting the e-card</dd>
    <dt>At</dt><dd class="num"><time>25 Sep 2026, 10:40</time></dd>
    <dt>In</dt><dd>Ordination Dr. Lena Aigner</dd>
  </dl>
  <div class="fn">
    <div class="fn-head">${ic('file-text')}<span class="name">Documents (e-Befunde)</span>${status('granted')}</div>
    ${windowBar(90)}
    <div class="window-scale num"><span>25 Sep</span><span class="today" style="left:${(NOW / SCALE) * 100}%">Today</span><span>24 Dec, 90 days</span></div>
    <div class="fn-note num">61 days, 20 hours left. <a href="#">§ 18 Abs. 6 GTelG</a></div>
  </div>
  <div class="fn">
    <div class="fn-head">${ic('pill')}<span class="name">Medication (e-Medikation)</span>${status('granted')}</div>
    ${windowBar(90)}
    <div class="window-scale num"><span>25 Sep</span><span class="today" style="left:${(NOW / SCALE) * 100}%">Today</span><span>24 Dec, 90 days</span></div>
    <div class="fn-note num">61 days, 20 hours left. <a href="#">§ 18 Abs. 6 GTelG</a></div>
  </div>
  <div class="fn">
    <div class="fn-head">${ic('syringe')}<span class="name">Vaccinations (e-Impfpass)</span>${status('expired')}</div>
    ${windowBar(28)}
    <div class="window-scale num"><span>25 Sep</span><span>Ended 23 Oct, 10:40, after 28 days</span></div>
    <div class="fn-note act">The vaccination record allows 28 days for every provider. Insert the e-card again to renew it. <a href="#">§ 24f Abs. 2 GTelG</a></div>
  </div>
  </div>
  <div>
  <div class="kb-actions relative" id="kb-actions">
    <button class="btn primary" type="button" id="insert">${ic('id-card')}Insert e-card again</button>
    <span class="src">Simulated card</span>
  </div>
  <div class="prefs">
    <div class="src">Patient's settings in the access portal</div>
    <ul>
      <li><span>Opt-out</span><span>None</span></li>
      <li><span>Your access period</span><span>Default, not extended</span></li>
      <li><span>Objection for this visit</span><span>None recorded</span></li>
    </ul>
  </div>
  <div class="simplified">${ic('info')}<span><b>Simplified.</b> One sandbox service stands in for the contact confirmation service, the token service and the patient's policy store.</span></div>
  </div>
  </div>
</section>`;

const DOCS = [
  { date: '9 Oct 2026', doc: 'Discharge letter, physician', note: 'Laparoscopic cholecystectomy', from: 'Department of Surgery', org: 'Klinikum Grazer Feld', st: 'final' },
  { date: '30 Sep 2026', doc: 'Laboratory report', note: 'Diabetes follow-up panel', from: 'Medizinisches Labor Annenviertel', org: 'Graz', st: 'final', flag: '4 results out of range', sel: true },
  { date: '30 Sep 2026', doc: 'Laboratory report', note: 'Replaced by the corrected report above', from: 'Medizinisches Labor Annenviertel', org: 'Graz', st: 'void' },
  { date: '18 Aug 2026', doc: 'Imaging report, abdominal ultrasound', note: 'Gallstones, no duct dilatation', from: 'Radiologie Jakomini', org: 'Graz', st: 'final' },
  { date: '3 Jul 2026', doc: 'Outpatient report', note: 'Diabetes clinic', from: 'Internal Medicine Outpatients', org: 'Klinikum Grazer Feld', st: 'final' },
];

const LAB = [
  { t: 'HbA1c', v: '7.8 %', r: '4.0 to 5.6 %', f: 'High' },
  { t: 'Glucose, fasting', v: '142 mg/dL', r: '70 to 99 mg/dL', f: 'High' },
  { t: 'Creatinine', v: '1.12 mg/dL', r: '0.50 to 0.90 mg/dL', f: 'High' },
  { t: 'eGFR (CKD-EPI)', v: '54 mL/min/1.73 m²', r: '60 or more', f: 'Low' },
  { t: 'Potassium', v: '4.6 mmol/L', r: '3.5 to 5.1 mmol/L' },
  { t: 'Sodium', v: '139 mmol/L', r: '136 to 145 mmol/L' },
];

const docsPanel = () => access === 'none' ? `
<section class="panel" aria-labelledby="docs-h">
  <div class="tabs" role="tablist">
    <button role="tab" aria-selected="true">${ic('lock')}Documents</button>
    <button role="tab" aria-selected="false">${ic('lock')}Medication</button>
    <button role="tab" aria-selected="false">${ic('lock')}Vaccinations</button>
  </div>
  <div style="padding:var(--s12) 0;max-width:480px">
    <h2 id="docs-h" style="margin:0 0 var(--s2);font-size:var(--t-read)">${ic('lock')} Documents are locked</h2>
    <p style="margin:0 0 var(--s4)">No contact confirmation for this patient. Insert the e-card to request access. The search was not sent, so nothing about this patient's records was disclosed.</p>
    <p class="src">The attempt is in the audit log as <b>Denied</b> with the reason "No contact confirmation".</p>
  </div>
</section>` : `
<section class="panel" aria-labelledby="docs-h">
  <div class="tabs" role="tablist">
    <button role="tab" aria-selected="true" id="docs-h">${ic('file-text')}Documents <span class="count">5</span></button>
    <button role="tab" aria-selected="false">${ic('pill')}Medication <span class="count">3</span></button>
    <button role="tab" aria-selected="false">${ic('clock-alert')}Vaccinations <span class="count">expired</span></button>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Document</th><th>From</th><th>Status</th></tr></thead>
    <tbody>
      ${DOCS.map((d) => `
      <tr class="${d.sel ? 'sel' : ''} ${d.st === 'void' ? 'void' : ''}">
        <td class="date">${d.date}</td>
        <td><span class="doc">${d.doc}</span><span class="sub">${d.note}</span>${d.flag ? `<span class="flag">${ic('triangle-alert')}${d.flag}</span>` : ''}</td>
        <td>${d.from}<span class="sub">${d.org}</span></td>
        <td>${d.st === 'void' ? status('void') : '<span class="src">Final</span>'}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <article class="reader" aria-label="Laboratory report, 30 Sep 2026">
    <div class="reader-head">${ic('file-text')}<h3>Laboratory report, <span class="num">30 Sep 2026</span></h3><span class="src">Document ID <span class="id">lab-2026-09-30-v2</span></span><span class="src">CDA R2, not ELGA-conformant</span><button class="btn sm" type="button">Open document</button></div>
    <div class="reader-body">
      <table class="lab">
        <thead><tr><th>Test</th><th>Result</th><th>Reference range</th><th>Flag</th></tr></thead>
        <tbody>
        ${LAB.map((l) => `<tr class="${l.f ? 'abn' : ''}"><td>${l.t}</td><td class="val num">${l.v}</td><td class="ref num">${l.r}</td><td class="flagc">${l.f ? `<span class="flag">${ic('triangle-alert')}${l.f}</span>` : '<span class="src">Normal</span>'}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  </article>
</section>`;

const peek = () => access === 'none' ? `
<div class="peek">${ic('network')}<span>Last transaction</span><b>Access check</b><span class="code" style="color:var(--denied)">Denied</span><span>No request was sent to the document registry.</span><span class="sp"></span><a href="#">Open network log</a></div>` : `
<div class="peek">${ic('network')}<span>Last transaction</span><span class="ihe">ITI-68</span><b>Retrieve Document</b><span class="elga">In ELGA: ITI-43 Retrieve Document Set</span><span class="code num">200</span><span class="num">31 ms</span><span class="sp"></span><a href="#">Open network log</a></div>`;

const helpLayer = () => !help ? '' : `
<div class="tip" role="tooltip" id="tip" style="left:40px;top:186px">
  <b>Contact confirmation</b>
  Proof that the patient was with you, created when their e-card is inserted. It decides for how long you can open their records.
  <span class="more">Press Escape to close.</span>
</div>
<div class="tour" role="dialog" aria-label="Tour, step 2 of 5" id="tour">
  <div class="dots" aria-hidden="true"><i class="on"></i><i class="on"></i><i></i><i></i><i></i></div>
  <div class="step">Step 2 of 5</div>
  <h4>Insert the e-card</h4>
  <p>This records a contact confirmation and opens the patient's records for 90 days. The card is simulated here.</p>
  <div class="row"><button class="btn ghost sm" type="button">Skip tour</button><span class="sp"></span><button class="btn sm" type="button">Back</button><button class="btn sm primary" type="button">Next</button></div>
</div>`;

function chart() {
  return `
<div class="app">
  ${topbar()}
  ${side('chart')}
  <main>
    ${banner()}
    <div class="work relative">
      ${contactPanel()}
      ${docsPanel()}
      ${helpLayer()}
    </div>
    ${peek()}
  </main>
</div>`;
}

const AUDIT = [
  { day: 'Today, Fri 23 Oct 2026' },
  { t: '14:02:31', who: 'Dr. Lena Aigner', org: 'Ordination Dr. Lena Aigner, GP', what: 'Opened document', data: 'Laboratory report, 30 Sep 2026', st: 'granted', rule: 'Contact 25 Sep, day 28 of 90. § 18 Abs. 6', sel: true },
  { t: '14:02:20', who: 'Dr. Lena Aigner', org: 'Ordination Dr. Lena Aigner, GP', what: 'Searched documents', data: '5 found', st: 'granted', rule: 'Contact 25 Sep, day 28 of 90. § 18 Abs. 6' },
  { t: '14:01:58', who: 'Dr. Lena Aigner', org: 'Ordination Dr. Lena Aigner, GP', what: 'Opened vaccination record', data: 'Vaccination record', st: 'expired', rule: '28-day window ended 23 Oct, 10:40. § 24f Abs. 2' },
  { t: '11:15:07', who: 'Mag. pharm. Florian Gruber', org: 'Apotheke zum Silbernen Hirschen', what: 'Searched documents', data: 'Documents', st: 'denied', rule: 'Pharmacies see medication data only. § 21 Abs. 2' },
  { t: '11:14:50', who: 'Mag. pharm. Florian Gruber', org: 'Apotheke zum Silbernen Hirschen', what: 'Read medication list', data: '3 entries', st: 'granted', rule: 'Contact 23 Oct, day 1 of 28. § 18 Abs. 6' },
  { t: '11:14:32', who: 'Mag. pharm. Florian Gruber', org: 'Apotheke zum Silbernen Hirschen', what: 'Recorded contact confirmation', data: 'e-card, simulated', st: 'recorded', rule: 'Pharmacy window: 28 days' },
  { day: 'Fri 9 Oct 2026' },
  { t: '16:20:44', who: 'OA Dr. Martin Pichler', org: 'Klinikum Grazer Feld, Surgery', what: 'Stored document', data: 'Discharge letter, physician', st: 'granted', rule: 'Inpatient contact. § 18 Abs. 6' },
  { day: 'Wed 30 Sep 2026' },
  { t: '08:05:12', who: 'Batch process', org: 'Medizinisches Labor Annenviertel', what: 'Marked document as entered in error', data: 'Laboratory report, 30 Sep 2026', st: 'void', rule: 'Replaced by corrected report' },
  { day: 'Fri 25 Sep 2026' },
  { t: '10:40:03', who: 'Dr. Lena Aigner', org: 'Ordination Dr. Lena Aigner, GP', what: 'Recorded contact confirmation', data: 'e-card, simulated', st: 'recorded', rule: 'Doctor window: 90 days' },
  { day: 'Tue 18 Aug 2026' },
  { t: '09:31:40', who: 'Dr. Johannes Wimmer', org: 'Ordination Dr. Lena Aigner, locum', what: 'Searched documents', data: 'Documents', st: 'denied', rule: 'No contact confirmation from this provider' },
];

const SEQ = [
  { ihe: 'ITI-67', name: 'Find Document References', http: 'GET /fhir/DocumentReference?patient=Patient/pas-0495&status=current', elga: 'ITI-18 Registry Stored Query', code: 200, ms: 42 },
  { ihe: 'Access check', name: 'Contact confirmation and policy', http: 'POST /access/decide  scope=document  role=doctor', elga: 'ELGA token service, assertion sent with ITI-40', code: 200, ms: 6, simp: true },
  { ihe: 'ITI-68', name: 'Retrieve Document', http: 'GET /fhir/Binary/lab-2026-09-30-v2', elga: 'ITI-43 Retrieve Document Set', code: 200, ms: 31, sel: true },
  { ihe: 'ITI-20', name: 'Record Audit Event', http: 'POST /fhir/AuditEvent', elga: 'ITI-20 to the area audit record repository', code: 201, ms: 9 },
];

function log() {
  return `
<div class="app">
  ${topbar()}
  ${side('log')}
  <main>
    <div class="filters">
      <span class="chip">Patient <b>BRANDSTÄTTER, Theresia</b> ${ic('x')}</span>
      <span class="chip">${ic('list-filter')}Outcome <b>All</b></span>
      <span class="chip">Role <b>All</b></span>
      <span class="chip">Period <b class="num">last 90 days</b></span>
      <span class="sp"></span>
      <span class="src num">12 events</span>
      <span class="src"><kbd>J</kbd> <kbd>K</kbd> to move</span>
    </div>
    <div class="log">
      <div class="audit-wrap">
        <table class="audit">
          <colgroup><col class="c-time"><col class="c-who"><col><col class="c-out"><col class="c-why hide-t"></colgroup>
          <thead><tr><th>Time</th><th>Who</th><th>Action</th><th>Outcome</th><th class="hide-t">Why</th></tr></thead>
          <tbody>
          ${AUDIT.map((a) => a.day ? `<tr class="daysep"><td colspan="5">${a.day}</td></tr>` : `
            <tr class="${a.sel ? 'sel' : ''}">
              <td class="date"><time>${a.t}</time></td>
              <td class="who"><b>${a.who}</b><span class="sub">${a.org}</span></td>
              <td>${a.what}<span class="sub">${a.data}</span></td>
              <td>${status(a.st)}</td>
              <td class="rule hide-t">${a.rule}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <aside class="detail" aria-labelledby="det-h">
        <div class="detail-cols">
        <div>
        <h2 id="det-h">Audit record</h2>
        <div class="src">The fields every access must log under <a href="#">§ 22 Abs. 2 GTelG</a></div>
        <dl class="fields">
          <dt>Date and time</dt><dd class="num">23 Oct 2026, 14:02:31.204</dd>
          <dt>Transaction number</dt><dd class="id">7f3c2a91-0e4b</dd>
          <dt>Type of processing</dt><dd>Read (retrieve document)</dd>
          <dt>Provider</dt><dd>Ordination Dr. Lena Aigner, GP</dd>
          <dt>Person</dt><dd>Dr. Lena Aigner</dd>
          <dt>Data</dt><dd>Laboratory report, 30 Sep 2026<span class="src" style="display:block">Document ID <span class="id">lab-2026-09-30-v2</span></span></dd>
          <dt>Query criteria</dt><dd>Patient, status current</dd>
          <dt>Outcome</dt><dd>${status('granted')}</dd>
          <dt>Error message</dt><dd>None</dd>
        </dl>
        </div>
        <div>
        <h2>Network transactions</h2>
        <div class="src">Each sandbox call, with the ELGA transaction it stands in for</div>
        <ol class="seq">
          ${SEQ.map((s) => `
          <li class="${s.sel ? 'sel' : ''}">
            <div class="line1"><span class="ihe">${s.ihe}</span><span>${s.name}</span><span class="sp"></span><span class="meta"><span class="code2 ${s.code < 300 ? 'ok' : 'no'}">${s.code}</span><span class="ms">${s.ms} ms</span></span></div>
            <div class="http">${s.http}</div>
            <div class="maps">${ic('arrow-right-left')}<span class="elgatag">In ELGA</span><span>${s.elga}${s.simp ? '. <b>Simplified</b>' : ''}</span></div>
          </li>`).join('')}
        </ol>
        </div>
        </div>
      </aside>
    </div>
  </main>
</div>`;
}

document.getElementById('root').innerHTML = screen === 'log' ? log() : chart();

// Place the help layer next to its anchors.
if (help) {
  const work = document.querySelector('.work').getBoundingClientRect();
  const term = document.getElementById('term-kb')?.getBoundingClientRect();
  const tip = document.getElementById('tip');
  if (term && tip) { tip.style.left = `${term.left - work.left - 8}px`; tip.style.top = `${term.bottom - work.top + 10}px`; }
  const btn = document.getElementById('insert')?.getBoundingClientRect();
  const tour = document.getElementById('tour');
  if (btn && tour) { tour.style.left = `${btn.left - work.left - 16}px`; tour.style.top = `${btn.top - work.top - tour.offsetHeight - 12}px`; }
}

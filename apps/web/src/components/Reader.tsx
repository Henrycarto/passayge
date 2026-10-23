import { useEffect, useState } from 'react';
import { CircleSlash, FileText } from 'lucide-react';
import type { DocumentReference } from 'fhir/r4';
import { TIME_ZONE } from '@passayge/core';
import { LabResult } from '@/components/wardkit/lab-result';
import { ApiError, api } from '@/lib/api';
import { parseCda, type CdaDocument } from '@/lib/cda';
import { fmtDay } from '@/lib/format';
import { Term, Tip } from './Tooltip';

const TYPE_TERM: Record<string, string> = {
  '18842-5': 'discharge-letter',
  '11502-2': 'lab-report',
  '18748-4': 'imaging-report',
  '11488-4': 'outpatient-report',
  '10160-0': 'medication',
  '11369-6': 'vaccinations',
};

export function Reader({ doc }: { doc: DocumentReference }) {
  const [cda, setCda] = useState<CdaDocument>();
  const [error, setError] = useState<string>();
  const url = doc.content?.[0]?.attachment?.url;
  const voided = doc.status === 'entered-in-error';

  useEffect(() => {
    if (!url) return;
    let live = true;
    api
      .retrieve(url)
      .then((xml) => live && setCda(parseCda(xml)))
      .catch((e: unknown) => live && setError(e instanceof ApiError ? e.message : 'The document could not be read.'));
    return () => {
      live = false;
    };
  }, [url]);

  const title = `${doc.type?.text ?? 'Document'}, ${doc.date ? fmtDay(doc.date) : 'undated'}`;
  return (
    <article className="reader" aria-label={title}>
      <div className="reader-head">
        <FileText aria-hidden="true" size={16} />
        <h3>{title}</h3>
        {TYPE_TERM[doc.type?.coding?.[0]?.code ?? ''] && (
          <span className="src">
            <Term id={TYPE_TERM[doc.type!.coding![0]!.code!]!}>What is this?</Term>
          </span>
        )}
        <span className="src">
          Document ID <span className="id">{doc.id}</span>
        </span>
        <Tip content="The document is CDA-like XML: the structure of HL7 CDA R2, but not checked against ELGA's implementation guides.">
          <span className="src" tabIndex={0}>
            <Term id="cda">CDA</Term> R2, not ELGA-conformant
          </span>
        </Tip>
      </div>
      <div className="reader-body">
        {voided && (
          <div className="warn" role="note">
            <CircleSlash aria-hidden="true" size={16} />
            <span>
              <b>
                <Term id="entered-in-error">Entered in error.</Term>
              </b>{' '}
              The author withdrew this document. Its values are not shown; use the corrected report.
            </span>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        {!cda && !error && <p className="empty">Opening the document…</p>}
        {cda && cda.observations.length > 0 && !voided && (
          <section aria-label="Results">
            <div className="lab-grid">
              {cda.observations.map((o, i) => (
                <LabResult key={i} observation={o} timeZone={TIME_ZONE} />
              ))}
            </div>
          </section>
        )}
        {cda &&
          cda.sections
            // A withdrawn report never shows its values; a valid one shows them as LabResult cards above.
            .filter((s) => !(cda.observations.length > 0 && s.title === 'Results'))
            .filter((s) => !(voided && s.table))
            .map((s, i) => (
              <section key={i}>
                <h4>{s.title}</h4>
                {s.paragraphs.map((p, k) => (
                  <p key={k}>{p}</p>
                ))}
                {s.items.length > 0 && (
                  <ul>
                    {s.items.map((p, k) => (
                      <li key={k}>{p}</li>
                    ))}
                  </ul>
                )}
                {s.table && (
                  <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {s.table.head.map((h, k) => (
                          <th key={k} scope="col">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.table.rows.map((r, k) => (
                        <tr key={k}>
                          {r.map((c, j) => (
                            <td key={j} className="num">
                              {/^\d{4}-\d{2}-\d{2}$/.test(c) ? fmtDay(c) : c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </section>
            ))}
      </div>
    </article>
  );
}

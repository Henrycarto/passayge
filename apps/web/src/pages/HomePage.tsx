import { PATIENTS } from '@passayge/core';
import { onLinkClick } from '@/lib/route';
import { fmtDay, fmtSvnr } from '@/lib/format';
import { Term } from '@/components/Tooltip';

/** Landing view: what the sandbox is, and one way into each scenario. */
export function HomePage() {
  return (
    <div className="page">
      <h1>Find a patient to start</h1>
      <p>
        Search in the sidebar by name, date of birth or social security number. Every patient below is <Term id="synthetic">synthetic</Term>, and each shows one access rule.
        Switch who you are acting as in the top bar to see how the same rules answer a doctor, a hospital or a pharmacy.
      </p>
      <h2>Patients in this sandbox</h2>
      <p className="src">A sandbox shortcut. Real systems have no list of all patients; you would always search.</p>
      <table className="stack">
        <thead>
          <tr>
            <th scope="col">Patient</th>
            <th scope="col">Born</th>
            <th scope="col">
              <Term id="svnr">SVNR</Term> (synthetic)
            </th>
            <th scope="col">What it shows</th>
          </tr>
        </thead>
        <tbody>
          {PATIENTS.map((p) => (
            <tr key={p.id}>
              <td>
                <a href={`/patients/${p.id}`} onClick={onLinkClick(`/patients/${p.id}`)}>
                  {p.family.toUpperCase()}, {p.given}
                </a>
              </td>
              <td className="date">{fmtDay(p.birthDate)}</td>
              <td className="id">{fmtSvnr(p.svnr)}</td>
              <td>{p.scenario}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

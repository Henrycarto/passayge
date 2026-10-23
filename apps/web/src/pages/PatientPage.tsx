import { useEffect, useState } from 'react';
import type { Patient } from 'fhir/r4';
import { ApiError, api, type AccessStatus } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Banner } from '@/components/Banner';
import { ContactPanel } from '@/components/ContactPanel';
import { Peek } from '@/components/Peek';
import { Records } from '@/components/Records';

export function PatientPage({ id }: { id: string }) {
  const { now, version, bump } = useSession();
  const [patient, setPatient] = useState<Patient>();
  const [access, setAccess] = useState<AccessStatus>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let live = true;
    Promise.all([api.patient(id), api.access(id)])
      .then(([p, a]) => {
        if (!live) return;
        setPatient(p);
        setAccess(a);
        setError(undefined);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof ApiError && e.status === 404 ? 'There is no patient with this id in the sandbox. Search for a patient in the sidebar.' : (e as Error).message);
      });
    return () => {
      live = false;
    };
  }, [id, version]);

  if (error) {
    return (
      <div className="page">
        <h1>Patient not found</h1>
        <p>{error}</p>
      </div>
    );
  }
  if (!patient || !access) return <p className="page empty">Loading the patient…</p>;

  return (
    <>
      <Banner patient={patient} access={access} now={now} />
      <div className="work">
        <ContactPanel patientId={id} access={access} now={now} onChanged={bump} />
        <Records patientId={id} access={access} version={version} />
      </div>
      <Peek />
    </>
  );
}

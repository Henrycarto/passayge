// Austrian social security number (SVNR) format, used for synthetic numbers only.
// Structure and check digit: answer 4690/AB XXIII. GP of the Federal Ministry,
// https://www.parlament.gv.at/dokument/XXIII/AB/4690/fnameorig_136871.html
//   LLL P DDMMYY: serial number, check digit, date of birth.
//   P = (3 7 9 | 5 8 4 2 1 6 weighted sum of serial and date digits) mod 11; a remainder of 10
//   is never used, the next serial number is taken instead.
// Real serial numbers start at 100, so serials 000 to 099 keep a valid check digit while staying
// outside the issued range. Passayge only ever creates those.

const WEIGHTS = [3, 7, 9, 5, 8, 4, 2, 1, 6] as const;

/** Identifier system for synthetic SVNRs. Deliberately not the real SVNR OID. */
export const SYNTHETIC_SVNR_SYSTEM = 'https://henrycarto.com/passayge/fhir/sid/synthetic-svnr';

/** Check digit for a 3-digit serial and DDMMYY date, or undefined when the remainder is 10. */
export function checkDigit(serial: string, ddmmyy: string): number | undefined {
  const digits = `${serial}${ddmmyy}`;
  if (!/^\d{9}$/.test(digits)) throw new Error('Serial must be 3 digits and the date 6 digits.');
  const sum = WEIGHTS.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  const p = sum % 11;
  return p === 10 ? undefined : p;
}

/** True when a 10-digit number has a correct check digit (spaces allowed). */
export function isValidSvnr(value: string): boolean {
  const v = value.replace(/\s/g, '');
  if (!/^\d{10}$/.test(v)) return false;
  return checkDigit(v.slice(0, 3), v.slice(4)) === Number(v[3]);
}

/** True only for numbers Passayge may use: valid, with a serial below 100. */
export function isSyntheticSvnr(value: string): boolean {
  const v = value.replace(/\s/g, '');
  return isValidSvnr(v) && Number(v.slice(0, 3)) < 100;
}

/**
 * A synthetic SVNR for a date of birth (YYYY-MM-DD), starting at `serial` (0 to 99) and moving to
 * the next serial when the check digit would be 10. Returned as "LLLP DDMMYY".
 */
export function syntheticSvnr(birthDate: string, serial: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) throw new Error('Date of birth must be YYYY-MM-DD.');
  const ddmmyy = `${m[3]}${m[2]}${m[1]!.slice(2)}`;
  for (let s = serial; s < 100; s++) {
    const l = String(s).padStart(3, '0');
    const p = checkDigit(l, ddmmyy);
    if (p !== undefined) return `${l}${p} ${ddmmyy}`;
  }
  throw new Error('No synthetic serial left below 100 for this date.');
}

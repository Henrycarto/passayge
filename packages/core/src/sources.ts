// Every rule Passayge applies points to one of these. Researched in docs/research/phase-1-research.md.

export interface Source {
  id: string;
  label: string;
  url: string;
}

const RIS = 'https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=';

export const SOURCES = {
  gtelg15: { id: 'gtelg15', label: '§ 15 GTelG 2012', url: `${RIS}15` },
  gtelg16: { id: 'gtelg16', label: '§ 16 GTelG 2012', url: `${RIS}16` },
  gtelg18_6: { id: 'gtelg18_6', label: '§ 18 Abs. 6 GTelG 2012', url: `${RIS}18` },
  gtelg18_7: { id: 'gtelg18_7', label: '§ 18 Abs. 7 GTelG 2012', url: `${RIS}18` },
  gtelg21_2: { id: 'gtelg21_2', label: '§ 21 Abs. 2 GTelG 2012', url: `${RIS}21` },
  gtelg22_2: { id: 'gtelg22_2', label: '§ 22 Abs. 2 GTelG 2012', url: `${RIS}22` },
  gtelg24e_5: { id: 'gtelg24e_5', label: '§ 24e Abs. 5 GTelG 2012', url: `${RIS}24e` },
  gtelg24f_2: { id: 'gtelg24f_2', label: '§ 24f Abs. 2 GTelG 2012', url: `${RIS}24f` },
  ecardFaq: {
    id: 'ecardFaq',
    label: 'e-card system ELGA FAQ 2.9, section 2.2',
    url: 'https://www.chipkarte.at/cdscontent/load?contentid=10008.781679&version=1698063349',
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

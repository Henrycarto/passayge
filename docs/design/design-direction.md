# Passayge design direction

Status: proposal for the Phase 2 design checkpoint.
Mockups: `docs/design/mockups/mock.html` (open in a browser; query parameters `screen=chart|log`, `palette=a|b|c`, `theme=light|dark`, `help=1`, `access=none`). Screenshots: `docs/design/screens/`, palette comparison: `docs/design/palettes.png`.

## What the screen has to say at a glance

1. Who the patient is: the banner, family name first in capitals, date of birth with age, synthetic SVNR, and a "Synthetic" tag.
2. Whether I may look: one access block in the banner, top right, worded as a sentence ("Access granted, 2 of 3 functions"), with an icon and a colour.
3. What is abnormal: flags in the document list ("4 results out of range") and in the results, always icon plus word.

Everything else is secondary and quieter.

## Typeface

**Atkinson Hyperlegible Next**, with its sibling **Atkinson Hyperlegible Mono** only for raw HTTP and JSON in the network log. One family, self-hosted (SIL OFL), so no request leaves the sandbox for fonts.

Zeros (approved at the checkpoint): a slashed zero only in identifiers (SVNR, transaction numbers, document IDs); plain zeros in dates, times and clinical values. The font has only a slashed zero and no `zero` feature, so Passayge ships **Passayge Text**: static 400, 600 and 700 instances of Atkinson Hyperlegible Next with the zero's slash removed and one counter drawn from the outer contour (`scripts/fonts/plainzero.py`). The OFL permits modified versions; the font declares no Reserved Font Name, and the derived font is renamed anyway. Interface text uses Passayge Text; elements marked as identifiers switch to the original font.

Why: it was designed by the Braille Institute so that easily confused characters stay apart: 0 and O, 1 and l and I, 5 and S, 8 and B. Clinical screens are full of exactly these: SVNRs, dosages, dates, IDs. It reads calmly at 14 px for long sessions, and it has a real `tnum` feature, which is switched on for every clinical value, date, time and ID. It is not a default UI face, so it also gives Passayge its own voice.

## Type scale

| Role | Size / line height | Weight |
|---|---|---|
| Meta, column headers, sources | 12 / 16 | 400, 600 for headers |
| Interface text, table cells | 14 / 20 | 400, 600 for emphasis |
| Section titles, reading text in documents | 16 / 24 | 700 for titles |
| Patient name | 20 / 28 | 700 |

Four sizes only. Hierarchy comes from weight and position, not from more sizes. Sentence case everywhere; no all-caps labels except the family name in the banner, which is a clinical convention.

## Spacing and grid

4 px base: 4, 8, 12, 16, 20, 24, 32, 48. Shell: 48 px top bar, 248 px side column, then a two-column work area (360 px contact confirmation, the rest for documents). Tablet (below 1100 px): the side column becomes a top navigation row and the work area stacks. Left-aligned text throughout; numbers in tables are tabular so they line up.

Borders and dividers instead of shadows. The only shadows are on things that float above the page: tooltips and the tour card.

## Palettes

All three pass WCAG AA in light and dark for text, accent and status colours (checked: text 15:1 or more, muted 5.9:1 or more, accent 5.9:1 or more, status 5.0:1 or more on both background and surface). Input borders use a separate stronger token for the 3:1 non-text rule.

| | Accent light / dark | Secondary | Neutral | Idea |
|---|---|---|---|---|
| A. Raspberry ledger | `#9B1B4A` / `#F28DB2` | slate `#3A4652` | cool grey `#F5F6F7`, `#D3D8DD`, text `#161D24` | The stamp in a ledger: one ink colour for "you act here", everything else is record. |
| B. Sienna stamp | `#9E4316` / `#F2A47A` | deep slate `#2F4350` | warm grey `#F6F5F3`, `#D9D4CE`, text `#1D1A17` | Archive paper and a rubber stamp, warmer and calmer. |
| **C. Graphite signal** (chosen) | `#27313B` / `#DCE3E9` | steel `#5A6976` | cool grey `#F4F5F6`, `#D2D7DC`, text `#14191E` | No brand colour at all: colour is reserved for meaning. |

Chosen: C (changed after the checkpoint). Another of Henry's products uses a magenta accent very close to A's raspberry, and sibling products must not share an accent. C keeps colour for status and meaning only. Links are graphite, close to the text colour, so they keep a permanent underline.

Contrast for C (checked again after the change), light / dark: text 17.7 / 15.4; muted 6.4 / 7.4 (5.4 / 6.1 on a selected row); links 13.2 / 14.5; ink button label 17.7 / 15.4; input borders 3.8 / 4.1; focus ring 13.2 / 14.5; selection edge on a selected row 11.2 / 11.9; status chips 4.8 to 5.7 / 6.7 to 8.2. All pass WCAG AA.

Original reasoning for A, kept for the record: it is the only one that stays distinct inside your portfolio icon family (blue `#1d4ed8`, green `#047857`, amber `#b45309`, purple `#6d28d9`, grey `#3f4a55`). B sits next to the amber group and next to the "expired" status. C sits next to the grey group. Not purple, not wardkit's blue, not Wardread's teal (`#0d6e66`).

Accent use (approved at the checkpoint, kept for C): the accent is only for selection, the active tab and navigation item, the focus ring and links. Primary buttons are solid ink (the text colour) with a white label in light mode and the inverse in dark mode, so the main action never sits next to the Denied and abnormal reds in the same hue family. Contrast: ink button label 17.0:1 (light) and 15.0:1 (dark); the focus ring sits 2 px off the control against the page background, 7.9:1 (light) and 8.1:1 (dark).

Shared status colours, same in every palette:

| Status | Icon | Light / dark |
|---|---|---|
| Granted | open lock | `#17703A` / `#5DCB86` |
| Denied | closed lock | `#B3261E` / `#FF8E86` |
| Expired | clock with alert | `#8A5300` / `#F0B455` |
| Entered in error | slashed circle, text struck through | `#5F6B76` / `#A6B1BB` |
| Recorded | check | secondary colour |

## Component principles

- **One status vocabulary.** The five statuses above look and read the same in the banner, the contact panel, the document list, the audit log and the network log.
- **Every rule shows its source.** Access decisions carry the paragraph that produced them (§ 18 Abs. 6, § 21 Abs. 2, § 24f Abs. 2) as a link.
- **Simplifications are labelled where they happen**, in a quiet bordered note ("Simplified. One sandbox service stands in for...").
- **Every FHIR call names its ELGA counterpart**, on the same line ("ITI-68 Retrieve Document. In ELGA: ITI-43 Retrieve Document Set").
- **Terms are dotted-underlined** and open a one- or two-sentence explanation on hover, focus or tap; Escape closes it.
- **The tour never blocks**: no dimmed overlay, the card points at one control, "Skip tour" is always there.
- **Empty and locked states say what to do next** ("Insert the e-card to request access") and what did not happen ("The search was not sent").
- **Selection is neutral grey with an accent edge**, never a tinted pink row that could read as an alert.
- **Motion** (build phase): the lock in the access block opens (150 ms) when access is granted, and a new audit row slides in (120 ms). Nothing else moves; both are off with reduced motion.

The one bold element is the **access window bar**: every function on one 90-day scale, a "Today" marker, so you see at once that documents have two thirds left while the 28-day vaccination window ended this morning.

## References and what I take from each

- **NHS design system**: plain-language labels, error and empty messages that tell you what to do next, and visible focus. From its patient-banner guidance: identity first, always in the same place, family name in capitals.
- **Patient banner conventions (UK and Austrian hospital systems)**: a fixed strip with name, date of birth with age, gender and identifier; status of the record sits in the banner, not in a toast.
- **Linear**: density without noise, single-key navigation (`/` to search, `G P`, `G L`, `J` and `K` to move through the log), keyboard hints shown next to the control, neutral selection.
- **Stripe docs**: explaining a complicated flow next to the real request. The network log pairs each request with the ELGA transaction it stands in for, the way Stripe pairs prose with the API call.

## wardkit

wardkit's components read shadcn variable names (`--card`, `--muted-foreground`, `--border`). Passayge maps its tokens onto those names, so `LabResult` and the `PatientBanner` helpers (`pickName`, `formatName`, `ageOn`) render in Passayge's palette without edits to wardkit. The banner layout itself is Passayge's own, because the access block has to live inside it.

Later wardkit change (not done now, wardkit is untouched): add an optional access slot to `PatientBanner` (for example an `aside` prop rendered at the trailing edge) so a consumer can place an access or alert block inside the banner without re-implementing it. Passayge's banner would then switch to wardkit's.

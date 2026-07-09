/**
 * Competitor comparison data — VERIFIED against each vendor's public pricing
 * and feature pages on the date in `CHECKED_ON` (see sources). Neutral,
 * nominative trademark use only. Unverifiable cells use 'dash' or 'varies' —
 * never invented. Numbers for the career-ops-ui column come from
 * src/generated/facts.json at build time.
 *
 * Sources (checked 2026-07-10):
 *  - Jobscan:  https://app.jobscan.co/plan  (free: 5 scans/mo; Premium $49.95/mo or $89.95/quarter)
 *  - Teal:     https://www.tealhq.com/pricing + https://help.tealhq.com/en/articles/9530153-teal-vs-teal
 *              (free plan; Teal+ $13/wk, $29/mo or $79/quarter; match score + unlimited AI on Teal+)
 *  - Huntr:    https://huntr.co/pricing  (free: 100 tracked jobs, 2 tailored resumes; Pro $40/mo)
 *  - Rezi:     https://www.rezi.ai/pricing  (free: 1 resume, 3 PDF downloads; Pro $29/mo; $149 lifetime)
 */
export const CHECKED_ON = '2026-07-10';

export const SOURCES = [
  { name: 'Jobscan', url: 'https://app.jobscan.co/plan' },
  { name: 'Teal', url: 'https://www.tealhq.com/pricing' },
  { name: 'Huntr', url: 'https://huntr.co/pricing' },
  { name: 'Rezi', url: 'https://www.rezi.ai/pricing' },
];

/** A table cell: either a dict key (translated), literal text, or a mark. */
export interface Cell {
  /** 'yes' → ✓, 'no' → ✗, 'dash' → —, 'key' → t(key), 'text' → literal */
  kind: 'yes' | 'no' | 'dash' | 'key' | 'text';
  key?: string;
  text?: string;
  /** optional secondary dict key rendered smaller (e.g. "Paid plan") */
  subKey?: string;
}

const yes = (subKey?: string): Cell => ({ kind: 'yes', subKey });
const no = (): Cell => ({ kind: 'no' });
const dash = (): Cell => ({ kind: 'dash' });
const key = (k: string, subKey?: string): Cell => ({ kind: 'key', key: k, subKey });
const text = (s: string, subKey?: string): Cell => ({ kind: 'text', text: s, subKey });

export interface Row {
  labelKey: string;
  /** cells: [career-ops-ui, Jobscan, Teal, Huntr, Rezi] */
  cells: readonly [Cell, Cell, Cell, Cell, Cell];
}

export const COMPETITORS = ['Jobscan', 'Teal', 'Huntr', 'Rezi'] as const;

export function buildRows(adapters: number, locales: number): Row[] {
  return [
    {
      labelKey: 'compare.row.price',
      cells: [
        key('compare.val.free'),
        text('$49.95/mo', 'compare.val.limited'),
        text('$29/mo', 'compare.val.limited'),
        text('$40/mo', 'compare.val.limited'),
        text('$29/mo', 'compare.val.limited'),
      ],
    },
    {
      labelKey: 'compare.row.oss',
      cells: [yes(), no(), no(), no(), no()],
    },
    {
      labelKey: 'compare.row.data',
      cells: [
        key('compare.val.yourMachine'),
        key('compare.val.vendorCloud'),
        key('compare.val.vendorCloud'),
        key('compare.val.vendorCloud'),
        key('compare.val.vendorCloud'),
      ],
    },
    {
      labelKey: 'compare.row.offline',
      cells: [yes(), no(), no(), no(), no()],
    },
    {
      labelKey: 'compare.row.scan',
      cells: [key('compare.val.adapters'), dash(), dash(), yes('compare.val.paidPlan'), yes()],
    },
    {
      labelKey: 'compare.row.score',
      cells: [yes(), yes(), yes('compare.val.paidPlan'), yes('compare.val.paidPlan'), yes()],
    },
    {
      labelKey: 'compare.row.tailor',
      cells: [yes(), yes('compare.val.paidPlan'), yes('compare.val.paidPlan'), yes('compare.val.paidPlan'), yes()],
    },
    {
      labelKey: 'compare.row.cover',
      cells: [yes(), yes('compare.val.paidPlan'), yes('compare.val.paidPlan'), yes('compare.val.paidPlan'), yes()],
    },
    {
      labelKey: 'compare.row.tracker',
      cells: [yes(), yes(), yes(), yes(), dash()],
    },
    {
      labelKey: 'compare.row.interview',
      cells: [yes(), dash(), dash(), dash(), yes()],
    },
    {
      labelKey: 'compare.row.limits',
      cells: [
        key('compare.val.unlimited'),
        key('compare.val.limited'),
        key('compare.val.limited'),
        key('compare.val.limited'),
        key('compare.val.limited'),
      ],
    },
    {
      labelKey: 'compare.row.langs',
      cells: [
        key('compare.val.langs'),
        key('compare.val.varies'),
        key('compare.val.varies'),
        key('compare.val.varies'),
        key('compare.val.varies'),
      ],
    },
    {
      labelKey: 'compare.row.account',
      cells: [key('compare.val.no'), key('compare.val.yes'), key('compare.val.yes'), key('compare.val.yes'), key('compare.val.yes')],
    },
  ];
}

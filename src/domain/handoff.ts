// Reading the SDTM Mapping Trainer's hand-off: one zip with handoff.json (the manifest) and every
// SDTM dataset as Dataset-JSON v1.1 (datasets/<name>.json), plus XPT and define.xml.
import { unzipSync, strFromU8 } from 'fflate'

export interface Column { name: string; label?: string; dataType: string; itemOID?: string }
export interface Dataset { name: string; label: string; columns: Column[]; rows: unknown[][] }
export interface Handoff {
  study: { id: string; title: string }
  standards: Record<string, string>
  datasets: Dataset[]
  validation?: { mustFix: number; open: number; explained: number }
  producer?: { app: string; project: string }
}

export function readHandoff(bytes: Uint8Array): Handoff {
  const files = unzipSync(bytes)
  const mf = files['handoff.json']
  if (!mf) throw new Error('This zip has no handoff.json: export the hand-off from the SDTM Mapping Trainer (Datasets, Hand-off to the TLF Programming Lab).')
  const m = JSON.parse(strFromU8(mf))
  if (m.format !== 'sdtm-trainer-handoff') throw new Error('handoff.json is not an SDTM Mapping Trainer hand-off.')
  const datasets: Dataset[] = []
  for (const d of m.datasets as { name: string; label: string; files: { json: string } }[]) {
    const f = files[d.files.json]
    if (!f) continue
    const j = JSON.parse(strFromU8(f))
    datasets.push({ name: d.name, label: d.label, columns: j.columns, rows: j.rows })
  }
  return { study: m.study, standards: m.standards, datasets, validation: m.validation, producer: m.producer }
}

const cell = (v: unknown) => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
// A dataset as CSV text and the R column classes to read it with.
export function toCsv(d: Dataset): { csv: string; classes: Record<string, string> } {
  const classes: Record<string, string> = {}
  for (const c of d.columns) classes[c.name] = ['integer', 'float', 'double', 'decimal'].includes(c.dataType) ? 'numeric' : 'character'
  const csv = [d.columns.map((c) => c.name).join(','), ...d.rows.map((r) => r.map(cell).join(','))].join('\n') + '\n'
  return { csv, classes }
}

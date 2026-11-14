// Log review after a batch run, the way programming teams scan their logs before an output goes
// to QC: errors, warnings, notes (R messages and suspicious coercions), an output that was not
// created or has no records, and the program header every company's standard operating procedure
// asks for (program, purpose, author, inputs, outputs, modification history).
export interface LogItem { level: 'ERROR' | 'WARNING' | 'NOTE'; text: string }
export const HEADER_FIELDS = ['Program', 'Purpose', 'Author', 'Inputs', 'Outputs', 'Modification history'] as const
export function headerTemplate(file: string, purpose: string, inputs: string[], output: string) {
  const d = new Date().toISOString().slice(0, 10)
  return `# Program:  ${file}\n# Purpose:  ${purpose}\n# Author:   <your name>\n# Inputs:   ${inputs.join(', ')}\n# Outputs:  ${output}\n# Modification history: ${d} first version\n`
}
export function headerMissing(code: string): string[] {
  const top = code.split('\n').filter((l) => l.trim().startsWith('#')).slice(0, 12).join('\n')
  return HEADER_FIELDS.filter((f) => !new RegExp(`^#\\s*${f}\\s*:`, 'im').test(top))
}
export function scanLog(r: { ok: boolean; error?: string; output: { type: string; text: string }[]; rows?: number }, code: string): LogItem[] {
  const items: LogItem[] = []
  if (!r.ok) items.push({ level: 'ERROR', text: r.error ?? 'The program stopped.' })
  for (const o of r.output) {
    const t = o.text.trim()
    if (!t) continue
    if (o.type === 'warning') items.push({ level: 'WARNING', text: t })
    else if (o.type === 'error' && !items.some((i) => i.level === 'ERROR')) items.push({ level: 'ERROR', text: t })
    else if (o.type === 'message' && !/^Error: /.test(t)) items.push({ level: 'NOTE', text: t })
    else if (/NAs introduced by coercion|longer object length is not a multiple/i.test(t)) items.push({ level: 'WARNING', text: t })
  }
  if (r.ok && r.rows === 0) items.push({ level: 'WARNING', text: 'The output has no records.' })
  const miss = headerMissing(code)
  if (miss.length) items.push({ level: 'NOTE', text: `Program header incomplete: no ${miss.join(', ')}.` })
  if (/\b(setwd|install\.packages|rm\(list)/.test(code)) items.push({ level: 'NOTE', text: 'Environment-changing call in the program (setwd, install.packages or rm(list = ...)).' })
  return items
}
export const logClean = (items: { level: string; text: string }[]) => !items.some((i) => i.level !== 'NOTE') && !items.some((i) => i.text.startsWith('Program header'))

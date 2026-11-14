// A study pack: one fictional study's programs (specifications, starter code and independent
// reference programs), its treatment groups and how its displays are drawn.
import type { Frame } from '../runner'
import type { Display } from '../display'

export type Kind = 'dataset' | 'ard' | 'listing' | 'figure'
export type Area = 'ADaM' | 'Safety' | 'Efficacy' | 'Listings' | 'Figures'
export interface SpecRow { name: string; label: string; derivation: string }
export interface Program {
  id: string; title: string; kind: Kind; output: string; keys: string[]; ref: string; area: Area
  needs: string[]            // reference outputs loaded before this program runs (the validated upstream datasets)
  spec: SpecRow[]; intro: string; starter: string; reference: string
  shell?: string             // the mock shell from the SAP (tables)
}
export interface StudyPack {
  id: string; short: string; title: string; sap: string
  groups: string[]            // treatment groups in display order (Total is added where a display has one)
  programs: Program[]
  displays: Record<string, (f: Frame) => Display>
}

export const ARD_SPEC: SpecRow[] = [
  { name: 'ANALYSIS', label: 'Analysis', derivation: 'Which analysis the row belongs to (for example AGE, SEX, SOC).' },
  { name: 'GROUP', label: 'Treatment group', derivation: 'The column of the display: a treatment group or Total.' },
  { name: 'CATEGORY', label: 'Category', derivation: 'The category within the analysis (for example F, or a system class), NA when there is none.' },
  { name: 'STAT', label: 'Statistic', derivation: 'n, pct, mean, sd, median, min, max, est, se, lcl, ucl, p, N.' },
  { name: 'VALUE', label: 'Value', derivation: 'The unrounded number. Rounding happens only when the display is drawn.' },
]
export const ARD_KEYS = ['ANALYSIS', 'GROUP', 'CATEGORY', 'STAT']
// The ARD helper every table program starts with.
export const ARD_HEAD = 'rows <- list()\nadd <- function(an, g, cat, st, v) rows[[length(rows) + 1]] <<- data.frame(ANALYSIS = an, GROUP = g, CATEGORY = cat, STAT = st, VALUE = v, stringsAsFactors = FALSE)\n'

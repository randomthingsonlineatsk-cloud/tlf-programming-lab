// Code review without running: a colleague's ADAE program, read line by line. The learner marks
// the lines that are wrong and says what kind of problem each is. Experienced reviewers catch
// these before the program ever runs: values typed into code, joins that lose records, filters
// that drop rows silently, sorts that are not unique, populations that are not the specified one.
export const REVIEW_CATEGORIES = [
  { id: 'hard', label: 'Hard-coded value' },
  { id: 'merge', label: 'Wrong merge or join' },
  { id: 'loss', label: 'Silent loss of records' },
  { id: 'sort', label: 'Sort key not unique or missing' },
  { id: 'spec', label: 'Does not follow the specification' },
] as const
export type ReviewCategory = typeof REVIEW_CATEGORIES[number]['id']

export const REVIEW_PROGRAM = [
  '# Program:  adae.R',
  '# Purpose:  ADAE for GLV-12-301 (SAP v2.0, section 9.4)',
  '# Author:   J. Rivera (production)',
  '# Inputs:   ae, adsl     Outputs: adae',
  '# Modification history: 2026-10-02 first version',
  '',
  'adae <- merge(ae, adsl[adsl$SAFFL == "Y", c("USUBJID", "TRT01A", "TRT01AN", "TRTSDT", "TRTEDT", "SAFFL")], by = "USUBJID")',
  'adae$ASTDT <- as.Date(substr(adae$AESTDTC, 1, 10))',
  'adae$AENDT <- as.Date(substr(adae$AEENDTC, 1, 10))',
  'adae <- adae[!is.na(adae$ASTDT), ]',
  'adae$TRTEDT[adae$USUBJID == "GLV-12-301-105-006"] <- as.Date("2026-08-01")',
  'adae$ASTDY <- as.numeric(adae$ASTDT - adae$TRTSDT) + 1',
  'adae$TRTEMFL <- ifelse(adae$ASTDT >= adae$TRTSDT & adae$ASTDT <= adae$TRTEDT + 30, "Y", "N")',
  'adae <- adae[order(adae$USUBJID), ]',
  'adae <- adae[, c("STUDYID", "USUBJID", "AESEQ", "AETERM", "AEDECOD", "AEBODSYS", "AESEV", "AESER", "AEREL",',
  '                 "TRT01A", "TRT01AN", "SAFFL", "ASTDT", "AENDT", "ASTDY", "TRTEMFL")]',
]
// Line numbers are 1-based.
export const REVIEW_KEY: { line: number; cat: ReviewCategory; why: string }[] = [
  { line: 7, cat: 'merge', why: 'An inner join on the safety population drops the adverse events of participants who were never dosed, and of screen failures. The specification keeps every AE record (all.x = TRUE) and lets TRTEMFL and SAFFL do the selecting.' },
  { line: 8, cat: 'spec', why: 'Partial start dates (YYYY-MM) become NA here: the specification imputes them (first dose date in the same month, otherwise the first of the month) and sets ASTDTF.' },
  { line: 10, cat: 'loss', why: 'Rows with a missing ASTDT are dropped without a message, so the AE with the partial date disappears from ADAE and from every table.' },
  { line: 11, cat: 'hard', why: 'A last-dose date typed into the program: the source must be corrected (a data query) or the derivation documented in the specification, never patched in code.' },
  { line: 12, cat: 'spec', why: 'Study day has no day 0: before the first dose it is ASTDT - TRTSDT, without the + 1.' },
  { line: 14, cat: 'sort', why: 'USUBJID alone does not identify a record; the specification sorts by USUBJID and AESEQ.' },
]

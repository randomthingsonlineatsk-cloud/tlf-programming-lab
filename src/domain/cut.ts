// Data cuts: the blinded dry run on dummy treatment codes, the final run after unblinding, and a
// second data transfer after database changes. The changes are applied to the SDTM in R right
// after loading, before the reference programs run, so the comparison with the reference stays fair.
export type Phase = 'dry' | 'final'
export interface Cut { phase: Phase; transfer: 1 | 2 }
export const DEFAULT_CUT: Cut = { phase: 'final', transfer: 1 }
export const cutLabel = (c: Cut) => `${c.phase === 'dry' ? 'Dry run (dummy treatment codes)' : 'Unblinded'} · transfer ${c.transfer}`
export const cutKey = (c: Cut) => `${c.phase}-${c.transfer}`

// Dummy randomisation: the treatment of the randomised participants is shuffled with a fixed seed,
// so programs can be written and checked on the real data structure without seeing the real effect.
export const DUMMY_R = String.raw`
local({
  i <- which(!is.na(dm$ARMCD) & !is.na(dm$ACTARMCD) & dm$ACTARM != "")
  set.seed(4242); j <- i[sample.int(length(i))]
  for (v in c("ARMCD", "ARM", "ACTARMCD", "ACTARM")) dm[[v]][i] <<- dm[[v]][j]
  if (exists("ex")) { ex$EXTRT <<- "BLINDED"; ex$EXDOSE <<- NA }
})
`
// Transfer 2 of GLV-12-301: what changed in the database after transfer 1.
export const TRANSFER2: Record<string, { r: string; changes: string[] }> = {
  'GLV-12-301': {
    changes: [
      'A late-reported adverse event: light-headedness for GLV-12-301-101-002 from 3 to 5 June 2026.',
      'A query on GLV-12-301-101-001: the Week 26 HbA1c was corrected after the laboratory re-reported it (+0.4%).',
      'The partial start date of GLV-12-301-104-003\'s diarrhoea was completed by the site: 11 February 2026, three days before the first dose.',
    ],
    r: String.raw`
local({
  tpl <- ae[ae$AEDECOD %in% "Light-headedness", ][1, ]
  tpl$USUBJID <- "GLV-12-301-101-002"; tpl$AESEQ <- max(ae$AESEQ[ae$USUBJID == "GLV-12-301-101-002"], 0) + 1
  tpl$AESTDTC <- "2026-06-03"; tpl$AEENDTC <- "2026-06-05"; tpl$AESER <- "N"; tpl$AESEV <- "MILD"
  if ("AESPID" %in% names(tpl)) tpl$AESPID <- NA
  if ("AESTDY" %in% names(tpl)) tpl$AESTDY <- NA
  if ("AEENDY" %in% names(tpl)) tpl$AEENDY <- NA
  ae <<- rbind(ae, tpl)
  k <- which(lb$USUBJID == "GLV-12-301-101-001" & lb$LBTESTCD == "HBA1C" & lb$VISITNUM == 9)
  lb$LBSTRESN[k] <<- lb$LBSTRESN[k] + 0.4
  lb$LBSTRESC[k] <<- as.character(lb$LBSTRESN[k]); lb$LBORRES[k] <<- as.character(lb$LBSTRESN[k])
  ae$AESTDTC[ae$USUBJID == "GLV-12-301-104-003" & ae$AESTDTC == "2026-02"] <<- "2026-02-11"
})
`,
  },
}

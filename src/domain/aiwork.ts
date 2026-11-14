// Validating an AI-written program. A (simulated) coding assistant has drafted Table 14.3.1 from
// the specification. The learner reviews and runs the draft, logs what is wrong, fixes it until it
// matches the independent reference, and records the use of AI the way the FDA's draft guidance on
// AI to support regulatory decision-making (January 2025) and the EMA-FDA good AI practice
// principles (January 2026) expect: context of use, risk, and how the output was verified.
export const AI_MODEL_CARD = {
  name: 'Draft-R assistant (simulated, training only)',
  contextOfUse: 'Drafts statistical programs from a written specification. Output is a draft: a qualified programmer reviews, tests and is accountable for it.',
  limits: ['Not trained on this study or its SAP; it does not see the data.', 'Can follow common patterns that do not match this specification (populations, denominators, counting units).', 'Gives no warning when it is unsure.'],
  risk: 'Model influence high (it writes the program); decision consequence medium (a table in the clinical study report, independently checked). Overall: medium. Required: full independent QC of the output.',
}

export const AI_DRAFT = String.raw`# Table 14.3.1 - drafted by the assistant from the specification
# Participants with TEAEs by system class and preferred term

pop <- adsl[adsl$RANDFL == "Y", ]
te  <- adae[adae$TRTEMFL == "Y", ]
groups <- c("Placebo", "GLV-12 5 mg", "GLV-12 10 mg", "Total")
rows <- list()
add <- function(an, g, cat, st, v) rows[[length(rows) + 1]] <<- data.frame(ANALYSIS = an, GROUP = g, CATEGORY = cat, STAT = st, VALUE = v, stringsAsFactors = FALSE)
te <- merge(te, adsl[, c("USUBJID", "TRT01P")], by = "USUBJID")
for (g in groups) {
  N <- if (g == "Total") nrow(pop) else sum(pop$TRT01P == g)
  d <- if (g == "Total") te else te[te$TRT01P == g, ]
  add("POP", g, NA, "N", N)
  k <- length(unique(d$USUBJID)); add("ANY", g, NA, "n", k); add("ANY", g, NA, "pct", 100 * k / N)
  for (soc in sort(unique(te$AEBODSYS))) {
    k <- sum(d$AEBODSYS == soc); add("SOC", g, soc, "n", k); add("SOC", g, soc, "pct", 100 * k / N)
    for (pt in sort(unique(te$AEDECOD[te$AEBODSYS == soc]))) {
      k <- length(unique(d$USUBJID[d$AEBODSYS == soc & d$AEDECOD == pt]))
      add("PT", g, paste(soc, pt, sep = " | "), "n", k); add("PT", g, paste(soc, pt, sep = " | "), "pct", 100 * k / N)
    }
  }
}
ard_t2 <- do.call(rbind, rows)
`

export interface AiIssue { id: string; text: string; real: boolean; why: string }
export const AI_ISSUES: AiIssue[] = [
  { id: 'A1', text: 'Denominators come from the randomised population instead of the safety population.', real: true, why: 'The SAP defines safety tables on SAFFL "Y". GLV-12-301-103-007 was randomised but never dosed, so N is one too high.' },
  { id: 'A2', text: 'Participants are grouped by planned treatment (TRT01P) instead of actual treatment (TRT01A).', real: true, why: 'Safety analyses use actual treatment. GLV-12-301-102-009 was randomised to 10 mg but received 5 mg.' },
  { id: 'A3', text: 'The system class rows count events, not participants.', real: true, why: 'sum() counts records; a participant with two events in one class is counted twice. The table counts participants (unique USUBJID).' },
  { id: 'A4', text: 'The TEAE selection does not also require SAFFL "Y".', real: false, why: 'Not a discrepancy here: TRTEMFL "Y" already requires a first dose date, so every TEAE belongs to a dosed participant. Adding the filter is harmless and some teams do it for clarity.' },
  { id: 'A5', text: 'The system classes are sorted alphabetically instead of by frequency.', real: false, why: 'Display order is applied when the table is drawn; the analysis results carry no order.' },
  { id: 'A6', text: 'Percentages are not rounded.', real: false, why: 'Analysis results stay unrounded; rounding happens only in the display.' },
]
export const AI_RECORD_FIELDS = [
  { id: 'context', label: 'Context of use: what the assistant was used for in this output' },
  { id: 'verify', label: 'How the output was verified before use' },
  { id: 'changes', label: 'What you changed in the draft, and why' },
] as const

// Independent double programming. The production programmer has delivered Table 14.3.1; the QC
// programmer writes the same table independently from the specification, compares the two
// outputs and logs each discrepancy with its root cause. The production program below has three
// planted errors; the QC log is graded against them.
export const PROD_T2 = String.raw`
pop <- adsl[adsl$RANDFL == "Y", ]                        # population
te  <- adae[adae$TRTEMFL == "Y" & adae$SAFFL == "Y", ]
te  <- merge(te, adsl[, c("USUBJID", "TRTEDT")], by = "USUBJID")
te  <- te[te$ASTDT <= te$TRTEDT, ]                         # treatment-emergent window
groups <- c("Placebo", "GLV-12 5 mg", "GLV-12 10 mg", "Total")
rows <- list()
add <- function(an, g, cat, st, v) rows[[length(rows) + 1]] <<- data.frame(ANALYSIS = an, GROUP = g, CATEGORY = cat, STAT = st, VALUE = v, stringsAsFactors = FALSE)
for (g in groups) {
  N <- if (g == "Total") nrow(pop) else sum(pop$TRT01A == g, na.rm = TRUE)
  d <- if (g == "Total") te else te[te$TRT01A == g, ]
  add("POP", g, NA, "N", N)
  k <- length(unique(d$USUBJID)); add("ANY", g, NA, "n", k); add("ANY", g, NA, "pct", 100 * k / N)
  for (soc in sort(unique(te$AEBODSYS))) {
    k <- length(unique(d$USUBJID[d$AEBODSYS == soc])); add("SOC", g, soc, "n", k); add("SOC", g, soc, "pct", 100 * k / N)
    for (pt in sort(unique(te$AEDECOD[te$AEBODSYS == soc]))) {
      k <- sum(d$AEBODSYS == soc & d$AEDECOD == pt)       # count
      add("PT", g, paste(soc, pt, sep = " | "), "n", k); add("PT", g, paste(soc, pt, sep = " | "), "pct", 100 * k / N)
    }
  }
}
prod_t2 <- do.call(rbind, rows)
`
export interface Finding { id: string; text: string; real: boolean; why: string }
export const FINDINGS: Finding[] = [
  { id: 'F1', text: 'Production uses the randomised population for the denominators (N), not the safety population.', real: true, why: 'The SAP defines the AE tables on the safety population (SAFFL "Y"); one randomised participant never took a dose, so the Total N is 81 instead of 80.' },
  { id: 'F2', text: 'Production drops treatment-emergent adverse events that started after the last dose.', real: true, why: 'The SAP window runs to 30 days after the last dose (TRTEDT + 30); production stops at TRTEDT and loses two events (a myocardial infarction and nausea).' },
  { id: 'F3', text: 'Production counts events, not participants, in the preferred-term rows.', real: true, why: 'sum() counts records; a participant with the same term twice is counted twice. The table counts participants (unique USUBJID).' },
  { id: 'F4', text: 'Production sorts the system classes alphabetically instead of by frequency.', real: false, why: 'Sorting is a display rule applied when the table is drawn; the analysis results do not carry an order, so this is not a discrepancy in the results.' },
  { id: 'F5', text: 'Production rounds percentages to one decimal before storing them.', real: false, why: 'Production stores unrounded values, as the QC program does; the values that differ do so because of the three real errors.' },
  { id: 'F6', text: 'Production uses planned treatment (TRT01P) instead of actual treatment.', real: false, why: 'Production groups by TRT01A, as specified. (One participant in the safety population did receive a different treatment from the one planned, which is why safety tables use actual treatment.)' },
]

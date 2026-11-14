// Information requests from the (fictional) review division. Each asks for a number or a list
// the learner computes in R from the validated analysis datasets; the lab computes the expected
// answer with its own code on the same data. Each has a response clock, as a real request does.
export interface InfoRequest {
  id: string; subject: string; question: string; dueMinutes: number; kind: 'numbers' | 'ids'
  hint: string; reference: string   // R code that creates `answer` from the validated datasets
}
export const IRS: InfoRequest[] = [
  { id: 'IR1', subject: 'Primary analysis without site 103', dueMinutes: 25, kind: 'numbers',
    question: 'Site 103 had a GCP inspection finding. Please repeat the primary analysis (ANCOVA of the Week 26 change in HbA1c, observed cases) without the participants of site 103, and give the difference of GLV-12 10 mg from placebo and its 95% confidence interval (3 numbers: estimate, lower, upper).',
    hint: 'SITEID is in ADSL; merge it onto ADLB.',
    reference: String.raw`d <- merge(adlb[adlb$AVISITN == 26 & !is.na(adlb$CHG), ], adsl[, c("USUBJID", "SITEID")], by = "USUBJID")
d <- d[d$SITEID != "103", ]
d$TRT <- factor(d$TRT01PN, levels = 1:3, labels = c("Placebo", "GLV-12 5 mg", "GLV-12 10 mg"))
fit <- lm(CHG ~ TRT + BASE, data = d)
answer <- c(coef(fit)[["TRTGLV-12 10 mg"]], confint(fit)["TRTGLV-12 10 mg", ])` },
  { id: 'IR2', subject: 'Different N in two tables', dueMinutes: 15, kind: 'ids',
    question: 'Table 14.1.1 reports 81 randomised participants and Table 14.3.1 a safety population of 80. Please identify each participant counted in one population and not the other (their USUBJIDs).',
    hint: 'Randomised but not in the safety population.',
    reference: String.raw`answer <- adsl$USUBJID[adsl$RANDFL == "Y" & adsl$SAFFL != "Y"]` },
  { id: 'IR3', subject: 'Liver signal', dueMinutes: 20, kind: 'numbers',
    question: 'Please give the number of participants with ALT above the upper limit of normal at any post-baseline visit, by actual treatment (3 numbers in the order placebo, 5 mg, 10 mg), and confirm whether any participant exceeded 3 times the upper limit.',
    hint: 'ADLBC: PARAMCD "ALT", AVISITN > 0, AVAL > ANRHI; count participants, not records.',
    reference: String.raw`x <- adlbc[adlbc$PARAMCD == "ALT" & adlbc$AVISITN > 0 & !is.na(adlbc$AVAL) & adlbc$AVAL > adlbc$ANRHI, ]
answer <- sapply(c("Placebo", "GLV-12 5 mg", "GLV-12 10 mg"), function(g) length(unique(x$USUBJID[x$TRT01A == g])))` },
  { id: 'IR4', subject: 'Imputed adverse event dates', dueMinutes: 15, kind: 'ids',
    question: 'Please list the participants with a treatment-emergent adverse event whose start date was imputed (their USUBJIDs).',
    hint: 'ADAE: ASTDTF is not missing and TRTEMFL "Y".',
    reference: String.raw`answer <- unique(adae$USUBJID[!is.na(adae$ASTDTF) & adae$TRTEMFL == "Y"])` },
  { id: 'IR5', subject: 'Per-protocol sensitivity analysis', dueMinutes: 25, kind: 'numbers',
    question: 'Please repeat the primary analysis on participants who received at least 150 days of treatment, and give the difference of GLV-12 5 mg and of GLV-12 10 mg from placebo (2 numbers).',
    hint: 'TRTDURD in ADSL.',
    reference: String.raw`keep <- adsl$USUBJID[!is.na(adsl$TRTDURD) & adsl$TRTDURD >= 150]
d <- adlb[adlb$AVISITN == 26 & !is.na(adlb$CHG) & adlb$USUBJID %in% keep, ]
d$TRT <- factor(d$TRT01PN, levels = 1:3, labels = c("Placebo", "GLV-12 5 mg", "GLV-12 10 mg"))
answer <- unname(coef(lm(CHG ~ TRT + BASE, data = d))[c("TRTGLV-12 5 mg", "TRTGLV-12 10 mg")])` },
  { id: 'IR6', subject: 'Probability of no adverse event by Day 84', dueMinutes: 20, kind: 'numbers',
    question: 'From the Kaplan-Meier analysis of time to first treatment-emergent adverse event, please give the estimated probability of remaining free of a TEAE at Day 84 in each group (3 numbers: placebo, 5 mg, 10 mg).',
    hint: 'Product-limit estimate over event times up to and including day 84.',
    reference: String.raw`d <- adtte[adtte$PARAMCD == "TTAE", ]
answer <- sapply(c("Placebo", "GLV-12 5 mg", "GLV-12 10 mg"), function(g) { x <- d[d$TRT01A == g, ]; s <- 1
  for (u in sort(unique(x$AVAL[x$CNSR == 0 & x$AVAL <= 84]))) s <- s * (1 - sum(x$AVAL == u & x$CNSR == 0) / sum(x$AVAL >= u)); s })` },
]

export interface IrAnswer { openedUtc?: string; answeredUtc?: string; code: string; values?: string[]; correct?: boolean; letter: string; onTime?: boolean }
export const irStarter = (r: InfoRequest) => `# ${r.id}: ${r.subject}\n# The validated datasets are available: adsl, adae, adlb, adlbc, advs, adcm, adtte.\n# Create \`answer\` (${r.kind === 'ids' ? 'a character vector of USUBJIDs' : 'a numeric vector'}).\n\nanswer <- NA\n`

// Numbers match within 1e-6 relative (or 1e-9 absolute); ID lists match as sets.
export function sameAnswer(kind: InfoRequest['kind'], got: string[], want: string[]) {
  if (kind === 'ids') { const a = new Set(got.map((x) => x.trim())), b = new Set(want); return a.size === b.size && [...b].every((x) => a.has(x)) }
  if (got.length !== want.length) return false
  return got.every((g, i) => { const x = Number(g), y = Number(want[i]); return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= Math.max(1e-9, 1e-6 * Math.abs(y)) })
}

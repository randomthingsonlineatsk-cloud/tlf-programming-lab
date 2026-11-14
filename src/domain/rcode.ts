// The R side of the lab: the prelude that loads the SDTM hand-off into R, the programs a learner
// writes (with their specifications and starter code) and the independent reference programs the
// lab compares against. Base R only, so everything runs in webR without downloading packages.

// Run before every program: helpers for reading SDTM and for handing results back to the lab.
export const PRELUDE = String.raw`
.lab_dir <- "/home/web_user/sdtm"
read_sdtm <- function(name, classes) {
  f <- file.path(.lab_dir, paste0(tolower(name), ".csv"))
  utils::read.csv(f, colClasses = classes, na.strings = "", stringsAsFactors = FALSE, check.names = FALSE)
}
# A data frame as text columns for comparison: dates as YYYY-MM-DD, numbers to 10 significant digits.
.lab_chr <- function(df) {
  if (!is.data.frame(df)) stop("the program must create a data frame")
  out <- lapply(df, function(x) {
    if (inherits(x, "Date")) return(ifelse(is.na(x), NA_character_, format(x, "%Y-%m-%d")))
    if (is.factor(x)) x <- as.character(x)
    if (is.logical(x)) return(ifelse(is.na(x), NA_character_, ifelse(x, "TRUE", "FALSE")))
    if (is.numeric(x)) return(ifelse(is.na(x), NA_character_, formatC(signif(x, 10), digits = 10, format = "fg", flag = "")))
    as.character(x)
  })
  out <- lapply(out, trimws)
  as.data.frame(out, stringsAsFactors = FALSE, check.names = FALSE)
}
# The text columns packed into one string (columns split by \x1e, cells by \x1f, NA as \x15):
# one plain string crosses from R to JavaScript reliably whatever the data frame's attributes.
.lab_pack <- function(df) {
  x <- .lab_chr(df)
  cols <- vapply(x, function(v) paste(ifelse(is.na(v), "\x15", v), collapse = "\x1f"), "")
  paste(c(paste(names(x), collapse = "\x1f"), as.character(nrow(x)), cols), collapse = "\x1e")
}
`

export type Kind = 'dataset' | 'ard' | 'listing' | 'figure'
export interface SpecRow { name: string; label: string; derivation: string }
export interface Program {
  id: string; title: string; kind: Kind; output: string; keys: string[]; ref: string
  needs: string[]            // reference outputs loaded before this program runs (the validated upstream datasets)
  spec: SpecRow[]; intro: string; starter: string; reference: string
}

const ADSL_REF = String.raw`
trtn <- c("Placebo" = 1, "GLV-12 5 mg" = 2, "GLV-12 10 mg" = 3)
adsl <- data.frame(STUDYID = dm$STUDYID, USUBJID = dm$USUBJID, SUBJID = dm$SUBJID, SITEID = dm$SITEID,
                   AGE = dm$AGE, AGEU = dm$AGEU, SEX = dm$SEX, RACE = dm$RACE, ETHNIC = dm$ETHNIC, COUNTRY = dm$COUNTRY,
                   stringsAsFactors = FALSE)
adsl$AGEGR1  <- ifelse(adsl$AGE < 65, "<65", ">=65")
adsl$AGEGR1N <- ifelse(adsl$AGE < 65, 1, 2)
adsl$TRT01P  <- dm$ARM
adsl$TRT01PN <- unname(trtn[dm$ARM])
adsl$TRT01A  <- dm$ACTARM
adsl$TRT01AN <- unname(trtn[dm$ACTARM])
adsl$TRTSDT  <- as.Date(substr(dm$RFXSTDTC, 1, 10))
adsl$TRTEDT  <- as.Date(substr(dm$RFXENDTC, 1, 10))
adsl$TRTDURD <- as.numeric(adsl$TRTEDT - adsl$TRTSDT) + 1
adsl$RANDFL  <- ifelse(!is.na(dm$ARMCD), "Y", "N")
adsl$ITTFL   <- adsl$RANDFL
adsl$SAFFL   <- ifelse(adsl$RANDFL == "Y" & !is.na(adsl$TRTSDT), "Y", "N")
disp <- ds[ds$DSCAT == "DISPOSITION EVENT", c("USUBJID", "DSDECOD")]
dd <- disp$DSDECOD[match(adsl$USUBJID, disp$USUBJID)]
adsl$EOSSTT  <- ifelse(dd == "COMPLETED", "COMPLETED", "DISCONTINUED")
adsl$DCSREAS <- ifelse(dd == "COMPLETED", NA, dd)
hb <- lb[lb$LBTESTCD == "HBA1C" & lb$LBLOBXFL %in% "Y", ]
adsl$HBA1CBL <- hb$LBSTRESN[match(adsl$USUBJID, hb$USUBJID)]
`

const ADAE_REF = String.raw`
adae <- merge(ae, adsl[, c("USUBJID", "TRT01A", "TRT01AN", "TRTSDT", "TRTEDT", "SAFFL")], by = "USUBJID", all.x = TRUE)
adae$ASTDT  <- as.Date(substr(adae$AESTDTC, 1, 10))
adae$AENDT  <- as.Date(substr(adae$AEENDTC, 1, 10))
adae$ASTDY  <- ifelse(adae$ASTDT >= adae$TRTSDT, as.numeric(adae$ASTDT - adae$TRTSDT) + 1, as.numeric(adae$ASTDT - adae$TRTSDT))
adae$TRTEMFL <- ifelse(!is.na(adae$ASTDT) & !is.na(adae$TRTSDT) & adae$ASTDT >= adae$TRTSDT & adae$ASTDT <= adae$TRTEDT + 30, "Y", "N")
adae <- adae[order(adae$USUBJID, adae$AESEQ),
             c("STUDYID", "USUBJID", "AESEQ", "AETERM", "AEDECOD", "AEBODSYS", "AESEV", "AESER", "AEREL",
               "TRT01A", "TRT01AN", "SAFFL", "ASTDT", "AENDT", "ASTDY", "TRTEMFL")]
`

const ADLB_REF = String.raw`
hb <- lb[lb$LBTESTCD == "HBA1C", c("STUDYID", "USUBJID", "LBSEQ", "VISITNUM", "VISIT", "LBDTC", "LBSTRESN", "LBLOBXFL")]
adlb <- merge(hb, adsl[adsl$ITTFL == "Y", c("USUBJID", "TRT01P", "TRT01PN", "TRTSDT", "ITTFL")], by = "USUBJID")
adlb$PARAMCD <- "HBA1C"
adlb$PARAM   <- "Hemoglobin A1C (%)"
adlb$AVAL    <- adlb$LBSTRESN
adlb$ADT     <- as.Date(substr(adlb$LBDTC, 1, 10))
adlb$AVISITN <- c("1" = 0, "4" = 4, "6" = 12, "9" = 26)[as.character(adlb$VISITNUM)]
adlb$AVISIT  <- ifelse(adlb$AVISITN == 0, "BASELINE", paste("WEEK", adlb$AVISITN))
adlb$ABLFL   <- ifelse(adlb$LBLOBXFL %in% "Y", "Y", NA)
bl <- adlb[adlb$ABLFL %in% "Y", c("USUBJID", "AVAL")]
adlb$BASE    <- bl$AVAL[match(adlb$USUBJID, bl$USUBJID)]
adlb$CHG     <- ifelse(adlb$AVISITN > 0, adlb$AVAL - adlb$BASE, NA)
adlb$ANL01FL <- "Y"
adlb <- adlb[order(adlb$USUBJID, adlb$AVISITN),
             c("STUDYID", "USUBJID", "TRT01P", "TRT01PN", "ITTFL", "PARAMCD", "PARAM", "AVISIT", "AVISITN", "ADT",
               "AVAL", "ABLFL", "BASE", "CHG", "ANL01FL", "LBSEQ")]
`

// Tables are built as analysis results data (ARD): one row per result, the shape CDISC's
// Analysis Results Standard (2024) uses, so a display is a rendering of numbers already checked.
const T1_REF = String.raw`
pop <- adsl[adsl$SAFFL == "Y", ]
pop$GRP <- pop$TRT01A
groups <- c("Placebo", "GLV-12 5 mg", "GLV-12 10 mg", "Total")
rows <- list()
add <- function(an, g, cat, st, v) rows[[length(rows) + 1]] <<- data.frame(ANALYSIS = an, GROUP = g, CATEGORY = cat, STAT = st, VALUE = v, stringsAsFactors = FALSE)
for (g in groups) {
  d <- if (g == "Total") pop else pop[pop$GRP == g, ]
  n <- nrow(d)
  add("POP", g, NA, "N", n)
  add("AGE", g, NA, "n", sum(!is.na(d$AGE)))
  add("AGE", g, NA, "mean", mean(d$AGE)); add("AGE", g, NA, "sd", sd(d$AGE))
  add("AGE", g, NA, "median", median(d$AGE)); add("AGE", g, NA, "min", min(d$AGE)); add("AGE", g, NA, "max", max(d$AGE))
  for (v in c("AGEGR1", "SEX", "RACE")) for (cat in sort(unique(pop[[v]]))) {
    k <- sum(d[[v]] == cat, na.rm = TRUE)
    add(v, g, cat, "n", k); add(v, g, cat, "pct", 100 * k / n)
  }
}
ard_t1 <- do.call(rbind, rows)
`

const T2_REF = String.raw`
pop <- adsl[adsl$SAFFL == "Y", ]
te  <- adae[adae$TRTEMFL == "Y" & adae$SAFFL == "Y", ]
groups <- c("Placebo", "GLV-12 5 mg", "GLV-12 10 mg", "Total")
rows <- list()
add <- function(an, g, cat, st, v) rows[[length(rows) + 1]] <<- data.frame(ANALYSIS = an, GROUP = g, CATEGORY = cat, STAT = st, VALUE = v, stringsAsFactors = FALSE)
for (g in groups) {
  N <- if (g == "Total") nrow(pop) else sum(pop$TRT01A == g)
  d <- if (g == "Total") te else te[te$TRT01A == g, ]
  add("POP", g, NA, "N", N)
  k <- length(unique(d$USUBJID)); add("ANY", g, NA, "n", k); add("ANY", g, NA, "pct", 100 * k / N)
  for (soc in sort(unique(te$AEBODSYS))) {
    k <- length(unique(d$USUBJID[d$AEBODSYS == soc])); add("SOC", g, soc, "n", k); add("SOC", g, soc, "pct", 100 * k / N)
    for (pt in sort(unique(te$AEDECOD[te$AEBODSYS == soc]))) {
      k <- length(unique(d$USUBJID[d$AEBODSYS == soc & d$AEDECOD == pt]))
      add("PT", g, paste(soc, pt, sep = " | "), "n", k); add("PT", g, paste(soc, pt, sep = " | "), "pct", 100 * k / N)
    }
  }
}
ard_t2 <- do.call(rbind, rows)
`

const T3_REF = String.raw`
d <- adlb[adlb$AVISITN == 26 & !is.na(adlb$CHG) & adlb$ANL01FL == "Y", ]
d$TRT <- factor(d$TRT01PN, levels = c(1, 2, 3), labels = c("Placebo", "GLV-12 5 mg", "GLV-12 10 mg"))
fit <- lm(CHG ~ TRT + BASE, data = d)
nd <- data.frame(TRT = factor(levels(d$TRT), levels = levels(d$TRT)), BASE = mean(d$BASE))
pr <- predict(fit, newdata = nd, se.fit = TRUE)
rows <- list()
add <- function(an, g, st, v) rows[[length(rows) + 1]] <<- data.frame(ANALYSIS = an, GROUP = g, CATEGORY = NA, STAT = st, VALUE = v, stringsAsFactors = FALSE)
for (i in seq_along(levels(d$TRT))) {
  g <- levels(d$TRT)[i]; x <- d[d$TRT == g, ]
  add("BASE", g, "n", nrow(x)); add("BASE", g, "mean", mean(x$BASE)); add("BASE", g, "sd", sd(x$BASE))
  add("CHG", g, "n", nrow(x)); add("CHG", g, "mean", mean(x$CHG)); add("CHG", g, "sd", sd(x$CHG))
  add("LSMEAN", g, "est", pr$fit[i]); add("LSMEAN", g, "se", pr$se.fit[i])
}
ci <- confint(fit)
co <- summary(fit)$coefficients
for (g in c("GLV-12 5 mg", "GLV-12 10 mg")) {
  term <- paste0("TRT", g)
  add("DIFF", g, "est", co[term, "Estimate"]); add("DIFF", g, "lcl", ci[term, 1]); add("DIFF", g, "ucl", ci[term, 2]); add("DIFF", g, "p", co[term, "Pr(>|t|)"])
}
ard_t3 <- do.call(rbind, rows)
`

const L1_REF = String.raw`
l1 <- adae[adae$AESER == "Y", c("USUBJID", "TRT01A", "AEDECOD", "AEBODSYS", "ASTDT", "AENDT", "ASTDY", "AESEV", "AEREL", "TRTEMFL")]
l1 <- l1[order(l1$TRT01A, l1$USUBJID, l1$ASTDT), ]
`

const F1_REF = String.raw`
d <- adlb[adlb$AVISITN > 0 & !is.na(adlb$CHG), ]
f1 <- aggregate(CHG ~ TRT01P + AVISITN, data = d, FUN = function(x) c(MEAN = mean(x), SE = sd(x) / sqrt(length(x))))
f1 <- data.frame(TRT01P = f1$TRT01P, AVISITN = f1$AVISITN, MEAN = f1$CHG[, "MEAN"], SE = f1$CHG[, "SE"], stringsAsFactors = FALSE)
f1 <- f1[order(f1$TRT01P, f1$AVISITN), ]
cols <- c("Placebo" = "grey40", "GLV-12 5 mg" = "steelblue", "GLV-12 10 mg" = "darkorange")
plot(NA, xlim = c(0, 26), ylim = range(c(0, f1$MEAN - f1$SE, f1$MEAN + f1$SE)), xlab = "Week", ylab = "Mean change from baseline in HbA1c (%)", main = "HbA1c: mean change from baseline (SE)")
abline(h = 0, lty = 3)
for (g in names(cols)) { x <- f1[f1$TRT01P == g, ]; lines(c(0, x$AVISITN), c(0, x$MEAN), type = "b", pch = 19, col = cols[g]); arrows(x$AVISITN, x$MEAN - x$SE, x$AVISITN, x$MEAN + x$SE, angle = 90, code = 3, length = 0.04, col = cols[g]) }
legend("bottomleft", legend = names(cols), col = cols, lty = 1, pch = 19, bty = "n")
`

const ARD_SPEC: SpecRow[] = [
  { name: 'ANALYSIS', label: 'Analysis', derivation: 'Which analysis the row belongs to (for example AGE, SEX, SOC).' },
  { name: 'GROUP', label: 'Treatment group', derivation: 'The column of the display: a treatment group or Total.' },
  { name: 'CATEGORY', label: 'Category', derivation: 'The category within the analysis (for example F, or a system class), NA when there is none.' },
  { name: 'STAT', label: 'Statistic', derivation: 'n, pct, mean, sd, median, min, max, est, se, lcl, ucl, p, N.' },
  { name: 'VALUE', label: 'Value', derivation: 'The unrounded number. Rounding happens only when the display is drawn.' },
]

export const PROGRAMS: Program[] = [
  {
    id: 'ADSL', title: 'ADSL: subject-level analysis dataset', kind: 'dataset', output: 'adsl', keys: ['USUBJID'], ref: 'ADaMIG v1.3 section 3', needs: [],
    intro: 'One record per screened participant, with the treatment variables, dates, population flags and baseline values every analysis needs. Inputs: dm, ds, lb.',
    spec: [
      { name: 'STUDYID, USUBJID, SUBJID, SITEID, AGE, AGEU, SEX, RACE, ETHNIC, COUNTRY', label: 'From DM', derivation: 'Copied from DM.' },
      { name: 'AGEGR1 / AGEGR1N', label: 'Pooled age group 1', derivation: '"<65" (1) when AGE < 65, otherwise ">=65" (2).' },
      { name: 'TRT01P / TRT01PN', label: 'Planned treatment', derivation: 'DM.ARM; N: Placebo 1, GLV-12 5 mg 2, GLV-12 10 mg 3. Missing for screen failures.' },
      { name: 'TRT01A / TRT01AN', label: 'Actual treatment', derivation: 'DM.ACTARM, numbered the same way.' },
      { name: 'TRTSDT / TRTEDT', label: 'First and last dose dates', derivation: 'Date part of DM.RFXSTDTC and DM.RFXENDTC, as R Dates.' },
      { name: 'TRTDURD', label: 'Treatment duration (days)', derivation: 'TRTEDT - TRTSDT + 1.' },
      { name: 'RANDFL / ITTFL', label: 'Randomised / intent-to-treat flag', derivation: '"Y" when DM.ARMCD is not missing, else "N". ITTFL = RANDFL.' },
      { name: 'SAFFL', label: 'Safety population flag', derivation: '"Y" when randomised and TRTSDT is not missing (took at least one dose), else "N".' },
      { name: 'EOSSTT / DCSREAS', label: 'End of study status / reason', derivation: 'From the DS record with DSCAT "DISPOSITION EVENT": "COMPLETED" when DSDECOD is COMPLETED, else "DISCONTINUED" with DCSREAS = DSDECOD (NA when completed).' },
      { name: 'HBA1CBL', label: 'Baseline HbA1c (%)', derivation: 'LB.LBSTRESN for LBTESTCD "HBA1C" on the record with LBLOBXFL "Y".' },
    ],
    starter: '# Build adsl from dm, ds and lb (they are loaded already).\n# Keep one row per row of dm. Dates as R Dates: as.Date(substr(x, 1, 10)).\n\nadsl <- data.frame(USUBJID = dm$USUBJID, stringsAsFactors = FALSE)\n\n',
    reference: ADSL_REF,
  },
  {
    id: 'ADAE', title: 'ADAE: adverse events (occurrence data structure)', kind: 'dataset', output: 'adae', keys: ['USUBJID', 'AESEQ'], ref: 'ADaM OCCDS IG v1.1', needs: ['ADSL'],
    intro: 'One record per adverse event, with the treatment from ADSL, analysis dates and the treatment-emergent flag. Inputs: ae and the validated adsl.',
    spec: [
      { name: 'STUDYID, USUBJID, AESEQ, AETERM, AEDECOD, AEBODSYS, AESEV, AESER, AEREL', label: 'From AE', derivation: 'Copied from AE (coded terms included).' },
      { name: 'TRT01A, TRT01AN, SAFFL', label: 'From ADSL', derivation: 'Merged by USUBJID.' },
      { name: 'ASTDT / AENDT', label: 'Analysis start and end dates', derivation: 'Date part of AESTDTC and AEENDTC (no imputation in this study: partial dates are not present).' },
      { name: 'ASTDY', label: 'Analysis start relative day', derivation: 'ASTDT - TRTSDT + 1 when on or after TRTSDT, ASTDT - TRTSDT before it (there is no day 0).' },
      { name: 'TRTEMFL', label: 'Treatment-emergent flag', derivation: '"Y" when ASTDT is on or after TRTSDT and no later than TRTEDT + 30 days (SAP section 9.4), else "N".' },
    ],
    starter: '# Build adae from ae and adsl. One row per AE record; sort by USUBJID, AESEQ.\n\nadae <- merge(ae, adsl[, c("USUBJID", "TRT01A", "TRT01AN", "TRTSDT", "TRTEDT", "SAFFL")], by = "USUBJID", all.x = TRUE)\n\n',
    reference: ADAE_REF,
  },
  {
    id: 'ADLB', title: 'ADLB: HbA1c (basic data structure)', kind: 'dataset', output: 'adlb', keys: ['USUBJID', 'PARAMCD', 'AVISITN'], ref: 'ADaMIG v1.3 section 3.3', needs: ['ADSL'],
    intro: 'The primary efficacy parameter: one record per participant per visit, with baseline and change from baseline. Inputs: lb and the validated adsl. Intent-to-treat participants only.',
    spec: [
      { name: 'STUDYID, USUBJID, LBSEQ', label: 'From LB', derivation: 'LB records with LBTESTCD "HBA1C".' },
      { name: 'TRT01P, TRT01PN, ITTFL', label: 'From ADSL', derivation: 'Merged by USUBJID; keep ITTFL "Y".' },
      { name: 'PARAMCD / PARAM', label: 'Parameter', derivation: '"HBA1C" / "Hemoglobin A1C (%)".' },
      { name: 'AVAL', label: 'Analysis value', derivation: 'LBSTRESN.' },
      { name: 'ADT', label: 'Analysis date', derivation: 'Date part of LBDTC.' },
      { name: 'AVISITN / AVISIT', label: 'Analysis visit', derivation: 'VISITNUM 1 → 0 "BASELINE"; 4 → 4 "WEEK 4"; 6 → 12 "WEEK 12"; 9 → 26 "WEEK 26".' },
      { name: 'ABLFL', label: 'Baseline record flag', derivation: '"Y" on the record with LBLOBXFL "Y", else NA.' },
      { name: 'BASE / CHG', label: 'Baseline / change from baseline', derivation: 'BASE: the AVAL of the baseline record, on every record of the participant. CHG: AVAL - BASE after baseline, NA at baseline.' },
      { name: 'ANL01FL', label: 'Analysis flag 01', derivation: '"Y" on every record (one record per visit in this study).' },
    ],
    starter: '# Build adlb for HbA1c from lb and adsl (ITT participants). Sort by USUBJID, AVISITN.\n\nhb <- lb[lb$LBTESTCD == "HBA1C", ]\n\n',
    reference: ADLB_REF,
  },
  {
    id: 'T1', title: 'Table 14.1.2: demographics (safety population)', kind: 'ard', output: 'ard_t1', keys: ['ANALYSIS', 'GROUP', 'CATEGORY', 'STAT'], ref: 'SAP 9.2; CDISC Analysis Results Standard', needs: ['ADSL'],
    intro: 'Demographics by actual treatment and in total for the safety population: age (n, mean, SD, median, min, max), age group, sex and race (n and %). Build the analysis results data (ARD); the lab draws the table from it.',
    spec: ARD_SPEC,
    starter: '# Safety population, columns by TRT01A plus "Total".\n# One row per result: ANALYSIS, GROUP, CATEGORY, STAT, VALUE (unrounded).\n# POP/N for the column headers; AGE n, mean, sd, median, min, max; AGEGR1, SEX, RACE n and pct.\n\npop <- adsl[adsl$SAFFL == "Y", ]\n\n',
    reference: T1_REF,
  },
  {
    id: 'T2', title: 'Table 14.3.1: treatment-emergent adverse events by system class and preferred term', kind: 'ard', output: 'ard_t2', keys: ['ANALYSIS', 'GROUP', 'CATEGORY', 'STAT'], ref: 'SAP 9.4', needs: ['ADSL', 'ADAE'],
    intro: 'Participants with at least one treatment-emergent AE, then by system class (AEBODSYS) and preferred term (AEDECOD): n and % of the safety population in each group. A participant counts once per row.',
    spec: [...ARD_SPEC, { name: 'CATEGORY for PT rows', label: '', derivation: '"<AEBODSYS> | <AEDECOD>".' }],
    starter: '# Treatment-emergent (TRTEMFL "Y") AEs in the safety population; denominators from adsl.\n# ANALYSIS: POP (N), ANY, SOC, PT. Count participants, not events.\n\n',
    reference: T2_REF,
  },
  {
    id: 'T3', title: 'Table 14.2.1: HbA1c change from baseline at Week 26 (ANCOVA)', kind: 'ard', output: 'ard_t3', keys: ['ANALYSIS', 'GROUP', 'CATEGORY', 'STAT'], ref: 'SAP 9.3 (primary endpoint)', needs: ['ADSL', 'ADLB'],
    intro: 'The primary analysis: change from baseline in HbA1c at Week 26, analysed with ANCOVA (treatment as a factor, baseline HbA1c as a covariate), observed cases. Report n, mean and SD of baseline and change; least-squares means at the mean baseline with their standard errors; the difference of each GLV-12 dose from placebo with its 95% confidence interval and p-value.',
    spec: [...ARD_SPEC, { name: 'Model', label: '', derivation: 'lm(CHG ~ TRT + BASE) with TRT a factor with placebo as the reference level. LSMEAN est and se: predict() at each treatment with BASE = mean baseline of the analysis set. DIFF est, lcl, ucl, p: the TRT coefficients, confint() and their p-values.' }],
    starter: '# Week 26, CHG not missing. Make TRT a factor with Placebo first.\n# fit <- lm(CHG ~ TRT + BASE, data = d)\n\nd <- adlb[adlb$AVISITN == 26 & !is.na(adlb$CHG), ]\n\n',
    reference: T3_REF,
  },
  {
    id: 'L1', title: 'Listing 16.2.7: serious adverse events', kind: 'listing', output: 'l1', keys: ['USUBJID', 'AEDECOD', 'ASTDT'], ref: 'ICH E3 section 16.2.7', needs: ['ADSL', 'ADAE'],
    intro: 'Every serious adverse event, whether treatment-emergent or not, sorted by treatment, participant and start date. Columns: USUBJID, TRT01A, AEDECOD, AEBODSYS, ASTDT, AENDT, ASTDY, AESEV, AEREL, TRTEMFL.',
    spec: [{ name: 'Selection', label: '', derivation: 'AESER "Y".' }, { name: 'Sort', label: '', derivation: 'TRT01A, USUBJID, ASTDT.' }],
    starter: '# Serious AEs from adae.\n\n',
    reference: L1_REF,
  },
  {
    id: 'F1', title: 'Figure 14.2.2: mean change from baseline in HbA1c by visit', kind: 'figure', output: 'f1', keys: ['TRT01P', 'AVISITN'], ref: 'SAP 9.3', needs: ['ADSL', 'ADLB'],
    intro: 'Mean change from baseline (with standard error bars) at Weeks 4, 12 and 26 by planned treatment, observed cases. Build f1 (TRT01P, AVISITN, MEAN, SE) and draw the plot from it with base R graphics.',
    spec: [{ name: 'f1', label: 'Plotted data', derivation: 'One row per TRT01P and AVISITN > 0: MEAN = mean(CHG), SE = sd(CHG) / sqrt(n).' }, { name: 'Plot', label: '', derivation: 'Lines with points by treatment, error bars of ±1 SE, a reference line at 0, axis labels and a legend.' }],
    starter: '# f1: TRT01P, AVISITN, MEAN, SE; then plot it.\n\nd <- adlb[adlb$AVISITN > 0 & !is.na(adlb$CHG), ]\n\n',
    reference: F1_REF,
  },
]
export const programById = new Map(PROGRAMS.map((p) => [p.id, p]))
// The datasets a program reads from the SDTM hand-off.
export const SDTM_USED = ['dm', 'ds', 'lb', 'ae', 'ex', 'vs', 'cm', 'mh']

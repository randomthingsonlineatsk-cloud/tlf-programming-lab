// HRP-301 (VERDANT-1): a fictional phase 3 trial of lumiravostat 10 mg and 25 mg against placebo
// for 16 weeks in moderate to severe chronic hand eczema. The SDTM comes from the learner's own
// hand-off (CDM Console → SDTM Mapping Trainer → this lab), so the lifecycle journey reaches the
// analysis. Primary endpoint: IGA-CHE treatment success at Week 16.
import { ARD_SPEC, ARD_KEYS, ARD_HEAD, type Program, type StudyPack } from './types'
import { GLV_PROGRAMS } from './glv'
import { hrpDisplays } from '../display'

const GROUPS = ['Placebo', 'Lumiravostat 10 mg', 'Lumiravostat 25 mg']
const G3 = 'c("Placebo", "Lumiravostat 10 mg", "Lumiravostat 25 mg")'
const G4 = 'c("Placebo", "Lumiravostat 10 mg", "Lumiravostat 25 mg", "Total")'
const glv = (id: string) => GLV_PROGRAMS.find((p) => p.id === id)!
const swap = (s: string) => s.replace('c("Placebo", "GLV-12 5 mg", "GLV-12 10 mg", "Total")', G4)

const ADSL = String.raw`
trtn <- c("Placebo" = 1, "Lumiravostat 10 mg" = 2, "Lumiravostat 25 mg" = 3)
adsl <- data.frame(STUDYID = dm$STUDYID, USUBJID = dm$USUBJID, SUBJID = dm$SUBJID, SITEID = dm$SITEID,
                   AGE = dm$AGE, AGEU = dm$AGEU, SEX = dm$SEX, RACE = dm$RACE, COUNTRY = dm$COUNTRY, stringsAsFactors = FALSE)
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
disp <- ds[ds$DSCAT == "DISPOSITION EVENT", ]
i <- match(adsl$USUBJID, disp$USUBJID)
adsl$EOSSTT  <- ifelse(disp$DSDECOD[i] == "COMPLETED", "COMPLETED", "DISCONTINUED")
adsl$DCSREAS <- ifelse(disp$DSDECOD[i] == "COMPLETED", NA, disp$DSDECOD[i])
adsl$EOSDT   <- as.Date(substr(disp$DSSTDTC[i], 1, 10))
bl <- qs[qs$QSLOBXFL %in% "Y", ]
b <- function(cd) bl$QSSTRESN[bl$QSTESTCD == cd][match(adsl$USUBJID, bl$USUBJID[bl$QSTESTCD == cd])]
adsl$HECSIBL <- b("HECSI01")
adsl$IGABL   <- b("IGACHE01")
adsl$ITCHBL  <- b("ITCH01")
`

const ADQS = String.raw`
x <- qs[qs$QSTESTCD %in% c("HECSI01", "IGACHE01", "ITCH01") & qs$VISITNUM >= 2,
        c("STUDYID", "USUBJID", "QSSEQ", "QSTESTCD", "QSTEST", "VISITNUM", "VISIT", "QSDTC", "QSSTRESN", "QSLOBXFL")]
adqs <- merge(x, adsl[adsl$ITTFL == "Y", c("USUBJID", "TRT01P", "TRT01PN", "ITTFL")], by = "USUBJID")
adqs$PARAMCD <- c(HECSI01 = "HECSI", IGACHE01 = "IGACHE", ITCH01 = "ITCH")[adqs$QSTESTCD]
adqs$PARAM   <- c(HECSI01 = "HECSI total score", IGACHE01 = "IGA-CHE score", ITCH01 = "Hand eczema itch NRS")[adqs$QSTESTCD]
adqs$AVAL    <- adqs$QSSTRESN
adqs$ADT     <- as.Date(substr(adqs$QSDTC, 1, 10))
adqs$AVISITN <- unname(c("2" = 0, "3" = 2, "4" = 4, "5" = 8, "6" = 12, "7" = 16)[as.character(adqs$VISITNUM)])
adqs$AVISIT  <- ifelse(adqs$AVISITN == 0, "BASELINE", paste("WEEK", adqs$AVISITN))
adqs$ABLFL   <- ifelse(adqs$QSLOBXFL %in% "Y", "Y", NA)
bl <- adqs[adqs$ABLFL %in% "Y", ]
adqs$BASE    <- bl$AVAL[match(paste(adqs$USUBJID, adqs$PARAMCD), paste(bl$USUBJID, bl$PARAMCD))]
post <- adqs$AVISITN > 0
adqs$CHG     <- ifelse(post, adqs$AVAL - adqs$BASE, NA)
adqs$PCHG    <- ifelse(post & !is.na(adqs$BASE) & adqs$BASE != 0, 100 * adqs$CHG / adqs$BASE, NA)
adqs$CRIT1   <- c(HECSI = "HECSI-75: at least 75% improvement from baseline", IGACHE = "IGA-CHE success: 0 or 1 with at least a 2-point improvement",
                  ITCH = "Itch NRS: at least 4-point improvement (baseline 4 or more)")[adqs$PARAMCD]
r <- ifelse(adqs$PARAMCD == "HECSI", adqs$PCHG <= -75,
     ifelse(adqs$PARAMCD == "IGACHE", adqs$AVAL <= 1 & adqs$BASE - adqs$AVAL >= 2,
            ifelse(adqs$BASE >= 4, adqs$CHG <= -4, NA)))
adqs$CRIT1FL <- ifelse(!post | is.na(r), NA, ifelse(r, "Y", "N"))
adqs <- adqs[order(adqs$USUBJID, adqs$PARAMCD, adqs$AVISITN),
             c("STUDYID", "USUBJID", "TRT01P", "TRT01PN", "ITTFL", "PARAMCD", "PARAM", "AVISIT", "AVISITN", "ADT",
               "AVAL", "ABLFL", "BASE", "CHG", "PCHG", "CRIT1", "CRIT1FL", "QSSEQ")]
`

const resp = (param: string, out: string) => String.raw`
itt <- adsl[adsl$ITTFL == "Y", ]
w16 <- adqs[adqs$PARAMCD == "${param}" & adqs$AVISITN == 16, ]
itt$RESP <- w16$CRIT1FL[match(itt$USUBJID, w16$USUBJID)] %in% "Y"
itt$MISS <- is.na(w16$CRIT1FL[match(itt$USUBJID, w16$USUBJID)])
groups <- ${G3}
${ARD_HEAD}p0 <- mean(itt$RESP[itt$TRT01P == "Placebo"]); n0 <- sum(itt$TRT01P == "Placebo"); k0 <- sum(itt$RESP[itt$TRT01P == "Placebo"])
for (g in groups) {
  x <- itt[itt$TRT01P == g, ]
  add("N", g, NA, "n", nrow(x)); add("RESP", g, NA, "n", sum(x$RESP)); add("RESP", g, NA, "pct", 100 * mean(x$RESP)); add("MISS", g, NA, "n", sum(x$MISS))
  if (g != "Placebo") {
    p1 <- mean(x$RESP); n1 <- nrow(x); se <- sqrt(p1 * (1 - p1) / n1 + p0 * (1 - p0) / n0)
    add("DIFF", g, NA, "est", 100 * (p1 - p0)); add("DIFF", g, NA, "lcl", 100 * (p1 - p0 - qnorm(0.975) * se)); add("DIFF", g, NA, "ucl", 100 * (p1 - p0 + qnorm(0.975) * se))
    add("DIFF", g, NA, "p", fisher.test(matrix(c(sum(x$RESP), n1 - sum(x$RESP), k0, n0 - k0), 2))$p.value)
  }
}
${out} <- do.call(rbind, rows)
`

const F1 = String.raw`
d <- adqs[adqs$PARAMCD == "HECSI" & adqs$AVISITN > 0 & !is.na(adqs$PCHG), ]
f1 <- aggregate(PCHG ~ TRT01P + AVISITN, data = d, FUN = function(x) c(MEAN = mean(x), SE = sd(x) / sqrt(length(x))))
f1 <- data.frame(TRT01P = f1$TRT01P, AVISITN = f1$AVISITN, MEAN = f1$PCHG[, "MEAN"], SE = f1$PCHG[, "SE"], stringsAsFactors = FALSE)
f1 <- f1[order(f1$TRT01P, f1$AVISITN), ]
cols <- c("Placebo" = "grey40", "Lumiravostat 10 mg" = "steelblue", "Lumiravostat 25 mg" = "darkorange")
plot(NA, xlim = c(0, 16), ylim = range(c(0, f1$MEAN - f1$SE, f1$MEAN + f1$SE)), xlab = "Week", ylab = "Mean % change from baseline in HECSI", main = "HECSI: mean percent change from baseline (SE)")
abline(h = 0, lty = 3)
for (g in names(cols)) { x <- f1[f1$TRT01P == g, ]; lines(c(0, x$AVISITN), c(0, x$MEAN), type = "b", pch = 19, col = cols[g]); arrows(x$AVISITN, x$MEAN - x$SE, x$AVISITN, x$MEAN + x$SE, angle = 90, code = 3, length = 0.04, col = cols[g]) }
legend("bottomleft", legend = names(cols), col = cols, lty = 1, pch = 19, bty = "n")
`

const respSpec = (what: string) => [...ARD_SPEC,
  { name: 'Responder', label: '', derivation: `${what} at Week 16 (ADQS AVISITN 16, CRIT1FL "Y"). Intent-to-treat participants without a Week 16 record count as non-responders (MISS counts them).` },
  { name: 'Results', label: '', derivation: 'Per TRT01P: N, RESP n and pct, MISS n. For each dose: DIFF est, lcl, ucl in percentage points (Wald: p1 - p0 ± 1.96 √(p1(1-p1)/n1 + p0(1-p0)/n0)) and p from fisher.test() on the 2 × 2 table of responders against placebo.' }]

export const HRP_PROGRAMS: Program[] = [
  { ...glv('ADSL'), reference: ADSL, intro: 'One record per screened participant: treatment variables, dates, population flags disposition from DS, and the baseline scores (HECSI, IGA-CHE, itch) from QS. Inputs: dm, ds, qs.',
    spec: [
      { name: 'STUDYID, USUBJID, SUBJID, SITEID, AGE, AGEU, SEX, RACE, COUNTRY', label: 'From DM', derivation: 'Copied from DM.' },
      { name: 'AGEGR1 / AGEGR1N', label: 'Pooled age group 1', derivation: '"<65" (1) when AGE < 65, otherwise ">=65" (2).' },
      { name: 'TRT01P(N) / TRT01A(N)', label: 'Planned and actual treatment', derivation: 'DM.ARM and DM.ACTARM; N: Placebo 1, Lumiravostat 10 mg 2, Lumiravostat 25 mg 3.' },
      { name: 'TRTSDT, TRTEDT, TRTDURD', label: 'Dosing dates and duration', derivation: 'Date parts of RFXSTDTC and RFXENDTC; TRTEDT - TRTSDT + 1.' },
      { name: 'RANDFL, ITTFL, SAFFL', label: 'Population flags', derivation: 'As in GLV-12-301: randomised when ARMCD is present; ITT = randomised; safety = randomised and dosed.' },
      { name: 'EOSSTT / DCSREAS / EOSDT', label: 'End of study status, reason and date', derivation: 'From the DS record with DSCAT "DISPOSITION EVENT": "COMPLETED" when DSDECOD is COMPLETED, else "DISCONTINUED" with DCSREAS = DSDECOD (NA when completed); EOSDT = date part of its DSSTDTC. Screen failures are "DISCONTINUED" with DCSREAS "SCREEN FAILURE" and are not randomised.' },
      { name: 'HECSIBL, IGABL, ITCHBL', label: 'Baseline scores', derivation: 'QSSTRESN on the QS record with QSLOBXFL "Y" for QSTESTCD HECSI01, IGACHE01, ITCH01.' },
    ],
    starter: '# Build adsl from dm and qs.\n\nadsl <- data.frame(USUBJID = dm$USUBJID, stringsAsFactors = FALSE)\n\n' },
  { ...glv('ADAE'), intro: 'One record per adverse event with the treatment from ADSL, analysis dates and the treatment-emergent flag (up to 30 days after the last dose). Inputs: ae and the validated adsl.' },
  {
    id: 'ADQS', title: 'ADQS: hand eczema scores (BDS) with responder flags', kind: 'dataset', area: 'ADaM', output: 'adqs', keys: ['USUBJID', 'PARAMCD', 'AVISITN'], ref: 'ADaMIG v1.3 section 3.3', needs: ['ADSL'],
    intro: 'HECSI, IGA-CHE and itch NRS for the intent-to-treat population, by analysis visit, with baseline, change, percent change and the responder criterion of each parameter.',
    spec: [
      { name: 'Records', label: '', derivation: 'QSTESTCD HECSI01, IGACHE01, ITCH01 from Day 1 on (VISITNUM 2 and later; screening dropped); ITTFL "Y".' },
      { name: 'PARAMCD / PARAM', label: '', derivation: 'HECSI "HECSI total score"; IGACHE "IGA-CHE score"; ITCH "Hand eczema itch NRS".' },
      { name: 'AVAL, ADT, AVISITN, AVISIT', label: '', derivation: 'QSSTRESN; date part of QSDTC; VISITNUM 2, 3, 4, 5, 6, 7 → 0 "BASELINE", 2, 4, 8, 12, 16 ("WEEK n").' },
      { name: 'ABLFL, BASE, CHG, PCHG', label: '', derivation: 'ABLFL "Y" where QSLOBXFL "Y"; BASE its AVAL; after baseline CHG = AVAL - BASE and PCHG = 100 × CHG / BASE (NA when BASE is 0).' },
      { name: 'CRIT1 / CRIT1FL', label: 'Responder criterion', derivation: 'HECSI: PCHG <= -75 ("HECSI-75: at least 75% improvement from baseline"). IGACHE: AVAL <= 1 and BASE - AVAL >= 2 ("IGA-CHE success: 0 or 1 with at least a 2-point improvement"). ITCH: CHG <= -4, only when BASE >= 4 ("Itch NRS: at least 4-point improvement (baseline 4 or more)"). CRIT1FL "Y"/"N" after baseline; NA at baseline or when not evaluable.' },
      { name: 'Also', label: '', derivation: 'STUDYID, USUBJID, TRT01P, TRT01PN, ITTFL, QSSEQ.' },
    ],
    starter: '# Build adqs from qs and adsl (ITT). Screening records are not analysed.\n\nx <- qs[qs$QSTESTCD %in% c("HECSI01", "IGACHE01", "ITCH01"), ]\n\n', reference: ADQS,
  },
  { ...glv('T1'), reference: swap(glv('T1').reference), starter: glv('T1').starter.replace('TRT01A plus "Total"', 'TRT01A (Placebo, Lumiravostat 10 mg, Lumiravostat 25 mg) plus "Total"') },
  { ...glv('T2'), reference: swap(glv('T2').reference) },
  { id: 'T3', title: 'Table 14.2.1: IGA-CHE treatment success at Week 16 (primary endpoint)', kind: 'ard', area: 'Efficacy', output: 'ard_t3', keys: ARD_KEYS, ref: 'SAP 9.3 (primary analysis); ICH E9(R1) composite strategy', needs: ['ADSL', 'ADQS'],
    intro: 'The proportion of participants with IGA-CHE treatment success at Week 16, by planned treatment, with missing values imputed as non-response (composite strategy), and the difference of each dose from placebo.',
    spec: respSpec('IGA-CHE success (PARAMCD "IGACHE")'), starter: '# Responders at Week 16, non-responder imputation, difference from placebo.\n\nitt <- adsl[adsl$ITTFL == "Y", ]\n\n', reference: resp('IGACHE', 'ard_t3'),
    shell: 'N; IGA-CHE treatment success, n (%); Missing, imputed as non-response; Difference from placebo, % (95% CI); p-value. Columns: Placebo, Lumiravostat 10 mg, Lumiravostat 25 mg.' },
  { id: 'T4', title: 'Table 14.2.2: HECSI-75 at Week 16 (key secondary endpoint)', kind: 'ard', area: 'Efficacy', output: 'ard_t4', keys: ARD_KEYS, ref: 'SAP 9.4.1', needs: ['ADSL', 'ADQS'],
    intro: 'The proportion of participants with at least a 75% improvement in HECSI at Week 16, analysed as the primary endpoint.',
    spec: respSpec('HECSI-75 (PARAMCD "HECSI")'), starter: '# HECSI-75 responders at Week 16.\n\n', reference: resp('HECSI', 'ard_t4') },
  { ...glv('L1') },
  { ...glv('T4'), id: 'T5', output: 'ard_t5', reference: swap(glv('T4').reference).replace('ard_t4 <-', 'ard_t5 <-'),
    shell: 'Screened; Screen failures; Randomised (N); Treated; Completed the study; Discontinued from the study; Primary reason: one row per reason. Columns: Placebo, Lumiravostat 10 mg, Lumiravostat 25 mg, Total. n (%), % of randomised.' },
  { ...glv('T5'), id: 'T6', output: 'ard_t6',
    intro: 'Duration of treatment (TRTDURD): n, mean, SD, median, min, max; duration categories for a 16-week study; total exposure in participant-years.',
    spec: [{ name: 'Analyses', label: '', derivation: 'POP (N); DUR (n, mean, sd, median, min, max of TRTDURD); DURCAT with categories "1-28 days", "29-56 days", "57-84 days", ">84 days" (n, pct); PYEARS est = sum(TRTDURD) / 365.25.' }],
    reference: swap(glv('T5').reference).replace('ard_t5 <-', 'ard_t6 <-').replace('c("1-28 days", "29-84 days", "85-182 days", ">182 days")', 'c("1-28 days", "29-56 days", "57-84 days", ">84 days")').replace('c(0, 28, 84, 182, Inf)', 'c(0, 28, 56, 84, Inf)') },
  { id: 'F1', title: 'Figure 14.2.3: mean percent change from baseline in HECSI by visit', kind: 'figure', area: 'Figures', output: 'f1', keys: ['TRT01P', 'AVISITN'], ref: 'SAP 9.4.2', needs: ['ADSL', 'ADQS'],
    intro: 'Mean percent change from baseline in HECSI (with SE bars) at Weeks 2 to 16 by planned treatment, observed cases. Build f1 (TRT01P, AVISITN, MEAN, SE) and draw the plot from it.',
    spec: [{ name: 'f1', label: 'Plotted data', derivation: 'One row per TRT01P and AVISITN > 0 for PARAMCD "HECSI": MEAN = mean(PCHG), SE = sd(PCHG) / sqrt(n).' }, { name: 'Plot', label: '', derivation: 'Lines with points by treatment, ±1 SE error bars, a reference line at 0, labels and a legend.' }],
    starter: '# f1: TRT01P, AVISITN, MEAN, SE from HECSI percent change; then plot it.\n\n', reference: F1 },
]

export const HRP: StudyPack = {
  id: 'HRP-301', short: 'Lumiravostat vs placebo, chronic hand eczema, 16 weeks', sap: 'SAP v1.0',
  title: 'VERDANT-1: a randomised, double-blind, placebo-controlled phase 3 study of lumiravostat (Ostrevia) 10 mg and 25 mg once daily for 16 weeks in adults with moderate to severe chronic hand eczema',
  groups: GROUPS, programs: HRP_PROGRAMS, displays: hrpDisplays(GROUPS),
}

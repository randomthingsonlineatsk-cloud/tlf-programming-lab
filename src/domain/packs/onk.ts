// ONK-44-302 (MERIDIAN-2): a fictional randomised, open-label phase 3 study of ONK-44 400 mg once
// daily against docetaxel 75 mg/m2 every 3 weeks in previously treated advanced non-small cell
// lung cancer. The SDTM comes from the SDTM Mapping Trainer's RECIST 1.1 study (DM, DS, TU, TR, RS,
// PR, DD, AE). Primary endpoint: progression-free survival by blinded independent central review.
// Data cut-off 2026-10-31. Times are from randomisation (DS RANDOMIZED); medians are reported in
// months (days / 30.4375). These programs feed the CSR & Narrative Studio's oncology report.
import { ARD_SPEC, ARD_KEYS, ARD_HEAD, type Program, type StudyPack } from './types'
import { onkDisplays } from '../display'

const GROUPS = ['ONK-44 400 mg', 'Docetaxel']
const G2 = 'c("ONK-44 400 mg", "Docetaxel")'
const G3 = 'c("ONK-44 400 mg", "Docetaxel", "Total")'
const CUT = 'as.Date("2026-10-31")'

const ADSL = String.raw`
short <- c("ONK44" = "ONK-44 400 mg", "DOCE" = "Docetaxel")
cut <- ${CUT}
d10 <- function(x) { x <- as.character(x); x[is.na(x)] <- ""; ifelse(nchar(x) == 7, paste0(x, "-01"), substr(x, 1, 10)) }
asd <- function(x) { x <- d10(x); as.Date(ifelse(x == "", NA, x)) }
rnd <- ds[ds$DSDECOD == "RANDOMIZED", ]
adsl <- data.frame(STUDYID = dm$STUDYID, USUBJID = dm$USUBJID, SUBJID = dm$SUBJID, SITEID = dm$SITEID,
                   AGE = dm$AGE, SEX = dm$SEX, RACE = dm$RACE, COUNTRY = dm$COUNTRY, stringsAsFactors = FALSE)
adsl$AGEGR1   <- ifelse(adsl$AGE < 65, "<65", ">=65")
adsl$TRT01P   <- unname(short[dm$ARMCD])
adsl$TRT01A   <- unname(short[dm$ACTARMCD])
adsl$RANDDT   <- asd(rnd$DSSTDTC[match(adsl$USUBJID, rnd$USUBJID)])
adsl$TRTSDT   <- asd(dm$RFXSTDTC)
adsl$TRTEDT   <- asd(dm$RFXENDTC)
adsl$TRTDURD  <- as.numeric(adsl$TRTEDT - adsl$TRTSDT) + ifelse(adsl$TRT01A %in% "Docetaxel", 21, 1)
adsl$RANDFL   <- ifelse(!is.na(adsl$RANDDT), "Y", "N")
adsl$ITTFL    <- adsl$RANDFL
adsl$SAFFL    <- ifelse(adsl$RANDFL == "Y" & !is.na(adsl$TRTSDT), "Y", "N")
adsl$DTHDT    <- asd(dm$DTHDTC)
adsl$DTHFL    <- ifelse(!is.na(adsl$DTHDT), "Y", "N")
lc <- asd(dm$RFPENDTC); lc[!is.na(lc) & lc > cut] <- cut
adsl$LSTALVDT <- adsl$DTHDT; adsl$LSTALVDT[is.na(adsl$DTHDT)] <- lc[is.na(adsl$DTHDT)]
`

const ADTTE = String.raw`
cut <- ${CUT}
itt <- adsl[adsl$ITTFL == "Y", ]
ov <- rs[rs$RSTESTCD == "OVRLRESP", c("USUBJID", "RSEVAL", "RSSTRESC", "RSDTC")]
ov$ADT <- as.Date(substr(ov$RSDTC, 1, 10)); ov <- ov[ov$ADT <= cut, ]
one <- function(s, pcd, param, adt, cnsr, desc) data.frame(STUDYID = s$STUDYID, USUBJID = s$USUBJID, TRT01P = s$TRT01P, ITTFL = "Y", PARAMCD = pcd, PARAM = param,
  STARTDT = s$RANDDT, ADT = adt, AVAL = as.numeric(adt - s$RANDDT) + 1, CNSR = cnsr, EVNTDESC = desc, stringsAsFactors = FALSE)
pfs <- function(ev, pcd, param) do.call(rbind, lapply(seq_len(nrow(itt)), function(i) {
  s <- itt[i, ]; o <- ov[ov$USUBJID == s$USUBJID & ov$RSEVAL == ev, ]; o <- o[order(o$ADT), ]
  pd <- o$ADT[o$RSSTRESC %in% "PD"][1]; dth <- if (!is.na(s$DTHDT) && s$DTHDT <= cut) s$DTHDT else as.Date(NA)
  if (!is.na(pd) || !is.na(dth)) { e <- min(c(pd, dth), na.rm = TRUE); one(s, pcd, param, e, 0, if (!is.na(pd) && pd == e) "PROGRESSION" else "DEATH") }
  else { ad <- o$ADT[o$RSSTRESC %in% c("CR", "PR", "SD", "NON-CR/NON-PD")]; one(s, pcd, param, if (length(ad)) max(ad) else s$RANDDT, 1, if (length(ad)) "LAST ADEQUATE ASSESSMENT" else "NO ADEQUATE ASSESSMENT") }
}))
os <- do.call(rbind, lapply(seq_len(nrow(itt)), function(i) {
  s <- itt[i, ]
  if (!is.na(s$DTHDT) && s$DTHDT <= cut) one(s, "OS", "Overall survival (days)", s$DTHDT, 0, "DEATH") else one(s, "OS", "Overall survival (days)", s$LSTALVDT, 1, "LAST KNOWN ALIVE")
}))
adtte <- rbind(pfs("INDEPENDENT ASSESSOR", "PFS", "Progression-free survival by independent review (days)"),
               pfs("INVESTIGATOR", "PFSINV", "Progression-free survival by the investigator (days)"), os)
adtte <- adtte[order(adtte$USUBJID, adtte$PARAMCD), ]
`

const ADRS = String.raw`
cut <- ${CUT}
itt <- adsl[adsl$ITTFL == "Y", ]
ov <- rs[rs$RSTESTCD == "OVRLRESP", c("USUBJID", "RSEVAL", "RSSTRESC", "RSDTC")]
ov$ADT <- as.Date(substr(ov$RSDTC, 1, 10)); ov <- ov[ov$ADT <= cut, ]
rk <- c(CR = 5, PR = 4, SD = 3, PD = 2, NE = 1)
best <- function(u, ev) {
  o <- ov[ov$USUBJID == u & ov$RSEVAL == ev, ]; o <- o[order(o$ADT), ]; s <- itt$RANDDT[itt$USUBJID == u]; b <- "NE"
  for (j in seq_len(nrow(o))) { v <- o$RSSTRESC[j]; if (!(v %in% names(rk))) next
    if (v == "SD" && as.numeric(o$ADT[j] - s) + 1 < 36) next
    if (rk[[v]] > rk[[b]]) b <- v
    if (v == "PD") break }
  b
}
mk <- function(ev, pcd, param) data.frame(STUDYID = itt$STUDYID, USUBJID = itt$USUBJID, TRT01P = itt$TRT01P, ITTFL = "Y", PARAMCD = pcd, PARAM = param,
  AVALC = sapply(itt$USUBJID, best, ev = ev), stringsAsFactors = FALSE)
adrs <- rbind(mk("INDEPENDENT ASSESSOR", "BOR", "Best overall response by independent review"), mk("INVESTIGATOR", "BORINV", "Best overall response by the investigator"))
adrs$RESPFL <- ifelse(adrs$AVALC %in% c("CR", "PR"), "Y", "N")
rownames(adrs) <- NULL
`

const KM = String.raw`
km <- function(t, e) {
  ut <- sort(unique(t)); S <- 1; v <- 0; out <- NULL
  for (u in ut) {
    n <- sum(t >= u); d <- sum(t == u & e == 1); c <- sum(t == u & e == 0)
    if (d > 0) { S <- S * (1 - d / n); v <- v + d / (n * (n - d)) }
    out <- rbind(out, data.frame(TIME = u, NRISK = n, NEVENT = d, NCENS = c, SURV = S, GW = v))
  }
  out
}
`

const tteTable = (pcd: string, an: string, out: string) => String.raw`${KM}
d <- adtte[adtte$PARAMCD == "${pcd}", ]
groups <- ${G2}; mon <- 30.4375
${ARD_HEAD}for (g in groups) {
  x <- d[d$TRT01P == g, ]
  add("${an}", g, NA, "n", nrow(x))
  add("${an}_EVT", g, NA, "n", sum(x$CNSR == 0)); add("${an}_EVT", g, NA, "pct", 100 * mean(x$CNSR == 0))
  add("${an}_CNS", g, NA, "n", sum(x$CNSR == 1)); add("${an}_CNS", g, NA, "pct", 100 * mean(x$CNSR == 1))
  k <- km(x$AVAL, 1 - x$CNSR); k <- k[k$NEVENT > 0, ]
  z <- qnorm(0.975); se <- sqrt(k$GW) / abs(log(k$SURV))
  lo <- exp(-exp(log(-log(k$SURV)) + z * se)); hi <- exp(-exp(log(-log(k$SURV)) - z * se))
  first <- function(ok) if (any(ok, na.rm = TRUE)) k$TIME[which(ok)[1]] / mon else NA
  m <- c(est = first(k$SURV <= 0.5), lcl = first(lo <= 0.5), ucl = first(hi <= 0.5))
  for (s in names(m)) if (!is.na(m[[s]])) add("${an}_MED", g, NA, s, m[[s]])
}
cx <- lab_cox(d$AVAL, 1 - d$CNSR, cbind(ONK = as.numeric(d$TRT01P == "ONK-44 400 mg")))
add("${an}_HR", "ONK-44 400 mg", NA, "est", cx$hr[1]); add("${an}_HR", "ONK-44 400 mg", NA, "lcl", cx$lcl[1]); add("${an}_HR", "ONK-44 400 mg", NA, "ucl", cx$ucl[1])
ev <- d[d$CNSR == 0, ]; O <- E <- V <- 0
for (u in sort(unique(ev$AVAL))) {
  at <- d$AVAL >= u; n <- sum(at); n1 <- sum(at & d$TRT01P == "ONK-44 400 mg"); dt <- sum(ev$AVAL == u)
  O <- O + sum(ev$AVAL == u & ev$TRT01P == "ONK-44 400 mg"); E <- E + dt * n1 / n
  if (n > 1) V <- V + dt * (n1 / n) * (1 - n1 / n) * (n - dt) / (n - 1)
}
add("${an}_P", "ONK-44 400 mg", NA, "p", pchisq((O - E)^2 / V, 1, lower.tail = FALSE))
${out} <- do.call(rbind, rows)
`

const T1 = String.raw`
cut <- ${CUT}
groups <- ${G3}
itt <- adsl[adsl$ITTFL == "Y", ]
ev <- adtte[adtte$PARAMCD == "PFS" & adtte$CNSR == 0, "USUBJID"]
${ARD_HEAD}add("SCREENED", "Total", NA, "n", nrow(adsl)); add("SCRFAIL", "Total", NA, "n", sum(adsl$ITTFL != "Y"))
for (g in groups) {
  x <- if (g == "Total") itt else itt[itt$TRT01P == g, ]; N <- nrow(x)
  add("POP", g, NA, "N", N)
  died <- x$DTHFL == "Y" & !is.na(x$DTHDT) & x$DTHDT <= cut
  for (k in list(list("TREATED", x$SAFFL == "Y"), list("PFSEVT", x$USUBJID %in% ev), list("DEATH", died), list("ALIVE", !died))) {
    add(k[[1]], g, NA, "n", sum(k[[2]])); add(k[[1]], g, NA, "pct", 100 * sum(k[[2]]) / N)
  }
}
ard_t1 <- do.call(rbind, rows)
`

const T2 = String.raw`
groups <- ${G3}
itt <- adsl[adsl$ITTFL == "Y", ]
${ARD_HEAD}for (g in groups) {
  x <- if (g == "Total") itt else itt[itt$TRT01P == g, ]; N <- nrow(x)
  add("POP", g, NA, "N", N)
  add("AGE", g, NA, "n", N); add("AGE", g, NA, "mean", mean(x$AGE)); add("AGE", g, NA, "sd", sd(x$AGE)); add("AGE", g, NA, "median", median(x$AGE)); add("AGE", g, NA, "min", min(x$AGE)); add("AGE", g, NA, "max", max(x$AGE))
  for (v in c("AGEGR1", "SEX", "RACE", "COUNTRY")) for (k in sort(unique(itt[[v]]))) { n <- sum(x[[v]] == k); add(v, g, k, "n", n); add(v, g, k, "pct", 100 * n / N) }
}
ard_t2 <- do.call(rbind, rows)
`

const resp = (pcd: string, an: string) => String.raw`
r <- adrs[adrs$PARAMCD == "${pcd}", ]
for (g in groups) {
  x <- r[r$TRT01P == g, ]; N <- nrow(x)
  for (k in c("CR", "PR", "SD", "PD", "NE")) { n <- sum(x$AVALC == k); add("${an}_BOR", g, k, "n", n); add("${an}_BOR", g, k, "pct", 100 * n / N) }
  k <- sum(x$RESPFL == "Y"); ci <- binom.test(k, N)$conf.int
  add("${an}_ORR", g, NA, "n", k); add("${an}_ORR", g, NA, "pct", 100 * k / N)
  add("${an}_ORRCI", g, NA, "lcl", 100 * ci[1]); add("${an}_ORRCI", g, NA, "ucl", 100 * ci[2])
}
a <- r[r$TRT01P == "ONK-44 400 mg", ]; b <- r[r$TRT01P == "Docetaxel", ]
pa <- mean(a$RESPFL == "Y"); pb <- mean(b$RESPFL == "Y"); se <- sqrt(pa * (1 - pa) / nrow(a) + pb * (1 - pb) / nrow(b))
add("${an}_DIFF", "ONK-44 400 mg", NA, "est", 100 * (pa - pb)); add("${an}_DIFF", "ONK-44 400 mg", NA, "lcl", 100 * (pa - pb - qnorm(0.975) * se)); add("${an}_DIFF", "ONK-44 400 mg", NA, "ucl", 100 * (pa - pb + qnorm(0.975) * se))
`
const T5 = String.raw`
groups <- ${G2}
${ARD_HEAD}for (g in groups) add("N", g, NA, "N", sum(adrs$PARAMCD == "BOR" & adrs$TRT01P == g))
${resp('BOR', 'IRC')}${resp('BORINV', 'INV')}
i <- adrs[adrs$PARAMCD == "BOR", ]; v <- adrs[adrs$PARAMCD == "BORINV", ]
agree <- sum(i$RESPFL == v$RESPFL[match(i$USUBJID, v$USUBJID)])
add("AGREE", "Total", NA, "n", agree); add("AGREE", "Total", NA, "pct", 100 * agree / nrow(i))
ard_t5 <- do.call(rbind, rows)
`

const T7 = String.raw`
groups <- ${G2}
saf <- adsl[adsl$SAFFL == "Y", ]
${ARD_HEAD}for (g in groups) {
  x <- saf$TRTDURD[saf$TRT01A == g]
  add("DUR", g, NA, "n", length(x)); add("DUR", g, NA, "mean", mean(x)); add("DUR", g, NA, "sd", sd(x)); add("DUR", g, NA, "median", median(x)); add("DUR", g, NA, "min", min(x)); add("DUR", g, NA, "max", max(x))
}
ard_t7 <- do.call(rbind, rows)
`

const ADAE = String.raw`
adae <- merge(ae, adsl[, c("USUBJID", "TRT01A", "TRTSDT", "TRTEDT", "SAFFL")], by = "USUBJID", all.x = TRUE)
adae$ASTDT   <- as.Date(substr(adae$AESTDTC, 1, 10))
adae$AENDT   <- as.Date(ifelse(!is.na(adae$AEENDTC) & nchar(adae$AEENDTC) >= 10, substr(adae$AEENDTC, 1, 10), NA))
adae$ATOXGRN <- as.numeric(adae$AETOXGR)
adae$ASTDY   <- as.numeric(adae$ASTDT - adae$TRTSDT) + 1
adae$TRTEMFL <- ifelse(!is.na(adae$TRTSDT) & adae$ASTDT >= adae$TRTSDT & adae$ASTDT <= adae$TRTEDT + 30, "Y", "N")
adae <- adae[order(adae$USUBJID, adae$AESEQ),
             c("STUDYID", "USUBJID", "AESEQ", "AETERM", "AEDECOD", "AEBODSYS", "AETOXGR", "ATOXGRN", "AESER", "AEREL", "AEACN", "AEOUT", "AESDTH",
               "TRT01A", "SAFFL", "ASTDT", "AENDT", "ASTDY", "TRTEMFL")]
rownames(adae) <- NULL
`

const T8 = String.raw`
pop <- adsl[adsl$SAFFL == "Y", ]
te  <- adae[adae$TRTEMFL == "Y" & adae$SAFFL == "Y", ]
groups <- ${G3}
${ARD_HEAD}for (g in groups) {
  x <- if (g == "Total") pop else pop[pop$TRT01A == g, ]; N <- nrow(x)
  d <- if (g == "Total") te else te[te$TRT01A == g, ]
  add("POP", g, NA, "N", N)
  cnt <- function(an, sel) { k <- length(unique(d$USUBJID[sel])); add(an, g, NA, "n", k); add(an, g, NA, "pct", 100 * k / N) }
  cnt("ANY", rep(TRUE, nrow(d))); cnt("REL", d$AEREL == "RELATED"); cnt("GR3", d$ATOXGRN >= 3); cnt("SER", d$AESER == "Y")
  cnt("SERREL", d$AESER == "Y" & d$AEREL == "RELATED"); cnt("DISC", d$AEACN == "DRUG WITHDRAWN")
  cnt("MOD", d$AEACN %in% c("DRUG INTERRUPTED", "DOSE REDUCED")); cnt("FATAL", d$ATOXGRN == 5)
  k <- sum(x$DTHFL == "Y"); add("DEATH", g, NA, "n", k); add("DEATH", g, NA, "pct", 100 * k / N)
}
ard_t8 <- do.call(rbind, rows)
`

const T9 = String.raw`
pop <- adsl[adsl$SAFFL == "Y", ]
te  <- adae[adae$TRTEMFL == "Y" & adae$SAFFL == "Y", ]
groups <- ${G3}
${ARD_HEAD}for (g in groups) {
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
ard_t9 <- do.call(rbind, rows)
`

const T10 = String.raw`
pop <- adsl[adsl$SAFFL == "Y", ]
te3 <- adae[adae$TRTEMFL == "Y" & adae$SAFFL == "Y" & adae$ATOXGRN >= 3, ]
groups <- ${G3}
${ARD_HEAD}for (g in groups) {
  N <- if (g == "Total") nrow(pop) else sum(pop$TRT01A == g)
  d <- if (g == "Total") te3 else te3[te3$TRT01A == g, ]
  add("POP", g, NA, "N", N)
  k <- length(unique(d$USUBJID)); add("ANY", g, NA, "n", k); add("ANY", g, NA, "pct", 100 * k / N)
  for (pt in sort(unique(te3$AEDECOD))) { k <- length(unique(d$USUBJID[d$AEDECOD == pt])); add("PT", g, pt, "n", k); add("PT", g, pt, "pct", 100 * k / N) }
}
ard_t10 <- do.call(rbind, rows)
`

const L1 = String.raw`
l1 <- adae[adae$AESER == "Y", c("USUBJID", "TRT01A", "AEDECOD", "AEBODSYS", "ASTDT", "AENDT", "ASTDY", "AETOXGR", "AEREL", "AEOUT", "TRTEMFL")]
l1 <- l1[order(l1$TRT01A, l1$USUBJID, l1$ASTDT), ]
rownames(l1) <- NULL
`

const F1 = String.raw`${KM}
d <- adtte[adtte$PARAMCD == "PFS", ]; mon <- 30.4375
f1 <- do.call(rbind, lapply(${G2}, function(g) { x <- d[d$TRT01P == g, ]; k <- km(x$AVAL, 1 - x$CNSR); k <- k[k$NEVENT > 0, ]
  data.frame(TRT01P = g, TIME = round(k$TIME / mon, 1), NRISK = k$NRISK, NEVENT = k$NEVENT, NCENS = k$NCENS, SURV = k$SURV, stringsAsFactors = FALSE) }))
cols <- c("ONK-44 400 mg" = "darkorange", "Docetaxel" = "grey40")
plot(NA, xlim = c(0, max(f1$TIME) + 1), ylim = c(0, 1), xlab = "Months from randomisation", ylab = "Progression-free survival", main = "Progression-free survival by independent review")
for (g in names(cols)) { x <- f1[f1$TRT01P == g, ]; lines(c(0, x$TIME), c(1, x$SURV), type = "s", col = cols[g], lwd = 2) }
legend("topright", legend = names(cols), col = cols, lwd = 2, bty = "n")
`

const tte = (id: string, num: string, what: string, pcd: string, an: string, ref: string): Program => ({
  id, title: `Table ${num}: ${what}`, kind: 'ard', area: 'Efficacy', output: `ard_${id.toLowerCase()}`, keys: ARD_KEYS, ref, needs: ['ADSL', 'ADTTE'],
  intro: `Kaplan-Meier, Cox and log-rank for PARAMCD "${pcd}" by planned treatment (intent-to-treat). Medians in months.`,
  spec: [...ARD_SPEC,
    { name: 'Counts', label: '', derivation: `${an}: n per group; ${an}_EVT and ${an}_CNS: n and pct (CNSR 0 and 1).` },
    { name: 'Median', label: '', derivation: `${an}_MED est, lcl, ucl in months (days / 30.4375): Kaplan-Meier median; 95% CI by Brookmeyer-Crowley with log(-log) limits; a limit that is not reached is left out (NE).` },
    { name: 'Hazard ratio', label: '', derivation: `${an}_HR est, lcl, ucl for ONK-44 against docetaxel: lab_cox(AVAL, 1 - CNSR, ONK indicator), Breslow ties.` },
    { name: 'Log-rank', label: '', derivation: `${an}_P p: unstratified log-rank test with the hypergeometric variance (1 df).` }],
  starter: `# Kaplan-Meier, Cox and log-rank for PARAMCD "${pcd}".\n\nd <- adtte[adtte$PARAMCD == "${pcd}", ]\n\n`, reference: tteTable(pcd, an, `ard_${id.toLowerCase()}`),
  shell: 'Participants; with an event, n (%); censored, n (%); median, months (95% CI); hazard ratio (95% CI); log-rank p-value. Columns: ONK-44 400 mg, Docetaxel.',
})

export const ONK_PROGRAMS: Program[] = [
  { id: 'ADSL', title: 'ADSL: subject-level analysis dataset', kind: 'dataset', area: 'ADaM', output: 'adsl', keys: ['USUBJID'], ref: 'ADaMIG v1.3 section 3', needs: [],
    intro: 'One record per screened participant: planned and actual treatment, the randomisation date from DS, dosing dates and duration, population flags, death and the last date known alive (at most the cut-off, 2026-10-31). Inputs: dm, ds.',
    spec: [
      { name: 'TRT01P / TRT01A', label: 'Planned and actual treatment', derivation: 'DM.ARMCD and DM.ACTARMCD: ONK44 → "ONK-44 400 mg", DOCE → "Docetaxel"; NA for screen failures.' },
      { name: 'RANDDT', label: 'Randomisation date', derivation: 'DSSTDTC of the DS record with DSDECOD "RANDOMIZED".' },
      { name: 'TRTSDT, TRTEDT, TRTDURD', label: 'Dosing', derivation: 'RFXSTDTC and RFXENDTC; duration TRTEDT - TRTSDT + 1 for ONK-44 (daily), + 21 for docetaxel (one 21-day cycle after the last infusion).' },
      { name: 'RANDFL, ITTFL, SAFFL', label: 'Population flags', derivation: 'Randomised when RANDDT is present; ITT = randomised; safety = randomised and dosed.' },
      { name: 'DTHDT, DTHFL, LSTALVDT', label: 'Death and last known alive', derivation: 'DTHDTC (a partial date YYYY-MM is imputed to the first of the month); LSTALVDT = DTHDT, otherwise RFPENDTC capped at the cut-off.' },
      { name: 'Also', label: '', derivation: 'STUDYID, USUBJID, SUBJID, SITEID, AGE, SEX, RACE, COUNTRY from DM; AGEGR1 "<65" or ">=65".' }],
    starter: '# Build adsl from dm and ds.\n\nadsl <- data.frame(USUBJID = dm$USUBJID, stringsAsFactors = FALSE)\n\n', reference: ADSL },
  { id: 'ADTTE', title: 'ADTTE: time-to-event analysis dataset', kind: 'dataset', area: 'ADaM', output: 'adtte', keys: ['USUBJID', 'PARAMCD'], ref: 'ADaM BDS for time-to-event analyses (ADTTE)', needs: ['ADSL'],
    intro: 'Progression-free survival by independent review (PFS) and by the investigator (PFSINV), and overall survival (OS), for the intent-to-treat population, from randomisation, up to the cut-off.',
    spec: [
      { name: 'PFS / PFSINV', label: '', derivation: 'The first RS OVRLRESP of PD (RSEVAL INDEPENDENT ASSESSOR or INVESTIGATOR) or death, whichever is first (CNSR 0, EVNTDESC PROGRESSION or DEATH); otherwise censored (CNSR 1) at the last adequate assessment (CR, PR, SD or NON-CR/NON-PD; NE and scans not done do not count), or at randomisation when there is none.' },
      { name: 'OS', label: '', derivation: 'Death (CNSR 0); otherwise censored at LSTALVDT.' },
      { name: 'AVAL', label: 'Days', derivation: 'ADT - RANDDT + 1. STARTDT = RANDDT.' }],
    starter: '# Build adtte from rs and adsl (ITT).\n\n', reference: ADTTE },
  { id: 'ADRS', title: 'ADRS: best overall response (RECIST 1.1)', kind: 'dataset', area: 'ADaM', output: 'adrs', keys: ['USUBJID', 'PARAMCD'], ref: 'ADaM BDS; RECIST 1.1', needs: ['ADSL'],
    intro: 'Best overall response per intent-to-treat participant, by independent review (BOR) and by the investigator (BORINV).',
    spec: [{ name: 'AVALC', label: 'Best overall response', derivation: 'CR > PR > SD > PD > NE over the overall responses up to and including the first PD, up to the cut-off; SD counts only at 36 days or more after randomisation (5 weeks); no confirmation needed in this randomised study.' }, { name: 'RESPFL', label: '', derivation: '"Y" for CR or PR.' }],
    starter: '# Best overall response by assessor.\n\n', reference: ADRS },
  { id: 'T1', title: 'Table 14.1.1: disposition at the data cut-off (randomised participants)', kind: 'ard', area: 'Safety', output: 'ard_t1', keys: ARD_KEYS, ref: 'SAP 9.1; ICH E3 section 10.1', needs: ['ADSL', 'ADTTE'],
    intro: 'Screened and screen failures (Total only), then by planned treatment and in total: randomised, treated, progression or death by independent review, died, alive at the cut-off.',
    spec: [...ARD_SPEC, { name: 'Analyses', label: '', derivation: 'SCREENED and SCRFAIL (Total, n); POP N; TREATED, PFSEVT, DEATH, ALIVE: n and pct of randomised.' }],
    starter: '# Disposition at the cut-off.\n\n', reference: T1, shell: 'Screened; Screen failures; Randomised; Treated; Progressed or died (independent review); Died; Alive at the data cut-off. Columns: ONK-44 400 mg, Docetaxel, Total.' },
  { id: 'T2', title: 'Table 14.1.2: demographics (intent-to-treat population)', kind: 'ard', area: 'Safety', output: 'ard_t2', keys: ARD_KEYS, ref: 'SAP 9.2; ICH E3 section 11.2', needs: ['ADSL'],
    intro: 'Age, age group, sex, race and country by planned treatment and in total.', spec: [...ARD_SPEC, { name: 'Analyses', label: '', derivation: 'AGE: n, mean, sd, median, min, max; AGEGR1, SEX, RACE, COUNTRY: n and pct by category.' }],
    starter: '# Demographics for the ITT population.\n\n', reference: T2 },
  tte('T3', '14.2.1', 'progression-free survival by independent review (primary endpoint)', 'PFS', 'PFS', 'SAP 9.3 (primary analysis); ICH E3 section 11.4.1'),
  tte('T4', '14.2.2', 'progression-free survival by the investigator (sensitivity analysis)', 'PFSINV', 'PFSINV', 'SAP 9.3.2; ICH E3 section 11.4.1'),
  { id: 'T5', title: 'Table 14.2.3: best overall response (RECIST 1.1)', kind: 'ard', area: 'Efficacy', output: 'ard_t5', keys: ARD_KEYS, ref: 'SAP 9.4; ICH E3 section 11.4.1', needs: ['ADSL', 'ADRS'],
    intro: 'Best overall response by independent review and by the investigator, the objective response rate with an exact 95% CI, the difference with a Wald CI, and the agreement between the two reviews.',
    spec: [...ARD_SPEC, { name: 'Analyses', label: '', derivation: 'N; IRC_BOR and INV_BOR n and pct by category; IRC_ORR and INV_ORR n and pct; *_ORRCI lcl and ucl (binom.test, Clopper-Pearson, in %); *_DIFF est, lcl, ucl (ONK-44 minus docetaxel, Wald, in %); AGREE n and pct (Total).' }],
    starter: '# Best overall response and objective response rates.\n\n', reference: T5 },
  tte('T6', '14.2.4', 'overall survival (secondary endpoint, interim)', 'OS', 'OS', 'SAP 9.4; ICH E3 section 11.4.1'),
  { id: 'T7', title: 'Table 14.3.5: extent of exposure (safety population)', kind: 'ard', area: 'Safety', output: 'ard_t7', keys: ARD_KEYS, ref: 'SAP 9.5; ICH E3 section 12.1', needs: ['ADSL'],
    intro: 'Duration of treatment in days by actual treatment.', spec: [...ARD_SPEC, { name: 'DUR', label: '', derivation: 'TRTDURD for the safety population: n, mean, sd, median, min, max.' }],
    starter: '# Duration of treatment.\n\n', reference: T7 },
  { id: 'ADAE', title: 'ADAE: adverse events (occurrence data structure)', kind: 'dataset', area: 'ADaM', output: 'adae', keys: ['USUBJID', 'AESEQ'], ref: 'ADaM OCCDS IG v1.1', needs: ['ADSL'],
    intro: 'One record per adverse event, with the actual treatment and the safety flag from ADSL, analysis dates, the numeric grade and the treatment-emergent flag. Inputs: ae, adsl.',
    spec: [
      { name: 'ASTDT, AENDT, ASTDY', label: 'Analysis dates', derivation: 'From AESTDTC and AEENDTC (an ongoing event has no AENDT); ASTDY = ASTDT - TRTSDT + 1.' },
      { name: 'ATOXGRN', label: 'Grade (numeric)', derivation: 'as.numeric(AETOXGR), 1 to 5.' },
      { name: 'TRTEMFL', label: 'Treatment-emergent', derivation: '"Y" when ASTDT is on or after TRTSDT and no later than TRTEDT + 30 days (the last daily dose of ONK-44, or the last docetaxel infusion); otherwise "N". A death from an adverse event after that window is still listed (Listing 16.2.7), but is not a TEAE.' },
      { name: 'Also', label: '', derivation: 'STUDYID, USUBJID, AESEQ, AETERM, AEDECOD, AEBODSYS, AETOXGR, AESER, AEREL, AEACN, AEOUT, AESDTH from AE; TRT01A, SAFFL from ADSL. Sorted by USUBJID, AESEQ.' }],
    starter: '# Build adae from ae and adsl.\n\nadae <- merge(ae, adsl[, c("USUBJID", "TRT01A", "TRTSDT", "TRTEDT", "SAFFL")], by = "USUBJID", all.x = TRUE)\n\n', reference: ADAE },
  { id: 'T8', title: 'Table 14.3.1: overview of treatment-emergent adverse events (safety population)', kind: 'ard', area: 'Safety', output: 'ard_t8', keys: ARD_KEYS, ref: 'SAP 9.5; ICH E3 section 12.2', needs: ['ADSL', 'ADAE'],
    intro: 'Participants with at least one TEAE of each kind, by actual treatment and in total: any, related, grade 3 or higher, serious, serious and related, leading to discontinuation, leading to interruption or dose reduction, fatal; and deaths from any cause.',
    spec: [...ARD_SPEC, { name: 'Analyses', label: '', derivation: 'POP N; ANY, REL (AEREL "RELATED"), GR3 (ATOXGRN >= 3), SER, SERREL, DISC (AEACN "DRUG WITHDRAWN"), MOD ("DRUG INTERRUPTED" or "DOSE REDUCED"), FATAL (ATOXGRN 5) on TRTEMFL "Y": participants n and pct; DEATH: ADSL DTHFL "Y", n and pct.' }],
    starter: '# TEAE overview for the safety population.\n\n', reference: T8,
    shell: 'Any TEAE; related; grade 3 or higher; serious; serious and related; leading to discontinuation; leading to interruption or dose reduction; fatal (grade 5); deaths (any cause). n (%). Columns: ONK-44 400 mg, Docetaxel, Total.' },
  { id: 'T9', title: 'Table 14.3.2: treatment-emergent adverse events by system class and preferred term', kind: 'ard', area: 'Safety', output: 'ard_t9', keys: ARD_KEYS, ref: 'SAP 9.5; ICH E3 section 12.2', needs: ['ADSL', 'ADAE'],
    intro: 'Participants with at least one TEAE, then by system class (AEBODSYS) and preferred term (AEDECOD): n and % of the safety population, by actual treatment and in total.',
    spec: [...ARD_SPEC, { name: 'Analyses', label: '', derivation: 'POP N; ANY; SOC (CATEGORY = AEBODSYS); PT (CATEGORY "<AEBODSYS> | <AEDECOD>"): participants n and pct.' }],
    starter: '# TEAEs by system class and preferred term.\n\n', reference: T9,
    shell: 'Participants with at least one TEAE; each system class with its preferred terms indented, by descending frequency in the Total column. n (%).' },
  { id: 'T10', title: 'Table 14.3.3: treatment-emergent adverse events of grade 3 or higher by preferred term', kind: 'ard', area: 'Safety', output: 'ard_t10', keys: ARD_KEYS, ref: 'SAP 9.5; ICH E3 section 12.2', needs: ['ADSL', 'ADAE'],
    intro: 'Participants with at least one TEAE of grade 3 or higher, then by preferred term.',
    spec: [...ARD_SPEC, { name: 'Analyses', label: '', derivation: 'POP N; ANY and PT (CATEGORY = AEDECOD) on TRTEMFL "Y" and ATOXGRN >= 3: participants n and pct.' }],
    starter: '# Grade 3 or higher TEAEs by preferred term.\n\n', reference: T10,
    shell: 'Participants with at least one grade 3 or higher TEAE; each preferred term by descending frequency in the Total column. n (%).' },
  { id: 'L1', title: 'Listing 16.2.7: serious adverse events', kind: 'listing', area: 'Listings', output: 'l1', keys: ['USUBJID', 'AEDECOD', 'ASTDT'], ref: 'ICH E3 section 16.2.7', needs: ['ADSL', 'ADAE'],
    intro: 'Every serious adverse event, treatment-emergent or not, sorted by treatment, participant and start date. Columns: USUBJID, TRT01A, AEDECOD, AEBODSYS, ASTDT, AENDT, ASTDY, AETOXGR, AEREL, AEOUT, TRTEMFL.',
    spec: [{ name: 'Selection', label: '', derivation: 'AESER "Y".' }, { name: 'Sort', label: '', derivation: 'TRT01A, USUBJID, ASTDT.' }],
    starter: '# Serious AEs from adae.\n\n', reference: L1 },
  { id: 'F1', title: 'Figure 14.2.1: Kaplan-Meier plot of progression-free survival by independent review', kind: 'figure', area: 'Figures', output: 'f1', keys: ['TRT01P', 'TIME'], ref: 'SAP 9.3', needs: ['ADSL', 'ADTTE'],
    intro: 'Kaplan-Meier curves of PFS by planned treatment, in months. Build f1 (TRT01P, TIME, NRISK, NEVENT, NCENS, SURV) at each event time, then plot it.',
    spec: [{ name: 'f1', label: 'Plotted data', derivation: 'One row per treatment and event time: TIME in months (rounded to 0.1), the number at risk, events, censored and the Kaplan-Meier estimate.' }],
    starter: '# f1 from the PFS Kaplan-Meier estimates; then plot.\n\n', reference: F1 },
]

export const ONK: StudyPack = {
  id: 'ONK-44-302', short: 'ONK-44 vs docetaxel, NSCLC, second line', sap: 'SAP v1.0',
  title: 'A randomised, open-label, phase 3 study of ONK-44 versus docetaxel in adults with advanced non-small cell lung cancer after one prior platinum-based chemotherapy',
  groups: GROUPS, programs: ONK_PROGRAMS, displays: onkDisplays(GROUPS),
}

// GLV-12-301: a fictional phase 3 trial of GLV-12 5 mg and 10 mg against placebo for 26 weeks in
// type 2 diabetes. Primary endpoint: change from baseline in HbA1c at Week 26.
import { ARD_SPEC, ARD_KEYS, ARD_HEAD, type Program, type StudyPack } from './types'
import { glvDisplays } from '../display'

const G3 = 'c("Placebo", "GLV-12 5 mg", "GLV-12 10 mg")'
const G4 = 'c("Placebo", "GLV-12 5 mg", "GLV-12 10 mg", "Total")'

const ADSL = String.raw`
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
rnd <- ds[ds$DSDECOD == "RANDOMIZED", ]
adsl$RANDDT  <- as.Date(substr(rnd$DSSTDTC[match(adsl$USUBJID, rnd$USUBJID)], 1, 10))
disp <- ds[ds$DSCAT == "DISPOSITION EVENT", ]
i <- match(adsl$USUBJID, disp$USUBJID)
adsl$EOSSTT  <- ifelse(disp$DSDECOD[i] == "COMPLETED", "COMPLETED", "DISCONTINUED")
adsl$DCSREAS <- ifelse(disp$DSDECOD[i] == "COMPLETED", NA, disp$DSDECOD[i])
adsl$EOSDT   <- as.Date(substr(disp$DSSTDTC[i], 1, 10))
hb <- lb[lb$LBTESTCD == "HBA1C" & lb$LBLOBXFL %in% "Y", ]
adsl$HBA1CBL <- hb$LBSTRESN[match(adsl$USUBJID, hb$USUBJID)]
`

const ADAE = String.raw`
adae <- merge(ae, adsl[, c("USUBJID", "TRT01A", "TRT01AN", "TRTSDT", "TRTEDT", "SAFFL")], by = "USUBJID", all.x = TRUE)
st <- adae$AESTDTC
adae$ASTDT  <- as.Date(ifelse(nchar(st) >= 10, substr(st, 1, 10), NA))
adae$AENDT  <- as.Date(ifelse(nchar(adae$AEENDTC) >= 10, substr(adae$AEENDTC, 1, 10), NA))
ym <- !is.na(st) & nchar(st) == 7
if (any(ym)) {
  first <- as.Date(paste0(st[ym], "-01"))
  same <- !is.na(adae$TRTSDT[ym]) & format(adae$TRTSDT[ym], "%Y-%m") == st[ym]
  imp <- ifelse(same, as.numeric(adae$TRTSDT[ym]), as.numeric(first))
  imp <- ifelse(!is.na(adae$AENDT[ym]) & imp > as.numeric(adae$AENDT[ym]), as.numeric(first), imp)
  adae$ASTDT[ym] <- as.Date(imp)
}
adae$ASTDTF <- ifelse(ym, "D", NA)
adae$ASTDY  <- ifelse(adae$ASTDT >= adae$TRTSDT, as.numeric(adae$ASTDT - adae$TRTSDT) + 1, as.numeric(adae$ASTDT - adae$TRTSDT))
adae$TRTEMFL <- ifelse(!is.na(adae$ASTDT) & !is.na(adae$TRTSDT) & adae$ASTDT >= adae$TRTSDT & adae$ASTDT <= adae$TRTEDT + 30, "Y", "N")
adae <- adae[order(adae$USUBJID, adae$AESEQ),
             c("STUDYID", "USUBJID", "AESEQ", "AETERM", "AEDECOD", "AEBODSYS", "AESEV", "AESER", "AEREL",
               "TRT01A", "TRT01AN", "SAFFL", "ASTDT", "ASTDTF", "AENDT", "ASTDY", "TRTEMFL")]
`

const ADLB = String.raw`
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

const ADLBC = String.raw`
x <- lb[lb$LBTESTCD %in% c("ALT", "AST", "BILI", "CREAT", "CHOL", "GLUC") & !(lb$LBTPT %in% "2 H POST-DOSE"),
        c("STUDYID", "USUBJID", "LBSEQ", "LBTESTCD", "LBTEST", "LBSTRESU", "VISITNUM", "LBDTC", "LBSTRESN", "LBSTNRLO", "LBSTNRHI", "LBNRIND", "LBLOBXFL")]
adlbc <- merge(x, adsl[adsl$SAFFL == "Y", c("USUBJID", "TRT01A", "TRT01AN", "SAFFL")], by = "USUBJID")
adlbc$PARAMCD <- adlbc$LBTESTCD
u <- tapply(adlbc$LBSTRESU, adlbc$LBTESTCD, function(x) x[!is.na(x)][1])
adlbc$PARAM   <- paste0(adlbc$LBTEST, " (", u[adlbc$LBTESTCD], ")")
adlbc$AVAL    <- adlbc$LBSTRESN
adlbc$ANRLO   <- adlbc$LBSTNRLO
adlbc$ANRHI   <- adlbc$LBSTNRHI
adlbc$ANRIND  <- adlbc$LBNRIND
adlbc$ADT     <- as.Date(substr(adlbc$LBDTC, 1, 10))
adlbc$AVISITN <- unname(c("1" = 0, "4" = 4, "6" = 12, "9" = 26)[as.character(adlbc$VISITNUM)])
adlbc$AVISIT  <- ifelse(adlbc$AVISITN == 0, "BASELINE", paste("WEEK", adlbc$AVISITN))
adlbc$ABLFL   <- ifelse(adlbc$LBLOBXFL %in% "Y", "Y", NA)
bl <- adlbc[adlbc$ABLFL %in% "Y", ]
k <- match(paste(adlbc$USUBJID, adlbc$PARAMCD), paste(bl$USUBJID, bl$PARAMCD))
adlbc$BASE    <- bl$AVAL[k]
adlbc$BNRIND  <- bl$ANRIND[k]
adlbc$CHG     <- ifelse(adlbc$AVISITN > 0, adlbc$AVAL - adlbc$BASE, NA)
adlbc <- adlbc[order(adlbc$USUBJID, adlbc$PARAMCD, adlbc$AVISITN),
               c("STUDYID", "USUBJID", "TRT01A", "TRT01AN", "SAFFL", "PARAMCD", "PARAM", "AVISIT", "AVISITN", "ADT",
                 "AVAL", "ANRLO", "ANRHI", "ANRIND", "ABLFL", "BASE", "BNRIND", "CHG", "LBSEQ")]
`

const ADVS = String.raw`
x <- vs[vs$VSTESTCD %in% c("SYSBP", "DIABP", "PULSE", "WEIGHT"),
        c("STUDYID", "USUBJID", "VSSEQ", "VSTESTCD", "VSTEST", "VSSTRESU", "VISITNUM", "VISIT", "VSDTC", "VSSTRESN", "VSLOBXFL")]
advs <- merge(x, adsl[adsl$SAFFL == "Y", c("USUBJID", "TRT01A", "TRT01AN", "TRTSDT", "SAFFL")], by = "USUBJID")
advs$PARAMCD <- advs$VSTESTCD
u <- tapply(advs$VSSTRESU, advs$VSTESTCD, function(x) x[!is.na(x)][1])
advs$PARAM   <- paste0(advs$VSTEST, " (", u[advs$VSTESTCD], ")")
advs$AVAL    <- advs$VSSTRESN
advs$ADT     <- as.Date(substr(advs$VSDTC, 1, 10))
advs$ADY     <- ifelse(advs$ADT >= advs$TRTSDT, as.numeric(advs$ADT - advs$TRTSDT) + 1, as.numeric(advs$ADT - advs$TRTSDT))
advs$ABLFL   <- ifelse(advs$VSLOBXFL %in% "Y", "Y", NA)
lo <- c(2, 23, 44, 72, 100, 128, 163); hi <- c(22, 43, 71, 99, 127, 162, 197); wk <- c(2, 4, 8, 12, 16, 20, 26)
w <- findInterval(advs$ADY, lo)
inwin <- !is.na(advs$ADY) & w > 0 & advs$ADY <= hi[pmax(w, 1)]
advs$AVISITN <- ifelse(advs$ABLFL %in% "Y", 0, ifelse(inwin, wk[pmax(w, 1)], NA))
advs$AVISIT  <- ifelse(is.na(advs$AVISITN), NA, ifelse(advs$AVISITN == 0, "BASELINE", paste("WEEK", advs$AVISITN)))
advs$TARGET  <- ifelse(!is.na(advs$AVISITN) & advs$AVISITN > 0, 7 * advs$AVISITN + 1, NA)
o <- order(advs$USUBJID, advs$PARAMCD, advs$AVISITN, abs(advs$ADY - advs$TARGET), -advs$ADY)
s <- advs[o, ]
pick <- !duplicated(s[, c("USUBJID", "PARAMCD", "AVISITN")]) & !is.na(s$AVISITN)
advs$ANL01FL <- NA
advs$ANL01FL[o[pick]] <- "Y"
bl <- advs[advs$ABLFL %in% "Y", ]
advs$BASE    <- bl$AVAL[match(paste(advs$USUBJID, advs$PARAMCD), paste(bl$USUBJID, bl$PARAMCD))]
advs$CHG     <- ifelse(!is.na(advs$AVISITN) & advs$AVISITN > 0, advs$AVAL - advs$BASE, NA)
advs <- advs[order(advs$USUBJID, advs$PARAMCD, advs$ADT, advs$VSSEQ),
             c("STUDYID", "USUBJID", "TRT01A", "TRT01AN", "SAFFL", "PARAMCD", "PARAM", "VISIT", "ADT", "ADY",
               "AVISIT", "AVISITN", "AVAL", "ABLFL", "BASE", "CHG", "ANL01FL", "VSSEQ")]
`

const ADCM = String.raw`
x <- cm[, c("STUDYID", "USUBJID", "CMSEQ", "CMTRT", "CMDECOD", "CMCLAS", "CMINDC", "CMSTDTC", "CMENDTC", "CMENRTPT")]
adcm <- merge(x, adsl[adsl$SAFFL == "Y", c("USUBJID", "TRT01A", "TRT01AN", "TRTSDT", "TRTEDT", "SAFFL")], by = "USUBJID")
n <- nchar(adcm$CMSTDTC)
adcm$ASTDT  <- as.Date(ifelse(!is.na(n) & n >= 10, substr(adcm$CMSTDTC, 1, 10),
                       ifelse(!is.na(n) & n == 7, paste0(adcm$CMSTDTC, "-01"),
                       ifelse(!is.na(n) & n == 4, paste0(adcm$CMSTDTC, "-01-01"), NA))))
adcm$ASTDTF <- ifelse(!is.na(n) & n == 7, "D", ifelse(!is.na(n) & n == 4, "M", NA))
adcm$AENDT  <- as.Date(ifelse(!is.na(adcm$CMENDTC) & nchar(adcm$CMENDTC) >= 10, substr(adcm$CMENDTC, 1, 10), NA))
adcm$PREFL  <- ifelse(!is.na(adcm$ASTDT) & adcm$ASTDT < adcm$TRTSDT, "Y", NA)
adcm$ONTRTFL <- ifelse(!is.na(adcm$ASTDT) & adcm$ASTDT <= adcm$TRTEDT &
                       (adcm$CMENRTPT %in% "ONGOING" | is.na(adcm$AENDT) | adcm$AENDT >= adcm$TRTSDT), "Y", NA)
adcm <- adcm[order(adcm$USUBJID, adcm$CMSEQ),
             c("STUDYID", "USUBJID", "CMSEQ", "CMTRT", "CMDECOD", "CMCLAS", "CMINDC", "TRT01A", "TRT01AN", "SAFFL",
               "ASTDT", "ASTDTF", "AENDT", "CMENRTPT", "PREFL", "ONTRTFL")]
`

const ADTTE = String.raw`
a <- adsl[adsl$SAFFL == "Y", ]
te <- adae[adae$TRTEMFL == "Y" & !is.na(adae$ASTDT), ]
ev <- tapply(te$ASTDT, te$USUBJID, min)[a$USUBJID]
cut <- pmin(a$TRTEDT + 30, a$EOSDT, na.rm = TRUE)
t1 <- data.frame(USUBJID = a$USUBJID, PARAMCD = "TTAE", PARAM = "Time to first treatment-emergent adverse event (days)",
                 STARTDT = a$TRTSDT, ADT = as.Date(ifelse(is.na(ev), cut, ev)), CNSR = ifelse(is.na(ev), 1, 0),
                 EVNTDESC = ifelse(is.na(ev), NA, "FIRST TREATMENT-EMERGENT ADVERSE EVENT"),
                 CNSDTDSC = ifelse(is.na(ev), "END OF TEAE WINDOW OR END OF STUDY, WHICHEVER IS FIRST", NA), stringsAsFactors = FALSE)
disc <- a$EOSSTT == "DISCONTINUED"
t2 <- data.frame(USUBJID = a$USUBJID, PARAMCD = "TTDISC", PARAM = "Time to discontinuation from the study (days)",
                 STARTDT = a$TRTSDT, ADT = a$EOSDT, CNSR = ifelse(disc, 0, 1),
                 EVNTDESC = ifelse(disc, a$DCSREAS, NA), CNSDTDSC = ifelse(disc, NA, "COMPLETED THE STUDY"), stringsAsFactors = FALSE)
adtte <- rbind(t1, t2)
adtte$AVAL <- as.numeric(adtte$ADT - adtte$STARTDT) + 1
k <- match(adtte$USUBJID, a$USUBJID)
adtte$STUDYID <- a$STUDYID[k]; adtte$TRT01A <- a$TRT01A[k]; adtte$TRT01AN <- a$TRT01AN[k]; adtte$SAFFL <- "Y"
adtte <- adtte[order(adtte$PARAMCD, adtte$USUBJID),
               c("STUDYID", "USUBJID", "TRT01A", "TRT01AN", "SAFFL", "PARAMCD", "PARAM", "STARTDT", "ADT", "AVAL", "CNSR", "EVNTDESC", "CNSDTDSC")]
`

const T1 = String.raw`
pop <- adsl[adsl$SAFFL == "Y", ]
pop$GRP <- pop$TRT01A
groups <- ${G4}
${ARD_HEAD}for (g in groups) {
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

const T2 = String.raw`
pop <- adsl[adsl$SAFFL == "Y", ]
te  <- adae[adae$TRTEMFL == "Y" & adae$SAFFL == "Y", ]
groups <- ${G4}
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
ard_t2 <- do.call(rbind, rows)
`

const T3 = String.raw`
d <- adlb[adlb$AVISITN == 26 & !is.na(adlb$CHG) & adlb$ANL01FL == "Y", ]
d$TRT <- factor(d$TRT01PN, levels = c(1, 2, 3), labels = ${G3})
fit <- lm(CHG ~ TRT + BASE, data = d)
nd <- data.frame(TRT = factor(levels(d$TRT), levels = levels(d$TRT)), BASE = mean(d$BASE))
pr <- predict(fit, newdata = nd, se.fit = TRUE)
${ARD_HEAD}for (i in seq_along(levels(d$TRT))) {
  g <- levels(d$TRT)[i]; x <- d[d$TRT == g, ]
  add("BASE", g, NA, "n", nrow(x)); add("BASE", g, NA, "mean", mean(x$BASE)); add("BASE", g, NA, "sd", sd(x$BASE))
  add("CHG", g, NA, "n", nrow(x)); add("CHG", g, NA, "mean", mean(x$CHG)); add("CHG", g, NA, "sd", sd(x$CHG))
  add("LSMEAN", g, NA, "est", pr$fit[i]); add("LSMEAN", g, NA, "se", pr$se.fit[i])
}
ci <- confint(fit)
co <- summary(fit)$coefficients
for (g in c("GLV-12 5 mg", "GLV-12 10 mg")) {
  term <- paste0("TRT", g)
  add("DIFF", g, NA, "est", co[term, "Estimate"]); add("DIFF", g, NA, "lcl", ci[term, 1]); add("DIFF", g, NA, "ucl", ci[term, 2]); add("DIFF", g, NA, "p", co[term, "Pr(>|t|)"])
}
ard_t3 <- do.call(rbind, rows)
`

const T4 = String.raw`
r <- adsl[adsl$RANDFL == "Y", ]
groups <- ${G4}
${ARD_HEAD}add("SCREENED", "Total", NA, "n", nrow(adsl))
add("SCRFAIL", "Total", NA, "n", sum(adsl$RANDFL == "N"))
reasons <- sort(unique(r$DCSREAS[r$EOSSTT == "DISCONTINUED"]))
for (g in groups) {
  d <- if (g == "Total") r else r[r$TRT01P == g, ]
  N <- nrow(d)
  add("POP", g, NA, "N", N)
  k <- sum(d$SAFFL == "Y"); add("TREATED", g, NA, "n", k); add("TREATED", g, NA, "pct", 100 * k / N)
  k <- sum(d$EOSSTT == "COMPLETED"); add("COMPLETED", g, NA, "n", k); add("COMPLETED", g, NA, "pct", 100 * k / N)
  k <- sum(d$EOSSTT == "DISCONTINUED"); add("DISC", g, NA, "n", k); add("DISC", g, NA, "pct", 100 * k / N)
  for (rs in reasons) { k <- sum(d$DCSREAS %in% rs); add("DCSREAS", g, rs, "n", k); add("DCSREAS", g, rs, "pct", 100 * k / N) }
}
ard_t4 <- do.call(rbind, rows)
`

const T5 = String.raw`
pop <- adsl[adsl$SAFFL == "Y", ]
groups <- ${G4}
cats <- c("1-28 days", "29-84 days", "85-182 days", ">182 days")
pop$DURCAT <- cut(pop$TRTDURD, c(0, 28, 84, 182, Inf), labels = cats)
${ARD_HEAD}for (g in groups) {
  d <- if (g == "Total") pop else pop[pop$TRT01A == g, ]
  N <- nrow(d); x <- d$TRTDURD
  add("POP", g, NA, "N", N)
  add("DUR", g, NA, "n", sum(!is.na(x))); add("DUR", g, NA, "mean", mean(x)); add("DUR", g, NA, "sd", sd(x))
  add("DUR", g, NA, "median", median(x)); add("DUR", g, NA, "min", min(x)); add("DUR", g, NA, "max", max(x))
  for (c in cats) { k <- sum(d$DURCAT == c); add("DURCAT", g, c, "n", k); add("DURCAT", g, c, "pct", 100 * k / N) }
  add("PYEARS", g, NA, "est", sum(x) / 365.25)
}
ard_t5 <- do.call(rbind, rows)
`

const T6 = String.raw`
d <- adlbc[adlbc$AVISITN == 26 & !is.na(adlbc$ANRIND) & !is.na(adlbc$BNRIND), ]
groups <- ${G3}
lev <- c("LOW", "NORMAL", "HIGH")
${ARD_HEAD}for (p in sort(unique(adlbc$PARAMCD))) for (g in groups) {
  x <- d[d$PARAMCD == p & d$TRT01A == g, ]
  N <- nrow(x); add("N", g, p, "n", N)
  for (b in lev) for (a in lev) {
    k <- sum(x$BNRIND == b & x$ANRIND == a)
    add("SHIFT", g, paste(p, b, a, sep = " | "), "n", k); add("SHIFT", g, paste(p, b, a, sep = " | "), "pct", if (N > 0) 100 * k / N else NA)
  }
}
ard_t6 <- do.call(rbind, rows)
`

const T7 = String.raw`
d <- advs[advs$ANL01FL %in% "Y" & advs$AVISITN %in% 26 & !is.na(advs$CHG), ]
groups <- ${G3}
${ARD_HEAD}for (p in sort(unique(advs$PARAMCD))) for (g in groups) {
  x <- d[d$PARAMCD == p & d$TRT01A == g, ]
  for (v in c("BASE", "AVAL", "CHG")) {
    add(v, g, p, "n", nrow(x)); add(v, g, p, "mean", mean(x[[v]])); add(v, g, p, "sd", sd(x[[v]]))
  }
}
ard_t7 <- do.call(rbind, rows)
`

const T8 = String.raw`
pop <- adsl[adsl$SAFFL == "Y", ]
on <- adcm[adcm$ONTRTFL %in% "Y", ]
groups <- ${G4}
${ARD_HEAD}for (g in groups) {
  N <- if (g == "Total") nrow(pop) else sum(pop$TRT01A == g)
  d <- if (g == "Total") on else on[on$TRT01A == g, ]
  add("POP", g, NA, "N", N)
  k <- length(unique(d$USUBJID)); add("ANY", g, NA, "n", k); add("ANY", g, NA, "pct", 100 * k / N)
  for (cl in sort(unique(on$CMCLAS))) {
    k <- length(unique(d$USUBJID[d$CMCLAS == cl])); add("CLASS", g, cl, "n", k); add("CLASS", g, cl, "pct", 100 * k / N)
    for (dr in sort(unique(on$CMDECOD[on$CMCLAS == cl]))) {
      k <- length(unique(d$USUBJID[d$CMCLAS == cl & d$CMDECOD == dr]))
      add("DRUG", g, paste(cl, dr, sep = " | "), "n", k); add("DRUG", g, paste(cl, dr, sep = " | "), "pct", 100 * k / N)
    }
  }
}
ard_t8 <- do.call(rbind, rows)
`

const T9 = String.raw`
d <- adlb[adlb$AVISITN > 0 & !is.na(adlb$CHG), ]
d$TRT <- factor(d$TRT01PN, levels = c(1, 2, 3), labels = ${G3})
d$AVISIT <- factor(d$AVISITN, levels = c(4, 12, 26))
fit <- lab_mmrm(CHG ~ TRT * AVISIT + BASE * AVISIT, d, subject = "USUBJID", visit = "AVISIT")
mb <- mean(d$BASE[!duplicated(d$USUBJID)])
nd <- function(g, v) data.frame(TRT = g, AVISIT = v, BASE = mb)
${ARD_HEAD}for (g in levels(d$TRT)) add("N", g, NA, "n", length(unique(d$USUBJID[d$TRT == g])))
for (v in c("4", "12", "26")) {
  for (g in levels(d$TRT)) { e <- lab_estimate(fit, nd(g, v)); add("LSMEAN", g, paste("WEEK", v), "est", e[["est"]]); add("LSMEAN", g, paste("WEEK", v), "se", e[["se"]]) }
  for (g in levels(d$TRT)[-1]) {
    e <- lab_estimate(fit, nd(g, v), nd("Placebo", v))
    for (s in c("est", "lcl", "ucl", "p")) add("DIFF", g, paste("WEEK", v), s, e[[s]])
  }
}
ard_t9 <- do.call(rbind, rows)
`

const T10 = String.raw`
itt <- adsl[adsl$ITTFL == "Y", c("USUBJID", "TRT01PN", "HBA1CBL")]
w26 <- adlb[adlb$AVISITN == 26 & !is.na(adlb$CHG), c("USUBJID", "CHG")]
d <- merge(itt, w26, by = "USUBJID", all.x = TRUE)
d <- d[order(d$USUBJID), ]
d$BASE <- d$HBA1CBL
d$TRT <- factor(d$TRT01PN, levels = c(1, 2, 3), labels = ${G3})
miss <- is.na(d$CHG)
ref <- lm(CHG ~ BASE, data = d[d$TRT == "Placebo" & !miss, ])
b <- coef(ref); V <- vcov(ref); s <- sigma(ref); df <- ref$df.residual
M <- 50
set.seed(20260301)
est <- matrix(NA, M, 2); var <- matrix(NA, M, 2)
for (m in 1:M) {
  sm <- s * sqrt(df / rchisq(1, df))
  bm <- b + drop(t(chol(V * (sm / s)^2)) %*% rnorm(2))
  x <- d
  x$CHG[miss] <- bm[1] + bm[2] * x$BASE[miss] + rnorm(sum(miss), 0, sm)
  co <- summary(lm(CHG ~ TRT + BASE, data = x))$coefficients
  est[m, ] <- co[c("TRTGLV-12 5 mg", "TRTGLV-12 10 mg"), "Estimate"]
  var[m, ] <- co[c("TRTGLV-12 5 mg", "TRTGLV-12 10 mg"), "Std. Error"]^2
}
${ARD_HEAD}add("N", "Total", NA, "n", nrow(d)); add("NMISS", "Total", NA, "n", sum(miss)); add("M", "Total", NA, "n", M)
for (j in 1:2) {
  g <- c("GLV-12 5 mg", "GLV-12 10 mg")[j]
  Q <- mean(est[, j]); W <- mean(var[, j]); B <- var(est[, j]); Tt <- W + (1 + 1 / M) * B
  nu <- (M - 1) * (1 + W / ((1 + 1 / M) * B))^2
  q <- qt(0.975, nu)
  add("DIFF", g, NA, "est", Q); add("DIFF", g, NA, "se", sqrt(Tt)); add("DIFF", g, NA, "lcl", Q - q * sqrt(Tt)); add("DIFF", g, NA, "ucl", Q + q * sqrt(Tt))
  add("DIFF", g, NA, "p", 2 * pt(-abs(Q / sqrt(Tt)), nu)); add("DIFF", g, NA, "df", nu)
}
ard_t10 <- do.call(rbind, rows)
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

const T11 = String.raw`${KM}
d <- adtte[adtte$PARAMCD == "TTAE", ]
groups <- ${G3}
${ARD_HEAD}for (g in groups) {
  x <- d[d$TRT01A == g, ]
  add("N", g, NA, "n", nrow(x)); add("EVENTS", g, NA, "n", sum(x$CNSR == 0)); add("CENSORED", g, NA, "n", sum(x$CNSR == 1))
  k <- km(x$AVAL, 1 - x$CNSR); k <- k[k$NEVENT > 0, ]
  z <- qnorm(0.975); se <- sqrt(k$GW) / abs(log(k$SURV))
  lo <- exp(-exp(log(-log(k$SURV)) + z * se)); hi <- exp(-exp(log(-log(k$SURV)) - z * se))
  first <- function(ok) if (any(ok, na.rm = TRUE)) k$TIME[which(ok)[1]] else NA
  add("MEDIAN", g, NA, "est", first(k$SURV <= 0.5)); add("MEDIAN", g, NA, "lcl", first(lo <= 0.5)); add("MEDIAN", g, NA, "ucl", first(hi <= 0.5))
}
cx <- lab_cox(d$AVAL, 1 - d$CNSR, cbind(D5 = as.numeric(d$TRT01A == "GLV-12 5 mg"), D10 = as.numeric(d$TRT01A == "GLV-12 10 mg")))
for (j in 1:2) { g <- groups[j + 1]; for (s in c("hr", "lcl", "ucl", "p")) add("HR", g, NA, s, cx[j, s]) }
ev <- d[d$CNSR == 0, ]; O <- E <- numeric(3); V <- matrix(0, 3, 3)
for (u in sort(unique(ev$AVAL))) {
  at <- d$AVAL >= u; n <- sum(at); dt <- sum(ev$AVAL == u)
  nj <- sapply(groups, function(g) sum(at & d$TRT01A == g)); dj <- sapply(groups, function(g) sum(ev$AVAL == u & ev$TRT01A == g))
  O <- O + dj; E <- E + dt * nj / n
  if (n > 1) V <- V + dt * (n - dt) / (n - 1) * (diag(nj / n) - outer(nj / n, nj / n))
}
x2 <- drop(t((O - E)[1:2]) %*% solve(V[1:2, 1:2]) %*% (O - E)[1:2])
add("LOGRANK", "Total", NA, "chisq", x2); add("LOGRANK", "Total", NA, "p", pchisq(x2, 2, lower.tail = FALSE))
ard_t11 <- do.call(rbind, rows)
`

const L1 = String.raw`
l1 <- adae[adae$AESER == "Y", c("USUBJID", "TRT01A", "AEDECOD", "AEBODSYS", "ASTDT", "AENDT", "ASTDY", "AESEV", "AEREL", "TRTEMFL")]
l1 <- l1[order(l1$TRT01A, l1$USUBJID, l1$ASTDT), ]
`

const F1 = String.raw`
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

const F2 = String.raw`${KM}
d <- adtte[adtte$PARAMCD == "TTAE", ]
groups <- ${G3}
f2 <- do.call(rbind, lapply(groups, function(g) { x <- d[d$TRT01A == g, ]; k <- km(x$AVAL, 1 - x$CNSR); data.frame(TRT01A = g, k[, c("TIME", "NRISK", "NEVENT", "NCENS", "SURV")], stringsAsFactors = FALSE) }))
cols <- c("Placebo" = "grey40", "GLV-12 5 mg" = "steelblue", "GLV-12 10 mg" = "darkorange")
ticks <- seq(0, 196, by = 28)
par(mar = c(9, 5, 3, 1))
plot(NA, xlim = c(0, 196), ylim = c(0, 1), xaxt = "n", xlab = "", ylab = "Probability of no TEAE", main = "Time to first treatment-emergent adverse event")
axis(1, at = ticks); mtext("Days since first dose", side = 1, line = 2.2)
for (g in groups) {
  x <- f2[f2$TRT01A == g, ]
  lines(c(0, x$TIME), c(1, x$SURV), type = "s", col = cols[g], lwd = 2)
  cz <- x[x$NCENS > 0, ]; points(cz$TIME, cz$SURV, pch = 3, col = cols[g])
}
legend("topright", legend = groups, col = cols, lwd = 2, bty = "n")
mtext("Number at risk", side = 1, line = 4, adj = 0, cex = 0.8, font = 2)
for (i in seq_along(groups)) {
  x <- d[d$TRT01A == groups[i], ]
  mtext(sapply(ticks, function(t) sum(x$AVAL >= t)), side = 1, line = 4 + i, at = ticks, cex = 0.8, col = cols[groups[i]])
}
`

const F3 = String.raw`
d <- adlb[adlb$AVISITN == 26 & !is.na(adlb$CHG), ]
d <- merge(d, adsl[, c("USUBJID", "AGEGR1", "SEX")], by = "USUBJID")
d$BLGR <- ifelse(d$BASE < 8.5, "<8.5%", ">=8.5%")
d$TRT <- factor(d$TRT01PN, levels = c(1, 2, 3), labels = ${G3})
subs <- list(c("Overall", "All", ""), c("Age group", "<65", "AGEGR1"), c("Age group", ">=65", "AGEGR1"),
             c("Sex", "F", "SEX"), c("Sex", "M", "SEX"), c("Baseline HbA1c", "<8.5%", "BLGR"), c("Baseline HbA1c", ">=8.5%", "BLGR"))
f3 <- do.call(rbind, lapply(subs, function(s) {
  x <- if (s[3] == "") d else d[d[[s[3]]] == s[2], ]
  fit <- lm(CHG ~ TRT + BASE, data = x); ci <- confint(fit)
  data.frame(SUBGROUP = s[1], LEVEL = s[2], N = sum(x$TRT %in% c("Placebo", "GLV-12 10 mg")),
             EST = coef(fit)[["TRTGLV-12 10 mg"]], LCL = ci["TRTGLV-12 10 mg", 1], UCL = ci["TRTGLV-12 10 mg", 2], stringsAsFactors = FALSE)
}))
y <- rev(seq_len(nrow(f3)))
par(mar = c(5, 12, 3, 2))
plot(f3$EST, y, xlim = range(c(0, f3$LCL, f3$UCL)), ylim = c(0.5, nrow(f3) + 0.5), pch = 15, yaxt = "n", ylab = "",
     xlab = "Difference from placebo in HbA1c change at Week 26 (95% CI)", main = "GLV-12 10 mg vs placebo by subgroup")
segments(f3$LCL, y, f3$UCL, y); abline(v = 0, lty = 3)
axis(2, at = y, labels = paste0(f3$SUBGROUP, ": ", f3$LEVEL, " (n=", f3$N, ")"), las = 1, cex.axis = 0.8)
`

const tab = (id: string, title: string, area: 'Safety' | 'Efficacy', ref: string, needs: string[], intro: string, extra: { name: string; label: string; derivation: string }[], starter: string, reference: string, shell?: string): Program =>
  ({ id, title, kind: 'ard', area, output: `ard_${id.toLowerCase()}`, keys: ARD_KEYS, ref, needs, intro, spec: [...ARD_SPEC, ...extra], starter, reference, shell })

export const GLV_PROGRAMS: Program[] = [
  {
    id: 'ADSL', title: 'ADSL: subject-level analysis dataset', kind: 'dataset', area: 'ADaM', output: 'adsl', keys: ['USUBJID'], ref: 'ADaMIG v1.3 section 3', needs: [],
    intro: 'One record per screened participant, with the treatment variables, dates, population flags, disposition and baseline values every analysis needs. Inputs: dm, ds, lb.',
    spec: [
      { name: 'STUDYID, USUBJID, SUBJID, SITEID, AGE, AGEU, SEX, RACE, ETHNIC, COUNTRY', label: 'From DM', derivation: 'Copied from DM.' },
      { name: 'AGEGR1 / AGEGR1N', label: 'Pooled age group 1', derivation: '"<65" (1) when AGE < 65, otherwise ">=65" (2).' },
      { name: 'TRT01P / TRT01PN', label: 'Planned treatment', derivation: 'DM.ARM; N: Placebo 1, GLV-12 5 mg 2, GLV-12 10 mg 3. Missing for screen failures.' },
      { name: 'TRT01A / TRT01AN', label: 'Actual treatment', derivation: 'DM.ACTARM, numbered the same way.' },
      { name: 'TRTSDT / TRTEDT', label: 'First and last dose dates', derivation: 'Date part of DM.RFXSTDTC and DM.RFXENDTC, as R Dates.' },
      { name: 'TRTDURD', label: 'Treatment duration (days)', derivation: 'TRTEDT - TRTSDT + 1.' },
      { name: 'RANDFL / ITTFL', label: 'Randomised / intent-to-treat flag', derivation: '"Y" when DM.ARMCD is not missing, else "N". ITTFL = RANDFL.' },
      { name: 'SAFFL', label: 'Safety population flag', derivation: '"Y" when randomised and TRTSDT is not missing (took at least one dose), else "N".' },
      { name: 'RANDDT', label: 'Date of randomisation', derivation: 'Date part of DSSTDTC on the DS record with DSDECOD "RANDOMIZED".' },
      { name: 'EOSSTT / DCSREAS / EOSDT', label: 'End of study status, reason and date', derivation: 'From the DS record with DSCAT "DISPOSITION EVENT": "COMPLETED" when DSDECOD is COMPLETED, else "DISCONTINUED" with DCSREAS = DSDECOD (NA when completed); EOSDT = date part of its DSSTDTC.' },
      { name: 'HBA1CBL', label: 'Baseline HbA1c (%)', derivation: 'LB.LBSTRESN for LBTESTCD "HBA1C" on the record with LBLOBXFL "Y".' },
    ],
    starter: '# Build adsl from dm, ds and lb (they are loaded already).\n# Keep one row per row of dm. Dates as R Dates: as.Date(substr(x, 1, 10)).\n\nadsl <- data.frame(USUBJID = dm$USUBJID, stringsAsFactors = FALSE)\n\n',
    reference: ADSL,
  },
  {
    id: 'ADAE', title: 'ADAE: adverse events (occurrence data structure)', kind: 'dataset', area: 'ADaM', output: 'adae', keys: ['USUBJID', 'AESEQ'], ref: 'ADaM OCCDS IG v1.1', needs: ['ADSL'],
    intro: 'One record per adverse event, with the treatment from ADSL, analysis dates (with imputation of partial start dates) and the treatment-emergent flag. Inputs: ae and the validated adsl.',
    spec: [
      { name: 'STUDYID, USUBJID, AESEQ, AETERM, AEDECOD, AEBODSYS, AESEV, AESER, AEREL', label: 'From AE', derivation: 'Copied from AE (coded terms included).' },
      { name: 'TRT01A, TRT01AN, SAFFL', label: 'From ADSL', derivation: 'Merged by USUBJID.' },
      { name: 'ASTDT / ASTDTF', label: 'Analysis start date and its imputation flag', derivation: 'Complete AESTDTC: its date part. Partial (YYYY-MM): the first dose date TRTSDT when it falls in that month, otherwise the first day of the month; but never later than AENDT (then the first of the month). ASTDTF = "D" when the day was imputed (SAP section 9.6).' },
      { name: 'AENDT', label: 'Analysis end date', derivation: 'Date part of AEENDTC when complete; not imputed.' },
      { name: 'ASTDY', label: 'Analysis start relative day', derivation: 'ASTDT - TRTSDT + 1 when on or after TRTSDT, ASTDT - TRTSDT before it (there is no day 0).' },
      { name: 'TRTEMFL', label: 'Treatment-emergent flag', derivation: '"Y" when ASTDT is on or after TRTSDT and no later than TRTEDT + 30 days (SAP section 9.4), else "N".' },
    ],
    starter: '# Build adae from ae and adsl. One row per AE record; sort by USUBJID, AESEQ.\n# One AE has a partial start date: impute it as the specification says.\n\nadae <- merge(ae, adsl[, c("USUBJID", "TRT01A", "TRT01AN", "TRTSDT", "TRTEDT", "SAFFL")], by = "USUBJID", all.x = TRUE)\n\n',
    reference: ADAE,
  },
  {
    id: 'ADLB', title: 'ADLB: HbA1c (basic data structure)', kind: 'dataset', area: 'ADaM', output: 'adlb', keys: ['USUBJID', 'PARAMCD', 'AVISITN'], ref: 'ADaMIG v1.3 section 3.3', needs: ['ADSL'],
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
    reference: ADLB,
  },
  {
    id: 'ADLBC', title: 'ADLBC: laboratory chemistry for safety (BDS)', kind: 'dataset', area: 'ADaM', output: 'adlbc', keys: ['USUBJID', 'PARAMCD', 'AVISITN'], ref: 'ADaMIG v1.3 section 3.3', needs: ['ADSL'],
    intro: 'Safety chemistry (ALT, AST, creatinine, cholesterol, fasting glucose) for the safety population, with the reference range indicator at baseline and at each visit, for the shift table. Inputs: lb and the validated adsl.',
    spec: [
      { name: 'Records', label: '', derivation: 'LBTESTCD in ALT, AST, BILI, CREAT, CHOL, GLUC, excluding the 2-hour post-dose glucose samples (LBTPT "2 H POST-DOSE"), which the SAP analyses separately. Safety population only.' },
      { name: 'PARAMCD / PARAM', label: 'Parameter', derivation: 'LBTESTCD / "<LBTEST> (<unit>)", where the unit is the parameter\'s LBSTRESU (tests not done have none, but PARAM is the same on every record of a parameter).' },
      { name: 'AVAL, ANRLO, ANRHI, ANRIND', label: 'Value and reference range', derivation: 'LBSTRESN, LBSTNRLO, LBSTNRHI, LBNRIND.' },
      { name: 'ADT, AVISITN, AVISIT', label: 'Date and analysis visit', derivation: 'As in ADLB: VISITNUM 1, 4, 6, 9 → 0, 4, 12, 26.' },
      { name: 'ABLFL, BASE, BNRIND, CHG', label: 'Baseline', derivation: 'ABLFL "Y" where LBLOBXFL "Y". BASE and BNRIND: AVAL and ANRIND of that participant\'s baseline record for the parameter. CHG after baseline.' },
      { name: 'Also', label: '', derivation: 'STUDYID, USUBJID, TRT01A, TRT01AN, SAFFL, LBSEQ.' },
    ],
    starter: '# Safety chemistry from lb for the safety population. Drop the 2-hour post-dose glucose samples.\n\nx <- lb[lb$LBTESTCD %in% c("ALT", "AST", "BILI", "CREAT", "CHOL", "GLUC"), ]\n\n',
    reference: ADLBC,
  },
  {
    id: 'ADVS', title: 'ADVS: vital signs with analysis windows (BDS)', kind: 'dataset', area: 'ADaM', output: 'advs', keys: ['USUBJID', 'VSSEQ'], ref: 'ADaMIG v1.3 section 3.3; SAP 9.5', needs: ['ADSL'],
    intro: 'Blood pressure, pulse and weight for the safety population. Visits are re-assigned to analysis windows by study day, so unscheduled visits count, and one record per window is chosen for analysis (ANL01FL). Inputs: vs and the validated adsl.',
    spec: [
      { name: 'Records', label: '', derivation: 'VSTESTCD in SYSBP, DIABP, PULSE, WEIGHT; safety population. Keep every record.' },
      { name: 'PARAMCD / PARAM / AVAL / ADT', label: '', derivation: 'VSTESTCD / "<VSTEST> (<unit>)", the unit being the parameter\'s VSSTRESU, the same on every record / VSSTRESN / date part of VSDTC.' },
      { name: 'ADY', label: 'Analysis relative day', derivation: 'ADT - TRTSDT + 1 on or after TRTSDT, ADT - TRTSDT before.' },
      { name: 'AVISITN / AVISIT', label: 'Analysis window', derivation: 'Baseline record (VSLOBXFL "Y"): 0 "BASELINE". Others by ADY: 2–22 → week 2, 23–43 → 4, 44–71 → 8, 72–99 → 12, 100–127 → 16, 128–162 → 20, 163–197 → 26; outside every window: NA.' },
      { name: 'ANL01FL', label: 'Record chosen for the window', derivation: '"Y" on one record per USUBJID, PARAMCD and AVISITN: the one closest to the target day (7 × week + 1); on a tie, the later one. "Y" on the baseline record. NA otherwise.' },
      { name: 'ABLFL, BASE, CHG', label: '', derivation: 'ABLFL "Y" on the baseline record; BASE its AVAL; CHG = AVAL - BASE on post-baseline records inside a window.' },
      { name: 'Also', label: '', derivation: 'STUDYID, USUBJID, TRT01A, TRT01AN, SAFFL, VISIT, VSSEQ.' },
    ],
    starter: '# Vital signs with analysis windows. Unscheduled visits fall into the window that contains their study day.\n\nx <- vs[vs$VSTESTCD %in% c("SYSBP", "DIABP", "PULSE", "WEIGHT"), ]\n\n',
    reference: ADVS,
  },
  {
    id: 'ADCM', title: 'ADCM: concomitant medications (occurrence data structure)', kind: 'dataset', area: 'ADaM', output: 'adcm', keys: ['USUBJID', 'CMSEQ'], ref: 'ADaM OCCDS IG v1.1', needs: ['ADSL'],
    intro: 'Medications for the safety population, with partial start dates imputed and the prior and on-treatment flags. Inputs: cm and the validated adsl.',
    spec: [
      { name: 'STUDYID, USUBJID, CMSEQ, CMTRT, CMDECOD, CMCLAS, CMINDC, CMENRTPT', label: 'From CM', derivation: 'Copied from CM. CMCLAS is the drug class (a level of the ATC classification in a full drug dictionary).' },
      { name: 'ASTDT / ASTDTF', label: 'Start date and imputation flag', derivation: 'Complete: date part. YYYY-MM: first of the month, ASTDTF "D". YYYY: 1 January, ASTDTF "M".' },
      { name: 'AENDT', label: 'End date', derivation: 'Date part of CMENDTC when complete, else NA.' },
      { name: 'PREFL', label: 'Prior medication flag', derivation: '"Y" when ASTDT is before TRTSDT.' },
      { name: 'ONTRTFL', label: 'On-treatment flag', derivation: '"Y" when ASTDT is on or before TRTEDT and the medication was ongoing (CMENRTPT "ONGOING"), has no end date, or ended on or after TRTSDT. A medication can be both prior and on treatment.' },
      { name: 'Also', label: '', derivation: 'TRT01A, TRT01AN, SAFFL from ADSL.' },
    ],
    starter: '# Concomitant medications for the safety population. Watch the partial start dates.\n\nadcm <- merge(cm, adsl[adsl$SAFFL == "Y", c("USUBJID", "TRT01A", "TRT01AN", "TRTSDT", "TRTEDT", "SAFFL")], by = "USUBJID")\n\n',
    reference: ADCM,
  },
  {
    id: 'ADTTE', title: 'ADTTE: time-to-event analysis dataset', kind: 'dataset', area: 'ADaM', output: 'adtte', keys: ['USUBJID', 'PARAMCD'], ref: 'ADaM BDS for time-to-event analyses (ADTTE)', needs: ['ADSL', 'ADAE'],
    intro: 'Two time-to-event parameters for the safety population: time to the first treatment-emergent adverse event, and time to discontinuation from the study. CNSR is 0 for an event and 1 for a censored time.',
    spec: [
      { name: 'TTAE', label: 'Time to first TEAE', derivation: 'Event: the earliest ASTDT of a TEAE (TRTEMFL "Y"). Without one: censored at TRTEDT + 30 or EOSDT, whichever is first. EVNTDESC "FIRST TREATMENT-EMERGENT ADVERSE EVENT"; CNSDTDSC "END OF TEAE WINDOW OR END OF STUDY, WHICHEVER IS FIRST".' },
      { name: 'TTDISC', label: 'Time to discontinuation', derivation: 'Event: EOSSTT "DISCONTINUED" at EOSDT, EVNTDESC = DCSREAS. Completers: censored at EOSDT, CNSDTDSC "COMPLETED THE STUDY".' },
      { name: 'STARTDT, ADT, AVAL, CNSR', label: '', derivation: 'STARTDT = TRTSDT. AVAL = ADT - STARTDT + 1 (days). CNSR 0 event, 1 censored.' },
      { name: 'Also', label: '', derivation: 'STUDYID, USUBJID, TRT01A, TRT01AN, SAFFL, PARAMCD, PARAM ("Time to first treatment-emergent adverse event (days)", "Time to discontinuation from the study (days)").' },
    ],
    starter: '# Two parameters, TTAE and TTDISC, one record per participant each (safety population).\n\na <- adsl[adsl$SAFFL == "Y", ]\n\n',
    reference: ADTTE,
  },
  tab('T1', 'Table 14.1.2: demographics (safety population)', 'Safety', 'SAP 9.2; CDISC Analysis Results Standard', ['ADSL'],
    'Demographics by actual treatment and in total for the safety population: age (n, mean, SD, median, min, max), age group, sex and race (n and %). Build the analysis results data (ARD); the lab draws the table from it.', [],
    '# Safety population, columns by TRT01A plus "Total".\n# One row per result: ANALYSIS, GROUP, CATEGORY, STAT, VALUE (unrounded).\n# POP/N for the column headers; AGE n, mean, sd, median, min, max; AGEGR1, SEX, RACE n and pct.\n\npop <- adsl[adsl$SAFFL == "Y", ]\n\n', T1,
    'Rows: Age (years): n; Mean (SD); Median; Min, Max. Age group, n (%): <65, >=65. Sex, n (%). Race, n (%). Columns: Placebo, GLV-12 5 mg, GLV-12 10 mg, Total (N=xx). Mean to 1 decimal, SD to 2; percentages to 1 decimal.'),
  tab('T4', 'Table 14.1.1: disposition (randomised participants)', 'Safety', 'SAP 9.1; ICH E3 section 10.1', ['ADSL'],
    'Screened and screen-failed participants (Total column only), then for randomised participants by planned treatment and in total: treated, completed the study, discontinued, and each reason for discontinuation (n and %).',
    [{ name: 'Analyses', label: '', derivation: 'SCREENED and SCRFAIL (Total only, n); POP (N randomised); TREATED (SAFFL "Y"), COMPLETED, DISC: n and pct; DCSREAS by reason (CATEGORY = reason): n and pct. Every reason in every column, zeros included.' }],
    '# Randomised participants by TRT01P plus "Total"; screening counts in Total only.\n\nr <- adsl[adsl$RANDFL == "Y", ]\n\n', T4,
    'Screened; Screen failures; Randomised (N); Treated; Completed the study; Discontinued from the study; Primary reason: one row per reason. Columns: Placebo, GLV-12 5 mg, GLV-12 10 mg, Total. n (%), % of randomised.'),
  tab('T5', 'Table 14.3.5: extent of exposure (safety population)', 'Safety', 'SAP 9.4.1', ['ADSL'],
    'Duration of treatment (TRTDURD): n, mean, SD, median, min, max; duration categories; total exposure in participant-years.',
    [{ name: 'Analyses', label: '', derivation: 'POP (N); DUR (n, mean, sd, median, min, max of TRTDURD); DURCAT with categories "1-28 days", "29-84 days", "85-182 days", ">182 days" (n, pct); PYEARS est = sum(TRTDURD) / 365.25.' }],
    '# Safety population by TRT01A plus "Total".\n\npop <- adsl[adsl$SAFFL == "Y", ]\n\n', T5),
  tab('T2', 'Table 14.3.1: treatment-emergent adverse events by system class and preferred term', 'Safety', 'SAP 9.4', ['ADSL', 'ADAE'],
    'Participants with at least one treatment-emergent AE, then by system class (AEBODSYS) and preferred term (AEDECOD): n and % of the safety population in each group. A participant counts once per row.',
    [{ name: 'CATEGORY for PT rows', label: '', derivation: '"<AEBODSYS> | <AEDECOD>".' }],
    '# Treatment-emergent (TRTEMFL "Y") AEs in the safety population; denominators from adsl.\n# ANALYSIS: POP (N), ANY, SOC, PT. Count participants, not events.\n\n', T2,
    'Participants with at least one TEAE; then each system class, with its preferred terms indented, sorted by descending frequency in the Total column. n (%).'),
  tab('T6', 'Table 14.3.4: shift from baseline to Week 26 in laboratory reference range (chemistry)', 'Safety', 'SAP 9.4.3', ['ADSL', 'ADLBC'],
    'For each chemistry parameter and actual treatment: participants with both a baseline and a Week 26 range indicator, cross-classified LOW / NORMAL / HIGH at baseline against Week 26.',
    [{ name: 'Analyses', label: '', derivation: 'N (CATEGORY = PARAMCD): participants with BNRIND and a Week 26 ANRIND. SHIFT (CATEGORY "<PARAMCD> | <baseline> | <week 26>") for all nine combinations of LOW, NORMAL, HIGH: n and pct of N (NA when N is 0). Groups: the three treatments, no Total.' }],
    '# Week 26 records of adlbc with BNRIND and ANRIND present; every combination, zeros included.\n\n', T6),
  tab('T7', 'Table 14.3.6: vital signs, change from baseline at Week 26', 'Safety', 'SAP 9.5', ['ADSL', 'ADVS'],
    'For each vital sign and actual treatment, on the records chosen for the Week 26 window (ANL01FL "Y") with a change: baseline, Week 26 value and change (n, mean, SD).',
    [{ name: 'Analyses', label: '', derivation: 'BASE, AVAL, CHG with CATEGORY = PARAMCD: n, mean, sd. Groups: the three treatments.' }],
    '# advs records with ANL01FL "Y", AVISITN 26 and a non-missing CHG.\n\n', T7),
  tab('T8', 'Table 14.3.7: concomitant medications on treatment by drug class and name', 'Safety', 'SAP 9.4.4', ['ADSL', 'ADCM'],
    'Participants taking at least one medication on treatment (ONTRTFL "Y"), then by drug class (CMCLAS) and standardised name (CMDECOD): n and % of the safety population.',
    [{ name: 'Analyses', label: '', derivation: 'POP (N), ANY, CLASS (CATEGORY = CMCLAS), DRUG (CATEGORY "<CMCLAS> | <CMDECOD>"): n and pct; participants counted once per row. Groups: three treatments and Total.' }],
    '# On-treatment medications from adcm; denominators from adsl (safety population).\n\n', T8),
  tab('T3', 'Table 14.2.1: HbA1c change from baseline at Week 26 (ANCOVA)', 'Efficacy', 'SAP 9.3 (primary analysis, observed cases)', ['ADSL', 'ADLB'],
    'Change from baseline in HbA1c at Week 26, analysed with ANCOVA (treatment as a factor, baseline HbA1c as a covariate), observed cases. Report n, mean and SD of baseline and change; least-squares means at the mean baseline with their standard errors; the difference of each GLV-12 dose from placebo with its 95% confidence interval and p-value.',
    [{ name: 'Model', label: '', derivation: 'lm(CHG ~ TRT + BASE) with TRT a factor with placebo as the reference level. LSMEAN est and se: predict() at each treatment with BASE = mean baseline of the analysis set. DIFF est, lcl, ucl, p: the TRT coefficients, confint() and their p-values.' }],
    '# Week 26, CHG not missing. Make TRT a factor with Placebo first.\n# fit <- lm(CHG ~ TRT + BASE, data = d)\n\nd <- adlb[adlb$AVISITN == 26 & !is.na(adlb$CHG), ]\n\n', T3,
    'Baseline: n; Mean (SD). Change at Week 26: n; Mean (SD); LS mean (SE); Difference from placebo (95% CI); p-value. Columns: Placebo, GLV-12 5 mg, GLV-12 10 mg.'),
  tab('T9', 'Table 14.2.2: HbA1c change from baseline by visit, MMRM (primary estimand)', 'Efficacy', 'SAP 9.3.1; ICH E9(R1)', ['ADSL', 'ADLB'],
    'The primary estimand as the SAP now defines it: the effect of treatment had participants stayed on treatment without rescue (hypothetical strategy for discontinuation). Analysed with a mixed model for repeated measures on all post-baseline visits, unstructured covariance, which uses every participant with at least one post-baseline value under missing at random. Use the lab library\'s lab_mmrm() and lab_estimate().',
    [{ name: 'Model', label: '', derivation: 'lab_mmrm(CHG ~ TRT * AVISIT + BASE * AVISIT, d, subject = "USUBJID", visit = "AVISIT") on ADLB records with AVISITN > 0 and CHG not missing; TRT a factor with Placebo first, AVISIT a factor with levels 4, 12, 26.' },
      { name: 'Results', label: '', derivation: 'N per TRT (participants in the model). For each visit (CATEGORY "WEEK 4", "WEEK 12", "WEEK 26"): LSMEAN est and se for each treatment, at BASE = mean baseline over participants in the model (one value each); DIFF est, lcl, ucl, p for each dose minus placebo.' }],
    '# MMRM: lab_mmrm() fits it; lab_estimate(fit, new1, new0) gives a mean or a difference.\n\nd <- adlb[adlb$AVISITN > 0 & !is.na(adlb$CHG), ]\n\n', T9),
  tab('T10', 'Table 14.2.3: sensitivity analysis, placebo-based multiple imputation', 'Efficacy', 'SAP 9.3.2; ICH E9(R1)', ['ADSL', 'ADLB'],
    'A sensitivity analysis to the missing-at-random assumption: every intent-to-treat participant without a Week 26 value has it imputed as if they had been on placebo (a reference-based approach), 50 times; each completed dataset is analysed with the ANCOVA and the results combined with Rubin\'s rules.',
    [{ name: 'Data', label: '', derivation: 'One row per ITT participant (sorted by USUBJID): TRT from TRT01PN, BASE = HBA1CBL, CHG at Week 26 or missing.' },
      { name: 'Imputation model', label: '', derivation: 'ref <- lm(CHG ~ BASE) on placebo participants with CHG. b, V, s, df: its coefficients, vcov, sigma and residual df.' },
      { name: 'Draws (exact order)', label: '', derivation: 'set.seed(20260301) once. For m in 1:50: sm <- s * sqrt(df / rchisq(1, df)); bm <- b + t(chol(V * (sm / s)^2)) %*% rnorm(2); missing CHG <- bm[1] + bm[2] * BASE + rnorm(number missing, 0, sm), in row order; then lm(CHG ~ TRT + BASE) and keep each dose\'s estimate and squared SE.' },
      { name: 'Rubin\'s rules', label: '', derivation: 'Q = mean of estimates; W = mean of variances; B = variance of estimates; T = W + (1 + 1/M) B; df = (M - 1)(1 + W / ((1 + 1/M) B))^2. DIFF est, se = sqrt(T), lcl, ucl (t quantile with df), p, df. Also N, NMISS, M in the Total group.' }],
    '# Placebo-based multiple imputation. The order of random draws matters: follow the specification exactly.\n\nitt <- adsl[adsl$ITTFL == "Y", ]\n\n', T10),
  tab('T11', 'Table 14.3.8: time to first treatment-emergent adverse event', 'Safety', 'SAP 9.4.5', ['ADSL', 'ADTTE'],
    'Kaplan-Meier analysis of PARAMCD "TTAE": participants, events and censored; median time with its 95% CI; hazard ratio of each dose against placebo from a Cox model; and the log-rank test across the three groups.',
    [{ name: 'Kaplan-Meier', label: '', derivation: 'Product-limit estimate at each event time, Greenwood variance. Median: first event time where S <= 0.5. 95% CI for the median: first event times where the upper and lower log(-log) pointwise limits fall to 0.5 or below (Brookmeyer-Crowley); NA if never.' },
      { name: 'Cox model', label: '', derivation: 'lab_cox(AVAL, 1 - CNSR, cbind(D5, D10)) with indicator variables for the 5 mg and 10 mg groups (Breslow ties). HR hr, lcl, ucl, p for each dose.' },
      { name: 'Log-rank', label: '', derivation: 'Three-group test: observed minus expected events and their covariance summed over event times; chi-square with 2 degrees of freedom. LOGRANK chisq and p in the Total group.' }],
    '# Kaplan-Meier, Cox and log-rank for PARAMCD "TTAE", groups by TRT01A.\n\nd <- adtte[adtte$PARAMCD == "TTAE", ]\n\n', T11),
  {
    id: 'L1', title: 'Listing 16.2.7: serious adverse events', kind: 'listing', area: 'Listings', output: 'l1', keys: ['USUBJID', 'AEDECOD', 'ASTDT'], ref: 'ICH E3 section 16.2.7', needs: ['ADSL', 'ADAE'],
    intro: 'Every serious adverse event, whether treatment-emergent or not, sorted by treatment, participant and start date. Columns: USUBJID, TRT01A, AEDECOD, AEBODSYS, ASTDT, AENDT, ASTDY, AESEV, AEREL, TRTEMFL.',
    spec: [{ name: 'Selection', label: '', derivation: 'AESER "Y".' }, { name: 'Sort', label: '', derivation: 'TRT01A, USUBJID, ASTDT.' }],
    starter: '# Serious AEs from adae.\n\n', reference: L1,
  },
  {
    id: 'F1', title: 'Figure 14.2.2: mean change from baseline in HbA1c by visit', kind: 'figure', area: 'Figures', output: 'f1', keys: ['TRT01P', 'AVISITN'], ref: 'SAP 9.3', needs: ['ADSL', 'ADLB'],
    intro: 'Mean change from baseline (with standard error bars) at Weeks 4, 12 and 26 by planned treatment, observed cases. Build f1 (TRT01P, AVISITN, MEAN, SE) and draw the plot from it with base R graphics.',
    spec: [{ name: 'f1', label: 'Plotted data', derivation: 'One row per TRT01P and AVISITN > 0: MEAN = mean(CHG), SE = sd(CHG) / sqrt(n).' }, { name: 'Plot', label: '', derivation: 'Lines with points by treatment, error bars of ±1 SE, a reference line at 0, axis labels and a legend.' }],
    starter: '# f1: TRT01P, AVISITN, MEAN, SE; then plot it.\n\nd <- adlb[adlb$AVISITN > 0 & !is.na(adlb$CHG), ]\n\n', reference: F1,
  },
  {
    id: 'F2', title: 'Figure 14.3.8: Kaplan-Meier plot of time to first TEAE, with numbers at risk', kind: 'figure', area: 'Figures', output: 'f2', keys: ['TRT01A', 'TIME'], ref: 'SAP 9.4.5', needs: ['ADSL', 'ADTTE'],
    intro: 'The Kaplan-Meier curves of PARAMCD "TTAE" by actual treatment, with censored times marked and the number at risk every 28 days under the plot. Build f2 (one row per group and distinct time) and draw from it.',
    spec: [{ name: 'f2', label: 'Plotted data', derivation: 'For each TRT01A and each distinct AVAL (events and censored): TIME, NRISK (AVAL >= TIME), NEVENT, NCENS, SURV (product-limit, changes only at event times).' },
      { name: 'Plot', label: '', derivation: 'Step curves from (0, 1); "+" at censored times; x axis 0–196 days by 28; numbers at risk at those days under the axis, one line per group.' }],
    starter: '# f2: TRT01A, TIME, NRISK, NEVENT, NCENS, SURV; then the plot and the numbers at risk.\n\nd <- adtte[adtte$PARAMCD == "TTAE", ]\n\n', reference: F2,
  },
  {
    id: 'F3', title: 'Figure 14.2.4: forest plot of the treatment effect by subgroup', kind: 'figure', area: 'Figures', output: 'f3', keys: ['SUBGROUP', 'LEVEL'], ref: 'SAP 9.3.3 (subgroups)', needs: ['ADSL', 'ADLB'],
    intro: 'The difference of GLV-12 10 mg from placebo in HbA1c change at Week 26 (ANCOVA, observed cases) overall and within subgroups of age, sex and baseline HbA1c, drawn as a forest plot.',
    spec: [{ name: 'f3', label: 'Plotted data', derivation: 'Rows in this order: Overall/All; Age group <65, >=65 (AGEGR1); Sex F, M; Baseline HbA1c <8.5%, >=8.5% (BASE < 8.5). In each subset fit lm(CHG ~ TRT + BASE) with all three groups; EST, LCL, UCL for TRT "GLV-12 10 mg"; N = participants in the subset in placebo or 10 mg.' },
      { name: 'Plot', label: '', derivation: 'One row per subgroup: the estimate as a square, the CI as a line, a reference line at 0, labels with n.' }],
    starter: '# f3: SUBGROUP, LEVEL, N, EST, LCL, UCL; then the forest plot.\n\nd <- adlb[adlb$AVISITN == 26 & !is.na(adlb$CHG), ]\n\n', reference: F3,
  },
]

export const GLV: StudyPack = {
  id: 'GLV-12-301', short: 'GLV-12 vs placebo, type 2 diabetes, 26 weeks', sap: 'SAP v2.0',
  title: 'A randomised, double-blind, placebo-controlled phase 3 study of GLV-12 5 mg and 10 mg once daily for 26 weeks in adults with type 2 diabetes',
  groups: ['Placebo', 'GLV-12 5 mg', 'GLV-12 10 mg'], programs: GLV_PROGRAMS, displays: glvDisplays,
}

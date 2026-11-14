import { useState } from 'react'
import { Panel } from './ui'

interface Lesson { id: string; title: string; body: React.ReactNode }
const code = (s: string) => <pre className="text-xs font-mono whitespace-pre-wrap bg-white text-slate-900 rounded p-2">{s}</pre>
const LESSONS: Lesson[] = [
  { id: 'flow', title: 'From SDTM to the clinical study report', body: <>
    <p>SDTM tabulates what was collected. Analysis needs more: derived variables, populations, baselines, windows. ADaM (the Analysis Data Model) holds those derivations, one step from the analysis, so a reviewer can trace each result back: <b>SDTM → ADaM → analysis results → display</b>.</p>
    <p>ADaMIG v1.3 has been supported by FDA since 18 July 2022 and required in its Data Standards Catalog for studies starting after 15 March 2024. Its three structures are used here: <b>ADSL</b> (subject level), <b>BDS</b> (basic data structure, ADLB) and <b>OCCDS</b> (occurrence data, ADAE).</p>
  </> },
  { id: 'adsl', title: 'ADSL: one record per participant', body: <>
    <p>Every analysis dataset merges ADSL's variables in. It holds the treatment variables (TRT01P planned, TRT01A actual), the dates of first and last dose (TRTSDT, TRTEDT), the population flags and the baseline characteristics.</p>
    <ul className="list-disc pl-5"><li><b>RANDFL</b>: randomised (ARMCD not missing and not a screen failure).</li><li><b>ITTFL</b>: intent-to-treat; here, all randomised participants, analysed as randomised.</li><li><b>SAFFL</b>: safety; randomised and took at least one dose, analysed as treated.</li></ul>
    {code('adsl$TRTSDT <- as.Date(substr(ex_first$EXSTDTC, 1, 10))\nadsl$SAFFL  <- ifelse(adsl$RANDFL == "Y" & !is.na(adsl$TRTSDT), "Y", "N")')}
  </> },
  { id: 'adae', title: 'ADAE and the treatment-emergent flag', body: <>
    <p>An adverse event is treatment-emergent if it starts on or after the first dose and no later than the end of the window the SAP defines; in GLV-12-301, 30 days after the last dose. Events after the window, or before the first dose, are listed but not counted in the TEAE tables.</p>
    <p>Tables count <b>participants</b>, not events: a participant with nausea twice is one participant with nausea. Use <code>length(unique(USUBJID))</code>, not <code>nrow()</code> or <code>sum()</code>.</p>
  </> },
  { id: 'bds', title: 'BDS: parameter, visit, baseline and change', body: <>
    <p>A BDS dataset has one record per participant, parameter (PARAMCD) and analysis visit (AVISITN), with the analysis value AVAL. The baseline record carries ABLFL "Y"; BASE is copied onto every record of that participant and parameter, and CHG = AVAL − BASE after baseline.</p>
    {code('base <- adlb[adlb$ABLFL %in% "Y", c("USUBJID", "PARAMCD", "AVAL")]\nnames(base)[3] <- "BASE"\nadlb <- merge(adlb, base, by = c("USUBJID", "PARAMCD"), all.x = TRUE)\nadlb$CHG <- ifelse(adlb$AVISITN > 0, adlb$AVAL - adlb$BASE, NA)')}
  </> },
  { id: 'ancova', title: 'The primary analysis: ANCOVA in base R', body: <>
    <p>The change from baseline in HbA1c at week 26 is modelled with treatment as a factor and baseline as a covariate. LS means are the model's predictions for each treatment at the mean baseline; the difference from placebo is the treatment coefficient when placebo is the reference level.</p>
    {code('d$TRT <- factor(d$TRT01P, levels = c("Placebo", "GLV-12 5 mg", "GLV-12 10 mg"))\nfit <- lm(CHG ~ TRT + BASE, data = d)\nnd  <- data.frame(TRT = levels(d$TRT), BASE = mean(d$BASE))\npredict(fit, nd, se.fit = TRUE)\nconfint(fit)["TRTGLV-12 10 mg", ]')}
    <p>A commercial statistics package's general linear model procedure, with its least-squares means, gives the same numbers for this model; the lab uses base R so it runs anywhere.</p>
  </> },
  { id: 'windows', title: 'Imputed dates and analysis windows', body: <>
    <p>Real data are untidy. An adverse event may have only a month and a year; a medication started "in 2020"; a visit happened on day 33 instead of day 29, or at an unscheduled visit. The SAP says what to do, and ADaM records that it was done.</p>
    <ul className="list-disc pl-5"><li><b>Partial dates</b>: a missing day is imputed (here: the first dose date if it falls in that month, otherwise the first of the month), and the flag ASTDTF = "D" says so. Without it, the event silently drops out of every table.</li>
      <li><b>Analysis windows</b>: each record is assigned to a window by its study day, so unscheduled visits count. When a window has two records, a rule picks one (closest to the target day; on a tie, the later one) and ANL01FL = "Y" marks it.</li></ul>
  </> },
  { id: 'mmrm', title: 'Estimands and MMRM', body: <>
    <p>ICH E9(R1) asks what question a trial answers: the <b>estimand</b>. Its attributes are the treatment, the population, the variable, the handling of intercurrent events (discontinuation, rescue medication) and the population-level summary. A hypothetical strategy asks what would have happened without the intercurrent event; a treatment-policy strategy uses the values whatever happened; a composite strategy counts the event as a failure.</p>
    <p>For a repeated continuous endpoint like HbA1c, the usual primary analysis is a <b>mixed model for repeated measures</b>: change from baseline at every visit, with treatment, visit, their interaction, baseline and baseline-by-visit, and an unstructured covariance between visits. It uses every participant with any post-baseline value and is valid if data are missing at random.</p>
    {code('fit <- lab_mmrm(CHG ~ TRT * AVISIT + BASE * AVISIT, d, subject = "USUBJID", visit = "AVISIT")\nlab_estimate(fit, data.frame(TRT = "GLV-12 10 mg", AVISIT = "26", BASE = mb),\n                  data.frame(TRT = "Placebo",      AVISIT = "26", BASE = mb))')}
    <p>The lab library fits it by restricted maximum likelihood in base R; with complete data its estimates equal the ANCOVA at each visit. Its degrees of freedom are simpler than the Kenward-Roger method most packages use, so p-values can differ slightly.</p>
  </> },
  { id: 'mi', title: 'Sensitivity: multiple imputation', body: <>
    <p>Missing at random is an assumption. A sensitivity analysis asks how the conclusion changes if it is wrong. In a <b>reference-based</b> (placebo-based) multiple imputation, missing values in every group are imputed as if the participants had been on placebo, many times; each completed dataset is analysed and the results combined with <b>Rubin's rules</b>: the mean estimate, and a variance that adds the between-imputation spread to the average within-imputation variance.</p>
    <p>Because imputation draws random numbers, the program fixes the seed and the order of the draws, so QC can reproduce it exactly.</p>
  </> },
  { id: 'tte', title: 'Time to event: ADTTE, Kaplan-Meier, Cox', body: <>
    <p>ADTTE is a BDS dataset with one record per participant and parameter: AVAL is the time (days from STARTDT), CNSR is 0 for an event and 1 for a censored time, and EVNTDESC or CNSDTDSC say which. The Kaplan-Meier estimate multiplies, at each event time, the share of those still at risk who did not have the event; the median is the first time the curve reaches 0.5. The log-rank test compares the curves; the Cox model gives a hazard ratio. Plots show the number at risk under the axis.</p>
    <p>The lab's numbers were checked against an established survival library: medians, their confidence limits, hazard ratios and the log-rank test agree.</p>
  </> },
  { id: 'ard', title: 'Analysis results data, then the display', body: <>
    <p>Tables here are built in two steps. First the program computes every number as <b>analysis results data</b> (ARD): one row per analysis, group, category and statistic, unrounded. Then the display is drawn from it, rounding only at that point. This is the approach of CDISC's Analysis Results Standard (ARS), published in April 2024, whose metadata describe each analysis (set, variable, selection, grouping, method) as data.</p>
    <p>An ARD can be compared row by row with an independent one, regenerated when the data change, and reused for other displays.</p>
  </> },
  { id: 'qc', title: 'Double programming and QC', body: <>
    <p>For each output a second programmer writes an independent program from the same specification, without reading the first one. The outputs are compared (with a compare procedure, or diffdf and similar packages in R) and each difference is resolved: the cause is found, the wrong program fixed, and the resolution logged.</p>
    <p>A difference is a question, not a finding. Some differences are in the display only (sort order, rounding); a QC log records discrepancies in results, with evidence.</p>
  </> },
  { id: 'workflow', title: 'How the work runs in a company', body: <>
    <ul className="list-disc pl-5 space-y-1">
      <li><b>Specifications and shells first.</b> Analysis dataset specifications and the SAP's mock shells are agreed before programming starts.</li>
      <li><b>Programming tracker.</b> Every output has a production programmer, a QC programmer and a status: in development, ready for QC, QC issues, validated. Changing validated code reopens it.</li>
      <li><b>Logs.</b> A batch run produces a log per program; it is reviewed for errors, warnings and notes before QC. Programs carry a header: program, purpose, author, inputs, outputs, modification history.</li>
      <li><b>Dry runs.</b> Before database lock, outputs are produced on dummy treatment codes so the structure can be checked blind. At unblinding everything is rerun; at each new data transfer, too, and the changes are explained.</li>
      <li><b>Submission.</b> ADaM datasets go with define.xml (Define-XML 2.1), the analysis data reviewer's guide (the PHUSE template), conformance results with explanations, and the programs.</li>
      <li><b>AI assistants.</b> Drafts from an AI tool are treated like any other unvalidated code: reviewed, tested against an independent program, and their use recorded (context of use, risk, verification), as the FDA draft guidance of January 2025 and the EMA–FDA principles of January 2026 describe.</li>
    </ul>
  </> },
  { id: 'r', title: 'R in regulatory submissions', body: <>
    <p>FDA accepts submissions with R code: its Statistical Software Clarifying Statement says no particular software is required. The R Consortium's R Submissions Working Group has sent pilot submissions to FDA: pilot 1 (R-based TLFs), pilot 2 (a Shiny app), pilot 3 (ADaM datasets in R) and pilot 4 (the Shiny app delivered through WebAssembly, as webR does here, and in containers). Pilot 5 tests Dataset-JSON; pilots 6 and 7 began in 2026.</p>
    <p>Validated R work usually relies on packages (the pharmaverse: admiral for ADaM; cards, gtsummary, Tplyr or rtables for tables). This lab's references use <b>base R only</b>, so every derivation is visible in code; the optional package mode (Runs page) installs webR builds of packages for you to use.</p>
  </> },
]
export default function Learn() {
  const [id, setId] = useState(LESSONS[0].id)
  const l = LESSONS.find((x) => x.id === id)!
  return (
    <div className="grid lg:grid-cols-[15rem_1fr] gap-4">
      <Panel title="Lessons"><ul className="space-y-0.5">{LESSONS.map((x, i) => <li key={x.id}><button onClick={() => setId(x.id)} aria-current={id === x.id ? 'true' : undefined} className={`w-full text-left px-2 py-1 rounded text-xs ${id === x.id ? 'bg-lab-fda-soft text-lab-fda' : 'hover:bg-lab-panel-strong'}`}>{i + 1}. {x.title}</button></li>)}</ul></Panel>
      <Panel title={l.title}><div className="text-sm space-y-2 max-w-3xl">{l.body}</div></Panel>
    </div>
  )
}

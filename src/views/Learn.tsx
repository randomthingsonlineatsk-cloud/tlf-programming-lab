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
    <p>SAS's PROC GLM LSMEANS gives the same numbers for this model; the lab uses base R so it runs anywhere.</p>
  </> },
  { id: 'ard', title: 'Analysis results data, then the display', body: <>
    <p>Tables here are built in two steps. First the program computes every number as <b>analysis results data</b> (ARD): one row per analysis, group, category and statistic, unrounded. Then the display is drawn from it, rounding only at that point. This is the approach of CDISC's Analysis Results Standard (ARS), published in April 2024, whose metadata describe each analysis (set, variable, selection, grouping, method) as data.</p>
    <p>An ARD can be compared row by row with an independent one, regenerated when the data change, and reused for other displays.</p>
  </> },
  { id: 'qc', title: 'Double programming and QC', body: <>
    <p>For each output a second programmer writes an independent program from the same specification, without reading the first one. The outputs are compared (PROC COMPARE in SAS, diffdf or similar in R) and each difference is resolved: the cause is found, the wrong program fixed, and the resolution logged.</p>
    <p>A difference is a question, not a finding. Some differences are in the display only (sort order, rounding); a QC log records discrepancies in results, with evidence.</p>
  </> },
  { id: 'r', title: 'R in regulatory submissions', body: <>
    <p>FDA accepts submissions with R code: its Statistical Software Clarifying Statement says no particular software is required. The R Consortium's R Submissions Working Group has sent pilot submissions to FDA: pilot 1 (R-based TLFs), pilot 2 (a Shiny app), pilot 3 (ADaM datasets in R) and pilot 4 (the Shiny app delivered through WebAssembly, as webR does here, and in containers). Pilot 5 tests Dataset-JSON; pilots 6 and 7 began in 2026.</p>
    <p>Validated R work usually relies on packages (admiral for ADaM, gtsummary, Tplyr or rtables for tables). This lab uses <b>base R only</b>, so every derivation is visible in your own code.</p>
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

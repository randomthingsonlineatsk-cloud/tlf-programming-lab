# TLF Programming Lab

Program the analysis of a clinical trial in R, in the browser: derive ADaM datasets from an SDTM
hand-off, produce the tables, listings and figures of the clinical study report, and check each
output by independent double programming.

**Live:** https://randomthingsonlineatsk-cloud.github.io/tlf-programming-lab/

## What it covers

Two fictional studies: GLV-12-301 (type 2 diabetes, shipped with the app) and HRP-301 (VERDANT-1,
hand eczema), the study of the pharmolecule lifecycle journey, from the learner's own SDTM hand-off.

- **ADaM** (ADaMIG v1.3): ADSL, ADAE and ADCM (occurrence data, with partial-date imputation and
  flags), ADLB, ADLBC and ADVS (basic data structure, with analysis windows and record selection),
  ADTTE (time to event), and ADQS with responder criteria for HRP-301.
- **Tables, listings, figures**: demographics, disposition, exposure, adverse events, lab shift,
  vital signs, concomitant medications; the primary ANCOVA, an MMRM for the ICH E9(R1) estimand
  (unstructured covariance, REML), a placebo-based multiple-imputation sensitivity analysis with
  Rubin's rules, Kaplan-Meier with log-rank and Cox, responder analyses with non-responder
  imputation; an SAE listing; mean-change, Kaplan-Meier (with numbers at risk) and forest plots.
- **Mock shells and RTF**: each table shows its SAP shell and checks the layout; displays download
  as RTF or HTML, drawn from analysis results data (ARD).
- **Trace a number**: click a cell to see the ARD row, the analysis records and the SDTM records.
- **Independent QC**: every program is compared, record by record, with a reference program
  written separately to the same specification; a QC mission plants errors in a production table.
- **Programming tracker, batch runs and log review**: statuses from development to validated,
  issues, program headers, log scanning, CSV export.
- **Data cuts**: a blinded dry run on dummy treatment codes, unblinding, a second data transfer,
  and a comparison of outputs across runs.
- **Submission**: ADaM conformance checks, define.xml (Define-XML 2.1), the analysis data
  reviewer's guide (PHUSE template sections), analysis results as JSON shaped after CDISC's
  Analysis Results Standard, and an analysis package that the hub's lifecycle journey checks.
- **Agency information requests**, **validating an AI-written program** (with a model card and an
  AI use record), and a **code review** done without running the code.
- **Optional package mode**: installs webR builds of packages (pharmaverse and others) on request.
- **Missions and certificate**: five core and five workflow missions at guided, standard or expert
  level; the certificate (core missions plus three workflow missions) verifies in the Skills Passport.

The lab library (`lab_mmrm`, `lab_estimate`, `lab_cox`) is base R; its results are checked in the
tests against complete-data ANCOVA and an established survival library.

## How it works

R 4.6 runs in the browser through [webR](https://docs.r-wasm.org/webr/). The runtime is copied from
the `webr` npm package into `public/webr` at build time and served from this site. Programs use
base R only. The data come from the SDTM Mapping Trainer's hand-off (Dataset-JSON v1.1); a hand-off
of the fictional study GLV-12-301 ships with the app, and you can upload your own export.

```
npm ci
npm run dev      # or: npm run build && npm run preview
npm test         # domain tests and the R programs, run through webR in Node
```

Part of the [pharmolecule](https://randomthingsonlineatsk-cloud.github.io/pharmolecule/) training apps.

Training only. The study and data are fictional; this is not a validated system.

Built by Khan Gulrez Shagufa Fazal Ahmed. Apache-2.0; see LICENSE and NOTICE.

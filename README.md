# TLF Programming Lab

Program the analysis of a clinical trial in R, in the browser: derive ADaM datasets from an SDTM
hand-off, produce the tables, listings and figures of the clinical study report, and check each
output by independent double programming.

**Live:** https://randomthingsonlineatsk-cloud.github.io/tlf-programming-lab/

## What it covers

- **ADaM** (ADaMIG v1.3): ADSL (subject level, population flags), ADAE (occurrence data with the
  treatment-emergent flag and a 30-day window), ADLB (basic data structure: parameter, analysis
  visit, baseline, change).
- **Tables, listings, figures**: demographics, participants with TEAEs by system class and preferred
  term, the ANCOVA of the primary endpoint (LS means and differences from placebo with 95% CI),
  a serious adverse event listing and a mean-change figure drawn with base R graphics.
- **Analysis results data**: tables are computed as ARD (one row per analysis, group, category and
  statistic) and drawn from it; the analysis results metadata of two analyses is recorded in the
  spirit of CDISC's Analysis Results Standard and exported as JSON.
- **Independent QC**: every program is compared, record by record, with a reference program written
  separately to the same specification. A QC mission gives you a production table with planted
  errors to find and log.
- **Missions and certificate**: five scored missions at guided, standard or expert level; the
  certificate carries a verification code and exports a record for the Regulatory Skills Passport.

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

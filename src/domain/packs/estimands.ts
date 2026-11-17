// The estimands of each study, as written in the protocol (ICH M11 section 3 and the Protocol
// Builder's HRP-301 and GLV-12-301 examples), shown beside the programs that estimate them so the
// programmer sees the question a table answers (ICH E9(R1): population, treatment, variable,
// intercurrent events and their strategies, population-level summary).
export interface Estimand {
  id: string; endpoint: string; population: string; treatment: string; variable: string
  events: { name: string; strategy: string; handling: string }[]; summary: string; estimator: string
}
export interface EstimandLink { estimand: Estimand; role: string }

const HRP_EST1: Estimand = {
  id: 'EST1', endpoint: 'Primary', population: 'Adults aged 18 to 75 with moderate to severe chronic hand eczema inadequately controlled with topical corticosteroids (ITT analysis set)',
  treatment: 'Lumiravostat 25 mg or 10 mg once daily, each compared with placebo, for 16 weeks',
  variable: 'IGA-CHE treatment success (0 or 1 with at least a 2-grade improvement from baseline) at Week 16',
  events: [
    { name: 'Use of rescue therapy', strategy: 'Composite variable', handling: 'A participant who uses rescue therapy before Week 16 is a non-responder.' },
    { name: 'Permanent discontinuation of trial intervention', strategy: 'Composite variable', handling: 'A participant who stops the trial intervention before Week 16 is a non-responder.' },
  ],
  summary: 'Difference in proportions', estimator: 'The difference in response rates between each dose and placebo with a 95% Wald confidence interval; Fisher’s exact test. Participants without a Week 16 assessment are non-responders.',
}
const HRP_EST2: Estimand = { ...HRP_EST1, id: 'EST2', endpoint: 'Secondary', variable: 'HECSI-75 (at least 75% improvement from baseline in HECSI) at Week 16', events: HRP_EST1.events.map((e) => ({ ...e })) }
const GLV_EST1: Estimand = {
  id: 'EST1', endpoint: 'Primary', population: 'Adults with type 2 diabetes inadequately controlled on metformin (HbA1c 7.0% to 10.5%) (ITT analysis set)',
  treatment: 'GLV-12 5 mg or 10 mg once daily vs placebo for 26 weeks, added on to metformin', variable: 'Change from baseline in HbA1c at Week 26',
  events: [
    { name: 'Permanent discontinuation of trial intervention', strategy: 'Hypothetical', handling: 'The HbA1c the participant would have had at Week 26 had they continued treatment.' },
    { name: 'Start of rescue therapy', strategy: 'Hypothetical', handling: 'The HbA1c the participant would have had without rescue; values after rescue are not used.' },
  ],
  summary: 'Difference in means', estimator: 'ANCOVA of the change at Week 26 with treatment and baseline HbA1c; least-squares mean differences from placebo with 95% CIs. A mixed model for repeated measures is the supplementary analysis.',
}

export const ESTIMANDS: Record<string, Record<string, EstimandLink>> = {
  'HRP-301': {
    T3: { estimand: HRP_EST1, role: 'This table is the main estimator of the primary estimand.' },
    T4: { estimand: HRP_EST2, role: 'This table estimates the key secondary estimand, with the strategies of the primary.' },
  },
  'GLV-12-301': {
    T3: { estimand: GLV_EST1, role: 'Observed cases: values after discontinuation or rescue are still in this analysis, so it does not fully follow the hypothetical strategy. Compare it with T9.' },
    T9: { estimand: GLV_EST1, role: 'This table follows the hypothetical strategy: values after discontinuation or rescue are excluded and the model estimates what they would have been.' },
    F1: { estimand: GLV_EST1, role: 'A descriptive view of the variable over time; not an estimator.' },
    F3: { estimand: GLV_EST1, role: 'Subgroups of the primary estimand’s population, as supportive analyses.' },
  },
}
export const estimandFor = (packId: string, programId: string): EstimandLink | undefined => ESTIMANDS[packId]?.[programId]

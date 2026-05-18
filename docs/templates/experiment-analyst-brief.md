Status: active
Last-Validated: 2026-05-18

# Experiment Analyst Brief Template

## Task Metadata
- Task ID:
- Date:
- Owner:
- Related feature flag or experiment:

## Question
- Decision to support:
- Hypothesis:
- In scope:
- Out of scope:

## Experiment Setup
- Control:
- Treatment or variants:
- Randomization unit:
- Assignment source:
- Exposure source:
- Expected traffic split:
- Target segment or audience:

## Metrics
- Primary metric:
- Metric unit:
- Numerator:
- Denominator:
- Time window:
- Timezone:
- Secondary metrics:
- Guardrail metrics:

## Data Access
- Allowed source:
- D1 database or export used:
- Tables used:
- Snapshot time:
- Freshness check:
- Sensitive data handling notes:

## Quality Checks
- Exposure happens before metric event:
- Treatment/control split check:
- SRM risk:
- Segment overlap or leakage risk:
- Missing data risk:
- Identifier mapping risk:
- Ratio metric numerator/denominator decomposition:
- Bot/internal traffic handling:

## Result Readout
- Sample size:
- Observed split:
- Primary metric result:
- Guardrail result:
- Known caveats:
- Interpretation:

## Recommendation
- Decision candidate: ship / hold / rollback / rerun / needs more data
- Why:
- Follow-up owner:
- Follow-up action:

## Validation
- Queries or checks run:
- Results:
- Not run and reason:

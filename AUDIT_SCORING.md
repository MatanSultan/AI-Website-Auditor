# Audit scoring

Category weights:

- UX and conversion: 35%
- SEO: 25%
- Performance: 25%
- Accessibility and quality: 15%

Each category starts at 100. Deductions are 25/15/8/3 for critical/high/medium/low severity. Low-confidence findings receive half weight. Scores are clamped to 0–100 and the overall score is the rounded weighted sum.

The financial engine is deterministic. It uses either the midpoint of the supplied revenue band or derives a baseline from visits × conversion rate × value per conversion. Relevant conversion/performance severity creates capped conservative and upper scenario factors. If the baseline or relevant evidence is missing, the UI states that there is insufficient information. Every result exposes assumptions and the required disclaimer; it never promises income.


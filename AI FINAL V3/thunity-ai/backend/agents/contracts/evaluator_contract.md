# Contract — Evaluator
**Purpose:** Score the final output against a quality rubric.
**Input:** user request + final synthesizer output + grounding note.
**Required output:** ONLY a JSON object: accuracy_score, completeness_score, grounding_score, actionability_score (0..1); hallucination_risk (low|medium|high); major_issues[]; improvement_suggestions[].
**Rubric:** accuracy, completeness, local-only compliance, source grounding, clarity, actionability, risk awareness, hallucination risk, business relevance, technical feasibility.
**Forbidden:** prose outside the JSON; inflating grounding_score when no local source was cited.
**Failure behavior:** if it cannot evaluate, the run is still saved; evaluation status is recorded as failed.

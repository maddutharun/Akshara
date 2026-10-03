# AI Translation Quality Review Protocol

This protocol must be completed separately for every enabled source/target pair (currently Sanskrit to English, Telugu, or Hindi). The deployment allowlist must remain empty for a pair until its review is signed off. Passing code tests does not establish linguistic quality.

## Reviewer and sample requirements

- Use a fixed, versioned set of at least 30 published passages for each pair, selected to cover literal meaning, idiom, ambiguity, culturally specific terms, and difficult grammar.
- Verify that each source passage may be sent to the selected provider and retain its source edition, verse ID, and immutable source version.
- Obtain two independent reviews per output: one fluent/native target-language reviewer and one qualified source-language or subject-matter reviewer. Reviewers must not see each other's scores before submission.
- Evaluate literal, fluent, explanation, and summary modes separately. Do not average modes or language pairs together.
- Record the model/provider version, prompt version, evaluation date, reviewers' qualifications, and any conflict-of-interest disclosure.

## Scoring rubric

Score each dimension from 1 (unacceptable) to 5 (excellent):

| Dimension | Review question |
| --- | --- |
| Accuracy | Does the output preserve the source's meaning and grammatical relationships? |
| Faithfulness | Does it avoid additions, omissions, unsupported doctrine, or false certainty? |
| Terminology | Are key words rendered consistently and appropriately for the context? |
| Readability | Is the output understandable and natural in the target language for its declared mode? |
| Safety and humility | Does it avoid harmful or inflammatory interpretations and identify material uncertainty? |

For each language pair and mode, the proposed release gate is: mean score of at least 4.2/5 in every dimension, no dimension average below 4.0, and no unresolved critical error (including reversal of meaning, fabricated source claims, or harmful interpretation). The editorial owner must approve this threshold or record a stricter one before the first evaluation; a passing average never overrides a critical issue.

## Required record for every case

Record a stable evaluation-case ID, source edition/version, verse ID, target pair, mode, provider/model, prompt version, output, both reviewers' individual scores and notes for every dimension, error classification, and final disposition. Do not put private user notes or profile information into the evaluation prompt or record.

## Launch decision and regression

1. Fix prompt or model issues and rerun the full affected pair/mode set, not only the failed examples.
2. Store a signed reviewer decision and the reviewed model/prompt identifiers with the release record.
3. Add a pair to `AI_ENABLED_LANGUAGE_PAIRS` only after source rights, provider privacy/retention review, and the quality gate all pass.
4. Re-run the set after a provider/model/prompt change, material source change, or sustained increase in user reports.
5. Pause the pair by removing it from the allowlist if a critical issue is found. Generated output remains clearly labeled and is never promoted to the human-reviewed corpus automatically.

No language-pair evaluation has been performed or approved yet. This repository intentionally contains no invented canonical reference translations; the real test set must be sourced and reviewed under the applicable rights.

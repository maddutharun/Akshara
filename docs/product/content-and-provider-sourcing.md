# Content and Translation Provider Sourcing

Research checked on 2 October 2026. These are evaluation leads, not approvals to ingest text or enable translation in production.

## Text editions and provenance

| Candidate | What it can provide | Rights and launch gate |
| --- | --- | --- |
| Wikisource (`sa`, `hi`, and `te`) | Page text, revision history, and source/edition clues through the MediaWiki API | Review the rights tag and source edition for every page. Wikisource contributor text is generally CC BY-SA 4.0 and GFDL, which require attribution and may impose share-alike obligations; site availability is not a blanket grant. Preserve page URL, revision ID, edition, author/translator, rights tag, and retrieval date. |
| Project Gutenberg, *The Song Celestial* | A traceable English Bhagavad Gita translation by Edwin Arnold, published in 1900 | Confirm the ebook's own rights notice and territorial status before reuse. “Free ebook” does not mean an unrestricted open license, especially outside the United States. |
| GRETIL | Discovery of machine-readable Indic texts and source editions | No blanket reuse license was identified. Do not bulk-ingest or publish any entry without work-level rights clearance. |

No text has been selected or imported. Until a work's exact edition, rights tag, and redistribution terms are reviewed and recorded in `sources`, the app must continue to use clearly labeled illustrative preview content.

## Translation options

| Candidate | Potential fit | Required checks |
| --- | --- | --- |
| Azure AI Translator F0 | A documented free tier for supported language pairs; provider documentation says text translation is processed without persisting customer text | Query the supported-languages endpoint for each exact pair, confirm current regional limits/pricing, review current data/privacy terms, and evaluate output with native speakers. Do not assume Sanskrit is supported. |
| Self-hosted AI4Bharat IndicTrans2 | Potentially avoids sending text to a hosted translation API; project/model documentation lists relevant Indic languages | Confirm the exact model checkpoint license, hardware/cost, deployment security, and human-reviewed quality per pair. A model license does not grant rights to source texts or training data. |
| Gemini API free tier | Can be useful for limited experiments | Unpaid-service terms allow prompts/responses to be used to improve products and potentially reviewed by people. Do not submit private user data or confidential text. Free-tier eligibility is not a privacy or production-readiness guarantee. |

No provider is configured. Any enabled pair still needs a documented quality evaluation, provenance labels, user feedback/report path, quotas, caching, spend limits, privacy review, and failure handling.

## Supporting tools

- [Ambuda Vidyut](https://github.com/ambuda-org/vidyut) is a candidate for Sanskrit transliteration and linguistic processing. Review software and bundled linguistic-data licenses separately.
- Use official APIs and retain source revision metadata; do not scrape sites or infer rights from public accessibility.

## Research links

- [Wikisource copyright policy](https://en.wikisource.org/wiki/Wikisource:Copyright_policy)
- [MediaWiki API](https://www.mediawiki.org/wiki/API:Main_page)
- [Project Gutenberg: The Song Celestial](https://www.gutenberg.org/ebooks/2388)
- [Project Gutenberg license explanation](https://www.gutenberg.org/policy/license.html)
- [GRETIL catalog](https://gretil.sub.uni-goettingen.de/gretil.html)
- [Azure Translator service limits](https://learn.microsoft.com/en-us/azure/ai-services/translator/service-limits)
- [Azure Translator data privacy and security](https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/translator/data-privacy-security)
- [Azure Translator supported languages](https://api.cognitive.microsofttranslator.com/languages?api-version=2026-06-06)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API terms](https://ai.google.dev/gemini-api/terms)
- [AI4Bharat IndicTrans2](https://github.com/AI4Bharat/IndicTrans2)
- [IndicTrans2 model checkpoint](https://huggingface.co/ai4bharat/indictrans2-indic-en-1B)


The reason: undefined is the key clue, and it tells you exactly what's happening: your chunks are not failing in the catch block — they're failing in the success path.

If the catch block ran, reason would always be a string ("Fast-Fail..." or "Validation processing error..."). Since it's literally undefined, the LLM call succeeded, the JSON parsed, but result.reason doesn't exist on the parsed object — and neither do the other fields you check.
Root cause: JsonOutputParser<ValidationResult> enforces nothing at runtime\

This line is the trap:
ts

const parser = new JsonOutputParser<ValidationResult>();

ValidationResult is a TypeScript interface. Types are erased at compile time — they do not exist at runtime. So parser.getFormatInstructions() emits only a generic "return some JSON" instruction. It has no idea about isHrRelevant, toxicityScore, reason, etc.

The LLM then returns some valid JSON, but with field names it invents (hr_relevant, toxicity, score, explanation, …). Your strict checks then all read undefined:

The LLM then returns some valid JSON, but with field names it invents (hr_relevant, toxicity, score, explanation, …). Your strict checks then all read undefined:
ts

result.isHrRelevant === true   // undefined === true  -> false
result.reason                  // undefined

So every chunk gets isValid: false with reason: undefined. Your document is genuine; the schema contract just isn't real.

###Solution

The engineering decision

The cleanest, most robust fix is withStructuredOutput + Zod. Here's the reasoning:

    Zod gives a real runtime contract — the LLM is forced to return your exact field names, and you get validation + types from one source of truth. This directly kills the undefined bug.
    Drop the createAgent/piiMiddleware layer — it was a fabricated API for this use case and added a fragile "dig the text out of the last message" step. For a one-shot classifier, a direct structured call is simpler and more reliable.
    Keep the PII fast-fail intent, but make it real — your goal (block sensitive data before the LLM call to save tokens) is good engineering. I implement it as a cheap regex pre-screen instead of a non-existent middleware. This preserves your design intent with code that actually runs.
    Surface real errors instead of swallowing them.

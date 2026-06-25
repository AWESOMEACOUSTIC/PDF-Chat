# Root Cause Analysis: `reason` Returning `undefined`

## Problem Observation

The key clue is that `reason` is returning `undefined`.

This tells us that the chunks are **not failing inside the `catch` block**. If the execution had entered the `catch` block, `reason` would always contain a valid string such as:

* `"Fast-Fail: Sensitive information detected"`
* `"Validation processing error"`

Instead, the value is literally `undefined`, which indicates that:

1. The LLM call completed successfully.
2. The JSON response was parsed successfully.
3. The expected fields do not exist on the parsed object.

---

## Root Cause

The issue originates from the following code:

```ts
const parser = new JsonOutputParser<ValidationResult>();
```

At first glance, this appears to enforce the `ValidationResult` structure. However, `ValidationResult` is only a **TypeScript interface**.

### Important Limitation

TypeScript types are completely erased during compilation and do not exist at runtime.

As a result:

* `JsonOutputParser` has no runtime knowledge of:

  * `isHrRelevant`
  * `toxicityScore`
  * `reason`
  * any other fields defined in the interface

Therefore, when calling:

```ts
parser.getFormatInstructions()
```

the parser can only generate generic instructions such as:

> "Return valid JSON."

It cannot enforce a specific schema.

---

## What Happens in Practice

The LLM still returns valid JSON, but it may choose its own field names.

For example:

```json
{
  "hr_relevant": true,
  "toxicity": 0.1,
  "explanation": "Relevant HR content"
}
```

instead of:

```json
{
  "isHrRelevant": true,
  "toxicityScore": 0.1,
  "reason": "Relevant HR content"
}
```

---

## Why Every Chunk Becomes Invalid

The validation logic expects exact field names:

```ts
result.isHrRelevant === true
```

But the parsed object contains:

```ts
result.hr_relevant
```

Therefore:

```ts
result.isHrRelevant === true
// undefined === true
// false
```

Similarly:

```ts
result.reason
// undefined
```

As a consequence, every chunk is evaluated as:

```ts
{
  isValid: false,
  reason: undefined
}
```

even when the underlying document content is completely valid.

---

# Engineering Decision

## Recommended Solution

The most robust solution is to replace `JsonOutputParser<ValidationResult>` with:

* **Zod schema**
* **withStructuredOutput()**

### Why This Approach?

#### 1. Runtime Schema Enforcement

Zod provides a real runtime contract.

The model is forced to return:

```ts
{
  isHrRelevant: boolean;
  toxicityScore: number;
  reason: string;
}
```

instead of inventing arbitrary field names.

Benefits:

* Guaranteed field names
* Runtime validation
* Automatic TypeScript inference
* Single source of truth

---

#### 2. Remove Unnecessary Agent Layer

The existing:

```ts
createAgent(...)
piiMiddleware(...)
```

layer introduces unnecessary complexity for a simple classification task.

Problems introduced:

* Additional execution path
* Message extraction logic
* Increased failure surface area

For a one-shot document classifier, a direct structured LLM call is simpler and more reliable.

---

#### 3. Preserve PII Fast-Fail Logic

The original intent behind the middleware is valid:

> Detect sensitive information before sending data to the LLM to save tokens and reduce risk.

Instead of a custom middleware layer, implement a lightweight regex-based pre-screen.

Example checks:

* Email addresses
* Phone numbers
* Aadhaar numbers
* Credit card numbers
* Social Security numbers

This preserves the original design goal while using a simpler and more maintainable implementation.

---

#### 4. Surface Real Errors

Current behavior silently converts many failures into:

```ts
{
  isValid: false,
  reason: undefined
}
```

This makes debugging difficult.

Instead:

* Log validation failures explicitly.
* Surface schema mismatches.
* Return structured error information.

Example:

```ts
{
  isValid: false,
  reason: "Schema validation failed: Missing field 'reason'"
}
```

This dramatically improves observability and troubleshooting.

---

# Summary

The issue is **not caused by chunk validation failures or exception handling**.

The real problem is that:

1. `JsonOutputParser<ValidationResult>` does not enforce the TypeScript interface at runtime.
2. The LLM returns valid JSON with unexpected field names.
3. Expected properties such as `isHrRelevant` and `reason` become `undefined`.
4. All chunks are incorrectly marked as invalid.

### Final Recommendation

Replace:

```ts
JsonOutputParser<ValidationResult>
```

with:

```ts
withStructuredOutput(zodSchema)
```

and use a Zod schema as the single runtime source of truth.

This eliminates the `undefined` field issue, provides runtime validation, improves reliability, and simplifies the overall architecture.

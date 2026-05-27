import "dotenv/config";
import mongoose from "mongoose";
import connectToDatabase from "./lib/config/mongodb";
import { getChatModel } from "./lib/langchain/embeddings";
import { answerQuestionAboutDocument } from "./lib/langchain/index";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

// ==========================================
// RAGAS METRICS SETUP (LLM-as-a-Judge)
// ==========================================
const evaluatorLlm = getChatModel();
const parser = new StringOutputParser();

const contextRelevancePrompt = PromptTemplate.fromTemplate(`
You are a precision-trained relevance evaluator for Retrieval-Augmented Generation (RAG) systems. Your task is to rigorously assess whether the retrieved context contains sufficient information to answer the given question.

---

Question:{question}

Retrieved Context:
{context}

---

**Evaluation Criteria (assess each independently):**

1. **Information Coverage** — Does the context contain the specific facts, data, or explanations needed to answer the question? (Not just topically related, but actually answerable from the content.)

2. **Directness** — Does the context directly address the question, or does it only tangentially touch on related topics?

3. **Completeness** — Could a human read ONLY this context and produce a full, accurate answer to the question without needing external knowledge?

4. **Specificity Match** — If the question asks about a specific entity, time period, metric, or condition, does the context contain that exact specificity?

5. **Freshness / Correctness Risk** — Does the context appear outdated, contradictory, or potentially misleading relative to what the question is asking?

---

**Scoring Rubric:**

- **0.0** — Completely irrelevant. No topical overlap whatsoever.
- **0.1-0.2** — Same broad domain but does not address the question at all.
- **0.3-0.4** — Tangentially related; mentions some relevant terms but lacks the actual information needed to answer.
- **0.5** — Partially relevant; contains some useful information but significant gaps remain — the question cannot be fully answered.
- **0.6-0.7** — Mostly relevant; covers the core topic and provides substantial information, but missing key details or specificity the question demands.
- **0.8-0.9** — Highly relevant; contains nearly all information needed to answer the question accurately and completely, with only minor gaps.
- **1.0** — Perfectly relevant; the context contains everything required to fully and accurately answer the question.

---

**Instructions:**
- Do NOT assume or infer information not explicitly present in the context.
- Do NOT reward keyword overlap alone — the context must contain actual *answering* information.
- Be skeptical: topical similarity ≠ answerability.
- If the question is multi-part, all parts must be addressed for a high score.

**Think step-by-step internally, then output ONLY a single float between 0.0 and 1.0 (one decimal place). No explanation.**

Score: `);

const faithfulnessPrompt = PromptTemplate.fromTemplate(`
You are a precision-trained hallucination detector for Retrieval-Augmented Generation (RAG) systems. Your task is to rigorously assess whether every claim in the generated answer is fully grounded in and derivable from the provided context.

---

Context: {context}

Generated Answer: {answer}

---

**Evaluation Criteria (assess each independently):**

1. **Claim-Level Grounding** — Break the answer into individual factual claims. Is every single claim explicitly supported by or logically derivable from the context?

2. **No Fabrication** — Does the answer introduce any facts, figures, names, dates, relationships, or details that are NOT present in the context?

3. **No Embellishment** — Does the answer exaggerate, overstate, or add nuance/qualifications that the context does not support?

4. **No Contradiction** — Does the answer contradict any information explicitly stated in the context?

5. **Attribution Integrity** — If the answer implies causation, correlation, or attribution, is that same relationship explicitly present in the context (not just inferred by the model)?

---

**Scoring Rubric:**

- **0.0** — Completely hallucinated. None of the claims in the answer are supported by the context.
- **0.1-0.2** — Heavily hallucinated. The vast majority of claims are fabricated or unsupported.
- **0.3-0.4** — Mostly unfaithful. Some claims are grounded, but significant fabricated content is present.
- **0.5** — Mixed faithfulness. Roughly half the claims are supported; the other half are hallucinated or embellished.
- **0.6-0.7** — Mostly faithful. The core answer is grounded, but contains a few unsupported details, minor fabrications, or subtle embellishments.
- **0.8-0.9** — Highly faithful. Nearly all claims are fully supported by the context, with only trivial or borderline unsupported additions (e.g., innocuous phrasing differences).
- **1.0** — Perfectly faithful. Every claim in the answer is explicitly supported by or directly derivable from the context. Zero hallucination.

---

**Instructions:**
- Treat the context as the ONLY source of truth. External knowledge is irrelevant — even if a claim is factually true in the real world, it is a hallucination if NOT in the context.
- Generic connective phrases (e.g., "Based on the information...", "In summary...") are NOT hallucinations.
- Paraphrasing is acceptable; inventing new information is not.
- Be especially suspicious of: specific numbers, proper nouns, dates, causal claims, and superlatives not present in the context.

**Think step-by-step internally, then output ONLY a single float between 0.0 and 1.0 (one decimal place). No explanation.**

Score: `);

const answerRelevancePrompt = PromptTemplate.fromTemplate(`
You are a precision-trained answer relevance evaluator for Retrieval-Augmented Generation (RAG) systems. Your task is to rigorously assess how directly, completely, and precisely the generated answer addresses the user's original question.

---

Question: {question}
{question}

Generated Answer: {answer}

---

**Evaluation Criteria (assess each independently):**

1. **Question Alignment** — Does the answer actually address what the user asked? Not a related topic — the *exact* question.

2. **Completeness** — Does the answer cover all parts/aspects of the question? If the question is multi-part, are all sub-questions addressed?

3. **Precision / No Fluff** — Is the answer focused and concise, or does it pad with irrelevant tangents, boilerplate disclaimers, or off-topic information that the user did not ask for?

4. **Appropriate Granularity** — Does the answer match the level of detail the question expects? (e.g., a "yes/no" question should not receive a 5-paragraph essay, and a "explain in detail" question should not receive a one-liner.)

5. **Actionability / Usefulness** — If the user's question implies a need (e.g., how to do X, what is Y), does the answer actually satisfy that need?

---

**Scoring Rubric:**

- **0.0** — Completely off-topic. The answer has no relation to the question asked.
- **0.1-0.2** — Largely irrelevant. Touches the same broad domain but fails to address the actual question.
- **0.3-0.4** — Partially relevant. Addresses a related aspect but misses the core intent of the question.
- **0.5** — Moderately relevant. Addresses the question but only partially — significant aspects are left unanswered OR the answer is heavily diluted with unnecessary content.
- **0.6-0.7** — Mostly relevant. Addresses the core question reasonably well but has noticeable fluff, minor misalignment, or misses a sub-part of the question.
- **0.8-0.9** — Highly relevant. Directly and clearly answers the question with good focus. Only minor imperfections in completeness or conciseness.
- **1.0** — Perfectly relevant. The answer directly, completely, and precisely addresses every aspect of the question with no unnecessary filler.

---

**Instructions:**
- Evaluate relevance to the QUESTION, not to any context or source material.
- Do NOT penalize the answer for being incorrect — this metric measures only whether the answer *targets* the right question, not whether it is factually right.
- DO penalize for: off-topic tangents, excessive hedging that avoids answering, restating the question without answering, or providing a generic response that could apply to any question.
- A short but precisely targeted answer should score higher than a long, rambling one that eventually addresses the question.

**Think step-by-step internally, then output ONLY a single float between 0.0 and 1.0 (one decimal place). No explanation.**

Score: `);

const correctnessPrompt = PromptTemplate.fromTemplate(`
You are a precision-trained factual correctness evaluator for Retrieval-Augmented Generation (RAG) systems. Your task is to rigorously assess how factually accurate the generated answer is when compared against the provided ground truth answer.

---

Question: {question}

Ground Truth Answer: {ground_truth}

**Generated Answer:**
{answer}

---

**Evaluation Criteria (assess each independently):**

1. **Factual Accuracy** — Are the key facts in the generated answer (names, numbers, dates, events, relationships, definitions) correct when compared to the ground truth?

2. **Semantic Equivalence** — Does the generated answer convey the same core meaning as the ground truth, even if worded differently? (Paraphrasing is acceptable; different conclusions are not.)

3. **Completeness vs. Ground Truth** — Does the generated answer include all the critical information points present in the ground truth? Are any key facts missing?

4. **No Contradictions** — Does the generated answer contain any claims that directly contradict the ground truth?

5. **No Critical Errors** — Even if mostly correct, does the answer contain any single error that would make it dangerously misleading or fundamentally wrong? (e.g., wrong dosage, wrong date for a deadline, inverted relationship)

---

**Scoring Rubric:**

- **0.0** — Completely incorrect. The generated answer contradicts or is entirely unrelated to the ground truth.
- **0.1-0.2** — Mostly incorrect. Contains severe factual errors on the core question; only trivially overlaps with the ground truth.
- **0.3-0.4** — Significantly incorrect. Gets some peripheral details right but is wrong on the main facts or central claim.
- **0.5** — Partially correct. The answer captures some correct information but misses or gets wrong roughly half of the key points in the ground truth.
- **0.6-0.7** — Mostly correct. The core answer aligns with the ground truth, but there are notable omissions or minor factual inaccuracies.
- **0.8-0.9** — Highly correct. Nearly all facts match the ground truth. Only minor, non-critical differences (e.g., slightly less precise wording, one minor detail missing).
- **1.0** — Perfectly correct. The generated answer is fully consistent with the ground truth in all factual claims. Phrasing may differ but the information content is equivalent or a superset.

---

**Instructions:**
- The ground truth is the SOLE reference for correctness. Do not use your own knowledge to judge.
- Acceptable differences: paraphrasing, reordering of information, additional *non-contradictory* details beyond the ground truth.
- Unacceptable: wrong values, missing critical facts, contradictions, inverted logic, or fabricated information not present in either ground truth or question.
- If the generated answer contains extra correct information beyond the ground truth, do NOT penalize — only penalize for incorrect or missing critical information.
- Treat a single critical error (one that would change the user's understanding or decision) more harshly than multiple trivial omissions.

**Think step-by-step internally, then output ONLY a single float between 0.0 and 1.0 (one decimal place). No explanation.**

Score: `);

// Helper function to extract numerical score from LLM evaluation
async function getMetricScore(prompt: PromptTemplate, inputs: any): Promise<number> {
  try {
    const chain = prompt.pipe(evaluatorLlm).pipe(parser);
    const res = await chain.invoke(inputs);
    const match = res.match(/([0-9]*[.])?[0-9]+/);
    return match ? parseFloat(match[0]) : 0;
  } catch (error) {
    console.warn("⚠️ Metric evaluation failed, returning 0", error);
    return 0;
  }
}

// ==========================================
// TEST DATASET & EXECUTION
// ==========================================
// REPLACE THESE WITH YOUR REAL IDs
const TEST_GRIDFS_ID = "6a114bd75e669cd8412ea71e"; 
const TEST_DOC_ID = "ragas-evaluation-metrics";

const evaluationDataset = [
    {
        question: "Why is the migration to Post-Quantum Cryptography (PQC) particularly challenging for IoT devices?",
        ground_truth: "The migration to PQC is challenging for IoT devices because most IoT systems are highly resource-constrained, having limited computational power, memory, and energy capacity, while PQC algorithms are computationally intensive and require larger keys and signatures. Additionally, long device lifecycles make current encrypted IoT data vulnerable to future quantum attacks under the “Harvest Now, Decrypt Later” threat model.",
    },
    {
        question: "What is the “signature bottleneck” problem identified in the paper?",
        ground_truth: "The signature bottleneck refers to the poor performance of PQC digital signature schemes such as ML-DSA (Dilithium) and SPHINCS+, which are slower, larger, and computationally more expensive than classical signature schemes like ECDSA. This creates major issues for IoT operations such as device authentication, secure boot, and firmware updates.",
    },
    {
        question: "What solution does the proposed H2A-PQC framework use to mitigate the “signature storm” problem in IoT architectures?",
        ground_truth: "The H2A-PQC framework mitigates the signature storm problem using Lightweight Lattice-based Aggregate Signatures (LLAS), Merkle commitment trees, and gateway attestation mechanisms. Instead of forwarding and verifying every device signature individually, signatures are aggregated at the gateway level, significantly reducing communication overhead and improving scalability in many-to-one IoT environments.",
    }
];

async function runRagasEvaluation() {
  console.log("🚀 Starting RAGAS Evaluation Pipeline...\n");

  await connectToDatabase();

  let totalScores = { contextRelevance: 0, faithfulness: 0, answerRelevance: 0, correctness: 0 };
  const n = evaluationDataset.length;

  for (let i = 0; i < n; i++) {
    const item = evaluationDataset[i];
    console.log(`\n==================================================`);
    console.log(`📝 Testing Query ${i + 1}/${n}: "${item.question}"`);

    // 1. Run your core RAG logic
    const { answer, sourceDocuments } = await answerQuestionAboutDocument(
      TEST_GRIDFS_ID,
      TEST_DOC_ID,
      item.question
    );

    const contextText = sourceDocuments.map(doc => doc.pageContent).join("\n\n");

    // 2. Evaluate using RAGAS concepts
    process.stdout.write("⏳ Evaluating metrics... ");
    const contextRelevance = await getMetricScore(contextRelevancePrompt, { question: item.question, context: contextText });
    const faithfulness = await getMetricScore(faithfulnessPrompt, { context: contextText, answer: answer });
    const answerRelevance = await getMetricScore(answerRelevancePrompt, { question: item.question, answer: answer });
    const correctness = await getMetricScore(correctnessPrompt, { question: item.question, ground_truth: item.ground_truth, answer: answer });
    console.log("Done!");

    // Aggregate
    totalScores.contextRelevance += contextRelevance;
    totalScores.faithfulness += faithfulness;
    totalScores.answerRelevance += answerRelevance;
    totalScores.correctness += correctness;

    // Display per-query results
    console.log(`🔹 Generated Answer:  ${answer.substring(0, 120)}...`);
    console.log(`📊 Context Relevance: ${(contextRelevance * 100).toFixed(0)}%`);
    console.log(`📊 Faithfulness:      ${(faithfulness * 100).toFixed(0)}%`);
    console.log(`📊 Answer Relevance:  ${(answerRelevance * 100).toFixed(0)}%`);
    console.log(`📊 Correctness:       ${(correctness * 100).toFixed(0)}%`);
  }

  // Final Overview Report
  console.log(`\n🏆 FINAL RAGAS AVERAGE SCORES (${n} Queries):`);
  console.log(`--------------------------------------------------`);
  console.log(`Context Relevance:     ${((totalScores.contextRelevance / n) * 100).toFixed(1)}%`);
  console.log(`Faithfulness:          ${((totalScores.faithfulness / n) * 100).toFixed(1)}%`);
  console.log(`Answer Relevance:      ${((totalScores.answerRelevance / n) * 100).toFixed(1)}%`);
  console.log(`Correctness:           ${((totalScores.correctness / n) * 100).toFixed(1)}%`);
  console.log(`--------------------------------------------------`);
  
  await mongoose.disconnect();
  console.log("🛑 Evaluation Completed.\n");
}

runRagasEvaluation();
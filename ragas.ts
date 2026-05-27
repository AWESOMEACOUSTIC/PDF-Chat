import "dotenv/config";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import mongoose from "mongoose";
import connectToDatabase from "./lib/config/mongodb";
import { answerQuestionAboutDocument } from "./lib/langchain/index";

// 1. Define Your Test Dataset
// Add questions and the exact correct answers (Ground Truth) you expect.
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

// REPLACE THESE WITH YOUR REAL TEST IDs
const TEST_GRIDFS_ID = "6a114bd75e669cd8412ea71e";
const TEST_DOC_ID = "ragas-evaluation-metrics";

async function runRagasEvaluation() {
    console.log("🚀 Step 1: Running LangChain Retrieval via TypeScript...");
    await connectToDatabase();

    // RAGAS expects data in these four arrays
    const ragasData = {
        question: [] as string[],
        answer: [] as string[],
        contexts: [] as string[][],
        ground_truth: [] as string[]
    };

    for (let i = 0; i < evaluationDataset.length; i++) {
        const item = evaluationDataset[i];
        console.log(`📝 Processing Query ${i + 1}: "${item.question}"`);

        // Call your existing TS RAG pipeline
        const { answer, sourceDocuments } = await answerQuestionAboutDocument(
            TEST_GRIDFS_ID,
            TEST_DOC_ID,
            item.question
        );

        // Extract raw text from LangChain Document objects
        const contextTexts = sourceDocuments.map(doc => doc.pageContent);

        ragasData.question.push(item.question);
        ragasData.answer.push(answer);
        ragasData.contexts.push(contextTexts);
        ragasData.ground_truth.push(item.ground_truth);
    }

    await mongoose.disconnect();

    // 2. Export the dataset to a JSON file so Python can read it
    const datasetPath = path.join(process.cwd(), "ragas_dataset.json");
    fs.writeFileSync(datasetPath, JSON.stringify(ragasData, null, 2));
    console.log("✅ Dataset exported to ragas_dataset.json\n");

    // 3. Dynamically generate the Python script that runs the official RAGAS framework
    const pythonScriptPath = path.join(process.cwd(), "ragas_eval.py");
    const pythonCode = `
import json
import warnings
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    Faithfulness,
    AnswerRelevancy,
    AnswerCorrectness,
    ContextPrecision
)
from ragas.llms import LangchainLLMWrapper
from langchain_openai import ChatOpenAI

warnings.filterwarnings("ignore")

print("🐍 Step 2: Starting official RAGAS Python evaluation...")

with open('ragas_dataset.json', 'r') as f:
    data = json.load(f)

dataset = Dataset.from_dict(data)

# Point to OpenRouter via OpenAI-compatible client
llm = LangchainLLMWrapper(ChatOpenAI(
    model="openai/gpt-4o-mini",
))

try:
    result = evaluate(
        dataset,
        metrics=[
            ContextPrecision(llm=llm),
            Faithfulness(llm=llm),
            AnswerRelevancy(llm=llm),
            AnswerCorrectness(llm=llm),
        ],
    )
    print("\\n🏆 RAGAS EVALUATION RESULTS:")
    print(result)
except Exception as e:
    print(f"❌ Error during RAGAS evaluation: {e}"))
`;

    fs.writeFileSync(pythonScriptPath, pythonCode);

    // 4. Execute the Python script from Node.js
    console.log("⏳ Triggering RAGAS Framework...");
    try {
        execSync("python ragas_eval.py", {
            stdio: "inherit",
            env: {
                ...process.env,

                // 🔹 1. Redirect all OpenAI calls to the OpenRouter endpoint
                OPENAI_BASE_URL: "https://openrouter.ai/api/v1",

                // 🔹 2. Provide your OpenRouter key where it expects the OpenAI key
                OPENAI_API_KEY: process.env.OPENROUTER_API_KEY,

                // 🔹 3. (Optional) Force the model name if OpenRouter requires the 'openai/' prefix
                OPENAI_MODEL_NAME: "openai/gpt-4o-mini" 
            }
        });
    } catch (error) {
        console.error("❌ Python execution failed. Ensure python and ragas are installed properly.");
    } finally {
        // 5. Cleanup the temporary bridging files
        if (fs.existsSync(datasetPath)) fs.unlinkSync(datasetPath);
        if (fs.existsSync(pythonScriptPath)) fs.unlinkSync(pythonScriptPath);
        console.log("\n🛑 Evaluation Completed and cleaned up.");
    }
}

runRagasEvaluation();
import "server-only";

import type { ChatOpenRouter } from "@langchain/openrouter";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import type { Document } from "@langchain/core/documents";

// Define the expected input shape for your Runnables
interface ChainInput {
  context: Document[];
  input?: string; 
}

// Custom helper to replace the broken langchain/util/document import
const formatDocumentsAsString = (documents: Document[], separator = "\n\n") => {
  return documents.map((doc) => doc.pageContent).join(separator);
};

export async function buildQaChain(llm: ChatOpenRouter) {
  const qaPrompt = ChatPromptTemplate.fromTemplate(`
Use the following context to answer the user's question about the document.
If the answer is not in the context, reply exactly: "I cannot find that information in the document."

Context:
{context}

Question: {input}

Answer:
  `);

  return RunnableSequence.from([
    {
      input: (val: ChainInput) => val.input ?? "",
      context: (val: ChainInput) => formatDocumentsAsString(val.context),
    },
    qaPrompt,
    llm,
    new StringOutputParser(),
  ]);
}

export async function buildSummaryChain(llm: ChatOpenRouter) {
  const summaryPrompt = ChatPromptTemplate.fromTemplate(`
You are summarizing a document. Write a crisp overview:
- What the document is about
- Key sections or topics
- Notable entities (names, companies, dates) if visible
- Keep under 8 bullet points.

Context:
{context}

Summary:
  `);

  return RunnableSequence.from([
    {
      context: (val: Pick<ChainInput, "context">) => formatDocumentsAsString(val.context),
    },
    summaryPrompt,
    llm,
    new StringOutputParser(),
  ]);
}
import "server-only";
import { MistralAIEmbeddings } from "@langchain/mistralai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOpenRouter } from "@langchain/openrouter";

export const PREFERRED_LLM = "openai/gpt-4o-mini";
export const FALLBACK_LLM = "mistralai/mistral-small-3.2-24b-instruct";

function makeLLM(modelName: string) {
  return new ChatOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    model: modelName, 
    temperature: 0,
  });
}

let currentModel = makeLLM(PREFERRED_LLM);

export const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENROUTER_API_KEY,
  model: "openai/text-embedding-3-small",
   configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  }
});

export function getChatModel() {
  return currentModel;
}

export function useFallbackModel() {
  currentModel = makeLLM(FALLBACK_LLM);
  return currentModel;
}

// Initialize openAI model with API Key and model name
const model = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4o",
});
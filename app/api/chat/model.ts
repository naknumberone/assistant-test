import { createOpenAI } from "@ai-sdk/openai";

const baseUrl = process.env.CHAT_MODEL_BASE_URL?.trim();
const apiKey = process.env.CHAT_MODEL_API_KEY?.trim();
const modelName = process.env.CHAT_MODEL_NAME?.trim();

if (!baseUrl || !apiKey || !modelName) {
  throw new Error(
    "Model env is not configured. Required: CHAT_MODEL_BASE_URL, CHAT_MODEL_API_KEY, CHAT_MODEL_NAME",
  );
}

const openai = createOpenAI({
  baseURL: baseUrl,
  apiKey: apiKey.replace(/^Bearer\s+/i, ""),
});

export const model = openai(modelName);

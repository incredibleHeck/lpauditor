import { GoogleGenerativeAI } from "@google/generative-ai";

let geminiClientInstance: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClientInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Server Configuration Error: GEMINI_API_KEY is not configured.");
    }
    geminiClientInstance = new GoogleGenerativeAI(apiKey);
  }
  return geminiClientInstance;
}

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateSiyuWisdom = async (score: number, context: 'start' | 'gameover'): Promise<string> => {
  try {
    const prompt = context === 'start' 
      ? "Write a short, cryptic, cyberpunk-style welcome message (max 15 words) for a game called 'Siyu Snake'. Be cool and mysterious."
      : `The player just finished a game of 'Siyu Snake' with a score of ${score}. Write a short, slightly mocking or encouraging cyberpunk-style comment (max 15 words) based on their performance.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || "Siyu is watching.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Connection to Siyu Network unstable...";
  }
};
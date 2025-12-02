import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const SYSTEM_INSTRUCTION = `
You are Snakey, a witty and hungry snake in a video game. 
You make short, funny, 1-sentence comments based on the game state.
Your personality is enthusiastic, slightly dramatic, and obsessed with "beans" (the food).
Keep it under 15 words.
`;

export const getGeminiCommentary = async (
  event: 'start' | 'eat' | 'gameover' | 'idle', 
  score: number
): Promise<string> => {
  if (!apiKey) return "Missing API Key!";

  const modelId = "gemini-2.5-flash"; // Fast model for quick reactions
  let prompt = "";

  switch (event) {
    case 'start':
      prompt = "The game just started. Hype up the player!";
      break;
    case 'eat':
      prompt = `I just ate a delicious bean! Current score is ${score}. React happily.`;
      break;
    case 'gameover':
      prompt = `I died! I crashed. Final score was ${score}. Be dramatic but encouraging.`;
      break;
    case 'idle':
      prompt = "I'm bored waiting for the finger. Hiss.";
      break;
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens: 50, // Short responses
        temperature: 1.2, // High creativity
      },
    });
    return response.text || "...";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "";
  }
};

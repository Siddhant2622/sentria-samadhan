import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeIssueImage(base64Image: string, mimeType: string) {
  const model = "gemini-3-flash-preview";
  const prompt = `
    Analyze this image of a civic grievance in India. 
    1. Detect the type of issue (pothole, garbage, leakage, etc.)
    2. Estimate severity (0-10)
    3. Categorize urgency (low, medium, high, emergency)
    4. Provide a 1-sentence title
    5. Provide a concise description
    6. Suggest the responsible government department in India (e.g. Municipal Corporation, PWD, Traffic Police, State Electricity Board).

    Return ONLY JSON in this format:
    {
      "category": string,
      "severity": number,
      "urgency": string,
      "title": string,
      "description": string,
      "suggestedDepartment": string
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return null;
  }
}

export async function getSmartFollowUpQuestions(issueDetails: any) {
  const prompt = `
    Given this civic issue: ${issueDetails.title} - ${issueDetails.description}.
    Generate 3 intelligent follow-up questions to help authorities understand the situation better.
    Return as a JSON array of strings.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    return ["What happened?", "Since when?", "Is this dangerous?"];
  }
}


import { GoogleGenAI, Type } from "@google/genai";
import { BoardAnalysis } from "../types";

/**
 * Attempts to fetch the HTML content through multiple public proxies.
 * Returns null if all attempts fail, ensuring the flow continues to Gemini Search.
 */
async function fetchBoardHtml(url: string): Promise<string | null> {
  const proxyMethods = [
    {
      url: (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
      parse: (res: any) => res.contents
    },
    {
      url: (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
      parse: (res: any) => typeof res === 'string' ? res : JSON.stringify(res)
    },
    {
      url: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      parse: (res: any) => typeof res === 'string' ? res : JSON.stringify(res)
    }
  ];

  for (const method of proxyMethods) {
    try {
      const proxyUrl = method.url(url);
      // Use a timeout to avoid hanging the UI
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) continue;

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const json = await response.json();
        const content = method.parse(json);
        if (content) return content;
      } else {
        const text = await response.text();
        if (text) return text;
      }
    } catch (error) {
      console.warn(`Proxy method failed for ${url}:`, error instanceof Error ? error.message : error);
      // Continue to next proxy
    }
  }
  return null;
}

/**
 * Extracts data from the HTML, prioritizing the script tag that holds board state.
 */
function extractRelevantHtml(html: string | null): string {
  if (!html) return "";
  
  // Pinterest's main data script
  const scriptTag = html.match(/<script id="__PWS_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (scriptTag && scriptTag[1]) {
    return scriptTag[1].substring(0, 35000); 
  }

  // Fallback to title and meta tags if script not found
  const metaTags = html.match(/<meta [\s\S]*?>/g)?.join('\n') || "";
  const titleTag = html.match(/<title>[\s\S]*?<\/title>/)?.[0] || "";
  
  return (titleTag + "\n" + metaTags + "\n" + html.substring(0, 10000));
}

export const analyzePinterestBoard = async (boardUrl: string): Promise<BoardAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Attempt local scrape but don't fail if it doesn't work
  const rawHtml = await fetchBoardHtml(boardUrl);
  const contextData = extractRelevantHtml(rawHtml);

  // If we have context data, we provide it. If not, we explicitly tell Gemini to Search.
  const prompt = `
    TASK: Extract all high-quality image URLs from this Pinterest board: ${boardUrl}
    
    ENVIRONMENT INFO: 
    - The direct fetch of the page HTML was ${contextData ? 'PARTIALLY SUCCESSFUL' : 'UNSUCCESSFUL'}.
    - ${contextData ? 'Use the provided SOURCE CODE below AND Google Search.' : 'You MUST use the "googleSearch" tool to find the pins for this board.'}
    
    ${contextData ? `SOURCE CODE SNIPPET:\n${contextData}\n` : ''}
    
    INSTRUCTIONS:
    1. Search for: "images in pinterest board ${boardUrl}" or "pins for ${boardUrl}".
    2. Identify the direct high-resolution image URLs (usually from i.pinimg.com, ending in /originals/ or /736x/).
    3. Gather as many images as possible.
    4. Return a JSON object with:
       - boardName: The name of the Pinterest board.
       - description: A short description of the board.
       - images: Array of objects { id: string, url: string, thumbnail: string, title: string }.
    
    JSON SCHEMA REQUIREMENT:
    Return valid JSON. Do not include markdown formatting outside the JSON block.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            boardName: { type: Type.STRING },
            description: { type: Type.STRING },
            images: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  url: { type: Type.STRING },
                  thumbnail: { type: Type.STRING },
                  title: { type: Type.STRING }
                },
                required: ["id", "url", "title"]
              }
            }
          },
          required: ["boardName", "images"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    
    // Process grounding for sources UI
    const groundingSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || 'Pinterest Link',
      uri: chunk.web?.uri || boardUrl
    })) || [];

    if (groundingSources.length === 0) {
      groundingSources.push({ title: "Origem: Pinterest", uri: boardUrl });
    }

    return {
      boardName: result.boardName || "Pasta Detectada",
      description: result.description || "",
      images: result.images || [],
      groundingSources
    };
  } catch (error) {
    console.error("Gemini Critical Error:", error);
    throw new Error("Não foi possível carregar as imagens. Verifique se o link é público ou tente novamente em instantes.");
  }
};

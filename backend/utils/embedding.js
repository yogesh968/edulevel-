import OpenAI from 'openai';
import dotenv from 'dotenv';
import { pipeline } from '@xenova/transformers';
dotenv.config();

const groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

let extractor = null;

// Local similarity computation using Transformers.js (Eliminates HF API reliance)
export async function computeSimilarities(source_sentence, sentences) {
    try {
        if (!extractor) {
            console.log("[EMBEDDING]: Initializing local embedding model (Xenova/all-MiniLM-L6-v2)...");
            extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        }

        const sourceOutput = await extractor(source_sentence, { pooling: 'mean', normalize: true });
        const sourceVector = sourceOutput.data;

        const results = [];
        for (const sentence of sentences) {
            const targetOutput = await extractor(sentence, { pooling: 'mean', normalize: true });
            const targetVector = targetOutput.data;
            
            // Simple dot product for normalized vectors = cosine similarity
            let similarity = 0;
            for (let i = 0; i < sourceVector.length; i++) {
                similarity += sourceVector[i] * targetVector[i];
            }
            results.push(similarity);
        }

        return results;
    } catch (error) {
        console.error("Error computing local similarities:", error);
        // Fallback to empty scores so doesn't crash
        return new Array(sentences.length).fill(0);
    }
}

// Analyze image using Salesforce BLIP VQA
async function askBLIP(question, base64Image, context = "", retries = 3) {
    const base64Data = base64Image.split('base64,')[1] || base64Image;

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(
                "https://api-inference.huggingface.co/models/Salesforce/blip-vqa-base",
                {
                    headers: {
                        "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                        "Content-Type": "application/json",
                    },
                    method: "POST",
                    body: JSON.stringify({
                        inputs: {
                            image: base64Data,
                            text: question || "Describe this image."
                        },
                        options: {
                            wait_for_model: true
                        }
                    }),
                }
            );

            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                console.error("HF Raw Error:", responseText.substring(0, 500));
                throw new Error("Hugging Face API is temporarily unavailable. Please try again in 30 seconds.");
            }
            
            if (!response.ok) {
                if (result.error?.includes('loading') || result.estimated_time) {
                    await new Promise(res => setTimeout(res, 5000));
                    continue;
                }
                throw new Error(result.error || "Vision API Error");
            }

            // BLIP VQA returns [{ answer: "..." }]
            const answer = result[0]?.answer || result.answer || "I can see the diagram but need more context.";
            
            // Refine the answer using Groq to make it more professional and link it to the PDF context
            const promptText = context 
            ? `ADAPTIVE TUTOR MODE:
Document Context:
${context}

Current Question:
${question}

Instructions: 
- If the question is simple, answer in 1-2 clear lines.
- If the user asks for detail ("explain", "elaborate", "more"), or if the concept is complex, provide a DEEP, STRUCTURED, and ELABORATED explanation with headers.
- Always refer to any specific visual evidence found in the image.`
            : question; 
            
            return await askLLM(promptText, question, []);

        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(res => setTimeout(res, 3000));
        }
    }
}

// Ask LLM using Groq
export async function askLLM(prompt, question, history = [], image = null) {
     try {
         if (image) {
             // Use BLIP for visual extraction + Groq for reasoning
             return await askBLIP(question, image, prompt);
         }

         // For standard text queries, continue using Groq for extreme speed and intelligence
         const systemContent = `You are a sophisticated, expert AI tutor similar to GPT-4.
         
          DYNAMIC RESPONSE RULES:
          1. ADAPTIVE RESPONSE LENGTH (STRICT): 
             - For SIMPLE/SHORT queries (1-5 words): Answer in EXACTLY 1-2 sentences. Do not elaborate.
             - For COMPLEX/DETAIL requests: Provide a deep, structured explanation with Markdown headers.
          2. VISUAL SYNERGY: If diagrams are provided in context, refer to them by name.
          3. ZERO FILLER: No conversational fluff. Start answering immediately.
          4. EXPERT PERSONA: Professional and elite tone.`;
         
         const chatMessages = [
             { role: "system", content: systemContent },
             ...history.map(msg => ({ role: msg.role, content: msg.text })),
             { role: "user", content: prompt }
         ];

         const response = await groqClient.chat.completions.create({
             model: "llama-3.3-70b-versatile", // NEW: Upgraded to Llama 3.3 for maximum reasoning
             messages: chatMessages,
         });
         return response.choices[0].message.content;
     } catch (error) {
         console.error("Error calling LLM:", error);
         throw error;
     }
 }

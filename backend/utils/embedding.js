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

 // Ask LLM using Groq with Hugging Face Fallback
export async function askLLM(prompt, question, history = [], image = null) {
     try {
         if (image) {
             return await askBLIP(question, image, prompt);
         }

         const systemContent = `You are an elite AI tutor. Answer immediately.
          RULES: 
          - Simple query: 1-2 sent. 
          - Complex query: Structured deep dive.
          - Zero filler.`;
         
         const chatMessages = [
             { role: "system", content: systemContent },
             ...history.map(msg => ({ role: msg.role, content: msg.text })),
             { role: "user", content: prompt }
         ];

         try {
            // Priority 1: Groq (Llama 3 8B)
            const response = await groqClient.chat.completions.create({
                model: "llama3-8b-8192", 
                messages: chatMessages,
            });
            return response.choices[0].message.content;
         } catch (groqErr) {
            console.warn("[LLM]: Groq Rate Limit / Error. Falling back to Hugging Face...", groqErr.message);
            
            // Priority 2: Hugging Face Fallback (Llama 3 8B Instruct)
            const hfResponse = await fetch(
                "https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct",
                {
                    headers: {
                        "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                        "Content-Type": "application/json",
                    },
                    method: "POST",
                    body: JSON.stringify({
                        inputs: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${systemContent}<|eot_id|>` + 
                                chatMessages.slice(1).map(m => `<|start_header_id|>${m.role}<|end_header_id|>\n\n${m.content}<|eot_id|>`).join("") +
                                `<|start_header_id|>assistant<|end_header_id|>\n\n`,
                        parameters: { max_new_tokens: 1024, return_full_text: false }
                    }),
                }
            );

            if (!hfResponse.ok) throw new Error("Both Groq and Hugging Face are unavailable.");
            const hfData = await hfResponse.json();
            return hfData[0]?.generated_text || "I am processing your request. Please try again in a moment.";
         }
     } catch (error) {
         console.error("Critical Error in askLLM:", error);
         throw error;
     }
 }

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
    const visionModels = [
        "Salesforce/blip-vqa-base",
        "Salesforce/blip-vqa-capfilt-large"
    ];

    for (const model of visionModels) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(
                    `https://api-inference.huggingface.co/models/${model}`,
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
                    console.error(`HF Raw Error (${model}):`, responseText.substring(0, 500));
                    throw new Error("Hugging Face API is temporarily unavailable.");
                }

                if (!response.ok) {
                    if (result.error?.includes('loading') || result.estimated_time) {
                        console.log(`[VISION]: Model ${model} is loading, waiting 5s...`);
                        await new Promise(res => setTimeout(res, 5000));
                        continue;
                    }
                    throw new Error(result.error || "Vision API Error");
                }

                const answer = result[0]?.answer || result.answer || "I can see the diagram but need more context.";

                const promptText = `VISION ANALYSIS: The student provided an image. My visual analysis shows: "${answer}"

${context ? `DOCUMENT CONTEXT FROM PDF:\n${context}\n\n` : ""}STUDENT QUESTION:
${question}

Instructions: 
- Use the VISION ANALYSIS above to answer the STUDENT QUESTION.
- If the question is simple, answer in 1-2 clear lines.
- If the concept is complex, provide a DEEP, STRUCTURED, and ELABORATED explanation with headers.
- Always refer to the visual evidence found in the image analysis.`;

                return await askLLM(promptText, question, []);

            } catch (error) {
                console.warn(`[VISION]: Model ${model} failed (Attempt ${i+1}):`, error.message);
                if (i === retries - 1) break; // Move to next model
                await new Promise(res => setTimeout(res, 3000));
            }
        }
    }
    throw new Error("Tutor Vision Engine Limit Reached. Please try again in 1 hour.");
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

        // 1. Try Groq (Primary & Secondaries)
        const groqModels = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"];
        for (const model of groqModels) {
            try {
                const response = await groqClient.chat.completions.create({
                    model: model, 
                    messages: chatMessages,
                    max_tokens: 1024
                });
                if (response?.choices?.[0]?.message?.content) {
                    return response.choices[0].message.content;
                }
            } catch (e) {
                console.warn(`[LLM]: Groq model ${model} failed:`, e.message);
            }
        }

        // 2. Try Hugging Face Fallbacks
        console.warn("[LLM]: All Groq models failed or unauthorized. Trying Hugging Face...");
        const fallbackModels = [
            "mistralai/Mistral-7B-Instruct-v0.2",
            "HuggingFaceH4/zephyr-7b-beta",
            "microsoft/Phi-3-mini-4k-instruct",
            "google/gemma-2-2b-it",
            "Tiiuae/falcon-7b-instruct"
        ];

        for (const model of fallbackModels) {
            try {
                console.log(`[LLM]: Attempting HF fallback with ${model}...`);
                const hfResponse = await fetch(
                    `https://api-inference.huggingface.co/models/${model}`,
                    {
                        headers: {
                            "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                            "Content-Type": "application/json",
                        },
                        method: "POST",
                        body: JSON.stringify({
                            inputs: `<|system|>\n${systemContent}</s>\n<|user|>\n${prompt}</s>\n<|assistant|>`,
                            parameters: { max_new_tokens: 512, return_full_text: false }
                        }),
                    }
                );

                const responseText = await hfResponse.text();
                let hfData;
                try {
                    hfData = JSON.parse(responseText);
                } catch (parseErr) {
                    console.warn(`[LLM]: Model ${model} returned non-JSON:`, responseText.substring(0, 100));
                    continue;
                }

                if (hfResponse.ok) {
                    const text = hfData[0]?.generated_text || hfData.generated_text;
                    if (text) return text;
                } else {
                    console.warn(`[LLM]: HF Model ${model} returned ${hfResponse.status}:`, hfData.error || "Unknown");
                    if (hfData.error?.includes("loading")) {
                        await new Promise(res => setTimeout(res, 2000));
                    }
                }
            } catch (e) {
                console.error(`[LLM]: HF Model ${model} error:`, e.message);
            }
        }

        throw new Error("Tutor Limit Reached: All AI engines are currently at capacity. Please try again in 1 hour.");
    } catch (error) {
        console.error("Critical Error in askLLM:", error.message);
        throw error;
    }
}

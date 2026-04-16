import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

// Compute similarity between a source sentence and a list of candidate sentences via HF API
export async function computeSimilarities(source_sentence, sentences) {
    try {
        const response = await fetch(
            "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/sentence-similarity",
            {
                headers: {
                    "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                    "Content-Type": "application/json",
                },
                method: "POST",
                body: JSON.stringify({
                    inputs: { source_sentence, sentences }
                }),
            }
        );
        
        const responseText = await response.text();
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.error("Non-JSON Response from HF:", responseText.substring(0, 200));
            throw new Error("Hugging Face API returned an HTML error page. Likely a service timeout or block.");
        }

        if (!response.ok) {
            console.error("HF Error:", result);
            throw new Error(result.error || "Failed to compute similarity");
        }
        return result; 
    } catch (error) {
        console.error("Error computing similarities:", error);
        throw error;
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
            ? `PRO-LEVEL TUTOR MODE:
Document Context:
${context}

Current Question:
${question}

Instructions: 
- If this is a simple question, answer in 2-3 clear lines.
- If the user asks for detail ("explain", "elaborate", "more"), or if the topic is complex, provide a DEEP, STRUCTURED, and ELABORATED explanation with headers.
- Maintain high structural quality in all responses.`
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
         1. FOR SIMPLE IDENTIFICATION (e.g., 'Who am I?', 'What is my name?'): Answer in LESS THAN 10 WORDS. Be blunt and direct.
         2. FOR BASIC FACTS: Keep it under 2 sentences. No headers. No lists.
         3. FOR ELABORATION: Only switch to 'Professor Mode' with structured Markdown if the user explicitly asks to 'Explain', 'Details', or 'Elaborate'.
         4. NO CONVERSATIONAL FILLER: Never start with 'Based on the document' or 'I understand you want...'. Just give the answer.`;
         
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

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '25mb'
        }
    }
};

// List of models to try in order (vision-capable models)
const MODEL_OPTIONS = [
    { name: 'gemini-1.5-pro', version: 'v1beta' },
    { name: 'gemini-pro-vision', version: 'v1beta' },
    { name: 'gemini-2.0-flash-exp', version: 'v1beta' },
    { name: 'gemini-1.5-flash', version: 'v1beta' },
    { name: 'gemini-pro', version: 'v1' },
];

const buildPrompt = (notes) => {
    const basePrompt = `You are a friendly Thai health coach. Analyze the person in the uploaded image and explain what they might focus on for better health. Then recommend three concise food ideas and three simple exercise suggestions tailored to their apparent needs. 

IMPORTANT: All responses MUST be written in Thai language (ภาษาไทย) only. Do not use English.

Reply strictly in JSON format with this structure (all values must be in Thai):
{
  "summary": "สรุปภาพรวมสุขภาพสั้นๆ เป็นภาษาไทย",
  "foods": ["เมนูอาหารแนะนำ 1", "เมนูอาหารแนะนำ 2", "เมนูอาหารแนะนำ 3"],
  "exercises": ["คำแนะนำการออกกำลังกาย 1", "คำแนะนำการออกกำลังกาย 2", "คำแนะนำการออกกำลังกาย 3"],
  "disclaimer": "คำเตือนสั้นๆ เป็นภาษาไทย"
}`;

    if (!notes) {
        return basePrompt;
    }

    return `${basePrompt}\n\nใช้ข้อมูลเพิ่มเติมจากผู้ใช้: ${notes}\n\nโปรดตอบกลับทั้งหมดเป็นภาษาไทยเท่านั้น`;
};

async function callGeminiWithModel({ imageBase64, mimeType, notes, modelName, apiVersion, apiKey }) {
    const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent`;
    
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: buildPrompt(notes) },
                        {
                            inlineData: {
                                mimeType,
                                data: imageBase64
                            }
                        }
                    ]
                }
            ]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${modelName}): ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response;
}

async function callGemini({ imageBase64, mimeType, notes }) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('Gemini API key not configured. Set GEMINI_API_KEY in your environment.');
    }

    // Try each model until one works
    let lastError = null;
    for (const model of MODEL_OPTIONS) {
        try {
            const response = await callGeminiWithModel({
                imageBase64,
                mimeType,
                notes,
                modelName: model.name,
                apiVersion: model.version,
                apiKey
            });

            const data = await response.json();
            const candidate = data?.candidates?.[0]?.content?.parts || [];
            const combinedText = candidate
                .map((part) => part.text)
                .filter(Boolean)
                .join('\n')
                .trim();

            let parsed;
            try {
                parsed = combinedText ? JSON.parse(combinedText) : null;
            } catch (err) {
                parsed = null;
            }

            return {
                raw: combinedText,
                parsed
            };
        } catch (error) {
            lastError = error;
            console.warn(`Failed to use model ${model.name}:`, error.message);
            // Continue to next model
            continue;
        }
    }

    // If all models failed, throw the last error
    throw lastError || new Error('All Gemini models failed. Please check your API key and model availability.');
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { imageBase64, mimeType, notes } = req.body || {};

    if (!imageBase64 || !mimeType) {
        return res.status(400).json({ error: 'Image data and mimeType are required.' });
    }

    try {
        const result = await callGemini({ imageBase64, mimeType, notes });

        if (result.parsed) {
            return res.status(200).json({
                summary: result.parsed.summary,
                foods: result.parsed.foods,
                exercises: result.parsed.exercises,
                disclaimer: result.parsed.disclaimer,
                raw: result.raw
            });
        }

        return res.status(200).json({
            summary: null,
            foods: null,
            exercises: null,
            disclaimer: null,
            raw: result.raw
        });
    } catch (error) {
        console.error('[Gemini API] error', error);
        return res.status(500).json({ error: error.message || 'Gemini request failed.' });
    }
}

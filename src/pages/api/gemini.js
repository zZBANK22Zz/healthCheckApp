export const config = {
    api: {
        bodyParser: {
            sizeLimit: '25mb'
        }
    }
};

const MODEL_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

const buildPrompt = (notes) => {
    const basePrompt = `You are a friendly Thai health coach. Analyze the person in the uploaded image and explain what they might focus on for better health. Then recommend three concise food ideas and three simple exercise suggestions tailored to their apparent needs. Reply strictly in JSON with this structure: {"summary": "short Thai overview", "foods": ["Thai food idea 1", "Thai food idea 2", "Thai food idea 3"], "exercises": ["exercise tip 1", "exercise tip 2", "exercise tip 3"], "disclaimer": "brief Thai disclaimer"}.`;

    if (!notes) {
        return basePrompt;
    }

    return `${basePrompt}\nใช้ข้อมูลเพิ่มเติมจากผู้ใช้: ${notes}`;
};

async function callGemini({ imageBase64, mimeType, notes }) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('Gemini API key not configured. Set GEMINI_API_KEY in your environment.');
    }

    const response = await fetch(`${MODEL_ENDPOINT}?key=${apiKey}`, {
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
        throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

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

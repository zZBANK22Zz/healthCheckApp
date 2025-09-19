
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

// --- helpers to parse/normalize Gemini output ---
const extractJsonFromText = (text) => {
  if (typeof text !== "string") return null;
  // Capture fenced code block ```json ... ``` or plain {...}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  try {
    // Try exact JSON first
    return JSON.parse(candidate);
  } catch {
    // Try to locate the first JSON object in the string
    const braceIdx = candidate.indexOf('{');
    const lastBraceIdx = candidate.lastIndexOf('}');
    if (braceIdx !== -1 && lastBraceIdx !== -1 && lastBraceIdx > braceIdx) {
      try {
        return JSON.parse(candidate.slice(braceIdx, lastBraceIdx + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

const toArray = (v) => {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string") {
    // Split bullet-like strings into list items
    return v
      .split(/\n|•|-\s|\u2022/) // newline, bullets, hyphen bullets
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeAnalysis = (obj) => ({
  summary: obj?.summary ?? obj?.overview ?? null,
  foods: toArray(obj?.foods ?? obj?.recommended_foods),
  exercises: toArray(obj?.exercises ?? obj?.recommended_exercises),
  disclaimer: obj?.disclaimer ?? obj?.note ?? null,
});
// --- end helpers ---

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB original file keeps request below API size limit after base64 encoding

const convertFileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        const result = reader.result;
        const base64String = typeof result === 'string' ? result.split(',').pop() : '';
        resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
});

export default function Aipage() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [notes, setNotes] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState('');
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    useEffect(() => () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
    }, [previewUrl]);

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            setError('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
            return;
        }

        if (file.size > MAX_IMAGE_BYTES) {
            setError('ไฟล์ใหญ่เกินไป (สูงสุด 8MB) กรุณาลดขนาดหรือเลือกภาพอื่น');
            return;
        }

        setError('');
        setSelectedFile(file);

        // Clean up any existing preview before assigning a new one
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        const nextPreview = URL.createObjectURL(file);
        setPreviewUrl(nextPreview);

        // Reset input value so that the same file can be selected again if needed
        event.target.value = '';
    };

    const resetForm = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        setSelectedFile(null);
        setPreviewUrl('');
        setNotes('');
        setAnalysis(null);
        setError('');

        if (cameraInputRef.current) {
            cameraInputRef.current.value = '';
        }

        if (galleryInputRef.current) {
            galleryInputRef.current.value = '';
        }
    };

    const handleAnalyze = async (event) => {
        event.preventDefault();

        if (!selectedFile) {
            setError('กรุณาเลือกรูปภาพก่อนเริ่มการวิเคราะห์');
            return;
        }

        try {
            setIsAnalyzing(true);
            setError('');
            setAnalysis(null);

            const imageBase64 = await convertFileToBase64(selectedFile);

            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageBase64,
                    mimeType: selectedFile.type,
                    notes: notes.trim()
                })
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload?.error || 'การวิเคราะห์ไม่สำเร็จ กรุณาลองใหม่');
            }

            // Try to interpret payload into structured analysis
            let structured = null;

            // Common fields directly from API
            if (payload && (payload.summary || payload.foods || payload.exercises || payload.disclaimer)) {
              structured = normalizeAnalysis(payload);
            }

            // Some backends return a single string (e.g., payload.text or payload.result) that contains a JSON code block
            if (!structured) {
              const possibleText = payload?.text || payload?.result || payload?.raw || (typeof payload === 'string' ? payload : null);
              const parsed = extractJsonFromText(possibleText ?? "");
              if (parsed) {
                structured = normalizeAnalysis(parsed);
              }
            }

            // If still not structured, fall back to a plain-text summary without exposing JSON formatting
            if (!structured) {
              const plain = (payload?.text || payload?.result || payload?.raw || "").replace(/```[\s\S]*?```/g, "").trim();
              structured = {
                summary: plain || "",
                foods: [],
                exercises: [],
                disclaimer: null,
              };
            }

            setAnalysis({
              ...structured,
              generatedAt: new Date().toISOString(),
              userNotes: notes.trim() || null,
            });
        } catch (err) {
            console.error('Gemini analysis failed', err);
            setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ Gemini');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-sky-100 via-white to-emerald-100 py-12 px-4">
            <div className="mx-auto max-w-4xl space-y-8">
                <div className="flex justify-end">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-800 hover:shadow"
                    >
                        <span aria-hidden="true">←</span>
                        กลับไปหน้าแรก
                    </Link>
                </div>
                <header className="text-center space-y-4">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-2xl shadow-lg">
                        🤖
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800 md:text-4xl">
                        ผู้ช่วยวิเคราะห์สุขภาพด้วย Google Gemini
                    </h1>
                    <p className="text-slate-600 md:text-lg">
                        อัปโหลดหรือถ่ายภาพของคุณ เพื่อรับคำแนะนำด้านอาหารและการออกกำลังกายที่เหมาะสมกับคุณ
                    </p>
                </header>

                <section className="rounded-3xl bg-white/70 p-6 shadow-lg backdrop-blur">
                    <form className="space-y-6" onSubmit={handleAnalyze}>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-3">
                                1. เลือกหรือถ่ายภาพของคุณ
                            </label>
                            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center transition hover:border-slate-300">
                                {previewUrl ? (
                                    <img
                                        src={previewUrl}
                                        alt="ตัวอย่างภาพสุขภาพ"
                                        className="h-56 w-full max-w-md rounded-2xl object-cover shadow-md"
                                    />
                                ) : (
                                    <div className="space-y-2 text-slate-500">
                                        <p className="text-4xl">📸</p>
                                        <p>เลือกรูปภาพหรือถ่ายภาพเพื่อเริ่มต้น</p>
                                        <p className="text-xs">รองรับไฟล์ .jpg .jpeg .png ขนาดไม่เกิน 8MB</p>
                                    </div>
                                )}
                                <div className="flex flex-col items-center gap-3 sm:flex-row">
                                    <button
                                        type="button"
                                        onClick={() => cameraInputRef.current?.click()}
                                        className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-md transition hover:shadow-xl"
                                    >
                                        {selectedFile ? 'ถ่ายภาพใหม่' : 'ถ่ายภาพด้วยกล้อง'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => galleryInputRef.current?.click()}
                                        className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 font-semibold text-purple-600 shadow-md transition hover:shadow-xl"
                                    >
                                        {selectedFile ? 'เลือกรูปอื่น' : 'เลือกจากแกลเลอรี'}
                                    </button>
                                </div>
                                <input
                                    ref={cameraInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                                <input
                                    ref={galleryInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                                {selectedFile && (
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="text-sm font-medium text-slate-500 underline hover:text-slate-700"
                                    >
                                        ล้างข้อมูล
                                    </button>
                                )}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="notes" className="mb-3 block text-sm font-semibold text-slate-700">
                                2. บอกข้อมูลเพิ่มเติม (ไม่บังคับ)
                            </label>
                            <textarea
                                id="notes"
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                                placeholder="บอกเป้าหมายหรืออาการที่อยากให้ AI ช่วยแนะนำ เช่น ต้องการลดน้ำหนักหรืออยากเพิ่มความฟิต"
                                rows={4}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                            />
                        </div>

                        {error && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                            <p className="text-xs text-slate-500">
                                * ข้อมูลจะถูกใช้เพื่อให้คำแนะนำเบื้องต้นเท่านั้น ไม่ทดแทนการพบแพทย์
                            </p>
                            <button
                                type="submit"
                                disabled={isAnalyzing || !selectedFile}
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-3 font-semibold text-white shadow-md transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isAnalyzing ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ด้วย Gemini'}
                            </button>
                        </div>
                    </form>
                </section>

                {isAnalyzing && (
                    <section className="rounded-3xl border border-slate-200 bg-white/60 p-6 text-center shadow-inner">
                        <p className="text-slate-600">กำลังประมวลผลรูปภาพของคุณ รอสักครู่นะ...</p>
                    </section>
                )}

                {analysis && !isAnalyzing && (
                    <section className="space-y-6 rounded-3xl bg-white/80 p-6 shadow-xl">
                        <div className="flex flex-col gap-2">
                            <span className="text-sm font-semibold uppercase tracking-wide text-emerald-500">รายงานสุขภาพอัจฉริยะ</span>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">✨</span>
                                <h2 className="text-xl font-bold text-slate-800">คำแนะนำสำหรับคุณ</h2>
                            </div>
                        </div>

                        {analysis.summary && (
                            <article className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 via-white to-slate-50 p-5 shadow-inner">
                                <header className="mb-2 flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-slate-800">สรุปภาพรวมสุขภาพ</h3>
                                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-600">
                                        Gemini Insight
                                    </span>
                                </header>
                                <p className="leading-relaxed text-slate-700">{analysis.summary}</p>
                            </article>
                        )}

                        <div className="grid gap-6 md:grid-cols-2">
                            {Array.isArray(analysis.foods) && analysis.foods.length > 0 && (
                                <article className="h-full rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-sm">
                                    <header className="mb-4 flex items-center gap-3">
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-200 text-xl">🍱</span>
                                        <div>
                                            <h3 className="text-lg font-semibold text-emerald-700">เมนูอาหารที่แนะนำ</h3>
                                            <p className="text-xs text-emerald-600">ออกแบบเพื่อเสริมสุขภาพของคุณ</p>
                                        </div>
                                    </header>
                                    <ol className="space-y-3 text-sm text-emerald-800">
                                        {analysis.foods.map((item, index) => (
                                            <li key={`food-${index}`} className="flex gap-3 rounded-xl bg-white/60 p-3 shadow-inner">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">
                                                    {index + 1}
                                                </div>
                                                <p className="leading-relaxed">{item}</p>
                                            </li>
                                        ))}
                                    </ol>
                                </article>
                            )}

                            {Array.isArray(analysis.exercises) && analysis.exercises.length > 0 && (
                                <article className="h-full rounded-2xl border border-blue-100 bg-blue-50/70 p-5 shadow-sm">
                                    <header className="mb-4 flex items-center gap-3">
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-200 text-xl">🏃‍♀️</span>
                                        <div>
                                            <h3 className="text-lg font-semibold text-blue-700">การออกกำลังกายที่แนะนำ</h3>
                                            <p className="text-xs text-blue-600">เสริมสร้างความแข็งแรงและความฟิต</p>
                                        </div>
                                    </header>
                                    <ol className="space-y-3 text-sm text-blue-800">
                                        {analysis.exercises.map((item, index) => (
                                            <li key={`exercise-${index}`} className="flex gap-3 rounded-xl bg-white/60 p-3 shadow-inner">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">
                                                    {index + 1}
                                                </div>
                                                <p className="leading-relaxed">{item}</p>
                                            </li>
                                        ))}
                                    </ol>
                                </article>
                            )}
                        </div>

                        {analysis.disclaimer && (
                            <aside className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
                                <div className="flex items-start gap-2">
                                    <span className="text-lg">⚠️</span>
                                    <p>{analysis.disclaimer}</p>
                                </div>
                            </aside>
                        )}

                    </section>
                )}
            </div>
        </main>
    );
}


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
    const [meshPrompt, setMeshPrompt] = useState('');
    const [meshInputType, setMeshInputType] = useState('text');
    const [meshImageFile, setMeshImageFile] = useState(null);
    const [meshImagePreview, setMeshImagePreview] = useState('');
    const [isGeneratingMesh, setIsGeneratingMesh] = useState(false);
    const [meshStatus, setMeshStatus] = useState(null);
    const [meshTaskId, setMeshTaskId] = useState(null);
    const [meshTaskSource, setMeshTaskSource] = useState('text');
    const [meshUrl, setMeshUrl] = useState('');
    const [meshPreviewUrl, setMeshPreviewUrl] = useState('');
    const [meshError, setMeshError] = useState('');
    const [meshTaskApiBase, setMeshTaskApiBase] = useState(null);
    const meshPollRef = useRef(null);
    const meshTaskApiBaseRef = useRef(null);
    const meshImageInputRef = useRef(null);

    useEffect(() => () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
    }, [previewUrl]);

    useEffect(() => {
        return () => {
            if (meshPollRef.current) {
                clearInterval(meshPollRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const existingScript = document.querySelector('script[data-meshy-viewer]');
        if (!existingScript) {
            const script = document.createElement('script');
            script.type = 'module';
            script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
            script.setAttribute('data-meshy-viewer', '');
            document.head.appendChild(script);
        }
    }, []);

    useEffect(() => {
        if (analysis?.summary && !meshPrompt) {
            setMeshPrompt(analysis.summary);
        }
    }, [analysis?.summary, meshPrompt]);

    useEffect(() => () => {
        if (meshImagePreview) {
            URL.revokeObjectURL(meshImagePreview);
        }
    }, [meshImagePreview]);

    useEffect(() => {
        meshTaskApiBaseRef.current = meshTaskApiBase;
    }, [meshTaskApiBase]);

    const stopMeshPolling = () => {
        if (meshPollRef.current) {
            clearInterval(meshPollRef.current);
            meshPollRef.current = null;
        }
    };

    const pollMeshStatus = async (taskId, source, apiBase) => {
        try {
            const params = new URLSearchParams({ taskId, source });
            if (apiBase) {
                params.append('apiBase', apiBase);
            }

            const response = await fetch(`/api/meshy?${params.toString()}`);
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload?.error || 'ไม่สามารถตรวจสอบสถานะ Meshy ได้');
            }

            setMeshStatus(payload.status || null);
            setMeshTaskSource(payload.source || source);
            if (payload.apiBase) {
                setMeshTaskApiBase(payload.apiBase);
            }
            if (payload.previewUrl) {
                setMeshPreviewUrl(payload.previewUrl);
            }
            if (payload.meshUrl) {
                setMeshUrl(payload.meshUrl);
            }

            if (!payload.status || ['SUCCEEDED', 'FAILED', 'CANCELED'].includes(payload.status)) {
                stopMeshPolling();
            }
        } catch (err) {
            console.error('Meshy polling failed', err);
            setMeshError(err.message || 'เกิดข้อผิดพลาดในการตรวจสอบสถานะโมเดล 3D');
            stopMeshPolling();
        }
    };

    const startMeshPolling = (taskId, source, apiBase) => {
        stopMeshPolling();
        const resolveBase = () => apiBase || meshTaskApiBaseRef.current || undefined;
        pollMeshStatus(taskId, source, resolveBase());
        meshPollRef.current = setInterval(() => {
            pollMeshStatus(taskId, source, resolveBase());
        }, 5000);
    };

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
        setMeshTaskApiBase(null);

        if (cameraInputRef.current) {
            cameraInputRef.current.value = '';
        }

        if (galleryInputRef.current) {
            galleryInputRef.current.value = '';
        }
    };

    const handleMeshImageChange = (event) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            setMeshError('กรุณาเลือกไฟล์รูปภาพสำหรับ Meshy เท่านั้น');
            return;
        }

        if (file.size > MAX_IMAGE_BYTES) {
            setMeshError('ไฟล์อ้างอิงใหญ่เกินไป (สูงสุด 8MB)');
            return;
        }

        setMeshError('');

        if (meshImagePreview) {
            URL.revokeObjectURL(meshImagePreview);
        }

        const nextPreview = URL.createObjectURL(file);
        setMeshImageFile(file);
        setMeshImagePreview(nextPreview);

        event.target.value = '';
    };

    const clearMeshImage = () => {
        if (meshImagePreview) {
            URL.revokeObjectURL(meshImagePreview);
        }

        setMeshImageFile(null);
        setMeshImagePreview('');

        if (meshImageInputRef.current) {
            meshImageInputRef.current.value = '';
        }
    };

    const handleMeshInputChange = (type) => {
        setMeshInputType(type);
        setMeshError('');
        setMeshTaskApiBase(null);

        if (type === 'text' && !meshPrompt && analysis?.summary) {
            setMeshPrompt(analysis.summary);
        }

        if (type === 'text') {
            clearMeshImage();
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

    const handleGenerateMesh = async (event) => {
        event.preventDefault();

        if (meshInputType === 'text' && !meshPrompt.trim()) {
            setMeshError('กรุณาใส่คำอธิบายที่ต้องการสร้างโมเดล 3D');
            return;
        }

        if (meshInputType === 'image' && !meshImageFile) {
            setMeshError('กรุณาเลือกรูปภาพอ้างอิงสำหรับ Meshy');
            return;
        }

        try {
            setIsGeneratingMesh(true);
            setMeshError('');
            setMeshStatus(null);
            setMeshTaskId(null);
            setMeshTaskSource(meshInputType === 'image' ? 'image' : 'text');
            setMeshTaskApiBase(null);
            setMeshUrl('');
            setMeshPreviewUrl('');
            stopMeshPolling();

            let bodyPayload;
            if (meshInputType === 'image' && meshImageFile) {
                const base64 = await convertFileToBase64(meshImageFile);
                bodyPayload = {
                    imageBase64: base64,
                    imageMimeType: meshImageFile.type,
                };

                if (meshPrompt.trim()) {
                    bodyPayload.prompt = meshPrompt.trim();
                }
            } else {
                bodyPayload = {
                    prompt: meshPrompt.trim(),
                };
            }

            const response = await fetch('/api/meshy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bodyPayload)
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload?.error || 'การสร้างโมเดล 3D ไม่สำเร็จ กรุณาลองใหม่');
            }

            if (payload?.taskId) {
                const source = payload?.source || (meshInputType === 'image' ? 'image' : 'text');
                const apiBase = payload?.apiBase || null;
                setMeshTaskId(payload.taskId);
                setMeshStatus(payload.status || 'PENDING');
                setMeshTaskSource(source);
                setMeshTaskApiBase(apiBase);
                startMeshPolling(payload.taskId, source, apiBase);
            } else {
                setMeshError('ไม่ได้รับหมายเลขงานจาก Meshy');
            }
        } catch (err) {
            console.error('Meshy generate failed', err);
            setMeshError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ Meshy');
        } finally {
            setIsGeneratingMesh(false);
        }
    };

    const isMeshBusy = isGeneratingMesh || (meshStatus && !['SUCCEEDED', 'FAILED', 'CANCELED'].includes(meshStatus));
    const meshApiVersionLabel = meshTaskApiBase ? meshTaskApiBase.split('/').pop()?.toUpperCase() : null;

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

                <section className="rounded-3xl bg-white/80 p-6 shadow-lg backdrop-blur">
                    <div className="space-y-4">
                        <header className="space-y-2">
                            <h2 className="text-2xl font-bold text-slate-800">สร้างโมเดล 3D ด้วย Meshy</h2>
                            <p className="text-sm text-slate-600">
                                อธิบายสิ่งที่อยากเห็นหรืออัปโหลดรูปอ้างอิง (ภาษาอังกฤษจะให้ผลดีที่สุด) แล้ว Meshy จะสร้างโมเดล 3D ให้คุณ
                            </p>
                        </header>

                        <form className="space-y-4" onSubmit={handleGenerateMesh}>
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleMeshInputChange('text')}
                                    disabled={isMeshBusy}
                                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition shadow ${meshInputType === 'text' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white text-emerald-600 border border-emerald-200 hover:border-emerald-400'} disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                    สร้างจากคำอธิบาย
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleMeshInputChange('image')}
                                    disabled={isMeshBusy}
                                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition shadow ${meshInputType === 'image' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white text-emerald-600 border border-emerald-200 hover:border-emerald-400'} disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                    แปลงภาพเป็น 3D
                                </button>
                            </div>

                            {meshInputType === 'image' && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">
                                        รูปภาพอ้างอิงสำหรับ Meshy
                                    </label>
                                    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                                        {meshImagePreview ? (
                                            <img
                                                src={meshImagePreview}
                                                alt="ตัวอย่างรูปอ้างอิง Meshy"
                                                className="h-48 w-full max-w-md rounded-2xl object-cover shadow-md"
                                            />
                                        ) : (
                                            <div className="space-y-2 text-slate-500">
                                                <p className="text-4xl">🖼️</p>
                                                <p>เลือกรูปภาพอ้างอิงเพื่อสร้างโมเดล 3D</p>
                                                <p className="text-xs">รองรับไฟล์ .jpg .jpeg .png ขนาดไม่เกิน 8MB</p>
                                            </div>
                                        )}
                                        <div className="flex flex-col items-center gap-3 sm:flex-row">
                                            <button
                                                type="button"
                                                onClick={() => meshImageInputRef.current?.click()}
                                                disabled={isMeshBusy}
                                                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-md transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {meshImageFile ? 'เลือกรูปอื่น' : 'อัปโหลดรูปอ้างอิง'}
                                            </button>
                                            {meshImageFile && (
                                                <button
                                                    type="button"
                                                    onClick={clearMeshImage}
                                                    disabled={isMeshBusy}
                                                    className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 font-semibold text-purple-600 shadow-md transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    ล้างรูป
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            ref={meshImageInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleMeshImageChange}
                                            disabled={isMeshBusy}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-slate-700">
                                    {meshInputType === 'image' ? 'คำอธิบายเพิ่มเติม (ไม่บังคับ)' : 'คำอธิบายสำหรับโมเดล 3D'}
                                </label>
                                <textarea
                                    value={meshPrompt}
                                    onChange={(event) => setMeshPrompt(event.target.value)}
                                    rows={4}
                                    className="w-full rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-700 shadow-inner focus:border-purple-400 focus:outline-none"
                                    placeholder={meshInputType === 'image' ? 'เพิ่มรายละเอียดที่อยากให้ Meshy ปรับจากรูป (ไม่ใส่ก็ได้)' : 'เช่น A friendly health coach robot holding fresh vegetables'}
                                    disabled={isMeshBusy}
                                />
                            </div>

                            {meshError && (
                                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                                    {meshError}
                                </p>
                            )}

                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="submit"
                                    disabled={isMeshBusy}
                                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-semibold text-white shadow-md transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isMeshBusy ? 'กำลังสร้างโมเดล…' : 'สร้างโมเดล 3D'}
                                </button>
                                {meshStatus && (
                                    <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-600">
                                        สถานะ: {meshStatus}
                                        {meshTaskSource === 'image' ? ' • IMAGE' : ' • TEXT'}
                                        {meshApiVersionLabel ? ` • ${meshApiVersionLabel}` : ''}
                                    </span>
                                )}
                            </div>
                        </form>

                        {meshPreviewUrl && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-slate-700">ภาพตัวอย่างจาก Meshy</h3>
                                <img
                                    src={meshPreviewUrl}
                                    alt="ตัวอย่างโมเดล 3D จาก Meshy"
                                    className="w-full rounded-2xl border border-slate-200 object-cover shadow"
                                />
                            </div>
                        )}

                        {meshUrl && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-slate-700">โมเดล 3D</h3>
                                <model-viewer
                                    src={meshUrl}
                                    camera-controls
                                    autoplay
                                    shadow-intensity="1"
                                    exposure="1"
                                    style={{ width: '100%', height: '360px', borderRadius: '16px', background: '#f8fafc' }}
                                >
                                    กำลังโหลดโมเดล 3D...
                                </model-viewer>
                                <a
                                    href={meshUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm font-semibold text-purple-600 hover:text-purple-800"
                                >
                                    ดาวน์โหลดไฟล์ .glb
                                    <span aria-hidden="true">↗</span>
                                </a>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}

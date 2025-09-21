const DEFAULT_TOPOLOGY = 'triangle';
const DEFAULT_MODE = 'preview';

const DEFAULT_BASE_URLS = ['https://api.meshy.ai/v1', 'https://api.meshy.ai/v2'];

const sanitizeBase = (value) => (typeof value === 'string' ? value.replace(/\/+$/, '') : null);

const getMeshyBaseUrls = (preferredBase) => {
  const candidates = [];
  if (preferredBase) {
    candidates.push(sanitizeBase(preferredBase));
  }

  if (process.env.MESHY_API_BASE_URL) {
    candidates.push(sanitizeBase(process.env.MESHY_API_BASE_URL));
  }

  candidates.push(...DEFAULT_BASE_URLS);

  return [...new Set(candidates.filter(Boolean))];
};

async function requestWithFallback(path, createInit, { preferredBase } = {}) {
  const bases = getMeshyBaseUrls(preferredBase);

  if (bases.length === 0) {
    throw new Error('Meshy request failed: No base URLs available.');
  }

  let lastError = null;

  for (const base of bases) {
    const init = await createInit();
    const response = await fetch(`${base}${path}`, init);

    if (response.ok) {
      return { response, baseUrl: base };
    }

    const errorText = await response.text();

    if (response.status !== 404) {
      throw new Error(`Meshy request failed (${base}${path}): ${response.status} ${response.statusText} - ${errorText}`);
    }

    lastError = {
      base,
      status: response.status,
      statusText: response.statusText,
      errorText,
    };
  }

  if (lastError) {
    throw new Error(`Meshy request failed (${lastError.base}${path}): ${lastError.status} ${lastError.statusText} - ${lastError.errorText}`);
  }

  throw new Error('Meshy request failed: Unable to contact API.');
}

function buildHeaders(apiKey, options = {}) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
  };

  if (options.contentType) {
    headers['Content-Type'] = options.contentType;
  }

  return headers;
}

async function createTextTo3D({ prompt, style, topology, mode, apiKey }) {
  const payload = JSON.stringify({
    mode: mode || DEFAULT_MODE,
    prompt,
    style,
    topology: topology || DEFAULT_TOPOLOGY,
  });

  const { response, baseUrl } = await requestWithFallback('/text-to-3d', () => ({
    method: 'POST',
    headers: buildHeaders(apiKey, { contentType: 'application/json' }),
    body: payload,
  }));

  return {
    data: await response.json(),
    baseUrl,
  };
}

function extensionFromMime(mimeType) {
  if (!mimeType) return 'png';
  const mapping = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
  };
  return mapping[mimeType] || 'png';
}

async function createImageTo3D({ imageBase64, imageMimeType, prompt, style, mode, topology, apiKey }) {
  if (!globalThis.FormData) {
    throw new Error('FormData is unavailable in this environment.');
  }

  const buffer = Buffer.from(imageBase64, 'base64');
  const extension = extensionFromMime(imageMimeType);

  const buildFormData = () => {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: imageMimeType || 'image/png' });

    formData.append('image', blob, `reference.${extension}`);

    if (prompt) {
      formData.append('prompt', prompt);
    }
    if (style) {
      formData.append('style', style);
    }
    if (mode) {
      formData.append('mode', mode);
    }
    if (topology) {
      formData.append('topology', topology);
    }

    return formData;
  };

  const { response, baseUrl } = await requestWithFallback('/image-to-3d', () => ({
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: buildFormData(),
  }));

  return {
    data: await response.json(),
    baseUrl,
  };
}

async function getImageTask(taskId, apiKey, preferredBase) {
  const { response, baseUrl } = await requestWithFallback(`/image-to-3d/${taskId}`, () => ({
    method: 'GET',
    headers: buildHeaders(apiKey),
  }), { preferredBase });

  return {
    data: await response.json(),
    baseUrl,
  };
}

async function getTextTask(taskId, apiKey, preferredBase) {
  const { response, baseUrl } = await requestWithFallback(`/text-to-3d/${taskId}`, () => ({
    method: 'GET',
    headers: buildHeaders(apiKey),
  }), { preferredBase });

  return {
    data: await response.json(),
    baseUrl,
  };
}

export default async function handler(req, res) {
  const apiKey = process.env.MESHY_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Meshy API key not configured. Set MESHY_API_KEY in your environment.' });
  }

  if (req.method === 'POST') {
    const { imageBase64 } = req.body || {};

    if (imageBase64) {
      const { prompt, style, topology, mode, imageMimeType } = req.body || {};

      try {
      const { data: task, baseUrl } = await createImageTo3D({
        imageBase64,
        imageMimeType,
        prompt,
        style,
        topology,
        mode,
        apiKey,
      });

      return res.status(202).json({
        taskId: task?.task_id,
        status: task?.status ?? 'PENDING',
        source: 'image',
        apiBase: baseUrl,
      });
    } catch (error) {
      console.error('[Meshy API] image create error', error);
      return res.status(500).json({ error: error.message || 'Meshy image request failed.' });
    }
    }

    const { prompt, style, topology, mode } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'A text prompt is required to generate a 3D model.' });
    }

    try {
      const { data: task, baseUrl } = await createTextTo3D({ prompt, style, topology, mode, apiKey });
      return res.status(202).json({
        taskId: task?.task_id,
        status: task?.status ?? 'PENDING',
        source: 'text',
        apiBase: baseUrl,
      });
    } catch (error) {
      console.error('[Meshy API] create error', error);
      return res.status(500).json({ error: error.message || 'Meshy request failed.' });
    }
  }

  if (req.method === 'GET') {
    const { taskId, source, apiBase } = req.query || {};

    if (!taskId || typeof taskId !== 'string') {
      return res.status(400).json({ error: 'taskId query parameter is required.' });
    }

    try {
      const isImageTask = source === 'image';
      const { data: task, baseUrl } = isImageTask
        ? await getImageTask(taskId, apiKey, apiBase)
        : await getTextTask(taskId, apiKey, apiBase);
      return res.status(200).json({
        taskId,
        status: task?.status,
        meshUrl: task?.model_urls?.glb ?? null,
        previewUrl: task?.preview_image_url ?? null,
        task,
        source: isImageTask ? 'image' : 'text',
        apiBase: baseUrl,
      });
    } catch (error) {
      console.error('[Meshy API] status error', error);
      return res.status(500).json({ error: error.message || 'Meshy status request failed.' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}

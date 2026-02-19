// Vercel Serverless Function (Node runtime)
// Route: /api/cloudinary-delete

type Req = { method?: string; body?: any; query?: any };
type Res = {
  status: (code: number) => Res;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

function json(res: Res, status: number, body: any) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204);
    return res.end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const cloudName = 'do0vru2lm';
    const apiKey    = '721966247349349';
    const apiSecret = 'fIyuWNJbF964jHUergtHSQJH3Qw';

    const publicId = (req.body?.publicId || req.query?.publicId) as string | undefined;
    if (!publicId) {
      return json(res, 400, { error: 'Missing publicId' });
    }

    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const url  = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/image/upload?public_ids[]=${encodeURIComponent(publicId)}&invalidate=true`;

    const r = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    const text = await r.text().catch(() => '');
    if (!r.ok) {
      return json(res, r.status, { error: 'Cloudinary delete failed', details: text.slice(0, 500) });
    }

    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    return json(res, 200, { ok: true, result: data });

  } catch (e: any) {
    console.error(e);
    return json(res, 500, { error: 'Unexpected error', message: e?.message || String(e) });
  }
}
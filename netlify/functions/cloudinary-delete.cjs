/**
 * Netlify Function
 * Endpoint: /.netlify/functions/cloudinary-delete
 *
 * Expects JSON body: { publicId: string }
 *
 * Required env vars on Netlify:
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 */

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { Allow: 'POST' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing Cloudinary server env vars' }) };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const publicId = body.publicId;
    if (!publicId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing publicId' }) };
    }

    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/image/upload?public_ids[]=${encodeURIComponent(publicId)}&invalidate=true`;

    const r = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Basic ${auth}` },
    });

    const text = await r.text().catch(() => '');
    if (!r.ok) {
      return { statusCode: r.status, body: JSON.stringify({ error: 'Cloudinary delete failed', details: text.slice(0, 500) }) };
    }

    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

    return { statusCode: 200, body: JSON.stringify({ ok: true, result: data }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Unexpected error', message: e?.message || String(e) }) };
  }
};

/**
 * Cloudflare Worker: send daily reminders via Firebase Cloud Messaging (FCM).
 *
 * Flow:
 * - The PWA stores FCM tokens in Firestore under users/{uid}/push/tokens/*.
 * - This worker reads all tokens and sends an FCM message to each.
 *
 * IMPORTANT:
 * - Requires Firebase service account credentials as Worker secrets.
 * - Uses FCM HTTP v1 API (OAuth2 service account JWT).
 */

export interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  CRON_KEY: string;
}

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', ...(init?.headers || {}) },
    ...init,
  });

function assertEnv(env: Env) {
  const missing: string[] = [];
  if (!env.FIREBASE_PROJECT_ID) missing.push('FIREBASE_PROJECT_ID');
  if (!env.FIREBASE_CLIENT_EMAIL) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!env.FIREBASE_PRIVATE_KEY) missing.push('FIREBASE_PRIVATE_KEY');
  if (!env.CRON_KEY) missing.push('CRON_KEY');
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

function pemToKey(pem: string) {
  const clean = pem.replace(/\\n/g, '\n');
  return clean;
}

function redactError(err: unknown) {
  if (err instanceof Error) {
    // Avoid leaking secrets; keep message + top of stack for debugging.
    return {
      name: err.name,
      message: err.message,
      stack: (err.stack || '').split('\n').slice(0, 6).join('\n'),
    };
  }
  return { message: String(err) };
}

async function signRS256(privateKeyPem: string, data: string): Promise<string> {
  const enc = new TextEncoder();

  // Cloudflare Workers supports WebCrypto importKey for PKCS8.
  const keyData = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');

  const pkcs8 = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(data));
  const sigBytes = new Uint8Array(signature);
  const b64 = btoa(String.fromCharCode(...sigBytes));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64url(input: string): string {
  const b64 = btoa(input);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function getAccessToken(env: Env): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60 * 55;

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = b64url(
    JSON.stringify({
      iss: env.FIREBASE_CLIENT_EMAIL,
      scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat,
      exp,
    })
  );

  const unsigned = `${header}.${claimSet}`;
  const signature = await signRS256(pemToKey(env.FIREBASE_PRIVATE_KEY), unsigned);
  const jwt = `${unsigned}.${signature}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const body = await r.json();
  if (!r.ok) {
    throw new Error(`OAuth token error: ${r.status} ${JSON.stringify(body)}`);
  }
  return body.access_token as string;
}

async function firestoreListAllTokens(env: Env, accessToken: string): Promise<string[]> {
  // Collection-group query for all user subcollections named `pushTokens`.
  // Uses Firestore REST `runQuery`.
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;

  const query = {
    structuredQuery: {
      from: [{ collectionId: 'pushTokens', allDescendants: true }],
      // Filter out documents that don't have token set (defensive).
      where: {
        fieldFilter: {
          field: { fieldPath: 'token' },
          op: 'IS_NOT_NULL',
        },
      },
      // A small limit to avoid runaway costs; you can increase if you have many users.
      limit: 500,
    },
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(query),
  });

  const rows = (await r.json()) as any[];
  if (!r.ok) throw new Error(`Firestore runQuery error: ${r.status} ${JSON.stringify(rows)}`);

  const tokens: string[] = [];
  for (const row of rows) {
    const doc = row?.document;
    const token = doc?.fields?.token?.stringValue;
    if (typeof token === 'string' && token.length > 0) tokens.push(token);
  }
  return Array.from(new Set(tokens));
}

async function sendFCM(env: Env, accessToken: string, token: string) {
  const url = `https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`;
  const message = {
    message: {
      token,
      // Send data-only to avoid duplicate notifications. The service worker will display it.
      data: {
        title: 'VisionFlow',
        body: "Reminder: don't forget to log “Stayed Clean Today”.",
        url: '/',
      },
    },
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    return { ok: false, status: r.status, body };
  }
  return { ok: true, status: r.status, body };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);
      if (url.pathname === '/health') return json({ ok: true });

      // Minimal debug endpoint to verify OAuth works without hitting Firestore/FCM.
      if (url.pathname === '/debug/oauth') {
        if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });
        assertEnv(env);
        const key = req.headers.get('x-cron-key') || '';
        if (key !== env.CRON_KEY) return json({ error: 'Unauthorized' }, { status: 401 });
        const accessToken = await getAccessToken(env);
        return json({ ok: true, accessTokenPrefix: accessToken.slice(0, 12) + '…' });
      }

      if (url.pathname === '/send') {
        if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });
        assertEnv(env);
        const key = req.headers.get('x-cron-key') || '';
        if (key !== env.CRON_KEY) return json({ error: 'Unauthorized' }, { status: 401 });

        const accessToken = await getAccessToken(env);

        const tokens = await firestoreListAllTokens(env, accessToken);
        const results = [];
        for (const t of tokens) {
          results.push({ token: t.slice(0, 16) + '…', ...(await sendFCM(env, accessToken, t)) });
        }
        return json({ ok: true, sent: results.length, results });
      }

      return json({ error: 'Not found' }, { status: 404 });
    } catch (err) {
      // Prevent Worker from crashing into Cloudflare 1101.
      return json({ ok: false, error: redactError(err) }, { status: 500 });
    }
  },
};

# Cloudflare Worker – VisionFlow Push Sender (FCM)

This worker sends daily reminder notifications to all saved **FCM tokens** stored in Firestore.

## Prerequisites
1. Enable Firebase Cloud Messaging for your project.
2. Generate a **Web Push certificate (VAPID key)** in Firebase Console.
3. Create a Firebase **Service Account** JSON.

## Firestore storage
The app stores tokens at:

`users/{uid}/pushTokens/{tokenDocId}` with fields:
- `token: string`
- `updatedAt`
- `createdAt`

## Worker routes
- `POST /send` (protected with `X-CRON-KEY`)

## Secrets / Vars
Set these secrets in Cloudflare:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (the private key string from service account; keep newlines as `\n`)
- `CRON_KEY` (random secret)

## Cron Trigger
Configure Cloudflare Cron Trigger to hit `/send` at **23:00 Asia/Colombo**.

Cloudflare cron is UTC-based; Sri Lanka is UTC+5:30.
So 23:00 (SL) = 17:30 (UTC).

Cron schedule: `30 17 * * *`

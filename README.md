<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1kWF0lbx_wpvON_zITpDp5fSU_MvlZ9TH

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

### If local changes don't show up (PWA cache)

This app uses a PWA service worker (Workbox). If you previously opened the app, the service worker can serve **cached/stale JS**.

To fully refresh your local app:

1) In Chrome/Edge: **DevTools → Application → Service Workers → Unregister**
2) In DevTools: **Application → Storage → Clear site data**
3) Hard refresh.

---

## Shared Vision Board (Cloudinary)

This app uploads vision images to **Cloudinary** (unsigned upload preset) and shows a **shared** gallery to all users by fetching Cloudinary’s public tag-list JSON:

`https://res.cloudinary.com/<cloud_name>/image/list/<tag>.json`

### 1) Enable Cloudinary JSON lists

In the Cloudinary console:

1. **Settings**
2. **Security**
3. Enable **JSON lists**

If this is disabled, Cloudinary will respond with **401** for the `.../image/list/...` URL.

### 2) Environment variables

Add these to your local `.env`:

- `VITE_CLOUDINARY_CLOUD_NAME`
- `VITE_CLOUDINARY_UPLOAD_PRESET`
- `VITE_CLOUDINARY_VISION_TAG` (defaults to `vision-board`)

Uploads are tagged with `VITE_CLOUDINARY_VISION_TAG` so they appear in the shared list.

---

## Deleting shared (Cloudinary) images (including n8n uploads)

By default, images that come from the Cloudinary **tag list** are "shared" (global) images. Deleting those requires a **server-side** call to Cloudinary (Admin API), so the frontend cannot do it directly.

This repo includes ready-to-deploy serverless delete functions for **Vercel** and **Netlify**.

### Option 1: Vercel

1) Deploy the repo to Vercel.

2) Set these **server** environment variables in Vercel (Project → Settings → Environment Variables):

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

3) In your frontend env (`.env`), set:

```
VITE_CLOUDINARY_DELETE_ENDPOINT=/api/cloudinary-delete
```

Now the delete button for shared images will call the Vercel function.

### Option 2: Netlify

1) Deploy the repo to Netlify.

2) Set these **server** environment variables in Netlify (Site settings → Environment variables):

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

3) In your frontend env (`.env`), set:

```
VITE_CLOUDINARY_DELETE_ENDPOINT=/.netlify/functions/cloudinary-delete
```

Now the delete button for shared images will call the Netlify function.

### Notes

- Your n8n workflow must upload to Cloudinary using the same tag (`VITE_CLOUDINARY_VISION_TAG`) so the image appears in the board.
- The UI uses Cloudinary `public_id` (from the tag list JSON) to delete. If `public_id` isn't present in the JSON list response, enable Cloudinary JSON lists and ensure the response includes it.

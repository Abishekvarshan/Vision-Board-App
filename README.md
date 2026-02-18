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

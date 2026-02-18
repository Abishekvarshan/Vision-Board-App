import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Image as ImageIcon, X, Loader2, UploadCloud } from 'lucide-react';
import { VisionItem, CATEGORIES, Category } from '../types';

interface Props {
  items: VisionItem[];
  onAddItem: (item: VisionItem) => void;
  onDeleteItem: (id: string) => void;
}

// Configuration for Cloudinary (UNSIGNED upload)
// IMPORTANT: Do not use Cloudinary API secret in frontend.
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const VISION_TAG = import.meta.env.VITE_CLOUDINARY_VISION_TAG || 'vision-board';

const cloudinaryTagListUrl = (cloudName: string, tag: string) =>
  `https://res.cloudinary.com/${cloudName}/image/list/${tag}.json`;

export const VisionBoard: React.FC<Props> = ({ items, onAddItem, onDeleteItem }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>('Personal');
  const [isUploading, setIsUploading] = useState(false);

  // Global images (visible to everyone): fetched from Cloudinary public tag list endpoint.
  const [globalItems, setGlobalItems] = useState<VisionItem[]>([]);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const mergedItems = useMemo(() => {
    // Show global items first, then any local items that aren't already present.
    const seen = new Set(globalItems.map((i) => i.url));
    const localOnly = items.filter((i) => !seen.has(i.url));
    return [...globalItems, ...localOnly];
  }, [globalItems, items]);

  const isGlobalItem = useCallback((item: VisionItem) => {
    return globalItems.some((g) => g.url === item.url);
  }, [globalItems]);

  const loadGlobalItems = async () => {
    setIsLoadingGlobal(true);
    setGlobalError(null);
    try {
      if (!CLOUD_NAME) throw new Error('Missing VITE_CLOUDINARY_CLOUD_NAME');

      // Cloudinary provides a public JSON list for a tag if the account setting "JSON List" is enabled.
      // URL format: https://res.cloudinary.com/<cloud_name>/image/list/<tag>.json
      // Add a cache-buster so the list updates quickly when new images are added.
      const url = `${cloudinaryTagListUrl(CLOUD_NAME, VISION_TAG)}?t=${Date.now()}`;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) {
        // When JSON lists are disabled, Cloudinary often responds 401 with a non-JSON body.
        const text = await r.text().catch(() => '');
        throw new Error(
          `Cloudinary tag list is not accessible (HTTP ${r.status}). ` +
          `Enable Cloudinary "JSON lists" (Settings → Security → JSON lists), then retry. ` +
          (text ? `Response: ${text.slice(0, 200)}` : '')
        );
      }

      let data: any;
      try {
        data = await r.json();
      } catch {
        throw new Error('Cloudinary tag list response was not valid JSON. Check Cloudinary JSON lists setting.');
      }

      const resources = data?.resources || [];

      if (!Array.isArray(resources) || resources.length === 0) {
        setGlobalItems([]);
        return;
      }

      const normalized: VisionItem[] = resources.map((img: any) => {
        // Depending on Cloudinary settings, the JSON list may include `secure_url` / `url`.
        // If not present, we can deterministically construct the delivery URL.
        const fallbackUrl = img?.public_id && img?.format
          ? `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${img.public_id}.${img.format}`
          : '';

        const src = img?.secure_url || img?.url || fallbackUrl;

        return {
          id: img.asset_id || img.public_id || crypto.randomUUID(),
          url: src,
          category: 'Personal',
          caption: '',
          createdAt: img.created_at ? Date.parse(img.created_at) : Date.now(),
        };
      }).filter((i: VisionItem) => Boolean(i.url));

      setGlobalItems(normalized);
    } catch (e: any) {
      console.error(e);
      setGlobalError(e?.message || String(e));
    } finally {
      setIsLoadingGlobal(false);
    }
  };

  useEffect(() => {
    loadGlobalItems();

    // Poll periodically so the gallery updates automatically when new images are added to Cloudinary.
    const id = window.setInterval(() => {
      loadGlobalItems();
    }, 20_000);

    return () => window.clearInterval(id);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    // Ensure uploads are discoverable for everyone.
    formData.append('tags', VISION_TAG);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Cloudinary upload failed');
      }

      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      // Fallback to base64 if Cloudinary fails (for demo purposes)
      return previewUrl || '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    
    try {
      const uploadedUrl = await uploadToCloudinary(selectedFile);
      
      onAddItem({
        id: crypto.randomUUID(),
        url: uploadedUrl,
        caption: '',
        category,
        createdAt: Date.now()
      });

      // Refresh global list so everyone sees new uploads immediately on this client.
      loadGlobalItems();
      
      resetForm();
    } catch (err) {
      alert("Failed to upload image. Please check your Cloudinary configuration.");
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Vision Board</h2>
                  </div>
      </div>

      {/* Floating action button (bottom-left) */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        aria-label="Add vision"
        className="fixed bottom-24 left-4 md:bottom-6 md:left-6 z-[55] inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Pinterest-style masonry layout */}
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 [column-fill:_balance]">
        {(mergedItems.length === 0 && !isLoadingGlobal) ? (
          <div className="col-span-full py-32 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-400 bg-white/50 dark:bg-slate-900/30">
            <div className="p-5 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
              <ImageIcon className="w-12 h-12 opacity-30" />
            </div>
            <p className="text-lg font-medium text-slate-600 dark:text-slate-200">Your future starts here.</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Click the button to add your first goal.</p>
          </div>
        ) : (
          mergedItems.map(item => (
            <div key={item.id} className="mb-4 break-inside-avoid">
              <div className="group relative bg-white dark:bg-slate-900 rounded-[1.75rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-slate-100 dark:border-slate-800">
                <img
                  src={item.url}
                  alt="Vision"
                  className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  loading="lazy"
                />

                <button
                  onClick={() => onDeleteItem(item.id)}
                  className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-md text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50"
                  aria-label="Delete"
                  disabled={isGlobalItem(item)}
                  title={isGlobalItem(item) ? 'Shared image (cannot delete from Cloudinary here)' : 'Delete'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!isLoadingGlobal && !globalError && globalItems.length === 0 && (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          No shared images yet. Upload one and it will appear here for everyone.
        </div>
      )}

      {(isLoadingGlobal || globalError) && (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {isLoadingGlobal ? (
            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading shared vision board…</span>
          ) : (
            <span>
              Failed to load shared images: {globalError}{' '}
              <button className="underline" onClick={loadGlobalItems}>Retry</button>
            </span>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Add to Board</h3>
              <button 
                onClick={resetForm} 
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                disabled={isUploading}
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="relative aspect-video bg-slate-50 dark:bg-slate-950 rounded-3xl flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-200 dark:border-slate-800 transition-all hover:border-indigo-300">
                {previewUrl ? (
                  <div className="relative w-full h-full">
                    <img src={previewUrl} className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center p-6 text-center group">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl mb-3 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-colors">
                      <UploadCloud className="w-10 h-10 text-indigo-500" />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Choose an image</span>
                    <span className="text-xs text-slate-400 mt-1">PNG, JPG or WebP</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                        category === cat 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:border-indigo-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                type="submit"
                disabled={!selectedFile || isUploading}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold mt-4 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Save to Board'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
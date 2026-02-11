import React, { useState } from 'react';
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

export const VisionBoard: React.FC<Props> = ({ items, onAddItem, onDeleteItem }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState<Category>('Personal');
  const [isUploading, setIsUploading] = useState(false);

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
        caption,
        category,
        createdAt: Date.now()
      });
      
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
    setCaption('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Vision Board</h2>
          <p className="text-slate-500 dark:text-slate-400">Visualize your journey to the person you want to become.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
        >
          <Plus className="w-5 h-5" /> Add Vision
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {items.length === 0 ? (
          <div className="col-span-full py-32 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-400 bg-white/50 dark:bg-slate-900/30">
            <div className="p-5 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
              <ImageIcon className="w-12 h-12 opacity-30" />
            </div>
            <p className="text-lg font-medium text-slate-600 dark:text-slate-200">Your future starts here.</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Click the button to add your first goal.</p>
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className="group relative bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 border border-slate-100 dark:border-slate-800">
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                <img src={item.url} alt={item.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="absolute top-4 left-4">
                <span className="px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider text-indigo-600 shadow-sm border border-white/50">
                  {item.category}
                </span>
              </div>
              <button 
                onClick={() => onDeleteItem(item.id)}
                className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-md text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="p-5">
                <p className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug">{item.caption || 'Future Goal'}</p>
                <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold tracking-widest">
                  {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

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
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">The Vision</label>
                <input 
                  type="text" 
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="What does this represent?"
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white dark:focus:bg-slate-950 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
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
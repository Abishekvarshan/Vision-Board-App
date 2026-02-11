
import React, { useState } from 'react';
import { Plus, Trash2, Image as ImageIcon, X } from 'lucide-react';
import { VisionItem, CATEGORIES, Category } from '../types';

interface Props {
  items: VisionItem[];
  onAddItem: (item: VisionItem) => void;
  onDeleteItem: (id: string) => void;
}

export const VisionBoard: React.FC<Props> = ({ items, onAddItem, onDeleteItem }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newImage, setNewImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState<Category>('Personal');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImage) return;
    
    onAddItem({
      id: crypto.randomUUID(),
      url: newImage,
      caption,
      category,
      createdAt: Date.now()
    });
    
    setNewImage(null);
    setCaption('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Vision Board</h2>
          <p className="text-slate-500">Visualize your future. Manifest your dreams.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5" /> Add Vision
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.length === 0 ? (
          <div className="col-span-full py-20 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400">
            <ImageIcon className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg">Your vision is a blank canvas.</p>
            <p className="text-sm">Start by adding your first goal image.</p>
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100">
              <img src={item.url} alt={item.caption} className="w-full h-64 object-cover" />
              <div className="absolute top-3 left-3">
                <span className="px-3 py-1 bg-white/90 backdrop-blur rounded-full text-xs font-semibold text-indigo-600 shadow-sm">
                  {item.category}
                </span>
              </div>
              <button 
                onClick={() => onDeleteItem(item.id)}
                className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="p-4">
                <p className="font-medium text-slate-800 line-clamp-2">{item.caption || 'Unlabeled vision'}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">New Vision Item</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative aspect-video bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-200">
                {newImage ? (
                  <img src={newImage} className="w-full h-full object-cover" />
                ) : (
                  <label className="cursor-pointer flex flex-col items-center">
                    <Plus className="w-10 h-10 text-slate-300 mb-2" />
                    <span className="text-sm font-medium text-slate-500">Upload Image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Inspiration / Goal</label>
                <input 
                  type="text" 
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="What does this represent?"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        category === cat ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                type="submit"
                disabled={!newImage}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold mt-4 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
              >
                Save Vision
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

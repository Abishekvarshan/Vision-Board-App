
import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { VisionItem, Task } from '../types';
import { Send, Sparkles, User, Bot, Loader2 } from 'lucide-react';

interface Props {
  visionItems: VisionItem[];
  tasks: Task[];
}

export const AIAssistant: React.FC<Props> = ({ visionItems, tasks }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      // Re-initialize for each request to ensure current API key is used
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = `
        User Vision Board Items: ${visionItems.map(i => `${i.category}: ${i.caption}`).join(', ')}
        Today's Tasks: ${tasks.filter(t => t.date === new Date().toISOString().split('T')[0]).map(t => `${t.text} (${t.completed ? 'done' : 'pending'})`).join(', ')}
      `;

      // Use systemInstruction for persona and rules
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Context: ${context}\nUser says: ${userMessage}`,
        config: {
          systemInstruction: "You are a professional life coach and vision board specialist. Provide brief, motivating, and highly personalized advice based on the provided vision board items and daily tasks. Keep it under 3 sentences. Be encouraging but direct.",
        }
      });

      // Use the .text property directly (not a method call)
      setMessages(prev => [...prev, { role: 'ai', text: response.text || "I'm feeling inspired by your vision! Keep going." }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'ai', text: "I'm having trouble connecting right now, but I still believe in your vision!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-200px)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          Vision Coach <Sparkles className="w-6 h-6 text-indigo-500" />
        </h2>
        <p className="text-slate-500">Personalized guidance based on your vision board and daily focus.</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
            <div className="p-4 bg-indigo-50 rounded-full">
              <Sparkles className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-center px-8">Ask me for motivation, advice on your tasks, or how to better align your day with your long-term vision.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl flex gap-3 ${
              m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
            }`}>
              {m.role === 'ai' && <Bot className="w-5 h-5 shrink-0 text-indigo-500" />}
              <p className="text-sm leading-relaxed">{m.text}</p>
              {m.role === 'user' && <User className="w-5 h-5 shrink-0 text-indigo-200" />}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-100 p-4 rounded-2xl flex gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              <p className="text-sm text-slate-400">Reflecting on your vision...</p>
            </div>
          </div>
        )}
      </div>

      <div className="glass border border-slate-200 p-2 rounded-3xl shadow-lg flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask your coach..."
          className="flex-1 px-4 py-2 bg-transparent focus:outline-none text-slate-800"
        />
        <button 
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

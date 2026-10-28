import React, { useState } from 'react';
import { convex, api as convexApi } from '../convex.js';
import { useAuth } from '../hooks/useAuth.js';
import { X, Users, Sparkles } from 'lucide-react';

interface CreateCircleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCircleCreated?: (circle: any) => void;
}

export const CreateCircleModal: React.FC<CreateCircleModalProps> = ({
  isOpen,
  onClose,
  onCircleCreated,
}) => {
  const { user: currentUser } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxMembers, setMaxMembers] = useState(15);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !currentUser?.id) return;

    setIsLoading(true);
    setError(null);
    try {
      const circle = await (convex as any).mutation(convexApi.circles.createCircle, {
        name: name.trim(),
        description: description.trim() || undefined,
        createdById: currentUser.id as any,
        maxMembers,
      });

      setName('');
      setDescription('');
      setMaxMembers(15);
      onClose();
      if (onCircleCreated) onCircleCreated(circle);
    } catch (err: any) {
      console.error('Failed to create circle:', err);
      setError(err.message || 'Failed to create intimate circle');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md dark:bg-slate-950 bg-white border dark:border-white/10 border-slate-200 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 space-y-4 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl dark:bg-purple-500/20 bg-purple-100 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold dark:text-white text-slate-900">Create Intimate Circle</h3>
              <p className="text-[11px] dark:text-slate-400 text-slate-500">Low-noise, intimate discussion space</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg dark:text-slate-400 text-slate-500 dark:hover:text-white hover:text-slate-900 dark:hover:bg-white/5 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl dark:bg-rose-500/10 bg-rose-50 border dark:border-rose-500/20 border-rose-200 text-xs text-rose-600 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold dark:text-slate-300 text-slate-700 mb-1.5">
              Circle Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Deep Work Collective, Midnight Readers"
              className="w-full px-3.5 py-2.5 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-white/10 border-slate-200 text-xs dark:text-white text-slate-900 dark:placeholder-slate-500 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold dark:text-slate-300 text-slate-700 mb-1.5">
              Description / Intent
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this circle for? (Keeps expectations calm & clear)"
              className="w-full px-3.5 py-2.5 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-white/10 border-slate-200 text-xs dark:text-white text-slate-900 dark:placeholder-slate-500 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold dark:text-slate-300 text-slate-700">Max Member Limit</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{maxMembers} members</span>
            </div>
            <input
              type="range"
              min={3}
              max={25}
              value={maxMembers}
              onChange={(e) => setMaxMembers(parseInt(e.target.value, 10))}
              className="w-full h-1.5 dark:bg-slate-800 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <p className="text-[11px] dark:text-slate-500 text-slate-400 mt-1">
              Strictly capped at 25 members to maintain quiet, thoughtful conversation without overwhelming notifications.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create Circle</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { convex, api as convexApi } from '../convex.js';
import { useAuth } from '../hooks/useAuth.js';
import { BarChart3, CheckCircle2, Lock } from 'lucide-react';

interface PollCardProps {
  pollId: string;
  isMe?: boolean;
}

export const PollCard: React.FC<PollCardProps> = ({ pollId, isMe = false }) => {
  const { user: currentUser } = useAuth();
  const [poll, setPoll] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!pollId) return;

    let unsub: (() => void) | null = null;
    try {
      const watch = (convex as any).watchQuery(convexApi.polls.getPoll, {
        pollId: pollId as any,
        currentUserId: currentUser?.id as any,
      });

      unsub = watch.onUpdate(() => {
        const res = watch.localQueryResult();
        if (res) {
          setPoll(res);
        }
      });
    } catch (err) {
      console.warn('Poll watch query error:', err);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [pollId, currentUser?.id]);

  const handleVote = async (optionIndex: number) => {
    if (!currentUser?.id || isSubmitting || poll?.isClosed) return;
    setIsSubmitting(true);
    try {
      await (convex as any).mutation(convexApi.polls.votePoll, {
        pollId: pollId as any,
        userId: currentUser.id as any,
        optionIndex,
      });
    } catch (err) {
      console.error('Failed to vote on poll:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!poll) {
    return (
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 animate-pulse text-xs text-slate-400">
        Loading poll...
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-2xl border max-w-sm sm:max-w-md w-full shadow-lg ${
        isMe
          ? 'bg-blue-950/40 border-blue-500/30 text-white'
          : 'bg-slate-900/90 border-white/10 text-slate-100'
      }`}
    >
      {/* Poll Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-semibold text-white leading-snug">
            {poll.question}
          </h4>
        </div>
        {poll.isClosed && (
          <span className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 shrink-0">
            <Lock className="w-3 h-3" />
            Closed
          </span>
        )}
      </div>

      {/* Options List */}
      <div className="space-y-2 mb-3">
        {poll.options.map((option: any, idx: number) => {
          const isSelected = poll.userVotedOptionIndex === idx;

          return (
            <button
              key={idx}
              type="button"
              disabled={isSubmitting || poll.isClosed}
              onClick={() => handleVote(idx)}
              className={`w-full relative overflow-hidden text-left p-2.5 rounded-xl border transition-all text-xs flex items-center justify-between gap-3 ${
                isSelected
                  ? 'border-blue-500 bg-blue-600/20 text-white shadow-sm'
                  : 'border-white/10 hover:border-white/20 bg-slate-950/40 hover:bg-slate-950/60 text-slate-300'
              }`}
            >
              {/* Animated Progress Bar fill */}
              <div
                className={`absolute top-0 bottom-0 left-0 transition-all duration-300 pointer-events-none ${
                  isSelected ? 'bg-blue-500/25' : 'bg-slate-700/20'
                }`}
                style={{ width: `${option.percent}%` }}
              />

              <div className="relative z-10 flex items-center gap-2 min-w-0">
                {isSelected && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                )}
                <span className="font-medium truncate">{option.text}</span>
              </div>

              <div className="relative z-10 text-[11px] font-mono tabular-numbers text-slate-400 shrink-0">
                {option.percent}% ({option.votes})
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer: Total votes */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5">
        <span>{poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}</span>
        {poll.hasVoted && (
          <span className="text-emerald-400 font-medium">Your vote is counted</span>
        )}
      </div>
    </div>
  );
};

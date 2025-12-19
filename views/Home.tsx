
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const [code, setCode] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const navigate = useNavigate();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6) {
      navigate(`/view/${code.toUpperCase()}`);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-12 space-y-10 overflow-y-auto">
      {/* Header */}
      <div className="text-center">
        <div className="inline-block p-3 bg-indigo-500/20 rounded-2xl mb-4">
          <svg className="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-4xl font-black text-white mb-2 tracking-tight">LiveStream</h1>
        <p className="text-slate-400 font-medium">Private & Low-Latency</p>
      </div>

      {!showJoin ? (
        <div className="w-full max-w-sm space-y-4">
          {/* Broadcaster Option */}
          <button
            onClick={() => navigate('/broadcast')}
            className="w-full text-left p-6 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-3xl transition-all active:scale-95 group"
          >
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-emerald-500/20 rounded-2xl group-hover:bg-emerald-500/30 transition-colors">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Start Broadcast</h3>
                <p className="text-slate-400 text-sm">Use Galaxy phone for filming</p>
              </div>
            </div>
          </button>

          {/* Viewer Option */}
          <button
            onClick={() => setShowJoin(true)}
            className="w-full text-left p-6 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-3xl transition-all active:scale-95 group"
          >
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-indigo-500/20 rounded-2xl group-hover:bg-indigo-500/30 transition-colors">
                <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Join Stream</h3>
                <p className="text-slate-400 text-sm">Watch on Classroom PC</p>
              </div>
            </div>
          </button>
        </div>
      ) : (
        <div className="w-full max-w-sm p-6 bg-slate-800 rounded-3xl border border-slate-700 animate-in fade-in zoom-in duration-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Enter Room Code</h2>
            <button onClick={() => setShowJoin(false)} className="text-slate-400 p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleJoin} className="space-y-4">
            <input
              autoFocus
              type="text"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-5 text-4xl tracking-[0.4em] text-center bg-slate-900 border border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-mono text-indigo-400"
            />
            <button
              type="submit"
              disabled={code.length !== 6}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-2xl font-bold text-xl transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
            >
              Start Watching
            </button>
          </form>
        </div>
      )}

      {/* Guide Section */}
      <div className="w-full max-w-sm bg-slate-800/50 rounded-3xl p-6 border border-slate-700/50">
        <h4 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          How to Use
        </h4>
        <ul className="space-y-3 text-sm text-slate-400">
          <li className="flex items-start">
            <span className="bg-indigo-500/20 text-indigo-400 w-5 h-5 rounded-full text-xs flex items-center justify-center mr-3 mt-0.5 shrink-0">1</span>
            <span>Broadcaster generates a 6-digit code.</span>
          </li>
          <li className="flex items-start">
            <span className="bg-indigo-500/20 text-indigo-400 w-5 h-5 rounded-full text-xs flex items-center justify-center mr-3 mt-0.5 shrink-0">2</span>
            <span>Viewer enters the code on their device.</span>
          </li>
          <li className="flex items-start">
            <span className="bg-indigo-500/20 text-indigo-400 w-5 h-5 rounded-full text-xs flex items-center justify-center mr-3 mt-0.5 shrink-0">3</span>
            <span>Enjoy private, low-latency live video.</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Home;


import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dbRefs } from '../services/firebase';
import { set, onChildAdded, remove, update } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const Broadcaster: React.FC = () => {
  const [roomCode, setRoomCode] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [status, setStatus] = useState('Setting up camera...');
  const [viewerCount, setViewerCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const navigate = useNavigate();
  const wakeLockRef = useRef<any>(null);

  // Generate 6-digit code
  useEffect(() => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
  }, []);

  // Request Wake Lock
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.error('Wake Lock failed', err);
      }
    };
    requestWakeLock();
    return () => {
      if (wakeLockRef.current) wakeLockRef.current.release();
    };
  }, []);

  // Start Camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setStatus('Ready');
      } catch (err) {
        console.error(err);
        setStatus('Camera Error');
      }
    };
    startCamera();
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Signaling Setup (Only when LIVE)
  useEffect(() => {
    if (!isLive || !roomCode || !stream) return;

    const roomRef = dbRefs.room(roomCode);
    const signalsRef = dbRefs.signals(roomCode);

    set(roomRef, {
      broadcasterId: 'broadcaster-' + Date.now(),
      createdAt: Date.now()
    });

    const unsubscribe = onChildAdded(signalsRef, async (snapshot) => {
      const viewerId = snapshot.key;
      if (!viewerId) return;
      const data = snapshot.val();

      if (data.type === 'offer') {
        createPeerConnection(viewerId, data.sdp);
      } else if (data.type === 'candidate' && peersRef.current[viewerId]) {
        try {
          await peersRef.current[viewerId].addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error("Error adding ice candidate", e);
        }
      }
    });

    return () => {
      unsubscribe();
      remove(roomRef);
      (Object.values(peersRef.current) as RTCPeerConnection[]).forEach(p => p.close());
    };
  }, [isLive, roomCode, stream]);

  const createPeerConnection = async (viewerId: string, remoteSdp: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peersRef.current[viewerId] = pc;
    setViewerCount(Object.keys(peersRef.current).length);

    stream?.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        update(dbRefs.viewerSignal(roomCode, viewerId + '_b'), {
          type: 'candidate',
          candidate: event.candidate.toJSON()
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        delete peersRef.current[viewerId];
        setViewerCount(Object.keys(peersRef.current).length);
      }
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: remoteSdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      update(dbRefs.viewerSignal(roomCode, viewerId + '_b'), {
        type: 'answer',
        sdp: answer.sdp
      });
    } catch (err) {
      console.error("Peer connection failed", err);
    }
  };

  const handleStart = () => setIsLive(true);
  
  const handleStop = () => {
    if (confirm('End broadcast and return to home?')) {
      stream?.getTracks().forEach(t => t.stop());
      navigate('/');
    }
  };

  return (
    <div className="relative h-screen bg-black flex flex-col overflow-hidden">
      {/* Video Preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay UI */}
      <div className="relative z-10 flex flex-col justify-between h-full p-6 bg-gradient-to-b from-black/70 via-transparent to-black/70">
        
        {/* Header */}
        <div className="flex justify-between items-start">
          {isLive ? (
            <div className="bg-black/40 backdrop-blur-xl p-4 rounded-3xl border border-white/10 shadow-2xl animate-in slide-in-from-top duration-300">
              <p className="text-[10px] text-indigo-400 uppercase font-black tracking-[0.2em] mb-1">Room Code</p>
              <p className="text-4xl font-mono font-black text-white tracking-widest leading-none">{roomCode}</p>
            </div>
          ) : (
            <button 
              onClick={() => navigate('/')} 
              className="bg-black/40 backdrop-blur-xl p-3 rounded-full border border-white/10 text-white transition-all active:scale-90"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <div className="flex flex-col items-end space-y-2">
            {isLive && (
              <div className="bg-red-600 px-4 py-1.5 rounded-full text-xs font-black animate-pulse flex items-center space-x-2 shadow-lg shadow-red-600/30">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="tracking-widest">LIVE</span>
              </div>
            )}
            <div className="bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl text-xs font-bold border border-white/5 flex items-center space-x-2">
              <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>{viewerCount} Viewers</span>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col space-y-4 max-w-sm mx-auto w-full">
          {!isLive ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-500">
              <div className="text-center">
                <h2 className="text-2xl font-black text-white mb-1">Ready to start?</h2>
                <p className="text-slate-300 text-sm">Make sure you have a stable connection.</p>
              </div>
              <button
                onClick={handleStart}
                className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 rounded-3xl font-black text-2xl shadow-2xl shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center space-x-3"
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>START BROADCAST</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleStop}
              className="w-full py-5 bg-red-600/80 hover:bg-red-700 backdrop-blur-md border border-red-500/50 rounded-3xl font-bold text-lg shadow-xl transition-all active:scale-95 text-white/90"
            >
              End Broadcast
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Broadcaster;

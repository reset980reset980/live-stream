
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dbRefs } from '../services/firebase';
import { onValue, set, update, onChildAdded, remove } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const Viewer: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [status, setStatus] = useState('Locating stream...');
  const [isConnected, setIsConnected] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const viewerId = useRef('viewer-' + Math.random().toString(36).substring(7)).current;
  const navigate = useNavigate();

  useEffect(() => {
    if (!roomCode) return;

    const startConnection = async () => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;

      pc.ontrack = (event) => {
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
          setIsConnected(true);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          update(dbRefs.viewerSignal(roomCode, viewerId), {
            type: 'candidate',
            candidate: event.candidate.toJSON()
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setStatus('Connection Lost. Retrying...');
          setTimeout(() => window.location.reload(), 3000);
        }
      };

      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);

        await set(dbRefs.viewerSignal(roomCode, viewerId), {
          type: 'offer',
          sdp: offer.sdp
        });

        setStatus('Connecting to broadcaster...');
      } catch (err) {
        console.error(err);
        setStatus('WebRTC Error');
      }
    };

    onValue(dbRefs.room(roomCode), (snapshot) => {
      if (!snapshot.exists()) {
        setStatus('Room not found');
        setTimeout(() => navigate('/'), 2000);
      } else {
        startConnection();
      }
    }, { onlyOnce: true });

    const signalsRef = dbRefs.signals(roomCode);
    const unsubscribe = onChildAdded(signalsRef, async (snapshot) => {
      if (snapshot.key === viewerId + '_b') {
        const data = snapshot.val();
        if (data.type === 'answer') {
          await pcRef.current?.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
        } else if (data.type === 'candidate') {
          await pcRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      }
    });

    return () => {
      unsubscribe();
      pcRef.current?.close();
      remove(dbRefs.viewerSignal(roomCode, viewerId));
      remove(dbRefs.viewerSignal(roomCode, viewerId + '_b'));
    };
  }, [roomCode, navigate]);

  return (
    <div className="relative h-screen bg-black flex flex-col overflow-hidden">
      {/* Video Layer */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls={isConnected}
        className="absolute inset-0 w-full h-full object-contain"
      />

      {/* Connection UI Overlay */}
      {!isConnected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20 px-6">
          <div className="relative mb-8">
            <div className="w-20 h-20 border-4 border-indigo-500/20 rounded-full"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-black text-white mb-2">{status}</h2>
          <p className="text-slate-400 text-center text-sm max-w-[250px]">Establishing a peer-to-peer connection for private viewing.</p>
          <button 
            onClick={() => navigate('/')}
            className="mt-12 px-8 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-300 font-bold transition-all active:scale-95 border border-slate-700"
          >
            Cancel & Back
          </button>
        </div>
      )}

      {/* Navigation Header (Overlay when connected) */}
      {isConnected && (
        <div className="relative z-10 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
          <button 
            onClick={() => navigate('/')} 
            className="bg-black/40 backdrop-blur-xl p-3 rounded-full border border-white/10 text-white transition-all active:scale-90"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="flex items-center space-x-3 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-full border border-white/5">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Live Stream</span>
          </div>

          <div className="w-12 h-12"></div> {/* Spacer for symmetry */}
        </div>
      )}
      
      {/* Bottom Info Bar (Overlay when connected) */}
      {isConnected && (
        <div className="absolute bottom-8 left-8 right-8 z-10 animate-in slide-in-from-bottom duration-500">
          <div className="bg-black/40 backdrop-blur-2xl p-5 rounded-3xl border border-white/10 shadow-2xl flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Connected to Room</p>
              <p className="text-2xl font-mono font-black text-indigo-400 tracking-wider leading-none">{roomCode}</p>
            </div>
            <div className="flex space-x-2">
               <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                  <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Viewer;

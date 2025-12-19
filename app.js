import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, push, remove, update, onChildAdded, get, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDhf_58nNbyQAk7nUxOCw5ChACJTRkCO0U",
    authDomain: "brocasting-2c5e3.firebaseapp.com",
    databaseURL: "https://brocasting-2c5e3-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "brocasting-2c5e3",
    storageBucket: "brocasting-2c5e3.firebasestorage.app",
    messagingSenderId: "408457629166",
    appId: "1:408457629166:web:729e044ba273a66d3f52ff"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
];

// --- Broadcaster Logic ---
export async function initBroadcaster() {
    let localStream = null;
    let roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    let peers = {}; // viewerId -> SimplePeer
    let currentFacingMode = 'environment';
    let wakeLock = null;

    const preview = document.getElementById('preview');
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const btnFlip = document.getElementById('btn-flip');
    const roomCodeDisplay = document.getElementById('room-code-display');
    const viewerCountDisplay = document.getElementById('viewer-count');

    // Camera Init
    async function startMedia(facingMode) {
        try {
            if (localStream) {
                localStream.getTracks().forEach(t => t.stop());
            }
            localStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: facingMode, 
                    width: { ideal: 1280 }, 
                    height: { ideal: 720 },
                    frameRate: { max: 24 } 
                },
                audio: true
            });
            preview.srcObject = localStream;
            document.getElementById('setup-message').classList.add('hidden');
            btnStart.classList.remove('hidden');
        } catch (err) {
            console.error(err);
            alert("카메라 접근에 실패했습니다. 설정을 확인해주세요.");
        }
    }

    await startMedia(currentFacingMode);

    btnFlip.onclick = () => {
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        startMedia(currentFacingMode);
    };

    btnStart.onclick = async () => {
        btnStart.classList.add('hidden');
        btnStop.classList.remove('hidden');
        document.getElementById('room-info').classList.remove('hidden');
        document.getElementById('live-indicator').classList.remove('hidden');
        document.getElementById('stats').classList.remove('hidden');
        roomCodeDisplay.innerText = roomCode;

        // Start WakeLock
        if ('wakeLock' in navigator) {
            try { 
                wakeLock = await navigator.wakeLock.request('screen'); 
            } catch(e) {
                console.warn('WakeLock failed', e);
            }
        }

        // Firebase Room Setup
        const roomRef = ref(db, `rooms/${roomCode}`);
        set(roomRef, { broadcaster: 'active', createdAt: serverTimestamp() });
        // onDisconnect is only available on DatabaseReference in compat or via different modular approach
        // but simple cleanup is handled on refresh/close.

        // Listen for Viewers
        const signalsRef = ref(db, `rooms/${roomCode}/signals`);
        onChildAdded(signalsRef, (snapshot) => {
            const viewerId = snapshot.key;
            if (!viewerId || viewerId.endsWith('_ans')) return; 

            const data = snapshot.val();
            if (data.type === 'offer') {
                handleOffer(viewerId, data.sdp);
            } else if (data.type === 'candidate' && peers[viewerId]) {
                peers[viewerId].signal(data);
            }
        });

        function handleOffer(viewerId, sdp) {
            const p = new SimplePeer({
                initiator: false,
                stream: localStream,
                trickle: true,
                config: { iceServers: ICE_SERVERS }
            });

            p.on('signal', signal => {
                if (signal.type === 'answer') {
                    set(ref(db, `rooms/${roomCode}/signals/${viewerId}_ans`), signal);
                } else if (signal.candidate) {
                    push(ref(db, `rooms/${roomCode}/signals/${viewerId}_ans_cand`), signal);
                }
            });

            p.on('connect', () => {
                peers[viewerId] = p;
                updateViewerCount();
            });

            p.on('close', () => {
                delete peers[viewerId];
                updateViewerCount();
            });

            p.on('error', (err) => {
                console.error('Peer error', err);
                delete peers[viewerId];
                updateViewerCount();
            });

            p.signal({ type: 'offer', sdp: sdp });
            
            // Handle candidates from viewer
            onChildAdded(ref(db, `rooms/${roomCode}/signals/${viewerId}`), s => {
                const val = s.val();
                if (val && val.candidate) p.signal(val);
            });
        }
    };

    function updateViewerCount() {
        const count = Object.keys(peers).length;
        if (viewerCountDisplay) {
            viewerCountDisplay.innerText = `${count}명 시청 중`;
        }
    }

    btnStop.onclick = () => {
        if (confirm("정말로 방송을 종료하시겠습니까?")) {
            window.location.href = "index.html";
        }
    };
}

// --- Viewer Logic ---
export async function initViewer() {
    let peer = null;
    const viewerId = 'v_' + Math.random().toString(36).substring(7);
    
    const joinScreen = document.getElementById('join-screen');
    const videoContainer = document.getElementById('video-container');
    const inputCode = document.getElementById('input-code');
    const btnJoin = document.getElementById('btn-join');
    const remoteVideo = document.getElementById('remote-video');
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');
    const activeCodeDisplay = document.getElementById('active-code');

    btnJoin.onclick = async () => {
        const code = inputCode.value.trim().toUpperCase();
        if (code.length !== 6) return alert("6자리 코드를 입력해주세요.");

        // Check if room exists
        const snap = await get(ref(db, `rooms/${code}`));
        if (!snap.exists()) return alert("존재하지 않는 방입니다.");

        joinScreen.classList.add('hidden');
        videoContainer.classList.remove('hidden');
        activeCodeDisplay.innerText = code;
        
        startConnection(code);
    };

    function startConnection(code) {
        if (peer) peer.destroy();
        
        peer = new SimplePeer({
            initiator: true,
            trickle: true,
            config: { iceServers: ICE_SERVERS }
        });

        peer.on('signal', signal => {
            if (signal.type === 'offer') {
                set(ref(db, `rooms/${code}/signals/${viewerId}`), signal);
            } else if (signal.candidate) {
                push(ref(db, `rooms/${code}/signals/${viewerId}`), signal);
            }
        });

        // Listen for answer from broadcaster
        onValue(ref(db, `rooms/${code}/signals/${viewerId}_ans`), snap => {
            const val = snap.val();
            if (val && val.type === 'answer') peer.signal(val);
        });

        onChildAdded(ref(db, `rooms/${code}/signals/${viewerId}_ans_cand`), snap => {
            const val = snap.val();
            if (val && val.candidate) peer.signal(val);
        });

        peer.on('stream', stream => {
            remoteVideo.srcObject = stream;
            statusText.innerText = "연결됨 ✓";
            statusDot.classList.replace('bg-yellow-500', 'bg-emerald-500');
            statusDot.classList.remove('animate-pulse');
        });

        peer.on('close', () => reconnect(code));
        peer.on('error', () => reconnect(code));
    }

    function reconnect(code) {
        if (statusText) statusText.innerText = "재연결 중...";
        if (statusDot) {
            statusDot.classList.replace('bg-emerald-500', 'bg-yellow-500');
            statusDot.classList.add('animate-pulse');
        }
        setTimeout(() => startConnection(code), 3000);
    }
}
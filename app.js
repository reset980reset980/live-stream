import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, push, remove, update, onChildAdded, get, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Firebase 설정 - 사용자의 프로젝트 정보로 유지
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
    // STUN 서버
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // 무료 TURN 서버 (ExpressTurn)
    {
        urls: 'turn:relay1.expressturn.com:3478',
        username: 'efQKVE7I0KVUYLQN3X',
        credential: 'oFqXVZyJMvZsLsRV'
    },
    // 대체 TURN (OpenRelay)
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    }
];

// --- 방송자(Broadcaster) 로직 ---
export async function initBroadcaster() {
    let localStream = null;
    // 혼동되는 문자 제외 (0, O, I, l, 1)
    const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let roomCode = Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
    let peers = {}; // viewerId -> SimplePeer
    let currentFacingMode = 'environment';
    let wakeLock = null;

    const preview = document.getElementById('preview');
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const btnFlip = document.getElementById('btn-flip');
    const roomCodeDisplay = document.getElementById('room-code-display');
    const viewerCountDisplay = document.getElementById('viewer-count');

    // 카메라 시작 함수
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
            if (preview) preview.srcObject = localStream;
            document.getElementById('setup-message')?.classList.add('hidden');
            btnStart?.classList.remove('hidden');
        } catch (err) {
            console.error('Camera access error:', err);
            alert("⚠️ 카메라 접근에 실패했습니다.\n\n해결방법:\n1. 브라우저 설정에서 카메라 권한 허용\n2. HTTPS 환경인지 확인");
        }
    }

    await startMedia(currentFacingMode);

    if (btnFlip) {
        btnFlip.onclick = () => {
            currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
            startMedia(currentFacingMode);
        };
    }

    if (btnStart) {
        btnStart.onclick = async () => {
            btnStart.classList.add('hidden');
            btnStop?.classList.remove('hidden');
            document.getElementById('room-info')?.classList.remove('hidden');
            document.getElementById('live-indicator')?.classList.remove('hidden');
            document.getElementById('stats')?.classList.remove('hidden');
            if (roomCodeDisplay) roomCodeDisplay.innerText = roomCode;

            // 화면 꺼짐 방지 (Wake Lock)
            if ('wakeLock' in navigator) {
                try {
                    wakeLock = await navigator.wakeLock.request('screen');
                } catch (e) {
                    console.warn('WakeLock failed', e);
                }
            }

            // Firebase 방 생성 및 자동 삭제 설정
            const roomRef = ref(db, `rooms/${roomCode}`);
            set(roomRef, { broadcaster: 'active', createdAt: serverTimestamp() });
            onDisconnect(roomRef).remove();

            // 시청자 연결 신호 감지
            const signalsRef = ref(db, `rooms/${roomCode}/signals`);
            console.log('[Broadcaster] Listening for signals at:', `rooms/${roomCode}/signals`);

            onChildAdded(signalsRef, (snapshot) => {
                const viewerId = snapshot.key;
                const data = snapshot.val();

                console.log('[Broadcaster] Signal received - key:', viewerId, 'data:', JSON.stringify(data).substring(0, 100));

                // answer와 candidate 경로는 무시
                if (!viewerId || viewerId.endsWith('_ans') || viewerId.endsWith('_cand')) {
                    console.log('[Broadcaster] Ignoring signal (answer/candidate path)');
                    return;
                }

                if (data && data.type === 'offer' && data.sdp) {
                    console.log('[Broadcaster] ✅ Valid offer received from viewer:', viewerId);
                    handleOffer(viewerId, data);
                } else {
                    console.log('[Broadcaster] ⚠️ Invalid offer data:', data);
                }
            });

            function handleOffer(viewerId, offerData) {
                // CDN으로 로드된 SimplePeer 전역 객체 사용
                const Peer = window.SimplePeer;
                if (!Peer) {
                    console.error('[Broadcaster] SimplePeer is not loaded');
                    return;
                }

                console.log('[Broadcaster] Creating peer for viewer:', viewerId);
                const p = new Peer({
                    initiator: false,
                    stream: localStream,
                    trickle: true,
                    config: { iceServers: ICE_SERVERS }
                });

                p.on('signal', signal => {
                    if (signal.type === 'answer') {
                        console.log('[Broadcaster] Sending answer to viewer');
                        set(ref(db, `rooms/${roomCode}/signals/${viewerId}_ans`), signal);
                    } else if (signal.candidate) {
                        console.log('[Broadcaster] Sending ICE candidate');
                        push(ref(db, `rooms/${roomCode}/signals/${viewerId}_ans_cand`), signal);
                    }
                });

                p.on('connect', () => {
                    console.log('[Broadcaster] ✅ Viewer connected!');
                    peers[viewerId] = p;
                    updateViewerCount();
                });

                p.on('close', () => {
                    console.log('[Broadcaster] Viewer disconnected');
                    delete peers[viewerId];
                    updateViewerCount();
                });

                p.on('error', (err) => {
                    console.error('[Broadcaster] Peer error:', err);
                    delete peers[viewerId];
                    updateViewerCount();
                });

                // 완전한 offer 객체를 signal로 전달
                console.log('[Broadcaster] Processing offer');
                p.signal(offerData);

                // 시청자의 ICE candidates 처리
                onChildAdded(ref(db, `rooms/${roomCode}/signals/${viewerId}_cand`), s => {
                    const val = s.val();
                    if (val && val.candidate) {
                        console.log('[Broadcaster] Received viewer ICE candidate');
                        p.signal(val);
                    }
                });
            }
        };
    }

    function updateViewerCount() {
        const count = Object.keys(peers).length;
        if (viewerCountDisplay) {
            viewerCountDisplay.innerText = `${count}명 시청 중`;
        }
    }

    if (btnStop) {
        btnStop.onclick = () => {
            if (confirm("🔴 방송을 종료하시겠습니까?")) {
                if (wakeLock) wakeLock.release();
                window.location.href = "index.html";
            }
        };
    }
}

// --- 시청자(Viewer) 로직 ---
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

    if (btnJoin) {
        btnJoin.onclick = async () => {
            const code = inputCode.value.trim().toUpperCase();
            if (code.length !== 6) return alert("6자리 코드를 입력해주세요.");

            try {
                const snap = await get(ref(db, `rooms/${code}`));
                if (!snap.exists()) return alert("⚠️ 존재하지 않는 방 코드입니다.\n코드를 다시 확인해주세요.");

                joinScreen?.classList.add('hidden');
                videoContainer?.classList.remove('hidden');
                if (activeCodeDisplay) activeCodeDisplay.innerText = code;

                startConnection(code);
            } catch (err) {
                console.error('Firebase join error:', err);
                alert("연결 중 오류가 발생했습니다.");
            }
        };
    }

    function startConnection(code) {
        if (peer) peer.destroy();

        const Peer = window.SimplePeer;
        if (!Peer) {
            console.error('[Viewer] SimplePeer not loaded!');
            return;
        }

        console.log('[Viewer] Starting connection to room:', code, 'viewerId:', viewerId);

        // answer 중복 처리 방지 플래그
        let answerReceived = false;

        peer = new Peer({
            initiator: true,
            trickle: true,
            config: { iceServers: ICE_SERVERS }
        });

        peer.on('signal', signal => {
            if (signal.type === 'offer') {
                console.log('[Viewer] Sending offer to broadcaster');
                set(ref(db, `rooms/${code}/signals/${viewerId}`), signal);
            } else if (signal.candidate) {
                console.log('[Viewer] Sending ICE candidate');
                push(ref(db, `rooms/${code}/signals/${viewerId}_cand`), signal);
            }
        });

        // 방송자의 Answer 수신 (한 번만 처리)
        const answerRef = ref(db, `rooms/${code}/signals/${viewerId}_ans`);
        const unsubscribeAnswer = onValue(answerRef, snap => {
            const val = snap.val();
            if (val && val.type === 'answer' && !answerReceived) {
                answerReceived = true;
                console.log('[Viewer] Received answer from broadcaster');
                try {
                    peer.signal(val);
                } catch (e) {
                    console.warn('[Viewer] Error processing answer:', e.message);
                }
            }
        });

        // 방송자의 Candidates 수신
        onChildAdded(ref(db, `rooms/${code}/signals/${viewerId}_ans_cand`), snap => {
            const val = snap.val();
            if (val && val.candidate) {
                console.log('[Viewer] Received broadcaster ICE candidate');
                try {
                    peer.signal(val);
                } catch (e) {
                    console.warn('[Viewer] Error processing ICE candidate:', e.message);
                }
            }
        });

        peer.on('stream', stream => {
            console.log('[Viewer] ✅ Stream received!');
            if (remoteVideo) remoteVideo.srcObject = stream;
            if (statusText) statusText.innerText = "연결됨 ✓";
            if (statusDot) {
                statusDot.classList.replace('bg-yellow-500', 'bg-emerald-500');
                statusDot.classList.remove('animate-pulse');
            }
        });

        peer.on('connect', () => {
            console.log('[Viewer] ✅ Peer connected!');
        });

        peer.on('close', () => {
            console.log('[Viewer] Connection closed');
            reconnect(code);
        });

        peer.on('error', (err) => {
            console.error('[Viewer] Peer error:', err);
            reconnect(code);
        });
    }

    function reconnect(code) {
        if (statusText) statusText.innerText = "재연결 중...";
        if (statusDot) {
            statusDot.classList.replace('bg-emerald-500', 'bg-yellow-500');
            statusDot.classList.add('animate-pulse');
        }
        setTimeout(() => {
            if (document.visibilityState === 'visible') startConnection(code);
        }, 3000);
    }
}
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, get, serverTimestamp, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { Peer } from 'peerjs';

// Firebase 설정
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

// PeerJS ICE 서버 설정 (Metered TURN)
const PEER_CONFIG = {
    config: {
        iceServers: [
            { urls: "stun:stun.relay.metered.ca:80" },
            {
                urls: "turn:global.relay.metered.ca:80",
                username: "a4cb74d3f0c3048c8b567be0",
                credential: "OOX5V5soJNeowzGU",
            },
            {
                urls: "turn:global.relay.metered.ca:80?transport=tcp",
                username: "a4cb74d3f0c3048c8b567be0",
                credential: "OOX5V5soJNeowzGU",
            },
            {
                urls: "turn:global.relay.metered.ca:443",
                username: "a4cb74d3f0c3048c8b567be0",
                credential: "OOX5V5soJNeowzGU",
            },
            {
                urls: "turns:global.relay.metered.ca:443?transport=tcp",
                username: "a4cb74d3f0c3048c8b567be0",
                credential: "OOX5V5soJNeowzGU",
            },
        ]
    }
};

// --- 방송자(Broadcaster) 로직 ---
export async function initBroadcaster() {
    let localStream = null;
    // 혼동되는 문자 제외 (0, O, I, l, 1)
    const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let roomCode = Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
    let peer = null;
    let calls = {};
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

            // 화면 꺼짐 방지
            if ('wakeLock' in navigator) {
                try {
                    wakeLock = await navigator.wakeLock.request('screen');
                } catch (e) {
                    console.warn('WakeLock failed', e);
                }
            }

            // PeerJS 초기화 - 방송자 ID로 roomCode 사용
            peer = new Peer('broadcaster_' + roomCode, PEER_CONFIG);

            peer.on('open', (id) => {
                console.log('[Broadcaster] PeerJS connected with ID:', id);

                // Firebase에 방 등록
                const roomRef = ref(db, `rooms/${roomCode}`);
                set(roomRef, {
                    broadcaster: 'active',
                    peerId: id,
                    createdAt: serverTimestamp()
                });
                onDisconnect(roomRef).remove();
            });

            // 시청자가 데이터 연결로 접속하면, 방송자가 call을 시작
            peer.on('connection', (conn) => {
                console.log('[Broadcaster] Viewer connected:', conn.peer);

                conn.on('open', () => {
                    console.log('[Broadcaster] Data connection opened, calling viewer with stream');

                    // 방송자가 시청자에게 call을 시작 (스트림 전송)
                    const call = peer.call(conn.peer, localStream);

                    if (call) {
                        calls[conn.peer] = call;
                        updateViewerCount();

                        call.on('close', () => {
                            console.log('[Broadcaster] Call closed:', conn.peer);
                            delete calls[conn.peer];
                            updateViewerCount();
                        });

                        call.on('error', (err) => {
                            console.error('[Broadcaster] Call error:', err);
                            delete calls[conn.peer];
                            updateViewerCount();
                        });
                    }
                });

                conn.on('close', () => {
                    console.log('[Broadcaster] Data connection closed:', conn.peer);
                    if (calls[conn.peer]) {
                        calls[conn.peer].close();
                        delete calls[conn.peer];
                        updateViewerCount();
                    }
                });
            });

            peer.on('error', (err) => {
                console.error('[Broadcaster] PeerJS error:', err);
            });
        };
    }

    function updateViewerCount() {
        const count = Object.keys(calls).length;
        if (viewerCountDisplay) {
            viewerCountDisplay.innerText = `${count}명 시청 중`;
        }
    }

    if (btnStop) {
        btnStop.onclick = () => {
            if (confirm("🔴 방송을 종료하시겠습니까?")) {
                if (wakeLock) wakeLock.release();
                if (peer) peer.destroy();
                remove(ref(db, `rooms/${roomCode}`));
                window.location.href = "index.html";
            }
        };
    }
}

// --- 시청자(Viewer) 로직 ---
export async function initViewer() {
    let peer = null;
    let dataConn = null;

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
                // Firebase에서 방 정보 확인
                const snap = await get(ref(db, `rooms/${code}`));
                if (!snap.exists()) return alert("⚠️ 존재하지 않는 방 코드입니다.\n코드를 다시 확인해주세요.");

                const roomData = snap.val();
                const broadcasterPeerId = roomData.peerId;

                if (!broadcasterPeerId) {
                    return alert("⚠️ 방송자가 연결되지 않았습니다. 잠시 후 다시 시도해주세요.");
                }

                joinScreen?.classList.add('hidden');
                videoContainer?.classList.remove('hidden');
                if (activeCodeDisplay) activeCodeDisplay.innerText = code;

                connectToStream(broadcasterPeerId, code);
            } catch (err) {
                console.error('Firebase join error:', err);
                alert("연결 중 오류가 발생했습니다.");
            }
        };
    }

    function connectToStream(broadcasterPeerId, code) {
        // 기존 연결 정리
        if (dataConn) dataConn.close();
        if (peer) peer.destroy();

        console.log('[Viewer] Connecting to broadcaster:', broadcasterPeerId);

        peer = new Peer(PEER_CONFIG);

        peer.on('open', (id) => {
            console.log('[Viewer] PeerJS connected with ID:', id);

            // 방송자에게 데이터 연결 요청 (call 대신)
            dataConn = peer.connect(broadcasterPeerId);

            dataConn.on('open', () => {
                console.log('[Viewer] Data connection opened, waiting for stream...');
                if (statusText) statusText.innerText = "스트림 대기 중...";
            });

            dataConn.on('error', (err) => {
                console.error('[Viewer] Data connection error:', err);
                reconnect(broadcasterPeerId, code);
            });

            dataConn.on('close', () => {
                console.log('[Viewer] Data connection closed');
                reconnect(broadcasterPeerId, code);
            });
        });

        // 방송자가 call을 시작하면 받기
        peer.on('call', (call) => {
            console.log('[Viewer] Incoming call from broadcaster');

            // 스트림 없이 answer (수신만)
            call.answer();

            call.on('stream', (stream) => {
                console.log('[Viewer] ✅ Stream received!');
                if (remoteVideo) {
                    remoteVideo.srcObject = stream;
                    remoteVideo.play().catch(e => console.warn('Autoplay blocked:', e));
                }
                if (statusText) statusText.innerText = "연결됨 ✓";
                if (statusDot) {
                    statusDot.classList.remove('bg-yellow-500', 'animate-pulse');
                    statusDot.classList.add('bg-emerald-500');
                }
            });

            call.on('close', () => {
                console.log('[Viewer] Call closed');
                reconnect(broadcasterPeerId, code);
            });

            call.on('error', (err) => {
                console.error('[Viewer] Call error:', err);
                reconnect(broadcasterPeerId, code);
            });
        });

        peer.on('error', (err) => {
            console.error('[Viewer] PeerJS error:', err);
            if (statusText) statusText.innerText = "연결 오류";
            setTimeout(() => reconnect(broadcasterPeerId, code), 3000);
        });
    }

    function reconnect(broadcasterPeerId, code) {
        if (statusText) statusText.innerText = "재연결 중...";
        if (statusDot) {
            statusDot.classList.remove('bg-emerald-500');
            statusDot.classList.add('bg-yellow-500', 'animate-pulse');
        }
        setTimeout(() => {
            if (document.visibilityState === 'visible') {
                connectToStream(broadcasterPeerId, code);
            }
        }, 3000);
    }
}
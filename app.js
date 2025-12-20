import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, get, serverTimestamp, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const Peer = window.Peer;

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
    },
    // 비디오 품질 향상을 위한 SDP 변환
    sdpTransform: (sdp) => {
        let modifiedSdp = sdp;

        // 1. 비트레이트를 5Mbps로 상향 (HD 품질)
        modifiedSdp = modifiedSdp.replace(/b=AS:\d+/g, 'b=AS:5000');

        // 2. video 라인에 비트레이트 추가
        if (modifiedSdp.indexOf('b=AS:') === -1) {
            modifiedSdp = modifiedSdp.replace(/m=video(.*)\r\n/g, (match) => {
                return match + 'b=AS:5000\r\n';
            });
        }

        // 3. TIAS (Transport Independent Application Specific) 비트레이트도 설정
        modifiedSdp = modifiedSdp.replace(/b=TIAS:\d+/g, 'b=TIAS:5000000');

        // 4. degradationPreference 제거 (해상도 유지 우선)
        modifiedSdp = modifiedSdp.replace(/a=degradation-preference:\w+\r\n/g, '');

        console.log('[SDP] Modified for high quality');
        return modifiedSdp;
    }
};

// --- 방송자(Broadcaster) 로직 ---
export async function initBroadcaster() {
    let localStream = null;
    // 혼동되는 문자 제외 (0, O, I, l, 1)
    const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    // 새 코드 생성 함수
    function generateNewCode() {
        const code = Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
        sessionStorage.setItem('currentRoomCode', code);
        return code;
    }

    // 현재 세션의 코드 사용 (없으면 새로 생성)
    let roomCode = sessionStorage.getItem('currentRoomCode');
    if (!roomCode) {
        roomCode = generateNewCode();
    }

    // "새 방송" 버튼 기능 (전역 함수로 노출)
    window.startNewBroadcast = function () {
        roomCode = generateNewCode();
        if (document.getElementById('room-code-display')) {
            document.getElementById('room-code-display').innerText = roomCode;
        }
        console.log('[Broadcaster] New room code generated:', roomCode);
        return roomCode;
    };

    let peer = null;
    let calls = {};
    let currentFacingMode = 'environment';
    let wakeLock = null;

    const preview = document.getElementById('preview');
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const btnFlip = document.getElementById('btn-flip');
    const btnNewBroadcast = document.getElementById('btn-new-broadcast');
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
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            if (preview) preview.srcObject = localStream;
            document.getElementById('setup-message')?.classList.add('hidden');
            btnStart?.classList.remove('hidden');
            btnNewBroadcast?.classList.remove('hidden');

            // 화질 정보 표시
            const videoTrack = localStream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            console.log('Video settings:', settings);
            window.currentVideoSettings = settings;

            // 줌 기능 초기화
            if (window.initZoom) {
                window.initZoom(videoTrack);
            }
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

    // "새 코드로 방송 시작" 버튼
    if (btnNewBroadcast) {
        btnNewBroadcast.onclick = () => {
            if (confirm("🔄 새 코드로 방송을 시작하시겠습니까?\n기존 코드는 더 이상 사용할 수 없습니다.")) {
                roomCode = generateNewCode();
                alert(`새 방송 코드: ${roomCode}`);
            }
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

                // UI 자동 숨김 활성화
                if (window.startUIAutoHide) {
                    window.startUIAutoHide();
                }

                // 화질 정보 업데이트
                if (localStream && window.currentVideoSettings) {
                    const s = window.currentVideoSettings;
                    const qualityInfo = document.getElementById('quality-info');
                    if (qualityInfo) {
                        qualityInfo.textContent = `${s.width}x${s.height} @ ${s.frameRate}fps`;
                    }
                }
            });

            // 시청자가 데이터 연결로 접속하면, 방송자가 call을 시작
            peer.on('connection', (conn) => {
                console.log('[Broadcaster] Viewer connected:', conn.peer);

                conn.on('open', () => {
                    console.log('[Broadcaster] Data connection opened, calling viewer with stream');

                    // 방송자가 시청자에게 call을 시작 (스트림 전송) - 고화질 옵션
                    const callOptions = {
                        sdpTransform: PEER_CONFIG.sdpTransform
                    };
                    const call = peer.call(conn.peer, localStream, callOptions);

                    if (call) {
                        calls[conn.peer] = call;
                        updateViewerCount();

                        // 연결 후 비트레이트 직접 설정 (핵심!)
                        setTimeout(async () => {
                            try {
                                const pc = call.peerConnection;
                                if (pc) {
                                    const senders = pc.getSenders();
                                    for (const sender of senders) {
                                        if (sender.track && sender.track.kind === 'video') {
                                            const params = sender.getParameters();
                                            if (!params.encodings) {
                                                params.encodings = [{}];
                                            }
                                            // 비트레이트 설정: 최소 1Mbps, 최대 8Mbps
                                            params.encodings[0].maxBitrate = 8000000; // 8 Mbps
                                            params.encodings[0].minBitrate = 1000000; // 1 Mbps
                                            // 해상도 유지 우선 (프레임 낮춰도 OK)
                                            params.degradationPreference = 'maintain-resolution';
                                            await sender.setParameters(params);
                                            console.log('[Broadcaster] ✅ High bitrate set: 1-8 Mbps, maintain-resolution');
                                        }
                                    }
                                }
                            } catch (err) {
                                console.warn('[Broadcaster] Could not set bitrate:', err);
                            }
                        }, 2000); // 연결 안정화 후 2초 뒤 설정

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
                // 세션에서 코드 삭제 (다음 방송 시 새 코드 생성)
                sessionStorage.removeItem('currentRoomCode');
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

            // 재시도 로직 추가
            let retries = 0;
            const maxRetries = 5;

            async function tryConnect() {
                try {
                    // Firebase에서 방 정보 확인
                    const snap = await get(ref(db, `rooms/${code}`));

                    if (!snap.exists()) {
                        retries++;
                        if (retries <= maxRetries) {
                            if (statusText) statusText.innerText = `방송자 연결 대기 중... (${retries}/${maxRetries})`;
                            setTimeout(tryConnect, 3000);
                            return;
                        }
                        return alert("⚠️ 방송이 시작되지 않았거나 종료되었습니다.\n코드를 다시 확인해주세요.");
                    }

                    const roomData = snap.val();
                    const broadcasterPeerId = roomData.peerId;

                    if (!broadcasterPeerId) {
                        return alert("⚠️ 방송자가 연결되지 않았습니다. 잠시 후 다시 시도해주세요.");
                    }

                    if (activeCodeDisplay) activeCodeDisplay.innerText = code;
                    connectToStream(broadcasterPeerId, code);
                } catch (err) {
                    console.error('Firebase join error:', err);
                    alert("연결 중 오류가 발생했습니다.");
                }
            }

            // 첫 연결 시도 전에 UI 표시
            joinScreen?.classList.add('hidden');
            videoContainer?.classList.remove('hidden');

            tryConnect();
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

                // 수신 화질 정보 표시
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                    const settings = videoTrack.getSettings();
                    console.log('[Viewer] Video settings:', settings);
                    const qualityInfo = document.getElementById('viewer-quality-info');
                    if (qualityInfo) {
                        qualityInfo.textContent = `수신: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`;
                        qualityInfo.classList.remove('hidden');
                    }
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
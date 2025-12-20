# 🎓 졸업식 라이브 방송 시스템

갤럭시 스마트폰으로 졸업식 현장을 촬영하고, 교실 PC로 실시간 중계하는 WebRTC 기반 라이브 스트리밍 웹앱입니다.

## 📋 주요 기능

| 기능 | 설명 |
|-----|------|
| 📹 **실시간 방송** | WebRTC P2P 기반 저지연 스트리밍 |
| 🔢 **6자리 코드** | 간편한 방송 코드로 접속 |
| 🎤 **마이크 ON/OFF** | 방송 중 마이크 토글 |
| ⏺️ **녹화 기능** | 폰에 직접 녹화 저장 |
| 📋 **코드 복사** | 터치 시 클립보드 복사 |
| 🔒 **UI 잠금** | 자동 숨김 방지 |
| ☀️ **밝기 조절** | 시청자 화면 밝기 조절 |
| 🔄 **카메라 전환** | 전면/후면 카메라 전환 |
| 🔍 **줌 기능** | 디지털 줌 지원 |

## 🏗️ 기술 스택

- **Frontend**: Vanilla JS, Tailwind CSS
- **WebRTC**: PeerJS
- **Signaling**: Firebase Realtime Database
- **STUN/TURN**: 자체 coturn 서버

## 🌐 STUN/TURN 서버란?

### STUN (Session Traversal Utilities for NAT)
- 클라이언트의 공인 IP 주소를 알려주는 역할
- NAT 뒤에 있는 기기의 외부 주소 확인
- **무료**, 트래픽 발생 안 함

### TURN (Traversal Using Relays around NAT)
- 직접 P2P 연결이 불가능할 때 **중계 서버** 역할
- 모든 미디어 트래픽이 서버를 통과
- **대역폭 사용**, 유료 서버 또는 자체 구축 필요

```
일반 연결:   [폰] ←──── P2P ────→ [PC]
TURN 중계:  [폰] → [TURN 서버] → [PC]
```

### 현재 설정
```javascript
// Google STUN 서버 (무료)
{ urls: "stun:stun.l.google.com:19302" }

// 자체 TURN 서버 (coturn)
{ urls: "turn:116.41.203.98:3478", username: "livestream", credential: "..." }
```

## 🚀 배포 방법

### 1. Vercel 배포
```bash
# 방법 1: Vercel CLI
npm i -g vercel
vercel

# 방법 2: 드래그 앤 드롭
# vercel.com에서 폴더를 드래그 앤 드롭
```

### 2. Firebase 설정
1. Firebase Console에서 프로젝트 생성
2. Realtime Database 활성화
3. `app.js`의 `firebaseConfig` 수정

### 3. TURN 서버 설정 (선택)

자체 TURN 서버 구축 (Ubuntu):
```bash
# coturn 설치
sudo apt install coturn -y

# 자동 시작 활성화
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn

# 설정 파일
sudo tee /etc/turnserver.conf << EOF
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
user=livestream:graduation2024
realm=turn.yourdomain.com
external-ip=YOUR_PUBLIC_IP
log-file=/var/log/turnserver.log
EOF

# 방화벽 오픈
sudo ufw allow 3478
sudo ufw allow 5349

# 시작
sudo systemctl restart coturn
```

## 📹 사용 방법

### 방송자 (갤럭시 폰)
1. Chrome 브라우저로 배포 URL 접속
2. **"Start Broadcast"** 클릭
3. 카메라/마이크 권한 허용
4. 6자리 코드 확인 (코드 터치 시 복사)
5. **"방송 시작"** 클릭

### 시청자 (교실 PC)
1. 동일 URL 접속 → **"Join Stream"** 클릭
2. 6자리 코드 입력 → **"연결하기"** 클릭
3. 전체화면 버튼으로 크게 보기

### 방송 재개 (같은 코드로)
1. 방송 종료 후 다시 접속
2. 코드 입력 필드에 **기존 코드 입력**
3. **"방송 시작"** 클릭

## 🎛️ 컨트롤 버튼

### 방송자 화면
| 버튼 | 기능 |
|-----|------|
| ❌ | 방송 종료 |
| ← | 뒤로가기 |
| 🔄 | 카메라 전환 |
| ⛶ | 전체화면 |
| 🎤 | 마이크 ON/OFF |
| ⏺️ | 녹화 시작/중지 |
| 🔒 | UI 잠금 |

### 시청자 화면
| 버튼 | 기능 |
|-----|------|
| ⛶ | 전체화면 |
| ☀️ | 밝기 조절 |
| 🔄 | 새로고침 |

## ⚠️ 주의사항

- **HTTPS 필수**: 카메라 사용을 위해 HTTPS 환경 필요
- **네트워크**: 안정적인 WiFi 또는 5G 환경 권장
- **배터리**: 방송용 폰은 충전 상태로 사용
- **테스트**: 본 행사 30분 전 연결 리허설 필수

## 📊 예상 사용량

| 항목 | 예상치 |
|-----|-------|
| 분당 트래픽 | ~5-10MB |
| 1시간 방송 | ~300-600MB |
| 3시간 졸업식 | ~1-2GB |

## 🔐 관리자 단축키

| 단축키 | 기능 |
|-------|------|
| `Ctrl+Shift+A` | 활성 방송 목록 표시 |
| `Ctrl+Shift+D` | 모든 방송 데이터 삭제 |

## 📝 라이선스

MIT License
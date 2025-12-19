
export interface PeerSignal {
  type: 'offer' | 'answer' | 'candidate';
  data: any;
  from: string;
}

export interface RoomData {
  broadcasterId: string;
  createdAt: number;
  signals?: Record<string, any>;
  viewers?: Record<string, {
    id: string;
    lastSeen: number;
  }>;
}

export type ViewState = 'home' | 'broadcaster' | 'viewer';

export type ChannelStatus = 'idle' | 'joining' | 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';
export type ConnectionState = 'online' | 'reconnecting' | 'offline';
export type SyncSnapshot = { state: ConnectionState; lastEventAt: number | null };
export type OnlineSource = { isOnline(): boolean; subscribe(listener: (online: boolean) => void): () => void };
export type SyncStore = {
  getSnapshot(): SyncSnapshot;
  subscribe(listener: () => void): () => void;
  setChannelStatus(status: ChannelStatus): void;
  markEvent(at?: number): void;
};
export function toConnectionState(channelStatus: ChannelStatus, online: boolean): ConnectionState;
export function needsResync(channelStatus: ChannelStatus): boolean;
export function createSyncStore(source: OnlineSource): SyncStore;

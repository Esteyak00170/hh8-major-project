import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3001';

class SocketService {
    constructor() {
        this.socket = null;
    }

    connect() {
        if (!this.socket) {
            this.socket = io(SOCKET_URL, {
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
            });

            this.socket.on('connect', () => {
                console.log('🔗 WebSocket Connected', this.socket.id);
            });

            this.socket.on('disconnect', () => {
                console.log('🔴 WebSocket Disconnected');
            });
        }
        return this.socket;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    // Metrics
    onMetricUpdate(callback) {
        if (!this.socket) this.connect();
        this.socket.on('metric:update', callback);
    }

    offMetricUpdate(callback) {
        if (this.socket) this.socket.off('metric:update', callback);
    }

    // Alerts
    onNewAlert(callback) {
        if (!this.socket) this.connect();
        this.socket.on('alert:new', callback);
    }

    offNewAlert(callback) {
        if (this.socket) this.socket.off('alert:new', callback);
    }

    // Websites
    onWebsiteUpdate(callback) {
        if (!this.socket) this.connect();
        this.socket.on('websites:updated', callback);
    }

    offWebsiteUpdate(callback) {
        if (this.socket) this.socket.off('websites:updated', callback);
    }

    // Critical logs
    onCriticalLog(callback) {
        if (!this.socket) this.connect();
        this.socket.on('log:critical', callback);
    }

    offCriticalLog(callback) {
        if (this.socket) this.socket.off('log:critical', callback);
    }
}

export const socketService = new SocketService();

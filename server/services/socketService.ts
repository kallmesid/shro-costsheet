import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      credentials: true,
    },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    // Join user room for targeted notifications if user authenticated
    socket.on('join_user', (userId: number) => {
      if (userId) {
        socket.join(`user_${userId}`);
      }
    });

    socket.on('join_cost_sheet', (costSheetId: number) => {
      if (costSheetId) {
        socket.join(`sheet_${costSheetId}`);
      }
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function broadcastCostSheetUpdate(costSheetId: number, data: any) {
  if (io) {
    io.emit('cost_sheet_updated', { costSheetId, ...data });
    io.to(`sheet_${costSheetId}`).emit('sheet_detailed_update', { costSheetId, ...data });
  }
}

export function sendUserNotification(userId: number, notification: any) {
  if (io) {
    io.to(`user_${userId}`).emit('notification', notification);
    io.emit('badge_refresh', { userId });
  }
}

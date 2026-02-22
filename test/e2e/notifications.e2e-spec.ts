import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import { NotificationsModule } from '../src/notifications/notifications.module';
import { AuthModule } from '../src/auth/auth.module';
import { ConfigModule } from '@nestjs/config';

describe('Notifications E2E', () => {
  let app: INestApplication;
  let clientSocket: Socket;
  const mockToken = 'valid-jwt-token';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        AuthModule,
        NotificationsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(3001);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
  });

  it('should connect with valid token', (done) => {
    clientSocket = io('http://localhost:3001/notifications', {
      auth: { token: mockToken },
    });

    clientSocket.on('connect', () => {
      expect(clientSocket.connected).toBe(true);
      done();
    });
  });

  it('should receive record.accessed event', (done) => {
    clientSocket = io('http://localhost:3001/notifications', {
      auth: { token: mockToken },
    });

    clientSocket.on('record.accessed', (event) => {
      expect(event.eventType).toBe('record.accessed');
      expect(event.actorId).toBeDefined();
      expect(event.resourceId).toBeDefined();
      expect(event.timestamp).toBeDefined();
      done();
    });
  });

  it('should respond to ping', (done) => {
    clientSocket = io('http://localhost:3001/notifications', {
      auth: { token: mockToken },
    });

    clientSocket.emit('ping', (response: string) => {
      expect(response).toBe('pong');
      done();
    });
  });
});

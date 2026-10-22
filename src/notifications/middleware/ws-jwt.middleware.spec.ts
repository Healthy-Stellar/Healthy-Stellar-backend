import { WsJwtMiddleware } from './ws-jwt.middleware';
import { AuthTokenService } from '../../auth/services/auth-token.service';
import { SessionManagementService } from '../../auth/services/session-management.service';

const validPayload = { userId: 'user-1', sessionId: 'sess-1', email: 'a@b.com', role: 'user' };

const makeSocket = (token?: string, authHeader?: string) =>
  ({
    handshake: {
      auth: token ? { token } : {},
      headers: authHeader ? { authorization: authHeader } : {},
    },
    data: {},
    emit: jest.fn(),
    disconnect: jest.fn(),
  } as any);

describe('WsJwtMiddleware', () => {
  let middleware: WsJwtMiddleware;
  let authToken: jest.Mocked<AuthTokenService>;
  let sessionMgr: jest.Mocked<SessionManagementService>;

  beforeEach(() => {
    authToken = { verifyAccessToken: jest.fn() } as any;
    sessionMgr = { isSessionValid: jest.fn() } as any;
    middleware = new WsJwtMiddleware(authToken, sessionMgr);
  });

  it('calls next() and attaches user payload on valid token', async () => {
    authToken.verifyAccessToken.mockReturnValue(validPayload as any);
    sessionMgr.isSessionValid.mockResolvedValue(true);
    const socket = makeSocket('valid.jwt.token');
    const next = jest.fn();

    await middleware.build()(socket, next);

    expect(next).toHaveBeenCalledWith(); // no error
    expect(socket.data.user).toEqual(validPayload);
  });

  it('calls next(error) and emits 401 when no token provided', async () => {
    const socket = makeSocket();
    const next = jest.fn();

    await middleware.build()(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ status: 401 }));
  });

  it('strips Bearer prefix from Authorization header', async () => {
    authToken.verifyAccessToken.mockReturnValue(validPayload as any);
    sessionMgr.isSessionValid.mockResolvedValue(true);
    const socket = makeSocket(undefined, 'Bearer bearer.jwt.token');
    const next = jest.fn();

    await middleware.build()(socket, next);

    expect(authToken.verifyAccessToken).toHaveBeenCalledWith('bearer.jwt.token');
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(error) on invalid token', async () => {
    authToken.verifyAccessToken.mockReturnValue(null);
    const socket = makeSocket('bad.token');
    const next = jest.fn();

    await middleware.build()(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('calls next(error) when session is expired', async () => {
    authToken.verifyAccessToken.mockReturnValue(validPayload as any);
    sessionMgr.isSessionValid.mockResolvedValue(false);
    const socket = makeSocket('valid.jwt.token');
    const next = jest.fn();

    await middleware.build()(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ status: 401 }));
  });
});

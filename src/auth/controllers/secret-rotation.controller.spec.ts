import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminGuard } from '../guards/admin.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { SecretRotationController } from './secret-rotation.controller';

describe('SecretRotationController', () => {
  it('requires an authenticated admin for every route', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, SecretRotationController)).toEqual([
      JwtAuthGuard,
      AdminGuard,
    ]);
  });
});
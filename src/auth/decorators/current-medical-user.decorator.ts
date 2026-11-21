import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { MedicalUser } from '../interfaces/medical-user.interface';

/**
 * Extracts the authenticated medical user from the request.
 *
 * The user is populated on `request.medicalUser` by the authentication
 * layer (e.g. JWT strategy / auth guard). This decorator only reads it and
 * never mutates the request, keeping the contract shared with
 * `MedicalRbacGuard`.
 */
export const CurrentMedicalUser = createParamDecorator(
  (data: unknown, context: ExecutionContext): MedicalUser => {
    const request = getRequest(context);
    const user: MedicalUser = request?.medicalUser;

    if (!user) {
      throw new UnauthorizedException('No authenticated medical user found');
    }

    return user;
  },
);

function getRequest(context: ExecutionContext): any {
  if (context.getType<'graphql' | 'http'>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext().req;
  }

  return context.switchToHttp().getRequest();
}

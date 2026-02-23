import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { VersionDeprecationInterceptor } from './version-deprecation.interceptor';
import { DEPRECATED_KEY, DeprecatedOptions } from '../decorators/deprecated.decorator';

const makeMockContext = (setHeader: jest.Mock) => {
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getResponse: jest.fn().mockReturnValue({ setHeader }),
    }),
  } as unknown as ExecutionContext;
  return context;
};

describe('VersionDeprecationInterceptor', () => {
  let interceptor: VersionDeprecationInterceptor;
  let reflector: Reflector;
  let setHeader: jest.Mock;

  beforeEach(() => {
    reflector = new Reflector();
    interceptor = new VersionDeprecationInterceptor(reflector);
    setHeader = jest.fn();
  });

  describe('when route is NOT deprecated', () => {
    it('should pass through without setting any headers', (done) => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const ctx = makeMockContext(setHeader);
      const next = { handle: jest.fn().mockReturnValue(of({ data: 'ok' })) };

      interceptor.intercept(ctx, next).subscribe(() => {
        expect(setHeader).not.toHaveBeenCalled();
        done();
      });
    });
  });

  describe('when route IS deprecated', () => {
    const deprecatedOptions: DeprecatedOptions = {
      sunset: 'Sat, 01 Jan 2027 00:00:00 GMT',
      deprecation: 'Mon, 01 Jul 2026 00:00:00 GMT',
      link: 'https://docs.example.com/v2/records',
    };

    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(deprecatedOptions);
    });

    it('should inject Deprecation header', (done) => {
      const ctx = makeMockContext(setHeader);
      const next = { handle: jest.fn().mockReturnValue(of({})) };

      interceptor.intercept(ctx, next).subscribe(() => {
        expect(setHeader).toHaveBeenCalledWith('Deprecation', 'Mon, 01 Jul 2026 00:00:00 GMT');
        done();
      });
    });

    it('should inject Sunset header', (done) => {
      const ctx = makeMockContext(setHeader);
      const next = { handle: jest.fn().mockReturnValue(of({})) };

      interceptor.intercept(ctx, next).subscribe(() => {
        expect(setHeader).toHaveBeenCalledWith('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT');
        done();
      });
    });

    it('should inject Link header when link is provided', (done) => {
      const ctx = makeMockContext(setHeader);
      const next = { handle: jest.fn().mockReturnValue(of({})) };

      interceptor.intercept(ctx, next).subscribe(() => {
        expect(setHeader).toHaveBeenCalledWith(
          'Link',
          '<https://docs.example.com/v2/records>; rel="successor-version"',
        );
        done();
      });
    });

    it('should NOT inject Link header when link is absent', (done) => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        sunset: 'Sat, 01 Jan 2027 00:00:00 GMT',
        deprecation: 'Mon, 01 Jul 2026 00:00:00 GMT',
        // no link
      } as DeprecatedOptions);

      const ctx = makeMockContext(setHeader);
      const next = { handle: jest.fn().mockReturnValue(of({})) };

      interceptor.intercept(ctx, next).subscribe(() => {
        const linkCalls = setHeader.mock.calls.filter(([h]) => h === 'Link');
        expect(linkCalls).toHaveLength(0);
        done();
      });
    });

    it('should read metadata from both handler and class', () => {
      const spy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const ctx = makeMockContext(setHeader);
      const next = { handle: jest.fn().mockReturnValue(of({})) };

      interceptor.intercept(ctx, next).subscribe();

      expect(spy).toHaveBeenCalledWith(DEPRECATED_KEY, [ctx.getHandler(), ctx.getClass()]);
    });
  });
});

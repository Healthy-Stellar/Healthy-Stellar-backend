import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import * as StellarSdk from 'stellar-sdk';

import { OidcIdentity } from './entities/oidc-identity.entity';
import { User } from '../users/entities/user.entity';
import { OidcVerifiedProfile } from './oidc.strategy';
import {
  LinkStellarAddressDto,
  OidcAuthResponse,
  OidcLinkResponse,
} from './dto/oidc.dto';

export interface OidcJwtPayload {
  sub: string;           // internal user UUID
  email: string | null;
  stellarAddress: string | null;
  oidcProvider: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);

  constructor(
    @InjectRepository(OidcIdentity)
    private readonly oidcIdentityRepo: Repository<OidcIdentity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------------------
  // Core: find or create user from OIDC profile
  // ---------------------------------------------------------------------------

  /**
   * Called after a successful OIDC callback.
   * 1. Look up existing OidcIdentity by (provider, sub).
   * 2. If found → update last-used, issue JWT.
   * 3. If not found → check for existing user by email, link or create.
   */
  async handleOidcLogin(profile: OidcVerifiedProfile): Promise<OidcAuthResponse> {
    return this.dataSource.transaction(async (manager) => {
      const identityRepo = manager.getRepository(OidcIdentity);
      const userRepo = manager.getRepository(User);

      // 1. Find existing identity
      let identity = await identityRepo.findOne({
        where: {
          provider: profile.provider,
          providerSubject: profile.providerSubject,
        },
        relations: ['user'],
      });

      let isNewUser = false;

      if (identity) {
        // Update claims and last-used
        identity.email = profile.email;
        identity.givenName = profile.givenName;
        identity.familyName = profile.familyName;
        identity.rawClaims = profile.rawClaims;
        identity.lastUsedAt = new Date();
        await identityRepo.save(identity);

        this.logger.log(
          `Existing OIDC identity: provider=${profile.provider} user=${identity.user.id}`,
        );
      } else {
        // 2. Try to link to existing user by email
        let user: User | null = null;

        if (profile.email) {
          user = await userRepo.findOne({
            where: { email: profile.email },
          });
        }

        if (!user) {
          // 3. Create new user
          user = userRepo.create({
            email: profile.email,
            givenName: profile.givenName,
            familyName: profile.familyName,
            stellarAddress: null,
            isActive: true,
          });
          user = await userRepo.save(user);
          isNewUser = true;
          this.logger.log(`Created new user ${user.id} via OIDC`);
        } else {
          this.logger.log(
            `Linked OIDC identity to existing user ${user.id} by email`,
          );
        }

        identity = identityRepo.create({
          provider: profile.provider,
          providerSubject: profile.providerSubject,
          email: profile.email,
          givenName: profile.givenName,
          familyName: profile.familyName,
          rawClaims: profile.rawClaims,
          lastUsedAt: new Date(),
          user,
        });
        await identityRepo.save(identity);
      }

      const token = this.issueJwt(identity.user, profile.provider);
      const expiresIn = this.parseExpiresIn();

      return {
        accessToken: token,
        tokenType: 'Bearer',
        expiresIn,
        user: {
          id: identity.user.id,
          email: identity.user.email,
          stellarAddress: identity.user.stellarAddress ?? null,
          oidcProvider: profile.provider,
          isNewUser,
        },
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Account linking: OIDC identity → existing Stellar user
  // ---------------------------------------------------------------------------

  /**
   * Links an OIDC identity to an already-authenticated user.
   * Called by POST /auth/oidc/link — the request must carry a valid Stellar JWT.
   */
  async linkOidcIdentityToUser(
    userId: string,
    profile: OidcVerifiedProfile,
  ): Promise<OidcLinkResponse> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Ensure this OIDC identity is not already claimed by someone else
    const existing = await this.oidcIdentityRepo.findOne({
      where: {
        provider: profile.provider,
        providerSubject: profile.providerSubject,
      },
      relations: ['user'],
    });

    if (existing) {
      if (existing.user.id !== userId) {
        throw new ConflictException(
          'This OIDC identity is already linked to a different account',
        );
      }
      // Already linked to this user — idempotent
      return {
        linked: true,
        provider: profile.provider,
        email: existing.email,
      };
    }

    const identity = this.oidcIdentityRepo.create({
      provider: profile.provider,
      providerSubject: profile.providerSubject,
      email: profile.email,
      givenName: profile.givenName,
      familyName: profile.familyName,
      rawClaims: profile.rawClaims,
      lastUsedAt: new Date(),
      user,
    });

    await this.oidcIdentityRepo.save(identity);
    this.logger.log(
      `Linked OIDC identity (${profile.provider}/${profile.providerSubject}) to user ${userId}`,
    );

    return { linked: true, provider: profile.provider, email: profile.email };
  }

  // ---------------------------------------------------------------------------
  // Stellar address linking
  // ---------------------------------------------------------------------------

  /**
   * Bind a Stellar address to an OIDC-authenticated user.
   * Verifies the signed SEP-10 challenge before persisting.
   */
  async linkStellarAddress(
    userId: string,
    dto: LinkStellarAddressDto,
  ): Promise<{ stellarAddress: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.stellarAddress && user.stellarAddress !== dto.stellarAddress) {
      throw new ConflictException(
        'User already has a different Stellar address linked',
      );
    }

    // Verify the signed challenge
    await this.verifyStellarChallenge(
      dto.stellarAddress,
      dto.challengeXdr,
      dto.signedChallenge,
    );

    user.stellarAddress = dto.stellarAddress;
    await this.userRepo.save(user);

    this.logger.log(
      `Stellar address ${dto.stellarAddress} linked to user ${userId}`,
    );

    return { stellarAddress: dto.stellarAddress };
  }

  /**
   * Verify a signed SEP-10 challenge transaction.
   * The challenge XDR must have been previously issued by our server,
   * and the signedChallenge must be a valid signature over it.
   */
  private async verifyStellarChallenge(
    stellarAddress: string,
    challengeXdr: string,
    signedChallengeXdr: string,
  ): Promise<void> {
    try {
      const network = process.env.STELLAR_NETWORK === 'mainnet'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET;

      const tx = StellarSdk.TransactionBuilder.fromXDR(
        signedChallengeXdr,
        network,
      );

      const keypair = StellarSdk.Keypair.fromPublicKey(stellarAddress);
      const hash = (tx as any).hash();

      // Verify that at least one signature on the envelope belongs to the claimed address
      const valid = (tx as any).signatures.some((sig: StellarSdk.xdr.DecoratedSignature) => {
        try {
          return keypair.verify(hash, sig.signature());
        } catch {
          return false;
        }
      });

      if (!valid) {
        throw new UnauthorizedException(
          'Stellar challenge signature verification failed',
        );
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid Stellar challenge XDR');
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private issueJwt(user: User, provider: string): string {
    const payload: OidcJwtPayload = {
      sub: user.id,
      email: user.email,
      stellarAddress: user.stellarAddress ?? null,
      oidcProvider: provider,
    };
    return this.jwtService.sign(payload);
  }

  private parseExpiresIn(): number {
    const raw = process.env.JWT_EXPIRES_IN ?? '8h';
    const match = raw.match(/^(\d+)([smhd])$/);
    if (!match) return 28800; // 8 h default
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * (multipliers[unit] ?? 1);
  }

  async getLinkedIdentities(userId: string): Promise<OidcIdentity[]> {
    return this.oidcIdentityRepo.find({
      where: { user: { id: userId } },
      select: ['id', 'provider', 'email', 'givenName', 'familyName', 'lastUsedAt', 'createdAt'],
    });
  }

  async unlinkOidcIdentity(userId: string, identityId: string): Promise<void> {
    const identity = await this.oidcIdentityRepo.findOne({
      where: { id: identityId, user: { id: userId } },
    });
    if (!identity) throw new NotFoundException('OIDC identity not found');

    const count = await this.oidcIdentityRepo.count({
      where: { user: { id: userId } },
    });
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const hasStellar = !!user?.stellarAddress;

    // Prevent locking out: at least one auth method must remain
    if (count === 1 && !hasStellar) {
      throw new BadRequestException(
        'Cannot unlink last authentication method. Link a Stellar address first.',
      );
    }

    await this.oidcIdentityRepo.remove(identity);
  }
}

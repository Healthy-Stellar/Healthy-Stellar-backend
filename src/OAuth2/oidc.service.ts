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
import { User } from '../auth/entities/user.entity';
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
        // 2. Try to link to existing user by email.
        //    Only auto-link when the IdP asserts the email is verified;
        //    otherwise an attacker could register a victim's email at a
        //    self-service IdP and be silently linked to the victim's account.
        let user: User | null = null;

        if (profile.email && profile.emailVerified) {
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
            `Linked OIDC identity to existing user ${user.id} by verified email`,
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

      const keypair = StellarSdk.Keypair.fromPublicKe

/* … truncated 2602 chars — edit only what you need near the top … */

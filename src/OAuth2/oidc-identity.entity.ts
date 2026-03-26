import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Stores the binding between an external OIDC identity (provider + subject)
 * and an internal User (who may also have a linked Stellar address).
 *
 * One User can have multiple OIDC identities (e.g. Azure AND Okta).
 * One OIDC identity maps to exactly one User.
 */
@Entity('oidc_identities')
@Index(['provider', 'providerSubject'], { unique: true })
export class OidcIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Matches the provider name key in env vars, e.g. 'azure', 'okta' */
  @Column({ length: 64 })
  provider: string;

  /** The `sub` claim from the OIDC id_token */
  @Column({ length: 255, name: 'provider_subject' })
  providerSubject: string;

  /** Email returned by the provider's userinfo endpoint */
  @Column({ length: 255, nullable: true })
  email: string | null;

  /** Given name from the provider */
  @Column({ length: 128, nullable: true, name: 'given_name' })
  givenName: string | null;

  /** Family name from the provider */
  @Column({ length: 128, nullable: true, name: 'family_name' })
  familyName: string | null;

  /**
   * Raw id_token claims stored for audit / debugging.
   * Do NOT store access_token or refresh_token here.
   */
  @Column({ type: 'jsonb', nullable: true, name: 'raw_claims' })
  rawClaims: Record<string, unknown> | null;

  /** The internal user this OIDC identity is linked to */
  @ManyToOne(() => User, (user) => user.oidcIdentities, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /** Last time this identity was used to log in */
  @Column({ type: 'timestamptz', nullable: true, name: 'last_used_at' })
  lastUsedAt: Date | null;
}

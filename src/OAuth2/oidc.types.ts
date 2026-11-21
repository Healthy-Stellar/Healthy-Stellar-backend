export interface OidcVerifiedProfile {
  provider: string;
  providerSubject: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

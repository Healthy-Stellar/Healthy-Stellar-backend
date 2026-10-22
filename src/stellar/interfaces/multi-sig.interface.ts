import { ApiProperty, ApiOperation, ApiTag, Body} from '@nestjs/swagger';

export enum MultiSigTransactionStatus {
  PENDING_SIGNATURES = 'PENDING_SIGNATURES',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  EXECUTED = 'EXECUTED',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
}

export enum SignatureStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface SignerEntry {
  signerId: string;
  status: SignatureStatus;
  signedAt?: string;
  reason?: string;
}

export class CreateMultiSigPaymentDto {
  tenantId: string;
  destination: string;
  amount: string;
  asset?: string;
  memo?: string;
}

export class ApproveRejectDto {
  signerId: string;
  reason?: string;
}

export interface MultiSigTransactionResponse {
  id: string;
  tenantId: string;
  destination: string;
  amount: string;
  asset: string;
  status: MultiSigTransactionStatus;
  threshold: number;
  totalSigners: number;
  signatures: SignerEntry[];
  stellarTxHash?: string;
  expiresAt: string;
  createdAt: string;
  memo?: string;
}

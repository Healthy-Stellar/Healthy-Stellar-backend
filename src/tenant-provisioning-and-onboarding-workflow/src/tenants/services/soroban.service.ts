import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as StellarSDK from '@stellar/stellar-sdk';

@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name);
  private server: StellarSDK.SorobanRpc.Server;
  private network: string;
  private readonly deployer: StellarSDK.Keypair;
  private readonly wasmPath: string;
  private readonly fee: string;

  constructor() {
    const rpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
    const networkPassphrase =
      process.env.SOROBAN_NETWORK === 'public' || process.env.SOROBAN_NETWORK === 'mainnet'
        ? StellarSDK.Networks.PUBLIC
        : StellarSDK.Networks.TESTNET;
    const deployerSecret = process.env.SOROBAN_CONTRACT_DEPLOYER_SECRET;
    if (!deployerSecret) {
      throw new Error('SOROBAN_CONTRACT_DEPLOYER_SECRET is required for SorobanService');
    }

    this.wasmPath = process.env.SOROBAN_CONTRACT_WASM_PATH || '';
    if (!this.wasmPath) {
      throw new Error('SOROBAN_CONTRACT_WASM_PATH is required for SorobanService');
    }
    if (!fs.existsSync(this.wasmPath)) {
      throw new Error(`Soroban contract WASM file not found: ${this.wasmPath}`);
    }

    this.server = new StellarSDK.SorobanRpc.Server(rpcUrl);
    this.network = networkPassphrase;
    this.deployer = StellarSDK.Keypair.fromSecret(deployerSecret);
    this.fee = process.env.SOROBAN_FEE_BUDGET || '10000000';
  }

  async deployTenantContract(tenantId: string, tenantName: string): Promise<string> {
    this.logger.debug(`Deploying Soroban contract for tenant: ${tenantId}`);

    try {
      const wasm = fs.readFileSync(this.wasmPath);
      const wasmHash = crypto.createHash('sha256').update(wasm).digest();

      await this.submitOperation(
        StellarSDK.Operation.uploadContractWasm({ wasm }),
      );

      const salt = crypto
        .createHash('sha256')
        .update(`${tenantId}:${tenantName}`)
        .digest();
      await this.submitOperation(
        StellarSDK.Operation.createCustomContract({
          address: StellarSDK.Address.fromString(this.deployer.publicKey()),
          wasmHash,
          salt,
        }),
      );

      const contractId = this.deriveContractId(salt);

      this.logger.log(`Soroban contract deployed successfully: ${contractId}`);
      return contractId;
    } catch (error) {
      this.logger.error(
        `Failed to deploy Soroban contract for tenant ${tenantId}: ${this.errorMessage(error)}`,
      );
      throw error;
    }
  }

  async verifyContractDeployment(contractId: string): Promise<boolean> {
    this.logger.debug(`Verifying contract deployment: ${contractId}`);

    try {
      const contract = new StellarSDK.Contract(contractId);
      const response = await this.server.getLedgerEntries(contract.getFootprint());
      return response.entries.length > 0;
    } catch (error) {
      this.logger.error(
        `Failed to verify contract ${contractId}: ${this.errorMessage(error)}`,
      );
      return false;
    }
  }

  private async submitOperation(operation: StellarSDK.xdr.Operation): Promise<void> {
    const account = await this.server.getAccount(this.deployer.publicKey());
    const transaction = new StellarSDK.TransactionBuilder(account, {
      fee: this.fee,
      networkPassphrase: this.network,
    })
      .addOperation(operation)
      .setTimeout(60)
      .build();

    const simulation = await this.server.simulateTransaction(transaction);
    if (StellarSDK.SorobanRpc.Api.isSimulationError(simulation)) {
      throw new Error(`Soroban deployment simulation failed: ${simulation.error}`);
    }

    const prepared = StellarSDK.SorobanRpc.assembleTransaction(transaction, simulation).build();
    prepared.sign(this.deployer);
    const submitted = await this.server.sendTransaction(prepared);
    if (submitted.status === 'ERROR') {
      throw new Error(`Soroban deployment submission failed: ${JSON.stringify(submitted.errorResult)}`);
    }

    await this.pollForConfirmation(submitted.hash);
  }

  private async pollForConfirmation(hash: string): Promise<void> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const result = await this.server.getTransaction(hash);
      if (result.status === StellarSDK.SorobanRpc.Api.GetTransactionStatus.SUCCESS) return;
      if (result.status === StellarSDK.SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Soroban deployment transaction failed: ${hash}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error(`Soroban deployment transaction timed out: ${hash}`);
  }

  private deriveContractId(salt: Buffer): string {
    const preimage = StellarSDK.xdr.HashIdPreimage.envelopeTypeContractId(
      new StellarSDK.xdr.HashIdPreimageContractId({
        networkId: StellarSDK.hash(Buffer.from(this.network)),
        contractIdPreimage: StellarSDK.xdr.ContractIdPreimage.contractIdPreimageFromAddress(
          new StellarSDK.xdr.ContractIdPreimageFromAddress({
            address: StellarSDK.Address.fromString(this.deployer.publicKey()).toScAddress(),
            salt,
          }),
        ),
      }),
    );
    return StellarSDK.StrKey.encodeContract(StellarSDK.hash(preimage.toXDR()));
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

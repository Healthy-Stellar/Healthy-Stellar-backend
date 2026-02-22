import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';

export interface TenantContextData {
  tenantId: string;
  tenantSlug: string;
  schemaName: string;
}

@Injectable()
export class TenantContext {
  private static storage = new AsyncLocalStorage<TenantContextData>();

  static run<T>(context: TenantContextData, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  static get(): TenantContextData | undefined {
    return this.storage.getStore();
  }

  static getTenantId(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }

  static getTenantSlug(): string | undefined {
    return this.storage.getStore()?.tenantSlug;
  }

  static getSchemaName(): string | undefined {
    return this.storage.getStore()?.schemaName;
  }

  static clear(): void {
    this.storage.disable();
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { DataResidencyRegion } from '../../enums/data-residency.enum';
import { DataResidencyService } from './data-residency.service';

/**
 * Manages region-aware IPFS node selection
 * Ensures EU tenants use EU-hosted IPFS nodes, etc.
 */
@Injectable()
export class RegionalIpfsService {
  private readonly logger = new Logger(RegionalIpfsService.name);
  private ipfsNodeHealth: Map<string, boolean> = new Map();

  constructor(private dataResidencyService: DataResidencyService) {}

  /**
   * Get IPFS node for a specific region
   * Returns the first healthy node, or random selection if all available
   */
  getIpfsNode(region: DataResidencyRegion): string {
    const nodes = this.dataResidencyService.getIpfsNodes(region);

    if (nodes.length === 0) {
      throw new Error(`No IPFS nodes configured for region: ${region}`);
    }

    // Return healthy node if available
    for (const node of nodes) {
      if (this.ipfsNodeHealth.get(node) !== false) {
        return node;
      }
    }

    // If all nodes are marked unhealthy, use the first one anyway
    this.logger.warn(
      `All IPFS nodes marked unhealthy for region ${region}, using first available node`,
    );
    return nodes[0];
  }

  /**
   * Get all IPFS nodes for a region
   */
  getIpfsNodes(region: DataResidencyRegion): string[] {
    return this.dataResidencyService.getIpfsNodes(region);
  }

  /**
   * Mark IPFS node as healthy or unhealthy
   */
  markNodeHealth(nodeUrl: string, isHealthy: boolean): void {
    this.ipfsNodeHealth.set(nodeUrl, isHealthy);
    this.logger.debug(
      `IPFS node ${nodeUrl} marked as ${isHealthy ? 'healthy' : 'unhealthy'}`,
    );
  }

  /**
   * Check IPFS node connectivity
   */
  async checkNodeHealth(nodeUrl: string): Promise<boolean> {
    try {
      // Simple health check - in production, use proper IPFS health endpoints
      const response = await fetch(`${nodeUrl}/api/v0/id`, {
        method: 'POST',
        timeout: 5000,
      } as RequestInit);

      const isHealthy = response.ok;
      this.markNodeHealth(nodeUrl, isHealthy);
      return isHealthy;
    } catch (error) {
      this.logger.warn(
        `Failed to check health of IPFS node ${nodeUrl}: ${error.message}`,
      );
      this.markNodeHealth(nodeUrl, false);
      return false;
    }
  }

  /**
   * Check health of all IPFS nodes for a region
   */
  async checkRegionalNodesHealth(
    region: DataResidencyRegion,
  ): Promise<Record<string, boolean>> {
    const nodes = this.getIpfsNodes(region);
    const healthStatus: Record<string, boolean> = {};

    const healthChecks = nodes.map(async (node) => {
      const isHealthy = await this.checkNodeHealth(node);
      healthStatus[node] = isHealthy;
    });

    await Promise.all(healthChecks);
    return healthStatus;
  }

  /**
   * Rotate to backup IPFS node if primary fails
   */
  async rotateToHealthyNode(region: DataResidencyRegion): Promise<string> {
    const nodes = this.getIpfsNodes(region);

    for (const node of nodes) {
      const isHealthy = await this.checkNodeHealth(node);
      if (isHealthy) {
        return node;
      }
    }

    // If all nodes are unhealthy, log alert and return first node
    this.logger.error(`All IPFS nodes unhealthy for region ${region}`);
    return nodes[0];
  }
}

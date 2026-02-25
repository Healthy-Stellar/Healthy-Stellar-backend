/**
 * Example Usage of Custom Exceptions
 * 
 * This file demonstrates how to use the custom exception classes
 * in your NestJS services and controllers.
 */

import {
  RecordNotFoundException,
  AccessDeniedException,
  StellarTransactionException,
  IpfsUploadException,
  TenantNotFoundException,
} from './index';

// ============================================
// Example 1: Using RecordNotFoundException
// ============================================

export class PatientService {
  async findById(id: string) {
    const patient = await this.repository.findOne({ where: { id } });
    
    if (!patient) {
      throw new RecordNotFoundException('Patient', id);
    }
    
    return patient;
  }
}

// ============================================
// Example 2: Using AccessDeniedException
// ============================================

export class MedicalRecordsService {
  async getRecord(recordId: string, userId: string) {
    const record = await this.findRecord(recordId);
    
    if (record.ownerId !== userId) {
      throw new AccessDeniedException(
        'medical record',
        'You do not have permission to access this record'
      );
    }
    
    return record;
  }
}

// ============================================
// Example 3: Using StellarTransactionException
// ============================================

export class StellarService {
  async submitTransaction(transaction: any) {
    try {
      const result = await this.stellarClient.submitTransaction(transaction);
      return result;
    } catch (error) {
      throw new StellarTransactionException(
        'Failed to submit transaction to Stellar network',
        error.hash,
        error.code
      );
    }
  }
}

// ============================================
// Example 4: Using IpfsUploadException
// ============================================

export class IpfsService {
  async uploadFile(file: Express.Multer.File) {
    try {
      const result = await this.ipfsClient.add(file.buffer);
      return result.path;
    } catch (error) {
      throw new IpfsUploadException(
        'Failed to upload file to IPFS',
        {
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          ipfsError: error.message,
        }
      );
    }
  }
}

// ============================================
// Example 5: Using TenantNotFoundException
// ============================================

export class TenantService {
  async getTenant(tenantId: string) {
    const tenant = await this.repository.findOne({ where: { id: tenantId } });
    
    if (!tenant) {
      throw new TenantNotFoundException(tenantId);
    }
    
    return tenant;
  }
}

// ============================================
// Example 6: Combining Multiple Exceptions
// ============================================

export class RecordsController {
  async uploadRecord(
    tenantId: string,
    userId: string,
    file: Express.Multer.File
  ) {
    // Check tenant exists
    const tenant = await this.tenantService.getTenant(tenantId);
    // Throws TenantNotFoundException if not found
    
    // Check user has access
    const hasAccess = await this.checkAccess(userId, tenant);
    if (!hasAccess) {
      throw new AccessDeniedException('tenant', 'User not authorized for this tenant');
    }
    
    // Upload to IPFS
    let ipfsHash: string;
    try {
      ipfsHash = await this.ipfsService.uploadFile(file);
    } catch (error) {
      // IpfsUploadException is thrown by service
      throw error;
    }
    
    // Submit to Stellar
    try {
      const txHash = await this.stellarService.submitTransaction({
        ipfsHash,
        tenantId,
        userId,
      });
      
      return { ipfsHash, txHash };
    } catch (error) {
      // StellarTransactionException is thrown by service
      throw error;
    }
  }
}

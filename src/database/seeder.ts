import { DataSource } from 'typeorm';
import { User, UserRole } from '../auth/entities/user.entity';
import { MedicalRecord, RecordType, MedicalRecordStatus } from '../medical-records/entities/medical-record.entity';
import { AccessGrant, AccessLevel, GrantStatus } from '../access-control/entities/access-grant.entity';
import * as argon2 from 'argon2';
import { dataSourceOptions } from '../config/database.config';

/**
 * Database Seeder for Local Development
 * 
 * Seeds the database with test data:
 * - Test patients, doctors, and medical staff
 * - Sample medical records
 * - Access grants for testing
 * 
 * Usage:
 *   npm run seed
 * 
 * WARNING: Only use in development environments!
 */

async function seed() {
  console.log('🌱 Starting database seeding...');

  // Initialize data source
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  console.log('✅ Database connection established');

  try {
    // Clear existing data (development only!)
    if (process.env.NODE_ENV === 'production') {
      throw new Error('❌ Cannot run seeder in production environment!');
    }

    console.log('🗑️  Clearing existing data...');
    await dataSource.query('TRUNCATE TABLE access_grants CASCADE');
    await dataSource.query('TRUNCATE TABLE medical_records CASCADE');
    await dataSource.query('TRUNCATE TABLE mfa_devices CASCADE');
    await dataSource.query('TRUNCATE TABLE sessions CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');

    // Hash password for all test users
    const testPassword = await argon2.hash('Test123!@#');

    // Create test users
    console.log('👥 Creating test users...');
    const userRepository = dataSource.getRepository(User);

    // Admin user
    const admin = userRepository.create({
      email: 'admin@healthystellar.com',
      passwordHash: testPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      isActive: true,
      mfaEnabled: false,
    });
    await userRepository.save(admin);
    console.log('  ✓ Admin user created');

    // Physicians
    const physician1 = userRepository.create({
      email: 'dr.smith@healthystellar.com',
      passwordHash: testPassword,
      firstName: 'John',
      lastName: 'Smith',
      role: UserRole.PHYSICIAN,
      isActive: true,
      licenseNumber: 'MD-12345',
      npi: '1234567890',
      specialization: 'Cardiology',
    });
    await userRepository.save(physician1);

    const physician2 = userRepository.create({
      email: 'dr.johnson@healthystellar.com',
      passwordHash: testPassword,
      firstName: 'Sarah',
      lastName: 'Johnson',
      role: UserRole.PHYSICIAN,
      isActive: true,
      licenseNumber: 'MD-67890',
      npi: '0987654321',
      specialization: 'Neurology',
    });
    await userRepository.save(physician2);
    console.log('  ✓ Physicians created');

    // Nurses
    const nurse1 = userRepository.create({
      email: 'nurse.williams@healthystellar.com',
      passwordHash: testPassword,
      firstName: 'Emily',
      lastName: 'Williams',
      role: UserRole.NURSE,
      isActive: true,
      licenseNumber: 'RN-11111',
    });
    await userRepository.save(nurse1);

    const nurse2 = userRepository.create({
      email: 'nurse.brown@healthystellar.com',
      passwordHash: testPassword,
      firstName: 'Michael',
      lastName: 'Brown',
      role: UserRole.NURSE,
      isActive: true,
      licenseNumber: 'RN-22222',
    });
    await userRepository.save(nurse2);
    console.log('  ✓ Nurses created');

    // Patients
    const patient1 = userRepository.create({
      email: 'patient1@example.com',
      passwordHash: testPassword,
      firstName: 'Alice',
      lastName: 'Anderson',
      role: UserRole.PATIENT,
      isActive: true,
    });
    await userRepository.save(patient1);

    const patient2 = userRepository.create({
      email: 'patient2@example.com',
      passwordHash: testPassword,
      firstName: 'Bob',
      lastName: 'Baker',
      role: UserRole.PATIENT,
      isActive: true,
    });
    await userRepository.save(patient2);

    const patient3 = userRepository.create({
      email: 'patient3@example.com',
      passwordHash: testPassword,
      firstName: 'Carol',
      lastName: 'Carter',
      role: UserRole.PATIENT,
      isActive: true,
    });
    await userRepository.save(patient3);
    console.log('  ✓ Patients created');

    // Billing staff
    const billingStaff = userRepository.create({
      email: 'billing@healthystellar.com',
      passwordHash: testPassword,
      firstName: 'David',
      lastName: 'Davis',
      role: UserRole.BILLING_STAFF,
      isActive: true,
    });
    await userRepository.save(billingStaff);
    console.log('  ✓ Billing staff created');

    // Medical records staff
    const medicalRecordsStaff = userRepository.create({
      email: 'records@healthystellar.com',
      passwordHash: testPassword,
      firstName: 'Emma',
      lastName: 'Evans',
      role: UserRole.MEDICAL_RECORDS,
      isActive: true,
    });
    await userRepository.save(medicalRecordsStaff);
    console.log('  ✓ Medical records staff created');

    // Create medical records
    console.log('📋 Creating medical records...');
    const medicalRecordRepository = dataSource.getRepository(MedicalRecord);

    // Patient 1 records
    const record1 = medicalRecordRepository.create({
      patientId: patient1.id,
      providerId: physician1.id,
      createdBy: physician1.id,
      recordType: RecordType.CONSULTATION,
      title: 'Annual Physical Examination',
      description: 'Routine annual physical examination. Patient reports no major health concerns. Vital signs normal.',
      status: MedicalRecordStatus.ACTIVE,
      recordDate: new Date('2024-01-15'),
      metadata: {
        bloodPressure: '120/80',
        heartRate: 72,
        temperature: 98.6,
        weight: 165,
        height: 70,
      },
    });
    await medicalRecordRepository.save(record1);

    const record2 = medicalRecordRepository.create({
      patientId: patient1.id,
      providerId: physician1.id,
      createdBy: physician1.id,
      recordType: RecordType.LAB_RESULT,
      title: 'Blood Work - Complete Metabolic Panel',
      description: 'Complete metabolic panel results. All values within normal range.',
      status: MedicalRecordStatus.ACTIVE,
      recordDate: new Date('2024-01-20'),
      metadata: {
        glucose: 95,
        sodium: 140,
        potassium: 4.2,
        chloride: 102,
        co2: 24,
      },
    });
    await medicalRecordRepository.save(record2);

    // Patient 2 records
    const record3 = medicalRecordRepository.create({
      patientId: patient2.id,
      providerId: physician2.id,
      createdBy: physician2.id,
      recordType: RecordType.DIAGNOSIS,
      title: 'Migraine Headache Diagnosis',
      description: 'Patient presents with recurring headaches. Diagnosed with migraine headaches.',
      status: MedicalRecordStatus.ACTIVE,
      recordDate: new Date('2024-02-01'),
      metadata: {
        icd10Code: 'G43.909',
        severity: 'moderate',
        frequency: 'weekly',
      },
    });
    await medicalRecordRepository.save(record3);

    const record4 = medicalRecordRepository.create({
      patientId: patient2.id,
      providerId: physician2.id,
      createdBy: physician2.id,
      recordType: RecordType.PRESCRIPTION,
      title: 'Migraine Medication Prescription',
      description: 'Prescribed sumatriptan for migraine management.',
      status: MedicalRecordStatus.ACTIVE,
      recordDate: new Date('2024-02-01'),
      metadata: {
        medication: 'Sumatriptan',
        dosage: '50mg',
        frequency: 'as needed',
        quantity: 9,
        refills: 2,
      },
    });
    await medicalRecordRepository.save(record4);

    // Patient 3 records
    const record5 = medicalRecordRepository.create({
      patientId: patient3.id,
      providerId: physician1.id,
      createdBy: physician1.id,
      recordType: RecordType.TREATMENT,
      title: 'Hypertension Treatment Plan',
      description: 'Treatment plan for newly diagnosed hypertension. Lifestyle modifications and medication.',
      status: MedicalRecordStatus.ACTIVE,
      recordDate: new Date('2024-02-10'),
      metadata: {
        diagnosis: 'Essential Hypertension',
        icd10Code: 'I10',
        treatmentPlan: 'Lifestyle modifications, low sodium diet, regular exercise, medication',
      },
    });
    await medicalRecordRepository.save(record5);

    const record6 = medicalRecordRepository.create({
      patientId: patient3.id,
      providerId: physician1.id,
      createdBy: nurse1.id,
      recordType: RecordType.CONSULTATION,
      title: 'Follow-up Visit - Blood Pressure Check',
      description: 'Follow-up visit to monitor blood pressure. Patient responding well to treatment.',
      status: MedicalRecordStatus.ACTIVE,
      recordDate: new Date('2024-02-24'),
      metadata: {
        bloodPressure: '128/82',
        notes: 'Improved from previous visit',
      },
    });
    await medicalRecordRepository.save(record6);

    console.log('  ✓ Medical records created');

    // Create access grants
    console.log('🔐 Creating access grants...');
    const accessGrantRepository = dataSource.getRepository(AccessGrant);

    // Grant physician1 access to patient1's records
    const grant1 = accessGrantRepository.create({
      patientId: patient1.id,
      granteeId: physician1.id,
      recordIds: [record1.id, record2.id],
      accessLevel: AccessLevel.READ_WRITE,
      status: GrantStatus.ACTIVE,
      expiresAt: new Date('2025-12-31'),
    });
    await accessGrantRepository.save(grant1);

    // Grant physician2 access to patient2's records
    const grant2 = accessGrantRepository.create({
      patientId: patient2.id,
      granteeId: physician2.id,
      recordIds: [record3.id, record4.id],
      accessLevel: AccessLevel.READ_WRITE,
      status: GrantStatus.ACTIVE,
      expiresAt: new Date('2025-12-31'),
    });
    await accessGrantRepository.save(grant2);

    // Grant nurse1 read access to patient3's records
    const grant3 = accessGrantRepository.create({
      patientId: patient3.id,
      granteeId: nurse1.id,
      recordIds: [record5.id, record6.id],
      accessLevel: AccessLevel.READ,
      status: GrantStatus.ACTIVE,
      expiresAt: new Date('2025-12-31'),
    });
    await accessGrantRepository.save(grant3);

    console.log('  ✓ Access grants created');

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  - Users: 10 (1 admin, 2 physicians, 2 nurses, 3 patients, 1 billing, 1 records)');
    console.log('  - Medical Records: 6');
    console.log('  - Access Grants: 3');
    console.log('\n🔑 Test Credentials:');
    console.log('  Email: admin@healthystellar.com');
    console.log('  Email: dr.smith@healthystellar.com');
    console.log('  Email: patient1@example.com');
    console.log('  Password (all users): Test123!@#');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await dataSource.destroy();
    console.log('🔌 Database connection closed');
  }
}

// Run seeder
seed()
  .then(() => {
    console.log('✨ Seeding process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding process failed:', error);
    process.exit(1);
  });

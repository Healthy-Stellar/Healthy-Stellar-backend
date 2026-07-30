import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the icd11_codes table with a representative sample from the
 * WHO ICD-11 for Mortality and Morbidity Statistics (ICD-11 MMS) 2024 release.
 * Full dataset: https://icd.who.int/browse/2024-01/mms/en
 */
export class SeedIcd11Codes1772800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS icd11_codes (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code        VARCHAR(20)  NOT NULL UNIQUE,
        title       VARCHAR(500) NOT NULL,
        synonyms    JSONB        NOT NULL DEFAULT '[]',
        chapter     VARCHAR(10),
        block_id    VARCHAR(50)
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_icd11_codes_title ON icd11_codes (title)`);

    const codes = [
      // Chapter 01 — Certain infectious or parasitic diseases
      ['1A00', 'Cholera', ['Asiatic cholera', 'Epidemic cholera'], '01', 'BlockL1-1A0'],
      ['1B00', 'Typhoid fever', ['Enteric fever', 'Typhoid'], '01', 'BlockL1-1B0'],
      ['1C10', 'Tuberculosis of the respiratory system', ['Pulmonary TB', 'Lung tuberculosis'], '01', 'BlockL1-1C1'],
      ['1D41', 'COVID-19, virus identified', ['SARS-CoV-2 infection', 'Coronavirus disease 2019'], '01', 'BlockL1-1D4'],
      // Chapter 05 — Endocrine, nutritional or metabolic diseases
      ['5A00', 'Type 1 diabetes mellitus', ['Insulin-dependent diabetes mellitus', 'Juvenile-onset diabetes'], '05', 'BlockL1-5A0'],
      ['5A00.0', 'Type 1 diabetes mellitus, without complications', ['T1DM uncomplicated'], '05', 'BlockL1-5A0'],
      ['5A00.1', 'Type 1 diabetes mellitus, with ketoacidosis', ['DKA', 'Diabetic ketoacidosis T1DM'], '05', 'BlockL1-5A0'],
      ['5A10', 'Type 2 diabetes mellitus', ['Non-insulin-dependent diabetes mellitus', 'NIDDM', 'Adult-onset diabetes'], '05', 'BlockL1-5A0'],
      ['5A10.0', 'Type 2 diabetes mellitus, without complications', ['T2DM uncomplicated'], '05', 'BlockL1-5A0'],
      ['5B55', 'Vitamin D deficiency', ['Hypovitaminosis D', 'Calciferol deficiency'], '05', 'BlockL1-5B5'],
      // Chapter 08 — Diseases of the nervous system
      ['8A00', 'Migraine', ['Sick headache', 'Hemicrania'], '08', 'BlockL1-8A0'],
      ['8A85', 'Epilepsy', ['Seizure disorder', 'Convulsive disorder'], '08', 'BlockL1-8A8'],
      // Chapter 11 — Diseases of the circulatory system
      ['BA80', 'Essential hypertension', ['Primary hypertension', 'High blood pressure'], '11', 'BlockL1-BA8'],
      ['BA80.0', 'Essential hypertension, stage 1', ['Mild hypertension'], '11', 'BlockL1-BA8'],
      ['BA80.1', 'Essential hypertension, stage 2', ['Moderate hypertension'], '11', 'BlockL1-BA8'],
      ['BA41', 'Acute myocardial infarction', ['Heart attack', 'MI', 'Coronary thrombosis'], '11', 'BlockL1-BA4'],
      ['BA80.Z', 'Essential hypertension, unspecified', ['Hypertension NOS'], '11', 'BlockL1-BA8'],
      ['BB10', 'Atrial fibrillation', ['AF', 'AFib', 'Auricular fibrillation'], '11', 'BlockL1-BB1'],
      // Chapter 12 — Diseases of the respiratory system
      ['CA22', 'Asthma', ['Bronchial asthma', 'Reactive airway disease'], '12', 'BlockL1-CA2'],
      ['CA22.0', 'Mild intermittent asthma', ['Step 1 asthma'], '12', 'BlockL1-CA2'],
      ['CA22.1', 'Mild persistent asthma', ['Step 2 asthma'], '12', 'BlockL1-CA2'],
      ['CB01', 'Chronic obstructive pulmonary disease', ['COPD', 'Emphysema', 'Chronic bronchitis'], '12', 'BlockL1-CB0'],
      ['CA40', 'Pneumonia', ['Lung infection', 'Pulmonary infection'], '12', 'BlockL1-CA4'],
      // Chapter 13 — Diseases of the digestive system
      ['DA90', 'Gastro-oesophageal reflux disease', ['GERD', 'GORD', 'Acid reflux', 'Heartburn'], '13', 'BlockL1-DA9'],
      ['DB30', 'Peptic ulcer disease', ['Gastric ulcer', 'Duodenal ulcer', 'Stomach ulcer'], '13', 'BlockL1-DB3'],
      ['DC10', 'Appendicitis', ['Appendix inflammation'], '13', 'BlockL1-DC1'],
      // Chapter 15 — Diseases of the musculoskeletal system
      ['FA00', 'Rheumatoid arthritis', ['RA', 'Atrophic arthritis'], '15', 'BlockL1-FA0'],
      ['FA82', 'Osteoarthritis', ['OA', 'Degenerative joint disease', 'Arthrosis'], '15', 'BlockL1-FA8'],
      ['FB83.0', 'Osteoporosis without pathological fracture', ['Bone loss', 'Reduced bone density'], '15', 'BlockL1-FB8'],
      ['FB20.0', 'Closed fracture of shaft of femur', ['Femur fracture', 'Thigh bone fracture'], '15', 'BlockL1-FB2'],
      // Chapter 06 — Mental, behavioural or neurodevelopmental disorders
      ['6A70', 'Single episode depressive disorder', ['Major depressive episode', 'Clinical depression'], '06', 'BlockL1-6A7'],
      ['6A80', 'Generalised anxiety disorder', ['GAD', 'Anxiety neurosis'], '06', 'BlockL1-6A8'],
      ['6A40', 'Schizophrenia', ['Dementia praecox'], '06', 'BlockL1-6A4'],
      ['6C40', 'Alcohol dependence', ['Alcoholism', 'Alcohol use disorder'], '06', 'BlockL1-6C4'],
      // Chapter 16 — Diseases of the genitourinary system
      ['GB70', 'Urinary tract infection', ['UTI', 'Cystitis', 'Bladder infection'], '16', 'BlockL1-GB7'],
      ['GB40', 'Chronic kidney disease', ['CKD', 'Chronic renal failure', 'Renal insufficiency'], '16', 'BlockL1-GB4'],
      // Chapter 02 — Neoplasms
      ['2C10', 'Carcinoma of bronchus or lung', ['Lung cancer', 'Bronchogenic carcinoma', 'NSCLC'], '02', 'BlockL1-2C1'],
      ['2C61', 'Carcinoma of prostate', ['Prostate cancer', 'Prostatic carcinoma'], '02', 'BlockL1-2C6'],
      ['2C50', 'Carcinoma of breast', ['Breast cancer', 'Mammary carcinoma'], '02', 'BlockL1-2C5'],
    ];

    const values = codes
      .map(
        ([code, title, synonyms, chapter, blockId]) =>
          `('${code}', '${(title as string).replace(/'/g, "''")}', '${JSON.stringify(synonyms)}'::jsonb, '${chapter}', '${blockId}')`,
      )
      .join(',\n      ');

    await queryRunner.query(`
      INSERT INTO icd11_codes (code, title, synonyms, chapter, block_id)
      VALUES ${values}
      ON CONFLICT (code) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS icd11_codes`);
  }
}

import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('icd11_codes')
@Index(['code'], { unique: true })
@Index(['title'])
export class Icd11Code {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** WHO ICD-11 alphanumeric code, e.g. "5A00.0", "BA80". */
  @Column({ type: 'varchar', length: 20 })
  code: string;

  /** Primary English title as published in the WHO ICD-11 release. */
  @Column({ type: 'varchar', length: 500 })
  title: string;

  /** Alternative names and synonyms for this code. */
  @Column({ type: 'jsonb', default: '[]' })
  synonyms: string[];

  /** ICD-11 chapter identifier, e.g. "05" (Endocrine, nutritional or metabolic diseases). */
  @Column({ type: 'varchar', length: 10, nullable: true })
  chapter: string;

  /** ICD-11 linearization block ID for grouping, e.g. "BlockL1-5A0". */
  @Column({ type: 'varchar', length: 50, nullable: true })
  blockId: string;
}

import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isValidICD10', async: false })
export class IsValidICD10Constraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    const icd10Regex = /^[A-Z][0-9][A-Z0-9](\.[A-Z0-9]{1,2})?$/;
    return typeof value === 'string' && icd10Regex.test(value);
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a valid ICD-10 code format`;
  }
}

@ValidatorConstraint({ name: 'isValidCPT', async: false })
export class IsValidCPTConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    const cptRegex = /^[0-9]{5}$/;
    return typeof value === 'string' && cptRegex.test(value);
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a valid 5-digit CPT code`;
  }
}

@ValidatorConstraint({ name: 'isValidMRN', async: false })
export class IsValidMRNConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    return typeof value === 'string' && value.length >= 6 && value.length <= 20;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a valid MRN (6-20 characters)`;
  }
}

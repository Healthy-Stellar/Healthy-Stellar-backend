import { Validate, ValidationOptions, registerDecorator } from 'class-validator';
import {
  IsValidICD10Constraint,
  IsValidCPTConstraint,
  IsValidMRNConstraint,
} from './medical-data.validator';

export function IsValidICD10(validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidICD10Constraint,
    });
  };
}

export function IsValidCPT(validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidCPTConstraint,
    });
  };
}

export function IsValidMRN(validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidMRNConstraint,
    });
  };
}

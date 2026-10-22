import { Injectable, Logger } from '@nestjs/common';
import { PolicyService } from './policy.service';
import {
  Policy,
  PolicyEffect,
  PolicyCondition,
  PolicySubject,
  PolicyResource,
  PolicyAction,
} from '../entities/access-policy.entity';

export interface UserContext {
  id: string;
  roles: string[];
  permissions?: string[];
  attributes?: Record<string, any>;
  organizationId?: string;
  department?: string;
}

export interface ResourceContext {
  type: string;
  id?: string;
  attributes?: Record<string, any>;
  ownerId?: string;
  organizationId?: string;
}

export interface ActionContext {
  name: string;
  attributes?: Record<string, any>;
}

export interface PolicyEvaluationContext {
  user: UserContext;
  resource?: ResourceContext;
  action?: ActionContext;
  environment?: Record<string, any>;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  policy?: Policy;
  reason?: string;
  evaluatedPolicies: number;
}

@Injectable()
export class PolicyEngine {
  private readonly logger = new Logger(PolicyEngine.name);

  constructor(private readonly policyService: PolicyService) {}

  /**
   * Evaluate all active policies against the given context
   */
  async evaluate(
    context: PolicyEvaluationContext,
    category?: string,
  ): Promise<PolicyEvaluationResult> {
    const policies = await this.policyService.findActivePolicies(category);
    let evaluatedCount = 0;
    let matchedPolicy: Policy | undefined;
    let finalDecision: boolean | undefined;

    // Sort policies by priority (highest first)
    policies.sort((a, b) => b.priority - a.priority);

    for (const policy of policies) {
      evaluatedCount++;

      if (this.matchesPolicy(policy, context)) {
        matchedPolicy = policy;

        // Check if policy applies (conditions match)
        if (this.evaluateConditions(policy.conditions, context)) {
          finalDecision = policy.effect === PolicyEffect.ALLOW;
          break; // First matching policy determines the decision
        }
      }
    }

    // Default deny if no policy matched
    const allowed = finalDecision ?? false;
    const reason = matchedPolicy
      ? `Policy '${matchedPolicy.name}' resulted in ${matchedPolicy.effect}`
      : 'No matching policy found (default deny)';

    return {
      allowed,
      policy: matchedPolicy,
      reason,
      evaluatedPolicies: evaluatedCount,
    };
  }

  /**
   * Check if a policy matches the given context (subjects, resources, actions)
   */
  private matchesPolicy(policy: Policy, context: PolicyEvaluationContext): boolean {
    // Check subjects (who)
    if (policy.subjects && !this.matchesSubjects(policy.subjects, context.user)) {
      return false;
    }

    // Check resources (what)
    if (
      policy.resources &&
      context.resource &&
      !this.matchesResources(policy.resources, context.resource)
    ) {
      return false;
    }

    // Check actions (how)
    if (policy.actions && context.action && !this.matchesActions(policy.actions, context.action)) {
      return false;
    }

    return true;
  }

  /**
   * Check if user matches policy subjects
   */
  private matchesSubjects(subjects: PolicySubject[], user: UserContext): boolean {
    return subjects.some((subject) => {
      switch (subject.type) {
        case 'user':
          return Array.isArray(subject.value)
            ? subject.value.includes(user.id)
            : subject.value === user.id;

        case 'role':
          return Array.isArray(subject.value)
            ? subject.value.some((role) => user.roles.includes(role))
            : user.roles.includes(subject.value);

        case 'group':
          // Groups would be implemented based on your group system
          return false; // Placeholder

        case 'attribute':
          return this.evaluateAttributeMatch(subject.value as string, user.attributes);

        default:
          return false;
      }
    });
  }

  /**
   * Check if resource matches policy resources
   */
  private matchesResources(resources: PolicyResource[], resource: ResourceContext): boolean {
    return resources.some((res) => {
      switch (res.type) {
        case 'resource':
          return Array.isArray(res.value)
            ? res.value.includes(resource.type)
            : res.value === resource.type;

        case 'pattern':
          // Pattern matching for resource types
          return Array.isArray(res.value)
            ? res.value.some((pattern) => this.matchesPattern(pattern, resource.type))
            : this.matchesPattern(res.value, resource.type);

        case 'attribute':
          return this.evaluateAttributeMatch(res.value as string, resource.attributes);

        default:
          return false;
      }
    });
  }

  /**
   * Check if action matches policy actions
   */
  private matchesActions(actions: PolicyAction[], action: ActionContext): boolean {
    return actions.some((act) => {
      switch (act.type) {
        case 'action':
          return Array.isArray(act.value)
            ? act.value.includes(action.name)
            : act.value === action.name;

        case 'pattern':
          return Array.isArray(act.value)
            ? act.value.some((pattern) => this.matchesPattern(pattern, action.name))
            : this.matchesPattern(act.value, action.name);

        case 'attribute':
          return this.evaluateAttributeMatch(act.value as string, action.attributes);

        default:
          return false;
      }
    });
  }

  /**
   * Evaluate policy conditions
   */
  private evaluateConditions(
    conditions: PolicyCondition[] | undefined,
    context: PolicyEvaluationContext,
  ): boolean {
    if (!conditions || conditions.length === 0) {
      return true; // No conditions means policy applies
    }

    // For now, implement basic condition evaluation
    // This can be extended to support complex boolean logic
    return conditions.every((condition) => this.evaluateCondition(condition, context));
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: PolicyCondition, context: PolicyEvaluationContext): boolean {
    const { type, operator, field, value } = condition;

    let actualValue: any;

    // Get the actual value based on condition type
    switch (type) {
      case 'role':
        actualValue = context.user.roles;
        break;
      case 'permission':
        actualValue = context.user.permissions || [];
        break;
      case 'attribute':
        actualValue = field ? this.getNestedValue(context, field) : null;
        break;
      case 'custom':
        // Custom conditions can be implemented per use case
        return this.evaluateCustomCondition(condition, context);
      default:
        return false;
    }

    // Evaluate based on operator
    return this.evaluateOperator(actualValue, operator, value);
  }

  /**
   * Evaluate operators (equals, in, contains, etc.)
   */
  private evaluateOperator(actualValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'equals':
        return actualValue === expectedValue;
      case 'in':
        return Array.isArray(expectedValue) ? expectedValue.includes(actualValue) : false;
      case 'contains':
        return Array.isArray(actualValue) ? actualValue.includes(expectedValue) : false;
      case 'matches':
        return typeof actualValue === 'string' && typeof expectedValue === 'string'
          ? new RegExp(expectedValue).test(actualValue)
          : false;
      case 'greaterThan':
        return typeof actualValue === 'number' && typeof expectedValue === 'number'
          ? actualValue > expectedValue
          : false;
      case 'lessThan':
        return typeof actualValue === 'number' && typeof expectedValue === 'number'
          ? actualValue < expectedValue
          : false;
      case 'and':
        return (
          Array.isArray(actualValue) &&
          actualValue.every((val) => this.evaluateOperator(val, 'equals', expectedValue))
        );
      case 'or':
        return (
          Array.isArray(actualValue) &&
          actualValue.some((val) => this.evaluateOperator(val, 'equals', expectedValue))
        );
      case 'not':
        return !this.evaluateOperator(actualValue, 'equals', expectedValue);
      default:
        return false;
    }
  }

  /**
   * Get nested value from context using dot notation
   */
  private getNestedValue(context: PolicyEvaluationContext, path: string): any {
    const keys = path.split('.');
    let current: any = context;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Evaluate custom conditions (extensible)
   */
  private evaluateCustomCondition(
    condition: PolicyCondition,
    context: PolicyEvaluationContext,
  ): boolean {
    // Implement custom logic based on your needs
    // For example, time-based conditions, IP-based conditions, etc.
    return true; // Placeholder
  }

  /**
   * Check if value matches pattern (supports wildcards)
   */
  private matchesPattern(pattern: string, value: string): boolean {
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`).test(value);
  }

  /**
   * Evaluate attribute-based matching
   */
  private evaluateAttributeMatch(attributePath: string, attributes?: Record<string, any>): boolean {
    if (!attributes) return false;

    const keys = attributePath.split('.');
    let current: any = attributes;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return false;
      }
    }

    return current === true; // For boolean attributes
  }
}

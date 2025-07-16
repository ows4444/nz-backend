import type { ValidationIssue, ValidationResult } from '../interfaces';

type SeverityType = 'error' | 'warning' | 'info';

interface ValidationResultWithSeverityGrouping extends ValidationResult {
  issuesBySeverity: Record<SeverityType, ValidationIssue[]>;
}

export class ValidationResultMerger {
  static mergeResults(results: ValidationResult[]): ValidationResult {
    if (!results?.length) {
      return this.createEmptyResult();
    }

    if (results.length === 1) {
      return results[0];
    }

    const aggregatedData = this.aggregateResults(results);
    const uniqueIssues = this.deduplicateIssues(aggregatedData.allIssues);

    return this.createMergedResult(uniqueIssues, aggregatedData);
  }

  static mergeWithSeverityGrouping(results: ValidationResult[]): ValidationResultWithSeverityGrouping {
    const mergedResult = this.mergeResults(results);
    const issuesBySeverity = this.groupIssuesBySeverity(mergedResult.issues);

    return {
      ...mergedResult,
      issuesBySeverity,
    };
  }
  private static aggregateResults(results: ValidationResult[]) {
    const allIssues: ValidationIssue[] = [];
    const mergedMetadata: Record<string, unknown> = {};
    let isValid = true;

    for (const result of results) {
      this.collectIssuesFromResult(result, allIssues);

      if (result.metadata) {
        Object.assign(mergedMetadata, result.metadata);
      }

      if (!result.isValid) {
        isValid = false;
      }
    }

    return {
      allIssues,
      mergedMetadata,
      isValid,
      fieldPath: this.getMergedFieldPath(results),
    };
  }

  private static collectIssuesFromResult(result: ValidationResult, allIssues: ValidationIssue[]): void {
    const issueSources = [result.issues, result.errors, result.warnings, result.infos];

    for (const issues of issueSources) {
      if (issues?.length) {
        allIssues.push(...issues);
      }
    }
  }

  private static deduplicateIssues(issues: ValidationIssue[]): ValidationIssue[] {
    const seen = new Set<string>();

    return issues.filter((issue) => {
      const key = this.createIssueKey(issue);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private static createIssueKey(issue: ValidationIssue): string {
    return `${issue.code}:${issue.fieldPath ?? 'root'}`;
  }

  private static groupIssuesBySeverity(issues: ValidationIssue[]): Record<SeverityType, ValidationIssue[]> {
    const grouped = issues.reduce(
      (acc, issue) => {
        const severity = issue.severity as SeverityType;
        if (!acc[severity]) {
          acc[severity] = [];
        }
        acc[severity].push(this.cleanObject(issue));
        return acc;
      },
      {} as Record<SeverityType, ValidationIssue[]>,
    );

    return {
      error: grouped.error ?? [],
      warning: grouped.warning ?? [],
      info: grouped.info ?? [],
    };
  }

  private static getMergedFieldPath(results: ValidationResult[]): string | undefined {
    const fieldPaths = results.map((result) => result.fieldPath).filter((path): path is string => path !== undefined);

    if (fieldPaths.length === 0) {
      return undefined;
    }

    if (fieldPaths.length === 1) {
      return fieldPaths[0];
    }

    return fieldPaths.join(', ');
  }

  private static createMergedResult(uniqueIssues: ValidationIssue[], aggregatedData: ReturnType<typeof ValidationResultMerger.aggregateResults>): ValidationResult {
    const { mergedMetadata, isValid, fieldPath } = aggregatedData;

    return {
      isValid,
      issues: uniqueIssues.map((issue) => this.cleanObject(issue)),
      metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
      fieldPath,

      get errors() {
        return uniqueIssues.filter((issue) => issue.severity === 'error');
      },
      get warnings() {
        return uniqueIssues.filter((issue) => issue.severity === 'warning');
      },
      get infos() {
        return uniqueIssues.filter((issue) => issue.severity === 'info');
      },
    };
  }

  private static createEmptyResult(): ValidationResult {
    return {
      isValid: true,
      issues: [],
      get errors() {
        return [];
      },
      get warnings() {
        return [];
      },
      get infos() {
        return [];
      },
    };
  }

  private static cleanObject<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.cleanObject(item)) as unknown as T;
    }

    const cleaned: T = {} as unknown as T;
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        (cleaned as Record<string, unknown>)[key] = typeof value === 'object' ? this.cleanObject(value) : value;
      }
    }

    return cleaned;
  }
}

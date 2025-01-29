# mcp-qualytics

MCP Server version of the [Qualytics VS Code plugin](https://www.aritra.site/blog/qualytics) by Aritra Mazumder.

## Features

Contains MCP Server tools to report on the complexity and maintainability of TypeScript files.

## Installation

TBC

## Understanding the Metrics

### Cyclomatic Complexity

Measures the number of linearly independent paths through your code. Lower is generally better, as high complexity can indicate code that's difficult to test and maintain.

### Maintainability Index

A composite metric that considers volume, complexity, and lines of code. Scores range from 0 to 100, with higher scores indicating more maintainable code.

### Lines of Code

Counts the number of executable lines in your file, excluding blank lines, comments, and other non-executable statements. This metric provides a clearer picture of your code's actual size and can help identify files that might be too large and in need of refactoring. Remember, while a lower count often indicates more manageable code, it's not always a direct indicator of quality.

---

| File | Scope | Name | Type | Lines | LOC | Complexity | Maintainability | Methods | Avg Complexity |
|------|--------|------|------|-------|-----|------------|----------------|----------|----------------|
| src\ast-utils.ts | file | - | - | - | 18 | 9 | 49.37 | 4 | 2.25 |
| src\ast-utils.ts | function | traverseAST | function | 3-28 | 14 | 7 | 57.21 | 2 | 3.50 |
| src\ast-utils.ts | function | <arrow> | arrow | 14-18 | 2 | 2 | 83.34 | 1 | 2.00 |
| src\ast-utils.ts | function | isASTNode | function | 30-32 | 2 | 3 | 81.14 | 1 | 3.00 |
| src\ast-utils.ts | function | isExecutableNode | function | 34-55 | 2 | 1 | 75.98 | 1 | 1.00 |
| src\constants.ts | file | - | - | - | 3 | 1 | 79.64 | 0 | 0.00 |
| src\metrics.ts | file | - | - | - | 131 | 70 | 16.12 | 18 | 3.89 |
| src\metrics.ts | function | calculateMetricsForNode | function | 9-46 | 9 | 9 | 58.77 | 1 | 9.00 |
| src\metrics.ts | function | getFunctionName | function | 48-69 | 11 | 11 | 57.14 | 1 | 11.00 |
| src\metrics.ts | function | getFunctionType | function | 71-83 | 6 | 5 | 68.47 | 1 | 5.00 |
| src\metrics.ts | function | analyzeFile | function | 85-142 | 14 | 8 | 53.25 | 3 | 2.67 |
| src\metrics.ts | function | <arrow> | arrow | 117-136 | 5 | 6 | 65.92 | 1 | 6.00 |
| src\metrics.ts | function | <arrow> | arrow | 140-140 | 0 | 1 | 91.08 | 1 | 1.00 |
| src\metrics.ts | function | calculateMetrics | function | 144-147 | 3 | 1 | 78.56 | 1 | 1.00 |
| src\metrics.ts | function | countLogicalLinesOfCode | function | 149-157 | 6 | 2 | 70.44 | 2 | 1.00 |
| src\metrics.ts | function | <arrow> | arrow | 151-155 | 2 | 2 | 85.15 | 1 | 2.00 |
| src\metrics.ts | function | calculateCyclomaticComplexity | function | 159-194 | 15 | 15 | 54.17 | 2 | 7.50 |
| src\metrics.ts | function | <arrow> | arrow | 161-192 | 11 | 15 | 57.87 | 1 | 15.00 |
| src\metrics.ts | function | calculateHalsteadMetrics | function | 196-264 | 43 | 15 | 40.96 | 2 | 7.50 |
| src\metrics.ts | function | <arrow> | arrow | 204-253 | 29 | 14 | 46.17 | 1 | 14.00 |
| src\metrics.ts | function | calculateMaintainabilityIndex | function | 266-276 | 5 | 3 | 68.14 | 1 | 3.00 |
| src\metrics.ts | function | analyzeClassStructure | function | 278-304 | 13 | 6 | 56.62 | 2 | 3.00 |
| src\metrics.ts | function | <arrow> | arrow | 285-300 | 7 | 6 | 64.13 | 1 | 6.00 |
| src\metrics.ts | function | analyzeFunctionStructure | function | 306-323 | 6 | 5 | 66.37 | 2 | 2.50 |
| src\metrics.ts | function | <arrow> | arrow | 311-320 | 2 | 5 | 78.26 | 1 | 5.00 |
| src\server.ts | file | - | - | - | 113 | 34 | 22.67 | 13 | 2.62 |
| src\server.ts | function | findTypeScriptFiles | function | 26-45 | 16 | 8 | 54.99 | 2 | 4.00 |
| src\server.ts | function | scan | function | 29-41 | 11 | 8 | 59.02 | 1 | 8.00 |
| src\server.ts | function | <arrow> | arrow | 47-136 | 1 | 1 | 81.48 | 1 | 1.00 |
| src\server.ts | function | <arrow> | arrow | 138-368 | 68 | 23 | 32.47 | 2 | 11.50 |
| src\server.ts | function | <arrow> | arrow | 205-214 | 0 | 1 | 83.59 | 1 | 1.00 |
| src\server.ts | function | main | function | 370-401 | 22 | 5 | 51.53 | 7 | 0.71 |
| src\server.ts | function | handleShutdown | function | 373-383 | 8 | 3 | 66.35 | 1 | 3.00 |
| src\server.ts | function | <arrow> | arrow | 385-387 | 1 | 1 | 95.12 | 1 | 1.00 |
| src\server.ts | function | <arrow> | arrow | 389-389 | 0 | 1 | 95.12 | 1 | 1.00 |
| src\server.ts | function | <arrow> | arrow | 390-390 | 0 | 1 | 95.12 | 1 | 1.00 |
| src\server.ts | function | <arrow> | arrow | 391-391 | 0 | 1 | 95.12 | 1 | 1.00 |
| src\server.ts | function | <arrow> | arrow | 392-392 | 0 | 1 | 95.12 | 1 | 1.00 |
| src\server.ts | function | <arrow> | arrow | 403-406 | 2 | 1 | 83.41 | 1 | 1.00 |
| src\types.ts | file | - | - | - | 0 | 1 | 82.93 | 0 | 0.00 |

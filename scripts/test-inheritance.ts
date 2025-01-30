import { calculateMetrics } from '../src/metrics/index.js';
import { readFileSync } from 'fs';

// Analyze each test file
const testFiles = [
    'test/fixtures/inheritance-linear.ts',
    'test/fixtures/inheritance-interfaces.ts',
    'test/fixtures/inheritance-abstract.ts'
];

for (const filePath of testFiles) {
    console.log(`\nAnalyzing ${filePath}:`);
    const code = readFileSync(filePath, 'utf-8');
    const metrics = calculateMetrics(code, filePath);
    console.log('Inheritance Depth:', metrics.depthOfInheritance);
    console.log('Class Count:', metrics.classCount);
    console.log('Full Metrics:', metrics);
}
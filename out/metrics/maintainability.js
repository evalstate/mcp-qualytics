/**
 * Calculates the maintainability index for a code segment.
 * The maintainability index is a software metric that indicates how maintainable (easy to support and change)
 * the source code is. The range is 0 to 100 with higher values indicating better maintainability.
 *
 * Formula:
 * MI = max(0,(171 - 5.2 * ln(HV) - 0.23 * CC - 16.2 * ln(LOC))*100 / 171)
 * where:
 * - HV is the Halstead Volume
 * - CC is the Cyclomatic Complexity
 * - LOC is the count of source Lines Of Code
 */
export function calculateMaintainabilityIndex(halsteadVolume, cyclomaticComplexity, linesOfCode) {
    // Handle edge cases to avoid NaN or Infinity
    const safeLog = (n) => (n > 0 ? Math.log(n) : 0);
    const volumeLog = safeLog(halsteadVolume);
    const locLog = safeLog(linesOfCode);
    const rawMI = 171
        - (5.2 * volumeLog)
        - (0.23 * cyclomaticComplexity)
        - (16.2 * locLog);
    // Normalize to 0-100 range
    return Math.max(0, (rawMI * 100) / 171);
}

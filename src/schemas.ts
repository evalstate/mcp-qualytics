import { z } from "zod";

export const TypescriptAnalyzeTextSchema = z.object({
  code: z.string().describe("TypeScript code to analyze"),
  format: z.enum(["json", "table"])
    .default("json")
    .describe("Output format: 'json' for raw analysis data, or 'table' for a concise markdown table format")
});

export const TypescriptAnalyzeFileSchema = z.object({
  filepath: z.string().describe("Absolute or relative path to the TypeScript file to analyze"),
  format: z.enum(["json", "table"])
    .default("json")
    .describe("Output format: 'json' for raw analysis data, or 'table' for a concise markdown table format"),
  include_source: z.boolean()
    .default(false)
    .describe("When true, includes the source file as an embedded resource")
});

export const TypescriptAnalyzeDirectorySchema = z.object({
  directory: z.string()
    .describe("Absolute or relative path to the directory containing TypeScript files. Will recursively search subdirectories, excluding node_modules and hidden directories."),
  format: z.enum(["json", "table"])
    .default("json")
    .describe("Output format: 'json' for raw analysis data, or 'table' for a concise markdown table format"),
  include_functions: z.boolean()
    .default(true)
    .describe("When true, includes detailed metrics for every function/method in each file. Set to false for a more concise file-level overview."),
  ignore_patterns: z.array(z.string())
    .default([])
    .describe("Optional array of glob patterns to ignore (in addition to .gitignore and defaults). Example: ['test/**', '**/*.test.ts']")
});

export enum ToolName {
  TYPESCRIPT_ANALYZE_TEXT = "typescript_analyze_text",
  TYPESCRIPT_ANALYZE_FILE = "typescript_analyze_file",
  TYPESCRIPT_ANALYZE_DIRECTORY = "typescript_analyze_directory"
}

// Type exports
export type TypescriptAnalyzeTextInput = z.infer<typeof TypescriptAnalyzeTextSchema>;
export type TypescriptAnalyzeFileInput = z.infer<typeof TypescriptAnalyzeFileSchema>;
export type TypescriptAnalyzeDirectoryInput = z.infer<typeof TypescriptAnalyzeDirectorySchema>;
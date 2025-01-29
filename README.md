# MCP Qualytics

A Code Metric Analysis MCP Server that provides advanced code quality metrics for TypeScript code.

## Installation

```bash
npm install -g @llmindset/mcp-qualytics
```

## Usage

MCP Qualytics provides three main tools for code analysis:

### 1. Analyze Text

Analyze TypeScript code provided as text:

```typescript
{
  name: "typescript_analyze_text",
  arguments: {
    code: "function example() { return true; }",
    format: "text" // or "table"
  }
}
```

### 2. Analyze File

Analyze a TypeScript file:

```typescript
{
  name: "typescript_analyze_file",
  arguments: {
    filepath: "/path/to/file.ts",
    format: "text" // or "table"
  }
}
```

### 3. Analyze Directory

Analyze all TypeScript files in a directory:

```typescript
{
  name: "typescript_analyze_directory",
  arguments: {
    directory: "/path/to/dir",
    include_functions: true, // optional
    ignore_patterns: ["test/**", "**/*.spec.ts"] // optional
  }
}
```

## Metrics

The analysis includes:
- Lines of Code (LOC)
- Cyclomatic Complexity
- Maintainability Index (0-100)
- Class Count
- Method Count
- Average Method Complexity
- Inheritance Depth

## Output Formats

All tools support two output formats:
- `text`: Detailed human-readable output
- `table`: Markdown table format for easy visualization

## License

MIT
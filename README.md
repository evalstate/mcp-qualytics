# MCP Qualytics

Code Metric Analysis MCP Server that provides advanced code quality metrics for TypeScript code.

## Installation

Requires NodeJS >18.0 [NodeJS](https://nodejs.org/en/download) to be installed.

### Goose

Use Goose Configure to add a Command Line extension with the command `npx -y @llmindset/mcp-qualytics" or update your config.yaml:

```yaml
extensions:
  developer:
    enabled: true
    name: developer
    type: builtin
  mcp-qualytics:
    args:
    - -y
    - '@llmindset/mcp-qualytics'
    cmd: npx
    enabled: true
    envs: {}
    name: mcp-qualytics
    type: stdio
```

### Claude Desktop

Add the following to the mcpServers section of your `claude_desktop_config.json` file:

```json

    "mcp-qualytics": {
      "command": "npx",
      "args": ["-y", "mcp-qualytics"]
    }
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
- Logical Lines of Code (LLOC)
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

## Notes

- The LLOC function has been updated from the original to count more TypeScript specific features.

## License

MIT

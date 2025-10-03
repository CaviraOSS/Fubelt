# Fubelt Language Support

This extension provides syntax highlighting and language support for Fubelt framework files (`.fubelt`, `.fbt`).

## Configuration

You can customize the formatter in VS Code settings:

```json
{
  "fubelt.format.enable": true,           // Enable/disable formatting
  "fubelt.format.useTabs": true,          // Use tabs instead of spaces (default: true)
  "fubelt.format.autoCloseTags": true,    // Auto-close tags (default: true)
  "[fubelt]": {
    "editor.formatOnType": true,          // Format as you type
    "editor.formatOnPaste": true,         // Format on paste
    "editor.formatOnSave": false,         // Format on save
    "editor.insertSpaces": false,         // Use tabs, not spaces
    "editor.tabSize": 4                   // Tab display width
  }
}
```

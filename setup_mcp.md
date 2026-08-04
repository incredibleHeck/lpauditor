# Web MCP Installation & Configuration Guide

Model Context Protocol (MCP) servers allow AI assistants (like Cursor, Windsurf, or Claude Desktop) to connect directly to web search, page fetching, and browser rendering tools.

Here are the details on how to install and add the most popular Web MCP servers on your Windows machine.

---

## 1. Popular Web MCP Servers

### A. Fetch MCP (Simplest URL Content Fetcher)
Downloads target web page content, parses the HTML, and returns a clean, structured Markdown representation.
* **NPM Package:** `@modelcontextprotocol/server-fetch`

### B. Brave Search MCP (Real-time Web Searching)
Allows the agent to perform web searches using Brave's API.
* **NPM Package:** `@modelcontextprotocol/server-brave-search`
* **Prerequisite:** Requires a Brave Search API Key (free/paid tier).

### C. Puppeteer MCP (Full Headless Browser)
Provides a headless Chromium browser instance. The agent can click, fill out forms, take screenshots, and extract text from complex Single Page Apps (SPAs).
* **NPM Package:** `@modelcontextprotocol/server-puppeteer`

---

## 2. Configuration for Claude Desktop

If you use the Claude Desktop app, you can configure these servers by modifying your configuration file.

1. Open File Explorer and navigate to:
   `%APPDATA%\Claude`
2. Open or create the file `claude_desktop_config.json`.
3. Add the following config configuration (ensure you replace `YOUR_BRAVE_API_KEY` if you use Brave Search):

```json
{
  "mcpServers": {
    "fetch": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-fetch"
      ]
    },
    "puppeteer": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-puppeteer"
      ]
    },
    "brave-search": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-brave-search"
      ],
      "env": {
        "BRAVE_API_KEY": "YOUR_BRAVE_API_KEY"
      }
    }
  }
}
```

4. **Restart** Claude Desktop to apply the changes.

---

## 3. Configuration for Cursor IDE

If you are using Cursor, you can add them directly in the UI:

1. Open **Cursor Settings** (Gear icon in top right).
2. Go to **Features** -> **MCP**.
3. Click **+ Add New MCP Server**.
4. Enter the details for the tool you want to add:

#### Adding Fetch Tool:
* **Name:** `fetch`
* **Type:** `command`
* **Command:** `npx -y @modelcontextprotocol/server-fetch`

#### Adding Puppeteer Tool:
* **Name:** `puppeteer`
* **Type:** `command`
* **Command:** `npx -y @modelcontextprotocol/server-puppeteer`

#### Adding Brave Search:
* **Name:** `brave-search`
* **Type:** `command`
* **Command:** `npx -y @modelcontextprotocol/server-brave-search`
* **Environment Variables:** `BRAVE_API_KEY=your_key_here`

---

## 4. Troubleshooting
* **Node.js/NPM Missing:** Ensure Node.js is installed. Run `node -v` and `npm -v` in PowerShell to verify.
* **Execution Policies:** If `npx` fails to execute, ensure your terminal is allowed to run script commands.

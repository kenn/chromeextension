# Chrome Extension MCP Server

MCP Server for Chrome Extension API, enabling Claude to interact with Chrome browser extensions.

## Installation

### 1. Install Chrome Extension

#### Using Docker
1. Build and run the Docker container:
```bash
docker build -t mcp/chromeextension -f src/chromeextension/Dockerfile .
docker run -i --rm mcp/chromeextension
```

2. Extract the extension package:
```bash
docker cp $(docker ps -q -f ancestor=mcp/chromeextension):/app/chrome-extension.zip .
```

3. Install in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the extracted extension directory

#### Manual Installation
1. Navigate to the extension directory:
```bash
cd src/chromeextension/extension
```

2. Load in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the extension directory

### 2. Configure MCP Server

Add the following to your `claude_desktop_config.json`:

#### npx

```json
{
  "mcpServers": {
    "chromeextension": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-chrome-extension"
      ],
      "env": {
        "CHROME_EXTENSION_ID": "your-extension-id"
      }
    }
  }
}
```

#### docker

```json
{
  "mcpServers": {
    "chromeextension": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "CHROME_EXTENSION_ID",
        "mcp/chromeextension"
      ],
      "env": {
        "CHROME_EXTENSION_ID": "your-extension-id"
      }
    }
  }
}
```

## Tools

1. `chrome_get_active_tab`
   - Get information about the currently active tab
   - Returns: Active tab information including URL, title, and tab ID
   - Uses Chrome API: `chrome.tabs.query({ active: true, currentWindow: true })`

2. `chrome_get_all_tabs`
   - Get information about all open tabs
   - Returns: List of all open tabs with their information (URL, title, tab ID, etc.)
   - Uses Chrome API: `chrome.tabs.query({})`
   - Also provides real-time tab updates through WebSocket events:
     - `created`: When a new tab is created
     - `updated`: When a tab's content is updated
     - `removed`: When a tab is closed
     - `activated`: When a tab becomes active

3. `chrome_execute_script`
   - Execute DOM operations in the context of a web page
   - Required inputs:
     - `tab_id` (number): The ID of the target tab
     - `operation` (object): DOM operation details
   - Operation Structure:
     ```typescript
     {
       action: string;  // The type of operation to perform
       selector?: string;  // CSS selector for targeting elements
       value?: string | number | boolean;  // Value to set
       attribute?: string;  // Attribute name
       tagName?: string;  // Tag name for createElement
       attributes?: Record<string, string | number | boolean>;  // Element attributes
       innerText?: string;  // Inner text content
       elementId?: string;  // Element ID for appendChild
       message?: string;  // Message for log operation
     }
     ```
   - Supported Operations:
     - `querySelector`: Get element information
       ```json
       {
         "action": "querySelector",
         "selector": "#my-element"
       }
       ```
     - `setText`: Set text content
       ```json
       {
         "action": "setText",
         "selector": "#my-element",
         "value": "New text"
       }
       ```
     - `createElement`: Create new element
       ```json
       {
         "action": "createElement",
         "tagName": "div",
         "attributes": {
           "class": "my-class",
           "data-custom": "value"
         },
         "innerText": "New element"
       }
       ```
     - `click`: Trigger click event on element
       ```json
       {
         "action": "click",
         "selector": "#my-button"
       }
       ```
     - And more: querySelectorAll, setHTML, setAttribute, removeAttribute, addClass, removeClass, toggleClass, appendChild, removeElement, getPageInfo, getElementsInfo, log
   - Returns: Result of the DOM operation
   - Uses Chrome API: `chrome.scripting.executeScript()`

4. `chrome_inject_css`
   - Inject CSS into a web page
   - Required inputs:
     - `tab_id` (number): The ID of the target tab
     - `css` (string): CSS code to inject
   - Returns: Confirmation of CSS injection
   - Uses Chrome API: `chrome.scripting.insertCSS()`

5. `chrome_get_extension_info`
   - Get information about installed extensions
   - Optional inputs:
     - `extension_id` (string): Specific extension ID to query
   - Returns: Extension information including permissions and status
   - Uses Chrome API: `chrome.management.get()` and `chrome.management.getAll()`

6. `chrome_send_message`
   - Send a message to an extension's background script
   - Required inputs:
     - `extension_id` (string): Target extension ID
     - `message` (object): Message payload to send
   - Returns: Response from the extension
   - Uses Chrome API: `chrome.runtime.sendMessage()`

7. `chrome_get_cookies`
   - Get cookies for a specific domain
   - Required inputs:
     - `domain` (string): Domain to get cookies for
   - Returns: List of cookies for the domain
   - Uses Chrome API: `chrome.cookies.get()` and `chrome.cookies.getAll()`

8. `chrome_capture_screenshot`
   - Take a screenshot of the current tab
   - Optional inputs:
     - `tab_id` (number): The ID of the target tab (defaults to active tab)
     - `format` (string): Image format ('png' or 'jpeg', defaults to 'png')
     - `quality` (number): Image quality for jpeg format (0-100)
     - `area` (object): Capture specific area {x, y, width, height}
   - Returns: Base64 encoded image data
   - Uses Chrome API: `chrome.tabs.captureVisibleTab()`

## Setup

1. Create a Chrome Extension:
   - Create a new directory for your extension
   - Create a `manifest.json` file with necessary permissions
   - Implement the required background scripts

2. Required Permissions:
   Your extension's manifest.json needs these permissions:
   ```json
   {
     "permissions": [
       "activeTab",
       "scripting",
       "cookies",
       "management",
       "tabs"
     ]
   }
   ```

3. Install Extension:
   - Load your extension in Chrome's developer mode
   - Note the extension ID for configuration

### Usage with Claude Desktop

Add the following to your `claude_desktop_config.json`:

#### npx

```json
{
  "mcpServers": {
    "chromeextension": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-chrome-extension"
      ],
      "env": {
        "CHROME_EXTENSION_ID": "your-extension-id"
      }
    }
  }
}
```

#### docker

```json
{
  "mcpServers": {
    "chromeextension": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "CHROME_EXTENSION_ID",
        "mcp/chromeextension"
      ],
      "env": {
        "CHROME_EXTENSION_ID": "your-extension-id"
      }
    }
  }
}
```

### Troubleshooting

If you encounter issues, verify that:
1. The Chrome extension is properly installed and enabled
2. All required permissions are correctly specified in manifest.json
3. The extension ID is correctly configured
4. The browser is running and accessible

## Build

Docker build:

```bash
docker build -t mcp/chromeextension -f src/chromeextension/Dockerfile .
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository. 
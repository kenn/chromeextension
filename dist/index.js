#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer } from 'ws';
const PORT = 8765;
const wss = new WebSocketServer({ port: PORT });
let activeConnection = null;
// Tool definitions
const getActiveTabTool = {
    name: "chrome_get_active_tab",
    description: "Get information about the currently active tab",
    inputSchema: {
        type: "object",
        properties: {},
    },
};
const getAllTabsTool = {
    name: "chrome_get_all_tabs",
    description: "Get information about all open tabs",
    inputSchema: {
        type: "object",
        properties: {},
    },
};
const executeScriptTool = {
    name: "chrome_execute_script",
    description: "Execute JavaScript code in the context of a web page",
    inputSchema: {
        type: "object",
        properties: {
            tab_id: {
                type: "number",
                description: "The ID of the target tab",
            },
            code: {
                type: "string",
                description: "JavaScript code to execute",
            },
        },
        required: ["tab_id", "code"],
    },
};
const injectCssTool = {
    name: "chrome_inject_css",
    description: "Inject CSS into a web page",
    inputSchema: {
        type: "object",
        properties: {
            tab_id: {
                type: "number",
                description: "The ID of the target tab",
            },
            css: {
                type: "string",
                description: "CSS code to inject",
            },
        },
        required: ["tab_id", "css"],
    },
};
const getExtensionInfoTool = {
    name: "chrome_get_extension_info",
    description: "Get information about installed extensions",
    inputSchema: {
        type: "object",
        properties: {
            extension_id: {
                type: "string",
                description: "Specific extension ID to query",
            },
        },
    },
};
const sendMessageTool = {
    name: "chrome_send_message",
    description: "Send a message to an extension's background script",
    inputSchema: {
        type: "object",
        properties: {
            extension_id: {
                type: "string",
                description: "Target extension ID",
            },
            message: {
                type: "object",
                description: "Message payload to send",
            },
        },
        required: ["extension_id", "message"],
    },
};
const getCookiesTool = {
    name: "chrome_get_cookies",
    description: "Get cookies for a specific domain",
    inputSchema: {
        type: "object",
        properties: {
            domain: {
                type: "string",
                description: "Domain to get cookies for",
            },
        },
        required: ["domain"],
    },
};
const captureScreenshotTool = {
    name: "chrome_capture_screenshot",
    description: "Take a screenshot of the current tab",
    inputSchema: {
        type: "object",
        properties: {
            tab_id: {
                type: "number",
                description: "The ID of the target tab (defaults to active tab)",
            },
            format: {
                type: "string",
                description: "Image format ('png' or 'jpeg', defaults to 'png')",
                enum: ["png", "jpeg"],
                default: "png",
            },
            quality: {
                type: "number",
                description: "Image quality for jpeg format (0-100)",
                minimum: 0,
                maximum: 100,
            },
            area: {
                type: "object",
                description: "Capture specific area",
                properties: {
                    x: { type: "number" },
                    y: { type: "number" },
                    width: { type: "number" },
                    height: { type: "number" },
                },
                required: ["x", "y", "width", "height"],
            },
        },
    },
};
const createTabTool = {
    name: "chrome_create_tab",
    description: "Create a new tab with specified URL and options",
    inputSchema: {
        type: "object",
        properties: {
            url: {
                type: "string",
                description: "URL to open in the new tab",
            },
            active: {
                type: "boolean",
                description: "Whether the new tab should be active",
                default: true,
            },
            index: {
                type: "number",
                description: "The position the tab should take in the window",
            },
            windowId: {
                type: "number",
                description: "The window to create the new tab in",
            },
        },
    },
};
// Create MCP server
const server = new Server({
    name: "chrome-extension-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Handle WebSocket connections from Chrome extension
wss.on('connection', (ws) => {
    activeConnection = ws;
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            // ハートビートメッセージの処理
            if (message.type === 'heartbeat') {
                ws.send(JSON.stringify({ type: 'heartbeat_response' }));
                return;
            }
            // ハートビートレスポンスの処理
            if (message.type === 'heartbeat_response') {
                return;
            }
            // その他のメッセージは通常通り処理
            console.log(data.toString());
        }
        catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
            }));
        }
    });
    ws.on('close', () => {
        if (activeConnection === ws) {
            activeConnection = null;
        }
    });
    ws.on('error', (error) => {
        console.error(JSON.stringify({
            status: 'error',
            error: error.message
        }));
    });
});
// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        getActiveTabTool,
        getAllTabsTool,
        executeScriptTool,
        injectCssTool,
        getExtensionInfoTool,
        sendMessageTool,
        getCookiesTool,
        captureScreenshotTool,
        createTabTool,
    ],
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!request.params.arguments) {
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: 'error',
                        error: 'No arguments provided'
                    })
                }],
            isError: true
        };
    }
    if (!activeConnection) {
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: 'error',
                        error: 'No active Chrome extension connection'
                    })
                }],
            isError: true
        };
    }
    try {
        const connection = activeConnection; // キャプチャして型安全性を確保
        // Chrome拡張機能からの応答を待つPromiseを作成
        const response = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for Chrome extension response'));
            }, 30000); // 30秒タイムアウト
            const messageHandler = (data) => {
                clearTimeout(timeout);
                connection.removeListener('message', messageHandler);
                resolve(data.toString());
            };
            connection.on('message', messageHandler);
            // リクエストを Chrome 拡張機能に送信
            connection.send(JSON.stringify({
                tool: request.params.name,
                arguments: request.params.arguments
            }));
        });
        return {
            content: [{
                    type: "text",
                    text: response
                }]
        };
    }
    catch (error) {
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: 'error',
                        error: error instanceof Error ? error.message : 'Unknown error'
                    })
                }],
            isError: true
        };
    }
});
// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Chrome Extension MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});

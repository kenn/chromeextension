#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'
import WebSocket from 'ws'
import { WebSocketServer } from 'ws'
import type { RawData } from 'ws'

const PORT = 8765
const wss = new WebSocketServer({ port: PORT })
let activeConnection: WebSocket | null = null

// Tool definitions
const getActiveTabTool: Tool = {
  name: 'chrome_get_active_tab',
  description: 'Get information about the currently active tab',
  inputSchema: {
    type: 'object',
    properties: {},
  },
}

const getAllTabsTool: Tool = {
  name: 'chrome_get_all_tabs',
  description: 'Get information about all open tabs',
  inputSchema: {
    type: 'object',
    properties: {},
  },
}

const executeScriptTool: Tool = {
  name: 'chrome_execute_script',
  description: 'Execute DOM operations in the context of a web page',
  inputSchema: {
    type: 'object',
    properties: {
      tab_id: {
        type: 'number',
        description: 'The ID of the target tab',
      },
      operation: {
        type: 'object',
        description: 'DOM operation details',
        required: ['action'],
        properties: {
          action: {
            type: 'string',
            enum: [
              'querySelector',
              'querySelectorAll',
              'setText',
              'setHTML',
              'setAttribute',
              'removeAttribute',
              'addClass',
              'removeClass',
              'toggleClass',
              'createElement',
              'appendChild',
              'removeElement',
              'getPageInfo',
              'getElementsInfo',
              'log',
              'click',
            ],
            description: 'The type of DOM operation to perform',
          },
          selector: {
            type: 'string',
            description: 'CSS selector for targeting elements',
          },
          value: {
            type: ['string', 'number', 'boolean'],
            description:
              'Value to set (for setText, setHTML, setAttribute, etc.)',
          },
          attribute: {
            type: 'string',
            description:
              'Attribute name for setAttribute/removeAttribute operations',
          },
          tagName: {
            type: 'string',
            description: 'Tag name for createElement operation',
          },
          attributes: {
            type: 'object',
            description: 'Attributes for createElement operation',
            additionalProperties: {
              type: ['string', 'number', 'boolean'],
            },
          },
          innerText: {
            type: 'string',
            description: 'Inner text for createElement operation',
          },
          elementId: {
            type: 'string',
            description: 'Element ID for appendChild operation',
          },
          message: {
            type: 'string',
            description: 'Message for log operation',
          },
        },
        allOf: [
          {
            if: { properties: { action: { const: 'querySelector' } } },
            then: { required: ['selector'] },
          },
          {
            if: { properties: { action: { const: 'querySelectorAll' } } },
            then: { required: ['selector'] },
          },
          {
            if: { properties: { action: { const: 'setText' } } },
            then: { required: ['selector', 'value'] },
          },
          {
            if: { properties: { action: { const: 'setHTML' } } },
            then: { required: ['selector', 'value'] },
          },
          {
            if: { properties: { action: { const: 'setAttribute' } } },
            then: { required: ['selector', 'attribute', 'value'] },
          },
          {
            if: { properties: { action: { const: 'removeAttribute' } } },
            then: { required: ['selector', 'attribute'] },
          },
          {
            if: { properties: { action: { const: 'addClass' } } },
            then: { required: ['selector', 'value'] },
          },
          {
            if: { properties: { action: { const: 'removeClass' } } },
            then: { required: ['selector', 'value'] },
          },
          {
            if: { properties: { action: { const: 'toggleClass' } } },
            then: { required: ['selector', 'value'] },
          },
          {
            if: { properties: { action: { const: 'createElement' } } },
            then: { required: ['tagName'] },
          },
          {
            if: { properties: { action: { const: 'appendChild' } } },
            then: { required: ['selector', 'elementId'] },
          },
          {
            if: { properties: { action: { const: 'removeElement' } } },
            then: { required: ['selector'] },
          },
          {
            if: { properties: { action: { const: 'getElementsInfo' } } },
            then: { required: ['selector'] },
          },
          {
            if: { properties: { action: { const: 'log' } } },
            then: { required: ['message'] },
          },
          {
            if: { properties: { action: { const: 'click' } } },
            then: { required: ['selector'] },
          },
        ],
      },
    },
    required: ['tab_id', 'operation'],
  },
}

const injectCssTool: Tool = {
  name: 'chrome_inject_css',
  description: 'Inject CSS into a web page',
  inputSchema: {
    type: 'object',
    properties: {
      tab_id: {
        type: 'number',
        description: 'The ID of the target tab',
      },
      css: {
        type: 'string',
        description: 'CSS code to inject',
      },
    },
    required: ['tab_id', 'css'],
  },
}

const getExtensionInfoTool: Tool = {
  name: 'chrome_get_extension_info',
  description: 'Get information about installed extensions',
  inputSchema: {
    type: 'object',
    properties: {
      extension_id: {
        type: 'string',
        description: 'Specific extension ID to query',
      },
    },
  },
}

const sendMessageTool: Tool = {
  name: 'chrome_send_message',
  description: "Send a message to an extension's background script",
  inputSchema: {
    type: 'object',
    properties: {
      extension_id: {
        type: 'string',
        description: 'Target extension ID',
      },
      message: {
        type: 'object',
        description: 'Message payload to send',
      },
    },
    required: ['extension_id', 'message'],
  },
}

const getCookiesTool: Tool = {
  name: 'chrome_get_cookies',
  description: 'Get cookies for a specific domain',
  inputSchema: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'Domain to get cookies for',
      },
    },
    required: ['domain'],
  },
}

const captureScreenshotTool: Tool = {
  name: 'chrome_capture_screenshot',
  description: 'Take a screenshot of the current tab',
  inputSchema: {
    type: 'object',
    properties: {
      tab_id: {
        type: 'number',
        description: 'The ID of the target tab (defaults to active tab)',
      },
      format: {
        type: 'string',
        description: "Image format ('png' or 'jpeg', defaults to 'png')",
        enum: ['png', 'jpeg'],
        default: 'png',
      },
      quality: {
        type: 'number',
        description: 'Image quality for jpeg format (0-100)',
        minimum: 0,
        maximum: 100,
      },
      area: {
        type: 'object',
        description: 'Capture specific area',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
        },
        required: ['x', 'y', 'width', 'height'],
      },
    },
  },
}

const createTabTool: Tool = {
  name: 'chrome_create_tab',
  description: 'Create a new tab with specified URL and options',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to open in the new tab',
      },
      active: {
        type: 'boolean',
        description: 'Whether the new tab should be active',
        default: true,
      },
      index: {
        type: 'number',
        description: 'The position the tab should take in the window',
      },
      windowId: {
        type: 'number',
        description: 'The window to create the new tab in',
      },
    },
  },
}

// Create MCP server
const server = new Server(
  {
    name: 'chrome-extension-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Handle WebSocket connections from Chrome extension
wss.on('connection', (ws: WebSocket) => {
  activeConnection = ws

  ws.on('message', (data: RawData) => {
    try {
      const message = JSON.parse(data.toString())

      // ハートビートメッセージの処理
      if (message.type === 'heartbeat') {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            method: 'heartbeat',
            result: { type: 'heartbeat_response' },
          })
        )
        return
      }

      // ハートビートレスポンスの処理
      if (message.type === 'heartbeat_response') {
        return
      }

      // その他のメッセージは通常通り処理
      console.log(data.toString())
    } catch (error) {
      console.error('Error processing message:', error)
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'error',
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        })
      )
    }
  })

  ws.on('close', () => {
    if (activeConnection === ws) {
      activeConnection = null
    }
  })

  ws.on('error', (error: Error) => {
    console.error(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'error',
        error: {
          code: -32603,
          message: error.message,
        },
      })
    )
  })
})

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
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const requestId = Math.floor(Math.random() * 1000000)

  if (!request.params.arguments) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            jsonrpc: '2.0',
            method: request.params.name,
            error: {
              code: -32602,
              message: 'No arguments provided',
            },
          }),
        },
      ],
      isError: true,
    }
  }

  if (!activeConnection) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            jsonrpc: '2.0',
            method: request.params.name,
            error: {
              code: -32603,
              message: 'No active Chrome extension connection',
            },
          }),
        },
      ],
      isError: true,
    }
  }

  try {
    const connection = activeConnection
    const response = await new Promise<{
      content: Array<{
        type: 'text'
        text: string
      }>
      _meta: Record<string, unknown>
      isError?: boolean
    }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for Chrome extension response'))
      }, 30000)

      const messageHandler = (data: RawData) => {
        clearTimeout(timeout)
        connection.removeListener('message', messageHandler)
        try {
          const parsedResponse = JSON.parse(data.toString())
          resolve({
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(parsedResponse),
              },
            ],
            _meta: {},
            isError: false,
          })
        } catch (error) {
          reject(error)
        }
      }

      connection.on('message', messageHandler)

      // リクエストを送信
      connection.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: `${request.params.name}_${Date.now()}`,
          method: request.params.name,
          params: request.params.arguments,
        })
      )
    })

    return response
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      ],
      _meta: {},
      isError: true,
    }
  }
})

// Start server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Chrome Extension MCP Server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error running server:', error)
  process.exit(1)
})

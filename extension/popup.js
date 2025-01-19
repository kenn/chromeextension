// Get connection status from background script
chrome.runtime.sendMessage({ type: 'getConnectionStatus' }, (response) => {
  updateConnectionStatus(response.isConnected);
  if (response.lastMessage) {
    updateLastMessage(response.lastMessage);
  }
});

// Listen for status updates from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'connectionStatus') {
    updateConnectionStatus(message.isConnected);
  }
  if (message.type === 'newMessage') {
    updateLastMessage(message.data);
  }
});

function updateConnectionStatus(isConnected) {
  const statusElement = document.getElementById('connectionStatus');
  if (isConnected) {
    statusElement.textContent = 'Connected to MCP Server';
    statusElement.className = 'status connected';
  } else {
    statusElement.textContent = 'Disconnected from MCP Server';
    statusElement.className = 'status disconnected';
  }
}

function updateLastMessage(message) {
  const messageElement = document.getElementById('lastMessage');
  messageElement.textContent = typeof message === 'string' ? message : JSON.stringify(message);
} 
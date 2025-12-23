// src/extension.ts
import * as vscode from 'vscode';
import { scanDirectory, generateContext } from './core';

export function activate(context: vscode.ExtensionContext) {
    console.log('>>> 🚀 EXTENSION IS ACTIVATING <<<');

    let disposable = vscode.commands.registerCommand('cntxtify.generateContext', async (uri: vscode.Uri) => {
        
        if (!uri) {
            vscode.window.showErrorMessage('Please right-click a folder to use this command.');
            return;
        }

        try {
            const scanData = await scanDirectory(uri.fsPath);

            const panel = vscode.window.createWebviewPanel(
                'cntxtifyConfig',
                'Generate Context',
                vscode.ViewColumn.Beside, 
                { 
                    enableScripts: true,
                    retainContextWhenHidden: true 
                }
            );

            panel.webview.html = getWebviewContent(scanData, uri.fsPath);

            panel.webview.onDidReceiveMessage(async (message) => {
                if (message.command === 'generate') {
                    try {
                        vscode.window.showInformationMessage('Generating Context... please wait.');
                        
                        const result = await generateContext(uri.fsPath, message.config);
                        
                        panel.webview.postMessage({ 
                            command: 'displayResult', 
                            result: result 
                        });
                        
                        vscode.window.showInformationMessage('Context Generated Successfully!');
                    } catch (err: any) {
                        vscode.window.showErrorMessage('Error generating context: ' + err.message);
                    }
                }
            });

        } catch (error: any) {
            console.error(error);
            vscode.window.showErrorMessage('Failed to scan directory: ' + error.message);
        }
    });

    context.subscriptions.push(disposable);
}

// UI Template
function getWebviewContent(scanData: any, folderPath: string) {
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Context Configuration</title>
      <style>
          body { 
              font-family: var(--vscode-font-family); 
              color: var(--vscode-foreground); 
              background-color: var(--vscode-editor-background); 
              padding: 15px; 
          }
          h2 { font-size: 14px; text-transform: uppercase; opacity: 0.8; margin-bottom: 10px; }
          
          /* Sections */
          .section { margin-bottom: 15px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; overflow: hidden; }
          .section-header { 
              background: var(--vscode-sideBar-background); 
              padding: 8px 10px; 
              cursor: pointer; 
              font-weight: bold; 
              display: flex; 
              justify-content: space-between; 
              font-size: 12px;
          }
          .section-content { padding: 5px 10px; display: block; max-height: 200px; overflow-y: auto; }
          .hidden { display: none; }
          
          /* Rows */
          .row { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--vscode-input-border); }
          .label { flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .controls { display: flex; gap: 10px; }
          .checkbox-group { display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer; }
          
          /* Buttons */
          button {
              width: 100%; 
              padding: 10px; 
              border: none; 
              cursor: pointer; 
              font-size: 13px; 
              border-radius: 2px;
              margin-bottom: 8px;
              font-weight: 600;
              transition: background 0.3s;
          }
          
          #generateBtn {
              background: var(--vscode-button-background); 
              color: var(--vscode-button-foreground); 
              margin-top: 15px;
          }
          #generateBtn:hover { background: var(--vscode-button-hoverBackground); }
          
          /* Copy Button Styling - Default State */
          #copyBtn {
              color: white;
              display: none; 
          }
          #copyBtn:hover { filter: brightness(1.1); }

          /* Token Tips */
          #token-tip {
            font-size: 11px;
            margin-bottom: 15px;
            text-align: center;
            font-style: italic;
            opacity: 0.9;
            display: none;
          }

          /* Result Area */
          textarea { 
              width: 100%; 
              height: 250px; 
              background: var(--vscode-input-background); 
              color: var(--vscode-input-foreground); 
              border: 1px solid var(--vscode-input-border); 
              font-family: 'Courier New', monospace;
              font-size: 11px;
              resize: vertical;
          }
      </style>
  </head>
  <body>
      <h3 style="margin-top:0">Context Generator</h3>
      <p style="font-size: 11px; opacity: 0.7; word-break: break-all;">Target: ${folderPath}</p>
  
      <div class="section">
          <div class="section-header" onclick="toggleSection('folders-content')">
              <span>📂 Subdirectories</span> <span>▼</span>
          </div>
          <div id="folders-content" class="section-content">
              <div id="folder-list"></div>
          </div>
      </div>
  
      <div class="section">
          <div class="section-header" onclick="toggleSection('extensions-content')">
              <span>📄 File Extensions</span> <span>▼</span>
          </div>
          <div id="extensions-content" class="section-content">
              <div id="extension-list"></div>
          </div>
      </div>
  
      <button id="generateBtn" onclick="generate()">Generate Context</button>
      
      <!-- Copy Button & Tip -->
      <button id="copyBtn" onclick="copyToClipboard()">Copy to Clipboard</button>
      <div id="token-tip"></div>
      
      <div id="result-area" class="hidden">
          <div style="font-size:11px; margin-bottom:4px; opacity:0.8;">Output Preview:</div>
          <textarea id="output" readonly></textarea>
      </div>
  
      <script>
          const vscode = acquireVsCodeApi();
          const scanData = ${JSON.stringify(scanData)};
  
          // Initialize UI
          const folderList = document.getElementById('folder-list');
          const extList = document.getElementById('extension-list');
  
          function createRow(name, type) {
              const div = document.createElement('div');
              div.className = 'row';
              div.innerHTML = \`
                  <span class="label" title="\${name}">\${name}</span>
                  <div class="controls">
                      <label class="checkbox-group">
                          <input type="checkbox" id="\${type}-\${name}-tree" checked onchange="handleToggle('\${type}', '\${name}', 'tree')">
                          Tree
                      </label>
                      <label class="checkbox-group">
                          <input type="checkbox" id="\${type}-\${name}-content" checked onchange="handleToggle('\${type}', '\${name}', 'content')">
                          Content
                      </label>
                  </div>
              \`;
              return div;
          }
  
          scanData.folders.forEach(f => folderList.appendChild(createRow(f, 'folder')));
          scanData.extensions.forEach(e => extList.appendChild(createRow(e, 'ext')));
  
          function handleToggle(type, name, action) {
              const treeCb = document.getElementById(\`\${type}-\${name}-tree\`);
              const contentCb = document.getElementById(\`\${type}-\${name}-content\`);
  
              if (action === 'tree' && !treeCb.checked) {
                  contentCb.checked = false;
                  contentCb.disabled = true;
              } else if (action === 'tree' && treeCb.checked) {
                  contentCb.disabled = false;
                  contentCb.checked = true; 
              }
          }
  
          function toggleSection(id) {
              const el = document.getElementById(id);
              el.classList.toggle('hidden');
          }
  
          function generate() {
              const config = { folders: {}, extensions: {} };
              scanData.folders.forEach(f => {
                  config.folders[f] = {
                      tree: document.getElementById(\`folder-\${f}-tree\`).checked,
                      content: document.getElementById(\`folder-\${f}-content\`).checked
                  };
              });
              scanData.extensions.forEach(e => {
                  config.extensions[e] = {
                      tree: document.getElementById(\`ext-\${e}-tree\`).checked,
                      content: document.getElementById(\`ext-\${e}-content\`).checked
                  };
              });
              
              document.getElementById('generateBtn').innerText = 'Generating...';
              vscode.postMessage({ command: 'generate', config: config });
          }
  
          window.addEventListener('message', event => {
              const message = event.data;
              if (message.command === 'displayResult') {
                  document.getElementById('generateBtn').innerText = 'Generate Context';
                  document.getElementById('result-area').classList.remove('hidden');
                  
                  // Setup Copy Button
                  const copyBtn = document.getElementById('copyBtn');
                  const tipDiv = document.getElementById('token-tip');
                  copyBtn.style.display = 'block';
                  tipDiv.style.display = 'block';
                  
                  let outputText = '';
                  let tokenCount = 0;
                  
                  if (typeof message.result === 'object' && message.result.output) {
                      outputText = message.result.output;
                      tokenCount = message.result.tokens || 0;
                      
                      // LOGIC: Token Coloring and Models
                      let color = '';
                      let tag = '';
                      let modelText = '';

                      if (tokenCount < 6000) {
                          // Green - Low
                          color = '#2da44e'; 
                          tag = 'LOW';
                          modelText = '✅ Fits all models (GPT-3.5, Llama 3, Standard Claude)';
                      } else if (tokenCount < 25000) {
                          // Orange - Moderate
                          color = '#d29922'; 
                          tag = 'MODERATE';
                          modelText = '⚠️ Good for GPT-4, Claude 3.5 Sonnet, or Gemini Pro';
                      } else {
                          // Red - High
                          color = '#cf222e'; 
                          tag = 'HIGH';
                          modelText = '🔥 Requires large context models (Claude 3 Opus, Gemini 1.5, GPT-4 Turbo)';
                      }

                      copyBtn.style.backgroundColor = color;
                      copyBtn.innerHTML = \`Copy to Clipboard (\${tokenCount} tokens) &nbsp; <span style="background:rgba(0,0,0,0.2); padding:0 4px; border-radius:3px;">\${tag}</span>\`;
                      
                      tipDiv.style.color = color;
                      tipDiv.innerText = modelText;

                  } else {
                      outputText = typeof message.result === 'string' ? message.result : JSON.stringify(message.result, null, 2);
                      copyBtn.innerText = 'Copy to Clipboard';
                      copyBtn.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
                      tipDiv.style.display = 'none';
                  }

                  document.getElementById('output').value = outputText;
              }
          });
  
          function copyToClipboard() {
              const copyText = document.getElementById("output");
              copyText.select();
              document.execCommand("copy");
              
              const btn = document.getElementById('copyBtn');
              const prevHTML = btn.innerHTML;
              btn.innerHTML = '✅ Copied!';
              setTimeout(() => btn.innerHTML = prevHTML, 1500);
          }
      </script>
  </body>
  </html>`;
}

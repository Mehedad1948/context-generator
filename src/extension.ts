// src/extension.ts
import * as vscode from 'vscode';
import { scanDirectory, generateContext } from './core';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('cntxtify.generateContext', async (uri: vscode.Uri) => {
        if (!uri && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            uri = vscode.workspace.workspaceFolders[0].uri;
        }

        if (!uri) {
            vscode.window.showErrorMessage('Please open a folder first.');
            return;
        }

        try {
            const treeData = await scanDirectory(uri.fsPath);

            const panel = vscode.window.createWebviewPanel(
                'cntxtifyConfig',
                'Generate Context',
                vscode.ViewColumn.Beside, 
                { enableScripts: true, retainContextWhenHidden: true }
            );

            panel.webview.html = getWebviewContent(treeData, uri.fsPath);

            panel.webview.onDidReceiveMessage(async (message) => {
                if (message.command === 'generate') {
                    try {
                        vscode.window.showInformationMessage('Generating Context...');
                        const result = await generateContext(uri.fsPath, message.config);
                        
                        panel.webview.postMessage({ 
                            command: 'displayResult', 
                            result: result 
                        });
                    } catch (err: any) {
                        vscode.window.showErrorMessage('Error: ' + err.message);
                    }
                }
            });

        } catch (error: any) {
            vscode.window.showErrorMessage('Failed to scan: ' + error.message);
        }
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent(treeData: any, folderPath: string) {
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Context Config</title>
      <style>
          :root {
              --tree-hover: var(--vscode-list-hoverBackground);
              --border: var(--vscode-panel-border);
              --btn-bg: var(--vscode-button-background);
              --btn-fg: var(--vscode-button-foreground);
              --btn-hover: var(--vscode-button-hoverBackground);
          }
          body { 
              font-family: var(--vscode-font-family); 
              color: var(--vscode-foreground); 
              background-color: var(--vscode-editor-background); 
              padding: 20px; 
              max-width: 900px;
              margin: 0 auto;
          }

          h3 { margin-top: 0; opacity: 0.9; }

          /* Section containers */
          .section { margin-bottom: 20px; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
          .section-header { 
            background: var(--vscode-sideBar-background); padding: 8px 12px; 
            font-weight: bold; border-bottom: 1px solid var(--border);
            display: flex; justify-content: space-between; align-items: center;
          }

          /* 1. Prompt Area */
          #prompt-area textarea {
            width: 100%; height: 80px; padding: 10px; border: none; resize: vertical;
            background: var(--vscode-input-background); color: var(--vscode-input-foreground);
            font-family: inherit; box-sizing: border-box;
          }
          .prompt-options { padding: 8px 12px; font-size: 0.9em; background: rgba(127,127,127,0.05); }

          /* 2. Tree */
          ul { list-style: none; padding-left: 0; margin: 0; }
          li { margin: 0; }
          .node-row {
              display: flex; align-items: center; padding: 4px 10px;
              border-bottom: 1px solid var(--vscode-tree-indentGuidesStroke); 
              transition: background 0.1s;
          }
          .node-row:hover { background-color: var(--tree-hover); }
          ul ul { padding-left: 20px; border-left: 1px solid var(--vscode-tree-indentGuidesStroke); }

          .node-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; user-select: none; flex: 1; }
          .node-icon { margin-right: 5px; opacity: 0.8; font-size: 14px;}
          .checkbox-group { display: flex; gap: 10px; margin-left: 10px; }
          .cb-wrapper { display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer; }
          
          details > summary { list-style: none; cursor: pointer; }
          details > summary::-webkit-details-marker { display: none; }
          .arrow { display: inline-block; width: 16px; text-align: center; transition: transform 0.2s; font-size: 10px; opacity: 0.7; }
          details[open] > summary .arrow { transform: rotate(90deg); }
          .spacer { width: 16px; display: inline-block; }

          /* 3. Extension Filter Grid */
          #ext-grid { 
            display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); 
            gap: 8px; padding: 10px; 
          }
          .ext-card {
            background: rgba(127,127,127,0.1); border-radius: 4px; padding: 6px 10px;
            display: flex; justify-content: space-between; align-items: center; font-size: 0.9em;
          }
          .ext-name { font-weight: bold; }
          .ext-btns { display: flex; gap: 8px; }
          .ext-cb-wrapper { display: flex; align-items: center; gap: 3px; font-size: 11px; cursor: pointer; user-select: none; }

          /* 4. Controls & Footer */
          .main-btn {
              width: 100%; padding: 12px; border: none; cursor: pointer; 
              background: var(--btn-bg); color: var(--btn-fg);
              font-weight: 600; border-radius: 2px; font-size: 1.1em;
          }
          .main-btn:hover { background: var(--btn-hover); }

          /* Copy Button & Colors */
          #copy-container { margin-top: 15px; display: none; gap: 10px; }
          #copyBtn { 
            flex: 1; padding: 10px; border: none; cursor: pointer; color: white; font-weight: bold; border-radius: 2px; 
          }
          .tok-green { background-color: #2da44e; }
          .tok-yellow { background-color: #d29922; }
          .tok-red { background-color: #cf222e; }

          /* Result Area */
          #result-container { margin-top: 15px; display: none; }
          #output { 
              width: 100%; height: 300px; 
              background: var(--vscode-input-background); 
              color: var(--vscode-input-foreground); 
              border: 1px solid var(--border);
              font-family: 'Courier New', monospace;
              padding: 10px;
              box-sizing: border-box;
          }
          .result-label { font-size: 0.9em; margin-bottom: 5px; opacity: 0.8; font-weight: bold; }
      </style>
  </head>
  <body>
      <h3>Target: <span style="font-weight:normal; opacity:0.8; font-size: 0.9em">${folderPath}</span></h3>
      
      <!-- 1. Prompt Section -->
      <div class="section">
        <div class="section-header">1. User Instructions</div>
        <div id="prompt-area">
            <textarea id="promptInput" placeholder="E.g., 'Focus on the authentication logic and explain how the login flow works.'"></textarea>
           
        </div>
      </div>

      <!-- 2. Tree Section -->
      <div class="section">
          <div class="section-header">
             <span>2. Project Structure</span>
             <span style="font-size:11px; opacity:0.7">T = Tree | C = Content</span>
          </div>
          <div id="tree-container"></div>
      </div>

      <!-- 3. Extension Filter Section -->
      <div class="section">
          <div class="section-header">
            <span>3. Filter by Extension</span>
            <span style="font-size:10px; opacity:0.7">Select/Deselect All</span>
          </div>
          <div id="ext-grid">
             <!-- Populated by JS -->
          </div>
      </div>

      <button id="generateBtn" class="main-btn" onclick="generate()">Generate Context</button>
      
      <div id="copy-container">
          <button id="copyBtn">Copy to Clipboard (<span id="token-display">0</span> tokens)</button>
      </div>

      <div id="result-container">
          <div class="result-label">Generated Context:</div>
          <textarea id="output" readonly></textarea>
      </div>

      <script>
          const vscode = acquireVsCodeApi();
          const treeData = ${JSON.stringify(treeData)};
          const fileExtensions = new Set();

          const container = document.getElementById('tree-container');

          // --- 1. RENDER TREE ---
          function renderTree(nodes, isRoot = false) {
              const ul = document.createElement('ul');
              
              nodes.forEach(node => {
                  const li = document.createElement('li');
                  const isFolder = node.type === 'folder';
                  const pathId = node.path.replace(/['"]/g, "");

                  // Collect extension for filter grid
                  let ext = 'file'; 
                  if (!isFolder) {
                      const parts = node.name.split('.');
                      ext = parts.length > 1 ? '.' + parts.pop() : 'no-ext';
                      fileExtensions.add(ext);
                  }

                  // HTML for Checkboxes
                  const controls = \`
                      <div class="checkbox-group">
                        <label class="cb-wrapper" title="Include in Tree">
                           <input type="checkbox" class="cb-tree" data-path="\${node.path}" data-ext="\${ext}" checked onchange="toggle('\${node.path}', 'tree', this.checked)"> T
                        </label>
                        <label class="cb-wrapper" title="Include Content">
                           <input type="checkbox" class="cb-content" data-path="\${node.path}" data-ext="\${ext}" checked onchange="toggle('\${node.path}', 'content', this.checked)"> C
                        </label>
                      </div>
                  \`;

                  const icon = isFolder ? '📂' : '📄';
                  const arrowOrSpacer = isFolder ? '<span class="arrow">▶</span>' : '<span class="spacer"></span>';
                  
                  const rowContent = \`
                      <div class="node-row \${isFolder ? 'folder-row' : 'file-row'}" id="row-\${pathId}">
                          \${arrowOrSpacer}
                          <span class="node-icon">\${icon}</span>
                          <span class="node-name" title="\${node.path}">\${node.name}</span>
                          \${controls}
                      </div>
                  \`;

                  if (isFolder) {
                      // Subfolders closed by default (only root stays open if you want, but user said closed by default)
                      const isOpen = isRoot ? 'open' : ''; 
                      
                      li.innerHTML = \`
                          <details \${isOpen}>
                              <summary>\${rowContent}</summary>
                              <div class="children-container" id="children-\${pathId}"></div>
                          </details>
                      \`;
                      setTimeout(() => {
                          const childContainer = document.getElementById('children-' + pathId);
                          if(node.children) childContainer.appendChild(renderTree(node.children, false));
                      }, 0);
                  } else {
                      li.innerHTML = rowContent;
                  }
                  ul.appendChild(li);
              });
              return ul;
          }

          // Initial Render
          container.appendChild(renderTree(treeData, true));

          // --- 2. RENDER EXTENSION FILTERS ---
          setTimeout(() => {
              const grid = document.getElementById('ext-grid');
              const sortedExts = Array.from(fileExtensions).sort();
              
              if(sortedExts.length === 0) {
                  grid.innerHTML = '<div style="padding:5px; opacity:0.7">No files found.</div>';
              } else {
                  sortedExts.forEach(ext => {
                      const div = document.createElement('div');
                      div.className = 'ext-card';
                      // Note: We start CHECKED because the tree starts CHECKED
                      div.innerHTML = \`
                          <span class="ext-name">\${ext}</span>
                          <div class="ext-btns">
                              <label class="ext-cb-wrapper">
                                <input type="checkbox" class="ext-cb-tree" data-ext="\${ext}" checked onchange="bulkToggle('\${ext}', 'tree', this.checked)"> T
                              </label>
                              <label class="ext-cb-wrapper">
                                <input type="checkbox" class="ext-cb-content" data-ext="\${ext}" checked onchange="bulkToggle('\${ext}', 'content', this.checked)"> C
                              </label>
                          </div>
                      \`;
                      grid.appendChild(div);
                  });
              }
          }, 100);


          // --- 3. TOGGLE LOGIC ---

          // Bulk Toggle by Extension
          window.bulkToggle = (ext, type, isChecked) => {
              // Find all inputs with this extension data attribute
              const inputs = document.querySelectorAll(\`input[data-ext="\${ext}"].cb-\${type}\`);
              inputs.forEach(inp => {
                  inp.checked = isChecked;
                  toggle(inp.dataset.path, type, isChecked); // Trigger logic cascade
              });
          };

          // Individual Toggle
          window.toggle = (path, kind, isChecked) => {
              // Dependency Logic
              if (kind === 'tree' && !isChecked) updateCheckbox(path, 'content', false);
              if (kind === 'content' && isChecked) updateCheckbox(path, 'tree', true);

              // Cascade down (folders)
              const allInputs = document.querySelectorAll(\`input[data-path^="\${path}/"]\`);
              if(allInputs.length > 0) {
                  allInputs.forEach(input => {
                     if (input.classList.contains('cb-' + kind)) {
                         input.checked = isChecked;
                         if (kind === 'tree' && !isChecked) {
                             const sibling = input.parentElement.parentElement.querySelector('.cb-content');
                             if(sibling) sibling.checked = false;
                         }
                         if (kind === 'content' && isChecked) {
                             const sibling = input.parentElement.parentElement.querySelector('.cb-tree');
                             if(sibling) sibling.checked = true;
                         }
                     }
                  });
              }
          }

          function updateCheckbox(path, kind, value) {
              const el = document.querySelector(\`input[data-path="\${path}"].cb-\${kind}\`);
              if (el) el.checked = value;
          }

          // --- 4. GENERATE & COPY ---
          function generate() {
              const config = { 
                  selections: {},
                  userPrompt: document.getElementById('promptInput').value,
                  includeReadme: document.getElementById('readmeCheck').checked
              };
              
              const allInputs = document.querySelectorAll('.cb-tree'); 
              allInputs.forEach(treeInput => {
                  const path = treeInput.getAttribute('data-path');
                  const contentInput = document.querySelector(\`input[data-path="\${path}"].cb-content\`);
                  config.selections[path] = {
                      tree: treeInput.checked,
                      content: contentInput ? contentInput.checked : false
                  };
              });

              vscode.postMessage({ command: 'generate', config: config });
              const btn = document.getElementById('generateBtn');
              btn.innerText = 'Generating...';
              btn.disabled = true;
          }

          // Copy Logic
          document.getElementById('copyBtn').addEventListener('click', () => {
             const text = document.getElementById('output').value;
             navigator.clipboard.writeText(text);
             const btn = document.getElementById('copyBtn');
             const prev = btn.innerHTML;
             btn.innerText = 'COPIED!';
             setTimeout(() => btn.innerHTML = prev, 2000);
          });

          window.addEventListener('message', event => {
              const message = event.data;
              if (message.command === 'displayResult') {
                  const btn = document.getElementById('generateBtn');
                  btn.innerText = 'Generate Context';
                  btn.disabled = false;

                  const out = document.getElementById('output');
                  out.value = message.result.output;
                  
                  // Show Copy and Result Containers
                  const copyDiv = document.getElementById('copy-container');
                  const resDiv = document.getElementById('result-container');
                  
                  copyDiv.style.display = 'flex';
                  resDiv.style.display = 'block'; // Make textarea visible
                  
                  // Scroll to result
                  copyDiv.scrollIntoView({ behavior: 'smooth' });
                  
                  const tokens = message.result.tokens;
                  document.getElementById('token-display').innerText = tokens;
                  
                  const copyBtn = document.getElementById('copyBtn');
                  copyBtn.className = ''; // Reset
                  if(tokens < 8000) copyBtn.classList.add('tok-green');
                  else if(tokens < 32000) copyBtn.classList.add('tok-yellow');
                  else copyBtn.classList.add('tok-red');
              }
          });
      </script>
  </body>
  </html>`;
}

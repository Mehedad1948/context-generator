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
            // Show scanning message
            vscode.window.setStatusBarMessage('Cntxtify: Scanning directory...', 2000);
            
            const treeData = await scanDirectory(uri.fsPath);

            const panel = vscode.window.createWebviewPanel(
                'cntxtifyConfig',
                'Generate Context',
                vscode.ViewColumn.Beside, 
                { 
                    enableScripts: true, 
                    retainContextWhenHidden: true,
                    localResourceRoots: [] 
                }
            );

            panel.webview.html = getWebviewContent(treeData, uri.fsPath);

            panel.webview.onDidReceiveMessage(async (message) => {
                if (message.command === 'generate') {
                    try {
                        vscode.window.setStatusBarMessage('Cntxtify: Generating...', 2000);
                        
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
    // Escaping JSON to prevent script injection issues with file paths
    const treeDataJson = JSON.stringify(treeData).replace(/</g, '\\u003c');

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

          .section { margin-bottom: 20px; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
          .section-header { 
            background: var(--vscode-sideBar-background); padding: 8px 12px; 
            font-weight: bold; border-bottom: 1px solid var(--border);
            display: flex; justify-content: space-between; align-items: center;
          }

          #prompt-area textarea {
            width: 100%; height: 80px; padding: 10px; border: none; resize: vertical;
            background: var(--vscode-input-background); color: var(--vscode-input-foreground);
            font-family: inherit; box-sizing: border-box;
          }

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

          .main-btn {
              width: 100%; padding: 12px; border: none; cursor: pointer; 
              background: var(--btn-bg); color: var(--btn-fg);
              font-weight: 600; border-radius: 2px; font-size: 1.1em;
          }
          .main-btn:hover { background: var(--btn-hover); }
          .main-btn:disabled { opacity: 0.6; cursor: wait; }

          #copy-container { margin-top: 15px; display: none; gap: 10px; }
          #copyBtn { 
            flex: 1; padding: 10px; border: none; cursor: pointer; color: white; font-weight: bold; border-radius: 2px; 
          }
          .tok-green { background-color: #2da44e; }
          .tok-yellow { background-color: #d29922; }
          .tok-red { background-color: #cf222e; }

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
        <div class="section-header">
            <span>1. User Instructions</span>
            <label class="cb-wrapper" style="font-weight:normal; opacity:0.9;">
               <input type="checkbox" id="readmeCheck"> Include README
            </label>
        </div>
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
          <div id="ext-grid"></div>
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
          const treeData = ${treeDataJson};
          const fileExtensions = new Set();

          const container = document.getElementById('tree-container');

          // --- 1. RENDER TREE ---
          function renderTree(nodes, isRoot = false) {
              const ul = document.createElement('ul');
              
              nodes.forEach(node => {
                  const li = document.createElement('li');
                  const isFolder = node.type === 'folder';
                  // Unique ID generation (simple regex to remove potential breaking chars for ID)
                  const pathId = node.path.replace(/[^a-zA-Z0-9]/g, "_");

                  let ext = 'file'; 
                  if (!isFolder) {
                      const parts = node.name.split('.');
                      ext = parts.length > 1 ? '.' + parts.pop() : 'no-ext';
                      fileExtensions.add(ext);
                  }

                  const controls = \`
                      <div class="checkbox-group">
                        <label class="cb-wrapper" title="Include in Tree">
                           <input type="checkbox" class="cb-tree" data-path="\${node.path}" data-ext="\${ext}" checked onchange="toggle(this, 'tree')"> T
                        </label>
                        <label class="cb-wrapper" title="Include Content">
                           <input type="checkbox" class="cb-content" data-path="\${node.path}" data-ext="\${ext}" checked onchange="toggle(this, 'content')"> C
                        </label>
                      </div>
                  \`;

                  const icon = isFolder ? '📂' : '📄';
                  const arrowOrSpacer = isFolder ? '<span class="arrow">▶</span>' : '<span class="spacer"></span>';
                  
                  const rowContent = \`
                      <div class="node-row" id="row-\${pathId}">
                          \${arrowOrSpacer}
                          <span class="node-icon">\${icon}</span>
                          <span class="node-name" title="\${node.path}">\${node.name}</span>
                          \${controls}
                      </div>
                  \`;

                  if (isFolder) {
                      const isOpen = isRoot ? 'open' : ''; 
                      li.innerHTML = \`
                          <details \${isOpen}>
                              <summary>\${rowContent}</summary>
                              <div class="children-container" id="children-\${pathId}"></div>
                          </details>
                      \`;
                      // Deferred rendering for large trees performance
                      setTimeout(() => {
                          const childContainer = document.getElementById('children-' + pathId);
                          if(node.children && childContainer) childContainer.appendChild(renderTree(node.children, false));
                      }, 0);
                  } else {
                      li.innerHTML = rowContent;
                  }
                  ul.appendChild(li);
              });
              return ul;
          }

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
          window.bulkToggle = (ext, type, isChecked) => {
              const inputs = document.querySelectorAll(\`input[data-ext="\${ext}"].cb-\${type}\`);
              inputs.forEach(inp => {
                  inp.checked = isChecked;
                  // Trigger individual logic without recursion
                  handleDependencies(inp, type, isChecked);
              });
          };

          window.toggle = (el, type) => {
              const isChecked = el.checked;
              handleDependencies(el, type, isChecked);

              // Handle children recursively (simple prefix match on path)
              // We escape backslashes for the selector to work on Windows paths
              const path = el.getAttribute('data-path');
              const safePath = path.replace(/\\\\/g, '\\\\\\\\'); 
              // Note: querySelector escaping is tricky. 
              // A safer approach for children is traversing DOM if performance allows, 
              // or using the fact that children are rendered inside the details tag.
              
              // However, since we need to support deep folders, we'll try to find inputs 
              // whose data-path starts with the folder path.
              // To avoid complex selector issues, we can iterate all inputs (slower but safer)
              // or just specific class.
              
              const allInputs = document.querySelectorAll('.cb-' + type);
              allInputs.forEach(input => {
                  const p = input.getAttribute('data-path');
                  if(p !== path && p.startsWith(path + (path.includes('/') ? '/' : '\\\\'))) {
                      input.checked = isChecked;
                      handleDependencies(input, type, isChecked);
                  }
              });
          }

          function handleDependencies(el, kind, isChecked) {
              const group = el.parentElement.parentElement;
              if (kind === 'tree' && !isChecked) {
                  const contentCb = group.querySelector('.cb-content');
                  if(contentCb) contentCb.checked = false;
              }
              if (kind === 'content' && isChecked) {
                  const treeCb = group.querySelector('.cb-tree');
                  if(treeCb) treeCb.checked = true;
              }
          }

          // --- 4. GENERATE & COPY ---
          function generate() {
              const promptVal = document.getElementById('promptInput').value;
              const readmeCheck = document.getElementById('readmeCheck');
              const readmeVal = readmeCheck ? readmeCheck.checked : false;

              const config = { 
                  selections: {},
                  userPrompt: promptVal,
                  includeReadme: readmeVal
              };
              
              const allInputs = document.querySelectorAll('.cb-tree'); 
              allInputs.forEach(treeInput => {
                  const path = treeInput.getAttribute('data-path');
                  
                  // FIXED: Use DOM traversal to find sibling content checkbox
                  // Previously: used querySelector with path string which broke on Windows paths
                  const group = treeInput.closest('.checkbox-group');
                  const contentInput = group ? group.querySelector('.cb-content') : null;

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
                  
                  const copyDiv = document.getElementById('copy-container');
                  const resDiv = document.getElementById('result-container');
                  
                  copyDiv.style.display = 'flex';
                  resDiv.style.display = 'block';
                  
                  // Auto scroll to result
                  setTimeout(() => {
                      copyDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 100);
                  
                  const tokens = message.result.tokens;
                  document.getElementById('token-display').innerText = tokens;
                  
                  const copyBtn = document.getElementById('copyBtn');
                  copyBtn.className = ''; 
                  if(tokens < 8000) copyBtn.classList.add('tok-green');
                  else if(tokens < 32000) copyBtn.classList.add('tok-yellow');
                  else copyBtn.classList.add('tok-red');
              }
          });
      </script>
  </body>
  </html>`;
}

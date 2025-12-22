import * as vscode from 'vscode';
import { generateContext } from './core';

export function activate(context: vscode.ExtensionContext) {
    console.log('Repo Context Generator is active!');

    // Register the command
    let disposable = vscode.commands.registerCommand('repoContext.generate', async (uri: vscode.Uri) => {
        
        // 1. Validation
        if (!uri) {
            vscode.window.showErrorMessage('Please right-click a folder in the Explorer.');
            return;
        }

        const folderPath = uri.fsPath; // Absolute path to the folder

        // 2. Show Progress Bar (because scanning takes time)
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Analyzing folder...",
            cancellable: false
        }, async () => {
            try {
                // 3. Run your Logic
                const data = await generateContext(folderPath);
                const jsonString = JSON.stringify(data, null, 2);

                // 4. Open a "Webview" (Side Panel) to show results
                const panel = vscode.window.createWebviewPanel(
                    'contextResult',
                    `Context: ${data.project_name}`,
                    vscode.ViewColumn.Beside,
                    { enableScripts: true }
                );

                // Set the HTML content of the panel
                panel.webview.html = getWebviewContent(jsonString, data.token_count);

            } catch (err: any) {
                vscode.window.showErrorMessage(`Error generating context: ${err.message}`);
            }
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}


function getWebviewContent(jsonContent: string, tokenCount: number) {
    // Determine color based on token health
    let tokenColor = 'green';
    if(tokenCount > 20000) tokenColor = '#ffcc00'; // Yellow
    if(tokenCount > 50000) tokenColor = 'red';

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: sans-serif; padding: 20px; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
            textarea { width: 100%; height: 70vh; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 10px; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
            button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 10px 20px; cursor: pointer; font-size: 14px; }
            button:hover { background: var(--vscode-button-hoverBackground); }
            .badge { padding: 5px 10px; border-radius: 4px; background: #333; color: ${tokenColor}; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>AI Context Result</h2>
            <span class="badge">${tokenCount.toLocaleString()} Tokens</span>
        </div>
        <button onclick="copyToClipboard()">Copy JSON to Clipboard</button>
        <br/><br/>
        <textarea id="output" readonly>${jsonContent}</textarea>
        <script>
            const vscode = acquireVsCodeApi();
            function copyToClipboard() {
                const copyText = document.getElementById("output");
                copyText.select();
                document.execCommand("copy");
                // Optional: Send message back to VS Code
                // vscode.postMessage({ command: 'alert', text: 'Copied!' });
            }
        </script>
    </body>
    </html>`;
}
// src/types.ts

export interface FileNode {
    name: string;
    path: string; // relative path
    type: 'file' | 'folder';
    children?: FileNode[];
}

export interface PathConfig {
    tree: boolean;
    content: boolean;
}

export interface GeneratorConfig {
    // Key is relative path, Value is settings
    selections: Record<string, PathConfig>;
    userPrompt: string;      // NEW: User instructions
    includeReadme: boolean;  // NEW: Include root README.md
}

export interface ContextResult {
    output: string;
    tokens: number;
}

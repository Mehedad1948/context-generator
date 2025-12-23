// src/types.ts
export interface FilterItem {
    tree: boolean;    // Include in the folder structure?
    content: boolean; // Read the file content?
}

export interface GeneratorConfig {
    folders: Record<string, FilterItem>;    // e.g., "src": { tree: true, content: false }
    extensions: Record<string, FilterItem>; // e.g., ".ts": { tree: true, content: true }
}

export interface ScanResult {
    rootName: string;
    folders: string[];
    extensions: string[];
}

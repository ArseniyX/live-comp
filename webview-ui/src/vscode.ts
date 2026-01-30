interface VSCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

class VSCodeWrapper {
  private readonly vscodeApi: VSCodeApi | undefined;

  constructor() {
    if (typeof acquireVsCodeApi === 'function') {
      this.vscodeApi = acquireVsCodeApi();
    }
  }

  public postMessage(message: unknown): void {
    this.vscodeApi?.postMessage(message);
  }

  public getState(): unknown {
    return this.vscodeApi?.getState();
  }

  public setState(state: unknown): void {
    this.vscodeApi?.setState(state);
  }
}

export const vscode = new VSCodeWrapper();

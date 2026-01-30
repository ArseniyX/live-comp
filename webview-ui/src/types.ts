export type MessageFromExtension =
  | { type: 'update'; componentName: string; stateNames: string[]; bundledCode: string }
  | { type: 'error'; componentName?: string; errors: string[] };

export type MessageToExtension = { type: 'ready' } | { type: 'refresh' };

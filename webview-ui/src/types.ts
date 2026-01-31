export type MessageFromExtension =
  | {
      type: 'update';
      componentName: string;
      stateNames: string[];
      bundledCode: string;
      userCss?: string | null;
      userCssPath?: string | null;
    }
  | { type: 'error'; componentName?: string; errors: string[] };

export type MessageToExtension = { type: 'ready' } | { type: 'refresh' };

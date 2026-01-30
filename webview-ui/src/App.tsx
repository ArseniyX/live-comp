import { useState, useEffect, useCallback, useRef } from 'react';
import { vscode } from './vscode';
import { Header } from './components/Header';
import { Loading } from './components/Loading';
import type { MessageFromExtension } from './types';

declare global {
  interface Window {
    tailwind?: {
      refresh?: () => void;
    };
  }
}

type Theme = 'light' | 'dark';

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const isDark =
      document.body.classList.contains('vscode-dark') ||
      document.body.getAttribute('data-vscode-theme-kind') === 'vscode-dark';
    return isDark ? 'dark' : 'light';
  });
  const [componentName, setComponentName] = useState<string>('');
  const [stateNames, setStateNames] = useState<string[]>([]);
  const [bundledCode, setBundledCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const previewRef = useRef<HTMLDivElement>(null);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Handle messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent<MessageFromExtension>) => {
      const message = event.data;

      switch (message.type) {
        case 'update':
          setComponentName(message.componentName);
          setStateNames(message.stateNames);
          setBundledCode(message.bundledCode);
          setIsLoading(false);
          break;

        case 'error':
          setComponentName(message.componentName || '');
          setIsLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'ready' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Execute bundled code AFTER preview-root is rendered
  useEffect(() => {
    if (!bundledCode || !previewRef.current) return;

    // Clear previous
    previewRef.current.innerHTML = '';
    document.querySelectorAll('script[data-preview]').forEach((s) => s.remove());

    try {
      const fn = new Function(bundledCode);
      fn();

      // Trigger Tailwind to rescan for new classes
      setTimeout(() => {
        // Force style recalculation by toggling a class
        document.body.classList.add('tw-refresh');
        document.body.classList.remove('tw-refresh');

        // Try to call Tailwind refresh if available
        if (window.tailwind?.refresh) {
          window.tailwind.refresh();
        }
      }, 50);
    } catch (err) {
      console.error('Script execution error:', err);
    }
  }, [bundledCode]);

  if (isLoading) {
    return <Loading text="Loading preview" />;
  }

  return (
    <>
      <Header
        componentName={componentName}
        stateNames={stateNames}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <div id="preview-root" ref={previewRef} />
    </>
  );
}

export default App;

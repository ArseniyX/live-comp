interface HeaderProps {
  componentName: string;
  stateNames: string[];
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function Header({ componentName, stateNames, theme, onToggleTheme }: HeaderProps) {
  return (
    <div className="preview-header">
      <div>
        <h1>{componentName}</h1>
        <div className="state-count">
          {stateNames.length} state{stateNames.length !== 1 ? 's' : ''}: {stateNames.join(', ')}
        </div>
      </div>
      <button className="theme-toggle" onClick={onToggleTheme} title="Toggle dark/light mode">
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
      </button>
    </div>
  );
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  );
}

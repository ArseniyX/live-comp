interface ErrorDisplayProps {
  title: string;
  errors: string[];
}

export function ErrorDisplay({ title, errors }: ErrorDisplayProps) {
  return (
    <div className="error-container">
      <h2>{title}</h2>
      <pre>{errors.join('\n')}</pre>
    </div>
  );
}

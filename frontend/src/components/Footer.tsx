interface FooterProps {
  className?: string;
  /** 'light' for ivory/light backgrounds, 'dark' for dark backgrounds */
  variant?: 'light' | 'dark';
}

export default function Footer({ className = '', variant = 'dark' }: FooterProps) {
  const textClass = variant === 'light' ? 'text-charcoal/50' : 'text-white/30';
  const linkClass = variant === 'light'
    ? 'text-charcoal/70 hover:text-pine-700'
    : 'text-white/50 hover:text-gold-300/80';

  return (
    <footer className={`text-center text-xs font-sans ${textClass} ${className}`}>
      <p>© {new Date().getFullYear()} Backshots. Developed and built by{' '}
        <a
          href="https://zilware.mu"
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkClass} transition-colors underline underline-offset-2`}
        >
          Zilware.mu
        </a>
      </p>
    </footer>
  );
}

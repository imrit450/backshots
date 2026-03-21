interface LogoIconProps {
  size?: number;
  className?: string;
  /** Unique suffix to avoid gradient ID collisions when multiple icons render */
  id?: string;
}

export function LogoIcon({ size = 32, className = '', id = 'a' }: LogoIconProps) {
  const gradId = `lumora_spark_${id}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FFD700" />
          <stop offset="50%"  stopColor="#FF819F" />
          <stop offset="100%" stopColor="#C19CFF" />
        </linearGradient>
      </defs>
      {/* 4-pointed star body */}
      <path
        d="M100 0L130 70L200 100L130 130L100 200L70 130L0 100L70 70L100 0Z"
        fill={`url(#${gradId})`}
      />
      {/* Dark lens iris centre */}
      <circle cx="100" cy="100" r="30" fill="black" fillOpacity="0.75" />
      {/* Minimalist eyes */}
      <circle cx="90"  cy="100" r="4" fill="white" />
      <circle cx="110" cy="100" r="4" fill="white" />
    </svg>
  );
}

interface LogoWordmarkProps {
  iconSize?: number;
  /** Text size class, e.g. "text-xl" */
  textSize?: string;
  className?: string;
  id?: string;
}

export function LogoWordmark({ iconSize = 28, textSize = 'text-xl', className = '', id = 'a' }: LogoWordmarkProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={iconSize} id={id} />
      <span
        className={`font-black tracking-tighter text-white ${textSize}`}
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        LUMORA
      </span>
    </div>
  );
}

interface NamuLogoProps {
  variant?: "icon" | "wordmark";
  size?: number;
  className?: string;
  iconVariant?: "color" | "mono-dark" | "mono-light";
}

export function NamuLogo({
  variant = "wordmark",
  size = 28,
  className,
  iconVariant = "color",
}: NamuLogoProps) {
  const leafFill =
    iconVariant === "mono-light" ? "#FFFFFF"
    : iconVariant === "mono-dark" ? "#155237"
    : "#8FC85A";
  const treeFill =
    iconVariant === "mono-light" ? "#FFFFFF"
    : "#155237";
  const treeOpacity = iconVariant === "mono-light" ? 0.32 : 1;

  const icon = (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M16 3 C22 5 30 11 30 17 C30 21 23 24 16 24 C9 24 2 21 2 17 C2 11 10 5 16 3 Z"
        fill={leafFill}
      />
      <g opacity={treeOpacity}>
        <rect x="14.8" y="9" width="2.4" height="20" rx="1" fill={treeFill} />
        <line x1="16" y1="12" x2="21" y2="7"
          stroke={treeFill} strokeWidth="2.4" strokeLinecap="round" />
        <line x1="16" y1="17" x2="11" y2="22"
          stroke={treeFill} strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );

  if (variant === "icon") {
    return <span className={className}>{icon}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      {icon}
      <span className="font-brand font-bold text-xl text-foreground">나무</span>
    </span>
  );
}

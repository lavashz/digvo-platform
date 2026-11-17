type IconProps = { className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="5" y="11" width="14" height="10" rx="3" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9.9 5.2A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.1 6.1A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 4.2-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function XIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M16 8l4 4-4 4M20 12H9" />
    </svg>
  );
}

export function SwitchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </svg>
  );
}

export function TruckIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </svg>
  );
}

export function HardHatIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 17h18M5 17a7 7 0 0 1 14 0" />
      <path d="M12 6v4M9 10V7.5M15 10V7.5" />
    </svg>
  );
}

export function FileIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 13h6M10 17h6" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  );
}

export function PinIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 21s7-6 7-11.5a7 7 0 0 0-14 0C5 15 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

export function SpinnerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className ?? ""}`} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Ilustracje maszyn (po kategorii) ---------- */

type Kind = "excavator" | "backhoe" | "telehandler" | "loader" | "mini";

export function machineKind(category: string): Kind {
  const c = category.toLowerCase();
  if (c.includes("mini")) return "mini";
  if (c.includes("teleskop")) return "telehandler";
  if (c.includes("koparkoład")) return "backhoe";
  if (c.includes("ładowark")) return "loader";
  return "excavator";
}

export function MachineGlyph({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const kind = machineKind(category);
  const p = {
    viewBox: "0 0 120 72",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  if (kind === "telehandler") {
    return (
      <svg {...p}>
        <path d="M4 60h112" strokeOpacity="0.25" />
        <rect x="18" y="38" width="52" height="16" rx="5" />
        <path d="M30 38v-9h20l6 9" />
        <path d="M58 40 100 12" strokeWidth="5" />
        <path d="M100 12h10l-3 10h-8z" />
        <circle cx="30" cy="57" r="7" />
        <circle cx="60" cy="57" r="7" />
      </svg>
    );
  }

  if (kind === "loader") {
    return (
      <svg {...p}>
        <path d="M4 63h112" strokeOpacity="0.25" />
        <rect x="30" y="36" width="50" height="18" rx="5" />
        <path d="M42 36v-11h20l6 11" />
        <path d="M80 44 96 40l6 14H88z" />
        <path d="M96 40l12-4v18h-6" />
        <circle cx="42" cy="57" r="8" />
        <circle cx="72" cy="57" r="8" />
      </svg>
    );
  }

  if (kind === "backhoe") {
    return (
      <svg {...p}>
        <path d="M4 63h112" strokeOpacity="0.25" />
        <rect x="34" y="38" width="38" height="16" rx="5" />
        <path d="M44 38V27h18l6 11" />
        <path d="M34 44 20 40v14h14" />
        <path d="M72 42 90 22l14 14" strokeWidth="3.4" />
        <path d="M104 36l6 8H98z" />
        <circle cx="46" cy="57" r="8" />
        <circle cx="68" cy="57" r="6" />
      </svg>
    );
  }

  if (kind === "mini") {
    return (
      <svg {...p}>
        <path d="M4 63h112" strokeOpacity="0.25" />
        <rect x="26" y="50" width="42" height="11" rx="5.5" />
        <path d="M34 50V39h20v11" />
        <path d="M40 39v-8h10l4 8" />
        <path d="M54 42 76 24l12 16" strokeWidth="3.2" />
        <path d="M88 40l5 8H82z" />
      </svg>
    );
  }

  return (
    <svg {...p}>
      <path d="M4 64h112" strokeOpacity="0.25" />
      <rect x="14" y="50" width="52" height="12" rx="6" />
      <path d="M22 50V37h30v13" />
      <path d="M30 37V26h14l6 11" />
      <path d="M52 40 80 14l22 24" strokeWidth="4" />
      <path d="M102 38l8 12H92z" />
    </svg>
  );
}

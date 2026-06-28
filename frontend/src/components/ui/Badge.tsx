interface BadgeProps {
  variant: "buy" | "sell" | "hold" | "live" | "paper" | "active" | "offline" | "success" | "warning" | "error" | "default";
  children: string;
}

const variants: Record<string, string> = {
  buy: "bg-positive/15 text-positive",
  sell: "bg-negative/15 text-negative",
  hold: "bg-gray-500/15 text-gray-400",
  live: "bg-positive/15 text-positive",
  paper: "bg-accent/15 text-accent",
  active: "bg-accent/15 text-accent",
  offline: "bg-gray-500/10 text-gray-600",
  success: "bg-positive/15 text-positive",
  warning: "bg-accent/15 text-accent-dark",
  error: "bg-negative/15 text-negative",
  default: "bg-dark-600/50 text-gray-400",
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${variants[variant] || variants.default}`}>
      {children}
    </span>
  );
}

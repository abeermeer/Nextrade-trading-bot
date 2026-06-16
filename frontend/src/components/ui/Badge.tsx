interface BadgeProps {
  variant: "buy" | "sell" | "hold" | "live" | "paper" | "active" | "offline" | "success" | "warning" | "error" | "default";
  children: string;
}

const variants: Record<string, string> = {
  buy: "bg-green-500/20 text-green-400",
  sell: "bg-red-500/20 text-red-400",
  hold: "bg-gray-500/20 text-gray-400",
  live: "bg-green-500/20 text-green-400",
  paper: "bg-yellow-500/20 text-yellow-400",
  active: "bg-accent/20 text-accent",
  offline: "bg-gray-500/10 text-gray-500",
  success: "bg-green-500/20 text-green-400",
  warning: "bg-yellow-500/20 text-yellow-400",
  error: "bg-red-500/20 text-red-400",
  default: "bg-gray-500/10 text-gray-400",
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${variants[variant] || variants.default}`}>
      {children}
    </span>
  );
}

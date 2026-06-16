import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { AppNavbar } from "../components/Navbar";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Table } from "../components/ui/Table";
import { PageTransition } from "../components/PageTransition";
import type { Position } from "../types";

export default function Positions() {
  const { data: positions } = useQuery({ queryKey: ["positions"], queryFn: api.positions });

  const columns = [
    { key: "symbol", label: "Symbol", render: (p: Position) => <span className="font-medium">{p.symbol}</span> },
    { key: "side", label: "Side", render: (p: Position) => <Badge variant={p.side === "buy" ? "buy" : "sell"}>{p.side}</Badge> },
    { key: "entry", label: "Entry", render: (p: Position) => `$${p.entry_price.toFixed(4)}` },
    { key: "current", label: "Current", render: (p: Position) => `$${p.current_price.toFixed(4)}` },
    { key: "qty", label: "Qty", render: (p: Position) => p.quantity },
    { key: "pnl", label: "Unrealized P&L", render: (p: Position) => (
      <span className={`font-medium ${p.unrealized_pnl >= 0 ? "text-accent" : "text-red-400"}`}>
        ${p.unrealized_pnl.toFixed(2)}
      </span>
    )},
    { key: "status", label: "Status", render: (p: Position) => <Badge variant={p.status === "open" ? "active" : "default"}>{p.status}</Badge> },
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <AppNavbar />
      <PageTransition>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="font-heading text-2xl font-bold mb-6">Open Positions</h1>
          <Card>
            <Table columns={columns} data={positions || []} emptyMessage="No open positions" />
          </Card>
        </div>
      </PageTransition>
    </div>
  );
}

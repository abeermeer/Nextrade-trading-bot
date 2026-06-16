import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { AppNavbar } from "../components/Navbar";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Table } from "../components/ui/Table";
import { PageTransition } from "../components/PageTransition";
import type { Signal } from "../types";

export default function Signals() {
  const { data: signals } = useQuery({ queryKey: ["signals"], queryFn: () => api.signals(100) });

  const columns = [
    { key: "time", label: "Time", render: (s: Signal) => <span className="text-gray-400 text-xs">{new Date(s.timestamp).toLocaleString()}</span> },
    { key: "symbol", label: "Symbol", render: (s: Signal) => <span className="font-medium">{s.symbol}</span> },
    { key: "action", label: "Action", render: (s: Signal) => <Badge variant={s.action as "buy" | "sell" | "hold"}>{s.action}</Badge> },
    { key: "confidence", label: "Confidence", render: (s: Signal) => `${(s.confidence * 100).toFixed(0)}%` },
    { key: "price", label: "Price", render: (s: Signal) => `$${s.price.toFixed(4)}`, className: "hidden md:table-cell" },
    { key: "timeframe", label: "Timeframe", render: (s: Signal) => <span className="text-gray-400">{s.timeframe}</span>, className: "hidden md:table-cell" },
    { key: "strategies", label: "Strategies", render: (s: Signal) => <span className="text-gray-500 text-xs">{s.strategy_results?.length || 0} signals</span>, className: "hidden md:table-cell" },
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <AppNavbar />
      <PageTransition>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="font-heading text-2xl font-bold mb-6">Signal History</h1>
          <Card>
            <Table columns={columns} data={signals || []} emptyMessage="No signals yet" />
          </Card>
        </div>
      </PageTransition>
    </div>
  );
}

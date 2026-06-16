import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { AppNavbar } from "../components/Navbar";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Table } from "../components/ui/Table";
import { PageTransition } from "../components/PageTransition";
import type { Trade } from "../types";

export default function Trades() {
  const { data: trades } = useQuery({ queryKey: ["trades"], queryFn: api.trades });

  const columns = [
    { key: "time", label: "Time", render: (t: Trade) => <span className="text-gray-400 text-xs">{new Date(t.timestamp).toLocaleString()}</span> },
    { key: "symbol", label: "Symbol", render: (t: Trade) => <span className="font-medium">{t.symbol}</span> },
    { key: "side", label: "Side", render: (t: Trade) => <Badge variant={t.side === "buy" ? "buy" : "sell"}>{t.side}</Badge> },
    { key: "price", label: "Price", render: (t: Trade) => `$${t.price.toFixed(4)}` },
    { key: "qty", label: "Qty", render: (t: Trade) => t.quantity },
    { key: "total", label: "Total", render: (t: Trade) => `$${t.total.toFixed(2)}` },
    { key: "fee", label: "Fee", render: (t: Trade) => <span className="text-gray-400">${t.fee.toFixed(4)}</span> },
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <AppNavbar />
      <PageTransition>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="font-heading text-2xl font-bold mb-6">Trade History</h1>
          <Card>
            <Table columns={columns} data={trades || []} emptyMessage="No trades yet" />
          </Card>
        </div>
      </PageTransition>
    </div>
  );
}

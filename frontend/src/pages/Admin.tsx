import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { AppNavbar } from "../components/Navbar";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Table } from "../components/ui/Table";
import { PageTransition } from "../components/PageTransition";
import type { AdminUser, AdminPendingApproval } from "../types";

export default function Admin() {
  const { data: users } = useQuery({
    queryKey: ["adminUsers"],
    queryFn: api.adminUsers,
  });

  const { data: pendingApprovals, refetch: refetchApprovals } = useQuery({
    queryKey: ["adminPendingApprovals"],
    queryFn: api.adminPendingApprovals,
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.adminApproveWhitelist(id),
    onSuccess: () => refetchApprovals(),
  });

  const userColumns = [
    { key: "id", label: "ID", render: (u: AdminUser) => u.id, className: "hidden md:table-cell" },
    { key: "email", label: "Email", render: (u: AdminUser) => u.email },
    { key: "plan", label: "Plan", render: (u: AdminUser) => <Badge variant={u.plan === "enterprise" ? "active" : "default"}>{u.plan}</Badge> },
    { key: "mode", label: "Mode", render: (u: AdminUser) => <Badge variant={u.mode as "live" | "paper"}>{u.mode}</Badge> },
    { key: "type", label: "Type", render: (u: AdminUser) => u.trade_type, className: "hidden md:table-cell" },
    { key: "bot", label: "Bot", render: (u: AdminUser) => (
      <span className={u.bot_active ? "text-accent" : "text-gray-500"}>{u.bot_active ? "Running" : "Stopped"}</span>
    )},
    { key: "exchange", label: "Exchange", render: (u: AdminUser) => (
      <span className="text-xs font-mono text-gray-400 uppercase">{u.exchange || "mexc"}</span>
    ), className: "hidden md:table-cell" },
    { key: "keys", label: "Keys", render: (u: AdminUser) => (
      <span className={u.has_api_keys ? "text-accent" : "text-gray-500"}>{u.has_api_keys ? "Configured" : "—"}</span>
    ), className: "hidden md:table-cell" },
    { key: "wallet", label: "Wallet", render: (u: AdminUser) => u.wallet_address ? (
      <span className="text-xs text-gray-400">{u.wallet_address.slice(0, 8)}...{u.wallet_address.slice(-4)}</span>
    ) : <span className="text-gray-500">—</span>},
  ];

  const approvalColumns = [
    { key: "user", label: "User", render: (a: AdminPendingApproval) => a.user_email },
    { key: "address", label: "Address", render: (a: AdminPendingApproval) => (
      <span className="text-xs font-mono">{a.address.slice(0, 12)}...{a.address.slice(-6)}</span>
    )},
    { key: "network", label: "Network", render: (a: AdminPendingApproval) => a.network },
    { key: "label", label: "Label", render: (a: AdminPendingApproval) => a.label || "—" },
    { key: "created", label: "Created", render: (a: AdminPendingApproval) => (
      <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString()}</span>
    )},
    { key: "action", label: "Action", render: (a: AdminPendingApproval) => (
      <button
        onClick={() => approveMutation.mutate(a.id)}
        disabled={approveMutation.isPending}
        className="text-xs bg-accent hover:bg-accent-dark text-dark-900 px-3 py-1.5 rounded-lg font-bold transition-all disabled:opacity-50"
      >
        Approve
      </button>
    )},
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <AppNavbar />
      <PageTransition>
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          <div>
            <h1 className="font-heading text-2xl font-bold">Admin Panel</h1>
            <p className="text-gray-400 text-sm">Manage all users and their bot instances</p>
          </div>

          <div>
            <h2 className="font-heading text-lg font-bold mb-4">Users</h2>
            <Card>
              <Table columns={userColumns} data={users || []} emptyMessage="No users found" />
            </Card>
          </div>

          <div>
            <h2 className="font-heading text-lg font-bold mb-4">Withdrawal Approvals</h2>
            <Card>
              <Table columns={approvalColumns} data={pendingApprovals || []} emptyMessage="No pending approvals" />
            </Card>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}

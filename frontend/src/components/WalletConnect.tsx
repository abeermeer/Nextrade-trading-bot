import { useWallet, truncateAddress } from "../context/WalletContext";

export default function WalletConnect() {
  const { address, walletType, connected, connecting, connectEVM, connectSolana, disconnect } = useWallet();

  if (connected && address) {
    return (
      <div className="flex items-center gap-2 bg-dark-800 border border-white/10 rounded-xl px-3 py-2">
        <span className={`w-2 h-2 rounded-full ${walletType === "solana" ? "bg-purple-400" : "bg-blue-400"}`} />
        <span className="text-sm font-mono text-gray-300">{truncateAddress(address)}</span>
        <span className="text-xs text-gray-500 uppercase">{walletType}</span>
        <button onClick={disconnect} className="text-xs text-gray-500 hover:text-red-400 ml-1">✕</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={connectEVM} disabled={connecting}
        className="text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 px-4 py-2.5 rounded-lg transition-all disabled:opacity-40 whitespace-nowrap"
      >
        {connecting ? "..." : "MetaMask"}
      </button>
      <button onClick={connectSolana} disabled={connecting}
        className="text-sm bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 px-4 py-2.5 rounded-lg transition-all disabled:opacity-40 whitespace-nowrap"
      >
        {connecting ? "..." : "Phantom"}
      </button>
    </div>
  );
}

import { motion } from "framer-motion";

export function HeroIllustration() {
  const candleColors = ["#00d4aa", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444"];
  const heights = [60, 90, 45, 110, 70, 130, 55, 95, 80, 105];

  return (
    <div className="relative w-full max-w-[420px] mx-auto">
      <div className="rounded-3xl bg-gradient-to-br from-accent/[0.04] via-blue-accent/[0.02] to-transparent border border-white/[0.06] p-6 backdrop-blur-sm">
        {/* Terminal header */}
        <div className="flex items-center gap-1.5 mb-5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
          <span className="text-[10px] text-gray-600 font-mono ml-2">analyst@nexTrade ~ $</span>
        </div>

        {/* Animated candlestick chart */}
        <div className="flex items-end justify-center gap-1.5 h-32 mb-5">
          {heights.map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: h }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
              className="w-5 rounded-sm relative"
              style={{ backgroundColor: candleColors[i % candleColors.length], opacity: 0.7 }}
            >
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.3, delay: i * 0.08 + 0.3 }}
                className="absolute -top-1 left-1/2 w-0.5 h-1 origin-bottom"
                style={{ backgroundColor: candleColors[i % candleColors.length], transform: "translateX(-50%)" }}
              />
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.3, delay: i * 0.08 + 0.3 }}
                className="absolute -bottom-1 left-1/2 w-0.5 h-1 origin-top"
                style={{ backgroundColor: candleColors[i % candleColors.length], transform: "translateX(-50%)" }}
              />
            </motion.div>
          ))}
        </div>

        {/* Line chart overlay */}
        <svg className="w-full h-8 mb-4" viewBox="0 0 200 30">
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, delay: 0.8, ease: "easeInOut" }}
            d="M0 25 Q20 20 40 22 T80 15 T120 18 T160 8 T200 12"
            fill="none"
            stroke="#00d4aa"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        {/* Status line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.5 }}
          className="font-mono text-xs space-y-1"
        >
          <div className="text-accent">$ Scan complete — 3 signals generated</div>
          <div className="text-blue-400">  → BTC/USDT: BUY @ $67,432 (conf: 87%)</div>
          <div className="text-green-400">  → ETH/USDT: BUY @ $3,521 (conf: 76%)</div>
          <div className="text-gray-500">  → SOL/USDT: HOLD — awaiting confirmation</div>
        </motion.div>
      </div>

      {/* Floating stat cards */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 1.2 }}
        className="absolute -right-3 top-8 bg-dark-800/90 backdrop-blur-xl border border-white/[0.06] rounded-xl p-3 text-center shadow-xl"
      >
        <div className="text-accent font-heading text-lg font-bold">87%</div>
        <div className="text-[10px] text-gray-500">Win Rate</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 1.4 }}
        className="absolute -left-3 bottom-12 bg-dark-800/90 backdrop-blur-xl border border-white/[0.06] rounded-xl p-3 text-center shadow-xl"
      >
        <div className="text-accent font-heading text-lg font-bold">24/7</div>
        <div className="text-[10px] text-gray-500">Automated</div>
      </motion.div>
    </div>
  );
}

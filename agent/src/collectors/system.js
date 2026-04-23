/**
 * System Metrics Collector
 * 
 * Uses the 'systeminformation' library to read real OS-level data:
 * - CPU usage (percentage, load average)
 * - Memory (total, used, free)
 * - Disk (total, used, free per partition)
 * - Network (bytes in/out per interface)
 * - Processes (top consumers)
 * 
 * Why 'systeminformation' instead of just `os` module?
 * The built-in `os` module only gives you snapshots (e.g., total memory).
 * systeminformation gives you dynamic data like current CPU load, 
 * disk I/O rates, network throughput, and running processes.
 */

const si = require('systeminformation');
const os = require('os');

async function collectSystemMetrics() {
  // Run all collections in parallel for speed
  const [cpu, mem, disk, networkStats, processes, osInfo] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.networkStats(),
    si.processes(),
    si.osInfo(),
  ]);

  return {
    // CPU metrics
    cpu: {
      currentLoad: Math.round(cpu.currentLoad * 100) / 100,  // e.g., 45.23%
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg(),  // [1min, 5min, 15min]
    },

    // Memory metrics (convert bytes to MB for readability)
    memory: {
      totalMB: Math.round(mem.total / 1024 / 1024),
      usedMB: Math.round(mem.used / 1024 / 1024),
      freeMB: Math.round(mem.free / 1024 / 1024),
      usagePercent: Math.round((mem.used / mem.total) * 10000) / 100,
    },

    // Disk metrics (per partition)
    disk: disk.map(d => ({
      filesystem: d.fs,
      mount: d.mount,
      totalGB: Math.round(d.size / 1024 / 1024 / 1024 * 100) / 100,
      usedGB: Math.round(d.used / 1024 / 1024 / 1024 * 100) / 100,
      usagePercent: d.use,
    })),

    // Network I/O (per interface)
    network: networkStats.map(n => ({
      interface: n.iface,
      rxBytes: n.rx_bytes,
      txBytes: n.tx_bytes,
      rxPerSec: n.rx_sec,
      txPerSec: n.tx_sec,
    })),

    // Top 5 processes by CPU
    topProcesses: processes.list
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        pid: p.pid,
        cpu: p.cpu,
        mem: p.mem,
      })),

    // OS info
    os: {
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
      uptime: os.uptime(),
    },
  };
}

module.exports = { collectSystemMetrics };

// Pull-to-refresh guard: one refresh at a time, and the spinner always stops.
// The returned promise settles on completion, error or timeout; a refresh requested while the
// previous task is still running (even after its timeout) is reported as "busy" instead of
// starting a duplicate scan.
function createRefresher(timeoutMs = 8000) {
  let busy = false;
  return function refresh(task) {
    if (busy) return Promise.resolve({ status: "busy" });
    busy = true;
    const work = Promise.resolve().then(task).finally(() => { busy = false; });
    let timer;
    const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve({ status: "timeout" }), timeoutMs); });
    const outcome = work.then(() => ({ status: "done" }), (e) => ({ status: "error", message: (e && e.message) || String(e) }));
    return Promise.race([outcome, timeout]).finally(() => clearTimeout(timer));
  };
}

module.exports = { createRefresher };

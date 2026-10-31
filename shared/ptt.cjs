// A press owns one capture. Releasing while permission/pairing is pending cancels
// it; asynchronous completions from an old press cannot start a new recording.
class PushToTalk {
  constructor(io) { this.io = io; this.active = null; }
  async press() {
    if (this.active) return;
    const token = { held: true, started: false, cancelled: false, finishing: false };
    this.active = token;
    this.io.state('arming');
    token.start = (async () => {
      await this.io.prepare();
      if (!token.held || token.cancelled) return;
      await this.io.acquire();
      if (!token.held || token.cancelled) return;
      await this.io.start();
      token.started = true;
      if (!token.cancelled) this.io.state('recording');
    })();
    try { await token.start; }
    catch (e) { if (!token.cancelled) this.io.error(e); await this.finish(token, true); }
  }
  async release() {
    const token = this.active;
    if (!token) return;
    token.held = false;
    // A release before capture begins is cancellation, not a zero-length clip.
    await this.finish(token, !token.started);
  }
  async cancel() {
    const token = this.active;
    if (!token) return;
    token.held = false; token.cancelled = true;
    await this.finish(token, true);
  }
  async finish(token, cancel) {
    if (token.finishing) return;
    token.finishing = true;
    try {
      await token.start;
      if (token.started) {
        if (cancel || token.cancelled) await this.io.cancel();
        else { this.io.state('processing'); await this.io.finish(); }
      }
    } catch (e) { if (!cancel && !token.cancelled) this.io.error(e); }
    finally {
      await this.io.release().catch(() => {});
      if (this.active === token) { this.active = null; this.io.state('idle'); }
    }
  }
}
module.exports = { PushToTalk };

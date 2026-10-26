export function startVisiblePolling(task, delay, { immediate = true } = {}) {
  let stopped = false, running = false, timer
  const run = async () => {
    clearTimeout(timer)
    if (stopped || running) return
    if (document.hidden) return
    running = true
    try { await task() } catch (error) { console.error('[Refresh]', error) }
    finally {
      running = false
      if (!stopped && !document.hidden) timer = setTimeout(run, delay)
    }
  }
  const resume = () => { if (!document.hidden) run(); else clearTimeout(timer) }
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('online', resume)
  if (immediate) run(); else timer = setTimeout(run, delay)
  return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume) }
}

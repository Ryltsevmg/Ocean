/** Stable authority barrier retained outside provider reloads. */
export interface BrowserLease {
  /** Monotonic identity, not transferable to another provider generation. */
  readonly generation: number
  /** Aborted before cleanup starts. */
  readonly signal: AbortSignal
}
interface Owner {
  lease: BrowserLease
  controller: AbortController
  close: () => Promise<void>
  operations: Set<Promise<unknown>>
  closing?: Promise<void>
}

/** Serializes authority changes and retains cleanup failures across reloads. */
export class BrowserLifecycle {
  private owner: Owner | undefined
  private generation = 0
  private tail: Promise<void> = Promise.resolve()
  private draining = false
  private applying = false
  private closed = false
  private failure: unknown
  private disposal: Promise<void> | undefined

  constructor(blocked = false) {
    if (blocked) this.failure = new Error('Earlier browser cleanup was not confirmed')
  }

  /** A cleanup failure requires explicit external recovery, never another activation.
   * @returns whether an earlier cleanup or configuration write remains unconfirmed.
   */
  get blocked(): boolean { return this.failure !== undefined }

  /** Release the exact provider generation; an old disposer cannot close a successor.
   * @param lease - generation to release.
   * @returns completion of cleanup and admitted operations, or rejection on cleanup failure.
   */
  release(lease: BrowserLease): Promise<void> {
    return this.owner?.lease === lease ? this.drain() : Promise.resolve()
  }

  /** Attach only after the previous owner has quiesced; this does not open a browser.
   * @param close - cleanup for the newly attached provider.
   * @returns the exclusive lease, aborted before cleanup starts.
   */
  attach(close: () => Promise<void>): BrowserLease {
    this.assertOpen()
    if (this.draining || this.owner !== undefined) throw new Error('Browser authority already owned or draining')
    const controller = new AbortController()
    const lease = Object.freeze({ generation: ++this.generation, signal: controller.signal })
    this.owner = { lease, controller, close, operations: new Set() }
    return lease
  }

  /** Admit and retain an operation under an exact current generation.
   * @param lease - current provider lease; stale or draining leases are rejected.
   * @param operation - work receiving the lease cancellation signal.
   * @returns the operation result; cleanup waits for its settlement.
   */
  run<T>(lease: BrowserLease, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    this.assertOpen()
    const owner = this.owner
    if (this.draining || this.applying || owner?.lease !== lease || lease.signal.aborted) throw new Error('Stale browser authority')
    // Register before calling user code, including code that re-enters disposal.
    const task = Promise.resolve().then(() => {
      lease.signal.throwIfAborted()
      return operation(lease.signal)
    })
    owner.operations.add(task)
    void task.then(() => owner.operations.delete(task), () => owner.operations.delete(task))
    return task
  }

  /** Validate before revoking authority; apply only after cleanup and operations settle.
   * @param validate - validation that leaves existing authority intact when it throws.
   * @param apply - configuration write; failure blocks subsequent authority.
   * @returns completion of the serialized change, or its validation, cleanup or write failure.
   */
  reconfigure<T>(validate: () => T, apply: (validated: T) => Promise<void>): Promise<void> {
    return this.enqueue(async () => {
      this.assertOpen()
      const validated = validate()
      await this.drain()
      this.assertOpen()
      this.applying = true
      try {
        await apply(validated)
        this.assertOpen()
      } catch (error) {
        await this.drain()
        this.failure = error ?? new Error('Browser configuration write was not confirmed')
        throw error
      } finally {
        this.applying = false
      }
    })
  }

  /** Stop admission synchronously and wait for queued changes and current cleanup.
   * @returns shared disposal completion, rejecting if cleanup cannot be confirmed.
   */
  dispose(): Promise<void> {
    this.closed = true
    this.owner?.controller.abort(new Error('Browser authority disposed'))
    return this.disposal ??= this.enqueue(() => this.drain())
  }

  private assertOpen(): void {
    if (this.failure !== undefined) throw new Error('Browser cleanup failed; authority remains blocked', { cause: this.failure })
    if (this.closed) throw new Error('Browser authority disposed')
  }

  private enqueue(work: () => Promise<void>): Promise<void> {
    const task = this.tail.then(work)
    this.tail = task.catch(() => {})
    return task
  }

  private async drain(): Promise<void> {
    if (this.failure !== undefined) throw new Error('Browser cleanup failed; authority remains blocked', { cause: this.failure })
    const owner = this.owner
    if (owner === undefined) return
    this.draining = true
    owner.controller.abort(new Error('Browser authority changing'))
    return owner.closing ??= this.closeOwner(owner)
  }

  private async closeOwner(owner: Owner): Promise<void> {
    // Closing interrupts pending transport calls; settle those calls even when close fails.
    const [closed] = await Promise.allSettled([
      Promise.resolve().then(owner.close),
      Promise.allSettled([...owner.operations]),
    ])
    if (closed.status === 'rejected') {
      this.failure = closed.reason ?? new Error('Browser cleanup failed')
      throw new Error('Browser cleanup failed; authority remains blocked', { cause: this.failure })
    }
    this.owner = undefined
    this.draining = false
  }
}

/** A sign-in to a saved machine takes the first route that answers as that machine. */
import { expect, it, vi } from 'vitest'
import type { HostEpoch, HostId, HostIdentity } from '@ocean/ocean-client-connection/device'
import { answeringRoute, orderedRoutes, type RouteProbe } from '../src/remote-routes.ts'

/** `silent` is a route whose answer never arrives until its probe is aborted. */
type Answer = HostIdentity | Error | 'silent'

const machine = { hostId: 'machine', routes: ['https://lan.example/', 'https://vpn.example/', 'https://tail.example/'] }
const identity = (id: string): HostIdentity => ({ id: id as HostId, epoch: 'launch' as HostEpoch })
const asMachine = identity('machine')
const unreachable = new TypeError('fetch failed')
const fresh = (): AbortSignal => new AbortController().signal

/** A probe that answers each route from a table: an identity, a thrown error, or silence until it is aborted. */
function probeFor(answers: Record<string, Answer>): RouteProbe {
  return vi.fn((route: string, signal: AbortSignal): Promise<HostIdentity> => {
    const answer: Answer | undefined = answers[route]
    if (answer === undefined) return Promise.reject(new Error(`unexpected probe of ${route}`))
    if (answer instanceof Error) return Promise.reject(answer)
    // Like the device client, a silent route is abandoned only when its signal aborts.
    if (answer === 'silent') {
      return new Promise<never>((_resolve, reject) => {
        signal.addEventListener('abort', () => { reject(new Error('route probe aborted')) }, { once: true })
      })
    }
    return Promise.resolve(answer)
  })
}

it('orders the preferred route first and the others from the most recent', () => {
  expect(orderedRoutes(machine, 'https://vpn.example/')).toEqual([
    'https://vpn.example/', 'https://tail.example/', 'https://lan.example/',
  ])
  expect(orderedRoutes(machine, 'https://new.example/')).toEqual([
    'https://new.example/', 'https://tail.example/', 'https://vpn.example/', 'https://lan.example/',
  ])
})

it('takes the preferred route as soon as it answers as the machine', async () => {
  const probe = probeFor({ 'https://lan.example/': asMachine, 'https://tail.example/': asMachine, 'https://vpn.example/': asMachine })
  expect(await answeringRoute(machine, 'https://lan.example/', fresh(), probe)).toBe('https://lan.example/')
  expect(probe).toHaveBeenCalledTimes(1)
})

it('skips a route that cannot be reached and one that answers as another machine', async () => {
  const probe = probeFor({
    'https://lan.example/': unreachable,
    'https://tail.example/': identity('another-machine'),
    'https://vpn.example/': asMachine,
  })
  expect(await answeringRoute(machine, 'https://lan.example/', fresh(), probe)).toBe('https://vpn.example/')
  expect(probe).toHaveBeenCalledTimes(3)
})

it('returns the preferred route when no route answers, so the sign-in reports why it fails', async () => {
  const probe = probeFor({
    'https://lan.example/': unreachable, 'https://tail.example/': unreachable, 'https://vpn.example/': unreachable,
  })
  expect(await answeringRoute(machine, 'https://lan.example/', fresh(), probe)).toBe('https://lan.example/')
})

it('stops trying routes once the sign-in is cancelled', async () => {
  const cancellation = new AbortController()
  const probe = probeFor({
    'https://lan.example/': new Error('refused'),
    'https://tail.example/': new Error('refused'),
    'https://vpn.example/': asMachine,
  })
  const answer = answeringRoute(machine, 'https://lan.example/', cancellation.signal, probe)
  cancellation.abort()
  expect(await answer).toBe('https://lan.example/')
  expect(probe).toHaveBeenCalledTimes(1)
})

it('gives up on a route that stays silent and takes the next one that answers', async () => {
  const probe = probeFor({ 'https://lan.example/': 'silent', 'https://tail.example/': asMachine, 'https://vpn.example/': asMachine })
  expect(await answeringRoute(machine, 'https://lan.example/', fresh(), probe)).toBe('https://tail.example/')
}, 10_000)

it('does not probe a machine with one route', async () => {
  const probe = probeFor({})
  expect(await answeringRoute({ hostId: 'machine', routes: ['https://only.example/'] }, 'https://only.example/', fresh(), probe))
    .toBe('https://only.example/')
  expect(probe).not.toHaveBeenCalled()
})

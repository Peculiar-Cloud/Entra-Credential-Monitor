import type { Client } from '@microsoft/microsoft-graph-client'
import { addDays, subDays } from 'date-fns'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GraphClient } from './graph-client.js'
import { createLogger } from './logger.js'

/**
 * A fake Graph request builder that records the fluent calls and returns a
 * fixed page. Pages link via @odata.nextLink so the real PageIterator follows
 * them through the same fake client.
 */
function makeFakeClient(pagesByPath: Record<string, unknown[]>): {
  client: Client
  calls: Record<string, unknown>
} {
  const calls: Record<string, unknown> = {}

  function builder(path: string) {
    const state: Record<string, unknown> = {}
    const self: Record<string, unknown> = {}
    for (const method of ['select', 'expand', 'top', 'filter', 'version', 'header']) {
      self[method] = (arg: unknown) => {
        state[method] = arg
        return self
      }
    }
    self.get = async () => {
      // Record the builder state for the first request to each base path.
      if (!path.includes('$skiptoken') && pagesByPath[path]) {
        calls[path] = state
      }
      const value = pagesByPath[path] ?? []
      // Single page; no nextLink. (Multi-page paths key the next page explicitly.)
      return { value }
    }
    return self
  }

  const client = { api: (path: string) => builder(path) } as unknown as Client
  return { client, calls }
}

const validApp = (over: Record<string, unknown> = {}) => ({
  id: 'obj-1',
  appId: '11111111-1111-1111-1111-111111111111',
  displayName: 'App One',
  passwordCredentials: [],
  keyCredentials: [],
  owners: [],
  ...over,
})

describe('GraphClient.getApplicationsWithCredentials', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-15T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('selects and expands the expected fields with a 999 page size', async () => {
    const { client, calls } = makeFakeClient({ '/applications': [] })
    const gc = new GraphClient('t', 'c', 's', client, createLogger('silent'))

    await gc.getApplicationsWithCredentials(30)

    const state = calls['/applications'] as Record<string, unknown>
    expect(state.select).toBe(
      'id,appId,displayName,passwordCredentials,keyCredentials,createdDateTime',
    )
    expect(state.expand).toContain('owners')
    expect(state.top).toBe(999)
  })

  it('keeps only apps with credentials actionable within the warning window', async () => {
    const apps = [
      validApp({ displayName: 'no creds' }),
      validApp({
        displayName: 'expiring soon',
        passwordCredentials: [{ keyId: 'k1', endDateTime: addDays(new Date(), 10).toISOString() }],
      }),
      validApp({
        displayName: 'expires far out',
        passwordCredentials: [{ keyId: 'k2', endDateTime: addDays(new Date(), 400).toISOString() }],
      }),
      validApp({
        displayName: 'already expired',
        keyCredentials: [{ keyId: 'k3', endDateTime: subDays(new Date(), 5).toISOString() }],
      }),
    ]
    const { client } = makeFakeClient({ '/applications': apps })
    const gc = new GraphClient('t', 'c', 's', client, createLogger('silent'))

    const result = await gc.getApplicationsWithCredentials(30)

    const names = result.value.map((a) => a.displayName).sort()
    expect(names).toEqual(['already expired', 'expiring soon'])
  })

  it('treats an unparseable endDateTime as actionable so it is not silently dropped', async () => {
    const apps = [
      validApp({
        displayName: 'broken date',
        passwordCredentials: [{ keyId: 'k', endDateTime: 'not-a-date' }],
      }),
    ]
    const { client } = makeFakeClient({ '/applications': apps })
    const gc = new GraphClient('t', 'c', 's', client, createLogger('silent'))

    const result = await gc.getApplicationsWithCredentials(30)

    expect(result.value).toHaveLength(1)
    expect(result.value[0].displayName).toBe('broken date')
  })

  it('skips items that fail schema validation rather than returning them raw', async () => {
    const apps = [
      validApp({
        displayName: 'good',
        passwordCredentials: [{ keyId: 'k', endDateTime: subDays(new Date(), 1).toISOString() }],
      }),
      { id: 'x', displayName: 'missing appId and creds shape', appId: 12345 }, // appId wrong type
    ]
    const { client } = makeFakeClient({ '/applications': apps })
    const gc = new GraphClient('t', 'c', 's', client, createLogger('silent'))

    const result = await gc.getApplicationsWithCredentials(30)

    expect(result.value).toHaveLength(1)
    expect(result.value[0].displayName).toBe('good')
  })
})

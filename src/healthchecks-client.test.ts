import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HealthchecksClient } from './healthchecks-client.js'
import type { Logger } from './logger.js'

describe('HealthchecksClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let logger: Logger

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
    } as unknown as Logger
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('builds the ping URL from a bare slug', async () => {
    await new HealthchecksClient('abc-123', logger).success()
    expect(fetchMock).toHaveBeenCalledWith('https://hc-ping.com/abc-123', expect.anything())
  })

  it('uses a full URL slug verbatim', async () => {
    await new HealthchecksClient('https://hc.example.com/uuid', logger).start()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hc.example.com/uuid/start',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('does nothing when no slug is configured', async () => {
    const client = new HealthchecksClient(undefined, logger)
    await client.start()
    await client.success()
    await client.fail(new Error('x'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs only a truncated error message on fail, never the stack', async () => {
    const error = new Error('boom')
    error.stack = 'Error: boom\n    at secretFunction (/Users/secret/path.ts:1:1)'
    await new HealthchecksClient('uuid', logger).fail(error)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://hc-ping.com/uuid/fail')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('boom')
    expect(init.body).not.toContain('secretFunction')
    expect(init.body).not.toContain('/Users/secret/path.ts')
  })

  it('caps the failure body length', async () => {
    await new HealthchecksClient('uuid', logger).fail(new Error('x'.repeat(2000)))
    const init = fetchMock.mock.calls[0][1]
    expect(init.body.length).toBe(500)
  })

  it('resolves (does not throw) when healthchecks returns a non-2xx status', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
    await expect(new HealthchecksClient('uuid', logger).success()).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalled()
  })

  it('resolves (does not throw) when the request errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    await expect(new HealthchecksClient('uuid', logger).start()).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalled()
  })
})

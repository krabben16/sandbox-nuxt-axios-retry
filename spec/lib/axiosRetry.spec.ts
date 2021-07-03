import axios, { AxiosInstance } from 'axios'
import nock from 'nock'
import axiosRetry from '../../lib/axiosRetry'

const NETWORK_ERROR: any = new Error('Some connection error')
NETWORK_ERROR.code = 'ECONNRESET'

const namespace = 'axios-retry-state'

function setupResponses (client: AxiosInstance, responses: (() => nock.Scope)[]) {
  const configureResponse = () => {
    const response = responses.shift()
    if (response) {
      response()
    }
  }
  client.interceptors.response.use(
    (result) => {
      configureResponse()
      return result
    },
    (error) => {
      configureResponse()
      return Promise.reject(error)
    }
  )
  configureResponse()
}

/**
 * 正常系
 * - リトライしない
 * 異常系
 * - リトライする
 */
describe('retries', () => {
  afterEach(() => {
    nock.cleanAll()
    nock.enableNetConnect()
  })

  it('【正常系】200が返されるのでリトライされず、retryCountの値は変わらない', done => {
    const client = axios.create()

    setupResponses(client, [
      // 初回リクエスト
      () =>
        nock('http://example.com')
          .get('/test')
          .reply(200)
    ])

    axiosRetry(client)

    client
      .get('http://example.com/test')
      .then(result => {
        expect(result.status).toBe(200)
        expect(result.config[namespace]?.retryCount).toBe(0)
        done()
      })
  })

  it('【異常系】エラーが返されるのでリトライされ、retryCountの値が増える', done => {
    const client = axios.create()

    setupResponses(client, [
      // 初回リクエスト
      () =>
        nock('http://example.com')
          .get('/test')
          .replyWithError(NETWORK_ERROR),
      // リトライ 1回目
      () =>
        nock('http://example.com')
          .get('/test')
          .replyWithError(NETWORK_ERROR),
      // リトライ 2回目
      () =>
        nock('http://example.com')
          .get('/test')
          .reply(200)
    ])

    axiosRetry(client, { retries: 3 })

    client
      .get('http://example.com/test')
      .then(result => {
        expect(result.status).toBe(200)
        expect(result.config[namespace]?.retryCount).toBe(2)
        done()
      })
  })
})

/**
 * 正常系
 * - タイムアウトしない リトライしない
 * 異常系
 * - タイムアウトしない リトライする
 * - タイムアウトする リトライしない
 * - タイムアウトする リトライする
 */
describe('timeout', () => {
  afterEach(() => {
    nock.cleanAll()
    nock.enableNetConnect()
  })

  it('【正常系】タイムアウト以内にレスポンスが返されるのでリトライされず、timeoutの値は変わらない', done => {
    const client = axios.create({
      timeout: 500,
    })

    setupResponses(client, [
      () =>
        nock('http://example.com')
          .get('/test')
          .delay(400) // timeout=500
          .reply(200)
    ])

    axiosRetry(client)

    client
      .get('http://example.com/test')
      .then(result => {
        expect(result.status).toBe(200)
        expect(result.config.timeout).toBe(500)
        done()
      })
  })

  it('【異常系】タイムアウト以内にレスポンスが返されるがエラーなのでリトライされ、timeoutの値が増える', done => {
    const client = axios.create({
      timeout: 500,
    })

    setupResponses(client, [
      () =>
        nock('http://example.com')
          .get('/test')
          .delay(400) // timeout=500
          .replyWithError(NETWORK_ERROR),
      () =>
        nock('http://example.com')
          .get('/test')
          .delay(800) // timeout=1000
          .replyWithError(NETWORK_ERROR),
      () =>
        nock('http://example.com')
          .get('/test')
          .delay(1200) // timeout=1500
          .reply(200)
    ])

    axiosRetry(client, { retries: 3, retryDelay: () => 500 })

    client
      .get('http://example.com/test')
      .then(result => {
        expect(result.status).toBe(200)
        /**
         * 1. timeout=500 + delay=500 = 1000
         * 2. timeout=1000 + delay=500 = 1500
         * 3. timeoutの値は変化しない (200が返されるのでaxiosRetryのonRejectedは実行されない)
         */
        expect(result.config.timeout).toBe(1500)
        done()
      })
  })

  it('【異常系】タイムアウト以内にレスポンスが返されないがリトライされず、timeoutの値は変わらない', done => {
    const client = axios.create({
      timeout: 100,
    })

    // タイムアウトした場合 code=ECONNABORTED
    setupResponses(client, [
      () =>
        nock('http://example.com')
          .get('/test')
          .delay(500) // timeout=100
          .replyWithError(NETWORK_ERROR),
    ])

    axiosRetry(client)

    client
      .get('http://example.com/test')
      .catch(error => {
        expect(error.config.timeout).toBe(100)
        done()
      })
  })

  it('【異常系】タイムアウト以内にレスポンスが返されないのでリトライされ、timeoutの値が増える', done => {
    const client = axios.create({
      timeout: 100,
    })

    // タイムアウトした場合 code=ECONNABORTED
    setupResponses(client, [
      () =>
        nock('http://example.com')
          .get('/test')
          .delay(500) // timeout=100
          .replyWithError(NETWORK_ERROR),
      () =>
        nock('http://example.com')
          .get('/test')
          .delay(500) // timeout=200
          .replyWithError(NETWORK_ERROR),
      () =>
        nock('http://example.com')
          .get('/test')
          .delay(500) // timeout=300
          .replyWithError(NETWORK_ERROR),
    ])

    axiosRetry(client, { retries: 3, retryDelay: () => 100 })

    client
      .get('http://example.com/test')
      .catch(error => {
        /**
         * 1. timeout=100 + delay=100 = 200
         * 2. timeout=200 + delay=100 = 300
         * 3. timeout=300 + delay=100 = 400
         */
        expect(error.config.timeout).toBe(400)
        done()
      })
  })
})

import axios, { AxiosInstance } from 'axios'
import nock from 'nock'
import axiosRetry from '../../lib/axiosRetry'

const NETWORK_ERROR: any = new Error('Some connection error')
NETWORK_ERROR.code = 'ECONNRESET'

const namespace = 'axios-retry-state'

function setupResponses (client: AxiosInstance, responses: any[]) {
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

describe('retries', () => {
  afterEach(() => {
    nock.cleanAll()
    nock.enableNetConnect()
  })

  it('【正常系】リトライされず、retryCountが変わらない', done => {
    const client = axios.create()

    setupResponses(client, [
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
        expect(result.config[namespace]?.retryCount).toBe(0)
        done()
      }, done.fail)
  })

  it('【正常系】リトライされ、retryCountが増える', done => {
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
      }, done.fail)
  })
})

describe('timeout', () => {
  afterEach(() => {
    nock.cleanAll()
    nock.enableNetConnect()
  })

  it('【正常系】リトライされず、timeoutが変わらない', done => {
    const client = axios.create({
      timeout: 500,
    })

    setupResponses(client, [
      () =>
        nock('http://example.com')
          .get('/test')
          .reply(200)
    ])

    axiosRetry(client, { retryDelay: () => 500 })

    client
      .get('http://example.com/test')
      .then(result => {
        expect(result.status).toBe(200)
        expect(result.config.timeout).toBe(500)
        done()
      }, done.fail)
  })

  it('【正常系】リトライされ、timeoutが増える', done => {
    const client = axios.create({
      timeout: 500,
    })

    setupResponses(client, [
      () =>
        nock('http://example.com')
          .get('/test')
          .replyWithError(NETWORK_ERROR),
      () =>
        nock('http://example.com')
          .get('/test')
          .replyWithError(NETWORK_ERROR),
      () =>
        nock('http://example.com')
          .get('/test')
          .reply(200)
    ])

    axiosRetry(client, { retryDelay: () => 500 })

    client
      .get('http://example.com/test')
      .then(result => {
        expect(result.status).toBe(200)
        /**
         * 1. timeout=500 + delay=500 = 1000
         * 2. timeout=1000 + 500 = delay=1500
         * 3. timeoutの値は変化しない (200が返されるのでshouldRetry=false)
         */
        expect(result.config.timeout).toBe(1500)
        done()
      }, done.fail)
  })
})

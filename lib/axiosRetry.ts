import { AxiosInstance, AxiosRequestConfig } from 'axios'
import { IAxiosRetryConfig } from 'axios-retry'

const namespace = 'axios-retry-state'

const noDelay = () => {
  return 0
}

const getCurrentState = (config: AxiosRequestConfig) => {
  const currentState = config[namespace] ?? { retryCount: 0 }
  config[namespace] = currentState
  return currentState
}

export default function axiosRetry(axios: AxiosInstance, retryConfig?: IAxiosRetryConfig) {
  axios.interceptors.request.use(config => {
    const currentState = getCurrentState(config)
    // console.log({ retryCount: currentState.retryCount, timeout: config.timeout })
    return config
  })

  axios.interceptors.response.use(undefined, (error) => {
    const config = error.config

    // If we have no information to retry the request
    if (!config) {
      return Promise.reject(error)
    }

    const {
      retries = 3,
      retryDelay = noDelay,
    } = retryConfig ?? {}

    const currentState = getCurrentState(config)
    const shouldRetry = currentState.retryCount < retries

    if (shouldRetry) {
      currentState.retryCount += 1

      // 次のリクエストまでのディレイを計算
      const delay = retryDelay(currentState.retryCount, error)

      // リクエストのタイムアウトを延長
      if (config.timeout) {
        // console.log({ timeout: config.timeout, delay })
        config.timeout = config.timeout + delay
      }

      config.transformRequest = [(data: any) => data]

      return new Promise(resolve => {
        setTimeout(() => {
          resolve(axios(config))
        }, delay)
      })
    }

    return Promise.reject(error)
  })
}

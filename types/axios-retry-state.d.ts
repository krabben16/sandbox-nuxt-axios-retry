declare namespace IAxiosRetry {
  export interface IAxiosRetryState {
    retryCount: number
  }
}

export type IAxiosRetryState = IAxiosRetry.IAxiosRetryState

declare module 'axios' {
  export interface AxiosRequestConfig {
    'axios-retry-state'?: IAxiosRetryState
  }
}

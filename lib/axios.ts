import axios from 'axios'
import axiosRetry from 'axios-retry'

const custom = axios.create({
  baseURL: 'http://localhost:3333',
})

axiosRetry(custom, {
  retries: 3,
  retryDelay: (retryCount) => { return retryCount * 1000 },
})

export default custom

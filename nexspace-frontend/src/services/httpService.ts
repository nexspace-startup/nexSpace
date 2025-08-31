import axios from 'axios'

export const api = axios.create({
  baseURL: "/",
  withCredentials: true
})


api.interceptors.response.use(
  r => r,
  async (err) => {
    const status = err?.response?.status
    if (status === 401) {
      location.assign('/signin')
    }
    return Promise.reject(err)
  }
)

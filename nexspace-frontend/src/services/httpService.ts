import axios from 'axios'

export const api = axios.create({
  baseURL: "/",
  withCredentials: true
})

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  async (err) => {
    const status = err?.response?.status
    if (status === 401) {
      // optional: attempt refresh, then retry once
      // ...refresh flow here...
      localStorage.removeItem('token')
      location.assign('/auth/login')
    }
    return Promise.reject(err)
  }
)

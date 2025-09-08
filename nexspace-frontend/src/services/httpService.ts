import axios from 'axios'
import { ENDPOINTS } from '../constants/endpoints'

export const api = axios.create({
  baseURL: ENDPOINTS.BASE_URL,
  withCredentials: true
})


// api.interceptors.response.use(
//   r => r,
//   async (err) => {
//     const status = err?.response?.status
//     if (status === 401) {
//       location.assign('/signin')
//     }
//     return Promise.reject(err)
//   }
// )

import axios from 'axios'
import { message } from 'antd'

const api = axios.create({
  baseURL: '',  // Nginx反向代理，同域
  timeout: 120000,  // 生图可能等2分钟
  headers: { 'Content-Type': 'application/json' },
})

// 请求拦截：自动附加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截: 统一错误处理
api.interceptors.response.use(
  res => res,
  error => {
    if (error.response) {
      const { status, data } = error.response
      if (status === 401) {
        // 保存当前路径，登录后恢复
        const currentPath = window.location.pathname + window.location.search
        if (currentPath !== '/login' && currentPath !== '/register') {
          sessionStorage.setItem('redirectAfterLogin', currentPath)
        }
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
      if (status === 429) {
        message.warning(data?.detail || '操作太频繁，请稍后再试')
      }
      if (status === 503) {
        message.warning('AI 服务暂时繁忙，已切换本地模式，请稍后再试')
      }
      if (status >= 500) {
        message.error(data?.detail || '服务器内部错误，请稍后重试')
      }
      return Promise.reject(new Error(data?.detail || '请求失败'))
    }
    if (error.code === 'ECONNABORTED') {
      message.error('请求超时，请重试')
      return Promise.reject(new Error('请求超时，请重试'))
    }
    if (!navigator.onLine) {
      message.warning('网络连接已断开，请检查网络后重试')
    }
    return Promise.reject(new Error('网络连接失败'))
  }
)

export default api

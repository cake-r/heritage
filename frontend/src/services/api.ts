import axios from 'axios'

const api = axios.create({
  baseURL: '',  // Nginx反向代理，同域
  timeout: 120000,  // 生图可能等2分钟
  headers: { 'Content-Type': 'application/json' },
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
      return Promise.reject(new Error(data?.detail || '请求失败'))
    }
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('请求超时，请重试'))
    }
    return Promise.reject(new Error('网络连接失败'))
  }
)

export default api

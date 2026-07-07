import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, message, Space } from 'antd'
import { User, Lock, RefreshCw, Shield } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

const { Title, Text } = Typography

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [captchaQuestion, setCaptchaQuestion] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const fetchCaptcha = async () => {
    try {
      const res = await api.get('/api/auth/captcha')
      setCaptchaQuestion(res.data.question)
      setCaptchaToken(res.data.captcha_token)
    } catch {
      // captcha fetching failed, proceed without captcha (graceful degradation)
    }
  }

  useEffect(() => {
    fetchCaptcha()
  }, [])

  const onFinish = async (values: { username: string; password: string; captcha: string }) => {
    setLoading(true)
    try {
      // Extend login to pass captcha data
      const res = await api.post('/api/auth/login', {
        username: values.username,
        password: values.password,
        captcha_token: captchaToken,
        captcha_answer: values.captcha || '',
      })
      const { access_token, user: userData } = res.data
      // Manually set auth state since we bypassed AuthContext.login
      localStorage.setItem('token', access_token)
      localStorage.setItem('user', JSON.stringify(userData))
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
      // Trigger a page reload to reinitialize auth context
      message.success('登录成功')
      const savedRedirect = sessionStorage.getItem('redirectAfterLogin')
      if (savedRedirect) {
        sessionStorage.removeItem('redirectAfterLogin')
      }
      const redirect = savedRedirect || searchParams.get('redirect') || '/'
      navigate(redirect, { replace: true })
      // Reload to refresh AuthContext state
      window.location.href = redirect
    } catch (err: any) {
      message.error(err.message || '登录失败')
      // Refresh captcha on error
      fetchCaptcha()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '80px auto' }}>
      <Card
        style={{ borderRadius: 12, border: '1px solid var(--color-gold-light, #E8D5B0)' }}
        styles={{ body: { padding: '32px 28px' } }}
      >
        <Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>
          🏮 文博灵境 · 登录
        </Title>
        <Form onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<User />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<Lock />} placeholder="密码" />
          </Form.Item>
          {captchaQuestion && (
            <Form.Item
              name="captcha"
              rules={[{ required: true, message: '请回答验证问题' }]}
            >
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  prefix={<Shield />}
                  placeholder={captchaQuestion}
                  style={{ flex: 1 }}
                />
                <Button
                  icon={<RefreshCw />}
                  onClick={fetchCaptcha}
                  title="换一题"
                />
              </Space.Compact>
            </Form.Item>
          )}
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center' }}>
          还没有账号？<Link to="/register">立即注册</Link>
        </div>
      </Card>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, message } from 'antd'
import { UserOutlined, LockOutlined, SmileOutlined } from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'

const { Title } = Typography

export default function Register() {
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const onFinish = async (values: { username: string; password: string; nickname?: string }) => {
    setLoading(true)
    try {
      await register(values.username, values.password, values.nickname)
      message.success('注册成功')
      navigate('/', { replace: true })
    } catch (err: any) {
      message.error(err.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto' }}>
      <Card style={{ borderRadius: 12 }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>
          🏮 注册
        </Title>
        <Form onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="nickname">
            <Input prefix={<SmileOutlined />} placeholder="昵称（可选）" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, min: 6, message: '密码至少6位' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              注册
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center' }}>
          已有账号？<Link to="/login">去登录</Link>
        </div>
      </Card>
    </div>
  )
}

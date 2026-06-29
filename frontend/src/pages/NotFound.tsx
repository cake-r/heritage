import { useNavigate } from 'react-router-dom'
import { Button, Result } from 'antd'
import { HomeOutlined } from '@ant-design/icons'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh',
    }}>
      <Result
        status="404"
        title="页面不存在"
        subTitle="你访问的页面不存在，请检查链接是否正确"
        extra={
          <Button type="primary" icon={<HomeOutlined />} onClick={() => navigate('/')}>
            返回首页
          </Button>
        }
      />
    </div>
  )
}

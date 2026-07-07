import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { Button, Result } from 'antd'
import { Home, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary 捕获到渲染错误:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: '#F5F0E8',
          padding: 24,
        }}>
          <Result
            status="500"
            title="页面渲染出错"
            subTitle={this.state.error?.message || '抱歉，页面遇到了意外错误，请尝试刷新页面或返回首页'}
            extra={
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <Button icon={<RefreshCw />} onClick={() => window.location.reload()}>
                  刷新页面
                </Button>
                <Button type="primary" icon={<Home />} onClick={() => {
                  this.handleReset()
                  window.location.href = '/'
                }}>
                  返回首页
                </Button>
              </div>
            }
          />
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Input, Button, Upload, Segmented, Space } from 'antd'
import { Send, Image, X } from 'lucide-react'
import { TOOL_NAMES, type InheritorInfo } from './index'

interface Props {
  onSend: (content: string, image?: File | null) => AbortController | undefined
  streaming: boolean
  availableTools: string[]
  activeToolId: string | null
  onCancelTool: () => void
}

export interface WorkshopChatInputHandle {
  selectTool: (toolId: string) => void
}

const WorkshopChatInput = forwardRef<WorkshopChatInputHandle, Props>(function WorkshopChatInput(
  { onSend, streaming, availableTools, activeToolId, onCancelTool }, ref
) {
  const [inputValue, setInputValue] = useState('')
  const [activeTool, setActiveTool] = useState<string>('')
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const abortRef = useRef<AbortController | null>(null)

  // 处理工具选择
  const handleToolChange = (val: string | number) => {
    const toolId = String(val)
    setActiveTool(toolId)
    if (toolId) {
      const prefix = `/${toolId} `
      if (!inputValue.startsWith(prefix)) {
        setInputValue(prefix + inputValue.replace(/^\/[a-z]+\s/, ''))
      }
    }
  }

  // 处理发送
  const handleSend = useCallback(() => {
    const content = inputValue.trim()
    if (!content && !uploadedImage) return

    // 停止之前的流
    if (abortRef.current) {
      abortRef.current.abort()
    }

    const controller = onSend(content || '请帮我分析这张图片', uploadedImage)
    if (controller) {
      abortRef.current = controller
    }

    setInputValue('')
    setUploadedImage(null)
    setPreviewUrl('')
    setActiveTool('')
  }, [inputValue, uploadedImage, onSend])

  // 处理图片上传
  const handleImageSelect = (file: File) => {
    setUploadedImage(file)
    setPreviewUrl(URL.createObjectURL(file))
    // 如果选中 inspect 工具的传承人，自动设置工具
    if (availableTools.includes('inspect') && !activeTool) {
      setActiveTool('inspect')
      setInputValue('/inspect ')
    }
    return false // 阻止默认上传
  }

  // 处理取消
  const handleCancel = () => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    abortRef.current = null
    onCancelTool()
  }

  // 处理按键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 暴露 selectTool 给父组件（工具箱一键填入）
  useImperativeHandle(ref, () => ({
    selectTool: (toolId: string) => {
      setActiveTool(toolId)
      const prefix = `/${toolId} `
      if (!inputValue.startsWith(prefix)) {
        setInputValue(prefix + inputValue.replace(/^\/[a-z]+\s/, ''))
      }
    },
  }), [inputValue])

  // 构建工具选项
  const toolOptions = [
    { label: '💬 对话', value: '' },
    ...availableTools.map(t => {
      const icons: Record<string, string> = { inspect: '🔍', create: '🎨', connect: '🔗', teach: '📖', pattern: '🏮', story: '📜', compare: '⚖️' }
      const icon = icons[t] || '🛠️'
      return { label: `${icon} ${TOOL_NAMES[t] || t}`, value: t }
    }),
  ]

  return (
    <div style={{
      borderTop: '1px solid var(--color-paper, #F7F4ED)',
      padding: '16px 20px',
      background: 'var(--color-paper-white, #FFFDF9)',
    }}>
      {/* 工具选择器 */}
      {availableTools.length > 0 && (
        <div style={{ marginBottom: 8, overflowX: 'auto', whiteSpace: 'nowrap' }}>
          <Segmented
            size="middle"
            options={toolOptions}
            value={activeTool || ''}
            onChange={(val) => handleToolChange(String(val))}
            style={{ fontSize: 16 }}
          />
        </div>
      )}

      {/* 图片预览 */}
      {previewUrl && (
        <div style={{
          position: 'relative',
          display: 'inline-block',
          marginBottom: 8,
        }}>
          <img
            src={previewUrl}
            alt="preview"
            style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }}
          />
          <Button
            type="text"
            size="small"
            icon={<X />}
            onClick={() => { setUploadedImage(null); setPreviewUrl('') }}
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              background: 'var(--color-ink, #2C241A)',
              color: '#fff',
              borderRadius: '50%',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        </div>
      )}

      {/* 输入区域 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <Upload
          accept="image/jpeg,image/png,image/webp"
          showUploadList={false}
          beforeUpload={handleImageSelect as any}
        >
          <Button
            type="text"
            icon={<Image />}
            disabled={streaming}
            style={{ color: 'var(--color-ink-secondary, #6B5F52)', fontSize: 'var(--text-xs)' }}
          >
            上传
          </Button>
        </Upload>

        <Input.TextArea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={activeToolId ? `使用 ${TOOL_NAMES[activeToolId] || activeToolId} 中…` : '输入消息… Enter 发送，Shift+Enter 换行'}
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={streaming}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            resize: 'none',
            fontSize: 'var(--text-sm)',
          }}
        />

        {streaming ? (
          <Button
            danger
            icon={<X />}
            onClick={handleCancel}
          >
            取消
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<Send />}
            onClick={handleSend}
            disabled={!inputValue.trim() && !uploadedImage}
            style={{
              background: 'var(--color-vermilion, #B8463A)',
              borderColor: 'var(--color-vermilion, #B8463A)',
              height: 36,
              minWidth: 36,
            }}
          />
        )}
      </div>
    </div>
  )
})

export default WorkshopChatInput

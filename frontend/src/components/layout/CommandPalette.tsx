/** 全局搜索命令面板 — ⌘K 触发，Modal 浮层 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal, Input, List, Avatar, Tag, Spin, Empty } from 'antd'
import { Search, Bot, Building2, ImageIcon, CornerDownLeft } from 'lucide-react'
import { globalSearch, type SearchResult } from '../../services/search'
import { normalizeImageUrl } from '../../utils/imageUrl'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  heritage: <Building2 size={16} />,
  inheritor: <Bot size={16} />,
  upload: <ImageIcon size={16} />,
}

const TYPE_LABELS: Record<string, string> = {
  heritage: '藏品',
  inheritor: '传承人',
  upload: '上传',
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate()
  const inputRef = useRef<any>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [searching, setSearching] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)

  // 打开时聚焦输入框
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      setQuery('')
      setResults([])
      setSelectedIdx(0)
    }
  }, [open])

  // 搜索防抖
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setTotal(0)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const data = await globalSearch(query.trim(), 'all', 10)
        setResults(data.results)
        setTotal(data.total)
        setSelectedIdx(0)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      e.preventDefault()
      handleSelect(results[selectedIdx])
    }
  }, [results, selectedIdx])

  const handleSelect = (item: SearchResult) => {
    navigate(item.route)
    onClose()
  }

  // 全局快捷键 Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) onClose(); else onClose() // toggle handled by parent
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={560}
      styles={{
        body: { padding: 0 },
        content: { borderRadius: 14, overflow: 'hidden' },
      }}
      style={{ top: '15vh' }}
      destroyOnClose
    >
      {/* 搜索输入 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '16px 20px',
        borderBottom: results.length > 0 || query ? '1px solid var(--gray-100)' : 'none',
      }}>
        <Search size={18} style={{ color: 'var(--color-ink-secondary)', flexShrink: 0 }} />
        <Input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索非遗藏品、传承人、作品..."
          variant="borderless"
          size="large"
          style={{ fontSize: 'var(--text-base)', padding: 0 }}
        />
        <Tag style={{
          fontFamily: 'monospace',
          fontSize: 11,
          color: 'var(--color-ink-secondary)',
          background: 'var(--gray-100)',
          border: 'none',
          borderRadius: 4,
          flexShrink: 0,
        }}>
          ⌘K
        </Tag>
      </div>

      {/* 结果列表 */}
      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        {searching && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        )}

        {!searching && query && results.length === 0 && (
          <Empty
            description={`未找到「${query}」相关结果`}
            style={{ padding: 40 }}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}

        {!searching && results.length > 0 && (
          <List
            dataSource={results}
            renderItem={(item, idx) => (
              <List.Item
                key={`${item.type}-${item.id}`}
                onClick={() => handleSelect(item)}
                style={{
                  cursor: 'pointer',
                  padding: '12px 20px',
                  background: idx === selectedIdx ? 'rgba(196,162,101,0.08)' : 'transparent',
                  transition: 'background 0.15s',
                  borderBottom: '1px solid var(--gray-50)',
                }}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size={40}
                      src={normalizeImageUrl(item.image_url)}
                      icon={TYPE_ICONS[item.type]}
                      shape={item.type === 'inheritor' ? 'circle' : 'square'}
                      style={{
                        background: 'var(--color-paper)',
                        borderRadius: item.type === 'inheritor' ? '50%' : 6,
                      }}
                    />
                  }
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                        {item.title}
                      </span>
                      <Tag style={{
                        fontSize: 11, margin: 0, lineHeight: '18px',
                        borderRadius: 4, border: 'none',
                        background: 'var(--color-gold-light)',
                        color: 'var(--color-ink-secondary)',
                      }}>
                        {TYPE_LABELS[item.type]}
                      </Tag>
                    </div>
                  }
                  description={
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>
                      {item.subtitle}
                    </span>
                  }
                />
                <CornerDownLeft size={14} style={{ color: 'var(--color-border-medium)', flexShrink: 0 }} />
              </List.Item>
            )}
          />
        )}
      </div>

      {/* 底部提示 */}
      {results.length > 0 && (
        <div style={{
          padding: '8px 20px',
          borderTop: '1px solid var(--gray-100)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-ink-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>共 {total} 条结果</span>
          <span>↑↓ 导航 · ↵ 打开 · Esc 关闭</span>
        </div>
      )}
    </Modal>
  )
}

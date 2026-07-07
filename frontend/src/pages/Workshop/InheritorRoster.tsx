import { Avatar, Tag, Button, Tooltip, Dropdown, Badge } from 'antd'
import {
  User, Plus, Trash2, Pencil,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { InheritorInfo, } from './index'

interface Props {
  presets: InheritorInfo[]
  customs: InheritorInfo[]
  selectedId: string
  onSelect: (id: string) => void
  onDeleteCustom: (id: number) => void
  onRefresh: () => void
  recommendedId?: string  // 千人千面 — 推荐传承人 ID
}

export default function InheritorRoster({ presets, customs, selectedId, onSelect, onDeleteCustom, onRefresh, recommendedId }: Props) {
  const navigate = useNavigate()

  // 删除自定义传承人
  const handleDelete = async (item: InheritorInfo) => {
    const id = parseInt(item.id.replace('custom:', ''), 10)
    if (isNaN(id)) return
    const { deleteInheritor } = await import('../../services/inheritor')
    try {
      await deleteInheritor(id)
      onDeleteCustom(id)
    } catch { /* ignore */ }
  }

  const renderItem = (item: InheritorInfo) => {
    const isSelected = selectedId === item.id
    const isRecommended = recommendedId === item.id && !isSelected
    return (
      <div
        key={item.id}
        onClick={() => onSelect(item.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          cursor: 'pointer',
          borderRadius: 8,
          background: isSelected ? 'var(--color-vermilion, #B8463A)' : 'transparent',
          color: isSelected ? '#fff' : 'var(--color-ink, #2C241A)',
          transition: 'all 0.2s',
          marginBottom: 8,
          borderLeft: isSelected ? '3px solid var(--color-vermilion, #B8463A)'
            : isRecommended ? '3px solid var(--color-gold, #C4A265)' : '3px solid transparent',
          border: isRecommended ? '1px solid var(--color-gold-light, #E8D5B0)' : '1px solid transparent',
          position: 'relative' as const,
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'rgba(184,70,58,0.08)'
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'transparent'
        }}
      >
        {/* 为你推荐 徽标 */}
        {isRecommended && (
          <span style={{
            position: 'absolute',
            top: -6,
            right: -6,
            fontSize: 'var(--text-xs)',
            background: 'var(--color-gold, #C4A265)',
            color: '#fff',
            padding: '1px 6px',
            borderRadius: 4,
            fontWeight: 600,
            zIndex: 1,
          }}>
            为你推荐
          </span>
        )}
        <Avatar
          size={40}
          src={item.avatar}
          icon={<User />}
          style={{ flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {item.name}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
            {item.tools.slice(0, 2).map(t => (
              <Tag
                key={t}
                style={{
                  fontSize: 'var(--text-xs)',
                  padding: '2px 8px',
                  margin: 0,
                  lineHeight: '20px',
                  background: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(184,70,58,0.08)',
                  color: isSelected ? '#fff' : 'var(--color-vermilion, #B8463A)',
                  border: 'none',
                }}
              >
                {t === 'inspect' ? '识物' : t === 'create' ? '创作' : t === 'connect' ? '关联' : '教学'}
              </Tag>
            ))}
            {item.tools.length > 2 && (
              <Tag style={{ fontSize: 'var(--text-xs)', padding: '2px 8px', margin: 0, lineHeight: '20px', background: 'transparent' }}>
                +{item.tools.length - 2}
              </Tag>
            )}
          </div>
        </div>
        {item.isCustom && (
          <Dropdown
            menu={{
              items: [
                {
                  key: 'delete',
                  icon: <Trash2 />,
                  danger: true,
                  label: '删除',
                  onClick: (e) => { e.domEvent.stopPropagation(); handleDelete(item) },
                },
              ],
            }}
            trigger={['click']}
          >
            <Button
              type="text"
              size="small"
              icon={<Pencil />}
              onClick={(e) => e.stopPropagation()}
              style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--color-ink-secondary, #6B5F52)' }}
            />
          </Dropdown>
        )}
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-paper-white, #FFFDF9)',
      borderRadius: 12,
      padding: 16,
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(30,27,24,0.06))',
    }}>
      {/* 预设传承人 */}
      <div style={{
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        color: 'var(--color-ink-secondary, #6B5F52)',
        marginBottom: 12,
        paddingLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
      }}>
        系统传承人
      </div>
      <div style={{ flex: 1, overflow: 'auto', marginBottom: 12 }}>
        {presets.map(renderItem)}
      </div>

      {/* 分隔线 */}
      <div style={{
        borderTop: '1px solid rgba(44, 36, 26, 0.08)',
        marginBottom: 8,
      }} />

      {/* 自定义传承人 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingLeft: 4,
      }}>
        <span style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          color: 'var(--color-ink-secondary, #6B5F52)',
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          我的传承人 ({customs.length}/10)
        </span>
        <Tooltip title={customs.length >= 10 ? '已达到上限（10个）' : '创建自定义传承人'}>
          <Button
            type="text"
            size="small"
            icon={<Plus />}
            onClick={() => navigate('/workshop/wizard')}
            disabled={customs.length >= 10}
            style={{ color: customs.length >= 10 ? 'var(--color-ink-secondary, #6B5F52)' : 'var(--color-vermilion, #B8463A)' }}
          />
        </Tooltip>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {customs.length === 0 ? (
          <div style={{
            padding: 16,
            textAlign: 'center',
            color: 'var(--color-ink-secondary, #6B5F52)',
            fontSize: 'var(--text-sm)',
          }}>
            还没有自定义传承人
            <br />
            <Button
              type="link"
              onClick={() => navigate('/workshop/wizard')}
              style={{ padding: 0, marginTop: 8 }}
            >
              点击创建第一个
            </Button>
          </div>
        ) : (
          customs.map(renderItem)
        )}
      </div>
    </div>
  )
}

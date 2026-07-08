import { useState, useRef, useEffect } from 'react'
import { Avatar, Tag, Button, Tooltip, Dropdown, message } from 'antd'
import {
  User, Plus, Trash2, Pencil, Camera,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import type { InheritorInfo, } from './index'
import AvatarCropper from '../../components/AvatarCropper'

const STORAGE_KEY = 'inheritor_avatar_overrides'

function loadOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveOverrides(overrides: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

interface Props {
  presets: InheritorInfo[]
  customs: InheritorInfo[]
  selectedId: string
  onSelect: (id: string) => void
  onDeleteCustom: (id: number) => void
  onRefresh: () => void
  recommendedId?: string
}

export default function InheritorRoster({ presets, customs, selectedId, onSelect, onDeleteCustom, onRefresh, recommendedId }: Props) {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarOverrides, setAvatarOverrides] = useState<Record<string, string>>(loadOverrides)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [cropperOpen, setCropperOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingInheritor, setPendingInheritor] = useState<InheritorInfo | null>(null)

  // 获取实际头像（优先覆盖）
  const getAvatar = (item: InheritorInfo) => avatarOverrides[item.id] || item.avatar

  // 打开文件选择器
  const openFilePicker = (item: InheritorInfo) => {
    setEditingId(item.id)
    fileInputRef.current?.click()
  }

  // 文件选择回调 → 打开裁剪器
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editingId) return

    // 校验
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      message.error('请上传 JPG / PNG / WebP 格式的图片')
      e.target.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error('图片大小不能超过 10MB')
      e.target.value = ''
      return
    }

    const all = [...presets, ...customs]
    const item = all.find(i => i.id === editingId)
    if (item) {
      setPendingInheritor(item)
      setPendingFile(file)
      setCropperOpen(true)
    }

    // 重置 input
    e.target.value = ''
  }

  // 裁剪确认 → 上传
  const handleCropConfirm = async (croppedFile: File) => {
    setCropperOpen(false)
    if (!pendingInheritor) return
    const item = pendingInheritor
    setPendingInheritor(null)
    setPendingFile(null)

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', croppedFile)
      const res = await api.post('/api/user/upload-avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })
      const url = res.data.url

      // 更新覆盖
      const newOverrides = { ...avatarOverrides, [item.id]: url }
      setAvatarOverrides(newOverrides)
      saveOverrides(newOverrides)

      // 自定义传承人同时更新 DB
      if (item.isCustom) {
        const dbId = parseInt(item.id.replace('custom:', ''), 10)
        if (!isNaN(dbId)) {
          const { updateInheritor } = await import('../../services/inheritor')
          await updateInheritor(dbId, { avatar_url: url })
        }
      }

      message.success('头像已更新')
      onRefresh()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '头像上传失败')
    } finally {
      setUploading(false)
      setEditingId(null)
    }
  }

  // 删除自定义传承人
  const handleDelete = async (item: InheritorInfo) => {
    const id = parseInt(item.id.replace('custom:', ''), 10)
    if (isNaN(id)) return
    const { deleteInheritor } = await import('../../services/inheritor')
    try {
      await deleteInheritor(id)
      // 清除该传承人的头像覆盖
      const newOverrides = { ...avatarOverrides }
      delete newOverrides[item.id]
      setAvatarOverrides(newOverrides)
      saveOverrides(newOverrides)
      onDeleteCustom(id)
    } catch { /* ignore */ }
  }

  const renderItem = (item: InheritorInfo) => {
    const isSelected = selectedId === item.id
    const isRecommended = recommendedId === item.id && !isSelected
    const resolvedAvatar = getAvatar(item)

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

        {/* 头像 — 点击更换 */}
        <Tooltip title="点击更换头像">
          <div
            style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); openFilePicker(item) }}
          >
            <Avatar
              size={60}
              src={resolvedAvatar}
              icon={<User />}
            />
            {/* hover 时显示的相机图标 */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0,
              transition: 'opacity 0.2s',
            }}
              className="avatar-edit-overlay"
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0' }}
            >
              <Camera size={20} color="#fff" />
            </div>
          </div>
        </Tooltip>

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

        {/* 编辑/删除按钮 — 仅自定义传承人 */}
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
      {/* 隐藏的文件选择器 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />

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

      {/* 头像裁剪弹窗 */}
      <AvatarCropper
        open={cropperOpen}
        file={pendingFile}
        onConfirm={handleCropConfirm}
        onCancel={() => { setCropperOpen(false); setPendingFile(null); setPendingInheritor(null); setEditingId(null) }}
      />
    </div>
  )
}

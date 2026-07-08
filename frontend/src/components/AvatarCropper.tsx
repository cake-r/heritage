import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { Modal, Slider, Button, Space } from 'antd'
import type { Area } from 'react-easy-crop'

interface Props {
  open: boolean
  file: File | null
  onConfirm: (croppedFile: File) => void
  onCancel: () => void
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image()
  image.src = imageSrc
  await new Promise<void>((resolve) => { image.onload = () => resolve() })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const size = Math.min(pixelCrop.width, pixelCrop.height)
  canvas.width = size
  canvas.height = size

  // 圆形裁剪：用 clip 画圆形，再 drawImage
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, size, size,
  )

  return new Promise<Blob>((resolve) => {
    canvas.toBlob(blob => resolve(blob!), 'image/png')
  })
}

export default function AvatarCropper({ open, file, onConfirm, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [processing, setProcessing] = useState(false)

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleConfirm = async () => {
    if (!file || !croppedAreaPixels) return
    setProcessing(true)
    try {
      const objectUrl = URL.createObjectURL(file)
      const blob = await getCroppedImg(objectUrl, croppedAreaPixels)
      URL.revokeObjectURL(objectUrl)

      const croppedFile = new File([blob], `avatar_${Date.now()}.png`, { type: 'image/png' })
      onConfirm(croppedFile)
    } catch {
      // ignore
    } finally {
      setProcessing(false)
    }
  }

  const handleCancel = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    onCancel()
  }

  const imageUrl = file ? URL.createObjectURL(file) : ''

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={480}
      centered
      title="裁剪头像"
      destroyOnClose
      afterClose={() => { if (imageUrl) URL.revokeObjectURL(imageUrl) }}
    >
      <div style={{ position: 'relative', width: '100%', height: 360, background: '#1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
        {imageUrl && (
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        )}
      </div>

      <div style={{ marginTop: 16, padding: '0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, color: 'var(--color-ink-secondary, #6B5F52)', whiteSpace: 'nowrap' }}>缩放</span>
          <Slider
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={setZoom}
            style={{ flex: 1 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
        <Button onClick={handleCancel}>取消</Button>
        <Button type="primary" loading={processing} onClick={handleConfirm}>
          确认裁剪
        </Button>
      </div>
    </Modal>
  )
}

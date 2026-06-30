import { useState, useRef, useEffect } from 'react'
import { Button, Slider, Space, Typography } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  SoundOutlined,
} from '@ant-design/icons'

const { Text } = Typography

interface Props {
  src: string | null
  title?: string
}

export default function AudioPlayer({ src, title = '语音讲解' }: Props) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1.0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!src) return
    const audio = new Audio(src)
    audioRef.current = audio

    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration))
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime))
    audio.addEventListener('ended', () => setPlaying(false))
    audio.addEventListener('error', () => setPlaying(false))

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [src])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed
    }
  }, [speed])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(() => {})
    }
    setPlaying(!playing)
  }

  const handleSeek = (value: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value
      setCurrentTime(value)
    }
  }

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (!src) return null

  return (
    <div style={{ padding: '14px 18px', background: 'var(--color-paper, #F7F4ED)', borderRadius: 8 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Space>
          <SoundOutlined style={{ color: 'var(--color-vermilion, #B8463A)' }} />
          <Text strong>{title}</Text>
        </Space>

        <Space style={{ width: '100%' }}>
          <Button
            type="primary"
            shape="circle"
            icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={togglePlay}
          />
          <Slider
            style={{ flex: 1 }}
            min={0}
            max={duration || 1}
            value={currentTime}
            onChange={handleSeek}
            tooltip={{ formatter: (v?: number) => formatTime(v ?? 0) }}
          />
          <Text type="secondary" style={{ fontSize: 'var(--text-sm)', minWidth: 60 }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </Space>

        <Space>
          <Text type="secondary" style={{ fontSize: 'var(--text-sm)' }}>语速:</Text>
          {[0.5, 1.0, 1.5].map(s => (
            <Button
              key={s}
              type={speed === s ? 'primary' : 'default'}
              onClick={() => setSpeed(s)}
              style={{ minWidth: 40 }}
            >
              {s}x
            </Button>
          ))}
        </Space>
      </Space>
    </div>
  )
}

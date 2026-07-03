import React, { useRef, useEffect, useCallback, useState, useImperativeHandle, forwardRef } from 'react'
import { Button, Tooltip, message, Spin } from 'antd'
import {
  DeleteOutlined, ZoomInOutlined, ZoomOutOutlined,
  UndoOutlined, RedoOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import type { ToolType } from './ToolPanel'
import { normalizeImageUrl } from '../../utils/imageUrl'
import { localInpaint } from '../../services/restorationWorkbench'

export interface RepairCanvasHandle {
  getCanvasImageUrl: () => string | null
  addPatternImage: (dataUrl: string) => void
  clearMarkers: () => void
}

interface Props {
  imageUrl: string
  activeTool: ToolType
  onRegionSelected?: (region: { x: number; y: number; width: number; height: number }) => void
}

const RepairCanvas = forwardRef<RepairCanvasHandle, Props>(
  function RepairCanvas({ imageUrl, activeTool, onRegionSelected }, ref) {
    const canvasElRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const fabricRef = useRef<any>(null)
    const imgInstanceRef = useRef<any>(null)
    const rectRef = useRef<any>(null)
    const [zoom, setZoom] = useState(1)
    const [restoring, setRestoring] = useState(false)
    const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 })

    // Initialize Fabric canvas
    useEffect(() => {
      let disposed = false

      const initCanvas = async () => {
        const { Canvas, FabricImage, Rect } = await import('fabric')

        if (disposed || !canvasElRef.current) return

        const canvas = new Canvas(canvasElRef.current, {
          width: canvasSize.w,
          height: canvasSize.h,
          backgroundColor: '#f5f0e8',
          selection: false,
        })
        fabricRef.current = canvas

        // Load background image
        try {
          const imgUrl = normalizeImageUrl(imageUrl)
          const img = await FabricImage.fromURL(imgUrl, { crossOrigin: 'anonymous' })
          if (disposed) return

          const maxW = containerRef.current?.clientWidth || 800
          const maxH = Math.min(window.innerHeight * 0.65, 700)
          const scale = Math.min(maxW / img.width, maxH / img.height, 1)

          canvas.setDimensions({ width: img.width * scale, height: img.height * scale })
          setCanvasSize({ w: img.width * scale, h: img.height * scale })

          img.set({
            left: 0,
            top: 0,
            scaleX: scale,
            scaleY: scale,
            selectable: false,
            evented: false,
          })
          canvas.backgroundImage = img
          imgInstanceRef.current = img
          canvas.renderAll()
        } catch (err) {
          console.error('Failed to load image:', err)
        }
      }

      initCanvas()

      return () => {
        disposed = true
        if (fabricRef.current) {
          fabricRef.current.dispose()
          fabricRef.current = null
        }
      }
    }, [imageUrl]) // eslint-disable-line react-hooks/exhaustive-deps

    // Handle tool changes
    useEffect(() => {
      const canvas = fabricRef.current
      if (!canvas) return

      canvas.off('mouse:down')
      canvas.off('mouse:move')
      canvas.off('mouse:up')

      if (activeTool === 'region_select') {
        enableRegionSelect(canvas)
      } else if (activeTool === 'stain_brush') {
        enableStainBrush(canvas)
      } else if (activeTool === 'pattern_library') {
        canvas.selection = true
      } else {
        canvas.selection = false
      }

      canvas.renderAll()
    }, [activeTool]) // eslint-disable-line react-hooks/exhaustive-deps

    // Region select mode
    const enableRegionSelect = useCallback((canvas: any) => {
      const { Rect } = require('fabric')
      let isDrawing = false
      let startX = 0
      let startY = 0

      canvas.selection = false
      canvas.defaultCursor = 'crosshair'

      canvas.on('mouse:down', (opt: any) => {
        isDrawing = true
        const pointer = canvas.getScenePoint(opt.e)
        startX = pointer.x
        startY = pointer.y

        if (rectRef.current) {
          canvas.remove(rectRef.current)
        }

        rectRef.current = new Rect({
          left: startX,
          top: startY,
          width: 0,
          height: 0,
          fill: 'rgba(184, 70, 58, 0.15)',
          stroke: '#B8463A',
          strokeWidth: 2,
          strokeDashArray: [6, 3],
          selectable: false,
          evented: false,
        })
        canvas.add(rectRef.current)
      })

      canvas.on('mouse:move', (opt: any) => {
        if (!isDrawing || !rectRef.current) return
        const pointer = canvas.getScenePoint(opt.e)
        const w = pointer.x - startX
        const h = pointer.y - startY

        rectRef.current.set({
          left: w > 0 ? startX : pointer.x,
          top: h > 0 ? startY : pointer.y,
          width: Math.abs(w),
          height: Math.abs(h),
        })
        canvas.renderAll()
      })

      canvas.on('mouse:up', () => {
        if (!isDrawing || !rectRef.current) return
        isDrawing = false

        const r = rectRef.current
        const region = {
          x: Math.round(r.left),
          y: Math.round(r.top),
          width: Math.round(r.width * r.scaleX),
          height: Math.round(r.height * r.scaleY),
        }

        if (region.width > 10 && region.height > 10) {
          onRegionSelected?.(region)
        }
      })
    }, [onRegionSelected])

    // Stain brush mode
    const enableStainBrush = useCallback((canvas: any) => {
      const { PencilBrush } = require('fabric')
      canvas.selection = false
      canvas.freeDrawingBrush = new PencilBrush(canvas)
      canvas.freeDrawingBrush.color = 'rgba(184, 70, 58, 0.3)'
      canvas.freeDrawingBrush.width = 20
      canvas.isDrawingMode = true
    }, [])

    // Expose methods
    useImperativeHandle(ref, () => ({
      getCanvasImageUrl: () => {
        const canvas = fabricRef.current
        if (!canvas) return null
        return canvas.toDataURL({ format: 'png', multiplier: 2 })
      },
      addPatternImage: (dataUrl: string) => {
        const canvas = fabricRef.current
        if (!canvas) return

        const { FabricImage } = require('fabric')
        FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' }).then((img: any) => {
          const scale = Math.min(
            (canvas.width || 800) / (img.width || 100) * 0.4,
            0.5,
          )
          img.set({
            left: (canvas.width || 800) / 2 - (img.width * scale) / 2,
            top: (canvas.height || 600) / 2 - (img.height * scale) / 2,
            scaleX: scale,
            scaleY: scale,
            selectable: true,
          })
          canvas.add(img)
          canvas.setActiveObject(img)
          canvas.renderAll()
        })
      },
      clearMarkers: () => {
        const canvas = fabricRef.current
        if (!canvas) return
        // Remove all non-background objects
        const objects = canvas.getObjects()
        objects.forEach((obj: any) => canvas.remove(obj))
        if (rectRef.current) {
          rectRef.current = null
        }
        canvas.renderAll()
      },
    }), [])

    // Zoom controls
    const handleZoomIn = () => setZoom(z => Math.min(2, z + 0.1))
    const handleZoomOut = () => setZoom(z => Math.max(0.2, z - 0.1))

    // Undo/Redo - simple implementation
    const handleUndo = () => {
      const canvas = fabricRef.current
      if (!canvas) return
      const objects = canvas.getObjects()
      if (objects.length > 0) {
        canvas.remove(objects[objects.length - 1])
        canvas.renderAll()
      }
    }

    return (
      <div style={{ position: 'relative' }}>
        {/* Floating toolbar */}
        <div style={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 10,
          display: 'flex',
          gap: 4,
          background: 'rgba(255,255,255,0.9)',
          borderRadius: 8,
          padding: '4px 6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <Tooltip title="放大">
            <Button size="small" icon={<ZoomInOutlined />} onClick={handleZoomIn} />
          </Tooltip>
          <span style={{ fontSize: 13, padding: '0 4px', lineHeight: '24px', color: '#666', fontWeight: 500 }}>
            {Math.round(zoom * 100)}%
          </span>
          <Tooltip title="缩小">
            <Button size="small" icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
          </Tooltip>
          <div style={{ width: 1, height: 20, background: '#e0d8c8', margin: '2px 4px' }} />
          <Tooltip title="撤销">
            <Button size="small" icon={<UndoOutlined />} onClick={handleUndo} />
          </Tooltip>
          <Tooltip title="清除标记">
            <Button
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => {
                const canvas = fabricRef.current
                if (canvas && rectRef.current) {
                  canvas.remove(rectRef.current)
                  rectRef.current = null
                  canvas.renderAll()
                }
              }}
            />
          </Tooltip>
        </div>

        {/* Restoring spinner overlay */}
        {restoring && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.7)',
            zIndex: 20,
            borderRadius: 8,
          }}>
            <Spin tip="AI 局部修复中..." />
          </div>
        )}

        {/* Canvas */}
        <div ref={containerRef} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e8e0d5' }}>
          <canvas ref={canvasElRef} />
        </div>

        {/* Tool hint */}
        <div style={{
          marginTop: 8,
          textAlign: 'center',
          fontSize: 12,
          color: '#999',
        }}>
          {activeTool === 'region_select' && '拖拽框选损伤区域，松开后提交 AI 修复'}
          {activeTool === 'stain_brush' && '在画布上涂抹需要修复的区域'}
          {activeTool === 'pattern_library' && '点击「纹样库」工具选择纹样，拖拽到画布上'}
          {activeTool === 'color_palette' && '此工具将在后续版本中推出'}
          {activeTool === 'line_pen' && '此工具将在后续版本中推出'}
        </div>
      </div>
    )
  },
)

export default RepairCanvas

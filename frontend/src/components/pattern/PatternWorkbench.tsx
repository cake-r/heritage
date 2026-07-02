import React, { useState, useCallback, useRef } from 'react'
import {
  DndContext, useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { Button, Slider, Space, Tooltip, message, Spin } from 'antd'
import {
  DeleteOutlined, DownloadOutlined, ZoomInOutlined,
  ZoomOutOutlined, RotateRightOutlined, EyeOutlined,
  VerticalAlignTopOutlined, VerticalAlignBottomOutlined,
} from '@ant-design/icons'
import html2canvas from 'html2canvas'
import type { PatternGene } from '../../services/patternEngine'
import { CARRIER_TEMPLATES, type CarrierTemplate } from './CarrierTemplate'

// ==================== Types ====================

interface PlacedItem {
  uid: string
  gene: PatternGene
  x: number
  y: number
  scale: number
  rotation: number
  color: string
  zIndex: number
}

interface Props {
  genes: PatternGene[]
  carrierKey: string
}

// ==================== Draggable Gene (Source Panel) ====================

function DraggableGene({ gene }: { gene: PatternGene }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `source-${gene.gene_id}`,
    data: { type: 'gene-source', gene },
  })

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
    cursor: 'grab',
    padding: '8px 12px',
    background: '#fff',
    border: '1px solid #e8e0d5',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    userSelect: 'none',
    transition: 'box-shadow 0.2s',
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <svg
        viewBox={gene.svg_viewbox || '0 0 100 100'}
        width="40" height="40"
        style={{ flexShrink: 0 }}
        dangerouslySetInnerHTML={{ __html: gene.svg_content }}
      />
      <span style={{ fontSize: 14, fontWeight: 500 }}>{gene.name}</span>
    </div>
  )
}

// ==================== Droppable Canvas ====================

function DroppableCanvas({
  children, carrier, scale,
}: {
  children: React.ReactNode
  carrier: CarrierTemplate
  scale: number
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' })

  return (
    <div
      ref={setNodeRef}
      style={{
        width: carrier.width * scale,
        height: carrier.height * scale,
        background: '#fff',
        position: 'relative',
        overflow: 'hidden',
        border: isOver ? '2px dashed #B8463A' : '2px dashed #e0d8c8',
        borderRadius: 4,
        transition: 'border 0.2s',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        ...carrier.borderStyle,
      }}
    >
      {children}
    </div>
  )
}

// ==================== Placed Item on Canvas ====================

function PlacedPattern({
  item, isSelected, onClick,
}: {
  item: PlacedItem
  isSelected: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `placed-${item.uid}`,
    data: { type: 'placed-item', uid: item.uid },
  })

  // Item size — scale is applied to container width/height, not via CSS transform
  const itemSize = 100 * item.scale

  const baseTransform = `translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg)`
  const dragTransform = transform
    ? `translate(${transform.x}px, ${transform.y}px)`
    : ''

  // Apply color by replacing stroke/fill colors in SVG
  const coloredSvg = item.gene.svg_content
    .replace(/stroke='#[^']*'/g, `stroke='${item.color}'`)
    .replace(/stroke="[^"]*"/g, `stroke="${item.color}"`)
    .replace(/fill='#(?!fff|FFF|ffffff|FFFFFF|none)[^']*'/g, `fill='${item.color}'`)

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: itemSize,
        height: itemSize,
        transform: `${baseTransform} ${dragTransform}`,
        transformOrigin: 'center center',
        zIndex: item.zIndex,
        cursor: 'move',
        outline: isSelected ? '2px solid #4A90C4' : 'none',
        outlineOffset: 2,
        borderRadius: 4,
        touchAction: 'none',
      }}
    >
      <svg
        viewBox={item.gene.svg_viewbox || '0 0 100 100'}
        width="100%"
        height="100%"
        style={{ display: 'block', overflow: 'visible' }}
        dangerouslySetInnerHTML={{ __html: coloredSvg }}
      />
    </div>
  )
}

// ==================== Main Workbench ====================

let uidCounter = 0

const PatternWorkbench: React.FC<Props> = ({ genes, carrierKey }) => {
  const carrier = CARRIER_TEMPLATES.find(t => t.key === carrierKey) || CARRIER_TEMPLATES[0]
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([])
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [canvasScale, setCanvasScale] = useState(0.6)
  const [exporting, setExporting] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragStartPos = useRef<Map<string, { x: number; y: number }>>(new Map())

  const selectedItem = placedItems.find(p => p.uid === selectedUid) || null

  // === Drag handlers ===

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const newMap = new Map<string, { x: number; y: number }>()
    placedItems.forEach(p => {
      newMap.set(p.uid, { x: p.x, y: p.y })
    })
    dragStartPos.current = newMap
  }, [placedItems])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over, delta } = event

    // Case 1: Gene source dropped on canvas → create new placed item
    if (active.data.current?.type === 'gene-source' && over?.id === 'canvas') {
      const gene = active.data.current.gene as PatternGene
      const canvasWidth = (over.rect?.width || 400)
      const canvasHeight = (over.rect?.height || 400)
      // Place at drop position, centered on the SVG
      const svgSize = 100 // default SVG size at scale 1.0
      const newItem: PlacedItem = {
        uid: `item_${++uidCounter}_${Date.now()}`,
        gene,
        x: Math.max(0, Math.min(canvasWidth - svgSize, (delta.x || 0) + canvasWidth / 2 - svgSize / 2)),
        y: Math.max(0, Math.min(canvasHeight - svgSize, (delta.y || 0) + canvasHeight / 2 - svgSize / 2)),
        scale: 1.0,
        rotation: 0,
        color: gene.default_color,
        zIndex: placedItems.length + 1,
      }
      setPlacedItems(prev => [...prev, newItem])
      setSelectedUid(newItem.uid)
      return
    }

    // Case 2: Placed item moved within canvas
    if (active.data.current?.type === 'placed-item') {
      const uid = active.data.current.uid as string
      const startPos = dragStartPos.current.get(uid)
      if (!startPos) return

      setPlacedItems(prev =>
        prev.map(p =>
          p.uid === uid
            ? { ...p, x: startPos.x + (delta.x || 0), y: startPos.y + (delta.y || 0) }
            : p
        )
      )
    }
  }, [placedItems])

  // === Item controls ===

  const updateSelected = useCallback((patch: Partial<PlacedItem>) => {
    if (!selectedUid) return
    setPlacedItems(prev =>
      prev.map(p => (p.uid === selectedUid ? { ...p, ...patch } : p))
    )
  }, [selectedUid])

  const deleteSelected = useCallback(() => {
    if (!selectedUid) return
    setPlacedItems(prev => prev.filter(p => p.uid !== selectedUid))
    setSelectedUid(null)
  }, [selectedUid])

  const bringForward = useCallback(() => {
    if (!selectedUid) return
    setPlacedItems(prev => {
      const maxZ = Math.max(...prev.map(p => p.zIndex), 0)
      return prev.map(p => (p.uid === selectedUid ? { ...p, zIndex: maxZ + 1 } : p))
    })
  }, [selectedUid])

  const sendBackward = useCallback(() => {
    if (!selectedUid) return
    setPlacedItems(prev => {
      const minZ = Math.min(...prev.map(p => p.zIndex), 0)
      return prev.map(p => (p.uid === selectedUid ? { ...p, zIndex: minZ - 1 } : p))
    })
  }, [selectedUid])

  // === Export ===

  const handleExport = useCallback(async () => {
    if (!canvasRef.current) return
    setExporting(true)
    try {
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: '#ffffff',
        scale: 3,
        useCORS: true,
      })
      const link = document.createElement('a')
      link.download = `pattern-work-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      message.success('导出成功！')
    } catch (err) {
      message.error('导出失败，请重试')
    } finally {
      setExporting(false)
    }
  }, [])

  // === Render ===

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', gap: 16, height: '100%' }}>
        {/* === Left Panel: Gene Library === */}
        <div style={{
          width: 220,
          flexShrink: 0,
          background: '#FAF7F2',
          borderRadius: 10,
          padding: 14,
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 280px)',
          border: '1px solid #e8e0d5',
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, color: '#1E1B18' }}>
            纹样基因库
          </div>
          {genes.map(gene => (
            <DraggableGene key={gene.gene_id} gene={gene} />
          ))}
          {genes.length === 0 && (
            <div style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: 24 }}>
              请先识别纹样
            </div>
          )}
        </div>

        {/* === Center: Canvas === */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Canvas controls */}
          <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Tooltip title="缩小画布">
              <Button size="small" icon={<ZoomOutOutlined />}
                onClick={() => setCanvasScale(s => Math.max(0.2, s - 0.1))} />
            </Tooltip>
            <span style={{ fontSize: 14, color: '#666', minWidth: 44, textAlign: 'center', fontWeight: 500 }}>
              {Math.round(canvasScale * 100)}%
            </span>
            <Tooltip title="放大画布">
              <Button size="small" icon={<ZoomInOutlined />}
                onClick={() => setCanvasScale(s => Math.min(1.5, s + 0.1))} />
            </Tooltip>
            <div style={{ width: 1, height: 20, background: '#e0d8c8', margin: '0 4px' }} />
            <Tooltip title="导出PNG">
              <Button size="small" type="primary" icon={<DownloadOutlined />}
                onClick={handleExport} loading={exporting}>
                导出
              </Button>
            </Tooltip>
          </div>

          {/* Canvas area */}
          <div
            ref={canvasRef}
            style={{ overflow: 'auto', maxHeight: 'calc(100vh - 340px)', padding: 8 }}
          >
            <DroppableCanvas carrier={carrier} scale={canvasScale}>
              {placedItems.map(item => (
                <PlacedPattern
                  key={item.uid}
                  item={item}
                  isSelected={item.uid === selectedUid}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedUid(item.uid)
                  }}
                />
              ))}
            </DroppableCanvas>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#999' }}>
            {carrier.name} · {carrier.width}×{carrier.height} · 拖拽左侧纹样到画布
          </div>
        </div>

        {/* === Right Panel: Controls === */}
        <div style={{
          width: 220,
          flexShrink: 0,
          background: '#FAF7F2',
          borderRadius: 10,
          padding: 14,
          border: '1px solid #e8e0d5',
          maxHeight: 'calc(100vh - 280px)',
          overflowY: 'auto',
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: '#1E1B18' }}>
            属性控制
          </div>

          {selectedItem ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{selectedItem.gene.name}</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
                {selectedItem.gene.shape_category} · {selectedItem.gene.meaning}
              </div>

              {/* Scale */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, marginBottom: 6, fontWeight: 500 }}>缩放</div>
                <Slider
                  min={0.3} max={3.0} step={0.1}
                  value={selectedItem.scale}
                  onChange={v => updateSelected({ scale: v })}
                />
              </div>

              {/* Rotation */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, marginBottom: 6, fontWeight: 500 }}>旋转</div>
                <Slider
                  min={0} max={360} step={5}
                  value={selectedItem.rotation}
                  onChange={v => updateSelected({ rotation: v })}
                />
              </div>

              {/* Color presets */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, marginBottom: 8, fontWeight: 500 }}>配色</div>
                <Space wrap size={[6, 6]}>
                  {['#B8463A', '#C4A265', '#1E1B18', '#5B8C5A', '#4A90C4', '#E8A0B0', '#D4A0C0', '#7BA3D6', '#8B7355'].map(c => (
                    <div
                      key={c}
                      onClick={() => updateSelected({ color: c })}
                      style={{
                        width: 28, height: 28, borderRadius: 14,
                        background: c,
                        cursor: 'pointer',
                        border: selectedItem.color === c ? '3px solid #1E1B18' : '2px solid #fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'border 0.15s',
                      }}
                    />
                  ))}
                </Space>
              </div>

              {/* Actions */}
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button block size="small" icon={<VerticalAlignTopOutlined />} onClick={bringForward}>
                  上移一层
                </Button>
                <Button block size="small" icon={<VerticalAlignBottomOutlined />} onClick={sendBackward}>
                  下移一层
                </Button>
                <Button block size="small" danger icon={<DeleteOutlined />} onClick={deleteSelected}>
                  删除
                </Button>
              </Space>
            </>
          ) : (
            <div style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: 24 }}>
              点击画布上的纹样<br />进行编辑
            </div>
          )}
        </div>
      </div>
    </DndContext>
  )
}

export default PatternWorkbench

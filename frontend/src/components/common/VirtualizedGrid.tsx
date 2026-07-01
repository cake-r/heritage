/** 虚拟滚动网格 — 对大数据集流畅浏览 */

import React, { forwardRef } from 'react'
import { VirtuosoGrid } from 'react-virtuoso'
import { Empty } from 'antd'

interface VirtualizedGridProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  /** 每行固定高度 (用于性能优化, 可选) */
  itemHeight?: number
  /** 列数 (响应式) */
  columns?: number
  /** 列间距 */
  gap?: number
  /** Overscan (预渲染行数, 默认 5) */
  overscan?: number
  /** 到达底部回调 (加载更多) */
  onEndReached?: () => void
  style?: React.CSSProperties
}

export default function VirtualizedGrid<T>({
  items,
  renderItem,
  itemHeight,
  columns = 4,
  gap = 16,
  overscan = 5,
  onEndReached,
  style,
}: VirtualizedGridProps<T>) {
  if (!items.length) {
    return <Empty description="暂无展品" style={{ marginTop: 80 }} />
  }

  return (
    <VirtuosoGrid
      totalCount={items.length}
      overscan={overscan}
      endReached={onEndReached}
      itemContent={(index) => {
        const item = items[index]
        return item ? renderItem(item, index) : null
      }}
      style={{ height: 'calc(100vh - 200px)', minHeight: 400, ...style }}
      components={{
        List: forwardRef((props: any, ref: any) => (
          <div
            ref={ref}
            {...props}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap,
              paddingBottom: 40,
            }}
          />
        )),
      }}
    />
  )
}

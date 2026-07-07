/** XAI 可解释体系 — API 客户端 + 类型定义 */

import api from './api'

// ── 来源类型（四色编码） ──

export type SourceType = 'computed' | 'model-output' | 'retrieved' | 'rule-based'

export const SOURCE_COLORS: Record<SourceType, string> = {
  computed: '#52c41a',       // 绿色 — 可验证计算
  'model-output': '#1890ff', // 蓝色 — AI 模型推断
  retrieved: '#fa8c16',      // 橙色 — 知识库检索
  'rule-based': '#722ed1',   // 紫色 — 规则判定
}

export const SOURCE_LABELS: Record<SourceType, string> = {
  computed: '计算判定',
  'model-output': '模型输出',
  retrieved: '知识检索',
  'rule-based': '规则判定',
}

// ── Trace 树节点 ──

export interface TraceNode {
  name: string
  source_type: SourceType
  confidence?: number | null
  detail?: string | null
  children: TraceNode[]
}

export interface TraceResponse {
  module: string
  record_id: number
  root: TraceNode
  disclaimer: string
}

// ── API 函数 ──

export async function fetchRecognitionTrace(recordId: number): Promise<TraceResponse> {
  const { data } = await api.get<TraceResponse>(`/api/explain/recognition/${recordId}/trace`)
  return data
}

export async function fetchRestorationTrace(recordId: number): Promise<TraceResponse> {
  const { data } = await api.get<TraceResponse>(`/api/explain/restoration/${recordId}/trace`)
  return data
}

// ── 工具函数 ──

/** 将 TraceResponse 转换为 ECharts tree 系列需要的格式 */
export function toEChartsTree(root: TraceNode) {
  function convert(node: TraceNode): any {
    const itemStyle = {
      color: SOURCE_COLORS[node.source_type] || '#666',
      borderColor: SOURCE_COLORS[node.source_type] || '#666',
    }
    const base: any = {
      name: node.name,
      itemStyle,
    }
    // 置信度附加到名称后
    if (node.confidence != null) {
      base.name = `${node.name} (${(node.confidence * 100).toFixed(0)}%)`
    }
    // tooltip 详情
    if (node.detail) {
      base.tooltip = {
        trigger: 'item',
        formatter: `{b}\n\n${node.detail}`,
      }
    }
    if (node.children && node.children.length > 0) {
      base.children = node.children.map(convert)
    } else {
      // ECharts tree 需要叶子节点有 value
      base.value = 1
    }
    return base
  }
  return convert(root)
}

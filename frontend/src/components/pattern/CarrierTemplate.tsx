import React from 'react'
import { Card, Row, Col, Typography } from 'antd'
import {
  BookOutlined, PictureOutlined, FileImageOutlined,
  MobileOutlined, FileTextOutlined,
} from '@ant-design/icons'

const { Text } = Typography

export interface CarrierTemplate {
  key: string
  name: string
  width: number
  height: number
  icon: React.ReactNode
  description: string
  borderStyle?: React.CSSProperties
}

export const CARRIER_TEMPLATES: CarrierTemplate[] = [
  {
    key: 'bookmark',
    name: '书签',
    width: 150,
    height: 450,
    icon: <BookOutlined />,
    description: '文创书签，150×450',
    borderStyle: {
      borderTop: '3px dashed #C4A265',
      borderBottom: '3px solid #B8463A',
    },
  },
  {
    key: 'scarf',
    name: '方巾',
    width: 500,
    height: 500,
    icon: <PictureOutlined />,
    description: '丝巾图案，500×500',
    borderStyle: {
      border: '12px solid #FAF7F2',
      boxShadow: '0 0 0 2px #C4A265, inset 0 0 0 1px #C4A26540',
    },
  },
  {
    key: 'poster',
    name: '海报',
    width: 595,
    height: 842,
    icon: <FileImageOutlined />,
    description: '国风海报，A4比例',
    borderStyle: {
      borderTop: '6px solid #B8463A',
      borderBottom: '6px solid #B8463A',
    },
  },
  {
    key: 'wallpaper',
    name: '手机壁纸',
    width: 390,
    height: 844,
    icon: <MobileOutlined />,
    description: '手机壁纸，390×844',
    borderStyle: {},
  },
  {
    key: 'notebook',
    name: '笔记本封面',
    width: 400,
    height: 560,
    icon: <FileTextOutlined />,
    description: '笔记本封面，400×560',
    borderStyle: {
      borderLeft: '8px solid #1E1B18',
      borderRight: '2px solid #C4A265',
    },
  },
]

interface Props {
  selected: string
  onSelect: (key: string) => void
}

const CarrierTemplateSelector: React.FC<Props> = ({ selected, onSelect }) => {
  return (
    <div>
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
        载体模板
      </Text>
      <Row gutter={[8, 8]}>
        {CARRIER_TEMPLATES.map((tpl) => (
          <Col xs={24} sm={12} key={tpl.key}>
            <Card
              hoverable
              size="small"
              onClick={() => onSelect(tpl.key)}
              style={{
                border: selected === tpl.key ? '2px solid var(--color-vermilion, #B8463A)' : '1px solid #e8e0d5',
                borderRadius: 8,
                cursor: 'pointer',
                background: selected === tpl.key ? '#FFF5F5' : '#fff',
              }}
              bodyStyle={{ padding: '10px 14px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, color: 'var(--color-vermilion, #B8463A)' }}>
                  {tpl.icon}
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{tpl.name}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {tpl.description}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}

export default CarrierTemplateSelector

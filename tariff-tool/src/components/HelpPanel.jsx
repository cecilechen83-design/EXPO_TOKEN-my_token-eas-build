import React, { useState } from 'react'

const TIPS = [
  {
    icon: '🏷️',
    title: 'HS编码查询',
    desc: '直接输入HS/NCM编码（如 8517、6404、3304）可精准匹配税率',
    examples: ['8517 → 手机', '6404 → 运动鞋', '3304 → 化妆品']
  },
  {
    icon: '📦',
    title: '商品名称查询',
    desc: '输入中文商品名称，系统自动匹配最相关的HS分类',
    examples: ['手机', '运动鞋', '空调', '洗衣机']
  },
  {
    icon: '🧵',
    title: '材质查询',
    desc: '输入主要材质，快速筛选相关商品类别',
    examples: ['棉', '皮革', '铝', '塑料', '橡胶']
  },
  {
    icon: '📷',
    title: '图片识别',
    desc: '切换到图片识别模式，上传商品图片自动识别品类',
    examples: ['上传产品图片', '自动识别商品类型', '一键查询税率']
  },
]

const COUNTRY_INFO = [
  { flag: '🇧🇷', name: '巴西', code: 'BR', note: 'NCM编码体系，II+IPI+PIS+COFINS+ICMS多重税', color: '#009c3b' },
  { flag: '🇲🇽', name: '墨西哥', code: 'MX', note: 'TIGIE编码体系，IGI关税+16% IVA', color: '#006847' },
  { flag: '🇦🇷', name: '阿根廷', code: 'AR', note: 'NCM编码体系，关税+21% IVA+3%统计税', color: '#74acdf' },
  { flag: '🇨🇴', name: '哥伦比亚', code: 'CO', note: 'ARANCEL编码，关税+19% IVA', color: '#fcd116' },
  { flag: '🇨🇱', name: '智利', code: 'CL', note: 'SA编码，统一6%关税+19% IVA', color: '#d52b1e' },
  { flag: '🇵🇪', name: '秘鲁', code: 'PE', note: 'NANDINA编码，0-11%关税+18% IGV/IPM', color: '#d91023' },
]

export default function HelpPanel() {
  const [activeSection, setActiveSection] = useState('tips')

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {/* Section Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { id: 'tips', label: '💡 使用指南' },
          { id: 'countries', label: '🌎 六国税制' },
        ].map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
            padding: '7px 16px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)',
            background: activeSection === s.id ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
            color: activeSection === s.id ? '#93c5fd' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s'
          }}>{s.label}</button>
        ))}
      </div>

      {activeSection === 'tips' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {TIPS.map((tip, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '18px 16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 24 }}>{tip.icon}</span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{tip.title}</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 10, lineHeight: 1.6 }}>
                {tip.desc}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {tip.examples.map(ex => (
                  <span key={ex} style={{
                    background: 'rgba(96,165,250,0.1)', color: '#93c5fd',
                    border: '1px solid rgba(96,165,250,0.2)',
                    padding: '2px 9px', borderRadius: 5, fontSize: 12
                  }}>{ex}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {COUNTRY_INFO.map((c) => (
            <div key={c.code} style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${c.color}30`,
              borderRadius: 14, padding: '16px',
              borderLeft: `3px solid ${c.color}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 28 }}>{c.flag}</span>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{c.code}</div>
                </div>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.7 }}>{c.note}</p>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={{
        marginTop: 20, padding: '14px 20px',
        background: 'rgba(26,86,219,0.1)',
        borderRadius: 12, border: '1px solid rgba(26,86,219,0.2)',
        display: 'flex', gap: 24, flexWrap: 'wrap'
      }}>
        {[
          { value: '6', label: '覆盖国家' },
          { value: '200+', label: 'HS编码条目' },
          { value: '30+', label: '商品大类' },
          { value: '2025', label: '数据年份' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center', flex: 1, minWidth: 60 }}>
            <div style={{ color: '#93c5fd', fontWeight: 800, fontSize: 22 }}>{s.value}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

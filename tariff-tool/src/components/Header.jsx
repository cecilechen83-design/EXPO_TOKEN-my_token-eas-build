import React from 'react'

export default function Header() {
  return (
    <header style={{
      background: 'rgba(0,0,0,0.3)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      padding: '16px 24px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg, #1a56db, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, boxShadow: '0 4px 12px rgba(26,86,219,0.4)'
          }}>🌎</div>
          <div>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
              万国拉美查税助手
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 }}>
              拉美六国进口关税智能查询 · HS/NCM编码 · 全税种汇总
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['🇧🇷 巴西', '🇲🇽 墨西哥', '🇦🇷 阿根廷', '🇨🇴 哥伦比亚', '🇨🇱 智利', '🇵🇪 秘鲁'].map(c => (
            <span key={c} style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.8)',
              padding: '3px 10px', borderRadius: 20,
              fontSize: 12, fontWeight: 500,
              border: '1px solid rgba(255,255,255,0.15)'
            }}>{c}</span>
          ))}
        </div>
      </div>
    </header>
  )
}

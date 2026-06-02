import React, { useState } from 'react'

const QUICK_SEARCHES = [
  '手机', '电视', '空调', '洗衣机', '运动鞋', 'T恤', '化妆品', '家具',
  '8517', '6404', '3304', '8418', '6109', '9403', '8516', '8507'
]

export default function SearchBar({ query, setQuery, onSearch, loading }) {
  const [focused, setFocused] = useState(false)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onSearch()
  }

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Main Search Input */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 14,
        background: 'rgba(255,255,255,0.05)',
        border: `2px solid ${focused ? '#60a5fa' : 'rgba(255,255,255,0.15)'}`,
        borderRadius: 14, padding: '6px 6px 6px 16px',
        transition: 'border-color 0.2s',
        boxShadow: focused ? '0 0 0 4px rgba(96,165,250,0.15)' : 'none'
      }}>
        <span style={{ fontSize: 20, lineHeight: '44px', opacity: 0.6 }}>🔍</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="输入商品名称（手机）、HS编码（8517）、材质（棉）..."
          style={{
            flex: 1, border: 'none', outline: 'none',
            background: 'transparent', color: '#fff',
            fontSize: 16, padding: '8px 4px',
          }}
        />
        {query && (
          <button onClick={() => setQuery('')} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none',
            color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
            width: 32, height: 32, borderRadius: 8, fontSize: 16,
            alignSelf: 'center'
          }}>✕</button>
        )}
        <button
          onClick={() => onSearch()}
          disabled={loading || !query.trim()}
          style={{
            background: query.trim() ? 'linear-gradient(135deg, #1a56db, #7c3aed)' : 'rgba(255,255,255,0.1)',
            color: '#fff', border: 'none', cursor: query.trim() ? 'pointer' : 'not-allowed',
            padding: '0 24px', height: 44, borderRadius: 10,
            fontSize: 15, fontWeight: 700,
            transition: 'all 0.2s',
            boxShadow: query.trim() ? '0 4px 12px rgba(26,86,219,0.4)' : 'none',
            whiteSpace: 'nowrap'
          }}
        >
          {loading ? '查询中...' : '查税率'}
        </button>
      </div>

      {/* Quick Search Tags */}
      <div>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginRight: 8 }}>快速查询：</span>
        {QUICK_SEARCHES.map(tag => (
          <button
            key={tag}
            onClick={() => { setQuery(tag); onSearch(tag) }}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.65)',
              padding: '3px 12px', borderRadius: 20,
              fontSize: 12, cursor: 'pointer', marginRight: 6, marginBottom: 6,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.target.style.background = 'rgba(96,165,250,0.2)'
              e.target.style.color = '#93c5fd'
              e.target.style.borderColor = 'rgba(96,165,250,0.4)'
            }}
            onMouseLeave={e => {
              e.target.style.background = 'rgba(255,255,255,0.08)'
              e.target.style.color = 'rgba(255,255,255,0.65)'
              e.target.style.borderColor = 'rgba(255,255,255,0.12)'
            }}
          >{tag}</button>
        ))}
      </div>
    </div>
  )
}

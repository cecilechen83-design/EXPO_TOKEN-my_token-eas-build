import React, { useState } from 'react'
import { COUNTRIES, FIXED_TAXES } from '../data/tariffData'

const COUNTRY_COLORS = {
  BR: { bg: '#009c3b', light: '#e8f7ec', text: '#006b28', flag: '🇧🇷' },
  MX: { bg: '#006847', light: '#e6f5ee', text: '#004a32', flag: '🇲🇽' },
  AR: { bg: '#74acdf', light: '#eaf4fb', text: '#1a5276', flag: '🇦🇷' },
  CO: { bg: '#fcd116', light: '#fef9e7', text: '#7d6608', flag: '🇨🇴' },
  CL: { bg: '#d52b1e', light: '#fdf0ef', text: '#922b21', flag: '🇨🇱' },
  PE: { bg: '#d91023', light: '#fdf0f0', text: '#922b21', flag: '🇵🇪' },
}

function getRateLevel(rate) {
  if (rate === 0) return { color: '#10b981', label: '免税' }
  if (rate <= 5) return { color: '#6ee7b7', label: '低税' }
  if (rate <= 15) return { color: '#fbbf24', label: '中税' }
  if (rate <= 25) return { color: '#f97316', label: '高税' }
  return { color: '#ef4444', label: '极高' }
}

export default function ResultsPanel({ results, query }) {
  const [selectedItem, setSelectedItem] = useState(null)
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'table'

  if (results.length === 0) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 16, padding: '48px 24px',
        textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔎</div>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          未找到"{query}"的相关税率信息
        </p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          请尝试更换关键词，或直接输入HS编码（如：8517、6404）
        </p>
      </div>
    )
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Results Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <span style={{ color: '#93c5fd', fontWeight: 700, fontSize: 16 }}>
            找到 {results.length} 个匹配商品
          </span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginLeft: 8 }}>
            "{query}"的拉美六国进口税率
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['cards', 'table'].map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              padding: '5px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
              background: viewMode === mode ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)',
              color: viewMode === mode ? '#93c5fd' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
              transition: 'all 0.15s'
            }}>
              {mode === 'cards' ? '📦 卡片' : '📊 表格'}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'table' ? (
        <TableView results={results} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {results.map((item, i) => (
            <TariffCard
              key={item.hs}
              item={item}
              index={i}
              expanded={selectedItem === item.hs}
              onToggle={() => setSelectedItem(selectedItem === item.hs ? null : item.hs)}
            />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div style={{
        marginTop: 24, padding: '12px 16px',
        background: 'rgba(245,158,11,0.1)',
        borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)',
        display: 'flex', alignItems: 'flex-start', gap: 10
      }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.7 }}>
          <strong style={{ color: 'rgba(245,158,11,0.9)' }}>免责声明：</strong>
          本工具税率数据仅供参考，实际进口税率以各国海关官方公布为准，可能因贸易协定、优惠关税、反倾销税等因素而有所不同。
          正式报关前请向专业报关行或当地海关确认最新税率。数据更新周期：2025年。
        </p>
      </div>
    </div>
  )
}

function TariffCard({ item, index, expanded, onToggle }) {
  const countries = COUNTRIES

  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.1)',
      overflow: 'hidden',
      transition: 'all 0.2s',
      animationDelay: `${index * 0.05}s`,
    }}>
      {/* Card Header */}
      <div
        onClick={onToggle}
        style={{
          padding: '16px 20px', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: expanded ? 'rgba(96,165,250,0.1)' : 'transparent',
          borderBottom: expanded ? '1px solid rgba(255,255,255,0.08)' : 'none',
          transition: 'background 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a56db, #7c3aed)',
            color: '#fff', borderRadius: 8,
            padding: '4px 10px', fontSize: 13, fontWeight: 700,
            letterSpacing: '0.5px', whiteSpace: 'nowrap'
          }}>
            {item.hs}
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{item.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>
              关键词：{item.keywords.slice(0, 4).join('、')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Rate summary badges */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {countries.map(c => {
              const d = item[c.code]
              const mainRate = c.code === 'BR' ? d?.ii : c.code === 'PE' ? d?.arancel : d?.arancel ?? d?.igi
              const lvl = getRateLevel(mainRate ?? 0)
              return (
                <span key={c.code} title={`${c.name}关税${mainRate}%`} style={{
                  background: lvl.color + '20',
                  color: lvl.color,
                  border: `1px solid ${lvl.color}40`,
                  borderRadius: 6, padding: '2px 7px',
                  fontSize: 11, fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}>
                  {c.flag} {mainRate ?? 0}%
                </span>
              )
            })}
          </div>
          <span style={{
            color: 'rgba(255,255,255,0.4)', fontSize: 18,
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s', marginLeft: 4
          }}>▾</span>
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {countries.map(c => (
            <CountryDetailCard key={c.code} country={c} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function CountryDetailCard({ country, item }) {
  const data = item[country.code]
  const fixed = FIXED_TAXES[country.code]
  const colors = COUNTRY_COLORS[country.code]
  if (!data) return null

  let rows = []
  let total = 0

  if (country.code === 'BR') {
    const ii = data.ii ?? 0
    const ipi = data.ipi ?? 0
    const pis = fixed.pis
    const cofins = fixed.cofins
    const icms = fixed.icms
    const subtotal = ii + ipi + pis + cofins
    const icmsBase = (1 + subtotal / 100)
    const icmsEff = icms * icmsBase
    total = subtotal + icmsEff
    rows = [
      { label: 'II 进口税 (Import Tax)', value: ii, highlight: true },
      { label: 'IPI 工业品税', value: ipi },
      { label: 'PIS (社会统合税)', value: pis },
      { label: 'COFINS (社会贡献税)', value: cofins },
      { label: 'ICMS 州流通税 (约)', value: `${icms}%（税基调整后约${icmsEff.toFixed(1)}%）`, raw: icmsEff },
    ]
  } else if (country.code === 'MX') {
    const igi = data.igi ?? 0
    const iva = fixed.iva
    total = igi + iva
    rows = [
      { label: 'IGI 进口关税', value: igi, highlight: true },
      { label: 'IVA 增值税', value: iva },
    ]
  } else if (country.code === 'AR') {
    const ar = data.arancel ?? 0
    const iva = fixed.iva
    const est = fixed.estadistica
    total = ar + iva + est
    rows = [
      { label: '进口关税 (Arancel)', value: ar, highlight: true },
      { label: 'IVA 增值税', value: iva },
      { label: '统计税 (Estadística)', value: est },
    ]
  } else if (country.code === 'CO') {
    const ar = data.arancel ?? 0
    const iva = fixed.iva
    total = ar + iva
    rows = [
      { label: '进口关税 (Arancel)', value: ar, highlight: true },
      { label: 'IVA 增值税', value: iva },
    ]
  } else if (country.code === 'CL') {
    const ar = data.arancel ?? 0
    const iva = fixed.iva
    total = ar + iva
    rows = [
      { label: '进口关税 (Arancel)', value: ar, highlight: true },
      { label: 'IVA 增值税', value: iva },
    ]
  } else if (country.code === 'PE') {
    const ar = data.arancel ?? 0
    const igv = fixed.igv
    const ipm = fixed.ipm
    total = ar + igv + ipm
    rows = [
      { label: '进口关税 (Arancel)', value: ar, highlight: true },
      { label: 'IGV 一般销售税', value: igv },
      { label: 'IPM 市政促进税', value: ipm },
    ]
  }

  const mainRate = rows[0]?.value
  const lvl = getRateLevel(typeof mainRate === 'number' ? mainRate : 0)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 12,
      border: `1px solid ${colors.bg}40`,
      overflow: 'hidden'
    }}>
      {/* Country Header */}
      <div style={{
        background: `${colors.bg}25`,
        borderBottom: `1px solid ${colors.bg}30`,
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>{colors.flag}</span>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{country.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{country.system} 系统</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: lvl.color, fontWeight: 800, fontSize: 18 }}>
            {typeof mainRate === 'number' ? `${mainRate}%` : mainRate}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>进口关税率</div>
        </div>
      </div>

      {/* Tax Rows */}
      <div style={{ padding: '10px 14px' }}>
        {rows.map((row, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', padding: '5px 0',
            borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
          }}>
            <span style={{
              color: row.highlight ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)',
              fontSize: 12, fontWeight: row.highlight ? 600 : 400
            }}>{row.label}</span>
            <span style={{
              color: row.highlight ? lvl.color : 'rgba(255,255,255,0.6)',
              fontWeight: row.highlight ? 700 : 600,
              fontSize: 13
            }}>
              {typeof row.value === 'number' ? `${row.value}%` : row.value}
            </span>
          </div>
        ))}

        {/* Total */}
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: `2px solid ${colors.bg}50`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600 }}>综合税负（约）</span>
          <span style={{
            color: '#fff', fontWeight: 800, fontSize: 16,
            background: `${colors.bg}40`,
            padding: '2px 10px', borderRadius: 6
          }}>{total.toFixed(1)}%</span>
        </div>

        {/* Note */}
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 8, lineHeight: 1.5 }}>
          {fixed.note}
        </p>
      </div>
    </div>
  )
}

function TableView({ results }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.08)' }}>
            <th style={thStyle}>HS编码</th>
            <th style={thStyle}>商品名称</th>
            {COUNTRIES.map(c => (
              <th key={c.code} style={thStyle}>{c.flag} {c.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((item, i) => (
            <tr key={item.hs} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
              <td style={tdStyle}>
                <span style={{
                  background: 'linear-gradient(135deg, #1a56db, #7c3aed)',
                  color: '#fff', padding: '2px 8px', borderRadius: 5, fontSize: 12, fontWeight: 700
                }}>{item.hs}</span>
              </td>
              <td style={{ ...tdStyle, maxWidth: 180, wordBreak: 'break-all' }}>{item.name}</td>
              {COUNTRIES.map(c => {
                const d = item[c.code]
                const mainRate = c.code === 'BR' ? d?.ii : d?.arancel ?? d?.igi
                const lvl = getRateLevel(mainRate ?? 0)
                const fixed = FIXED_TAXES[c.code]
                const extra = c.code === 'BR' ? fixed.pis + fixed.cofins + fixed.icms
                  : c.code === 'MX' ? fixed.iva
                  : c.code === 'AR' ? fixed.iva + fixed.estadistica
                  : c.code === 'CO' ? fixed.iva
                  : c.code === 'CL' ? fixed.iva
                  : fixed.igv + fixed.ipm
                const total = (mainRate ?? 0) + extra
                return (
                  <td key={c.code} style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, color: lvl.color, fontSize: 15 }}>{mainRate ?? 0}%</div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>综合≈{total.toFixed(0)}%</div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const thStyle = {
  padding: '12px 14px', color: 'rgba(255,255,255,0.7)',
  fontSize: 13, fontWeight: 600, textAlign: 'left',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  whiteSpace: 'nowrap'
}
const tdStyle = {
  padding: '11px 14px', color: 'rgba(255,255,255,0.8)',
  fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)'
}

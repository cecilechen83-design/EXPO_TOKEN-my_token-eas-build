import React from 'react'

export default function Footer() {
  return (
    <footer style={{
      background: 'rgba(0,0,0,0.3)',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      padding: '16px 24px', textAlign: 'center'
    }}>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
        万国拉美查税助手 © 2025 · 数据参考：巴西RECEITA FEDERAL、墨西哥SAT、阿根廷AFIP、哥伦比亚DIAN、智利SNA、秘鲁SUNAT
      </p>
      <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 4 }}>
        仅供参考，实际税率以各国海关官方公布为准
      </p>
    </footer>
  )
}

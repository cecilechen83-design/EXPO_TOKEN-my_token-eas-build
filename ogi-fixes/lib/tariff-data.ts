export interface TariffItem {
  hs: string;
  name: string;
  nameEn: string;
  keywords: string[];
  chapter: string;
  BR: { ii: number; ipi: number; ipiNote?: string };
  MX: { igi: number };
  AR: { arancel: number; extras?: string };
  CO: { arancel: number };
  CL: { arancel: number };
  PE: { arancel: number };
}

export const COUNTRIES = [
  { code: 'BR', name: '巴西', flag: '🇧🇷', currency: 'BRL' },
  { code: 'MX', name: '墨西哥', flag: '🇲🇽', currency: 'MXN' },
  { code: 'AR', name: '阿根廷', flag: '🇦🇷', currency: 'ARS' },
  { code: 'CO', name: '哥伦比亚', flag: '🇨🇴', currency: 'COP' },
  { code: 'CL', name: '智利', flag: '🇨🇱', currency: 'CLP' },
  { code: 'PE', name: '秘鲁', flag: '🇵🇪', currency: 'PEN' },
] as const;

// 各国固定税种（不随HS变化）
export const TAX_DETAIL = {
  BR: {
    name: '巴西',
    system: 'NCM（Nomenclatura Comum do Mercosul）',
    taxes: [
      { key: 'ii', label: 'II — 进口税（Imposto de Importação）', basis: 'CIF价格', note: '税率随NCM编码变化，直接对CIF征收', variable: true },
      { key: 'ipi', label: 'IPI — 工业品税（Imposto sobre Produtos Industrializados）', basis: 'CIF + II', note: '税率随NCM编码变化，部分商品为0', variable: true },
      { key: 'pis', label: 'PIS — 社会统合税（Programa de Integração Social）', basis: 'CIF + II + IPI', rate: 2.1, note: '大多数进口商品统一2.1%' },
      { key: 'cofins', label: 'COFINS — 社会贡献税（Contribuição para Financiamento da Seguridade Social）', basis: 'CIF + II + IPI', rate: 9.75, note: '大多数进口商品统一9.75%' },
      { key: 'icms', label: 'ICMS — 州流通税（Imposto sobre Circulação de Mercadorias e Serviços）', basis: '含所有税费的完税价格（倒推税基）', rate: 18, note: '各州税率不同，通常17%~20%，以圣保罗州18%为参考。计算方式为倒算法：ICMS = 税后价 × 18%，等效于税前价的约21.95%' },
    ],
    calcNote: '巴西实际综合税负计算复杂，各税互为税基（叠加计算），实际到岸成本通常比CIF高60%~100%。',
  },
  MX: {
    name: '墨西哥',
    system: 'TIGIE（Tarifa de la Ley de los Impuestos Generales de Importación y de Exportación）',
    taxes: [
      { key: 'igi', label: 'IGI — 进口关税（Impuesto General de Importación）', basis: 'CIF价格（墨西哥以FOB为税基）', note: '税率随TIGIE编码变化', variable: true },
      { key: 'iva', label: 'IVA — 增值税（Impuesto al Valor Agregado）', basis: 'CIF/FOB + IGI + 其他费用', rate: 16, note: '全国统一16%，边境地区特殊商品8%' },
      { key: 'dta', label: 'DTA — 海关手续费（Derecho de Trámite Aduanero）', basis: 'FOB价格', rate: 0.8, note: '通常为FOB的0.8%，最低约$422墨西哥比索' },
    ],
    calcNote: '墨西哥以FOB为关税计税基础，与大多数国家不同。与中国有贸易协定的商品可能适用优惠税率。',
  },
  AR: {
    name: '阿根廷',
    system: 'NCM（Nomenclatura Común del MERCOSUR）',
    taxes: [
      { key: 'arancel', label: '进口关税（Arancel de Importación）', basis: 'CIF价格', note: '税率随NCM编码变化', variable: true },
      { key: 'estadistica', label: '统计税（Tasa de Estadística）', basis: 'CIF价格', rate: 3, note: '进口货物统一征收，上限$500美元' },
      { key: 'iva', label: 'IVA — 增值税（Impuesto al Valor Agregado）', basis: 'CIF + 关税 + 统计税', rate: 21, note: '标准税率21%，部分食品、药品等10.5%或免税' },
      { key: 'iva_adicional', label: '附加增值税（IVA Adicional）', basis: 'CIF + 关税 + 统计税', rate: 20, note: '针对非注册纳税人，注册进口商通常为10%' },
      { key: 'ganancias', label: '预缴所得税（Impuesto a las Ganancias）', basis: 'CIF + 关税 + 统计税', rate: 6, note: '预缴，可在年度申报时抵扣，注册进口商3%' },
    ],
    calcNote: '阿根廷进口税负较重，外汇管控严格，建议通过当地注册进口商操作以享受较低附加税率。',
  },
  CO: {
    name: '哥伦比亚',
    system: 'Arancel（基于HS国际协调制度）',
    taxes: [
      { key: 'arancel', label: '进口关税（Arancel de Importación）', basis: 'CIF价格', note: '税率随编码变化，0%/5%/10%/15%/20%等档', variable: true },
      { key: 'iva', label: 'IVA — 增值税（Impuesto sobre las Ventas）', basis: 'CIF + 关税', rate: 19, note: '标准税率19%，部分商品5%或免税' },
      { key: 'rescate', label: '海关申报服务费（Arancel Rescate）', basis: '固定费用', rate: 0, note: '视货值而定，约COP $40,000~$80,000，忽略不计' },
    ],
    calcNote: '哥伦比亚与中国暂无FTA，适用MFN税率。安第斯共同体成员国（厄瓜多尔、秘鲁、玻利维亚）享有优惠。',
  },
  CL: {
    name: '智利',
    system: 'SA（Sistema Arancelario de Chile，基于HS）',
    taxes: [
      { key: 'arancel', label: '进口关税（Arancel Aduanero）', basis: 'CIF价格', rate: 6, note: '智利对几乎所有商品统一征收6%，极少例外', variable: false },
      { key: 'iva', label: 'IVA — 增值税（Impuesto al Valor Agregado）', basis: 'CIF + 关税', rate: 19, note: '全国统一19%' },
      { key: 'lujo', label: '奢侈品税（Impuesto al Lujo）', basis: 'CIF', rate: 15, note: '仅适用于奢侈品（珠宝、高档车等），普通商品不征' },
    ],
    calcNote: '智利与中国有FTA（中智自贸协定），绝大多数中国商品可享0%关税，需提供原产地证书（Form F）。',
    ftaNote: '⭐ 中智FTA：凭原产地证书可享受0%优惠关税（大多数商品）',
  },
  PE: {
    name: '秘鲁',
    system: 'NANDINA（基于HS，安第斯共同体命名法）',
    taxes: [
      { key: 'arancel', label: '进口关税（Derecho Arancelario）', basis: 'CIF价格', note: '税率分0%/4%/6%/11%四档', variable: true },
      { key: 'igv', label: 'IGV — 一般销售税（Impuesto General a las Ventas）', basis: 'CIF + 关税', rate: 16, note: '全国统一16%' },
      { key: 'ipm', label: 'IPM — 市政促进税（Impuesto de Promoción Municipal）', basis: 'CIF + 关税', rate: 2, note: '全国统一2%，与IGV合并征收，共18%' },
      { key: 'isc', label: 'ISC — 消费税（Impuesto Selectivo al Consumo）', basis: 'CIF + 关税', rate: 0, note: '仅针对烟草、酒精、燃油等特定商品，一般商品为0%' },
      { key: 'sobretasa', label: '附加关税（Sobretasa Arancelaria）', basis: 'CIF价格', rate: 0, note: '农产品可能征收，工业品通常0%' },
    ],
    calcNote: '秘鲁与中国有FTA（中秘自贸协定），多数商品可享优惠税率，需提供原产地证书。',
    ftaNote: '⭐ 中秘FTA：凭原产地证书可享受优惠关税',
  },
};

export function calcBRDetail(item: TariffItem, cif: number = 100) {
  const ii = item.BR.ii;
  const ipi = item.BR.ipi;
  const pis_rate = 2.1;
  const cofins_rate = 9.75;
  const icms_rate = 18;

  const II = cif * ii / 100;
  const base_ipi = cif + II;
  const IPI = base_ipi * ipi / 100;
  const base_pis_cofins = cif + II + IPI;
  const PIS = base_pis_cofins * pis_rate / 100;
  const COFINS = base_pis_cofins * cofins_rate / 100;
  const sub = cif + II + IPI + PIS + COFINS;
  // ICMS倒算: 含税价 = 税前价 / (1 - icms_rate/100)
  const total_with_icms = sub / (1 - icms_rate / 100);
  const ICMS = total_with_icms - sub;

  return {
    cif, II, IPI, PIS, COFINS, ICMS,
    total: total_with_icms,
    effective_rate: ((total_with_icms - cif) / cif * 100),
  };
}

export function calcMXDetail(item: TariffItem, fob: number = 100) {
  const igi_rate = item.MX.igi;
  const iva_rate = 16;
  const dta_rate = 0.8;

  const IGI = fob * igi_rate / 100;
  const DTA = fob * dta_rate / 100;
  const IVA = (fob + IGI + DTA) * iva_rate / 100;

  return {
    fob, IGI, IVA, DTA,
    total: fob + IGI + IVA + DTA,
    effective_rate: ((IGI + IVA + DTA) / fob * 100),
  };
}

export function calcARDetail(item: TariffItem, cif: number = 100) {
  const ar_rate = item.AR.arancel;
  const est_rate = 3;
  const iva_rate = 21;
  const iva_adi_rate = 10; // 注册进口商
  const ganancias_rate = 3; // 注册进口商

  const AR = cif * ar_rate / 100;
  const EST = cif * est_rate / 100;
  const base = cif + AR + EST;
  const IVA = base * iva_rate / 100;
  const IVA_ADI = base * iva_adi_rate / 100;
  const GANANCIAS = base * ganancias_rate / 100;

  return {
    cif, AR, EST, IVA, IVA_ADI, GANANCIAS,
    total: cif + AR + EST + IVA + IVA_ADI + GANANCIAS,
    effective_rate: ((AR + EST + IVA + IVA_ADI + GANANCIAS) / cif * 100),
  };
}

export function calcCODetail(item: TariffItem, cif: number = 100) {
  const ar_rate = item.CO.arancel;
  const iva_rate = 19;

  const AR = cif * ar_rate / 100;
  const IVA = (cif + AR) * iva_rate / 100;

  return {
    cif, AR, IVA,
    total: cif + AR + IVA,
    effective_rate: ((AR + IVA) / cif * 100),
  };
}

export function calcCLDetail(item: TariffItem, cif: number = 100) {
  const ar_rate = item.CL.arancel; // 通常6%，FTA后0%
  const iva_rate = 19;

  const AR = cif * ar_rate / 100;
  const IVA = (cif + AR) * iva_rate / 100;

  return {
    cif, AR, IVA,
    total: cif + AR + IVA,
    effective_rate: ((AR + IVA) / cif * 100),
    ftaRate: 0, // 中智FTA优惠税率
  };
}

export function calcPEDetail(item: TariffItem, cif: number = 100) {
  const ar_rate = item.PE.arancel;
  const igv_rate = 16;
  const ipm_rate = 2;

  const AR = cif * ar_rate / 100;
  const base = cif + AR;
  const IGV = base * igv_rate / 100;
  const IPM = base * ipm_rate / 100;

  return {
    cif, AR, IGV, IPM,
    total: cif + AR + IGV + IPM,
    effective_rate: ((AR + IGV + IPM) / cif * 100),
  };
}

export const TARIFF_DB: TariffItem[] = [
  // ===== 食品饮料 =====
  { hs: '0902.10', name: '绿茶（包装≤3kg）', nameEn: 'Green tea, packaged ≤3kg', chapter: '食品', keywords: ['绿茶','茶叶','茶'],
    BR: { ii: 12, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '0902.40', name: '红茶（包装>3kg）', nameEn: 'Black tea, packaged >3kg', chapter: '食品', keywords: ['红茶','普洱','茶叶','茶'],
    BR: { ii: 12, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '2101.11', name: '速溶咖啡及咖啡提取物', nameEn: 'Instant coffee, extracts', chapter: '食品', keywords: ['速溶咖啡','咖啡粉','咖啡'],
    BR: { ii: 20, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '1806.32', name: '巧克力制品（块、板）', nameEn: 'Chocolate blocks/bars', chapter: '食品', keywords: ['巧克力','可可制品'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '1905.31', name: '甜饼干', nameEn: 'Sweet biscuits', chapter: '食品', keywords: ['饼干','曲奇','甜饼干'],
    BR: { ii: 20, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '2202.10', name: '加糖或调味水（汽水、饮料）', nameEn: 'Waters with sugar/sweetened', chapter: '食品', keywords: ['汽水','饮料','可乐','碳酸饮料'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '2203.00', name: '啤酒', nameEn: 'Beer made from malt', chapter: '食品', keywords: ['啤酒','beer'],
    BR: { ii: 20, ipi: 60, ipiNote: 'IPI 60% 为啤酒特殊高税率' }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '2204.21', name: '葡萄酒（≤2L瓶装）', nameEn: 'Wine in containers ≤2L', chapter: '食品', keywords: ['葡萄酒','红酒','白葡萄酒','wine'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '2208.20', name: '白兰地、干邑', nameEn: 'Brandies, cognac', chapter: '食品', keywords: ['白兰地','干邑','brandy'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '2208.30', name: '威士忌', nameEn: 'Whiskies', chapter: '食品', keywords: ['威士忌','whisky','whiskey'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '2208.90', name: '白酒及其他蒸馏酒', nameEn: 'Other spirits/distilled beverages', chapter: '食品', keywords: ['白酒','烈酒','伏特加','蒸馏酒','黄酒'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 9 } },

  // ===== 化妆品/日化 =====
  { hs: '3303.00', name: '香水及花露水', nameEn: 'Perfumes and toilet waters', chapter: '化妆品', keywords: ['香水','花露水','perfume','古龙水'],
    BR: { ii: 20, ipi: 30, ipiNote: 'IPI 30% 为香水特殊税率' }, MX: { igi: 25 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '3304.10', name: '唇用美容品（口红、唇膏）', nameEn: 'Lip make-up preparations', chapter: '化妆品', keywords: ['口红','唇膏','唇彩'],
    BR: { ii: 20, ipi: 22 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '3304.20', name: '眼用美容品（眼影、睫毛膏）', nameEn: 'Eye make-up preparations', chapter: '化妆品', keywords: ['眼影','睫毛膏','眼线','眼部彩妆'],
    BR: { ii: 20, ipi: 22 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '3304.91', name: '粉底、面部彩妆', nameEn: 'Face powder, foundation', chapter: '化妆品', keywords: ['粉底','BB霜','CC霜','遮瑕','腮红','高光'],
    BR: { ii: 20, ipi: 22 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '3304.99', name: '其他美容护肤品（面霜、精华）', nameEn: 'Other beauty/skin-care preparations', chapter: '化妆品', keywords: ['面霜','精华','乳液','爽肤水','护肤品','保湿'],
    BR: { ii: 18, ipi: 22 }, MX: { igi: 20 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '3305.10', name: '洗发水（香波）', nameEn: 'Shampoos', chapter: '化妆品', keywords: ['洗发水','香波','shampoo'],
    BR: { ii: 18, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '3305.20', name: '烫发剂、直发剂', nameEn: 'Preparations for waving/straightening hair', chapter: '化妆品', keywords: ['烫发','直发','发剂','烫发剂'],
    BR: { ii: 18, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '3305.90', name: '护发素、发膜、发油', nameEn: 'Other hair preparations', chapter: '化妆品', keywords: ['护发素','发膜','发油','护发','免洗护发'],
    BR: { ii: 18, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '3306.10', name: '牙膏', nameEn: 'Dentifrices', chapter: '化妆品', keywords: ['牙膏','洁齿'],
    BR: { ii: 20, ipi: 12 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '3307.20', name: '体香剂及止汗剂', nameEn: 'Personal deodorants and antiperspirants', chapter: '化妆品', keywords: ['体香剂','止汗剂','除臭剂','腋下喷雾'],
    BR: { ii: 18, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '3307.90', name: '防晒霜、沐浴露、剃须产品', nameEn: 'Sunscreen, bath preparations, shaving', chapter: '化妆品', keywords: ['防晒','沐浴露','剃须膏','身体乳','洗面奶'],
    BR: { ii: 18, ipi: 22 }, MX: { igi: 20 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },

  // ===== 纺织服装 =====
  { hs: '5208.21', name: '漂白平纹棉布（≤100g/㎡）', nameEn: 'Bleached plain weave cotton ≤100g/m²', chapter: '纺织', keywords: ['棉布','纯棉面料','棉','平纹棉布'],
    BR: { ii: 20, ipi: 5 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '5407.61', name: '涤纶机织物（非弹性）', nameEn: 'Polyester woven fabrics, non-elastic', chapter: '纺织', keywords: ['涤纶','涤纶面料','化纤面料','聚酯面料'],
    BR: { ii: 20, ipi: 5 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '6109.10', name: 'T恤（棉质针织）', nameEn: 'T-shirts, singlets, cotton knit', chapter: '服装', keywords: ['T恤','棉T恤','polo衫','圆领衫'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6109.90', name: 'T恤（其他材质针织）', nameEn: 'T-shirts, other textile knit', chapter: '服装', keywords: ['T恤','化纤T恤','莫代尔'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6110.20', name: '棉质套头衫、开衫、毛衣', nameEn: 'Jerseys, pullovers of cotton', chapter: '服装', keywords: ['毛衣','套头衫','开衫','针织衫','毛衫'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6110.30', name: '化纤套头衫、运动衫', nameEn: 'Jerseys, pullovers of man-made fibres', chapter: '服装', keywords: ['运动衫','卫衣','卫衣','抓绒','摇粒绒'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6203.42', name: '男式棉质长裤、牛仔裤', nameEn: "Men's cotton trousers, jeans", chapter: '服装', keywords: ['男裤','牛仔裤','男装裤子','长裤'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6204.62', name: '女式棉质长裤、牛仔裤', nameEn: "Women's cotton trousers, jeans", chapter: '服装', keywords: ['女裤','女式牛仔裤','女装裤子'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6211.33', name: '男式棉质运动服套装', nameEn: "Men's cotton track suits", chapter: '服装', keywords: ['运动服','运动套装','跑步服'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6212.10', name: '文胸（胸罩）', nameEn: 'Brassieres', chapter: '服装', keywords: ['文胸','胸罩','内衣','bra'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6302.21', name: '床单（棉质印花）', nameEn: 'Bed linen, printed cotton', chapter: '纺织', keywords: ['床单','被套','枕套','床上用品','床品'],
    BR: { ii: 26, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 26 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },

  // ===== 鞋类 =====
  { hs: '6403.51', name: '皮面皮底正装鞋（≤24cm）', nameEn: 'Leather uppers/outsoles, formal ≤24cm', chapter: '鞋类', keywords: ['皮鞋','正装皮鞋','男皮鞋','女皮鞋','真皮鞋'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6404.11', name: '纺织面运动鞋（橡胶/塑料底）', nameEn: 'Sports footwear, textile upper, rubber sole', chapter: '鞋类', keywords: ['运动鞋','跑步鞋','球鞋','休闲鞋','帆布鞋','板鞋'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6404.19', name: '纺织面其他鞋（非运动）', nameEn: 'Other footwear with textile upper', chapter: '鞋类', keywords: ['布鞋','纺织鞋','帆布鞋','休闲帆布'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6405.20', name: '纺织面其他鞋底鞋（凉鞋等）', nameEn: 'Footwear with textile uppers, other soles', chapter: '鞋类', keywords: ['凉鞋','拖鞋','人字拖','编织凉鞋'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },

  // ===== 电子电器 =====
  { hs: '8517.13', name: '智能手机', nameEn: 'Smartphones', chapter: '电子', keywords: ['手机','智能手机','iPhone','安卓手机'],
    BR: { ii: 16, ipi: 15, ipiNote: 'IPI 15%，但在Zona Franca de Manaus生产可减免' }, MX: { igi: 10 }, AR: { arancel: 16 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '8517.62', name: '基站及网络通信设备', nameEn: 'Base stations, network equipment', chapter: '电子', keywords: ['基站','路由器','交换机','网络设备','wifi'],
    BR: { ii: 12, ipi: 15 }, MX: { igi: 0 }, AR: { arancel: 12 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '8528.72', name: '液晶彩色电视机（≤88cm）', nameEn: 'LCD colour TV ≤88cm', chapter: '电子', keywords: ['电视','液晶电视','LED电视','智能电视'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 15 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8471.30', name: '笔记本电脑（便携式计算机）', nameEn: 'Portable digital computers', chapter: '电子', keywords: ['笔记本电脑','laptop','MacBook','电脑'],
    BR: { ii: 0, ipi: 15, ipiNote: 'IT协议0% II，但IPI仍为15%' }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '8471.41', name: '台式电脑（含一体机）', nameEn: 'Desktop computers, all-in-one', chapter: '电子', keywords: ['台式电脑','台式机','一体机','desktop'],
    BR: { ii: 0, ipi: 15 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '8507.60', name: '锂离子电池（单体及模组）', nameEn: 'Lithium-ion batteries', chapter: '电子', keywords: ['锂电池','锂离子电池','动力电池','磷酸铁锂','电芯'],
    BR: { ii: 16, ipi: 15 }, MX: { igi: 10 }, AR: { arancel: 16 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8516.50', name: '微波炉', nameEn: 'Microwave ovens', chapter: '电器', keywords: ['微波炉','microwave'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8516.60', name: '电磁炉、电烤箱、电饭煲', nameEn: 'Electric cookers, ovens, rice cookers', chapter: '电器', keywords: ['电磁炉','电烤箱','电饭煲','电饭锅','烤箱'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8516.79', name: '电热水壶、电热水瓶', nameEn: 'Electric kettles, water heaters', chapter: '电器', keywords: ['电热水壶','电水壶','热水壶','烧水壶'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8418.21', name: '家用冰箱（压缩式）', nameEn: 'Compression-type household refrigerators', chapter: '电器', keywords: ['冰箱','家用冰箱','电冰箱'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8450.11', name: '全自动洗衣机（≤10kg）', nameEn: 'Fully-automatic washing machines ≤10kg', chapter: '电器', keywords: ['洗衣机','全自动洗衣机','滚筒洗衣机'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8415.10', name: '分体式空调（窗机/挂机）', nameEn: 'Split/window type air conditioners', chapter: '电器', keywords: ['空调','分体空调','挂机空调','壁挂空调'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8518.30', name: '耳机（有线/无线）', nameEn: 'Headphones and earphones', chapter: '电子', keywords: ['耳机','有线耳机','蓝牙耳机','无线耳机','headphone'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8518.22', name: '蓝牙音箱（多扬声器）', nameEn: 'Bluetooth speaker, multiple loudspeakers', chapter: '电子', keywords: ['音箱','蓝牙音箱','无线音箱','speaker'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8539.52', name: 'LED灯泡及灯管', nameEn: 'LED lamps and tubes', chapter: '电子', keywords: ['LED灯','LED灯泡','灯泡','节能灯'],
    BR: { ii: 18, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8536.50', name: '开关、按钮（低压）', nameEn: 'Switches for voltage ≤1000V', chapter: '电子', keywords: ['开关','电气开关','墙壁开关','按钮'],
    BR: { ii: 14, ipi: 15 }, MX: { igi: 15 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8536.69', name: '插座及连接器', nameEn: 'Plugs and sockets, connectors', chapter: '电子', keywords: ['插座','插头','连接器','充电插座','排插'],
    BR: { ii: 14, ipi: 15 }, MX: { igi: 15 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8544.42', name: '电线电缆（≤1000V，带连接件）', nameEn: 'Cables fitted with connectors ≤1000V', chapter: '电子', keywords: ['电线','电源线','数据线','充电线','Type-C线'],
    BR: { ii: 14, ipi: 10 }, MX: { igi: 15 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8542.31', name: '处理器及控制器芯片', nameEn: 'Processors and controllers IC', chapter: '电子', keywords: ['芯片','处理器','CPU','MCU','集成电路','IC'],
    BR: { ii: 0, ipi: 15 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },

  // ===== 家具家居 =====
  { hs: '9401.61', name: '木制家用椅子（含软垫）', nameEn: 'Wooden seats with stuffing, household', chapter: '家具', keywords: ['木椅','餐椅','实木椅','椅子'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9401.71', name: '金属框架家用椅子', nameEn: 'Metal frame seats, household', chapter: '家具', keywords: ['金属椅','铁椅','办公椅','电脑椅'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9401.40', name: '可转换沙发（沙发床）', nameEn: 'Seats convertible into beds', chapter: '家具', keywords: ['沙发床','可折叠沙发','多功能沙发'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9401.61', name: '木制沙发', nameEn: 'Wooden framed sofas', chapter: '家具', keywords: ['沙发','布艺沙发','皮沙发','真皮沙发'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9403.30', name: '木制办公家具', nameEn: 'Wooden office furniture', chapter: '家具', keywords: ['办公桌','书桌','木制办公家具'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9403.50', name: '木制卧室家具（床、衣柜）', nameEn: 'Wooden bedroom furniture', chapter: '家具', keywords: ['床','衣柜','木床','实木床','床架','衣橱'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9403.60', name: '木制其他家具（餐桌、茶几）', nameEn: 'Other wooden furniture', chapter: '家具', keywords: ['餐桌','茶几','餐边柜','书柜','电视柜'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9404.21', name: '弹簧床垫', nameEn: 'Spring mattresses', chapter: '家具', keywords: ['弹簧床垫','席梦思','独立弹簧床垫'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '9404.29', name: '其他床垫（记忆棉、乳胶）', nameEn: 'Other mattresses (memory foam, latex)', chapter: '家具', keywords: ['床垫','记忆棉床垫','乳胶床垫','海绵床垫'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },

  // ===== 包袋/箱包 =====
  { hs: '4202.11', name: '皮革面公文包、手提箱', nameEn: 'Trunks, briefcases of leather', chapter: '包袋', keywords: ['公文包','手提箱','皮质公文包'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '4202.21', name: '皮革面女士手提包', nameEn: "Women's handbags of leather", chapter: '包袋', keywords: ['女包','皮包','手提包','女士包','真皮包'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '4202.92', name: '纺织材料旅行包、背包', nameEn: 'Travel bags, backpacks of textile', chapter: '包袋', keywords: ['背包','旅行包','双肩包','书包'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '4202.12', name: '塑料面行李箱、拉杆箱', nameEn: 'Luggage with plastic surface', chapter: '包袋', keywords: ['行李箱','拉杆箱','旅行箱','登机箱'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },

  // ===== 首饰 =====
  { hs: '7113.11', name: '白银首饰及零件', nameEn: 'Articles of silver jewellery', chapter: '首饰', keywords: ['银饰','纯银','S925','银项链','银手链'],
    BR: { ii: 18, ipi: 25 }, MX: { igi: 15 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '7113.19', name: '黄金及铂金首饰', nameEn: 'Gold, platinum jewellery', chapter: '首饰', keywords: ['黄金','金饰','铂金','18k金','足金','黄金首饰'],
    BR: { ii: 18, ipi: 25 }, MX: { igi: 15 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '7117.19', name: '贱金属仿制珠宝饰品', nameEn: 'Imitation jewellery of base metal', chapter: '首饰', keywords: ['饰品','合金饰品','仿金','仿银','项链','手链','耳环','戒指'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '7117.90', name: '其他材质仿制珠宝（塑料、织物等）', nameEn: 'Imitation jewellery of other materials', chapter: '首饰', keywords: ['亚克力饰品','塑料饰品','仿珠宝','时尚饰品'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },

  // ===== 玩具/运动 =====
  { hs: '9503.00', name: '玩具（积木、娃娃、遥控车等）', nameEn: 'Toys: tricycles, dolls, puzzles', chapter: '玩具', keywords: ['玩具','积木','娃娃','玩偶','遥控车','乐高','拼图'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9504.50', name: '电子游戏机（家用）', nameEn: 'Video game consoles, home type', chapter: '玩具', keywords: ['游戏机','PS5','Xbox','Nintendo','Switch','电玩'],
    BR: { ii: 20, ipi: 40, ipiNote: 'IPI 40% 为游戏机特殊高税率' }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9506.91', name: '健身器材（哑铃、器械）', nameEn: 'Gymnasium equipment, weights', chapter: '运动', keywords: ['健身器材','哑铃','杠铃','健身器械','跑步机'],
    BR: { ii: 20, ipi: 5 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9506.62', name: '充气球类（足球、篮球等）', nameEn: 'Inflatable balls, footballs, basketballs', chapter: '运动', keywords: ['足球','篮球','排球','充气球'],
    BR: { ii: 20, ipi: 5 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },

  // ===== 汽车/交通 =====
  { hs: '8703.23', name: '乘用车（汽油发动机 1500-3000cc）', nameEn: 'Passenger cars, petrol 1500-3000cc', chapter: '汽车', keywords: ['轿车','家用车','汽车','SUV','乘用车'],
    BR: { ii: 35, ipi: 30, ipiNote: 'IPI依排量不同为7%~35%，此处为综合参考' }, MX: { igi: 20 }, AR: { arancel: 35 }, CO: { arancel: 35 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8703.80', name: '纯电动乘用车', nameEn: 'Electric passenger vehicles', chapter: '汽车', keywords: ['电动车','纯电动汽车','新能源车','EV'],
    BR: { ii: 35, ipi: 7, ipiNote: '电动车IPI较低，约7%' }, MX: { igi: 15 }, AR: { arancel: 35 }, CO: { arancel: 35 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8711.60', name: '电动摩托车（含电动自行车）', nameEn: 'Electric motorcycles/mopeds', chapter: '汽车', keywords: ['电动摩托车','电摩','电动自行车','电动两轮'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 15 }, AR: { arancel: 20 }, CO: { arancel: 35 }, CL: { arancel: 6 }, PE: { arancel: 9 } },

  // ===== 医疗/卫生 =====
  { hs: '3004.90', name: '已配剂量药品（西药、片剂、胶囊）', nameEn: 'Medicaments in measured doses', chapter: '医疗', keywords: ['药品','西药','药片','胶囊','药物'],
    BR: { ii: 0, ipi: 0 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '9018.90', name: '医疗器械（注射器、手术器械等）', nameEn: 'Medical instruments and appliances', chapter: '医疗', keywords: ['医疗器械','注射器','手术器械','医疗设备'],
    BR: { ii: 4, ipi: 0 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '9619.00', name: '卫生巾、纸尿裤、婴儿尿片', nameEn: 'Sanitary towels, baby diapers', chapter: '医疗', keywords: ['卫生巾','纸尿裤','护垫','尿不湿','尿片'],
    BR: { ii: 20, ipi: 0 }, MX: { igi: 15 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
];

export function searchTariff(query: string): TariffItem[] {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  const results: (TariffItem & { score: number })[] = [];
  const seen = new Set<string>();

  for (const item of TARIFF_DB) {
    if (seen.has(item.hs)) continue;
    const hsMatch = item.hs.toLowerCase().startsWith(q) || item.hs.replace(/\./g, '').startsWith(q.replace(/\./g, ''));
    const nameMatch = item.name.toLowerCase().includes(q);
    const nameEnMatch = item.nameEn.toLowerCase().includes(q);
    const kwMatch = item.keywords.some(k => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()));
    const chapterMatch = item.chapter.toLowerCase().includes(q);

    let score = 0;
    if (hsMatch) score = 4;
    else if (nameMatch) score = 3;
    else if (kwMatch) score = 2;
    else if (nameEnMatch || chapterMatch) score = 1;

    if (score > 0) {
      results.push({ ...item, score });
      seen.add(item.hs);
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 20);
}

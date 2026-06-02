/**
 * 拉美六国进口关税数据库
 * 数据来源：各国海关官方税率表（MFN最惠国税率）
 * 六国：巴西(BR)、墨西哥(MX)、阿根廷(AR)、哥伦比亚(CO)、智利(CL)、秘鲁(PE)
 *
 * 税率字段说明：
 * BR: { ii, ipi, pis, cofins, icms } - 进口税/工业品税/PIS/COFINS/州税
 * MX: { igi, iva } - 进口关税/增值税
 * AR: { arancel, iva, estadistica } - 关税/增值税/统计税
 * CO: { arancel, iva } - 关税/增值税
 * CL: { arancel, iva } - 关税/增值税
 * PE: { arancel, igv } - 关税/一般销售税
 */

export const COUNTRIES = [
  { code: 'BR', name: '巴西', flag: '🇧🇷', currency: 'BRL', system: 'NCM' },
  { code: 'MX', name: '墨西哥', flag: '🇲🇽', currency: 'MXN', system: 'TIGIE' },
  { code: 'AR', name: '阿根廷', flag: '🇦🇷', currency: 'ARS', system: 'NCM' },
  { code: 'CO', name: '哥伦比亚', flag: '🇨🇴', currency: 'COP', system: 'ARANCEL' },
  { code: 'CL', name: '智利', flag: '🇨🇱', currency: 'CLP', system: 'SA' },
  { code: 'PE', name: '秘鲁', flag: '🇵🇪', currency: 'PEN', system: 'NANDINA' },
]

// 固定附加税说明
export const FIXED_TAXES = {
  BR: {
    pis: 2.1,
    cofins: 9.75,
    icms: 18,
    note: '巴西还需缴纳PIS(2.1%)、COFINS(9.75%)、ICMS(约18%)等联邦及州级税'
  },
  MX: { iva: 16, note: '进口增值税(IVA)统一为16%' },
  AR: { iva: 21, estadistica: 3, note: '增值税21%，统计税3%，部分商品另有额外增值税' },
  CO: { iva: 19, note: '增值税(IVA)为19%' },
  CL: { iva: 19, note: '增值税(IVA)为19%' },
  PE: { igv: 16, ipm: 2, note: 'IGV(16%)+IPM(2%)=18%，部分商品有反倾销税' },
}

export const TARIFF_DB = [
  // ==================== 第01章 活动物 ====================
  { hs: '0101', name: '活马、驴、骡', keywords: ['马','驴','骡','活动物'],
    BR: { ii: 4, ipi: 0 }, MX: { igi: 15 }, AR: { arancel: 2 }, CO: { arancel: 5 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '0105', name: '活家禽', keywords: ['鸡','鸭','鹅','火鸡','家禽'],
    BR: { ii: 4, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 5 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 0 } },

  // ==================== 第02章 肉及食用杂碎 ====================
  { hs: '0201', name: '鲜牛肉或冷藏牛肉', keywords: ['牛肉','鲜牛肉','冷藏牛肉'],
    BR: { ii: 12, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 0 }, CO: { arancel: 80 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '0203', name: '鲜猪肉', keywords: ['猪肉','鲜猪肉'],
    BR: { ii: 10, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 5 }, CO: { arancel: 80 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '0207', name: '禽肉及食用杂碎', keywords: ['鸡肉','禽肉','鸭肉'],
    BR: { ii: 12, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 5 }, CO: { arancel: 80 }, CL: { arancel: 6 }, PE: { arancel: 0 } },

  // ==================== 第03章 鱼、甲壳动物 ====================
  { hs: '0302', name: '鲜鱼或冷藏鱼', keywords: ['鲜鱼','冷藏鱼','鱼'],
    BR: { ii: 12, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 0 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '0306', name: '甲壳类动物', keywords: ['虾','蟹','龙虾','甲壳'],
    BR: { ii: 12, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 10 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 0 } },

  // ==================== 第07-08章 蔬菜水果 ====================
  { hs: '0701', name: '马铃薯（土豆）', keywords: ['土豆','马铃薯','薯'],
    BR: { ii: 10, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 10 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '0803', name: '香蕉', keywords: ['香蕉','芭蕉'],
    BR: { ii: 10, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 10 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '0805', name: '柑橘类水果', keywords: ['橙子','柠檬','柚子','柑橘'],
    BR: { ii: 10, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 12 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 0 } },

  // ==================== 第09章 咖啡、茶 ====================
  { hs: '0901', name: '咖啡', keywords: ['咖啡','coffee'],
    BR: { ii: 10, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 10 }, CO: { arancel: 0 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '0902', name: '茶叶', keywords: ['茶','茶叶','红茶','绿茶','普洱'],
    BR: { ii: 12, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 6 } },

  // ==================== 第11章 谷物加工品 ====================
  { hs: '1101', name: '小麦粉', keywords: ['面粉','小麦粉'],
    BR: { ii: 14, ipi: 0 }, MX: { igi: 15 }, AR: { arancel: 5 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 6 } },

  // ==================== 第15章 动植物油脂 ====================
  { hs: '1507', name: '大豆油', keywords: ['大豆油','豆油','食用油'],
    BR: { ii: 9, ipi: 0 }, MX: { igi: 15 }, AR: { arancel: 5 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 3 } },
  { hs: '1511', name: '棕榈油', keywords: ['棕榈油','棕油'],
    BR: { ii: 9, ipi: 0 }, MX: { igi: 15 }, AR: { arancel: 5 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 3 } },

  // ==================== 第17章 糖及糖食 ====================
  { hs: '1701', name: '蔗糖/白砂糖', keywords: ['糖','白糖','砂糖','蔗糖'],
    BR: { ii: 16, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },

  // ==================== 第18章 可可及制品 ====================
  { hs: '1801', name: '可可豆', keywords: ['可可','可可豆'],
    BR: { ii: 8, ipi: 0 }, MX: { igi: 15 }, AR: { arancel: 5 }, CO: { arancel: 0 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '1806', name: '巧克力及可可制品', keywords: ['巧克力','可可制品'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },

  // ==================== 第19章 谷物、面粉制品 ====================
  { hs: '1901', name: '麦芽提取物及食品制剂', keywords: ['麦芽提取物','婴儿食品','麦芽'],
    BR: { ii: 20, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '1905', name: '面包、蛋糕、饼干等烘焙食品', keywords: ['面包','饼干','蛋糕','烘焙','曲奇'],
    BR: { ii: 20, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },

  // ==================== 第20章 蔬菜、水果制品 ====================
  { hs: '2009', name: '果汁', keywords: ['果汁','橙汁','苹果汁','葡萄汁'],
    BR: { ii: 20, ipi: 10 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 6 } },

  // ==================== 第21章 杂项食品 ====================
  { hs: '2101', name: '咖啡提取物及速溶咖啡', keywords: ['速溶咖啡','咖啡提取物','咖啡粉'],
    BR: { ii: 20, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '2103', name: '酱油、番茄酱、调味料', keywords: ['酱油','番茄酱','调味料','酱料','辣酱'],
    BR: { ii: 20, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '2106', name: '其他食品制剂', keywords: ['食品制剂','食品添加剂','保健品'],
    BR: { ii: 20, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 9 } },

  // ==================== 第22章 饮料、酒、醋 ====================
  { hs: '2201', name: '饮用水、矿泉水', keywords: ['矿泉水','饮用水','纯净水'],
    BR: { ii: 20, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '2202', name: '含糖饮料（汽水等）', keywords: ['汽水','饮料','可乐','碳酸饮料','软饮料'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '2203', name: '啤酒', keywords: ['啤酒','beer'],
    BR: { ii: 20, ipi: 60 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '2204', name: '葡萄酒', keywords: ['葡萄酒','红酒','白葡萄酒','wine'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '2208', name: '蒸馏酒（白酒、威士忌等）', keywords: ['白酒','威士忌','白兰地','伏特加','蒸馏酒','烈酒'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 9 } },

  // ==================== 第25章 盐、硫磺、土、石料 ====================
  { hs: '2515', name: '大理石', keywords: ['大理石','花岗岩','石材'],
    BR: { ii: 4, ipi: 5 }, MX: { igi: 10 }, AR: { arancel: 10 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 0 } },

  // ==================== 第27章 矿物燃料 ====================
  { hs: '2709', name: '原油', keywords: ['原油','石油'],
    BR: { ii: 0, ipi: 0 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '2710', name: '汽油、柴油等石油制品', keywords: ['汽油','柴油','燃油','石油制品'],
    BR: { ii: 0, ipi: 0 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },

  // ==================== 第29章 有机化学品 ====================
  { hs: '2915', name: '饱和无环一元羧酸', keywords: ['乙酸','醋酸','有机酸'],
    BR: { ii: 6, ipi: 0 }, MX: { igi: 5 }, AR: { arancel: 6 }, CO: { arancel: 5 }, CL: { arancel: 6 }, PE: { arancel: 0 } },

  // ==================== 第30章 药品 ====================
  { hs: '3001', name: '腺体及其他器官医用制剂', keywords: ['医药','药品','药物','腺体'],
    BR: { ii: 0, ipi: 0 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '3004', name: '已配剂量药品（含中成药）', keywords: ['药片','胶囊','药品','中成药','西药','药物'],
    BR: { ii: 0, ipi: 0 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },

  // ==================== 第32章 鞣料、颜料 ====================
  { hs: '3208', name: '涂料和清漆', keywords: ['涂料','油漆','清漆','喷漆','乳胶漆'],
    BR: { ii: 14, ipi: 5 }, MX: { igi: 10 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '3214', name: '玻璃腻子、填缝料', keywords: ['腻子','填缝剂','密封胶'],
    BR: { ii: 14, ipi: 0 }, MX: { igi: 10 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },

  // ==================== 第33章 精油及香料 ====================
  { hs: '3301', name: '精油', keywords: ['精油','香精','香料','薰衣草油','茶树油'],
    BR: { ii: 8, ipi: 0 }, MX: { igi: 15 }, AR: { arancel: 10 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '3303', name: '香水及花露水', keywords: ['香水','花露水','perfume','古龙水'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 25 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '3304', name: '美容化妆品（口红、粉底等）', keywords: ['化妆品','口红','粉底','眼影','腮红','美容','彩妆'],
    BR: { ii: 20, ipi: 22 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '3305', name: '护发产品（洗发水、护发素）', keywords: ['洗发水','护发素','发膜','护发','洗发'],
    BR: { ii: 18, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '3306', name: '口腔卫生品（牙膏等）', keywords: ['牙膏','漱口水','牙线','口腔护理'],
    BR: { ii: 20, ipi: 12 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '3307', name: '剃须、沐浴、除臭等个人护理品', keywords: ['沐浴露','身体乳','剃须膏','防晒','护肤品','爽肤水','面霜','乳液'],
    BR: { ii: 18, ipi: 22 }, MX: { igi: 20 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },

  // ==================== 第34章 肥皂、洗涤剂 ====================
  { hs: '3401', name: '肥皂', keywords: ['肥皂','香皂','soap'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '3402', name: '洗涤剂（洗衣粉、洗洁精等）', keywords: ['洗衣粉','洗洁精','洗涤剂','清洁剂'],
    BR: { ii: 16, ipi: 15 }, MX: { igi: 15 }, AR: { arancel: 16 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 9 } },

  // ==================== 第38章 杂项化学品 ====================
  { hs: '3808', name: '杀虫剂、杀菌剂、除草剂', keywords: ['杀虫剂','农药','除草剂','杀菌剂'],
    BR: { ii: 4, ipi: 0 }, MX: { igi: 5 }, AR: { arancel: 6 }, CO: { arancel: 5 }, CL: { arancel: 6 }, PE: { arancel: 0 } },

  // ==================== 第39章 塑料及其制品 ====================
  { hs: '3901', name: '聚乙烯（PE）', keywords: ['聚乙烯','PE','塑料粒子','塑料原料'],
    BR: { ii: 14, ipi: 0 }, MX: { igi: 5 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 3 } },
  { hs: '3902', name: '聚丙烯（PP）', keywords: ['聚丙烯','PP'],
    BR: { ii: 14, ipi: 0 }, MX: { igi: 5 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 3 } },
  { hs: '3919', name: '塑料自粘胶带', keywords: ['胶带','塑料胶带','透明胶','OPP胶带'],
    BR: { ii: 16, ipi: 5 }, MX: { igi: 15 }, AR: { arancel: 16 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '3923', name: '塑料包装容器（瓶、桶、箱）', keywords: ['塑料瓶','塑料桶','塑料容器','PE瓶','PET瓶'],
    BR: { ii: 16, ipi: 12 }, MX: { igi: 15 }, AR: { arancel: 16 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '3926', name: '其他塑料制品', keywords: ['塑料制品','塑料件','塑料配件'],
    BR: { ii: 18, ipi: 15 }, MX: { igi: 15 }, AR: { arancel: 18 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },

  // ==================== 第40章 橡胶及其制品 ====================
  { hs: '4011', name: '充气橡胶轮胎（新）', keywords: ['轮胎','橡胶轮胎','汽车轮胎'],
    BR: { ii: 16, ipi: 5 }, MX: { igi: 20 }, AR: { arancel: 16 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '4016', name: '其他硫化橡胶制品（密封件等）', keywords: ['橡胶密封件','橡胶制品','橡胶垫','密封圈'],
    BR: { ii: 14, ipi: 5 }, MX: { igi: 15 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },

  // ==================== 第42章 皮革制品 ====================
  { hs: '4202', name: '手提包、旅行箱包', keywords: ['手提包','旅行箱','行李箱','背包','皮包','女包'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '4203', name: '皮革服装及附件', keywords: ['皮衣','皮革手套','皮带','皮革服装'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },

  // ==================== 第44章 木及木制品 ====================
  { hs: '4407', name: '锯材（木板、木方）', keywords: ['木板','木方','锯材','木材'],
    BR: { ii: 8, ipi: 0 }, MX: { igi: 15 }, AR: { arancel: 8 }, CO: { arancel: 10 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '4412', name: '胶合板', keywords: ['胶合板','多层板','夹板','合板'],
    BR: { ii: 12, ipi: 5 }, MX: { igi: 15 }, AR: { arancel: 12 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '4418', name: '木制建筑构件（门、窗、地板）', keywords: ['木门','木地板','木窗','实木地板'],
    BR: { ii: 16, ipi: 10 }, MX: { igi: 20 }, AR: { arancel: 16 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '4420', name: '木制装饰品及家庭用品', keywords: ['木制工艺品','木质摆件'],
    BR: { ii: 16, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 16 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 6 } },

  // ==================== 第48章 纸和纸板 ====================
  { hs: '4802', name: '未涂布印刷书写纸', keywords: ['印刷纸','书写纸','复印纸','A4纸'],
    BR: { ii: 12, ipi: 0 }, MX: { igi: 10 }, AR: { arancel: 12 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 3 } },
  { hs: '4811', name: '涂布纸、铜版纸', keywords: ['铜版纸','涂布纸','光面纸'],
    BR: { ii: 12, ipi: 0 }, MX: { igi: 10 }, AR: { arancel: 12 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 3 } },
  { hs: '4819', name: '纸箱、纸盒（包装用）', keywords: ['纸箱','纸盒','包装盒','瓦楞纸箱'],
    BR: { ii: 14, ipi: 0 }, MX: { igi: 15 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },

  // ==================== 第49章 印刷品 ====================
  { hs: '4901', name: '书籍', keywords: ['书','书籍','图书','教材'],
    BR: { ii: 0, ipi: 0 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },

  // ==================== 第50-63章 纺织品及服装 ====================
  { hs: '5007', name: '丝织物', keywords: ['丝绸','真丝','丝织物','绸缎'],
    BR: { ii: 20, ipi: 5 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '5208', name: '棉织物', keywords: ['棉布','纯棉','棉织物','棉面料'],
    BR: { ii: 20, ipi: 5 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '5407', name: '合成纤维机织物', keywords: ['涤纶布','合成纤维','化纤面料','涤纶面料'],
    BR: { ii: 20, ipi: 5 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '6101', name: '男式针织外衣（外套）', keywords: ['外套','男外套','针织外套'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6104', name: '女式针织套装、外套', keywords: ['女外套','女装外套','针织套装'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6109', name: 'T恤衫', keywords: ['T恤','T-shirt','圆领衫','polo衫'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6110', name: '毛衫、套头衫、开衫', keywords: ['毛衣','针织衫','套头衫','开衫','毛衫'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6203', name: '男式梭织套装、夹克、裤子', keywords: ['男西服','男夹克','男裤','西裤','男装'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6204', name: '女式梭织套装、夹克、裙、裤', keywords: ['女西服','女夹克','女裙','女裤','女装'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6211', name: '游泳衣及其他运动服装', keywords: ['游泳衣','泳装','运动服','运动套装'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6212', name: '文胸、束身衣等', keywords: ['内衣','文胸','胸罩','内裤','三角裤'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6301', name: '毛毯及旅行毯', keywords: ['毛毯','毯子','毛绒毯','法兰绒毯'],
    BR: { ii: 26, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 26 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '6302', name: '床上用品（床单、被套）', keywords: ['床单','被套','枕套','床品','床上用品'],
    BR: { ii: 26, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 26 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '6304', name: '其他纺织装饰品（抱枕套等）', keywords: ['抱枕','靠枕','装饰抱枕','靠垫'],
    BR: { ii: 26, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 26 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '6305', name: '包装袋（编织袋）', keywords: ['编织袋','麻袋','包装袋','PP编织袋'],
    BR: { ii: 18, ipi: 0 }, MX: { igi: 15 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '6307', name: '其他纺织制成品（口罩等）', keywords: ['口罩','无纺布制品','清洁布'],
    BR: { ii: 26, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 26 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },

  // ==================== 第64章 鞋靴 ====================
  { hs: '6401', name: '防水鞋靴', keywords: ['防水鞋','雨靴','胶鞋'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6403', name: '皮面鞋靴', keywords: ['皮鞋','皮靴','真皮鞋','女皮鞋','男皮鞋'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6404', name: '纺织面料鞋（运动鞋、帆布鞋）', keywords: ['运动鞋','帆布鞋','跑步鞋','球鞋','休闲鞋','旅游鞋'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6405', name: '其他鞋靴（凉鞋、拖鞋）', keywords: ['凉鞋','拖鞋','人字拖','夹脚拖'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },

  // ==================== 第65章 帽类 ====================
  { hs: '6506', name: '其他帽类（安全帽等）', keywords: ['帽子','棒球帽','遮阳帽','安全帽','针织帽'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 35 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },

  // ==================== 第69章 陶瓷制品 ====================
  { hs: '6907', name: '未上釉陶瓷砖', keywords: ['瓷砖','地砖','墙砖','陶瓷砖'],
    BR: { ii: 12, ipi: 5 }, MX: { igi: 20 }, AR: { arancel: 12 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '6911', name: '家用瓷器（餐具）', keywords: ['瓷器','瓷碗','餐具','骨瓷','陶瓷餐具'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '6912', name: '其他陶瓷家用品', keywords: ['陶瓷制品','陶瓷花瓶','陶瓷工艺品'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },

  // ==================== 第70章 玻璃及制品 ====================
  { hs: '7013', name: '玻璃餐具及厨房用具', keywords: ['玻璃杯','玻璃碗','玻璃器皿','玻璃餐具'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },

  // ==================== 第72-73章 钢铁 ====================
  { hs: '7208', name: '热轧钢板/卷', keywords: ['钢板','钢卷','热轧钢','钢铁'],
    BR: { ii: 12, ipi: 0 }, MX: { igi: 7 }, AR: { arancel: 12 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 3 } },
  { hs: '7210', name: '镀层钢板（镀锌板）', keywords: ['镀锌板','镀锌钢板','镀层钢板'],
    BR: { ii: 12, ipi: 0 }, MX: { igi: 7 }, AR: { arancel: 12 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 3 } },
  { hs: '7304', name: '无缝钢管', keywords: ['无缝钢管','钢管'],
    BR: { ii: 14, ipi: 0 }, MX: { igi: 10 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 3 } },
  { hs: '7318', name: '螺钉、螺母、螺栓', keywords: ['螺丝','螺母','螺栓','螺钉','紧固件'],
    BR: { ii: 18, ipi: 5 }, MX: { igi: 15 }, AR: { arancel: 18 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },

  // ==================== 第74章 铜及制品 ====================
  { hs: '7408', name: '铜丝', keywords: ['铜丝','铜线','紫铜丝'],
    BR: { ii: 14, ipi: 0 }, MX: { igi: 5 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 0 }, PE: { arancel: 3 } },

  // ==================== 第76章 铝及制品 ====================
  { hs: '7601', name: '铝原材料', keywords: ['铝锭','铝原料','铝'],
    BR: { ii: 0, ipi: 0 }, MX: { igi: 3 }, AR: { arancel: 0 }, CO: { arancel: 5 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '7604', name: '铝型材、铝条', keywords: ['铝型材','铝条','铝材'],
    BR: { ii: 12, ipi: 0 }, MX: { igi: 5 }, AR: { arancel: 12 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '7612', name: '铝制容器', keywords: ['铝罐','铝桶','铝制容器'],
    BR: { ii: 16, ipi: 10 }, MX: { igi: 15 }, AR: { arancel: 16 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 6 } },

  // ==================== 第82章 刀具、工具 ====================
  { hs: '8201', name: '手工农业工具（铁锹、锄头）', keywords: ['铁锹','锄头','农具','手工工具'],
    BR: { ii: 14, ipi: 5 }, MX: { igi: 10 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8205', name: '手工工具（锤子、扳手等）', keywords: ['锤子','扳手','钳子','螺丝刀','工具箱'],
    BR: { ii: 18, ipi: 5 }, MX: { igi: 15 }, AR: { arancel: 18 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8211', name: '刀具（厨师刀、水果刀）', keywords: ['刀','厨师刀','水果刀','菜刀','刀具'],
    BR: { ii: 18, ipi: 10 }, MX: { igi: 20 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },

  // ==================== 第83章 杂项贱金属制品 ====================
  { hs: '8302', name: '五金配件（铰链、锁等）', keywords: ['铰链','门锁','五金配件','拉手','把手'],
    BR: { ii: 18, ipi: 10 }, MX: { igi: 15 }, AR: { arancel: 18 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 9 } },

  // ==================== 第84章 核反应堆、锅炉、机器、机械器具及零件 ====================
  { hs: '8414', name: '空气泵、真空泵、风扇、空调压缩机', keywords: ['空调压缩机','风扇','鼓风机','气泵','真空泵'],
    BR: { ii: 14, ipi: 10 }, MX: { igi: 10 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8418', name: '冰箱、冷柜及制冷设备', keywords: ['冰箱','冷柜','冷冻柜','制冷设备','冰柜'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8421', name: '离心机、过滤机、净水机', keywords: ['净水器','过滤机','离心机','净化器'],
    BR: { ii: 12, ipi: 5 }, MX: { igi: 10 }, AR: { arancel: 12 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8422', name: '洗碗机及包装机械', keywords: ['洗碗机','包装机','封口机'],
    BR: { ii: 14, ipi: 10 }, MX: { igi: 10 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8450', name: '洗衣机', keywords: ['洗衣机','washing machine','全自动洗衣机','滚筒洗衣机'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8451', name: '纺织加工机械', keywords: ['纺织机械','缝纫机','织布机'],
    BR: { ii: 6, ipi: 0 }, MX: { igi: 5 }, AR: { arancel: 6 }, CO: { arancel: 5 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '8471', name: '计算机及外围设备', keywords: ['电脑','计算机','服务器','台式机','工作站'],
    BR: { ii: 0, ipi: 15 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '8473', name: '计算机及外设零件', keywords: ['电脑配件','主板','显卡','内存','硬盘'],
    BR: { ii: 0, ipi: 15 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '8481', name: '阀门、旋塞等', keywords: ['阀门','球阀','截止阀','蝶阀','旋塞'],
    BR: { ii: 14, ipi: 5 }, MX: { igi: 10 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8483', name: '传动轴、轴承、齿轮箱', keywords: ['轴承','传动轴','齿轮箱','减速机'],
    BR: { ii: 14, ipi: 5 }, MX: { igi: 5 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8501', name: '电动机和发电机', keywords: ['电机','电动机','发电机','马达','motor'],
    BR: { ii: 14, ipi: 10 }, MX: { igi: 10 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },

  // ==================== 第85章 电气及电子产品 ====================
  { hs: '8504', name: '变压器、整流器、电感器', keywords: ['变压器','整流器','电感','开关电源'],
    BR: { ii: 14, ipi: 15 }, MX: { igi: 10 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8507', name: '蓄电池（锂电池、铅酸电池）', keywords: ['锂电池','电池','蓄电池','铅酸电池','动力电池','磷酸铁锂'],
    BR: { ii: 16, ipi: 15 }, MX: { igi: 10 }, AR: { arancel: 16 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8516', name: '电热器具（电热水壶、电吹风等）', keywords: ['电热水壶','电吹风','电熨斗','电暖器','电烤箱','电加热'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8517', name: '电话机、手机及通信设备', keywords: ['手机','手机','智能手机','电话','通信设备','对讲机'],
    BR: { ii: 16, ipi: 15 }, MX: { igi: 10 }, AR: { arancel: 16 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '8518', name: '麦克风、扬声器、耳机', keywords: ['耳机','音响','扬声器','麦克风','蓝牙耳机','音箱'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8519', name: '录音/放音设备', keywords: ['录音机','播放器','MP3','音频播放'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8521', name: '录像机及摄像机', keywords: ['录像机','摄像机','DV','视频录制'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8525', name: '发射设备（无线电、电视）', keywords: ['无线发射','广播设备','基站','天线'],
    BR: { ii: 12, ipi: 15 }, MX: { igi: 10 }, AR: { arancel: 12 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8528', name: '电视机、显示器', keywords: ['电视','电视机','显示器','液晶电视','LED电视','monitor'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 15 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8535', name: '断路器、熔断器等高压电器', keywords: ['断路器','熔断器','开关柜','高压电器'],
    BR: { ii: 14, ipi: 10 }, MX: { igi: 10 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8536', name: '低压电器（开关、插座、继电器）', keywords: ['开关','插座','继电器','断路器','电气开关','空气开关'],
    BR: { ii: 14, ipi: 15 }, MX: { igi: 15 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8539', name: '灯泡（LED灯、白炽灯、荧光灯）', keywords: ['LED灯','灯泡','白炽灯','荧光灯','节能灯','灯管'],
    BR: { ii: 18, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8540', name: '真空管及阴极射线管', keywords: ['显像管','真空管','CRT'],
    BR: { ii: 16, ipi: 0 }, MX: { igi: 10 }, AR: { arancel: 16 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8541', name: '半导体器件（二极管、晶体管）', keywords: ['半导体','二极管','晶体管','芯片','集成电路','IC'],
    BR: { ii: 0, ipi: 15 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '8542', name: '集成电路芯片', keywords: ['芯片','集成电路','IC','处理器','CPU','GPU'],
    BR: { ii: 0, ipi: 15 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '8544', name: '绝缘电线、电缆', keywords: ['电线','电缆','绝缘线','网线','电源线'],
    BR: { ii: 14, ipi: 10 }, MX: { igi: 15 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 9 } },

  // ==================== 第86-89章 交通运输设备 ====================
  { hs: '8703', name: '乘用车（小汽车）', keywords: ['轿车','小汽车','乘用车','汽车','轿车','SUV'],
    BR: { ii: 35, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 35 }, CO: { arancel: 35 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8704', name: '货车、载货汽车', keywords: ['货车','卡车','载货车','厢式货车'],
    BR: { ii: 35, ipi: 5 }, MX: { igi: 20 }, AR: { arancel: 35 }, CO: { arancel: 35 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8711', name: '摩托车', keywords: ['摩托车','电摩','摩托','motorcycle'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 35 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8712', name: '自行车', keywords: ['自行车','单车','脚踏车','bicycle'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8714', name: '摩托车及自行车零件', keywords: ['摩托车配件','自行车配件'],
    BR: { ii: 16, ipi: 10 }, MX: { igi: 15 }, AR: { arancel: 16 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8716', name: '拖车及半挂车', keywords: ['拖车','半挂车','trailer'],
    BR: { ii: 14, ipi: 0 }, MX: { igi: 15 }, AR: { arancel: 14 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 6 } },

  // ==================== 第90章 光学、照相、医疗仪器 ====================
  { hs: '9001', name: '光学纤维及光学元件', keywords: ['光纤','光学元件','透镜','棱镜'],
    BR: { ii: 6, ipi: 5 }, MX: { igi: 5 }, AR: { arancel: 6 }, CO: { arancel: 5 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '9006', name: '照相机', keywords: ['相机','照相机','数码相机','单反','微单','camera'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '9013', name: '激光器、液晶显示屏等光学仪器', keywords: ['激光器','LCD','液晶显示','光学仪器'],
    BR: { ii: 14, ipi: 15 }, MX: { igi: 10 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '9018', name: '医疗器械（听诊器、注射器等）', keywords: ['医疗器械','注射器','听诊器','医疗设备','血压计'],
    BR: { ii: 4, ipi: 0 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '9021', name: '矫形器具、人造关节、助听器', keywords: ['助听器','人工关节','矫形器','义肢'],
    BR: { ii: 0, ipi: 0 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },

  // ==================== 第91章 钟表 ====================
  { hs: '9101', name: '高档腕表（金壳/铂壳）', keywords: ['手表','腕表','名表','机械表','瑞士表'],
    BR: { ii: 20, ipi: 25 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '9102', name: '普通腕表', keywords: ['手表','石英表','电子表','运动手表','智能手表'],
    BR: { ii: 20, ipi: 25 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 6 } },

  // ==================== 第92章 乐器 ====================
  { hs: '9202', name: '弦乐器（吉他、小提琴等）', keywords: ['吉他','小提琴','大提琴','弦乐器'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '9207', name: '电子乐器', keywords: ['电子琴','键盘','合成器','电子乐器','midi'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 6 } },

  // ==================== 第94章 家具 ====================
  { hs: '9401', name: '座椅（沙发、椅子）', keywords: ['沙发','椅子','凳子','办公椅','座椅'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9403', name: '其他家具（桌子、柜子、床）', keywords: ['桌子','床','衣柜','书柜','茶几','餐桌','家具'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9404', name: '床垫、被子、枕头', keywords: ['床垫','被子','枕头','弹簧床垫','记忆棉'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },

  // ==================== 第95章 玩具 ====================
  { hs: '9503', name: '玩具（积木、娃娃等）', keywords: ['玩具','积木','娃娃','玩偶','遥控车','乐高'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9504', name: '游戏机及零件', keywords: ['游戏机','PS5','Xbox','Nintendo','游戏手柄','电玩'],
    BR: { ii: 20, ipi: 40 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9506', name: '运动器材', keywords: ['健身器材','瑜伽垫','哑铃','跑步机','运动器械'],
    BR: { ii: 20, ipi: 5 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },

  // ==================== 第96章 杂项制品 ====================
  { hs: '9601', name: '雕刻工艺品（象牙、骨质等）', keywords: ['工艺品','雕刻品','象牙制品'],
    BR: { ii: 20, ipi: 10 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9603', name: '扫帚、刷子、拖把', keywords: ['扫帚','拖把','刷子','毛刷','清洁工具'],
    BR: { ii: 20, ipi: 10 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9608', name: '圆珠笔、钢笔、马克笔', keywords: ['圆珠笔','钢笔','马克笔','中性笔','文具'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9619', name: '卫生巾、纸尿裤', keywords: ['卫生巾','纸尿裤','护垫','尿不湿'],
    BR: { ii: 20, ipi: 0 }, MX: { igi: 15 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },

  // ==================== 补充常见商品 ====================
  { hs: '8508', name: '真空吸尘器', keywords: ['吸尘器','扫地机','扫地机器人'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8509', name: '家用电动器具（搅拌机、料理机）', keywords: ['搅拌机','料理机','榨汁机','豆浆机','破壁机'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8510', name: '电剃须刀、电动剃毛刀', keywords: ['电动剃须刀','剃须刀','电推剪','修毛刀'],
    BR: { ii: 20, ipi: 25 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8415', name: '空调', keywords: ['空调','分体空调','中央空调','壁挂空调','air conditioner'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8516.60', name: '电磁炉、微波炉', keywords: ['微波炉','电磁炉','烤箱','电饭锅','电饭煲'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8472', name: '打印机、复印机、传真机', keywords: ['打印机','复印机','传真机','激光打印机','喷墨打印机'],
    BR: { ii: 6, ipi: 15 }, MX: { igi: 0 }, AR: { arancel: 6 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '8443', name: '印刷机械', keywords: ['印刷机','打印机械'],
    BR: { ii: 6, ipi: 0 }, MX: { igi: 0 }, AR: { arancel: 6 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '7117', name: '仿制珠宝首饰', keywords: ['仿制珠宝','人造首饰','饰品','项链','手链','耳环'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '7113', name: '贵金属首饰', keywords: ['金饰','银饰','铂金','贵金属首饰','黄金','珠宝'],
    BR: { ii: 18, ipi: 25 }, MX: { igi: 15 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9401.61', name: '木制家用椅子', keywords: ['木椅','木凳','实木椅'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8302.10', name: '家具五金铰链', keywords: ['铰链','合页','家具铰链'],
    BR: { ii: 18, ipi: 10 }, MX: { igi: 15 }, AR: { arancel: 18 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
]

// 材质到HS分类的映射
export const MATERIAL_MAP = {
  '棉': ['5208', '6109', '6302'],
  '丝绸': ['5007', '6101'],
  '涤纶': ['5407', '6203'],
  '尼龙': ['5407', '6211'],
  '羊毛': ['5112', '6110'],
  '皮革': ['4202', '4203', '6403'],
  '塑料': ['3923', '3926', '3919'],
  '橡胶': ['4011', '4016'],
  '铝': ['7601', '7604', '7612'],
  '钢铁': ['7208', '7304', '7318'],
  '铜': ['7408'],
  '木': ['4407', '4412', '4418', '9403'],
  '纸': ['4802', '4811', '4819'],
  '玻璃': ['7013'],
  '陶瓷': ['6907', '6911'],
}

export function searchTariff(query) {
  if (!query || query.trim() === '') return []
  const q = query.trim().toLowerCase()

  const results = []
  const seen = new Set()

  for (const item of TARIFF_DB) {
    if (seen.has(item.hs)) continue

    const hsMatch = item.hs.startsWith(q) || item.hs.replace('.', '').startsWith(q.replace('.', ''))
    const nameMatch = item.name.toLowerCase().includes(q)
    const keywordMatch = item.keywords.some(k => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()))

    if (hsMatch || nameMatch || keywordMatch) {
      results.push({ ...item, score: hsMatch ? 3 : nameMatch ? 2 : 1 })
      seen.add(item.hs)
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 20)
}

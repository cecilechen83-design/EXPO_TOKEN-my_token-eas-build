export interface TariffItem {
  hs: string;
  name: string;
  keywords: string[];
  BR: { ii: number; ipi: number };
  MX: { igi: number };
  AR: { arancel: number };
  CO: { arancel: number };
  CL: { arancel: number };
  PE: { arancel: number };
}

export const COUNTRIES = [
  { code: 'BR', name: '巴西', flag: '🇧🇷' },
  { code: 'MX', name: '墨西哥', flag: '🇲🇽' },
  { code: 'AR', name: '阿根廷', flag: '🇦🇷' },
  { code: 'CO', name: '哥伦比亚', flag: '🇨🇴' },
  { code: 'CL', name: '智利', flag: '🇨🇱' },
  { code: 'PE', name: '秘鲁', flag: '🇵🇪' },
] as const;

export const FIXED_TAXES = {
  BR: { pis: 2.1, cofins: 9.75, icms: 18 },
  MX: { iva: 16 },
  AR: { iva: 21, estadistica: 3 },
  CO: { iva: 19 },
  CL: { iva: 19 },
  PE: { igv: 16, ipm: 2 },
};

export const TARIFF_DB: TariffItem[] = [
  { hs: '0902', name: '茶叶', keywords: ['茶','茶叶','红茶','绿茶','普洱'],
    BR: { ii: 12, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '0901', name: '咖啡', keywords: ['咖啡'],
    BR: { ii: 10, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 10 }, CO: { arancel: 0 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '1806', name: '巧克力及可可制品', keywords: ['巧克力','可可'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '1905', name: '饼干、蛋糕等烘焙食品', keywords: ['面包','饼干','蛋糕','烘焙','曲奇'],
    BR: { ii: 20, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '2009', name: '果汁', keywords: ['果汁','橙汁','苹果汁'],
    BR: { ii: 20, ipi: 10 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '2202', name: '含糖饮料（汽水等）', keywords: ['汽水','饮料','可乐','碳酸饮料'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '2203', name: '啤酒', keywords: ['啤酒'],
    BR: { ii: 20, ipi: 60 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '2204', name: '葡萄酒', keywords: ['葡萄酒','红酒','白葡萄酒'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '2208', name: '蒸馏酒（白酒、威士忌）', keywords: ['白酒','威士忌','白兰地','伏特加','烈酒'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '3303', name: '香水及花露水', keywords: ['香水','花露水'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 25 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '3304', name: '美容化妆品（口红、粉底等）', keywords: ['化妆品','口红','粉底','眼影','腮红','美容','彩妆'],
    BR: { ii: 20, ipi: 22 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '3305', name: '护发产品（洗发水、护发素）', keywords: ['洗发水','护发素','发膜','护发'],
    BR: { ii: 18, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '3307', name: '护肤品（面霜、乳液、防晒）', keywords: ['沐浴露','身体乳','防晒','护肤品','爽肤水','面霜','乳液'],
    BR: { ii: 18, ipi: 22 }, MX: { igi: 20 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '3402', name: '洗涤剂（洗衣粉、洗洁精）', keywords: ['洗衣粉','洗洁精','洗涤剂','清洁剂'],
    BR: { ii: 16, ipi: 15 }, MX: { igi: 15 }, AR: { arancel: 16 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '3923', name: '塑料包装容器（瓶、桶）', keywords: ['塑料瓶','塑料桶','PE瓶','PET瓶'],
    BR: { ii: 16, ipi: 12 }, MX: { igi: 15 }, AR: { arancel: 16 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '4011', name: '充气橡胶轮胎', keywords: ['轮胎','橡胶轮胎','汽车轮胎'],
    BR: { ii: 16, ipi: 5 }, MX: { igi: 20 }, AR: { arancel: 16 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '4202', name: '手提包、旅行箱包', keywords: ['手提包','旅行箱','行李箱','背包','皮包','女包'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '5208', name: '棉织物', keywords: ['棉布','纯棉','棉织物','棉面料'],
    BR: { ii: 20, ipi: 5 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '6109', name: 'T恤衫', keywords: ['T恤','T-shirt','圆领衫','polo衫'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6110', name: '毛衫、套头衫、开衫', keywords: ['毛衣','针织衫','套头衫','开衫','毛衫'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6203', name: '男式套装、夹克、裤子', keywords: ['男西服','男夹克','男裤','西裤','男装'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6204', name: '女式套装、夹克、裙、裤', keywords: ['女西服','女夹克','女裙','女裤','女装'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6212', name: '内衣（文胸、内裤）', keywords: ['内衣','文胸','胸罩','内裤'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6302', name: '床上用品（床单、被套）', keywords: ['床单','被套','枕套','床品','床上用品'],
    BR: { ii: 26, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 26 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '6307', name: '其他纺织制成品（口罩等）', keywords: ['口罩','无纺布','清洁布'],
    BR: { ii: 26, ipi: 0 }, MX: { igi: 20 }, AR: { arancel: 26 }, CO: { arancel: 20 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '6401', name: '防水鞋靴', keywords: ['防水鞋','雨靴','胶鞋'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6403', name: '皮面鞋靴', keywords: ['皮鞋','皮靴','真皮鞋'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6404', name: '纺织面料鞋（运动鞋、帆布鞋）', keywords: ['运动鞋','帆布鞋','跑步鞋','球鞋','休闲鞋'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6405', name: '凉鞋、拖鞋', keywords: ['凉鞋','拖鞋','人字拖'],
    BR: { ii: 35, ipi: 0 }, MX: { igi: 30 }, AR: { arancel: 35 }, CO: { arancel: 40 }, CL: { arancel: 6 }, PE: { arancel: 17 } },
  { hs: '6911', name: '瓷器餐具', keywords: ['瓷器','瓷碗','餐具','骨瓷','陶瓷餐具'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '7113', name: '贵金属首饰', keywords: ['金饰','银饰','铂金','贵金属首饰','黄金','珠宝'],
    BR: { ii: 18, ipi: 25 }, MX: { igi: 15 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '7117', name: '仿制珠宝首饰饰品', keywords: ['仿制珠宝','人造首饰','饰品','项链','手链','耳环'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '7318', name: '螺钉、螺母、螺栓', keywords: ['螺丝','螺母','螺栓','螺钉','紧固件'],
    BR: { ii: 18, ipi: 5 }, MX: { igi: 15 }, AR: { arancel: 18 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8205', name: '手工工具（锤子、扳手等）', keywords: ['锤子','扳手','钳子','螺丝刀','工具箱'],
    BR: { ii: 18, ipi: 5 }, MX: { igi: 15 }, AR: { arancel: 18 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8302', name: '五金配件（铰链、锁）', keywords: ['铰链','门锁','五金配件','拉手','把手'],
    BR: { ii: 18, ipi: 10 }, MX: { igi: 15 }, AR: { arancel: 18 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8415', name: '空调', keywords: ['空调','分体空调','壁挂空调'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8418', name: '冰箱、冷柜', keywords: ['冰箱','冷柜','冷冻柜','冰柜'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8450', name: '洗衣机', keywords: ['洗衣机','全自动洗衣机','滚筒洗衣机'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8471', name: '计算机及外围设备', keywords: ['电脑','计算机','服务器','台式机'],
    BR: { ii: 0, ipi: 15 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '8507', name: '锂电池/蓄电池', keywords: ['锂电池','电池','蓄电池','铅酸电池','动力电池'],
    BR: { ii: 16, ipi: 15 }, MX: { igi: 10 }, AR: { arancel: 16 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '8509', name: '家用电动器具（搅拌机等）', keywords: ['搅拌机','料理机','榨汁机','豆浆机','破壁机'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8516', name: '电热器具（热水壶、电吹风）', keywords: ['电热水壶','电吹风','电熨斗','电暖器','电烤箱','电磁炉','微波炉'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8517', name: '手机及通信设备', keywords: ['手机','智能手机','电话','通信设备'],
    BR: { ii: 16, ipi: 15 }, MX: { igi: 10 }, AR: { arancel: 16 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 0 } },
  { hs: '8518', name: '麦克风、扬声器、耳机', keywords: ['耳机','音响','扬声器','麦克风','蓝牙耳机','音箱'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8528', name: '电视机、显示器', keywords: ['电视','电视机','显示器','液晶电视'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 15 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8536', name: '开关、插座、继电器', keywords: ['开关','插座','继电器','断路器','空气开关'],
    BR: { ii: 14, ipi: 15 }, MX: { igi: 15 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8539', name: 'LED灯、灯泡', keywords: ['LED灯','灯泡','白炽灯','荧光灯','节能灯','灯管'],
    BR: { ii: 18, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 18 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8541', name: '半导体器件/芯片', keywords: ['半导体','二极管','晶体管','芯片','集成电路','IC','CPU','GPU'],
    BR: { ii: 0, ipi: 15 }, MX: { igi: 0 }, AR: { arancel: 0 }, CO: { arancel: 0 }, CL: { arancel: 0 }, PE: { arancel: 0 } },
  { hs: '8544', name: '绝缘电线、电缆', keywords: ['电线','电缆','绝缘线','网线','电源线'],
    BR: { ii: 14, ipi: 10 }, MX: { igi: 15 }, AR: { arancel: 14 }, CO: { arancel: 10 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8703', name: '乘用车（轿车、SUV）', keywords: ['轿车','小汽车','乘用车','汽车','SUV'],
    BR: { ii: 35, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 35 }, CO: { arancel: 35 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8711', name: '摩托车', keywords: ['摩托车','电摩','摩托'],
    BR: { ii: 20, ipi: 30 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 35 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '8712', name: '自行车', keywords: ['自行车','单车','脚踏车'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9006', name: '照相机', keywords: ['相机','照相机','数码相机','单反','微单'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '9102', name: '手表、腕表', keywords: ['手表','腕表','名表','机械表','石英表','运动手表','智能手表'],
    BR: { ii: 20, ipi: 25 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 6 } },
  { hs: '9401', name: '座椅（沙发、椅子）', keywords: ['沙发','椅子','凳子','办公椅','座椅'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9403', name: '家具（桌子、柜子、床）', keywords: ['桌子','床','衣柜','书柜','茶几','餐桌','家具'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9404', name: '床垫、被子、枕头', keywords: ['床垫','被子','枕头','弹簧床垫'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 11 } },
  { hs: '9503', name: '玩具（积木、娃娃等）', keywords: ['玩具','积木','娃娃','玩偶','遥控车','乐高'],
    BR: { ii: 20, ipi: 20 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9504', name: '游戏机及零件', keywords: ['游戏机','PS5','Xbox','Nintendo','游戏手柄'],
    BR: { ii: 20, ipi: 40 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9506', name: '运动器材', keywords: ['健身器材','瑜伽垫','哑铃','跑步机','运动器械'],
    BR: { ii: 20, ipi: 5 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9608', name: '圆珠笔、钢笔、马克笔', keywords: ['圆珠笔','钢笔','马克笔','中性笔','文具'],
    BR: { ii: 20, ipi: 15 }, MX: { igi: 20 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
  { hs: '9619', name: '卫生巾、纸尿裤', keywords: ['卫生巾','纸尿裤','护垫','尿不湿'],
    BR: { ii: 20, ipi: 0 }, MX: { igi: 15 }, AR: { arancel: 20 }, CO: { arancel: 15 }, CL: { arancel: 6 }, PE: { arancel: 9 } },
];

export function searchTariff(query: string): TariffItem[] {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  const results: (TariffItem & { score: number })[] = [];
  const seen = new Set<string>();

  for (const item of TARIFF_DB) {
    if (seen.has(item.hs)) continue;
    const hsMatch = item.hs.startsWith(q) || item.hs.replace('.', '').startsWith(q.replace('.', ''));
    const nameMatch = item.name.toLowerCase().includes(q);
    const kwMatch = item.keywords.some(k => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()));
    if (hsMatch || nameMatch || kwMatch) {
      results.push({ ...item, score: hsMatch ? 3 : nameMatch ? 2 : 1 });
      seen.add(item.hs);
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 15);
}

export function calcTotal(item: TariffItem, code: string): number {
  const fixed = FIXED_TAXES[code as keyof typeof FIXED_TAXES];
  if (code === 'BR') {
    const d = item.BR;
    const sub = d.ii + d.ipi + fixed.pis + fixed.cofins;
    return sub + fixed.icms * (1 + sub / 100);
  }
  if (code === 'MX') return item.MX.igi + (fixed as any).iva;
  if (code === 'AR') return item.AR.arancel + (fixed as any).iva + (fixed as any).estadistica;
  if (code === 'CO') return item.CO.arancel + (fixed as any).iva;
  if (code === 'CL') return item.CL.arancel + (fixed as any).iva;
  if (code === 'PE') return item.PE.arancel + (fixed as any).igv + (fixed as any).ipm;
  return 0;
}

export function getMainRate(item: TariffItem, code: string): number {
  if (code === 'BR') return item.BR.ii;
  if (code === 'MX') return item.MX.igi;
  return (item as any)[code]?.arancel ?? 0;
}

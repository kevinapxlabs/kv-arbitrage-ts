export interface TQtyFilter {
  pricePrecision: number;   // 价格精度
  qtyPrecision: number;     // 下单数量精度
  minQty: string;           // 最小下单数量
  maxQty: string;           // 最大下单数量
  qtyStep: string;          // 下单数量步长
  minNotional?: string;     // 最小名义价值
}

import BigNumber from "bignumber.js"
import { blogger } from "../common/base/logger.js"

// 检查一个string是否是浮点数
export function isFloat(val: string) {
  var floatRegex = /^-?\d+(?:[.,]\d*?)?$/
  if (!floatRegex.test(val)) {
    return false
  }
  const v = parseFloat(val)
  if (isNaN(v)){
    return false
  }
  return true
}

// 检查一个string是否是整数
export function isInt(val: string) {
  var intRegex = /^-?\d+$/
  if (!intRegex.test(val)) {
    return false
  }
  var intVal = parseInt(val, 10)
  return parseFloat(val) == intVal && !isNaN(intVal);
}

// 计算 str 中有几位有效小数
export function precisionFromString(str: string): number {
  // support string formats like '1e-4'
  if (str.indexOf('e') > -1) {
      const numStr = str.replace (/\de/, '')
      return parseInt(numStr) * -1
  }
  const split = str.replace (/0+$/g, '').split ('.')
  return (split.length > 1) ? (split[1].length) : 0
}

/*
* 计算有效数量
* @param desiredQuantity 期望数量
* @param minQuantity 最小数量
* @param stepSize 步长
* @param maxQuantity 最大数量
* @returns 有效数量
*/
export function calculateValidQuantity(
  desiredQuantity: BigNumber,
  minQuantity: string,
  stepSize: string,
  maxQuantity: string | null,
): number {
  // 1. 检查数量是否在 minQuantity 和 maxQuantity 范围内
  if (desiredQuantity.lt(minQuantity)) {
    blogger.warn(`Quantity ${desiredQuantity} is less than minQuantity ${minQuantity}`)
    return 0;
  } else if (maxQuantity !== null && desiredQuantity.gt(maxQuantity)) {
    blogger.warn(`Quantity ${desiredQuantity} is greater than maxQuantity ${maxQuantity}`)
    return BigNumber(maxQuantity).toNumber();
  }

  // 2. 检查数量是否是 stepSize 的整数倍
  const remainder = desiredQuantity.mod(stepSize)
  if (BigNumber(remainder).gt(0)) {
    // 如果不符合 stepSize，调整到最近的步长
    const quantity = desiredQuantity.dividedBy(stepSize).toFixed(0, BigNumber.ROUND_DOWN)
    const validQuantity = BigNumber(quantity).multipliedBy(stepSize).toNumber()
    blogger.warn(`Quantity ${desiredQuantity} is not a multiple of stepSize ${stepSize}. Adjusted to ${validQuantity}`);
    return validQuantity;
  }

  // 3. 如果数量有效，直接返回
  return desiredQuantity.toNumber();
}
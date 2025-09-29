export type TStreamMessage<T> = {
  data: T
  stream: string
}

export type TUpdateOrder = {
  e: string;          // Event type
  E: number;          // Event time in microseconds
  s: string;          // Symbol
  c: number;          // Client order ID
  S: string;          // Side
  o: string;          // Order type
  f: string;          // Time in force
  q: string;          // Quantity
  Q: string;          // Quantity in quote
  p: string;          // Price
  P: string;          // Trigger price
  B: string;          // Trigger by
  a: string;          // Take profit trigger price
  b: string;          // Stop loss trigger price
  d: string;          // Take profit trigger by
  g: string;          // Stop loss trigger by
  Y: string;          // Trigger quantity
  X: string;          // Order state
  R: string;          // Order expiry reason
  i: string;          // Order ID
  t: number;          // Trade ID
  l: string;          // Fill quantity
  z: string;          // Executed quantity
  Z: string;          // Executed quantity in quote
  L: string;          // Fill price
  m: boolean;         // Whether the order was maker
  n: string;          // Fee
  N: string;          // Fee symbol
  V: string;          // Self trade prevention
  T: number;          // Engine timestamp in microseconds
  O: string;          // Origin of the update
  I: string;          // Related order ID
}

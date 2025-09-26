export const BK_SUCCESS_CODE = 200

export type BKResponse<T> = {
  code: number
  data: T
  message: string
}

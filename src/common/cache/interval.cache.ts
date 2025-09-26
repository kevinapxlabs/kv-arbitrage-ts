import NodeCache from 'node-cache'

export const intervalCache = new NodeCache({ stdTTL: 3600 })

export const qtyFilterCache = new NodeCache({ stdTTL: 3600 })

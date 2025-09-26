import { HttpsProxyAgent } from 'https-proxy-agent'

export const localAgent = new HttpsProxyAgent('http://127.0.0.1:7897');

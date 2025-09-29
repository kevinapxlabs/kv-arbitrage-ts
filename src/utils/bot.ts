import TelegramBot from 'node-telegram-bot-api';
import util from 'node:util';
import { blogger } from '../common/base/logger.js';
import { defiConfig } from '../config/config.js';

// 将消息发送至tg
export const sendMsg = async (channel: string, text: string) => {
  const botCfg = defiConfig.bot
  const botConfig = botCfg[channel];
  if (!botConfig) {
    blogger.error(`bot config not found, channel: ${channel}`);
    return;
  }
  const bot = new TelegramBot(botConfig.token);
  if (text.length > 0) {
    for(let i = 0; i < 5; i++) {
      try {
        // await bot.sendMessage(botConfig.chatId, text);
        console.log(`send config: ${util.inspect(botConfig, {compact: true})} channel: ${channel} text: ${text}`);
        break;
      } catch (error) {
        blogger.error('to tg error:', error);
      }
    }
  }
}

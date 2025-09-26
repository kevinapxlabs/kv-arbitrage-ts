import * as path from 'path';
import { Logger, createLogger, format, transports } from 'winston';
import 'winston-daily-rotate-file';
import config from 'config';
import { fileURLToPath } from 'url';

const PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

class LoggerService {
  private logger: Logger

  constructor() {
    const logfile = config.get('log.fileName')
    const logFile = new transports.DailyRotateFile({
      // 日志文件名 %DATE% 会自动设置为当前日期
      filename: logfile + '-%DATE%.info.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '500m',
      maxFiles: '15',
      format: format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.json(),
      ),
      level: 'info',
    })

    const errFile = new transports.DailyRotateFile({
      filename: logfile + '-%DATE%.error.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '200m',
      maxFiles: '3d',
      format: format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.json(),
      ),
      level: 'error',
    })
    this.logger = createLogger({
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      ),
      transports: [
        logFile,
        errFile
      ]
    });
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new transports.Console({
        format: format.simple()
      }))
    }
  }

  getMsg(args: any[]): string {
    const res: string[] = []
    for(let i = 0; i < args.length; i++) {
      const arg = args[i]
      if (typeof arg === 'object') {
        res.push(JSON.stringify(arg))
      } else {
        res.push(arg)
      }
    }
    return res.join(':')
  }

  info(...args: any[]) {
    const msg = this.getMsg(args)
    this.logger.info(msg);
  }

  warn(...args: any[]) {
    const msg = this.getMsg(args)
    this.logger.warn(msg)
  }

  debug(...args: any[]) {
    const msg = this.getMsg(args)
    this.logger.debug(msg)
  }

  error(...args: any[]) {
    const info = formatLogArguments()
    const msg = this.getMsg(args)
    this.logger.error(msg, info);
  }
}

function formatLogArguments() {
  const stackInfo = getStackInfo(1);
  if (stackInfo) {
    const callStr = `(${stackInfo.absolutePath}:${stackInfo.line})`;
    return {
      method: stackInfo.method,
      callStr: callStr,
      line: stackInfo.line,
      file: stackInfo.file,
    };
  }
  return {}
}

/**
 * Parses and returns info about the call stack at the given index.
 */
function getStackInfo(stackIndex: number) {
  const stacklist = new Error().stack?.split('\n').slice(3);

  const stackReg = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/gi;
  const stackReg2 = /at\s+()(.*):(\d*):(\d*)/gi;

  const s = stacklist?.[stackIndex] || stacklist?.[0];
  if (!s) return null
  const sp = stackReg.exec(s) || stackReg2.exec(s);

  if (sp && sp.length === 5) {
    return {
      method: sp[1],
      absolutePath: path.resolve(PROJECT_ROOT, sp[2]),
      line: sp[3],
      pos: sp[4],
      file: path.basename(sp[2]),
      stack: stacklist?.join('\n'),
    };
  }
}

export const blogger = new LoggerService()

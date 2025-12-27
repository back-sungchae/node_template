import winston from "winston";
import path from "path";

const log_dir = path.resolve("logs");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // 콘솔 로그 (기존)
    new winston.transports.Console(),

    // 파일 로그 (🔥 추가)
    new winston.transports.File({
      filename: `${log_dir}/app.log`,
    }),
  ],
});

export default logger;

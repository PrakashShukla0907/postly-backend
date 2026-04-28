// Winston logger setup
import winston from "winston";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const textFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}] ${stack || message}`;
});

const jsonFormat = combine(timestamp(), errors({ stack: true }), winston.format.json());

const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  textFormat
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: process.env.LOG_FORMAT === "json" ? jsonFormat : devFormat,
  transports: [new winston.transports.Console()],
});

export default logger;

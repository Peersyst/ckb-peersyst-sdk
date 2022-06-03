/* eslint-disable no-console */
export enum LoggingLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error",
}

export class Logger {
    private readonly name: string;
    private readonly loggingLevel: LoggingLevel;

    // In the constructor we can pass a name that will always be added in the log
    // and a logging level to choose which level of logs you want to be logged.
    // If you choose logging level WARN only logger.warn and logger.error will be logged
    constructor(name = "", loggingLevel: LoggingLevel = LoggingLevel.INFO) {
        this.name = name;
        this.loggingLevel = loggingLevel;
    }

    // Sends a message to standard output with tag debug
    static debug(message: any, name = ""): void {
        console.debug(`${name}[debug] >> `, message);
    }

    // Sends a message to standard output with tag debug if logging level DEBUG or greater
    debug(message: any): void {
        if (this.loggingLevel === LoggingLevel.DEBUG) {
            Logger.debug(message, this.name);
        }
    }

    // Sends a message to standard output with tag info
    static info(message: any, name = ""): void {
        console.info(`${name}[info] >> `, message);
    }

    // Sends a message to standard output with tag info if logging level INFO or greater
    info(message: any): void {
        if ([LoggingLevel.DEBUG, LoggingLevel.INFO].includes(this.loggingLevel)) {
            Logger.info(message, this.name);
        }
    }

    // Sends a message to standard output with tag log
    static log(message: any, name = ""): void {
        console.log(`${name}[log] >> `, message);
    }

    // Sends a message to standard output with tag log if logging level INFO or greater
    log(message: any): void {
        if ([LoggingLevel.DEBUG, LoggingLevel.INFO].includes(this.loggingLevel)) {
            Logger.log(message, this.name);
        }
    }

    // Sends a message to standard error output with tag warn
    static warn(message: any, name = ""): void {
        console.warn(`${name}[warn] >> `, message);
    }

    // Sends a message to standard error output with tag warn if logging level WARN or greater
    warn(message: any): void {
        if ([LoggingLevel.DEBUG, LoggingLevel.INFO, LoggingLevel.WARN].includes(this.loggingLevel)) {
            Logger.warn(message, this.name);
        }
    }

    // Sends a message to standard error output with tag error
    static error(message: any, name = ""): void {
        console.error(`${name}[error] >> `, message);
    }

    // Sends a message to standard error output with tag error if logging level ERROR
    error(message: any): void {
        Logger.error(message, this.name);
    }
}

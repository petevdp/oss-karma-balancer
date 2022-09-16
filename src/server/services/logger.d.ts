import { LeveledLogMethod, LogCallback, LogEntry, Logger, LogMethod } from 'winston';
declare type LogCallbackWithMeta<T> = (error?: any, level?: string, message?: string, meta?: T) => void;
interface LeveledLogMethodWithMeta<T> extends LeveledLogMethod {
    (message: string, callback: LogCallbackWithMeta<T>): Logger;
    (message: string, meta: T, callback: LogCallbackWithMeta<T>): Logger;
    (message: string, ...meta: T[]): Logger;
    (message: any): Logger;
    (infoObject: object): Logger;
}
interface LogMethodWithMeta<T> extends LogMethod {
    (level: string, message: string, callback: LogCallback): Logger;
    (level: string, message: string, meta: any, callback: LogCallback): Logger;
    (level: string, message: string, ...meta: any[]): Logger;
    (entry: LogEntry & T): Logger;
    (level: string, message: any): Logger;
}
export interface LoggerWithMeta<T> extends Logger {
    defaultMeta?: T;
    error: LeveledLogMethodWithMeta<T>;
    warn: LeveledLogMethodWithMeta<T>;
    help: LeveledLogMethodWithMeta<T>;
    data: LeveledLogMethodWithMeta<T>;
    info: LeveledLogMethodWithMeta<T>;
    debug: LeveledLogMethodWithMeta<T>;
    prompt: LeveledLogMethodWithMeta<T>;
    http: LeveledLogMethodWithMeta<T>;
    verbose: LeveledLogMethodWithMeta<T>;
    input: LeveledLogMethodWithMeta<T>;
    silly: LeveledLogMethodWithMeta<T>;
    emerg: LeveledLogMethodWithMeta<T>;
    alert: LeveledLogMethodWithMeta<T>;
    crit: LeveledLogMethodWithMeta<T>;
    warning: LeveledLogMethodWithMeta<T>;
    notice: LeveledLogMethodWithMeta<T>;
    log: LogMethodWithMeta<T>;
    child(options: LoggerMetadata): Logger;
}
declare type WithContext = {
    context: string;
};
export declare type LoggerMetadata = WithContext & {
    [key: string]: any;
};
export declare class MetadataError extends Error {
    metadata: any;
    constructor(msg: string, metadata: any);
}
export declare let logger: LoggerWithMeta<LoggerMetadata>;
export declare const ppObj: (obj: any) => string;
export declare function setupLogger(): void;
export {};
//# sourceMappingURL=logger.d.ts.map
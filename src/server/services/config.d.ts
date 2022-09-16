import * as t from '../../../node_modules/io-ts';
export declare const ConfigCodec: t.TypeC<{
    exampleConfigValue: t.StringC;
}>;
export declare type Config = t.TypeOf<typeof ConfigCodec>;
export declare let config: Config;
export declare function setupConfig(): void;
//# sourceMappingURL=config.d.ts.map
import * as t from '../../../node_modules/io-ts';
declare const OptionsCodec: t.TypeC<{
    config: t.StringC;
}>;
declare type Options = t.TypeOf<typeof OptionsCodec>;
export declare let options: Options;
export declare function setupCli(): void;
export {};
//# sourceMappingURL=cli.d.ts.map
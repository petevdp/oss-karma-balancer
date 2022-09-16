import * as t from '../../../node_modules/io-ts';
declare const EnvironmentCodec: t.TypeC<{
    NODE_ENV: t.StringC;
}>;
export declare type Environment = t.TypeOf<typeof EnvironmentCodec>;
export declare let environment: Environment;
export declare function setupEnvironment(): void;
export {};
//# sourceMappingURL=environment.d.ts.map
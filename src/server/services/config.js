import { logger } from './logger';
import { readFileSync } from 'fs';
import JSON5 from '../../../node_modules/json5';
import * as t from '../../../node_modules/io-ts';
import { options } from './cli';
export const ConfigCodec = t.type({
    exampleConfigValue: t.string,
});
export let config;
export function setupConfig() {
    let configRaw = {};
    const textBlob = readFileSync(options.config, 'utf-8');
    if (textBlob) {
        configRaw = { ...JSON5.parse(textBlob) };
    }
    let decoded = ConfigCodec.decode(configRaw);
    if (decoded._tag === 'Left') {
        for (let error of decoded.left) {
            const path = error.context.map(node => node.key).join('/');
            logger.warn(`Invalid config value at ${path}: (actual: ${error.value?.toString()}, expected: ${error.context[error.context.length - 1].type.name})`);
        }
        throw new Error('Invalid config! see above warnings for details');
    }
    else {
        config = configRaw;
        logger.info('Succesfully parsed config file');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFDbEMsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLElBQUksQ0FBQztBQUNsQyxPQUFPLEtBQUssTUFBTSw2QkFBNkIsQ0FBQztBQUNoRCxPQUFPLEtBQUssQ0FBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFFaEMsTUFBTSxDQUFDLE1BQU0sV0FBVyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDaEMsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDLE1BQU07Q0FDN0IsQ0FBQyxDQUFDO0FBR0gsTUFBTSxDQUFDLElBQUksTUFBYyxDQUFDO0FBRTFCLE1BQU0sVUFBVSxXQUFXO0lBQ3pCLElBQUksU0FBUyxHQUFRLEVBQUUsQ0FBQztJQUN4QixNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN2RCxJQUFJLFFBQVEsRUFBRTtRQUNaLFNBQVMsR0FBRyxFQUFFLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO0tBQzFDO0lBRUQsSUFBSSxPQUFPLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUU1QyxJQUFJLE9BQU8sQ0FBQyxJQUFJLEtBQUssTUFBTSxFQUFFO1FBQzNCLEtBQUssSUFBSSxLQUFLLElBQUksT0FBTyxDQUFDLElBQUksRUFBRTtZQUM5QixNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDM0QsTUFBTSxDQUFDLElBQUksQ0FBQywyQkFBMkIsSUFBSSxjQUFlLEtBQUssQ0FBQyxLQUFhLEVBQUUsUUFBUSxFQUFFLGVBQWUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztTQUMvSjtRQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsZ0RBQWdELENBQUMsQ0FBQztLQUNuRTtTQUFNO1FBQ0wsTUFBTSxHQUFHLFNBQVMsQ0FBQztRQUNuQixNQUFNLENBQUMsSUFBSSxDQUFDLGdDQUFnQyxDQUFDLENBQUM7S0FDL0M7QUFDSCxDQUFDIn0=
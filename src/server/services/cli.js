import { program } from '../../../node_modules/commander';
import * as t from '../../../node_modules/io-ts';
const OptionsCodec = t.type({
    'config': t.string,
});
export let options;
export function setupCli() {
    program
        .option('--config', 'path of configuration file', './config.json5');
    program.parse();
    let opts = program.opts();
    const decoded = OptionsCodec.decode(opts);
    if (decoded._tag === 'Left') {
        for (let error of decoded.left) {
            const path = error.context.map(node => node.key).join('/');
            console.warn(`Invalid option: ${path}: (actual: ${error.value?.toString()}, expected: ${error.context[error.context.length - 1].type.name})`);
        }
        throw new Error('Invalid options! see above warnings for details');
    }
    options = opts;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMxRCxPQUFPLEtBQUssQ0FBQyxNQUFNLDZCQUE2QixDQUFDO0FBR2pELE1BQU0sWUFBWSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDMUIsUUFBUSxFQUFFLENBQUMsQ0FBQyxNQUFNO0NBQ25CLENBQUMsQ0FBQztBQUlILE1BQU0sQ0FBQyxJQUFJLE9BQWdCLENBQUM7QUFFNUIsTUFBTSxVQUFVLFFBQVE7SUFDdEIsT0FBTztTQUNKLE1BQU0sQ0FBQyxVQUFVLEVBQUUsNEJBQTRCLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztJQUV0RSxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7SUFFaEIsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQzFCLE1BQU0sT0FBTyxHQUFHLFlBQVksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFMUMsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRTtRQUMzQixLQUFLLElBQUksS0FBSyxJQUFJLE9BQU8sQ0FBQyxJQUFJLEVBQUU7WUFDOUIsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzNELE9BQU8sQ0FBQyxJQUFJLENBQUMsbUJBQW1CLElBQUksY0FBZSxLQUFLLENBQUMsS0FBYSxFQUFFLFFBQVEsRUFBRSxlQUFlLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7U0FDeEo7UUFDRCxNQUFNLElBQUksS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUM7S0FDcEU7SUFDRCxPQUFPLEdBQUcsSUFBZSxDQUFDO0FBQzVCLENBQUMifQ==
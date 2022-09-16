import * as t from '../../../node_modules/io-ts';
import dotenv from '../../../node_modules/dotenv';
const EnvironmentCodec = t.type({
    NODE_ENV: t.string
});
export let environment;
export function setupEnvironment() {
    dotenv.config();
    const decoded = EnvironmentCodec.decode(process.env);
    if (decoded._tag === 'Left') {
        for (let error of decoded.left) {
            const path = error.context.map(node => node.key).join('/');
            console.warn(`Invalid environment variable: ${path}: (actual: ${error.value?.toString()}, expected: ${error.context[error.context.length - 1].type.name})`);
        }
        throw new Error('Invalid environment variables! see above warnings for details');
    }
    environment = process.env;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlbnZpcm9ubWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEtBQUssQ0FBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ2pELE9BQU8sTUFBTSxNQUFNLDhCQUE4QixDQUFDO0FBR2xELE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUM5QixRQUFRLEVBQUUsQ0FBQyxDQUFDLE1BQU07Q0FDbkIsQ0FBQyxDQUFDO0FBRUgsTUFBTSxDQUFDLElBQUksV0FBd0IsQ0FBQztBQUVwQyxNQUFNLFVBQVUsZ0JBQWdCO0lBQzlCLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUNoQixNQUFNLE9BQU8sR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRXJELElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUU7UUFDM0IsS0FBSyxJQUFJLEtBQUssSUFBSSxPQUFPLENBQUMsSUFBSSxFQUFFO1lBQzlCLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUMzRCxPQUFPLENBQUMsSUFBSSxDQUFDLGlDQUFpQyxJQUFJLGNBQWUsS0FBSyxDQUFDLEtBQWEsRUFBRSxRQUFRLEVBQUUsZUFBZSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO1NBQ3RLO1FBQ0QsTUFBTSxJQUFJLEtBQUssQ0FBQywrREFBK0QsQ0FBQyxDQUFDO0tBQ2xGO0lBQ0QsV0FBVyxHQUFHLE9BQU8sQ0FBQyxHQUFrQixDQUFDO0FBQzNDLENBQUMifQ==
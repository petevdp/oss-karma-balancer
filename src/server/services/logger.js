import winston from 'winston';
import { MESSAGE } from 'triple-beam';
import { prettyPrint } from '@base2/pretty-print-object';
import { format } from 'logform';
import { environment } from './environment';
export class MetadataError extends Error {
    constructor(msg, metadata) {
        super(msg);
        this.metadata = metadata;
    }
}
export let logger;
// const makeSerializable = (obj: any) => ({ })
function makeSerializable(obj) {
    return obj;
    return JSON.parse(JSON.stringify(obj, (_, v) => {
        return (typeof v).toLowerCase() === 'bigint' ? v.toString() : v;
    }));
}
export const ppObj = (obj) => prettyPrint(makeSerializable(obj), {
    indent: '\t',
    inlineCharacterLimit: 150
});
export function setupLogger() {
    logger = winston.createLogger({
        level: 'debug',
        format: format.combine(format.timestamp(), format.metadata(), format.errors(), format.json()),
        defaultMeta: { context: 'default' },
        transports: [
            new winston.transports.File({
                filename: './logs/error.log',
                handleExceptions: true,
                level: 'error'
            }),
            new winston.transports.File({
                filename: './logs/combined.log',
                handleExceptions: true
            })
        ]
    });
    if (environment.NODE_ENV !== 'production') {
        const pipeFormat = format((info, opts) => {
            let line = `$${info.level}|${info.metadata.context}|${info.message}`;
            if (info.error) {
                line += `\n${info.error}\n`;
            }
            info[MESSAGE] = line;
            return info;
        });
        const consoleFormat = format.combine(format.colorize(), pipeFormat());
        logger.add(new winston.transports.Console({
            debugStdout: true,
            format: consoleFormat,
        }));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibG9nZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sT0FNTixNQUFNLFNBQVMsQ0FBQztBQUNqQixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBQ3RDLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUN6RCxPQUFPLEVBQVUsTUFBTSxFQUFFLE1BQU0sU0FBUyxDQUFDO0FBQ3pDLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxlQUFlLENBQUM7QUErRDVDLE1BQU0sT0FBTyxhQUFjLFNBQVEsS0FBSztJQUN0QyxZQUFZLEdBQVcsRUFBUyxRQUFhO1FBQzNDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQURtQixhQUFRLEdBQVIsUUFBUSxDQUFLO0lBRTdDLENBQUM7Q0FDRjtBQUdELE1BQU0sQ0FBQyxJQUFJLE1BQXNDLENBQUM7QUFHbEQsK0NBQStDO0FBRS9DLFNBQVMsZ0JBQWdCLENBQUMsR0FBUTtJQUNoQyxPQUFPLEdBQUcsQ0FBQztJQUNYLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUM3QyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2xFLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDTixDQUFDO0FBRUQsTUFBTSxDQUFDLE1BQU0sS0FBSyxHQUFHLENBQUMsR0FBUSxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLEVBQUU7SUFDcEUsTUFBTSxFQUFFLElBQUk7SUFDWixvQkFBb0IsRUFBRSxHQUFHO0NBQzFCLENBQUMsQ0FBQztBQUVILE1BQU0sVUFBVSxXQUFXO0lBRXpCLE1BQU0sR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDO1FBQzVCLEtBQUssRUFBRSxPQUFPO1FBQ2QsTUFBTSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQ3BCLE1BQU0sQ0FBQyxTQUFTLEVBQUUsRUFDbEIsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUNqQixNQUFNLENBQUMsTUFBTSxFQUFFLEVBQ2YsTUFBTSxDQUFDLElBQUksRUFBRSxDQUNkO1FBQ0QsV0FBVyxFQUFFLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRTtRQUNuQyxVQUFVLEVBQUU7WUFDVixJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO2dCQUMxQixRQUFRLEVBQUUsa0JBQWtCO2dCQUM1QixnQkFBZ0IsRUFBRSxJQUFJO2dCQUN0QixLQUFLLEVBQUUsT0FBTzthQUNmLENBQUM7WUFDRixJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO2dCQUMxQixRQUFRLEVBQUUscUJBQXFCO2dCQUMvQixnQkFBZ0IsRUFBRSxJQUFJO2FBQ3ZCLENBQUM7U0FDSDtLQUNGLENBQUMsQ0FBQztJQUVILElBQUksV0FBVyxDQUFDLFFBQVEsS0FBSyxZQUFZLEVBQUU7UUFDekMsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBUyxFQUFFLElBQVMsRUFBRSxFQUFFO1lBQ2pELElBQUksSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDckUsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFO2dCQUNkLElBQUksSUFBSSxLQUFLLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQzthQUM3QjtZQUNELElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUM7WUFDckIsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDLENBQUMsQ0FBQztRQUNILE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQ2xDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsRUFDakIsVUFBVSxFQUFFLENBQ2IsQ0FBQztRQUdGLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztZQUN4QyxXQUFXLEVBQUUsSUFBSTtZQUNqQixNQUFNLEVBQUUsYUFBYTtTQUN0QixDQUFDLENBQUMsQ0FBQztLQUNMO0FBQ0gsQ0FBQyJ9
import { OnRequestBeginType, ServerExtension, OnRequestEndType, OnErrorType } from '../../types';
import chalk from 'chalk';
import { colorize } from 'json-colorizer';
import { formatBytes, LoggerOptionsType, mask, shouldLogTrigger } from './utils';
export { type LoggerOptionsType } from './utils';


export function loggerExtension(options: LoggerOptionsType = { showOnRequestBegin: true, showOnRequestEnd: true }): ServerExtension {
    return {
        onRequestBegin({ request }: OnRequestBeginType) {
            const { trigger, payload } = request;
            if (!shouldLogTrigger(trigger, options)) return;

            const lines = [
                chalk.gray.bold('\n🔔 ================ Request Begin ================ 🔔'),
                `${chalk.gray('🧩 Trigger:')} ${chalk.yellow(trigger)}`
            ];

            if (options.showPayload) {
                lines.push(
                    chalk.gray(`📤 Payload: ${colorize(JSON.stringify(mask(payload, options.includeTriggers)))}`)
                );
            }

            if (options.showOnRequestBegin == undefined || options.showOnRequestBegin)
                console.log(lines.join('\n'), "\n");
        },
        onRequestEnd({ request, response }: OnRequestEndType) {
            const { trigger } = request;
            if (!shouldLogTrigger(trigger, options)) return;

            const perf = response.performance ?? {};
            const time = perf.time ?? 0;
            const size = formatBytes(perf.size);

            const lines = [
                chalk.gray.bold('\n✅ ================ Request Completed ================ ✅'),
                `${chalk.gray('🧩 Trigger:')} ${chalk.yellow(trigger)}`,
                `${chalk.gray('⏱ Time:')} ${time}ms`,
                `${chalk.gray('📦 Size:')} ${size}`
            ];

            if (options.showResponse) {
                lines.push(
                    chalk.gray(`📥 Response: ${chalk.white(JSON.stringify(mask(response.data, options.includeTriggers), null, 2))}`),                
                );
            }

            if (options.showOnRequestEnd == undefined || options.showOnRequestEnd)
                console.log(lines.join('\n'), "\n");
        },
        onError({ request, error }: OnErrorType<{}>) {
            if (!shouldLogTrigger(request.trigger, options)) return;

            console.log(
                chalk.red.bold('\n❌ ================ Request Failed ================ ❌'),
                `${chalk.gray('🧩 Trigger:')} ${chalk.yellow(request.trigger)}`,
                chalk.red(error.message)
            );
        }
    };
}

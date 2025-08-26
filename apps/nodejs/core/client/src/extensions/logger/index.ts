import { OnRequestBeginType, ClientExtension, OnRequestEndType, OnErrorType } from '../../types';
import chalk from 'chalk';
import { colorize } from 'json-colorizer';
import { formatBytes, LoggerOptionsType, mask, shouldLogTrigger } from './utils';
export { type LoggerOptionsType } from './utils';


export function loggerExtension(options: LoggerOptionsType = { showOnRequestBegin: true, showOnRequestEnd: true }): ClientExtension {
    return {
        name: 'LoggerExtension',
        onRequestBegin({ request }: OnRequestBeginType) {
            const { trigger, payload } = request;
            if (!shouldLogTrigger(trigger, options)) return;

            const lines = [
                chalk.gray.bold('\n🔔 ================ Request Begin ================ 🔔'),
                `${chalk.gray('🧩 Trigger:')} ${chalk.yellow(trigger)}`
            ];

            if (options.showPayload) {
                lines.push(
                    chalk.gray(`📤 Payload: ${colorize(JSON.stringify(mask(payload, options.maskFields)))}`)
                );
            }

            if (options.showOnRequestBegin == undefined || options.showOnRequestBegin)
                console.log(lines.join('\n'), "\n");
        },
        onRequestEnd({ request, response }: OnRequestEndType) {
            const { trigger } = request;
            if (!shouldLogTrigger(trigger, options)) return;

            const perf = response.info?.performance ?? {};
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
                    chalk.gray('📥 Response:'),
                    JSON.stringify(mask(response.data, options.maskFields), null, 2)
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
        },
        onRequestRetry(ctx: OnRequestEndType) {
            const { trigger } = ctx;
            if (!shouldLogTrigger(trigger, options)) return;

            console.log(
                chalk.yellow.bold('\n⚠️ ================ Request Retried ================ ⚠️'),
                `${chalk.gray('🧩 Trigger:')} ${chalk.yellow(trigger)}`
            );
        },
    };
}

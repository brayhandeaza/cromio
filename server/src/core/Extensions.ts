import { ServerExtension } from "../types";



export class Extensions<TInjected extends object> {
    private extensions: ServerExtension<any>[] = [];

    useExtension<TNew extends object>(ext: ServerExtension<TNew>) {
        this.extensions.push(ext);
    }

    triggerHook(name: string, context: any = {}) {
        for (const ext of this.extensions) {
            const hook = ext[name as keyof typeof ext];
            if (typeof hook === 'function') {
                hook({ ...context });
            }
        }
    }
}

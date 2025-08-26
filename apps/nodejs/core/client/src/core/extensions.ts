import { ClientExtension } from "../types";



export class Extensions<TInjected extends object> {
    private extensions: ClientExtension<any>[] = [];

    useExtension<TNew extends object>(ext: ClientExtension<TNew>) {
        this.extensions.push(ext);
    }

    triggerHook(name: string, context: any = {}) {
        for (const ext of this.extensions) {
            if (ext[name as keyof typeof ext]) {
                ext[name as keyof typeof ext]!({ ...context });
            }
        }
    }
}

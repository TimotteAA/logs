// child_process
import {
    ChatCompletionRequestMessage,
    Configuration,
    OpenAIApi,
    CreateChatCompletionResponse,
} from 'openai';

process.on('message', (data) => {
    console.log(`Received message from parent process`);
    const {  } = JSON.parse(data);
});

// main process
export class TranslateService {
    private pool: Pool<any> = null;

    constructor() {
        this.pool = genericPool.createPool(factory, { max: 5 }); // 最多开5个
    }

    async translate(): Promise<void> {
        try {
            // 获得一个子进程
            const childProcess = await this.pool.acquire();
            console.log(`Executing child process with PID ${childProcess.pid}`);

            // 向子进程发送消息
            childProcess.send('Hello from parent process!');

            // 等待子进程完成任务
            await new Promise((resolve) => {
                childProcess.on('message', (message: string) => {
                    const data = JSON.parse(message);
                    if (data.type === 'done') {
                        // 释放子进程到进程池
                        this.pool.release(childProcess);
                        // @ts-ignore
                        resolve();
                    } else {
                        console.log('data from child process', data.data);
                    }
                });
            });
        } catch (error) {
            console.error(`Failed to execute child process: ${error}`);
        }
    }
}

// 线程池
import genericPool from "generic-pool";

/**
 * pool工厂
 */
export const factory = {
    create: () => {
        return new Promise((resolve) => {
            const childProcess = fork(
                path.resolve(process.cwd(), `dist/modules/gpt/services/translate.js`),
                [],
            );

            resolve(childProcess);
        });
    },
    destroy: async (childProcess: ChildProcess) => {
        childProcess.kill();
    },
};

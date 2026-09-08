/* Shared test rig: a real `ws` client against a server on an ephemeral port. */

import { WebSocket } from "ws"
import type { ClientMessage, ServerMessage } from "@bela/protocol"
import { createServer } from "../src/server.js"
import type { GameServer, ServerOptions } from "../src/server.js"

export const DEV_ENV: Record<string, string | undefined> = {
    GAME_DEV_ALLOW_ANON: "1",
    GAME_LOG_LEVEL: "error",
}

/** Fast timings so a whole game runs in milliseconds. */
export const FAST_TIMINGS = {
    declarationsMs: 0,
    turnTimeoutMs: 10_000,
    reconnectGraceMs: 10_000,
    botThinkMinMs: 0,
    botThinkMaxMs: 0,
    dealDoneAutoMs: 0,
    emptyRoomTtlMs: 60_000,
    finishedRoomTtlMs: 60_000,
    heartbeatMs: 60_000,
    lobbyDebounceMs: 5,
}

export async function startTestServer(options: ServerOptions = {}): Promise<GameServer> {
    const { timings, env, port, host, ...rest } = options
    return createServer({
        port: port ?? 0,
        host: host ?? "127.0.0.1",
        env: env ?? DEV_ENV,
        timings: { ...FAST_TIMINGS, ...timings },
        ...rest,
    })
}

type Predicate = (msg: ServerMessage) => boolean

interface Waiter {
    pred: Predicate
    resolve: (msg: ServerMessage) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
}

export class TestClient {
    readonly received: ServerMessage[] = []
    readonly ws: WebSocket
    private cursor = 0
    private waiter: Waiter | null = null
    private closedByUs = false

    constructor(ws: WebSocket) {
        this.ws = ws
        ws.on("message", (data) => {
            let parsed: ServerMessage
            try {
                parsed = JSON.parse(data.toString()) as ServerMessage
            } catch {
                return
            }
            this.received.push(parsed)
            this.pump()
        })
        ws.on("close", () => {
            if (this.waiter && !this.closedByUs) {
                const w = this.waiter
                this.waiter = null
                clearTimeout(w.timer)
                w.reject(new Error("socket closed while waiting"))
            }
        })
    }

    static connect(url: string): Promise<TestClient> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url)
            const client = new TestClient(ws)
            const onError = (err: Error): void => reject(err)
            ws.once("error", onError)
            ws.once("open", () => {
                ws.off("error", onError)
                resolve(client)
            })
        })
    }

    send(msg: ClientMessage): void {
        this.ws.send(JSON.stringify(msg))
    }

    sendRaw(text: string): void {
        this.ws.send(text)
    }

    private pump(): void {
        const w = this.waiter
        if (!w) return
        while (this.cursor < this.received.length) {
            const msg = this.received[this.cursor]
            this.cursor += 1
            if (msg && w.pred(msg)) {
                this.waiter = null
                clearTimeout(w.timer)
                w.resolve(msg)
                return
            }
        }
    }

    /** Next message (from the unconsumed backlog onwards) matching `pred`. */
    next(pred: Predicate, timeoutMs = 4000): Promise<ServerMessage> {
        if (this.waiter) return Promise.reject(new Error("only one pending wait at a time"))
        return new Promise<ServerMessage>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.waiter = null
                reject(
                    new Error(
                        `timed out after ${timeoutMs}ms; seen: ${this.received
                            .map((m) => m.t)
                            .join(",")}`,
                    ),
                )
            }, timeoutMs)
            this.waiter = { pred, resolve, reject, timer }
            this.pump()
        })
    }

    nextOfType<T extends ServerMessage["t"]>(
        t: T,
        timeoutMs = 4000,
    ): Promise<Extract<ServerMessage, { t: T }>> {
        return this.next((m) => m.t === t, timeoutMs) as Promise<Extract<ServerMessage, { t: T }>>
    }

    /** Anything already received matching `pred` (does not move the cursor). */
    seen(pred: Predicate): ServerMessage | undefined {
        return this.received.find(pred)
    }

    async hello(devName: string): Promise<Extract<ServerMessage, { t: "hello.ok" }>> {
        this.send({ t: "hello", v: 1, devName })
        return this.nextOfType("hello.ok")
    }

    close(): Promise<void> {
        this.closedByUs = true
        return new Promise((resolve) => {
            if (this.ws.readyState === WebSocket.CLOSED) {
                resolve()
                return
            }
            this.ws.once("close", () => resolve())
            this.ws.close()
        })
    }

    terminate(): void {
        this.closedByUs = true
        this.ws.terminate()
    }
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Poll until `pred` holds, so tests never race the server's own bookkeeping. */
export async function until(
    pred: () => boolean,
    timeoutMs = 3000,
    stepMs = 10,
): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (pred()) return
        await sleep(stepMs)
    }
    throw new Error("condition not met within timeout")
}

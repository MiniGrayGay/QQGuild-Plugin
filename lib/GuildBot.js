import WebSocket from "ws"
import buffer from "node:buffer"
import fs from "node:fs"
import path from "node:path"

export default class GuildBot {

    constructor(conf) {
        this.config = {
            ...conf,
            botToken: `Bot ${conf.appId}.${conf.token}`
        }
    }

    async init(hMsg, hReady, hInvalid, hUrl) {
        let r = await this.callApi("/gateway")
        if (!r.url) {
            hUrl(r)
            return
        }

        let heartbeatO = 0
        let heartbeatM = 0

        let wss = () => {
            let ws = new WebSocket(r.url)

            let heartbeatX = 0
            let heartbeatS = 0

            let heartbeatU = () => {
                ws.send(JSON.stringify({ op: 1, d: null }))
                Bot.logger.debug("[QQ频道插件] 心跳.首次")
            }
            let heartbeatV = () => {
                ws.send(JSON.stringify({ op: 1, d: heartbeatS }))
                Bot.logger.debug("[QQ频道插件] 心跳.", heartbeatS)
            }

            ws.on("error", (error) => {
                Bot.logger.debug("[QQ频道插件] WebSocket 连接错误.", error)
            })

            ws.on("close", (code, reason) => {
                let state = "Unknown"
                switch (ws.readyState) {
                    case 0:
                        state = "CONNECTING"
                        break
                    case 1:
                        state = "OPEN"
                        break
                    case 2:
                        state = "CLOSING"
                        break
                    case 3:
                        state = "CLOSED"
                }
                Bot.logger.debug("[QQ频道插件] WebSocket 断开连接.", code, reason.toString(), state)

                if (heartbeatO) {
                    heartbeatO = clearInterval(heartbeatO)
                    Bot.logger.debug("[QQ频道插件] WebSocket 停止心跳.")
                }

                if (!heartbeatM) {
                    heartbeatM = setInterval(wss, 3000)
                    Bot.logger.debug("[QQ频道插件] WebSocket 开始重连.")
                }
            })

            ws.on("open", () => {
                Bot.logger.debug("[QQ频道插件] WebSocket 连接成功.")
                if (heartbeatM) {
                    heartbeatM = clearInterval(heartbeatM)
                    Bot.logger.debug("[QQ频道插件] WebSocket 停止重连.")
                }
            })

            ws.on("ping", (data) => {
                Bot.logger.debug("[QQ频道插件] WebSocket Ping.", data)
            })

            ws.on("pong", (data) => {
                Bot.logger.debug("[QQ频道插件] WebSocket Pong.", data)
            })

            ws.on("message", (data, isBinary) => {
                let msg = JSON.parse(data)

                if (msg.s) heartbeatS = msg.s

                switch (msg.op) {
                    case 0:
                        if (msg.t === "READY") {
                            heartbeatU()
                            hReady(msg.d)
                            Bot.logger.debug("[QQ频道插件] 收到消息.", msg)
                        } else {
                            hMsg(msg)
                        }
                        return
                    case 9:
                        hInvalid(msg.d)
                        Bot.logger.debug("[QQ频道插件] 收到消息.", msg)
                        return
                    case 10:
                        heartbeatX = msg.d.heartbeat_interval
                        ws.send(JSON.stringify({
                            op: 2,
                            d: {
                                token: this.config.botToken,
                                intents: this.config.intents
                            }
                        }))
                        Bot.logger.debug("[QQ频道插件] 收到消息.", msg)
                        return
                    case 11:
                        Bot.logger.debug("[QQ频道插件] 心跳反应.", msg)
                        if (!heartbeatO) {
                            heartbeatO = setInterval(heartbeatV, heartbeatX)
                            Bot.logger.debug("[QQ频道插件] 开始心跳.")
                        }
                        return
                    default:
                        Bot.logger.debug("[QQ频道插件] 收到消息(未处理).", msg)
                }
            })
        }

        wss()
    }

    async callApi(inr, option = {}) {
        let url = this.config.sandbox ? "https://sandbox.api.sgroup.qq.com" : "https://api.sgroup.qq.com"
        if (!option.headers) option.headers = {}
        option.headers.Authorization = this.config.botToken
        return await fetch(url + inr, option).then(r => r.json()).then(r => r).catch(e => e)
    }

    async postMsg(toId, msg, isDms) {
        let fd = new FormData()
        if (msg.content) fd.append("content", msg.content)
        if (msg.embed) fd.append("embed", JSON.stringify(msg.embed))
        if (msg.ark) fd.append("ark", JSON.stringify(msg.ark))
        if (msg.message_reference) fd.append("message_reference", JSON.stringify(msg.message_reference))
        if (msg.image) fd.append("image", msg.image)
        if (msg.msg_id) fd.append("msg_id", msg.msg_id)
        if (msg.event_id) fd.append("event_id", msg.event_id)
        if (msg.markdown) fd.append("markdown", JSON.stringify(msg.markdown))
        if (msg.file_image) fd.append("file_image", new buffer.File([fs.readFileSync(msg.file_image).parent], path.basename(msg.file_image)))
        if (msg.file) fd.append("file_image", new buffer.File([msg.file.parent], "image"))
        return await this.callApi(isDms ? `/dms/${toId}/messages` : `/channels/${toId}/messages`, { method: "POST", body: fd })
    }

    async createDms(sourceGuildId, recipientId) {
        return await this.callApi("/users/@me/dms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source_guild_id: sourceGuildId, recipient_id: recipientId }) })
    }

}

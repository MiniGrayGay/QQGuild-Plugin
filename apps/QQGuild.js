import Plugin from "../../../lib/plugins/plugin.js"
import PluginsLoader from "../../../lib/plugins/loader.js"
import GuildBot from "../lib/GuildBot.js"
import yaml from "yaml"
import fs from "node:fs"
import path from "node:path"
import url from "node:url"

export class QQGuild extends Plugin {

    constructor() {
        super({
            name: "QQ频道插件",
            priority: -10000,
            rule: [
                {
                    reg: "频道主",
                    fnc: "频道主"
                }
            ]
        })
    }

    频道主(e) {
        if (e.is_owner) {
            e.reply("频道主八嘎呀路，阿巴阿巴滴")
        } else {
            e.reply("频道主趋势了 ^_^")
        }
    }

    init() {
        let { version, author } = JSON.parse(fs.readFileSync("./plugins/QQGuild-Plugin/package.json"))
        logger.info(`欢迎使用QQ频道插件.v${version} 编写者：${author}`)

        let configFile = "./plugins/QQGuild-Plugin/config/.bot.yaml"
        if (!fs.existsSync(configFile)) configFile = configFile.replace(".bot.yaml", "bot.yaml")

        let config = {
            ...yaml.parse(fs.readFileSync(configFile, "UTF-8")),
            intents: 0 | 1 << 1 | 1 << 12
        }

        if (config.allMsg) {
            config.intents |= 1 << 9
        } else {
            config.intents |= 1 << 30
        }

        if (!config.appId?.length) {
            logger.info("[QQ频道插件] APPID 无效！")
            return
        }

        if (!config.token?.length) {
            logger.info("[QQ频道插件] TOKEN 无效！")
            return
        }

        this.bot = new GuildBot(config)
        this.bot.init((msg) => {
            switch (msg.t) {
                case "GUILD_MEMBER_ADD":
                    this.hMemberAdd(msg.d)
                    return
                case "GUILD_MEMBER_REMOVE":
                    this.hMemberRemove(msg.d)
                    return
                case "MESSAGE_CREATE":
                    this.hMsgCreate(msg.d)
                    return
                case "MESSAGE_DELETE":
                    this.hMsgDelete(msg.d)
                    return
                case "AT_MESSAGE_CREATE":
                    this.hMsgCreate(msg.d)
                    return
                case "PUBLIC_MESSAGE_DELETE":
                    this.hMsgDelete(msg.d)
                    return
                case "DIRECT_MESSAGE_CREATE":
                    this.hDmsCreate(msg.d)
                    return
                case "DIRECT_MESSAGE_DELETE":
                    this.hDmsDelete(msg.d)
                    return
                default:
                    logger.debug("[QQ频道插件] 收到消息(未处理).", msg)
            }
        }, (info) => {
            this.bot.info = info.user
            logger.info("[QQ频道插件] 连接成功. 机器人：", info.user.username)
        }, (info) => {
            logger.warn("[QQ频道插件] 连接失败！")
        }, (info) => {
            logger.warn("[QQ频道插件] 获取连接地址失败！")
            logger.debug(info)
        })
    }

    async hMemberAdd(msg) {
        logger.debug("[QQ频道插件] 频道.加入成员", msg)
        // TODO ........
    }

    async hMemberRemove(msg) {
        logger.debug("[QQ频道插件] 频道.成员退出", msg)
        // TODO ........
    }

    async hMsgCreate(msg) {
        logger.debug("[QQ频道插件] 子频道.收到消息", msg)
        await this.callPlugs(msg)
    }

    async hMsgDelete(msg) {
        logger.debug("[QQ频道插件] 子频道.撤回消息", msg)
        // TODO ........
    }

    async hDmsCreate(msg) {
        logger.debug("[QQ频道插件] 私信.收到消息", msg)
        await this.callPlugs(msg, true)
    }

    async hDmsDelete(msg) {
        logger.debug("[QQ频道插件] 私信.撤回消息", msg)
        // TODO ........
    }

    async callPlugs(msg, isDms) {
        let e = this.makee(msg, isDms)
        if (e) await PluginsLoader.deal(e)
    }

    makee(msg, isDms) {
        if (!msg.content) {
            logger.debug("[QQ频道插件] 跳过消息.", msg)
            return
        }

        let e = isDms ? this.makeePrivate(msg) : this.makeeGroup(msg)

        e.reply = async (m) => {
            logger.debug("[QQ频道插件] 发送消息.", m)

            let rMsg = { msg_id: msg.id }

            let addImg = (f) => {
                if (Buffer.isBuffer(f)) {
                    rMsg.file = f
                    return
                }

                if (typeof f !== "string") {
                    return false
                }

                let p = f

                if (/^file:/i.test(f)) {
                    try {
                        p = url.fileURLToPath(f)
                    } catch {
                        p = f.replace(/^file:[\\\/]{2}/i, "")
                        if (!fs.existsSync(p)) p = f.replace(/^file:[\\\/]{3}/i, "")
                    }
                }

                if (!fs.existsSync(p)) return false

                rMsg.file_image = p
            }

            let addMsg = (m) => {
                let content = ""
                switch (typeof m) {
                    case "string":
                        content += m
                        break
                    case "number":
                        content += `${m}`
                        break
                    case "object":
                        switch (m.type) {
                            case "text":
                                content += m.text
                                break
                            case "face":
                                content += `<emoji:${m.id}>`
                                break
                            case "at":
                                content += m.qq === parseInt(e.user_id) ? `<@!${e.user_id}>` : "@某某人"
                                break
                            case "image":
                                if (addImg(m.file) === false) {
                                    logger.debug("[QQ频道插件] 跳过回复消息转制(图片).", m)
                                }
                                break
                            default:
                                if (Array.isArray(m)) {
                                    for (let v of m) content += addMsg(v)
                                } else {
                                    logger.debug("[QQ频道插件] 跳过回复消息转制(无法识别).", m)
                                }
                        }
                        break
                    default:
                        logger.debug("[QQ频道插件] 跳过回复消息转制(无法识别).", m)
                }

                return content
            }

            let content = addMsg(m)

            if (content.length) rMsg.content = content

            logger.debug("[QQ频道插件] 转制回复消息结果.", rMsg)

            if ((() => { let i = 0; for (let _ in rMsg) i++ })() < 1) {
                logger.debug("[QQ频道插件] 跳过消息发送.", m)
            } else {
                let rsp = await this.bot.postMsg(isDms ? msg.guild_id : msg.channel_id, rMsg, isDms)
                logger.debug("[QQ频道插件] 发送消息结果.", rsp)
            }
        }

        logger.debug("[QQ频道插件] 转制消息.", e)

        return e
    }

    makeePrivate(msg) {
        let time = parseInt(Date.parse(msg.timestamp) / 1000)
        let message = this.makeeMessage(msg.content)
        return {
            ...message,
            post_type: "message",
            message_id: msg.id,
            user_id: msg.author.id,
            time,
            message_type: "private",
            sender: {
                user_id: msg.author.id,
                nickname: msg.author.username,
            },
            from_id: msg.author.id
        }
    }

    makeeGroup(msg) {
        let time = parseInt(Date.parse(msg.timestamp) / 1000)
        let role = msg.member.roles.includes("4") ? "owner" : msg.member.roles.includes("2") ? "admin" : "member"
        let is_owner = msg.member.roles.includes("4")
        let message = this.makeeMessage(msg.content)
        return {
            ...message,
            post_type: "message",
            message_id: msg.id,
            user_id: msg.author.id,
            time,
            message_type: "group",
            sender: {
                user_id: msg.author.id,
                nickname: msg.author.username,
                card: msg.member.nick,
                role
            },
            is_owner,
            group_id: msg.guild_id,
            group_name: "QQ频道"
        }
    }

    makeeMessage(content) {
        let raw_message = content
        let rex_message = content
        let message = []

        let rex = /(?<t>\<((?<at>@!)|(?<face>emoji):)(?<id>\d+)>)/

        while (rex) {
            let r = rex.exec(rex_message)

            if (!r) {
                if (rex_message.length) message.push({ type: "text", text: rex_message})
                break
            }

            if (r.index) {
                message.push({ type: "text", text: rex_message.slice(0, r.index)})
            }

            if (r.groups.at) {
                let qq = r.groups.id
                let text = "@某某人"
                if (r.groups.id === this.bot.info.id) {
                    qq = Bot.uin
                    text = `@${this.bot.info.username}`
                }
                raw_message = raw_message.replace(r.groups.t, text)
                message.push({ type: "at", qq, text})
            }

            if (r.groups.face) {
                raw_message = raw_message.replace(r.groups.t, "[表情]")
                message.push({ type: "face", id: r.groups.id, text: "表情" })
            }

            rex_message = rex_message.slice(r.index + r.groups.t.length)
        }

        return { message, raw_message }
    }

}

import Plugin from "../../../lib/plugins/plugin.js"
import PluginsLoader from "../../../lib/plugins/loader.js"
import GuildBot from "../lib/GuildBot.js"
import lodash from "lodash"
import yaml from "yaml"
import fs from "node:fs"
import path from "node:path"

export class QQGuild extends Plugin {
    constructor() {
        super({
            name: "QQ频道插件",
            priority: -10000,
            rule: [
                {
                    reg: "频道主",
                    fnc: "owner"
                }
            ]
        })
    }

    owner(e) {
        if (e.is_owner) {
            e.reply("频道主八嘎呀路，阿巴阿巴滴")
        } else {
            e.reply("频道主趋势了 ^_^")
        }
    }

    init() {
        let { version, author } = JSON.parse(fs.readFileSync("./plugins/QQGuild-Plugin/package.json"))
        logger.info(`欢迎使用QQ频道插件.v${version} 编写者：${author}`)

        let configPath = "./plugins/QQGuild-Plugin/config/"
        let configFile = configPath + fs.existsSync(".bot.yaml") : ".bot.yaml" : "bot.yaml"

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
            logger.info("QQ频道插件：APPID 无效！")
            return
        }

        if (!config.token?.length) {
            logger.info("QQ频道插件：TOKEN 无效！")
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
                    logger.debug("QQ频道插件：收到消息(未处理).", msg)
            }
        }, (info) => {
            this.bot.info = info.user
            logger.info("QQ频道插件：连接成功. 机器人：", info.user.username)
        }, (info) => {
            logger.warn("QQ频道插件：连接失败！")
        }, (info) => {
            logger.warn("QQ频道插件：获取连接地址失败！")
        })
    }

    async hMemberAdd(msg) {
        logger.debug("QQ频道插件：频道.加入成员", msg)
        // TODO ........
    }

    async hMemberRemove(msg) {
        logger.debug("QQ频道插件：频道.成员退出", msg)
        // TODO ........
    }

    async hMsgCreate(msg) {
        logger.debug("QQ频道插件：子频道.收到消息", msg)
        await this.callPlugs(msg)
    }

    async hMsgDelete(msg) {
        logger.debug("QQ频道插件：子频道.撤回消息", msg)
        // TODO ........
    }

    async hDmsCreate(msg) {
        logger.debug("QQ频道插件：私信.收到消息", msg)
        await this.callPlugs(msg, true)
    }

    async hDmsDelete(msg) {
        logger.debug("QQ频道插件：私信.撤回消息", msg)
        // TODO ........
    }

    async callPlugs(msg, isDms) {
        let e = this.makee(msg, isDms)
        logger.debug("QQ频道插件：转制消息.", e)
        if (e) await PluginsLoader.deal(e)
    }

    makee(msg, isDms) {
        if (!msg.content) {
            logger.debug("QQ频道插件：跳过消息.", msg)
            return
        }

        let e = isDms ? this.makeePrivate(msg) : this.makeeGroup(msg)

        e.reply = async (m) => {
            let rMsg = { msg_id: msg.id }

            let addImg = (i) => {
                if (Buffer.isBuffer(m.file)) {
                    rMsg.file = i.file
                } else if (typeof i.file === "string") {
                    rMsg.file_image = i.file.replace(/^file:\/+/, "")
                } else {
                    return false
                }
                return true
            }

            switch (typeof m) {
                case "string":
                    rMsg.content = m
                    break
                case "number":
                    rMsg.content = `${m}`
                    break
                case "object":
                    if (Array.isArray(m)) {
                        let text = ""
                        for (let x of m) {
                            if (typeof x === "string") {
                                text += x
                            } else if (lodash.isObject(x)){
                                switch (x.type) {
                                    case "text":
                                        text += x.text
                                        break
                                    case "at":
                                        text += `<@!${msg.author.id}>`
                                        break
                                    case "face":
                                        text += `<emoji:${x.id}>`
                                        break
                                    default:
                                        if (!addImg(x)) {
                                            logger.debug("QQ频道插件：跳过回复消息转制.", x)
                                        }
                                }
                            } else {
                                logger.debug("QQ频道插件：跳过回复消息转制.", x)
                            }
                        }
                        if (text.length > 0) rMsg.content = text
                    } else if (!addImg(m)) {
                        logger.debug("QQ频道插件：跳过消息发送.", m)
                        return
                    }
                    break
                default:
                    logger.debug("QQ频道插件：跳过消息发送.", m)
                    return
            }

            logger.debug("QQ频道插件：发送消息.", m, rMsg)

            let rsp = await this.bot.postMsg(isDms ? msg.guild_id : msg.channel_id, rMsg, isDms)
            logger.debug("QQ频道插件：发送消息结果.", rsp)
        }

        return e
    }

    // 频道私信，转制成QQ私聊
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

    // 子频道消息，转制成QQ群聊
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
            member: {
                is_owner
            },
            is_owner,
            group_id: msg.guild_id,
            group_name: "QQ频道"
        }
    }

    makeeMessage(content) {
        let raw_message = content
        let message = []

        let at = content.match(/\<@!\d+>/g)
        if (at) at.forEach((at) => {
            let qq = at.match(/\d+/)[0]
            let text = qq == this.bot.info.id ? `@${this.bot.info.username}` : "@欧尼酱"
            raw_message = raw_message.replace(at, text)
            message.push({ type: "at", qq, text })
        })

        let emoji = content.match(/\<emoji:\d+>/g)
        if (emoji) emoji.forEach((emoji) => {
            let id = emoji.match(/\d+/)[0]
            let text = "[表情]"
            raw_message = raw_message.replace(emoji, text)
            message.push({ type: "face", id, text })
        })

        let text = content.replace(/\<(@!|emoji:)\d+>/g, "O|z").split("O|z")
        if (text) text.forEach((text) => {
            if (text.length) message.push({ type: "text", text })
        })

        return { message, raw_message }
    }

}

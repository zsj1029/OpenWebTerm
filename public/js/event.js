"use strict";

const Href = window.location.href;
const Host = window.location.host;
const Origin = window.location.origin;
const Path = window.location.pathname;
const API = {
    tunnel: `ws://${Host}`
}

function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) === 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

class Ins {
    static STATE_IDLE = 0;
    static STATE_CONNECTING = 1;
    static STATE_WAITING = 2;
    static STATE_CONNECTED = 3;
    static STATE_DISCONNECTING = 4;
    static STATE_DISCONNECTED = 5;
    state = {
        fullScreen: false,
        token: '',
        assetId: '',
        protocol: 'vnc',
        client: null,
        scale: 1,
        port: 5901,
        direct: '',
        dpi: 96,
        clientState: Ins.STATE_IDLE,
        error: false,
        clipboardText: '',
        username: getCookie('uuu'),
        password: getCookie('ppp'),
    }
    fullScreenBtn = document.getElementById("fullScreen")
    clipsBtn = document.getElementById("clips")
    clipsContents;
    query;//地址传参

    constructor() {
        console.log(`Guacamole Version:${Guacamole.API_VERSION}`);
        this.query = outils.parseQueryString(Href);
        this.state.hostname = this.query['hostname'];
        this.state.token = this.query['token'];
        this.state.port = this.query['port'];
        this.state.direct = this.query['direct'] ?? '';
        this.state.assetId = this.query['assetId'];
        this.state.protocol = this.query['protocol'] ?? 'vnc';
        this.width = window.innerWidth;
        this.height = window.innerHeight
        $('title').html(`${this.state.protocol} 远程:` + this.query['ip'])
    }

    _height

    get height() {
        return this._height
    }

    set height(height) {
        this._height = height
        $("#container").height(this.height)
    }

    _width

    get width() {
        return this._width
    }

    set width(width) {
        this._width = width
        $("#container").width(this.width)
    }

    render = () => {
        this.fullScreenBtn.addEventListener('click', this.fullScreen)
        this.clipsBtn.addEventListener('click', this.openClips)
        window.onkeydown = (key) => {
            const EnterBtn = $('.layui-layer-btn0')
            if (key.key === 'Enter' && EnterBtn) {
                EnterBtn.click();
            }
        }
        // 后期方案token保持连接，去除this.state.password判断即可
        if (!this.state.token || !this.state.password) {
            this.needLogin();
            return false;
        }
        this.tunnelConn();
    }

    openClips = () => {
        let index = layer.open({
            type: 0,
            closeBtn: 0,
            offset: '100px',
            title: "粘贴板-（内容双向复制）",
            content: `
            <div  >
                <form>
                    <label for="contents">
                       <textarea id="clipsContents" name="contents" rows="10" cols="60"></textarea>
                    </label>
                </form>
            </div>
            `,
            success: () => {
                this.clipsContents = document.getElementById("clipsContents");
                this.clipsContents.value = this.state.clipboardText;
            },
            btn: ['确认', '取消'],
            btn1: async () => {
                this.sendClipboard({
                    'data': this.clipsContents.value,
                    'type': 'text/plain'
                })
                layer.msg('复制成功，请粘贴使用', {
                    offset: 't', time: 3000
                })
                layer.close(index)
            },
            btn2: () => {
                layer.close(index)
            }
        })
    }

    // Guacamole ws连接
    tunnelConn = () => {
        const tunnel = new Guacamole.WebSocketTunnel(API.tunnel)
        // console.log(API.tunnel.replace("{session_id}", this.state.token))
        tunnel.onstatechange = this.onTunnelStateChange;
        const client = new Guacamole.Client(tunnel)
        // console.log(client)
        client.sendClipboard = this.sendClipboard
        client.onclipboard = this.clientClipboardReceived;
        client.onstatechange = this.onClientStateChange;
        client.onerror = this.onError;
        tunnel.onerror = this.onError;
        const container = document.getElementById("container");
        const element = client.getDisplay().getElement()
        container.appendChild(element)
        if (this.state.protocol === 'ssh') {
            this.state.scale = 0.5;
            this.state.dpi = this.state.dpi * 2;
        }

        const wsParams = {
            width: this.width / this.state.scale,
            height: this.height / this.state.scale,
            hostname: this.state.hostname,
            dpi: this.state.dpi,
            port: this.state.port,
            protocol: this.state.protocol,
            username: getCookie('uuu'),
            password: getCookie('ppp'),
        }

        client.connect(outils.stringfyQueryString(wsParams))
        window.onunload = function () {
            client.disconnect();
        };
        const mouse = new Guacamole.Mouse(element);
        mouse.onmousedown = mouse.onmouseup = (mouseState) => {
            client.sendMouseState(mouseState);
        };
        mouse.onmousemove = (mouseState) => {

            mouseState.x = mouseState.x / this.state.scale;
            mouseState.y = mouseState.y / this.state.scale;
            // console.log(mouseState)
            client.sendMouseState(mouseState);
        };
        const sink = new Guacamole.InputSink();
        container.appendChild(sink.getElement());
        sink.focus();
        // Keyboard
        const keyboard = new Guacamole.Keyboard(sink.getElement());
        keyboard.onkeydown = this.onKeyDown;
        keyboard.onkeyup = this.onKeyUp;

        this.state.keyboard = keyboard;
        this.state.slink = sink
        this.state.client = client;
        this.onWindowResize();
        window.addEventListener('beforeunload', this.handleUnload);
        window.addEventListener('resize', this.onWindowResize);

    }

    clearAuth = () => {
        outils.removeCookie('uuu')
        outils.removeCookie('ppp')
        window.location.href = Origin + Path + '?' + outils.stringfyQueryString(this.query)
    }
    setAuth = (token, uuu, ppp) => {
        outils.setCookie('uuu', (uuu), 1)
        outils.setCookie('ppp', (ppp), 1)
        this.tunnelConn()
    }
    getToken = async (assetId, username, password) => {
        const formData = new FormData();
        formData.append('vmid', assetId);
        formData.append('username', username);
        formData.append('password', password);
        // try {
        const resp = await fetch(API.getToken, {
            method: 'POST',
            credentials: 'include',
            body: formData
        })
        //http status 错误处理
        if (resp.status !== 200) {
            throw new Error(`${resp.status} ${resp.statusText} `)
        }
        const data = await resp.json();
        //业务 code 错误处理
        if (data.code !== 200) {
            throw new Error(`${data.code} ${data.msg}`)
        }
        console.log(data.data)
        return data.data
        // } catch (e) {
        //     console.log('捕获异常：' + e)
        //     this.showMessage(`错误： ${e.message}`)
        // }
    }

    // 登录窗口
    needLogin = () => {
        let index = layer.open({
            type: 0,
            closeBtn: 0,
            offset: '100px',
            title: "请录入远程密码",
            content: `
            <div id="vmLogin" >
                <form>
                    <label style=";font-size: 16px">主机：${this.query['hostname']}</label>
                    <br>
                    <label for="username">账号：
                        <input value="${this.query['username']}"  style="margin-top: 10px" id="username" type="text">
                    </label><br>
                    <label for="password">密码：
                        <input id="password" style="margin-top: 10px" type="password">
                    </label>
                </form>
            </div>
            `,
            btn: ['登录', '退出'],
            yes: async () => {
                const username = $('#username').val();
                const password = $('#password').val();
                this.setAuth('', username, password)
                layer.close(index)

            },
            btn2: () => {
                window.close()
                return false
            }, success: () => {
                setTimeout(() => {
                    $('#password').focus()
                }, 500)

            }
        });
    }


    sendClipboard = (data) => {
        let writer;
        // Create stream with proper mimetype
        const stream = this.state.client.createClipboardStream(data.type);
        // Send data as a string if it is stored as a string
        if (typeof data.data === 'string') {
            writer = new Guacamole.StringWriter(stream);
            writer.sendText(data.data);
            writer.sendEnd();
        } else {
            // Write File/Blob asynchronously
            writer = new Guacamole.BlobWriter(stream);
            writer.oncomplete = function clipboardSent() {
                writer.sendEnd();
            };
            // Begin sending data
            writer.sendBlob(data.data);
        }
        this.state.clipboardText = data.data
        if (this.state.protocol === 'ssh') {
            if (data.data && data.data.length > 0) {
                // message.info('您输入的内容已复制到远程服务器上，使用右键将自动粘贴。');
            }
        } else {
            if (data.data && data.data.length > 0) {
                // message.info('您输入的内容已复制到远程服务器上');
            }
        }
    }
    clientClipboardReceived = async (stream, mimetype) => {
        let reader;
        // If the received data is text, read it as a simple string
        if (/^text\//.exec(mimetype)) {
            reader = new Guacamole.StringReader(stream);
            let data = '';
            reader.ontext = function textReceived(text) {
                data += text;
            };
            // Set clipboard contents once stream is finished
            reader.onend = async () => {
                // message.info('您选择的内容已复制到您的粘贴板中，在右侧的输入框中可同时查看到。');
                this.state.clipboardText = data
                // this.clipsContents.value = data;
                try {
                    if (navigator.clipboard) {
                        await navigator.clipboard.writeText(data);
                    }
                } catch (e) {
                    console.log(e)
                }

            };
        } else {
            reader = new Guacamole.BlobReader(stream, mimetype);
            reader.onend = () => {
                this.state.clipboardText = reader.getBlob()
                // this.clipsContents.value = reader.getBlob();
            }
        }
    };

    onKeyDown = (keysym) => {
        this.state.client.sendKeyEvent(1, keysym);
        if (keysym === 65288) {
            return false;
        }
    };

    onKeyUp = (keysym) => {
        this.state.client.sendKeyEvent(0, keysym);
    };

    onTunnelStateChange = (state) => {
        if (state === Guacamole.Tunnel.State.CLOSED) {
            console.log('web socket 已关闭');
        }
    }

    onClientStateChange = (state) => {
        this.state.clientState = state;
        switch (state) {
            case Ins.STATE_IDLE:
                layer.closeAll();
                layer.msg('正在初始化中...', {
                    offset: 't', time: 0
                })
                break;
            case Ins.STATE_CONNECTING:
                layer.closeAll();
                layer.msg('正在努力连接中...', {
                    offset: 't', time: 0
                })
                break;
            case Ins.STATE_WAITING:
                layer.closeAll();
                layer.msg('正在等待服务器响应...', {
                    offset: 't', time: 0
                })
                break;
            case Ins.STATE_CONNECTED:
                layer.closeAll();
                layer.msg('连接成功...', {
                    offset: 't', time: 2000
                })
                $('.tools').show()
                break;
            case Ins.STATE_DISCONNECTING:

                break;
            case Ins.STATE_DISCONNECTED:
                if (!this.state.error) {
                    this.showMessage('连接已关闭');
                }
                $('.tools').hide()
                break;
            default:
                break;
        }
    }

    showMessage = (msg) => {
        layer.closeAll();
        layer.confirm(msg, {
            icon: 5,
            btn: ['重新连接', '关闭']
        }, () => {
            this.clearAuth()
        }, () => {
            layer.closeAll();
        });
    }

    handleUnload = () => {
        // console.log(Ins.STATE_CONNECTED);
        return "要断开连接吗？";
    }

    onWindowResize = () => {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        if (this.state.client) {
            const display = this.state.client.getDisplay();
            let scale = this.state.scale;
            display.scale(scale);
            this.state.client.sendSize(this.width / scale, this.height / scale);
        }
    }
    onError = (status) => {
        this.state.error = true;
        console.log('通道异常。', status);

        switch (status.code) {
            case 256:
                this.showMessage('未支持的访问');
                break;
            case 512:
                this.showMessage('远程服务异常，请检查目标设备能否正常访问。');
                break;
            case 513:
                this.showMessage('服务器忙碌');
                break;
            case 514:
                this.showMessage('服务器连接超时');
                break;
            case 515:
                this.showMessage('远程服务异常');
                break;
            case 516:
                this.showMessage('资源未找到');
                break;
            case 517:
                this.showMessage('资源冲突');
                break;
            case 518:
                this.showMessage('资源已关闭');
                break;
            case 519:
                this.showMessage('远程服务未找到');
                break;
            case 520:
                this.showMessage('远程服务不可用');
                break;
            case 521:
                this.showMessage('会话冲突');
                break;
            case 522:
                this.showMessage('会话连接超时');
                break;
            case 523:
                this.showMessage('会话已关闭');
                break;
            case 768:
                this.showMessage('网络不可达');
                break;
            case 769:
                this.showMessage('服务器密码验证失败');
                break;
            case 771:
                this.showMessage('客户端被禁止');
                break;
            case 776:
                this.showMessage('客户端连接超时');
                break;
            case 781:
                this.showMessage('客户端异常');
                break;
            case 783:
                this.showMessage('错误的请求类型');
                break;
            case 800:
                this.showMessage('会话不存在');
                break;
            case 801:
                this.showMessage('创建隧道失败，请检查Guacd服务是否正常。');
                break;
            case 802:
                this.showMessage('管理员强制关闭了此会话');
                break;
            default:
                if (status.message) {
                    this.showMessage(decodeURIComponent((window.atob(status.message))));
                } else {
                    this.showMessage('未知错误。');
                }
        }
    }
    exitFullScreen = async () => {
        const exitMethod = document.exitFullscreen || //W3C
            document.mozCancelFullScreen || //FireFox
            document.webkitExitFullscreen || //Chrome等
            document.webkitExitFullscreen; //IE11
        // console.log(exitMethod)
        if (exitMethod) {
            try {
                await exitMethod.call(document);
            } catch (e) {
                console.log(e)
            }
        }
    }
    enterFullScreen = () => {
        const enterMethod = document.documentElement.requestFullScreen || //W3C
            document.documentElement.webkitRequestFullScreen || //FireFox
            document.documentElement.mozRequestFullScreen || //Chrome等
            document.documentElement.msRequestFullScreen; //IE11

        // console.log(enterMethod)
        if (enterMethod) {
            enterMethod.call(document.documentElement);
        }
    }
    fullScreen = () => {
        let fs = this.state.fullScreen;
        if (fs) {
            this.exitFullScreen();
            this.state.fullScreen = false;
            // this.fullScreenBtn.innerText = "全屏"

        } else {
            this.enterFullScreen();
            this.state.fullScreen = true;
            // this.fullScreenBtn.innerText = "恢复"
        }
        // this.focus();
    }
}

const Guacamole = require('guacamole-common-js');
const ins = new Ins();


